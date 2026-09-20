#!/usr/bin/env node
// Merges the per-chapter bibliography staging files into references/bibliography.md.
//
// Agents write .scratch/amd-virt-refine/bib/<range>.md instead of appending to the
// shared file, because concurrent appends to one file lose writes. This script does
// the merge once, in ID order, and reports three things the sibling skill got wrong:
//   - duplicate IDs (two agents claiming the same number)
//   - out-of-range IDs (an agent writing outside its allotted block)
//   - orphans (entries never cited by any claim line) — 27 of these were merged into
//     the Intel skill before anyone noticed.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'C:/Users/Administrator/Desktop/Kimi_Agent'
const BIBDIR = join(ROOT, '.scratch/amd-virt-refine/bib')
const REFS = join(ROOT, 'amd-virtualization/references')
const TARGET = join(REFS, 'bibliography.md')

const RANGES = {
  '01': [100, 149], '02': [100, 149], '03': [150, 169], '04': [170, 184],
  '05': [185, 199], '06': [200, 239], '07': [240, 269], '08': [270, 289],
  '09': [290, 309], '10': [310, 329], '11': [330, 349], '12': [350, 379],
  '13': [380, 399], '14': [400, 429], '15': [430, 459], '16': [460, 499],
  '17': [500, 549], '18': [550, 579], '19': [580, 609], '90': [610, 659],
  'errata': [660, 699],
}

const entryRe = /^\[(\d+)\]\s+(.*)$/
const collected = new Map()   // id -> {text, from}
const problems = []

// 1. what is already in bibliography.md (the preseeded 1-99 block, and anything merged before)
const existing = readFileSync(TARGET, 'utf8')
const existingIds = new Set()
for (const line of existing.split(/\r?\n/)) {
  const m = line.match(entryRe)
  if (m) existingIds.add(Number(m[1]))
}

// 2. staged files
if (!existsSync(BIBDIR)) { console.error('no staging dir'); process.exit(1) }
for (const f of readdirSync(BIBDIR).filter((f) => f.endsWith('.md')).sort()) {
  const declared = f.replace('.md', '').match(/(\d+)-(\d+)/)
  const lo = declared ? Number(declared[1]) : null
  const hi = declared ? Number(declared[2]) : null
  for (const line of readFileSync(join(BIBDIR, f), 'utf8').split(/\r?\n/)) {
    const m = line.match(entryRe)
    if (!m) continue
    const id = Number(m[1])
    if (existingIds.has(id)) { problems.push(`${f}: [${id}] already exists in bibliography.md`); continue }
    if (collected.has(id)) { problems.push(`${f}: [${id}] duplicate — also in ${collected.get(id).from}`); continue }
    if (lo !== null && (id < lo || id > hi) && !(id >= 580 && id <= 609 && f.includes('580'))) {
      problems.push(`${f}: [${id}] outside declared range ${lo}-${hi}`)
    }
    collected.set(id, { text: line.trim(), from: f })
  }
}

// 3. which IDs are actually cited by a claim line anywhere in the corpus
const cited = new Set()
for (const f of readdirSync(REFS).filter((f) => f.endsWith('.md'))) {
  const body = readFileSync(join(REFS, f), 'utf8')
  for (const m of body.matchAll(/`\[((?:\d+)(?:\]\[\d+)*)\]`/g)) {
    for (const n of m[1].split('][')) cited.add(Number(n))
  }
}
const orphans = [...collected.keys()].filter((id) => !cited.has(id)).sort((a, b) => a - b)

// 4. write
const ids = [...collected.keys()].sort((a, b) => a - b)
let out = existing.trimEnd() + '\n'
let lastBlock = null
for (const id of ids) {
  const owner = Object.entries(RANGES).find(([, [lo, hi]]) => id >= lo && id <= hi)
  const block = owner ? owner[1].join('-') : 'unassigned'
  if (block !== lastBlock) { out += `\n## ${block} · 章节引用\n\n`; lastBlock = block }
  out += collected.get(id).text + '\n'
}
if (process.argv.includes('--write')) { writeFileSync(TARGET, out); console.log(`merged ${ids.length} entries into bibliography.md`) }
else console.log(`dry run — would merge ${ids.length} entries (pass --write)`)

console.log(`\nstaged files: ${readdirSync(BIBDIR).filter((f) => f.endsWith('.md')).length}`)
console.log(`entries: ${ids.length}   cited-by-corpus: ${ids.filter((i) => cited.has(i)).length}`)
if (orphans.length) console.log(`\nORPHANS (never cited — delete these, do not merge them):\n  ${orphans.join(', ')}`)
if (problems.length) { console.log('\nPROBLEMS:'); for (const p of problems) console.log('  ' + p) }
if (!orphans.length && !problems.length) console.log('\nno orphans, no range violations')
