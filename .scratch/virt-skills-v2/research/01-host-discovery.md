# 01 — 各宿主如何发现和加载 Agent Skill

Type: research result
Ticket: `.scratch/virt-skills-v2/issues/01-host-skill-discovery.md`
Researched: 2026-09-26
Researcher: research agent（primary-source only）

## 证据分级约定

本文沿用仓库的证据纪律。每条结论标注来源类型：

- **[DOC]** — 宿主官方文档页 / changelog，附 URL 与抓取日期。
- **[DOC-forum] / [DOC-issue]** — 宿主官方论坛或 issue tracker 里**由已验证的官方账号**
  作出的陈述。比文档弱一档（不是承诺、可能过期），但对"symlink 到底跟不跟随"这类
  文档根本不写的问题，它常常是唯一的一手来源。引用时必须带发言人与日期。
- **[SRC]** — 宿主自己的源码或已安装二进制，附文件路径/行为。这是本仓库场景下最强的证据，
  因为它直接回答"这台机器上这个版本到底会不会看见我们的 junction"。
- **[OBS]** — 本机实测观察，可复现。
- **[GAP]** — 查不到。**明确声明缺口，不做推断。**

所有"宿主 X 不支持 Y"的负面声明，都限定到具体文档/版本与日期，见文末 Gaps。

---

## 总表

| 宿主 | 1 发现路径 | 2 入口文件 | 3 触发机制 | 4 junction/symlink 可见性 | 5 多技能裁决 | 结论 |
|---|---|---|---|---|---|---|
| **Kimi Code CLI 2.1.1**（本机已装） | **项目**：`.kimi-code/skills/`、`.agents/skills/`（项目根 = 最近的 `.git` 祖先）；**用户**：`$KIMI_CODE_HOME/skills/`（默认 `~/.kimi-code/skills/`）、`~/.agents/skills/`；另有 `extra_skill_dirs`、`--skills-dir`。**不扫 `.claude/skills/`** [SRC][DOC] | `SKILL.md`（目录形态，`name` + `description` **必填**）或顶层扁平 `<name>.md` [DOC] | 启动时把 name/description 注入 system prompt；模型依据 `description` + `whenToUse` 自主调用 `skill` 工具；用户可 `/skill:<name>` 显式调用；`disableModelInvocation: true` 可禁自动触发 [DOC][SRC] | **可见。** `fileSkillDiscovery.ts` 用 `fs.readdir(dirPath)`（**不带** `withFileTypes`）+ `(await fs.stat(p)).isDirectory()`，`fs.stat` 跟随 junction [SRC] | 无宿主级仲裁；同名时 Project > User > Extra > Built-in。跨技能"归属"只能靠 `description`/`whenToUse` 文本，外加 `skill` 工具支持**嵌套调用**（最多 3 层）[DOC][SRC] | **现状可用**（经 `.agents/skills/`），`.claude/skills/` 那条链路对它无效 |
| **Kimi 网页/APP（kimi.com chat, Agent 模式）** | **无文件系统**。技能来自 Skills 面板（官方/推荐）、社区下载、上传文档生成 [DOC] | 面板内的"技能"对象；用户侧看不到 `SKILL.md` 路径 [DOC] | 聊天框输入 `/` 选 Skills，或由 Kimi Agent 依问题自动触发 [DOC] | 不适用 | [GAP] 官方帮助页未说明 | **需适配**（要打包/上传形态，不是仓库目录） |
| **Claude Code**（本机运行中，claude-opus-5[1m]） | Enterprise / `~/.claude/skills/` / `.claude/skills/`（含从启动目录到 repo root 的每一层父目录）/ 嵌套子目录 / `--add-dir` 目录 / plugin `<plugin>/skills/` / claude.ai 账号同步 [DOC] | `SKILL.md`（`.claude/commands/*.md` 旧格式仍可用）[DOC] | 语义匹配 `description`（+ `when_to_use`）；`/skill-name` 显式调用；`paths` glob 可限定；`disable-model-invocation` 可禁 [DOC] | **可见。** 官方明写支持 symlink；本机 `~/.claude/skills/{intel-vt,amd-virtualization}` 是 junction，本会话技能清单里两者都在 [DOC][OBS] | 同名走位置优先级表；**触发词重合无宿主级仲裁**，全靠 `description` / `when_to_use` 文本。`skillListingBudgetFraction` 预算不足时会截断 description（先截最少用的）[DOC] | **现状可用** |
| **claude.ai / Cowork / cloud session** | 不读本机 `~/.claude/skills/`；只读账号里启用的技能；cloud session 额外读仓库里 commit 的 `.claude/skills/` [DOC] | `SKILL.md`，但 frontmatter **只许 spec 的 6 个字段**（`name`/`description`/`license`/`compatibility`/`metadata`/`allowed-tools`），多一个就硬失败 [DOC] | 同 Claude Code 的语义匹配 [DOC] | 不适用（上传/同步，不走本机路径） | 同上 | **需适配**（要上传到账号，且 frontmatter 要收窄） |
| **OpenAI Codex CLI / IDE 扩展** | `$CWD/.agents/skills`、`$CWD/../.agents/skills`、`$REPO_ROOT/.agents/skills`、`$HOME/.agents/skills`、`/etc/codex/skills`、SYSTEM 内置 [DOC] | `SKILL.md`（`name` + `description` 必填）；可选 `agents/openai.yaml` [DOC] | 渐进披露：初始只给 name + description + path；显式 `$skill` / `/skills`；隐式匹配 `description`。初始清单预算 = 模型上下文的 **2%**，未知时 **8,000 字符**，超了**先缩短 description**，再多就**整条省略并告警** [DOC] | **可见。** 官方原文：*"Codex supports symlinked skill folders and follows the symlink target when scanning these locations."* [DOC] | *"If two skills share the same `name`, Codex doesn't merge them; both can appear in skill selectors."* 触发词重合无仲裁；只能靠 description，加 `policy.allow_implicit_invocation: false` 关掉隐式 [DOC] | **现状可用** |
| **ChatGPT 网页 / 移动端（Chat & Work）** | **无本地技能目录**。*"Standalone skills are available in the ChatGPT desktop app, Codex CLI, and IDE extension. Skills bundled in plugins are also available in Chat and Work across ChatGPT on the web, desktop, and mobile."* [DOC] | 通过 plugin 打包分发 [DOC] | `@` 提及显式调用；或依 description 隐式 [DOC] | 不适用 | 同 Codex | **需适配**（必须打成 plugin 才进网页/移动端） |
| **Cursor** | 项目 `.agents/skills/`、`.cursor/skills/`；用户 `~/.agents/skills/`、`~/.cursor/skills/`；**兼容** `.claude/skills/`、`.codex/skills/`、`~/.claude/skills/`、`~/.codex/skills/`；**递归**扫子目录，且嵌套技能自动按目录限定作用域 [DOC] | `SKILL.md`（"Each skill should be a folder containing a `SKILL.md` file"）；技能身份取自含 `SKILL.md` 的那层目录名 [DOC] | 默认由 agent 判定相关性自动应用（依 `description`）；`/skill-name` 手动调用（只附着一条消息）；`paths`/legacy `globs` 按文件限定；`disable-model-invocation: true` 退化为纯 slash command [DOC] | **本次唯一确认踩过坑的宿主。** Cursor 官方论坛 staff 2026-01-27：*"Cursor doesn't follow symlinks yet when indexing skills (and rules too)."*；称 2.5 修复（2026-02-10），报告者 2026-02-19 确认；但 v2.5.22 仍有残留报告，且 **Cloud Agent 至今（2026-09-08）无官方答复** [DOC-forum] | `paths` glob；触发词重合**文档未述** [GAP]。rules 的 Team→Project→User 优先级只管 rule 来源层，不管技能 | **需适配/需验证**（本机版本必须 ≥ 2.5 且非 Cloud Agent；否则用 `--copy`） |
| **Windsurf（现已更名 Devin Desktop / Cognition）** | 工作区 `.devin/skills/`（首选）、`.windsurf/skills/`（legacy）；全局 `~/.codeium/windsurf/skills/` 或 `~/.config/devin/skills/`；**跨 agent 兼容** `.agents/skills/`、`~/.agents/skills/`，开启 Claude Code config 读取后还扫 `.claude/skills/`、`~/.claude/skills/`；另有 MDM 系统级路径 [DOC] | `SKILL.md` + YAML frontmatter，`name` 与 `description` 均必填 [DOC] | 渐进披露（默认只给 name + description）；`description` 语义匹配自动调用；**手动调用是 `@skill-name`**（`/` 留给 Workflows）[DOC] | **曾经不可见，已修复。** Devin CLI changelog `v2026.5.26-0`（2026-05-26）Fixed：*"The in-session `skill` tool now finds skills behind symlinked directories under `.windsurf/skills/`, `.agents/skills/`, and `.claude/skills/`, matching `devin skills list`."*；2026-09-10 又加了跨路径别名去重 [DOC] | 技能之间**文档未述** [GAP]。Workflows 有 System>Workspace>Global>Built-in；rules 是合并不覆盖 | **现状可用**（需较新版本） |
| **Gemini CLI** | 内置 → extension → 用户 `~/.gemini/skills/` 或 `~/.agents/skills/` → workspace `.gemini/skills/` 或 `.agents/skills/`。同层内 `.agents/skills/` 优先。**不读 `.claude/skills/`**（repo grep 为负）[DOC][SRC] | `SKILL.md`；glob 只到 `*/SKILL.md`，**一层深** [SRC] | 启动注入 name+description；模型判定匹配后调 `activate_skill` 工具；**每次激活都要用户确认**；`/skills list` 查看。无 per-skill slash command [DOC] | **跟随。** 维护者在 issue #16247 结案时明说 "it turns out symlinks **are** supported"；而且 `gemini skills link` **自己就在 Windows 上建 junction**。**但有未修复缺陷**：loader 不做 `realpath`，`.gemini`↔`.agents` 互为 junction 时会重复发现并每次报 "Skill conflict detected"（#26579 / #28944，三个修复 PR 均 closed unmerged）[SRC][DOC-issue] | *"If multiple skills share the same name, the version from the higher-precedence location is used."* 不同名的触发词重合只有散文建议 *"Avoid overlap"*，**无机制** [DOC] | **现状可用**（但别把 `.gemini/skills` 和 `.agents/skills` 互链，会刷警告） |
| **Cline** | 项目 `.cline/skills/`（推荐）、`.clinerules/skills/`、**`.claude/skills/`**、`.agents/skills/`；全局 `~/.cline/skills/`、`~/.agents/skills/` [DOC][SRC] | `SKILL.md`，`name` **必须等于目录名**，否则静默丢弃 [DOC][SRC] | 三级渐进加载；description 匹配 → `use_skill` 工具；**也支持 `/skill-name` 显式调用**；每个技能有开关（写回 frontmatter `disabled: true`）[DOC] | **跟随。** SDK 的 `user-instruction-config-loader.ts` 显式写 `entry.isSymbolicLink() && (await stat(entryPath)).isDirectory()`；VS Code 侧用 `fs.stat`（非 `lstat`）[SRC] | `remote (enterprise) > disk-global > project`（同名）。不同名重合无机制；frontmatter 是**封闭白名单** `name/description/license/compatibility/metadata/allowed-tools` [DOC][SRC] | **现状可用**（`.claude/skills/` 和 `.agents/skills/` 两条路都中） |
| **Hermes Agent（Nous Research）** | `<HERMES_HOME>/skills`（Windows 默认 `%LOCALAPPDATA%\hermes`，其他平台 `~/.hermes`）；`skills.create_dir`；`skills.external_dirs`；**信任门控**的项目级 `<project-root>/.hermes/skills/` 与 `<project-root>/.agents/skills/`（项目根 = 最近的 `.git` 祖先）[DOC][SRC] | `SKILL.md`，frontmatter 有 `name`/`description`/`version`/`author`/`platforms`/`metadata.hermes.*` [DOC] | 每个技能自动注册为 `/skill-name` slash command（一条消息最多叠 5 个）；同时也进 system prompt 索引 / `skills_list` / `skill_view` 供模型自主调用 [DOC][SRC] | **跟随。** `agent/skill_utils.py` 用 `os.walk(skills_dir_str, followlinks=True)` [SRC] | 优先级 `project → local → external_dirs`，first-wins 去重；slash command 撞名时保留第一个并 warn。触发词重合无仲裁 [DOC][SRC] | **需适配**（项目级技能默认不加载，须把 repo 加进 `skills.trusted_project_dirs`） |

---

## 逐宿主细节

### Kimi —— 最高优先级，也是本次最大的反转

**它支持 Agent Skills 规范，而且是明确按 agentskills.io 写的。**

Kimi Code CLI 官方文档开头原文（`https://raw.githubusercontent.com/MoonshotAI/kimi-cli/main/docs/en/customization/skills.md`，
抓取于 2026-09-26）：

> [Agent Skills](https://agentskills.io/) is an open format for adding specialized knowledge and workflows to AI agents. Kimi Code CLI supports loading Agent Skills to extend AI capabilities.

> A skill is a directory containing a `SKILL.md` file. When Kimi Code CLI starts, it discovers all skills and injects their names, paths, and descriptions into the system prompt. The AI will decide on its own whether to read the specific `SKILL.md` file to get detailed guidance based on the current task's needs.

**但是有一个必须分清的版本断层，否则会得出错误结论：**

| 产品 | 仓库 | 语言 | 用户级 brand 目录 | 项目级 brand 目录 | 读 `.claude/skills/` 吗 |
|---|---|---|---|---|---|
| **legacy `kimi-cli`** | `MoonshotAI/kimi-cli` | Python | `~/.kimi/skills/`、`~/.claude/skills/`、`~/.codex/skills/` | `.kimi/skills/`、`.claude/skills/`、`.codex/skills/` | **读** |
| **当前 `kimi-code`（本机装的）** | `MoonshotAI/kimi-code` | TypeScript/Node | `$KIMI_CODE_HOME/skills/` | `.kimi-code/skills/` | **不读**（只当"导入源") |

本机 [OBS]：`C:\Users\Administrator\.kimi-code\bin\kimi.exe --version` → `2.1.1`，
help 尾部 `Documentation: https://moonshotai.github.io/kimi-code/`，并带一个
`migrate  Migrate data from a legacy kimi-cli installation into kimi-code` 子命令。
即本机装的是 kimi-code，legacy kimi-cli 的行为不适用。

**[SRC] 直接从已装二进制里取出的发现根定义**（`kimi.exe` 内嵌 bundle，
对应 `packages/agent-core-v2/src/features/skill/catalog/skillRoots.ts`）：

```js
USER_BRAND_DIRS = ["skills"];
USER_GENERIC_DIRS = [".agents/skills"];
PROJECT_BRAND_DIRS = [".kimi-code/skills"];
PROJECT_GENERIC_DIRS = [".agents/skills"];
```

`.claude/skills` 这个字符串确实出现在 2.1.1 的二进制里，但**只出现在内置技能
`import-from-cc-codex` 的提示词正文中**，那段文字是叫模型把 Claude/Codex 的技能
**复制**进 Kimi 自己的目录：

> Recognize these skill shapes under `.claude/skills/` or `.codex/skills/`:
> - Directory bundle: `<skill-name>/SKILL.md`
> - Flat markdown skill: `<skill-name>.md`
> Copy the entire directory bundle or flat markdown file.

同一段提示词里还有一句 `Do not scan project-root AGENTS.md, project-root CLAUDE.md, .agents/**` ——
这是**导入流程**的约束，不是发现流程的。

> **结论（负面声明，限定版本与日期）**：截至 2026-09-26、Kimi Code 2.1.1，
> `.claude/skills/` 与 `~/.claude/skills/` **不是** Kimi 的技能发现根。
> 依据是已安装二进制内 `skillRoots.ts` 的常量定义，以及 kimi-code 官方文档
> `https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/docs/en/customization/skills.md`
> 的 "Skill Locations" 一节（该节只列 `$KIMI_CODE_HOME/skills/`、`~/.agents/skills/`、
> `.kimi-code/skills/`、`.agents/skills/`）。

**好消息：本仓库现在这套安装方式对 Kimi 是有效的。**
`tools/install.mjs` 会建 `.agents/skills/<name>`（项目级）和 `~/.agents/skills/<name>`（`--user`），
两者都在 Kimi 的 generic group 里。

**junction 可见性 —— 明确无问题 [SRC]：**
`packages/agent-core-v2/src/features/skill/catalog/fileSkillDiscovery.ts`：

```ts
entries = [...(await fs.readdir(dirPath))].toSorted();   // 注意：没有 withFileTypes
...
async function isDir(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isDirectory(); } catch { return false; }
}
```

`fs.stat` 跟随 reparse point，因此 Windows directory junction 返回 `true`。
Ticket 里担心的 `readdir(dir,{withFileTypes:true})` + `dirent.isDirectory()` 模式
**在 Kimi 这里不存在**。`skillRoots.ts` 还会对根目录额外做一次 `fs.realpath`。

**frontmatter 与触发 [DOC]**（kimi-code 文档 "Frontmatter Fields"）：

| 字段 | 说明 |
|---|---|
| `name` | 目录形态 `SKILL.md` **必填** |
| `description` | 目录形态 **必填**；"One-line summary the model uses to decide when to invoke" |
| `type` | `prompt`(默认) / `inline` / `flow`（`flow` 只能手动调） |
| `whenToUse` | "Description of when the Skill should be triggered"，也接受 `when-to-use` / `when_to_use` |
| `disableModelInvocation` | `true` 则禁止模型自动调用 |
| `arguments` | 命名参数 |

> In a directory-form `SKILL.md`, both `name` and `description` **must** be explicitly provided. Omitting either one will cause parsing to fail.

> The model can also invoke a Skill automatically based on `description` and `whenToUse` (unless `disableModelInvocation` is `true` or `type` is `flow`). Skill invocations allow up to 3 levels of nesting; beyond that they are terminated.

**description 长度上限**：kimi-code 2.x 文档**没有**写字数上限 [GAP]。
legacy kimi-cli 文档写的是 `description` "1-1024 characters"、`name` "1-64 characters"、
`compatibility` "up to 500 characters"。本仓库两个 description 分别是
**844 / 925 字符** [OBS]，在 agentskills.io 规范的 1024 上限之内，也在 Claude Code
的 1,536 合并上限之内，暂不需要裁剪。

**[OBS] 一个需要留意的现场状态**：`C:\Users\Administrator\.kimi-code\skills\` 下已经有
`intel-vt/` 和 `amd-virtualization/` 的**实体拷贝**（`LinkType` 为空，不是链接），
还有一个 `ace-detections.7z`。这些拷贝**不是** `tools/install.mjs` 造的（该脚本从不写
`~/.kimi-code`），应该是手工或经 `import-from-cc-codex` 导入的。它们是快照，
源仓库改了不会跟着变 —— 属于"陈旧产物"风险，v2 的安装契约需要正面处理。

**Kimi 网页/APP（无文件系统那一档）** [DOC]
`https://www.kimi.com/en/help/plugins-and-skills/what-are-skills`（抓取 2026-09-26）：

> Skills are reusable knowledge packages that extend what an Agent can do.

来源三种：Skills 面板里的官方/推荐技能（"Click ➕ to add it in one step."）、
社区下载、以及"Upload a document to generate a Skill"。触发：

> Type `/` in the chat input box and select Skills, or let Kimi Agent trigger the right Skill automatically based on your question.

该页**完全没有提到本地目录**。它是一个纯托管的技能面板。

---

### Claude Code

**[DOC]** `https://code.claude.com/docs/en/skills`（抓取 2026-09-26）

> Claude Code skills follow the [Agent Skills](https://agentskills.io) open standard, which works across multiple AI tools. Claude Code extends the standard with additional features like invocation control, subagent execution, and dynamic context injection.

位置表（节选）：Enterprise（managed settings 目录下的 `.claude/skills/<skill-name>/SKILL.md`）、
Personal `~/.claude/skills/<skill-name>/SKILL.md`、Project `.claude/skills/<skill-name>/SKILL.md`、
Nested `<subdir>/.claude/skills/...`、`--add-dir` 目录、Plugin `<plugin>/skills/...`、claude.ai 账号同步。

> Claude Code loads project skills from `.claude/skills/` in the directory where you start it and in every parent directory up to the repository root.

**junction/symlink —— 官方明确支持，且本机实测通过：**

> **Symlinked folders**: a `<skill-name>` entry in the enterprise, personal, or project location can be a symlink to a directory elsewhere on disk. Claude Code reads `SKILL.md` from the target and loads the skill once even if several locations point at the same target.

**[OBS]** 本次会话（2026-09-26，Claude Code，工作目录 `C:\Users\Administrator\Desktop\Kimi_Agent`，
该目录下**没有** `.claude/`）的可用技能清单里出现了 `amd-virtualization` 和 `intel-vt`，
描述文本与 `intel-vt/SKILL.md` frontmatter 的 `description` 完全一致。
本机唯一来源是 `~/.claude/skills/{intel-vt,amd-virtualization}`，`PowerShell` 查得
`Attributes: Directory, ReparsePoint`、`LinkType: Junction`、`Target: C:\Users\Administrator\src\x86-virt-skills\...`；
`find ~/.claude -iname SKILL.md -path "*intel*"` 无实体拷贝命中。
→ **Claude Code 在 Windows 上确实跟随 directory junction。**

顺带一条对比实测 [OBS]，说明 ticket 里那个担心是真实存在的机制，只是这几家没踩：
在 Node v24.19.0 上对同一批 junction 跑

```js
readdirSync(dir, {withFileTypes:true}) →
  { dirent_isDirectory: false, dirent_isSymbolicLink: true,
    lstat_isDirectory: false, stat_isDirectory: true }
```

即 `dirent.isDirectory()` 为 `false`、`statSync().isDirectory()` 为 `true`。
**任何用前者过滤的宿主都会静默跳过这两个技能。** 本次查到的宿主里没有一家这么写，
但这是 v2 安装契约必须记住的失败模式。

**触发与长度 [DOC]：**

> `description` … What the skill does and when to use it. Claude uses this to decide when to apply the skill. … Put the key use case first: the combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing to reduce context usage.

> `when_to_use` … Additional context for when Claude should invoke the skill, such as trigger phrases or example requests. Appended to `description` in the skill listing and counts toward the 1,536-character cap.

> The budget scales at 1% of the model's context window. When the listing overflows, Claude Code drops descriptions starting with the skills you invoke least, so the skills you use most keep their full text.

→ **description 会被截断**，所以"把关键用例和触发词放前面"不是风格建议，是机制要求。

**多技能裁决 [DOC]：**
只有**同名**才有确定性规则（Enterprise > Personal > Project；plugin 用 `/plugin:skill` 命名空间；
nested 两者共存并由 Claude 按"在哪个目录干活"选）。
**触发词重合没有任何宿主级仲裁**——文档给的唯一手段是文本：

> If a skill seems to stop influencing behavior after the first response … Strengthen the skill's `description` and instructions so the model keeps preferring it, or use hooks to enforce behavior deterministically.

另有 `paths`（glob，按正在编辑的文件限定）和 `disable-model-invocation`，
但对"Intel 问题 vs AMD 问题"这种**按题目内容**分流的场景，`paths` 帮不上忙。

**claude.ai / Cowork / cloud session [DOC]：**

> [Cowork] sessions and cloud sessions, including routines, don't read `~/.claude/skills/` on your machine.

且上传到 claude.ai 时 frontmatter 被收窄：

> If you include any field the spec doesn't allow, packaging or upload fails with a hard error instead of ignoring the field:
> `Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata, name`

本仓库两个 `SKILL.md` 的 frontmatter 字段是 `name, description, license, metadata` [OBS] ——
**全在允许集内，上传到 claude.ai 不会报错。** 这是个已经踩对了的点，v2 不要弄丢。

---

### OpenAI Codex / ChatGPT

**[DOC]** `https://developers.openai.com/codex/skills.md`（抓取 2026-09-26）

> Codex reads skills from repository, user, admin, and system locations. For repositories, Codex scans `.agents/skills` in every directory from your current working directory up to the repository root.

作用域表：`$CWD/.agents/skills`、`$CWD/../.agents/skills`、`$REPO_ROOT/.agents/skills`、
`$HOME/.agents/skills`、`/etc/codex/skills`、SYSTEM（随 Codex 分发）。

**junction/symlink —— 官方一句话直接回答 [DOC]：**

> Codex supports symlinked skill folders and follows the symlink target when scanning these locations.

**触发机制与 description 形态 [DOC]：**

> Skills use **progressive disclosure** to manage context efficiently. ChatGPT and Codex start with each skill's name and description, then load the full `SKILL.md` instructions when they decide to use that skill.

> In Codex, the initial list also includes each skill's file path. To avoid crowding out the rest of the prompt, this list uses at most 2% of the model's context window, or 8,000 characters when the context window is unknown. If many skills are installed, Codex shortens skill descriptions first. For large skill sets, Codex may omit some skills from the initial list and show a warning.

> Because implicit matching depends on `description`, write concise descriptions with clear scope and boundaries. Front-load the key use case and trigger words so a host can still match the skill if descriptions are shortened.

**这是"最佳形态"的权威答案，而且和 Claude Code 的截断规则一致：关键用例 + 触发词前置。**
本仓库两个 description 目前把 `Triggers - ...` 长列表放在中段、把
`Do NOT use for X-primary questions - the sibling Y skill owns those` 放在**最末尾** ——
**恰好是最容易被截掉的位置。**

**多技能裁决 [DOC]：**

> If two skills share the same `name`, Codex doesn't merge them; both can appear in skill selectors.

即 Codex 连同名都不合并，更没有触发词重合的仲裁。唯一的宿主级开关是
`agents/openai.yaml` 里的 `policy.allow_implicit_invocation`（本仓库两个技能都生成了
`allow_implicit_invocation: true` [OBS]），它只能"关掉隐式"，不能表达"这类归我那类归他"。

**ChatGPT 网页/移动端 —— 无文件系统那一档 [DOC]：**

> Standalone skills are available in the ChatGPT desktop app, Codex CLI, and IDE extension. Skills bundled in plugins are also available in Chat and Work across ChatGPT on the web, desktop, and mobile.

→ 网页/移动端 ChatGPT **不读任何本地技能目录**；技能要进那里，**必须打成 plugin**。

---

### Cursor —— 唯一确认踩过 symlink 坑的宿主

**[DOC]** `https://cursor.com/docs/skills`（抓取 2026-09-26；`docs.cursor.com` 已 308 重定向到
`cursor.com/docs`。页面**不显示**最后更新日期。）

- 扫描：项目 `.agents/skills/` 与 `.cursor/skills/`；用户 `~/.agents/skills/` 与 `~/.cursor/skills/`。
  > For compatibility, Cursor also loads skills from Claude and Codex directories: `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, and `~/.codex/skills/`.
- 递归扫描，且嵌套技能自动限定作用域：
  > Cursor walks the skills root recursively and picks up any `SKILL.md` it finds

  > Skills in nested project directories are automatically scoped to files inside that directory. … you don't need to set `paths` on a nested skill to scope it to its directory.
- 入口：
  > Each skill should be a folder containing a `SKILL.md` file

  > The skill's identity comes from the folder containing `SKILL.md` … not the parent category.
- 触发：
  > When Cursor starts, it automatically discovers skills from skill directories and makes them available to Agent. The agent is presented with available skills and decides when they are relevant based on context.

  `description` 字段说明（Required = Yes）：*"Describes what the skill does and when to use it. Used by the agent to determine relevance."*
  手动调用：*"Skills can also be manually invoked by typing `/` in Agent chat … A skill invoked this way attaches to one message."*
- **description 长度上限：Cursor 自己的文档没写** [GAP]。它只说 "Agent Skills is an open standard.
  Learn more at agentskills.io."，而 1024 的上限是**规范**的，**不能记到 Cursor 头上**。

**symlink —— 这是本次最重要的负面证据，而且证据不在文档里而在官方论坛：**

`forum.cursor.com` 上两位 staff（账号经 `forum.cursor.com/u/<name>.json` 验证为
`moderator: true, admin: true`）的原话：

> "Hey, thanks for the report. This is a known issue. Cursor doesn't follow symlinks yet when indexing skills (and rules too). The team is aware."
> —— `deanrie`, 2026-01-27,
> `https://forum.cursor.com/t/bug-report-skills-in-symlinked-directories-not-detected-after-cursor-restart/150029`

同帖还有一条**与本仓库场景高度吻合**的细节：

> "Other users say symlinks in the project-level `.cursor/skills` (in the project root) seem to work in v2.4.21, but symlinks in the home directory `~/.cursor/skills` don't."

> "Workaround for now: copy the files directly instead of using symlinks until it's fixed."

后续：

> "Thanks for reporting this. This is a known issue on our side (and also affects Rules), and we have a ticket open for this already."
> —— `Colin`, 2026-01-23, `https://forum.cursor.com/t/cursor-doesnt-follow-symlinks-to-discover-skills/149693`

> "Hey everyone! This will be fixed in 2.5, which is just around the corner."
> —— `Colin`, 2026-02-10，同帖

> "I can confirm that this is now indeed fixed in 2.5"
> —— 报告者 `borekb`, 2026-02-19，同帖

**但修复不彻底，两条尾巴至今未收：**

> "I'm on v2.5.22, and skills installed via symlink still disappear from the Skills settings tab after restarting Cursor."
> —— `SavageSausage`, 2026-02-24，同帖。staff 回复是 "Please raise new threads."，**没有状态结论**。

> Cloud Agent 上的 symlink 技能支持请求帖
> `https://forum.cursor.com/t/symlink-support-for-skills-missing-in-cursor-cloud-agent/153603`
> 最新一条是 2026-09-08 的 "Is this supported yet? Seem to have the same issue."，**无 staff 答复**。

> **限定后的负面声明**：截至 2026-09-26，
> (a) Cursor **< 2.5** 不跟随 symlink/junction 索引技能与 rules（官方论坛 staff 2026-01-27）；
> (b) Cursor **Cloud Agent** 是否支持，**无任何官方声明**；
> (c) Cursor **≥ 2.5 本地**据称已修复，但 v2.5.22 的残留报告没有官方收尾。
>
> → 对本仓库的实际含义：**Cursor 是目前唯一需要把 `--copy` 当作默认建议的宿主。**

**多技能裁决**：文档**完全没写**技能之间怎么选 [GAP]。
唯一记录的优先级是 rules 的 `Team Rules → Project Rules → User Rules`，
那管的是 rule **来源层**，不是两个同级技能。

**一条会影响技能正文写法的差异**：Cursor 用 `/skill-name` 手动调用、`@` 用于附加上下文；
Windsurf 正好相反（`@skill-name` 调技能、`/` 调 workflow）。
**技能正文里写死"输入 `/xxx`"会在另一家上是错的。**

---

### Windsurf（现已更名 Devin Desktop）

**先解决品牌问题**：`windsurf.com` → `devin.ai/desktop`，
`docs.windsurf.com` → `docs.devin.ai/desktop/getting-started`（2026-09-26 实测 307/200）。
Windsurf 品牌的 URL 仍可解析，下面按 ticket 要求用 Windsurf URL 引用，并标出重定向目标。

**技能支持的时间线 [DOC]**（`https://docs.windsurf.com/windsurf/changelog`）：

| 版本 / 日期 | 原文 |
|---|---|
| v1.13.6 / 2026-01-13 | "Windsurf now supports Agent Skills for Cascade." |
| v1.9552.21 / 2026-02-12 | "Added support for reading skills from the `.agents/skills` directory" |
| v1.9577.24 / 2026-03-09 | "Add support for loading `SKILL.md` files from the `.windsurf/skills/` directory" |

**发现路径 [DOC]**（`https://docs.windsurf.com/windsurf/cascade/skills`
→ `https://docs.devin.ai/desktop/cascade/skills`）：

- 工作区：`.devin/skills/<skill-name>/`（首选），"the legacy `.windsurf/skills/<skill-name>/` is still read"
- 全局：`~/.codeium/windsurf/skills/<skill-name>/` 或 `~/.config/devin/skills/<skill-name>/`
- 跨 agent：
  > For cross-agent compatibility, Devin Desktop also discovers skills in `.agents/skills/` and `~/.agents/skills/`. If you have enabled Claude Code config reading, `.claude/skills/` and `~/.claude/skills/` are scanned as well.
- 企业 MDM 系统级：Windows `C:\ProgramData\Devin\skills\`（legacy `C:\ProgramData\Windsurf\skills\`），
  且 "the two are not merged"

**触发 [DOC]：**

> Cascade uses **progressive disclosure**: only the skill's `name` and `description` are shown to the model by default. The full `SKILL.md` content and supporting files are loaded **only when Cascade decides to invoke the skill** (or when you `@mention` it).

> The `description` field in your skill's frontmatter is key: it helps Cascade understand when to invoke the skill.

> You can always explicitly activate a skill by typing `@skill-name` in the Cascade input.

**description 长度上限：文档没写** [GAP]。
（12,000 / 6,000 字符的上限是 **rules** 的，不是技能 description 的——不要混用。）

**symlink —— 曾经坏过，已在 Devin CLI 侧修复 [DOC]：**

> "The in-session `skill` tool now finds skills behind symlinked directories under `.windsurf/skills/`, `.agents/skills/`, and `.claude/skills/`, matching `devin skills list`."
> —— `https://docs.devin.ai/cli/changelog/stable`，`v2026.5.26-0`（2026-05-26），Fixed 段

> "…skills reachable through more than one path (e.g. symlinked directories) load once instead of per alias…"
> —— 同上，`v3000.10.21`（2026-09-10）

注意作用域：这是 **Devin CLI** 的 changelog，而 Devin Local agent 是 Devin Desktop 新标签页的**默认** agent，
其技能格式与发现逻辑就是 Devin CLI 的：

> The [Devin Local agent] uses the Devin CLI skills format and discovery

**[GAP]**：**legacy Cascade agent**（区别于 Devin Local）是否跟随 symlink，没有任何文档或 changelog 说明。

**多技能裁决**：技能之间**文档未述** [GAP]。
有记录的只有 workflows 的 `System > Workspace > Global > Built-in`，
以及 rules 的"系统级与工作区/全局级**合并**而非覆盖"。

**一条战略层面的观察（两家一致）**：Cursor 和 Windsurf 都在把自家私有的 rule/workflow 格式
当作 legacy，向 `SKILL.md` 收敛。Cursor 2.4 内置了 `/migrate-to-skills` 转换器；
Windsurf v3.6.22（2026-07-29）的 changelog 写 "workflow surfaces explain that workflows are
being deprecated in favor of skills and link to the migration flow"。
**"该用什么格式写"这个问题，一手来源的答案是一致的：`SKILL.md`。**

---

### Gemini CLI

**[DOC]** `https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/skills.md`（抓取 2026-09-26）

> Based on the [Agent Skills](https://agentskills.io) open standard, a "skill" is a self-contained directory that packages instructions and assets into a discoverable capability.

发现层级（低→高优先级）：Built-in → Extension → User `~/.gemini/skills/` 或 `~/.agents/skills/` 别名 →
Workspace `.gemini/skills/` 或 `.agents/skills/` 别名。

> Within the same tier (user or workspace), the `.agents/skills/` alias takes precedence over the `.gemini/skills/` directory.

**未出现 `.claude/skills/`**（该文档页，2026-09-26）。

生命周期有一个别家没有的环节：

> 3. **Consent**: You will see a confirmation prompt in the UI detailing the skill's name, purpose, and the directory path it will gain access to.

即 Gemini CLI 在**激活技能时会要求用户确认**，然后才把 `SKILL.md` body 注入并把技能目录
加入允许读取路径。这对"零上下文 agent 自动读到正确章节"的目标是一个额外摩擦点。

**裁决 [DOC]：**

> If multiple skills share the same name, the version from the higher-precedence location is used.

只管同名。

**junction —— 跟随，且 Gemini CLI 自己就在造 junction [SRC][DOC-issue]：**

`packages/core/src/skills/skillLoader.ts` 的 `loadSkillsFromDir()`：

```ts
const pattern = ['SKILL.md', '*/SKILL.md'];
const skillFiles = await glob(pattern, { cwd: absoluteSearchPath, absolute: true, nodir: true, ... });
```

用的是 `glob` 12.0.0（`packages/core/package.json`）；glob README 说 `follow`
"Follow symlinked directories when expanding `**` patterns"，只约束 `**`，此处无 `**`。
**维护者已在 issue 里直接结论：**

> "Closing this issue - it turns out symlinks **are** supported. The problem was user error when creating the symlinks. When using relative paths, the path must be relative to the symlink's location, not the current directory"
> —— @davidmigloz, `https://github.com/google-gemini/gemini-cli/issues/16247`（2026-01-09 开/关）

更硬的佐证：`gemini skills link <path>` 这个命令**自己就在 Windows 上建 directory junction**，
而且注释写明了为什么（和本仓库 `install.mjs` 选 junction 的理由**一模一样**）：

```ts
// Use 'junction' on Windows to avoid EPERM errors — junctions don't require elevated
// privileges or Developer Mode (fixes #24816)
await fs.symlink(skillSourceDir, destPath, process.platform === 'win32' ? 'junction' : 'dir');
```
—— `packages/cli/src/utils/skillUtils.ts`

**但有一个未修复的缺陷，而且正好命中"同一个技能出现在两个发现根"的场景：**
loader 不做 `realpath` 去重，于是两个指向同一物理目录的根会被当成冲突：

> "The skill loader emits a `Skill conflict detected` warning when two discovery paths are symlinks pointing to the same physical directory (same inode). Because the loader does not deduplicate via `realpath`/inode, it treats the same skill file as a duplicate \"override\" and warns on every CLI invocation."
> —— `https://github.com/google-gemini/gemini-cli/issues/26579`（0.41.1）

> "To follow the open Agent Skills standard (https://agentskills.io) while retaining compatibility with legacy config paths, users may link their `.gemini` folder to the `.agents` folder via a Windows directory junction (`mklink /J .gemini .agents`) or a symlink." … "Because the CLI does not resolve symlinks/junctions to their physical absolute paths before registering them, it finds identical files twice."
> —— `https://github.com/google-gemini/gemini-cli/issues/28944`（0.56.0）

**状态：截至 2026-09-26 未修复。** 三个候选 PR（#28956 / #28968 / #29017）全部
closed 且 `merged: false`；`main` 的 `skillLoader.ts` 里没有 `realpath` 调用。

→ 实践含义：**不要把 `.gemini/skills` 和 `.agents/skills` 互链**，会每次启动刷警告。
本仓库只建 `.agents/skills`，不受影响。

**其他 Gemini CLI 事实 [SRC][DOC]：**

- description 长度：**官方文档没给**；只有内置 `skill-creator` 的校验脚本
  `validate_skill.cjs` 里有 `if (description.length > 1024)`，而 `skillLoader.ts`
  **不做任何长度校验**。所以 1024 在 Gemini 这里是"建议"不是"强制"。
- 不信任目录里 workspace 技能会被禁用：`'Workspace skills disabled because folder is not trusted.'`
- 版本线：v0.24.0（2026-01-14）首次带代码但默认关；v0.26.0（2026-01-28）默认开；
  v0.27.0（2026-02-04）转正；**`.agents/skills` 别名是 v0.28.0（2026-02-10）才加的**（PR #18151）。
- `AGENTS.md` **不是**默认 context 文件（`DEFAULT_CONTEXT_FILENAME = 'GEMINI.md'`），
  把它加进默认列表的提案 #12345 被 `not_planned` 关闭（2026-05-08）。
  → **根 `AGENTS.md` 里的裁决规则在 Gemini CLI 上默认读不到。**

---

### Cline

**[DOC]** `https://docs.cline.bot/customization/skills` + 源码（`main`，2026-09-26）

- 发现路径：项目 `.cline/skills/`（推荐）、`.clinerules/skills/`、**`.claude/skills/`**、`.agents/skills/`；
  全局 `~/.cline/skills/`、`~/.agents/skills/`。
  源码常量：

  ```ts
  const SKILL_DIRECTORY_NAMES = {
      clineruleSkillsDir: ".clinerules/skills",
      clineSkillsDir: ".cline/skills",
      claudeSkillsDir: ".claude/skills",
      agentsSkillsDir: ".agents/skills",
  } as const
  ```

  注意：**文档页漏写了 `.agents/skills`，但代码确实在扫。**
- `.claude/skills/` 从 v3.48.0（2026-01-09）第一天就有，文档原文
  `.claude/skills/ (for Claude Code compatibility)`。
- 入口：`SKILL.md`；**`name` 必须与目录名完全一致**，否则静默丢弃
  （`// Name must match directory name per spec` 后直接 `return null`）。
  → 本仓库 `intel-vt` / `amd-virtualization` 的目录名与 frontmatter `name` 一致 ✅
- description 上限：**文档明写 1024，且 SDK 强制**
  （`const MAX_AGENT_SKILL_DESCRIPTION_LENGTH = 1024;`，另有 name 64、compatibility 500）。
  本仓库 844 / 925 字符，安全。
- frontmatter 是**封闭白名单**：
  `name / description / license / compatibility / metadata / allowed-tools` ——
  与 agentskills.io 规范完全一致，超出会报错。本仓库四个字段全在内 ✅
- 触发：description 匹配 → `use_skill`；**也支持 `/skill-name` 显式调用**。

  > Unlike rules (which are always active), skills load on-demand so they don't consume context when you're working on something unrelated.

**junction —— 跟随，而且 Cline 的 PR 描述是本次找到的、对 ticket 那个失败模式最精确的一手表述 [SRC]：**

> "`withFileTypes` does **not** follow symlinks, so for a symlink those predicates are `false`. As a result, a skill materialized as a **directory symlink** (or a symlinked `SKILL.md`) is silently skipped — it never shows up in `/skills`."
> —— PR `https://github.com/cline/cline/pull/11118`，*"fix(core): discover skills materialized as directory symlinks"*

**这正是 ticket 第 4 问描述的机制，由一个真的踩过它的宿主写下来。**
该 PR 本身 `merged: false`，但等效实现已在 `main`：

```ts
const isDirectory =
    entry.isDirectory() ||
    (entry.isSymbolicLink() &&
        (await stat(entryPath).then((entryStat) => entryStat.isDirectory())
```

**反例（不影响我们，但值得记）**：Cline 的 **rules** 至今**不**跟随 symlink
（`readDirectory` 用 `withFileTypes` + `.isFile()`）。
issue #3092 → #4445 都在 2025 年被关掉且**未实现**，维护者原话
*"Cline wasn't configured for symlink usage within .clinerules."*

**裁决**：同名 `remote (enterprise) > disk-global > project`
（注意方向和多数宿主**相反**：全局压过项目）。不同名重合无机制。

---

### Hermes Agent

先解决身份问题：`tools/install.mjs` 注释里的 "Hermes" 就是
**Nous Research 的 Hermes Agent**，agentskills.io Client Showcase 登记为
`https://hermes-agent.nousresearch.com/`，源码 `https://github.com/NousResearch/hermes-agent`，
官方技能文档 `https://hermes-agent.nousresearch.com/docs/user-guide/features/skills`
（与注释中 `hermes_constants.get_hermes_home()` 的 Python 形态一致）。

**`install.mjs` 的 Hermes home 推断是对的 [SRC]。**
在 tag `v2026.9.14`（即 GitHub release "Hermes Agent v0.21.3"，发布于 2026-09-14）的
`hermes_constants.py` 里：

```python
def _get_platform_default_hermes_home() -> Path:
    """Return the platform-native default Hermes home path."""
    if sys.platform == "win32":
        local_appdata = os.environ.get("LOCALAPPDATA", "").strip()
        base = Path(local_appdata) if local_appdata else Path.home() / "AppData" / "Local"
        return base / "hermes"
    return Path.home() / ".hermes"

def get_skills_dir() -> Path:
    """Return the path to the skills directory under HERMES_HOME."""
    return get_hermes_home() / "skills"
```

但注释漏了一级：真实解析链是**三段**，不是两段——

```python
def get_hermes_home() -> Path:
    """Hermes home: context-local override → ``HERMES_HOME`` env var → platform default."""
```

另注：`v0.21.3` 是 **GitHub release 名**，tag 是 `v2026.9.14`；PyPI 上的 `hermes-agent`
最新只到 **0.19.0**（2026-07-20）。想用 `pip install hermes-agent==0.21.3` 复核的人会失败。

**发现路径共四类，不是一类 [DOC][SRC]：**

1. `<HERMES_HOME>/skills` —— "All skills live in `~/.hermes/skills/` — the primary directory and source of truth."（文档以 POSIX 路径举例）
2. `skills.create_dir`
3. `skills.external_dirs`（`<HERMES_HOME>/config.yaml`，支持 `~` 与 `${VAR}` 展开）
4. **项目级**，且是**最高优先级**：

> When you launch Hermes inside a git checkout, it looks for skills in:
> ```text
> <project-root>/.hermes/skills/    # Hermes-native location
> <project-root>/.agents/skills/    # cross-tool convention (shared with other agent CLIs)
> ```
> The project root is the nearest ancestor directory containing `.git` (worktrees and submodules count).

源码印证（`agent/skill_utils.py` @ `v2026.9.14`）：

```python
PROJECT_SKILLS_SUBDIRS = (os.path.join(".hermes", "skills"), os.path.join(".agents", "skills"))
```

**这修正了 `tools/install.mjs` 输出里的一句话。** 脚本现在打印
"Hermes does NOT scan this repo. It reads `<HERMES_HOME>/skills`"——**不准确**：
它会扫本仓库的 `.agents/skills/`，只是**默认不加载**，因为有信任门控：

> Skills are procedure documents the agent follows, so Hermes does **not** auto-load them from arbitrary cloned repos.
> Trusted roots are stored in `skills.trusted_project_dirs` in `~/.hermes/config.yaml`. Set `skills.project_discovery: false` to turn the feature off entirely (no scanning, no notices).

源码注释说得更直白：

```python
# Project-local skills (<root>/.hermes/skills, <root>/.agents/skills; root = nearest
# .git ancestor) are a prompt-injection vector if auto-sourced from any clone, so
# they load only when the root is in ``skills.trusted_project_dirs``; then they
# override same-named profile/bundled skills.
```

→ 正确的安装指引应该是：**把本仓库根加进 `skills.trusted_project_dirs`**，
而不是 "use `--user` 装到 `<HERMES_HOME>/skills`"。后者也行，但会退化成快照拷贝。
Hermes 还会对项目级技能做安全扫描，判定 dangerous 的会被隔离。

**junction/symlink —— 跟随 [SRC]：**

```python
for root, dirs, files in os.walk(skills_dir_str, followlinks=True):
```

`os.walk(..., followlinks=True)` 会递归进符号链接目录；Windows junction 同理。
文档也明说支持链接形态的 home：

> Hermes supports a symlinked `HERMES_HOME` and symlinked home subdirectories, including `hooks`, `skills`, `sessions`, and `logs`.

（一处反例，但只影响资源**列举**而非发现：`skill_commands.py` 里
`files if f.is_file() and not f.is_symlink()` 会跳过链接的附属文件。）

**触发机制 [DOC][SRC]：**

> Every installed skill is automatically available as a slash command:

> You can invoke several skills in a single message by chaining slash commands at the start — every leading `/skill` token (up to 5) is loaded, and the rest becomes your instruction:

同时技能也进 system prompt 索引、`skills_list`、`skill_view`，模型可自主调用。
所以**显式与隐式两条路都有**（这一条比初次抓取的印象更完整）。

**裁决 [DOC][SRC]：**

> Project skills are the **highest-precedence tier**: `project → local (~/.hermes/skills/) → external_dirs`.

```python
def get_scan_ordered_skills_dirs() -> List[Path]:
    """All skill dirs in precedence order: project → local → external.
    First-wins name deduplication over this order gives project skills
    priority over profile-local and external ones."""
```

slash command 撞名时：

```python
logger.warning("Skill %r maps to slash command %s already claimed by %r; keeping the first and skipping this one.",
```

即 Hermes 是本次唯一**显式实现了并记录了撞名仲裁日志**的宿主——但仍然只管**同名**，
不管触发词重合。

**[OBS]** 本机 `~/.hermes` 与 `%LOCALAPPDATA%\hermes` **都不存在**，
说明 `node tools/install.mjs --user` 从未对 Hermes 生效过，或装完被清掉了。

---

## 三个必答问题的直接回答

### Q1 Kimi 支持 Agent Skills 规范吗？

**支持，而且是一等公民。** kimi-code 官方文档首句就指向 agentskills.io。
目录约定（2.1.1）：

- 项目：`.kimi-code/skills/`、`.agents/skills/`（项目根 = 最近的 `.git` 祖先）
- 用户：`$KIMI_CODE_HOME/skills/`（默认 `~/.kimi-code/skills/`）、`~/.agents/skills/`
- 追加：`extra_skill_dirs`（config.toml 顶层）、`--skills-dir`（可重复，会**覆盖**自动发现的目录）
- 入口：`<name>/SKILL.md`（`name` + `description` 必填）**或**顶层扁平 `<name>.md`

**唯一需要改的认知**：它**不读** `.claude/skills/`。本仓库 `README` 只声称支持
Claude Code / Codex / Hermes，而 `install.mjs` 恰好也建了 `.agents/skills/` —— 所以
**Kimi 其实是"意外地已经支持了"**，只是文档和安装脚本的输出文案里完全没提它。
需要做的适配是**纯文档层面的**（把 Kimi 写进 README 和 install.mjs 的 summary，
并说清"Kimi 读的是 `~/.agents/skills`，不是 `~/.claude/skills`"），
**代码一行都不用改**。

顺带澄清一个可能的误判：**`.claude/skills/` 并没有变成废路径。**
它仍然是 Claude Code、Cursor、Windsurf（开启 Claude config 读取时）、Cline
四家的发现根。只是**对 Kimi 无效**。两个目录都建是对的。

**注意**：agentskills.io 的 Client Showcase（`https://agentskills.io/clients.md`，抓取 2026-09-26）
列了 **46 个**客户端（Cursor、Gemini CLI、Claude Code、Claude、ChatGPT & Codex、Hermes Agent、
Roo Code、OpenCode、Goose、GitHub Copilot、VS Code、Kiro、TRAE …），**其中没有 Kimi**。
这不是"Kimi 不支持"的证据——Kimi 自己的文档才是——而是说明那份名单不完整。
规范站自己也这么说：

> Agent Skills are supported by a large number of AI tools and agentic clients — see the [Client Showcase](/clients) to explore **some** of them!

该页**没有日期**；能拿到的最好的一手时间戳是其数据文件
`docs/snippets/clients.jsx` 的最后一次提交：**2026-08-09**
（`https://github.com/agentskills/agentskills/commits/main/docs/snippets/clients.jsx`）。
**这份名单不能用于任何否定推断。**

### Q2 有没有完全没有文件系统的宿主？

**有，至少三个，形态各不相同：**

| 宿主 | 需要的形态 | 证据 |
|---|---|---|
| **Kimi 网页/APP（Agent 模式）** | Skills 面板内的托管技能对象。入口是"➕ 一键添加"、社区下载、或**上传文档自动生成技能**。用户侧看不到路径 | `https://www.kimi.com/en/help/plugins-and-skills/what-are-skills` |
| **ChatGPT 网页/移动端（Chat & Work）** | **必须打成 plugin**。独立技能只在 desktop app / Codex CLI / IDE 扩展可用 | `https://developers.openai.com/codex/skills.md` |
| **claude.ai / Cowork / cloud session** | 上传到账号的技能，frontmatter 只许 spec 的 6 个字段 | `https://code.claude.com/docs/en/skills` |

**对"网页版单文件蒸馏"那块迷雾的判断：**

它**应该毕业成 ticket，但形态不是"一个粘贴用的 prompt"**。三家都接受
**一个符合 agentskills.io 规范的技能包**（`SKILL.md` + 可选 `references/`），
只是投递通道不同（面板上传 / plugin 打包 / 账号上传）。
真正的约束不是"单文件"，而是**体积**：

- agentskills.io 规范建议 `SKILL.md` body **< 5000 tokens**、**< 500 行**：
  > **Instructions** (< 5000 tokens recommended): The full `SKILL.md` body is loaded when the skill is activated
  > Keep your main `SKILL.md` under 500 lines.
- 本仓库两个 corpus 合计约 548k token（map.md 已查实）。

所以"蒸馏"的目标应当是：**一个 `SKILL.md` + 少量 `references/` 文件的合规技能包**，
而不是一个巨型单文件。是否还需要一份"纯粘贴 prompt"形态，取决于是否要支持
**不能装技能的**对话模型——这一点本次**没有**确认到任何目标宿主有此需求 [GAP]。

### Q3 有哪些宿主有 junction 静默跳过问题？

**这个失败模式是真的，而且有宿主真的踩过。今天的结论是：全部已修或从未有过，
但其中两家是"最近才修好的"，一家还留着未收的尾巴。**

| 宿主 | 今天的判定 | 依据 |
|---|---|---|
| Claude Code | **跟随** | 官方文档明写支持 symlink + 本机 junction 实测生效 [DOC][OBS] |
| Codex | **跟随** | 官方原文 "follows the symlink target when scanning these locations" [DOC] |
| Kimi Code 2.1.1 | **跟随** | 已装二进制内 `fs.readdir()` + `fs.stat().isDirectory()`，不是 `dirent.isDirectory()` [SRC] |
| Hermes Agent | **跟随** | `agent/skill_utils.py` @ `v2026.9.14`：`os.walk(..., followlinks=True)` [SRC] |
| Gemini CLI | **跟随**（自己就建 junction），但有未修复的**重复告警**缺陷 | issue #16247 维护者结论 + `skillUtils.ts` 的 `'junction'`；#26579 / #28944 未修 [SRC][DOC-issue] |
| Cline | **跟随**（skills）；**不跟随**（rules，至今未修） | `isSymbolicLink() && stat().isDirectory()` in `main`；PR #11118 的描述 [SRC] |
| Windsurf / Devin | **曾经不跟随，2026-05-26 修复** | Devin CLI changelog `v2026.5.26-0` Fixed 条目 [DOC] |
| **Cursor** | **曾经不跟随；称 2.5 修复；Cloud Agent 至今无声明** | forum.cursor.com staff 2026-01-27 / 2026-02-10；残留报告 2026-02-24 [DOC-forum] |

**最精确的一句机制描述，来自真踩过坑的 Cline：**

> `withFileTypes` does **not** follow symlinks, so for a symlink those predicates are `false`.
> As a result, a skill materialized as a **directory symlink** (or a symlinked `SKILL.md`)
> is silently skipped — it never shows up in `/skills`.
> —— `https://github.com/cline/cline/pull/11118`

本机实测与之完全吻合 [OBS]：Node v24.19.0 对这两个 junction，
`dirent.isDirectory() = false`、`statSync().isDirectory() = true`。

补一条**规范层面的重要事实**：**agentskills.io 规范本身对 symlink 完全沉默。**
规范页与非规范性的 host 实现指南（`adding-skills-support`）**一个字**没提符号链接。
所以"宿主会不会跟随"完全是各家实现自由，**不能靠规范推断，必须逐家查源码或实测**。
这也解释了为什么至少四家宿主都独立踩过同一个坑。

但那个失败模式本身是真的：本机 Node v24.19.0 对这两个 junction，
`dirent.isDirectory()` 返回 `false`、`statSync().isDirectory()` 返回 `true` [OBS]。
任何新宿主只要用前者过滤就会静默跳过。**v2 的安装契约应当提供 `--copy` 作为一等公民的
回退路径，并在 install 的输出里说明何时需要它**（`install.mjs` 已有 `--copy`，
只是目前只在链接失败时才自动降级）。

---

## 对 06（一个技能还是两个）最直接的输入

这一节是 ticket 明说"阻塞 06"的部分，单独列出来。

**查实的机制事实：**

1. **没有任何一个目标宿主提供"技能间仲裁"机制。**
   agentskills.io 的官方实现指南（`https://agentskills.io/client-implementation/adding-skills-support.md`，
   抓取 2026-09-26）写得最直白：

   > Most implementations rely on the model's own judgment as the activation mechanism,
   > rather than implementing harness-side trigger matching or keyword detection.

   而"Handling name collisions"一节只处理**同名**，不处理**触发词重合**：

   > When two skills share the same `name`, apply a deterministic precedence rule.
   > The universal convention across existing implementations: **project-level skills override user-level skills.**

2. **所有宿主在启动时给模型的，只有 name + description（Codex 还给 path）。**
   模型在只看到这两段文本的情况下做二选一。

3. **description 会被截断，而且是从尾部截。**
   - Claude Code：`description` + `when_to_use` 合并后 1,536 字符封顶；listing 预算默认
     模型上下文的 1%，溢出时**先丢最少用的技能的 description**。
   - Codex：初始清单预算 = 上下文 2%（未知时 8,000 字符），
     "Codex **shortens skill descriptions first**"，再不够就整条省略并告警。
   - Codex 官方建议：**"Front-load the key use case and trigger words so a host can still
     match the skill if descriptions are shortened."**

4. **确实存在"在技能内部表达归属"的字段，但都只是同一段文本的延伸，且不跨宿主：**

   | 宿主 | 可用字段 | 性质 |
   |---|---|---|
   | Claude Code | `when_to_use`（计入 1,536 上限）、`paths`（按文件 glob）、`disable-model-invocation` | 仍是模型自由裁量 |
   | Kimi Code | `whenToUse`、`disableModelInvocation`；`skill` 工具支持**嵌套调用，最多 3 层** | 嵌套调用是唯一真正的"转交"机制 |
   | Codex | `agents/openai.yaml` 的 `policy.allow_implicit_invocation` | 只能全关，不能分流 |
   | Cursor | `paths` / legacy `globs`、`disable-model-invocation`；**嵌套目录自动限定作用域** | 都是按**文件**分流，不是按**题目**分流 |
   | Windsurf / Devin | 只有 `description`（+ rules 的 `trigger` 模式，另一套系统） | — |
   | Cline | 只有 `description` + 手工开关 + `/skill-name`；frontmatter 是**封闭白名单**，加不了自定义字段 | — |
   | Gemini CLI | 无（且每次激活还要用户确认） | 散文建议 *"Avoid overlap: Ensure your skill descriptions are distinct from one another"* |
   | Hermes | 只有 `description`；同名 slash command 撞车时 first-wins + warn | — |

   **注意 Cline 那一行**：它的 frontmatter 允许字段是写死的白名单
   `name / description / license / compatibility / metadata / allowed-tools`，
   和 agentskills.io 规范完全一致。也就是说，**任何靠新增自定义 frontmatter 字段来
   表达"归属"的方案，在 Cline（以及 claude.ai 上传通道）上会直接报错或被丢弃。**
   唯一跨所有宿主都存在的字段就是 `description` 本身。

5. **本仓库当前的裁决规则放错了位置。**
   - 根 `AGENTS.md:34-43` 的 "Choosing between them" 一节（route by whose specification
     answers the question / 对称比较归 `intel-vt` / ARM & RISC-V 归 `intel-vt`）是**唯一**
     写清楚的完整裁决规则，而 `tools/install.mjs` 从不安装 `AGENTS.md`。
   - 两个 `SKILL.md` 的 `description` 里**确实各有一句**兄弟免责
     （`Do NOT use for AMD-primary questions - the sibling amd-virtualization skill owns those`），
     但它在 description 的**最末尾** [OBS] —— 正是 Claude Code 和 Codex 截断时最先丢掉的位置。
   - 8 个重合触发词（`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2` `Kernel DMA Protection` `hypervisor`）
     在两个 description 里都出现，且在那句免责之前。

**因此，就宿主能力而言的结论：**

> **没有任何目标宿主能可靠地执行"两个技能互相引用"的裁决规则。**
> 所有宿主都只做"模型看 name + description 自由选一个"，而且那段 description
> 还会被从尾部截断。把裁决规则写在 `AGENTS.md` 里对除 Codex 之外的宿主全部无效；
> 写在 description 末尾则随时可能被截掉。

这**不必然**推出"必须合并成一个技能"。保留两个仍有一条路：
把免责句**前置**到 description 开头，并把 8 个重合触发词从两边的 description 里**移除**
（它们正是造成误选的直接原因，而对"该选哪一个"零信息量）。
Kimi 的 3 层嵌套调用还能让一个技能主动转交给兄弟。

但这条路有三个必须认账的代价：

- **它只能写在 `description` 里**——因为那是唯一跨全部 8 家宿主都存在、
  且不会被白名单拒收的字段。而 `description` 恰恰是会被截断的那一段。
- 每家宿主的截断规则和预算都不同（Claude Code 1,536 + 1% 预算；
  Codex 2% / 8,000 字符；Cline 硬上限 1024），要么按最严的写，要么每家配一份。
- Gemini CLI 每次激活还要用户点确认——两个技能就是两次确认。

合并成一个技能则把问题从"**宿主必须仲裁**"降级为"**技能内部路由**"：
路由发生在 `SKILL.md` body 里，而 body 是**完整加载、不截断**的，
所有宿主行为一致，也不受 frontmatter 白名单限制。
代价是单个 `SKILL.md` 更长，与 agentskills.io 的
"< 5000 tokens / < 500 lines" 建议冲突更大——但那是**建议**，不是硬限制
（本次没有发现任何宿主对 body 长度做强制校验）。

**这份研究不替 06 做决定，但把决定的地基钉死了：
"靠宿主仲裁"这个选项不存在，一次都不存在，8 家宿主全都不存在。**

---

## 对仓库现状的直接影响（findings，不是施工方案）

这些是本次查证顺带暴露出来的、与 01 直接相关的事实差异。列在这里是为了不丢失，
具体怎么改由后续 ticket 决定。

1. **README 声称的宿主清单（Claude Code / Codex / Hermes）严重低估了实际覆盖面。**
   本次查实：`.agents/skills/` 被 **Codex、Kimi Code、Gemini CLI、Cursor、Windsurf、
   Cline、Hermes** 七家认作发现根；`.claude/skills/` 被 **Claude Code、Cursor、
   Windsurf（开启 Claude config 读取时）、Cline** 四家认作发现根。
   `tools/install.mjs` 现在这两个目录一起建，等于**免费覆盖了 8 个宿主**，
   而 README 只声称 3 个。这是"少说了"，不是"说错了"，但会让人不知道能用。

2. **`tools/install.mjs` 的 summary 里关于 Hermes 的那句话不准确。**
   它说 "Hermes does NOT scan this repo."，但 Hermes 会扫
   `<project-root>/.agents/skills/`，只是需要把 repo 加进 `skills.trusted_project_dirs`。
   正确的指引是给出这个 config 键，而不是让人 `--user`。

3. **`install.mjs --user` 往 `~/.claude/skills` 装，对 Kimi 无效。**
   Kimi Code 2.1.1 的用户级路径是 `~/.kimi-code/skills/` 和 `~/.agents/skills/`。
   脚本已经装了后者，所以**实际有效**，但脚本的输出文案（"Anything else with
   filesystem access can start from `<name>/index.json`"）没有告诉用户这一点。

4. **`~/.kimi-code/skills/` 下有两个技能的实体拷贝，来源不明且是快照。**
   它们不是 `install.mjs` 造的。源仓库改了这两份不会跟着变。
   这正是 `--copy` 模式的固有代价，也是 tidy 纪律要盯的"陈旧产物"。

5. **裁决规则的载体选错了。** 根 `AGENTS.md` 只有 Codex 会在启动时读
   （且是作为仓库指令，不是技能元数据）；Claude Code / Kimi / Gemini CLI / Cursor /
   Hermes 都不把它当技能路由表。两个 `description` 末尾那句兄弟免责，
   在 Claude Code 和 Codex 的截断策略下是**最先被丢掉的位置**。

6. **两个 description 里各自带着 8 个重合触发词。**
   这些词（`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2` `Kernel DMA Protection` `hypervisor`）
   对"该选哪一个"零信息量，却占据了会被截断的宝贵字符预算，并直接制造误选。

---

## Gaps —— 没能查证的部分

严格按仓库纪律列出。以下**都不要**当成已知事实使用。

1. **Cursor 的 description 长度上限**：Cursor 自己的文档从未给出数字，只说
   "Agent Skills is an open standard. Learn more at agentskills.io."。
   1024 是**规范**的上限，**不能记到 Cursor 头上**。
2. **Cursor ≥ 2.5 之后 symlink 是否真的全修好**：v2.5.22 的残留报告
   （2026-02-24）被 staff 以 "Please raise new threads." 打发，**没有状态结论**。
3. **Cursor Cloud Agent 的 symlink 支持**：请求帖最新一条是 2026-09-08，**无官方答复**。
4. **Windsurf 的 legacy Cascade agent（区别于默认的 Devin Local）是否跟随 symlink**：
   无任何文档或 changelog 说明。已知的修复条目都在 Devin CLI changelog 里。
5. **Windsurf 技能 `description` 的长度上限**：文档未给。
   （12,000 / 6,000 是 **rules** 的上限，不要混用。）
6. **Kimi Code 2.x 的 description 长度上限**：kimi-code 文档未给数字。
   legacy kimi-cli 文档给的是 1-1024 字符，**但那是另一个产品的文档**，
   不能直接套到 2.1.1 上。（本仓库 844/925 字符距离任何合理上限都有余量，
   实践上不构成风险。）
7. **Gemini CLI 的 description 长度上限**：官方文档未给；1024 只存在于内置
   `skill-creator` 的 `validate_skill.cjs` 里，而 `skillLoader.ts` 不做任何长度校验。
8. **Kimi 网页/APP 能否导入一个现成的 `SKILL.md` 目录/压缩包**：
   帮助页只说了"面板一键添加"、"社区下载"、"上传文档生成技能"，
   **没说**能否直接上传一个符合规范的技能包。这直接影响"网页版蒸馏"该产出什么格式。
   → 这是**唯一一条会改变 06 之外决策的未决缺口**，建议单独开 ticket 实测。
9. **各宿主的端到端实测**：本次除 Claude Code（本会话自身即活样本）外，
   没有真正启动任何宿主去验证"它确实读到了这两个技能"。
   Kimi Code 2.1.1 的结论来自**已装二进制的代码常量**，属于强证据但不是端到端观测。
   （未实测的原因：启动 agent 会创建 session 文件并消耗额度，超出本 ticket 的
   "只写一个输出文件"约束。）
10. **本机版本**：只确认了 Kimi Code = 2.1.1。Cursor / Windsurf / Gemini CLI / Cline
    是否装在本机、装的哪个版本，**未查**。对 Cursor 而言版本是决定性的
    （< 2.5 会静默跳过 junction）。
11. **规范层面的空白**：agentskills.io 规范**完全不管**目录枚举与 symlink，
    也不管触发词重合的裁决。唯一的相关文字在**非规范性**的实现指南里，
    且是建议口吻（"consider"、"either … is acceptable"），不是 RFC-2119 的 MUST/SHOULD。
    → 任何"按规范应该如何"的推断都是无效的，必须逐家查。
12. **时效性**：以上全部文档均抓取于 **2026-09-26**。
    宿主的技能子系统在过去数月内变动极快——本次就撞上了三个活例：
    Kimi 从 Python `kimi-cli` 换成 TypeScript `kimi-code` 并**改掉了发现路径**；
    Windsurf 整个品牌改名成 Devin Desktop；Cursor 的 symlink 支持是 2026-02 才有的。
    **任何超过一个季度的引用都应重新核对。**

---

## 引用清单

| # | URL | 抓取日期 |
|---|---|---|
| 1 | `https://agentskills.io/specification.md` | 2026-09-26 |
| 2 | `https://agentskills.io/client-implementation/adding-skills-support.md` | 2026-09-26 |
| 3 | `https://agentskills.io/skill-creation/optimizing-descriptions.md` | 2026-09-26 |
| 4 | `https://agentskills.io/clients.md` | 2026-09-26 |
| 5 | `https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/docs/en/customization/skills.md` | 2026-09-26 |
| 6 | `https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/packages/agent-core-v2/src/features/skill/catalog/skillRoots.ts` | 2026-09-26 |
| 7 | `https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/packages/agent-core-v2/src/features/skill/catalog/fileSkillDiscovery.ts` | 2026-09-26 |
| 8 | `https://raw.githubusercontent.com/MoonshotAI/kimi-cli/main/docs/en/customization/skills.md`（legacy，仅作版本对照） | 2026-09-26 |
| 9 | `https://www.kimi.com/en/help/plugins-and-skills/what-are-skills` | 2026-09-26 |
| 10 | `https://code.claude.com/docs/en/skills` | 2026-09-26 |
| 11 | `https://developers.openai.com/codex/skills.md` | 2026-09-26 |
| 12 | `https://cursor.com/docs/context/skills` | 2026-09-26 |
| 13 | `https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/skills.md` | 2026-09-26 |
| 14 | `https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/core/src/skills/skillLoader.ts` | 2026-09-26 |
| 15 | `https://raw.githubusercontent.com/isaacs/node-glob/main/README.md` | 2026-09-26 |
| 16 | `https://hermes-agent.nousresearch.com/docs/user-guide/features/skills` | 2026-09-26 |
| 17 | `https://hermes-agent.nousresearch.com/llms-full.txt` | 2026-09-26 |
| 18 | `https://raw.githubusercontent.com/NousResearch/hermes-agent/v2026.9.14/hermes_constants.py` | 2026-09-26 |
| 19 | `https://raw.githubusercontent.com/NousResearch/hermes-agent/v2026.9.14/agent/skill_utils.py` | 2026-09-26 |
| 20 | `https://raw.githubusercontent.com/NousResearch/hermes-agent/v2026.9.14/agent/skill_commands.py` | 2026-09-26 |
| 21 | `https://github.com/agentskills/agentskills/commits/main/docs/snippets/clients.jsx`（用于给 Showcase 名单定日期：最后提交 2026-08-09） | 2026-09-26 |
| 22 | `https://raw.githubusercontent.com/anthropics/skills/main/spec/agent-skills-spec.md`（已迁走，只剩指针："The spec is now located at <https://agentskills.io/specification>"） | 2026-09-26 |
| 23 | `https://cursor.com/docs/skills`（`docs.cursor.com` 已 308 → `cursor.com/docs`；页面无日期） | 2026-09-26 |
| 24 | `https://forum.cursor.com/t/bug-report-skills-in-symlinked-directories-not-detected-after-cursor-restart/150029`（staff `deanrie`, 2026-01-27） | 2026-09-26 |
| 25 | `https://forum.cursor.com/t/cursor-doesnt-follow-symlinks-to-discover-skills/149693`（staff `Colin`, 2026-01-23 / 2026-02-10） | 2026-09-26 |
| 26 | `https://forum.cursor.com/t/symlink-support-for-skills-missing-in-cursor-cloud-agent/153603`（无 staff 答复，最新 2026-09-08） | 2026-09-26 |
| 27 | `https://docs.windsurf.com/windsurf/cascade/skills` → `https://docs.devin.ai/desktop/cascade/skills`（raw: `.../skills.md`） | 2026-09-26 |
| 28 | `https://docs.windsurf.com/windsurf/changelog` → `https://docs.devin.ai/desktop/changelog`（v1.13.6 / v1.9552.21 / v1.9577.24 / v3.6.22） | 2026-09-26 |
| 29 | `https://docs.devin.ai/cli/changelog/stable`（`v2026.5.26-0` symlink 修复；`v3000.10.21` 别名去重） | 2026-09-26 |
| 30 | `https://github.com/google-gemini/gemini-cli/issues/16247`（维护者确认 symlink 支持） | 2026-09-26 |
| 31 | `https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/utils/skillUtils.ts`（Windows 用 `'junction'`） | 2026-09-26 |
| 32 | `https://github.com/google-gemini/gemini-cli/issues/26579` 与 `/issues/28944`（realpath 去重缺陷，未修） | 2026-09-26 |
| 33 | `https://github.com/google-gemini/gemini-cli/pull/18151`（`.agents/skills` 别名，v0.28.0 / 2026-02-10） | 2026-09-26 |
| 34 | `https://github.com/google-gemini/gemini-cli/issues/12345`（`AGENTS.md` 进默认列表被 `not_planned` 关闭，2026-05-08） | 2026-09-26 |
| 35 | `https://docs.cline.bot/customization/skills` | 2026-09-26 |
| 36 | `https://github.com/cline/cline/blob/main/apps/vscode/src/core/storage/skill-directories.ts` | 2026-09-26 |
| 37 | `https://github.com/cline/cline/pull/11118`（`withFileTypes` 不跟随 symlink 的权威表述） | 2026-09-26 |
| 38 | `https://github.com/cline/cline/releases/tag/v3.48.0`（Skills 首发，2026-01-09） | 2026-09-26 |
| 39 | `https://github.com/cline/cline/blob/main/sdk/packages/core/src/extensions/agent-plugin/agent-skill.ts`（`MAX_AGENT_SKILL_DESCRIPTION_LENGTH = 1024`） | 2026-09-26 |
| 40 | `https://github.com/cline/cline/issues/3092` / `/issues/4445`（rules 不跟随 symlink，未实现） | 2026-09-26 |

本机观察（可复现）：

| # | 观察 | 复现方式 |
|---|---|---|
| A | `.claude/skills/*` 与 `.agents/skills/*` 是 `LinkType: Junction`，`Attributes: Directory, ReparsePoint` | `Get-ChildItem <dir> -Force \| Select Name,Attributes,LinkType,Target` |
| B | Node v24.19.0 对这些 junction：`dirent.isDirectory()=false`、`statSync().isDirectory()=true` | `readdirSync(dir,{withFileTypes:true})` |
| C | Claude Code 本会话通过 `~/.claude/skills/` 的 junction 读到了两个技能 | 会话技能清单；且 `~/.claude` 下无实体拷贝 |
| D | 本机已装 `kimi.exe` 版本 `2.1.1`，`~/.kimi-code/` 为其 home | `kimi.exe --version` / `--help` |
| E | `kimi.exe` 内嵌 `USER_BRAND_DIRS=["skills"]` / `PROJECT_BRAND_DIRS=[".kimi-code/skills"]` / 两个 generic 均为 `.agents/skills` | 二进制字符串检索 |
| F | `~/.kimi-code/skills/` 下已有两个技能的**实体拷贝**（非链接） | `Get-ChildItem -Force \| Select LinkType` |
| G | 两个 `SKILL.md` 的 `description` 长度：`intel-vt` 844 字符、`amd-virtualization` 925 字符；frontmatter 字段均为 `name, description, license, metadata` | 解析 frontmatter |
| H | `~/.hermes` 与 `%LOCALAPPDATA%\hermes` 均不存在 | `Test-Path` |
