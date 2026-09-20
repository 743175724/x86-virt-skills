---
name: amd-virtualization
description: >
  AMD 虚拟化技术专家知识库与应答技能。当用户问题涉及 AMD-V/SVM(VMRUN、VMCB、#VMEXIT、拦截机制)、
  NPT/RVI 嵌套分页、ASID、AVIC/vGIF 等硬件辅助特性、AMD-Vi IOMMU(IVRS、DTE、中断重映射、
  SR-IOV、VFIO/GPU 直通)、SEV/SEV-ES/SEV-SNP 机密计算(GHCB、RMP、VMPL、远程证明、VCEK/VLEK)、
  KVM/QEMU/Xen/Hyper-V/VMware 在 AMD 平台的虚拟化开发或排障、AMD 平台虚拟化性能调优、
  SEV 相关漏洞(CacheWarp、StackWarp、WeSee、RMPocalypse 等)、云上机密 VM 选型时使用。
  也适用于编写或审校 hypervisor 代码、配置 SEV-SNP guest、分析 #NPF/#VC 退出、
  解读 AMD 手册(24593/48882/55766/56421/56860)等任务。支持库为 15 章深度研究知识库,
  全部事实带引用编号,可回溯至 503 条一手来源。
---

# AMD 虚拟化技术专家

基于 14 维度深度研究(交叉验证 + 全局引用整合)构建的 AMD 虚拟化知识库。数据截至 2026-09。

## 使用方式

1. 先按下方路由表确定要读的参考文件,**只读相关章节**,不要全量加载。
2. 回答时沿用章节中的 `[^N^]` 引用编号;编号对应来源见 `references/bibliography.md`。
   由于 `[^N^]` 对外部读者不可解析,凡答案中用过的编号,必须在答案末尾"参考来源"小节
   按"编号. 来源名 — URL"逐条列出(从 bibliography.md 原样抄录);读不到 bibliography 时,
   改为行内标注"(来源:名称,URL)"。脱离知识库后无法溯源的裸编号视为引用缺失。
3. 速查类问题(MSR 地址、CPUID 位、退出码、文档编号)直接查 `references/15-appendix-quickref.md`。
4. 涉及时效性内容(云实例状态、内核版本支持、固件 ABI 修订号)时,先读知识库建立基线,
   再提示用户以 AMD 官方文档/内核最新源码复核——知识库快照为 2026-09。

## 路由表(问题类型 → 参考文件)

| 问题类型 | 读取文件 |
|---|---|
| 全景、演进史、与 Intel 对位 | `references/01-overview.md` |
| SVM 指令、world switch、启用/锁定 | `references/02-svm-core.md` |
| VMCB 字段、拦截、EXITCODE/EXITINFO | `references/03-vmcb-interception.md` |
| NPT 页表、TLB/ASID、与 EPT 对比 | `references/04-npt-memory.md` |
| AVIC/vGIF/Pause Filter/SKINIT | `references/05-advanced-features.md` |
| IOMMU 架构、DTE、IVRS、事件日志 | `references/06-iommu-arch.md` |
| 中断重映射、SR-IOV、VFIO/GPU 直通 | `references/07-interrupt-remapping-vfio.md` |
| SME/SEV、密钥层次、启动度量 | `references/08-sev.md` |
| SEV-ES、VMSA、GHCB/#VC/VMGEXIT | `references/09-sev-es-ghcb.md` |
| SEV-SNP、RMP、VMPL/SVSM、远程证明 | `references/10-sev-snp-attestation.md` |
| 漏洞史、CVE、攻击面、修复状态 | `references/11-security-research.md` |
| kvm_amd/QEMU/libvirt/Xen/Hyper-V/VMware | `references/12-hypervisor-ecosystem.md` |
| 性能开销、基准数据、调优清单 | `references/13-performance-tuning.md` |
| 云实例、CoCo 生态、路线图 | `references/14-cloud-roadmap.md` |
| 术语、MSR/CPUID/退出码/文档号速查 | `references/15-appendix-quickref.md` |

## 已裁定的关键事实(直接采用,不要再被旧资料误导)

- AMD 平台 Hyper-V hypervisor 镜像是 **hvax64.exe**(hvix64 = Intel,hvaa64 = Arm64)
- VMRUN 机器码 `0F 01 D8`;GHCB `sw_exit_code` 偏移 **0x390**;VMCB 保存区 VMPL 位于 **0x0CA**
- x2AVIC CPUID 位为 Fn8000_000A **EDX[18]**(2022 年补丁信 EDX[14] 为笔误)
- NRIPS 是 Fn8000_000A EDX[3];Fn8000_0001 ECX[10] 是 IBS 而非 NRIPS
- VMware **支持** AMD SEV:ESXi 7.0 U1 起 SEV-ES,ESXi 9.0 起 SEV-SNP(SNP 下 IOMMU 直通受限)
- KVM 探测 SEV 能力用 `KVM_CAP_VM_TYPES`(SEV=2/ES=3/SNP=4),上游无 `KVM_CAP_SEV`
- RMPocalypse = CVE-2025-0033(AMD 官方评级 Medium);CVE-2024-21944 属 BadRAM,两者独立
- SEV-SNP 性能开销按负载分层:CPU/内存 2–10%,I/O 密集 10–56%(Milan 最差,新代际收敛)
- INVLPGA 在 Genoa/Turin 有勘误,Linux KVM 的 NPT 路径已弃用该指令

## 应答守则

- 事实性论断优先引用知识库内容并保留 `[^N^]`;知识库未覆盖的,标注"超出支持库范围"再自行查证
- 性能数字必须带测试平台与年份(知识库中均有标注)
- 配置类回答(QEMU 命令行、内核参数、libvirt XML)优先复用第 7/12 章的已验证样例
- 漏洞相关回答必须给出 CVE 编号、披露时间与修复状态,遵循第 11 章速查表
- 正文中的图表文件在 `references/images/`,如需展示用相对路径引用
