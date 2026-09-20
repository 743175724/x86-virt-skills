# 11 · `15-nested-virtualization.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **430–459**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D9

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** APM Vol.2 **§15.33 Nested Virtualization** + 内核一手源（T2）。
**Owns:** 嵌套 SVM 机制 —— vmcb12/vmcb02 构造 · 拦截合并 · nested NPT · Windows 上的嵌套形态。

## 为什么这一章在 Windows PC 目标下权重很高

在 Windows PC 上嵌套不是服务器特性而是常态：只要开启 VBS / WSL2 / Windows Sandbox / Docker Desktop / Hyper-V 角色，Hyper-V 就占据 SVM，Windows 内核本身以 guest 身份运行，其他 VMM 一律经 WHP 嵌套运行。旧库把嵌套完全写成 Linux/KVM 的实现叙事，且第 12 章的矩阵把 Hyper-V 的"嵌套虚拟化"填成 `—`（错）。

## 必须交付

1. **AMD 侧的嵌套模型**：L0 如何把 L1 的 VMCB（vmcb12）与自己的控制合成 vmcb02；**明确写出 AMD 没有 Intel VMCS shadowing 的对应物**——从 Intel 迁移过来的人会去找一个不存在的机制。这是 `19-comparison` 的一条重要对照。
2. **拦截合并规则**：L0 与 L1 拦截位的取并、哪些退出反射给 L1、哪些由 L0 直接处理；EXITINTINFO 与事件注入在嵌套下的传递。
3. **nested NPT**：L1 的 nCR3 如何被 L0 影子化、两级嵌套下的遍历代价推导（在 `06` 的 24 次基础上叠加，给出具体算式而不是"进一步叠加"）。
4. **host 状态的保护**：`VM_HSAVE_PA` 在嵌套下的语义、L1 的 VMLOAD/VMSAVE 处理、GIF 在嵌套下的行为。
5. **已知的嵌套安全教训**：CVE-2021-3653（`int_ctl` / AVIC 字段未净化 → L2 写宿主内存）与 CVE-2021-3656（VMLOAD/VMSAVE 未拦截）作为机制说明的一部分保留一句指针，详情归 `17-security.md`。
6. **Windows 上的嵌套**：
   - Hyper-V 在 AMD 上**支持**嵌套（Windows Server 2022 / Windows 11 起），开启方式 `Set-VMProcessor -ExposeVirtualizationExtensions $true`（errata：旧版矩阵填 `—`）。
   - 第三方 VMM（VMware Workstation / VirtualBox / QEMU）在开启 VBS 的机器上经 **WHP** 运行，即已经是嵌套 guest——交叉引用 `16`。
   - 该路径的开销与限制归 `18`。
7. **Scope 标注**：机制部分 OS 无关；Windows 小节标 Tier-2（Microsoft Learn）。
8. Open items。

## 明确移出本章

- KVM 的 `nested_svm_*` 函数名、struct 成员、补丁系列与内核版本 → 保留为 Linux-only 的实现注记小节，且版本相关的部分进 `90`。
- 性能数字 → `18`。

## 完成判据

- lint 零 error。
- "AMD 无 VMCS shadowing 对应物"这条事实在全库只此一处为 owner，`19-comparison` 交叉引用它。
- 嵌套遍历代价给出可复核的算式。
- 关于 Windows 嵌套的表述与 `16` 一致，且 lint 的 MISCONCEPTIONS 规则能拦住"AMD 上 Hyper-V 不支持嵌套"的旧说法。

---

## 复检补充

- **本章已移出架构章带。** 架构带改为 `01`–`14`；本章的规范性内容只有 APM §15.33 一节，其余是内核与 Windows 的 T2 事实，留在"每条断言必须有 T1"的带内会让"lint 零 error"这条判据永远达不到。**但附加一条 review 要求**：凡 APM §15.33 覆盖的机制仍必须带 `[APM2 §15.33]`。
- **"AMD 用什么代替 VMCS shadowing"的完整答案需要两块，初稿只安排了否定句。** 补上：**VLS（Virtualized VMLOAD/VMSAVE，`Fn8000_000A EDX[15]`）** 与 **vGIF** 才是 AMD 侧减少嵌套退出的实际加速手段。VLS 的语义归 `04`、vGIF 归 `07`，本章负责把它们组织成"嵌套加速"这个答案并交叉引用。
- **补一句"AMD 没有 eVMCS"**：`intel-vt/17` 描述的 enlightened VMCS 是 VP assist page 里一个 VMCS 形状的结构，Intel 专属；AMD 的 VMCB 本来就是普通内存。不写出来，读者容易以为可以照搬。
