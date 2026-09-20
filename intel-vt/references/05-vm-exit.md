# 05. VM Exits

> **中文速览**：本章是 VM-exit 侧的查表章，对应 SDM Vol.3C 第 30 章 "VM Exits" 与 Vol.3D 附录 C "VMX Basic Exit Reasons"。内容分三块：完整的 basic exit reason 编号表（0 起，逐项列名）、各类 exit qualification 的位布局（CR 访问、MOV DR、I/O 指令、task switch、APIC access、EPT violation、#DB、描述符表与 VMX 指令），以及 VM-exit information fields、IDT-vectoring 字段、保存 guest 状态 / 加载 host 状态的时序与 VMX abort。调试一次未知退出的标准动作是：读 exit reason 低 16 位 → 按本章定位 qualification 格式 → 读 instruction length / instruction information → 决定模拟还是注入。特别注意 §5.4.6 对 EPT violation qualification bit 6 / bit 7 的更正，旧资料这两位普遍是错的。VM-entry 侧见 `04-vm-entry.md`，VMCS 字段定义见 `02-vmcs.md`。

**Maps to:** Intel SDM Vol.3C Ch.30 "VM Exits" (rev 092) [1] and Vol.3D App.C "VMX Basic Exit Reasons" [2]
**Owns:** basic exit reasons, exit qualification formats, VM-exit information fields, IDT-vectoring information, guest-state saving, host-state loading, and VMX aborts.
**See also:** `02-vmcs.md` (VMCS field definitions and control bits) · `04-vm-entry.md` §4.9 (VM-entry failures reported as exit reasons 33/34/41) · `08-vmx-instructions.md` §8.4 (VM-instruction error numbers)

---

## 5.1 The shape of a VM exit

A VM exit is the transition from VMX non-root operation back to VMX root operation. Unlike a trap, it is not delivered through the IDT: the processor performs a bulk state swap described entirely by the VMCS and resumes the VMM at the host RIP. Nothing about the transition is asynchronous with respect to the VMCS — the exit information fields are written before host state is loaded, so the VMM always finds a consistent description of why it was called.

- **Claim.** A VM exit begins in VMX non-root operation and ends in VMX root operation, with the processor resuming at the RIP in the host-state area; VM exits are not delivered through the IDT and do not use the guest's descriptor tables.  `[SDM 3C Ch.30]` `[1]` `C:high` `V:durable`
- **Claim.** The architectural order of a VM exit is: record VM-exit information, save guest state into the guest-state area, save MSRs listed in the VM-exit MSR-store area, load host state from the host-state area, load MSRs from the VM-exit MSR-load area, and then begin execution in VMX root operation.  `[SDM 3C Ch.30]` `[1]` `C:high` `V:durable`
- **Claim.** State that is defined to be the same before and after a VM exit — general-purpose registers, and x87/SSE/AVX state — is neither saved nor restored by the VM exit; the VMM must save and restore it in software.  `[SDM 3C §30.1]` `[1]` `C:high` `V:durable`
- **Claim.** Before a VM exit, the architectural state is that of the guest at an instruction boundary (or at the point an event was recognized); §30.1 defines exactly which state that is for each class of exit.  `[SDM 3C §30.1]` `[1]` `C:high` `V:durable`
- **Claim.** Some events cause VM exits unconditionally in VMX non-root operation regardless of the VM-execution controls: among them CPUID, GETSEC, INVD, XSETBV, VMCALL, the other VMX instructions, triple fault, task switch, and INIT and SIPI signals.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`

---

## 5.2 The exit-reason field

- **Claim.** The exit-reason field is 32 bits wide; bits 15:0 contain the basic exit reason.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 31 of the exit-reason field is the VM-entry-failure indicator: 0 for a VM exit from a running guest, 1 for a VM entry that failed after loading guest state.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 27 of the exit-reason field is set when the VM exit occurred while the logical processor was in enclave mode.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Bit 28 of the exit-reason field indicates a pending MTF VM exit.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Bit 29 of the exit-reason field indicates a VM exit from VMX root operation, which occurs only under the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Bits 26:16 and bit 30 of the exit-reason field are reserved and cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** The exit-reason field is filled in by the processor on every VM exit as part of "recording VM-exit information".  `[SDM 3C §30.2.1]` `[1]` `C:high` `V:durable`

> Consequence for exit dispatch: a handler must mask the exit reason with 0xFFFF before indexing a dispatch table, and must test bit 31 *first*, because 8000_0021H and 8000_0022H are not guest exits at all (see `04-vm-entry.md` §4.9).

---

## 5.3 Basic exit reasons

The authoritative list is Vol.3D Appendix C. The numbers below are also the values used by production hypervisors (Linux KVM, Xen, FreeBSD bhyve), which gives an independent cross-check on every entry.

- **Claim.** The basic exit reason numbering reproduced below was cross-checked against three independent open-source implementations — Linux KVM, Xen and FreeBSD bhyve — whose constant tables agree with each other and with Appendix C.  `[SDM 3D App.C]` `[2]` `[150]` `[151]` `[152]` `C:high` `V:durable`
- **Claim.** Basic exit reason 0 — *Exception or non-maskable interrupt (NMI)*: a guest exception selected by the exception bitmap, or an NMI when "NMI exiting" is 1.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 1 — *External interrupt*, reported when the "external-interrupt exiting" pin-based control is 1.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 2 — *Triple fault*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 3 — *INIT signal*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 4 — *Start-up IPI (SIPI)*, delivered only in the wait-for-SIPI activity state.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 5 — *I/O system-management interrupt (SMI)*, which occurs only under the dual-monitor treatment of SMIs and SMM.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 6 — *Other SMI*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 7 — *Interrupt window*, taken when "interrupt-window exiting" is 1 and the guest becomes ready to accept an interrupt.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 8 — *NMI window*, taken when "NMI-window exiting" is 1 and virtual-NMI blocking ends.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 9 — *Task switch*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 10 — *CPUID*; CPUID always causes a VM exit in VMX non-root operation.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 11 — *GETSEC*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 12 — *HLT*, conditional on the "HLT exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 13 — *INVD*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 14 — *INVLPG*, conditional on the "INVLPG exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 15 — *RDPMC*, conditional on the "RDPMC exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 16 — *RDTSC*, conditional on the "RDTSC exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 17 — *RSM*, taken when RSM executes in VMX non-root operation under the dual-monitor treatment.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 18 — *VMCALL*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 19 — *VMCLEAR*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 20 — *VMLAUNCH*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 21 — *VMPTRLD*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 22 — *VMPTRST*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 23 — *VMREAD*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 24 — *VMRESUME*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 25 — *VMWRITE*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 26 — *VMXOFF*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 27 — *VMXON*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 28 — *Control-register accesses*, covering MOV to/from CR, CLTS and LMSW.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 29 — *MOV DR*, conditional on the "MOV-DR exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 30 — *I/O instruction*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 31 — *RDMSR*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 32 — *WRMSR*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 33 — *VM-entry failure due to invalid guest state*; always accompanied by bit 31 of the exit-reason field being set.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 34 — *VM-entry failure due to MSR loading*; always accompanied by bit 31 of the exit-reason field being set.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 35 is not used.  `[SDM 3D App.C]` `[2]` `[150]` `C:medium` `V:durable`
- **Claim.** Basic exit reason 36 — *MWAIT*, conditional on the "MWAIT exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 37 — *Monitor trap flag*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 38 is not used.  `[SDM 3D App.C]` `[2]` `[150]` `C:medium` `V:durable`
- **Claim.** Basic exit reason 39 — *MONITOR*, conditional on the "MONITOR exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 40 — *PAUSE*, taken under "PAUSE exiting" or PAUSE-loop exiting.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 41 — *VM-entry failure due to machine-check event*; accompanied by bit 31 of the exit-reason field being set.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 42 is not used.  `[SDM 3D App.C]` `[2]` `[150]` `C:medium` `V:durable`
- **Claim.** Basic exit reason 43 — *TPR below threshold*, taken when "use TPR shadow" is 1 and the virtual TPR falls below the TPR threshold.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 44 — *APIC access*, taken on a guest access to the APIC-access page when "virtualize APIC accesses" is 1.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 45 — *Virtualized EOI*, taken when EOI virtualization writes a vector whose bit is set in the EOI-exit bitmap.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 46 — *Access to GDTR or IDTR* (LGDT, LIDT, SGDT, SIDT), conditional on the "descriptor-table exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 47 — *Access to LDTR or TR* (LLDT, LTR, SLDT, STR), conditional on the "descriptor-table exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 48 — *EPT violation*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 49 — *EPT misconfiguration*, caused by a malformed EPT paging-structure entry rather than by a permission failure.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 50 — *INVEPT*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 51 — *RDTSCP*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 52 — *VMX-preemption timer expired*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 53 — *INVVPID*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 54 — *WBINVD* (and WBNOINVD), conditional on the "WBINVD exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 55 — *XSETBV*; XSETBV always causes a VM exit in VMX non-root operation.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 56 — *APIC write*, a trap-like exit that follows a virtualized write to the virtual-APIC page.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 57 — *RDRAND*, conditional on the "RDRAND exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 58 — *INVPCID*, taken when "enable INVPCID" is 0 and "INVLPG exiting" is 1.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 59 — *VMFUNC*, taken when a VMFUNC invocation cannot complete in VMX non-root operation.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 60 — *ENCLS*, conditional on the "enable ENCLS exiting" control and the ENCLS-exiting bitmap.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 61 — *RDSEED*, conditional on the "RDSEED exiting" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 62 — *Page-modification log full*.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 63 — *XSAVES*, conditional on "enable XSAVES/XRSTORS" and the XSS-exiting bitmap.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 64 — *XRSTORS*, conditional on "enable XSAVES/XRSTORS" and the XSS-exiting bitmap.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 66 — *SPP-related event*, reported for sub-page write permissions for EPT.  `[SDM 3D App.C]` `[2]` `[150]` `C:medium` `V:durable`
- **Claim.** Basic exit reason 67 — *UMWAIT*, conditional on the "enable user wait and pause" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 68 — *TPAUSE*, conditional on the "enable user wait and pause" control.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 74 — *Bus lock*, reported when the "bus-lock detection" control is 1 and the guest asserts a bus lock.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason 75 — *Notify window*, reported when the "notify VM exiting" control is 1 and the notify window expires without an instruction retiring.  `[SDM 3D App.C]` `[2]` `[150]` `C:high` `V:durable`
- **Claim.** Basic exit reason values between 68 and 74, and values above 75, are allocated for further features; this chapter deliberately does not enumerate them because the numbering could not be verified against Appendix C at the time of writing.  `[SDM 3D App.C]` `[2]` `C:low` `V:durable`

---

### 5.3.0 Unconditional versus controllable exit reasons

- **Claim.** CPUID, GETSEC, INVD, XSETBV and VMCALL always cause VM exits in VMX non-root operation; no VM-execution control can disable them.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF, VMXON, INVEPT and INVVPID always cause VM exits in VMX non-root operation; VMREAD and VMWRITE do so unless VMCS shadowing is in use (see `14-nested-virtualization.md`).  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** Triple fault, task switch, INIT signal and start-up IPI always cause VM exits in VMX non-root operation.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** Exceptions cause VM exits only when the corresponding bit of the exception bitmap is 1, with the special case of the page-fault error-code mask and match fields for vector 14.  `[SDM 3C §27.6.3]` `[1]` `C:high` `V:durable`
- **Claim.** RDMSR and WRMSR cause unconditional VM exits unless "use MSR bitmaps" is 1, in which case the bitmaps decide, and any MSR index outside the two ranges the bitmaps cover always exits.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`
- **Claim.** I/O instructions cause unconditional VM exits when "unconditional I/O exiting" is 1, and are decided by the I/O bitmaps when "use I/O bitmaps" is 1; when both are 0 they execute in the guest.  `[SDM 3C §27.6.4]` `[1]` `C:high` `V:durable`

---

### 5.3.1 Fault-like versus trap-like VM exits

The single most consequential property of an exit reason, for a VMM author, is whether guest RIP already points past the instruction. Getting this wrong produces either an infinite exit loop or a skipped instruction.

- **Claim.** For a VM exit caused by an attempt to execute an instruction — CPUID, HLT, RDMSR, WRMSR, the I/O instructions, MOV CR, MOV DR, the VMX instructions and so on — the saved guest RIP points at the instruction that caused the exit, and the VMM must add the VM-exit instruction length to it after emulating.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** For a VM exit caused by an EPT violation, an EPT misconfiguration or a page-fault exception, the saved guest RIP also points at the faulting instruction, but the instruction must be re-executed rather than skipped, so the VMM must not advance RIP.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** For an APIC-write VM exit (reason 56) the access has already completed; it is trap-like, and the saved RIP is past the instruction.  `[SDM 3C §30.3]` `[1]` `C:medium` `V:durable`
- **Claim.** For a VM exit due to an external interrupt, an NMI, an INIT signal, a SIPI, the VMX-preemption timer, an interrupt window or an NMI window, no instruction is being emulated and the saved RIP is the point at which the guest will resume unchanged.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** A monitor-trap-flag VM exit (reason 37) is taken after an instruction retires or after an event is delivered, so it is trap-like and the saved RIP already reflects the completed operation.  `[SDM 3C §30.3]` `[1]` `C:medium` `V:durable`

---

## 5.4 Exit qualification

- **Claim.** The exit qualification is a 64-bit read-only VM-exit information field whose format depends on the basic exit reason; it is defined in §27.9.1 and populated according to §30.2.1.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** The exit qualification carries meaningful information for VM exits due to debug exceptions, page-fault exceptions, start-up IPIs, task switches, INVEPT, INVLPG, INVPCID, INVVPID, LGDT, LIDT, LLDT, LTR, SGDT, SIDT, SLDT, STR, VMCLEAR, VMPTRLD, VMPTRST, VMREAD, VMWRITE, VMXON, XRSTORS, XSAVES, control-register accesses, MOV DR, I/O instructions, MWAIT, APIC accesses, EPT violations, and SPP-related events.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** For VM exits whose reason has no defined exit qualification format, the field's value is undefined and must not be interpreted.  `[SDM 3C §30.2.1]` `[1]` `C:high` `V:durable`

### 5.4.1 Control-register access (reason 28)

- **Claim.** For a control-register-access VM exit, exit-qualification bits 3:0 give the number of the control register; the field is 0 for CLTS and for LMSW.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 5:4 give the access type: 0 = MOV to CR, 1 = MOV from CR, 2 = CLTS, 3 = LMSW.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 6 is the LMSW operand type: 0 = register, 1 = memory; it is undefined for access types other than LMSW.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 11:8 identify the general-purpose register for a MOV to or from CR, encoded 0 = RAX, 1 = RCX, 2 = RDX, 3 = RBX, 4 = RSP, 5 = RBP, 6 = RSI, 7 = RDI, and 8–15 = R8–R15.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 31:16 carry the LMSW source data; bit 7 and bits 15:12 are reserved and cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Because the exit qualification fully decodes the access, a VMM never needs to disassemble the guest instruction stream to emulate a MOV CR, CLTS or LMSW.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

### 5.4.2 MOV DR (reason 29)

- **Claim.** For a MOV-DR VM exit, exit-qualification bits 2:0 give the debug-register number, bit 4 gives the direction (0 = MOV to DR, 1 = MOV from DR), and bits 11:8 identify the general-purpose register using the same encoding as the control-register case.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 3 and bits 7:5 of a MOV-DR exit qualification are reserved and cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

### 5.4.3 I/O instruction (reason 30)

- **Claim.** For an I/O-instruction VM exit, exit-qualification bits 2:0 give the size of the access: 0 = 1 byte, 1 = 2 bytes, 3 = 4 bytes (values 2, 4, 5, 6 and 7 are not used).  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 3 gives the direction: 0 = OUT, 1 = IN.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 4 is set for a string instruction (INS or OUTS) and bit 5 is set if the instruction had a REP prefix.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 6 gives the operand encoding: 0 = the port number came from DX, 1 = the port number was an immediate operand.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 31:16 contain the port number; bits 15:7 are reserved and cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** For INS and OUTS, the guest-linear address field of the VMCS holds the linear address of the source or destination, and the VM-exit instruction information field identifies the segment and address size.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** Whether the processor reports instruction information for INS and OUTS is itself a capability, reported by bit 54 of IA32_VMX_BASIC.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 5.4.4 Task switch (reason 9)

- **Claim.** For a task-switch VM exit, exit-qualification bits 15:0 contain the selector of the task-state segment the guest attempted to switch to.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 31:30 give the source of the task switch: 0 = CALL instruction, 1 = IRET instruction, 2 = JMP instruction, 3 = task gate in the IDT.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 29:16 of a task-switch exit qualification are reserved and cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** A task switch initiated through an IDT task gate during event delivery leaves the IDT-vectoring information field valid, so the VMM can reconstruct the event that caused the switch.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`

### 5.4.5 APIC access (reason 44)

- **Claim.** For an APIC-access VM exit caused by a linear access, exit-qualification bits 11:0 contain the offset of the access within the APIC-access page.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bits 15:12 give the access type: 0 = linear access for a data read during instruction execution; 1 = linear access for a data write during instruction execution; 2 = linear access for an instruction fetch; 3 = linear access (read or write) during event delivery; 10 = guest-physical access during event delivery; 15 = guest-physical access for an instruction fetch or during instruction execution.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** For access types 10 and 15 the offset field (bits 11:0) is undefined, because the access was made with a guest-physical address rather than through the APIC-access page's linear mapping.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`

### 5.4.6 EPT violation (reason 48) — including two corrections

This is the exit qualification most often reproduced incorrectly in secondary material. The two errors corrected here are recorded in `errata.md`.

- **Claim.** Exit-qualification bit 0 is set if the access causing the EPT violation was a data read.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 1 is set if the access causing the EPT violation was a data write; a read-modify-write access always sets bit 1, while whether it also sets bit 0 is implementation-specific.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 2 is set if the access causing the EPT violation was an instruction fetch.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 3 is the logical-AND of bit 0 (read access) of the EPT paging-structure entries used to translate the address of the access.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 4 is the logical-AND of bit 1 (write access) of the EPT paging-structure entries used to translate the address of the access.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 5 is the logical-AND of bit 2 of the EPT paging-structure entries used for the translation; when mode-based execute control for EPT is 0 this is execute access, and when it is 1 it is supervisor-mode execute access.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** **Exit-qualification bit 6 is the logical-AND of bit 10 — user-mode execute access — of the EPT paging-structure entries used for the translation, and it is defined only when mode-based execute control for EPT is enabled; it is not a property of the execute-disable bit.**  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** **Exit-qualification bit 7 is set if the guest-linear-address field of the VMCS is valid for this VM exit.**  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 8 is defined only when bit 7 is set: it is clear when the access was to a guest paging-structure entry during a page walk, and set when the access was a translation of a guest-linear address.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 9 is defined only when bits 7 and 8 are both set and the processor supports advanced VM-exit information for EPT violations: it is set if the linear address was a user-mode address and clear if it was a supervisor-mode address.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Exit-qualification bit 10, under the same conditions as bit 9, is set if the guest paging-structure entries used for the translation allow write accesses.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Exit-qualification bit 11, under the same conditions as bit 9, is set if the guest paging-structure entries used for the translation disallow instruction fetches (that is, the execute-disable bit applies).  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Exit-qualification bit 12 indicates NMI unblocking due to IRET, the same condition recorded for other exits in §30.2.3.  `[SDM 3C §30.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 13 is set if the access causing the EPT violation was a shadow-stack access.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Bits of the EPT-violation exit qualification above bit 13 encode further features (including supervisor shadow-stack control and HLAT-related indications) that this chapter does not enumerate, because their bit positions could not be verified.  `[SDM 3C §27.9.1]` `[1]` `C:low` `V:durable`
- **Claim.** On an EPT violation the guest-physical address field of the VMCS always holds the address whose translation failed; the guest-linear address field is meaningful only when exit-qualification bit 7 is set.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT misconfiguration (reason 49) reports the guest-physical address but has no defined exit qualification format, because the fault is in the structure of an EPT paging-structure entry rather than in the access.  `[SDM 3C §30.2.1]` `[1]` `C:medium` `V:durable`

### 5.4.7 Debug exception (#DB, reason 0)

- **Claim.** For a VM exit due to a debug exception, exit-qualification bits 3:0 are B0 through B3, indicating which breakpoint conditions were met.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 13 is BD (debug-register access detected) and bit 14 is BS (single-step), matching the corresponding DR6 bit positions.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Exit-qualification bit 16 is the RTM bit, set when the debug exception was associated with a transactional region.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Bits 12:4, bit 15 and bits 63:17 of a debug-exception exit qualification are reserved; the reserved bits below bit 16 are cleared to 0.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** For a VM exit due to a page-fault exception, the exit qualification contains the linear address that caused the fault — the value that would have been loaded into CR2.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

### 5.4.8 Descriptor-table and VMX-instruction exits

- **Claim.** For VM exits due to LGDT, LIDT, LLDT, LTR, SGDT, SIDT, SLDT, STR, VMCLEAR, VMPTRLD, VMPTRST, VMREAD, VMWRITE, VMXON, XRSTORS and XSAVES, the exit qualification receives the value of the instruction's displacement field, sign-extended to 64 bits where necessary.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** If such an instruction has no displacement — for example because its operand is a register — the exit qualification is 0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** For RIP-relative addressing in 64-bit mode, the exit qualification receives the sum of the displacement and the RIP of the following instruction, that is, the computed effective address.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT, INVPCID and INVVPID follow the same displacement rule for their memory operand.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** These exits also fill in the VM-exit instruction information field, which supplies the scaling, index register, base register, segment register and address size needed to recompute the effective address.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** In the instruction information field for descriptor-table exits, the instruction identity is encoded as 0 = SGDT, 1 = SIDT, 2 = LGDT, 3 = LIDT for GDTR/IDTR accesses, and as 0 = SLDT, 1 = STR, 2 = LLDT, 3 = LTR for LDTR/TR accesses.  `[SDM 3C §27.9.4]` `[1]` `C:medium` `V:durable`
- **Claim.** The segment register in the instruction information field is encoded 0 = ES, 1 = CS, 2 = SS, 3 = DS, 4 = FS, 5 = GS.  `[SDM 3C §27.9.4]` `[1]` `C:medium` `V:durable`

### 5.4.9 Other qualification cases

- **Claim.** For a VM exit due to a start-up IPI (reason 4), the exit qualification contains the SIPI vector in bits 7:0.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** For a VM exit due to MWAIT (reason 36), the exit qualification indicates whether address-range monitoring hardware was armed at the time of the instruction.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** For a VM exit due to INVLPG (reason 14), the exit qualification contains the linear operand of the instruction.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

---

### 5.4.10 Which information field to read for which exit

| Basic exit reason | Read these fields |
|---|---|
| 0 (exception/NMI) | VM-exit interruption information, interruption error code, and — for #PF and #DB — the exit qualification |
| 1 (external interrupt) | VM-exit interruption information, but only if "acknowledge interrupt on exit" is 1 |
| 9 (task switch) | Exit qualification, IDT-vectoring information |
| 28, 29, 30 (CR, DR, I/O) | Exit qualification; for INS/OUTS also guest-linear address and instruction information |
| 31, 32 (RDMSR, WRMSR) | Guest RCX for the MSR index; no exit qualification |
| 44 (APIC access) | Exit qualification; guest-linear address for linear accesses |
| 46, 47 (descriptor table) | Exit qualification (displacement), instruction information |
| 48 (EPT violation) | Exit qualification, guest-physical address, and guest-linear address when qualification bit 7 is set |
| 49 (EPT misconfiguration) | Guest-physical address only |
| 19–27, 50, 53 (VMX instructions) | Exit qualification (displacement), instruction information |
| 33, 34, 41 | Exit qualification only; treat as a VM-entry failure, not a guest exit |

- **Claim.** The guest RCX, RDX and other general-purpose registers are not VMCS fields; a VMM handling RDMSR, WRMSR or CPUID reads them from the register save area it maintains itself, not with VMREAD.  `[SDM 3C §30.1]` `[1]` `C:high` `V:durable`
- **Claim.** All VM-exit information fields are read-only: VMWRITE to them fails with VM-instruction error 13 unless the processor reports the capability to write them (see `08-vmx-instructions.md` §8.3.7).  `[SDM 3C §27.9]` `[1]` `C:high` `V:durable`

---

## 5.5 VM-exit information fields for vectored events

- **Claim.** The VM-exit interruption-information field is 32 bits wide: bits 7:0 vector, bits 10:8 interruption type, bit 11 error-code valid, bit 12 NMI unblocking due to IRET, bits 30:13 reserved, bit 31 valid.  `[SDM 3C §27.9.2]` `[1]` `C:high` `V:durable`
- **Claim.** The interruption types reported in bits 10:8 of the VM-exit interruption-information field are 0 external interrupt, 2 non-maskable interrupt (NMI), 3 hardware exception, 6 software exception, and 7 other event.  `[SDM 3C §27.9.2]` `[1]` `C:high` `V:durable`
- **Claim.** When bit 11 (error-code valid) is 1, the VM-exit interruption error code field contains the error code that would have been pushed on the guest stack.  `[SDM 3C §27.9.2]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 12 of the VM-exit interruption-information field records NMI unblocking due to IRET: the guest was executing an IRET that removed NMI blocking before the fault that caused the VM exit, so the VMM must restore NMI blocking before resuming.  `[SDM 3C §30.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** If the "acknowledge interrupt on exit" VM-exit control is 1, an external-interrupt VM exit acknowledges the interrupt controller, acquires the vector, and stores it in the VM-exit interruption-information field with the valid bit set.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** If "acknowledge interrupt on exit" is 0, the interrupt remains pending in the interrupt controller and the VM-exit interruption-information field is not valid for reason 1.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`

---

## 5.6 VM exits during event delivery — the IDT-vectoring fields

This is the mechanism that lets a VMM re-inject an event whose delivery itself faulted, and it is the difference between a hypervisor that survives a nested fault in the guest and one that loses the event.

- **Claim.** The IDT-vectoring information field is laid out as: bits 7:0 vector, bits 10:8 interruption type, bit 11 error-code valid, bits 30:13 reserved, bit 31 valid.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** The interruption types in the IDT-vectoring information field are 0 external interrupt, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software interrupt, and 6 software exception.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 31 of the IDT-vectoring information field is set only when the VM exit occurred while the processor was delivering an event through the guest IDT; it is the VMM's signal that an event was lost and must be re-delivered.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** When bit 11 is 1, the IDT-vectoring error code field holds the error code associated with the event whose delivery was interrupted.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** The standard VMM response is to copy the IDT-vectoring information and error code into the VM-entry interruption-information and VM-entry exception error-code fields for the next VM entry, adjusting for the type of the original event (see `04-vm-entry.md` §4.8).  `[SDM 3C §30.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** For a software interrupt, privileged software exception or software exception recorded in the IDT-vectoring information field, the VM-exit instruction length field holds the length of the instruction that caused the event, which must be carried over to the VM-entry instruction length when re-injecting.  `[SDM 3C §30.2.4]` `[1]` `C:high` `V:durable`

---

## 5.7 Information about the instruction that caused the VM exit

- **Claim.** The VM-exit instruction length field reports the length in bytes of the instruction whose execution caused the VM exit, and is defined for VM exits caused by instruction execution as well as for software-interrupt and software-exception events.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** The conventional way for a VMM to complete an emulated instruction is to add the VM-exit instruction length to the guest RIP before VMRESUME; doing this for a fault-like exit that must be re-executed is a common hypervisor bug.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-exit instruction information field decodes the operands of the instruction that caused the exit, and is defined for I/O string instructions, descriptor-table instructions, the VMX instructions, INVEPT, INVPCID, INVVPID, RDRAND, RDSEED, XSAVES and XRSTORS.  `[SDM 3C §27.9.4]` `[1]` `C:medium` `V:durable`
- **Claim.** The I/O RCX, I/O RSI, I/O RDI and I/O RIP fields are provided for VM exits due to INS and OUTS under the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §27.9.4]` `[1]` `C:medium` `V:durable`
- **Claim.** The guest-linear address field is set for VM exits due to instruction execution where a linear address is meaningful — including some EPT violations, APIC accesses and I/O string instructions — and is undefined otherwise.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** The guest-physical address field is set for EPT violations and EPT misconfigurations and reports the guest-physical address whose translation failed.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

---

## 5.8 Saving guest state and saving MSRs

- **Claim.** A VM exit saves into the guest-state area the control registers CR0, CR3 and CR4, DR7 (when the "save debug controls" VM-exit control is 1), the segment registers with their hidden bases, limits and access rights, GDTR and IDTR bases and limits, RIP, RSP and RFLAGS, and the guest MSRs governed by the VM-exit controls.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** A VM exit also saves the non-register guest state: activity state, interruptibility state, pending debug exceptions, and — when the "save VMX-preemption timer value" control is 1 — the VMX-preemption timer.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** If the "save IA32_EFER" VM-exit control is 1, the guest IA32_EFER field is written on VM exit; otherwise it retains whatever the VMM last wrote.  `[SDM 3C §30.3]` `[1]` `C:high` `V:durable`
- **Claim.** If bit 5 of IA32_VMX_MISC is 1, VM exits store the value of IA32_EFER.LMA into the "IA-32e mode guest" VM-entry control, keeping the two consistent across a resume.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** After saving register state, the VM exit stores the MSRs named by the VM-exit MSR-store area, using the same 16-byte entry format as the MSR-load areas and the count in the VM-exit MSR-store count field.  `[SDM 3C §30.4]` `[1]` `C:high` `V:durable`
- **Claim.** A failure while storing MSRs on VM exit causes a VMX abort rather than a recoverable error.  `[SDM 3C §30.7]` `[1]` `C:high` `V:durable`

---

## 5.9 Loading host state and loading MSRs

- **Claim.** A VM exit loads CR0, CR3, CR4, RIP, RSP, the CS, SS, DS, ES, FS, GS and TR selectors, the FS, GS, TR, GDTR and IDTR bases, and the IA32_SYSENTER MSRs from the host-state area.  `[SDM 3C §30.5]` `[1]` `C:high` `V:durable`
- **Claim.** The host-state area contains no LDTR field and no activity-state or interruptibility-state fields: after a VM exit LDTR is unusable, the logical processor is always in the active state, and there is no event blocking other than what the VMM re-establishes.  `[SDM 3C §27.5]` `[1]` `C:high` `V:durable`
- **Claim.** The "host address-space size" VM-exit control determines whether the logical processor is in 64-bit mode after the VM exit; its value is loaded into CS.L, IA32_EFER.LME and IA32_EFER.LMA on every VM exit.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** A VM exit sets the host CS, SS, DS, ES, FS and GS segment attributes to architecturally fixed values rather than reading descriptors from the host GDT; the VMM's segment caches after a VM exit are therefore determined by the VM exit itself, not by memory.  `[SDM 3C §30.5]` `[1]` `C:high` `V:durable`
- **Claim.** A VM exit leaves the host DR7 at 400H and sets IA32_DEBUGCTL to 0, so a VMM that uses hardware breakpoints must re-establish them after every exit.  `[SDM 3C §30.5]` `[1]` `C:medium` `V:durable`
- **Claim.** Finally, the VM exit loads MSRs from the VM-exit MSR-load area; a failure in this step causes a VMX abort.  `[SDM 3C §30.6]` `[1]` `C:high` `V:durable`
- **Claim.** A VM exit clears address-range monitoring, so a MONITOR armed in the guest does not survive into VMX root operation.  `[SDM 3C §30.5]` `[1]` `C:medium` `V:durable`

---

## 5.10 VMX aborts

A VMX abort is the failure mode that has no handler. It is what happens when the VM exit itself cannot complete.

- **Claim.** A VMX abort causes the logical processor to enter a shutdown state; no VMX transition completes and the VMM does not regain control.  `[SDM 3C §30.7]` `[1]` `C:high` `V:durable`
- **Claim.** On a VMX abort the processor writes a non-zero 32-bit VMX-abort indicator into the VMCS region at byte offset 4, immediately after the VMCS revision identifier.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** VMX-abort indicator 1 means there was a failure in saving guest MSRs.  `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`
- **Claim.** VMX-abort indicator 2 means host checking of the page-directory-pointer-table entries failed.  `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`
- **Claim.** VMX-abort indicator 3 means the current VMCS has been corrupted, typically because software wrote directly to the VMCS region instead of using VMWRITE.  `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`
- **Claim.** VMX-abort indicator 4 means there was a failure in loading host MSRs.  `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`
- **Claim.** VMX-abort indicator 5 means a machine-check event occurred during VM exit.  `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`
- **Claim.** Because the abort indicator is written into the VMCS region in memory rather than into a register, it survives the shutdown and can be recovered post-mortem by another processor or after reset.  `[SDM 3C §27.2]` `[1]` `C:medium` `V:durable`

---

## 5.11 Machine-check events and user-interrupt recognition

- **Claim.** A machine-check event during VM exit is handled specially: depending on when it occurs, the processor either completes the VM exit and delivers the machine-check exception in VMX root operation, or takes a VMX abort.  `[SDM 3C §30.8]` `[1]` `C:medium` `V:durable`
- **Claim.** The recognition of user interrupts after a VM exit is specified separately, because user-interrupt state is not part of the ordinary host-state load.  `[SDM 3C §30.9]` `[1]` `C:medium` `V:durable`

---

## 5.12 A dispatch and debugging recipe

1. **VMREAD the exit reason.** Test bit 31 before anything else; if set, this is a VM-entry failure and belongs to `04-vm-entry.md` §4.9.
2. **Mask to bits 15:0** and dispatch on the basic reason using §5.3.
3. **VMREAD the IDT-vectoring information field on every exit, unconditionally.** If its valid bit is set, an event was lost during delivery and must be re-injected before or together with whatever else you do; forgetting this is the classic source of "the guest hangs after a nested fault".
4. **Read the exit qualification only for reasons that define one** (§5.4.10). For other reasons its content is undefined and reading it will mislead you.
5. **Decide whether to advance RIP** using §5.3.1, not by habit. Instruction-execution exits advance; EPT violations, page faults and re-executed instructions do not.
6. **For reason 0**, read the VM-exit interruption information to distinguish an exception from an NMI, and check bit 12 for NMI unblocking due to IRET.
7. **For reason 48**, read the guest-physical address, then the exit qualification; use bits 0–2 to classify the access and bits 3–6 to distinguish "not mapped" from "mapped but not permitted".

- **Claim.** Reading the IDT-vectoring information field on every VM exit is architecturally necessary because the field is valid for exits of many different basic reasons — a task switch, an EPT violation or an exception can all interrupt event delivery.  `[SDM 3C §30.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT violation whose qualification has bits 3, 4 and 5 all clear indicates that the guest-physical address is not mapped at all by EPT, whereas a violation with some of those bits set indicates a permission failure on a mapped page.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** EPT misconfiguration (reason 49) and EPT violation (reason 48) must be handled by different code paths: a misconfiguration means the VMM's own EPT paging structures are malformed, which is a hypervisor bug rather than a guest event.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

---

## 5.13 Two corrections carried by this chapter

Two long-lived errors in secondary descriptions of the EPT-violation exit qualification are corrected in §5.4.6 and recorded in `errata.md`:

1. **Bit 7.** Older material describes qualification bit 7 as flagging the guest-physical-address field. It does not — bit 7 reports validity of the guest-linear-address field. The guest-physical address is always reported for an EPT violation and needs no validity flag.
2. **Bit 6.** Older material describes qualification bit 6 as the logical-AND of the execute-disable bit across the EPT paging structures. It is the logical-AND of the *user-mode execute* permission (bit 10 of an EPT paging-structure entry), and it is meaningful only when mode-based execute control for EPT is enabled.

- **Claim.** Under mode-based execute control for EPT, an EPT paging-structure entry carries two execute permissions: bit 2 for supervisor-mode execute and bit 10 for user-mode execute; exit-qualification bits 5 and 6 report the logical-AND of those two permissions respectively.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

---

## 5.14 Cross-references

- Exit-reason values 33, 34 and 41 and the three VM-entry failure modes: `04-vm-entry.md` §4.9.
- Control bits that decide whether a given event exits at all (exception bitmap, I/O bitmaps, MSR bitmaps, CR masks and shadows): `02-vmcs.md`.
- EPT paging-structure entry layout, EPT misconfiguration conditions, and PML: chapter `06` (EPT and address translation).
- APIC-access page, virtual-APIC page and virtualized-EOI semantics: `07-apic-virtualization.md`.
- VM-instruction error numbers, which are a different namespace from exit reasons: `08-vmx-instructions.md` §8.4.
