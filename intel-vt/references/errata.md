# Errata — Known Misconceptions and Their Corrections

> **中文速览**：本文件收录关于 Intel VT 的常见讹传及其纠正。很多讹传以中文流传，因此每条都给出中英双语表述。**动笔或回答前必查本文件**：如果你要写的内容与这里某一条相冲突，按本文件改口径。每条都附真实出处；找不到出处的条目要么删掉，要么明确标注"来源未核实"。文末"Open conflicts"一节列出证据相互矛盾、本次重构**不做裁决**的条目——引用这些话题时必须同时给出两种说法。

**How to use.** Each entry gives the misconception in Chinese and English, the correction as a claim line with a real citation, and the chapter file that owns the underlying fact. Entries E01–E22 are settled. Entries O1–O6 are open conflicts: do not pick a side, state both.

**Citations.** Every entry carries at least one `[N]`. Where the only available source is weak, the entry says so and carries `C:low`. Nothing here cites a bare filename.

**Time-sensitivity.** Several entries correct a misreported *date or status*. The correction itself is a durable historical statement and is tagged `V:durable`; whatever the current status is belongs to `90-dated-landscape.md` and must be re-verified there.

---

## Settled corrections

### E01 · MBEC generation

- 讹传：MBEC（Mode-Based Execute Control）随 Skylake 引入。
- Misconception: "MBEC (Mode-Based Execute Control) was introduced with Skylake."

- **Claim.** Mode-Based Execute Control first appeared in **Kaby Lake** (7th-generation Core, late 2016 to 2017), not Skylake; the AMD counterpart, GMET, appeared in Zen 2. MBEC splits the EPT execute permission into supervisor-execute and user-execute and is the hardware accelerator behind Windows HVCI.  `[600][601]` `C:high` `V:durable`
- **Owner:** `06-address-translation.md`

### E02 · PML generation

- 讹传：PML（Page Modification Logging）随 Skylake 引入。
- Misconception: "PML (Page Modification Logging) was introduced with Skylake."

- **Claim.** PML was introduced with **Broadwell Xeon (server, 2015)**, not Skylake. The KVM 4.x merge-window pull request describes it as "a new feature in Broadwell Xeons that speeds up dirty page tracking", and Intel material calls it a feature of "Intel's Broadwell server platform".  `[602][603]` `C:high` `V:durable`
- **Owner:** `06-address-translation.md`

### E03 · EPT worst-case memory references

- 讹传：EPT 二维页表遍历在 TLB miss 时最坏 20 次内存访问。
- Misconception: "A TLB miss under EPT costs at most 20 memory accesses."

- **Claim.** The worst case is **24 memory references** on a 4-level/4-level 2D walk (4 guest page-table entries, plus 4 EPT walks of 4 accesses each to translate them, plus 4 for the final guest-physical address), against 4 for a native walk. The widely repeated "20" counts only the EPT page-table reads and omits the 4 guest page-table entry reads.  `[605][606]` `C:high` `V:durable`
- **Owner:** `06-address-translation.md`; the performance consequences belong to `16-performance.md`.

### E04 · Out of Hypervisor publication venue

- 讹传：Out of Hypervisor (OoH) 发表于 SOSP'22。
- Misconception: "Out of Hypervisor (OoH) was published at SOSP'22."

- **Claim.** OoH was published at **SC'22** (IEEE/ACM Supercomputing, November 2022), not SOSP'22; arXiv:2202.13483 (2022-02-27) is the preprint.  `[607][608]` `C:high` `V:durable`
- **Owner:** `14-nested-virtualization.md`

### E05 · AWS nested virtualization on virtualized instances

- 讹传：AWS 自 2023 年起在普通（虚拟化）EC2 实例上支持嵌套虚拟化。
- Misconception: "AWS has supported nested virtualization on ordinary (virtualized) EC2 instances since 2023."

- **Claim.** Until 2026-02 AWS supported nested virtualization **only on bare-metal (`.metal`) instances**; virtualized Nitro instances did not expose VT-x to the guest. Support on virtualized C8i/M8i/R8i instances, via `--cpu-options "NestedVirtualization=enabled"` and limited to KVM or Hyper-V as L1, dates from **2026-02**, not 2023.  `[551]` `C:high` `V:durable`
- **Owner:** current status → `90-dated-landscape.md` §90.3.1; mechanism → `14-nested-virtualization.md`.

### E06 · VMFUNC generation (disputed — cite both sides)

- 讹传：VMFUNC 明确属于某一代（或"Haswell"，或"Skylake"），只说一个就够。
- Misconception: "VMFUNC belongs unambiguously to one generation" — quoted as either Haswell or Skylake, with the other side dropped.

- **Claim.** The two attributions measure different things and both must be given: the instruction entered the ISA documentation in the **Haswell/Silvermont** era, and hardware availability is commonly dated to **Skylake** in engineering practice (Xen and KVM support landed 2015–2016). Write it as "VMFUNC entered the SDM in the Haswell era; hardware availability is usually dated to Skylake" and do not assert a single generation.  `[609][610]` `C:medium` `V:durable`
- **Owner:** `02-vmcs.md` (VM-function controls); EPTP switching semantics → `06-address-translation.md`.

### E07 · The interrupt-remapping erratum is Intel's, not AMD's

- 讹传：那个著名的"中断重映射有 erratum"的问题出在 AMD 侧。
- Misconception: "The well-known interrupt-remapping erratum was an AMD problem."

- **Claim.** The documented interrupt-remapping erratum is **Intel's**: the 5520/5500 chipsets' **erratum #53**, for which Intel recommended disabling interrupt remapping in BIOS and for which Linux carried a 2013 quirk (revision 0x13 detection, `set_irq_remapping_broken`, warn and taint). The AMD-side pain points were different in kind — early AMD IOMMUs lacked interrupt remapping at all, and pre-Zen 3 IOMMUs did not support AVIC — which is feature absence, not an erratum.  `[611]` `C:high` `V:durable`
- **Owner:** `11-vtd-interrupt-remapping.md`; the cross-vendor comparison → `18-comparison-amd-arm-riscv.md`.

### E08 · AVIC default-off versus APICv shipped enabled

- 讹传：AMD AVIC 与 Intel APICv 同期可用、同样默认启用。
- Misconception: "AMD AVIC and Intel APICv became usable at the same time and are both on by default."

- **Claim.** APICv shipped in 2013 and KVM enables it by default (`enable_apicv`). AVIC was disabled by default in KVM for years; CPUs before Zen 4 are affected by **erratum #1235** and need `force_avic=1` (which taints the kernel), and the upstream move to enable AVIC by default from Zen 4 was proposed in 2025-06. The same #1235 workaround was extended to Hygon Family 18h.  `[612][631]` `C:high` `V:durable`
- **Owner:** `18-comparison-amd-arm-riscv.md`; Intel-side APICv mechanism → `07-apic-virtualization.md`.

### E09 · VM-exit cost is not one number

- 讹传：VM-exit 的成本是一个数字（常被引作"几百个周期"或"约 3900 周期"）。
- Misconception: "A VM exit costs N cycles" — quoted as a single figure, typically "a few hundred cycles" or "about 3900 cycles".

- **Claim.** Two different quantities are routinely conflated and must be separated. The **bare transition** cost measured by Adams & Agesen was 2409 cycles for VM entry on a 3.8 GHz Pentium 4 672 and 937 cycles on a 2.66 GHz Core 2 Duo. The **end-to-end cost including hypervisor handling** measured in NOVA averaged approximately 3900 cycles per exit, of which only 1016 cycles (26%) was the guest/host transition itself. I/O-class events cost far more — 15826 cycles for a single `in` under the hardware VMM in the same Adams & Agesen study. Any citation must state which quantity, on which microarchitecture, under which VMM.  `[613][614]` `C:high` `V:durable`
- **Owner:** `16-performance.md`.

### E10 · Cloud "zero overhead" figures are vendor statements

- 讹传：云厂商公布的"零损耗""<5% 损耗""100% 裸机性能"是第三方基准结论。
- Misconception: "Cloud providers' 'zero overhead' / '<5% loss' / '100% of bare-metal performance' figures are third-party benchmark results."

- **Claim.** These are the providers' **own marketing statements**, published without methodology and without independent replication: AWS's "typically less than 1%", Alibaba's "100% of physical-machine performance, zero virtualization loss / 5x I/O / 160% overall", Tencent's "15% down to under 5%", Huawei's "zero reservation, zero loss, zero jitter". Write them in attributed voice ("Alibaba states that…") with the source attached, or omit them. Never assert them.  `[554][566][567][568]` `C:high` `V:durable`
- **Owner:** `90-dated-landscape.md` §90.3.1.

### E11 · Escape CVEs are VMM software defects, not VT hardware defects

- 讹传：重大虚拟机逃逸 CVE 说明 Intel VT 硬件有缺陷。
- Misconception: "Major VM-escape CVEs show that Intel VT hardware is defective."

- **Claim.** The major escapes are defects in **VMM software**, almost always in device emulation: VENOM (CVE-2015-3456) in the QEMU virtual floppy disk controller, and the Pwn2Own Berlin 2025 VMware Workstation escape through a heap overflow in the PVSCSI controller. Neither is a VT-x hardware defect. Hardware-level problems in this space appear instead as **microarchitectural side channels** (L1TF, MDS), which is a different failure mode with different mitigations.  `[615][572]` `C:high` `V:durable`
- **Owner:** `15-security.md`.

### E12 · SGX has not been replaced by TDX

- 讹传：TDX 已取代 SGX，SGX 已被废弃。
- Misconception: "TDX has replaced SGX; SGX is dead."

- **Claim.** Intel removed SGX from **client** processors from the 12th-generation Core parts onward, but server Xeon retains it, and the two are coupled rather than substitutes: a **TD Quote is signed by the SGX Quoting Enclave**, and the DCAP/PCK/PCCS attestation infrastructure is shared between SGX and TDX. The scope of Intel's forward SGX roadmap is itself secondary-sourced — a published survey relays an Intel roadmap statement of SGX support "till Intel Xeon 7 – Diamond Rapids", which Intel has not confirmed publicly.  `[624][625][626]` `C:medium` `V:durable`
- **Owner:** `13-tdx.md`.

### E13 · "Shenlong predates Nitro" is a single-party narrative, not an established fact

- 讹传（原勘误表此条被标为"（事实）"，极性含糊，现予澄清）：把"阿里云神龙比 AWS Nitro 早一个月发布"当作既定事实陈述。
- Misconception (the previous errata table labelled this entry "(fact)", leaving its polarity ambiguous; restated here): stating as established fact that "Alibaba Cloud Shenlong was released one month before AWS Nitro."

- **Claim.** The "one month earlier than Amazon Nitro" statement comes from **Alibaba's own retrospective** and has no independent corroboration; AWS's Nitro precursors (C3 SR-IOV offload in 2013, C4 EBS offload in 2015) predate the 2017 date the comparison rests on, so at best the claim is about the release of a complete integrated hardware/software architecture. Reproduce it only in attributed voice as a single-party claim; do not assert priority either way.  `[565]` `C:low` `V:durable`
- **Owner:** `90-dated-landscape.md` §90.3.1.

### E14 · TDX Connect / TEE-IO is not GA

- 讹传：TDX Connect / TEE-IO 已经 GA。
- Misconception: "TDX Connect / TEE-IO is generally available."

- **Claim.** Intel announced **hardware** support for TDX Connect (TEE-IO) on Xeon 6 P-core processors on **2025-02-24**, and Intel's own wording is that a TDX Connect solution additionally requires an enabled host OS/hypervisor and a TEE-IO capable device. No end-to-end GA date had been announced as of 2026-09-16. Hardware readiness is not product availability.  `[587][588]` `C:high` `V:durable`
- **Owner:** current status → `90-dated-landscape.md` §90.3.3; architecture → `13-tdx.md`.

### E15 · Azure DCesv5 / ECesv5 was a preview, not a GA

- 讹传：Azure DCesv5/ECesv5（Intel TDX）于 2023-12 GA。
- Misconception: "Azure DCesv5/ECesv5 (Intel TDX) went GA in December 2023."

- **Claim.** DCesv5/ECesv5 were announced as **public preview** on **2023-11-15** and became deployable on 2023-12-07 while still in preview; they never reached GA under those names. Azure's first generally available Intel TDX confidential VMs are the v6 series (DCesv6/DCedsv6/ECesv6/ECedsv6, Emerald Rapids), announced GA on **2026-02-26**. This is the canonical example of the preview→"GA" drift that makes cloud status the most error-prone fact class in this domain.  `[556][557]` `C:high` `V:durable`
- **Owner:** `90-dated-landscape.md` §90.3.1.

### E16 · EPT-violation exit qualification bit 7

- 讹传：EPT violation 的 exit qualification bit 7 表示 guest-physical address 有效。
- Misconception: "Bit 7 of the EPT-violation exit qualification means the guest-physical address is valid."

- **Claim.** Bit 7 is set when the **guest-linear-address field is valid**, not the guest-physical-address field. The guest-physical address is reported in its own VM-exit information field and is always valid for an EPT violation. The wrong reading propagates from stale Chinese transcriptions of a 2017-era SDM mirror.  `[SDM 3C §27.9.1]` `[1][619]` `C:high` `V:durable`
- **Owner:** `05-vm-exit.md`; how the field is filled → `[SDM 3C §30.2.1]`.

### E17 · EPT-violation exit qualification bit 6

- 讹传：EPT violation 的 exit qualification bit 6 是各级 EPT 表项 XD 位之与。
- Misconception: "Bit 6 of the EPT-violation exit qualification is the AND of the XD bits."

- **Claim.** Bit 6 is the logical-AND of the **user-mode execute permission** of the EPT paging-structure entries used in the translation, and it is meaningful only when the "mode-based execute control for EPT" VM-execution control is 1; otherwise it is undefined. It has nothing to do with the XD bit of the guest's own paging structures.  `[SDM 3C §27.9.1]` `[1][619]` `C:high` `V:durable`
- **Owner:** `05-vm-exit.md`; MBEC itself → `06-address-translation.md`.

### E18 · ZombieLoad's CVE number

- 讹传：ZombieLoad = CVE-2019-11091。
- Misconception: "ZombieLoad is CVE-2019-11091."

- **Claim.** ZombieLoad is **CVE-2018-12130**, the fill-buffer variant (MFBDS, Microarchitectural Fill Buffer Data Sampling). CVE-2019-11091 is **MDSUM** (Microarchitectural Data Sampling Uncacheable Memory), a different member of the same MDS family covered by INTEL-SA-00233, alongside MSBDS (CVE-2018-12126) and MLPDS (CVE-2018-12127).  `[616][617]` `C:high` `V:durable`
- **Owner:** `15-security.md`.

### E19 · "Intel has no ASID mechanism"

- 讹传：Intel 处理器上没有 ASID 机制，ASID 是 AMD 独有的。
- Misconception: "Intel processors have no ASID mechanism; ASID is AMD-only."

- **Claim.** The claim is wrong as stated. Intel has **two** address-space identifier mechanisms with different scopes: **PCID** tags linear-address translations by process context, and **VPID** (a 16-bit VMCS field, with `INVVPID` to invalidate) tags them by virtual-processor/VM context. What is true is narrower: Intel does not use the *name* ASID and does not use a single identifier for both roles, whereas AMD's 32-bit ASID covers the VM-tagging role alone. The misstatement circulates in Chinese forum material and is repeated downstream.  `[SDM 3C §27.6.12]` `[1][3][618][632]` `C:high` `V:durable`
- **Owner:** `06-address-translation.md` (VPID); the cross-vendor framing → `18-comparison-amd-arm-riscv.md`.

### E20 · SDM chapter numbers have been renumbered

- 讹传：引用 SDM 的 "Virtualization of System Resources" / "Handling Boundary Conditions in a VMM" / "Managing State" 等章，或沿用旧的 VMX 章号。
- Misconception: citing SDM chapters titled "Virtualization of System Resources", "Handling Boundary Conditions in a VMM" or "Managing State", or reusing older VMX chapter numbers.

- **Claim.** In SDM revision 092 the VMX chapters are **Vol.3C Ch.26–35** (26 Introduction to VMX, 27 VMCS, 28 VMX Non-Root Operation, 29 VM Entries, 30 VM Exits, 31 VMX Support for Address Translation, 32 APIC Virtualization, 33 VMX Instruction Reference, 34 SMM, 35 SEAM), with Vol.3D App.A/B/C carrying the capability reporting facility, VMCS field encodings and basic exit reasons. The three chapter titles above **no longer exist as chapters**. Any citation to them, or to a VMX chapter number that does not fall in 26–35, comes from a stale manual — typically the 2017-era HTML mirrors that Chinese secondary material still quotes.  `[SDM 3C Ch.26]` `[1][2][619]` `C:high` `V:durable`
- **Owner:** all of `01`–`09`; the anchor grammar is fixed in the project conventions.

### E21 · The VT-d specification landing page on intel.com is stale

- 讹传：以 intel.com VT-d 落地页上的日期/版本为准（"2023-03-22，Rev 4.1"）。
- Misconception: trusting the intel.com VT-d landing page's metadata ("2023-03-22", Rev 4.1) as the current specification.

- **Claim.** The landing page metadata is stale: it shows 2023-03-22 and its content endpoint was still serving **Rev 4.1** when checked on 2026-09-20. The current specification is **Rev 5.20, April 2026, order number D51397-019**. Always take the revision from the PDF cover page, not from the intel.com page metadata.  `[VT-d 5.20 Ch.1]` `[8][620]` `C:high` `V:durable`
- **Owner:** `10-vtd-dma-remapping.md`.

### E22 · There is no standalone Intel VT-rp specification

- 讹传：引用一份独立的 "Intel VT-rp specification"（HLAT/paging-write/guest-paging verification 规范）。
- Misconception: citing a standalone "Intel VT-rp specification" for HLAT, paging-write control or guest-paging verification.

- **Claim.** No such document exists. The normative content lives **only inside the SDM**: the linear-address translation behaviour in Vol.3A §5.5.1 / §5.5.3 / §5.5.5, the VMCS fields in Vol.3C §27.6.22, and HLAT in Vol.3C §31.2. A citation to a "VT-rp spec" is a fabricated source.  `[SDM 3C §31.2]` `[1][3]` `C:high` `V:durable`
- **Owner:** `06-address-translation.md`.

---

## Open conflicts — do not pick a side

For each of these the evidence genuinely disagrees. State both readings and mark the conflict; do not silently choose one.

### O1 · FlexPriority first generation

- 争议：FlexPriority 首发于 2006–2007 的 Core 2（Merom/Penryn），还是 2008 的 Xeon 7400？
- Conflict: did FlexPriority first appear on 2006–2007 Core 2 (Merom/Penryn), or on the 2008 Xeon 7400?

- **Claim.** Two incompatible datings are in circulation and neither is refuted. **(a)** Silicon evidence: an `inxi` dump of a Core 2 Duo T7700 (Merom, built 2006-09) lists the `flexpriority` and `tpr_shadow` CPU flags, which places the hardware in 2006. **(b)** Intel-side and review-press framing consistently dates the *introduction* of Intel VT FlexPriority to the **Xeon 7400 series in 2008**. The likeliest reconciliation is "hardware 2006, brand 2008", but no source states that, so both datings must be given.  `[621][622]` `C:medium` `V:durable`
- **Owner:** `07-apic-virtualization.md`.

### O2 · VT-d 1.0 date

- 争议：VT-d 规范 1.0 是 2006-03 还是 2006-08？
- Conflict: was VT-d Rev 1.0 published in 2006-03 or 2006-08?

- **Claim.** **2006-03** is the date carried forward in the VT-d revision history used across this material for Rev 1.0 (DMA remapping: root table, context table, second-level page tables). **2006-08** is the publication date of the Intel Technology Journal 10(3) architecture paper by Abramson et al. that first described VT-d publicly. Industry writeups additionally cite an announcement at Spring IDF 2006 without an Intel press release to anchor it. No Intel document consulted in this rebuild settles the Rev 1.0 date; cite the Rev 5.20 specification for anything current and flag the 1.0 date as unsettled.  `[8][623]` `C:low` `V:durable`
- **Owner:** `10-vtd-dma-remapping.md`.

### O3 · TME-MK key strength: AES-128 or AES-256

- 争议：TDX 的内存加密是 AES-128-XTS 还是 AES-256？
- Conflict: is TDX memory encryption AES-128-XTS or AES-256?

- **Claim.** Both appear in Intel material and the difference is generation-dependent, but the two sources do not state it the same way. The TDX base architecture describes the MKTME/TME-MK engine as providing memory encryption using **AES-128-XTS**. Intel's TDX feature-readiness support article gives the TDX AES key strength as **128 bit on 4th/5th-Gen Xeon and 256 bit on Xeon 6** (both E-core and P-core). Until the base specification's own text is re-read for a per-generation qualifier, state the generation with the number and do not write an unqualified "TDX uses AES-128-XTS".  `[11][585]` `C:medium` `V:durable`
- **Owner:** `13-tdx.md`.

### O4 · VBS/HVCI overhead

- 争议：Windows VBS/HVCI 的性能开销是 6%、5–10% 还是 5–25%？
- Conflict: is the Windows VBS/HVCI performance cost 6%, 5–10%, or 5–25%?

- **Claim.** Three figures circulate with no common measurement basis: a ComputerBase measurement relayed as an **approximately 6%** average gaming frame-rate drop with HVCI on; a community figure of **5–10%** system-wide overhead; and a **5–25%** gaming range attributed to Tom's Hardware testing. None of the relayed sources states workload, hardware, driver set or whether nested paging and large pages were in play, and the three are not measuring the same thing. Do not quote any of them without conditions; route quantitative questions to `16-performance.md`.  `[627][628][629]` `C:low` `V:durable`
- **Owner:** `16-performance.md`; the VBS mechanism → `15-security.md`.

### O5 · The H100 + TDX confidential-inference study has two conflicting identifiers

- 争议：H100+TDX 机密推理研究的 arXiv 编号与日期有两种互相矛盾的记录。
- Conflict: the H100 + TDX confidential-inference study is recorded under two conflicting arXiv identifiers and dates.

- **Claim.** The same result set — average TTFT up 21.8% (Mistral-7B) and 27.8% (Qwen3-30B-A3B), global token throughput down 17.7% and 21.1%, on an Intel TDX confidential instance with a single H100 80GB in CC mode — is recorded in one place as **arXiv:2607.19353, "Benchmarking Confidential GPU Inference on NVIDIA H100", dated 2026-05-20**, and in another as an unnumbered arXiv paper attributed to **Mozilla and dated 2026-07**. At most one attribution can be right and neither was re-verified against arXiv in this rebuild. Cite the numbered identifier, flag the discrepancy, and re-verify before relying on the provenance.  `[630]` `C:low` `V:durable`
- **Owner:** `16-performance.md`.

### O6 · Out of Hypervisor's own reported results

- 争议：OoH 论文自身给出的收益是"13×/6×/16×"还是"约 14% / 约 0.5%"？
- Conflict: does the OoH paper report "13x / 6x / 16x" improvements, or "about 14% / about 0.5%"?

- **Claim.** The two figure sets come from different versions of the same work and are routinely mixed. The SC'22 result quoted is that EPML speeds up CRIU checkpointing by **13x** and Boehm garbage collection by **6x** relative to SPML, `/proc` and `userfaultfd`, with **16x** less overhead on the monitored application. The arXiv preprint abstract instead reports a checkpoint-time reduction of about **14%** and an overhead of about **0.5%**. Always say which version a number comes from; do not merge them.  `[607][608]` `C:medium` `V:durable`
- **Owner:** `14-nested-virtualization.md`.
