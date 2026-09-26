#!/usr/bin/env node
// verify-move.mjs — the regression gate for the v2 migration.
//
// The v2 rebuild moves every chapter to a new path. Moving 4,729
// specification-anchored claims is the single most dangerous thing this
// repository has ever done to itself: a truncated write, a bad merge or a
// stray editor save would be invisible, because the result still lints, still
// builds, and still reads like the corpus. Nothing in lint.mjs or build.mjs
// compares a file against what it used to be.
//
// index.json already records a sha256 per chapter, computed by build.mjs over
// the whole file with CRLF normalised. This tool reads those hashes from a git
// ref taken BEFORE the move and re-checks them at the chapters' new paths. A
// chapter that was moved and not edited must hash identically. One that was
// deliberately edited has to be named with --allow, which forces the edit to
// be a decision rather than an accident.
//
//   node tools/verify-move.mjs --from <ref>            check the working tree
//   node tools/verify-move.mjs --from <ref> --allow p  permit one edited path
//
// Exit 0 when every chapter is accounted for, 1 otherwise.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Must match build.mjs exactly, including the CRLF normalisation that exists
// because autocrlf made every chapter in a fresh Windows clone look edited.
const sha256 = (s) => createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex')

const argv = process.argv.slice(2)
const argOf = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}
const FROM = argOf('--from') ?? 'HEAD'
const ALLOW = new Set(argv.flatMap((a, i) => (argv[i - 1] === '--allow' ? [a] : [])))

// Where each old skill's chapters land after the move. Keep this the single
// source of truth for the mapping; the migration script reads it too.
export const MOVE = {
  'intel-vt': 'x86-virt/references/intel',
  'amd-virtualization': 'x86-virt/references/amd',
}

const gitShow = (ref, path) => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}

let errors = 0
let checked = 0
let allowed = 0
const err = (m) => { console.error(`  \x1b[31m✗\x1b[0m ${m}`); errors++ }

for (const [skill, dest] of Object.entries(MOVE)) {
  const raw = gitShow(FROM, `${skill}/index.json`)
  if (!raw) {
    err(`${skill}/index.json not readable at ${FROM} — cannot establish a baseline`)
    continue
  }

  let idx
  try {
    idx = JSON.parse(raw)
  } catch (e) {
    err(`${skill}/index.json at ${FROM} is unparseable — ${e.message}`)
    continue
  }

  for (const ch of idx.chapters ?? []) {
    const file = ch.path.replace(/^references\//, '')
    const newPath = `${dest}/${file}`
    const abs = join(ROOT, newPath)

    if (ALLOW.has(newPath)) { allowed++; continue }

    if (!existsSync(abs)) {
      err(`${newPath} — missing; was ${skill}/${ch.path} at ${FROM}`)
      continue
    }

    const now = sha256(readFileSync(abs, 'utf8'))
    checked++
    if (now !== ch.sha256) {
      err(`${newPath} — content changed during the move`)
      console.error(`      was ${ch.sha256}`)
      console.error(`      now ${now}`)
      console.error(`      if this edit is deliberate: --allow ${newPath}`)
    }
  }
}

if (errors) {
  console.error(`\n\x1b[31m${errors} problem(s)\x1b[0m — ${checked} chapter(s) verified, ${allowed} allowed`)
  process.exit(1)
}

console.log(`\x1b[32mmove verified\x1b[0m — ${checked} chapter(s) hash-identical to ${FROM}${allowed ? `, ${allowed} deliberately edited` : ''}`)
