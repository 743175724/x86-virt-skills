[1] AMD《Secure Virtual Machine Architecture Reference Manual》Pub. 33047 Rev 3.02[R/OL]. 2005-12. http://www.0x04.net/doc/amd/33047.pdf
[2] AMD64 APM Vol. 2 (Pub. 24593) Rev 3.11(修订史:首增第 15 章 "Secure Virtual Machine";NCSA 镜像)[R/OL]. 2005-12. http://bluewaters.ncsa.illinois.edu/liferay-content/document-library/amd_2_24593.pdf
[3] AMD Technical Information Portal — 24593 Rev 3.43[EB/OL]. 2025-07-02. https://docs.amd.com/v/u/en-US/24593_3.43
[4] Wikipedia — "X86 virtualization"(AM2 首发 2006-05-23、Pacifica 命名沿革、RVI 代际)[EB/OL]. https://en.wikipedia.org/wiki/X86_virtualization
[5] CNET — "'Rev F' ends single-core Opteron era for AMD"(Rev F Opteron 携 AMD-V 进入服务器市场)[EB/OL]. 2006. https://www.cnet.com/tech/tech-industry/rev-f-ends-single-core-opteron-era-for-amd/
[6] fuzzinglabs — "Introduction To KVM & Hardware Virtualization"(VMCB 布局公开 vs VMCS 不透明)[EB/OL]. https://fuzzinglabs.com/introduction-to-kvm-hardware-virtualization/
[7] VMware 官方博客 — "Performance Evaluation of AMD RVI Hardware Assist"(MMU 密集基准最高 +42%、微基准 +500%;Barcelona 引入 RVI)[EB/OL]. 2009-03. https://blogs.vmware.com/performance/2009/03/performance-evaluation-of-amd-rvi-hardware-assist.html
[8] Satoshi Tanda《Hypervisor-101 in Rust》— "Nested paging structure entries"("AMD: Exactly the same as traditional paging structure entries")[EB/OL]. https://tandasat.github.io/Hypervisor-101-in-Rust/memory-virtualization/nested-paging-structure-entries.html
[9] AMD《I/O Virtualization Technology (IOMMU) Architectural Specification》48882(早期公开版 PID 34434 Rev 1.20;I/O 页表兼容 AMD64 长模式格式)[R/OL]. 2007. https://users.cs.northwestern.edu/~pdinda/icsclass/doc/AMD_ARCH_MANUALS/IOMMU_Specification.pdf
[10] AMD White Paper《AMD Memory Encryption》(Kaplan/Powell/Woller;SEV 威胁模型、ASID 打标、不防 DoS)[R/OL]. 2016 初版 / 2021-10 修订. https://docs.amd.com/api/khub/documents/ZcsCCmeL80dbtuf_VlGpvw/content
[11] patchew.org — "[PATCH v10] Add AMD SEV-SNP Hypervisor Support"("the RMP is checked by both the CPU and IOMMU table-walker")[EB/OL]. 2023-10. https://patchew.org/linux/20231016132819.1002933-1-michael.roth@amd.com/
[12] AMD SEV developer page — EPYC 代际能力表(7001=15 keys/AES-128-XEX;7002=509 keys;9004=1006 keys/AES-256-XTS)[EB/OL]. 现行(2026-09 抓取). https://www.amd.com/en/developer/sev.html
[13] Google Project Zero — "An EPYC escape: Case-study of a KVM breakout"(#VMEXIT 仅恢复 RIP/RSP/RAX;host save area 格式故意不公开)[EB/OL]. 2021-06-29. https://projectzero.google/2021/06/an-epyc-escape-case-study-of-kvm.html
[14] Ben-Yehuda et al. — "The Turtles Project: Design and Implementation of Nested Virtualization", OSDI 2010(嵌套 VMX 代码量约为 SVM 两倍)[C/OL]. 2010. https://www.cs.princeton.edu/courses/archive/fall10/cos597B/papers/nestedvirt-osdi10.pdf
[15] LWN — Amit Shah, "Ten years of KVM"(2006-10-19 首发、2006-12 合入、2007-02 随 2.6.20 发布)[EB/OL]. 2016. https://lwn.net/Articles/705160/
[16] LWN — "Xen and the new processors"(经 AMD 工程师审阅;VT-x guest 不能跑实模式、SVM ASID 标记 TLB)[EB/OL]. 2006-05-02. https://lwn.net/Articles/182080/
[17] strix.ai — CVE-2021-29657 条目(KVM nested_svm_vmrun VMCB12 double-fetch TOCTOU,修复于 5.11.12)[EB/OL]. https://www.strix.ai/cve/CVE-2021-29657
[18] Adams & Agesen — "A Comparison of Software and Hardware Techniques for x86 Virtualization", ASPLOS 2006(第一代硬件虚拟化常慢于软件二进制翻译)[C/OL]. 2006. https://read.seas.harvard.edu/cs161/2019/lectures/papers/
[19] CRN — "AMD Outlines Road Map, Dives Deeper Into Low Power"(2004-11 可考最早 Pacifica/Presidio 公开提及)[EB/OL]. 2004-11-12. https://www.crn.com/news/components-peripherals/52601471/amd-outlines-road-map-dives-deeper-into-low-power
[20] CNET — "AMD tries to round up Pacifica support"(2005-03-30 首次公开披露 Pacifica)[EB/OL]. 2005-03-30. https://www.cnet.com/tech/tech-industry/amd-tries-to-round-up-pacifica-support/
[21] LKML 存档 — Avi Kivity, "[PATCH 0/6] KVM: Add AMD SVM support"(主体工作 Yaniv Kamay)[EB/OL]. 2006-11-28. http://lkml.iu.edu/hypermail/linux/kernel/0611.3/0850.html
[22] AMD APM 24593 修订历史(§15.29 AVIC 自 Rev 3.23 加入,2013-05);并参 dim04 E16(Intel APICv @ Haswell 2013、AVIC 硬件 @ EPYC Zen 2017)[EB/OL]. 2013-05 / 2025-06-26. https://docs.amd.com/v/u/en-US/24593_3.43 ; https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/
[23] Red Hat Bugzilla CVE-2026-64172 + LKML/Patchew "[EARLY RFC] KVM: SVM: Enable AVIC by default from Zen 4"(erratum #1235 致上游长期默认关闭;2025-06 提议 Zen 4+ 默认启用;dim04 E5)[EB/OL]. 2025-06-26. https://patchew.org/linux/20250626145122.2228258-1-naveen@kernel.org/
[24] Wilke et al. — undeSErVed trust(arXiv:2106.15387;"SEV 2016 发布、2017 随第一代 EPYC 实现;SEV-ES introduced 2017 / implemented 2019")[EB/OL]. 2021. https://arxiv.org/pdf/2106.15387.pdf
[25] AMD —《AMD SEV-SNP: Strengthening VM Isolation with Integrity Protection and More》白皮书[R/OL]. 2020-01. https://www.amd.com/content/dam/amd/en/documents/epyc-business-docs/white-papers/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more.pdf
[26] Anjuna 博客(引 Google 2020-07 公告:Google Cloud 首家以 AMD SEV 推出机密 VM)[EB/OL]. 2020-07. https://www.anjuna.io/blog/anjuna-announces-support-for-google-cloud-confidential-computing-powered-by-amd-sev
[27] Phoronix 转载存档(emka.web.id;"SEV-SNP introduced in March 2021 with AMD EPYC 7003;merged for Linux 5.19")[EB/OL]. 2022-05. https://www.emka.web.id/
[28] Microsoft Tech Community — "Azure confidential VMs (DCasv5/ECasv5) using AMD SEV-SNP are now generally available"(3rd Gen EPYC Milan)[EB/OL]. 2022-07-19. https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/azure-confidential-vms-dcasv5ecasv5-using-amd-sev-snp-processors-are-now-general/2993530
[29] Ubuntu 官方文档 — "Launch and attest AMD SEV-SNP instances on AWS"(M6a/C6a/R6a,AmdSevSnp=enabled)[EB/OL]. 2026-08 更新. https://ubuntu.com/aws/docs/aws-how-to/instances/launch-and-attest-amd-sev-snp-instances/
[30] SiliconANGLE — "Google Cloud unveils new convergence-focused security features"(SEV-SNP N2D GA、C3D 预览)[EB/OL]. 2024-08-20. https://siliconangle.com/2024/08/20/google-cloud-unveils-new-convergence-focused-security-features/
[31] Phoronix — "AMD Launches EPYC 9005 'Turin' Server Processors"(2024-10-10 发布;Secure AVIC、CiphertextHiding 内核支持当时在途)[EB/OL]. 2024-10-10. https://www.phoronix.com/review/amd-epyc-9005
[32] VideoCardz/TechPowerUp — "AMD Confirms Zen 6 Launches … Starting With EPYC Venice"(Advancing AI 2026,TSMC N2)[EB/OL]. 2026-07-10. https://videocardz.com/newz/amd-confirms-zen-6-launches-in-less-than-two-weeks-starting-with-epyc-venice
[33] AMD APM Vol. 2(Stanford 课程镜像官方 PDF;EFER.SVME bit 12 描述:"When this bit is zero, the SVM instructions cause #UD exceptions")[EB/OL]. https://www.scs.stanford.edu/~zyedidia/docs/x86/amd-manual.pdf
[34] Misono et al. — "Confidential VMs Explained: An Empirical Analysis of AMD SEV-SNP and Intel TDX", Proc. ACM Meas. Anal. Comput. Syst. 8(3)(VMEXIT 延迟 +240% vs +472%;启动 +102~231% vs +394%;ASP SEV 固件 ~29 KLoC;4th Gen EPYC vs 5th Gen Xeon)[J/OL]. 2024-12. https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf
[35] blog.winny.tech CPUID 表 + Wikipedia CPUID 条目(Fn8000_0001_ECX[2]=svm)[EB/OL]. 2024-07-15. https://blog.winny.tech/posts/cpuid/ ; https://en.wikipedia.org/wiki/CPUID
[36] gingk1212 技术博客 — "AMD-V/SVM を有効化する"(引 APM 15.4 伪代码与 VM_CR MSR)[EB/OL]. 2025-06-11. https://gingk1212.github.io/posts/45c588fea2ee6a5c30400e29e0b695e9/
[37] AMD 33047 Rev 3.02 Table E-1(VM_CR)+ FreeBSD bhyve svm.c("SVM: disabled by BIOS" 检测)[EB/OL]. 2005-12 / 2014. http://www.0x04.net/doc/amd/33047.pdf ; https://web.mit.edu/freebsd/head/sys/amd64/vmm/amd/svm.c
[38] AMD64 APM Vol.2 §15.27 "Secure Startup with SKINIT"(TrenchBoot 镜像, Rev 3.29)[EB/OL]. 2017-12. https://trenchboot.org/references/AMD64-Architecture-Programmers-Manual_Volume-2_Ch15.27_rev3.29.pdf
[39] OneNoughtOne — "Virtual Machines"(VT-x/AMD-V 启用模型对照)[EB/OL]. https://www.onenoughtone.com/learn/virtual-machines/4
[40] patchew — "[v1] Nested SVM fixes, cleanups, and hardening"(Yosry Ahmed, 引 APM "VMRUN 前 GIF=0" 原文)[EB/OL]. 2026-02-24. https://patchew.org/linux/20260224223405.3270433-1-yosry@kernel.org/
[41] GitHub — JiaweiHawk/yakvm(教学 hypervisor 进出序列实证)[EB/OL]. 2024-03-16. https://github.com/JiaweiHawk/yakvm
[42] arceos-org — app-guestmode 文档(AMD SVM 技术细节, CLGI/STGI 临界区)[EB/OL]. https://github.com/arceos-org/app-guestmode
[43] AMD64 APM Vol.2 §15.33.2 vGIF(amd.com 40332.pdf 收录章节文本)[EB/OL]. https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/40332.pdf
[44] Wikipedia — "List of x86 virtualization instructions"(AMD-V 指令编码表)[EB/OL]. 2024-07-21(页面版本). https://en.wikipedia.org/wiki/List_of_x86_virtualization_instructions
[45] AMD64 APM Vol.2(vlsiworlds 镜像, Appendix C Table C-1 拦截退出码)[EB/OL]. 2026(镜像站点文件日期). https://vlsiworlds.com/wp-content/uploads/2026/01/APM_Volume2.pdf
[46] back.engineering — "Voyager - A Hyper-V Hacking Framework"(引 APM Vol.2 §15.5.2 VMSAVE/VMLOAD)[EB/OL]. 2021-04-20. https://blog.back.engineering/20/04/2021/
[47] AMD APM Volume 3(vlsiworlds 镜像, CPUID Fn8000_000A 字段)+ FreeBSD bhyve svm.c 位解码注释[EB/OL]. APM Vol.3 现行 / 2014. https://vlsiworlds.com/wp-content/uploads/2026/01/APM_Volume3.pdf ; https://web.mit.edu/freebsd/head/sys/amd64/vmm/amd/svm.c
[48] AMD APM Volume 3(vlsiworlds 镜像, Fn8000_000A EBX=NASID)[EB/OL]. https://vlsiworlds.com/wp-content/uploads/2026/01/APM_Volume3.pdf
[49] Linux 内核 arch/x86/include/asm/svm.h,codebrowser.dev[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/include/asm/svm.h.html
[50] unknowncheats 论坛 Rust hypervisor 代码(VMCB 布局断言/TLB_CONTROL Table 15-9)[EB/OL]. 2025-09-03. https://www.unknowncheats.me/forum/anti-cheat-bypass/716131-detect-processes-hypervisor.html
[51] FreeBSD sys/amd64/vmm/amd/vmcb.h,MIT 镜像[EB/OL]. http://web.mit.edu/freebsd/head/sys/amd64/vmm/amd/vmcb.h
[52] arXiv"CROSSLINE: Breaking 'Security-by-Crash' based Memory Isolation in AMD SEV"[EB/OL]. 2020. https://arxiv.org/pdf/2008.00146v1.pdf
[53] Google Security Research GHSA-h65x-r3mq-jr2v(附 kvm-unit-test VMCB 结构 PoC)[EB/OL]. 2024-12-09. https://github.com/google/security-research/security/advisories/GHSA-h65x-r3mq-jr2v
[54] LKML 补丁"Modify 64 bit intercept field to two 32 bit vectors"(Babu Moger, AMD)[EB/OL]. 2020-09-11. https://lkml.org/lkml/2020/9/11/1101
[55] aftermathlabs"AMD-V Hypervisor Development"(save_state_64_t,Table B-2 注释)[EB/OL]. 2022-08-04. https://aftermathlabs.net/blog/04/08/2022/
[56] patchew"KVM: x86: nSVM: Improve virtualization of VMCB12 G_PAT"(Jim Mattson,引 APM 15.25.2)[EB/OL]. 2025-11-07. https://patchew.org/linux/20251107201151.3303170-1-jmattson@google.com/
[57] Stanford CS240 课程笔记"Comparison of Software and Hardware Techniques"[EB/OL]. 2013. https://www.scs.stanford.edu/13wi-cs240/notes/vm-techniques.txt
[58] Linux v6.6.1 arch/x86/kvm/svm/svm.c(段属性位编解码段;子条目,同来源 8)[EB/OL]. 2023 (v6.6.1). https://sbexr.rabexc.org/latest/sources/64/0aab837d70bc74.html
[59] CSDN 转录"An Introduction to Hardware-Assisted Virtual Machine (HVM) Rootkits"(VMCB Table 2)[EB/OL]. 2014(原文 2006 前后). https://blog.csdn.net/sgzwiz/article/details/20742309
[60] kernullist blog"About Hypervisor Cheats, Part 2: EPT/NPT …"(NPF bit32/33)[EB/OL]. 2026-06-29. https://kernullist.github.io/kernullist-blog/posts/hypervisor-cheats-part-2-ept-npt-split-views-and-second-stage-fault-evidence/
[61] NoirVisor src/svm_core/readme.md,GitHub(VMCB State Caching 状态组)[EB/OL]. https://github.com/Zero-Tang/NoirVisor/blob/master/src/svm_core/readme.md
[62] AMD CPUID Specification,Northwestern 镜像[R/OL]. 2007-07-26. https://users.cs.northwestern.edu/~pdinda/icsclass/doc/AMD_ARCH_MANUALS/CPUID_Specification.pdf
[63] LKML 6.1.76-rc1 review(回滚 TLB_CONTROL 自造一致性检查,上游 commit a484755ab252)[EB/OL]. 2024-01-29. https://lore.kernel.org/all/20240129165959.935363057@linuxfoundation.org/T/
[64] Linux v6.6.1 arch/x86/kvm/svm/nested.c,sbexr 镜像[EB/OL]. 2023 (v6.6.1). https://sbexr.rabexc.org/latest/sources/0d/cbfe63e5cf7c4a.html
[65] LKML"svm: clean up V_TPR, V_IRQ, V_INTR_PRIO, and V_INTR_MASKING"[EB/OL]. 2016-03. https://lkml.rescloud.iu.edu/hypermail/linux/kernel/1603.0/04400.html
[66] back.engineering"AMD-V Hypervisor Development - A Brief Explanation"[EB/OL]. 2022-08-04. https://back.engineering/blog/04/08/2022/
[67] Linux arch/x86/include/asm/svm.h + LKML 讨论(TLB_CONTROL 架构编码 0/1/3/7)[EB/OL]. 内核现行 / 2025-06-23. https://codebrowser.dev/linux/linux/arch/x86/include/asm/svm.h.html ; https://lkml.rescloud.iu.edu/hypermail/linux/kernel/2506.2/11304.html
[68] Xen 补丁"x86/svm: Use flush-by-asid when available"(Andrew Cooper, Citrix)[EB/OL]. 2020-05-05. https://patchew.org/Xen/20200505182539.12247-1-andrew.cooper3@citrix.com/
[69] patchwork"KVM: SVM: Document the ASID logic in svm_flush_tlb"[EB/OL]. 2020-03-20. https://patchwork.kernel.org/patch/11450421/
[70] sandpile.org x86 CPUID(Fn8000_000A EDX 特性位)[EB/OL]. https://www.sandpile.org/x86/cpuid.htm
[71] LKML"[PATCH 4/7] KVM: SVM: hyper-v: Nested enlightenments in VMCB"(clean-bit 枚举)[EB/OL]. 2021-04-07. https://lkml.iu.edu/hypermail/linux/kernel/2104.0/06781.html
[72] LKML"Enhance and clean up the vmcb tracking comment in pre_svm_run()"(Sean Christopherson)[EB/OL]. 2021-04-06. https://lkml.iu.edu/hypermail/linux/kernel/2104.0/05324.html
[73] Oracle VirtualBox include/VBox/hwacc_svm.h[EB/OL]. rev 8155(检索时点). https://www.virtualbox.org/browser/vbox/trunk/include/VBox/hwacc_svm.h
[74] illumos issue #12899(bhyve dtrace 退出码表)[EB/OL]. 2020-06-26. https://www.illumos.org/issues/12899
[75] AMD《SEV-ES Guest-Hypervisor Communication Block Standardization》Pub #56421 Rev 2.04 §3/§4(Automatic Exits 表)[R/OL]. 2025-01 (Rev 2.04). https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/specifications/56421.pdf
[76] Linux arch/x86/include/uapi/asm/svm.h,codebrowser(SVM_EXIT_VMGEXIT 0x403)[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/include/uapi/asm/svm.h.html
[77] Linux 5.10.248 changelog(EXITCODE 64 位修复,上游 commit f402ecd7a8b6)[EB/OL]. 2025-11-13. https://www.opennet.ru/kernel/5.10.248.html
[78] Xen changelog(VMCB 控制区偏移/cleanbit 与 IOIO 位域)[EB/OL]. 2025-12-12. https://lists.xenproject.org/archives/html/xen-changelog/2025-12/msg00135.html
[79] LWN"Nested SVM fixes, cleanups, and hardening"[EB/OL]. 2026-03-03. https://lwn.net/Articles/1061049/
[80] LKML"[PATCH v4 18/26] KVM: nSVM: Add missing consistency check for EFER, CR0, CR4, and CS"[EB/OL]. 2026-01-14. https://lkml.rescloud.iu.edu/hypermail/linux/kernel/2601.1/10431.html
[81] linux-mm 树 arch/x86/kvm/svm/svm.c diff(dump_vmcb,v6.8-rc4 时期)[EB/OL]. 2024. https://git.kerneltesting.org/akpm/mm/diff/arch/x86/kvm/svm/svm.c?h=v6.8-rc4&id=0339eb95403fb4664219be344a9399a3fdf1fae1
[82] GitHub xoreaxeaxeax/schrodingers-toctou,audit-linux-v7.0-kvm-host.md[EB/OL]. 2026-04-12. https://github.com/xoreaxeaxeax/schrodingers-toctou/blob/main/observer-effect/audits/audit-linux-v7.0-kvm-host.md
[83] AMD64 Architecture Programmer's Manual Vol.2 §15.25 Nested Paging(镜像 PDF)+ gingk1212 博客引文[R/OL]. APM 24593 现行;博客 2025-08-30. https://www.cs.wm.edu/~smherwig/readings/manuals/amd/sdm/amd64_arch_programmers_manual-vol2-system_programming.pdf
[84] Oracle VirtualBox User Manual §10.6 / VirtualBox 7.2 文档[R/OL]. 2026(在线文档现行版). https://www.virtualbox.org/manual/UserManual.html
[85] AMD-V Nested Paging White Paper(NPT-WP-1 1-final-TM,IIT Delhi 镜像)[R/OL]. 2008-07. https://www.cse.iitd.ac.in/~sbansal/csl862-virt/2010/readings/NPT-WP-1%201-final-TM.pdf
[86] CrossLine: Breaking "Security-by-Crash" based Memory Isolation in AMD SEV(ACSAC'21,arXiv)[C/OL]. 2022-03-31. https://arxiv.org/html/2008.00146v2
[87] gingk1212 博客(APM §15.25.3)+ FreeBSD bhyve svm.c[EB/OL]. 2025 / 2014 快照. https://gingk1212.github.io/posts/db5bf8ac192d71a3dc1ab7e33ec0749f/ ; https://web.mit.edu/freebsd/head/sys/amd64/vmm/amd/svm.c
[88] Linux Kernel Documentation virtual/kvm/mmu.txt(mjmwired 镜像)[EB/OL]. https://mjmwired.net/kernel/Documentation/kvm/mmu.txt
[89] gingk1212 博客(APM Vol 2 §15.25.1/15.25.2/15.25.4 解读)[EB/OL]. 2025-08-30. https://gingk1212.github.io/posts/db5bf8ac192d71a3dc1ab7e33ec0749f/
[90] onenoughtone 学习模块 §3 EPT/NPT Page Table Structure[EB/OL]. 2026-03-19. https://www.onenoughtone.com/learning-path/operating-systems/learning/hardware-virtualization-support/3
[91] Software Optimization Guide for AMD Family 15h Processors(47414)[EB/OL]. 2014. https://www.amd.com/content/dam/amd/en/documents/archived-tech-docs/software-optimization-guides/47414_15h_sw_opt_guide.pdf
[92] KVM nSVM TLB flush 优化补丁系列(Yosry Ahmed,patchew)[EB/OL]. 2026. https://patchew.org/linux/20260616004155.1435766-1-yosry@kernel.org/20260616004155.1435766-19-yosry@kernel.org/
[93] Hypervisor 101 in Rust,Nested page fault 章[EB/OL]. https://tandasat.github.io/Hypervisor-101-in-Rust/memory-virtualization/nested-page-fault.html
[94] Mitosis: Transparently Self-Replicating Page-Tables(ASPLOS'20,arXiv)[C/OL]. 2020. https://arxiv.org/html/1910.05398v2
[95] UCat: heterogeneous memory management for unikernels(Frontiers of Computer Science)[J/OL]. 2023-02-15. https://journal.hep.com.cn/fcs/EN/10.1007/s11704-022-1201-y
[96] De Gelas/AnandTech 分析《Intel's EPT and AMD's NPT》(2008 转载)[EB/OL]. 2008. https://blog.csdn.net/hotsolaris/article/details/3603109
[97] apoxy.dev 博客《Where gVisor cold-boot time goes》[EB/OL]. 2026-06-06. https://apoxy.dev/blog/gvisor-cold-start-where-the-time-goes
[98] Bae/Lange/Dinda 等,《Enhancing Virtualized Application Performance Through Dynamic Adaptive Paging Mode Selection》,ICAC 2011[C/OL]. 2011-06. https://users.cs.northwestern.edu/~pdinda/Papers/icac11.pdf
[99] Bhargava 等,《Accelerating Two-Dimensional Page Walks for Virtualized Systems》,ASPLOS XIII 2008[C/OL]. 2008-03. https://pages.cs.wisc.edu/~remzi/Classes/838/Spring2013/Papers/p26-bhargava.pdf
[100] LKML《Move "flush guest's TLB" logic to separate kvm_x86_ops hook》(Sean Christopherson)[EB/OL]. 2020-03-17. https://lkml.org/lkml/2020/3/17/37
[101] LKML《KVM: SVM: make svm_flush_tlb_gva do a full asid flush if NPT enabled》(Paolo Bonzini)[EB/OL]. 2026. https://lkml.iu.edu/hypermail/linux/kernel/2607.3/02061.html
[102] boche.net 博客引述 VMware《Performance of Rapid Virtualization Indexing (RVI)》[EB/OL]. 2009-03-08. http://www.boche.net/blog/index.php/2009/03/08/rapid-virtualization-indexing-rvi/
[103] Wang 等,《Selective Hardware/Software Memory Virtualization》[EB/OL]. https://www.cse.iitb.ac.in/~puru/courses/spring2024-25/downloads/hw-sw-mem.pdf
[104] Ahn/Jin/Huh,《Revisiting Hardware-Assisted Page Walks for Virtualized Systems》,ISCA 2012[C/OL]. 2012-06. https://jeongseob.github.io/assets/papers/ahn_isca12.pdf
[105] Gandhi/Basu/Hill/Swift,《Agile Paging: Exceeding the Best of Nested and Shadow Paging》,ISCA 2016[C/OL]. 2016. https://research.cs.wisc.edu/multifacet/papers/isca16_agile_paging.pdf
[106] 4sysops《Hyper-V performance tuning - Part 1》[EB/OL]. https://4sysops.com/archives/hyper-v-performance-tuning-part-1-virtual-processors/page/186/
[107] VirtualBox User Manual §10.6(CVE-2018-3646 提示)[R/OL]. https://www.virtualbox.org/manual/ch10.html
[108] Linux 内核 Documentation/admin-guide/kernel-parameters.txt(Debian sources 镜像)[EB/OL]. 2026(内核 7.0.9). https://sources.debian.org/src/linux/7.0.9-1/Documentation/admin-guide/kernel-parameters.txt
[109] AdvancedHosting VM 性能调优综述[EB/OL]. https://advancedhosting.com/how-to-maximize-virtual-machine-performance/
[110] Linux v3.0 arch/x86/kvm/svm.c(SVM_FEATURE_* 位定义,CPUID 0x8000000A 探测)[EB/OL]. https://git.nju.edu.cn/nju/linux/-/blob/v3.0.29/arch/x86/kvm/svm.c
[111] Wei Huang (AMD), "Introduction of AMD Advanced Virtual Interrupt Controller", Xen Summit 2012[EB/OL]. 2012-08. https://docs.huihoo.com/xen/summit/2012/aug27/5b-introduction-of-amd-advanced-virtual-interrupt-controller.pdf
[112] LKML 2016 AVIC VMEXIT handler 补丁(avic_incomplete_ipi/avic_unaccelerated_access interception)[EB/OL]. 2016-04-07. https://lkml.iu.edu/hypermail/linux/kernel/1604.0/04368.html
[113] LPC 2023 "Secure AVIC" slides(Neeraj Upadhyay 等, AMD;MSR C001_011B AVIC Doorbell、ALLOWED_IRR、#VC 处理)[EB/OL]. 2023-11-13. https://lpc.events/event/17/contributions/1524/attachments/1372/2976/12%20Secure-AVIC_LPC2023_20231113.pdf
[114] Oracle Linux Blog "How to enable AMD AVIC and speed up your VMs"(IOMMU AVIC/GA Logging 实测)[EB/OL]. 2024-03. https://blogs.oracle.com/linux/amd-avic
[115] LWN "Add support for AMD IOMMU GAPPI"(48882 §2.2.5.4;amd_iommu=gappi)[EB/OL]. 2026-07-13. https://lwn.net/Articles/1082666/
[116] Patchew "[v4] Add support for AMD IOMMU GAPPI"(IRTE Destination/IsRun/GATag 非缓存字段)[EB/OL]. 2026-08-21. https://patchew.org/linux/20260821055611.27138-1-sarunkod@amd.com/
[117] Linux 内核 arch/x86/kvm/trace.h(kvm_avic_incomplete_ipi / kvm_avic_ga_log / kvm_avic_doorbell 等 tracepoint 定义)[EB/OL]. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/trace.h
[118] cnblogs 硬件虚拟化技术综述(AVIC vs Intel APICv 对应关系、落地代际)[EB/OL]. 2024-11-09. https://www.cnblogs.com/suv789/p/18536529
[119] Phoronix "AMD Secure AVIC 支持合入 Linux 6.18"[EB/OL]. 2025-09-03. https://www.phoronix.com/news/AMD-Secure-AVIC-Linux-6.18
[120] Patchew Hyper-V Secure AVIC 补丁系列[EB/OL]. 2025-08-04. https://patchew.org/linux/20250804180525.32658-1-ltykernel@gmail.com/
[121] Red Hat Bugzilla CVE-2026-64172(erratum #1235:陈旧 IsRunning 位致 IPI 丢失)[EB/OL]. 2026-07-19. https://bugzilla.redhat.com/show_bug.cgi?id=2502578
[122] LWN Articles/1025126(posted IRQ 路径 62 补丁大系列,2025-06)[EB/OL]. 2025-06. https://lwn.net/Articles/1025126/
[123] Framework 社区:Ryzen 7 7840U 固件关闭 AVIC 位实测(cpuid -l 0x8000000a)[EB/OL]. 2026-04-28. https://community.frame.work/t/avic-appears-to-be-disabled-on-framework-laptop-13-amd-ryzen-7-7840u/82218
[124] Linux 内核 arch/x86/kvm/svm/svm.c(init_vmcb 中 vGIF 拦截清除与 V_GIF_ENABLE_MASK)[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/kvm/svm/svm.c.html
[125] Linux 内核源码 arch/x86/kvm/svm/svm.c(nrips/vgif 默认 true,pause_filter_count/thresh module_param,torvalds/linux@master)[EB/OL]. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/svm/svm.c
[126] LKML 2605.1/01300(嵌套虚拟化下 L2 不使用 L0 PLE,Sean Christopherson)[EB/OL]. 2026-05. https://lkml.iu.edu/hypermail/linux/kernel/2605.1/01300.html
[127] LKML "[RFC PATCH 0/9] x86: Trenchboot Secure Launch DRTM for AMD SKINIT (Linux)"[EB/OL]. 2024-09-13. https://lkml.iu.edu/2412.1/06885.html
[128] grub-devel "[RFC PATCH v2 0/7] TrenchBoot Secure Launch DRTM for AMD SKINIT (GRUB)"[EB/OL]. 2025-04-30. https://lists.gnu.org/archive/html/grub-devel/2025-04/msg00268.html
[129] patchew.org — "[v1] docs/x86: Update AMD IOMMU specification location"(48882 现行链接)[R/OL]. 2025-12-09. https://patchew.org/linux/20251209100148.25284-1-richard.lyu@suse.com/
[130] OSDev Wiki — "AMD-Vi IOMMU"(DTE/PTE 布局、命令、MMIO 寄存器,标注 48882-PUB Rev 3.11)[R/OL]. 标注规范版 2026-04(Rev 3.11). https://wiki.osdev.org/AMD-Vi_IOMMU
[131] Lenovo Press LP1467 — An Introduction to IOMMU Infrastructure in the Linux Kernel[EB/OL]. https://lenovopress.lenovo.com/lp1467.pdf
[132] kernel-internals.org — "IOMMU Architecture"(AMD struct dev_table_entry、protection_domain)[EB/OL]. https://kernel-internals.org/iommu/iommu-arch/
[133] DeepWiki — torvalds/linux "IOMMU and DMA Mapping"(AMD-Vi backend:IVRS 解析、原子 128 位 DTE 更新)[EB/OL]. https://deepwiki.com/torvalds/linux/11.3-iommu-and-dma-mapping-(incl.-iommufd)
[134] AMD IOMMU 规范 §3.2(DTE 字段、Mode 编码、I/O 页表、Table 7/8、共享 CPU 页表;chipdb 镜像)[R/OL]. 2007(Rev 1.20). https://datasheets.chipdb.org/AMD/Other/34434.pdf
[135] QEMU 补丁 — "x86_iommu/amd: Add interrupt remap support"(IntCtl、IRTE、*Pass 位)[EB/OL]. 2018-09. https://lists.gnu.org/archive/html/qemu-devel/2018-09/msg02715.html
[136] Justia 专利 US20110022818(AMD:GCR3 表按 PASID 索引、GV/GLX 两级转换)[EB/OL]. 2011-01(公开). https://patents.justia.com/patent/20110022818
[137] lists.infradead.org — "[PATCH v8 13/15] iommu/amd: Use the generic iommu page table"(v1/v2 页表、PASID 符号扩展、FORCE_COHERENCE)[EB/OL]. 2025-11. https://lists.infradead.org/pipermail/linux-riscv/2025-November/080484.html
[138] OpenVMM rustdoc — acpi_spec::ivrs(IVHD type 10h/11h/40h、设备条目类型、规范章节号)[R/OL]. https://openvmm.dev/rustdoc/linux/acpi_spec/ivrs/index.html
[139] termbasehub — "AMD-Vi"(失效命令语义、三日志)[EB/OL]. https://termbasehub.com/amd-vi/
[140] patchew.org — "[v4] iommu/amd: vIOMMU"(EVENT_TYPE_* 编码、EVTLOG/PPRLOG 常量、IO_PAGE_FAULT vflags)[EB/OL]. 2026-07-27. https://patchew.org/linux/20260727132913.22475-1-suravee.suthikulpanit@amd.com/
[141] docs.kernel.org — "x86 IOMMU Support"(IVRS 定义、AMD 故障日志样例)[EB/OL]. https://docs.kernel.org/arch/x86/iommu.html
[142] CSDN — "IOMMU 如何处理 PCIe ATS/ATC/PRI Request"(AMD IO_PAGE_FAULT 语义、故障不可恢复)[EB/OL]. https://blog.csdn.net/u011037593/article/details/162999221
[143] arXiv 2511.19258(CSD 学位论文,转述 48882:IOTLB/PPR/中断虚拟化)[D/OL]. 2025-11. https://arxiv.org/html/2511.19258v2
[144] schrodingers-toctou 审计文档(AMD event/PPR/GA log 环形缓冲与威胁模型)[EB/OL]. https://github.com/xoreaxeaxeax/schrodingers-toctou/blob/main/observer-effect/audits/audit-linux-v7.0-iommu-dma.md
[145] termbasehub — "AMD-V"(Evt/PPR/GA 三 MSI 向量)[EB/OL]. https://termbasehub.com/amd-v/
[146] LWN — "iommu/amd: Introduce AMD Hardware-accelerated Virtualized IOMMU (vIOMMU) Support"[EB/OL]. 2026(LWN 文章号 1080160). https://lwn.net/Articles/1080160/
[147] LWN — "Introduce debugfs support in IOMMU"(AMD debugfs 转储 MMIO/能力/cmdbuf/DTE/IRTE)[EB/OL]. 2025(LWN 文章号 997201). https://lwn.net/Articles/997201/
[148] patchew.org(QEMU)— "acpi_build: Refactor and cleanup AMD IVRS build"(IVHD 10h/11h 结构、标志位)[EB/OL]. 2026-05-11. https://patchew.org/QEMU/20260511123937.32743-1-sarunkod@amd.com/
[149] huihoo doxygen — amd_iommu_init.c(IVMD_FLAG_UNITY_MAP=0x01、IVMD_FLAG_EXCL_RANGE=0x08)[EB/OL]. 对应 Linux 3.7(2012). https://docs.huihoo.com/doxygen/linux/kernel/3.7/amd__iommu__init_8c.html
[150] lkml(tip)— "x86: amd_iommu: Convert amd_iommu_detect() to use iommu_init hook"(acpi_table_parse("IVRS") 探测)[EB/OL]. 2009-11. https://lkml.iu.edu/hypermail/linux/kernel/0911.1/01066.html
[151] lists.infradead.org — "[PATCH v2 20/24] iommu: Merge strictness and domain type configs"(DMA_LAZY 安全折中)[EB/OL]. 2021-07. https://lists.infradead.org/pipermail/linux-arm-kernel/2021-July/674252.html
[152] LKML — "Preserve default DTE fields when updating Host Page Table Root"(set_dte_entry、IR/IW/V)[EB/OL]. 2025-01-06. https://lkml.org/lkml/2025/1/6/1169
[153] Red Hat Docs — "Important changes to external kernel parameters"(amd_iommu= 取值)[EB/OL]. 2022(RHEL 8.8). https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/8.8_release_notes/kernel_parameters_changes
[154] Martins3 笔记 — iommu/irq(amd_iommu_intr=legacy|vapic)[EB/OL]. https://github.com/Martins3/Martins3.github.io/blob/master/docs/kernel/irq/iommu.md
[155] patchwork.ozlabs(QEMU)— "amd_iommu: Document '-device amd-iommu' common options"(dma-remap/intremap/xtsup)[EB/OL]. 2025-10. https://patchwork.ozlabs.org/project/qemu-devel/patch/0888c071ff8370f118ce22c0fe873b13e11d319a.1759691708.git.mst@redhat.com/
[156] Samsung Semiconductor Tech Blog — "Realizing ATS and PRI"(ATS/PRI/PASID/ATPT 机制)[EB/OL]. https://semiconductor.samsung.com/news-events/tech-blog/realizing-ats-and-pri-for-efficient-data-access-in-nvme-ssd-ep1/
[157] LWN — "iommu/amd: Introduce Nested Translation support"(nest-parent、GCR3、gDTE)[EB/OL]. 2025(LWN 文章号 1046241). https://lwn.net/Articles/1046241/
[158] LWN — "iommu/amd: Introduce hardware info reporting and nested translation support"(EFR 上报、IOMMU_HWPT_DATA_AMD_V2)[EB/OL]. 2024(LWN 文章号 958128). https://lwn.net/Articles/958128/
[159] Proxmox 教程 — GPU Passthrough: IOMMU, VFIO, and the AMD Reset Bug[EB/OL]. 2026-09 检索. https://proxmoxguide.com/posts/proxmox-gpu-passthrough/
[160] Proxmox Wiki — PCI(e) Passthrough[EB/OL]. 2026-09 检索. https://pve.proxmox.com/wiki/PCI(e)_Passthrough
[161] Level1Techs — The state of AMD RX 7000 Series VFIO Passthrough[EB/OL]. 2024-04. https://forum.level1techs.com/t/the-state-of-amd-rx-7000-series-vfio-passthrough-april-2024/210242
[162] Harden-Windows-Security Wiki — Device Guard and Virtualization-Based Security in Windows[EB/OL]. 2026-09 检索. https://github.com/HotCakeX/Harden-Windows-Security/wiki/Device-Guard-and-Virtualization-Based-Security-in-Windows
[163] HYPERPC — FACEIT IOMMU/VBS 要求(Microsoft VBS 硬件要求表 + AMD BIOS 路径)[EB/OL]. 2026-09 检索. https://hyperpc.ae/company/blog/faceit-iommu-vbs-requirements
[164] Invisible Things Lab — Software Attacks on Intel VT-d[EB/OL]. 2011. https://invisiblethingslab.com/resources/2011/Software%20Attacks%20on%20Intel%20VT-d.pdf
[165] Bobcares — Proxmox "IOMMU not present"(allow_unsafe_interrupts 旁路)[EB/OL]. 2026-09 检索. https://bobcares.com/blog/proxmox-cannot-prepare-pci-pass-through-iommu-not-present/
[166] LWN — KVM: x86: Introduce SVM AVIC support[EB/OL]. 2016. https://lwn.net/Articles/680619/
[167] LPC 2012 — Next-generation Interrupt Virtualization for KVM[EB/OL]. 2012-09. https://blog.linuxplumbersconf.org/2012/wp-content/uploads/2012/09/2012-lpc-virt-interrupt-virt-kvm-roedel.pdf
[168] Red Hat Enterprise Linux 7.5 Release Notes — amd_iommu_intr[EB/OL]. 2018. https://docs.redhat.com/de/documentation/red_hat_enterprise_linux/7/epub/7.5_release_notes/
[169] LKML — Split "struct vcpu_data"(per-CPU posted-interrupt wakeup)[EB/OL]. 2025-06. https://lkml.org/lkml/2025/6/11/1976
[170] Notes about AMD IOMMU IRTCache 机制(转引 AVIC Interrupt Remapping Improvements 补丁)[EB/OL]. 2024-11-10. http://liujunming.github.io/2024/11/10/Notes-about-AMD-IOMMU-IRTCache/
[171] Debian Security Tracker — CVE-2021-3653[EB/OL]. 2021. https://security-tracker.debian.org/tracker/CVE-2021-3653
[172] Red Hat — Chapter 16. SR-IOV(PCI-SIG SR-IOV 定义)[EB/OL]. 2026-09 检索. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/5/html/virtualization/chap-para-virtualized_windows_drivers_guide-sr_iov
[173] kernel.org — PCI Express I/O Virtualization Howto[EB/OL]. 2026-09 检索. https://docs.kernel.org/PCI/pci-iov-howto.html
[174] Red Hat — A Deep-dive into IOMMU Groups(RHEL 7 虚拟化部署与管理指南)[R/OL]. 2026-09 检索. https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/virtualization_deployment_and_administration_guide/sect-iommu-deep-dive
[175] LWN — IOMMU Groups + VFIO(初始补丁系列,Alex Williamson)[EB/OL]. 2012. https://lwn.net/Articles/497009/
[176] K8s Recipes — IOMMU on K8s: GPU Passthrough and SR-IOV[EB/OL]. 2026-09 检索. https://kubernetes.recipes/recipes/configuration/iommu-gpu-passthrough-sriov-kubernetes/
[177] minzkn — SR-IOV(ARI、VF 分组、ACS 注意)[EB/OL]. 2026-09 检索. https://www.minzkn.com/linuxkernel/pages/pci-sriov.html
[178] Level1Techs — Security implications of ACS override(引 Alex Williamson 说明)[EB/OL]. 2026-09 检索. https://forum.level1techs.com/t/security-implications-of-acs-override/226854
[179] Proxmox Forum — AMD GPU Passthrough recently stopped working(vfio-pci ids 示例)[EB/OL]. 2026-09 检索. https://forum.proxmox.com/threads/amd-gpu-passthrough-recently-stopped-working.165977/
[180] iommu list — SR-IOV PF reset and QEMU VFs VFIO passthrough(Don Dutile)[EB/OL]. 2026-09 检索. https://iommu.linux-foundation.narkive.com/OQCwSsF3/sr-iov-pf-reset-and-qemu-vfs-vfio-passthrough
[181] Red Hat RHEL 6 — Preparing an AMD system for PCI device assignment[EB/OL]. 2026-09 检索. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/virtualization_administration_guide/chap-guest_virtual_machine_device_configuration
[182] Proxmox VE 9 GPU Passthrough 教程[EB/OL]. 2026-09 检索. https://ecintelligence.ma/en/blog/gpu-passthrough-proxmox-ve-9-iommu-vfio-nvidia/
[183] homeserverlab — Proxmox GPU Passthrough RTX 4070(EPYC 7003/H12SSL-i iommu=pt 实测)[EB/OL]. 2026-09 检索. https://homeserverlab.de/blog/proxmox-gpu-passthrough-rtx-4070-iommu-und-vfio-richtig-einr/
[184] AMD — HPC Tuning Guide for AMD EPYC 9004 Series(doc 58002 v1.7)[R/OL]. 2026-09 检索. https://docs.amd.com/api/khub/documents/NgOfoW49HKdzztTeLBbekA/content
[185] AMD — EPYC 9004 Best Practices for Cloud Infrastructure and Datacenter Design(doc 58004 v1.3)[R/OL]. 2026-09 检索. https://docs.amd.com/api/khub/documents/lMgojqchIqt9ewPEdr8Mzw/content
[186] kernel.org — VFIO "Virtual Function I/O"[EB/OL]. 2026-09 检索. https://docs.kernel.org/driver-api/vfio.html
[187] CSDN — VFIO 概述(config/BAR/中断透传实现)[EB/OL]. 2023. https://blog.csdn.net/yiyeguzhou100/article/details/129341184
[188] QEMU docs — IOMMUFD backend usage with VFIO[EB/OL]. 2026-09 检索. https://www.qemu.org/docs/master/devel/vfio-iommufd.html
[189] CSDN — vendor-reset 安装配置指南[R/OL]. 2026-09 检索. https://blog.csdn.net/gitblog_00502/article/details/156332480
[190] Void Linux — AMD reset bug back again(RDNA3, kernel 6.15/6.16; bugzilla 220471)[EB/OL]. 2026-09 检索. https://github.com/void-linux/void-packages/issues/56829
[191] Level1Techs — X870E GPU Passthrough Fails with "1:1 IOMMU mapping"(IVRS Unity Map)[EB/OL]. 2026-09 检索. https://forum.level1techs.com/t/gigabyte-x870e-agesa-1-2-2-gpu-passthrough-fails-with-firmware-has-requested-this-device-have-a-1-1-iommu-mapping-vfio-pci/242394
[192] Vormox — Diagnosing GPU Passthrough Failures on Proxmox VE 9.x(Unity Map 分析)[EB/OL]. 2026-09 检索. https://vormox.com/blog/diagnosing-gpu-passthrough-failures-on-proxmox-ve-9-x-iommu-groups-vfio-binding-and-reset-quirks
[193] Saneax Blog — Huge Page Configuration Deep-Dive(TLB 条目数对比)[EB/OL]. 2026-09 检索. https://blog.saneax.in/tech/vxlan-openvswitch-vm-networking/
[194] minzkn — Huge Pages(2MB/1GB)& THP(NPT 两级转换)[EB/OL]. 2026-09 检索. https://www.minzkn.com/linuxkernel/pages/hugepages.html
[195] SUSE — Optimizing Linux for AMD EPYC 7002 Series(SBP-AMD-EPYC-2, SLES 15 SP1)[EB/OL]. 2026-09 检索. https://documentation.suse.com/sbp/tuning-performance/html/SBP-AMD-EPYC-2-SLES15SP1/index.html
[196] GitHub — GPU-Passthrough-for-KVM-QEMU PERFORMANCE.md[EB/OL]. 2026-09 检索. https://github.com/urbanyl/GPU-Passthrough-for-KVM-QEMU-on-Linux/blob/main/docs/PERFORMANCE.md
[197] ArchWiki — PCI passthrough via OVMF(静态大页注意事项与 Red Hat 基准)[EB/OL]. 2026-09 检索. https://wiki.archlinux.org/title/PCI_passthrough_via_OVMF
[198] MicrosoftDocs/windows-itpro-docs(GitHub 镜像)— credential-guard.md[EB/OL]. 2026-09 检索. https://github.com/yannanwang1/win-cpub-itpro-docs/blob/master/windows/keep-secure/credential-guard.md
[199] ZDNet — "highly secure Windows 10 device" 硬件要求[EB/OL]. 2026-09 检索. https://www.zdnet.com/article/windows-10-if-you-want-a-highly-secure-device-follow-these-rules-says-microsoft/
[200] Dell KB 000178346 — Credential Guard and Device Guard 硬件要求表[EB/OL]. 2026-09 检索. https://www.dell.com/support/kbdoc/en-us/000178346/
[201] ZDNet — Windows 11 advanced hardware security(HVCI DMA/IOMMU 要求)[EB/OL]. 2026-09 检索. https://www.zdnet.com/article/windows-11-has-advanced-hardware-security-heres-how-to-get-it-in-windows-10-today/
[202] Proxmox Forum — Virtualization based security in Windows guests[EB/OL]. 2026-09 检索. https://forum.proxmox.com/threads/virtualization-based-security-in-windows-guests.146787/
[203] Linux kernel, Documentation/virt/kvm/api.rst §4.110–4.112[EB/OL]. https://github.com/torvalds/linux/blob/master/Documentation/virt/kvm/api.rst
[204] AMD SEV-SNP: A Confidential Computing Primer (arXiv:2608.04039)[EB/OL]. 2026. https://arxiv.org/html/2608.04039v1
[205] Wilke 博士论文(ITS Lübeck)[D/OL]. https://www.its.uni-luebeck.de/fileadmin/files/phd_theses/Dissertation-Wilke.pdf
[206] QEMU Documentation, AMD Secure Encrypted Virtualization (SEV)[EB/OL]. https://www.qemu.org/docs/master/system/i386/amd-memory-encryption.html
[207] rouming.github.io, Confidential Computing with AMD-SEV(cbitpos=51 实测)[EB/OL]. 2025-04-01. https://rouming.github.io/2025/04/01/coco-with-amd-sev.html
[208] Linux kernel, Documentation/arch/x86/amd-memory-encryption.rst(2017 初版补丁)[EB/OL]. 2017-04. http://lists.infradead.org/pipermail/kexec/2017-April/018583.html
[209] Linux kernel, Documentation/virt/kvm/x86/amd-memory-encryption.rst[EB/OL]. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/virt/kvm/x86/amd-memory-encryption.rst
[210] TechPowerUp, AMD to Restore TSME on Consumer Ryzen[EB/OL]. 2026-06. https://www.techpowerup.com/350142/
[211] AMD, Secure Encrypted Virtualization API Version, Pub #55766 Rev 3.24[R/OL]. 2020-04. https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/programmer-references/55766_SEV-KM_API_Specification.pdf
[212] Formal Verification of Secure Encrypted Virtualization (arXiv:2606.01381, 密钥层次梳理)[EB/OL]. 2026. https://arxiv.org/html/2606.01381v1
[213] Shirong Hao, Allow guest to query AMD SEV(-ES) runtime attestation evidence (patchew)[EB/OL]. 2022-01. https://patchew.org/linux/20220110060445.549800-1-shirong@linux.alibaba.com/
[214] SEV-Tool 使用说明(证书链验证步骤)[EB/OL]. https://www.hackerhome.top/index.php/archives/34/
[215] cai-fuqiang.github.io, SEV/CSV 热迁移流程分析[EB/OL]. https://cai-fuqiang.github.io/posts/amd-sev/
[216] Kripashanker 博士论文(IISc, SEV-SNP 威胁模型对比)[D/OL]. https://www.csa.iisc.ac.in/~vg/students/kripashanker_phdthesis.pdf
[217] LKML, crypto: ccp SEV key management command id(psp-sev.h 注明 spec 0.14)[EB/OL]. 2017-10. https://lkml.iu.edu/hypermail/linux/kernel/1710.2/04664.html
[218] lore.kernel.org, SEV-SNP Hypervisor Support v10(sev_issue_cmd 结构)[EB/OL]. 2023-10. https://lore.kernel.org/linux-mm/b1b0decf-dc0b-b1bb-db9d-2a00a8c81b0d@suse.cz/T/
[219] include/uapi/linux/psp-sev.h(平台命令与返回码枚举)[EB/OL]. https://ipads.se.sjtu.edu.cn:1312/opensource/copier-linux-5.15.131/-/blob/7fa40586308633506d02f2c585fe68526f3eec38/include/uapi/linux/psp-sev.h
[220] arch/x86/include/uapi/asm/kvm.h(enum sev_cmd_id)[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/include/uapi/asm/kvm.h.html
[221] Proxmox VE Admin Guide §10.2.7 Memory Encryption[EB/OL]. https://pve.proxmox.com/pve-docs/pve-admin-guide.pdf
[222] libvirt kbase, Launch security with AMD SEV[EB/OL]. https://libvirt.org/kbase/launch_security_sev.html
[223] SUSE, AMD-SEV Guide (SLES 15 SP6)[EB/OL]. https://documentation.suse.com/sles/15-SP6/html/SLES-amd-sev/article-amd-sev.html
[224] libvirt domain XML launchSecurity 格式(cbitpos/dhCert/session)[EB/OL]. https://icode.best/i/281501385136883
[225] Exploiting Unprotected I/O Operations in AMD's SEV(NSF 存档,含 SEVered/Hetzelt&Buhren 细节)[EB/OL]. 2019. https://par.nsf.gov/servlets/purl/10119365
[226] Morbitzer 等, SEVered: Subverting AMD's Virtual Machine Encryption, EuroSec 2018[C/OL]. 2018-05. https://arxiv.org/abs/1805.09604
[227] 4hou, SEVered 攻击细节(提取速率 79.4/41.6 KB/s)[EB/OL]. https://www.4hou.com/posts/pkZV
[228] LWN, Add AMD SEV-SNP Hypervisor Support(RMP/GFN 绑定语义)[EB/OL]. 2023. https://lwn.net/Articles/972039/
[229] Enclavisor (IEEE TC 2021, 回滚与 NPT 攻击)[EB/OL]. 2021. https://ipads.se.sjtu.edu.cn/_media/publications/enclavisor-tc21.pdf
[230] Wilke et al., undeSErVed trust (HTML 版攻击概述, arXiv:2106.15387)[EB/OL]. 2021. https://arxiv.org/html/2106.15387v1
[231] CIPHERLEAKs 官网(CVE-2020-12966)[EB/OL]. 2021. https://cipherleaks.com/
[232] Mengyuan Li et al. (S&P 2022, 页故障受控通道超出 SNP 设计范围)[C/OL]. 2022. https://radu.teodorescu.us/assets/pdf/mengyuan_sp2022.pdf
[233] AMD, AMD-SB-1004: AMD Secure Encrypted Virtualization[EB/OL]. 2021-05-11. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-1004.html
[234] Thomas Lendacky (AMD)《Extending Secure Encrypted Virtualization with SEV-ES》(Linux Foundation Events)[EB/OL]. 2017-12. https://events19.linuxfoundation.org/wp-content/uploads/2017/12/Extending-Secure-Encrypted-Virtualization-with-SEV-ES-Thomas-Lendacky-AMD.pdf
[235] LWN《5.10 Merge window, part 1》[EB/OL]. 2020-10-16. https://lwn.net/Articles/834157/
[236] LKML,Jörg Rödel《[RFC PATCH 00/70 v2] x86: SEV-ES Guest Support》[EB/OL]. 2020-03-19. https://lkml.iu.edu/hypermail/linux/kernel/2003.2/04373.html
[237] LKML《[GIT PULL] KVM changes for Linux 5.11》[EB/OL]. 2020-12-03. https://lkml.iu.edu/hypermail/linux/kernel/2012.2/03208.html
[238] Patchew edk2《[v11] SEV-ES guest support》(OvmfPkg/VmgExitLib)[EB/OL]. 2020-07. https://patchew.org/EDK2/cover.1595366363.git.thomas.lendacky@amd.com/
[239] Luca Wilke 硕士论文(Lübeck)《Injection Attacks on SEV》[D/OL]. https://www.its.uni-luebeck.de/fileadmin/files/theses/MA_LucaWilke_InjectionAttacksOnSEV.pdf
[240] AMD64 APM 24593 Vol.2 §15.35 中文摘录(与 AMD 官方手册对应)[R/OL]. https://icode.best/i/89878437131829
[241] snee.la 硕士论文(SecureTSC 分析)[D/OL]. https://snee.la/pdf/pubs/sneela-master-thesis.pdf
[242] MIT 学位论文《Architecting Trust》[D/OL]. https://dspace.mit.edu/server/api/core/bitstreams/769b0da2-b172-433b-962f-643a60981550/content
[243] LWN 转载 Lendacky《SEV-ES hypervisor support》(v5,34 patches)[EB/OL]. 2020-12. https://lwn.net/Articles/836719/
[244] Li 等《CIPHERLEAKS: Breaking Constant-time Cryptography on AMD SEV via the Ciphertext Side Channel》USENIX Security 2021[C/OL]. 2021-08. https://yinqian.org/papers/sec21b.pdf
[245] arXiv:2404.03526(WeSee,IEEE S&P 2024)[C/OL]. 2024-04. https://arxiv.org/html/2404.03526v1
[246] Linux `arch/x86/coco/sev/vc-shared.c` / `vc-handle.c`(codebrowser)[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/coco/sev/vc-shared.c.html
[247] coconut-svsm 文档(DeepWiki)GHCB 字段偏移表[EB/OL]. https://deepwiki.com/coconut-svsm/svsm/5.3-ghcb-and-guest-host-communication
[248] LKML tools header sync(SVM_VMGEXIT_* 常量)[EB/OL]. https://lkml.iu.edu/2603.0/06956.html
[249] Linux v6.6 `arch/x86/kernel/sev-shared.c`(sbexr 镜像)及 boot/compressed 补丁[EB/OL]. https://sbexr.rabexc.org/latest/sources/fb/5f6563aeb4702d.html
[250] Linux `arch/x86/include/asm/sev-common.h`(codebrowser)[EB/OL]. https://codebrowser.dev/linux/linux/arch/x86/include/asm/sev-common.h.html
[251] Patchew《x86/fred: Fix early boot failures on SEV-ES/SNP guests》(#VC handler 位置与 boot_ghcb 证据)[EB/OL]. 2026-02. https://patchew.org/linux/20260205051030.1225975-1-nikunj@amd.com/
[252] LKML 补丁(cc_platform_has / CC_ATTR_GUEST_STATE_ENCRYPT 取代 sev_es_active)[EB/OL]. 2021-09. https://lists.ozlabs.org/pipermail/linuxppc-dev/2021-September/234738.html
[253] KVM `arch/x86/kvm/svm/sev.c` 补丁(VMGEXIT 初始支持,sev_es_sync_from_ghcb / validate 逻辑)[EB/OL]. 2020-09-14. https://lkml.org/lkml/2020/9/14/1177
[254] Paolo Bonzini《KVM: SEV: only access GHCB fields once》(CVE-2023-4155 修复)[EB/OL]. 2023-08-04. https://patchew.org/linux/20230804173355.51753-1-pbonzini@redhat.com/20230804173355.51753-3-pbonzini@redhat.com/
[255] LKML,Jörg Rödel《[PATCH v2 0/5] x86/sev-es》(CPUID sanity check、禁加密内存 MMIO;攻击描述 arXiv:2010.07094)[EB/OL]. 2020-10-20. https://lkml.org/lkml/2020/10/20/465
[256] General overview of AMD SEV-SNP and Intel TDX 中译(CSDN;低质量二手来源,结论经交叉验证 High 1.1 多源印证)[EB/OL].
[257] [PATCH v12] Add AMD Secure Nested Paging (SEV-SNP) Guest Support(patchew/LKML,Brijesh Singh 等)[EB/OL]. 2022-03. https://patchew.org/linux/20220307213356.2797205-1-brijesh.singh@amd.com/
[258] Linux Kernel Documentation: AMD Memory Encryption §19.2 RMP / §19.2.2 Segmented RMP / §19.3 SVSM[EB/OL]. https://docs.kernel.org/arch/x86/amd-memory-encryption.html
[259] AMD SEV-SNP Development Update(LSS-NA 2021,AMD)[EB/OL]. 2021. https://static.sched.com/hosted_files/lssna2021/9a/AMD%20SEV-SNP%20Development%20Update%20--%20Final.pdf
[260] Lenovo Press LP2349: Configuring Confidential Computing with AMD SEV-SNP and VMware ESXi 9.0[EB/OL]. https://lenovopress.lenovo.com/lp2349
[261] The Hacker News: RMPocalypse(引 AMD 规范 RMP 文本)[R/OL]. 2025-10. https://thehackernews.com/2025/10/rmpocalypse-single-8-byte-write.html
[262] [PATCH] Add helper functions for RMPUPDATE and PSMASH instruction(LKML)[EB/OL]. 2021-04. https://lkml.iu.edu/hypermail/linux/kernel/2104.3/05832.html
[263] [SRU] x86/sev: Check for the presence of an SVSM in the SNP secrets page(Ubuntu kernel-team;0x148/0x150 偏移)[EB/OL]. 2025-06. https://lists.ubuntu.com/archives/kernel-team/2025-June/160484.html
[264] Linux sev.h rmpadjust() 注释[EB/OL].
[265] GHCB Standardization 56421 Rev.2.04(docs.amd.com;PSC 操作码 0x0002/0x0003/0x0004)[R/OL]. 2025-01. https://docs.amd.com/api/khub/documents/oJly8EPzLO1Bt7ncrkCytw/content
[266] MIT DSpace: A Close Look at RMP Entry Caching and Its Security Implications in SEV-SNP(HASP 2025)[C/OL]. 2025. https://dspace.mit.edu/handle/1721.1/164204
[267] AMD-SB-3020: SEV-SNP RMP Initialization Vulnerability[R/OL]. 2025-10-13. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3020.html
[268] Van Bulck 等, BadRAM: Practical Memory Aliasing Attacks on Trusted Execution Environments(IEEE S&P 2025;CVE-2024-21944)[C/OL]. 2025. https://badram.eu/badram.pdf
[269] Edgeless Contrast: AMD SEV-SNP attestation(扩展 policy 位与 PLATFORM_INFO 字段表)[EB/OL]. https://docs.edgeless.systems/contrast/1.10/architecture/snp
[270] 56860 Revision History(docs.amd.com 内容页;0.9→1.55→1.56→1.57)[EB/OL]. 2021-04 至 2025-01. https://docs.amd.com/ (dim09 引用)
[271] Remote attestation of SEV-SNP confidential VMs using e-vTPMs(arXiv:2303.16463)[EB/OL]. 2023. https://arxiv.org/abs/2303.16463
[272] Confidential Guest Services with SVSM on SEV-SNP(KVM Forum 2022,AMD)[EB/OL]. 2022. https://static.sched.com/hosted_files/kvmforum2022/ca/SEV-SNP-Confidential-Guest-Services-with-SVSM.pdf
[273] coconut-svsm/svsm AGENTS.md(引 #58019/#56421/#56860/APM Vol.2)[EB/OL]. https://github.com/coconut-svsm/svsm/blob/main/AGENTS.md
[274] SVSM 规范 PDF(AMD Pub #58019 Rev 1.00)[R/OL]. 2023. https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/specifications/58019.pdf
[275] [PATCH v3 0/4] Enlightened vTPM support for SVSM on SEV-SNP(LKML)[EB/OL]. 2025-03. https://lkml.org/lkml/2025/3/11/464
[276] Phoronix: Linux 6.16 Could See AMD SEV-SNP SVSM vTPM Driver Merged[EB/OL]. 2025. https://www.phoronix.com/news/Linux-SNP-SVSM-vTPM-Driver-Tip
[277] SUSE Blog: COCONUT-SVSM Joins the Confidential Computing Consortium[EB/OL]. 2024-08. https://www.suse.com/c/coconut-svsm-joins-the-confidential-computing-consortium/
[278] FOSDEM 2025: Updates on Coconut SVSM(ephemeral vTPM、持久化状态路线)[EB/OL]. 2025-02-01. https://archive.fosdem.org/2025/schedule/event/fosdem-2025-5412-updates-on-coconut-svsm-secure-services-and-stateful-devices-for-confidential-virtual-machines/
[279] Formal Security Analysis of the AMD SEV-SNP Software Interface(arXiv:2403.10296,S&P'24)[EB/OL]. 2024. https://arxiv.org/abs/2403.10296
[280] AMD SEV-SNP の概要と攻撃調査(docswell;ECDSA P-384 非对称化)[EB/OL]. https://www.docswell.com/s/hayao/Z8N2LY-sevsnp
[281] IETF draft CoRIM profile §3.1.3.4(算法 1h=ecdsa-with-sha384、曲线 2h=secp384r1)[EB/OL]. https://www.ietf.org/archive/id/draft-deeglaze-amd-sev-snp-corim-profile-02.html
[282] pkg.go.dev usbarmory tamago sev 包(MSG_TSC_INFO_REQ/RES、GHCB/SNP 结构注释)[EB/OL]. https://pkg.go.dev/ (dim09 引用)
[283] [PATCH v12] virt: Add SEV-SNP guest driver(patchew)[EB/OL]. 2022-03. https://patchew.org/linux/20220307215344.2799259-1-brijesh.singh@amd.com/
[284] The Definitive SEV Guest API Documentation(docs.kernel.org 6.2)[EB/OL]. https://docs.kernel.org/6.2/virt/coco/sev-guest.html
[285] [PATCH v3] i386/sev: KVM_EXIT_VMGEXIT Extended Guest Request(qemu-devel)[EB/OL]. 2024-03. https://lists.gnu.org/archive/html/qemu-devel/2024-03/msg05009.html
[286] [RFC PATCH v2] i386/sev: KVM_EXIT_SNP_REQ_CERTS support(qemu-devel;certs-filename/certs-timeout)[EB/OL]. 2025-01.
[287] 56860 Rev 1.56 变更记录(docs.amd.com API 内容页;SNP_HV_REPORT_REQ)[EB/OL]. 2024-10. https://docs.amd.com/api/khub/documents/x_tYkgJNtfpvqwPq45NrSQ/content
[288] Confidential AI Docs: Attestation & Verification(报告字段分区表)[EB/OL]. https://confidential.ai/docs/concepts/confidential-computing-primer/05-attestation
[289] souravcrl attested-tls-proxy: ATTESTATION_STATUS.md(报告 1184B)[EB/OL]. https://github.com/souravcrl/attested-tls-proxy (dim09 引用)
[290] VLEK Certificate Definition 58369 Rev 0.10(docs.amd.com;ARK/ASVK、CRL DP)[R/OL]. 2023-10. https://docs.amd.com/api/khub/documents/xQu~JcgP~f6ls6rVySZs3w/content
[291] docs.amd.com 57230 门户页(VCEK Certificate and KDS Interface Specification,Rev 1.0)[R/OL]. 2025-02-19. https://docs.amd.com/v/u/en-US/57230
[292] virtee/snphost README(VLEK 注册机器、hashsticks)[EB/OL]. https://github.com/virtee/snphost
[293] IETF RATS wiki: AMD Key Distribution Service(三个 GET 方法定义)[EB/OL]. https://github.com/ietf/wiki.ietf.org/blob/main/group/rats/referencevalues/amd-key-distribution-service.md
[294] cMCP Verification Library(VCEK fetch URL 格式)[EB/OL]. https://cmcp.agentrust-io.com/spec/verification-library/
[295] セキュリティキャンプ 2026 Lゼミ回答例(zenn.dev;KDS 现生成证书、ReportedTcb 回滚分析)[EB/OL]. 2026. https://zenn.dev/ (dim09 引用)
[296] SPIRE RFC #4469: SEV SNP Node Attestation Plugin(GUEST_POLICY 位表)[EB/OL]. https://github.com/spiffe/spire/issues/4469
[297] Onidel KB: AMD SEV-SNP Attestation and Memory Encryption(snpguest display report 实测输出)[EB/OL]. https://kb.onidel.com/hc/kb/articles/1771943583
[298] Ubuntu Server Docs: Confidential Computing with AMD(QEMU 默认 policy=0x30000)[EB/OL]. https://ubuntu.com/server/docs/how-to/virtualisation/sev-snp/
[299] Edgeless Contrast 1.14: SNP startup / ID block(LD 迭代哈希、启动中止语义)[EB/OL]. https://docs.edgeless.systems/contrast/1.14/architecture/attestation/amd-details
[300] AMDESE/sev-guest README(Deprecated 迁移表)[EB/OL]. https://github.com/AMDESE/sev-guest
[301] AMDESE/sev-tool README(从 KDS 获取 VCEK 与 ASK_ARK)[EB/OL]. https://github.com/AMDESE/sev-tool
[302] virtee/snpguest README(report/certificates/fetch/key/display/verify;Azure hyperv feature)[EB/OL]. https://github.com/virtee/snpguest
[303] AMDESE/AMDSEV Issue #271(sudo snphost ok 输出示例)[EB/OL]. https://github.com/AMDESE/AMDSEV/issues/271
[304] confidentialcontainers.org Design Overview(KBS/AS/RVPS 组件)[EB/OL]. https://confidentialcontainers.org/docs/architecture/design-overview/
[305] Red Hat Blog: Understanding the Confidential Containers Attestation Flow[EB/OL]. https://www.redhat.com/en/blog/understanding-confidential-containers-attestation-flow
[306] confidential-containers/guest-components(TEE_PLATFORM=snp/az-snp-vtpm)[EB/OL]. https://github.com/confidential-containers/guest-components
[307] OneUptime 引 CoCo SNP host guide(内核 ≥6.16.1、SEV FW ≥1.55、attestation report v3+)[EB/OL]. 2026-09-12. https://oneuptime.com/blog/post/2026-09-12-verify-sev-snp-tdx-host-prerequisites/view
[308] AMD Confidential Computing Solution Brief[EB/OL]. https://www.amd.com/content/dam/amd/en/documents/epyc-business-docs/solution-briefs/amd-confidential-computing-solution-brief.pdf
[309] Level1Techs 论坛 CPUID 实测(number of SEV-enabled guests = 0x3ee/1006、VMPL = 4)[EB/OL]. https://level1techs.com/ (dim09 引用)
[310] 4th Gen AMD EPYC Processor Architecture White Paper(SMKE、CXL 跨重启加密)[R/OL]. 2022. https://www.amd.com/content/dam/amd/en/documents/products/epyc/4th-gen-epyc-processor-architecture-white-paper.pdf
[311] 5th Gen AMD EPYC Architecture White Paper(Megware 镜像;SMKE 引入于 EPYC 9004)[R/OL]. 2024-10. https://www.megware.com/fileadmin/user_upload/LandingPage%20AMD/5th-gen-amd-epyc-white-paper.pdf
[312] Zen4 EPYC 架构解析(快科技/芯智讯;AES-256-XTS、1006 keys、CXL 1.1+ Type-3)[EB/OL]. 2022-11.
[313] LWN/kernel patchwork: [RFC,00/21] Secure VFIO, TDISP, SEV TIO(2024-08-23)[EB/OL]. 2024-08-23. https://lwn.net/Articles/987020/
[314] pragma.vision SEV-TIO 就绪度评估(IDE-only Phase 1 可验证)[EB/OL]. 2026-07. https://pragma.vision/observe/amd-sev-tio/
[315] docs.amd.com 56860 门户页(56860_PUB_1.59_SEV_SNP.pdf 列示)[R/OL]. https://docs.amd.com/v/u/en-US/56860_PUB_SEV_SNP
[316] AMDESE/AMDSEV README(实测固件上报 SEV-SNP API:1.58 build:5)[EB/OL]. https://github.com/AMDESE/AMDSEV
[317] Hetzelt & Buhren, *Security Analysis of Encrypted Virtual Machines*, ACM VEE 2017[C/OL]. 2017-04. https://www.just.edu.jo/~zasharif/Web/CS775/OS-PaperPresentations/10-Security%20analysis%20of%20encrypted%20virtual%20machines-vee2017.pdf
[318] Du 等, *Secure Encrypted Virtualization is Unsecure*, arXiv:1712.05090[EB/OL]. 2017-12-14. https://arxiv.org/abs/1712.05090
[319] 中文维基百科"椭圆曲线密码学"参考文献(CVE-2019-9836 无效曲线攻击描述)[EB/OL]. 2019-06. https://zh.wikipedia.org/wiki/%E6%A4%AD%E5%9C%86%E6%9B%B2%E7%BA%BF%E5%AF%86%E7%A0%81%E5%AD%A6
[320] Werner 等, *The SEVerESt Of Them All*, ACM AsiaCCS 2019[C/OL]. 2019-07. https://regmedia.co.uk/2019/07/10/amd.pdf
[321] Buhren, Werling, Seifert, *Insecure Until Proven Updated: Analyzing AMD SEV's Remote Attestation*, ACM CCS 2019[C/OL]. 2019-11. https://arxiv.org/html/1908.11680v2
[322] SEVurity 引文(IEEE S&P 2020, DOI 10.1109/SP40000.2020.00080)[C/OL]. 2020-05. https://arxiv.org/html/2409.15542v1
[323] NVD, CVE-2021-29657[EB/OL]. 2021-03. https://nvd.nist.gov/vuln/detail/CVE-2021-29657
[324] Morbitzer 等, *SEVerity: Code Injection Attacks against Encrypted Virtual Machines*, WOOT 2021[C/OL]. 2021-05. https://arxiv.org/pdf/2105.13824
[325] Li, Zhang, Lin, *CrossLINE: Breaking "Security-by-Crash" based Memory Isolation in AMD SEV*, ACM CCS 2021[C/OL]. 2021-11. https://par.nsf.gov/servlets/purl/10376330
[326] Buhren 等, *One Glitch to Rule Them All: Fault Injection Attacks Against AMD's SEV*, ACM CCS 2021[C/OL]. 2021-11. https://arxiv.org/pdf/2108.04575
[327] OpenCVE, AMD EPYC CVE 列表(CVE-2021-26312 IOMMU TLB 未刷新等)[EB/OL]. 2021. https://app.opencve.io/cve/?vendor=amd&product=epyc_7281&page=2
[328] Google Project Zero & Google Cloud Security, *AMD Secure Processor for Confidential Computing Security Review*[EB/OL]. 2022-05. https://storage.googleapis.com/gweb-uniblog-publish-prod/documents/AMD_GPZ-Technical_Report_FINAL_05_2022.pdf
[329] CISPA, CacheWarp PoC 仓库(CVE-2023-20592)[EB/OL]. 2023-11. https://github.com/cispa/CacheWarp
[330] SentinelOne, CVE-2023-20584(IOMMU DTE 故障绕过 RMP 技术分析)[EB/OL]. 2023. https://www.sentinelone.com/vulnerability-database/cve-2023-20584/
[331] Schlüter 等, *HECKLER: Breaking Confidential VMs with Malicious Interrupts*, USENIX Security 2024[C/OL]. 2024-08. https://ahoi-attacks.github.io/heckler/heckler_usenix24.pdf
[332] Unmitigated Risk, 机密计算时间线(CVE-2024-56161 微码签名问题)[EB/OL]. 2025-02. https://unmitigatedrisk.com/?p=1235
[333] Gast 等, *CounterSEVeillance: Performance-Counter Attacks on AMD SEV-SNP*, NDSS 2025[C/OL]. 2025-02. https://www.ndss-symposium.org/ndss-paper/counterseveillance-performance-counter-attacks-on-amd-sev-snp/
[334] Ubuntu Security, CVE-2025-48514(修复固件版本与副作用)[EB/OL]. 2025-07. https://ubuntu.com/security/CVE-2025-48514
[335] Relocate-Vote 官方网站(披露时间线、PAGE_SWAP_DISABLE、AMD-SB-3021)[EB/OL]. 2025-08-12. https://relocatevote.org/
[336] Battering RAM 官方网站[EB/OL]. 2025-10. https://batteringram.eu/
[337] Zhang 等, *StackWarp: Breaking AMD SEV-SNP Integrity via Deterministic Stack-Pointer Manipulation through the CPU's Stack Engine*, USENIX Security 2026[C/OL]. 2026-01. https://misc0110.net/files/stackwarp_sec26.pdf
[338] The Hacker News, *Researchers Defeat AMD's SEV Virtual Machine Encryption*[EB/OL]. 2018-05. https://thehackernews.com/2018/05/amd-sev-encryption.html
[339] NSF PAR, *Exploiting Unprotected I/O Operations in AMD's SEV* 摘要页[EB/OL]. 2019. https://par.nsf.gov/biblio/10694445
[340] RCSI 期刊参考文献(SEVurity 出版信息)[EB/OL]. 2020. https://journals.rcsi.science/2079-3316/article/xml/386615
[341] CrossLINE 论文全文(yinqian.org)[C/OL]. 2021-11. https://yinqian.org/papers/ccs21.pdf
[342] Strix, CVE-2020-12967(CVSS 7.2)[EB/OL]. 2021. https://www.strix.ai/cve/CVE-2020-12967
[343] Strix, CVE-2021-26311(CVSS 7.2)[EB/OL]. 2021. https://www.strix.ai/cve/CVE-2021-26311
[344] Lenovo LEN-60063(AMD 不为 CVE-2020-12967/2021-26311 发布固件,要求 SEV-SNP)[EB/OL]. 2021. https://support.lenovo.com/us/zh/solutions/ps500407
[345] eetrend, One Glitch 攻击成本与原理报道[EB/OL]. 2021. https://www.eetrend.com/content/2021/100552787.html
[346] AMD 产品安全公告总表(AMD-SB-1004/1013/1023/3005 日期与 CVE 对应)[EB/OL]. 2026 抓取. https://www.amd.com/en/resources/product-security.html
[347] Li 等, *A Systematic Look at Ciphertext Side Channels on AMD SEV-SNP*, IEEE S&P 2022[C/OL]. 2022-05. https://luca-wilke.com/publication/dblp-confsp-li-ww-0-tz-22/
[348] arXiv:2606.17358 参考文献(HyperTheft/SEVerESt 出版信息)[EB/OL]. 2024. https://arxiv.org/pdf/2606.17358
[349] AMD, AMD-SB-3021 公告(Relocate+Vote 与 Chosen Plaintext Oracle 两组密文侧信道研究)[EB/OL]. 2025-08. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3021.html
[350] Shen & Qin, *Insecure Despite Proven Updated: Extracting the Root VCEK Seed on EPYC Milan via a Software-Only Attack*[EB/OL]. https://arxiv.org/html/2605.12990v1
[351] The Register, *AMD SEV OMG: Trusted execution undone by cache meddling*[EB/OL]. 2023-11-14. https://www.theregister.com/2023/11/14/amd_trusted_execution/
[352] CacheWarp 中文技术解读(单步执行框架、INVD 行为分析)[EB/OL]. 2023-11-16. https://jdkhnjggf.github.io/2023/11/16/CacheWarp/
[353] CyberKendra, CacheWarp 案例研究(Bellcore/OpenSSH/sudo)[EB/OL]. 2023-11. https://www.cyberkendra.com/2023/11/cachewarp-new-vulnerability-breaks.html
[354] CacheWarp USENIX Security'24 Artifact Appendix[C/OL]. 2024. https://secartifacts.github.io/usenixsec2024/appendix-files/sec24winterae-final22.pdf
[355] AMD, AMD-SB-3005:AMD INVD Instruction Security Notice[EB/OL]. 2023-11-14. https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3005.html
[356] Supermicro, AMD-SB-3005 备注(1st/2nd Gen EPYC 不修复理由)[EB/OL]. 2023. https://www.supermicro.com/en/support/security_AMD-SB-3005
[357] Ubuntu Security, CVE-2023-20592(微码修复 commit 确认)[EB/OL]. 2023. https://ubuntu.com/security/CVE-2023-20592
[358] ETH Zürich SECTRS Publications + rmpocalypse.github.io(RMPocalypse 发表于 ACM CCS 2025、远程可利用;维度外独立复核)[C/OL]. 2026-09. https://rmpocalypse.github.io
[359] NVD, CVE-2025-0033(CNA 为 AMD,CVSS:3.1 约 6.0 Medium;维度外独立复核)[EB/OL]. 2026-09. https://nvd.nist.gov/vuln/detail/CVE-2025-0033
[360] CISPA, StackWarp PoC 仓库(CVE-2025-29943)[EB/OL]. 2026-01. https://github.com/cispa/StackWarp
[361] The Hacker News, *New StackWarp Hardware Flaw Breaks AMD SEV-SNP Protections on Zen 1–5 CPUs*[EB/OL]. 2026-01. https://thehackernews.com/2026/01/new-stackwarp-hardware-flaw-breaks-amd.html
[362] F5 Labs, Weekly Threat Bulletin 2026-01-21(StackWarp 影响与修复时间线)[EB/OL]. 2026-01-21. https://www.f5.com/labs/articles/weekly-threat-bulletin-january-21st-2026
[363] NVD, CVE-2025-29943(引用 AMD-SB-3027)[EB/OL]. 2026-01. https://nvd.nist.gov/vuln/detail/CVE-2025-29943
[364] citnews, AMD 官方声明(AMD-SB-3027 低危、2025-07 起补丁可用)[EB/OL]. 2026-01. http://www.citnews.com.cn/news/212899
[365] CyberSecureFox, *StackWarp (CVE-2025-29943): New AMD SEV-SNP Vulnerability Threatens Confidential VMs*[R/OL]. 2026-01-23. https://cybersecurefox.com/en/stackwarp-cve-2025-29943-amd-sev-snp-vulnerability/
[366] KubeVirt issue #17118(CVE-2025-48514:SNP 节点拒绝 SEV-ES 客户)[EB/OL]. 2025. https://github.com/kubevirt/kubevirt/issues/17118
[367] OpenStack Nova spec:CVE-2025-48514 固件禁用 SEV-ES 的编排适配[EB/OL]. 2026. https://specs.openstack.org/openstack/nova-specs/specs/2026.2/approved/amd-sev-snp-libvirt-support.html
[368] Debian amd64-microcode tracker(CVE-2025-0033/29934/48514/48517/52536 描述)[EB/OL]. 2025. https://tracker.debian.org/amd64-microcode
[369] 百度百科(英文), AMD SEV-SNP 已知 CVE 汇总(CVE-2025-0029/48514/48517/2024-56161 等)[EB/OL]. https://baike.baidu.com/en/item/AMD%20SEV-SNP/3764356
[370] OrTechy, TEE.fail 攻击机制与结果综述[EB/OL]. 2025-10. https://ortechy.com/is-confidential-computing-safe-from-side-channel-attacks/
[371] RealTyme, TEE.fail 对 SEV-SNP Ciphertext Hiding 的绕过[EB/OL]. 2025. https://www.realtyme.com/blog/on-device-ai-vs-cloud-ai-encrypted-messages
[372] Cybersecurity-help.cz, TEE.fail 披露时间线与 AMD 不修声明[EB/OL]. 2025-10. https://www.cybersecurity-help.cz/blog/5042.html
[373] Patchew, "KVM: x86 pull requests for 7.2"(nSVM VMRUN 仿真副作用修复、AVIC x2APIC MSR 拦截修复)[EB/OL]. 2026-06. https://patchew.org/linux/20260612004755.349925-1-seanjc@google.com/
[374] Aivres 安全公告(CVE-2024-21953 IOMMU 等描述)[EB/OL]. 2025. https://aivres.com/security-bulletins/security-advisory-security-update-regarding-amd-processor-vulnerability/
[375] Heckler 论文参考文献(CipherLeaks/I/O 攻击引文链;SWIOTLB 结构根因)[C/OL]. 2024. https://arxiv.org/pdf/2404.03387v1
[376] 百度百科, AMD SEV-SNP 已知漏洞与缓解(固件版本、SMT 建议;弱来源,结论另由 dim14 CoCo 基线印证)[EB/OL]. https://baike.baidu.com/item/AMD%20SEV-SNP/68342568
[377] CSDN《VT-x/AMD-V 从特权级到 VM-Exit 一条线讲透》附录 I"源码文件与职责速查"[EB/OL]. 检索于 2026. https://blog.csdn.net/qq_35223473/article/details/164945846
[378] Linux 内核源码 arch/x86/kvm/svm/vmenter.S(__svm_vcpu_run:vmload/vmrun/vmsave、RSB/SPEC_CTRL 缓解)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/svm/vmenter.S
[379] LKML: "Enable INVPCID feature on AMD"(Babu Moger,svm_exit_handlers 表结构)[EB/OL]. 2020-06-16. https://lkml.org/lkml/2020/6/16/1575
[380] Linux 内核源码 arch/x86/include/asm/svm.h(struct vmcb、SEV-ES VMSA 注释、SVM_EXIT_* 编码)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/include/asm/svm.h
[381] Linux 内核源码 arch/x86/kvm/svm/sev.c(module_param_named(sev/sev_es/sev_snp/ciphertext_hiding_asids))[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/svm/sev.c
[382] Linux 内核源码 arch/x86/kvm/svm/avic.c(avic/enable_ipiv/force_avic 参数)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/svm/avic.c
[383] Proxmox Forum "Hardware Virtualization inside KVM"(2.6.32 时代 kvm_amd 独有 npt/nested 参数)[EB/OL]. https://forum.proxmox.com/threads/hardware-virtualization-inside-kvm.6364/
[384] Linux 内核 Documentation/virt/kvm/api.rst(KVM_CAP_VM_TYPES、KVM_MEMORY_ENCRYPT_OP、KVM_GET/SET_NESTED_STATE;全文无 KVM_CAP_SEV)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/virt/kvm/api.rst
[385] qemu-discuss 邮件列表 "Re: SNP: qemu upstream vs AMD fork on kernel 6.11"(Michael Roth/Paolo Bonzini;QEMU SNP strace、QEMU 9.1 合入、单镜像 OVMF 约束)[EB/OL]. 2024-08. https://mail.gnu.org/archive/html/qemu-discuss/2024-08/msg00013.html
[386] The Linux Kernel documentation "Secure Encrypted Virtualization (SEV)"(KVM_MEMORY_ENCRYPT_OP 与 21 个 KVM_SEV_* 子命令)[EB/OL]. 检索于 2026. https://docs.kernel.org/virt/kvm/x86/amd-memory-encryption.html
[387] LWN "KVM: x86: nSVM: Improve PAT virtualization"(KVM_X86_QUIRK_NESTED_SVM_SHARED_PAT、gPAT 虚拟化、NESTED_STATE SVM 文档化)[EB/OL]. 2026. https://lwn.net/Articles/1064856/
[388] Linux 内核源码 arch/x86/kvm/svm/nested.c(nested_svm_vmrun、nested_vmcb02_recalc_intercepts、nested_svm_merge_msrpm)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/torvalds/linux/master/arch/x86/kvm/svm/nested.c
[389] LWN "Nested Paging Virtualization for KVM v4"(Joerg Roedel,nSVM 嵌套分页起源)[EB/OL]. 2010. https://lwn.net/Articles/404452/
[390] Red Hat RHEL 8 文档 Ch.19 "Creating nested virtual machines"[EB/OL]. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_virtualization/creating-nested-virtual-machines_configuring-and-managing-virtualization
[391] Red Hat RHEL 9 文档 Ch.22 "Creating nested virtual machines"(EPYC-IBPB + feature svm XML 示例)[EB/OL]. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/creating-nested-virtual-machines_configuring-and-managing-virtualization
[392] SUSE SLES 15 SP7 Virtualization Guide §6.3(嵌套虚拟化技术预览声明、-cpu host/+svm、不支持嵌套迁移)[EB/OL]. https://documentation.suse.com/sles/15-SP7/single-html/SLES-virtualization/
[393] Red Hat RHEL 7 Virtualization Deployment and Administration Guide(嵌套限制:不迁移 L1/L2、无 L3、L1 不可用 APICv/IOMMU、svm+npt flag)[EB/OL]. https://docs.redhat.com/pt-br/documentation/red_hat_enterprise_linux/7/html-single/virtualization_deployment_and_administration_guide/index
[394] Proxmox pve-devel "QEMU AMD SEV enable"("Nested virtualization and kvm is not supported under SEV-ES")[EB/OL]. 检索于 2026. https://lore.proxmox.com/pve-devel/da5338f6-4335-4418-9692-1fa83c20ccb2@proxmox.com/T/
[395] QEMU 官方文档 "QEMU / KVM CPU model configuration"(EPYC/Rome/Milan/Genoa 模型、host passthrough、ibpb/stibp/virt-ssbd/amd-ssbd/pdpe1gb)[EB/OL]. 检索于 2026. https://www.qemu.org/docs/master/system/qemu-cpu-models.html
[396] GitHub AMDESE/AMDSEV Issue #269(SNP 完整 qemu 命令行实录:memfd share=on、policy=0x30000、cbitpos=51)[EB/OL]. 检索于 2026. https://github.com/AMDESE/AMDSEV/issues/269
[397] SEV-SNP 实战博客(EPYC 9654 启动日志,cbitpos=51、QMP query-sev 读回)[EB/OL]. 检索于 2026. https://blog.lyc8503.net/en/post/amd-sev-snp/
[398] libvirt 源码 docs/formatdomain.rst "Launch Security"(type='sev' 自 4.4.0、type='sev-snp' 自 10.5.0、policy 位表、cbitpos 来源)[EB/OL]. 检索于 2026. https://raw.githubusercontent.com/libvirt/libvirt/master/docs/formatdomain.rst
[399] Red Hat RHEL 9 文档 Ch.19 "Securing virtual machines"(SEV-SNP virt-install/virt-xml 流程)[EB/OL]. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/securing-virtual-machines-in-rhel_configuring-and-managing-virtualization
[400] Ubuntu Launchpad Bug #2122286(AppArmor /dev/sev rw、OVMF amd-sev-es feature、memoryBacking locked)[EB/OL]. 检索于 2026. https://bugs.launchpad.net/bugs/2122286
[401] KVM pull request(Linux 6.11)"Base support for running SEV-SNP guests … KVM_X86_SNP_VM … GHCB 2.0"[EB/OL]. 2024(Linux 6.11 合并窗口). https://gitlab.ilabt.imec.be/jthijsma/linux/-/blob/62085877ae6592be830c2267e35dc469cb706308/Documentation/virt/coco/sev-guest.rst
[402] xen-project/xen SUPPORT.md(master;HVM/PVH 强制 VMX/SVM、PVH dom0 需 IOMMU、AMD IOMMU Supported、PCI 直通仅限 IOMMU、shadow paging not security supported、Nested HVM Experimental)[EB/OL]. 检索于 2026(Xen 4.23-unstable). https://github.com/xen-project/xen/blob/master/SUPPORT.md
[403] xl.cfg(5) man page(hap=BOOLEAN:NPT/RVI 默认启用)[EB/OL]. 检索于 2026. https://xenbits.xen.org/docs/unstable/man/xl.cfg.5.html
[404] xen-devel "[RFC PATCH 00/16] Confidential computing and AMD SEV support"(仅 plain SEV、仅 HVM、xl coco=1、ASID 分配器重构)[EB/OL]. 2025-05. https://old-list-archives.xen.org/archives/html/xen-devel/2025-05/msg00880.html
[405] Xen Project Wiki "Nested Virtualization in Xen"("Nested HVM on AMD CPUs is considered 'experimental'")[EB/OL]. 检索于 2026. https://wiki.xenproject.org/wiki/Nested_Virtualization_in_Xen
[406] Elastic Security Labs "WinVisor – A hypervisor-based emulator for Windows x64"(hvix64.exe=Intel、hvax64.exe=AMD、WHP API 抽象差异)[EB/OL]. 2025-01. https://www.elastic.co/security-labs/blog/winvisor-hypervisor-based-emulator
[407] EndpointWeekly "Virtualisation-based security will not start…"(hvix64/hvax64/hvaa64 命名、启动链表)[EB/OL]. 2026-08. https://endpointweekly.com/blog/vbs-core-isolation-prerequisites-troubleshooting.html
[408] VMware 官方文档 "Performance Best Practices for VMware vSphere 8.0"(AMD RVI/NPT 消除影子页表、TLB miss 开销与大页缓解)[R/OL]. https://www.vmware.com/docs/vsphere-esxi-vcenter-server-80-performance-best-practices
[409] Lenovo Press LP1545: Using AMD SEV-ES in VMware vSphere on ThinkSystem Servers("In vSphere 7.0 Update 1 and later, we can enable AMD SEV-ES";SEV-ES 客人不支持 vMotion/挂起/开机快照)[EB/OL]. 2024-01-05 更新;2026 检索(本章补充查证). https://lenovopress.lenovo.com/lp1545-using-amd-secure-encrypted-virtualization-encrypted-state-sev-es
[410] Broadcom KB 442645, "IOMMU Configuration Restrictions on AMD EPYC (Zen 3 to Zen 5) with SEV-SNP Enabled"(SEV-SNP 激活时 ESXi 无法将主机 IOMMU 置 passthrough;内存开销 <1%;768GB Zen 5 主机初始化 +7s)[EB/OL]. 更新于 2026-06. https://knowledge.broadcom.com/external/article/442645/iommu-configuration-restrictions-on-amd.html
[411] Broadcom TechDocs(VCF)"Running Guest Hypervisors with Virtualized HV"(vHV 要求 VT-x+EPT 或 AMD-V+RVI;Workstation 复选框)[EB/OL]. 检索于 2026. https://community.broadcom.com/vmware-cloud-foundation/viewdocument/running-nested-vms
[412] HistoryTools "VMware Player vs VirtualBox"(VT-x/AMD-V 与 nested paging;64 位/SMP 客人必需)[EB/OL]. 检索于 2026. https://www.historytools.org/vs/vmware-vs-virtualbox
[413] thetechylife "Does VirtualBox support PCI passthrough?"(PCI 直通需 AMD-Vi IOMMU)[EB/OL]. 检索于 2026. https://thetechylife.com/does-virtualbox-support-pci-passthrough/
[414] LinuxTechi "Enable Nested Virtualization (VT-x/AMD-v) In VirtualBox"(6.1 起,AMD 支持晚于 Intel)[EB/OL]. 2024-11. https://www.linuxtechi.com/enable-nested-virtualization-virtualbox-linux/
[415] ghostbyt3 "Kernel Exploitation Primer 0x3 - VBS & HVCI"(VTL1 经 hypercall 配置 SLAT/EPTE)[EB/OL]. 2025-01. https://ghostbyt3.github.io/blog/Kernel_Exploitation_Primer_0x3
[416] xen 源码镜像 xen/arch/x86/hvm/svm/svm.c(约 2870 行)与 vmcb.c[EB/OL]. 检索于 2026. https://github.com/mirage/xen/blob/master/xen/arch/x86/hvm/svm/svm.c
[417] Debian lists / XCP-ng forum 实机 Xen 启动日志(SVM 高级特性逐项启用、HAP 4k/2M/1G、AMD-Vi 初始化)[EB/OL]. 2023-06. https://lists.debian.org/debian-user/2023/06/msg01091.html
[418] Patchew/Xen-devel "Add Xen PVH dom0 support for GPU"(AMD, Ray Huang;PVH dom0 需硬件 IOMMU 替代 swiotlb)[EB/OL]. 2023-03. https://patchew.org/Xen/20230312120157.452859-1-ray.huang@amd.com/
[419] Patchew/Xen-devel "[v7] IOMMU subsystem redesign and PV-IOMMU interface"(Teddy Astie,Vates;AMD-Vi 移植"基本可用但有怪癖")[EB/OL]. 2025. https://patchew.org/Xen/cover.1763569135.git.teddy.astie@vates.tech/
[420] LWN "iommu/amd: Introduce AMD Hardware-accelerated Virtualized IOMMU (vIOMMU) Support"(24 补丁、IOMMUFD、8–12KB MMIO 直服务;引用 AMD IOMMU Spec 48882)[EB/OL]. 2026-07. https://lwn.net/Articles/1085590/
[421] xl.cfg(5) man page(nestedhvm=BOOLEAN 默认关闭)[EB/OL]. 检索于 2026. https://manpages.debian.org/unstable/xen-utils-common/xl.cfg.5.en.html
[422] xen-devel 补丁(nested SVM 能力门槛:HAP && LBRV && NRIPS && FlushByASID && DecodeAssists && VLOADSAVE)[EB/OL]. 2026-07. https://lists.xenproject.org/archives/html/xen-devel/2026-07/msg01165.html
[423] XCP-ng 官方文档 "Compute and GPU — Nested Virtualization"(实验性且不安全、不予官方支持)[EB/OL]. 检索于 2026. https://docs.xcp-ng.org/compute/
[424] FOSDEM 2025 "Enabling AMD SEV technology in Xen Hypervisor"[EB/OL]. 2025-02. https://archive.fosdem.org/2025/schedule/event/fosdem-2025-5451-enabling-amd-sev-technology-in-xen-hypervisor/
[425] XCP-ng Blog "Xen Summit 2025"(Running Linux with AMD SEV on Xen 早期演示)[EB/OL]. 2025-10-14. https://xcp-ng.org/blog/2025/10/14/xen-summit-2025-how-we-shaped-whats-next/
[426] xen-devel 讨论(Jürgen Groß / Teddy Astie;SEV/SEV-ES/SEV-SNP/TDX 类型区分接口讨论)[EB/OL]. 2025-05. https://lists.xenproject.org/archives/html/xen-devel/2025-05/msg00916.html
[427] Packt "Hyper-V Architecture and Components"(winload.exe 按 CPU 加载 Hvix64/Hvax64 到 Ring -1)[EB/OL]. 2025-06. https://www.packtpub.com/en-us/learning/how-to-tutorials/hyper-v-architecture-and-components
[428] 看雪安全社区 "Hyper-V 启动过程"(HvLoader 检测 AMD SVM 并选择 hvax64/hvix64)[EB/OL]. 2023-09. https://bbs.kanxue.com/thread-278784.htm
[429] HN Security "From arbitrary pointer dereference to arbitrary read/write in latest Windows 11"(VBS 定义、VTL0 ntoskrnl/VTL1 securekernel、hypercall 配置)[EB/OL]. 2025-09. https://hnsecurity.it/blog/from-arbitrary-pointer-dereference-to-arbitrary-read-write-in-latest-windows-11/
[430] VirtualBox/BIOS 排错资料(BIOS "SVM Mode / AMD-V / Secure Virtual Machine" 开关)[EB/OL]. 检索于 2026. https://dinajpuritpark.com/virtualbox-vmware-virtualization-error/
[431] Microsoft Q&A 官方解答(hypervisorlaunchtype auto;VMware 与 Hyper-V 独占冲突)[EB/OL]. 检索于 2026. https://learn.microsoft.com/zh-cn/answers/questions/2184993/hyper-v
[432] NAKIVO(冲突原理;"Only one software component can use Intel VT-x or AMD-V at a time")[EB/OL]. 检索于 2026. https://www.nakivo.com/blog/virtualization-applications-with-hyper-v-device-guard-and-credential-guard/
[433] SuperUser(引用微软官方 WHP 定义:第三方栈创建分区、配置 GPA 映射、运行 vCPU)[EB/OL]. 检索于 2026. https://superuser.com/questions/1510172/
[434] DeepWiki 对 MicrosoftDocs/Virtualization-Documentation 的分析(WHP API 前提:Intel VT-x 或 AMD-V、BIOS 开启、Hyper-V 组件)[EB/OL]. 检索于 2026. https://deepwiki.com/MicrosoftDocs/Virtualization-Documentation/4.2-windows-hypervisor-platform-api
[435] VMware 官方博客 "VMware Workstation 15.5 Now Supports Host Hyper-V Mode"(ULM 自动启用;Win10 20H1 19041.264+/Workstation 15.5.5+)[EB/OL]. 2020-05-28. https://blogs.vmware.com/cloud-foundation/2020/05/28/vmware-workstation-now-supports-hyper-v-mode/
[436] Broadcom KB 315385(原 VMware KB 2146361;Device/Credential Guard 不兼容、bcdedit hypervisorlaunchtype off、15.5.6+ 解法)[EB/OL]. 检索于 2026. https://knowledge.broadcom.com/external/article/315385
[437] syselement's Blog(CPL0 vs ULM 辨析;vmware.log "Monitor Mode:" 检索法)[EB/OL]. 检索于 2026. https://blog.syselement.com/home/home-lab/hypervisors/vmware/vmware-workstation
[438] SuperUser "Why can't I run VirtualBox because of 'A hypervisor has been detected'"(NEM 回退日志、"Snail execution mode")[EB/OL]. 2024-12. https://superuser.com/questions/1864128/
[439] Gist(rceninja)"Build QEMU with enabled Hyper-V acceleration (WHPX)"(qemu -accel whpx)[EB/OL]. 检索于 2026. https://gist.github.com/startergo/9a46fec6caf879027518db08a13df503
[440] dellenny.com "Intel HAXM vs. Hyper-V/WHPX"(WHPX 同时支持 Intel 与 AMD CPU、无需关闭 Hyper-V)[EB/OL]. 检索于 2026. https://dellenny.com/intel-haxm-vs-hyper-v-whpx-choosing-the-right-setup-for-android-emulator-on-windows/
[441] CFANZ/51CTO(bcdedit /set hypervisorlaunchtype off 让位方案)[EB/OL]. 检索于 2026. https://www.cfanz.cn/resource/detail/pLPzpkMjJNWnO
[442] Dell KB 000204766(ESXi /etc/vmware/config vhv.enable="TRUE"、Expose hardware assisted virtualization)[EB/OL]. 检索于 2026. https://www.dell.com/support/kbdoc/en-us/000204766/
[443] IFPI/globalmusicreport 等 "Why VirtualBox AMD-V Is Disabled"(VERR_SVM_DISABLED 固件开关)[EB/OL]. 检索于 2026. https://cms.globalmusicreport.ifpi.org/report/why-virtualbox-amd-v-is-disabled-and-how-to-fix-it-tfm3te
[444] Ding et al., "Diagnosing Virtualization Overhead for Multi-threaded Computation on Multicore Platforms"[EB/OL]. https://web.njit.edu/~dingxn/papers/VirtOverhead.pdf
[445] Phoronix, "Linux Fixing A 'Hilarious/Revolting Performance Regression' Around Intel KVM Virtualization"[EB/OL]. 2024-12-15. https://www.phoronix.com/news/Linux-Intel-KVM-Cache-CPUID
[446] Wang et al., "Revisiting Virtual Memory Support for Confidential Computing" (Oxford)[EB/OL]. 2025. https://eng.ox.ac.uk/media/n5rdmxrd/wang2025revisiting.pdf
[447] Yan & Gopalan, "Performance Overheads of Confidential Virtual Machines" (MASCOTS 2023)[C/OL]. 2023. https://kartikgopalan.github.io/publications/mascots23.pdf
[448] Graz 技术大学学位论文(SNP/VMPL 开销测量, EPYC 7443 Milan)[D/OL]. https://repository.tugraz.at/publications/marc21/dq966-vcp09/files/80146.pdf
[449] "Translation Pass-Through for Near-Native Paging Performance in VMs" (Imperial)[EB/OL]. https://spiral.imperial.ac.uk/server/api/core/bitstreams/988ff334-9556-4a7d-9581-6770e0f91541/content
[450] Inria, "Virtualization Costs: Benchmarking Containers and Virtual Machines Against Bare-Metal"[EB/OL]. 2021. https://inria.hal.science/hal-03337920/document
[451] Faggioli (SUSE), "Reaching 'EPYC' Virtualization Performance" (FOSDEM 2020)[EB/OL]. 2020-02. https://archive.fosdem.org/2020/schedule/event/vai_reaching_epyc/attachments/slides/4030/export/events/attachments/vai_reaching_epyc/slides/4030/Reaching_EPYC_Virtualization_Performance.pdf
[452] SUSE, "Optimizing Linux for AMD EPYC 9005 Series Processors" (SBP-AMD-EPYC-5, SLES 15 SP6)[EB/OL]. 2024-11. https://documentation.suse.com/sbp/tuning-performance/html/SBP-AMD-EPYC-5-SLES15SP6/index.html
[453] Microsoft Tech Community / Prowess Consulting, "Generational Performance Leap for Azure Confidential Computing"[EB/OL]. 2025-11. https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/generational-performance-leap-for-azure-confidential-computing/4468989
[454] Phoronix, "Evaluating The Performance Cost To AMD SEV-SNP On Modern EPYC VMs"[EB/OL]. 2026-02-13. https://www.phoronix.com/review/amd-epyc-9005-sev-snp
[455] Oracle Linux Blog, "Modeling EPYC Genoa topology with QEMU"[EB/OL]. https://blogs.oracle.com/linux/topology-matters-genoa-qemu
[456] LKML, "[PATCH Part1 v5 00/38] Add AMD Secure Nested Paging (SEV-SNP) Guest Support"(pre-validation vs lazy validation)[EB/OL]. 2021-08. https://lkml.iu.edu/hypermail/linux/kernel/2108.2/05889.html
[457] Proxmox 论坛实证(Milan/Genoa 不钉核慢 3×)[EB/OL]. https://forum.proxmox.com/threads/hardware-feedback-proxmox-ceph-cluster-3-4-nodes.147718/page-3
[458] SUSE SLES 15-SP7 文档, "Enhancing virtual machine security with AMD SEV-SNP"[EB/OL]. 2025-06. https://documentation.suse.com/sles/15-SP7/html/SLES-all/cha-vm-security.html
[459] "RMPocalypse: How a Catch-22 Breaks AMD SEV-SNP"[EB/OL]. 2025. https://benschlueter.com/assets/paper/RMPocalypse.pdf
[460] LKML, "[PATCH v3 00/12] AMD broadcast TLB invalidation"(引 AMD SEV-SNP 白皮书)[R/OL]. 2025-01. https://lkml.indiana.edu/hypermail/linux/kernel/2501.1/01711.html
[461] linux.org.hk 转 Phoronix, "LLVM Enables AMD's SEV-SNP Optimisation Instructions"[EB/OL]. 2025-09. https://www.linux.org.hk/archive/20250909-5424-llvm-enables-amd-s-sev-snp-optimisation.html
[462] Red Hat 官方博客, "RHEL confidential virtual machines on Azure"(vTPM/Secure Boot/机密磁盘加密)[EB/OL]. 2023-06-21. https://www.redhat.com/en/blog/rhel-confidential-virtual-machines-azure-technical-deep-dive
[463] sunnycloud.jp(AWS SEV-SNP GA 时实测:M6a/C6a/R6a;us-east-2/eu-west-1;约 +10% 费用)[EB/OL]. 2023-04-29. https://www.sunnycloud.jp/column/20230429-02/
[464] Microsoft Tech Community, "GA: DCasv6 and ECasv6 confidential VMs based on 4th Generation AMD EPYC processors"[EB/OL]. 2025-09-16. https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/ga-dcasv6-and-ecasv6-confidential-vms-based-on-4th-generation-amd-epyc%E2%84%A2-processo/4451460
[465] Red Hat 官方博客, "Confidential Containers on Azure with OpenShift: A technical deep dive"(HCL/VMPL0/VCEK)[EB/OL]. 2023-05-17. https://www.redhat.com/zh/blog/confidential-containers-azure-openshift-technical-deep-dive
[466] Microsoft Community Hub(机密 VM 启动证明与 Key Vault/Managed HSM 密钥释放流程)[EB/OL]. 2026-04. https://aka.ms/aksonhci
[467] Microsoft Tech Community, "Announcing Azure confidential VMs with NVIDIA H100 Tensor Core GPUs in Preview"[EB/OL]. 2023-11-15. https://techcommunity.microsoft.com/t5/azure-confidential-computing/announcing-azure-confidential-vms-with-nvidia-h100-tensor-core/ba-p/3975389
[468] VoltageGPU 对比页(Azure NCC H100 v5 机密 GPU 2024-09 GA)[EB/OL]. 2026-09 核实. https://voltagegpu.com/compare/azure-confidential-computing-alternative
[469] Microsoft Tech Community, "Public preview: Confidential containers on AKS"(Kata-CoCo + SEV-SNP,DCa_cc/ECa_cc)[R/OL]. 2023-11-14. https://techcommunity.microsoft.com/blog/appsonazureblog/public-preview-confidential-containers-on-aks/3980871
[470] TS2.Tech TEE 新闻综述(Azure SGX DCsv2 2026-06-30 退役;Linux 6.16 TDX/SVSM)[EB/OL]. 2025-08-25. https://ts2.tech/en/trusted-execution-environment-tee-hardware-news-june-july-2025/
[471] paragmali.com 技术综述(引微软公告,Azure TDX DCesv6/ECesv6 2026-02-26 GA)[EB/OL]. 2026-06. https://paragmali.com/blog/verify-me-dont-trust-me-apple-pcc-azure-confidential-ai-and-/
[472] Red Hat OpenShift 4.20 文档,GCP machine API("AMD SEV … deprecated")[EB/OL]. 2025/2026 文档版. https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/machine_management/managing-compute-machines-with-the-machine-api
[473] OneUptime 教程(GCP 官方机型映射转述:SEV→N2D/C2D/C3D;SEV-SNP→N2D)[EB/OL]. 2026-02-17. https://oneuptime.com/blog/post/2026-02-17-how-to-use-confidential-vms-to-encrypt-data-in-use-on-compute-engine/view
[474] Google Cloud Security Community 官方博客, "Beyond Confidential: Establishing Trust in Your Computing Environment"[EB/OL]. 2025-11-18. https://security.googlecloudcommunity.com/community-blog-42/beyond-confidential-establishing-trust-in-your-computing-environment-6290
[475] govindhtech(引 Google 文档,N2D 机密 VM 实时迁移全区域可用)[EB/OL]. 2024-04. https://www.govindhtech.com/google-cloud-confidential-vms-data-protection-amd/
[476] Ubuntu kernel-team 邮件列表(SRU,linux-gcp 6.8+ 加入 SVSM vTPM;arch/x86/coco 重组补丁清单)[EB/OL]. 2025-06-23. https://lists.ubuntu.com/archives/kernel-team/2025-June/160810.html
[477] West Loop Strategy(引 AWS release notes, Dedicated Hosts 支持 SEV-SNP)[EB/OL]. https://www.westloop.io/post/amazon-ec2-dedicated-hosts-now-support-amd-sev-snp
[478] Red Hat RHEL 10 官方文档, "Configuring RHEL on Public Cloud Platforms with AMD SEV SNP"[R/OL]. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/deploying_and_managing_rhel_on_amazon_web_services/configuring-rhel-on-public-cloud-platforms-with-amd-sev-snp
[479] AWS re:Post 官方答复(m6a.metal 不暴露 /dev/sev 与 PSP 接口)[EB/OL]. 2026-02. https://repost.aws/questions/QUcKwJXfsSQkWrOWjQvEikxQ/
[480] Confidential Containers 官方文档 Overview(硬件/云端支持矩阵)[EB/OL]. 2026-08 抓取. https://confidentialcontainers.org/docs/overview/
[481] arXiv 2510.12469, "Proof of Cloud"(AWS 提供 SNP CVM、不支持 TDX)[EB/OL]. 2025. https://arxiv.org/html/2510.12469v1
[482] 阿里云官方文档(ACK,g8i 全量支持 Intel TDX)[EB/OL]. https://help.aliyun.com/zh/ack/using-tee-cpu-to-accelerate-text2image-inference
[483] 搜狐科技,阿里云 Confidential AI 发布报道(支持 TDX/AMD SEV/海光 CSV/Hopper 机密 GPU)[EB/OL]. 2024-09-26. https://www.sohu.com/a/811963879_211762
[484] 腾讯云官方文档,《构建 AMD SEV 机密计算环境》(SA5;SEV-SNP 公测申请中)[EB/OL]. 2026-02-06 更新. https://cloud.tencent.com/document/product/213/128217
[485] OVHcloud infrastructure-roadmap issue #285(Scale 系列换装 EPYC 9005 Turin,Enhanced SEV)[EB/OL]. 2025-03. https://github.com/ovh/infrastructure-roadmap/issues/285
[486] pronteff(引 Red Hat 路线图,OpenShift 机密集群分阶段:GCP 4.13 GA / Azure 4.14 TP)[EB/OL]. 2025-02. https://pronteff.com/openshift-confidential-computing-enhances-data-security/
[487] Red Hat OpenShift Sandboxed Containers 1.13 文档(裸金属/Azure SEV-SNP GA;SNP+H100 为 TP)[EB/OL]. https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_confidential_containers_on_ibm_z_and_linuxone_bare-metal_servers/cc-discover_ibm-metal-cc
[488] GCP Weekly(Google 官方博客,SUSE SLES 在 GCP 上以 SEV/SEV-SNP/TDX 运行机密 VM)[EB/OL]. 2025-05-26. https://www.gcpweekly.com/gcp-resources/tag/confidential-computing/
[489] lesitedefrancois Kata 架构综述(Kata 为 CoCo 运行时底座;kata-agent 运行于 TEE 访客)[EB/OL]. https://lesitedefrancois.be/en/security/kata-containers/
[490] Validated Patterns(CoCo pattern;Red Hat build of Trustee 1.1)[EB/OL]. https://validatedpatterns.io/patterns/coco-pattern/
[491] GitHub confidential-containers/operator(2026-02-01 归档,Helm Chart 接任)[EB/OL]. 2026-02-01. https://github.com/confidential-containers/operator
[492] CCC 官方博客, "COCONUT-SVSM Joins the Confidential Computing Consortium"[EB/OL]. 2024-07-02. https://confidentialcomputing.io/2024/07/02/coconut-svsm-joins-theconfidential-computing-consortiumenhancing-security-for-sensitiveworkloads/
[493] Phoronix, "AMD Virtual TPM Driver Merged For Linux 6.16 To Enhance Confidential Computing"[EB/OL]. 2025-05-30. https://www.phoronix.com/news/AMD-SEV-vTPM-Linux-6.16-Merged
[494] LKML, "[PATCH v6 3/4] tpm: add SNP SVSM vTPM driver"(tpm_svsm.c;AMD 文档 #58019)[EB/OL]. 2025-04. https://lkml.org/lkml/2025/4/10/1240
[495] kernel.org 官方文档, "Confidential Computing VMs (Hyper-V)"(cc_platform_has 抽象)[EB/OL]. https://docs.kernel.org/6.12/virt/hyperv/coco.html
[496] Phoronix, "AMD Posts Linux Patches For SEV-SNP BTB Isolation"(VMSA feature bit 7,Turin)[EB/OL]. 2026-02-24. https://www.phoronix.com/news/AMD-SEV-SNP-BTB-Isolation
[497] SUSE SLES 16 虚拟化文档(8005/9005 SEV-SNP 增强;SNP CPU 上 SEV-ES 被禁用)[EB/OL]. 2025-11. https://documentation.suse.com/sles/16.0/html/SLES-virtualization-libvirt/
[498] 超能网/TECHPOWERUP(第六代 EPYC:SP7/SP8;Zen 6 ≤96 核、Zen 6c ≤256 核)[EB/OL]. 2026-07. https://www.expreview.com/106946.html
[499] VideoCardz / kad8(Advancing AI 2025:Venice 2026、Verano 2027、Helios 机架)[EB/OL]. 2025-06-12/13. https://videocardz.com/newz/amd-teases-epyc-verano-zen7-and-instinct-mi500-gpus-coming-2027
[500] 快科技/芯智讯 Zen4 EPYC 架构解析(AES-256-XTS、1006 keys、SMKE、免 SMT 攻击强化)[EB/OL]. 2022-11.
[501] 掘金技术专栏,《机密计算:SGX、SEV-SNP、TDX 与 ARM CCA》(CXL 池化内存的 RMP/密钥域划分开放问题)[EB/OL]. 2026-08. https://juejin.cn/post/7672999931841675306
[502] SentinelOne 漏洞库,AMD SB-3023 / CVE-2025-0029(固件更新与缓解指引)[EB/OL]. https://www.sentinelone.com/vulnerability-database/cve-2025-0029/
[503] David Woodhouse — "More than you ever wanted to know about x86 MSIs"(AMD 每设备 IRTE 表、MSI 数据低 11 位索引)[EB/OL]. http://david.woodhou.se/more-than-you-ever-wanted-to-know-about-x86-msis.txt

<!-- 以下为来源映射文件中存在、但正文未引用的来源(供审阅,不列入正文编号) -->
- FreeBSD bhyve sys/amd64/vmm/amd/svm.c(check_asid / svm_init,ASID 代管理)[EB/OL]. 2014(快照). https://web.mit.edu/freebsd/head/sys/amd64/vmm/amd/svm.c  (出处:sec04[^30^](dim03))
- SentinelOne vulnerability database,CVE-2026-68093[R/OL]. 2026-08-10. https://www.sentinelone.com/vulnerability-database/cve-2026-68093/  (出处:sec04[^33^](dim03))
