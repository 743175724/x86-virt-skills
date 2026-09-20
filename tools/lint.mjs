#!/usr/bin/env node
// Zero-dependency linter for the intel-vt skill.
// Usage: node tools/lint.mjs [skill-dir]   (default: intel-vt)
// Exit 0 = clean, 1 = errors found.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, process.argv[2] ?? 'intel-vt')
const REFS = join(SKILL_DIR, 'references')

const errors = []
const warnings = []
const err = (file, msg) => errors.push(`${file}: ${msg}`)
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

// ---------------------------------------------------------------- constants

const SPEC_FRONTMATTER_FIELDS = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
])

// Chapters whose architectural claims must carry a Tier-1 anchor.
const ARCH_CHAPTER = /^(0[1-9]|1[0-4])-/
const DATED_FILE = '90-dated-landscape.md'

// Tier-1 anchor grammar. Anything inside backticked [...] that starts with one
// of these prefixes is treated as a T1 anchor and must match in full.
const T1_ANCHORS = [
  /^SDM 3[ABCD] (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+|App\.[A-Z])$/,
  /^SDM 4 (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+)$/,
  /^VT-d 5\.20 (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+|App\.[A-Z])$/,
  /^TDX-(BASE|ABI|ISA|GHCI|SEAMLDR|CONNECT|MIG|PART) (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+)$/,
  /^ISAEXT (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+)$/,
  /^SIOV (§[0-9]+(\.[0-9]+)*|Ch\.[0-9]+)$/,
]
const T1_PREFIX = /^(SDM [34]|VT-d |TDX-|ISAEXT |SIOV )/
// Explicitly-unverified anchors: allowed, but must be paired with C:low.
const T1_UNVERIFIED = /(Ch|§)\.?\?$/

// SDM chapters that were renumbered out of existence in rev 092. Citing them
// means the author worked from a stale manual.
const DEAD_SDM_TITLES = [
  'Virtualization of System Resources',
  'Handling Boundary Conditions in a VMM',
  'Managing State',
]

// Source hosts that may never carry an architectural claim.
const BANNED_ARCH_HOSTS = [
  'xem.github.io', 'kanxue.com', 'csdn.net', 'cnblogs.com',
  'juejin.cn', 'baike.baidu.com', '51cto.com',
]

// Known misconceptions. If the wrong form appears outside errata.md, fail.
const MISCONCEPTIONS = [
  { wrong: /CVE-2019-11091[^)]{0,40}ZombieLoad|ZombieLoad[^.]{0,40}CVE-2019-11091/i,
    right: 'ZombieLoad is CVE-2018-12130 (MFBDS)' },
  { wrong: /bit 7[^.]{0,60}guest-physical address[^.]{0,20}valid/i,
    right: 'EPT-violation qualification bit 7 is guest-LINEAR-address valid' },
  { wrong: /MBEC[^.]{0,40}Skylake/i, right: 'MBEC shipped with Kaby Lake' },
  { wrong: /PML[^.]{0,40}Skylake/i, right: 'PML shipped with Broadwell Xeon (2015)' },
  { wrong: /SOSP.?22[^.]{0,20}(OoH|Out of Hypervisor)|Out of Hypervisor[^.]{0,20}SOSP/i,
    right: 'Out of Hypervisor was published at SC’22' },
  { wrong: /TDXRay[^.]{0,80}INTEL-SA-01271|INTEL-SA-01271[^.]{0,80}TDXRay/i,
    right: 'TDXRay has no INTEL-SA number; Intel responded with announcement INTEL-2026-04-02-001. INTEL-SA-01271 is an unrelated Gaudi advisory' },
  { wrong: /(SIOV|Scalable I\/O Virtualization)[^.]{0,60}Rev(ision)? 1\.0/i,
    right: 'the SIOV specification cover reads Rev 1.1' },
  { wrong: /VT-d[^.]{0,40}Rev(ision)? 4\.1\b/i,
    right: 'the current VT-d specification is Rev 5.20 (D51397-019, April 2026); Rev 4.1 is what the stale landing page serves' },
]

// Subjects that appear nowhere in the Intel SDM. A claim about one of these
// whose ONLY anchor is an SDM section is citation filler: the section number
// resolves, but to an unrelated subject. This defect reached 44 claims in
// chapter 15 before a PDF check caught it, because the authoring rule demanded
// a Tier-1 anchor the subject could not honestly supply.
const NON_INTEL_SUBJECTS = /\b(HVCI|VBS|VTL[0-9]?|trustlet|Credential Guard|securekernel|Kerberos|BitLocker|Hyper-V|WSL2?|WHPX?|Windows Sandbox|Defender|ZombieLoad|Downfall|Retbleed|retpoline|L1TF|Foreshadow|RIDL|Fallout|VENOM|CVE-\d{4}-\d+)\b/i
const SDM_ONLY_ANCHOR = /^SDM 3[ABCD] /

// Fact ownership: topic pattern -> the one file allowed to make claims about it.
const OWNERSHIP = [
  { topic: /\bVMCS field encoding|VM-execution control field/i, owner: '02-vmcs.md' },
  { topic: /\bVM-instruction error\b/i, owner: '08-vmx-instructions.md' },
  { topic: /\bposted-interrupt descriptor\b/i, owner: '07-apic-virtualization.md' },
  { topic: /\bSEAMCALL\b|\bTDCALL\b|\bSecure.EPT\b/i, owner: '13-tdx.md' },
  { topic: /\bVMCS shadowing\b|\bvmcs02\b/i, owner: '14-nested-virtualization.md' },
  { topic: /\bHVCI\b|\bVBS\b/i, owner: '15-security.md' },
]

// Files whose whole job is to talk about other chapters' facts.
const NAVIGATIONAL = new Set(['errata.md', '00-quickref.md'])

/** True when a line is correcting a misconception rather than committing it. */
const isCorrection = (line) => /errata|misconception|讹传|no longer exist|does not exist|stale manual|\bwrong(ly)?\b|incorrect|rather than|instead of|unrelated|not Skylake|\bnot\b.{0,20}(CVE-|with an INTEL-SA|Rev)/i.test(line)

// ------------------------------------------------------------------- helpers

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

function parseFrontmatter(text, file) {
  if (!text.startsWith('---\n')) {
    err(file, 'missing YAML frontmatter')
    return {}
  }
  const end = text.indexOf('\n---', 4)
  if (end === -1) {
    err(file, 'unterminated YAML frontmatter')
    return {}
  }
  const body = text.slice(4, end)
  const fields = {}
  let current = null
  for (const line of body.split('\n')) {
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

/** Extract backticked tokens: `[SDM 3C §27.1]`, `[42]`, `C:high`, `V:durable`. */
function tokensOf(line) {
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}

// -------------------------------------------------------------- 6,7: SKILL.md

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

  const lineCount = skillText.split('\n').length
  if (lineCount > 500) err('SKILL.md', `${lineCount} lines, limit is 500`)
}

// --------------------------------------------------- bibliography + chapters

const bibPath = join(REFS, 'bibliography.md')
const bibIds = new Set()
const bibText = new Map()
const bibUsed = new Set()
if (!existsSync(bibPath)) {
  err('references/bibliography.md', 'not found')
} else {
  for (const line of readFileSync(bibPath, 'utf8').split('\n')) {
    const m = /^\[(\d+)\]\s+(\S.*)$/.exec(line)
    if (m) {
      const id = Number(m[1])
      if (bibIds.has(id)) err('references/bibliography.md', `duplicate citation ID [${id}]`)
      bibIds.add(id)
      bibText.set(id, m[2])
    }
  }
}

const chapterFiles = existsSync(REFS)
  ? readdirSync(REFS).filter((f) => f.endsWith('.md') && f !== 'bibliography.md').sort()
  : []

const claimIndex = new Map() // normalized claim text -> [files]

for (const file of chapterFiles) {
  const rel = `references/${file}`
  const text = readFileSync(join(REFS, file), 'utf8')
  const lines = text.split('\n')
  const isArch = ARCH_CHAPTER.test(file)
  const isDated = file === DATED_FILE
  const isErrata = file === 'errata.md'

  if (isArch && !/^>\s*\*\*中文速览\*\*/m.test(text)) {
    warn(rel, 'missing the required 中文速览 blockquote at the top of the chapter')
  }

  // Dead SDM chapter titles, per line so a correction can name them.
  lines.forEach((line, i) => {
    for (const dead of DEAD_SDM_TITLES) {
      if (line.includes(dead) && !isCorrection(line)) {
        err(`${rel}:${i + 1}`, `cites SDM chapter "${dead}", which no longer exists in rev 092 — the author used a stale manual`)
      }
    }
  })

  lines.forEach((line, i) => {
    const n = i + 1
    const claim = /^\s*-\s+\*\*Claim\.\*\*\s+(.+)$/.exec(line)

    // Misconceptions may only appear in errata.md (as the thing being corrected).
    if (!isErrata && !isCorrection(line)) {
      for (const { wrong, right } of MISCONCEPTIONS) {
        if (wrong.test(line)) err(`${rel}:${n}`, `known misconception — ${right}`)
      }
    }

    // Banned architectural sources.
    if (isArch) {
      for (const host of BANNED_ARCH_HOSTS) {
        if (line.includes(host)) {
          err(`${rel}:${n}`, `Tier-3 host ${host} appears in an architectural chapter; re-anchor to a Tier-1 Intel document`)
        }
      }
    }

    if (!claim) return

    const body = claim[1]
    const toks = tokensOf(line)
    const cites = toks.filter((t) => /^\d+$/.test(t.replace(/^\[|\]$/g, '')) || /^\[\d+\]$/.test(t))
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
      err(`${rel}:${n}`, `V:dated claim outside ${DATED_FILE} — time-sensitive facts must be quarantined`)
    }

    // 3. anchor grammar
    for (const a of anchors) {
      if (!T1_PREFIX.test(a)) continue
      if (T1_UNVERIFIED.test(a)) {
        if (conf !== 'C:low') err(`${rel}:${n}`, `unverified anchor \`[${a}]\` must be paired with C:low until someone checks the PDF`)
        continue
      }
      if (!T1_ANCHORS.some((re) => re.test(a))) {
        err(`${rel}:${n}`, `malformed Tier-1 anchor \`[${a}]\` — see CONVENTIONS.md §2`)
      }
    }

    // 4b. citation filler: a non-Intel subject anchored only to the SDM
    if (NON_INTEL_SUBJECTS.test(body)) {
      const sdm = anchors.filter((a) => SDM_ONLY_ANCHOR.test(a))
      const other = anchors.filter((a) => T1_PREFIX.test(a) && !SDM_ONLY_ANCHOR.test(a))
      // A Microsoft / kernel.org / advisory / paper reference in `[N]` settles it.
      const hasNonIntelSource = bibRefs.some((id) =>
        /microsoft|learn\.microsoft|kernel\.org|lore\.kernel|security-center|INTEL-SA|nvd\.nist|cve\.org|arxiv|usenix|acm\.org|ieee/i.test(bibText.get(id) ?? ''))
      if (sdm.length && !other.length && !hasNonIntelSource) {
        const subject = NON_INTEL_SUBJECTS.exec(body)[0]
        err(`${rel}:${n}`, `claim about "${subject}" is anchored only to \`[${sdm[0]}]\` — the SDM does not document it. Cite the advisory, Microsoft Learn or kernel.org instead, or drop the anchor and mark C:low`)
      }
    }

    // 4. architectural claims need a T1 anchor
    if (isArch && !NON_INTEL_SUBJECTS.test(body)) {
      const hasT1 = anchors.some((a) => T1_PREFIX.test(a))
      if (!hasT1) err(`${rel}:${n}`, 'architectural claim has no Tier-1 Intel anchor')
    }

    // 9. ownership (navigational files exist to talk about other chapters)
    for (const { topic, owner } of OWNERSHIP) {
      if (NAVIGATIONAL.has(file)) break
      if (topic.test(body) && file !== owner && !/\bsee\b|\bcross-ref|→|`\d\d-[a-z-]+\.md`/i.test(body)) {
        warn(`${rel}:${n}`, `restates a fact owned by ${owner}; cross-reference it instead`)
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
  if (!bibUsed.has(id) && id > 25) warn('references/bibliography.md', `entry [${id}] is never cited`)
}

// ------------------------------------------------------- 8: routing integrity

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

// ------------------------------------------- 11: the eval set must stay valid
// A renamed chapter or a retired anchor would otherwise rot the eval silently.

const evalPath = join(ROOT, 'eval', 'questions.yaml')
if (existsSync(evalPath)) {
  const text = readFileSync(evalPath, 'utf8')
  const lines = text.split('\n')
  const ids = new Set()
  let count = 0
  lines.forEach((line, i) => {
    const n = i + 1
    let m
    if ((m = /^- id:\s*(\S+)/.exec(line))) {
      count++
      if (ids.has(m[1])) err(`eval/questions.yaml:${n}`, `duplicate question id "${m[1]}"`)
      ids.add(m[1])
    }
    if ((m = /^\s*chapter:\s*(\S+)/.exec(line))) {
      if (m[1] !== 'multiple' && !existsSync(join(REFS, m[1]))) {
        err(`eval/questions.yaml:${n}`, `names chapter ${m[1]}, which does not exist`)
      }
    }
    if ((m = /^\s*required_citation:\s*"?([^"\n]+?)"?\s*$/.exec(line))) {
      const a = m[1].trim()
      if (/^errata\.md\b/.test(a)) return
      if (T1_PREFIX.test(a) && !T1_ANCHORS.some((re) => re.test(a)) && !T1_UNVERIFIED.test(a)) {
        err(`eval/questions.yaml:${n}`, `malformed Tier-1 anchor "${a}" in required_citation`)
      }
    }
  })
  if (count < 80) warn('eval/questions.yaml', `${count} questions; the protocol specifies 80`)
}

// ----------------------------------------------------------- 10: drift check

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

// ------------------------------------------------------------------- report

const label = (s) => s.replace(/^(\S+?):/, (_, f) => `\x1b[36m${f}\x1b[0m:`)
if (warnings.length) {
  console.log(`\n\x1b[33m${warnings.length} warning(s)\x1b[0m`)
  for (const w of warnings) console.log('  ' + label(w))
}
if (errors.length) {
  console.log(`\n\x1b[31m${errors.length} error(s)\x1b[0m`)
  for (const e of errors) console.log('  ' + label(e))
  console.log('')
  process.exit(1)
}
console.log(`\n\x1b[32mlint clean\x1b[0m — ${chapterFiles.length} chapter file(s), ${bibIds.size} bibliography entries, ${claimIndex.size} distinct claims\n`)
