# 维度09：软件生态 —— 主流 Hypervisor 如何使用 Intel VT

> 研究范围：KVM / Xen / VMware / Hyper-V / 轻量级 VMM / 桌面与开发者场景 / Hyper-V 独占冲突与 WHPX 和解。
> 方法：中文为主、官方文档与内核源码优先，共执行 40 组独立搜索（约 30 组有效），关键事实均附原文摘录。

---

## 一、KVM：以 VT-x 为唯一执行路径的内核 Hypervisor

### 1.1 kvm_intel 模块与 VMX 生命周期

**Claim**：KVM 由两个内核模块构成——`kvm.ko`（架构无关核心）与 `kvm_intel.ko`（Intel VMX 支持），后者在加载时打开 CR4.VMXE、执行 `VMXON` 将 Host 置入 VMX root 模式，并创建字符设备 `/dev/kvm` 等待用户空间命令；KVM 本身只做 CPU 与内存虚拟化，要求 CPU 必须具备 VT-x/SVM。
- **Source**：测速网技术文档（转载 KVM 架构解析）；华为云社区
- **URL**：https://52ce.com/news/40.html ；https://bbs.huaweicloud.com/blogs/458280
- **Excerpt**：「KVM 仅支持基于硬件辅助的虚拟化（如 Intel-VT 与 AMD-V），在内核加载时，KVM 先初始化内部数据结构，打开 CPU 控制寄存器 CR4 里面的虚拟化模式开关，执行 VMXON 指令将 Host OS 设置为 root 模式，并创建的特殊设备文件 /dev/kvm 等待来自用户空间的命令」；「它包括两个内核模块：kvm.ko 和 kvm_intel.ko（或 kvm_amd.ko），本质上，KVM 是管理虚拟硬件设备的驱动，该驱动使用字符设备 /dev/kvm 作为管理接口，主要负责 vCPU 的创建、虚拟内存分配、vCPU 寄存器读写以及 vCPU 的运行」
- **Context**：KVM 2006-10 由 Qumranet（Avi Kivity）发布，2006-12 合入内核，2007-02 随 Linux 2.6.20 正式发布[^1^]。从 2005 年 Intel 发布 VT 到 2007 年 KVM 合入主线不足两年。
- **Confidence**：高

**Claim**：`vmx_hardware_setup()`（Intel 侧硬件初始化）决定 EPT、VPID、unrestricted guest、APIC 虚拟化、PML、嵌套 VMX 是否可用，并为每个物理 CPU 分配一个 VMXON 区域。
- **Source**：Virtualization Internals Part 5 - KVM Internals（ayoub-faouzi.com）
- **URL**：https://ayoub-faouzi.com/posts/virtualization-internals-part-5-kvm-internals-from-vm-creation-to-guest-execution/
- **Date**：2026-07-18
- **Excerpt**：「For Intel, hardware_setup() resolves to vmx_hardware_setup(). This decides whether features such as EPT, VPID, unrestricted guests, APIC virtualization, PML, and nested VMX can be used. It also configures KVM's MMU for EPT. Near the end, alloc_kvm_area() allocates one VMXON region for every possible CPU.」
- **Confidence**：高（与内核源码一致）

### 1.2 KVM API：/dev/kvm 与 ioctl 三级 fd 模型

**Claim**：KVM API 以文件描述符为中心：`open("/dev/kvm")` → `KVM_CREATE_VM` 得 VM fd → `KVM_CREATE_VCPU` 得 vCPU fd → vCPU fd 上 `KVM_RUN` 运行 guest；官方 API 明确「one virtual machine per process, and one vcpu per thread」。
- **Source**：docs.kernel.org《The Definitive KVM API Documentation》；kernel.org api.txt
- **URL**：https://docs.kernel.org/virt/kvm/api.html ；https://github.com/hiboma/hiboma/blob/master/kernel/kvm/KVM_CREATE_VM.md
- **Excerpt**：「An initial open("/dev/kvm") obtains a handle to the kvm subsystem… A KVM_CREATE_VM ioctl on this handle will create a VM file descriptor… A KVM_CREATE_VCPU ioctl on a VM fd will create a virtual cpu… ioctls on a vcpu fd can be used to control the vcpu, including the important task of actually running guest code.」「The only supported use is one virtual machine per process, and one vcpu per thread.」
- **Context**：`KVM_RUN` 无显式参数，隐式参数块通过 `mmap(vcpu fd)` 得到 `struct kvm_run`；`KVM_CREATE_IRQCHIP` 在内核中创建虚拟 IOAPIC/PIC/local APIC——并注明「This occurs when APIC access acceleration is enabled (APICv on Intel, AVIC on AMD), which is the default on supported hardware」。
- **Confidence**：高（官方文档）

### 1.3 vCPU 线程模型与 QEMU 分工

**Claim**：每台 KVM 虚拟机是宿主机上一个 QEMU 进程，每个 vCPU 是该进程内的一个普通线程，由 Linux CFS 统一调度；KVM 为 Linux 增加了第三种执行模式「Guest mode」，对应 VMX non-root。
- **Source**：0voice《KVM 学习笔记》；阿里云开发者社区《KVM之CPU虚拟化》
- **URL**：https://github.com/0voice/kernel_awsome_feature/blob/main/KVM%20%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0.md ；https://developer.aliyun.com/article/684133
- **Date**：2022-02-09 / 2018-12-25
- **Excerpt**：「在 KVM 环境中，每个客户机都是一个标准的 Linux 进程（QEMU 进程），而每一个 vCPU 在宿主机中是 QEMU 进程派生的一个普通线程。」三模式分工：「用户模式：主要处理 I/O 的模拟和管理，由 QEMU 的代码实现；内核模式：处理客户模式到内核模式的转换、I/O 指令或特权指令引起的 VM-Exit、影子内存管理；客户模式：执行 Guest 中的大部分指令。」「KVM 向 Linux 内核增加了第三种模式即客户机模式（Guest），该模式对应于 CPU 的 VMX non-root mode。」
- **Confidence**：高（多来源一致）

**Claim**：QEMU 通过 `/dev/kvm` ioctl 驱动整个 VM 生命周期：`KVM_CREATE_VM` → `KVM_CREATE_VCPU` → vCPU 线程循环 `KVM_RUN`，首次进入 guest 执行 `VMLAUNCH`、VM-Exit 后再进执行 `VMRESUME`；exit_reason 需用户态处理时返回 QEMU。
- **Source**：fsqHub/qemu-kvm 知识分享；xingguotian《Qemu-kvm CPU虚拟化》
- **URL**：https://github.com/fsqHub/qemu-kvm/blob/main/%E7%9F%A5%E8%AF%86%E5%88%86%E4%BA%AB.md ；https://xingguotian.github.io/2019/08/23/qemu-kvm%20CPU%E8%99%9A%E6%8B%9F%E5%8C%96/
- **Date**：2024-09-22 / 2019-08-23
- **Excerpt**：「QEMU 打开 KVM 模块设备文件（/dev/kvm）并发起 KVM_CREATE_VM ioctl……通过 vCPU 文件描述符发起 KVM_RUN ioctl，vcpu 线程进入 guest 模式执行虚拟机的非 I/O 代码」「执行 VMLAUNCH 初次进入 guest 中，或者执行 VMRESUME 在发生 VM_EXIT 之后再次进入 guest……发生 VM_Entry 时，CPU 则将 vCPU 对应的 VMCS 中的字段加载到物理 CPU 上执行」
- **Context**：分工原则——「让 KVM 处理处理器虚拟化和内存虚拟化，运行在内核态；让 QEMU 处理 I/O 虚拟化，运行在用户态」[^2^]。
- **Confidence**：高

### 1.4 KVM 对 EPT/VPID/APICv/Posted Interrupt 的启用条件

**Claim**：kvm_intel 模块参数 `ept`/`vpid`/`unrestricted_guest`/`nested` 等默认开启，但硬件不满足条件时由 KVM 自动关闭——内核源码逻辑：无 VPID/INVVPID → 关 vpid；无 EPT/4 级 EPT/WB 内存类型/全局 INVEPT → 关 ept；无 EPT A/D 位或未启用 EPT → 关 eptad；无 unrestricted guest 或未启用 EPT → 关 unrestricted_guest。
- **Source**：Linux 内核源码 arch/x86/kvm/vmx/vmx.c（freedesktop drm-intel cgit 镜像）；Debian Sources kernel-parameters.txt（linux 6.12）
- **URL**：https://cgit.freedesktop.org/drm-intel/tree/arch/x86/kvm/vmx/vmx.c ；https://sources.debian.org/src/linux/6.12.15-1/Documentation/admin-guide/kernel-parameters.txt/
- **Excerpt（源码）**：「if (!cpu_has_vmx_vpid() || !cpu_has_vmx_invvpid() || !(cpu_has_vmx_invvpid_single() || cpu_has_vmx_invvpid_global())) enable_vpid = 0; if (!cpu_has_vmx_ept() || !cpu_has_vmx_ept_4levels() || !cpu_has_vmx_ept_mt_wb() || !cpu_has_vmx_invept_global()) enable_ept = 0; if (!cpu_has_vmx_ept_ad_bits() || !enable_ept) enable_ept_ad_bits = 0; if (!cpu_has_vmx_unrestricted_guest() || !enable_ept) enable_unrestricted_guest = 0;」
- **Excerpt（内核文档）**：「kvm-intel.ept= Control KVM's use of Extended Page Tables, a.k.a. Two-Dimensional Page Tables. Default is 1 (enabled). Disable by KVM if hardware lacks support for EPT.」「kvm-intel.vpid= … Default is 1 (enabled). Disable by KVM if hardware lacks support for it.」
- **Context**：EPT 关闭时 KVM 回退影子页表（shadow MMU），可用 `modprobe kvm_intel ept=0,vpid=0` 验证[^3^]。嵌套虚拟化自 Linux 4.20 起 `nested` 参数默认启用[^4^]。
- **Confidence**：高（内核源码 + 官方文档双证）

**Claim**：APICv（APIC 寄存器虚拟化 + 虚拟中断投递）由 `enable_apicv` 全局开关控制且依赖硬件；VT-d posted interrupt 的启用需同时满足：irqchip 在内核模拟、`enable_apicv` 开启、该 VM 有指派（passthrough）设备、且中断重映射硬件具备 IRQ posting 能力。
- **Source**：freelancer-leon KVM posted interrupt 笔记（引用 arch/x86/kvm/vmx/posted_intr.c 源码）
- **URL**：https://github.com/freelancer-leon/notes/blob/master/virtualization/kvm/posted_interrupt.md
- **Excerpt**：「static bool vmx_can_use_vtd_pi(struct kvm *kvm) { return irqchip_in_kernel(kvm) && enable_apicv && kvm_arch_has_assigned_device(kvm) && irq_remapping_cap(IRQ_POSTING_CAP); }」IPI 虚拟化条件：「vmx_can_use_ipiv() = lapic_in_kernel(vcpu) && enable_ipiv」
- **Context**：vm.c 源码另见「if (!kvm_vcpu_apicv_active(vcpu)) exec_control &= ~(SECONDARY_EXEC_APIC_REGISTER_VIRT | SECONDARY_EXEC_VIRTUAL_INTR_DELIVERY);」——APICv 不活跃时关闭 APIC-register virtualization 与 virtual-interrupt delivery 两个 VMCS 二级执行控制[^5^]。
- **Confidence**：中高（源码摘录可靠，二手笔记转引）

---

## 二、Xen：从纯 PV 到借 VT-x 的全虚拟化与 PVH

### 2.1 模式演进：PV → HVM → PVHVM → PVH

**Claim**：Xen 2003 年起于剑桥大学，早期 PV 不依赖硬件虚拟化；Xen 3.0（2005/2006）借 VT-x/AMD-V 引入 HVM 跑未修改 guest（含 Windows），此后逐层叠加 PV 驱动（PV-on-HVM）、PV 定时器/IPI（PVHVM，Xen 4.1 起），最终形成 PVH（CPU/MMU 走硬件虚拟化、I/O 走 PV 接口、无需 QEMU）。
- **Source**：FreeBSD 中文社区期刊《Xen》；brendangregg.com《What Color Is Your Xen?》
- **URL**：https://book.bsdcn.org/journal/20140708-xu-ni-hua/xen ；https://www.brendangregg.com/blog/2014-05-07/what-color-is-your-xen.html
- **Date**：2014-07 / 2014-05-07
- **Excerpt**：「自 Xen 4.1 起，HVM 客户机还可使用 PV 定时器和 IPI……称为 PVHVM。通常，HVM 客户机有更好的性能，尤其是在页表操作方面……这种新模式称为 PVH，使用 CPU 和 MMU 的硬件虚拟化扩展，同时对其他部分使用 PV 接口。」「HVM: A processor technology for accelerating CPU virtualization (privileged instructions, syscalls) and the MMU (page tables). This is supported by Intel (VT-x) and AMD (AMD-V).」
- **Confidence**：高

**Claim**：PVH（即 PVHv2，曾名 HVM-lite）于 Xen 4.10 正式引入，「与 HVM 在 Xen 侧使用同一份 VT-x 代码」，最小模拟（无 QEMU）、仅 PV 设备、攻击面最小；有 EPT 时 PVH 显著优于 PV，Xen 项目已弃用 PV 并推荐 PVH。
- **Source**：XCP-ng 官方论坛《Early testable PVH support》；NetBSD Xen HowTo
- **URL**：https://xcp-ng.org/forum/topic/10862/early-testable-pvh-support ；https://www.netbsd.org/ports/xen/howto.html
- **Date**：2025-10-18 / 2024-04-08
- **Excerpt**：「The PVH mode has been officially introduced in Xen 4.10 as leaner, simpler variant of HVM (it was initially named HVM-lite) with little to no emulation… PVH mode: relies on VT-x/AMD-V (regarding that, on the Xen side, it's using the same code as HVM), minimal emulation (e.g no QEMU)… PV (deprecated)」「With a CPU having the EPT feature, PVH is substantially more efficient than PV because it uses hardware-assisted virtualization.」
- **Confidence**：高

### 2.2 dom0 角色与 HVM 设备模型

**Claim**：Xen 运行于 VMX root 模式、guest 内核运行于 non-root；dom0 是特权域，持有硬件驱动与 Toolstack；HVM guest 的设备模拟基于 QEMU（qemu-dm 后端进程运行于 dom0）。
- **Source**：Wikipedia《Xen》；uhden.dev Qubes OS 分析；天翼云开发者社区
- **URL**：http://en.wikipedia.org/wiki/Xen ；https://handbook.uhden.dev/articles/qubes-os.html ；https://www.ctyun.cn/developer/article/614829656014917
- **Excerpt**：「Xen HVM has device emulation based on the QEMU project… a patched QEMU "device manager" (qemu-dm) daemon running as a backend in dom0.」「On Intel VT-x, Xen executes in VMX root mode while guest kernels run in VMX non-root mode… Xen's authority comes from controlling second-stage memory translation, interrupts, virtual CPUs.」「Domain0：Xen 虚拟化架构中包含一个特殊的域（Domain0），其包括硬件设备驱动和控制虚拟机的 Toolstack。」
- **Confidence**：高

### 2.3 Xen 对 VT-d 的使用（PCI passthrough）

**Claim**：向 HVM guest 做 PCI 直通必须以硬件 IOMMU（Intel VT-d）为前提（需在 BIOS 开启，Xen 4.0+ 默认启用）；VT-x/VMX 标志不含 IOMMU 能力，两者是独立特性；传统 PV 直通不依赖 VT-d 但不安全。
- **Source**：CSDN 转引 Xen wiki《Xen PCI Passthrough》；Red Hat RHEL5 Virtualization 官方文档
- **URL**：https://blog.csdn.net/cybertan/article/details/7425793 ；https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/5/html/virtualization/chap-virtualization-pci_passthrough
- **Excerpt**：「Requirements for Xen PCI passthru to HVM guest: Hardware IOMMU (Intel VT-d or AMD IOMMU) is required from the CPU/motherboard/chipset/BIOS. Note that IOMMU/VT-d is different additional feature than the normal CPU virtualization extensions (VMX/SVM)… these flags don't give you IOMMU/VT-d support!」「Xen version 3.0 released in 2005 was the first version to support PCI passthrough.」「The VT-d or AMD IOMMU extensions must be enabled in BIOS.」（Red Hat 官方）
- **Context**：安全性佐证——CVE-2011-1898：Xen 4.0/4.1 在无中断重映射（interrupt remapping）的 VT-d 芯片组上做 PCI 直通时，guest 可用 DMA 伪造 MSI 注入中断获得宿主机权限[^6^]；这说明 VT-d 的中断重映射是直通安全模型的必要组成。Xen wiki《VTd HowTo》确认直通设备须先绑定 dom0 的 pciback 驱动[^7^]。
- **Confidence**：高

---

## 三、VMware：从二进制翻译到硬件辅助的转折

### 3.1 转折的理论节点：Adams & Agesen (ASPLOS 2006)

**Claim**：VMware 早期 x86 VMM（Workstation/ESX）因 x86 不满足 trap-and-emulate 而采用二进制翻译（BT）；2006 年 VMware 自己的论文对比软件 VMM 与第一代硬件（VT-x）VMM，发现硬件方案常更慢，主因是「无 MMU 虚拟化支持」与「无法与软件 MMU 技术共存」——即 VT-x 初代必须配合影子页表，VM-exit 开销大。
- **Source**：Keith Adams & Ole Agesen（VMware），《A Comparison of Software and Hardware Techniques for x86 Virtualization》，ASPLOS 2006（Stanford cs240 镜像 PDF）
- **URL**：https://web.stanford.edu/class/cs240/readings/hwsw.pdf
- **Date**：2006-10
- **Excerpt**：「Surprisingly, the hardware VMM often suffers lower performance than the pure software VMM… We find that the hardware support fails to provide an unambiguous performance advantage for two primary reasons: first, it offers no support for MMU virtualization; second, it fails to co-exist with existing software techniques for MMU virtualization.」页错误路径对比：software VMM 3927 cycles vs hardware VMM 11242 cycles。
- **Context**：论文结尾预言 MMU 虚拟化将由硬件解决——「AMD's nested paging and Intel's EPT arrived right after this.」（2007-2008 年 Barcelona RVI / Nehalem EPT 落地后，硬件辅助才全面反超）[^8^]
- **Confidence**：高（一手论文）

### 3.2 ESXi 的 monitor mode 与「hardware MMU」设置

**Claim**：ESXi 为每台 VM 提供 CPU/MMU Virtualization 四档：Automatic（默认，ESXi 自选最优）/ Software CPU and MMU（关 VT-x 与 EPT，即 BT+影子页表）/ Hardware CPU, Software MMU（VT-x + 影子页表）/ Hardware CPU and MMU（VT-x + EPT）。官方建议默认 Automatic，覆盖通常降低性能。
- **Source**：VMware 官方《Performance Best Practices for VMware vSphere 6.5》
- **URL**：https://www.vmware.com/docs/perf_best_practices_vsphere65
- **Excerpt**：「Automatic allows ESXi to determine the best choice. This is the default. / Software CPU and MMU disables both hardware-assisted CPU virtualization (VT-x/AMD-V) and hardware-assisted MMU virtualization (EPT/RVI). / Hardware CPU, Software MMU enables hardware-assisted CPU virtualization (VT-x/AMD-V) but disables hardware-assisted MMU virtualization (EPT/RVI). / Hardware CPU and MMU enables both…」「Make sure any hardware-assisted virtualization features (VT-x, AMD-V, EPT, RVI, and so on) are enabled in the BIOS.」
- **Context**：vSphere Client 中对应选项文案为「Use Intel VT-x/AMD-V for instruction set virtualization and Intel EPT/AMD RVI for MMU virtualization」（Broadcom KB 实证，ESX 4.1 时代已存在）[^9^]。该设置即任务所称的「hardware MMU」。
- **Confidence**：高（VMware 官方文档）

**Claim**：嵌套场景的历史注脚——vSphere 5.0 中无 EPT 也能嵌套跑 64 位 VM（性能差），但 ESXi 5.1 起嵌套 64 位 guest 必须 EPT/RVI（VHV，vhv.enable）；这反映 VMware 执行引擎已全面倒向硬件辅助。
- **Source**：博客园《ESXi5.1安装实验》；William Lam《How to Enable Nested ESXi & Other Hypervisors in vSphere 5.1》
- **URL**：https://www.cnblogs.com/jjkv3/archive/2013/05/10/3071143.html ；https://williamlam.com/2012/08/how-to-enable-nested-esxi-other.html
- **Date**：2013-05 / 2012-08
- **Excerpt**：「在 vSphere 5.0 里，不需要 EPT/RVI 支持就可以实现嵌套式 ESXi 并且支持 64 位 VMs，不过性能一般，可是，在 ESXi 5.1 里，EPT/RVI 是必须的。」「Intel VT-x or AMD-V is required for running Nested Virtualization which supports nested 32-bit VMs; Intel EPT or AMD RVI is required for running nested 64-bit VMs.」
- **Confidence**：中高（权威虚拟化博主 + 实践佐证；「BT 被彻底移除的具体版本」未获官方一手来源，标注为待确认）

---

## 四、Hyper-V：分区模型、VTL 与硬性 VT 要求

### 4.1 根/子分区模型与 SLAT 硬性要求

**Claim**：启用 Hyper-V 后 Windows hypervisor 直接跑在硬件上（VMX root），主机 Windows 变成「根分区」（持有物理设备驱动与虚拟化栈），通过 hypercall 创建子分区；guest 内核仍跑 ring 0，只有被拦截的操作才 VM-Exit；内存变为 GVA→GPA→SPA 两级转换，第二级由 SLAT（Intel EPT）硬件承担，现行 Hyper-V 把 SLAT 列为必备条件。
- **Source**：comcomponent.com《Hyper-V 虚拟机监控程序与分区》（引述 Microsoft Learn《Hyper-V Architecture》）
- **URL**：https://comcomponent.com/zh-CN/blog/windows-virtualization-internals-hypervisor/
- **Date**：2026-08-22
- **Excerpt**：「启用 Hyper-V 之后，虚拟机监控程序跑在硬件正上方，主机 Windows 作为根分区运行」「内存变成 GVA→GPA→SPA 的两级转换，第二级由 SLAT（EPT/RVI）用硬件承担。现行 Hyper-V 必须有 SLAT。」「只有根分区持有物理设备驱动程序与虚拟化管理栈，并通过超级调用创建子分区。」I/O 走「VSC→VMBus→VSP」合成设备路径。
- **Confidence**：中高（内容为 Microsoft Learn 架构文档的忠实转述）

**Claim**：SLAT 要求的官方表述与历史细节：Intel 官方支持文档确认「SLAT 是安装 Microsoft Hyper-V 的要求之一」；细分历史上，Windows Server 2008/2012 的 Hyper-V 角色不强制 SLAT，而 Windows 8 客户端版 Hyper-V（Client Hyper-V）起强制要求 SLAT；EPT 自 Nehalem 起提供，Core 2 及更早不支持。
- **Source**：Intel 官方支持文章 000034303；gOxiA（苏繁，微软 MVP 博客）
- **URL**：https://www.intel.com/content/www/cn/zh/support/articles/000034303/processors.html ；https://goxia.maytide.net/read.php/1578.htm
- **Date**：2020-11-10（Intel）/ 2012
- **Excerpt（Intel 官方）**：「第二级地址转换（SLAT）是一种硬件机制，包括启用英特尔® 虚拟化技术（英特尔® VT-x）时支持的扩展页表（EPT）或嵌套页表……SLAT 是安装 Microsoft Hyper-V* 的要求之一。」
- **Excerpt（历史细分）**：「要在 Windows 8（Client）上启用 Hyper-V 则 CPU 必须满足 SLAT……SLAT 在 Windows Server 8 的 Hyper-V 上则不是必须的」「Intel 的 SLAT 称为 EPT，Core i7/i5/i3……都支持，而 Core 2 系列以及更早的处理器则不支持！」
- **Confidence**：高（Intel 官方）/ 中高（版本细分）

### 4.2 VTL（Virtual Trust Level）与 VBS

**Claim**：VBS 通过 VTL 实现隔离：VTL0 跑常规 Windows 内核与用户态，VTL1 跑 securekernel.exe 与 IUM Trustlet（如 Credential Guard 的 LsaIso.exe）；微软实现最多 16 级、目前只用 2 级；低 VTL 无法读写高 VTL 内存——隔离由 Hyper-V + SLAT（EPT）两套独立页表硬件强制。
- **Source**：奇安信技术研究院《深入解析Windows VTL机制 & IUM进程》；博客园 Credential Guard 架构文
- **URL**：https://research.qianxin.com/archives/2556 ；http://cnblogs.com/suv789/p/18297814
- **Date**：2024-08-22 / 2024-07-12
- **Excerpt**：「我们所熟知的 Windows 内核态和用户态都属于 VTL0 级别下，而 SecureKernel 和运行在同 VTL 层级下的用户态进程属于 VTL1 级别下……低级别 VTL 无法影响到高级别 VTL 内存空间」「在微软对 VTL 的代码实现里，最多支持 16 个级别 VTL，但……只实现了 2 个级别」「硬件 SLAT 二级地址转换机制保证：VTL0 代码无法直接映射、读取 VTL1 物理内存。」
- **Confidence**：高

**Claim**：Windows 11 在符合条件硬件（TPM 2.0、安全启动、8 代酷睿/Zen2+ 等）的全新安装上默认启用 VBS/HVCI（内存完整性），使 Windows hypervisor 常驻——即使不创建任何 VM；2026-10 起微软进一步通过质量更新把内存完整性默认推向更多存量设备；实测 HVCI 平均降低游戏帧率约 6%。
- **Source**：IT之家（引微软官方博客）；网易科技（引 The Verge/ComputerBase）
- **URL**：https://www.ithome.com/0/997/293.htm ；https://www.163.com/dy/article/L5T0D6T30552OI16.html
- **Date**：2026-09-02 / 2026-09-03
- **Excerpt**：「在符合硬件要求的全新 Windows 11 安装环境以及 Secured-core PC 上，内存完整性通常已默认开启」「系统将在需要时自动启用基于虚拟化的安全功能（VBS），为内存完整性提供必要的隔离运行环境」「ComputerBase 此前的独立测试显示……开启 HVCI 后，平均游戏帧率下降了 6%」硬件前提：「处理器必须支持硬件虚拟化，并且 BIOS/UEFI 中应启用 Intel VT-x 或 AMD-V」。
- **Context**：消费级影响——大量教程教用户关闭 VBS 以恢复 VMware/VirtualBox/安卓模拟器的 VT-x 直接访问与游戏性能[^10^]。
- **Confidence**：中高（微软官方博客的媒体转述）

---

## 五、轻量级虚拟化：KVM/VT-x 之上的极简 VMM

**Claim**：Firecracker（AWS，2018-11 开源）是基于 KVM 的 Rust VMM，源自 crosvm，仅 4-5 个模拟设备（virtio-net、virtio-block、串口、单键键盘等），microVM 内存开销 <5MiB、启动 <125ms，支撑 AWS Lambda/Fargate；设备模型极简即攻击面极小，进程再以 cgroups+seccomp 监禁。
- **Source**：InfoQ 中文（AWS 官方博客译文）；SegmentFault
- **URL**：https://www.infoq.cn/article/qpw*zt35uxus74sh2rmt ；https://segmentfault.com/p/1210000046318846
- **Date**：2018-11-27 / 2022-02-04
- **Excerpt**：「Firecracker 实现了一个虚拟机监视器（VMM），它使用基于 Linux 内核的虚拟机（KVM）来创建和管理 microVM……仅有 4 个模拟设备：virtio-net，virtio-block，串行控制台和仅有一个按键的键盘控制器」「可以在不到 125 毫秒的时间内完全启动，创建微虚拟机本身仅需不到 7 毫秒。每个微虚拟机的内存占用少于 5MiB」
- **Confidence**：高

**Claim**：Cloud Hypervisor 由 Intel 发起（现属 Linux Foundation），同样基于 KVM 的 Rust VMM，但与 Firecracker「做减法」相反走「做加法」：用 virtio-pci+ACPI（对 Windows guest 友好）、设备模型更丰富、支持 TDX/SEV-SNP 机密计算与 VFIO 直通；是 Kata Containers 主流后端之一。rust-vmm 项目（2019，Intel/Google/AWS/阿里云等发起）为二者沉淀公共组件。
- **Source**：zhangzqs.cn《基于 rust-vmm 玩转虚拟化》；pandastack.ai《Firecracker vs Cloud Hypervisor》
- **URL**：https://zhangzqs.cn/posts/e273/index.html ；https://www.pandastack.ai/blog/firecracker-vs-cloud-hypervisor/
- **Excerpt**：「Cloud Hypervisor 最初由 Intel 发起，现由 Linux Foundation 社区维护，定位通用云虚拟机……使用 VirtIO-PCI 而非 VirtIO-MMIO，配合 ACPI 设备发现，对 Windows Guest 友好……支持机密计算（Intel TDX、AMD SEV/SEV-SNP）、VFIO 直通」「Cloud Hypervisor (started at Intel) leaned into it heavily.」
- **Confidence**：中高

**Claim**：QEMU 官方提供 `microvm` machine type——受 Firecracker 启发的极简机型，无 PCI 无 ACPI，面向短生命周期 guest，设备仅 ISA/LAPIC/IOAPIC/kvmclock/fw_cfg/至多 8 个 virtio-mmio。
- **Source**：QEMU 官方文档 'microvm' virtual platform
- **URL**：https://www.qemu.org/docs/master/system/i386/microvm.html
- **Excerpt**：「microvm is a machine type inspired by Firecracker and constructed after its machine model. It's a minimalist machine type without PCI nor ACPI support, designed for short-lived guests.」
- **Confidence**：高（官方文档）

**Claim**：Kata Containers（2017 年由 Intel Clear Containers 与 Hyper.sh runV 合并）为每个容器/Pod 起一个轻量 VM（独立 guest 内核），把隔离从进程级提升到硬件虚拟化级；支持 QEMU/KVM、Cloud Hypervisor、Firecracker、Dragonball 等多种 VMM 后端。
- **Source**：云原生实践《Kata Containers 与 K8s》；CSDN Kata 技术文
- **URL**：https://www.oryoy.com/news/xu-ni-ji-rong-qi-hua-kata.html ；https://blog.csdn.net/gitblog_00818/article/details/148487508
- **Excerpt**：「Kata Containers 由 Intel Clear Containers 和 Hyper.sh 的 runV 项目于 2017 年合并而成，目标是创建轻量级的虚拟机，以容器的形式运行，同时提供虚拟机的安全隔离」「支持的 Hypervisor 包括：QEMU/KVM、Cloud Hypervisor、Firecracker、Dragonball」
- **Confidence**：高

---

## 六、桌面/开发者场景对 VT 的依赖

**Claim**：macOS Hypervisor.framework 要求 Intel Mac 具备含 EPT 与 Unrestricted Mode 的 VT-x 特性集；它以 C API 暴露 VM/vCPU 抽象（VM=进程、vCPU=线程），无需 KEXT。
- **Source**：Apple Developer 官方文档《Hypervisor》
- **URL**：https://developer.apple.com/documentation/hypervisor
- **Excerpt**：「On Intel-based Mac computers, the framework supports machines with an Intel VT-x feature set that includes Extended Page Tables (EPT) and Unrestricted Mode.」「Hypervisor abstracts virtual machines as processes, and virtual processors as threads.」
- **Confidence**：高（Apple 官方）

**Claim**：Intel HAXM（Android 模拟器/QEMU 加速器，Windows/macOS 内核驱动 + KVM-like 接口）已于 v7.8.0 退役——Intel 官方理由：Hyper-V（WHPX）与 macOS HVF 均已支持 Intel VMX；Android Emulator 33.x.x.x 起由 AEHD（Android Emulator Hypervisor Driver，源自 gVisor 的 GVM 技术）接替 Intel 平台。
- **Source**：GitHub intel/haxm 官方仓库 README；B4X 论坛引 Android 官方文档
- **URL**：https://github.com/intel/haxm ；https://www.b4x.com/android/forum/threads/vm-acceleration-on-windows-with-intel-processors-for-avd-emulator-starting-with-sdk33.158735/
- **Date**：2023-01-28 / 2024-01-19
- **Excerpt**：「HAXM was created to bring Intel Virtualization Technology to Windows and macOS users. Today both Microsoft Hyper-V and macOS HVF have added support for Intel Virtual Machine Extensions. We have therefore decided to retire the HAXM project. HAXM v7.8.0 is our last release.」「HAXM runs as a kernel-mode driver on the host operating system, and provides a KVM-like interface to user space」「Starting with emulator 33.x.x.x, HAXM was no longer available… The Android Emulator Hypervisor Driver (AEHD) replaces Intel HAXM on Intel processors.」（developer.android.com/studio/run/emulator-acceleration）
- **Confidence**：高（Intel 官方仓库 + Google 官方文档转引）

**Claim**：VMware Workstation 依赖 VT-x/EPT；其对 guest 暴露嵌套虚拟化需勾选「Virtualize Intel VT-x/EPT or AMD-V/RVI」（.vmx 中 vhv.enable="TRUE"）。
- **Source**：博客园 Workstation 设置文；bobcares
- **URL**：https://www.cnblogs.com/omgasw/p/15078582.html ；https://bobcares.com/blog/install-hyper-v-role-in-windows-10-vm-under-vmware-esxi/
- **Excerpt**：「虚拟化 Intel VT-x/EPT 或 AMD-V/RVI：虚拟化主机 PC 处理器的 Intel VT-x/EPT 或 AMD-V/RVI 虚拟化指令，以便它们也可以在虚拟机中使用」「hypervisor.cpuid.v0 = "FALSE"; vhv.enable = "TRUE"」
- **Confidence**：高

---

## 七、冲突与和解：Hyper-V 独占 VT-x → WHPX

**Claim**：Hyper-V 是 Type-1 hypervisor，一旦启用（含 VBS/WSL2/Windows Sandbox 间接拉起）即独占 CPU 虚拟化辅助能力，第三方 hypervisor（VMware/VirtualBox/HAXM）无法再以传统方式直接驱动 VT-x，报「VT-x is not available (VERR_VMX_NO_VMX)」类错误。
- **Source**：comcomponent.com；CSDN 问答
- **URL**：https://comcomponent.com/zh-CN/blog/windows-virtualization-internals-hypervisor/ ；https://ask.csdn.net/questions/9335096
- **Excerpt**：「由于虚拟机监控程序会独占使用 CPU 的虚拟化辅助功能，第三方虚拟机监控程序无法再以传统方式运行。」「Hyper-V 作为 Type-1 裸金属 Hypervisor……会独占 Intel VT-x/AMD-V 硬件辅助虚拟化资源，导致 VMware Workstation（依赖其自研的 Type-2 hypervisor）无法获得底层虚拟化支持。」
- **Confidence**：高

**Claim**：和解路径一（VMware）：Workstation/Player 15.5.5+（配 Windows 10 20H1+）改经 Windows Hypervisor Platform（WHPX）API 在 Hyper-V 之上运行，实现共存，代价是性能下降与部分功能受限（3D 加速、嵌套等）。
- **Source**：CSDN 文库/问答（多处一致）；cloudnative.love
- **URL**：https://ask.csdn.net/questions/9110812 ；https://cloudnative.love/about/Workflow/Windows/HyperV/
- **Excerpt**：「从 VMware Workstation 15.5 版本起，引入了对 Windows Hypervisor Platform (WHPX) 的支持。通过启用该特性，VMware 可绕过直接调用 VT-x，转而通过 WHPX 接口间接访问虚拟化能力。」「将 Windows 版本升级到 Windows 10 20H1 或更高版本；将 VMware Workstation/Player 升级到 15.5.5 或更高版本，安装时勾选『自动安装 Windows Hypervisor Platform (WHP)』」
- **Confidence**：中高（多来源一致；VMware 官方 announcement 未直接检索到）

**Claim**：和解路径二（VirtualBox）：6.0 起引入 NEM（Native Execution Manager）后端，当检测到 Hyper-V 常驻时通过 Hyper-V API/WHPX 运行（窗口底部出现绿色海龟图标），性能较原生 VT-x 模式下降。
- **Source**：NAKIVO 官方博客；techsyncer
- **URL**：https://www.nakivo.com/zh-hant/blog/virtualization-applications-with-hyper-v-device-guard-and-credential-guard/
- **Excerpt**：「自 VirtualBox 6.0 起，VirtualBox 可与 Hyper-V、Device Guard 及 Credential Guard 共存……VirtualBox 窗口的底部面板中会显示一个绿色的乌龟图标，表示虚拟机正在 Hyper-V 半虚拟化模式下运行……性能会下降。」报错原文：「WHvCapabilityCodeHypervisorPresent is FALSE! … (VERR_NEM_NOT_AVAILABLE). VT-x is not available (VERR_VMX_NO_VMX).」
- **Confidence**：中高

---

## 八、维度总结

1. **KVM 是「纯 VT-x」hypervisor**：无软件回退路径，加载即 VMXON；通过 `/dev/kvm` 的三级 fd（system→VM→vCPU）ioctl 把 VMX 生命周期托管给用户态；一 VM 一进程、一 vCPU 一线程，复用 Linux 调度器；QEMU 管 I/O 模拟，KVM 管 CPU/内存。EPT/VPID/unrestricted_guest/APICv 均默认启用、硬件缺项自动降级（回退影子页表等）；VT-d posted interrupt 额外要求「内核 irqchip + enable_apicv + 有直通设备 + 中断重映射支持 IRQ posting」。
2. **Xen 走「PV→借 VT 全虚拟化→再融合」路线**：HVM/PVH 共享同一套 VT-x non-root 执行代码，PVH（4.10+）去掉了 QEMU 成为推荐模式；VT-d 是 HVM PCI 直通的硬前提，中断重映射缺失曾直接导致提权 CVE。
3. **VMware 完成「BT→硬件辅助」的历史转折**：2006 年自家论文证明初代 VT-x 不如 BT，EPT/RVI 出现后硬件辅助全面反超；vSphere 以 CPU/MMU Virtualization 四档（默认 Automatic）暴露该演进，「Hardware CPU and MMU」即 VT-x+EPT；ESXi 5.1 起嵌套 64 位 guest 强制 EPT。
4. **Hyper-V 把 VT-x+SLAT 做成硬门槛**（客户端自 Win8 起强制 EPT），并以 VTL0/VTL1 + 双套 EPT 页表构建 VBS；Windows 11 默认启用 VBS/HVCI 使 hypervisor 常驻消费级 PC，产生约 5-10% 性能税并加剧 VT 资源冲突。
5. **轻量级 VMM 复用 KVM/VT-x 边界、裁剪设备模型**：Firecracker（AWS，<5MiB/<125ms）、Cloud Hypervisor（Intel 发起，通用云+机密计算）、QEMU microvm、Kata Containers（VM 跑容器）共享 rust-vmm/KVM 底座。
6. **桌面端 VT 接口趋于「操作系统化」**：macOS Hypervisor.framework（要求 VT-x+EPT+Unrestricted Mode）、Windows WHPX 取代了 HAXM 等第三方内核驱动；HAXM 退役、AEHD 接棒即此趋势的产物。
7. **冲突与和解闭环**：Hyper-V 独占 VT-x 曾使 VMware/VirtualBox 瘫痪，WHPX/NEM（VMware 15.5.5+、VirtualBox 6.0+）让第三方 VMM 改为在 Hyper-V 之上运行——VT-x 从「各家直抢的硬件资源」变为「由 Windows hypervisor 统一代理的平台服务」。

---

## 附：证据引用索引

[^1^]: 博客园《虚拟化技术介绍》，https://www.cnblogs.com/xiugeng/p/18703305 —— 「2006年10月 Qumranet 发布 KVM；2006年12月合入内核；2007年2月 Linux 2.6.20 正式版发布」
[^2^]: SegmentFault《虚拟化基本知识及virtio-net初探》，https://segmentfault.com/a/1190000042954455 —— 「让 KVM 处理处理器虚拟化和内存虚拟化，运行在内核态；让 QEMU 处理 I/O 虚拟化，运行在用户态」
[^3^]: Stack Overflow《How to set KVM VM use shadow page table?》，https://stackoverflow.com/questions/46589149/ —— 「modprobe kvm_intel ept=0,vpid=0」
[^4^]: docs.kernel.org《Running nested guests with KVM》，https://docs.kernel.org/6.2/virt/kvm/x86/running-nested-guests.html —— 「From Linux kernel v4.20 onwards, the nested KVM parameter is enabled by default for Intel and AMD.」
[^5^]: GitLab 内核源码镜像 arch/x86/kvm/vmx/vmx.c，https://isrc.iscas.ac.cn/gitlab/yafen/linux/-/blame/.../arch/x86/kvm/vmx.c
[^6^]: strix.ai CVE-2011-1898，https://www.strix.ai/cve/CVE-2011-1898 —— 「Xen … when using PCI passthrough on Intel VT-d chipsets that do not have interrupt remapping, allows guest OS users to gain host OS privileges」
[^7^]: Xen Wiki《VTd HowTo》，https://wiki.xenproject.org/wiki/VTd_HowTo —— 「devices … need to be bound to pciback」
[^8^]: OS readings 笔记（Adams & Agesen 论文导读），https://x-czh.github.io/os-readings/notes/sw-hw-virt.html —— 「AMD's nested paging and Intel's EPT arrived right after this.」
[^9^]: Broadcom KB 304417，https://knowledge.broadcom.com/external/article/304417/ —— 「Use Intel VT-X/AMD-V for instruction set virtualization and Intel EPT/AMD RVI for MMU virtualization」
[^10^]: CSDN《Win11 24H2 关闭 VBS 方法参考》，https://blog.csdn.net/2401_84215240/article/details/144983501 —— 「开启后，系统自身会有 5-10% 的性能损失……不少依赖 CPU 硬件虚拟化的虚拟机软件（vmware、virtualbox、安卓虚拟机雷电等）就无法直接……访问 CPU 虚拟化接口」

**待确认/存疑**：① ESXi 彻底移除二进制翻译 monitor mode 的确切版本（官方一手来源未检索到，现有证据仅能确认 4.x-6.x 均保留 Software 档位且默认 Automatic）；② VMware Workstation 15.5.5 WHPX 支持的官方 announcement 原文（多来源一致但为二手）；③ Windows Server 版 Hyper-V 自何版本起强制 SLAT（确认客户端 Win8 起强制；Server 2008/2012 不强制，后续版本文档未逐一核实）。
