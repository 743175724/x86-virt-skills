# amd-virtualization 重构工作契约

所有章节作者（人或 agent）必须遵守本文件。`tools/lint.mjs` + `amd-virtualization/lint.config.json` 按此校验。

与本文件冲突时的优先级：**`recheck-findings.md` 附录 A（逐条核验结果） > 本文件 > `spec.md` > 各章工单**。

---

## 0. 目标平台：Windows PC

本技能面向 **Windows PC**。这条如何影响各章：

- **硬件架构章 `01`–`11` 与操作系统无关**，照常按 AMD 官方文档写。但每章头部的 `Scope:` 行必须标明该章内容在客户端 Ryzen 上的可用性。
- **`12`–`14`（SEV 全家）标记为服务器范围**。措辞必须精确——**"客户端上不存在"是错的**：实测 Ryzen 9 3900X、5800X3D 等非 PRO 消费级部件 `Fn8000_001F EAX[1]=1`（509 ASID）；**Zen 4 客户端起才只剩 SME**；**SEV-SNP 从未在客户端置位**。正确写法：
  > **Server scope.** SEV is productised on EPYC. Zen 4 and later client parts expose SME only, and SEV-SNP has never been available on a client part. Read this chapter for EPYC questions; client memory encryption is `11-memory-encryption.md`.

  **不得写 "`Fn8000_001F EAX[1]` 在 Ryzen 上读 0"** —— 在 Zen+/2/3 上会被当场证伪。
- **`11-memory-encryption.md` 是客户端读者的落点**：SME/TSME（AMD Memory Guard）、C-bit、物理地址位缩减、AMD-SP。
- **`16-windows-platform.md` 只写 AMD delta**，不镜像 `intel-vt/17`（约 75% 是厂商无关的 Windows 事实）。但它对自己必须回答的问题要自足——判据是"把 `intel-vt` 删掉，这一章仍能答完评测集的 12 道 Windows 题"。
- **`18-performance.md` 是 Windows PC 开销**：VBS/HVCI、WSL2、第三方 VMM 跑在 WHP 上 vs 裸 SVM、PC 上的嵌套。删除云规模整合、NFV、EPYC 调优指南。
- **Linux/VFIO 内容降级**为显式标注 `Linux-only` 的对照小节，不作为主线。

Windows 事实一律**直接引用 Microsoft Learn 作为 T2**，不引 ZDNet / Dell KB / 整机厂博客。**一个例外**：`hvix64/hvax64/hvaa64` 的出处是《Windows Internals, Part 2》第 7 版，不在 learn.microsoft.com 上——按 T2 书籍引用。

---

## 1. Claim 记录 schema

每条事实断言写成一行：

```
- **Claim.** <断言正文>  `[APM2 §15.25.6]` `[7]` `C:high` `V:durable`
```

字段顺序固定：一级锚点 → bibliography ID → 置信度 → 时效性。

- **一级锚点**：`01`–`14` 章的架构类断言**必填**。格式见 §2。
- **`[N]`**：bibliography 引用 ID。每条断言至少一个。多个引用写成 `` `[42]` `[43]` ``（各自加反引号）或 `` `[42][43]` ``（同一对反引号内），两种 lint 都接受。**不要发明第三种写法。**
- **`C:`**：`high` | `medium` | `low`。只用英文。
- **`V:`**：`durable` | `dated`。`V:dated` **只允许**出现在 `90-dated-landscape.md`。

叙述性散文不需要 claim 行，但**任何具体的数值、位号、偏移、编码、日期、CVE 编号、产品名都必须在某条 claim 行里**，不能只躺在散文里。

`Excerpt` 只在断言有争议或表述微妙时加，作为 claim 行下方的缩进引用块。

**`00-quickref.md` 内不得出现 claim 行**（lint 硬错误）。它是导航层：只回答"这个表在哪一章"，不存任何权威数值。本技能**不设 `core-facts.md`**——两个导航文件干同一件事，正是旧版速查表漂移成第二事实库的那个缝。

---

## 2. 一级锚点格式（严格）

| 文档 | 锚点写法 | 示例 |
|---|---|---|
| APM Vol.2（24593） | `[APM2 §<sec>]` / `Ch.<n>` / `App.<A–E>` / `Table <X-n>` / `Figure <X-n>` | `[APM2 §15.14.4]`、`[APM2 App.B]` |
| APM Vol.3（24594） | `[APM3 §4 "<MNEMONIC>"]` —— **指令名，不是小节号** | `[APM3 §4 "PVALIDATE"]` |
| APM Vol.1（24592） | `[APM1 §<sec>]` | — |
| IOMMU（48882） | `[IOMMU 3.11 §<sec>]` / `Ch.<n>` / `Table <n>` / `Figure <n>` | `[IOMMU 3.11 §2.2.2]` |
| SEV API（55766） | `[SEV-API 3.24 §<sec>]` | `[SEV-API 3.24 §6.1]` |
| GHCB（56421） | `[GHCB 2.04 §<sec>]` | `[GHCB 2.04 §2.6]` |
| SEV-SNP 固件 ABI（56860） | `[SNP-ABI 1.59 §<sec>]` / `Table <n>` / `App.<A–D>` | `[SNP-ABI 1.59 Table 27]` |
| SVSM（58019） | `[SVSM 1.01 §<sec>]` | `[SVSM 1.01 §5]` |
| SEV-TIO（58271） | `[SEV-TIO 0.92 §<sec>]` | — |
| SEV-SNP 白皮书（70366） | `[SNP-WP 70366 p.<n>]` —— **非规范** | — |
| **内存加密白皮书（70363）** | `[MEM-WP 70363 p.<n>]` —— **非规范**，TSME 唯一的实质出处 | `[MEM-WP 70363 p.5]` |
| **修订指南（勘误）** | `[RevGuide <pub> erratum <n>]` / `§<sec>` / `Ch.<n>` | `[RevGuide 57095 erratum 1458]` |
| PPR | `[PPR <pub>-<rev> §<sec>]` | UNVERIFIED |
| 安全公告 | `[AMD-SB-<nnnn>]` | `[AMD-SB-3020]` |

### 四个已拍板的边界

1. **禁止尾随注解。** `[APM2 §15.25.6 (VMCB)]` 会被 lint 拒绝；注解写在 claim 正文里。
2. **允许 Figure 形式。** AMD 的 VMCB 布局同时以图给出，`[APM2 Figure B-1]` 与 `Table X-N` 同级。
3. **APM 锚点不内嵌修订号，其余文档内嵌。** 因为 APM 的 §15.x 八年未变（见 §5），而 IOMMU/SNP-ABI/GHCB/SEV-API/SVSM 的编号会动。**这条不对称是有意的，不要去"统一"它。**
4. **`[IOMMU … App.x]` 永远是错的** —— 该规范只有 5 章、零附录。IVRS 在 §5.2。
5. **修订指南有锚点形式了**（2026-09-21 补）。原表遗漏了它，导致一个 Tier-1 来源无法被引用——`07` 章作者找到两条真实的 AVIC 勘误（Fam 19h **1458**「Processor May Fail to Accelerate Guest Access to Extended Interrupt LVT Registers」、Fam 1Ah **1579**「Guest vAPIC IRR Backing Page May Be Corrupted」，后者 No fix planned），因为造不出合法锚点而**正确地选择了不引用**。两条已逐字核对 PDF 确认存在。
   **一个无法诚实满足的规则，会被不诚实地满足** —— 这正是 Intel 侧 90 条伪造引用的成因，所以补规则而不是让作者将就。
   仍然成立的边界：**客户端 Ryzen 没有公开修订指南**，不要因为现在有了锚点形式就去编一个。

### 绝对禁止：编造章节号

**这是本次重构最大的风险，但 AMD 侧的风险形态与 Intel 侧相反。** 核验（比对 Rev 3.30 与 Rev 3.45 的书签树）确认：**APM 的 §15.1–§15.35 八年未重编**，附录字母 A–E 稳定，AMD 只追加不重排。所以"编号过时"不是主要威胁。真正的威胁是三种编造：

1. **凭印象写新近子节** —— §15.36 SEV-SNP、§15.37–§15.39 以及各 `.10+` 子节都是近年追加的，最容易被写成"一直存在"。
2. **给 APM Vol.3 的指令安上小节号** —— Ch.4 按字母排序，**只有页码没有小节号**。`[APM3 §4.7.2 VMRUN]` 是纯虚构。
3. **给 IOMMU 规范安上附录**。

另外，**旧资料的编号体系一律作废**：2005 年的 33047（SVM 手册）、2007 年的 IOMMU 34434 Rev 1.20、各类 PDF 镜像与中文译文。

规则：

1. **只写你实际核对过的编号。** 核对方式：读真实 PDF，或引用 §5 已核验清单。
2. **核对不了就降级到章/附录级**：写 `[APM2 App.B]` 而不是猜一个表号。
3. **连这一级都不确定**：写 `[APM2 Ch.?]` 并置 `C:low`，lint 会标出来待人工处理。**不要删掉锚点假装它是二级事实。**

---

## 2.5 编造性否定（fabricated negative）

**「 X 不存在 」与「 X 是 Y 」一样是可证伪的断言，但更难查，也更容易被当成“稳妃的说法”写下去。** 本次重构出过一例，写入契约以免重犯：

`15` 与 `19` 都断言“AMD 没有 enlightened VMCS 的任何对应物”，`15` 甚至把它写成小节标题「There is no AMD enlightened VMCB either」。而 Microsoft 的 TLFS 原文写着：

> "AMD has reserved space in the VMCB for hypervisor use, as well as an associated clean bit. The reserved bytes are in the control section, offset 0x3E0-3FF, of the VMCB. The clean bit is bit 31 … Hyper-V utilizes the reserved VMCB area to configure enlightenments."

结构体名为 `HV_SVM_ENLIGHTENED_VMCB_FIELDS`，TLFS 全文反复以“enlightened VMCS / VMCB fields”成对出现。

**值得注意的是：`15` 自己引的那条 Linux 头文件证据（`3E0h` 处 32 字节的 union 覆盖）恰恰证明该接口存在。** 它拿着正确的证据得出了相反的结论。（公平地说：该 agent 明确声明了它访问不到 learn.microsoft.com、未核 TLFS，并将该条标为 `C:medium`——**声明局限是正确行为**，错在把一个受限的调查写成了断言句式的标题。）

规则：

1. **否定断言需要与肯定断言同等的证据。** 写“不存在”前，必须能指出你查过的那份文档的哪一节。
2. **把范围写死。** 不写“AMD 没有 X”，写“截至 <文档 rev>，<文档> 未定义 X”。前者被一个反例就推翻，后者不会。
3. **跨厂商对比尤其危险。** “Intel 有 X，AMD 没有”读起来对称而完整，但真实情况往往是双方各有不同机制。反向也要查一遍。
4. **访问不到主要来源时，不得写否定断言。** 此时正确的做法是声明缺口（`C:low` + Open items），而不是把“我没查到”写成“它不存在”。

---

## 3. 来源分级

- **Tier 1 规范性**：APM Vol.1/2/3、IOMMU 规范 48882、SEV 文档集（55766 / 56421 / 56860 / 57230 / 58019 / 58369 / 58271）、PPR、AMD 安全公告（AMD-SB-xxxx）、AMD 修订指南。
- **Tier 2 佐证**：kernel.org / LKML / lore / 同行评议论文 / 厂商官方文档（**Microsoft Learn**、VMware 官方 KB、Intel SDM、ARM ARM、RISC-V 规范、PCI-SIG 规范）、AMD 白皮书。
- **Tier 3 背景**：博客、新闻、营销材料。

规则：

- `01`–`14` 章的每条架构断言**必须**至少一条 T1。
- T3 **永不得**作为架构断言的唯一出处，且必须以归属语气陈述（"AMD 称…"/"据 XX 报道"）。
- **33047 与 IOMMU 34434 Rev 1.20 只能用于历史陈述**：claim 正文必须含历史限定词（historical / superseded / 2005 / 2007 / originally …），且 `C:` 不得为 `high`。lint 的 `legacyDocs` 规则按此执行，**并且会穿透 `[N]` 去查 bibliography 条目**——只写 `[412]` 而正文不出现 "33047" 逃不掉。
- **黑名单域名**（见 `lint.config.json` 的 `bannedHosts`，31 个）**不得录入 bibliography**，也不得作为架构断言的解析目标。lint 对架构章的 claim 会**解析每个 `[N]` 到 bibliography 条目再查 host**——这是旧版最严重的问题（503 条里只有 34 条指向 amd.com）唯一能被机器拦住的方式。
- 特别点名的失效来源：`vlsiworlds.com`（盗版 APM Vol.3 镜像）、`icode.best`（APM 中文转录）、`deepwiki.com`（AI 生成）、`termbasehub.com`、`0x04.net`、`unknowncheats.me`、`wiki.osdev.org`、`strix.ai`。

---

## 4. bibliography ID 区段（避免并行写入冲突）

`references/bibliography.md` 是唯一共享写入点。各章只在自己的区段内分配新 ID，**不得改动他人区段**。

| 区段 | 归属 |
|---|---|
| 1–40 | AMD 官方 T1（**已预置，只读**） |
| 41–99 | 其他官方规范 T2（**已预置，只读**） |
| 100–149 | `01`–`02` |
| 150–199 | `03`–`05`（`03`=150–169、`04`=170–184、`05`=185–199） |
| 200–239 | `06` |
| 240–269 | `07` |
| 270–329 | `08`–`10`（`08`=270–289、`09`=290–309、`10`=310–329） |
| 330–349 | `11` |
| 350–429 | `12`–`14`（`12`=350–379、`13`=380–399、`14`=400–429） |
| 430–459 | `15` 嵌套 |
| 460–499 | `16` Windows |
| 500–549 | `17` 安全 |
| 550–579 | `18` 性能 |
| 580–609 | `19` 对比 |
| 610–659 | `90` 时效区 |
| 660–699 | `errata.md` |

> **裁决（2026-09-21）：GA log 的格式归 `08`，语义归 `10`。**
> `recheck-findings.md` 有两条互相冲突的决定：§1 的 B3 行把 GA log 的「格式与语义」都判给 `10`，§2 的三章重切又把「事件/PPR/GA 日志的条目格式」移进 `08`。本文件 §7 把两者各抄了一半，于是 `08` 和 `10` 各写了一遍 8 字节记录布局——lint 的归属规则当场报了出来。
> **§2 胜出**，两个理由：它是更晚、更宽的决定（重切了全部三章），且它自身是自洽的；`08` 本来就拥有另外两种日志的条目格式，把三者之一拆到别处是最容易漂移的那种发丝级切分。
> `10` 保留 GA log 的语义并交叉引用 `08`。lint 的归属规则已按此改：`GA log` 类词归 `08`，`IRTE`/`GAPPI` 归 `10`。

`00-quickref.md` **不分配区段**——它引用 owner 章已有的 ID。

条目格式（一行一条）：

```
[42] <作者或机构>. <标题>. <版本/修订>. <日期>. <URL> — T1|T2|T3
```

---

## 5. 已核验的 AMD 官方文档基线

**核验于 2026-09-20**：逐份从 `docs.amd.com` 下载 PDF 本体，读封面版本行 + **PDF 书签树**。标 VERIFIED 的可直接引用。

### 基础设施事实（影响每一个 URL）

AMD 已把处理器文档迁出 `www.amd.com/content/dam/...`：

- `.../processor-tech-docs/programmer-references/24593.pdf`（全网与旧技能引用的那个）现在返回 **404**。
- `.../epyc-technical-docs/.../55766_*.pdf` **302 跳到只有 JS 的门户壳**，naive 下载器会把一个 2,575 字节的 HTML 存成 `.pdf` 并报告成功。**每次抓取必须验 `Content-Type: application/pdf` 且文件头是 `%PDF`。**
- canonical URL 是 `https://docs.amd.com/go/en-US/<slug>`；`www.amd.com` 还要求浏览器 User-Agent。

### 文档表

| 文档 | Pub | 修订 | 日期 | slug |
|---|---|---|---|---|
| APM **Vol.2** System Programming | **24593** | **3.45** | 2026-07 | `24593_3.45_APM_Vol2_PUB` |
| APM **Vol.3** GP & System Instructions | **24594** | **3.38** | 2026-07 | `24594_3.38_APM_Vol3_PUB` |
| APM Vol.1 | 24592 | 3.25 | 2026-05 | `24592_3.25_APM_Vol1_PUB` |
| APM Vol.4 / Vol.5 | 26568 / 26569 | 3.27 / 3.16 | 2026-07 / **2021-11** | — |
| **IOMMU Specification** | **48882-PUB** | **3.11** | **2026-04** | `48882_3.11_IOMMU_PUB` |
| **SEV-SNP Firmware ABI** | **56860** | **1.59** | **2026-08** | `56860_PUB_SEV_SNP` |
| **SEV-ES GHCB** | **56421** | **2.04** | 2025-01 | `56421` |
| Secure Encrypted Virtualization API | **55766** | **3.24** | 2020-04 | `55766_PUB_3.24_SEV_API` |
| SVSM Guest Communication Interface | **58019** | **1.01** | 2026-03 | `58019.pdf` |
| SEV-TIO Firmware Interface | 58271 | 0.92 | 2026-08 | `58271_PUB_SEV-TIO` |
| SEV-SNP 白皮书（**非规范**） | **70366** | 无 | 2020-01 | — |

**带修订号的 pretty-URL 会在下次发布时失效**（`24593_3.45_...`、`48882_3.11_...`）；`56860_PUB_SEV_SNP`、`56421`、`58019.pdf` 是修订无关的稳定 slug，优先用后者。

### APM Vol.2 Ch.15 已核验的小节号（可直接引用）

| 小节 | 标题 | 归属章 |
|---|---|---|
| §15.4 | Enabling SVM（EFER.SVME） | `01` |
| §15.5 / §15.6 | VMRUN（15.5.1 Basic Operation、15.5.2 VMSAVE and VMLOAD）/ #VMEXIT | `04` |
| §15.7–§15.14 | Intercept Operation · Decode Assists · Instruction · IOIO · MSR · Exception · Interrupt · Miscellaneous（**15.14.4 Pause Intercept Filtering**、15.14.5 Bus Lock Threshold） | `03` |
| §15.15 | VMCB State Caching | `02` |
| §15.16 | TLB Control（15.16.1 TLB Flush、15.16.2 Invalidate Page, Alternate ASID） | `06` |
| §15.17 | Global Interrupt Flag, STGI and CLGI Instructions | `04` / `07` |
| §15.25 | Nested Paging（**15.25.1–15.25.15**，原表写 .9 是漏计——.10 Legacy PAE Mode · .11 A20 Masking · .12 Detecting Nested Paging Support · **.13 Guest Mode Execute Trap Extension** · .14 Supervisor Shadow Stacks · **.15 Page Modification Logging**） | `06` |
| §15.27 | Secure Startup with SKINIT（15.27.1–15.27.8） | `17` |
| §15.29 | Advanced Virtual Interrupt Controller（15.29.1–15.29.10，**15.29.10 x2AVIC**） | `07` |
| §15.30 | SVM Related MSRs | `01` |
| §15.33 | Nested Virtualization | `15` |
| §15.34 | SEV（15.34.9 Page Flush MSR、**15.34.10 SEV_STATUS MSR**、15.34.11 Virtual Transparent Encryption） | `11` / `12` |
| §15.35 | SEV-ES（15.35.5 #VC、15.35.6 VMGEXIT、15.35.7 GHCB、15.35.9 Automatic Exits） | `13` |
| §15.36 | SEV-SNP，23 个子节（.3 Reverse Map Table · .4 Initializing the RMP · .5 Hypervisor RMP Management · .6 页验证 · **.7 VMPL** · .8 vTOM · .10 RMP+VMPL 访问检查 · .18 Secure TSC · .21 Secure AVIC · .22 Segmented RMP · .23 Guest Intercept Control） | `14` |
| §15.37 / §15.38 / §15.39 | Speculation Control / IBS / PMC Virtualization | `17` / `03` |

**附录**：A MSR Cross-Reference · **B VMCB Layout** · **C SVM Intercept Exit Codes** · D SMM Containerization · E OS-Visible Workarounds。

**Vol.2 章级**：19 章（Ch.15 = Secure Virtual Machine；Ch.5 Page Translation and Protection；Ch.7 Memory System；Ch.18 Shadow Stacks；Ch.19 PQOS）。

### APM Vol.3 已核验页码（Rev 3.38，Ch.4 System Instruction Reference）

CLGI 382 · INVLPGA 396 · PSMASH 432 · PVALIDATE 435 · RMPADJUST 447 · RMPQUERY 451 · RMPREAD 454 · RMPUPDATE 457 · SKINIT 472 · STGI 480 · VMLOAD 500 · VMMCALL 502 · VMGEXIT 502 · VMRUN 503 · VMSAVE 508。**App E = CPUID。**

**六条 SNP 指令全部在 Vol.3 Ch.4**，不在 Vol.2、不在附录。

### IOMMU 48882 Rev 3.11 已核验位置

**5 章零附录**：1 Overview · 2 Architecture · 3 Registers · 4 Implementation Considerations · 5 I/O Virtualization ACPI Table。

DTE → **§2.2.2**（Figure 7）· host I/O 页表 → §2.2.3 · guest → §2.2.6 · guest/nested → §2.2.7 · **IRTE → §2.2.5** · **命令 → §2.4**（2.4.1 COMPLETION_WAIT … 2.4.11 Ordering Rules）· **事件日志码 → §2.5**（2.5.2 … 2.5.15 RMP_HARDWARE_ERROR）· **MMIO 寄存器 → §3.4**（能力块 §3.2/§3.3、VF §3.5/§3.6）· **IVRS → §5.2**、IVHD → §5.3。另有 §2.10 vIOMMU · §2.12 SEV-SNP Support · §2.14 SEV-TIO。

### 其余文档结构

- **56860 Rev 1.59**：Ch.2 Data Structures（**2.3 TCB_VERSION**）· Ch.3 Platform Management · Ch.4 Guest Management · Ch.5 Page Management · Ch.6 Mailbox · **Ch.7 Guest Messages（7.3 Attestation）** · **Ch.8 Command Reference** · App A–D。**ATTESTATION_REPORT 是 §7.3 中的 Table 27**，不是小节号。
- **56421 Rev 2.04**：**§2.6 GHCB Layout** · **§2.3.1 GHCB MSR Protocol** · **§3.1 AE / §3.2 NAE** · §4 GHCB Protocol · **§5 SNP Restricted Injection**。无附录。
- **55766 Rev 3.24**：Ch.1 Overview · Ch.2 Key Management · Ch.3 Guest Policy · Ch.4 Mailbox Register Protocol · **Ch.5 Platform Management API** · **Ch.6 Guest Management API** · **Ch.7 Debugging API**（p.109，§7.1 `DBG_DECRYPT`、§7.2 `DBG_ENCRYPT`） · **App.A Usage Flows · App.B AMD CA Certificates · App.C SEV Certificates**。原表写“只到 Ch.6、无附录”是错的，`errata.md` O5 同错；2026-09-21 比对书签树修正。**只覆盖 SEV/SEV-ES；SNP 在 56860。** 封面同时写 "API Version 0.24 / Technical Preview"——**引用出版修订 3.24**。
- **58019 Rev 1.01**：§4 Discovery · **§5 Calling Convention** · §6 Core · §7 Attestation · §8 vTPM · §9 APIC Emulation · §10 UEFI MM。

### 元数据陷阱

1. **56860 同时在线于两个修订**：dam 路径返回 **Rev 1.58（2025-05）**，docs.amd.com 返回 **Rev 1.59（2026-08）**，两者都是 200。
2. **IOMMU 到处都写 Rev 3.10（2025-02）**（AMD 门户、搜索结果、2026-01 的 LKML 补丁），**PDF 封面是 Rev 3.11（2026-04）**。以封面为准。
3. **不要用 `pdftotext -layout` 解析 AMD 的 TOC** —— 双栏排版会把小节号与相邻条目错配，产出"看着很像真的"的假配对。**只信 PDF 书签树**，正文标题次之。

### AMD 没有文档勘误通道

APM 的更正静默并入下一修订，唯一记录是卷内 Revision History 表。最接近的是按家族的 **Revision Guide**（**硅**错误）：58251（Fam 1Ah 00h–0Fh）· 58730 · 57095（19h 10h–1Fh）· 57926 · 55449 · 56323 —— **全部是 EPYC；客户端 Ryzen 没有公开修订指南**。因此 CVE 与勘误一律锚到 **AMD-SB 公告**。

**客户端 Ryzen 也没有公开 PPR**（Vermeer 19h/21h、Raphael 19h/61h 都没有）。第三方流传的 **56713 不在 AMD 公开索引内，不得引用**。SVM 相关 MSR 用 **APM Vol.2 §15.30 + App A**。

### 已回填（2026-09-21，比对 Rev 3.45 书签树）

- **虚拟中断小节 = §15.21 "Interrupt and Local APIC Support"**，子节 15.21.1–15.21.10（p.616–620）：.1 Physical (INTR) Interrupt Masking in EFLAGS · .2 Virtualizing APIC.TPR · .3 TPR Access in 32-Bit Mode · .4 Injecting Virtual (INTR) Interrupts · .5 Interrupt Shadows · .6 Virtual Interrupt Intercept · .7 Interrupt Masking in Local APIC · .8 INIT Support · .9 NMI Support · .10 NMI Virtualization。归 `07`。
- **SME/TSME = §7.10 "Secure Memory Encryption"**，子节 7.10.1–7.10.9（p.302–305），**位于 Ch.7 Memory System，不在 Ch.15**。§15.34.8 只是 "SEV Interaction with SME"。归 `11`，这是该章的主锚点。
- **§15.29 AVIC 子节**：.1 Introduction · .2 Local APIC Register Virtualization · .3 AVIC Backing Page · .4 VMCB Changes for AVIC · .5 AVIC Memory Data Structures · .6 Interrupt Delivery · .7 AVIC CPUID Feature Flags · .8 New Processor Mechanisms · .9 AVIC Exit Codes · .10 x2AVIC（p.648–667）。

### 仍未核验

- PPR 内部小节结构（`.zip` 未解压）。**客户端 Ryzen 的 PPR 与修订指南 AMD 从未公开**，因此这一项大概率永远无法回填——不要因为核不到就去引用第三方流传的 56713。

### 本地 PDF 语料

13 份已验证 PDF + 全文 + 书签树在 `C:/Users/Administrator/AppData/Local/Temp/amd-spec/`。用法与核验纪律见 `AGENT-BRIEF.md`。

---

## 6. 章节文件模板

```markdown
# NN. <English Chapter Title>

> **中文速览**：3–5 句，说明本章覆盖什么、什么时候该读它、与哪几章相邻。

**Maps to:** <AMD 文档 + 章/附录 + 修订> [N]
**Owns:** <本章独占的事实主题，见 §7>
**Scope:** OS-independent hardware | client-relevant | **server scope** | Windows (Tier-2)
**See also:** `<other-file>.md`

---

## N.1 <Section>

<English prose.>

- **Claim.** ...  `[APM2 §15.25]` `[7]` `C:high` `V:durable`

## N.x Open items

<本章仍未覆盖、或官方文档表述含混之处。报告空白优于填充猜测。>
```

**编号小节是硬性要求**：`tools/lint.mjs` 解析路由锚点 `file.md §5.2` 时匹配 `^#{2,4}\s+5\.2[\s.]`。没有 `## N.x` 编号小节，SKILL.md 的路由表建不出来。文件号与文件内的 `## N.` 编号对齐。

正文英文；每章开头一段中文速览；**术语与 AMD 原文逐字对齐**：`#VMEXIT` 不写成 `VM Exit`；`system physical address (sPA)` 不写成 `HPA`；`VIRT_EXT` 是 KVM 的名字，AMD 只说 "VMCB offset 0B8h"；`nested page fault`、`guest-physical address` 不意译。lint 的 `terminology` 规则会对这几个出警告。

---

## 7. 事实归属（owner）

每条事实只有一个 owner 文件，其他文件**交叉引用而不复述**。lint 的豁免子句**只认显式的 `` `NN-file.md` `` 交叉引用 token**——裸 `see` 不算。

| 主题 | owner |
|---|---|
| EFER.SVME / VM_CR / VM_HSAVE_PA / SVM_KEY / CPUID `Fn8000_0001`·`Fn8000_000A` 全位表 / 逐位探测纪律 | `01` |
| VMCB 字段偏移（控制区 + 保存区）/ 段属性 12 位编码 / `INT_STATE` / clean bits 及其与嵌套分页·ASID 的交互 / CET 字段 | `02` |
| 拦截向量位号与优先级 / IOPM / MSRPM / PAUSE filter / Bus Lock / IdleHlt / TSC ratio 与合成 / LBR virt / PMU·IBS 虚拟化 / 调试寄存器虚拟化 / CET 机制 / SMI 拦截 | `03` |
| VMRUN·#VMEXIT 流程 / 一致性检查（含否定清单）/ SVM 指令语义与异常 / GIF·STGI·CLGI 指令侧 / VLS / INIT·SIPI 与 `#SX` / MCOMMIT | `04` |
| EXITCODE 全表 / **EXITINFO1·2 全部位表（含 `#NPF` 的 31/34/35/36/37）** / NRIP / Decode Assist / EVENTINJ / EXITINTINFO | `05` |
| NPT 表项 / 二维遍历 / NPF 语义与流程 / 内存类型合并 / ASID 与耗尽回收 / TLB_CONTROL / INVLPGA / GMET / NPT 关闭时的影子分页 | `06` |
| INT_CTL 位 / 虚拟中断投递 / vGIF 机制侧 / AVIC / x2AVIC / doorbell | `07` |
| IOMMU 寄存器 / DTE 转换侧字段 / 事件·PPR·GA 日志**条目格式** / 分段 Device Table / 请求类型路由 | `08` |
| I/O 页表 / GCR3 / 命令 / IVRS / `IO_PAGE_FAULT` 端到端解码 | `09` |
| IRTE **三种**格式 / **DTE 中断簇** / **GA log 语义**（`GATag` 含义、not-running 条件、如何驱动中断投递；**条目格式归 `08`**）/ GAPPI / ATS·PRI·PASID | `10` |
| SME / TSME / C-bit 与缓存一致性冲刷 / **`Fn8000_001F` 全部字段** / SYSCFG | `11` |
| SEV 密钥层次 / ASID 绑定 / 固件命令 / guest policy / **`SEV_STATUS` 全部位** / **SEV·SNP 威胁模型** | `12` |
| VMSA / `#VC` / GHCB / NAE / VMGEXIT | `13` |
| RMP（含粒度约束）/ VMPL / SNP 指令 / SNP 固件命令 / 证明报告 / SNP CPUID page / vTOM / Secure TSC / Secure AVIC / SVSM / VCEK·VLEK | `14` |
| 嵌套 SVM 机制（含"AMD 无 VMCS shadowing 对应物"与 VLS+vGIF 才是实际加速手段） | `15` |
| Hyper-V on AMD / VBS / HVCI / WSL2 / WHP / DDA vs GPU-P / Kernel DMA Protection | `16` |
| CVE→缓解矩阵（§17.1）/ SKINIT·DRTM（§17.2）/ APM 附录 D SMM Containerization / 勘误驱动的特性屏蔽 | `17` |
| 全部性能数字 | `18` |
| Intel/ARM/RISC-V 对照 | `19` |
| 云实例、GA 日期、市场份额、路线图、内核/固件版本、AVIC 默认状态史 | `90` |

---

## 8. 必须修正的已知错误

见 `references/errata.md`（本票已播种 20 条已裁定条目 + Open conflicts）。**动笔前必查。**

**特别注意：其中 5 条"更正"在核验中被推翻**，`errata.md` 已按正确口径记录。实施前读 `recheck-findings.md` 附录 A：

- VMGEXIT 是 `F2/F3 0F 01 D9`（两个前缀都对，不要删 `F2`）
- IVRS 设备条目 `80h–FFh` 是**变长**（没有 16 字节类）
- CVE-2021-29657 的 CVSS 是 **7.4**
- CVE-2024-25744 **是** Heckler CVE，覆盖 TDX 与 SEV
- 客户端 Ryzen（Zen+/2/3）**确实**报告 `Fn8000_001F EAX[1]=1`

---

## 9. 源材料

旧版 15 章与旧 bibliography（503 条）在 `.scratch/amd-virt-refine/_source/`。**当作线索，不当作事实**：其中的架构引用大多指向盗版镜像、中文转录与博客，必须重新锚定。其中的一手来源（kernel.org、LKML、论文、AMD 官方页面、Microsoft Learn）可以按新格式重新录入并升级为 T1/T2；黑名单域名不得录入。
