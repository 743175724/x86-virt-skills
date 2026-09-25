# 12 撤回「AMD 客户端无勘误通道」——一次重复了 6 次的 fabricated negative

Type: task
Status: resolved
Blocked by: —

## Question

**这不是内容重写，是订正一条已被证伪的声明。** 本图的 Out of scope 排除的是
"推翻已核对过的 claim"，不包括"撤回一条查实为假的负面声明"。

### 被证伪的声明

技能在 **6 处**断言，措辞基本一致：

> *"AMD publishes no errata channel for client parts. Revision guides exist for EPYC
> families only; client Ryzen has no public revision guide and no public PPR."*

出现位置：
- `amd-virtualization/SKILL.md:165-167`
- `amd-virtualization/references/00-quickref.md:37`
- `amd-virtualization/references/01-svm-intro.md:292`
- `amd-virtualization/references/03-intercepts.md:317-318`
- `amd-virtualization/references/06-nested-paging.md:270`
- `amd-virtualization/references/07-virtual-interrupts-avic.md:340-341`

（开工前先用 grep 复核这 6 处的确切行号，它们可能已随其他改动漂移。）

### 三个分句的反证（详见 ticket 03）

1. **"no public PPR"** —— `57930-A0-PUB_3.00.zip`，1017 页，
   Family **1Ah Model 70h**（Strix Halo / Ryzen AI Max 300，**客户端**），
   Rev 3.00，2025-04-30，每页标 `[AMD Public Use]`。
   另有 55772-A1、55803、55922-A1、56569-A1、57019 五份客户端 PPR，
   以及 OSRR 56255。
2. **"revision guides exist for EPYC families only"** —— Revision Guide **55449 Rev 1.21**
   覆盖 Family 17h 00h–0Fh，Table 12 按 Ryzen / 2nd Gen Ryzen / Threadripper 分列，含 AM4。
   **p.87 erratum 1235 是一条虚拟化勘误**，Suggested Workaround 原文
   **"None. Do not enable AVIC."**，Fix Planned **"No fix planned"**。
3. **"no errata channel"** —— **`AMD-SB-4xxx`** 是自 2022 年起的客户端编号公告序列
   （4001 / 4002 / 4004 / 4008 / 4012 / 4013 / 4017）。AMD-SB-4013 脚注原文：
   *"Refer to Errata #1165, #1166 and #1526 on the corresponding Client Revision Guide of the product."*

### 要做的

1. **把 6 处声明替换为真实的、窄得多的缺口**：

   > 当前世代（Fam 19h / 1Ah）的**客户端机型段 Revision Guide** 无法公开取得；
   > 另有 4 份客户端 PPR（56176 / 56214 / 56713 / 57254）找不到第一方副本。

   注意这仍是一条负面声明，**因此必须限定到具体文档与检索日期**（2026-09-26）。

2. **把新发现的第一方来源加进 `bibliography.md`**，并按本仓库的锚点语法
   给 PPR 57930 和 Revision Guide 55449 建立引用形状。
   `README.md:154-159` 记录过先例：当锚点语法没有对应形状时，
   **做法是扩展语法，而不是让作者临场发挥**。

3. **进 `errata.md`。** 这条错误本身符合该文件的收录标准——
   它是技能自己做出的、现已被推翻的声明。按现有 `### E` 编号追加，
   并注明它属于 fabricated negative 这一类。

4. **考虑加一条 lint 规则。** `README.md:104-118` 已经因为同类缺陷立过规矩，
   但规矩没有机械执行。可考虑：**形如 "no public X" / "X does not exist" /
   "only Y has Z" 的声明必须带文档编号与检索日期**，否则 lint 失败。
   按本仓库惯例，**加规则前先注入一次违例证明它会触发**（`README.md:161-163`）。

## 为什么优先级高

- 它是**假的**，而且是技能里被复述最多的一条声明之一。
- 它**直接决定 ticket 09 的可行性**：原声明如果成立，AMD 客户端的型号轨道就没有源头；
  现在证明源头存在且相当丰富，**整条线的可行性大幅提升**。
- 它是**第三次**出现的同类缺陷（前两次记在 `README.md:104-118`）。
  前两次的教训写进了工作契约但没有机械执行——**这说明契约不够，需要 lint**。

## 交付物

一次提交：6 处替换 + bibliography 补录 + errata 追加（+ 可选的 lint 规则与其违例证明）。
改完 `node tools/lint.mjs` 与 `node tools/build.mjs --check` 必须仍然 clean。

---

## Answer

**实际是 8 处，不是 6 处**（开工前复核时多找出两处：`06-nested-paging.md` 有两处、
`lint.config.json` 的 `$comment_revguide` 一处），另加 `README.md` 两处，合计 **10 处**。全部已改。

### 最有力的一条证据来自技能自己

不需要任何新下载就能证伪：**`bibliography.md` 的 T1 段列着 `[31]` Cezanne、`[32]` Phoenix、
`[33]` Strix Halo 三份客户端 PPR，而紧挨其上三行的注释点名 Phoenix 和 Strix 说"没有公开 PPR"。**

这与 `README.md:104-118` 记录的上一次缺陷是**同一形状**——
*"该章节自己的引用里就有佐证，却得出了相反结论"*。

### 改了什么

| 文件 | 改动 |
|---|---|
| `SKILL.md` | 假声明 → 真实的三项窄缺口 + 明确禁止再写成宽声明 |
| `references/00-quickref.md` | 同上，并指明可引用的具体文档 |
| `references/06-nested-paging.md` | 两处。INVLPGA 的结论**保留**（那部分是真的），撤回"因为客户端没有第一方源所以永远无解"的推理，改为"55449 尚未检索该助记符"这一**可执行的开放项** |
| `references/07-virtual-interrupts-avic.md` | 撤回"本章刻意不引用任何勘误，因为锚点语法没有 revision guide 形式"——**该理由已不成立**，语法现在支持 `RevGuide <pub> erratum <n>`。补入 erratum 1235 及其 "None. Do not enable AVIC." 原文 |
| `references/17-security.md` | 假声明 → 4 条新 claim：revision guide 覆盖客户端、客户端 PPR 清单、`AMD-SB-4xxx` 序列、三项窄缺口 |
| `references/90-dated-landscape.md` | 新增两节：AVIC 随微码翻转的实测、带检索日期的缺口清单 |
| `references/errata.md` | **`O2` 关闭**（见下）+ 新增 **`E27`** |
| `references/bibliography.md` | `[29]`/`[30]` 补全版本；`[30]` 下的假注释重写；新增 `[660]`–`[662]` |
| `amd-virtualization/lint.config.json` | `$comment_revguide` 订正 + 新规则配置 |
| `intel-vt/lint.config.json` | 同一条新规则（缺陷类别不分厂商） |
| `tools/lint.mjs` | 新增 **规则 4c · unscopedNegative** |
| `README.md` | 两处：勘误计数 26/6 → **27/7**；"客户端无勘误通道"整段重写 |
| `docs/DEPLOYMENT.md` | 删掉无法验证的 "14 checks" |

### 顺带关闭了一个开放冲突

**`O2`（AVIC erratum #1235 的披露年份）本来是未决的**，原因正是那条假声明：
原文推断"它多半属于某份 Family 17h 指南"——**这个推断是对的**——
然后因为"客户端没有公开修订指南"而放弃。

现在查实：**erratum 1235 在 55449 的 p.87，首次进入修订历史是 rev 1.17，2019-07**。
"AVIC 关了大约八年"这个说法才是准确的那个。
**一个正确的假设因为一条捏造的负面声明被放弃了八个月。**

### 把契约机械化：新 lint 规则 4c

契约失败了三次，所以这次不写进文档，写进工具。

规则：形如「某厂商不发布 X」「不存在公开的 X」的**笼统负面声明**，
必须满足以下之一，否则 lint 失败——**指名出版编号**、**带 as-of 日期**、
**限定到实际检索过的 model range**，或**移进 `90-dated-landscape.md`**（在那里会被定期复核）。

**调参过程本身有信息量**：初版正则在现存语料里命中 3 条，其中 1 条是过宽
（"the paper publishes no cycle count" 已经限定到某篇具体论文了）。
据此把模式收紧为**以厂商为主语**——缺陷类别是"某厂商什么都不发布"，
不是"这篇论文没给某个数"。收紧后另外 2 条是真阳性，已分别补上 as-of 日期与检索范围。

**非空转证明**（`README.md:161-163` 的规矩）：

```
基线      → 两个技能 lint clean
注入违例  → intel-vt/references/15-security.md:421
            "unscoped negative \"Intel publishes no\" ..."   ← 规则触发
移除违例  → 两个技能 lint clean
```

Intel 侧 2650 条 claim **零误报**，说明规则不噪。

### 验收

```
node tools/lint.mjs      → [amd-virtualization] lint clean — 22 章, 201 书目, 2079 claims
                           [intel-vt]           lint clean — 22 章, 318 书目, 2650 claims
node tools/build.mjs --check → generated files are up to date
```

（AMD claim 数 2067 → 2079，书目 198 → 201。）
