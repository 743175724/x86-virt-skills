# 01 各宿主到底怎么发现和加载技能？

Type: research
Status: open
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
