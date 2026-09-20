# 05 · `03-intercepts.md` + `04-world-switch.md` + `05-exit-decoding.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **150–199**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D7, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


## `03-intercepts.md`

**Maps to:** APM Vol.2 **§15.7 Intercept Operation · §15.8 Decode Assists · §15.9 Instruction · §15.10 IOIO · §15.11 MSR · §15.12 Exception · §15.13 Interrupt · §15.14 Miscellaneous**（含 **§15.14.4 Pause Intercept Filtering**、§15.14.5 Bus Lock Threshold）；另见 §15.38 IBS Virtualization、§15.39 PMC Virtualization。TSC ratio 与 LBR 虚拟化所属子节**未核验**，首次引用时回填或降级到 `[APM2 Ch.15]`。
**Owns:** 五组拦截向量的位号 · IOPM / MSRPM 布局 · PAUSE filter · TSC ratio · LBR virtualization。

1. **五组拦截向量逐位表**。旧版向量 3 只有散文范围、**向量 4 完全没有位号**，且漏掉 MWAIT_COND / XSETBV / RDPRU / EFER 写陷阱 / CR0-15 写陷阱。每一位给出：位号、触发条件、对应 EXITCODE（交叉引用 `05`）。
2. **IOPM 与 MSRPM 的物理布局**：大小、对齐、位索引算法、未覆盖 MSR 的默认行为。
3. PAUSE filter count/threshold 的语义与调优含义（偏移在 `02`）。
4. **TSC ratio**（`C000_0104h` + `Fn8000_000A EDX[4]` TscRateMsr）——**全库目前不存在**。
5. **LBR virtualization**（VIRT_EXT bit 0 + `Fn8000_000A EDX[1]` LbrVirt + 保存区 270h–288h 字段）——第 5 章目前完全缺席。
6. Open items。

## `04-world-switch.md`

**Maps to:** APM Vol.2 **§15.5 VMRUN**（15.5.1 Basic Operation、15.5.2 VMSAVE and VMLOAD Instructions）+ **§15.6 #VMEXIT** + **§15.17 Global Interrupt Flag, STGI and CLGI Instructions**；逐指令参考 **APM Vol.3 §4**（按字母排序，**只有页码没有小节号**：VMRUN p.503 · VMLOAD p.500 · VMSAVE p.508 · VMMCALL p.502 · VMGEXIT p.502 · STGI p.480 · CLGI p.382 · INVLPGA p.396 · SKINIT p.472，Rev 3.38）。
**Owns:** VMRUN / `#VMEXIT` 流程 · 一致性检查 · VMLOAD/VMSAVE · GIF/STGI/CLGI · 逐指令语义与异常条件。

1. VMRUN 的完整流程：保存 host 状态到 `VM_HSAVE_PA`、从 VMCB 装载 guest 状态、GIF 的作用、哪些状态由 VMRUN 装载而哪些由 VMLOAD 承担。
2. **`#VMEXIT` 恢复了什么**——按 errata 改正：GPR 中只恢复 **RAX/RSP/RIP**，另装载 GDTR/IDTR/EFER/CR0(PE 强制为 1)/CR3/CR4/RFLAGS。旧版第 1 章"仅恢复三个寄存器"的表述与第 2 章自相矛盾。
3. **一致性检查按现行 APM 的 MBZ 规则重写**。旧版直接搬了 2005 年手册的固定掩码（"CR4[63:11] 非零、EFER[63:15] 非零"），按那个写法正常的 Windows guest 状态会被判非法。同时把旧版归给"2026 年 KVM 加固系列"的 EFER.LME/CR0.PG/CR4.PAE/CS.L 联动检查**还原为架构固有检查**。
4. **VMLOAD/VMSAVE 的确切字段集**：FS、GS、TR、LDTR、KernelGsBase、STAR/LSTAR/CSTAR/SFMASK、SYSENTER_*。**不含 SS**（errata）。修正旧版错误的世界切换序列——退出后是 **VMLOAD** 不是 VMSAVE。
5. GIF 语义 + STGI/CLGI（含 CPL / EFER.SVME 前置条件）；vGIF 的机制归 `07`，本章只给指令侧。
6. **逐指令参考表**（来自 APM Vol.3 指令页）：VMRUN / VMLOAD / VMSAVE / VMMCALL / STGI / CLGI / INVLPGA / SKINIT / VMGEXIT，各给编码、操作数、特权要求、`#UD`/`#GP` 触发条件。**旧版整个 bibliography 里没有 APM Vol.3**，这一节要从零建立。同时纠正"SVM 指令集仅八条且全由 `Fn8000_0001 ECX[2]` 宣告"的说法。
7. Open items。

## `05-exit-decoding.md`

**Maps to:** APM Vol.2 **App C "SVM Intercept Exit Codes"** + **§15.8 Decode Assists**。
**Owns:** EXITCODE 全表 · EXITINFO1/2 · NRIP · Decode Assist · EVENTINJ / EXITINTINFO。

1. **EXITCODE 穷举表**（来自 APM Vol.2 的退出码附录）。旧版只列了约 25 个，必须补齐：`60h` INTR、`61h` NMI、`62h` SMI、`63h` INIT、`64h` VINTR、`66h–6Dh`、`6Fh–71h`、`73h/74h/76h`、`79h` INVLPG、**`7Ah` INVLPGA**、`7Dh` TASK_SWITCH、`7Eh`、`84h/85h` STGI/CLGI、`86h` SKINIT、`8Ch–9Fh` 写陷阱区、`A2h`、`400h` NPF、`401h/402h` AVIC、`403h` VMGEXIT、以及 `−1…−4`（VMEXIT_INVALID / BUSY / IDLE_REQUIRED / INVALID_PMC）。
2. **编码规律的正确表述**：CR 读 `00h–0Fh`、CR 写 `10h–1Fh`、DR、异常 `40h–5Fh`、向量 3 → `0x60+bit`、向量 4 → `0x80+bit`（故 VMRUN = `0x80`）。删除旧版第 2 章"EXITCODE = 拦截位的位序"的错误规律。
3. **EXITINFO1 / EXITINFO2 逐事件布局**：异常（含 error code 与 CR2）、IOIO、MSR、**NPF（位号按 errata 改正：31 RMP / 34 ENC / 35 SIZEM / 36 VMPL，低位错误码 P/RW/US/RSV/ID/SS，EXITINFO2 = 故障 gPA）**、task switch、INTn/软件中断、CR/DR 写陷阱、AVIC `401h/402h` 载荷（含 AVIC_INCOMPLETE_IPI 的四个失败码取值）、VMGEXIT。
4. **NRIP 语义**：哪些退出填充 NRIP、何时未定义、与 Decode Assist 的关系；`Fn8000_000A EDX[3]` NRIPS（注意 `Fn8000_0001 ECX[10]` 是 IBS 不是 NRIPS）。
5. **Decode Assist**：`insn_len`/`insn_bytes` 字段何时有效、有效性规则。
6. **EVENTINJ 与 EXITINTINFO** 的完整字段与 TYPE 编码（旧版 TYPE 只给了 2 和 3，缺 0=INTR、4=软件中断）。
7. Open items。

## 共同约束

- 所有位号/编码带 T1 锚点；退出码表必须锚到 AMD 的退出码附录（表号形式）。
- 禁用来源：`vlsiworlds.com` 镜像、CSDN 转录的 rootkit 论文、unknowncheats 论坛、个人博客、VirtualBox 头文件（可作 T2 佐证，不可作唯一出处）。
- 与 `02` 的边界：偏移在 `02`，语义在这三章。

## 完成判据

- lint 零 error；`05` 的退出码表无编号空洞。
- 抽查：`0x7A`、`0x8C`、`0x403`、`−2` 四个退出码都能查到且带官方锚点。
- errata 中与本票相关的 6 条（`#VMEXIT` 恢复集、VMLOAD 字段、一致性检查、EXITCODE 规律、NPF 位号、NRIPS 位）在对应章节有正确表述，且 lint 的 MISCONCEPTIONS 规则对旧表述报错。

---

## 复检补充

- **不要写 APM 的表号**（同票 04）：退出码表的锚点写 `[APM2 App.C]`，不要写 `Table C-1`——D2 没有核过 App C 的表号。
- **`#NPF` 的 EXITINFO1 位表由 `05` 独占**（复检裁决）：`06` 写语义与处理流程并交叉引用，`14` 只解释 RMP 相关位的含义。本票的完成判据据此表述。
- **`03` 补拦截的优先级与顺序**（APM §15.7）：拦截检查相对异常检查的位置、拦截在结果提交之前触发、指令断点与挂起的数据断点陷阱**优先于**拦截检查、ICEBP 不能通过 `#DB` 异常位拦截。初稿只要求逐位表，这部分会整块漏掉。
- **`04` 补一致性检查的否定清单**：RIP 越过 CS 限或非规范**不是**一致性失败（按 guest `#GP` 投递）；paged real mode（PE=0, PG=1）**合法**。这正是 D7 想防的那类错误。
- **`04` 补"一致性检查的强度是不均匀的"**：保留的 `TLB_CONTROL` 编码 VMRUN **不校验**——APM 的清单是唯一权威。
- **`04` 补 VLS（Virtualized VMLOAD/VMSAVE）语义**：`Fn8000_000A EDX[15]` + VMCB `0B8h` VIRT_EXT bit 1；guest 可在不被拦截的情况下执行 VMLOAD/VMSAVE，及其与 VMLOAD/VMSAVE 拦截位的关系。**旧版宣传了这个特性位却从不定义它，初稿原样继承了这个缺陷。**
- **`04` 补 INIT/SIPI 与 AP 拉起**：INIT 拦截实际投递什么、`VM_CR.R_INIT`（INIT → `#SX`，向量 30）、`#SX` 的语义。新旧都没有 owner。
- **`04` 补 `MCOMMIT`** 的指令级说明（目前只作为"EFER bit 17 合法、别当 MBZ"出现）。
- **`03` 把这四项从"`Maps to:` 里挂着"变成真正的交付项**：PMU/IBS 虚拟化（§15.38/§15.39，PerfMonV2 直通；"为什么 VM 里 perf 不工作"是最高频问题之一）· 调试寄存器虚拟化与 DebugSwap（本技能的目标读者就是在 Windows 上调试的人）· CET/影子栈虚拟化的机制（字段在 `02`）· Bus Lock Threshold 与 IdleHlt 的**语义**（初稿只让位存在）。
- **`03` 补 TSC 合成规则**：`TSC_OFFSET` 与 `TSC_RATIO` 的先后关系、与 RDTSC/RDTSCP 拦截的交互。
- **`03` 补 SMI 拦截与 SVM 下的 SMM**；APM Vol.2 **附录 D "SMM Containerization"** 整个附录目前零 owner → 归票 13 的 `17`。
- **GIF 的分工**：指令侧（STGI/CLGI/前置条件）在 `04`，机制侧（vGIF、guest 可见行为）在 `07`。D5 原先把 §15.17 同时映到两章而没说清。
- **执行单元**：本票拆成三个可独立认领、独立提交的单元——`03`（bib 150–169）、`04`（170–184）、`05`（185–199）。
