# intel-vt 重构工作契约

所有章节作者（人或 agent）必须遵守本文件。lint 按此校验。

---

## 0. 目标平台：Windows PC（2026-09-20 确定）

本技能面向 **Windows PC**，且**嵌套虚拟化必须保留**（用户明确要求）。

这条如何影响各章：

- **硬件架构章 `01`–`12` 不受影响**。VMX/VMCS/EPT/VPID/APICv/VT-d 是 CPU 与芯片组规范，与操作系统无关，照常按 Intel 官方文档写。
- **`13-tdx.md` 标记为服务器范围**。TDX 只存在于 Xeon，客户端 PC 上没有。文件保留，但开头必须写明"服务器/机密计算专题，客户端 Windows PC 上不存在；仅在问题涉及 Xeon/TDX 时阅读"。
- **`14-nested-virtualization.md` 权重上升**。在 Windows PC 上嵌套不是服务器特性而是常态：只要开启 VBS / WSL2 / Windows Sandbox / Docker Desktop / Hyper-V，Hyper-V 就占据 VMX root operation，Windows 内核本身以 guest 身份运行，其他 VMM 一律经 WHP 嵌套运行。
- **`15-security.md` 权重上升**。VBS / HVCI / Credential Guard / Kernel DMA Protection / System Guard 是 Windows 原生主题，本章拥有它们。
- **`16-performance.md` 改为 Windows PC 开销**：VBS/HVCI 对客户端与游戏的影响、WSL2 与实用 VM 的开销、第三方 VMM 跑在 WHP 之上 vs 裸 VMX、PC 上的嵌套开销。删除云规模整合、NFV、数据中心能耗。
- **`17-software-ecosystem.md` 更名为 `17-windows-platform.md`**，改为 Windows 优先：Hyper-V 架构（root/child partition、hypercall ABI、VMBus、VP assist page、synthetic MSR、VTL0/VTL1）、WHP/WHPX、WSL2、Windows Sandbox、Docker Desktop、Defender Application Guard、Kernel DMA Protection、反作弊与 hypervisor 存在性检测（CPUID leaf 0x40000000）。KVM/Xen/ESXi 降为末尾一节的对照。
- **`18-comparison-amd-arm-riscv.md` 保留**架构对比，去掉服务器/云框架与全部市场数据；标注哪些特性是服务器专属、客户端 PC 上不存在。
- **`90-dated-landscape.md` 重心转移**：砍掉云厂商实例族与市场份额，改为 Windows 版本与默认策略、固件/BIOS 状态、客户端芯片（Panther Lake 等）。服务器与云内容可保留精简的一节，标注为服务器范围。

Windows 事实一律**直接引用 Microsoft Learn 作为 T2**，不引博客转载。

---

## 1. Claim 记录 schema

每条事实断言写成一行：

```
- **Claim.** <断言正文>  `[SDM 3C §27.9.1]` `[42]` `C:high` `V:durable`
```

字段顺序固定：一级锚点 → bibliography ID → 置信度 → 时效性。

- **一级锚点**：`01`–`14` 章的架构类断言**必填**。格式见 §2。
- **`[N]`**：bibliography 引用 ID。每条断言至少一个。多个引用写成 `` `[42]` `[43]` ``（各自加反引号）或 `` `[42][43]` ``（同一对反引号内），两种 lint 都接受。
- **`C:`**：`high` | `medium` | `low`。只用英文。
- **`V:`**：`durable` | `dated`。`V:dated` **只允许**出现在 `90-dated-landscape.md`。

叙述性散文不需要 claim 行，但**任何具体的数值、位号、编码、日期、CVE 编号、产品名都必须在某条 claim 行里**，不能只躺在散文里。

`Excerpt` 只在断言有争议或表述微妙时加，作为 claim 行下方的缩进引用块。

---

## 2. 一级锚点格式（严格）

| 文档 | 锚点写法 | 示例 |
|---|---|---|
| SDM Vol.3C | `[SDM 3C §<sec>]` 或 `[SDM 3C Ch.<n>]` | `[SDM 3C §27.9.1]` |
| SDM Vol.3D 附录 | `[SDM 3D App.<X>]` 或 `[SDM 3D §<sec>]` | `[SDM 3D App.B]` |
| SDM Vol.3A/3B | `[SDM 3A §<sec>]` | `[SDM 3A §5.5.1]` |
| SDM Vol.4 | `[SDM 4 §<sec>]` | `[SDM 4 §2.17]` |
| VT-d 规范 | `[VT-d 5.20 §<sec>]` / `Ch.<n>` | `[VT-d 5.20 §7.2]` |
| TDX Base Arch | `[TDX-BASE §<sec>]` | `[TDX-BASE §2.1]` |
| TDX ABI | `[TDX-ABI §<sec>]` | `[TDX-ABI §3.4]` |
| TDX ISA 扩展 | `[TDX-ISA §<sec>]` | `[TDX-ISA §2]` |
| TDX GHCI | `[TDX-GHCI §<sec>]` | `[TDX-GHCI §3]` |
| TDX SEAMLDR | `[TDX-SEAMLDR §<sec>]` | `[TDX-SEAMLDR §2]` |
| ISA 扩展参考 | `[ISAEXT §<sec>]` | `[ISAEXT §3.1]` |
| SIOV 规范 | `[SIOV §<sec>]` | `[SIOV §3]` |

### 绝对禁止：编造章节号

**这是本次重构最大的风险。** 旧版技能的问题是引了博客；新版如果凭记忆写 SDM 章节号，会造出"看起来像官方来源"的错误引用，**更难被发现、危害更大**。

规则：

1. **只写你实际核对过的章节号。** 核对方式：WebFetch 真实 PDF，或引用下方 §5 已核验清单。
2. **核对不了就降级到章节级**：写 `[SDM 3C Ch.30]` 而不是猜 `§30.2.3`。章节号在 §5 中已全部核验，可放心使用。
3. **连章节都不确定**：写 `[SDM 3C Ch.?]` 并置 `C:low`，lint 会标出来待人工处理。**不要删掉锚点假装它是二级事实。**
4. SDM 章节号跨修订版被重编过。`Virtualization of System Resources`、`Handling Boundary Conditions in a VMM`、`Managing State` 在 rev 092 中**已不存在**。任何旧资料（含 2017 年镜像、中文译文）里的章节号一律作废。

---

## 3. 来源分级

- **Tier 1 规范性**：Intel SDM / VT-d spec / TDX 文档集 / ISA Extensions Reference / SIOV / Intel 安全公告。
- **Tier 2 佐证**：kernel.org、LKML、同行评议论文、厂商官方文档（Microsoft Learn、VMware 官方文档、AMD APM、ARM ARM、RISC-V 规范）。
- **Tier 3 背景**：博客、新闻、营销材料。

规则：

- `01`–`14` 章的每条架构断言**必须**至少一条 T1。
- T3 **永不得**作为架构断言的唯一出处，且必须以归属语气陈述（"Intel 称…"/"厂商称…"/"据 XX 报道"）。
- 旧版中指向 `xem.github.io`、看雪、CSDN、博客园、掘金、百度百科的架构类引用**一律作废**——重新锚定到 T1，锚定不了就删掉该断言。

---

## 4. bibliography ID 区段（避免并行写入冲突）

`references/bibliography.md` 是唯一共享写入点。各章只在自己的区段内分配新 ID，**不得改动他人区段**。

| 区段 | 归属 |
|---|---|
| 1–40 | Intel 官方 T1（**已预置，只读，见 §5**） |
| 41–99 | 其他官方规范 T2（AMD APM / ARM ARM / RISC-V / PCIe 等） |
| 100–199 | `01`–`09` VMX 各章 |
| 200–249 | `10`–`12` VT-d |
| 250–299 | `13` TDX |
| 300–349 | `14` 嵌套 |
| 350–399 | `15` 安全 |
| 400–449 | `16` 性能 |
| 450–499 | `17` 生态 |
| 500–549 | `18` 横向对比 |
| 550–599 | `90` 时效区 |
| 600–649 | `errata.md` |

条目格式（一行一条）：

```
[42] <作者或机构>. <标题>. <版本/修订>. <日期>. <URL> — T1|T2|T3
```

---

## 5. 已核验的 Intel 官方文档基线

**以下内容经直接读取 Intel PDF 封面 / 书签树核验，可直接引用，不必重新核对。**

### SDM — rev 092, 2026-06

| Vol | 标题 | Order |
|---|---|---|
| 合订 | — | 325462 |
| 3A / 3B / **3C** / 3D | System Programming Guide Pt 1–4 | 253668 / 253669 / **326019** / 332831 |
| 3 合订 | System Programming Guide | 325384 |
| 4 | Model-Specific Registers | 335592 |

**VMX 章节（rev 092，Vol.3C）：**

| Ch | 标题 |
|---|---|
| 26 | Introduction to Virtual Machine Extensions |
| 27 | Virtual Machine Control Structures |
| 28 | VMX Non-Root Operation |
| 29 | VM Entries |
| 30 | VM Exits |
| 31 | VMX Support for Address Translation |
| 32 | APIC Virtualization and Virtual Interrupts |
| 33 | VMX Instruction Reference |
| 34 | System Management Mode |
| 35 | Secure Arbitration Mode (SEAM) |

**Vol.3D 附录：** App.A = VMX Capability Reporting Facility；**App.B = Field Encoding in VMCS**；**App.C = VMX Basic Exit Reasons**。

**Ch.27 节级结构（已核验）：** 27.1 Overview · 27.2 Format of the VMCS Region · 27.3 Organization of VMCS Data · 27.4 Guest-State Area（.1 Register / .2 Non-Register）· 27.5 Host-State Area · 27.6 VM-Execution Control Fields（.1 Pin-Based · .2 Processor-Based · .3 Exception Bitmap · .4 I/O-Bitmap Addresses · .5 TSC Offset/Multiplier · .6 CR0/CR4 Masks & Shadows · .7 CR3-Target · .8 APIC Virtualization · .9 MSR-Bitmap · .10 Executive-VMCS Ptr · .11 EPTP · .12 VPID · .13 PAUSE-Loop Exiting · .14 VM-Function Controls · .15 VMCS Shadowing Bitmaps · .16 ENCLS-Exiting · .17 PCONFIG-Exiting · .18 Page-Modification Logging · .19 Virtualization Exceptions · .20 XSS-Exiting · .21 SPPTP · .22 HLAT fields · .23 PASID Translation · .24 Instruction-Timeout · .25 IA32_SPEC_CTRL virtualization · .26 SEAM Non-Root · .27 APIC-Timer Virtualization）· 27.7 VM-Exit Control Fields · 27.8 VM-Entry Control Fields · 27.9 VM-Exit Information Fields（.1 Basic —— **Exit Reason 与 Exit Qualification 在此定义** · .2 Vectored Events · .3 During Event Delivery · .4 Instruction Execution · .5 VM-Instruction Error）· 27.10 VMCS Types: Ordinary and Shadow · 27.11 Software Use of the VMCS

**Ch.30 节级结构（已核验）：** 30.1 Architectural State Before a VM Exit · 30.2 Recording VM-Exit Information（.1 Basic · .2 Vectored Events · .3 NMI Unblocking Due to IRET · .4 During Event Delivery · .5 Instruction Execution）· 30.3 Saving Guest State · 30.4 Saving MSRs · 30.5 Loading Host State · 30.6 Loading MSRs · 30.7 VMX Aborts · 30.8 Machine-Check Events During VM Exit · 30.9 User-Interrupt Recognition After VM Exit

**App.B 分组（已核验）：** B.1 16-Bit（control/guest/host）· B.2 64-Bit（control/read-only/guest/host）· B.3 32-Bit（control/read-only/guest/host）· B.4 Natural-Width（control/read-only/guest/host）

**App.A 分组（已核验）：** A.1 Basic … A.3.4 Tertiary Processor-Based Controls · A.4.2 Secondary VM-Exit Controls · A.10 VPID/EPT · A.11 VM Functions

> 注：`Exit Qualification` 不是书签级标题——它定义在 §27.9.1，按 §30.2.1 填充。引用时用这两个节号，不要写 `§xx Exit Qualification`。

### VT-d — Rev 5.20, 2026-04, Order D51397-019

章节（已核验）：1 Introduction · 2 Overview · 3 DMA Remapping · 4 Support For Device-TLBs · 5 Interrupt Remapping · 6 Caching Translation Information · 7 Address Translation Faults · 8 BIOS Considerations · 9 Translation Structure Formats · 10 Performance Monitoring · 11 Register Descriptions · App.A Snoop and Memory Type

> **陷阱**：intel.com 落地页元数据陈旧（显示 2023-03-22，`getContent/774206` 仍返回 Rev 4.1）。以 PDF 封面为准。

### TDX 文档集

| 文档 | Order-Rev | 日期 |
|---|---|---|
| TDX Module Base Architecture Spec | 348549-008 | 2026-05 |
| TDX Module ABI Spec | 348551-008 | 2026-05 |
| TD CPU Architectural Extensions (ISA) | 343754-003 | 2026-08 |
| TDX SEAMLDR Interface Spec | 343755-004 | 2025-05 |
| GHCI v1.5 | 348552-004 | 2023-03-17 |
| TDX Connect Arch Spec | 354629-**003** | 2025-06 |
| TD Migration Arch Spec | 348550-008 | 2026-06 |
| TD Partitioning Arch Spec | 354807-006 | 2026-05 |

### 其他

- **ISA Extensions & Future Features**：319433-062, 2026-06。
- **SDM Documentation Changes**（手册自身勘误）：252046-084。
- **SIOV**：337679-002 **Rev 1.1**（2020-09，封面为准；流传的 "Rev 1.0" 是错的），无更新，陈旧但现行。
- **VT-rp / HLAT**：**无独立规范**。规范性内容仅在 SDM §5.5.1 / §5.5.3 / §5.5.5（Vol.3A）、§27.6.22（VMCS 字段）、§31.2（HLAT）。不要引用不存在的 "VT-rp spec"。

---

## 6. 章节文件模板

```markdown
# <NN>. <English Chapter Title>

> **中文速览**：3–5 句，说明本章覆盖什么、什么时候该读它、与哪几章相邻。

**Maps to:** Intel SDM Vol.3C Ch.NN "<official chapter title>" (rev 092) [1]
**Owns:** <本章独占的事实主题，见 §7>
**See also:** `<other-file>.md` §N

---

## N.1 <Section>

<English prose.>

- **Claim.** ...  `[SDM 3C §27.1]` `[1]` `C:high` `V:durable`
```

正文英文；每章开头一段中文速览；术语与 SDM 原文逐字对齐（不要把 `VM-exit` 写成 `VM Exit`，不要把 `guest-physical address` 意译）。

---

## 7. 事实归属（owner）

每条事实只有一个 owner 文件，其他文件**交叉引用而不复述**。

| 主题 | owner |
|---|---|
| VMCS 结构 / 执行·退出·进入控制 / VMFUNC / VMCS shadowing 位 | `02` |
| VM-entry 检查与流程 | `04` |
| VM-exit 原因、qualification、信息字段 | `05` |
| EPT 结构 / VPID / PML / SPP / HLAT | `06` |
| APICv / posted-interrupt descriptor | `07` |
| VMX 指令语义与 VM-instruction error | `08` |
| SMM 与 SEAM | `09` |
| IRTE 与中断重映射 | `11` |
| 全部 TDX（含 CVE-2025-30513、TDXRay） | `13` |
| 嵌套机制 | `14` |
| VBS / HVCI / CVE→缓解位矩阵 | `15` |
| AMD / ARM / RISC-V 对照 | `18` |
| 云厂商状态、市场份额、路线图、GA 日期 | `90` |

---

## 8. 必须修正的已知错误

迁移中遇到以下说法一律按右侧改正，并确保 `errata.md` 有对应条目：

| 讹传 | 正确 |
|---|---|
| EPT violation qualification bit 7 = GPA 有效 | **guest-linear-address valid** |
| EPT violation qualification bit 6 = XD 之与 | **user-mode execute 之与**（仅 MBEC=1 时有效） |
| ZombieLoad = CVE-2019-11091 | **CVE-2018-12130 (MFBDS)** |
| Intel 无 ASID 机制 | Intel 用 **PCID**（进程）+ **VPID**（VM）两套标识 |
| 首批 VMX 处理器仅支持 bit 1/2/4 的 1-setting | 按 SDM **default-1 保留位**规则重写 |
| MBEC = Skylake | **Kaby Lake** |
| PML = Skylake | **Broadwell Xeon (2015)** |
| EPT 最坏 20 次访存 | **24 次** |
| OoH = SOSP'22 | **SC'22** |

待裁决（需查证后写入 errata）：FlexPriority 首发代际（2006–2007 Merom/Penryn vs 2008 Xeon 7400）、VT-d 1.0 日期（2006-03 vs 2006-08）、TDX 加密算法按代际（AES-128 vs AES-256）、VBS 开销（6% / 5–10% / 5–25%，需附测量条件）、H100+TDX 研究的正确 arXiv 编号、OoH 的 13×/16× vs 14%/0.5%。

---

## 9. 源材料

旧版 15 个文件在 `.scratch/intel-vt-refine/_source/`。**当作线索，不当作事实**：其中的架构引用大多指向 2017 年 SDM 镜像与中文转述，必须重新锚定。其中的一手来源（kernel.org、LKML、论文、Intel 官方页面）可以保留并升级为 T2/T1。
