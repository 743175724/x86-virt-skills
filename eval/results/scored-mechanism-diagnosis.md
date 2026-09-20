# intel-vt eval — independent scoring of `mechanism` + `diagnosis`

Scored by: independent scorer (did **not** write the answers)
Date: 2026-09-20
Protocol: `eval/RUNNER.md` — score literally, a refutation is not a violation, record the verbatim sentence for every failed item.
Key: `eval/questions.yaml` (`must_include`, `must_not_include`, `required_citation`)
Answers: `eval/answers/mechanism.md` (24), `eval/answers/diagnosis.md` (20)

---

## Headline

| Subset | must_include | % | asserted violations | refuted | citations valid | honest-gap | key-disputed |
|---|---|---|---|---|---|---|---|
| mechanism | 150 / 154 | 97.4% | 0 | 1 | 24 / 24 (100%) | 0 | 0 |
| diagnosis | 99 / 108 | 91.7% | 0 | 1 | 20 / 20 (100%) | 0 | 0 |
| **combined** | **249 / 262** | **95.0%** | **0** | **2** | **44 / 44 (100%)** | **0** | **0** |

Bar: must_include ≥ 90% · violations 0 · citations ≥ 95% → **PASS** (both subsets individually and combined).

---

## Per-question — mechanism (24)

| id | hit/total | cite | violations | honest-gap | key-disputed | routing as recorded by the answerer |
|---|---|---|---|---|---|---|
| vm-entry-check-order | 8/8 | valid (SDM 3C Ch.29) | none | no | no | `04-vm-entry.md` §4.9 |
| pir-virr-merge-and-on-sn-race | 9/9 | valid (SDM 3C Ch.32) | none | no | no | `07-apic-virtualization.md` |
| vmcs-shadowing-mechanism | 7/7 | valid (SDM 3C §27.6.15) | none | no | no | `14-nested-virtualization.md` |
| vmcs02-merging | 8/8 | valid (SDM 3C §27.6.1/§27.6.2) | none | no | no | `14-nested-virtualization.md` |
| secure-ept-page-acceptance | 7/7 | valid (TDX-BASE §9.10.1) | none | no | no | `13-tdx.md` §13.8 |
| vtd-queued-invalidation | 7/7 | valid (VT-d 5.20 §6.5.2) | none | no | no | `10-vtd-dma-remapping.md` |
| hvci-uses-ept | 5/5 | valid (SDM 3C §31.3.2 + MS Learn) | none | no | no | `15-security.md` §15.5 |
| virtual-interrupt-delivery | 7/7 | valid (SDM 3C Ch.32) | none | no | no | `07-apic-virtualization.md` |
| ept-violation-vs-misconfiguration | **8/9** | valid (SDM 3C Ch.31) | none | no | no | `06-address-translation.md` + `05-vm-exit.md` §5.4 |
| default1-controls-and-true-msrs | 8/8 | valid (SDM 3D App.A) | **refuted, not asserted** | no | no | `02-vmcs.md` §2.5 + `08-vmx-instructions.md` §8.4 |
| idt-vectoring-reinjection | 6/6 | valid (SDM 3C §27.9.3) | none | no | no | `05-vm-exit.md` §5.4 |
| vpid-ept-tagging | 7/7 | valid (SDM 3C Ch.31) | none | no | no | `06-address-translation.md` |
| ve-conversion-and-busy-field | 5/5 | valid (SDM 3C §27.6.19) | none | no | no | `06-address-translation.md` |
| ipi-virtualization-pid-table | 7/7 | valid (SDM 3C Ch.32) | none | no† | no | `07-apic-virtualization.md` |
| interrupt-index-and-source-validation | **5/7** | valid (VT-d 5.20 §5.1.3) | none | no | no | `11-vtd-interrupt-remapping.md` |
| ooh-reported-results | 4/4 | valid (errata.md O6 + SC'22/arXiv) | none | no | no | `16-performance.md` (no routing row names OoH) → errata O6 |
| hyperv-owns-vmx-root | **4/5** | valid (SDM 3C Ch.26) | none | no | no | `17-windows-platform.md` §17.1 |
| enlightened-vmcs | 4/4 | valid (SDM 3C §27.6.15 + TLFS) | none | no† | no | `17-windows-platform.md` + `14-nested-virtualization.md` |
| vtl-isolation-slat | 6/6 | valid (SDM 3C §31.3) | none | no | no | `15-security.md` + `17-windows-platform.md` |
| tdx-tlb-tracking | 8/8 | valid (TDX-BASE §9.7) | none | no | no | `13-tdx.md` §13.8 |
| l1tf-mitigation-chain | 7/7 | valid (SDM 4 §2.1 Table 2-2) | none | no | no | `15-security.md` §15.5 |
| flexpriority-generation | 5/5 | valid (errata.md O1) | none | no | no | `01-vmx-intro.md` + `errata.md` |
| vmfunc-generation | 4/4 | valid (errata.md E06) | none | no | no | `01-vmx-intro.md` + `errata.md` (owner turned out to be 02/06) |
| tdx-aes-key-strength | 4/4 | valid (TDX-ISA Ch.2) | none | no | no | `13-tdx.md` + `errata.md` |

† These two answers contain a scoped "THE SKILL DOES NOT CONTAIN THIS" for facts that are **not** `must_include` items (IPIv: VMCS encodings of the PID-pointer-table address / last-PID-pointer-index and the full entry layout; eVMCS: field layout, version negotiation, clean-fields bitmap, CPUID advertisement). Every keyed item was still hit, so neither question is flagged `honest-gap`. The declarations are accurate and match the chapters' own open-items lists.

**Hedge questions.** `flexpriority-generation`, `vmfunc-generation`, `tdx-aes-key-strength` and `ooh-reported-results` all hedge. In each case the key's `must_include` *asks for* the hedge (both datings, both figure sets, "do not assert a single generation"), so all four score as ordinary hits. **No `key-disputed` flag is warranted anywhere in this subset** — the key and `errata.md` agree.

---

## Per-question — diagnosis (20)

Every diagnosis answer recorded `Needed quickref §0.2: no`. The key's `notes` say quickref §0.2 routes six of these symptoms; the answerer reached the right chapter from the SKILL.md routing table alone in all 20 cases.

| id | hit/total | cite | violations | honest-gap | key-disputed | routing as recorded by the answerer |
|---|---|---|---|---|---|---|
| vmlaunch-error-7 | 6/6 | valid (SDM 3C §27.9.5) | none | no | no | `08-vmx-instructions.md` §8.4 → `04-vm-entry.md` §4.9 |
| vmresume-error-5-after-migration | 5/5 | valid (SDM 3C §27.9.5) | none | no | no | `08-vmx-instructions.md` §8.4 |
| vmlaunch-cf-no-error | 4/4 | valid (SDM 3C Ch.33) | none | no | no | `08-vmx-instructions.md` §8.4 + `04-vm-entry.md` §4.9 |
| vmlaunch-error-8-64bit | 6/6 | valid (SDM 3C §27.5) | none | no | no | `08-vmx-instructions.md` §8.4 → `04-vm-entry.md` §4.4 |
| entry-failure-33-qualification-0 | **5/6** | valid (SDM 3C Ch.29) | none | no | no | `04-vm-entry.md` §4.9 |
| entry-failure-34-msr-load | 6/6 | valid (SDM 3C Ch.29) | none | no | no | `04-vm-entry.md` §4.9 |
| vmxon-general-protection | 6/6 | valid (SDM 3C Ch.26) | none | no | no | `01-vmx-intro.md` |
| lost-event-during-delivery | 5/5 | valid (SDM 3C §30.2.4) | none | no | no | `05-vm-exit.md` §5.4 |
| apicv-interrupts-lost-when-descheduled | 4/4 | valid (SDM 3C Ch.32) | none | no | no | `07-apic-virtualization.md` |
| msix-not-delivered-after-remapping | **4/6** | valid (VT-d 5.20 §5.1.5.2) | none | no | no | `11-vtd-interrupt-remapping.md` |
| device-dma-faulting | **4/6** | valid (VT-d 5.20 §7.2.1) | none | no | no | `12-vtd-faults-bios-siov.md` |
| seamcall-illegal-sequence | **5/7** | valid (TDX-BASE §7.2) | none | no | no | `13-tdx.md` §13.7 |
| vtx-unavailable-on-windows | 6/6 | valid (SDM 3C Ch.26) | none | no | no | `17-windows-platform.md` §17.1 |
| driver-rejected-after-memory-integrity | 6/6 | valid (SDM 3C §31.3.2 + MS Learn) | none | no | no | `15-security.md` §15.5 + `17-windows-platform.md` §17.6 |
| hypervisor-works-linux-not-windows11 | 6/6 | valid (SDM 3C Ch.26) | none | no | no | `17-windows-platform.md` §17.1 |
| vbs-overhead-figure | **6/7** | valid (SDM 3C §31.3.2 + Tom's Hardware) | **refuted, not asserted** | no | no | `16-performance.md` |
| modern-vmexit-cycles | 5/5 | valid (SDM 3C Ch.30 + ITJ 14.3) | none | no | no | `16-performance.md` |
| whp-vs-bare-vmx-figure | 4/4 | valid (MS WHP API ref + §16.5) | none | no | no | `16-performance.md` |
| wsl2-overhead-figure | 4/4 | valid (MS Learn "Comparing WSL versions") | none | no | no | `16-performance.md` |
| vtl-transition-cost | **2/3** | valid (MS TLFS-VSM + ITJ 14.3 + NOVA) | none (see note) | no | no | `16-performance.md` |

---

## `must_not_include` adjudication

Six questions in this subset carry trap strings. None was asserted.

1. **`default1-controls-and-true-msrs`** — banned: *"the first VMX processors only supported the 1-setting of bits 1, 2 and 4"*. **Refuted, not asserted.** Verbatim: *"The chapter also corrects an old claim: 'the first VMX processors supported only the 1-setting of bits 1, 2 and 4' is a description of the pin-based default-1 class, not a property of early silicon that later silicon removed."* The answer quotes the misconception in order to overturn it; RUNNER.md's correction-wins rule applies.
2. **`ooh-reported-results`** — banned: *"EPML speeds up checkpointing by about 14x"*. Not present. The answer keeps the two figure sets apart and writes **14 %** (arXiv) versus **13×** (SC'22), which is exactly the distinction the trap exists to protect.
3. **`vtx-unavailable-on-windows`** — banned: *"re-enable Intel VT-x in the BIOS"*. Not present. Verbatim: *"Nothing is wrong with your firmware or your CPU."*
4. **`vbs-overhead-figure`** — banned: *"expect around 10% on average"*. **Refuted, not asserted.** Verbatim: *"Do not let anyone average these into 'around 10%': that produces a number nobody measured."*
5. **`modern-vmexit-cycles`** — banned: *"roughly 500 cycles on a modern core"*. Not present; the answer gives no modern cycle figure at all.
6. **`vtl-transition-cost`** — banned: *"about 1000 cycles"*. **Not a violation, but recorded as the closest call in the subset.** The answer refuses a VTL number outright (*"This knowledge base records no measurement of a VTL transition in cycles… I am not going to supply one."*) and then quotes NOVA's 2010 decomposition: *"~3900 cycles average end-to-end exit handling, of which 1016 cycles (26%) was the guest/host transition itself."* That 1016 is labelled as a 2010 guest/host VM transition, a different quantity, and the answer explicitly says *"That gives you a floor by analogy, not a measurement."* A careless reader could still round it into the banned claim; a maintainer may want the chapter to state the anti-conflation rule at the point the figure appears.

**Refuted count: 2. Asserted violations: 0.**

---

## Every missed item, with the closest verbatim sentence from the answer

### mechanism

**`ept-violation-vs-misconfiguration` (8/9)**
- *Missed item:* "for a violation, qualification bits 3, 4 and 5 all clear means the guest-physical address is not mapped at all by EPT, while some of them set means a permission failure on a mapped page"
- *Closest verbatim:* "**Use qualification bits 3, 4 and 5 to tell whether the guest-physical address was mapped at all** — they report the EPT permissions present for the access, which separates a demand-paging miss from a permission denial."
- *Why arguable, scored a miss:* the bits and their diagnostic purpose are named, and the answer separately defines bit 3/4/5 as the AND of the EPT entries' R/W/X bits — so the polarity is *derivable*. But the operative rule ("all three clear ⇒ unmapped") is never stated, and a reader following the answer still has to do the derivation. Locatability/phrasing issue in `06-address-translation.md` §6.4.4, not an absent fact.

**`interrupt-index-and-source-validation` (5/7)**
- *Missed item:* "an index at or beyond the configured table size is an error (fault reason 21h)"
- *Closest verbatim:* "If the computed interrupt_index is **equal to or larger than the number of IRTEs** in the remapping table, hardware treats the interrupt request as an error." followed by "When an entry lookup or validation fails, the resulting fault reasons occupy a distinct numeric range, 20h–2Bh, enumerated in the chapter's §11.10."
- *Missed item:* "a source-id verification failure blocks the request and is reported as fault reason 26h"
- *Closest verbatim:* "source-id checking per SVT, SID and SQ follows the presence check, and failure blocks the request."
- *Diagnosis:* **locatability, not a content gap.** Both conditions are stated correctly; only the fault codes are replaced by a pointer to §11.10. The same answerer's `msix-not-delivered-after-remapping` answer lists 20h / 21h / 22h / 24h / 25h / 26h / 2Ah / 2Bh correctly, so chapter 11 clearly holds them — §11.3/§11.4.1 should carry the code inline where the failure is described rather than deferring to §11.10.

**`hyperv-owns-vmx-root` (4/5)**
- *Missed item:* "turning the hypervisor off disables every Hyper-V-backed Windows feature at once, including the security ones"
- *Closest verbatim:* "- **require that the hypervisor be turned off.**" (the third option is listed with no consequence attached; the paragraphs that follow move on to nesting cost and CPUID detection)
- *Diagnosis:* **locatability.** `vtx-unavailable-on-windows` in the diagnosis set states it plainly ("loses every Hyper-V-backed Windows feature at once, including the security ones"), so §17.1/§17.3.6 has the fact; it did not surface on the mechanism framing of the same question.

### diagnosis

**`entry-failure-33-qualification-0` (5/6)**
- *Missed item:* "qualifications 2, 3 and 4 would instead mean PDPTE loading, NMI injection blocked by STI, and an invalid VMCS-link pointer"
- *Closest verbatim:* "For reason 33 the qualification is 0 unless the failure was one of the specific enumerated cases — PDPTE loading, NMI injection blocked by STI (qualification 3), or an invalid VMCS-link pointer."
- *Why arguable, scored a miss:* all three causes are named and one value (3) is bound to its cause, but 2 and 4 are never assigned, so a reader holding qualification 2 or 4 cannot decode it. Chapter 04 §4.9 appears to carry the list without the full numbering.

**`msix-not-delivered-after-remapping` (4/6)**
- *Missed item:* "nothing in IRTA_REG takes effect until GCMD_REG.SIRTP (bit 24) is set and GSTS_REG.IRTPS (bit 24) reports it serviced"
- *Closest verbatim:* "**Nothing written to IRTA_REG takes effect until the Set Interrupt Remap Table Pointer (SIRTP) command**, and modifying EIME while IRES = 1 is explicitly forbidden."
- *Why a miss:* the SIRTP dependency is present; the register/bit pair (GCMD_REG bit 24) and the **wait for GSTS_REG.IRTPS** handshake are absent.
- *Missed item:* "the enable order is: program IRTA_REG, set SIRTP and wait for IRTPS, invalidate the interrupt entry cache with a global iec_inv_dsc, then set GCMD_REG.IRE (bit 25) and wait for GSTS_REG.IRES"
- *Closest verbatim:* the same SIRTP sentence — the answer contains no ordered enable sequence anywhere, and the words `iec_inv_dsc`, `IRE` and `IRES` (other than "modifying EIME while IRES = 1") never appear.
- *Diagnosis:* **content or locatability gap in `11-vtd-interrupt-remapping.md` §11.8** — the key says §11.8 owns the enable order. This is the single largest gap in the diagnosis subset and it is the step a reader actually has to execute.

**`device-dma-faulting` (4/6)**
- *Missed item:* "read the Fault Recording Registers directly: they are at base + 16 * CAP_REG.FRO, the count is CAP_REG.NFR + 1, and FSTS_REG.FRI gives the index to start from"
- *Closest verbatim:* "The number of Fault Recording Registers is reported by **CAP_REG.NFR** and their base offset by **CAP_REG.FRO** — you cannot walk the ring without both."
- *Why a miss:* the FRO arithmetic and the FRI start index are both given correctly elsewhere in the answer, but **`NFR + 1` is not** — the answer says NFR *is* the number, dropping the minus-one encoding. That is not merely an omission; a reader who believes it will under-walk the ring by one register.
- *Missed item:* "if the device is covered by an RMRR, the second-stage structures must provide an identity mapping with read and write permissions for that reserved region or its legacy DMA fails"
- *Closest verbatim:* none — "RMRR" does not appear in the answer. Nearest topical sentence: "**An ATS-capable device can be blocked with nothing in your fault log, by design.**"
- *Diagnosis:* **routing/content gap.** The key places this in `12-vtd-faults-bios-siov.md` §12.8.1; the answerer read §12.1/§12.2/§12.9 and never reached the RMRR material. For a "device DMA blocked after enabling remapping" question, a missing RMRR identity mapping is one of the two or three most likely real causes, so this is a substantive omission.

**`seamcall-illegal-sequence` (5/7)**
- *Missed item:* "at module scope, until the module reaches SYS_READY only the TDH.SYS.* bring-up leaves are accepted"
- *Closest verbatim:* "TDX enforces two nested state machines and most `TDH.*` leaves are transitions on them, so 'the ABI says this leaf exists' and 'this leaf is legal right now' are different questions." — the *module*-scope machine and `SYS_READY` are never mentioned; the answer covers only the TD-scope life cycle and OP_STATE.
- *Missed item:* "a SEAMCALL can also fail before reaching a leaf at all, with #UD, #GP(0) or VMfailInvalid signalled by RFLAGS.CF = 1, in which case RAX is unmodified"
- *Closest verbatim:* "Completion status is returned in **RAX** at three levels of detail: 0 means success; a positive value … means success with an informational or warning code; a negative value … means the function aborted with an error."
- *Diagnosis:* **content gap for the question as asked.** The question is "I get an error back from a SEAMCALL" — the pre-leaf failure path (CF = 1 with RAX unmodified) is exactly the case where the caller's RAX-decoding logic reads garbage, and it is missing. §13.7/§13.19 should state it next to the RAX decode.

**`vbs-overhead-figure` (6/7)**
- *Missed item:* "the '5-10%' and '5-25%' figures have no traceable primary source here"
- *Closest verbatim:* "A community figure of '5–10%' system-wide also circulates with no traceable primary source."
- *Why a miss:* asserted for the 5–10% figure only. For the upper range the answer goes the other way and supplies a source — "'up to 10%', elsewhere 'as much as 15%' … T3 media benchmark (Tom's Hardware)" and "the reported losses run from roughly 5% to as much as 15–25%". The answer's untraceability claim is therefore narrower than the key's. Substantively this is a *better*-sourced answer than the key expects, but the keyed fact ("no traceable primary source") is not asserted for the second figure, so it scores a miss. Worth a maintainer decision: either the chapter has acquired a source for the range, in which case the key should be updated, or the answer is over-attributing.

**`vtl-transition-cost` (2/3)**
- *Missed item:* "the same absence applies to hypercall cost, VMBus round-trip latency and the Windows Hypervisor Platform exit path"
- *Closest verbatim:* "And there is no public cycle-level VM-exit measurement for any recent client part recorded here either, so there is nothing modern to anchor the analogy to."
- *Why a miss:* the answer generalises the absence in the wrong direction (to modern VM-exit figures) and never names hypercall cost, VMBus round-trip latency or the WHP exit path. `16-performance.md` §16.10.1 owns that list of adjacent absences and it did not surface.

---

## Notes for the maintainer

1. **The two subsets fail differently.** Mechanism loses 4 items, three of which are *locatability* — the corpus demonstrably holds the fact (the sibling diagnosis answers prove it) but the owning section did not surface it. Diagnosis loses 9 items, and at least 5 of those look like genuine content or routing gaps (`msix` enable order, RMRR, TDX module scope, TDX pre-leaf failure path, adjacent-absence list).
2. **The fault-code pattern is worth one fix, not six.** VT-d fault reasons 21h/22h/26h are stated inline in chapter 11's diagnosis-shaped material but deferred to §11.10 in its mechanism-shaped material. Promoting the code to the sentence that describes each failure would recover two items at zero content cost.
3. **One factual defect, not just an omission:** the `device-dma-faulting` answer says the number of Fault Recording Registers "is reported by CAP_REG.NFR". Per VT-d the count is NFR **+ 1**. This is the only place in 44 answers where the scored text contradicts the key rather than falling short of it, and it is the kind of off-by-one that produces a silently truncated fault-log walk. It deserves a lint rule.
4. **No `honest-gap` questions.** Two mechanism answers declare scoped gaps (IPIv encodings, eVMCS layout) for facts outside the key. Both declarations match the chapters' own open-items sections, so the skill's self-knowledge is accurate here.
5. **No `key-disputed` findings.** All four errata-hedged questions in this subset have keys that ask for the hedge; the key and `errata.md` are consistent.
6. **Contamination disclosure, recorded but not penalised.** `eval/answers/mechanism.md` ends with a disclosure that the answerer incidentally saw the `must_include` and `required_citation` fields of two **lookup** questions (`vmcs-encoding-derive`, `tertiary-controls-encoding-and-msr`) while building an extraction filter. Neither is in this subset, so neither scored question is affected. The disclosure is unprompted and specific, which is the behaviour the protocol wants; it does bear on the separately-scored `lookup` subset.
