# Shared briefing — exhaustive verification of intel-vt ch.12 / ch.13

## Sources (ALREADY DOWNLOADED — do not re-download)
Directory `P` = `C:/Users/ADMINI~1/AppData/Local/Temp/claude/C--Users-Administrator-Desktop-Kimi-Agent/bbd19040-cdfd-4e00-9f07-368710a09886/scratchpad/pdfs/`

| file | document |
|---|---|
| `vtd.pdf` / `vtd.txt` | Intel VT-d Architecture Spec **Rev 5.20**, D51397-019, April 2026 |
| `siov.pdf` / `siov.txt` | Intel Scalable I/O Virtualization Tech Spec, 337679-002 **Rev 1.1**, Sept 2020 |
| `tdxbase.pdf` / `tdx-base.txt` | TDX Module Base Architecture Spec 348549-008US, May 2026 |
| `tdxabi.pdf` / `tdx-abi.txt` | TDX Module ABI Spec 348551-008US, May 2026 (335 pages) |
| `tdxcpu.pdf` / `tdxcpu.txt` | Intel TD CPU Architectural Extensions 343754-003US, Aug 2026 |
| `ghci.pdf` / `ghci.txt` | GHCI for Intel TDX 1.5, 348552-004US, March 2023 |
| `tdxconnect.pdf` | TDX Connect Architecture Spec |

The `.txt` files are `pdftotext` default (raw reading order) full extractions — grep these first.

## CRITICAL extraction hazard
In these PDFs, multi-column tables **desynchronise**. Both default and `-layout` mode can shift the
number column relative to the name column by one row. When a table looks scrambled:
1. Find the printed page number (`grep -n "Page NN of"`), then re-extract just those pages:
   `pdftotext -layout -f <p> -l <p> P/<file>.pdf -`
   For tdxabi.pdf the PDF page number EQUALS the printed page number.
2. **Cross-check any individual leaf number against that leaf's own section**, which states it in the
   RAX input-operand table (`Leaf number` row). Never report a leaf number WRONG on the summary
   table alone — confirm against the per-leaf section.
3. Resolve column shift by pairing numbers and names **in reading order** (they are 1:1 in sequence),
   not by which text happens to share a line.

### Already-established ground truth (do not re-litigate)
- VT-d CAP_REG bit 3 = Reserved (RsvdZ); bit 23 = Deprecated.
- Advanced fault logging was removed in VT-d Rev **4.0**, not 5.20.
- SEAMCALL Table 5.4 (TDX-ABI §5.4.1.2, printed pages 94-97) pairs in reading order:
  0 TDH.VP.ENTER, 1 TDH.MNG.ADDCX, 2 TDH.MEM.PAGE.ADD, 3 TDH.MEM.SEPT.ADD, 4 TDH.VP.ADDCX,
  5 TDH.MEM.PAGE.RELOCATE, 6 TDH.MEM.PAGE.AUG, 7 TDH.MEM.RANGE.BLOCK, 8 TDH.MNG.KEY.CONFIG,
  9 TDH.MNG.CREATE, 10 TDH.VP.CREATE, 11 TDH.MNG.RD, 12 TDH.MEM.RD, 13 TDH.MNG.WR, 14 TDH.MEM.WR,
  15 TDH.MEM.PAGE.DEMOTE, 16 TDH.MR.EXTEND, 17 TDH.MR.FINALIZE, 18 TDH.VP.FLUSH,
  19 TDH.MNG.VPFLUSHDONE, 20 TDH.MNG.KEY.FREEID, 21 TDH.MNG.INIT, 22 TDH.VP.INIT,
  23 TDH.MEM.PAGE.PROMOTE, 24 TDH.PHYMEM.PAGE.RDMD, 25 TDH.MEM.SEPT.RD, 26 TDH.VP.RD,
  28 TDH.PHYMEM.PAGE.RECLAIM, 29 TDH.MEM.PAGE.REMOVE, 30 TDH.MEM.SEPT.REMOVE, 31 TDH.SYS.KEY.CONFIG,
  32 TDH.SYS.INFO, 33 TDH.SYS.INIT, 34 TDH.SYS.RD, 35 TDH.SYS.LP.INIT, 36 TDH.SYS.TDMR.INIT,
  37 TDH.SYS.RDALL, 38 TDH.MEM.TRACK, 39 TDH.MEM.RANGE.UNBLOCK, 40 TDH.PHYMEM.CACHE.WB,
  41 TDH.PHYMEM.PAGE.WBINVD, 43 TDH.VP.WR, 45 TDH.SYS.CONFIG, 48 TDH.SERVTD.BIND,
  49 TDH.SERVTD.PREBIND, 52 TDH.SYS.SHUTDOWN, 53 TDH.SYS.UPDATE, 58 TDH.PHYMEM.PAMT.ADD,
  59 TDH.PHYMEM.PAMT.REMOVE, 60 TDH.EXT.INIT, 61 TDH.EXT.MEM.ADD, 62 TDH.INTR.CONFIG,
  63 TDH.SYS.WR, 64 TDH.EXPORT.ABORT, 65 TDH.EXPORT.BLOCKW, 66 TDH.EXPORT.RESTORE,
  68 TDH.EXPORT.MEM, 69 TDH.SYS.DISABLE, 70 TDH.EXPORT.PAUSE, 71 TDH.EXPORT.TRACK,
  72 TDH.EXPORT.STATE.IMMUTABLE, 73 TDH.EXPORT.STATE.TD, 74 TDH.EXPORT.STATE.VP,
  75 TDH.EXPORT.UNBLOCKW, 80 TDH.IMPORT.ABORT, 81 TDH.IMPORT.END, 82 TDH.IMPORT.COMMIT,
  83 TDH.IMPORT.MEM, 84 TDH.IMPORT.TRACK, 85 TDH.IMPORT.STATE.IMMUTABLE, 86 TDH.IMPORT.STATE.TD,
  87 TDH.IMPORT.STATE.VP, 92 TDH.MEM.SCAN.RANGE, 93 TDH.MEM.SCAN.COMP, 94 TDH.MEM.SCAN.CONFIG,
  95 TDH.MEM.SCAN.RESET, 96 TDH.MIG.STREAM.CREATE, 97 TDH.SERVTD.REBIND,
  128 TDH.IOMMU.SETUP, 129 TDH.IOMMU.CLEAR, 130 TDH.SPDM.CREATE, 131 TDH.SPDM.DELETE,
  132 TDH.IDE.STREAM.CREATE, 133 TDH.IDE.STREAM.BLOCK, 134 TDH.IDE.STREAM.DELETE,
  135 TDH.IDE.STREAM.KM, 136 TDH.TDI.BIND, 137 TDH.TDI.CREATE, 138 TDH.TDI.REMOVE,
  139 TDH.TDI.GET.STATE, 140 TDH.TDI.START, 141 TDH.TDI.STOP, 142 TDH.SPDM.CONNECT,
  143 TDH.SPDM.DISCONNECT, 144 TDH.SPDM.MNG, 150 TDH.DMAR.ADD, 151 TDH.DMAR.BLOCK,
  152 TDH.DMAR.RD, 153 TDH.DMAR.REMOVE, 154 TDH.MMIO.MT.ADD, 155 TDH.MMIO.MT.SET,
  156 TDH.MMIO.MT.RD, 157 TDH.MMIO.MT.REMOVE, 158 TDH.MMIO.MAP, 159 TDH.MMIO.BLOCK,
  160 TDH.MMIO.UNMAP, 161 TDH.IQ.INV.REQUEST, 162 TDH.IQ.INV.PROCESS,
  163 TDH.MEM.SHARED.SEPT.WR, 164 TDH.TDI.MT.ADD, 165 TDH.TDI.MT.REMOVE, 166 TDH.TDI.MT.RD.
  (27, 42, 44, 46-47, 50-51, 54-57, 67, 76-79, 88-91, 98-127, 145-149 are gaps in this table.)

## Your job
For EVERY line in your assigned range that begins `- **Claim.**` (and every row of the markdown
tables in that range), decide one verdict:
- `CONFIRMED` — the spec says this.
- `WRONG` — the spec says something different. **Quote the PDF text** and give the correct value.
- `UNSUPPORTED` — the cited anchor resolves to a real section but that section does not support the claim.
- `UNVERIFIABLE` — not resolvable from the available documents (e.g. third-party/errata facts).

Also check the **anchor** in backticks (e.g. `[VT-d 5.20 §7.2.1]`) actually points at the right section,
and the table rows near the claims.

## Output format — return as your FINAL MESSAGE text, no files
A markdown table, one row per claim:
`| <file line no> | <3-8 word claim topic> | <VERDICT> | <evidence: section + short quote, or correction> |`
Then a section `## WRONG / UNSUPPORTED details` giving, for each non-CONFIRMED item:
the file line number, the exact current text fragment that is wrong, the exact replacement text,
and the PDF quote proving it.
DO NOT EDIT ANY FILE. Report only. Be exhaustive and accurate; an "assumed correct" is a failure.
