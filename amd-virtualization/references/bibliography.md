# Bibliography

> **中文速览**：本技能的全局引用表。每条 claim 行用 `` `[N]` `` 指向这里的一条。ID 区段按章分配，见 `.scratch/amd-virt-refine/CONVENTIONS.md` §4——**只在自己的区段内分配新 ID，不要动别人的**。1–99 段是预置的官方文档集，只读。

**格式**：`[N] <作者或机构>. <标题>. <版本/修订>. <日期>. <URL> — T1|T2|T3`

**分级**：T1 规范性（AMD 手册、规范、安全公告、修订指南）· T2 佐证（kernel.org、厂商官方文档、Microsoft Learn、同行评议论文、AMD 白皮书）· T3 背景（博客、新闻、营销）。**T3 永不得作为架构断言的唯一出处。**

**抓取纪律**：AMD 已把处理器文档迁出 `www.amd.com/content/dam/...`——那些 URL 大多 404，或 302 到一个返回 `text/html` 的 JS 壳。每次抓取都要验证 `Content-Type: application/pdf` **且**文件头是 `%PDF`。canonical 形式是 `https://docs.amd.com/go/en-US/<slug>`。

---

## 1–40 · AMD 官方（T1，预置，只读）

[1] AMD. AMD64 Architecture Programmer's Manual, Volume 2: System Programming. Pub. 24593, Rev 3.45. 2026-07. https://docs.amd.com/go/en-US/24593_3.45_APM_Vol2_PUB — T1
[2] AMD. AMD64 Architecture Programmer's Manual, Volume 3: General-Purpose and System Instructions. Pub. 24594, Rev 3.38. 2026-07. https://docs.amd.com/go/en-US/24594_3.38_APM_Vol3_PUB — T1
[3] AMD. AMD64 Architecture Programmer's Manual, Volume 1: Application Programming. Pub. 24592, Rev 3.25. 2026-05. https://docs.amd.com/go/en-US/24592_3.25_APM_Vol1_PUB — T1
[4] AMD. AMD64 Architecture Programmer's Manual, Volume 4: 128-Bit, 256-Bit and 512-Bit Media Instructions. Pub. 26568, Rev 3.27. 2026-07. https://docs.amd.com/go/en-US/26568_3.27_APM_Vol4_PUB — T1
[5] AMD. AMD64 Architecture Programmer's Manual, Volume 5: 64-Bit Media and x87 Floating-Point Instructions. Pub. 26569, Rev 3.16. 2021-11 (未再修订). https://docs.amd.com/go/en-US/26569_3.16_PUB — T1
[6] AMD. AMD64 Architecture Programmer's Manual, Volumes 1–5 (combined). Pub. 40332, Rev 4.10. 2026-07. https://docs.amd.com/go/en-US/40332_4.10_APM_Vol1-5_PUB — T1
[7] AMD. AMD I/O Virtualization Technology (IOMMU) Specification. Pub. 48882-PUB, Rev 3.11. 2026-04. https://docs.amd.com/go/en-US/48882_3.11_IOMMU_PUB — T1
[8] AMD. Secure Encrypted Virtualization API. Pub. 55766, Rev 3.24 (封面另标 API Version 0.24 / Technical Preview；引用出版修订 3.24). 2020-04. https://docs.amd.com/go/en-US/55766_PUB_3.24_SEV_API — T1
[9] AMD. SEV-ES Guest-Hypervisor Communication Block Standardization. Pub. 56421, Rev 2.04. 2025-01. https://docs.amd.com/go/en-US/56421 — T1
[10] AMD. SEV Secure Nested Paging Firmware ABI Specification. Pub. 56860, Rev 1.59. 2026-08. https://docs.amd.com/go/en-US/56860_PUB_SEV_SNP — T1
[11] AMD. Secure VM Service Module for SEV-SNP Guests — Guest Communication Interface. Pub. 58019, Rev 1.01. 2026-03. https://docs.amd.com/go/en-US/58019.pdf — T1
[12] AMD. SEV-TIO Firmware Interface Specification. Pub. 58271, Rev 0.92. 2026-08. https://docs.amd.com/go/en-US/58271_PUB_SEV-TIO — T1
[13] AMD. Versioned Chip Endorsement Key (VCEK) Certificate and KDS Interface Specification. Pub. 57230, Rev 1.00. 2025-02. https://docs.amd.com/ (slug 未核验) — T1
[14] AMD. Versioned Loaded Endorsement Key (VLEK) Specification. Pub. 58369, Rev 0.10. 2023-10. https://docs.amd.com/ (slug 未核验) — T1
[15] AMD. AMD-V™ Nested Paging. White paper, Rev 1.0. 2008-07. developer.amd.com 原链已失效，经 Internet Archive 取得 — T1
      注：§4.2.2 是 "24 memory references" 这一数字的一手出处。**APM 与 Intel SDM 都不陈述该数字**，不要锚到手册。
[16] AMD. AMD Memory Encryption. White paper, Pub. 70363 (Kaplan / Powell / Woller). 2021-10-18. https://docs.amd.com/v/u/en-US/memory-encryption-white-paper — T2
      注：URL 已于 2026-09-21 复核（`Content-Type: application/pdf`、`%PDF-1.7`、462,545 字节、12 页）。**非规范**，但是 **TSME 唯一的实质来源**——APM 全文无 "TSME" 一词。锤点形式 `[MEM-WP 70363 p.<n>]`，页码为 PDF 页号（该文件无印刷页码）。**与 APM 相触时 APM 胜出。**
[17] AMD. AMD SEV-SNP: Strengthening VM Isolation with Integrity Protection and More. White paper, Pub. 70366, 无修订号. 2020-01. https://docs.amd.com/go/en-US/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more — T2
      注：封面自带"目标而非承诺"免责声明。**非规范性——绝不得作为位级布局或 ABI 取值的出处**；那些属 [10] 与 [1] §15.36。
[18] AMD. Product Security — security bulletins index. 现行. https://www.amd.com/en/resources/product-security.html — T1
      注：单条公告为 `https://www.amd.com/en/resources/product-security/bulletin/amd-sb-NNNN.html`。
[19] AMD. AMD-SB-1004 (CVE-2020-12967 "SEVerity"; 同时覆盖 CVE-2021-26311). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-1004.html — T1
[20] AMD. AMD-SB-3008 (Heckler: CVE-2024-25742 / 25743 / 25744). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3008.html — T1
[21] AMD. AMD-SB-3015 (CVE-2024-21944 "BadRAM", Medium 5.3). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3015.html — T1
[22] AMD. AMD-SB-3020 (CVE-2025-0033 "RMPocalypse", Medium 6.0). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3020.html — T1
[23] AMD. AMD-SB-3023 (CVE-2025-48514 / 48517; 缓解会在 SEV-SNP **启用**时禁用 **SEV-ES**；固件 1.37.23 / 1.37.31 / 1.37.41). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3023.html — T1
[24] AMD. AMD-SB-7029 (Transient Scheduler Attacks: CVE-2024-36350 / 36357). https://www.amd.com/en/resources/product-security/bulletin/amd-sb-7029.html — T1
[25] AMD. Revision Guide for AMD Family 1Ah Models 00h–0Fh Processors. Pub. 58251, Rev 1.30. 2025-07. https://docs.amd.com/ (slug 未核验) — T1
[26] AMD. Revision Guide for AMD Family 1Ah Models 10h–1Fh Processors. Pub. 58730, Rev 1.30. — T1
[27] AMD. Revision Guide for AMD Family 19h Models 10h–1Fh Processors. Pub. 57095, Rev 1.05. 2025-11. — T1
[28] AMD. Revision Guide for AMD Family 19h Models A0h–AFh Processors. Pub. 57926, Rev 1.05. — T1
[29] AMD. Revision Guide for AMD Family 17h Models 00h–0Fh Processors. Pub. 55449, Rev 1.21. 2023-08. — T1
[30] AMD. Revision Guide for AMD Family 17h Models 30h–3Fh Processors. Pub. 56323, Rev 1.03. 2026-02. — T1
      注（2026-09-26 订正，取代此前"公开修订指南全部是 EPYC/服务器件、客户端无 PPR"的说法——**那条说法是假的，且本页 `[31]`–`[33]` 自己就是反证**）：
      **55449 覆盖客户端。** 其适用 package 含 **AM4**，Table 12 "Cross-Reference of Errata to Processor Segments" 按 *AMD Ryzen Processors* / *2nd Generation AMD Ryzen Processors* / *AMD Ryzen Threadripper* 分列；**p.87 的 erratum 1235 是一条虚拟化勘误**（同文亦见 56323 p.39）。
      **客户端 PPR 是公开的**：见 `[31]` Cezanne、`[32]` Phoenix、`[33]` Strix Halo，以及 `[660]` Dali / Castle Peak / Renoir、`[661]` OSRR 56255。
      **真实缺口比原说法窄得多**：(1) 未找到 Family 19h/1Ah **客户端 model 段**的公开 Revision Guide——AMD 在 `[662]` AMD-SB-4013 里点名引用 "Client Revision Guide" 并给出 errata #1165/#1166/#1526，但该文档本身与这三个编号未找到公开副本；(2) 未取得 56176 (Matisse) / 56214 (Vermeer) / 56713 (Raphael) / 57254 (Strix Point) 四份客户端 PPR 的第一方副本；(3) 客户端安全公告只给 AGESA/PI 版本串，不给可验证的微码 patch level。
      第三方流传的 PPR 56713 仍不在 AMD 公开索引内，**不得引用**。
      ⚠️ 检索日期 2026-09-26。此三条缺口是**限定到文档与日期的负面声明**，不得再泛化成"客户端没有勘误通道"。
[31] AMD. Processor Programming Reference (PPR) for AMD Family 19h Model 51h Rev A1 (Cezanne). Pub. 56569, Rev 3.03 (.zip). — T1
[32] AMD. Processor Programming Reference (PPR) for AMD Family 19h Model 70h Rev A0 (Phoenix). Pub. 57019, Rev 3.00 (.zip). — T1
[33] AMD. Processor Programming Reference (PPR) for AMD Family 1Ah Model 70h Rev A0. Pub. 57930, Rev 3.00 (.zip). — T1
[34] AMD. Processor Programming Reference (PPR) for AMD Family 1Ah Model 11h Rev B0. Pub. 57883 (.zip). — T1
[35] AMD. SEV developer resources. 现行. https://www.amd.com/en/developer/sev.html — T2
      注：代际能力（密钥槽数等）的厂商说法；**代际↔槽数的对应是未决冲突**，见 `errata.md`。

## 41–99 · 其他官方规范（T2，预置，只读）

> 本段条目的 URL 除特别标注外**尚未在本次基线核验中逐个抓取**。首次引用时确认一次，并把确认过的 URL 回填到本行。

[41] Microsoft. Run Hyper-V in a virtual machine with nested virtualization. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization — T2
      注：原文为 "AMD EPYC / Ryzen processor or later"；宿主需 Windows Server 2022+ 或 Windows 11+；**VM 配置版本 9.3 或更高**。**Microsoft 没有点名任何 Zen 代际——不要替它加。**
[42] Microsoft. Virtualization-based Security (VBS) and hardware requirements. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-vbs — T2
[43] Microsoft. Kernel DMA Protection. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt — T2
[44] Microsoft. Hyper-V architecture. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/reference/hyper-v-architecture — T2
[45] Microsoft. Hypervisor Top-Level Functional Specification (TLFS). 现行. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/tlfs — T2
[46] Yosifovich, Russinovich, Solomon, Ionescu. Windows Internals, Part 2, 7th edition. Microsoft Press. 2021 — T2
      注：`Hvix64.exe`（Intel）/ `Hvax64.exe`（AMD）/ `Hvaa64.exe`（ARM64）的出处。**该事实不在 learn.microsoft.com 的产品文档里**，只能引本书。
[47] Broadcom. Running VMware Workstation Pro on a Hyper-V Enabled Host ("Host VBS Mode"). Workstation Pro 文档. 现行 — T2
      注：WHP 路径自 Workstation Pro **15.5.5** 起可用；已文档化的限制：VM 更慢、**不支持嵌套**、无 PMC、无 RTM/HLE、无 PKU。
[48] Oracle. VirtualBox User Manual — Hyper-V support. 现行. https://www.virtualbox.org/manual/ — T2
      注：该路径在 **6.0** 落地（不是 6.1）；7.2 手册仍标实验性并附性能警告。
[49] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Vol.3C. Order 326019, rev 092. 2026-06 — T2
      注：仅用于 `19-comparison-intel-arm-riscv.md` 的对照。Intel 侧的深度属 `intel-vt` 技能。
[50] Intel. Virtualization Technology for Directed I/O Architecture Specification. Rev 5.20, D51397-019. 2026-04 — T2
[51] Arm. Arm Architecture Reference Manual for A-profile architecture. 现行 — T2
[52] RISC-V International. RISC-V Privileged Architecture, Hypervisor Extension. 现行 — T2
[53] PCI-SIG. PCI Express Base Specification (ATS / PRI / PASID). 现行 — T2
[54] UEFI Forum. ACPI Specification. 现行 — T2
[55] NIST. National Vulnerability Database. 现行. https://nvd.nist.gov/ — T2
      注：CVSS 一律取 NVD/CNA 值，不取二手漏洞库。
[56] Bhargava, Serebrin, Spadini, Manne (AMD). Accelerating Two-Dimensional Page Walks for Virtualized Systems. ASPLOS XIII. 2008 — T2
      注：二维遍历通式 `nm + n + m`（与 `(n+1)(m+1)−1` 恒等）的出处；正文多处出现 "the 24 references in the 2D page walk"。
[57] The Linux kernel. kernel.org documentation and source. 现行. https://docs.kernel.org/ — T2
[58] linux-kernel mailing list archives. 现行. https://lore.kernel.org/ — T2

## 100-149 · 章节引用

[100] Microsoft. Windows Hypervisor Platform (WHP) API. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/virtualization/api/hypervisor-platform/hypervisor-platform — T2
[101] Microsoft. Virtualization applications do not work together with Hyper-V, Device Guard, and Credential Guard. Microsoft Learn (troubleshoot). 现行. https://learn.microsoft.com/en-us/troubleshoot/windows-client/application-management/virtualization-apps-not-work-with-hyper-v — T2

## 150-169 · 章节引用

[150] AMD. AMD64 Architecture Programmer's Manual, Volume 2: System Programming. Pub. 24593, Rev 3.30. 2018-09. https://docs.amd.com/go/en-US/24593_APM_Vol2 (Rev 3.30 已被 Rev 3.45 取代，仅用于修订间对比；本地副本 `amd-spec/pdf/APM2-24593-3.30-historical.pdf`) — T1

## 185-199 · 章节引用

[185] AMD. AMD64 Architecture Programmer's Manual, Volume 2: System Programming. Pub. 24593, Rev 3.30. 2018-09. 本地已核验副本（封面 "24593—Rev. 3.30—September 2018"）。仅用于历史对照：Rev 3.30 的 Table C-1 把写陷阱印成整段 `90h–9Fh VMEXIT_CR[0-15]_WRITE_TRAP`，Rev 3.45 收窄为 `90h`/`93h`/`94h` 三个；同一副本也用于核对 §15.5 / §15.6 / §15.17 / §15.20 / §15.28 与 Appendix C 的编号自 2018 年未变。 — T1

## 200-239 · 章节引用

[200] Paolo Bonzini. [PATCH] KVM: SVM: make svm_flush_tlb_gva do a full asid flush if NPT enabled. kvm@vger.kernel.org. 2026-07-23. https://ratatoskr.run/kvm/2026/07/17308904/t — T2

## 240-269 · 章节引用

[240] The Linux kernel. arch/x86/include/asm/svm.h — SVM/AVIC field and constant names (INT_CTL, V_IRQ_SHIFT, AVIC_ENABLE_MASK, X2APIC_MODE_SHIFT, AVIC_DOORBELL). 现行. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/svm.h — T2

## 270-289 · 章节引用

[270] The Linux kernel. `drivers/iommu/amd/` — the AMD-Vi driver: `init.c` (IVRS/ACPI parsing), `amd_iommu_types.h` (MMIO register, DTE and command-field definitions), `iommu.c` (`AMD-Vi: Event logged […]` decoding). 现行. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/iommu/amd — T2

## 290-309 · 章节引用

[290] AMD. AMD Tiered Memory Page Migration Operations Guide. Pub. 58151. 无公开修订号/日期. IOMMU 48882 Rev 3.11 §3.4.13 与 Table 17 规范性引用；**不在本次核验的本地语料内**，故只到文档级引用. — T1
[291] Microsoft. GetSystemFirmwareTable function (sysinfoapi.h). Microsoft Learn. 现行. https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemfirmwaretable — T2
[292] Microsoft. EnumSystemFirmwareTables function (sysinfoapi.h). Microsoft Learn. 现行. https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-enumsystemfirmwaretables — T2

## 310-329 · 章节引用

[310] Markettos, Rothwell, Gutstein, Pearce, Neumann, Moore, Watson. Thunderclap: Exploring Vulnerabilities in Operating System IOMMU Protection via DMA from Untrustworthy Peripherals. NDSS 2019. https://www.ndss-symposium.org/ndss-paper/thunderclap-exploring-vulnerabilities-in-operating-system-iommu-protection-via-dma-from-untrustworthy-peripherals/ — T2

## 330-349 · 章节引用

[330] InstLatx64. x86/x64 CPUID dump collection, `AuthenticAMD` directory (machine-generated `CPUID 8000001F` words per shipping part; Matisse `0870F10`, Vermeer `0A20F12`, Raphael `0A60F12`, Granite Ridge `0B40F40`). 2026-09-21 取. https://github.com/InstLatx64/InstLatx64/tree/master/AuthenticAMD — T2
[331] The Linux kernel. AMD Memory Encryption — `Documentation/arch/x86/amd-memory-encryption.rst`. 现行. https://docs.kernel.org/arch/x86/amd-memory-encryption.html — T2

## 350-379 · 章节引用

[350] The Linux kernel. `include/uapi/linux/psp-sev.h` — `enum sev_ret_code`（内核对 55766 §4.5 状态码的命名，含 `SEV_RET_WBINVD_REQUIRED = 0x000E`、`SEV_RET_DFFLUSH_REQUIRED = 0x000F`）. 现行. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/include/uapi/linux/psp-sev.h — T2

## 380-399 · 章节引用

[380] The Linux kernel. `arch/x86/include/asm/svm.h` — `struct ghcb`, `struct ghcb_save_area`, `struct sev_es_save_area`. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/svm.h — T2
[381] The Linux kernel. SEV guest core — the `#VC` handler, GHCB MSR protocol helpers and AP startup (`arch/x86/kernel/sev.c`, since relocated under `arch/x86/coco/sev/`). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/coco/sev — T2

## 400-429 · 章节引用

[400] The Linux kernel. `arch/x86/include/asm/sev-common.h` — GHCB MSR protocol definitions and the guest termination reason-code sets (`SEV_TERM_SET_GEN` = the AMD-owned set 0, `SEV_TERM_SET_LINUX` = the Linux-owned set that defines `GHCB_TERM_CPUID`). 现行. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/sev-common.h — T2

## 430-459 · 章节引用

[430] NVD. CVE-2021-3653 — KVM nested SVM: the guest-supplied VMCB's interrupt-control field was not validated, letting a malicious L1 enable AVIC for L2 and read/write host physical pages; affects Linux before 5.14-rc7. CVSS 3.1 base 8.8, `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`, scored by `nvd@nist.gov`. https://nvd.nist.gov/vuln/detail/CVE-2021-3653 — T2
[431] NVD. CVE-2021-3656 — KVM nested SVM: the guest-supplied VMCB's `virt_ext` field (AMD's name: VMCB offset 0B8h) was not validated, letting a malicious L1 disable both the VMLOAD/VMSAVE intercepts and VLS for L2, with the same host-page read/write consequence. CVSS 3.1 base 8.8, same vector as [430]. https://nvd.nist.gov/vuln/detail/CVE-2021-3656 — T2
[432] The Linux kernel. `arch/x86/kvm/svm/nested.c` — nested SVM: the `vmcb01` / `vmcb12` / `vmcb02` triple, intercept recalculation as the union of both levels, the OR-merge of the MSR permission maps, the vmcb12 control checks (VMRUN intercept set, non-zero ASID, legal nested CR3 and permissions-map bases) and the cached sanitised copy, the exit-reflection decision, and the conditional VMLOAD/VMSAVE intercept. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/svm/nested.c — T2
[433] The Linux kernel. `arch/x86/include/asm/svm.h` — `struct vmcb_control_area`; the Hyper-V enlightenment structure is a union with `u8 reserved_sw[32]` at control-area offset 3E0h, i.e. an overlay on the software-reserved region rather than a separate control structure. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/svm.h — T2
[434] Ben-Yehuda, Day, Dubitzky, Factor, Har'El, Gordon, Liguori, Wasserman, Yassour. The Turtles Project: Design and Implementation of Nested Virtualization. OSDI '10 (best paper). https://www.usenix.org/conference/osdi10/turtles-project-design-and-implementation-nested-virtualization — T2

## 460-499 · 章节引用

[460] Microsoft. Enable nested virtualization (Hyper-V on Windows). Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/enable-nested-virtualization — T2
[461] Microsoft. Memory integrity enablement (OEM guidance). Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-hvci-enablement — T2
[462] Microsoft. Kernel DMA Protection (Memory Access Protection) for OEMs. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-kernel-dma-protection — T2
[463] Microsoft. Hypervisor Top-Level Functional Specification — Feature Discovery. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/feature-discovery — T2
[464] Microsoft. Hypervisor Top-Level Functional Specification — Nested Virtualization. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/nested-virtualization — T2
[465] Microsoft. Configure Credential Guard. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/configure — T2
[466] Microsoft. Credential Guard overview. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/ — T2
[467] Microsoft. Plan for deploying devices by using Discrete Device Assignment. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/plan/plan-for-deploying-devices-using-discrete-device-assignment — T2
[468] Microsoft. Deploy graphics devices by using Discrete Device Assignment. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/deploy/deploying-graphics-devices-using-dda — T2
[469] Microsoft. Plan for GPU acceleration in Windows Server. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/plan/plan-for-gpu-acceleration-in-windows-server — T2
[470] Microsoft. GPU paravirtualization (WDDM). Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-hardware/drivers/display/gpu-paravirtualization — T2
[471] Microsoft. Windows Sandbox overview. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/ — T2
[472] Microsoft. Windows Sandbox configuration file. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file — T2
[473] Microsoft. Comparing WSL 1 and WSL 2. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/wsl/compare-versions — T2
[474] Microsoft. BCDEdit /set — boot entry options. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/bcdedit--set — T2
[475] Microsoft. Hyper-V requirements (Hyper-V on Windows reference). Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/reference/hyper-v-requirements — T2
[476] Microsoft. `Add-VMGpuPartitionAdapter` (Hyper-V PowerShell module). Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/powershell/module/hyper-v/add-vmgpupartitionadapter — T2
[477] Docker, Inc. Docker Desktop WSL 2 backend on Windows. Docker 官方文档. 2026-09-21 核验. https://docs.docker.com/desktop/features/wsl/ — T2
[478] Oracle. VirtualBox Changelog for 6.0 — 6.0.0 release notes. 2026-09-21 核验. https://www.virtualbox.org/wiki/Changelog-6.0 — T2
[479] Microsoft. Enable NVIDIA CUDA / GPU acceleration on WSL. Microsoft Learn. 2026-09-21 核验. https://learn.microsoft.com/en-us/windows/wsl/tutorials/gpu-compute — T2

## 500-549 · 章节引用

[500] AMD. AMD-SB-3005 "AMD INVD Instruction Security Notice" (CVE-2023-20592, 社区名 CacheWarp). Severity Medium. 发布 2023-11-14. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3005.html — T1
[501] AMD. AMD-SB-3019 "AMD SEV Confidential Computing Vulnerability" (CVE-2024-56161, 社区名 EntrySign). Severity **High**. 发布 2025-02-03（末次更新 2025-06-10）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3019.html — T1
[502] AMD. AMD-SB-3027 "SEV-SNP Guest Stack Pointer Corruption Vulnerability" (CVE-2025-29943, 社区名 StackWarp). Severity **Low**. 发布 2026-01-15（修订 2026-02-23、2026-02-27）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3027.html — T1
[503] AMD. AMD-SB-7005 "Return Address Security Bulletin" (CVE-2023-20569, 社区名 Inception / SRSO). Severity Medium. 发布 2023-08-08（末次更新 2024-12-05）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-7005.html — T1
[504] AMD. AMD-SB-7008 "Cross-Process Information Leak" (CVE-2023-20593, 社区名 Zenbleed). Severity Medium. 发布 2023-07-24（末次更新 2024-04-30）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-7008.html — T1
[505] AMD. AMD-SB-1037 "AMD CPU Branch Type Confusion" (CVE-2022-23825; CVE-2022-29900 "RETbleed"). Severity Medium. 发布 2022-07-12（末次更新 2022-07-14）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-1037.html — T1
[506] AMD. AMD-SB-1033 "Ciphertext Side Channels on AMD SEV" (CVE-2021-46744, 社区名 CipherLeaks). 发布 2022-05-10. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-1033.html — T1
[507] AMD. AMD-SB-1039 "Execution Unit Scheduler Contention Side-Channel Vulnerability on AMD Processors" (CVE-2021-46778, 社区名 SQUIP). 发布 2022-08-09（末次更新 2023-12-18）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-1039.html — T1
[508] AMD. AMD-SB-7021 "AMD Response to 'ZENHAMMER: Rowhammer Attacks on AMD Zen-Based Platforms'". **Security Brief，无 CVE**. 发布 2024-03-25（末次更新 2024-04-09）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-7021.html — T1
[509] AMD. AMD-SB-7033 "AMD CPU Microcode Signature Verification Vulnerability" (CVE-2024-36347). 发布 2025-03-05（末次更新 2025-06-03）. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-7033.html — T1
[510] NVD. CVE-2021-29657 — `arch/x86/kvm/svm/nested.c`，VMCB12 双取（TOCTOU）导致 `nested_svm_vmrun` 中的 use-after-free，AMD KVM guest 可绕过对宿主 MSR 的访问控制；修复提交 `a58d9166a756`，影响 5.10 < 5.10.28 与 5.11 < 5.11.12。CVSS 3.1 **7.4 HIGH**，`CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H`，评分方 `nvd@nist.gov` (Primary)。发布 2021-07-22。https://nvd.nist.gov/vuln/detail/CVE-2021-29657 — T2
[511] NVD. CVE-2024-25742 — "an untrusted hypervisor can inject virtual interrupt 29 (#VC) at any point in time and can trigger its handler. This affects AMD SEV-SNP and AMD SEV-ES."；Linux < 6.9；修复提交 `e3ef461af35a8c74f2f4ce6616491ddb355a208f`。CVSS 3.1 **6.5 MEDIUM**，`CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:L`，**Secondary（CNA，Red Hat）；无 NVD primary 评分**。发布 2024-05-17。https://nvd.nist.gov/vuln/detail/CVE-2024-25742 — T2
[512] NVD. CVE-2024-25743 — "an untrusted hypervisor can inject virtual interrupts 0 and 14 at any point in time and can trigger the SIGFPE signal handler in userspace applications. This affects AMD SEV-SNP and AMD SEV-ES."；Linux ≤ 6.9。CVSS 3.1 **7.1 HIGH**，`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`，**Secondary（CNA，Red Hat）；无 NVD primary 评分**。发布 2024-05-15。https://nvd.nist.gov/vuln/detail/CVE-2024-25743 — T2
[513] NVD. CVE-2024-25744 — "an untrusted VMM can trigger int80 syscall handling at any given point. This is related to `arch/x86/coco/tdx/tdx.c` **and** `arch/x86/mm/mem_encrypt_amd.c`."；Linux < 6.6.7；修复提交 `b82a8dbd3d2f4563156f7150c6f2ecab6e960b30`。CVSS 3.1 **8.8 HIGH**，`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`，`nvd@nist.gov` (Primary)。发布 2024-02-12。https://nvd.nist.gov/vuln/detail/CVE-2024-25744 — T2
[514] NVD. CVE-2023-4155 — KVM SEV：多 vCPU 的 SEV-ES/SEV-SNP guest 可触发双取竞争并递归调用 `VMGEXIT` handler，在无 `CONFIG_VMAP_STACK` 的配置下造成宿主栈溢出。CVSS 3.1 **5.6 MEDIUM**，`CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:C/C:N/I:N/A:H`，`nvd@nist.gov` (Primary)；Red Hat 另给 5.3。发布 2023-09-13。https://nvd.nist.gov/vuln/detail/CVE-2023-4155 — T2
[515] NVD. CVE-2019-9836 — "Secure Encrypted Virtualization (SEV) on … Platform Security Processor (PSP; aka AMD Secure Processor or AMD-SP) **0.17 build 11 and earlier** has an insecure cryptographic implementation."。CVSS 3.1 **5.3 MEDIUM**，`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2019-06-25。https://nvd.nist.gov/vuln/detail/CVE-2019-9836 — T2
[516] NVD. CVE-2023-20592 — INVD 行为导致 SEV-ES/SEV-SNP guest 内存完整性丧失。CVSS 3.1 **6.5 MEDIUM**，`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`，`nvd@nist.gov` (Primary)。发布 2023-11-14。https://nvd.nist.gov/vuln/detail/CVE-2023-20592 — T2
[517] NVD. CVE-2023-20569 — 返回地址预测器可被影响，导致攻击者控制地址处的推测执行。CVSS 3.1 **4.7 MEDIUM**，`CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2023-08-08。https://nvd.nist.gov/vuln/detail/CVE-2023-20569 — T2
[518] NVD. CVE-2023-20593 — "An issue in 'Zen 2' CPUs, under specific microarchitectural circumstances, may allow an attacker to potentially access sensitive information."。CVSS 3.1 **5.5 MEDIUM**，`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2023-07-24。https://nvd.nist.gov/vuln/detail/CVE-2023-20593 — T2
[519] NVD. CVE-2022-23825 — "Aliases in the branch predictor may cause some AMD processors to predict the wrong branch type potentially leading to information disclosure."。CVSS 3.1 **6.5 MEDIUM**，`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2022-07-14。https://nvd.nist.gov/vuln/detail/CVE-2022-23825 — T2
[520] NVD. CVE-2022-23816 — **REJECTED**："DO NOT USE THIS CANDIDATE NUMBER. … Reason: This candidate is unused by its CNA."，`vulnStatus: Rejected`，无描述、无评分、无引用。https://nvd.nist.gov/vuln/detail/CVE-2022-23816 — T2
[521] NVD. CVE-2021-46744 — "An attacker with access to a malicious hypervisor may be able to infer data values used in a SEV guest on AMD CPUs by monitoring ciphertext values over time."。CVSS 3.1 **6.5 MEDIUM**，`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2022-05-11。https://nvd.nist.gov/vuln/detail/CVE-2021-46744 — T2
[522] NVD. CVE-2021-46778 — 执行单元调度队列争用侧信道，影响使用 SMT 的 "Zen 1"、"Zen 2"、"Zen 3"。CVSS 3.1 **5.6 MEDIUM**，`CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:C/C:H/I:N/A:N`，`nvd@nist.gov` (Primary)。发布 2022-08-10。https://nvd.nist.gov/vuln/detail/CVE-2021-46778 — T2
[523] NVD. CVE-2020-12967 — "The lack of nested page table protection in the AMD SEV/SEV-ES feature could potentially lead to arbitrary code execution within the guest VM…"。CVSS 3.1 **7.2 HIGH**，`CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H`，`nvd@nist.gov` (Primary)。发布 2021-05-13。https://nvd.nist.gov/vuln/detail/CVE-2020-12967 — T2
[524] NVD. CVE-2021-26311 — "…memory can be rearranged in the guest address space that is not detected by the attestation mechanism…"。CVSS 3.1 **7.2 HIGH**，同 [523] 的向量，`nvd@nist.gov` (Primary)。发布 2021-05-13。https://nvd.nist.gov/vuln/detail/CVE-2021-26311 — T2
[525] Schlüter, Sridhara, Kuhne, Bertschi, Shinde (ETH Zurich). Heckler: Breaking Confidential VMs with Malicious Interrupts. **USENIX Security 2024**. https://ahoi-attacks.github.io/heckler/ — T2
[526] Schlüter, Sridhara, Bertschi, Shinde (ETH Zurich). WeSee: Using Malicious #VC Interrupts to Break AMD SEV-SNP. **IEEE S&P 2024（Distinguished Paper Award）**. https://ahoi-attacks.github.io/wesee/ — T2
[527] Zhang, Gerlach, Weber, Hetterich, Lü, Kogler, Schwarz. CacheWarp: Software-based Fault Injection using Selective State Reset. **USENIX Security 2024**. https://cachewarpattack.com/ — T2
[528] Zhang, Hornetz, Weber, Thomas, Schwarz (CISPA). StackWarp（USENIX Security 2026）. https://stackwarpattack.com/ — T2
[529] Schlüter, Shinde (ETH Zurich). RMPocalypse: How a Catch-22 Breaks AMD SEV-SNP. **ACM CCS 2025**. https://rmpocalypse.github.io/ — T2
[530] De Meulemeester, Wilke, Oswald, Eisenbarth, Verbauwhede, Van Bulck. BadRAM: Practical Memory Aliasing Attacks on Trusted Execution Environments. **46th IEEE Symposium on Security and Privacy (S&P) 2025**. https://badram.eu/ — T2
[531] Morbitzer, Huber, Horsch, Wessel (Fraunhofer AISEC). SEVered: Subverting AMD's Virtual Machine Encryption. 2018-05-24. https://arxiv.org/abs/1805.09604 — T2
[532] Jattke et al. (ETH Zurich COMSEC). ZenHammer: Rowhammer Attacks on AMD Zen-based Platforms. **USENIX Security 2024**. https://comsec.ethz.ch/research/dram/zenhammer/ — T2
[533] The Linux kernel. Speculative Return Stack Overflow (SRSO) — hardware-vulnerability documentation. 2026-09-20 核验. https://docs.kernel.org/admin-guide/hw-vuln/srso.html — T2
[534] Microsoft. System Guard Secure Launch and SMM protection. Microsoft Learn. https://learn.microsoft.com/en-us/windows/security/hardware-security/system-guard-secure-launch-and-smm-protection — T2

## 550-579 · 章节引用

[550] Misono, Stavrakakis, Santos, Bhatotia (TU München / INESC-ID). Confidential VMs Explained: An Empirical Analysis of AMD SEV-SNP and Intel TDX. Proc. ACM Meas. Anal. Comput. Syst. 8(3), Article 36; SIGMETRICS 2025 summer round. 2024-12. https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf — T2
[551] Yan, Gopalan (Binghamton University). Performance Overheads of Confidential Virtual Machines. MASCOTS 2023. 2023. https://kartikgopalan.github.io/publications/mascots23.pdf — T2
[552] Nikhil Bhatia (VMware). Performance Evaluation of AMD RVI Hardware Assist. Revision 20090311, item EN-000147-01, copyright 2008–2009. https://web.archive.org/web/20090711175028if_/http://www.vmware.com/pdf/RVI_performance.pdf — T2
[553] Oracle Linux Blog. How to enable AMD AVIC and speed up your VMs. 2024-03-28. https://blogs.oracle.com/linux/post/amd-avic — T2
[554] ComputerBase. HVCI in Windows 11: Benchmarks zum Leistungsverlust in Spielen. 2023-03-16. https://www.computerbase.de/artikel/betriebssysteme/windows-11-vbs-hvci-spiele-benchmarks.83639/ — T3
[555] Ben-Yehuda, Day, Dubitzky, Factor, Har'El, Gordon, Liguori, Wasserman, Yassour (IBM). The Turtles Project: Design and Implementation of Nested Virtualization. OSDI 2010. 2010-10. https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Ben-Yehuda.pdf — T2
[556] AnandTech. 2008 年对 AMD NPT 与 Intel EPT 的分析文章——"嵌套分页比影子分页最高快 23%" 这一数字在旧语料中的中继来源，旧 bibliography 将其归于 Johan De Gelas，并且只给出一个中文博客转录链接。https://www.anandtech.com/show/2480 — T3
[557] Oracle. Oracle VirtualBox Administration Guide — Technical Background (nested paging and large pages). 现行. https://www.virtualbox.org/manual/topics/TechnicalBackground.html — T2
[558] The Linux kernel. `arch/x86/kvm/svm/svm.c` and `arch/x86/kvm/svm/svm.h` — SVM PAUSE-filter module parameters and their default constants. torvalds/linux master, 抓取于 2026-09-21. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/svm/svm.c — T2
[559] The Linux kernel. `virt/kvm/kvm_main.c` (`halt_poll_ns` module parameter) and `arch/x86/include/asm/kvm_host.h` (`KVM_HALT_POLL_NS_DEFAULT`). torvalds/linux master, 抓取于 2026-09-21. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/virt/kvm/kvm_main.c — T2
[560] Microsoft. Comparing WSL versions. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/windows/wsl/compare-versions — T2
[561] Microsoft. Windows Hypervisor Platform API reference. Microsoft Learn. 现行. https://learn.microsoft.com/en-us/virtualization/api/hypervisor-platform/hypervisor-platform — T2

## 580-609 · 章节引用

[580] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Vol.3A: System Programming Guide, Part 1. 现行（与 [49] 同一手册集的另一卷）. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html — T2
[581] Arm. Arm Generic Interrupt Controller Architecture Specification, GIC architecture version 3 and version 4 (ARM IHI 0069). 现行 — T2
[582] Arm. Arm System Memory Management Unit Architecture Specification, version 3 (SMMUv3; ARM IHI 0070). 现行 — T2
[583] RISC-V International. RISC-V Advanced Interrupt Architecture (AIA). 现行 — T2
[584] RISC-V International. RISC-V IOMMU Architecture Specification. 现行 — T2
[585] Intel. Intel Trust Domain Extensions (Intel TDX) Module Base Architecture Specification. 现行 — T2
[586] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Vol.3D: System Programming Guide, Part 4. 现行（与 [49] 同一手册集的另一卷）. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html — T2

## 610-659 · 章节引用

[610] The Linux kernel. Mainline source tree (torvalds/linux.git); release tags probed 2026-09-21 for first appearance of each symbol cited in `90-dated-landscape.md` §90.4 and §90.6. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/ — T2
[611] Naveen N Rao (AMD), committed by Sean Christopherson. KVM: SVM: Enable AVIC by default for Zen4+ if x2AVIC is support. Commit ca2967de5a5b098b43c5ad665672945ce7e7d4f7, authored 2025-09-19, committed 2025-09-23; first released in Linux 6.18. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=ca2967de5a5b098b43c5ad665672945ce7e7d4f7 — T2
[612] The Linux kernel. Current release status (mainline / stable / longterm). Retrieved 2026-09-21. https://www.kernel.org/finger_banner — T2
[613] Microsoft. About Azure confidential VMs. Microsoft Learn. Retrieved 2026-09-21 via the docs source repo (learn.microsoft.com unreachable from the capture host). https://learn.microsoft.com/en-us/azure/confidential-computing/confidential-vm-overview — T2
[614] Microsoft. Azure confidential computing product overview. Microsoft Learn. Retrieved 2026-09-21 via the docs source repo. https://learn.microsoft.com/en-us/azure/confidential-computing/overview-azure-products — T2
[615] Microsoft. DCasv5 and DCadsv5-series / ECasv5 and ECadsv5-series. Microsoft Learn. Retrieved 2026-09-21 via the docs source repo. https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dcasv5-series — T2
[616] Microsoft. DCasv6-series. Microsoft Learn. Retrieved 2026-09-21 via the docs source repo. https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dcasv6-series — T2
[617] Microsoft. OpenVMM / OpenHCL guide (what OpenHCL is; OpenHCL architecture; OpenHCL on KVM roadmap). Retrieved 2026-09-21. https://openvmm.dev/guide/ — T2
[618] Microsoft. What's new in Windows Server 2025. Microsoft Learn. Retrieved 2026-09-21 via the docs source repo; cited as a documented absence of any SEV / SEV-SNP mention. https://learn.microsoft.com/en-us/windows-server/get-started/whats-new-windows-server-2025 — T2
[620] Amazon Web Services. AMD SEV-SNP for Amazon EC2 instances. AWS EC2 User Guide. Retrieved 2026-09-21. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/sev-snp.html — T2
[621] Amazon Web Services. Requirements for using AMD SEV-SNP. AWS EC2 User Guide. Retrieved 2026-09-21. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/snp-requirements.html — T2
[622] Amazon Web Services. Find instance types that support AMD SEV-SNP. AWS EC2 User Guide. Retrieved 2026-09-21. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/snp-find-instance-types.html — T2
[623] Amazon Web Services. Amazon EC2 M6a Instances. Retrieved 2026-09-21. https://aws.amazon.com/ec2/instance-types/m6a/ — T2
[624] Amazon Web Services. Amazon EC2 C6a Instances (includes the "Posted on: Feb 14, 2022" What's New entry at https://aws.amazon.com/about-aws/whats-new/2022/02/amazon-ec2-c6a-instances/). Retrieved 2026-09-21. https://aws.amazon.com/ec2/instance-types/c6a/ — T2
[625] Amazon Web Services. Amazon EC2 C7a and R7a Instances. Retrieved 2026-09-21. https://aws.amazon.com/ec2/instance-types/c7a/ — T2
[626] Google Cloud. Confidential VM supported configurations. Retrieved 2026-09-21. https://cloud.google.com/confidential-computing/confidential-vm/docs/supported-configurations — T2
[627] Google Cloud. Confidential VM release notes. Retrieved 2026-09-21. https://cloud.google.com/confidential-computing/confidential-vm/docs/release-notes — T2
[628] Oracle. Confidential computing on Oracle Cloud Infrastructure. OCI documentation. Retrieved 2026-09-21. https://docs.oracle.com/en-us/iaas/Content/Compute/References/confidential_compute.htm — T2
[629] Oracle. OCI Compute service release notes (Confidential Computing, release date February 01, 2023). Retrieved 2026-09-21. https://docs.oracle.com/en-us/iaas/releasenotes/services/compute/ — T2
[630] IBM. IBM Cloud confidential computing. Retrieved 2026-09-21; cited as a documented absence of any AMD SEV offering. https://www.ibm.com/cloud/confidential-computing — T2
[631] QEMU project. ChangeLog/2.12 ("Support for AMD Secure Encrypted Virtualization"). https://wiki.qemu.org/ChangeLog/2.12 — T2
[632] QEMU project. ChangeLog/6.0 ("Support for running SEV-ES encrypted guests."). https://wiki.qemu.org/ChangeLog/6.0 — T2
[633] QEMU project. ChangeLog/9.1 ("Support for SEV-SNP using the \"-object sev-snp-guest\" command line option."). https://wiki.qemu.org/ChangeLog/9.1 — T2
[634] QEMU project. Download QEMU (stable 11.1.1, 2026-08-26). Retrieved 2026-09-21. https://www.qemu.org/download/ — T2
[635] QEMU project. Source tree; release tags probed 2026-09-21 for `target/i386/sev.c`, `sev_es_enabled` and the `sev-snp-guest` QOM type. https://gitlab.com/qemu-project/qemu — T2
[636] libvirt. Domain XML format — Launch Security (`<launchSecurity type='sev'>` Since 4.4.0; `type='sev-snp'` Since 10.5.0). Retrieved 2026-09-21. https://libvirt.org/formatdomain.html — T2
[637] libvirt. Source tree, `meson.build` version 12.8.0 on master. Retrieved 2026-09-21. https://gitlab.com/libvirt/libvirt — T2
[638] VirTEE. sevctl — administrative utility for AMD SEV. Release sevctl-0.6.2, 2025-05-29. https://github.com/virtee/sevctl — T2
[639] VirTEE. snphost — CLI for AMD SEV-SNP enabled hosts. Release v0.7.0, 2025-11-17. https://github.com/virtee/snphost — T2
[640] VirTEE. snpguest — CLI for AMD SEV-SNP enabled guests. Release snpguest-0.10.0, 2025-11-13. https://github.com/virtee/snpguest — T2
[641] AMD. AMDESE/sev-tool (archived; README carries the deprecation notice routing to sevctl / snphost / snpguest). Retrieved 2026-09-21. https://github.com/AMDESE/sev-tool — T2
[642] AMD. AMDESE/AMDSEV — "Linux open source code under development", linked from AMD's SEV developer page. Retrieved 2026-09-21. https://github.com/AMDESE/AMDSEV — T2
[643] Xen Project. Xen feature support matrix / SUPPORT.md. Retrieved 2026-09-21; cited as a documented absence of any SEV mention. https://xenbits.xen.org/docs/unstable/support-matrix.html — T2
[644] Broadcom. AMD Secure Encrypted Virtualization-Encrypted State overview. vSphere 8.0 security documentation. Retrieved 2026-09-21. https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-security/securing-virtual-machines-in-the-vsphere-client/securing-virtual-machines-with-amd-secure-encrypted-virtualization-encrypted-state/amd-secure-encrypted-virtualization-encrypted-state-overview.html — T2
[645] Confidential Containers (CNCF). Releases; v0.22.0, 2026-07-28. Retrieved 2026-09-21. https://github.com/confidential-containers/confidential-containers/releases — T2
[646] Confidential Containers (CNCF). Trustee — attestation and secret delivery components; v0.22.0. Retrieved 2026-09-21. https://github.com/confidential-containers/trustee — T2
[647] COCONUT-SVSM project. Releases; v2026.08-devel, 2026-08-28 (development snapshots only, no stable release). Retrieved 2026-09-21. https://github.com/coconut-svsm/svsm/releases — T2
[648] AMD. AMD EPYC 7763 product page (Launch Date 03/15/2021). Retrieved 2026-09-21. https://www.amd.com/en/products/processors/server/epyc/7003-series/amd-epyc-7763.html — T2
[649] AMD. AMD EPYC 9755 product page (Launch Date 10/10/2024). Retrieved 2026-09-21. https://www.amd.com/en/products/processors/server/epyc/9005-series/amd-epyc-9755.html — T2
[650] AMD. AMD EPYC 7000 series launch press release ("AUSTIN, Texas 6/20/2017"). Live URL retired; read from the Internet Archive capture of 2017-06-22. https://web.archive.org/web/20170622222014/http://www.amd.com/en-us/press-releases/Pages/amd-epyc-datacenter-2017jun20.aspx — T2
[651] AMD. 2nd Gen AMD EPYC Processors Set New Standard for the Modern Datacenter ("SANTA CLARA, Calif. 08/07/2019"). Live URL retired; read from the Internet Archive capture of 2019-08-08. https://web.archive.org/web/20190808090552/https://www.amd.com/en/press-releases/2019-08-07-2nd-gen-amd-epyc-processors-set-new-standard-for-the-modern-datacenter — T2
[652] AMD. AMD EPYC 7003 Series CPUs Set New Standard as Highest Performance Server Processor ("SANTA CLARA, Calif., March 15, 2021"). https://www.amd.com/en/newsroom/press-releases/2021-3-15-amd-epyc-7003-series-cpus-set-new-standard-as-hig.html — T2
[653] AMD. AMD Brings 4th Gen AMD EPYC Processors to The Modern Data Center ("SANTA CLARA, Calif., Nov. 10, 2022"). https://www.amd.com/en/newsroom/press-releases/2022-11-10-offering-unmatched-performance-leadership-energy-.html — T2
[654] AMD. AMD Expands 4th Gen EPYC CPU Portfolio ... Cloud Native and Technical Computing Workloads ("SANTA CLARA, Calif., June 13, 2023"; Bergamo). https://www.amd.com/en/newsroom/press-releases/2023-6-13-amd-expands-4th-gen-epyc-cpu-portfolio-with-leader.html — T2
[655] AMD. AMD Completes 4th Gen EPYC Family with the AMD EPYC 8004 Processors ("SANTA CLARA, Calif., Sept. 18, 2023"; Siena). https://www.amd.com/en/newsroom/press-releases/2023-9-18-amd-completes-4th-gen-epyc-family-with-the-amd-epy.html — T2
[656] AMD. AMD Launches 5th Gen AMD EPYC CPUs ("Oct. 10, 2024 (GLOBE NEWSWIRE)"; "formerly codenamed 'Turin'"). https://ir.amd.com/news-events/press-releases/detail/1219/amd-launches-5th-gen-amd-epyc-cpus-maintaining-leadership-performance-and-features-for-the-modern-data-center — T2
[657] AMD. New AMD EPYC 8005 Server CPUs: Big Performance, Low Power. AMD blog, 2026-05-19. https://www.amd.com/en/blogs/2026/new-amd-epyc-8005-server-cpus-big-performance-low-power.html — T3
[658] AMD. AMD EPYC 9006 Series Server CPUs product page (SP7 / SP8 sockets; "AMD EPYC™ 'Venice' 9996 (512 total cores)"; "Preliminary performance estimates ... as of July 22, 2026 and subject to change"). Retrieved 2026-09-21. https://www.amd.com/en/products/processors/server/epyc/9006-series.html — T2
[659] Confidential Containers (CNCF). confidential-containers/operator, archived 2026-02-01, with the README directing deployment to the Helm chart at oci://ghcr.io/confidential-containers/charts/confidential-containers. Retrieved 2026-09-21. https://github.com/confidential-containers/operator — T2

## 660-679 · 客户端勘误通道（2026-09-26 新增）

  这一段是为订正「AMD 客户端无勘误通道」而补录的第一方来源。该声明曾在本技能 8 处出现，
  经检索全部三个分句均为假；订正见 `errata.md` 的对应条目与 `[30]` 下的注。

[660] AMD. 客户端 Processor Programming Reference 三种，封面均标 `[AMD Public Use]`：
      PPR for AMD Family 17h Model 20h Rev A1（Dali / Pollock；package FT5 / FP5 / **AM4**）Pub. 55772-A1, Rev 3.08, 2021-04-14；
      PPR for AMD Family 17h Model 31h（Castle Peak）Pub. 55803；
      PPR for AMD Family 17h Model 60h Rev A1（Renoir）Pub. 55922-A1。 — T1
[661] AMD. Open-Source Register Reference (OSRR) for AMD Family 17h Models 00h–2Fh Processors. Pub. 56255. — T1
[662] AMD. Client 安全公告序列 `AMD-SB-4xxx`（4001 / 4002 / 4004 / 4008 / 4012 / 4013 / 4017；2022-05 至 2026-05），与 Server/EPYC 的 `AMD-SB-3xxx` 序列并列。AMD-SB-4013 (2026-02) 脚注逐字： "Refer to Errata #1165, #1166 and #1526 on the corresponding **Client Revision Guide** of the product." https://www.amd.com/en/resources/product-security/bulletin/amd-sb-4013.html — T1
      注：该脚注是 AMD 自己承认存在 "Client Revision Guide" 这一文档类别的第一方证据。
      **但该文档本身及 errata #1165 / #1166 / #1526 未找到公开副本**——这三个编号不在已核对的
      55449（≤#1488）、56683、58251、58730 之内。这是当前最窄、最准确的客户端勘误缺口表述。`GAP`
