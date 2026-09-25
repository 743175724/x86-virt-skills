# 03 AMD Zen 1 → Zen 5 客户端：虚拟化相关的世代差异与勘误源

Type: research
Status: open
Blocked by: —

## Question

`amd-virtualization` 技能里**已经有正确形状的表**——`90-dated-landscape.md:46-57`
按 AMD 自己的键组织（EPYC 系列 ↔ 代号 ↔ `fam17h_model01h` / `fam19h_model0xh` /
`fam1ah_model0xh` ↔ Zen 世代，源自 AMD 固件包文件名）。**问题是它只覆盖 EPYC。**
客户端 Ryzen 只有一条 claim（`90-dated-landscape.md:82-84`，且只讲 SEV 可用性）。
`Zen 5c` 和 `Ryzen AI` 在全库命中 **0**，`hybrid` 命中 1。

**任务：把那张表的客户端一侧填出来，并查清客户端特有的虚拟化差异。**

必须覆盖的维度：

1. **family / model / stepping 编码**：Zen 1 / 1+ / 2 / 3 / 4 / 5 客户端部件
   （Ryzen 1000–9000、Ryzen AI 300 / 400 系列）。沿用现有表已在用的 `famXXh_modelXXh` 键。
2. **客户端混合核心**：Strix Point（Ryzen AI 300）= 4× Zen 5 + 8× Zen 5c。
   **关键问题**：Zen 5 与 Zen 5c **ISA 相同**，所以不存在 Intel 那种 AVX-512 特性缺失，
   但 L3 分属不同 CCX、频率上限不同（5c 封顶约 4 GHz）。查清——
   - CPUID 缓存 / 拓扑叶子（`8000001Dh` / `8000001Eh`）在两种核上是否返回不同值？
   - SVM 相关能力（`8000000Ah` 的 NPT / AVIC / VMCB clean bits）两种核是否一致？
   - 如果一致，那么 AMD 侧的混合问题**只是性能 / 调度问题而非正确性问题**——
     这个结论本身很有价值，但必须有证据，不能靠推断。
3. **AVIC 的世代门控**：AVIC 在哪些 Zen 世代上可用 / 被勘误禁用 / 由 x2AVIC 取代。
   KVM 长期默认关闭 AVIC 的原因与解除条件。
4. **安全勘误的跨 VM 影响**：Zenbleed（Zen 2, CVE-2023-20593）、SRSO / Inception（Zen 3/4）。
   库里已有覆盖（SRSO 6 处、Zenbleed 3 处）但挂在架构特性下，不是按型号可查。
   查清每条**影响哪些具体 family/model**、缓解措施的微码 / AGESA 版本门槛。
5. **AGESA / 微码作为行为变量**：客户端的微码版本怎么查、AGESA 版本与之的关系。
6. **勘误通道的真实状态**：技能现在反复声明
   *"AMD publishes no errata channel for client parts. Revision guides exist for EPYC
   families only; client Ryzen has no public revision guide and no public PPR."*
   （`SKILL.md:165-167` 等 6 处）。
   **这条声明必须重新核实**——它是 v2 里"按型号查"这条路能走多远的硬边界。
   如果仍然成立，就把它升级成结构性声明；如果已经变了，整条线的可行性大幅提升。

## 边界

与 02 相同：只做客户端；不写章节；负面声明需同等证据并限定文档版本。

## 交付物

`.scratch/virt-skills-v2/research/03-amd-gen-matrix.md`，格式与 02 对齐，便于后续做 Intel / AMD 对照。
