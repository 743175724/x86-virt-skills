# 15. Security: Threat Model, Transient-Execution Defects, and Defensive Virtualization

> **中文速览**：本章回答两个问题——VT 架构到底保证什么、不保证什么；以及当"隔离"在微架构层被绕过时，究竟有哪些**真实可写的控制位**可用。核心是一张 CVE → 机制 → 缓解位矩阵（L1TF/Foreshadow、MDS、TAA、SRBDS、Spectre v2/BHI、Retbleed、Downfall），每个 MSR 地址与位号都取自 SDM Vol.4 §2.1 表 2-2 原文。必须记住的区分：绝大多数"虚拟机逃逸"CVE 是 **VMM 软件缺陷**（QEMU/Hyper-V/VMware 的设备模拟），不是 VT 硬件缺陷；VT 硬件层的真实缺陷以瞬态执行侧信道形态出现。本章同时**独占** Windows 侧的防御性虚拟化：VBS（VTL0/VTL1、安全内核、IUM trustlet）、HVCI（用 EPT 强制内核代码页 W^X）、Credential Guard、Kernel DMA Protection 与 DRTM/Intel TXT。相邻章节：`12-vtd-faults-bios-siov.md`（VT-d 与 DMA 防护）、`14-nested-virtualization.md`（嵌套机制）、`90-dated-landscape.md`（产品与时效信息）。

**Maps to:** no single SDM chapter. Normative anchors used here are SDM Vol.4 §2.1 "Architectural MSRs" (Table 2-2) [5], SDM Vol.3C §27.6.25 (virtualization of IA32_SPEC_CTRL) and Ch.31 (EPT) [1], and Intel Security Center advisories [23]
**Owns:** the VT threat model · the hardware-defect / software-defect distinction · the CVE → mechanism → mitigation matrix · VBS, HVCI, Credential Guard · the VBS overhead-figure conflict
**See also:** `12-vtd-faults-bios-siov.md` (VT-d, DMA remapping, pre-boot protection) · `14-nested-virtualization.md` (why the Windows hypervisor is resident) · `06-address-translation.md` (EPT entry formats, MBEC) · `13-tdx.md` (removing the host from the TCB) · `90-dated-landscape.md`

---

## 15.1 What the VMX architecture guarantees — and what it does not

VMX is an *architectural* isolation mechanism. It defines which events cause a VM exit, which state the processor saves and loads across a transition, and which guest-physical accesses are permitted by EPT. Everything it guarantees is a statement about architectural behaviour.

**It does guarantee:**

- **Claim.** A guest in VMX non-root operation cannot reach VMX root operation of its own accord: VMXON, VMLAUNCH, VMRESUME, VMCLEAR, VMPTRLD, VMPTRST, VMXOFF, VMCALL, INVEPT and INVVPID all cause VM exits unconditionally, so the VMM mediates every attempt.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** A guest cannot reach host-physical memory that EPT does not map for it: guest-physical addresses are translated through EPT paging structures under VMM control, and an access that EPT forbids raises an EPT violation that exits to the VMM; see `06-address-translation.md`.  `[SDM 3C §31.3.2]` `[SDM 3C §31.3.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** A guest cannot silently corrupt the VMM's execution context: host state is loaded from the host-state area of the VMCS on every VM exit, and the guest can neither read nor write the VMCS of the VMM that runs it.  `[SDM 3C §27.5]` `[SDM 3C §30.5]` `[1]` `C:high` `V:durable`

**It does not guarantee:**

- **Claim.** VMX makes no statement about microarchitectural state — caches, fill buffers, store buffers, load ports, branch predictors, register file buffers — and none of that state is architecturally partitioned by the VMX transitions; every transient-execution defect in §15.5 lives in that gap.  `[SDM 3C §28.1.2]` `[350]` `C:high` `V:durable`
- **Claim.** VMX makes no statement about timing: a guest can measure that it is virtualized, and a malicious hypervisor can misreport time, so "the guest cannot tell" has never been an architectural property.  `[SDM 3C §28.3]` `[1]` `[374]` `C:medium` `V:durable`
- **Claim.** VMX does not protect the VMM from its own device models: everything a VMM emulates on behalf of a guest — disk controllers, network adapters, USB, graphics — is ordinary host software reachable by guest-controlled input, and it is outside the architectural boundary entirely.  `[SDM 3C §28.1.3]` `[375]` `C:high` `V:durable`
- **Claim.** VMX does not defend against DMA: a device that can write host memory bypasses EPT completely, which is why VT-d and not VT-x is the relevant mechanism; see `12-vtd-faults-bios-siov.md`.  `[VT-d 5.20 Ch.3]` `[8]` `C:high` `V:durable`

---

## 15.2 Hardware defect or software defect? Reading "VM escape" correctly

This distinction decides what you patch, and the older literature blurs it constantly.

| Class | Where the defect is | How it is fixed | Example |
|---|---|---|---|
| VT hardware / microarchitectural defect | silicon behaviour | microcode + OS/VMM software mitigation, sometimes silicon respin | L1TF, MDS, Downfall |
| VMM software defect | the hypervisor's own code, usually device emulation | patch the VMM | VENOM, QEMU USB, Hyper-V `vmswitch.sys` |
| Legitimate-feature abuse | no defect at all | architectural countermeasures (measured launch) | SubVirt, Blue Pill, Vitriol |

- **Claim.** VENOM (CVE-2015-3456) was a buffer overflow in QEMU's virtual Floppy Disk Controller, which is initialized for every x86 guest regardless of configuration and cannot be removed or disabled; a privileged guest user could crash the QEMU process or execute code on the host with the QEMU process's privileges. Nothing in VT-x was involved.  `[SDM 3C §28.1.3]` `[375]` `C:high` `V:durable`

- **Claim.** CVE-2020-14364 was an out-of-bounds read/write in QEMU's USB emulation, again a device-model defect in host user-space code reachable from the guest.  `[SDM 3C §28.1.3]` `[394]` `C:high` `V:durable`

- **Claim.** CVE-2021-28476 was a remote-code-execution defect in Hyper-V's virtual switch driver `vmswitch.sys`, reachable by a guest sending crafted RNDIS packets; it demonstrates that type-1 hypervisors have the same class of exposure in their paravirtualized device paths.  `[SDM 3C §28.1.3]` `[393]` `C:high` `V:durable`

- **Claim.** Contemporary competition-grade escapes follow the same pattern: the 2025 Pwn2Own VMware Workstation escape exploited a heap overflow in the PVSCSI controller implementation, not any processor feature.  `[SDM 3C §28.1.3]` `[377]` `C:medium` `V:durable`

- **Claim.** The corollary for risk assessment: minimising the emulated device surface removes the dominant escape class, while microcode currency and scheduling policy address the hardware class; the two are independent and neither substitutes for the other.  `[SDM 3C §28.1.3]` `[375]` `[376]` `C:medium` `V:durable`

### 15.2.1 Triaging a "VM escape" report

Four questions separate the classes quickly, and they are worth asking in this order:

1. **What component holds the defect?** A device model, a paravirtual channel or a management agent means a software defect in the VMM: the fix is a VMM update and the blast radius is that VMM's deployments, not the processor family.
2. **Does exploitation require specific microarchitectural conditions** — co-residency on a physical core, a particular speculation window, cache-timing measurement? That signature indicates a hardware defect, mitigated by microcode plus software sequences, and it usually *leaks* rather than *executes*.
3. **What is the primitive?** Arbitrary read/write in the host address space or code execution in the host points to a software defect; a low-bandwidth read of values that were recently in some buffer points to a transient-execution defect.
4. **Is there a defect at all?** Techniques that use documented VMX behaviour exactly as specified (§15.6) have no patch, only architectural countermeasures.

- **Claim.** The two classes have disjoint remediations: a device-model defect is fixed by updating the VMM and cannot be mitigated by microcode, while a transient-execution defect is not fixed by any VMM change alone and requires microcode plus the control settings of §15.4.  `[SDM 3C §28.1.3]` `[350]` `[375]` `C:high` `V:durable`

- **Claim.** The historical record supports the emphasis: the escapes with the largest operational impact — VENOM, the QEMU USB defect, the Hyper-V virtual-switch defect, the competition escapes — are all device-model or paravirtual-path defects, while the processor-level defects have produced disclosure rather than takeover.  `[SDM 3C §28.1.3]` `[375]` `[393]` `[394]` `C:medium` `V:durable`

---

## 15.3 Why transient execution breaks the VM boundary specifically

Transient-execution defects matter more for virtualization than for most other isolation boundaries for three structural reasons.

- **Claim.** The attacker in a multi-tenant VM setting legitimately controls a whole operating system, including page tables, so it can construct the exact architectural preconditions (non-present or reserved-bit paging-structure entries, gather patterns, branch histories) that a defect requires.  `[SDM 3C §31.3.3.2]` `[352]` `[368]` `C:high` `V:durable`

- **Claim.** Sibling logical processors share microarchitectural structures — the L1 data cache in the L1TF case, fill buffers and load ports in the MDS case — so a VM co-resident on the other thread of the same physical core is inside the same structure-sharing domain as its victim.  `[SDM 3C §28.1.2]` `[352]` `[354]` `[361]` `C:high` `V:durable`

- **Claim.** The victim of a VM-boundary leak is unusually valuable: the hypervisor's own memory, another tenant's memory, or the key material held by whatever runs in the isolated world, which is why Intel assigns VMM-specific CVEs to these defects (CVE-2018-3646 is precisely the VMM case of L1TF).  `[SDM 3C §31.3.3.2]` `[351]` `[353]` `C:high` `V:durable`

---

## 15.4 The mitigation control surface

Every address and bit position in this section was read from SDM Vol.4 §2.1, Table 2-2 "IA-32 Architectural MSRs" (rev 092).

### 15.4.1 Control MSRs

- **Claim.** IA32_SPEC_CTRL is at MSR address **48H** and is read/write; bit 0 is IBRS (Indirect Branch Restricted Speculation), bit 1 is STIBP (Single Thread Indirect Branch Predictors), bit 2 is SSBD (Speculative Store Bypass Disable). The MSR reads 0 after reset and is unaffected by INIT# or SIPI#.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** IA32_SPEC_CTRL also defines bit 3 IPRED_DIS_U, bit 4 IPRED_DIS_S, bit 5 RRSBA_DIS_U, bit 6 RRSBA_DIS_S, bit 7 PSFD, bit 8 DDPD_U and bit 10 BHI_DIS_S, each enumerated by its own CPUID leaf; bit 9 is reserved.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** IA32_PRED_CMD is at MSR address **49H**, is write-only, and bit 0 is IBPB (Indirect Branch Prediction Barrier); it is enumerated by CPUID.07H.00H:EDX[26], the same bit that enumerates IBRS.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** IA32_FLUSH_CMD is at MSR address **10BH**, is write-only, bit 0 is L1D_FLUSH ("Writeback and invalidate the L1 data cache"), and support is enumerated by CPUID.07H.00H:EDX[28].  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** IA32_TSX_CTRL is at MSR address **122H**: bit 0 RTM_DISABLE makes XBEGIN always abort with EAX code 0, and bit 1 TSX_CPUID_CLEAR makes CPUID report RTM and HLE as absent. Its presence is indicated by IA32_ARCH_CAPABILITIES bit 7.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** IA32_MCU_OPT_CTRL is at MSR address **123H**: bit 0 RNGDS_MITG_DIS (disables the SRBDS mitigation for RDRAND/RDSEED outside enclaves), bit 1 RTM_ALLOW, bit 2 RTM_LOCKED, bit 3 FB_CLEAR_DIS (prevents VERW from performing an FB_CLEAR action), bit 4 GDS_MITG_DIS and bit 5 GDS_MITG_LOCK.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

### 15.4.2 IA32_ARCH_CAPABILITIES — the "you are not affected" register

- **Claim.** IA32_ARCH_CAPABILITIES is a read-only MSR at address **10AH**, enumerated by CPUID.07H.00H:EDX[29]; a set bit means the processor does not need, or already has, the corresponding mitigation.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

| Bit | Name | Meaning (SDM Vol.4 §2.1 wording) |
|---|---|---|
| 0 | RDCL_NO | not susceptible to Rogue Data Cache Load |
| 1 | IBRS_ALL | supports enhanced IBRS |
| 2 | RSBA | may use alternate predictors when the RSB is empty |
| 3 | SKIP_L1DFL_VMENTRY | the hypervisor need not flush the L1D on VM entry |
| 4 | SSB_NO | not susceptible to Speculative Store Bypass |
| 5 | MDS_NO | not susceptible to Microarchitectural Data Sampling |
| 7 | TSX_CTRL | IA32_TSX_CTRL MSR is present |
| 8 | TAA_NO | not affected by TAA |
| 13 / 14 / 15 | SBDR_SSDP_NO / FBSDP_NO / PSDP_NO | not affected by the corresponding stale-data propagators |
| 17 | FB_CLEAR | VERW overwrites fill-buffer values as part of MD_CLEAR |
| 18 | FB_CLEAR_CTRL | IA32_MCU_OPT_CTRL[3] (FB_CLEAR_DIS) is supported |
| 19 | RRSBA | may exhibit restricted RSB alternate behaviour |
| 20 | BHI_NO | BHI_NO branch-prediction behaviour |

- **Claim.** The bit positions in the table above — RDCL_NO 0, IBRS_ALL 1, RSBA 2, SKIP_L1DFL_VMENTRY 3, SSB_NO 4, MDS_NO 5, IF_PSCHANGE_MC_NO 6, TSX_CTRL 7, TAA_NO 8, SBDR_SSDP_NO 13, FBSDP_NO 14, PSDP_NO 15, FB_CLEAR 17, FB_CLEAR_CTRL 18, RRSBA 19, BHI_NO 20 — are the architectural definitions of IA32_ARCH_CAPABILITIES.  `[SDM 4 §2.1]` `[5]` `C:high` `V:durable`

- **Claim.** FB_CLEAR carries an important interaction: on processors that report it, L1D_FLUSH does **not** overwrite fill-buffer values, so an L1TF mitigation that flushes L1D is not automatically an MDS mitigation and the VERW sequence is still required.  `[SDM 4 §2.1]` `[5]` `[354]` `C:high` `V:durable`

- **Claim.** A VMM must virtualize IA32_ARCH_CAPABILITIES honestly: telling a guest that a mitigation is unnecessary when the underlying part needs it disables the guest's own defences, and Intel's own guidance about SKIP_L1DFL_VMENTRY is addressed to nested VMMs specifically; see `14-nested-virtualization.md` for the nested MSR-exposure rules.  `[SDM 4 §2.1]` `[5]` `[352]` `C:high` `V:durable`

### 15.4.3 The VMX-visible controls

- **Claim.** On processors supporting the 1-setting of the "virtualize IA32_SPEC_CTRL" VM-execution control, the VMCS gains two 64-bit fields: an IA32_SPEC_CTRL **mask**, whose set bits prevent guest software from modifying the corresponding IA32_SPEC_CTRL bits, and an IA32_SPEC_CTRL **shadow**, holding the value guest software expects to see.  `[SDM 3C §27.6.25]` `[1]` `C:high` `V:durable`

  > "IA32_SPEC_CTRL mask. Setting a bit in this field prevents guest software from modifying the corresponding bit in the IA32_SPEC_CTRL MSR. … IA32_SPEC_CTRL shadow. This field contains the value that guest software expects to be in the IA32_SPEC_CTRL MSR." [1] §27.6.25

- **Claim.** This is the architectural answer to a recurring problem: before it existed, a VMM that wanted to hold IBRS/STIBP/SSBD at a chosen value had to intercept every guest write to IA32_SPEC_CTRL through the MSR bitmap and emulate the read-back; see `02-vmcs.md` for the MSR-bitmap field.  `[SDM 3C §27.6.9]` `[SDM 3C §27.6.25]` `[1]` `C:medium` `V:durable`

- **Claim.** EPT is itself part of the mitigation surface, because a VMM's EPT paging-structure entries are subject to the same terminal-fault behaviour as OS paging-structure entries — Intel states that terminal faults can occur while reading EPT entries.  `[SDM 3C §31.3.2]` `[1]` `[352]` `C:high` `V:durable`

### 15.4.4 Enumerating the mitigation state

Every control above is gated by a CPUID bit, and a VMM that virtualizes CPUID inconsistently with the MSRs it emulates will either break guests or silently disarm them.

- **Claim.** The relevant enumeration bits all live in CPUID.07H.00H:EDX: bit 26 enumerates IBRS and IBPB (IA32_SPEC_CTRL bit 0 and IA32_PRED_CMD bit 0), bit 27 enumerates STIBP, bit 31 enumerates SSBD, bit 28 enumerates L1D_FLUSH (IA32_FLUSH_CMD), bit 29 enumerates IA32_ARCH_CAPABILITIES, bit 10 enumerates MD_CLEAR and bit 9 enumerates SRBDS_CTRL.  `[SDM 4 §2.1]` `[5]` `[352]` `[354]` `[364]` `C:high` `V:durable`

- **Claim.** The dependency runs one way: a guest reads CPUID to decide whether an MSR exists, then reads IA32_ARCH_CAPABILITIES to decide whether to use it, so a VMM that reports a mitigation MSR without honouring its semantics produces a guest that believes it is protected and is not.  `[SDM 4 §2.1]` `[5]` `[350]` `C:high` `V:durable`

- **Claim.** The values must also be stable for the lifetime of the VM, including across migration to a different host, which in practice means presenting the intersection of the mitigation features available across the hosts a VM may run on rather than the features of the host it happens to start on.  `[SDM 4 §2.1]` `[5]` `[350]` `C:medium` `V:durable`

- **Claim.** Some controls must be withheld from guests outright rather than merely virtualized: the mitigation opt-outs — RNGDS_MITG_DIS, GDS_MITG_DIS, FB_CLEAR_DIS in IA32_MCU_OPT_CTRL — weaken a protection whose scope is the physical core, not the VM.  `[SDM 4 §2.1]` `[5]` `[364]` `[365]` `C:high` `V:durable`

---

## 15.5 The CVE → mechanism → mitigation matrix

| Family | CVE(s) | Architectural mechanism | Mitigation controls |
|---|---|---|---|
| Meltdown / RDCL | CVE-2017-5754 | speculative load past a page-fault condition reads L1D data | RDCL_NO (ARCH_CAP bit 0); OS page-table isolation |
| Spectre v1 | CVE-2017-5753 | bounds-check bypass in the victim's own code | code-level barriers; no MSR fixes this |
| Spectre v2 / BTI | CVE-2017-5715 | indirect-branch target injection across privilege and VM boundaries | IBRS (SPEC_CTRL bit 0), eIBRS (IBRS_ALL, ARCH_CAP bit 1), STIBP (bit 1), IBPB (PRED_CMD bit 0), retpoline, RSB filling on VM exit |
| Speculative Store Bypass | CVE-2018-3639 | load speculates past an older unresolved store | SSBD (SPEC_CTRL bit 2); SSB_NO (ARCH_CAP bit 4) |
| L1TF / Foreshadow | CVE-2018-3615 (SGX), CVE-2018-3620 (OS/SMM), CVE-2018-3646 (VMM) | terminal fault on a non-present or reserved-bit entry lets the frame bits address L1D directly; applies to EPT entries too | PTE inversion; L1D_FLUSH (FLUSH_CMD bit 0) on VM entry; SKIP_L1DFL_VMENTRY (ARCH_CAP bit 3); RDCL_NO; SMT policy |
| MDS — RIDL, Fallout, ZombieLoad | CVE-2018-12126 (MSBDS, store buffer), CVE-2018-12127 (MLPDS, load ports), CVE-2018-12130 (MFBDS, fill buffers), CVE-2019-11091 (MDSUM, uncacheable memory) | in-flight data sampled from internal buffers during transient execution | microcode + VERW with MD_CLEAR (CPUID.07H.00H:EDX[10]); MDS_NO (ARCH_CAP bit 5); FB_CLEAR (bit 17); SMT policy |
| TAA | CVE-2019-11135 | TSX asynchronous abort re-exposes the MDS buffers | VERW buffer clearing; TSX disable via IA32_TSX_CTRL (122H) bits 0/1; TAA_NO (ARCH_CAP bit 8) |
| SRBDS | CVE-2020-0543 | special-register staging buffer shared across cores leaks RDRAND / RDSEED / EGETKEY results | microcode overwrite of the staging buffer; opt-out RNGDS_MITG_DIS (MCU_OPT_CTRL bit 0); SRBDS_CTRL = CPUID.07H.00H:EDX[9] |
| MMIO stale data | SBDR / SSDP / FBSDP / PSDP | stale data propagated through fill buffers on MMIO accesses | VERW/FB_CLEAR path; SBDR_SSDP_NO, FBSDP_NO, PSDP_NO (ARCH_CAP bits 13/14/15) |
| Retbleed | CVE-2022-29901 (Intel), CVE-2022-29900 (AMD); INTEL-SA-00702 also lists CVE-2022-28693 | RET speculates through the indirect predictor when the RSB underflows | RSB stuffing; IBRS / eIBRS; RRSBA_DIS_S (SPEC_CTRL bit 6); RRSBA (ARCH_CAP bit 19) |
| BHI | branch history injection | cross-mode branch-history poisoning survives eIBRS | BHI_DIS_S (SPEC_CTRL bit 10); BHI_NO (ARCH_CAP bit 20); software BHB clearing |
| Downfall / GDS | CVE-2022-40982, INTEL-SA-00828 | faulting gather forwards stale SIMD register-buffer data | microcode mitigation on by default; GDS_MITG_DIS / GDS_MITG_LOCK (MCU_OPT_CTRL bits 4/5); VMM must not let guests disable it |

- **Claim.** Three further members of the family appear in the matrix above and are covered by the same control surface: CVE-2017-5754 (Meltdown / Rogue Data Cache Load), retired by RDCL_NO at IA32_ARCH_CAPABILITIES bit 0; CVE-2017-5753 (Spectre v1, bounds-check bypass), which has no MSR mitigation and must be fixed in the vulnerable code; and CVE-2018-3639 (Speculative Store Bypass), mitigated by SSBD at IA32_SPEC_CTRL bit 2 and retired by SSB_NO at IA32_ARCH_CAPABILITIES bit 4.  `[SDM 4 §2.1]` `[5]` `[350]` `[366]` `C:high` `V:durable`

### 15.5.1 L1TF / Foreshadow

- **Claim.** L1TF has three CVEs by target: CVE-2018-3615 (L1 Terminal Fault-SGX, the original Foreshadow), CVE-2018-3620 (L1 Terminal Fault-OS/SMM) and CVE-2018-3646 (L1 Terminal Fault-VMM); Intel tracks them as INTEL-SA-00161.  `[SDM 3C §31.3.3.2]` `[351]` `[353]` `[23]` `C:high` `V:durable`

- **Claim.** The mechanism is a terminal fault: when the paging-structure entry controlling an access has the Present bit clear or reserved bits set, the address bits of that entry may still be used speculatively to read the L1 data cache, and Intel states that terminal faults can occur while reading EPT entries as well.  `[SDM 3C §31.3.2]` `[352]` `[361]` `C:high` `V:durable`

- **Claim.** **PTE inversion** is the OS-side mitigation and it is purely a software convention about non-present entries: an OS constructs a mitigated entry by making it refer to a physical address that is below MAXPHYADDR but above the highest cacheable memory, so the speculative L1D lookup can never hit real data. Linux states the rule as "the kernel ensures that the address bits of PTEs, which are not marked present, never point to cacheable physical memory space."  `[SDM 3C §31.3.2]` `[352]` `[361]` `C:high` `V:durable`

- **Claim.** The VMM-side mitigation is an L1D flush before each guest entry: "Setting bit 0 of IA32_FLUSH_CMD MSR to 1 removes all content, including secrets, from the L1D. This flush must be repeated on every guest entry."  `[SDM 4 §2.1]` `[5]` `[352]` `C:high` `V:durable`

- **Claim.** A nested VMM that finds IA32_FLUSH_CMD enumerated should check IA32_ARCH_CAPABILITIES bit 3 (SKIP_L1DFL_VMENTRY), which indicates that it is not required to flush L1D on VM entry — the single most important nested-mitigation interaction in this chapter; see `14-nested-virtualization.md`.  `[SDM 4 §2.1]` `[5]` `[352]` `C:high` `V:durable`

- **Claim.** Linux exposes the policy as `kvm-intel.vmentry_l1d_flush` with three values: `always` (flush on every VM entry), `cond` (flush only when the code between VM exit and VM entry can leak host memory) and `never` (mitigation disabled); the default is conditional.  `[SDM 4 §2.1]` `[361]` `C:high` `V:durable`

- **Claim.** Flushing does not address a sibling thread executing concurrently: hyperthreads share the L1D, so with SMT enabled an attacker VM can sample data the flush was meant to protect, and the residual options are disabling SMT or scheduling only mutually trusting work on sibling threads (core scheduling).  `[SDM 3C §31.3.3.2]` `[352]` `[361]` `[367]` `C:high` `V:durable`

- **Claim.** Intel's own wording is worth keeping exactly, because it is frequently mis-stated: "Disabling hyperthreading does not in itself provide mitigation for L1TF."  `[SDM 3C §31.3.3.2]` `[352]` `C:high` `V:durable`

- **Claim.** The capacity cost of the SMT option is the reason it stayed controversial: Red Hat states that disabling HT has the perceived effect of 50% fewer vCPUs for scheduling purposes, with a corresponding platform capacity impact.  `[SDM 3C §31.3.3.2]` `[376]` `C:medium` `V:durable`

### 15.5.2 MDS, and the ZombieLoad naming correction

- **Claim.** MDS is four distinct defects with four CVEs: CVE-2018-12126 is MSBDS (Microarchitectural Store Buffer Data Sampling), CVE-2018-12127 is MLPDS (Microarchitectural Load Port Data Sampling), CVE-2018-12130 is MFBDS (Microarchitectural Fill Buffer Data Sampling) and CVE-2019-11091 is MDSUM (Microarchitectural Data Sampling Uncacheable Memory).  `[SDM 3C §28.1.2]` `[354]` `[362]` `[370]` `[23]` `C:high` `V:durable`

- **Claim.** **Correction.** ZombieLoad is the researchers' name for the fill-buffer variant, which Intel and the Linux kernel both identify as **CVE-2018-12130 (MFBDS)**.  `[SDM 3C §28.1.2]` `[354]` `[362]` `[369]` `C:high` `V:durable`

- **Claim.** The identifier CVE-2019-11091 belongs to MDSUM (Microarchitectural Data Sampling Uncacheable Memory), a separate variant reached through uncacheable memory; attributing that identifier to the fill-buffer attack is the error recorded in this skill's errata.  `[SDM 3C §28.1.2]` `[354]` `[362]` `C:high` `V:durable`

- **Claim.** The mitigation is a buffer overwrite performed by VERW on processors enumerating MD_CLEAR at CPUID.(EAX=7H,ECX=0):EDX[10]: on parts affected by MSBDS it overwrites the store buffer for the current logical processor, on parts affected by MFBDS it overwrites the fill buffers for all logical processors on the physical core, and on parts affected by MLPDS it overwrites the load-port writeback buses.  `[SDM 4 §2.1]` `[354]` `[362]` `C:high` `V:durable`

- **Claim.** For a VMM the placement matters as much as the instruction: the buffer-clearing sequence must run on the last instruction path before entering the guest and after handling host secrets, which is why the kernel treats "clear CPU buffers" as a VM-entry-adjacent operation rather than a boot-time switch.  `[SDM 3C §28.1.2]` `[362]` `C:medium` `V:durable`

- **Claim.** MDS_NO (IA32_ARCH_CAPABILITIES bit 5) retires the whole family for a given part, and its virtualized value therefore determines whether a guest kernel arms its own VERW sequences.  `[SDM 4 §2.1]` `[5]` `[362]` `C:high` `V:durable`

### 15.5.3 TAA

- **Claim.** TSX Asynchronous Abort is CVE-2019-11135: an asynchronous abort inside a TSX transaction re-exposes the same internal buffers as MDS, so an MDS-resistant part can still leak if it implements TSX.  `[SDM 3C §28.1.2]` `[363]` `[23]` `C:high` `V:durable`

- **Claim.** Two mitigations exist and they are alternatives: clear the buffers with the VERW sequence, or remove the trigger by disabling TSX through IA32_TSX_CTRL at 122H — RTM_DISABLE (bit 0) makes XBEGIN always abort, TSX_CPUID_CLEAR (bit 1) hides RTM and HLE from CPUID.  `[SDM 4 §2.1]` `[5]` `[363]` `C:high` `V:durable`

- **Claim.** TAA_NO is IA32_ARCH_CAPABILITIES bit 8; the presence of IA32_TSX_CTRL itself is reported by bit 7 of the same MSR.  `[SDM 4 §2.1]` `[5]` `[363]` `C:high` `V:durable`

### 15.5.4 SRBDS

- **Claim.** SRBDS is CVE-2020-0543: RDRAND, RDSEED and SGX EGETKEY move data through a special register mechanism whose staging buffer is shared, and the values can be sampled by MDS-style methods — including across cores, which the earlier families could not do.  `[SDM 3C §28.1.2]` `[364]` `[23]` `C:high` `V:durable`

- **Claim.** The mitigation is entirely in microcode: the affected instructions are modified to overwrite the secret data in the shared staging buffer before another logical processor can read it, at a measurable cost to RDRAND/RDSEED throughput.  `[SDM 4 §2.1]` `[364]` `C:high` `V:durable`

- **Claim.** The opt-out is IA32_MCU_OPT_CTRL[0] (RNGDS_MITG_DIS): setting it to 1 disables the mitigation for RDRAND and RDSEED executed outside an SGX enclave on that logical processor; support is enumerated by CPUID.(EAX=07H,ECX=0).EDX[9] (SRBDS_CTRL). A VMM should not expose this control to untrusted guests.  `[SDM 4 §2.1]` `[5]` `[364]` `C:high` `V:durable`

### 15.5.5 Spectre v2, BHI, and the hypervisor's standing duty

- **Claim.** Spectre v2 (branch target injection) is CVE-2017-5715; the mitigation toolkit is IBRS (IA32_SPEC_CTRL bit 0), STIBP (bit 1), IBPB (IA32_PRED_CMD bit 0), enhanced IBRS advertised by IA32_ARCH_CAPABILITIES bit 1, and the software retpoline construction.  `[SDM 4 §2.1]` `[5]` `[350]` `[359]` `[366]` `C:high` `V:durable`

- **Claim.** For virtualization the standing duty is at the VM-exit boundary: the kernel uses retpoline or enhanced IBRS to prevent consumption of poisoned branch-target-buffer entries left by rogue guests, flushes the return stack buffer on every VM exit to prevent an RSB underflow, and sanitizes the BTB before switching to a different guest.  `[SDM 3C §28.1.2]` `[366]` `C:high` `V:durable`

- **Claim.** Branch History Injection extended the problem past eIBRS by poisoning branch history rather than branch targets; the architectural controls added for it are BHI_DIS_S (IA32_SPEC_CTRL bit 10) and the BHI_NO indication (IA32_ARCH_CAPABILITIES bit 20).  `[SDM 4 §2.1]` `[5]` `[358]` `C:high` `V:durable`

- **Claim.** RRSBA behaviour — a RET using alternate predictors — is itself enumerated (IA32_ARCH_CAPABILITIES bit 19) and can be suppressed per privilege level with RRSBA_DIS_U (IA32_SPEC_CTRL bit 5) and RRSBA_DIS_S (bit 6).  `[SDM 4 §2.1]` `[5]` `[357]` `C:high` `V:durable`

### 15.5.6 Retbleed

- **Claim.** Retbleed is CVE-2022-29901 on Intel and CVE-2022-29900 on AMD; Intel's advisory INTEL-SA-00702 covers the return-stack-buffer-underflow condition together with CVE-2022-28693.  `[SDM 3C §28.1.2]` `[357]` `[371]` `[23]` `C:high` `V:durable`

- **Claim.** The mechanism inverted a design assumption: retpoline converts indirect branches into returns, but when the RSB is empty a RET may speculate using the indirect branch predictor, so the mitigation itself became the attack surface. The RSB empties when call stacks deeper than the minimum RSB depth of 16 unwind.  `[SDM 3C §28.1.2]` `[357]` `[371]` `C:medium` `V:durable`

- **Claim.** The mitigations are RSB stuffing before at-risk returns, or setting IBRS, or suppressing the alternate behaviour with RRSBA_DIS_S; on Linux the stuffing variant is selected with `spectre_v2=retpoline retbleed=stuff`.  `[SDM 4 §2.1]` `[357]` `[366]` `C:medium` `V:durable`

### 15.5.7 Downfall / Gather Data Sampling

- **Claim.** Downfall is Intel's Gather Data Sampling, CVE-2022-40982, advisory INTEL-SA-00828: a transiently executed gather instruction that faults may forward stale data from architectural or internal vector registers into the destination vector register, crossing user-kernel, process and VM boundaries.  `[SDM 3C §28.1.2]` `[355]` `[356]` `[365]` `[372]` `[23]` `C:high` `V:durable`

- **Claim.** The mitigation is microcode-resident and enabled by default; software can only weaken it, through IA32_MCU_OPT_CTRL bit 4 (GDS_MITG_DIS), and firmware or the OS can make that impossible by setting bit 5 (GDS_MITG_LOCK), which cannot be cleared once set.  `[SDM 4 §2.1]` `[5]` `[365]` `C:high` `V:durable`

- **Claim.** The virtualization-specific rule is explicit in the kernel documentation: VMMs must ensure that guests are not allowed to disable the GDS mitigation, because a guest that could toggle it would be able to mount the attack and then restore the setting.  `[SDM 4 §2.1]` `[365]` `C:high` `V:durable`

### 15.5.8 Where these mitigations are paid for

The mitigation surface is not free, and almost all of its cost lands on the virtualization transitions rather than on steady-state execution.

- **Claim.** Three of the mitigations are per-transition work: an L1D flush written to IA32_FLUSH_CMD before each guest entry, a VERW buffer-clearing sequence on the paths that re-enter a less privileged domain, and RSB filling on VM exit — all of them scale with exit rate, which is why exit-reduction features and mitigation cost interact.  `[SDM 4 §2.1]` `[352]` `[362]` `[366]` `C:high` `V:durable`

- **Claim.** One is per-context-switch work: IBPB issued when switching between guests, or between a guest and host code that must not inherit its predictor state.  `[SDM 4 §2.1]` `[5]` `[366]` `C:high` `V:durable`

- **Claim.** One is structural: restricting which workloads may share a physical core, whether by disabling SMT outright or by core scheduling, which changes capacity planning rather than per-operation latency.  `[SDM 3C §28.1.2]` `[367]` `[376]` `C:high` `V:durable`

- **Claim.** The conditional variants exist precisely because the unconditional ones are expensive: `cond` L1D flushing skips the flush when the code between VM exit and VM entry cannot have touched host secrets, and SKIP_L1DFL_VMENTRY lets a nested VMM skip it entirely when the platform says it is unnecessary.  `[SDM 4 §2.1]` `[352]` `[361]` `C:high` `V:durable`

---

## 15.6 Hypervisor rootkits: a short history, in proportion

This is the oldest VT security story and the least operationally important one today; it earns a section because it establishes that the risk of a privileged layer beneath the OS is *architectural*, not a defect.

- **Claim.** SubVirt (IEEE S&P 2006) introduced the virtual-machine-based rootkit: malware that installs a virtual-machine monitor underneath an existing operating system and hoists that OS into a virtual machine, so that its state cannot be reached by software running in the target system.  `[SDM 3C §26.2]` `[373]` `C:high` `V:durable`

- **Claim.** Blue Pill (Black Hat 2006) and Vitriol (same event, targeting Mac OS X with VT-x) implemented the idea on hardware virtualization: a thin hypervisor started on a running system, migrating the live OS into a VM beneath it; Vitriol was reported as under 2000 lines of code.  `[SDM 3C §26.7]` `[374]` `C:medium` `V:durable`

- **Claim.** The decisive property is that these techniques exploit no defect at all — they use documented VMX functionality exactly as specified, which is why no patch addresses them and why the countermeasure had to be a measured launch (§15.11) rather than a fix.  `[SDM 3C §26.7]` `[373]` `[374]` `C:high` `V:durable`

- **Claim.** Detection has always been possible in practice through timing and enumeration side effects — instructions that exit unconditionally take dramatically longer under a hypervisor — but a hypervisor can also distort the guest's view of time, so timing-only detection is an arms race rather than a proof.  `[SDM 3C §28.1.2]` `[374]` `C:medium` `V:durable`

- **Claim.** The modern inversion of the same idea is defensive and shipped by default on Windows: a hypervisor that is deliberately resident beneath the OS in order to protect it, which is the subject of the rest of this chapter.  `[SDM 3C §26.2]` `[378]` `C:high` `V:durable`

---

## 15.7 VBS: what the Windows hypervisor actually enforces

- **Claim.** Virtualization-based security uses the Windows hypervisor and second-level address translation — EPT on Intel parts — to create an isolated environment that becomes a root of trust for the OS, built on the assumption that the normal kernel can be compromised.  `[SDM 3C §31.3]` `[1]` `[378]` `C:high` `V:durable`

- **Claim.** The isolation primitive is the Virtual Trust Level (VTL): normal Windows, kernel mode included, runs in VTL0, while the secure kernel and Isolated User Mode run in VTL1, and VTLs are hierarchical, so VTL1 is strictly more privileged than VTL0.  `[SDM 3C §31.3]` `[380]` `C:high` `V:durable`

- **Claim.** The boundary is enforced by memory access permissions the hypervisor assigns with SLAT, which software inside the partition — including the VTL0 kernel — cannot change; this is the same EPT permission machinery described in `06-address-translation.md`, applied to trust levels rather than to virtual machines.  `[SDM 3C §31.3.2]` `[1]` `[380]` `C:high` `V:durable`

- **Claim.** Isolated User Mode processes ("trustlets") run at VTL1 in user mode and complete system calls by marshalling them to the Windows kernel running in VTL0 ring 0, which is how a trustlet can be both protected from and dependent on the normal OS.  `[SDM 3C §31.3]` `[381]` `C:high` `V:durable`

- **Claim.** Because VBS requires the hypervisor to be running, a VBS-enabled Windows PC is permanently in the configuration described in `14-nested-virtualization.md` §14.12: the Windows kernel is a guest, and any other VMM on the machine is nested.  `[SDM 3C §28.1.2]` `[315]` `[378]` `C:high` `V:durable`

- **Claim.** The platform requirements follow from the mechanism rather than from policy: VBS needs a processor with virtualization extensions and second-level address translation — VT-x with EPT on Intel — enabled in firmware, and the protections layered on top of it assume Secure Boot and a TPM for measurement.  `[SDM 3C §26.7]` `[SDM 3C §31.3]` `[378]` `[388]` `C:medium` `V:durable`

- **Claim.** Microsoft implements up to 16 trust levels architecturally but ships two in practice, VTL0 and VTL1, so "the secure world" on Windows today means exactly one additional level, not an arbitrary hierarchy.  `[SDM 3C §31.3]` `[380]` `C:medium` `V:durable`

- **Claim.** The same VTL1 isolation is offered to application code as VBS enclaves: a user-mode enclave whose memory the normal OS cannot read, built on the hypervisor's SLAT enforcement rather than on a separate enclave instruction set.  `[SDM 3C §31.3]` `[395]` `C:medium` `V:durable`

---

## 15.8 HVCI: W^X for kernel code, enforced one level down

- **Claim.** Memory integrity — also called hypervisor-protected code integrity (HVCI) — runs kernel-mode code integrity inside the VBS isolated environment rather than in the kernel it is policing.  `[SDM 3C §31.3]` `[378]` `[379]` `[382]` `C:high` `V:durable`

- **Claim.** The enforced invariant is W^X for kernel memory: kernel memory pages are only made executable after passing code-integrity checks inside the secure environment, and executable pages themselves are never writable.  `[SDM 3C §31.3.2]` `[378]` `[382]` `C:high` `V:durable`

- **Claim.** The consequence for exploitation is direct: even where a memory-safety defect lets an attacker modify memory, executable code pages cannot be modified and modified memory cannot be made executable, so the classic "write shellcode into kernel memory and jump to it" step fails.  `[SDM 3C §31.3.2]` `[378]` `C:high` `V:durable`

- **Claim.** The mechanism is EPT permissions: the code page's executable permission lives in the EPT entry the hypervisor controls, not in the VTL0 page tables the compromised kernel controls, which is why a VTL0 kernel cannot grant itself execute rights; see `06-address-translation.md` for the entry format.  `[SDM 3C §31.3.2]` `[1]` `[380]` `C:high` `V:durable`

- **Claim.** A driver fails under HVCI when it violates the invariant rather than when it is merely old: drivers that allocate memory that is simultaneously writable and executable, generate or patch code at runtime, or otherwise mix data and code in one section are incompatible, and Microsoft's guidance is to keep a clear separation of data and code and never modify code pages directly.  `[SDM 3C §31.3.2]` `[382]` `[383]` `C:high` `V:durable`

- **Claim.** Unsigned or improperly signed kernel code fails for the second reason: the integrity check that authorises the transition to executable happens in the secure environment, so a signature the VTL0 kernel would have accepted is irrelevant.  `[SDM 3C §31.3]` `[378]` `[382]` `C:high` `V:durable`

- **Claim.** Mode-based execute control for EPT (MBEC) is the hardware feature that makes this affordable: it splits EPT execute permission into user-mode and supervisor-mode execute, so the hypervisor can allow user code to execute a page while denying kernel execution of it without a second set of structures. Microsoft names Intel's MBEC, AMD's GMET and ARM's TTS2UXN as the features designed to reduce HVCI's performance and power impact.  `[SDM 3C §31.3.2]` `[1]` `[388]` `C:high` `V:durable`

---

## 15.9 Credential Guard: a VBS consumer

- **Claim.** Credential Guard protects NTLM password hashes, Kerberos Ticket Granting Tickets and credentials stored by applications as domain credentials, by isolating them with VBS so that only privileged system software can reach them.  `[SDM 3C §31.3]` `[384]` `C:high` `V:durable`

- **Claim.** The implementation is a trustlet: the normal LSA process talks to an isolated LSA process, LSAIso.exe, which stores the secrets; the data it holds is protected by VBS and is not accessible to the rest of the operating system.  `[SDM 3C §31.3]` `[381]` `[384]` `C:high` `V:durable`

- **Claim.** The isolated LSA process hosts no device drivers and only a small subset of OS binaries, which is the attack-surface argument for putting it in VTL1 at all.  `[SDM 3C §31.3]` `[384]` `C:high` `V:durable`

- **Claim.** The protection is scoped: the Kerberos TGT is protected, service tickets are not, so Credential Guard raises the cost of credential theft rather than eliminating the class.  `[SDM 3C §31.3]` `[384]` `C:medium` `V:durable`

---

## 15.10 Kernel DMA Protection and the pre-boot gap

- **Claim.** DMA-capable peripherals bypass CPU paging entirely, so neither VMX nor VBS constrains them; the remapping hardware described in `12-vtd-faults-bios-siov.md` is the only mechanism that does.  `[VT-d 5.20 Ch.3]` `[8]` `[392]` `C:high` `V:durable`

- **Claim.** Kernel DMA Protection uses the system's IOMMU together with driver-based DMA remapping to prevent external PCIe devices — Thunderbolt, USB4, CFexpress — from reaching system memory, and it requires the platform's virtualization-for-directed-I/O support (VT-d on Intel) to be enabled in firmware.  `[VT-d 5.20 Ch.3]` `[8]` `[385]` `[386]` `C:high` `V:durable`

- **Claim.** **The pre-boot gap is documented, not theoretical:** Kernel DMA Protection only protects against drive-by DMA attacks after the OS is loaded, and it is the responsibility of the system firmware to protect against attacks through those ports during boot.  `[VT-d 5.20 Ch.8]` `[385]` `C:high` `V:durable`

- **Claim.** Individual drivers opt into stricter treatment by declaring DMA remapping support, which lets the OS keep a device's DMA confined to buffers it has explicitly mapped instead of relying on a coarse allow/deny at attach time.  `[VT-d 5.20 Ch.3]` `[387]` `C:medium` `V:durable`

- **Claim.** Enabling the IOMMU is necessary but not sufficient: Thunderclap (NDSS 2019) demonstrated that a peripheral which follows the expected protocols can still exploit edge cases in how operating systems configure and share mapped memory, achieving arbitrary code execution with IOMMU protection turned on.  `[VT-d 5.20 Ch.3]` `[392]` `C:high` `V:durable`

### 15.10.1 Passing a device to a VM is a DMA decision

- **Claim.** Assigning a physical device to a guest hands that device's DMA engine to guest-controlled software, so without DMA remapping the guest can direct the device to read or write any host memory and EPT is irrelevant to it; remapping is what makes the assignment containable at all — see `12-vtd-faults-bios-siov.md`.  `[VT-d 5.20 Ch.3]` `[8]` `C:high` `V:durable`

- **Claim.** The containment is only as good as the domain the device is placed in: a device sharing a remapping domain with another device, or mapped more permissively than it needs, extends its reach accordingly, which is why per-device domains and minimal mappings are the baseline rather than an optimisation.  `[VT-d 5.20 Ch.3]` `[VT-d 5.20 Ch.6]` `[8]` `C:medium` `V:durable`

- **Claim.** Interrupts need the same treatment as memory: without interrupt remapping an assigned device can generate interrupt messages that target the host, so interrupt remapping is part of the assignment boundary and not a separate performance feature; see `11-vtd-interrupt-remapping.md`.  `[VT-d 5.20 Ch.5]` `[8]` `C:high` `V:durable`

- **Claim.** These requirements are the reason a machine that exposes device assignment must also expose the fault-reporting machinery: a remapping fault is the only signal that an assigned device attempted something outside its domain; see `12-vtd-faults-bios-siov.md`.  `[VT-d 5.20 Ch.7]` `[8]` `C:medium` `V:durable`

---

## 15.11 Measured boot, DRTM, Intel TXT and System Guard

- **Claim.** Intel TXT provides a dynamic root of trust for measurement: GETSEC[SENTER] establishes a measured launch environment after boot, and the processor will only initialize state or execute an authenticated code module after validating the digital signature in the module header — the SINIT ACM then sets up the initial MLE state and measures it.  `[SDM 3C §26.7]` `[360]` `C:high` `V:durable`

- **Claim.** The security argument against hypervisor rootkits is exactly this: a rootkit that inserted itself before or during boot changes the measurements, and the dynamic launch re-establishes a root of trust that does not depend on the firmware that ran earlier.  `[SDM 3C §26.7]` `[360]` `[373]` `C:medium` `V:durable`

- **Claim.** On Windows this appears as System Guard Secure Launch: a DRTM-based launch that verifies the integrity of the startup environment so that VBS itself starts from a measured state rather than trusting firmware.  `[SDM 3C §26.7]` `[388]` `C:medium` `V:durable`

- **Claim.** The relationship between the three layers is worth stating plainly: Secure Boot constrains what may load, DRTM measures what actually did load after the fact, and VBS then protects the running system — none of the three substitutes for another.  `[SDM 3C §26.7]` `[360]` `[388]` `C:medium` `V:durable`

### 15.11.1 What measured launch does not cover

- **Claim.** Measurement is a statement about what was loaded, not about what that code then does: a measured component with a defect measures exactly the same as a correct one, so DRTM bounds the *provenance* of the trusted computing base and nothing else.  `[SDM 3C §26.7]` `[360]` `C:medium` `V:durable`

- **Claim.** System-management mode remains a distinct problem: SMM code runs at a privilege the hypervisor does not control, which is why Windows pairs Secure Launch with explicit SMM protection rather than treating the measured launch as sufficient; see `09-smm-seam.md` for the SMM/VMX interaction.  `[SDM 3C Ch.34]` `[388]` `C:medium` `V:durable`

- **Claim.** Measured launch also says nothing about the microarchitectural defects of §15.5: a correctly measured, correctly signed hypervisor on an unpatched part is precisely the configuration L1TF and MDS target.  `[SDM 3C §26.7]` `[352]` `[354]` `C:medium` `V:durable`

---

## 15.12 The VBS overhead figures conflict — presented, not averaged

Three different numbers circulate for "the cost of VBS", and the older version of this skill quoted all three in different files as though they were the same measurement. They are not: they differ in what was enabled, what was measured and on what hardware. They are reproduced here side by side with their conditions.

| Figure | What was measured | Conditions | Source class |
|---|---|---|---|
| ~6% average frame-rate loss | memory integrity (HVCI) on vs off | third-party game benchmarks, reported second-hand | T3 media |
| 4.9% / 5.7% geometric mean, individual titles worse | VBS on vs off | five game titles, two of them in two APIs, Core i7-11700K and Core i7-10700K | T3 media benchmark |
| "up to 10%", elsewhere "as much as 15%" | default VBS setting | game benchmarks including a high-end GPU configuration | T3 media benchmark |

- **Claim.** **Conflicting figures, no resolution (`C:low`).** Published VBS/HVCI overhead figures for interactive workloads range from about 5% to about 25% depending on the title, the CPU generation, whether MBEC is available and whether HVCI is enabled in addition to VBS; one widely repeated measurement reports a ~6% average frame-rate reduction with memory integrity enabled; a benchmark suite of five titles reports geometric means of 4.9% and 5.7% on two different processors; and later testing of the default VBS setting reports losses of up to 10% on a high-end GPU configuration and as much as 15% in the worst titles. These figures are recorded with their conditions and are not averaged into a single number.  `[SDM 3C §31.3.2]` `[389]` `[390]` `[391]` `C:low` `V:durable`

- **Claim.** The mechanism behind the spread is identifiable even when the numbers are not: HVCI costs more than VBS alone, and MBEC availability reduces HVCI's marginal cost to roughly that of VBS alone, so any figure quoted without stating MBEC availability and whether HVCI was on is uninterpretable.  `[SDM 3C §31.3.2]` `[1]` `[388]` `[389]` `C:medium` `V:durable`

- **Claim.** A second, non-performance cost belongs in the same discussion: with the hypervisor resident, third-party virtualization applications must go through the platform API rather than driving VT-x directly, which changes their performance characteristics independently of any frame-rate measurement; see `14-nested-virtualization.md`.  `[SDM 3C §28.1.2]` `[314]` `[315]` `C:high` `V:durable`

---

## 15.13 Reading the chapter as one picture

The two halves of this chapter are the same mechanism pointed in opposite directions.

- **Claim.** The attacks in §15.5 succeed because VMX partitions architectural state but not microarchitectural state; the defences in §15.7–§15.9 succeed because VMX partitions architectural state *better than rings do*, so moving a security decision below the kernel puts it out of the kernel's reach.  `[SDM 3C §31.3.2]` `[1]` `[378]` `C:medium` `V:durable`

- **Claim.** Both halves therefore share a dependency: they assume the hypervisor and the microcode are correct and current. That is the residual trusted computing base of a VBS-enabled machine, and shrinking it further is what the confidential-computing work in `13-tdx.md` is for.  `[SDM 3C §26.2]` `[1]` `[378]` `C:medium` `V:durable`

---

## 15.14 Out of scope for this chapter

- Competition bounty tables, disclosure timelines and vendor patch dates: `90-dated-landscape.md`.
- Which Windows releases enable VBS or memory integrity by default, and on which devices, and the rollout schedule for existing installations: `90-dated-landscape.md`.
- Anti-cheat products' use and detection of virtualization: `90-dated-landscape.md`.
- Cloud-provider mitigation posture and instance-level guidance: `90-dated-landscape.md`.
- VT-d fault reporting, DMA-remapping structures and pre-boot firmware behaviour in detail: `12-vtd-faults-bios-siov.md`.
- EPT paging-structure entry formats and MBEC bit layout: `06-address-translation.md`.
- TDX, Secure EPT and removing the host from the TCB: `13-tdx.md`.
