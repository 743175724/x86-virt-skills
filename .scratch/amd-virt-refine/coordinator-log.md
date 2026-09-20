# 协调者日志 — AMD 章节并行写作（2026-09-21）

各 agent 回报的**跨章问题**与**工单错误**汇总。逐章细节在各自回报里；这里只记需要协调者动手或影响其他章的。

---

## 契约层面的改动（已实施）

### C1 · 补上修订指南的锚点形式 ✅

`CONVENTIONS.md` §2 原表**遗漏了 AMD Revision Guide**——它是 Tier-1、已在 bibliography `[25]`–`[30]`，却没有任何合法锚点形状。

`07` 章作者找到两条真实 AVIC 勘误，**因为造不出合法锚点而选择不引用**（正确行为），并主动建议补规则。我逐字核对 PDF，两条都真实存在：

- Fam 19h 10h–1Fh **erratum 1458** — "Processor May Fail to Accelerate Guest Access to Extended Interrupt Local Vector Table Registers"（`Fn8000_000A_EDX[27] ExtLvtAvicAccessChg`=1 时）
- Fam 1Ah 00h–0Fh **erratum 1579** — "Guest vAPIC IRR Backing Page May Be Corrupted"（Secure AVIC 下，**No fix planned**）

新形式：`[RevGuide <pub> erratum <n>]`（另接受 `§<sec>` / `Ch.<n>`）。已写入 `lint.config.json` 与 `CONVENTIONS.md` §2，并通知 `06`、`17` 两章作者。

> **为什么补规则而不是让作者将就**：一个无法诚实满足的规则会被不诚实地满足。Intel 侧 90 条伪造锚点就是这么来的。
> 边界不变：**客户端 Ryzen 没有公开修订指南**，有了形式也不许编。

### C2 · INVLPGA 勘误：两份修订指南里零命中 ✅

协调者代查：`INVLPGA` 在 57095 与 58251 中**均无命中**。故 Genoa/Turin 的 INVLPGA 问题**没有 AMD 勘误号**，只能按 LKML（T2）写，并明说 AMD 未发布勘误号。已通知 `06`。

---

## 待协调者裁决

### D1 · `INT_CTL` 不是 AMD 的标识符

`07` 章作者报告：`INT_CTL` 在 24593 Rev 3.45 中**零命中**。AMD 的说法是"the VMCB virtual interrupt control word at offset 60h"（§15.29.4.1），SEV-ES/SNP 语境下叫 `VIntrCtrl`（§15.36.16）。

这与 `VIRT_EXT`（已列入 terminology 规则的 KVM 名）是同一类问题，但处理不能相同：

- `lint.config.json` 的 `ownership` 规则用 `\bINT_CTL\b` 做主题匹配
- 骨架的 `## 7.1` 小节标题用了 `INT_CTL`，SKILL.md 路由锚点依赖它

作者的折中：**标题保留 `INT_CTL`（路由需要），正文用 AMD 的名字**，并给 KVM 侧引用 `[240]`。

**裁决：接受这个折中，不加 terminology 规则。** 理由：读者搜的就是 `INT_CTL`（KVM/文献通用），把它从标题里拿掉会让路由失效；而正文已经用 AMD 原名，不会传播错误术语。**但要在 `00-quickref.md` 的术语对照里显式写出"INT_CTL = KVM 名，AMD 称 offset 60h 的 virtual interrupt control word"**，这是 quickref 该干的事。

---

## 各章回报索引

| 章 | 行数 | claims | `[no-spec]` | 工单纠错 |
|---|---|---|---|---|
| `07` | 343 | 124 | 1 | 8（含 `APIC_BAR` 偏移 `038h`→**`098h`**，最严重） |


### C3 · GA log 归属冲突 → 裁决并收敛 ✅

`08` 与 `10` 各写了一遍 8 字节 GA 记录布局。两位作者都**主动上报**了，lint 的归属规则也当场抓到。根因是契约本身自相矛盾：

- `recheck-findings.md` **§1（B3 行）**解决的是 *09 vs 10* 冲突，把 GA log 的「格式与语义」都判给 `10`；
- **§2** 随后按读者任务重切了三章，把「事件/PPR/GA 日志条目格式」移进 `08`，`10` 只剩「GA log 语义」。

`CONVENTIONS.md` §7 把两者各抄了一半。**§2 胜出**（更晚、更宽、自洽；且 `08` 本就拥有另外两种日志的格式）。

最终边界：**`08` 拥有 GA log 作为「数据结构」**（条目格式、指向它的寄存器、满/空算术、溢出、重启流程）；**`10` 拥有它作为「信号」**（为什么写条目、`GATag` 的含义、GAPPI）。

两条锚点都是对的、互补的（`Figure 78/79` 是布局，`Table 76` 是字段定义），所以这是纯重复而非事实冲突。

**我自己的第一版 lint 规则有假阳性**：`\bGALog[A-Za-z]+\b` 抓到了 `GALogIntr` —— 那是 **IRTE 字段**，正当属于 `10`。收窄为寄存器名白名单 `GALog(Head|Tail|En|Run|Len|Base)` + `GA_GUEST_NR` + `GAInformation`。

### C4 · 契约 §5 漏计 §15.25 的子节数 ✅

`06` 章作者报告并经我复核书签树确认：**§15.25 有 15 个子节，不是契约写的 9 个**。漏掉的 `.10`–`.15` 里有两个重要的：**`.13` Guest Mode Execute Trap Extension**（HVCI 在 AMD 上的加速器）与 **`.15` Page Modification Logging**。已修正契约。

---

## 待 errata 修订（consolidation 阶段处理）

`04`/`05` 章作者报告两条 errata 条目本身有问题：

- **E07 的 `#VMEXIT` 恢复清单不完整且锚点错位**。枚举在 **§15.5.1 "Saving Host State"**，不是 §15.6，且有 **14 项**（E07 漏了 RFLAGS 与四个段选择子 CS/SS/ES/DS）。APM3 的 VMRUN 伪码另给三条明确的**不恢复**项：host CR2、host PAT、host LDTR（E07 只有 LDTR）。
- **E06 的措辞有过度更正风险**。App.C 原文确实写着 "intercept exit codes are equal to the bit position of the corresponding flag in the VMCB's intercept vector"——把 `000h–014h` 六个字当成一个连续数组读时这是对的（`code = 32×vector + bit`）。讹传是在**单个 32 位字内**读 bit index。作者按这个口径改写而非直接否定 AMD 原话，是对的。

## 各章回报索引

| 章 | 行数 | claims | `[no-spec]` | 工单纠错 |
|---|---|---|---|---|
| `01` | 312 | 49 | 2 | 11（两章合计） |
| `02` | 455 | 87 | 0 | 见上 |
| `04` | 322 | 93 | 0 | 12（两章合计） |
| `05` | 367 | 82 | 0 | 见上 |
| `06` | 325 | 117 | 3 | 8 |
| `07` | 343 | 124 | 1 | 8 |
| `10` | 353 | 95 | 3 | 7 |
| `13` | 402 | 136 | 2 | 5 |

**最严重的单条纠错**：`07` 的 AVIC `APIC_BAR` 偏移 `038h`→**`098h`**（`038h` 是状态保存区段基址，完全不相干）。

**同一事实被两章独立查出**：AVIC_INCOMPLETE_IPI 的失败码是 **6 个不是 4 个**（`07` 与 `05` 各自从 Table 15-27 读出，一致）——这是交叉验证生效的证据。

---

## 协调者独立抽检（2026-09-21）

不依赖 agent 自述，自己从 PDF 里核 8 条高风险数值：

| 断言 | 结果 |
|---|---|
| `07` AVIC `APIC_BAR` @ `098h` | ✅ |
| `03` PAUSE Threshold `03Ch` / Count `03Eh`（顺序反直觉） | ✅ Table B-1 中两字段相邻且 Threshold 在前 |
| `05` `407h VMEXIT_PML_FULL` | ✅ |
| `06` GMET = `Fn8000_000A EDX[17]` | ✅ |
| `13` GHCB `SW_EXITCODE` @ `0x390` | ✅ Table 3 偏移列第 15 项 |
| `01` `VM_CR` = `C001_0114h` | ✅ |
| `10` IRTE bit 0 = `RemapEn` | ✅ |
| `03` MCOMMIT 存在且有 exit code | ✅ |

**8/8，零错。**

### 两个"疑似违规"经查是正确用法

`VIRT_EXT`（2 处）与 `CR4[63:11]`（1 处）出现在 errata 之外，但**全部处于纠正语境**：

- `02:455` "Linux and KVM name control offset 0B8h `VIRT_EXT` … Neither name appears in the APM"
- `04:184` "AMD's documentation names the field only by that offset rather than as `VIRT_EXT`, which is the Linux/KVM identifier"
- `04:98` "the fixed-mask forms `CR4[63:11]` and `EFER[63:15]` come from the 2005-era SVM manual, are superseded, and appear nowhere in Rev 3.45"

lint 未报错，是 `isCorrection` 启发式在正确工作。**语料必须能引用一个错误说法以便纠正它**——这与评测协议 §"Scoring honestly" 的"反驳不算违规"是同一条原则。若改成纯子串禁止，技能会因为做了它该做的事而失败。

### 关于 pdftotext 的再次确认

`0x390` 一开始没 grep 到，原因是 GHCB Table 3 的**偏移列与内容列被拆成不相邻的文本块**。这正是 `AGENT-BRIEF.md` §2.1 要求"grep 定位后回 PDF 页确认排版"的理由，也与 `03` 章报告的 Table 15-7 Priority 列错配、`13` 章报告的 `-layout` 把 Table 4 搞乱是同一类问题。**三章各自独立踩到同一个坑并各自绕开了。**

---

## 协调者自身的错误（由 agent 查出）

### M1 · 我给 `14` 的简报把 SVSM §9 写成 UEFI MM ❌ → 已核实我错

简报里我写 "SVSM … §9 UEFI MM"。`14` 章作者核 PDF 后指出：**§9 是 APIC Emulation Protocol，§10 才是 UEFI Management Mode Protocol**。我复核书签树，确认作者正确。

`CONVENTIONS.md` §5 原本就是对的——错误是我在压缩成 prompt 时引入的。

**这正是简报 §2.3 要达到的效果**：作者拿工单/简报里的值当"待核候选"，而不是当事实。如果它照抄了我的 prompt，这个错会进正文，并且带着一个真实存在但指错地方的锚点——和 Intel 侧 90 条伪造引用同一形态。

### M2 · `-layout` 警告转发后当场抓到一个真实错误 ✅

我把 `13` 章的 `pdftotext -layout` 警告转发给 `14`。它回报：第一版的 guest message header（Table 104）读成 `ALGO 38h / HDR_VERSION 39h / MSG_VMPCK 44h`，全错；`-raw` 给出正确值 `MSG_SEQNO 20h / ALGO 30h / HDR_VERSION 31h / HDR_SIZE 32h / MSG_TYPE 34h / MSG_VERSION 35h / MSG_SIZE 36h / MSG_VMPCK 3Ch / payload 60h`。随后它用 `-raw` 重核了本章全部 17 张表，其余无误。

**跨 agent 转发一条工具陷阱，直接避免了一整张表的错误。**

## 各章回报索引（续）

| 章 | 行数 | claims | `[no-spec]` | 工单纠错 |
|---|---|---|---|---|
| `03` | 319 | 130 | 1 | 10 |
| `08` | 410 | 118 | 1 | 14（两章合计） |
| `09` | 403 | 119 | 0 | 见上 |
| `14` | 475 | 203 | 1 | 10 |

`14` 章另外**主动声明了 3 项无法核实**（Pub 57230 的 KDS 端点、固件的 CPUID 可接受性策略、RMP 条目的原始位布局——AMD 只发布字段列表），未猜测。

`08` 章发现**规范自身的 Table 42 已过时**：把 `EVENT_COUNTER_ZERO` 印成 `1001b`（与 `INVALID_PPR_REQUEST` 撞码），并把 `1010b–1111b` 标为保留，而 §2.5.11–§2.5.15 明明分配了 `1010b–1110b`。改用逐事件图解码并记入 Open items——**报告规范的自相矛盾，不替它选边**。
