# 04. VM Entries

> **中文速览**：本章是 VM-entry 的完整检查清单与执行时序，对应 SDM Vol.3C 第 29 章 "VM Entries"。当 VMLAUNCH/VMRESUME 失败、或 guest 一进入就以 exit reason 33/34 弹回时，按本章顺序逐项排查。首先必须分清三种失败模式：VMfail（根本没有发生 VM entry，控制权落到 VMLAUNCH/VMRESUME 的下一条指令）、exit reason 33（invalid guest state，guest 状态已加载后失败）、exit reason 34（MSR loading 失败）——三者的现场完全不同，诊断路径也不同。VMCS 字段本身的定义见 `02-vmcs.md`，退出侧的 exit reason 与 qualification 见 `05-vm-exit.md`，VMfailValid 的错误号表见 `08-vmx-instructions.md`。

**Maps to:** Intel SDM Vol.3C Ch.29 "VM Entries" (rev 092) [1]
**Owns:** VM-entry checks (basic, controls, host-state, guest-state), the VM-entry loading sequence, VM-entry MSR loading, event injection, and the three VM-entry failure modes.
**See also:** `02-vmcs.md` (VMCS regions and control-bit definitions) · `05-vm-exit.md` §5.3 (exit reasons 33, 34, 41) · `08-vmx-instructions.md` §8.4 (VM-instruction error numbers)

---

## 4.1 What a VM entry is, and what it can do to you

A VM entry is the transition from VMX root operation to VMX non-root operation, performed by VMLAUNCH or VMRESUME. It is not a jump: it is a long sequence of architecturally specified checks followed by a bulk state load. Almost every "my hypervisor does not boot" bug is one of those checks failing, so the checks — not the prose — are the useful content of this chapter.

- **Claim.** A VM entry is performed only by VMLAUNCH or VMRESUME, and only in VMX root operation; executing either instruction in VMX non-root operation causes a VM exit rather than a nested VM entry.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry is also used to return from SMM under the dual-monitor treatment of SMIs and SMM, in which case the SMM-transfer monitor executes VMRESUME with the executive-VMCS pointer in play; this path has its own additional checks.  `[SDM 3C Ch.29]` `[1]` `C:medium` `V:durable`
- **Claim.** The SDM's ordered steps of a VM entry are: (1) basic checks on the instruction and the current VMCS; (2) checks on the VMX controls and the host-state area; (3) *in parallel or any order* — the guest-state checks, the loading of guest state, and the clearing of address-range monitoring; (4) loading of MSRs from the VM-entry MSR-load area; (5) for VMLAUNCH, setting the launch state of the VMCS to "launched"; (6) trace-address pre-translation (TAPT) if the "Intel PT uses guest physical addresses" VM-execution control is 1; (7) event injection, if requested. This chapter's §4.5 and §4.6 split SDM step 3 into its checking and loading halves, which is why its stage numbers run one ahead of the SDM's from there on.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`
- **Claim.** Because the guest-state checks and the guest-state load happen concurrently, a guest-state failure may be discovered only after some state has already been loaded — which is precisely why the processor must recover by loading host state rather than by returning to the instruction after VMLAUNCH/VMRESUME.  `[SDM 3C §29.3]` `[1]` `C:high` `V:durable`
- **Claim.** If TAPT during VM entry causes a VM exit (EPT violation, EPT misconfiguration, page-modification log-full event or APIC access), that VM exit behaves as if it had occurred in the guest after the entry completed, the entry performs **no** event injection even with the valid bit set, and the injected-event identification and error-code fields are copied into the original-event (IDT-vectoring) fields.  `[SDM 3C §29.5]` `[1]` `C:medium` `V:durable`
- **Claim.** Failure of stage 1 or stage 2 does not start a VM entry: control passes to the instruction following VMLAUNCH or VMRESUME with the VMfail flag protocol set.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`
- **Claim.** Failure of stage 3 (guest-state checks) or stage 5 (MSR loading) occurs after guest state has been loaded; the logical processor then loads host state as it would on a VM exit and passes control to the host RIP, recording a VM-entry failure in the exit-reason field.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`

---

## 4.2 Stage 1 — basic VMX information and the VMLAUNCH/VMRESUME state requirements

These are the cheapest checks and the ones that fail most often during bring-up, because they depend on the VMCS lifecycle rather than on its contents.

- **Claim.** VMLAUNCH and VMRESUME cause #UD if executed outside VMX operation, in real-address mode, in virtual-8086 mode, or in compatibility mode (IA32_EFER.LMA = 1 with CS.L = 0).  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH and VMRESUME cause #GP(0) if executed with CPL > 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** If the current-VMCS pointer is FFFFFFFF_FFFFFFFFH (no current VMCS), VMLAUNCH and VMRESUME fail with VMfailInvalid — there is no VMCS in which to record an error number.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH fails if the launch state of the current VMCS is not "clear"; the VM-instruction error number reported is 4 (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMRESUME fails if the launch state of the current VMCS is not "launched"; the error number reported is 5 (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** A VMCS acquires launch state "clear" only from VMCLEAR, and acquires launch state "launched" only from a successful VMLAUNCH; there is no instruction that reads the launch state back, so software must track it.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry fails if there is blocking by MOV SS at the time VMLAUNCH or VMRESUME executes; the error number reported is 26, "VM entry with events blocked by MOV SS" (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH and VMRESUME fail if the current VMCS is a shadow VMCS, because a shadow VMCS is not a valid source of guest state for a VM entry (→ VMCS shadowing itself is described in `14-nested-virtualization.md`).  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`

**Bring-up rule of thumb.** A freshly allocated VMCS region must be VMCLEARed before its first use, then VMPTRLDed, then entered with VMLAUNCH. After migrating a vCPU to another logical processor the VMCS must be VMCLEARed on the old processor, which resets the launch state, so the next entry on the new processor is again a VMLAUNCH.

- **Claim.** VMCLEAR ensures that VMCS data cached on the logical processor is written to the VMCS region in memory, which is why it is mandatory before a VMCS is used on a different logical processor.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

---

## 4.3 Stage 2a — checks on the VMX controls

Every control-field check in this stage produces VM-instruction error 7, "VM entry with invalid control field(s)". The error number does not say *which* control was wrong, which is exactly why the enumeration below matters.

**The fix, not just the diagnosis.** Error 7 almost always means a control bit was set that the
processor does not allow, or a default-1 bit was left clear. Do not hand-pick bits: for each
control field, take your desired value `v` and compute

```
v_final = (v | allowed0) & allowed1
```

where `allowed0` is the low 32 bits and `allowed1` the high 32 bits of that control's capability
MSR. This forces every default-1 bit on and every unsupported bit off in one step. **If
IA32_VMX_BASIC bit 55 is set, use the `TRUE_*` capability MSRs instead of the originals** — the
non-TRUE MSRs report bits as default-1 that the processor actually lets you clear, so using them
on a capable processor needlessly constrains the VMM. The capability-MSR family and the bit-55
rule are owned by `08-vmx-instructions.md` §8.6 and `02-vmcs.md` §2.8.

- **Claim.** Failure of any check on the VMX controls produces VM-instruction error number 7, "VM entry with invalid control field(s)" (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`

### 4.3.1 Reserved-bit settings

- **Claim.** The pin-based, primary processor-based, VM-exit and VM-entry control fields must each have every bit set to a value allowed by the corresponding capability MSR. The SDM states both halves as permissions: bits 31:0 are the allowed-0 settings — *"VM entry allows control X to be 0 if bit X in the MSR is cleared to 0; if bit X in the MSR is set to 1, VM entry fails if control X is 0"* — and bits 63:32 are the allowed-1 settings — *"VM entry allows control X to be 1 if bit 32+X in the MSR is set to 1; if bit 32+X in the MSR is cleared to 0, VM entry fails if control X is 1."* Read as obligations: an allowed-0 bit of **1** forces the control to **1**, and an allowed-1 bit of **0** forces the control to **0**. Reading a *cleared* allowed-0 bit as "the control must be 0" inverts the rule and is the derivation bug behind most error-7 reports; see `08-vmx-instructions.md` §8.6.3, which owns this fact.  `[SDM 3D App.A.3.1]` `[2]` `C:high` `V:durable`
- **Claim.** The secondary processor-based controls are checked against IA32_VMX_PROCBASED_CTLS2 only when bit 31 of the primary processor-based controls ("activate secondary controls") is 1; otherwise VM entry and VMX non-root operation function as if all secondary controls were 0.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** The tertiary processor-based controls form a 64-bit field whose reserved bits are checked against IA32_VMX_PROCBASED_CTLS3, which reports allowed-1 settings only — but only when the "activate tertiary controls" primary control (bit 17) is 1; with that bit 0 no check is performed and VMX non-root operation behaves as if every tertiary control were 0.  `[SDM 3C §29.2.1.1]` `[1]` `[2]` `C:high` `V:durable`

### 4.3.2 Checks on the VM-execution controls

- **Claim.** If the "NMI exiting" pin-based control is 0, the "virtual NMIs" control must be 0; if "virtual NMIs" is 0, the "NMI-window exiting" processor-based control must be 0.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** The CR3-target count must not exceed 4; the architectural maximum number of CR3-target values supported by a logical processor is reported in IA32_VMX_MISC.  `[SDM 3C §27.6.7]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** If "use I/O bitmaps" is 1, the I/O-bitmap A and I/O-bitmap B addresses must each be 4-KByte aligned and must not set any bit beyond the processor's physical-address width.  `[SDM 3C §27.6.4]` `[1]` `C:high` `V:durable`
- **Claim.** If "use MSR bitmaps" is 1, the MSR-bitmap address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`
- **Claim.** If "use TPR shadow" is 1, the virtual-APIC address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** If "use TPR shadow" is 1 and "virtual-interrupt delivery" is 0, bits 31:4 of the TPR threshold field must be 0 — this check does **not** depend on "virtualize APIC accesses".  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** Separately, if "use TPR shadow" is 1 while "virtualize APIC accesses" **and** "virtual-interrupt delivery" are both 0, bits 3:0 of the TPR threshold must not exceed bits 7:4 of VTPR on the virtual-APIC page.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If "use TPR shadow" is 0, then "virtualize x2APIC mode", "APIC-register virtualization", "virtual-interrupt delivery" and "IPI virtualization" must all be 0.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If "virtualize APIC accesses" is 1, the APIC-access address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** "Virtualize x2APIC mode" and "virtualize APIC accesses" must not both be 1.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** If "virtual-interrupt delivery" is 1, the "external-interrupt exiting" pin-based control must be 1.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** If "process posted interrupts" is 1, then "virtual-interrupt delivery" must be 1, the "acknowledge interrupt on exit" VM-exit control must be 1, bits 15:8 of the posted-interrupt notification vector must be 0, and the posted-interrupt descriptor address must be 64-byte aligned and within the physical-address width (the descriptor layout itself is owned by `07-apic-virtualization.md` — see that file).  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** If "enable VPID" is 1, the VPID field must not be 0000H, because VPID 0000H is reserved for VMX root operation.  `[SDM 3C §27.6.12]` `[1]` `C:high` `V:durable`
- **Claim.** If "enable EPT" is 1, the EPT pointer is checked: its memory type must be one supported by the processor (as reported by IA32_VMX_EPT_VPID_CAP), its EPT page-walk length field must select a supported walk length, the accessed/dirty-flag enable bit may be 1 only if the processor supports it, and reserved bits must be 0.  `[SDM 3C §27.6.11]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** If "unrestricted guest" is 1, "enable EPT" must be 1 — an unpaged or real-address-mode guest has no guest paging structures, so EPT must supply the guest-physical to physical translation.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If "enable PML" is 1, "enable EPT" must be 1 and the PML address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.18]` `[1]` `C:high` `V:durable`
- **Claim.** If "enable VM functions" is 1, the VM-function controls must have no bit set that IA32_VMX_VMFUNC does not report; if the "EPTP switching" VM function is enabled, "enable EPT" must be 1 and the EPTP-list address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.14]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** If the "VMCS shadowing" secondary control is 1, the VMREAD-bitmap and VMWRITE-bitmap addresses must each be 4-KByte aligned and within the physical-address width (see `14-nested-virtualization.md` for how the bitmaps are used).  `[SDM 3C §27.6.15]` `[1]` `C:high` `V:durable`
- **Claim.** If "EPT-violation #VE" is 1, the virtualization-exception information address must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.19]` `[1]` `C:high` `V:durable`
- **Claim.** If "sub-page write permissions for EPT" is 1, the sub-page-permission-table pointer must be 4-KByte aligned and within the physical-address width.  `[SDM 3C §27.6.21]` `[1]` `C:medium` `V:durable`
- **Claim.** "Enable EPT" must be 1 if any of these controls is 1: "enable PML", "unrestricted guest", "mode-based execute control for EPT", "sub-page write permissions for EPT", "Intel PT uses guest physical addresses", "PEBS uses guest physical addresses", "enable HLAT", "EPT paging-write control", or "guest-paging verification".  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If "IPI virtualization" is 1, bits 2:0 of the PID-pointer table address must be 0, and both that address and the address of the last entry in the table (base + 8 × last PID-pointer index) must lie within the physical-address width.  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** If "PASID translation" is 1, the low PASID directory address and the high PASID directory address must each be 4-KByte aligned and within the physical-address width.  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** If Intel PT is enabled at the time of VM entry (IA32_RTIT_CTL.TraceEn = 1), the "load IA32_RTIT_CTL" VM-entry control must be 0; and if "Intel PT uses guest physical addresses" is 1, the "load IA32_RTIT_CTL" VM-entry control and the "clear IA32_RTIT_CTL" VM-exit control must both be 1.  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** If "use TSC scaling" is 1, the TSC-multiplier must not be zero.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If "enable HLAT" is 1, bits 2:0 and bits 11:5 of the HLATP field must be zero and its 4-KByte-aligned address must be within the physical-address width (see chapter `06`).  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** If "APIC-timer virtualization" is 1, "virtual-interrupt delivery" must be 1, "RDTSC exiting" must be 0, and bits 15:8 of the virtual timer vector must be 0.  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** If the logical processor is in SEAM at the time of VM entry, "enable EPT" must be 1 and bits 11:0 and 63:M of the SEAM shared EPT pointer must be zero, where M is CPUID.80000008H:EAX[7:0] (see `13-tdx.md`).  `[SDM 3C §29.2.1.1]` `[1]` `C:medium` `V:durable`

### 4.3.3 Checks on the VM-exit controls

- **Claim.** If the "activate VMX-preemption timer" pin-based control is 0, the "save VMX-preemption timer value" VM-exit control must be 0.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** If the corresponding count field is non-zero, the VM-exit MSR-store address and the VM-exit MSR-load address must each be 16-byte aligned, and the last byte of each list (address + 16 × count − 1) must not set any bit beyond the physical-address width; with a zero count the address is not checked at all.  `[SDM 3C §29.2.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** Rev 092 adds a second VM-exit control field: if the "activate secondary controls" primary VM-exit control is 1, reserved bits in the secondary VM-exit controls must be cleared (IA32_VMX_EXIT_CTLS2, index 493H); with that control 0 the secondary VM-exit controls are not checked and behave as 0.  `[SDM 3C §29.2.1.2]` `[1]` `[2]` `C:high` `V:durable`

### 4.3.4 Checks on the VM-entry controls

- **Claim.** If the VM-entry MSR-load count is non-zero, the VM-entry MSR-load address must be 16-byte aligned and the last byte of the list (address + 16 × count − 1) must lie within the physical-address width.  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The "entry to SMM" and "deactivate dual-monitor treatment" VM-entry controls cannot both be 1, and both must be 0 **if the processor is not in SMM** — the gate is the processor's current mode, not whether the entry is a return from SMM.  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`

The checks on the injected-event identification field (called the VM-entry interruption-information field in older versions of the manual) are also control checks (they produce error 7); they are described together with event injection in §4.8.

### 4.3.5 Checks that apply only to VM entries under the dual-monitor treatment

A VM entry that returns from SMM has an additional set of checks involving the executive VMCS, and those checks have their own error numbers. A VMM that never activates the dual-monitor treatment will never see them, which is a useful negative diagnostic: if you get one of these, something has activated SMM monitoring under you.

- **Claim.** A VM entry that returns from SMM reports error number 16 if the executive-VMCS pointer is invalid.  `[SDM 3C §33.4]` `[1]` `C:medium` `V:durable`
- **Claim.** A VM entry that returns from SMM reports error number 17 if the executive VMCS has not been launched.  `[SDM 3C §33.4]` `[1]` `C:medium` `V:durable`
- **Claim.** A VM entry that deactivates the dual-monitor treatment reports error number 18 if the executive-VMCS pointer is not the VMXON pointer.  `[SDM 3C §33.4]` `[1]` `C:medium` `V:durable`
- **Claim.** A VM entry that returns from SMM reports error number 25 if the VM-execution control fields in the executive VMCS are invalid (see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:medium` `V:durable`
- **Claim.** The executive-VMCS pointer is itself a VMCS field, and the VM-entry controls "entry to SMM" and "deactivate dual-monitor treatment" are what select this path.  `[SDM 3C §27.6.10]` `[1]` `C:high` `V:durable`

---

## 4.4 Stage 2b — checks on the host-state area

Host-state failures also leave the guest untouched, but they report a different error number, which is the fastest way to separate "my control bits are wrong" from "my host context is wrong".

- **Claim.** Failure of any check on the host-state area produces VM-instruction error number 8, "VM entry with invalid host-state field(s)" (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** The host CR0 must satisfy IA32_VMX_CR0_FIXED0 and IA32_VMX_CR0_FIXED1, and the host CR4 must satisfy IA32_VMX_CR4_FIXED0 and IA32_VMX_CR4_FIXED1; unlike the guest checks, there is no unrestricted-guest relaxation on the host side, but CR0.NW (bit 29) and CR0.CD (bit 30) are never checked because VM exit does not change them.  `[SDM 3C §29.2.2]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** If bit 23 of the host CR4 field (CET) is 1, bit 16 of the host CR0 field (WP) must also be 1.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** The host CR3 must not set any bit beyond the processor's physical-address width; bit 63 of the host CR3 field must be 0 even though MOV to CR3 gives that bit a meaning when CR4.PCIDE = 1.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** The host IA32_SYSENTER_ESP and IA32_SYSENTER_EIP fields must contain canonical addresses.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_PERF_GLOBAL_CTRL" VM-exit control is 1, the host IA32_PERF_GLOBAL_CTRL field must not set any reserved bit.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_PAT" VM-exit control is 1, each of the eight bytes of the host IA32_PAT field must encode a supported memory type: 0 (UC), 1 (WC), 4 (WT), 5 (WP), 6 (WB) or 7 (UC-); values 2 and 3 are reserved and fail the check.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_EFER" VM-exit control is 1, the host IA32_EFER field must not set any reserved bit and **both** its LMA and its LME bits must equal the "host address-space size" VM-exit control; there is no CR0.PG qualifier on the host side — that qualifier belongs to the guest check in §4.5.1.  `[SDM 3C §29.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** The host CS, SS, DS, ES, FS, GS and TR selectors must have RPL = 0 and TI = 0 (that is, selector bits 2:0 must be 000b).  `[SDM 3C §29.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** The host CS selector must not be 0000H and the host TR selector must not be 0000H; the host SS selector must not be 0000H unless the "host address-space size" VM-exit control is 1.  `[SDM 3C §29.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** The host FS base, GS base, GDTR base, IDTR base and TR base fields must each contain a canonical address.  `[SDM 3C §29.2.3]` `[1]` `C:high` `V:durable`
- **Claim.** If the "host address-space size" VM-exit control is 0, then the "IA-32e mode guest" VM-entry control must be 0, host CR4.PCIDE (bit 17) must be 0, host CR4.FRED (bit 32) must be 0, bits 63:32 of the host RIP field must be 0, and — if "load CET state" is 1 — bits 63:32 of the host IA32_S_CET and SSP fields must be 0.  `[SDM 3C §29.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the "host address-space size" VM-exit control is 1, host CR4.PAE (bit 5) must be 1, the host RIP must be canonical, and — if "load CET state" is 1 — the host IA32_S_CET and SSP fields must be canonical.  `[SDM 3C §29.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the logical processor is in IA-32e mode when VM entry executes (IA32_EFER.LMA = 1), the "host address-space size" VM-exit control must be 1; if it is outside IA-32e mode, both that control **and** the "IA-32e mode guest" VM-entry control must be 0.  `[SDM 3C §29.2.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load CET state" VM-exit control is 1, the host IA32_S_CET field must set no bit reserved in the MSR, its SUPPRESS (bit 10) and TRACKER (bit 11) bits cannot both be set, and bits 1:0 of the host SSP field must be 0 (all three in §29.2.2); the host IA32_INTERRUPT_SSP_TABLE_ADDR field must be canonical, and that check lives in **§29.2.4**, alongside the rule that makes the IA32_S_CET and SSP fields canonical only when "host address-space size" is 1.  `[SDM 3C §29.2.2]` `[SDM 3C §29.2.4]` `[1]` `C:medium` `V:durable`
- **Claim.** If the "load PKRS" VM-exit control is 1, bits 63:32 of the host IA32_PKRS field must be 0; if the "load IA32_SPEC_CTRL" VM-exit control is 1, the host IA32_SPEC_CTRL field must set no reserved bit; and if the "load FRED" VM-exit control is 1, the FRED configuration, RSP and SSP fields are each checked for reserved bits, alignment and CPU-canonicality.  `[SDM 3C §29.2.2]` `[1]` `C:medium` `V:durable`

> Practical consequence: a 64-bit VMM that forgets "host address-space size" gets error 8 on the very first VMLAUNCH, before any guest code ever runs. A 64-bit VMM that sets it but forgets "load IA32_EFER" gets a working first entry and a corrupted host EFER after the first VM exit.

---

## 4.5 Stage 3 — checks on the guest-state area

From here on the failure mode changes. A guest-state check failure does not return to the instruction after VMLAUNCH/VMRESUME; it loads host state and reports a VM entry failure through the exit-reason field. See §4.9.

- **Claim.** Failure of a guest-state check causes VM entry to fail after loading guest state; the logical processor reports basic exit reason 33, "VM-entry failure due to invalid guest state", with the VM-entry-failure bit of the exit-reason field set.  `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`

### 4.5.1 Control registers, debug registers and MSRs

- **Claim.** The guest CR0 must satisfy IA32_VMX_CR0_FIXED0 and IA32_VMX_CR0_FIXED1, except that bit 0 (PE) and bit 31 (PG) are exempt when the "unrestricted guest" control is 1, and bit 29 (NW) and bit 30 (CD) are never checked because VM entry does not change them.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If guest CR0.PG is 1 then guest CR0.PE must be 1; paging without protected mode is not an architecturally valid guest state.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** The guest CR4 must satisfy IA32_VMX_CR4_FIXED0 and IA32_VMX_CR4_FIXED1 with no exemptions, and if bit 23 of the CR4 field (CET) is 1, bit 16 of the CR0 field (WP) must also be 1.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** The guest CR3 must not set any bit beyond the processor's physical-address width.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load debug controls" VM-entry control is 1, bits 63:32 of the guest DR7 field must be 0 and the guest IA32_DEBUGCTL field must not set any reserved bit.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** The guest IA32_SYSENTER_ESP and IA32_SYSENTER_EIP fields must contain canonical addresses.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_PERF_GLOBAL_CTRL" VM-entry control is 1, the guest IA32_PERF_GLOBAL_CTRL field must not set any reserved bit.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_PAT" VM-entry control is 1, each of the eight bytes of the guest IA32_PAT field must encode memory type 0, 1, 4, 5, 6 or 7.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_EFER" VM-entry control is 1, the guest IA32_EFER field must not set any reserved bit, its LMA bit must equal the "IA-32e mode guest" VM-entry control, and if guest CR0.PG is 1 its LME bit must equal LMA.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load IA32_BNDCFGS" VM-entry control is 1, bits 11:2 of the guest IA32_BNDCFGS field must be 0 and its bound-directory base address must be canonical.  `[SDM 3C §29.3.1.1]` `[1]` `C:medium` `V:durable`

### 4.5.2 Segment registers and access rights

The VMCS stores each segment register as a selector, a base address, a segment limit, and an access-rights word. The access-rights word is checked field by field, and this is the single most common source of exit reason 33 during guest bring-up.

- **Claim.** The guest access-rights field for a segment register is laid out as: bits 3:0 segment type; bit 4 S (descriptor type); bits 6:5 DPL; bit 7 P (present); bits 11:8 reserved; bit 12 AVL; bit 13 reserved, except for CS where it is the L bit (64-bit mode active); bit 14 D/B; bit 15 G (granularity); bit 16 "unusable" segment; bits 31:17 reserved.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** A segment register whose access-rights bit 16 is 1 is "unusable"; the Type, S, P, reserved-bit and G checks on SS, DS, ES, FS and GS are skipped when that register is unusable, every LDTR access-rights check is skipped when LDTR is unusable, TR's unusable bit must itself be 0, and **CS is checked whether or not it is marked unusable** — the SDM states no separate "CS must be usable" requirement, it simply never grants CS the exemption. The **SS DPL** checks are a second exception: unlike the DS/ES/FS/GS DPL rule, which is explicitly gated on "the register is usable", SS's DPL rules carry no usability condition and run regardless.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the guest is in virtual-8086 mode (RFLAGS.VM = 1 with CR0.PE = 1), then for each of CS, SS, DS, ES, FS and GS the base address must equal the selector shifted left by 4, the segment limit must be 0000FFFFH, and the access-rights word must be 000000F3H.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** Outside virtual-8086 mode, the guest CS type must be 3 (read/write accessed data, permitted only when "unrestricted guest" is 1), 9, 11, 13 or 15 (the accessed code-segment types).  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If SS is usable, its type must be 3 or 7 (read/write accessed expand-up or expand-down data).  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If DS, ES, FS or GS is usable, its type must have bit 0 (accessed) set, and if the type indicates a code segment it must also have bit 1 (readable) set.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** For CS, SS, DS, ES, FS and GS the S bit must be 1 (code or data segment) if the register is CS or if the register is usable; for TR and LDTR, S must be 0.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The SS DPL must equal the RPL of the SS selector, except that this check does not apply when "unrestricted guest" is 1.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The SS DPL must be 0 if guest CR0.PE is 0 **or** if the CS Type is 3 (read/write accessed expand-up data segment).  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** For DS, ES, FS and GS the DPL must not be less than the RPL of the selector only when all three of the following hold: the "unrestricted guest" control is 0, the register is usable, and the Type is in the range 0–11 (a data segment or a non-conforming code segment). With "unrestricted guest" set, or for conforming code types 12–15, the check does not apply.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The P (present) bit must be 1 for CS and for every usable segment register, and for TR unconditionally.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The reserved bits of the access-rights field — bits 11:8 and bits 31:17 — must be 0 for CS, for any usable segment register, for TR, and for LDTR when it is usable.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the guest will not be virtual-8086 and the "unrestricted guest" control is 0, the RPL in the SS selector must equal the RPL in the CS selector.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The G-bit/limit cross-check applies to TR and to a usable LDTR as well as to CS and the usable data segments, and TR's and LDTR's bits 11:8 and 31:17 must be 0 on the same terms.  `[SDM 3C §29.3.1.2]` `[1]` `C:medium` `V:durable`
- **Claim.** If the guest will use FRED transitions (bit 32 of the guest CR4 field is 1), the SS DPL must be 0 or 3; if it is 0 the CS L bit must be 1, and if it is 3 both RFLAGS.IOPL and the "blocking by STI" bit of the interruptibility-state field must be 0.  `[SDM 3C §29.3.1.2]` `[1]` `C:medium` `V:durable`
- **Claim.** If the "IA-32e mode guest" VM-entry control is 1 and the CS L bit is 1, the CS D/B bit must be 0; 64-bit code segments cannot also be 32-bit default-size segments.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The G (granularity) bit is cross-checked against the limit: if any bit in the limit's bits 11:0 is 0, G must be 0; if any bit in the limit's bits 31:20 is 1, G must be 1.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The guest TR must be usable, must have S = 0, P = 1, and a type of 3 (16-bit busy TSS) or 11 (32-bit busy TSS); when "IA-32e mode guest" is 1 the TR type must be 11.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The TR selector must have TI = 0, since the task register cannot reference the LDT.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If LDTR is usable, its selector must have TI = 0 and its access rights must have type 2 (LDT), S = 0 and P = 1.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The guest TR, FS and GS base addresses must be canonical, as must the LDTR base when LDTR is usable; bits 63:32 of the CS base must be 0, and bits 63:32 of the SS, DS and ES bases must be 0 when those registers are usable.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the CS type is 3, the CS DPL must be 0; this combination arises only when "unrestricted guest" is 1.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the CS type is 9 or 11 — a non-conforming code segment — the CS DPL must equal the SS DPL.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the CS type is 13 or 15 — a conforming code segment — the CS DPL must be less than or equal to the SS DPL.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`

**Why segment checks dominate bring-up failures.** The VMCS carries the *hidden* part of every segment register — base, limit and access rights — because the descriptor cache can legitimately disagree with the descriptor in memory. VM entry therefore cannot validate a segment by re-reading the GDT; it can only check the cached values for internal consistency. Every inconsistency a real processor could never have produced is rejected, which means a VMM that synthesizes guest segment state by hand must synthesize a state the hardware could actually have reached.

- **Claim.** The guest-state area stores the selector, base address, segment limit and access rights of each of CS, SS, DS, ES, FS, GS, LDTR and TR, so that the descriptor cache is fully virtualized rather than re-derived from guest memory.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`

### 4.5.3 Descriptor-table registers

- **Claim.** The guest GDTR base and IDTR base must contain canonical addresses, and bits 31:16 of the guest GDTR limit and IDTR limit fields must be 0 — the limits are 16-bit quantities stored in 32-bit fields.  `[SDM 3C §29.3.1.3]` `[1]` `C:high` `V:durable`

### 4.5.4 RIP, RSP and RFLAGS

- **Claim.** If the "IA-32e mode guest" VM-entry control is 0, or if the CS L bit is 0, bits 63:32 of the guest RIP must be 0.  `[SDM 3C §29.3.1.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the "IA-32e mode guest" VM-entry control is 1 and the CS L bit is 1, the guest RIP must have bits 63:N identical, where N is the processor's linear-address width — the SDM says explicitly that **the guest RIP value is not required to be canonical**: bit N-1 may differ from bit N, and no check applies at all on a processor with 64 linear-address bits.  `[SDM 3C §29.3.1.4]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 63:22, bit 15, bit 5 and bit 3 of the guest RFLAGS field must be 0, and bit 1 must be 1 — the architecturally reserved RFLAGS encoding.  `[SDM 3C §29.3.1.4]` `[1]` `C:high` `V:durable`
- **Claim.** RFLAGS.VM (bit 17) must be 0 if the "IA-32e mode guest" VM-entry control is 1 or if guest CR0.PE is 0.  `[SDM 3C §29.3.1.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the injected-event identification field is valid and requests injection of an external interrupt (event type 0), RFLAGS.IF (bit 9) must be 1.  `[SDM 3C §29.3.1.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the "load CET state" VM-entry control is 1, bits 1:0 of the guest SSP field must be 0 and its bits 63:N must be identical (N = the maximum linear-address width); like guest RIP, guest SSP is not required to be canonical.  `[SDM 3C §29.3.1.4]` `[1]` `C:medium` `V:durable`

### 4.5.5 Non-register guest state

- **Claim.** The guest activity-state field must contain 0 (active), 1 (HLT), 2 (shutdown) or 3 (wait-for-SIPI), and the value must be one the logical processor supports, as reported by IA32_VMX_MISC.  `[SDM 3C §27.4.2]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** If the guest activity state is HLT, 2 or 3, the interruptibility state must not indicate blocking by STI or blocking by MOV SS.  `[SDM 3C §29.3.1.5]` `[1]` `C:medium` `V:durable`
- **Claim.** If the guest activity state is wait-for-SIPI (3), the "entry to SMM" VM-entry control must be 0 and bits 0 and 1 of the interruptibility-state field must be 0 (because any STI or MOV-SS blocking forces the active state); rev 092 imposes no requirement that the *whole* interruptibility-state field be 0.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** The activity-state field must not indicate HLT if the SS access-rights DPL is not 0, and the events an injection may carry are restricted per activity state: any event in the active state; only external interrupts, NMIs, hardware exceptions with vector 1 or 18, and "other event" with vector 0 in HLT; only NMIs and machine-check exceptions in shutdown; and no events at all in wait-for-SIPI.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** The guest interruptibility-state field defines bit 0 blocking by STI, bit 1 blocking by MOV SS, bit 2 blocking by SMI, and bit 3 blocking by NMI; bits 31:5 are reserved and must be 0.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 4 of the interruptibility-state field records that the guest was interrupted while in enclave mode.  `[SDM 3C §27.4.2]` `[1]` `C:medium` `V:durable`
- **Claim.** Bits 0 and 1 of the interruptibility-state field must not both be 1: blocking by STI and blocking by MOV SS are mutually exclusive.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** If guest RFLAGS.IF is 0, bit 0 (blocking by STI) of the interruptibility-state field must be 0.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** If the injected-event identification field requests injection of an external interrupt or an NMI, bits 0 and 1 of the interruptibility-state field must both be 0.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 3 (blocking by NMI) of the interruptibility-state field must be 0 only when **all three** hold: "virtual NMIs" is 1, the injected-event identification field is valid, and its event type is 2 (NMI). The SDM adds an explicit note that with "virtual NMIs" = 0 there is no such requirement even when injecting an NMI — so bit 3 is not unconditionally forbidden under virtual NMIs.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 2 (blocking by SMI) of the interruptibility-state field must be 0 if the processor is not in SMM, and must be **1** if the "entry to SMM" VM-entry control is 1.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** If bit 4 (enclave interruption) of the interruptibility-state field is 1, bit 1 (blocking by MOV SS) must be 0 and the processor must enumerate SGX via CPUID.07H.00H:EBX.SGX[2] = 1.  `[SDM 3C §29.3.1.5]` `[1]` `C:medium` `V:durable`
- **Claim.** The guest pending-debug-exceptions field defines bits 3:0 as B0–B3, **bit 11 as BLD** (bus lock asserted with OS bus-lock detection enabled at CPL > 0), bit 12 as "enabled breakpoint", bit 14 as BS (single-step) and bit 16 as RTM; bits 10:4, bit 13, bit 15 and bits 63:17 are reserved.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** Even though Table 27-4 names bit 11 BLD, the VM-entry check in §29.3.1.5 requires bits **11:4**, bit 13, bit 15 and bits 63:17 of the pending-debug-exceptions field to be 0 — so a VMM may not set BLD on entry.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** If bit 16 (RTM) of the pending-debug-exceptions field is 1, then bits 11:0, bits 15:13 and bits 63:17 must be 0, bit 12 must be **1**, the processor must enumerate RTM via CPUID.07H.00H:EBX[11], and the interruptibility-state field must not indicate blocking by MOV SS.  `[SDM 3C §29.3.1.5]` `[1]` `C:medium` `V:durable`
- **Claim.** If the interruptibility-state field indicates blocking by STI or by MOV SS, or if the activity state is HLT, and guest RFLAGS.TF is 1 while IA32_DEBUGCTL.BTF is 0, then bit 14 (BS) of the pending-debug-exceptions field must be 1; if RFLAGS.TF is 0 or IA32_DEBUGCTL.BTF is 1 under the same conditions, bit 14 must be 0.  `[SDM 3C §29.3.1.5]` `[1]` `C:medium` `V:durable`
- **Claim.** The VMCS-link pointer must be either FFFFFFFF_FFFFFFFFH or a 4-KByte-aligned physical address within the processor's physical-address width.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the VMCS-link pointer is not FFFFFFFF_FFFFFFFFH, bits 30:0 of the referenced region must contain the processor's VMCS revision identifier and bit 31 must equal the setting of the "VMCS shadowing" control — so the linked VMCS is a shadow VMCS if and only if that control is 1 (see `14-nested-virtualization.md`).  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** The VMCS-link pointer must also differ from the current-VMCS pointer whenever the processor is not in SMM or the "entry to SMM" control is 1, and must differ from the executive-VMCS pointer when the processor is in SMM with "entry to SMM" = 0.  `[SDM 3C §29.3.1.5]` `[1]` `C:medium` `V:durable`
- **Claim.** A VM entry that fails because of an invalid VMCS-link pointer reports exit reason 33 with exit qualification 4.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`

### 4.5.6 PDPTEs

- **Claim.** A VM entry is to a guest that uses PAE paging when guest CR0.PG is 1, guest CR4.PAE is 1 and the "IA-32e mode guest" control is 0; such an entry validates the PDPTEs with exactly the checks MOV to CR3 applies — reserved bits must be 0 and each present PDPTE must stay within the physical-address width — and fails wherever MOV to CR3 would raise #GP.  `[SDM 3C §29.3.1.6]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 11:9 of each PDPTE are ignored, and if a PDPTE's present bit is clear its bits 63:1 are ignored.  `[SDM 3C §29.3.1.6]` `[1]` `C:medium` `V:durable`
- **Claim.** The four guest PDPTE fields in the VMCS are checked only when "enable EPT" is 1; with EPT disabled the entry instead validates the PDPTEs in memory referenced by the guest CR3 field, and only when PAE paging was not already in use or CR3 is changing as a result of the entry (though it may check them anyway).  `[SDM 3C §29.3.1.6]` `[1]` `C:high` `V:durable`
- **Claim.** A VM entry that fails while loading PDPTEs reports exit reason 33 with exit qualification 2.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`

---

### 4.5.7 The IA-32e mode consistency set

Six pieces of state must agree with each other before a 64-bit guest can be entered. Getting five of six right still produces exit reason 33 with exit qualification 0, so it is worth checking them as a group.

| State | Value for a 64-bit guest | Value for a 32-bit paged guest |
|---|---|---|
| VM-entry control "IA-32e mode guest" | 1 | 0 |
| Guest IA32_EFER.LMA | 1 | 0 |
| Guest IA32_EFER.LME | 1 | 0 |
| Guest CR0.PG | 1 | 1 |
| Guest CR4.PAE | 1 | 0 or 1 |
| Guest CS access rights, L bit | 1 (with D/B = 0) | 0 |

- **Claim.** If the "IA-32e mode guest" VM-entry control is 1, then guest CR0.PG must be 1 and guest CR4.PAE must be 1.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the "IA-32e mode guest" VM-entry control is 1 and "load IA32_EFER" is 1, the guest IA32_EFER.LMA bit must be 1; the control and the MSR bit must agree.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** Rev 092 defines **no** VM-entry check forcing the CS access-rights L bit to 0 when "IA-32e mode guest" is 0. The only L-bit consistency rules at entry are that CS D/B must be 0 when the guest will be IA-32e mode and L is 1, and that bits 63:32 of guest RIP must be 0 when "IA-32e mode guest" is 0 **or** L is 0 — so a VMM must clear L itself rather than rely on a check that does not exist.  `[SDM 3C §29.3.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** If guest CR4.PCIDE is 1, the "IA-32e mode guest" VM-entry control must be 1, because PCIDs are defined only in IA-32e mode.  `[SDM 3C §29.3.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** The same consistency requirement exists independently on the host side between the "host address-space size" VM-exit control, host CR4.PAE and host IA32_EFER; the two sides are checked separately and produce different error numbers (8 for host, exit reason 33 for guest).  `[SDM 3C §27.5]` `[1]` `C:high` `V:durable`

---

## 4.6 Stage 4 — loading guest state

- **Claim.** VM entry loads, from the guest-state area, the control registers CR0, CR3 and CR4, DR7 (if "load debug controls" is 1), the guest MSRs governed by the VM-entry controls (IA32_DEBUGCTL, IA32_SYSENTER_CS/ESP/EIP, and optionally IA32_PERF_GLOBAL_CTRL, IA32_PAT, IA32_EFER, IA32_BNDCFGS), the segment registers and their hidden parts, GDTR and IDTR, RIP, RSP and RFLAGS.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry loads CR0 from the CR0 field **except** for ET (bit 4), reserved bits 15:6, 17 and 28:19, NW (bit 29) and CD (bit 30), which are never modified and whose values in the field are simply ignored; CR3 and CR4 are loaded in full. The guest/host masks and read shadows do not affect what is loaded — they only change what the guest sees when it reads the register (see `02-vmcs.md`).  `[SDM 3C §29.3.2.1]` `[1]` `C:high` `V:durable`
- **Claim.** When "load debug controls" is 1, DR7 is loaded from the DR7 field except that bits 12 and 15:14 are always forced to 0 and bit 10 is always forced to 1.  `[SDM 3C §29.3.2.1]` `[1]` `C:medium` `V:durable`
- **Claim.** VM entry clears address-range monitoring, so a MONITOR armed before the entry does not survive into the guest.  `[SDM 3C §29.3.3]` `[1]` `C:high` `V:durable`
- **Claim.** General-purpose registers and x87/SSE/AVX state are not part of the VMCS guest-state area and are not loaded by VM entry; the VMM must restore them in software immediately before VMLAUNCH/VMRESUME.  `[SDM 3C §27.4]` `[1]` `C:high` `V:durable`
- **Claim.** If the VMX-preemption timer is activated, VM entry loads the VMX-preemption timer value and the timer begins counting down in VMX non-root operation.  `[SDM 3C §29.7.4]` `[1]` `C:high` `V:durable`

### 4.6.1 What VM entry does not do

Knowing what the hardware will *not* fix for you is as useful as knowing what it checks.

- **Claim.** VM entry does not validate guest state against guest memory: it never walks the guest GDT, LDT or IDT, and never reads the guest page tables except for the PAE PDPTE case.  `[SDM 3C §29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry does not load the guest LDTR base from the guest GDT; the LDTR base, limit and access rights come from the VMCS like any other segment.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry does not save any host state: the host-state area is written entirely by the VMM with VMWRITE and is never updated by hardware, which is the structural difference from AMD's VMCB host-save area (see chapter `18`).  `[SDM 3C §27.5]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry is not required to invalidate any guest-physical mapping, nor any linear or combined mapping when "enable VPID" is 1, so the VMM must invalidate stale guest translations itself with INVVPID or INVEPT (see `08-vmx-instructions.md` §8.5); only when "enable VPID" is 0 does VM entry invalidate the linear and combined mappings associated with VPID 0000H.  `[SDM 3C §29.3.2.5]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry does not check that the guest CR3 points at a valid paging hierarchy; a bad CR3 produces guest page faults or EPT violations after entry, not an entry failure.  `[SDM 3C Ch.29]` `[1]` `C:medium` `V:durable`

---

## 4.7 Stage 5 — loading MSRs from the VM-entry MSR-load area

- **Claim.** The VM-entry MSR-load area is an array of 16-byte entries: bits 31:0 hold the MSR index, bits 63:32 are reserved and must be 0, and bits 127:64 hold the value to be written.  `[SDM 3C §27.8]` `[1]` `C:high` `V:durable`
- **Claim.** The number of entries processed is given by the VM-entry MSR-load count, and the entries are processed in order, as if by a sequence of WRMSR instructions.  `[SDM 3C §29.4]` `[1]` `C:high` `V:durable`
- **Claim.** The recommended maximum number of entries in an MSR-load or MSR-store list is 512 × (1 + the value of bits 27:25 of IA32_VMX_MISC).  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** A VM-entry MSR-load entry fails if bits 63:32 are not 0; if the index is C0000100H (IA32_FS_BASE) or C0000101H (IA32_GS_BASE); if the index is in the x2APIC range (bits 31:8 = 000008H, i.e. 00000800H–000008FFH); if the index names an MSR writable only in SMM while the VM entry did not commence in SMM; if the processor refuses the MSR for model-specific reasons; or if WRMSR with that index and value at CPL 0 would raise #GP. Rev 092 does **not** list 00000079H (IA32_BIOS_UPDT_TRIG) among the excluded indices.  `[SDM 3C §29.4]` `[1]` `C:high` `V:durable`
- **Claim.** Attempts to modify IA32_EFER.LMA through the VM-entry MSR-load area are ignored, exactly as WRMSR attempts are; and because VM entry has established CR0.PG = 1, IA32_EFER must not be placed in the area in order to change LME — WRMSR would fault.  `[SDM 3C §29.4]` `[1]` `C:medium` `V:durable`
- **Claim.** If IA32_SPEC_CTRL is included in the VM-entry MSR-load area while the "virtualize IA32_SPEC_CTRL" VM-execution control is 1, the value loaded is undefined; software should not do it.  `[SDM 3C §29.4]` `[1]` `C:medium` `V:durable`
- **Claim.** A failure while loading MSRs on VM entry produces basic exit reason 34, "VM-entry failure due to MSR loading"; the exit qualification contains the 1-based index of the entry that failed.  `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** Because MSR loading happens after guest state has been loaded, an exit-reason-34 failure leaves the processor in the same "failed VM entry" shape as exit reason 33: host state is loaded and control resumes at the host RIP.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`

---

### 4.7.1 The three MSR areas compared

| Area | Count/address fields | When processed | Failure consequence |
|---|---|---|---|
| VM-entry MSR-load | VM-entry MSR-load count, VM-entry MSR-load address | During VM entry, after guest state is loaded | VM-entry failure, exit reason 34, qualification = failing index |
| VM-exit MSR-store | VM-exit MSR-store count, VM-exit MSR-store address | During VM exit, after guest state is saved | VMX abort |
| VM-exit MSR-load | VM-exit MSR-load count, VM-exit MSR-load address | During VM exit, after host state is loaded | VMX abort |

- **Claim.** All three MSR areas use the same 16-byte entry format and require 16-byte alignment of the list base address.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** The asymmetry is a design rationale, not a specified property: the SDM states only the outcomes — entry-side MSR failure loads host state and reports exit reason 34, exit-side MSR failure takes a VMX abort — and never explains why.  `[no-spec]` `[1]` `C:low` `V:durable`
- **Claim.** MSRs that the VM-entry and VM-exit controls load directly — IA32_EFER, IA32_PAT, IA32_PERF_GLOBAL_CTRL, IA32_BNDCFGS, IA32_DEBUGCTL — have dedicated VMCS fields whose contents are validated by the control and host/guest-state checks before any state is loaded, whereas an MSR-area entry is only discovered to be bad at stage 5; the SDM names IA32_EFER and IA32_SPEC_CTRL explicitly as MSRs software should keep out of the areas.  `[SDM 3C §29.4]` `[1]` `C:medium` `V:durable`

---

## 4.8 Stage 7 — event injection via the injected-event identification field

Event injection is how a VMM forwards an exception, interrupt or NMI into the guest so that the guest handles it through its own IDT, indistinguishably from a physical event.

- **Claim.** Rev 092 names this field the **injected-event identification field** (Table 27-18, "Format of the Injected-Event Identification Field"); older versions of the manual called it the VM-entry interruption-information field, and the sub-field in bits 10:8 the "interruption type" rather than the **event type**. A reader grepping rev 092 for the old names finds only the two "older versions of this document" footnotes.  `[SDM 3C §27.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** The injected-event identification field is 32 bits wide and is laid out as: bits 7:0 vector; bits 10:8 event type; bit 11 deliver error code; bit 12 reserved; bit **13 nested-exception** (may be set only if IA32_VMX_BASIC[58] is 1); bits **30:14** reserved; bit 31 valid.  `[SDM 3C §27.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** The event types encoded in bits 10:8 are 0 external interrupt, 1 reserved, 2 non-maskable interrupt (NMI), 3 hardware exception, 4 software interrupt (INT n), 5 privileged software exception (INT1), 6 software exception (INT3 or INTO), and 7 other event.  `[SDM 3C §27.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** Event type 7 ("other event") carries vector 0 for a pending MTF VM exit — allowed only where "monitor trap flag" is supported — or, when FRED transitions would be enabled after the entry (bit 32 of the guest CR4 field is 1), vector 1 (SYSCALL) or vector 2 (SYSENTER). Type 7 is itself reserved on processors that support neither MTF nor FRED, and type 1 is reserved on all processors.  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** Type 7 with vector 0 does not deliver anything: it makes an MTF VM exit pending on the instruction boundary following VM entry, and it does so even if the "monitor trap flag" VM-execution control is 0. Vectors 1 and 2 are delivered through FRED event delivery like any other injected event.  `[SDM 3C §29.6.2]` `[1]` `C:medium` `V:durable`
- **Claim.** Injection happens only if bit 31 (valid) is 1; the processor evaluates the field after guest state and MSRs have been loaded and before the first guest instruction executes.  `[SDM 3C §29.6]` `[1]` `C:high` `V:durable`
- **Claim.** If the event type is 2 (NMI), the vector must be 2; if the type is 3 (hardware exception), the vector must not exceed 31.  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 11 (deliver error code) must be **0** whenever any of these holds: the event type is not hardware exception (so never for type 5, privileged software exception); or "unrestricted guest" is 1 and bit 0 of the guest CR0 field (PE) is 0; or IA32_VMX_BASIC[56] is 0 and the vector lies in 0–7, 9, 15, 16 or 18–31.  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** Conversely bit 11 must be **1** — not merely permitted — when all of these hold: the event type is hardware exception; "unrestricted guest" is 0 or guest CR0.PE is 1; IA32_VMX_BASIC[56] is 0; and the vector is #DF (8), #TS (10), #NP (11), #SS (12), #GP (13), #PF (14) or #AC (17).  `[SDM 3C §29.2.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The nested-exception bit (bit 13) must be 0 if the event type is not hardware exception or if IA32_VMX_BASIC[58] is read as 0.  `[SDM 3C §29.2.1.3]` `[1]` `C:medium` `V:durable`
- **Claim.** Vectors 21 (#CP) and 30 (#SX) also deliver error codes, but bit 11 is **forbidden for vectors 18–31 unless IA32_VMX_BASIC[56] is 1**; on a processor reporting 0 there, injecting #CP or #SX with an error code fails VM entry.  `[SDM 3C §29.2.1.3]` `[1]` `C:medium` `V:durable`
- **Claim.** Bits 31:16 of the **injected-event error code** field — called the VM-entry exception error code in older versions of the manual — must be 0, and the field is used only when bit 11 of the injected-event identification field is 1.  `[SDM 3C §27.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** For event types 4 (software interrupt), 5 (privileged software exception) and 6 (software exception) — and for type 7 with vector 1 or 2 — the VM-entry instruction length must be in the range 0 to 15, with 0 allowed only if bit 30 of IA32_VMX_MISC reports support for zero-length instruction injection.  `[SDM 3C §29.2.1.3]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** For a successful injection with no nested exception of a software interrupt, privileged software exception or software exception (and for FRED SYSCALL/SYSENTER), the current guest RIP is incremented by the VM-entry instruction length **before being pushed on the stack** — the register itself is not pre-advanced, and for an external interrupt, NMI or hardware exception the current guest RIP is pushed unchanged.  `[SDM 3C §29.6.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** If VM entry encounters an exception while injecting an event and that exception does not cause a VM exit, the *current* guest RIP is pushed regardless of event type or VM-entry instruction length; if that exception does cause a VM exit that saves RIP, the saved RIP is the current guest RIP.  `[SDM 3C §29.6.1.1]` `[1]` `C:medium` `V:durable`
- **Claim.** The event injected on VM entry is delivered using the guest IDT and the guest's own descriptor tables; a fault encountered during that delivery is itself subject to the exception bitmap and can cause an immediate VM exit with a valid IDT-vectoring information field (see `05-vm-exit.md` §5.6).  `[SDM 3C §29.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** §29.7 defines the term precisely: a VM entry is **injecting** if bit 31 (valid) of the injected-event identification field is 1 **and** the event type is 0, 2, 3, 4, 5 or 6 — type 7 ("other event"), which is how a pending MTF exit is requested, is excluded, so the rules below do not apply to it. If the VM entry is injecting, the logical processor is in the **active** state after VM entry whatever the activity-state field says — the field is still consistency-checked, but it no longer determines the post-entry activity state.  `[SDM 3C §29.7]` `[SDM 3C §29.7.2]` `[1]` `C:high` `V:durable`

### 4.8.1 Injection versus the guest's own blocking state

Injection bypasses some guest blocking and is forbidden in combination with others. The consistency checks in §4.5.5 exist precisely to stop a VMM from asking for an architecturally impossible delivery.

- **Claim.** Injection of an external interrupt requires guest RFLAGS.IF to be 1 and requires that the interruptibility-state field indicate neither STI blocking nor MOV-SS blocking; the processor does not silently defer the event.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM that has an interrupt to deliver but finds the guest not ready should not inject it; it should instead set the "interrupt-window exiting" control and wait for the resulting VM exit with basic exit reason 7.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** The analogous mechanism for NMIs is "NMI-window exiting", which produces a VM exit with basic exit reason 8 once virtual-NMI blocking ends.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** An event being injected never causes a VM exit directly, whatever the VM-execution controls say — setting "NMI exiting" does not turn an injected NMI into a VM exit; only a nested exception selected by the exception bitmap, a task gate reached by the injected vector, a triple fault, or an access to the APIC-access page during delivery can turn injection into an exit.  `[SDM 3C §29.6.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** Injection **does** change post-entry blocking state: if the VM entry is injecting there is no blocking by STI or by MOV SS afterwards whatever the interruptibility-state field said, and injecting an NMI while "virtual NMIs" is 1 puts virtual-NMI blocking in effect after VM entry. What injection does not do is write those facts back into the guest-state area.  `[SDM 3C §29.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** If VM entry injects an event while the activity-state field indicates wait-for-SIPI, the VM entry fails a guest-state check: no event is allowed for injection in that state.  `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`

---

## 4.9 The three failure modes — how to tell them apart

This is the section to read first when a VM entry misbehaves.

| Mode | Where the failure is detected | Where control goes | How you observe it |
|---|---|---|---|
| **VMfail** | Basic checks, VMX controls, host-state area | Instruction after VMLAUNCH/VMRESUME | RFLAGS.CF or RFLAGS.ZF set; error number in the VM-instruction error field (when ZF is set) |
| **Exit reason 33** | Guest-state checks | Host RIP, via a host-state load | Exit-reason field = 8000_0021H; exit qualification narrows the cause |
| **Exit reason 34** | VM-entry MSR-load area processing | Host RIP, via a host-state load | Exit-reason field = 8000_0022H; exit qualification = 1-based failing entry index |

- **Claim.** VMfailInvalid is signalled by RFLAGS.CF = 1 with ZF = 0 and no error number recorded; it is used when there is no valid current VMCS in which to store one.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMfailValid is signalled by RFLAGS.ZF = 1 with CF = 0, and the error number is written into the VM-instruction error field of the current VMCS, whose numbers are tabulated in §33.4 (→ see `08-vmx-instructions.md` §8.4).  `[SDM 3C §27.9.5]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 31 of the exit-reason field is the VM-entry-failure indicator: it is 1 for exit reasons 33, 34 and 41 and 0 for a VM exit from a running guest.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Basic exit reason 41, "VM-entry failure due to machine-check event", is reported when a machine-check event occurs during VM entry.  `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** On a VM-entry failure reported through the exit-reason field the processor updates only the exit-reason and exit-qualification fields; **all other VM-exit information fields are left unmodified**, not undefined — they still hold whatever the previous VM exit or the VMM put there. The guest-state area is not modified, no MSRs are saved into the VM-exit MSR-store area, and the valid bit in the injected-event identification field is **not** cleared.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`
- **Claim.** On such a failure the state of blocking by NMI is whatever it was before the VM entry, and MSRs are still loaded from the VM-exit MSR-load area as they would be on a VM exit.  `[SDM 3C §29.8]` `[1]` `C:medium` `V:durable`
- **Claim.** On a VM-entry failure reported through the exit-reason field, host state is loaded exactly as it would be for a VM exit, so the VMM resumes at the host RIP with the host-state area context; bits 30:16 of the exit-reason field are cleared and bit 31 is set.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`
- **Claim.** A VM-entry failure due to an attempt to inject an NMI into a guest that is blocking events through the STI blocking bit reports exit reason 33 with exit qualification 3.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`
- **Claim.** For exit reason 33 the exit qualification is 0 in most cases; the only non-zero values are 2 (PDPTE loading), 3 (NMI injection blocked by STI) and 4 (invalid VMCS-link pointer), with 1 not used. Guest-state checks may run in any order, so one reported cause does not rule out others, and different processors may report different qualifications for the same VMCS.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`

---

## 4.10 A debugging order of operations

1. **Read RFLAGS immediately after VMLAUNCH/VMRESUME.** If CF is set, the VMCS pointer is bad — you are not even in the checks yet. If ZF is set, VMREAD the VM-instruction error field; error 7 means a VMX control, error 8 means host state, errors 4/5/26 mean the VMCS lifecycle.
2. **If control reached your host RIP instead**, VMREAD the exit reason. A value with bit 31 set is a failed VM entry, not a guest exit. Distinguish 33 (guest state) from 34 (MSR loading) from 41 (machine check).
3. **For 34**, the exit qualification is the 1-based index into your VM-entry MSR-load list; the offending entry is at `msr_load_area + 16 * (qualification - 1)`.
4. **For 33 with a non-zero qualification**, use §4.9. For 33 with qualification 0, walk §4.5 in order; segment access rights (§4.5.2) and the IA-32e-mode consistency set (CR0.PG / CR4.PAE / IA32_EFER.LME / IA32_EFER.LMA / "IA-32e mode guest" / CS.L) account for most of these failures.
5. **For error 7 with no obvious cause**, re-derive every control field from the capability MSRs rather than from a hard-coded constant; the allowed-0 half of a capability MSR forces bits *on*, and a VMM written against one microarchitecture will fail this check on another.

- **Claim.** Because the allowed-0 half of a control-capability MSR forces certain "default-1" bits to 1, a control field cannot simply be zero-initialized; the TRUE_* capability MSRs exist precisely to let software discover which of those default-1 bits may legitimately be cleared (see `08-vmx-instructions.md` §8.6).  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

---

## 4.11 Failure signatures seen in practice

| Symptom | Most likely cause | Where to look |
|---|---|---|
| CF set immediately, no error number | No current VMCS: VMPTRLD was never executed, or VMCLEAR cleared the pointer | §4.2 |
| ZF set, error 4 on the first entry | VMLAUNCH issued on a VMCS whose launch state is already "launched" — usually a resume/launch bookkeeping bug | §4.2 |
| ZF set, error 5 after a vCPU migration | VMCLEAR reset the launch state; the next entry must be VMLAUNCH, not VMRESUME | §4.2 |
| ZF set, error 7, worked on one machine and not another | A control bit was hard-coded rather than derived from the capability MSRs | §4.3.1, §4.10 |
| ZF set, error 7 after enabling a new feature | A dependency check: unrestricted guest without EPT, virtual-interrupt delivery without external-interrupt exiting, posted interrupts without acknowledge-interrupt-on-exit | §4.3.2 |
| ZF set, error 8 on a 64-bit VMM's very first entry | "Host address-space size" is 0, or a host segment selector has a non-zero RPL/TI | §4.4 |
| ZF set, error 26 intermittently | The VMM executed VMLAUNCH/VMRESUME in the shadow of a MOV to SS or POP SS | §4.2 |
| Exit reason 8000_0021H, qualification 0 | An ordinary guest-state check — usually segment access rights or the IA-32e consistency set | §4.5.2, §4.5.7 |
| Exit reason 8000_0021H, qualification 2, 3 or 4 | PDPTE load, NMI injection blocked by STI, or an invalid VMCS-link pointer | §4.9 |
| Exit reason 8000_0022H | An entry in the VM-entry MSR-load list; the qualification gives the 1-based index | §4.7 |
| Guest runs but immediately triple-faults | Entry succeeded; the problem is guest paging, the guest IDT, or EPT — not a VM-entry check | `05-vm-exit.md` |

- **Claim.** The distinction that makes this table usable is that a VMfail never changes guest-visible state at all, while an exit-reason-33 or exit-reason-34 failure has already overwritten the processor's architectural state with the contents of the guest-state area before failing.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`
- **Claim.** Because a failed VM entry loads host state on the way out, the VMM's own context after an exit-reason-33 failure is the host-state area's context, not the context that executed VMLAUNCH; a VMM that keeps state in registers across the entry must reload it in its exit path.  `[SDM 3C §29.8]` `[1]` `C:high` `V:durable`

---

## 4.12 Cross-references

- VMCS region format, field encodings and the meaning of individual control bits: `02-vmcs.md`.
- The exit-reason field layout, the full basic exit reason list, and exit qualification formats: `05-vm-exit.md`.
- VMLAUNCH/VMRESUME operand and exception behaviour, the VM-instruction error table, and the VMX capability MSRs: `08-vmx-instructions.md`.
- EPT pointer contents and EPT-related entry checks: chapter `06` (EPT and address translation).
- Virtual-APIC page, posted-interrupt descriptor and APICv-related entry checks: `07-apic-virtualization.md`.
