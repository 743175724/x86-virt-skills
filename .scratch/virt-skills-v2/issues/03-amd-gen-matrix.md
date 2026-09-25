# 03 AMD Zen 1 → Zen 5 客户端：虚拟化相关的世代差异与勘误源

Type: research
Status: resolved
Blocked by: —

## Question

`amd-virtualization` 技能里**已经有正确形状的表**——`90-dated-landscape.md:46-57`
按 AMD 自己的键组织，**但只覆盖 EPYC**，客户端 Ryzen 只有一条 claim。
`Zen 5c` 和 `Ryzen AI` 在全库命中 **0**。

（原问题的 6 个维度见 git 历史；已全部作答。）

---

## Answer

完整报告：[`research/03-amd-gen-matrix.md`](../research/03-amd-gen-matrix.md)（约 1220 行）。

### 结论一（最重）：「AMD 客户端无勘误通道」这条声明**三个分句全是假的**

技能在 **6 处**断言（`amd-virtualization/SKILL.md:165-167`、`00-quickref.md:37`、
`01-svm-intro.md:292`、`03-intercepts.md:317-318`、`06-nested-paging.md:270`、
`07-virtual-interrupts-avic.md:340-341`）：

> *"AMD publishes no errata channel for client parts. Revision guides exist for EPYC
> families only; client Ryzen has no public revision guide and no public PPR."*

**逐句证伪：**

| 分句 | 反证 |
|---|---|
| "no public PPR" | **下载到了。** `57930-A0-PUB_3.00.zip`，**1017 页**，Family **1Ah Model 70h**（Strix Halo / Ryzen AI Max 300，**客户端**），Rev 3.00，2025-04-30，每页标 `[AMD Public Use]`。另有 5 份客户端 PPR 确认为第一方：55772-A1（Dali）、55803（Castle Peak）、55922-A1（Renoir）、56569-A1（Cezanne）、57019（Phoenix），以及 OSRR 56255（Fam 17h 00h–2Fh） |
| "revision guides exist for EPYC families only" | **Revision Guide 55449 Rev 1.21** 覆盖 Family 17h 00h–0Fh，其 **Table 12 按 AMD Ryzen / 2nd Gen Ryzen / Ryzen Threadripper 分列勘误**，含 AM4 封装。**其 p.87 erratum 1235 就是一条虚拟化勘误**，Suggested Workaround 原文 **"None. Do not enable AVIC."**，Fix Planned **"No fix planned"**——**这一条自己就推翻了整句声明** |
| "no errata channel" | **`AMD-SB-4xxx` 是自 2022 年起的客户端编号公告序列**（4001/4002/4004/4008/4012/4013/4017）。AMD-SB-4013 脚注原文：*"Refer to Errata #1165, #1166 and #1526 on the corresponding Client Revision Guide of the product."* |

**这是一次 fabricated negative**——正是 `README.md:104-118` 记录过、
并因此立下「**负面声明需与正面声明同等证据**」规矩的那一类缺陷。**它又发生了，而且重复了 6 次。**

**真实的缺口窄得多**，应当用它替换上面那句：

> 当前世代（Fam 19h / 1Ah）的**客户端机型段 Revision Guide** 无法公开取得；
> 另有 4 份客户端 PPR（56176 / 56214 / 56713 / 57254）找不到第一方副本。

→ 已开 **ticket 12** 处理撤回。

### 结论二：AMD 客户端混合核是**调度问题**，不是正确性问题——有实测

对 Ryzen AI 9 HX 370（`fam1Ah_model24h`，4× Zen 5 + 8× Zen 5c）的 **24 个逻辑处理器全量比对**：

- **`Fn8000_000A` 在每一个核上逐位相同**：
  `EAX=00000001 EBX=00008000 ECX=00000000 EDX=FEBFBDFF`，32768 个 ASID。
  **SVM 能力面完全一致。**
- 只有 `Fn8000_001D`（16 MB vs 8 MB L3）、`Fn8000_0026`（CoreType 0 vs 1；
  每 complex 8 vs 16 个 LP）和身份字段不同。
- 字段定义取自 AMD 自己的 PPR 57930。

**两条必须一并记录的限定**：

1. 本次检查**只覆盖 CPUID / MSR 的报告面**，**没有做 VMCB / VMEXIT 的行为测量**。
2. **Phoenix 2（`fam19h_model78h`，Zen 4 + Zen 4c）根本不报告 hybrid**——
   `HeterogeneousCoreTopology=0`，L3 统一。**hypervisor 在那上面连"有分裂"都看不见。**

### 结论三（需升级到 09）：**AVIC 在客户端不是世代属性，是微码属性**

同一个 family / model / stepping，**AVIC 位相反**：

| µcode | AVIC |
|---|---|
| `0x0B40400C` / `0x0B40401A` / `0x0B404022` | **0** |
| `0x0B404023`、**本机 `0x0B404035`** | **1** |

全部是 `fam1Ah_model44h`。

**PPR 57930 解释了原因**：AVIC（bit 13）与 x2AVIC（bit 18）是该表中
**仅有的两个写作 `Reset: 1` 而非 `Reset: Fixed,1`** 的位，
而 Table 9 把 `Fixed` 定义为 *"the read value that applies at all times"*。

> ✅ **已独立核实**：本机注册表 `Update Revision` = `35 40 40 0B`（小端）→ **`0x0B404035`**，
> 与报告一致（2026-09-26）。

**这条对 ticket 09 是决定性的**：它证明**一张只按型号组织的表会给出错误答案**——
同一颗 CPU，换个微码，AVIC 的有无就翻转。

### 结论四：本机实测——AMD 的缓存不对称**不需要混合 SKU**

本研究宿主是 **Ryzen 9 9950X3D**（`fam1Ah_model44h` st0）。实测：

- **`Fn8000_001D` 在 CPU 0–15 上返回 96 MB L3，在 CPU 16–31 上返回 32 MB**
  （双 CCD，仅一个带 3D V-Cache），
- **而 `Fn8000_0026` 什么都不标**——它不是混合 SKU。

> **也就是说：同一颗非混合 CPU 内部，L3 按核不同，且拓扑叶子不会提示你。**
> 这是 04 那条 Intel 发现（`NoirVisor` #35，4 个 E 核共享 L2 打垮"每核一份 EPT"）
> 的 **AMD 对应物**，而且出现在一颗**非混合**芯片上。

另：**Zen 5 客户端是 SME-only**（SEV=0，0 guests）。

### 结论五：Zen 4 的 VMLOAD/VMSAVE 缺陷**没有 AMD 勘误号**

04 交来的那条（虚拟化 VMLOAD/VMSAVE 声称支持但会随机重启）查实为：

- **唯一来源是内核 commit `a5ca1dc46a6b`（提交者是 AMD 员工）加一份 kernel bugzilla。
  AMD 自己没有给它勘误号。**
- 影响范围精确到 **`fam19h` 的 18h–1Fh 与 60h–7Fh**。
- **Zen 5 不受影响**（本机实测：bit 15 置位，内核不清除它）。
- ⚠️ **裸机 hypervisor 得不到任何自动缓解**——内核的规避只保护跑在 Linux 下的场景。
