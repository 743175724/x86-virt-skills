# 06 · `06-nested-paging.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **200–239**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D7, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** APM Vol.2 **§15.25 Nested Paging**（15.25.1–15.25.9）+ **§15.16 TLB Control**（15.16.1 TLB Flush、15.16.2 Invalidate Page, Alternate ASID）+ **Ch.5 Page Translation and Protection**（表项格式）；INVLPGA 见 **APM Vol.3 §4 "INVLPGA"**（p.396）。
**Owns:** nCR3 / NP_ENABLE · NPT 表项位布局 · 二维遍历 · NPF · 内存类型合并 · ASID · TLB_CONTROL · INVLPGA。

## 必须交付

1. **NPT 表项逐位布局，按层级给出**（PML4E / PDPE / PDE / PTE）。旧版只有一句"与 AMD64 长模式页表项完全相同"加一串字段名，**没有位号**。必须给出：P(0)、R/W(1)、U/S(2)、PWT(3)、PCD(4)、A(5)、D(6)、PS(7)、G(8)、可用位、物理地址域、NX(63)，每级的差异与保留位/MBZ 规则，以及 **C-bit 在 NPT 表项中的位置与含义**（交叉引用 `11-memory-encryption.md`）。
   - 关键：nested 表项的 U/S 与 R/W 在嵌套遍历中的语义与普通分页不同，必须按 AMD 原文表述，不要照搬 Intel EPT 的直觉。
2. **nCR3 与 NP_ENABLE**：VMCB 偏移（引用 `02`）、对齐与保留位规则、由 VMRUN 装载且不回写。
3. **二维遍历**：完整推导最坏 **24** 次访存；说明 `#NPF` 与 guest `#PF` 的先后判定顺序。**删除"原生 4 次变 16 次"的说法**（errata）。
   - **锚点有硬性要求（核验结论）**：24 这个数**在 APM 和 Intel SDM 里都不存在**——两者都只给每一维的遍历长度。它的一手出处是 **AMD-V™ Nested Paging 白皮书 Rev 1.0（2008-07）§4.2.2**（"can increase from 4 memory references … to **24** in nested paging"）与 **Bhargava 等（全部为 AMD 作者）ASPLOS XIII 2008** 给出的通式 **`nm + n + m`**（与 `(n+1)(m+1)−1` 恒等）。**引用这两者之一，绝不要锚到 `[APM2 §15.25.x]`。** 白皮书的 developer.amd.com 原链已死，用 Internet Archive 副本。
   - **5 级分页（LA57）的 35 是推导值，不是被引用值**——没有任何公开来源陈述它。写出来时必须标为"按 `nm+n+m` 推导"，并置 `C:medium`。混合情形（一维 4 级、一维 5 级）为 29。
   - 被减掉的那个 1 是最终系统物理地址上取数据本身的那次访问——程序真正要的那次，不是一次翻译步骤。
4. **`#NPF` 完整定义**：EXITCODE `0x400`；EXITINFO1 的低位错误码（P/RW/US/RSV/ID/SS）与高位（**31 RMP、32 GUEST_FINAL、33 GUEST_PAGE、34 ENC、35 SIZEM、36 VMPL**——旧版整体错位一位，见 errata）；EXITINFO2 = 故障 gPA。位号的详细表在 `05`，本章给语义并交叉引用。
5. **内存类型合并规则**：guest PAT（VMCB `268h` G_PAT）、host MTRR、NP_ENABLE=1 时的组合规则。**这一整节在旧库中不存在**，是写正确的显存/MMIO 映射所必需的。
6. **ASID**：`Fn8000_000A EBX` NASID、ASID 0 保留给 host、ASID 标记 TLB 的语义、vCPU 迁移时的失效义务、与 SEV ASID 范围的关系（交叉引用 `12`）。
7. **TLB_CONTROL**：取值 0/1/3/7 的确切语义、FlushByAsid（`Fn8000_000A EDX[6]`）的依赖。
8. **INVLPGA**：语义、操作数、与 INVLPG 的区别、**Genoa/Turin 勘误**——必须给出勘误编号与 AMD 修订指南出处（旧版只有一个 LKML 链接，无编号），并说明 Linux KVM 在 NPT 路径上已弃用它。这条事实目前躺在 SKILL.md 的孤儿清单里，从未进入它所属的章节。
9. **术语**：统一用 AMD 的 `system physical address (sPA)`；**不得**使用 `HPA`；**删除**"gPA 被当作 host 虚拟地址(hVA) 经 nPT 翻译"这种表述——嵌套遍历中不存在 host 线性地址。
10. **Scope 标注**：本章硬件事实与 OS 无关；但需一句话指出在 Windows 上 NPT/SLAT 是 VBS/HVCI 的硬性前提（交叉引用 `16`）。
11. Open items。

## 明确移出本章

- NPT vs 影子分页的性能对比、NPT vs EPT 的生态对比、Agile Paging、大页收益数字 → `18-performance.md`（且必须带微架构 + hypervisor + benchmark + 年份）。旧版第 4 章有约 40% 是这类内容，其中"NPT 典型收益 15–30%"是无出处的作者综合，"最高 +23%" 来自 2008 年 AMD 营销数字经 AnandTech 再经 CSDN 转载。
- 统一 TLB / NTLB / PWC 的三层结构：**保留但降级**——它来自 2008 年 Opteron 的论文，是微架构而非架构保证，必须明确标注这一点。

## 完成判据

- lint 零 error；本章不出现 `HPA`、不出现"16 次查表"。
- NPT 表项表覆盖四级且每级都有保留位说明。
- 内存类型合并一节存在且有 T1 锚点。
- `#NPF` 位号与 `05` 中的表一致（同一事实只有一个 owner，另一处是交叉引用）。

---

## 复检补充

- `#NPF` 的 EXITINFO1 **位表归 `05`**（复检裁决）；本章写语义、处理流程与 `#NPF` vs guest `#PF` 的判定顺序，位号交叉引用。
- **补 GMET（Guest Mode Execute Trap，`Fn8000_000A EDX[17]`）** —— 新旧都没有。它是 Windows HVCI 在 AMD 上的硬件加速器，票 12 会引用本章。
- **补 ASID 耗尽与回收**：`NASID` 用完之后 VMM 怎么办（generation 计数、复用时的冲刷义务、ASID 0 保留）。旧版只报告了 `NASID` 的存在。注意与 SEV 的 ASID 复用协议（DEACTIVATE → WBINVD → DF_FLUSH，归 `12`）是两件事。
- **补 NPT 关闭时的影子分页**：`#PF`/CR3/INVLPG 的拦截纪律。写最小 hypervisor 的读者目前在新旧两版里都找不到任何内容。
- **补 NPT 下分页状态的双份复制**：CR0/CR3/CR4/EFER/PAT 各有 host 与 guest 两份，host CR3 进 host save area，**nCR3 从不回写**。
