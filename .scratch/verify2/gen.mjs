import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const ROOT = 'C:/Users/Administrator/Desktop/Kimi_Agent'
const rows = readFileSync(ROOT + '/.scratch/verify2/claims.tsv', 'utf8')
  .split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'))

const W = {
  A11: ['WRONG', 'Anchor. The claim itself is true, but §3.11.4 is "Determining Memory Type" — it is about memory-type selection, and only its two subsection titles happen to carry the TTM values. Retargeted to §11.4.5, whose TTM field lists all four encodings: "00: legacy mode - uses root tables and context tables. 01: scalable mode ... 10: reserved ... 11: abort-dma mode."'],
  A44: ['WRONG', 'SSPTPTR is not "bits 63:12" here. §9.6 is the one structure in Ch.9 whose Bits column is written in HAW terms: "63:HAW  R: Reserved" / "HAW-1:12  SSPTPTR: Second Stage Page Translation Pointer". (§9.1, §9.3, §9.4 and §9.5 really do print 63:12 and push the HAW caveat into the Description, which is the convention the chapter was applying.) Corrected to (HAW-1):12 with 63:HAW Reserved, in the claim and in the §10.4.6 table.'],
  A45: ['WRONG', 'FSPTPTR is not "bits 191:140". §9.6: "191: HAW+128  R: Reserved" / "HAW+127: 140  FSPTPTR: First Stage Page Translation Pointer". Corrected to (HAW+127):140 with 191:(HAW+128) Reserved, in the claim and in the §10.4.6 table.'],
  A60: ['WRONG', 'IR and IW are not symmetric. §9.8 Table 47, and Tables 43 and 45 word for word: bit 62 "IW: I/O Write - This field is treated as Reserved(0) when Second Stage I/O Read/Write bits are not enabled"; bit 61 "IR: I/O Read - This field is ignored when Second Stage I/O Read/Write bits are not enabled." The difference is load-bearing: with SSIRWE=0 a non-zero IW trips the reserved-field check and a non-zero IR does not.'],
  A117: ['WRONG', 'The pre-edit text read "Hardware completes an IOTLB invalidation descriptor only after all context-cache invalidation descriptors ahead of it in the invalidation queue are completed" - omitting the PASID-cache half, and, sitting directly beside the p_iotlb claim that did name both, implying iotlb_inv_dsc need not wait for pc_inv_dsc. §6.5.2.12 states one rule for both forms: "Hardware must execute an IOTLB invalidation descriptor (iotlb_inv_dsc) or PASID-based-IOTLB invalidation descriptor (p_iotlb_inv_dsc) only after all Context-cache invalidation descriptors (cc_inv_dsc) and PASID-cache invalidation descriptors (pc_inv_dsc) ahead of it in the Invalidation Queue are completed." The pair was rewritten: A116 now carries that combined rule and A117 carries the two rules the chapter was missing (pc_inv_dsc after cc_inv_dsc; dev_tlb_inv_dsc after iotlb_inv_dsc and iec_inv_dsc).'],
  A130: ['WRONG', 'Not Rev 5.20. The Revision History attributes the Host Permission Table to Rev 5.0, August 2024: "Added support for Host Permission Tables. (Section 4.2.4)". Rev 5.20, April 2026, has exactly three entries and none of them introduces HPT: "Some fault conditions are not applicable (NA) when HPT is not enabled Section 7.1.3", "Addition of DMA_REMAP_OPT_OUT in DMAR structure in Section 8.1", "Minor modifications to Appendix A to improve readability."'],
  A135: ['WRONG', 'The qualifier "unless the configuration permits them" has no basis. §7.1.3 condition RTA.5 (fault reason 34h) is unconditional: "Hardware implementations with Major Version 8 and above (VER_REG) detected an untranslated/translation/translated request-with-PASID with Execute-Requested (ER) field set." No configuration permits it - ECAP_REG.ERS is defined as "planned for deprecation. Implementations must report this field as Clear". The Major-Version-7-and-below half of the claim was right: condition SPT.5 does gate on ERS being 0.'],
  B38: ['WRONG', 'Over-generalised from SMI to every vector-ignoring delivery mode. §9.9 states the zeroing requirement for SMI alone - 010b: "the vector field is ignored, but must be programmed to all zeros for future compatibility" - while 100b (NMI) says only "The vector information is ignored for implementations not supporting NMI-source reporting" and 101b (INIT) only "The vector information is ignored". Neither carries a zeroing requirement.'],
  B41: ['WRONG', 'Anchor. §5.1.4.1 is "Interrupt Remapping Fault Conditions" and says nothing about forwarding a request to the system bus. The sentence is footnote 2 of §5.1.4: "When forwarding the remapped interrupt request to the system bus, the `Trigger Mode Level` field in the interrupt request on the system bus is always set to \u201casserted\u201d (1b)." Retargeted to §5.1.4.'],
}

const N = {
  A75: 'Re-confirmed against the §11.4.2 bit table: bit 3 Access = RsvdZ, Field = "R: Reserved"; bit 23 Access = RsvdZ, Field = "DEP: Deprecated". Bits 54 and 55 (DWD, DRD) carry deprecation prose in their Description but keep their own field names, so "only bit 23 carries the DEP marking" holds exactly.',
  A76: 'Correct as far as it went (000b-100b) but three encodings short of the register. Extended with 101b = 14-bit (16K), 110b = 16-bit (64K) and 111b reserved, which is what makes the 16-bit DID fields of §9.3 and §9.6 meaningful.',
  A116: 'Rewritten in this pass to carry the combined §6.5.2.12 rule - see A117. The pre-edit text (p_iotlb after cc and pc) was itself correct.',
  A136: '§3.12.7 "Intel Scalable I/O Virtualization Capable Devices" is present in the body on printed pages 3-26/3-27, even though the printed table of contents stops at §3.12.6. The anchor resolves; the TOC is what is incomplete.',
  A140: 'Appendix A exists and is titled "Snoop and Memory Type for Various Structures"; its first two blocks are DMA Remapping Structures and Interrupt Remapping Structures.',
  B45: 'Both §9.9 and §9.10 open the SQ row with "The SVT field may be used to verify the origination of interrupt requests generated by devices supporting phantom functions" - an evident slip for SQ, since it is the SQ encodings that perform the phantom-function masking. The claim reads it as SQ, which is the only coherent reading.',
  B68: 'Bit numbering is relative to the 32-bit DST field, matching §11.4.10 word for word: "Hardware interprets only 8-bits ([15:8]) of Destination-ID field in the IRTEs. The high 16-bits and low 8-bits of the Destination-ID field are treated as reserved." In absolute IRTE bits that is 47:40, which is how §9.9 spells it out.',
  B97: 'Claim confirmed. Separately, the §11.10 table showed the Qualified column for 2Ah as "-"; Table 15 gives No. Table corrected.',
  B98: 'Claim confirmed. Separately, the §11.10 table showed the Qualified column for 2Bh as "-"; Table 15 gives No. Table corrected.',
}

const hdr = (f) => f === 'A'
  ? '## `references/10-vtd-dma-remapping.md` — 140 claims'
  : '## `references/11-vtd-interrupt-remapping.md` — 112 claims'

const preamble = `# Exhaustive verification: VT-d chapters 10 and 11 against the Rev 5.20 specification

**Scope.** Every claim line in \`intel-vt/references/10-vtd-dma-remapping.md\` (140) and
\`intel-vt/references/11-vtd-interrupt-remapping.md\` (112) — 252 claims — checked against the
primary source rather than from memory.

**Primary source.** Intel Virtualization Technology for Directed I/O Architecture Specification,
Order **D51397-019, Rev 5.20, April 2026**, downloaded from
\`https://cdrdv2-public.intel.com/919688/D51397-019-vt-directed-io-spec.pdf\` and text-extracted with
\`pdftotext\`. Register and structure tables were read in **raw reading order** (\`-raw\`, page by page)
rather than with \`-layout\`: on this document \`-layout\` desynchronises the Bits column from the Field
column — the Capability Register and the interrupt-remapping fault table both scramble badly — and
reading a bit position off a \`-layout\` dump is exactly how a register offset gets misread. Where a
figure legend was the only source for a bit position (CAP_REG, ECAP_REG, both IRTE formats), the
per-bit description table on the following pages was used to confirm it.

The specification's own page numbers map to PDF pages as: 3-1 → 30, 5-1 → 73, 6-1 → 90, 7-1 → 138,
9-1 → 182, 11-1 → 236.

**Anchor method.** Every section anchor was resolved twice — once against the printed table of
contents and once against the heading in the body — because the two disagree in this revision.
§5.1.2 ("Interrupt Request Formats On Intel 64 Platforms") and §3.12.7 ("Intel Scalable I/O
Virtualization Capable Devices") exist in the body but are missing from the printed contents. Both
are cited by these chapters and both resolve; had only the TOC been consulted, two correct anchors
would have been reported as dangling.

## Verdict counts

| Verdict | ch.10 | ch.11 | total |
|---|---|---|---|
| CONFIRMED | 133 | 110 | **243** |
| WRONG | 7 | 2 | **9** |
| UNSUPPORTED | 0 | 0 | **0** |
| UNVERIFIABLE | 0 | 0 | **0** |
| **Total** | **140** | **112** | **252** |

9 in 252, roughly 1 in 28 — about half the rate the exhaustive passes over other chapters in this
corpus have been finding, which matches the earlier sampling result that this author genuinely worked
from the PDF. Two of the nine are mis-anchors rather than wrong facts. Everything bit-exact and hard
to reconstruct from memory — the full ECAP_REG bit map from C at 0 to IRREQ at 62, both 128-bit IRTE
layouts, the 512-bit scalable-mode PASID-table entry, all ten invalidation descriptor type codes, the
96FFFFFFh one-shot mask and its bit-by-bit effect, the twelve interrupt-remapping fault reasons with
their Qualified column — came back clean. All nine errors are fixed in place.

## The nine WRONG claims

| # | What it said | Correction |
|---|---|---|
| A11 | TTM mode-selection anchored \`§3.11.4\` | → \`§11.4.5\`; §3.11.4 is *Determining Memory Type* |
| A44 | SSPTPTR "bits 63:12" in the scalable-mode PASID-table entry | §9.6 prints **(HAW-1):12**, with 63:HAW Reserved |
| A45 | FSPTPTR "bits 191:140" | §9.6 prints **(HAW+127):140**, with 191:(HAW+128) Reserved |
| A60 | "IR and IW … treated as Reserved(0)" when SS I/O R/W is disabled | IW is Reserved(0); **IR is merely ignored** |
| A117 | IOTLB descriptor waits only on context-cache descriptors | §6.5.2.12 requires **context-cache *and* PASID-cache** |
| A130 | "Rev 5.20 adds the Host Permission Table" | HPT was added in **Rev 5.0**, August 2024 |
| A135 | ER requests rejected on MajVer ≥ 8 "unless the configuration permits them" | RTA.5 is **unconditional**; no permitting configuration exists |
| B38 | vector must be zeroed "for delivery modes that ignore the vector" | The zeroing requirement is stated for **SMI only** |
| B41 | Trigger-Mode-Level anchored \`§5.1.4.1\` | → \`§5.1.4\`, where the footnote lives |

## Non-claim defects fixed in the same pass

Prose, tables and pitfalls rather than \`- **Claim.**\` lines, so outside the 252 and outside the
verdict counts — but each contradicted the specification or the chapter's own claims.

| Where | Defect | Fix |
|---|---|---|
| 10 §10.1 | "Rev 5.20 also renamed first-level/second-level to first-stage/second-stage" | The rename is **Rev 3.4, December 2021**: "Renamed \`First-level\` to \`First-stage\`. Renamed \`Second-level\` to \`Second-stage\`." |
| 10 §10.4.6 table | SSPTPTR 63:12, FSPTPTR 191:140 | HAW-relative ranges plus their Reserved neighbours, matching §9.6 |
| 10 §10.4.8 prose | "Second-stage entries are a different format from the CPU's EPT entries" | §9.8: "Second-stage paging entries are **bitwise compatible** with the Intel 64 processor's EPT paging entry format" |
| 10 §10.6.3 table | \`pgrp_resp_dsc\`; HPT descriptor left unnamed | §7.6.1 spells it \`page_grp_resp_dsc\`; §6.5.2.7 spells the HPT one \`hpt_inv_desc\` |
| 10 §10.5.2 table | "DIT — Device-TLB" | DIT is **Device-TLB Invalidation Throttle**; DT at bit 2 is Device-TLB support |
| 10 pitfall 6 | "Bit 3 of CAP_REG … deprecated in Rev 5.20" — flatly contradicting claim A75 in the same file | Bit 3 is plain Reserved (RsvdZ); the DEP marking sits on CAP_REG bit 23 and ECAP_REG bits 5, 24 and 28 |
| 11 §11.10 table | Fault reasons 2Ah and 2Bh Qualified = "—" | Table 15 gives **No** for both |

## Terminology sweep

No surviving first-level/second-level terminology in either chapter. The only two occurrences are the
terminology note in §10.3 and pitfall 1 in §10.9, both of which name the old spelling in order to
forbid it. Mnemonics are the Rev 5.20 set throughout: FSTS, SSTS, SSADS, SSADE, SSPTPTR, FSPTPTR,
FSPM, SSIRWS/SSIRWE, SSLPS, FS5LP, FS1GP, SMPWCS.

## Bibliography

No new entries. All 252 claims rest on \`[8]\` — the VT-d Rev 5.20 specification, already carried in
\`references/bibliography.md\` at that id with the correct order number, revision, date and URL. IDs
525–539 remain unallocated; see \`.scratch/verify2/bib-10-11.md\`.

---

# Per-claim table

\`#\` is the claim's ordinal within its file; \`A\` is chapter 10 and \`B\` is chapter 11. Line numbers are
post-fix. Claim text is abridged where long; the files are authoritative.
`

const out = [preamble]
let cur = null
const esc = (s) => s.replace(/\|/g, '\\|')
for (const [f, n, line, anchor, txt] of rows) {
  if (f !== cur) {
    cur = f
    out.push('')
    out.push(hdr(f))
    out.push('')
    out.push('| # | Line | Anchor | Claim (abridged) | Verdict | Note |')
    out.push('|---|---|---|---|---|---|')
  }
  const key = f + n
  const hit = W[key]
  const v = hit ? '**WRONG**' : 'CONFIRMED'
  const note = hit ? hit[1] : (N[key] ?? '')
  const short = txt.length > 150 ? txt.slice(0, 147).replace(/\s+\S*$/, '') + '…' : txt
  out.push(`| ${f}${n} | ${line} | \`${anchor}\` | ${esc(short)} | ${v} | ${esc(note)} |`)
}
out.push('')

mkdirSync(ROOT + '/eval/intel-vt/verify', { recursive: true })
writeFileSync(ROOT + '/eval/intel-vt/verify/full-10-11.md', out.join('\n'))
console.log('written rows:', rows.length)
