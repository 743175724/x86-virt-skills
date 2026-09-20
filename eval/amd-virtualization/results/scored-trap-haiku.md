# amd-virtualization eval — trap questions — Haiku 4.5 — 2026-09-21

Skill commit: 736cc35
Questions: 12  ·  must_include: 46/47 (97.9%)  ·  trap violations: 0  ·  citations valid: 100%
Verdict: PASS

## Failures

### trap-x2avic-cpuid-bit
**Asked:** Which CPUID bit enumerates x2AVIC? I have `Fn8000_000A EDX[14]` written down.

**Answered:** "x2AVIC is enumerated by **`CPUID Fn8000_000A_EDX[18]`**. ... `EDX[14]` is reserved. ... §15.29.7 states... `Fn8000_000A_EDX[AVIC]` (**bit 13**) reports AVIC, and `Fn8000_000A_EDX[x2AVIC]` (**bit 18**) ... Vol.3's `Fn8000_000A_EDX` table confirms it... bit 13 `AVIC`, **bit 14 Reserved**, bit 15 `VMSAVEvirt`, bit 18 `x2AVIC`. `errata.md` **E09** records the provenance of the `EDX[14]` error."

**Missing:** The answer mentions that errata.md E09 records the provenance but does not explicitly state that the error came from a 2022 kernel patch letter. The key requires: "the EDX[14] value came from a 2022 kernel patch letter that carried it in error, and the mistake propagated."

**Trap hit:** None

**Diagnosis:** Fact present but not surfaced. The answer references errata.md E09 which documents this, but the answer does not quote or summarize the kernel patch origin. A reader would need to consult the errata separately.

---

## Per-question scoring

| ID | must_include hits/total | violations | citation valid |
|---|---|---|---|
| trap-client-sev-cpuid | 4/4 | 0 | yes |
| trap-x2avic-cpuid-bit | 3/4 | 0 | yes |
| trap-cmdbufrun-register | 4/4 | 0 | yes |
| trap-irte-bit0-name | 2/2 | 0 | yes |
| trap-iommu-mmio-window-size | 4/4 | 0 | yes |
| trap-vmexit-restores | 5/5 | 0 | yes |
| trap-vmload-vmsave-ss | 3/3 | 0 | yes |
| trap-two-dimensional-walk-count | 5/5 | 0 | yes |
| trap-branch-type-confusion-cve | 4/4 | 0 | yes |
| trap-hyperv-image-name | 4/4 | 0 | yes |
| trap-enlightened-vmcb | 5/5 | 0 | yes |
| trap-vmgexit-encoding | 3/3 | 0 | yes |

**Totals:** 46/47 must_include items (97.9%), 0 violations (PASS), 12/12 citations valid (100%)

## Notes

The exam passes on all trap-violation criteria (zero violations required) and citation standards (100% valid). The single miss is a fact documented by reference only (errata.md E09) rather than stated in the answer itself: the origin of the EDX[14] error in a 2022 kernel patch letter.

Scoring assessment: **Strict.** The answer demonstrates complete mastery of the technical content and correct citation practice across all twelve trap questions. The single must_include miss on Q2 reflects a valid interpretation of the scoring rule: the origin of the kernel patch error is not explicitly reproduced in the answer, even though it is documented in the corpus via errata.md E09. An answer that names the errata entry but does not quote its content leaves the reader to verify the claim independently, which violates the "record the verbatim answer for every failed item" principle — the verbatim answer does not include the kernel-patch-origin phrase, only a reference to where it lives.
