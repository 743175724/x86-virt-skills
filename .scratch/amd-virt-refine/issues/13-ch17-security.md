# 13 · `17-security.md`（CVE→缓解矩阵 + SKINIT/DRTM）

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **500–549**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D7, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** AMD 安全公告索引 `https://www.amd.com/en/resources/product-security.html`（单条为 `.../bulletin/amd-sb-NNNN.html`）+ 按家族的 Revision Guide + APM Vol.2 **§15.27 Secure Startup with SKINIT**（15.27.1–15.27.8）与 **§15.37 Speculation Control Virtualization**。

**Owns:** CVE → 架构机制 → 可部署缓解的矩阵 · 攻击面分类 · SKINIT / DRTM。

> **锚定渠道的一条硬事实**：**AMD 没有 Intel "SDM Documentation Changes" 那样的文档勘误通道**——更正静默并入下一修订，唯一记录是卷内 Revision History 表。最接近勘误的是按家族的 Revision Guide（**硅**错误，非文档错误）：58251（Fam 1Ah 00h–0Fh，Rev 1.30，2025-07）· 58730（1Ah 10h–1Fh）· 57095（19h 10h–1Fh，Rev 1.05，2025-11）· 57926（19h A0h）· 55449 · 56323 —— **全部是 EPYC/服务器件；客户端 Ryzen（Vermeer / Raphael / Phoenix / Strix）没有公开修订指南**。因此 CVE 与勘误一律锚到 **AMD-SB 公告**，不要去找不存在的"文档变更"文件。

## 必须交付

1. **CVE → 机制 → 缓解矩阵**。每行必须有：CVE 编号、通用名与论文、披露日期、受影响代际（**按 EPYC/Ryzen 代际，不是按特性名**——旧版 30 行里有一半在这一列填的是 "SEV"/"SEV-ES" 这类特性名）、架构机制、**可机检的缓解锚点**（微码补丁级别 / SEV 固件版本 / AGESA 版本 / 内核 commit / MSR 位 / BIOS 设置）。旧版 30 条里只有 5 条带可机检锚点。
2. **补上全库缺失的漏洞类别**（grep 确认目前零命中）：
   - 瞬态执行类：**SRSO / Inception（CVE-2023-20569）**、**Zenbleed（CVE-2023-20593）**、**Branch Type Confusion（CVE-2022-23825 / 23816）**、**Transient Scheduler Attacks（CVE-2024-36350 / 36357，AMD-SB-7029）**、SQUIP。第 12 章旧版直接贴了带 `/* Spectre v2 / RETBleed 缓解 */` 注释的代码而无任何一章解释它。
   - KVM 侧 nSVM 逃逸：**CVE-2021-3653 / CVE-2021-3656**（旧版 30 行主表里都没有）。
   - `#VC`/GHCB 相关：**CVE-2023-4155**（旧版只躺在第 9 章，未进主表）。
   - Rowhammer 类（ZenHammer）与 AMD-SP 引导链 CVE。
   - 相关的缓解 MSR：`VIRT_SPEC_CTRL (C001_011Fh)`、`SPEC_CTRL`、`PRED_CMD`、以及它们在 VMCB 中的保存位置。
3. **修正已确证的 CVE 错误**（errata）：
   - **⚠️ 本条初稿写反了（核验 #25）**：AMD-SB-3008 把 CVE-2024-25742/25743/**25744** 全部归给 Heckler，修复提交 `b82a8dbd3d2f` 是 "Disable 32-bit emulation by default on TDX **and SEV**"。**25744 覆盖 TDX 与 SEV，不是 Intel 独有**；25743 是 AMD 专属的 interrupt-0/14 那一半。论文在 **USENIX Security 2024**。旧版真正的缺陷是**受影响代际列填特性名**与**披露日期 2024-08 / 2024-03 自相矛盾**——只修这两条。
   - **SEVurity ≠ SEVerity**：AMD-SB-1004 对应 **SEVerity (CVE-2020-12967)** 且**同时覆盖 CVE-2021-26311**；SEVurity 是 **Luca Wilke 等，IEEE S&P 2020**，无 CVE。
   - **"SEV-ES 在支持 SNP 的 CPU 上被禁用"**：AMD-SB-3023 原文是 "will result in disabling **SEV-ES** when SEV-SNP is **enabled**"——只禁 SEV-ES、触发条件是 SNP **已启用**、影响跨 Zen 3/4/5，不是 Zen 5 代际特性。
   - AVIC erratum #1235 的**真实披露年份**与 CVE 分配年份必须区分（旧版把它标成 "2025–2026"，同时又说它让 AVIC 默认关闭了"约八年"）。
   - CVSS 一律取 NVD/CNA 值，不取二手漏洞库。**⚠️ 本票原先举的例子是错的**：核验结果 CVE-2021-29657 的 NVD 评分就是 **7.4**，初稿主张的 7.8 不成立。原则不变（以 NVD/CNA 为准），但这条不再是"讹传"，从 errata 与 lint 规则中移除。
   - 加密模式表述统一（不得同时存在 "AES-XEX 覆盖全代"、"AES-XE"、"Genoa 起 AES-256-XTS" 三种说法）。
4. **攻击面分类**：明确区分 **AMD 硬件缺陷 / SEV 固件缺陷 / VMM 软件缺陷**三类，归因不得混淆。
5. **SKINIT / DRTM**（APM Vol.2 的 SKINIT 小节）：SLB 的大小与对齐、SL_DEV / DEV 寄存器、VM_CR 的 DPD/R_INIT/DIS_A20M、PCR17/18、AP 处理、**步骤顺序需对照官方原文核实**（旧版把 GIF 清除放在 TPM 传输之后，与官方次序可能不符）。补上 **Windows System Guard Secure Launch** 作为 SKINIT 在 Windows PC 上的主流消费者——旧版只引了 TrenchBoot/GRUB/Linux。
6. **Scope 标注**：SEV 相关 CVE 标服务器范围；瞬态执行类与 nSVM 类对客户端同样适用。
7. Open items。

## 明确移出本章

- 修复状态的"当前值"（固件版本、微码版本、内核版本、AGESA 版本的**最新值**）→ `90-dated-landscape.md`；本章矩阵里写"修复引入于 X"这种历史事实（`V:durable`），"现在应该升到 Y"属 `90`。
- 性能影响数字 → `18`。

## 完成判据

- lint 零 error；MISCONCEPTIONS 规则覆盖本票列出的 6 条 CVE 类讹传。
- 主表每行都有披露日期与至少一个可机检的缓解锚点，或显式标注"AMD 未提供修复"并给出公告号。
- 全库 CVE 叙述只此一处为 owner：`12`/`13`/`14`/`06`/`07` 中的 CVE 段落全部压缩为一句指针（可用 grep `CVE-` 验证分布）。

---

## 复检补充

- **公告号已核验，矩阵以它为准（不是营销名）**：RMPocalypse = CVE-2025-0033 → **AMD-SB-3020**，Medium **6.0**，ETH Zurich；BadRAM = CVE-2024-21944 → **AMD-SB-3015**，Medium 5.3，SPD 元数据。**AMD 从不在公告里印营销名**，所以矩阵的"通用名"列要标注成社区叫法。Heckler 三个 CVE 见 AMD-SB-3008。
- **未决冲突不得写成 MISCONCEPTIONS 正则。** 本票的完成判据要求"MISCONCEPTIONS 规则覆盖本票列出的 6 条 CVE 类讹传"，但其中两条——**AVIC erratum #1235 的真实披露年份**与 **CVE-2021-29657 的 CVSS**——在 spec §D7 里被列为**待裁决**。对一个你明确拒绝裁决的事实，写不出确定性规则。这两条改为 `errata.md` 的 Open conflict 条目，不进 lint。
- **erratum #1235 的三个去处收敛**：机制与默认状态的**历史**归 `90`（它是随内核策略变动的时效事实）；**披露年份**留在 errata 的 Open conflicts；本章只在 CVE 矩阵里留一行并指过去。
- **本章接收 APM Vol.2 附录 D "SMM Containerization"** —— 这是一整个附录，在初稿里零 owner。SMI 拦截的语义归 `03`，附录 D 的容器化模型归本章。
- **本章补"勘误驱动的特性屏蔽"这条纪律**：固件可以单独屏蔽 `Fn8000_000A` 的某一位，必须逐位探测、不得按代际推断；AMD 的公开修订指南**只覆盖 EPYC**，客户端 Ryzen 没有（spec §D2 结论 3）。这条与 `01` 的探测纪律互为表里。
- **两个独立的 `Owns:` 条目与硬性内部分节**：§17.1 CVE→缓解矩阵（活表）、§17.2 SKINIT/DRTM（APM §15.27 的耐久机制）。把两个不相干主题用顿号并在一个标题里，正是 spec 批评旧版标题的那个模式。
