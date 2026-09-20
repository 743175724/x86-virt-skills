# 03 · 章节骨架、范围标注与图片处置

Status: ready-for-agent
Type: task
Blocked by: 02
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D9, §D14

## 范围

### 1. 建立 20 个章节文件的骨架

按 spec §D1 的文件名创建 `amd-virtualization/references/` 下的全部文件，每个只含头部区块（正文留空，由各章票填写）：

```markdown
# NN. <English Chapter Title>

> **中文速览**：<3–5 句：本章覆盖什么、什么时候读它、与哪几章相邻>

**Maps to:** <AMD 官方文档 + 章/附录 + 修订> [N]
**Owns:** <本章独占的事实主题，抄自 CONVENTIONS 的归属表>
**Scope:** OS-independent hardware | client-only | **server scope** | Windows (Tier-2)
**See also:** `<other-file>.md`

---
```

`12`/`13`/`14` 三章的 `Scope:` 行后必须紧跟一段醒目声明：**服务器/机密计算专题；客户端 Windows PC 上不存在（`Fn8000_001F EAX[1]` 在 Ryzen 上读 0）；仅在问题涉及 EPYC 时阅读。**

`90-dated-landscape.md` 头部写入 as-of 日期、"使用前必须以官方来源复核"声明、按类别的分节骨架。

### 2. 逐章 Scope 判定

对 `01`–`11` 每章，明确写出该章内容在客户端 Ryzen 上的可用性差异（例：AVIC 在客户端的固件启用状态、SR-IOV 在消费级平台不存在、SME/TSME 在 Ryzen PRO 与非 PRO 上的差异）。判定结果写进 `Scope:` 行下方一句话，作为该章作者的边界约束。

### 3. 图片逐张处置（14 张）

对 `references/images/` 的每张 PNG 给出处置结论并执行：

| 处置 | 判据 |
|---|---|
| 保留 | 图含量化信息、与重写后的事实一致、有 owner 章引用它 |
| 迁入 `90` | 时间线 / 路线图 / 代际演进类（`sec10_abi_timeline`、`sec11_attack_surface_timeline`、`sec12_kvm_sev_timeline`、`sec08_asid_keys_evolution` 等） |
| 删除 | 顶替缺失表格的示意图（`sec03_vmcb_layout` 属此类——原图注自承"块高不代表字节数"），或与勘误冲突的图 |

删除的图**不补画**；对应信息由表格承担。处置清单写入 `.scratch/amd-virt-refine/images-disposition.md`，每张一行含理由。

另：旧 `01-overview.md` 引用了一张名为 `sec01_sev_key_slots.png` 的图却从未嵌入（正文把读者指向 8.2.1 节），这类孤儿资产按删除处理或迁给真正的 owner 章。

## 完成判据

- 20 个章节文件 + `errata.md` + `core-facts.md` 骨架就位，头部五行齐全。
- 每个 `Maps to:` 引用的文档编号在 CONVENTIONS §5 的已核验清单内，或按降级规则写成章/附录级。
- `images-disposition.md` 覆盖全部 14 张，无"待定"。
- `node tools/build.mjs` 能为 `amd-virtualization` 生成 `index.json`（此时章节正文为空，允许）。

---

## 复检补充

### 1. 骨架必须带**编号小节**，否则章节级路由根本无法建立

初稿的模板只有标题 + 中文速览 + `Maps to/Owns/Scope/See also` + 分隔线。但 `tools/lint.mjs` 解析路由锚点 `file.md §5.2` 时，是去匹配 `^#{2,4}\s+5\.2[\s.]` 形式的标题——**没有编号小节，票 16 的路由表建不出来，lint 规则 10 必然失败**。`intel-vt` 的 CONVENTIONS 明确要求 `## N.1 <Section>` 且"文件号与文件内 `## N.` 编号对齐"。

模板补上：每章至少预置 `## N.1`…`## N.x` 的编号小节骨架，N = 文件号。

### 2. 每章末尾预置 `## N.x Open items` 小节

spec §D8 要求每章都有，但初稿的模板没有它，也没有任何 lint 规则检查。先在骨架里预置空节，作者填。

### 3. 不再创建 `core-facts.md`

复检裁决取消该文件（理由见 `recheck-findings.md` §3）。导航职责全部归 `00-quickref.md`。

### 4. 图片处置：具体清单（初稿只给了政策）

| PNG | 处置 | 理由 |
|---|---|---|
| `sec01_sev_key_slots.png` | **删** | 孤儿（从未被嵌入），且其数值是未决冲突 |
| `sec03_vmcb_layout.png` | **删** | 图注自承"块高不代表字节数"——它就是顶替 D8 要求的偏移表的那张图 |
| `sec03_exitcode_map.png` | **删** | 画的是退出码空间，而它编码了被勘误推翻的"退出码=位序"规则 |
| `sec04_npt_vs_shadow.png` | **待判**（默认删） | 唯一带真实分源测量的图，但全是 Barcelona 代平台，且一条来源链是 AMD→AnandTech→CSDN；若保留必须迁到 `18` 并加"仅 2008–2009 平台"横幅 |
| `sec05_avic_benefit.png` | **删** | 单一 T3 来源（Oracle 博客）、归一化单位、单平台单负载；两个数字改为带条件的 claim 行留在 `18` |
| `sec05_avic_timeline.png` | **移入 `90`** | 纯时间线 |
| `sec06_io_page_levels.png` | **删** | 把架构常量表（DTE `Mode` → 级数 → 默认页大小）画成图；`08`/`09` 必须给带位号的表，图无法被按位引用 |
| `sec07_hugepage_tlb.png` | **删** | 纯算术（4 GiB ÷ 页大小），无测量，来源是营销页 |
| `sec08_asid_keys_evolution.png` | **删** | 代际↔密钥槽映射是未决冲突；D14 禁止重画，所以错图无法修 |
| `sec10_abi_timeline.png` | **移入 `90`** §2 | 固件/ABI 修订时间线 |
| `sec11_attack_surface_timeline.png` | **删** | 画的是把 CVE-2024-25744 错挂到 SEV-SNP 的那张表——与勘误冲突 |
| `sec12_kvm_sev_timeline.png` | **移入 `90`** §3 | 内核/QEMU/libvirt 版本落地时间线 |
| `sec13_sev_gen_overhead.png` | **保留** → `18` 的服务器范围节 | 唯一四要素齐全的图（MASCOTS 2023 · EPYC 7763 Milan · 具名 benchmark · 2023），且区分了最坏界与实测 |
| `sec14_snp_vs_tdx.png` | **有条件保留** → `18`/`19` | 四要素齐全，但它只呈现了一对已知互相矛盾的测量中的一侧——**只有在正文同时给出相矛盾的 Phoronix 结果时才能用** |

净：删 8、移 3、留 2、待判 1。
