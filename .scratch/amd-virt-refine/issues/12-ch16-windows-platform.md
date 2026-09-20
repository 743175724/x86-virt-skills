# 12 · `16-windows-platform.md`（**只写 AMD delta，不镜像 `intel-vt/17`**）

Status: ready-for-agent
Type: task
Blocked by: 01, 02, 03
Bibliography ID 区段: **460–499**
Spec: `.scratch/amd-virt-refine/spec.md` §D9, §D12 · 复检记录 §5

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** Microsoft Learn + Hypervisor Top-Level Functional Specification（**Tier-2**：对 Windows 行为是权威的，但不是 AMD 规范）。

**Owns:** AMD 平台上 Windows 虚拟化栈的**差异部分** —— 谁占据 SVM · `hvax64.exe` · VBS/HVCI 的 AMD 硬件前提 · Kernel DMA Protection 走 AMD-Vi · AMD 上的嵌套 · WHP 共存 · AM4/AM5 固件项 · DDA vs GPU-P · 客户端有 TSME 没有 SEV。

## 本票在复检后改变了方向——先读这一段

初稿要求写一章完整的 Windows 平台内容。复检（线程 D）逐行比对后发现：**`intel-vt/17-windows-platform.md` 已经存在，且其中约 75% 是厂商无关的 Windows 事实**——分区模型、hypercall ABI、`0x40000000`/`0x40000001` MSR、SynIC MSR 全表、VMBus 环、VTL、调度器、enlightenment 列表、WHP 的 API 面与双重退出代价、WSL2/Sandbox/Docker/Application Guard、HVCI 的页级行为、症状表、与 KVM/QEMU/Xen/ESXi 的对照。

照初稿写，等于制造第二份会各自漂移的副本——**这正是本次重构要消灭的那类缺陷**。

**改为：本章只承载 AMD delta。** 但有一条复检没有权衡到的约束必须遵守：

> **跨技能交叉引用会在"用户只装了 `amd-virtualization`"时悬空。** 因此本章对**它自己必须回答的问题**保持自足——每条 AMD delta 连同必要的一两句背景写全，读者不跳转也能得到可用答案；只把**深度**（完整 synthetic MSR 表、VMBus 环结构、调度器细节、enlightenment 全表）交叉引用到 `intel-vt/17`。判据：把 `intel-vt` 整个删掉，本章仍能回答评测集里那 12 道 Windows 题。

## 必须交付（AMD delta，约 12 条）

1. **谁占据 SVM（本章的核心事实）**：一旦启用 VBS / 内存完整性 / WSL2 / Windows Sandbox / Docker Desktop / Hyper-V 角色，**Windows hypervisor 持有 `EFER.SVME`**，Windows 内核以 VTL0 guest 身份运行，第三方 VMM 只能经 **WHP** 嵌套运行。
   - 注意 `intel-vt/17` 把这条规则表述为 *"the software that executed VMXON"*——**那是 VMX 专属机制**。AMD 上是"谁设置了 `EFER.SVME`"，且固件可经 `VM_CR.SVMDIS`/`LOCK` 抢先。本章给 AMD 的正确表述。
2. **`hvax64.exe`**（`hvix64` = Intel、`hvaa64` = Arm64）与启动链 `winload.efi` → `hvloader.dll` → `hvboot.sys`；VTL0 `ntoskrnl` / VTL1 `securekernel.exe`；`bcdedit /set hypervisorlaunchtype auto|off`。**全库与 `intel-vt` 目前对 `hvax64` 都是零命中**——这条事实在两个技能里都不存在。
3. **`01-svm-intro.md` 的探测链在 Windows 上会给错答案**：CPUID → `VM_CR.SVMDIS` → `EFER.SVME` 这条链在一台开了 VBS 的机器上全部"正常"，而 VMM 仍然起不来。本章给出正确的判定顺序，并被 `01` 交叉引用。
4. **VBS / HVCI / Credential Guard 的 AMD 硬件前提**：AMD-V + **NPT/RVI（SLAT，硬性，`Fn8000_000A EDX[0]`）** + AMD-Vi；HVCI 的 W^X 依赖 **GMET**（`Fn8000_000A EDX[17]`，交叉引用 `06`）。**必须引 Microsoft Learn**，不引 ZDNet / Dell KB / 整机厂博客。同时明确：**它们不依赖 SEV**（交叉引用 `11`）。
5. **Kernel DMA Protection 在 AMD 主机上走 AMD-Vi/IVRS**。`intel-vt/17:205-208` 写的是 *"The hardware underneath is Intel VT-d"*——**对 AMD 读者是错的**，照读会得出"这是 Intel 独有功能"的结论。本章给 AMD 侧：预启动 DMA 保护、`DmaRemappingCompatible` 驱动 INF 标志、Thunderbolt/USB4 外部端口、登录前阻止新外接设备，以及**为什么消费级 AM5 主板开了 IOMMU 仍可能显示 Off**。
6. **AMD 上的嵌套虚拟化受支持**：Windows Server 2022 / Windows 11 起，`Set-VMProcessor -ExposeVirtualizationExtensions $true`。旧版第 12 章矩阵在这一格填 `—`（错，见 errata）。机制归 `15`，本章给 Windows 侧的开启方式与前置条件。
7. **AMD 没有 eVMCS。** `intel-vt/17:62-66` 描述的 enlightened VMCS 是 VP assist page 里一个 VMCS 形状的结构，**Intel 专属**——AMD 的 VMCB 本来就是普通内存，不需要也不存在对应物。必须显式写出来，否则容易被当成可以照搬的机制。
8. **WHP 与 VBS 共存**：自 VMware Workstation 15.5.5 / VirtualBox 6.1 起，第三方 VMM 可在 VBS 开启时经 WHP 运行，**不必关掉 Hyper-V**（旧版以 `hypervisorlaunchtype off` 开篇，是过时口径，见 errata）。性能代价归 `18`。
9. **消费级 AM4/AM5 平台事实**：AMD-Vi 在所有 AM4/AM5 SoC 上都存在（与芯片组无关）；BIOS 中 `SVM Mode` 与 `AMD CBS → NBIO → IOMMU` 的路径与 Auto/Enabled 差异；与 Above 4G Decoding / ReBAR 的交互。
10. **设备直通**：**DDA 需要 Windows Server，客户端 Windows 10/11 不提供**（`Add-VMAssignableDevice` / `Dismount-VMHostAssignableDevice` / `SurveyDDA.ps1`）；客户端能用的是 **GPU-P / GPU 分区**（WSLg、Windows Sandbox、WDDM 半虚拟化 GPU）。并说明 "IOMMU groups" 是 Linux/VFIO 的内核构造，Windows 侧对应的是 PCI location path + ACS 勘察。
11. **hypervisor 存在性检测与反作弊**：`CPUID.1:ECX[31]`、`CPUID 0x40000000`（Hyper-V 返回 `Microsoft Hv`）与游戏/反作弊的关系。
12. **Windows 侧诊断手段**：`msinfo32`（VBS 状态、Kernel DMA Protection）、`Get-ComputerInfo`、Hyper-V 事件日志、`systeminfo` 的 Hyper-V 要求行、`Get-VMHostAssignableDevice`。旧库的诊断清一色是 `dmesg`/`lspci`/`/sys`/`cpuid`，在 Windows 上不存在。

13. **Linux-only 对照小节**（末尾，明确标注）：`amd_iommu` 内核参数、`/sys/kernel/iommu_groups`、vfio-pci、vendor-reset。
14. Open items。

## 与 `intel-vt/17` 的边界（写进本章的 `See also:`）

交叉引用过去、**不复述**：分区模型与 VTL 细节 · hypercall ABI 与 synthetic MSR 全表 · SynIC · VMBus · 调度器 · enlightenment 全表 · WHP 的完整 API 面 · WSL2/Sandbox/Docker 的内部结构 · HVCI 的页级机制 · 与 KVM/Xen/ESXi 的对照。

`intel-vt/17` 侧需要的对称修改（把 Intel 专属措辞中立化、补 `See also:`）在**票 19**，该票 `needs-info`，**未获批准前本章不得假设对面已经改好**——本章的表述必须在对面不动的前提下依然正确。

## 完成判据

- lint 零 error；本章所有 Windows 事实引用 Microsoft Learn 或 Hypervisor TLFS，无 ZDNet / 整机厂博客 / 论坛。
- **自足性检验**：假设 `intel-vt` 不存在，本章仍能回答评测集的 12 道 Windows 题。
- 本章不出现 `intel-vt/17` 已有的厂商无关内容的复述（抽查 synthetic MSR、VMBus、调度器三处）。
- SKILL.md 的 "The Windows fact that resolves most questions" 段与本章 §1 一致。
