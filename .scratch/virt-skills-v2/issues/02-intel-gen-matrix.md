# 02 Intel 10 代 → Core Ultra 300：虚拟化相关的世代差异与勘误源

Type: research
Status: claimed
Blocked by: —

## Question

现有 `intel-vt` 技能的客户端硅片覆盖是**两条 claim**（`90-dated-landscape.md:101-104`）。
Comet Lake / Rocket Lake / Alder Lake / Raptor Lake / Meteor Lake / Lunar Lake / Arrow Lake
这些代号在全库命中 **0 次**；Gracemont / Crestmont / Skymont / Redwood Cove / Lion Cove /
Thread Director 同样 **0 次**；"Hyper-Threading" 全库出现 1 次，还是 2010 年 i7-920 的测试环境描述。

**需要为 10 代到 Core Ultra 300（含）建立一份虚拟化相关的世代差异清单，逐条带规范来源。**

必须覆盖的维度：

1. **CPUID DisplayFamily / DisplayModel / Stepping**：每代客户端部件的编码。
   来源应为 SDM Vol.4 或 Intel 官方 Specification Update，不要用二手表格。
2. **混合拓扑**：CPUID leaf `1Ah`（Hybrid Information）的语义；
   12 代起 P 核 / E 核在 **VMX 能力 MSR**（`IA32_VMX_*`）上是否存在不一致；
   已知的 AVX-512 特性交集处理（微码 / BIOS 把 CPUID 压成交集）对 hypervisor 意味着什么。
   **已知事实**：ESXi 在 12 代及以后默认 PSOD，报 "Fatal CPU mismatch on feature"。
   查清这是 ESXi 的假设问题还是硅片确实不一致——两者的修法完全不同。
3. **超线程取消**：Core Ultra 200S / Arrow Lake 与 Lunar Lake 的 SMT 状态；
   对"按逻辑处理器初始化 VMXON 区域"这类代码意味着什么。
4. **微码作为行为变量**：13/14 代 Vmin Shift Instability 的微码 0x12B（2024-09）与后续 0x12F。
   查清：微码版本会不会改变 VMX / CPUID 可见行为？hypervisor 运行中遇到微码更新该怎么办
   （`IA32_BIOS_UPDT_TRIG` / MSR 0x79 与 VMX 开启状态的交互，SDM 怎么说）？
5. **勘误通道**：每代客户端部件的 Specification Update 文档编号在哪里、怎么取。
   现有 bibliography 只有一个裸 `https://edc.intel.com` 指针（`bibliography.md:38`），没有抽取内容。
6. **VT-d / IOMMU 平台侧**：LGA1700 到 LGA1851 的 DMAR / 拓扑差异；
   KF 型号无核显对直通与 SR-IOV 场景的影响。

## 边界

- **只做客户端**。Xeon / 服务器部件在本图的 Out of scope。
- **不要写章节**。本 ticket 产出的是"有哪些差异 + 权威来源在哪"，不是成稿内容。
- 沿用本仓库的证据纪律：**负面声明（"某代没有 X"）需要与正面声明同等的证据，
  并且必须限定到具体文档与版本**。查不到就声明缺口，不要推断。

## 交付物

`.scratch/virt-skills-v2/research/02-intel-gen-matrix.md`：
按代 × 维度的矩阵 + 每条的来源（文档编号 + 章节）+ 一份"查不到"的缺口清单。
