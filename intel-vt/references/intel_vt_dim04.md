# 英特尔虚拟化技术研究 · 维度04：VT-d（Directed I/O 虚拟化）与设备直通

> 研究日期：2026 年（基于公开资料检索）；已确认背景：VT-d 规范 2006 年 3 月首发，提供芯片组级 DMA 重映射与中断重映射，使 VMM 可将物理 I/O 设备直接分配给特定 VM（设备直通/passthrough）并防止 DMA 越界；Linux 侧对应 VFIO；SR-IOV 允许单 PCIe 设备暴露多个 VF。
> 本报告共执行 36 次独立搜索 + 3 次权威页面原文打开（Intel 官方规范 PDF、Lenovo Press、Project ACRN）。

---

## 0. 执行摘要

VT-d 是 Intel 平台的 IOMMU 架构，历经约 20 年演进：从 2006 年首版的 DMA 重映射（root/context 两级设备→域映射 + 二级页表），到 1.x/2.x 时代补齐中断重映射（IRTE）与队列失效（QI）、ATS/PRI/PASID，再到 2018 年 6 月 Rev 3.0 引入 **Scalable Mode**（PASID 粒度翻译、第一级翻译），与 Intel SIOV（可扩展 I/O 虚拟化）配套；最新公开规范已达 **Rev 5.20（2026 年 4 月，Order Number D51397-019）**，新增 HPT（Host Permission Table）、增强/虚拟命令接口、性能监控等章节[^1^]。软件生态上，Linux VFIO/iommufd + KVM、Xen、VMware DirectPath I/O、Hyper-V DDA 均构建于 VT-d 之上；安全面上 VT-d 是 Windows Kernel DMA Protection、Thunderbolt 4 认证与 Intel TXT/tboot DMA 保护的硬件基础；应用面上覆盖云裸金属、NFV（DPDK+SR-IOV）与 AI 训练 GPU 直通。

---

## 1. 规范版本演进

### 1.1 版本脉络（含置信度标注）

| 版本 | 时间 | 关键特性 | 置信度/依据 |
|---|---|---|---|
| Rev 1.0 | 2006-03 | DMA 重映射：root table / context table / second-level page tables；domain 隔离 | 高（背景已确认） |
| Rev 1.x（如 1.2） | 2008–2015 | 中断重映射（Interrupt Remapping）、Queued Invalidation（QI）、IOTLB 失效粒度（全局/域/页）、4 级页表遍历、2MB/1GB 大页 | 高：Broadwell（5 代酷睿）数据手册声明"comply with the Intel VT-d 1.2 Specification"，且已列出 Interrupt remapping / Queued invalidation / 4-level page walk / superpage[^6^] |
| Rev 2.x（2.0–2.5） | ~2011–2017 | ATS（Device-TLB）、PRI（Page Request）、PASID 支持、x2APIC、Extended Context Mode | 中高：Core Ultra(PS) 数据手册声明符合 VT-d 2.1 规范并已支持 Scalable Mode、Nested translation、interrupt remapping、QI[^5b^]；具体逐版日期未能从一手来源核实 |
| **Rev 3.0** | **2018-06** | **Scalable Mode**（可扩展模式）：PASID 粒度翻译、第一级翻译（First-Level Translation, FLT）、PASID Directory/Table 取代 Extended Context（后者废弃）；与 Intel SIOV 配套，支撑 SVA/SVM | 高：LKML 补丁明示 "Intel vt-d rev3.0 introduces a new translation mode called 'scalable mode'"[^2^]；Phoronix 报道该支持进入 Linux 4.21[^3^] |
| Rev 3.1–3.4 | 2019–2021 | Posted Interrupt 增强、vIOMMU 支撑完善 | 中（间接证据） |
| Rev 4.0 | ~2022 | Core Ultra 200V（Lunar Lake）数据手册声明"comply with the Intel VT-d 4.0 Specification"，支持 Scalable Mode（RID_PASID）、Nested translation、Posted Interrupt、Abort DMA Mode、性能监控[^5^] | 高（数据手册原文） |
| **Rev 5.20** | **2026-04** | 当前最新公开版：新增 HPT（Host Permission Table，第 4.2.4/9.12 节）、Enhanced Command Interface、Virtual Command Interface（vIOMMU 硬件 offload）、RDT 配置寄存器、完整的性能监控体系 | 高：规范 PDF 封面与目录原文[^1^] |

**证据 E1.1**
- Claim：VT-d 规范当前版本为 Rev 5.20（2026 年 4 月）。
- Source：Intel 官方规范 PDF 封面
- URL：https://www.intel.com/content/dam/www/public/us/en/documents/product-specifications/vt-directed-io-spec.pdf
- Date：April 2026
- Excerpt："Intel® Virtualization Technology for Directed I/O Architecture Specification, Rev.5.20, Order Number: D51397-019"
- Context：该 URL 是 Intel 各代 CPU 数据手册中引用的规范地址，文件持续更新。
- Confidence：高

**证据 E1.2**
- Claim：VT-d Rev 3.0 引入 Scalable Mode，实现 PASID 粒度的第一级/第二级翻译，并废弃 Extended Context Mode。
- Source：LKML（Intel 工程师 Lu Baolu 补丁系列）+ KVM Forum 2018 演讲 slides
- URL：https://lkml.org/lkml/2018/10/7/54 ；https://qemu-project.gitlab.io/kvm-forum/2018/kvm-forum-vSVA-yliu-jpan-jean-eric.pdf
- Date：2018-10-07 / 2018
- Excerpt："Intel vt-d rev3.0 introduces a new translation mode called 'scalable mode', which enables PASID-granular translations for first level, ..."；"VT-d Extended Context Mode (Deprecated) / VT-d Scalable Mode (New) / Key Difference: PASID is a global ID space shared by all VMs. ALL page-table pointers moved to PASID Granular table"；"Intel® VT-d 3.0 specification extends SVA usage together with Intel® Scalable I/O Virtualization"
- Context：Linux 内核社区对 VT-d 3.0 可扩展模式的上游支持（进入 Linux 4.21）[^3^]。
- Confidence：高

**证据 E1.3**
- Claim：量产硅片已落地 VT-d 4.0（Scalable Mode + Nested + Posted Interrupt 成标配）。
- Source：Intel Core Ultra 200V 系列处理器数据手册 Vol.1
- URL：https://cdrdv2.intel.com/V1/DL/GETCONTENT/829568
- Date：2024（Lunar Lake）
- Excerpt："Memory controller and processor graphics comply with the Intel® VT-d 4.0 Specification... Support for Interrupt Remapping and Posted Interrupt... Scalable Mode- All VTd engines support Scalable mode operation (using RID_PASID only). Nested- All Intel® VT-d engines support Nested translation"
- Context：说明 2024 年后主流平台 VT-d 引擎已全面支持 3.0 引入的可扩展模式。
- Confidence：高

---

## 2. DMA 重映射结构

### 2.1 Legacy Mode：root table → context table → second-level page table

- **Domain（域）**：抽象定义的隔离环境，被分配宿主物理内存的一个子集，其内存资源由地址翻译表指定；多个设备可共享同一 domain（context-entry 的 Second-level Page-table Pointer 指向同一结构、Domain ID 相同）[^7^][^8^]。
- **Root-table**：4KB，256 个 root-entry，按 PCI Bus 号（0–255）索引；每个 root-entry 含 Context-Table Pointer（CTP）[^7^]。
- **Context-table**：每个 4KB、256 个 context-entry，按 Device:Function（8bit）索引；context-entry 关键字段：Present、Translation Type、Address Width、**Second-level Page-table Pointer**（用于 requests-without-PASID）、**Domain Identifier**（硬件用它标记 context-entry cache，类似 VPID）、Fault Processing Disable[^8^]。
- **Second-level page table**：4 级页表遍历（48bit GPA），支持 4K/2M/1G 页[^6^][^1^]。
- **与 EPT 页表共享**：ACRN hypervisor 直接复用 VM 的 EPT 表作为直通设备的二级翻译结构——"the EPT table of a domain is used as the address translation structures for the devices assigned to the domain"，设备 DMA 时 IOMMU 按 EPT 将 GPA 翻译为 HPA，vcpu(MMU) 与直通设备(IOMMU) 共享同一份 EPT[^7^]。这是"直通设备看到的地址空间 == VM 地址空间"的实现关键，也是 IOTLB 与 EPT TLB 需要协同失效的原因。

### 2.2 Scalable Mode（Rev 3.0+）

- RTADDR_REG.TTM=01b 进入 Scalable Mode：root-entry 变为 scalable-mode root-entry，context-entry 指向 **PASID Directory → PASID Table**，翻译粒度从"设备（RID）"细化到"进程地址空间（RID+PASID）"；支持 First-Stage（GVA→GPA，直接用 guest CPU 页表）、Second-Stage、Nested（两级串联）、Pass-through 四种翻译类型[^1^][^2^][^4^]。
- ACPI 层面：DMAR 表（DRHD/RMRR/ATSR/RHSA 等结构）向 OS 报告重映射硬件单元拓扑；VT-d 是纯 MMIO 平台设备、无 PCI 配置空间，靠 ACPI DMAR 发现[^1^][^24^]。

**证据 E2.1**
- Claim：VT-d 用 root-table/context-table 建立设备→domain 映射，context-entry 含二级页表指针与 Domain ID；ACRN 复用 EPT 作为设备翻译表。
- Source：Project ACRN 官方 HLD 文档（Intel 主导的开源 hypervisor）
- URL：https://projectacrn.github.io/latest/developer-guides/hld/hv-vt-d.html
- Date：2024-11（页面版本）
- Excerpt："The root-table is 4-KByte in size and contains 256 root-entries to cover the PCI bus number space (0-255)... Each context-entry contains a Second-level Page-table Pointer... On ACRN, EPT table of a domain is used as the address translation structures for the devices assigned to the domain... translates the DMA address according to the EPT table from guest physical address (GPA) to host physical address (HPA)."
- Context：ACRN 文档逐条对应 VT-d 规范第 3 章（DMA Remapping）。
- Confidence：高

### 2.3 缓存与失效（IOTLB / QI）

- VT-d 在 IOTLB、context-cache、PASID-cache、paging-structure cache（PML5/PML4/PDPE/PDE-cache）中缓存翻译；软件修改翻译结构后必须失效。失效接口有两种：**寄存器接口**（逐个等待完成）与 **Queued Invalidation（QI，失效队列）**——软件把失效描述符（context-cache/PASID-cache/IOTLB/PASID-based-IOTLB/Device-TLB/Interrupt-Entry-Cache Invalidate + Invalidation Wait）写入内存队列，批量提交，效率更高[^1^][^23^]。
- QI 在真实平台上的启用可通过 dmesg 观察："DMAR: dmar0: Using Queued invalidation"、"DMAR-IR: Queued invalidation will be enabled to support x2apic and Intr-remapping"[^24^]。
- 性能持续优化：2024 年内核补丁为 QI 引入批量失效，"batching IOTLB and dev-IOTLB invalidations can decrease the time spent in qi_submit_sync() by roughly more than 800 cycles"[^22^]。

**证据 E2.3**
- Claim：VT-d 定义寄存器式与队列式（QI）两套失效机制，队列式适合批量失效。
- Source：USENIX 论文中译本笔记（On the DMA Mapping Problem in Direct Device Assignment）+ Intel 规范 6.5 节目录
- URL：https://blog.csdn.net/m0_52857523/article/details/121776658 ；规范 PDF[^1^]
- Date：2021 / 2026-04
- Excerpt："VT-d 定义了 IOTLB 失效的三种模式：全局、页级和目录级……有两种机制可以使条目无效：基于寄存器的无效和排队的无效。使用基于寄存器的方法，软件需要等待每个地址失效完成。当需要修改多个条目时，排队失效会更有效。" 规范目录含 "6.5.2 Queued Invalidation Interface" 及 12 类失效描述符。
- Confidence：高

---

## 3. 中断重映射：IRTE 与 Posted Interrupt

### 3.1 Interrupt Remapping

- 中断请求分两种格式：Address bit4=0 为 Compatibility format（直通上传 LAPIC），bit4=1 为 Remappable format（仅含 16bit Handle，可选 SubHandle，不再含 APIC ID）[^9^]。
- 硬件对 0xFEEx_xxxx 地址段的 DWORD 写判定为中断请求并拦截；启用 IR 后按 `interrupt_index = f(Handle, SubHandle)` 索引**中断重映射表**（基址在 IRTA 寄存器，最大 2^16=64K 项），每项 **IRTE 16 字节**，含 Present、Destination Mode、IRTE Mode（bit15：0=Remapped / 1=Posted）、Vector、Destination ID、SID/SQ/SVT（校验中断源的 requester-id）[^9^][^10^]。
- 软件流程：分配 IRTE→填目标/向量→编程中断源（I/O xAPIC RTE 或 MSI/MSI-X Address/Data 寄存器）发出可重映射格式中断。效果：不同 domain 的设备中断被隔离并可自由重定向；同时是 x2APIC 大规模系统的支撑[^9^][^10^]。

### 3.2 Interrupt Posting（与 APICv 协同）

- VT-d Rev 2.x 后增加 Interrupt Posting（Capability Register bit59 指示支持）：IRTE 的 IM=1 时按 Posted 格式解析，IRTE 内含 **Posted Interrupt Descriptor（PID，64 字节）**内存地址，硬件把中断位图写入 PID 的 PIR 字段，并按 ON/URG/SN 决定是否发通知事件[^10^][^1^]。
- 与 VT-x APICv（virtual-interrupt delivery、process posted interrupts）配合：VMM 为每个 vCPU 分配 PID 并把地址写入 VMCS 的 POSTED_INTR_DESC_ADDR；直通设备中断可**不产生 VM-exit** 直接投递给运行中的 vCPU（ANV 通知运行态 vCPU、WNV 唤醒阻塞态 vCPU）[^11^][^13^]。
- 落地时间：Posted Interrupt 随 Broadwell-EP（2016）平台普及，"外部中断直接投递进 Posted Interrupt 硬件，完全避开 VMM 处理……目前 Xen/KVM Hypervisor 已经支持 Posted Interrupt"[^12^]。

**证据 E3.1**
- Claim：IRTE bit15 区分 Remapped 与 Posted 两种模式；Posted 模式借助 PID 与 APICv 实现免 VM-exit 的中断注入。
- Source：VT-d 技术博客系列（中文，逐字段对照规范）+ 至顶网 Broadwell-EP 评测 + Intel 规范 5.2 节目录
- URL：https://blog.51cto.com/u_16213655/11172884 ；http://m.zhiding.cn/article/3077184.htm ；[^1^]
- Date：2024-06 / 2016 / 2026-04
- Excerpt："bit 15（IRTE Mode）……如果为1，则VT-d硬件将会以Posted Interrupt的形式来解析该IRTE……多了一个Posted Descriptor Address Low/High"；"Posted Interrupt……完全避开了VMM的处理，这种思想和很多的Kernel Bypass技术一样，其收益也非常明显，特别是在配合SR-IOV的情况下"；规范目录含 "5.2 Interrupt Posting / 9.11 Posted Interrupt Descriptor (PID)"。
- Confidence：高

---

## 4. ATS / PRI / PASID：面向设备侧的地址服务

- **ATS（Address Translation Services，地址转换服务）**：PCIe 设备侧维护 **Device-TLB**，DMA 前先向 IOMMU 发 Translation Request 取回翻译结果并缓存，后续以 "Translated Request" 直接访问，降低 IOMMU 集中遍历压力与延迟；映射变更时主机经 QI 的 Device-TLB Invalidate 描述符 + ATS Invalidation 协议消息使设备缓存失效[^1^][^1066→见参考^]。内核中对应 `CONFIG_PCI_ATS`、`qi_flush_dev_iotlb()`[^22^]。
- **PRI（Page Request Interface，页请求接口）**：设备 DMA 遇到未映射页时，通过 Page Request 向主机"请求调页"，主机处理 Page Request Queue（PRQ）后回 Page Group Response，实现设备侧的按需分页/缺页——SVA 场景下 DMA 不再需要 pin 住内存[^15^][^1^]（规范第 7 章 Recoverable Fault / Page Request）。
- **PASID（Process Address Space ID，20bit）**：在 TLP 中标记"哪个进程地址空间"，使单一 PCIe Function 可并发服务多个地址空间；是 SVA/SVM（设备直接用 CPU 虚拟地址）、SIOV（虚拟化粒度从 Function 细化到 PASID 标识的 I/O 上下文）与 vIOMMU guest→host PASID 翻译的基石[^15^][^19^][^4^]。
- **SVA 落地实例**：Intel DSA/IAA 加速器（idxd 驱动）依赖 `CONFIG_INTEL_IOMMU_SVM`、`PCI_ATS/PRI/PASID`，内核文档给出三种 IOMMU 模式（Scalable / Legacy / No IOMMU），Scalable 模式以 `intel_iommu=on,sm_on` 进入并支持共享/专用工作队列[^45^]；线程经 `IA32_PASID` MSR + ENQCMD 指令免内核提交工作[^15^]。

**证据 E4.1**
- Claim：ATS+PRI+PASID 三件套使设备可共享进程虚拟地址空间且 DMA 免 pin。
- Source：Linux 内核文档 sva.rst 中文解读 + kernel-internals SVA 页 + Intel 规范第 4/7 章
- URL：https://blog.gitcode.com/0052f99e6f5d0d931416fc1ec81ca81b.html ；https://kernel-internals.org/iommu/sva/ ；[^1^]
- Date：2026 / — / 2026-04
- Excerpt："设备在 I/O 前经 ATS 请求 IOMMU 查表；若映射存在但 OS 未分配页面，IOMMU 硬件返回'无映射'；设备随后经 PRI 请求映射该虚拟地址；OS 完成映射后回响应给设备……当设备支持 SVA 且平台 IOMMU 支持相应设备时，DMA 不再需要 pin 内存"；"20-bit PASID means at most 1M concurrent bindings per IOMMU"。
- Confidence：高

---

## 5. Scalable I/O Virtualization（SIOV）

### 5.1 与 SR-IOV 的本质区别

| 维度 | SR-IOV | SIOV |
|---|---|---|
| 虚拟单元 | VF（完整 PCIe Function：配置空间、BAR、MSI-X 表都需硬件复制） | ADI/SDI（Assignable/Scalable Device Interface），共享 PF 的 BAR，仅保留队列级数据通路 + 唯一 RID/PASID |
| 数量 | 设计期固定，通常几十~数百（受 PCIe 功能号与芯片面积限制） | 映射表项仅几十字节，单设备可达数千~上万虚拟接口 |
| 资源编排 | 静态、粗粒度 | VDCM（Virtual Device Composition Module，软件）动态组合 ADI→VDEV，毫秒级创建/销毁 |
| 快/慢路径 | 配置也在硬件 | 快路径（数据 I/O）直通硬件；慢路径（配置/复位）由 VMM/VDCM 拦截模拟 |
| 标准化 | PCIe 标准，成熟普及 | Intel 2017 内部提出、2018-06 形成 rev 1.0 内部规范、2022 贡献 OCP、2025 被 PCI-SIG 纳入 PCIe 规范 |
[^18^][^19^][^20^][^21^]

- SIOV 依赖 VT-d 3.0 Scalable Mode：DMA 与中断以 PASID 为粒度重映射；Linux 侧需扩展 iommufd（如 `iommufd_device_bind_pasid()`）与 VFIO[^19^][^41^]。
- Microchip 案例：单 SSD 虚拟化出约 1000 个独立存储设备；保留唯一 RID 保证硬件级 DMA 隔离[^21^]。

**证据 E5.1**
- Claim：SIOV 由 Intel 提出，2018-06 形成 rev 1.0 规范，2022 贡献 OCP、2025 进入 PCI-SIG PCIe 规范；以 PASID 为虚拟化粒度、由软件 VDCM 组合虚拟设备。
- Source：腾讯云开发者社区技术文 + 欧洲专利局公开专利文本（引用 Intel SIOV 规范版本）+ Lenovo Press
- URL：https://developer.cloud.tencent.com/article/2674358 ；https://data.epo.org/publication-server/rest/v1.2/patents/EP4550722NWA1/document.html ；https://lenovopress.lenovo.com/lp2166-configuring-sr-iov-and-siov-in-vmware-vsphere
- Date：2026-05 / 2025-05 / 2025-02（更新至 2026-04）
- Excerpt："SIOV是Intel 2017年内部提出的规范……2018年形成Intel内部规范，2022年被贡献给了OCP组织，2025年被PCI-SIG组织纳入PCIe规范"；"An example technical specification for SIOV is Intel® Scalable I/O Virtualization Technical Specification, revision 1.0, June 2018"；"DMA transfers from/to an ADI are tagged with a unique Process Address Space identifier (PASID) number"。
- Confidence：高（时间线为多源交叉；PCI-SIG 2025 纳入为单一来源，置信度中高）

### 5.2 落地状态（2024–2026）

- vSphere：Lenovo Press 已发布在 ESXi（含 9.0）上配置 SIOV 的指南，但评价"SIOV is relatively new and less standardized"，需更新的硬件/软件栈[^18^]。
- Linux：SIOV 所需的 iommufd/vDEVICE/vIOMMU 对象模型已进入内核文档[^41^]；DSA 等加速器以 SIOV 思想（共享工作队列 + PASID）率先落地[^45^]。
- 结论：SIOV 处于"规范已标准化、硬件与 hypervisor 生态早期落地"阶段，尚未达到 SR-IOV 的普及度。

---

## 6. 软件生态

### 6.1 Linux VFIO / iommufd / KVM

- **VFIO**（Virtual Function I/O）：内核官方文档定义为安全的用户态设备访问框架，取代旧的 KVM device assignment 与 UIO；核心对象模型 **container / group / device**——IOMMU group 是 DMA 隔离的最小硬件单元（PCI 桥后设备同组），直通必须以整组为单位；container 对应一个地址空间（通常一台 VM）[^14^][^25^]。
- 演进：内核文档明确 **iommufd 是新的用户态 I/O 页表管理 API**，承载嵌套翻译、PASID 等高级特性，"Eventually the vfio_iommu_type1 driver, as well as the legacy vfio container and group model is intended to be deprecated"，并引入 `/dev/vfio/devices/vfioX` cdev 接口[^14^]。
- KVM/QEMU 直通流程：BIOS 开 VT-d → 内核参数 `intel_iommu=on iommu=pt` → 设备从原驱动 unbind、绑定 vfio-pci → QEMU `-device vfio-pci,host=BDF` 或 libvirt `<hostdev>`；QEMU 通过 memory listener + `VFIO_IOMMU_MAP_DMA` 建立 GPA→HPA 的 IOMMU 页表[^26^][^25^]。
- 中断路径三档：无 IR 时 irqfd 注入（性能最差）→ IRTE 重映射 → posted interrupt 直接注入（最接近 native）[^25^]。
- vIOMMU：QEMU 可模拟 intel-iommu（全模拟）或借助 iommufd vIOMMU 对象做硬件辅助嵌套翻译，支撑"直通设备再直通给 L2"等嵌套场景[^41^][^42^]。

**证据 E6.1**
- Claim：VFIO 以 IOMMU group 为最小隔离单元；iommufd 将取代传统 VFIO container/group 模型。
- Source：The Linux Kernel documentation（kernel.org 官方）
- URL：https://docs.kernel.org/driver-api/vfio.html
- Date：持续更新（访问于研究时点）
- Excerpt："IOMMUFD is the new user API to manage I/O page tables from userspace. It intends to be the portal of delivering advanced userspace DMA features (nested translation, PASID, etc.)... Eventually the vfio_iommu_type1 driver, as well as the legacy vfio container and group model is intended to be deprecated."
- Confidence：高

### 6.2 Xen

- Xen 历来支持 VT-d 直通（dom0 内核 `xen-pciback`/pci_stub 隐藏设备后 assign 给 domU）；RHEL5 时代文档即要求在 BIOS 开启 VT-d、Xen 内核加 `iommu=on`[^27^]。
- 近年演进：PVH dom0 下设备直通曾是缺口，2023–2024 年 AMD/社区补丁（PHYSDEVOP_setup_gsi、privcmd 新 syscall）补齐；**Xen 4.21（2025）实现"dom0 在 PVH 模式下可为 HVM 客户执行 PCI passthrough"**[^28^][^43^]。

### 6.3 VMware DirectPath I/O（VMDirectPath）

- ESXi 的 PCI 直通功能名 DirectPath I/O：在 Host Client 中对 PCI 设备"切换直通"→重启→添加给 VM；GPU 直通后客户机装原生驱动，适合 AI/ML、渲染、CUDA 负载[^29^]。代价与业界一致：开启直通的 VM 失去挂起/恢复、vMotion 实时迁移能力[^455→见参考^]。SR-IOV 与 DirectPath 并存：ESXi 中可对网卡 "Configure SR-IOV" 生成 VF 再分配给 VM[^18^]。

### 6.4 Hyper-V DDA（Discrete Device Assignment）

- DDA 于 **Windows Server 2016 TP4** 首次亮相，允许 GPU、网卡等 PCIe 设备直通给 VM，仅提供 PowerShell 管理接口（`Dismount-VMHostAssignableDevice` / `Add-VMAssignableDevice`）[^30^]；微软官方仅承诺支持 NVIDIA Tesla/Quadro、AMD Radeon Pro 等专业卡（WHQL + 虚拟化优化驱动），消费级 GeForce/Radeon RX 不在支持矩阵[^31^]。DDA 依赖 VT-d/IOMMU 做设备隔离。

### 6.5 GPU 直通与 vGPU

- **整卡直通（GVT-d/VFIO）**：性能最接近原生，一卡一 VM；NVIDIA 消费卡有 Error 43 等人为限制。
- **Intel GVT-g（中介直通，mdev/kvmgt）**：把核显切成多个 vGPU 共享，仅支持 Broadwell–Comet Lake（Gen9.x）；**Intel 已于 2024-10-03 归档 gvt-linux 仓库并声明存在已知安全缺陷、不再维护；Xe/Gen12+ 以 SR-IOV 为替代路线**[^32^]。
- **NVIDIA vGPU（GRID）**：数据中心卡的时分共享方案，需授权；SR-IOV 型 GPU VF（如部分 Instinct/数据中心卡）是硬件切分路线[^442→见参考^]。

**证据 E6.5**
- Claim：GVT-g 已被 Intel 弃用且存在已知安全问题，新平台转向 SR-IOV。
- Source：ArchWiki Intel GVT-g（引用 Intel 官方 GitHub 归档声明）
- URL：https://wiki.archlinux.org.cn/title/Intel_GVT-g
- Date：2026-05（页面）
- Excerpt："Intel GVT-g 官方 GitHub 仓库已被归档……'此项目将不再由 Intel 维护。该项目已被确定存在已知的安全缺陷。'……对于 Xe 架构 (Gen12) 及更新版本，SR-IOV 功能是预期的替代方案。"
- Confidence：高

---

## 7. 安全面：DMAR 保护与 DMA 攻击防御

- **防设备 DMA 攻击**：IOMMU 是防御恶意/被控外设 DMA 注入的基石；ACPI DMAR（Intel）/IVRS（AMD）/IORT（ARM）描述设备→IOMMU 拓扑，OS 据此建表限制 DMA[^677→见参考^]。Linux 建议 `intel_iommu=on,strict`（严格模式，每次 unmap 即刷 IOTLB，堵住延迟失效窗口）[^677^]。
- **Thunderbolt 场景**：TB 把 PCIe 暴露到机箱外，Thunderspy（2020，Björn Ruytenberg）证明 2019 年前设备可在 5 分钟物理接触内绕过锁屏与磁盘加密。**Intel 官方简报：VT-d 是 Thunderbolt 口 DMA 保护的基础，Thunderbolt 4 认证强制要求基于 VT-d 的 DMA 保护**[^33^]；Windows 侧对应 Kernel DMA Protection（Windows 10 1803+，依赖 IOMMU，未登录前阻断外设 DMA），微软将其列为对抗 Thunderspy 的核心措施[^34^][^35^]。Linux 可用 `cat /sys/bus/thunderbolt/devices/domain0/iommu_dma_protection` 验证[^676→见参考^]。
- **固件/启动链**：Intel TXT + tboot 在启动早期用 VT-d PMR（Protected Memory Range）对全部 RAM 做 DMA 保护，并把 DMAR 副本放入 DMA 保护区校验，防 ACPI 表被篡改[^37^]；UEFI 侧有 EDK II IOMMU 协议消费 DMAR 表做固件期 DMA 管控[^36^]。
- **局限**：ACS 缺失/桥接拓扑可导致 IOMMU group 过大、`pcie_acs_override` 拆组会削弱隔离；PCIe 重放、设备固件篡改、IOMMU 页表被改是残余风险[^304→见参考^][^685→见参考^]。

**证据 E7.1**
- Claim：VT-d 是 Thunderbolt DMA 防护的硬件基础，TB4 认证强制要求。
- Source：Intel《Thunderbolt Security》官方简报（Mouser 镜像 PDF）+ Microsoft Security Blog
- URL：https://www.mouser.com/pdfDocs/thunderbolt-security-brief.pdf ；https://www.microsoft.com/en-us/security/blog/2020/05/13/secured-core-pcs-help-customers-stay-ahead-of-advanced-data-theft/
- Date：—（简报）/ 2020-05-13
- Excerpt："Intel® Virtualization Technology for Directed I/O (VT-d)... is the foundation for DMA protection on Thunderbolt ports... Intel's Thunderbolt 4 certification requires VT-d based DMA protection"；"Kernel DMA protection relies on the Input-Output Memory Management Unit (IOMMU) to block external peripherals from starting and performing DMA unless an authorized user is signed in"。
- Confidence：高

---

## 8. 典型应用

1. **云主机裸金属/高性能实例**：阿里云弹性裸金属（神龙）提供 GPU 计算型 ebmgn 系列（ebmgn9g/8v/7e/6i…），GPU/网卡直通 + RDMA，实测迁移案例训练时间缩短、单卡利用率从 58%→91%（案例数据来自二手博客，置信度中）[^39^][^1141→见参考^]；AWS/Azure 的 GPU 实例同理采用整卡直通或 SR-IOV。
2. **NFV（DPDK + SR-IOV）**：电信 VNF 场景"VNF+SR-IOV"方案中各 VM 虚拟网卡直连物理网卡 VF，"旁路了 HOST 的虚拟化层实现直接转发，可以达到近似物理转发的性能"；VM 内部再叠 DPDK 用户态轮询[^38^]；东西向流量则 DPDK+vSwitch 优于 SR-IOV（Intel 官方测试结论被引述）[^683→见参考^]。DPDK 官方文档把 VFIO 列为推荐驱动（"robust and secure driver that relies on IOMMU protection"）[^44^]。
3. **AI 训练 GPU 直通**：直通使 VM 直接安装 NVIDIA 官方驱动、完整 CUDA/cuDNN 生态，相对 vGPU 方案（15–25% 损耗）直通损耗通常 <5%、PCIe 延迟显著降低（数据来自云厂商营销文，置信度中低，仅作量级参考）[^40^][^687→见参考^]。

**证据 E8.1**
- Claim：NFV 中 SR-IOV+VM 内 DPDK 是消除 Hypervisor 转发损耗的主流方案。
- Source：C114 通信网（H3C 供稿技术文）
- URL：http://www.c114.com.cn/website/h3c_2016/hot/list_DPDK.html
- Date：—（2016 专题）
- Excerpt："各VM的虚拟网卡可以直接连至HOST上支持SR-IOV功能的物理网卡（VF）进行数据收发，如同独占物理网卡一样……由于旁路了HOST的虚拟化层实现直接转发，可以达到近似物理转发的性能，被业界普遍用于消除Hypervisor带来的数据转发性能影响。"
- Confidence：高（业界共识性陈述）

---

## 9. 维度总结

1. **规范线**：VT-d 从 2006 年首版的"设备→域 DMA 重映射"，到 1.x/2.x 补齐中断重映射、QI、ATS/PRI/PASID，2018-06 Rev 3.0 的 Scalable Mode 是最大架构跃迁（PASID 粒度、第一级翻译、与 SIOV 配套）；2024 年量产硅片落实 VT-d 4.0，当前规范已迭代至 Rev 5.20（2026-04，新增 HPT、虚拟命令接口等）。
2. **结构线**：Legacy 模式 root/context 两级表 + 二级页表完成 BDF→domain→GPA/HPA 翻译，hypervisor 普遍复用 EPT 作为设备翻译表；Scalable 模式改以 PASID Directory/Table 实现进程粒度、支持嵌套翻译。
3. **中断线**：IRTE 把设备中断与 APIC ID 解耦实现隔离与重定向；Interrupt Posting + APICv（Broadwell-EP 起）实现免 VM-exit 中断注入，是直通性能逼近原生的关键一环。
4. **设备服务线**：ATS（Device-TLB）+ PRI（设备缺页）+ PASID（20bit 进程标记）构成 SVA/SIOV 地基，使 DMA 免 pin、设备可直接消费 CPU 虚拟地址。
5. **SIOV**：以软件 VDCM + 硬件 PASID 映射取代 SR-IOV 的硬件 VF 复制，数量从数百提升到数千上万；2018 内部规范→2022 OCP→2025 PCI-SIG 标准化，2024–2026 处于早期落地（vSphere 指南、iommufd vDEVICE/vIOMMU）。
6. **生态线**：Linux VFIO→iommufd 演进明确；Xen 4.21 补齐 PVH dom0 直通；VMware DirectPath I/O、Hyper-V DDA（WS2016 TP4 起，仅专业 GPU）为商业等价物；GVT-g 已弃用、转向 SR-IOV。
7. **安全线**：VT-d 同时是"直通隔离"与"防 DMA 攻击"的同一硬件根基——Thunderbolt 4 认证、Windows Kernel DMA Protection、Intel TXT/tboot PMR 均构建其上。
8. **应用线**：云裸金属 GPU 实例、NFV 的 SR-IOV+DPDK、AI 训练整卡直通是 VT-d 价值的三大兑现场景。

**遗留不确定性**：Rev 2.0–2.5 与 3.1–3.4、4.x 各小版本的精确发布日期与逐版差异未能从一手来源核实（Intel 不公开旧版规范存档）；SIOV"2025 纳入 PCI-SIG"为单一中文来源，建议以 PCI-SIG 官方 ECN 复核；GVT-g 安全缺陷细节未展开。

---

## 参考来源

[^1^]: Intel® Virtualization Technology for Directed I/O Architecture Specification, Rev.5.20, D51397-019, 2026-04. https://www.intel.com/content/dam/www/public/us/en/documents/product-specifications/vt-directed-io-spec.pdf
[^2^]: LKML — [PATCH v3 00/12] iommu/vt-d: Add scalable mode support (Lu Baolu), 2018-10-07. https://lkml.org/lkml/2018/10/7/54
[^3^]: Phoronix — Intel VT-d Scalable Mode Coming To Linux 4.21, 2018-12-31. https://www.phoronix.com/news/Intel-VT-d-Linux-4.21-Scale
[^4^]: KVM Forum 2018 — vSVA slides (Liu/Pan/Brucker). https://qemu-project.gitlab.io/kvm-forum/2018/kvm-forum-vSVA-yliu-jpan-jean-eric.pdf
[^5^]: Intel Core Ultra 200V Series Processors Datasheet Vol.1. https://cdrdv2.intel.com/V1/DL/GETCONTENT/829568
[^5b^]: Intel Core Ultra Processors (PS Series) Datasheet（VT-d 2.1 + Scalable Mode + Nested）. https://sf448448cbeeed0ff.jimcontent.com/download/version/1756974105/module/14451797189/name/819636_Intel_Core_Ultra_Proc_PS_Datasheet__Rev001.pdf
[^6^]: Intel 5th Gen Core (Broadwell) Desktop Datasheet Vol.1（"comply with the Intel VT-d 1.2 Specification"，含 interrupt remapping/QI/superpage）. https://www.mouser.com/datasheet/2/612/desktop-5th-gen-core-family-datasheet-vol-1-765515.pdf
[^7^]: Project ACRN — VT-d High-Level Design. https://projectacrn.github.io/latest/developer-guides/hld/hv-vt-d.html
[^8^]: 博客园 — ARM SMMU原理与IOMMU技术（VT-d DMA Remapping，context-entry 字段）. https://www.cnblogs.com/linhaostudy/p/18416321
[^9^]: 掘金 — VT-d学习02：Interrupt Remapping技术原理，2024-03-29. https://juejin.cn/post/7351662722935963663
[^10^]: 51CTO — VT-d Interrupt Remapping / Interrupt Posting，2024-06. https://blog.51cto.com/u_16213655/11172884
[^11^]: 掘金 — VT-d学习04：Interrupt Posting技术原理（ANV/WNV、VMCS 配置），2024-03-31. https://juejin.cn/post/7352075771534491658
[^12^]: 至顶网 — Intel Broadwell-EP 处理器评测（Posted Interrupt/APICv/PML），2016. http://m.zhiding.cn/article/3077184.htm
[^13^]: Leinux — Interrupt Virtualization & APICv，2024. https://leinux.netlify.app/2024/01/25/interrupt-virtualization-apic-virtualization
[^14^]: The Linux Kernel documentation — VFIO "Virtual Function I/O"（含 IOMMUFD 替代路线）. https://docs.kernel.org/driver-api/vfio.html
[^15^]: GitCode — Linux x86 SVA 与 ENQCMD：PASID（内核 sva.rst 解读）. https://blog.gitcode.com/0052f99e6f5d0d931416fc1ec81ca81b.html
[^16^]: Linux Kernel Internals — Shared Virtual Addressing. https://kernel-internals.org/iommu/sva/
[^17^]: OSCHINA — Windows驱动DMA传输高效实现策略（IOMMU ATS/PRI/PASID 字段），2026-01. https://my.oschina.net/emacs_9709669/blog/19109942
[^18^]: Lenovo Press LP2166 — Configuring SR-IOV and SIOV in VMware vSphere, 2025-02（2026-04 更新）. https://lenovopress.lenovo.com/lp2166-configuring-sr-iov-and-siov-in-vmware-vsphere
[^19^]: 腾讯云开发者社区 — SR-IOV、MR-IOV 与 SIOV：PCIe虚拟化技术的过去、现在与未来，2026-05. https://developer.cloud.tencent.com/article/2674358
[^20^]: EPO 专利 EP4550722（引 Intel SIOV Technical Specification rev 1.0, June 2018；ADI/PASID 描述），2025-05. https://data.epo.org/publication-server/rest/v1.2/patents/EP4550722NWA1/document.html
[^21^]: 腾讯云开发者社区 — Microchip：从SR-IOV到SIOV：云原生存储虚拟化范式（SDI/~1000 设备/20-bit PASID），2026-01. https://cloud.tencent.com/developer/article/2625020
[^22^]: LWN — Batch IOTLB/dev-IOTLB invalidation（QI 批处理，~800 cycles），2024. https://lwn.net/Articles/985796/
[^23^]: CSDN — On the DMA Mapping Problem in Direct Device Assignment 笔记（寄存器式 vs 队列式失效），2021-12. https://blog.csdn.net/m0_52857523/article/details/121776658
[^24^]: 博客园 — PVE 配置显卡直通（DMAR dmesg：QI/IRQ remapping/DRHD 实例），2025-02. https://www.erlo.vip/share/2/110532.html
[^25^]: frankhashope — 基于VFIO的物理设备直通实现（Kernel 6.6/QEMU 8.2 源码分析），2025-08. https://frankhashope.github.io/virtualization/VFIO/
[^26^]: CSDN — vfio-pci直通技术详解（绑定流程、IOMMU 组、SR-IOV VF），2026-05. https://blog.csdn.net/m0_57112626/article/details/161136388
[^27^]: Red Hat RHEL5 文档 — Chapter 15. PCI passthrough（Xen/KVM，VT-d BIOS 要求）. https://docs.redhat.com/zh-cn/documentation/red_hat_enterprise_linux/5/html/virtualization/chap-virtualization-pci_passthrough
[^28^]: Patchew — [v9] Support device passthrough when dom0 is PVH on Xen，2024-09. https://patchew.org/Xen/20240912092352.1602724-1-Jiqian.Chen@amd.com/
[^29^]: 英方软件 — 如何在VMware中启用GPU：直通（DirectPath I/O）完整指南，2026-08. https://www.info2soft.cn/blog/data-management-migration/vmware-how-to-enable-gpu
[^30^]: GitCode 博客 — Hyper-V DDA 图形工具（DDA 首次亮相于 Windows Server 2016 TP4），2026-01. https://blog.gitcode.com/6176fb4688b75cf5ad4bbb0807520320.html
[^31^]: CSDN 问答 — Hyper-V DDA 仅支持 Tesla/Quadro/Radeon Pro 等专业 GPU，2025-12. https://ask.csdn.net/questions/9071353
[^32^]: ArchWiki — Intel GVT-g（已弃用；gvt-linux 2024-10-03 归档、已知安全缺陷；Xe 转向 SR-IOV）. https://wiki.archlinux.org.cn/title/Intel_GVT-g
[^33^]: Intel — Thunderbolt Security 简报（VT-d 为 TB DMA 保护基础；TB4 认证强制）. https://www.mouser.com/pdfDocs/thunderbolt-security-brief.pdf
[^34^]: Microsoft Security Blog — Secured-core PCs / Thunderspy / Kernel DMA Protection，2020-05-13. https://www.microsoft.com/en-us/security/blog/2020/05/13/secured-core-pcs-help-customers-stay-ahead-of-advanced-data-theft/
[^35^]: Norypt Privacy Academy — Thunderbolt attacks: Thunderspy 与 Kernel DMA Protection，2025-11. https://norypt.com/privacy-academy/thunderbolt-security-attacks
[^36^]: Intel 白皮书 — Using IOMMU for DMA Protection in UEFI Firmware（DMAR/EDK II IOMMU 协议）. https://www.intel.com/content/dam/develop/external/us/en/documents/intel-whitepaper-using-iommu-for-dma-protection-in-uefi.pdf
[^37^]: Linux 内核文档（中文镜像）— Intel TXT 概述（tboot 用 VT-d PMR 保护全 RAM、校验 DMAR）. https://linuxkernel.org.cn/doc/html/latest/arch/x86/intel_txt.html
[^38^]: C114 通信网 — 浅谈DPDK技术在NFV领域的应用（VNF+SR-IOV 场景）. http://www.c114.com.cn/website/h3c_2016/hot/list_DPDK.html
[^39^]: 阿里云官方文档 — 弹性裸金属服务器规格（含 GPU 计算型 ebmgn 系列）. https://help.aliyun.com/zh/ecs/user-guide/elastic-bare-metal-server-overview
[^40^]: 营销向技术文 — GPU直通技术为什么能减少延迟（PCIe 延迟/损耗数据，置信度中低），2025-10. https://www.xymww.com/teng-xun-yun-gpu-zhi-tong-ji-shu-wei-shen-me-neng-jian-shao.html
[^41^]: Linux 内核文档（中文镜像）— IOMMUFD（VIOMMU/VDEVICE 对象）. https://linuxkernel.org.cn/doc/html/latest/userspace-api/iommufd.html
[^42^]: 腾讯云开发者社区 — IOMMU(八)-vIOMMU，2022-04. https://cloud.tencent.com/developer/article/1989599
[^43^]: Linux迷 — Xen 4.21 发布（PVH dom0 支持 PCI passthrough），2025-11. https://www.linuxmi.com/xen-4-21.html
[^44^]: DPDK 文档 — Linux Drivers: VFIO（"robust and secure driver that relies on IOMMU protection"）. https://doc.dpdk.org/guides-21.11/linux_gsg/linux_drivers.html
[^45^]: Linux 内核文档（中文镜像）— IAA 压缩加速器驱动（Scalable 模式 `intel_iommu=on,sm_on`，SVM/ATS/PRI/PASID 配置项）. https://docs.linuxkernel.org.cn/driver-api/crypto/iaa/iaa-crypto.html

补充引用（正文以 [^xxx→见参考^] 形式提及）：
- [^1066] CSDN — VT-d Device-TLB原理和实现（ATS Invalidation 协议细节），2022-12. https://blog.csdn.net/leiyanjie8995/article/details/128419749
- [^677] CSDN — ACPI 安全全景（DMAR/IOMMU 拓扑、intel_iommu=strict），2025-09. https://blog.csdn.net/wjm2005427/article/details/152161715
- [^676] BotMonster — Thunderbolt 5 for Linux（iommu_dma_protection 验证），2026-05. https://botmonster.com/posts/thunderbolt-5-explained-linux-users/
- [^685] 主机安全基线（IOMMU 局限与加固），2026-04. https://zhuji.idocdown.com/app/articles/blogs/detail/8472
- [^304] 积雨云的空间站 — 用 VFIO 给 KVM 虚拟机直通 PCIe 设备（ACS override 风险）. https://www.ready-jump.top/tinkering/kvm-qemu-vfio-pcie-passthrough
- [^455] 主机宝贝 — 详解GPU虚拟化技术（直通丧失热迁移/Save-Restore），2024-12. https://www.idcbaby.com/227757/
- [^442] 悠哉网 — NAS虚拟化GPU直通完全指南（GVT-g/SR-IOV/VFIO 三路线），2024-12. https://www.yoozai.com/22295.html
- [^1141] CSDN — 阿里云弹性裸金属实例深度解析（AI 训练迁移案例数据，置信度中），2026-07. https://bbs.csdn.net/weixin_27013291/article/details/100203459
- [^683] 腾讯云开发者社区 — NFV中：DPDK与SR-IOV应用场景及性能对比，2022-08. https://developer.cloud.tencent.com/article/2076429
- [^687] 云小栈 — 深度学习训练适合直通型GPU还是虚拟型GPU，2025-11. https://phpnode.cn/archives/7130
