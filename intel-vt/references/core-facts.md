# Intel VT 核心事实速查（蒸馏自 13 维度深度研究，截至 2026-09-16）

> 用途：大多数 Intel VT 相关问题先读本文件即可回答；需要原始出处、原文摘录或完整证据链时，按 SKILL.md 路由表读对应 `intel_vt_dimNN.md`。
> 所有数字均有来源（见维度文件）；带 ⚠️ 的条目见 `errata.md` 勘误说明。

## 目录
1. 历史与理论根基 2. VMX 架构 3. EPT/VPID 4. VT-d 5. APICv/中断 6. 性能数据 7. 安全 8. TDX 9. 软件生态 10. 云应用 11. 嵌套虚拟化 12. AMD-V 对比 13. 2022-2026 动态

## 1. 历史与理论根基
- Popek & Goldberg 虚拟化定理（CACM 17(7), 1974-07）；Robin & Irvine（USENIX Security 2000）证明 x86 有 17 条敏感但不陷入指令，经典 trap-and-emulate 不可行。
- 软件绕行：VMware 二进制翻译 + ring deprivileging；Xen 半虚拟化（SOSP'03）；x86-64 长模式下纯软件 64 位虚拟化不可行（段机制被弱化）。
- Intel VT 前身代号 Vanderpool，2005-01-20 以 EAS 新闻稿公开；2005-11-14 Pentium 4 662/672 首发 VT-x。
- 家族：VT-x（IA-32 CPU）、VT-i（安腾，Silverdale/Montecito 2006-07-18）、VT-d（I/O，规范 2006-03，Q35 芯片组 2007 落地）、VT-c（网络）。
- 关键节点：FlexMigration=Dunnington 2008-09；EPT+VPID=Nehalem（2008-11/2009-03）；unrestricted guest=Westmere 2010；APICv=Ivy Bridge-EP 2013；VMCS shadowing=Haswell 2013；⚠️ MBEC=Kaby Lake（非 Skylake）；⚠️ PML=Broadwell Xeon 2015（非 Skylake）；TDX 2020-08 公布、2023-01-10 随 Sapphire Rapids 首发。
- 里程碑：KVM 2007-02-05 合入 Linux 2.6.20；Hyper-V RTM 2008-06-26；AWS EC2 2006 开启云时代。

## 2. VMX 架构
- 两种新模式：VMX root operation（VMM）与 VMX non-root operation（Guest），正交于 ring0-3；Guest 可在 non-root ring0 原生运行，无需修改。
- 启用链：CPUID.01H:ECX[5] 检测 → IA32_FEATURE_CONTROL(0x3A) lock+enable → CR0/CR4 按 FIXED0/1 MSR(0x486-0x489) 调整 → CR4.VMXE=1 → VMXON region（4KB 对齐、写 IA32_VMX_BASIC revision ID）→ VMXON。失败分 VMfailInvalid(CF)/VMfailValid(ZF)。
- VMCS 六区域：Guest-state（exit 存/entry 载）、Host-state（仅 exit 载，硬件从不保存）、execution 控制（pin-based / primary / secondary / tertiary 四层）、exit 控制、entry 控制、exit 信息（只读）。字段仅经 VMREAD/VMWRITE 按 32 位编码访问；布局未公开定义。
- VM-entry 两级失败：controls/host 检查失败→落回 VMLAUNCH 下一指令；guest 检查失败→按 host-state 跳转（exit reason bit31=1）。VMLAUNCH 限 clear 态、VMRESUME 限 launched 态，VMCLEAR 是跨核迁移必经。
- 关键 exit reason：10=CPUID、28=CR 访问、30=I/O 指令、31/32=RDMSR/WRMSR、48=EPT violation、49=EPT misconfiguration。
- 拦截体系：exception bitmap（#PF 用 PFEC_MASK/MATCH 二级判定）、I/O bitmap A/B、MSR bitmap（4×1KB）、CR0/4 mask+shadow、CR3-target、TSC offset。
- VMX 指令 13 条：VMXON/VMXOFF/VMPTRLD/VMPTRST/VMCLEAR/VMREAD/VMWRITE/VMCALL/VMLAUNCH/VMRESUME/INVEPT/INVVPID/VMFUNC。
- 设计哲学：不改既有指令语义；non-root 唯一区别是"配置化陷入"。

## 3. EPT / VPID（内存虚拟化）
- 影子页表之慢源于"同步税"：Guest 页表页写保护，页表写/CR3/INVLPG/缺影子项均 VM-exit；MICRO'14 实测最坏慢 29.2%。
- EPT 完成 GVA→GPA→HPA 全硬件转换；EPTP 存于 VMCS 0x201A，低 12 位编码内存类型(WB=6)、遍历长度-1(4级=3)、A/D 使能(bit6)。
- ⚠️ TLB miss 最坏访存 = **24 次**（4 Guest 项 + 4×4 EPT 遍历 + 4 最终转换；ISCA'16/VEE'21），中文社区常说"20 次"只算了 EPT 页表读。
- EPT violation(exit 48，权限/缺页) vs misconfiguration(exit 49，表项非法)。
- VMFUNC 0 号功能 = EPTP switching（512 项 EPTP list，零 exit 切换内存视图）。⚠️ VMFUNC 世代归属有分歧（ISA Haswell 时代 vs 硬件常归 Skylake）。
- VPID：16 位字段，VPID 0 归 VMM；INVVPID 四型。Intel 实测 EPT+VPID 使 Nehalem vConsolidate +25%。
- PML（Broadwell 起）：512 项 GPA log，D 位 0→1 自动记录，热迁移时间最多缩短 10.18%。
- 性能两面性：VMware 2009 实测 EPT 对 MMU 密集负载最高 +48%；但 SPECjbb2005 小页下反而慢——大页（2MB/1GB）是 EPT 时代必需品。学术共识"无常胜者"：EPT 消除 exit，影子页表 TLB miss 便宜（4 vs 24 次访存）。

## 4. VT-d（I/O 虚拟化）
- 规范演进：1.0（2006-03 DMA 重映射）→ 1.2/2.x（中断重映射、QI、ATS/PRI/PASID）→ Rev 3.0（2018-06 Scalable Mode，PASID 粒度）→ 量产 VT-d 4.0 → Rev 5.20（2026-04，HPT/虚拟命令接口）。
- DMA 重映射：root table(256 项/Bus) → context table(DevFn，含 Domain ID) → 二级页表；KVM/ACRN 复用 EPT 作为设备翻译表。
- 中断重映射 IRTE 16B；bit15 区分 Remapped/Posted；Posted Interrupt + APICv 实现直通设备中断零 VMM 介入。
- ATS/PRI/PASID 构成 SVA 与 SIOV 地基（Linux: `intel_iommu=on,sm_on`）。
- SIOV：ADI/SDI 取代 VF，VDCM 编排，数量千级~万级；2024-26 早期落地（iommufd vDEVICE/vIOMMU）。
- 生态：VFIO 正被 iommufd 取代；Xen PCI 直通强制 VT-d；VMware DirectPath I/O；Hyper-V DDA；GVT-g 已归档弃用（Xe 转 SR-IOV）。
- 安全：VT-d 是 Thunderbolt 4 认证、Windows Kernel DMA Protection、TXT/tboot PMR 的共同硬件根基。

## 5. APICv / 中断虚拟化
- VM-exit+entry 往返硬件成本：Penryn ~1100 → Nehalem ~820 → Westmere ~650 cycles（Intel Technology Journal）。
- FlexPriority（2008 Xeon 7400）：VTPR 影子，CR8 读写免 exit。
- APICv 三特性：APIC-register virtualization（virtual-APIC page）、virtual-interrupt delivery（硬件评估/EOI 虚拟化）、posted-interrupt processing（64B PID：PIR/ON/SN/NV/NDST + notification vector）。
- IPI virtualization（Sapphire Rapids，Linux 6.0）：IPI 周期 -22.21%(xAPIC)/-15.98%(x2APIC)，hackbench -18.8%。
- AMD AVIC 对照：erratum #1235 致长期默认关闭，Zen4+（2025-06 上游）推进默认开启。⚠️ 中断重映射知名 erratum 在 Intel 侧（5520/5500 #53）。

## 6. 性能数据（引用须带测试条件）
- VM-exit 裸转换 2409(P4)→937(Core2) cycles；Nehalem 再降 ~60%（ASPLOS'06）；含处理端到端 ~3900 cycles 均值（NOVA, EuroSys'10），I/O 类可达 15826。
- 负载画像（IBM）：CPU/内存近裸机；KVM 随机 IOPS 减半、MySQL 损失 >40%（Docker ~2%）。
- EPT：消除 >99% exit、开销 20%→1-3%（NOVA）；高 TLB-miss 负载输影子分页 17-34%。
- 嵌套虚拟化：Turtles 6-8%（下界）；I/O 密集吞吐可降 4.3x（OoH）。
- 缓解代价：KPTI 典型 0.5-6%、syscall 密集 5-30%；L1TF 场景 vSphere SCAv1 损失 ~30-35%、SCAv2 ~10%（VMware 官方）。
- 优化收益：SR-IOV 9.57Gbps 线速、延迟 63μs→2-3μs；halt-polling 唤醒延迟降 2-10x。
- 公有云税：Xen 代 AWS 数据库负载最高 31% 写吞吐损失；Nitro 单租户 <1%。

## 7. 安全
- 信任反转是 VT 原生属性：Ring -1，VMM 成新 TCB；Blue Pill（2006）与 Vitriol 证明无需漏洞即可武器化合法 VT 特性。
- 检测博弈：RDMSR 慢 23 倍可作指纹，但 hypervisor 可伪造 RDTSC——需外部时间源。
- 重大逃逸 CVE 全在软件层（VENOM CVE-2015-3456 QEMU FDC、CVE-2020-14364、CVE-2021-28476 Hyper-V CVSS 9.9），非 VT 硬件缺陷。
- 硬件层缺陷以侧信道形态出现：L1TF/Foreshadow（CVE-2018-3615/3620/3646）经 EPT 击穿 VM 隔离；关超线程致云容量减半（Red Hat）。
- 防御性虚拟化：VBS/HVCI/Credential Guard 用 SLAT 建边界（"良性 Blue Pill"）；TXT/DRTM 用 SENTER+TPM 动态 PCR。
- 云隔离三次跃迁：收敛 QEMU 攻击面 → 微码/调度缓解 → microVM/机密计算（TCB 缩至芯片+微码）。

## 8. TDX（机密计算，重点）
- 架构：SEAM root/non-root；TDX Module（NP-SEAMLDR→P-SEAMLDR 加载链，SEAMRR 隔离，支持热更新）；Secure EPT + PAMT + TME-MK（AES-128-XTS，私有 KeyID）；VMM/主机 OS/SMM/BIOS/管理员全部移出 TCB。至强 6 起 AES-256。
- 证明：TD Report(1024B, MRTD/RTMR) → SGX Quoting Enclave 签 TD Quote → DCAP 验证；实测 Quote ~75.6ms（GCP C3）。
- 版本：1.0（SPR 2023 GA）→ 1.5（live migration MigTD + TD Partitioning，2025）→ 2.0/TDX Connect（Granite Rapids 2025-02 硬件就绪，SPDM+IDE+TDISP，端到端 GA 未官宣）。
- SGX 关系：客户端 SGX 已移除（12 代酷睿），服务器至强保留；TDX 证明栈依赖 SGX QE，两者共生。
- 内核历程：guest 5.19、证明驱动 6.2、**host/KVM 主线合入 Linux 6.16（2025）**。
- OS/云：Ubuntu 26.04 LTS 原生全栈；阿里云 g8i 全球首发（2023-03 GA）、⚠️ Azure DCesv5/ECesv5 为 2023-11 预览（Azure 首个 TDX GA = DCesv6/ECesv6 等 v6 系列，2026-02-26）、GCP C3 GA 2024-10、IBM Cloud 2025、VMware VCF 9.1 TDX GA（2026-05）。
- 性能：计算 <5%，I/O 密集 10-30%，H100+TDX 机密 LLM 推理吞吐损失 18-21%。
- 风险：TDXRay（2026，INTEL-SA-01271）影响 SPR/EMR/GNR 三代。

## 9. 软件生态
- KVM：kvm.ko+kvm_intel.ko 加载即 VMXON，无软件回退；/dev/kvm 三级 fd + KVM_RUN；EPT/VPID/unrestricted_guest 默认启用、缺项自动降级；posted interrupt 需 irqchip 内核化+enable_apicv+直通设备+中断重映射。
- Xen：PV→HVM(借 VT-x)→PVHVM→PVH（推荐）；缺中断重映射曾致提权 CVE-2011-1898。
- VMware：ASPLOS'06 证明初代 VT-x 反不如二进制翻译（缺 MMU 虚拟化），EPT 后反转；ESXi 5.1 起嵌套 64 位 guest 强制 EPT。
- Hyper-V：SLAT(EPT) 硬性要求；VBS 用 VTL0/VTL1；Win11 默认 VBS，hypervisor 常驻，性能税约 5-10%（游戏帧率 -6%）。
- 轻量级：Firecracker（Rust，<5MiB/<125ms）、Cloud Hypervisor（Intel 发起）、Kata（2017 合并 Clear Containers+runV）。
- 桌面：macOS Hypervisor.framework 要求 VT-x+EPT+unrestricted guest；HAXM 已退役（AEHD 接棒）；Hyper-V 独占 VT-x → VMware 15.5.5+/VirtualBox 6.0+ 改走 WHPX。

## 10. 云计算应用
- AWS：Xen→KVM/Nitro（<1%）；Azure：Hyper-V + Azure Boost 卸载；GCP：定制 KVM + Titanium（与 Intel 联合 IPU）；阿里云神龙（宣称损耗接近 0）；腾讯/华为类似卸载路线。
- 实时迁移暗线：FlexMigration → EPT A/D + PML → TDX 1.5 TD 迁移（MigTD；CVE-2025-30513 迁移路径严重漏洞）。
- NFV：Xeon+DPDK+VT-d/SR-IOV 定义 5G 核心网/UPF 加速范式。
- 整合：30:1 整合比、利用率 5-15%→60-80%；vCPU 超售 1.5-4 倍为业界常态。
- 市场：Gartner 2025-08：2024 IaaS $1718 亿(+22.5%)；VMware 占服务器虚拟化收入 96%+（2024），Broadcom 提价驱动替代。

## 11. 嵌套虚拟化与学术前沿
- 原理：L0 合并 VMCS01+VMCS12 为 VMCS02；单次 L2 exit 可级联放大 40-50 次 L1 exit；⚠️ 嵌套 EPT 多维分页 worst-case 推导以维度文件为准。
- KVM nVMX：上游默认关、Ubuntu 默认开；L1 不能用 VT-d/APICv、不支持 L3；嵌套热迁移经 KVM_CAP_NESTED_STATE 解决（VMX 2019）。
- 云平台：Azure 2017-07、GCP 2017-09、⚠️ **AWS=2026-02（C8i/M8i/R8i）非 2023**；阿里云/华为云官方不支持。
- 学术谱系：Turtles(OSDI'10 最佳论文)→ELI(ASPLOS'12)→Dune(OSDI'12)→LightVM(SOSP'17)→⚠️ **OoH=SC'22（非 SOSP'22）**；安全方向 SeKVM(SOSP'21 机器证明 KVM)、HyperEnclave(ATC'22 蚂蚁)。

## 12. AMD-V 对比
- 哲学差异：Intel VMCS 布局未定义、仅 VMREAD/VMWRITE 按编码访问、host 状态内嵌；AMD VMCB 布局公开、普通内存读写、host 状态外置 VM_HSAVE_PA、VMRUN 整块世界切换。
- SLAT：AMD NPT/RVI（Barcelona 2007-09）领先 Intel EPT 约 14 个月。
- 中断虚拟化是最大非对称项：APICv 2013 落地默认启用；AVIC 因 erratum 长期默认关（2025-06 Zen4+ 起推进默认开）。
- 机密计算：SGX(2015) vs SEV(2017)；SNP 2021 vs TDX 2023；SIGMETRICS'25 实测 TDX VMEXIT 延迟放大 472% vs SNP 240%。
- 市场：AMD 服务器份额 2018Q1 ~1.4% → 2024Q4 25.1%（Mercury Research）。
- 跨厂商 vMotion 不可行（VMware EVC 官方明确）。

## 13. 2022-2026 最新动态
- Xeon 6（Granite Rapids 2024-09/Sierra Forest 2024-06）：TDX 2.0.x、AES-256、MRDIMM-8800 实测 743GB/s/路、官方 5:1 整合叙事。
- Clearwater Forest：2026-06-01 Computex 发布，首款 18A 数据中心 CPU、288 Darkmont 核、TDX 2.0 支持。
- Panther Lake（酷睿 Ultra 300）：2026-01-05 CES GA，首款 18A 客户端。
- VMX 新特性：tertiary controls 框架 + IPI virtualization（Linux 5.19/6.0）+ Notify VM exit（2022）+ Bus-lock detection；HLAT 已入 SDM。
- 软件分水岭：KVM TDX host = Linux 6.16；Ubuntu 25.10/26.04 LTS 生产级 TDX；VCF 9.1（2026-05）TDX GA。
- 消费端：Win11 25H2 逐级默认 VBS/HVCI，VT-x/EPT 成为 PC 安全基座；副作用 5-25% 游戏性能损耗。
- 未来：Diamond Rapids（Xeon 7）官方宣布 2027（18A-P、PCIe Gen6）；TDX 计划未披露。
