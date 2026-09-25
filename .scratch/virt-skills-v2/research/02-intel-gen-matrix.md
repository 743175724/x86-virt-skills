# 02 Intel 10 代 → Core Ultra 300：虚拟化相关世代差异 + 规范来源

Type: research output
Ticket: `.scratch/virt-skills-v2/issues/02-intel-gen-matrix.md`
Date: 2026-09-26
Scope: **客户端部件 only**。Xeon / 服务器在本 effort 的 Out of scope 内，仅在"某特性只在服务器出现"这类
**限定性否定声明**里作为对照出现。

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
| | | RPL-P 6P+8E / RPL-H 6P+8E | — | `B06A2h` | **06_BAH** | 2 |
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

### 3.8 ESXi "Fatal CPU mismatch on feature" —— 由子代理独立取证

见 **§8 子代理取证结果 · A**。本节只给出**从 Intel 一手文档能独立推出的判据**，
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

### 4.3 SMT 具体状态 —— 由子代理取证

Intel ARK 的核/线程数是本项的一手来源。见 **§8 子代理取证结果 · D**。

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
见 **§8 子代理取证结果 · C**。

### 5.5 Vmin Shift Instability / 微码 0x12B / 0x12F

由子代理取证，见 **§8 子代理取证结果 · C**。

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

### 6.2 VT-d 规范**不能**给的

VT-d 规范给的是**结构格式**，不是**某个具体平台的 DMAR 内容**。
`D51397-019 Rev 5.20` 的 §8 示例（3 个 DRHD、unit #3 置 INCLUDE_PCI_ALL）是**通用示例**，
不是 LGA1700 或 LGA1851 的实际布局。
**"LGA1700 与 LGA1851 的 DMAR 差异"在 VT-d 规范里查不到**，只能来自
(a) Intel 客户端平台 datasheet，(b) 实机上 dump 的 ACPI DMAR 表。
后者本 session **无法取得**（见 §9）。子代理的平台侧取证见 **§8 子代理取证结果 · D**。

---

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
| **G7** | **KF 部件（无核显）对 DMAR / RMRR 的实际影响** | VT-d D51397-019 Rev 5.20 §8.3/§8.4 全文；规范只把 "UMA Graphics" 列为 RMRR 典型用途，不描述具体平台布局 | 265KF 实机 dump ACPI DMAR（Windows 下 `Get-CimInstance`/`acpidump`），对比一台带核显的 Arrow Lake-S |
| **G8** | **LGA1700 → LGA1851 的 DMAR / PCIe 拓扑差异** | VT-d 规范不含平台实例 | Intel 客户端平台 datasheet + 实机 DMAR；子代理结果见 §8 |
| **G9** | **本 session 无法做任何 Intel 实机验证** | 执行环境 CPU 经 `Win32_Processor` 确认为 **AMD Ryzen 9 9950X3D（AMD64 Family 26 Model 68 Stepping 0，16C/32T）**，不是用户的 265KF | 所有标注"可实测"的项都需要在 265KF 上另行执行 |

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

### 8.6 混合拓扑 / ESXi 取证

<!-- SUBAGENT-A-PLACEHOLDER -->

### 8.7 微码取证

<!-- SUBAGENT-C-PLACEHOLDER -->

### 8.8 SMT 与平台 / VT-d 取证

<!-- SUBAGENT-D-PLACEHOLDER -->

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

### 子代理取得的来源

见 **§8**，每条均在该节内标注 tier 与 URL。

### 与现有 bibliography 的对接建议（不在本 ticket 施工，仅记录）

- 条目 [1]–[6] 的修订号需从 **092/June 2026** 更新到 **093/September 2026**，
  且所有引用 SDM 章节号的 claim 需要复核——**Ch.12 微码一节的编号在修订间移动过**。
- 条目 [24] 目前是裸 `https://edc.intel.com`，无抽取内容；维度 5 的产出应替换它。
- **建议新增锚点形状**：SDM 的 **Table 号**（如 `Table 2-1`、`Table 5-2`、`Table 21-63`）
  与**节号**同等重要，且比节号稳定。现有锚点语法是否容纳 "SDM-V4 335592-093 Table 2-47" 这种形状，
  需要在 ticket 06/07 里确认（README.md:154-159 记录过一次"扩展语法而不是让作者临场发挥"的先例）。
