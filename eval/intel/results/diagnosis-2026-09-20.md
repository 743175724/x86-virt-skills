# intel-vt eval — Claude Opus 5 (claude-opus-5), diagnosis subset — 2026-09-20

Skill commit: e130c44
Questions: 20 (all `type: diagnosis`)  ·  must_include: 101/108 (93.5%)  ·  trap violations: 0  ·  citations valid: 16/20 (80%)
Routing correct on first try: 20/20 (100%)  ·  needed `00-quickref.md` §0.2: 0
Verdict: **FAIL** — `must_include` and trap thresholds met; `required_citation` validity 80% is below the 95% bar.

Protocol note: SKILL.md was read first and alone. For each question the routing target was recorded
from SKILL.md §Routing **before** any chapter was opened (table below). `errata.md` was read once,
before writing any answer, per SKILL.md rule 3. `must_include` / `must_not_include` /
`required_citation` fields were read only after all 20 answers were formed.

## Per-question results

| # | id | Routed to (before opening) | Route correct 1st try | Via | Chapters opened | must_include | Citation | Trap |
|---|---|---|---|---|---|---|---|---|
| 1 | vmlaunch-error-7 | `04-vm-entry.md` §4.9 | yes | routing table | 04, errata | 5/6 | valid | — |
| 2 | vmresume-error-5-after-migration | `04-vm-entry.md` §4.9 | yes | routing table | 04 | 5/5 | valid | — |
| 3 | vmlaunch-cf-no-error | `04-vm-entry.md` §4.9 | yes | routing table | 04, 01 | 4/4 | valid | — |
| 4 | vmlaunch-error-8-64bit | `04-vm-entry.md` §4.9 | yes | routing table | 04 | 6/6 | valid | — |
| 5 | entry-failure-33-qualification-0 | `04-vm-entry.md` §4.9 | yes | routing table | 04 | 6/6 | valid | — |
| 6 | entry-failure-34-msr-load | `04-vm-entry.md` §4.9 | yes | routing table | 04 | 6/6 | valid | — |
| 7 | vmxon-general-protection | `01-vmx-intro.md` | yes | routing table | 01 | 6/6 | valid | — |
| 8 | lost-event-during-delivery | `05-vm-exit.md` §5.3 | yes | routing table | 05 | 5/5 | valid | — |
| 9 | apicv-interrupts-lost-when-descheduled | `07-apic-virtualization.md` | yes | routing table | 07 | 4/4 | valid | — |
| 10 | msix-not-delivered-after-remapping | `11-vtd-interrupt-remapping.md` | yes | routing table | 11 | **3/6** | valid | — |
| 11 | device-dma-faulting | `12-vtd-faults-bios-siov.md` | yes | routing table | 12 | 5/6 | valid | — |
| 12 | seamcall-illegal-sequence | `13-tdx.md` | yes | routing table | 13 | **5/7** | valid | — |
| 13 | vtx-unavailable-on-windows | `17-windows-platform.md` §17.1 | yes | routing table | 17 | 6/6 | valid | not asserted |
| 14 | driver-rejected-after-memory-integrity | `15-security.md` §15.5 | yes | routing table | 15 | 6/6 | valid | — |
| 15 | hypervisor-works-linux-not-windows11 | `17-windows-platform.md` §17.1 | yes | routing table | 17, 16 | 6/6 | valid | — |
| 16 | vbs-overhead-figure | `16-performance.md` | yes | routing table | 16, 15, errata | 7/7 | valid | not asserted |
| 17 | modern-vmexit-cycles | `16-performance.md` | yes | routing table | 16, errata | 5/5 | **invalid** | not asserted |
| 18 | whp-vs-bare-vmx-figure | `16-performance.md` | yes | routing table | 16, 17 | 4/4 | **invalid** | — |
| 19 | wsl2-overhead-figure | `16-performance.md` | yes | routing table | 16, 17 | 4/4 | **invalid** | — |
| 20 | vtl-transition-cost | `16-performance.md` | yes | routing table | 16 | 3/3 | **invalid** | not asserted |

Routing ambiguity worth recording even though it did not cost a point: questions 1–4 name a
**VM-instruction error number**, which matches the `08-vmx-instructions.md` §8.4 row
("VM-instruction error 1–28") as strongly as the `04-vm-entry.md` §4.9 row ("why VM entry failed").
I chose 04 because the presenting symptom is a failed VM entry, and that was right — but a coin-flip
away from the wrong chapter. See Findings.

`must_not_include` handling: the four banned strings ("re-enable Intel VT-x in the BIOS",
"expect around 10% on average", "roughly 500 cycles on a modern core", "about 1000 cycles") were
neither asserted nor quoted. No refutation cases arose in this subset.

## Failures

### vmlaunch-error-7
**Asked:** "My hypervisor worked on my old test box and now VMLAUNCH sets ZF with VM-instruction error 7 on a newer machine. What is wrong?"
**Answered (the relevant passage, verbatim):** "Each of the pin-based, primary processor-based, VM-exit and VM-entry control fields must have every bit set to a value the corresponding capability MSR allows: bits 31:0 give the allowed-0 settings (a bit that is 0 there must be 0 in the control) and bits 63:32 give the allowed-1 settings (a bit that is 0 there must be 0 in the control). Because the allowed-0 half forces certain default-1 bits ON, a control field cannot simply be zero-initialised; the TRUE_* capability MSRs exist precisely to let software discover which of those default-1 bits may legitimately be cleared. Fix: re-derive every control field from the IA32_VMX_* capability MSRs at run time, on the machine you are actually on, rather than from a hard-coded constant. [SDM 3D App.A]"
**Missing:** "re-derive every control field from its capability MSR: OR in the allowed-0 half, AND with the allowed-1 half, and prefer the TRUE_ MSR when IA32_VMX_BASIC bit 55 is 1" — I gave the semantics and named the TRUE_* MSRs but never gave the `(x | allowed0) & allowed1` recipe, and never mentioned the **IA32_VMX_BASIC bit 55** gate that tells software the TRUE_* MSRs exist.
**Trap hit:** none
**Diagnosis:** chapter lacks the fact. `04-vm-entry.md` §4.3.1 and §4.10 state the allowed-0/allowed-1 semantics and point at `08-vmx-instructions.md` §8.6 for the TRUE_* MSRs, but neither the OR/AND recipe nor IA32_VMX_BASIC bit 55 appears anywhere in chapter 04. Chapter 04's own §4.10 step 5 is the section a diagnosing reader lands on, and it stops one line short of the code you would write.

### msix-not-delivered-after-remapping
**Asked:** "MSI-X stopped being delivered as soon as I enabled interrupt remapping. Some devices work, the ones with large index values do not."
**Answered (verbatim):** "'Large index values' is the tell, and there are two candidate causes. (1) The top bit of the handle is not adjacent to the others. In the remappable request format, address bits 19:5 carry Handle[14:0], bit 4 is the Interrupt Format field (1b), bit 3 is SHV, and **bit 2 carries Handle[15]**. Software that builds the MSI address by shifting a 16-bit handle left by 5 silently loses the top bit for handles at or above 0x8000, so every device whose index is ≥ 32768 is remapped through the wrong IRTE. [VT-d 5.20 §5.1.2.2, §5.1.5.2] (2) The table is too small. Entries = 2^(S+1) where S is IRTA_REG.S — a log2-minus-one, so S = 0 means two entries, not one. interrupt_index = address.handle when SHV is 0 and address.handle + data.subhandle when SHV is 1, so a subhandle can push the index past the end as well; if the computed interrupt_index is equal to or larger than the number of IRTEs, hardware treats the request as an error. [VT-d 5.20 §5.1.3, §11.4.10] Check the fault log: reason 21h is an interrupt_index beyond the configured table size, reason 22h is a Present field clear in the IRTE at that index. [VT-d 5.20 §5.1.4.1]"
**Missing:**
- "nothing in IRTA_REG takes effect until GCMD_REG.SIRTP (bit 24) is set and GSTS_REG.IRTPS (bit 24) reports it serviced"
- "the enable order is: program IRTA_REG, set SIRTP and wait for IRTPS, invalidate the interrupt entry cache with a global iec_inv_dsc, then set GCMD_REG.IRE (bit 25) and wait for GSTS_REG.IRES"
- "an index at or beyond the table size faults with reason 21h; a clear Present bit in the IRTE faults with 22h; a source-id verification failure faults with 26h" — I gave 21h and 22h but not **26h** (source-id verification failure against SID/SVT/SQ), so the compound item scores as a miss.
**Trap hit:** none
**Diagnosis:** fact present but not found. All three are in the chapter — the SIRTP/IRE handshake at §11.10 (lines 229–238), fault reason 26h at §11.9 (line 267/280). I located §11.3, §11.11 and the §11.12 pitfall list and answered from those without reading the enable sequence or the full fault table. This is a "the chapter buries it" failure: §11.12 pitfall 5 says *"Nothing in IRTA_REG takes effect until SIRTP"* but does not give the bit numbers or the ordering, so a reader who uses the pitfall list as the diagnostic index (which is what it reads like) gets a half-answer.

### device-dma-faulting
**Asked:** "A device's DMA is being blocked after I turned on DMA remapping, and my fault handler never fires."
**Answered (the relevant passage, verbatim):** "Read the Fault Recording Registers directly rather than waiting for the interrupt. If the register base address is X and CAP_REG.FRO reports Y, the first Fault Recording Register is at X + (16 × Y) and they are 16 bytes apart; FSTS_REG.FRI (bits 15:8) gives the index to start from and PPF (bit 1) is the logical OR of all the F fields. Process them in circular FIFO order from FRI until you find one with F clear, clearing each F by writing 1 to it (it is RW1C and sticky). [VT-d 5.20 §7.2.1, §11.4.7.1, §11.4.7.6]"
**Missing:** "the count is CAP_REG.NFR + 1".
**Trap hit:** none
**Diagnosis:** **chapter lacks the fact — and so does the eval's own premise.** `12-vtd-faults-bios-siov.md` says only that the Fault Recording Register count "is reported through the Capability Register" (§12.2, line 38); the string `NFR` does not occur anywhere in the chapter. The expected answer requires a field name the knowledge base never supplies. See Findings — I think the chapter is wrong here, not the eval.

### seamcall-illegal-sequence
**Asked:** "My TDX host code gets an error back from a SEAMCALL that the ABI spec says exists. What class of mistake is this usually?"
**Answered (the relevant passage, verbatim):** "Platform scope has its own ordering: TDH.SYS.INIT (global, once) → TDH.SYS.LP.INIT (per logical processor) → TDH.SYS.RD / TDH.SYS.RDALL / TDH.SYS.INFO (enumeration) → TDH.SYS.CONFIG → TDH.SYS.KEY.CONFIG (per package) → TDH.SYS.TDMR.INIT. [TDX-BASE §4.2, §4.3] … How to read what came back: RAX 0 is success, a positive value is success with an informational or warning code, and a negative value means the function aborted with an error; the completion-status class is in bits 47:40. [TDX-BASE §18.6.1, §18.6.3]"
**Missing:**
- "at module scope, until the module reaches SYS_READY only the TDH.SYS.* bring-up leaves are accepted" — I gave the bring-up *sequence* but never named the **SYS_READY** gate or said that nothing else is accepted before it.
- "a SEAMCALL can also fail before reaching a leaf at all, with #UD, #GP(0) or VMfailInvalid signalled by RFLAGS.CF = 1, in which case RAX is unmodified".
**Trap hit:** none
**Diagnosis:** fact present but not found, aggravated by routing granularity. Both facts are in chapter 13 — SYS_READY at line 75 (§13.4, `[TDX-ABI §5.4.1]`) and the pre-leaf failure modes at line 143 (§13.5, `[TDX-ABI §5.4.1]`). SKILL.md routes this question to `13-tdx.md` with **no section**, and the eval's own note says quickref §0.2 routes it to §13.7. §13.7 and §13.19 are exactly where I looked, and neither carries these two facts. The chapter is 560 lines; a symptom-shaped question needs a section pointer that spans §13.4, §13.7 and §13.19.

### modern-vmexit-cycles / whp-vs-bare-vmx-figure / wsl2-overhead-figure / vtl-transition-cost — citation failures
All four scored full marks on `must_include` and zero trap violations, and all four failed
`required_citation`.

**modern-vmexit-cycles — Answered (citation line, verbatim):** "Sources: Intel's 2010 measurement [400] for the Penryn/Nehalem/Westmere round trips, Adams & Agesen 2006 [401] for the bare transitions, NOVA 2010 [402] for the end-to-end figure; `16-performance.md` §16.2.3, §16.2.5, §16.2.7, and `errata.md` E09 for the two-quantities distinction."
**Missing:** `SDM 3C Ch.30`. Obtainable — §16.2.1's first claim carries `[SDM 3C Ch.30]` — but I cited the measurement sources rather than the architectural anchor, because the question asks for a number and every number in that section is anchored to `[400]`/`[401]`/`[402]`.

**whp-vs-bare-vmx-figure — Answered (citation line, verbatim):** "`17-windows-platform.md` §17.3.4 and `16-performance.md` §16.5, both anchored to Microsoft's Windows Hypervisor Platform documentation [465], which is a Tier-2 source."
**Missing:** `SDM 3C Ch.30`. **Not obtainable locally**: §16.5 contains three claims, all anchored `[465]` only, with no Intel anchor at all. Same for `17-windows-platform.md` §17.3.4.

**wsl2-overhead-figure — Answered (citation line, verbatim):** "`16-performance.md` §16.4 and `17-windows-platform.md` §17.4.1 / §17.4.6, anchored to Microsoft Learn [474][475][481] — Tier-2 sources, authoritative for Windows behaviour but not Intel specifications."
**Missing:** `SDM 3C Ch.31`. **Not obtainable locally**: §16.4's four claims are anchored `[474][475][481][416]`, no Intel anchor. `SDM 3C Ch.31` appears in §16.3.1 and §16.8 — i.e. attached to the second-level-translation claim, which is not what a WSL2 question is about.

**vtl-transition-cost — Answered (citation line, verbatim):** "`16-performance.md` §16.3.1 and §16.10.1 record the absence; §16.2.3 and §16.2.4 are the round-trip figures that bound it from below; [463] and [461][465] are the Microsoft sources."
**Missing:** `SDM 3C Ch.30`. **Not obtainable locally**: §16.10.1's claims are anchored `[1][9]` and `[461][465]`; the VTL-transition claim in §16.3.1 is anchored `[463]` alone.

## Notes

- **Context cost.** Twelve files opened in total (SKILL.md, errata.md, chapters 01, 04, 05, 07, 11,
  12, 13, 15, 16, 17). Chapter 04 alone answered six questions; the "one chapter plus errata" stop
  rule held for 14 of 20. The six that needed a second chapter were 3 (04+01, both describing the
  CF/ZF protocol), 15 and 18 (17+16 — mechanism in one, "no figure here" in the other), 16 (16+15+errata),
  19 (16+17). None of those was a routing error; they are questions that genuinely span the
  mechanism/measurement seam.
- **The stop rule and the performance chapter are in tension.** Questions 15, 16, 18, 19 and 20 all
  require pairing a mechanism stated in 15 or 17 with an explicit "no measured figure" stated in 16.
  A reader who obeys "stop after one chapter" answers 18 and 19 with mechanism and no honesty
  marker, or with the marker and no mechanism.
- **errata.md earned its rule.** O4 (the VBS/HVCI 6% / 5–10% / 5–25% conflict) and E09 (VM-exit cost
  is not one number) were directly load-bearing for questions 16 and 17, and both are the exact
  traps those questions encode. Reading errata before writing is not ceremony here.
- **Chinese summaries help routing.** Chapter 04's 中文速览 names the three failure modes
  (VMfail / 33 / 34) in its first sentence, which confirmed the route before any English prose was
  read. Same for chapter 11's, which names the SIRTP/IRE handshake I then failed to read.

## Findings for the maintainer

### 1. Routing misses — none occurred, but two entries are one bad guess away from one

No question in this subset was routed wrong, and the quickref symptom map was never needed. Two
routing-table entries are nonetheless fragile:

- **Rows `04` and `08` compete for every "VM-instruction error N" question.** Row 08 reads
  "VMX instruction semantics, **VM-instruction error 1–28**, capability MSRs"; row 04 reads
  "VM-entry checks, **why VM entry failed**, event injection". Questions 1–4 contain the literal
  token "error 7" / "error 5" / "error 8", which matches row 08's bolded range exactly. I went to 04
  on the reasoning that a symptom is a failed *entry*, not a failed *instruction* — but that is a
  judgement the table does not make for you.
  **Wording that would have fixed it:** change row 04 to
  `VM-entry checks, why VM entry failed, VMLAUNCH/VMRESUME failing with error 4/5/7/8/26, event injection`
  and row 08 to
  `VMX instruction semantics, the VM-instruction error number table (1–28), capability MSRs — for a failing VM entry read 04 first`.
  The error *table* and the error *diagnosis* should not both be advertised as the destination.

- **Row `13` has no section pointer, and the one the quickref gives is incomplete.** Every other
  high-traffic row resolves to a section (`§2.5`, `§4.9`, `§5.3`, `§8.4`, `§15.5`, `§17.1`). Row 13
  resolves to a 560-line chapter. The eval's own note says quickref §0.2 sends
  "SEAMCALL returns an error / illegal sequence" to §13.7 — but two of that question's seven expected
  facts live in §13.4 (SYS_READY) and §13.5 (pre-leaf #UD/#GP(0)/VMfailInvalid), not §13.7.
  **Fix:** make the quickref entry `13-tdx.md §13.4, §13.7, §13.19` and add a one-line
  "diagnosing a rejected SEAMCALL" pointer at the head of §13.7 naming the other two.

### 2. Symptoms the skill cannot currently diagnose, or diagnoses only halfway — worth filing

- **`12-vtd-faults-bios-siov.md` never names `CAP_REG.NFR`.** §12.2 says the Fault Recording
  Register count "is reported through the Capability Register" and §12.2.1 gives the base as
  `X + (16 × CAP_REG.FRO)`. A driver author cannot walk the ring without the count. The field name
  and the `+1` are missing and cannot be recovered from the chapter. **File as a content gap**:
  add "the number of Fault Recording Registers is CAP_REG.NFR + 1" next to the FRO claim.

- **`04-vm-entry.md` stops one line short of the fix for error 7.** §4.10 step 5 tells you to
  "re-derive every control field from the capability MSRs" and §4.3.1 gives the allowed-0/allowed-1
  semantics, but the chapter never states the computation (`value = (value | allowed0) & allowed1`)
  nor the **IA32_VMX_BASIC bit 55** flag that says whether the TRUE_* MSRs exist. Error 7 is the
  single most common cross-machine hypervisor failure and this is the chapter that owns it.
  Cross-restatement is prohibited, so either add the recipe here with a pointer to `08` §8.6, or make
  §4.10 step 5 say explicitly "the derivation rule and the bit-55 gate are in `08-vmx-instructions.md`
  §8.6 — read it, this step is not self-contained".

- **`11-vtd-interrupt-remapping.md` §11.12 reads like a diagnostic index and is not one.** The
  pitfall list is the first thing a symptom-driven reader will use, and pitfall 5
  ("Nothing in IRTA_REG takes effect until SIRTP") withholds the bit numbers and the ordering that
  §11.10 has three lines away. Promote the four-step enable sequence (IRTA_REG → SIRTP/IRTPS →
  `iec_inv_dsc` → IRE/IRES) into the pitfall entry, or cross-reference it by section number.

- **No chapter diagnoses "interrupt remapping was enabled but the fault reason is 26h".** Source-id
  verification failure (SID/SVT/SQ mismatch) is stated as a fault code in §11.9 but never appears in
  any symptom framing, even though it is the expected failure when a device is moved behind a bridge
  or a SID is programmed from the wrong BDF. Worth a line in the quickref symptom map.

### 3. Disagreements between a chapter and the eval's expected answer

- **`CAP_REG.NFR + 1` (device-dma-faulting).** The eval requires it; the chapter does not contain it.
  **My view: the chapter is wrong.** The eval is asking for exactly what a driver author needs, and
  `[VT-d 5.20 §11.4.2]` is already cited in that section for the FRO arithmetic, so the anchor is in
  hand. Fix the chapter, not the question.

- **`required_citation` on three of the five performance questions is not satisfiable from the
  section that owns the answer.** This is the finding I would act on first.
  - `wsl2-overhead-figure` requires `SDM 3C Ch.31`. §16.4 — the section that owns the answer — has
    **no Intel anchor at all**; its four claims are `[474][475][481][416]`, all Microsoft Learn or
    secondary. `SDM 3C Ch.31` appears only in §16.3.1 and §16.8, attached to the second-level-address-
    translation claim, which is a different subject.
  - `whp-vs-bare-vmx-figure` requires `SDM 3C Ch.30`. §16.5's three claims are all `[465]`.
  - `vtl-transition-cost` requires `SDM 3C Ch.30`. §16.10.1's claims are `[1][9]` and `[461][465]`;
    the VTL claim in §16.3.1 is `[463]` alone.

  **My view: the eval is wrong for `wsl2-overhead-figure`, and the chapter is wrong for the other
  two.** A question about what WSL2 costs has no business requiring an SDM address-translation
  anchor — that requirement should become `Microsoft Learn (WSL2 / utility VMs)` plus
  `16-performance.md §16.4`, matching what SKILL.md's "Known limits" already concedes about Tier-2
  Windows sources. But `whp-vs-bare-vmx-figure` and `vtl-transition-cost` are both ultimately claims
  about the cost of a **VM exit round trip**, and §16.5 / §16.10.1 should carry `[SDM 3C Ch.30]`
  alongside `[465]` the way §16.2.1 does. Add the anchor and both questions become answerable as
  specified.

  Note the systemic shape: this is the only subset where a correct, complete, honest answer scores a
  citation failure. SKILL.md's output standard says "Reproduce the Intel document and section in your
  answer", and chapter 16 frequently has no Intel document and section to reproduce. Either the
  standard needs an explicit Tier-2 carve-out for the Windows and measurement chapters, or those
  chapters need anchors. Right now `lint.mjs` presumably passes them because `[465]` is a valid
  bibliography reference, while the eval demands an SDM anchor the text does not have — the two
  checks disagree.

- **`vmlaunch-error-7`, IA32_VMX_BASIC bit 55.** The eval requires it, chapter 04 does not carry it,
  and chapter 08 §8.6 (which I did not open, correctly, per the stop rule) presumably does.
  **My view: the eval is right about what a user needs and the routing is wrong about where to get
  it.** Rather than restating bit 55 in chapter 04 — which the no-restatement rule forbids — §4.10
  step 5 should say that the step is not self-contained. A stop rule that says "one chapter answers
  almost everything" needs the chapters to be honest about the cases where they do not.
