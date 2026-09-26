# 03. Intercepts and Execution Controls

> **中文速览**：本章回答一个问题——guest 跑着跑着，**什么会把控制权交回 VMM**。六组拦截向量逐位列出（Rev 3.45 新增了 014h 的向量 5，旧资料里的"五组"已经过时），IOPM 与 MSRPM 的物理布局与位索引算法，拦截检查相对异常检查的优先级，以及一组调优与虚拟化控制：PAUSE filter 与 threshold、Bus Lock Threshold、IdleHlt、TSC ratio 与它的合成规则、LBR 虚拟化、PMU/IBS 虚拟化、调试寄存器虚拟化、CET/影子栈机制、SMI 拦截。**字段偏移在 `02-vmcb.md`，退出码与 EXITINFO 在 `05-exit-decoding.md`**——本章只给语义，不复述那两张表。

**Maps to:** APM Vol.2 §15.7–§15.14 (Intercept Operation · Decode Assists · Instruction · IOIO · MSR · Exception · Interrupt · Miscellaneous, incl. §15.14.4 Pause Intercept Filtering and §15.14.5 Bus Lock Threshold) + §15.22 SMM Support + §15.23 Last Branch Record Virtualization + §15.30.5 TSC Ratio MSR + §15.38 IBS Virtualization + §15.39 PMC Virtualization + App.B Table B-1/B-2; feature bits in APM Vol.3 App.E (24593 Rev 3.45 / 24594 Rev 3.38) [1][2]
**Owns:** intercept vector bit numbers and intercept priority/ordering · IOPM and MSRPM layout · PAUSE filter · Bus Lock Threshold · IdleHlt · TSC ratio and TSC composition · LBR virtualization · PMU and IBS virtualization · debug-register virtualization · the CET/shadow-stack mechanism · SMI intercept
**Scope:** OS-independent hardware · client-relevant. Every mechanism in this chapter is part of base SVM or of an optional feature gated by a CPUID bit. As of 2026-09-26 no public revision guide covers a Family 19h or 1Ah client model range, and client PPRs 56176, 56214, 56713 and 57254 have no retrievable first-party copy (`errata.md` E27), so on those parts the newer gates (Bus Lock Threshold, IdleHlt, PMC/IBS virtualization, Advanced Pause Filtering) are established by executing CPUID. Family 17h client parts have Revision Guide 55449.
**See also:** `02-vmcb.md` (field offsets and clean bits) · `05-exit-decoding.md` (exit codes, EXITINFO1/2) · `04-world-switch.md` (what VMRUN loads) · `07-virtual-interrupts-avic.md` (virtual interrupt state) · `17-security.md` (APM App.D SMM containerization)

---

## 3.1 The six intercept vectors

An intercept is a bit in the VMCB control area that turns a guest event into a `#VMEXIT`. The bits are grouped into six 32-bit vectors occupying the first 24 bytes of the control area. Older material — including AMD's own Rev 3.30 manual — describes **five** vectors; the sixth, at 014h, is new and carries the bits every recent SVM feature hangs off.

- **Claim.** SVM defines six 32-bit intercept vectors at VMCB control-area offsets **000h (vector 0), 004h (vector 1), 008h (vector 2), 00Ch (vector 3), 010h (vector 4) and 014h (vector 5)**; see `02-vmcb.md` for the rest of the control area.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Vector 5 at 014h did not exist in Rev 3.30 of the manual, where 014h–03Bh was a single RESERVED, SBZ span; a corpus that says SVM has five intercept vectors is reporting the pre-2020 layout.  `[APM2 Table B-1]` `[1][150]` `C:high` `V:durable`
- **Claim.** The two primary classes AMD names are **instruction intercepts** and **exception intercepts**; interrupt and miscellaneous intercepts are described separately but use the same VMCB bits.  `[APM2 §15.7]` `[1]` `C:high` `V:durable`

### Vector 0 (000h) — control registers, and vector 1 (004h) — debug registers

- **Claim.** Vector 0 bits **15:0** intercept reads of CR0–CR15 respectively and bits **31:16** intercept writes of CR0–CR15 respectively; vector 1 bits **15:0** intercept reads of DR0–DR15 and bits **31:16** intercept writes of DR0–DR15.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Both are checked before the access commits, and both defer to the architecture: the debug-register intercepts are **not** checked by implicit DR6/DR7 writes, and for MOV to/from CRn and DRn **all normal exception checks take precedence over the SVM intercept**.  `[APM2 §15.9]` `[1]` `C:high` `V:durable`

### Vector 2 (008h) — exceptions

- **Claim.** Vector 2 bits **31:0** intercept exception vectors **0–31** respectively, one bit per architectural vector.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

| Bit | Vector | Notes |
|---|---|---|
| 0–1 | #DE, #DB | EXITINFO1/2 undefined for both |
| 2 | (NMI) | **Not implemented** — use the NMI intercept in vector 3 |
| 3–8 | #BP, #OF, #BR, #UD, #NM, #DF | #DF saves an undefined rIP |
| 9 | Coprocessor-Segment-Overrun | **Not implemented**, reserved in the architecture |
| 10–14 | #TS, #NP, #SS, #GP, #PF | #NP/#SS/#GP deliver the error code; #PF also delivers the faulting address |
| 15 | — | Architecturally reserved |
| 16–19 | #MF, #AC, #MC, #XF | #MF/#XF taken after the status word is written |
| 20 | — | Architecturally reserved |
| 21 | #CP | Control-protection; error code delivered |
| 22–27 | — | Architecturally reserved |
| 28–30 | #HV, #VC, #SX | #SX delivers the error code |
| 31 | — | Architecturally reserved |

- **Claim.** The vector numbering above is the architectural interrupt-vector assignment: **#CP is vector 21, #HV is 28, #VC is 29 and #SX is 30**, with vectors 15, 20, 22–27 and 31 reserved and vector 9 unsupported.  `[APM2 Table 8-1]` `[1]` `C:high` `V:durable`
- **Claim.** Setting the bit for vector 2 or vector 9 has **undefined** effect: the manual states both intercepts are not implemented and directs software to the NMI intercept instead of bit 2.  `[APM2 §15.12.3]` `[1]` `C:high` `V:durable`
- **Claim.** External interrupts and INTn-generated software interrupts do **not** check exception intercepts even when they use a vector in 0–31, so an exception-intercept bit can never catch them.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`

### Vector 3 (00Ch) — interrupts, descriptor tables and the classic instruction set

- **Claim.** Vector 3 assigns bits 0–31 as tabulated below.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

| Bit | Intercept | Bit | Intercept |
|---|---|---|---|
| 0 | INTR (physical maskable interrupt) | 16 | PUSHF |
| 1 | NMI | 17 | POPF |
| 2 | SMI | 18 | CPUID |
| 3 | INIT | 19 | RSM |
| 4 | VINTR (virtual maskable interrupt) | 20 | IRET |
| 5 | Selective CR0 write (bits other than CR0.TS/CR0.MP) | 21 | INTn |
| 6 | Reads of IDTR | 22 | INVD |
| 7 | Reads of GDTR | 23 | PAUSE |
| 8 | Reads of LDTR | 24 | HLT |
| 9 | Reads of TR | 25 | INVLPG |
| 10 | Writes of IDTR | 26 | INVLPGA |
| 11 | Writes of GDTR | 27 | IOIO_PROT (IN/OUT via the IOPM) |
| 12 | Writes of LDTR | 28 | MSR_PROT (RDMSR/WRMSR via the MSRPM) |
| 13 | Writes of TR | 29 | Task switch |
| 14 | RDTSC | 30 | FERR_FREEZE |
| 15 | RDPMC | 31 | Shutdown |

### Vector 4 (010h) — the SVM instruction set and the write traps

- **Claim.** Vector 4 assigns bits 0–20 as tabulated below; **bits 18:17 and 31:21 are RESERVED**.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

| Bit | Intercept | Bit | Intercept |
|---|---|---|---|
| 0 | VMRUN | 11 | MWAIT/MWAITX, unconditionally |
| 1 | VMMCALL | 12 | MWAIT/MWAITX only if monitor hardware is armed |
| 2 | VMLOAD | 13 | XSETBV |
| 3 | VMSAVE | 14 | RDPRU |
| 4 | STGI | 15 | EFER writes (trap) |
| 5 | CLGI | 16 | CR0 writes (trap) |
| 6 | SKINIT | 17–18 | RESERVED |
| 7 | RDTSCP | 19 | CR3 writes (trap) |
| 8 | ICEBP | 20 | CR4 writes (trap) |
| 9 | WBINVD and WBNOINVD | 21–31 | RESERVED |
| 10 | MONITOR/MONITORX | | |

- **Claim.** The write-trap block of vector 4 is **narrower than it used to be**: Rev 3.30 defined bit 15 as "intercept writes of EFER" and bits **16–31** as "intercept writes of CR0–15", whereas Rev 3.45 defines only **16 (CR0), 19 (CR3) and 20 (CR4)** and reserves 17, 18 and 21–31. Bit 14, RESERVED in Rev 3.30, is now RDPRU.  `[APM2 Table B-1]` `[1][150]` `C:high` `V:durable`
- **Claim.** The four write traps are corroborated by the exit-code assignment, which allocates exactly **8Fh, 90h, 93h and 94h** to the EFER, CR0, CR3 and CR4 write traps and nothing to CR1–CR2 or CR5–CR15; the codes themselves belong to `05-exit-decoding.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** A write **trap** differs from the corresponding vector-0 write intercept in that a trap is detected and delivered *after* the triggering instruction has completed, so the new value is already in the register and the saved guest state includes the instruction's effects; the vector-0 intercept is taken before the results are committed.  `[APM2 §15.7.1]` `[APM2 §15.7]` `[1]` `C:medium` `V:durable`

### Vector 5 (014h) — the newest gates

- **Claim.** Vector 5 defines seven bits — **0** intercept all INVLPGB, **1** intercept only illegally specified INVLPGB, **2** INVPCID, **3** MCOMMIT, **4** TLBSYNC, **5** bus-lock operations when the Bus Lock Threshold Counter is 0, **6** HLT if a virtual interrupt is not pending (IdleHlt) — with **31:7 RESERVED, SBZ**.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The presence of vector 5 bit 4 (TLBSYNC) is itself conditional and is indicated by **CPUID `Fn8000_000A_EDX[24]` (TlbiCtl) = 1**.  `[APM2 Table B-1]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`
- **Claim.** Vector 5 bit 5 is an *enable*, not a plain intercept: the bus lock only exits when the separate 16-bit Bus Lock Threshold Counter has reached zero, and the intercept is evaluated before the guest instruction executes.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

### How a bit maps to an exit code

- **Claim.** The mapping is **positional, and the segmentation is its consequence**: Appendix C states that "intercept exit codes are equal to the bit position of the corresponding flag in the VMCB's intercept vector", which holds when the intercept words at `000h`–`014h` are read as one contiguous bit array, so `code = 32 × vector + bit`. Laid out that way the space looks segmented — CR reads at 00h, CR writes at 10h, DR at 20h/30h, exceptions at 40h, **vector 3 at 60h + bit, vector 4 at 80h + bit and vector 5 at A0h + bit** — which is why VMRUN (vector 4, bit 0) is 80h and the bus-lock exit (vector 5, bit 5) is A5h. The full enumeration is owned by `05-exit-decoding.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

## 3.2 Intercept ordering and priority

Intercept ordering is the part of this chapter that is most often reconstructed from guesswork. AMD states it in two places: a general rule in §15.7, and a per-instruction `Priority` column in Table 15-7.

- **Claim.** Exception intercepts are checked **when normal instruction processing must raise an exception**, before double-fault conditions are resolved and before delivery begins (that is, before any exception frame is pushed and before the IDT is read).  `[APM2 §15.7]` `[1]` `C:high` `V:durable`
- **Claim.** Instruction intercepts occur at well-defined points **before the results of the instruction are committed**; the general rule is that they are checked after simple exceptions such as `#GP` on wrong CPL or `#UD`, but before memory-access exceptions such as page faults and before exceptions that depend on specific operand values. RSM is explicitly called out as an exception to the rule.  `[APM2 §15.7]` `[1]` `C:high` `V:durable`
- **Claim.** **Instruction breakpoints for the current instruction, and pending data-breakpoint traps left over from the previous instruction, are designed to be checked before instruction intercepts** — so a debug exception can reach a guest that is about to be intercepted.  `[APM2 §15.7]` `[1]` `C:high` `V:durable`
- **Claim.** When an external or virtual interrupt is intercepted, the interrupt is **left pending** rather than consumed.  `[APM2 §15.7]` `[1]` `C:high` `V:durable`
- **Claim.** A trap intercept is taken *after* the triggering instruction completes, so the guest state saved in the VMCB includes that instruction's effects: after an intercepted data-breakpoint `#DB`, the saved CS:rIP points at the following instruction and the saved DR7 already reflects the match.  `[APM2 §15.7.1]` `[1]` `C:high` `V:durable`

Selected rows of the per-instruction priority table, which is the authoritative list:

| Instruction / intercept | Ordering relative to exceptions |
|---|---|
| MOV to/from CRn, DRn | All normal exception checks take precedence over the intercept |
| MOV to/from CR0, LMSW, SMSW, CLTS | Non-memory exceptions (CPL, illegal bit combinations) first; for LMSW and SMSW the SVM intercept is checked **before** memory exceptions |
| MOV to CR3 | Non-memory exceptions first, then the intercept; the intercept fires **before the TLB is flushed**, and a PAE PDPE `#GP` is checked **after** the intercept |
| LIDT/SIDT/LGDT/SGDT/LLDT/SLDT/LTR/STR | Intercept checked after `#UD` and `#GP`, but before any memory access |
| RDTSC, RDPMC | All exceptions checked before the SVM intercept |
| PUSHF, POPF, CPUID, RSM, IRET | The intercept takes priority over any exceptions |
| INTn | The intercept occurs **before any exceptions are checked**; the reported CS:rIP is that of the INTn |
| INVD | `#GP` checked before the intercept |
| PAUSE | No exceptions to check |
| HLT, RDTSCP, MONITOR/MONITORX, MWAIT/MWAITX, RDPRU | **All** exceptions checked before the intercept |
| INVLPG, INVLPGA | All exceptions (`#GP`) checked before the intercept |
| VMRUN, VMLOAD, VMSAVE, STGI, CLGI, SKINIT, WBINVD/WBNOINVD, TLBSYNC | Exceptions (`#GP`) checked before the intercept |
| VMMCALL | The intercept takes priority over exceptions |
| XSETBV | Intercept checked **before** exceptions (`#GP`) |
| INVLPGB, INVLPGB_ILLEGAL, INVPCID | Intercept takes priority over all exceptions **except** `#GP` for CPL ≠ 0 |
| ICEBP | The row carries no ordering rule — only the statement that the vector-1 event ICEBP dispatches is not interceptable through the `#DB` exception intercept |

- **Claim.** The ordering above is AMD's, stated per instruction rather than as one global rule, and **several rows invert the general guideline**: INTn, XSETBV, VMMCALL, the PUSHF/POPF/CPUID/RSM/IRET group and the INVLPGB/INVLPGB_ILLEGAL/INVPCID group all place the intercept ahead of some or all exception checks.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** **MCOMMIT has an intercept bit (vector 5, bit 3) but no row in the instruction-intercept table**, so its ordering relative to exceptions is undocumented; the instruction itself is covered by `04-world-switch.md`.  `[APM2 Table 15-7]` `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The **selective** CR0-write intercept triggers only when a bit other than CR0.TS or CR0.MP changes, which means **CLTS never checks it** even though CLTS does check the ordinary CR0 intercept; when both the selective and the non-selective CR0-write intercepts are active the non-selective one takes priority; and **LMSW treats the selective intercept as non-selective**, intercepting regardless of the value written.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** The CR3 reads and writes performed **by VMRUN, by `#VMEXIT` and by task switches are not subject to the CR3 intercept check** — a hypervisor cannot trap its own world switch by setting that bit.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** The **conditional** MWAIT intercept (vector 4, bit 12) is checked before the unconditional one (bit 11), so a hypervisor that sets both receives the conditional exit code when the guest MWAIT would have entered a low-power state and the unconditional exit code when it would not. The same rule applies to MWAITX.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** **The current implementation requires that the VMRUN intercept always be set in the VMCB**; and VMMCALL raises `#UD` in the guest if it is *not* intercepted.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** A vector-1 `#DB` raised by the single-byte INT1/ICEBP instruction (opcode F1h) does **not** trigger the `#DB` exception intercept; software must use the dedicated ICEBP intercept at vector 4 bit 8.  `[APM2 §15.12.2]` `[1]` `C:high` `V:durable`
- **Claim.** The task-switch intercept is checked **after** the incoming TSS and task gate have been checked for correctness but **before** the switch takes place, and it stands in for the CR3-write, EFLAGS and LDTR intercepts that a task switch would otherwise trip individually.  `[APM2 §15.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** The `#PF` intercept is tested **before CR2 is written**, so an intercepted page fault leaves the guest's CR2 unmodified.  `[APM2 §15.12.15]` `[1]` `C:high` `V:durable`
- **Claim.** The `#MC` intercept is checked **after** all machine-check-specific registers have been written but before other guest state is modified; and when **CPUID `Fn8000_000A_EDX[23]` (HOST_MCE_OVERRIDE) = 1** a host with CR4.MCE=1 turns containable guest machine checks into `#VMEXIT(MC)` even though the guest has CR4.MCE=0, where other parts would shut down.  `[APM2 §15.12.18]` `[1]` `C:high` `V:durable`
- **Claim.** After an intercepted shutdown, the VMCB control area is valid **except for offsets 60h, 61h and 68h**, and the state-save area is undefined; see `02-vmcb.md` for what those offsets hold.  `[APM2 §15.14.3]` `[1]` `C:high` `V:durable`
- **Claim.** The Ferr_Freeze intercept fires while the processor is frozen by an asserted FERR with IGNNE deasserted and legacy FERR handling selected in CR0.NE — that is, while it waits to be unfrozen by an external interrupt.  `[APM2 §15.14.2]` `[1]` `C:high` `V:durable`

### Intercepts raised while the guest is delivering something else

An intercept can fire in the middle of the guest's own exception or interrupt delivery — the classic case is a `#PF` because the VMM paged out the guest's exception stack. The ordering rules for that case are the part of §15.7 most often reinvented incorrectly.

- **Claim.** When the guest raises event E, the processor **checks E's own exception intercept first**; only if E is not intercepted is it combined with any prior pending event. If the combination produces a `#DF` and `#DF` is intercepted, the exit is `#VMEXIT(#DF)`; if it produces shutdown and shutdown is intercepted, the exit is the shutdown intercept.  `[APM2 §15.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** The consequence is that **an exception raised during the handling of a prior exception is checked for its own intercept before being combined into a double fault**: with `#GP` and `#DF` both intercepted, a non-intercepted `#NP` whose delivery raises `#GP` exits as an intercepted **`#GP`**, not as `#DF`. Only if `#GP` were not intercepted would the same sequence exit as `#DF`.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`
- **Claim.** Once an exception has been **successfully** taken in the guest, the processor clears the in-delivery valid flag and dispatches to the first instruction of the handler — no `#VMEXIT` occurs and the record of the in-flight event is discarded.  `[APM2 §15.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** Every intercept records whether it occurred during IDT delivery, because in some cases the information cannot be recreated: for an external interrupt the processor has **already performed the interrupt-acknowledge cycle** with the PIC or APIC, so the interrupt is no longer pending anywhere. The field that carries the record is owned by `05-exit-decoding.md`.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** With multiple stacked exceptions the record describes the **aggregate of all exceptions but the last (intercepted) one**; the intercepted exception itself is described by the exit code and the exit-information fields. If the VMM chooses to reflect the intercepted fault back to the guest rather than dismiss it, it must combine the two events by x86 rules itself — `#DF` plus `#PF` becomes a triple fault or shutdown.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** Despite the instruction names, events raised by **INT1/ICEBP (F1h), INT3 (CCh) and INTO (CEh) count as exceptions**, not software interrupts, for the purpose of that record; only INTn (CDh) counts as a software interrupt.  `[APM2 Table 15-1]` `[1]` `C:high` `V:durable`
- **Claim.** For the three interrupt-based instructions **INT3, INTO and BOUND**, an exception intercept saves the rIP **of the instruction itself** rather than of the next instruction, unlike every other exception intercept, whose saved CS:rIP matches what would have been pushed on the exception stack frame.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`

### Registers the processor writes even though it intercepts

The general rule is that no special registers are written before an exception is intercepted. Five exceptions to it decide whether a VMM can reconstruct guest state:

| Exception | Written before the intercept? |
|---|---|
| `#DB` | **Yes** — DR6 and DR7 are written for both faults and traps, matching what a `#DB` handler would see |
| `#PF` | **No** — the intercept is tested *before* CR2 is written |
| `#MF` | **Yes** — tested after the x87 status word has been written |
| `#XF` | **Yes** — tested after MXCSR has been written |
| `#MC` | **Yes** — tested after all machine-check-specific registers have been written |
| `#DF` | The exceptions leading up to the double fault have already written whatever they normally write |

- **Claim.** The table above is the complete set of documented write-before-intercept cases in §15.12; for every other exception the manual states that no special registers are written before the intercept.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`
- **Claim.** `#TS` is the one intercept whose saved rIP is genuinely ambiguous by design: it may point either at the instruction causing the task switch or at the first instruction of the incoming task.  `[APM2 §15.12.11]` `[1]` `C:high` `V:durable`
- **Claim.** An intercepted `#PF` reports the **protected-mode** page-fault error code even when the guest is running in paged real mode, so a VMM can analyse it without special-casing the mode.  `[APM2 §15.12.15]` `[1]` `C:high` `V:durable`

## 3.3 The I/O permissions map

- **Claim.** The I/O Permissions Map occupies **12 Kbytes** of contiguous physical memory, structured as a linear array of **64K+3 bits** — two 4-Kbyte pages plus the first three bits of a third — and must be **4-Kbyte aligned**.  `[APM2 §15.10.1]` `[1]` `C:high` `V:durable`
- **Claim.** **Bit *n* of the IOPM corresponds to I/O port *n***, and a bit set to 1 means accesses to that port are intercepted; the map is indexed by port number with no scaling.  `[APM2 §15.10.1]` `[1]` `C:high` `V:durable`
- **Claim.** The three extra bits exist because an I/O access is checked byte-by-byte: a 4-byte access based at port FFFFh reads permission bits FFFFh through 10002h, which would otherwise run past the end of the map.  `[APM2 §15.10.1]` `[1]` `C:medium` `V:durable`
- **Claim.** The physical base address is taken from **IOPM_BASE_PA** and loaded into the processor by VMRUN, which **ignores the low 12 bits** of the address; the offset is listed in `02-vmcb.md`.  `[APM2 §15.10.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the address of the **last** byte of the IOPM is greater than or equal to the maximum supported physical address, this is illegal VMCB state and VMRUN produces `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.10.1]` `[1]` `C:high` `V:durable`
- **Claim.** The IOPM is accessed **by physical address** and should reside in memory mapped writeback (WB); the processor does not walk the guest's page tables to reach it.  `[APM2 §15.10.1]` `[1]` `C:high` `V:durable`
- **Claim.** The IOPM is consulted only when **IOIO_PROT** (vector 3, bit 27) is set; with it clear, port access is not intercepted regardless of the map contents.  `[APM2 §15.10.2]` `[1]` `C:high` `V:durable`
- **Claim.** For an IN/OUT that touches more than one byte, **the permission bits of all bytes are checked and any bit set to 1 intercepts the whole operation**.  `[APM2 §15.10.2]` `[1]` `C:high` `V:durable`
- **Claim.** Exceptions related to virtual-8086 mode, IOPL or the TSS I/O bitmap are checked **before** the SVM intercept; every other exception is checked **after** it.  `[APM2 §15.10.2]` `[1]` `C:high` `V:durable`
- **Claim.** On an IOIO intercept the processor records the port, access width, address size, REP/string flags and access direction, and places the rIP of the instruction *following* the IN/OUT in EXITINFO2; bits **12:10** hold the effective segment number, and INS always reports ES encoded as 0. The bit layout is owned by `05-exit-decoding.md`.  `[APM2 §15.10.3]` `[APM2 Figure 15-2]` `[1]` `C:high` `V:durable`

## 3.4 The MSR permissions map

- **Claim.** The MSR permissions map consists of **four separate bit vectors of 16 Kbits (2 Kbytes) each**, packed together and located in **two contiguous physical pages**, **4-Kbyte aligned**; each 16-Kbit vector covers a range of 8K MSRs.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** **Each MSR is covered by two bits: the lsb controls read access and the msb controls write access**, and a value of 1 means the operation is intercepted.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** The covered ranges are **not contiguous**: MSRPM byte offsets 000h–7FFh cover MSRs 0000_0000h–0000_1FFFh, 800h–FFFh cover C000_0000h–C000_1FFFh, 1000h–17FFh cover C001_0000h–C001_1FFFh, and **1800h–1FFFh is reserved**.  `[APM2 Table 15-8]` `[1]` `C:high` `V:durable`
- **Claim.** Because each MSR takes two adjacent bits in index order, the read bit for an MSR at index *i* within its 8K-MSR range lies at **byte `vector_base + (2i >> 3)`, bit `(2i) & 7`**, and the write bit is the next bit up; AMD states the two-bits-per-MSR rule and the range table but does not print this arithmetic.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** **If MSR_PROT is active, any attempt to read or write an MSR not covered by the MSRPM automatically causes an intercept** — the uncovered default is "intercept", not "allow". With MSR_PROT clear, RDMSR/WRMSR are never intercepted.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** RDMSR and WRMSR check, in order: **exceptions common to all MSRs** (for example `#GP` when not at CPL 0), then **the MSRPM intercept**, then **exceptions specific to the MSR** (password protection, unimplemented MSRs, reserved bits). A hypervisor therefore sees the intercept before the processor decides the MSR is unimplemented.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** On an MSR intercept the direction is reported by a single value — RDMSR is 0 and WRMSR is 1 — in the field owned by `05-exit-decoding.md`; the MSR number is in the guest's ECX.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** Two ranges that matter in practice fall in different vectors: the shadow-stack MSRs **6A0h–6A8h** sit in the first vector (000h–7FFh), while the **TSC Ratio MSR C000_0104h** sits in the second (800h–FFFh) — a hypervisor that only populates the first vector silently leaves TSC scaling writable by the guest.  `[APM2 §18.12]` `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`
- **Claim.** An SNP-active guest can additionally define its own MSR intercepts in four 8-byte vectors in the VMSA, with the same read-lsb/write-msb encoding, and a RDMSR/WRMSR is intercepted if **either** the host-controlled or guest-controlled bit is set; this is the Guest Intercept Control feature owned by `14-sev-snp.md`.  `[APM2 §15.36.23]` `[1]` `C:high` `V:durable`

## 3.5 PAUSE filtering, Bus Lock Threshold and IdleHlt

These three are the "don't exit on every one of them" controls. All three add a counter to an otherwise unconditional intercept.

### PAUSE filtering

- **Claim.** Simple Pause filtering is indicated by **CPUID `Fn8000_000A_EDX[10]` (PauseFilter) = 1**; the VMCB supplies a **16-bit PAUSE Filter Count**, VMRUN copies it into an internal counter, each PAUSE decrements the counter, and a `#VMEXIT` is generated when the counter goes below zero with the PAUSE intercept enabled. See `02-vmcb.md` for the field offset.  `[APM2 §15.14.4]` `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** If the count is **zero** and the PAUSE intercept is enabled, every PAUSE causes a `#VMEXIT`; the same is true when the filter feature is not supported at all.  `[APM2 §15.14.4]` `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** **The processor never writes the PAUSE Filter Count field back**, so the hypervisor's value survives the exit; but certain events, including SMI, can cause the internal count to be reloaded from the VMCB mid-flight.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** Advanced Pause Filtering is indicated by **CPUID `Fn8000_000A_EDX[12]` (PauseFilterThreshold) = 1** and adds a **16-bit PAUSE Filter Threshold** that is a **cycle count**: on each PAUSE the processor compares the cycles elapsed since the previous PAUSE against the threshold, **reloading** the internal count when the elapsed count is greater and **decrementing** it when the elapsed count is smaller.  `[APM2 §15.14.4]` `[1]` `C:high` `V:durable`
- **Claim.** With Advanced Pause Filtering supported but the threshold field set to **zero**, the filter degrades to the simpler count-only mode.  `[APM2 §15.14.4]` `[1]` `C:high` `V:durable`

The tuning consequence follows from the threshold semantics rather than from any recommended value: the threshold decides what counts as "the same spin loop". A threshold below the cost of one lock-acquire iteration makes the count reload continuously and the intercept never fires; a very large threshold makes every PAUSE in the guest, spin loop or not, decrement the same counter. AMD publishes no recommended pair, and any specific numbers belong in `18-performance.md`.

### Bus Lock Threshold

- **Claim.** Bus Lock Threshold is indicated by **CPUID `Fn8000_000A_EDX[29]` (BusLockThreshold) = 1** and provides a VMCB enable bit (vector 5, bit 5) plus an **unsigned 16-bit Bus Lock Threshold count** loaded into an internal count register by VMRUN.  `[APM2 §15.14.5]` `[1]` `C:high` `V:durable`
- **Claim.** Before executing a bus lock in the guest the processor checks the counter: **greater than 0** means the bus lock executes and the count is decremented; **0** means the bus lock does not execute and a `#VMEXIT` is taken, reported as **A5h, VMEXIT_BUSLOCK**, with both EXITINFO fields set to 0. On `#VMEXIT` the processor writes the current counter value back to the VMCB — see `05-exit-decoding.md` for the exit-code table and `02-vmcb.md` for the counter offset.  `[APM2 §15.14.5]` `[1]` `C:high` `V:durable`
- **Claim.** A bus-lock-threshold exit may also be produced by a **page-table A/D-bit update during a table walk when a page-table memory type is not WB**, and in that case it is still reported as VMEXIT_BUSLOCK rather than as a `nested page fault`; the walk itself is described in `06-nested-paging.md`.  `[APM2 §15.14.5]` `[1]` `C:high` `V:durable`
- **Claim.** This is a different mechanism from the guest-visible **bus lock trap**, which is enabled by **DebugCtl[BLCKDB] (bit 2)**, raises a `#DB` after a successful locked read-modify-write at CPL > 0, and identifies itself by **clearing DR6[BLD] (bit 11)** — a bit that is otherwise always 1.  `[APM2 §13.1.3.6]` `[1]` `C:high` `V:durable`

### IdleHlt

- **Claim.** The Idle HLT intercept is indicated by **CPUID `Fn8000_000A_EDX[30]` (IdleHltIntercept) = 1** and sits at **vector 5, bit 6**: it intercepts HLT **only if a virtual interrupt is not pending** (neither V_INTR nor V_NMI).  `[APM2 Table B-1]` `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`
- **Claim.** When the plain HLT intercept (vector 3, bit 24) and the Idle HLT intercept are both active, **the HLT intercept takes priority**, so a hypervisor that wants the filtered behaviour must clear the unconditional bit.  `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`

The point of IdleHlt is the halt-polling case: a guest that halts with work already queued for it as a virtual interrupt does not need the hypervisor's attention, because the pending virtual interrupt will wake it. The virtual-interrupt state that gates the intercept is described in `07-virtual-interrupts-avic.md`.

## 3.6 TSC offset, TSC ratio and their composition

- **Claim.** The relevant intercepts are **RDTSC at vector 3 bit 14, RDPMC at vector 3 bit 15 and RDTSCP at vector 4 bit 7**; all three check every exception before the intercept, so a guest at CPL > 0 with CR4.TSD set takes `#GP` and never reaches the hypervisor.  `[APM2 Table B-1]` `[APM2 Table 15-7]` `[APM2 §13.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** **TSC_OFFSET** is a 64-bit VMCB control field that is *added* in RDTSC and RDTSCP; its offset is listed in `02-vmcb.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The **TSC Ratio MSR is C000_0104h**, supported when **CPUID `Fn8000_000A_EDX[4]` (TscRateMsr) = 1**, and holds a fixed-point binary number in **8.32 format**: **INT in bits 39:32**, **FRAC in bits 31:0**, **bits 63:40 MBZ**, with a reset value of **1.0**.  `[APM2 §15.30.5]` `[APM2 Figure 15-29]` `[1]` `C:high` `V:durable`
- **Claim.** The ratio scales the value a guest sees from **RDTSC, RDTSCP, and RDMSR of the TSC, MPERF and MPerfReadOnly MSRs**; it has **no effect in host mode or when virtualization is disabled**, and SMM code sees unscaled values unless it is itself executed inside a guest container.  `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`
- **Claim.** The ratio changes neither the rate of the underlying counters nor the value written to the TSC, MPERF or MPerfReadOnly MSRs by a host or guest write; it is a read-side transform only.  `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`
- **Claim.** The composition is **`TSC(guest) = (P0 frequency × TSCRatio × t) + VMCB.TSC_OFFSET + (last value written to TSC) × TSCRatio`**, where *t* is the time since the TSC was last written (or since reset), and `TSCFreq = Core P0 frequency × TSCRatio`.  `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`
- **Claim.** The order therefore matters and is fixed: **the ratio is applied first and the offset is added afterwards, unscaled** — a hypervisor that computes an offset under one ratio and then changes the ratio will see the guest's clock jump.  `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`

## 3.7 LBR virtualization

- **Claim.** Setting **DebugCtl[LBR]** causes the processor to record the source and target of the last control transfer into four MSRs — **LastBranchFromIP, LastBranchToIP, LastIntFromIP and LastIntToIP** — covering branches, interrupts and exceptions.  `[APM2 §15.23]` `[1]` `C:high` `V:durable`
- **Claim.** Without hardware acceleration, virtualizing these registers is entirely the VMM's job: it must **save them on `#VMEXIT` and restore them before each VMRUN**, and exchange host and guest values if the host also uses control-transfer recording.  `[APM2 §15.23]` `[1]` `C:high` `V:durable`
- **Claim.** Hardware acceleration is indicated by **CPUID `Fn8000_000A_EDX[1]` (LbrVirt) = 1** and enabled by **bit 0 at VMCB offset 0B8h (LBR_VIRTUALIZATION_ENABLE)**; both the CPUID bit and the offset are cross-listed in `02-vmcb.md`.  `[APM2 §15.23.2]` `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The accelerated fields in the VMCB state-save area are **DBGCTL at 270h, BR_FROM at 278h, BR_TO at 280h, LASTEXCPFROM at 288h and LASTEXCPTO at 290h** — five qwords spanning **270h–297h**. A range quoted as 270h–288h stops one field short, at LASTEXCPFROM; `02-vmcb.md` owns the table.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** With the enable set, **VMRUN saves all five host control-transfer MSRs into the host save area and loads the guest's five from the VMCB save area**, and `#VMEXIT` performs the inverse.  `[APM2 §15.23.1]` `[1]` `C:high` `V:durable`
- **Claim.** On processors that support the LBR Stack the same enable bit also governs **DBGEXTNCTL (298h), LBR_STACK_FROM, LBR_STACK_TO and LBR_SELECT**, but asymmetrically: DebugExtnCtl is saved and restored on both sides, whereas for the stack MSRs **VMRUN only restores guest state and `#VMEXIT` only saves guest state** — the host's stack values are not preserved across a world switch.  `[APM2 §15.23.1]` `[1]` `C:high` `V:durable`
- **Claim.** For SEV-ES guests, `#VMEXIT` **clears** LastBranchStackFromIp, LastBranchStackToIp and LastBranchStackSelect after saving them, so branch history does not leak out of an encrypted guest; see `13-sev-es-ghcb.md`.  `[APM2 §15.23.1]` `[1]` `C:high` `V:durable`
- **Claim.** Presence of the LBR Stack itself is reported by **CPUID `Fn8000_0022_EAX[1]` (LbrStack)**, separately from the SVM feature word.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** One clean bit (LBR) covers DebugCtl together with br_from/br_to and lastint_from/lastint_to, so a hypervisor that edits any of the five must clear it; the clean-bit numbering is owned by `02-vmcb.md`.  `[APM2 Figure 15-4]` `[1]` `C:high` `V:durable`

## 3.8 Performance monitoring and IBS virtualization

"Why doesn't `perf` work inside the VM?" is the most common practical question this chapter answers. The architectural answer is that the performance counters are **not** guest-private by default: SVM only makes them so when the hypervisor opts in.

- **Claim.** Without PMC virtualization there is no counter state in the VMCB save area to switch, so the only controls a hypervisor has are the **RDPMC intercept (vector 3, bit 15)** and MSRPM coverage of the performance MSRs; the counters themselves keep counting host and guest activity in the same hardware.  `[APM2 §15.39]` `[APM2 §15.11]` `[1]` `C:high` `V:durable`
- **Claim.** PMC virtualization is reported by **CPUID `Fn8000_000A_EDX[8]` (PmcVirt) = 1** for ordinary guests and by **CPUID `Fn8000_001F_EAX[20]` (PmcVirtGuestCtl) = 1** for SEV-ES and SEV-SNP guests; `Fn8000_001F` as a whole is owned by `11-memory-encryption.md`.  `[APM2 §15.39]` `[1]` `C:high` `V:durable`
- **Claim.** It is enabled by **bit 3 at VMCB offset 0B8h** for ordinary guests and by **SEV_FEATURES bit 11 in the VMSA** for SEV-ES/SEV-SNP guests, with the latter additionally subject to ALLOWED_SEV_FEATURES_MASK; see `02-vmcb.md` and `14-sev-snp.md`.  `[APM2 §15.39]` `[1]` `C:high` `V:durable`
- **Claim.** When enabled, the switched fields are **PERF_CTLn and PERF_CTRn for n = 0–5** (PerfEvtSeln / PerfCtrn), **INSTR_RETIRED_CTR** (IRPerfCount), **PERF_CTR_GLOBAL_STS** (PerfCntGlobalStatus) and **PERF_CNT_GLOBAL_CTL** (PerfCntGlobalCtl).  `[APM2 §15.39]` `[1]` `C:high` `V:durable`
- **Claim.** If the hypervisor has **not** enabled PMC virtualization but an SEV-ES/SNP guest enables it in its VMSA, then **PERF_CTRn bit 22 and PERF_CNT_GLOBAL_CTL bits 5:0 must all be 0** or VMRUN fails with the VMEXIT_INVALID_PMC error code, listed in `05-exit-decoding.md`.  `[APM2 §15.39]` `[1]` `C:high` `V:durable`
- **Claim.** **PMC virtualization requires AVIC or NMI virtualization** to deliver the counter-overflow interrupt: without virtualized interrupt delivery a PMC interrupt raised in the guest reaches **neither** the guest nor the hypervisor, and with AVIC the performance-counter LVT entry must be programmed to message type INTR or NMI. The interrupt machinery is owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.39]` `[1]` `C:high` `V:durable`
- **Claim.** The global control and status MSRs that the VMCB switches exist only on PerfMonV2 parts — **CPUID `Fn8000_0022_EAX[0]` (PerfMonV2) = 1** indicates PerfCntGlobalCtl, PerfCntGlobalStatus, PerfCntGlobalStatusClr and PerfCntGlobalStatusSet — and the number of available core counters comes from `Fn8000_0022_EBX[NumPerfCtrCore]`.  `[APM2 §13.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** IBS virtualization is reported by **CPUID `Fn8000_000A_EDX[26]` (IbsVirt) = 1** for ordinary guests and **CPUID `Fn8000_001F_EAX[19]` (IbsVirtGuestCtl) = 1** for SEV-ES/SEV-SNP guests, and is enabled by **bit 2 at VMCB offset 0B8h** or by **SEV_FEATURES bit 12 in the VMSA** respectively; see `11-memory-encryption.md` for the `Fn8000_001F` leaf.  `[APM2 §15.38]` `[1]` `C:high` `V:durable`
- **Claim.** With IBS virtualization enabled for an SEV-ES or SEV-SNP guest, **IbsFetchCtl[IbsFetchEn] and IbsOpCtl[IbsOpEn] must be 0 at VMRUN or the VMRUN fails with VMEXIT_INVALID**; for other guests they merely *should* be zero, to keep host IBS interrupts from leaking across the world switch.  `[APM2 §15.38]` `[1]` `C:high` `V:durable`
- **Claim.** The switched IBS state covers fetch and op sampling plus the IBS buffer — IBS_FETCH_CTL, IBS_FETCH_LINADDR, IBS_OP_CTL, IBS_OP_RIP, IBS_OP_DATA, IBS_OP_DATA2, IBS_OP_DATA3, IBS_DC_LINADDR, IBS_BRTGT_RIP, IBS_FETCH_EXTD_CTL, IBS_FETCH_CTL2, IBS_OP_CTL2, IBS_BUFFER_BASE, IBS_BUFFER_SIZE and IBS_BUFFER_TAIL.  `[APM2 §15.38]` `[1]` `C:high` `V:durable`
- **Claim.** A guest with IBS virtualization enabled **cannot read physical addresses**: IbsFetchPhysAd and IbsDcPhysAd read as zero, the associated valid bits IbsFetchCtl[IbsPhyAddrValid] and IbsOpData3[IbsDcPhyAddrValid] read as zero, and guest writes to those two MSRs are ignored.  `[APM2 §15.38]` `[1]` `C:high` `V:durable`
- **Claim.** IBS virtualization carries the same interrupt-delivery requirement as PMC virtualization — AVIC or NMI virtualization, with the IBS LVT entry (Extended Interrupt 0 LVT) programmed to INTR or NMI when AVIC is in use.  `[APM2 §15.38]` `[1]` `C:high` `V:durable`

## 3.9 Debug-register virtualization

- **Claim.** The standard VMCB state-save area carries **only DR7 (160h) and DR6 (168h)**; DR0–DR3 and the DR address masks are **not** part of it, so a hypervisor that lets a guest use hardware breakpoints must save and restore DR0–DR3 in software around every world switch. Offsets are owned by `02-vmcb.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** One clean bit (DRx) covers DR6 and DR7 together; there is no finer granularity, and the numbering is in `02-vmcb.md`.  `[APM2 Figure 15-4]` `[1]` `C:high` `V:durable`
- **Claim.** The `#DB` intercept sees a DR6 and DR7 that **match what a `#DB` handler would have seen**: both fault-type and trap-type debug exceptions are permitted to write DR6 and DR7 before the intercept is taken, and the EXITINFO fields are undefined — see `05-exit-decoding.md`.  `[APM2 §15.12.2]` `[1]` `C:high` `V:durable`
- **Claim.** A **fault-type** `#DB` leaves the saved CS:rIP pointing at the instruction that caused the exception; a **trap-type** `#DB` leaves it pointing at the following instruction. The distinction is the only way the hypervisor can tell an instruction breakpoint from a data breakpoint.  `[APM2 §15.12.2]` `[1]` `C:high` `V:durable`
- **Claim.** Because all normal exception checks take precedence over the debug-register intercept, the **general-detect** condition wins: with DR7[GD] set, a guest MOV DRn raises `#DB` (setting DR6[BD] and clearing DR7[GD]) before the instruction executes, so the hypervisor sees an intercepted `#DB` rather than an intercepted DR access.  `[APM2 §15.9]` `[APM2 §13.1.3.5]` `[1]` `C:medium` `V:durable`
- **Claim.** SEV-ES and SEV-SNP guests can take DR0–DR3 out of the hypervisor's hands entirely by enabling **DebugVirtualization, SEV_FEATURES bit 5**, after which **DR0–DR3 and DR0–DR3_ADDR_MASK are swapped as type-`B` state** between the VMSA and the hardware; see `14-sev-snp.md`.  `[APM2 §15.36.13]` `[1]` `C:high` `V:durable`
- **Claim.** Swap type `B` means the state is **loaded from the VMSA on VMRUN without the host value being saved**, and on an automatic-exit `#VMEXIT` the guest value is saved to the VMSA while the host value is loaded from the host save area — so the hypervisor must have placed its own debug-register values there itself. The swap-type table is described in `13-sev-es-ghcb.md`.  `[APM2 Table B-3]` `[1]` `C:high` `V:durable`
- **Claim.** A guest debugger that relies on I/O breakpoints interacts with SMI interception: when an SMI is asserted during an I/O instruction, the intercept report carries a **BRP (I/O breakpoint matches)** flag and the guest's EFLAGS.TF value alongside the port information.  `[APM2 Figure 15-3]` `[1]` `C:high` `V:durable`

## 3.10 Shadow stacks and CET under SVM

AMD's Chapter 15 says very little about CET directly; the mechanism is assembled from three separate pieces — a state swap, an exception intercept, and a nested-paging restriction.

- **Claim.** Shadow-stack support is indicated by **CPUID `Fn0000_0007_ECX_x0[CET_SS]` (bit 7) = 1**, enabled by **CR4.CET (bit 23) = 1**, operational only in protected mode with paging enabled, and disabled in virtual-8086 mode; a return-address mismatch raises **`#CP`**.  `[APM2 §18.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** `#CP` is architectural **vector 21**, so a hypervisor intercepts it with **bit 21 of the exception intercept vector**, and the error code that would have been pushed is delivered in the field owned by `05-exit-decoding.md`.  `[APM2 §15.12.21]` `[APM2 Table 8-1]` `[1]` `C:high` `V:durable`
- **Claim.** The **supervisor** CET state is world-switched by ordinary VMRUN/`#VMEXIT` as part of the VMCB state-save area — **S_CET at 1E0h, SSP at 1E8h and ISST_ADDR at 1F0h** — and is covered by a single clean bit; the offsets and the clean-bit number belong to `02-vmcb.md`.  `[APM2 Table B-2]` `[APM2 Figure 15-4]` `[1]` `C:high` `V:durable`
- **Claim.** The **user-mode** CET state — PL0_SSP, PL1_SSP, PL2_SSP, PL3_SSP, U_CET and XSS — appears only in the **VMSA** used by SEV-ES and SEV-SNP guests, all as swap type `B`; for an ordinary guest the hypervisor must virtualize those MSRs itself through the MSRPM. See `13-sev-es-ghcb.md`.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** The shadow-stack MSR numbers a hypervisor has to cover are **U_CET 6A0h, S_CET 6A2h, PL0_SSP 6A4h, PL1_SSP 6A5h, PL2_SSP 6A6h, PL3_SSP 6A7h and ISST_ADDR 6A8h**.  `[APM2 §18.12]` `[1]` `C:high` `V:durable`
- **Claim.** The hypervisor can additionally restrict **which guest physical addresses may back a supervisor shadow stack**: the Supervisor Shadow Stack feature is indicated by **CPUID `Fn8000_000A_EDX[19]` = 1** (the CPUID table and Table B-1 call the bit SSSCheck, §15.25.14 calls it SupervisorShadowStack), enabled by bit 4 at VMCB offset 90h, requires nested paging plus a host in PAE mode with EFER.NXE=1, and turns a non-SSS supervisor shadow-stack access into `#VMEXIT(NPF)`. The nested-paging side is owned by `06-nested-paging.md`.  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`
- **Claim.** Enabling the Supervisor Shadow Stack feature with nested paging disabled makes VMRUN fail with VMEXIT_INVALID, whereas enabling it on a host that is in legacy non-PAE mode or has EFER.NXE=0 is **silently ignored** — two different failure modes for two different misconfigurations.  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`

## 3.11 SMI interception

- **Claim.** The SMI intercept is **vector 3, bit 2**; by setting it a VMM gains control before the processor enters SMM.  `[APM2 Table B-1]` `[APM2 §15.22.2]` `[1]` `C:high` `V:durable`
- **Claim.** AMD classifies SMI sources into three kinds: **internal synchronous** (I/O trapping inside the CPU, always in response to an IN or OUT, set up through MSRs the VMM can itself intercept), **external synchronous** (I/O trapping generated by an external agent, typically the southbridge), and **external asynchronous** (a physical event such as a thermal trip).  `[APM2 §15.22.1]` `[1]` `C:high` `V:durable`
- **Claim.** The response matrix is: with **GIF=0** an internal SMI is **lost** and an external SMI is **held pending until GIF=1**; with GIF=1 and the intercept set, an internal SMI exits the guest with `#VMEXIT(SMI)` and is **no longer pending**, while an external SMI exits with `#VMEXIT(SMI)` and **is still pending**; with GIF=1 and the intercept clear, both are taken normally.  `[APM2 §15.22.2]` `[1]` `C:high` `V:durable`
- **Claim.** **The SMI intercept is ignored when HWCR[SMMLOCK] is set** — firmware that locks the SMM control registers takes SMI virtualization away from the hypervisor, and a VMM can detect this by reading HWCR before planning to containerize SMM.  `[APM2 §15.13.3]` `[APM2 §15.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** On an SMI intercept, **bit 0 (SMISRC) distinguishes an internally caused SMI (0) from an externally asserted one (1)**, and **bit 1 (MCREDIR)** reports an SMI caused by a redirected machine-check error; the field layout is owned by `05-exit-decoding.md`.  `[APM2 §15.13.3]` `[APM2 Figure 15-3]` `[1]` `C:high` `V:durable`
- **Claim.** If the SMI was asserted while the guest was executing an I/O instruction, the upper 32 bits of the report describe that instruction (port, width, address size, REP/string, direction) with a **VAL bit at 33** marking them meaningful, and the rIP of the **I/O instruction itself** — not the following one — is placed in EXITINFO2; otherwise those bits are undefined. See `05-exit-decoding.md`.  `[APM2 §15.13.3]` `[APM2 Figure 15-3]` `[1]` `C:high` `V:durable`
- **Claim.** The three architectural options for SMM are: do not intercept SMI at all (the handler then runs outside every virtualization control, on the interrupted guest's saved state); intercept SMI **together with every IOIO bit** so that any `#VMEXIT(SMI)` is known to be external and asynchronous; or containerize SMM by running the platform handler as a guest in paged real mode under a trusted SMM hypervisor.  `[APM2 §15.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** In the second option the hypervisor responds to `#VMEXIT(SMI)` with STGI to let the pending SMI be taken immediately, but **the effect of STGI is undefined while an SMI due to an I/O instruction is pending** — that case requires either containerization or not intercepting SMI at all.  `[APM2 §15.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** Containerization needs write access to SMM_BASE and SMM_CTL, and **writes to SMM_CTL raise `#GP` if firmware has locked the SMM control registers**; the containerization appendix itself is covered by `17-security.md`.  `[APM2 §15.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** A containerized platform SMM runs as a guest **in paged real mode** with the SMM hypervisor emulating SMM entry and RSM, which is why paged real mode is an architecturally supported guest mode rather than an oddity; the mode itself is described in `04-world-switch.md`.  `[APM2 §15.22.3]` `[APM2 §15.19]` `[1]` `C:high` `V:durable`
- **Claim.** Entering SMM remaps the SMRAM regions, so a VMM's own code and data must not live where SMRAM will appear, the ASEG region overlaps video memory (an SMM hypervisor must not write diagnostics to the screen), and any guest attempt to relocate an SMRAM region through an MSR write must itself be intercepted.  `[APM2 §15.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** An SNP-active guest removes the hypervisor's discretion over port I/O entirely: **all IN/INS/OUT/OUTS and all CPUID executed by an SNP-active guest are treated as intercepted regardless of the intercept bits set in the VMCB and the IOPM**, and each one generates a Non-Automatic Exit. See `14-sev-snp.md`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`

## 3.12 Open items

Places where the manual is ambiguous, silent, or contradicts itself. Reporting the gap is better than filling it.

- **The PAUSE filter's terminating condition is stated two ways.** §15.14.4 says the counter is "decremented until it reaches zero at which time a `#VMEXIT` is generated", but the same subsection's advanced-filtering paragraph and the instruction-intercept table both say the exit happens when the count goes **below** zero. The two readings differ by one PAUSE.
  - **Claim.** This chapter follows the "goes below zero" form because two of the manual's three statements use it and only the introductory sentence of §15.14.4 uses "reaches zero"; AMD does not reconcile them, so the exact number of PAUSE instructions a given count permits is not settled by the text.  `[APM2 §15.14.4]` `[APM2 Table 15-7]` `[1]` `C:medium` `V:durable`
- **The TSC Ratio MSR's FRAC field is mislabelled in the body text.** Figure 15-29 gives FRAC as bits 31:0 and the prose describes an 8.32 format with 8 integer and 32 fractional bits, but the bullet immediately below the figure reads "FRAC. Fractional Part. Bits 39:32", repeating INT's range. The figure is the correct one and §3.6 follows it.  `[APM2 §15.30.5]` `[APM2 Figure 15-29]` `[1]`
- **No subsection describes intercepting `#HV` (28) or `#VC` (29).** The exception intercept vector has a bit for every vector 0–31 and §15.12 walks the individual exceptions, but it stops at `#CP` and `#SX` and never says what setting bit 28 or bit 29 does.  `[APM2 §15.12]` `[1]`
- **The fate of the retired vector-4 write-trap bits is unstated.** Rev 3.30 allowed a hypervisor to set bits 16–31 of vector 4 for CR0–CR15 write traps; Rev 3.45 reserves 17, 18 and 21–31. The manual does not say whether a hypervisor written against the old layout now fails a consistency check, is ignored, or is undefined — the VMRUN consistency list is `04-world-switch.md`.  `[APM2 Table B-1]` `[1][150]`
- **The MSRPM index arithmetic is never printed.** AMD gives the range table and the two-bits-per-MSR rule but no formula, so every hypervisor derives the same expression independently. The derivation in §3.4 is that expression, not a quotation.  `[APM2 §15.11]` `[1]`
- **§15.39 contains an unresolved cross-reference.** The PMC virtualization section points at "Section 15.36.20, 'Allowed SEV Features', on page N" — the page number was never substituted in Rev 3.45.  `[APM2 §15.39]` `[1]`
- **Per-part availability on some client parts cannot be looked up.** Family 17h client parts have Revision Guide 55449. The gap is narrower.
  - **Claim.** As of 2026-09-26, no public revision guide covers a Family 19h or 1Ah client model range, and client PPRs 56176, 56214, 56713 and 57254 have no retrievable first-party copy, so whether one of those parts implements IdleHlt, Bus Lock Threshold, Advanced Pause Filtering or PMC/IBS virtualization is answered by executing CPUID on the machine. The blanket form of this sentence is the one `errata.md` E27 records as false.  `[no-spec]` `[29][30]` `C:medium` `V:durable`
- **Not covered here on purpose:** the Decode Assist fields that several of these intercepts populate (`05-exit-decoding.md`), the `#NPF` exit information (`05-exit-decoding.md`), the VMCB clean-bit numbering and every field offset (`02-vmcb.md`), and the consistency checks VMRUN applies to the intercept vectors (`04-world-switch.md`).
