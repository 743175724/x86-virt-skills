# Spec: intel-vt 技能深度精炼（对齐 Intel 官方规范 + 跨 AI 可用）

Status: ready-for-agent
Created: 2026-09-20
Feature: intel-vt-refine
Owner: unassigned

---

## Problem Statement

用户手上有一个 `intel-vt` 技能（SKILL.md 5.3 KB + 15 个参考文件，共约 579 KB / 4974 行），目标是"AI 加载后即精通 Intel 虚拟化技术"。实际达不到，原因有五类，都是结构性的：

**一、指令自相矛盾，AI 无法同时遵守。** SKILL.md 说"大多数问答读完 `core-facts.md` 即可"，同时又要求关键事实必须带来源名 + 日期 + URL。但 `core-facts.md` 的 83 条要点里**零 URL、零置信度标注**。AI 要么违反第一条去拉 40–70 KB 的维度文件，要么违反第二条给出无出处的答案。更糟的是，SKILL.md 规定的引用格式 `dimNN §x` **在文件里根本不存在**——真实锚点是 `**证据 1.1-A**`。技能在诱导 AI 编造章节号。

**二、承重的架构事实没有锚定在 Intel 官方文档上。** dim02/dim03/dim05 的关键 ISA 事实大量引自 `xem.github.io` 的 2017 年 SDM 镜像、看雪译文、CSDN/博客园——距当前 SDM 已落后约 8 个修订版。dim04 只在开头引了一次 VT-d PDF，之后再没用过它的章节内容。用户要求"必须按照英特尔官方规范"，这不是排版问题，是每一条规范性断言都要重新锚定。

**三、深度不足以支撑实际工作。** 缺的不是概念解释，是干活要查的表：

- VMCS 层面：字段编码表（Vol.3D App.B）**完全没有**，只有编码格式和约 6 个零散例子；VM-instruction error 编号 1–28 **整表缺失**；VM-entry/VM-exit 检查列表只有一句"SDM 极其细致"；VMREAD/VMWRITE/VMPTRLD/VMCLEAR/INVEPT/INVVPID 没有操作数与异常规格。
- EPT：**表项位布局缺失**——只有 R/W/X，没有 memory type (5:3)、IPAT (6)、PS (7)、A (8)、D (9)、user-execute (10)、suppress-#VE (63)，也没有 EPT misconfiguration 触发条件。
- VT-d：**零寄存器定义**（CAP_REG/ECAP_REG/GCMD/GSTS/RTADDR/IQH/IQT/FSTS…），root-entry / context-entry / scalable-mode PASID-table entry 全部只有名字没有布局，**fault reason code 与 fault recording 完全没有**。
- TDX：SEAMCALL/TDCALL 只有名字，**没有 leaf 枚举**；TDR/TDCS/TDVPS/TDVPR 控制结构缺失；没有 TD 生命周期状态机、Secure-EPT 状态、page acceptance、GHCI/TDVMCALL。
- 嵌套：VMCS shadowing 提了两次从未展开——没有 VMCS-link pointer、VMREAD/VMWRITE bitmap、shadow-VMCS 标志位、vmcs02 构造与同步、nested EPT 违例反射规则。
- APICv：APIC-access page 与 virtual-APIC page 的区别讲了但没机制化；RVI/SVI 只出现一次无语义；相关 VMCS 编码（0x2012/0x2014/0x2016/0x201C–0x2022/0x0810/0x401C）未给出。

**四、确证的事实错误、断裂的证据图、跨文件矛盾。**

- 事实错：EPT violation qualification bit 7 被写成"GPA 有效"（SDM 为 guest-**linear**-address valid）；bit 6 被写成"XD 位之与"（实为 user-mode execute 之与）；ZombieLoad 被记为 CVE-2019-11091（实为 **CVE-2018-12130 / MFBDS**）；dim12 称"Intel 无 ASID 机制"（PCID 全文未提）。
- 证据图断裂：dim01 主时间线引用 E-33…E-37，正文只到 E-32——**这些编号不存在**；多行指向错误的 E 号。dim03 的 PML 主证据脚注指向 `gitlab.nic.cz/.../arch/arm64/kvm/sys_regs.c`，一个 arm64 源文件。dim04 脚注编号被流水线污染（`[^1066→见参考^]`）。
- 跨文件矛盾且未进勘误：FlexPriority（dim01 = 2006–2007 Merom/Penryn vs dim05/core-facts = 2008 Xeon 7400）；VT-d 1.0（2006-03 vs 2006-08）；TDX 内存加密（AES-128 vs AES-256）；VBS 开销（6% / 5–10% / 5–25% 三个数）；同一份 H100+TDX 研究两个 arXiv 编号与日期；OoH 结果在同一条断言内自相矛盾（13×/16× vs 14%/0.5%）。

**五、时效内容污染架构内容，且跨 AI 不可用。** dim10 约 70%、dim13 约 75% 是会过期的产品/市场材料（Gartner/Mercury 份额、云实例族、GA 日期、2027 路线图），与架构事实混排，AI 无从判断哪些需要复核。厂商营销被用断言语气陈述（"零虚拟化损耗""性能达物理机 100%""提升 160%"），尽管 errata #10/#13 明确警告过。同时现状只有一个 Claude 风格目录，无安装约定、无中立索引，Codex/Hermes 无法使用。

---

## Solution

把 `intel-vt` 从"研究证据档案"重建为"**以 Intel 官方规范文档为骨架的、可被任意 agent 按章加载的规范手册**"，并用一个黄金评测集把"AI 用了之后是否精通"变成可度量、可回归的量。

四条主线：

1. **按 Intel 官方文档重排章节。** 参考文件不再按"研究维度"编号，而是与 SDM Vol.3C 的 VMX 章节、VT-d 规范章节、TDX 文档集一一对应。AI 在技能内看到的章节结构，就是它在 Intel PDF 里看到的结构。
2. **每条规范性断言重新锚定到一级来源。** 引入三级来源分级与统一的 claim 记录 schema（含 `Volatility` 字段），机器可校验：架构类断言没有 Intel 文档号 + 章节号则 lint 失败。
3. **时效内容整体隔离。** 所有会过期的产品/市场/路线图事实迁入单一的 `90-dated-landscape.md`，文件头标注 as-of 日期与强制复核声明；架构章节保持长期稳定。
4. **单一源 + 最小生成适配器。** 内容只有一份。得益于 SKILL.md 已成为开放标准（agentskills.io，Claude Code / Codex / Hermes 均为其客户端），跨 AI 支持退化为"安装路径 + 两个生成的小文件"，不需要翻译或复制内容。

最终形态：AI 加载技能后，能回答 VMCS 字段编码、写出正确的 VM-entry 失败诊断路径、说清 Secure-EPT 页接受流程、指出某条常见说法是讹传并给出 Intel 文档号与章节号。

---

## User Stories

### 使用技能的 AI 与其用户

1. As a hypervisor 开发者, I want 查到完整的 VMCS 字段编码表（16/64/32/natural-width × control/read-only/guest/host 四组）, so that 我不必离开技能去翻 Vol.3D App.B 就能写 VMWRITE 调用。
2. As a hypervisor 开发者, I want 一份 VM-instruction error 1–28 的完整对照表, so that VMfailValid 之后我能立刻定位是哪一类错误。
3. As a hypervisor 开发者, I want VM-entry 与 VM-exit 的检查项按 SDM Ch.29/Ch.30 顺序枚举, so that 我能系统性排查 VM-entry 失败而不是猜。
4. As a hypervisor 开发者, I want 每条 VMX 指令的操作数、VMfail 条件与 #UD/#GP 触发条件, so that 我写的指令封装在异常路径上也正确。
5. As a hypervisor 开发者, I want EPT 各级表项（PML4E/PDPTE/PDE/PTE）的逐位布局与层级差异, so that 我构建的 EPT 页表不会因 memory type 或 IPAT 位设错而静默出错。
6. As a hypervisor 开发者, I want EPT violation 的 exit qualification 各位的**正确**含义, so that 我的缺页处理不会因为技能里 bit 7 的错误描述而写错。
7. As a hypervisor 开发者, I want EPT misconfiguration 的完整触发条件列表, so that 我能区分 violation 与 misconfiguration 两条不同的处理路径。
8. As a hypervisor 开发者, I want INVEPT/INVVPID 的描述符格式、类型编号与失败条件, so that 我的 TLB 失效逻辑在多核下是正确的。
9. As a hypervisor 开发者, I want APICv 相关的 VMCS 字段编码与控制位依赖关系, so that 我能正确开启 virtual-interrupt delivery 而不触发意外的 APIC-access exit。
10. As a hypervisor 开发者, I want RVI/SVI 语义与虚拟中断评估/投递算法的伪码, so that 我能实现或调试中断注入路径。
11. As a hypervisor 开发者, I want posted-interrupt descriptor 的 PIR/ON/SN/NV/NDST 字段语义与 PIR→VIRR 合并规则（含 ON/SN 竞态）, so that 我的投递逻辑不会丢中断。
12. As a 设备直通开发者, I want VT-d 的 DMAR 寄存器定义（CAP/ECAP/GCMD/GSTS/RTADDR/CCMD/IQH/IQT/IQA/FSTS/FECTL/IRTA）, so that 我能直接写 IOMMU 初始化代码。
13. As a 设备直通开发者, I want root-entry / context-entry / scalable-mode PASID-directory 与 PASID-table entry / second-level PTE / IRTE 的逐位布局, so that 我能构建并调试重映射表。
14. As a 设备直通开发者, I want VT-d fault reason code 表与 fault recording register 格式、以及 recoverable(PRQ) 与 non-recoverable 的分流, so that 我能诊断 DMA 故障而不是只看到一个错误号。
15. As a 设备直通开发者, I want invalidation descriptor 的格式与队列化失效（QI）流程, so that 我的失效逻辑符合规范顺序要求。
16. As a 机密计算开发者, I want SEAMCALL/TDCALL 的 leaf 枚举（TDH.MNG.*、TDH.MEM.PAGE.ADD/AUG、TDH.VP.ENTER、TDH.MR.EXTEND/FINALIZE、TDG.VP.VMCALL、TDG.MEM.PAGE.ACCEPT、TDG.VP.VEINFO.GET 等）, so that 我能对照 TDX Module ABI 写宿主与 guest 侧代码。
17. As a 机密计算开发者, I want TDR/TDCS/TDVPS/TDVPR/PAMT 控制结构的用途与关系, so that 我理解 TD 的内存所有权模型。
18. As a 机密计算开发者, I want TD 生命周期状态机（build → measure → finalize → run → teardown）, so that 我调用 SEAMCALL 的顺序是合法的。
19. As a 机密计算开发者, I want Secure-EPT 表项状态与 page acceptance 流程、以及 GPA shared-bit 的位置, so that 我能实现共享/私有内存转换。
20. As a 机密计算开发者, I want GHCI/TDVMCALL 接口与 TDREPORT_STRUCT 布局、RTMR 扩展语义, so that 我能实现证明流程。
21. As a 嵌套虚拟化开发者, I want VMCS shadowing 的完整机制（VMCS-link pointer、VMREAD/VMWRITE bitmap、revision ID 中的 shadow 标志位、shadow↔vmcs12 同步规则）, so that 我能实现或调试 L1 hypervisor 支持。
22. As a 嵌套虚拟化开发者, I want nested EPT 的 EPT02 构造、L1 的 EPT12 影子化、以及 EPT 违例反射给 L1 还是 L0 处理的判定规则, so that 我的嵌套内存虚拟化是正确的。
23. As a 嵌套虚拟化开发者, I want 嵌套场景下的最坏情况页表走访次数推导（而不是"进一步叠加"这样的许诺）, so that 我能量化嵌套的内存开销。
24. As a 安全研究者, I want 一张 CVE → 架构机制 → 缓解位/MSR 的矩阵（IA32_ARCH_CAPABILITIES、IA32_FLUSH_CMD 0x10B、IA32_SPEC_CTRL 0x48、IA32_PRED_CMD 0x49、VERW/MD_CLEAR、EPT PTE inversion、`kvm-intel.vmentry_l1d_flush`）, so that 我能从漏洞直接走到可部署的缓解措施。
25. As a 安全研究者, I want CVE 编号经过核对, so that 我不会把 ZombieLoad 引成 CVE-2019-11091 这种错误带进报告。
26. As a 安全研究者, I want 明确区分"VT 硬件缺陷"与"VMM 软件缺陷"的逃逸案例, so that 我的威胁建模归因正确。
27. As a 性能工程师, I want 每个性能数字都附带测试条件（微架构、hypervisor 版本、benchmark、年份）, so that 我不会把 2010 年 Westmere 的 650 cycles 当成现代平台的值。
28. As a 性能工程师, I want 冲突的测量结果并列呈现并说明差异来源, so that 我能判断哪个数适用于我的场景。
29. As a 技术写作者, I want 每条事实都能回溯到 Intel 文档号 + 修订版 + 章节号, so that 我的文档可以被第三方复核。
30. As a 中文使用者, I want 每章开头有一段中文速览, so that 我能快速判断这章是否是我要的，再读英文正文。
31. As a 提问者, I want 技能在回答涉及时效内容时主动提示"此为 as-of 2026-09-16 的快照，需复核", so that 我不会拿过期的 GA 日期去做决策。
32. As a 提问者, I want 技能在遇到常见讹传时主动纠正并给出出处, so that 我不会沿用错误口径。

### 使用技能的 agent 自身

33. As an AI agent, I want SKILL.md 的路由表精确到章节而不只是文件, so that 回答一个 VMCS 字段问题不必加载 72 KB。
34. As an AI agent, I want 明确的停止规则（读到什么程度就够了）, so that 我不会为一个简单问题耗尽上下文。
35. As an AI agent, I want 技能里规定的引用锚点格式与文件中实际存在的锚点一致, so that 我不必编造 `dimNN §x` 这样并不存在的章节号。
36. As an AI agent, I want 速查表在同一个入口文件里直达, so that 常见查表类问题一步到位。
37. As an AI agent, I want 每条事实标注 Confidence 与 Volatility, so that 我能决定是直接引用还是提示复核。
38. As an AI agent, I want 事实有唯一归属文件、其他文件只做交叉引用, so that 我不会读到同一事实的三个互相矛盾的版本。
39. As an AI agent, I want `intel-vt` 与同仓 `amd-virtualization` 之间有明确的消歧规则, so that AMD 为主的对比问题不会同时触发两个技能。

### 跨 AI 与维护

40. As a Codex 用户, I want 技能能被 Codex 的 skills 机制发现（`.agents/skills/`）, so that 我在 Codex 里得到和 Claude Code 里一样的能力。
41. As a Hermes 用户, I want 技能符合 agentskills.io 开放标准且描述前 60 字符可独立成立, so that 在 Hermes 的短描述约束下仍能被正确触发。
42. As a 任意 agent 的用户, I want 一份机器可读的 `index.json`, so that 没有 glob 能力的 agent 也能定位章节。
43. As a 技能维护者, I want 生成物与源之间有 CI 漂移校验, so that 三个入口不会随时间互相矛盾。
44. As a 技能维护者, I want 一个可重复运行的黄金评测集, so that 我改完内容后能验证"是否仍然精通"而不是凭感觉。
45. As a 技能维护者, I want 一个无依赖的 lint 脚本, so that 每次提交都能确定性地检查引用完整性与时效隔离。
46. As a 技能维护者, I want 时效内容集中在一个文件, so that 明年更新时我只改一个文件而不是十三个。

---

## Implementation Decisions

### D1. 章节结构对齐 Intel 官方文档（核心决策）

参考文件改用 `NN-topic.md` 命名（与同仓 `amd-virtualization` 一致，且文件号与文件内 `## N.` 编号对齐），章节划分严格映射到 Intel 官方文档：

| 新文件 | 官方规范锚点 |
|---|---|
| `00-quickref.md` | 速查附录（术语表 + VMCS 编码 + exit reason + MSR/CPUID + 文档号索引） |
| `01-vmx-intro.md` | SDM Vol.3C **Ch.26** Introduction to Virtual Machine Extensions |
| `02-vmcs.md` | SDM Vol.3C **Ch.27** + Vol.3D **App.B** Field Encoding in VMCS |
| `03-nonroot-operation.md` | SDM Vol.3C **Ch.28** VMX Non-Root Operation |
| `04-vm-entry.md` | SDM Vol.3C **Ch.29** VM Entries |
| `05-vm-exit.md` | SDM Vol.3C **Ch.30** + Vol.3D **App.C** VMX Basic Exit Reasons |
| `06-address-translation.md` | SDM Vol.3C **Ch.31**（EPT / VPID / PML / SPP / HLAT §31.2） |
| `07-apic-virtualization.md` | SDM Vol.3C **Ch.32** APIC Virtualization and Virtual Interrupts |
| `08-vmx-instructions.md` | SDM Vol.3C **Ch.33** + §27.9.5（VM-instruction error）+ Vol.3D **App.A** |
| `09-smm-seam.md` | SDM Vol.3C **Ch.34** SMM + **Ch.35** Secure Arbitration Mode (SEAM) |
| `10-vtd-dma-remapping.md` | VT-d 5.20 **Ch.3, 4, 6, 9, 11** |
| `11-vtd-interrupt-remapping.md` | VT-d 5.20 **Ch.5** |
| `12-vtd-faults-bios-siov.md` | VT-d 5.20 **Ch.7, 8, 10** + SIOV 337679-002 |
| `13-tdx.md` | TDX Base Arch 348549-008 / ABI 348551-008 / ISA ext 343754-003 / GHCI 348552-004 / SEAMLDR 343755-004 |
| `14-nested-virtualization.md` | §27.6.15、§27.10、Ch.31 + kernel 一手源 |
| `15-security.md` | SDM Vol.4（MSR）+ Intel Security Center 公告 |
| `16-performance.md` | 测量文献（二级源，强制带条件） |
| `17-software-ecosystem.md` | kernel.org / LKML / 厂商官方文档 |
| `18-comparison-amd-arm-riscv.md` | AMD APM Vol.2 / ARM ARM / RISC-V H-ext 规范 |
| `90-dated-landscape.md` | **时效隔离区**（云、市场、路线图，as-of 标注） |
| `errata.md` | 讹传勘误（每条必须自带一级或二级出处） |
| `bibliography.md` | 全局 `[N]` 引用 ID 空间 |

**已验证的官方文档基线（本次研究直接读取 Intel PDF 封面确认）：**

- SDM **rev 092, 2026-06**；合订 order **325462**，Vol.3C = **326019**，Vol.3 合订 = 325384，Vol.4 = 335592。
- VMX 章节在 rev 092 中为 Vol.3C **Ch.26–35**；**Vol.3D App.A** = VMX Capability Reporting，**App.B** = Field Encoding in VMCS，**App.C** = VMX Basic Exit Reasons。
- VT-d **Rev 5.20, 2026-04, order D51397-019**（11 章 + Appendix A）。
- ISA Extensions & Future Features **319433-062, 2026-06**。
- SDM Documentation Changes（手册自身的勘误通道）**252046-084**。
- VT-rp / HLAT **没有独立规范**，规范性内容只在 SDM §5.5.1/5.5.3/5.5.5、§27.6.22、§31.2。
- SIOV **337679-002 Rev 1.0**（2020），无更新，按"陈旧但现行"处理。

**两个必须写进实现说明的陷阱：**

1. SDM 章节号跨修订版被重编过。"Virtualization of System Resources"、"Handling Boundary Conditions in a VMM"、"Managing State" 在 rev 092 中**已不作为章节存在**（Vol.3 合订本 2084 个书签零命中）。实现者不得凭记忆或旧资料写章节号。
2. VT-d 的 intel.com 落地页元数据陈旧（页面日期显示 2023-03-22，`getContent/774206` 仍返回 Rev 4.1）。以 PDF 封面为准，不以落地页为准。

### D2. Claim 记录 schema（取代现有三种不一致格式）

现状有三套证据格式（dim01/02/06 内联记录、dim03/04 散文+部分记录、dim05 尾部证据日志）和两套置信度词表（`high/medium` 与 `高/中`）。统一为单一行内 schema：

```
- **Claim.** <断言正文>  `[SDM 3C §27.9.1]` `[42]` `C:high` `V:durable`
```

- 一级锚点 `[SDM 3C §27.9.1]` / `[VT-d 5.20 §7.2]` / `[TDX-ABI §3.4]`：**架构类断言必填**。
- `[42]`：指向 `bibliography.md` 的全局引用 ID（采用 `amd-virtualization` 的做法，替代重复的 7 字段块）。
- `C:high|medium|low` 置信度，词表统一为英文。
- `V:durable|dated`——**新增字段，驱动时效隔离**。`V:dated` 只允许出现在 `90-dated-landscape.md`。

原 7 字段块中的 `Excerpt` 仅在断言存在争议或表述微妙时保留；`Source`/`URL`/`Date` 迁入 bibliography 条目，不再逐条重复。

### D3. 来源分级（决定什么能作为唯一出处）

- **Tier 1 规范性**：Intel SDM / VT-d spec / TDX 文档集 / ISA Extensions Reference / Intel 安全公告。架构断言**必须**有至少一条 T1。
- **Tier 2 佐证**：kernel.org、LKML、同行评议论文、厂商官方文档（Microsoft Learn、VMware 官方文档、AMD APM、ARM ARM、RISC-V 规范）。
- **Tier 3 背景**：博客、新闻、营销材料。**永不得作为架构断言的唯一出处**；仅可作为上下文出现，且必须以归属语气陈述（"厂商称…"）。

迁移时，现有指向 `xem.github.io` SDM 镜像、看雪译文、CSDN/博客园/掘金、百度百科的架构类引用**全部降级为 T3 或删除**，对应断言重新锚定到 T1。

### D4. 事实归属（消除约 2400 词重复）

每条事实有唯一 owner 文件，其他文件只交叉引用不复述：

- `02` 拥有 VMCS 结构、执行/退出/进入控制、VMFUNC、VMCS shadowing 位；
- `06` 拥有 EPT 结构、VPID、PML、SPP、HLAT；
- `07` 拥有 APICv 与 posted-interrupt descriptor；
- `11` 拥有 IRTE 与中断重映射（`07` 交叉引用）；
- `13` 拥有全部 TDX（含 CVE-2025-30513、TDXRay 这两条现在错放在 dim10/core-facts 而 dim08 反而没有的事实）；
- `14` 拥有嵌套机制；
- `15` 拥有 VBS/HVCI（消除 dim07/dim09/dim13 的三份副本）；
- `18` 拥有 AMD/ARM/RISC-V 对照。

`core-facts.md` 的角色从"事实副本"改为**带引用的索引**：每条要点必须携带 `[N]` 与 owner 文件的章节锚点，不再是无出处的扁平摘要。

### D5. 时效隔离

`90-dated-landscape.md` 文件头强制包含：as-of 日期（2026-09-16）、"使用前必须以官方来源复核"声明、以及按类别分节（云厂商产品状态 / 内核与发行版合入 / 市场与份额 / 未来路线图）。

迁入范围（审计已逐条列出）：dim10 §1/§5/§7/§8 全部、dim13 §§1,2,4,5,6,7,8、dim08 §6–§7、dim12 §8、dim07 的 Pwn2Own 与 Win11 默认策略、dim09 的产品版本细节、dim11 §3。

厂商营销数字（"零虚拟化损耗""达物理机 100%""提升 160%""I/O 提升 5 倍""神龙 40% 损耗"）按 errata #10/#13 改为归属语气或删除；dim10 的 28 条检索查询日志、各文件的"须向主智能体报告"等研究流程叙述一律删除，压缩为每文件一行 provenance 头。

### D6. 必须修正的错误（迁移时逐条处理，并在 `errata.md` 留痕）

1. EPT violation qualification **bit 7 = guest-linear-address valid**（非 GPA 有效）。
2. EPT violation qualification **bit 6 = user-mode execute 之与**（非 XD 之与；仅 MBEC=1 时有效）。
3. **ZombieLoad = CVE-2018-12130 (MFBDS)**，非 CVE-2019-11091。
4. dim12 "Intel 无 ASID 机制" → 改为说明 Intel 用 **PCID**（进程上下文）+ **VPID**（VM 上下文）两套标识，与 AMD 的 32-bit ASID 在语义与位宽上的差异。
5. dim01 证据图重编：E-01…E-32 连续编号，主时间线表每行重指有效编号，删除对 E-33…E-37 的引用。
6. dim02 "首批 VMX 处理器仅支持 bit 1/2/4 的 1-setting" → 按 SDM 的 default-1 保留位规则重写。
7. dim03 PML 脚注指向 arm64 源文件 → 重新锚定。
8. 裁决并记录跨文件矛盾：FlexPriority 首发代际、VT-d 1.0 日期、TDX 加密算法按代际（AES-128 vs AES-256）、VBS 开销三个数（附测量条件）、H100+TDX 研究的正确 arXiv 编号与日期、OoH 的 13×/16× vs 14%/0.5%。
9. `errata.md` 现有 15 条中有 9 条只给了文件名没给出处 → 每条补一级/二级出处；修正 #13 极性表述歧义（"讹传"格中写着"(事实)"）。

### D7. 深度补全（按 D1 的章节归位）

审计列出的全部缺口写入对应章节：VMCS 字段编码全表、VM-exit basic reason 全表、VM-instruction error 1–28、VM-entry/exit 检查项、每条 VMX 指令的操作数与失败条件、EPT 表项逐位布局与 misconfiguration 条件、INVEPT/INVVPID 描述符、APICv offset 映射与 RVI/SVI 语义与投递伪码、VT-d 全部寄存器与表项与 fault reason、TDX leaf 表与控制结构与生命周期、嵌套 shadowing 与 EPT02、CVE→缓解位矩阵、AMD 侧补 VMCB control area / EFER.SVME / VM_CR / `#VC vs #VE` / C-bit / VMPL / RMPUPDATE·PSMASH·RMPADJUST / GHCB，并明确"AMD 无 VMCS-shadowing 对应物"。

### D8. 语言策略

规范性正文用英文，术语与 SDM 原文逐字对齐；每章开头一段 `> 中文速览`（3–5 句）。`00-quickref.md` 的术语表提供中英对照。`errata.md` 每条同时给中英表述（讹传多以中文流传）。

### D9. 打包与跨 AI（单一源 + 最小生成物）

关键前提（已核实）：SKILL.md 已是开放标准，**Claude Code、Codex、Hermes 均为 agentskills.io 客户端**，Hermes 官方文档明确描述了"精简 SKILL.md + `references/` 按需加载"的知识库模式。因此内容零复制。

- **源**：`intel-vt/SKILL.md` + `intel-vt/references/*.md`。
- **frontmatter 只用 6 个标准字段**（`name`/`description`/`license`/`compatibility`/`metadata`/`allowed-tools`）——非标字段在打包时是硬报错。
- **约束**：`name` 必须等于目录名，`[a-z0-9-]`，1–64 字符；`description` ≤1024（规范）；SKILL.md 正文 **≤500 行 / <5000 token**；**description 前 60 字符必须是能独立成立的英文触发短语**（Hermes 建议 ≤60 字符）。
- **安装路径**：`.agents/skills/intel-vt`（Codex 与 Hermes 共用）+ `.claude/skills/intel-vt`（Claude Code）。
- **生成物（禁止手改，头部带 `DO NOT EDIT`）**：`agents/openai.yaml`（Codex 展示信息与隐式调用策略）、`index.json`（章节名/描述/路径/标题层级/sha256）。
- **根 `AGENTS.md`**：只放指针与"何时读"，不放内容——指针不会语义漂移，且不占 Codex 32 KiB 合并上限。
- 不生成 `BUNDLE.md` 单文件拼接版（真实内容重复，且三家消费者都不需要）。

### D10. SKILL.md 契约重写

- 路由表精确到**章节**（如 `06-address-translation.md §3.2`），不止文件。
- 加入"只读相关章节，不要全量加载"与显式停止规则。
- `errata.md` 与 `00-quickref.md` 进入路由表（现状 errata 被规定为"动笔前必查"却不在表里）。
- 引用协议与文件中真实存在的锚点一致，删除不存在的 `dimNN §x` 方案。
- 加入与 `amd-virtualization` 的消歧规则：AMD 为主的问题走 AMD 技能，Intel 为主或双向对比走本技能。
- 解决"读完 core-facts 即可"与"关键事实必须带来源"的冲突：core-facts 携带引用后，两条指令不再互斥。

---

## Testing Decisions

**单一测试缝：技能的外部行为契约**——给定一个问题，一个全新 agent 只读这个技能能否答对、答全、答得可回溯。不测文件内部结构，不测某个函数，测的是"用了这个技能的 AI 表现如何"。这是唯一能验证"精通"这个目标的缝。

### T1. 黄金评测集（行为）

- `eval/questions.yaml`：**80 题**，覆盖全部章节，题型配比约为 查表类 30% / 机制解释 30% / 诊断推理 25% / 讹传陷阱 15%。
- 每题字段：`id`、`chapter`、`question`、`must_include`（必须出现的事实/数值/位号）、`must_not_include`（讹传表述，直接取自 `errata.md`）、`required_citation`（必须给出的 Intel 文档号 + 章节号）。
- **陷阱题必须覆盖 D6 的每一项已知错误**：问 EPT violation bit 7 的含义、问 ZombieLoad 的 CVE 号、问 FlexPriority 首发代际、问 Intel 有无 ASID 类机制——现状技能会答错，精炼后必须答对。
- `eval/RUNNER.md`：可被三家 agent 自行执行的协议（不绑定任何厂商 API），结果写入 `eval/results/<agent>-<date>.md`。
- **通过线**：`must_include` 命中率 ≥90%；`must_not_include` 违反 **0** 次；引用有效率 ≥95%（文档号与章节号存在且对得上）。
- **好测试的判据**：只断言"答案里应当出现什么事实"，不断言措辞、不断言 agent 读了哪个文件、不断言章节内部标题层级——那些是实现细节，会让测试在合理重构时误报。

### T2. 引用 lint（形式，确定性）

`tools/lint.mjs`（Node，零依赖），CI 与提交前运行，检查：

1. 每条 claim 行带引用 token；
2. 每个 `[N]` 在 `bibliography.md` 中可解析，且无孤儿条目；
3. T1 锚点匹配已知文档号与章节号格式；
4. `01`–`14` 中每条架构断言至少有一条 T1 引用；
5. `V:dated` 的断言**只允许**出现在 `90-dated-landscape.md`；
6. frontmatter 仅含 6 个标准字段，`name` == 目录名，`description` ≤1024 且首句 ≤60 字符；
7. SKILL.md ≤500 行；
8. 路由表中的每个文件与章节锚点都真实存在（防止再次出现 `dimNN §x` 这类幽灵引用）；
9. 归属映射不被违反（owner 之外的文件只交叉引用不复述）；
10. 生成物（`agents/openai.yaml`、`index.json`、`AGENTS.md`）与源一致（漂移校验）。

### T3. 本仓既有测试先例

**无。** 本仓目前没有任何测试、构建或 CI 基础设施（连 `package.json` 都没有），所以 `eval/` 与 `tools/` 是新建的第一套。实现时保持零依赖、可离线运行，不要为此引入包管理器工作流。

---

## Out of Scope

- **不重构 `amd-virtualization` 技能**。只在本技能的 SKILL.md 里加消歧规则；AMD 侧内容的修订是另一件事。
- **不做图**。`amd-virtualization` 有 14 张 PNG，本技能暂不补图；目录结构预留 `references/images/`，内容留待后续。
- **不做全文中译**。按 D8，英文为主 + 中文速览。
- **不做超出"重新锚定 + 补全已知缺口"的新研究**。补全范围以本次审计列出的缺口为准，不扩展到 SDM 未覆盖的主题。
- **不建 MCP server、不发布到任何 registry、不做版本发布流程**。
- **不更新 2026-09-16 之后的事实**。时效区保持该 as-of 日期；刷新是后续独立任务。
- **不处理 `.git` 缺失问题**（见下）。

---

## Further Notes

**仓库没有 git。** 会话开始时的快照报告分支 `master` 与提交 `6810002 Baseline: virt KB skills (amd-virtualization, intel-vt) + agent docs + spec`，但目录下**没有 `.git`**，两个 shell 的 `git status` 都报 "not a git repository"。这意味着这次重构没有版本回退保护。**实现前第一步应当是 `git init` 并提交现状作为基线**，否则一次失败的大规模迁移无法回滚。

**迁移体量。** 13 个维度文件 → 19 个章节文件，不是改名而是重切：一个维度文件的内容会散到多个章节（例如 dim02 的 VPID 部分归 `06`，VMFUNC 归 `02`，指令语义归 `08`）。建议按章节并行推进，但 `bibliography.md` 是共享写入点，需要串行合并或为各章分配不重叠的 ID 区段。

**引用核验成本是这个任务的主要工作量。** 每条 T1 锚点都必须对着真实 PDF 核对章节号——不能凭记忆。本次研究中，连我自己给出的 SDM 章节结构前提都是错的（假设存在 "Virtualization of System Resources" 等章节，rev 092 中已不存在）。实现 agent 若凭记忆写章节号，会系统性地引入一批看起来权威、实则错误的引用，比现状的博客引用更危险——因为它不可证伪地"看起来像官方来源"。lint 的第 3 项就是为此存在的。

**core-facts.md 当前有 83 条要点、约 250–300 个原子事实**，与各维度文件的"维度总结"段落几乎逐句重复（约 6 × 400 词）。改造为带引用的索引后，这部分重复自然消失。

**评测集本身需要人工过一遍。** `must_include` 里的事实如果写错，评测就会奖励错误答案。建议评测集的陷阱题部分由用户本人复核一次，其余题目由 lint 的 T1 锚点校验兜底。

**审计覆盖度说明。** 本 spec 的问题清单来自对全部 16 个文件（SKILL.md + 15 个参考文件，约 579 KB）的完整通读，加上对 Intel 官方文档结构与三家 agent 技能格式的独立核查。已确证的事实错误、断裂引用、跨文件矛盾均在 D6 中逐条列出，不是抽样推测。
