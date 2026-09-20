# Spec: amd-virtualization 技能深度精炼（对齐 AMD 官方规范 + Windows PC + 跨 AI 可用）

Status: ready-for-agent
Created: 2026-09-20
Feature: amd-virt-refine
Owner: unassigned
Sibling: `.scratch/intel-vt-refine/spec.md`（同一套方法已在 `intel-vt` 上执行完毕，本 spec 复用其结论与工具）
Recheck: `.scratch/amd-virt-refine/recheck-findings.md`（5 路深度复检的裁决记录——**与本文件冲突时以复检记录为准**）

---

## Problem Statement

用户手上有一个 `amd-virtualization` 技能（SKILL.md 4.3 KB + 15 个参考文件 + bibliography，共约 405 KB / 2484 行 + 14 张 PNG），目标是"AI 加载后即精通 AMD 虚拟化技术"，且只服务 Windows PC。对全部 16 个文件的完整通读 + 官方文档结构核查表明，它达不到这个目标，原因有五类，都是结构性的。

### 一、承重的架构事实没有锚定在 AMD 官方文档上

这是最严重的一条，也是用户"必须按照 AMD 官方规范"这条要求指向的核心问题。机械统计：

- `bibliography.md` 有 **503 条**条目、无断链、无孤儿（引用管道本身是健康的，这点要保留）。但其中**只有 34 条（6.8%）指向 amd.com / docs.amd.com，而这 34 条里只有 4 条带章节号或表号**。
- 15 个章节文件全文只出现 **18 次** AMD 文档提及、约 **30 个 `§` 符号**。02、06、07、11、13、14 六个文件的 AMD 文档提及数为 **0**。

具体到承重引用：

- **`[^1^]` 是 2005 年的 SVM 手册 33047 Rev 3.02，被引用 62 次**（其中 48 次在第 3 章）。也就是说，开头声称"依据 APM 第 15 章、附录 B、附录 C"的 VMCB 章，实际证据来自一本二十年前被取代的手册。
- **APM Vol.2 在第 8/9/10 章是通过中文博客转录版 `icode.best` 引入的**（`[^240^]`），它承载着 VMCB `0x090` bit 2、VMSA 指针 `0x108`、GHCB MSR 保存位置、VMGEXIT 编码、RMP 条目字段、SYSCFG VMPLEn/SecureNestedPagingEn 等一批规范性事实。真正的 APM 条目 `[^2^]/[^3^]/[^83^]` 在这三章从未被使用。
- **APM Vol.3（24594）在整个 bibliography 中不存在。** 因此 VMRUN/VMLOAD/VMSAVE/STGI/CLGI/INVLPGA/SKINIT/PVALIDATE/RMPADJUST/RMPUPDATE/PSMASH 没有任何一条有官方的编码、操作数与 `#UD`/`#GP` 条件。第 15 章的附录 C 退出码表引的是 **`vlsiworlds.com` 上的盗版 PDF 镜像**。
- **IOMMU 侧更糟**：第 6 章的 256-bit DTE 位布局表与整张 MMIO 寄存器表标题写着"按 48882 Rev 3.11"，实际引用是 **OSDev Wiki**（`[^130^]`）；该章仅有的两条 AMD IOMMU 引用 `[^9^]/[^134^]` 都是 **2007 年的旧版 PID 34434 Rev 1.20**。GCR3/PASID 索引的来源是一份 **Justia 专利申请**；失效命令语义与三日志设计来自 **`termbasehub.com` 这个术语农场站**。
- **#56860（SEV-SNP 固件 ABI）从未被引用过**，bibliography 里只有它的修订历史页/门户页。第 10 章却做了约 12 处 "56860 Table N" 的断言，每一处的脚注都指向第三方（Edgeless 文档、confidential.ai、某个 GitHub 的 `ATTESTATION_STATUS.md`、一个 SPIRE 的 GitHub issue、`zenn.dev` 的安全夏令营习题答案）。
- 其他承重来源包括：CSDN 转录的 2006 rootkit 论文（INT_CTL 位号，8 次）、**unknowncheats.me 论坛帖**（TLB_CONTROL 编码）、**DeepWiki（AI 生成）**（GHCB 字段偏移）、**Level1Techs 论坛帖**（1006 个 ASID）、**baike.baidu.com**（SMT 缓解、CVE-2025-0029）、**ZDNet**（VBS/HVCI 硬件要求）、**`cms.globalmusicreport.ifpi.org`**（VirtualBox `VERR_SVM_DISABLED`）、**`historytools.org`**、**`dinajpuritpark.com`**、**`voltagegpu.com`**（竞品营销页，用作 Azure GA 日期）。
- bibliography 自身有 5 条**完全没有 URL**（`[^256^]` 还自我标注"低质量二手来源"，且被第 10 章开篇引用），`[^312^]` 与 `[^500^]` 是同一来源的重复 ID，6 条带着研究流程标记 `(dim09 引用)`。

SKILL.md frontmatter 写着"全部事实带引用编号，可回溯至 **503 条一手来源**"。按上面的清单，这句话不成立。

### 二、深度不足以支撑实际工作

缺的不是概念解释，是干活要查的表。审计逐项核对后确认**缺失**（不是"简略"，是没有）：

**SVM/VMCB 侧**
- VMCB Control Area **0x000–0x3FF 逐字段偏移表完全没有**（现有的是 14 行摘要），连 03Ch/03Eh 的 PAUSE filter threshold/count 都被表格标成"保留 MBZ"，0B8h VIRT_EXT（LBR virt / VLS 使能位）在全库不存在——而第 2 章却在宣传 VLS 特性位。
- VMCB State Save Area 表把 **10 个段描述符压成一行 "000h–098h"**，无法查 FS.base；LASTEXCP_TO 290h 缺失。
- **拦截位向量没有位号**：向量 3 只有散文范围，**向量 4 完全没有位号**，且漏掉 MWAIT_COND/XSETBV/RDPRU/EFER 写陷阱/CR0-15 写陷阱。
- **EXITCODE 全表缺失**：只列了约 25 个"关键退出码"，漏掉 0x61–0x63、0x66–0x6D、0x6F–0x71、0x73/0x74/0x76、**0x7A INVLPGA**、0x7E、0x8C–0x9F、0xA2。更讽刺的是第 15 章速查表漏掉了 **60h INTR 与 61h NMI**——而第 13 章自己的退出分布表显示这两个占了 46.29% + 8.38%。
- EXITINFO1/EXITINFO2 只覆盖异常/IOIO/MSR/NPF 四类；task switch、INTn、CR/DR 写陷阱、AVIC 0x401/0x402 载荷、VMGEXIT 全缺。
- CPUID **Fn8000_000A EDX 表在 bit 18 截断**，漏掉 GMET(17)、SpecCtrl(20)、TlbiCtl(24)、VNMI(25)、IbsVirt(26)、NestedVirtVmcbAddrChk(28)、BusLockThreshold(29)、IdleHltIntercept(30) 等；EAX/EBX 只有 2 行。
- SVM 指令的 `#UD`/`#GP` 条件只有散文，**没有逐指令异常表**；NRIP 语义只有一句话。
- **TSC ratio（MSR C000_0104）与 `Fn8000_000A EDX[4]` TscRateMsr 在全库不存在**；LBR virtualization 在第 5 章完全缺席。

**NPT 侧**
- **NPT 表项逐位布局不存在**——只有字段名清单和一句"与 AMD64 长模式页表项完全相同"，没有位号、没有分级差异、没有保留位规则、没有 C-bit 交互。
- **guest PAT / 内存类型合并规则（APM §15.25.x 那一节）全库缺失**。
- NPF EXITINFO1 只写了 bit 32/33（来源是一个外挂博客），且**位号错**（见下）；bit 31 RMP、34、35、36、37 与低位错误码全缺。

**AVIC / 中断侧**
- **APIC backing page 布局不存在**；ALLOWED/ACCELERATED/TRAP/FAULT 四种行为只有名字，没有映射到寄存器。
- **Physical / Logical APIC ID Table 条目格式不存在**；VMCB 的 AVIC 字段偏移（038h/0E0h/0F0h/0F8h）**在第 3 章和第 5 章都没有**，而且第 5 章把它们命名成架构里不存在的 `AVIC_LOGICAL_PAGE`/`AVIC_PHYSICAL_PAGE`。
- AVIC_INCOMPLETE_IPI 的四个失败码没有取值；NOACCEL 的 EXITINFO1 编码只有散文。
- INT_CTL 除 vGIF 外几乎空白：V_TPR/V_IRQ/V_INTR/V_INTR_MASKING/V_NMI/AVIC_ENABLE(31)/X2AVIC(30) 无位号。

**IOMMU 侧（缺口最大）**
- MMIO 寄存器表有偏移、**但没有任何一个寄存器的位定义**：Control Register 的 IommuEn(0)/EventLogEn(2)/CmdBufEn(12)/PPRLogEn(13)/GTEn(16)/GAEn(17) 全缺，EFR 只有一句散文列举能力名。
- **DTE 表没有任何位号**，只有 dword 内的字段排序——无法构造也无法解码一个 DTE；IntTabLen 的 `2^n` 编码缺失；SNP/SATS 只有名字。
- **命令格式没有 opcode、没有字段布局**：八条命令只在一句散文里列了名字。
- 事件日志有 14 个 code，**但没有条目格式**（16 字节、DeviceID、EventCode 位置、类型相关标志）。
- IVRS 缺表头 IVinfo、缺设备条目长度规则、**IVMD 类型码整行是空的**。
- **IRTE 是最大缺口**：legacy 格式只给了 3 个字段，且把 `RemapEn` 全篇写成 **`RemapEm`**（还进了小节标题）；**128-bit GA/guest-vAPIC IRTE 格式完全不存在**；GA log 条目格式不存在；ATS/PRI/PASID 各一段散文，无任何报文格式。

**SEV 侧**（即便按服务器范围保留，也不能是现在这个深度）
- `Fn8000_001F` **EAX[4] = SEV-SNP 这一位在全库不存在**——读者无法探测 SNP；EDX（MinSevNoEsAsid）缺失，ASID 范围划分因此无从谈起。
- **MSR 0xC0010131 (SEV_STATUS) 在 08/09/10 三章从未出现**，只在速查表里有 bit 0/1；SNP active、vTOM、ReflectVC、Restricted/Alternate Injection、Debug Swap、Secure TSC 全缺。
- **VMSA 字段表完全没有**；**整章 GHCB 只公布了一个偏移**（`sw_exit_code` 0x390），valid_bitmap/shared_buffer/protocol_version/ghcb_usage 只有名字。
- **RMP 条目布局不存在**（一句散文）；页状态只写了 3 个（实际还有 Firmware/Reclaim/Metadata/Context/Pre-Guest/Pre-Swap）；PVALIDATE/RMPADJUST/RMPUPDATE/PSMASH/RMPREAD 每条一句话，无操作数、无标志、无错误码（只有 `FAIL_OVERLAP=4`）。
- **SVSM 调用约定整节缺失**——文中说 #58019"定义了调用约定、结果码与全部协议族"，然后再没有下文。
- **ATTESTATION_REPORT 没有偏移、没有 TCB_VERSION 字节编码**；SNP 固件命令只有一串逗号分隔的名字。

### 三、已确证的事实错误与跨文件矛盾

审计逐条核对后确认（每条都附正确值，将成为 `errata.md` 的种子）：

1. **第 6 章：`CmdBufRun` 放错了寄存器。** 文中说"仅当 Control Register(0x0018) 的 CmdBufRun=1 时处理命令"——`CmdBufRun` 是 **Status Register(0x2020) bit 4 的只读状态位**；启动命令处理的是 Control Register bit 12 `CmdBufEn`。同一章自己的表格与这段散文互相打脸。
2. **第 6 章：IOMMU MMIO 窗口写成 14 KiB**，实为 **16 KiB (0x4000)**；而同章表格列到 0x2048、又描述拦截 "0x2000–0x2FFF"，三处互不相容。
3. **第 7 章：`RemapEn` 全篇误写为 `RemapEm`**，并且成了整个 MSI 欺骗论证的锚点。
4. **第 10 章：NPF EXITINFO1 位号整体错位一位。** 文中 bit 33 ENC / 34 SIZEM / 35 VMPL；正确为 **34 ENC / 35 SIZEM / 36 VMPL**（bit 33 是 GUEST_PAGE，bit 32 是 GUEST_FINAL，均早于 SNP）。只有 bit 31 RMP 是对的。
5. **第 3 章：把 2005 年手册的 CR4/EFER MBZ 掩码当成现行 VMRUN 一致性检查**（"CR4[63:11] 非零…EFER[63:15] 非零"）。CR4 bit 11(UMIP)/12(LA57)/16–18/20–24 与 EFER bit 15(TCE)/17(MCOMMIT)/18(INT_WBINVD)/21(AutomaticIBRS) 今天都是合法的。照这个写法，一个正常的 Windows guest 状态会被判定为非法 VMCB。
6. **第 2 章：退出码编码规律写错。** "EXITCODE 数值等于对应拦截位在拦截向量中的位序"——错；第 3 章自己给了正确规则（CR 读 00h–0Fh、异常 40h–5Fh、向量 3 → 0x60+bit、向量 4 → 0x80+bit，故 VMRUN = 0x80）。
7. **第 1 章 vs 第 2 章：`#VMEXIT` 恢复了什么。** 第 1 章说"硬件仅恢复 host 的 RIP/RSP/RAX 三个寄存器"；正确表述是 **GPR 中只恢复 RAX/RSP/RIP**，同时还要装载 GDTR/IDTR/EFER/CR0(PE 强制为 1)/CR3/CR4/RFLAGS——第 2 章的流程是对的。
8. **第 2 章：VMLOAD/VMSAVE 的字段清单里混进了 `SS`**（引自 Project Zero 的转述）。VMLOAD/VMSAVE 从不涉及 SS；同章另一处的清单（FS/GS/TR/LDTR/KernelGsBase/STAR/LSTAR/CSTAR/SFMASK/SYSENTER_*）才是对的。同章的世界切换序列 `clgi; vmsave; vmrun; …; vmsave/vmload; stgi` 也是错的——退出后是 **VMLOAD**。
9. **第 8 章：SEVurity 与 SEVerity 混为一谈。** 表里写 "SEVurity (S&P 2020)"，正文却把 AMD-SB-1004 的回应挂在它头上；AMD-SB-1004 对应的是 **SEVerity = CVE-2020-12967 (WOOT'21)**，而 CVE-2020-12967 在第 8 章根本没出现。
10. **第 11 章：CVE-2024-25744 被当成 SEV-SNP 漏洞**——它是 Linux 内核的 **Intel TDX** guest 问题（`int 0x80` 注入）；Heckler 在 SNP 上对应的只有 CVE-2024-25743。同一漏洞的披露日期在表里是 2024-08、在正文是 2024-03。
11. **第 12 章：Hyper-V 矩阵里"嵌套虚拟化"填 `—`。** Windows Server 2022 / Windows 11 起 AMD 平台**支持**嵌套（`Set-VMProcessor -ExposeVirtualizationExtensions $true`）。同表"Hyper-V 不支持 AMD SEV"与第 14 章的 Azure DCasv5/v6 SEV-SNP CVM（Hyper-V + OpenHCL 在 VMPL0）直接矛盾，全库没有一处调和。
12. **第 13 章标题把 Intel 的数字挂在 AMD 头上**："#VC+GHCB 最高再放大 6.8 倍"——正文里 6.8× 是 **TDX** 的数，SNP 是 +240%。同段又写 TDX "+472%"，与 6.8×（=+580%）无法调和。
13. **第 13 章：嵌套遍历 24 次 vs 16 次**在同一段里并列出现未作裁决（正确为 (4+1)(4+1)−1 = **24**）。
14. **第 6 章的平台拓扑是 2007 年的**："I/O 设备经 HyperTransport 接入 I/O Hub…IOMMU 集成在 I/O Hub 内部"——Zen 平台（AM4/AM5/SP5）上 IOMMU 在 SoC 内的 NBIO/IOD，没有 HyperTransport、没有 I/O Hub。这一条直接影响 Windows PC 目标读者。
15. **第 7 章：strict/lazy 失效默认值自相矛盾**（表里说 AMD 默认 strict，两行后又说 `amd_iommu=fullflush` 才立即刷）；实际取决于内核 `CONFIG_IOMMU_DEFAULT_DMA_{STRICT,LAZY}`，不是 AMD 架构属性，随附的"约 5% DMA 开销"来自一篇 K8s 博客。
16. **加密模式表述三处不一致**：第 11 章说全代 "AES-XEX"（另一处写成 "AES-XE"），第 11/14/15 章又说 Genoa+ 是 AES-256-XTS。
17. **第 14 章把"SEV-ES 在支持 SNP 的 CPU 上被禁用"记成 Turin 的代际特性**——它是 **CVE-2025-48514/48517 固件修复的副作用**（FW 1.37.23/31/41），覆盖 Milan/Genoa/Turin，而第 10 章对此只字未提。
18. **术语三套并存**：第 4 章 `hPA/SPA`、第 6 章 `SPA(=HPA)`、第 7 章 `HPA`。AMD 的用词是 **sPA (system physical address)**。第 4 章还写"gPA 被当作 host 虚拟地址(hVA) 经 nPT 翻译"——嵌套遍历里不存在任何 host 线性地址。
19. **缺失的漏洞类别**（全库 grep 零命中）：**SRSO/Inception (CVE-2023-20569)、Zenbleed (CVE-2023-20593)、Branch Type Confusion (CVE-2022-23825/23816)、Transient Scheduler Attacks (CVE-2024-36350/36357)**、KVM nSVM 逃逸 CVE-2021-3653/3656、ZenHammer。第 12 章甚至直接贴了带 `/* Spectre v2 / RETBleed 缓解 */` 注释的代码，而没有任何一章解释它。
20. 30 条 CVE 里**只有 5 条带可机检的缓解锚点**（内核版本/commit、微码 commit、SEV FW 版本、ABI 版本、AGESA）；CacheWarp/StackWarp/56161 没有微码补丁级别，RMPocalypse 没有 AGESA 版本，StackWarp 的"未公开 MSR 控制位"没有下文。

### 四、结构问题

- **同一事实散落在 3–4 个文件里，取值还不一致。** SEV 密钥槽数 15/509/1006 有 **四份副本**（ch01/ch08/ch10/ch14），且 ch10 把 509 给了 Milan、ch14 给了 Rome、ch08 说是 Rome；`Fn8000_000A` 位表出现在 ch02/03/04/05/15 五处，ch15 引的还是 **2007 年的 CPUID 规范**（不可能含 VGIF/x2AVIC）；AVIC 唤醒三代演进在 ch05 和 ch07 各讲一遍；IVRS 在 ch06 和 ch07 各介绍一遍；CVE 材料在 ch08/09/10 与 ch11 之间三重重复且互相矛盾。
- **第 15 章速查表是第二个事实库，不是导航层。** 有 6 类事实只存在于这里（RMP_CFG MSR、退出码 −1/−2/−3/−4、GHCB 0x8000_00xx 系列、文档号表…），没有 owner 章节；同时它漏掉了 **VM_CR (C001_0114h) 与 VM_HSAVE_PA (C001_0117h)**——而 SKILL.md 明确把所有 MSR 查询路由到这里，等于 AMD-V 最常被问的两个 MSR 查不到。`Fn8000_0001_ECX[2]`（SVM 存在位，最基本的探测）同样缺席。
- **研究流程叙述被当成知识发布出去**："交叉验证已裁定"、"(跨维度洞察 3)"、"未标注 dim 的编号引自 dim12 报告"、"受页面限制未能全部抓取"、"注释为笔者所加"、"本书第 3、6、9、10 章"、图注"块高不代表字节数"（一张示意图顶替了缺失的偏移表）。bibliography 里也漏着 `(dim09 引用)`、"低质量二手来源"。
- **章节标题没有一个映射到 AMD 规范章节**，而且把结论写进标题（"STREAM ≤4.3%，Redis ≤14.1%，SNP 内存开销 2.88% vs TDX 7.86%"）——保证了标题会随数据一起腐烂。多个标题用顿号把三个不相干主题拼在一起，不可能单一归属。
- **SKILL.md 自身不可执行**：第 2 条要求把用到的每个 bibliography 条目原样抄进每个回答——单章 159 个引用时这条无法执行；其兜底条件（"读不到 bibliography 时"）描述了一个不会发生的情况。路由表把 MSR/CPUID/退出码指向 ch15，而同样的表在 ch02/03 用不同引用又存在一份。"已裁定的关键事实"是 9 条无 owner 的孤儿事实（其中 INVLPGA 勘误从未进入它所属的第 2 章）。
- **时效内容没有隔离。** 按行统计：ch12 约 21% 的行、ch13 **65%**、ch14 **74%** 携带年份/版本/SKU/市场数据（按字符加权分别是 40%/85%/95%）。它们与架构事实混在同一段落里，明年更新要改十几个文件。

### 五、不支持 Windows PC，也不支持跨 AI

- **Windows 在硬件章里零命中。** `Windows|Hyper-V|hvax64|VBS|HVCI|WSL|Sandbox|WHP|Ryzen` 在 01–07 章全部为 0。全库零命中的还有：**WSL2、Windows Sandbox、`CPUID 0x40000000` hypervisor 供应商叶、`Set-VMProcessor -ExposeVirtualizationExtensions`、DDA、GPU-P**。
- **最重要的那条 Windows 事实从未被陈述**：一旦开启 VBS/内存完整性/WSL2/沙盒/Docker Desktop，**Windows hypervisor 就占据了 `EFER.SVME`**，第三方 VMM 只能跑在 WHP 之上。第 2 章的探测链（CPUID → VM_CR.SVMDIS → EFER.SVME）在 Windows 上会给出错误答案。
- **Kernel DMA Protection 只剩一行 msinfo32 检查**，来源是一家游戏整机厂的博客；VBS/HVCI 的硬件要求引的是 **ZDNet**，而不是 Microsoft Learn。
- 第 7 章几乎整章不适用于客户端：**SR-IOV 在消费级 AM4/AM5 上不存在**，`sriov_numvfs`、EPYC + H12SSL-i、Instinct、SUSE EPYC 指南、1 GB 静态大页、整套 Proxmox/VFIO 流程都是 Linux 服务器操作。"IOMMU groups" 被当成 AMD-Vi 的架构概念呈现，实际是 Linux/VFIO 的内核构造。
- **跨 AI 支持不存在**：没有 `index.json`、没有 `agents/openai.yaml`、frontmatter 只有 `name`/`description` 两个字段、description 前 60 字符是中文（Hermes 的短描述约束下无法可靠触发）、根 `AGENTS.md` 只描述 `intel-vt`。Codex 与 Hermes 用户拿不到与 Claude Code 等同的能力。

---

## Solution

把 `amd-virtualization` 重建为**面向 Windows PC 的、以 AMD 官方规范为唯一规范性来源的、跨 AI 可加载的**知识库，方法与已完成的 `intel-vt` 重构完全一致，工具链共用：

1. **章节按 AMD 官方文档切分**，每章头部写明它映射到哪份文档的哪一章/附录，并声明自己独占哪些事实。
2. **每条事实写成一行 claim**，携带一级锚点（AMD 文档 + 章节/表号）、bibliography ID、置信度、时效性四个字段。架构章的每条断言必须有至少一条 AMD 官方来源。
3. **深度补到"能直接照着写代码"**：VMCB 逐字段偏移表、拦截位向量逐位表、退出码全表、NPT 表项位布局、AVIC 表项格式、IOMMU DTE/IRTE/命令/事件/IVRS 完整格式、SEV-SNP RMP 条目与证明报告布局。
4. **时效内容全部关进 `90-dated-landscape.md`**，带 as-of 日期；架构章保持"明年仍然为真"。
5. **Windows PC 成为一等目标**：新增 Windows 平台章（Hyper-V/VBS/HVCI/WSL2/Sandbox/WHP/嵌套/DDA/Kernel DMA Protection/反作弊检测），客户端与服务器范围逐章标注；SEV 全家按服务器范围保留全深度并在入口标明"客户端 PC 上不存在"。
6. **跨 AI**：单一源 + 最小生成物（`index.json`、`agents/openai.yaml`、双技能 `AGENTS.md`），frontmatter 只用标准字段，description 前 60 字符是能独立成立的英文触发短语。
7. **两条测试缝**：行为缝（黄金评测集，测"用了这个技能的 AI 表现如何"）+ 形式缝（零依赖 lint，确定性地拦住编造章节号与引用退化）。两条缝的工具与 `intel-vt` 共用，靠每技能一份配置区分。

---

## User Stories

### Hypervisor / 驱动开发者

1. As a hypervisor 开发者, I want VMCB 控制区 0x000–0x3FF 的逐字段偏移表, so that 我不用一边猜一边对着内核源码反推布局。
2. As a hypervisor 开发者, I want VMCB 保存区每个段描述符的独立偏移, so that 我能直接定位 FS.base 而不是面对一行 "000h–098h"。
3. As a hypervisor 开发者, I want 五组拦截向量的逐位表（含向量 4 的每一位）, so that 我设置拦截位时不必去翻 KVM 源码。
4. As a hypervisor 开发者, I want 完整的 EXITCODE 表（含 60h INTR、61h NMI、7Ah INVLPGA、0x400 NPF、−1 VMEXIT_INVALID）, so that 我解一个陌生退出码时能一步查到。
5. As a hypervisor 开发者, I want 每类退出的 EXITINFO1/EXITINFO2 布局, so that 我的退出处理器能正确解析故障信息而不是只拿到一个编号。
6. As a hypervisor 开发者, I want VMRUN 一致性检查按**现行** APM 表述给出（MBZ 规则而非 2005 年的固定掩码）, so that 我的实现不会把合法的 guest 状态判成非法。
7. As a hypervisor 开发者, I want 每条 SVM 指令的编码、操作数、特权与 `#UD`/`#GP` 触发条件, so that 我的指令封装在异常路径上也正确。
8. As a hypervisor 开发者, I want NRIP 的语义与"哪些退出会填充 NRIP、哪些情况下 NRIP 未定义", so that 我的指令跳过逻辑不会在边界情况下跑飞。
9. As a hypervisor 开发者, I want EVENTINJ 与 EXITINTINFO 的完整字段与 TYPE 编码, so that 我的事件注入与重注入路径是正确的。
10. As a hypervisor 开发者, I want NPT 各级表项的逐位布局与保留位规则, so that 我构建的嵌套页表不会静默出错。
11. As a hypervisor 开发者, I want guest 与 nested 内存类型的合并规则, so that 我在有 SME/PAT/MTRR 的机器上不会得到错误的缓存属性。
12. As a hypervisor 开发者, I want NPF 的 EXITINFO1 位定义（含 RMP/ENC/SIZEM/VMPL 的**正确**位号）, so that 我的缺页处理不会因为位号错位而误判。
13. As a hypervisor 开发者, I want ASID 分配规则、TLB_CONTROL 取值与 INVLPGA 语义（含 Genoa/Turin 勘误）, so that 我的 TLB 失效逻辑在多核与迁移场景下是正确的。
14. As a hypervisor 开发者, I want 二维页表遍历最坏 24 次访存的完整推导（含 5 级分页情形）, so that 我能量化内存虚拟化开销而不是背一个数字。
15. As a hypervisor 开发者, I want INT_CTL 的完整位定义（V_TPR/V_IRQ/V_INTR_MASKING/V_GIF/V_NMI/AVIC_ENABLE/X2AVIC）, so that 我的虚拟中断注入不会与 AVIC 打架。
16. As a hypervisor 开发者, I want AVIC backing page 布局与 Physical/Logical APIC ID Table 条目格式, so that 我能真正实现 AVIC 而不是只知道它存在。
17. As a hypervisor 开发者, I want AVIC_INCOMPLETE_IPI 的四个失败码取值与 NOACCEL 的 EXITINFO 编码, so that 我能处理 AVIC 的回退路径。
18. As a hypervisor 开发者, I want PAUSE filter/threshold、TSC ratio、LBR virtualization 的字段与使能位, so that 我能做锁竞争与时间源的调优。
19. As a hypervisor 开发者, I want VMCB clean bits 的分组定义, so that 我的状态缓存优化不会导致硬件读到陈旧字段。
20. As a hypervisor 开发者, I want 一份说明"AMD 没有 VMCS shadowing 的对应物、嵌套靠 vmcb02 构造"的嵌套章, so that 我从 Intel 侧迁移时不会去找不存在的机制。

### 设备直通 / IOMMU 开发者

21. As an IOMMU 开发者, I want 每个 MMIO 寄存器的位定义（Control/Status/EFR/EFR2/Device Table Base Size）, so that 我能直接写 IOMMU 初始化代码。
22. As an IOMMU 开发者, I want DTE 的 256 位逐位布局, so that 我能构造并解码设备表项。
23. As an IOMMU 开发者, I want host(v1) 与 guest(v2) I/O 页表项格式与 GCR3 表格式, so that 我能实现两级 I/O 转换。
24. As an IOMMU 开发者, I want 每条命令的 opcode 与字段布局, so that 我的命令缓冲区代码不必靠试错。
25. As an IOMMU 开发者, I want 事件日志条目的格式（不只是 code 列表）, so that 我能解析日志而不是只看 dmesg。
26. As an IOMMU 开发者, I want IVRS 表头、IVHD/IVMD 类型码与设备条目长度规则, so that 我能解析固件给的拓扑。
27. As an IOMMU 开发者, I want legacy 与 128-bit GA 两种 IRTE 的完整字段（含正确拼写的 `RemapEn`）, so that 我的中断重映射表是正确的。
28. As an IOMMU 开发者, I want GA log 条目格式与 GAPPI 机制, so that 我能实现 guest vAPIC 的唤醒路径。
29. As an IOMMU 开发者, I want ATS/PRI/PASID 的报文与 PPR 日志格式, so that 我能实现 SVA 相关路径。
30. As a Windows 用户, I want 明确说明 "IOMMU groups" 是 Linux/VFIO 的构造而非 AMD 架构概念, so that 我不会在 Windows 上找一个不存在的东西。

### Windows PC 用户与排障者

31. As a Windows 用户, I want 知道开启 VBS/WSL2/沙盒后 Hyper-V 占据 SVM 这一事实, so that 我能解释"为什么我的 VMM/调试器用不了 AMD-V"。
32. As a Windows 用户, I want AMD 平台的 Hyper-V 镜像与启动链（hvax64.exe、VTL0/VTL1）, so that 我的排查从正确的组件开始。
33. As a Windows 用户, I want Windows 上的嵌套虚拟化在 AMD 平台的真实状态与开启方式, so that 我不会因为一张写着 `—` 的表而放弃。
34. As a Windows 用户, I want VBS/HVCI/Credential Guard 对 AMD-V + NPT + AMD-Vi 的依赖关系, so that 我知道关掉 IOMMU 会失去什么。
35. As a Windows 用户, I want Kernel DMA Protection 的完整含义与它在消费级主板上为何常显示 Off, so that 我能判断我的机器是否真的受保护。
36. As a Windows 用户, I want 消费级 AM4/AM5 主板上 IOMMU/SVM 的 BIOS 路径与默认值, so that 我能正确开启它们。
37. As a Windows 用户, I want Windows 侧的诊断手段（PowerShell、msinfo32、事件日志、bcdedit）, so that 我不必去执行 dmesg/lspci 这些在 Windows 上不存在的命令。
38. As a Windows 用户, I want 说明 Hyper-V DDA 需要 Windows Server、客户端只有 GPU-P, so that 我不会照着服务器教程在 Win11 上做直通。
39. As a Windows 用户, I want 反作弊/hypervisor 存在性检测（`CPUID 0x40000000`、`CPUID.1:ECX[31]`）的机制说明, so that 我理解为什么开了 VBS 之后某些游戏会有反应。
40. As a Windows 用户, I want 明确告知 SEV/SEV-ES/SEV-SNP 在 Ryzen 客户端上不存在, so that 我不会去为一个不可能启用的功能折腾。
41. As a Windows 用户, I want 知道 SME/TSME（AMD Memory Guard）才是客户端能用的内存加密, so that 我的安全基线建立在真实可用的功能上。

### 安全研究者

42. As a 安全研究者, I want 一张 CVE → 架构机制 → 可部署缓解（微码版本 / SEV 固件版本 / AGESA / 内核 commit / MSR 位）的矩阵, so that 我能从漏洞直接走到修复动作。
43. As a 安全研究者, I want 瞬态执行类漏洞（SRSO/Inception、Zenbleed、Branch Type Confusion、TSA）被覆盖, so that 我的 AMD 威胁模型不缺一整个类别。
44. As a 安全研究者, I want CVE 编号、归属论文与披露日期经过核对, so that 我不会把 CVE-2024-25744 当成 SEV-SNP 漏洞写进报告。
45. As a 安全研究者, I want 区分"AMD 硬件缺陷"、"SEV 固件缺陷"与"VMM 软件缺陷", so that 我的归因是正确的。
46. As a 安全研究者, I want SKINIT/DRTM 的规范级描述及其与 Windows System Guard Secure Launch 的对应, so that 我能评估客户端的信任根。

### 机密计算开发者（服务器范围）

47. As a 机密计算开发者, I want `Fn8000_001F` 全部字段与 `SEV_STATUS` 全部位, so that 我能正确探测 SEV/SEV-ES/SNP 及其子特性。
48. As a 机密计算开发者, I want GHCB 的完整字段偏移表与 valid_bitmap 索引规则, so that 我能实现 `#VC` 处理器。
49. As a 机密计算开发者, I want 完整的 NAE 事件列表与每个事件所需的寄存器集, so that 我的 VMGEXIT 路径不会漏字段。
50. As a 机密计算开发者, I want RMP 条目的逐字段布局与每类访问的 RMP 检查规则, so that 我理解 SNP 的内存所有权模型。
51. As a 机密计算开发者, I want PVALIDATE/RMPADJUST/RMPUPDATE/PSMASH/RMPREAD 的操作数、标志与错误码, so that 我的页状态转换代码是正确的。
52. As a 机密计算开发者, I want ATTESTATION_REPORT 的逐字段偏移与 TCB_VERSION 编码, so that 我能实现验证方而不是照抄别人的解析器。
53. As a 机密计算开发者, I want SVSM 的调用约定、Calling Area 与结果码, so that 我能在 VMPL0 上实现服务。
54. As a 机密计算开发者, I want VCEK/VLEK 派生与 KDS 证书链的规范描述, so that 我的证明链验证是完整的。

### 性能工程师

55. As a 性能工程师, I want 每个性能数字都带微架构、hypervisor 版本、benchmark 与年份, so that 我不会把 2008 年 Barcelona 的数字当成现代平台的值。
56. As a 性能工程师, I want 冲突的测量并列呈现并说明差异来源, so that 我能判断哪个数适用于我的场景。
57. As a 性能工程师, I want 厂商营销数字以归属语气陈述, so that 我不会把 "+23%" 当成一次可复现的测量。
58. As a 性能工程师, I want Windows PC 上的开销（VBS/HVCI、WSL2、第三方 VMM 跑在 WHP 上 vs 裸 SVM）, so that 我评估的是我这台机器的代价。

### 使用技能的 agent 自身

59. As an AI agent, I want 路由表精确到章节而不只是文件, so that 回答一个 VMCB 字段问题不必加载整章。
60. As an AI agent, I want 明确的停止规则, so that 我不会为一个简单问题耗尽上下文。
61. As an AI agent, I want 技能规定的引用锚点与文件中真实存在的锚点一致, so that 我不必编造章节号。
62. As an AI agent, I want 每条事实带 Confidence 与 Volatility, so that 我能决定直接引用还是提示复核。
63. As an AI agent, I want 每条事实有唯一 owner 文件, so that 我不会读到同一事实的四个互相矛盾的版本。
64. As an AI agent, I want 一条可执行的引用输出规则, so that 我不会被要求把 159 条 bibliography 原样抄进一个回答。
65. As an AI agent, I want `amd-virtualization` 与 `intel-vt` 之间明确的消歧规则, so that 一个对比类问题不会同时触发两个技能。
66. As an AI agent, I want 速查文件只做导航不存事实, so that 我不会在两处读到漂移的数值。

### 跨 AI 与维护

67. As a Codex 用户, I want 技能能被 Codex 的 skills 机制发现, so that 我在 Codex 里得到和 Claude Code 里一样的能力。
68. As a Hermes 用户, I want description 前 60 字符是能独立成立的英文触发短语, so that 在短描述约束下技能仍能被正确触发。
69. As a 任意 agent 的用户, I want 一份机器可读的 `index.json`, so that 没有 glob 能力的 agent 也能定位章节。
70. As a 维护者, I want 两个技能共用同一套 lint 与 build, so that 标准不会随时间分叉。
71. As a 维护者, I want 生成物与源之间有漂移校验, so that 三个入口不会互相矛盾。
72. As a 维护者, I want 一个可重复运行的黄金评测集, so that 我改完内容后能验证"是否仍然精通"而不是凭感觉。
73. As a 维护者, I want 时效内容集中在一个文件, so that 明年更新时我只改一个文件。
74. As a 维护者, I want 被拉黑的来源域名进入 lint 规则, so that CSDN/论坛/术语农场/盗版镜像不会再次成为架构断言的出处。

---

## Implementation Decisions

### D1. 章节结构对齐 AMD 官方文档

参考文件改为 `NN-topic.md`，每章映射到 AMD 官方文档的一章或一组小节：

| 新文件 | 官方规范锚点 | 范围 |
|---|---|---|
| `00-quickref.md` | 无（纯导航） | 文档号索引、症状→章节路由、表格归属、中英术语对照、Windows PC 五问 |
| `01-svm-intro.md` | APM Vol.2 SVM 章的启用/模式节 + SVM 相关 MSR 节；CPUID `Fn8000_0001`/`Fn8000_000A` | 两种操作模式、EFER.SVME、VM_CR、VM_HSAVE_PA、SVM_KEY、CPUID 全位表、启用失败的判定链 |
| `02-vmcb.md` | APM Vol.2 **VMCB 布局附录** | 控制区与保存区逐字段偏移表、clean bits 分组、VMCB 状态缓存 |
| `03-intercepts.md` | APM Vol.2 拦截相关小节 | 五组拦截向量逐位表、IOPM/MSRPM 布局、PAUSE filter/threshold、TSC ratio、LBR virtualization |
| `04-world-switch.md` | APM Vol.2 VMRUN/#VMEXIT 小节 + **APM Vol.3 指令页** | VMRUN/#VMEXIT 流程与一致性检查、VMLOAD/VMSAVE、GIF/STGI/CLGI、VMMCALL、INVLPGA、逐指令异常条件 |
| `05-exit-decoding.md` | APM Vol.2 **退出码附录** | EXITCODE 全表、EXITINFO1/2 逐事件布局、NRIP、Decode Assist、EVENTINJ/EXITINTINFO |
| `06-nested-paging.md` | APM Vol.2 嵌套分页节 + Vol.2 分页章 | nCR3/NP_ENABLE、表项位布局、二维遍历与 24 次推导、NPF、内存类型合并、ASID/TLB_CONTROL/INVLPGA 与其勘误 |
| `07-virtual-interrupts-avic.md` | APM Vol.2 虚拟中断节 + GIF 节 + AVIC 节 | INT_CTL 全位、虚拟中断评估与投递、vGIF、AVIC/x2AVIC 全机制、doorbell MSR、AVIC 退出 |
| `08-iommu-architecture.md` | #48882 Ch.1–2 + §3.4 | **"硬件此刻在做什么"**：Zen 平台数据通路、MMIO 寄存器逐位、Status Register、PCI 能力块、DTE 的**转换侧**字段、**事件/PPR/GA 日志的条目格式** |
| `09-iommu-page-tables.md` | #48882 §2.2.3/.6/.7 + §2.4 + §5 | **"我要建的表"**：v1 与 v2 页表、GCR3、命令 opcode 与格式、IVRS 解析，外加一节**端到端解一个 `IO_PAGE_FAULT`** |
| `10-iommu-interrupt-remapping.md` | #48882 §2.2.5（+ DTE 中断簇） | **自足的中断重映射章**：legacy 与 128-bit GA IRTE、`RemapEn`、**DTE 的中断簇**（`IV`/`IntTabLen`/`IntCtl`/Interrupt Table Root Pointer/各 Pass 位）、`INVALIDATE_INTERRUPT_TABLE`、GA log 语义、GAPPI、ATS/PRI/PASID |
| `11-memory-encryption.md` | APM Vol.2 内存加密节 + AMD Memory Encryption 白皮书 | **客户端范围**：SME/TSME（AMD Memory Guard）、C-bit、`Fn8000_001F` 全字段、SYSCFG、物理地址位缩减、AMD-SP |
| `12-sev.md` | **#55766** | **服务器范围**：SEV 启用、ASID↔密钥绑定与复用协议、平台/guest 状态机、固件命令全表、guest policy、启动度量 |
| `13-sev-es-ghcb.md` | **#56421** + APM Vol.2 SEV-ES 节 | **服务器范围**：VMSA、`#VC`、GHCB 字段偏移全表、MSR 协议、NAE 全表、AP 启动 |
| `14-sev-snp.md` | APM Vol.2 SNP 节 + **#56860** + #58019 + #57230/#58369 | **服务器范围**：RMP 条目与检查规则、页状态机、SNP 指令语义与错误码、VMPL、Restricted/Alternate Injection、固件命令、ATTESTATION_REPORT、SVSM、VCEK/VLEK/KDS |
| `15-nested-virtualization.md` | APM Vol.2（无 VMCS-shadowing 对应物）+ 内核一手源 | vmcb12/vmcb02 构造、nested NPT、拦截合并、Windows 上的嵌套（WHP/Hyper-V） |
| `16-windows-platform.md` | Microsoft Learn（T2） | Hyper-V on AMD（hvax64、VTL0/VTL1、启动链）、VBS/HVCI/Credential Guard、WSL2/Sandbox/Docker Desktop、WHP、嵌套开启、DDA vs GPU-P、Kernel DMA Protection、AM4/AM5 BIOS、hypervisor 检测与反作弊 |
| `17-security.md` | AMD 安全公告 + APM Vol.2 SKINIT 节 | CVE→缓解矩阵（含瞬态执行类）、攻击面分类、SKINIT/DRTM 与 System Guard |
| `18-performance.md` | 测量文献（T2，强制带条件） | Windows PC 开销为主：VBS/HVCI、WSL2、WHP vs 裸 SVM、嵌套、NPT/大页 |
| `19-comparison-intel-arm-riscv.md` | Intel SDM / ARM ARM / RISC-V H-ext | 架构对照；与 `intel-vt/18` 互为镜像，标注哪些是服务器专属 |
| `90-dated-landscape.md` | — | **时效隔离区**，as-of 标注 |
| `errata.md` | — | 讹传勘误，每条自带出处 |
| `bibliography.md` | — | 全局 `[N]` 引用 ID 空间 |

架构章 = **`01`–`14`**（每条断言必须有 T1 锚点）；`15`–`19` 允许以 T2 为主；`90` 是唯一允许 `V:dated` 的文件。

> **`15-nested-virtualization.md` 为什么不在架构带内**（复检裁决）：它的规范性内容只有 APM §15.33 一节，其余是内核与 Windows 的 T2 事实；留在"每条断言必须有 T1"的带内会让该章的 lint 永远无法通过。它进 T2 允许带，但附加一条 review 要求：**凡 APM §15.33 覆盖的机制仍必须带 `[APM2 §15.33]` 锚点**。

> **不设 `core-facts.md`**（复检裁决）：它与 `00-quickref.md` 干同一件事，而"两个导航文件"正是旧版 `15-appendix-quickref.md` 漂移成第二事实库的那个缝。导航职责全部归 `00-quickref.md`。这与 `intel-vt`（两个都有，且其 `core-facts.md` 含 54 条 claim 行）**有意不对称**。

### D2. 已核验的 AMD 官方文档基线

**核验方法（2026-09-20）**：逐份从 `docs.amd.com` 下载 PDF 本体，读封面版本行 + **PDF 书签树**。标 **VERIFIED** 的条目为实际读取所得；标 UNVERIFIED 的必须由首次引用者自行核对。

**先记住这条基础设施事实**：AMD 已把处理器文档迁出 `www.amd.com/content/dam/...`。旧技能与全网（含 LKML、OSDev）引用的 `.../processor-tech-docs/programmer-references/24593.pdf` 现在返回 **404**；`.../epyc-technical-docs/.../55766_*.pdf` **302 跳到只有 JS 的门户壳**——naive 下载器会把一个 2,575 字节的 HTML 存成 `.pdf` 并报告成功。canonical URL 现在是 `https://docs.amd.com/go/en-US/<slug>`；`www.amd.com` 还要求浏览器 User-Agent，默认 curl UA 会连接超时（不是 403）。

#### 文档基线表

| 文档 | Pub | 修订 | 日期 | 状态 |
|---|---|---|---|---|
| APM **Vol.2** System Programming | **24593** | **3.45** | **2026-07** | VERIFIED |
| APM **Vol.3** General-Purpose and System Instructions | **24594** | **3.38** | **2026-07** | VERIFIED |
| APM Vol.1 Application Programming | 24592 | 3.25 | 2026-05 | VERIFIED |
| APM Vol.4 / Vol.5 | 26568 / 26569 | 3.27 / 3.16 | 2026-07 / **2021-11** | VERIFIED（Vol.5 已五年未修订） |
| APM Vols 1–5 合订 | 40332 | 4.10 | 2026-07 | VERIFIED |
| **IOMMU Specification** | **48882-PUB** | **3.11** | **2026-04** | VERIFIED |
| **SEV-SNP Firmware ABI Specification** | **56860** | **1.59** | **2026-08** | VERIFIED |
| **SEV-ES GHCB Standardization** | **56421** | **2.04** | **2025-01** | VERIFIED |
| Secure Encrypted Virtualization API | **55766** | **3.24** | **2020-04** | VERIFIED（封面另写 "API Version 0.24 / Technical Preview"——引用时用**出版修订 3.24**） |
| SVSM Guest Communication Interface | **58019** | **1.01** | **2026-03** | VERIFIED |
| SEV-TIO Firmware Interface | 58271 | 0.92 | 2026-08 | VERIFIED（索引） |
| SEV-SNP 白皮书 | **70366** | 无修订号 | **2020-01** | VERIFIED —— **非规范性**，封面自带"目标而非承诺"免责声明 |
| 安全公告索引 | — | — | — | VERIFIED |

URL：`https://docs.amd.com/go/en-US/` + `24593_3.45_APM_Vol2_PUB` · `24594_3.38_APM_Vol3_PUB` · `24592_3.25_APM_Vol1_PUB` · `48882_3.11_IOMMU_PUB` · `56860_PUB_SEV_SNP` · `56421` · `55766_PUB_3.24_SEV_API` · `58019.pdf` · `58271_PUB_SEV-TIO`。安全公告索引：`https://www.amd.com/en/resources/product-security.html`，单条为 `https://www.amd.com/en/resources/product-security/bulletin/amd-sb-NNNN.html`。

#### APM Vol.2（24593 Rev 3.45）结构（书签树核验）

19 章 + 附录 A–E。Ch.15 = **Secure Virtual Machine**；**App A MSR Cross-Reference · App B VMCB Layout（含 B.1 Guest MSR Intercepts）· App C SVM Intercept Exit Codes · App D SMM Containerization · App E OS-Visible Workarounds**。

Ch.15 已核验的小节号，**可直接引用**：

| 小节 | 标题 | 归属章节 |
|---|---|---|
| §15.4 | Enabling SVM（EFER.SVME） | `01` |
| §15.5 / §15.6 | VMRUN（15.5.1 Basic Operation、15.5.2 VMSAVE and VMLOAD）/ #VMEXIT | `04` |
| §15.7–§15.14 | Intercept Operation · Decode Assists · Instruction · IOIO · MSR · Exception · Interrupt · Miscellaneous（**15.14.4 Pause Intercept Filtering**、15.14.5 Bus Lock Threshold） | `03` |
| §15.15 | VMCB State Caching | `02` |
| §15.16 | TLB Control（15.16.1 TLB Flush、15.16.2 Invalidate Page, Alternate ASID） | `06` |
| §15.17 | Global Interrupt Flag, STGI and CLGI Instructions | `04` / `07` |
| §15.25 | Nested Paging（15.25.1–15.25.9） | `06` |
| §15.27 | Secure Startup with SKINIT（15.27.1–15.27.8） | `17` |
| §15.29 | Advanced Virtual Interrupt Controller（15.29.1–15.29.10，**15.29.10 x2AVIC**） | `07` |
| §15.30 | SVM Related MSRs | `01` |
| §15.33 | Nested Virtualization | `15` |
| §15.34 | SEV（…15.34.9 Page Flush MSR、**15.34.10 SEV_STATUS MSR**、15.34.11 Virtual Transparent Encryption） | `11` / `12` |
| §15.35 | SEV-ES（15.35.5 #VC Exception、15.35.6 VMGEXIT、15.35.7 GHCB、15.35.9 Automatic Exits） | `13` |
| §15.36 | SEV-SNP，23 个子节（15.36.3 Reverse Map Table · .4 Initializing the RMP · .5 Hypervisor RMP Management · .6 页验证 · **.7 Virtual Machine Privilege Levels** · .8 vTOM · .10 RMP+VMPL 访问检查 · .18 Secure TSC · .21 Secure AVIC · .22 Segmented RMP · .23 Guest Intercept Control） | `14` |
| §15.37 / §15.38 / §15.39 | Speculation Control Virtualization / IBS Virtualization / PMC Virtualization | `17` / `03` |

#### APM Vol.3（24594 Rev 3.38）

Ch.1 Instruction Encoding · Ch.2 Instruction Overview · Ch.3 General-Purpose Instruction Reference · **Ch.4 System Instruction Reference** · App A–F（**App E = CPUID**）。

- **Ch.4 的指令条目按字母排序，只有页码、没有小节号。** 锚点写 `[APM3 §4 "VMRUN"]`；**`[APM3 §4.7.2 VMRUN]` 是编造。**
- 已核验页码（Rev 3.38）：CLGI 382 · INVLPGA 396 · PSMASH 432 · PVALIDATE 435 · RMPADJUST 447 · RMPQUERY 451 · RMPREAD 454 · RMPUPDATE 457 · SKINIT 472 · STGI 480 · VMLOAD 500 · VMMCALL 502 · VMGEXIT 502 · VMRUN 503 · VMSAVE 508。
- **纠正一个常见预设**：六条 SNP 指令（PVALIDATE / RMPADJUST / RMPUPDATE / PSMASH / RMPQUERY / RMPREAD）**全部在 Vol.3 Ch.4**，不在 Vol.2、不在附录。Vol.2 §15.36 讲架构，Vol.3 Ch.4 才是规范性指令参考。

#### IOMMU（48882-PUB Rev 3.11）

**只有 5 章，没有任何附录**：Preface · 1 IOMMU Overview · 2 Architecture · 3 Registers · 4 Implementation Considerations · 5 I/O Virtualization ACPI Table · Index to Registers。

已核验位置：**DTE → §2.2.2**（Figure 7 "Device Table Entry (DTE) Fields"）· host I/O 页表 → **§2.2.3** · guest → **§2.2.6** · guest/nested → **§2.2.7** · **IRTE → §2.2.5 Interrupt Remapping Tables** · **命令 → §2.4**（2.4.1 COMPLETION_WAIT … 2.4.8 INVALIDATE_IOMMU_ALL、2.4.9 INSERT_GUEST_EVENT、2.4.10 RESET_VMMIO、2.4.11 Ordering Rules）· **事件日志码 → §2.5**（2.5.2 ILLEGAL_DEV_TABLE_ENTRY … 2.5.14 RMP_PAGE_FAULT、2.5.15 RMP_HARDWARE_ERROR）· **MMIO 寄存器 → §3.4**（能力块 §3.2/§3.3、VF 控制 §3.5/§3.6）· **ACPI IVRS → §5.2**，IVHD/设备树 → **§5.3**。另有 §2.10 vIOMMU · §2.12 IOMMU SEV-SNP Support · §2.14 SEV-TIO。

**`[IOMMU … App.x]` 是编造——该规范没有附录。**

#### 56860 / 56421 / 55766 / 58019 结构

- **56860 Rev 1.59**：Ch1 Introduction · **Ch2 Data Structures and Encodings**（2.1 MDATA、2.2 VCEK、**2.3 TCB_VERSION**、2.4 ETCB_VERSION、2.5 PADDR_INVALID、2.6 TPM_INFO）· Ch3 Platform Management（3.4 Reported TCB、3.9 Extended TCB）· Ch4 Guest Management · Ch5 Page Management · Ch6 Mailbox Protocol（6.1 Command Identifier、6.2 Status Codes）· **Ch7 Guest Messages**（7.1 CPUID Reporting、7.2 Key Derivation、**7.3 Attestation**、7.4 VM Export…7.11 Get TPM Info）· **Ch8 Command Reference**（8.1 DOWNLOAD_FIRMWARE、8.2 …_EX、8.3 SNP_COMMIT、8.4 GET_ID、8.5 SNP_PLATFORM_STATUS、8.6 …_EX、8.7 SNP_CONFIG…）· **App A 常用算法 · App B 数字签名 · App C CSVCEK 证书链 · App D CSR**。
  **ATTESTATION_REPORT 的布局是 §7.3 中的 Table 27**，不是小节号。TCB_VERSION 按产品分表：Table 3 (Venice)、Table 4 (Turin)、Table 5 (Genoa/Milan)；ETCB_VERSION Table 6 (Venice)。
- **56421 Rev 2.04**：1 Introduction · **2 GHCB**（2.1 Version 2 变更、2.2 Hypervisor Feature Support、2.3 Establishing the GHCB（**2.3.1 GHCB MSR Protocol**、2.3.2 GHCB GPA Registration）、2.4 协商示例、2.5 GHCB/VMGEXIT 示例、**2.6 GHCB Layout**、2.7 SNP Secrets Page、2.8 CC Blob EFI Protocol）· **3 Guest Exits**（3.1 Automatic Exits、**3.2 Non-Automatic Exits**）· **4 GHCB Protocol**（4.1 Invoking VMGEXIT、4.2 Guest Identification、4.3 SMP Booting、4.4 NMIs、4.5 Debug Register、4.6 SMM、4.7 Nested Virtualization）· **5 SNP Restricted Injection**（5.1–5.5）。无附录。
- **55766 Rev 3.24**：Ch1 Overview · Ch2 Key Management · Ch3 Guest Policy · Ch4 Mailbox Register Protocol（4.4 Command Identifiers、4.5 Status Codes）· **Ch5 Platform Management API**（5.2 INIT…5.15 RING_BUFFER）· **Ch6 Guest Management API**（6.2 LAUNCH_START…6.8 ATTESTATON〔AMD 原文拼写如此〕…6.11 SEND_UPDATE_VMSA）。**只覆盖 SEV/SEV-ES；SNP 在 56860。**
- **58019 Rev 1.01**：1 Abstract · 2 Scope · 3 Environment · **4 Discovery**（4.1 Boot、4.2 Post-Boot）· **5 Calling Convention** · **6 Core Protocol**（6.2 SVSM_CORE_REMAP_CA…6.9 SVSM_CORE_CONFIGURE_VTOM）· **7 Attestation Protocol** · **8 vTPM Protocol** · **9 APIC Emulation Protocol** · **10 UEFI Management Mode Protocol**。COCONUT-SVSM 是**实现**不是规范，不得作为架构出处。

#### 锚点语法（按核验结果定稿）

| 文档 | 锚点写法 | 示例 |
|---|---|---|
| APM Vol.2 | `[APM2 §<sec>]` / `[APM2 Ch.15]` / `[APM2 App.B]` / `[APM2 App.C]` | `[APM2 §15.14.4]` |
| APM Vol.3 | `[APM3 §4 "<MNEMONIC>"]`（**指令名，不是小节号**） | `[APM3 §4 "PVALIDATE"]` |
| APM Vol.1/4/5 | `[APM1 §x.y]` / `[APM4 …]` / `[APM5 …]` | — |
| IOMMU | `[IOMMU 3.11 §<sec>]`（**修订号必须写进锚点；永远没有 `App.`**） | `[IOMMU 3.11 §2.2.2]` |
| SNP ABI | `[SNP-ABI 1.59 §<sec>]` / `[SNP-ABI 1.59 Table <n>]` / `[SNP-ABI 1.59 App.C]` | `[SNP-ABI 1.59 Table 27]` |
| GHCB | `[GHCB 2.04 §<sec>]` | `[GHCB 2.04 §2.6]` |
| SEV API | `[SEV-API 3.24 §<sec>]` | `[SEV-API 3.24 §6.1]` |
| SVSM | `[SVSM 1.01 §<sec>]` | `[SVSM 1.01 §5]` |
| 白皮书 | `[SNP-WP 70366 p.<n>]`（**非规范，不得作为位级事实的唯一出处**） | — |
| PPR | `[PPR <pub>-<rev> §x]` | UNVERIFIED |
| 安全公告 | `[AMD-SB-<nnnn>]` | `[AMD-SB-3028]` |

规则：**带修订号的文档（IOMMU / SNP-ABI / GHCB / SEV-API / SVSM）把修订号写进锚点**，因为它们的编号会动；APM Vol.2 的章节号稳定，可以省略修订号，但附录必须写**字母**。

#### 三条与 Intel 侧相反的结论（直接改变风险判断）

1. **APM 的 SVM 章节号是稳定的，不是被重编过的。** 比对 Rev 3.30（2018-09）与 Rev 3.45（2026-07）的书签树：**§15.1–§15.35 的编号与标题八年未变**；新内容一律追加（§15.36 SEV-SNP、§15.37–§15.39，以及 15.29.10、15.34.10/.11、15.36.10–.23 这些子节）。附录字母 A–E 未变，App B 只改了标题（"Layout of VMCB" → "VMCB Layout"）。章级新增了 18 Shadow Stacks 与 19 PQOS。**这与 Intel SDM 把 VMX 章重编到"旧章节已不存在"的情况相反。** 因此 AMD 侧的真实风险不是编号过时，而是**编造新近子节**与**给 Vol.3 指令安上小节号**。
2. **AMD 没有 Intel "SDM Documentation Changes" 那样的文档勘误通道。** APM 的更正静默并入下一修订，唯一记录是卷内 Revision History 表（Vol.2 页 xxxvi–xlviii；已核验历史：3.45 2026-07 · 3.44 2026-03 · 3.43 2025-06 · 3.42 2024-03 · … · 3.38 2022-11）。最接近的是按家族的 **Revision Guide**（**硅**错误，不是文档错误）：58251（Fam 1Ah 00h–0Fh，Rev 1.30，2025-07）、58730（1Ah 10h–1Fh）、57095（19h 10h–1Fh，Rev 1.05，2025-11）、57926（19h A0h）、55449、56323。**全部是 EPYC/服务器件；客户端 Ryzen（Vermeer/Raphael/Phoenix/Strix）没有公开修订指南。** 因此 CVE 与勘误锚定必须走 **AMD-SB 公告索引**，而不是某个"文档变更"文件。
3. **客户端 Ryzen 没有公开 PPR。** 公开 PPR 仅 56569（Cezanne）、57019（Phoenix）、57930（1Ah 70h）、57883（1Ah 11h）与若干 EPYC；**Family 19h Model 21h（Vermeer）与 61h（Raphael / Ryzen 7000 桌面）无公开 PPR**。第三方站点流传的 **56713 不在 AMD 公开索引内，不得引用**。PPR 以 `.zip` 分发。SVM 相关 MSR 的更好锚点是 **APM Vol.2 §15.30 + App A**。

#### 元数据陷阱（写进 CONVENTIONS 与 lint）

1. **56860 同时在线于两个修订**：`www.amd.com/content/dam/.../56860.pdf` 返回 **Rev 1.58（2025-05）**，`docs.amd.com` 返回 **Rev 1.59（2026-08）**，两者都是 HTTP 200。抓错源就静默拿到落后 15 个月的 ABI。
2. **IOMMU 到处都写 Rev 3.10（2025-02）**——AMD 门户列表、搜索结果、2026-01 的 LKML 补丁——**而 PDF 封面是 Rev 3.11（2026-04）**。以封面为准（与 Intel 侧 VT-d 落地页陈旧是同一类陷阱）。
3. **dam 链接大批失效**：24592/24593/24594/26568/26569/40332 的 `processor-tech-docs` 路径全部 404；55766 与白皮书路径 302 到 JS 壳并返回 `text/html`。每次抓取必须同时验证 `Content-Type: application/pdf` **与** 文件头 `%PDF`。
4. **带修订号的 pretty-URL 会在下次发布时失效**（`24593_3.45_APM_Vol2_PUB`、`48882_3.11_IOMMU_PUB`）；`56860_PUB_SEV_SNP`、`56421`、`58019.pdf`、`58271_PUB_SEV-TIO` 是修订无关的稳定 slug，优先用后者。已有一批被搜索引擎索引的旧 slug（`24594_3.37`、`48882_IOMMU`、`40332_4.09_APM_PUB`）已经死链。
5. **不要用 `pdftotext -layout` 解析 AMD 的 TOC**——双栏排版会把小节号与相邻条目错配，产出"看着很像真的"的假配对（核验过程中它一度把 Vol.3 的附录列成 "App A SYSEXIT / App B VMLOAD / B.3 VMRUN"）。**只信 PDF 书签树**，正文标题次之。

#### 仍未核验（首次引用者负责回填）

- APM Vol.2 中**虚拟中断小节**（INT_CTL / V_TPR / V_IRQ / V_INTR_MASKING 所属节）的编号——票 07 必须自行核对，或降级到 `[APM2 Ch.15]`。
- APM Vol.2 中 **SME/TSME 所属子节**的编号（§15.34 的前几个子节或 Ch.7 Memory System）——票 09 负责。
- PPR 内部小节结构（`.zip` 未解压）。
- AMD-SB 编号分段（1xxx 客户端 / 3xxx 服务器与 SEV / 6xxx 显卡 / 7xxx CPU 架构 / 9xxx 管理工具）为观察所得，AMD 未公开说明，**不得作为规则写进文档**。

### D3. Claim 记录 schema 与锚点语法

与 `intel-vt` 逐字一致的行内 schema（工具共用的前提）：

```
- **Claim.** <断言正文>  `[APM2 §15.25.6]` `[7]` `C:high` `V:durable`
```

字段顺序固定：一级锚点 → bibliography ID → 置信度 → 时效性。

- **一级锚点**：`01`–`15` 章的架构断言**必填**，语法见 D2 基线表。AMD 的关键布局大量以**表**编号（VMCB 布局表、退出码表、DTE 表），因此锚点语法必须同时接受 `§x.y`、`Ch.N`、`App.X`、`Table X-N` 四种形式。
- **`[N]`**：bibliography ID，至少一个。
- **`C:`**：`high` | `medium` | `low`（只用英文）。
- **`V:`**：`durable` | `dated`；`V:dated` **只允许**出现在 `90-dated-landscape.md`。

叙述性散文不需要 claim 行，但**任何具体的数值、位号、偏移、编码、日期、CVE 编号、产品名都必须落在某条 claim 行里**。

**绝对禁止编造章节号。** 这是本次重构最大的风险，但 **AMD 侧的风险形态与 Intel 侧相反**（见 D2 的"三条相反结论"第 1 条）：APM 的 §15.1–§15.35 八年未重编，**编号过时不是主要威胁**。真正的威胁是三种编造：(a) 凭印象写**新近子节**——§15.36 SEV-SNP、§15.37–§15.39 以及各 `.10+` 子节都是近年追加的，最容易被写成"一直存在"；(b) **给 APM Vol.3 的指令安上小节号**——Ch.4 按字母排序，只有页码，`[APM3 §4.7.2 VMRUN]` 是纯虚构；(c) **给 IOMMU 规范安上附录**——它只有 5 章、零附录，IVRS 在 §5.2。此外，旧资料（2005 年的 33047、2007 年的 IOMMU 34434 Rev 1.20、各类 PDF 镜像与中文译文）的编号体系与现行文档不对应，一律作废。规则：
1. 只写实际核对过的编号（WebFetch 真实 PDF，或引用 D2 已核验清单）。
2. 核对不了就降级到章/附录级（写 `[APM2 App.B]` 而不是猜一个表号）。
3. 连这一级都不确定：写 `[APM2 Ch.?]` 并置 `C:low`，由 lint 标出待人工处理，**不要删掉锚点假装它是二级事实**。

### D4. 来源分级与黑名单

- **Tier 1 规范性**：APM Vol.1/2/3、IOMMU 规范 #48882、SEV 文档集（#55766 / #56421 / #56860 / #57230 / #58019 / #58369）、PPR、AMD 安全公告（AMD-SB-xxxx）、AMD 修订指南。
- **Tier 2 佐证**：kernel.org / LKML / lore / 同行评议论文 / 厂商官方文档（**Microsoft Learn**、VMware 官方 KB、Intel SDM、ARM ARM、RISC-V 规范、PCI-SIG 规范）。
- **Tier 3 背景**：博客、新闻、营销材料。

规则：
- `01`–`15` 的每条架构断言**必须**至少一条 T1。
- T3 **永不得**作为架构断言的唯一出处，且必须以归属语气陈述（"AMD 称…"/"据 XX 报道"）。
- **Windows 事实一律直接引用 Microsoft Learn 作为 T2**，不引 ZDNet/Dell KB/整机厂博客。
- **旧版中的以下来源一律作废**（lint 强制）：`vlsiworlds.com`、`icode.best`、`deepwiki.com`、`termbasehub.com`、`strix.ai`、`baike.baidu.com`、`blog.csdn.net`、`cnblogs.com`、`juejin.cn`、`zhihu.com`、`unknowncheats.me`、`wiki.osdev.org`、`historytools.org`、`dinajpuritpark.com`、`voltagegpu.com`、`ts2.tech`、`paragmali.com`、`oneuptime.com`、`govindhtech.com`、`westloop.io`、`pronteff.com`、`sunnycloud.jp`、`ortechy.com`、`realtyme.com`、`thetechylife.com`、`dellenny.com`、`advancedhosting.com`、`cms.globalmusicreport.ifpi.org`、`0x04.net`、NCSA/Stanford/Northwestern 的 APM 镜像、以及任何 `*.wordpress.com` 上的 AMD PDF 副本。对应断言重新锚定到 T1，锚不上就删。
- **33047（2005 SVM 手册）与 34434 Rev 1.20（2007 IOMMU）只能用于历史陈述**，不得作为现行架构断言的出处。

### D5. 事实归属（owner）

每条事实只有一个 owner 文件，其他文件**交叉引用而不复述**：

| 主题 | owner |
|---|---|
| EFER.SVME / VM_CR / VM_HSAVE_PA / SVM_KEY / CPUID `Fn8000_0001`·`Fn8000_000A` 全位表 | `01` |
| VMCB 字段偏移（控制区 + 保存区）/ **段属性 12 位打包编码与 CPL 来源** / clean bits **及其与嵌套分页·ASID 的交互** / CET 字段 | `02` |
| 拦截向量位号与**拦截优先级/顺序** / IOPM / MSRPM / PAUSE filter / Bus Lock Threshold / IdleHlt / TSC ratio 与合成规则 / LBR virt / **PMU·IBS 虚拟化** / 调试寄存器虚拟化 / CET·影子栈机制 / SMI 拦截 | `03` |
| VMRUN·#VMEXIT 流程 / 一致性检查（含**否定清单**）/ SVM 指令语义与异常 / **GIF·STGI·CLGI 指令侧** / **VLS 语义** / INIT·SIPI 与 `#SX` / MCOMMIT / `VM_HSAVE_PA` 的"不得读取"契约 | `04` |
| EXITCODE 表 / **EXITINFO1·2 全部位表（含 `#NPF` 的 31/34/35/36）** / NRIP / Decode Assist / EVENTINJ / EXITINTINFO / `INT_STATE` 中断影子 | `05` |
| NPT 表项 / 二维遍历 / **NPF 的语义与处理流程**（位表在 `05`）/ 内存类型合并 / ASID 与耗尽回收 / TLB_CONTROL / INVLPGA / GMET / NPT 关闭时的影子分页 | `06` |
| INT_CTL 位 / 虚拟中断投递（消费 `05` 的 `INT_STATE`）/ **vGIF 机制侧** / AVIC / x2AVIC / doorbell | `07` |
| IOMMU 寄存器 / DTE 转换侧字段 / 事件·PPR·GA 日志**条目格式** / 分段 Device Table / 请求类型路由 | `08` |
| I/O 页表 / GCR3 / 命令 / IVRS / `IO_PAGE_FAULT` 端到端解码（**日志条目格式在 `08`**） | `09` |
| IRTE 两种格式 / **DTE 中断簇** / GA log **格式与语义** / GAPPI / ATS·PRI·PASID | `10` |
| SME / TSME / C-bit 与其缓存一致性冲刷规则 / **`Fn8000_001F` 全部字段（含 EAX[4]）** / SYSCFG | `11` |
| SEV 密钥层次 / ASID 绑定 / 固件命令 / guest policy / **`SEV_STATUS` (C001_0131h) 全部位** / **SEV·SNP 威胁模型陈述** | `12` |
| VMSA / `#VC` / GHCB / NAE / VMGEXIT | `13` |
| RMP（含粒度约束与 TLB 影响）/ VMPL / SNP 指令 / SNP 固件命令 / 证明报告 / SNP CPUID page / vTOM / Secure TSC / Secure AVIC / SVSM（含 APIC 仿真协议）/ VCEK·VLEK | `14` |
| 嵌套 SVM 机制 | `15` |
| Hyper-V / VBS / HVCI / WSL2 / WHP / DDA / Kernel DMA Protection | `16` |
| CVE→缓解矩阵（§17.1）/ SKINIT·DRTM（§17.2，两个独立 `Owns:` 条目）/ APM 附录 D SMM Containerization / **勘误驱动的特性屏蔽纪律** | `17` |
| 性能数字 | `18` |
| Intel/ARM/RISC-V 对照 | `19` |
| 云实例、GA 日期、市场份额、路线图、内核/固件版本 | `90` |

`00-quickref.md` 与 `core-facts.md` 是**导航层，不存任何权威数值**——只给"这个表在哪一章"。这直接修掉现状里"速查表成为第二事实库且与 owner 章漂移"的问题。

> **与 `intel-vt` 的一处有意分歧（复检发现）**：Intel 技能的 `core-facts.md` 现有 **54 条 claim 行**——它把 core-facts 当作带引用的事实层，而不是纯索引。AMD 侧采用更严的口径。因此"导航文件不得含 claim 行"这条 lint 规则**必须做成每技能可开关的配置项**（`claimFreeFiles`）；一旦对 Intel 生效，`intel-vt` 会从 lint clean 变成 54 个 error，而重写 Intel 的 core-facts 明确在 Out of Scope 内。

### D6. 时效隔离

`90-dated-landscape.md` 文件头强制包含：as-of 日期、"使用前必须以官方来源复核"声明、按类别分节（EPYC/Ryzen 代际与产品状态 / 固件与 ABI 修订 / 内核·QEMU·libvirt 合入版本 / 云厂商与 CoCo 生态 / 路线图）。

迁入范围（审计已逐条枚举）。**下列全部是旧版章节号，不是 D1 的新章节号**——D1 刚刚把同一批数字重新定义过，照字面执行会把新 `14-sev-snp.md` 的 90% 搬进 `90`：旧 ch12 约 40%、旧 ch13 约 80%、旧 ch14 约 90%（按行统计分别是 21%/65%/74%，按字符是 40%/85%/95%），加上旧 ch01 的整条 mermaid 时间线与云 GA 段、旧 ch05 的 AVIC 默认值演进史与 OCI 实测、旧 ch06 的内核符号与 2024–2026 主线动向、旧 ch07 的 vendor-reset/X870E/AGESA 事件、旧 ch10 的 ABI 修订史与代际表、旧 ch11 的固件修复版本、旧 ch15 的文档修订表。

**一个反例**：硬件加速 vIOMMU（#48882 §2.10）在旧 ch06 里和"2024–2026 主线动向"写在一起，但它是**耐久的架构机制**，归 `08`/`10`，不进 `90`。迁移时按"这条明年还成立吗"判断，不按它在旧文件里的邻居判断。

厂商营销数字（"零虚拟化损耗"、"+23%"、"really close to zero"）改为归属语气或删除；研究流程叙述（"交叉验证已裁定"、"跨维度洞察 N"、"dimNN 报告"、"受页面限制未能全部抓取"、"笔者"、"本书"）一律删除，压缩为每文件一行 provenance 头。

### D7. 必须修正的错误（迁移时逐条处理，并在 `errata.md` 留痕）

> **⚠️ 本表已被 `recheck-findings.md` 附录 A 的逐条核验覆盖。两者冲突时以附录 A 为准。** 核验结果：**5 条我提出的"更正"本身是错的**（22 VMGEXIT、5 IVRS 条目长度、27 CVSS、25 CVE-2024-25744、31 客户端 SEV），照本表实施会引入新错误；另有 9 条需要附加限定才能写。下表已就地更正。

Problem Statement 第三节的条目全部进入 `errata.md`，每条给出：中文讹传表述、英文表述、带 T1 锚点的正确 claim、owner 文件。其中下列几条**必须同时进入 lint 的 MISCONCEPTIONS 规则**，因为它们会被旧资料反复带回来：

| 讹传 | 正确 |
|---|---|
| `CmdBufRun` 在 Control Register (0x0018) | **Status Register (0x2020) bit 4**；启动命令处理的是 Control Register bit 12 `CmdBufEn` |
| IOMMU MMIO 窗口 14 KiB | **16 KiB 仅在 `MMIO 0030h[PCSup] = 0` 时成立；`PCSup = 1` 时是 512 KiB**（48882 §2.3）。"14" 是把 `BaseAddress[31:14]` 读错了 |
| IRTE 的 `RemapEm` | **`RemapEn`** |
| NPF EXITINFO1 bit 33 ENC / 34 SIZEM / 35 VMPL | **34 ENC / 35 SIZEM / 36 VMPL**（31 = RMP） |
| VMRUN 检查 "CR4[63:11] 非零 / EFER[63:15] 非零" | 按**现行 APM 的 MBZ 规则**判定 |
| EXITCODE = 拦截位在向量中的位序 | 分段编码：CR 读 00h–0Fh、异常 40h–5Fh、向量 3 → 0x60+bit、向量 4 → 0x80+bit |
| `#VMEXIT` 只恢复 RIP/RSP/RAX | 24593 §15.6 列出 RAX、RSP、**NEXT_RIP**、CR0/CR3/CR4/EFER、IDTR/GDTR，并 "Forces CR0.PE = 1"。**两个限定**：AMD 的措辞是 "**at least** the following"（不是封闭列表）；**host LDTR 明确不恢复** |
| VMLOAD/VMSAVE 涉及 SS | 不涉及 SS（FS/GS/TR/LDTR/KernelGsBase/STAR/LSTAR/CSTAR/SFMASK/SYSENTER_*） |
| ~~CVE-2024-25744 是 SEV-SNP 漏洞~~ **此条作废（核验 #25 REFUTED）** | **AMD-SB-3008 把 CVE-2024-25742/25743/25744 全部归给 Heckler**；修复提交 `b82a8dbd3d2f` 标题为 "Disable 32-bit emulation by default on TDX **and SEV**"，改的是 `mem_encrypt_amd.c`。25744 覆盖 TDX **与** SEV，不是 Intel 独有；25743 是 AMD 专属的 interrupt-0/14 那一半。论文发表于 **USENIX Security 2024**。旧版真正的缺陷是**受影响代际列填了特性名**与**披露日期表里 2024-08 / 正文 2024-03 自相矛盾**，不是归属错 |
| Hyper-V 在 AMD 上不支持嵌套 | Windows Server 2022 / Windows 11 起支持（`Set-VMProcessor -ExposeVirtualizationExtensions`） |
| Hyper-V 不支持 AMD SEV（无条件表述） | 客户端/Server Hyper-V 不向 guest 暴露 SEV；Azure 的 Hyper-V 主机承载 SEV-SNP CVM（OpenHCL 在 VMPL0） |
| SEV 可在 Ryzen 桌面上使用 | **口径已按核验 #31 更正**：不是"客户端没有"，而是 **SEV 在 EPYC 上被产品化**。实测 CPUID 转储显示 **Ryzen 9 3900X、5800X3D 等非 PRO 消费级部件 `Fn8000_001F EAX[1]=1`（509 个 ASID）**；**Zen 4 客户端起才只剩 SME**；**SEV-SNP 从未在客户端置位**。客户端可用的内存加密是 **TSME / AMD Memory Guard**。**不要写"`EAX[1]` 在 Ryzen 上读 0"**——在 Zen+/2/3 上会被当场证伪 |
| 必须关掉 Hyper-V 才能跑 VMware/VirtualBox | 自 **Workstation 15.5.5**（Broadcom 称 "**Host VBS Mode**"）与 **VirtualBox 6.0**（核验更正，不是 6.1）起可经 WHP 与 VBS 共存。**但限制是有文档的**：VM 更慢、**不支持嵌套**、无 PMC、无 RTM/HLE、无 PKU；VirtualBox 7.2 手册仍标实验性并附"性能很差"警告 |
| x2AVIC = `Fn8000_000A EDX[14]` | **EDX[18]**（保留现有裁定） |
| Intel 平台的 `hvix64.exe` 用于 AMD | **`hvax64.exe`** |
| 嵌套遍历 16 次访存 | **24 次**（(4+1)(4+1)−1） |
| "SEV-ES 在支持 SNP 的 CPU 上被禁用"是 Zen 5 代际特性 | 是 **CVE-2025-48514 缓解的副作用**（AMD-SB-3023 原文："will result in disabling **SEV-ES** when SEV-SNP is **enabled**"）。三处精确化：**只禁用 SEV-ES（不是 SEV）**；触发条件是 SNP **已启用**（不是"支持 SNP"）；影响跨 **Zen 3/4/5**。固件 1.37.23/1.37.31/1.37.41 |
| SEVurity ↔ AMD-SB-1004 | AMD-SB-1004 对应 **SEVerity (CVE-2020-12967)**，**且该公告同时覆盖 CVE-2021-26311**；SEVurity 是另一篇、无 CVE，**第一作者 Luca Wilke，IEEE S&P 2020** |
| SEV-SNP 上限 255 vCPU 是架构限制 | 是 KVM/QEMU 的 xAPIC 期限制 |
| AES-XEX 覆盖 SEV 全代 | 按代际区分（Genoa 起 AES-256-XTS），且不得写成 "AES-XE" |

**待裁决（需查证后写入 errata 的 Open conflicts 节）**：SEV 密钥槽数与代际的对应（15/509/1006 分别属于哪一代）、AVIC erratum #1235 的真实披露年份（与 CVE 分配年份区分）、SNP 与 TDX 内存开销的两组相反测量、NPT 相对影子分页的"15–30%"是否有任何现代测量支撑。

### D8. 深度补全清单

Problem Statement 第二节列出的全部缺口按 D5 归位补齐。验收以"能不能照着写代码"为准：读者拿到章节后，不需要再去查 AMD PDF 就能构造/解码对应的结构。特别地：

- `02` 必须给出**完整**偏移表，不接受"示意图 + 关键字段摘要"。现有的 VMCB 示意图（图注写着"块高不代表字节数"）不得作为表的替代。
- `05` 的退出码表必须**穷举**，包括 60h/61h/64h/79h/7Ah/7Dh/84h–86h/8Ch–9Fh/0xA2/0x400/0x401/0x402/0x403 与 −1…−4。
- `08`–`10` 的每张结构表必须带位号；没有位号的字段名清单不算完成。
- `12`–`14` 即便是服务器范围，也按同一深度标准交付（这是用户明确选择保留全深度的原因）。
- 每章末尾设 **Open items** 节，明确写出本章仍未覆盖或 PDF 表述含混之处——**报告空白优于填充猜测**。

### D9. Windows PC 定位与 client/server 分界

- **硬件架构章 `01`–`11` 与操作系统无关**，照常按 AMD 官方文档写；但每章头部的 `Scope:` 行必须标明该章内容在客户端 Ryzen 上的可用性（例：AVIC 在客户端的固件启用状态、SR-IOV 在消费级平台不存在）。
- **`12`–`14`（SEV 全家）标记为服务器范围**，但**措辞必须按核验 #31 精确化**——"客户端上不存在"是错的：实测 Ryzen 9 3900X / 5800X3D 等非 PRO 消费级部件 `Fn8000_001F EAX[1]=1`（509 ASID），**Zen 4 客户端起才只剩 SME**，**SEV-SNP 从未在客户端置位**。正确写法："**SEV 在 EPYC 上被产品化**；Zen 4 及更新的客户端部件只有 SME/TSME；SEV-SNP 客户端不可用。仅在问题涉及 EPYC 时阅读。"**不得写 "`EAX[1]` 在 Ryzen 上读 0"**。SKILL.md 路由表对应行同样标注。**内容保留全深度**（用户裁定）。
- **`11-memory-encryption.md` 是客户端能用的那一章**：SME/TSME（AMD Memory Guard）、C-bit、物理地址位缩减、AMD-SP/fTPM 与 Windows 11 TPM 要求的关系。
- **`16-windows-platform.md` 是新增章，权重最高**：Windows PC 上"谁占据 SVM"是解释绝大多数问题的关键事实，必须像 `intel-vt/17` 那样在 SKILL.md 正文里单独成节。
- **`18-performance.md` 改为 Windows PC 开销**：VBS/HVCI 对客户端与游戏的影响、WSL2 与实用 VM 的开销、第三方 VMM 跑在 WHP 之上 vs 裸 SVM、PC 上的嵌套开销。删除云规模整合、NFV、数据中心能耗、EPYC 调优指南。
- **Linux/VFIO 内容降级**：保留为显式标注 "Linux-only" 的对照小节（IOMMU groups、vfio-pci、vendor-reset），不再作为主线操作流程。

### D10. 语言策略

规范性正文用**英文**，术语与 AMD 官方文档逐字对齐（`#VMEXIT` 不写成 `VM Exit`；`system physical address (sPA)` 不写成 `HPA`；`nested page fault`、`guest-physical address` 不意译）。每章开头一段 `> **中文速览**`（3–5 句）。`00-quickref.md` 提供中英术语对照。`errata.md` 每条同时给中英表述（讹传多以中文流传）。

### D11. 打包与跨 AI（单一源 + 最小生成物）

- **源**：`amd-virtualization/SKILL.md` + `amd-virtualization/references/*.md`。内容零复制。
- **frontmatter 只用标准字段**（`name`/`description`/`license`/`compatibility`/`metadata`/`allowed-tools`）；`name` 必须等于目录名；`description` ≤1024 且**前 60 字符是能独立成立的英文触发短语**；SKILL.md ≤500 行。
- **生成物（禁止手改，头部带 `DO NOT EDIT`）**：`amd-virtualization/index.json`、`amd-virtualization/agents/openai.yaml`、以及根 `AGENTS.md`——**`AGENTS.md` 改为同时描述两个技能**，各给一段"何时读哪个"，并写明消歧规则。
- **安装路径**：`.agents/skills/amd-virtualization`（Codex 与 Hermes 共用）+ `.claude/skills/amd-virtualization`（Claude Code）。
- 不生成 BUNDLE 单文件拼接版。

### D12. SKILL.md 契约重写

- 路由表精确到**章节**（如 `05-exit-decoding.md §5.2`），并标注 `(server-only)` 行。
- 加入"只读相关章节，不要全量加载"与显式停止规则。
- `errata.md` 与 `00-quickref.md` 进入路由表。
- **删除"把每个用到的 bibliography 条目原样抄进回答"这条不可执行的规则**，改为与 `intel-vt` 一致的输出标准：引规范（文档 + 章节/表），不引本技能；携带 `C:`/`V:` 标记；数字带条件；厂商说法带归属；不知道就说不知道；不编造章节号。
- 删除"已裁定的关键事实"孤儿清单——每条要么进入 owner 章节的 claim 行，要么进入 `errata.md`。
- 加入与 `intel-vt` 的消歧规则（AMD 为主走本技能；Intel 为主或双向对比走 `intel-vt`），与 `intel-vt/SKILL.md` 现有措辞对称。
- 加入 "The Windows fact that resolves most questions" 段：VBS/WSL2/沙盒开启后 Hyper-V 占据 SVM。

### D13. bibliography 重建与 ID 区段

旧 `bibliography.md` 的 503 条整体移入 `.scratch/amd-virt-refine/_source/`，**当作线索，不当作事实**。新 bibliography 从零建立，`[N]` 格式与 `intel-vt` 一致：

```
[42] <作者或机构>. <标题>. <版本/修订>. <日期>. <URL> — T1|T2|T3
```

ID 区段（避免并行写入冲突，各章只在自己区段内分配）：

| 区段 | 归属 |
|---|---|
| 1–40 | AMD 官方 T1（**由 D2 基线预置，只读**） |
| 41–99 | 其他官方规范 T2（Microsoft Learn、PCI-SIG、Intel SDM、ARM、RISC-V）——**同样由票 02 预置**，避免票 12 与票 14 在同一个无主区段里各自分配 |
| 100–149 | `01`–`02` |
| 150–199 | `03`–`05` |
| 200–239 | `06` |
| 240–269 | `07` |
| 270–329 | `08`–`10`（IOMMU） |
| 330–349 | `11` |
| 350–429 | `12`–`14`（SEV） |
| 430–459 | `15` 嵌套 |
| 460–499 | `16` Windows |
| 500–549 | `17` 安全 |
| 550–579 | `18` 性能 |
| 580–609 | `19` 对比 |
| 610–659 | `90` 时效区 |
| 660–699 | `errata.md` |

旧 bibliography 中的一手来源（kernel.org、LKML、论文、AMD 官方页面、Microsoft Learn）可以按新格式重新录入并升级为 T1/T2；黑名单域名不得录入。

`00-quickref.md` **不分配 ID 区段**——它是导航层，引用 owner 章已有的 ID。

### D14. 图片处理

现有 14 张 PNG 逐张复核，处置三选一：**保留**（有量化信息且与重写后的事实一致，随 owner 章迁移）、**降级到 `90-dated-landscape.md`**（时间线/路线图类）、**删除**（顶替缺失表格的示意图，如 VMCB 布局图与"块高不代表字节数"那一类）。删除的图不补画——表格才是交付物。`references/images/` 目录保留。

### D15. 工具链共享化（已与用户确认）

保持**唯一一份** lint 与 build，靠每技能一份配置区分：

- `tools/lint.mjs` 现有的 Intel 专属常量（`T1_ANCHORS`、`T1_PREFIX`、`ARCH_CHAPTER`、`DATED_FILE`、`DEAD_SDM_TITLES`、`BANNED_ARCH_HOSTS`、`MISCONCEPTIONS`、`OWNERSHIP`、`NAVIGATIONAL`）外提到 `<skill>/lint.config.json`，两个技能各一份。脚本逻辑不分叉。
  **复检发现四处不是纯数据、不能直接搬进 JSON**：(a) `isCorrection` 是个闭包，且是 `DEAD_SDM_TITLES` 与 `MISCONCEPTIONS` 两条规则共同的豁免开关，必须拆成共享基线 + 每技能 `correctionHints`；(b) 归属规则的豁免子句以字面正则内联在消费它的代码里；(c) `T1_ANCHORS` 被 claim 循环与题库校验两处以不同语义使用；(d) 脚本主体是模块级直线代码（`errors`/`warnings` 为模块作用域），多技能默认运行必须先把主体包成函数并按技能隔离状态。另外所有正则要以 `{ "re": "...", "flags": "..." }` 形式存 JSON（flags 必须显式；JSON 字符串里写 `\/` 会变成非法转义）。
- `tools/build.mjs` 去掉 `const SKILL = 'intel-vt'`，改为遍历技能列表，生成两份 `index.json` + 两份 `agents/openai.yaml` + **一份同时描述两个技能的 `AGENTS.md`**；`--check` 漂移校验覆盖全部产物。
- `eval/` 改为 `eval/RUNNER.md`（共享协议，措辞去 Intel 化）+ `eval/<skill>/questions.yaml` + `eval/<skill>/results/`。**这是迁移不是新建**——Intel 侧已有 80 题题库、README 与 6 份实跑结果（见 T3），需一并搬迁，且必须在同一次改动里同步修改 `tools/lint.mjs` 中硬编码的题库路径，否则题库校验会静默失效。

这三处对 `intel-vt` 的改动是**纯工具与配置层面**，不触碰其 SKILL.md 与 references 内容；改完后 `node tools/lint.mjs intel-vt` 与 `node tools/build.mjs --check` 必须保持通过，作为回归判据。

---

## Testing Decisions

**单一行为缝：技能的外部行为契约**——给定一个问题，一个全新 agent 只读这个技能能否答对、答全、答得可回溯。不测文件内部结构、不测标题层级、不测 agent 读了哪个文件，那些是实现细节，会让测试在合理重构时误报。形式缝只做确定性的引用完整性检查。两条缝与 `intel-vt` 共用工具。

### T1. 黄金评测集（行为）

- `eval/amd-virtualization/questions.yaml`：**80 题**，覆盖全部章节，题型配比约为 查表类 30% / 机制解释 30% / 诊断推理 25% / 讹传陷阱 15%。
- 每题字段：`id`、`chapter`、`question`、`must_include`（必须出现的事实/数值/位号/偏移）、`must_not_include`（讹传表述，直接取自 `errata.md`）、`required_citation`（必须给出的 AMD 文档号 + 章节或表号）。
- **陷阱题必须覆盖 D7 表中的每一项（20 条）**。注意算术：24+24+20+12 = 80 已经排满，12 道陷阱题装不下 20 条讹传——**允许一道题的 `must_not_include` 同时挂多条讹传**（例如一道"解读这个 `#NPF`"的题可以同时挂位号错位与"EXITCODE = 位序"两条）。现状技能在这些题上会答错，精炼后必须答对。至少包括：`CmdBufRun` 在哪个寄存器、IOMMU MMIO 窗口多大、IRTE bit 0 叫什么、NPF EXITINFO1 的 ENC/SIZEM/VMPL 位号、VMRUN 对 CR4/EFER 的检查怎么表述、VMRUN 的 EXITCODE 是多少、`#VMEXIT` 恢复了哪些寄存器、VMLOAD 是否涉及 SS、CVE-2024-25744 属于谁、AMD 上 Hyper-V 能否嵌套、Ryzen 桌面能否用 SEV、跑 VMware 是否必须关 Hyper-V、嵌套遍历多少次访存、x2AVIC 的 CPUID 位、AMD 上的 Hyper-V 镜像文件名。
- **Windows 题至少 12 道**（占 15%）：为什么我的 VMM 用不了 AMD-V、VBS 需要哪些 AMD 硬件特性、Kernel DMA Protection 显示 Off 的原因、客户端能否做 GPU 直通、如何在 AMD 上开启嵌套、`CPUID 0x40000000` 返回什么。
- **通过线**：`must_include` 命中率 ≥90%；`must_not_include` 违反 **0** 次；引用有效率 ≥95%（AMD 文档号与章节/表号存在且对得上）。
- 评测协议用共享的 `eval/RUNNER.md`，结果写入 `eval/amd-virtualization/results/<agent>-<date>.md`。三家 agent（Claude Code / Codex / Hermes）各跑一轮，差异本身是路由质量的信号。

### T2. 引用 lint（形式，确定性）

共享的 `tools/lint.mjs` + `amd-virtualization/lint.config.json`，CI 与提交前运行，检查：

1. 每条 claim 行带四个 token（锚点 / `[N]` / `C:` / `V:`）。注意现行实现**只对架构章强制锚点**，非架构章的 claim 允许无锚点；
2. 每个 `[N]` 在 `bibliography.md` 中可解析，且无孤儿条目。**孤儿检查必须跳过预置区**——Intel 的实现豁免 ID ≤25，AMD 的官方文档预置区是 1–40，配置项 `orphanExemptBelow: 41`；
3. T1 锚点匹配 D2 基线的文档号与编号格式；**必须新增 `Table X-N` 与 `[APM3 §4 "MNEMONIC"]` 两种 Intel 侧不存在的形式**；未核验锚点（`Ch.?`）必须配 `C:low`；
4. `01`–`15` 中每条架构断言至少一条 T1 引用；
5. `V:dated` 只允许出现在 `90-dated-landscape.md`；
6. **黑名单域名——现行实现是空转，必须重写。** 现在的做法是在章节正文里做 `line.includes(host)` 字面匹配，而 **`bibliography.md` 根本不在被扫描的文件集内**；证据：`intel-vt/references/bibliography.md` 里此刻就躺着 `juejin.cn`、`xem.github.io`、`blog.csdn.net`、`ask.csdn.net`，而 lint 报 clean。本技能的章节只以 `[N]` 引用、正文不出现 URL，这条规则对 AMD 等于完全失效。**改为**：把 bibliography 解析成 `id → {url, host, tier}`，对每条架构 claim 解析它的每个 `[N]`，命中黑名单 host 即 **error**；另对包括 `bibliography.md` 在内的全部文件做字面匹配兜底。同一套 `[N]` 解析机制也是规则 6b（legacy 文档）能生效的前提——否则一条只写 `[412]` 而不出现 "33047" 字样的 claim 会直接逃逸；
6b. **legacy 文档限制**：33047 与 IOMMU 34434 Rev 1.20 只允许出现在带历史限定词（historical / superseded / 2005 / 2007 / originally …）且 `C:` 不为 `high` 的 claim 行；
7. **MISCONCEPTIONS 正则**（D7 表）：讹传表述出现在 `errata.md` 之外即失败。注意现行的 `isCorrection` 豁免是**关键词或运算**——一行里出现 "wrongly"/"rather than" 之类词就整行豁免掉所有讹传规则；AMD 的 `correctionHints` 必须收窄并与 Intel 的分开；
8. **归属规则——现行实现是 warn-only 且实测输出为零，必须收紧。** 实测 Intel 语料：**73 条 claim 命中非 owner 主题，73 条全部被豁免子句吞掉，实际输出 0 条警告**（71 条靠 `` `NN-name.md` `` 文件名 token，2 条靠裸词 "see"）。**改为**：豁免只认显式的 `` `NN-file.md` `` 交叉引用 token，去掉裸 `see` 与 `→`；并新增一条**硬 error**——`claimFreeFiles`（AMD 为 `00-quickref.md` 与 `core-facts.md`）内不得出现 claim 行。该项**按技能开启**，原因见 D5 的分歧说明；
9. frontmatter 仅含 6 个标准字段，`name` == 目录名，`description` ≤1024 且首句 ≤60 字符。"是英文"只能用 ASCII 近似（现行实现即如此，且只 warn）。**注意首句切分依赖终止标点**：AMD 现有的 description 是没有句号的折叠块，会被整体当成"首句"而报 474 字符——这正是 AMD 目前唯一的真 error；
10. SKILL.md ≤500 行；路由表中的每个文件与 `§x.y` 锚点都真实存在；
11. **生成物漂移校验归 `build.mjs --check`**，lint 只做"文件存在 + 带 `DO NOT EDIT` 头 + index.json 的 sha256 一致"这层弱校验——现行实现**从不校验 `agents/openai.yaml` 与 `AGENTS.md` 的内容**。CI 必须同时跑 lint 与 `build --check`，缺一不可；
12. 术语一致性（`RemapEm` → `RemapEn`、架构章里的 `HPA` → `sPA`、`VM Exit` → `#VMEXIT`）——**新规则，现行实现没有**。必须带 `exceptFiles`，否则 `19-comparison-intel-arm-riscv.md` 里正当引用 Intel 术语会误报。

> **复检结论**：上表 1–5、7、9、10 已在现行 `tools/lint.mjs` 中实现并对 Intel 生效（`node tools/lint.mjs intel-vt` → `lint clean — 22 chapter file(s), 314 bibliography entries, 2505 distinct claims`，零警告）；**6 与 8 名义上存在但实测为空转**；11 分属两个脚本且 lint 这半是弱的；12 尚不存在。票 01 必须先把 6/6b/8/11/12 修出来，否则本 spec 所说的"确定性拦截"只是纸面上的。
>
> 另外，`node tools/lint.mjs amd-virtualization` 当前报 **81 error / 495 warning**，但其中 **80 个 error 是串台**——`lint.mjs` 用仓库根的 *Intel* 题库去校验 AMD 的章节文件；**478 个 warning 是"条目从未被引用"**，因为 AMD 语料里**一条 `- **Claim.**` 行都没有**，所以规则 1–5、7 在 AMD 上不是失败、是**根本没运行**。不要把这个数字当成"AMD 侧的基线问题清单"。

### T3. 本仓既有测试先例

**先例比本 spec 初稿所记的完整得多（复检更正）。** `intel-vt` 的行为缝**已经建成并跑过**：`eval/questions.yaml` 有 **80 题**（lookup 24 / mechanism 24 / diagnosis 20 / trap 12）、`eval/README.md` 说明题型与覆盖、`eval/results/` 下有 6 份 2026-09-20 的实跑报告（`trap-smoke`、`trap-full`、`lookup`、`mechanism`、`diagnosis`、`SUMMARY`），并已驱动了两轮修复提交（`e130c44`、`efc64b2`）。本 spec 初稿写的"`eval/` 下只有 RUNNER.md"是过时快照——**AMD 的题库应当照抄这套结构与题型配比，而不是另起炉灶**。

因此 `eval/` 的重组是**迁移而不是新建**，并且需要一个 spec 初稿里没有的 Intel 侧动作：`eval/questions.yaml` → `eval/intel-vt/questions.yaml`、`eval/README.md` → `eval/intel-vt/README.md`、`eval/results/*` → `eval/intel-vt/results/`。

**这是整个重构里最危险的一次编辑。** `tools/lint.mjs` 用 `join(ROOT, 'eval', 'questions.yaml')` 硬编码了题库路径。迁移时若不同步改这一行，`existsSync` 返回 false，题库校验（重复 id、`chapter` 存在性、`required_citation` 锚点校验、题量 <80 警告）**整段被跳过，而 lint 依然打印 `lint clean`**——失败是静默的、向"更干净"的方向失败。

保持零依赖、可离线运行，不引入包管理器工作流。回归判据见票 01，**且必须包含两个阳性对照**（只做 diff 对比证明不了任何东西，因为最危险的两种破坏都是静默失败）。

---

## Out of Scope

- **不重写 `intel-vt` 的内容**。只做 D15 的工具与配置泛化，以及在其 SKILL.md 消歧段落里补上与新 AMD 章节的对应（如有必要）。
- **不补画新图**。现有 14 张按 D14 处置，删掉的不重画。
- **不做全文中译**。按 D10，英文正文 + 中文速览。
- **不做超出"重新锚定 + 补全已列缺口"的新研究**。补全范围以本次审计列出的缺口为准。
- **不建 MCP server、不发布到任何 registry、不做版本发布流程。**
- **不刷新事实到 2026-09-20 之后**；时效区保持本次确定的 as-of 日期，刷新是后续独立任务。
- **不保留 Linux 服务器操作手册**（Proxmox/VFIO 全流程、EPYC 调优指南、SR-IOV 配置）作为主线内容；只保留标注为 Linux-only 的对照小节。
- **不为 SEV 章节做客户端裁剪**（用户已裁定保留全深度，只加服务器范围标注）。

---

## Further Notes

**仓库有 git，基线已提交。** 当前分支 `master`，基线提交 `d04c625 "Baseline: intel-vt + amd-virtualization KB skills before refactor"`。这次重构有回退保护——这一点与 `intel-vt` 重构启动时不同（当时无 git）。建议每章一个提交，便于二分定位引入错误的章节。

**迁移体量。** 15 个研究维度文件 → 20 个章节文件 + 4 个支撑文件，不是改名而是重切：一个旧文件的内容会散到多个新章节（例如旧 ch07 的 AVIC 部分归 `07`，IRTE 归 `10`，VBS 归 `16`，大页调优归 `18`，GPU 直通操作归 Linux-only 小节）。建议按章并行推进，`bibliography.md` 是唯一共享写入点，靠 D13 的 ID 区段避免冲突。

**引用核验成本是这个任务的主要工作量。** 每条 T1 锚点都必须对着真实 PDF 核对——不能凭记忆。AMD 侧尤其危险，因为大量流传的"APM 第 15 章 §15.x"编号来自 2005 年的 33047 与各类镜像/译文。实现 agent 若凭记忆写编号，会系统性地引入一批看起来权威、实则错误的引用，比现状的博客引用更难被发现。lint 的第 3 条就是为此存在的。

**现状的一个优点必须保留：引用管道是健康的。** 503 条 bibliography 无 ID 缺口、无断链、无孤儿。重建时保持这个性质（lint 第 2 条）。问题从来不是"没有引用"，而是"引用指向了错误的东西"。

**评测集本身需要人工过一遍。** `must_include` 里的事实如果写错，评测就会奖励错误答案。建议陷阱题部分由用户本人复核一次，其余题目由 lint 的 T1 锚点校验兜底。

**审计覆盖度说明。** 本 spec 的问题清单来自对全部 16 个文件（SKILL.md + 15 个参考文件 + bibliography，约 405 KB）的完整通读，由四组并行审计分别完成，加上对 bibliography 的机械统计（503 条、域名分布、断链/孤儿检查）与对 AMD 官方文档结构的独立核查。已确证的事实错误、断裂引用、跨文件矛盾均在 Problem Statement 第三节中逐条列出，不是抽样推测。
