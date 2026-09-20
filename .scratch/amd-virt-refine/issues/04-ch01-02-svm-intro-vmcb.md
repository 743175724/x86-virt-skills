# 04 · `01-svm-intro.md` + `02-vmcb.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **100–149**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D5, §D8

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


## `01-svm-intro.md`

**Maps to:** APM Vol.2 **§15.4 Enabling SVM** + **§15.30 SVM Related MSRs** + **App A MSR Cross-Reference**；CPUID 见 APM Vol.3 **App E**。（24593 Rev 3.45 / 24594 Rev 3.38，编号已核验）
**Owns:** EFER.SVME · VM_CR · VM_HSAVE_PA · SVM_KEY · `Fn8000_0001` 与 `Fn8000_000A` 全位表 · 启用失败判定链。

必须交付：

1. host / guest 两种操作模式的定义与边界（用 AMD 的措辞）。
2. **`Fn8000_0001 ECX` 与 SVM 相关的每一位**，至少包括 ECX[2]（SVM）与 ECX[12]（SKINIT/STGI/DEV）。旧版把八条指令全部归给 ECX[2]，这是错的（见 errata）。
3. **`Fn8000_000A` 完整位表**：EAX（SVM revision）、EBX（NASID）、EDX 逐位到 bit 31——旧版在 EDX[18] 截断，缺 GMET(17)、SpecCtrl(20)、TlbiCtl(24)、VNMI(25)、IbsVirt(26)、NestedVirtVmcbAddrChk(28)、BusLockThreshold(29)、IdleHltIntercept(30) 等。每位给出名称、含义、以及"哪一章讲它"。
4. **MSR 全表**：`EFER`(C000_0080h) 的 SVME 位、`VM_CR`(C001_0114h) 的 DPD/R_INIT/DIS_A20M/LOCK/SVMDIS、`VM_HSAVE_PA`(C001_0117h)、`SVM_KEY`(C001_0118h)、`TSC_RATIO`(C000_0104h)、`VIRT_SPEC_CTRL`(C001_011Fh)。旧版速查表**漏掉了 VM_CR 与 VM_HSAVE_PA**，而 SKILL.md 又把所有 MSR 查询路由到速查表。
5. **启用失败判定链**，且必须在链条顶端放 Windows 事实：CPUID 探测 → `VM_CR.SVMDIS`/BIOS 锁定 → `EFER.SVME` → **但在 Windows 上，若 VBS/WSL2/沙盒/Hyper-V 已启用，SVM 已被 Windows hypervisor 占据**，交叉引用 `16-windows-platform.md`。旧版的探测链在 Windows 上会给出错误答案。
6. 章末 **Open items** 节。

## `02-vmcb.md`

**Maps to:** APM Vol.2 **App B "VMCB Layout"**（含 B.1 Guest MSR Intercepts）+ **§15.15 VMCB State Caching**。（Rev 3.45，已核验；该附录在 Rev 3.30 时标题为 "Layout of VMCB"，字母 B 未变）
**Owns:** VMCB 控制区与保存区的全部字段偏移 · clean bits 分组 · VMCB 状态缓存语义。

必须交付：

1. **控制区 0x000–0x3FF 逐字段偏移表**。验收标准是"读者不查 PDF 就能构造一个 VMCB"。旧版只有 14 行摘要，且已知缺失/错误：
   - `03Ch` PAUSE Filter Threshold、`03Eh` PAUSE Filter Count 被错标为"保留 MBZ"；
   - `0B8h` VIRT_EXT（LBR virtualization enable / VLS enable）**全库不存在**；
   - `08Ch` EXITINTINFO error code、`098h` AVIC APIC_BAR、`0E0h`/`0F0h`/`0F8h` AVIC 指针、bus-lock 与 SEV 相关字段缺失。
2. **保存区逐字段偏移表**：**10 个段描述符必须各占一行**（旧版压成 "000h–098h" 一行，无法定位 FS.base）；补 `290h` LASTEXCP_TO；`0CAh` VMPL、`1E0h–1F0h` CET、`2E0h` SPEC_CTRL 必须各自成行（旧版把三个不相干偏移塞进一行）。
3. **clean bits 分组表**（旧版唯一来源是一个爱好者 hypervisor 的 README）。
4. VMCB 状态缓存的语义：哪些字段受 clean bit 保护、软件何时必须清位。
5. 章末 Open items。

## 共同约束

- 每条位号/偏移都必须落在 claim 行里，带 T1 锚点（`[APM2 App.B]` 或 `[APM2 Table B-1]` 这类形式）+ `[N]` + `C:` + `V:durable`。
- **不得**引用 33047（2005 SVM 手册）作为现行布局的出处；它只能出现在历史陈述里。旧版 `[^1^]` 被用了 62 次，其中 48 次在 VMCB 章——这些全部要重新锚定。
- 不得从 Wikipedia / CSDN / 论坛 / `vlsiworlds.com` 镜像取任何位号。
- 与 `03`/`05` 的边界：本章只给**布局**，拦截位的语义在 `03`，退出码与 EXITINFO 的语义在 `05`。

## 完成判据

- `node tools/lint.mjs amd-virtualization` 对这两个文件零 error。
- 抽查 10 个字段偏移，能在 AMD 官方 PDF 对应表中逐一核到。
- `01` 的 CPUID 表覆盖 EDX 全部已定义位；`02` 的控制区表无地址空洞（空洞必须显式标注 reserved 并给出范围）。

---

## 复检补充

- **不要写 APM 的表号。** 本票正文出现过 `[APM2 Table B-1]` 这类示例——**D2 的核验只到附录级，从未读取 App B / App C 的表号**。写一个没核过的表号，正是本项目定义的最大风险（"看起来像官方来源的错误引用"）。锚点写 `[APM2 App.B]`；除非你自己在 PDF 里核到了表号，才可以升级。
- **`02` 必须给段属性编码，不只是偏移。** 打包的 12 位 `attrib`（TYPE/S/DPL/P/AVL/L/D/B/G）、**CPL 取自 VMCB 的 CPL 字段而非 SS.DPL**、空段以 P 位判定（CS/TR 永不为空）、base 在 VMRUN/#VMEXIT 上的规范化。只给偏移的话，本票自己的验收标准"读者不查 PDF 就能构造一个 VMCB"不成立。
- **`02` 补 `INT_STATE`（0x068）中断影子** —— 初稿的必备字段表和票 07 的 INT_CTL 位表都没点名它，会整条漏掉。
- **`02` 补 clean bits 与嵌套分页/ASID 的交互**：哪个 clean bit 覆盖 `nCR3`/`G_PAT`；**修改嵌套页表的内容对 clean bits 不可见**，必须走 `TLB_CONTROL`/`INVLPGA`；clean bits 是每逻辑 CPU 的，迁移后必须全脏 + 新 ASID。这是"硬件用了陈旧状态"类 bug 的头号来源，新旧计划都没写。
- **`01` 补 `VM_HSAVE_PA` 的契约**：host save area 的格式**被有意不规定**，实现可以把 host 状态留在片上，**软件不得读取它**。
- **`01` 补一条标准纪律**：固件可以单独屏蔽 `Fn8000_000A` 的某一位，**必须逐位探测、不得按代际推断**；客户端 Ryzen 没有公开修订指南（见 spec §D2 结论 3），所以"这代应该有"是不可用的推理。
- `#NPF` 的 EXITINFO1 位表归 `05`（复检裁决），本票不复述。
