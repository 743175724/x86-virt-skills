---
name: amd-virtualization
description: >
  AMD virtualization expert knowledge base for Windows PCs.
  Covers AMD-V/SVM, the VMCB, intercepts and #VMEXIT decoding, nested paging and ASIDs,
  AVIC and x2AVIC, the AMD IOMMU including IVRS and interrupt remapping, SME/TSME and the
  C-bit, SEV/SEV-ES/SEV-SNP with RMP, VMPL and attestation, nested SVM, and Hyper-V/VBS/
  HVCI/WSL2 and who owns SVM on Windows. Every architectural claim is anchored to an AMD
  specification by publication number and section.
  Triggers - AMD-V, SVM, VMRUN, VMCB, VMEXIT, EXITCODE, EXITINFO, intercept, NPT, nested
  paging, RVI, ASID, INVLPGA, AVIC, x2AVIC, vGIF, IOMMU, AMD-Vi, IVRS, DTE, IRTE, SME,
  TSME, C-bit, SEV, SEV-ES, SEV-SNP, GHCB, VMGEXIT, RMP, PVALIDATE, VMPL, SVSM,
  attestation, Hyper-V, VBS, HVCI, WSL2, Kernel DMA Protection, hypervisor.
  Do NOT use for Intel-primary questions - the sibling intel-vt skill owns those - or for
  generic virtualization concepts unrelated to AMD hardware.
license: Apache-2.0
metadata:
  target-platform: Windows PC
  normative-baseline: APM Vol.2 rev 3.45 / Vol.3 rev 3.38 (2026-07), IOMMU 48882 rev 3.11 (2026-04), SEV-SNP ABI 56860 rev 1.59 (2026-08)
  dated-snapshot: 2026-09-21
---

# AMD virtualization — specification-anchored knowledge base

Target platform: **Windows PC**. The hardware chapters (`01`–`11`) are CPU and
chipset architecture and are OS-independent; `12`–`14` are SEV and are server
scope; the platform, security and performance chapters are written for Windows.

## How to use this skill

**Read the one chapter your question maps to. Do not load the directory.**
Chapters run 300–500 lines each. The routing table resolves to the section that
**owns** the fact; where a row lists more than one, each is named with what it
holds. If a value is still not where you landed, `00-quickref.md` §0.3 maps every
table in the skill to its owning section — that is faster than opening a second
chapter.

1. **Look up the route** in §Routing. If the question is a symptom rather than a
   topic, use `00-quickref.md` §0.2 instead — it maps failures to chapters.
2. **Read that chapter's section.** Each chapter opens with a Chinese summary, a
   `Maps to:` line naming its AMD specification chapter, and an `Owns:` line.
   If the fact you need is listed under another chapter's `Owns:`, go there —
   that chapter is authoritative and this one only cross-references it.
3. **Check `errata.md` before writing anything** that touches a commonly
   circulated claim. Where it disagrees with a familiar statement, it wins.
   Five of its entries exist because a proposed correction was itself wrong and
   a primary-source check refuted it; those are marked `[reversed]`.
4. **Stop.** One chapter plus `errata.md` answers almost everything. Pull a
   second chapter only when the question genuinely spans two (decoding an
   `#NPF`, for example, needs `05` for the bit layout and `06` for the
   semantics).

This skill deliberately has **only one navigation file**, unlike its Intel
sibling. Two navigation files with the same job is the seam through which the
old quick-reference drifted into a second, stale fact store, so there is no
separate index of core facts here: `00-quickref.md` navigates and holds no
authoritative values of its own.

## Routing

| Question is about | Read |
|---|---|
| Enabling SVM, `EFER.SVME`, `VM_CR`, BIOS lock, CPUID feature bits, "SVM is unavailable" | `01-svm-intro.md` §1.4 (MSRs) · §1.5 (the enable chain) |
| **VMCB field offsets** — where a field *is*, including that the 60h word exists — control area, state save area, segment attributes, clean bits | `02-vmcb.md` §2.2 (control area) · §2.3 (save area) · §2.5 (clean bits) |
| Intercept vectors and bit numbers, IOPM, MSRPM, PAUSE filter, TSC ratio, LBR/IBS/PMC virtualization | `03-intercepts.md` §3.1 (vectors) · §3.3–§3.4 (IOPM, MSRPM) |
| VMRUN, `#VMEXIT`, consistency checks, VMLOAD/VMSAVE, VLS, GIF, STGI/CLGI, `#SX` | `04-world-switch.md` §4.2 |
| **Decoding an exit**: the EXITCODE table (§5.1), EXITINFO1/2 layouts (§5.2), NRIP, Decode Assist, EVENTINJ | `05-exit-decoding.md` §5.1 (codes) · §5.2 (EXITINFO) |
| Nested page tables, the two-dimensional walk, `#NPF` semantics, memory-type combining, ASID, `TLB_CONTROL`, INVLPGA, GMET | `06-nested-paging.md` §6.5 (`#NPF`) · §6.7–§6.8 (ASID, TLB, INVLPGA) |
| Virtual interrupts, **what the bits of the offset-60h word mean**, vGIF, AVIC, x2AVIC, the doorbell | `07-virtual-interrupts-avic.md` §7.1 (the 60h word) · §7.8 (AVIC exits) |
| IOMMU MMIO registers, the Device Table Entry, event/PPR/GA **log entry formats** | `08-iommu-architecture.md` §8.2 (the MMIO map and window size) · §8.3 (Control/Status) · §8.6 (DTE) · §8.8 (log formats) |
| I/O page tables, GCR3, commands, ACPI IVRS, **decoding an `IO_PAGE_FAULT`** | `09-iommu-page-tables.md` §9.6 |
| **IRTE formats**, the DTE interrupt cluster, MSI remapping, GA log semantics, GAPPI, ATS/PRI/PASID | `10-iommu-interrupt-remapping.md` §10.1–§10.3 (IRTEs, DTE cluster) · §10.4 (end to end) |
| **SME, TSME, the C-bit**, `Fn8000_001F`, SYSCFG, AMD-SP — what a client PC actually has | `11-memory-encryption.md` §11.2 |
| SEV key hierarchy, ASIDs, firmware commands, guest policy, `SEV_STATUS`, the threat model | `12-sev.md` §12.6 (`SEV_STATUS`) · §12.8 (firmware commands and status codes) |
| SEV-ES: the VMSA, `#VC`, **the GHCB layout**, the MSR protocol, NAE events, VMGEXIT | `13-sev-es-ghcb.md` §13.3 (establishing it) · §13.4 (layout) · §13.5 (MSR protocol) |
| SEV-SNP: **the RMP**, page states, VMPL, the SNP instructions, attestation, vTOM, Secure TSC, SVSM | `14-sev-snp.md` §14.1 (RMP) · §14.4 (instructions) · §14.11 (attestation) |
| Nested SVM, vmcb02, intercept merging, **what AMD has instead of VMCS shadowing** | `15-nested-virtualization.md` §15.2–§15.3 (building vmcb02, merging) · §15.4.3 (ASID namespace) · §15.5 (what AMD has instead) |
| **Hyper-V on AMD, VBS, HVCI, WSL2, WHP, Kernel DMA Protection, "why can't my VMM use AMD-V"** | `16-windows-platform.md` §16.1 |
| CVEs and their mitigations, transient execution, SKINIT/DRTM, SMM containerization, erratum-driven masking | `17-security.md` §17.1 |
| Overhead numbers — VBS/HVCI, WSL2, WHP versus bare SVM, nesting, nested paging | `18-performance.md` §18.1 |
| AMD versus Intel, ARM and RISC-V; what a client PC actually has | `19-comparison-intel-arm-riscv.md` |
| Cloud instances, GA dates, kernel/firmware versions, AVIC default-state history | `90-dated-landscape.md` |
| Document numbers, symptom triage, terminology, where a table lives | `00-quickref.md` |
| Known misconceptions and unresolved conflicts | `errata.md` |
| Full citation list | `bibliography.md` |

## The Windows fact that resolves most questions

Once VBS, memory integrity, WSL2, Windows Sandbox, Docker Desktop or the Hyper-V
role is enabled, **the Windows hypervisor holds `EFER.SVME` and the Windows
kernel itself runs as a VTL0 guest.** Any question shaped like "why can't my
VMM / driver / debugger use AMD-V on this machine" resolves there, and any
third-party VMM on that machine is already running nested over the Windows
Hypervisor Platform. See `16-windows-platform.md` §16.1 before reaching for a
hardware explanation — the CPUID and MSR probe chain in `01-svm-intro.md` will
report everything as healthy and still not tell you who owns the CPU.

## Output standards

- **Cite the specification, not this skill.** Every architectural claim carries
  an anchor such as `[APM2 §15.25.6]`, `[IOMMU 3.11 §2.2.2]` or
  `[SNP-ABI 1.59 Table 27]`, plus a `[N]` bibliography reference. Reproduce the
  AMD publication and section in your answer. "According to the APM" without a
  section is not a citation.
- **Instructions are cited by mnemonic.** APM Vol.3 Chapter 4 is ordered
  alphabetically and carries page numbers, not subsection numbers, so the form
  is `[APM3 §4 "PVALIDATE"]`. **`[APM3 §4.7.2 VMRUN]` is a fabrication** — that
  numbering does not exist.
- **Platform, security and measurement claims cite their own source, not AMD.**
  Windows behaviour, CVEs and performance figures are not AMD architecture and
  have no APM section. For those the citation is the Tier-2 source with its page
  — Microsoft Learn, the Hypervisor Top-Level Functional Specification,
  kernel.org, NVD, the paper — or an `[AMD-SB-nnnn]` security bulletin.
  Demanding an APM anchor for "what WSL2 costs" produces either a fabricated
  citation or a failed answer; both are worse than citing Microsoft correctly.
  Chapters `15`–`19` and `90` are where this applies.
- **Carry the confidence and volatility markers.** A claim tagged `C:low` is
  reported as uncertain. A claim tagged `V:dated` — everything in
  `90-dated-landscape.md` — is reported as a 2026-09-21 snapshot that the user
  must re-verify before acting on it.
- **Numbers keep their conditions.** A performance figure without
  microarchitecture, hypervisor version, benchmark and year is not usable.
  `18-performance.md` presents conflicting measurements side by side; do the
  same, and never average them.
- **Vendor statements stay attributed.** "Near-native performance" and its
  relatives are claims made by a vendor, not measurements. Say who said it.
- **Say when the knowledge base does not know.** Every chapter ends with an open
  items section, and they are populated. Reporting a gap beats filling it with a
  plausible guess, which is the exact failure this rebuild exists to eliminate.
- **Do not invent section numbers.** If you cite an AMD section, it must be one
  the chapter gives you. AMD appends rather than renumbers, so the risk here is
  not stale numbers but invented recent ones — `§15.36`'s subsections especially.
- **A negative claim needs the same evidence as a positive one.** "AMD has no
  X" is falsifiable and is frequently false in a way that reads plausible. Where
  the corpus states a negative it scopes it to a document and revision; do the
  same, and do not generalise "the APM does not define X" into "X does not
  exist". The enlightened-VMCB case in `15-nested-virtualization.md` §15.5.4 is
  the worked example.

## Scope boundaries

- **Intel-primary questions** go to the sibling `intel-vt` skill. Use this skill
  for AMD-primary questions and for two-way comparisons, where
  `19-comparison-intel-arm-riscv.md` gives the AMD-side view.
- **SEV is server scope, stated precisely.** SEV is productised on EPYC. Zen 4
  and later client parts expose SME only, and SEV-SNP has never been available
  on a client part. **"SEV does not exist on client parts" is false** — measured
  Zen+/2/3 client parts, including non-PRO consumer SKUs, report
  `Fn8000_001F EAX[1] = 1`. Client memory encryption is `11-memory-encryption.md`.
- **Linux and VFIO appear only as labelled contrast subsections.** This skill
  targets Windows PCs; where a Linux detail is the only available evidence, it
  is marked as such.
- **Time-sensitive facts live in exactly one file.** If a fact has a GA date, a
  version number, a price or a market share, it is in `90-dated-landscape.md`
  and nowhere else. The architecture chapters are meant to stay true.

## Known limits

- The dated snapshot is **2026-09-21**. Nothing after it is covered.
- **No public cycle-level AMD `VMRUN`/`#VMEXIT` measurement exists** on any
  part, and exactly one measurement in `18-performance.md` was taken on a client
  part. There is no public AMD nested-virtualization measurement and no
  WHP-versus-bare-SVM measurement. The chapter says so rather than extrapolating.
- **AMD publishes no errata channel for client parts.** Revision guides exist
  for EPYC families only; client Ryzen has no public revision guide and no
  public PPR, so client errata claims say that rather than citing a document
  that does not exist.
- **TSME has no normative source.** The APM does not contain the term. The only
  substantive description is AMD's memory-encryption white paper, pub 70363,
  which is non-normative and cited as such.
- Several structure layouts are deliberately incomplete where the specification
  is silent or self-contradictory — the raw in-memory RMP entry layout, for
  instance. Each chapter's open-items section names them, and several record
  defects in AMD's own tables.
