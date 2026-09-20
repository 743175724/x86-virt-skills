## 15. 附录:术语表与开发者速查

本章为工具性附录,供开发与调测过程中快速回查。15.1 节给出核心术语中英对照表,每条含英文全称、中文译名、一句话定义与首次出现章节号;15.2 节把开发中最常查阅的四类编码——MSR 地址、CPUID 叶与位、VM-Exit 退出码、AMD 官方文档编号——压缩为一页速查卡,可按分组单独打印。所有编号均摘自 AMD 官方手册/规范或内核一手源码,引用沿用研究底稿编号并注明所属维度报告(dimNN),便于回溯原始出处。术语按首现章节排序,与全书"机制 → 内存 → 中断/I/O → 机密计算 → 生态"的展开路径一致,术语表因此同时可用作全书结构的索引。

### 15.1 术语表

#### 15.1.1 核心术语中英对照

**表 15-1 AMD 虚拟化核心术语中英对照表**(51 条,按首次出现章节排序)

| 缩写 | 英文全称 | 中文译名 | 定义 | 首现章 |
|---|---|---|---|---|
| AMD-V | AMD Virtualization | AMD 硬件虚拟化 | AMD 硬件辅助虚拟化技术总品牌,涵盖 SVM 指令集扩展、NPT、AMD-Vi 与 SEV 家族,规范首见于 2005 年的 SVM 独立手册[^1^] | 1 |
| SVM | Secure Virtual Machine | 安全虚拟机 | AMD-V 的 CPU 侧扩展,以公开布局的 VMCB 与 VMRUN/#VMEXIT 完成 guest/host 世界切换,为 APM Vol.2 第 15 章主题[^2^] | 1 |
| VMCB | Virtual Machine Control Block | 虚拟机控制块 | 4KB 对齐的单页结构,控制区占前 1024 字节、状态保存区自偏移 400h 起,是 VMRUN 的隐式操作数[^33^] | 1 |
| CoCo | Confidential Containers | 机密容器 | CNCF 孵化项目,以 KBS/AS/RVPS 架构把 SNP 证明接入容器镜像密钥释放流程[^304^] | 1 |
| VMRUN / #VMEXIT | VM Run / VM Exit | 虚拟机运行/虚拟机退出 | 进入 guest 的指令与返回 hypervisor 的原子事件对;#VMEXIT 时硬件写回 guest 状态、退出信息与 host 状态[^1^] | 2 |
| VMLOAD / VMSAVE | — | 状态装载/保存指令 | 补充 VMRUN/#VMEXIT 不自动切换的 FS/GS/TR/LDTR 隐藏态与 STAR/LSTAR/SYSENTER 等 MSR[^46^] | 2 |
| VMMCALL | Virtual Machine Call | 虚拟机调用 | guest 主动陷入 hypervisor 的指令,对应退出码 0x81[^73^] | 2 |
| SVME | Secure Virtual Machine Enable | SVM 使能位 | EFER 中的 SVM 总开关;VMRUN 仅可在 CPL=0 且 EFER.SVME=1 下执行,否则 #GP/#UD[^1^] | 2 |
| GIF | Global Interrupt Flag | 全局中断标志 | SVM 引入的物理中断总闸;VMRUN 前须由软件清零以保证原子状态切换,#VMEXIT 时硬件清 GIF[^40^] | 2 |
| Intercept Vector | Intercept Vectors | 拦截向量 | VMCB 控制区 5 个位向量(CR/DR 读写、异常、杂项指令、SVM 指令);退出码数值等于对应拦截位的位序[^45^] | 3 |
| IOPM | I/O Permissions Map | I/O 权限位图 | 12KB 连续物理内存、64K+3 位的线性数组,按端口粒度拦截 IN/OUT/INS/OUTS[^1^] | 3 |
| MSRPM | MSR Permissions Map | MSR 权限位图 | 8KB 位图,覆盖三段 MSR 区间,每个 MSR 的 RDMSR/WRMSR 各占一位[^1^] | 3 |
| ASID | Address Space Identifier | 地址空间标识符 | TLB 项的地址空间标签,0 保留给 host;SEV 复用 ASID 把 VM 与内存加密密钥槽绑定[^66^][^209^] | 3 |
| EVENTINJ | Event Injection Field | 事件注入字段 | VMCB 0A8h 字段,VMRUN 时向 guest 注入异常/中断,格式与 EXITINTINFO 一致[^1^] | 3 |
| VMCB Clean Bits | VMCB State Caching | VMCB 状态缓存位 | 指示哪些状态组可被硬件按逻辑 CPU 缓存;修改字段后必须清相应位,跨 CPU 迁移须全部置脏[^61^][^72^] | 3 |
| NPT | Nested Page Tables | 嵌套分页 | 硬件二级地址翻译(又称 RVI),guest 物理地址再经一层页表翻译;nPT 表项与 AMD64 PTE 逐位兼容[^85^] | 4 |
| nCR3 | Nested CR3 | 嵌套页表根 | VMCB 0B0h 字段,NPT 第二级翻译的页表根指针,对应 Intel EPTP[^60^] | 4 |
| AVIC | Advanced Virtual Interrupt Controller | 高级虚拟中断控制器 | 硬件虚拟化 APIC,经 vAPIC backing page 投递中断,取代 V_IRQ/V_INTR_VECTOR 注入路径[^166^] | 5 |
| x2AVIC | x2APIC-mode AVIC | x2 模式 AVIC | AVIC 的 x2APIC 模式扩展,特性位为 `CPUID Fn8000_000A EDX[18]`[^3^] | 5 |
| VGIF | Virtual Global Interrupt Flag | 虚拟 GIF | 允许 guest 以虚拟 GIF 控制自身中断开关而不拦截 STGI/CLGI,Fn8000_000A 特性位宣告[^70^] | 5 |
| NRIPS | NRIP Save | NRIP 保存 | #VMEXIT 时把下一条顺序指令 RIP 存入 VMCB,hypervisor 免做指令解码,`Fn8000_000A EDX[3]`[^62^] | 5 |
| AMD-Vi / IOMMU | I/O Memory Management Unit | I/O 内存管理单元 | 芯片组功能,对 DMA 事务做地址转换与访问保护并提供中断重映射,规范为 48882[^9^] | 6 |
| DTE | Device Table Entry | 设备表项 | 256 位表项,按 16 位 DeviceID(BDF)索引,记录 DomainID、I/O 页表根与中断重映射控制[^130^] | 6 |
| IVRS | I/O Virtualization Reporting Structure | I/O 虚拟化报告结构 | ACPI 表,固件经 IVHD/IVMD 块向 OS 描述 IOMMU 能力、设备归属与保留内存区[^141^] | 6 |
| PASID | Process Address Space Identifier | 进程地址空间标识 | 标识设备事务所属进程地址空间;GCR3 表按 PASID 索引实现 GVA→GPA→SPA 两级转换[^136^] | 6 |
| IRTE | Interrupt Remapping Table Entry | 中断重映射表项 | AMD 按每设备一张重映射表组织,MSI 数据低 11 位直接作为 IRTE 索引[^503^] | 7 |
| SME | Secure Memory Encryption | 安全内存加密 | 内存控制器内联 AES 引擎对 DRAM 透明加解密,密钥每次复位随机生成且对一切软件不可见[^10^] | 8 |
| TSME | Transparent SME | 透明内存加密 | 固件/BIOS 选项,无论 C-bit 取值如何全部内存均加密,OS 无需参与[^12^] | 8 |
| C-bit | enCrypted Bit | 加密位 | PTE 中标记页加密的物理地址位;Naples–Milan 为 bit 47,Genoa 起为 bit 51 并伴随物理地址位缩减[^207^] | 8 |
| SEV | Secure Encrypted Virtualization | 安全加密虚拟化 | 以每 VM 独立密钥(ASID 绑定 VEK)实现 VM 内存加密,威胁模型包含恶意 hypervisor 与 DRAM 物理接触[^10^] | 8 |
| PSP / AMD-SP | Platform Security Processor / AMD Secure Processor | 平台安全处理器 | SoC 内 32 位 ARM Cortex-A5,运行 SEV 固件并独占密钥管理,hypervisor 永远接触不到内存密钥[^10^] | 8 |
| VEK | VM Encryption Key | 虚拟机加密密钥 | 每 VM 的实际内存加密密钥,由固件装载到内存控制器中按 ASID 寻址的密钥槽[^204^] | 8 |
| TIK / TEK | Transport Integrity / Encryption Key | 传输完整性/加密密钥 | guest owner 选取的会话密钥(HMAC-SHA-256/AES-128),保护启动度量与迁移数据,会话结束即销毁[^211^] | 8 |
| SEV-ES | SEV Encrypted State | 加密状态扩展 | 每次 VM-Exit 时以 guest 密钥加密全部 vCPU 寄存器状态并做完整性校验[^24^] | 9 |
| VMSA | Virtual Machine Save Area | 虚拟机保存区 | SEV-ES 起被加密的 vCPU 状态保存页;hypervisor 一旦篡改,VMRUN 以 SHUTDOWN 退出拒绝恢复[^243^] | 9 |
| #VC | VMM Communication Exception | VMM 通信异常 | 异常向量 29,不可屏蔽;NAE 事件在 guest 内抛出,错误码等于对应 VMEXIT 码[^75^] | 9 |
| AE / NAE | Automatic / Non-Automatic Exit | 自动/非自动退出 | SEV-ES 对退出事件的两分:AE 直接退到 hypervisor,NAE 先抛 #VC 再由 guest 主动 VMGEXIT[^75^] | 9 |
| VMGEXIT | VM Guest Exit | 虚拟机主动退出 | 编码 `F3/F2 0F 01 D9`,SEV-ES guest 与 hypervisor 显式通信的自愿退出,退出码 0x403[^44^] | 9 |
| GHCB | Guest-Hypervisor Communication Block | guest-hypervisor 通信块 | 4KB 共享页,guest 经 valid_bitmap 最小化暴露寄存器与 hypervisor 通信;规范 56421[^75^] | 9 |
| SEV-SNP | SEV Secure Nested Paging | 安全嵌套分页 | 第三代 SEV,以硬件强制的内存完整性保护正式把 hypervisor 移出 TCB[^25^] | 10 |
| RMP | Reverse Map Table | 反向映射表 | DRAM 中系统唯一、按系统物理地址索引的表,每 4KB 页一条 16 字节条目记录页所有者与 GPA 绑定[^260^] | 10 |
| RMPUPDATE / PSMASH / PVALIDATE / RMPADJUST | — | RMP 操作指令组 | RMP 条目只能经这组新 x86 指令修改:hypervisor 用 RMPUPDATE 指派(恒清 Validated)、PSMASH 拆分 2MB 项,guest 用 PVALIDATE 验证、RMPADJUST 调整低 VMPL 权限[^262^] | 10 |
| VMPL | Virtual Machine Privilege Level | 虚拟机特权级 | guest 地址空间内部的 4 级特权分层(VMPL0 最高),与 x86 ring 正交,级别记录在 VMSA 中[^271^] | 10 |
| SVSM | Secure VM Service Module | 安全 VM 服务模块 | 运行于 VMPL0 的 guest 内安全服务模块,提供 vTPM、证明、在线迁移等服务;规范 58019[^273^] | 10 |
| Guest Policy | Guest Policy | guest 策略位图 | 64 位启动策略(SMT、DEBUG、MIGRATE_MA、AES-256-XTS、Ciphertext Hiding 等),纳入启动度量[^269^] | 10 |
| VCEK | Versioned Chip Endorsement Key | 版本化芯片背书密钥 | 由芯片唯一秘密与 REPORTED_TCB 派生的 ECDSA P-384 签名密钥,使验证方可按 TCB 版本拒绝未修补平台[^279^] | 10 |
| VLEK | Versioned Loaded Endorsement Key | 版本化加载背书密钥 | 云厂商专属背书密钥,经 hashstick 加载,证书链为 ARK→ASVK→VLEK;规范 58369[^290^] | 10 |
| VMPCK | VM Platform Communication Key | VM 平台通信密钥 | guest 与固件之间 AES-GCM 保护的消息通道密钥,按 VMPL 分钥并随 secrets page 注入[^279^] | 10 |
| KDS | Key Distribution Service | 密钥分发服务 | AMD 证书分发服务(`kdsintf.amd.com`),提供 ARK/ASK/VCEK/CRL 下载;接口规范 57230[^291^] | 10 |
| TCB | Trusted Computing Base | 可信计算基 | 证明报告以 CURRENT/REPORTED/COMMITTED 三个 TCB 版本字段刻画固件与微码修补状态[^281^] | 10 |
| SMKE | Secure Multi-Key Encryption | 安全多密钥加密 | Genoa 引入的 CXL 附加内存选择性加密,密文跨重启保持,最多 63 个多主机密钥[^310^] | 10 |

表 15-1 覆盖了从 2005 年 SVM 基线到 2024 年后机密计算生态的四代术语。可以看出两条命名规律:其一,数据结构类术语(VMCB、GHCB、RMP、DTE、IVRS)全部是"公开布局、软件可直接读写"的内存结构,这与 AMD"显式软件契约"的设计哲学一致,也是本书第 3、6、9、10 章反复出现的分析对象;其二,密钥类术语随代际分层——SME/SEV 时代的 VEK 解决"数据加密",SEV-ES/SNP 时代的 TIK/VMPCK 解决"通道与度量",VCEK/VLEK 解决"平台背书",开发者在阅读固件 ABI(56860)时按这三层归类即可避免混淆。需特别注意 ASID 一词的双重身份:在 SVM/NPT 语境它是 TLB 标签(第 3、4 章),在 SEV 语境它同时是密钥槽索引(第 8 章起),两份语义在 SNP 的 RMP 条目中被合并使用。

### 15.2 速查卡

#### 15.2.1 关键 MSR/CPUID/退出码/固件文档编号一页速查

以下四张表按"MSR 地址 → CPUID 叶与位 → 退出码 → 文档编号"分组,覆盖调试 VM-Exit、探测特性、核对固件版本三类最常见的开发场景;每组均可独立裁切打印。

**表 15-2 关键 MSR 速查**

| MSR 地址 | 名称 | 关键位与用途 |
|---|---|---|
| `0xC0000080` | EFER | 含 SVME 位;EFER.SVME=1 是执行 VMRUN/VMLOAD/VMSAVE 的前提[^1^] |
| `0xC0010010` | SYSCFG | bit 23 内存加密使能(由 BIOS 设置,Linux 不自行置位);SNP 启用另需该 MSR 的 SecureNestedPagingEn/VMPLEn[^208^][^240^] |
| `0xC0010130` | GHCB MSR | 保存 GHCB GPA;低 12 位复用为 MSR protocol 功能码(0x001 SEV_INFO … 0x100 Termination Request),hypervisor 不得拦截[^75^] |
| `0xC0010131` | SEV_STATUS | bit 0 SEV / bit 1 SEV-ES 激活状态;guest 经 `cc_platform_has()` 检测[^252^] |
| `0xC0010132` / `0xC0010133` | RMP_BASE / RMP_END | RMP 区间基址与末址,全核一致设置;硬件要求 8KB 对齐,固件提高到 1MB 对齐[^258^] |
| `0xC0010136` | RMP_CFG | Turin 分段 RMP(Segmented RMP)配置,配合 4KB RST 段表[^258^] |

表 15-2 的分布本身反映了 AMD 机密计算的架构分层:`0xC0000080` 与 `0xC0010010` 属于"使能层",决定特性是否存在;`0xC0010130`–`0xC0010136` 这一连续区段属于"运行时契约层",全部是 SEV-ES/SNP 引入的 guest-固件-hypervisor 三方共享状态的锚点。调试时的一个实用推论是:凡涉及 GHCB 或 RMP 的故障,先用 `rdmsr` 核对该区段在全部 vCPU 上的一致性——RMP_BASE/RMP_END 要求全核同值,固件初始化竞态(RMPocalypse,见第 11 章)正是利用不一致窗口。另注意 SYSCFG bit 23 只读不改:Linux 明确依赖 BIOS 置位,用户态工具(如 snphost ok)也把它列为自检项。

**表 15-3 关键 CPUID 叶与位速查**

| CPUID 叶 | 寄存器/位 | 含义 |
|---|---|---|
| `Fn8000_000A` | EBX | NASID:硬件支持的 ASID 数量[^62^] |
| `Fn8000_000A` | EDX[0] / [3] / [5] | NP(NPT)/ NRIPS / VMCBCLEAN 特性位[^62^][^70^] |
| `Fn8000_000A` | EDX[13] / [15] / [16] / [18] | AVIC / VLS(虚拟化 VMLOAD/VMSAVE)/ VGIF / x2AVIC[^43^][^3^] |
| `Fn8000_001F` | EAX[0] / [1] / [3] / [5] / [23] | SME / SEV / SEV-ES / VMPL / 分段 RMP 支持[^208^][^209^][^298^][^240^][^258^] |
| `Fn8000_001F` | EBX[5:0] / [11:6] | 页表加密位(C-bit)位置 / 物理地址缩减位数[^208^] |
| `Fn8000_001F` | ECX | 同时支持的加密 guest 数上限(=可用加密 ASID/密钥槽数)[^209^] |

表 15-3 揭示了两条独立的特性演化线:`Fn8000_000A` 承载 2006 年以来的 SVM 功能位(NPT、AVIC、VGIF 等),`Fn8000_001F` 则整体属于 2016 年后的内存加密家族,两条线互不重叠, hypervisor 探测时应分别读取。两个最易踩的坑都已写入表中:一是 x2AVIC 的正确位号是 EDX[18]——早期补丁邮件曾误写为 EDX[14],后经 APM 修订,引用旧文献时需注意(见第 5 章);二是 C-bit 位置不随代际固定,必须从 EBX[5:0] 动态读取而非硬编码 47,Genoa 起为 51,这也是 QEMU `cbitpos`/`reduced-phys-bits` 参数的来源(第 8、12 章)。ECX 给出的密钥槽上限(Naples 15、Rome 509、Genoa 1006)直接决定单机可并发的机密 VM 数量,容量规划时应以实测值为准。

**表 15-4 SVM 退出码与 GHCB SW_EXITCODE 速查**

| 编码 | 含义 |
|---|---|
| `00h–0Fh` / `10h–1Fh` / `20h–2Fh` / `30h–3Fh` | CR0–15 读 / CR0–15 写 / DR0–15 读 / DR0–15 写拦截退出[^45^] |
| `40h–5Fh` | 异常向量 0–31 拦截退出(EXCP_BASE=40h)[^45^] |
| `72h` / `7Bh` / `7Ch` | CPUID / IOIO(I/O 指令)/ MSR(RDMSR/WRMSR)[^73^] |
| `77h` / `78h` / `7Fh` | PAUSE / HLT / SHUTDOWN[^1^] |
| `80h`–`83h` | VMRUN / VMMCALL / VMLOAD / VMSAVE[^73^] |
| `8Fh` / `90h–9Fh` | EFER 写陷阱 / CR0–15 写陷阱(SEV-ES 的 AE 类)[^75^] |
| `400h` / `401h` / `402h` / `403h` | NPF(嵌套页故障)/ AVIC_INCOMPLETE_IPI / AVIC_UNACCELERATED_ACCESS / VMGEXIT[^1^][^76^] |
| `−1` / `−2` / `−3` / `−4` | VMEXIT_INVALID / BUSY / IDLE_REQUIRED / INVALID_PMC(EXITCODE 为单一 64 位值)[^77^] |
| `0x8000_0001/02/03` | GHCB SW_EXITCODE:MMIO_READ / MMIO_WRITE / NMI_COMPLETE[^76^] |
| `0x8000_0010/11` | GHCB SW_EXITCODE:Page State Change / SNP Guest Request[^76^] |

表 15-4 的使用要点有三。第一,`00h–5Fh` 区段的编码规律是"退出码等于拦截位在拦截向量中的位序",因此给定拦截位即可心算退出码,反之亦然;`72h/7Bh/7Ch` 三个高频码贡献了绝大多数性能敏感退出,perf 采样时优先识别。第二,`8Fh–9Fh` 的 write-trap 系列是 SEV-ES 的标志性产物:hypervisor 读不到 guest 寄存器,只能"写后陷阱",看到这组码即可判定当前是 SEV-ES/SNP guest 的 CR 写路径。第三,负值错误码是 64 位全宽语义——KVM 曾长期按 32 位解析 EXITCODE 并在 Milan/Turin 上实测修正(第 3 章),自研 hypervisor 解析 `EXITCODE` 时必须按 `u64` 处理,否则 `−1` 会被误读为 `0xFFFFFFFF` 而与合法码混淆。GHCB 软件自定义码(`0x8000_00xx`)与硬件退出码在数值空间上不重叠,这是规范刻意保留的扩展区。

**表 15-5 AMD 官方文档编号速查**

| 文档号 | 标题 | 当前公开版 | 覆盖内容 |
|---|---|---|---|
| 24593 | AMD64 APM Volume 2: System Programming | Rev 3.43(2025-07) | 第 15 章 SVM、附录 B VMCB 布局、附录 C 退出码;§15.36 SNP[^2^][^3^] |
| 33047 | Secure Virtual Machine Architecture Reference Manual | Rev 3.02(2005-12) | 24593 第 15 章的前身独立手册[^1^] |
| 48882 | AMD I/O Virtualization Technology (IOMMU) Specification | Rev 3.10–3.11(2026-04) | AMD-Vi 架构、DTE、命令/事件、IVRS[^129^][^130^] |
| 55766 | SEV API Version | Rev 3.24(2020-04,API v0.24) | SEV/SEV-ES 固件命令、密钥管理与证书格式[^211^] |
| 56421 | SEV-ES GHCB Standardization | Rev 2.04(2025-01) | GHCB 布局、MSR 协议、SW_EXITCODE、SNP 扩展[^75^] |
| 56860 | SEV-SNP Firmware ABI Specification | Rev 1.58(2025-05);门户已列 1.59 | SNP 固件命令、证明报告格式、Guest Policy[^315^] |
| 57230 | VCEK Certificate and KDS Interface Specification | Rev 1.00(2025-02) | KDS HTTP API、VCEK 证书与 CRL 格式[^291^] |
| 58019 | Secure VM Service Module for SEV-SNP Guests | Rev 1.00(2023) | SVSM 调用约定、结果码与 vTPM/证明协议[^274^] |
| 58369 | VLEK Certificate Definition | Rev 0.10(2023-10) | VLEK 证书链(ARK→ASVK→VLEK)与 CRL 分发点[^290^] |

表 15-5 应按"问题域 → 文档"的方式使用:CPU 虚拟化语义(拦截、退出码、NPT、AVIC)查 24593;IOMMU 与中断重映射查 48882;guest-hypervisor 协议(#VC、GHCB、VMGEXIT)查 56421;固件命令与证明报告字段查 56860;证书链与 KDS 交互查 57230/58369。需要注意该文档族是"持续修订的活规范":24593 自 2005 年 Rev 3.11 首增第 15 章后已修订至 3.43,56860 四年间从 0.9 演进至 1.59,56421 的 Rev 2.04 又追加了 SEV-TIO 与 Secure AVIC 内容——引用任何字段偏移或位定义时都应注明所依据的修订号,本书各章正文已按此原则标注。全部文档均可经 docs.amd.com 按编号直接检索(如 `docs.amd.com/v/u/en-US/56860_PUB_SEV_SNP`)。
