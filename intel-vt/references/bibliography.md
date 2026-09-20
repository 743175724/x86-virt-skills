# Bibliography

Global citation ID space for this skill. Every `[N]` token in a chapter file resolves here.

**Tier key** — `T1` normative (Intel official specifications and advisories) · `T2` corroborating (kernel.org, LKML, peer-reviewed papers, other vendors' official specifications and documentation) · `T3` background (blogs, news, marketing — never the sole source for an architectural claim).

**ID ranges** — 1–40 Intel official · 41–99 other official specifications · 100–199 VMX chapters · 200–249 VT-d · 250–299 TDX · 300–349 nested · 350–399 security · 400–449 performance · 450–499 Windows platform · 500–549 comparison · 550–599 dated landscape · 600–649 errata.

---

## 1–40 · Intel official (T1)

Document numbers and revisions below were read directly from the Intel PDF cover pages or bookmark trees. Where Intel's own landing-page metadata disagrees with the PDF, the PDF governs.

[1] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 3C: System Programming Guide, Part 3. Order 326019-092US. Rev 092, June 2026. https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf — T1
[2] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 3D: System Programming Guide, Part 4. Order 332831. Rev 092, June 2026. https://cdrdv2.intel.com/v1/dl/getContent/671269 — T1
[3] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 3A: System Programming Guide, Part 1. Order 253668. Rev 092, June 2026. Served inside the Volume 3 combined PDF: https://cdrdv2.intel.com/v1/dl/getContent/671447 — T1 (same file as [4]; the two order numbers name different parts of one download, they are not independent sources)
[4] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 3B: System Programming Guide, Part 2. Order 253669. Rev 092, June 2026. Served inside the Volume 3 combined PDF: https://cdrdv2.intel.com/v1/dl/getContent/671447 — T1 (same file as [3])
[5] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 4: Model-Specific Registers. Order 335592. Rev 092, June 2026. https://cdrdv2.intel.com/v1/dl/getContent/671098 — T1
[6] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Combined Volumes. Order 325462-092US. Rev 092, June 2026. https://cdrdv2.intel.com/v1/dl/getContent/671200 — T1
[7] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2 (Instruction Set Reference, A-Z). Orders 253666 / 253667 / 326018 / 334569. Rev 092, June 2026. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html — T1
[8] Intel. Intel Virtualization Technology for Directed I/O Architecture Specification. Order D51397-019. Rev 5.20, April 2026. https://cdrdv2-public.intel.com/919688/D51397-019-vt-directed-io-spec.pdf — T1
[9] Intel. Intel Architecture Instruction Set Extensions and Future Features Programming Reference. Order 319433-062. June 2026. https://cdrdv2.intel.com/v1/dl/getContent/671368 — T1
[10] Intel. Intel 64 and IA-32 Architectures Software Developer's Manual Documentation Changes. Order 252046-084. https://cdrdv2.intel.com/v1/dl/getContent/671294 — T1
[11] Intel. Intel TDX Module Base Architecture Specification. Order 348549-008. May 2026. https://cdrdv2.intel.com/v1/dl/getContent/733575 — T1
[12] Intel. Intel TDX Module ABI Specification. Order 348551-008. May 2026. https://cdrdv2.intel.com/v1/dl/getContent/733579 — T1
[13] Intel. Intel TDX Module ABI Definitions (PDF/CSV/JSON). June 2026. https://cdrdv2.intel.com/v1/dl/getContent/795381 — T1
[14] Intel. Intel Trust Domain CPU Architectural Extensions. Order 343754-003. August 2026. https://cdrdv2.intel.com/v1/dl/getContent/733582 — T1
[15] Intel. Intel TDX SEAMLDR Interface Specification. Order 343755-004. May 2025. https://cdrdv2.intel.com/v1/dl/getContent/733584 — T1
[16] Intel. Intel TDX Guest-Hypervisor Communication Interface (GHCI) v1.5. Order 348552-004. 2023-03-17. https://cdrdv2.intel.com/v1/dl/getContent/726792 — T1
[17] Intel. Intel TDX Connect Architecture Specification. Order 354629-003. June 2025. https://cdrdv2.intel.com/v1/dl/getContent/773614 — T1 (cover reads "354629 003-US June 2025"; a widely-repeated "-004" is wrong)
[18] Intel. Intel TDX Module Extension for Quoting. Order 874303-0001. 2026-02-26. https://cdrdv2.intel.com/v1/dl/getContent/874303 — T1
[19] Intel. Intel TD Migration Architecture Specification. Order 348550-008. June 2026. https://cdrdv2.intel.com/v1/dl/getContent/733578 — T1
[20] Intel. Intel TD Partitioning Architecture Specification. Order 354807-006. May 2026. https://cdrdv2.intel.com/v1/dl/getContent/773039 — T1
[21] Intel. Intel Scalable I/O Virtualization Technical Specification. Order 337679-002, Rev 1.1. September 2020. https://www.intel.com/content/www/us/en/content-details/671403/ — T1 (cover reads Rev 1.1; the widely-cited "Rev 1.0" is wrong. Stale but current — no later revision published)
[22] Intel. Intel TDX documentation hub. https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/documentation.html — T1
[23] Intel. Intel Security Center advisories. https://www.intel.com/content/www/us/en/security-center/default.html — T1
[24] Intel. Intel Resource & Documentation Center (processor specification updates / silicon errata). https://edc.intel.com — T1
[25] Intel. Intel SDM landing page (current revision index). https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html — T1
[26] Intel. 5-Level Paging and 5-Level EPT White Paper. Document 335252-002. https://cdrdv2-public.intel.com/671442/5-level-paging-white-paper.pdf — T1  *(merge into the 26–40 Intel band)*

---

## 41–99 · Other official specifications (T2)

[41] AMD. AMD64 Architecture Programmer's Manual, Volume 2: System Programming (Ch.15 "Secure Virtual Machine"; App.B "Layout of VMCB"). Publication 24593. https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/24593.pdf — T2
[42] AMD. AMD64 Architecture Programmer's Manual, Volume 3: General-Purpose and System Instructions. Publication 24594. https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/24594.pdf — T2
[43] AMD. SEV Secure Nested Paging Firmware ABI Specification. Publication 56860. https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/specifications/56860.pdf — T2
[44] AMD. SEV-ES Guest-Hypervisor Communication Block Standardization (GHCB specification). Publication 56421. https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/specifications/56421.pdf — T2
[45] AMD. Secure Encrypted Virtualization API (SEV-KM API specification). Publication 55766. https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/programmer-references/55766_SEV-KM_API_Specification.pdf — T2
[46] AMD. AMD I/O Virtualization Technology (IOMMU) Specification. Publication 48882. https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/specifications/48882_IOMMU.pdf — T2
[47] AMD. AMD SEV-SNP: Strengthening VM Isolation with Integrity Protection and More. White paper. January 2020. https://www.amd.com/content/dam/amd/en/documents/epyc-business-docs/white-papers/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more.pdf — T2
[48] Arm. Arm Architecture Reference Manual for A-profile architecture. DDI 0487 (latest issue). https://developer.arm.com/documentation/ddi0487/latest/ — T2
[49] Arm. Arm Generic Interrupt Controller Architecture Specification, GIC architecture version 3 and version 4. IHI 0069 (latest issue). https://developer.arm.com/documentation/ihi0069/latest/ — T2
[50] RISC-V International. The RISC-V Instruction Set Manual, Volume II: Privileged Architecture — "H" Hypervisor Extension, Version 1.0. Snapshot v20260120. https://docs.riscv.org/reference/isa/v20260120/priv/hypervisor.html — T2
[51] Arm. Learn the architecture — AArch64 virtualization. Document 102142. https://developer.arm.com/documentation/102142/latest/ — T2
[52] Arm. Arm System Memory Management Unit Architecture Specification, version 3 (SMMUv3). IHI 0070 (latest issue). https://developer.arm.com/documentation/ihi0070/latest/ — T2

---

## 100–199 · VMX chapters (01–09)

[100] Intel. Intel Accelerating Virtualization Effort (press release announcing the preliminary Vanderpool Technology External Architecture Specification). 2005-01-20. https://www.intel.com/pressroom/archive/releases/2005/20050120comp.htm — T2
[101] Uhlig, R., Neiger, G., Rodgers, D., Santoni, A. L., Martins, F. C. M., Anderson, A. V., Bennett, S. M., Kägi, A., Leung, F. H., Smith, L. Intel Virtualization Technology. IEEE Computer 38(5), pp. 48–56. 2005-05. doi:10.1109/MC.2005.163 — T2
[102] Neiger, G., Santoni, A., Leung, F., Rodgers, D., Uhlig, R. Intel Virtualization Technology: Hardware Support for Efficient Processor Virtualization. Intel Technology Journal 10(3), ISSN 1535-864X. 2006-08. URL not verified in this pass; locate via the Intel Technology Journal archive — T2
[103] Popek, G. J., Goldberg, R. P. Formal Requirements for Virtualizable Third Generation Architectures. Communications of the ACM 17(7), pp. 412–421. 1974-07. https://dl.acm.org/doi/10.1145/361011.361073 — T2
[104] Robin, J. S., Irvine, C. E. Analysis of the Intel Pentium's Ability to Support a Secure Virtual Machine Monitor. Proceedings of the 9th USENIX Security Symposium, pp. 129–144. 2000-08. https://www.usenix.org/legacy/events/sec2000/robin.html — T2
[105] Wikipedia contributors. x86 virtualization. Accessed 2026-09-20. https://en.wikipedia.org/wiki/X86_virtualization — T3
[106] Linux kernel contributors. Linux kernel source: arch/x86/include/asm/vmx.h (VMCS field encodings, VM-execution control bit definitions) and arch/x86/kvm/vmx/. Accessed 2026-09-20. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/vmx.h — T2
[107] J. Gandhi, M. D. Hill, M. M. Swift. Agile Paging: Exceeding the Best of Nested and Shadow Paging. ISCA 2016. 2016. https://research.cs.wisc.edu/multifacet/papers/isca16_agile_paging.pdf — T2
[108] B. Teabe, P. Yuhala, A. Tchana, F. Hermenier, D. Hagimont, G. Muller. (No)Compromis: paging virtualization is not a fatality. VEE 2021. 2021. https://dl.acm.org/doi/10.1145/3453933.3454013 — T2
[109] J. Gandhi, A. Basu, M. D. Hill, M. M. Swift. Efficient Memory Virtualization: Reducing Dimensionality of Nested Page Walks. MICRO 2014. 2014. https://pages.cs.wisc.edu/~swift/papers/micro14-virtualization.pdf — T2
[110] S. Bitchebe, D. Mvondo, A. Tchana, L. Reveillere, N. De Palma. Intel Page Modification Logging, a hardware virtualization feature: study and improvement for virtual machine working set estimation. arXiv:2001.09991. 2020-01. https://arxiv.org/abs/2001.09991 — T2
[111] Yang Weijiang (Intel). Documentation: Introduce EPT based Subpage Protection, in "Enable Sub-page Write Protection Support" patch series; covered by LWN. 2018-11 / 2019. https://lwn.net/Articles/773402/ — T2
[112] S. Tanda. Intel VT-rp — Part 1 (remapping attack and HLAT) and Part 2 (paging-write and guest-paging verification). 2023-07. https://tandasat.github.io/blog/2023/07/05/intel-vt-rp-part-1.html — T3
[113] Microsoft. Protecting linear address translations with Hypervisor-enforced Paging Translation (HVPT). Windows OS Platform blog. 2025. https://techcommunity.microsoft.com/blog/windowsosplatform/protecting-linear-address-translations-with-hypervisor-enforced-paging-translati/4399739 — T2
[114] N. Bhatia. Performance Evaluation of Intel EPT Hardware Assist. VMware. 2009. https://www.vmware.com/pdf/Perf_ESX_Intel-EPT-eval.pdf — T2
[115] Linux kernel source. `arch/x86/include/asm/vmx.h`, `arch/x86/kvm/vmx/vmx.c` (EPT bit masks, PML, MSR-bitmap handling). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/vmx.c — T2
[116] J. Nakajima (Intel). Reviewing Unused and New Features for Interrupt/APIC Virtualization. Linux Plumbers Conference 2012. 2012-08. https://blog.linuxplumbersconf.org/2012/wp-content/uploads/2012/09/2012-lpc-virt-intel-vt-feat-nakajima.pdf — T2
[117] Zeng Guang, Gao Chao et al. (Intel). IPI virtualization support for VM (KVM patch series, v7). LWN archive. 2021-12-31. https://lwn.net/Articles/886810/ — T2
[118] Feng Wu (Intel). VT-d Posted Interrupts (`docs/misc/vtd-pi.txt`), Xen project documentation. ~2015. https://xenbits.xen.org/docs/4.9-testing/misc/vtd-pi.txt — T2
[119] Feng Wu (Intel). VT-d Posted-Interrupts kernel enablement, 25-patch series covering IOMMU, KVM and VFIO. LWN archive. 2014-11. https://lwn.net/Articles/624245/ — T2
[120] Chao Gao (Intel). KVM: x86/vmx: Suppress posted interrupt notification when CPU is in host. 2022-09-23. https://patchew.org/linux/20220923085806.384344-1-chao.gao@intel.com/ — T2
[121] J. De Gelas. Intel's Xeon E5-2600 V2: 12-core Ivy Bridge EP for Servers (APICv and FlexPriority discussion). AnandTech. 2013-09. https://www.anandtech.com/show/7285/intel-xeon-e5-2600-v2-12-core-ivy-bridge-ep/2 — T3
[122] Red Hat. Red Hat Enterprise Linux 7 Virtualization Tuning and Optimization Guide, §1.3 (APICv). https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/7/html/virtualization_tuning_and_optimization_guide/ — T2
[123] Linux kernel source. `arch/x86/kvm/vmx/posted_intr.h` (`struct pi_desc`). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/posted_intr.h — T2
[124] Intel. Intel Technology Journal, Vol. 14, Issue 3: Intel Virtualization Technology. 2010. https://www.intel.com/content/dam/www/public/us/en/documents/research/2010-vol14-iss-3-intel-technology-journal.pdf — T2
[150] Linux kernel. `arch/x86/include/asm/vmx.h` — VMX basic exit reason and VM-instruction error constants (`EXIT_REASON_*`, `VMXERR_*`). Mainline. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/vmx.h — T2
[151] Xen Project. `xen/arch/x86/include/asm/hvm/vmx/vmx.h` — VMX exit reason enumeration used by the Xen VMX backend. Mainline. https://xenbits.xen.org/gitweb/?p=xen.git;a=blob;f=xen/arch/x86/include/asm/hvm/vmx/vmx.h — T2
[152] FreeBSD Project. `sys/amd64/vmm/intel/vmcs.h` — bhyve VMCS field and exit reason definitions. Mainline. https://cgit.freebsd.org/src/tree/sys/amd64/vmm/intel/vmcs.h — T2
[153] Linux kernel. `arch/x86/include/asm/msr-index.h` — VMX capability MSR addresses, including `MSR_IA32_VMX_PROCBASED_CTLS3` (0x492) and `MSR_IA32_VMX_EXIT_CTLS2` (0x493). Mainline. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/asm/msr-index.h — T2
[154] Linux kernel. `arch/x86/kvm/vmx/vmx.c` — `adjust_vmx_controls()` and `setup_vmcs_config()`, the reference implementation of the allowed-0 / allowed-1 control-derivation algorithm. Mainline. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/vmx.c — T2

---

## 200–249 · VT-d (10–12)

[200] PCI-SIG. PCI Express Base Specification (Address Translation Services, Page Request Interface, PASID capability and PASID TLP Prefix). https://pcisig.com/specifications — T2
[201] Intel. Intel 5520 Chipset and Intel 5500 Chipset Specification Update (errata #47 and #53, interrupt-remapping unit reliability). Specification update issued 2011-09. https://edc.intel.com — T1 (document metadata not verified against the Intel PDF; cited at C:low)
[202] Citrix. "Intel 55x0 Chipset Errata – Interrupt Remapping Issue", article CTX136517. https://support.citrix.com/article/CTX136517 — T2
[203] UEFI Forum. Advanced Configuration and Power Interface (ACPI) Specification — system description table header conventions used by the DMAR table. https://uefi.org/specifications — T2
[204] Intel. Intel Scalable I/O Virtualization Technical Specification — PDF cover reading, September 2020, "Order Number: 337679-002, Rev 1.1". https://cdrdv2-public.intel.com/671403/intel-scalable-io-virtualization-technical-specification.pdf — T1

---

## 250–299 · TDX (13)

[250] Linux kernel documentation. Intel Trust Domain Extensions (TDX) — host kernel support. Current revision. https://docs.kernel.org/arch/x86/tdx.html — T2
[251] Intel. Intel TDX Feature Readiness by Intel Xeon Processor Generation. Support article 000099708. 2026-02-24. https://www.intel.com/content/www/us/en/support/articles/000099708/processors/intel-xeon-processors.html — T1
[252] Hornetz, T.; Yavarzadeh, H.; Cheu, A.; Gascon, A.; Gerlach, L.; Moghimi, D.; Schoppmann, P.; Schwarz, M.; Zhang, R. TDXRay: Microarchitectural Side-Channel Analysis of Intel TDX for Real-World Workloads. IEEE Symposium on Security and Privacy (S&P) 2026. https://tdxray.cpusec.org/ (paper: https://tdxray.cpusec.org/assets/tdxray_sp26.pdf) — T2
[253] Intel. 2026.1 IPU — Intel Trust Domain Extensions (Intel TDX) module Advisory. INTEL-SA-01397. 2026-02-10. https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-01397.html — T1
[254] Intel. Security announcement INTEL-2026-04-02-001 (Intel's response to the TDXRay side-channel research). 2026-04-02. https://www.intel.com/content/www/us/en/security-center/announcement/security-announcement-2026-04-02-001.html — T1
[255] Swidowski, K.; Moghimi, D.; Eads, J.; Aktas, E.; Ma, J. (Google). Security Assessment of Intel TDX with support for Live Migration. White paper, February 2026. arXiv:2602.11434. https://arxiv.org/abs/2602.11434 (full report: https://services.google.com/fh/files/misc/intel_tdx_1.5-full_report.pdf) — T2
[256] Intel. Intel Gaudi Software Installer Advisory. INTEL-SA-01271. 2025-05-13, revised 2025-05-14. https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-01271.html — T1

---

## 300–349 · Nested virtualization (14)

[300] Linux kernel documentation. Nested VMX (`Documentation/virt/kvm/x86/nested-vmx.rst`). https://www.kernel.org/doc/html/latest/virt/kvm/x86/nested-vmx.html — T2
[301] Linux kernel source. `arch/x86/kvm/vmx/nested.c` (KVM nVMX implementation). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/nested.c — T2
[302] Ben-Yehuda, M., Day, M. D., Dubitzky, Z., Factor, M., Har'El, N., Gordon, A., Liguori, A., Wasserman, O., Yassour, B.-A. The Turtles Project: Design and Implementation of Nested Virtualization. OSDI '10 (Jay Lepreau Best Paper). https://research.ibm.com/publications/the-turtles-project-design-and-implementation-of-nested-virtualization — T2
[303] Har'El, N. et al. Nested virtualization: shadow turtles. KVM Forum 2013. https://www.linux-kvm.org/images/e/e9/Kvm-forum-2013-nested-virtualization-shadow-turtles.pdf — T2
[304] Alon, L. (Oracle). Improving KVM x86 Nested Virtualization. KVM Forum 2017. https://events19.linuxfoundation.org/wp-content/uploads/2017/12/Improving-KVM-x86-Nested-Virtualization-Liran-Alon-Oracle.pdf — T2
[305] Belay, A., Bittau, A., Mashtizadeh, A., Terei, D., Mazières, D., Kozyrakis, C. Dune: Safe User-level Access to Privileged CPU Features. OSDI '12. https://mast.stanford.edu/pubs/dune/ — T2
[306] Lim, J. T., Dall, C., Li, S.-W., Nieh, J., Zyngier, M. NEVE: Nested Virtualization Extensions for ARM. SOSP '17, Shanghai, 2017-10-28. https://www.cs.columbia.edu/~nieh/pubs/sosp2017_neve.pdf — T2
[307] Bitchebe, S., Tchana, A. Out of Hypervisor (OoH): When Nested Virtualization Becomes Practical. arXiv:2202.13483, preprint, 2022-02-27. https://arxiv.org/abs/2202.13483 — T2
[308] SC '22 technical-paper page. Out of Hypervisor: Efficient Dirty Page Tracking in Userspace Using Hardware Virtualization Features. IEEE/ACM Supercomputing, Dallas, 2022-11. https://sc22.supercomputing.org/proceedings/tech_paper/tech_paper_pages/pap130.html — T2
[309] Bitchebe, S. PhD thesis (Université Côte d'Azur, defended 2023-02), containing the EPML evaluation. https://theses.hal.science/tel-04071875v1/file/2023COAZ4010.pdf — T2
[310] Tchana, A. et al. (No)Compromis: paging virtualization is not a fatality. VEE 2021. https://hal.science/hal-03183858v1 — T2
[311] Microsoft Learn. What is Nested Virtualization for Hyper-V? https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization — T2
[312] Microsoft Learn. Hyper-V Nested Virtualization Troubleshooting Guide. https://learn.microsoft.com/en-us/troubleshoot/windows-server/high-availability/hyper-v-nested-virtualization — T2
[313] Microsoft Learn. `Set-VMProcessor` (Hyper-V PowerShell module reference). https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vmprocessor — T2
[314] Microsoft Learn. Windows Hypervisor Platform API Definitions. https://learn.microsoft.com/en-us/virtualization/api/hypervisor-platform/hypervisor-platform — T2
[315] Microsoft Learn. Virtualization applications can't run alongside Hyper-V and its dependent features. https://learn.microsoft.com/en-us/troubleshoot/windows-client/application-management/virtualization-apps-not-work-with-hyper-v — T2
[316] Microsoft Learn. Hypervisor Top-Level Functional Specification: Nested Virtualization (enlightened VMCS). https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/nested-virtualization — T2
[317] Microsoft Learn. Virtual Secure Mode (Hypervisor TLFS). https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/vsm — T2
[318] Linux kernel documentation. The Definitive KVM (Kernel-based Virtual Machine) API Documentation (`KVM_CAP_NESTED_STATE`, `KVM_GET/SET_NESTED_STATE`). https://www.kernel.org/doc/html/latest/virt/kvm/api.html — T2
[319] LKML. KVM: VMX: Fix nested EPT violation injection of GVA_IS_VALID/GVA_TRANSLATED bits (2026). https://lkml.iu.edu/hypermail/linux/kernel/2603.1/10895.html — T2
[320] linux-kvm.org. Nested Guests (project wiki). https://www.linux-kvm.org/page/Nested_Guests — T2
[321] Gordon, A., Amit, N., Har'El, N., Ben-Yehuda, M., Landau, A., Schuster, A., Tsafrir, D. ELI: Bare-Metal Performance for I/O Virtualization. ASPLOS '12 / CACM 2016. https://research.ibm.com/publications/eli-bare-metal-performance-for-io-virtualization — T2
[322] Li, S.-W., Li, X., Gu, R., Nieh, J., Hui, J. A Secure and Formally Verified Linux KVM Hypervisor (SeKVM). IEEE S&P 2021; Formal verification on Arm relaxed memory hardware, SOSP 2021. https://par.nsf.gov/biblio/10311016-formal-verification-multiprocessor-hypervisor-arm-relaxed-memory-hardware — T2
[323] Microsoft Learn. Virtualization-based Security (VBS). https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-vbs — T2 (same document as [378]; allocated in the chapter-14 band so that chapter 14 cites only its own range)

---

## 350–399 · Security (15)

[350] Intel. Speculative Execution Side Channel Mitigations. Document 336996, Revision 3.0, May 2018. https://cdrdv2-public.intel.com/671221/336996-speculative-execution-side-channel-mitigations.pdf — T1
[351] Intel. L1 Terminal Fault / CVE-2018-3615, CVE-2018-3620, CVE-2018-3646 / INTEL-SA-00161 (advisory guidance). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/advisory-guidance/l1-terminal-fault.html — T1
[352] Intel. Intel Analysis of L1 Terminal Fault (technical documentation, doc ID 758376). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/technical-documentation/intel-analysis-l1-terminal-fault.html — T1
[353] Intel Security Center. INTEL-SA-00161. https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00161.html — T1
[354] Intel. Intel Analysis of Microarchitectural Data Sampling (technical documentation). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/technical-documentation/intel-analysis-microarchitectural-data-sampling.html — T1
[355] Intel. Gather Data Sampling (advisory guidance). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/advisory-guidance/gather-data-sampling.html — T1
[356] Intel Security Center. INTEL-SA-00828 (Gather Data Sampling / CVE-2022-40982). https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00828.html — T1
[357] Intel. Return Stack Buffer Underflow / CVE-2022-29901, CVE-2022-28693 / INTEL-SA-00702. https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/advisory-guidance/return-stack-buffer-underflow.html — T1
[358] Intel. Branch History Injection and Intra-mode Branch Target Injection (technical documentation). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/technical-documentation/branch-history-injection.html — T1
[359] Intel. Retpoline: A Branch Target Injection Mitigation (technical documentation). https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/technical-documentation/retpoline-branch-target-injection-mitigation.html — T1
[360] Intel. Intel Trusted Execution Technology (Intel TXT) Software Development Guide / Measured Launched Environment Developer's Guide. Document 315168-017, October 2025. https://cdrdv2-public.intel.com/315168/315168_TXT_MLE_DG_rev_017_7.pdf — T1
[361] Linux kernel documentation. L1TF — L1 Terminal Fault. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/l1tf.html — T2
[362] Linux kernel documentation. MDS — Microarchitectural Data Sampling. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/mds.html — T2
[363] Linux kernel documentation. TAA — TSX Asynchronous Abort. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/tsx_async_abort.html — T2
[364] Linux kernel documentation. Special Register Buffer Data Sampling (SRBDS). https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/special-register-buffer-data-sampling.html — T2
[365] Linux kernel documentation. GDS — Gather Data Sampling. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/gather_data_sampling.html — T2
[366] Linux kernel documentation. Spectre Side Channels. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/spectre.html — T2
[367] Linux kernel documentation. Core Scheduling. https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/core-scheduling.html — T2
[368] Van Bulck, J. et al. Foreshadow: Extracting the Keys to the Intel SGX Kingdom with Transient Out-of-Order Execution. USENIX Security '18. https://www.usenix.org/conference/usenixsecurity18/presentation/van-bulck — T2
[369] Schwarz, M. et al. ZombieLoad: Cross-Privilege-Boundary Data Sampling. ACM CCS 2019. https://zombieloadattack.com/ — T2
[370] van Schaik, S. et al. RIDL: Rogue In-Flight Data Load (IEEE S&P 2019) and Fallout (ACM CCS 2019). https://mdsattacks.com/ — T2
[371] Wikner, J., Razavi, K. Retbleed: Arbitrary Speculative Code Execution with Return Instructions. USENIX Security '22, ETH Zurich COMSEC. https://comsec.ethz.ch/research/microarch/retbleed/ — T2
[372] Moghimi, D. Downfall: Exploiting Speculative Data Gathering. USENIX Security '23. https://www.usenix.org/system/files/usenixsecurity23-moghimi.pdf — T2
[373] King, S. T., Chen, P. M., Wang, Y.-M., Verbowski, C., Wang, H. J., Lorch, J. R. SubVirt: Implementing Malware with Virtual Machines. IEEE Symposium on Security and Privacy, May 2006. http://web.eecs.umich.edu/~pmchen/papers/king06.pdf — T2
[374] Naval Postgraduate School thesis. An Analysis of Hardware-Assisted Virtual Machine Based Rootkits (Blue Pill and Vitriol). https://upload.wikimedia.org/wikipedia/commons/6/62/An_analysis_of_hardware-assisted_virtual_machine_based_rootkits_%28IA_annalysisofhardw1094542621%29.pdf — T2
[375] Red Hat. VENOM — QEMU virtual Floppy Disk Controller vulnerability (CVE-2015-3456). https://access.redhat.com/articles/1444903 — T2
[376] Red Hat. Performance considerations for L1 Terminal Fault. https://access.redhat.com/articles/L1TF-perf — T2
[377] Synacktiv. On the clock: Escaping VMware Workstation at Pwn2Own Berlin 2025. https://synacktiv.com/en/publications/on-the-clock-escaping-vmware-workstation-at-pwn2own-berlin-2025 — T3
[378] Microsoft Learn. Virtualization-based Security (VBS). https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-vbs — T2
[379] Microsoft Learn. Memory integrity enablement. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-hvci-enablement — T2
[380] Microsoft Learn. Virtual Secure Mode (Hypervisor TLFS). https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/vsm — T2
[381] Microsoft Learn. Isolated User Mode (IUM) Processes. https://learn.microsoft.com/en-us/windows/win32/procthread/isolated-user-mode--ium--processes — T2
[382] Microsoft Learn. Memory Integrity and Virtualization-Based Security (VBS) — Windows drivers. https://learn.microsoft.com/en-us/windows-hardware/drivers/bringup/device-guard-and-credential-guard — T2
[383] Microsoft Learn. Driver Compatibility with Hypervisor-Protected Code Integrity (HLK test reference). https://learn.microsoft.com/en-us/windows-hardware/test/hlk/testref/driver-compatibility-with-device-guard — T2
[384] Microsoft Learn. How Credential Guard works. https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/how-it-works — T2
[385] Microsoft Learn. Kernel DMA Protection. https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt — T2
[386] Microsoft Learn. Kernel DMA Protection (Memory Access Protection) for OEMs. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-kernel-dma-protection — T2
[387] Microsoft Learn. Enable DMA Remapping for Device Drivers. https://learn.microsoft.com/en-us/windows-hardware/drivers/pci/enabling-dma-remapping-for-device-drivers — T2
[388] Microsoft Learn. Windows 11 security book — Silicon assisted security (System Guard, DRTM, MBEC/GMET). https://learn.microsoft.com/en-us/windows/security/book/hardware-security-silicon-assisted-security — T2
[389] Tom's Hardware. Benchmarked: Do Windows 11's Security Features Really Hobble Gaming Performance? https://www.tomshardware.com/news/windows-11-gaming-benchmarks-performance-vbs-hvci-security — T3
[390] Tom's Hardware. Tested: Default Windows VBS Setting Slows Games Up to 10%, Even on RTX 4090. https://www.tomshardware.com/news/windows-vbs-harms-performance-rtx-4090 — T3
[391] IT之家, reporting ComputerBase measurements of memory-integrity overhead. https://www.ithome.com/0/997/293.htm — T3
[392] Markettos, A. T. et al. Thunderclap: Exploring Vulnerabilities in Operating System IOMMU Protection via DMA from Untrustworthy Peripherals. NDSS 2019. https://thunderclap.io/ — T2
[393] NVD. CVE-2021-28476 (Hyper-V `vmswitch.sys` remote code execution). https://nvd.nist.gov/vuln/detail/CVE-2021-28476 — T2
[394] NVD. CVE-2020-14364 (QEMU USB emulation out-of-bounds read/write). https://nvd.nist.gov/vuln/detail/CVE-2020-14364 — T2
[395] Microsoft Learn. Virtualization-based security (VBS) enclaves. https://learn.microsoft.com/en-us/windows/win32/trusted-execution/vbs-enclaves — T2
[396] Intel Security Center. INTEL-SA-00233 (Microarchitectural Data Sampling; CVE-2018-12126, CVE-2018-12127, CVE-2018-12130, CVE-2019-11091). https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00233.html — T1 (page fetched 2026-09-20; the four CVEs above are the ones it lists)
[397] Intel Security Center. INTEL-SA-00270 (TSX Asynchronous Abort; CVE-2019-11135). https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00270.html — T1 (page fetched 2026-09-20)
[398] Intel Security Center. INTEL-SA-00320 (Special Register Buffer Data Sampling; CVE-2020-0543). https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00320.html — T1 (page fetched 2026-09-20)
[399] Intel Security Center. INTEL-SA-00702 (Return Stack Buffer Underflow; CVE-2022-29901). https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00702.html — T1 (page fetched 2026-09-20; the advisory page itself lists only CVE-2022-29901 — CVE-2022-28693 appears in the advisory-guidance article [357], not on this page)

---

## 400–449 · Performance (16)

[400] Intel. Intel Technology Journal, Volume 14, Issue 3: "Intel Virtualization Technology: Hardware Support for Efficient Processor Virtualization". 2010. https://www.intel.com/content/dam/www/public/us/en/documents/research/2010-vol14-iss-3-intel-technology-journal.pdf — T2 (Intel official, non-normative)
[401] Keith Adams, Ole Agesen (VMware). A Comparison of Software and Hardware Techniques for x86 Virtualization. ASPLOS 2006. 2006-10. https://web.stanford.edu/class/cs240/readings/hwsw.pdf — T2
[402] Udo Steinberg, Bernhard Kauer. NOVA: A Microhypervisor-Based Secure Virtualization Architecture. EuroSys 2010. 2010-04. http://eurosys2010.sigops-france.fr/proceedings/docs/p209.pdf — T2
[403] VMware. Performance Evaluation of Intel EPT Hardware Assist. c. 2009. https://www.vmware.com/pdf/Perf_ESX_Intel-EPT-eval.pdf — T2
[404] Jeongseob Ahn et al. Revisiting Hardware-Assisted Page Walks for Virtualized Systems. ISCA 2012. https://jeongseob.github.io/assets/papers/ahn_isca12.pdf — T2
[405] Wang et al. Selective Hardware/Software Memory Virtualization. VEE 2011. (Indexed at https://www.scilit.com/publications/ba5ff9f76e3c2c47f4776dac04c7fdf4 ; the full text was not re-read for this chapter.) — T2
[406] Boris Teabe et al. (No)Compromis: paging virtualization is not a fatality. VEE 2021. http://sigplan.github.io/OpenTOC/vee21.html — T2
[407] Wes Felter, Alexandre Ferreira, Ram Rajamony, Juan Rubio (IBM). An Updated Performance Comparison of Virtual Machines and Linux Containers. IBM Research Report RC25482, 2014; published at ISPASS 2015-03. https://read.seas.harvard.edu/~kohler/class/cs260r-s19/containerperf14.pdf — T2
[408] Muli Ben-Yehuda et al. (IBM). The Turtles Project: Design and Implementation of Nested Virtualization. OSDI 2010. 2010-12. https://www.cs.utexas.edu/~witchel/S25-380L/papers/benyehuda10osdi-turtles.pdf — T2
[409] Stella Bitchebe, Alain Tchana et al. Out of Hypervisor (OoH) / EPML: extending hypervisor-reserved hardware features to guest processes. arXiv 2202.13483 (preprint, 2022-02); published at SC'22. https://arxiv.org/abs/2202.13483 — T2
[410] Brendan Gregg. KPTI/KAISER Meltdown Initial Performance Regressions. 2018-02-09. https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html — T3 (engineer's blog; method published, cited with attribution)
[411] Linux kernel documentation. L1TF — L1 Terminal Fault (admin-guide/hw-vuln/l1tf). https://docs.kernel.org/admin-guide/hw-vuln/l1tf.html — T2
[412] VMware. Performance of vSphere 6.7 U2 Scheduling Options (SCAv1 / SCAv2). 2019-04. https://www.vmware.com/techpapers/2018/scheduler-options-vsphere67u2-perf.html — T2
[413] Microsoft Research. A Secret-Free Hypervisor: Rethinking Isolation in the Age of Speculative Vulnerabilities. 2022. https://www.microsoft.com/en-us/research/wp-content/uploads/2022/07/sf-hypervisor.pdf — T2
[414] Yaozu Dong et al. High Performance Network Virtualization with SR-IOV. c. 2010. http://zhenxiao.com/read/SR-IOV.pdf — T2
[415] Paolo Bonzini. KVM: add support for halt-polling (`halt_poll_ns`), Linux commit f7819512996361280b86259222456fcf15aad926. 2015-02. https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=f7819512996361280b86259222456fcf15aad926 — T2
[416] linux-kvm.org project wiki. Virtio/Block/Latency (I/O latency breakdown). Undated. https://www.linux-kvm.org/page/Virtio/Block/Latency — T2 (project wiki; no date, no hardware description)
[417] Microsoft. Dynamic Memory Coming to Hyper-V, Part 3 (SLAT and large pages). Microsoft TechCommunity virtualization blog; original post c. 2010, re-published 2019-03. https://techcommunity.microsoft.com/t5/Virtualization/Dynamic-Memory-Coming-to-Hyper-V-Part-3-8230/ba-p/381714 — T3 (vendor engineering blog, attributed)
[418] Oracle. Oracle VM VirtualBox Administrator's Guide — Technical Background (nested paging and large pages). https://docs.oracle.com/en/virtualization/virtualbox/6.1/admin/TechnicalBackground.html — T2
[419] Zeng Guang, Gao Chao et al. (Intel). [PATCH v7 00/08] IPI virtualization support for VM — LKML cover letter with measurement tables. 2021-12-31, LWN archive. https://lwn.net/Articles/886810/ — T2
[420] Jun Nakajima (Intel). Reviewing Unused and New Features for Interrupt/APIC Virtualization. Linux Plumbers Conference 2012 slides. 2012-08. https://blog.linuxplumbersconf.org/2012/wp-content/uploads/2012/09/2012-lpc-virt-intel-vt-feat-nakajima.pdf — T2
[421] Feng Wu (Intel). [PATCH v2 00/25] VT-d Posted-Interrupts support. LKML/LWN archive, 2014-11. https://lwn.net/Articles/624245/ — T2
[422] OneUptime. Containers vs VMs: density and efficiency comparison (table of per-event VM-exit cycle ranges). 2026-01. https://oneuptime.com/blog/post/2026-01-16-containers-vs-vms-density-efficiency-comparison/view — T3 (no method published; recorded here only to mark it unusable)
[423] ParaCell (authors not re-verified). arXiv 2605.20906 — cites prior nested-virtualization measurements (4.3x throughput reduction, +114% container start latency). https://arxiv.org/pdf/2605.20906 — T2 (preprint; the figures it quotes are second-hand)
[424] Red Hat. L1 Terminal Fault (L1TF) — CVE-2018-3620 / CVE-2018-3646 vulnerability response. https://access.redhat.com/security/vulnerabilities/L1TF — T2
[425] Ubuntu Launchpad bug #1724614. High host system time with default KVM `halt_poll_ns`. 2017. https://bugs.launchpad.net/bugs/1724614 — T3 (single bug report, attributed)
[426] Secondary report of third-party gaming benchmarks of Windows memory integrity (HVCI), attributed to ComputerBase. The original benchmark article was not read for this chapter; only this secondary report was. 2026-09. https://www.163.com/dy/article/L5T0D6T30552OI16.html — T3

---

## 450–499 · Windows platform (17)

[450] Linux kernel documentation. The Definitive KVM (Kernel-based Virtual Machine) API Documentation (`virt/kvm/api`). https://docs.kernel.org/virt/kvm/api.html — T2
[451] Linux kernel source. `arch/x86/kvm/vmx/vmx.c` (VMX vendor module: `vmx_hardware_setup()`, `kvm_vmx_exit_handlers[]`, `handle_ept_violation()`, module parameters). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/vmx.c — T2
[452] Linux kernel documentation. The kernel's command-line parameters (`kvm-intel.*` module parameters). https://docs.kernel.org/admin-guide/kernel-parameters.html — T2
[453] Linux kernel documentation. Running nested guests with KVM (`virt/kvm/x86/running-nested-guests`). https://docs.kernel.org/virt/kvm/x86/running-nested-guests.html — T2
[454] Linux kernel source. `arch/x86/kvm/mmu/mmu.c` (`kvm_mmu_page_fault()`, `kvm_tdp_page_fault()`, memslot-based faulting). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/mmu/mmu.c — T2
[455] QEMU project. QEMU system emulation user's guide (KVM accelerator, machine types, device model). https://www.qemu.org/docs/master/system/ — T2
[457] QEMU source. `accel/kvm/kvm-all.c` (`kvm_init()`, memory listener → memslots, `kvm_cpu_exec()` exit dispatch). https://gitlab.com/qemu-project/qemu/-/blob/master/accel/kvm/kvm-all.c — T2
[458] Xen Project wiki. Xen Project Software Overview (PV, HVM, PVHVM, PVH guest types). https://wiki.xenproject.org/wiki/Xen_Project_Software_Overview — T2
[459] Xen Project wiki. VTd HowTo / Xen PCI Passthrough (IOMMU requirements for HVM passthrough). https://wiki.xenproject.org/wiki/VTd_HowTo — T2
[460] VMware. Performance Best Practices for VMware vSphere (CPU/MMU hardware-assist monitor modes). https://www.vmware.com/docs/perf_best_practices_vsphere65 — T2
[461] Microsoft. Hypervisor Top-Level Functional Specification (TLFS): hypercall interface, synthetic MSRs, SynIC, VP assist page, Virtual Secure Mode. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/tlfs — T2
[462] Microsoft. Hyper-V Architecture (root partition, child partitions, VSP/VSC, VMBus). https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/reference/hyper-v-architecture — T2
[463] Microsoft. Virtual Secure Mode (Virtual Trust Levels) — TLFS chapter. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/vsm — T2
[464] Linux kernel documentation. VMBus (`virt/hyperv/vmbus`) — ring-buffer channel protocol as implemented by the Linux guest drivers. https://docs.kernel.org/virt/hyperv/vmbus.html — T2
[465] Microsoft. Windows Hypervisor Platform API reference (`WHvCreatePartition`, `WHvMapGpaRange`, `WHvRunVirtualProcessor`, exit contexts). https://learn.microsoft.com/en-us/virtualization/api/hypervisor-platform/hypervisor-platform — T2
[471] OASIS. Virtual I/O Device (VIRTIO) Version 1.2 Specification. https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html — T2
[472] Linux kernel source. `arch/x86/kvm/vmx/posted_intr.c` (`vmx_can_use_vtd_pi()`, blocked-vCPU wakeup vector handling). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/vmx/posted_intr.c — T2
[474] Microsoft Learn. Comparing WSL versions (WSL 2 runs a full Linux kernel in a lightweight utility VM). https://learn.microsoft.com/en-us/windows/wsl/compare-versions — T2
[475] Microsoft Learn. Windows Sandbox overview. https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-overview — T2
[476] Microsoft Learn. Virtualization-based security (VBS) enablement and hardware requirements. https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-vbs — T2
[477] Microsoft Learn. Kernel DMA Protection. https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt — T2
[478] Microsoft Learn. Microsoft Defender Application Guard overview. https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/microsoft-defender-application-guard/md-app-guard-overview — T2
[479] Microsoft Learn. Run Hyper-V in a virtual machine with nested virtualization. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization — T2
[480] Microsoft Learn. Enable Hyper-V on Windows, including the processor and firmware prerequisites. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v — T2
[481] Docker Inc. Docker Desktop WSL 2 backend documentation. https://docs.docker.com/desktop/features/wsl/ — T2
[482] Google. Configure hardware acceleration for the Android Emulator (Windows Hypervisor Platform). https://developer.android.com/studio/run/emulator-acceleration — T2
[483] Microsoft Learn. Enable virtualization-based protection of code integrity (memory integrity) and its driver-compatibility requirements. https://learn.microsoft.com/en-us/windows/security/hardware-security/enable-virtualization-based-protection-of-code-integrity — T2
[484] Microsoft Learn. Hyper-V integration services and synthetic device drivers for guests. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/reference/integration-services — T2
[485] Microsoft Learn. Managing Hyper-V hypervisor scheduler types (classic, core and root schedulers). https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/manage-hyper-v-scheduler-types — T2

---

## 500–549 · Cross-vendor comparison (18)

[500] Technical University of Munich, Decentralized Systems Engineering group (authors not transcribed from the PDF cover). An Empirical Analysis of AMD SEV-SNP and Intel TDX. SIGMETRICS 2025 (summer round); preprint dated 2024-11. https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf — T2
[501] Naveen N Rao (AMD). [PATCH] KVM: SVM: Enable AVIC by default from Zen 4 — LKML thread with Sean Christopherson and Maxim Levitsky. 2025-06-26. https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/ — T2
[502] Red Hat Bugzilla #2502578. AMD erratum #1235: stale IsRunning bit during ICR write emulation suppresses AVIC_IPI_FAILURE_TARGET_NOT_RUNNING. https://bugzilla.redhat.com/show_bug.cgi?id=2502578 — T2
[503] Linux kernel source. `arch/x86/kvm/svm/svm.c` (SVM vendor module: VMCB setup, intercepts, ASID/TLB_CONTROL handling). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/svm/svm.c — T2
[504] Linux kernel documentation. Secure Encrypted Virtualization (SEV / SEV-ES / SEV-SNP) KVM support (`virt/kvm/x86/amd-memory-encryption`). https://docs.kernel.org/virt/kvm/x86/amd-memory-encryption.html — T2
[505] Sean Christopherson. [PATCH] KVM: x86: split `tlb_flush_guest` into vendor implementations (VMX: INVVPID single-context; SVM: flush current ASID). LKML, 2020-03-17. https://lkml.org/lkml/2020/3/17/37 — T2
[506] Linux kernel source. `arch/x86/include/uapi/asm/svm.h` (SVM exit-code constants: `SVM_EXIT_NPF` 0x400, `SVM_EXIT_AVIC_INCOMPLETE_IPI` 0x401, `SVM_EXIT_VMGEXIT` 0x403; `TLB_CONTROL_*`). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/include/uapi/asm/svm.h — T2
[507] Linux kernel source. `arch/x86/kvm/svm/sev.c` (GHCB protocol handling, RMP/VMPL interaction, SNP guest requests). https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/kvm/svm/sev.c — T2
[508] Linux kernel documentation. KVM/arm64 — hypervisor mode, VHE and nVHE operation (`virt/kvm/arm`). https://docs.kernel.org/virt/kvm/index.html — T2

---

## 550–599 · Dated landscape (90)

[550] Amazon Web Services. AWS bare metal instances (re:Post official answer). 2024-01-18. https://repost.aws/zh-Hans/questions/QUuxrAV70ETqqH97p9mXN-Iw/aws-bare-metal-instances — T2
[551] Amazon Web Services. Nested virtualization on virtual Amazon EC2 instances (re:Post article). 2026-02. https://repost.aws/zh-Hans/articles/ARowyP4itvSfSZEmflfvtbUA/nested-virtualization-on-virtual-amazon-ec2-instances — T2
[552] Microsoft. Windows 11 VBS / Credential Guard / memory-integrity default enablement (Microsoft Learn text relayed by hitoritech 2026-05-14 and IT之家 2026-09-02; the Learn page itself was not fetched during this rebuild). https://hitoritech.com/blog/how-to-fix-netlogon-5719-on-windows-11-24h2/ ; https://www.ithome.com/0/997/293.htm — T3 (relayed)
[553] AntStack. AWS re:Invent 2025 CMP359 — Introducing Nitro Isolation Engine: transparency through mathematics (session transcript). 2025-12. https://www.antstack.com/talks/reinvent25/aws-reinvent-2025---introducing-nitro-isolation-engine-transparency-through-mathematics-cmp359/ — T3
[554] Brendan Gregg (AWS re:Invent 2017, CMP332/CMP330) — "EC2 C5 instances and the Nitro hypervisor", Chinese reprint. Original 2017-11, reprint 2022-04-23. https://course.zhidx.com/download/detail/NjBkN2MxMjA4YjEyM2ZiZmUzYzM= — T3
[555] DataCenterDynamics. Microsoft announces Azure Boost to offload virtualization processes. 2023-07-20. https://www.datacenterdynamics.com/en/news/microsoft-announces-azure-boost-to-offload-virtualization-processes/ — T3
[556] Microsoft Tech Community (Azure Confidential Computing Blog). Announcing the public preview of Azure confidential VMs with Intel TDX. 2023-11-15. https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/announcing-the-public-preview-of-azure-confidential-vms-with-intel-tdx/3968256 — T2
[557] Microsoft Tech Community (Azure Confidential Computing Blog). Announcing general availability of Azure Intel TDX confidential VMs. 2026-02-26. https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/announcing-general-availability-of-azure-intel%C2%AE-tdx-confidential-vms/4495693 — T2
[558] Microsoft Azure Blog. Nested virtualization in Azure. 2017-07-13. https://azure.microsoft.com/en-us/blog/nested-virtualization-in-azure/ — T2
[559] Google Cloud Platform Blog. Introducing nested virtualization for Google Compute Engine. 2017-09-28. https://cloudplatform.googleblog.com/2017/09/ — T2
[560] Futurum Group. Google delivers Titanium hardware offload for efficient performance (Cloud Field Day 20). 2024-06-28. https://futurumgroup.com/insights/google-delivers-titanium-hardware-offload-for-efficient-performance/ — T3
[561] SiliconANGLE. Intel and Google Cloud launch confidential computing instances powered by 4th Gen Xeon processors. 2024-10-02. https://siliconangle.com/2024/10/02/intel-google-cloud-launch-confidential-computing-instances-powered-4th-gen-xeon-processors/ — T3
[562] Alibaba Cloud. Build a TDX confidential computing environment (ECS user guide). https://help.aliyun.com/zh/ecs/user-guide/build-a-tdx-confidential-computing-environment — T2
[563] Alibaba Cloud. Elastic Bare Metal Server overview (ECS user guide). https://help.aliyun.com/zh/ecs/user-guide/elastic-bare-metal-server-overview — T2
[564] Alibaba Cloud. Preparing for server migration (SMC user guide; ordinary ECS instances do not support nested virtualization). https://help.aliyun.com/zh/smc/user-guide/preparing-for-server-migration — T2
[565] 新浪财经. 凿山铺路十五年：一场云计算的远征 (Alibaba Cloud retrospective; source of the "40% of cores lost to virtualization" and "one month before Nitro" statements). 2025-09-08. https://finance.sina.cn/stock/jdts/2025-09-08/detail-infpuftk9706662.d.html — T3
[566] 稀土掘金. MOC 卡——神龙架构如何实现网络与存储的融合 (source of the 100% / 5x I/O / 160% figures). 2025-12-09. https://juejin.cn/post/7581727073582153779 — T3
[567] 腾讯云开发者社区. 把腾讯搬上云：云服务器 CVM 的半部进化史. 2022-06. https://cloud.tencent.com/developer/article/2034477 — T3
[568] Huawei. 算力基础设施安全技术白皮书 (Qingtian architecture). 2025-09. https://www-file.huawei.com/dam/asset/view/6812dab6dd4e4640b11619e401db1c47.pdf — T3
[569] Huawei Cloud. Workspace product bulletin and HuaweiCloudStack 6.5.1 FAQ (nested virtualization not supported). https://support.huaweicloud.com/bulletin-workspace/bulletin-workspace-pdf.pdf ; https://support.huawei.com/enterprise/zh/knowledge/EKB1100072363 — T2
[570] IBM Community. Intel TDX now available in Frankfurt (IBM Cloud VPC bx3dc/cx3dc profiles). 2025-10-14. https://community.ibm.com/community/user/blogs/meryl-veramonti/2025/10/14/intel-tdx-frankfurt — T2
[571] Volcengine. 安全增强通用型实例 g3ilt/g4ilt (TDX) 文档. 2024-12. https://www.volcengine.com/docs/6396/1339011 — T2
[572] Synacktiv. On the clock: escaping VMware Workstation at Pwn2Own Berlin 2025. 2025-05. https://synacktiv.com/en/publications/on-the-clock-escaping-vmware-workstation-at-pwn2own-berlin-2025 — T2
[573] ServeTheHome Forums. Granite Rapids TDX initialisation blocked by BIOS SEAMRR handover (Gigabyte MS04-CE0; Intel Support confirmed a BIOS defect). 2026-03-09. https://forums.servethehome.com/index.php?threads/54995/ — T3
[574] Phoronix. Intel TDX host support for KVM lands in Linux 6.16. 2025-06-02. https://www.phoronix.com/news/Intel-TDX-Host-KVM-Linux-6.16 — T3
[575] kernel.org. Intel Trust Domain Extensions (TDX) — x86 architecture documentation. https://docs.kernel.org/arch/x86/tdx.html — T2
[576] Canonical. Canonical releases Ubuntu 25.10 "Questing Quokka". 2025-10-09. https://ubuntu.com/blog/canonical-releases-ubuntu-25-10-questing-quokka — T2
[577] Canonical. Ubuntu Server documentation — Intel TDX. 2026-06-26. https://ubuntu.com/server/docs/how-to/virtualisation/intel-tdx/ — T2
[578] OpenStack. nova-specs 2026.2 — Intel TDX libvirt support (approved). 2026-09-07. https://specs.openstack.org/openstack/nova-specs/specs/2026.2/approved/intel-tdx-libvirt-support.html — T2
[579] Broadcom/VMware. VMware Cloud Foundation 9.1 release notes (third-party mirror; GA 2026-05-12). https://vmwaretechdocs.in/content/vcf/9.1/part-1-release-notes.html — T3 (mirror; recheck against Broadcom original)
[580] QEMU project. Intel Trust Domain Extensions (TDX) — system emulation documentation. https://www.qemu.org/docs/master/system/i386/tdx.html — T2
[581] LWN.net. Notify VM exit (KVM patch series coverage). 2022-05-24. https://lwn.net/Articles/896122/ — T2
[582] Phoronix. Intel IPI virtualization merged for Linux 5.19 (with tertiary VM-execution controls). 2022-05-13. https://www.phoronix.com/news/Intel-IPI-Virtualization-5.19 — T3
[583] virt-report. KVM mailing-list daily digest, 2026-08-15 (TDX VM-DoS prevention v3, TDX KVM selftests v14 still under review). https://virt.taifua.com/daily/2026-08-15.html — T3
[584] Intel. intel/confidential-computing.tdx.tdx-module — GitHub Releases (TDX Module 1.5.x and 2.0.x supported-platform lists). Accessed 2026-08-12. https://github.com/intel/confidential-computing.tdx.tdx-module/releases — T1
[585] Intel. Intel TDX Feature Readiness by Intel Xeon Processor Generation (support article 000099708). 2026-02-24. https://www.intel.com/content/www/us/en/support/articles/000099708/processors/intel-xeon-processors.html — T1
[586] Intel. Intel Xeon 6 Product Brief. 2026-05-13. https://www.intel.com/content/www/us/en/products/docs/xeon-6-product-brief.html — T1
[587] Confidential Computing Consortium. February 2025 newsletter (Intel announced TEE-IO / Intel TDX Connect support on Xeon 6 on 2025-02-24). 2025-03-03. https://confidentialcomputing.io/2025/03/03/welcome-to-the-2025-february-newsletter/ — T3
[588] Intel Newsroom. Intel Xeon 6 processors press kit. Page updated 2025-06-10. https://newsroom.intel.cn/en/press-kit/press-kit-intel-xeon-6-processors — T1
[589] ServeTheHome. Intel Xeon 6+ Clearwater Forest is out. 2026-06-01. https://www.servethehome.com/intel-xeon-6-clearwater-forest-is-out/ — T3
[590] ServeTheHome. Intel Xeon Clearwater Forest with 288 cores on Intel 18A at Hot Chips 2025. 2025-08-25. https://www.servethehome.com/intel-xeon-clearwater-forest-with-288-cores-on-intel-18a-at-hot-chips-2025/ — T3
[591] VideoCardz. Intel Core Ultra 300 "Panther Lake" officially launches at CES 2026 on January 5th. 2025-11-20. https://videocardz.com/newz/intel-core-ultra-300-panther-lake-officially-launches-at-ces-2026-on-january-5th — T3
[592] Wccftech. Intel Diamond Rapids Xeon 7 CPUs built on 18A-P (core-count reporting that conflicts with Intel's own "+50%" figure). 2026-06-01. https://wccftech.com/intel-diamond-rapids-xeon-7-cpus-built-on-18a-p/ — T3
[593] EE Times. At MWC, Intel shows Xeon 6 power for telecom (5:1 average consolidation, up to 68% TCO saving). 2025-03-07. https://www.eetimes.com/at-mwc-intel-shows-xeon-6-power-for-telecom/ — T3
[594] Gartner. Worldwide IaaS public cloud services market share, 2024 (press release, August 2025; consulted through transcriptions carrying the full data table). 2025-08. https://news.futunn.com/hk/post/60515918 — T3 (transcription of a Gartner release)
[595] Synergy Research Group. GenAI helps drive quarterly cloud revenues to $119 billion as growth rate jumped yet again in Q4. 2026-02-05. https://www.srgresearch.com/articles/genai-helps-drive-quarterly-cloud-revenues-to-119-billion-as-growth-rate-jumped-yet-again-in-q4 — T2
[596] The Register. Server virtualization market heats up to win VMware refugees (citing Gartner's October 2025 Market Guide for Server Virtualization Platforms). 2025-11-17. https://www.theregister.com/software/2025/11/17/server-virtualization-market-heats-up-to-win-vmware-refugees/2638653 — T3
[597] CRN. Intel's supply issues helped AMD grab record-high CPU market share, researcher says (Mercury Research, Q4 2025). 2026-02. https://www.crn.com/news/components-peripherals/2026/intel-s-supply-issues-helped-amd-grab-record-high-cpu-market-share-researcher — T3
[598] Omdia. Data Center Server Market Analysis 2H22 (Arm server share). https://omdia.tech.informa.com/om025410/data-center-server-market-analysis--2h22 — T3
[599] 安全内参 (relaying ZDI). Pwn2Own Berlin 2025 targets and award table. 2025-03. https://www.secrss.com/articles/76231 — T3

---

## 600–649 · Errata

[600] LWN.net. KVM: nested MBEC support (patch-series coverage; "Intel MBEC is a hardware feature, introduced in the Kabylake generation"). 2025-12. https://lwn.net/Articles/1051782/ — T2
[601] Wikipedia. Second Level Address Translation ("Mode Based Execution Control (MBEC) … first available in Intel Kaby Lake and AMD Zen 2 CPUs"). https://en.wikipedia.org/wiki/Second_Level_Address_Translation — T3
[602] Paolo Bonzini. Linux kernel KVM pull request, 2015 ("Support for PML (page modification logging, a new feature in Broadwell Xeons that speeds up dirty page tracking)"), Turris GitLab mirror of the kernel tree. https://gitlab.nic.cz/turris/linux/-/blob/994518799930fc363d47cb7cf0d1abed1790bf16/arch/arm64/kvm/sys_regs.c — T2
[603] liujunming. Introduction to VT-x Page-Modification Logging ("PML is a new feature on Intel's Broadwell server platform"). 2022-03. http://liujunming.github.io/2022/03/02/Introduction-to-VT-x-Page-Modification-Logging/ — T3
[605] J. Gandhi, M. D. Hill, M. M. Swift. Agile Paging: Exceeding the Best of Nested and Shadow Paging. ISCA 2016. https://research.cs.wisc.edu/multifacet/papers/isca16_agile_paging.pdf — T2
[606] B. Teabe et al. (No)Compromis: paging virtualization is not a fatality. VEE 2021. http://sigplan.github.io/OpenTOC/vee21.html — T2
[607] S. Bitchebe, A. Tchana. Out of Hypervisor (OoH): efficient dirty page tracking in userspace using hardware virtualization features. SC'22 (IEEE/ACM Supercomputing), 2022-11. https://sc22.supercomputing.org/proceedings/tech_paper/tech_paper_pages/pap130.html — T2
[608] S. Bitchebe, A. Tchana. Out of Hypervisor (preprint). arXiv:2202.13483, 2022-02-27. https://arxiv.org/abs/2202.13483 — T2
[609] Wikipedia. List of x86 virtualization instructions (VMFUNC "Added in: Haswell, Silvermont"). https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions — T3
[610] J. Nakajima (Intel). Intel update — Xen Summit 2012 slides ("VM function 0: EPTP switching"). 2012-08-28. https://docs.huihoo.com/xen/summit/2012/aug28/10a-intel-update.pdf — T3 (vendor presentation)
[611] Linux kernel-team mailing-list archive. Quirk for Intel 5520/5500 chipset interrupt-remapping erratum #53 (revision 0x13 detection, set_irq_remapping_broken). 2013-07. https://lists.snapcraft.io/archives/kernel-team/2013-July/029959.html — T2
[612] N. N. Rao (AMD), LKML/Patchew. "KVM: SVM: Enable AVIC by default from Zen 4" (AVIC disabled by default; pre-Zen 4 parts affected by erratum #1235). 2025-06-26. https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/ — T2
[613] K. Adams, O. Agesen (VMware). A Comparison of Software and Hardware Techniques for x86 Virtualization. ASPLOS 2006. https://web.stanford.edu/class/cs240/readings/hwsw.pdf — T2
[614] U. Steinberg, B. Kauer. NOVA: A Microhypervisor-Based Secure Virtualization Architecture. EuroSys 2010. http://eurosys2010.sigops-france.fr/proceedings/docs/p209.pdf — T2
[615] Red Hat. VENOM — QEMU virtual floppy disk controller vulnerability (CVE-2015-3456). 2015-05-13. https://access.redhat.com/articles/1444903 — T2
[616] Intel. INTEL-SA-00233 — Microarchitectural Data Sampling advisory (MFBDS CVE-2018-12130; MSBDS CVE-2018-12126; MLPDS CVE-2018-12127; MDSUM CVE-2019-11091). 2019-05-14. https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00233.html — T1
[617] M. Schwarz et al. ZombieLoad Attack (MFBDS, CVE-2018-12130). 2019. https://zombieloadattack.com/ — T2
[618] 0xaa55 forum. AMD64 分页缓存体系（ASID vs VPID）— the origin of the "Intel processors have no ASID mechanism" wording circulating in Chinese. https://www.0xaa55.com/thread-25636-1-1.html — T3
[619] xem.github.io / minix86. Intel SDM HTML mirror of a 2017 revision (Table 27-7 EPT-violation exit qualification; the source of stale chapter and section numbers in Chinese secondary material). https://xem.github.io/minix86/manual/intel-x86-and-64-manual-vol3/o_fe12b1e2a880e0ce-1127.html — T3 (superseded mirror)
[620] Intel. Intel VT for Directed I/O specification landing page / content-details entry 774206 (page metadata dated 2023-03-22; getContent/774206 still served Rev 4.1 when checked on 2026-09-20). https://www.intel.com/content/www/us/en/content-details/774206/ — T1 (stale metadata)
[621] AnandTech. Intel's Xeon E5-2600 v2: 12-core Ivy Bridge EP for servers (FlexPriority introduced in the Xeon 7400 series in 2008; 2000–7000 cycles per APIC-related exit). 2013-09. https://www.anandtech.com/show/7285/intel-xeon-e5-2600-v2-12-core-ivy-bridge-ep/2 — T3
[622] Manjaro forum. inxi CPU dump for a Core 2 Duo T7700 (Merom, built 2006-09) listing the `flexpriority` and `tpr_shadow` flags. — T3
[623] D. Abramson et al. Intel Virtualization Technology for Directed I/O. Intel Technology Journal 10(3):179–192, 2006-08. — T2
[624] CCF 通讯. 从英特尔新酷睿处理器放弃 SGX 看机密计算技术的发展. https://dl.ccf.org.cn/article/articleDetail.html?id=6475293074475008 — T3
[625] A survey of Intel SGX and its applications / TEE roadmap discussion. arXiv:2311.06991 ("Intel has planned support for SGX till Intel Xeon 7 – Diamond Rapids"). https://arxiv.org/html/2311.06991v5 — T2
[626] Intel. intel/confidential-computing.tee.dcap.pccs — DCAP PCCS reference implementation (attestation infrastructure shared by SGX and TDX). https://github.com/intel/confidential-computing.tee.dcap.pccs — T1
[627] IT之家, relaying Microsoft support documentation and a ComputerBase measurement (memory integrity default-on requirements; roughly 6% average gaming frame-rate drop with HVCI). 2026-09-02. https://www.ithome.com/0/997/293.htm — T3
[628] CSDN. Win11 24H2 关闭 VBS 方法参考 (self-reported 5–10% system overhead with VBS on). 2025-01. https://blog.csdn.net/2401_84215240/article/details/144983501 — T3
[629] Ted聊科技 / Windows Report, relaying Tom's Hardware測 (Windows 11 25H2 VBS memory-integrity gaming impact quoted as 5–25%). 2026-04-12 / 2024-10-03. https://adersaytech.com/windowsos-tutorial/windows-11-25h2-vbs-memory-integrity-gaming-fix.html — T3
[630] Benchmarking confidential GPU inference on NVIDIA H100. arXiv:2607.19353, 2026-05-20. https://arxiv.org/abs/2607.19353 — T2
[631] Alibaba Cloud AVD. AVD-2026-64172 — AVIC erratum #1235 workaround extended to Hygon Family 18h. https://avd.aliyun.com/detail?id=AVD-2026-64172 — T3
[632] Martins3. KVM TLB flush analysis (VPID handling in `arch/x86/kvm/vmx/vmx.c`; SVM ASID flush path). https://github.com/Martins3/Martins3.github.io/blob/master/docs/kvm/mmu/tlb-flush-draft.md — T3
[633] Microsoft Learn. Configure Credential Guard — default enablement (Credential Guard is enabled by default starting in Windows 11 22H2 and Windows Server 2025 on domain-joined non-DC systems that meet the requirements; default enablement turns VBS on, is applied without UEFI lock, and does not overwrite an explicit prior disable). https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/configure — T2
[634] Microsoft Learn. Memory integrity enablement (OEM guidance: memory integrity is on by default on clean installs of Windows 11 on compatible hardware; previously default only on clean installs of Windows 10 in S mode; works better on Intel Kaby Lake and later with mode-based execute control and AMD Zen 2 and later with guest-mode execute trap). https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-hvci-enablement — T2
[635] Microsoft Learn. Microsoft recommended driver block rules (the vulnerable-driver blocklist is enabled by default for all devices since the Windows 11 2022 Update, is additionally enforced whenever memory integrity, Smart App Control or S mode is active, and is refreshed quarterly plus through monthly servicing). https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/design/microsoft-recommended-driver-block-rules — T2
[636] Microsoft Learn. Install Hyper-V in Windows and Windows Server, and Windows 11 Hyper-V system requirements (Hyper-V is an optional feature on Pro, Enterprise and Education only, not Home; requires a 64-bit processor with SLAT and VM Monitor Mode Extensions). https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/install-hyper-v ; https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/reference/hyper-v-requirements — T2
[637] Microsoft Learn. Run Hyper-V in a virtual machine with nested virtualization (Windows Server documentation: host must be Windows Server 2016 or later or Windows 10 or later, VM configuration version 8.0 or higher, Intel VT-x with EPT; `Set-VMProcessor -ExposeVirtualizationExtensions $true` with the VM off; dynamic memory and runtime memory resize do not take effect; virtualization applications other than Hyper-V are not supported inside a Hyper-V VM). https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/enable-nested-virtualization — T2
[638] Microsoft Learn. About Hyper-V hypervisor scheduler type selection (classic default on Windows Server 2016, core scheduler default from Windows Server 2019, root scheduler default and only supported configuration on client from Windows 10 version 1803). https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/about-hyper-v-scheduler-type-selection — T2
[639] Microsoft Learn. Install Windows Sandbox (Windows 11, or Windows 10 version 1903 / build 18305 or later, Pro, Enterprise or Education; not supported on Home SKUs; AMD64; 4 GB RAM minimum, 8 GB recommended; virtualization enabled in firmware). https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install — T2
[640] Microsoft Learn. Manual installation steps for older versions of WSL (WSL 2 requires Windows 10 version 1903 build 18362.1049 or later on x64 and Windows 10 version 2004 build 19041 or later on ARM64; builds below 18362 do not support WSL 2; the Virtual Machine Platform optional component must be enabled). https://learn.microsoft.com/en-us/windows/wsl/install-manual — T2
[641] Docker Inc. Install Docker Desktop on Windows — system requirements (Windows 10 64-bit 22H2 build 19045 or Windows 11 64-bit 23H2 build 22631 or higher, Enterprise/Pro/Education; WSL 2.1.5 or later for the WSL 2 backend; enhanced container isolation requires WSL 2.6 or later; Hyper-V backend only with an all-users installation; Docker VMM in beta; SLAT and 8 GB RAM). https://docs.docker.com/desktop/setup/install/windows-install/ — T2
[642] Broadcom (VMware) TechDocs. Host VBS Mode on Workstation, and Limitations of Host VBS Mode — VMware Workstation Pro 17 (host VBS mode is enabled automatically on a capable Windows 10 or later host with Hyper-V enabled; VMs in that mode are slower and cannot expose Intel VT-x to their guests; WHP is not supported on Windows Server editions). https://techdocs.broadcom.com/us/en/vmware-cis/desktop-hypervisors/workstation-pro/17-0/using-vmware-workstation-pro/running-workstation-on-a-hyper-v-enabled-host/host-vbs-mode-on-workstation.html ; https://techdocs.broadcom.com/us/en/vmware-cis/desktop-hypervisors/workstation-pro/17-0/using-vmware-workstation-pro/running-workstation-on-a-hyper-v-enabled-host/limitations-of-host-vbs-mode.html — T2
[643] Oracle. Using Hyper-V with Oracle VM VirtualBox — Oracle VM VirtualBox Administrator's Guide 6.0 (VirtualBox uses the Native Execution Manager on top of the Windows hypervisor when a Hyper-V component is active, with reduced performance). https://docs.oracle.com/en/virtualization/virtualbox/6.0/admin/hyperv-support.html — T2
[644] QEMU project. Windows Hypervisor Platform accelerator (WHPX) documentation, and the originating patch series "Implements the Windows Hypervisor Platform accelerator" posted by Microsoft in January 2018. https://www.qemu.org/docs/master/system/whpx.html ; https://lists.gnu.org/archive/html/qemu-devel/2018-01/msg02738.html — T2
[645] Microsoft Learn (previous-versions / Xamarin archive). Hardware acceleration for emulator performance (Hyper-V and HAXM) — "On Windows 10 October 2018 Update (RS5) and higher, Windows Hypervisor Platform (WHPX) is available for automatic use when Hyper-V is enabled". https://learn.microsoft.com/en-us/previous-versions/xamarin/android/get-started/installation/android-emulator/hardware-acceleration — T2
[646] Microsoft Lifecycle. Windows 10 reaching end of support (2025-10-14; 22H2 is the final version; paid Extended Security Updates available), with the supported-versions index for Windows client. https://learn.microsoft.com/en-us/lifecycle/announcements/windows-10-end-of-support ; https://learn.microsoft.com/en-us/windows/release-health/supported-versions-windows-client — T2
[647] Intel. intel/haxm GitHub repository README — HAXM retirement ("Today both Microsoft Hyper-V and macOS HVF have added support for Intel Virtual Machine Extensions. We have therefore decided to retire the HAXM project. HAXM v7.8.0 is our last release."). https://github.com/intel/haxm — T1 (vendor repository)
[648] cloudnative.love / CSDN answers, relaying the VMware Workstation–WHPX coexistence recipe ("从 VMware Workstation 15.5 版本起，引入了对 Windows Hypervisor Platform (WHPX) 的支持"; upgrade to Windows 10 20H1 or later and Workstation/Player 15.5.5 or later). VMware's own release note for 15.5.5 was not located. https://cloudnative.love/about/Workflow/Windows/HyperV/ ; https://ask.csdn.net/questions/9110812 — T3 (relayed)
[649] Microsoft Learn (Windows drivers). Memory Integrity and Virtualization-Based Security — driver compatibility requirements for HVCI. https://learn.microsoft.com/en-us/windows-hardware/drivers/bringup/device-guard-and-credential-guard — T2
