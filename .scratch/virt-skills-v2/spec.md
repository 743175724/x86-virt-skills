# x86-virt-skills v2 改造 spec

Status: ready-for-agent
Date: 2026-09-26
Map: [`map.md`](map.md) · ADR: [`docs/adr/0001-one-skill-two-reference-trees.md`](../../docs/adr/0001-one-skill-two-reference-trees.md)
Baseline: `490a927`（远程 HEAD）→ 本地已嫁接续接

这份 spec 是 wayfinder 地图的终点。**每条决定背后的证据在对应 ticket 里，这里只写该做什么。**
遇到"为什么是这样"时读 ticket，不要重新推导。

---

## 0. 一句话

把两个平行技能合并成**一个入口 + 三棵参考子树**，
把读取粒度从**整章**降到**小节**，
并新增**开发**与**故障（按 CPU 型号）**两条轨道。

现有 4,729 条带规范锚点的 claim **一条都不重写**。

---

## 1. 目标结构

```
x86-virt/
  SKILL.md                    ← T0：厂商路由 + 分层协议 + 导航三节。目标 < 5k tok
  index.json                  ← T1：每章 title / summary_zh / maps_to / headings / bytes / sha256
  lint.config.json            ← 两份合并
  references/
    intel/  00-quickref … 18-comparison  +  bibliography.md (318 条)
    amd/    00-quickref … 19-comparison  +  bibliography.md (198 条)
    dev/    开发轨道 + 已知陷阱 + 故障轨道
```

**不变**：2,531 条规范锚点（引的是厂商文档不是路径）、**6,616 处 `[N]`**
（作用域在各自子树内，**零重编号**）。
**要变**：路径前缀、两份 `lint.config.json` 合并。
**白捡**：AMD 章节里 **11 处指向 intel-vt 的 404 路径**变成技能内部路径，自动修好。

> 依据 ticket 06 与 ADR-0001。核心理由：**8 家宿主无一做 harness 侧触发词匹配**，
> 两个技能就必须让模型从 `description` 里裁决，而免责句恰好写在会被截断的末尾。
> 合并把裁决移进 **body**——完整加载、不截断、不受 frontmatter 白名单管。

---

## 2. 分层读取契约（写进 `SKILL.md`）

| 层 | 读什么 | 实测成本 |
|---|---|---|
| **T0** | `SKILL.md` | 目标 < 5k tok |
| **T1** | `index.json` 里**该章那一条** | ~300 tok |
| **T2** | **一个小节** | ~1.1k tok |
| **T3** | 整章 | 15–26k tok |

典型回答 = T0 + T1 + T2 ≈ **1.4k tok**（现行"一章 + errata"是 **32k**）。

**小节抽取不需拆文件**：从 `index.json` 取该章 `headings`，
抽取从目标标题起到下一个同级标题止的区间。

**按预算的行为**：8k → 禁 T3，装不下就说装不下，不要读一半然后猜；
32k → 至多一次 T3，绝不读第二章；128k+ → 同上加 `errata.md`。
**任何预算都不要 glob 目录**（全语料 561k tok）。

**`SKILL.md` 里不写任何手写体积数字**，一律指向 `index.json` 的 `bytes`。
**claim 行格式不动**——开销是粒度问题不是格式问题，而格式正是可信度的来源。

> 依据 ticket 07。

---

## 3. `description`（816 字符，低于最严的 1024 上限）

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

比旧的两个都短（844 / 925），却多覆盖一家厂商和**两条新轨道**——
旧 description **一个开发类词都没有**，这就是"怎么写 hypervisor"触发不了的机械原因。

---

## 4. `SKILL.md` 的内容（估算 ~3.9k tok）

| 节 | 来源 | 估算 |
|---|---|---|
| 厂商路由 + 分层读取协议 | 新写 | ~800 |
| 症状 → 章节（两侧合并去重，**中英双语**） | 两个 `00-quickref.md` §0.2 | ~1,000 |
| 46 章路由表（**只到章名**，不描述内容） | 新写 | ~700 |
| 表 → 归属章节 | §0.3 | ~500 |
| 中英术语对照 | §0.4（**上移**，见 ticket 13） | ~400 |
| 五个 Windows 一行答 | §0.5 | ~200 |
| 输出标准 + 范围边界 | 现有 | ~700 |

**关键取舍**：`SKILL.md` 只路由到**章名**，章节描述留在 T1 按需读。
没有这条，46 章的描述会把 body 撑爆。

留在 quickref：实现者阅读顺序（§0.6）。

---

## 5. 开发轨道 `references/dev/`

- **深度**：可编译的**最小骨架**，不是完整成品。
- **形态**：Windows 内核驱动。**第一件事是检测谁拥有 VMX root / SVM。**
- **语言**：C + MASM（MSVC x64 无内联汇编）。
- **原创 Apache-2.0**，不 vendor MIT 代码。先决条件 `LICENSE`/`NOTICE` **已补齐**。
- **主参照**：`tandasat/barevisor`（MIT，2026-08-02）的单 OS-agnostic core + 厂商后端结构。

**必须覆盖的部件**（每个标注 Intel/AMD 分叉点）：
驱动入口与卸载 · 每处理器 VMXON/VMRUN 上下文 · host GDT/IDT/栈 ·
EPT/NPT 恒等映射 · 退出分发循环 · CPUID 与 MSR 拦截仿真 · SMP bring-up ·
teardown · **VM entry 失败怎么调**。

**VBS 必须正面处理**（微软 2026-10 起经质量更新自动启用 Memory Integrity 并打开 VBS）：
裸机拥有 / Hyper-V 之下嵌套 / 改用 WHP API，三条路径各讲代价。
**不要教"把 VBS 关掉"**——受众在萎缩，而且是负安全建议。
**PatchGuard 是最矮的一道**，要写明，因为流传材料普遍把它当主要障碍。

> 依据 ticket 08 与 04。

---

## 6. 故障轨道（原"CPU 型号轨道"）

**按故障组织，不按型号矩阵组织。**

```
故障条目
   ├─ 症状
   ├─ 真实成因      ← 不是"在哪些型号上观察到"。写不出就标"成因未确定"
   ├─ 影响范围      ← family/model[/stepping] + 微码/AGESA 阈值
   ├─ 规避
   └─ 证据
身份表（辅助）市场名 ↔ CPUID DisplayFamily/DisplayModel/Stepping ↔ 代号 ↔ 世代
```

**开张 5 条，证据齐备可直接写**：

| 故障 | 真实成因 | 范围 |
|---|---|---|
| 每核一份 EPT 从 12 代起退化 | **4 个 E-core 共享一个 L2** | Intel 12 代起混合部件 |
| 启用 virtualized VMLOAD/VMSAVE 随机重启 | 声称支持但实现有缺陷 | `fam19h` 18h–1Fh、60h–7Fh；Zen 5 不受影响 |
| AVIC 有无不随型号 | **随微码翻转** | `fam1Ah_model44h` 实测 5 个微码版本 |
| AVIC guest 漏处理 IPI | 硅片勘误 | Family 17h 客户端（含 AM4） |
| ESXi 12 代起 PSOD | **ESXi 的一致性假设，非硅片缺陷** | Intel 12 代起 |

最后一条的成因在**软件**——故障轨道必须能表达这一点，
否则它会把软件 bug 记成硬件特性，那正是它本该防止的事。

**映射层必需**（13/14 代 CPUID 同签名 `B0671h`；10 代 Comet Lake U 与 Kaby Lake 同签名 `06_8EH`），
**且必须标注哪些映射是多对一的**。

**微码是个别条目的属性，不是全局维度。**
判定某条该不该进故障轨道，用 **SDM rev 093 Vol.1 §21.1.4 的 CPUID Domains**。

**dated 隔离规则不开口子**：身份表与缓解阈值 → `90-dated-landscape.md`；
故障条目本身（durable）→ 故障轨道自有章节。

**实测需扩展锚点语法**：`[measured <cpuid-sig> µcode <patch-level> <YYYY-MM-DD>]`，
三者缺一不可（否则不可复现）。

> 依据 ticket 09、02、03、04。

---

## 7. 施工顺序

1. **迁移**（纯机械）：建三棵子树，改路径前缀，合并 `lint.config.json`，
   修好 AMD 侧 11 处跨技能路径。**先立 `sha256` 回归门再动手。**
2. **入口**：写新 `SKILL.md`（`description` + 分层协议 + 导航三节）。
3. **验证**：`lint` / `build --check` clean；路由探针在三个宿主上各跑一遍。
4. **开发轨道**：先写"已知陷阱"章（证据已齐），再写骨架。
5. **故障轨道**：先写开张 5 条，再补身份表。
6. **eval 扩展**：三类新题 + `RUNNER.md` 两条授权。

**1 和 2 完成即可交付一个比现状明显更好的 v2**；4、5 是增量。

---

## 8. 完成条件（15 条，可判真假）

**结构** ① 只有一个技能，`SKILL.md` body **实测** < 5k tok ② 三棵子树就位，
`[N]` 作用域在各自子树内且 lint 拒绝跨树引用 ③ AMD 侧 11 处路径全部解析成功
④ 导航三节已上移

**读取** ⑤ 无手写体积数字 ⑥ 分层协议含小节抽取操作 ⑦ 触发率 **100%**、
路由正确率 **不低于 80/80** ⑧ 抽样 20 题中位额外读取 **< 3k tok**

**内容** ⑨ 开发轨道覆盖全部部件并标注分叉 ⑩ 故障轨道 5 条就位且**各有真实成因**
⑪ 事实召回率 **不低于 95.5% / 97.8%** ⑫ 误述**保持 0**

**机械** ⑬ `lint` 与 `build --check` clean ⑭ `sha256` 回归门就位**并经注入证明**
⑮ 三个宿主各装一次均可见

> 依据 ticket 10。三条评分授权必须写进 `RUNNER.md`：
> **读多了算部分失败**、**正确指出缺口记满分**、开发题**按陷阱清单评分**。

---

## 9. 施工中必须守住的四条

这四条是这套资产最值钱的部分，**重构中丢掉任何一条，v2 就是净损失**：

1. **每条 claim 带源**，格式不变。
2. **负面声明需与正面声明同等证据**，限定到文档与日期——
   现由 **lint 规则 4c** 机械强制（契约版失败过三次）。
3. **dated 事实单文件隔离**，lint 强制。
4. **声明缺口而非填塞**；`[no-spec]` 是可审计的显式出口。
5. **lint 规则必须经注入证明非空转**——静默的规则和坏掉的规则从外面看一模一样。

---

## 10. 已知未决（不猜，留着）

- **265KF 不在本机**。一次 dump 可关闭 ticket 02 的 **9 个缺口**（4 个只需 `RDMSR 492H`）。
- **无 Strix Point**，Zen 5/5c 混合核结论只能停在文档层。
- **Kimi 网页能否直传规范技能包**未确认——决定 ticket 11 走整包上传还是联网取。
- **ChatGPT plugin 的清单格式与体积上限**未查。
- **仓库是 private**，若走联网取 references 需先决定是否公开。
- **SDM rev 092 → 093 的完整差异**未核，仅确认 CPUID Domains 一项相关。
- **评分者与回答者同属一个模型家族**——那是方差测量不是偏差测量，v2 不改变这一点。
