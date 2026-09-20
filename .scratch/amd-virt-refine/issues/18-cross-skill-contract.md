# 18 · 跨技能契约：消歧路由 + 事实所有权 + 镜像章分工

Status: ready-for-agent
Type: task
Blocked by: 16
Spec: `.scratch/amd-virt-refine/spec.md` §D5, §D12
来源: 复检线程 D（`intel-vt` 与 `amd-virtualization` 的交叉矛盾扫描）

## 为什么需要这一票

复检发现：两个技能的消歧规则**在散文层面是互补的，但在检索层面是漏的**，而且 `intel-vt/18-comparison-amd-arm-riscv.md` 的头部写着 `**Owns:** all AMD / ARM / RISC-V architectural facts in this skill`——与本 spec 的 D5 归属表在同一批事实上重叠。不处理的话，重建后的 AMD 技能会与已完成的 Intel 技能在约 20 组事实上各持一份副本。

**好消息（复检确认）**：`intel-vt` **没有复现 AMD 侧 20 条已确证错误中的任何一条**——它的 VMLOAD/VMSAVE 字段表正确地不含 SS，`#VMEXIT` 描述没有犯"只恢复三个寄存器"的错，退出码分段规则正确，24 次访存与 D7 一致，也没有 `RemapEm` / `CmdBufRun` / 14 KiB / NPF 位号 / CVE-2024-25744 这些错误。**风险只在所有权、来源分级与重复，不在事实本身。**

## 1. 检索层的消歧漏洞（必须修）

`intel-vt` 的 `description` 里列了 `Hyper-V, VBS, HVCI, WSL2, Kernel DMA Protection, nested virtualization, IOMMU, hypervisor` 这些**不带厂商限定**的触发词。于是"我的 Ryzen 在 Hyper-V 下能不能嵌套"这类问题**在检索阶段就选中了 intel-vt**——写在正文里的消歧散文根本没机会被读到。AMD 技能的 description（D11）会列出同一批词，冲突对称。

修法：两个 `description` 各加一组**否定标记**。

- `intel-vt`：加 `Do NOT use for AMD-primary questions even when phrased in Windows terms — AMD-V, SVM, VMCB, Ryzen, EPYC, SEV, hvax64 belong to amd-virtualization.`
- `amd-virtualization`：镜像加 `Intel, VT-x, VMCS, EPT, VT-d, TDX → intel-vt.`

## 2. 两边 SKILL.md 的 Scope boundaries 改写（逐字采用）

`intel-vt/SKILL.md` 的 Scope boundaries 第一条替换为：

> - **Vendor routing.** AMD-primary questions — anything whose answer is an AMD register, bit, exit code, instruction or AMD-only feature — go to `amd-virtualization`, **including when the question is phrased in Windows terms** ("my Ryzen and Hyper-V", "AMD-V greyed out", "SEV on my PC"). **Symmetric comparisons** ("Intel vs AMD", "SEV-SNP vs TDX") are answered **here**, with `18-comparison-amd-arm-riscv.md` §18.7 giving only the correspondence and deferring every AMD bit-level detail to `amd-virtualization`. **ARM- and RISC-V-primary** questions are answered here from §18.8–§18.9; neither skill claims non-x86 depth beyond that.

`amd-virtualization/SKILL.md` 写对称的一条：

> - **Vendor routing.** Intel-primary questions, and symmetric Intel-vs-AMD comparisons, go to `intel-vt`. This skill answers AMD-primary questions including Windows-phrased ones. `19-comparison-intel-arm-riscv.md` states the AMD side of a correspondence and **is not** where a two-way comparison is composed; it is what `intel-vt/18` links to for AMD bit-level detail.

**注意这条的后果**：按此规则，"SEV-SNP vs TDX" 路由到 `intel-vt` §18.7——而那一节的 AMD 侧内容全部锚在 T2、无修订号、URL 已失效。所以票 19 必须同时做，否则等于把用户导向质量更差的那一份。

## 3. 跨技能事实所有权（**定义它的规范属于谁，谁就是 owner**）

单一规则：**哪家的规范定义了这条事实，就归哪个技能；另一边只写一句对应关系并链接过去。**

归 `amd-virtualization` 的（`intel-vt/18` 相应位置降为一句话 + 链接）：VMCB 偏移/clean bits · 拦截向量与 IOPM/MSRPM · VMRUN/#VMEXIT 流程与 VMLOAD/VMSAVE 字段集 · EXITCODE 与 EXITINFO · NPT/nCR3 与单一 NPF 退出码 · **ASID 32 位、ASID 0 = host、数量经 CPUID 枚举**（`intel-vt` 内部现有 **4 份副本**：`18-…:129,310,311`、`errata.md:164`、`core-facts.md:116`）· INVLPGA 与 TLB_CONTROL · AVIC/x2AVIC/doorbell/INT_CTL/incomplete-IPI · GIF/STGI/CLGI/vGIF · C-bit 与 `Fn8000_001F` · SEV/SEV-ES/SEV-SNP 全部内部机制（RMP、VMPL、PVALIDATE 系列、GHCB、MSR 0xC0010130、证明报告）· #VC(29) 机制 · AMD-Vi/IVRS/DTE/IRTE · **"AMD 无 VMCS shadowing 对应物"及其结构性原因**。

归 `intel-vt` 的（AMD 侧 `19` 只引用不复述）：VMCS 不透明性与字段编码 · EPT 表项/EPTP/violation vs misconfiguration · **24 次二维遍历推导**（`intel-vt/06` 已有 `C:high` 的完整推导——**AMD 侧引用它，不要重新推一遍**；AMD `15` 只做嵌套场景的延伸）· **PCID + VPID（16 位、0 保留）** · APICv/posted interrupts/IPIv · #VE(20) · VT-d 全部 · 中断重映射 erratum #53（Intel 的）。

归 `90-dated-landscape.md`（两边都不放在架构章）：AVIC 与 APICv 的**默认开启状态差异**——这是随内核策略变动的时效事实，不是架构事实。

## 4. 两处术语碰撞（必须在镜像章里显式消歧）

- **`SNP` 是两个不同的东西**：VT-d 里 `SNP` = Snoop 字段（`intel-vt/10-vtd-dma-remapping.md:179,239,250,252,384`），AMD 里 `SNP` = Secure Nested Paging。两边的镜像章必须各写一句，避免读者串台。
- **`RVI` 也是两个东西**：AMD 的 Rapid Virtualization Indexing（NPT 的营销名）vs Intel APICv 的 Requesting Virtual Interrupt 寄存器。`intel-vt/07` 用后者。AMD `06` 与 `19` 必须点明。

## 5. 无人认领的问题类别（补一句话即可）

- **ARM / RISC-V 为主的问题**：两边的对比章都覆盖了内容，但两边的 Scope 规则都只写了 AMD/Intel 的分工，`intel-vt` 的 description 里也没有 ARM/RISC-V 触发词。按 §2 的措辞，明确归 `intel-vt` §18.8–§18.9，且两边都声明"不提供超出对照的非 x86 深度"。
- **Hygon Family 18h**（`intel-vt/errata.md:76` 提到）：不在任何一边的 scope 规则里。归 AMD 技能，作为 AVIC erratum 的一个旁注。

## 完成判据

- 两个 `SKILL.md` 的 description 各含否定标记；两边 Scope boundaries 的措辞对称且逐字采用 §2。
- `amd-virtualization/19-comparison-intel-arm-riscv.md` 中，§3 归 Intel 的每条事实都是"一句对应 + 链接"，没有位级复述；可用 grep 抽查 PCID/VPID、EPT 表项、24 次推导三处。
- `SNP` 与 `RVI` 的消歧句在 AMD 侧存在。
- 一道评测题验证路由：**"我的 Ryzen 7000 在 Windows 11 上能不能开 Hyper-V 嵌套"必须命中 `amd-virtualization`**，不是 `intel-vt`。
