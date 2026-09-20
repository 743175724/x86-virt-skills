# 17 · 黄金评测集与首轮跑分

Status: ready-for-agent
Type: task
Blocked by: 16
Spec: `.scratch/amd-virt-refine/spec.md` §T1

## 产出

`eval/amd-virtualization/questions.yaml` —— **80 题**，题型配比约为：查表类 30% / 机制解释 30% / 诊断推理 25% / 讹传陷阱 15%。

每题字段：

```yaml
- id: amd-023
  chapter: 05-exit-decoding.md
  question: "AMD SVM 中 VMRUN 被拦截时的 EXITCODE 是多少？编码规律是什么？"
  must_include:
    - "0x80"
    - "向量 4 的第 0 位 → 0x80 + bit"
  must_not_include:
    - "EXITCODE 等于拦截位在向量中的位序"
  required_citation: "APM Vol.2 退出码附录（表号）"
```

## 陷阱题必须覆盖的清单（spec §D7 逐条）

1. `CmdBufRun` 在哪个寄存器（正确：Status Register 0x2020 bit 4；启动命令处理的是 Control Register bit 12 `CmdBufEn`）
2. IOMMU MMIO 窗口大小（16 KiB，不是 14 KiB）
3. IRTE bit 0 的名字（`RemapEn`，不是 `RemapEm`）
4. `#NPF` EXITINFO1 的 ENC / SIZEM / VMPL 位号（34 / 35 / 36；31 是 RMP）
5. VMRUN 对 CR4/EFER 的一致性检查怎么表述（MBZ 规则，不是 2005 年的固定掩码）
6. VMRUN 被拦截的 EXITCODE 与编码规律（0x80；不是"拦截位的位序"）
7. `#VMEXIT` 恢复了哪些寄存器（GPR 中只有 RAX/RSP/RIP，另装载 GDTR/IDTR/EFER/CR0/CR3/CR4/RFLAGS）
8. VMLOAD/VMSAVE 是否涉及 SS（不涉及）
9. ~~CVE-2024-25744 属于谁~~ **此陷阱题作废（核验 #25 REFUTED）**——25744 确实是 Heckler CVE，覆盖 TDX 与 SEV。改考"Heckler 的三个 CVE 各覆盖什么"
10. AMD 平台上 Hyper-V 能否做嵌套（能，Windows Server 2022 / Win11 起）
11. Ryzen 桌面能否用 SEV —— **答案已按核验 #31 更正**：Zen+/2/3 的消费级部件（如 3900X、5800X3D）`Fn8000_001F EAX[1]` **确实为 1**；Zen 4 客户端起只剩 SME；SEV-SNP 客户端从未可用。**答案键不得写"客户端读 0"**
12. 跑 VMware/VirtualBox 是否必须关掉 Hyper-V（不必须，经 WHP 共存）
13. 嵌套页表遍历最坏多少次访存（24，不是 16）
14. x2AVIC 的 CPUID 位（`Fn8000_000A EDX[18]`，不是 EDX[14]）
15. AMD 平台的 Hyper-V hypervisor 镜像文件名（`hvax64.exe`）
16. SEVurity 与 SEVerity 的区分（AMD-SB-1004 对应 SEVerity / CVE-2020-12967）
17. "SEV-ES 在支持 SNP 的 CPU 上被禁用"的真实成因（CVE-2025-48514/48517 固件修复副作用，非 Zen 5 代际特性）
18. SEV-SNP 的 255 vCPU 上限是不是架构限制（不是，是 KVM/QEMU 的 xAPIC 期限制）

## Windows 题（≥12 道）

为什么我的 VMM / 驱动 / 调试器用不了 AMD-V · VBS 需要哪些 AMD 硬件特性 · HVCI 与 NPT 的关系 · Kernel DMA Protection 显示 Off 的可能原因 · 客户端 Windows 能否做 GPU 直通（DDA vs GPU-P）· 如何在 AMD 上开启嵌套 · `CPUID 0x40000000` 返回什么 · AMD 平台 Hyper-V 的启动链 · Credential Guard 依赖什么 · BIOS 里 SVM Mode 与 IOMMU 的位置 · 第三方 VMM 在 VBS 开启时走什么路径 · Windows 上如何确认 VBS 状态。

## 查表题（≥24 道）

覆盖：VMCB 某字段的偏移 · 某拦截位的位号 · 某退出码的含义 · NPT 表项某位 · INT_CTL 某位 · IOMMU Control Register 某位 · DTE 某字段 · IRTE 某字段 · IOMMU 事件码 · `Fn8000_000A` 某位 · `Fn8000_001F` 某字段 · MSR 地址（VM_CR / VM_HSAVE_PA / TSC_RATIO / SEV_STATUS）· GHCB 某偏移 · RMP 条目某字段 · ATTESTATION_REPORT 某字段。

**注意**：旧版速查表漏掉了 `VM_CR`、`VM_HSAVE_PA`、`Fn8000_0001 ECX[2]`、退出码 `60h`/`61h`——这几个必须各出一题。

## 运行与通过线

- 协议用共享的 `eval/RUNNER.md`；结果写入 `eval/amd-virtualization/results/<agent>-<YYYY-MM-DD>.md`。
- **通过线**：`must_include` 命中率 ≥90%；`must_not_include` 违反 **0** 次；引用有效率 ≥95%。
- **三家 agent 各跑一轮**（Claude Code / Codex / Hermes）。三者结果的差异本身是路由质量的信号——若某家在同一批题上系统性失败，优先怀疑 SKILL.md 的路由表与停止规则，而不是章节内容。
- 每个触发的陷阱最终都要落地为一条确定性 lint 规则（`MISCONCEPTIONS`），使同一错误无法再悄悄回归。

## 完成判据

- 80 题就位，字段齐全；陷阱题覆盖上面 18 条。
- 至少一轮完整跑分结果入库，且达到通过线；未达线的项在对应章节票上开回归任务。
- 陷阱题部分由用户本人复核一次（`must_include` 写错会奖励错误答案）。

---

## 复检补充

- **有现成的先例可抄，不要另起炉灶。** `intel-vt` 的题库**已建成并跑过**：`eval/questions.yaml` 80 题、`eval/README.md`（题型与覆盖说明）、`eval/results/` 下 6 份 2026-09-20 实跑报告，并已驱动两轮修复提交。题型配比照抄：**lookup 24 / mechanism 24 / diagnosis 20 / trap 12**。
- **本票依赖题库迁移先完成**（票 01）：`eval/questions.yaml` → `eval/intel-vt/questions.yaml`，且 `tools/lint.mjs:322` 的硬编码路径必须同步改，否则题库校验会静默失效。
- **陷阱题的算术要说清**：24+24+20+12 = 80 已排满，而 D7 有 **20 条**讹传。**允许一道题的 `must_not_include` 同时挂多条**——例如一道"解读这个 `#NPF`"的题可以同时挂位号错位与"退出码 = 拦截位序"两条。
- **本票的陷阱清单漏了 D7 的两行**，补上：**"Hyper-V 不支持 AMD SEV"（无条件表述）** 与 **"AES-XEX 覆盖 SEV 全代"**。
- **加一道路由题**（验证票 18 的消歧修复）：*"我的 Ryzen 7000 在 Windows 11 上能不能开 Hyper-V 嵌套"* —— 必须命中 `amd-virtualization`，不是 `intel-vt`。
- **把外部依赖的判据标注成外部门禁**：三家 agent 跑分、用户人工复核陷阱题——它们是验收条件，但不是本票能自行完成的动作，不要让执行 agent 卡在上面。
