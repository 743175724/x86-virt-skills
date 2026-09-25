# 02 Intel 10 代 → Core Ultra 300：虚拟化相关世代差异 + 规范来源

Type: research output
Ticket: `.scratch/virt-skills-v2/issues/02-intel-gen-matrix.md`
Date: 2026-09-26
Scope: **客户端部件 only**。Xeon / 服务器在本 effort 的 Out of scope 内，仅在"某特性只在服务器出现"这类
**限定性否定声明**里作为对照出现。

---

## TL;DR —— 给 ticket 09 设计型号轨道的人

**六个维度全部有一手来源，没有一条是推断出来的表。** 最该带走的八条：

1. **`06_C6H` stepping 2（`CPUID.01H:EAX = C0662h`）就是 265KF。**
   SDM-V4 Table 2-1 与 Arrow Lake Specification Update `834774-023` Table 2-1
   **两份独立 Intel 文档互证**。全部 10 代客户端的 DF_DM + stepping 表见 **§1.4**。
2. **14 代与 13 代在 CPUID 上不可区分**（`740518-031` 把 RPL-S 与 RPL-S Refresh 列为同一个 `B0671h`），
   而**一颗 10 代 Comet Lake U 4+2 报的是 `06_8EH`，与 Kaby Lake 相同**。
   → **市场名 ↔ CPUID 不是一一映射，必须有显式映射层。见 §1.5。**
3. **"P/E 核 CPUID 不一致"这句话是半对的。** SDM rev 093 新增 **§21.1.4 "CPUID Domains"**，
   给每个 CPUID 字段标注 Platform / Package / Logical Processor 域：
   **ISA 功能位（含 `CPUID.01H:ECX[5] VMX`、AVX-512）是 Platform 域，必须全平台一致；
   cache(`04H`) / 拓扑(`1FH`) / native model ID(`1AH`) 是 Logical Processor 域，明文允许不同。**
   **这条 Domain 列就是所有"哪些能不一样"问题的裁决依据。见 §3.2。**
4. **ESXi PSOD 是 ESXi 的假设问题，不是硅片不一致。** 它 panic 的三个 feature
   （`"Hyperthreads per core"` / `"Cores per package"` / `"Cores per die"`）**全是拓扑计数**，
   落在 SDM 明文允许不一致的 Logical Processor 域；第四个 `"Intel processor platform type identifier"`
   比的是 MSR `17H` 的 **Reserved 位**。修法是 `cpuUniformityHardCheckPanic=FALSE`（Broadcom KB **395554**），
   **但 VMware 明说调度器层面依然不支持**。见 **§8.6**。
5. **`IA32_VMX_*` 从未被 SDM 列为逐核型差异项**（Table 2-47/2-48/2-54/2-55/2-59/2-60 中无 `48xH`）——
   但 SDM 也**没有正面承诺其取值跨核型一致**。逐核型差异集中在
   **perfmon / prefetch / L2 QoS 掩码**，其中 `D18H`–`D1FH` **在 E 核可用、在 P 核 #GP**。见 §3.3 / §3.4。
6. **SDM 对"微码 + VMX"确实有话说，但只说了一半**：
   Vol.3C §28.3 —— "**no microcode update is loaded … This implies that microcode updates cannot be
   loaded in VMX non-root operation**"（**静默 no-op，不 fault**）；
   Vol.4 Table 2-2 条目 79H —— VM-entry/exit 的 MSR 区域也可能被拒。
   **对 VMX root operation 则只字未提**——这个沉默本身是结论。见 §5.1 / §8.7.6。
7. **SMT 的破坏点是 12 代，不是 Arrow Lake。** 从 12 代起 P 核 2 LP、E 核 1 LP，
   `LP = 2 × 核` 已经失效；Arrow Lake / Lunar Lake 只是把比例统一回 1:1。
   `CPUID.01H:EDX[28] HTT` **不是 SMT 标志**（它只表示 `EBX[23:16]` 有效）。见 §4。
8. **VT-d 能力的世代断点在 Meteor Lake，不在 LGA1851。** Alder/Raptor Lake 的
   "IGD 引擎不支持 super-page，开核显时 BIOS 应把 default 引擎的 super-page 也关掉"，
   在 Meteor Lake 起消失，同时新增 Scalable Mode 与 Nested translation。
   **按 socket 建键会答错。见 §6.3。**

**缺口规模**：**22 条未决 + 3 条本次关闭**（G1 stepping 表、G8 LGA1700→1851 VT-d 差异、G12 客户端 SR-IOV）。
未决的 22 条里，**4 条（G2 / G3 / G3b / G4）在 265KF 上各用一条 RDMSR 就能关掉**，
**3 条（G7 / G1b / G13）靠一次实机 DMAR / CPUID dump 就能关掉**；
**2 条（G11 / G12d）是 Intel 自身文档互相矛盾，按本仓库惯例不裁决、并列两说**。
本 session 的执行环境是 AMD 机器，**没有做任何 Intel 实机验证**（§9）。

---

## 0. 本次实际读到的一手文档（读取即证据）

| 简称 | 文档 | 文档号 / 版本 | 本次取得方式 |
|---|---|---|---|
| SDM-V1/V2/V3/V4 | Intel 64 and IA-32 Architectures SDM, Combined Volumes | **325462-093US, September 2026** | `https://cdrdv2.intel.com/v1/dl/getContent/671200`（5364 页，全文抽取） |
| SDM-V4 | SDM Volume 4: Model-Specific Registers | **335592-093US, September 2026** | `https://cdrdv2.intel.com/v1/dl/getContent/671098`（596 页） |
| VT-d | Intel VT for Directed I/O Architecture Specification | **D51397-019, Rev 5.20, April 2026** | `https://cdrdv2-public.intel.com/919688/D51397-019-vt-directed-io-spec.pdf`（353 页） |

> **对现有 bibliography 的修正**：`intel-vt/references/bibliography.md` 条目 [1]–[6] 记为
> **Rev 092, June 2026**。本次下载到的是 **Rev 093, September 2026**，封面 Order Number 分别为
> `325462-093US` 与 `335592-093US`。下文所有 SDM 章节号、表号均按 **093** 计——SDM 章节号在
> 修订之间会移动（microcode 一节历史上从 Ch.9 → Ch.10 → 现 **Vol.3A Ch.12**），
> 因此**任何 SDM 锚点必须带修订号**，否则不可复核。

---

## 1. 矩阵 A：CPUID DisplayFamily_DisplayModel（维度 1）

**唯一来源**：SDM-V4 **335592-093US**, **Chapter 2, Table 2-1 "CPUID Signature Values of
DisplayFamily_DisplayModel"**（Vol.4 pp. 2-1 ~ 2-3）。以下每一行都是 Table 2-1 的逐字转写，
不是二手表格，也没有任何一行是推断出来的。

| 市场世代 | 微架构 / 代号 | DisplayFamily_DisplayModel | Table 2-1 原文措辞 |
|---|---|---|---|
| 10th Gen Core | Comet Lake | **06_A5H, 06_A6H** | "10th generation Intel® Core™ processors based on Comet Lake microarchitecture" |
| 10th Gen Core | Ice Lake (client) | **06_7EH** | "10th generation Intel® Core™ processors based on Ice Lake microarchitecture" |
| 11th Gen Core | Rocket Lake | **06_A7H** | "11th generation Intel® Core™ processors based on Rocket Lake microarchitecture" |
| 11th Gen Core | Tiger Lake | **06_8CH, 06_8DH** | "11th generation Intel® Core™ processors based on Tiger Lake microarchitecture" |
| 12th Gen Core | Alder Lake | **06_97H, 06_9AH** | "12th generation Intel® Core™ processors supporting Alder Lake hybrid architecture" |
| 13th Gen Core | Raptor Lake | **06_BAH, 06_B7H, 06_BFH** | "13th generation Intel® Core™ processors supporting Raptor Lake hybrid architecture" |
| **14th Gen Core** | Raptor Lake Refresh | **Table 2-1 中不存在独立条目** | 见 §1.1 |
| Core Ultra 7 (Series 1) | Meteor Lake | **06_AAH** | "Intel® Core™ Ultra 7 processors supporting Meteor Lake hybrid architecture" |
| Core Ultra 200V | Lunar Lake | **06_BDH** | 见 §1.2 的 "respectively" 解析 |
| Core Ultra 200S | **Arrow Lake S** | **06_C6H** | 同上 |
| Core Ultra 200H | Arrow Lake H | **06_C5H** | 同上 |
| Core Ultra 200U | Arrow Lake U | **06_B5H** | 同上 |
| Core Ultra Series 3 | Panther Lake | **06_CCH** | "Intel® Core™ Ultra Series 3 processors supporting Panther Lake hybrid architecture" |
| Core Series 3 | Wildcat Lake | **06_D5H** | "Intel® Core™ Series 3 processors supporting Wildcat Lake hybrid architecture" |
| （旁支，非主线世代） | Gracemont-based N 系 / Atom x7000 | **06_BEH** | "Intel® Processor and Intel® Core™ i3 and Intel® Core™ 3 N-Series Processors and Intel Atom® x7000 Processor Series based on Gracemont microarchitecture" |

### 1.1 关于 14 代的限定性否定声明

**声明**：在 SDM-V4 **335592-093US（September 2026）Table 2-1** 中，**不存在**任何标注为
"14th generation" 的条目；Raptor Lake 的三个 model 值只被归给 "13th generation"。
同一文档 **§2.17** 的世代枚举段落同样只写到 "13th generation Intel® Core™ processors supporting the
Raptor Lake performance hybrid architecture have a CPUID Signature DisplayFamily_DisplayModel value of
06_BAH, 06_B7H, or 06_BFH"，没有 14 代句子。

**这条声明的边界**：它说的是"**这份文档没有为 14 代单列条目**"，
**不等于**"14 代的 CPUID 签名未知"，也**不等于**"14 代与 13 代签名相同"。
把后两者写成结论需要 Specification Update 或 ARK 级别的证据，本次**没有取得**（见 §7 Gap G1）。

### 1.2 Arrow Lake / Lunar Lake 四个 model 的配对依据

Table 2-1 的这一行是一个 **"respectively" 句式**，配对关系是逐字读出来的，不是猜的：

> `06_BDH, 06_C6H, 06_C5H, 06_B5H` → "Intel® Series 2 Core™ Ultra processors supporting
> **Lunar Lake, Arrow Lake S, Arrow Lake H, and Arrow Lake U** hybrid architectures, **respectively**"

按序配对即：`06_BDH`=Lunar Lake，`06_C6H`=**Arrow Lake S**，`06_C5H`=Arrow Lake H，`06_B5H`=Arrow Lake U。

**用户的 Core Ultra 7 265KF 是 Arrow Lake-S，故 DisplayFamily_DisplayModel = `06_C6H`。**
SDM-V1 §1.1 另行确认："The Intel® Series 2 Core™ Ultra processors are based on **Lunar Lake or Arrow
Lake** hybrid architectures"——即 "Series 2 Core Ultra" 这一个市场名下面同时挂着两种不同微架构，
按市场名建索引会把它们混成一条，**必须按 model 值拆开**。

### 1.3 Stepping：SDM 里没有，Specification Update 里有

**声明**：SDM-V4 Table 2-1 **只给 DisplayFamily 与 DisplayModel，不给 Stepping ID**。
全表唯一出现 SteppingID 的地方是末尾脚注（Quark SoC X1000, `05_09H`, SteppingID = 0）。
SDM-V1 **Table 21-6** 对 `EAX[3:0] STEPPING_ID` 的说明是
"Identifies a revision of the specific processor family and model"，归入 **Package Domain**，但不枚举取值。

**stepping 的权威来源是各代 Specification Update 的
"Component Identification via Programming Interface" 表**。本次把 10 份文档全部下载并抽取，见 §1.4。

### 1.4 完整 CPUID 签名 + Stepping 表（来自 10 份 Specification Update，逐字）

每一行都抄自对应 Specification Update 的
**§2.1 "Component Identification via Programming Interface"** 表（Table 1 或 Table 2-1），
"CPUID" 列是 Intel 给出的完整 32 位 `CPUID.01H:EAX` 签名值。
`DF_DM` 与 `Step` 两列是按同表给出的位域分解写出来的，**不是我算的**——
位域分解（Extended Model `[19:16]`、Family Code `[11:8]`、Model Number `[7:4]`、Stepping ID `[3:0]`）
在每份文档里都逐位列出。

| 世代 | 文档号-修订 | 产品条目（原文） | Stepping | CPUID (`EAX`) | ⇒ `DF_DM` | ⇒ Step |
|---|---|---|---|---|---|---|
| 10th · Comet Lake | **615213-013** (Apr 2023) | U 4+2 V1 | V-0 | `806ECh` | **06_8EH** | 12 (Ch) |
| | | U 6+2 V1 | A-0 | `A0660h` | **06_A6H** | 0 |
| | | U 6+2 V2 | K-1 | `A0661h` | **06_A6H** | 1 |
| | | H 8+2 | R-1 | `A0652h` | **06_A5H** | 2 |
| | | S 10+2 | Q-0 | `A0655h` | **06_A5H** | 5 |
| | | S 6+2 / 4+2 / 2+2 / 2+1 | G-1 | `A0653h` | **06_A5H** | 3 |
| 10th · Ice Lake | **341079-023** (Apr 2026) | U | — | `706E5h` | **06_7EH** | 5 |
| | | Y | — | `706E5h`（见 §1.5 冲突） | **06_7EH** | 表列 4 |
| 11th · Rocket Lake | **634808-012** (Apr 2023) | S | — | `A0671h` | **06_A7H** | 1 |
| 11th · Tiger Lake | **631123-034** (Apr 2026) | UP3 / UP4 / H35 | — | `000806C1h` | **06_8CH** | 1 |
| | | H81 | — | `000806D1h` | **06_8DH** | 1 |
| | | UP3-Refresh / H35-Refresh | — | `000806C2h` | **06_8CH** | 2 |
| 12th · Alder Lake | **682436-040** (Sep 2026) | ADL-S 8+8 / ADL-HX 8+8 | — | `0x90672` | **06_97H** | 2 |
| | | ADL-S 6+0 | — | `0x90675` | **06_97H** | 5 |
| | | ADL-H 6+8 / ADL-P 6+8 | — | `0x906A3` | **06_9AH** | 3 |
| | | ADL-U15W 2+8 / ADL-U9W 2+8 | — | `0x906A4` | **06_9AH** | 4 |
| 13th **+ 14th** · Raptor Lake | **740518-031** (Sep 2026) | RPL-S 8P+16E / **RPL-S Refresh 8P+16E** / RPL-HX 8P+16E / **RPL-HX Refresh 8P+16E** | — | `B0671h` | **06_B7H** | 1 |
| | | RPL-S 8P+8E / **RPL-S Refresh 8P+8E** / RPL-HX 8P+8E | — | `B06F2h` | **06_BFH** | 2 |
| | | RPL-S 6P+0E / **RPL-S Refresh 6P+0E** | — | `B06F5h` | **06_BFH** | 5 |
| | | RPL-P 6P+8E / RPL-H 6P+8E / **RPL-H Refresh 6P+8E** | — | `B06A2h` | **06_BAH** | 2 |
| | | RPL-U 2P+8E / **RPL-U Refresh 2P+8E** | — | `B06A3h` | **06_BAH** | 3 |
| | | RPL-E 8P+0E / RPL-E Refresh 8P+0E（Xeon E 2400 / Xeon 6300，列此仅为说明该文档范围） | — | `B0671h` | **06_B7H** | 1 |
| Ultra 100 · Meteor Lake | **792254-024** (Sep 2026) | MTL-H 6P+8E / MTL-U 2P+8E / MTL-U Type4 2P+8E | C0 | `0xA06A4` | **06_AAH** | 4 |
| Ultra 200V · Lunar Lake | **827538-022** (Sep 2026) | LNL 4P+4E | B0 | `B06D1h` | **06_BDH** | 1 |
| Ultra 200S · **Arrow Lake-S** | **834774-023** (Sep 2026) | **ARL-S 8P+16E** | **B0** | **`C0662h`** | **06_C6H** | **2** |
| | | ARL-S 6P+8E | B0 | `C0662h` | **06_C6H** | 2 |
| | | ARL-HX 8P+16E | B0 | `C0662h` | **06_C6H** | 2 |
| | | **ARL-S Plus 8P+16E**（Arrow Lake Refresh） | B0 | `C0662h` | **06_C6H** | 2 |
| | | **ARL-HX Plus 8P+16E**（Arrow Lake Refresh） | B0 | `C0662h` | **06_C6H** | 2 |
| Ultra 200H · Arrow Lake-H | 同上 | ARL-H 6P+8E | A1 | `C0652h` | **06_C5H** | 2 |
| Ultra 200U · Arrow Lake-U | 同上 | ARL-U 2P+8E | A0 | `B0650h` | **06_B5H** | 0 |
| Ultra Series 3 · Panther Lake | **869992-008** (Sep 2026) | PTL H12Xe | B0 | `C06C2h` | **06_CCH** | 2 |
| | | PTL H484 | **A0** | `C06C2h` | **06_CCH** | 2 |
| | | PTL H284 | B0 | `C06C2h` | **06_CCH** | 2 |
| | | PTL 404 | A1 | `C06C3h` | **06_CCH** | 3 |

**与 SDM-V4 Table 2-1 的交叉验证全部通过**：Arrow Lake S/H/U 三行分别落在
`06_C6H` / `06_C5H` / `06_B5H`，与 §1.2 从 SDM "respectively" 句式读出的配对**完全一致**。
两份独立的 Intel 一手文档互证，这条配对可以当作已确证事实使用。

> **用户的 Core Ultra 7 265KF**：Arrow Lake-S，**`CPUID.01H:EAX = C0662h`**，
> `DisplayFamily_DisplayModel = 06_C6H`，**Stepping ID = 2（B0）**。
> 注意 Table 2-1 列的是**芯片配置**（8P+16E / 6P+8E）而非 SKU；265KF 是 8P+12E，
> 属于 8P+16E 芯片的屏蔽品，签名同为 `C0662h`。该推断已由 §1.2 的 SDM 侧独立确认到 `06_C6H` 一级，
> **stepping 一级仍建议在 265KF 上实读确认**（G1b）。

### 1.5 两条会让"按型号查表"直接出错的发现

**(1) 14 代与 13 代在 CPUID 上不可区分。**
`740518-031` Table 2-1 把 **"RPL-S Refresh"（即 14 代）与 "RPL-S"（13 代）列为同一个 CPUID 值**：
8P+16E 两者都是 `B0671h`，8P+8E 两者都是 `B06F2h`，6P+0E 两者都是 `B06F5h`。

> **结论**：**无法用 CPUID 区分 i9-13900K 与 i9-14900K。**
> 任何以 `DF_DM + stepping` 为键的表，在 13/14 代这一格必然是"两代合一格"。
> 这一点对维度 4 尤其致命：Vmin Shift Instability 同时影响 13 代与 14 代，
> 而**软件无法靠 CPUID 判断手上这颗是哪一代**——只能靠微码版本和 brand string。
> 这也解释了 Intel 为什么把 13/14 代合并进**同一份** Specification Update（见 §8.1）。

**(2) 一颗 10 代部件报着 7 代的签名。**
`615213-013` Table 1 第一行：Comet Lake **"U 4+2 V1"**，CPUID = **`806ECh`** → **`06_8EH`**。
而 SDM-V4 Table 2-1 把 `06_8EH` 描述为
"**7th generation** Intel® Core™ processors based on Kaby Lake microarchitecture, **8th and 9th
generation** Intel® Core™ processors based on Coffee Lake microarchitecture…"。

> **结论**：存在一颗市场上叫"第 10 代"的部件，其 `DisplayFamily_DisplayModel`
> 与 Kaby Lake / Coffee Lake **完全相同**。
> "市场世代 ↔ CPUID 签名"**不是一一映射，也不是单调的**。
> ticket 09 要决定"按什么键组织"时，这一行是最强的反例：
> **市场名与 CPUID 之间必须有显式映射层，不能靠任何规则推导。**

### 1.6 源文档内部的措辞冲突（照实记录，不裁决）

- **Ice Lake `341079-023` Table 2-1**：U 行与 Y 行的 "CPUID" 列**都写 `706E5h`**，
  但同表的 `Stepping ID [3:0]` 列 U 行写 `0101b`(5)、**Y 行写 `0100b`(4)**。
  若位域分解为准，Y 的完整签名应是 `706E4h` 而非 `706E5h`。**两列自相矛盾**，本文档不裁决。
- **Panther Lake `869992-008` Table 1**：`PTL H12Xe` 标 stepping **B0**、`PTL H484` 标 stepping **A0**，
  但两行的 CPUID 都是 `C06C2h`（Stepping ID = 2）。
  即**两个不同的 stepping 名对应同一个 CPUID Stepping ID**。照实记录。

→ 两条均记为 **Gap G1c**（源文档冲突，需下一修订或 Documentation Changes 澄清）。

---

## 2. 矩阵 B：虚拟化相关特性的世代引入点

**唯一来源**：SDM-V1 **325462-093US**, **Chapter 5, Table 5-2 "Instruction Set Extensions Introduction
in Intel® 64 and IA-32 Processors"**。这张表是 Intel 自己按"哪一代引入"组织的，
比任何二手"某某 Lake 支持什么"列表都硬。下表只抄与虚拟化 / hypervisor 直接相关的行，
**客户端引入点**用粗体标出。

| 特性 | Table 5-2 列出的引入代（逐字） | 对 hypervisor 的意义 |
|---|---|---|
| Split Lock Detection | **10th Gen Core (Ice Lake)**, Tremont Atom | 与 `IA32_CORE_CAPABILITIES` / bus-lock 相关的 #AC 行为从 10 代起在客户端存在 |
| Control-flow Enforcement Technology (CET) | **11th Gen Core (Tiger Lake)**, SPR, Sierra Forest | guest CET 状态需要 VMCS 字段支持；客户端入口是 11 代 |
| Key Locker | **11th Gen Core (Tiger Lake), 12th Gen Core (Alder Lake)** | `CPUID.19H` 是 runtime-mutable（见 §3.4），VMM 直通/模拟需注意 |
| **Intel VT-rp + HLAT** | **12th Gen Core (Alder Lake)**, SPR, Sierra Forest | **客户端 VT-rp/HLAT 的引入点就是 12 代**；Windows HVCI/HVPT 的硬件加速基础 |
| Supervisor Memory Protection Keys (PKS) | **12th Gen Core (Alder Lake)**, SPR, Sierra Forest | 新增 guest 状态 `IA32_PKRS`，VMCS 有对应字段 |
| Architectural LBRs | **12th Gen Core (Alder Lake)**, SPR, Sierra Forest | LBR 从 model-specific 变架构化，影响 VMM 的 LBR 虚拟化路径 |
| Intel Thread Director + HRESET | **12th Gen Core (Alder Lake)** | 引入 `IA32_HW_FEEDBACK_*` 与 `CPUID.20H`；宿主调度器依赖它，VMM 若隐藏会伤 guest 调度 |
| User wait: TPAUSE/UMONITOR/UMWAIT | Tremont Atom, **12th Gen Core (Alder Lake)**, SPR | `IA32_UMWAIT_CONTROL`，TPAUSE 在 non-root 有 TSC-offset/scaling 交互（SDM-V3C §28.3） |
| **IPI Virtualization** | SPR, Sierra Forest, Atom P6900 (Crestmont), **Intel® Core™ Ultra 200H Series (Arrow Lake H)** | **客户端首次出现的 tertiary VM-execution control**。见 §2.1 |
| Linear Address Masking (LAM) | Sierra Forest, Atom P6900, **Core Ultra 200H (Arrow Lake H)** | 新增 VMCS/CR 语义 |
| Linear Address Space Separation (LASS) | Sierra Forest, Atom P6900, **Core Ultra 200H (Arrow Lake H)** | 同上 |
| User Interrupts (UINTR) | SPR, Sierra Forest, Atom P6900, **Core Ultra 200H (Arrow Lake H)** | 新增 guest 状态 |
| UIRET flexibly updates UIF | Sierra Forest, Atom P6900, **Core Ultra 200H (Arrow Lake H)** | — |
| **Virtualization of guest accesses to `IA32_SPEC_CTRL`** | SPR, Sierra Forest, Atom P6900 —— **没有任何一个 Core / Core Ultra 客户端型号** | 见 §2.2，这是一条重要的限定性否定声明 |
| LBR Event Logging | Sierra Forest, Atom P6900, **Core Ultra 200S Series (Arrow Lake S)** | 265KF 有 |
| AVX-VNNI-INT16 / SHA512 / SM3 / SM4 | **Core Ultra 200S Series (Arrow Lake S)** | 265KF 有；纯 ISA，但影响 CPUID 掩码策略 |
| RDMSRLIST / WRMSRLIST / WRMSRNS | Sierra Forest, Atom P6900 —— **无客户端 Core 条目** | non-root 下 WRMSRLIST 受 "enable MSR-list instructions" 控制（SDM-V3C §28.3） |
| Intel AMX | SPR only —— **无客户端条目** | 客户端不需要 AMX guest 状态管理 |
| Intel AVX10.1 | Xeon 6 P-core (Granite Rapids) only —— **无客户端条目** | — |

### 2.1 Arrow Lake **S 与 H 在虚拟化特性上并不相等**（本次最反直觉的发现之一）

Table 5-2 里，`Core Ultra 200H`（Arrow Lake-H）拿到了 **IPI Virtualization、LAM、LASS、UINTR、
UIRET-UIF、CMPCCXADD、AVX-IFMA、AVX-NE-CONVERT、AVX-VNNI-INT8**；
而 `Core Ultra 200S`（Arrow Lake-S，即 265KF 所属）在同一张表里只被列为
**AVX-VNNI-INT16、SHA512、SM3、SM4、LBR Event Logging** 的引入点。

**这意味着**："Core Ultra 200 系列支持 X" 这种按市场系列写的 claim 在本代是**不成立的**——
S 与 H 是不同的 DisplayModel（`06_C6H` vs `06_C5H`），Table 5-2 也按不同名字分别列出。
型号轨道（ticket 09）如果按"Core Ultra 200S/200H"这一级建键，会在这里直接产生错误答案。

**边界**：Table 5-2 是"**引入点**"表，不是"**支持矩阵**"。
"200S 没有出现在 IPI Virtualization 行"严格地只能推出"IPI Virtualization 不是由 200S 引入的"，
**不能**直接推出"200S 不支持 IPI Virtualization"。要把后者写成 claim，
必须实测 `IA32_VMX_PROCBASED_CTLS3`（MSR 492H）bit 4，或拿到 200S 的 Specification Update。
→ 记为 **Gap G2**，并且这正是用户手上 265KF **可以一条 RDMSR 就实测掉**的问题。

### 2.2 `IA32_SPEC_CTRL` 虚拟化：客户端缺席

**声明**：在 SDM-V1 **325462-093US** Table 5-2 中，"Virtualization of guest accesses to
`IA32_SPEC_CTRL`" 一行列出的引入代为 "4th generation Intel® Xeon® Scalable Processor Family based on
Sapphire Rapids microarchitecture, Intel® Xeon® 6 E-core processors based on Sierra Forest
microarchitecture, Intel® Atom® P6900 Processor based on the Crestmont microarchitecture"——
**该行不含任何 Intel Core 或 Core Ultra 客户端条目**。

**意义**：`IA32_SPEC_CTRL` 的 VMCS shadow + mask 机制（SDM-V3C §28.3 描述了
"virtualize IA32_SPEC_CTRL" VM-execution control 为 1 时 WRMSR 的改写语义）在客户端上
很可能需要落回 MSR bitmap + 拦截的老路。**同样受 §2.1 的边界约束**：这是"未列为引入代"，
不是"确认不支持"。→ **Gap G3**。

---

### 2.3 把 Table 5-2 的世代结论落到**可实测的位**上

Table 5-2 说的是"哪一代引入"，落到能力 MSR 上就是**一个寄存器的一个位**。
**来源**：SDM-V3C **325462-093US**, **§27.6.2, Table 27-8 "Definitions of Tertiary Processor-Based
VM-Execution Controls"**，以及 **SDM-V3D Appendix A.3.4**。

先记住两条前置条件（Appendix A.3.4 逐字）：

> "The `IA32_VMX_PROCBASED_CTLS3` MSR (**index 492H**) reports on the allowed 1-settings of the tertiary
> processor-based VM-execution controls… The `IA32_VMX_PROCBASED_CTLS3` MSR **exists only on processors
> that support the 1-setting of the "activate tertiary controls" VM-execution control (only if bit 49 of
> the `IA32_VMX_PROCBASED_CTLS` MSR is 1)**."
>
> "Notice that the organization of this MSR **differs from** that of `IA32_VMX_PROCBASED_CTLS2`… because
> there are **64** tertiary processor-based VM-execution controls, while there were only 32 secondary…"

→ **注意这个陷阱**：`CTLS3`（492H）是 **64 位全部表示 allowed-1**，
**不是**像 `CTLS`/`CTLS2` 那样"低 32 位 allowed-0 / 高 32 位 allowed-1"的双字格式。
照抄 secondary 的读法会把结果整个读错。

Table 27-8 全表（逐字）：

| bit | 名称 | 与本矩阵的关系 |
|---|---|---|
| 0 | LOADIWKEY exiting | Key Locker（11 代引入） |
| **1** | **Enable HLAT** | **VT-rp 三件套之一；Table 5-2 客户端引入点 = 12 代 Alder Lake** |
| **2** | **EPT paging-write control** | 同上 |
| **3** | **Guest-paging verification** | 同上 |
| **4** | **IPI virtualization** | **Table 5-2 客户端引入点 = Core Ultra 200H；200S 未列 → G2** |
| 5 | SEAM guest-physical address width | 仅 TDX/SEAM，客户端不适用 |
| 6 | Enable MSR-list instructions | RDMSRLIST/WRMSRLIST；Table 5-2 无客户端条目 |
| **7** | **Virtualize `IA32_SPEC_CTRL`** | **Table 5-2 无任何客户端条目 → G3** |
| 8 | APIC-timer virtualization | Table 5-2 未列；→ G3b |
| 9 | Enable PBNDKB | — |
| 12 | PEBS uses guest physical addresses | 架构 PEBS；与 §3.7 的 PMU 版本差异相关 |

> **这张表是型号轨道最该收录的东西**：它把"某代支不支持某虚拟化特性"这个问题
> 从"查文档"变成"读一个 MSR 的一个位"。
> 265KF 上跑一遍 `RDMSR 492H` 就能一次性关掉 G2、G3、G3b 三个缺口。

## 3. 混合拓扑（维度 2）

### 3.1 CPUID leaf `1AH` 的准确名字与语义

**来源**：SDM-V1 **325462-093US**, **Chapter 21 "Processor Identification and Feature Determination"**,
**Table 21-63 "Leaf 1AH Native Model ID Enumeration"**（Vol.1 p. 21-66）。

**第一个必须纠正的点**：ticket 把 `1AH` 叫 "Hybrid Information"。
在 **SDM rev 093** 里这个 leaf 的正式名字是 **"CPUID.1AH -- Native Model ID Enumeration"**。
"Hybrid" 是 **`CPUID.07H.00H:EDX[15]`** 这个 **feature flag** 的名字（Table 21-21）。两者不是一回事。

leaf 1AH 逐字要点：

- 存在条件（原文）："This leaf exists on all logical processors in a hybrid package, **it may also be
  present in other processor configurations**." —— 即 **1AH 存在 ≠ 这是混合处理器**。
  判定混合要看 `CPUID.07H.00H:EDX[15] HYBRID`。
- 有效性："This leaf is valid if `CPUID.1AH.00H:EAX[31:0] <> 0` and `MAX_LEAF ≥ 1AH`"；唯一有效 sub-leaf 是 0。
- `EAX[31:24] CORE_TYPE`：`10H` Reserved，**`20H` = Intel® Atom®**，`30H` Reserved，**`40H` = Intel® Core**。
- `EAX[23:0] CORE_NATIVE_MODEL_ID`：原文 "This native model ID is **not unique across core types**,
  and **not related to the model ID reported in CPUID.01H**, and **does not identify the SOC**."
- **对 hypervisor 最重要的一句**（逐字）：
  > "The core type may only be used as an identification of the microarchitecture for this logical
  > processor and its numeric value has no significance, neither large nor small. **This field neither
  > implies nor expresses any other attribute to this logical processor and software should not assume
  > any.**"

  即：**从 `CORE_TYPE` 推导性能、能力、缓存、ISA 都是 SDM 明文禁止的**。
  `40H > 20H` 也不表示 Core 比 Atom "大"。
- `EAX` 的 Domain = **Logical Processor**（见 §3.2）。

`CPUID.07H.00H:EDX[15] HYBRID` 的逐字描述（Table 21-21）：
> "If 1, the processor is identified as a hybrid part. If `CPUID.00H.MAXLEAF ≥ 1AH` and
> `CPUID.1AH:EAX <> 0`, then the Native Model ID Enumeration Leaf 1AH exists."
Domain = **Platform**。

### 3.2 SDM rev 093 新增的 **CPUID Domain** 机制——这是回答"P/E 核到底哪些东西可以不一样"的官方答案

**来源**：SDM-V1 **325462-093US**, **§21.1.4 "CPUID Domains"**（Vol.1 pp. 21-2 ~ 21-3）。
rev 093 的 Chapter 21 给**每一个 CPUID 字段**加了一列 **Domain**，逐字定义为：

> "On a properly configured platform, **all logical processors within a CPUID domain return a consistent
> output value** for fields belonging to that domain."
>
> - **Platform Domain** — "A properly configured platform would provide consistent values for these
>   CPUID fields for **each logical processor in the platform**."
> - **Package Domain** — "…consistent values … for each logical processor **within the same processor
>   package**."
> - **Logical Processor Domain** — "A properly configured platform **can provide different values** for
>   these CPUID fields for each logical processor in the platform. The values contained within these may
>   have their own scope as per a specific shared resource (i.e., cache, **hybrid**, etc.); in that case,
>   **each logical processor may need to be queried** to obtain the full platform view of given features."

本次实际查证的分类（逐字摘自 Chapter 21 各表的 Domain 列）：

| CPUID 字段 | Domain | 出处 |
|---|---|---|
| `CPUID.01H:ECX[5]` **VMX** | **Platform** | Table 21-9 |
| `CPUID.01H:EAX[7:4]` MODEL_ID | **Platform** | Table 21-6 |
| `CPUID.01H:EAX[3:0]` STEPPING_ID | **Package** | Table 21-6 |
| `CPUID.01H:EDX[28]` HTT | **Platform** | Table 21-10 |
| `CPUID.01H:EBX[31:24]` INITIAL_APIC_ID | **Logical Processor** | Table 21-8 |
| `CPUID.07H.00H:EBX` AVX512F / AVX512DQ / SGX / RTM / HLE 等 ISA 位 | **Platform** | Table 21-19 系列 |
| `CPUID.07H.00H:EDX[15]` HYBRID | **Platform** | Table 21-21 |
| `CPUID.04H` 全部字段（CACHE_TYPE / CACHE_LEVEL / MAX_LP_ADDRESSABLE_IDS …） | **Logical Processor** | Table 21-14 |
| `CPUID.0AH` 全部字段（含 `EAX[15:8]` NUM_GP_CTRS） | **Platform** | Table 21-30 |
| `CPUID.1AH:EAX`（CORE_TYPE / CORE_NATIVE_MODEL_ID） | **Logical Processor** | Table 21-63 |
| `CPUID.1FH:EDX` X2APIC_ID | **Logical Processor** | Table 21-72 系列 |
| `CPUID.06H:EDX[31:16]` HW_FEEDBACK_TABLE_INDEX | 逐 LP（"Index … of **this logical processor's** row"） | Table 21-17 系列 |

**结论（这是维度 2 的核心答案）**：

1. **ISA 特性位是 Platform Domain**——SDM 要求它们在**整个平台**上一致。
   所以 P 核 / E 核在 `CPUID.01H`/`CPUID.07H` 的**功能位上不允许不一致**。
   AVX-512 的"交集处理"不是权宜之计，而是 **Platform Domain 约束的必然结果**。
2. **cache（04H）、拓扑（0BH/1FH）、native model ID（1AH）是 Logical Processor Domain**——
   SDM **明文允许**它们逐 LP 不同，并要求软件"query each logical processor"。
3. 因此"混合处理器上 CPUID 不一致"这句话是**半对的**：
   **架构性 ISA 层面必须一致，拓扑/缓存层面必须允许不一致**。分界线就在 Domain 列上。

### 3.3 P 核 / E 核在 MSR 上的实际差异 —— **SDM 有官方的逐核型清单**

**来源**：SDM-V4 **335592-093US**, Chapter 2。SDM **为每一代混合客户端部件都单列了
"MSRs unique to the processor P-core" / "…E-core" 两张表**。这是回答"P/E 核 MSR 是否不一致"
的权威表，不需要任何推断：

| 节 | 覆盖的 DisplayModel | 公共表 | **P-core 专属表** | **E-core 专属表** |
|---|---|---|---|---|
| **§2.17.5** | `06_97H, 06_9AH, 06_BAH, 06_B7H, 06_BFH`（12/13 代） | Table 2-46 | **Table 2-47** | **Table 2-48** |
| **§2.17.9** | `06_AAH`（Meteor Lake） | Table 2-53 | **Table 2-54** | **Table 2-55** |
| **§2.17.12** | `06_BDH`（Lunar Lake） | Table 2-58 | **Table 2-59** | **Table 2-60** |

SDM 的措辞是排他性的（Vol.4 p. 2-404 / 2-405，逐字）：

> "The MSRs listed in **Table 2-47** are unique to the 12th and 13th generation Intel Core processor
> **P-core**. **These MSRs are not supported on the processor E-core.**"
> "The MSRs listed in **Table 2-48** are unique to the 12th and 13th generation Intel Core processor
> **E-core**. **These MSRs are not supported on the processor P-core.**"

本次把这 6 张表逐条抽出核对，内容如下：

| 表 | 全部条目（Register Address / 名称 / Scope） |
|---|---|
| **Table 2-47**（12/13 代 **P-core 专属**） | `1A4H MSR_PREFETCH_CONTROL`；`3F7H MSR_PEBS_FRONTEND`(Thread)；`540H MSR_THREAD_UARCH_CTL`(Thread)；`541H MSR_CORE_UARCH_CTL`(Core)；**`D10H–D17H IA32_L2_QOS_MASK_[0-7]`(Core)** |
| **Table 2-48**（12/13 代 **E-core 专属**） | **`D10H–D1FH IA32_L2_QOS_MASK_[0-15]`(Module)**；`1309H–130BH MSR_RELOAD_FIXED_CTRx`；`14C1H–14C6H MSR_RELOAD_PMCx`(Core) |
| Table 2-54（MTL P-core） | `30CH IA32_FIXED_CTR3`；`329H MSR_PERF_METRICS` |
| Table 2-55（MTL E-core） | `1309H–130BH`；`14C1H–14C8H`；`4F0H MSR_SAF_CTRL`；`D18H–D1FH IA32_L2_MASK_*` |
| Table 2-59（LNL P-core） | `C9H/CAH IA32_PMC8/9`；`18EH/18FH IA32_PERFEVTSEL8/9`；`30CH IA32_FIXED_CTR3` |
| Table 2-60（LNL E-core） | `2DCH IA32_INTEGRITY_STATUS`；`30DH–30FH IA32_FIXED_CTR4/5/6`；`D18H IA32_L2_MASK_8` |

> **最锋利的一条：`D10H` 系列在两张表里都出现，但范围与 scope 都不同。**
> P-core 是 `D10H–D17H`（8 个掩码，**Core** scope）；E-core 是 `D10H–D1FH`（16 个掩码，**Module** scope）。
> 于是 **`D18H`–`D1FH` 在 E 核上可读写，在 P 核上会 #GP**。
> 这就是"同一条 RDMSR/WRMSR 在同一颗 CPU 上按落到哪种核而成功或 #GP"的**具体实例**，
> 也正是 ESXi 的 `ignoreMsrFaults`（见 §8.6）在遮盖的那类故障形状。
> 任何遍历所有 LP 去读同一组 MSR 的 hypervisor 初始化代码，在 12 代及以后**必须能容忍 #GP**。

### 3.4 **`IA32_VMX_*` 能力 MSR 是否逐核型不同 —— 限定性否定声明**

**声明**：在 SDM-V4 **335592-093US（September 2026）** 的
**Table 2-47、2-48、2-54、2-55、2-59、2-60**（即 12 代至 Lunar Lake 全部客户端混合部件的
P-core / E-core 专属 MSR 表）中，**没有任何一个地址落在 `480H`–`492H` 区间**，
**没有出现任何 `IA32_VMX_*` 名字**。全部逐核型差异集中在三类：
**性能监控（PMC / FIXED_CTR / PERF_METRICS / PEBS / RELOAD）**、
**预取控制（`MSR_PREFETCH_CONTROL`）**、**L2 cache QoS 掩码（`IA32_L2_QOS_MASK_*` / `IA32_L2_MASK_*`）**，
外加 Lunar Lake E-core 的 `IA32_INTEGRITY_STATUS` 与 Meteor Lake E-core 的 `MSR_SAF_CTRL`。

**这条声明的边界（很重要，不要过度解读）**：
SDM 的"unique MSRs"表说的是 **MSR 的存在性**（哪一边有、哪一边没有），
**不是 MSR 的取值**。`IA32_VMX_*` 在两种核上**都存在**（因为 `CPUID.01H:ECX[5] VMX` 是 Platform Domain，
两种核都必须报 VMX=1）；**SDM 没有任何一句话正面保证这些 MSR 的"取值"在 P/E 核之间相同**。
所以正确的结论是：

> **SDM 没有把任何 `IA32_VMX_*` 列为逐核型差异项；但也没有正面承诺其取值跨核型一致。**
> 一个正确的 VMM 仍应遵守 SDM-V3D Appendix A 的措辞——该附录通篇用
> "**the logical processor** supports …"（例如 A.1: "If bit 49 is read as 1, **the logical processor**
> supports the dual-monitor treatment…"）描述这些位，即能力是**逐逻辑处理器**语义。

→ "取值是否逐核型相同"记为 **Gap G4**，且这是 265KF 上**可以实测**的（20 个 LP 各读一遍 480H–492H 并比对）。

### 3.5 AVX-512 与"交集"：Intel 的官方说法

**来源**：SDM-V1 **325462-093US**, Table 5-2 **脚注 3**（逐字）：

> "**Alder Lake performance hybrid architecture does not support Intel® AVX-512.** ISA features such as
> Intel® AVX, AVX-VNNI, Intel® AVX2, and UMONITOR/UMWAIT/TPAUSE are supported."

配合 §3.2 的 Domain 机制，可以得到一条**完全由一手文档支撑**的因果链：
ISA 位属 Platform Domain → 必须全平台一致 → Gracemont 无 AVX-512 → 整个 Alder Lake 平台**不支持** AVX-512。
这不是"被阉割"，而是 CPUID 架构约束下唯一合法的取值。

### 3.6 Intel 自己承认"交集"是它的设计模式 —— RDT 的对照条款

**来源**：SDM-V3B **325462-093US**, **§20.20.3 "Asymmetrical Enumeration of Intel® RDT Features"**。
这一节是目前 SDM 里**最直白**地描述 Intel 混合枚举策略的地方（逐字）：

> "… **hybrid platforms (supporting multiple processor types) may contain multiple last-level caches
> (LLCs) with different capabilities**, or some processors may not include an LLC at the same enumeration
> level. … Asymmetrical RDT CPUID **leaves 27H and 28H may enumerate distinct capabilities between
> logical processors** on the platform, while **CPUID RDT leaves 0FH and 10H may enumerate the common set
> of capabilities to ensure software compatibility.** Asymmetrical RDT CPUID leaves should be enumerated
> **per logical processor** to identify differences in capabilities."

**这就是"交集"的架构原则本身**：**旧 leaf 报交集以保证软件兼容；新 leaf 报逐 LP 真值。**
同一节的 Table 20-22 还给出了配套的"对称/非对称"指示位：
`CPUID.07H.00H:EBX.RDT_M[12]` / `RDT_A[15]` 表示"**symmetrical** enumeration is available on
**all** logical processors"，而 `CPUID.07H.01H:ECX.RDT_M_ASYM[0]` / `RDT_A_ASYM[1]` 表示
"logical processors on this platform **may** support …; **but is not guaranteed**"。

对 hypervisor 的直接含义：**不能把在 CPU 0 上读到的 CPUID 结果当作整机结果发给 guest**。
对非对称 leaf 必须逐 LP 采样；若要给 guest 一个稳定视图，VMM 必须自己做交集并把 vCPU 钉住或统一掩码。

### 3.6b SDM 自己要求"必须查 family/model/stepping" —— 型号轨道的规范依据

**来源**：SDM-V1 **325462-093US**, Table 21-21，`CPUID.07H.00H:EDX[30] CORE_CAPABILITIES` 条目（逐字）：

> "`IA32_CORE_CAPABILITIES` is an architectural MSR that **enumerates model-specific features**. A bit
> being set in this MSR indicates that a model specific feature is supported; **software must still
> consult CPUID family/model/stepping to determine the behavior of the enumerated feature** as features
> enumerated in `IA32_CORE_CAPABILITIES` **may have different behavior on different processor models**.
> Some of these features may have behavior that is consistent across processor models …; such features
> are identified explicitly where they are documented in this manual."

配套地，SDM-V4 Table 2-2 的 `IA32_CORE_CAPABILITIES`（`CFH`）条目写的是
"`63:0` Reserved. **No architecturally defined bits.**"——**整个寄存器没有一个架构定义位**。

> **这是 Intel 自己写下的、要求按 family/model/stepping 查表的条款。**
> ticket 09 要论证"型号轨道有没有必要存在"时，这一句比任何外部论据都硬：
> 不建立 model/stepping 索引，`IA32_CORE_CAPABILITIES` 的任何一位都无法被正确解读。
> 已知的具体消费者：split-lock disable 枚举于 `IA32_CORE_CAPABILITIES[5]`、
> UC-lock disable 于 `[4]`、`RSM_IN_CPL0_ONLY` 于 `[3]`（SDM-V3A §11.x 与 Vol.2 RSM 条目）。

### 3.7 SDM 自己记录过一次"因混合而影响 `CPUID.0AH` 枚举"的先例

**来源**：SDM-V3B **325462-093US**, **§22.3.10.3 "Unhalted Reference Cycles"**（逐字）：

> "The Unhalted Reference Cycles architectural performance monitoring event is enhanced to count at
> TSC-rate in the 12th generation Intel Core processor P-core when used on a general-purpose PMC. This
> enhancement makes it consistent with the fixed-function counter 2 and the E-core. **As a result, this
> event is kept enumerated in `CPUID.0AH.EBX` (unlike prior hybrid parts).**"

**注意这里的张力**：Table 21-30 把 `CPUID.0AH` 全部字段标为 **Platform Domain**（应全平台一致），
而 §22.3.10.3 明说"**unlike prior hybrid parts**"——即在更早的混合部件上，
`CPUID.0AH.EBX` 的枚举**确实**因 P/E 差异而被改动过（通过"不枚举该事件"来取交集）。
这两处合起来正好说明：**Intel 用"把 leaf 压成交集"的手段来维持 Platform Domain 的承诺**。

同一章还确认了各代的核型微架构名（一手来源，可用来替换全库为 0 的代号命中）：
- §22.3.10：12 代 = Golden Cove (P) + Gracemont (E)；13 代 = Raptor Cove (P) + enhanced Gracemont (E)；
  两代均 "report architectural performance monitoring version ID = 5"。
- §22.3.11：Series 2 Core Ultra (Lunar Lake) = **Lion Cove (P) + Skymont (E)**，
  "reports architectural performance monitoring **version ID = 6**"。

> **架构 PMU 版本号本身就是一个世代差异**：12/13 代 = v5，Lunar Lake = v6。
> 对做 PMU 虚拟化的 VMM 这是硬门槛。

### 3.8 ESXi "Fatal CPU mismatch on feature" —— 判据（裁决见 §8.6）

见 **§8.6**（已完成裁决）。本节只给出**从 Intel 一手文档能独立推出的判据**，
用来在两种修法之间做裁决：

- 若 ESXi 比较的是 **Platform Domain 字段**（ISA 功能位）并发现不一致 →
  **平台确实处于 SDM 所说的 "not properly configured" 状态**（典型成因：BIOS 允许在关闭 E 核后
  打开 AVX-512），修法在 **BIOS / 微码**侧。
- 若 ESXi 比较的是 **Logical Processor Domain 字段**（`04H` 缓存、`1AH` core type、`0BH/1FH` 拓扑、
  非对称 RDT leaf）并因此 panic → **这是 ESXi 的均一性假设与 SDM §21.1.4 相抵触**，
  硅片没有问题，修法在 **hypervisor** 侧。

**两种修法互斥，判据就是"出问题的那个字段在 Chapter 21 里的 Domain 列是什么"。**

---

## 4. 超线程取消（维度 3）

### 4.1 由 SDM 一手确定的部分

- **`CPUID.01H:EDX[28] HTT` 不是"超线程开着"的意思。** SDM-V1 Table 21-10 逐字：
  > "If 1, the value in `CPUID.1.EBX[23:16]` (the Maximum number of addressable IDs for logical
  > processors in this package) is **valid for the package**. If 0, there is only a single logical
  > processor in the package…"

  即 HTT=1 只表示"这个 package 里可寻址 LP 数字段有效"。**任何多核部件 HTT 都是 1**，
  与 SMT 无关。把 HTT 当 SMT 标志是一个会在 Arrow Lake 上给出错误答案的经典误读，
  建议作为 errata 条目（`errata.md` 风格）收入。
- **正确的 SMT 判定来源是 `CPUID.1FH`**：SDM-V1 Table 21-72 给出 Domain Type ID
  `1 = Logical Processor`、`2 = Core`、`3 = Module`、`4 = Tile`、`5 = Die`、`6 = DieGrp`，Package 为隐含最高层。
  "每核几个 LP"要从 1FH 的 Logical Processor 层 `EBX[15:0]` 读，不能从 HTT 位猜。
  SDM-V1 还明确弃用了旧路径：
  > "The Maximum Addressable IDs for logical processors in this package **should not be used** on
  > platforms that support CPUID leaf 0BH or CPUID leaf 1FH as it can be saturated and incorrect. …
  > To correctly enumerate APIC ID information on modern platforms, use `CPUID.0BH` or `CPUID.1FH`."
- **混合部件上 LP/核 比例本来就不均匀**：12 代起 P 核带 SMT（2 LP/核）、E 核不带（1 LP/核）。
  这意味着"LP 数 = 核数 × 2"这个假设**从 12 代就已经失效**，
  Arrow Lake / Lunar Lake 取消 SMT 只是把比例统一回 1:1，**不是新增的破坏**。

### 4.2 对"按逻辑处理器初始化 VMXON 区域"的意义

**来源**：SDM-V3C **325462-093US**, **§27.11.5 "VMXON Region"**（Vol.3C p. 27-35），逐字：

> "**Software should use a separate region for each logical processor** and should not access or modify
> the VMXON region of a logical processor between execution of VMXON and VMXOFF on that logical
> processor. Doing otherwise may lead to unpredictable behavior (including behaviors identified in
> Section 27.11.1)."

配合 §27.11.5 的另两句：VMXON 区域大小由 `IA32_VMX_BASIC[44:32]` 决定，
且执行 VMXON 前要把 `IA32_VMX_BASIC[30:0]` 的 VMCS revision identifier 写进区域首 4 字节（bit 31 清零）。

**结论**：**"每逻辑处理器一个 VMXON 区域"这条规则本身完全没变**，SMT 取消不影响它。
真正会坏的是围绕它的三个**假设**：

1. **`LP 数 == 核数 × 2`** —— 12 代起即错（P/E 不同），Arrow Lake / Lunar Lake 上退化为 `LP == 核数`。
   正确做法：枚举 `CPUID.1FH`，或直接向 OS 要 LP 数。
2. **"同核的两个 LP 共享某些状态，可以只做一次"** —— 在无 SMT 的部件上"兄弟 LP"不存在；
   任何 `if (is_primary_thread_of_core())` 形式的短路逻辑在 Arrow Lake 上会把**全部**核都判成 primary，
   看似安全，但反过来在 **microcode 加载**上会变成"每核都加载"（这恰好是 SDM 要求的，见 §5.3）。
3. **按 APIC ID 低位推断 SMT 兄弟** —— `CPUID.1FH` 的层级位宽在无 SMT 时 Logical Processor 层宽度为 0，
   写死 `apic_id >> 1` 之类的代码会算错 core ID。

### 4.3 SMT 具体状态（结论；完整逐代表与来源见 §8.8）

| 世代 | SMT 状态 | 逻辑处理器结构 |
|---|---|---|
| 10 代 / 11 代 | **有**（ARK "Yes"） | 全核 2 LP，`LP = 2 × 核` 成立 |
| 12 / 13 / 14 代、Core Ultra 100 (Meteor Lake) | **有，但只在 P 核上**（ARK "Yes"） | **P 核 2 LP，E 核 1 LP，LPE 核 1 LP** —— `LP = 2 × 核` **从这里开始就错了** |
| Core Ultra 200V (Lunar Lake) | **无**（ARK **"No"**） | 每核 1 LP |
| **Core Ultra 200S (Arrow Lake-S，含 265KF)** | **无**（ARK **"No"**） | 每核 1 LP；**265KF = 8 P + 12 E = 20 核 = 20 线程** |
| Core Ultra Series 3 (Panther Lake) | 线程数 = 核数，但 ARK **不打印该字段** → 见 Gap G17 | — |

> **最容易写错的一句**：SMT 的消失**不是**从 Arrow Lake 开始的破坏点。
> **真正的破坏点是 12 代**——从那时起同一颗封装内 P 核 2 LP、E 核 1 LP，
> `LP = 2 × 核` 这个假设已经失效。
> Arrow Lake / Lunar Lake 只是把比例**统一**回 1:1，反而比 12–14 代更简单。

---

## 5. 微码作为行为变量（维度 4）

### 5.1 **微码更新与 VMX 的交互 —— SDM 明文有两条，本次逐字取得**

这是 ticket 明确要求"SDM 怎么说"的部分，答案是：**SDM 说了，而且说得很具体。**

**(a) SDM-V3C **325462-093US**, Chapter 28 "VMX Non-Root Operation", §28.3 "Changes to Instruction
Behavior in VMX Non-Root Operation"**，WRMSR / WRMSRNS 条目下（逐字）：

> "If the MSR address is 79H (`IA32_BIOS_UPDT_TRIG`), **no microcode update is loaded, and control passes
> to the next instruction. This implies that microcode updates cannot be loaded in VMX non-root
> operation.**"

**这条的杀伤力**：在 guest 里写 79H **不产生 #GP、不产生 VM exit**（在未设置 MSR-bitmap 拦截时），
而是**静默地什么都不做然后继续执行**。guest 会认为自己加载成功了。
一个把微码更新交给 guest 的设计（例如直通给 VM 的运维流程）会**静默失败**。
VMM 若要让 guest 看见真相，必须自己在 MSR bitmap 里拦 79H 并注入 #GP 或做显式处理。

**(b) SDM-V4 **335592-093US**, Table 2-2, Register Address `79H, 121` `IA32_BIOS_UPDT_TRIG`**（逐字）：

> "BIOS Update Trigger (W). Executing a WRMSR instruction to this MSR causes a microcode update to be
> loaded into the processor. See Section 12.11.6, "Microcode Update Loader."
> **A processor may prevent writing to this MSR when loading guest states on VM entries or saving guest
> states on VM exits.**"

即 VM-entry/VM-exit 的 MSR-load/MSR-store 列表**可能**被处理器拒绝用于 79H。
把 79H 放进 VM-entry MSR-load area 不是可靠手段。

> **综合回答 ticket 的问题**："hypervisor 运行中遇到微码更新该怎么办" ——
> SDM 的答案是：**微码更新只能在 VMX root operation 中做**（non-root 下是 no-op），
> 且不能依赖 VMCS 的 MSR 自动加载/保存列表来做。
> **SDM 没有**说"VMX root 下加载微码是禁止的"，也**没有**说"必须先 VMXOFF"。
> 本次检索过 SDM-V3A §12.11（全部子节）、SDM-V3C Ch.26/27/28、SDM-V3D Appendix A、SDM-V4 Table 2-2，
> **未发现**任何"必须退出 VMX operation 才能加载微码"的规定。→ 记为 **Gap G5**（否定声明的边界）。

### 5.2 rev 093 新增的微码架构 MSR —— 直接影响 hypervisor

**来源**：SDM-V4 **335592-093US**, Table 2-2。这三个是 ticket 未提到但**必须进入型号轨道**的：

**`IA32_MCU_ENUMERATION`（`7BH`, R/O）** —— 逐字要点：
- `bit 0 UNIFORM_MCU_AVAIL`：
  > "When set to 1, uniform microcode update is available, and `UNIFORM_MCU_SCOPE` (bits [10:8])
  > indicates the scope of writes to `IA32_BIOS_UPDT_TRIG`. **When set to 0, uniform microcode update is
  > not available, and writes to `IA32_BIOS_UPDT_TRIG` are core scoped.**"
- `bits 15:8 UNIFORM_MCU_SCOPE`：`0x02` Core / `0x03` Module / `0x04` Tile / `0x05` Die /
  `0x80` Package / `0xC0` Platform。原文注：
  > "The value of this field reflects the state of platform configuration and **may change as the
  > configuration changes during the boot process**."
- `bit 1/2 UNIFORM_MCU_CONFIG_REQD` / `UNIFORM_MCU_CONFIG_COMPLETE`；
  `bit 3 ARCH_ROLLBACK_SVN_COMMIT`（MCU deferred SVN / rollback 架构）；
  `bit 4 MCU_STAGING`（"the use of the MCU staging capability is **recommended to reduce the latency of
  the `IA32_BIOS_UPDT_TRIG` operation**"）。

  > **注意 bits 位宽的文档不一致**：bit 0 的描述文字说 scope 在 "bits [10:8]"，
  > 而 `UNIFORM_MCU_SCOPE` 字段行本身写的是 **`15:8`**。这是 SDM-V4 093 内部的一处措辞冲突，
  > 引用时应以字段行（`15:8`）为准并标注此冲突。→ **Gap G6**。

**`IA32_MCU_STATUS`（`7CH`, R/O）** —— "Communicates results from the previous patch loads"：
- `bit 0 MCU_PARTIAL_UPDATE`："the most recent write to `IA32_BIOS_UPDT_TRIG` resulted in a **partial
  update**. This means that microcode update components were only partially updated **after some portion
  of the MCU had already been committed and the Revision ID had been updated**."
- `bit 1 AUTH_FAIL_ON_MCU_COMPONENT`：认证失败但 Revision ID 已更新。
- `bit 3 POST_BIOS_MCU`：更新是在 `MSR_BIOS_DONE`（`151H`）bit 0 置 1 **之后**加载的。

  > **对 hypervisor 极重要**：`MCU_PARTIAL_UPDATE` = 1 的情况下，
  > **Revision ID 已经变了但微码只更新了一部分**。
  > 也就是说 **"读 `IA32_BIOS_SIGN_ID` 得到新版本号"并不能证明更新完整生效**。
  > 任何把微码版本号当作行为判据的 VMM 都必须同时检查 `7CH`。

**`IA32_MCU_CONTROL`（`1406H`, R/W）** —— 存在条件
`CPUID.07H.00H:EDX[29] = 1 && IA32_ARCH_CAPABILITIES.MCU_CONTROL = 1`：
- `bit 0 LOCK`：置位后再写本 MSR 触发 #GP(0)（SMM 下若 `EN_SMM_BYPASS` 置位则绕过）。
- `bit 1 DIS_MCU_LOAD`（逐字）：
  > "If this bit is set **on a given logical processor**, then any subsequent attempts to load a
  > microcode update by that logical processor will be **silently dropped** (WRMSR 0x79 has no effect)."
- `bit 2 EN_SMM_BYPASS`。

  > 这给了 hypervisor 一个**逐 LP 的、可上锁的**微码加载开关。
  > 同时也是一个新的攻击面/排障点：`DIS_MCU_LOAD` 被置位时，宿主的微码更新也会**静默失败**，
  > 症状与 §5.1(a) 的 guest 静默失败完全一样。

### 5.3 SDM 关于微码加载的其余硬约束（客户端多核 / 混合相关）

**来源**：SDM-V3A **325462-093US**, **Chapter 12 "Processor Management and Initialization",
§12.11 "Microcode Update Facilities"**（注意：**093 修订里是 Ch.12，不是老修订的 Ch.9/10**）。

- **§12.11**（逐字）："Intel considers the release of a microcode update for a silicon revision to be
  **the equivalent of a processor stepping** and completes a full-stepping level validation for releases
  of microcode updates."
  → **Intel 自己把微码版本等同于 stepping**。这一句直接支持 ticket 09 的判断：
  型号表不带微码维度就是错的。
- **§12.11.6.1 "Hard Resets in Update Loading"**（逐字）："The effects of a loaded update are **cleared
  from the processor upon a hard reset**. … The effects of a loaded update are, however, **maintained
  across a processor INIT**. There are **no side effects caused by loading an update into a processor
  multiple times**."
- **§12.11.6.2 "Update in a Multiprocessor System"**："A multiprocessor (MP) system requires loading
  **each processor** with update data **appropriate for its CPUID and platform ID bits**."
- **§12.11.6.3 "Update in a System Supporting Intel Hyper-Threading Technology"**（逐字）：
  > "The update must be loaded for **each core** in a physical processor. Thus, for a processor
  > supporting Intel Hyper-Threading Technology, **only one logical processor per core** is required to
  > load the microcode update. Each individual logical processor can independently load the update.
  > However, MP initialization must provide some mechanism (e.g., a software semaphore) to **force
  > serialization of microcode update loads and to prevent simultaneous load attempts to the same core**."
- **§12.11.6.4 "Update in a System Supporting Dual-Core Technology"**：
  "The microcode update facility is **not shared between processor cores** in the same physical package."
- **§12.11.6 载入前置条件**：64-bit 模式下 EAX/EDX = 微码更新线性地址的低/高 32 位，ECX = `79H`；
  地址必须是 canonical、16 字节对齐、若开分页则必须已映射为 present。
- 微码版本读取：**SDM-V1 §21.1.8 "IA32_BIOS_SIGN_ID Returns Microcode Update Signature"**（逐字）：
  "the `IA32_BIOS_SIGN_ID` MSR is loaded with the update signature **whenever CPUID executes**.
  The signature is returned in the **upper DWORD**."
  → 标准序列仍是"写 0 到 8BH → 执行 CPUID → 读 8BH 高 32 位"。

### 5.4 微码**确实**会改变 CPUID 可见行为 —— SDM 内部的架构证据

SDM-V1 **§21.1.5 "CPUID Runtime Mutable Fields"** 用两张表承认 CPUID 不是常量：
**Table 21-1 "Runtime Mutable CPUID Fields Expected to Change During Normal Operation"**
（`01H:ECX[27] OSXSAVE`、`07H.00H:ECX[4] OSPKE`、`0DH` XSAVE 尺寸、`19H:EBX[0] AESKLE`、
`80000001H:EDX[20] SYSCALL_SYSRET_64`）与
**Table 21-2 "Runtime Mutable CPUID Fields That Should Remain Consistent"**
（`00H:EAX MAX_LEAF` 受 `IA32_MISC_ENABLE[22]` 控制、`01H:ECX[3] MONITOR` 受 `IA32_MISC_ENABLE[18]`、
`01H:ECX[7] EIST` 受 `IA32_MISC_ENABLE[16]`、`01H:EDX[9] APIC` 受 `IA32_APIC_BASE[11]`）。

**这两张表证明的是"CPUID 可被软件/配置改变"**，而"**微码更新**改变 CPUID 功能位"的具体历史案例
（TSX 关闭、AVX-512 关闭、Spectre 缓解位由微码引入）需要 Intel 的专项文档，**由子代理取证**，
见 **§8.7.4 / §8.7.5**。

### 5.5 Vmin Shift Instability：0x125 → 0x129 → 0x12B → 0x12C → 0x12F

由子代理取证，见 **§8.7.4 / §8.7.5**。

---

## 6. VT-d / IOMMU 平台侧（维度 6）

### 6.1 VT-d 规范能给的（一手，已核对）

**来源**：VT-d **D51397-019, Rev 5.20, April 2026**。

- **DRHD 结构与 `INCLUDE_PCI_ALL`（§8.3）**逐字：
  > "Bit 0: INCLUDE_PCI_ALL — If **Clear**, this remapping hardware unit has under its scope **only
  > devices … explicitly identified through the 'Device Scope' field**. … If **Set**, this remapping
  > hardware unit has under its scope **all PCI compatible devices in the specified Segment, except
  > devices reported under the scope of other remapping hardware units** for the same Segment. If a DRHD
  > structure with INCLUDE_PCI_ALL flag Set is reported for a Segment, **it must be enumerated by BIOS
  > after all other DRHD structures** for the same Segment."

  → 这就是"**一个专用 DRHD + 一个兜底 DRHD**"这种客户端常见布局的规范依据：
  专用单元（历史上通常给 IGD）用 Device Scope 精确圈定，兜底单元置 `INCLUDE_PCI_ALL`。
  **规范本身不规定客户端平台必须有几个 DRHD**，那是 BIOS 决定的。
- **RMRR（§8.4）**逐字：
  > "BIOS may report each such reserved memory region through the RMRR structures, along with the devices
  > that requires access to the specified reserved memory region. … The RMRR regions are **expected to be
  > used for legacy usages (such as USB, UMA Graphics, etc.)** requiring reserved memory. Platform
  > designers should **avoid or limit use of reserved memory regions** since these require system software
  > to create holes in the DMA virtual address range…"
  > "**If there are no RMRR structures, the system software concludes that the platform does not have any
  > reserved memory ranges that are DMA targets.**"

  → "**UMA Graphics**" 被 Intel 规范逐字点名为 RMRR 的典型消费者。这是把"无核显 ⇒ 少一块 RMRR"
  这条推理**往前推了一步**，但**没有走完**：规范说的是"RMRR 常用于 UMA 图形"，
  **不等于**"没有核显就没有图形 RMRR"。→ **Gap G7**。
- **Abort DMA Mode / PMR 弃用（§3.4.4 与 Register 描述）**逐字：
  > "**New software development should not use Protected Memory Registers as they are planned for
  > deprecation in a future generation.** Abort-dma mode can be used to protect memory during DMA
  > Remapping initialization."
  → 这是一条**跨世代的软件侧变化**，对写 thin hypervisor 的人直接相关。
- Rev 5.20 的修订记录里有一条与本 ticket 相关：
  "Updated software guidance on usage of **Abort DMA Mode when RMRRs are present**."

### 6.2 VT-d 规范**不能**给的，以及从平台 datasheet 里拿到的

VT-d 规范给的是**结构格式**，不是**某个具体平台的 DMAR 内容**。
`D51397-019 Rev 5.20` 的 §8 示例（3 个 DRHD、unit #3 置 INCLUDE_PCI_ALL）是**通用示例**，
不是 LGA1700 或 LGA1851 的实际布局。

**正确的来源是 Intel 客户端平台 datasheet 的 "Intel® VT-d Key Features" 一节。**
本次通过 Specification Update 的 "Related Documents" 表拿到文档号后，直接下载并逐字抽取了**五代**：

| 平台 | datasheet | 文档号-修订 |
|---|---|---|
| **LGA1700** · Alder Lake (12 代) | 12th Generation Intel® Core™ Processors Datasheet, Vol. 1 of 2 | **655258-011**, May 2025 |
| **LGA1700** · Raptor Lake (13/14 代) | 13th Gen / 14th Gen / (Series 1)(Series 2) / Xeon E 2400 / Xeon 6300 Datasheet, Vol. 1 of 2 | **743844-015**, May 2025 |
| Meteor Lake (Ultra 100, BGA) | Intel® Core™ Ultra Processor Datasheet, Vol. 1 of 2（U/H/U-Type4） | **792044-007**, January 2025 |
| Lunar Lake (Ultra 200V, BGA) | Intel® Core™ Ultra 200V Series Processors Datasheet, Vol. 1 of 2 | **829568-004**, May 2025 |
| **LGA1851** · Arrow Lake-S (Ultra 200S) | Intel® Core™ Ultra 200S / 200S Plus / 200HX / 200HX Plus Datasheet, Vol. 1 of 2 | **832586-007**, March 2026 |

寄存器卷与芯片组（用于 §6.4 / §6.5 / §6.8）：
**655259-003**（ADL Vol.2）· **743846-001**（RPL Vol.2；注意 `743845` **不是** Vol.2，它会 403）·
**834966-001**（ARL-S Vol.2，**3 页存根，无寄存器正文**）·
**743835-004**（Intel 700 Series Chipset / Z790 PCH Vol.1）·
**833778-003**（Intel 800 Series Chipset / Z890 PCH Vol.1）。

> **取文档的三个操作陷阱**（实测）：
> 1. `ark.intel.com` 拒绝裸 `curl`（返回 568 字节存根），必须用能执行 JS 的抓取方式；
> 2. 反过来 `edc.intel.com` 的正文是 JS 注水的，只拿导航骨架，必须用 `curl` 取 PDF；
> 3. EDC 路径里的 `/secure/design/confidential/` 段**不是访问控制**——
>    Arrow Lake VT-d 的 confidential 路径变体匿名返回的是同一份公开 rev 007 内容。
>    **不要从该路径推断 NDA 状态。**

### 6.3 客户端 VT-d 能力的世代分界 —— **不在 socket 上，在 Meteor Lake 上**

本次把五份 datasheet 的 "Intel® VT-d Key Features" 节逐字对照，得到的分界线**与 ticket 的假设不同**：
断点不是 LGA1700 → LGA1851，而是 **Raptor Lake → Meteor Lake**。
Meteor Lake（BGA）与 Arrow Lake-S（LGA1851）的措辞**完全相同**。

| 特性 | **Alder Lake `655258-011`** / **Raptor Lake `743844-015`**（逐字相同，LGA1700） | **Meteor Lake `792044-007`** / **Arrow Lake-S `832586-007`**（逐字相同） | **Lunar Lake `829568-004`** |
|---|---|---|---|
| 遵循的 VT-d 规范版本 | "comply with the Intel® VT-d **2.1** Specification" | "**2.1**" | "**4.0**" |
| remap 引擎数 | "**Two** … — iGFX DMA remap engine — Default DMA remap engine (covers all devices except iGFX)" | **Two**（措辞完全相同） | "**3** … — GFx（iGD Dev2） — Non-GFX（**NPU Dev11, IPU Dev5, PMCS Dev4**） — Default（rest of PCI + IOxAPIC + HPET）" |
| GPA/HPA 宽度 | **46-bit** | **46-bit** | **42-bit** |
| 页表层数 | 4-level only（adjusted GAW 48 bits） | 同左 | 同左 |
| **super-page** | "…for **default** Intel® VT-d engine (that covers all devices except IGD)"；**"IGD Intel® VT-d engine does not support super-page and BIOS should disable super-page in default Intel® VT-d engine when iGfx is enabled."** | "**all VTd engines support super-page (2 MB, 1 GB)**" | "**All VTd engines support 4K, 2M and 1G page sizes**" |
| **Scalable Mode** | **未列出** | "**all VTd engines support Scalable mode operation (using `RID_PASID` only)**" | "All VTd engines support Scalable mode oper…" |
| **Nested translation** | **未列出** | "**default** Intel® VT-d engine support Nested translation"（**仅 default 引擎**） | （未在抽取片段中） |
| Interrupt Remapping | "is supported" | "is supported" | "Support for Interrupt Remapping **and Posted Interrupt**" |
| Device-TLB (ATS) | 未列出 | 未列出 | "Support Device-TLB for both engines for integrated accelerators" |
| Abort DMA Mode | 未列出 | 未列出 | "**Support Abort DMA Mode**" |
| Pass-through | "Intel® VT-d translation bypass address range is supported (Pass Through)" | **未列出** | 未列出 |
| 其他仅 LGA1700 列出 | "Support for 4K page sizes only"、"root entry, context entry, and the default context"、"boot protection of default page table"、"MSI cycles (MemWr to address FEEx_xxxxh) not translated" | — | — |
| 通用免责 | "Intel® VT-d Technology **may not be available on all SKUs**." | 同左 | — |

> **修正 ticket 的问题表述**：问"LGA1700 到 LGA1851 的 DMAR / 拓扑差异"会把断点找错。
> **VT-d 能力的断点在 Meteor Lake**（`792044-007`，2025-01）——
> super-page 的 IGD 例外消失、Scalable Mode 与 Nested translation 出现，都发生在这一代，
> 而 Meteor Lake 根本不是 LGA1851。
> **按 socket 建键会给出错误答案；按微架构/世代建键才对。**

### 6.4 寄存器级佐证（仅 LGA1700 侧公开）

Alder Lake / Raptor Lake 的 datasheet **Volume 2**（寄存器卷）公开了两个 VT-d 寄存器窗口
（`655259-003` §3.2.2/§3.2.3、`743846-001` §3.2.2）：

| 寄存器 | 位置 | 使能位 |
|---|---|---|
| **`GFXVTBAR`** — "GFX VT Range Base Address Register (`GFXVTBAR_0_0_0_MCHBAR_NCU`)" | **MCHBAR + `5400h`** | bit 0 `GFXVTBAREN` |
| **`VTDPVC0BAR`** — "VT DMI PEG VC0 Range Base Address Register (`VTDPVC0BAR_0_0_0_MCHBAR_NCU`)" | **MCHBAR + `5410h`** | bit 0 `VTVC0BAREN` |

两个窗口的 `CAP_REG` 默认值**不同**（`09C0000C406F0466h` 对 `08D2008C40690462h`）——
这正是 §6.3 中"IGD 引擎不支持 super-page"在硬件层面的对应物。
两者都受 **`CAPID0_A_0_0_0_PCI.VTDD`** 熔丝门控
（"VT-d Disable… 0: VT-d is supported / 1: VT-d is not supported"），
这就是 "may not be available on all SKUs" 背后的机制。
`GFXVTBAREN` 的描述另写明 "**This bit will remain 0 if VTd capability is disabled.**"

**LGA1851 侧没有对应的寄存器级公开**：Arrow Lake-S 的 Volume 2（**`834966-001`, January 2025**）
是一份 **3 页的存根**，三个寄存器章节都没有正文。
→ **"LGA1851 没有 `GFXVTBAR`"是不能说的**，那只是**出版不完整**；
Volume 1 `832586-007` 仍然明写 iGFX 引擎存在。这是必须避免的误读陷阱。

### 6.5 限定性否定声明：客户端 datasheet **根本不用 DMAR 术语**

**声明**：字符串 **`DRHD`、`DMAR`、"DMA Remapping Reporting"、`INCLUDE_PCI_ALL`
在下列七份文档中出现次数均为 0**：`655258-011`、`743844-015`、`832586-007`、
`655259-003`、`743846-001`、`743835-004`（Z790 PCH）、`833778-003`（Z890 PCH）。
（唯一例外：**Lunar Lake `829568-004` 是唯一使用 "DMA Remapping Hardware Units" 措辞的客户端 datasheet**。）

> **后果**：Intel 客户端 datasheet 描述的是**处理器具备几个硬件 remap 引擎**，
> **不是 ACPI DMAR 表里有几个 DRHD 结构**。引擎 → DRHD 的映射是 **BIOS 行为**，
> 属于 BIOS Writer's Guide（NDA）或实机 DMAR dump 的范围。
> **任何把 DRHD 数量归因于这些 datasheet 的说法都不成立。**

同理，**没有任何公开 Intel 客户端文档声明 IGD 或 USB/xHCI 的 RMRR 区域**。
`655259` 与 `743846` 中 "RMRR" 各出现两次，都在 Protected Memory Enable 寄存器描述的规范套话里
（"software is recommended to not overlap protected memory regions with any reserved memory regions of
the platform reported through the RMRR structures"），是交叉引用，不是设备清单。

VT-d 规范侧能说的（`D51397-019 Rev 5.20`）：
§8.4 "The RMRR regions are **expected to be used for legacy usages (such as USB, UMA Graphics, etc.)**"；
"The reserved memory region reporting structures are **optional**. **If there are no RMRR structures,
the system software concludes that the platform does not have any reserved memory ranges that are DMA
targets.**"；§8.3 "RMRR structures are not reported via `_DSM`, since use of reserved memory regions are
limited to legacy devices (**USB, iGFX** etc.)"。

### 6.6 KF（无核显）对直通的意义 —— 能说的和不能说的

**能说的（LGA1700 上）**，`655258-011` / `743844-015` 逐字：

> "**IGD Intel® VT-d engine does not support super-page and BIOS should disable super-page in default
> Intel® VT-d engine when iGfx is enabled.**"

> **读法**：在 12/13/14 代平台上，只要核显开着，**BIOS 就被要求把 default 引擎的 super-page 也关掉**
> ——iGPU 的存在会把整机**所有设备**的 IOMMU 页大小拉低到 4K，
> 直通场景下 IOTLB 压力与页表内存开销显著上升。触发条件是 "**when iGfx is enabled**"，KF 不满足它。
>
> **边界**：datasheet 说的是 "**BIOS should**"，是**对 BIOS 的建议**，不是处理器行为；
> 实际是否关闭取决于主板固件。**这不是可以从文档断言的实机行为。**

**并且这条从 Meteor Lake 起已经不成立**：`792044-007` 与 `832586-007` 都写
"all VTd engines support super-page"，没有 IGD 例外，也没有对 BIOS 的关闭建议。
→ **"KF 没有核显所以 IOMMU 更好"在 LGA1700 上有依据，在 Arrow Lake 上已经失效。**

**不能说的（Gap G7）**：**KF 部件的 DMAR 表里 iGFX DRHD 与图形 RMRR 到底在不在。**
已检索：ARK 265K/265KF、Series 2 桌面产品简介、`832586-007` / `655258-011` / `743844-015`、
寄存器卷 `655259-003` / `743846-001` / `834966-001`、
PCH datasheet `743835-004` / `833778-003`、VT-d 规范 `D51397-019`。
**没有一份把 F/KF SKU 与 DMAR 内容联系起来。** 只能靠实机 dump DMAR 或 NDA 的 BIOS Writer's Guide。

### 6.7 265KF 的 ARK 数据（Intel 官方，逐字）

265KF 的 ARK 页面**整节没有 "Processor Graphics" 行**。与 265K 对照：

| GPU Specifications 行 | **265KF** | **265K** |
|---|---|---|
| GPU Name | **行不存在** | "Intel® Graphics" |
| Graphics Output | **"n/a"** | "eDP1.4b, DP 2.1 UHBR20, HDMI 2.1 FRL" |
| **Xe-cores** | **"0"** | "4" |
| Intel® Quick Sync Video | **"No"** | "Yes" |
| # of Displays Supported | **"0"** | "4" |
| Device ID | **行不存在** | "0x7D67" |

Intel 的 *Core Ultra Desktop Processors (Series 2) Product Brief* 对 265KF / 265F 印的是
**"Processor Graphics: N/A"**。

**另一处与直通直接相关的差异**：**265KF 的 "Intel® Thunderbolt™ 4" = "No"**，
而 265K 与 285K 都是 **"Yes"**。这是 265K 与 265KF 之间 Expansion Options 里**唯一**的差异；
其余相同（PCIe Revision "5.0 and 4.0"、Configurations "Up to 1x16+2x4, 2x8+2x4, 1x8+4x4"、
Max PCIe Lanes "24"、DMI Revision "4"、Max DMI Lanes "8"）。

> **KF 不只是"少了核显"，还少了 Thunderbolt 4。** 对 eGPU / 外部 PCIe 直通场景是实质差异。

**NPU 仍在**：265KF 的 NPU Specifications 节与 265K **完全相同**
（NPU Name "Intel® AI Boost"、NPU Peak TOPS (Int8) "13"、Sparsity Support "Yes"）。
`832586-007` 把 NPU 描述为独立设备：
> "The NPU IP … is a Deep Learning accelerator **enumerated to a host processor as an integrated PCIe
> device**."

**但媒体引擎没了**：Quick Sync Video "No"；265K 的编解码行（H.264 / H.265 / AV1 Encode/Decode）
在 265KF 页面上整体不存在。

**Gap G16**：**KF 是物理上没有图形 tile，还是熔丝关闭。**
已检索 ARK、产品简介、`832586-007` 的 feature-overview / introduction / device-ids /
processor-graphics / processor-sku-support-matrix 各节，
字符串 "KF"、"graphics disabled"、"without graphics"、"no graphics" **均无命中**。
datasheet 只有一句通用的 "The availability of the features above may vary between different processor
SKUs."。**不从"NPU 在 + Xe-cores 0"反推 tile 级结论。**

### 6.8 PCIe / 芯片组拓扑（LGA1700 vs LGA1851）

| 项 | **LGA1700**（12/13/14 代） | **LGA1851**（Ultra 200S） |
|---|---|---|
| ARK "Max # of PCI Express Lanes" | 12900K / 13900K = **"20"** | 285K / 265K / 265KF = **"24"** |
| ARK Configurations | "Up to 1x16+4, 2x8+4" | "Up to 1x16+2x4, 2x8+2x4, 1x8+4x4" |
| datasheet 拆分 | `655258` §7.1.1：16 lane Gen5 + 4 lane Gen4 | `832586-007`："Maximum of **20 PCIe Lanes support up to Gen5** transfer rate (**16 SOC-S + 4 IOE**)"；Max Lanes 24；**Max Devices (Root Ports) = 5** |
| 分叉配置来源 | pin strap | "configured based off **Pin Strap and Soft Strap**"；IOE 侧 "set **only through the IOE Soft Straps**" |
| **DMI** | "8 lanes Gen 4 DMI support… **16 GT/s** point-to-point DMI interface to PCH" | **逐字相同** |
| 芯片组 | **Z790**：DMI x8 Gen4；chipset PCIe **28**（Gen3 ×8 + Gen4 ×20）；Integrated Thunderbolt Lanes **"NO"** | **Z890**：DMI Gen4 x8；chipset PCIe **24**，全 Gen4；Processor TBT4/USB4 ports **"Up to 2"** |

> **DMI 没有变**：两代都是 **Gen4 x8，16 GT/s**，datasheet 措辞逐字相同。
> **Z890 的芯片组 PCIe 总通道数反而比 Z790 少**（24 vs 28），但全部升到 Gen4、不再有 Gen3。
> USB4 host router 章节在 Alder Lake datasheet 里**就已存在**
> （slug `usb-4-host-router-implementation-capabilities`），
> 所以 **USB4 硅片不是 LGA1851 新增的**；变的是产品化
> （ARK 在 12900K/13900K 上根本不列 Thunderbolt 字段）。

### 6.9 SR-IOV —— 本次最需要纠正的一条，且 **Intel 与上游内核不一致**

**先收回一个中途结论**：只读 datasheet 时可以得到"四份 datasheet 中 SR-IOV 命中为 0"。
那条**作为 datasheet 层面的事实成立**，但**不能**用来推断"客户端 iGPU 不支持 SR-IOV"——
Intel 的答案在**支持文章**里，不在 datasheet 里。

**Intel 支持文章 000093216, "Graphics Virtualization Technologies Support for Each Intel® Graphics
Family", Last Reviewed 2026-05-27**（逐字）：

> "The latest of these technologies been **Single Root IO Virtualization (SR-IOV)** which replaced the
> previous Intel® Graphics Virtualization Technology –g (GVT-g). **Current SR-IOV support is available
> for systems running Linux as the host operating system with Windows or Linux guest virtual machines.**"

客户端相关行（逐字）：**Panther Lake — SR-IOV**；**Arrow Lake — SR-IOV**；
**Lunar Lake — "Not Supported"**；
**Meteor Lake — "SR-IOV (Supported on Linux host with Windows/Linux virtual machines)"**；
**Raptor Lake / Raptor Lake Refresh — SR-IOV**；**Alder Lake — SR-IOV**；
**Tiger Lake — "Not Supported"**；Rocket Lake / Ice Lake / Comet Lake 及更早 — **GVT-g**。

> **"SR-IOV 只有 Flex/Max 数据中心卡才有"这个常见说法是错的**——
> Intel 官方对客户端 iGPU 宣称支持 SR-IOV，**但限定 Linux 宿主**。

**上游内核与这条宣称不符（T2，已直接核对 `drivers/gpu/drm/xe/xe_pci.c` master）**：
`.has_sriov = true` 出现在 `tgl_desc`、`adl_s_desc`、`adl_p_desc`、`adl_n_desc`、`ats_m_desc`、
`bmg_desc`、`ptl_desc` 等；**`mtl_desc` 与 `lnl_desc` 上没有**。
**Arrow Lake 没有自己的 descriptor**：`INTEL_ARL_IDS(INTEL_VGA_DEVICE, &mtl_desc)`
——继承 Meteor Lake 的，因此也继承了"无 SR-IOV"。上游 `i915` **完全没有** SR-IOV 代码。

**调和**：MTL/ARL 的 SR-IOV 走的是 **Intel 的 out-of-tree i915**，不是上游。
Intel 自有仓库 `github.com/intel/edge-gfx-dkms-installer` 以 DKMS 形式提供 i915 + kvmgt，
自述 "with out-of-tree patches that deliver functionality not yet merged into the upstream kernel"，
Supported Platforms 明列 Meteor Lake 与 Arrow Lake。

**对 265KF 而言这一整节事实上不适用**：没有核显就没有可虚拟化的 iGPU 函数。

仍存的缺口：**G12b**（Lunar Lake 为何 "Not Supported" 而 MTL/ARL/PTL 支持）、
**G12c**（Intel 只肯定性地限定到 Linux 宿主，从未明说 Windows 宿主不支持）、
**G12d**（Intel 内部不一致：支持文章 000058558(2021) 说 SR-IOV 从 Tiger Lake 起，
而 000093216(2026) 把 Tiger Lake 列为 "Not Supported"）。

## 7. 缺口清单（Gaps）

> 本仓库的纪律：**查不到就声明缺口，不填塞**。以下每条都写明"查了哪里、为什么没查到、怎么才能补上"。

| ID | 缺口 | 查过的范围 | 补齐路径 |
|---|---|---|---|
| ~~G1~~ | ~~每代客户端部件的 Stepping ID 取值~~ | **已关闭** —— 10 份 Specification Update 的 §2.1 Component Identification 表已全部抽取，见 §1.4 | — |
| **G1b** | 265KF（8P+12E）的实际 stepping。§1.4 的表列的是**芯片配置**（8P+16E / 6P+8E），不是 SKU | `834774-023` Table 2-1 无 8P+12E 行 | 265KF 上读 `CPUID.01H:EAX`，核对是否 = `C0662h` |
| **G1c** | 源文档内部冲突：Ice Lake `341079-023` 的 Y 行 CPUID 列与 Stepping ID 列不一致；Panther Lake `869992-008` 两个不同 stepping 名（A0 / B0）对应同一 CPUID Stepping ID | 两份文档的 Component Identification 表 | SDM Documentation Changes（252046 系列）或下一修订 |
| **G2** | Core Ultra 200S（Arrow Lake-S，含 265KF）**是否支持 IPI Virtualization** | SDM-V1 Table 5-2 只把 200**H** 列为引入代；Table 5-2 是"引入点"表不是"支持矩阵" | 265KF 上读 `IA32_VMX_PROCBASED_CTLS3`（MSR `492H`）**bit 4**；先确认 `IA32_VMX_PROCBASED_CTLS`（`482H`）bit 49 = 1。**一条 RDMSR 即可判定** |
| **G3** | 客户端是否支持 "Virtualize `IA32_SPEC_CTRL`" VM-execution control | 同上，Table 5-2 该行无任何客户端条目 | 同上，读 `492H` **bit 7** |
| **G3b** | 客户端各代对 tertiary controls 其余位（HLAT=1 / EPT paging-write=2 / guest-paging verification=3 / APIC-timer virtualization=8 / PEBS-GPA=12）的支持情况 | SDM Table 27-8 给了位定义，Table 5-2 只覆盖了 VT-rp 与 IPI virt 两行 | 逐代实机读 `492H`；这正是型号轨道该存的数据形状 |
| **G4** | **`IA32_VMX_*`（480H–492H）的取值是否跨 P/E 核一致** | SDM-V4 Table 2-47/48/54/55/59/60 全部 register address 已逐一核对，无 48xH；SDM-V3D Appendix A 通篇用 "the logical processor" 措辞但无一致性承诺 | 265KF 上对 20 个 LP 各读一遍 480H–492H 并比对（265KF 无 SMT，20 LP = 20 核，8 P + 12 E） |
| **G5** | SDM 是否禁止在 **VMX root operation** 中加载微码 | 已检索 SDM-V3A §12.11 全部子节、SDM-V3C Ch.26/27/28、SDM-V3D App.A、SDM-V4 Table 2-2 条目 79H/7BH/7CH/1406H；**只找到 non-root 下是 no-op 的规定** | 若需正面结论，须查 Intel 的 microcode update BIOS writer's guide（可能 NDA） |
| **G6** | SDM-V4 093 内部措辞冲突：`IA32_MCU_ENUMERATION` 的 `UNIFORM_MCU_SCOPE` 在 bit 0 描述里写 "bits [10:8]"，在字段行里写 `15:8` | SDM-V4 335592-093US Table 2-2, Register Address 7BH | 查 SDM Documentation Changes（252046 系列）是否已收录；或下一修订 |
| **G7** | **KF 部件的 DMAR 表里 iGFX DRHD 与图形 RMRR 到底在不在** | VT-d D51397-019 Rev 5.20 §8.3/§8.4；四份平台 datasheet 的 VT-d Key Features 节（描述的是**处理器具备的引擎**，DMAR 内容由 BIOS 生成） | 265KF 实机 dump ACPI DMAR，与一台带核显的 Arrow Lake-S 对比 |
| ~~G8~~ | ~~LGA1700 → LGA1851 的 VT-d 差异~~ | **已关闭** —— 由 `655258-011` / `743844-015` / `832586-007` / `829568-004` 四份 datasheet 逐字对照得出，见 §6.3 | PCIe 通道数 / 芯片组 / DMI 侧的差异仍未取证 → 见 G8b |
| **G8b** | LGA1700 → LGA1851 的 **PCIe 通道数、Z790 vs Z890、DMI 代次、Thunderbolt/USB4 集成**差异 | 本次只抽取了 datasheet 的 VT-d 节 | 同两份 datasheet 的 PCIe / DMI 章节；或 §8.8 |
| **G9** | **本 session 无法做任何 Intel 实机验证** | 执行环境 CPU 经 `Win32_Processor` 确认为 **AMD Ryzen 9 9950X3D（AMD64 Family 26 Model 68 Stepping 0，16C/32T）**，不是用户的 265KF | 所有标注"可实测"的项都需要在 265KF 上另行执行 |
| **G10** | **Hyper-V / Windows 在混合 CPU 上的行为**，以及是否有与 ESXi 对应的均一性假设 | learn.microsoft.com 与 techcommunity.microsoft.com 在子代理环境中不可达（五次尝试 socket closed）。已核实：**Hypervisor TLFS v6.0b (February 2020) 全文对 hybrid / heterogeneous / asymmetric 零覆盖**，但该文档早于 Alder Lake | 换一个能访问 learn.microsoft.com 的环境重跑；或在 265KF 上直接观测 Hyper-V 行为 |
| **G11** | **Intel 对 HX 部件是否受 Vmin Shift Instability 影响自相矛盾**：Community "Unaffected Products List"(2024-08-30) 明列 HX 不受影响；`740518-031` Summary Table of Changes 把 HX / HX-Refresh 8P+16E 标为 RPL063 **"No Fix"**。两者是同一块 `B0671h` 硅片、收同一份 `06-b7-01` 微码 | Intel Community 五篇公告、支持文章 000102331、`740518-031` 全文 | 未找到调和文档。**不裁决**，引用时必须同时给出两种说法 |
| ~~G12~~ | ~~Intel 客户端 iGPU 的 SR-IOV 现状~~ | **已关闭** —— Intel 支持文章 **000093216**（Last Reviewed 2026-05-27）明列 Alder/Raptor/Arrow/Panther Lake 为 **SR-IOV**、Lunar Lake 为 "Not Supported"，**且限定 Linux 宿主**。见 §6.9 | — |
| **G12b** | Lunar Lake 为何是 "Not Supported"，而 MTL / ARL / PTL 支持 | intel.com、edc.intel.com、eci.intel.com、kernel git log | — |
| **G12c** | Intel 是否**明确**排除 Windows 宿主 | 000093216 只**肯定性地**把 SR-IOV 限定到 Linux 宿主，从未写 Windows 不支持 | — |
| **G12d** | Intel 内部不一致：支持文章 **000058558**（2021）说 SR-IOV 从 Tiger Lake 起；**000093216**（2026）把 Tiger Lake 列为 "Not Supported"、把 Ice Lake / Rocket Lake 列为 GVT-g | 两篇支持文章 | **不裁决**，引用时并列两说 |
| **G13** | Lunar Lake datasheet 明列 "Interrupt Remapping **and Posted Interrupt**"，而 LGA1700/LGA1851 两份只写 "Interrupt Remapping is supported" —— 是能力差异还是措辞差异 | 四份 datasheet 的 VT-d Key Features 节 | 实机读 VT-d Capability Register 的 PI 位 |
| **G14** | ESXi 均一性检查**具体比较哪些量**、其 CPUID leaf / MSR 来源 | knowledge.broadcom.com、techdocs.broadcom.com、community.broadcom.com | vmkernel 闭源。§8.6.2 中把三个拓扑名归到 `04H`/`0BH`/`1FH` 是**推断，非厂商来源**，不得当作已证实 |
| **G15** | SDM 的 microcode 一节从 Ch.9 → Ch.10 → Ch.11 → Ch.12 具体在哪个修订改的 | 只确认了 **093 修订中是 Vol.3A Ch.12 §12.11** | 逐修订比对，或查 Documentation Changes 252046 系列 |
| **G16** | 265KF 是**物理上没有图形 tile**，还是**熔丝关闭** | ARK、Series 2 桌面产品简介、`832586-007` 的 feature-overview / introduction / device-ids / processor-graphics / processor-sku-support-matrix 各节；"KF" / "graphics disabled" / "without graphics" / "no graphics" 均无命中 | 不从 "NPU 在 + Xe-cores 0" 反推 tile 级结论 |
| **G17** | **Panther Lake 的 SMT 缺乏 Intel 肯定性陈述** | ARK SKU 页与 Series 3 系列页；线程数 = 核数，但 "Intel® Hyper-Threading Technology" **整行不存在**（不是写了 "No"） | Series 3 datasheet（未定位到）；或实机 `CPUID.1FH` |
| **G18** | Intel 没有定义复合后缀 **"KF"** | *Processor Names, Numbers and Generation List*、*What Do the Letters Mean…*（2025-12-09）两页都只分别定义 K 与 F，不列 KF（也不列 KS / HX） | — |

---

## 8. 勘误通道（维度 5）与其余子代理取证

### 8.1 每代客户端 Specification Update —— 文档号全表

以下 10 份文档**全部已下载并打开封面核对**，文档号是从 PDF 封面 `Document Number:` 行读出来的，
不是拼出来的。修订号与日期同样来自封面。

| 世代 | 封面完整标题 | 文档号 | 修订 | 日期 |
|---|---|---|---|---|
| 10th · Comet Lake | *10th Generation Intel® Core™ Processor Specification Update* — "…for U, H, and S Processor Line Platforms, formerly known as **Comet Lake**" | **615213** | 013 | April 2023 |
| 10th · Ice Lake | *10th Generation Intel® Core™ Processor Specification Update* — "…for U/Y Processor Line Platforms, formerly known as **Ice Lake**" | **341079** | 023 | April 2026 |
| 11th · Rocket Lake | *11th Generation Intel® Core™ Processor Specification Update* — "…for S Processor Line Platforms, formerly known as **Rocket Lake**" | **634808** | 012 | April 2023 |
| 11th · Tiger Lake | *11th Generation Intel® Core™ Processor Specification Update* — "…UP3, UP3 IOT, UP4, H35, H81, UP3-Refresh, H35-Refresh…formerly known as **Tiger Lake**" | **631123** | 034 | April 2026 |
| 12th · Alder Lake | *12th Generation Intel® Core™ Processor Specification Update* — "…for S, H, U, P, and HX Processor Line Platforms, formerly known as **Alder Lake**" | **682436** | 040 | September 2026 |
| **13th + 14th** · Raptor Lake | *13th Generation Intel® Core™, Intel® Core™ 14th Generation, Intel® Core™ Processor (Series 1) and (Series 2), and Intel® Xeon™ E 2400 Processor, and Intel® Xeon™ 6300 Processor — Specification Update* | **740518** | 031 | September 2026 |
| Ultra 100 · Meteor Lake | *Intel® Core™ Ultra Processor Specification Update* — "…H, U, U Type4…formerly known as **Meteor Lake**" | **792254** | 024 | September 2026 |
| Ultra 200V · Lunar Lake | *Intel® Core™ Ultra 200V Series Processors Specification Update* | **827538** | 022 | September 2026 |
| Ultra 200S/H/U · Arrow Lake | *Intel® Core™ Ultra Processors (Series 2) Specification Update* — "…200S, 200HX, 200H, 200U…formerly known as **Arrow Lake**. Supporting…200S Plus, 200HX Plus…formerly known as **Arrow Lake Refresh**." | **834774** | 023 | September 2026 |
| Ultra Series 3 · Panther Lake | *Intel® Core™ Ultra (Series 3) and Intel® Arc™ G3 Processors Specification Update* — "…formerly known as **Panther Lake**; …Arc™ G3…formerly known as Panther Lake Handheld / H284" | **869992** | 008 | September 2026 |
| （旁支）Alder Lake-N / Twin Lake | *Intel® Processor and Intel® Core™ i3 and Intel® Core™ 3 N-Series Specification Update* | **764616** | 004 | January 2025 |

### 8.2 取文档的机制（可写进 bibliography 替换裸 `edc.intel.com`）

- **文档号 → PDF（最可靠）**：`https://cdrdv2.intel.com/v1/dl/getContent/<DOCNUM>`，302 到当前公开修订。
  **不要自己拼文件名**——分隔符不一致（`615211-008.pdf` 对 `682436_040.pdf`）。

> **两个必须写进 bibliography 的检索陷阱**：
> 1. **10 代与 11 代各有两份标题完全相同的 Specification Update**
>    （10 代：Comet Lake `615213` 与 Ice Lake `341079`；11 代：Rocket Lake `634808` 与 Tiger Lake `631123`），
>    连 intel.com 的 slug 都一样——**只有文档号能区分它们**。
> 2. **`615211` 与 `636761` 是 datasheet，不是 Specification Update**，搜索引擎经常把两者混为一谈。
- **落地页**：`https://www.intel.com/content/www/us/en/content-details/<DOCNUM>/<slug>.html`。
  slug 是装饰性的：传任意 slug 也会被重定向到正规 URL 并返回 200。**文档号本身就够了。**
- **EDC HTML 阅读器**：
  `https://edc.intel.com/content/www/us/en/design/products/platforms/details/<platform>/<doc>/`
  下有 `errata-details/`、`summary-tables-of-changes/`、`specification-changes/`、
  `identification-information/`、`revision-history/` 等子页；在子页前插 `/NNN/` 可钉到某一修订。
- **避免** `edc.intel.com/output/DownloadPdfDocument?id=<N>`：那个 `id` 是 EDC 内部键、不是文档号，
  且会钉在陈旧修订上。
- **公开 / NDA 的判别器**：`getContent` 的 302 目标即答案——
  公开 → `cdrdv2-public.intel.com`；受限 → 302 到 `login.microsoftonline.com/.../saml2`；不存在 → 404。

**限定性否定声明**：**本 ticket 范围内的 10 份客户端 Specification Update 全部可匿名公开下载，
没有一代的客户端勘误是 NDA-only。** 验证方式：10 份 PDF 均在无凭据条件下由 `cdrdv2-public` 取得。
（NDA 通道确实存在，但覆盖的是别的文档，例如 615210 / 616599 / 618459 / 619502 会 302 到 SAML 登录。）

### 8.3 虚拟化相关勘误 —— 跨代复现的那几条

勘误 ID 在各代文档里用代号前缀（CML / ICL / RKL / TGL / ADL / RPL / MTL / LNL / ARL / PTL）。
以下是**同一个硅片问题在多代文档中重复出现**的条目，对知识库最有价值：

| 问题 | 各代勘误 ID |
|---|---|
| *Certain VMCS Fields May be Incorrect During STM to VMX Transitions*（VM-entry control "Load `IA32_RTIT_CTL"` bit 18 开启 Intel PT 时，VMCS 字段 `4016h`/`4018h`/`401Ah` 可能错误，并可能误报 IDT-vectoring 字段 `4408h`） | **TGL073, ADL088, RPL075, MTL076, LNL059, ARL063** |
| *Incorrect VM Exit Reason When MOV SS or POP SS Followed by an x2APIC MSR Access* | **ADL094, RPL080, MTL083, LNL072, ARL076, PTL044** |
| *Instruction Timeout VM Exit Will Not Set Guest `RFLAGS.RF` During #UD* | **RPL077, MTL078, LNL063, ARL067, PTL027** |
| *Intel VT-d Remapping Hardware Does Not Perform Reserved(0) Check on PGSNP Field of Scalable-mode PASID Table Entry* | **MTL003, LNL002, ARL002, PTL003** |
| *VM Entry That Clears TraceEn May Generate a FUP* | **CML023, ICL030, RKL030, TGL051, ADL032, RPL025** |
| *Single Step on Branches Might be Missed When VMM Enables Notification On VM Exit* | **ADL025, RPL014, MTL050, ARL001** |
| *VM Exit Qualification May Not be Correctly Set on APIC Access While Serving a User Interrupt* | **ADL049, RPL032, MTL047, ARL018** |
| *ICR Read May Not Generate an APICAccess VM Exit* | **LNL066, ARL070, PTL034** |
| *Incorrect Guest `RFLAGS.RF` on VM Entry* | **LNL070, ARL074, PTL038** |

**对 Windows 知识库最相关的一条（本次逐字复核过原文）** ——
`834774-023` **ARL029**（Lunar Lake 侧编号 **LNL033**）：

> **ARL029 — Incorrect Core TLB Entry May be Retrieved Following VM Exit**
> **Problem**: "An incorrect Core TLB entry may be retrieved when the retrieval is not completed prior to
> VM exit."
> **Implication**: "Due to this erratum, **hypervisor software may read an invalid value following VM
> exit, leading to Windows Bug Check `HYPERVISOR_ERROR` (20001h) or `SECURE_KERNEL_ERROR` (18Bh)**."
> **Workaround**: "It may be possible for the BIOS to workaround this erratum."
> **Status**: "For the steppings affected, refer to the Summary Table of Changes."

> **这是 Intel 自己把一个客户端硅片勘误直接映射到 Windows Bug Check 代码的罕见例子**，
> 且**修法在 BIOS 侧**。用户的 265KF 正在这条勘误的适用范围内（ARL-S）。

各代 VMX/VT-d 相关的独有条目（按标题匹配计数：CML 22、ICL 9、RKL 3、TGL 4、ADL 12、RPL 10、
MTL 7、LNL 9、ARL 11、PTL 6），其中值得单列的：

- **ADL020 / RPL030** *VMX-Preemption Timer May Not Work if Configured With a Value of 1*
- **ADL008 / RPL009** *System May Hang When Bus-Lock Detection Is Enabled and EPT Resides in Uncacheable Memory*
- **ADL005 / RPL006** *Exit Qualification For EPT Violations on Instruction Fetches May Incorrectly Indicate That The Guest-physical Address Was Writeable*
- **ADL080 / RPL066** *VM Exit Following MOV to CR8 Instruction May Lead to Unexpected IDT Vectoring-Information*
- **ADL041** *Processor Loads `PERF_GLOBAL_CTRL` MSR Value From SMM Transfer VMCS Upon STI When STM is Configured*
- **ICL021** *When Virtualization Exceptions are Enabled, EPT Violations May Generate Erroneous Virtualization Exceptions*（`#VE` 与 suppress-#VE 位）
- **ICL070** *VT-d Domain-Specific Context Cache Invalidation Requests May Not Complete*
- **CML001** *Reported Memory Type May Not Be Used to Access the VMCS and Referenced Data Structures*
- **CML028** *A VMX Transition Attempting to Load a Non-Existent MSR May Result in a Shutdown*
- **CML118** *Graphics VTd Hardware May Cache Invalid Entries*
- **PTL028** *Incorrect MSR Data Saved on `WRMSRLIST` VM-Exit for MSR 0h*（新 ISA 与 VMX 的交互）

**限定性否定声明**：**在本次检索的 10 份客户端 Specification Update 中，没有任何 TDX 或 SEAM 勘误。**
这与 SDM 侧"TDX 为服务器专属"的结论一致。

> **注意勘误的 Status 措辞**：每条都是
> "For the steppings affected, refer to the **Summary Table of Changes**"
> ——**勘误是按 stepping 生效的**。这是 §1.4 的 stepping 维度必须存在的第二个理由。

### 8.4 文档命名约定的三次断裂（影响"怎么找文档"）

1. **到 12 代为止**格式固定：*"Nth Generation Intel® Core™ Processor Specification Update"*，
   平台只在副标题里用 "formerly known as …" 区分。
2. **13/14 代被合并进一份文档**：**不存在独立的 14 代 Specification Update**。
   `740518` 的标题把 14 代、改名后的 "(Series 1) and (Series 2)"、
   以及 **Xeon E 2400 / Xeon 6300** 一并吸收——一份名义上的客户端文档里挂了 Xeon 部件。
3. **Core Ultra 时代放弃世代编号**，且不一致：
   `792254` 是裸 *"Intel® Core™ Ultra Processor"*；`827538` 用 SKU 族名 *"Core™ Ultra 200V Series"*；
   `834774` 用 *"(Series 2)"*；`869992` 用 *"(Series 3)"* **外加一个 GPU 品牌**
   *"and Intel® Arc™ G3 Processors"*。

> **Intel 在文档上从不写 "Core Ultra 300"，写的是 "Series 3"。**
> 本 ticket 标题里的 "Core Ultra 300" 是市场口径，检索时必须换成 "Series 3" 或 Panther Lake。

### 8.5 由 Specification Update 顺带取得的平台 datasheet 文档号

`834774-023` §1.2 "Related Documents" 列出（可用于攻 §6.2 / Gap G8）：

| 文档 | 文档号 |
|---|---|
| Intel® Core™ Ultra 200S and 200HX Series Processor Datasheet, Volume 1 of 2 | **832586** |
| Intel® Core™ Ultra 200S and 200HX Series Processor Datasheet, Volume 2 of 2 | **834966** |
| Intel® Core™ Ultra 200H and 200U Series Processor Datasheet, Volume 1 of 2 | **842704** |
| Intel® Core™ Ultra 200H and 200U Series Processor Datasheet, Volume 2 of 2 | **844261** |

`834774-023` §2.2 另外逐字确认了 **S / S Plus 系列封装为 "Pin Count: **1851**，
Package Size 37.5mm x 45mm"** —— 即 **LGA1851**，与 265KF 一致。

### 8.6 ESXi "Fatal CPU mismatch on feature" —— 裁决：**是 ESXi 的假设问题，不是硅片不一致**

#### 8.6.1 KB 与开关（T1 / T2）

**Broadcom KB 395554, "ESXi PSOD with 'Fatal CPU mismatch on feature'"**
（`https://knowledge.broadcom.com/external/article/395554/esxi-psod-with-fatal-cpu-mismatch-on-fea.html`，
页内 JSON-LD 记 `datePublished / dateModified = 08-18-2025`）。全文逐字：

> **Cause**: "Starting with ESXi 7.0, **a CPU uniformity check is enforced**. A PSOD may occur if a
> mismatch in CPU features is detected."
> **Resolution**: "To bypass the CPU uniformity check:" → 开机 `SHIFT+O` 追加
> **`cpuUniformityHardCheckPanic=FALSE`**；持久化用
> `esxcli system settings kernel set -s cpuUniformityHardCheckPanic -v FALSE`；
> "Request the Hardware vendor to ensure the uniformity of CPU features."

**ticket 里猜的拼写是对的**：`cpuUniformityHardCheckPanic`。VMware 自己的 kernel setting 描述串（T2）：

| 选项 | VMware 原文描述 | 默认 |
|---|---|---|
| `cpuUniformityHardCheckPanic` | "**Panic if CPU uniformity hard check fails**" | TRUE |
| `ignoreMsrFaults` | "**Ignore general protection faults as a result of rdmsr and wrmsr instructions**" | FALSE |
| `timerForceTSC` | "Always use TSC as system reference timer."（7.0U1–U3）→ "**Obsolete option, do not use.**"（8.0a 起） | 见左 |

**语义要点**：这个开关**不关闭检查，只关闭检查失败时的 panic**。
引入于 **ESXi 7.0 U2**（7.0 U1 的 kernel settings 列表中不存在，U2 中存在），
在 **ESXi 9.0.0 Build 24755229 中仍然存在且默认仍为 TRUE**。
`timerForceTSC` **不是**混合架构的解法，是 TSC 参考计时器开关，8.0 起标注废弃——**不要混用**。
13 代的 `GP Exception 13 in world` 另需 `ignoreMsrFaults=TRUE`。

**限定性否定声明**：**不存在任何一篇 Broadcom/VMware KB 点名 Intel 混合 CPU 或声明其支持状态。**
KB 395554 全文无 "hybrid" / "Alder Lake" / "12th generation" / "P-core" / "E-core" 字样，
其建议（"Request the Hardware vendor to ensure the uniformity of CPU features"）是照固件 bug 写的。
检索范围：knowledge.broadcom.com、techdocs.broadcom.com、community.broadcom.com。

#### 8.6.2 ESXi 到底在比什么 —— 决定性证据

panic 串（T3，virten.net 从 12 代实机紫屏转录）：

```
HW feature incompatibility detected; cannot start
Fatal CPU mismatch on feature "Hyperthreads per core"
Fatal CPU mismatch on feature "Cores per package"
Fatal CPU mismatch on feature "Cores per die"
```

完整格式（T3，Broadcom 社区另一例，非混合场景）：

```
Fatal CPU mismatch on feature "Intel processor platform type identifier";
cpu7 value = 0x1004195c, but cpu0 value = 0x10041a5c
```

→ **每个 PCPU 都与 PCPU 0 比对**。

**裁决所需的关键观察**：12 代上触发 panic 的三个 feature 名
——`"Hyperthreads per core"`、`"Cores per package"`、`"Cores per die"`——
**全部是拓扑计数，没有一个是 ISA 功能位**。
而第四个已知名字 `"Intel processor platform type identifier"` 指向的是 **MSR `17H`（`IA32_PLATFORM_ID`）**，
**根本不是 CPUID**。

按 §3.2 的 Domain 判据：拓扑计数来自 `CPUID.04H` / `0BH` / `1FH`，
其中 `04H` 全部字段、`1FH` 的 `EBX[15:0] NEXT_LEVEL_NUM_LP` 均为 **Logical Processor Domain**，
**SDM 明文允许它们逐 LP 不同**。

**更进一步**：`IA32_PLATFORM_ID`（MSR `17H`）在 SDM-V4 Table 2-2 中只定义了 `bits 52:50` 为 Platform ID，
其余为 Reserved。一位 VMware 工程师（Tim Mann）在社区帖中承认（T3）：
> "This is actually a bug. Intel specifies only bits 52:50 of MSR 0x17 to be architectural. The other
> bits are reserved, so **the vmkernel shouldn't insist that those bits be the same across all cpus**."

**裁决**：

> **ESXi 在比较的，是 Intel 架构上从未承诺过一致的量**（Logical Processor Domain 的拓扑字段，
> 以及一个 MSR 的 Reserved 位）。**硅片没有违反任何规范。**
> 这是 **hypervisor 侧的均一性假设问题**，修法在 hypervisor（或用 VMware 提供的开关绕过），
> **不是**"BIOS/微码把平台配错了"那一类问题。
>
> 反之，如果 panic 的 feature 名指向的是 **Platform Domain 的 ISA 功能位**
> （AVX-512、VMX、SGX…），那才是平台确实处于 SDM 所说的 "not properly configured" 状态，
> 修法在 BIOS/微码侧。**判据就是 §3.2 的 Domain 列。**

**VMware 侧的立场**（T3，但来自 VMware Staff Solution Architect William Lam 的博客）：
> "ESXi is currently **not aware of this new architecture** and it currently **expects all cores within a
> CPU package to have uniform characteristics**."
> "The ESXi scheduler **does not and has no current plans to support** this new Intel Hybrid CPU
> architecture, especially as this type of architecture is nowhere to be found in traditional Enterprise
> datacenters and is only limited to Intel Consumer CPUs."
> "While you can apply a workaround to have ESXi ignore the non-uniformity of the CPU cores, in addition
> to the non-deterministic behaviors, **random PSOD can also occur due to scheduling across two different
> types of cores**."

→ 即便加了 `cpuUniformityHardCheckPanic=FALSE`，**调度器层面的不支持依然存在**。
这条必须与开关一起给出，否则会把"能开机"误读成"支持"。

**限定性否定声明**：**VMware / Broadcom 从未公开过均一性检查所比较的 feature 清单，
也没有公开这些 feature 名到 CPUID leaf / MSR 的映射。** vmkernel 闭源，唯一公开证据就是 panic 串本身。
上文把三个拓扑名归到 `04H`/`0BH`/`1FH` 是**推断，不是厂商来源**，必须标注为未核实。

#### 8.6.3 Intel 的"交集"原则 —— 这次拿到了最硬的一句

**SDM-V3B 325462-093US, §22.2.9.2 "Reporting Per Logical Processor"**（逐字）：

> "`CPUID.23H` provides a true-view of per logical processor PMU capabilities. … **Software must not make
> assumptions that `CPUID.23H` would report any value the same on another logical processor.** It is
> required to read `CPUID.23H` on every logical processor… It is a requirement of software to compare and
> determine common features between logical processors if required by iterating over each logical
> processor's `CPUID.23H`.
> **Conversely, `CPUID.0AH` provides a maximum common set of capabilities across logical processors when a
> feature is not supported by all logical processors.**"

同节 NOTE：
> "Locating a PMU feature under `CPUID.23H` **alerts software that the feature may not be supported
> uniformly across all logical processors**."

§22.2.9.3：
> "This capability enables a **virtual-machine monitor to reserve lower-index counters for its own use,
> while exposing higher-index counters to guest software**. This is especially important should the
> general-purpose counters **not be fully homogeneous**."

> **"`CPUID.0AH` provides a maximum common set of capabilities" 就是"交集"的架构原文。**
> 它解释了为什么 §3.2 的 Domain 表把 `0AH` 标成 Platform Domain，
> 而底层 PMU 明明不同（Gracemont 6 个 GP 计数器 vs Golden Cove 8 个，SDM-V3B Table 22-53 / 22-57）：
> **Intel 用"旧 leaf 报交集 / 新 leaf 报真值"的手法维持 Platform Domain 的承诺。**
> 与 §3.6 的 RDT 条款（`0FH`/`10H` 报 common set，`27H`/`28H` 报逐 LP 真值）是同一个模式。

#### 8.6.4 AVX-512：Intel 的三份一手材料

1. **Intel Optimization Reference Manual, Document 248966-050US, April 2024, §2.3.1**（逐字，最权威）：
   > "A key OSV requirement for enabling hybrid is **symmetric ISA** across different core types… In 12th
   > Generation Intel Core processors supporting performance hybrid architecture, **ISA is converged to a
   > common baseline** between the P-cores and E-cores. **To maintain symmetric ISA, the E-cores do not
   > support the following features: Intel AVX-512, Intel AVX-512 FP-16, and Intel® TSX. The E-cores do
   > support Intel AVX2 and Intel AVX-VNNI.**"
2. **Intel white paper 348851-001US, "Optimizing Software for Intel performance hybrid architecture",
   Rev 1.0, October 2021, §1.1** —— 同样的 "symmetric ISA / converged to a common baseline" 措辞。
3. **Intel Game Dev Guide for 12th Gen Intel Core Processor（updated 6/13/2022）**：
   > "● All core types have the same instruction set. ● **AVX512 is disabled on P-cores and not available
   > on E-cores.**" 表 1：`AVX512 | Disabled in P-cores and N/A in E-cores`；
   > `TSX | Disabled in P-cores and E-cores`。
4. **Intel support article 000089918, "Is AVX-512 Fused Off on Alder Lake Client Products?"（03/25/2022）**：
   > "AVX-512 will be **fused off** on Alder Lake mobile products and most desktop products."
   > "Although AVX-512 was **not fuse-disabled** on certain early Alder Lake desktop products, Intel plans
   > to fuse off AVX-512 on Alder Lake products going forward."

**限定性否定声明**：**没有任何 Intel 文档声明"关闭 E 核即可启用 AVX-512"。**
检索范围：intel.com 支持文章、**12 代 Specification Update `682436`（rev 007 与 rev 040 均查过，
`grep -i "avx.?512"` 命中为 0）**、Optimization Reference Manual、SDM。
该做法只存在于媒体与 BIOS 改机社区（T3）——**不得作为 Intel 立场引用**。

#### 8.6.5 Intel 自己划的"哪些东西对软件可见地不一样"

**Intel white paper 348851-001US Rev 1.0, §6.1 "What are the ISA differences visible to software?"**（逐字）：

> "Some ISA differences are visible to software. Examples include:
> 1. **Structural differences (TLB, cache, topology) between P-cores and E-cores.**
> 2. **Some aspects of Performance Monitoring, Intel Processor Trace, Last Branch Records, and MCA ISA.**
> 3. **Some model specific MSRs.**
> The expectation is that these differences are not going to impact software applications."

**Intel Game Dev Guide**（逐字）：
> "**CPUID, by design, returns different values depending on the core it is executed on. On hybrid cores
> more of the CPUID leaves will have data that varies**, meaning that if cores are used to generate a
> hash for encryption, or to generate a unique seed for random number generation, you should be careful
> to only use leaves that contain data that doesn't change between core types."

> 注意最后一句的措辞：Intel 说的是 "**by design**"。
> "CPUID 在所有核上返回相同值"这句流传甚广的说法**在任何 Intel 文档里都找不到**
> （已检索 SDM CPUID 各章、Intel "CPUID Enumeration and Architectural MSRs" 文章 ID 758381、
> 两份 hybrid 白皮书）。**这条应进 `errata.md`。**

#### 8.6.6 其他 hypervisor 的做法（对照组）

- **Linux（T2，`arch/x86/kernel/cpu/common.c::identify_cpu()`）**：不 panic，**取交集**——
  ```c
  /* AND the already accumulated flags with these */
  for (i = 0; i < NCAPINTS; i++)
      boot_cpu_data.x86_capability[i] &= c->x86_capability[i];
  ```
  外加 `X86_FEATURE_HYBRID_CPU`（`18*32+15`，注释 "This part has CPUs of more than one type"）。
- **KVM（T2，`arch/x86/kvm/cpuid.c`）**：**对 guest 完全隐藏混合性**——
  `CPUID_7_EDX` 的枚举列表中**没有** `HYBRID_CPU`（整个文件 `grep -i hybrid` 零命中）；
  `__do_cpuid_func()` **没有 `case 0x1a`**，落到 `default:` 把 EAX/EBX/ECX/EDX 全清零。
  即 **guest 既看不到 hybrid 位，也看不到 leaf 1AH**。
- **Hyper-V / Windows**：**GAP G10**。子代理所在环境无法访问 learn.microsoft.com /
  techcommunity.microsoft.com（五次尝试均 socket closed）。
  已核实的只有一条：**Hypervisor Top Level Functional Specification v6.0b（February 2020）全文
  对 hybrid / heterogeneous / asymmetric 零覆盖**——但该文档早于 Alder Lake，这条价值有限。

### 8.7 微码取证

#### 8.7.1 Vmin Shift Instability 的完整微码时间线（T1）

Intel 的根因陈述（Intel Community blog, *"Intel Core 13th and 14th Gen Desktop Instability Root Cause
Update"*, Thomas_Hannaford (Intel Employee), **2024-09-25**）逐字：

> "Intel® has localized the Vmin Shift Instability issue to **a clock tree circuit within the IA core
> which is particularly vulnerable to reliability aging under elevated voltage and temperature.** Intel
> has observed these conditions can lead to a duty cycle shift of the clocks and observed system
> instability."

四个场景与各自的缓解（逐字）：

| # | 场景 | 缓解 |
|---|---|---|
| 1 | "Motherboard power delivery settings exceeding Intel power guidance" | Intel Default Settings（**BIOS，非微码**，2024-05） |
| 2 | "eTVB Microcode algorithm which was allowing … i9 desktop processors to operate at higher performance states even at high temperatures" | "**microcode 0x125 (June 2024)** addresses eTVB algorithm issue" |
| 3 | "Microcode SVID algorithm requesting high voltages at a frequency and duration which can cause Vmin shift" | "**microcode 0x129 (August 2024)** addresses high voltages requested by the processor" |
| 4 | "Microcode and BIOS code requesting elevated core voltages … especially during periods of idle and/or light activity" | "Intel® is releasing **microcode 0x12B, which encompasses 0x125 and 0x129** microcode updates" |

投送方式（逐字）：
> "the **0x12B microcode update must be loaded via BIOS update** and has been distributed to system and
> motherboard manufacturers to incorporate into their BIOS."

**0x12F**（Intel Community, **2025-05-01**）逐字：
> "Intel is releasing a new microcode update (**0x12F**) supplementing the 0x12B microcode update released
> in September 2024. … **based on Intel's investigation of a limited number of reports regarding systems
> continuously running for multiple days with low-activity and lightly-threaded workloads.**"
> "The release of the 0x12F microcode **does not alter the root cause determination**…"

**ticket 未提到、但必须记录的一条**：`intel/Intel-Linux-Processor-Microcode-Data-Files` 的
`releasenote.md`（Intel 自有仓库）显示 **0x12B 与 0x12F 之间还有一个 `0x12C`（2025-02-11）**，
Intel 从未为它发过 Vmin 主题公告。完整序列（全部 CPUID `06-b7-01`，标注 "RPL-E/HX/S, stepping B0"）：

`0x122 → 0x123`(2024-05-14) → `0x129`(2024-09-10) → **`0x12b`**(2024-10-29) →
**`0x12c`**(2025-02-11) → **`0x12f`**(2025-05-12) → `0x132`(2025-11-11) → `0x133`(2026-02-10) →
`0x137`(2026-08-11)

> **`0x125` 在该仓库中从不出现**（序列从 `0x123` 直接跳到 `0x129`）——与 Intel 所说
> "通过 BIOS 投送" 一致：它只发给 OEM，从未作为 OS 可加载 blob 公开。

#### 8.7.2 影响范围是**按 die**，不是按 TDP —— 并且 Intel 自相矛盾

**Specification Update `740518-031` 的 RPL063**（逐字）：

> "**RPL063 Incorrect Internal Voltage Request May Lead to Unpredictable System Behavior**
> **Problem**: The processor may request elevated voltages from the voltage regulator, resulting in an
> eventual increase to the minimum required operating voltage.
> **Implication**: … an increase to minimum operating voltage may lead to unpredictable system behavior.
> **Workaround**: It may be possible for the BIOS to contain a mitigation for this erratum."

Summary Table of Changes 中，**RPL063 只在两列标 "No Fix"：S/S-Refresh 8P+16E 与 HX/HX-Refresh 8P+16E**，
其余全部 "N/A"。结合 §1.4 的 CPUID 表，这两列都是 **`B0671h` = `06_B7H` stepping 1**，
正是微码序列 `06-b7-01` 的目标。

> **结论**：影响范围 = **从 Raptor Lake 8P+16E die 切下来的部件**。
> 8P+8E（`06_BFH` stepping 2）与 6P+0E（`06_BFH` stepping 5）跑的是**完全不同的微码序列**（0x34…0x3e），
> 移动端 P/H/U（`06_BAH`）跑 0x41xx/0x61xx 系列。
> 媒体流传的 "65W 及以上" 说法在效果上大致对，但 **Intel 自己的错误表是按 die 划的**。

**未解决的矛盾（照实记录，不裁决）**：
Intel Community "Unaffected Products List"（2024-08-30）逐字列出
"Intel Core 13th and 14th Gen **mobile** processors – **including HX-series processors**" 为**不受影响**；
而 `740518-031` 的 Summary Table of Changes 把 **HX / HX-Refresh 8P+16E 标为 RPL063 "No Fix"**。
两者是同一块 `B0671h` 硅片、收同一份 `06-b7-01` 微码。**未找到 Intel 文档调和这两处。** → **Gap G11**。

**另一条限定性否定声明**：**`740518` 全文 "microcode" 一词出现 0 次。**
Intel 的勘误语言一律是 "It may be possible for the BIOS to contain a mitigation for this erratum"。
→ **勘误文档不会告诉你某条勘误是由微码修的**；微码版本要去 microcode 仓库或 Community 公告查。

#### 8.7.3 Intel 声明的副作用

- **0x129 的硬电压上限**（2024-08-09，逐字）：
  > "The latest microcode update (0x129) **will limit voltage requests above 1.55V** … This latest
  > microcode update will **primarily improve operating conditions for K/KF/KS processors**."
  > "…this latest microcode update (0x129) will not prevent users from overclocking … **Users can disable
  > the eTVB setting in their BIOS if they wish to push above the 1.55V threshold.**"
  → **一次微码更新改变了处理器的电压行为上限**，并把逃生口放在 BIOS 设置里。
- 性能：0x129 "within run-to-run variation … **with a few sub-tests showing moderate impacts**"；
  0x12B "within run-to-run variation"；**0x12F "Intel has identified no measurable performance impact"**。
- 0x125 改了 i9 的 eTVB turbo 算法 → **turbo 驻留行为变化**，不只是修 bug。

#### 8.7.4 微码**确实**会改变 CPUID 可见行为 —— Intel 的通用条款

**Intel "Microcode Update Guidance", document ID 660235** —— 这是本问题最好的一手来源，逐字：

> "**Runtime microcode update** refers to loading an update while the system is fully operational and
> running workloads, **possibly including user-space applications and virtual machines**. Software should
> ensure that the same update is loaded on all cores. **Some microcode updates may introduce new features
> and may change CPUID feature flags or other enumeration. Software that wishes to use features
> introduced via a runtime microcode update may need to reevaluate any CPUID feature flags or other
> enumeration after the update is loaded**…"

> "Microcode updates may introduce new capabilities. … **An example of this is the `IA32_SPEC_CTRL` MSR,
> which was introduced to existing processors through a microcode update.**"
> "**Loading a microcode update will generally not remove any existing capabilities** … **Exceptions to
> this will generally be communicated.**"

**Intel 336996-003, "Speculative Execution Side Channel Mitigations", Rev 3.0, May 2018, §5.1**
（文档号与修订已核对封面）逐字：
> "`CPUID.(EAX=7H,ECX=0):EDX[26]` enumerates support for IBRS and IBPB… `[27]` STIBP… `[28]` L1D_FLUSH…
> `[29]` … the `IA32_ARCH_CAPABILITIES` MSR. `[31]` … SSBD."
> "**The mitigation mechanisms may be introduced to a processor by loading a microcode update. In such
> cases, software should re-evaluate the enumeration after loading that microcode update.**"

#### 8.7.5 **对 ticket 假设的两处纠正**

**(1) TSX 的方向反了。** ticket 设想"微码清掉 `CPUID.07H.0:EBX[11]/[4]`"。实际不是。
**Intel 643557 Rev 2.3（June 2023）与 604224 Rev 1.5（June 2023）**逐字：

> "**A new CPUID bit, `CPUID.07H.0H.EDX[11]` (RTM_ALWAYS_ABORT), will be enumerated**, which is set to
> indicate to updated software that the loaded microcode is forcing RTM abort."
> "**In case the processor enumerated support for RTM previously, the CPUID enumeration bits for Intel TSX
> (`CPUID.07H.0H.EBX[11]` and `CPUID.07H.0H.EBX[4]`) continue to be set by default after the microcode
> update.**"
> "**system software may use a bit in MSR `0x122`, `TSX_CTRL[TSX_CPUID_CLEAR]`, to clear the HLE and RTM
> CPUID bits**…"

SDM-V4 Table 2-2 侧的架构锚点：
`IA32_TSX_CTRL`(`122H`) bit 1 `TSX_CPUID_CLEAR` —— "When set to 1, `CPUID.07H.00H:EBX.RTM[11]` and
`CPUID.07H.00H:EBX.HLE[4]` report 0."；`IA32_TSX_FORCE_ABORT`(`10FH`) bit 1 同义。

> **正确的表述**：**微码"增加"一个 CPUID 位（`EDX[11] RTM_ALWAYS_ABORT`）并提供一个 MSR，
> 由"软件"去清掉 `EBX[11]/[4]`。** 微码本身不清那两位。
> 这仍然证明"微码改变 CPUID 可见行为"，但机制与 ticket 的设想不同，**写进知识库时不能写反**。

**(2) Alder Lake 的 AVX-512 不能当作"微码改 CPUID"的先例。**
Intel 的唯一在案说法是 **"fused off"（硅片熔丝）**，不是微码；
且 12 代 Specification Update `682436`（rev 007 与 rev 040 都查过）**没有任何 AVX-512 相关勘误**。
把 AVX-512 当微码先例是 T3 媒体口径。**→ 用 TSX 作先例，不要用 AVX-512。**

#### 8.7.6 微码更新与 VMX —— 本 ticket 要的答案（与 §5.1 相互独立地得到同一结论）

子代理对 SDM 全文（332,723 行）做了
`grep -iE "microcode.*(VMX|VMM|virtual.machine|VM entry|VM exit)|(VMX|VMM|virtual-machine).*microcode"`，
**全文仅两处命中，都是 §28.3 那一句**。并且：

- **SDM Chapter 12（§12.11–§12.11.8）中 "VMX"、"virtual machine"、"hypervisor"、"VMM"、"SMM"
  的出现次数为 0** —— 微码更新一章写得像虚拟化不存在。
- **Intel "Microcode Update Guidance"（ID 660235）中 "hypervisor"、"VMX"、"VMM"、"root operation"、
  "S3"、"sleep"、"suspend"、"resume" 出现次数为 0**；虚拟机只作为*工作负载*出现。

> **净结论（与 §5.1 一致）**：架构上**堵死了 guest 加载微码**（§28.3 静默 no-op）
> 和**经 VMCS MSR 区域加载**（SDM-V4 Table 2-2 条目 79H），
> 但**对 VMM 在 VMX root operation 中加载微码只字未提**。**这个沉默本身就是结论。**

WRMSR 79H 是否触发 VM exit：**没有特例**，走普通规则
（SDM-V3C **§28.1.3 "Instructions That Cause VM Exits Conditionally"**）——
`79H` 落在 `00000000H–00001FFFH` 低区，由 MSR write bitmap 逐位控制。
两种行为：**bitmap 置位 → VM exit（reason 32, WRMSR）**；
**bitmap 清零 → 不 exit，且 §28.3 使该写成为 no-op**。
即**把 79H 直通给 guest 在硬件层面本来就是无害的**——但 guest 会以为自己成功了。

**一条直接相关的勘误**（`682436-040`，12 代，逐字）：
> "**ADL075 Processor May Hang During a Microcode Update.** Problem: Under complex microarchitectural
> conditions, **the processor may hang when executing a microcode update (MCU) by writing to
> `IA32_BIOS_UPDT_TRIG` (MSR 79h)**. … Workaround: It may be possible for BIOS to contain a workaround."

rev 040 中状态为 **Fixed**（四个 Alder Lake die 列全部）。
`740518`（Raptor Lake）中无对应勘误。

#### 8.7.7 Linux 的 late loading 与 `minrev` —— 对"微码改 CPUID"最好的工程注脚（T2）

`Documentation/arch/x86/microcode.rst` 有一节标题就叫 **"Why is late loading dangerous?"**：

> "**Since kernel 5.19, late loading is not enabled by default.**"
> "Since the microcode can 'simulate' MSRs too, while the microcode update is in progress, **those
> simulated MSRs transiently cease to exist**. … it cannot address other special interrupts that can't be
> shut off. Those are **Machine Check (#MC), System Management (#SMI) and Non-Maskable interrupts (#NMI)**."
> "Consider … a CPU has patch level 1 and the update is to patch level 3. **Between patch1 and patch3,
> patch2 might have deprecated a software-visible feature.** … say MSR_X is no longer available after an
> update, accessing that MSR will cause a #GP fault."

**`minrev` 机制**（`struct microcode_header_intel` 中由 reserved 字段改出的 `min_req_ver`）：
- commit **`cf5ab01c87030a085e211a0a327535932ec6f719`**，*"x86/microcode/intel: Add a minimum required
  revision for late loading"*，作者 **Ashok Raj \<ashok.raj@intel.com\>（Intel）, 2023-10-02**，逐字：
  > "**Intel has added a 'minimum required version' field to a previously reserved field in the microcode
  > header.** … **When microcode changes visible features, microcode will set the minimum required version
  > to its own revision which prevents late loading.**"
  > "**This is a pure OS software mechanism. The hardware/firmware ignores this header field.**"
- commit **`9407bda845dd19756e276d4f3abc15a20777ba45`**（Thomas Gleixner, 2023-10-17）：
  > "Applying microcode late can be fatal for the running kernel when the update changes functionality
  > which is in use already in a non-compatible way, **e.g. by removing a CPUID bit**."
- Kconfig：`MICROCODE_LATE_LOADING` 的标题就是 **"Late microcode loading (DANGEROUS)"**，`default n`。
- `common.c::microcode_check()` 在每次 late load 后比对 `x86_capability` 快照并打印
  "**x86/CPU: CPU features have changed after loading microcode, but might not take effect.**"
  —— **内核在运行时经验性地确认了 §8.7.4 的结论。**

**限定性否定声明**：**Linux 内核没有任何文档、Kconfig 文本、代码路径或 commit message
把 late microcode loading 与 VMX/KVM/hypervisor 安全性联系起来。**
检索范围：`microcode.rst` 全文（`grep virtual|vmx|kvm|hypervisor|guest|vmcs|vm-exit` 零命中）、
`kernel-parameters.txt` 的 `microcode=` 段、`MICROCODE*` Kconfig 段、
`microcode/{core.c,intel.c,amd.c,internal.h}`、`asm/microcode.h`、
`arch/x86/kvm/x86.c`（`grep microcode` 零命中）、`Documentation/virt/kvm/x86/` 全部 11 个 `.rst`。
唯一与虚拟化有关的逻辑是**反向**的：`microcode_loader_disabled()` 在检测到
`x86_hypervisor_present` 时**整个禁用加载器**——即"跑在 guest 里就不要加载微码"。

#### 8.7.8 微码在各种事件后的存续（对拥有平台的 hypervisor 直接相关）

- **SDM-V3A §12.11.6.1**（已在 §5.3 引过）：hard reset 清除，**INIT 保持**，重复加载无副作用。
- **Intel 660235** 补充（逐字）：
  > "A microcode update is loaded from the FIT **after either a warm or cold hardware reset. It does not
  > occur in response to an INIT event.**"
  > "**The microcode update is generally cleared by a warm reset.** However, any state that persists
  > across a warm reset (for example, last branch records or machine check banks) and has been modified by
  > the update **will remain modified after the reset.**"
  > "certain microcode update components **only take effect after a warm reset** … loading the update
  > **stages** certain changes to take effect on the next warm reset."
  > "**Once loaded, some updates may prevent loading of another update with a lower update revision.**"
  > "Some microcode update components may impact system performance. … **the same microcode update may
  > have a different performance impact depending on when it is loaded.**"
- **S3/suspend**：Intel 文档**没有**提及。Linux 自己兜底——
  `microcode/core.c::microcode_bsp_resume()` 注册为 syscore `.resume`，
  `arch/x86/power/cpu.c::__restore_processor_state()` 直接调用它，注释逐字：
  ```c
  microcode_bsp_resume();
  /*
   * This needs to happen after the microcode has been updated upon resume
   * because some of the MSRs are "emulated" in microcode.
   */
  msr_restore_context(ctxt);
  ```
  → **late-loaded 的微码之所以能跨 S3 存活，是因为 OS 从内存缓存里重新加载了它，不是硬件保持。**
  一个拥有平台的 hypervisor 如果接管了 S3 路径，**必须自己承担这件事**。

### 8.8 SMT 状态逐代表（Intel ARK，一手）

ARK 字段名随世代变化：早期部件没有 P/E 核行；Arrow Lake / Lunar Lake / Panther Lake 把显卡
放在 "GPU Specifications" 而不是 "Processor Graphics" 下。下表的
"Intel® Hyper-Threading Technology" 列是 ARK 该字段的**逐字取值**。

| 世代（代号） | 型号 | Total Cores | P-cores | E-cores | LPE-cores | **Total Threads** | ARK "Intel® Hyper-Threading Technology" |
|---|---|---|---|---|---|---|---|
| 10th (Comet Lake-S) | i9-10900K | 10 | 无此行 | 无此行 | — | **20** | **"Yes"** |
| 11th (Rocket Lake-S) | i9-11900K | 8 | 无此行 | 无此行 | — | **16** | **"Yes"** |
| 12th (Alder Lake-S) | i9-12900K | 16 | 8 | 8 | — | **24** | **"Yes"** |
| 13th (Raptor Lake) | i9-13900K | 24 | 8 | 16 | — | **32** | **"Yes"** |
| 14th (Raptor Lake R) | i9-14900K | 24 | 8 | 16 | — | **32** | **"Yes"** |
| Ultra 100 (Meteor Lake) | Ultra 7 155H | 16 | 6 | 8 | **2** | **22** | **"Yes"** |
| Ultra 200V (Lunar Lake) | Ultra 7 268V | 8 | 4 | — | **4** | **8** | **"No"** |
| Ultra 200V (Lunar Lake) | Ultra 7 258V | 8 | 4 | — | **4** | **8** | **"No"** |
| Ultra 200S (Arrow Lake-S) | Ultra 9 285K | 24 | 8 | 16 | — | **24** | **"No"** |
| Ultra 200S (Arrow Lake-S) | Ultra 7 265K | 20 | 8 | 12 | — | **20** | **"No"** |
| **Ultra 200S (Arrow Lake-S)** | **Ultra 7 265KF** | **20** | **8** | **12** | — | **20** | **"No"** |
| Ultra Series 3 (Panther Lake) | Ultra X9 388H | 16 | 4 | 8 | **4** | **16** | **该行整个不存在** |
| Ultra Series 3 (Panther Lake) | Ultra X9 378H | 16 | 4 | 8 | **4** | **16** | **该行整个不存在** |

**哪一种核带 SMT（12 代起）** —— Intel 支持文章
**000091896 "What Is Performance Hybrid Architecture?"（Last Reviewed 2026-06-18）**逐字：
P-core "**Capable of hyper-threading, which means running two software threads at once**"；
E-core "**Capable of running a single software thread.**"
线程算术在每一颗混合部件上都对得上：12900K `8×2+8 = 24`；13900K/14900K `8×2+16 = 32`；
155H `6×2+8+2 = 22`。

datasheet 侧的 HT 陈述（`655258-011`，逐字）：
> "The processor supports Intel® Hyper-Threading Technology (Intel® HT Technology) that allows an
> execution processor IA core to function as two logical processors… This feature **should be enabled
> using the BIOS and requires operating system support**."
加上 "Intel® HT Technology **may not be available on all SKUs**."

**ticket 的两个假设都被证实**：**Lunar Lake 与 Arrow Lake-S 都取消了 SMT**——
ARK 的 Hyper-Threading 字段明写 **"No"**，且所查每一颗部件的线程数都等于核数。

**Panther Lake 要谨慎措辞（不是缺口，但要限定）**：
ARK 上 Series 3 共 15 个 SKU，Launch Date "Q1'26"，Status "Launched"；
所查两个 SKU 线程数等于核数（16/16），且 **ARK 根本不打印
"Intel® Hyper-Threading Technology" 这一行**（Advanced Technologies 全列表已逐项检查）。
这与"SMT 继续缺席"一致，但**那是"行不存在"，不是 Intel 写了 "No"**。
→ **Gap G17**：Panther Lake 的 SMT 缺乏 Intel 的肯定性陈述。
另：**ARK 上列出的 Series 3 SKU 全部是移动级，没有 LGA 桌面 Panther Lake。**

**KF 后缀的官方定义**：Intel **没有**在任何地方把 "KF" 作为整体定义，只分别定义字母：
*Intel® Processor Names, Numbers and Generation List* —— **K = "High performance, unlocked"**，
**F = "Requires discrete graphics"**；
*What Do the Letters Mean in Intel® Processor Names?*（Last Reviewed 2025-12-09）——
**K = "Unlocked"**，**F = "Requires discrete graphics"**。
→ **Gap G18**：没有任何 Intel 页面定义复合后缀 "KF"（同样也不定义 "KS"、"HX"）。

---

## 9. 本次 session 的执行环境声明

ticket / map 里写明"用户有真机 Intel Core Ultra 7 265KF，能实测优先实测"。
**本 session 的执行环境不是那台机器**：`Win32_Processor` 返回
`AMD Ryzen 9 9950X3D 16-Core Processor`，`AMD64 Family 26 Model 68 Stepping 0`，16C/32T。
因此本文档**没有任何一条结论来自 Intel 实机实测**，全部来自一手规范文档与子代理的公开来源取证。
§7 中标注"可实测"的 G2 / G3 / G4 / G7 需要在 265KF 上另行执行。

---

## 10. 来源清单（文档号 + 章节，逐条可复核）

### T1 · Intel 官方规范（本次直接打开并抽取）

| # | 文档 | 文档号 / 修订 | 本文档引用到的具体位置 |
|---|---|---|---|
| S1 | SDM Volume 4: Model-Specific Registers | **335592-093US, September 2026** | Ch.2 引言（MSR scope 定义）；**Table 2-1**（§1 全表）；§2.17 世代枚举段（§1.1）；**§2.17.5 / Table 2-46/2-47/2-48**；**§2.17.9 / Table 2-53/2-54/2-55**；**§2.17.12 / Table 2-58/2-59/2-60**（§3.3, §3.4）；Table 2-2 条目 `79H`（§5.1b）、`7BH`、`7CH`、`1406H`（§5.2）、`480H`–`485H`（§3.4） |
| S2 | SDM Combined Volumes 1, 2A–2D, 3A–3D, 4 | **325462-093US, September 2026** | Vol.1 §1.1（§1.2）；Vol.1 **Ch.5 Table 5-2 + 脚注 3**（§2, §3.5）；Vol.1 **Ch.21 §21.1.4 CPUID Domains**（§3.2）、§21.1.5 Table 21-1/21-2（§5.4）、§21.1.8（§5.3）、Table 21-6/21-8/21-9/21-10/21-14/21-19/21-21/21-30/21-63/21-72（§3.2, §4.1）；Vol.3A **Ch.12 §12.11 及 §12.11.6.1–.4**（§5.3）；Vol.3B **§20.20.3 + Table 20-22**（§3.6）、**§22.3.10 / §22.3.10.3 / §22.3.11**（§3.7）；Vol.3C **§26.6, §26.7**、**§27.11.5**（§4.2）、**Ch.28 §28.3**（§5.1a）、§32.1.6（IPI virtualization 为 tertiary control）；Vol.3D **Appendix A / A.1**（§3.4） |
| S3 | Intel VT for Directed I/O Architecture Specification | **D51397-019, Rev 5.20, April 2026** | §3.4.4 / PMR 寄存器描述（§6.1）；**§8.3 DRHD / INCLUDE_PCI_ALL**；**§8.4 RMRR**（§6.1）；§8 三 DRHD 通用示例（§6.2）；修订记录（§6.1） |

### T1 · Intel Specification Update（10 份，全部下载并核对封面；见 §8.1 的完整表）

`615213-013` · `341079-023` · `634808-012` · `631123-034` · `682436-040` · `740518-031` ·
`792254-024` · `827538-022` · `834774-023` · `869992-008`（旁支：`764616-004`）。
本文档引用到的具体位置：各文档 **§2.1 "Component Identification via Programming Interface"**
（Table 1 或 Table 2-1）见 §1.4；**Summary Table of Changes** 与勘误正文见 §8.3、§8.7.2、§8.7.6；
`834774-023` §1.2 Related Documents 与 §2.2 Component Marking 见 §8.5。

### T1 · Intel 客户端平台 Datasheet / PCH Datasheet

| 文档 | 文档号-修订 | 引用位置 |
|---|---|---|
| 12th Gen Intel® Core™ Processors Datasheet, Vol.1 of 2 | **655258-011**, May 2025 | §6.2–§6.8 |
| 12th Gen … Datasheet, Vol.2 of 2（寄存器） | **655259-003**, April 2022 | §6.4, §6.5 |
| 13th Gen / 14th Gen / (Series 1)(Series 2) / Xeon E 2400 / Xeon 6300 Datasheet, Vol.1 of 2 | **743844-015**, May 2025 | §6.2–§6.8 |
| 13th Gen … Datasheet, Vol.2 of 2（寄存器） | **743846-001**, October 2022 | §6.4, §6.5 |
| Intel® Core™ Ultra Processor Datasheet, Vol.1 of 2（Meteor Lake U/H/U-Type4） | **792044-007**, January 2025 | §6.2, §6.3 |
| Intel® Core™ Ultra 200V Series Processors Datasheet, Vol.1 of 2 | **829568-004**, May 2025 | §6.3, §6.5 |
| Intel® Core™ Ultra 200S/200S Plus/200HX/200HX Plus Datasheet, Vol.1 of 2 | **832586-007**, March 2026 | §6.3–§6.8 |
| Intel® Core™ Ultra 200S … Datasheet, Vol.2 of 2 | **834966-001**, January 2025（**3 页存根**） | §6.4 |
| Intel 700 Series Chipset Family PCH Datasheet, Vol.1 of 2（Z790） | **743835-004**, April 2024 | §6.5, §6.8 |
| Intel 800 Series Chipset Family PCH Datasheet, Vol.1 of 2（Z890） | **833778-003**, February 2025 | §6.5, §6.8 |

（另已取得文档号但未下载：`842704` / `844261` ARL-H/U Datasheet、`831519` LNL Vol.2。）

### T1 · Intel 其他官方文档

| 文档 | 文档号 / 修订 | 引用位置 |
|---|---|---|
| Optimizing Software for Intel® performance hybrid architecture（白皮书） | **348851-001US, Rev 1.0, October 2021** —— §1.1、**§6.1** | §8.6.4, §8.6.5 |
| Intel® 64 and IA-32 Architectures Optimization Reference Manual, Volume 1 | **248966-050US, April 2024** —— **§2.3.1** | §8.6.4 |
| Speculative Execution Side Channel Mitigations | **336996-003, Rev 3.0, May 2018** —— **§5.1, §5.2** | §8.7.4 |
| Microcode Update Guidance | **Intel document ID 660235** | §8.7.4, §8.7.8 |
| CPUID Enumeration and Architectural MSRs | **Intel document ID 758381** | §8.6.5, §8.7.4 |
| Intel® TSX Disable Update for Selected Processors | **643557, Rev 2.3, June 2023** | §8.7.5 |
| Performance Monitoring Impact of Intel® TSX Memory Ordering Issue | **604224, Rev 1.5, June 2023** | §8.7.5 |
| 支持文章 "Is AVX-512 Fused Off on Alder Lake Client Products?" | **article ID 000089918**, reviewed 2022-03-25 | §8.6.4, §8.7.5 |
| 支持文章 "Graphics Virtualization Technologies Support for Each Intel® Graphics Family" | **article ID 000093216**, reviewed **2026-05-27** | **§6.9** |
| 支持文章 "What Is Performance Hybrid Architecture?" | **article ID 000091896**, reviewed 2026-06-18 | §8.8 |
| 支持文章 "What Do the Letters Mean in Intel® Processor Names?" | **article ID 000058567**, reviewed 2025-12-09 | §8.8 |
| 支持文章 "Does My Computer with … Number Ending with 'F' Need a Discrete Graphics Card?" | **article ID 000058487**, reviewed 2022-04-28 | §8.8 |
| （内部不一致的另一半）支持文章 GVT-g / SR-IOV 世代表 | **article ID 000058558**（2021） | §6.9, Gap G12d |
| Intel® Processor Names, Numbers and Generation List | intel.com 产品命名页 | §8.8 |
| Game Dev Guide for 12th Gen Intel® Core™ Processor | updated 2022-06-13 | §8.6.4, §8.6.5 |
| Intel ARK 产品规格页（10900K / 11900K / 12900K / 13900K / 14900K / 155H / 268V / 258V / 285K / **265K / 265KF** / X9 388H / X9 378H） | ark.intel.com，Intel 官方 | §6.7, §8.8 |
| Core Ultra Desktop Processors (Series 2) Product Brief | intel.com | §6.7 |
| Intel Community — Vmin Shift Instability 系列公告（2024-07-22 / 2024-08-09 / 2024-08-30 / **2024-09-25** / **2025-05-01**） | — | §8.7.1–§8.7.3 |
| 支持文章 "Vmin Shift Instability Latest Information" | **article ID 000102331** | §8.7.2 |
| `intel/Intel-Linux-Processor-Microcode-Data-Files` — `releasenote.md` | Intel 自有仓库 | §8.7.1 |
| `intel/edge-gfx-dkms-installer`（out-of-tree i915 + kvmgt，明列 MTL / ARL） | Intel 自有仓库 | §6.9 |

### T2 · 其他厂商 / 内核来源

| 来源 | 引用位置 |
|---|---|
| Broadcom KB **395554** "ESXi PSOD with 'Fatal CPU mismatch on feature'"（2025-08-18） | §8.6.1 |
| VMware ESXi kernel settings（`esxcli system settings kernel list -d` 输出，7.0U1→9.0.0 各 build） | §8.6.1 |
| Linux `arch/x86/kernel/cpu/common.c::identify_cpu()` / `microcode_check()` | §8.6.6, §8.7.7 |
| Linux `arch/x86/kvm/cpuid.c`（`HYBRID_CPU` 未枚举、无 `case 0x1a`） | §8.6.6 |
| Linux `drivers/gpu/drm/xe/xe_pci.c`（`.has_sriov` 分布；`INTEL_ARL_IDS(..., &mtl_desc)`） | §6.9 |
| Linux `Documentation/arch/x86/microcode.rst`、`arch/x86/Kconfig`、`microcode/intel.c::ucode_validate_minrev()` | §8.7.7 |
| Linux commits **`cf5ab01c8703`**（Ashok Raj, Intel, 2023-10-02）、**`9407bda845dd`**（Gleixner, 2023-10-17） | §8.7.7 |
| Linux `arch/x86/power/cpu.c::__restore_processor_state()` | §8.7.8 |
| Microsoft Hypervisor Top Level Functional Specification **v6.0b, February 2020**（用于一条限定性否定声明） | §8.6.6 |

### T3 · 仅作佐证、不单独支撑架构 claim

virten.net 的 12/13 代 PSOD 转录（panic 串原文）、Broadcom 社区帖（panic 完整格式、
VMware 工程师 Tim Mann 与 Valentin Bondzio 的发言）、William Lam 博客（VMware 立场）。
**§8.6.2 中把三个拓扑 feature 名归到具体 CPUID leaf 是本文档的推断，非厂商来源**，已在 G14 标注。

### 与现有 bibliography 的对接建议（不在本 ticket 施工，仅记录）

- 条目 [1]–[6] 的修订号需从 **092/June 2026** 更新到 **093/September 2026**，
  且所有引用 SDM 章节号的 claim 需要复核——**Ch.12 微码一节的编号在修订间移动过**。
- 条目 [24] 目前是裸 `https://edc.intel.com`，无抽取内容；维度 5 的产出应替换它。
- **建议新增锚点形状**：SDM 的 **Table 号**（如 `Table 2-1`、`Table 5-2`、`Table 21-63`）
  与**节号**同等重要，且比节号稳定。现有锚点语法是否容纳 "SDM-V4 335592-093 Table 2-47" 这种形状，
  需要在 ticket 06/07 里确认（README.md:154-159 记录过一次"扩展语法而不是让作者临场发挥"的先例）。
