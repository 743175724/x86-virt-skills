# 06 一个技能还是两个？——v2 的顶层结构决策

Type: grilling
Status: resolved
Blocked by: 01

## Question

**这是整张图的核心决策，其余结构性 ticket 都挂在它下面。**

现状是两个平行技能。诊断证明这个结构在实践中是坏的：

- 区分二者的裁决规则（"对称比较归 `intel-vt`"）**只存在于根目录自动生成的 `AGENTS.md:34-43`**，
  由 `tools/build.mjs:159-168` 以模板字符串硬编码，且仅在 `loadedAll.length > 1` 时才输出。
  全仓库 grep "Symmetric comparisons" 只有两处命中：`AGENTS.md:40` 和一个 `.scratch/` 文件。
  **两个 `SKILL.md` 里都没有，`index.json` 里没有，`agents/openai.yaml` 里也没有。**
- Claude Code 只加载 `.claude/skills/<name>/SKILL.md`，**永远看不到根 `AGENTS.md`**。
- `tools/install.mjs` 从不安装 `AGENTS.md`（grep 无命中）→ user-scope 安装下这条规则**根本不存在**。
- 两个 `SKILL.md` 互相矛盾：`intel-vt/SKILL.md:126-128` 和
  `amd-virtualization/SKILL.md:142-144` **都声称自己负责双向比较**。
- 8 个触发词完全重合：`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2`
  `Kernel DMA Protection` `hypervisor`。绝大多数 Windows 平台问题只含这些词、不含厂商名，
  于是两个技能等权抢答，而没有任何在技能内部可见的裁决规则。
- AMD 侧硬编码了 11 处指向 Intel 技能的仓库根相对路径
  （`16-windows-platform.md` 9 处、`19-comparison-intel-arm-riscv.md` 2 处），
  Intel 侧**零**反向依赖。agent 按当前文件解析这些路径会得到 404。

**要决定的：**

1. **合并成一个技能，还是保持两个？** 如果保持两个，裁决规则必须同时写进两个
   `SKILL.md`、`index.json` 和 `agents/openai.yaml`，并且要有"兄弟技能未安装"的降级路径
   （`16-windows-platform.md:313` 已经声明了自足性判据，但只对 AMD 侧成立且没写进 `SKILL.md`）。
   如果合并成一个，`description` 的触发面如何组织、厂商路由放在哪一层、
   2531 条既有 claim 的锚点要不要动。
2. **description 怎么写。** 现在是 844 / 925 字符的关键词墙，一半是逗号分隔的 `Triggers -` 列表。
   而**两个 description 都不含任何开发类词汇**——问"怎么写 hypervisor"根本触发不了。
   新增的开发轨道和 CPU 世代轨道必须在触发面上有位置。
3. **`00-quickref.md` 要不要上移进 `SKILL.md`。** 诊断的判断是
   *"这是全仓库最好的资产，而且被低估了"*——症状到章节的映射、表到归属章节的映射、
   中英术语对照、五个 Windows 问题的一行答案、阅读顺序。
   它现在藏在 `references/` 里，而 `SKILL.md` 把路由埋在 38% 处（`intel-vt/SKILL.md:56`）。

## 依赖

**必须先有 01 的结果。** 如果目标宿主普遍无法在技能内部表达跨技能裁决，
那第 1 问的答案就被硬件约束定死了，不是偏好问题。

## 调用

`grilling` + `domain-modeling`。这个决策很可能值得一篇 ADR——
它难以回退（牵动 2531 条 claim 的锚点与全部 lint 规则）、
对后来者不解释就看不懂、且是真实权衡的结果。三条都满足。

## 交付物

决议写进本 ticket 的 `## Answer`；若产出 ADR，放 `docs/adr/`。

---

## Answer

**ADR**：[`docs/adr/0001-one-skill-two-reference-trees.md`](../../../docs/adr/0001-one-skill-two-reference-trees.md)
（本仓库第一篇 ADR，三条标准全中：难回退、不解释看不懂、真实权衡）。

### 第 1 问：合并入口，保留两棵 references 树

```
x86-virt/
  SKILL.md              <- 厂商路由 + 裁决规则在这里（body 完整加载、不截断、不受白名单管）
  references/
    intel/  00-quickref.md … 18-comparison.md  +  bibliography.md (318 条)
    amd/    00-quickref.md … 19-comparison.md  +  bibliography.md (198 条)
```

**不动**：2531 条规范锚点（它们引的是 `[SDM 3C §30.2.1]` 这类厂商文档，**不是文件路径**，
合并根本碰不到）、**6616 处 `[N]` 书目引用**（各自作用域在本树内，零重编号）。

**要动**：路径前缀、两份 `lint.config.json` 合并。

**白捡的修复**：AMD 章节里硬编码的 **11 处指向 intel-vt 的仓库根相对路径**
（`16-windows-platform.md` 9 处、`19-comparison-intel-arm-riscv.md` 2 处，
现在从所在文件解析出来是 404）变成技能内部路径，**自动生效**。

**被否决的两个选项及原因**见 ADR 的 Considered options。要点：
完全合并需重编 ~2793 处 `[N]`，而盲测已证明现有厂商分立结构的事实召回率达 95.5% / 97.8%，
**交织章节买不到任何可测的召回提升**；保持两个则"删掉 8 个重合触发词"会导致
**只含那些词的问题两边都不触发**。

### 第 2 问：`description` 草稿（816 字符）

```
x86 hardware virtualization expert knowledge base for Windows PCs, covering Intel
and AMD behind one entry point that routes by vendor internally - ask without naming
one. Intel: VT-x/VMX/VMCS, VM-exit decoding, EPT/VPID, VT-d/IOMMU, APICv, nested VMX,
TDX/SEAM. AMD: AMD-V/SVM, VMCB, intercepts and #VMEXIT, nested paging and ASIDs,
AVIC/x2AVIC, AMD-Vi/IVRS, SME/SEV/SEV-ES/SEV-SNP. Either: Hyper-V, VBS/HVCI, WSL2,
Kernel DMA Protection, and who owns VMX root or SVM on Windows; writing a hypervisor,
including a thin or minimal one, and diagnosing a driver that will not load;
per-CPU-model behaviour across Intel 10th gen to Core Ultra 300 and AMD Zen 1 to
Zen 5, keyed on CPUID family/model plus microcode revision. Every architectural claim
is anchored to a vendor specification by document number and section.
```

**816 字符**——低于最严的 1024 上限（Claude Code 1536 + 1%，Codex 2% / 8000），
且**比旧的任何一个都短**（intel 844 / amd 925），却多覆盖了一家厂商和两条新轨道。

设计要点：

- **删掉了 "Do NOT use for ..." 免责句**——合并后无对象可免责。
- **前置了"内部按厂商路由，问的时候不必点名厂商"**。这正是旧结构失败的地方：
  用户问"Hyper-V 怎么样"时不会说厂商，而截断又恰好砍掉末尾的免责句。
- **新增了开发与型号两条触发面**（`writing a hypervisor, including a thin or minimal one`、
  `diagnosing a driver that will not load`、`per-CPU-model behaviour ... keyed on CPUID
  family/model plus microcode revision`）。旧的两个 description **一个开发类词都没有**，
  所以"怎么写 hypervisor"根本触发不了——这是用户的首要诉求之一。
- **保留了行话密度**（`VMCS` `#VMEXIT` `EPT` `ASID` `IVRS` `SEV-SNP`）。
  01 查明宿主靠模型判断而非关键词匹配，但行话正是模型识别相关性的依据，
  所以走"散文里嵌术语"而不是逗号分隔的关键词墙。

### 第 3 问：`00-quickref.md` 上移导航三节

上移进 `SKILL.md`：**§0.2 症状→章节**、**§0.3 表→归属章节**、**§0.5 五个 Windows 问题的一行答**。
留在 quickref：中英术语对照（§0.4）、实现者阅读顺序（§0.6）。

判据：**路由属于入口，内容属于 references。**
这同时修掉"路由被埋在 `SKILL.md` 38% 处"（`intel-vt/SKILL.md:56`，前面 55 行是前言）。

### 交给 07 的约束

规范建议 `SKILL.md` body **< 5000 token**。合并后它要承载：厂商路由 + 上移的三节导航
+ 约 46 章的路由表。**这是 07 的分层读取契约必须解决的第一个具体问题**，不是理论问题。
