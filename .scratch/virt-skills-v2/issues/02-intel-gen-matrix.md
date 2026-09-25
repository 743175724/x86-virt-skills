# 02 Intel 10 代 → Core Ultra 300：虚拟化相关的世代差异与勘误源

Type: research
Status: resolved
Blocked by: —

## Question

现有 `intel-vt` 技能的客户端硅片覆盖是**两条 claim**（`90-dated-landscape.md:101-104`）。
Comet Lake / Rocket Lake / Alder Lake / Raptor Lake / Meteor Lake / Lunar Lake / Arrow Lake
这些代号在全库命中 **0 次**。

（原问题的 6 个维度见 git 历史；已全部作答。）

---

## Answer

完整报告：[`research/02-intel-gen-matrix.md`](../research/02-intel-gen-matrix.md)（1741 行）。

**方法**：把原始文档下载下来做文本抽取后逐页读，**不凭记忆引用**——
SDM 合订本（**325462-093US**，5364 页）、Vol.4（**335592-093US**）、
VT-d 规范（**D51397-019 Rev 5.20**）、**全部 10 份客户端 Specification Update**、
5 份平台 datasheet + 2 份 PCH datasheet。共 **24 个 Intel 文档编号，每一个都是从 PDF 封面读出来的**。

### 结论一：SDM rev 093 新增的 "CPUID Domains" 分类，就是那个判定程序

**Vol.1 §21.1.4。** 它一次性回答了所有"P 核和 E 核会不会不一样"的问题：

| 域 | 包含 | 规则 |
|---|---|---|
| **Platform domain** | ISA 特性位——**含 `CPUID.01H:ECX[5]` VMX 和全部 AVX-512 位** | **必须在每个逻辑处理器上完全一致** |
| **Logical Processor domain** | 缓存（`04H`）、拓扑（`1FH`）、native model ID（`1AH`） | **SDM 明确允许不同，并点名 "hybrid" 就是原因** |

**这决定性地解决了 ESXi 那个问题。** ESXi 崩溃时比较的三项
（`"Hyperthreads per core"`、`"Cores per package"`、`"Cores per die"`）**全是拓扑计数**，
第四项（`"Intel processor platform type identifier"`）比的是 **MSR `17H` 的保留位**。

> **硅片是合规的；缺陷在 ESXi 的一致性假设。**
> 所以修法是 `cpuUniformityHardCheckPanic=FALSE`（Broadcom KB 395554），
> **不是**改 BIOS 或微码。

**并且独立验证了**：SDM 那六张 P核/E核独有表里，**没有任何一个 `IA32_VMX_*` MSR**。
这与 04 的撤回结论一致——「混合核上 VMX 能力位不同」确实没有依据。

**真正会按核不同的是**：perfmon、prefetch control、L2 QoS masks。
其中 `D18H`–`D1FH` **在 E 核上可用，在 P 核上会 #GP**。

### 结论二：微码与 VMX，SDM 只写了一半

- **Vol.3C §28.3**：在 **non-root** 操作中写 MSR `79H` 是**静默无操作**——不产生异常、不产生退出。
  原文：*"This implies that microcode updates cannot be loaded in VMX non-root operation."*
- **Vol.4 Table 2-2**：VM-entry / VM-exit 的 MSR 区域也可能拒绝它。
- **而对 VMX root operation，SDM 只字未提**——全文 grep 只有两处命中，都是上面那句 non-root。
  **这是一个真实的规范空白，不是我们没找到。**
- 新增且与 hypervisor 直接相关：**`IA32_MCU_STATUS`（`7CH`）bit 0 会报告一次
  "已经改了 revision ID 的部分更新"**——
  也就是说，**读 `IA32_BIOS_SIGN_ID` 已经不足以证明补丁真的打上了。**

### 结论三：两个会悄悄毁掉型号查找表的键陷阱

1. **13 代和 14 代在 CPUID 上无法区分。**
   `740518-031` 把 RPL-S 与 RPL-S Refresh 列为**同一个 `B0671h`**。
2. **10 代 Comet Lake U 4+2 报 `06_8EH`——与 Kaby Lake signature 相同。**

> **市场名 ↔ CPUID 既非单射也非单调。映射层必须显式存在。**

**两条对本 ticket 原始表述的更正**：

- ❌ 我原文把 SMT 断裂放在 Arrow Lake。**实际断裂在 12 代**
  （P 核 2 个逻辑处理器、E 核 1 个），**Arrow Lake 只是恢复了 1:1**。
- ❌ 我原文把 VT-d 能力断裂挂在 LGA1851 插槽。**实际在 Meteor Lake**，与插槽无关。

### 缺口：22 个未决，3 个已关闭

**已关闭且分量很重的三个**：全部 10 个世代的完整 CPUID + stepping 表、
LGA1700 → LGA1851 的 VT-d 差异、客户端 iGPU SR-IOV。

**22 个未决里，9 个可以用真机一次性关掉**：

- **4 个只需在 265KF 上跑一条 `RDMSR 492H`**——
  IPI virtualization、`IA32_SPEC_CTRL` virtualization、以及 tertiary VM-execution controls 的其余部分。
  报告已把 Table 27-8 抽出来，所以每一位都有名字，读完直接对号入座。
- **3 个只需一次 DMAR + CPUID dump。**
- **2 个是 Intel 自己前后矛盾**（HX 系列是否受 Vmin Shift 影响；
  两篇支持文章给出的 SR-IOV 世代列表不一致）——
  按本仓库惯例**记录为未裁决**，不强行调和。

**265KF 的身份已确定**：`CPUID.01H:EAX = C0662h` → **`06_C6H` stepping 2**，20C/20T，
由 SDM Table 2-1 与 Spec Update `834774-023` 双向确认。

> ⚠️ **本轮无法做 Intel 真机验证**：执行本次研究的机器是
> **AMD Ryzen 9 9950X3D**（`fam1Ah_model44h`），报告中已声明。
> 那 9 个可实测缺口需要一台能跑的 265KF。**见下方待办。**

## 遗留待办

**在 265KF 上取一次 dump，可一次关闭 9 个缺口。** 需要的命令与期望输出格式见
`research/02-intel-gen-matrix.md` 的 "On-metal checklist" 节。
需要先确认用户手上的 265KF 是哪台机器、是否可执行。
