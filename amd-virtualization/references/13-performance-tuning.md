## 13. 性能特征与调优实践

本章将 AMD 虚拟化的开销拆为三个可独立测量的层次——VM-Exit 处理、嵌套页表 walk、中断投递——再给出 SEV 家族分代实测数据与一份可落地的调优清单。所有量化结论均标注测量平台与方法;学术测量(模拟器、单一平台)与生产复测(云实例)之间的差异在文中显式区分。

### 13.1 开销构成

#### 13.1.1 VMEXIT 成本:Genoa 实测亚微秒级,嵌套 walk 放大 3.9–4.6 倍,#VC+GHCB 最高再放大 6.8 倍

**VM-Exit 的直接成本。**一次 `#VMEXIT` 的代价由三部分构成:硬件保存/恢复 VMCB 状态的世界切换(world switch)、hypervisor 退出处理程序的执行、以及随之发生的 TLB/缓存污染。Oracle 在 OCI 裸金属实例(BM.Standard.E5.192,2×EPYC 9J14 Genoa,UEK7/Linux ≥6.8)上用 `perf kvm stat` 对 16 vCPU guest 的 20 秒采样给出了常见退出类型的平均处理时间[^114^]:

**表 13-1 Genoa 平台常见 VM-Exit 类型实测延迟(`perf kvm stat`,20 秒采样窗口)**

| 退出类型 | 触发场景 | 20 秒内次数(占比) | 平均处理时间 |
|---|---|---|---|
| `interrupt` | 外部中断/IPI 注入 | 10,980,413(46.29%) | 0.82 µs |
| `msr` | guest MSR 读写拦截 | 10,748,435(45.32%) | 0.56 µs |
| `vintr` | 虚拟中断窗口 | —(8.38%) | 0.74 µs |
| `cpuid` | CPUID 指令 | — | 0.39 µs |
| `npf` | 嵌套页故障(NPF) | 1,961 | 1.10 µs |
| `hlt` | guest 空闲(含实际休眠) | — | 764 µs |

数据来源:Oracle Linux Blog,2024-03,OCI 2×EPYC 9J14 Genoa[^114^]。

该表揭示两个要点。其一,除 `hlt` 外所有退出类型的平均处理均在**亚微秒到 1 µs** 量级,这与"SVM 世界切换昂贵"的直觉相反——Zen 4 上真正的成本不在单次切换,而在**频率**:中断与 MSR 拦截合计占退出次数的 91.6%,高频次累积才是开销主体。其二,退出类型分布高度依赖负载:学术测量(16 线程 dedup 负载)显示多线程场景下多数 VM-Exit 由 APIC 访问引起(rescheduling IPI 与 TLB shootdown IPI 的发送/ACK/EOI 均被 VMM 拦截),该负载虚拟化 slowdown 达 108%[^444^]。作为跨架构参照,kvm-unit-tests 的 CPUID 退出往返测试(RDTSC 计)在 Intel 平台上测得未缓存路径 11,650(SKX)至 28,850(EMR)周期,缓存优化后仍为 6,850–7,900 周期[^445^];AMD 侧未见同口径权威披露(见本章末局限),但亚微秒级平均值表明两家退出成本在同一数量级。

**嵌套页表 walk 的乘性放大。**NPT 消除了页表维护类 VM-Exit,代价是把 TLB miss 路径拉长:四级分页下,一次 TLB miss 最坏触发 $(4+1)\times5-1=24$ 次内存引用(4 级 guest walk 中每个 gPA 都需一次嵌套 walk),而原生仅 4 次[^446^];De Gelas 的早期分析将其概括为"原生 4 次查表变成 16 次查表",使 TLB miss 从性能受损变为"性能灾难"[^96^]。AMD 研究团队的微架构测量(ASPLOS 2008,模拟 Opteron PWC)量化:嵌套 walk 平均比原生 walk **慢 3.9–4.6 倍**,无页行走缓存时虚拟化负载整体慢 20–70%;扩展 PWC 缓存嵌套维可挽回 15–38%,Nested TLB 再贡献 3–7%,hypervisor 使用大页再叠加 3–22%[^99^]。这组数字是本章调优清单的理论锚点:大页之所以是 EPYC 虚拟化的第一调优项,正因为它直接压缩这条 3.9–4.6 倍放大的 miss 路径。

**#VC+GHCB 对退出成本的二次放大。**SEV-ES/SNP 把退出分为自动退出(AE,如 HLT、外部中断)与非自动退出(NAE);NAE 需要访问加密的寄存器状态,guest 必须经 `#VC` handler 把状态复制到共享的 GHCB 页,再执行 `VMGEXIT` 通知 hypervisor,往返额外承担 GHCB 读写与 VMSA 加解密[^447^]。TUM 的实测(SIGMETRICS 2025,2×EPYC 9654P Genoa vs 2×Xeon 8570,Linux 6.8,QEMU 8.2,关 HT/Turbo/C-state)显示:机密 VM 的 VMEXIT 延迟最高放大 **6.8 倍**(TDX 侧),同口径下 SEV-SNP 为 +240%、TDX 为 +472%[^34^][^34^]。部分缓解来自设计细节:SEV-SNP 在 launch 时预置 CPUID page,CPUID 类指令反而可避免部分 VM-Exit[^34^]。

### 13.2 实测数据

#### 13.2.1 NPT/AVIC 收益与 SEV 三代开销:STREAM ≤4.3%,Redis ≤14.1%,SNP 内存开销 2.88% vs TDX 7.86%

**NPT 相对影子页表的收益区间。**基于 AMD 官方数据,嵌套分页相对影子分页最高提升约 23%,且 vCPU 越多影子页表同步代价越大[^96^];后续实测研究(Selective HW/SW Memory Virtualization)表明两者无绝对赢家,个别 benchmark 差距高达 34%[^103^];ISCA 2016 的 Agile Paging 混合方案较两者中较优者平均再快 12%,最坏情况仅慢于原生 4%[^105^]。综合口径:NPT 对内存密集与页表更新密集负载的典型收益约 15–30%,代价是上节所述的 TLB miss 路径变长——这解释了为什么 NPT 的收益高度依赖大页与 TLB 调优来兑现。

**AVIC 对 IPI 密集负载的收益。**在同一 OCI Genoa 平台上,16 vCPU guest 运行 `sysbench threads`(20 秒):开启 AVIC 后总 VM-Exit 数从 23,718,962 降至 1,049,506,**减少约 96%**;kvm-unit-tests 的 IPI 投递延迟从 5,708 周期降至 3,027 周期(**降低 47%**)[^114^]。原文明确警告:退出数降 96% 不等于性能提升 96%,只有被 VM-Exit 与中断注入延迟完全瓶颈的负载才接近该幅度[^114^]。AVIC 的配置要点见 13.3 节。

**SEV/SEV-ES/SEV-SNP 分代开销。**Yan 与 Gopalan(MASCOTS 2023;2×EPYC 7763 Milan,256 GB,AMD 维护的 5.19-rc6 内核 + AMD QEMU 分支;Small/Medium VM 钉在单 CCD,Large VM 钉在单 socket)给出了迄今最完整的分代对照[^447^]:

![SEV 三代性能开销对比](images/sec13_sev_gen_overhead.png)

**图 13-1** SEV/SEV-ES/SEV-SNP 相对普通 VM 的性能开销。数据:MASCOTS 2023,EPYC 7763 Milan,Medium VM;Sysbench/7-Zip 为论文给出的最差情况上界(<1%、≤1.5%/2.5%),其余为实测值。来源:[^447^]

图 13-1 的分布呈现清晰的负载分层:CPU 与缓存/内存延迟敏感负载(Sysbench、7-Zip)在三代上的开销均不超过 2.5%,纯内存带宽负载(STREAM)最高 4.3%;开销集中在 I/O 路径——磁盘 I/O 最高 56%(SEV-ES)、TCP 网络最高 36%,根因是 SWIOTLB bounce buffer 与 #VC/VMGEXIT 的额外往返[^447^]。Redis 这类"内存+I/O 混合"负载落在中间档(14.1%)。值得注意的是 SEV-ES 在磁盘 I/O 上反而高于 SEV-SNP(56% vs 47%),说明 SNP 的 RMP 检查并非 I/O 开销主因,bounce buffer 才是;这也意味着 I/O 路径是调优与后续硬件演进(如 SEV-TIO)的主战场。同研究还测得 VM 启动时间的代际递增:Large SNP VM 启动 30.26 s vs 普通 VM 12.90 s,主因是 RMP 初始化与全内存预验证;Graz 的独立测量(Milan)给出 8 GB SNP VM 启动 1.9 倍、48 GB 达 2.41 倍于基线[^447^][^448^]。整合密度同样受损:CVM 内存需预分配+预加密、无法 KSM 去重,Small/Medium/Large SEV VM 内存占用 4.03/14.05/120.08 GB,而普通 VM 仅 1.28/1.49/4 GB[^447^]。

**SNP vs TDX 的代际收敛。**TUM(SIGMETRICS 2025,平台同上)的 MLC 峰值带宽注入测试给出:SEV-SNP 内存带宽开销平均 **2.88%**(All-reads 3.90%、3:1 读写 3.98%、2:1 读写 9.08%、1:1 读写 0.42%、stream-like 1.96%),同方法下 TDX 平均 7.86%[^34^]。Phoronix 内存测试套件则反向:SNP 7.29% > TDX 4.06%[^34^]——两组数字并存提示开销高度依赖访存模式,单一基准不可外推。应用层开销明显抬升:UnixBench Process 16%(SNP)/11%(TDX),TensorFlow BERT 16%/18%;OpenMP 以 `OMP_WAIT_POLICY=PASSIVE` 运行时 NPB 执行时间 +41%(SNP)/+73%(TDX),极端子项(ua)达 +431%(TDX),主因是 vCPU sleep/wakeup 引发的 HLT VM-Exit,可用 guest 侧 halt polling 以 CPU 占用换延迟[^34^]。内存首次 populate(含 acceptance/PVALIDATE,32 GB)SNP VM 28.11 s vs 普通 VM 17.64 s(**+59%**),已接受内存的后续访问差异则 <5%[^34^][^449^]。存储路径(virtio-blk+NVMe)SNP 带宽开销 4.6%、IOPS 2.9%[^34^]。

**非机密虚拟化的基础开销基线。**作为对照,跨 hypervisor 基准(Inria,2021)显示 KVM 在 kcbench 编译负载上仅比裸机慢约 4%,RAMspeed 无显著下降,而 Xen 慢 19%、type-2 hypervisor 慢 8%[^450^];叠加 SUSE/FOSDEM 在 EPYC 7742 上调优后 VM≈host 的结果[^451^],可以确立:AMD-V+NPT 的基础虚拟化开销在 CPU/内存负载上处于低个位数,本章其余开销几乎全部来自机密计算附加层(RMP 检查、GHCB 往返、bounce buffer)与 I/O 路径。

**更新的平台复测。**SUSE 在 EPYC 9005(SLES 15 SP6)上调优后的 2-VM NPB 与 STREAM 测试中,SEV 与 SEV-ES 的开销"really close to zero"[^452^];Azure 委托的白皮书(DCasv6 vs Dasv6,同为 4th Gen EPYC,2025-10)给出内存密集负载 2%、CPU 密集与 Redis 8% 的 SNP 开销[^453^];Phoronix 在 Azure v6(EPYC 9V74 Turin,16 vCPU/64 GB)上的 1:1 复测引用行业口径:典型 2–8~10%,数据库等 I/O 密集负载可达 10–12%[^454^]。按交叉验证裁定(C5),这些数据应按负载分层引用而非取单一区间:**CPU/内存负载 2–10%;I/O 密集负载可达 10–56%(Milan 代最差值,来自 bounce buffer 路径),新代际与调优后显著收敛**[^447^][^34^][^454^]。

### 13.3 调优手册

#### 13.3.1 NPS 拓扑、1G 静态大页、SMT 策略与 iommu=pt;SNP 场景的内存 pin 与功能限制

EPYC 虚拟化调优的主线由 13.1 节的机制直接推出:压缩嵌套 walk 路径(大页、NUMA 局部性)、削减高频退出(AVIC、避免 MSR 拦截)、消除调度抖动(钉核、关自动迁移)。SUSE 在 2×EPYC 7742 上的端到端验证(FOSDEM 2020)表明,完整调优后 1 VM、2 VM 乃至 30 VM 的 STREAM 总分均与裸机等比例吻合——内存密集负载的虚拟化基础开销可被压到接近零[^451^]。vCPU 拓扑建模是同一主线的延伸:OCI/Oracle 在 Genoa 上用 QEMU `dies`/topoext 把每个虚拟 CCX(8 核×2 线程=16 vCPU)钉到宿主同一 L3 组,使 guest 调度器创建的调度域与硬件一致[^455^]。

SNP 场景另有一条启动期调优轴:内存接受(acceptance)策略。预验证(OVMF 在启动时 PVALIDATE 全部 RAM)把成本集中在启动时间,运行期零抖动;懒验证(首次访问触发 `#VC` 再 PVALIDATE)反之,换来的是运行期不可预测的 `#VC` 尖峰[^456^]。结合 13.2 节的 +59% 首次 populate 实测,大内存 SNP VM 应按"启动 SLA 还是运行期确定性优先"显式选择策略。I/O 路径是 SEV 系最大短板(FIO 最高 56%、TCP 最高 36%),实践中优先做 vCPU 钉核、关 NUMA balancing、匹配 VM 与宿主拓扑——Yan 与 Gopalan 正是借此把 >50% 的异常开销压回个位数;研究侧(Bifrost 等)则通过消除 bounce buffer 与 VM-Exit 使 CVM 网络 I/O 追回甚至超过普通 VM[^447^]。

**表 13-2 EPYC 虚拟化调优清单(按收益来源分组)**

| 调优项 | 推荐配置 | 量化收益/依据 | 适用边界 | 来源 |
|---|---|---|---|---|
| NPS 拓扑 | 云通用负载 NPS1;HPC 典型 NPS4;NPS0 不推荐 | NPS1 延迟一致性最好,NPS4 内存通道局部性最强 | BIOS 层设置,影响全机 | [^184^][^185^] |
| vNUMA 镜像 | vNUMA 节点对齐 CCD 边界(SMT off 每 CCD 8 vCPU,on 16),节点数为偶数 | 保证 guest 调度域与硬件一致;Genoa 单 socket=12 CCD×8 核 | vNUMA 内存须与对应物理 NUMA 关联 | [^185^][^455^] |
| 钉核+NUMA 绑定 | `numatune memory mode='strict' nodeset` + `vcpupin` 同节点,`emulatorpin` 单独绑定 | 不钉核时 Milan/Genoa 多线程负载可慢约 3 倍(跨 CCD L3 未命中) | 静态分区场景 | [^195^][^457^] |
| 关自动 NUMA balancing | `numa_balancing=disable` | 开启且不钉 vCPU 时 NPB 开销可超过 50% | 仅适用于已静态绑定场景 | [^195^][^447^] |
| 1G 静态大页 | `transparent_hugepage=never default_hugepagesz=1GB hugepagesz=1GB hugepages=N` | 大页对 NPT 负载 +3–22%;内存密集负载典型 +10–30%,TLB miss 约降一个数量级 | THP 的 khugepaged 会干扰 vCPU,host 侧应关 | [^195^][^99^][^109^] |
| cache 拓扑暴露 | QEMU 正确暴露 L3 大小/共享线程数 | glibc memcpy 依据 L3 启发式选择指令路径,错误拓扑导致错误选择 | 所有 VM | [^451^] |
| SMT 策略 | HPC 负载 BIOS 关 SMT;或避免不同 VM 的 vCPU 共享同一核的两个 SMT sibling | GROMACS 表征(2×9654)显示 SMT 收益/损害因配置而异;机密计算测量惯例统一关 HT | 低延迟钉核 VM 可直接关 | [^184^][^195^][^34^] |
| IOMMU 模式 | 非 SNP 场景 `iommu=pt` | 消除 DMA 重映射开销,对网络密集负载影响显著 | SNP 场景不可用(见下) | [^184^][^185^] |
| AVIC | `kvm_amd.avic=1` + `kernel-irqchip=split`;>255 vCPU 需 x2APIC | VM-Exit −96%、IPI 投递 −47%(OCI Genoa 实测) | 上游默认状态随内核版本演化(2024 默认关,2025-06 起 RFC 拟 Zen 4+ 默认开),引用须带版本 | [^114^] |
| halt polling(CVM) | `kvm halt_poll_ns`(guest 侧) | 缓解 HLT 型负载 41–431% 的退化 | 以 CPU 占用换延迟 | [^34^] |
| SNP 内存 pin | libvirt `memtune hard_limit` 放宽至 guest RAM +256 MiB | 加密页不可换出/移动,QEMU 负责锁定 | 所有 SEV/SNP VM | [^222^] |
| SNP 功能限制 | 不支持 memory ballooning、内存/vCPU 热插拔、guest 内 hugepages;最大 255 vCPU;不兼容 Secure Boot 与 host TPM;Direct VM 不支持 PCI passthrough;不能 guest 内 reboot | KSM 与内存超分对 CVM 失效,直接影响整合率 | SLES 15-SP7 文档口径 | [^458^] |
| SNP IOMMU | BIOS 开 SNP 后 ESXi 无法将 IOMMU 置 passthrough,改用恒等映射 | 内存开销 <1%,768 GB Zen 5 主机 IOMMU 初始化 +7 s | VMware ESXi 9.0 | [^410^] |

表 13-2 中三组数字值得展开。第一,大页的收益区间跨度(+3–22% vs +10–30%)来自测量层次不同:前者是 ASPLOS 2008 对 NPT 负载的微架构级隔离测量[^99^],后者是生产调优综述对内存密集负载(≥8 GB)的端到端观察[^109^],两者互补而非矛盾;但 SNP 场景存在硬性例外——RMP 只以 4 KiB/2 MiB 粒度工作,1 GiB TLB 项被禁用(1 GiB 翻译只插入 2 MiB 子项),且 guest 内 hugepages 不被支持[^459^][^458^],因此 1G 大页仅作用于 host 侧 NPT 第二维。第二,AVIC 的 −96% 是退出计数而非吞吐,落地时应以 13.2 节的口径管理预期;其默认状态处于上游翻转期,部署脚本应显式设置 `kvm_amd.avic` 而非依赖默认。第三,RMP 一致性给 TLB 调优叠加了约束:RMP 权限缓存在 CPU TLB 及相关结构中,RMP 更新(PVALIDATE/RMPADJUST)会触发硬件广播式全系统 TLB 无效化,路径比普通页表操作更重[^460^];Zen 5/6 新增的 `RMPOPT`/`RMPREAD`/`RMPCHKD` 指令正是为压低这条路径的延迟(LLVM 已先行支持)[^461^]。最后,SNP 的"内存 pin + 禁 ballooning/KSM + ≤255 vCPU"组合是容量规划约束而非性能旋钮:它不改变单 VM 性能,却直接决定单宿主机的机密 VM 整合密度,应在集群层面计入。

**局限。**AMD SVM 的 `#VMEXIT`/`VMRUN` 硬件往返精确周期数无权威一手披露,本章以 `perf kvm` 微秒级平均值与 kvm-unit-tests 周期数代替;Phoronix 2026-02 复测的分项数据受页面限制未能全部抓取,仅引用其摘要口径;"NPT vs 影子页表 15–30%"为 2008 年数据的综合区间,当代 CPU 的 PWC/TLB 已大幅改进,实际差距更依赖工作集与页尺寸[^114^][^454^][^99^]。
