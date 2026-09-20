---
name: intel-vt
description: >
  英特尔虚拟化技术（Intel Virtualization Technology）领域专家知识库，基于覆盖 13 个技术维度、
  260+ 次检索、经交叉验证的深度研究构建（数据截至 2026-09-16）。
  Use this skill whenever 涉及 Intel VT/VT-x/VMX 的技术问答、文档或报告撰写、hypervisor/VMCS/EPT 代码
  编写与审查、虚拟化性能分析、虚拟化安全分析（VM escape、侧信道、VBS）、Intel TDX 机密计算、
  VT-d/IOMMU/设备直通、KVM/Xen/VMware/Hyper-V 虚拟化机制、嵌套虚拟化，以及 Intel 与 AMD-V/ARM/RISC-V
  虚拟化技术对比。触发词示例：VT-x、VMX、VMCS、VM-Exit、EPT、VPID、VT-d、SR-IOV、APICv、
  posted interrupt、TDX、机密计算、hypervisor、虚拟机逃逸、虚拟化开销、Vanderpool。
  Do NOT use for: 与 Intel 虚拟化无关的通用虚拟化概念科普（如 Java JVM、Docker 基础），或纯 AMD/ARM
  平台且不涉及与 Intel 对比的问题。
---

# Intel VT 领域专家知识库

## 这是什么

一套经过多智能体深度研究与交叉验证的 Intel 虚拟化技术知识库，覆盖 13 个维度：演进史、VMX 架构、EPT/VPID、VT-d、APICv、性能量化、安全攻防、TDX 机密计算、软件生态、云应用、嵌套虚拟化、AMD-V 对比、2022-2026 最新动态。

**时效基准：2026-09-16。** 涉及"最新/当前"表述时以此为准；若用户问题明显需要更新数据（如之后发布的产品），先检索再回答，并沿用本库的事实核查标准。

## 使用方法（三级渐进阅读）

1. **先读 `references/core-facts.md`** —— 13 维度蒸馏事实速查。大多数问答、综述、代码注释需求到此即可解决。
2. **需要原始出处、原文摘录、完整证据链时**，按下表读对应维度文件（含 Claim/Source/URL/Date/Excerpt/Confidence 结构化证据）。
3. **动笔前必查 `references/errata.md`** —— 经交叉验证的常见讹传勘误（如 MBEC=Kaby Lake、PML=Broadwell、EPT 最坏 24 次访存、OoH=SC'22、AWS 嵌套虚拟化=2026-02、Azure DCesv5 为预览非 GA），不得沿用讹传口径。

## 问题 → 维度文件路由表

| 用户意图 | 读取文件 |
|---------|---------|
| 历史、Vanderpool、演进时间线、x86 虚拟化理论 | `references/intel_vt_dim01.md` |
| VMX root/non-root、VMCS 字段、VM-entry/exit、VMX 指令、hypervisor 代码 | `references/intel_vt_dim02.md` |
| EPT、VPID、影子页表、内存虚拟化、PML | `references/intel_vt_dim03.md` |
| VT-d、IOMMU、DMA/中断重映射、SR-IOV、SIOV、设备直通、GPU 直通 | `references/intel_vt_dim04.md` |
| APICv、posted interrupt、IPI virtualization、FlexPriority | `references/intel_vt_dim05.md` |
| 虚拟化开销、性能数据、benchmark、缓解措施代价 | `references/intel_vt_dim06.md` |
| VM escape、Blue Pill、L1TF/MDS、VBS、TXT、虚拟化安全 | `references/intel_vt_dim07.md` |
| TDX、SEAM、远程证明、机密计算、SEV-SNP 对比、云厂商机密 VM | `references/intel_vt_dim08.md` |
| KVM/QEMU/Xen/VMware/Hyper-V/Firecracker 对 VT 的使用 | `references/intel_vt_dim09.md` |
| AWS/Azure/GCP/阿里云底层、实时迁移、NFV、GPU 云、市场数据 | `references/intel_vt_dim10.md` |
| 嵌套虚拟化、OoH、Dune、SeKVM、学术研究 | `references/intel_vt_dim11.md` |
| Intel vs AMD-V vs ARM vs RISC-V 对比、市场份额 | `references/intel_vt_dim12.md` |
| Xeon 6、Clearwater Forest、Panther Lake、VMX 新特性、Linux 内核合入动态 | `references/intel_vt_dim13.md` |

## 输出标准

- **有据可查**：关键事实标注来源（维度文件内含 URL/日期/原文摘录）；区分「已 GA」「官方宣布」「单方宣称」「传闻」。
- **引用外部可复核**：关键事实（日期、GA/预览状态、性能数字、CVE 编号）须回溯维度文件中记录的原始来源（来源名 + 日期，关键处附 URL）；「dimNN §x」等内部编号仅作辅助定位，不得作为唯一出处。
- **时效敏感事实警示**：云厂商产品 GA/预览状态、价格、市场份额、内核合入状态是衰减最快、二手来源最易记错的类别；结论依赖其准确性时，应提示用户以官方来源二次核验；知识库标注与官方来源冲突时以官方为准。
- **知识边界显式化**：知识库未收录的事实用外部检索补齐时，须显式标注「本知识库未收录」并给出来源与权威性评估。
- **数字带条件**：性能数字必须附带测试条件（微架构、负载、测量口径），不同来源冲突时并列呈现而非取平均。
- **置信度透明**：维度文件中 Confidence=low 或存在分歧的事实，输出时必须显式标注。
- **勘误优先**：与 `references/errata.md` 冲突的常见说法，一律按勘误口径。
- 涉及代码（VMX 启用、VMCS 操作、EPT 构建）时，字段编码与控制位以 dim02/dim03 中经 Intel SDM 核验的清单为准。

## 知识库局限（如实告知用户）

- 无 2026-09-16 之后的数据；TDX Connect 端到端 GA、Diamond Rapids TDX 计划等当时未定事项标注为"未官宣/未披露"。
- 维度文件为研究证据档案（含原始摘录），不是成稿报告；需要成稿时自行组织叙述。
