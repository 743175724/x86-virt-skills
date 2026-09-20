# 14 · `18-performance.md` + `19-comparison-intel-arm-riscv.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **550–579**（`18`）· **580–609**（`19`）
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D9

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


## `18-performance.md`（改为 Windows PC 开销）

**Owns:** 全部性能数字。任何数字只能在这里有 owner，其他章引用。

1. **每个数字必须带四要素**：微架构、hypervisor / 内核版本、benchmark、年份。做不到就不要收录。旧版有一批数字缺要素：
   - "NPT 相对影子分页最高 +23%" —— 2008 年 AMD 营销数字经 AnandTech 再经 CSDN 转载，被当作测量陈述；
   - **"NPT 典型收益 15–30%"** —— 无出处的作者综合，同章的"局限"小节自己都不认它；
   - "大页给内存密集负载 +10–30%" —— 唯一出处是主机商营销页（可辩护的数字是 ASPLOS'08 的 +3–22%）；
   - "不钉核慢约 3 倍" —— Proxmox 论坛轶事；
   - "约 5% DMA 开销" —— K8s 博客；
   - SUSE 的 "really close to zero" —— 厂商定性说法，不得与测量并列。
2. **修正标题与正文不符**：旧版 §13.1.1 标题写 "#VC+GHCB 最高再放大 6.8 倍"，而正文里 6.8× 是 **TDX** 的数、SNP 是 +240%；同段又给 TDX "+472%"，两数无法调和。标题不得承载数字。
3. **冲突的测量并列呈现**并说明差异来源（SNP vs TDX 的内存开销在旧版有两组符号相反的结果，分别出现在 13 与 14 章）。**永不平均冲突测量**。
4. **重心转为 Windows PC**：VBS/HVCI 对客户端与游戏的影响、WSL2 与实用 VM 的开销、第三方 VMM 跑在 WHP 之上 vs 裸 SVM、PC 上的嵌套开销、NPT/大页在客户端的收益。
5. **删除**云规模整合、NFV、数据中心能耗、EPYC 调优指南（58002/58004）、SR-IOV 性能、SLES EPYC 指南等服务器内容；确需保留的做成末尾一节并标注服务器范围。
6. 若某个方向没有可信的现代测量，**明说没有**——报告空白优于外推。旧版最新的硬数字是 2008–2009 年的 Barcelona/ESX 平台，却被用来支撑"典型收益"的结论。
7. Open items。

## `19-comparison-intel-arm-riscv.md`

**Owns:** AMD 与 Intel / ARM / RISC-V 的架构对照（AMD 侧视角）。

1. 与 `intel-vt/18-comparison-amd-arm-riscv.md` **互为镜像**：同一组对照事实，两边视角。写作时应读一遍对面那一章，保证术语与结论不冲突（矛盾即为缺陷）。
2. 必须覆盖的对照点：VMCB vs VMCS（**VMCB 布局公开、VMCS 不透明且需 VMREAD/VMWRITE**）、NPT vs EPT（表项格式、权限位、错误码）、**ASID vs PCID+VPID**、AVIC vs APICv/posted interrupts、GIF 在 Intel 侧无对应物、**AMD 无 VMCS shadowing 对应物**（交叉引用 `15`）、AMD-Vi vs VT-d、SEV-SNP vs TDX 的信任模型差异、ARM stage-2 与 RISC-V H 扩展的对位。
3. **标注哪些特性是服务器专属、客户端 PC 上不存在**（SEV 全家 vs TDX 全家；SR-IOV；Secure AVIC）。
4. **删除**市场份额、云厂商框架、营销口径的性能对比；GA 日期与产品状态 → `90`。
5. Open items。

## 完成判据

- lint 零 error；`18` 中每条性能 claim 都能看到四要素，不满足的已删除或改为归属语气。
- 全库性能数字只在 `18` 有 owner（`06`/`07`/`08`–`10`/`12`–`14` 中的数字全部改为交叉引用）。
- `19` 与 `intel-vt/18` 对读无矛盾；两边对 "AMD ASID vs Intel PCID/VPID" 的表述一致。
