# 地图：x86-virt-skills v2 改造

Label: `wayfinder:map`
Created: 2026-09-26
Baseline commit: `9192e4c`（改造前的工作树快照）

## Destination

**一份可交接的 v2 改造 spec**，它要说清三件事并且三件事必须互相自洽：

1. **结构契约**——一个 AI agent（Claude Code / Codex / Kimi / 其他）在零上下文下拿到这套技能，能不能**无歧义地**找到它需要的那一段，并且在有限 token 预算内读完。
2. **开发轨道**如何纳入：让 agent 不只是查架构事实，而是能**动手写** hypervisor（含轻量级 thin hypervisor）。
3. **CPU 世代/型号轨道**如何纳入：Intel 10 代 → Core Ultra 300、AMD Zen 1 → Zen 5，**以客户端为主**，能回答"我这颗具体的 CPU 上这条还成不成立"。

这张图**到 spec 为止**。写章节、改内容是 spec 交接之后的事。

## Notes

**领域**：x86 硬件虚拟化知识库技能（Intel VT-x/VMX/VT-d、AMD-V/SVM/IOMMU），面向 Windows PC。
仓库 `C:\Users\Administrator\src\x86-virt-skills`，现有两个技能各约 8000 行参考章节，
2650 + 2067 条带规范锚点的 claim，lint / build --check 均通过。

**每个 session 都要看的**：
- 本仓库 tracker 约定：`docs/agents/issue-tracker.md`（wayfinding 操作在其 "Wayfinding operations" 节）
- 诊断报告的结论已固化进各 ticket，不要重新诊断一遍
- 调用 skill：`grilling` + `domain-modeling`（默认）；research 型 ticket 调用 `research`

**本 effort 的固定偏好**：
- **与人沟通用中文**；文件路径、代码标识符、引用原文保持英文原样
- **规划，不施工**。产出决策，不产出成品章节。这条只有 spec 交接后才解除
- **不推翻现有的认知纪律**。诊断报告第 4-8 条列出的"好东西"——单文件隔离 dated facts、
  `Maps to:/Owns:/See also:` 章节头、"负面声明需要与正面声明同等证据"、宁可声明缺口也不填塞——
  是这套资产最值钱的部分，v2 必须继承，不得在重构中丢失
- **真机情况（2026-09-26 实测更正）**：
  - **本会话运行的机器是 AMD Ryzen 9 9950X3D**——`AMD64 Family 26 Model 68 Stepping 0`
    = **`fam1Ah_model44h` stepping 0**，Granite Ridge，Zen 5 桌面，16C/32T。
    **AMD 侧可以随时上真机验证**（但它是全 Zen 5、无 Zen 5c，
    **不能**用来验证 Strix Point 的混合核问题）。
  - **Intel Core Ultra 7 265KF 不在这台机器上。** 它的身份已由文档确定为
    `CPUID.01H:EAX = C0662h` → `06_C6H` stepping 2（SDM Table 2-1 + Spec Update `834774-023`），
    但**本轮未能实测**。**需要向用户确认 265KF 是哪台机器、能否执行命令**——
    在它上面跑一次 dump 可一次关闭 02 的 9 个缺口。
  - 凡是能在真机上实测的结论，优先实测，不要停在文档推断

**已经查实、不要再查的事实**：
- 裁决规则只存在于根 `AGENTS.md:34-43`，由 `tools/build.mjs:159-168` 生成；
  两个 `SKILL.md` 里都没有，`index.json` 和 `agents/openai.yaml` 里也没有
- `tools/install.mjs` 从不安装 `AGENTS.md`（grep 无命中）→ user-scope 安装下裁决规则根本不存在
- 8 个重合触发词：`IOMMU` `IRTE` `Hyper-V` `VBS` `HVCI` `WSL2` `Kernel DMA Protection` `hypervisor`
- 章节真实体积被低估约 5 倍："310–570 lines" 实际是 15k–26k token；
  `13-tdx.md` 单章约 26.1k token；两个 corpus 合计约 548k token
- 开发内容：Intel 仅 3 段被明确免责的 C 代码，AMD **零**代码。
  两个 description 都不含开发类触发词 → 问"怎么写 hypervisor"**根本触发不了**
- CPU 型号覆盖：Intel 客户端仅 `90-dated-landscape.md:101-104` 两条 claim；
  Comet/Rocket/Alder/Raptor/Meteor/Lunar/Arrow Lake 代号命中均为 **0**；
  "Hyper-Threading" 全库仅 1 处，还是 2010 年 i7-920 的测试环境描述。
  AMD 有正确形状的 family/model 表（`90-dated-landscape.md:46-57`）但**只覆盖 EPYC**，
  客户端 Ryzen 仅 1 条 claim；`Zen 5c` / `Ryzen AI` 命中 **0**

**已撤回的推测——不得写成 claim**（由 04 穷尽搜索后推翻）：

- ❌ 「混合核上 P 核与 E 核的 **VMX 能力位**会不同」——**零证据**。
  （12 代的 AVX-512 特性交集处理和 ESXi "Fatal CPU mismatch on feature" 是**另一回事**，那个有据可查。）
- ❌ 「Arrow Lake 取消超线程会搞坏 hypervisor」——**零证据**。
- ✅ **真实的混合核缺陷**：`NoirVisor` issue #35——**4 个 E-core 共享一个 L2**，
  使"每核一份 EPT"这个**所有参考实现的默认写法**从 12 代起退化；修法是全核共享一份。
- ✅ **Zen 4 客户端声称支持 virtualized VMLOAD/VMSAVE，启用会随机重启**：
  Linux commit `a5ca1dc46a6b`（CVE-2024-53114）。四个主流参考实现**没有一个**带这个规避。

## Decisions so far

<!-- 索引：每个已关闭 ticket 一行，够判断相关性即可；细节在 ticket 里 -->

- [01 各宿主到底怎么发现和加载技能？](issues/01-host-skill-discovery.md)：
  **调查的 8 家宿主没有一家做 harness 侧触发词匹配**，全部靠模型自己在 description 之间选——
  "让宿主仲裁"这个选项不存在。裁决免责句其实写了，但在 description 末尾，
  正是 Claude Code（1,536 字符 + 1%）和 Codex（2% / 8,000 字符，明文优先缩短技能描述）
  截断时最先丢的位置；且跨宿主唯一可用字段就是 `description` 本身，
  frontmatter 在 Cline 和 claude.ai 上是封闭白名单。
  **合并成一个技能可把裁决降级为 `SKILL.md` body 内的路由，而 body 完整加载、不截断、不受白名单管。**
  另：**Kimi Code CLI 2.1.1 本机已装，读 `.agents/skills/`，现状即可用，代码零改动**，
  只需改 README 与 install 文案；Cursor 是唯一确认踩过 symlink 坑的宿主。

- [04 开源 thin hypervisor 参考实现现状调研](issues/04-thin-hypervisor-landscape.md)：
  主参照应为 **`tandasat/barevisor`**（MIT，2026-08-02，Intel+AMD × Windows驱动+UEFI，
  单一 OS-agnostic core）。**经典四件套废了三件**：`HyperPlatform` 2026-05-18 归档、
  `hvpp` 停在 2021、`Bareflank` 许可证存疑（GitHub 判 `NOASSERTION`，澄清前不得 vendor）；
  `HyperDbg` 是 GPL-3.0，一行不能用。
  **许可证不砍任何深度档位——可编译骨架可以发**，但推荐写原创 Apache-2.0 而非抄 MIT，
  理由是这是会被 AI 复述的语料，抄来的代码会让每个复述它的 agent 替用户背上不会履行的署名义务。
  **现代 Windows 上最大的障碍是 Hyper-V/VBS 已占着 VMX root，不是 PatchGuard**；
  且微软 **2026-10 起经质量更新自动启用 Memory Integrity 并顺带打开 VBS**。
  给 09 的硬约束：按型号查的键**至少五维**，只按型号会归错格子并固化错误相关性。

- [02 Intel 10 代 → Core Ultra 300 世代差异与勘误源](issues/02-intel-gen-matrix.md)：
  24 份 Intel 原始文档实读（SDM `325462-093US`、Vol.4 `335592-093US`、
  VT-d `D51397-019 Rev 5.20`、全部 10 份客户端 Spec Update）。
  **判定程序找到了：SDM rev 093 新增的 "CPUID Domains"（Vol.1 §21.1.4）**——
  ISA 特性位（含 VMX、AVX-512）属 **Platform domain，必须全机一致**；
  缓存 `04H`、拓扑 `1FH`、native model `1AH` 属 **Logical Processor domain，允许不同**，
  SDM 点名 hybrid 就是原因。**据此 ESXi 一案定谳：硅片合规，缺陷在 ESXi 的一致性假设**，
  修法是 `cpuUniformityHardCheckPanic=FALSE`（Broadcom KB 395554）而非改 BIOS/微码。
  **SDM 六张 P/E 独有表中没有任何 `IA32_VMX_*`**，与 04 的撤回互相印证；
  真正按核不同的是 perfmon / prefetch / L2 QoS（`D18H`–`D1FH` 在 E 核可用、**P 核 #GP**）。
  **微码与 VMX 只写了一半**：Vol.3C §28.3 规定 non-root 写 MSR `79H` 是静默无操作，
  **而对 root operation 规范只字未提**——真实空白；且 `IA32_MCU_STATUS`(`7CH`) bit 0 显示
  **读 `IA32_BIOS_SIGN_ID` 已不足以证明补丁生效**。
  **两个键陷阱**：13/14 代 CPUID 无法区分（同为 `B0671h`）；
  10 代 Comet Lake U 4+2 与 Kaby Lake 同签名（`06_8EH`）——市场名 ↔ CPUID 既非单射也非单调。
  **更正本图早期两处表述**：SMT 断裂在 **12 代**（Arrow Lake 只是恢复 1:1），
  VT-d 能力断裂在 **Meteor Lake**（与 LGA1851 插槽无关）。
  缺口 22 未决 / 3 已关闭，其中 **9 个可由 265KF 一次 dump 关闭**。

- [03 AMD Zen 1 → Zen 5 客户端差异与勘误源](issues/03-amd-gen-matrix.md)：
  **技能重复 6 次的「AMD 客户端无勘误通道」三个分句全是假的**——
  客户端 PPR 下载到了（`57930-A0-PUB_3.00`，1017 页，Fam 1Ah Model 70h，`[AMD Public Use]`）；
  Revision Guide `55449 Rev 1.21` 按 Ryzen / Threadripper 分列勘误，
  其 p.87 **erratum 1235 就是虚拟化勘误**（workaround 原文 "None. Do not enable AVIC."）；
  `AMD-SB-4xxx` 是 2022 年起的客户端公告序列。**这是第三次 fabricated negative** → **ticket 12**。
  真实缺口窄得多：仅当前世代（Fam 19h/1Ah）客户端机型段 Revision Guide 不可得 + 4 份 PPR 无第一方副本。
  **AMD 客户端混合核是调度问题不是正确性问题**（有实测）：HX 370 的 24 个 LP 上
  `Fn8000_000A` **逐位相同**；但限定两条——只测了 CPUID/MSR 报告面、无 VMCB/VMEXIT 行为测量，
  且 **Phoenix 2（`fam19h_model78h`）根本不报告 hybrid**，hypervisor 连分裂都看不见。
  **AVIC 在客户端是微码属性而非世代属性**：同 family/model/stepping，
  µcode `0x0B40400C/401A/4022` 读 AVIC=0，`0x0B404023` 与**本机 `0x0B404035`** 读 AVIC=1；
  PPR 57930 指出 AVIC(13) 与 x2AVIC(18) 是表中**仅有的两个 `Reset: 1` 而非 `Reset: Fixed,1`** 的位。
  **本机实测：`Fn8000_001D` 在 CPU 0–15 报 96 MB L3、16–31 报 32 MB，而 `Fn8000_0026` 什么都不标**
  ——**AMD 的缓存不对称不需要混合 SKU**，是 04 那条 Intel 发现的对应物。
  Zen 4 VMLOAD/VMSAVE 缺陷**没有 AMD 勘误号**，范围精确到 `fam19h` 18h–1Fh 与 60h–7Fh，
  Zen 5 不受影响，且**裸机 hypervisor 得不到任何自动缓解**。

- [06 一个技能还是两个？](issues/06-one-skill-or-two.md) ★ 枢纽：
  **合并入口、保留两棵 references 树**——一个 `SKILL.md` 在 body 内做厂商路由，
  `references/intel/` 与 `references/amd/` 各留各的书目。
  **2531 条规范锚点与 6616 处 `[N]` 引用一处不动**（锚点引的是厂商文档不是路径；
  `[N]` 作用域在本树内）；要动的只有路径前缀和两份 `lint.config.json`。
  **白捡修复**：AMD 章节里 11 处指向 intel-vt 的 404 路径变成技能内部路径。
  ADR：[`docs/adr/0001-one-skill-two-reference-trees.md`](../../docs/adr/0001-one-skill-two-reference-trees.md)（本仓库第一篇）。
  **`description` 草稿 816 字符**，低于最严的 1024 上限、比旧的两个都短，
  却新增了开发与型号两条触发面——旧 description **一个开发类词都没有**，
  这正是"怎么写 hypervisor"触发不了的原因。
  **`00-quickref.md` 的导航三节（§0.2 症状→章节、§0.3 表→章节、§0.5 五个 Windows 一行答）上移进 `SKILL.md`**，
  术语对照与阅读顺序留在 quickref；判据是"路由属于入口，内容属于 references"。
  **交给 07 的硬问题**：合并后的 body 要承载路由 + 三节导航 + 约 46 章路由表，
  而规范建议 body < 5000 token。

- [05 仓库卫生](issues/05-repo-hygiene.md)：11 项，**其中 2/3/4 不是缺陷**——
  远程仓库仍在（`743175724/x86-virt-skills`，private，HEAD `490a927`），
  且**本地基线 `9192e4c` 的 tree 与远程 HEAD 的 tree 完全相同**，丢的只是 `.git`。
  已用 `git rebase --onto origin/main 9192e4c main` **零冲突嫁接回真实历史**（40 提交）。
  补 `LICENSE` + `NOTICE`（解除 08 的先决条件）；删 5 张孤儿图并补孤儿资源 lint 规则；
  `install.mjs` 纳管 Kimi；`CLAUDE.md` 重写；基线**如实声明** rev 093 未纳入而非改标签。
- [07 分层读取契约](issues/07-tiered-read-contract.md)：**问题不是章节太大，是粒度错了**。
  实测：单个小节平均 **1.07k / 1.24k tok**，而整章最大 **26.4k**——**差约 20 倍**。
  契约 **T0 SKILL.md → T1 index 条目(~300 tok) → T2 单小节(~1.1k) → T3 整章**，
  典型回答 ≈ **1.4k tok**（对照现行 32k）。小节寻址**不需拆文件**，
  用 `index.json` 已有的 `headings` 抽取即可。**claim 元数据格式不动**——
  它的开销从来是粒度问题不是格式问题，而格式正是可信度的来源。
  合并后 body 估算 **~3.9k tok**，关键取舍是 `SKILL.md` 只路由到章名、描述留在 T1。
- [08 开发轨道](issues/08-development-track.md)：深度取 **(b) 可编译最小骨架**，不取完整成品
  ——完整产品会被整份复制而不被理解，且 CI 无硬件测不了它。
  形态 **Windows 内核驱动**，且**必须正面处理 VBS**（微软 2026-10 起自动开启），
  三条路径各讲代价，**第一件事是检测谁拥有 VMX root**。语言 **C + MASM**
  （MSVC x64 无内联汇编），以 `barevisor` 的单 core + 厂商后端结构为参照。
  挂 `references/dev/` 第三棵子树。**外加"已知陷阱"章**——这是最有价值的部分。
- [09 型号轨道](issues/09-cpu-generation-track.md)：**按故障组织，不按型号矩阵组织**。
  已证实的两条都不是"某代缺特性"而是"某代让一个流行写法失效"，矩阵记不进去。
  故障条目必须写出**真实成因**（防 `SimpleSvm` #3 那类把 MMIO>512GB 误记成"Zen 4/5 坏"）。
  键用 `famXXh_modelXXh`+stepping，**市场名↔CPUID 映射层必需**（13/14 代同签名）。
  微码是**个别条目的属性**不是全局维度。判定用 SDM 093 的 CPUID Domains。
  dated 规则**不开口子**，按性质拆放。实测需扩展锚点语法 `[measured <sig> µcode <lvl> <date>]`。
- [10 验收与 eval](issues/10-acceptance-and-eval.md)：**15 条可判真假的完成条件**。
  路由探针同时看"读对了吗"和"**读多了吗**"；开发题按**陷阱清单**评分不按相似度；
  按型号题里**"正确指出缺口"记满分**（否则训练出编造）；
  回归门用 `index.json` 已有的 `sha256`——搬运前后必须一致。
- [11 无文件系统宿主](issues/11-no-filesystem-hosts.md)：**蒸馏版不是独立文档，就是 T0 层本身**。
  07 把 T0 定在 < 5k tok，而规范建议正是这个数——**做对 T0 就等于做出蒸馏版**，
  原问题"丢什么"自动消解（T0 本来就不含 claim）。剩下的是通道：整包上传优先。
- [12 撤回假声明](issues/12-retract-amd-client-errata-negative.md)：见下方"本图发现的缺陷"。
- [13 中英文策略](issues/13-bilingual-strategy.md)：**正文保持英文，双语集中在路由层**。
  不做全文中文化——**每条翻译过来的 claim 都是一条没人核过的 claim**，
  而规范本身是英文的，翻译会多一道进错误的工序。
  双语层其实已就位（`summary_zh` 覆盖 45/46，已补齐至 **46/46**）；
  **术语对照表应随 §0.4 上移进 `SKILL.md`**——这是对 06 第 3 问的一处修正，
  在中文使用者的实际路径上它是路由，不是内容。

## 本图发现的缺陷

charting 的副产品，都不是原计划的一部分：

- **一条假声明重复了 10 处**（ticket 12）：「AMD 不为客户端发布勘误」三个分句全假。
  **是本语料第三次 fabricated negative**，而**反证就在技能自己的书目里**——
  `[31]`–`[33]` 三份客户端 PPR 列在 T1 段，紧挨其上三行的注释却说客户端没有 PPR。
  已撤回全部 10 处，新增 `E27`，**顺带关闭开放冲突 `O2`**（erratum 1235 在 55449 p.87，
  首现于 rev 1.17 / 2019-07——一个正确的假设因为一条捏造的负面声明被放弃了）。
  **并把契约机械化**：新增 lint 规则 4c，笼统负面声明必须带出版编号或 as-of 日期。
- **仓库声明 Apache-2.0 却没有 `LICENSE`**（ticket 05）——已补。
- **`.git` 丢失但远程仍在且内容一致**（ticket 05）——已嫁接回去。

## Not yet specified

**（空）** —— 13 个 ticket 全部 resolved，原有的五块迷雾全部散尽：
内容切分由 06/07 定、中英文策略毕业为 13、网页版毕业为 11 并由 07 消解、
真机流程由 09 定、重锚成本由 06 证明为零、eval 扩展由 10 定。

**这张图已经走完。下一步是按 spec 施工，不是继续规划。**

<!-- 历史记录：本节曾列有五块迷雾——内容迁移的具体切分 / 中英文策略 /
     网页版单文件蒸馏 / 真机验证流程 / 2531 条 claim 的重锚成本 / v2 的 eval 扩展。
     全部已毕业为 ticket 或被上游决策消解，故移除。 -->

## Out of scope

- **重写既有内容**。v2 是结构与入口改造，不是内容重写。现有 claim 的正确性已经过 2531 条核对和两轮盲测，不在本图范围内推翻。
  **例外**：本 effort 自己查实为**假**的声明要订正，那不是重写而是订正——见 ticket 12。
- **扩大服务器/云覆盖**（EPYC、Xeon、TDX 服务器场景的深度）。目标平台是 Windows PC 客户端。
- **非 x86 深度**（ARM CCA、RISC-V H 扩展）。保留现有的对比章节即可。
- **`C:\Users\Administrator\Desktop\Kimi_Agent` 目录的 GitHub tracker 配置**。那是另一件事，不要混进来。
