# 10 · `12-sev.md` + `13-sev-es-ghcb.md` + `14-sev-snp.md`（服务器范围，保留全深度）

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **350–429**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D8, §D9

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**范围声明（用户已裁定）**：这三章按服务器范围标注，**但内容深度不削减**。每章开头必须写明：服务器/机密计算专题；客户端 Windows PC 上不存在（`Fn8000_001F EAX[1]` 在 Ryzen 上读 0）；仅在问题涉及 EPYC 时阅读。客户端相关的 SME/TSME/C-bit 属 `11-memory-encryption.md`。

**引用前提**：旧版这三章的规范性事实来自中文博客转录的 APM（`icode.best`）、DeepWiki（AI 生成）、Edgeless/confidential.ai 第三方文档、某个 GitHub 的 `ATTESTATION_STATUS.md`、SPIRE 的 GitHub issue、zenn.dev 的习题答案、Level1Techs 论坛、快科技/芯智讯。**#56860 从未被真正引用过**，却做了约 12 处 "56860 Table N" 的断言。全部重新锚定到 AMD 官方 PDF。

## `12-sev.md` — Maps to **#55766 Rev 3.24**（2020-04）+ APM Vol.2 **§15.34**

结构（已核验）：Ch.1 Overview · **Ch.2 Key Management** · **Ch.3 Guest Policy** · Ch.4 Mailbox Register Protocol（**4.4 Command Identifiers**、**4.5 Status Codes**）· **Ch.5 Platform Management API**（5.2 INIT … 5.15 RING_BUFFER）· **Ch.6 Guest Management API**（6.2 LAUNCH_START … 6.8 ATTESTATON〔AMD 原文拼写如此〕… 6.11 SEND_UPDATE_VMSA）。封面同时写 "Revision 3.24" 与 "API Version 0.24 / Technical Preview"——**引用出版修订 3.24**。本文档**只覆盖 SEV/SEV-ES，SNP 在 #56860**。

1. SEV 启用（VMCB `090h` bit 1）、ASID ↔ VEK 绑定、**ASID 范围划分**（`Fn8000_001F ECX` 与 `EDX` MinSevNoEsAsid）。
2. **ASID 复用协议**：DEACTIVATE → WBINVD → DF_FLUSH，以及 `SEV_RET_WBINVD_REQUIRED` / `DFFLUSH_REQUIRED` 的处理。旧版只有散文。
3. 密钥层次（PDH/PEK/OCA/CEK/VEK/TIK/TEK）与平台所有权模型。
4. **平台状态机与 guest 状态机全集**（旧版只给了五态，缺 UNINIT/SUPDATE/RUPDATE/SENT）。
5. **固件命令全表**：命令 ID、参数缓冲区、返回码。旧版只有按家族分组的名字列表。
6. **Guest policy 位图完整表**（含 API_MAJOR[23:16] / API_MINOR[31:24]，旧版停在 bit 5）。
7. 启动度量的计算（含 LD 累积规则与每条命令的度量贡献）、DBG_* 与 SEND/RECEIVE。
8. Open items。

## `13-sev-es-ghcb.md` — Maps to **#56421 Rev 2.04**（2025-01）+ APM Vol.2 **§15.35**

结构（已核验）：**§2.6 GHCB Layout** · **§2.3.1 GHCB MSR Protocol** · §2.3.2 GHCB GPA Registration · §2.2 Hypervisor Feature Support · §2.7 SNP Secrets Page · **§3.1 Automatic Exits / §3.2 Non-Automatic Exits** · §4.1 Invoking VMGEXIT · §4.3 SMP Booting · §4.4 NMIs · §4.5 Debug Register Support · §4.6 SMM · §4.7 Nested Virtualization · **§5 SNP Restricted Injection**。无附录。APM 侧：**§15.35.5 #VC · §15.35.6 VMGEXIT · §15.35.7 GHCB · §15.35.9 Automatic Exits**。

1. **VMSA 字段表**（旧版完全没有，只说"布局即内核的 `struct vmcb_save_area`"）、VMSA 加密与校验、与 LBR virtualization 的依赖。
2. **`#VC`（vector 29）契约**：何时产生、guest 侧处理器的义务。
3. **GHCB 字段偏移全表** —— 旧版整章**只公布了一个偏移**（`sw_exit_code` 0x390）。必须补齐 `sw_exit_info_1/2`、`sw_scratch`、`xcr0`、`valid_bitmap`(0x3F0)、`shared_buffer`(0x800)、`protocol_version`(0xFFA)、`ghcb_usage`(0xFFC)，以及 `valid_bitmap` 的逐字段位索引规则与 `ghcb_usage` 取值。
4. **GHCB MSR 协议（`C001_0130h`）请求/响应码全表**与版本协商规则、hypervisor feature 位表。
5. **AE / NAE 分类与 NAE 事件全表**：每个事件需要哪些 GHCB 字段有效——这正是写 `#VC` 处理器要查的东西。旧版只有约 7 行示例。补 `0x8000_0004` AP_RESET_HOLD、`0x8000_0012` Extended Guest Request、`0x8000_0013` AP Creation、`0x8000_0018` SNP_RUN_VMPL、`0x8000_FFFD` HV Features、`0x8000_FFFF` Termination。
6. **AP 启动**：AP jump table 格式、AP Reset Hold 协议、SNP AP Creation 的 EXITINFO 编码。旧版只有一个 bullet。
7. VMGEXIT 的编码与语义。**⚠️ 这一条本票原先写反了**：初稿要求"把 `F2` 变体删掉，只留 `F3 0F 01 D9`"——**核验结果是旧版正确，`F2` 与 `F3` 两个前缀都有效**（`F2/F3 0F 01 D9`）。按初稿执行会**引入一个新错误**。照 AMD 原文写两种前缀。
8. Open items。

## `14-sev-snp.md` — Maps to APM Vol.2 **§15.36** + **#56860 Rev 1.59** + **#58019 Rev 1.01** + #57230/#58369

已核验锚点：APM **§15.36**（.3 Reverse Map Table · .4 Initializing the RMP · .5 Hypervisor RMP Management · .6 页验证 · **.7 Virtual Machine Privilege Levels** · .8 vTOM · .10 RMP+VMPL 访问检查 · .18 Secure TSC · .21 Secure AVIC · .22 Segmented RMP · .23 Guest Intercept Control）；**#56860**（**Ch.8 Command Reference** · **§7.3 Attestation —— ATTESTATION_REPORT 是其中的 Table 27，不是小节号** · **§2.3 TCB_VERSION**，按产品分表 Table 3 Venice / Table 4 Turin / Table 5 Genoa·Milan；Ch.5 Page Management · Ch.6 Mailbox Protocol · App A–D）；**#58019**（§4 Discovery · **§5 Calling Convention** · §6 Core Protocol · §7 Attestation · §8 vTPM · §9 APIC Emulation · §10 UEFI MM）。

**六条 SNP 指令全部在 APM Vol.3 §4**（按字母排序、只有页码）：PVALIDATE p.435 · RMPADJUST p.447 · RMPUPDATE p.457 · PSMASH p.432 · RMPQUERY p.451 · RMPREAD p.454（Rev 3.38）。**它们不在 Vol.2、不在任何附录。**

1. **RMP 条目逐字段布局**（Assigned、Page Size、Immutable、ASID、VMSA、Validated、GPA、VMPL0–3 权限）。旧版是一句散文。
2. **每类访问的 RMP 检查规则表**（guest private / guest shared / hypervisor / IOMMU / 页表遍历）。
3. **完整页状态集**：Hypervisor / Guest-Invalid / Guest-Valid / Firmware / Reclaim / Metadata / Context / Pre-Guest / Pre-Swap / Hypervisor-Fixed。旧版只有 3 个软件可见状态，导致 SWAP_OUT/IN、PAGE_MOVE、guest context 页无法理解。
4. **SNP 指令语义**：PVALIDATE / RMPADJUST / RMPUPDATE / PSMASH / RMPREAD / RMPQUERY —— 操作数、标志位约定（含 PVALIDATE 的 CF 语义）、错误码全集（旧版只有 `FAIL_OVERLAP=4`）。编码取自 APM Vol.3。
5. **`#VMEXIT(NPF)` 的 RMP 相关位**（31 RMP / 34 ENC / 35 SIZEM / 36 VMPL —— errata，旧版整体错位一位）；详表在 `05`，本章给语义。
6. **VMPL 模型**：每 VMPL 一个 VMSA、RMPADJUST 权限掩码编码、VMPL 切换（`SNP_RUN_VMPL`）、VMPL0 引导序列。
7. **Restricted / Alternate Injection**、Secure TSC、Ciphertext Hiding、Segmented RMP 的机制（旧版全是口号级提及）。
8. **RMP 覆盖与容量**：RMP_BASE/RMP_END、每页 16 B 的定容公式、"RMP 必须覆盖全部系统内存"的推导。
9. **SNP 固件命令**：SNP_INIT/_EX、GCTX、LAUNCH_START/UPDATE/FINISH、ACTIVATE、PAGE_MOVE/MD_INIT/SWAP_OUT/SWAP_IN/SET_STATE、SNP_CONFIG/COMMIT、GUEST_REQUEST 消息集 —— 命令 ID、参数、顺序约束。
10. **ATTESTATION_REPORT 逐字段偏移与长度** + **TCB_VERSION 的字节编码** + PLATFORM_INFO 位 + GUEST_POLICY（含 bit 17 保留必须为 1 —— 旧版表里缺这一位，导致它无法解释自己引用的 `policy=0x30000`）+ ID block / ID auth + 迁移代理。报告版本号需从 #56860 重新核实（旧版的 "v5" 无 AMD 出处）。
11. **SVSM（#58019）**：secrets page 的发现字段（`svsm_base` 0x140 / `svsm_size` 0x148 / `svsm_caa` 0x150 / `svsm_max_version` 0x158 / `svsm_guest_vmpl` 0x15C）、**调用约定与 Calling Area 布局、结果码、协议族**——旧版说 #58019"定义了调用约定"然后再无下文。
12. **证明 PKI**：ARK/ASK/ASVK → VCEK/VLEK 派生、KDS 端点与查询参数、ReportedTcb ≥ baseline 的验证方规则、CRL 粒度限制。
13. Open items。

## 明确移出这三章

- 全部 CVE 叙述 → `17-security.md`（每处只留一句"该机制为何存在"的指针）。旧版在 08/09/10 与 11 之间三重重复且互相矛盾（SEVurity/SEVerity 混淆、CVE-2024-25744 错挂）。
- 固件版本、ABI 修订史、内核/QEMU/libvirt 版本、云可用性、EPYC 代际表、密钥槽数代际值 → `90`。
- 性能数字 → `18`（带条件）。

## 完成判据

- lint 零 error；三章引用链路中不出现 `icode.best` / DeepWiki / Edgeless / zenn.dev / 论坛 / 快科技。
- **#56860、#56421、#55766 必须以 PDF 本体进入 bibliography 并被实际引用**，而不是门户页或修订历史页。
- 抽查：RMP 条目、GHCB 布局、ATTESTATION_REPORT 三张表都能逐字段对上官方 PDF。
- `Fn8000_001F EAX[4]` 与 `SEV_STATUS (C001_0131h)` 的全部位在本组章节中有 owner。

---

## 复检补充

- **`12` 的第 0 项：SEV/SNP 威胁模型陈述。** 什么被保护、什么不被保护（不防 DoS、不防侧信道、不防物理攻击；SEV 下 hypervisor 是"脆弱但良性"，SNP 下 hypervisor 被建模为恶意）。初稿的 13 个交付项里没有它，而它是每一个机密计算回答的框架。
- **`12` 拥有 `SEV_STATUS`（C001_0131h）全部位**（复检裁决）：SEV / SEV-ES / **SNP active(bit 2)** / vTOM / ReflectVC / Restricted Injection / Alternate Injection / Debug Swap / Secure TSC / VMSA Reg Prot。
- **`Fn8000_001F` 归 `11`**，本票不得重复发布该表，只交叉引用。
- **`14` 补 SNP CPUID page**：固件校验过的 CPUID 表在启动时注入，guest 自行核验否则终止（`GHCB_TERM_CPUID`）。这是"hypervisor 能不能对 SNP guest 谎报 CPUID"的具体答案。
- **`14` 补 RMP 的粒度约束**（是架构不是性能，初稿只有 `18` 会继承）：RMP 只在 4 KiB / 2 MiB 粒度工作，因此 **SNP 页不使用 1 GiB TLB 项**；RMP 更新会触发**全系统 TLB 失效**。
- **Secure AVIC 的 owner 定为 `14`。** 初稿写"归 `14` **或** `90`"——"或"等于没有 owner。
- **`14` 补 vTOM（§15.36.8）**：新旧都没有，而 Azure 的 OpenHCL paravisor 建在它上面，票 12 会指过来。
- **`14` 补 SVSM 的 APIC 仿真协议（#58019 §9）**：初稿只用"协议族"一笔带过；它是 VMPL0 服务如何接管 APIC 的答案。
- **`12` 补 SEV 证明的协议纪律**：验证必须在宿主**之外**的机器上进行；session 数据每次启动尝试必须唯一。这是安全模型规则，不是操作步骤。
- **执行单元**：本票是全组最重的一张（估算约 1,750 行）。拆成三个可独立认领、独立提交的单元——`12`（bib 350–379）、`13`（380–399）、`14`（400–429）。
