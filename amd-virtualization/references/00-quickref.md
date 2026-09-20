# 00. Quick Reference

> **中文速览**：本章是导航层，不是事实层。它只回答"这个东西在哪一章"——AMD 文档号索引、症状→章节的排查路由、各类表格的归属、中英术语对照，以及 Windows PC 上最常被问到的几个问题的直达指针。**这里不重复任何数值**：权威值只存在于拥有它的章节里，避免两处数字漂移。要查具体位域、偏移、编码、错误码，按下面的指针跳过去。

**Maps to:** navigation only — no normative content of its own.
**Owns:** nothing. This file holds no authoritative values and no claim lines; lint enforces that.
**Scope:** navigation
**See also:** `errata.md` (check it before writing anything)

---

## 0.1 The AMD document set

Publication numbers, not titles, are what identify an AMD document. Revisions
below are the ones this knowledge base was verified against.

| Pub | Document | Rev | Cited as |
|---|---|---|---|
| 24593 | APM Vol.2, System Programming — **SVM is Ch.15** | 3.45 (2026-07) | `[APM2 §15.x]`, `[APM2 App.B]` |
| 24594 | APM Vol.3, General-Purpose and System Instructions | 3.38 (2026-07) | `[APM3 §4 "VMRUN"]` |
| 24592 | APM Vol.1, Application Programming | 3.25 (2026-05) | `[APM1 §x]` |
| 48882 | AMD I/O Virtualization Technology (IOMMU) Specification | 3.11 (2026-04) | `[IOMMU 3.11 §x]` |
| 56860 | SEV-SNP Firmware ABI Specification | 1.59 (2026-08) | `[SNP-ABI 1.59 §x]` |
| 56421 | SEV-ES Guest-Hypervisor Communication Block | 2.04 (2025-01) | `[GHCB 2.04 §x]` |
| 55766 | Secure Encrypted Virtualization API — **SEV and SEV-ES only** | 3.24 (2020-04) | `[SEV-API 3.24 §x]` |
| 58019 | SVSM Guest Communication Interface | 1.01 (2026-03) | `[SVSM 1.01 §x]` |
| 70363 | AMD Memory Encryption white paper — **non-normative** | 2021-10 | `[MEM-WP 70363 p.n]` |
| 70366 | SEV-SNP white paper — **non-normative** | 2020-01 | `[SNP-WP 70366 p.n]` |
| 57095 / 58251 | Revision Guides, EPYC Fam 19h / 1Ah — **the only public AMD errata** | 1.05 / 1.30 | `[RevGuide 57095 erratum 1458]` |

Three traps worth knowing before you go looking:

- **APM Vol.3 Chapter 4 is alphabetical and has page numbers, not subsection
  numbers.** Cite an instruction by mnemonic. `[APM3 §4.7.2 VMRUN]` is invented.
- **The IOMMU specification has five chapters and no appendices.**
  `[IOMMU 3.11 App.x]` is always wrong. IVRS is §5.2.
- **There is no public PPR or revision guide for client Ryzen.** If a claim about
  a client part needs one, the claim says so instead of citing a document that
  does not exist.

## 0.2 Symptom → chapter

| Symptom | Start at |
|---|---|
| "AMD-V is disabled in BIOS" but BIOS says it is on | `16-windows-platform.md` §16.1 — a hypervisor already owns it |
| My VMM/driver/debugger cannot execute VMRUN on Windows | `16-windows-platform.md` §16.1 |
| CPUID says SVM is present, `VMRUN` still fails | `01-svm-intro.md` §1.5, then `04-world-switch.md` §4.2 |
| VMRUN exits immediately with `VMEXIT_INVALID` (−1) | `04-world-switch.md` §4.2 — consistency checks |
| I have an exit code and do not know what it means | `05-exit-decoding.md` §5.1 |
| I have an `EXITINFO1` value and need the bit layout | `05-exit-decoding.md` §5.2 |
| `#NPF` — is it a permission fault, an RMP fault, or a page-size mismatch? | `05-exit-decoding.md` §5.3 for the bits, `06-nested-paging.md` §6.5 for the ordering |
| Guest TLB entries are stale after I changed a page table | `06-nested-paging.md` §6.8 |
| I ran out of ASIDs | `06-nested-paging.md` §6.7 |
| Interrupts stop being delivered to a guest vCPU | `07-virtual-interrupts-avic.md` §7.2 |
| A passthrough device's interrupts never arrive | `10-iommu-interrupt-remapping.md` §10.4 |
| `IO_PAGE_FAULT` in the event log | `09-iommu-page-tables.md` §9.6 |
| The IOMMU is not processing my commands | `08-iommu-architecture.md` §8.3 — and see `errata.md` E01 |
| Reads of guest memory return ciphertext | `11-memory-encryption.md` §11.3 |
| SEV guest fails to launch / firmware returns an error | `12-sev.md` §12.8 |
| `#VC` storms, or a guest hangs in early boot under SEV-ES | `13-sev-es-ghcb.md` §13.2 |
| `PVALIDATE` or `RMPUPDATE` returns an unexpected code | `14-sev-snp.md` §14.4 |
| Attestation report fails to verify | `14-sev-snp.md` §14.11 |
| Nested guest is extremely slow | `15-nested-virtualization.md` §15.5, then `18-performance.md` §18.5 |
| "Is this CVE relevant to me?" | `17-security.md` §17.1 |
| "How much does VBS cost me?" | `18-performance.md` §18.2 |

## 0.3 Where the tables live

One owner per table. If two chapters seem to have the same table, the owner
listed here wins and the other is a cross-reference.

| Table | Chapter |
|---|---|
| `Fn8000_0001` / `Fn8000_000A` feature bits | `01-svm-intro.md` §1.2, §1.3 |
| SVM MSRs (`VM_CR`, `VM_HSAVE_PA`, `EFER.SVME`, TSC Ratio) | `01-svm-intro.md` §1.4 |
| VMCB control-area offsets | `02-vmcb.md` §2.2 |
| VMCB state-save-area offsets, segment attributes | `02-vmcb.md` §2.3 |
| Clean bits | `02-vmcb.md` §2.5 |
| Intercept vectors and bit numbers | `03-intercepts.md` §3.1 |
| IOPM / MSRPM layout | `03-intercepts.md` §3.3, §3.4 |
| **The EXITCODE table** | `05-exit-decoding.md` §5.1 |
| **All `EXITINFO1` / `EXITINFO2` layouts, `EVENTINJ`, `EXITINTINFO`** | `05-exit-decoding.md` §5.2 |
| Nested page-table entry formats, per level | `06-nested-paging.md` §6.2 |
| `TLB_CONTROL` values | `06-nested-paging.md` §6.8 |
| The offset-60h virtual interrupt control word | `07-virtual-interrupts-avic.md` §7.1 |
| AVIC backing page, APIC ID tables, AVIC exit codes | `07-virtual-interrupts-avic.md` §7.4, §7.5, §7.8 |
| IOMMU MMIO register map, Control and Status registers | `08-iommu-architecture.md` §8.2, §8.3 |
| Device Table Entry — translation side | `08-iommu-architecture.md` §8.6 |
| **Event, PPR and GA log entry formats** | `08-iommu-architecture.md` §8.8 |
| I/O page tables, GCR3, IOMMU command formats, IVRS | `09-iommu-page-tables.md` |
| **The three IRTE formats, the DTE interrupt cluster** | `10-iommu-interrupt-remapping.md` §10.1–§10.3 |
| **`Fn8000_001F` — every field**, SYSCFG | `11-memory-encryption.md` §11.2, §11.6 |
| **`SEV_STATUS` — every bit**, guest policy, SEV firmware commands | `12-sev.md` §12.6, §12.8, §12.9 |
| VMSA layout, **the GHCB layout**, NAE events | `13-sev-es-ghcb.md` §13.1, §13.4, §13.7 |
| RMP, page states, SNP instructions and their error codes | `14-sev-snp.md` §14.1–§14.4 |
| `ATTESTATION_REPORT` fields, `TCB_VERSION` | `14-sev-snp.md` §14.11 |
| CVE → mitigation matrix | `17-security.md` §17.1 |
| Every performance number | `18-performance.md` |
| Kernel / firmware / cloud versions and dates | `90-dated-landscape.md` |

## 0.4 Terminology (中英对照)

Terms where the common name and AMD's name differ. Using the wrong one makes
the specification unsearchable, which is why several of these are lint rules.

| Common / ecosystem name | AMD's name | 说明 |
|---|---|---|
| VM exit | **`#VMEXIT`** | AMD 一律写 `#VMEXIT`，带井号 |
| HPA, host physical address | **system physical address (sPA)** | AMD 不用 HPA |
| EPT (Intel) | **nested paging / nested page tables** | 对应物，不是同名物 |
| `VIRT_EXT` | **VMCB offset `0B8h`** | `VIRT_EXT` 是 Linux/KVM 的名字，APM 全文零命中 |
| `INT_CTL` | **the virtual interrupt control word at offset `60h`** | 同上；SEV-ES/SNP 语境下 AMD 叫 `VIntrCtrl`。本库的小节标题保留 `INT_CTL` 只因读者这样搜 |
| Debug Swap | **`DebugVirtualization`** | `SEV_STATUS` bit 7；"Debug Swap" 是 Linux 的名字 |
| AMD-Vi | **AMD I/O Virtualization Technology (IOMMU)** | "AMD-Vi" 在 48882 里零命中，是生态名 |
| RVI (Rapid Virtualization Indexing) | **nested paging** | 营销词，APM Vol.2 零命中；Microsoft 文档里会出现 |
| ASID (AMD) vs VPID (Intel) | — | 两者都另有 PCID；**"Intel 没有 ASID 机制"是讹传**，见 `19-comparison-intel-arm-riscv.md` |
| GUEST_FINAL / GUEST_PAGE | `EXITINFO1[33:32]` | OS 头文件的名字，AMD 只给位号 |
| `SEV_RET_WBINVD_REQUIRED` | **`WBINVD_REQUIRED`** | Linux 拼法 vs AMD Table 14 |

## 0.5 Windows PC: the questions that come up most

All five resolve in one place; go straight there.

1. **"Why can't my VMM / debugger / driver use AMD-V?"** → `16-windows-platform.md`
   §16.1. Once VBS, memory integrity, WSL2, Sandbox, Docker Desktop or the
   Hyper-V role is on, the Windows hypervisor holds `EFER.SVME` and the Windows
   kernel is itself a VTL0 guest. The CPUID and MSR probe chain will report
   everything healthy and tell you nothing about this.
2. **"Does my Ryzen support SEV?"** → `11-memory-encryption.md` §11.8 for what a
   client part actually has, and `12-sev.md` for what SEV is. The short answer is
   more specific than yes or no, and `errata.md` E12 explains why the common
   "client parts read 0" answer is wrong.
3. **"What does VBS cost me?"** → `18-performance.md` §18.2.
4. **"Can I run VMware or VirtualBox with Hyper-V enabled?"** →
   `16-windows-platform.md` §16.6. Yes, with documented limits; the old
   "turn Hyper-V off first" advice is superseded (`errata.md` E15).
5. **"Which BIOS setting is it?"** → `16-windows-platform.md` §16.7, which also
   says plainly where AMD publishes nothing and the labels are OEM-specific.

## 0.6 Reading order for someone new to SVM

Written for someone implementing a hypervisor, not browsing. Each step is one
chapter; do not read ahead.

1. `01-svm-intro.md` — how to turn it on and how to tell why it did not turn on.
2. `02-vmcb.md` — the one data structure everything else indexes into.
3. `04-world-switch.md` — VMRUN, `#VMEXIT`, and the consistency checks that will
   reject your first dozen attempts.
4. `05-exit-decoding.md` — you now have exits; this is how to read them.
5. `03-intercepts.md` — choosing which exits you get.
6. `06-nested-paging.md` — memory. Skip only if you are writing shadow paging,
   which §6.10 covers.
7. `07-virtual-interrupts-avic.md` — interrupts.

Then branch by need: `08`–`10` for device passthrough, `11`–`14` for memory
encryption and confidential computing, `15` if you will run nested, `16` if you
are on Windows — which, for this skill's target platform, you are.
