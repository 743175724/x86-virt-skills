# 09 · `11-memory-encryption.md`（客户端范围）

Status: ready-for-agent
Type: task
Blocked by: 02, 03
Bibliography ID 区段: **330–349**
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D9

> **动笔前必读（所有章节票通用）**
>
> 1. 先读 `.scratch/amd-virt-refine/CONVENTIONS.md`（票 02 产出）——claim 行 schema、锚点语法、来源分级、归属表、"核不到就降级"的三级规则都在那里。
> 2. 旧版 15 章与旧 bibliography 在 `.scratch/amd-virt-refine/_source/`，**当线索用，不当事实用**。
> 3. **本票正文里出现的一切位号、偏移、编码、命令码都是候选值**——它们来自对旧版的审计，尚未逐个对官方 PDF 核过。写进 claim 行之前必须自己核一遍；核不到就按 CONVENTIONS 的降级规则处理，**不要照抄本票**。
> 4. 复检记录 `.scratch/amd-virt-refine/recheck-findings.md` 与本票冲突时，以复检记录为准。


**Maps to:** APM Vol.2 **§15.34**（SEV 章；SME/加密基础在其前几个子节——**具体子节号未核验，本票负责回填**；同章已核验的有 15.34.10 SEV_STATUS MSR、15.34.11 Virtual Transparent Encryption）+ **Ch.7 Memory System**；`Fn8000_001F` 见 **APM Vol.3 App E**；AMD Memory Encryption 白皮书作 T2。
**Owns:** SME / TSME · C-bit · `Fn8000_001F` 全字段 · SYSCFG · 物理地址位缩减 · AMD-SP 的客户端角色。

## 为什么这一章单独存在

用户的目标平台是 Windows PC。SEV 全家是 EPYC 专属（`Fn8000_001F EAX[1]` 在 Ryzen 上读 0），但**内存加密本身在客户端是可用的**——TSME / AMD Memory Guard 就是它。旧库把这两件事混在第 8 章里，导致客户端读者要么以为自己能用 SEV，要么完全找不到与自己相关的那部分。本章是客户端读者的落点，`12`–`14` 是服务器落点。

## 必须交付

1. **`Fn8000_001F` 逐字段**：EAX[0] SME、EAX[1] SEV、EAX[2]、EAX[3] SEV-ES、**EAX[4] SEV-SNP（全库目前不存在这一位）**、EAX[5]、EAX[23]…；**EBX[5:0] = C-bit 位置**、**EBX[11:6] = 物理地址位缩减数**；ECX = 可同时加密的 guest 数；**EDX = MinSevNoEsAsid（全库缺失）**。
2. **C-bit 的正确解释**：它是**物理地址中的一位**，位置必须从 `EBX[5:0]` 读取而非硬编码（旧版有"Naples/Rome/Milan 是 47、Genoa 起是 51"的代际表述，且唯一出处是个人博客——代际值移入 `90`，本章给机制）。说明 C-bit 置位如何减少可用物理地址位、对驱动与 DMA 的影响。
3. **SME 与 TSME 的区别**：SME 由 OS 逐页通过 C-bit 控制；**TSME 由固件开启，全部系统内存无条件加密，OS 与 hypervisor 零参与**——后者才是 Windows PC 上实际生效的形态（Windows 不做逐页 C-bit 管理）。
4. **SYSCFG MSR `C001_0010h`**：bit 23 MemEncryptionModEn，以及 SecureNestedPagingEn / VMPLEn 的位号（旧版只给了名字没给位号；这两位属服务器范围，本章只给位号并交叉引用 `14`）。
5. **AMD-SP（Platform Security Processor）在客户端的角色**：TSME 密钥在启动时由 AMD-SP 生成；fTPM 也由它承载，与 Windows 11 的 TPM 要求相关（交叉引用 `16`）。
6. **明确的"不"**：SEV/SEV-ES/SEV-SNP 在客户端 Ryzen 上不存在；Windows 的 VBS/HVCI/Credential Guard 建立在 **NPT/SLAT + AMD-Vi** 之上，**不**依赖 SEV；微软对 SEV-SNP 的使用是 Azure 侧的（交叉引用 `16` 与 `90`）。这是评测集里的一道必考题。
7. **Scope 标注**：client-relevant。Linux 的 `mem_encrypt=on` 三态（Supported/Enabled/Active）降为脚注并标注 Linux-only——Windows 没有对应开关。
8. Open items。

## 明确移出本章

- SEV 的密钥层次、ASID 绑定、固件命令、启动度量 → `12-sev.md`。
- TSME 在非 PRO Ryzen 上随 AGESA 版本增删的事件、代际 C-bit 取值、密钥槽数 → `90-dated-landscape.md`（且旧版该事实的唯一出处是 TechPowerUp，需重新锚定或降级 `C:low`）。

## 完成判据

- lint 零 error。
- `Fn8000_001F` 四个寄存器的字段全部覆盖，含 EAX[4] 与 EDX。
- 本章能独立回答："我的 Ryzen 笔记本能用 AMD 的内存加密吗？"——答案是 TSME，并给出如何确认。

---

## 复检补充

- **补 C-bit 的缓存一致性规则**：硬件**不**保证同一物理页的加密映射与非加密映射之间的一致性，软件在改变 C-bit 前必须先冲刷。一行字，后果很大（写错就是静默的数据损坏）。
- **`SEV_STATUS`（C001_0131h）归 `12-sev.md`**（复检裁决；D5 原先整行漏了这个 MSR）。本章只在探测链里提一句并交叉引用。
- 本章**独占 `Fn8000_001F` 的全部字段**（含 EAX[4] SEV-SNP）——客户端读者也需要靠 EAX[1]/EAX[4] 读回 0 来确认"我没有"。票 10 不得重复发布这张表。
- **SMKE / CXL 连接内存加密**：代际细节归 `90`，但**机制本身**在本章或 `14` 留一句话，否则读者在任何地方都找不到它是什么。
