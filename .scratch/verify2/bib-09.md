# Bibliography additions from the chapter-09 verification pass

**Reserved ID range for this file: 150–169.** Do not use IDs outside it.

## New entries

**None.** The exhaustive re-check of `references/09-smm-seam.md` (131 claim lines) needed three
primary documents, and all three are already in `references/bibliography.md` with stable IDs. No
claim in the chapter — including the two added during this pass — rests on a source the
bibliography does not already carry, so IDs 150–169 remain unallocated by chapter 09.

IDs 150–154 are, in any case, already occupied in `references/bibliography.md` (kernel.org, Xen and
FreeBSD exit-reason headers). If a later pass needs to allocate from this range, it should
reconcile against the live file first.

## Sources consulted, with the IDs they already hold

| Existing ID | Document | Used for |
|---|---|---|
| [1] | Intel SDM Vol.3C, Order 326019-092US, Rev 092, June 2026 — https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf | Ch.34 (SMM, default and dual-monitor treatments, MSEG, IA32_SMM_MONITOR_CTL), Ch.35 (SEAM modes, SEAMRR, TME-MK, the §35.5 instruction pages), §27.6.10 and §27.6.26, Table 27-19 |
| [2] | Intel SDM Vol.3D, Order 332831-092US, Rev 092, June 2026 — https://cdrdv2.intel.com/v1/dl/getContent/671269 | Appendix C, Table C-1 — basic exit reasons 5, 6, 18, 76, 77 |
| [5] | Intel SDM Vol.4, Model-Specific Registers, Rev 092 — https://cdrdv2.intel.com/v1/dl/getContent/671098 | §2.1 Table 2-2 — IA32_SMM_MONITOR_CTL (9BH), IA32_SEAMRR_BASE (1400H), IA32_SEAMRR_MASK (1401H), IA32_MTRRCAP bit 15. Newly cited by claims C096 and C097. |
| [14] | Intel Trust Domain CPU Architectural Extensions, Order 343754-003 | Cited by two pre-existing claims as the document the SDM delegates SEAMOPS/SEAMRET leaf detail and SEAM platform enablement to. Not re-downloaded: the claims are about what Vol.3C *says it delegates*, which was verified in Vol.3C itself. |

The Intel TDX Module Base Architecture Specification (bibliography ID [11]) was offered in the brief
for resolving the SEAM boundary. It was not needed: every claim in this chapter is ISA-level SEAM,
so nothing had to be adjudicated against the TDX module specification.

## Verification provenance

Downloaded 2026-09-20 with `curl -L`, converted with `pdftotext` 4.06 (`-layout`, plus a second
raw-order pass for Appendix C and the Vol.4 MSR tables, where `-layout` scrambles the number column
away from the description column). Vol.3C PDF 2,178,770 bytes, cover "Order Number: 326019-092US,
June 2026". Vol.4 PDF 3,004,271 bytes. All three documents were reachable.
