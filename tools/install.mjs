#!/usr/bin/env node
// Installs this repository's skills where each host looks for them.
//
//   node tools/install.mjs              install every skill (project scope)
//   node tools/install.mjs intel-vt     install one skill
//   node tools/install.mjs --user       also install into the user-level dirs
//   node tools/install.mjs --copy       copy instead of linking
//   node tools/install.mjs --uninstall  remove what this script created
//
// One source directory per skill, three consumers:
//   .agents/skills/<name>   Codex and Hermes both document this path
//   .claude/skills/<name>   Claude Code
//   AGENTS.md               generated pointer, written by tools/build.mjs
//
// Links are directory junctions on Windows (no elevation needed) and symlinks
// elsewhere. If linking fails the script falls back to copying and says so,
// because a copy that works beats a link that needs a policy change.

import { existsSync, mkdirSync, symlinkSync, rmSync, lstatSync, cpSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir, platform } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('-')))
const named = args.filter((a) => !a.startsWith('-')).map((s) => s.replace(/[\\/]+$/, ''))

const COPY = flags.has('--copy')
const UNINSTALL = flags.has('--uninstall')
const USER = flags.has('--user')

const discovered = readdirSync(ROOT)
  .filter((d) => { try { return statSync(join(ROOT, d)).isDirectory() } catch { return false } })
  .filter((d) => existsSync(join(ROOT, d, 'SKILL.md')))
  .sort()

const skills = named.length ? named : discovered

if (!skills.length) {
  console.error('\nno skills found — a skill is a directory holding SKILL.md\n')
  process.exit(1)
}
for (const name of skills) {
  if (!existsSync(join(ROOT, name, 'SKILL.md'))) {
    console.error(`no skill at ${join(ROOT, name)} — run this from the repository root`)
    process.exit(1)
  }
}

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink() } catch { return false } }

// Hermes resolves its home as: HERMES_HOME env var, else a platform default of
// %LOCALAPPDATA%/hermes on Windows and ~/.hermes everywhere else; skills live in
// <home>/skills. Verified against hermes_constants.get_hermes_home() in v0.21.3.
//
// This matters because an earlier version of this script hard-coded ~/.hermes on
// every platform, so `--user` on Windows — the platform these skills target —
// created a directory Hermes never reads and reported success.
const hermesSkillsDir = () => {
  const env = process.env.HERMES_HOME?.trim()
  if (env) return join(env, 'skills')
  if (platform() === 'win32') {
    const local = process.env.LOCALAPPDATA?.trim()
    return join(local || join(homedir(), 'AppData', 'Local'), 'hermes', 'skills')
  }
  return join(homedir(), '.hermes', 'skills')
}

for (const NAME of skills) {
  const SRC = join(ROOT, NAME)

  // Kimi Code CLI 2.x reads .agents/skills/ and .kimi-code/skills/, and does
  // NOT read .claude/skills/ -- the legacy kimi-cli did. The .agents/ target
  // already covers it at project scope, but a user-scope Kimi install lives
  // under ~/.kimi-code/skills/ and was previously not managed here at all, so
  // anything placed there by hand drifted silently from this tree.
  const kimiSkillsDir = () => {
    const env = process.env.KIMI_HOME?.trim()
    return join(env || join(homedir(), '.kimi-code'), 'skills')
  }

  const targets = [
    { host: 'Codex + Hermes + Kimi', path: join(ROOT, '.agents', 'skills', NAME) },
    { host: 'Claude Code', path: join(ROOT, '.claude', 'skills', NAME) },
  ]
  if (USER) {
    targets.push(
      { host: 'Codex (user)', path: join(homedir(), '.agents', 'skills', NAME) },
      { host: 'Hermes (user)', path: join(hermesSkillsDir(), NAME) },
      { host: 'Claude Code (user)', path: join(homedir(), '.claude', 'skills', NAME) },
      { host: 'Kimi Code CLI (user)', path: join(kimiSkillsDir(), NAME) },
    )
  }

  for (const { host, path } of targets) {
    const label = path.replace(ROOT, '.').replace(homedir(), '~')

    if (existsSync(path) || isLink(path)) {
      // Say so when we are replacing a real directory rather than a link. A
      // copy does not track this tree, so it drifts with no error anywhere --
      // which is exactly what happened to a hand-placed Kimi install that sat
      // byte-identical for four days and would have gone stale on the next
      // edit. Naming it is the only signal the user gets.
      if (!isLink(path) && !UNINSTALL) {
        console.log(`  replacing ${label} — was a real directory, not a link; a copy drifts silently`)
      }
      // Only remove what we would have made: a link, or a directory holding a copy.
      rmSync(path, { recursive: true, force: true })
      if (UNINSTALL) { console.log(`  removed   ${label}`); continue }
    } else if (UNINSTALL) {
      console.log(`  absent    ${label}`)
      continue
    }

    mkdirSync(dirname(path), { recursive: true })

    if (COPY) {
      cpSync(SRC, path, { recursive: true })
      console.log(`  copied    ${label}  (${host})`)
      continue
    }

    try {
      symlinkSync(SRC, path, platform() === 'win32' ? 'junction' : 'dir')
      console.log(`  linked    ${label}  (${host})`)
    } catch (e) {
      cpSync(SRC, path, { recursive: true })
      console.log(`  copied    ${label}  (${host}) — link failed: ${e.code}; re-run with --copy after edits`)
    }
  }
}

if (!UNINSTALL) {
  const list = skills.map((n) => `  ${n}`).join('\n')
  console.log(`
Installed ${skills.length} skill(s) from ${ROOT.replace(homedir(), '~')}:

${list}

  Claude Code   reads .claude/skills/<name>/SKILL.md
  Codex         reads .agents/skills/<name>/SKILL.md, plus AGENTS.md at startup
  Kimi Code CLI reads .agents/skills/ and ~/.kimi-code/skills/ — NOT .claude/skills/
                (the legacy kimi-cli did read .claude/skills/; 2.x does not)
  Hermes        does NOT scan this repo. It reads <HERMES_HOME>/skills — which is
                ${hermesSkillsDir().replace(homedir(), '~')}
                Use --user to install there, or add this repo's .agents/skills to
                skills.external_dirs in Hermes's config.yaml.

Anything else with filesystem access can start from <name>/index.json.
Links point at the source, so edits are picked up with no reinstall; a copy is
a snapshot and needs 'node tools/install.mjs --copy' again after changes.
`)
}
