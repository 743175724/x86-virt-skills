# 08 · `08-iommu-architecture.md` + `09-iommu-page-tables.md` + `10-iommu-interrupt-remapping.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **270–329**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D7, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**这是全库缺口最大的区域。** 旧版三章的结构表几乎全部来自 OSDev Wiki、专利申请、术语农场站与 2007 年的旧版规范（PID 34434 Rev 1.20），且只有字段名没有位号。本票要求全部对着 **AMD I/O Virtualization Technology (IOMMU) Specification #48882 的现行修订版**重建。

## `08-iommu-architecture.md`

**Maps to:** **IOMMU 48882-PUB Rev 3.11**（2026-04）Ch.1 IOMMU Overview · **§2.2.2 Device Table**（Figure 7 "Device Table Entry (DTE) Fields"）· **§3.4 MMIO 寄存器**（能力块 §3.2/§3.3、VF 控制 §3.5/§3.6）。**该规范只有 5 章、零附录——`[IOMMU … App.x]` 是编造。**
**Owns:** 平台数据通路 · MMIO 寄存器 · PCI 能力块 · Device Table Entry。

1. **平台数据通路按 Zen 重写**。旧版是 2007 年的描述（"经 HyperTransport 接入 I/O Hub，IOMMU 集成在 I/O Hub 内部"）——在 AM4/AM5/SP5 上 IOMMU 位于 SoC 内的 NBIO/IOD，没有 HyperTransport、没有 I/O Hub。这条直接影响 Windows PC 读者。
2. **MMIO 寄存器表 + 每个寄存器的位定义**。旧版有偏移、零位定义。至少覆盖：Device Table Base Address（含 `Size` 域）、Command Buffer Base、Event Log Base、PPR Log Base、GA Log Base、**Control Register（IommuEn(0)、EventLogEn(2)、EventIntEn(3)、CmdBufEn(12)、PPRLogEn(13)、PprEn(15)、GTEn(16)、GAEn(17)、XT、IRTCacheDis、SNPAVICEn…）**、**Status Register（含 `CmdBufRun`）**、Extended Feature Register 与 EFR2 逐位、Exclusion Base/Limit、各 head/tail 指针。
3. **MMIO 窗口大小 = 16 KiB (0x4000)**（errata：旧版写 14 KiB）。`CmdBufRun` 是 **Status Register(0x2020) bit 4 的只读位**，启动命令处理的是 **Control Register bit 12 `CmdBufEn`**（errata：旧版把两者混为一谈）。
4. **DTE 的 256 位逐位布局**。旧版只有 dword 内的字段排序，无法构造也无法解码。必须给出 V、TV、Mode(host page table level)、Page Table Root Pointer、DomainID、IV、IntTabLen（含 `entries = 2^IntTabLen` 编码）、Interrupt Table Root Pointer、IntCtl、GV、GLX、GCR3 Table Root（分片存放）、PPR、GIoV、GuestPagingMode、SysMgt、SNP、SATS、Cache、EX/SD/SE/I 等每一位的位号与语义。
5. PCI 配置空间中的 IOMMU 能力块（Capability ID 0x0F）。
6. Open items。

## `09-iommu-page-tables.md`

**Maps to:** IOMMU 3.11 **§2.2.3**（host I/O 页表）· **§2.2.6**（guest）· **§2.2.7**（guest/nested）· **§2.4 命令**（2.4.1 COMPLETION_WAIT … 2.4.8 INVALIDATE_IOMMU_ALL、2.4.9 INSERT_GUEST_EVENT、2.4.10 RESET_VMMIO、2.4.11 Ordering Rules）· **§2.5 事件日志码**（2.5.2 ILLEGAL_DEV_TABLE_ENTRY … 2.5.14 RMP_PAGE_FAULT、2.5.15 RMP_HARDWARE_ERROR）· **§5.2 IVRS** · **§5.3 IVHD/设备树**。
**Owns:** v1 / v2 I/O 页表 · GCR3 表 · 命令 · 事件/PPR/GA 日志条目格式 · IVRS。

1. **host (v1) 页表**：PDE 与 PTE 的区分（旧版没有区分）、逐位表、NextLevel(11:9) 编码与默认页大小规则、4/5/6 级的 Mode 编码。
2. **guest (v2) 页表**：格式与 x86-64 分页的关系、GCR3 表项格式、GLX 索引层级。
3. **命令格式**：每条命令给 opcode（bits 63:60）与完整字段布局 —— COMPLETION_WAIT（S/I/F 位、store address/data）、INVALIDATE_DEVTAB_ENTRY、INVALIDATE_IOMMU_PAGES（S/PDE/GN 位与地址编码）、INVALIDATE_IOTLB_PAGES、INVALIDATE_INTERRUPT_TABLE、PREFETCH_IOMMU_PAGES、COMPLETE_PPR_REQUEST、INVALIDATE_ALL。旧版只有一句散文列了八个名字。
4. **事件日志条目格式**（16 字节、DeviceID 位置、EventCode 位置、类型相关字段与标志）+ 现有的 14 个事件码表（0x1–0xE）。旧版只有码表，没有条目格式，唯一的"例子"是一行 dmesg。
5. **PPR 日志条目格式**与 **GA 日志条目格式**。
6. **IVRS 解析**：表头与 IVinfo 域（EFRSup、DmaGuestApicSupport、GVASize/PASize/VASize）、IVHD 类型 10h/11h/40h 的差异、**设备条目长度规则**（type <40h → 4 字节、40h–7Fh → 8 字节、**80h–FFh 为变长**——核验更正：初稿写的"80h–BFh → 16 字节"是错的，按变长处理）、设备条目类型（0 padding、1/2/3/4、42h/43h/48h、F0h ACPI HID + UID）、**IVMD 类型码 20h/21h/22h**（旧版该行整行是空的）。
7. Open items。

## `10-iommu-interrupt-remapping.md`

**Maps to:** IOMMU 3.11 **§2.2.5 Interrupt Remapping Tables**；相邻新章节 §2.10 vIOMMU · §2.12 IOMMU SEV-SNP Support · §2.14 SEV-TIO。
**Owns:** IRTE（两种格式）· GA log 语义 · GAPPI · ATS / PRI / PASID。

1. **legacy 32-bit IRTE 完整字段**：**`RemapEn`(0)**（errata：旧版全篇写成 `RemapEm`，还进了小节标题）、SupIOPF(1)、IntType(4:2) 与编码、RqEoi(5)、DM(6)、GuestMode(7)、Destination(15:8)、Vector(23:16)。
2. **128-bit GA / guest-vAPIC IRTE 完整字段**：IsRun、GATag、GALogIntr、GA Root Pointer、Destination(32 位，XT 模式)、GAPPIDis 等。**旧版完全没有这个格式**，而它是 AVIC 直通中断的核心。
3. **中断重映射流程**：从 MSI/MSI-X 报文到 IRTE 查找到投递，DTE 中 IntCtl/IV/IntTabLen 的参与方式。
4. **GA log 与 GAPPI**：guest vAPIC 未运行时的唤醒路径，三代演进的机制差异（**本条在全库只此一处**，`07` 交叉引用本章；旧版在 05 与 07 各讲一遍）。
5. **ATS / PRI / PASID**：ATS Translation Request/Completion 字段、Invalidate Request/Completion 协议、PRI Page Request Group / Response 报文、PASID TLP 前缀。旧版各一段散文，唯一来源是三星博客。
6. **MSI 欺骗与中断重映射的安全价值**：保留论证，但锚点换成正确拼写的 `RemapEn` 与官方规范。
7. **Scope 标注**：客户端 AM4/AM5 上 AMD-Vi 始终存在（与芯片组无关）、BIOS 默认值、与 Above 4G Decoding/ReBAR 的交互；**SR-IOV 在消费级平台不存在**——SR-IOV 内容降级为一节并标注服务器范围。
8. Open items。

## 明确移出这三章

- Linux `amd_iommu` 内核参数、`/sys/kernel/iommu_groups`、vfio-pci 绑定、vendor-reset、Proxmox 操作流程 → 标注 **Linux-only** 的对照小节（可放 `16` 的末尾或独立小节），不作为主线。
- "IOMMU groups" 必须显式说明是 Linux/VFIO 的内核构造，不是 AMD 架构概念（errata 级别的常见误解）。
- strict vs lazy 失效默认值、"约 5% DMA 开销"、内核版本、2024–2026 主线动向、X870E/AGESA 事件 → `90` 与 `18`（且必须带条件）。
- Windows 侧的 Kernel DMA Protection、DDA/GPU-P、VBS 对 IOMMU 的依赖 → `16-windows-platform.md`。

## 完成判据

- lint 零 error；三章中不出现 `RemapEm`、不出现 "14 KiB"、不出现 HyperTransport/I-O Hub 拓扑描述。
- 每张结构表都有位号；只有字段名的表视为未完成。
- 引用链路中不出现 OSDev Wiki、Justia 专利、termbasehub、DeepWiki，也不以 34434 Rev 1.20 作为现行断言的出处。
- 抽查：给一个 DTE 的十六进制转储，能靠本章解码出 DomainID 与页表级数。

---

## 复检补充：三章按"读者任务"重切

复检按三类真实读者做了穿行测试，结论是原切法对其中两类都要跨文件。**重切如下**（spec §D1 已同步改）：

- **`08` = "硬件此刻在做什么"**：平台数据通路、MMIO 寄存器全位、**Status Register**、PCI 能力块、DTE 的**转换侧**字段，**外加事件日志 / PPR 日志 / GA 日志的条目格式**（从 `09` 移入——它们必须和指向它们的寄存器、以及日志本身出问题时要读的 Status Register 在一起）。另补**分段 Device Table**（MMIO 0x0100–0x0130 的 Segment 1–7 基址寄存器）与 **IOMMU 请求类型路由规则**（内存 / 中断 / port-I/O / IOMMU 自身发起）。
- **`09` = "我要建的表"**：v1/v2 页表、GCR3、命令格式、IVRS 解析，**外加一节"端到端解一个 `IO_PAGE_FAULT`"**，内联涉及的 5 个 DTE 位。并补一条用户高频命中的事实：**`IO_PAGE_FAULT` 不可恢复**——没有办法重启那次访问，所以设备可能触及的每一页都必须先映射好；非 ATS 的失败以 UR/CA 结束或被直接丢弃。这是"为什么我的直通设备直接死掉而不是重试"的答案。
- **`10` 自足**：两种 IRTE + **DTE 的中断簇**（`IV`、`IntTabLen` 及 `2^n` 编码、`IntCtl`、Interrupt Table Root Pointer、`InitPass`/`NMIPass`/`EIntPass`/`Lint0Pass`/`Lint1Pass`）+ `INVALIDATE_INTERRUPT_TABLE` + **GA log 的格式与语义**（不再拆在 `09`）+ GAPPI + ATS/PRI/PASID。

**硬件加速 vIOMMU（§2.10）是耐久架构，不是时效内容。** 初稿把它随"2024–2026 主线动向"一起发配到 `90`——那是按它在旧文件里的邻居判断，不是按事实本身判断。guest MMIO 0x2000–0x2FFF 由硬件服务、配置区仍由软件模拟、DeviceID/DomainID 映射表——这些明年仍然成立，归 `08`/`10`。

**执行单元**：`08`（bib 270–289）、`09`（290–309）、`10`（310–329），可独立认领与提交。
