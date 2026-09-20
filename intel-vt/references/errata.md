# Intel VT 常见讹传与勘误表（深度研究交叉验证结论）

> 使用本技能回答或写作时，以下条目**必须**按勘误后的口径表述。每条均经 ≥2 独立来源或一手文献核验，完整证据链见对应维度文件。

| # | 常见讹传 | 勘误后事实 | 证据位置 |
|---|---------|-----------|---------|
| 1 | MBEC 随 Skylake 引入 | MBEC（Mode-Based Execute Control）随 **Kaby Lake（7 代酷睿，2016-17）** 引入 | dim01 |
| 2 | PML 随 Skylake 引入 | PML（Page Modification Logging）随 **Broadwell Xeon（2015）** 引入 | dim03 |
| 3 | EPT 地址转换最坏 20 次内存访问 | 最坏 **24 次**（4 Guest 页表项 + 4×4 EPT 遍历 + 4 最终转换，ISCA'16/VEE'21 口径）；"20 次"只算了 EPT 页表读 | dim03/dim06 |
| 4 | OoH 发表于 SOSP'22 | OoH（Out of Hypervisor）正式发表于 **SC'22（IEEE 超算会议，2022-11）**，arXiv 2202.13483 为预印本 | dim11 |
| 5 | AWS 2023 年支持虚拟化实例嵌套虚拟化 | AWS 虚拟化（非裸金属）实例嵌套虚拟化为 **2026-02**（C8i/M8i/R8i，`NestedVirtualization=enabled`）；此前仅裸金属 | dim11 |
| 6 | VMFUNC 明确归属某一代 | 有分歧：ISA 定义在 Haswell 时代 vs 硬件可用常归 Skylake；引用时双口径标注 | dim01/dim03 |
| 7 | 中断重映射 erratum 是 AMD 的问题 | 有据可查的 erratum 在 **Intel 侧**（5520/5500 erratum #53，2013 内核 quirk）；AMD 痛点是早期 IOMMU 无中断重映射能力及 Zen3 前 IOMMU 不支持 AVIC | dim12 |
| 8 | AMD AVIC 与 Intel APICv 同期可用 | APICv 2013 年落地并默认启用；AVIC 因 erratum #1235 长期默认关闭，2025-06 上游才推进 Zen4+ 默认开启 | dim05/dim12 |
| 9 | VM-exit 成本只有一个数字 | 须区分「裸转换成本」（数百~两千 cycles）与「含 hypervisor 处理的端到端成本」（~3900 cycles 均值，I/O 类上万）；引用必须带测试条件与微架构 | dim05/dim06 |
| 10 | 云厂商"零损耗/<5%"为第三方结论 | 多为厂商官方宣传口径，缺第三方基准复核；引用时须标注"官方宣称" | dim10 |
| 11 | 逃逸 CVE 是 VT 硬件缺陷 | 重大 VM escape CVE（VENOM 等）全在 **VMM 软件层**（设备模拟），非 VT-x 硬件缺陷；硬件层问题以侧信道（L1TF/MDS）形态出现 | dim07 |
| 12 | SGX 已被 TDX 取代 | 客户端 SGX 已移除（12 代酷睿起），但服务器至强保留 SGX，且 TDX 证明链依赖 SGX Quoting Enclave，两者共生 | dim08/dim13 |
| 13 | 阿里云神龙比 AWS Nitro 早一个月（事实） | 为阿里单方叙事，无独立佐证；引用时标注"单方宣称" | dim10 |
| 14 | TDX Connect/TEE-IO 已 GA | Granite Rapids 2025-02 硬件就绪，SPDM+IDE+TDISP 全栈使能中，**端到端 GA 时间未官宣** | dim08/dim13 |
| 15 | Azure DCesv5/ECesv5 已于 2023-12 GA | 2023-11-15 宣布 **public preview**、2023-12-07 可部署（仍为预览）；Azure 首个 TDX GA 是 DCesv6/DCedsv6/ECesv6/ECedsv6（Emerald Rapids + OpenHCL paravisor），**2026-02-26** 宣布。教训：云产品 GA/预览状态是时效最敏感、最易经二手来源记错的事实类别 | dim08 |
