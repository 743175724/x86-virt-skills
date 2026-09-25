# 地图：x86-virt-skills v2 改造

Label: `wayfinder:map`
Created: 2026-09-26
Baseline commit: `9192e4c`（改造前的工作树快照）

## Destination

**一份可交接的 v2 改造 spec**，它要说清三件事并且三件事必须互相自洽：

1. **结构契约**——一个 AI agent（Claude Code / Codex / Kimi / 其他）在零上下文下拿到这套技能，能不能**无歧义地**找到它需要的那一段，并且在有限 token 预算内读完。
2. **开发轨道**如何纳入：让 agent 不只是查架构事实，而是能**动手写** hypervisor（含轻量级 thin hypervisor）。
3. **CPU 世代/型号轨道**如何纳入：Intel 10 代 → Core Ultra 300、AMD Zen 1 → Zen 5，**以客户端为主**，能回答"我这颗具体的 CPU 上这条还成不成立"。

这张图**到 spec 为止**。写章节、改内容是 spec 交接之后的事。

## Notes

**领域**：x86 硬件虚拟化知识库技能（Intel VT-x/VMX/VT-d、AMD-V/SVM/IOMMU），面向 Windows PC。
仓库 `C:\Users\Administrator\src\x86-virt-skills`，现有两个技能各约 8000 行参考章节，
2650 + 2067 条带规范锚点的 claim，lint / build --check 均通过。

**每个 session 都要看的**：
- 本仓库 tracker 约定：`docs/agents/issue-tracker.md`（wayfinding 操作在其 "Wayfinding operations" 节）
- 诊断报告的结论已固化进各 ticket，不要重新诊断一遍
- 调用 skill：`grilling` + `domain-modeling`（默认）；research 型 ticket 调用 `research`

**本 effort 的固定偏好**：
- **与人沟通用中文**；文件路径、代码标识符、引用原文保持英文原样
- **规划，不施工**。产出决策，不产出成品章节。这条只有 spec 交接后才解除
- **不推翻现有的认知纪律**。诊断报告第 4-8 条列出的"好东西"——单文件隔离 dated facts、
  `Maps to:/Owns:/See also:` 章节头、"负面声明需要与正面声明同等证据"、宁可声明缺口也不填塞——
  是这套资产最值钱的部分，v2 必须继承，不得在重构中丢失
- 用户手上有真机：**Intel Core Ultra 7 265KF**（Arrow Lake-S，20C/20T 无超线程，无核显，无 vPro）。
  凡是能在真机上实测的结论，优先实测，不要停在文档推断

**已经查实、不要再查的事实**：
- 裁决规则只存在于根 `AGENTS.md:34-43`，由 `tools/build.mjs:159-168` 生成；
  两个 `SKILL.md` 里都没有，`index.json` 和 `agents/openai.yaml` 里也没有
- `tools/install.mjs` 从不安装 `AGENTS.md`（grep 无命中）→ user-scope 安装下裁决规则根本不存在
- 8 个重合触发词：`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2` `Kernel DMA Protection` `hypervisor`
- 章节真实体积被低估约 5 倍："310–570 lines" 实际是 15k–26k token；
  `13-tdx.md` 单章约 26.1k token；两个 corpus 合计约 548k token
- 开发内容：Intel 仅 3 段被明确免责的 C 代码，AMD **零**代码。
  两个 description 都不含开发类触发词 → 问"怎么写 hypervisor"**根本触发不了**
- CPU 型号覆盖：Intel 客户端仅 `90-dated-landscape.md:101-104` 两条 claim；
  Comet/Rocket/Alder/Raptor/Meteor/Lunar/Arrow Lake 代号命中均为 **0**；
  "Hyper-Threading" 全库仅 1 处，还是 2010 年 i7-920 的测试环境描述。
  AMD 有正确形状的 family/model 表（`90-dated-landscape.md:46-57`）但**只覆盖 EPYC**，
  客户端 Ryzen 仅 1 条 claim；`Zen 5c` / `Ryzen AI` 命中 **0**

## Decisions so far

<!-- 索引：每个已关闭 ticket 一行，够判断相关性即可；细节在 ticket 里 -->

## Not yet specified

以下是能看见轮廓、但还没法写成精确问题的部分。前沿推进后再毕业成 ticket。

- **内容迁移的具体切分**：哪些章节合并、拆分、或降级为附录。取决于 06 和 07 定下的结构。
- **中英文策略**：`index.json` 已有 `summary_zh`，但章节正文全英文，而主要使用者用中文提问。
  是否需要中文路由层？全文双语的成本是否可接受？取决于 06。
- **网页版单文件蒸馏**：若需支持无文件系统的对话模型，蒸馏到什么粒度、丢什么、怎么保证不失真。取决于 01。
- **真机验证流程**：265KF 能验证哪些结论、怎么记录、算不算 Tier-1 证据。取决于 09。
- **2531 条既有 claim 的重锚成本**：若结构大改，锚点和 lint 规则要动多少。取决于 06、07。
- **v2 的 eval 扩展**：开发题和按型号查询题怎么出、怎么评分。取决于 08、09。

## Out of scope

- **重写既有内容**。v2 是结构与入口改造，不是内容重写。现有 claim 的正确性已经过 2531 条核对和两轮盲测，不在本图范围内推翻。
- **扩大服务器/云覆盖**（EPYC、Xeon、TDX 服务器场景的深度）。目标平台是 Windows PC 客户端。
- **非 x86 深度**（ARM CCA、RISC-V H 扩展）。保留现有的对比章节即可。
- **`C:\Users\Administrator\Desktop\Kimi_Agent` 目录的 GitHub tracker 配置**。那是另一件事，不要混进来。
