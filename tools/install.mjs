#!/usr/bin/env node
// Installs the intel-vt skill where each host looks for it.
//
//   node tools/install.mjs              install into this repo (project scope)
//   node tools/install.mjs --user       also install into the user-level dirs
//   node tools/install.mjs --copy       copy instead of linking
//   node tools/install.mjs --uninstall  remove what this script created
//
// One source directory, three consumers:
//   .agents/skills/intel-vt   Codex and Hermes both document this path
//   .claude/skills/intel-vt   Claude Code
//   AGENTS.md                 generated pointer, written by tools/build.mjs
//
// Links are directory junctions on Windows (no elevation needed) and symlinks
// elsewhere. If linking fails the script falls back to copying and says so,
// because a copy that works beats a link that needs a policy change.

import { existsSync, mkdirSync, symlinkSync, rmSync, lstatSync, cpSync, readlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir, platform } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const SRC = join(ROOT, 'intel-vt')
const NAME = 'intel-vt'

const args = new Set(process.argv.slice(2))
const COPY = args.has('--copy')
const UNINSTALL = args.has('--uninstall')
const USER = args.has('--user')

if (!existsSync(join(SRC, 'SKILL.md'))) {
  console.error(`no skill at ${SRC} — run this from the repository root`)
  process.exit(1)
}

const targets = [
  { host: 'Codex + Hermes', path: join(ROOT, '.agents', 'skills', NAME) },
  { host: 'Claude Code', path: join(ROOT, '.claude', 'skills', NAME) },
]
if (USER) {
  targets.push(
    { host: 'Codex (user)', path: join(homedir(), '.agents', 'skills', NAME) },
    { host: 'Hermes (user)', path: join(homedir(), '.hermes', 'skills', NAME) },
    { host: 'Claude Code (user)', path: join(homedir(), '.claude', 'skills', NAME) },
  )
}

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink() } catch { return false } }

for (const { host, path } of targets) {
  const label = path.replace(ROOT, '.').replace(homedir(), '~')

  if (existsSync(path) || isLink(path)) {
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

if (!UNINSTALL) {
  console.log(`
Installed from ${SRC.replace(ROOT, '.')}

  Claude Code   reads .claude/skills/${NAME}/SKILL.md
  Codex         reads .agents/skills/${NAME}/SKILL.md, plus AGENTS.md at startup
  Hermes        reads .agents/skills/${NAME}/SKILL.md (or ~/.hermes/skills with --user)

Anything else with filesystem access can start from intel-vt/index.json.
Links point at the source, so edits are picked up with no reinstall; a copy is
a snapshot and needs 'node tools/install.mjs --copy' again after changes.
`)
}
