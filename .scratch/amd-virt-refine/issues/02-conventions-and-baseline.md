# 02 · 工作契约与 AMD 官方文档基线

Status: ready-for-agent
Type: task
Blocked by: —
Spec: `.scratch/amd-virt-refine/spec.md` §D2, §D3, §D4, §D13

## 目标

产出 `.scratch/amd-virt-refine/CONVENTIONS.md`——所有章节作者（人或 agent）必须遵守的工作契约，对标 `.scratch/intel-vt-refine/CONVENTIONS.md` 的结构。它是本次重构的唯一事实源，lint 按它校验。

## 必须包含的内容

1. **目标平台声明**：Windows PC；客户端 / 服务器范围的判定规则（spec §D9），逐章说明本条如何影响该章。
2. **Claim 记录 schema**（spec §D3），逐字与 `intel-vt` 一致。
3. **一级锚点格式表**（spec §D2 基线）：每份 AMD 文档一行，给出锚点写法与示例。**必须同时支持 `§x.y` / `Ch.N` / `App.X` / `Table X-N` 四种形式**——AMD 的关键布局（VMCB、退出码、DTE、证明报告）以表编号。
4. **"绝对禁止编造章节号"一节**：三级降级规则（已核验编号 → 章/附录级 → `Ch.?` + `C:low`），并点名旧资料里失效的编号来源（33047 Rev 3.02、IOMMU 34434 Rev 1.20、各类 PDF 镜像与中文译文）。
5. **来源分级与黑名单**（spec §D4），黑名单域名逐条列出。
6. **bibliography ID 区段表**（spec §D13）。
7. **章节文件模板**：`# NN. <English Title>` + `> **中文速览**` + `**Maps to:**` + `**Owns:**` + `**Scope:**`（client / server / OS-independent）+ `**See also:**`。
8. **事实归属表**（spec §D5）。
9. **必须修正的已知错误表**（spec §D7）+ 待裁决清单。
10. **源材料说明**：旧 15 章在 `.scratch/amd-virt-refine/_source/`，当作线索不当作事实。

## 官方文档基线

spec §D2 已写入本次核验得到的文档基线（文档号 / 修订 / 日期 / 章节结构 / 已核验与未核验的区分）。本票把它**原样搬进 CONVENTIONS.md §5**，并补充：

- 每份文档的 canonical URL。
- 明确标注哪些条目是 **VERIFIED**（实际读取过 PDF 封面或书签树）、哪些是 **UNVERIFIED**（需章节作者首次引用时自行核对并回填）。
- 任何 UNVERIFIED 的章节号，章节作者必须按降级规则处理，不得直接使用。

## 同时产出

- `amd-virtualization/references/bibliography.md` 的 **ID 1–40 预置段**：AMD 官方文档逐条录入（标题、文档号、修订、日期、URL、`— T1`）。这一段建立后**只读**，其他票不得修改。
- 把旧 `bibliography.md`（503 条）与 15 个旧章节移入 `.scratch/amd-virt-refine/_source/`（`git mv`，保留历史）。

## 完成判据

- `CONVENTIONS.md` 存在且覆盖上述 10 节。
- `bibliography.md` 的 1–40 段就位，每条带 T1 标记与可访问 URL。
- 旧文件已归档到 `_source/`，`amd-virtualization/references/` 只剩新骨架（见票 03）。
- CONVENTIONS 中不存在任何未标注核验状态的章节号。
