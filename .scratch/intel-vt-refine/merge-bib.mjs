// One-shot merge of the per-chapter bibliography fragments into
// intel-vt/references/bibliography.md, renumbering the temporary 1100+ band
// that the 06/07 author used into the 100-149 range and promoting the one
// Tier-1 entry in it into the Intel band.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'C:/Users/Administrator/Desktop/Kimi_Agent'
const BIB = join(ROOT, 'intel-vt/references/bibliography.md')
const FRAG = join(ROOT, '.scratch/intel-vt-refine/bib')
const REFS = join(ROOT, 'intel-vt/references')

const ENTRY = /^\[(\d+)\]\s+(.*\S)\s*$/

// --- collect -----------------------------------------------------------
const entries = new Map() // id -> text

for (const line of readFileSync(BIB, 'utf8').split('\n')) {
  const m = ENTRY.exec(line)
  if (m) entries.set(Number(m[1]), m[2])
}
const fromBase = new Set(entries.keys())

const temp = new Map()
for (const f of readdirSync(FRAG).filter((f) => f.endsWith('.md'))) {
  for (const line of readFileSync(join(FRAG, f), 'utf8').split('\n')) {
    const m = ENTRY.exec(line)
    if (!m) continue
    const id = Number(m[1])
    if (id >= 1000) { temp.set(id, m[2]); continue }
    if (entries.has(id) && !fromBase.has(id)) throw new Error(`duplicate id [${id}] across fragments`)
    if (fromBase.has(id)) { console.log(`  keeping base entry [${id}] (fragment copy ignored)`); continue }
    entries.set(id, m[2])
  }
}

// --- renumber the temporary band ---------------------------------------
// [1109] is the Intel 5-Level Paging white paper: Tier 1, belongs in 26-40.
const map = new Map()
let next = 107 // 100-106 are taken by the 01-03 author
for (const id of [...temp.keys()].sort((a, b) => a - b)) {
  if (/335252|5-Level Paging/i.test(temp.get(id))) { map.set(id, 26); continue }
  while (entries.has(next)) next++
  map.set(id, next++)
}
for (const [oldId, newId] of map) entries.set(newId, temp.get(oldId))

console.log('\nrenumbering map (temporary -> final):')
for (const [o, n] of map) console.log(`  [${o}] -> [${n}]${n === 26 ? '  (promoted to the Intel Tier-1 band)' : ''}`)

// --- rewrite the two chapters that used the temporary ids ---------------
for (const file of ['06-address-translation.md', '07-apic-virtualization.md']) {
  const p = join(REFS, file)
  let text = readFileSync(p, 'utf8')
  let n = 0
  text = text.replace(/\[(\d{4})\]/g, (whole, d) => {
    const to = map.get(Number(d))
    if (to === undefined) return whole
    n++
    return `[${to}]`
  })
  writeFileSync(p, text)
  console.log(`  rewrote ${n} citation token(s) in ${file}`)
}

// --- regenerate ---------------------------------------------------------
const SECTIONS = [
  [1, 40, '1–40 · Intel official (T1)',
   'Document numbers and revisions below were read directly from the Intel PDF cover pages or bookmark trees. Where Intel\'s own landing-page metadata disagrees with the PDF, the PDF governs.'],
  [41, 99, '41–99 · Other official specifications (T2)', null],
  [100, 199, '100–199 · VMX chapters (01–09)', null],
  [200, 249, '200–249 · VT-d (10–12)', null],
  [250, 299, '250–299 · TDX (13)', null],
  [300, 349, '300–349 · Nested virtualization (14)', null],
  [350, 399, '350–399 · Security (15)', null],
  [400, 449, '400–449 · Performance (16)', null],
  [450, 499, '450–499 · Windows platform (17)', null],
  [500, 549, '500–549 · Cross-vendor comparison (18)', null],
  [550, 599, '550–599 · Dated landscape (90)', null],
  [600, 649, '600–649 · Errata', null],
]

let out = `# Bibliography

Global citation ID space for this skill. Every \`[N]\` token in a chapter file resolves here.

**Tier key** — \`T1\` normative (Intel official specifications and advisories) · \`T2\` corroborating (kernel.org, LKML, peer-reviewed papers, other vendors' official specifications and documentation) · \`T3\` background (blogs, news, marketing — never the sole source for an architectural claim).

**ID ranges** — 1–40 Intel official · 41–99 other official specifications · 100–199 VMX chapters · 200–249 VT-d · 250–299 TDX · 300–349 nested · 350–399 security · 400–449 performance · 450–499 Windows platform · 500–549 comparison · 550–599 dated landscape · 600–649 errata.
`

const ids = [...entries.keys()].sort((a, b) => a - b)
for (const [lo, hi, title, note] of SECTIONS) {
  const inRange = ids.filter((i) => i >= lo && i <= hi)
  out += `\n---\n\n## ${title}\n\n`
  if (note) out += note + '\n\n'
  if (!inRange.length) { out += '_(none yet)_\n'; continue }
  for (const id of inRange) out += `[${id}] ${entries.get(id)}\n`
}

writeFileSync(BIB, out)
console.log(`\nmerged ${entries.size} bibliography entries into references/bibliography.md\n`)
