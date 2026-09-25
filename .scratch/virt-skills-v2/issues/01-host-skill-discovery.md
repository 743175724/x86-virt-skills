# 01 各宿主到底怎么发现和加载技能？

Type: research
Status: resolved
Blocked by: —

## Question

用户点名的目标宿主是 **Claude Code、OpenAI Codex / ChatGPT、Kimi，以及"其他 AI"**。
本仓库 README 只声称支持 Claude Code / Codex / Hermes 三家，而且诊断已证明这三家里
只有 Codex（且必须是本仓库的 project-scope 安装）才看得到那条裁决规则。

**需要查清每一个目标宿主的以下五件事，逐条给出证据来源（官方文档 URL 或实测）：**

1. **发现路径**：它扫描哪个目录？`.claude/skills/`？`.agents/skills/`？某个 home 下的路径？
   还是根本不扫目录、只吃单个 prompt？
2. **入口文件**：它读 `SKILL.md`？`AGENTS.md`？`index.json`？还是自定义清单格式？
3. **触发机制**：靠 frontmatter `description` 做语义匹配？靠关键词？还是要用户手动调用？
   如果是语义匹配，description 的长度上限和最佳形态是什么？
4. **符号链接 / junction 是否可见**：本仓库的 `.claude/skills/*` 和 `.agents/skills/*` 是
   Windows 目录 junction 且被 gitignore。用 `readdir(dir, {withFileTypes:true})` 再
   `dirent.isDirectory()` 过滤的宿主会拿到 `false` 并**静默跳过**。哪些宿主有这个问题？
5. **多技能裁决**：当两个技能的触发词重合时，这个宿主怎么选？有没有办法在技能内部表达
   "这类问题归我、那类归兄弟技能"？

**特别要回答的：**

- **Kimi** 支持 Agent Skills 规范吗？它的技能目录约定是什么？这是用户的主要目标之一，
  但本仓库完全没有针对它的适配。
- **"其他 AI"**：至少覆盖 Cursor、Windsurf、Gemini CLI、Cline 中可查到的几家。
- **有没有宿主完全不支持文件系统**（纯网页对话）？如果有，它需要什么形态——
  单文件？粘贴式 prompt？这决定地图上"网页版单文件蒸馏"那块迷雾会不会毕业成 ticket。

## 为什么这个 ticket 阻塞了 06

"一个技能还是两个"这个架构决策，完全取决于宿主们**有没有能力**在技能内部表达裁决规则。
如果所有目标宿主都只做单技能语义匹配、无法处理"两个技能互相引用"，那答案就只能是合并成一个。

## 交付物

一张表：行是宿主，列是上面五件事 + 结论（现状可用 / 需适配 / 不可能支持）。
每格带证据链接。写到 `.scratch/virt-skills-v2/research/01-host-discovery.md`。

---

## Answer

完整报告：[`research/01-host-discovery.md`](../research/01-host-discovery.md)（998 行，逐格带证据链接）。

### 结论一：**"靠宿主仲裁"这个选项不存在**

调查的 **8 家宿主，没有一家**做 harness 侧的触发词匹配。全部是
"把 name + description 给模型，让模型自己选一个"。同名技能有确定性规则，
**触发词重合零机制**。Agent Skills 规范站自己承认：

> *"Most implementations rely on the model's own judgment as the activation mechanism,
> rather than implementing harness-side trigger matching."*

这一条直接决定 06：**保留两个技能就意味着裁决必须由模型在 description 之间完成**，
而这正是当前失败的地方。

### 结论二：裁决免责句其实写了，但写在了会被截断的位置

两个 `SKILL.md` 的 description 里**确实有**兄弟技能免责句——但在**最末尾**。
而 Claude Code 的预算是 1,536 字符 + 1%，Codex 是 2% / 8,000 字符且明文
"shortens skill descriptions first"。**末尾正是截断时最先丢的位置。**

叠加另外两条：
- 裁决规则的完整版写在根 `AGENTS.md`，而 `install.mjs` 从不安装它；
  Gemini CLI 更是把"`AGENTS.md` 进默认 context"的提案以 `not_planned` 关闭。
- **跨全部宿主唯一可用的字段就是 `description` 本身**。Cline 和 claude.ai 上传通道的
  frontmatter 是**封闭白名单**，任何自定义"归属"字段会被直接拒收。

### 结论三：合并成一个技能，等于把问题降级到一个安全的位置

合并后，裁决从"宿主必须仲裁"变成"`SKILL.md` body 里的内部路由"——
而 **body 是完整加载、不截断、不受 frontmatter 白名单管的**。

保留两个仍然可行，但代价明确：免责句必须前置、8 个重合触发词必须删掉、
description 必须按最严的 1024 上限写，且在 Gemini CLI 上是两次用户确认。

### 结论四：Kimi 现在就能用，代码一行不用改

**Kimi Code CLI 2.1.1 本机已安装。** 它读 `.agents/skills/` 和 `.kimi-code/skills/`，
**不读 `.claude/skills/`**。它支持 Agent Skills 规范（官方文档首句即引 agentskills.io），
只是 2.x 把发现路径从 legacy `kimi-cli` 的 `.claude/skills` 换成了 `.kimi-code/skills`。
**本仓库已有的 `.agents/skills/` 正好覆盖它**——junction 也没问题（用 `fs.stat` 而非 `dirent`）。
要改的只有 README 和 install 的输出文案。

### 各宿主判定

| 宿主 | 判定 | 关键点 |
|---|---|---|
| **Kimi Code CLI 2.1.1**（本机已装） | **现状可用** | 读 `.agents/skills/` + `.kimi-code/skills/`，不读 `.claude/skills/` |
| **Claude Code** | **现状可用** | 官方支持 symlink |
| **OpenAI Codex** | **现状可用** | 官方明写 "follows the symlink target" |
| **Cline** | 现状可用 | `.claude/skills` + `.agents/skills` 都读，跟随符号链接 |
| **Gemini CLI** | 现状可用 | 自建 junction；`.gemini` ↔ `.agents` 互链会刷重复告警（未修） |
| **Windsurf**（已更名 Devin Desktop） | 现状可用 | 曾不跟随符号链接，2026-05-26 修复 |
| **Cursor** | **需验证** | **唯一确认踩过 symlink 坑**：staff 2026-01-27 称 "Cursor doesn't follow symlinks yet"，声称 2.5 修复，但 Cloud Agent 至今无声明 |
| **Hermes Agent** | 需适配 | 项目级技能有**信任门控**，要加进 `skills.trusted_project_dirs` |
| Kimi 网页 / APP | 需适配 | 无文件系统，Skills 面板托管 |
| ChatGPT 网页 / 移动端 | 需适配 | 独立技能进不去，**必须打成 plugin** |
| claude.ai / Cowork | 需适配 | frontmatter 只许规范六字段（本仓库恰好全合规） |

### 结论五：无文件系统的宿主要的是技能包，不是粘贴 prompt

三家（Kimi 网页、ChatGPT 网页/移动端、claude.ai/Cowork）**都接受符合规范的技能包**，
不是粘贴式长 prompt。所以"网页版蒸馏"的目标形态仍是 `SKILL.md` + `references/`，
**真正的约束是体积**：规范建议 body < 5000 token，而两个 corpus 合计约 **548k token**。

这块迷雾已具备可提问性 → 毕业为 **ticket 11**。

## 遗留缺口

**Kimi 网页能否直接上传现成的 `SKILL.md` 技能包？** 帮助页只说明了面板一键添加、
社区下载、上传文档生成三条路径，没说能不能直传规范包。这决定 ticket 11 该产出什么格式。
已记入 11 的依赖。
