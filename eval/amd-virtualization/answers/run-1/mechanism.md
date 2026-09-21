# amd-virtualization eval — mechanism (24 questions)

Answered from the `amd-virtualization` skill only. Entry point: `amd-virtualization/SKILL.md`,
routed per its §Routing table; `errata.md` read before writing, per SKILL.md step 3.

---

### clean-bits-mechanism
**Routed to:** `02-vmcb.md` §2.5 "Clean bits and VMCB state caching" and §2.6 "Clean bits versus nested paging and ASID" — correct route (SKILL.md §Routing row "VMCB field offsets … clean bits → `02-vmcb.md`")

**Answer:**
*The mechanism.* VMCB state caching lets the processor keep guest register values in **hardware** between a `#VMEXIT` and the next VMRUN and reload them from that cache instead of from the VMCB in memory. The VMCB Clean field at control offset `0C0h` is how the hypervisor tells the processor which parts of the VMCB it has **not** touched. Support is enumerated by `CPUID Fn8000_000A_EDX[VmcbClean] = 1` (enumeration owned by `01-svm-intro.md`) `[APM2 §15.15]` `[1]`.

*The asymmetry that defines the contract.* Each **set** bit permits the processor to load that register or register group from the hardware cache; each **clear** bit requires it to load from the VMCB. Set bits are only a **hint** — any implementation may ignore a set bit and load from memory anyway — but **clean bits set to zero are always honored** `[APM2 §15.15.1]` `[1]`. So the safe direction is always "clear more".

*Cache identity.* SVM uses the **physical address of the VMCB** as the unique identifier of a guest virtual CPU for caching purposes; **the ASID is explicitly not a unique identifier** for that purpose `[APM2 §15.15]` `[1]`. The CPU compares the VMCB physical address against all cached VMCB physical addresses and, if none matches, automatically treats the whole Clean field as zero `[APM2 §15.15.2]` `[1]`.

*The bit map* (`[APM2 Figure 15-4]` `[1]`): 0 `I` (all intercept vectors, TSC offset, Pause Filter Count) · 1 `IOPM` (`IOPM_BASE`, `MSRPM_BASE`) · 2 `ASID` · 3 `TPR` (the offset 60h–67h group: `V_TPR`, `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR`, `V_INTR_MASKING`, `V_INTR_VECTOR`) · 4 `NP` (`NCR3`, `G_PAT`) · 5 `CRx` (CR0, CR3, CR4, EFER) · 6 `DRx` (DR6, DR7) · 7 `DT` (GDT/IDT limit and base) · 8 `SEG` (CS/DS/SS/ES selector, base, limit, attributes, plus CPL) · 9 `CR2` · 10 `LBR` · 11 `AVIC` · 12 `CET` · 31:13 reserved. Three asymmetries matter: `SEG` covers **CS, DS, SS, ES only** (FS/GS/LDTR/TR are moved by VMLOAD/VMSAVE and are in no clean group); `DT` covers GDT/IDT limit and base but not LDTR/TR descriptors; `CR2` has its own bit while `EFER` rides in `CRx`.

*When you must zero — the ordering rule.* Per-field: the hypervisor must clear the specific bit **every time it explicitly modifies the associated guest state in the VMCB**; changes caused by *guest execution* are the processor's problem and the hypervisor does not track them `[APM2 §15.15.2]` `[1]`. Whole-field: the hypervisor must clear the **entire** Clean field to zero in exactly three circumstances — (1) the **first time** a particular guest is run, (2) when it runs the guest on a **different CPU core** than last time, (3) when it has **moved the guest's VMCB to a different physical page**. Failure may result in undefined behaviour `[APM2 §15.15.2]` `[1]`.

*Forward-compatibility shortcut and its limit.* A hypervisor that has not modified the VMCB may write `FFFF_FFFFh`; it should write `0h` when the VMCB is new or potentially inconsistent with the CPU's cached copy — e.g. a VMCB page taken from a free list without tracking whether it was recently another guest's VMCB `[APM2 §15.15.3]` `[1]`. If any field other than the explicitly-uncached ones was modified, **all clean bits undefined within the hypervisor's scope must be cleared** — `FFFF_FFFFh` on a modified VMCB is not a legal shortcut `[APM2 §15.15.3]` `[1]`. **Bit 31 is reserved for the host and the CPU will never use it as a clean bit**, so software may use it for its own tracking `[APM2 §15.15.3]` `[1]`.

*Fields with no clean bit at all* (so no maintenance is possible or needed): `TLB_Control`; the interrupt shadow; the status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, Decode Assist); event injection; and `RFLAGS`, `RIP`, `RSP`, `RAX` `[APM2 §15.15.3]` `[1]`. Consequence: the common fast path — read `EXITCODE`, rewrite `EVENTINJ`, re-enter — needs **no** clean-bit maintenance at all `[APM2 §15.15.3]` `[1]`.

*Two traps.* (a) On models supporting clean fields the **final merged hardware state** is used for VMRUN's consistency checks, and may include state from fields marked clean if the processor chose to ignore the indication — so a stale clean bit can surface as `VMEXIT_INVALID` rather than as wrong guest behaviour `[APM2 §15.5.1]` `[1]`. (b) Clean bit 4 (`NP`) covers only the **fields** `NCR3` and `G_PAT` and says nothing about the **contents** of the nested page tables; changing those needs a TLB command (011b or 001b when re-entering the same ASID), which no clean-bit change can express `[APM2 Figure 15-4]` `[APM2 §15.16.1]` `[1]`. Also: SMM software or any other agent outside the hypervisor that changes VMCB contents must comprehend the clean bits and adjust them, or the guest may not operate as intended `[APM2 §15.15.2]` `[1]`.

*Decision table as the chapter states it:* `NCR3`/`G_PAT` value changed → clear bit 4. Nested page-table **contents** changed → TLB flush command, clean bits irrelevant. ASID field changed → clear bit 2. Guest moved to another core → clear the whole field. VMCB moved to another physical page → clear the whole field.

**Confidence:** high — every claim used is tagged `C:high` `V:durable` in the skill.

---

### intercept-priority-ordering
**Routed to:** `03-intercepts.md` §3.2 "Intercept ordering and priority" — correct route (SKILL.md §Routing row "Intercept vectors and bit numbers … → `03-intercepts.md`"; the chapter's `Owns:` line names "intercept priority/ordering")

**Answer:**
**There is no single rule** — and that is the answer the chapter leads with. AMD states ordering in **two** places: a general rule in §15.7, and a **per-instruction `Priority` column in Table 15-7**, which is the authoritative list and which several rows of *invert* relative to the general rule.

*The general rule* `[APM2 §15.7]` `[1]`:
- **Exception intercepts** are checked **when normal instruction processing must raise an exception** — before double-fault conditions are resolved and before delivery begins (before any exception frame is pushed and before the IDT is read).
- **Instruction intercepts** occur at well-defined points **before the instruction's results are committed**; generally **after** simple exceptions such as `#GP` on wrong CPL or `#UD`, but **before** memory-access exceptions such as page faults and before exceptions that depend on specific operand values. RSM is explicitly called out as an exception to this rule.
- **Debug events outrank intercepts**: instruction breakpoints for the current instruction, and pending data-breakpoint traps left over from the previous instruction, are designed to be checked **before** instruction intercepts — so a `#DB` can reach a guest that is about to be intercepted.
- When an external or virtual interrupt is intercepted, the interrupt is **left pending** rather than consumed.
- A **trap** intercept is taken *after* the triggering instruction completes, so the saved guest state includes that instruction's effects (after an intercepted data-breakpoint `#DB`, saved CS:rIP points at the following instruction and saved DR7 already reflects the match) `[APM2 §15.7.1]` `[1]`.

*Selected rows of Table 15-7* — the rows that actually decide real cases `[APM2 Table 15-7]` `[1]`:
| Instruction | Ordering vs exceptions |
|---|---|
| MOV to/from CRn, DRn | all normal exception checks take precedence over the intercept |
| MOV to/from CR0, LMSW, SMSW, CLTS | non-memory exceptions first; for LMSW and SMSW the intercept is checked **before** memory exceptions |
| MOV to CR3 | non-memory exceptions first, then the intercept; the intercept fires **before the TLB is flushed**, and a PAE PDPE `#GP` is checked **after** it |
| LIDT/SIDT/LGDT/SGDT/LLDT/SLDT/LTR/STR | intercept after `#UD` and `#GP`, but before any memory access |
| RDTSC, RDPMC | all exceptions before the intercept |
| PUSHF, POPF, CPUID, RSM, IRET | **intercept takes priority over any exceptions** |
| INTn | **intercept occurs before any exceptions are checked**; reported CS:rIP is that of the INTn |
| INVD | `#GP` before the intercept |
| PAUSE | no exceptions to check |
| HLT, RDTSCP, MONITOR/MONITORX, MWAIT/MWAITX, RDPRU | **all** exceptions before the intercept |
| INVLPG, INVLPGA | all exceptions (`#GP`) before the intercept |
| VMRUN, VMLOAD, VMSAVE, STGI, CLGI, SKINIT, WBINVD/WBNOINVD, TLBSYNC | `#GP` before the intercept |
| VMMCALL | **intercept takes priority over exceptions** |
| XSETBV | **intercept before exceptions (`#GP`)** |
| INVLPGB, INVLPGB_ILLEGAL, INVPCID | intercept takes priority over all exceptions **except** `#GP` for CPL ≠ 0 |
| ICEBP | no ordering rule given — only that the vector-1 event it dispatches is not interceptable via the `#DB` exception intercept |

So the answer to "which one wins": **it depends on the instruction**. INTn, XSETBV, VMMCALL, the PUSHF/POPF/CPUID/RSM/IRET group and the INVLPGB/INVPCID group all place the intercept ahead of some or all exception checks `[APM2 Table 15-7]` `[1]`.

*Ordering sub-rules worth carrying:*
- Selective vs non-selective CR0 write: the selective intercept triggers only when a bit other than CR0.TS/MP changes, so **CLTS never checks it**; with both set the **non-selective** one takes priority; **LMSW treats the selective intercept as non-selective** `[APM2 Table 15-7]` `[1]`.
- CR3 reads/writes performed **by VMRUN, `#VMEXIT` and task switches are not subject to the CR3 intercept** `[APM2 Table 15-7]` `[1]`.
- The **conditional** MWAIT intercept (vector 4 bit 12) is checked **before** the unconditional one (bit 11); same for MWAITX `[APM2 Table 15-7]` `[1]`.
- The task-switch intercept is checked **after** the incoming TSS and task gate are checked for correctness but **before** the switch happens, and stands in for the CR3-write, EFLAGS and LDTR intercepts `[APM2 §15.14.1]` `[1]`.
- The `#PF` intercept is tested **before CR2 is written**, so an intercepted page fault leaves guest CR2 unmodified `[APM2 §15.12.15]` `[1]`.
- The `#MC` intercept is checked **after** all machine-check registers are written but before other guest state changes `[APM2 §15.12.18]` `[1]`.
- **MCOMMIT** has an intercept bit (vector 5 bit 3) but **no row in Table 15-7**, so its ordering vs exceptions is **undocumented** `[APM2 Table 15-7]` `[APM2 Table B-1]` `[1]`.

*Intercepts raised during the guest's own IDT delivery* `[APM2 §15.7.3]` `[APM2 §15.12]` `[1]`: when the guest raises event E the processor **checks E's own exception intercept first**; only if E is not intercepted is it combined with any prior pending event. Worked consequence: with `#GP` and `#DF` both intercepted, a non-intercepted `#NP` whose delivery raises `#GP` exits as an intercepted **`#GP`**, not as `#DF`. Once an exception is **successfully** taken in the guest, the in-delivery valid flag is cleared and no `#VMEXIT` occurs.

*Registers written even though the processor intercepts* `[APM2 §15.12]` `[1]`: `#DB` yes (DR6, DR7), `#PF` **no** (intercept before CR2), `#MF` yes (x87 status word), `#XF` yes (MXCSR), `#MC` yes; for `#DF` the contributing exceptions already wrote what they normally write. For every other exception the manual states no special registers are written before the intercept.

**Confidence:** high — all `C:high` `V:durable`. The one explicit gap (MCOMMIT's ordering) is reported as a gap, not guessed.

---

### tsc-offset-and-ratio-composition
**Routed to:** `03-intercepts.md` §3.6 "TSC offset, TSC ratio and their composition" — correct route (SKILL.md §Routing row names "TSC ratio" under `03-intercepts.md`; the chapter `Owns:` "TSC ratio and TSC composition")

**Answer:**
**Order: the ratio is applied first, and the offset is added afterwards, unscaled.** The chapter states the composition verbatim:

`TSC(guest) = (P0 frequency × TSCRatio × t) + VMCB.TSC_OFFSET + (last value written to TSC) × TSCRatio`

where *t* is the time since the TSC was last written (or since reset), and `TSCFreq = Core P0 frequency × TSCRatio` `[APM2 §15.30.5]` `[1]`. Note that the *last written TSC value* is **also** scaled by the ratio, while `TSC_OFFSET` is **not**.

- **Claim carried:** "The order therefore matters and is fixed: the ratio is applied first and the offset is added afterwards, unscaled — **a hypervisor that computes an offset under one ratio and then changes the ratio will see the guest's clock jump**" `[APM2 §15.30.5]` `[1]`.

*The two knobs.*
- **`TSC_OFFSET`** is a 64-bit VMCB control field that is **added** in RDTSC and RDTSCP; its byte offset is catalogued in `02-vmcb.md` `[APM2 Table B-1]` `[1]`.
- **TSC Ratio MSR `C000_0104h`**, supported when `CPUID Fn8000_000A_EDX[4]` (`TscRateMsr`) = 1, holds a fixed-point number in **8.32 format**: **INT in bits 39:32**, **FRAC in bits 31:0**, **bits 63:40 MBZ**, reset value **1.0** `[APM2 §15.30.5]` `[APM2 Figure 15-29]` `[1]`.

*What exactly the ratio affects.* It scales the value a guest sees from **RDTSC, RDTSCP, and RDMSR of the TSC, MPERF and MPerfReadOnly MSRs**. It has **no effect in host mode or when virtualization is disabled**, and SMM code sees unscaled values unless SMM is itself executed inside a guest container `[APM2 §15.30.5]` `[1]`. It is a **read-side transform only**: it changes neither the rate of the underlying counters nor the value written to the TSC, MPERF or MPerfReadOnly MSRs by a host or guest write `[APM2 §15.30.5]` `[1]`.

*What the offset affects.* `TSC_OFFSET` is added in **RDTSC and RDTSCP** `[APM2 Table B-1]` `[1]`.

*Interaction with intercepts and exceptions.* The relevant intercepts are **RDTSC at vector 3 bit 14, RDPMC at vector 3 bit 15, RDTSCP at vector 4 bit 7**, and all three check **every exception before the intercept** — so a guest at CPL > 0 with `CR4.TSD` set takes `#GP` and never reaches the hypervisor `[APM2 Table B-1]` `[APM2 Table 15-7]` `[APM2 §13.2.4]` `[1]`.

*Clean-bit interaction (cross-referenced, owned by `02-vmcb.md`):* `TSC_OFFSET` is covered by clean bit 0 (`I`), together with the intercept vectors and Pause Filter Count `[APM2 Figure 15-4]` `[1]` — so changing the offset requires clearing clean bit 0.

**Confidence:** high — all `C:high` `V:durable`.

---

### vmrun-ordering
**Routed to:** `04-world-switch.md` §4.1 "VMRUN: what the hardware does" — correct route (SKILL.md §Routing row "VMRUN, `#VMEXIT`, consistency checks … → `04-world-switch.md`")

**Answer:**
The chapter's framing first: read VMRUN as **a single host instruction that takes an arbitrarily long time** — from the host's point of view an arbitrary number of guest instructions execute "inside" the VMRUN, and the `#VMEXIT` completes it.

**Operand / preconditions.** VMRUN has an implicit `[rAX]` addressing mode: software loads rAX with the physical address of the **4-Kbyte-aligned** VMCB page, and the portion of RAX used is determined by the current effective address size `[APM2 §15.5.1]` `[1]`. The VMCB is accessed **by physical address** and should be mapped **writeback (WB)** `[APM2 §15.5.1]` `[1]`. VMRUN is CPL 0 only (`#GP(0)` otherwise), requires protected mode and `EFER.SVME = 1` (`#UD` otherwise) `[APM2 §15.5.1]` `[1]`. Vol.3 adds two further `#GP` conditions the Vol.2 prose omits: rAX referencing a physical address **above the maximum supported physical address**, and rAX **not 4-Kbyte aligned** `[APM3 §4 "VMRUN"]` `[2]`. VMRUN is **not supported inside the SMM handler** and the resulting behaviour is **undefined** — stated as undefined behaviour, not as a fault `[APM2 §15.5]` `[1]`.

**Step 1 — save host state.** VMRUN saves host state into the 4-Kbyte block whose physical address is in `VM_HSAVE_PA` (`C001_0117h`), which the VMM must have programmed; writing that MSR faults `#GP` if any low 12 bits are non-zero or the address is at/above the maximum supported physical address `[APM2 §15.30.4]` `[1]`. The manual says "**at least** the following" and enumerates **fourteen items**: CS.SEL and NEXT_RIP · RFLAGS and RAX · SS.SEL and RSP · CR0, CR3, CR4, EFER · IDTR and GDTR · ES.SEL and DS.SEL — **not three** `[APM2 §15.5.1]` `[1]`. Two omissions are explicit: **host LDTR is not saved/restored**, and Vol.3's pseudo-code annotates "**host CR2 is not saved**" `[APM2 §15.5.1]` `[APM3 §4 "VMRUN"]` `[1][2]`. `NEXT_RIP` here means the rIP of the instruction *following* VMRUN — where the host resumes on `#VMEXIT` `[APM2 §15.5.1]` `[1]`. The save area is **architecturally opaque**: implementations may store part or none of it there and keep the rest in hidden on-chip storage, so software must not rely on its format or contents nor try to change host state by editing it `[APM2 §15.5.1]` `[1]`.

**Step 2 — load guest state.** VMRUN loads from the VMCB state-save area: CS and rIP (including hidden CS state), RFLAGS and RAX, SS and RSP (including hidden SS state), CR0/CR2/CR3/CR4/EFER, `INTERRUPT_SHADOW`, IDTR and GDTR, ES and DS (including hidden state), DR6 and DR7, `V_TPR`, `V_IRQ`, and CPL `[APM2 §15.5.1]` `[1]`. **CPL is not always taken from the VMCB**: forced to 0 in real mode, to 3 in virtual-8086 mode, and only otherwise taken from the saved CPL field `[APM2 §15.5.1]` `[1]`. Writing the paging control registers **does not flush the TLB**, because address spaces are switched rather than reused `[APM2 §15.5.1]` `[1]`. If the guest is in PAE paging mode per the just-loaded registers **and nested paging is not enabled**, VMRUN also reads the four PDPEs pointed to by the newly loaded CR3, and reserved bits set there cause a `#VMEXIT` `[APM2 §15.5.1]` `[1]`. Vol.3's pseudo-code adds **`gPAT`** to the guest load set when `NP_ENABLE = 1`, noting that loading it leaves host `hPAT` unchanged `[APM3 §4 "VMRUN"]` `[2]`.

**Step 3 — control information, TLB command, GIF.** VMRUN also reads control fields that are mostly *not* written back on `#VMEXIT` because they cannot change during guest execution: `TSC_OFFSET`, the virtual-interrupt description fields, `V_INTR_MASKING`, the ASID, the TLB-flush control and the intercept vectors `[APM2 §15.5.1]` `[1]`.

**The explicit ordering.** Vol.3's pseudo-code fixes the sequence: **(1) guest-state consistency checks run first, (2) then the command stored in `TLB_CONTROL` is executed, (3) then `GIF` is set to 1, and (4) only then is the injected event delivered or the first guest instruction fetched** `[APM3 §4 "VMRUN"]` `[2]`. Setting `GIF` to 1 is part of VMRUN, and the architecture assumes VMM software **cleared `GIF` some time before** executing VMRUN so that the state switch is atomic `[APM2 §15.5.1]` `[1]`. (What the TLB command does is owned by `06-nested-paging.md`; an injected event comes from `EVENTINJ`, owned by `05-exit-decoding.md`, and is delivered **unconditionally, before the first guest instruction**.)

**On exit from guest mode** the internal intercept registers are cleared, so no host operation is intercepted `[APM2 §15.5.1]` `[1]`.

**EFLAGS.TF / RF around the boundary.** Host side: VMRUN behaves like an ordinary instruction — RF suppresses an instruction-breakpoint match on the VMRUN itself, TF causes a `#DB` trap **after** the VMRUN completes (i.e. after the `#VMEXIT`), and completing VMRUN clears host EFLAGS.RF `[APM2 §15.5.1]` `[1]`. Guest side: a loaded EFLAGS.RF of 1 suppresses an instruction breakpoint on the **first** guest instruction, and a loaded EFLAGS.TF of 1 produces the trace trap **after that first guest instruction completes**, not between VMRUN and it `[APM2 §15.5.1]` `[1]`. Host EFLAGS have no effect on the guest and vice versa `[APM2 §15.5.1]` `[1]`.

**Confidence:** high — all `C:high` `V:durable`.

---

### vmrun-consistency-checks
**Routed to:** `04-world-switch.md` §4.2 "Consistency checks, and what is legal despite looking illegal" — correct route (SKILL.md §Routing row names "consistency checks"; `00-quickref.md` §0.2 also routes "`VMEXIT_INVALID` (−1)" here). Cross-checked against `errata.md` **E05**, which is the entry for exactly this question.

**Answer:**
**How VMRUN decides.** VMRUN performs consistency checks on **guest** state and `#VMEXIT` performs the appropriate **subset of the same checks on host state**; an illegal guest-state combination produces a `#VMEXIT` with error code `VMEXIT_INVALID` — **exit code −1** `[APM2 §15.5]` `[1]`. The enumerated list in §15.5 is the authority.

**The twenty enumerated illegal state combinations** (`[APM2 §15.5]` `[1]`, Rev 3.45):
1. `EFER.SVME` is zero
2. `CR0.CD` is zero and `CR0.NW` is set
3. `CR0[63:32]` are not zero
4. Any MBZ bit of **CR3** is set
5. Any MBZ bit of **CR4** is set
6. `DR6[63:32]` are not zero
7. `DR7[63:32]` are not zero
8. Any MBZ bit of **EFER** is set
9. `EFER.LMA` or `EFER.LME` non-zero and the processor does not support long mode
10. `EFER.LME` and `CR0.PG` both set and `CR4.PAE` is zero
11. `EFER.LME` and `CR0.PG` both non-zero and `CR0.PE` is zero
12. `EFER.LME`, `CR0.PG`, `CR4.PAE`, `CS.L` and `CS.D` all non-zero
13. The **VMRUN intercept bit is clear**
14. The MSR or IOIO intercept table extends to a physical address at or above the maximum supported physical address
15. Illegal event injection
16. **ASID is equal to zero**
17. Any reserved bit set in `S_CET`
18. `CR4.CET = 1` when `CR0.WP = 0`
19. `CR4.CET = 1` and `U_CET.SS = 1` when `EFLAGS.VM = 1`
20. Any reserved bit set in `U_CET` (SEV-ES only)

Condition 20 is **asymmetric**: VMRUN produces `#VMEXIT(INVALID)` while `#VMEXIT` instead **forces the reserved `U_CET` bits to zero** `[APM2 §15.5]` `[1]`.

**How to express the CR4 and EFER checks in your own validator — this is the heart of the question.** Write them as **MBZ rules, not fixed masks**. The current manual states conditions 5 and 8 as "**any MBZ bit of CR4 is set**" and "**any MBZ bit of EFER is set**". The fixed-mask forms `CR4[63:11] != 0` and `EFER[63:15] != 0` come from the **2005-era SVM manual**, are superseded, and appear nowhere in Rev 3.45 — **CR4 bits 11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are architecturally defined today**, so a validator using the fixed masks would **reject legal guest state** `[APM2 §15.5]` `[1]`. `errata.md` **E05** records the same correction (its wording gives the CR4 range as 20–24; the chapter gives 20–23 — take the chapter's, and in either case implement it as "consult the current MBZ definition", not as a literal constant).

Conditions 10, 11 and 12 are **architectural checks published in AMD's own list**, not hypervisor hardening added later `[APM2 §15.5]` `[1]`. Condition 13 means a VMM **cannot decline to intercept VMRUN** — which is what makes nested SVM interceptable at all `[APM2 §15.5]` `[1]`.

**Canonicalization** (separate from the checks): VMRUN and `#VMEXIT` **canonicalize — sign-extend to bit 63 —** every loaded segment-register base address, `SSP`, `ISST_ADDR` and `PL0_SSP` through `PL3_SSP` `[APM2 §15.5]` `[1]`. Your validator should not reject a non-canonical base; hardware fixes it.

**The negative list — legal states that look illegal** (the half that produces real bugs):
- A guest **rIP outside the code-segment limit, or non-canonical in long mode, is not a consistency failure**: VMRUN loads it and a `#GP` is delivered **inside the guest** `[APM2 §15.5.1]` `[1]`.
- **`CR0.PE = 0` with `CR0.PG = 1`** — paged real mode — is **explicitly legal** for VMRUN to load, and RSM may return to it `[APM2 §15.5.1]` `[APM2 §15.19]` `[1]`. Its intended use is a guest at CPL 0 with `#PF` intercepted and a shadow page table supplying the mapping; paged real mode **without** intercepting page faults is undefined behaviour `[APM2 §15.19]` `[1]`.
- Checking strength is **not uniform**: `TLB_CONTROL` encodings other than `00h`, `01h`, `03h`, `07h` are reserved but **no consistency check covers them** — §15.5's list does not mention the field `[APM2 §15.5]` `[APM2 §15.16.1]` `[1]` (this claim is tagged **`C:medium`**).

**`VMEXIT_INVALID` conditions defined outside §15.5** — a validator that only implements the twenty will still see `−1` exits: an IOPM or MSRPM whose last byte reaches the maximum supported physical address; a guest ASID of zero; `NP_ENABLE = 1` with `hCR0.PG` cleared; x2AVIC mode enabled without AVIC Enable; and `AVIC_PHYSICAL_MAX_INDEX` above 255 in xAVIC mode or above 511 in x2AVIC mode when `Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) is 0 `[APM2 §15.10.1]` `[APM2 §15.11]` `[APM2 §15.25.1]` `[APM2 §15.25.3]` `[APM2 §15.29.4]` `[1]`. Others named elsewhere in the skill: `NP_ENABLE=1` with any MBZ bit of nCR3 set or a bad `G_PAT.PA` encoding `[APM2 §15.25.4]` `[1]`; `V_NMI_ENABLE` set without the NMI intercept `[APM2 §15.21.10]` `[1]`; SSS enabled with nested paging disabled `[APM2 §15.25.14]` `[1]`; illegal `EVENTINJ` (reserved `TYPE`, or `TYPE=3` with a non-exception vector including vector 2) `[APM2 §15.20]` `[1]`.

**Clean-field interaction:** on processors supporting clean-field designation, the **final merged hardware state** is used for the consistency checks, and may include state from fields marked clean if the processor chose to ignore the indication `[APM2 §15.5]` `[1]`.

**Confidence:** high — all `C:high` `V:durable`, except the `TLB_CONTROL`-not-checked claim, which the skill marks **`C:medium`**.

---

### gif-stgi-clgi-vgif
**Routed to:** `04-world-switch.md` §4.6 "The global interrupt flag: STGI and CLGI" — correct route (SKILL.md §Routing row "VMRUN, `#VMEXIT` … GIF, STGI/CLGI → `04-world-switch.md`").
**Second chapter genuinely needed:** `07-virtual-interrupts-avic.md` §7.3 "The virtual global interrupt flag". The routing table deliberately splits this one — `04` owns GIF and STGI/CLGI on the **instruction** side and says so ("Where the mechanism side lives"), while `07`'s `Owns:` line claims "vGIF on the mechanism side". The question asks both halves.

**Answer:**
**What GIF does to pending events.** GIF is a single bit that controls whether interrupts and other events can be taken by the processor; **STGI sets it, CLGI clears it** `[APM2 §15.17]` `[1]`. It is what makes the world switch atomic — the only thing standing between a half-loaded VMM and an NMI.

The effect is **three distinct behaviours, not one** `[APM2 Table 15-10]` `[1]`:

| Source | `GIF == 0` | `GIF == 1` |
|---|---|---|
| Debug exception/trap from a **breakpoint register match** | **Ignored and discarded** | normal |
| Debug trace trap due to `EFLAGS.TF` | normal | normal |
| RESET | normal | normal |
| **INIT** | **held pending** until GIF == 1 | normal |
| **NMI** | **held pending** | normal |
| **External SMI** | **held pending** | normal |
| **Internal SMI (I/O trapping)** | **ignored and discarded** | normal |
| **INTR and vINTR** | **held pending** | normal |
| `#SX` | n/a | normal |
| Machine check | held pending if the implementation can, **otherwise shutdown** | normal |
| A20M | normal | normal |
| Other non-architecturally-visible interrupts (STPCLK, IGNNE toggle, ECC scrub) | normal | normal |

So: *held pending* for INIT, NMI, external SMI and INTR/vINTR; *ignored and discarded* for breakpoint-register debug exceptions and internally generated SMI; *unaffected* for RESET, trace traps and A20M. Machine check is the one implementation-dependent row `[APM2 Table 15-10]` `[1]`. `#SX` is "n/a" for a structural reason, not an omission: `#SX` arises only from a **redirected INIT**, and redirection happens only when GIF == 1, since otherwise the INIT is simply held `[APM2 Table 15-10]` `[APM2 §15.28]` `[1]`.

**Where GIF moves in the world switch.** VMRUN **sets GIF to 1** as step 3 of its sequence, after the consistency checks and the TLB command and before event injection / the first guest instruction — and the architecture assumes the VMM cleared GIF some time before VMRUN so the switch is atomic `[APM2 §15.5.1]` `[APM3 §4 "VMRUN"]` `[1][2]`. `#VMEXIT` **first clears GIF**, before anything else, so the VMM can complete the state switch atomically `[APM2 §15.6]` `[1]`.

**Instruction-side conditions, and an asymmetry that is architectural.** CLGI raises `#GP` when CPL ≠ 0, is recognised only in protected mode, and raises `#UD` when `Fn8000_0001_ECX[SVM] = 0` **or** `EFER.SVME = 0` `[APM3 §4 "CLGI"]` `[2]`. **STGI's `#UD` condition is weaker**: it raises `#UD` when `EFER.SVME = 0` only if **both** SVM-Lock is unavailable (`Fn8000_000A_EDX[SVML] = 0`) **and** the device exclusion vector is unavailable (`Fn8000_0001_ECX[SKINIT] = 0`); STGI still requires CPL 0 and protected mode `[APM3 §4 "STGI"]` `[2]`. The reason is that STGI is part of the SKINIT/DRTM story as well as the SVM story — `Fn8000_0001_ECX[12]` is documented as "SKINIT and STGI are supported", explicitly independent of `MSRC000_0080[SVME]` `[APM3 App.E]` `[2]` (DRTM use is in `17-security.md`).

**What vGIF changes.** Virtual GIF is a **nested-virtualization** feature — §15.17 itself says implementations may provide hardware support for virtualizing the GIF in nested scenarios and sends the reader to §15.33 `[APM2 §15.17]` `[1]`.
- Enumerated by `CPUID Fn8000_000A_EDX[VGIF]` = **bit 16** `[APM2 §15.33.2]` `[1]`.
- Enabled by `VGIF_EN`, **bit 25 of the word at VMCB offset 60h**; the virtual flag `VGIF` itself is **bit 9** of the same field, **loaded on VMRUN and saved on `#VMEXIT`** `[APM2 §15.33.2]` `[1]`.
- **What it gates:** virtual interrupts are masked when `VGIF` is 0 and may be taken when `VGIF` is 1. **`VGIF` gates the *virtual* interrupt path; the real GIF gates the physical one** `[APM2 §15.33.2]` `[1]`. Concretely, a virtual INTR is taken only when all four hold: a pending virtual interrupt of priority strictly greater than `V_TPR`, `EFLAGS.IF` set, **virtual interrupts enabled with `VGIF`**, and not in an interrupt shadow `[APM2 §15.21.4]` `[1]`.
- **What it removes:** when vGIF is enabled and the STGI/CLGI intercepts are **clear**, the guest executes `STGI`/`CLGI` itself and they set/clear `VGIF` rather than exiting `[APM2 §15.33.2]` `[1]`. That matters because with GIF cleared INIT, NMI, external SMI, INTR and vINTR are all held pending, so a guest hypervisor brackets each of its own world switches with CLGI/STGI — without vGIF every one of those is an exit, and the **real GIF stays under the outer hypervisor's exclusive control** `[APM2 §15.17]` `[APM2 Table 15-10]` `[1]`.
- **The override:** setting the STGI or CLGI intercept bit intercepts those instructions **regardless of whether Virtual GIF is enabled** — vGIF never overrides an explicit intercept `[APM2 §15.33.2]` `[1]`.

**Confidence:** high — all `C:high` `V:durable`.

---

### event-injection-and-reinjection
**Routed to:** `05-exit-decoding.md` §5.5 "Event injection and re-injection" — correct route (SKILL.md §Routing row "Decoding an exit: … EVENTINJ → `05-exit-decoding.md`"; `00-quickref.md` §0.3 puts `EVENTINJ`/`EXITINTINFO` there too)

**Answer:**
The chapter's framing: `EVENTINJ` and `EXITINTINFO` **point in opposite directions but share one encoding** — which is exactly why re-injection is a copy.

**Injecting.** A VMM injects an exception or interrupt by setting bits in the VMCB `EVENTINJ` field **before executing VMRUN**; the guest then takes the event **unconditionally before executing its first instruction** `[APM2 §15.20]` `[1]`. Layout `[APM2 §15.20]` `[APM2 Figure 15-5]` `[1]`:

| Bits | Field | Meaning |
|---|---|---|
| 7:0 | `VECTOR` | 8-bit IDT vector; **ignored when `TYPE` is 2 (NMI)** |
| 10:8 | `TYPE` | event type |
| 11 | `EV` | Error Code Valid — set if the exception should push an error code |
| 30:12 | — | Reserved, SBZ |
| 31 | `V` | Valid — set if an event is to be injected |
| 63:32 | `ERRORCODE` | pushed when `EV` is 1; ignored otherwise |

`TYPE` has **four** defined values — **0** external or virtual interrupt (INTR), **2** NMI, **3** exception (fault or trap), **4** software interrupt (INTn). **Value 1 is not among them**; unlisted values are unused and reserved `[APM2 Table 15-11]` `[1]`.

**Six documented departures** from "treated as though it occurred normally" `[APM2 §15.20]` `[1]`:
1. Injected events are **not subject to intercept checks** — although **secondary exceptions raised during delivery of an injected event *are*** subject to exception intercepts.
2. An **injected NMI does not block delivery of further NMIs**.
3. Injecting an event impossible for the guest mode (AMD's example: `#BR` in 64-bit mode) makes the injection fail with **no guest instruction executed**, and VMRUN exits immediately with `VMEXIT_INVALID`.
4. `TYPE = 3` with vector 3 or 4 behaves like the trap raised by INT3 or INTO, so the processor **checks the DPL of the IDT descriptor** before dispatching.
5. Intercepted `#DB` faults resulting from a guest **ICEBP cannot be injected** (ICEBP does no DPL check whereas INTn injection does); the hypervisor must emulate ICEBP injection itself.
6. Two further `VMEXIT_INVALID` conditions: a **reserved `TYPE`**, and **`TYPE = 3` with a vector that is not an exception** — a category that **explicitly includes vector 2**, which is an NMI and not an exception.

Two more rules that bite: the `EVENTINJ` field is **cleared in the VMCB on `#VMEXIT`**, so a hypervisor that wants the same event injected again **must rewrite it** `[APM3 §4 "VMRUN"]` `[2]`; and **software interrupts cannot be properly injected on a processor without the NextRIP field** — the hypervisor must emulate software-interrupt injection when `CPUID Fn8000_000A_EDX[NRIPS]` (**bit 3**) is 0 `[APM2 §15.20]` `[APM2 §15.7.1]` `[1]`. Under SEV-ES, **software interrupts and exception vectors 3 and 4 may not be injected**, and attempting it fails VMRUN with `VMEXIT_INVALID` `[APM2 §15.35.8]` `[1]`.

Where injection sits in the VMRUN ordering: consistency checks → `TLB_CONTROL` command → `GIF = 1` → **injected event delivered** → first guest instruction `[APM3 §4 "VMRUN"]` `[2]`. And note it is an **unconditional** delivery, unlike a virtual interrupt, which is a *pending condition* gated on `EFLAGS.IF`, the `V_TPR` comparison, `VGIF` and the interrupt shadow — use `EVENTINJ` when you need guaranteed delivery at VMRUN and `V_IRQ` when you need the guest's own masking respected `[APM2 §15.20]` `[APM2 §15.21.4]` `[1]`. With NMI Virtualization enabled, injecting an NMI via `EVENTINJ` makes VMRUN **set `V_NMI_MASK`** in guest state, so the injected NMI participates in the virtualized masking state machine `[APM2 §15.21.10]` `[1]`.

**Re-injecting an event interrupted by an intercept during IDT delivery.** `EXITINTINFO` exists because the information needed to resume transparently may already be **unrecoverable** — for an external interrupt the processor has **already run the acknowledge cycle** against the PIC or APIC, so the interrupt is no longer pending anywhere `[APM2 §15.7.2]` `[1]`. **All intercepts** record in `EXITINTINFO` whether they occurred during IDT delivery `[APM2 §15.7.2]` `[APM2 Figure 15-1]` `[1]`. Its layout is `EVENTINJ`'s, field for field — `VECTOR` 7:0, `TYPE` 10:8, `EV` 11, reserved 30:12, `V` 31 (set if the intercept occurred during IDT delivery), `ERRORCODE` 63:32 (undefined when `EV` is 0) — with **the same four `TYPE` values** `[APM2 Table 15-1]` `[1]`.

**The procedure** is therefore: on exit, test `EXITINTINFO[31]` (`V`); if set, the guest was mid-delivery of that event. To resume transparently, **copy `EXITINTINFO` into `EVENTINJ`** (same encoding) after handling the intercepted condition, then VMRUN.

**The ordering the pseudo-code fixes** `[APM2 §15.7.3]` `[1]`: an intercepted exception **exits before `EXITINTINFO` is written**; the combined result is checked against the `#DF` and shutdown intercepts next; `EXITINTINFO` is then set to the event being delivered; and it is cleared (by setting `V` to 0) once the exception has been **successfully taken** in the guest.

**The invariant to rely on:** when an exception triggers an intercept, `EXITCODE` (and optionally `EXITINFO1`/`EXITINFO2`) always reflects the **intercepted** exception, while `EXITINTINFO`, if valid, reflects the **prior** exception the guest was attempting to deliver `[APM2 §15.7.3]` `[1]`.

**Stacking.** With several exceptions in flight, `EXITINTINFO` records **the aggregate of all of them except the last, intercepted one** `[APM2 §15.7.2]` `[1]`. AMD's worked example: a guest `#GP` during whose delivery a `#NP` arises resolves to `#DF` by x86 rules; an intercepted `#PF` during the attempt to deliver that `#DF` reports **`#PF` in `EXITCODE` with `#DF` in `EXITINTINFO`** — and if the VMM **reflects** rather than repairs the `#PF`, it must combine the two by x86 rules itself, giving a **triple fault or shutdown** `[APM2 §15.7.2]` `[1]`.

**Classification trap.** Despite the names, events raised by **INT1/ICEBP (`F1h`), INT3 (`CCh`) and INTO (`CEh`) count as exceptions**, not software interrupts, for `EXITINTINFO`; **only INTn (`CDh`)** counts as a software interrupt `[APM2 §15.7.2]` `[1]`. Related: for **INT3, INTO and BOUND**, an exception intercept saves the rIP **of the instruction itself** rather than of the next instruction, unlike every other exception intercept `[APM2 §15.12]` `[1]`.

**Clean bits:** `EVENTINJ` and the status fields are on the explicitly-uncached list, so this whole fast path needs **no clean-bit maintenance** `[APM2 §15.15.3]` `[1]` (owned by `02-vmcb.md`).

**Confidence:** high — all `C:high` `V:durable`.

---

### nested-permission-combining
**Routed to:** `06-nested-paging.md` §6.2 "Where nested semantics diverge from ordinary paging" (with §6.4 for the walk) — correct route (SKILL.md §Routing row "Nested page tables, the two-dimensional walk … → `06-nested-paging.md`")

**Answer:**
The chapter warns up front that this is **the part that does not transfer from an EPT mental model**: at the nested level the processor does **not** simply repeat the guest's access type.

**The access-type rewriting rules** (these come before any permission combining):
- Unless Read Only Guest Page Tables is enabled, a **table walk of the guest's page tables is always treated as a *user write*** at the nested level: the page must be **user-writable in the nested tables** or a `#VMEXIT(NPF)` is raised, and the **Accessed and Dirty bits are always set in every nested entry touched** on the way `[APM2 §15.25.5]` `[1]`.
- Read Only Guest Page Tables (`CPUID Fn8000_000A_EDX[ROGPT]`, bit 21; enabled by **bit 6 of VMCB offset 090h**) changes that: guest page-table accesses count as writes at the nested level **only when an A/D update is actually required**, which lets a hypervisor map guest page tables into read-only nested pages `[APM2 §15.25.5]` `[1]`.
- A walk for the guest *page itself* is **likewise always a user access** at the nested level, but is classified as a **data read, data write or code read according to the guest's own access** `[APM2 §15.25.5]` `[1]`.

**The combining rules, per permission** `[APM2 §15.25.7]` `[1]`:
- **Write:** a page is writable by the guest **only if it is writable at both levels**. `gCR0.WP` affects only the interpretation of the *guest* entry and **can never make a nested-read-only page writable at any CPL**; the host's **`hCR0.WP` is ignored entirely** under nested paging.
- **Execute:** a page is executable by the guest **only if it is executable at both levels**. NX is honoured only when `EFER.NXE = 1`, and **the host's EFER governs the nested level** — if `hEFER.NXE` is cleared, **all nested mappings are executable at the nested level** `[APM2 §15.25.7]` `[1]`.
- **User/supervisor is asymmetric — the rule people get wrong.** A page is *user* **in the guest** only if the **guest** entry marks it user; but **the nested entry must mark the page user for the guest to be allowed *any* access at all**. So U/S is not a symmetric AND: the nested U/S bit is an all-or-nothing gate, while the guest U/S bit is what distinguishes user from supervisor inside the guest.
- **Global:** taken from the **guest alone**. A page is global only if the guest entry says so; the nested entry's G bit and the host's `hCR4.PGE` are **irrelevant**, and a global page is global **only within its ASID** `[APM2 §15.25.7]` `[1]`.
- **Page size:** when guest and nested entries map an address with different page sizes, the TLB entry created matches the **smaller** of the two — AMD calls this **page splintering** `[APM2 §15.25.9]` `[1]`.

**Where the two levels are consulted, in order** (§6.5 fault ordering, `[APM2 §15.25.6]` `[1]`): (1) walk the guest page-table entries **through the nested tables**, nested faults → `#VMEXIT(NPF)`; (2) descend the guest walk, not-present or reserved-bit at any guest level → **guest `#PF`** — steps 1 and 2 repeat per guest level; (3) once the guest physical address is known, **check guest permissions**, failure → guest `#PF`; (4) perform the final gPA→sPA translation, fault → `#VMEXIT(NPF)`. So guest permission failure is decided **before** the final nested translation is even performed.

**Division of responsibility:** nested page faults are entirely a function of the **nested page table and the VMM's processor mode**; guest faults are entirely a function of the **guest page tables and the guest's processor mode**, and a guest `#PF` is delivered to the guest as a normal exception with **no VMM involvement** unless the VMM is intercepting `#PF` `[APM2 §15.25.6]` `[1]`.

**Reserved bits and NX at the nested level:** reserved bits must be cleared to 0; in long mode a set reserved bit raises a fault, which **at the nested level is a `#VMEXIT(NPF)` with the RSV error bit rather than a guest `#PF`** `[APM2 §5.4.1]` `[APM2 §15.25.6]` `[1]`.

**Two extensions that modify the combining:**
- **GMET** reinterprets the **nested** U/S bit for execute accesses — see the `gmet-mechanism` answer `[APM2 §15.25.13]` `[1]`.
- **Supervisor Shadow Stack:** a nested page is designated a supervisor-shadow-stack page by **NX = 1 and U/S = 0 in the final nested entry plus R/W = 1 in every non-leaf nested entry** on the path; a supervisor shadow-stack **write to a designated page is allowed to complete even though R/W = 0 in the final nested entry** `[APM2 §15.25.14]` `[1]`.

**SEV-SNP layering:** all **RMP and VMPL checks happen *after*** the page-table and nested-page-table access checks and have **lower priority** than the existing paging checks `[APM2 §15.36.10]` `[1]` (machinery owned by `14-sev-snp.md`).

**Confidence:** high — all `C:high` `V:durable`.

---

### memory-type-combining
**Routed to:** `06-nested-paging.md` §6.6 "Combining guest and nested memory types" — correct route (SKILL.md §Routing row names "memory-type combining" under `06-nested-paging.md`)

**Answer:**
**Baseline: nested paging off.** The processor behaves as though there were **no guest PAT register**: the **host PAT MSR** determines the memory type for the current VM, un-intercepted guest writes to the PAT MSR **alter the host PAT MSR**, and the hypervisor is responsible for context-switching the PAT contents across world switches `[APM2 §15.25.8]` `[1]`.

**Nested paging on: six inputs.** The processor combines guest and nested memory types from — the **PCD/PWT/PATi bits in both the nested and the guest entries**, the **PCD/PWT bits in nested CR3 and guest CR3**, the **guest PAT type**, the **host PAT type**, the **MTRRs**, and **`gCR0.CD` together with `hCR0.CD`** `[APM2 §15.25.8]` `[1]`. The guest PAT lives in the VMCB state-save area at **byte offset 268h** as a qword, swapped for the guest and unused in host mode, and is **loaded by VMRUN only when nested paging is enabled** `[APM2 Table B-2]` `[1]` (offsets owned by `02-vmcb.md`; `G_PAT` shares clean bit 4 with `NCR3`).

**The two-stage combining rule — this is the ordering.**
1. **Nested and guest PAT types combine into a "combined PAT type"** per **Table 15-19**.
2. **That result combines with the MTRR type selected by the *system* physical address** per **Table 15-20**.
3. **Either `gCR0.CD` or `hCR0.CD` can disable caching outright.**
`[APM2 §15.25.8]` `[1]`

**Table 15-19** (guest PAT down the side, host PAT across) `[APM2 Table 15-19]` `[1]`:

| Guest ↓ / Host → | UC | UC− | WC | WP | WT | WB |
|---|---|---|---|---|---|---|
| **UC** | UC | UC | UC | UC | UC | UC |
| **UC−** | UC | UC− | WC | UC | UC | UC |
| **WC** | WC | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | UC | UC | WP | UC | WP |
| **WT** | UC | UC | UC | UC | WT | WT |
| **WB** | UC | UC | WC | WP | WT | WB |

**Table 15-20** (effective PAT down the side, MTRR across) `[APM2 Table 15-20]` `[1]`:

| Effective PAT ↓ / MTRR → | UC | WC | WP | WT | WB |
|---|---|---|---|---|---|
| **UC** | UC | CD | CD | CD | CD |
| **UC−** | UC | WC | CD | CD | CD |
| **WC** | WC | WC | WC | WC | WC |
| **WC+** | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | CD | WP | CD | WP |
| **WT** | UC | CD | CD | WT | WT |
| **WB** | UC | WC | WP | WT | WB |

Note the MTRR is selected by the **system** physical address, i.e. after the nested translation.

**What happens to guest MTRRs — the direct answer.** **There is no hardware support for guest MTRRs.** The MTRRs are referenced **only by system physical address**, and a VMM that must present MTRR behaviour to a guest **simulates it by altering the memory types in the nested page tables** `[APM2 §15.25.8]` `[1]`. (Consistently, §6.3 states that CR0/CR3/CR4/EFER/PAT are replicated for host and guest but **the MTRRs are not replicated at all** `[APM2 §15.25.2]` `[1]`.)

**Three mitigations AMD provides** because guest and VMM can end up using different memory types for the same physical page `[APM2 §15.25.8]` `[1]`:
1. **VMRUN and `#VMEXIT` flush the write combiners.**
2. A memory type **WC+** exists, which combines writes like WC **but also snoops every processor's caches, including self-snooping**, so that cacheable writes are observed.
3. **When nested and guest types are incompatible with respect to caching, the combining rules produce WC+ instead of WC** — visible in Table 15-19's WC row and Table 15-20's WC+ row.

**Practical framing the chapter gives:** this is what you need to map a **framebuffer or an emulated MMIO window** correctly, and it is the part of nested paging with **no counterpart in a naive "second page table" model**.

**Confidence:** high — all `C:high` `V:durable`.

---

### npf-check-ordering
**Routed to:** `06-nested-paging.md` §6.5 "Nested page faults → Fault ordering" — correct route.
**Second chapter genuinely needed:** `05-exit-decoding.md` §5.3 for the `EXITINFO1` bit layout. SKILL.md itself names this as the canonical two-chapter case ("decoding an `#NPF`, for example, needs `05` for the bit layout and `06` for the semantics"), and `00-quickref.md` §0.2 routes the symptom the same way. `errata.md` **E04** checked.

**Answer:**
**The ordering.** The nested walk proceeds, and generates faults, in this order `[APM2 §15.25.6]` `[1]`:

1. **Walk the guest page-table entries through the nested tables**, setting Dirty and Accessed bits **in the nested tables** as needed. **Any nested fault here produces `#VMEXIT(NPF)`.**
2. **As the guest walk descends**, a **not-present entry or a set reserved bit at any guest level produces a guest `#PF`**, with guest Accessed and Dirty bits set as needed. **Steps 1 and 2 repeat per guest level** — each guest entry the walker wants to read costs a nested walk of its own first.
3. **Once the guest physical address is known, check guest permissions.** Any failure produces a **guest `#PF`**.
4. **Perform the final guest-physical → system-physical translation.** Any fault here produces **`#VMEXIT(NPF)`**.

So the interleaving is: nested-level faults can pre-empt the guest walk at every level (step 1), guest-level faults are decided during and at the end of the guest walk (steps 2–3), and the final nested translation (step 4) is only reached if the guest walk fully succeeded. Guest permission failure therefore beats a bad final nested mapping.

**Division of responsibility** `[APM2 §15.25.6]` `[1]`: nested page faults are **entirely a function of the nested page table and the VMM's processor mode**; guest faults are **entirely a function of the guest page tables and the guest's processor mode**, and a guest `#PF` is delivered to the guest as a normal exception **with no VMM involvement** unless the VMM intercepts `#PF`.

**Where RMP checks sit — the direct answer.** **All RMP and VMPL checks happen *after* the page-table and nested-page-table access checks and have *lower priority* than the existing paging checks** `[APM2 §15.36.10]` `[1]`. That is, RMP is a stage after step 4, not a filter interleaved with the walk. (The RMP machinery itself is owned by `14-sev-snp.md`.) Two consequences the skill states: with SEV-SNP enabled an access to a **1 GB** nested page installs only a **2 MB** TLB entry and is treated as a 2 MB access for checking purposes, since the RMP has **no 1 GB entry** `[APM2 §15.36.10]` `[1]`; and an **RMP check can fail transiently** if the accessed RMP entries are in use by other logical processors — software should **retry** rather than treat the fault as terminal `[APM2 §15.36.10]` `[1]`.

**What the exit carries** `[APM2 App.C]` `[APM2 §15.25.6]` `[1]`: exit code **400h** (`VMEXIT_NPF`), described by AMD as a host-level page fault under nested paging, with the **fault error code in `EXITINFO1`** and the **faulting guest physical address in `EXITINFO2`**.

**`EXITINFO1` bit layout** (owned by `05-exit-decoding.md` §5.3; `errata.md` E04 is the correction entry):

| Bit | Name | Meaning | Source |
|---|---|---|---|
| 0 | `P` | 0 if the nested page was not present, 1 otherwise | §15.25.6 |
| 1 | `RW` | set if the **nested-level** access was a write | §15.25.6 |
| 2 | `US` | set if the nested-level access was a user access | §15.25.6 |
| 3 | `RSV` | set if reserved bits were set in the corresponding nested entry | §15.25.6 |
| 4 | `ID` | set if the nested-level access was a code read | §15.25.6 |
| 6 | `SS` | set if the fault was caused by a shadow stack access | §15.25.6 |
| 31 | `RMP` | set if the fault was caused by an **RMP check or a VMPL check failure** | §15.36.10 |
| 32 | — | set if the fault occurred while translating the guest's **final** physical address | §15.25.6 |
| 33 | — | set if the fault occurred while translating the **guest page tables** | §15.25.6 |
| 34 | `ENC` | set if the guest's effective C-bit was 1 | §15.36.10 |
| 35 | `SIZEM` | size mismatch between PVALIDATE/RMPADJUST and the RMP | §15.36.10 |
| 36 | `VMPL` | VMPL permission check failure | §15.36.10 |
| 37 | `SSS` | **two definitions** — see below | §15.25.6 and §15.36.10 |

**Bit 5 is absent**: a `#PF` error code puts the protection-key violation there; the `#NPF` error code defines nothing at bit 5 and puts the shadow-stack indication at **bit 6** `[APM2 §15.25.6]` `[1]`. A numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is **off by one from bit 34 upward** — `errata.md` **E04** `[APM2 §15.36.10]` `[APM2 §15.25.6]` `[1]`. **Bits 32/33 are exactly the "which stage faulted" indicator** for the ordering above, and AMD prints them without mnemonics, referring to them only as `EXITINFO1[33:32]`. **Bit 31 is set on every RMP violation**, while bits 34–37 are documented as bits that "**may be set**" — the two groups are stated separately and are not one flat list `[APM2 §15.36.10]` `[1]`. **Bit 37 is genuinely ambiguous**: §15.25.6 defines it as the leaf nested entry being marked a supervisor shadow stack page with the shadow-stack check feature enabled, while §15.36.10 defines it as the VMPL permission mask `SSS` (bit 4) value when `VmplSSS` is enabled — **a decoder must know which feature is active before reading it** `[APM2 §15.25.6]` `[APM2 §15.36.10]` `[1]`.

**Two low-bit conventions that mislead** `[APM2 §15.25.6]` `[1]`: table walks for guest page tables are always treated as **data writes** at the nested level (so `RW` is set **even for a code read / instruction fetch**), and nested page-table accesses performed by the MMU are treated as **user** accesses unless an enabled feature overrides that.

**Faults the extensions add** `[APM2 §15.25.14]` `[APM2 §15.25.15]` `[1]`: with SSS enabled, a guest supervisor-shadow-stack access to a page **not** so designated gives `#VMEXIT(NPF)` with `SS` set, and executing from a designated page faults exactly as any NX=1 page would; and a PML buffer index outside `0`–`1FFh` gives `VMEXIT_PML_FULL` (**407h**), which does not advance guest rIP.

**Confidence:** high — all `C:high` `V:durable`; the bit-37 dual definition is reported as the specification's own ambiguity, not resolved.

---

### asid-allocation-and-exhaustion
**Routed to:** `06-nested-paging.md` §6.7 "ASID: allocation, exhaustion and reuse" (with §6.8 `TLB_CONTROL`, same chapter) — correct route (SKILL.md §Routing row names "ASID, `TLB_CONTROL`, INVLPGA" under `06-nested-paging.md`; `00-quickref.md` §0.2 routes the symptom "I ran out of ASIDs" to `06` §6.7)

**Answer:**
**What an ASID tags, and it differs by paging mode.** TLB entries are tagged with an Address Space Identifier, which distinguishes different guest **virtual** address spaces when **shadow** page tables are used and different guest **physical** address spaces when **nested** page tables are used `[APM2 §15.16]` `[1]`. Under nested paging an ASID is associated with the guest's **physical** address space and is therefore **common across all of that guest's virtual address spaces on a processor** — the opposite of shadow paging, where an ASID tags an individual guest virtual address space `[APM2 §15.25.1]` `[1]`.

**How many there are.** The number is **implementation-specific** and is the value returned in **EBX by `CPUID Fn8000_000A`** — **the whole 32-bit register is the `NASID` field**, not a subfield of it `[APM3 App.E]` `[2]`. `01-svm-intro.md` §1.3 states the same and adds the discipline: **never derive `NASID` from a table of part numbers; read EBX.** The skill gives no universal count, and that is the correct answer — there isn't one.

**Hard allocation rules.**
- **ASID 0 is reserved for the host**, and the current ASID is 0 whenever the CPU is not inside a guest context `[APM2 §15.16.1]` `[1]`. `#VMEXIT` resets the current ASID register to zero `[APM2 §15.6]` `[1]`.
- **"ASID is equal to zero" is in VMRUN's list of illegal state combinations** — VMRUN with guest ASID 0 gives `#VMEXIT(VMEXIT_INVALID)` `[APM2 §15.5.1]` `[1]`.
- Whether the **same ASID denotes the same address space on every processor** of a multiprocessor system is **left to the VMM**, for nested and shadow tables alike; nothing in the architecture ties an ASID to an address space globally `[APM2 §15.25.1]` `[1]`.
- When SVM is enabled, **global page-table entries are global only within an ASID and never across ASIDs** — a global mapping is not a way to share a translation between guests `[APM2 §15.16]` `[1]`.
- Under SEV the ASID space is **partitioned**: `CPUID Fn8000_001F_ECX` reports the number of encrypted guests supported and `Fn8000_001F_EDX` the **minimum ASID usable by a SEV guest without encrypted state** `[APM3 App.E]` `[2]` (SEV side owned by `12-sev.md`).

**What happens when you run out — the architecture's one explicit recycling rule.** On implementations without a way to selectively flush all translations of one specified ASID, software may flush a guest's TLB entries effectively by **allocating it a new ASID and not reusing the old ASID until the entire TLB has been flushed at least once** `[APM2 §15.16.1]` `[1]`. This is the basis of every generation-counter scheme in a real hypervisor.

The fallback is therefore correct **but global**: bumping the generation means **every previously issued ASID must be considered stale until a full TLB flush has happened on that logical processor**, which is why the recycle path is normally paired with **`TLB_CONTROL = 1`** rather than with per-guest invalidation `[APM2 §15.16.1]` `[1]` — this specific claim is tagged **`C:medium`**. §6.8's decision table states the same row: "ASID generation rolled over and an ASID is being reused → `01h`".

**`TLB_CONTROL` values** (bits 39:32 of VMCB offset 058h, immediately above the 32-bit guest ASID in bits 31:0) `[APM2 Table 15-9]` `[APM2 Table B-1]` `[1]`: `00h` do not flush · `01h` flush **entire TLB — all entries, all ASIDs** on VMRUN (AMD marks it **for legacy hardware only**, because it discards every ASID's entries including the host's) · `03h` flush **this guest's** TLB entries · `07h` flush **this guest's non-global** entries. All encodings not in that table are **reserved**. `01h` and `00h` are available on every SVM processor; **`03h` and `07h` are optional**, indicated by `CPUID Fn8000_000A_EDX[FlushByAsid]`, **bit 6** — the same bit that indicates that TLB flush events such as CR3 writes and `CR4.PGE` toggles flush only the current ASID's entries `[APM2 §15.16.1]` `[APM3 App.E]` `[1][2]`. VMRUN **reads the field but does not change it**, so the hypervisor must reset it between entries `[APM2 §15.16.1]` `[1]`.

**Two migration obligations that interact with allocation.**
- Moving a vCPU between logical processors: for **non-SNP-active** guests the hypervisor must ensure the VMSA cannot use stale TLB translations; **only for SNP-active guests does hardware detect the move and manage the TLB itself** `[APM2 §15.36.15]` `[1]`.
- With **xAVIC** on, when a core that last ran a *different vCPU of the same VM* runs this vCPU, the VMM must flush with **`TLB_CONTROL = 3h` regardless of the respective ASID values**, or stale mappings may misdirect virtual APIC accesses to the previous vCPU's backing page `[APM2 §15.29.4.3]` `[1]`.

**Do not confuse with clean bits.** Whether a migrated guest also needs a new ASID is a **separate** question governed by TLB rules, not by the clean field; and the clean-field rule ("clear the whole field on a different core") is about VMCB caching, whose identity is the **VMCB physical address, explicitly not the ASID** `[APM2 §15.15]` `[APM2 §15.16.1]` `[1]` (owned by `02-vmcb.md`).

**And do not reach for `INVLPGA`.** Its address operand is **always interpreted as a guest virtual address**, and AMD states plainly that it **does not provide a means to invalidate a nested translation by guest physical address** `[APM2 §15.16.2]` `[1]` — so whole-ASID invalidation via `TLB_CONTROL`, not per-page `INVLPGA`, is the correct baseline once nested paging is on.

**Confidence:** high, except the "recycle path pairs with `TLB_CONTROL = 1`" framing, which the skill marks **`C:medium`**. Everything else is `C:high` `V:durable`.

---

### gmet-mechanism
**Routed to:** `06-nested-paging.md` §6.9 "Guest mode execute trap and the other nested-paging extensions → GMET" — correct route (SKILL.md §Routing row names "GMET" under `06-nested-paging.md`)

**Answer:**
**What it is.** The **Guest Mode Execute Trap** extension lets a hypervisor cause **nested page faults when a guest attempts to execute code at CPL 0, 1 or 2** from pages the hypervisor designates `[APM2 §15.25.13]` `[1]`. In other words it makes *supervisor-mode* execution of a page a trappable event **without** making the page non-executable to user mode — which is the primitive you cannot build out of NX alone.

**How it is turned on.** Presence is indicated by **`CPUID Fn8000_000A EDX[17] = 1`**, and it is selected **per guest by setting bit 3 of VMCB offset 090h** — a bit that is **ignored on processors without the extension** `[APM2 §15.25.13]` `[1]`. (VMCB field table owned by `02-vmcb.md`.) Bit 3 of offset 090h sits in the same word as `NP_ENABLE` (bit 0), SSS (bit 4), ROGPT (bit 6) and PML (bit 11).

**How it works at the page-table level.** GMET **changes how the *nested* U/S bit is interpreted for execute accesses**. Precisely `[APM2 §15.25.13]` `[1]`:
- **NX = 1 still prohibits execution at any privilege level** — GMET does not weaken NX.
- With GMET enabled and an **effective NX of 0**, an **effective U/S of 1** combined with an **execute access at CPL 0, 1 or 2** generates **`#VMEXIT(NPF)`**.
- **Effective NX = 0 with effective U/S = 0 allows the code translation.**

AMD's summary table `[APM2 Table 15-21]` `[1]`:

| nPT NX | nPT U/S | Guest **user-mode** code | Guest **supervisor-mode** code |
|---|---|---|---|
| 1 | X | No Execute | No Execute |
| 0 | 1 | **Execute** | **No Execute** |
| 0 | 0 | Execute | Execute |

So the nested U/S bit is repurposed: **U/S = 1 means "user may execute, supervisor may not"**, which is the inversion of the ordinary paging meaning of a "user" page and is the whole content of the feature. Recall that under ordinary nested-paging rules the nested entry **must** mark the page user for the guest to be allowed *any* access at all `[APM2 §15.25.7]` `[1]` — GMET layers the execute-side distinction onto that same bit.

**How a violation is reported — and the trap in it.** A GMET violation is **not flagged by a dedicated error bit**. Software must work out whether a fault was NX-based or GMET-based **by inspecting the ordinary `#NPF` error code together with the faulting page's effective NX and U/S settings** `[APM2 §15.25.13]` `[1]`. AMD footnotes that **on some implementations a GMET erratum may require the CPL to be read from the guest VMCB instead of from the exit information** `[APM2 §15.25.13]` `[1]`.

**What it is for.** GMET is the hardware primitive underneath **kernel-mode code-integrity enforcement on AMD hosts** — it is how a hypervisor makes supervisor-mode execution of a page a trappable event without making the page non-executable to user mode; the Windows HVCI side is in `16-windows-platform.md` `[42]`.

**Confidence:** high for the architectural mechanism (all `C:high` `V:durable`). The "GMET is the primitive underneath HVCI" framing is the one claim here the skill marks **`C:medium`** and cites to a Microsoft source `[42]`, not to the APM.

---

### avic-ipi-delivery-path
**Routed to:** `07-virtual-interrupts-avic.md` §7.4.4 (ICRL side effects), §7.5 (the two ID tables), §7.6 / §7.6.1 (doorbell and the six-step algorithm), §7.8.1 (the failure exit) — correct route (SKILL.md §Routing row "Virtual interrupts … AVIC, x2AVIC, the doorbell → `07-virtual-interrupts-avic.md`"). All within one chapter.

**Answer:**
**Preconditions.** AVIC is enumerated by `CPUID Fn8000_000A_EDX[AVIC]` = **bit 13**, enabled per virtual processor by **bit 31 of the word at VMCB offset 60h**, and **any guest configured to use AVIC must also enable nested paging** `[APM2 §15.29.7]` `[APM2 §15.29.4.1]` `[1]`. Enabling AVIC **implicitly disables** `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR` and `V_INTR_VECTOR` — the software virtual-interrupt path is switched off `[APM2 §15.29.4.1]` `[1]`. Three memory-resident structures, each exactly one 4-Kbyte page: the **vAPIC backing page** (one **per virtual processor**), the **Physical APIC ID Table** and the **Logical APIC ID Table** (**one each per virtual machine**, so the two pointers hold the same value in every VMCB of the VM) `[APM2 §15.29.5]` `[APM2 §15.29.5.2]` `[1]`. Pointers live at VMCB offsets **0E0h** (backing page), **0F0h** (logical table), **0F8h** (physical table, with `AVIC_PHYSICAL_MAX_INDEX` in bits 11:0) `[APM2 §15.29.4.2]` `[1]`.

**Step 1 — the guest writes ICRH (if used).** ICRH writes are simply **Allowed**: writing ICRH has **no immediate hardware side effect**, because the IPI is initiated by the **ICRL** write `[APM2 §15.29.3.1]` `[1]`. (In x2AVIC there is no separate ICRH — x2APIC folds both into the single 64-bit ICR MSR at **830h**, whose bits 31:0 and 63:32 map to backing-page offsets 300h and 310h `[APM2 §15.29.10]` `[1]`.)

**Step 2 — the guest writes ICRL; the permission filter decides.** The register-level filter has **three** outcomes, not four: **Allow** (the backing-page access completes, and in certain cases a write additionally triggers a hardware acceleration action), **Fault** (intercept *before* the access → `#VMEXIT`), or **Trap** (intercept *immediately after* the access → `#VMEXIT`) `[APM2 §15.29.3.1]` `[1]`. **ICRL writes are accelerated only when the Message Type is Fixed *and* the Trigger Mode is edge-triggered**; self and broadcast delivery via the ICRL Destination Shorthand (DSH) field are also supported, in both logical and physical APIC ID formats. **Every other IPI type causes a `#VMEXIT`** `[APM2 §15.29.3.1]` `[1]`. In x2AVIC mode, x2APIC **MSR intercept checks and access checks are evaluated at higher priority than AVIC access-permission checks** — an MSR intercept wins over the AVIC filter `[APM2 §15.29.10]` `[1]`.

**Step 3 — AVIC hardware processes the IPI. AMD's six steps** `[APM2 §15.29.6.1]` `[1]`:
1. **If DSH is 01b (self):** update the IRR in **this** vCPU's backing page, signal a **doorbell to self**, and stop.
2. **If DSH is non-zero, or the destination field is FFh (broadcast):** jump to step 4.
3. **Otherwise resolve logically addressed destinations through the Logical APIC ID Table.**
4. **Look up the backing-page address in the Physical APIC ID Table**, using the **guest physical APIC ID** as the index.
5. **For every valid destination: atomically set the IRR bit** in that destination's backing page, **check `IsRunning`**, and if set **send a doorbell** using the **Host Physical APIC ID** from the same table entry.
6. **If any destination was not scheduled on a physical core, cause a `#VMEXIT`.**

**Step 3 detail — the Logical APIC ID Table.** 32-bit entries: `V` at bit 31, reserved 30:8, **Guest Physical APIC ID at bits 7:0** `[APM2 Table 15-24]` `[1]`. One entry per logically addressed APIC, which implies **each vAPIC's logical ID must be unique**, and if the guest changes its logical ID the VMM must mirror the change into this table `[APM2 §15.29.5.3]` `[1]`. **Flat mode:** only the first 8 entries are used; supported encodings are of the form 2^i for i = 0..7 and the byte offset is `4 * log2(l_apic_id)`. **Cluster mode:** bits 7:4 are the cluster number and bits 3:0 the bit-encoded APIC index; cluster Fh is reserved; the byte offset is `(16 * c) + 4 * log2(apic_ix)` `[APM2 §15.29.5.3]` `[1]`. **In x2AVIC mode the Logical APIC ID Table is not used at all** — the destination logical ID is derived arithmetically as `Logical x2APICID = (X2APICID[19:4] << 16) | (1 << X2APICID[3:0])` `[APM2 §15.29.5.3]` `[1]`. Three logical-lookup conditions each cause `#VMEXIT`: an **invalid entry** (`V` clear), a valid entry whose **Guest Physical APIC ID > 255** (xAVIC), and a valid entry containing an **invalid backing page pointer** `[APM2 §15.29.6.1]` `[1]`.

**Step 4 detail — the Physical APIC ID Table.** 64-bit entries indexed by guest physical APIC ID `[APM2 Table 15-23]` `[1]`: **`V` bit 63** (valid) · **`IR` bit 62** (IsRunning) · reserved 61:52 · **Backing Page Pointer bits 51:12** (4-Kbyte-aligned system physical address of that vCPU's backing page) · **Host Physical APIC ID bits 11:0**, **not valid unless `IR` is set**. `IR` means only that the VMM has **assigned a physical core** to the vCPU; it does **not** distinguish a core currently executing guest software from one in host mode `[APM2 §15.29.5.2]` `[1]`. Addressing rule differs here: for **directed** interrupts an invalid entry causes `#VMEXIT`, while for **broadcast** IPIs invalid entries are simply **ignored** `[APM2 §15.29.6.1]` `[1]`.

**Step 5 detail — the IRR write and the doorbell.** The IRR bit is set **atomically** in the target's backing page — which is why the backing page **stays pinned for the lifetime of the VM even while the vCPU is not running**, since some fields are updated when the guest is not running `[APM2 §15.29.2]` `[1]`. Then the doorbell: the programming interface is the **Doorbell Register, MSR `C001_011Bh`**, whose **bits 7:0 hold the destination Physical APIC ID** and bits 63:8 are Reserved, MBZ; writing it sends the doorbell to that physical core, and **any attempt to read it raises `#GP`** `[APM2 Figure 15-22]` `[APM2 §15.29.8.2]` `[1]`. The exact signalling mechanism is implementation-specific but must be protected from non-privileged software on other cores and from direct access by an external device `[APM2 §15.29.8.2]` `[1]`. `WRMSR`'s serializing semantics are **relaxed** for the Doorbell Register `[APM3 §4 "WRMSR"]` `[2]`.

**Step 6 — arrival at the target vCPU's IRR, and consumption.** The IRR bit is already set by step 5; the doorbell only makes the target core look. **A doorbell delivered to a running guest is recognized whether or not the interrupt can be injected immediately**; on the next VMRUN the delivery mechanism **re-reads the IRR in the backing page, finds the highest-priority pending interrupt and injects it if masking and priority allow** `[APM2 §15.29.8.2]` `[1]`. **VMRUN itself re-evaluates the APIC state in the backing page on guest entry**, delivers the highest-priority pending IRR interrupt if masking and priority allow, and **recognizes any doorbell received during VMRUN processing immediately after entering the guest** `[APM2 §15.29.8.3]` `[1]`. Gating uses the **PPR**, which hardware owns: a guest PPR write causes `#VMEXIT` **without** updating the backing page, and hardware refreshes PPR in the backing page whenever the TPR or the highest in-service interrupt changes, using it to gate virtual-interrupt delivery `[APM2 §15.29.3.1]` `[1]`. TPR feeds that: a guest TPR write lands in the backing page and hardware copies the **upper 4 bits** into `V_TPR` in the VMCB `[APM2 §15.29.3.1]` `[1]`.

**When the fast path fails — the exit and how to decode it.** `AVIC_INCOMPLETE_IPI`, exit code **401h**, is raised when an IPI could not be delivered to all targeted vCPUs — canonically because at least one target was not allocated to a physical core `[APM2 §15.29.9.1]` `[1]`. First payload: **bits 63:32 = the value written to vAPIC ICRH, bits 31:0 = the value written to ICRL** `[APM2 Table 15-25]` `[1]`. Second payload: **`ID` in bits 63:32**, reserved 31:12, **`Index` in bits 11:0**, meaningful only for `ID` = 1–3 `[APM2 Table 15-26]` `[1]`. `ID` values `[APM2 Table 15-27]` `[1]` — **six of them, 0 through 5, not four**: 0 Invalid Interrupt type (trigger mode was level, or unsupported destination type) · 1 IPI Target Not Running (`IsRunning` clear; Index = the physical/logical table entry) · 2 Invalid IPI Target (not covered by either ID table) · 3 Invalid Backing Page Pointer · 4 Invalid IPI Vector (**VEC < 16**) · 5 Un-accelerated IPI (DSH not Self, Secure AVIC). `ID = 5` is the Secure AVIC path, where the Physical and Logical APIC ID tables are **not used at all** `[APM2 §15.36.21]` `[1]`.

**One TLB obligation on the path.** With xAVIC on a multi-vCPU VM, when the VMM schedules a vCPU on a core that last ran a **different vCPU of the same VM** — **regardless of the ASID values** — it must flush with `TLB_CONTROL = 3h`, or stale mappings may misdirect virtual APIC accesses to the **previous vCPU's backing page** `[APM2 §15.29.4.3]` `[1]`.

**Scope note the chapter makes explicitly:** AVIC accelerates only **guest access to performance-critical APIC registers** and **the initiation of intra- and inter-processor interrupts**. Acceleration of **device** interrupt delivery is explicitly **not** addressed by AVIC hardware and is the IOMMU's job `[APM2 §15.29.1]` `[1]`.

**Confidence:** high — all `C:high` `V:durable`.

---

### vnmi-virtualization
**Routed to:** `07-virtual-interrupts-avic.md` §7.2.3 "NMI virtualization" — correct route (SKILL.md §Routing row "Virtual interrupts, the offset-60h control word … → `07-virtual-interrupts-avic.md`"; the chapter `Owns:` "every bit of the offset-60h virtual interrupt control word · virtual-interrupt evaluation and delivery")

**Answer:**
**Enumeration.** NMI Virtualization is enumerated by **`CPUID Fn8000_000A_EDX[VNMI]` = bit 25** `[APM3 App.E]` `[2]`.

**What you must configure — and the hard requirement.** It is enabled by setting **`V_NMI_ENABLE`, bit 26 of the word at VMCB offset 60h**, and it **requires the NMI intercept bit to be set**: running a guest with `V_NMI_ENABLE` and **no NMI intercept produces `#VMEXIT(INVALID)`** `[APM2 §15.21.10]` `[1]`. That is the configuration answer: two bits, and they are not independent.

(For orientation in the same 60h word: bit 9 is `VGIF`, bit 25 is `VGIF_EN`, bit 26 is `V_NMI_ENABLE`, bit 30 is x2AVIC Mode Enable and bit 31 is AVIC Enable; `02-vmcb.md` §2.7 notes that **bit 10 has no row in Table B-1**, sitting between `VGIF` (9) and `V_NMI` (11) — an open item the skill records rather than filling in.)

**What changes once it is on.** The **NMI intercept applies to *physical* NMIs only, not to virtual ones** `[APM2 §15.21.10]` `[1]`. So the hypervisor keeps trapping real NMIs (which is why the intercept is mandatory) while the guest's own virtual-NMI state machine runs in hardware.

**The delivery condition — three terms, and note what is *not* in the list.** The processor takes a virtual NMI when: **virtual NMIs are not masked**, **virtual interrupts are enabled with `VGIF`**, and **the processor is not in an interrupt shadow** `[APM2 §15.21.10]` `[1]`. There is no `EFLAGS.IF` term and no `V_TPR` priority comparison — unlike the virtual-INTR condition, which requires a pending interrupt of priority strictly greater than `V_TPR`, `EFLAGS.IF` set, `VGIF`, and no interrupt shadow `[APM2 §15.21.4]` `[1]`. NMI is correctly not maskable by IF or TPR.

**The masking state machine, in order** `[APM2 §15.21.10]` `[1]`:
1. On recognition, the processor **clears `V_NMI` and sets `V_NMI_MASK` *before* the IDT is accessed**.
2. **`V_NMI_MASK` is cleared when the guest completes an `IRET`** — the ordinary x86 NMI-unblocking rule, now handled in hardware rather than by the hypervisor intercepting IRET.
3. **`V_NMI_MASK` is also cleared when a `#VMEXIT` occurs while the virtual NMI is being delivered** — in that case `EXITINTINFO` is set appropriately and **`V_NMI_MASK` is saved as 0**, so that when the hypervisor re-injects from `EXITINTINFO` the NMI is not spuriously treated as already blocked. (`EXITINTINFO`'s layout is owned by `05-exit-decoding.md`; `TYPE = 2` is NMI, and `VECTOR` is ignored for that type.)

**Priority.** **Physical NMI takes priority over virtual NMI**, mirroring the INTR rule (physical interrupts take priority over virtual ones, whether taken directly or through a `#VMEXIT`) `[APM2 §15.21.10]` `[APM2 §15.21.4]` `[1]`.

**Interaction with `EVENTINJ`.** When NMI Virtualization is enabled and `EVENTINJ` is used to inject an NMI, **VMRUN sets `V_NMI_MASK` in the guest state** — so the injected NMI **participates in the virtualized masking state machine rather than bypassing it** `[APM2 §15.21.10]` `[1]`. That is the difference from the non-virtualized case, where an injected NMI does **not** block delivery of further NMIs `[APM2 §15.20]` `[1]`.

**Interaction with GIF.** With the real GIF = 0, NMI is **held pending** until GIF becomes 1 (not discarded) `[APM2 Table 15-10]` `[1]`; and virtual NMI delivery additionally requires **`VGIF`** as listed above. So a guest running with vGIF and virtual NMIs has two separate gates — `VGIF` for the virtual path, the real GIF for the physical one.

**Confidence:** high — all `C:high` `V:durable`. Note the skill records the offset-60h **bit 10 gap** as an open item; I have not filled it.

---

### io-page-table-walk
**Routed to:** `09-iommu-page-tables.md` §9.1 "Host I/O page tables (v1)" — correct route (SKILL.md §Routing row "I/O page tables, GCR3, commands, ACPI IVRS, decoding an `IO_PAGE_FAULT` → `09-iommu-page-tables.md`")

**Answer:**
**The shape, and the two things the CPU does not have.** The host (v1) format is a generalisation of AMD64 long-mode paging with **two additions the processor does not have**: a **level field in every directory entry**, which lets a walk **skip levels**, and a **page-size override in the translation entry**, which lets one entry describe a page that is **not a power-of-512 multiple of 4 Kbytes** `[IOMMU 3.11 §2.2.3]` `[7]`. The tables are a multi-level tree of **4-Kbyte tables indexed by 9 virtual-address bits per level, holding 8-byte entries** `[IOMMU 3.11 §2.2.3]` `[7]`.

**Entry typing has no type bit.** An entry is a **page translation entry (PTE) when its Next Level field is `0h` or `7h`**, and a **page directory entry (PDE) for every other Next Level value** `[IOMMU 3.11 §2.2.3]` `[7]`. `NextLevel` sits at **bits 11:9**; `PR` (present) is **bit 0**; when `PR = 0` the remaining 63 bits are **ignored** `[IOMMU 3.11 Table 16]` `[7]`. A PTE carries `IW`(62), `IR`(61), `FC`(60), `U`(59), Page Migration State(58:57), Page Address(51:12), `D`(6), `A`(5); a PDE carries `IW`(62), `IR`(61), Next Table Address(51:12), `A`(5), with 60:52 reserved `[IOMMU 3.11 Table 16]` `[7]`.

**The walk, in order** `[IOMMU 3.11 §2.2.3]` `[7]`:
1. **Start by comparing the device virtual address against the root table's level.** A **non-zero bit above the range that level selects terminates the walk with an `IO_PAGE_FAULT`** — and so does a **non-zero bit in any virtual-address range belonging to a *skipped* level**. This is the price of level skipping: the skipped bits must be zero.
2. **Index the table with that level's 9 address bits** (7 bits, 63:57, at level 6) and read the 8-byte entry.
3. **Classify by `NextLevel`**: `0h`/`7h` → this is a PTE, terminate on a page; anything else → PDE, descend to the level named by `NextLevel`, which may be **lower than current−1** (that is the skip).
4. **Accumulate permissions.** `IW`(62) and `IR`(61) are **ANDed cumulatively down the walk together with the Device Table entry's own `IW`/`IR`**, and the `IW`/`IR` of any **skipped level are treated as 1** `[IOMMU 3.11 Table 17]` `[7]`.
5. **Terminate on the translation entry**, taking the page offset from the low address bits that the resulting page size implies.

**What terminates a walk with `IO_PAGE_FAULT`** `[IOMMU 3.11 §2.2.3]` `[IOMMU 3.11 Table 18]` `[7]`: a non-zero bit above the root level's range; a non-zero bit in a skipped level's range; a **non-zero reserved bit in any entry**; a **Next Level field greater than or equal to the current table's level**; a translation entry whose **physical address is not aligned to the page size that level implies**; a PDE **Next Level exceeding the device's `DTE[Mode]`**; and a Next Level exceeding the bound set by **`EFR[HATS]`**.

**Levels and default page sizes** `[IOMMU 3.11 Table 15]` `[7]`:

| Level | VA bits indexing the table | Default page size of a translation entry at that level |
|---|---|---|
| 6 | 63:57 | — |
| 5 | 56:48 | 2^48 |
| 4 | 47:39 | 2^39 |
| 3 | 38:30 | 2^30 (1 Gbyte) |
| 2 | 29:21 | 2^21 (2 Mbytes) |
| 1 | 20:12 | 4096 |

**How to get a page size other than the level default — the direct answer.** **Set `NextLevel = 7h` in a translation entry.** The page size is then determined by **the position of the first zero bit in the page address starting from bit 12**, and the resulting size **must be larger than the level's default and smaller than the default of the next higher level** `[IOMMU 3.11 §2.2.3]` `[7]`. Address bits **51:32 can encode page sizes above 4 Gbytes**, bits 63:52 are zero-extended, and two extremes are called out: a level-6 entry with page address `7_FFFFh` covers the **entire cache**, while `F_FFFFh` is **undefined** `[IOMMU 3.11 Table 14]` `[7]`.

**The cost of the override — replication.** An oversize page **requires the PTE to be replicated**: the low virtual-address bits that now index *inside* the enlarged page can no longer uniquely index the page table, so **for a 32-Kbyte page the level-1 PTE must be repeated 8 times, leaving 64 unique PTEs in a 4-Kbyte table** `[IOMMU 3.11 §2.2.3]` `[7]`. That is the practical constraint on using the feature.

**Caching and coexistence.** AMD **strongly recommends, but does not require**, that an implementation cache at least 4-Kbyte translations, and permits larger pages to be cached by **splitting them into several 4-Kbyte cache entries** `[IOMMU 3.11 §2.2.3]` `[7]`. Because the IOMMU's Next Level fields occupy bit positions the **processor ignores**, **one set of AMD64 long-mode tables can serve both the CPU and the IOMMU**, provided those fields are initialised for each entry's level — the processor has no level-skipping facility of its own `[IOMMU 3.11 §2.2.3]` `[7][1]`.

**Address width.** The IOMMU **zero-fills high-order physical address bits**: the architecture produces at most a **52-bit system physical address**, so SPA bits 63:53 are always zero `[IOMMU 3.11 §2.2.3]` `[7]`.

**Worked example AMD gives:** a level-4 root whose level-3 index is zero points **straight at a level-2 table** (PDE Next Level = 2h), and a level-2 entry with **Next Level = 0h** terminates on a **2-Mbyte page** with the low 21 address bits as the offset `[IOMMU 3.11 Figure 11]` `[7]`.

**Side effects on the way down.** `A`(5) is set by the IOMMU on first read or write **only when `EFR[HDSup] = 1` and `DTE[HAD]` is 01b or 11b**; `D`(6) is set on first write **only when `EFR[HDSup] = 1` and `DTE[HAD] = 11b`**. **Neither bit is ever cleared by the IOMMU** `[IOMMU 3.11 Table 17]` `[7]`. `FC`(60) decides the source of the upstream coherent attribute for an untranslated DMA `[IOMMU 3.11 Table 17]` `[7]`.

**Confidence:** high — all `C:high` `V:durable`.

---

### gcr3-pasid-translation
**Routed to:** `09-iommu-page-tables.md` §9.2 "Guest I/O page tables (v2) and GCR3" — correct route (SKILL.md §Routing row names "GCR3" under `09-iommu-page-tables.md`)

**Answer:**
**The frame.** Guest translation adds a second dimension. A request arriving **with a valid PASID** is translated **GVA → GPA through ordinary AMD64 long-mode page tables owned by the guest**, and **every guest-physical address produced along the way — including the table pointers themselves — is then translated GPA → SPA through the v1 host tables of §9.1** `[IOMMU 3.11 §2.2.6.5]` `[7][1]`. The IOMMU interprets PML5E, PML4E, PDPE, PDE and PTE **exactly as the processor does** (processor-side definition is `[APM2 §5.3]`/`[APM2 §5.4.1]`, not restated there).

**Enabling it.** Guest address translation exists **only when `EFR[GTSup] = 1`**, is armed **globally by `Control[GTEn]`** and **per device by `DTE[GV]`**, and the depth of the GCR3 lookup is set by **`DTE[GLX]` within the limit `EFR[GLXSup]`** `[IOMMU 3.11 Table 24]` `[7]` (DTE fields owned by `08-iommu-architecture.md`).

**How a PASID becomes a guest CR3 — the lookup, level by level.** The **GCR3 table is the PASID-indexed array that turns a PASID into a guest page-table root** `[IOMMU 3.11 §2.2.6.3]` `[7]`:

- **`DTE[GLX] = 00b` — one level.** A single naturally aligned **4-Kbyte page holding 512 eight-byte entries, indexed by `PASID[8:0]`**. The IOMMU **ignores the upper PASID bits**.
- **`DTE[GLX] = 01b` — two levels.** The DTE points at a **GCR3 level-2 table indexed by `PASID[17:9]`**, whose entries point at level-1 tables (themselves indexed by `PASID[8:0]`).
- **`DTE[GLX] = 10b` — three levels.** The DTE points at a **level-3 table indexed by `PASID[19:18]`**, structurally identical to the level-2 table; the IOMMU **ignores the unused remainder of that level-3 table**.

**The leaf: the GCR3 base pointer entry.** `V`(0) · Reserved(2:1) · **Ignored(4:3) — where the processor's PCD and PWT live, and which the IOMMU ignores** · Reserved(11:5) · **Guest Page Table Pointer[51:12]** · Reserved(63:52). **When `V = 0` the whole entry is ignored by hardware** `[IOMMU 3.11 Table 26]` `[7]`. That Guest Page Table Pointer is the guest CR3 the walk then uses.

**The recursion that is easy to miss.** **Every GCR3 base pointer in a level-1 table, and every table pointer in a level-2 or level-3 table, is a *guest physical address* that the IOMMU must itself translate through the host tables** `[IOMMU 3.11 §2.2.6.3]` `[7]`. And the **root** of the whole GCR3 structure is mode-dependent: the GCR3 table root pointer inside the DTE is a **system physical address when `Control[GCR3TRPMode] = 0`**, and a **guest physical address translated through the host tables named by `DTE[Host Page Table Root Pointer]` when it is 1**; support is `EFR2[GCR3TRPModeSup]` `[IOMMU 3.11 §2.2.6.3]` `[7]`.

**How wide a PASID it can actually translate — the direct answer.** The maximum translatable PASID width **follows from `GLX`**: **9 bits with a one-level table, 18 with two levels, 20 with three** `[IOMMU 3.11 Table 11]` `[7]`. Separately, **`EFR[PASmax]` bounds what the IOMMU can handle internally**, and **the two limits must both be satisfied** `[IOMMU 3.11 Table 11]` `[7]`. So the honest answer is a minimum of the configured GLX depth (9/18/20) and `PASmax` — **20 bits is the architectural ceiling** from the GCR3 side, matching the PCIe PASID width, and you do not get it unless you build a three-level table.

**Guest address size.** Capped by **`EFR[GATS]`**, and exceeding it generates an `IO_PAGE_FAULT`; with **`GATS = 01b`** the start level is chosen per device by **`DTE[GuestPagingMode]`**, and a **level-5 guest table is indexed by GVA bits 56:48** to select the PML5E `[IOMMU 3.11 §2.2.6.4]` `[7]`.

**The four operating combinations** `[IOMMU 3.11 §2.2.7.1]` `[7]`: `V=0` (no translation or checking at all; ATS and PRI requests fail) · `V=1, GV=0` (GPA→SPA only, with skip-levels, large pages and access control) · `V=1, GV=1, Mode=0` (GVA→GPA with the nested stage in pass-through, so GPA equals SPA) · `V=1, GV=1` with both table sets programmed (**full GVA→SPA**).

**Permission combining across the two dimensions.** Read and write permission for a guest translation is the **AND of the guest page-table permission, the nested (host) page-table permission and the DTE's `IR`/`IW` bit**. **Executable (NX) and user/supervisor permission are ignored whenever the peripheral supplies a GPA or an SPA rather than a GVA** `[IOMMU 3.11 §2.2.7.2]` `[7]`. NX enforcement requires **`EFR[NXSup] = 1`** and applies to a request whose PCIe TLP PASID prefix carries **EXE**; supervisor-page enforcement requires **`EFR[USSup] = 1`** and is governed by **`Control[PrivAbrtEn]`**, which either honours the prefix's **PMR** bit (00b) or blocks every user access regardless (01b) `[IOMMU 3.11 §2.2.6.2]` `[7][53]`.

**Invalidation rules — asymmetric, and the asymmetry is the useful part.** **IOMMU TLBs are *not* cleared when a GCR3 table entry changes; software must issue an invalidation command** `[IOMMU 3.11 §2.2.6.3]` `[7]`. For the guest tables, because the IOMMU must **rewalk the guest tables whenever cached information says "denied"**, software is **not required to invalidate when it *promotes* guest privileges or makes a not-present guest page present**, but **is** required to invalidate when it **demotes privileges or unmaps a page** `[IOMMU 3.11 §2.2.7.3]` `[7]`.

**Two more behaviours.** When the IOMMU updates **Accessed and Dirty bits in guest descriptors** it uses **processor-compatible interlocked 64-bit naturally aligned operations**, and **re-reads the descriptor inside the atomic region** so it can drop the update if another agent already made it `[IOMMU 3.11 §2.2.7.4]` `[7]`. The **AMD64 memory-type (PAT) bits in guest page tables are ignored by the IOMMU** when it is outside the coherence domain `[IOMMU 3.11 §2.2.7.3]` `[7]`. And **several GCR3 entries may point at the same guest page table**, which is how a peripheral shares one guest address space between its default-PASID and non-zero-PASID traffic under Guest I/O Protection `[IOMMU 3.11 §2.2.9]` `[7]`.

**Confidence:** high — all `C:high` `V:durable`.

---

### msi-remapping-end-to-end
**Routed to:** `10-iommu-interrupt-remapping.md` §10.4 "Remapping an MSI, end to end", with §10.3 (DTE interrupt cluster) and §10.2 (the `GuestMode=1` IRTE) in the same chapter — correct route (SKILL.md §Routing row "IRTE formats, the DTE interrupt cluster, MSI remapping, GA log semantics, GAPPI → `10-iommu-interrupt-remapping.md`"; `00-quickref.md` §0.2 routes "A passthrough device's interrupts never arrive" to `10` §10.4). `errata.md` **E03** checked — the bit-0 field is **`RemapEn`**, not `RemapEm`.

**Answer:**

**Step 0 — the interrupt address range bypasses address translation.** Accesses to the interrupt address range go through the **interrupt remapping portion** of the IOMMU and **not through address translation**, so a transaction processed as an interrupt has its pretranslated/untranslated attribute **ignored** `[IOMMU 3.11 §2.1.4.2]` `[7]`. The range is **`FD_F800_0000h`–`FD_F8FF_FFFFh`** (Interrupt/EOI), controlled by `IntCtl` and the interrupt remapping tables; the adjacent **`FD_0000_0000h`–`FD_F7FF_FFFFh`** is reserved interrupt address space and a request there produces an **`INVALID_DEVICE_REQUEST`** event `[IOMMU 3.11 Table 3]` `[7]`. Software should not configure the IOMMU such that an address translation can **produce** a special address such as the interrupt range `[IOMMU 3.11 §2.1.4.2]` `[7]`.

**Step 1 — the message type decides which control applies.** With destination mode `DM = 0` and `MMIO Offset 01A0h[NumIntRemapSup]` of 00b or 01b, the HyperTransport message-type field routes the request to exactly one control `[IOMMU 3.11 Table 19]` `[7]`: **MT 0 (Fixed) and 1 (Arbitrated) → the device table entry and the IRTE**; MT 2 → `MMIO Offset 0018h[SmiFLogEn]`; MT 3, 4, 6 → `NMIPass`; MT 5 → `InitPass`; MT 7 → `EIntPass`; MT 11 → `Lint1Pass`; MT 14 → `Lint0Pass`; MT 8, 9, 10, 12, 13, 15 → **target abort**. With `DM = 1` **only MT 0–1 reach the remapping tables**, unless `NumIntRemapSup = 01b` and `MMIO 0018h[NumIntRemapMode] = 01b`, in which case MT 0–7 do and MT 8–15 are target aborted (`NumIntRemapSup` 10b–11b is reserved). The remapped path supports **up to 512 interrupts per function** in every configuration except `NumIntRemapSup = 01b` with `NumIntRemapMode = 01b` and `DM = 1`, which supports **up to 2K** `[IOMMU 3.11 Table 19]` `[7]`. (Earlier revisions defined types 0010b–1111b with `DM=1` as remappable rather than target aborted; AMD says no systems are known to rely on that — `C:medium`.)

**Step 1b — the DTE interrupt cluster gates everything.** Bits **191:128** of the 256-bit DTE are the interrupt half, independent of the translation half `[IOMMU 3.11 Figure 7]` `[7]`: `Lint1Pass` 191 · `Lint0Pass` 190 · **`IntCtl` 189:188** · `NMIPass` 186 · `EIntPass` 185 · `InitPass` 184 · **Interrupt Table Root Pointer[51:6] at 179:134** (SPA, **128-byte aligned**) · **`IG` 133** · **`IntTabLen` 132:129** · **`IV` 128**. With **`IV = 0` all interrupts are forwarded without remapping**; with `IV = 1`, **`IntCtl` 00b = target abort, 01b = forwarded unmapped, 10b = remapped, 11b = reserved/undefined** (11b reported as an event when `IV=1`) `[IOMMU 3.11 Table 7]` `[IOMMU 3.11 Table 9]` `[7]`. The root pointer **is used only when `IntCtl = 10b`** `[IOMMU 3.11 Table 7]` `[7]`. `IntTabLen` encodes entries as a **power of two** — 0000b = 1, 0001b = 2, … 1010b = 1024, 1011b = 2048; **11xxb is reserved** and reported as an event when `IV=1` `[IOMMU 3.11 Table 7]` `[7]`.

**Step 2 — index, read, rewrite.** The interrupt table offset comes from the concatenation of Figure 14 and **corresponds directly to data bits 10:0 of the originating MSI message**, so **the IRTE index is `MSI Data[10:0]`**; hardware applies the stride for the 32-bit or 128-bit entry size selected by the registers `[IOMMU 3.11 §2.2.5]` `[7]`. After reading the entry, the IOMMU builds the new interrupt message address by **OR-ing `IRTE[23:2]` with bits 63:2 of the HyperTransport interrupt address range base `FFFF_FFFD_F800_0000h`** `[IOMMU 3.11 §2.2.5]` `[7]`.

**Step 3 — with the guest virtual APIC enabled, the full sequence** `[IOMMU 3.11 §2.2.5.2]` `[7]`:
1. **Check `GASup`/`GAMSup`** (`MMIO 0030h`) **and `GAEn`/`GAMEn`** (`MMIO 0018h`). `GASup=1`, `GAMSup=000b`, `GAEn=1` gives the **wide remapping entry**; `GASup=1`, `GAMSup=001b`, `GAEn=1`, `GAMEn=001b` additionally gives the **virtualized entry** `[IOMMU 3.11 Table 21]` `[7]`. Every IOMMU in the system must use the **same IRTE size** — i.e. the same `GAEn`/`GAMEn` values.
2. **Pick the IRTE size and stride.** If 32-bit, fall back to the basic path.
3. **Select the device table entry for that `DeviceID`.**
4. **Index the IRTE with the incoming vector.**
5. **If `RemapEn = 0` → report an `IO_PAGE_FAULT`** (the interrupt is target aborted; hardware ignores the whole entry except `SupIOPF`).
6. **If `GuestMode = 0` → remap** as in the basic path, using the wide layout.
7. **If `GuestMode = 1` → post the interrupt into the guest.**

**Step 4 — posting into the guest.** Using the `GuestMode = 1` IRTE `[IOMMU 3.11 Table 23]` `[7]` — root pointer **115:76** (`Guest Virtual APIC Table Root Pointer`, the SPA of the APIC backing page), **`Vector` 71:64**, **`GATag` 63:32**, **`Destination[7:0]` 15:8**, `GuestMode` 7, **`IsRun` 6**, `GAPPIDis` 5, `GALogIntr` 2, `SupIOPF` 1, `RemapEn` 0 — the IOMMU computes `[IOMMU 3.11 §2.2.5.2]` `[7]`:
- **bit index = `IRTE[Vector] mod 32`**
- **byte offset = `(IRTE[Vector] / 32) << 4`**
- **atomic set of one bit at `IRTE[GuestVirtualAPICTableRootPointer] + 0200h + byte offset`** — i.e. directly into the vAPIC backing page's IRR.

Hardware may widen that read-modify-write: the atomic OR may use **any power-of-two byte width from 1 to 32 bytes**, not exceeding **256 bits**, with the divisor scaled accordingly `[IOMMU 3.11 §2.2.5.2]` `[7]`.

**Step 5 — waking the vCPU.** **After setting the IRR bit the IOMMU re-reads the IRTE** `[IOMMU 3.11 §2.2.5.2]` `[7]`:
- **`IsRun = 1`** → it **sends a guest APIC doorbell to the core named by `Destination`**, taken from the same memory read as `IsRun`.
- **`IsRun = 0` and `GALogIntr = 1`** → it **writes a GA log entry carrying `GATag` and signals an interrupt** (or, with GAPPI, raises a GAPPI interrupt instead — see the next answer).

**Step 6 — the CPU side.** The doorbell tells the physical core that the backing page changed. On the CPU side `[APM2 §15.29.6.2]` `[APM2 §15.29.8.2]` `[1]`: the device ID yields the target guest physical APIC ID; that ID indexes the **Physical APIC ID Table** to find the backing page's SPA; any required vector translation is applied; the **IRR bit is set atomically**; and the doorbell is sent using the **Host Physical APIC ID** from the table entry **if `IsRunning` is set**. **VMRUN re-evaluates the backing page on guest entry** and delivers the highest-priority pending IRR interrupt if masking and priority allow; a doorbell received during VMRUN processing is recognized immediately after entering the guest `[APM2 §15.29.8.3]` `[1]`. If the I/O virtualization hardware reads a Physical APIC ID Table entry whose **`V` bit is clear it aborts the delivery and logs an error**; if the vCPU is merely not running, the interrupt is **presented when that vCPU is made active again** `[APM2 §15.29.6.2]` `[1]`. The Physical APIC ID Table is therefore **written by the VMM and read by both the core and the IOMMU**, which is why `IR` must be maintained **on every vCPU schedule and unschedule** `[APM2 §15.29.6.2]` `[1]`.

**Why this is a security boundary.** An interrupt is a **posted write**, so a peripheral able to emit an arbitrary write to the interrupt address range can name an arbitrary vector on an arbitrary CPU unless something checks it — and **the page tables are explicitly not in that path**. **Interrupt remapping is the only check on the interrupt path**: `IV=1` with `IntCtl=01b` forwards fixed/arbitrated interrupts unmapped, `IntCtl=00b` target-aborts them, and **only `IntCtl=10b` validates them against a per-device table software controls** `[IOMMU 3.11 Table 9]` `[7]`. **`RemapEn = 0` is the per-vector deny** — target abort plus `IO_PAGE_FAULT` — which is why **a correctly sized table with most entries disabled is the safe default rather than a short table** `[IOMMU 3.11 §2.2.5.2]` `[7]`.

**Cache and update discipline.** With `GAEn=1` and `GuestMode=1` the IOMMU **does not cache `IsRun`, `Destination`, `GALogIntr`, `GAPPIDis` or `GATag`**, so changing any of them **needs no invalidation** `[IOMMU 3.11 §2.2.5.2]` `[7]`. To change the entry: if `RemapEn` was 0, changes may be made in any order provided **the last one sets `RemapEn = 1`**; if `RemapEn` was already 1, **update atomically and then invalidate the interrupt remapping table** if any cacheable field changed `[IOMMU 3.11 §2.3.2]` `[7]`. `INVALIDATE_INTERRUPT_TABLE` (command **05h**) invalidates all cached interrupt information for one device, **including the guest virtual APIC table base pointer if cached** `[IOMMU 3.11 §2.4.5]` `[IOMMU 3.11 Figure 48]` `[7]`.

**x2APIC widening.** With `MMIO 0x30[XTSup]=1`, software sets `MMIO 0x18[XTEn]=1` **and `GAEn=1`** (even when the guest vAPIC will not be used, in which case every IRTE should carry `GuestMode=0`), giving a 128-bit IRTE with a **32-bit destination split as `Destination[31:24]` at bits 127:120 and `Destination[23:0]` at bits 31:8** `[IOMMU 3.11 §2.2.5.3]` `[IOMMU 3.11 Figure 20]` `[7]`.

**SNP changes the enable, not the layout.** On an SNP-enabled system guest vAPIC support is reported by **`MMIO 01A0h[SNPAVICSup]`** and enabled by **`MMIO 0018h[SNPAVICEn]`** instead of `GAMSup`/`GAMEn`; and **interrupts from devices mapped to an SNP guest must be remapped through the interrupt remapping table and delivered via the hypervisor** `[IOMMU 3.11 §2.12.3]` `[IOMMU 3.11 §2.2.5.2]` `[7]`.

**Confidence:** high — all `C:high` `V:durable`, except the note about earlier-revision behaviour of MT 0010b–1111b, which is `C:medium`, and the DMA-attack corroboration in the same section, which is `C:medium` and cited `[no-spec]` `[310]`.

---

### ga-log-and-gappi
**Routed to:** `10-iommu-interrupt-remapping.md` §10.5 "The GA log and guest vAPIC wake-up" and §10.5 "GAPPI: skipping the log entirely" — correct route (SKILL.md §Routing row names "GA log semantics, GAPPI" under `10`). The chapter explicitly holds the GA log **as a signal** while `08-iommu-architecture.md` holds it **as a data structure** (entry format, base register, head/tail pointers); I did not need `08` because the question asks what it *tells* the hypervisor, and `10` states that and says where the format lives.

**Answer:**
**The problem it exists to solve.** The `IsRun = 1` path needs no software at all — the IOMMU sets the IRR bit and rings the doorbell. **The `IsRun = 0` path is the interesting one: the interrupt is already recorded in the guest's virtual IRR, but nothing will consume it until the hypervisor schedules that vCPU.** The specification defines **two ways to tell the hypervisor, and one way to tell it nothing at all** `[IOMMU 3.11 §2.7.1]` `[7]`:
1. `GALogIntr = 0` and no GAPPI — the IRR bit is set and **the hypervisor is not notified**.
2. `GALogIntr = 1` — **a GA log entry naming the device and the `GATag`, plus an MSI**.
3. **GAPPI** — no log entry, **a direct interrupt to a physical core instead**.

**What the GA log actually tells the hypervisor.** It is a **circular buffer in system physical memory holding virtual interrupt requests that could not be delivered because the target virtual processor was not running**; each entry identifies **the source by `DeviceID`** and **the target by the `GATag`** software put in the IRTE `[IOMMU 3.11 §2.7.1]` `[7]`. Crucially:

- The one defined record type carries the **32-bit `GATag` that software itself wrote into the IRTE**, so **the tag is the hypervisor's own handle for the target virtual processor: the IOMMU never interprets it, it only copies it back** — which is what lets a hypervisor pick **any encoding it likes for vCPU identity** `[IOMMU 3.11 §2.7.3]` `[7]`.
- The record is written when the IOMMU receives an interrupt for a device whose entry has **`GuestMode = 1`** and whose **`IsRun` indicates the guest is not currently running**; **the interrupt itself is still recorded in the virtual APIC backing page**, so the log entry is **a notification that a pending interrupt needs the hypervisor to schedule the target — not a record of a lost interrupt** `[IOMMU 3.11 §2.7.3]` `[7]`. That is the single most important semantic point: the GA log is a **scheduling hint**, not a delivery mechanism, and never a dropped-interrupt report.

So the hypervisor's correct reaction to a GA log entry is: **look up `GATag` → find the vCPU → schedule it**. The interrupt is already in its IRR and VMRUN will re-evaluate the backing page on entry `[APM2 §15.29.8.3]` `[1]`.

**The failure mode that changes how you debug.** **GA log overflow does not drop one entry and carry on — it stops the log**: the overflow status bit is set, **subsequent guest virtual APIC event data is discarded**, and **logging stays disabled until software runs the restart procedure**. A hypervisor that does not handle overflow therefore **stops being told about *any* undelivered guest interrupt, not merely the one that overflowed** `[IOMMU 3.11 §2.7.1]` `[7]`. (The sizing register, head/tail pointers and their in-memory shadow, the shift-by-three full/empty arithmetic, overflow behaviour and the restart procedure are register-level mechanics owned by `08-iommu-architecture.md` §8.8 and the MMIO map; the entry layout is Figures 78/79 and Table 76 there.)

**What GAPPI changes.** When **`MMIO Offset 0030h[GAPPISup] = 1`** and **`MMIO Offset 0018h[GAPPIEn] = 1`** `[IOMMU 3.11 §2.2.5.4]` `[7]`:
- Guest interrupts to non-running guests **still update the vAPIC backing page IRR** — that part is unchanged.
- The **GA log write is suppressed for `IsRun = 0` when `GALogIntr = 0`**.
- Instead, **a GAPPI interrupt is raised when all of the guest IRR bits were clear before the last update** — i.e. **only when the new interrupt is the first one pending to that vCPU**. This is the real change: the log's one-entry-per-interrupt stream becomes **one interrupt per transition from "nothing pending" to "something pending"**, which is exactly the edge the hypervisor needs for scheduling.

**How the GAPPI interrupt is formed.** With **`Destination = IRTE[Destination]`, `Vector = IRTE[GATag[7:0]]`, message type 0, destination mode 0 and `RQEOI = 0`** `[IOMMU 3.11 §2.2.5.4]` `[7]`. Note the vector is **taken from the low byte of `GATag`** — which is why, as the chapter says, **`GATag` must be allocated with GAPPI in mind even on systems that intend to use the log**.

**Two caveats.**
- **Spurious GAPPIs are architectural:** AMD states that implementations **may not be able to determine perfectly whether all IRR bits were previously clear**, so spurious GAPPI interrupts may occur and **software must tolerate them** `[IOMMU 3.11 §2.2.5.4]` `[7]`.
- **Per-vector opt-out:** `MMIO Offset 01A0h[GAPPIDisSup] = 1` together with **`IRTE[GAPPIDis] = 1`** suppresses the GAPPI interrupt **while still updating the backing-page IRR** — a per-vector opt-out rather than a per-IOMMU one `[IOMMU 3.11 §2.2.5.4]` `[7]`. `GAPPIDis` (IRTE bit 5) is meaningful **only when `GuestMode = 1` and `GAPPIEn = 1`**, and is reserved when `GAPPIDisSup = 0` `[IOMMU 3.11 Table 23]` `[7]`.

**Net practical consequence, as the chapter states it:** GAPPI **replaces a memory write plus a log-consuming MSI handler with a single interrupt** whose vector is carried in the low byte of `GATag`.

**Confidence:** high — all `C:high` `V:durable`.

---

### c-bit-mechanics
**Routed to:** `11-memory-encryption.md` §11.3 "The C-bit" (with §11.3.1, §11.3.2) and §11.4 "Cache coherence when the C-bit changes" (with §11.4.1) — correct route (SKILL.md §Routing row "SME, TSME, the C-bit, `Fn8000_001F`, SYSCFG, AMD-SP → `11-memory-encryption.md`"; the chapter `Owns:` "the C-bit and its cache-coherence flush rule")

**Answer:**
**What it is, and where it is.** The C-bit ("enCrypted bit") is the **page-table attribute that selects encryption for a page**. Its position is **implementation-specific** and **must be read from `Fn8000_001F_EBX[5:0]`** — the APM's own worked example is address bit 47 `[APM2 §7.10.4]` `[1]`. **Setting it to 1 marks the page encrypted in DRAM; clearing it to 0 leaves the page unencrypted.** It may be applied to translation-table entries for **any page size — 4 KB, 2 MB or 1 GB** `[APM2 §7.10.4]` `[1]`. Note the primary anchor is **APM Vol.2 §7.10**, in the memory-system chapter, **not Ch.15**.

**It propagates down the page tables.** The page tables themselves may live in encrypted memory: **if the C-bit is set in a PML4 entry, the PDP table it points to — and therefore every PDPE in that table — is loaded from encrypted memory** `[APM2 §7.10.4]` `[1]`. One exception: in **legacy PAE mode**, if the C-bit location falls in the **upper 32 bits** of an entry, the **first-level (PDP) table cannot be located in encrypted memory**, because CR3 is only 32 bits wide in 32-bit PAE mode `[APM2 §7.10.6]` `[1]`.

**Physical-address bit reduction — the trap at enable time.** On some implementations the processor's **physical-address size is reduced when memory encryption features are enabled** (AMD's worked example: 48 → 43 bits), and the upper physical-address bits then become **reserved** except where otherwise indicated; the reduction present is reported in **`Fn8000_001F_EBX`** `[APM2 §7.10.1]` `[1]`. Bits that become reserved are treated **exactly like any other reserved page-table bit: a non-zero value in one during address translation generates a page fault** `[APM2 §7.10.1]` `[1]`. Consequently, **before setting `SYSCFG[MemEncryptionModEn]`, software on such an implementation must already be executing from addresses whose upper physical-address bits are 0**, or it will fault itself out of existence at the moment encryption is enabled `[APM2 §7.10.2]` `[1]`. (Per-generation `CbitPosition` and `PhysAddrReduction` values are version-bearing and belong to `90-dated-landscape.md`; what is durable is that they differ between parts and **must be read at runtime**.)

**The C-bit is not an address bit for range checks.** On implementations that reduce the physical-address size, memory range checks deciding memory type or DRAM-versus-MMIO — **MTRR, TOM, IORR and so on** — are performed using the **reduced** physical address size, and **the C-bit is not considered a physical address bit and is masked by hardware for those checks** `[APM2 §7.10.5]` `[1]`. **Any page corresponding to an MMIO address must be configured with the C-bit clear**; encrypted I/O pages are not allowed and **an access with the C-bit set is *ignored*** `[APM2 §7.10.5]` `[1]` — silent, not a fault. (DMA to SME-encrypted memory is supported and is, from the device's standpoint, an ordinary memory access with the C-bit set; devices that cannot generate that address bit are accommodated by using the IOMMU to remap device request addresses to addresses with the C-bit set. That DMA statement is **not** in §7.10.5 — the skill cites the **non-normative** memory-encryption white paper `[MEM-WP 70363 p.5]` `[MEM-WP 70363 p.6]` `[16]` and marks it **`C:medium`**.)

**Under SEV.** The guest's C-bit is **masked out of the guest physical address before the nested-page-table walk and reapplied to the resulting system physical address (sPA)** `[APM2 §15.34.6]` `[1]` — so the hypervisor's nested tables need not know which guest pages are private (`06-nested-paging.md` holds where the bit sits in a nested entry; `12-sev.md` the guest/host precedence rule).

**What you must do when you change it on a page — the direct answer, and it is three things.**

1. **Flush, unless hardware says otherwise.** In some hardware implementations **coherency between the encrypted and unencrypted mappings of the same physical page is *not* enforced**; on such a system software **must flush the page from *all* CPU caches in the system before changing the value of the C-bit for that page** `[APM2 §7.10.6]` `[1]`. The flush is **not** required when the implementation supports coherency across encryption domains, which is reported by **`Fn8000_001F_EAX[10]` (`HwEnfCacheCoh`)** `[APM2 §7.10.6]` `[1]`. So: test `EAX[10]`; if clear, flush system-wide first. Getting this wrong is **silent data corruption, not a fault**.

2. **Accept that the data does not follow.** **Changing the value of a C-bit on a page does *not* re-encrypt the page's existing contents; any data present before the modification becomes unintelligible afterwards** `[APM2 §7.10.6]` `[1]`.

3. **If you want to keep the data, run AMD's encrypt-in-place algorithm.** It exists because a line **cannot be copied in place** — the refill that precedes the write would decrypt garbage, and an eviction between the two halves of a naive copy corrupts the unwritten part. The algorithm `[APM2 §7.10.8]` `[1]`:
   1. Create **two linear mappings X and Y of the same physical page** — **X with C-bit 0 and the `WP` memory type**, **Y with C-bit 1 and the `WB` memory type**.
   2. Execute **`WBINVD` on all cores in the system**.
   3. **Copy N bytes from X to a temporary buffer** in conventionally-mapped memory, where **N equals the L1 cache line size reported by `Fn8000_0005[ECX]`**.
   4. **Write those N bytes from the temporary buffer to Y.**
   5. **Repeat steps 3–4** until the whole page has been copied.

   The copy **must** go through a temporary buffer rather than in place because **the initial cache refill of the line in step 4 decrypts it — corrupting it, since it is not yet encrypted — and step 4 is what restores the original contents** `[APM2 §7.10.8]` `[1]`.

**Under SEV the same problem recurs with a guest key involved**, and `WBINVD` on every core the guest ran on is expensive; AMD therefore adds the **`VMPAGE_FLUSH` MSR**, which belongs to `12-sev.md`.

**Confidence:** high for everything anchored to `[APM2 §7.10.x]` (all `C:high` `V:durable`). The DMA-to-encrypted-DRAM statement is the one item marked **`C:medium`** and is cited to the **non-normative** white paper pub 70363, because §7.10.5 covers MMIO and range checks but not that case. Separately, SKILL.md notes **TSME has no normative source** at all — not relevant to the C-bit mechanics above, but relevant if the question extends to TSME.

---

### ghcb-establishment
**Routed to:** `13-sev-es-ghcb.md` §13.3 "Establishing the GHCB" (§13.3.1 version negotiation, §13.3.2 GPA registration, §13.3.3 hypervisor feature advertisement), with §13.5 (the MSR protocol) and §13.2 (`#VC`) in the same chapter — correct route (SKILL.md §Routing row "SEV-ES: the VMSA, `#VC`, the GHCB layout, the MSR protocol, NAE events, VMGEXIT → `13-sev-es-ghcb.md`"). `errata.md` **E22** checked — VMGEXIT is **`F2/F3 0F 01 D9`**, both prefixes architectural.

**Answer:**
**Why there is a negotiation at all — the chicken-and-egg.** Before long mode or 32-bit PAE paging is established, **all guest memory accesses are forced to use the guest's encryption key**, so the hypervisor would only see **ciphertext** in the GHCB. A guest must therefore **avoid any unplanned NAE event until it has discovered the encryption-bit position and marked the GHCB shared** `[GHCB 2.04 §2.5]` `[9]`. That is the whole reason the MSR protocol exists: it is what a guest uses **when it cannot yet write the GHCB page in the clear** — during early boot, and for the small set of operations that must work without one.

**The channel: MSR `C001_0130h`, split in two.** The guest sets the GHCB's guest physical address through **MSR `C001_0130h`**; the value is saved and restored by hardware on VMRUN/`#VMEXIT` through **VMCB offset `0A0h`**, and the MSR **may be read or written only in guest mode — a host-mode access raises `#GP`** `[APM2 §15.35.7]` `[1]`. **The hypervisor must not intercept access to `C001_0130h`, or the guest cannot establish a GHCB at all** `[GHCB 2.04 §2.3]` `[9]`. Because the GHCB address is **4 KiB aligned**, the **low 12 bits are free**, and those 12 bits carry the **`GHCBInfo` request/response code**; **bits 63:12 are `GHCBData`** `[GHCB 2.04 §2.3]` `[9]`.

**The ordered sequence.**

1. **The hypervisor publishes SEV Information before the guest runs.** It writes the SEV Information value (`GHCBInfo = 0x001`) into **VMCB offset `0A0h`** so the guest finds it in the MSR at first read. In it: **`GHCBData[63:48]` = maximum GHCB protocol version supported, `GHCBData[47:32]` = minimum, `GHCBData[31:24]` = the SEV page-table encryption bit number**, which the hypervisor takes from **`CPUID Fn8000_001F EBX[5:0]`** `[GHCB 2.04 §2.3.1]` `[9]`. AMD's worked examples: `0x0001_0001_2f00_0001` for a hypervisor supporting only version 1 with encryption bit 47, and `0x0002_0001_3300_0001` for one supporting up to version 2 with encryption bit 51 `[GHCB 2.04 §2.4.1]` `[9]`.
2. **The guest reads it (or asks).** The guest can re-request it with **SEV Information Request, `GHCBInfo = 0x002`**, answered with `0x001` `[GHCB 2.04 Table 2]` `[9]`. From this it learns (a) the **C-bit position**, which it needs before it can mark anything shared, and (b) the **version range**. **A guest that cannot support any protocol version in the range the hypervisor advertises must request termination** `[GHCB 2.04 §2.4.1]` `[9]`. **An SEV-SNP guest should take the encryption-bit position from the firmware-validated CPUID page rather than from the SEV Information MSR value** — because the MSR value comes from the untrusted hypervisor `[GHCB 2.04 §2.4.2]` `[9]` (CPUID page owned by `14-sev-snp.md`).
3. **Optional: discover hypervisor features.** Version 2 introduced a hypervisor `FEATURES` bitmap, **deliberately limited to 52 bits so that it fits in `GHCBData[63:12]` and can therefore be returned *before any GHCB exists*** `[GHCB 2.04 §2.2]` `[9]`. Request `0x080`, response `0x081`. Nine bits are defined: **0 SEV-SNP · 1 SEV-SNP AP Creation · 2 SEV-SNP Restricted Injection · 3 SEV-SNP Restricted Injection Timer · 4 APIC ID List · 5 SEV-SNP Multi-VMPL · 6 SEV-ES Page State Change Support · 7 SEV-TIO Support · 8 GHCB Unregister Support** `[GHCB 2.04 Table 1]` `[9]`, with documented dependencies (AP Creation requires SEV-SNP; Restricted Injection requires SEV-SNP and AP Creation; the Restricted Injection Timer additionally requires Restricted Injection; Multi-VMPL requires SEV-SNP and AP Creation).
4. **The guest allocates a 4,096-byte page and maps it *decrypted*.** The GHCB is a **4,096-byte page the guest must map decrypted so both sides can reach it**; **hardware never accesses the GHCB directly**, and consequently **its format is defined by software rather than fixed by hardware** `[APM2 §15.35.7]` `[1][9]`. Its layout mirrors the SEV-ES VMSA save-state layout through offset `0x3ff`, but the two are allowed to diverge — the GHCB lists only the fields actually used, **which is what limits how much guest state is exposed** `[GHCB 2.04 Ch.2]` `[9]`. If the page was previously private, the guest changes its state with the **MSR-protocol Page State Change request `0x014`** (operation in `GHCBData[55:52]`: `0x0001` private, `0x0002` shared; GFN in `GHCBData[51:12]`; always a 4 KiB page), response `0x015` with an error code in `GHCBData[63:32]`, **non-zero meaning the change did not happen** `[GHCB 2.04 §2.3.1]` `[9]`.
5. **SEV-SNP only: register the GHCB GPA.** **GHCB GPA registration is supported and required only for SEV-SNP guests**: such a guest **must use the Register GHCB GPA MSR request (`0x012`, response `0x013`) to establish its GHCB GPA before using a GHCB for a VMGEXIT for the first time** `[GHCB 2.04 §2.3.2]` `[9]`. Optionally the guest first asks **Preferred GHCB GPA (`0x010`/`0x011`)**; the hypervisor answers with a GFN or with **`0xf_ffff_ffff_ffff` meaning "no preference"**, and if it supplies a GFN it **must guarantee the guest cannot otherwise map that address and must make the page hypervisor-owned**, while **the guest should verify the address lies outside its known memory range** `[GHCB 2.04 §2.3.2]` `[9]`. **Registering automatically unregisters any previously registered GPA, and a hypervisor *must terminate* a guest that presents a GHCB GPA not matching the currently registered value** `[GHCB 2.04 §2.3.2]` `[9]`. Unregistration is `0x018` (added in rev 2.04, gated by the GHCB Unregister Support feature bit), answered with the unregistered GFN, `0` if nothing was registered, or `0xf_ffff_ffff_ffff` on failure `[GHCB 2.04 §2.3.2]` `[9]`. With **Multi-VMPL**, a hypervisor advertising it **must allow each VMPL to register its own GHCB GPA** `[GHCB 2.04 §2.3.2]` `[9]`.
6. **The guest writes the GHCB GPA into `C001_0130h` with `GHCBInfo = 0x000`** (`GHCBInfo` code `0x000` is literally "GHCB Guest Physical Address", guest-source, all versions) `[GHCB 2.04 Table 2]` `[9]`. From this point ordinary `#VC` handling can use the page.
7. **Ordinary `#VC` operation begins.** `#VC` is **exception vector 29**, a **precise, contributory, fault-type** exception, **cannot be masked**, and is **always generated by hardware when an SEV-ES enabled guest is running and an NAE event occurs** `[APM2 §15.35.5]` `[1]`. **Its error code equals the `#VMEXIT` code of the causing event**, so the handler dispatches on an exit code it would otherwise never see `[APM2 §15.35.5]` `[1][9]`. The handler **inspects the error code, decides what register state to copy into the GHCB, executes VMGEXIT to create an AE, and — after the hypervisor's subsequent VMRUN — resumes at the instruction following VMGEXIT to copy results back; it leaves via IRET** `[GHCB 2.04 §3.2]` `[9]`. **It is inadvisable for the hypervisor to set the `#VC` intercept bit**, since that would prevent the guest handling NAEs at all, and it should likewise avoid intercepting events that occur inside the `#VC` handler, such as IRET `[APM2 §15.35.5]` `[1]`.

**Protocol hygiene the hypervisor must obey.** A guest may use **only codes documented as guest-source**; a hypervisor must treat any other value as an **invalid request and return to the guest *without modifying the MSR***, and must reply **only with hypervisor-source codes**, any other reply being invalid to the guest `[GHCB 2.04 §2.3.1]` `[9]`.

**What the MSR protocol can still do once a GHCB exists** (the full `GHCBInfo` set of rev 2.04) `[GHCB 2.04 Table 2]` `[9]`: `0x000` GHCB GPA (guest, all) · `0x001` SEV Information (HV, all) · `0x002` SEV Information Request (guest, all) · `0x004`/`0x005` CPUID Request/Response (all) · `0x006`/`0x007` AP Reset Hold (2+) · `0x010`/`0x011` Preferred GHCB GPA (2+) · `0x012`/`0x013` Register GHCB GPA (2+) · `0x014`/`0x015` Page State Change (2+) · `0x016`/`0x017` SNP Run VMPL (2+) · `0x018`/`0x019` Unregister GHCB GPA (2+) · `0x080`/`0x081` Hypervisor Feature Support (2+) · `0x100` Termination Request (guest, all). The **CPUID request** carries the function in `GHCBData[63:32]` and a **register selector in `GHCBData[31:30]`** (`0b00` EAX, `0b01` EBX, `0b10` ECX, `0b11` EDX), returning **one register per invocation**, so several VMGEXITs are needed for a whole leaf; it **does not support non-zero sub-leaves**, and **function `0x0000_000D` is explicitly unsupported** because it depends on XCR0 `[GHCB 2.04 §2.3.1]` `[9]`. **Termination** (`0x100`) puts the reason-code *set* in `GHCBData[15:12]` and the reason code in `GHCBData[23:16]`; AMD owns set `0x0` with `0x00` general, **`0x01` GHCB protocol range not supported**, `0x02` SEV-SNP features not supported — and **after a termination request the guest should execute an HLT loop or SHUTDOWN as a safeguard in case the hypervisor does not comply** `[GHCB 2.04 §2.3.1]` `[9]`.

**Confidence:** high — all `C:high` `V:durable`. Scope caveat the chapter states: SEV-ES is **server scope** (productised on EPYC; Zen 4 and later client parts expose SME only, and SEV-SNP has never shipped on a client part).

---

### rmp-page-states
**Routed to:** `14-sev-snp.md` §14.3 "Page states and transitions", with §14.1 "Entry contents" for the defining fields — correct route (SKILL.md §Routing row "SEV-SNP: the RMP, page states, VMPL, the SNP instructions, attestation … → `14-sev-snp.md`"). Both sections are in the one chapter.

**Answer:**
**What determines the state.** **A page's state is completely determined by the `Assigned`, `Validated`, `ASID`, `Immutable`, `GPA` and `VMSA` fields of its RMP entry** `[SNP-ABI 1.59 §5.3]` `[10]`. An RMP entry carries `Assigned`, `Page_Size` (0 = 4 KB, 1 = 2 MB), `Immutable`, `Guest_Physical_Address`, `ASID`, `VMSA`, `Validated`, and **one VMPL permission mask per implemented VMPL** `[APM2 Table 15-34]` `[1]`. Ownership is encoded by three fields together: **hypervisor = `Assigned=0, ASID=0`; a guest = `Assigned=1, ASID=<guest ASID>`; the AMD-SP = `Assigned=1, ASID=0, Immutable=1`** `[APM2 Table 15-35]` `[1]`.

**The eleven states.** The three states software usually talks about — hypervisor, guest-invalid, guest-valid — **cannot explain swapping, migration or guest context pages**. The firmware ABI defines **eleven** `[SNP-ABI 1.59 Table 14]` `[10]`:

| State | Assigned | Validated | ASID | Immutable | GPA | VMSA |
|---|---|---|---|---|---|---|
| **Hypervisor** | 0 | 0 | 0 | 0 | — | — |
| **HV-fixed** | 0 | 0 | 0 | 1 | — | — |
| **Reclaim** | 1 | 0 | 0 | 0 | — | — |
| **Firmware** | 1 | 0 | 0 | 1 | 0 | 0 |
| **Context** | 1 | 0 | 0 | 1 | 0 | 1 |
| **Metadata** | 1 | 0 | 0 | 1 | >0 | — |
| **Pre-Guest** | 1 | 0 | >0 | 1 | — | — |
| **Guest-Invalid** | 1 | 0 | >0 | 0 | — | — |
| **Pre-Swap** | 1 | 1 | >0 | 1 | — | — |
| **Guest-Valid** | 1 | 1 | >0 | 0 | — | — |
| **Default** | *page has no RMP entry* | | | | | |

AMD spells the immutable hypervisor state **HV-fixed**, and **Default** — a page whose sPA indexes **past `RMP_END`** — has Hypervisor-page permissions but **cannot transition to any other state** `[SNP-ABI 1.59 Table 14]` `[10]`.

**Which transitions are not possible — the direct answer.**
- **Default → anything: impossible.** A page beyond `RMP_END` has no entry and cannot move `[SNP-ABI 1.59 Table 14]` `[10]`.
- **`RMPUPDATE` can never validate.** **`RMPUPDATE` can invalidate a page but never validate one**, so **the hypervisor cannot manufacture a Pre-Swap or Guest-Valid page** without a guest `PVALIDATE` or firmware assistance `[SNP-ABI 1.59 §5.3.2]` `[10]`. This asymmetry is what makes the whole scheme sound.
- **`PVALIDATE` cannot move Pre-Guest or Pre-Swap pages**, because **both carry `Immutable = 1`** `[SNP-ABI 1.59 §5.3.3]` `[10]`.
- **HV-fixed cannot be created by `RMPUPDATE` at all.** Software uses **`SNP_PAGE_SET_STATE` or `SNP_INIT_EX` with a range list**, and **a page stays HV-fixed until the RMP is reinitialised** `[SNP-ABI 1.59 §5.3]` `[10]`.
- **Immutability has exactly one exit.** Firmware pages are hypervisor-donated writable memory the firmware owns; because `Immutable` is set **the hypervisor can neither write them nor alter their entry**, and **when the firmware hands one back it lands in Reclaim — the only exit from immutability** `[SNP-ABI 1.59 §5.3]` `[10]`.
- **Context pages have one creator.** A Context page holds all of a guest's context, encrypted and integrity-protected in an implementation-specific format, and **`SNP_GCTX_CREATE` is the only way to make one** `[SNP-ABI 1.59 §5.3]` `[10]`. Metadata pages hold the security attributes of swapped-out pages, and **the firmware converts a Firmware page into one by making the GPA field non-zero** `[SNP-ABI 1.59 §5.3]` `[10]`.

**Who may change what — four instructions, disjoint field sets** `[APM2 §15.36.3]` `[1]`: **`RMPUPDATE`** (hypervisor — GPA, Assigned, Page_Size, Immutable, ASID) · **`PSMASH`** (hypervisor — split 2 MB into 512×4 KB) · **`RMPADJUST`** (guest — the VMPL permission masks, plus the `VMSA` flag at VMPL0) · **`PVALIDATE`** (guest — the `Validated` flag).

**Validation as the anti-remap mechanism.** **Every page assigned to a VM starts unvalidated**; a private-memory access to an unvalidated page **raises `#VC`**, and the guest uses `PVALIDATE` to set the flag at startup and to clear it when handing memory back (e.g. memory hot-unplug) `[APM2 §15.36.6]` `[1]`. The point: **once a page is validated, any `RMPUPDATE` that unassigns, reassigns or remaps it clears `Validated`**, so **the next guest access faults instead of silently reading substituted data** `[APM2 §15.36.6]` `[1]`. Consistently, **`RMPUPDATE` clears `VALIDATED` and the `VMSA` flag whenever it changes any of `ASID`, `GUEST_PA`, `PAGE_SIZE` or `ASSIGNED`**, and at the same time **grants full permissions to VMPL0 and zeroes the masks of VMPL1..VMPL(N−1)**, where N is `Fn8000_001F_EBX[15:12]` `[APM3 §4 "RMPUPDATE"]` `[2]`.

**Size transitions.** **`PSMASH` converts a 2 MB entry into 512 4 KB entries *while preserving the `Validated` bit*** — results get consecutive `Guest_Physical_Address` values, `Page_Size = 0`, and every other field copied. **Doing the same conversion with `RMPUPDATE` clears `Validated`** `[APM2 §15.36.11]` `[1]`. The two page-size mismatches resolve in **opposite directions**: a **4 KB `PVALIDATE` or `RMPADJUST` against a 2 MB entry takes `#VMEXIT(NPF)` with `SIZEM` set** so the hypervisor can smash and let the guest retry, while a **2 MB `PVALIDATE` against 4 KB entries returns `FAIL_SIZEMISMATCH`** so the guest can fall back to 512 individual calls `[APM2 Table 15-39]` `[1]`. **Coalescing 4 KB pages back into a 2 MB page has no x86 instruction** — it needs the guest or the AMD-SP, exposed as **`SNP_PAGE_UNSMASH`** `[APM2 §15.36.11]` `[SNP-ABI 1.59 §8.26]` `[1][10]`.

**Granularity is a constraint, not a knob.** The RMP describes pages at **4 KB or 2 MB only**; **there is no 1 GB RMP entry**, and with SEV-SNP enabled an access to a 1 GB nested page **installs only a 2 MB TLB entry and is treated as a 2 MB access** for checking `[APM2 §15.36.10]` `[1]`. **`RMPUPDATE` invalidates all TLB entries in the system** that translate to the modified page, and `PSMASH` invalidates all system TLB entries translating to the 2 MB page it expands — **RMP maintenance is a system-wide, not a per-core, operation** `[APM3 §4 "RMPUPDATE"]` `[APM3 §4 "PSMASH"]` `[2]`.

**A layout caveat the skill is explicit about:** the APM publishes the RMP entry as a **field list, not a bit layout**; the only byte-exact encodings AMD publishes are the **16-byte software structures** that `RMPREAD` writes and `RMPUPDATE` reads. SKILL.md lists "the raw in-memory RMP entry layout" among the deliberately incomplete structures.

**Confidence:** high — all `C:high` `V:durable`. Scope: **server** (SEV-SNP has never been available on a client part).

---

### vmpl-and-rmpadjust
**Routed to:** `14-sev-snp.md` §14.5 "Virtual Machine Privilege Levels", with §14.4 "RMPADJUST and RMPQUERY" for the instruction — correct route (SKILL.md §Routing row names "VMPL, the SNP instructions" under `14-sev-snp.md`). Both in one chapter.

**Answer:**
**What a VMPL is.** VMPLs let a guest **split itself into privilege domains the hypervisor cannot arbitrate**. Within one vCPU the levels are represented by **distinct VMSAs expected to run mutually exclusively**, each tagged by the **`VMPL` field in its VMSA**; **VMPL0 is the most privileged and numbering increases as privilege decreases** `[APM2 §15.36.7]` `[1]`. Each **RMP entry carries one permission mask per implemented level**; the implemented count N is `Fn8000_001F_EBX[15:12]` `[APM2 Table 15-34]` `[APM3 §4 "RMPUPDATE"]` `[1][2]`.

**What is in a VMPL permission mask — the exact layout.** Eight bits, five defined `[APM2 Table 15-36]` `[1]`:

| Bit | Name | Meaning **when 0** |
|---|---|---|
| 0 | Read (RD) | reads cause `#VMEXIT(NPF)` |
| 1 | Write (WR) | writes cause `#VMEXIT(NPF)` |
| 2 | Execute-User (XU) | execution at **CPL 3** causes `#VMEXIT(NPF)` |
| 3 | Execute-Supervisor (XS) | execution at **CPL < 3** causes `#VMEXIT(NPF)` |
| 4 | Supervisor-Shadow-Stack (SSS) | supervisor shadow-stack accesses cause `#VMEXIT(NPF)` |
| 7:5 | Reserved | SBZ |

The **firmware reuses the identical encoding** for the `VMPL1_PERMS`, `VMPL2_PERMS` and `VMPL3_PERMS` parameters of `SNP_LAUNCH_UPDATE` `[SNP-ABI 1.59 Table 73]` `[10]`.

**Three combinations are architecturally invalid** and make `RMPADJUST` fail — and the firmware rejects the same three with `INVALID_PARAM` `[APM2 Table 15-37]` `[SNP-ABI 1.59 §8.18.2]` `[1][10]`:
1. **a non-readable page with any other permission set** (`R == 0 && Permissions[7:1] != 0`);
2. **an executable supervisor shadow-stack page** (`SSS == 1 && (XU == 1 || XS == 1)`);
3. **supervisor-executable without user-executable** (`XS == 1 && XU == 0`).

**The initial distribution.** When the hypervisor assigns a page, **VMPL0 receives full permissions and every other level none** `[APM2 §15.36.7]` `[1]`. That is enforced in hardware: whenever `RMPUPDATE` changes any of `ASID`, `GUEST_PA`, `PAGE_SIZE` or `ASSIGNED`, it **clears `VALIDATED` and the `VMSA` flag, grants full permissions to VMPL0 and zeroes the masks of VMPL1 through VMPL(N−1)** `[APM3 §4 "RMPUPDATE"]` `[2]`. The hypervisor therefore cannot seed a lower level with rights.

**How a guest hands permissions downward — `RMPADJUST`.** Operands `[APM3 §4 "RMPADJUST"]` `[2]`: **guest virtual address in `RAX`**, **page size in `RCX[0]`**, and the rest packed into **`RDX`** — **`[7:0]` `TARGET_VMPL`**, **`[15:8]` `TARGET_PERM_MASK`**, **`[16]` `VMSA`** (ignored unless the current VMPL is 0), `[63:17]` reserved.

**The two rules that make delegation one-directional** `[APM3 §4 "RMPADJUST"]` `[2]`:
- **`FAIL_PERMISSION` if `TARGET_VMPL <= CURRENT_VMPL`** — you may only target a **numerically higher**, i.e. **less privileged**, level.
- **`FAIL_PERMISSION` if the requested mask contains any bit absent from the caller's own mask** — **a level can only delegate downward and can never widen its own rights.**

Stated in the chapter as the consequence: the guest uses `RMPADJUST` to hand out **subsets** downward, and **a vCPU at VMPL1 can alter neither its own mask nor VMPL0's** `[APM2 §15.36.7]` `[1]`.

**A third gate: the page must already be accepted.** `RMPADJUST` **raises `#VC(PAGE_NOT_VALIDATED)` on an unvalidated page**, so **delegation is only possible on memory the guest has already accepted** `[APM3 §4 "RMPADJUST"]` `[2]`.

**Instruction environment.** `RMPADJUST` is **guest-callable at any VMPL** (unlike `PVALIDATE`, which is **VMPL0 only** and raises `#GP(0)` at any other VMPL), is **CPL0-only** (`#GP(0)` otherwise) and **64-bit-mode only** (`#UD` otherwise), raises **`#UD` when the guest is not SNP-active**, opcode **`F3 0F 01 FE`**, enumerated by `Fn8000_001F_EAX[SNP]` `[APM3 §4 "RMPADJUST"]` `[APM3 §4 "PVALIDATE"]` `[2]`. Its return-code subset is **0 SUCCESS, 1 FAIL_INPUT, 2 FAIL_PERMISSION, 6 FAIL_SIZEMISMATCH**, out of the shared space `0 SUCCESS / 1 FAIL_INPUT / 2 FAIL_PERMISSION / 3 FAIL_INUSE / 4 FAIL_OVERLAP / 6 FAIL_SIZEMISMATCH / 7 FAIL_BADADDR`, with `OF`, `ZF`, `AF`, `PF`, `SF` all set from the code `[APM3 §4 "RMPUPDATE"]` `[APM3 §4 "PVALIDATE"]` `[2]`. Size-mismatch direction: a **4 KB `RMPADJUST` against a 2 MB RMP entry takes `#VMEXIT(NPF)` with `SIZEM` set**, not a return code `[APM2 Table 15-39]` `[1]`.

**The read side.** **`RMPQUERY`** (opcode `F3 0F 01 FD`, enumerated separately by **`Fn8000_001F_EAX[6]`**, not by the SNP bit) takes the **target level in `RDX[7:0]`** and returns the **mask in `RDX[15:8]`**, the **`VMSA` flag in `RDX[16]`** (zero unless the caller is at VMPL0) and the **page size in `RCX[0]`**; **it too refuses a target that is not numerically higher than the caller** `[APM3 §4 "RMPQUERY"]` `[2]`. Codes: 0 and 2 only.

**Switching level.** A guest **changes the level its vCPU runs at by asking the hypervisor through the SNP Run VMPL event**; **each level needs its own VMSA and may have its own GHCB**, and the hypervisor **must update both system physical addresses before re-entering** `[GHCB 2.04 §4.1.14]` `[9]` (MSR-protocol encoding `0x016`/`0x017`, target level in `GHCBData[39:32]`, gated by the SEV-SNP Multi-VMPL feature bit — `13-sev-es-ghcb.md`).

**How a VMPL0 service handles a lower level's `#VC`.** **`SEV_FEATURES` bit 2 (`ReflectVC`)** turns every event that would raise `#VC` into an **Automatic Exit with exit code `VMEXIT_VC`**, saving the original event into the VMSA fields **`GUEST_EXITCODE`, `GUEST_EXITINFO1`, `GUEST_EXITINFO2`, `GUEST_EXITINTINFO` and `GUEST_NRIP`** `[APM2 §15.36.9]` `[1]`. The hypervisor then re-enters the vCPU **at VMPL0**, which reads the exit information out of the VMPL3 VMSA, transacts with the hypervisor, writes the response back and asks for the vCPU to resume at VMPL3 `[APM2 §15.36.9]` `[1]`. Note those five VMSA fields are **populated by hardware on *every* Automatic Exit whether or not `ReflectVC` is set** — for non-reflected exits they simply mirror the VMCB values `[APM2 §15.36.9]` `[1]`.

**Guest Intercept Control — a higher level intercepting for a lower one.** Enumerated by **`Fn8000_001F_EAX[22]`**, enabled by **`SEV_FEATURES` bit 13**. The guest-controlled intercepts are **eight 4-byte vectors in the VMSA starting at offset `900h`**, laid out identically to the host-controlled vectors at VMCB offset 0h, and **an event is intercepted if *either* bit is set**. Guest-controlled **MSR** intercepts are **four 8-byte vectors starting at VMSA offset `920h`**, two bits per MSR (low = read, high = write), and **any MSR without defined bits there is *unconditionally intercepted*** — so undefined guest intercept bits **should be initialised to 1 at VM creation** `[APM2 §15.36.23]` `[APM2 App.B]` `[1]`. x2APIC MSRs are exempt while Secure AVIC mode is in use `[APM2 §15.36.23]` `[1]`.

**VMPL Supervisor Shadow Stack.** Lets an **SNP guest, rather than the hypervisor**, designate which guest physical pages may back a supervisor shadow stack; enumerated by **`Fn8000_001F_EAX[7]`**, enabled by **`SEV_FEATURES` bit 8**, and **mutually exclusive with the nested-page-controlled form** — setting both fails VMRUN with `#VMEXIT(VMEXIT_INVALID)` `[APM2 §15.36.7]` `[1]`. With it enabled, **both supervisor and user shadow-stack accesses must target private pages**, otherwise the guest takes `#PF` with the reserved-bit error code set `[APM2 §15.36.7]` `[1]`.

**How many levels in practice.** The attestation path bounds levels at four: **`SNP_MSG_REPORT_REQ.VMPL` must be at least the current level and at most three**, a guest-requested report carries 0–3, and a host-requested report carries `0xFFFFFFFF` `[SNP-ABI 1.59 §7.3]` `[10]`.

**Confidence:** high — all `C:high` `V:durable`. Scope: **server** (SEV-SNP has never shipped on a client part).

---

### vmcb02-construction
**Routed to:** `15-nested-virtualization.md` §15.2 "Building vmcb02" and §15.3 "Merging intercepts" — correct route (SKILL.md §Routing row "Nested SVM, vmcb02, intercept merging, what AMD has instead of VMCS shadowing → `15-nested-virtualization.md`")

**Answer:**
**The three control blocks, and why only one reaches hardware.** **vmcb01** is the VMCB with which L0 runs L1; **vmcb12** is the VMCB L1 prepared for L2, which **L0 sees only as a page of L1 guest-physical memory**; **vmcb02** is the VMCB **L0 synthesises from the other two and passes to `VMRUN`**. The naming is a software convention from the Turtles work and the Linux implementation, **not AMD terminology** `[no-spec]` `[432][434]` `C:high`.

**Why vmcb12 cannot be handed to hardware — two independent reasons** `[APM2 App.B]` `[1]`:
1. **Every physical address in a VMCB control area is a system physical address to hardware, but an L1 *guest*-physical address in vmcb12.**
2. **The intercept vectors in vmcb12 describe only what L1 wants, not what L0 needs.**

**Division of labour** `[APM2 §15.33]` `[1]`: hardware still performs **exactly one world switch and one two-dimensional translation**; every additional level is collapsed into those by L0 **in software**. L0 computes the intercept union; hardware enters the guest on L0's VMRUN of vmcb02 and reports the exit into vmcb02; L0 copies or reflects; hardware translates guest-physical through **one composed table L0 built**; hardware saves/restores the host for L0 while **L0 does it in software for L1**; and on event delivery **L0 re-checks L1's intercepts, then injects**. "The only architectural help AMD provides is the pair of features in §15.33" — VLS and vGIF.

**What L0 must build.**

*State.* VMRUN loads guest state from the VMCB and saves a minimal host-state set, and `#VMEXIT` writes back "**the same subset of processor state as is loaded by the VMRUN instruction**", so **the state halves of vmcb02 and vmcb12 can largely be copied through** `[APM2 §15.5.1]` `[APM2 §15.6]` `[1]`. Helpfully, `#VMEXIT` **clears all intercepts, resets the current ASID register to zero, clears the GIF, and clears the internal `V_IRQ` and `V_INTR_MASKING` copies** — so when L0 gains control after an L2 exit the machine is in plain host mode **with no residue of either guest level** `[APM2 §15.6]` `[1]`.

*Host state — the part L0 cannot delegate.* `VM_HSAVE_PA` (`C001_0117h`) holds the physical address of a 4-Kbyte block VMRUN saves host state into and `#VMEXIT` reloads from; a write faults `#GP` if any low 12 bits are non-zero or the address is at/above the maximum supported physical address — **both conditions L0 must reproduce when it emulates L1's write** `[APM2 §15.30.4]` `[1]`. The area is **architecturally opaque**: implementations may store part or none of the state there and keep the rest in hidden on-chip memory, and software "must not rely on the format or contents of the host state save area, nor attempt to change host state by modifying [it]". **L0 therefore cannot inspect the area L1 nominated, cannot hand L1's address to hardware, and must save and restore L1's host state itself** `[APM2 §15.5.1]` `[1]`. The chapter calls this the sharpest structural difference from Intel, where the host-state area is part of the control structure (`C:medium` on that comparison).

*Fields that must be re-derived, not copied.* **Every VMCB control field naming memory.** `IOPM_BASE_PA` addresses a **12-Kbyte** I/O permissions map (two 4-Kbyte pages plus the first three bits of a third) and `MSRPM_BASE_PA` a map of **four 16-Kbit vectors in two contiguous pages**, both "accessed by physical address" — and in vmcb12 those are **L1 guest-physical** `[APM2 §15.10.1]` `[APM2 §15.11]` `[1]`. An out-of-range map address is **not a silent error**: if the last byte of either map is at or above the maximum supported physical address, VMRUN takes **`#VMEXIT(VMEXIT_INVALID)`**, so **L0 must validate the translated addresses before they reach vmcb02** rather than letting hardware reject them on L1's behalf `[APM2 §15.10.1]` `[APM2 §15.11]` `[1]`. The same applies to **`N_CR3`, the AVIC table pointers and any other address-bearing VMCB field** `[APM2 App.B]` `[1]`.

*Clean bits under nesting.* L1, obeying the architecture, **leaves L0 a summary of what it changed in vmcb12** since the last entry `[APM2 §15.15.1]` `[APM2 §15.15.2]` `[1]`. **L0 may use that summary only as a hint and never as a guarantee**: set bits are advisory in the hardware direction while **cleared bits are always honoured**, and **nothing prevents a buggy or hostile L1 from leaving a bit set over a field it changed** — the consequence is a wrong L2, not a compromised L0, but it is **not a validation mechanism** `[APM2 §15.15.1]` `[1]`. The uncached list is **exactly the part that matters most under nesting** — `TLB_CONTROL`, the interrupt shadow, the status fields (`EXITCODE`, `EXITINFO1/2`, `EXITINTINFO`, decode assist), event injection, and RFLAGS/RIP/RSP/RAX — so **L0 must re-read every one of those from vmcb12 on each entry regardless of the clean field** `[APM2 §15.15.2]` `[1]`. And because **the caching identity is the VMCB's physical address, explicitly not the ASID**, L0 must **keep one stable vmcb02 page per (L1 virtual CPU, vmcb12) pair rather than recycling one scratch page**, and must clear the whole clean field on first run, on a move to a different core and on a move to a different physical page `[APM2 §15.15]` `[APM2 §15.15.2]` `[1]`.

*Sync-back.* Hardware writes the exit description into **the VMCB it was given**, so `EXITCODE`, `EXITINFO1`, `EXITINFO2` and `EXITINTINFO` land in **vmcb02**, and L0 must copy them into vmcb12 before reflecting. **`EXITINFO1`/`EXITINFO2` are undefined for intercepts that do not define them, so a blind copy propagates garbage L1 may act on** `[APM2 §15.6]` `[1]`.

**How the two hypervisors' intercepts are combined — the union rule.** Hardware consults **one** set of intercept vectors, **one** IOPM and **one** MSRPM: the ones in the VMCB it was given, and intercepts are a per-VMCB property that `#VMEXIT` clears, so **there is no architectural notion of "the outer hypervisor's intercepts" persisting behind the inner ones** `[APM2 §15.7]` `[APM2 §15.6]` `[1]`. Therefore: **vmcb02's intercept vectors are vmcb01's OR vmcb12's, and its permissions maps are the bitwise OR of L0's and L1's** — the result is the set of L2 operations that will trap to **either** hypervisor. **Nothing in the architecture computes this; it is entirely L0's software** `[no-spec]` `[432][434]` `C:high`. The union is **not optional in either direction**: dropping an L0 intercept hands L2 a capability L0 withheld from L1; dropping an L1 intercept silently changes L2's behaviour relative to running on bare L1 `[no-spec]` `[432]`.

**Reflect or handle — the ordered path.** On every L2 exit L0 answers one question: **did L1 ask for this?** If the bit is set in vmcb12 — or, for I/O or MSR, in L1's permissions map — L0 **synthesises a `#VMEXIT` into vmcb12 and resumes L1**; otherwise L0 handles it and re-enters L2 **without L1 ever learning of it** `[no-spec]` `[432][434]`. Written out:
1. L2 executes something intercepted. Hardware takes `#VMEXIT` into **vmcb02**, clears all intercepts, clears the GIF, resets the current ASID to 0 and returns control to L0 at the instruction after **its** VMRUN.
2. L0 reads `EXITCODE` from vmcb02 and asks whether L1 requested this intercept in vmcb12.
3. If **not**: L0 handles it and re-enters L2 — **one exit, no L1 involvement**.
4. If **so**: L0 copies the exit description **and any in-flight event record** into vmcb12, writes back the guest state L1 expects, and resumes L1 with a **synthesised `#VMEXIT`** — which for L1 means resuming at the instruction after **its** VMRUN.
5. L1 handles the exit, possibly writes vmcb12, and executes VMRUN again. **That VMRUN is intercepted**, so L0 regains control, **re-validates vmcb12, refreshes vmcb02 and re-enters L2**.

Step 4 is the step with **no analogue in single-level virtualization** — L0 must make L1's world look as though hardware had exited to it. **Nothing in the architecture assists this** `[no-spec]` `[432][434]` `C:medium`. Two properties of `#VMEXIT` make step 1 safe without any instruction of L0's own: **the GIF is cleared automatically** so the state switch is atomic, and **all intercepts are cleared** so no residue of L1's policy applies while L0 runs `[APM2 §15.6]` `[1]`.

**Intercepts L0 must keep whatever vmcb12 says.** **`VMRUN`** is the architectural case — the implementation **requires that intercept always be set**, which is also what makes L1's VMRUN visible at all `[APM2 §15.9]` `[1]` (and it is consistency-check condition 13 in `04-world-switch.md` §4.2). **`VMLOAD`/`VMSAVE`** are the practical case: unless **VLS is available *and* enabled for L2 *and* nested paging is on**, L0 must keep both intercepts set so it can translate the guest-supplied VMCB address itself `[APM2 §15.33.1]` `[1]`.

**Events in flight.** L0 must **carry `EXITINTINFO` across into vmcb12 whenever it reflects**, or L1 loses the event `[APM2 §15.7.2]` `[1]`. Injection runs the other way and has a trap: events injected through `EVENTINJ` **are not subject to intercept checks**, so **when L0 injects into L2 on L1's behalf it must apply L1's exception intercept bits in software first** — hardware will not `[APM2 §15.20]` `[1]`. Two further `EVENTINJ` rules survive: an event impossible for the guest mode **fails entry with `VMEXIT_INVALID` rather than being ignored**, and **software interrupts cannot be injected correctly without `Fn8000_000A_EDX[NRIPS]`**, so **L0 must emulate an injection request from L1 it cannot satisfy** rather than pass it through `[APM2 §15.20]` `[1]`.

**ASIDs.** ASIDs are a **hardware-wide namespace L1 does not own**: ASID 0 is the host's, VMRUN with guest ASID 0 gives `VMEXIT_INVALID`, and the count is `CPUID Fn8000_000A` EBX — **so the ASID L1 wrote into vmcb12 is a virtual number L0 must map onto a real one, distinct from L1's own** `[APM2 §15.25.1]` `[APM2 §15.5.1]` `[1]`.

**Linux corroboration (labelled Linux-only in the chapter).** KVM keeps the same three structures under the same names — `svm->vmcb01`, the L1-supplied `vmcb12`, `svm->nested.vmcb02` — and **caches a sanitised copy of the vmcb12 control area** rather than re-reading L1 memory during exit handling; sanitisation **rejects a vmcb12 whose VMRUN intercept is clear, whose ASID is zero, or whose nested CR3 or permissions-map bases are not legal guest-physical addresses**, and masks off feature-enable bits the virtual CPU model does not expose `[no-spec]` `[432]` `C:medium`.

**Confidence:** high for the architectural claims (`[APM2 …]`, `C:high` `V:durable`). The composition rules themselves are software convention and are cited `[no-spec]` with kernel/Turtles references `[432][434]` — the union rule and the three-block naming are `C:high`, while the step-4 framing, the per-entry cost remark and the KVM details are **`C:medium`**.

---

### vmcb-versus-vmcs
**Routed to:** `19-comparison-intel-arm-riscv.md` §19.2 "Control structures: VMCB and VMCS" (§19.2.1–§19.2.5), with §19.7 in the same chapter for the nesting consequence — correct route (SKILL.md §Routing row "AMD versus Intel, ARM and RISC-V; what a client PC actually has → `19-comparison-intel-arm-riscv.md`"; SKILL.md §Scope boundaries: "use this skill … for two-way comparisons, where `19` gives the AMD-side view"). §19.7 forwards the *mechanism* to `15-nested-virtualization.md` §15.5, which I had already read for the previous question; `19` alone answers this one.

**Answer:**
**The single real difference: how software reaches the structure — and everything else follows.** Both architectures add a mode pair (AMD's host/guest mode, Intel's VMX root/non-root operation) and a memory-resident structure describing the guest. They diverge on the accessor `[APM2 App.B]` `[SDM 3C §27.2]` `[1][49]`:

- **AMD's VMCB is an ordinary 4-Kbyte-aligned memory page whose field offsets are architecturally published**, so a hypervisor **reads and writes it with ordinary loads and stores and needs no dedicated accessor instruction** `[APM2 App.B]` `[1]`.
- **Intel's VMCS has an implementation-specific layout and is reachable only through VMREAD and VMWRITE using architectural field encodings** `[SDM 3C §27.2]` `[49]`.

**The trade is symmetric and neither side is strictly better.** Intel can **rearrange the VMCS between generations** at the cost of **one privileged instruction per field access**; AMD gets **bulk access** at the cost of a layout that **can only be extended, never rearranged** — which is why AMD's newer controls appear **in previously reserved bits and in software-reserved regions** rather than in relocated fields `[APM2 App.B]` `[SDM 3C §27.2]` `[1][49]`.

**Four consequences that actually follow.**

*1. Host state lives outside the structure on AMD.* AMD keeps host state at **`VM_HSAVE_PA` (`C001_0117h`)**, a 4-Kbyte block VMRUN saves into and `#VMEXIT` reloads from, and **the block is architecturally opaque** — an implementation may keep part or all of it on-chip, and software "**must not rely on the format or contents of the host state save area**" `[APM2 §15.5.1]` `[APM2 §15.30.4]` `[1]`. **Intel has no external host-state area: the VMCS contains a host-state area the processor loads on every VM exit and never saves to** `[SDM 3C §27.5]` `[49]`. **Consequence:** an AMD outer hypervisor must **emulate a second, opaque save area for its guest hypervisor**, whereas an Intel one deals with a field of a structure it already manages `[APM2 §15.5.1]` `[SDM 3C §27.5]` `[1][49]` (`C:medium` on this comparison claim).

*2. AMD exposes its caching contract; Intel hides it.* The **VMCB Clean field** tells the processor which register groups it may reload from an internal cache, and **the identity used to decide whether a cached copy belongs to a guest is the VMCB's physical address — explicitly not the ASID**. **Set bits are a hint an implementation may ignore; cleared bits are always honoured** `[APM2 §15.15]` `[APM2 §15.15.1]` `[1]`. Intel's equivalent optimisation is **invisible**: the processor may keep a working copy of the current VMCS, **VMCLEAR forces it to memory**, and **no per-field validity contract is exposed to software** `[SDM 3C §27.1]` `[49]`.

*3. Feature discovery is "is the bit set" versus "is the setting permitted".* AMD reports SVM in one CPUID feature bit and then reports the SVM revision, the **ASID count in `Fn8000_000A` EBX** and a **flat list of discrete feature bits in EDX** — nested paging, NRIP save, VMCB clean bits, decode assists, flush-by-ASID, AVIC, x2AVIC, VLS, vGIF and the rest — and **software tests a bit and then writes the corresponding VMCB field directly** `[APM3 App.E]` `[APM2 §15.5.1]` `[1][2]`. Intel splits discovery in two: a CPUID bit says VMX exists, and **a family of capability MSRs then reports, for every execution, exit and entry control, which settings the processor allows**; an Intel hypervisor **must compute each control field against allowed-0 and allowed-1 masks before writing it; an AMD hypervisor does not** `[SDM 3D App.A]` `[586]`. **Consequence:** an AMD hypervisor's start-up path is **shorter** but its **forward-compatibility story is weaker** — a control AMD adds in a previously reserved VMCB bit is **invisible to older software**, whereas Intel's masks make an unsupported setting **fail loudly at entry** `[APM3 App.E]` `[SDM 3D App.A]` `[2][586]` (`C:medium`).

*4. Nesting: AMD has no VMCS shadowing, because the problem does not arise.* Intel's VMCS shadowing lets a guest hypervisor execute VMREAD/VMWRITE against a shadow VMCS **without exiting**, under a VM-execution control and a pair of read/write bitmaps `[SDM 3C §27.10]` `[49]`. **AMD has no equivalent, and the reason is structural**: because a VMCB is ordinary memory with published offsets, **a guest hypervisor's accesses to its own VMCB are plain loads and stores that never trap**, so **there is no privileged accessor to eliminate and nothing for a shadowing feature to accelerate**. An "AMD VMCB shadowing" feature **does not exist in any AMD document** `[APM2 App.B]` `[1]`. What AMD provides for nesting is **the two features of APM Vol.2 §15.33 and nothing else**: **virtualized VMLOAD/VMSAVE (`Fn8000_000A_EDX[15]`)** and **virtual GIF (`Fn8000_000A_EDX[16]`)** `[APM2 §15.33]` `[APM3 App.E]` `[1][2]`.

**The negative claim, scoped — and the asymmetry that runs the other way.** There is likewise **no AMD counterpart to Intel's "enlightened VMCS"**, because that structure is a **software substitute for VMREAD/VMWRITE**, and substituting memory for memory buys nothing when the control structure is already memory `[APM2 App.B]` `[1]`. **But the symmetric-sounding conclusion is false.** The **Hypervisor Top-Level Functional Specification** defines an **enlightened *VMCB* field block in the VMCB's host-reserved region at `3E0h`–`3FFh`, governed by clean bit 31**, for which **Intel has no counterpart** — so the asymmetry runs in both directions. **This is a Microsoft interface rather than an AMD architectural one and is cited accordingly** `[464]` `C:high`. (SKILL.md names this the worked example of its rule that "a negative claim needs the same evidence as a positive one".) Linux corroborates the layout independently, overlaying a 32-byte Hyper-V enlightenment structure onto the software-reserved region at control-area offset `3E0h` as a union with `u8 reserved_sw[32]` — so **the interface is an extension of the existing VMCB rather than a second structure to keep coherent**, which is the sharper statement `[no-spec]` `[433]` `C:high`.

**The structure table** `[APM2 App.B]` `[APM2 §15.5.1]` `[APM2 §15.6]` `[SDM 3C §27.2]` `[SDM 3C §27.9.1]` `[1][49]`:

| Dimension | AMD VMCB | Intel VMCS |
|---|---|---|
| Layout | **published by byte offset** | implementation-specific; encodings are architectural |
| Access | **ordinary loads and stores** | VMREAD / VMWRITE only |
| Host state | **outside, at `VM_HSAVE_PA`, opaque** | host-state area **inside** the VMCS |
| Activation | **none**; `VMRUN` takes the address in rAX | VMPTRLD / VMCLEAR establish a current VMCS |
| Entry | `VMRUN` | VMLAUNCH (clear) / VMRESUME (launched) |
| Extra state | `VMLOAD` / `VMSAVE` move a defined set | entry/exit control fields and MSR lists |
| Caching contract | **clean bits, visible to software** | invisible; VMCLEAR flushes |
| Exit reporting | `EXITCODE` plus `EXITINFO1`/`EXITINFO2` | exit reason plus exit qualification |

**Instruction correspondence** `[APM2 §15.17]` `[SDM 3C §27.6]` `[APM2 App.B]` `[SDM 3C Ch.33]` `[1][49]`: enable = `EFER.SVME` vs `CR4.VMXE` then VMXON · name the structure = the VMRUN operand in rAX vs VMPTRLD/VMCLEAR/VMPTRST · access a field = **ordinary load/store vs VMREAD/VMWRITE** · enter = VMRUN vs VMLAUNCH/VMRESUME · guest call = `VMMCALL` vs VMCALL · move extra state = `VMLOAD`/`VMSAVE` vs entry/exit control fields · invalidate second-level translations = **`TLB_CONTROL`, flush by ASID vs INVEPT** · invalidate tagged linear translations = `INVLPGA` vs INVVPID · **block all interrupts including NMI = `CLGI`/`STGI` vs *no single instruction*** · confidential-guest call = `VMGEXIT` vs a module call. Two rows carry their own conclusions: the **interrupt-blocking row has no Intel entry at all** — an architectural absence, developed in §19.6 — and the **invalidation rows differ in kind, not spelling**: **AMD expresses the bulk operation as *data* (a VMCB field evaluated at VMRUN) while Intel expresses it as an *instruction***.

**What does *not* follow.** The work that remains is **the same on both sides**: the outer hypervisor intercepts the inner one's entry instruction, validates the control structure the inner one prepared, merges two levels of second-level translation into one table hardware can walk, and runs the inner guest under the **union** of both levels' intercepts. **Only the per-field access cost differs** `[no-spec]` `[1][49][56]` `C:medium`. So "AMD nests more cheaply because it has no VMREAD" is **only half true**: AMD removes a per-field cost Intel pays, Intel removes through shadowing a per-access cost AMD never incurs, and **both pay the same per-entry composition cost** `[APM2 §15.33]` `[APM2 App.B]` `[1][434]` `C:medium`. One genuine asymmetry survives: **on Intel the inner hypervisor's field accesses are instructions, so the outer hypervisor can learn which fields changed, while on AMD they are invisible stores** — AMD's nearest substitute is the clean field, **a hint, not a signal** `[APM2 §15.15.1]` `[SDM 3C §27.10]` `[1][49]` `C:medium`.

**Citation discipline note:** per the chapter's own rule, the Intel side is anchored to **Intel documents (SDM 3C/3D)** and never to the APM, and the chapter is **exempt from this skill's `#VMEXIT` and sPA terminology rules when describing Intel**, because Intel's vocabulary is correct for Intel.

**Confidence:** high for the structural facts on both sides (`C:high` `V:durable`), including the enlightened-VMCB field block. The consequence claims — the nested host-state-area comparison, the forward-compatibility remark, the equal per-entry cost and the "which fields changed" asymmetry — are the ones the skill marks **`C:medium`**, and I have flagged each inline.

---

## Run summary

| Metric | Count |
|---|---|
| Questions answered from the skill | **24 / 24** |
| Recorded as not covered by the skill | **0** |
| Needed a second chapter | **2** — `gif-stgi-clgi-vgif` (`04` → `07` for the vGIF mechanism side) and `npf-check-ordering` (`06` for the ordering → `05` for the `EXITINFO1` bit layout). Both splits are ones SKILL.md predicts in advance. |
| Routing sent me to the wrong chapter first | **0** |

**Notes on the procedure.** `SKILL.md` §Routing resolved every question to a chapter directly; `00-quickref.md` §0.2 was consulted but these are topic questions, not symptoms, so it was only used to confirm three routes (`#NPF` decoding, "a passthrough device's interrupts never arrive", "I ran out of ASIDs") — and it agreed with the routing table each time. `errata.md` was read before answering, per SKILL.md step 3, and bore directly on four answers: **E05** (VMRUN's CR4/EFER checks are MBZ rules, not fixed masks), **E04** (`#NPF` `EXITINFO1` bit numbering), **E03** (`RemapEn`, not `RemapEm`) and **E22** (VMGEXIT accepts both `F2` and `F3`). No answer required `90-dated-landscape.md`, so **no `V:dated` fact appears in this file**; every claim used is tagged `V:durable`. Claims the skill marks **`C:medium`** are flagged inline in the answers for `vmrun-consistency-checks` (`TLB_CONTROL` not consistency-checked), `asid-allocation-and-exhaustion` (recycle pairs with `TLB_CONTROL = 1`), `gmet-mechanism` (GMET as the HVCI primitive, cited `[42]`), `c-bit-mechanics` (DMA to encrypted DRAM, cited to the non-normative white paper `[MEM-WP 70363]`), `msi-remapping-end-to-end` (older-revision MT behaviour), `vmcb02-construction` (the software-composition details, `[no-spec]` `[432][434]`) and `vmcb-versus-vmcs` (the cross-vendor consequence claims). No `C:low` claim was needed for any answer.
