# 01 · 工具链共享化：lint / build / eval 泛化到两个技能

Status: ready-for-agent
Type: task
Blocked by: —
Spec: `.scratch/amd-virt-refine/spec.md` §D15, §T2, §T3

## 为什么先做这个

后续每一章的交付都以 `node tools/lint.mjs amd-virtualization` 通过为验收条件。工具不先泛化，章节作者就只能靠肉眼自查，本次重构最大的风险（编造 AMD 章节号、引用退化回博客）就没有确定性拦截。

## 范围

### 1. `tools/lint.mjs` 改为配置驱动

把下列 Intel 专属常量外提到 `<skill>/lint.config.json`，脚本逻辑一行不分叉：

`SPEC_FRONTMATTER_FIELDS`（保持共享）· `ARCH_CHAPTER` · `DATED_FILE` · `T1_ANCHORS` · `T1_PREFIX` · `T1_UNVERIFIED` · `DEAD_SDM_TITLES`（泛化为 `deadTitles`）· `BANNED_ARCH_HOSTS` · `MISCONCEPTIONS`（正则以字符串 + flags 形式存 JSON）· `OWNERSHIP` · `NAVIGATIONAL`。

新增两条规则（spec §T2 第 6、12 条）：
- `legacyDocs`：指定文档在架构断言中只允许出现在带历史限定词的 claim 行且 `C:` 不得为 `high`（AMD 侧用于 33047 与 IOMMU 34434 Rev 1.20）。
- `terminology`：`{ wrong, right, exceptFiles }` 列表，命中出警告（AMD 侧用于 `RemapEm` → `RemapEn`、`VM Exit` → `#VMEXIT`、架构章里的 `HPA` → `sPA`）。

用法保持 `node tools/lint.mjs [skill-dir]`，默认值改为"遍历所有含 `lint.config.json` 的技能目录"。

### 2. `intel-vt/lint.config.json`

从现有脚本常量原样搬出，**不改变任何一条 Intel 规则的语义**。

### 3. `amd-virtualization/lint.config.json`

按 spec §D2（锚点语法）、§D4（黑名单域名）、§D5（owner 表）、§D7（讹传表）填写。本票只需建立文件与 schema；讹传正则与 owner 条目在对应章节票完成时补充即可，但**黑名单域名与锚点语法必须本票就位**。

### 4. `tools/build.mjs`

- 去掉 `const SKILL = 'intel-vt'`，改为技能列表（从仓库根扫描含 `SKILL.md` 的目录，或显式常量数组）。
- 为每个技能生成 `index.json` 与 `agents/openai.yaml`。
- `AGENTS.md` 改为**同时描述两个技能**：各一段"何时读"，外加一段消歧规则（AMD 为主 → `amd-virtualization`；Intel 为主或双向对比 → `intel-vt`）。头部保留 `DO NOT EDIT` 横幅。
- `--check` 覆盖全部产物。

### 5. `eval/` 结构

- `eval/RUNNER.md` 措辞去 Intel 化（改为"the skill under test"），保留通过线与诚实计分两节；新增一句说明结果目录按技能分。
- 目录改为 `eval/<skill>/questions.yaml` 与 `eval/<skill>/results/`。现有内容若有 Intel 题库则一并迁移；目前 `eval/` 下只有 `RUNNER.md`。

## 完成判据

- `node tools/lint.mjs intel-vt` 的输出与泛化前**逐条一致**（回归判据；泛化前先跑一次存基线到 `.scratch/amd-virt-refine/lintcheck/intel-baseline.txt`）。
- `node tools/build.mjs --check` 通过；`AGENTS.md` 同时出现两个技能名与消歧规则。
- `node tools/lint.mjs amd-virtualization` 能跑起来并报告当前（未重构）状态的错误——**此时报错是预期的**，说明规则生效。
- 三个脚本保持零依赖、无 `package.json`。

---

## 复检补充（必读——本票有一条前提是错的）

**§5 的前提作废。** 本票原文写"目前 `eval/` 下只有 `RUNNER.md`"——**错**。本会话期间另一个会话并发提交了 4 个 commit（`52a4343`/`21ac437`/`e130c44`/`efc64b2`），现在 `eval/` 下有：`questions.yaml`（**Intel 的完整 80 题**）、`README.md`、`RUNNER.md`、`results/`（6 份 2026-09-20 实跑报告）、`answers/`、`verify/`，仓库里还多了 `tools/install.mjs`。

因此 `eval/` 的重组是**迁移不是新建**：`eval/questions.yaml` → `eval/intel-vt/questions.yaml`、`README.md` → `eval/intel-vt/README.md`、`results/*` → `eval/intel-vt/results/`，并决定两个空目录（`answers/`、`verify/`）的去留。

### 常量清单漏了四项

本票 §1 列的外提常量不全，补：

- **`tools/lint.mjs:322` 硬编码 `join(ROOT,'eval','questions.yaml')`** —— **这是整个重构里最危险的一行**。题库迁移时不同步改它，`existsSync` 返回 false，题库校验（重复 id、`chapter` 存在性、`required_citation` 锚点校验、题量 <80 警告）**整段跳过，而 lint 依然打印 `lint clean`**。向"更干净"的方向静默失败。
- **`lint.mjs:283` 的 `id > 25` bibliography 预置阈值** —— AMD 的预置区是 1–40，配置项 `orphanExemptBelow`。
- **`isCorrection`（`lint.mjs:90`）** —— 它是个闭包，且是 `DEAD_SDM_TITLES` 与 `MISCONCEPTIONS` **两条规则共用的豁免开关**，关键词表还是 Intel 味的（`not Skylake`、`with an INTEL-SA`）。拆成共享基线 + 每技能 `correctionHints`。
- **`tools/install.mjs`** —— 硬编码 `const SRC = join(ROOT,'intel-vt')` / `const NAME = 'intel-vt'`，而 D11 要求 `.agents/skills/amd-virtualization` + `.claude/skills/amd-virtualization`。本票一并泛化。

### 必须修的四条规则（spec §T2 已改写，这里是实现要点）

- **规则 6 黑名单域名现在是空转**：只在章节正文做 `line.includes(host)`，而 `bibliography.md` 不在被扫描的文件集内（`lint.mjs:180`）。证据：`intel-vt/references/bibliography.md` 此刻就含 `juejin.cn`、`xem.github.io`、`blog.csdn.net`、`ask.csdn.net`，lint 仍报 clean。**改为**：解析 bibliography 成 `id → {url, host, tier}`，对每条架构 claim 解析它的 `[N]` 并检查 host；另对全部文件（含 bibliography）做字面兜底。**同一套 `[N]` 解析也是 `legacyDocs` 规则的前提**——否则一条只写 `[412]`、正文不出现 "33047" 的 claim 会直接逃逸。
- **规则 8 归属实测输出为零**：73 条 claim 命中非 owner 主题，73 条全被豁免子句吞掉。豁免收窄到只认显式的 `` `NN-file.md` `` token；并新增 **`claimFreeFiles` 硬 error**（AMD 只列 `00-quickref.md`——本次已取消 `core-facts.md`）。**该项必须按技能开关**：对 Intel 开启会让它从 clean 变成 54 个 error（其 `core-facts.md` 有 54 条 claim 行），而重写 Intel 的 core-facts 在 Out of Scope 内。
- **规则 11 漂移校验**：真正的校验在 `build.mjs --check`；lint 只做弱校验且**从不检查 `agents/openai.yaml` 与 `AGENTS.md` 的内容**。CI 必须两个都跑。
- **规则 12 术语**：全新，必须带 `exceptFiles`，否则 `19-comparison-intel-arm-riscv.md` 里正当引用 Intel 术语会误报。

### JSON 化的两个坑

- 所有正则以 `{ "re": "...", "flags": "..." }` 存，**flags 必须显式**——漏掉 `i` 会让 8 条讹传规则近乎失效，且是静默的。
- `lint.mjs:70` 里的 `Scalable I\/O` 是正则字面量语法的转义；写进 JSON 字符串会变成**非法转义**，必须写成 `Scalable I/O`。

### build.mjs 的两处硬编码

`display_name: Intel VT`（`build.mjs:80`）在 SKILL.md 里没有来源，必须进配置（`interface.displayName`）。`shortDesc`（`build.mjs:77`）用 `split(/(?<=[.?!])\s/)` 取首句——AMD 的 description 是没有终止标点的折叠块，会把 474 字符整段塞进 `short_description`。**build 应当在 `shortDesc.length > 60` 时直接失败**，而不是生成一个 lint 随后会拒绝的产物。`AGENTS.md` 是**共享产物**：`--check` 无论是否按技能过滤都要对全量技能集求值，并加一道 `Buffer.byteLength > 8192 → throw` 的硬上限（当前 846 字节，两个技能约 1.6 KiB，离 Codex 的 ~32 KiB 合并上限很远，但要防止有人把路由表或触发词表内联进去）。

### 回归判据改写：diff 干净**不足以**证明没坏

最危险的两种破坏（题库路径失效、正则 flags 丢失）都**向"更安静"的方向失败**，diff 对比看不出来。除了前后 diff，必须加两个阳性对照：

1. 临时把 `eval/intel-vt/questions.yaml` 改名，重跑 lint，**确认它现在会报"题库缺失"**（即：把缺题库从静默改成 warning）。
2. 往一份草稿章节里注入一条已知讹传（例如 `- **Claim.** MBEC shipped with Skylake.  ` + 合法锚点 + `C:high` + `V:durable`），确认 **JSON 来源的正则仍然命中**。

### 依赖关系

本票**阻塞 03–16**：票 03 要求 `build.mjs` 能处理 `amd-virtualization`，票 04–14、16 的完成判据全部是 `node tools/lint.mjs amd-virtualization` 零 error。

### `lint.config.json` 的后续写入者

本票只建 schema 与骨架。**各章票在自己的小节内追加 `misconceptions` 与 `ownership` 条目**，纪律同 bibliography 的 ID 区段：只改自己的块，不动别人的。
