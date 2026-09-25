# 09 CPU 世代 / 型号轨道的组织方式

Type: grilling
Status: open
Blocked by: 06

## Question

用户的实际痛点：**「兼容 Intel 10 代到 2026 年新出的 CPU」**，
以及后来补充的**「AMD 也有这个问题，它这个 CPU 好像也有几代几代的问题」**。

现状（诊断查实）：

- 现有知识**完全按架构特性组织，不按 CPU 型号组织**。
  于是"我这颗 265KF 上这条还成不成立"这类问题无法回答。
- Intel 客户端覆盖 = 2 条 claim。10–14 代全部代号命中 **0**。
  "Hyper-Threading" 全库 1 次，是 2010 年的测试环境描述。
  **没有任何 CPUID DisplayFamily / DisplayModel / stepping 表。**
- AMD **有**正确形状的表（`90-dated-landscape.md:46-57`，按 `famXXh_modelXXh` 键），
  但只覆盖 EPYC；客户端 1 条 claim；`Zen 5c` / `Ryzen AI` 命中 0。
- 已知的三次范式断裂：12 代混合核（导致 ESXi PSOD）、
  13/14 代微码 0x12B / 0x12F、Core Ultra 200S 取消超线程。
  AMD 侧的对应物：Strix Point 的 Zen 5 + Zen 5c 混合、AVIC 世代门控、
  Zenbleed / SRSO 的 family-model 影响面。

**要决定的：**

1. **按什么键组织。** AMD 已有的 `famXXh_modelXXh` 是个现成的、厂商自己在用的键。
   Intel 侧要不要对齐到 CPUID DisplayFamily/DisplayModel？
   还是用市场名（"Core Ultra 7 265KF"）？**用户问问题时用的是市场名，
   但规范文档用的是 CPUID 编码**——中间需要一层映射，这层映射放哪。
2. **微码 / AGESA 维度怎么表达。** 同一颗 13900K，微码 0x12B 之前和之后行为不同。
   一个"按型号查"的表如果不带微码版本维度，答案会是错的。
   但加上这一维，表的体积和维护成本都会爆炸。
3. **和现有特性章节怎么交叉。** 两种可能：
   (a) 型号表是一张独立的查找表，指回特性章节；
   (b) 每个特性章节内部加"世代适用性"标注。
   (b) 更准确但要动 2531 条 claim；(a) 便宜但容易与正文漂移。
4. **dated-facts 隔离规则怎么办。** 现行规则是
   *"If a fact has a GA date, a version number, a price or a market share, it is in
   `90-dated-landscape.md` and nowhere else"*，且由 lint 强制。
   **CPU 型号信息天然带 GA 日期和版本号** ——
   照现行规则，整个型号轨道都得塞进那一个文件，而它已经是 10k token 了。
   这条规则要不要为型号轨道开口子？开了口子会不会把它变成一个垃圾抽屉？
5. **"查不到"怎么表达。** 如果 03 确认 AMD 客户端确实没有公开勘误通道，
   那型号表在 AMD 客户端侧会有大片空白。
   本仓库的既定做法是**声明缺口而不是填塞**——这在一张表格里怎么呈现才不会被误读成"没问题"。

## 04 已经交来的硬约束（开工前必读）

**键不能只有型号，至少要五维**：family/model、核类型与缓存拓扑、固件/AGESA、
Windows build、平台配置。

**警告案例 `SimpleSvm` issue #3**：报告人把故障误判成"只有 Zen 4/5 才坏"，
真因是 **MMIO 落在 512 GB 以上**。
**一张只按 CPU 型号组织的表会把它归错格子，并把这个错误相关性永久固化。**
本 ticket 的设计必须能防住这个失败模式——否则型号轨道会成为错误相关性的放大器，
比没有还糟。

**两条早期推测已被 04 推翻，不得作为本 ticket 的前提**：
- ❌ 混合核上 VMX 能力位不同——零证据
- ❌ Arrow Lake 取消超线程会搞坏 hypervisor——零证据

**两条已证实、且正是型号轨道该覆盖的**：
- ✅ `NoirVisor` #35：4 个 E-core 共享一个 L2，
  使"每核一份 EPT"这一所有参考实现的默认写法从 12 代起退化
- ✅ Zen 4 客户端声称支持 virtualized VMLOAD/VMSAVE 但启用会随机重启
  （Linux commit `a5ca1dc46a6b` / CVE-2024-53114），且四个主流实现无一带规避

这两条的形状值得注意：**它们都不是"某代缺了某个特性"，而是"某代让一个流行写法失效"**。
型号轨道如果只记录特性有无，这两条都记不进去。

## 依赖

- **02 / 03**：真实的世代差异清单和权威来源。没有它们就是在凭空设计表结构。
- **06**：技能是一个还是两个，决定型号表是一张还是两张。

## 真机

用户有 **Intel Core Ultra 7 265KF**（Arrow Lake-S，20C/20T，无 SMT，无核显，无 vPro）。
凡是这颗能实测的结论优先实测。要在本 ticket 里定下：
实测结果算不算 Tier-1 证据、怎么记录、锚点语法要不要为它扩展
（`README.md:154-159` 记录过一次先例：AMD 的 Revision Guide 没有对应的锚点形状，
当时的做法是**扩展语法而不是让作者临场发挥**）。

## 交付物

型号轨道的结构设计：键、维度、与特性章节的交叉方式、缺口表达法、lint 规则的调整。
