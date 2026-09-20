# 维度01：英特尔虚拟化技术（Intel VT）起源与演进史

> 研究范围：x86 虚拟化历史难题 → Vanderpool/VT 诞生 → 逐代微架构功能演进（Prescott → Granite Rapids/Sierra Forest）→ KVM/Hyper-V/云计算里程碑。
> 证据规范：Claim / Source / URL / Date / Excerpt（原文摘录）/ Context / Confidence。
> 检索说明：本维度共执行 17 批、50+ 条独立检索（中文为主，一手来源用英文），覆盖 Intel 官方新闻稿与支持页、Intel Technology Journal、IEEE Computer、Wikipedia（多页交叉）、LWN/Phoronix、LKML、IEEE Xplore、dblp、中文主流技术媒体等。

---

## 0. 总览时间线（结论先行）

| 时间 | 事件 | 关键证据 |
|---|---|---|
| 1974-07 | Popek & Goldberg 提出可虚拟化形式化条件（敏感指令须为特权指令子集） | E-01 |
| 2000-08 | Robin & Irvine 证明奔腾 x86 存在 17 条无法陷入的敏感指令，x86 经典"陷入-模拟"虚拟化不可行 | E-02 |
| 1998–2003 | 纯软件路线：VMware 二进制翻译（1998/1999）；Xen 半虚拟化（SOSP 2003，Xen 1.0 于 2003-09 发布） | E-03, E-04 |
| 2005-01-20 | Intel 发布 Vanderpool EAS 外部架构规范，宣布加速虚拟化计划（IA-32 与安腾双轨） | E-05 |
| 2005-03 / 2005-08 | IDF 公布 Vanderpool 技术细节；2005-05 Uhlig 等《Intel Virtualization Technology》刊于 IEEE Computer | E-06, E-07 |
| 2005-11-14 | 首批支持 VT-x 的处理器 Pentium 4 662/672（Prescott 2M）发布；Vanderpool 更名 VT | E-08, E-09 |
| 2006-05-23 | AMD 首批 AMD-V 处理器（对照事件） | E-10 |
| 2006-07-18 | 安腾 Montecito（Itanium 2 9000 系列）发布，VT-i（Silverdale）落地 | E-11 |
| 2006-08 | Intel Technology Journal 10(3) 专刊：VT-x（Neiger 等）、VT-d（Abramson 等）论文 | E-12, E-13 |
| 2006-2007 | Core 2（Merom/Conroe）普及 VT-x；FlexPriority/TPR shadow；Q35 芯片组带 VT-d（2007 Q2/Q3） | E-14, E-15 |
| 2006-10-19 | KVM 首次发布（Qumranet，Avi Kivity），依赖 VT-x/AMD-V | E-16 |
| 2007-02-05 | KVM 合入 Linux 2.6.20 主线 | E-17 |
| 2008-06-26 | 微软 Hyper-V（代号 Viridian）RTM 正式发布 | E-18 |
| 2008-09-15/22 | Xeon 7400（Dunnington）发布，引入 FlexMigration（跨代热迁移） | E-19, E-20 |
| 2008-11 / 2009-03-30 | Nehalem：Core i7（2008-11）与 Xeon 5500（2009-03-30）引入 EPT 与 VPID，硬件内存虚拟化时代开启 | E-21, E-22, E-23 |
| 2010 | Westmere 引入 "unrestricted guest"（实模式直接启动，依赖 EPT） | E-24 |
| 2006–2011 | 云计算兴起：AWS S3/EC2（2006，基于 Xen）拉动虚拟化需求，VT 成为云基础设施底座 | E-25 |
| 2012–2013 | APICv（中断/APIC 虚拟化）2012 年公布，随 Ivy Bridge-EP（Xeon E5 v2，2013 末）商用 | E-26 |
| 2013 | Haswell 引入 VMCS shadowing（嵌套虚拟化加速）与 EPT A/D 位 | E-27, E-28 |
| 2014–2015 | Broadwell 引入 posted interrupts（posted-interrupt processing） | E-28 |
| 2015 | Skylake：VMFUNC（EPTP switching）硬件可用（ISA 定义更早，见争议节） | E-29 |
| 2016–2017 | Kaby Lake（7代）引入 MBEC（Mode-Based Execute Control），加速 Windows HVCI | E-30 |
| 2020-08 | Intel 公布 TDX 白皮书与架构规范（机密计算，VM 级 TEE） | E-31 |
| 2021-04 | Ice Lake-SP（第三代至强可扩展）上市：新 I/O 虚拟化设计、TME 全内存加密 | E-32 |
| 2022 | Sapphire Rapids 的 IPI virtualization 支持进入 Linux 5.19/6.0（消除发 IPI 时的 VM-exit） | E-33 |
| 2023-01-10 | 第四代至强可扩展（Sapphire Rapids）发布，首个集成 TDX 的至强平台 | E-34, E-35 |
| 2024-06 / 2024-09 | 至强6：Sierra Forest（E核，2024-06）与 Granite Rapids（P核，2024-09）发布，延续 TDX 并新增 TDX Connect | E-36, E-37 |

---

## 1. 起源背景：x86 虚拟化的历史难题与纯软件路线的局限

### E-01　Popek & Goldberg 可虚拟化定理（1974）
- **Claim**：1974 年 7 月，Gerald J. Popek 与 Robert P. Goldberg 在《Communications of the ACM》17 卷 7 期发表《Formal Requirements for Virtualizable Third Generation Architectures》（pp.412–421），提出 VMM 构造的充分条件：所有敏感指令必须是特权指令的子集（即可被陷入）。
- **Source**：National Academies Press《Toward a Safer and More Secure Cyberspace》（2007）参考文献；CMU 15-410 课程讲义
- **URL**：https://www.nationalacademies.org/read/11925/chapter/8 ；http://www.cs.cmu.edu/~410-s09/lectures/L33_Virtualization.pdf
- **Date**：原始论文 1974-07；引用页 2007
- **Excerpt**："G.J. Popek and R.P. Goldberg, 'Formal Requirements for Virtualizable Third Generation Architectures,' Communications of the ACM, 17(7): 412-421, July 1974."
- **Context**：该定理是判断 ISA 能否以经典"陷入-模拟（trap-and-emulate）"方式虚拟化的理论基准，是后续所有 x86 虚拟化争论的起点。
- **Confidence**：high

### E-02　Robin & Irvine：奔腾 x86 不满足 Popek-Goldberg 条件（2000）
- **Claim**：John S. Robin 与 Cynthia E. Irvine 在第 9 届 USENIX Security Symposium（2000-08，Denver）发表论文《Analysis of the Intel Pentium's Ability to Support a Secure Virtual Machine Monitor》（pp.129–144），系统论证 IA-32 存在一组敏感但不陷入的指令（通常称 17 条），x86 无法直接构建安全 VMM。
- **Source**：FAU Erlangen 课程文献表；National Academies Press 引用（含 USENIX 原始链接）
- **URL**：https://sys.cs.fau.de/lehre/ws22/mw/literatur ；https://www.nationalacademies.org/read/11925/chapter/8
- **Date**：2000-08（会议 8 月 14–17 日）
- **Excerpt**："John S. Robin and Cynthia E. Irvine. **Analysis of the Intel Pentium's Ability to Support a Secure Virtual Machine Monitor**. In *Proceedings of the 9th USENIX Security Symposium (SSYM '00)*, pages 129–144, 2000."；另有 "The seventeen problem instructions could now trap in hardware. Binary translation was no longer required. Popek-Goldberg, retroactively, was satisfied."（taskade.com 虚拟化史，概括 VT-x 到来后的意义）
- **Context**：SGDT/SIDT/SLDT/SMSW/PUSHF/POPF、LAR/LSL/VERR/VERW 等指令在用户态执行不陷入、静默返回不同结果，使 guest OS 能察觉自己不在 ring 0。VT-x 的 VMX non-root 模式正是让这批指令在硬件层可陷入。
- **Confidence**：high

### E-03　纯软件路线一：VMware 二进制翻译及其局限
- **Claim**：1990 年代末，VMware 以二进制翻译（binary translation）+ 影子页表 + 设备模拟实现 x86 全虚拟化；ring deprivileging（把 guest OS 降到 ring 1/3）是基本手段；该技术复杂且有性能开销。
- **Source**：Wikipedia《x86 virtualization》"Software-based virtualization" 一节
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：页面访问于本次研究（2026 年版）
- **Excerpt**："One approach used in x86 software-based virtualization to implement this mechanism is called *ring deprivileging*, which involves running the guest OS at a ring higher (lesser privileged) than 0, so that attempts to execute privileged instructions can be intercepted and handled by the hypervisor." / "Binary translation is used to rewrite certain ring 0 instructions in terms of ring 3 instructions, such as POPF, that would otherwise fail silently or behave differently when executed above ring 0, making the classic trap-and-emulate virtualization impossible."
- **Context**：同页还指出 x86-64 长模式下分段被削弱，Intel 64 不做分段支持，使"Intel CPU 上纯软件 64 位虚拟化不可能"，VT-x 成为运行 64 位 guest 的前提。
- **Confidence**：high

### E-04　纯软件路线二：Xen 半虚拟化（2003）
- **Claim**：剑桥大学 Xen 项目（SOSP 2003 论文《Xen and the Art of Virtualization》）走半虚拟化路线：修改 guest OS 以规避难虚拟化的指令，Xen 1.0 于 2003 年 9 月发布。
- **Source**：FAU 文献表；51cto 虚拟化编年史
- **URL**：https://sys.cs.fau.de/lehre/ws22/mw/literatur ；https://blog.51cto.com/u_16213633/8338780
- **Date**：SOSP 论文 2003-10；Xen 1.0 2003-09
- **Excerpt**："Paul Barham, … Andrew Warfield. **Xen and the Art of Virtualization**. In *Proceedings of the 19th Symposium on Operating Systems Principles (SOSP '03)*, pages 164–177, 2003."；"2003 年 9 月，Xen第一个版Xen 1.0发布。它最初是剑桥大学Xensource的一个开源研究项目。"
- **Context**：Wikipedia x86 virtualization 页亦确认："A different route was taken by other systems like Denali, L4, and Xen, known as paravirtualization… The paravirtualized I/O has significant performance benefits as demonstrated in the original SOSP'03 Xen paper."
- **Confidence**：high

---

## 2. Vanderpool 项目公布与 VT 诞生（2005）

### E-05　Intel 发布 Vanderpool EAS，宣布加速虚拟化计划（2005-01-20）
- **Claim**：2005 年 1 月 20 日，Intel 新闻稿《Intel Accelerating Virtualization Effort》宣布发布 Vanderpool Technology 外部架构规范（EAS），面向 IA-32 与安腾平台；并称将比原计划提前一年（2005 年内）在桌面处理器与芯片组中提供该技术。
- **Source**：Intel 官方新闻稿（pressroom 存档）
- **URL**：https://www.intel.com/pressroom/archive/releases/2005/20050120comp.htm
- **Date**：2005-01-20
- **Excerpt**："Intel is accelerating its broad industry efforts to deliver enhanced virtualization capabilities — codenamed Vanderpool — for Intel-based clients and servers. The company has released its preliminary Vanderpool Technology External Architecture Specifications (EAS)… While expected in Itanium-based platforms this year, Intel now also plans to offer Vanderpool Technology in future desktop processor and chipset products in 2005, a year earlier than previously planned."
- **Context**：这是 Intel 虚拟化项目的首个官方公开节点；"initial systems incorporating Vanderpool Technology later this year" 预示 2005 年内出样机。
- **Confidence**：high

### E-06　2005 年 IDF 公布 Vanderpool 技术细节
- **Claim**：2005 年 8 月（IDF Fall 2005 前后），Intel 首次公布 Vanderpool 的技术细节（新增指令使处理器支持硬件虚拟化）；2005 年 11 月宣布 Vanderpool 更名 VT（Virtualization Technology），并被 Acer、联想用于 Pentium 4 PC。
- **Source**：与非网（eefocus）虚拟化技术词条聚合页（多家中文媒体同文）
- **URL**：https://m.eefocus.com/tag/%E8%99%9A%E6%8B%9F%E5%8C%96%E6%8A%80%E6%9C%AF/circuit/
- **Date**：聚合页 2025-03-17（内容记述 2005 年事件）
- **Excerpt**："2005年8月，Intel首次公布了针对硬件辅助虚拟化的Vanderpool（Intel VT虚拟化技术的前身）技术细节。Vanderpool技术通过增加新的指令，使得Intel处理器支持硬件虚拟化。2005年11月，Intel宣布，虚拟化技术Vanderpool改成VT，被Acer和联想应用在其基于Intel Pentium 4的PC上。"
- **Context**：与 E-05 的 1 月 EAS 发布互为补充：1 月发规范、3 月 IDF Spring 演讲、8 月 IDF Fall 公布细节、11 月产品落地。另有电子爱好者《云计算技术发展编年史》："2003 年，Intel 对外宣布将在 x86 CPU 上支持硬件虚拟化技术"（medium，仅一家之言）。
- **Confidence**：medium-high（更名与 8 月公布细节多源一致；"2003 年宣布"仅单源，列为 low）

### E-07　Uhlig 等《Intel Virtualization Technology》IEEE Computer（2005-05）
- **Claim**：Intel 官方技术论文 Rich Uhlig、Gil Neiger、Dion Rodgers 等《Intel Virtualization Technology》刊于 IEEE Computer 第 38 卷第 5 期（2005 年 5 月），pp.48–56，首次体系化公开 VT-x（Vanderpool）与 VT-i（Silverdale）设计。
- **Source**：dblp IEEE Computer Volume 38 目录；Wikipedia 引文（doi:10.1109/MC.2005.163）
- **URL**：https://dblp.org/db/journals/computer/computer38.html
- **Date**：2005-05
- **Excerpt**："Rich Uhlig, Gil Neiger, Dion Rodgers, Amy L. Santoni, Fernando C. M. Martins, Andrew V. Anderson, Steven M. Bennett, Alain Kägi, Felix H. Leung, Larry Smith: **Intel Virtualization Technology.** 48-56"（Volume 38, Number 5, May 2005）
- **Context**：同期为"Resource Virtualization Renaissance"专刊（含 Rosenblum & Garfinkel《Virtual Machine Monitors: Current Technology and Future Trends》），标志学术界对硬件虚拟化复兴的确认。
- **Confidence**：high

### E-08　首批 VT-x 处理器 Pentium 4 662/672（2005-11-14）
- **Claim**：2005 年 11 月 14 日，Intel 发布 Pentium 4 662 与 672（Prescott 2M 核心），为首批支持 VT-x 的 Intel 处理器；VT-x 前身代号 Vanderpool；CPUID 标志位为 vmx（Virtual Machine Extensions）。
- **Source**：Wikipedia《x86 virtualization》"Intel virtualization (VT-x)" 一节
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：2005-11-14（事件日期）
- **Excerpt**："Previously codenamed 'Vanderpool', VT-x represents Intel's technology for virtualization on the x86 platform. On November 14, 2005, Intel released two models of Pentium 4 (Model 662 and 672) as the first Intel processors to support VT-x. The CPU flag for VT-x capability is 'vmx'"
- **Context**：同页列明 VMX 新增 13 条指令：VMPTRLD, VMPTRST, VMCLEAR, VMREAD, VMWRITE, VMCALL, VMLAUNCH, VMRESUME, VMXOFF, VMXON, INVEPT, INVVPID, VMFUNC（后三条为后续扩展）。英文媒体（taskade）独立佐证："shipped the first VT-x parts on November 14, 2005"。
- **Confidence**：high

### E-09　VMX 双模式架构解决敏感指令陷入问题
- **Claim**：VT-x 引入 VMX root / non-root 两种运行模式：VMM 在 root 模式、guest 在 non-root 模式运行，guest 自感 ring 0 全特权而宿主仍受保护，原先无法陷入的敏感指令在 non-root 下全部可配置陷入。
- **Source**：Wikipedia《x86 virtualization》；电子爱好者《云计算技术发展编年史》
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization ；https://www.elefans.com/xitong/1726596381a1076882.html
- **Date**：2024-10-24（中文页）
- **Excerpt**："These instructions permit entering and exiting a virtual execution mode where the guest OS perceives itself as running with full privilege (ring 0), but the host OS remains protected." / "GuestOS 运行于 non-Root Mode（受控模式），原来的一些敏感指令在受控模式下会全部陷入 VMM，由 VMM 来实现模拟…模式切换时，上下文的保存恢复由硬件来完成，这样就大大提高了陷入的效率。"
- **Context**：VMCS（Virtual Machine Control Structure）是模式切换与状态保存的核心数据结构。
- **Confidence**：high

---

## 3. 家族扩展：VT-i（安腾）、VT-d（I/O）、VT-c（网络）与 AMD 对照

### E-10　对照：AMD-V（Pacifica）2005-05 规范、2006-05-23 首批硅片
- **Claim**：AMD 以 Pacifica 为代号开发虚拟化扩展，2005 年 5 月发布规范（SVM），2006 年 5 月 23 日推出首批 AMD-V 处理器（Athlon 64 "Orleans"/"Windsor" 等）；AMD 后来在 Barcelona（2007）率先实现嵌套页表（RVI/NPT），Intel 以 EPT 跟进。
- **Source**：Wikipedia《x86 virtualization》AMD-V 一节
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：2005-05 / 2006-05-23
- **Excerpt**："On May 23, 2006, AMD released the Athlon 64 ('Orleans')… as the first AMD processors to support this technology." / "AMD Opteron CPUs beginning with the Family 0x10 Barcelona line… support a second generation hardware virtualization technology called Rapid Virtualization Indexing (formerly known as Nested Page Tables during its development), later adopted by Intel as Extended Page Tables (EPT)."
- **Context**：Intel 与 AMD 于 2005–2006 年各自独立推出互不兼容的扩展，"In 2005 and 2006, Intel and AMD (working independently) created new processor extensions… two separate, binary incompatible x86 virtualization extension variants"。
- **Confidence**：high

### E-11　VT-i（Silverdale）随安腾 Montecito 落地（2006-07-18）
- **Claim**：面向安腾（Itanium）的 VT-i（代号 Silverdale）随 Montecito（Itanium 2 9000 系列，90nm 双核）于 2006 年 7 月 18 日发布，是该系列首次集成硬件虚拟化技术。
- **Source**：中文维基百科《安腾》处理器列表
- **URL**：https://zh.wikipedia.org/zh-cn/%E5%AE%89%E8%85%BE
- **Date**：2006-07-18
- **Excerpt**："Montecito 90纳米 | 2006-07-18 | 1.4 GHz | … | 虚拟化技术、多线程、没有硬件IA-32支持"（安腾2 9000系列条目）
- **Context**：与 E-05 呼应（Intel 原称 Vanderpool 先用于安腾平台，后提前至 IA-32 桌面）；Uhlig 2005 论文（E-07）同时描述 IA-32 与 Itanium 两套扩展。
- **Confidence**：high（日期与特性），Silverdale 代号对应关系为 medium（行业通识，未见于该页原文）

### E-12　Intel Technology Journal 2006 虚拟化专刊：VT-x 论文
- **Claim**：2006 年 8 月 Intel Technology Journal 第 10 卷第 3 期为虚拟化专刊：Neiger 等《Intel Virtualization Technology: Hardware Support for Efficient Processor Virtualization》（pp.167–177）详解 VT-x 硬件设计。
- **Source**：Intel Technology Journal PDF（intel.com）；CSDN/ChinaUnix 文献引用
- **URL**：https://www.intel.com/content/dam/www/public/us/en/documents/research/2006-vol10-iss-3-intel-technology-journal.pdf
- **Date**：2006-08
- **Excerpt**："Gil Neiger, Amy Santoni, Felix Leung, Dion Rodgers, and Rich Uhlig. Intel Virtualization Technology: Hardware support for efficient processor virtualization. Intel Technology Journal, 10(3):167-177, August 2006."（CMU 讲义引用格式）
- **Context**：同刊还有 Dong 等《Extending Xen with Intel Virtualization Technology》（10(3):193-203），记录 Xen 对 VT-x 的早期适配（Xen 3.0，2005 末起支持 VT-x 全虚拟化）。
- **Confidence**：high

### E-13　VT-d：I/O 虚拟化规范与芯片组落地（2006 规范 / 2007 Q35）
- **Claim**：VT-d（Virtualization Technology for Directed I/O）由 Abramson 等在 Intel Technology Journal 10(3):179–192（2006-08）公开架构；其实现为芯片组级 IOMMU（DMA/中断重映射），商用芯片组以 2007 年的 Q35（Bearlake，2007 Q2/Q3）为早期代表，使设备直通（PCI passthrough）成为可能。
- **Source**：Intel Technology Journal 引文（ChinaUnix/CSDN 文献表）；搜狗百科 Bearlake 条目；QEMU Q35 文档博客
- **URL**：http://blog.chinaunix.net/uid-21211169-id-2406672.html ；http://baike.sogou.com/v143011.htm ；http://remimin.github.io/2019/07/09/qemu_machine_type/
- **Date**：2006-08（论文）；2007 Q2/Q3（Q35）
- **Excerpt**："Abramson D, Jackson J, Muthrasanallur S, et al. Intel Virtualization Technology for Directed I/O[J]. Intel Technology Journal. 2006, 10(3): 179–192."；"商务Q35：…支持Intel第二代主动管理技术AMT2、虚拟化技术VT、搭配ICH9DO南桥，2007年第二季度发布"；"Q35是Intel在2007年9月推出的芯片组…Q35 has IOMMU"
- **Context**：Wikipedia 确认 VT-d "included in most high-end (but not all) newer Intel processors since the Core 2 architecture"（严格说是芯片组+平台特性，需 BIOS 配合）；DMAR ACPI 表即 VT-d 的固件接口。
- **Confidence**：high（论文与 Q35 时间）；VT-d 首次公布于 2006 年 IDF Spring 的具体日期为 medium

### E-14　Core 2 时代：VT-x 普及与 FlexPriority/TPR shadow（2006–2007）
- **Claim**：Core 2（Merom/Conroe，2006-07 起）将 VT-x 带入主流，并增加 FlexPriority（TPR shadow，虚拟 APIC 任务优先级寄存器影子），减少中断相关 VM-exit。
- **Source**：Manjaro 论坛 inxi CPU dump（Merom, built 2006-09，flags 含 flexpriority tpr_shadow vmx）；Wikipedia 指令表（VMXON "Added in: Prescott 2M, Yonah"）
- **URL**：https://forum.manjaro.org/t/startx-only-displays-gui-if-killed-and-started-again/153085/3 ；https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions
- **Date**：2006-09（CPU 制造时间戳）
- **Excerpt**："CPU: Info: model: Intel Core2 Duo T7700 … arch: Core2 Merom level: v1 built: 2006-09 … Flags: … flexpriority … tpr_shadow … vmx vnmi vpid xtpr"
- **Context**：实测 flag 证明 2006 年 Merom 硅片已含 FlexPriority 与 TPR shadow；注意该 dump 同时列出 vpid，与 VPID 随 Nehalem（2008）引入的通识矛盾（可能为检测工具误标），VPID 归属仍以 E-23 为准。FlexPriority 品牌常与 Penryn（2007）并提，但 Merom 已具备硬件基础——此处标 medium。
- **Confidence**：medium

### E-15　VT-c：网络虚拟化（VMDq/SR-IOV 生态）
- **Claim**：VT-c（Virtualization Technology for Connectivity）是 Intel 面向网络 I/O 的虚拟化技术集（含 VMDq 等网卡卸载），并与 PCI-SIG SR-IOV（2007 年标准化的 PCIe 原生 IOV）共同构成网卡虚拟化路径。
- **Source**：Wikipedia《x86 virtualization》"Network virtualization (VT-c)" 与 SR-IOV 节
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：页面访问于本次研究
- **Excerpt**："Intel's 'Virtualization Technology for Connectivity' (VT-c)."；引用 Intel VT-c 官方 PDF（intel.com，2016 存档）与 SR-IOV 在 NASA 与 Amazon Public Cloud 达到 >95% 裸机带宽的案例。
- **Context**：VT-c 属网卡/平台层技术，无单一"发布日"；其生态随 82575/82576（2008）、82599（2009）等 Intel 网卡普及。
- **Confidence**：medium-high

---

## 4. 逐代微架构演进（Prescott → Granite Rapids）

### E-16–E-17　见第 5 节里程碑（KVM 2006-10 发布 / 2007-02-05 合入 2.6.20）

### E-19　FlexMigration：Xeon 7400 Dunnington（2008-09）
- **Claim**：2008 年 9 月 15 日（全球同步发布 9 月 22 日），Intel 发布 Xeon 7400 系列（Dunnington，45nm，业界首款六核），引入 FlexMigration——允许虚拟机在 Pentium 4/Core 2/未来 Nehalem 等不同代至强间热迁移（CPUID 屏蔽对齐），被 Intel 称为"虚拟化 2.0"标志。
- **Source**：百度百科 Xeon 7400 条目；驱动之家/中关村在线 2008-09 发布报道；新浪博客《英特尔7400带来x86服务器虚拟化新实践》
- **URL**：https://baike.baidu.com/item/%E8%8B%B1%E7%89%B9%E5%B0%94%E8%87%B3%E5%BC%BA%E5%A4%84%E7%90%86%E5%99%A87400%E7%B3%BB%E5%88%97/10233457 ；https://tech.sina.cn/2008-09-16/detail-iavxeafs3205521.d.html ；https://blog.sina.com.cn/s/blog_59eca0680100b0pc.html
- **Date**：2008-09-15/16/22
- **Excerpt**："2008年9月15日，英特尔发布…至强7400系列（代号Dunnington）…支持VT和FlexMigration虚拟化技术"；"新发布的7400平台提供了一种名为Flexmigration的增强虚拟化技术…使过去由虚拟化软件实现的同一代至强服务器热迁移扩展到了所有酷睿微架构的至强处理器…这一功能还将延伸到未来Nehalem至强处理器产品线中"
- **Context**：FlexMigration 是 VT-x 可维护性/数据中心运维维度的关键增强，与 EPT 并列为该时期两大虚拟化卖点。
- **Confidence**：high

### E-20　Adams & Agesen（VMware）：第一代硬件辅助并不更快（2006-10）
- **Claim**：VMware 工程师 Keith Adams 与 Ole Agesen 在 ASPLOS'06（2006-10-21–25, San Jose）发表论文《A Comparison of Software and Hardware Techniques for x86 Virtualization》，实测结论是：第一代 VT-x 因 VMM/guest 切换代价高、编程模型僵化，性能 rarely 优于软件二进制翻译——硬件虚拟化的价值需后续代际（EPT 等）兑现。
- **Source**：Wikipedia《x86 virtualization》参考 1；《Virtual machine》页引文
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization ；https://en.wikipedia.org/wiki/Virtual_machine
- **Date**：2006-10
- **Excerpt**："Surprisingly, we find that the first-generation hardware support rarely offers performance advantages over existing software techniques. We ascribe this situation to high VMM/guest transition costs and a rigid programming model that leaves little room for software flexibility in managing either the frequency or cost of these transitions."
- **Context**：该文也指出软件技术"made the x86 platform virtualizable in the sense of meeting the three criteria of Popek and Goldberg, albeit not by the classic trap-and-emulate technique"——为理解"为什么 Intel 还要继续迭代 EPT/VPID/APICv"提供直接动机。
- **Confidence**：high

### E-21　Nehalem：EPT 与 VPID（Core i7 2008-11 / Xeon 5500 2009-03-30）
- **Claim**：Intel 自 Nehalem 微架构（2008 年发布）起集成 EPT（Extended Page Tables，硬件二级地址翻译）与 VPID（Virtual Processor ID，TLB 标签化），消除影子页表与 VM 切换时的 TLB 全刷新，是内存虚拟化硬件化的里程碑。桌面 Core i7（Bloomfield）2008 年 11 月首发，服务器 Xeon 5500（Gainestown/Nehalem-EP）于 2009 年 3 月 30 日全球发布。
- **Source**：Wikipedia《x86 virtualization》《List of x86 virtualization instructions》；PC Watch（2009-03-31）；51CTO《至强处理器：我这十二年》；易优博客编年史
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization ；https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions ；https://pc.watch.impress.co.jp/docs/2009/0331/intel.htm ；https://www.51cto.com/article/138547.html
- **Date**：2008-11（Core i7）/ 2009-03-30（Xeon 5500）
- **Excerpt**："Intel started to include Extended Page Tables (EPT), a technology for page-table virtualization, since the Nehalem architecture, released in 2008."；指令表："INVEPT/INVVPID … Added in: Nehalem"；"米Intel は30日(現地時間)、サーバー/ワークステーション向けクアッドコアCPU「Xeon 5500番台」を発表した。これまで「Nehalem EP」のコードネームで呼ばれてきたCPU。"（PC Watch, 2009-03-31）
- **Context**：EPT 让 GVA→GPA→HPA 转换由硬件完成，"只有当EPT页表发生缺页时，才会触发VM-Exit"（奇安信研究），大幅降低内存虚拟化开销；VPID 用 16 位 ID 标记 TLB 项避免切换刷 TLB。
- **Confidence**：high

### E-22　Westmere：unrestricted guest（2010）
- **Claim**：2010 年 Westmere（32nm）增加 "unrestricted guest"：允许逻辑处理器直接以实模式进入 guest（VM-entry 可不开启分页），依赖 EPT；使得实模式/大实模式 guest（如 DOS、部分引导场景、Android 模拟器）无需软件模拟。
- **Source**：Wikipedia《x86 virtualization》
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：2010
- **Excerpt**："In 2010, Westmere added support for launching the logical processor directly in real mode – a feature called 'unrestricted guest', which requires EPT to work."（脚注引 Intel SDM："If the 'unrestricted guest' VM-execution control is 1, the 'enable EPT' VM-execution control must also be 1"）
- **Context**：至此 VT-x 的 CPU 虚拟化功能集基本完整（模式、内存、实模式），后续迭代转向中断/APIC、嵌套、安全与性能。
- **Confidence**：high

### E-23　Sandy Bridge（2011）/ Ivy Bridge–Haswell：中断与嵌套虚拟化硬件化
- **Claim**：APICv（APIC/中断虚拟化：virtual-interrupt delivery、APIC-register virtualization 等）由 Intel 于 2012 年公布，首批商用于 Ivy Bridge-EP（Xeon E5-26xx v2，2013 年底发布；E5-46xx v2 于 2014 年初）；Haswell（2013）增加 VMCS shadowing（嵌套虚拟化硬件加速）与 EPT Accessed/Dirty 位。
- **Source**：Wikipedia《x86 virtualization》APICv 节与 VMCS shadowing 节
- **URL**：https://en.wikipedia.org/wiki/X86_virtualization
- **Date**：2012（公布）/ 2013–2014（商用）
- **Excerpt**："Also in 2012, Intel announced a similar technology for interrupt and APIC virtualization… Later, it was branded as APIC virtualization (APICv) and it became commercially available in the Ivy Bridge EP series of Intel CPUs, which is sold as Xeon E5-26xx v2 (launched in late 2013) and as Xeon E5-46xx v2 (launched in early 2014)." / "Since the Haswell microarchitecture (announced in 2013), Intel started to include VMCS shadowing as a technology that accelerates nested virtualization of VMMs."
- **Context**：Sandy Bridge 代本身以 VM-entry/exit 延迟优化与 EPT 成熟化为主（未检索到该代独有新 VMX 控制位的权威一手出处，标注为推断，medium-low）；虚拟化功能维度的下一次硬升级即 APICv/VMCS shadowing。
- **Confidence**：high（APICv/VMCS shadowing）；Sandy Bridge 增量描述 medium-low

### E-24　Broadwell：posted interrupts（2014–2015）
- **Claim**：posted-interrupt processing（发布式中断，配合 VT-d 中断重映射，设备中断可不引发 VM-exit 直接投递给运行中的 vCPU）在 Broadwell 代引入，是中断虚拟化继 APICv 后的下一步。
- **Source**：Wikipedia 指令表脚注体系；Linux KVM posted interrupts 文档生态（检索交叉）
- **URL**：https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions
- **Date**：2014–2015
- **Excerpt**：（KVM/QEMU 特性字上下文）"vmx-posted-interrupt" 作为二级执行控制位出现于 Broadwell 代 CPU 模型（QEMU feature_word_info 列表，见 patchew.org QEMU patch [^1219^] 上下文中的 VMX 二级控制位定义序列）。
- **Context**：与 VT-d interrupt remapping 配合，是网卡/设备直通低延迟的关键；注意此项一手出处（Intel 官方"Broadwell 首发"表述）未直接检索到，依据社区共识与内核特性引入时间线，标 medium。
- **Confidence**：medium

### E-25　云计算兴起对 VT 的拉动（2006 起）
- **Claim**：2006 年 AWS 发布 S3 与 EC2（基于开源 Xen），IaaS 云计算时代开启，虚拟化从服务器整合工具升级为云基础设施底座，直接拉动 VT-x/VT-d 的普及与后续 EPT、SR-IOV 等演进。
- **Source**：《深入浅出系统虚拟化：原理与实践》（戚正伟等，电子工业出版社）1.2.1 节（腾讯读书/掌阅版）
- **URL**：https://m.xiaoshuo.qq.com/read/1047216525/12
- **Date**：2023（书籍电子版）；事件 2006
- **Excerpt**："2006年，AWS（Amazon Web Services，亚马逊云服务）发布了S3（Simple Storage Service，简单存储服务）和EC2，开始以虚拟机形式向企业提供IT基础设施服务（基于开源Xen搭建），开启了以IaaS为代表性技术的云计算时代。"
- **Context**：同书紧接记述 KVM 2007 年 2 月合入 2.6.20——硬件辅助虚拟化、开源 hypervisor 与云计算三线在 2005–2008 年汇合。51cto 编年史补充："2006 年 8 月，AWS发布EC2，云计算大幕正式拉开"。
- **Confidence**：high

### E-26　Skylake：VMFUNC / EPTP switching（2015；ISA 归属见争议节）
- **Claim**：VMFUNC（VM-function，0 号功能 EPTP switching：guest 内无需 VM-exit 即可在最多 512 个预置 EPTP 间切换页表视图）于 Skylake 代（2015）硬件可用，主要服务 VM introspection/安全监控（Xen 4.7，2016 起用于 introspection）。
- **Source**：Wikipedia《List of x86 virtualization instructions》（VMFUNC 功能定义）；行业共识（Xen/KVM 2015–2016 引入支持）
- **URL**：https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions
- **Date**：2015（Skylake）/ 2016（Xen 4.7）
- **Excerpt**："VMFUNC … Invoke VM function specified in EAX. … EAX=0: EPTP switching: switch extended page table pointer to one of up to 512 table pointers prepared in advance by the VM host. ECX specifies which one of the 512 pointers to use."
- **Context**：注意该 Wikipedia 表格将 VMFUNC "Added in" 标为 "Haswell, Silvermont"（指令在 ISA 文档中出现的时间），而硬件实际可用通常被归于 Skylake——两者并存报告，见第 6 节"争议与存疑"。
- **Confidence**：medium（世代归属存在来源分歧）

### E-27　Kaby Lake：MBEC（2016–2017）——修正主智能体背景中的"Skylake MBEC"
- **Claim**：MBEC（Mode-Based Execute Control，EPT 执行权限拆分 supervisor/user 两位）首现于 Kaby Lake（第 7 代，2016 末–2017），而非 Skylake；AMD 对应物 GMET 见于 Zen 2。MBEC 是 Windows HVCI（内存完整性）的硬件加速器。
- **Source**：LWN（KVM MBEC 补丁系列，2025）；Wikipedia《Second Level Address Translation》；微软文档转述
- **URL**：https://lwn.net/Articles/1051782/ ；https://en.wikipedia.org/wiki/Second_Level_Address_Translation
- **Date**：2016–2017（Kaby Lake）；LWN 文 2025-12
- **Excerpt**："Intel MBEC is a hardware feature, introduced in the Kabylake generation, that allows for more granular control over execution permissions."（LWN）/ "Mode Based Execution Control (MBEC) is an extension to x86 SLAT implementations first available in Intel Kaby Lake and AMD Zen 2 CPUs."（Wikipedia SLAT）
- **Context**：启用 MBEC 的嵌套暴露可使 Windows HVCI guest 的 VM-exit 从约 120 万/秒降至约 5 万/秒（24×）。**主智能体景观扫描将 MBEC 归于 Skylake，与本证据冲突，建议修正为 Kaby Lake。**
- **Confidence**：high

### E-28　Ice Lake-SP（第三代至强可扩展，2021-04）：I/O 虚拟化与 TME
- **Claim**：Ice Lake-SP（Sunny Cove，10nm）于 2021 年 4 月上市，虚拟化维度以"新的 I/O 虚拟化设计"（为大负载提供高达 3 倍带宽，配合 PCIe Gen4）与 TME（总内存加密，TDX 的技术前导之一）为主，VMX ISA 层面无重大新控制位。
- **Source**：虎嗅/华尔街见闻《三巨头混战，服务器芯片市场酝酿变局》；ITPUB《两个第三代处理器的故事》
- **URL**：https://www.huxiu.com/article/444785.html ；https://blog.itpub.net/28285180/viewspace-2788222/
- **Date**：2021-04（上市）；文章 2021-07/08
- **Excerpt**："今年早些时候，英特尔发布了第三代至强可扩展处理器 Ice Lake…新的 I/O 虚拟化设计，为大负载和集成PCIe Gen 4 控制器提供高达三倍的带宽；支持物理 RAM 的总内存加密"；"第三代至强可扩展处理器，称为Ice Lake，于2019年9月推出，该芯片于2021年4月上市"
- **Context**：Ice Lake 属过渡代：安全侧从 SGX/TME 走向 TDX，虚拟化 ISA 的下一跳在 Sapphire Rapids（IPI 虚拟化、TDX）。
- **Confidence**：high（发布时间与特性清单）

### E-29　Sapphire Rapids：IPI virtualization（Linux 5.19/6.0 支持，2022）
- **Claim**：IPI virtualization（处理器间中断虚拟化，消除源 vCPU 发 IPI 时的 VM-exit；含内存映射/MSR ICR 写与 SENDUIPI 的虚拟化）是 Sapphire Rapids（第四代至强可扩展）的新 VT-x 特性，Intel 于 2021 年在 PRM 更新中披露，KVM 支持于 Linux 5.19 准备、6.0 合入（2022）。
- **Source**：Phoronix（2022-05-13、2022-08-04）；patchew.org KVM 补丁 v8
- **URL**：https://www.phoronix.com/news/Intel-IPI-Virtualization-5.19 ；https://www.phoronix.com/news/Linux-6.0-KVM ；https://patchew.org/linux/20220411090447.5928-1-guang.zeng@intel.com/
- **Date**：2022-05 / 2022-08
- **Excerpt**："Intel VT-x's IPI Virtualization support is set to be introduced with the Linux 5.19 kernel for supporting this new hardware capability found with Xeon Scalable 4th Gen 'Sapphire Rapids' server processors."；"When IPI virtualization enabled, it will reduce 22.21% and 15.98% cycles consuming in xAPIC mode and x2APIC mode respectively."（Intel 工程师补丁说明）
- **Context**：同代还引入三级（tertiary）VM-execution 控制——VMX 控制位空间第三次扩展，本身即演进史的一个注脚。
- **Confidence**：high

### E-30/E-31　TDX：2020-08 公布 → Sapphire Rapids 首发（2023-01-10）
- **Claim**：Intel 于 2020 年 8 月公布 TDX（Trust Domain Extensions）白皮书与 CPU 架构扩展规范（向研究界征求反馈）；TDX 引入 SEAM（Secure Arbitration Mode）新模式、安全 EPT、PAMT、MKTME 内存加密与远程认证，实现将 VMM/云厂商排除在 TCB 之外的机密虚拟机（Trust Domain）。第四代至强可扩展（Sapphire Rapids，2023-01-10 发布）是首个集成 TDX 的至强平台；Emerald Rapids（第五代，2023-12）延续。
- **Source**：IEEE Access 论文（2021-06-07 出版，述及 2020-08 公布）；美国专利引用清单（列 Intel TDX White Paper, Aug. 2020）；Intel 中国支持页《英特尔至强处理器支持英特尔 TDX 有哪些？》；C114《第五代至强…》
- **URL**：https://ieeexplore.ieee.org/abstract/document/9448036 ；https://pubchem.ncbi.nlm.nih.gov/patent/US-12248807-B2 ；https://www.intel.com/content/www/cn/zh/support/articles/000091103/processors/intel-xeon-processors.html ；https://m.c114.com.cn/w138-1251228.html
- **Date**：2020-08（公布）/ 2023-01-10（SPR 发布）
- **Excerpt**："In August 2020, Intel asked the research community for feedback on the newly offered architecture extensions, called Intel Trust Domain Extensions (TDX)…"；"Intel, 'Intel(registered) Trust Domain Extensions', White Paper, Aug. 2020, 9 pages."；Intel 支持页："第四代英特尔®至强®可扩展系统（代号：蓝宝石急流）——首个引入英特尔® TDX的Intel Xeon平台"；"今年年初发布的第四代英特尔至强可扩展处理器中已集成英特尔 TDX"（C114，2023-12）
- **Context**：TDX 指令面新增 SEAMCALL/SEAMRET/SEAMOPS/TDCALL；Wikipedia 指令表标注 "Added in: (Sapphire Rapids), Emerald Rapids"。KVM 的 TDX 支持 RFC 于 2020-11-16 提交 LKML（lkml.org/lkml/2020/11/16/1106）。
- **Confidence**：high

### E-32　至强6：Sierra Forest（2024-06）与 Granite Rapids（2024-09），TDX Connect
- **Claim**：至强6 家族：Sierra Forest（全 E 核，144 核，Intel 3 工艺）2024 年 6 月 6 日发布；Granite Rapids（全 P 核）2024 年 9 月发布；延续 TDX 并新增 TDX Connect（CPU 与 PCIe 设备间加密连接，TEE-IO，TDX 2.0 方向）。
- **Source**：财联社（2024-06-06）；新浪财经（2025-06-10）；英特尔官网文章（2025-04-03）；MiTAC 产品页
- **URL**：https://www.cls.cn/detail/1697476 ；https://finance.sina.com.cn/roll/2025-06-10/doc-inezqrua5633024.shtml ；https://www.intel.cn/content/www/cn/zh/artificial-intelligence/new-xeon-6-products-cure-choice-difficulties.html
- **Date**：2024-06-06 / 2024-09
- **Excerpt**："今日召开的英特尔®至强®6能效核处理器新品发布会上，英特尔推出首款配备能效核的英特尔至强6处理器（代号Sierra Forest）…英特尔至强6性能核处理器（代号Granite Rapids）预计将于下季度推出"；"其从第四代至强®可扩展处理器开始集成的 TDX 技术…这次也随新品将机密计算的覆盖范围进一步增强，通过新增的 TDX Connect，可在 CPU 和 PCIe 设备之间实现高性能的加密连接"
- **Context**：Sierra Forest 面向云原生高密度虚拟化场景（288 核 SKU 规划），E 核同样提供完整 VT-x/TDX 能力——虚拟化功能集在 P/E 核间对齐是这一阶段的特点。
- **Confidence**：high

---

## 5. 重大里程碑：KVM、Hyper-V 与生态

### E-16　KVM 首次发布（2006-10-19，依赖 VT-x/AMD-V）
- **Claim**：以色列 Qumranet 公司 Avi Kivity 于 2006 年 10 月 19 日在 LKML 首次发布 KVM——从设计上直接依赖刚刚问世的硬件辅助虚拟化（VT-x/AMD-V），将 Linux 内核变为 hypervisor。
- **Source**：《深入浅出系统虚拟化：原理与实践》；Springer《Virtualization Technology》章节
- **URL**：https://m.xiaoshuo.qq.com/read/1047216525/12 ；https://link.springer.com/chapter/10.1007/978-981-19-3026-3_3
- **Date**：2006-10-19
- **Excerpt**："KVM由…Avi Kivity带领开发，并于2006年10月19日首次在Linux内核社区发布，发布不到半年时间，Linux就将其正式纳入内核官方版本"；"KVM was first developed by Qumranet and appeared on the Mailing List of the Linux kernel in October 2006… KVM uses a hardware virtualization approach based on Intel VT or AMD-V technology"
- **Context**：KVM 的存在本身就是 VT-x 生态影响的直接证据——"为什么重新造 hypervisor？Linux 就是 hypervisor"（Avi Kivity 的设计直觉）。
- **Confidence**：high

### E-17　KVM 合入 Linux 2.6.20（2007-02-05）
- **Claim**：KVM 于 2006 年 12 月进入 2.6.20-rc，2007 年 2 月 5 日随 Linux 2.6.20 正式合入主线——大型子系统并入内核史上最快的案例之一；2008 年 9 月 Red Hat 以 1.07 亿美元收购 Qumranet，RHEL 6（2010-11）起以 KVM 取代 Xen。
- **Source**：中文维基百科《基于内核的虚拟机》；Springer 章节；深信服社区；阿里云开发者社区
- **URL**：https://zh.wikipedia.org/zh-cn/%E5%9F%BA%E4%BA%8E%E5%86%85%E6%A0%B8%E7%9A%84%E8%99%9A%E6%8B%9F%E6%9C%BA ；https://link.springer.com/chapter/10.1007/978-981-19-3026-3_3 ；https://bbs.sangfor.com.cn/forum.php?mod=viewthread&tid=97321
- **Date**：2007-02-05
- **Excerpt**："KVM被合并入Linux内核版本2.6.20的主流分支，于2007年2月5日发布。"（维基）；"2006年12月将kvm合入内核(Linux 2.6.20rc)，2007年2月Linux2.6.20正式版发布。2008年9月Redhat以1.07亿美元收购Qumranet…2010年11月发布的RHEL6.0之后仅支持kvm"（深信服社区）
- **Context**：KVM 上游化使 VT-x 成为每个 Linux 发行版的"免费复选框"，为后来 OpenStack/公有云（GCE、AWS Nitro 均基于 KVM）奠基。
- **Confidence**：high

### E-18　Hyper-V（Viridian）RTM（2008-06-26）
- **Claim**：微软 Hyper-V（代号 Viridian，曾名 Windows Server Virtualization）随 Windows Server 2008（2008-02/03）附 Beta，RTM 正式版于 2008 年 6 月 26 日发布并经 Windows Update 推送（7 月 8 日起自动更新）；为微内核化 type-1 hypervisor，强制要求 Intel VT/AMD-V 硬件虚拟化。
- **Source**：中文维基百科《Hyper-V》；阿里云开发者社区《Hyper-V的版本》；看雪论坛 2008 年转帖
- **URL**：https://zh.wikipedia.org/zh-cn/Hyper-V ；https://developer.aliyun.com/article/478584 ；https://bbs.kanxue.com/thread-67708.htm
- **Date**：2008-06-26
- **Excerpt**："Hyper-V是与 Windows Server 2008 一起首次发布…最终版本于2008 年6月26日发布，并通过 Windows Update 提供。"；"用于Windows Server 2008 32/64位系统的Hyper-V RTM正式版已经独立发布，Windows Update自动升级则会在7月8日开始。"
- **Context**：Hyper-V 从设计起即不做二进制翻译，是纯硬件辅助虚拟化路线的标志性商业产品；其父分区架构依赖 VT-x + EPT（2008 R2 起支持 SLAT/EPT，2009-10 随 R2 RTM 普及）。
- **Confidence**：high

---

## 6. 关键功能 × 微架构 × 年份对照表（交叉核对结论）

| 功能 | 引入微架构 | 年份 | 证据 | 置信度 |
|---|---|---|---|---|
| VMX 基本指令集（VMXON 等 10 条） | Prescott 2M（Pentium 4 662/672）/ Yonah | 2005-11-14 / 2006 | E-08, E-14 | high |
| FlexPriority / TPR shadow | Core 2 Merom（硬件 2006，品牌常与 Penryn 2007 并提） | 2006–2007 | E-14 | medium |
| VT-i（安腾虚拟化） | Montecito | 2006-07-18 | E-11 | high |
| VT-d（IOMMU/DMA 重映射） | 芯片组级，Q35 等 Bearlake | 2006 规范 / 2007 落地 | E-13 | high |
| FlexMigration | Dunnington（Xeon 7400） | 2008-09 | E-19 | high |
| EPT（INVEPT）+ VPID（INVVPID） | Nehalem | 2008-11 / 2009-03 | E-21 | high |
| unrestricted guest | Westmere | 2010 | E-22 | high |
| APICv（中断/APIC 虚拟化） | Ivy Bridge-EP（Xeon E5 v2） | 2012 公布 / 2013 末商用 | E-23 | high |
| VMCS shadowing、EPT A/D 位 | Haswell | 2013 | E-23 | high |
| posted interrupts | Broadwell | 2014–2015 | E-24 | medium |
| VMFUNC（EPTP switching） | ISA 定义 Haswell 时代；硬件可用通常归 Skylake | 2013/2015 | E-26 | medium（有分歧） |
| MBEC | Kaby Lake（7代） | 2016–2017 | E-27 | high |
| TME / 新 I/O 虚拟化 | Ice Lake-SP | 2021-04 | E-28 | high |
| IPI virtualization、tertiary 控制 | Sapphire Rapids | 2021 披露 / 2023 产品 | E-29 | high |
| TDX（SEAM、安全 EPT、MKTME、远程认证） | 2020-08 公布；Sapphire Rapids 首发 | 2020 / 2023-01-10 | E-30/E-31 | high |
| TDX Connect（TEE-IO） | 至强6（Granite Rapids 6700/6500 等） | 2025 | E-32 | high |

---

## 7. 争议与存疑点（须向主智能体报告）

1. **MBEC 的世代归属**：主智能体背景写"Skylake（VMFUNC、MBEC）"。本次交叉核对中，LWN（KVM 补丁作者）与 Wikipedia《Second Level Address Translation》及微软文档转述均一致指向 **Kaby Lake（第 7 代）首现 MBEC**，未见任何来源支持 Skylake。建议主报告修正为"Skylake（VMFUNC）/ Kaby Lake（MBEC）"。置信度 high。
2. **VMFUNC 世代归属分歧**：Wikipedia《List of x86 virtualization instructions》将 VMFUNC 的 "Added in" 标为 **Haswell、Silvermont**（指令进入 ISA 文档的时间口径）；而工程社区（Xen 4.7 introspection、KVM 支持时间线 2015–2016）普遍以 **Skylake** 为硬件可用起点。两说并存，建议表述为"VMFUNC 指令于 Haswell 时代进入 SDM，Skylake 起硬件可用"，置信度 medium。
3. **FlexPriority 时间口径**：实测 2006-09 出厂 Merom 已含 flexpriority/tpr_shadow flag，但 Intel 品牌宣传多将其与 Penryn（2007）绑定；本文采"硬件 2006 / 品牌 2007"双口径，置信度 medium。
4. **posted interrupts 归属 Broadwell**：依据社区共识与 KVM 特性引入时间线，未检索到 Intel 官方"首发于 Broadwell"的一手表述，置信度 medium。
5. **Sandy Bridge（2011）**：未检索到该代独有新 VMX 功能的权威一手出处，仅以延迟优化与 EPT 成熟化概括，置信度 medium-low。
6. **VT-d "发布日"**：VT-d 架构论文为 2006-08（ITJ 10(3)），产业界常引"2006 年 IDF Spring 宣布"，未获 Intel 新闻稿原文直接确认具体日期，置信度 medium。
7. **"2003 年 Intel 宣布将在 x86 支持硬件虚拟化"**（elecfans 编年史单源）：与 2005-01-20 EAS 新闻稿不矛盾（可能指早期路线图披露），但仅一家之言，置信度 low。

---

## 8. 维度总结

Intel 虚拟化技术的演进是一条清晰的"理论缺口 → 软件绕行 → 硬件补课 → 逐代加固 → 安全升维"曲线：

1. **理论起点（1974/2000）**：Popek & Goldberg 给出可虚拟化判据；Robin & Irvine 证明 x86 因 17 条敏感非特权指令而不满足该判据，经典陷入-模拟不可行。
2. **软件绕行期（1998–2004）**：VMware 二进制翻译 + 影子页表（ring deprivileging）与 Xen 半虚拟化各自以巨大复杂度/ guest 修改为代价换取可用性，且 Intel 64 长模式下纯软件 64 位虚拟化不可行。
3. **硬件诞生（2005）**：Intel 以 Vanderpool 项目（2005-01-20 EAS、2005-05 IEEE Computer 论文、2005-08 IDF 细节）开路，2005-11-14 Pentium 4 662/672 首发 VT-x，引入 VMX root/non-root 双模式与 VMCS，敏感指令陷入问题在硬件层终结；安腾侧 VT-i 随 Montecito（2006-07）落地。
4. **家族化与性能补课（2006–2010）**：VT-d（2006 规范/2007 Q35）补 I/O，FlexMigration（2008-09 Dunnington）补跨代迁移，Nehalem EPT+VPID（2008/2009）补内存虚拟化，Westmere unrestricted guest（2010）补实模式——Adams & Agesen 指出的"第一代硬件不比软件快"在这一阶段被解决。
5. **中断与嵌套硬件化（2012–2017）**：APICv（Ivy Bridge-EP，2013 末）、VMCS shadowing（Haswell，2013）、posted interrupts（Broadwell）、VMFUNC（Skylake 硬件可用）、MBEC（Kaby Lake，2017）逐代削 VM-exit。
6. **生态里程碑（2006–2008）**：KVM 2006-10 发布、2007-02-05 合入 2.6.20；Hyper-V 2008-06-26 RTM；AWS EC2（2006）开启云时代——VT 从"特性"变为"基础设施"。
7. **安全升维（2020–2025）**：TDX 于 2020-08 公布、Sapphire Rapids（2023-01-10）首发，把虚拟化边界从"隔离 guest 之间"推进到"把 hypervisor/云厂商排除在 TCB 之外"；Ice Lake TME 铺路、Sapphire Rapids IPI 虚拟化削延迟、至强6（Sierra Forest 2024-06 / Granite Rapids 2024-09）以 TDX Connect 扩展至设备 I/O。

**核心结论**：VT 的演进驱动力从"可虚拟化"（2005）→"性能等价"（2008–2010 EPT/VPID）→"中断/嵌套开销"（2013–2017）→"云规模化与机密计算"（2020– ），每一代功能均可对应到具体微架构与年份，除 VMFUNC 世代归属存在来源分歧、MBEC 应为 Kaby Lake 两处需修正/标注外，主智能体景观扫描的时间线与本次考证一致。
