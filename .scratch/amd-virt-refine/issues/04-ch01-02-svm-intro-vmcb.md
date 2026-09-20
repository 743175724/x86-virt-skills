# 04 · `01-svm-intro.md` + `02-vmcb.md`

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **100–149**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D5, §D8

## `01-svm-intro.md`

**Maps to:** APM Vol.2 的 SVM 启用/模式小节 + SVM 相关 MSR 小节；CPUID 见 APM Vol.3 的 CPUID 附录。
**Owns:** EFER.SVME · VM_CR · VM_HSAVE_PA · SVM_KEY · `Fn8000_0001` 与 `Fn8000_000A` 全位表 · 启用失败判定链。

必须交付：

1. host / guest 两种操作模式的定义与边界（用 AMD 的措辞）。
2. **`Fn8000_0001 ECX` 与 SVM 相关的每一位**，至少包括 ECX[2]（SVM）与 ECX[12]（SKINIT/STGI/DEV）。旧版把八条指令全部归给 ECX[2]，这是错的（见 errata）。
3. **`Fn8000_000A` 完整位表**：EAX（SVM revision）、EBX（NASID）、EDX 逐位到 bit 31——旧版在 EDX[18] 截断，缺 GMET(17)、SpecCtrl(20)、TlbiCtl(24)、VNMI(25)、IbsVirt(26)、NestedVirtVmcbAddrChk(28)、BusLockThreshold(29)、IdleHltIntercept(30) 等。每位给出名称、含义、以及"哪一章讲它"。
4. **MSR 全表**：`EFER`(C000_0080h) 的 SVME 位、`VM_CR`(C001_0114h) 的 DPD/R_INIT/DIS_A20M/LOCK/SVMDIS、`VM_HSAVE_PA`(C001_0117h)、`SVM_KEY`(C001_0118h)、`TSC_RATIO`(C000_0104h)、`VIRT_SPEC_CTRL`(C001_011Fh)。旧版速查表**漏掉了 VM_CR 与 VM_HSAVE_PA**，而 SKILL.md 又把所有 MSR 查询路由到速查表。
5. **启用失败判定链**，且必须在链条顶端放 Windows 事实：CPUID 探测 → `VM_CR.SVMDIS`/BIOS 锁定 → `EFER.SVME` → **但在 Windows 上，若 VBS/WSL2/沙盒/Hyper-V 已启用，SVM 已被 Windows hypervisor 占据**，交叉引用 `16-windows-platform.md`。旧版的探测链在 Windows 上会给出错误答案。
6. 章末 **Open items** 节。

## `02-vmcb.md`

**Maps to:** APM Vol.2 的 VMCB 布局附录（含控制区表与保存区表）。
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
