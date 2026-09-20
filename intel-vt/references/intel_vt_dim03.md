# 维度03：内存虚拟化 —— EPT（扩展页表）与 VPID 深度研究

> 研究范围：影子页表原理与开销、EPT 机制与条目属性、EPT violation/misconfiguration、VMFUNC EPTP switching、VPID 与 INVVPID、大页与 PML 脏页跟踪、EPT vs 影子页表性能量化、AMD NPT/RVI 对照。
> 搜索轮次：22 次独立搜索（中文为主 + Intel SDM/顶会论文/kernel 邮件列表英文原文）。
> 完成时间：2026 年（研究执行时点）。

---

## 1. 影子页表（Shadow Page Table）：为什么慢

### 1.1 原理

内存虚拟化需要两次地址转换：GVA→GPA（Guest 页表）与 GPA→HPA（VMM 维护的映射）。影子页表把两级转换「合并」为一套 GVA→HPA 的页表，由 VMM 填充后直接载入物理 MMU，Guest 的 CR3 被「架空」——Guest 写 CR3 是特权操作，VMM 截获后将影子页表基址写入 VMCS 的 GUEST_CR3 字段，硬件真正使用的是影子页表 [^1^][^2^]。

**优点**：稳态下 Guest 大多数内存访问无需 VMM 介入，TLB 命中时地址转换与原生相同（4 次内存引用）[VMware 称影子页表缓存最近使用的 LPN→MPN 于硬件 TLB] [^3^]。

### 1.2 开销根源（为什么慢）

**(a) 写保护陷阱（trace-based 同步）**。VMM 必须感知 Guest 对页表的一切修改：将 Guest 页表页写保护，Guest 每次写页表触发 fault → VM-exit，VMM 解码指令、读取 Guest PTE、查 GPA→HPA 映射、更新影子 PTE、临时解除写保护、VM-entry 恢复执行——每一次 Guest 页表写都要走这一整套流程 [^1^][^4^]。MIT 6.828 讲义概括为「VMM write-protect guest's PTE pages, trap on PTE write, emulate, also in shadow pagetable」[^5^]。

**(b) CR3 / INVLPG / 缺页引发的 VM-exit**。Guest 切换进程（写 CR3）、执行 INVLPG、影子页表项缺失等都会 VM-exit；且影子页表与 Guest 页表不同步，本质上是 Guest 页表的「软件 TLB」（VTLB），每次缺影子项都要 VMM 介入构建 [^6^][^7^]。

**(c) 同步复杂性与内存开销**。KVM 需为每个 Guest 进程页表维护一套影子页表并用哈希表关联，同步逻辑要考虑各种分页模式（32-bit/PAE/x86-64）、TLB shootdown、fork/mmap 高频场景 [^1^][^8^]。软件学报论文指出：「影子页表的同步依赖于基于写保护的机制，频繁的虚拟机退出（VM-exit）会严重影响系统性能」[^9^]。

**(d) 实测量化**。MICRO'14（Gandhi et al., *Efficient Memory Virtualization*）实测影子分页在页表更新频繁的负载上比原生慢最高 29.2%（connected，4K 页），高开销来自为保持影子页表一致的额外 VM 退出 [^10^]。ASPLOS'06（Adams & Agesen, VMware）指出第一代硬件 VMM 的陷阱代价高昂，软件 VMM 用自适应二进制翻译消除陷阱，在进程创建/上下文切换密集的负载上软件反而更快——说明「陷入-模拟」路径是核心瓶颈 [^11^]。

### 1.3 证据

- **Claim**：影子页表需写保护 Guest 页表页并在每次写入时陷入 VMM 同步，内存开销大、实现复杂。
  **Source**：zxxyy.github.io《x86内存虚拟化–影子页表和拓展页表(EPT)》
  **URL**：https://zxxyy.github.io/posts/SPT-EPT/
  **Date**：2023-08-02
  **Excerpt**：「VMM会将guest Page Table本身使用的物理页面设为write protected。总之，影子页表实现非常复杂……影子页表的内存开销也很大，需要为每个客户机进程对应的页表都维护一个影子页表。」
  **Context**：个人技术博客，内容与 Intel SDM 及 VMware 论文一致。
  **Confidence**：高

- **Claim**：影子分页在页表更新密集负载上最高慢 29.2%。
  **Source**：Gandhi, Basu, Hill, Swift, *Efficient Memory Virtualization*, MICRO 2014（威斯康星大学）
  **URL**：https://pages.cs.wisc.edu/~swift/papers/micro14-virtualization.pdf
  **Excerpt**：「connected（4K：29.2%，2M：11.1%）……The increase in execution time corresponded to additional VM exits to keep shadow page tables coherent.」
  **Confidence**：高（顶会论文实测）

---

## 2. EPT 机制

### 2.1 总体结构与引入时间

EPT（Extended Page Tables）是 Intel 的 SLAT（Second Level Address Translation）实现，随 Nehalem 微架构（2008，Core i7 / Xeon 5500 系列）引入，属「第二代 Intel VT」；同代还引入 VPID 与不可屏蔽中断窗口退出 [^12^][^13^][^14^]。EPT 使硬件自动完成 GVA→GPA→HPA 两级转换：Guest 自由管理自己的页表（CR3、INVLPG、缺页均不再 VM-exit），VMM 只维护一张 EPT（GPA→HPA）[^1^][^15^]。

### 2.2 4 级页表与 EPTP

EPT 页结构与 x86-64 4 级分页完全一致（PML4→PDPT→PD→PT），区别仅在于根指针：普通分页的 PML4 基址在 CR3，EPT 的基址是 **EPTP（Extended Page Table Pointer）**，存放在 VMCS 的 VM-execution 控制字段（编码 0x201A，64 位）。EPTP 是 HPA（由 VMM 在进入客户态前写入，不是 GPA）[^16^]。

**EPTP 格式**（64 位）[^17^]：

| 位 | 字段 | 说明 |
|---|---|---|
| 2:0 | 内存类型 | 0=UC；6=WB（常规取 6，指 EPT 页表结构自身的缓存类型） |
| 5:3 | 页表遍历长度−1 | 4 级 EPT 取 3 |
| 6 | A/D 使能 | 置 1 时硬件在访问 EPT 结构时自动置 Accessed 位、写时置 Dirty 位 |
| 11:7 | 保留 | 必须为 0 |
| N−1:12 | PML4 物理地址 | 4KB 对齐 |

启用方式：`SECONDARY_VM_EXEC_CONTROL` 的 "enable EPT" 位 + `VMWRITE(EPT_POINTER, addr | (3<<3) | 6)` [^18^]。

### 2.3 最坏情况内存访问次数：20 次还是 24 次？——核实结论：**24 次**（含 Guest 页表读取），EPT 侧为 20 次

- Guest 页表 4 级遍历需读 4 个 Guest 页表项；每读一个 Guest 页表项都产生一次 GPA 访问，需走一次 4 级 EPT 遍历（4 次内存读），共 4×4=16 次；
- 最终得到 GPA 后还需一次 4 级 EPT 遍历转换为 HPA，再 4 次；
- 总计 = 4（Guest 项） + 16（Guest 项的 EPT 遍历） + 4（最终 GPA 的 EPT 遍历） = **24 次内存引用**。

学术界（ISCA'16 Agile Paging、VEE'21 (No)Compromis、Gandhi 博士论文）统一引用 **24 次**（native 为 4 次）：「in x86-64, TLB misses require up to 24 memory references as opposed to a native 1D page walk requiring up to 4 memory references」[^19^][^20^]。其论文表格逐层列出：PTptr 4 + L4 5 + L3 5 + L2 5 + L1 5 = 24 [^19^]。中文社区常说的「5 次 EPT 查询 × 4 = 20 次」只统计了 EPT 页表项读取，未计入 4 次 Guest 页表项读取 [^21^]。**因此准确数字是 24（总内存引用），20 是其中 EPT 页表读取数**。

为缓解，EPT 引入后 Intel 使用页表遍历缓存（paging-structure caches）与更大的 TLB；AnandTech 引述「4 次原生遍历变成 16 次」的说法是仅对 EPT 遍历的粗略表述，并指出 TLB miss 在嵌套分页下代价极高 [^22^]。

### 2.4 EPT TLB 与三类映射缓存

Intel SDM（Vol. 3C, "Caching Translation Information"，新版第 30 章 / 旧版 28.3）将与 VMX 相关的转换缓存分为三类 [^23^][^24^]：

1. **Linear mappings**（GVA→PA，EPT 关闭时）；
2. **Guest-physical mappings**（GPA→HPA，来自 EPT 页表）；
3. **Combined mappings**（GVA→HPA，来自 Guest 页表 + EPT）。

EPT 开启时处理器只创建/使用后两类。Nehalem 的 TLB 层次：L1 DTLB 64 项（4KB 页）+32 项（2M/4M 大页），4 路组相联；新增统一的 L2（STLB）512 项小页，4 路组相联 [^25^][^26^]。

### 2.5 证据

- **Claim**：EPT 于 Nehalem（2008）引入，GVA→GPA→HPA 两级转换由硬件完成。
  **Source**：Cloud Atlas《Intel EPT技术架构》；Oracle VirtualBox Manual 3.7
  **URL**：https://cloud-atlas.readthedocs.io/zh_CN/latest/kvm/intel_vt/intel_ept/intel_ept_infra.html ; https://docs.oracle.com/en/virtualization/virtualbox/6.0/admin/nestedpaging.html
  **Excerpt**：「Intel的SLAT实现称为扩展页表(EPT)，在Nehalem微架构引入(2008年)」；「Intel added support for nested paging, which they call extended page tables (EPT), with their Core i7 (Nehalem) processors.」
  **Confidence**：高

- **Claim**：4 级页表 TLB miss 最坏 24 次内存引用（native 4 次）。
  **Source**：Gandhi et al., *Agile Paging*, ISCA 2016；Teabe et al., *(No)Compromis*, VEE 2021
  **URL**：https://research.cs.wisc.edu/multifacet/papers/isca16_agile_paging.pdf ; http://sigplan.github.io/OpenTOC/vee21.html
  **Excerpt**：「TLB misses require up to 24 memory references」；「24 memory accesses on a TLB miss (instead of 4 memory accesses in a native system)」
  **Confidence**：高（两篇顶会一致）

- **Claim**：EPTP 位布局（内存类型/遍历长度/AD/基址）。
  **Source**：deepwiki cpu-internals《VMCS Structure and Fields》（引用 Intel SDM VMCS encoding）
  **URL**：https://deepwiki.com/ayoubfaouzi/cpu-internals/4.1-vmcs-structure-and-fields
  **Excerpt**：「`[2:0]` Memory type: 0=UC, 6=WB; `[5:3]` Walk length − 1: for 4-level EPT set to 3; `[6]` A/D flags enable; `[N−1:12]` PML4 base address」
  **Confidence**：高（与 SDM 一致）

---

## 3. EPT 条目属性、EPT violation / misconfiguration、EPTP switching

### 3.1 EPT 条目权限与 A/D 位

EPT 页表项有独立的 读（bit 0）/写（bit 1）/执行（bit 2，另有 supervisor-execute 与 mode-based execute control 的 user-execute 区分）权限位；后续还引入 execute-only 页（VMX_EPT_EXECUTE_ONLY_BIT）与 2MB（cap bit 16）/1GB（cap bit 17）大页支持位、INVEPT（bit 20）、A/D（bit 21）能力位，均由 IA32_VMX_EPT_VPID_CAP MSR 报告 [^27^]。EPTP bit 6 置 1 后，CPU 访问 EPT 下级结构时自动置 Accessed 位，最终页表项的 Dirty 位在写时置 1（A 位对区/页可用，D 位仅对页——1GB/2MB/4KB）[16][^28^]。

### 3.2 EPT violation（退出原因 48）与 EPT misconfiguration（退出原因 49）

Intel SDM 28.2.3 原文：「An **EPT misconfiguration** occurs when … the logical processor encounters an EPT paging-structure entry that contains an unsupported value. An **EPT violation** occurs when there is no EPT misconfiguration but the EPT paging-structure entries disallow an access using the guest-physical address.」[^29^]

- **EPT violation**：Guest 页表合法但 EPT 拒绝了 GPA→HPA 转换（典型：EPT 项 not present——用于按需分配/KVM 缺页；或权限不足——用于 MMIO 模拟、内存自省、EPT hook）。Guest 对此无感知，只有 hypervisor 看到。退出时硬件在 EXIT_QUALIFICATION 记录细节：bit 0/1/2 = 由读/写/取指引起；bit 3/4/5 = EPT 项的 R/W/X 权限；bit 7 = GUEST_PHYSICAL_ADDRESS 有效；bit 8 = 是否为 GPA 转换（非页表遍历）[30]。
- **EPT misconfiguration**：EPT 项本身结构非法（如「只写不可读」write=1,read=0，Intel 不允许），通常意味着 hypervisor 的 bug；硬件不记录原因，退出原因 49 [^30^][^31^]。KVM 实践中亦用「合法但无权限」的 EPT violation 处理 MMIO [^32^]。

与 Guest 缺页（#PF，vector 14）的区别：#PF 是 Guest 自己页表拒绝，交 Guest OS 处理，**不产生 VM-exit**（除非 exception bitmap 拦截）；EPT violation 只交 VMM [^30^][^33^]。

### 3.3 EPTP switching（VMFUNC 0 号功能）

VMFUNC 指令（Haswell 起）允许 VMX non-root 软件（内核或用户态）在不触发 VM-exit 的情况下调用 hypervisor 配置的 VM 功能。**VM function 0 = EPTP switching**：EAX=0，ECX=n 为索引，Guest 从 VMCS 中的 EPTP list（最多 **512** 个 EPTP 项）加载新的 EPTP，从而切换到同一物理地址空间的另一套映射/权限视图；不修改任何寄存器与标志 [^34^][^35^][^36^]。典型用途：进程/组件级隔离（如 SkyBridge 微内核 IPC）、虚拟化安全（内存隔离视图）、沙箱 [^35^]。

TLB 语义：切换后硬件开始创建/使用与新 EPTP（EP4TA）关联的 guest-physical 与 combined mappings；**若启用 VPID，VMFUNC 不刷 TLB**——因为 combined mappings 同时与 VPID+PCID+EP4TA 关联，旧条目不会被误命中；若未启用 VPID，VMFUNC 会失效 VPID 0 相关的全部 combined mappings [^37^][^24^]。

### 3.4 证据

- **Claim**：EPT violation=权限拒绝（exit 48），misconfiguration=表项非法（exit 49，如只写页）。
  **Source**：iwishi808《EPT Internals》；Intel SDM Vol.3C 28.2.3（xem.github.io 镜像）
  **URL**：https://iwishi808.github.io/2026/05/18/ept-internals/ ; https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1155.html
  **Excerpt**：「An EPT misconfiguration occurs when … an EPT paging-structure entry that contains an unsupported value. An EPT violation occurs when there is no EPT misconfiguration but the EPT paging-structure entries disallow an access」
  **Confidence**：高（SDM 原文）

- **Claim**：VMFUNC 0 号功能=EPTP switching，EPTP list 最多 512 项，启用 VPID 时不刷 TLB。
  **Source**：liujunming《深入理解intel vmfunc指令》；Intel Xen Summit 2012 slides（Nakajima）
  **URL**：http://liujunming.github.io/2024/04/21/深入理解intel-vmfunc指令/ ; https://docs.huihoo.com/xen/summit/2012/aug28/10a-intel-update.pdf
  **Excerpt**：「The EPTP list can hold at most 512 EPTP entries. … With the Virtual Processor ID (VPID) feature enabled, the VMFUNC instruction does not flush TLB.」「VM function 0: EPTP switching VMFUNC – Loads EPTP from EPTP list (indexed by value of ECX)」
  **Confidence**：高

---

## 4. VPID：TLB 标签化

### 4.1 动机与机制

第一代 VT-x 每次 VMX 转换（VM-exit/entry）都强制使全部 TLB 失效，但多数情况下 VMM 并未修改 Guest 页表，刷新纯属浪费；且 EPT 使重建 TLB 项的代价（24 次引用）更高 [^38^][^39^]。

VPID 在 VMCS 中新增 **16 位 VPID 字段**（VPID 于 Nehalem 引入）：逻辑处理器维护「当前 VPID」，TLB 插入的转换与当前 VPID 关联，只有与当前 VPID 匹配的转换才用于加速地址转换。VPID 0000H 保留给 VMM/VMX root，Guest VCPU 必须分配非 0 且互不相同的 VPID。启用后 VM-exit/entry 只需切换当前 VPID，**无需使任何 TLB 项失效**，Guest 与 Host 的 TLB 项共存 [^39^][^38^][^40^]。

KVM/VMM 管理：为每个 vCPU 分配唯一 VPID，位图管理最多 64K 个 VPID，vCPU 释放时回收；vCPU 迁移到新 pCPU 时需 INVVPID [^40^][^41^]。VPID 类似 PCID/ASID 之于进程：ASID 区分进程地址空间，VPID 区分虚拟处理器地址空间 [^42^]。

### 4.2 INVVPID 指令类型（Intel SDM 第 30 章）

INVVPID 使与 VPID 关联的 linear mappings 与 combined mappings 失效（**不清除 GPA→HPA 的 guest-physical mappings**，那是 INVEPT 的职责）[^43^][^44^]。描述符 128 位：bit 0–15 = VPID，bit 64–127 = 线性地址。四种类型（能力由 IA32_VMX_EPT_VPID_CAP 报告）[^43^][^45^]：

| 类型 | 名称 | 语义 |
|---|---|---|
| 0 | Individual-address | 仅使描述符指定的线性地址 + VPID 的映射失效（对应 INVLPG 模拟） |
| 1 | Single-context | 使指定 VPID 的全部映射失效（所有 PCID/EP4TA） |
| 2 | All-contexts | 使除 VPID 0000H 外所有 VPID 的映射失效 |
| 3 | Single-context-retaining-globals | 同 1 但保留 global 转换（对应 MOV CR3 模拟） |

配套指令 **INVEPT** 两种类型：1=single-context（按 EP4TA 失效 guest-physical 与 combined mappings）、2=all-context（所有 EP4TA）。修改 EPT 结构后必须执行 INVEPT，且需在每个逻辑核上执行 [^44^][^46^]。

### 4.3 隔离效果与实测收益

VPID 下 Guest 切换不再全刷 TLB，进程若访问不属于自己的转换只会 TLB miss 而非非法访问。Intel Technology Journal（2010）：「Before the introduction of VPIDs on Nehalem, every VMX transition invalidated all TLB entries……**Enabling VPID and EPT increased the vConsolidate performance of Nehalem by 25%**」[^39^]。Intel 估计 Nehalem 一次 VM 往返转换延迟约为 Merom 的 40%、比 Penryn 低约 1/3 [^26^]。

### 4.4 证据

- **Claim**：VPID 为 16 位 VMCS 字段，VPID 0 归 VMM，启用后 VMX 转换不刷 TLB。
  **Source**：Intel《Extending KVM with new Intel Virtualization technology》（KVM Forum 2008）；Intel Technology Journal 2010
  **URL**：https://www.linux-kvm.org/images/c/c7/KvmForum2008%24kdf2008_11.pdf ; https://www.intel.com/content/dam/www/public/us/en/documents/research/2010-vol14-iss-3-intel-technology-journal.pdf
  **Excerpt**：「New 16-bit virtual-processor-ID field (VPID) field in VMCS … VMM uses VPID 0x0000」「A VMM can assign a different VPID to each VM, thus avoiding the TLB invalidations that occurred on every VMX transition on processors prior to Nehalem.」
  **Confidence**：高（Intel 一手资料）

- **Claim**：INVVPID 四种类型语义。
  **Source**：Intel SDM（felixcloutier.com / xem.github.io 镜像）
  **URL**：https://www.felixcloutier.com/x86/invvpid
  **Excerpt**：「Individual-address invalidation: type 0 … Single-context invalidation: type 1 … All-contexts invalidation: type 2 … retaining global translations: type 3」
  **Confidence**：高（SDM 原文）

---

## 5. 大页（2MB/1GB）与 PML 脏页跟踪

### 5.1 大页在 EPT 中的作用

TLB miss 代价在 EPT 下放大 6 倍（24 vs 4 次引用），因此降低 TLB miss 率至关重要。2MB 大页使一级 TLB 项覆盖 512 倍地址空间、页表遍历少一级；1GB 页再减一级。EPT 大页能力由 IA32_VMX_EPT_VPID_CAP bit 16（2MB）/bit 17（1GB）报告 [^27^]。VMware EPT 评估明确要求：「use of large pages by the application in the virtual machine and availability of large pages at the ESX level are a prerequisite for good database performance」，ESX VMM 与 VMkernel 在启用 EPT 时积极使用大页 [^47^]。KVM API 文档建议 guest_phys_addr 与 userspace_addr 低 21 位一致，以便 Guest 大页被 Host 大页支撑 [^48^]。

### 5.2 PML（Page Modification Logging）——更正：引入于 **Broadwell** Xeon（2015），非 Skylake

Linux 内核 KVM 维护者 Paolo Bonzini 的 4.x 合并窗口说明明确写道：「Support for PML (page modification logging, **a new feature in Broadwell Xeons** that speeds up dirty page tracking)」[^49^]；Intel 白皮书亦称 PML 为「Intel's Broadwell server platform」新特性 [^50^]。（注：任务背景中「Skylake 引入」应修正为 Broadwell-EP/EX，2015。）

**机制**：传统脏页跟踪靠写保护 EPT 页 + 写 fault 记脏（每次写一页都要 EPT violation，写密集负载开销大）。PML 建立在 EPT A/D 位硬件支持之上：VMCS 新增 64 位 PML Address（指向 4KB 对齐的 PML buffer，512 个 64 位条目）与 16 位 PML Index（初始 511，倒序写入）。当 CPU 在页表遍历中把某 EPT 项 Dirty 位从 0 置 1 时，自动将该页 GPA 写入 PML buffer 并递减 PML Index；buffer 满（512 条）触发 **page-modification log-full VM-exit**，VMM 批量回读并复位 index [^51^][^52^][^50^]。SDM 28.2.5 将 log-full 与 EPT violation/misconfiguration 并列为三类 EPT 引发的 VM-exit [^29^]。

KVM 实现：PML 是 per-vCPU（per-VMCS）的，启用时给每个 vCPU 分配 4KB PML 页并将物理地址写入 PML_ADDRESS；通过 secondary exec control bit 17（"Enable PML"）开关；非脏页跟踪时手动置 D 位避免无效日志；VM-exit 路径 flush PML buffer 到 dirty bitmap/ring [^50^][^53^][^54^]。

**学术评估**（arXiv 2001.09991，Xen 4.7 实测）：PML 无额外功耗开销；将 VM 热迁移/检查点时间最多缩短 **10.18%**；将迁移对应用性能的影响最多降低 0.95%；但 PML 只记录写访问（D 位），无法做准确的 WSS 估算（朴素扩展跟踪读会导致 VM 性能退化最高 34.8%）[^55^]。

### 5.3 证据

- **Claim**：PML 随 Broadwell Xeon 引入。
  **Source**：Linux kernel KVM pull request（Paolo Bonzini, 2015）；liujunming《Introduction to VT-x Page-Modification Logging》
  **URL**：https://gitlab.nic.cz/turris/linux/-/blob/994518799930fc363d47cb7cf0d1abed1790bf16/arch/arm64/kvm/sys_regs.c （含内核 pull 记录镜像）; http://liujunming.github.io/2022/03/02/Introduction-to-VT-x-Page-Modification-Logging/
  **Excerpt**：「Support for PML (page modification logging, a new feature in Broadwell Xeons that speeds up dirty page tracking)」「PML is a new feature on Intel's Broadwell server platform」
  **Confidence**：高（纠正背景中 Skylake 的说法）

- **Claim**：PML buffer 512 项、index 初始 511、满则 VM-exit；热迁移时间最多缩短 10.18%。
  **Source**：Teabe et al., *Intel Page Modification Logging, a hardware virtualization feature*（arXiv 2001.09991）
  **URL**：https://arxiv.org/pdf/2001.09991
  **Excerpt**：「The buffer is organized in 512 64-bit entries … the PML index is typically a value in the range 0-511 (starting from 511). … PML reduces by up to 10.18% both VM live migration and checkpointing time.」
  **Confidence**：高

---

## 6. 性能研究：EPT vs 影子页表

### 6.1 VMware 官方评估（2009，Nehalem Xeon X5560/X5570 + ESX）

- MMU 密集型微基准（segv/pcd/nps/fw）：EPT 比影子页表最高快 **600%**（fw fork 测试时间降至 0.14）；
- Apache 编译：4 vCPU 时 EPT 快 **48%**，且 vCPU 越多优势越大（8 vCPU 时 0.19 vs 0.37）；
- 总体结论：「EPT provides performance gains of up to 48% for MMU-intensive benchmarks and up to 600% for MMU-intensive microbenchmarks」；
- **例外**：SPECjbb2005（Java 堆 + GC 导致高 TLB miss）在小页下 EPT 反而慢（1 vCPU：0.87 vs 1.00），配合大页后恢复并反超（4.56 vs 4.03）[^56^]。

### 6.2 学术界的量化与「没有常胜将军」

- **ISCA'16 Agile Paging**（Gandhi et al.）：nested paging TLB miss 最多 24 次引用 vs shadow 4 次，但 shadow 的页表更新需 VMM 中介；两者权衡互补，故提出硬件动态切换的 Agile Paging [^19^]。
- **Selective hardware/software memory virtualization**（VEE'11, Wang et al.）：实测 HAP 与 SP 各有胜负，半数以上负载差距不显著，个别基准差距达 **34%**；提出按 TLB miss 与缺页率动态切换两种模式 [^57^]。
- **MICRO'14**：影子分页最坏慢 29.2%；nested/direct 模式最坏仅慢 7.3% [^10^]。
- **后续综述数据**（UChicago 论文综述）：2009 评估 EPT 全面占优（SPECjbb 例外）；2013 年分析发现 EPT 相对裸机仍有显著开销；2016 年两项研究分别得出「大 TLB/Cache 使 EPT TLB miss 影响不再严重」与「SPEC CPU2006 上 EPT 相对软件方案收益可忽略」——结论随微架构演进而变化 [^58^]。
- **VEE'21 (No)Compromis**：EPT 的 2D 页表遍历是其显著开销来源（24 vs 4 次），其分段式方案比影子分页/EPT 分别快最多 30%/370% [^20^]。
- **工作负载特征变化**：EPT 消除了 CR3 写/INVLPG/缺页类 VM-exit（社区教学示例：内核编译场景下内存操作 exit 从 ~320 万次降至 ~0，总 exit 只剩 I/O 与中断），代价是每次 TLB miss 更贵——瓶颈从「exit 频率」转移到「TLB 覆盖率」，大页与更大 TLB 成为关键 [^59^][^33^]。

### 6.3 证据

- **Claim**：EPT 对 MMU 密集基准最高快 48%、微基准最高 600%；SPECjbb2005 小页下例外变慢。
  **Source**：Nikhil Bhatia, *Performance Evaluation of Intel EPT Hardware Assist*, VMware, 2009
  **URL**：https://www.vmware.com/pdf/Perf_ESX_Intel-EPT-eval.pdf
  **Date**：2009（2008-2009 版权）
  **Excerpt**：「EPT provides performance gains of up to 48% for MMU-intensive benchmarks and up to 600% for MMU-intensive microbenchmarks.」「SPECjbb2005 … exhibits high TLB miss activity … Because EPT further increases the TLB miss latency, large page usage in the guest operating system is imperative」（1vCPU 小页：SW MMU 1.00 vs EPT 0.87）
  **Context**：硬件为 Nehalem Xeon X5560（双路四核），ESX 内部构建，对比 VT VMM（影子分页）与 EPT VMM。
  **Confidence**：高（一手 PDF 已核验原文与图表数据）

- **Claim**：HAP 与 SP 无绝对胜者，个别基准差距 34%。
  **Source**：Wang et al., *Selective hardware/software memory virtualization*, VEE 2011
  **URL**：https://www.scilit.com/publications/ba5ff9f76e3c2c47f4776dac04c7fdf4
  **Excerpt**：「neither hardware-assisted paging (HAP) nor shadow paging (SP) can be a definite winner … an up to 34% performance gap exists for a few benchmarks.」
  **Confidence**：高

---

## 7. 与 AMD NPT/RVI 的对应关系

| 维度 | Intel | AMD |
|---|---|---|
| SLAT 技术名 | EPT（Extended Page Tables） | NPT（Nested Page Tables），市场名 RVI（Rapid Virtualization Indexing） |
| 引入时间/平台 | Nehalem，2008（Core i7/Xeon 5500） | 第三代 Opteron「Barcelona」（K10），2007——比 Intel 早约一年 |
| 根指针 | EPTP（VMCS VM-execution 字段） | N_CR3（VMCB） |
| 二级缺页事件 | EPT violation / EPT misconfiguration（exit 48/49） | #VMEXIT(NPF)，EXITCODE=VMEXIT_NPF，EXITINFO1/2 |
| TLB 标签 | VPID（16 位，VMCS）+ INVVPID/INVEPT | ASID + INVLPGA/INVLPGB、TLB_CONTROL |
| 脏页跟踪 | EPT A/D 位 + PML（Broadwell） | NPT A/D 位 |
| 页大小 | 4KB/2MB/1GB | 4KB/2MB/1GB |

AMD 宣称嵌套分页相对影子页表最高提升 23%，且 vCPU 越多影子页表同步越糟、NPT 优势越明显 [^60^]。VMware 对两者分别有评估白皮书（EPT 2009 / RVI 2008）[^56^][^61^]。ARM 对应物为 Stage-2 页表 [^62^]。

### 证据

- **Claim**：AMD NPT/RVI 自 Barcelona 引入，早于 Intel EPT（Nehalem）；两者机制等价、术语不同。
  **Source**：Oracle VirtualBox Manual 3.7《Nested Paging and VPIDs》；kernullist《Hypervisor Cheats Part 2》对照表
  **URL**：https://docs.oracle.com/en/virtualization/virtualbox/6.0/admin/nestedpaging.html ; https://kernullist.github.io/kernullist-blog/posts/hypervisor-cheats-part-2-ept-npt-split-views-and-second-stage-fault-evidence/
  **Excerpt**：「On AMD processors, nested paging has been available starting with the Barcelona (K10) architecture. They now call it rapid virtualization indexing (RVI).」「second-stage root: EPTP in VMCS | N_CR3 in VMCB; event name: EPT violation or EPT misconfiguration | #VMEXIT(NPF)」
  **Confidence**：高

---

## 维度总结

1. **影子页表之慢，本质是「同步税」**：Guest 页表页被写保护，每次页表写、CR3 切换、INVLPG、影子项缺失都 VM-exit，VMM 要解码-同步-恢复；且每进程一套影子页表，内存与复杂度双高。MICRO'14 实测最坏慢 29.2%。
2. **EPT 把二级转换搬进硬件**：Guest 自管 GVA→GPA（#PF/CR3/INVLPG 不再 exit），VMM 只维护一张 EPT；EPTP 存于 VMCS（0x201A），低 12 位编码内存类型（WB=6）、遍历长度−1（4 级=3）、A/D 使能（bit 6）。
3. **最坏访存次数准确数字为 24 次**（4 Guest 项 + 4×4 EPT 遍历 + 4 最终 EPT 遍历；ISCA'16/VEE'21 一致），中文社区常说的「4+4×4=20」只算了 EPT 侧页表读取。
4. **EPT violation（48）与 misconfiguration（49）分工明确**：前者是权限/缺页拒绝（用于按需分配、MMIO、内存自省），后者是表项非法（hypervisor bug）；EXIT_QUALIFICATION 位 0-8 给出完整现场。
5. **VMFUNC 0 = EPTP switching**：Haswell 起，Guest 无 exit 切换最多 512 套 EPT 视图；启用 VPID 时不刷 TLB。
6. **VPID 是 16 位 TLB 标签**：VPID 0 归 VMM，每 vCPU 唯一；启用后 VMX 转换不再全刷 TLB；INVVPID 四型（0 地址级/1 单上下文/2 全上下文/3 保留全局），INVEPT 两型；Intel 实测 EPT+VPID 使 Nehalem vConsolidate 提升 25%。
7. **大页是 EPT 时代的必需品**：TLB miss 代价放大 6 倍，2MB/1GB 页直接减少 miss 率与遍历深度；VMware 实测 SPECjbb2005 小页下 EPT 反而慢、大页下反超。
8. **PML 引入于 Broadwell Xeon（2015，非 Skylake）**：512 项倒序写 PML buffer + D 位 0→1 自动记录 GPA + log-full VM-exit，替代写保护脏页跟踪，热迁移/检查点时间最多缩短 10.18%。
9. **性能格局**：VMware 2009 实测 EPT 对 MMU 密集负载最高 +48%/微基准 +600%；但学术共识是「无常胜者」——EPT 赢在消除 exit，影子页表赢在 TLB miss 便宜（4 vs 24 次），故学界发展出动态切换（VEE'11）、Agile Paging（ISCA'16）等混合方案。
10. **AMD 对应物**：NPT/RVI（Barcelona 2007，早于 EPT 一年），N_CR3↔EPTP、NPF↔EPT violation、ASID↔VPID、INVLPGA↔INVVPID。

### 关键事实勘误（相对任务背景）
- 背景「4+4×4=20 次」→ 学界准确口径为 **24 次总内存引用**（20 仅为 EPT 页表读取部分）。
- 背景「PML … Skylake 引入」→ Intel/KVM 一手资料均指 **Broadwell Xeon（2015）**。

---

## 引用来源

[^1^]: zxxyy.github.io, 《x86内存虚拟化–影子页表(Shadow Page Table)和拓展页表(EPT)》, 2023-08. https://zxxyy.github.io/posts/SPT-EPT/
[^2^]: CTF Wiki, 《内存虚拟化》. https://ctf-wiki.org/pwn/virtualization/basic-knowledge/mem-virtualization/
[^3^]: 博客园【重识云原生】计算第2.4节——主流虚拟化技术之KVM, 2022-11. https://www.cnblogs.com/kevin-jun-2022/p/16861568.html
[^4^]: onenoughtone.com, Hardware Virtualization Support, Page 3. https://www.onenoughtone.com/learn/hardware-virtualization-support/3
[^5^]: MIT PDOS 6.828, Virtual Machines lecture. https://pdos.csail.mit.edu/6.828/2010/lec/l-vm.html
[^6^]: 0voice/kernel_awsome_feature, 《KVM之内存虚拟化》, 2022-02. https://github.com/0voice/kernel_awsome_feature/blob/main/KVM%E4%B9%8B%E5%86%85%E5%AD%98%E8%99%9A%E6%8B%9F%E5%8C%96.md
[^7^]: owalle.com, 《KVM 虚拟化原理4--内存》, 2018-12. http://www.owalle.com/2018/12/10/kvm-memory/
[^8^]: 51CTO/CSDN, 《KVM影子页表和EPT页表的实现机制分析》, 2025-10. https://blog.csdn.net/tugouxp/article/details/154083835
[^9^]: 软件学报, 《RISC-V架构下的懒惰影子页表模型》, 2025. https://www.jos.org.cn/jos/article/abstract/7359
[^10^]: J. Gandhi, A. Basu, M. D. Hill, M. M. Swift, *Efficient Memory Virtualization*, MICRO 2014. https://pages.cs.wisc.edu/~swift/papers/micro14-virtualization.pdf
[^11^]: K. Adams, O. Agesen, *A Comparison of Software and Hardware Techniques for x86 Virtualization*, ASPLOS 2006. https://cdn.aminer.cn/html/B5/C5/48/B5C54857AB1201DA8F42C62B9E39.html
[^12^]: Cloud Atlas, 《Intel EPT技术架构》. https://cloud-atlas.readthedocs.io/zh_CN/latest/kvm/intel_vt/intel_ept/intel_ept_infra.html
[^13^]: 维基百科, 《Nehalem微架构》. https://zh.wikipedia.org/wiki/Nehalem%E5%BE%AE%E6%9E%B6%E6%9E%84
[^14^]: chip.retromuseum.org, 《Intel CPU 微架构的演进》. https://chip.retromuseum.org/evolution_of_intel_cpu_microarchitectures.html
[^15^]: 博客园, 《Intel虚拟化技术——EPT、VPID》, 2018-12. https://www.cnblogs.com/kelamoyujuzhen/p/10115845.html
[^16^]: 掘金/博客园【重识云原生】EPT 页表技术一节, 2022-11. https://juejin.cn/post/7161795570577719332
[^17^]: deepwiki cpu-internals, VMCS Structure and Fields. https://deepwiki.com/ayoubfaouzi/cpu-internals/4.1-vmcs-structure-and-fields
[^18^]: onenoughtone.com, Enabling EPT code sample（同 [^4^]）.
[^19^]: J. Gandhi, M. D. Hill, M. M. Swift, *Agile Paging: Exceeding the Best of Nested and Shadow Paging*, ISCA 2016. https://research.cs.wisc.edu/multifacet/papers/isca16_agile_paging.pdf
[^20^]: B. Teabe et al., *(No)Compromis: paging virtualization is not a fatality*, VEE 2021. http://sigplan.github.io/OpenTOC/vee21.html
[^21^]: zxxyy.github.io 博客（EPT 一节「5次查询EPT页表,每次4次内存访问,最坏20次」）; 同 [^1^].
[^22^]: CSDN 转述 AnandTech（Johan De Gelas）, 《Intel's EPT and AMD's NPT》. https://blog.csdn.net/hotsolaris/article/details/3603109
[^23^]: aarkegz.com, 《Intel VMX 场景下的EPT 与TLB》（基于 2025-03 版 SDM 30.4）, 2025-04. https://aarkegz.com/os/x86/ept-and-tlb-in-intel-vmx/
[^24^]: ChinaUnix 博客, 《Intel内存虚拟化技术分析》（引 Intel Manual 25.3）. http://blog.chinaunix.net/uid-9620812-id-4278881.html
[^25^]: 百度百科, 《Nehalem》. https://baike.baidu.com/item/Nehalem/10770925
[^26^]: RealWorldTech, *Inside Nehalem*, 2008-04. https://www.realworldtech.com/nehalem/8/
[^27^]: Linux KVM 源码（patchew 镜像，Bonizini MBEC/GMET 补丁中 VMX_EPT_*_BIT 定义）, 2026-05. https://patchew.org/linux/20260505195226.563317-1-pbonzini@redhat.com/
[^28^]: J. Nakajima, *Intel Update*, Xen Summit 2012. https://docs.huihoo.com/xen/summit/2012/aug28/10a-intel-update.pdf
[^29^]: Intel SDM Vol. 3C 28.2.3（xem.github.io 镜像）. https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1155.html
[^30^]: iwishi808.github.io, *EPT Internals: Understanding Intel's Second Layer of Paging*, 2026-05. https://iwishi808.github.io/2026/05/18/ept-internals/
[^31^]: NDSS slides, *Direct State Manipulation in Hybrid Virtual CPU Fuzzing*（VM-exit 原因表）. https://www.ndss-symposium.org/wp-content/uploads/s1763-andreas-slides.pdf
[^32^]: CSDN, VirtIO 前端通知机制（KVM 对 EPT violation/misconfiguration 的处理）, 2024-02. https://blog.csdn.net/qq_38350702/article/details/136238710
[^33^]: 《开源虚拟化KVM极速入门》书摘（wqxuetang 镜像）. https://wqxuetang.oss-cn-beijing.aliyuncs.com/upload/source/f5/f523b0adfbe07cc4f7609656c686a4ae
[^34^]: liujunming.github.io, 《深入理解intel vmfunc指令》, 2024-04. http://liujunming.github.io/2024/04/21/%E6%B7%B1%E5%85%A5%E7%90%86%E8%A7%A3intel-vmfunc%E6%8C%87%E4%BB%A4/
[^35^]: US Patent 11,868,792（VMFUNC EAX=0, ECX=n, 512 EPTP list 描述）. https://patents.justia.com/patent/11868792
[^36^]: kernullist.github.io, *About Hypervisor Cheats, Part 1*, 2026-06. https://kernullist.github.io/kernullist-blog/posts/hypervisor-cheats-part-1-ring-1-vmx-svm-control-state-ownership/
[^37^]: Intel SDM Vol. 3C 27.5.6.3 EPTP Switching（经 [^23^] 与 [^34^] 转述核验）.
[^38^]: Intel, *Extending KVM with new Intel Virtualization technology*, KVM Forum 2008. https://www.linux-kvm.org/images/c/c7/KvmForum2008%24kdf2008_11.pdf
[^39^]: Intel Technology Journal, Vol. 14 Iss. 3, 2010（VPID 架构扩展一节）. https://www.intel.com/content/dam/www/public/us/en/documents/research/2010-vol14-iss-3-intel-technology-journal.pdf
[^40^]: CSDN, 《虚拟化ABC - 内存虚拟化》. https://blog.csdn.net/defeattroy/article/details/9000425
[^41^]: websec.net, *Ophion: Building a Stealth Intel VT-x Hypervisor for Windows*（INVVPID 类型使用实践）, 2026-03. https://websec.net/blog/ophion-building-a-stealth-intel-vt-x-hypervisor-for-windows-69b62daa7462693131828c97
[^42^]: 51CTO/CSDN, Intel内存虚拟化技术分析（同 [^24^]）.
[^43^]: felixcloutier.com, INVVPID — Invalidate Translations Based on VPID. https://www.felixcloutier.com/x86/invvpid
[^44^]: Intel SDM Vol. 3C（xem.github.io 镜像，INVEPT/INVVPID 类型定义页）. https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1164.html
[^45^]: CSDN, 《EPT学习记录》（SDM 28.3.3.3 INVVPID 使用指南中译）, 2019-11. https://blog.csdn.net/bruce_lee_r/article/details/102810300
[^46^]: secret.club, *Hypervisors for Memory Introspection and Reverse Engineering*, 2025-06. https://secret.club/2025/06/02/hypervisors-for-memory-introspection-and-reverse-engineering.html
[^47^]: VMware, *Virtualizing Performance-Critical Database Applications in VMware vSphere 4.0*, 2009. https://www.vmware.com/pdf/Perf_ESX40_Oracle-eval.pdf
[^48^]: docs.kernel.org, The Definitive KVM API Documentation（KVM_SET_USER_MEMORY_REGION）. https://docs.kernel.org/virt/kvm/api.html
[^49^]: Linux kernel KVM pull request, 2015（Turris GitLab 镜像）. https://gitlab.nic.cz/turris/linux/-/blob/994518799930fc363d47cb7cf0d1abed1790bf16/arch/arm64/kvm/sys_regs.c
[^50^]: liujunming.github.io, *Introduction to VT-x Page-Modification Logging*, 2022-03. http://liujunming.github.io/2022/03/02/Introduction-to-VT-x-Page-Modification-Logging/
[^51^]: arXiv 2209.13111, *HMM-V: Heterogeneous Memory Management for Virtualization*, 2022-09. https://arxiv.org/html/2209.13111v1
[^52^]: arXiv 2202.13483, *Out of Hypervisor (OoH)*, 2021-11. https://arxiv.org/html/2202.13483v1
[^53^]: puqiyuan.github.io, 《QEMU热迁移机制》, 2025-02. https://puqiyuan.github.io/github.io/kernel/virt/live-migration.html
[^54^]: LKML, *KVM: VMX: read the PML log in the same order as it was written*, 2024-12. https://lkml.org/lkml/2024/12/19/1496
[^55^]: B. Teabe et al., *Intel Page Modification Logging, a hardware virtualization feature: study and improvement*, arXiv 2001.09991. https://arxiv.org/pdf/2001.09991
[^56^]: N. Bhatia, *Performance Evaluation of Intel EPT Hardware Assist*, VMware, 2009. https://www.vmware.com/pdf/Perf_ESX_Intel-EPT-eval.pdf
[^57^]: X. Wang et al., *Selective hardware/software memory virtualization*, VEE 2011. https://www.scilit.com/publications/ba5ff9f76e3c2c47f4776dac04c7fdf4
[^58^]: X. Tong, UChicago 博士论文（SLAT 评估综述一节）. https://knowledge.uchicago.edu/record/2562/files/Tong_uchicago_0330D_15330.pdf
[^59^]: onenoughtone.com, 内核编译场景 exit 统计示例（同 [^4^]，教学性质数据，供量级参考）.
[^60^]: AnandTech（Johan De Gelas）转述, AMD nested paging 最高 23%（同 [^22^]）.
[^61^]: VMware, *Performance Evaluation of AMD RVI Hardware Assist*. http://www.vmware.com/pdf/RVI_performance.pdf
[^62^]: Rayanfam / Cloud Atlas, SLAT 综述（ARM Stage-2 对应）. https://rayanfam.com/topics/hypervisor-from-scratch-part-4/
