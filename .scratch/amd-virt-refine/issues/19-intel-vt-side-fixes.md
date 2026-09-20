# 19 · `intel-vt` 侧的四处修正（**超出本 spec 的 Out of Scope，待用户裁决**）

Status: needs-info
Type: task
Blocked by: —
Spec: `.scratch/amd-virt-refine/spec.md` — 本票**与 Out of Scope 第一条冲突**（"不重写 `intel-vt` 的内容"）
来源: 复检线程 D

## 为什么开这张票

复检在已完成的 `intel-vt` 技能里发现 4 处缺陷。它们都不是 AMD 重构的产物，但**都会在 AMD 技能上线后变成用户可见的矛盾**。spec 的 Out of Scope 写的是"只做工具与配置泛化 + 在 SKILL.md 消歧段落里补对应"，下面第 2–4 项超出了这条边界，所以本票标 `needs-info`，**不要在用户裁决前动手**。

如果用户选择不做，AMD 侧必须在对应位置加"与 `intel-vt` 的表述不一致"的提示，否则两个技能会给出互相打架的答案。

## 1. AMD 官方文档的 URL 全部失效（**建议做，代价最小、收益最大**）

`intel-vt/references/bibliography.md:46-52` 的 7 条 AMD 条目：

- `[41]` APM Vol.2、`[42]` Vol.3 用的是 `…/processor-tech-docs/programmer-references/24593.pdf` / `24594.pdf` —— 现在返回 **404**。
- `[43]` SNP-ABI 56860、`[44]` GHCB 56421、`[45]` SEV-API 55766 用的是 `…/epyc-technical-docs/…` —— **302 跳到 JS 门户壳并返回 `text/html`**。
- `[46]` IOMMU 用 `48882_IOMMU` slug —— 已死链。
- 7 条**全部没有修订号**；`[41]` 还把附录 B 的标题写成 pre-3.4x 的 *"Layout of VMCB"*（现行是 *"VMCB Layout"*）。

修法：换成 spec §D2 已核验的 `https://docs.amd.com/go/en-US/<slug>` 链接并补修订号与日期。这是纯引用元数据修正，不动任何断言，**建议直接做**。

## 2. `17-windows-platform.md` 的四句话对 AMD 主机是错的或不完整

复检的结论是：**不要把 `17` 镜像成 AMD 的 `16`**——该章约 75% 是厂商无关的 Windows 事实（分区模型、hypercall ABI、SynIC MSR、VMBus、VTL、调度器、enlightenment、WHP、WSL2/Sandbox/Docker、HVCI 页级行为、症状表）。正确做法是让 `17` 继续拥有这些，只把其中 Intel 专属的措辞中立化：

| 位置 | 现状 | 问题 |
|---|---|---|
| `17:13`、`17:129`、`17:149` | 把"谁占据虚拟化扩展"定义为 *"the software that executed VMXON"* | AMD 上是**谁设置了 `EFER.SVME`**，且固件可经 `VM_CR.SVMDIS`/`LOCK` 抢先。照搬会把一个 VMX 专属机制当成通用规则 |
| `17:52` | *"Second-level address translation — EPT on Intel — is a hard requirement"* | AMD 侧是 NPT/RVI，Hyper-V 的硬件要求是 `Fn8000_000A EDX[0]`，不是把 EPT 替换成 NPT 就完 |
| `17:60` | *"the architectural VMCALL on Intel parts"* | AMD 是 `VMMCALL` |
| **`17:205-208`** | *"The hardware underneath is **Intel VT-d**"*（讲 Kernel DMA Protection） | **本章对 AMD 读者最糟的一句**：AMD 主机上 Kernel DMA Protection 走 **AMD-Vi/IVRS**。照现状读，AMD 用户会得出"这是 Intel 独有功能"的结论 |

建议：`17` 的这四处各加一个 `(on AMD: … — see amd-virtualization/16)` 从句，约 6 行改动；`17:7` 加一条 `See also:` 指向 AMD 的 `16`。`17:62-66` 的 **enlightened VMCS** 保持 Intel 专属并明确标注——AMD 侧没有对应物（VMCB 本来就是普通内存），AMD 的 `15`/`16` 必须显式说"AMD 无 eVMCS"，否则容易被当成可以照搬的机制。

## 3. `18-comparison-amd-arm-riscv.md` §18.11 对客户端内存加密的表述

`18-…:331` 写：*"both vendors' virtual-machine memory-encryption technologies require platform support that client parts do not provide."* §18.7 全程没提 SME/TSME。

但 AMD 侧 D9 明确把 `11-memory-encryption.md` 定位成"客户端能用的那一章"——**TSME / AMD Memory Guard 在 Ryzen 上是存在的**。修法：把那句限定为 "the **SEV family**"，并加一句指向 AMD 的 `11`。不改的话，两个技能对"我的 Ryzen 能不能加密内存"给出相反答案。

## 4. AVIC erratum #1235：一边已裁定，一边是未决冲突

`intel-vt/errata.md:71-77`（E08，`C:high`）与 `core-facts.md:54,115` 把它当作**已裁定**事实（Zen 4 之前受影响、`force_avic=1`、2025-06 提议默认开启、扩展到 Hygon 18h）。本 spec 的 D7 待裁决清单把"erratum #1235 的真实披露年份"列为 **Open conflict**（因为旧 AMD 库把它标成 2025–2026，同时又说它让 AVIC 默认关了"约八年"）。

`intel-vt/errata.md:5` 自己的规矩是：Open conflict 不得选边。而且 A 内部也不一致——`18-…:158` 说 #1235 是 *"the documented cause **on one family**"*，`errata.md:76` 说 Zen 4 之前全部受影响。

需要裁决：要么两边都降为 Open conflict，要么找到 AMD 修订指南里的原始条目（注意：**客户端 Ryzen 没有公开修订指南**，见 spec §D2，所以这条很可能只能停在 Open conflict）。

## 完成判据（若用户批准）

- `bibliography.md` 的 7 条 AMD 条目全部换成 `docs.amd.com/go/en-US/` 且带修订号与日期；逐条验证返回 `application/pdf` 且文件头是 `%PDF`。
- `17-windows-platform.md` 的四处加上 AMD 从句 + `See also:` 行；`node tools/lint.mjs intel-vt` 仍为 clean。
- §18.11 的限定改完，`11-memory-encryption.md` 的指针存在。
- #1235 的口径在两个技能里一致（同为 settled 或同为 open）。
