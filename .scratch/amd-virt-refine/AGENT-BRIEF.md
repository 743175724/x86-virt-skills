# 章节作者通用简报（v1，2026-09-21）

**本文件补充 `CONVENTIONS.md`，不取代它。** 优先级：
`recheck-findings.md` 附录 A > **本文件（PDF 语料与核验纪律）** > `CONVENTIONS.md` > `spec.md` > 各章工单。

---

## 0. 为什么有这份简报：一个已被量化的失败模式

Intel 侧（本仓库的姊妹技能 `intel-vt`）跑完了同样的流程，留下一个可测的结论：

| 章节写法 | 数值错误率 |
|---|---|
| 对着下载下来的真 PDF 写 | **1–3%** |
| 凭模型知识写、事后再补锚点 | **7–13%** |

差了 4 倍。而且第二类错误的形态最危险：**位号、偏移、编码看起来完全合理，锚点也是真实存在的小节号**，只有逐条比对 PDF 才能发现。Intel 侧最终在 2541 条 claim 里查出 152 处错误，全部来自第二类。

还有一条更硬的教训：**lint 曾经强迫作者伪造引用**。当时的规则要求架构章每条 claim 都带一级 Intel 锚点，于是作者给 Windows 事实、CVE、产品史安上了"真实但无关"的 SDM 小节号——约 90 条。所以本技能的 lint 有 `offSpec` 豁免和 `[no-spec]` 逃生口。**核不到就降级或声明，不要编。**

**本次 AMD 侧不重复这两个错误：PDF 已经下载好并抽成文本，就在本地。**

---

## 1. 本地规范语料（全部已验证 `%PDF` 文件头 + 封面修订号）

根目录：`C:\Users\Administrator\AppData\Local\Temp\amd-spec\`
Git Bash 路径：`/c/Users/Administrator/AppData/Local/Temp/amd-spec/`

```
pdf/   原始 PDF（Read 工具可直接读，按页）
txt/   pdftotext 全文（grep 用，页间以 ^L 分隔）
toc/   PDF 书签树 + 页码（章节号的唯一权威）
```

| 文件名 | 文档 | 修订 | 页数 |
|---|---|---|---|
| `APM2-24593-3.45` | APM Vol.2 System Programming | 3.45 (2026-07) | 875 |
| `APM3-24594-3.38` | APM Vol.3 GP & System Instructions | 3.38 (2026-07) | 728 |
| `APM1-24592-3.25` | APM Vol.1 Application Programming | 3.25 (2026-05) | 396 |
| `APM2-24593-3.30-historical` | APM Vol.2（**仅用于证明编号稳定性**） | 3.30 | 688 |
| `IOMMU-48882-3.11` | IOMMU Specification | 3.11 (2026-04) | 313 |
| `SNP-ABI-56860-1.59` | SEV-SNP Firmware ABI | 1.59 (2026-08) | 175 |
| `SNP-ABI-56860-1.58-historical` | 同上（对比用） | 1.58 (2025-05) | 154 |
| `GHCB-56421-2.04` | SEV-ES Guest-Hypervisor Comm. Block | 2.04 (2025-01) | 76 |
| `SEV-API-55766-3.24` | SEV API（**只覆盖 SEV/SEV-ES**） | 3.24 (2020-04) | 122 |
| `SVSM-58019-1.01` | SVSM Guest Communication Interface | 1.01 (2026-03) | 47 |
| `SNP-WP-70366` | SEV-SNP 白皮书（**非规范**，无书签） | — | 20 |
| `RevGuide-57095-19h-10h-1Fh` | 修订指南 Fam 19h（EPYC Genoa） | 1.05 (2025-11) | 94 |
| `RevGuide-58251-1Ah-00h-0Fh` | 修订指南 Fam 1Ah（EPYC Turin） | 1.30 (2025-07) | 65 |

**没有的东西**（不要假装有）：客户端 Ryzen 的 PPR 与修订指南（AMD 未公开）、SEV-TIO 58271、APM Vol.4/5。引用 SEV-TIO 时只能到章级并置 `C:low`。

## 2. 三条硬纪律

### 2.1 写下任何数字之前，先 grep

位号、偏移、编码、命令码、CPUID 叶子、MSR 地址、EXITCODE、CVSS —— **一律先在 `txt/` 里找到它**。

```bash
D=/c/Users/Administrator/AppData/Local/Temp/amd-spec
grep -n "TLB_CONTROL" $D/txt/APM2-24593-3.45.txt | head
grep -nE "CmdBufEn|2020h" $D/txt/IOMMU-48882-3.11.txt | head
grep -n -B3 -A18 "15.16.1 TLB Flush" $D/txt/APM2-24593-3.45.txt
```

找到后用 `Read` 工具读那一页的 PDF 确认排版（表格在 `pdftotext` 里经常串列）。
**双栏 TOC 会被 `pdftotext` 错配，永远不要从 txt 里的目录读小节号——读 `toc/`。**

### 2.2 小节号只有两个合法来源

1. `toc/<doc>.toc.txt` 书签树（权威）
2. 正文页里印着的标题

```bash
grep -n "15\.25" $D/toc/APM2-24593-3.45.toc.txt
```

核不到就按 `CONVENTIONS.md` §2 降级：章/附录级 → `[APM2 Ch.?]` + `C:low`。
**`APM3 §4 "VMRUN"` 这种按指令助记符的写法是 Vol.3 唯一合法形式**（Ch.4 按字母排序，只有页码）。

### 2.3 核不到就声明，不要编

- 非 AMD 主题（Windows / CVE / 内核 / 性能测量）**不要安 APM 锚点**。lint 的 `offSpec` 规则会当场拒绝，而且那正是 Intel 侧 90 条伪造引用的成因。改引 Microsoft Learn / kernel.org / AMD-SB / 论文。
- 确实没有任何规范记载的事实，写 `` `[no-spec]` `` 占一级锚点的位置，**它会被计数并打印**，不是隐形豁免。

## 3. 已解决的两个"仍未核验"项（`CONVENTIONS.md` §5 遗留）

- **虚拟中断小节 = APM2 §15.21 "Interrupt and Local APIC Support"**，子节 15.21.1–15.21.10（p.616–620）。其中 15.21.4 Injecting Virtual (INTR) Interrupts、15.21.5 Interrupt Shadows、15.21.6 Virtual Interrupt Intercept、15.21.10 NMI Virtualization。
- **SME/TSME = APM2 §7.10 "Secure Memory Encryption"**，子节 7.10.1–7.10.9（p.302–305），**在 Ch.7 Memory System，不在 Ch.15**。§15.34.8 只讲 "SEV Interaction with SME"。这是 `11-memory-encryption.md` 的主锚点。

## 4. bibliography 写入协议（**不要直接改 `bibliography.md`**）

多个 agent 并发追加同一个文件会互相覆盖。改为：

**把你的条目写进 `.scratch/amd-virt-refine/bib/<你的区段>.md`**，例如 `bib/200-239.md`。
一行一条，格式与 `bibliography.md` 一致：

```
[201] AMD. AMD-V Nested Paging. White Paper Rev 1.0. 2008-07. https://web.archive.org/web/.../NPT-WP.pdf — T2
```

协调者会合并。**只用自己区段内的 ID**（见 `CONVENTIONS.md` §4 与你的工单头部）。
1–58 已预置，直接引用，不要重复录入。

**不要预留"可能会用到"的条目。** Intel 侧合并出 27 条从未被引用的孤儿。只录你真正在 claim 行里引用了的。

## 5. 自检（提交前必跑）

```bash
cd /c/Users/Administrator/Desktop/Kimi_Agent
node tools/lint.mjs amd-virtualization 2>&1 | tail -30
```

bibliography 尚未合并时，"unresolved `[N]`" 类报错可以忽略；**其余全部必须清零**。

## 6. 交付清单

1. 覆写你负责的 `amd-virtualization/references/NN-*.md`。保留骨架已有的 `Maps to:` / `Owns:` / `Scope:` / `See also:` 头部与 `## N.x` 编号小节结构（可增补小节，**不要改小节编号含义**）。
2. `.scratch/amd-virt-refine/bib/<区段>.md`
3. 返回一份简短报告：写了多少条 claim、`[no-spec]` 几条、**与工单候选值不符而被你改掉的地方（逐条列出：工单说 X，PDF 说 Y，出处）**、以及你核不到的东西。

第 3 项里的"被改掉的地方"最重要 —— 工单里的数值是对旧版的审计结果，**尚未逐条对 PDF 核过**，本来就预期会有错。发现工单错了是正常产出，不是意外。

## 7. 篇幅与风格

- 每章 **300–550 行**。正文英文，开头一段中文速览（骨架里已有，可改写）。
- 每条事实一行 claim，schema 见 `CONVENTIONS.md` §1。散文可以不带 claim 行，**但任何具体数值都必须落在某条 claim 行里**。
- 术语逐字对齐 AMD：`#VMEXIT` 不是 "VM Exit"；`system physical address (sPA)` 不是 "HPA"；`nested page fault`；`VIRT_EXT` 是 KVM 的名字。lint 会查这五个。
- 表格很好用，但**表格里的数值同样要有 claim 行覆盖**（表格上方或下方给出该表的 claim 与锚点即可，不必每格一行）。
