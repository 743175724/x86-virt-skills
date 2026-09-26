#!/usr/bin/env node
// Zero-dependency linter for the specification-anchored skills in this repo.
//
//   node tools/lint.mjs                 lint every skill that has a lint.config.json
//   node tools/lint.mjs intel-vt        lint one skill
//   node tools/lint.mjs intel-vt amd-virtualization
//
// Exit 0 = clean, 1 = errors found.
//
// All skill-specific knowledge lives in <skill>/lint.config.json. This file is
// the engine and must stay vendor-neutral: if you find yourself writing "SDM"
// or "APM" here, it belongs in a config instead.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Frontmatter fields the open skill specification allows. Shared by every skill:
// packaging rejects anything else, so this is not a per-skill choice.
const SPEC_FRONTMATTER_FIELDS = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
])

// Correction hints every skill shares. A claim line matching one of these is
// talking *about* a misconception rather than committing it.
const BASE_CORRECTION_HINTS =
  /errata|misconception|讹传|no longer exist|does not exist|stale manual|\bwrong(ly)?\b|incorrect|rather than|instead of|unrelated|superseded|\bnot\b.{0,20}CVE-/i

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

// ------------------------------------------------------------------ config

/**
 * Build a RegExp from a {re, flags} pair. Bare strings are rejected on purpose:
 * an implicit flag set is how a misconception rule silently stops matching.
 */
function rx(spec, where) {
  if (spec == null) return null
  if (typeof spec !== 'object' || typeof spec.re !== 'string') {
    throw new Error(`${where}: expected { "re": "...", "flags": "..." }, got ${JSON.stringify(spec)}`)
  }
  if (spec.flags && /g/.test(spec.flags)) {
    throw new Error(`${where}: the "g" flag is not allowed — these patterns are used with .test() and would carry lastIndex between lines`)
  }
  try {
    return new RegExp(spec.re, spec.flags ?? '')
  } catch (e) {
    throw new Error(`${where}: ${e.message}`)
  }
}

const rxList = (arr, where) => (arr ?? []).map((s, i) => rx(s, `${where}[${i}]`))

function loadConfig(skillDir) {
  const p = join(skillDir, 'lint.config.json')
  if (!existsSync(p)) return null
  let raw
  try {
    raw = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error(`${basename(skillDir)}/lint.config.json: unparseable — ${e.message}`)
  }
  const w = (f) => `${basename(skillDir)}/lint.config.json ${f}`
  return {
    displayName: raw.displayName ?? basename(skillDir),
    archChapter: rx(raw.archChapter, w('archChapter')) ?? /^$/,
    datedFile: raw.datedFile ?? '90-dated-landscape.md',
    navigational: new Set(raw.navigational ?? []),
    claimFreeFiles: new Set(raw.claimFreeFiles ?? []),
    anchorPrefix: rx(raw.anchors?.prefix, w('anchors.prefix')) ?? /^$/,
    anchorUnverified: rx(raw.anchors?.unverified, w('anchors.unverified')) ?? /(Ch|§)\.?\?$/,
    anchorGrammar: rxList(raw.anchors?.grammar, w('anchors.grammar')),
    offSpecSubjects: rx(raw.offSpec?.subjects, w('offSpec.subjects')),
    offSpecPrimary: rx(raw.offSpec?.primaryAnchor, w('offSpec.primaryAnchor')),
    offSpecHints: rx(raw.offSpec?.sourceHints, w('offSpec.sourceHints')),
    offSpecMessage: raw.offSpec?.message ?? 'the primary specification does not document it',
    negPatterns: rx(raw.unscopedNegative?.patterns, w('unscopedNegative.patterns')),
    negScope: rx(raw.unscopedNegative?.scopeEvidence, w('unscopedNegative.scopeEvidence')),
    negMessage:
      raw.unscopedNegative?.message ??
      'a negative claim needs the same evidence as a positive one, scoped to a document and a date',
    deadTitles: raw.deadTitles ?? [],
    bannedHosts: raw.bannedHosts?.hosts ?? [],
    bannedMode: raw.bannedHosts?.mode ?? 'literal',
    bannedInBib: raw.bannedHosts?.inBibliography ?? 'off',
    legacyDocs: (raw.legacyDocs ?? []).map((d, i) => ({
      match: rx(d.match, w(`legacyDocs[${i}].match`)),
      requireHistorical: rx(d.requireHistorical, w(`legacyDocs[${i}].requireHistorical`)),
      maxConfidence: d.maxConfidence ?? 'medium',
      message: d.message ?? 'superseded document',
    })),
    misconceptions: (raw.misconceptions ?? []).map((m, i) => ({
      wrong: rx(m.wrong, w(`misconceptions[${i}].wrong`)),
      right: m.right,
    })),
    correctionHints: rx(raw.correctionHints, w('correctionHints')),
    crossRefEscape: rx(raw.ownership?.crossRefEscape, w('ownership.crossRefEscape')) ?? /$^/,
    ownership: (raw.ownership?.rules ?? []).map((o, i) => ({
      topic: rx(o.topic, w(`ownership.rules[${i}].topic`)),
      owner: o.owner,
    })),
    terminology: (raw.terminology ?? []).map((t, i) => ({
      wrong: rx(t.wrong, w(`terminology[${i}].wrong`)),
      right: t.right,
      exceptFiles: new Set(t.exceptFiles ?? []),
    })),
    orphanExemptBelow: raw.orphanExemptBelow ?? 1,
    evalQuestions: raw.eval?.questions ?? null,
    evalExpected: raw.eval?.expected ?? 80,
  }
}

// ------------------------------------------------------------------- engine

function lintSkill(skillName) {
  const SKILL_DIR = join(ROOT, skillName)
  const REFS = join(SKILL_DIR, 'references')
  const cfg = loadConfig(SKILL_DIR)
  const errors = []
  const warnings = []
  const noSpec = []
  const err = (file, msg) => errors.push(`${file}: ${msg}`)
  const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

  if (!cfg) {
    err(skillName, 'no lint.config.json — every skill needs one; see intel-vt/lint.config.json')
    return { errors, warnings, noSpec, chapters: 0, bib: 0, claims: 0 }
  }

  /** True when a line corrects a misconception rather than committing it. */
  const isCorrection = (line) =>
    BASE_CORRECTION_HINTS.test(line) || (cfg.correctionHints?.test(line) ?? false)

  const parseFrontmatter = (rawText, file) => {
    // Normalise line endings first. Git on Windows honours core.autocrlf and
    // checks LF content out as CRLF, so a fresh clone handed this "---\r\n" and
    // the exact "---\n" test reported "missing YAML frontmatter" — followed by
    // name "undefined" and an empty description, none of which were true.
    // .gitattributes now pins eol=lf, but a tool should not depend on a
    // checkout setting to read a file it owns.
    const text = rawText.replace(/\r\n/g, '\n')
    if (!text.startsWith('---\n')) { err(file, 'missing YAML frontmatter'); return {} }
    const end = text.indexOf('\n---', 4)
    if (end === -1) { err(file, 'unterminated YAML frontmatter'); return {} }
    const fields = {}
    let current = null
    for (const line of text.slice(4, end).split(/\r?\n/)) {
      const m = /^([A-Za-z][A-Za-z0-9_-]*):\s?(.*)$/.exec(line)
      if (m) {
        current = m[1]
        fields[current] = m[2] === '>' || m[2] === '|' ? '' : m[2]
      } else if (current && /^\s+/.test(line)) {
        fields[current] = (fields[current] + ' ' + line.trim()).trim()
      }
    }
    return fields
  }

  const tokensOf = (line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])

  // ------------------------------------------------------------- SKILL.md

  const skillPath = join(SKILL_DIR, 'SKILL.md')
  let skillText = ''
  let fm = {}
  if (!existsSync(skillPath)) {
    err('SKILL.md', 'not found')
  } else {
    skillText = readFileSync(skillPath, 'utf8')
    fm = parseFrontmatter(skillText, 'SKILL.md')

    for (const key of Object.keys(fm)) {
      if (!SPEC_FRONTMATTER_FIELDS.has(key)) {
        err('SKILL.md', `non-spec frontmatter field "${key}" — packaging rejects it. Allowed: ${[...SPEC_FRONTMATTER_FIELDS].join(', ')}`)
      }
    }
    const dirName = basename(SKILL_DIR)
    if (fm.name !== dirName) err('SKILL.md', `name "${fm.name}" must equal the directory name "${dirName}"`)
    if (fm.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) err('SKILL.md', `name "${fm.name}" must be lowercase [a-z0-9-], no leading/trailing/consecutive hyphens`)

    const desc = fm.description ?? ''
    if (!desc) err('SKILL.md', 'description is empty')
    if (desc.length > 1024) err('SKILL.md', `description is ${desc.length} chars, spec limit is 1024`)
    const firstSentence = (desc.split(/(?<=[.?!])\s/)[0] ?? desc)
    if (firstSentence.length > 60) {
      err('SKILL.md', `description's first sentence is ${firstSentence.length} chars; Hermes truncates to ~60, so it must stand alone within that budget`)
    }
    if (!/^[\x20-\x7E]+$/.test(firstSentence)) {
      warn('SKILL.md', 'the first 60 chars of description should be plain ASCII English so short-description hosts can match it')
    }

    const lineCount = skillText.split(/\r?\n/).length
    if (lineCount > 500) err('SKILL.md', `${lineCount} lines, limit is 500`)
  }

  // -------------------------------------------------- bibliography + chapters

  const bibPath = join(REFS, 'bibliography.md')
  const bibIds = new Set()
  const bibText = new Map()
  const bibUsed = new Set()
  if (!existsSync(bibPath)) {
    err('references/bibliography.md', 'not found')
  } else {
    const bibLines = readFileSync(bibPath, 'utf8').split(/\r?\n/)
    bibLines.forEach((line, i) => {
      const m = /^\[(\d+)\]\s+(\S.*)$/.exec(line)
      if (m) {
        const id = Number(m[1])
        if (bibIds.has(id)) err('references/bibliography.md', `duplicate citation ID [${id}]`)
        bibIds.add(id)
        bibText.set(id, m[2])
      }
      // A banned host sitting in the bibliography is invisible to a line-level
      // scan of the chapters, because chapters cite by [N] and never by URL.
      if (cfg.bannedInBib !== 'off') {
        for (const host of cfg.bannedHosts) {
          if (line.includes(host)) {
            const msg = `Tier-3 host ${host} is listed as a source; an architectural claim may not resolve to it`
            if (cfg.bannedInBib === 'error') err(`references/bibliography.md:${i + 1}`, msg)
            else warn(`references/bibliography.md:${i + 1}`, msg)
          }
        }
      }
    })
  }

  const chapterFiles = existsSync(REFS)
    ? readdirSync(REFS).filter((f) => f.endsWith('.md') && f !== 'bibliography.md').sort()
    : []

  // orphaned assets: a non-Markdown file under references/ that nothing cites.
  // Five PNGs shipped in every install this way, 384 KB, referenced by no
  // chapter -- the delete half of an earlier disposition ran and the re-home
  // half did not, and nothing noticed because nothing checked. An asset the
  // corpus does not reference is dead weight in every install.
  if (existsSync(REFS)) {
    const assets = []
    const walk = (dir, prefix) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`)
        else if (!entry.endsWith('.md')) assets.push(`${prefix}${entry}`)
      }
    }
    walk(REFS, '')
    if (assets.length) {
      const haystack = [
        ...chapterFiles.map((f) => readFileSync(join(REFS, f), 'utf8')),
        existsSync(bibPath) ? readFileSync(bibPath, 'utf8') : '',
        skillText ?? '',
      ].join('\n')
      for (const a of assets) {
        const name = a.split('/').pop()
        if (!haystack.includes(name)) {
          err(`references/${a}`, `orphaned asset — no chapter, bibliography entry or SKILL.md references it; re-home it or delete it`)
        }
      }
    }
  }

  const claimIndex = new Map() // normalized claim text -> [files]

  for (const file of chapterFiles) {
    const rel = `references/${file}`
    const text = readFileSync(join(REFS, file), 'utf8')
    const lines = text.split(/\r?\n/)
    const isArch = cfg.archChapter.test(file)
    const isDated = file === cfg.datedFile
    const isErrata = file === 'errata.md'
    const isClaimFree = cfg.claimFreeFiles.has(file)

    if (isArch && !/^>\s*\*\*中文速览\*\*/m.test(text)) {
      warn(rel, 'missing the required 中文速览 blockquote at the top of the chapter')
    }

    // Chapter titles that were renumbered out of existence upstream.
    lines.forEach((line, i) => {
      for (const dead of cfg.deadTitles) {
        if (line.includes(dead.text) && !isCorrection(line)) {
          err(`${rel}:${i + 1}`, dead.message)
        }
      }
    })

    lines.forEach((line, i) => {
      const n = i + 1
      const claim = /^\s*-\s+\*\*Claim\.\*\*\s+(.+)$/.exec(line)

      // Misconceptions may only appear in errata.md (as the thing being corrected).
      if (!isErrata && !isCorrection(line)) {
        for (const { wrong, right } of cfg.misconceptions) {
          if (wrong.test(line)) err(`${rel}:${n}`, `known misconception — ${right}`)
        }
      }

      // Terminology the skill has standardised away from.
      for (const t of cfg.terminology) {
        if (t.exceptFiles.has(file) || isErrata) continue
        if (t.wrong.test(line) && !isCorrection(line)) {
          warn(`${rel}:${n}`, `nonstandard terminology — ${t.right}`)
        }
      }

      // Banned architectural sources, literal form.
      if (isArch) {
        for (const host of cfg.bannedHosts) {
          if (line.includes(host)) {
            err(`${rel}:${n}`, `Tier-3 host ${host} appears in an architectural chapter; re-anchor to a Tier-1 document`)
          }
        }
      }

      if (!claim) return

      if (isClaimFree) {
        err(`${rel}:${n}`, `${file} is a navigation file and must hold no claim lines — state the fact in its owning chapter and point at it`)
      }

      const body = claim[1]
      const toks = tokensOf(line)
      // Accept both `[42]` `[43]` and `[42][43]` as multi-citation forms.
      const bibRefs = [...line.matchAll(/`((?:\[\d+\])+)`/g)]
        .flatMap((m) => [...m[1].matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])))
      const anchors = [...line.matchAll(/`\[([^\]`]+)\]`/g)].map((m) => m[1]).filter((a) => !/^\d+$/.test(a))
      const conf = toks.find((t) => t.startsWith('C:'))
      const vol = toks.find((t) => t.startsWith('V:'))

      // 1. every claim carries a citation
      if (bibRefs.length === 0) err(`${rel}:${n}`, 'claim has no `[N]` bibliography reference')
      // 2. resolvable
      for (const id of bibRefs) {
        if (!bibIds.has(id)) err(`${rel}:${n}`, `bibliography reference [${id}] does not resolve`)
        bibUsed.add(id)
      }
      // schema completeness
      if (!conf) err(`${rel}:${n}`, 'claim is missing `C:high|medium|low`')
      else if (!/^C:(high|medium|low)$/.test(conf)) err(`${rel}:${n}`, `bad confidence token \`${conf}\``)
      if (!vol) err(`${rel}:${n}`, 'claim is missing `V:durable|dated`')
      else if (!/^V:(durable|dated)$/.test(vol)) err(`${rel}:${n}`, `bad volatility token \`${vol}\``)

      // 5. dated quarantine
      if (vol === 'V:dated' && !isDated) {
        err(`${rel}:${n}`, `V:dated claim outside ${cfg.datedFile} — time-sensitive facts must be quarantined`)
      }

      // 6. banned sources, resolved through the bibliography
      if (isArch && cfg.bannedMode === 'resolve') {
        for (const id of bibRefs) {
          const entry = bibText.get(id) ?? ''
          for (const host of cfg.bannedHosts) {
            if (entry.includes(host)) {
              err(`${rel}:${n}`, `architectural claim resolves to [${id}], a Tier-3 source (${host}) — re-anchor to a Tier-1 document`)
            }
          }
        }
      }

      // 6b. superseded documents may only carry historical statements
      for (const d of cfg.legacyDocs) {
        const inLine = d.match.test(line)
        const inBib = bibRefs.some((id) => d.match.test(bibText.get(id) ?? ''))
        if (!inLine && !inBib) continue
        if (conf === 'C:high') {
          err(`${rel}:${n}`, `${d.message} — a claim resting on it may not be C:high`)
        }
        if (d.requireHistorical && !d.requireHistorical.test(body)) {
          err(`${rel}:${n}`, `${d.message} — state it as history (the claim must say so) or re-anchor to the current document`)
        }
      }

      // 3. anchor grammar
      for (const a of anchors) {
        if (!cfg.anchorPrefix.test(a)) continue
        if (cfg.anchorUnverified.test(a)) {
          if (conf !== 'C:low') err(`${rel}:${n}`, `unverified anchor \`[${a}]\` must be paired with C:low until someone checks the PDF`)
          continue
        }
        if (!cfg.anchorGrammar.some((re) => re.test(a))) {
          err(`${rel}:${n}`, `malformed Tier-1 anchor \`[${a}]\` — see CONVENTIONS.md §2`)
        }
      }

      // 4b. citation filler: an off-specification subject anchored only to the
      //     primary specification, which does not document it.
      if (cfg.offSpecSubjects?.test(body)) {
        const primary = anchors.filter((a) => cfg.offSpecPrimary?.test(a))
        const other = anchors.filter((a) => cfg.anchorPrefix.test(a) && !cfg.offSpecPrimary?.test(a))
        const hasOtherSource = bibRefs.some((id) => cfg.offSpecHints?.test(bibText.get(id) ?? ''))
        if (primary.length && !other.length && !hasOtherSource) {
          const subject = cfg.offSpecSubjects.exec(body)[0]
          err(`${rel}:${n}`, `claim about "${subject}" is anchored only to \`[${primary[0]}]\` — ${cfg.offSpecMessage}. Cite the advisory, vendor documentation or kernel.org instead, or drop the anchor and mark C:low`)
        }
      }

      // 4c. unscoped negative: a blanket "no such document exists" assertion
      //     with nothing to check it against. Three fabricated negatives have
      //     reached this corpus - README records the first two, errata.md E27
      //     the third, which stood in eight places and was refuted by this
      //     skill's own bibliography three lines from the assertion. The work
      //     contract already forbade this and did not prevent it, so the rule
      //     is mechanical: a negative must name a document number or carry an
      //     as-of date, or live in the dated file where it gets re-checked.
      if (cfg.negPatterns?.test(body) && !cfg.negScope?.test(body) && !isDated) {
        const phrase = cfg.negPatterns.exec(body)[0]
        err(
          `${rel}:${n}`,
          `unscoped negative "${phrase.trim()}" — ${cfg.negMessage}. Name the publication number or an as-of date, narrow it to the model range actually checked, or move it to \`${cfg.datedFile}\``,
        )
      }

      // 4. architectural claims need a Tier-1 anchor.
      // `[no-spec]` is the explicit escape: the author declares that no
      // specification documents this fact (product history, an ecosystem
      // convention). It is counted and listed below, so the exemption stays
      // auditable. Without it, a rule demanding an anchor the subject cannot
      // supply gets satisfied with a plausible-looking wrong one - which is
      // exactly how ~90 fabricated anchors entered this corpus.
      if (anchors.includes('no-spec')) {
        noSpec.push(`${rel}:${n}`)
      } else if (isArch && !cfg.offSpecSubjects?.test(body)) {
        const hasT1 = anchors.some((a) => cfg.anchorPrefix.test(a))
        if (!hasT1) err(`${rel}:${n}`, 'architectural claim has no Tier-1 anchor (use `[no-spec]` if no specification covers it)')
      }

      // 9. ownership (navigational files exist to talk about other chapters)
      if (!cfg.navigational.has(file)) {
        for (const { topic, owner } of cfg.ownership) {
          if (topic.test(body) && file !== owner && !cfg.crossRefEscape.test(body)) {
            warn(`${rel}:${n}`, `restates a fact owned by ${owner}; cross-reference it instead`)
          }
        }
      }

      // duplicate claim detection
      const norm = body.replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (norm.length > 40) {
        if (!claimIndex.has(norm)) claimIndex.set(norm, [])
        claimIndex.get(norm).push(`${rel}:${n}`)
      }
    })
  }

  for (const [, locs] of claimIndex) {
    if (locs.length > 1) warnings.push(`duplicate claim text at ${locs.join(', ')}`)
  }
  for (const id of bibIds) {
    if (!bibUsed.has(id) && id >= cfg.orphanExemptBelow) warn('references/bibliography.md', `entry [${id}] is never cited`)
  }

  // ------------------------------------------- 14: cross-skill pointers resolve
  //
  // A chapter that defers to the sibling skill writes `intel-vt/references/…`.
  // Rule 8 below only validates pointers within this skill, and rule 9's
  // ownership escape only looks for a bare `NN-name.md`, so a cross-skill
  // pointer was checked by nothing at all. Eleven of them in the AMD corpus
  // omitted the `references/` segment and pointed at paths that do not exist;
  // both skills read fine in isolation, so nothing surfaced it.
  for (const f of chapterFiles) {
    const body = readFileSync(join(REFS, f), 'utf8')
    for (const m of body.matchAll(/`((?:intel-vt|amd-virtualization)\/[A-Za-z0-9/_-]+\.md)`/g)) {
      if (!existsSync(join(ROOT, m[1]))) {
        err(`${skillName}/references/${f}`, `cross-skill pointer \`${m[1]}\` does not resolve — sibling chapters live under <skill>/references/`)
      }
    }
  }

  // ----------------------------------------------------- 8: routing integrity

  if (skillText) {
    const refd = [...skillText.matchAll(/`(references\/)?(\d{2}-[a-z0-9-]+\.md|errata\.md|core-facts\.md|00-quickref\.md|bibliography\.md)`(\s*§([0-9]+(\.[0-9]+)*))?/g)]
    for (const m of refd) {
      const fname = m[2]
      if (!existsSync(join(REFS, fname))) {
        err('SKILL.md', `routing table points at references/${fname}, which does not exist`)
        continue
      }
      if (m[4]) {
        const body = readFileSync(join(REFS, fname), 'utf8')
        const sec = m[4]
        const re = new RegExp(`^#{2,4}\\s+${sec.replace(/\./g, '\\.')}[\\s.]`, 'm')
        if (!re.test(body)) {
          err('SKILL.md', `routing anchor ${fname} §${sec} does not exist in that file`)
        }
      }
    }
  }

  // ----------------------------------------- 11: the eval set must stay valid
  // A renamed chapter or a retired anchor would otherwise rot the eval silently.
  // A *missing* eval set is a warning, never silence: losing this check by
  // moving the file is the failure mode this rule exists to prevent.

  if (!cfg.evalQuestions) {
    warn('lint.config.json', 'no eval.questions path configured — the behavioural test seam is unchecked')
  } else {
    const evalRel = cfg.evalQuestions
    const evalPath = join(ROOT, evalRel)
    if (!existsSync(evalPath)) {
      warn(evalRel, 'eval question set not found — the behavioural test seam is unchecked')
    } else {
      const lines = readFileSync(evalPath, 'utf8').split(/\r?\n/)
      const ids = new Set()
      let count = 0
      lines.forEach((line, i) => {
        const n = i + 1
        let m
        if ((m = /^- id:\s*(\S+)/.exec(line))) {
          count++
          if (ids.has(m[1])) err(`${evalRel}:${n}`, `duplicate question id "${m[1]}"`)
          ids.add(m[1])
        }
        if ((m = /^\s*chapter:\s*(\S+)/.exec(line))) {
          if (m[1] !== 'multiple' && !existsSync(join(REFS, m[1]))) {
            err(`${evalRel}:${n}`, `names chapter ${m[1]}, which does not exist`)
          }
        }
        if ((m = /^\s*required_citation:\s*"?([^"\n]+?)"?\s*$/.exec(line))) {
          const a = m[1].trim()
          if (/^errata\.md\b/.test(a)) return
          if (cfg.anchorPrefix.test(a) && !cfg.anchorGrammar.some((re) => re.test(a)) && !cfg.anchorUnverified.test(a)) {
            err(`${evalRel}:${n}`, `malformed Tier-1 anchor "${a}" in required_citation`)
          }
        }
      })
      if (count < cfg.evalExpected) warn(evalRel, `${count} questions; the protocol specifies ${cfg.evalExpected}`)

      // 13: a must_include value that appears nowhere in the corpus.
      //
      // The key and the chapters state the same facts twice, so a correction
      // applied to one and not the other leaves the key demanding a value the
      // skill can no longer produce — and the run then marks the skill down for
      // being right. That happened three times during the AMD rebuild: CR4's
      // defined range, a CVE's firmware levels, and errata E05.
      //
      // Scope it honestly, because it is weaker than it looks:
      //
      //  - It catches NUMERIC drift only. Of the four keys the AMD run
      //    disputed, three are invisible to it — a wrong register name, a
      //    dropped precondition, and a value that was in the corpus but
      //    belonged to a different CVE.
      //  - It has a blind spot for the very corrections it exists to police.
      //    "Present in the corpus" includes present inside a note explaining
      //    that the value is wrong. errata E05 records "corrected from 20-24
      //    to 20-23", so re-introducing 20-24 into the key does NOT fire this
      //    rule, even though that is the exact regression it was written for.
      //    Suppressing corrective context would need the same fuzzy
      //    isCorrection heuristic the misconception rules use, and getting it
      //    wrong here fails closed in the noisy direction, so it is left alone.
      //
      // It is a regression guard against silent numeric drift, not an audit,
      // and a clean run is not evidence that the key and the corpus agree.
      //
      // must_not_include is excluded on purpose: those values are *supposed* to
      // be absent, so checking them would fire on every trap question.
      const evalNorm = (t) => t.replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ')
      const corpusText = evalNorm(
        chapterFiles.map((f) => readFileSync(join(REFS, f), 'utf8')).join('\n'),
      )
      const VALUE = /\b(?:0x[0-9A-Fa-f]{2,}|[0-9A-F]{2,4}h|CVE-\d{4}-\d{4,5}|\d+\.\d+\.\d+[0-9A-F]*|bit \d{1,2}|\d{1,2}-\d{1,2}\b)/g
      const inCorpus = (tok) => {
        if (corpusText.includes(evalNorm(tok))) return true
        // a chapter often writes NAME(61) where a key writes "bit 61"
        const b = /^bit (\d{1,2})$/.exec(tok)
        return b ? corpusText.includes(`(${b[1]})`) : false
      }
      let inMustInclude = false
      lines.forEach((line, i) => {
        const k = /^  ([a-z_]+):/.exec(line)
        if (k) inMustInclude = k[1] === 'must_include'
        const item = /^ {4}- "(.*)"$/.exec(line)
        if (!item || !inMustInclude) return
        for (const tok of new Set(item[1].match(VALUE) || [])) {
          if (!inCorpus(tok)) {
            err(`${evalRel}:${i + 1}`, `must_include expects "${tok}", which appears nowhere in the corpus — the key and the chapters have drifted apart`)
          }
        }
      })
    }
  }

  // --------------------------------------------------------- 10: drift check

  const GENERATED = [
    { path: join(SKILL_DIR, 'index.json'), kind: 'json' },
    { path: join(SKILL_DIR, 'agents', 'openai.yaml'), kind: 'yaml' },
    { path: join(ROOT, 'AGENTS.md'), kind: 'md' },
  ]
  for (const g of GENERATED) {
    if (!existsSync(g.path)) { warn(basename(g.path), 'generated artifact missing — run tools/build.mjs'); continue }
    const t = readFileSync(g.path, 'utf8')
    if (!/DO NOT EDIT/i.test(t)) warn(basename(g.path), 'generated artifact lacks a DO NOT EDIT header')
  }
  const indexPath = join(SKILL_DIR, 'index.json')
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, 'utf8'))
      if (idx.description !== fm.description) err('index.json', 'description has drifted from SKILL.md — run tools/build.mjs')
      for (const entry of idx.chapters ?? []) {
        const p = join(SKILL_DIR, entry.path)
        if (!existsSync(p)) { err('index.json', `lists ${entry.path}, which does not exist`); continue }
        if (entry.sha256 !== sha256(readFileSync(p, 'utf8'))) {
          err('index.json', `${entry.path} has changed since the index was built — run tools/build.mjs`)
        }
      }
      const listed = new Set((idx.chapters ?? []).map((c) => basename(c.path)))
      for (const f of chapterFiles) if (!listed.has(f)) err('index.json', `references/${f} is not in the index`)
    } catch (e) {
      err('index.json', `unparseable: ${e.message}`)
    }
  }


  // 12. cross-chapter value conflicts.
  // Restatement is allowed - SKILL.md lets a feature chapter repeat the few
  // encodings it cannot be read without. Contradiction is not. Pair each named
  // field with the address it is given and fail when two chapters disagree, in
  // either direction. Matching is on the identifier token only, never on prose,
  // so rewording a claim cannot trip this.
  {
    const byName = new Map(), byValue = new Map()
    // The value must be the one nearest the name, with no other IA32_ identifier
    // between them - otherwise "IA32_VMX_BASIC bit 55 ... IA32_VMX_TRUE_X at 48DH"
    // pairs the address with the wrong name.
    const PAIR = /\b(IA32_[A-Z0-9_]{3,})\b(?:(?!IA32_)[^.]){0,40}?\b(?:0x([0-9A-Fa-f]{3,4})|([0-9A-F]{3,4})H)\b/g
    for (const file of chapterFiles) {
      readFileSync(join(REFS, file), 'utf8').split('\n').forEach((line, i) => {
        if (!/^\s*-\s+\*\*Claim\.\*\*/.test(line)) return
        const body = line.replace(/`[^`]*`/g, ' ')
        for (const m of body.matchAll(PAIR)) {
          const name = m[1]
          const value = (m[2] ?? m[3]).toUpperCase().replace(/^0+(?=.)/, '')
          const loc = `references/${file}:${i + 1}`
          if (!byName.has(name)) byName.set(name, new Map())
          if (!byName.get(name).has(value)) byName.get(name).set(value, [])
          byName.get(name).get(value).push(loc)
          if (!byValue.has(value)) byValue.set(value, new Map())
          if (!byValue.get(value).has(name)) byValue.get(value).set(name, [])
          byValue.get(value).get(name).push(loc)
        }
      })
    }
    for (const [name, values] of byName) {
      if (values.size < 2) continue
      err('cross-chapter', `${name} is given two different addresses: ` +
        [...values].map(([v, l]) => `${v}H at ${l[0]}`).join(' vs '))
    }
    for (const [value, names] of byValue) {
      if (names.size < 2) continue
      err('cross-chapter', `address ${value}H is given two different names: ` +
        [...names].map(([n, l]) => `${n} at ${l[0]}`).join(' vs '))
    }
  }

  return { errors, warnings, noSpec, chapters: chapterFiles.length, bib: bibIds.size, claims: claimIndex.size }
}

// --------------------------------------------------------------------- main

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const skills = requested.length
  ? requested.map((s) => s.replace(/[\\/]+$/, ''))
  : readdirSync(ROOT)
      .filter((d) => {
        try { return statSync(join(ROOT, d)).isDirectory() } catch { return false }
      })
      .filter((d) => existsSync(join(ROOT, d, 'SKILL.md')) && existsSync(join(ROOT, d, 'lint.config.json')))
      .sort()

if (!skills.length) {
  console.error('\nno skills found — a skill is a directory holding SKILL.md and lint.config.json\n')
  process.exit(1)
}

const label = (s) => s.replace(/^(\S+?):/, (_, f) => `\x1b[36m${f}\x1b[0m:`)
let failed = 0

for (const skill of skills) {
  let r
  try {
    r = lintSkill(skill)
  } catch (e) {
    console.error(`\n\x1b[31mconfig error\x1b[0m — ${e.message}\n`)
    process.exit(1)
  }
  const prefix = skills.length > 1 ? `[${skill}] ` : ''

  if (r.warnings.length) {
    console.log(`\n${prefix}\x1b[33m${r.warnings.length} warning(s)\x1b[0m`)
    for (const w of r.warnings) console.log('  ' + label(w))
  }
  if (r.errors.length) {
    console.log(`\n${prefix}\x1b[31m${r.errors.length} error(s)\x1b[0m`)
    for (const e of r.errors) console.log('  ' + label(e))
    failed++
    continue
  }
  console.log(`\n${prefix}\x1b[32mlint clean\x1b[0m — ${r.chapters} chapter file(s), ${r.bib} bibliography entries, ${r.claims} distinct claims`)
  // `[no-spec]` exempts a claim from the Tier-1 anchor rule, so the exemption
  // has to stay visible. Printing the count is what makes the escape safe to
  // offer: a silent exemption is how fabricated anchors got here in the first place.
  if (r.noSpec?.length) {
    const list = process.argv.includes('--no-spec')
    console.log(`${prefix}  ${r.noSpec.length} claim(s) declared \`[no-spec]\` — no specification documents them.` + (list ? '' : ' Pass --no-spec to list them.'))
    if (list) for (const loc of r.noSpec) console.log(`${prefix}    ${loc}`)
  }
}

if (failed) { console.log(''); process.exit(1) }
console.log('')
