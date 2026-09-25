# 06 一个技能还是两个？——v2 的顶层结构决策

Type: grilling
Status: open
Blocked by: 01

## Question

**这是整张图的核心决策，其余结构性 ticket 都挂在它下面。**

现状是两个平行技能。诊断证明这个结构在实践中是坏的：

- 区分二者的裁决规则（"对称比较归 `intel-vt`"）**只存在于根目录自动生成的 `AGENTS.md:34-43`**，
  由 `tools/build.mjs:159-168` 以模板字符串硬编码，且仅在 `loadedAll.length > 1` 时才输出。
  全仓库 grep "Symmetric comparisons" 只有两处命中：`AGENTS.md:40` 和一个 `.scratch/` 文件。
  **两个 `SKILL.md` 里都没有，`index.json` 里没有，`agents/openai.yaml` 里也没有。**
- Claude Code 只加载 `.claude/skills/<name>/SKILL.md`，**永远看不到根 `AGENTS.md`**。
- `tools/install.mjs` 从不安装 `AGENTS.md`（grep 无命中）→ user-scope 安装下这条规则**根本不存在**。
- 两个 `SKILL.md` 互相矛盾：`intel-vt/SKILL.md:126-128` 和
  `amd-virtualization/SKILL.md:142-144` **都声称自己负责双向比较**。
- 8 个触发词完全重合：`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2`
  `Kernel DMA Protection` `hypervisor`。绝大多数 Windows 平台问题只含这些词、不含厂商名，
  于是两个技能等权抢答，而没有任何在技能内部可见的裁决规则。
- AMD 侧硬编码了 11 处指向 Intel 技能的仓库根相对路径
  （`16-windows-platform.md` 9 处、`19-comparison-intel-arm-riscv.md` 2 处），
  Intel 侧**零**反向依赖。agent 按当前文件解析这些路径会得到 404。

**要决定的：**

1. **合并成一个技能，还是保持两个？** 如果保持两个，裁决规则必须同时写进两个
   `SKILL.md`、`index.json` 和 `agents/openai.yaml`，并且要有"兄弟技能未安装"的降级路径
   （`16-windows-platform.md:313` 已经声明了自足性判据，但只对 AMD 侧成立且没写进 `SKILL.md`）。
   如果合并成一个，`description` 的触发面如何组织、厂商路由放在哪一层、
   2531 条既有 claim 的锚点要不要动。
2. **description 怎么写。** 现在是 844 / 925 字符的关键词墙，一半是逗号分隔的 `Triggers -` 列表。
   而**两个 description 都不含任何开发类词汇**——问"怎么写 hypervisor"根本触发不了。
   新增的开发轨道和 CPU 世代轨道必须在触发面上有位置。
3. **`00-quickref.md` 要不要上移进 `SKILL.md`。** 诊断的判断是
   *"这是全仓库最好的资产，而且被低估了"*——症状到章节的映射、表到归属章节的映射、
   中英术语对照、五个 Windows 问题的一行答案、阅读顺序。
   它现在藏在 `references/` 里，而 `SKILL.md` 把路由埋在 38% 处（`intel-vt/SKILL.md:56`）。

## 依赖

**必须先有 01 的结果。** 如果目标宿主普遍无法在技能内部表达跨技能裁决，
那第 1 问的答案就被硬件约束定死了，不是偏好问题。

## 调用

`grilling` + `domain-modeling`。这个决策很可能值得一篇 ADR——
它难以回退（牵动 2531 条 claim 的锚点与全部 lint 规则）、
对后来者不解释就看不懂、且是真实权衡的结果。三条都满足。

## 交付物

决议写进本 ticket 的 `## Answer`；若产出 ADR，放 `docs/adr/`。
