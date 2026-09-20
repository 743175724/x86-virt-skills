# 图片处置结论（票 03 执行完毕）

原 14 张 PNG，逐张复核后：**删 9 · 留 5**。删除的图不补画——spec §D14 的原则是"表格才是交付物"，一张不能被按位引用的图不能替代一张带位号的表。

已执行 `git rm`，文件在 git 历史里仍可取回。

## 删除（9）

| PNG | 理由 |
|---|---|
| `sec01_sev_key_slots.png` | **孤儿**——旧 `01-overview.md` 提到它却从未嵌入（正文把读者指向 8.2.1 节）。且它画的代际↔密钥槽映射是未决冲突 `O1`，D14 禁止重画，所以错图无法修 |
| `sec03_vmcb_layout.png` | 图注自承"块高不代表字节数"。**它就是顶替 D8 所要求的 VMCB 偏移表的那张图**——留着它等于保留"有图所以不必给表"的借口 |
| `sec03_exitcode_map.png` | 画的是退出码空间，而它**编码了被 `E06` 推翻的"退出码 = 拦截位序"规则** |
| `sec04_npt_vs_shadow.png` | 唯一带真实分源测量的图，但**每一根柱子都是 Barcelona 代平台（2008–2009）**，且其中一条来源链是 AMD→AnandTech→CSDN（CSDN 在黑名单内）。票 14 要求性能数字带微架构/hypervisor/benchmark/年份四要素，图注承载不了；底层数字改为 `18-performance.md` 里带条件的 claim 行 |
| `sec05_avic_benefit.png` | 单一 T3 来源（Oracle 博客）、归一化单位、单平台单负载。两个数字改为带条件的 claim 行留在 `18` |
| `sec06_io_page_levels.png` | 把**架构常量表**（DTE `Mode` → 级数 → 默认页大小）画成了图。`08`/`09` 必须给带位号的表，而图无法被按位引用 |
| `sec07_hugepage_tlb.png` | 纯算术（4 GiB ÷ 页大小），无测量，来源是营销页 |
| `sec08_asid_keys_evolution.png` | 代际↔密钥槽映射是未决冲突 `O1` |
| `sec11_attack_surface_timeline.png` | 画的是旧 `11-security-research.md` 的表 11-1——**而那张表把 CVE-2024-25744 错挂在 SEV-SNP 名下**。与勘误冲突的图按 D14 删除 |

## 保留（5）

| PNG | 新 owner | 条件 |
|---|---|---|
| `sec05_avic_timeline.png` | `90-dated-landscape.md` §6 | 纯时间线，属时效区 |
| `sec10_abi_timeline.png` | `90-dated-landscape.md` §3 | 固件/ABI 修订时间线；1.60 一发布就过期，而那正是 `90` 的职责 |
| `sec12_kvm_sev_timeline.png` | `90-dated-landscape.md` §4 | 内核/QEMU/libvirt 版本落地时间线 |
| `sec13_sev_gen_overhead.png` | `18-performance.md`（服务器范围节） | **唯一四要素齐全的图**：MASCOTS 2023 · EPYC 7763 Milan · 具名 benchmark · 2023，且区分了最坏界与实测 |
| `sec14_snp_vs_tdx.png` | `18-performance.md` 或 `19` | **有条件保留**：四要素齐全（SIGMETRICS 2025 · Genoa vs Xeon 8570 · MLC/boot/populate · 2025），但它只呈现了一对**已知互相矛盾**的测量中的一侧。**只有在正文同时给出相矛盾的 Phoronix 结果时才能用**（见 `errata.md` `O3`）；做不到就一并删除 |

## 给后续章节作者的一条规则

**不要为了"这一节看起来太密"而加图。** 本次删掉的 9 张里有 6 张是这么来的：一张示意图顶替了一张本该存在的表。图的门槛是——它要么承载图无法被表替代的信息（时间线、拓扑），要么承载四要素齐全的测量。其余情况写表。
