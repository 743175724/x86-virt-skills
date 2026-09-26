# 04. VMRUN, #VMEXIT and the SVM Instructions

> **中文速览**：本章是世界切换的机制与 SVM 指令集的规范参考。VMRUN 做了什么、`#VMEXIT` 恢复了什么（**不是"只有三个寄存器"**）、一致性检查的正反两面（哪些状态非法，以及哪些看起来非法其实合法）、VMLOAD/VMSAVE 的确切字段集（**不含 SS**）、GIF 与 STGI/CLGI、VLS（虚拟化的 VMLOAD/VMSAVE）、INIT/SIPI 与 `#SX`。指令的编码、操作数与异常条件来自 APM Vol.3 Ch.4——那一章按字母排序、**只有页码没有小节号**。

**Maps to:** APM Vol.2 §15.5 "VMRUN" (15.5.1 Basic Operation, 15.5.2 VMSAVE and VMLOAD) + §15.6 "#VMEXIT" + §15.17 "Global Interrupt Flag, STGI and CLGI"; instruction reference in APM Vol.3 §4 [1][2]
**Owns:** the VMRUN and #VMEXIT flows · consistency checks including the negative list · per-instruction semantics and #UD/#GP conditions · GIF, STGI and CLGI on the instruction side · VLS · INIT/SIPI and #SX · MCOMMIT · the `VM_HSAVE_PA` opacity contract
**Scope:** OS-independent hardware
**See also:** `02-vmcb.md` · `05-exit-decoding.md` · `07-virtual-interrupts-avic.md` (vGIF mechanism) · `15-nested-virtualization.md`

---

## 4.1 VMRUN: what the hardware does

VMRUN is the only instruction that enters guest mode. Everything else in SVM either prepares for it,
describes what should interrupt it, or cleans up after it. Reading it as a *single host instruction that
takes an arbitrarily long time* is the mental model the manual itself uses: from the host's point of
view an arbitrary number of guest instructions execute "inside" the VMRUN, and the `#VMEXIT`
completes it.

### Operand, mode and privilege

- **Claim.** VMRUN has an implicit `[rAX]` addressing mode: software loads rAX with the physical address of the 4-Kbyte-aligned VMCB page, and the portion of RAX used to form the address is determined by the current effective address size.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The VMCB is accessed by physical address and should be mapped writeback (WB).  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN is available only at CPL 0 and raises `#GP(0)` when CPL is greater than zero; it additionally requires protected mode and `EFER.SVME = 1`, and raises `#UD` otherwise.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The instruction reference adds two further `#GP` conditions that the Vol.2 prose does not enumerate: rAX referencing a physical address above the maximum supported physical address, and rAX not being aligned on a 4-Kbyte boundary.  `[APM3 §4 "VMRUN"]` `[2]` `C:high` `V:durable`
- **Claim.** VMRUN is not supported inside the SMM handler and the resulting processor behaviour is undefined — this is stated as undefined behaviour, not as a fault.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

### Step 1 — saving host state

- **Claim.** VMRUN saves host state into the 4-Kbyte block whose physical address is in the `VM_HSAVE_PA` MSR (`C001_0117h`), which the VMM must program before the first VMRUN; the MSR write itself faults with `#GP` if any of the low 12 bits are non-zero or the address is at or above the maximum supported physical address.  `[APM2 §15.30.4]` `[1]` `C:high` `V:durable`
- **Claim.** The manual says VMRUN saves "**at least** the following" host state, and the enumerated set is CS.SEL and NEXT_RIP, RFLAGS and RAX, SS.SEL and RSP, CR0/CR3/CR4/EFER, IDTR and GDTR, and ES.SEL and DS.SEL — fourteen items, not three.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Two omissions from that set are explicit rather than accidental: VMRUN does not save or restore the host LDTR, and the Vol.3 pseudo-code annotates the save list with "host CR2 is not saved".  `[APM2 §15.5.1]` `[APM3 §4 "VMRUN"]` `[1][2]` `C:high` `V:durable`
- **Claim.** NEXT_RIP here means the rIP of the instruction *following* the VMRUN — that is the address at which the host resumes on `#VMEXIT`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

**The `VM_HSAVE_PA` opacity contract.** The host save area is deliberately not a documented layout.

- **Claim.** Implementations may store only part, or none, of the host state in the memory pointed to by `VM_HSAVE_PA` and may keep some or all of it in hidden on-chip storage; different implementations may also choose to save the hidden parts of the host's segment registers as well as the selectors.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Consequently software must not rely on the format or the contents of the host save area, and must not attempt to change host state by modifying it.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

### Step 2 — loading guest state

- **Claim.** VMRUN loads from the VMCB state-save area: CS and rIP (including the hidden CS state), RFLAGS and RAX, SS and RSP (including hidden SS state), CR0/CR2/CR3/CR4/EFER, `INTERRUPT_SHADOW`, IDTR and GDTR, ES and DS (including hidden state), DR6 and DR7, `V_TPR`, `V_IRQ`, and CPL.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** CPL is not always taken from the VMCB: it is forced to 0 if the guest is in real mode and to 3 if the guest is in virtual-8086 mode, and only otherwise is the saved CPL field used.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Writing the paging-related control registers with VMRUN does not flush the TLB, because address spaces are switched rather than reused.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the guest is in PAE paging mode according to the registers just loaded and nested paging is not enabled, VMRUN also reads the four PDPEs pointed to by the newly loaded CR3, and reserved bits set in those PDPEs cause a `#VMEXIT`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The Vol.3 pseudo-code adds `gPAT` to the guest load set when `NP_ENABLE = 1`, and notes that loading it leaves the host `hPAT` register unchanged.  `[APM3 §4 "VMRUN"]` `[2]` `C:high` `V:durable`

### Step 3 — control information, TLB command and GIF

- **Claim.** VMRUN also reads control fields that are mostly *not* written back on `#VMEXIT` because they cannot change during guest execution: `TSC_OFFSET`, the virtual-interrupt description fields, `V_INTR_MASKING`, the ASID, the TLB-flush control and the intercept vectors.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** On exit from the guest the internal intercept registers are cleared, so no host operation is intercepted.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** In the Vol.3 pseudo-code the ordering is explicit: guest-state consistency checks run first, then the command stored in `TLB_CONTROL` is executed, then `GIF` is set to 1, and only then is the injected event delivered or the first guest instruction fetched — see `06-nested-paging.md` for what the TLB command does.  `[APM3 §4 "VMRUN"]` `[2]` `C:high` `V:durable`
- **Claim.** Setting `GIF` to 1 is part of VMRUN, and the architecture assumes VMM software cleared `GIF` some time before executing VMRUN so that the state switch is atomic.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

### VMRUN and EFLAGS.TF / EFLAGS.RF

- **Claim.** On the host side VMRUN behaves like an ordinary instruction with respect to EFLAGS.RF and EFLAGS.TF: RF suppresses an instruction-breakpoint match on the VMRUN itself, TF causes a `#DB` trap after the VMRUN completes (that is, after the `#VMEXIT`), and completing VMRUN clears the host EFLAGS.RF.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** On the guest side a loaded EFLAGS.RF of 1 suppresses an instruction breakpoint on the *first* guest instruction, while a loaded EFLAGS.TF of 1 produces the trace trap after that first guest instruction completes rather than between VMRUN and it.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Host EFLAGS values have no effect on the guest and guest EFLAGS values have no effect on the host.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

## 4.2 Consistency checks, and what is legal despite looking illegal

The consistency checks are the single most misquoted part of SVM. Two rules make them tractable:
the manual's enumerated list is the authority, and a failure is reported as
`#VMEXIT(VMEXIT_INVALID)` — exit code `−1`, decoded in `05-exit-decoding.md`.

- **Claim.** VMRUN performs consistency checks on guest state and `#VMEXIT` performs the appropriate subset of the same checks on host state; an illegal guest-state combination produces a `#VMEXIT` with error code `VMEXIT_INVALID`.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

### The enumerated list

The following twenty conditions are the ones §15.5 lists as illegal state combinations. The claim
line below the table covers every value in it.

| # | Illegal state combination |
|---|---|
| 1 | `EFER.SVME` is zero |
| 2 | `CR0.CD` is zero and `CR0.NW` is set |
| 3 | `CR0[63:32]` are not zero |
| 4 | Any MBZ bit of CR3 is set |
| 5 | Any MBZ bit of CR4 is set |
| 6 | `DR6[63:32]` are not zero |
| 7 | `DR7[63:32]` are not zero |
| 8 | Any MBZ bit of EFER is set |
| 9 | `EFER.LMA` or `EFER.LME` is non-zero and the processor does not support long mode |
| 10 | `EFER.LME` and `CR0.PG` are both set and `CR4.PAE` is zero |
| 11 | `EFER.LME` and `CR0.PG` are both non-zero and `CR0.PE` is zero |
| 12 | `EFER.LME`, `CR0.PG`, `CR4.PAE`, `CS.L` and `CS.D` are all non-zero |
| 13 | The VMRUN intercept bit is clear |
| 14 | The MSR or IOIO intercept table extends to a physical address at or above the maximum supported physical address |
| 15 | Illegal event injection (see §4.7 of this chapter and `05-exit-decoding.md`) |
| 16 | ASID is equal to zero |
| 17 | Any reserved bit is set in `S_CET` |
| 18 | `CR4.CET = 1` when `CR0.WP = 0` |
| 19 | `CR4.CET = 1` and `U_CET.SS = 1` when `EFLAGS.VM = 1` |
| 20 | Any reserved bit set in `U_CET` (SEV-ES only) |

- **Claim.** The twenty conditions above are the consistency checks enumerated in §15.5 for Rev 3.45, and condition 20 is asymmetric: VMRUN produces `#VMEXIT(INVALID)` while `#VMEXIT` instead forces the reserved `U_CET` bits to zero.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Conditions 5 and 8 are stated by the current manual as "**any MBZ bit of CR4 is set**" and "**any MBZ bit of EFER is set**"; the fixed-mask forms `CR4[63:11]` and `EFER[63:15]` come from the 2005-era SVM manual, are superseded, and appear nowhere in Rev 3.45 — CR4 bits 11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are architecturally defined today, so the fixed masks would reject legal guest state.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Conditions 10, 11 and 12 are architectural consistency checks published in the manual's own list, not a hardening measure added later by any hypervisor.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Condition 13 means a VMM cannot decline to intercept VMRUN: the VMRUN intercept bit must be set in the guest's own intercept vector, which is what makes nested SVM interceptable at all — see `15-nested-virtualization.md`.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

### Canonicalization

- **Claim.** In addition to the consistency checks, VMRUN and `#VMEXIT` canonicalize — sign-extend to bit 63 — every loaded segment-register base address, `SSP`, `ISST_ADDR` and `PL0_SSP` through `PL3_SSP`.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

### The negative list: legal states that look illegal

This is the half that the pre-rebuild corpus lost, and it is the half that produces real bugs.

- **Claim.** A guest rIP that lies outside the limit of the guest code segment, or that is non-canonical in long mode, is **not** a consistency failure: VMRUN loads it and a `#GP` fault is delivered inside the guest.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** `CR0.PE = 0` with `CR0.PG = 1` — paged real mode — is explicitly legal for VMRUN to load, and RSM may likewise return to it; the mode behaves like real mode with paging applied.  `[APM2 §15.5.1]` `[APM2 §15.19]` `[1]` `C:high` `V:durable`
- **Claim.** The intended use of paged real mode is a guest at CPL 0 with page faults intercepted and a shadow page table supplying the mapping; running a guest in paged real mode *without* intercepting page faults is undefined behaviour.  `[APM2 §15.19]` `[1]` `C:high` `V:durable`
- **Claim.** The strength of the checking is not uniform. `TLB_CONTROL` encodings other than `00h`, `01h`, `03h` and `07h` are reserved, but no consistency check covers them — VMRUN reads the field, does not change it, and the enumerated list in §15.5 does not mention it; the field's own definition lives in `06-nested-paging.md`.  `[APM2 §15.5]` `[APM2 §15.16.1]` `[1]` `C:medium` `V:durable`

### Where the rest of the VMEXIT_INVALID conditions live

§15.5's list is not the only source of `VMEXIT_INVALID`; a dozen further conditions are stated
next to the feature that introduces them.

- **Claim.** Further `VMEXIT_INVALID` conditions are defined outside §15.5 — among them an IOPM or MSRPM whose last byte reaches the maximum supported physical address, a guest ASID of zero, `NP_ENABLE = 1` with `hCR0.PG` cleared, x2AVIC mode enabled without AVIC Enable, and an `AVIC_PHYSICAL_MAX_INDEX` above 255 in xAVIC mode or above 511 in x2AVIC mode when `Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) is 0 — so a VMM debugging a `−1` exit must consult the feature chapters as well: `03-intercepts.md`, `06-nested-paging.md` and `07-virtual-interrupts-avic.md`.  `[APM2 §15.10.1]` `[APM2 §15.11]` `[APM2 §15.25.1]` `[APM2 §15.25.3]` `[APM2 §15.29.4]` `[1]` `C:high` `V:durable`
- **Claim.** The clean-field interaction is defined: on processors that support clean-field designation, the final merged hardware state is used for the consistency checks, and that may include state from fields marked clean if the processor chooses to ignore the indication — the field itself is described in `02-vmcb.md`.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

## 4.3 #VMEXIT: what is restored and what is not

- **Claim.** `#VMEXIT` is the exit from guest context to host context that a triggered intercept performs; the host resumes at the instruction following the VMRUN.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### The ordered sequence

- **Claim.** `#VMEXIT` first clears `GIF`, disabling interrupts so that VMM software can complete the state switch atomically.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** It then writes the current guest state back to the VMCB — the same subset of processor state that VMRUN loads, including the `V_IRQ`, `V_TPR` and `INTERRUPT_SHADOW` bits.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** It records the reason for the exit in the VMCB `EXITCODE` field and, depending on the intercept, additional information in `EXITINFO1` or `EXITINFO2`; where their use is not indicated those two fields are undefined, and their per-intercept layouts are in `05-exit-decoding.md`.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** It then clears all intercepts, resets the current ASID register to zero (the host ASID), clears the internal `V_IRQ` and `V_INTR_MASKING` bits, and clears the internal `TSC_OFFSET`.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### The host state that comes back

- **Claim.** `#VMEXIT` reloads the host state that VMRUN saved, and the Vol.3 pseudo-code enumerates it in order: GDTR, IDTR, EFER, CR0 with `CR0.PE` forced to 1, CR4, CR3, the host PDPEs if the host is in PAE paging mode, RFLAGS, RIP, RSP, RAX, `DR7 = "all disabled"`, `CPL = 0`, and then the ES, CS, SS and DS selectors with their descriptors reloaded from the GDT.  `[APM3 §4 "VMRUN"]` `[APM2 §15.6]` `[1][2]` `C:high` `V:durable`
- **Claim.** Three items are explicitly excluded from that reload: host CR2, host PAT and the host LDTR — the pseudo-code annotates "Do not reload host CR2 or PAT", and immediately after `#VMEXIT` the processor still contains the *guest* value of LDTR.  `[APM3 §4 "VMRUN"]` `[APM2 §15.6]` `[1][2]` `C:high` `V:durable`
- **Claim.** Because LDTR still holds the guest value, for CS, SS, DS and ES the VMM must use only segment descriptors from the global descriptor table until it has restored its own LDTR, which is what VMSAVE and VMLOAD exist for.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** The host's segment descriptor tables must be mapped present and writable by the host page tables and must stay consistent with the host segment registers across VMRUN, because the processor may re-read the descriptors on the way out.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** `#VMEXIT` forces `CR0.PE = 1` and `RFLAGS.VM = 0`, sets the host CPL to zero, and disables all breakpoints in the host DR7.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### The three ways the exit path itself can fail

- **Claim.** Any exception encountered while reloading the host segments causes a shutdown.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** If the host is in PAE mode the processor reloads the host PDPEs from the page table indicated by the host CR3, and illegal state in those PDPEs causes a shutdown.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** The reloaded host state is itself checked for consistency and any error causes a shutdown — with one carved-out exception: a host rIP outside the host code-segment limit or non-canonical in long mode delivers a `#GP` fault inside the host instead.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

That last pair mirrors §4.2's negative list exactly: an out-of-limit or non-canonical instruction
pointer is a fault in the target context, never a state-validity failure.

## 4.4 VMLOAD and VMSAVE

- **Claim.** VMSAVE and VMLOAD transfer additional guest register context — including hidden context that software cannot otherwise reach — between the processor and a VMCB, giving a more complete context switch than VMRUN and `#VMEXIT` perform; the VMCB's system physical address is taken from rAX.  `[APM2 §15.5.2]` `[1]` `C:high` `V:durable`

### The exact field set

- **Claim.** The pair handles exactly this state: FS, GS, TR and LDTR including all hidden state; `KernelGsBase`; `STAR`, `LSTAR`, `CSTAR` and `SFMASK`; and `SYSENTER_CS`, `SYSENTER_ESP` and `SYSENTER_EIP`. SS is **not among them** — it is handled by VMRUN and `#VMEXIT` instead.  `[APM2 §15.5.2]` `[APM3 §4 "VMLOAD"]` `[1][2]` `C:high` `V:durable`
- **Claim.** The Vol.3 reference pages for the two instructions list the identical field set in the identical order, so the pair is exactly symmetric — VMLOAD reads what VMSAVE writes.  `[APM3 §4 "VMLOAD"]` `[APM3 §4 "VMSAVE"]` `[2]` `C:high` `V:durable`

### Privilege and faults

- **Claim.** Like VMRUN, both instructions are available only at CPL 0 (otherwise `#GP(0)`) and only in protected mode with `EFER.SVME = 1` (otherwise `#UD`); the Vol.3 pages add `#GP` for an rAX above the maximum supported physical address and for an rAX not aligned on a 4-Kbyte boundary.  `[APM2 §15.5.2]` `[APM3 §4 "VMSAVE"]` `[1][2]` `C:high` `V:durable`

### Ordering across a world switch

This is where the pre-rebuild corpus went wrong, and the correction is not a simple swap — it
depends on *which* VMCB is meant.

- **Claim.** With respect to the **guest's** VMCB the manual states the order plainly: "VMLOAD would be executed as desired prior to executing a VMRUN, and VMSAVE at any desired point after a `#VMEXIT`."  `[APM2 §15.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** With respect to a **host** VMCB the order is the mirror image, and follows from the instruction semantics rather than from an explicit statement: the hidden FS/GS/TR/LDTR state the pair covers is single-copy processor state that VMRUN and `#VMEXIT` do not swap, so a VMM that wants its own copy preserved must save it before VMRUN and load it back after `#VMEXIT`.  `[APM2 §15.5.2]` `[APM2 §15.6]` `[1]` `C:medium` `V:durable`
- **Claim.** The full four-instruction sequence therefore reads: save host extra state, load guest extra state, VMRUN, then on `#VMEXIT` save guest extra state and load host extra state — two VMSAVE/VMLOAD pairs against two different VMCBs, not one.  `[APM2 §15.5.2]` `[1]` `C:medium` `V:durable`

### Interaction with SEV-SNP

- **Claim.** On processors that support SEV-SNP, VMSAVE performs an RMP check on the target page: executed in host mode against a page that fails the check it raises `#GP(0)`, and executing VMSAVE inside an SEV-ES or SNP-active guest is not supported and produces `#VMEXIT(VMSAVE)` — the RMP itself is described in `14-sev-snp.md`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`

## 4.5 Virtualized VMLOAD/VMSAVE (VLS)

VLS is one of the two features that make nested SVM cheap. The pre-rebuild corpus advertised its
feature bit and then never defined the feature; here is the definition.

- **Claim.** VMSAVE and VMLOAD virtualization lets the two instructions execute in guest mode, with the guest supplying the VMCB address in RAX as a *guest* physical address that hardware then translates to a host physical address before saving or loading register state.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`
- **Claim.** Support is enumerated by `CPUID Fn8000_000A_EDX[15]`, named `VMSAVEvirt` in the CPUID table.  `[APM2 §15.33.1]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`
- **Claim.** The feature is enabled by setting bit 1 of the VMCB field at offset `0B8h`; AMD's documentation names the field only by that offset rather than as `VIRT_EXT`, which is the Linux/KVM identifier — see `02-vmcb.md` for the field's other bits.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`
- **Claim.** When VLS is enabled and the corresponding instruction intercept bits are *not* set, three checks run on a guest VMSAVE or VMLOAD: nested paging must be enabled, the hypervisor must be in 64-bit mode, and Secure Encrypted Virtualization must be disabled.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`
- **Claim.** If any of those three checks fails, `VMEXIT_VMSAVE` or `VMEXIT_VMLOAD` is generated — the failure is reported as the ordinary instruction-intercept exit, so a VMM cannot distinguish it from a genuine intercept by exit code alone.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`
- **Claim.** The intercept bits win: if the VMSAVE or VMLOAD intercept bit is set, the instruction is intercepted regardless of whether VLS is enabled.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`
- **Claim.** A page fault during the guest-physical to host-physical translation of the VMCB address generates `#VMEXIT(NPF)`, decoded in `05-exit-decoding.md`.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

## 4.6 The global interrupt flag: STGI and CLGI

GIF is a single bit with an outsized role: it is what makes the world switch atomic, and it is the
only thing standing between a half-loaded VMM and an NMI.

- **Claim.** The global interrupt flag controls whether interrupts and other events can be taken by the processor; STGI sets it and CLGI clears it.  `[APM2 §15.17]` `[1]` `C:high` `V:durable`

| Interrupt source | `GIF == 0` | `GIF == 1` |
|---|---|---|
| Debug exception/trap from a breakpoint register match | Ignored and discarded | Normal operation |
| Debug trace trap due to `EFLAGS.TF` | Normal operation | Normal operation |
| RESET | Normal operation | Normal operation |
| INIT | Held pending until `GIF == 1` | Normal operation |
| NMI | Held pending until `GIF == 1` | Normal operation |
| External SMI | Held pending until `GIF == 1` | Normal operation |
| Internal SMI (I/O trapping) | Ignored and discarded | Normal operation |
| INTR and vINTR | Held pending until `GIF == 1` | Normal operation |
| `#SX` | n/a | Normal operation |
| Machine check | Held pending until `GIF == 1` if the implementation can, otherwise shutdown | Normal operation |
| A20M | Normal operation | Normal operation |
| Other non-architecturally-visible interrupts (STPCLK, IGNNE toggle, ECC scrub) | Normal operation | Normal operation |

- **Claim.** The table above is the effect of GIF on interrupt handling; the three distinct behaviours matter — *held pending* for INIT, NMI, external SMI and INTR/vINTR, *ignored and discarded* for breakpoint-register debug exceptions and internally generated SMI, and *unaffected* for RESET, trace traps and A20M.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** `#SX` is marked "n/a" at `GIF == 0` for a structural reason rather than an omission: `#SX` is caused only by a redirected INIT, and the redirection happens only when `GIF == 1`, since otherwise the INIT is simply held pending.  `[APM2 Table 15-10]` `[APM2 §15.28]` `[1]` `C:high` `V:durable`
- **Claim.** Machine check is the one row whose behaviour is implementation-dependent: it is held pending until `GIF == 1` if possible, and causes a shutdown otherwise.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`

### Instruction-side conditions

- **Claim.** CLGI raises `#GP` when CPL is not 0, is recognised only in protected mode, and raises `#UD` when `Fn8000_0001_ECX[SVM] = 0` or when `EFER.SVME = 0`.  `[APM3 §4 "CLGI"]` `[2]` `C:high` `V:durable`
- **Claim.** STGI's `#UD` condition is *weaker* than CLGI's and this asymmetry is architectural: STGI raises `#UD` when `EFER.SVME = 0` only if **both** SVM-Lock is unavailable (`Fn8000_000A_EDX[SVML] = 0`) **and** the device exclusion vector is unavailable (`Fn8000_0001_ECX[SKINIT] = 0`); STGI still requires CPL 0 and protected mode.  `[APM3 §4 "STGI"]` `[2]` `C:high` `V:durable`
- **Claim.** The reason is that STGI is part of the SKINIT/DRTM story as well as the SVM story: `Fn8000_0001_ECX[12]` is documented as "SKINIT and STGI are supported", explicitly independent of the value of `MSRC000_0080[SVME]` — the DRTM use is in `17-security.md`.  `[APM3 App.E]` `[2]` `C:high` `V:durable`

### Where the mechanism side lives

- **Claim.** Hardware virtualization of GIF exists but is a nested-virtualization feature, enumerated by `CPUID Fn8000_000A_EDX[16]` and enabled by bit 25 (`VGIF_EN`) of the VMCB field at offset `60h`, with the virtual flag loaded on VMRUN from bit 9 of the same field and saved on `#VMEXIT`; the guest-visible behaviour is in `07-virtual-interrupts-avic.md`.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`
- **Claim.** As with VLS, the intercept bits take precedence: if the STGI or CLGI intercept bit is set, those instructions are intercepted regardless of whether virtual GIF is enabled.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`

## 4.7 INIT, SIPI and #SX

- **Claim.** INIT interrupts the processor at the next instruction boundary and reinitializes the control, segment and general-purpose registers in a manner similar to RESET without altering most MSRs, caches or x87/SSE state, then transfers control to physical address `FFFFFFF0h`; unlike RESET it is not expected to be visible to the memory controller and so does not trigger automatic clearing of trusted memory pages.  `[APM2 §15.21.8]` `[1]` `C:high` `V:durable`
- **Claim.** That last property is the whole motivation for INIT redirection: a VMM can ask for INITs to be turned into `#SX` exceptions by setting the `R_INIT` bit — bit 1 of the `VM_CR` MSR at `C001_0114h` — so that it gains control and can scrub sensitive context before letting the INIT through; `VM_CR`'s other bits are in `01-svm-intro.md`.  `[APM2 §15.21.8]` `[APM2 §15.30.1]` `[1]` `C:high` `V:durable`

| GIF | INIT intercept | INIT redirect | Processor response to INIT |
|---|---|---|---|
| 0 | X | X | Hold pending until `GIF = 1` |
| 1 | 1 | X | `#VMEXIT(INIT)`, INIT is still pending |
| 1 | 0 | 0 | Taken normally |
| 1 | 0 | 1 | `#SX`, INIT is no longer pending |

- **Claim.** The four rows above are the complete INIT disposition, and the pending-versus-consumed column is the operative difference: after `#VMEXIT(INIT)` the INIT is still pending, whereas after redirection to `#SX` it is no longer pending.  `[APM2 Table 15-12]` `[1]` `C:high` `V:durable`
- **Claim.** With redirection enabled but the INIT intercept disabled, an INIT asserted during guest execution produces `#SX` *inside the guest* with the INIT cleared; the VMM can still intercept the `#SX` through the exception intercepts described in `03-intercepts.md`.  `[APM2 §15.21.8]` `[1]` `C:high` `V:durable`
- **Claim.** Once a VMM has intercepted an INIT assertion it may modify `R_INIT` at any point before setting `GIF`, which is what lets it choose between taking the INIT itself and handing it to the guest as an `#SX`.  `[APM2 §15.21.8]` `[1]` `C:high` `V:durable`

### The #SX exception itself

- **Claim.** `#SX` dispatches to **vector 30**, behaves like other fault-class exceptions such as `#GP`, pushes an error code, and is a contributory fault.  `[APM2 §15.28]` `[1]` `C:high` `V:durable`
- **Claim.** Exactly one `#SX` error code is currently defined — the value **1**, indicating that redirection of INIT has occurred.  `[APM2 §15.28]` `[1]` `C:high` `V:durable`
- **Claim.** When the `#SX` intercept is taken, `EXITINFO1` holds the error code that `#SX` would have pushed and `EXITINFO2` is undefined — the exception-intercept exit information is tabulated in `05-exit-decoding.md`.  `[APM2 §15.12.20]` `[1]` `C:high` `V:durable`

### SIPI and AP bring-up

- **Claim.** Startup-IPI behaviour is modified after a DRTM launch: each application processor responds to a startup IPI by additionally clearing its `GIF` and setting the `DPD`, `R_INIT` and `DIS_A20M` flags in `VM_CR`, if and only if the bootstrap processor has indicated that it executed SKINIT; all other aspects of startup-IPI behaviour are unchanged.  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`
- **Claim.** Because the AP wakes with `GIF` clear, device interrupts pending before the INIT IPI, and SMI, INIT and NMI asserted after the AP accepted the INIT IPI, all stay pending until software sets `GIF` to 1 on that AP — so the AP startup code must set `GIF` itself before normal operation resumes; the surrounding DRTM sequence is in `17-security.md`.  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`

## 4.8 Instruction reference: encodings, operands and exceptions

APM Vol.3 Chapter 4 "System Instruction Reference" is alphabetical and carries page numbers only —
it has no subsection numbers, so the only correct citation form for an instruction there is the
mnemonic. The printed page numbers below are from Rev 3.38.

| Mnemonic | Opcode | Operand | CPL | `#UD` when | `#GP` when |
|---|---|---|---|---|---|
| `VMRUN rAX` | `0F 01 D8` | VMCB physical address in rAX | 0 | `ECX[SVM] = 0`; `EFER.SVME = 0`; not protected mode | CPL ≠ 0; rAX above max physical address; rAX not 4-Kbyte aligned |
| `VMLOAD rAX` | `0F 01 DA` | VMCB physical address in rAX | 0 | same as VMRUN | same as VMRUN |
| `VMSAVE rAX` | `0F 01 DB` | VMCB physical address in rAX | 0 | same as VMRUN | same as VMRUN |
| `VMMCALL` | `0F 01 D9` | none | any | `ECX[SVM] = 0`; `EFER.SVME = 0`; **VMMCALL was not intercepted** | — |
| `VMGEXIT` | `F2/F3 0F 01 D9` | none | any | `ECX[SVM] = 0`; `EFER.SVME = 0` | — |
| `STGI` | `0F 01 DC` | none | 0 | `EFER.SVME = 0` **and** `SVML = 0` **and** `ECX[SKINIT] = 0`; not protected mode | CPL ≠ 0 |
| `CLGI` | `0F 01 DD` | none | 0 | `ECX[SVM] = 0`; `EFER.SVME = 0`; not protected mode | CPL ≠ 0 |
| `SKINIT EAX` | `0F 01 DE` | SLB physical base in EAX | 0 | `EFER.SVME = 0` **and** `SVML = 0` **and** `ECX[SKINIT] = 0`; not protected mode | CPL ≠ 0 |
| `INVLPGA rAX, ECX` | `0F 01 DF` | linear address in rAX, ASID in ECX | 0 | `ECX[SVM] = 0`; `EFER.SVME = 0`; not protected mode | CPL ≠ 0 |

- **Claim.** The nine rows above give the encodings, operands, privilege requirement and fault conditions as printed on the Vol.3 reference pages for VMRUN (p.503), VMLOAD (p.500), VMSAVE (p.508), VMMCALL (p.502), VMGEXIT (p.502), STGI (p.480), CLGI (p.382), SKINIT (p.472) and INVLPGA (p.396) in Rev 3.38; the last two are listed here for their encodings only, their subject matter belonging to `13-sev-es-ghcb.md` and `06-nested-paging.md` respectively.  `[APM3 §4 "VMRUN"]` `[APM3 §4 "STGI"]` `[2]` `C:high` `V:durable`
- **Claim.** `ECX[SVM]` above is `Fn8000_0001_ECX` bit 2 and `ECX[SKINIT]` is bit 12 of the same register; `SVML` is `Fn8000_000A_EDX` bit 2.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** VMMCALL performs no CPL checks at all, deliberately: the VMM decides whether to make the hypercall legal at user level, and a non-intercepted VMMCALL raises `#UD`.  `[APM2 §15.18]` `[APM3 §4 "VMMCALL"]` `[1][2]` `C:high` `V:durable`
- **Claim.** VMGEXIT shares VMMCALL's opcode with a mandatory prefix and both `F2` and `F3` forms are architectural; it is always intercepted and unconditionally causes a `#VMEXIT`, is enumerated by `Fn8000_001F_EAX[SEV-ES]`, and is interpreted as VMMCALL on processors that do not support it or when it is not executed by an SEV-ES guest — the protocol it carries is in `13-sev-es-ghcb.md`.  `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
- **Claim.** INVLPGA is a serializing and privileged instruction that invalidates the TLB mapping for the guest *virtual* page in rAX within the ASID in ECX, may invalidate additional entries, and gives no way to invalidate a nested translation by guest physical address; its role in TLB management is in `06-nested-paging.md`.  `[APM2 §15.16.2]` `[APM3 §4 "INVLPGA"]` `[1][2]` `C:high` `V:durable`
- **Claim.** SKINIT's own action sets `VM_CR.DPD`, `VM_CR.R_INIT` and `VM_CR.DIS_A20M` to 1, clears `GIF`, zeroes EFER, forces `CR0.PE = 1` with flat 32-bit CS and SS, and clears all GPRs other than EAX, EDX and ESP before jumping to the secure-loader entry point — see `17-security.md`.  `[APM3 §4 "SKINIT"]` `[2]` `C:high` `V:durable`

### "Eight instructions, all announced by one CPUID bit" is wrong three ways

- **Claim.** `Fn8000_0001_ECX[2]` is not the sole gate. STGI and SKINIT are separately enumerated by `Fn8000_0001_ECX[12]`, whose description is "SKINIT and STGI are supported" and which is explicitly independent of `MSRC000_0080[SVME]`; VMGEXIT is enumerated by `Fn8000_001F_EAX[SEV-ES]`; and the six SEV-SNP instructions live in the same Vol.3 chapter without being gated on `ECX[2]` at all — see `14-sev-snp.md`.  `[APM3 App.E]` `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`

### MCOMMIT

MCOMMIT is not an SVM instruction, but it acquired an SVM intercept and an EFER bit, and the EFER
bit is the reason it appears here: treating EFER bit 17 as MBZ turns a legal guest state into a
spurious `VMEXIT_INVALID` (§4.2, condition 8).

- **Claim.** MCOMMIT is encoded `F3 0F 01 FA`, may be executed at any privilege level, uses the same ordering rules as SFENCE, and reports through `rFLAGS.CF` — cleared to zero if delayed-reporting store errors are present, set to one otherwise.  `[APM3 Ch.3]` `[2]` `C:high` `V:durable`
- **Claim.** Support is enumerated by `CPUID Fn8000_0008_EBX[MCOMMIT]`, bit 8, and the instruction must be explicitly enabled by the OS by setting `EFER.MCOMMIT` — **EFER bit 17** — or attempted execution raises `#UD`.  `[APM3 Ch.3]` `[APM2 §3.1.7]` `[1][2]` `C:high` `V:durable`
- **Claim.** MCOMMIT has its own SVM intercept, bit 3 of the intercept vector at VMCB offset `014h`, which produces exit code `A3h`; the intercept bit itself is catalogued in `03-intercepts.md`.  `[APM2 App.B]` `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** The errors MCOMMIT reports are platform-specific, are visible only through MCOMMIT and the platform's error-logging registers, and are **not** visible to the Machine Check Architecture.  `[APM3 Ch.3]` `[2]` `C:high` `V:durable`

## 4.9 Open items

- **The host-side VMSAVE/VMLOAD pairing is a derivation, not a quotation.** §15.5.2 states the
  ordering only for the guest's VMCB. The mirror-image host-side sequence in §4.4 follows from the
  instruction semantics and from the fact that `#VMEXIT` does not restore LDTR, but AMD never
  writes the four-instruction sequence out. Both claims carry `C:medium` for that reason.

- **The reserved-`TLB_CONTROL` claim is an argument from absence.** §15.5's enumerated list does
  not mention `TLB_CONTROL` and §15.16.1 says only that VMRUN reads the field without changing it.
  No sentence in Rev 3.45 says a reserved encoding is *accepted*; the claim is that nothing says it
  is rejected. Marked `C:medium`.

- **"At least the following" is an open set, twice.** Both §15.5.1's host-save list and §15.6's
  `#VMEXIT` description are qualified; the Vol.3 pseudo-code is more complete than the Vol.2 prose,
  which is why §4.1 and §4.3 cite both. A future revision may add to either without renumbering
  anything, so a VMM must not treat either list as closed.

- **The `#SX` error-code space is open.** §15.28 says "the only error code currently defined is 1".
  Any reader who finds another value in the wild is looking at a newer manual than Rev 3.45.

- **VMRUN inside SMM is undefined, not faulting.** The manual declines to specify behaviour rather
  than defining a fault. There is nothing further to look up; the correct engineering answer is that
  the case must not be reachable.

- **Not covered here.** The VMCB field offsets this chapter refers to (`0B8h`, `60h`, `014h`) are
  owned by `02-vmcb.md`; which intercept bit produces which exit is `03-intercepts.md`; the exit
  codes and exit information are `05-exit-decoding.md`; nested-paging effects on the world switch
  are `06-nested-paging.md`; and the SEV-ES/SNP variants of the VMRUN flow are `13-sev-es-ghcb.md`
  and `14-sev-snp.md`.
