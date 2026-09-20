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
