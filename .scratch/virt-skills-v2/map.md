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

## Not yet specified

以下是能看见轮廓、但还没法写成精确问题的部分。前沿推进后再毕业成 ticket。

- **内容迁移的具体切分**：哪些章节合并、拆分、或降级为附录。取决于 06 和 07 定下的结构。
- **中英文策略**：`index.json` 已有 `summary_zh`，但章节正文全英文，而主要使用者用中文提问。
  是否需要中文路由层？全文双语的成本是否可接受？取决于 06。
- **真机验证流程**：265KF 能验证哪些结论、怎么记录、算不算 Tier-1 证据。取决于 09。
- **2531 条既有 claim 的重锚成本**：若结构大改，锚点和 lint 规则要动多少。取决于 06、07。
- **v2 的 eval 扩展**：开发题和按型号查询题怎么出、怎么评分。取决于 08、09。

## Out of scope

- **重写既有内容**。v2 是结构与入口改造，不是内容重写。现有 claim 的正确性已经过 2531 条核对和两轮盲测，不在本图范围内推翻。
- **扩大服务器/云覆盖**（EPYC、Xeon、TDX 服务器场景的深度）。目标平台是 Windows PC 客户端。
- **非 x86 深度**（ARM CCA、RISC-V H 扩展）。保留现有的对比章节即可。
- **`C:\Users\Administrator\Desktop\Kimi_Agent` 目录的 GitHub tracker 配置**。那是另一件事，不要混进来。
