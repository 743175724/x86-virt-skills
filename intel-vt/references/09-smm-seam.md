# 09. System Management Mode and Secure Arbitration Mode

> **中文速览**：本章讲 VMX 与两种"比 VMM 更高特权"的模式如何共存。前半部分是 SMM：SMI 的**默认处理方式**（处理器暂时退出 VMX operation）与**双监视器处理方式**（executive monitor + SMM-transfer monitor，SMI 变成 SMM VM exit，对应 exit reason 5 与 6）。后半部分是 SEAM——VMX 的一层扩展，定义 SEAM root/非 root operation、SEAMRR 保护范围与 SEAMCALL/SEAMRET/SEAMOPS/TDCALL 四条指令。读本章的时机：你在排查 SMI 相关的 VM exit、实现 STM、或者需要理解 TDX 之下那层 ISA 地基。TDX module 自身的架构（TDCS/TDVPS/Secure EPT/SEAMLDR 装载链）不在这里，见 `13-tdx.md`。

**Maps to:** Intel SDM Vol.3C Ch.34 "System Management Mode" and Ch.35 "Secure Arbitration Mode (SEAM)" (rev 092) [1]
**Owns:** SMM/VMX interaction, the dual-monitor treatment, the SMM-transfer monitor, the executive-VMCS pointer, MSEG, SEAM modes of operation, the SEAM range, the SEAM instruction set at ISA level
**See also:** `02-vmcs.md` (VMCS field layout), `05-vm-exit.md` (ordinary exit reasons), `13-tdx.md` (the TDX module that runs inside SEAM)

---

## 9.1 Why this chapter exists

A VMM believes it is the most privileged software on the machine. Two things falsify that belief on
Intel parts: System Management Mode, which predates VMX and is owned by firmware, and Secure
Arbitration Mode, which postdates VMX and is owned by an Intel-signed module. Both are entered
and left by mechanisms a VMM cannot veto, and both reuse VMCS machinery in ways that look
familiar but are not identical to ordinary VMX transitions.

The SDM treats them as neighbours: Ch.34 is System Management Mode and Ch.35 is Secure
Arbitration Mode (SEAM). This chapter keeps them together for the same reason.

- **Claim.** In SDM rev 092, Vol.3C Ch.34 is "System Management Mode" and Ch.35 is "Secure Arbitration Mode (SEAM)".  `[SDM 3C Ch.34]` `[SDM 3C Ch.35]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM is specified by the SDM as an extension of VMX operation, and the Ch.35 preamble states that the SEAM architecture is used as a foundation for the Trust Domain Extensions (TDX) architecture (the preamble spells it "Trusted Domains Extensions").  `[SDM 3C Ch.35]` `[1]` `C:high` `V:durable`

## 9.2 SMM: the parts that matter to a VMM

SMM is entered by a System Management Interrupt, runs out of SMRAM, and is exited by RSM. The
VMX-relevant question is what happens to VMX state across that boundary, and there are exactly two
answers: the **default treatment** (§9.3) and the **dual-monitor treatment** (§9.4). Which one is in
force is a property of the platform, not of the guest.

- **Claim.** The SDM defines two treatments of SMIs and SMM under VMX operation: the default treatment (Vol.3C §34.14) and the dual-monitor treatment (Vol.3C §34.15).  `[SDM 3C §34.14]` `[1]` `C:high` `V:durable`
- **Claim.** Support for the dual-monitor treatment is not architecturally universal; software determines whether a processor supports it by consulting the VMX capability MSR IA32_VMX_BASIC.  `[SDM 3C §34.15]` `[1]` `C:high` `V:durable`
- **Claim.** System Management Range Registers (SMRR) are described in Vol.3C §34.4.2.1 as part of SMRAM caching control.  `[SDM 3C §34.4.2.1]` `[1]` `C:high` `V:durable`
- **Claim.** The SDM frames the choice explicitly: on processors that support VMX, SMIs and SMM may be used either under the default treatment, in which the processor saves the states relevant to VMX operation on entering SMM and firmware uses RSM to resume VMX operation, or under the dual-monitor treatment with an executive monitor and an STM.  `[SDM 3C §34.1.1]` `[1]` `C:high` `V:durable`

### 9.2.1 SMM essentials a VMM author still needs

These are ordinary SMM facts, but they determine what an SMI handler can observe and clobber, so
they belong in the same mental model as the VMX interaction.

- **Claim.** The only way to enter SMM is by signalling an SMI through the SMI# pin on the processor or through an SMI message received through the APIC bus; the SMI is a nonmaskable external interrupt.  `[SDM 3C §34.2]` `[1]` `C:high` `V:durable`
- **Claim.** The default base address for SMRAM is 30000H, held in an internal processor register called the SMBASE register.  `[SDM 3C §34.11]` `[1]` `C:high` `V:durable`
- **Claim.** Software relocates SMRAM by setting the SMBASE field in the saved state map at offset 7EF8H; RSM reloads the internal SMBASE register from that field each time it exits SMM.  `[SDM 3C §34.11]` `[1]` `C:high` `V:durable`
- **Claim.** After relocation, SMI requests use the new SMBASE to find the SMI handler entry point at SMBASE + 8000H and the SMRAM state save area from SMBASE + FE00H to SMBASE + FFFFH.  `[SDM 3C §34.11]` `[1]` `C:high` `V:durable`
- **Claim.** The processor resets its internal SMBASE register to 30000H on a RESET but does not change it on an INIT.  `[SDM 3C §34.11]` `[1]` `C:high` `V:durable`
- **Claim.** In multiple-processor systems, initialization software must adjust the SMBASE value for each processor so that the SMRAM state save areas do not overlap.  `[SDM 3C §34.11]` `[1]` `C:high` `V:durable`
- **Claim.** The SMM revision identifier is written during SMM entry and can be examined in SMRAM space at offset 7EFCH; its lower word refers to the version of the base SMM architecture.  `[SDM 3C §34.9]` `[1]` `C:high` `V:durable`
- **Claim.** NMI interrupts are blocked upon entry to the SMI handler; an NMI arriving during the handler is latched and serviced after the processor exits SMM, and only one NMI request is latched.  `[SDM 3C §34.8]` `[1]` `C:high` `V:durable`
- **Claim.** If an NMI request is pending when RSM executes, the NMI is serviced before the next instruction of the interrupted code sequence, provided NMIs were not blocked before the SMI occurred.  `[SDM 3C §34.8]` `[1]` `C:high` `V:durable`
- **Claim.** An SMI handler that needs NMIs can unblock them by executing IRET, typically by invoking a dummy interrupt service routine for that purpose.  `[SDM 3C §34.8]` `[1]` `C:high` `V:durable`
- **Claim.** The SDM specifies the SMRAM state save map in Vol.3C §34.4.1 with the Intel 64 variant in §34.4.1.1, the SMI handler execution environment in §34.5, exceptions and interrupts within SMM in §34.6, auto halt restart in §34.10, I/O instruction restart in §34.12 and multiple-processor considerations in §34.13.  `[SDM 3C §34.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Vol.3C §34.5.3 covers Control-flow Enforcement Technology interactions with the SMI handler execution environment.  `[SDM 3C §34.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** Vol.3C §34.16 covers SMI and processor extended state management, and §34.17 covers model-specific system management enhancements including SMM handler code access control (§34.17.1), SMI delivery delay reporting (§34.17.2) and blocked SMI reporting (§34.17.3).  `[SDM 3C §34.16]` `[1]` `C:high` `V:durable`

## 9.3 Default treatment of SMIs and SMM

Under the default treatment there is no VM exit for the SMI at all. The processor quietly *leaves*
VMX operation, stashing the state a VMM would otherwise lose, runs the SMI handler as ordinary
SMM code, and reconstructs VMX operation on RSM.

### 9.3.1 SMI delivery

- **Claim.** Under the default treatment, SMI delivery saves CR4.VMXE and an indication of whether the logical processor was in VMX operation internal to the processor, and if the logical processor was in VMX operation it also saves the current-VMCS pointer internally, leaves VMX operation, and saves "VMX-critical state".  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** The VMX-critical state saved by default-treatment SMI delivery consists of SS.DPL (the current privilege level), RFLAGS.VM, the state of blocking by STI and by MOV SS, the state of virtual-NMI blocking (only when in VMX non-root operation with the "virtual NMIs" control set), and an indication of whether an MTF VM exit is pending.  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** Default-treatment SMI delivery clears CR4.VMXE to 0 before performing ordinary SMI delivery.  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** Default-treatment SMI delivery invalidates linear mappings and combined mappings associated with VPID 0000H for all PCIDs, and invalidates combined mappings for VPID 0000H for all EPTRTA values.  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the logical processor supports the 1-setting of the "enable EPT" VM-execution control and was in VMX non-root operation at the time of the SMI, it saves the value of that control into bit 0 of the 32-bit field at SMBASE + 8000H + 7EE0H (that is, SMBASE + FEE0H).  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** When that bit is saved as 1, the logical processor also saves the EPT pointer into the 64-bit field at SMBASE + 8000H + 7ED8H (that is, SMBASE + FED8H).  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** Because default-treatment SMI delivery causes a logical processor to leave VMX operation, all controls associated with VMX non-root operation are disabled in SMM and cannot cause VM exits while the logical processor is in SMM.  `[SDM 3C §34.14.1]` `[1]` `C:high` `V:durable`

This last point is the one that bites: an SMI handler is *not* subject to the guest's exiting controls,
its MSR bitmap, or its I/O bitmap. From the VMM's perspective, time simply passes.

### 9.3.2 RSM and VMXOFF

- **Claim.** Under the default treatment, RSM restores processor state from SMRAM, and processors supporting VMX operation additionally restore the VMX state saved at SMI delivery; the SDM specifies this in Vol.3C §34.14.2.  `[SDM 3C §34.14.2]` `[1]` `C:high` `V:durable`
- **Claim.** The SDM devotes Vol.3C §34.14.3 to protection of CR4.VMXE in SMM and Vol.3C §34.14.4 to VMXOFF and SMI unblocking.  `[SDM 3C §34.14.3]` `[1]` `C:high` `V:durable`
- **Claim.** Setting bit 2 of IA32_SMM_MONITOR_CTL to 1 prevents VMXOFF from unblocking SMIs regardless of the value of that register's valid bit (bit 0).  `[SDM 3C §34.14.4]` `[1]` `C:high` `V:durable`

## 9.4 Dual-monitor treatment of SMIs and SMM

The dual-monitor treatment splits the hypervisor role in two. The **executive monitor** is the ordinary
VMM running outside SMM. The **SMM-transfer monitor (STM)** is a second VMM that runs *inside*
SMM, still in VMX operation, and it is the STM — not the raw SMI handler — that receives control.

### 9.4.1 The two monitors

- **Claim.** The dual-monitor treatment is activated through the cooperation of the executive monitor (the VMM operating outside SMM) and the SMM-transfer monitor (the VMM operating inside SMM, while in VMX operation, to support system-management functions).  `[SDM 3C §34.15]` `[1]` `C:high` `V:durable`
- **Claim.** Under the dual-monitor treatment, control is transferred to the STM through VM exits, and VM entries are used to return from SMM; the STM does not return from SMM using RSM.  `[SDM 3C §34.15.1]` `[1]` `C:high` `V:durable`
- **Claim.** The STM runs in VMX root operation and uses VMX instructions to establish a VMCS and perform VM entries to its own guests, all inside SMM.  `[SDM 3C §34.15.1]` `[1]` `C:high` `V:durable`
- **Claim.** It is not possible to leave VMX operation while the dual-monitor treatment is active; VMXOFF fails if executed, and the treatment must be deactivated first.  `[SDM 3C §34.15.1]` `[1]` `C:high` `V:durable`

### 9.4.2 SMM VM exits

- **Claim.** An SMM VM exit is a VM exit that begins outside SMM and ends in SMM.  `[SDM 3C §34.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** Unlike other VM exits, SMM VM exits can begin in VMX root operation; they result from the arrival of an SMI outside SMM or from execution of VMCALL in VMX root operation outside SMM.  `[SDM 3C §34.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** Execution of VMCALL in VMX root operation causes an SMM VM exit only if the valid bit is set in the IA32_SMM_MONITOR_CTL MSR.  `[SDM 3C §34.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** SMIs that cause SMM VM exits always do so directly and do not save state to SMRAM as they do under the default treatment.  `[SDM 3C §34.15.2.1]` `[1]` `C:high` `V:durable`

### 9.4.3 The executive-VMCS pointer and the SMM-transfer VMCS

Each logical processor gains a second VMCS pointer under the dual-monitor treatment. This is the
piece most often garbled in secondary writeups, so the mechanics are worth stating exactly.

- **Claim.** When the dual-monitor treatment is active, each logical processor uses a separate VMCS called the SMM-transfer VMCS, and the logical processor maintains an additional pointer called the SMM-transfer VMCS pointer, established when the dual-monitor treatment is activated.  `[SDM 3C §34.15.1]` `[1]` `C:high` `V:durable`
- **Claim.** An SMM VM exit begins by loading the executive-VMCS pointer field in the SMM-transfer VMCS: with the current-VMCS pointer if the SMM VM exit commenced in VMX non-root operation, or with the VMXON pointer if it commenced in VMX root operation.  `[SDM 3C §34.15.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** The second step of an SMM VM exit loads the current-VMCS pointer with the value of the SMM-transfer VMCS pointer, so that VM-exit information is recorded in the SMM-transfer VMCS and its VM-exit controls and host-state area govern the exit.  `[SDM 3C §34.15.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** The executive-VMCS pointer is a VMCS field defined in Vol.3C §27.6.10; see `02-vmcs.md` for its encoding rather than restating it here.  `[SDM 3C §27.6.10]` `[1]` `C:high` `V:durable`
- **Claim.** VM entries that return from SMM perform checks on the executive-VMCS pointer field, specified in Vol.3C §34.15.4.1.  `[SDM 3C §34.15.4.1]` `[1]` `C:high` `V:durable`

### 9.4.4 Exit reasons 5 and 6

- **Claim.** Basic exit reason 5 is "I/O system-management interrupt (SMI)": an SMI arrived immediately after retirement of an I/O instruction and caused an SMM VM exit.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** Basic exit reason 6 is "Other SMI": an SMI arrived and caused an SMM VM exit, but not immediately after retirement of an I/O instruction.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** Basic exit reason 18 (VMCALL) is also produced by SMM VM exits, because VMCALL may be executed by the executive monitor to call the STM.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** Bit 29 of the exit-reason field is set by SMM VM exits that occurred in VMX root operation, so the STM can tell whether it was invoked from VMX root or VMX non-root operation.  `[SDM 3C §34.15.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** For an SMM VM exit that occurred in VMX non-root operation with an MTF VM exit pending, bit 28 of the exit-reason field is set; otherwise it is cleared.  `[SDM 3C §34.15.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** In the exit-reason field recorded by an SMM VM exit, bits 27:16 and bits 31:30 are cleared.  `[SDM 3C §34.15.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** For an SMM VM exit caused by an SMI that arrived immediately after retirement of an I/O instruction, the exit qualification contains information about that I/O instruction.  `[SDM 3C §34.15.2.3]` `[1]` `C:high` `V:durable`

Exit reasons 5 and 6 therefore never appear under the default treatment. If you see them, the
platform has an STM.

### 9.4.5 Returning from SMM

- **Claim.** VM entries that return from SMM are specified in Vol.3C §34.15.4, with sub-sections covering checks on the executive-VMCS pointer field, VM-execution control fields, VM-entry control fields and the guest-state area; see `02-vmcs.md` for those field definitions.  `[SDM 3C §34.15.4]` `[1]` `C:high` `V:durable`
- **Claim.** SMI blocking across VM entries that return from SMM is specified in Vol.3C §34.15.4.9.  `[SDM 3C §34.15.4.9]` `[1]` `C:high` `V:durable`
- **Claim.** A VM entry that returns from SMM updates both the current-VMCS pointer and the SMM-transfer VMCS pointer, per Vol.3C §34.15.4.7.  `[SDM 3C §34.15.4.7]` `[1]` `C:high` `V:durable`

### 9.4.6 Enabling: IA32_SMM_MONITOR_CTL and the MSEG header

- **Claim.** Code and data for the SMM-transfer monitor reside in a region of SMRAM called the monitor segment (MSEG); SMM code determines the location of MSEG, establishes its content, and enables the dual-monitor treatment.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** SMM code enables the dual-monitor treatment and specifies the location of MSEG by writing to the IA32_SMM_MONITOR_CTL MSR, index 9BH.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** In IA32_SMM_MONITOR_CTL, bit 0 is the valid bit; the STM may be invoked using VMCALL only if this bit is 1, and the bit is cleared when the logical processor is reset.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** In IA32_SMM_MONITOR_CTL, bit 1 is reserved, bits 11:3 are reserved, and bits 63:32 are reserved.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** In IA32_SMM_MONITOR_CTL, bits 31:12 contain a value that, when shifted left 12 bits, is the physical base address of MSEG.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Certain leaf functions of the GETSEC instruction clear IA32_SMM_MONITOR_CTL bit 2.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** A WRMSR to IA32_SMM_MONITOR_CTL generates #GP(0) if executed outside of SMM or if an attempt is made to set any reserved bit.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** The 32 bytes located at the MSEG base address are the MSEG header, whose fields are each 32 bits wide.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`

MSEG header layout, byte offsets, each field 32 bits:

| Offset | Field |
|---|---|
| 0 | MSEG-header revision identifier |
| 4 | SMM-transfer monitor features |
| 8 | GDTR limit |
| 12 | GDTR base offset |
| 16 | CS selector |
| 20 | EIP offset |
| 24 | ESP offset |
| 28 | CR3 offset |

- **Claim.** The MSEG header fields occupy byte offsets 0 (MSEG-header revision identifier), 4 (SMM-transfer monitor features), 8 (GDTR limit), 12 (GDTR base offset), 16 (CS selector), 20 (EIP offset), 24 (ESP offset) and 28 (CR3 offset).  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 0 of the SMM-transfer monitor features field is the IA-32e mode SMM feature bit, indicating whether the logical processor will be in IA-32e mode after the STM is activated.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Software discovers the MSEG revision identifier a processor uses by reading the VMX capability MSR IA32_VMX_MISC.  `[SDM 3C §34.15.5]` `[1]` `C:high` `V:durable`
- **Claim.** Software should maintain the MSEG header in writeback cacheable memory to ensure proper behaviour in VMX operation; this is an SDM recommendation rather than an architectural guarantee, because the SDM adds that future implementations may allow or require a different memory type and that software should consult IA32_VMX_BASIC.  `[SDM 3C §34.15.5]` `[1]` `C:medium` `V:durable`

### 9.4.7 Activating and deactivating

- **Claim.** The dual-monitor treatment is activated only if it is enabled, and only by the executive monitor, which activates it by executing VMCALL in VMX root operation; that VMCALL causes an SMM VM exit.  `[SDM 3C §34.15.6]` `[1]` `C:high` `V:durable`
- **Claim.** The STM deactivates the dual-monitor treatment using a VM entry that returns from SMM with the "deactivate dual-monitor treatment" VM-entry control set to 1.  `[SDM 3C §34.15.7]` `[1]` `C:high` `V:durable`
- **Claim.** Vol.3C §34.15.3 specifies the operation of the SMM-transfer monitor itself, distinct from the transitions into and out of it.  `[SDM 3C §34.15.3]` `[1]` `C:high` `V:durable`

### 9.4.8 The two treatments side by side

| | Default treatment | Dual-monitor treatment |
|---|---|---|
| Who handles the SMI | The firmware SMI handler | The SMM-transfer monitor |
| VMX operation across the SMI | Left, then re-established by RSM | Never left |
| Exit reason recorded | None | 5 (I/O SMI), 6 (Other SMI), or 18 (VMCALL) |
| VMCS used | None; state saved internally and in SMRAM | SMM-transfer VMCS |
| How SMM is exited | RSM | VM entry that returns from SMM |
| VMXOFF | Unblocks SMIs unless IA32_SMM_MONITOR_CTL bit 2 is Set | Fails |
| Enabled by | Always available | IA32_SMM_MONITOR_CTL valid bit, set from SMM |
| Activated by | — | VMCALL executed by the executive monitor in VMX root operation |

- **Claim.** Under the default treatment no VM exit is recorded for an SMI, whereas under the dual-monitor treatment an SMI produces an SMM VM exit whose basic exit reason is 5 or 6, and VMCALL from the executive monitor produces one with basic exit reason 18.  `[SDM 3C §34.15.2]` `[1][2]` `C:high` `V:durable`

## 9.5 SEAM: modes of operation

SEAM adds a second axis to the root/non-root distinction. Where VMX has two modes, SEAM has two
more that sit *beside* them, reachable only through dedicated instructions.

- **Claim.** SEAM root operation is the SEAM extension of VMX root operation, and the software running in it is called a SEAM module.  `[SDM 3C §35.1]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM root operation has two sub-modes: loader mode, in which at most one logical processor can execute at any time, and module mode, in which multiple logical processors can execute in parallel.  `[SDM 3C §35.1]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM non-root operation is the SEAM extension of VMX non-root operation; the software running in it is called a SEAM guest, and multiple logical processors can execute in this mode concurrently.  `[SDM 3C §35.1]` `[1]` `C:high` `V:durable`
- **Claim.** A VMCS used to transition between SEAM root and SEAM non-root operation, and to control SEAM non-root operation, is called a SEAM-guest VMCS.  `[SDM 3C §35.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The SEAM-specific VMCS fields are the SEAM-guest KeyID, a VM-execution control field holding the key identifier used to encrypt the SEAM guest's private pages, and the SEAM shared EPT pointer, a VM-execution control field holding the physical address of the base of the shared EPT PML4 or PML5 table; see `02-vmcs.md` for general VMCS field organisation.  `[SDM 3C §35.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The SEAM-specific VMX controls are "SEAM guest-physical address width", enumerated by IA32_VMX_PROCBASED_CTLS3, and "allow SEAM-guest telemetry", a VM-entry control enumerated by IA32_VMX_ENTRY_CTLS.  `[SDM 3C §35.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM guests must run with EPT enabled; VM entry in SEAM root operation fails if the "enable EPT" control is not set in the SEAM-guest VMCS.  `[SDM 3C §35.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The VMCS field group for SEAM non-root operation is documented at Vol.3C §27.6.26.  `[SDM 3C §27.6.26]` `[1]` `C:high` `V:durable`

## 9.6 SEAM transitions and the SEAM instruction set

The symmetry with the dual-monitor treatment is deliberate and the SDM says so outright: a SEAM
call behaves like an SMM VM exit, a SEAM return behaves like a VM entry that returns from SMM.

- **Claim.** Processor transitions from VMX root operation to SEAM root operation are called SEAM calls, are initiated by SEAMCALL, and operate in a manner similar to SMM VM exits in response to VMCALL executed in VMX root operation; see `13-tdx.md` for the TDX module's use of this interface.  `[SDM 3C §35.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** A SEAM call uses a SEAM-transfer VMCS that resides within the SEAM range of the physical-address space.  `[SDM 3C §35.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM calls use RAX[63] to select the SEAM root operation sub-mode: when RAX[63] is 0 the transition is into module-mode SEAM root operation, otherwise into loader-mode SEAM root operation.  `[SDM 3C §35.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** An attempt to enter loader-mode SEAM root operation fails if another logical processor is already in SEAM having entered in loader mode.  `[SDM 3C §35.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** Processor transitions from SEAM root operation back to VMX root operation are called SEAM returns, are initiated by SEAMRET, and use the SEAM-transfer VMCS.  `[SDM 3C §35.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** A SEAM return from loader-mode SEAM root operation ensures that all data for any VMCS the logical processor used in SEAM, including the SEAM-transfer VMCS, are in memory, and there is no current VMCS after such a SEAM return.  `[SDM 3C §35.1.2]` `[1]` `C:high` `V:durable`

The four SEAM instructions, per Vol.3C §35.5:

| Instruction | Opcode | Role |
|---|---|---|
| SEAMCALL | 66 0F 01 CF | VMX root → SEAM root operation (VMM calls the SEAM module) |
| TDCALL | 66 0F 01 CC | VM exit from SEAM non-root → SEAM root (SEAM guest requests service) |
| SEAMOPS | — | SEAM-specific operations, executable only in SEAM root operation |
| SEAMRET | — | SEAM root → VMX root operation |

- **Claim.** SEAMCALL is encoded 66 0F 01 CF; it is a privileged instruction that passes control to software running in SEAM root operation, executable only in 64-bit mode, in VMX operation, outside SEAM and outside SMM; see `13-tdx.md` for what the module does with it.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** Execution of SEAMCALL in VMX non-root operation causes a VM exit with basic exit reason 76, SEAMCALL — see `14-nested-virtualization.md` for the nested case.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** SEAMCALL execution when the SEAM range is not valid (IA32_SEAMRR_MASK bit 11 is 0), or immediately following a MOV to SS or POP SS, results in #GP; see `13-tdx.md` for how the loader establishes that range.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** SEAMCALL fails with a VMFailInvalid indication if SEAM is globally disabled, or if loader-mode SEAM root operation is requested while another logical processor is in SEAM having entered in loader mode; see `13-tdx.md` for the loader-mode users.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** TDCALL is encoded 66 0F 01 CC and causes a VM exit from SEAM non-root operation to SEAM root operation, used by SEAM guests to request SEAM-module services; see `13-tdx.md` for the guest-side ABI.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** SEAMOPS invokes SEAM-specific operations and can be executed only in SEAM root operation, with some operations invocable only in loader mode.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** SEAMRET is a privileged instruction that returns from SEAM root operation to VMX root operation using the SEAM-transfer VMCS, and can be executed only in SEAM root operation.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** An attempt to execute a SEAM instruction on a processor that does not support SEAM results in #UD.  `[SDM 3C §35.5]` `[1]` `C:high` `V:durable`
- **Claim.** The detailed leaf-level definitions of SEAMOPS and SEAMRET are delegated by the SDM to the Intel Trust Domain CPU Architectural Extensions document rather than being given in Vol.3C.  `[SDM 3C §35.5]` `[1][14]` `C:high` `V:durable`

## 9.7 The SEAM range (SEAMRR)

- **Claim.** The SEAM range is a physical memory range sequestered for SEAM modules, allocated using the range-register MSRs IA32_SEAMRR_BASE (index 1400H) and IA32_SEAMRR_MASK (index 1401H).  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The existence of the SEAMRR MSRs is enumerated by bit 15 of IA32_MTRRCAP (MSR address FEH); processors supporting the SEAM architecture return IA32_MTRRCAP bit 15 as 1.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The SEAM range is divided into a module sub-range and a loader sub-range.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 11 of IA32_SEAMRR_MASK indicates whether the SEAM range is valid and protected.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** In IA32_SEAMRR_BASE, bits 2:0 are reserved, bit 3 is CONFIGURED (set to 1 when the SEAM range is configured), bits 24:4 are reserved and bits M-1:25 hold the SEAM range base address, with M enumerated by CPUID.80000008H:EAX[7:0]; the base address must have bits M-1:M-k clear, where k is IA32_TME_ACTIVATE.MK_TME_KEYID_BITS.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`
- **Claim.** In IA32_SEAMRR_MASK, bits 9:0 are reserved, bit 10 is LOCK (when it is set, IA32_SEAMRR_BASE and IA32_SEAMRR_MASK become non-writable), bit 11 is VALID (returns 1 when SEAM range protections are active), bits 24:12 are reserved and bits M-1:25 hold the mask value used for SEAMRR matching, whose lowest granularity is 32 MBytes.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`
- **Claim.** Outside SEAM root operation, accesses to physical addresses in the SEAM range are aborted: writes are ignored and reads return values with all bits set to 1.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** In SEAM root operation, accesses to the module sub-range are allowed, while accesses to the loader sub-range are allowed only in loader-mode SEAM root operation and are otherwise aborted.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** In SEAM root operation, instruction fetches from physical addresses outside the SEAM range are prevented by the processor, with an implementation-specific response.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The contents of the SEAM range are encrypted by the TME-MK engine with a machine-specific key, typically an ephemeral key generated each time the platform is restarted.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Accesses to the SEAM range use the writeback (WB) memory type regardless of MTRR and PAT when CR0.CD = 0, and the uncacheable (UC) memory type when CR0.CD = 1.  `[SDM 3C §35.4.1]` `[1]` `C:high` `V:durable`

Note the scope of what Ch.35 guarantees: every rule above is about *processor* accesses. Ch.35 says
nothing about DMA. Keeping device accesses out of the SEAM range is a platform responsibility
discharged outside this chapter — by chipset range protection, and by remapping hardware that must
never produce a translation landing inside it (see `10-vtd-dma-remapping.md`).

## 9.8 SEAM and TME-MK key identifiers

- **Claim.** The current configuration of TME-MK is inferred from IA32_TME_ACTIVATE (MSR address 982H); TME is active when IA32_TME_ACTIVATE[1:0] = 11B.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_TME_ACTIVATE.MK_TME_KEYID_BITS occupies bits 35:32 and specifies the number of physical-address bits interpreted as a key identifier; TME-MK is active when TME is active and this value is greater than 0.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_TME_ACTIVATE.TDX_RESERVED_KEYID_BITS occupies bits 39:36 and specifies the number of KeyID bits usable only in SEAM-private KeyIDs; this value never exceeds MK_TME_KEYID_BITS.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_MKTME_KEYID_PARTITIONING (MSR address 87H) enumerates NUM_MKTME_KIDS in bits 31:0 and NUM_TDX_PRIV_KIDS in bits 63:32.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM-private key identifiers are numbered NUM_MKTME_KIDS + 1 through NUM_MKTME_KIDS + NUM_TDX_PRIV_KIDS, while general-use TME-MK key identifiers are numbered 1 through NUM_MKTME_KIDS.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`
- **Claim.** With m enumerated by CPUID.80000008H:EAX[7:0] and k the value of MK_TME_KEYID_BITS, bits m-1:m-k of any physical address form the key identifier and only bits (m-k)-1:0 are used to address memory.  `[SDM 3C §35.2]` `[1]` `C:high` `V:durable`

## 9.9 Behaviour inside SEAM

### 9.9.1 SEAM root operation

- **Claim.** In SEAM root operation, an attempt to execute VMXOFF or VMCALL results in #GP(0), so software in SEAM cannot leave VMX operation nor invoke an SMM-transfer monitor using an SMM VM exit.  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** Entry to SEAM root operation, by either a SEAM call or a VM exit from SEAM non-root operation, blocks NMIs; executing IRET in SEAM root operation unblocks NMIs normally.  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** System-management interrupts, uncore machine checks and machine-check SMIs are masked in SEAM root operation and, if pending, are delivered after leaving SEAM root operation.  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** Triple faults and machine checks caused by poisoned cache-line consumption in SEAM root operation cause unbreakable shutdown.  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** TLB entries caching address translations formed in SEAM are tagged with an "in SEAM" bit; software in VMX root operation can invalidate them using INVEPT but not using INVVPID.  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM root operation can access a special set of SEAM-only MSRs; an attempt to access a SEAM-only MSR outside SEAM results in #GP(0).  `[SDM 3C §35.3.1]` `[1]` `C:high` `V:durable`

That SMI masking rule is the crisp statement of why SMM is outside the TDX trust boundary: firmware
cannot interpose on a running SEAM module, because the SMI simply waits.

### 9.9.2 SEAM non-root operation and the SHARED bit

- **Claim.** SMIs and machine-check SMIs occurring in SEAM non-root operation cause a VM exit instead of being delivered normally; the SMI or MSMI remains pending and is delivered following the next SEAM return.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** In SEAM non-root operation the guest-physical address width is 48 bits if the "SEAM guest-physical address width" VM-execution control is 0, even if 5-level EPT is in use.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** When the guest-physical address width is 48, an access to a guest-physical address that sets bits in the range 51:48 causes an EPT violation.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** The uppermost bit of a guest-physical address in SEAM non-root operation — bit 47 or bit 51 as appropriate — is the SHARED bit; addresses that clear it are SEAM-guest private addresses and addresses that set it are SEAM-guest shared addresses.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** In SEAM non-root operation, instruction fetches are limited to SEAM-guest private addresses and an attempt to fetch from a shared address results in #GP(0).  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** In SEAM non-root operation, CR3 and, with PAE paging, each PDPTE register must contain a SEAM-guest private address; loading a shared address results in #GP(0).  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** If linear-address translation in SEAM non-root operation encounters a paging-structure entry referencing a paging structure at a SEAM-guest shared address, a page fault occurs whose error code sets bit 3, indicating a reserved bit was set.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** Translation of a SEAM-guest private address uses EPT paging structures located by the EPTP field, and every physical address used has bits M-1:M-k replaced by bits k-1:0 of the SEAM-guest KeyID field in the VMCS.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** Translation of a SEAM-guest shared address uses EPT paging structures located by the SEAM shared EPT pointer, while bits 7:0 of the EPTP field (not the shared EPT pointer) control that translation.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** If translation of a SEAM-guest shared address would access an EPT paging structure with a SEAM-private KeyID, or yield a final physical address containing a SEAM-private KeyID, an EPT misconfiguration occurs.  `[SDM 3C §35.3.2]` `[1]` `C:high` `V:durable`

### 9.9.3 Keeping SEAM-private KeyIDs out of ordinary software

- **Claim.** Outside SEAM, attempts to load control registers and MSRs with a physical address carrying a SEAM-private KeyID result in #GP(0), with IA32_RTIT_OUTPUT_BASE checked at a different time.  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** Outside SEAM, linear-address translation without EPT that encounters a paging-structure entry with a SEAM-private KeyID results in a page fault, and guest-physical-address translation with EPT that encounters such an entry results in an EPT misconfiguration.  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry fails if it would use or load a physical address containing a SEAM-private KeyID from any VMCS field other than the SEAM shared EPT pointer.  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** A VMX instruction with a physical-address operand carrying a SEAM-private KeyID fails as if the physical address set a reserved bit to 1.  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** An attempt to load IA32_APIC_BASE with a physical address that has a non-zero KeyID results in #GP(0).  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** A cacheline written with a physical address carrying a SEAM-private KeyID cannot be read using a physical address with a different KeyID.  `[SDM 3C §35.4.2]` `[1]` `C:high` `V:durable`

## 9.10 Boundary with chapter 13

Everything above stops at the ISA. The SEAM module itself — its measurement and load sequence, the
P-SEAMLDR and NP-SEAMLDR chain, the TDX module's data structures, Secure EPT, TD lifecycle and
the SEAMCALL leaf ABI — is owned by `13-tdx.md`. If a fact mentions a TDX-specific structure name
rather than a processor mode or instruction, it belongs there.

- **Claim.** The SDM states that details regarding the platform operations required to enable SEAM are provided in the Intel Trust Domain CPU Architectural Extensions document rather than in Vol.3C.  `[SDM 3C §35.1]` `[1][14]` `C:high` `V:durable`

## 9.11 Pitfalls

1. **"SMIs cause a VM exit" is only true under the dual-monitor treatment.** Under the default
   treatment the processor leaves VMX operation entirely and no exit reason is ever recorded.
2. **The executive-VMCS pointer is a field in the SMM-transfer VMCS**, not a separate processor
   register, and it holds the VMXON pointer — not a VMCS address — when the SMM VM exit
   commenced in VMX root operation.
3. **Exit-reason bits 28 and 29 are meaningful only for SMM VM exits.** Code that masks the exit
   reason with 0xFFFF and ignores the upper bits will silently lose the root/non-root indication the
   STM needs.
4. **VMXOFF has two different relationships with SMI.** Under the default treatment it unblocks SMIs
   unless IA32_SMM_MONITOR_CTL bit 2 is set; under the dual-monitor treatment it simply fails.
5. **SEAM is not TDX.** SEAM is a processor mode with four instructions and a range register; TDX is
   the module that lives in it. Anchoring a TDX-module claim to Ch.35 is a citation error.
