# 00. Quick Reference

> **中文速览**：本章是导航层，不是事实层。它只回答"这个东西在哪一章"——文档号索引、症状→章节的排查路由、各类表格的归属、中英术语对照，以及 Windows PC 上最常被问到的几个问题的直达答案。**这里不重复任何数值**：权威值只存在于拥有它的章节里，避免两处数字漂移。要查具体位域、编码、错误码，按下面的指针跳过去。

**Maps to:** navigation only — no normative content of its own.
**Owns:** nothing. Every fact belongs to the chapter named beside it.
**See also:** every other file.

---

## 0.1 The Intel document set

What to cite, and what each document actually governs. Revisions were read from the PDF cover pages; where intel.com's landing-page metadata disagrees, the PDF governs.

| Document | Order / Rev | Governs |
|---|---|---|
| SDM Vol.3C | 326019-092 (rev 092, 2026-06) | VMX: Ch.26–35 |
| SDM Vol.3D | 332831-092 | App.A capability MSRs · App.B VMCS field encodings · App.C basic exit reasons |
| SDM Vol.3A | 253668-092 | HLAT paging (§5.5.x), general paging |
| SDM Vol.4 | 335592-092 | MSR definitions, per-model availability |
| VT-d spec | D51397-019, **Rev 5.20** (2026-04) | IOMMU: DMA remapping, interrupt remapping, faults, registers |
| SIOV spec | 337679-002, **Rev 1.1** (2020-09) | Scalable I/O Virtualization. No later revision exists. |
| TDX Base Arch | 348549-008 (2026-05) | TDX Module architecture |
| TDX ABI | 348551-008 (2026-05) | SEAMCALL/TDCALL leaves and their numbers |
| TDX ISA ext | 343754-003 (2026-08) | TD CPU architectural extensions |
| TDX GHCI | 348552-004 (2023-03) | Guest–hypervisor communication |
| ISA Extensions Ref | 319433-062 (2026-06) | Features not yet in the SDM |
| SDM Documentation Changes | 252046-084 | Errata against the manual itself |

**Three traps.** The SDM renumbered its VMX chapters — "Virtualization of System Resources", "Handling Boundary Conditions in a VMM" and "Managing State" no longer exist, so any citation to them comes from a stale manual. The VT-d landing page still serves Rev 4.1 and shows a 2023 date. There is **no standalone VT-rp specification**; HLAT is normative only inside the SDM.

---

## 0.2 Symptom → chapter

Start here when something is broken rather than when you want to read about a topic.

| Symptom | Go to |
|---|---|
| VMXON fails | `01-vmx-intro.md` §1.4, §1.8 (IA32_FEATURE_CONTROL, CR4.VMXE) |
| VMLAUNCH/VMRESUME fails, no VM entry | `08-vmx-instructions.md` §8.4 (VM-instruction error 1–28) |
| VM entry fails with exit reason 33 or 34 | `04-vm-entry.md` §4.5, §4.9 |
| Unexpected VM exit, need to decode it | `05-vm-exit.md` §5.3 then §5.4 |
| EPT violation handling is wrong | `06-address-translation.md` §6.4 and `05-vm-exit.md` §5.4 |
| EPT misconfiguration on entry to a mapping | `06-address-translation.md` §6.4 |
| Guest loses or duplicates interrupts under APICv | `07-apic-virtualization.md` §7.6, §7.8 |
| Device DMA is blocked or faulting | `12-vtd-faults-bios-siov.md` §12.2, §12.3 |
| MSI/MSI-X not delivered after enabling remapping | `11-vtd-interrupt-remapping.md` §11.4, §11.8 |
| TLB stale after changing a mapping | `06-address-translation.md` §6.7, `10-vtd-dma-remapping.md` §10.6 |
| SEAMCALL returns an error / illegal sequence | `13-tdx.md` §13.7 |
| L1 hypervisor misbehaves under nesting | `14-nested-virtualization.md` §14.4, §14.5 |
| "VT-x is not available" on a Windows PC | `17-windows-platform.md` §17.1 — almost always Hyper-V owning VMX root |
| Driver rejected after enabling memory integrity | `15-security.md` §15.8 |
| A performance number needs defending | `16-performance.md` §16.1 |

---

## 0.3 Where the tables live

No values are reproduced here. Each row says which chapter owns the authoritative table.

| Table | Owner |
|---|---|
| VMCS field encodings (16/64/32/natural-width × control/read-only/guest/host) | `02-vmcs.md` §2.5 |
| Pin/primary/secondary/tertiary VM-execution control bits | `02-vmcs.md` §2.8 |
| VM-entry check list, in SDM order | `04-vm-entry.md` §4.3–§4.5 |
| Basic exit reasons | `05-vm-exit.md` §5.3 |
| Exit qualification formats | `05-vm-exit.md` §5.4 |
| EPT paging-structure entry bits, per level | `06-address-translation.md` §6.3 |
| EPT misconfiguration conditions | `06-address-translation.md` §6.4 |
| INVEPT / INVVPID descriptors and types | `06-address-translation.md` §6.7, `08-vmx-instructions.md` §8.5 |
| Virtual-APIC page offsets, posted-interrupt descriptor | `07-apic-virtualization.md` §7.4, §7.8 |
| **VM-instruction error numbers 1–28** | `08-vmx-instructions.md` §8.4 |
| VMX capability MSRs | `08-vmx-instructions.md` §8.6 |
| DMAR register map and bit fields | `10-vtd-dma-remapping.md` §10.5 |
| VT-d translation structure formats | `10-vtd-dma-remapping.md` §10.4 |
| IRTE formats, remapped and posted | `11-vtd-interrupt-remapping.md` §11.4, §11.5 |
| **VT-d fault reason codes** | `12-vtd-faults-bios-siov.md` §12.3 |
| ACPI DMAR subtables | `12-vtd-faults-bios-siov.md` §12.5 |
| SEAMCALL `TDH.*` / TDCALL `TDG.*` leaves with leaf numbers | `13-tdx.md` §13.5, §13.6 |
| Secure-EPT states | `13-tdx.md` §13.8 |
| Mitigation MSR addresses and bit definitions | `15-security.md` §15.4.1 (IA32_SPEC_CTRL 48H, IA32_PRED_CMD 49H, IA32_FLUSH_CMD 10BH, IA32_TSX_CTRL 122H, IA32_MCU_OPT_CTRL 123H), §15.4.2 (IA32_ARCH_CAPABILITIES 10AH) |
| CVE → mechanism → mitigation matrix | `15-security.md` §15.5 |
| Intel ↔ AMD ↔ ARM ↔ RISC-V correspondences | `18-comparison-amd-arm-riscv.md` §18.10 |

---

## 0.4 Terminology

English is normative — it matches SDM wording. Chinese is provided because the misconceptions this skill corrects circulate mostly in Chinese.

| English (normative) | 中文 | Note |
|---|---|---|
| VMX root operation / VMX non-root operation | VMX 根操作 / 非根操作 | Not "host mode / guest mode" |
| VM entry / VM exit | VM 进入 / VM 退出 | Hyphenated as `VM-exit` when attributive |
| VMCS | 虚拟机控制结构 | Opaque; only VMREAD/VMWRITE may touch it |
| guest-physical address (GPA) | 客户物理地址 | Distinct from host-physical |
| EPT / extended page tables | 扩展页表 | Second-dimension translation |
| EPT violation / EPT misconfiguration | EPT 违例 / EPT 配置错误 | Two different exits, two different causes |
| VPID | 虚拟处理器标识符 | VM-scope tag. Intel also has **PCID** (process scope) |
| APICv | APIC 虚拟化 | Umbrella for several independent controls |
| posted interrupt | 投递中断 / 发布中断 | Descriptor lives in memory |
| MBEC (mode-based execute control) | 基于模式的执行控制 | Kaby Lake, **not** Skylake |
| PML (page-modification logging) | 页修改日志 | Broadwell Xeon 2015, **not** Skylake |
| SEAM | 安全仲裁模式 | The mode TDX runs in |
| VTL0 / VTL1 | 虚拟信任级别 | Windows/Hyper-V concept, not an Intel one |
| HVCI | 内存完整性 | Enforces W^X on kernel pages via EPT |

---

## 0.5 Windows PC: the five questions that come up most

Answers are one line plus the chapter that proves them.

1. **"Why can't my VMM/driver/debugger use VT-x?"** — Because Hyper-V already owns VMX root operation. Enabling VBS, WSL2, Sandbox, Docker Desktop or the Hyper-V role makes the Windows kernel itself a VTL0 guest. → `17-windows-platform.md` §17.1
2. **"Is my third-party VM running nested?"** — On a VBS-enabled machine, yes: it runs through the Windows Hypervisor Platform on top of Hyper-V. → `17-windows-platform.md` §17.3, `14-nested-virtualization.md` §14.12
3. **"Why was my driver rejected after enabling memory integrity?"** — HVCI enforces W^X on kernel code pages through EPT; unsigned or self-modifying code cannot get an executable mapping. → `15-security.md` §15.8
4. **"How much does VBS cost me?"** — The public figures disagree and none carries full measurement conditions; they are presented side by side rather than averaged. → `15-security.md` §15.12, `16-performance.md` §16.3
5. **"Does my PC have TDX?"** — No. TDX is Xeon-only; there is no client implementation. → `13-tdx.md`, `18-comparison-amd-arm-riscv.md` §18.11

---

## 0.6 Reading order for someone new to VMX

`01` → `02` → `03` → `04` → `05` gives the complete control-flow picture: how VMX is entered, what the control structure holds, what the guest may do, how entry works, how exit works. Add `06` for memory and `07` for interrupts. Everything else is applied on top of those seven.
