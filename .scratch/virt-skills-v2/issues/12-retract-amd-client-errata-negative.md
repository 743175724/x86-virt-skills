# 12 撤回「AMD 客户端无勘误通道」——一次重复了 6 次的 fabricated negative

Type: task
Status: open
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
