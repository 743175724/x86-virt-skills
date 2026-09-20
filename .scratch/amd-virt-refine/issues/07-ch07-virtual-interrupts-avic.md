# 07 · `07-virtual-interrupts-avic.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **240–269**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** APM Vol.2 **§15.29 Advanced Virtual Interrupt Controller**（15.29.1–15.29.10，含 **15.29.10 x2AVIC**）+ **§15.17 Global Interrupt Flag, STGI and CLGI Instructions**。

**Owns:** INT_CTL 全部位 · 虚拟中断评估与投递 · vGIF · AVIC / x2AVIC · doorbell MSR · AVIC 相关退出。

> **本票有一个未核验项**：承载 INT_CTL / V_TPR / V_IRQ / V_INTR_MASKING 的**虚拟中断小节编号尚未核实**。首次引用时必须对着 24593 Rev 3.45 的 PDF 书签树核对；核不到就写 `[APM2 Ch.15]` 并置 `C:low`，**不要猜一个 §15.2x**。

## 必须交付

1. **INT_CTL（VMCB 060h）逐位表**。旧版只有 V_TPR 与 V_INTR_MASKING 两三位，其余用一句"后续扩展在同一 qword 内追加了 V_GIF_ENABLE/V_GIF/V_NMI 等位"带过，**没有位号**。必须给出：V_TPR(3:0)、V_IRQ(8)、V_GIF(9)、V_NMI(11)、V_NMI_MASK(12)、V_INTR_PRIO(19:16)、V_IGN_TPR(20)、V_INTR_MASKING(24)、V_GIF_ENABLE(25)、V_NMI_ENABLE(26)、X2AVIC(30)、AVIC_ENABLE(31)、V_INTR_VECTOR(39:32) 等（逐位对着 AMD 官方表核，不得凭记忆）。
2. **虚拟中断的评估与投递算法**：V_IRQ/V_INTR_PRIO/V_TPR/V_IGN_TPR 如何共同决定投递，与 `EVENTINJ` 的关系与优先级（EVENTINJ 字段布局在 `05`）。
3. **GIF 与 vGIF**：GIF 的语义（哪些事件被 GIF=0 屏蔽）、STGI/CLGI 对 GIF 的作用（指令侧在 `04`）、vGIF 的使能位与 guest 侧行为、`Fn8000_000A EDX[16]` VGIF。
4. **AVIC 完整机制**——旧版只有概念，本章要做到能实现：
   - **APIC backing page 布局**：它是标准的 4 KB xAPIC 寄存器页；给出关键寄存器偏移（TPR 080h、EOI 0B0h、ICR 300h/310h、IRR 200h–270h、ISR、LVT…）。
   - **四种访问行为（ALLOWED / ACCELERATED / TRAP / FAULT）映射到具体寄存器的表**。旧版只列了四个名字。
   - **Physical APIC ID Table 条目格式**（Host Physical APIC ID、Backing Page Pointer、IsRunning、Valid）与 **Logical APIC ID Table 条目格式**（Guest Physical APIC ID、Valid）。
   - **VMCB 中的 AVIC 字段**：APIC_BAR(038h)、AVIC Backing Page Pointer(0E0h)、AVIC Logical APIC ID Table Pointer(0F0h)、AVIC Physical APIC ID Table Pointer(0F8h，含 max index 域)。**使用架构里的真实名称**——旧版发明了 `AVIC_LOGICAL_PAGE` / `AVIC_PHYSICAL_PAGE` 这类不存在的名字。
   - **AVIC Doorbell MSR `C001_011Bh`** 的语义与使用时机。
   - **AVIC 相关退出**：`0x401` AVIC_INCOMPLETE_IPI（四个失败码的**取值**：INVALID_INT_TYPE / TARGET_NOT_RUNNING / INVALID_TARGET / INVALID_BACKING_PAGE）、`0x402` AVIC_NOACCEL（EXITINFO1 中的 offset + R/W 编码）。EXITINFO 的详表在 `05`，本章给语义。
   - **x2AVIC**：`Fn8000_000A EDX[18]`（**不是 EDX[14]**，errata）、与 x2APIC 模式的关系、与 legacy xAPIC 的行为差异。
   - **AVIC ↔ IOMMU GA 的协作**：本章只给 CPU 侧接口并交叉引用 `10-iommu-interrupt-remapping.md`（GA log / GAPPI 的 owner 是 `10`）。**旧版把这个三代演进故事在第 5 章和第 7 章各讲了一遍，本次只保留一处。**
5. **Scope 标注**：AVIC 在客户端 Ryzen 上的固件启用现状与 erratum 影响（具体的默认值演进史、内核默认开关的年份 → `90-dated-landscape.md`）。
6. Open items。

## 明确移出本章

- AVIC 默认启用史、erratum #1235 的年份与 CVE 编号、KVM 模块参数默认值、OCI/Genoa 实测数字 → `90` 与 `18`。
- Secure AVIC（EPYC 专属）只在本章留一句指针，细节归 `14-sev-snp.md` 或 `90`。

## 完成判据

- lint 零 error。
- INT_CTL 表覆盖全部已定义位，每位带 T1 锚点。
- AVIC 两张表项格式与 backing page 行为表存在且带位号。
- 全库中 AVIC↔IOMMU GA 的机制描述只出现一次（其余为交叉引用），可用 grep 验证。
