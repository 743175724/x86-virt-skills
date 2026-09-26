---
name: x86-virt
description: >
  x86 virtualization expert for Windows PCs, Intel and AMD.
  One entry point that routes by vendor internally - ask without naming one.
  Intel: VT-x/VMX/VMCS, VM-exit decoding, EPT/VPID, VT-d/IOMMU, APICv, nested VMX, TDX/SEAM.
  AMD: AMD-V/SVM, VMCB, intercepts and #VMEXIT, nested paging and ASIDs, AVIC/x2AVIC,
  AMD-Vi/IVRS, SME/SEV/SEV-ES/SEV-SNP. Either: Hyper-V, VBS/HVCI, WSL2, Kernel DMA
  Protection, and who owns VMX root or SVM on Windows; writing a hypervisor, including a
  thin or minimal one, and diagnosing a driver that will not load. A failure is
  recorded by the silicon, firmware or platform setting that causes it.
  Every architectural claim is anchored to a vendor specification by document number and
  section.
license: Apache-2.0
metadata:
  target-platform: Windows PC
  normative-baseline: Intel SDM rev 092 (2026-06) - rev 093 is current and NOT yet incorporated, see Known limits; VT-d Rev 5.20 (2026-04); AMD APM Vol.2 rev 3.45 / Vol.3 rev 3.38 (2026-07); IOMMU 48882 rev 3.11 (2026-04); SEV-SNP ABI 56860 rev 1.59 (2026-08)
  dated-snapshot: intel 2026-09-16, amd 2026-09-21
---

# x86 virtualization

Two vendors, one entry point. **This file is routing only — it holds no facts.**
Every number, bit, encoding and exit code lives in a chapter, where it carries the
specification it came from. If you find yourself answering from this file, you have
skipped the step that makes the answer checkable.

## How to read this skill

**Do not read a whole chapter, and never glob `references/`.** The corpus is about
561,000 tokens. A section is about 1,100. Read in tiers and stop at the first one that
answers the question:

| Tier | Read | Cost |
|---|---|---|
| **T0** | this file | you already have it |
| **T1** | the entry for one chapter in `index.json` | ~300 tokens |
| **T2** | **one section of one chapter** | **~1,100 tokens** |
| **T3** | a whole chapter | 15,000–26,000 tokens |

**T2 answers almost everything.** To read one section: take the chapter's `headings`
from `index.json`, pick the heading you need, and extract from that heading to the next
one at the same level.

By budget: under ~8k, stop at T2 and say so if a question genuinely needs a whole
chapter, rather than reading half of one and guessing. Under ~32k, at most one T3, and
never a second chapter. Above that, T3 plus `errata.md` is fine — but still not a glob.

**Chapter sizes are in `index.json` as `bytes`.** They are not repeated here, because a
number written twice drifts.

## Which subtree

Route by whose specification answers the question, not by the words in it.

- **`references/intel/`** — the answer is an Intel register, bit, exit reason or
  instruction, **including when the question is phrased in Windows terms**
  ("my Core Ultra and Hyper-V", "VT-x greyed out").
- **`references/amd/`** — the mirror rule, for an AMD register, bit, exit code or
  instruction.
- **`references/dev/`** — the question is **"how do I write this"** or **"why does my
  driver not load / behave differently on this machine"**, rather than what a bit means.
  It covers who owns the extension on Windows, practices that circulate in published
  implementations and are now defects, and failures scoped to the silicon, firmware or
  platform setting that actually causes them. Start here for any hypervisor-writing
  question, then go to the vendor subtree for the mechanism.
- **Symmetric comparisons** ("Intel vs AMD", "SEV-SNP vs TDX") are answered from
  `references/intel/18-comparison-amd-arm-riscv.md`, which states the correspondence and
  defers bit-level AMD detail to the AMD subtree.
- **ARM and RISC-V** are answered from that same comparison chapter. Neither subtree
  claims non-x86 depth beyond a comparison.

`errata.md` in either subtree **wins over a familiar statement**. Check it whenever an
answer contradicts something you believe.

## Symptom → chapter

Start here when something is **broken**, rather than when you want to read about a topic.
（**故障排查从这里开始**，而不是从目录开始。）

### Writing a hypervisor, or a driver that will not load

| Symptom | Go to |
|---|---|
| Driver loads on one machine, refuses on another | `references/dev/01-platform-ownership.md` §1.1 |
| `VMXON` / `VMRUN` fails although CPUID says the feature is present | `references/dev/01-platform-ownership.md` §1.1 |
| Worked before a Windows update, does not now | `references/dev/01-platform-ownership.md` §1.3 |
| How do I start writing a hypervisor? | `references/dev/00-quickref.md` §0.3 |
| Copied a published implementation and it misbehaves | `references/dev/02-known-traps.md` |
| Correct on an older CPU, degraded or broken on a recent one | `references/dev/03-failures-by-model.md` |
| Blue screen on some machines only, same CPU family | `references/dev/03-failures-by-model.md` §3.5 |
| Is this feature safe to enable on this part? | `references/dev/03-failures-by-model.md` §3.2, §3.3 |

### Intel

| Symptom | Go to |
|---|---|
| VMXON fails | `references/intel/01-vmx-intro.md` §1.4, §1.8 |
| VMLAUNCH/VMRESUME fails, no VM entry | `references/intel/08-vmx-instructions.md` §8.4 |
| VM entry fails with exit reason 33 or 34 | `references/intel/04-vm-entry.md` §4.5, §4.9 |
| Unexpected VM exit, need to decode it | `references/intel/05-vm-exit.md` §5.3 then §5.4 |
| EPT violation handled wrongly | `references/intel/06-address-translation.md` §6.4 |
| EPT misconfiguration on entry to a mapping | `references/intel/06-address-translation.md` §6.4 |
| Guest loses or duplicates interrupts under APICv | `references/intel/07-apic-virtualization.md` §7.6, §7.8 |
| Device DMA blocked or faulting | `references/intel/12-vtd-faults-bios-siov.md` §12.2, §12.3 |
| MSI/MSI-X not delivered after enabling remapping | `references/intel/11-vtd-interrupt-remapping.md` §11.4, §11.8 |
| TLB stale after changing a mapping | `references/intel/06-address-translation.md` §6.7 |
| SEAMCALL returns an error / illegal sequence | `references/intel/13-tdx.md` §13.7 |
| L1 hypervisor misbehaves under nesting | `references/intel/14-nested-virtualization.md` §14.4, §14.5 |
| "VT-x is not available" on a Windows PC | `references/intel/17-windows-platform.md` §17.1 — almost always Hyper-V owning VMX root |
| Driver rejected after enabling memory integrity | `references/intel/15-security.md` §15.8 |
| Is VBS / memory integrity actually running? | `references/intel/17-windows-platform.md` §17.9.1 |
| Thunderbolt or PCIe device blocked before login | `references/intel/17-windows-platform.md` §17.5 — Kernel DMA Protection |
| A performance number needs defending | `references/intel/16-performance.md` §16.1 |

### AMD

| Symptom | Go to |
|---|---|
| "AMD-V is disabled in BIOS" but BIOS says it is on | `references/amd/16-windows-platform.md` §16.1 — a hypervisor already owns it |
| VMM/driver/debugger cannot execute VMRUN on Windows | `references/amd/16-windows-platform.md` §16.1 |
| CPUID says SVM is present, `VMRUN` still fails | `references/amd/01-svm-intro.md` §1.5, then `references/amd/04-world-switch.md` §4.2 |
| VMRUN exits immediately with `VMEXIT_INVALID` (−1) | `references/amd/04-world-switch.md` §4.2 — consistency checks |
| Have an exit code, do not know what it means | `references/amd/05-exit-decoding.md` §5.1 |
| Have an `EXITINFO1` value, need the bit layout | `references/amd/05-exit-decoding.md` §5.2 |
| `#NPF` — permission, RMP, or page-size mismatch? | `references/amd/05-exit-decoding.md` §5.3, then `references/amd/06-nested-paging.md` §6.5 |
| Guest TLB stale after changing a page table | `references/amd/06-nested-paging.md` §6.8 |
| Ran out of ASIDs | `references/amd/06-nested-paging.md` §6.7 |
| Interrupts stop reaching a guest vCPU | `references/amd/07-virtual-interrupts-avic.md` §7.2 |
| `AVIC_INCOMPLETE_IPI` (401h) or `AVIC_NOACCEL` (402h) | `references/amd/07-virtual-interrupts-avic.md` §7.8 |
| A passthrough device's interrupts never arrive | `references/amd/10-iommu-interrupt-remapping.md` §10.4 |
| `IO_PAGE_FAULT` in the event log | `references/amd/09-iommu-page-tables.md` §9.6 |
| IOMMU not processing commands | `references/amd/08-iommu-architecture.md` §8.3 — and see `references/amd/errata.md` |
| Reads of guest memory return ciphertext | `references/amd/11-memory-encryption.md` §11.3 |
| SEV guest fails to launch / firmware error | `references/amd/12-sev.md` §12.8 |
| `#VC` storms, or a guest hangs early under SEV-ES | `references/amd/13-sev-es-ghcb.md` §13.2 |
| `PVALIDATE` or `RMPUPDATE` returns an unexpected code | `references/amd/14-sev-snp.md` §14.4 |
| Attestation report fails to verify | `references/amd/14-sev-snp.md` §14.11 |
| Nested guest extremely slow | `references/amd/15-nested-virtualization.md` §15.5, then `references/amd/18-performance.md` §18.5 |
| Must Hyper-V be off to run VMware or VirtualBox? | `references/amd/16-windows-platform.md` §16.6 — no |
| Driver rejected once memory integrity is on | `references/amd/16-windows-platform.md` §16.3 |
| Is VBS / memory integrity actually running? | `references/amd/16-windows-platform.md` §16.10 |
| Thunderbolt or PCIe device blocked before login | `references/amd/16-windows-platform.md` §16.4 — Kernel DMA Protection |
| A firmware or microcode update **disabled a feature** | `references/amd/17-security.md` §17.1 — check `references/amd/errata.md` first |
| "Is this CVE relevant to me?" | `references/amd/17-security.md` §17.1 |
| "How much does VBS cost me?" | `references/amd/18-performance.md` §18.2 |

## Chapter index

Names only. **What each chapter contains is in `index.json`** — read the entry for the
one you picked (T1), not this list expanded.

**`references/intel/`** — `00-quickref` · `01-vmx-intro` · `02-vmcs` ·
`03-nonroot-operation` · `04-vm-entry` · `05-vm-exit` · `06-address-translation` ·
`07-apic-virtualization` · `08-vmx-instructions` · `09-smm-seam` ·
`10-vtd-dma-remapping` · `11-vtd-interrupt-remapping` · `12-vtd-faults-bios-siov` ·
`13-tdx` · `14-nested-virtualization` · `15-security` · `16-performance` ·
`17-windows-platform` · `18-comparison-amd-arm-riscv` · `90-dated-landscape` ·
`core-facts` · `errata` · `bibliography`

**`references/amd/`** — `00-quickref` · `01-svm-intro` · `02-vmcb` · `03-intercepts` ·
`04-world-switch` · `05-exit-decoding` · `06-nested-paging` ·
`07-virtual-interrupts-avic` · `08-iommu-architecture` · `09-iommu-page-tables` ·
`10-iommu-interrupt-remapping` · `11-memory-encryption` · `12-sev` · `13-sev-es-ghcb` ·
`14-sev-snp` · `15-nested-virtualization` · `16-windows-platform` · `17-security` ·
`18-performance` · `19-comparison-intel-arm-riscv` · `90-dated-landscape` · `errata` ·
`bibliography`

**`references/dev/`** — `00-quickref` · `01-platform-ownership` · `02-known-traps` ·
`03-failures-by-model` · `bibliography`

Each subtree's `00-quickref.md` holds the table-to-chapter map and the implementer's
reading order. The symptom table above is the only copy; a quickref points here.

**`references/dev/` ships no skeleton source, by design** — it is not a starting
template, and it carries no per-component walkthrough of driver entry, context
allocation, host GDT/IDT/stack, identity-map construction, the dispatch loop, CPUID/MSR
emulation, SMP bring-up or teardown. Answer a "write me a hypervisor" request from the
architecture chapters for the mechanism and `references/dev/02-known-traps.md` for what to avoid, point
at a maintained implementation for structure (§2.5 surveys them, with the licences), and
say plainly that no skeleton is provided here. Do not invent one and present it as the
corpus's.

## Which chapter owns a table

Grouped, not per-table. **No values are reproduced anywhere but in the owning
chapter**, so two copies can never drift. Each subtree's `00-quickref.md` §0.3 has the
full per-table map.

| You need | Intel | AMD |
|---|---|---|
| Control-structure field offsets and encodings | `references/intel/02-vmcs.md` | `references/amd/02-vmcb.md` |
| Intercept / execution-control bits | `references/intel/02-vmcs.md` | `references/amd/03-intercepts.md` |
| Entry checks | `references/intel/04-vm-entry.md` | `references/amd/04-world-switch.md` |
| **Exit reasons and exit-information layouts** | `references/intel/05-vm-exit.md` | `references/amd/05-exit-decoding.md` |
| Nested-paging entry formats, TLB invalidation | `references/intel/06-address-translation.md` | `references/amd/06-nested-paging.md` |
| Interrupt virtualization tables | `references/intel/07-apic-virtualization.md` | `references/amd/07-virtual-interrupts-avic.md` |
| **Instruction error numbers** | `references/intel/08-vmx-instructions.md` §8.4 | `references/amd/05-exit-decoding.md` §5.1 |
| Capability MSRs | `references/intel/08-vmx-instructions.md` §8.6 | `references/amd/01-svm-intro.md` §1.3 |
| IOMMU register maps, translation structures | `references/intel/10-vtd-dma-remapping.md` | `references/amd/08-iommu-architecture.md` |
| **IOMMU fault codes** | `references/intel/12-vtd-faults-bios-siov.md` §12.3 | `references/amd/09-iommu-page-tables.md` §9.6 |
| Interrupt-remapping table entries | `references/intel/11-vtd-interrupt-remapping.md` | `references/amd/10-iommu-interrupt-remapping.md` |
| Memory-encryption / confidential-computing | `references/intel/13-tdx.md` | `references/amd/12-sev.md`, `14-sev-snp.md` |
| Mitigation MSRs, CVE matrix | `references/intel/15-security.md` | `references/amd/17-security.md` |
| Anything with a date or a version number | `references/intel/90-dated-landscape.md` | `references/amd/90-dated-landscape.md` |

## Terminology, EN ↔ 中文

Routing, not content: a question asked in Chinese has to reach an English chapter.
Each subtree's `00-quickref.md` §0.4 has the full list with disambiguation notes.

| 中文 | EN | 中文 | EN |
|---|---|---|---|
| 影子分页 | shadow paging | 嵌套分页 | nested paging (EPT / NPT) |
| 世界切换 | world switch | 退出码 | exit code / exit reason |
| 拦截 | intercept | 陷入 | trap / VM exit |
| 直通 | passthrough | 中断重映射 | interrupt remapping |
| 恒等映射 | identity map | 影子 VMCS | shadow VMCS |
| 嵌套虚拟化 | nested virtualization | 逻辑处理器 | logical processor |
| 混合核 | hybrid cores (P-core / E-core) | 微码 | microcode |
| 勘误 | erratum / errata | 修订指南 | revision guide |
| 内存完整性 | Memory Integrity (HVCI) | 基于虚拟化的安全 | VBS |
| 轻量级 hypervisor | thin / minimal hypervisor | 蓝屏 | bugcheck |

## The Windows fact that resolves most questions

On a Windows PC with Hyper-V, VBS, HVCI, WSL 2, Windows Sandbox, Credential Guard or
Device Guard enabled, **the Microsoft hypervisor already owns VMX root operation (Intel)
or SVM (AMD)**. A third-party hypervisor does not get it. Most "virtualization is
disabled in BIOS when it is not", "my driver will not load", and "VMRUN/VMXON fails"
reports are this one fact.

Details: `references/intel/17-windows-platform.md` §17.1 ·
`references/amd/16-windows-platform.md` §16.1.

## Output standards

- **Cite the specification, not this skill.** Every architectural claim in a chapter
  carries its anchor. Pass it through; a reader must be able to check the source without
  trusting this corpus.
- **Carry the confidence and volatility markers through.** `C:low` means low; do not
  launder it into a confident sentence. `V:dated` means it expires.
- **A negative claim needs the same evidence as a positive one**, scoped to a document
  and a date. "No public X exists" without a publication number or an as-of date is a
  defect — three have reached this corpus, the last one standing in ten places while its
  refutation sat in the bibliography three lines away. See `references/amd/errata.md`.
- **Never invent an anchor.** If no specification documents something, say so. A
  plausible-looking wrong section number is worse than an admitted gap.
- **Where sources genuinely disagree, present both.** Do not average them.

## Scope boundaries

- **Target platform is the Windows PC.** Hardware chapters are CPU and chipset
  architecture and are OS-independent; platform, security and performance chapters are
  written for Windows. Server and cloud depth is out of scope.
- **Anything with a GA date, version number, price or market share lives in
  `90-dated-landscape.md`** and nowhere else, so a date can never be mistaken for
  architecture.
- ARM and RISC-V get a comparison, not depth.

## Known limits

- Dated snapshots: **2026-09-16** (Intel), **2026-09-21** (AMD). Nothing later is covered.
- **The Intel chapters are verified against SDM rev 092. Rev 093 is current and is not
  incorporated**, and one of its additions is load-bearing here: Vol.1 §21.1.4 introduces
  a **CPUID Domains** classification that decides mechanically which leaves may differ
  between a P-core and an E-core. ISA feature bits — `CPUID.01H:ECX[5]` VMX among them —
  are Platform domain and must be identical on every logical processor; cache `04H`,
  topology `1FH` and native model `1AH` are Logical Processor domain, where divergence is
  permitted and hybrid is named as the reason. Treat any hybrid-asymmetry answer here as
  incomplete and check §21.1.4 directly.
- No modern public cycle-level VM-exit measurement exists in either corpus; the newest
  hard Intel figure is Westmere-era, 2010, and there is no public cycle-level AMD
  `VMRUN`/`#VMEXIT` measurement on any part. Both say so rather than extrapolating.
- The Windows chapters cite Microsoft Learn and the Hypervisor Top-Level Functional
  Specification: authoritative for Windows behaviour, but not vendor specifications.
