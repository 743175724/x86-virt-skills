# 16 · SKILL.md 重写 + 跨 AI 生成物

Status: ready-for-agent
Type: task
Blocked by: 15（章节与汇总层定稿后才能定路由表）
Spec: `.scratch/amd-virt-refine/spec.md` §D11, §D12

## `amd-virtualization/SKILL.md` 重写

对标 `intel-vt/SKILL.md` 的结构，≤500 行。

### frontmatter

只用标准字段：`name`（必须等于目录名 `amd-virtualization`）、`description`、`license`、`metadata`。

`description` 约束：
- ≤1024 字符；
- **前 60 字符必须是能独立成立的英文触发短语**（Hermes 的短描述约束）。建议形如 `AMD virtualization expert knowledge base for Windows PCs.`；
- 正文列出触发词：AMD-V、SVM、VMRUN、VMCB、#VMEXIT、intercept、NPT、RVI、nested paging、ASID、INVLPGA、AVIC、x2AVIC、vGIF、GIF、AMD-Vi、IOMMU、IVRS、DTE、IRTE、SR-IOV、SME、TSME、C-bit、SEV、SEV-ES、GHCB、#VC、VMGEXIT、SEV-SNP、RMP、VMPL、SVSM、attestation、VCEK、Hyper-V、hvax64、VBS、HVCI、WSL2、WHP、Kernel DMA Protection；
- 结尾写明消歧：Intel 为主的问题交给 `intel-vt`。

`metadata` 记录：`target-platform: Windows PC`、`normative-baseline:`（AMD 文档号 + 修订 + 日期）、`dated-snapshot:`（as-of 日期）。

### 正文必须包含的段落

1. **How to use**：读一章、不要加载目录；每章头部的 `Maps to:` / `Owns:` / `Scope:` 怎么用；**先查 `errata.md`**；显式停止规则。
2. **Routing**：精确到章节（如 `05-exit-decoding.md §5.2`），覆盖全部 20 个章节文件 + `errata.md` / `00-quickref.md` / `core-facts.md` / `bibliography.md`；`12`/`13`/`14` 行标 **(server-only)**。
3. **The Windows fact that resolves most questions**：VBS/WSL2/沙盒/Docker Desktop/Hyper-V 角色启用后，Windows hypervisor 占据 SVM，第三方 VMM 经 WHP 嵌套运行——遇到"为什么我用不了 AMD-V"先看 `16-windows-platform.md`。
4. **Output standards**（替换旧版那条不可执行的规则）：
   - 引规范不引本技能：答案里要出现 AMD 文档号 + 章节或表号；"根据 APM" 不算引用。
   - **删除**"把用到的每个 bibliography 条目原样抄进答案"——单章上百条引用时这条无法执行。
   - 携带 `C:` / `V:` 标记；`V:dated` 一律声明为 as-of 快照。
   - 数字带条件（微架构 / hypervisor / benchmark / 年份），冲突并列不平均。
   - 厂商说法带归属。
   - 不知道就说不知道（各章的 Open items）。
   - **不要编造章节号**：只能用章节给出的锚点；AMD 旧手册（33047、IOMMU 34434）里的编号今天全部作废。
5. **Scope boundaries**：Intel 为主 → `intel-vt`；**SEV 全家是服务器专属**，客户端 Ryzen 上不存在，客户端的内存加密在 `11`；时效事实只在 `90`。
6. **Known limits**：as-of 日期；哪些结构布局因 PDF 表述含混而标记为不完整；Windows 章是 Tier-2。

### 必须删除的旧内容

- "已裁定的关键事实" 9 条孤儿清单（去向见票 15）。
- "基于 14 维度深度研究(交叉验证 + 全局引用整合)构建" 这类研究流程叙述。
- "503 条一手来源" 这句不成立的断言。

## 生成物（由 `tools/build.mjs` 产出，禁止手改）

- `amd-virtualization/index.json`：章节名 / 中文速览 / `Maps to` / 路径 / 标题层级 / bytes / sha256。
- `amd-virtualization/agents/openai.yaml`：display_name、short_description（取 description 首句）、`allow_implicit_invocation: true`。
- 根 `AGENTS.md`：**同时描述两个技能**，各一段"何时读"，外加消歧规则。

## 安装路径说明（写进 spec 的交付说明，不是文件）

`.agents/skills/amd-virtualization`（Codex / Hermes）+ `.claude/skills/amd-virtualization`（Claude Code）。内容零复制。

## 完成判据

- `node tools/lint.mjs amd-virtualization` 零 error（含 frontmatter 字段、description 首句长度、SKILL.md 行数、路由表目标存在性）。
- `node tools/build.mjs --check` 通过；`AGENTS.md` 里两个技能都在。
- 路由表中每一行的文件与小节都真实存在（lint 规则 10）。
- 用 Codex 与 Hermes 各加载一次，确认能被发现并触发（记录到 `eval/amd-virtualization/results/`）。

---

## 复检补充

- **frontmatter 的口径统一**：spec §D11 说的是"**只允许**这 6 个标准字段"（`name`/`description`/`license`/`compatibility`/`metadata`/`allowed-tools`），本票实际使用其中 4 个（`name`/`description`/`license`/`metadata`）。两者不冲突——**允许 6 个、用 4 个**。lint 校验的是"没有出现这 6 个之外的字段"。
- **description 必须有终止标点。** `build.mjs` 与 `lint.mjs` 都用 `split(/(?<=[.?!])\s/)` 取首句；AMD 现有的 description 是没有句号的折叠块，会被整体当成"首句"而报 474 字符——这是 AMD 侧目前**唯一的真 error**。
- **路由表必须落在真实的编号小节上**（`## N.x`），见票 03 的骨架修正；否则 lint 规则 10 必然失败。
- **`Blocked by:` 增加 01 与 18**：消歧措辞由票 18 定稿，本票逐字采用。
- 本票写完 SKILL.md 后，**`tools/install.mjs` 必须已经泛化**（票 01），否则 `.agents/skills/amd-virtualization` 与 `.claude/skills/amd-virtualization` 装不进去。
