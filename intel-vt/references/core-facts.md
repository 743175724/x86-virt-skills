# Core Facts — Sourced Index

> **中文速览**：本文件是**路由索引**，不是章节的替代品。每章只列 2–4 条最高价值的事实，每条都带 bibliography 引用 `[N]` 和拥有该事实的章节文件指针。读它是为了决定**该去哪一章**，不是为了在这里得到完整答案。测量数字一律不在此复述（缺少测量条件的数字是错误的数字），请直接去 `16-performance.md`。会过期的事实一律不在此出现，请去 `90-dated-landscape.md`。已知讹传请先查 `errata.md`。

**Rules this file obeys.** Every bullet carries a `[N]` citation and names the chapter that owns the fact. Nothing here is a bare assertion. No measurement figure is restated without its conditions — those live in chapter 16. No dated fact appears here — those live in chapter 90. Where a claim is commonly mis-stated, the bullet points at the `errata.md` entry.

**Anchor and document baseline.** SDM revision 092 (June 2026); VMX chapters are Vol.3C Ch.26–35, with Vol.3D App.A/B/C. VT-d is Rev 5.20, April 2026, order D51397-019. See `errata.md` E20 and E21 before citing any older chapter number or the intel.com VT-d landing page.

---

## 00 · Quick reference → `00-quickref.md`

- **Claim.** VMCS field encodings are defined in Vol.3D App.B, grouped by width (16-bit, 64-bit, 32-bit, natural-width) and by class (control, read-only, guest, host).  → `02-vmcs.md` §2.5.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** The basic VM-exit reason codes are enumerated in Vol.3D App.C, and the VMX capability reporting facility (the `IA32_VMX_*` MSRs) in Vol.3D App.A.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`

## 01 · VMX introduction → `01-vmx-intro.md`

- **Claim.** VMX defines two new operating modes, VMX root operation and VMX non-root operation, orthogonal to the ring model, so a guest kernel runs natively at non-root ring 0 without modification.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Entering VMX operation requires CR0 and CR4 to satisfy the `IA32_VMX_CR0_FIXED0/1` and `IA32_VMX_CR4_FIXED0/1` MSRs, `CR4.VMXE = 1`, and a 4-KByte-aligned VMXON region stamped with the revision identifier from `IA32_VMX_BASIC`.  `[SDM 3C Ch.26]` `[1][5]` `C:high` `V:durable`

## 02 · VMCS → `02-vmcs.md`

- **Claim.** The VMCS is divided into guest-state area, host-state area, VM-execution controls, VM-exit controls, VM-entry controls and the read-only VM-exit information fields.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** VMCS fields are architecturally accessible only through VMREAD and VMWRITE by 32-bit encoding; the in-memory layout is deliberately not defined, which is the central design difference from AMD's VMCB.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** VM-function controls live at §27.6.14 and the VMCS-shadowing bitmaps at §27.6.15; these two are the hardware basis for VMFUNC/EPTP switching and for cheap nested VMCS access respectively. On VMFUNC's generation see `errata.md` E06.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`

## 03 · Non-root operation → `03-nonroot-operation.md`

- **Claim.** The only behavioural difference of VMX non-root operation is configurable trapping: instruction and event behaviour is unchanged except where a VM-execution control, the exception bitmap, an I/O bitmap or the MSR bitmap directs a VM exit.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** The interception surface is built from the exception bitmap with its page-fault error-code mask/match pair, I/O bitmaps A and B, the 4-KByte MSR bitmap regions, the CR0/CR4 guest/host masks and read shadows, and the CR3-target list.  `[SDM 3C §27.6.3]` `[1]` `C:high` `V:durable`

## 04 · VM entry → `04-vm-entry.md`

- **Claim.** VM entry performs checks in a fixed order, and failures split into two classes with different recovery paths: failures of the control and host-state checks resume at the instruction after VMLAUNCH/VMRESUME, whereas guest-state check failures take a VM exit with bit 31 of the exit reason set.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH requires the current VMCS to be in the clear state and VMRESUME requires the launched state; VMCLEAR is mandatory before migrating a VMCS between logical processors.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

## 05 · VM exit → `05-vm-exit.md`

- **Claim.** Exit reason and exit qualification are defined in §27.9.1 and populated according to §30.2.1; exit qualification is not a bookmark-level heading in the SDM, so cite those two section numbers rather than a title.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** In the EPT-violation exit qualification, bit 7 indicates that the **guest-linear-address** field is valid, and bit 6 is the AND of the **user-mode execute** permission, meaningful only when mode-based execute control is enabled. Both are widely mis-stated — see `errata.md` E16 and E17.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** VM-exit information recording, the guest-state save, the MSR store, the host-state load and the MSR load happen in the order given in Ch.30; general-purpose registers are not saved by hardware and are the VMM's responsibility.  `[SDM 3C Ch.30]` `[1]` `C:high` `V:durable`

## 06 · Address translation → `06-address-translation.md`

- **Claim.** The EPT pointer is a VM-execution control field (§27.6.11) whose low bits encode memory type, walk length minus one, and accessed/dirty enable; VPID is a separate 16-bit control field (§27.6.12) with INVEPT and INVVPID as its invalidation instructions.  → `06-address-translation.md` §6.2, encodings in `02-vmcs.md` §2.5.  `[SDM 3C §27.6.11]` `[1]` `C:high` `V:durable`
- **Claim.** Page-modification logging (§27.6.18), sub-page write permissions (§27.6.21) and HLAT (§27.6.22, with the translation behaviour in §31.2) are the three later additions layered on top of EPT. PML dates from Broadwell Xeon, not Skylake — `errata.md` E02.  `[SDM 3C §31.2]` `[1]` `C:high` `V:durable`
- **Claim.** A TLB miss under two-dimensional paging costs up to 24 memory references against 4 for a native walk; the widely quoted "20" omits the guest page-table entry reads (`errata.md` E03). The performance consequences, with conditions, belong to chapter 16.  `[605][606]` `C:high` `V:durable`
- **Claim.** Intel tags translations with two distinct identifiers — PCID for process context and VPID for VM context — so "Intel has no ASID mechanism" is wrong (`errata.md` E19).  `[SDM 3C §27.6.12]` `[1][3]` `C:high` `V:durable`

## 07 · APIC virtualization → `07-apic-virtualization.md`

- **Claim.** APIC virtualization is controlled from §27.6.8, with APIC-timer virtualization added later at §27.6.27; the three capabilities normally grouped as APICv are APIC-register virtualization, virtual-interrupt delivery and posted-interrupt processing.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** APIC virtualization and virtual interrupts are specified in Vol.3C Ch.32, which is the owning reference for the virtual-APIC page and the posted-interrupt descriptor.  → `07-apic-virtualization.md`.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** The posted-interrupt descriptor and the posted-interrupt notification vector are VM-execution control fields (encodings 2016H and 0002H), and `07-apic-virtualization.md` owns the descriptor's layout and the notification path; the VT-d side of the same mechanism is in `11-vtd-interrupt-remapping.md`.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`

## 08 · VMX instructions → `08-vmx-instructions.md`

- **Claim.** The VMX instruction set is specified in Vol.3C Ch.33; the VM-instruction error field that reports its failures is defined at §27.9.5, and the capability MSRs that gate the instructions are in Vol.3D App.A.  → `08-vmx-instructions.md` §8.4, §8.6.  `[SDM 3C Ch.33]` `[1][2]` `C:high` `V:durable`
- **Claim.** VMX instructions report failure in two distinct ways — VMfailInvalid via CF when there is no current VMCS, VMfailValid via ZF with an error number written to the VM-instruction error field — and a VMM must distinguish them.  → `08-vmx-instructions.md` §8.1, §8.4.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

## 09 · SMM and SEAM → `09-smm-seam.md`

- **Claim.** SMM interaction with VMX, including the dual-monitor treatment, is specified in Vol.3C Ch.34; Secure Arbitration Mode (SEAM) is Ch.35, and the SEAM non-root VM-execution control is §27.6.26.  `[SDM 3C Ch.34]` `[1]` `C:high` `V:durable`
- **Claim.** SEAM is the CPU mode that hosts the TDX Module; it is specified in the SDM, while the module that runs inside it is specified by the separate TDX document set.  `[SDM 3C Ch.35]` `[1][11]` `C:high` `V:durable`

## 10 · VT-d DMA remapping → `10-vtd-dma-remapping.md`

- **Claim.** DMA remapping, device-TLB support, translation caching, translation structure formats and the register interface are VT-d Rev 5.20 chapters 3, 4, 6, 9 and 11 respectively.  `[VT-d 5.20 Ch.3]` `[8]` `C:high` `V:durable`
- **Claim.** The current VT-d specification is Rev 5.20, April 2026, order D51397-019; the intel.com landing page metadata is stale and still advertises an older revision (`errata.md` E21).  `[VT-d 5.20 Ch.1]` `[8][620]` `C:high` `V:durable`

## 11 · VT-d interrupt remapping → `11-vtd-interrupt-remapping.md`

- **Claim.** Interrupt remapping, including the interrupt remapping table entry format and interrupt posting, is VT-d Rev 5.20 chapter 5.  `[VT-d 5.20 Ch.5]` `[8]` `C:high` `V:durable`
- **Claim.** The best-documented interrupt-remapping erratum is Intel's own 5520/5500 chipset erratum #53, not an AMD defect (`errata.md` E07).  `[611]` `C:high` `V:durable`

## 12 · VT-d faults, BIOS and SIOV → `12-vtd-faults-bios-siov.md`

- **Claim.** Address-translation faults are VT-d Rev 5.20 chapter 7, BIOS considerations chapter 8, and performance monitoring chapter 10.  `[VT-d 5.20 Ch.7]` `[8]` `C:high` `V:durable`
- **Claim.** Scalable I/O Virtualization is specified separately as order 337679-002 Rev 1.1 (September 2020, per the PDF cover; the widely-cited "Rev 1.0" is wrong) → `12-vtd-faults-bios-siov.md` §12.7; no later revision has been published, so it is stale but current.  `[21]` `C:medium` `V:durable`

## 13 · TDX → `13-tdx.md`

- **Claim.** The normative TDX document set is the Module Base Architecture Specification (348549-008), Module ABI Specification (348551-008), TD CPU Architectural Extensions (343754-003), GHCI v1.5 (348552-004) and the SEAMLDR Interface Specification (343755-004).  `[11][12][14][15][16]` `C:high` `V:durable`
- **Claim.** TDX removes the VMM, host OS, SMM/BIOS and the platform operator from the TCB by combining SEAM, a CPU-measured TDX Module, Secure EPT with the PAMT, and multi-key memory encryption → `13-tdx.md` §13.2, §13.8.  `[11]` `C:high` `V:durable`
- **Claim.** TDX attestation is coupled to SGX rather than replacing it: the TD Quote is signed by the SGX Quoting Enclave and the DCAP/PCK/PCCS infrastructure is shared (`errata.md` E12).  `[626]` `C:high` `V:durable`
- **Claim.** TDX Module version series are bound to platform generations, so a module build is not portable across Xeon generations; which series runs where is a dated fact and lives in chapter 90.  `[575][584]` `C:high` `V:durable`

## 14 · Nested virtualization → `14-nested-virtualization.md`

- **Claim.** The hardware affordances that make nested virtualization tractable on Intel are the VMCS-shadowing bitmaps (§27.6.15), shadow VMCS semantics (§27.10) and EPT (Ch.31) used for multi-dimensional paging.  `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`
- **Claim.** Out of Hypervisor, the main recent academic line on exposing hypervisor-oriented hardware features to guest processes, was published at SC'22, not SOSP'22, and its two versions report different numbers (`errata.md` E04 and O6).  `[607][608]` `C:high` `V:durable`
- **Claim.** Which clouds expose nested virtualization, and since when, is a dated fact — go to chapter 90 rather than quoting a remembered year (`errata.md` E05).  `[551]` `C:high` `V:durable`

## 15 · Security → `15-security.md`

- **Claim.** The major VM-escape CVEs are defects in VMM device-emulation software, not in VT-x hardware; hardware-level exposure in this domain takes the form of microarchitectural side channels instead (`errata.md` E11).  `[615][572]` `C:high` `V:durable`
- **Claim.** The MDS family is covered by INTEL-SA-00233 and comprises MSBDS (CVE-2018-12126), MLPDS (CVE-2018-12127), MFBDS/ZombieLoad (CVE-2018-12130) and MDSUM (CVE-2019-11091) — the ZombieLoad mapping is frequently reported wrongly (`errata.md` E18).  `[616][617]` `C:high` `V:durable`
- **Claim.** Model-specific registers, including the mitigation-control MSRs that a VMM must virtualize or pass through, are enumerated in SDM Vol.4; Intel's advisories are the authoritative index of which erratum maps to which control bit.  `[5][23]` `C:medium` `V:durable`

## 16 · Performance → `16-performance.md`

- **Claim.** Every performance number in this skill is required to carry its measurement conditions. In particular, the bare VMX transition cost and the end-to-end cost including hypervisor handling are different quantities and must never be quoted as one figure (`errata.md` E09).  `[613][614]` `C:high` `V:durable`
- **Claim.** The structural cost that all EPT performance discussion rests on is 24 memory references on a two-dimensional walk against 4 natively; everything else is workload- and page-size-dependent.  `[605][606]` `C:high` `V:durable`
- **Claim.** Vendor overhead figures for cloud virtualization are marketing statements, not measurements, and must be reproduced in attributed voice only (`errata.md` E10).  `[554][566]` `C:high` `V:durable`

## 17 · Software ecosystem → `17-windows-platform.md`

- **Claim.** VMX root operation has exactly one owner per logical processor — the software that executed VMXON — and on a Windows PC with any Hyper-V-backed feature enabled that owner is the Windows hypervisor, with the Windows kernel itself running as a VTL0 guest.  → `17-windows-platform.md` §17.1.  `[SDM 3C Ch.26]` `[1][461]` `C:high` `V:durable`
- **Claim.** A third-party VMM on such a machine is not a hypervisor but a user-mode process whose guest is a Hyper-V partition reached through the Windows Hypervisor Platform, which reports exits as API-level exit contexts rather than as hardware exit reasons.  → `17-windows-platform.md` §17.3.  `[no-spec]` `[465]` `C:high` `V:durable`
- **Claim.** Which Windows build, kernel, QEMU, libvirt, distro or hypervisor release first carried a given feature is a dated fact; chapter 17 owns the durable Windows architecture and chapter 90 owns the version numbers.  `[no-spec]` `[574][577]` `C:high` `V:durable`

## 18 · Cross-vendor comparison → `18-comparison-amd-arm-riscv.md`

- **Claim.** The deepest structural difference is VMCS opacity: Intel's VMCS layout is architecturally undefined and reachable only through VMREAD/VMWRITE, which is why the comparison with AMD's publicly laid-out VMCB is a design-philosophy difference and not a feature gap.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** Interrupt virtualization is the largest Intel/AMD asymmetry in practice: APICv shipped enabled, AVIC did not (`errata.md` E08).  `[612][631]` `C:high` `V:durable`
- **Claim.** Both vendors run two tag namespaces, not one: a guest-managed process tag (PCID on both, CR3[11:0] with CR4.PCIDE) and a hypervisor-managed VM tag (Intel's 16-bit VPID, AMD's 32-bit VMCB ASID); "Intel has no ASID mechanism" and "AMD folds both roles into one ASID" are both wrong (`errata.md` E19).  → `18-comparison-amd-arm-riscv.md` §18.3.2.  `[SDM 3C §27.6.12]` `[1][41][618]` `C:high` `V:durable`
- **Claim.** Market-share framing of the Intel/AMD contest is a dated fact and belongs to chapter 90, not to the architectural comparison.  `[597]` `C:medium` `V:durable`

## 90 · Dated landscape → `90-dated-landscape.md`

- **Claim.** Chapter 90 is the only file in this skill permitted to carry time-limited (dated) claims; its as-of date is 2026-09-16, and every answer drawing on it must say so and require re-verification against the vendor's own source.  `[557]` `C:high` `V:durable`
- **Claim.** Cloud GA/preview status, pricing, market share, kernel merge status and roadmaps are the fastest-decaying and most frequently mis-reported category; the Azure TDX preview-versus-GA case is the worked example (`errata.md` E15).  `[556][557]` `C:high` `V:durable`
- **Claim.** Every cloud-vendor overhead or priority claim recorded in chapter 90 is tagged `[vendor-stated]` and must be reproduced in attributed voice (`errata.md` E10, E13).  `[565][566]` `C:high` `V:durable`
