# 维度02：VT-x / VMX 核心架构与指令集 —— 工程细节深挖

> 研究范围：VMX 开启流程（VMXON）、VMCS 六大区域详解、VM-entry / VM-exit 微架构流程、
> 关键 VM-exit 原因与处理机制、控制位演进（primary → secondary → tertiary）、
> 拦截位图机制（MSR bitmap / I/O bitmap / exception bitmap / unrestricted guest）、设计哲学。
> 已确认基础事实（root/non-root 模式、13 条 VMX 指令、CPUID.01H:ECX[5] 检测、CR4.VMXE）不再重复论证。
> 搜索次数：27 次独立搜索 + 4 次 Intel SDM 原文页面核验。

---

## 1. VMX 开启流程：VMXON 的前置条件与 VMXON Region

### 1.1 开启序列与前置条件

**证据 1.1-A**
- **Claim**：进入 VMX operation 的完整序列为：(1) CPUID 检测 VMX 支持；(2) 按 IA32_VMX_CR0_FIXED0/1 与 IA32_VMX_CR4_FIXED0/1 调整 CR0/CR4；(3) 置 CR4.VMXE[bit13]=1；(4) 确保 IA32_FEATURE_CONTROL (MSR 3AH) 的 lock 位与 VMXON-enable 位已置位；(5) 分配 4KB 对齐的 VMXON region 并写入 VMCS revision identifier；(6) 执行 VMXON。
- **Source**：Intel SDM Vol.3C §23.7–23.8（xem.github.io 手册镜像）；revers.engineering "Day 2: Entering VMX Operation"
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1045.html ; https://revers.engineering/day-2-entering-vmx-operation/
- **Date**：SDM 镜像（无日期，对应 2017+ 版本手册）；2018-11-02
- **Excerpt**："Before system software can enter VMX operation, it enables VMX by setting CR4.VMXE[bit 13] = 1. VMX operation is then entered by executing the VMXON instruction. VMXON causes an invalid-opcode exception (#UD) if executed with CR4.VMXE = 0. Once in VMX operation, it is not possible to clear CR4.VMXE … System software leaves VMX operation by executing the VMXOFF instruction."（操作清单：1. Check if VMX operation is supported…3. Adjust CR4 and CR0 to supported values. 4. Enable VMX operation on each processor. 5. Set feature control bits to allows use of vmxon. 6. Execute vmxon, and enter VMX operation.）
- **Context**：VMXE 置位后进入 VMX operation 前不能清除；VMXOFF 是唯一退出路径。这是一手手册原文。
- **Confidence**：高

**证据 1.1-B**
- **Claim**：IA32_FEATURE_CONTROL (MSR 3AH) 三个相关位：bit0 = lock（为 0 时 VMXON 触发 #GP；置位后 WRMSR 写该 MSR 触发 #GP，直到下次上电复位——BIOS 借此提供禁用 VMX 的选项）；bit1 = SMX 内允许 VMXON；bit2 = SMX 外允许 VMXON。
- **Source**：Intel SDM Vol.3C §23.7 中译（看雪论坛）；felixcloutier.com VMXON 指令参考
- **URL**：https://bbs.kanxue.com/thread-272813.htm ; https://www.felixcloutier.com/x86/vmxon
- **Date**：2022-05-15；无日期
- **Excerpt**："位0是lock位：如果这个bit被清除了，VMXON会产生一个general-protection的异常。" / 伪代码："IF … (bit 0 (lock bit) of IA32_FEATURE_CONTROL MSR is clear) or (in SMX operation and bit 1 … is clear) or (outside SMX operation and bit 2 … is clear) THEN #GP(0)"
- **Context**：felixcloutier 是 Intel 官方指令集参考（Intrinsic Guide）的社区镜像，伪代码直接来自 SDM。
- **Confidence**：高

**证据 1.1-C**
- **Claim**：VMXON 的执行环境限制：寄存器操作数、CR0.PE=0、CR4.VMXE=0、RFLAGS.VM=1、IA-32e 模式下 CS.L=0 时触发 #UD；CPL>0、A20M 模式、CR0/CR4 值不受 VMX 支持时触发 #GP(0)。VMXON 成功后 current-VMCS pointer 置为 FFFFFFFF_FFFFFFFFH，并阻塞 INIT 信号、禁用 A20M。
- **Source**：felixcloutier.com — VMXON — Enter VMX Operation（指令伪代码）
- **URL**：https://www.felixcloutier.com/x86/vmxon
- **Date**：无日期（镜像 Intel SDM Vol.2 指令参考）
- **Excerpt**："IF (register operand) or (CR0.PE = 0) or (CR4.VMXE = 0) or (RFLAGS.VM = 1) or (IA32_EFER.LMA = 1 and CS.L = 0) THEN #UD; … IF addr is not 4KB-aligned or addr sets any bits beyond the physical-address width THEN VMfailInvalid; … rev[30:0] ≠ VMCS revision identifier … THEN VMfailInvalid; ELSE current-VMCS pointer := FFFFFFFF_FFFFFFFFH; enter VMX operation; block INIT signals; block and disable A20M"
- **Context**：VMX 指令失败分两级：VMfailInvalid（RFLAGS.CF=1）与 VMfailValid（RFLAGS.ZF=1，错误号写入 VMCS 的 VM-instruction error field）。
- **Confidence**：高

**证据 1.1-D**
- **Claim**：VMX operation 对 CR0/CR4 的固定位约束由 4 个能力 MSR 描述：IA32_VMX_CR0_FIXED0 (0x486)、IA32_VMX_CR0_FIXED1 (0x487)、IA32_VMX_CR4_FIXED0 (0x488)、IA32_VMX_CR4_FIXED1 (0x489)。FIXED0 中为 1 的位在 CR0 中必须为 1；FIXED1 中为 0 的位必须为 0。第一代 VMX 处理器要求 CR0.PE=1、CR0.NE=1、CR0.PG=1、CR4.VMXE=1，即只能在分页保护模式下进入 VMX operation——这正是不支持 unrestricted guest 的旧 CPU 无法直接运行实模式 Guest 的原因。VMX operation 内用 CLTS/LMSW/MOV CR 修改这些固定位为非法值会触发 #GP。
- **Source**：Intel SDM Vol.3C §23.8 + NOTES；Writing Hypervisor in Zig — VMX Root Operation
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1045.html ; https://hv.smallkirby.com/en/vmm/vmx_root
- **Date**：无日期；无日期
- **Excerpt**："The first processors to support VMX operation require that the following bits be 1 in VMX operation: CR0.PE, CR0.NE, CR0.PG, and CR4.VMXE. The restrictions on CR0.PE and CR0.PG imply that VMX operation is supported only in paged protected mode…Therefore, guest software cannot be run in unpaged protected mode or in real-address mode." / "The value of CR0 is constrained by two MSRs: IA32_VMX_CR0_FIXED0 and IA32_VMX_CR0_FIXED1. If the N-th bit of the former is 1, then CR0[N] must be set to 1. Conversely, if the N-th bit of the latter is 0, then CR0[N] must be set to 0."
- **Context**：这是 VT-x 第一代（2005–2008，Presler/Penryn）的重要历史限制，后由 Westmere 的 unrestricted guest 解除（见 §8.4）。
- **Confidence**：高

### 1.2 VMXON Region

**证据 1.2-A**
- **Claim**：VMXON 操作数是一个 m64 内存操作数，指向 VMXON region：物理地址必须 4KB 对齐（bit 0–11 为 0），region 大小 4KB（由 IA32_VMX_BASIC[44:32] 报告，上限 4KB），使用前需清零并仅写入前 32 位 = IA32_VMX_BASIC[30:0] 的 VMCS revision identifier（bit31 必须为 0；bit31=1 表示 shadow VMCS）。VMCS/VMXON region 应以回写（WB）内存类型维护，用 UC 类型会显著损害性能。
- **Source**：OSDev Wiki — VMX；看雪《Hypervisor From Scratch – 第3部分》（引 Intel SDM §24.11.5）
- **URL**：https://wiki.osdev.org/VMX ; https://bbs.kanxue.com/thread-281145.htm
- **Date**：2026-03-17（wiki 最近修订）；2024-03-30
- **Excerpt**："The memory region needs to be 4096-byte aligned (bits 0-11 must be 0) and the only VMCS field that should be modified is the VMCS revision identification field. This ID field should contain the value in bits 0-31 of MSR IA32_VMX_BASIC." / "获取修订标识符从IA32_VMX_BASIC_MSR 并将其写入 VMXON 区域……为确保VMX操作中的正确行为，应在回写机制可缓存内存中维护VMCS区域和相关结构……强烈建议不要这样做（UC映射），因为这样做会导致使用这些结构的转换性能明显受损。"
- **Context**：VMXON region 与 VMCS region 格式约定相同（revision ID + abort indicator + 数据区），但 VMXON region 不通过 VMREAD/VMWRITE 访问。
- **Confidence**：高

---

## 2. VMCS 结构详解

### 2.1 总体组织：六大逻辑区域

**证据 2.1-A**
- **Claim**：VMCS 数据区分为六个逻辑组：(1) Guest-state area——VM-exit 时保存、VM-entry 时加载处理器状态；(2) Host-state area——仅 VM-exit 时加载（从不由硬件保存，由 VMM 在 VMLAUNCH/VMRESUME 前用 VMWRITE 预置）；(3) VM-execution control fields——控制 non-root 下处理器行为（拦截配置）；(4) VM-exit control fields——控制 VM-exit 行为；(5) VM-entry control fields——控制 VM-entry 行为与事件注入；(6) VM-exit information fields——只读，硬件在 VM-exit 时填写退出原因与详情。VMCS 布局是实现相关的（implementation-defined），字段只能通过 VMREAD/VMWRITE 按 32 位编码访问，不可用普通内存读写。
- **Source**：Intel SDM Vol.3C §24.2（经 StackOverflow #67467483 引用）；CTF Wiki《CPU 虚拟化》；hvisor 手册
- **URL**：https://stackoverflow.com/questions/67467483/ ; https://ctf-wiki.org/zh-tw/pwn/virtualization/basic-knowledge/cpu-virtualization/ ; https://hvisor.syswonder.org/chap04/subchap01/X86_64Virtualization.html
- **Date**：2021-05-10；2022-08-29；无日期
- **Excerpt**："The VMCS data are organized into six logical groups: Guest-state area. Processor state is saved into the guest-state area on VM exits and loaded from there on VM entries. Host-state area. Processor state is loaded from the host-state area on VM exits…" 高赞回答："The CPU never saves the host state. The VMM controls when to execute vmlaunch/vmresume and can thus set the host state area accordingly before their execution."
- **Context**："Host 状态不保存" 是 VMX 与 AMD SVM（VM_HSAVE 保存 host 部分状态）的设计差异点；VMM 每次 entry 前负责保证 host-state 字段正确。
- **Confidence**：高

**证据 2.1-B**
- **Claim**：VMCS 字段编码（32 位）格式：bit0 = access type（0=full，1=high，仅 64 位字段可用 high 访问高 32 位）；bits 9:1 = index；bits 11:10 = type（0=control、1=VM-exit information、2=guest-state、3=host-state）；bit12 保留；bits 14:13 = width（0=16-bit、1=64-bit、2=32-bit、3=natural-width）；bits 31:15 保留。所有字段编码枚举于 SDM Vol.3D 附录 B。
- **Source**：Intel SDM Vol.3D Appendix B（xem 镜像）；GiantVM/KVM-Annotation Wiki
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1951.html ; https://github-wiki-see.page/m/GiantVM/KVM-Annotation/wiki/Intel-IA32-Manual-VMX-Section-%5BCh.-23~Ch.-33%5D
- **Date**：无日期；无日期
- **Excerpt**："Every component of the VMCS is encoded by a 32-bit field that can be used by VMREAD and VMWRITE…A value of 0 in bits 14:13 of an encoding indicates a 16-bit field." / "Bit 0：Access Type…Bit 9:1：Index…Bit 11:10：Field Type，0为Control，1为VM-Exit Information，2为Guest State，3为Host State…Bit 14:13：Width，0表示16-bit，1表示64-bit，2表示32-bit，3表示natural width"
- **Context**：例如 EXCEPTION_BITMAP 编码 0x4004（control+32bit+index2），SECONDARY_VM_EXEC_CONTROL 编码 0x401E。
- **Confidence**：高

### 2.2 Guest-state area / Host-state area 字段内容

**证据 2.2-A**
- **Claim**：Guest-state area 的寄存器状态包括：CR0/CR3/CR4、DR7、RSP/RIP/RFLAGS，CS/SS/DS/ES/FS/GS/LDTR/TR 的（选择子、基址、限长、访问权限），GDTR/IDTR（基址、限长），以及 MSR：IA32_DEBUGCTL、IA32_SYSENTER_CS/ESP/EIP、IA32_PERF_GLOBAL_CTRL、IA32_PAT、IA32_EFER。非寄存器状态包括：activity state（active / HLT / shutdown / wait-for-SIPI）、interruptibility state（STI/MOV-SS blocking、NMI blocking 等）、pending debug exceptions、VMCS link pointer、VMX-preemption timer value、PAE 分页时的 PDPTE0–3。Host-state area 不含 LDTR/activity state 等非寄存器字段（VM-exit 后处理器总是 active、无事件阻塞），含 CR0/CR3/CR4、RSP/RIP、CS/SS/DS/ES/FS/GS/TR 选择子、FS/GS/TR/GDTR/IDTR 基址、IA32_SYSENTER_* 与可选 IA32_PAT/IA32_EFER/IA32_PERF_GLOBAL_CTRL。
- **Source**：xchen.cc《VT VMCS结构信息》（按 Intel 手册整理的 VMCS 数据区）
- **URL**：https://xchen.cc/post/vtvmcs/
- **Date**：无日期
- **Excerpt**："1.1客户机寄存器状态内容…控制寄存器: CR0, CR3, CR4…CS, SS, DS, ES, FS, GS, LDTR, TR选择子, 基址, 段长, 属性…GDTR, IDTR, 基址, 段长…IA32_DEBUGCTL, IA32_SYSENTER_CS…IA32_EFER / 1.2客户机非寄存器状态内容：活动性状态(Activity State):活跃的(Active), 中断的(hlt), 关闭的(Shutdown), 等待SIPI中断(Wait-for-SIPI)…PDPTE项(开启了EPT模式会用到此域)PDPTE0-PDPTE3 / 2.宿主机状态域…在发生#VMExit事件的时候恢复到相应寄存器"
- **Context**：段寄存器"隐藏部分"（基址/限长/属性）全部纳入 VMCS，因为描述符缓存可能与内存中描述符不一致——这是硬件全虚拟化的关键完整性要求。
- **Confidence**：高

### 2.3 VM-execution control fields（拦截配置核心）

**证据 2.3-A（pin-based）**
- **Claim**：Pin-based VM-execution controls（32 位，VMCS 编码 0x4000）管理异步事件：bit0 external-interrupt exiting（=1 时所有外部中断引发 VM-exit，且 RFLAGS.IF 不再影响屏蔽）；bit3 NMI exiting；bit5 virtual NMIs（真实 NMI 永不被阻塞，interruptibility state 的 bit3 改指"虚拟 NMI 阻塞"）；bit6 activate VMX-preemption timer（non-root 中倒计时到 0 触发 VM-exit，用于 vCPU 时间片）；bit7 process posted interrupts（配合 posted-interrupt descriptor 实现硬件中断直投）。能力由 IA32_VMX_PINBASED_CTLS / IA32_VMX_TRUE_PINBASED_CTLS 报告；首批 VMX 处理器仅支持 bit 1/2/4 的 1-setting。
- **Source**：Intel SDM Vol.3C 表 24-5/27-5 中译（看雪 thread-292798）；CSDN《虚拟化技术（2）：VMCS 结构》
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://blog.csdn.net/qq_48466156/article/details/151683482
- **Date**：2026-08-28；2025-09-14
- **Excerpt**："如果此控制为 1，外部中断导致 VM 退出。否则，它们正常交付。如果此控制为 1，RFLAGS.IF 的值不影响中断阻止。" / "Activate VMX-preemption timer…当定时器倒计时到零时发生 VM 退出"
- **Context**：KVM 的 setup_vmcs_config() 中 `min = PIN_BASED_EXT_INTR_MASK | PIN_BASED_NMI_EXITING; opt = PIN_BASED_VIRTUAL_NMIS | PIN_BASED_POSTED_INTR | PIN_BASED_VMX_PREEMPTION_TIMER;`（51cto KVM 源码解析，https://blog.51cto.com/u_16213718/11216128 ），即外部中断与 NMI 强制退出，其余可选。
- **Confidence**：高

**证据 2.3-B（primary processor-based）**
- **Claim**：Primary processor-based VM-execution controls（32 位，编码 0x4002）管理同步指令事件，主要位包括：interrupt-window exiting、use TSC offsetting、HLT/INVLPG/MWAIT/RDPMC/RDTSC exiting、CR3-load/CR3-store exiting、CR8-load/CR8-store exiting、use TPR shadow、NMI-window exiting、MOV-DR exiting、unconditional I/O exiting、use I/O bitmaps、monitor trap flag、use MSR bitmaps、MONITOR exiting、PAUSE exiting、bit31 activate secondary controls、（新）activate tertiary controls。能力由 IA32_VMX_PROCBASED_CTLS / IA32_VMX_TRUE_PROCBASED_CTLS 报告；首批 VMX 处理器强制 bit1、4–6、8、13–16、26 为 1。bit31=0 时整个 secondary controls 视为全 0。
- **Source**：看雪 thread-292798（SDM 中译）；VirtualBox VT-x 特性 dump（superuser，真实硬件枚举）；KVM vmx.c
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://superuser.com/questions/1877472/ ; https://cgit.freedesktop.org/drm-intel/tree/arch/x86/kvm/vmx/vmx.c
- **Date**：2026-08-28；2025-02-09；2025-04-09
- **Excerpt**："主要基于处理器的 VM 执行控制的第 31 位决定是否使用次要基于处理器的 VM 执行控制。如果该位为 0，VM 进入和 VMX 非根操作的表现就像所有次要基于处理器的 VM 执行控制都为 0。" / KVM: `min = CPU_BASED_VIRTUAL_INTR_PENDING | CPU_BASED_USE_TSC_OFFSETING | CPU_BASED_HLT_EXITING | … ; opt = CPU_BASED_TPR_SHADOW | CPU_BASED_USE_MSR_BITMAPS | CPU_BASED_ACTIVATE_SECONDARY_CONTROLS;`
- **Context**：VirtualBox dump 显示真实 CPU 上这些位几乎全部为 {0,1} 可配置，体现可扩展能力报告机制的实际形态。
- **Confidence**：高

**证据 2.3-C（exception bitmap / I/O bitmap / TSC offset / CR mask & shadow / CR3-target）**
- **Claim**：VM-execution 控制字段还包括：exception bitmap（32 位，每位对应一个异常向量，=1 则该异常触发 VM-exit；#PF 由 bit14 + page-fault error-code mask/match 联合判定）；I/O bitmap A/B 物理地址（各 4KB，A 覆盖端口 0000H–7FFFH，B 覆盖 8000H–FFFFH）；MSR bitmap 地址；TSC offset / TSC multiplier；CR0/CR4 的 guest/host mask 与 read shadow（mask 置 1 的位为 host 拥有：guest 写不同值触发 VM-exit、读返回 shadow 值；置 0 的位 guest 自有）；CR3-target count 与 4 个 CR3-target 值（MOV CR3 源操作数匹配其一则不退出）。
- **Source**：看雪 thread-292798（SDM §24.6 中译）；arceos 2024-virtualization-campus 教程
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://github.com/arceos-hypervisor/2024-virtualization-campus/blob/master/hypervisor/x86_64/02-vmcs.md
- **Date**：2026-08-28；2023-10-30
- **Excerpt**："异常位图是一个 32 位字段，每个异常对应一位…如果该位为 1，异常导致 VM 退出。" / "VM 执行控制字段包括 I/O 位图 A 和 B 的 64 位物理地址（每个大小为 4 KBytes）。I/O 位图 A 为范围 0000H 至 7FFFH 的每个 I/O 端口包含一位；I/O 位图 B 为范围 8000H 至 FFFFH 的端口包含位。" / "客户/宿主掩码中设置为 1 的位对应于宿主'拥有'的位：客户尝试将它们设置为与相应读阴影中相应位不同的值的操作导致 VM 退出。客户读取…从这些位从相应的读阴影返回值。"
- **Context**：CR0/CR4 mask+shadow 机制允许 VMM 对 guest"撒谎"（如隐藏 CR4.VMXE），同时对关键位保持控制——是"不改变指令语义但可虚拟化"的典型实现。
- **Confidence**：高

### 2.4 VM-exit control fields / VM-entry control fields

**证据 2.4-A**
- **Claim**：VM-exit controls（32 位，编码 0x400C）关键位：bit2 save debug controls（VM-exit 时保存 DR7 与 IA32_DEBUGCTL；首批 VMX 处理器强制为 1）；bit9 host address-space size（每次 VM-exit 载入 CS.L、IA32_EFER.LME/LMA，决定 exit 后是否 64 位模式）；bit12 load IA32_PERF_GLOBAL_CTRL；bit15 acknowledge interrupt on exit（外部中断类退出时向中断控制器应答取向量，写入 VM-exit interruption-information 并置 valid）；bit18/19 save/load IA32_PAT；bit20/21 save/load IA32_EFER；bit22 save VMX-preemption timer；后续扩展 clear IA32_BNDCFGS、conceal VMX from PT、load CET state、load PKRS 等。VM-entry controls（编码 0x4012）关键位：bit2 load debug controls、bit9 IA-32e mode guest（entry 时载入 EFER.LME/LMA 与 CS.L）、bit3 entry to SMM、bit4 deactivate dual-monitor treatment、load IA32_PERF_GLOBAL_CTRL/PAT/EFER/BNDCFGS/CET 等；另有 VM-entry MSR-load count/address 与事件注入三字段。
- **Source**：Intel SDM Vol.3C §24.7–24.8 表 24-10（xem 镜像 page 1063）；tandasat《Hypervisor enforced security policies》（逐位对照表）；看雪 292798
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1063.html ; https://tandasat.github.io/blog/2024/02/12/hyper-v-configs.html ; https://bbs.kanxue.com/thread-292798.htm
- **Date**：无日期；2024-02-12；2026-08-28
- **Excerpt**："9 Host address-space size — On processors that support Intel 64 architecture, this control determines whether a logical processor is in 64-bit mode after the next VM exit. Its value is loaded into CS.L, IA32_EFER.LME, and IA32_EFER.LMA on every VM exit." / "15 Acknowledge interrupt on exit … the logical processor acknowledges the interrupt controller, acquiring the interrupt's vector. The vector is stored in the VM-exit interruption-information field, which is marked valid."
- **Context**：64 位 host 必须置 host address-space size=1 与 load IA32_EFER=1，否则 VM-exit 后 EFER 状态错误。KVM 设置 `VM_EXIT_IA32E_MODE`（Hypervisor From Scratch 第6部分代码可见）。
- **Confidence**：高

**证据 2.4-B（事件注入）**
- **Claim**：VM-entry 事件注入由三个字段组成：VM-entry interruption-information field（32 位：bit7:0 向量、bit10:8 类型[0=外部中断/2=NMI/3=硬件异常/4=软中断/5=特权软异常/6=软异常/7=其他]、bit11 deliver error code、bit31 valid）、VM-entry exception error code、VM-entry instruction length。每次 VM-entry 切换到 guest 后、执行第一条 guest 指令前，CPU 检查 bit31，为 1 则按向量与类型在 guest 中引发异常/中断/NMI，用 guest 自己的 IDT 处理——guest 视角与物理机完全一致。
- **Source**：CSDN《内核虚拟化：CPU虚拟化硬件支持》；博客园 onetrainee《VT技术对于除零异常的拦截与派发到3号中断》
- **URL**：https://blog.csdn.net/weixin_46324627/article/details/135638989 ; https://www.cnblogs.com/onetrainee/p/13582705.html
- **Date**：2024-01-17；2020-08-29
- **Excerpt**："每次VM-Entry时，在切换到客户机环境后即将执行客户机指令前，CPU会检查这个32位字段的最高位（即bit31）。如果为1，则根据bit10:8指定的中断类型和bit7:0指定的向量号在当前的客户机中引发一个异常、中断或NMI…这样在客户机虚拟CPU看来，这些事件就和没有虚拟化的环境里面对应的事件没有任何区别。"
- **Context**：VMM 拦截异常后通常不自己处理，而是通过事件注入"转发"给 guest——保证 guest 语义不变的又一关键机制。
- **Confidence**：高

### 2.5 VM-exit information fields

**证据 2.5-A**
- **Claim**：VM-exit information fields 为只读（VMWRITE 失败），硬件在每次 VM-exit 时填写，包括：exit reason（32 位，低 16 位基本原因、bit31 表示 VM-entry 失败类退出）、exit qualification（64 位，格式随原因而变）、guest-linear address、guest-physical address（EPT violation 时的 GPA）、VM-exit interruption-information / interruption error code（记录 exit 期间发生的向量事件）、IDT-vectoring information、VM-exit instruction length、VM-exit instruction information、I/O RCX/RSI/RDI/RIP（INS/OUTS 类）等。exit qualification 对以下原因有效：#DB、#PF、SIPI、task switch、INVEPT/INVLPG/INVVPID、描述符表指令、VMCLEAR/VMPTRLD/VMPTRST/VMREAD/VMWRITE/VMXON、XSAVES/XRSTORS、CR 访问、MOV DR、I/O 指令、MWAIT、APIC-access、EPT violation。
- **Source**：Intel SDM Vol.3C §24.9/§27.2 中译（看雪 292798）；Intel SDM page 1123（xem 镜像）
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1123.html
- **Date**：2026-08-28；无日期
- **Excerpt**："退出资格（Exit qualification，64 位…）。此字段包含关于以下原因导致的 VM 退出的附加信息：调试异常；页故障异常；启动 IPI（SIPI）；任务切换；INVEPT；INVLPG；INVVPID；LGDT；LIDT；LLDT；LTR；SGDT；SIDT；SLDT；STR；VMCLEAR；VMPTRLD；VMPTRST；VMREAD；VMWRITE；VMXON；XRSTORS；XSAVES；控制寄存器访问；MOV DR；I/O 指令；以及 MWAIT。该字段的格式取决于 VM 退出的原因。"
- **Context**：典型处理流：`VMREAD EXIT_REASON → VMREAD EXIT_QUALIFICATION → VMREAD VM_EXIT_INSTRUCTION_LEN → 模拟/转发 → guest RIP += instruction length → VMRESUME`（KVM exit handler 与 Peach VM 等教学 hypervisor 均如此）。
- **Confidence**：高

---

## 3. VM-entry 流程：VMLAUNCH vs VMRESUME、检查与加载

### 3.1 VMCS 状态机与两条进入指令

**证据 3.1-A**
- **Claim**：每个 VMCS 有 active/current 与 launch state（clear / launched）两组状态属性。VMLAUNCH 只能用于 launch state = "clear" 的 VMCS（成功后置为 "launched"）；VMRESUME 只能用于 "launched" 状态的 VMCS。VMCLEAR 将 VMCS 置为 inactive/not-current/clear 并确保其数据写回内存（迁移 VMCS 到另一逻辑核前必须 VMCLEAR，迁移后首次进入须重新 VMLAUNCH）；VMPTRLD 使其成为 active+current。Intel 明确预期 VMRESUME 延迟低于 VMLAUNCH。launch state 无硬件查询接口，须软件跟踪。
- **Source**：Intel SDM Vol.3C §24.11.3（xem 镜像 page 1073）；felixcloutier VMLAUNCH/VMRESUME；Writing Hypervisor in Zig — Basics of VMCS
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1073.html ; https://www.felixcloutier.com/x86/vmlaunch:vmresume ; https://hv.smallkirby.com/en/vmm/vmcs
- **Date**：无日期；无日期；无日期
- **Excerpt**："VMCLEAR should be executed for a VMCS before it is used for VM entry for the first time. VMLAUNCH should be used for the first VM entry using a VMCS after VMCLEAR has been executed… VMRESUME should be used for any subsequent VM entry… It is expected that, in general, VMRESUME will have lower latency than VMLAUNCH." / "VMLAUNCH fails if the launch state of current VMCS is not 'clear'. If the instruction is successful, it sets the launch state to 'launched.' VMRESUME fails if the launch state of the current VMCS is not 'launched.'"
- **Context**：KVM 在 vCPU 结构体中缓存 launched 标志以选择 VMLAUNCH/VMRESUME；vCPU 跨核调度（migration）会强制 VMCLEAR，造成一次 VMLAUNCH 开销。
- **Confidence**：高

### 3.2 VM-entry 的检查与加载序列

**证据 3.2-A**
- **Claim**：VM-entry 按序执行：(1) 基本检查（在 VMX operation、CPL=0、current-VMCS 有效、无 MOV-SS 阻塞等）；(2) 检查 VMX 控制字段与 host-state 区域（失败 → VMfailValid，控制权落到 VMLAUNCH/VMRESUME 的下一条指令）；(3) 检查 guest-state 区域并加载 guest 状态（含控制寄存器、段寄存器、RIP/RSP/RFLAGS、PDPTE）、清除地址范围监控；(4) 从 VM-entry MSR-load area 加载 MSR；(5) VMLAUNCH 则将 launch state 置 "launched"；(6) 事件注入；(7) 特殊后续（activity state 更新、VMX-preemption timer 启动、interrupt-window/NMI-window 评估）。若 host/controls 检查通过但 guest-state 检查失败，则按 host-state 区域加载状态、跳到 host RIP（视同一次 VM-exit，exit reason bit31=1 表示 failed VM-entry）。
- **Source**：Intel SDM Vol.3C 第 27 章（看雪中译 thread-281369）；felixcloutier VMLAUNCH/VMRESUME 伪代码；StackOverflow #67467483
- **URL**：https://bbs.kanxue.com/thread-281369.htm ; https://www.felixcloutier.com/x86/vmlaunch:vmresume ; https://stackoverflow.com/questions/67467483/
- **Date**：2024-04-22；无日期；2021-05-10
- **Excerpt**："1. 执行基本检查以确保 VM entry可以开始…2. 检查 VMCS 的控制和host状态区域…3. …检查 VMCS 的guest状态区域…处理器状态从客户状态区域加载…地址范围监控已清除。4. MSR 从 VM-entry MSR 加载区域加载…5. 如果正在执行 VMLAUNCH，VMCS 的启动状态将设置为'已启动'…7. 事件可以被注入到guest上下文中" / "Failure to pass checks on the VMX controls or on the host-state area passes control to the instruction following the VMLAUNCH or VMRESUME instruction. If these pass but checks on the guest-state area fail, the logical processor loads state from the host-state area of the VMCS, passing control to the instruction referenced by the RIP field in the host-state area."
- **Context**：SDM §27.2/27.3 的检查极其细致（如 host 选择子 RPL/TI 必须为 0、CS/TR 选择子非空、IA-32e 一致性：EFER.LMA=1 时 host address-space size 必须为 1 且 CR4.PAE=1 等），构成 VMX 安全边界的一部分。
- **Confidence**：高

---

## 4. VM-exit 流程：状态保存顺序、exit reason 与 qualification

### 4.1 硬件执行顺序

**证据 4.1-A**
- **Claim**：VM-exit 硬件流程（原子发生，无指令边界歧义）：(1) 将退出信息写入 VM-exit information fields（exit reason、qualification、guest linear/physical address、interruption info 等）；(2) 将 guest 处理器状态存入 guest-state area（CR0/CR3/CR4、DR7、段与描述符表寄存器、RIP/RSP/RFLAGS、MSR 及非寄存器状态）；(3) 按 VM-exit MSR-store area/count 保存指定 MSR；(4) 按 host-state area 与 VM-exit controls 加载 host 状态（含 CS.L/EFER 由 host address-space size 决定）；(5) 从 VM-exit MSR-load area 加载 host MSR；(6) 转入 VMX root operation，从 host RIP 开始执行 VMM 的 exit handler。部分状态（通用寄存器、XMM 等）不在 VMCS 自动保存范围内，由 VMM 软件自行保存。
- **Source**：博客园《Virtualization and Performance: Understanding VM Exits》；OneNoughtOne《Hardware Virtualization Support》
- **URL**：https://www.cnblogs.com/kelamoyujuzhen/p/10115167.html ; https://www.onenoughtone.com/learn/hardware-virtualization-support
- **Date**：2018-12-13；2026-03-19
- **Excerpt**："1. 在VM-exit information fields 处记录导致VM Exit的信息（包括exit reason, exit qualification, guest address）…2. 保存处于Guest Mode状态下的CPU状态，包括control registers, debug registers, MSRs, segment registers, descriptor-table registers, RIP, RSP, and RFLAGS…3. 将MSRs保存到VM-exit MSR-store area 4. 根据host-state area和一些VM-exit controls加载processor state…5. 从VM-exit MSR-load area加载MSRs"
- **Context**：通用寄存器不自动保存是 VMX 的设计取舍（减少固定开销），KVM 的 vmx_vcpu_run 汇编负责保存/恢复 GPR；这与 AMD SVM 类似。
- **Confidence**：高

### 4.2 Exit reason 编码

**证据 4.2-A**
- **Claim**：基本 exit reason 为 VMCS exit-reason 字段低 16 位（bit31 = VM-entry 失败标志，KVM 中 VMX_EXIT_REASONS_FAILED_VMENTRY = 0x80000000）。权威编码（FreeBSD bhyve vmcs.h 与 Linux arch/x86/include/asm/vmx.h 一致）：0 exception/NMI、1 external interrupt、2 triple fault、3 INIT、4 SIPI、5 I/O SMI、6 SMI、7 interrupt window、8 NMI window、9 task switch、10 CPUID、11 GETSEC、12 HLT、13 INVD、14 INVLPG、15 RDPMC、16 RDTSC、17 RSM、18 VMCALL、19 VMCLEAR、20 VMLAUNCH、21 VMPTRLD、22 VMPTRST、23 VMREAD、24 VMRESUME、25 VMWRITE、26 VMXOFF、27 VMXON、28 CR access、29 DR access、30 I/O instruction、31 RDMSR、32 WRMSR、33 invalid guest state（entry 失败）、34 MSR-load 失败、36 MWAIT、37 MTF、39 MONITOR、40 PAUSE、41 MCE during entry、43 TPR below threshold、44 APIC access、45 virtualized EOI、46 GDTR/IDTR access、47 LDTR/TR access、48 EPT violation、49 EPT misconfiguration、50 INVEPT、51 RDTSCP、52 VMX-preemption timer、53 INVVPID、54 WBINVD、55 XSETBV、56 APIC write、58 INVPCID 等（后续还有 RDRAND 57?—以最新 SDM 为准：57 RDRAND、59 VMFUNC、60 ENCLS、61 RDSEED、62 PML full、63 XSAVES、64 XRSTORS、66 SPP、68 UMWAIT/TPAUSE…）。
- **Source**：FreeBSD src sys/amd64/vmm/intel/vmcs.h（MIT 镜像）；Linux 3.7 arch/x86/include/asm/vmx.h（huihoo 镜像）
- **URL**：http://web.mit.edu/freebsd/head/sys/amd64/vmm/intel/vmcs.h ; https://docs.huihoo.com/doxygen/linux/kernel/3.7/vmx_8h_source.html
- **Date**：无日期（FreeBSD head）；Linux 3.7（2012）
- **Excerpt**："#define EXIT_REASON_EXCEPTION 0 … #define EXIT_REASON_CPUID 10 … #define EXIT_REASON_CR_ACCESS 28 #define EXIT_REASON_DR_ACCESS 29 #define EXIT_REASON_INOUT 30 #define EXIT_REASON_RDMSR 31 #define EXIT_REASON_WRMSR 32 … #define EXIT_REASON_EPT_FAULT 48 #define EXIT_REASON_EPT_MISCONFIG 49 … #define EXIT_REASON_VMX_PREEMPT 52 … #define EXIT_REASON_APIC_WRITE 56"
- **Context**：两个独立操作系统实现（FreeBSD bhyve 与 Linux KVM）编码一致，交叉验证了 SDM 附录 C 的权威编号。
- **Confidence**：高（0–58 逐项）；中（59+ 的完整新编号建议以最新 SDM 附录 C 复核）

### 4.3 Exit qualification 典型格式

**证据 4.3-A（CR 访问）**
- **Claim**：CR-access（reason 28）的 exit qualification：bits 3:0 = CR 编号（CLTS/LMSW 时为 0；不支持 Intel 64 的 CPU bit3 恒 0 即无 CR8）；bits 5:4 = 访问类型（0=MOV to CR、1=MOV from CR、2=CLTS、3=LMSW）；bit6 = LMSW 操作数类型（0=寄存器/1=内存）；bits 11:8 = MOV CR 的通用寄存器编号（0=RAX…15=R15）；bits 31:16 = LMSW 源数据。
- **Source**：Intel SDM Vol.3C §27.2.1 Table 27-3（xem 镜像 page 1124）
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1124.html
- **Date**：无日期（SDM 镜像）
- **Excerpt**："3:0 Number of control register (0 for CLTS and LMSW)…5:4 Access type: 0 = MOV to CR, 1 = MOV from CR, 2 = CLTS, 3 = LMSW…11:8 For MOV CR, the general-purpose register: 0 = RAX 1 = RCX…8–15 represent R8–R15"
- **Context**：Hypervisor 用该字段直接解码指令语义，无需反汇编 guest 指令流——VMX "完整信息退出" 设计大幅降低模拟成本（对比早期需解析指令的做法）。
- **Confidence**：高

**证据 4.3-B（I/O 指令）**
- **Claim**：I/O-instruction（reason 30）的 exit qualification：bits 2:0 = 访问大小（0=1字节/1=2字节/3=4字节）；bit3 = 方向（0=OUT，1=IN）；bit4 = 串指令；bit5 = REP 前缀；bit6 = 操作数编码（0=DX，1=立即数）；bits 31:16 = 端口号。
- **Source**：Intel SDM Vol.3C Table 27-5（xem 镜像 page 1126）
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1126.html
- **Date**：无日期
- **Excerpt**："2:0 Size of access: 0 = 1-byte 1 = 2-byte 3 = 4-byte…3 Direction of the attempted access (0 = OUT, 1 = IN) 4 String instruction…5 REP prefixed…6 Operand encoding (0 = DX, 1 = immediate)…31:16 Port number"
- **Context**：KVM handle_io 据此构造 kvm_exit 的 KVM_EXIT_IO 事件交给 QEMU 模拟设备；ins/outs 时另读 guest-linear address 字段。
- **Confidence**：高

**证据 4.3-C（EPT violation）**
- **Claim**：EPT-violation（reason 48）的 exit qualification：bit0 = 由数据读引起；bit1 = 由数据写引起（read-modify-write 恒置 bit1，bit0 视实现而定）；bit2 = 由取指引起；bit3 = 所经 EPT 项的 R 位之逻辑与；bit4 = W 位之与；bit5 = X 位之与；bit6 = XD 位之与…（bit12 与 NMI/virtual-NMI blocking 相关）；guest-physical address 字段给出出错的 GPA。EPT misconfiguration（reason 49）指 EPT 项本身格式非法（如保留位置位、R=0&W=1）。
- **Source**：Intel SDM Vol.3C Table 27-7（xem 镜像 page 1127）；看雪 292798
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1127.html
- **Date**：无日期
- **Excerpt**："0 Set if the access causing the EPT violation was a data read. 1 Set if the access causing the EPT violation was a data write. 2 Set if the access causing the EPT violation was an instruction fetch. 3 The logical-AND of bit 0 in the EPT paging-structure entries used to translate the guest-physical address…An EPT violation that occurs during as a result of execution of a read-modify-write operation sets bit 1 (data write). Whether it also sets bit 0 (data read) is implementation-specific"
- **Context**：MMIO 模拟（QEMU/KVM）即依赖 EPT violation：GPA 未映射 → exit → 按 GPA 分发到设备模型。bit3/4/5 区分"页不存在"与"权限不足"。
- **Confidence**：高

---

## 5. 关键 VM-exit 原因与处理机制

**证据 5-A（无条件 vs 可控退出）**
- **Claim**：无条件 VM-exit（不受控制位关闭）：CPUID、GETSEC、所有 VMX 指令（non-root 下执行）、VMCALL、INIT/SIPI 信号、triple fault、task switch、VM-entry 失败。可控退出按类别：中断与 interrupt/NMI window、I/O 端口、EPT 控制的内存访问、HLT/PAUSE/MWAIT/MONITOR 与 preemption timer（多 VM 分片）、描述符表与 CR/DR 访问、APIC 访问、MSR（bitmap 控制）、RDTSC/RDTSCP/RDPMC、RDRAND/RDSEED、XSAVES/XRSTORS、WBINVD、XSETBV 等。
- **Source**：3mdeb blog《VMX exit reasons and handlers》
- **URL**：https://blog.3mdeb.com/2020/2020-01-23-vmx-exit-reasons-and-handlers/
- **Date**：2020-01-23
- **Excerpt**："Unconditional reasons for VM exit include: CPUID; RDMSR and WRMSR unless MSR bitmap is used; most of VMX instructions; INIT signal; SIPI signal…triple fault; task switches…; VM entry failure. …controllable exit reasons…interrupts or interrupt windows; I/O ports access; memory access - controlled by EPT; HLT/PAUSE and pre-emption timer…changes to descriptor tables and control registers; APIC access"
- **Context**：CPUID 无条件退出是"VMM 必须能控制 guest 可见特性集"这一原则的体现（guest OS 移植性/热迁移要求特性掩码由 VMM 定义）。
- **Confidence**：高

**证据 5-B（KVM 的分发表）**
- **Claim**：Linux KVM 用一张按 exit reason 索引的函数指针表 kvm_vmx_exit_handlers[] 分发：EXCEPTION_NMI→handle_exception、EXTERNAL_INTERRUPT→handle_external_interrupt、IO_INSTRUCTION→handle_io、CR_ACCESS→handle_cr、DR_ACCESS→handle_dr、CPUID→handle_cpuid、MSR_READ/WRITE→handle_rdmsr/handle_wrmsr、HLT→handle_halt、VMCALL→handle_vmcall、EPT_VIOLATION→handle_ept_violation、EPT_MISCONFIG→handle_ept_misconfig、APIC_ACCESS/WRITE→handle_apic_*、PML_FULL→handle_pml_full、XSAVES/XRSTORS→handle_xsaves/handle_xrstors 等约 50 项；未知 reason 则 dump_vmcs 并退出到用户态。若 guest 处于无法原生运行的状态（无 unrestricted guest 的旧 CPU 上的实模式代码），走 handle_invalid_guest_state 全软件模拟路径。
- **Source**：KVM 源码分析（内核 4.4，tangzichengcc.github.io）；kernel-internals.org KVM Exit Handling
- **URL**：https://tangzichengcc.github.io/虚拟化入门-2-KVM源码分析之上下文切换的执行流-内核4-4版本/ ; https://kernel-internals.org/virtualization/kvm-exits/
- **Date**：2023-09-28；无日期
- **Excerpt**："static int (*const kvm_vmx_exit_handlers[])(struct kvm_vcpu *vcpu) = { [EXIT_REASON_EXCEPTION_NMI] = handle_exception, … [EXIT_REASON_CPUID] = handle_cpuid, … [EXIT_REASON_EPT_VIOLATION] = handle_ept_violation, … }; / if (vmx->vt.emulation_required) return handle_invalid_guest_state(vcpu);"
- **Context**：真实生产 hypervisor 的处理机制：大部分 exit 在内核内闭环处理，仅 I/O、MMIO 等需上行到 QEMU（KVM_EXIT_IO/KVM_EXIT_MMIO）。
- **Confidence**：高

**证据 5-C（外部中断与 NMI 处理）**
- **Claim**：外部中断 VM-exit（reason 1）：external-interrupt exiting=1 时所有物理中断先退出到 VMM；若 acknowledge interrupt on exit=1，硬件取向量写入 VM-exit interruption-information（type=external interrupt），KVM 的 vmx_handle_external_intr 按向量查 host IDT 直接调用 host 中断处理。NMI：NMI exiting=1 时退出，通常 VMM 注入回 guest 或在 host 处理；virtual NMIs=1 时用虚拟 NMI 阻塞机制避免重入问题。interrupt-window exiting：VMM 有待注入中断但 guest 处于 RFLAGS.IF=0 时置位，guest 一旦可接收中断即触发 reason 7 退出，完成注入后清除该位。
- **Source**：CSDN《QEMU/KVM中断虚拟化源码解析》；51cto《KVM怎么选CPU Model》（KVM 源码）
- **URL**：https://blog.csdn.net/zhangtongjian12/article/details/132008424 ; https://blog.51cto.com/u_16213718/11216128
- **Date**：2023-07-30；2024-06-21
- **Excerpt**："比如 External-interrupt exiting 设置为1表示所有的外部中断都会产生VMExit，否则由VM自己处理" / "vmx_handle_external_intr()…u32 exit_intr_info = vmcs_read32(VM_EXIT_INTR_INFO);…vector = exit_intr_info & INTR_INFO_VECTOR_MASK; desc = (gate_desc *)vmx->host_idt_base + vector; … CALL_NOSPEC"
- **Context**：这就是"中断先给 host、需要时再以事件注入给 guest"的完整闭环；posted interrupts（见 §7）可让直通设备中断免退出直投 guest。
- **Confidence**：高

---

## 6. 控制位演进：secondary / tertiary processor-based controls

### 6.1 Secondary processor-based VM-execution controls

**证据 6.1-A（位定义）**
- **Claim**：Secondary processor-based VM-execution controls（32 位，VMCS 编码 0x401E，仅当 primary bit31=1 时生效），能力由 IA32_VMX_PROCBASED_CTLS2 (MSR 0x48B) 报告。SDM 表 24-7 前 9 位：bit0 virtualize APIC accesses、bit1 enable EPT、bit2 descriptor-table exiting、bit3 enable RDTSCP、bit4 virtualize x2APIC mode、bit5 enable VPID、bit6 WBINVD exiting、bit7 unrestricted guest、bit8 APIC-register virtualization、bit9 virtual-interrupt delivery；后续位：bit10 PAUSE-loop exiting、bit11 RDRAND exiting、bit12 enable INVPCID、bit13 enable VM functions、bit14 VMCS shadowing、bit15 enable ENCLS exiting、bit16 RDSEED exiting、bit17 enable PML、bit18 EPT-violation #VE、bit19 conceal VMX from PT、bit20 enable XSAVES/XRSTORS、bit21 PASID translation、bit22 mode-based execute control for EPT、bit23 sub-page write permissions for EPT、bit24 PT uses guest-physical addresses、bit25 use TSC scaling、bit26 enable user wait/pause（UMWAIT/TPAUSE）、bit27 enable PCONFIG、bit28 enable ENCLV、bit30 bus-lock detection、bit31 instruction timeout/notification VM-exiting。
- **Source**：Intel SDM Vol.3C Table 24-7（xem 镜像 page 1057）；看雪 292798（中译）；Zig hypervisor 教程的 packed struct 定义
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1057.html ; https://bbs.kanxue.com/thread-292798.htm ; https://hv.smallkirby.com/vmm/ept
- **Date**：无日期；2026-08-28；无日期
- **Excerpt**："0 Virtualize APIC accesses…1 Enable EPT — If this control is 1, extended page tables (EPT) are enabled. 2 Descriptor-table exiting — …LGDT, LIDT, LLDT, LTR, SGDT, SIDT, SLDT, and STR cause VM exits. 3 Enable RDTSCP…5 Enable VPID…7 Unrestricted guest — 此控制决定客户软件是否可以在非分页保护模式或实地址模式下运行。8 APIC-register virtualization…"
- **Context**：保留位必须按 CTLS2 能力 MSR 设置，否则 VM-entry 失败（SDM §26.2.1.1）。
- **Confidence**：高

**证据 6.1-B（KVM 启用集与演进时间线）**
- **Claim**：KVM 对 secondary controls 的可选启用集（setup_vmcs_config / adjust_vmx_controls）为：VIRTUALIZE_APIC_ACCESSES、VIRTUALIZE_X2APIC_MODE、WBINVD_EXITING、ENABLE_VPID、ENABLE_EPT、UNRESTRICTED_GUEST、PAUSE_LOOP_EXITING、DESC、ENABLE_RDTSCP、ENABLE_INVPCID、APIC_REGISTER_VIRT、VIRTUAL_INTR_DELIVERY、SHADOW_VMCS、XSAVES、RDSEED_EXITING、RDRAND_EXITING、ENABLE_PML、TSC_SCALING、ENABLE_USR_WAIT_PAUSE、PT_USE_GPA、PT_CONCEAL_VMX、ENABLE_VMFUNC、BUS_LOCK_DETECTION、NOTIFY_VM_EXITING、ENCLS_EXITING——并据此激活 tertiary controls。该清单的逐年增长直观反映了微架构演进：EPT/VPID（Nehalem/Westmere 代）→ unrestricted guest（Westmere）→ APICv（APIC-register virtualization / virtual-interrupt delivery，Ivy Bridge）→ VMFUNC、VMCS shadowing、EPTP list（Haswell 代）→ PML、#VE、TSC scaling（Broadwell/Skylake）→ XSAVES、RDSEED/RDRAND exiting、ENCLS（Skylake+）→ bus-lock detection、notify VM-exit、UMWAIT（Ice Lake/Tremont 代）。
- **Source**：LKML《[PATCH 04/14] KVM: VMX: Extend VMX controls macro shenanigans》（含完整 KVM_OPT 宏清单）；Linux KVM vmx.c（drm-intel 镜像）
- **URL**：https://lkml.iu.edu/hypermail/linux/kernel/2206.3/03639.html ; https://cgit.freedesktop.org/drm-intel/tree/arch/x86/kvm/vmx/vmx.c
- **Date**：2022-06（LKML）；2025-04-09（镜像）
- **Excerpt**："+ KVM_OPT_VMX_SECONDARY_VM_EXEC_CONTROL (SECONDARY_EXEC_VIRTUALIZE_APIC_ACCESSES | … SECONDARY_EXEC_ENABLE_EPT | SECONDARY_EXEC_UNRESTRICTED_GUEST | … SECONDARY_EXEC_APIC_REGISTER_VIRT | SECONDARY_EXEC_VIRTUAL_INTR_DELIVERY | SECONDARY_EXEC_SHADOW_VMCS | SECONDARY_EXEC_XSAVES | … SECONDARY_EXEC_ENABLE_VMFUNC | SECONDARY_EXEC_BUS_LOCK_DETECTION | SECONDARY_EXEC_NOTIFY_VM_EXITING | SECONDARY_EXEC_ENCLS_EXITING) + #define KVM_OPT_VMX_TERTIARY_VM_EXEC_CONTROL (TERTIARY_EXEC_IPI_VIRT)"
- **Context**：微架构归属为综合多方资料（Westmere 引入 unrestricted guest 有百度百科与 jailhouse 文档佐证，见 §8.4）；APIC-register virtualization/virtual-interrupt delivery 属 Ivy Bridge 代 APICv；VMFUNC/EPTP-switching 属 Haswell 代。各代归属为推断+二手资料，置信度略低于位定义本身。
- **Confidence**：位清单=高；逐代归属=中高

**证据 6.1-C（APICv 三件套）**
- **Claim**：APIC 虚拟化（APICv）核心：virtualize APIC accesses（bit0，guest 访问 APIC-access page 时产生 APIC-access VM-exit 或被虚拟化）；APIC-register virtualization（bit8，对 virtual-APIC page 的 APIC 寄存器读写由硬件直接虚拟化，无需退出）；virtual-interrupt delivery（bit9，硬件评估 pending 虚拟中断并直接递送：条件为 RFLAGS.IF=1、无 STI/MOV-SS 阻塞、interrupt-window exiting=0；递送更新 guest interrupt status 的 RVI/SVI）；配合 pin-based 的 process posted interrupts + posted-interrupt descriptor（256 位 PIR bitmap + ON 位 + notification vector）实现设备直通中断的硬件直投（posted-interrupt processing）。
- **Source**：博客园《APIC虚拟化 - Edver》；CSDN《QEMU/KVM中断虚拟化源码解析》
- **URL**：https://www.cnblogs.com/edver/p/15747890.html ; https://blog.csdn.net/zhangtongjian12/article/details/132008424
- **Date**：2022-05-10；2023-07-30
- **Excerpt**："Posted Interrupt，它引入了一个Posted-Interrupt Notification Vector（VMCS[0x0002]…）和一个64字节…的Posted-Interrupt Descriptor…第0-255位为Posted-Interrupt Requests (PIR)，是一个Bitmap…第256位为Outstanding Notification (ON)" / "virtual-interrupt delivery 设置为1则当 VM entry/TPR virtualization/EOI virtualization/self-IPI virtualization/posted-interrupt processing 时会触发evaluate pending中断…1. RFLAGS.IF = 1 2. 没有因为STI产生的blocking 3. 没有因为MOV SS或者POP SS产生的blocking 4. …interrupt-window exiting bit 为0"
- **Context**：APICv 将最频繁的 exit 源（APIC TPR/EOI 访问、中断注入）硬件化，是 interrupt-heavy 负载性能的关键。
- **Confidence**：高

### 6.2 Tertiary processor-based VM-execution controls

**证据 6.2-A**
- **Claim**：Tertiary processor-based VM-execution controls 为 64 位向量（VMCS 编码 0x2034），仅当 primary "activate tertiary controls"=1 时生效；能力 MSR 为 IA32_VMX_PROCBASED_CTLS3 (MSR 0x492)，全部 64 位均为 allowed-1 语义（能报告的位才可置 1）。已知位：bit0 LOADIWKEY exiting、bit1 enable HLAT（hypervisor-managed linear-address translation）、bit2 EPT paging-write control、bit3 guest-paging verification、bit4 IPI virtualization（IPIv，KVM 宏 TERTIARY_EXEC_IPI_VIRT）、bit5 virtualize IA32_SPEC_CTRL（部分资料列 bit6）等。
- **Source**：掘金《虚拟机中的 IPI 优化: IPIv》；LKML《[PATCH 10/15] kvm/vmx/nested: Support new IA32_VMX_PROCBASED_CTLS3 vmx capability MSR》；VMware 社区 VT-x 能力 dump
- **URL**：https://juejin.cn/post/7328431191600807962 ; https://lkml.iu.edu/2106.0/00236.html ; https://community.broadcom.com/vmware-cloud-foundation/communities/community-home/digestviewer/viewthread?GroupId=7171&MessageKey=5a65972e-cd27-4e57-95a6-dcdcc2277980&CommunityKey=fb707ac3-9412-4fad-b7af-018f5da56d9c
- **Date**：2024-01-27；2021-06；2026-07-01
- **Excerpt**："需要将 tertiary processor-based VM-execution controls 的 bit4 置为 1。linux 中定义了 TERTIARY_EXEC_IPI_VIRT…它由寄存器 IA32_VMX_PROCBASED_CTLS3 (MSR 492H) 决定" / "MSR_IA32_VMX_PROCBASED_CTLS3 is 64bit, all allow-1 (must-be-0) semantics" / VMware dump: "Tertiary Processor-Based VM-Execution Controls: LOADIWKEY exiting / Enable HLAT / Enable Paging-Write / Enable Guest Paging Verification / Enable IPI Virtualization"
- **Context**：IPIv（Alder Lake/Sapphire Rapids 代）让 guest 写 self-IPI MSR / 发 IPI 时由硬件直接转换成对目标 vCPU virtual-APIC page 的 posted-interrupt 请求，消除 IPI 密集负载（如内核调度抢占）的大量 exit；HLAT（Sapphire Rapids）让 guest 页表 walker 在硬件校验下直接翻译线性地址，防 guest 页表篡改。
- **Confidence**：位定义与 MSR 语义=高；微架构归属=中（综合推断）

### 6.3 VMFUNC 与 EPTP switching

**证据 6.3-A**
- **Claim**：VM-function controls 为 64 位字段，仅当 secondary bit13 (enable VM functions)=1 时存在；bit0 = EPTP switching，其余保留（能力由 IA32_VMX_VMFUNC 报告）。支持该功能时 VMCS 提供 EPTP-list address 指向 4KB 对齐的 512×8 字节 EPTP 列表。Guest 在 non-root 下执行 VMFUNC（EAX=功能号，ECX=EPTP 索引）即可在不产生 VM-exit 的情况下切换当前 EPTP——单次切换 <200 周期，远快于一次 hypervisor 陷入（数百到数千周期），且不发生控制流重定向。VMCS 另有 EPTP index（16 位）字段记录当前索引。
- **Source**：arXiv《Pomegranate: A Lightweight Compartmentalization Architecture using Virtualization Extensions》；看雪 thread-291370（VMFUNC 配置代码）；CSDN《虚拟化技术（2）：VMCS 结构》
- **URL**：https://arxiv.org/html/2605.07008v1 ; https://bbs.kanxue.com/thread-291370.htm ; https://blog.csdn.net/qq_48466156/article/details/151683482
- **Date**：2026-05-07；2026-05-28；2025-09-14
- **Excerpt**："The Intel vmfunc instruction avoids this cost by allowing the guest to switch EPTs directly. The hypervisor pre-loads an EPTP list with up to 512 EPT root pointers. The guest issues a vmfunc with the desired index to switch the active EPT while remaining in guest mode. The instruction completes in less than two hundred cycles." / "__vmx_vmwrite(VMCS_VMFUNC_CONTROLS, 1ULL); DECLSPEC_ALIGN(PAGE_SIZE) ULONG64 eptpList[512]; … VMFUNC: EAX=0 (function=EPTP Switching), ECX=1 (EPTP index)"
- **Context**：VMFUNC 体现了 VT-x 演进方向：把高频 hypervisor 交互（EPT 视图切换）下沉为 guest 可直接执行的硬件原语，减少 exit。被安全领域用于"双视图内存"（clean/hooked EPT 切换）。
- **Confidence**：高

---

## 7. 拦截机制：MSR bitmap / I/O bitmap / exception bitmap / TSC offset

### 7.1 MSR bitmap

**证据 7.1-A**
- **Claim**：MSR bitmap 为一页 4KB、分 4 个 1KB 区域：+0 低段读位图（MSR 00000000H–00001FFFH 的 RDMSR）、+1024 高段读位图（C0000000H–C0001FFFH 的 RDMSR）、+2048 低段写位图、+3072 高段写位图；仅当 primary "use MSR bitmaps"=1 时启用。启用后，RDMSR/WRMSR 的 RCX 值落在两个范围之外、或对应位为 1，即触发 VM-exit；位为 0 则直通（passthrough）不退出。位图地址必须 4KB 对齐。
- **Source**：Intel SDM Vol.3C §24.6.9（xem 镜像 page 1060）；liujunming.github.io《MSR management in QEMU/KVM》
- **URL**：https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1060.html ; http://liujunming.github.io/2021/12/26/MSR-management-in-QEMU-KVM/
- **Date**：无日期；2021-12-26
- **Excerpt**："Read bitmap for low MSRs (located at the MSR-bitmap address). This contains one bit for each MSR address in the range 00000000H to 00001FFFH… Write bitmap for high MSRs (located at the MSR-bitmap address plus 3072)… an execution of RDMSR or WRMSR causes a VM exit if the value of RCX is in neither of the ranges covered by the bitmaps or if the appropriate bit in the MSR bitmaps is 1."
- **Context**：KVM 实际运用：TSC 直通（clear bit）而 SPEC_CTRL 拦截（set bit），见 vmx_set_msr_bitmap_read/write；未启用 bitmap 时所有 RDMSR/WRMSR 无条件退出（3mdeb 佐证）。
- **Confidence**：高

### 7.2 I/O bitmap 与 exception bitmap（含 #PF 特殊判定）

**证据 7.2-A**
- **Claim**：I/O bitmap A/B 各 4KB：A 覆盖端口 0000H–7FFFH、B 覆盖 8000H–FFFFH，每端口 1 位，=1 则 IN/OUT/INS/OUTS 访问该端口触发 VM-exit；primary 中 "unconditional I/O exiting"=1 时不查位图全部退出，"use I/O bitmaps"=1 时按位图判定。Exception bitmap 为 32 位、每异常向量 1 位；#PF（向量 14）特殊：计算 `PFEC & PFEC_MASK == PFEC_MATCH`，相等则按 bitmap bit14 执行，不等则按 bit14 的反义执行——因此"所有 #PF 都退出"= bit14=1, mask=0, match=0；"所有 #PF 都不退出"= bit14=1, mask=0, match=FFFFFFFFh；也可选择性只拦截某类 #PF（如 mask=0x1F/match=0x10 只拦截保护错误类）。
- **Source**：看雪 292798（SDM §24.6 中译）；GitHub SunLin19《Kernel/virtualization/kvm/exception.md》；xml-data.org 学术论文
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://github.com/SunLin19/Kernel/blob/master/virtualization/kvm/exception.md ; http://www.xml-data.org/JSJYY/2017-2-388.htm
- **Date**：2026-08-28；2019-06-05；2017-02-03
- **Excerpt**："处理器检查 if PFEC & PFEC_MASK == PFEC_MATCH — 如果相等，则遵循异常位图中第 14 位的规范…如果不相等，则该位的含义相反" / "PFEC_MASK表示PAGE_FAULT_ERROR_CODE_MASK字段中的内容，设置为0x1F；PFEC_MATCH…设置为0x10…可以避免其他类型的page fault异常陷入KVM带来的不必要的性能损耗"
- **Context**：KVM 影子页表时代用 #PF 拦截维护影子页；EPT 时代该机制更多用于安全监控（如论文中的文件完整性监控）。#DB 异常另有 pending debug exceptions 字段交互。
- **Confidence**：高

### 7.3 TSC offsetting 与 RDTSC 拦截

**证据 7.3-A**
- **Claim**：primary "use TSC offsetting"=1 时，guest 执行 RDTSC/RDTSCP/rdmsr(IA32_TIME_STAMP_COUNTER) 的返回值 = 真实 TSC + VMCS 中的 64 位 TSC offset（不改语义、无需退出）；配合 "RDTSC exiting" 可强制退出（反检测/沙箱场景伪造时间）；secondary bit25 TSC scaling 再提供 TSC multiplier 实现频率缩放。VMCS 的 TSC offset 编码为 0x2010。
- **Source**：CSDN《虚拟化技术&VMCS》；deepwiki cpu-internals VMCS 字段表；看雪 292798
- **URL**：https://blog.csdn.net/qq_51995421/article/details/159613179 ; https://deepwiki.com/ayoubfaouzi/cpu-internals/4.1-vmcs-structure-and-fields ; https://bbs.kanxue.com/thread-292798.htm
- **Date**：2026-03-29；2026-02-26；2026-08-28
- **Excerpt**："恶意软件常通过读取时间戳寄存器（RDTSC）来计算指令执行时间，借此判断自己是否在被沙箱监控（因为发生 VM-Exit 会导致时间延迟严重）。将此位置 1，可以在它读取时间时喂给它一个伪造的正常时间" / "TSC_OFFSET 0x2010 — Signed offset added to guest RDTSC result"
- **Context**：TSC offset 是"不改指令语义、只改观察值"的设计哲学体现：热迁移后 guest TSC 连续性靠 VMM 调整 offset 维持。
- **Confidence**：高

### 7.4 Unrestricted guest（实模式 / big real mode）

**证据 7.4-A**
- **Claim**：Unrestricted guest（secondary bit7）允许 guest 在非分页保护模式或实地址模式（含 big real mode）下运行于 non-root：启用后 VM-entry 不检查 guest CR0.PE(bit0) 与 CR0.PG(bit31) 是否为 1（常规要求 CR0 固定位约束被豁免这两位），CS 的段 Type 检查也放宽（可为读/写数据段 type=3，实模式要求）。该功能在 Westmere 微架构（2010）引入，且要求同时启用 EPT——因为实模式 guest 无 guest 页表，GPA→HPA 必须另由 EPT 完成。此前（Nehalem 及更早）VMM 须以"unrestricted guest 不可用"路径软件模拟实模式（KVM 的 emulation_required / handle_invalid_guest_state）。
- **Source**：看雪 292798（SDM §29.3.1.1 guest 检查中译）；zovps《详解 jailhouse 架构及原理》；百度百科 Westmere；Intel SDM §23.8 NOTE（§1.1-D）
- **URL**：https://bbs.kanxue.com/thread-292798.htm ; https://www.zovps.com/article/index.php/post/188373.html ; https://baike.baidu.com/item/Westmere/10770939
- **Date**：2026-08-28；2024-06-22；2026-07-21
- **Excerpt**："如果'unrestricted guest' VM 执行控制为 1，不检查第 0 位（对应于 CR0.PE）和第 31 位（PG）" / "直接在实模式下启动逻辑 CPU 就需要 EPT 的支持，这一功能在英特尔的行话中称为无限制访客模式，并在 Westmere 微体系结构中引入" / "新的虚拟化功能：'VMX无限制模式支持（VMX Unrestricted mode support）'，这允许16位应用程序在这些处理器上运行（即使是实模式或增强实模式）。"
- **Context**：hvisor 用例佐证："在 secondary processor-based VM-execution controls 中启用 unrestricted guest，允许 zone 在实模式下运行…关闭 guest CR0 中的保护模式位 PE 和分页位 PG"。EPT 依赖性：unrestricted guest=1 时 enable EPT 也必须为 1（VM-entry 检查）。
- **Confidence**：高（机制）；中高（EPT 强制依赖的表述来自 jailhouse 文档与 SDM 检查规则推论）

### 7.5 VPID

**证据 7.5-A**
- **Claim**：VPID（16 位，VMCS 16-bit control 编码 0x0000，secondary bit5 启用）：每条 TLB 表项打上 VPID 标签，VPID=0 保留给 VMM/root；只有当前 VCPU 的 VPID 匹配的表项才可用于地址转换，因此 VM-entry/VM-exit 不再需要全量刷 TLB。VPID 随 Nehalem 引入，Intel 数据显示 VM round-trip 延迟相比 Merom（Core 2）降低约 40%。INVVPID 指令提供 4 种粒度（individual-address / single-context / all-context / single-context-retaining-globals）按需失效。
- **Source**：jauu.net《Virtual Processor IDs and TLB》；博客园 theseventhson《x86架构VT虚拟化(三)》
- **URL**：https://jauu.net/posts/2011-11-13-virtual-processor-ids-and-tlb/ ; https://www.cnblogs.com/theseventhson/p/14101664.html
- **Date**：2011-11-13；2020-12-12
- **Excerpt**："First generation VMs like Intel Core 2 (VMX) flush the TLB on each vm-enter (resume) and vm-exit. But flushing the TLB is a show-stopper…Intel Nehalem TLB entries have changed by introducing a Virtual Processor ID…Some Intel numbers show that the latency performance gain is 40% for a VM round trip transition compared to Meron" / "Intel的VPID（Virtual-Processor Identifier）是一个16位的域，每个TLB表项与一个VPID相关联，用于唯一标识一个VCPU…在虚拟机切换的时候可以保留TLB中已经有的表项"
- **Context**：VPID 与 EPT 同属"消除切换固定开销"的第二代 VT-x 特性；vpid=0000H 非法用于 guest（保留给 root）。
- **Confidence**：高

---

## 8. 设计哲学：不改变现有指令语义、全虚拟化无需修改 Guest

**证据 8-A**
- **Claim**：VT-x 的根本设计思路是在 CPU 内部增加新的运行模式（root/non-root，正交于 ring 0–3）而非改变既有指令集语义：Guest OS 未经修改地在 non-root ring 0 运行，ring 0 的特权指令与 ring 3 的敏感指令都按 VMCS 配置陷入 root 模式的 VMM。这直接解决了 x86 经典虚拟化难题（敏感指令≠特权指令子集，SGDT/SIDT/SLDT/SMSW/PUSHF/POPF 等在 ring 1 压缩运行时不陷入），不再需要二进制翻译或 Guest 修改（半虚拟化）。
- **Source**：腾讯云开发者《Intel 虚拟化技术（Intel® VT）：CPU 虚拟化与内存虚拟化》；0voice《CPU的三种虚拟化机制》
- **URL**：https://cloud.tencent.com/developer/article/2312207 ; https://github.com/0voice/Introduce_to_virtualization/blob/main/virtualization_type/cpu_virtualization/CPU%E7%9A%84%E4%B8%89%E7%A7%8D%E8%99%9A%E6%8B%9F%E5%8C%96%E6%9C%BA%E5%88%B6.md
- **Date**：2023-08-11；无日期
- **Excerpt**："在 Intel 公司的 VT-x 解决方案中，运行于非根模式下的 Guest OS 可以像在非虚拟化平台下一样运行于 Ring 0 级别，无论是 Ring 0 发出的特权指令还是 Ring 3 发出的敏感指令都会被陷入到根模式的虚拟层。" / "Intel VT-x技术解决了早期x86架构在虚拟化方面存在的缺陷，可使未经修改的Guest OS运行在特权级0，同时减少VMM对Guest OS的干预。"
- **Context**：对比软件方案：ring compression（Guest ring 1）+ binary translation（VMware 1999）只能以巨大复杂度换取正确性；VT-x 把"陷入哪些事件"完全交给 VMM 通过 VMCS 位图配置，语义不变、行为可控。
- **Confidence**：高

**证据 8-B**
- **Claim**：VMX root operation 下软件行为与无 VT-x 处理器基本一致（既有指令语义不变；仅新增 VMX 指令族且在 root 下可用）；non-root 的唯一区别是"运行某些指令或遇到某些事件时发生 VM-exit"。VMM 可以通过 exit 处理修改或欺骗 guest 的观察结果（修改返回值、注入事件），完全取决于 VMM——guest 无法感知自己在 non-root（除非暴露 hypervisor CPUID leaf 或时序侧信道）。
- **Source**：jiwenkang.com《QEMU》（vm entry/exit 机制）；CSDN《Guest 一跑就卡死？VT-x/AMD-V…一条线讲透》；博客园 VT笔记(1)
- **URL**：https://www.jiwenkang.com/redhat/QEMU ; https://blog.csdn.net/qq_35223473/article/details/164945846 ; https://blog.csdn.net/youyou519/article/details/93073087
- **Date**：无日期；2026-09-14；2019-06-24
- **Excerpt**："VMX root operation 模式下软件的行为与在没有 VT-x 技术的处理器上的行为基本一致；而VMX non-root operation 模式则有很大不同，最主要的区别是此时运行某些指令或遇到某些事件时，发生 VM exit。" / "Guest 看不到'自己在 non-root'——除非暴露了 hypervisor 叶子 CPUID 或通过时序侧信道" / "host处理这些操作，即可以修改他，也可以欺骗guest，完全取决于host"
- **Context**：这一透明性原则贯穿所有机制设计：事件注入复用 guest 自己的 IDT、CR0/CR4 shadow 让 guest 读到"期望值"、TSC offset 保持时间语义。
- **Confidence**：高

---

## 9. 维度总结

1. **开启路径**：CPUID.01H:ECX[5] → IA32_FEATURE_CONTROL lock+enable 位 → CR0/CR4 按 FIXED0/FIXED1 调整（初代要求 PE=NE=PG=1，即仅分页保护模式）→ CR4.VMXE=1 → 4KB 对齐、写入 IA32_VMX_BASIC revision ID 的 VMXON region → VMXON（成功即屏蔽 INIT/A20M，current-VMCS=全 1）。VMXOFF 为唯一退出。[^1^][^2^][^5^]
2. **VMCS** 是实现布局不公开的 4KB 结构，六区域分工明确；字段只能经 VMREAD/VMWRITE 按 32 位编码（type/width/index/access 四元组）访问；Host 状态从不由硬件保存，由 VMM 每次 entry 前预置。[^7^][^9^][^41^]
3. **VM-entry** 两级失败语义：controls/host 检查失败 → 落回 VMLAUNCH 下一条指令（VMfailValid）；guest 检查失败 → 按 host-state 加载、跳转 host RIP（视同 exit，reason bit31=1）。VMLAUNCH 仅限 clear 态、VMRESUME 仅限 launched 态，VMCLEAR 重置状态且为跨核迁移必经路径。[^27^][^28^][^29^]
4. **VM-exit** 硬件顺序：写 exit 信息 → 存 guest 状态 → MSR-store → 载 host 状态 → MSR-load → 跳 host RIP；GPR 由 VMM 软件自理。Exit reason 编码在 KVM 与 bhyve 中一致（10=CPUID、28=CR、30=I/O、31/32=RDMSR/WRMSR、48=EPT violation…）；qualification 按原因给全解码信息（CR 号/方向/寄存器，I/O 端口/大小/方向，EPT 读/写/取指+权限与）。[^19^][^20^][^24^][^25^][^26^]
5. **拦截体系**：pin-based（异步事件）+ primary（同步指令）+ secondary（扩展特性，primary bit31 激活）+ tertiary（64 位，IPIv/HLAT 等，primary "activate tertiary controls" 激活）四层控制位；外围 exception bitmap（#PF 有 mask/match 二级判定）、I/O bitmap A/B、MSR bitmap（4×1KB 读写/高低段）、CR0/CR4 mask+shadow、CR3-target 构成完整"选择性陷入"网络。[^11^][^12^][^14^][^16^][^31^]
6. **演进主线**：第一代 VMX（2005，仅基本退出控制）→ Nehalem 加 EPT/VPID → Westmere 加 unrestricted guest（实模式 guest，依赖 EPT）→ Ivy Bridge 代 APICv → Haswell 代 VMFUNC/VMCS shadowing → Skylake 代 PML/#VE/XSAVES/TSC scaling → Ice Lake/Alder Lake/Sapphire Rapids 代 bus-lock detection、notify VM-exit、IPIv、HLAT（tertiary controls）。方向一致：把高频 exit 源逐步硬件化、免退出化。[^13^][^15^][^32^][^34^][^40^]
7. **设计哲学**：不改动任何既有指令语义，用"正交模式 + 完整状态切换 + 位图化拦截 + 事件注入/影子寄存器/TSC offset 的观察值控制"实现全虚拟化；Guest 无需修改、无法感知（除 CPUID 超叶与时序侧信道）。[^35^][^36^]

### 遗留不确定点
- Exit reason 59 之后（VMFUNC/ENCLS/RDSEED/PML_FULL/XSAVES/XRSTORS/SPP/UMWAIT…）的完整编号未逐项与最新版 SDM 附录 C 核对（本报告 0–58 已双实现交叉验证）。
- APIC-register virtualization / virtual-interrupt delivery / VMFUNC 的微架构代际归属为多方资料综合推断，Intel 官方无单一"特性-代际"对照表。
- Tertiary controls bit5 之后（virtualize IA32_SPEC_CTRL 等）随新 SDM 版本仍在增加，建议以最新 IA32_VMX_PROCBASED_CTLS3 定义复核。

---

## 参考来源

[^1^]: Intel SDM Vol.3C §23.7–23.8（xem.github.io 镜像）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1045.html
[^2^]: felixcloutier.com — VMXON, https://www.felixcloutier.com/x86/vmxon
[^3^]: OSDev Wiki — VMX (2026-03-17), https://wiki.osdev.org/VMX
[^4^]: 看雪 — Hypervisor From Scratch 第3部分 (2024-03-30), https://bbs.kanxue.com/thread-281145.htm
[^5^]: Writing Hypervisor in Zig — VMX Root Operation, https://hv.smallkirby.com/en/vmm/vmx_root
[^6^]: revers.engineering — Day 2: Entering VMX Operation (2018-11-02), https://revers.engineering/day-2-entering-vmx-operation/
[^7^]: CTF Wiki — CPU 虚拟化 (2022-08-29), https://ctf-wiki.org/zh-tw/pwn/virtualization/basic-knowledge/cpu-virtualization/
[^8^]: xchen.cc — VT VMCS结构信息, https://xchen.cc/post/vtvmcs/
[^9^]: StackOverflow #67467483 — host CPU state in VMCS (2021-05-10), https://stackoverflow.com/questions/67467483/
[^10^]: hvisor 手册 — X86_64 处理器虚拟化, https://hvisor.syswonder.org/chap04/subchap01/X86_64Virtualization.html
[^11^]: 看雪 thread-292798 — Intel SDM VT 章节中译 (2026-08-28), https://bbs.kanxue.com/thread-292798.htm
[^12^]: Intel SDM Table 24-7 Secondary Controls（xem 镜像 page 1057）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1057.html
[^13^]: LKML — KVM: VMX: Extend VMX controls macro shenanigans (2022-06), https://lkml.iu.edu/hypermail/linux/kernel/2206.3/03639.html
[^14^]: 掘金 — 虚拟机中的 IPI 优化: IPIv (2024-01-27), https://juejin.cn/post/7328431191600807962
[^15^]: LKML — Support new IA32_VMX_PROCBASED_CTLS3 (2021-06), https://lkml.iu.edu/2106.0/00236.html
[^16^]: Intel SDM §24.6.9 MSR bitmap（xem 镜像 page 1060）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1060.html
[^17^]: liujunming — MSR management in QEMU/KVM (2021-12-26), http://liujunming.github.io/2021/12/26/MSR-management-in-QEMU-KVM/
[^18^]: 看雪 thread-291370 — MSR Bitmap / VMFUNC 实例 (2026-05-28), https://bbs.kanxue.com/thread-291370.htm
[^19^]: FreeBSD — sys/amd64/vmm/intel/vmcs.h（MIT 镜像）, http://web.mit.edu/freebsd/head/sys/amd64/vmm/intel/vmcs.h
[^20^]: Linux 3.7 — arch/x86/include/asm/vmx.h（huihoo 镜像）, https://docs.huihoo.com/doxygen/linux/kernel/3.7/vmx_8h_source.html
[^21^]: tangzichengcc — KVM源码分析之上下文切换的执行流（内核4.4）(2023-09-28), https://tangzichengcc.github.io/虚拟化入门-2-KVM源码分析之上下文切换的执行流-内核4-4版本/
[^22^]: 3mdeb — VMX exit reasons and handlers (2020-01-23), https://blog.3mdeb.com/2020/2020-01-23-vmx-exit-reasons-and-handlers/
[^23^]: Intel SDM §27.2.1 exit qualification（xem 镜像 page 1123）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1123.html
[^24^]: Intel SDM Table 27-3 CR-access qualification（xem 镜像 page 1124）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1124.html
[^25^]: Intel SDM Table 27-5 I/O instruction qualification（xem 镜像 page 1126）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1126.html
[^26^]: Intel SDM Table 27-7 EPT violation qualification（xem 镜像 page 1127）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1127.html
[^27^]: felixcloutier.com — VMLAUNCH/VMRESUME, https://www.felixcloutier.com/x86/vmlaunch:vmresume
[^28^]: Intel SDM §24.11.3 VMCS launch state（xem 镜像 page 1073）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1073.html
[^29^]: 看雪 thread-281369 — Intel手册 VT 第27章 VM Entries 中译 (2024-04-22), https://bbs.kanxue.com/thread-281369.htm
[^30^]: 博客园 — Virtualization and Performance: Understanding VM Exits (2018-12-13), https://www.cnblogs.com/kelamoyujuzhen/p/10115167.html
[^31^]: GitHub SunLin19 — KVM exception.md (2019-06-05), https://github.com/SunLin19/Kernel/blob/master/virtualization/kvm/exception.md
[^32^]: zovps — 详解 jailhouse 架构及原理 (2024-06-22), https://www.zovps.com/article/index.php/post/188373.html
[^33^]: 百度百科 — Westmere, https://baike.baidu.com/item/Westmere/10770939
[^34^]: jauu.net — Virtual Processor IDs and TLB (2011-11-13), https://jauu.net/posts/2011-11-13-virtual-processor-ids-and-tlb/
[^35^]: 腾讯云 — Intel 虚拟化技术：CPU 虚拟化与内存虚拟化 (2023-08-11), https://cloud.tencent.com/developer/article/2312207
[^36^]: 0voice — CPU的三种虚拟化机制, https://github.com/0voice/Introduce_to_virtualization/blob/main/virtualization_type/cpu_virtualization/CPU%E7%9A%84%E4%B8%89%E7%A7%8D%E8%99%9A%E6%8B%9F%E5%8C%96%E6%9C%BA%E5%88%B6.md
[^37^]: 博客园 onetrainee — VT MSR、CR、Exception、#PF (2020-08-31), https://www.cnblogs.com/onetrainee/p/13590000.html
[^38^]: tandasat — Hypervisor enforced security policies (2024-02-12), https://tandasat.github.io/blog/2024/02/12/hyper-v-configs.html
[^39^]: Intel SDM §24.7 Table 24-10 VM-exit controls（xem 镜像 page 1063）, https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1063.html
[^40^]: arXiv — Pomegranate: Lightweight Compartmentalization using Virtualization Extensions (2026-05-07), https://arxiv.org/html/2605.07008v1
[^41^]: GiantVM/KVM-Annotation Wiki — Intel IA32 Manual VMX Section, https://github-wiki-see.page/m/GiantVM/KVM-Annotation/wiki/Intel-IA32-Manual-VMX-Section-%5BCh.-23~Ch.-33%5D
[^42^]: deepwiki — cpu-internals: VMCS Structure and Fields (2026-02-26), https://deepwiki.com/ayoubfaouzi/cpu-internals/4.1-vmcs-structure-and-fields
[^43^]: superuser — VirtualBox VT-x features dump (2025-02-09), https://superuser.com/questions/1877472/
[^44^]: kernullist — About Hypervisor Cheats, Part 1 (2026-06-28), https://kernullist.github.io/kernullist-blog/posts/hypervisor-cheats-part-1-ring-1-vmx-svm-control-state-ownership/
[^45^]: CSDN — 内核虚拟化：CPU虚拟化硬件支持 (2024-01-17), https://blog.csdn.net/weixin_46324627/article/details/135638989
[^46^]: 51cto — KVM怎么选CPU Model（含 KVM 中断虚拟化源码）(2024-06-21), https://blog.51cto.com/u_16213718/11216128
[^47^]: 敏的博客 — KVM虚拟化之VM Exit/Entry (2018-09-10), http://remimin.github.io/2018/09/10/kvm-vmx/
[^48^]: 看雪 — [翻译]Intel虚拟化技术简介 (2022-05-15), https://bbs.kanxue.com/thread-272813.htm
[^49^]: 博客园 Edver — APIC虚拟化 (2022-05-10), https://www.cnblogs.com/edver/p/15747890.html
[^50^]: CSDN — QEMU/KVM中断虚拟化源码解析 (2023-07-30), https://blog.csdn.net/zhangtongjian12/article/details/132008424
[^51^]: CSDN — 虚拟化技术（2）：VMCS 结构 (2025-09-14), https://blog.csdn.net/qq_48466156/article/details/151683482
[^52^]: 博客园 theseventhson — x86架构VT虚拟化(三) (2020-12-12), https://www.cnblogs.com/theseventhson/p/14101664.html
[^53^]: CSDN — 虚拟化技术&VMCS (2026-03-29), https://blog.csdn.net/qq_51995421/article/details/159613179
[^54^]: jiwenkang.com — QEMU（vm entry/exit）, https://www.jiwenkang.com/redhat/QEMU
[^55^]: CSDN — Guest 一跑就卡死？VT-x/AMD-V 一条线讲透 (2026-09-14), https://blog.csdn.net/qq_35223473/article/details/164945846
[^56^]: xml-data.org — 基于硬件虚拟化的虚拟机文件完整性监控 (2017-02-03), http://www.xml-data.org/JSJYY/2017-2-388.htm
