---
name: intel-vt
description: >
  Intel VT expert knowledge base for Windows PCs.
  Covers Intel VT-x/VMX/VMCS, VM-exit decoding, EPT/VPID, VT-d/IOMMU, APICv and posted
  interrupts, nested virtualization, Hyper-V/VBS/HVCI/WSL2 and who owns VMX root operation
  on Windows, Intel TDX and SEAM, and Intel-versus-AMD/ARM/RISC-V comparison. Every
  architectural claim is anchored to an Intel specification by document number and section.
  Triggers - VT-x, VMX, VMCS, VM-exit, exit qualification, EPT, EPT violation, VPID, INVEPT,
  VT-d, DMAR, IOMMU, IRTE, SR-IOV, APICv, posted interrupt, VMCS shadowing, nested
  virtualization, Hyper-V, VBS, HVCI, WSL2, Kernel DMA Protection, TDX, SEAM, SEAMCALL,
  hypervisor, virtual machine escape. Do NOT use for AMD-primary questions - the sibling
  amd-virtualization skill owns those - or for generic virtualization concepts unrelated
  to Intel hardware.
license: Apache-2.0
metadata:
  target-platform: Windows PC
  normative-baseline: Intel SDM rev 092 (2026-06), VT-d Rev 5.20 (2026-04), TDX module docs (2026-05/08)
  dated-snapshot: 2026-09-16
---

# Intel VT — specification-anchored knowledge base

Target platform: **Windows PC**. The hardware chapters (`01`–`12`) are CPU and
chipset architecture and are OS-independent; the platform, security and
performance chapters are written for Windows.

## How to use this skill

**Read the one chapter your question maps to. Do not load the directory.**
Chapters run 300–550 lines each; the routing table below resolves to a section.

1. **Look up the route** in §Routing. If the question is a symptom rather than a
   topic, use `00-quickref.md` §0.2 instead — it maps failures to chapters.
2. **Read that chapter's section.** Each chapter opens with a Chinese summary, a
   `Maps to:` line naming its Intel specification chapter, and an `Owns:` line.
   If the fact you need is listed under another chapter's `Owns:`, go there —
   cross-chapter restatement is prohibited, so the other chapter is authoritative.
3. **Check `errata.md` before writing anything** that touches a commonly
   circulated claim. It carries 28 entries, 22 settled corrections and 6 recorded
   open conflicts. Where it disagrees with a familiar statement, it wins.
4. **Stop.** One chapter plus `errata.md` answers almost everything. Pull a second
   chapter only when the question genuinely spans two (for example, EPT violation
   handling needs `06` for the structures and `05` for the qualification layout).

`core-facts.md` is a sourced index, not a substitute for the chapters — use it to
find the owning chapter fast, then read that chapter.

## Routing

| Question is about | Read |
|---|---|
| Enabling VMX, VMXON failures, CPUID/IA32_FEATURE_CONTROL, VT-x history | `01-vmx-intro.md` |
| VMCS layout, **field encodings**, execution/exit/entry controls, shadow VMCS fields | `02-vmcs.md` §2.5 |
| What the guest may do, bitmaps, CR masks, MTF, unrestricted guest | `03-nonroot-operation.md` |
| VM-entry checks, **why VM entry failed**, event injection | `04-vm-entry.md` §4.9 |
| **Decoding a VM exit**: exit reasons, exit qualification, IDT-vectoring | `05-vm-exit.md` §5.3 |
| EPT structures, EPT violation vs misconfiguration, VPID, PML, SPP, HLAT, #VE | `06-address-translation.md` |
| APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv | `07-apic-virtualization.md` |
| VMX instruction semantics, **VM-instruction error 1–28**, capability MSRs | `08-vmx-instructions.md` §8.4 |
| SMM under VMX, dual-monitor treatment, SEAM ISA, SEAMRR | `09-smm-seam.md` |
| VT-d DMA remapping, DMAR registers, translation structures, invalidation | `10-vtd-dma-remapping.md` |
| Interrupt remapping, **IRTE**, interrupt posting on the VT-d side | `11-vtd-interrupt-remapping.md` |
| **VT-d faults and fault reason codes**, ACPI DMAR, SIOV, DMA-attack surface | `12-vtd-faults-bios-siov.md` |
| TDX: SEAMCALL/TDCALL leaves, TD lifecycle, Secure EPT, attestation, **TDX CVEs and Intel advisories, TDXRay** | `13-tdx.md` |
| Nested VMX, **VMCS shadowing**, vmcs02, nested EPT, nesting on a PC | `14-nested-virtualization.md` |
| Transient-execution CVEs (L1TF/MDS/TAA/Spectre) and **mitigation MSRs**, VBS, HVCI, Credential Guard, TXT — not TDX advisories, those are `13` | `15-security.md` §15.5 |
| Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT | `16-performance.md` |
| **Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, "why no VT-x"** | `17-windows-platform.md` §17.1 |
| Intel vs AMD SVM/SEV, vs ARM, vs RISC-V; what a client PC actually has | `18-comparison-amd-arm-riscv.md` |
| Cloud/product/market/roadmap status, GA dates, kernel merge versions | `90-dated-landscape.md` |
| Document numbers, symptom triage, terminology, where a table lives | `00-quickref.md` |
| Known misconceptions and unresolved conflicts | `errata.md` |
| Full citation list | `bibliography.md` |

## The Windows fact that resolves most questions

Once VBS, WSL2, Windows Sandbox, Docker Desktop or the Hyper-V role is enabled,
**the Windows kernel runs as a VTL0 guest and Hyper-V owns VMX root operation.**
Any question shaped like "why can't my VMM / driver / debugger use VT-x on this
machine" resolves there, and any third-party VMM on that machine is already
running nested through the Windows Hypervisor Platform. See
`17-windows-platform.md` §17.1 before reaching for a hardware explanation.

## Output standards

- **Cite the specification, not this skill.** Every architectural claim in a
  chapter carries an anchor such as `[SDM 3C §27.9.1]` or `[VT-d 5.20 §7.1.3]`
  plus a `[N]` bibliography reference. Reproduce the Intel document and section
  in your answer. "According to the SDM" without a section is not a citation.
- **Carry the confidence and volatility markers.** A claim tagged `C:low` is
  reported as uncertain. A claim tagged `V:dated` — everything in
  `90-dated-landscape.md` — is reported as a 2026-09-16 snapshot that the user
  must re-verify before acting on it.
- **Numbers keep their conditions.** Performance figures are meaningless without
  microarchitecture, hypervisor version, benchmark and year. Where sources
  disagree, `16-performance.md` presents them side by side; do the same. Never
  average conflicting measurements.
- **Vendor statements stay attributed.** "Zero virtualization overhead" and its
  relatives are claims made by a vendor, not measurements. Say who said it.
- **Say when the knowledge base does not know.** Gaps are marked deliberately —
  several chapters end with an explicit open-items section. Reporting a gap beats
  filling it with a plausible guess, which is the exact failure this rebuild
  exists to eliminate.
- **Do not invent section numbers.** If you cite an Intel section, it must be one
  the chapter gives you. The SDM renumbered its VMX chapters; remembered numbers
  from older manuals are wrong.

## Scope boundaries

- **AMD-primary questions** go to the sibling `amd-virtualization` skill. Use this
  skill for Intel-primary questions and for two-way comparisons, where
  `18-comparison-amd-arm-riscv.md` gives the Intel-side view.
- **TDX is server-only.** No client Windows PC has it. `13-tdx.md` is complete and
  specification-anchored, but read it only for Xeon or confidential-computing
  questions.
- **Time-sensitive facts live in exactly one file.** If a fact has a GA date, a
  version number, a price or a market share, it is in `90-dated-landscape.md` and
  nowhere else. The architecture chapters are meant to stay true.

## Known limits

- The dated snapshot is **2026-09-16**. Nothing after it is covered.
- No modern (Ice Lake / Sapphire Rapids / Granite Rapids / any client part)
  public cycle-level VM-exit measurement exists in this knowledge base. The
  newest hard figure is Westmere-era, 2010. `16-performance.md` says so rather
  than extrapolating.
- Several structure layouts are deliberately incomplete where the source PDF was
  ambiguous; each chapter's open-items section names them.
- The Windows chapters cite Microsoft Learn and the Hypervisor Top-Level
  Functional Specification. They are Tier-2 sources: authoritative for Windows
  behaviour, but not Intel specifications.
