# 深度复检记录（2026-09-20）

5 路并行复检的结论与裁决。spec 与工单已按下表修改；**未修改的项在文末"已记录但本轮不改"里，附理由**。

复检线程：A 勘误断言对 AMD PDF 逐条核验 · B spec/工单内部一致性 · C lint/build/eval 可实现性 · D 与 `intel-vt` 的交叉矛盾 · E 覆盖丢失与盲区。

---

## 0. 一条影响全局的环境事实

**本仓在本次工作期间被另一个会话并发修改。** 会话开始时 `eval/` 下只有 `RUNNER.md`；现在有 `questions.yaml`（80 题）、`README.md`、`results/` 下 6 份实跑报告、`answers/`、`verify/`，外加 `tools/install.mjs`。期间落地了 4 个提交（`52a4343`、`21ac437`、`e130c44`、`efc64b2`），其中 `e130c44` 还把本 spec 与工单 01–04 一并提交了。

后果：**spec 初稿里所有"现状"描述都必须以当前工作区为准重新确认**，不能引用会话早期的快照。T3 与票 01 已按此更正。

---

## 1. 裁决：事实归属冲突（B1–B3）

| 冲突 | 裁决 | 落点 |
|---|---|---|
| `#NPF` EXITINFO1 位表有三个 owner（D5 给 `06`，T05 放在 `05`，T10 又在 `14` 复述一遍） | **`05-exit-decoding.md` 独占位表**（读者拿着一个退出码来查，退出信息必须和退出码同处）；`06` 写 NPF 的**语义与处理流程**并交叉引用；`14` 只写 RMP 相关位的**含义**，位号引用 `05` | D5 改行；T05/T06/T10 改措辞 |
| `Fn8000_001F` 与 `SEV_STATUS` 双 owner | **`11-memory-encryption.md` 独占 `Fn8000_001F` 全部字段**（含 EAX[4] SEV-SNP——客户端读者也需要靠它判断"我没有"）；**`SEV_STATUS (C001_0131h)` 归 `12-sev.md`**，D5 原先漏了这一行 | D5 补行；T09/T10 改措辞 |
| GA log 的格式在 `09`、语义在 `10` | **`10-iommu-interrupt-remapping.md` 独占 GA log 的格式与语义**；`09` 不碰 | D5 确认；T08 改 |

## 2. 裁决：IOMMU 三章按"读者任务"重切（E）

原切法按规范章节走，但对三类真实读者都要跨文件。改为：

- **`08-iommu-architecture.md` = "硬件此刻在做什么"**：平台数据通路、MMIO 寄存器全位、Status Register、PCI 能力块、DTE 的**转换侧**字段、**事件日志 / PPR 日志 / GA 日志的条目格式**（从 `09` 移入——它们和指向它们的寄存器、以及日志本身出问题时要读的 Status Register 在一起才有用）。
- **`09-iommu-page-tables.md` = "我要建的表"**：v1/v2 页表、GCR3、命令格式、IVRS 解析。另加一节 **"端到端解一个 `IO_PAGE_FAULT`"**，内联涉及的 5 个 DTE 位。
- **`10-iommu-interrupt-remapping.md` 自足**：两种 IRTE + **DTE 的中断簇**（`IV`、`IntTabLen` 及 `2^n` 编码、`IntCtl`、Interrupt Table Root Pointer、`InitPass`/`NMIPass`/`EIntPass`/`Lint0Pass`/`Lint1Pass`）+ `INVALIDATE_INTERRUPT_TABLE` + GA log 语义 + GAPPI + ATS/PRI/PASID。

## 3. 裁决：`core-facts.md` 取消

E 指出 `00-quickref.md` 与 `core-facts.md` 是**两个干同一件事的导航文件**——这正是旧版 `15-appendix-quickref.md` 漂移成第二事实库的那个缝。**AMD 侧不设 `core-facts.md`**，导航职责全部归 `00-quickref.md`。

这与 `intel-vt` 不对称（它两个都有，且 `core-facts.md` 里有 54 条 claim 行），是**有意为之**：本技能的目标是少一个漂移点，不是与 Intel 形状一致。lint 的 `claimFreeFiles` 因此只需列 `00-quickref.md`。

## 4. 裁决：架构章带（B11）

`15-nested-virtualization.md` 的规范性内容只有 APM §15.33 一节，其余是内核与 Windows 的 T2 事实。若留在"每条断言必须有 T1"的带内，票 11 的"lint 零 error"永远达不到。

**架构章带改为 `01`–`14`。** `15` 进入 T2 允许带，但附加一条要求：**凡 APM §15.33 覆盖的机制，仍必须带 `[APM2 §15.33]` 锚点**，由 review 把关而不是 lint。

## 5. 裁决：不要把 `intel-vt/17` 镜像成 AMD 的 `16`（D）

`intel-vt/17-windows-platform.md` 约 75% 是**厂商无关**的 Windows 事实（分区模型、hypercall ABI、SynIC MSR 表、VMBus、VTL、调度器、enlightenment、WHP、WSL2/Sandbox/Docker、HVCI 页级行为、症状表）。照搬就是制造第二份会漂移的副本。

**`16-windows-platform.md` 只写 AMD delta**（约 12 条）：`hvax64.exe` · `EFER.SVME` 占据关系与"探测链在 Windows 上给错答案" · VBS/HVCI 的 AMD 硬件前提（NPT/GMET/AMD-Vi）· Kernel DMA Protection 走 **AMD-Vi/IVRS** · **AMD 无 eVMCS** · AMD 上嵌套受支持及开启方式 · WHP 与 VBS 共存（Workstation 15.5.5 / VirtualBox 6.1 起）· AM4/AM5 固件项 · DDA vs GPU-P · SME/TSME 在 Ryzen 上有而 SEV 没有 · `CPUID 0x40000000` · Windows 侧诊断手段。

**但有一条 D 没有权衡到的约束**：跨技能交叉引用会在"只装了 AMD 技能"的场景下悬空。因此 `16` 对**它自己必须回答的问题**保持自足（每条 AMD delta 连同必要的一句话背景），只把**深度**（完整 synthetic MSR 表、VMBus 环、调度器细节）交叉引用出去。

## 6. 新增两张票

- **票 18（`ready-for-agent`）跨技能契约**：检索层消歧漏洞（两边 description 加否定标记）、两边 Scope boundaries 逐字措辞、跨技能事实所有权表、`SNP`/`RVI` 两处术语碰撞、ARM/RISC-V 归属。
- **票 19（`needs-info`，待用户裁决）`intel-vt` 侧四处修正**：AMD 官方文档 URL 全部失效、`17` 的四句话对 AMD 主机错或不完整（尤其 `17:205-208` 把 Kernel DMA Protection 说成 Intel VT-d）、`18.11` 对客户端内存加密的表述与 AMD `11` 冲突、AVIC erratum #1235 一边已裁定一边是未决冲突。**它超出 spec 的 Out of Scope 第一条，不经用户批准不动手。**

## 7. 覆盖回归：必须补回的 15 个主题（E Pass 1）

已写进对应工单。按严重度：

**真回归（旧版有、新计划无处可去）**：SEV/SNP 威胁模型陈述（`12` 首节）· 拦截优先级与顺序（`03`，APM §15.7）· VMCB 段属性 12 位打包编码与 CPL 来源（`02`——只给偏移不给属性编码，"照着就能建 VMCB"这条验收标准就不成立）· 硬件加速 vIOMMU（§2.10，是**耐久架构**不是时效内容，不要丢进 `90`）· Secure AVIC（原文写"归 `14` **或** `90`"＝没有 owner → 定为 `14`）· SNP CPUID page 与 `GHCB_TERM_CPUID`（`14`）· C-bit 缓存一致性冲刷规则（`11`）· RMP 粒度约束：只支持 4 KiB/2 MiB 故 SNP 页不用 1 GiB TLB 项、RMP 更新触发全系统 TLB 失效（`14`，这是架构不是性能）。

**次要但值得保留**：VMRUN 的**否定清单**（RIP 越 CS 限/非规范地址**不是**一致性失败，按 guest `#GP` 投递；paged real mode 合法）· `VM_HSAVE_PA` 保存区格式**被有意不规定**、软件不得读取 · 保留的 `TLB_CONTROL` 编码 VMRUN **不校验** · `IO_PAGE_FAULT` **不可恢复**（这是"为什么我的直通设备直接死掉而不是重试"的答案）· NPT 下分页状态的 host/guest 双份复制 · 分段 Device Table 与 IOMMU 请求类型路由规则 · SEV 证明的协议纪律（验证必须在宿主之外、session 数据每次启动唯一）。

**近漏**：`INT_STATE (0x068)` 中断影子——`02` 的必备表和 `07` 的投递算法都没点名它。

## 8. 盲区：新旧都没有、现在排进计划的 16 项（E Pass 2）

按用户真会问到的概率排序，已分配 owner：PMU/IBS 虚拟化（§15.38/§15.39 → `03`，原先只在 `Maps to:` 里挂着没有交付项）· **VMCB clean bits × 嵌套分页/ASID 的交互**（`02` 主 + `06` 交叉；"硬件用了陈旧状态"类 bug 的头号来源）· **VLS 语义**（`04`；旧版宣传了这个特性位却从不定义它，新计划原样继承了这个缺陷）· INIT/SIPI 与 AP 拉起、`#SX`（`04`）· 调试寄存器虚拟化与 DebugSwap（`03` + `13`）· **SMM under SVM 与 APM Vol.2 附录 D "SMM Containerization"**（整个附录原先零 owner → SMI 拦截语义归 `03`，附录 D 归 `17`）· GMET（`06`）· TSC 合成规则与 Secure TSC（`03` + `14`）· vTOM（`14`，且 `16` 要指过去——Azure 的 OpenHCL 建在它上面）· CET/影子栈虚拟化（字段在 `02`，机制在 `03`）· ASID 耗尽与回收（`06`）· Bus Lock Threshold 与 IdleHlt 语义（`03`）· **NPT 关闭时的影子分页**（`06`；写最小 hypervisor 的人现在什么也找不到）· MCOMMIT（`04`）· SVSM APIC 仿真协议 §9（`14`）· **勘误驱动的特性屏蔽纪律**（`01` + `17`：固件可以单独屏蔽 `Fn8000_000A` 的某一位，必须逐位探测、不得按代际推断；客户端 Ryzen 没有公开修订指南）。

## 9. 图片处置：具体清单（E Pass 3）

票 03 原先只给了政策，现在有逐张结论：**删 8**（`sec01_sev_key_slots` 孤儿且数值是未决冲突 · `sec03_vmcb_layout` 图注自承"块高不代表字节数" · `sec03_exitcode_map` 编码了被勘误推翻的"退出码=位序"规则 · `sec05_avic_benefit` 单一 T3 来源 · `sec06_io_page_levels` 把架构常量表画成图 · `sec07_hugepage_tlb` 纯算术无测量 · `sec08_asid_keys_evolution` 代际映射是未决冲突 · `sec11_attack_surface_timeline` 画的是把 CVE-2024-25744 错挂到 SNP 的那张表）；**移入 `90` 3 张**（`sec05_avic_timeline`、`sec10_abi_timeline`、`sec12_kvm_sev_timeline`）；**保留 2 张**（`sec13_sev_gen_overhead` 四要素齐全；`sec14_snp_vs_tdx` **有条件保留**——必须与它相矛盾的 Phoronix 结果并列）；**1 张待判**（`sec04_npt_vs_shadow` 是唯一带真实分源测量的图，但全是 Barcelona 代平台且一条来源链是 AMD→AnandTech→CSDN）。

## 10. 工具链：C 线程的硬发现

- `node tools/lint.mjs intel-vt` 当前 **exit 0，零警告**（22 章 / 314 条 bibliography / 2505 条 claim）；`build --check` 通过。
- `node tools/lint.mjs amd-virtualization` 报 81 error / 495 warning，**但这个数字没有诊断价值**：80 个 error 是 lint 拿仓库根的 *Intel* 题库去校验 AMD 章节造成的串台；478 个 warning 是"条目从未被引用"，因为 AMD 语料里**一条 claim 行都没有**——规则 1–5、7 在 AMD 上不是失败，是根本没运行。
- **规则 6（黑名单域名）与规则 8（归属）目前是空转**：规则 6 只在章节正文做字面匹配，而 `bibliography.md` 不在被扫描的文件集内（证据：`intel-vt` 的 bibliography 里此刻就有 `juejin.cn`、`xem.github.io`、`blog.csdn.net`，lint 依然 clean）；规则 8 实测 **73 条 claim 命中非 owner 主题、73 条全被豁免子句吞掉、实际输出 0 条警告**。
- **最危险的一次编辑**：`tools/lint.mjs:322` 硬编码 `join(ROOT,'eval','questions.yaml')`。题库迁移时不同步改这一行，题库校验整段被跳过而 lint 仍打印 `lint clean`——**向"更干净"的方向静默失败**。
- 另外三处硬编码：`id > 25` 的 bibliography 预置阈值（AMD 预置区是 1–40）、`isCorrection` 闭包（Intel 味的关键词表，且是两条规则共用的豁免开关）、`tools/install.mjs` 的 `const SRC/NAME = 'intel-vt'`。
- 回归验证**必须带两个阳性对照**，只做 diff 证明不了任何事——因为最危险的两种破坏都是静默失败：(a) 临时改名题库，确认 lint **会**报缺失；(b) 往草稿章节注入一条已知讹传，确认 JSON 来源的正则**仍会**命中。

---

## 已记录但本轮不改

- **票 05/08/10 体量失衡**（B 估算分别约 1,550 / 1,600 / 1,750 行，而单章票约 350–500 行）。不重新编号拆票——重编号会打断已有的相互引用。改为在这三张票里显式标注**执行单元**（一章一个，可独立认领、独立提交），并按章细分 bibliography ID 子区段。
- **`intel-vt` 把 AMD 官方规范标为 T2、AMD 侧标为 T1**。这是每技能一份 tier 表的正常结果（对 Intel 技能而言 AMD 文档确实是旁证），不是矛盾。共享 lint 用每技能配置即可，不统一。
- **两边锚点语法不同**（Intel 写 `[AMD APM 2 Ch.15]`，AMD 写 `[APM2 §15.25]`）。同上，每技能语法各自成立，**不要去"统一"它**——统一会让 `intel-vt` 从 lint clean 变成大面积报错。
- **`17-security.md` 同时承载 CVE 矩阵与 SKINIT/DRTM**。保留在一章，但要求两个独立的 `Owns:` 条目与硬性内部分节（§17.1 CVE 矩阵、§17.2 SKINIT/DRTM）。SKINIT 是 APM §15.27 的架构内容，移进 Windows 章会失去 T1 锚定。
- **D6 的百分比与 Problem Statement 的百分比不一致**（40/80/90 vs 21/65/74 行、40/85/95 字符）。两组数分别是"按行"与"按字符"，已在 D6 标注口径，不强行统一。

---

# 附录 A · 33 条断言的逐条核验结果（2026-09-20）

**这是 errata、lint 讹传规则与评测答案键的唯一权威来源。** 三者派生自同一批断言，任何一条改动都必须同时更新三处。核验方式：下载 AMD 官方 PDF 读正文，NVD REST API 取 CVSS，AMD 安全公告取 CVE 口径。

## A.1 我提出的"更正"本身是错的（5 条，实施会造成真实损害）

| # | 我原先的主张 | 核验结果 |
|---|---|---|
| **22** | VMGEXIT 只有 `F3 0F 01 D9`，旧版的 `F2` 变体"需锚点否则删除" | **24594 Ch.4 p.502 的 opcode 表写的就是 `F2/F3 0F 01 D9`**。两个前缀都是架构规定。按我的指示做会**删掉正确内容，还会把旧版正确的地方标成缺陷** |
| **5** | IVRS 设备条目 `80h–BFh → 16 字节` | **48882 Table 103：`80h–FFh` 是"variable length"**，不存在 16 字节类。我那条是从 Linux 的 `0x04 << (type>>6)` 外推出来的 |
| **27** | CVE-2021-29657 的 CVSS 是 7.8，二手源的 7.4 是错的 | **NVD REST API：`baseScore 7.4`**（`CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H`，评分方 `nvd@nist.gov`）。**二手源是对的**，我的"更正"会用错值覆盖正确值 |
| **25** | CVE-2024-25744 是 Intel TDX 的内核问题，与 Heckler / SEV-SNP 无关 | **AMD-SB-3008 把 25742 / 25743 / 25744 全部归给 Heckler**；修复提交 `b82a8dbd3d2f` 的标题是 "Disable 32-bit emulation by default on TDX **and SEV**"，改的是 `mem_encrypt_amd.c`。25744 不是 Intel 独有；25743 才是 AMD 专属的 interrupt-0/14 那一半。论文发表于 **USENIX Security 2024** |
| **31** | SEV/SEV-ES/SEV-SNP 仅 EPYC；`Fn8000_001F EAX[1]` 在客户端 Ryzen 上读 0 | **REFUTED**。InstLatX64 的 CPUID 转储显示 **Ryzen 9 3900X 与 5800X3D（非 PRO 的消费级）`EAX[1]=1`，509 个 ASID**。Zen 4 客户端起才只剩 SME。正确口径：**SEV 是 EPYC 上被产品化，不是在 Zen 4 之前的客户端硅片上不存在**；SEV-SNP 则确实从未在客户端置位 |

第 31 条影响面最大：spec 的 D9、三章的 Scope 声明、一道必考陷阱题全部建立在"客户端读 0"之上。已按正确口径改写。

## A.2 确认成立，但附带改变写法的限定（9 条）

| # | 结论 |
|---|---|
| 2 | IOMMU MMIO 窗口 **16 KiB 只在 `MMIO 0030h[PCSup] = 0` 时成立；PCSup = 1 时是 512 KiB**（48882 §2.3）。"14 KiB" 是把 `BaseAddress[31:14]` 读错了 |
| 4 | 位号全部确认，但拼写是 **`PPREn`** 不是 `PprEn` |
| 6 | `IntTabLen` 的 `2^n` **只在 0–11 成立**（最大 2048 项），`11xxb` 保留 |
| 8 | AMD 的原文是"**at least** the following"——不是封闭列表；**host LDTR 明确不恢复**。字段是 RAX/RSP/**NEXT_RIP**/CR0/CR3/CR4/EFER/IDTR/GDTR，并"Forces CR0.PE = 1" |
| 13 | x2AVIC = EDX[18] 确认；**EDX[14] 是 "— Reserved"**（EDX[13] = AVIC，**EDX[15] = VMSAVEvirt**，即 VLS） |
| 15 | VMCB 偏移全部确认，但两点要改：**`VMPL 0CAh` 只存在于 Table B-4（SEV-ES VMSA）**，Table B-2 的 0A0h–0CAh 是 RESERVED，且 0CAh/268h 是**保存区相对**偏移；**`VIRT_EXT` 在 Vol.2/Vol.3 里零命中**——那是 KVM 的名字，AMD 只说 "VMCB offset 0B8h" |
| 17 | **NPF 位号来自 AMD 原文而非 Linux 推导**（24593 §15.36.10 明写 "Bit 34 (ENC)… Bit 35 (SIZEM)… Bit 36 (VMPL)"，bit 31 RMP 见 §8.4.2/§15.36.10，bits 32/33 与 EXITINFO2 = 故障 gPA 见 §15.25.6）。**AMD 另外定义了 bit 37 (SSS)**——补上 |
| 20 | `SEV_STATUS` 位表大幅扩充：0/1/2 = SEV/SEV-ES/SNP_Active，3 vTOM，4 ReflectVC，5 RestrictedInjection，6 AlternateInjection，**7 = `DebugVirtualization`（"Debug Swap" 是 Linux 名字，AMD 文档零命中）**，11 SecureTsc，16 VmsaRegProt，18 SecureAVIC，23 IbpbOnEntry。**AMD 自己的表有排版缺陷**：在 "18 SecureAVIC" 正上方印着 "22-18 Reserved"，应为 22:19 |
| 24 | ATTESTATION_REPORT 的 VERSION **当前是 6h**；r1.57→3h、r1.58→5h、r1.59→6h，**4h 从未存在**。旧版的 "v2/v3/v5" 是过时值 |

## A.3 确认成立，且更正了细节（5 条）

- **26** — AMD-SB-1004 确实对应 CVE-2020-12967（SEVerity），但**该公告同时覆盖 CVE-2021-26311**；且 **SEVurity 的第一作者是 Luca Wilke，发表于 IEEE S&P 2020**——我在 spec 里写的 "Morbitzer et al." 是错的。
- **28** — RMPocalypse = **AMD-SB-3020**，CVE-2025-0033，Medium **6.0**，ETH Zurich；BadRAM = **AMD-SB-3015**，CVE-2024-21944，Medium 5.3，SPD 元数据。**AMD 从不印营销名**，矩阵里要以公告号为准。
- **29** — 公告原文是 "Applying mitigation CVE-2025-48514 will result in disabling **SEV-ES** when SEV-SNP is enabled"：**只禁用 SEV-ES（不是 SEV）**，触发条件是 SNP **已启用**（不是"支持 SNP"），影响跨 Zen 3/4/5。固件版本 1.37.23/1.37.31/1.37.41 确认。
- **30** — Microsoft 的原文是 "**AMD EPYC / Ryzen processor or later**"，宿主需 Windows Server 2022+ 或 Windows 11+，**VM 配置版本 9.3 或更高**。**Microsoft 没有点名任何 Zen 代际**——不要替它加。配置版本 9.3 这个前提我漏了。
- **32** — WHP 共存：Workstation **15.5.5** 起，Broadcom 称之为 "**Host VBS Mode**"，**有明确限制**（VM 更慢、**不支持嵌套**、无 PMC、无 RTM/HLE、无 PKU）。**VirtualBox 是 6.0 落地的，不是 6.1**；7.2 手册仍标实验性并附"性能很差"警告。
- **33** — `Hvix64/Hvax64/Hvaa64` 的出处是 **《Windows Internals, Part 2》第 7 版**，**不在 learn.microsoft.com 的产品文档里**。票 12 要求"Windows 事实一律引 Microsoft Learn"，这一条是例外，按 T2 书籍引用。

## A.4 干净确认（14 条，可直接进 errata 与评测答案）

1（`CmdBufRun` = Status 2020h **bit 4** 只读；`CmdBufEn` = Control 0018h bit 12）· 3（`RemapEn`，48882 Figure 15/Table 20 p.91，"RemapEn" 24 次命中 / "RemapEm" 0 次）· 7（vector 4 bit 0 → **80h VMEXIT_VMRUN**）· 9（VMLOAD/VMSAVE 字段集，SS 不在其中）· 10（"Any MBZ bit of CR4/EFER is set"；`CR4[63:11]` 与 `EFER[63:15]` 在 Rev 3.45 里零命中）· 11（ECX[2] SVM、ECX[12] "SKINIT and STGI"）· 12（EDX[3] NRIPS、`Fn8000_0001 ECX[10]` IBS）· 14（EDX[1] LbrVirt、[4] TscRateMsr、[6] FlushByAsid、[13] AVIC、[16] VGIF）· 16（24 次——**但只能锚到 AMD-V Nested Paging 白皮书 §4.2.2 或 ASPLOS'08，绝不能锚到 APM/SDM**；LA57 的 35 是推导值）· 18（`Fn8000_001F` 四个寄存器全部字段）· 19（SYSCFG C001_0010h，bit 23 `MemEncryptionMod**e**En`、24 SecureNestedPagingEn、25 VMPLEn）· 21（GHCB 五个偏移，56421 §2.6 Table 3）· 23（guest policy bit 17 "Must be one"，bit 16 SMT）· 28/33 见上。

## A.5 未经再核验前不得写进 lint 规则或评测答案

第 **2**（缺 `PCSup=0` 限定）· **6**（缺 0–11 上限）· **15**（`VMPL 0CAh` 的表归属与相对性；`VIRT_EXT` 不是 AMD 标识符）· **16**（出处不得写 APM/SDM；35 是推导值）· **20**（AMD 自己的表在 "22-18"/"18" 处自相矛盾）· **24**（版本号已过时）· **29**（只 SEV-ES、且是 SNP *已启用*）· **30**（不得断言 Zen 代际，须含配置版本 9.3）· **31**（基于 CPUID 的规则会在 Zen+/2/3 的客户端转储上误判）。
