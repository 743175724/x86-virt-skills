# 维度12：Intel VT-x 与 AMD-V（SVM）技术对比，及 ARM/RISC-V 虚拟化格局

> 研究范围：CPU/内存/中断/IOMMU 虚拟化双侧对比、特性发布时间线、机密计算（SEV 系列 vs SGX/TDX）、ARM VHE 与 RISC-V H 扩展、市场份额数据（Mercury Research 等）、软件兼容层（KVM/QEMU/libvirt/EVC）。
> 方法：22+ 次独立检索，优先 Intel/AMD 官方文档、kernel.org/LKML、顶会论文、Mercury Research 公开报道。
> 引用约定：[^N^] 对应文末参考链接。

---

## 1. CPU 虚拟化：VT-x/VMX vs AMD-V/SVM

### 1.1 两套独立设计的同构方案

Intel VT-x（代号 Vanderpool）与 AMD-V（代号 Pacifica，最初发布时名为 SVM——Secure Virtual Machine）是同一思路的两次独立实现：都在原有特权级之外新增"host/guest 两种模式"，Intel 称 **VMX root / non-root operation**，AMD 称 **host mode / guest mode**；guest 触发敏感事件时硬件自动切换回 host（Intel 称 VM-exit，AMD 称 #VMEXIT）[^1^][^9^]。两者指令集与数据结构互不兼容，hypervisor 必须分别实现（Linux KVM 即 kvm_intel 与 kvm_amd 两个模块）[^12^]。

**证据 E1.1**
- Claim：VT-x 引入 root/non-root 两种正交模式，状态存于内存驻留结构 VMCS；hypervisor 用 vmclear/vmptrld/vmwrite 初始化、vmlaunch 进入 guest、vmread/vmwrite 处理 exit、vmresume 恢复。
- Source：NecoFuzz（arXiv 2512.08858，学术）
- URL：https://arxiv.org/html/2512.08858
- Date：2025-12
- Excerpt："Intel VT-x introduces two CPU modes orthogonal to existing ones: non-root mode and root mode. When switching between these modes, the CPU stores its internal state in a memory-resident structure called the VM control structure (VMCS)."
- Confidence：高

**证据 E1.2**
- Claim：AMD SVM 以 VMCB 为核心；VMRUN 以 VMCB 为参数进入 guest，host 状态保存在 VM_HSAVE_PA MSR 指向的物理内存区；#VMEXIT 时 CPU 自动将 guest 状态存入 VMCB.SAVE 并从 VM_HSAVE_PA 恢复 host 状态，host 从 VMRUN 的下一条指令继续执行。
- Source：51CTO 技术博客（引 AMD APM）；看雪 Blue Pill 教程
- URL：https://blog.51cto.com/u_16099221/9904946 ; https://bbs.kanxue.com/thread-291859.htm
- Date：2024-03 / 2026-07
- Excerpt："VMRUN 命令以 VMCB 为参数，使 CPU 进入'guest'状态……并将之前 VMM 的 CPU 状态保存在 MSR_VM_HSAVE_PA 寄存器所指向的物理内存区域中……CPU 执行 #VMEXIT 行为时，会自动将虚拟机的状态保存到 VMCB.SAVE 区，并从 MSR_VM_HSAVE_PA 指定的区域加载 VMM 的 CPU 状态。"
- Confidence：高

### 1.2 设计哲学差异：VMCS 抽象访问 vs VMCB 明确定义

这是两家最有代表性的哲学分野：

| 维度 | Intel VMCS | AMD VMCB |
|---|---|---|
| 布局 | **未定义**（implementation-specific），只能用 VMREAD/VMWRITE 按字段编码访问 | **已定义**（AMD APM Appendix B），可用普通内存读写直接访问 |
| Host 状态 | 保存在 VMCS 内的 host-state area | **不在 VMCB 中**；另设 4KB host state area，地址写入 VM_HSAVE_PA MSR |
| 激活模型 | 需 VMCLEAR + VMPTRLD 将 VMCS 置为 current/active，存在"current VMCS"概念 | VMRUN 直接以 VMCB 物理地址为操作数，无绑定概念 |
| 状态粒度 | 逐字段 VMREAD/VMWRITE | VMRUN/#VMEXIT 整块保存/恢复（另配 VMLOAD/VMSAVE 选择性加载 FS/GS 等隐藏状态） |

**证据 E1.3（双侧对照，同一来源）**
- Claim：VMCS 布局未定义、只能经 VMREAD/VMWRITE 按 encoding 访问、需 VMCLEAR/VMPTRLD 激活且含 host state fields；VMCB 布局已定义、可用普通内存访问、不含 host state fields（host 状态经 VM_HSAVE_PA 指向的独立区域）。
- Source：Hypervisor-101-in-Rust（Satoshi Tanda，安全研究员教程）
- URL：https://tandasat.github.io/Hypervisor-101-in-Rust/hypervisor-setup-and-operation-cycle/e2-settings-up-the-vmcsvmcb.html
- Date：持续更新（2024 版）
- Excerpt："Intel: The layout of VMCS is undefined. Instead, VMREAD/VMWRITE take 'encoding' to specify which field to access… VMCS contains host state fields. / AMD: VMCB is read and written through usual memory access. The layout of VMCB is defined… VMCB does NOT contain host state fields. Instead, another 4KB memory block, called host state area… Write the address of the area to the VM_HSAVE_PA MSR."
- Confidence：高

**证据 E1.4**
- Claim：Intel 不允许直接读写 VMCS 内存，抽象化的 vmread/vmwrite 接口使 4KB 页内布局成为实现细节，可在后续 CPU 上改变；字段编码还内嵌字段类型信息。
- Source：pagetable.com（Intel VT VMCS Layout）
- URL：https://www.pagetable.com/?p=348
- Date：未注明
- Excerpt："Intel doesn't allow me to just read and write memory in the VMCS, but abstracts accessing the virtualization state using a vmread/vmwrite interface. This way, the actual layout of this 4 KB page is an implementation detail and can be changed on later CPUs."
- Confidence：高

**评述**：Intel 的抽象换来跨代布局自由与字段编码自描述性，代价是每次访问都是一条特权指令且需维护 current-VMCS 状态机；AMD 的"内存结构体"模型对软件更直白、批量保存/恢复更贴合世界切换语义，但布局一旦固定难以演进（后续 AMD 通过扩展 VMCB 控制字段和新增干净位/clean bits 缓解）。两边没有绝对优劣，而是"显式字段读写"与"整块世界切换"两种取舍。

---

## 2. 内存虚拟化：EPT vs NPT/RVI，VPID vs ASID

### 2.1 SLAT 两侧对照

EPT（Extended Page Tables）与 NPT（Nested Page Tables，AMD 亦名 RVI——Rapid Virtualization Indexing）同属二级地址转换（SLAT），在 guest 的 GVA→GPA 翻译之外由硬件叠加 GPA→HPA 第二级翻译，替代影子页表；缺页分别产生 EPT Violation 与 NPT Fault（均为 VM-exit）；根指针分别为 EPTP（VMCS 字段）与 nCR3（VMCB 控制区）[^2^][^3^]。

**证据 E2.1**
- Claim：AMD 2007-09-10 在 Barcelona 率先加入 RVI/NPT（SLAT）；Intel 2008-11 在 Nehalem 推出 EPT，并同时引入 VPID。AMD 在二级地址转换上领先 Intel 约 14 个月。
- Source：awesome-virtualization（Chronology，社区权威汇编）；CSDN《虚拟化发展史》
- URL：https://github.com/Wenzel/awesome-virtualization/blob/master/README.md ; https://blog.csdn.net/gitblog_00344/article/details/153448721
- Date：2017 起维护 / 2026-05
- Excerpt："2007-September-10: AMD Barcelona adds RVI (Rapid Virtualization Indexing) a.k.a (Nested Page Tables) a.k.a (SLAT) / 2008-November: Intel Nehalem — EPT, VPID."
- Confidence：高

### 2.2 TLB 隔离：VPID ↔ ASID

**证据 E2.2（双侧对照，同一来源）**
- Claim：AMD 用 32 位 ASID 标记 TLB 属于哪个虚拟机，宿主机 ASID=0，VMRUN 不刷新 TLB；Intel 无 ASID 机制，使用 16 位 VPID 标记 TLB，并配 INVVPID/INVEPT 指令；AMD 对应指令为 INVLPGA。
- Source：技术宅的结界论坛（AMD64 分页缓存体系长文，与 AMD APM/Intel SDM 描述一致）
- URL：https://www.0xaa55.com/thread-25636-1-1.html
- Date：2018-11
- Excerpt："ASID 是一个 32 位的值，用于标记 TLB 属于哪个虚拟机。在 AMD64 体系下，规定宿主机的 ASID 为 0……注意，Intel 处理器上没有 ASID 机制，ASID 是 AMD 处理器独有的。在 Intel 处理器上，使用 16 位的 VPID 来标记 TLB 属于哪个虚拟机。"
- Confidence：高

**证据 E2.3**
- Claim：KVM 实现侧，VPID=0 表示禁用、VM-Enter/Exit 自动刷 TLB；每个 vCPU 分配唯一 VPID；SVM 侧用 INVLPGA 按 ASID 刷 TLB。
- Source：Martins3（KVM TLB flush 分析，引 arch/x86/kvm/vmx/vmx.c）；LKML 补丁（tlb_flush_guest 拆分，VMX 走 INVVPID、SVM 走当前 ASID flush）
- URL：https://github.com/Martins3/Martins3.github.io/blob/master/docs/kvm/mmu/tlb-flush-draft.md ; https://lkml.org/lkml/2020/3/17/37
- Date：2020-09 / 2020-03
- Excerpt："VPID=0 表示禁用，此时 VM-Enter/Exit 自动刷新 TLB" / LKML: "For VMX… always flush via INVVPID(SINGLE_CONTEXT)… For SVM, flushing TLB entries from the guest's perspective can be done by flushing the current ASID."
- Confidence：高

### 2.3 大页

**证据 E2.4**
- Claim：EPT 与 NPT 均支持 2MB/1GB 大页。
- Source：51CTO《深入解析 Intel EPT、AMD NPT 与 ARM Stage2 MMU》对比表；Kernullist（EPT 页级粒度分析）
- URL：https://blog.51cto.com/u_16213609/14585818 ; https://kernullist.github.io/kernullist-blog/posts/hypervisor-cheats-part-2-ept-npt-split-views-and-second-stage-fault-evidence/
- Date：2026-05 / 2026-06
- Excerpt："大页支持：Intel EPT 2MB/1GB；AMD NPT 2MB/1GB" / "Intel EPT distinguishes 1 GB EPT PDPTE leaves, 2 MB EPT PDE leaves, and 4 KB EPT PTE leaves."
- Context：具体时间线（K10 原生支持 1GB 页故 Barcelona NPT 即支持 1GB；EPT 1GB 页到 Ivy Bridge 才支持）属合理推断，未在本次检索中取得一手出处。
- Confidence：中（特性存在：高；精确首发时间：中）

---

## 3. 中断虚拟化：APICv/Posted Interrupt vs AVIC

### 3.1 机制对照

Intel 侧为 APICv 家族：virtual-APIC page、EOI 加速、virtual-interrupt delivery、以及 **posted-interrupt processing**——VMCS 中记录 posted-interrupt descriptor 地址与 notification vector，硬件把中断写入 PIR 位图并通知 CPU，guest 在 non-root 下直接收中断、无需 VM-exit；配合 VT-d 中断重映射可实现透传设备中断直达 guest[^4^][^5^]。AMD 侧为 **AVIC**（Advanced Virtual Interrupt Controller），同样提供硬件加速的 APIC 虚拟化、门铃/后门铃（doorbell）机制与 vAPIC backing page；x2AVIC 扩展到 x2APIC MSR 访问[^6^]。

**证据 E3.1（双侧对照，同一来源）**
- Claim：AMD 2012 年发表 AVIC 但迟至 2016 年才在 Carrizo APU 落地；Intel 2013 年发布 APICv，实用于 Ivy Bridge 的 Xeon E5-2600 v2，Broadwell 世代进一步强化。
- Source：Cool3C《硬科技：x86 虛擬化由內到外還是繼續難搞（下）》（专业硬件媒体）
- URL：https://www.cool3c.com/article/152681
- Date：2020-04
- Excerpt："AMD 在 2012 年發表 AVIC(Advanced Virtual Interrupt Controller)，但遲至 2016 年才出現在 Carrizo APU。Intel 則是在 2013 年發布 APICv(APIC Virtualization)，在 2013 年實用於 Ivy Bridge 微架構的 Xeon E5-2600 v2，在 Broadwell 世代更加精進。"
- Confidence：高

**证据 E3.2**
- Claim：posted-interrupt descriptor 地址与 notification vector 记录在 VMCS（POSTED_INTR_NV / POSTED_INTR_DESC_ADDR 字段），透传设备中断经中断重映射更新目标 guest 的 descriptor，不再产生 VM-exit。
- Source：CSDN《中断虚拟化之 APIC 虚拟化》（引 Linux arch/x86/kvm/vmx.c）；kernelnote《Interrupt Posting 机制》
- URL：https://blog.csdn.net/weixin_46324627/article/details/136461495 ; https://kernelnote.com/iommu-posted-interrupt-deep-dive.html
- Date：2024-03 / 2022-04
- Excerpt："设备透传结合 posted-interrupt processing 机制后，中断重映射硬件单元负责更新目标 Guest 的 posted-interrupt descriptor，将不再导致任何 VM exit，外部透传设备的中断可直达目标 CPU。"
- Confidence：高

### 3.2 成熟度与内核支持差异（重要非对称事实）

APICv 在 Intel 平台自 Ivy Bridge（2013）起即默认启用；而 AVIC 长期受 errata 与固件限制，KVM 默认 **关闭**，直到 2025 年才推进 Zen 4 起默认开启：

**证据 E3.3**
- Claim：AMD Family 17h（Zen1/Zen2）存在 erratum #1235——ICR 写模拟期间硬件可能读到陈旧的 IsRunning=1 位，无法产生 AVIC_IPI_FAILURE_TARGET_NOT_RUNNING VM-Exit，导致目标 vCPU 挂起；KVM 对受影响 CPU 禁用 AVIC IPI 虚拟化；该 workaround 亦被扩展到同源的海光 Hygon Family 18h。
- Source：阿里云漏洞库（CVE-2026-64172，转录内核 commit）；Red Hat Bugzilla #2502578
- URL：https://avd.aliyun.com/detail?id=AVD-2026-64172 ; https://bugzilla.redhat.com/show_bug.cgi?id=2502578
- Date：2026-07
- Excerpt："hardware may read a stale IsRunning=1 bit during ICR write emulation and silently fail to generate an AVIC_IPI_FAILURE_TARGET_NOT_RUNNING VM-Exit… The absence of the VM-Exit causes KVM to miss the required wakeup of blocking target vCPUs, leading to hung vCPUs."
- Confidence：高

**证据 E3.4**
- Claim：KVM 上游 2025-06 补丁《KVM: SVM: Enable AVIC by default from Zen 4》：AVIC/x2AVIC 自 Zen 4 起功能完整，拟默认开启；Zen 4 之前受 errata 影响（workaround 刚合入），需 force_avic=1 显式启用；同时有平台固件会关闭 AVIC（出现 X2AVIC 有而 AVIC 无的 CPUID 组合）。
- Source：Patchew/LKML（Naveen N Rao, AMD；Sean Christopherson、Maxim Levitsky 参与讨论）
- URL：https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/
- Date：2025-06-26
- Excerpt："AVIC (and x2AVIC) is fully functional since Zen 4… CPUs prior to Zen 4 are affected by hardware errata related to AVIC… the Zen3 systems I have access to don't support AVIC / APIC virtualization in the IOMMU, so it's not just AVIC being soft-disabled in the CPU."
- Confidence：高

**证据 E3.5**
- Claim：部分 AMD 平台 BIOS/固件禁用 AVIC，内核打印 "[Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported"。
- Source：Framework Community（Ryzen 7 7840U 实例）
- URL：https://community.frame.work/t/avic-appears-to-be-disabled-on-framework-laptop-13-amd-ryzen-7-7840u/82218
- Date：2026-04
- Excerpt：dmesg: "kvm_amd: [Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported"
- Confidence：高

**评述**：中断虚拟化是 AMD 长期落后的领域——AVIC 发布早于 APICv 实用化，但硬件 errata、固件关断与 IOMMU 侧不支持三重因素使其在 Linux 上长期默认关闭；Intel APICv+posted interrupt 经十多年生产检验，KVM `enable_apicv` 默认开启。此格局在 Zen 4 + 2025 年上游补丁后开始收敛。

---

## 4. IOMMU：VT-d vs AMD-Vi

两者目标一致：DMA 重映射（设备直通隔离）+ 中断重映射（MSI/MSI-X 验证与路由，防 guest 伪造中断）。Intel 称 VT-d（Virtualization Technology for Directed I/O），AMD 称 AMD-Vi / IOMMU[^7^][^8^]。

**证据 E4.1（双侧对照，同一来源）**
- Claim：VT-d 与 AMD-Vi（IOMMU）做同一件事，只是厂商命名不同；与 VT-x/AMD-V 是相互独立的特性（直通才需要 IOMMU）。
- Source：vormox.com（PCI Passthrough 教程，与 Intel VT-d spec/AMD IOMMU spec 一致）；mo4tech
- URL：https://vormox.com/blog/how-to-enable-iommu-vt-d-amd-vi-in-your-bios-and-proxmox-ve-for-pci-passthrough ; https://www.mo4tech.com/in-linux-check-whether-vt-d-or-iommu-is-enabled.html
- Date：2026-07 / 2021-10
- Excerpt："Intel calls its implementation VT-d… AMD calls theirs AMD-Vi. They do the same job, they just come from different vendors… Don't confuse this with VT-x or AMD-V… IOMMU/VT-d/AMD-Vi is a separate, additional feature."
- Confidence：高

**证据 E4.2**
- Claim：中断重映射机制：设备中断请求被 IOMMU 截获，按中断重映射表（IRTE）验证并转换后投递；兼容格式与重映射格式由 Address bit4 区分。
- Source：稀土掘金《VT-d 学习02：Interrupt Remapping 技术原理》（引 Intel VT-d SPEC Ch.5）；Kernelgo KVM 笔记
- URL：https://juejin.cn/post/7351662722935963663 ; https://luohao-brian.gitbooks.io/interrupt-virtualization/content/vt-d-interrupt-remapping-fen-xi.html
- Date：2024-03 / 2018-01
- Excerpt："Interrupt Remapping 则提供 IO 设备的中断重映射和路由功能，来达到中断隔离和中断迁移的目的……由 IOMMU 截获中断，先将其中断映射到 host 的某个中断上，然后再重定向到 Guest 内部。"
- Confidence：高

### 4.1 中断重映射的"历史坑"核实

任务要求核实"AMD 早期 ER 问题"。检索结论：**最著名且有据可查的中断重映射 erratum 在 Intel 侧**（5520/5500 芯片组 erratum #53）；AMD 侧的问题更多是**功能缺席**（早期 IOMMU 不支持中断重映射、Zen3 IOMMU 不支持 AVIC）而非单一 erratum：

**证据 E4.3**
- Claim：Intel 5520/5500 芯片组 erratum #53：无法正确实现中断重映射，Intel 官方建议 BIOS 关闭该特性；部分厂商未修复 BIOS 导致中断亲和迁移后仍投递到旧 CPU（丢中断/伪中断，dmesg "No irq handler for vector"）；Linux 内核 2013 年加 quirk（revision 0x13 检测 + set_irq_remapping_broken 强制关闭并 WARN/TAINT）。
- Source：LKML/snapcraft 内核邮件列表（commit 03bbcb2e，Neil Horman / Joerg Roedel）
- URL：https://lists.snapcraft.io/archives/kernel-team/2013-July/029959.html
- Date：2013-07
- Excerpt："For the 5520 and 5500 chipsets which contained an errata (specifically errata 53), which noted that these chipsets can't properly do interrupt remapping, and as a result they recommend that interrupt remapping be disabled in bios… occasionally interrupts can arrive at a cpu even after affinity for that interrupt has been moved, leading to lost or spurious interrupts."
- Confidence：高

**证据 E4.4**
- Claim：AMD 侧的中断重映射经历从无到有的过程：AMD IOMMU v2（支持 PCI PRI 和 PASID）首次出现在 Opteron 4000/6000 平台；IOMMU 同时提供 DMA 地址翻译与中断重映射，用于多中断设备与多核平台的中断投递。
- Source：Linux 内核配置选项说明（CONFIG_AMD_IOMMU_V2）；AMD Instinct 官方文档 IOMMU 页
- URL：https://gitcode.csdn.net/66e0150b2db35d1195e7b2c8.html ; https://instinct.docs.amd.com/projects/amdgpu-docs/en/latest/conceptual/iommu.html
- Date：2019-01（内核文档转录）/ 持续更新
- Excerpt："新一代的 AMD IOMMUv2 硬件（支持 PCI PRI 和 PASID 接口）支持，首次出现在 AMD Opteron 4000/6000 系列平台上。" / AMD docs: "The IOMMU also provides interrupt remapping, which is used by devices that support multiple interrupts and for interrupt delivery on hardware platforms with a large number of cores."
- Confidence：高

**证据 E4.5**
- Claim：AMD 平台中断重映射缺失/关闭时，VFIO 直通需 `allow_unsafe_interrupts=1`（无中断重映射保护的"不安全"直通）；Linux 输出 "AMD-Vi: Interrupt remapping enabled" 方为正常。
- Source：博客园《PVE 开启 IOMMU（硬件直通）》
- URL：https://www.cnblogs.com/yihuyuan/p/18607284
- Date：2024-12
- Excerpt："如果失败或者没有，可能没有启用 IOMMU 中断重映射，会导致无法直通……options vfio_iommu_type1 allow_unsafe_interrupts=1"
- Confidence：高

**核实结论（E4.3–E4.5 综合）**：prompt 中"AMD 早期 ER 问题"的记忆很可能混合了两件事——(a) Intel 5520/5500 erratum #53（2013 年内核 quirk，有内核 commit 为证）；(b) AMD 早期 IOMMU 缺乏中断重映射能力、以及 AVIC 依赖 IOMMU 侧配合（Zen3 及更早 IOMMU 不支持 AVIC，见 E3.4）。前者是明确的 erratum 且有据可查；后者是功能演进缺口。两侧各有"坑"，性质不同。

---

## 5. 特性发布时间线对照表

| 年份 | Intel | AMD | 谁先发 |
|---|---|---|---|
| 2005-11 | **VT-x 首发**（Pentium 4 662/672，代号 Vanderpool；2005-01-20 宣布）[^13^][^14^] | Pacifica 规范 2005-05 公布 | Intel 先（约 6 个月） |
| 2006-05 | — | **AMD-V 首发**（Orleans/Windsor，Rev F K8）[^13^][^14^] | — |
| 2007 | VT-d 随 Q35 芯片组上市（2007-06）[^15^] | AMD 700 系列芯片组（790FX 等，含 IOMMU，2007-11）[^16^] | Intel 略先（芯片组层面，置信中） |
| 2007-09 | — | **NPT/RVI（SLAT）随 Barcelona 首发**[^13^] | **AMD 先（约 14 个月）** |
| 2008-11 | **EPT + VPID 随 Nehalem 首发**[^13^] | — | — |
| 2010-01 | Unrestricted Guest（实模式 guest）随 Westmere[^13^] | — | — |
| 2012 | — | AVIC 规范发表（落地 Carrizo 2016）[^4^] | AMD 规范先，Intel 落地先 |
| 2013 | **APICv 落地**（Xeon E5-2600 v2, Ivy Bridge）[^4^]；Haswell：VMCS shadowing、VMFUNC、#VE、EPTP switching[^13^] | — | Intel 落地先（2013 vs 2016） |
| 2015 | **SGX 随 Skylake 落地**[^17^] | — | Intel 先 |
| 2016-2017 | — | **SEV 随 EPYC（Zen1 Naples）落地**（每 VM 独立 ASID 密钥）；SEV-ES 2017 公布[^13^][^17^] | VM 级机密计算 AMD 先 |
| 2019-2021 | — | SEV-SNP 2019 公布，随 EPYC Milan（Zen3, 2021-03）落地[^13^][^18^] | — |
| 2021-2023 | **TDX 2021 公布**，随 Sapphire Rapids（2023-01 发布）落地[^17^][^18^] | — | 对应 SNP 晚约 2 年 |
| 2025 | — | KVM 推进 Zen 4 起 AVIC 默认开启[^6^] | — |

**证据 E5.1**
- Claim：时间线主干：2005-11-13 Intel VT-x（Pentium 4 662/672）；2006-05-23 AMD AMD-V（Orleans/Windsor）；2007-09-10 Barcelona RVI；2008-11 Nehalem EPT+VPID；2010-01 Westmere unrestricted guest；2013-06 Haswell VMCS shadowing/VMFUNC/#VE；2017-06 EPYC SEV、SEV-ES 公布；2019 SEV-SNP 公布。
- Source：awesome-virtualization README "Chronology"
- URL：https://github.com/Wenzel/awesome-virtualization/blob/master/README.md
- Date：2017 起持续维护
- Excerpt：见表内逐条引用。
- Confidence：高

**证据 E5.2**
- Claim：Intel 2005-01-20 宣布 Vanderpool，2005-11-14 首批 VT-x 出货；AMD Pacifica 规范 2005-05 公布，2006-05-23 首颗 AMD-V 硅片出货；KVM 2006-10 发布、2007-02-05 并入 Linux 2.6.20。
- Source：Taskade《History of Virtualization》（引 Intel 新闻稿与 Wikipedia）
- URL：https://www.taskade.com/blog/virtualization-history
- Date：2026-05
- Excerpt："Intel announced its virtualization initiative, codenamed Vanderpool, on January 20, 2005 and shipped the first VT-x parts on November 14, 2005. AMD followed: the 'Pacifica' specification published in May 2005, the first AMD-V silicon shipped May 23, 2006."
- Confidence：高

**证据 E5.3**
- Claim：Q35 芯片组 2007-06 发布，支持 VT-d；AMD 7 系列芯片组 2007-11-19 随 Phenom 发布。
- Source：百度百科 Q35；维基百科 AMD 700 晶片組系列
- URL：https://baike.baidu.com/item/Q35/5270674 ; https://zh.wikipedia.org/zh-cn/AMD_700%E6%99%B6%E7%89%87%E7%B5%84%E7%B3%BB%E5%88%97
- Date：2026-08（词条快照）
- Excerpt："英特尔 Q35 高速芯片组于 2007 年 6 月正式发布……支持……虚拟化技术（VT-d）" / "它在 2007 年 11 月 19 日推出，与 AMD Phenom 处理器……一同推出"
- Context：AMD IOMMU 首颗硅片（790FX/RD790）随该平台上市，此具体对应关系为推断。
- Confidence：中

---

## 6. 机密计算：SEV → SEV-ES → SEV-SNP vs SGX → TDX

### 6.1 两条路线的信任模型

- **Intel SGX（2015，Skylake）**：进程级 enclave，TCB 最小（仅 CPU + enclave 代码），但 EPC 容量有限（MB 级）、I/O 必须穿越不可信边界、需改写应用；EPC 压力下换页导致数量级性能退化[^19^][^17^]。
- **AMD SEV（2016/2017，EPYC Naples）**：整 VM 级，每 VM 独立 ASID 与内存加密密钥（PSP 派生，hypervisor 不可得）；内存控制器内联 AES 加密，开销低；但 host 仍控制 NPT，存在 replay/alias 攻击面[^19^][^20^]。
- **SEV-ES（2017 公布）**：加密 vCPU 寄存器状态，VM-exit 时 host 看不到 guest 通用寄存器；部分 exit 需 GHCB 明文协商[^19^]。
- **SEV-SNP（2019 公布，Milan 2021 落地）**：引入 RMP（Reverse Map Table）提供内存完整性，防恶意 hypervisor 的数据重放、内存重映射攻击[^20^][^21^]。
- **Intel TDX（2021 公布，Sapphire Rapids 2023-01 落地）**：VM 级 Trust Domain，SEAM 模式 + TDX module 作为受信中继，MKTME 内存加密 + 完整性，guest 跑标准 OS 无需 enclave 化改写[^17^][^18^][^22^]。

**证据 E6.1（TEE 编年，学术综述）**
- Claim：SGX 2015（x86，App-based）；SEV 2016（x86，VM-based）；TDX 2021（x86，VM-based）；同期 ARM CCA 2021、IBM SE 2020、RISC-V CoVE 2022 等。
- Source：arXiv 2512.22090《Abstraction of TEEs…Systematization of Knowledge》
- URL：https://arxiv.org/html/2512.22090v1
- Date：2025-04
- Excerpt："Intel Software Guard Extensions (Intel, 2015) SGX 2015 x86 App-based Industry / AMD Secure Encrypted Virtualization SEV 2016 x86 VM-based Industry / Intel Trust Domain Extensions (Intel, 2021) TDX 2021 x86 VM-based Industry"
- Confidence：高

**证据 E6.2（SGX vs SEV 粒度/性能双侧对照）**
- Claim：SGX 进程级、EPC 小（MB）、开发者需分割代码、开销高；SEV 整 VM、内存 GB/TB 级、无需改代码、标准负载开销约 3%（SNP 略高）；完整性保护 SGX 原生支持、SEV 仅 SNP 支持；寄存器保护仅 SEV-ES/SNP。
- Source：VPSBG《Intel SGX vs AMD SEV – The Ultimate Comparison》（含自测 AES-GCM/pgbench/wrk 数据）
- URL：https://www.vpsbg.eu/blog/intel-sgx-vs-amd-sev-the-ultimate-comparison
- Date：2026-01
- Excerpt："SEV's virtual machine-centric design means that it can offer near-native performance… maximum of 3% overhead for standard workloads… SGX's enclave-focused design… once the cache limit is reached, SGX automatically switches to regular RAM, which results in a very drastic performance deterioration."
- Confidence：中高（厂商托管商有立场，但与学术结论一致）

**证据 E6.3（SEV-SNP vs TDX 学术实测，SIGMETRICS'25）**
- Claim：SEV-SNP 的 VMEXIT 延迟比普通 VM 长约 240%，TDX 长约 472%（TDX module 介入）；NPB/iperf TCP 上 TDX 相对开销更高（部分因 Intel 基线 VM 更快）；两者 attestation 原语耗时均为毫秒级（SNP 报告 6.19ms vs TDX quote 2.75ms）。
- Source：TUM《An Empirical Analysis of AMD SEV-SNP and Intel TDX》（SIGMETRICS 2025）
- URL：https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf
- Date：2024-11
- Excerpt："Intel TDX's average VMEXIT latency is 472% longer than a regular VM, while AMD SEV-SNP's VMEXIT latency is 240% longer… This may be due to the intervention of the TDX module."
- Confidence：高

**证据 E6.4**
- Claim：SEV（Zen1 EPYC）引入每 VM 独立 ASID+密钥，hypervisor 读物理内存得密文，但 host 控制 NPT 可实施 replay/alias 攻击；SEV-ES 加密 vCPU 寄存器，部分退出路径需 GHCB 明文协商；TDX 相对 SGX 无需 enclave 化改写、内存规模不受 EPC 限制；云厂商 CVM 产品多基于 SEV-SNP 或 TDX。
- Source：掘金《机密计算：SGX、SEV-SNP、TDX 与 ARM CCA》
- URL：https://juejin.cn/post/7672999931841675306
- Date：2026-08
- Excerpt："AMD 在 EPYC（Zen 1）引入 SEV：每个 VM 有独立 ASID 与内存加密密钥，Hypervisor 读物理内存得到密文。Host 仍控制页表（NPT），理论上可实施 replay 或 alias 攻击。"
- Confidence：高

**证据 E6.5**
- Claim：Sapphire Rapids Xeon SP 于 2023-01 正式发布（TDX 随该代落地）；Genoa EPYC 9004 于 2022-11 发布。
- Source：The Next Platform
- URL：https://www.nextplatform.com/compute/2023/06/12/intel-pits-its-sapphire-rapids-xeon-sp-against-amd-genoa-epycs/1657257
- Date：2023-06
- Excerpt："the Sapphire Rapids Xeon SPs finally were launched in January 2023… AMD launched the 'Genoa' Epyc 9004 processors back in November 2022."
- Confidence：高

**评述（信任模型差异）**：SGX 与 SEV 代表"最小 TCB（进程）"与"最大便利（整 VM）"两极；SNP 与 TDX 在 VM 级汇合，但架构路径不同：SNP 靠 PSP + RMP 把完整性交给片上安全处理器与硬件页级校验，TDX 靠 SEAM + 受信 TDX module（一段运行在专用模式的受签名固件）隔离 hypervisor；证明体系上 SNP 走 PSP 签发报告 + AMD KDS 证书链，TDX 走 QE/quote + Intel PCS 证书链。双侧均有远程证明，但信任根分别锚定 AMD PSP 与 Intel QE。

---

## 7. ARM 与 RISC-V 虚拟化：与 x86 双雄的思路异同

### 7.1 ARM：EL2 + VHE + Stage-2 MMU + GIC 虚拟化

ARMv8 用**异常级别**而非新模式表达虚拟化：hypervisor 运行于 EL2，guest 内核/用户态仍在 EL1/EL0；内存虚拟化为 Stage-2 翻译（VTTBR_EL2 为根），TLB 隔离用 VMID（对应 x86 的 VPID/ASID）；中断虚拟化依赖 GICv3/v4 的虚拟化扩展；ARMv8.1 引入 **VHE**（Virtualization Host Extensions），让 host OS（如 Linux/KVM）整体搬入 EL2，减少 host 内核在 EL2/EL1 间的切换开销[^23^][^2^]。

**证据 E7.1（ARM vs x86 双侧对照）**
- Claim：ARM 侧对应关系——内存虚拟化 Stage-2 MMU（对应 EPT/NPT）、CPU 虚拟化 EL2 异常级（对应 VMX/SVM 模式）、中断虚拟化 GICv4（对应 APICv）、I/O 虚拟化 x86 的 SR-IOV 更成熟。
- Source：腾讯云/CSDN《ARM 架构下的虚拟化技术：与 x86 架构的差异》
- URL：https://tencentcloud.csdn.net/69ea4fa854b52172bc6dca5e.html
- Date：2025-10
- Excerpt："内存虚拟化：二级页表转换 (S2 MMU) vs 扩展页表 (EPT/NPT)；CPU 虚拟化：EL2 异常级别 vs VMX/SVM 模式；中断虚拟化：GICv4 虚拟化扩展 vs APICv 硬件加速。"
- Confidence：高

**证据 E7.2**
- Claim：ARM Stage2 MMU 4 级翻译（Level0→Level3），根寄存器 VTTBR_EL2，TLB 隔离 VMID（16 位），Stage2 Fault 陷入 EL2，大页支持 4KB/2MB/1GB/512GB。
- Source：51CTO《深入解析 Intel EPT、AMD NPT 与 ARM Stage2 MMU》
- URL：https://blog.51cto.com/u_16213609/14585818
- Date：2026-05
- Excerpt："ARM Stage2 MMU：根寄存器 VTTBR_EL2（EL2）；TLB 隔离 VMID（16 位）；缺页异常 Stage2 Fault（EL2）；大页支持 4KB/2MB/1GB/512GB。"
- Confidence：高

**思路异同评述**：ARM 没有一个"VMCS/VMCB"式的专用控制块——vCPU 上下文就是 EL2 系统寄存器 + hypervisor 软件结构，世界切换由异常模型天然提供，硬件更"薄"、软件更灵活（与 x86 硬件自动保存/恢复大块状态形成对照）[^23^][^24^]。RISC-V H 扩展明显借鉴了 ARM 思路：在 M 与 S 之间插入 HS-mode（hypervisor-extended supervisor），guest 跑 VS/VU-mode，G-stage 两级翻译（GPA→HPA），配 hgatp/hstatus/hedeleg/hideleg 等 CSR 与 HLV/HSV/HFENCE 指令[^25^][^26^]。

### 7.2 RISC-V：H 扩展

**证据 E7.3（官方规范）**
- Claim：RISC-V hypervisor 扩展（H extension, v1.0）把 S-mode 变为 HS-mode 承载 hypervisor 或可托管 OS，新增 guest 物理地址→宿主机物理地址的第二级翻译；普通 S-mode OS 可不加修改地在 HS-mode 或作为 VS-mode guest 运行；HS-mode 通过同一 SBI 与机器交互。
- Source：riscv.org 官方特权架构规范（"H" Extension, v1.0）
- URL：https://docs.riscv.org/reference/isa/v20260120/priv/hypervisor.html
- Date：规范快照 2026-01
- Excerpt："The hypervisor extension changes supervisor mode into hypervisor-extended supervisor mode (HS-mode)… The hypervisor extension also adds another stage of address translation, from guest physical addresses to supervisor physical addresses… Regular S-mode operating systems can execute without modification either in HS-mode or as VS-mode guests."
- Confidence：高

**证据 E7.4**
- Claim：RVH 于 2021 年底与 RVV 1.0 同时正式批准；定义 H-mode，关键特性为两级地址翻译、虚拟中断注入、hypervisor 透明管理；Linux 内核 RISC-V KVM 已合入主线，但成熟度差距在嵌套虚拟化、IOMMU 虚拟化（对应 VT-d）与大规模 guest 稳定性。
- Source：掘金《RISC-V 服务器与数据中心》
- URL：https://juejin.cn/post/7675538244907958281
- Date：2026-08
- Excerpt："RVH 在 2021 年底与 RVV 1.0 同时正式批准……目前 Linux 内核的 RISC-V KVM 支持已经合入主线，但成熟度还在提升中。主要差距在：嵌套虚拟化（nested virtualization）支持、IOMMU 虚拟化（对应 x86 的 VT-d）、以及大规模 guest OS 的稳定性验证。"
- Confidence：高

**证据 E7.5**
- Claim：软件学报论文确认 H-extension 引入 VS/VU 模式、S-mode 更名 HS-mode、支持类似 x86 EPT 的嵌套页表模型。
- Source：《软件学报》（jos.org.cn）
- URL：https://www.jos.org.cn/jos/home?file_no=4837&flag=1
- Date：2025-09
- Excerpt："虚拟化扩展引入了虚拟监督模式（VS mode）和虚拟用户模式（VU mode）……虚拟化扩展还支持嵌套页表模型，类似于 x86 的 EPT 机制。"
- Confidence：高

### 7.3 云时代 ARM 服务器对 Intel 虚拟化地位的影响

**证据 E7.6**
- Claim：Omdia：Arm 处理器服务器占整体服务器市场 5.3%（4Q21）、7.1%（2Q22）。
- Source：Omdia Data Center Server Market Analysis 1H22/2H22
- URL：https://omdia.tech.informa.com/om025410/data-center-server-market-analysis--2h22 ; https://omdia.tech.informa.com/om022328/data-center-server-market-analysis--1h22
- Date：2022-03 / 2022-10
- Excerpt："Servers with Arm processors hit a 7.1% share of the overall server market in 2Q22."
- Confidence：高

**证据 E7.7**
- Claim：Counterpoint：2022 年按营收仅 AWS 与 Ampere 两家 Arm 服务器 CPU 占 4.68%；Bernstein：2023 年近 10% 服务器采用 Arm CPU，其中半数由 AWS 部署，AWS 云中已有超 200 万颗自研 Graviton 芯片；Arm 基础设施 SVP Mohamed Awad 称 2024 年 Arm 服务器 CPU 份额达 15%。
- Source：腾讯云/芯智讯（汇编 Counterpoint、Gartner、Bernstein、Arm 高管采访）
- URL：https://cloud.tencent.com/developer/article/2641873 ; https://www.icsmart.cn/90390/
- Date：2026-03 / 2025-04
- Excerpt："2023 年，全球近 10% 的服务器采用了 Arm 服务器 CPU，其中半数由 AWS 部署，其云端中已有超过 200 万个自研的 Graviton 芯片……Arm 在 2024 年全球服务器 CPU 市场的份额已经提升到了 15%（Mohamed Awad 口径）。"
- Context：15% 为 Arm 官方口径，高于第三方机构（Gartner 2023Q1 出货量占比 7%），引用时需注明来源属性。
- Confidence：中高

**证据 E7.8**
- Claim：阿里倚天 710（Arm 服务器芯片）已实现数百万核规模化应用、服务超 1000 个客户，覆盖数据库、大数据、视频处理；倚天 710 通过 Arm 架构降低单位算力成本约 30%。
- Source：搜狐《阿里自研倚天 710：数百万核时代的服务器芯片革新》；vzkoo 阿里巴巴研究报告
- URL：https://www.sohu.com/a/828153210_121798711 ; https://www.vzkoo.com/read/202503074b87e0ddb16a73e10878e28e.html
- Date：2024-11 / 2025-03
- Excerpt："成功实现数百万核的规模化应用，并服务于超过 1000 个客户" / "倚天 710 通过 ARM 架构降低单位算力成本 30%。"
- Confidence：中高（含厂商口径）

**格局评述**：ARM 服务器（Graviton、倚天、Ampere、鲲鹏）在超大规模云内部持续侵蚀 x86 的存量；但云厂商 ARM 实例同样依赖 KVM + EL2/VHE 的虚拟化栈，且云厂商普遍以"自研芯片 + 自研虚拟化（神龙/Nitro）"打包，竞争焦点从"谁的虚拟化指令集更强"转向"软硬一体 TCO"。对 Intel 的实质冲击是份额与定价权，而非虚拟化技术本身被替代——x86 虚拟化生态（VMware/KVM/virtio/VFIO）成熟度仍是护城河，ARM 侧 SR-IOV/IOMMU 生态成熟度仍逊（见 E7.1）。

---

## 8. 市场视角：AMD EPYC 份额上升（Mercury Research）

**证据 E8.1**
- Claim：Mercury Research：2024Q4 AMD 服务器 CPU 出货量份额 25.1%（首次超四分之一，同比 +2.0pt），收入份额 35.5%（同比 +3.7pt）；AMD 整体 x86 出货份额 24.7%。
- Source：199IT/新浪科技（转 Mercury Research 2024Q4 报告）；Tom's Hardware 汇编表
- URL：https://www.199it.com/archives/1741364.html ; https://finance.yahoo.com/news/amd-gained-consumer-desktop-laptop-131007914.html
- Date：2025-02
- Excerpt："AMD EPYC 的出货量份额来到 25.1%，首次超过四分之一……而收入份额更是高达 35.5%。"
- Confidence：高

**证据 E8.2**
- Claim：Mercury Research：2024Q3 AMD 服务器份额 24.2%（出货）/33.9%（收入）；当季 AMD 数据中心收入（$3.549B）首次超过 Intel 数据中心与 AI 部门（$3.3B）。
- Source：DIGITIMES（汇编 Mercury Research/Reuters/EE Times）
- URL：https://www.digitimes.com/news/a20241114VL201/amd-revenue-2024-market-intel.html
- Date：2024-11
- Excerpt："AMD achieved a record 33.9% revenue share in server-related chips in the third quarter of 2024… For the first time, AMD's data center revenue surpassed Intel's data center and AI division, reaching US$3.549 billion, just ahead of Intel's US$3.3 billion."
- Confidence：高

**证据 E8.3**
- Claim：Mercury Research：2025Q4 AMD 服务器 CPU 份额 28.8%（再创新高，同比 +3.1pt）；第五代 EPYC "Turin" 首次占 AMD 服务器收入 50%+；Intel 服务器出货接近两倍季节均值仍被 AMD 超越（受供应限制）。
- Source：CRN（引 Mercury Research 总裁 Dean McCarron）
- URL：https://www.crn.com/news/components-peripherals/2026/intel-s-supply-issues-helped-amd-grab-record-high-cpu-market-share-researcher
- Date：2026-02
- Excerpt："AMD's server CPU share grew 1.1 points sequentially and 3.1 points year over year to 28.8 percent against Intel's 71.2 percent, according to Mercury. This marked another record high for AMD."
- Confidence：高

**证据 E8.4**
- Claim：历史序列：AMD 服务器份额从 2018Q1 的约 1.4% 升至 2025Q2 的 27.3%（Mercury Research 季度表）。
- Source：thefilibusterblog / wccftech（完整 Mercury 历史表）
- URL：https://thefilibusterblog.com/amd-achieves-record-355-server-revenue-share-in-q4-2024-desktop-and-mobile-revenue-growth-compared-to-last-year/ ; https://wccftech.com/amd-record-server-revenue-share-q4-2024-desktop-mobile-also-up-from-last-year/
- Date：2025-02
- Excerpt：表格：AMD Server CPU Market Share：Q1 2018 1.4% → Q4 2021 10.7% → Q4 2024 25.1% → Q2 2025 27.3%。
- Confidence：中高（二手汇编，数字与多源一致）

**影响评述**：EPYC 份额七年间从 ~1.4% 到 ~28.8%，意味着虚拟化技术竞争的"默认答案"不再是 Intel——云厂商需同时优化 kvm_amd/kvm_intel，SEV-SNP 成为机密 VM 事实上的先发者（云 CVM 先发产品多为 AMD），而 Intel 以 TDX 追赶。收入份额（35.5%）显著高于出货份额（25.1%）说明 AMD 在高端虚拟化/云实例中的溢价能力增强。

---

## 9. 软件兼容：KVM/QEMU/libvirt 抽象与跨厂商迁移

### 9.1 KVM 的双模块 + 函数指针抽象

**证据 E9.1**
- Claim：KVM x86 由通用层 + 厂商模块组成：硬件检测后把 vmx_x86_ops 或 svm_x86_ops 赋给全局 kvm_x86_ops；该巨型操作表以函数指针实现"手工 C 运行时多态"，Intel 表设 .vm_size = sizeof(struct kvm_vmx)，container_of 模式贯穿。
- Source：DeepWiki（microsoft/WSL2-Linux-Kernel KVM x86 实现，基于内核源码）；ayoub-faouzi《KVM Internals》
- URL：https://deepwiki.com/microsoft/WSL2-Linux-Kernel/2.1-kvm-x86-implementation ; https://ayoub-faouzi.com/posts/virtualization-internals-part-5-kvm-internals-from-vm-creation-to-guest-execution/
- Date：2025-04 / 2026-07
- Excerpt："Hardware Detection: KVM detects whether the CPU supports Intel VT-x or AMD SVM. Operation Table Setup: The correct implementation (vmx_x86_ops or svm_x86_ops) is assigned to kvm_x86_ops." / "This large operation table is the central connection between common KVM code and Intel VMX code… essentially runtime polymorphism implemented manually in C using function pointers."
- Confidence：高

**证据 E9.2**
- Claim：kvm_x86_ops 内同一钩子两侧实现各异，例：tlb_flush_guest——VMX 走 INVVPID(SINGLE_CONTEXT)/vpid_sync_context，SVM 走当前 ASID 的 flush/INVLPGA；两模块并存但同一时刻仅加载一个（"already loaded vendor module" 检查）。
- Source：LKML 补丁（Sean Christopherson, 2020-03；2022-11 CPU 兼容性检查重构）
- URL：https://lkml.org/lkml/2020/3/17/37 ; https://lists.infradead.org/pipermail/kvm-riscv/2022-November/002134.html
- Date：2020-03 / 2022-11
- Excerpt："static struct kvm_x86_ops svm_x86_ops __ro_after_init = { .tlb_flush_guest = svm_flush_tlb_guest…}" / "static struct kvm_x86_ops vmx_x86_ops __ro_after_init = { .tlb_flush_guest = vmx_flush_tlb_guest…}" / "pr_err(\"kvm: already loaded vendor module '%s'\", kvm_x86_ops.name)"
- Confidence：高

### 9.2 libvirt CPU 模型与迁移约束

**证据 E9.3**
- Claim：libvirt/OpenStack 三种 CPU 模式：host-passthrough（全部指令集透传，性能 100%，热迁移要求源/目的 CPU 一致）、host-model（匹配最接近型号，95.84%，允许一定差异）、custom（指令集最少 94.73%，跨型号迁移能力最强）；实测 E5→Gold 可迁、反向不可（新指令集不被旧 CPU 识别）。
- Source：51CTO 博客（OpenStack nova cpu_mode 实战，HEPSpec06 数据）；百度开发者中心
- URL：https://blog.51cto.com/u_14405/11577670 ; https://developer.baidu.com/article/detail.html?id=3495771
- Date：2024-07 / 2025-04
- Excerpt："host-passthrough：……但是在热迁移时，它要求目的节点的 CPU 和源节点的一致。host-model：……允许目的节点 CPU 和源节点的存在一定的差异。custom：……跨不同型号 CPU 的能力最强。"
- Confidence：高（性能数字为单一来源实测，标中）

### 9.3 跨厂商热迁移不可行性与原因

**证据 E9.4（官方文档）**
- Claim：VMware EVC（Enhanced vMotion Compatibility）基于 Intel FlexMigration 或 AMD-V Extended Migration 的 CPUID 掩码能力统一集群内 CPU 功能集，但 **EVC 不允许在 Intel 与 AMD 处理器之间 vMotion**；EVC 只有"禁用/Intel/AMD"三个选项。
- Source：Dell 官方支持文档（VxRail EVC）；51CTO《图解部署 VMware DRS》
- URL：https://www.dell.com/support/kbdoc/zh-cn/000019491/ ; https://www.51cto.com/article/153043.html
- Date：2026-06 / 长期存档
- Excerpt："EVC 不允许在英特尔和 AMD 处理器之间使用 vMotion 进行迁移。" / "即便使用 EVC，也不能将 Intel 服务器上的虚机迁移到 AMD 主机上。所以 EVC 只有三个选项：禁用、Intel 或者 AMD。"
- Confidence：高

**证据 E9.5**
- Claim：跨厂商不可行的根本原因：Intel 与 AMD 的 CPUID 指令集架构存在根本性差异（微架构、MSR、指令集扩展如 AVX-512/CLZERO 互不覆盖），CPUID 掩码只能"向下屏蔽"到共同子集，而两厂之间不存在可工作的共同基线；2005/2006 年两家各搞各的虚拟化扩展进一步固化了分裂。
- Source：好主机测评网（EVC 问答，机制描述与 VMware KB 一致）；极术社区《独霸市场数十年，X86 处理器究竟难在哪里》
- URL：https://www.hzjcp.com/216723.html ; https://aijishu.com/a/1060000000141179
- Date：2026-08 / 2020-10
- Excerpt："EVC 技术要求集群内的所有物理主机必须来自同一 CPU 厂商……这是因为 Intel 和 AMD 的底层 CPUID 指令集架构存在根本性差异，EVC 无法通过掩码机制将它们统一到一个公共基准上。" / "2005 年英特尔 VT-x（Vanderpool）和 2006 年 AMD AMD-V（Pacifica），双方根本就是各搞各的，老死不相往来，让 VMware vMotion 此类不停机的虚拟机动态迁移技术，迟迟跨越不了不同 x86 处理器厂商的边界。"
- Confidence：高（机制层面）；"根本差异"的措辞属媒体归纳

**补充机制分析（推断，置信高）**：除 CPUID 功能集外，跨厂商热迁移还受制于——(a) guest 可见的厂商专属 MSR 与指令语义差异；(b) 虚拟化层保存/恢复的状态格式差异（KVM/ESXi 内部 vCPU 状态机按厂商建模）；(c) TSC 频率/不变性、PMU 事件、微架构侧信道缓解位等隐性状态。冷迁移（关机）则不受 CPU 兼容性检查约束[^27^]。

---

## 10. 维度总结

1. **同源异构**：VT-x 与 AMD-V 是 2005-2006 年几乎同期的独立实现，模式模型同构（root/non-root ↔ host/guest），但指令、数据结构、状态机互不兼容，hypervisor 必须双实现（KVM 的 kvm_intel/kvm_amd + kvm_x86_ops 函数指针多态）。
2. **设计哲学**：Intel VMCS 布局未定义、VMREAD/VMWRITE 显式字段读写、host 状态内嵌 VMCS；AMD VMCB 布局公开、普通内存访问、host 状态外置（VM_HSAVE_PA）、VMRUN 整块世界切换。抽象灵活性 vs 直白批量性，各有代价。
3. **内存虚拟化**：AMD 先发 SLAT（Barcelona NPT/RVI 2007-09，领先 Nehalem EPT 约 14 个月）；TLB 隔离 ASID↔VPID 功能等价；大页均支持 2MB/1GB。
4. **中断虚拟化是最大非对称短板**：Intel APICv 2013 年落地并默认启用；AMD AVIC 2012 发表、2016 落地，却受 erratum #1235、固件关断、IOMMU 侧不支持三重拖累，KVM 长期默认关闭，2025 年才推进 Zen4 默认开启。
5. **IOMMU**：VT-d 与 AMD-Vi 功能对等；著名的中断重映射 erratum 其实在 Intel 侧（5520/5500 erratum #53，2013 内核 quirk），AMD 侧痛点是早期 IOMMU 无中断重映射能力及 AVIC 依赖链。
6. **机密计算路线分野**：Intel 先走 SGX 进程级（2015）后转 VM 级 TDX（2021 公布/2023 落地）；AMD 直接走 VM 级 SEV（2017）→SEV-ES→SEV-SNP（2021 落地），SNP 的 RMP 完整性与 TDX module 信任模型路径不同，远程证明分别锚定 AMD PSP 与 Intel QE；SIGMETRICS'25 实测 TDX VMEXIT 延迟放大（472%）高于 SNP（240%）。
7. **ARM/RISC-V 思路**：ARM EL2+VHE+Stage2+GIC 无 VMCS 式控制块，靠异常模型+系统寄存器，硬件更薄；RISC-V H 扩展（2021 底批准）明确借鉴 ARM（HS/VS/VU + G-stage），KVM 已入主线但缺嵌套虚拟化与成熟 IOMMU。
8. **市场**：Mercury Research 显示 AMD 服务器份额 2018Q1 ~1.4% → 2024Q4 25.1%（出货）/35.5%（收入）→ 2025Q4 28.8%；2024Q3 AMD 数据中心收入首超 Intel DCAI。Arm 服务器 2022 年约 7%（Omdia），AWS 部署超 200 万颗 Graviton，Arm 官方口径 2024 年达 15%。虚拟化竞争从双雄指令集演进转为"x86 双雄 + ARM 云自研"三线格局。
9. **软件兼容**：KVM/QEMU 经 kvm_x86_ops 与 CPU 模型抽象统一两厂；libvirt host-passthrough/host-model/custom 在性能与可迁移性间取舍；VMware EVC 明确不能跨 Intel/AMD vMotion，根因是 CPUID/MSR/状态格式无共同基线——2005-06 年的"各搞各的"影响至今。

---

## 参考链接

[^1^]: NecoFuzz, arXiv 2512.08858 — https://arxiv.org/html/2512.08858
[^2^]: 深入解析 Intel EPT、AMD NPT 与 ARM Stage2 MMU — https://blog.51cto.com/u_16213609/14585818
[^3^]: Martins3: KVM TLB flush / VPID vs ASID — https://github.com/Martins3/Martins3.github.io/blob/master/docs/kvm/mmu/tlb-flush-draft.md
[^4^]: Cool3C《硬科技：x86 虛擬化由內到外還是繼續難搞（下）》 — https://www.cool3c.com/article/152681
[^5^]: 中断虚拟化之 APIC 虚拟化（posted interrupt） — https://blog.csdn.net/weixin_46324627/article/details/136461495
[^6^]: Patchew/LKML: KVM: SVM: Enable AVIC by default from Zen 4 — https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/
[^7^]: How to Enable IOMMU (VT-d / AMD-Vi) — https://vormox.com/blog/how-to-enable-iommu-vt-d-amd-vi-in-your-bios-and-proxmox-ve-for-pci-passthrough
[^8^]: 掘金: VT-d Interrupt Remapping 技术原理 — https://juejin.cn/post/7351662722935963663
[^9^]: hvisor 手册：X86_64 处理器虚拟化 — https://hvisor.syswonder.org/chap04/subchap01/X86_64Virtualization.html
[^10^]: Hypervisor-101-in-Rust: Settings up the VMCS/VMCB — https://tandasat.github.io/Hypervisor-101-in-Rust/hypervisor-setup-and-operation-cycle/e2-settings-up-the-vmcsvmcb.html
[^11^]: pagetable.com: Intel VT VMCS Layout — https://www.pagetable.com/?p=348
[^12^]: DeepWiki: KVM x86 Implementation — https://deepwiki.com/microsoft/WSL2-Linux-Kernel/2.1-kvm-x86-implementation
[^13^]: awesome-virtualization Chronology — https://github.com/Wenzel/awesome-virtualization/blob/master/README.md
[^14^]: Taskade: History of Virtualization — https://www.taskade.com/blog/virtualization-history
[^15^]: 百度百科 Q35 — https://baike.baidu.com/item/Q35/5270674
[^16^]: 维基百科 AMD 700 晶片組系列 — https://zh.wikipedia.org/zh-cn/AMD_700%E6%99%B6%E7%89%87%E7%B5%84%E7%B3%BB%E5%88%97
[^17^]: arXiv 2512.22090: Abstraction of TEEs SoK — https://arxiv.org/html/2512.22090v1
[^18^]: The Next Platform: Sapphire Rapids vs Genoa — https://www.nextplatform.com/compute/2023/06/12/intel-pits-its-sapphire-rapids-xeon-sp-against-amd-genoa-epycs/1657257
[^19^]: 掘金：机密计算 SGX、SEV-SNP、TDX 与 ARM CCA — https://juejin.cn/post/7672999931841675306
[^20^]: ServerMall: AMD SEV-SNP vs Intel TDX — https://servermall.com/blog/amd-sev-and-intel-tdx-who-needs-it/
[^21^]: VPSBG: Intel SGX vs AMD SEV — https://www.vpsbg.eu/blog/intel-sgx-vs-amd-sev-the-ultimate-comparison
[^22^]: TUM SIGMETRICS'25: Empirical Analysis of AMD SEV-SNP and Intel TDX — https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf
[^23^]: 腾讯云/CSDN: ARM 架构下的虚拟化技术 — https://tencentcloud.csdn.net/69ea4fa854b52172bc6dca5e.html
[^24^]: Termbasehub: VMCS vs VMCB vs ARM64 EL2 — https://termbasehub.com/vmcs/
[^25^]: riscv.org 官方规范: H Extension v1.0 — https://docs.riscv.org/reference/isa/v20260120/priv/hypervisor.html
[^26^]: 掘金：RISC-V 服务器与数据中心 — https://juejin.cn/post/7675538244907958281
[^27^]: ChinaUnix: vSphere VMotion 条件（关机迁移不检查 CPU） — http://blog.chinaunix.net/uid-15866552-id-3046543.html
[^28^]: 软件学报：RISC-V 内存虚拟化 — https://www.jos.org.cn/jos/home?file_no=4837&flag=1
[^29^]: Omdia Data Center Server Market Analysis 2H22 — https://omdia.tech.informa.com/om025410/data-center-server-market-analysis--2h22
[^30^]: 腾讯云：Arm 数据中心份额（Counterpoint/Bernstein/Gartner 汇编） — https://cloud.tencent.com/developer/article/2641873
[^31^]: 搜狐：阿里倚天 710 — https://www.sohu.com/a/828153210_121798711
[^32^]: 199IT：Mercury Research 2024Q4 — https://www.199it.com/archives/1741364.html
[^33^]: DIGITIMES：AMD 2024Q3 服务器份额 — https://www.digitimes.com/news/a20241114VL201/amd-revenue-2024-market-intel.html
[^34^]: CRN：Mercury Research 2025Q4（AMD 服务器 28.8%） — https://www.crn.com/news/components-peripherals/2026/intel-s-supply-issues-helped-amd-grab-record-high-cpu-market-share-researcher
[^35^]: 51CTO：OpenStack nova cpu_mode 三模式 — https://blog.51cto.com/u_14405/11577670
[^36^]: Dell 支持文档：什么是 EVC — https://www.dell.com/support/kbdoc/zh-cn/000019491/
[^37^]: LKML/snapcraft：5520/5500 中断重映射 erratum #53 quirk — https://lists.snapcraft.io/archives/kernel-team/2013-July/029959.html
[^38^]: 阿里云 AVD：CVE-2026-64172（AVIC erratum #1235 / Hygon 18h） — https://avd.aliyun.com/detail?id=AVD-2026-64172
[^39^]: AMD Instinct 官方文档：IOMMU — https://instinct.docs.amd.com/projects/amdgpu-docs/en/latest/conceptual/iommu.html
[^40^]: 51CTO：AMD SVM/VMCB 机制 — https://blog.51cto.com/u_16099221/9904946
[^41^]: 0xaa55 论坛：AMD64 分页缓存体系（ASID vs VPID） — https://www.0xaa55.com/thread-25636-1-1.html
[^42^]: LKML 2020-03：tlb_flush_guest 拆分（VMX INVVPID / SVM ASID） — https://lkml.org/lkml/2020/3/17/37
[^43^]: ayoub-faouzi: KVM Internals — https://ayoub-faouzi.com/posts/virtualization-internals-part-5-kvm-internals-from-vm-creation-to-guest-execution/
[^44^]: 好主机测评网：EVC 跨厂商问答 — https://www.hzjcp.com/216723.html
[^45^]: 极术社区：X86 处理器究竟难在哪里（VT-x/AMD-V 分裂） — https://aijishu.com/a/1060000000141179
