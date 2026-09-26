# Bibliography

> **中文速览**：开发子树的引用表。每条 claim 行用 `` `[N]` `` 指向这里的一条。
> 本子树的来源与厂商子树不同——多数是**内核提交、项目 issue、安全公告和实测**，
> 而不是规范章节。新增来源在末尾追加，不要复用编号。

Citation ID space for `references/dev/`. Every `[N]` in a chapter of this subtree
resolves here, and only here: `[N]` is scoped per subtree, which is what let the
migration move 6,616 citations without renumbering any of them.

Tier key: **T1** first-party (vendor document, vendor bulletin, upstream commit by the
vendor), **T2** authoritative secondary (maintainer statement, project issue resolved by
its maintainer, platform vendor documentation), **T3** everything else.

## 1–39 · Implementations

[1] Zero-Tang. NoirVisor — Windows driver, Intel + AMD, MIT. https://github.com/Zero-Tang/NoirVisor — T2
[2] Zero-Tang/NoirVisor issue #35, "Splitting a 2MiB page into 512 4KiB pages degrades system performance on hybrid CPUs (Intel 12th Gen and higher)". Reporter `papstuc`, opened 2024-09-04, closed 2024-09-08 by the maintainer. Machine i7-14700K; i7-8700K control shows no regression. https://github.com/Zero-Tang/NoirVisor/issues/35 — T2
[3] tandasat. barevisor — Windows driver and UEFI over a shared OS-agnostic core, Intel + AMD, Rust, MIT. Last pushed 2026-08-02. https://github.com/tandasat/barevisor — T2
[4] ionescu007. SimpleVisor — Windows driver and UEFI, Intel only, C, BSD-2-Clause. Last pushed 2024-05-08. https://github.com/ionescu007/SimpleVisor — T2
[5] tandasat. SimpleSvm — Windows driver, AMD only, C++, MIT. Last pushed 2025-03-03. https://github.com/tandasat/SimpleSvm — T2
[6] tandasat/SimpleSvm issue #3, "BlueScreen". Reporter `willi7758521`, opened 2025-02-14, closed 2025-03-03. Maintainer's resolution: "The issue is your system is configured to use physical memory address greater than 512 GB for MMIO." https://github.com/tandasat/SimpleSvm/issues/3 — T2
[7] tandasat. SimpleSvmHook — Windows driver, AMD only, MIT. Last pushed 2021-02-18. https://github.com/tandasat/SimpleSvmHook — T2
[8] tandasat. MiniVisorPkg — UEFI, Intel, MIT. Last pushed 2024-08-15. https://github.com/tandasat/MiniVisorPkg — T2
[9] HyperDbg. HyperDbg — Windows kernel debugger built on a hypervisor, Intel only, **GPL-3.0**. https://github.com/HyperDbg/HyperDbg — T2
[10] tandasat. Hypervisor-101-in-Rust — bare-metal teaching and fuzzing material, Intel + AMD, MIT. Last pushed 2025-09-27. https://github.com/tandasat/Hypervisor-101-in-Rust — T2

## 40–69 · Kernel and upstream

[40] Linux kernel commit `a5ca1dc46a6b`, "KVM: SVM: Disable AVIC on SNP-enabled system…" family of changes around virtualized VMLOAD/VMSAVE on Family 19h client parts; tracked as CVE-2024-53114. Authored by an AMD employee. https://git.kernel.org/ — T1
[41] Linux `arch/x86/kvm/svm/avic.c`, `avic_hardware_setup()` — the erratum 1235 handling, which disables IPI virtualization only rather than AVIC as a whole, on Family 17h and Hygon 18h. https://git.kernel.org/ — T1

## 70–99 · Vendor documents

[70] AMD. Processor Programming Reference (PPR) for AMD Family 1Ah Model 70h, Revision A0. Pub. 57930, Rev 3.00, 2025-04-30, marked `[AMD Public Use]`. 1017 pages. — T1
[71] AMD. Revision Guide for AMD Family 17h Models 00h–0Fh Processors. Pub. 55449, Rev 1.21, 2023-08. Erratum 1235 at p.87; applicable packages include AM4; Table 12 cross-references errata to Ryzen, 2nd Generation Ryzen and Threadripper segments. — T1
[72] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual. Pub. 325462-093US. Vol.1 §21.1.4 introduces the CPUID Domains classification. — T1
[73] Intel. Specification Update covering Raptor Lake-S and Raptor Lake-S Refresh, Pub. 740518-031, which gives both the same CPUID signature `B0671h`. — T1

## 100–129 · Platform

[100] Broadcom. KB 395554 — ESXi "Fatal CPU mismatch on feature" on Intel hybrid client parts, and the `cpuUniformityHardCheckPanic=FALSE` workaround. https://knowledge.broadcom.com/ — T2
[101] HyperDbg documentation, on coexistence with Virtualization-Based Security: "HyperDbg and VBS are both hypervisors running on ring -1. These hypervisors are not compatible." https://docs.hyperdbg.org/ — T2
[102] Microsoft. Memory Integrity (HVCI) enablement through quality updates from October 2026, which turns VBS on with it. Retrieved 2026-09-26. https://learn.microsoft.com/ — T2
[103] Apache Software Foundation. Third-party licence policy: Category A (may be included) covers MIT and BSD-2-Clause; Category X (may not) covers GPL-2.0, GPL-3.0 and LGPL. https://www.apache.org/legal/resolved.html — T2
