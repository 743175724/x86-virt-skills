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

---

## 复检补充

### 1. errata 的 20 条已裁定条目改由本票播种（依赖倒置修正）

初稿把 `errata.md` 放在票 15，而票 15 阻塞于全部 11 张章节票——但**章节票自己的完成判据又依赖 errata 已存在**（票 05、11、13 都要求"lint 的 MISCONCEPTIONS 规则对旧表述报错"）。而 spec §D7 的 20 条已裁定条目**不需要任何章节产出**就能写。

**改为**：本票直接播种 `errata.md` 的 20 条已裁定条目（正文来自 spec §D7，逐条补 T1 锚点），并同步把对应正则写进 `amd-virtualization/lint.config.json` 的 `misconceptions`。票 15 只负责回填 Open conflicts 与章节暴露出的新条目。

**errata 条目 ID 方案**（照搬 `intel-vt/references/errata.md` 的成例）：已裁定 `E01…`，未决 `O1…`；文件头保留 How-to-use / Citations / Time-sensitivity 三段前言。评测集的 `must_not_include` 与 lint 的 `misconceptions` **都从这些条目派生**，所以 ID 稳定很重要。

### 2. bibliography 的 41–99 区段也由本票预置

D13 把 41–99 划给"其他官方规范 T2"（Microsoft Learn、PCI-SIG、Intel SDM、ARM、RISC-V），但没有指定谁来分配。票 12（460–499）与票 14（580–609）都会需要这个区段里的条目——两张票在同一个无主区段里各自分配，正是 D13 要防的冲突。**本票预置 41–99，之后只读。**

### 3. 锚点语法要当场拍板的四个边界（否则作者各写各的）

- **尾随注解**：`[APM2 §15.25.6 (VMCB)]` 这种写法作者一定会写，而 `$` 锚定的语法会拒掉它。**决定**：禁止尾随注解，注解写在 claim 正文里。
- **Figure 形式**：AMD 的 VMCB 布局同时以图给出（`Figure`）。**决定**：允许 `[APM2 Figure B-1]`，与 `Table X-N` 同级。
- **APM 是否内嵌修订号**：IOMMU/SNP-ABI/GHCB/SEV-API/SVSM 的锚点带修订号，APM 不带（因为 §15.x 八年未变，见 D2）。**这条不对称必须写进 CONVENTIONS**，否则作者会自行"统一"。
- **Vol.3 助记符白名单**：`[APM3 §4 "MNEMONIC"]` 的语法拦不住编造的助记符。**把 APM Vol.3 Ch.4 的 SVM/SNP 相关助记符列成白名单写进 lint 配置**（约 20 条），这是让"不许给指令安小节号"这条规则在另一个方向也可判定的唯一办法。助记符可能含 `#` 与空格（如 `VMLOAD/VMSAVE`），正则要放宽到 `"[#A-Z][A-Z0-9 /]*"`。

### 4. 两个从 intel-vt 成例继承但初稿漏写的约定

- **`Excerpt` 的用法**：只在断言有争议或表述微妙时加，作为 claim 行下方的缩进引用块。
- **多引用写法**：`` `[42]` `[43]` ``（各自反引号）与 `` `[42][43]` ``（同一对反引号）两种 lint 都接受——不写进 CONVENTIONS 的话，作者会发明第三种。
