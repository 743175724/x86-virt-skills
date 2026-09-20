# 15 · `90-dated-landscape.md` + `errata.md` + `core-facts.md` + `00-quickref.md`

Status: ready-for-agent
Type: task
Blocked by: 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14（需各章先定稿，本票做汇总层）
Bibliography ID 区段: **610–659**（`90`）· **660–699**（`errata`）
Spec: `.scratch/amd-virt-refine/spec.md` §D5, §D6, §D7

## `90-dated-landscape.md`（时效隔离区）

文件头强制包含：**as-of 日期**、"使用前必须以官方来源复核"声明、按类别分节。

分节与迁入范围（审计已逐条枚举，按行统计旧版 ch12 约 21% 行 / ch13 **65%** / ch14 **74%** 属此类）：

1. **EPYC / Ryzen 代际与产品状态**：代际特性表、密钥槽数 15/509/1006 与代际的对应（**四份副本中的三份要删，且代际归属本身待裁决**）、C-bit 代际取值、AES-XEX→AES-256-XTS 的分界、Turin/Venice 的特性与路线图、客户端 TSME 随 AGESA 增删的事件。
2. **固件与 ABI 修订**：SEV 固件版本、#56860/#56421/#55766 的修订号与日期、CVE 修复固件版本、AGESA 版本。
3. **内核 / QEMU / libvirt / 工具链合入版本**：KVM 模块参数默认值与变更年份、`KVM_CAP_VM_TYPES` 取值、SNP 的内核与 QEMU 版本、sevctl/snpguest/snphost 的替代关系、AVIC 默认开关的演进史与 erratum 影响、iommufd/vIOMMU 的主线动向。
4. **云与 CoCo 生态**：Azure/AWS/GCP 的实例族与 GA 日期、CoCo Operator/Trustee 版本、OpenHCL/VMPL0 的落地状态。
5. **路线图**：RMPOPT/ASAP/Caliptra/SEV-TIO/Secure AVIC 等未落地项。

**所有条目 `V:dated`**；lint 保证 `V:dated` 不出现在其他任何文件。厂商营销数字改归属语气或删除。

## `errata.md`

结构对标 `intel-vt/references/errata.md`：每条给中文讹传表述 + 英文表述 + 带 T1 锚点的正确 claim + owner 文件；末尾单设 **Open conflicts** 节，列出**不做裁决**的条目（引用时必须同时给出两种说法）。

- **Settled**：spec §D7 表中的全部条目（≥19 条）。
- **Open conflicts**：SEV 密钥槽数与代际的对应、AVIC erratum #1235 的真实披露年份、CVE-2021-29657 的 CVSS、SNP vs TDX 内存开销的两组相反测量、"NPT 相对影子分页 15–30%"是否有现代测量支撑、55766 的章节结构（旧版给出的 §1–§7 映射未经核实）。
- 每条必须有出处；找不到出处的条目要么删掉，要么明确标注"来源未核实"并配 `C:low`。
- 本文件是 lint MISCONCEPTIONS 规则的唯一豁免地。

## `core-facts.md`

**角色是带引用的索引，不是事实副本。** 每条要点携带 `[N]` 与 owner 文件的章节锚点，回答"这个事实归谁管、在哪一节"，**不复述数值**。旧版 SKILL.md 里那份"已裁定的关键事实"9 条孤儿清单在此解散：每条要么进入 owner 章的 claim 行，要么进入 `errata.md`。

## `00-quickref.md`

**纯导航层，不含任何权威数值**（这是修掉旧版"速查表变成第二事实库"的关键）。包含：

1. **AMD 文档号索引**：24593 / 24594 / 48882 / 55766 / 56421 / 56860 / 57230 / 58019 / 58369 / PPR / 安全公告，各给用途与对应章节。
2. **症状 → 章节** 路由：如"VMRUN 返回 VMEXIT_INVALID"、"看到 exit code 0x400"、"IOMMU 报 IO_PAGE_FAULT"、"Windows 上 VMM 起不来"、"msinfo32 显示 Kernel DMA Protection Off"。
3. **表格归属**：哪张表在哪一章（VMCB 偏移 → `02`、退出码 → `05`、DTE → `08`、IRTE → `10`、RMP → `14`…）。
4. **中英术语对照**。
5. **Windows PC 最常问的五个问题**的直达指针。

## 完成判据

- lint 零 error；`V:dated` 只在 `90` 出现。
- `00-quickref.md` 与 `core-facts.md` 中不含 claim 行（lint 规则 8）。
- 全库四份"密钥槽数"副本收敛为一处；`Fn8000_000A` 位表只有一个 owner。
- `errata.md` 每条都有 owner 文件与出处；Open conflicts 节非空。

---

## 复检补充

- **依赖倒置已修正**：`errata.md` 的 20 条已裁定条目改由**票 02** 播种（它们来自 spec §D7，不需要任何章节产出），本票只负责**回填 Open conflicts** 与章节写作过程中新暴露的条目。本票的 `Blocked by:` 相应收窄。
- **不再有 `core-facts.md`**（复检裁决）。导航职责全部归 `00-quickref.md`；本票删除相关交付项。
- **D7 是 20 条**，不是"≥19 条"。
- `90-dated-landscape.md` 的迁入清单里，**旧章节号必须标"旧"**——D1 已把同一批数字重新定义过（旧 ch14 = 云与路线图，新 `14` = SEV-SNP）。照字面执行会把新 SEV-SNP 章的 90% 搬进 `90`。
- **判断标准是"这条明年还成立吗"，不是"它在旧文件里的邻居是谁"。** 反例：硬件加速 vIOMMU（#48882 §2.10）在旧 ch06 里与"2024–2026 主线动向"写在一起，但它是耐久架构，归 `08`/`10`。
- `90` 可以留一行"非 KVM hypervisor 支持矩阵"（Xen HVM/PVH、ESXi 的 SEV-ES/SNP 支持状态）——"ESXi 支不支持 X"是会被问到的，而一行的代价是零。
