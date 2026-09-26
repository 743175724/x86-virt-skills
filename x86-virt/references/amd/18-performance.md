# 18. Performance on a Windows PC

> **中文速览**：本章是全库唯一可以出现性能数字的地方，规则只有一条——**每个数字必须带四要素**：微架构、hypervisor 或内核版本、benchmark、年份；做不到就不收录，宁可报告空白。重心是 Windows PC 的开销：VBS/HVCI、WSL2 与工具 VM、第三方 VMM 跑在 WHP 之上 vs 裸 SVM、PC 上的嵌套、NPT 与大页。**AMD 从未公布过 `VMRUN`/`#VMEXIT` 的周期数**，本章不会替它编一个（§18.1）。冲突的测量并列呈现并说明差异来源（§18.8），**永不平均**。厂商说法一律带归属。服务器范围的测量集中在 §18.7，与客户端结论分开。

**Maps to:** measurement literature only. This chapter is **not** an architecture chapter, and a measurement here carries **no APM anchor** — the manuals state no performance figures, so an APM section number on a benchmark result would be citation filler. [550][551][552]
**Owns:** every quantitative performance figure in this skill, together with the conditions under which it was measured.
**Scope:** client-first; server measurements are quarantined in §18.7 and labelled.
**See also:** `03-intercepts.md` (PAUSE filter, intercept mechanisms) · `06-nested-paging.md` (NPT, GMET, the two-dimensional walk) · `07-virtual-interrupts-avic.md` (AVIC mechanism) · `14-sev-snp.md` (RMP page-size rules) · `15-nested-virtualization.md` (the nesting mechanism) · `16-windows-platform.md` (the Windows features whose cost is discussed here) · `19-comparison-intel-arm-riscv.md` (cross-vendor framing) · `90-dated-landscape.md` (vendor claims, defaults, product status).

---

## 18.1 How a number qualifies for this chapter

A virtualization overhead figure without its conditions is worse than no figure, because it gets re-quoted as a universal constant. Five fields are mandatory:

| Field | Why it is mandatory |
|---|---|
| **What was measured** | a bare world switch, one `#VMEXIT` handled end to end, or a whole-workload delta — three different quantities |
| **Microarchitecture** | Barcelona, Milan, Genoa and a client Zen 3 desktop are not interchangeable |
| **Software and version** | hypervisor, kernel, firmware, and which features were switched on |
| **Benchmark and parameters** | resolution, block size, thread count, page size, SMT state |
| **Year** | most of the classic nested-paging figures are from 2008–2009 |

Where a source omits one of these, the omission is recorded in the claim rather than quietly filled in.

### 18.1.1 The sourcing rule for this chapter

- **Claim.** No AMD64 Architecture Programmer's Manual states a cycle count, a latency or a throughput figure for any SVM operation; the only cycle quantity the manual attaches to SVM is the PAUSE Filter Threshold, which is a programmable input rather than a measurement (`03-intercepts.md` owns that field).  `[APM2 §15.14.4]` `[1]` `C:high` `V:durable`
- **Claim.** Consequently every figure in this chapter is Tier-2 measurement literature, and an APM section number attached to a benchmark result in this skill is fabricated citation weight rather than evidence; lint's `offSpec` rule enforces this and `[no-spec]` is the correct marker.  `[no-spec]` `[1]` `C:high` `V:durable`

### 18.1.2 What this knowledge base does not have

- **Claim.** No public cycle-level measurement of the AMD `VMRUN` / `#VMEXIT` hardware round trip is recorded here for any microarchitecture — AMD has published no equivalent of the per-generation transition-latency table that Intel published for Penryn, Nehalem and Westmere, and no third party in this corpus has measured one. The closest AMD figures available are per-exit *handler* averages in microseconds (§18.7.1) and an IPI-delivery cycle count (§18.7.1), neither of which is a bare world switch.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** Stating that absence is the correct answer to "how many cycles does a `#VMEXIT` cost on Zen 4"; interpolating from Intel's numbers or from a microsecond average would produce a fabricated figure carrying the authority of a measured one.  `[no-spec]` `[553]` `C:high` `V:durable`

### 18.1.3 Producing a number for your own machine

The absence of published figures for most Windows-side costs (§18.2–§18.5) makes the question a measurement task, not an unanswerable one. A usable result needs: **one variable at a time** — toggling memory integrity is a different experiment from disabling the hypervisor, because the second also removes nested paging from the whole machine; **a workload bound by the thing being measured**, since a GPU-bound game at 4K will show nothing; **distributions rather than means**, because virtualization cost appears in frame times and tail latency long before it moves an average; and the full condition set above recorded alongside the result.

- **Claim.** A comparison that toggles memory integrity and a comparison that disables the hypervisor entirely are not measuring the same thing: the second additionally removes the nested-paging translation that was active for every workload on the machine, so the two cannot be pooled.  `[no-spec]` `[42][554]` `C:high` `V:durable`

### 18.1.4 Every figure in this chapter, in one table

- **Claim.** The table below is a digest of the claims in §18.2 through §18.7 and introduces no value that is not stated with its full conditions there; where a row and a section disagree, the section is authoritative.  `[no-spec]` `[550][551][552][553][554][555][556]` `C:high` `V:durable`

| Figure | What it measures | Platform | Software | Year | § |
|---|---|---|---|---|---|
| ~6% frame rate, ~8% frame times | memory integrity on vs off, whole-workload | Ryzen 7 5800X (Zen 3) + RX 7900 XTX, 1280×720 | Windows 11, build not stated | 2023 | 18.2.2 |
| >30% frame times (single title) | same, worst title (Diablo II: Resurrected) | same | same | 2023 | 18.2.2 |
| 14.5% / 7.82% | nested vs single-level guest, kernbench / SPECjbb | single Intel Xeon 2.9 GHz core — **not AMD** | KVM kvm-87 at all levels | 2010 | 18.5.1 |
| 10.3% / 6.3% | the same, minus the Intel-specific control-block trap cost | same | same | 2010 | 18.5.2 |
| up to 42% / up to 500% | nested paging vs binary-translation VMM, macro / micro | 2× Opteron 8384 "Shanghai" | VMware ESX 3.5 U2 | 2009 | 18.6.1 |
| ~29% | the same, Citrix XenApp | same | same | 2009 | 18.6.1 |
| 3.9–4.6× | nested walk vs native walk, no page-walk caching either side | **simulated** Quad-Core Opteron | cycle-accurate simulator | 2008 | 18.6.2 |
| 20–70% | unvirtualized advantage with no page-walk caching | same | same | 2008 | 18.6.2 |
| 15–38% / 3–7% / 3–22% | page-walk cache extension / nested TLB / large nested pages | same | same | 2008 | 18.6.2 |
| up to 5% | large pages with nested paging already on | unspecified | VirtualBox, vendor manual | current | 18.6.2 |
| 23,718,962 → 1,049,506 exits (~96%) | exit count, AVIC off vs on | 2-socket Zen 4 EPYC (Genoa), OCI E5.192 | UEK7, QEMU, 16-vCPU guest, sysbench threads | 2024 | 18.7.1 |
| 5708 → 3027 cycles (47%) | IPI delivery latency, AVIC off vs on | same | `kvm-unit-tests` `vmexit.flat`, split irqchip | 2024 | 18.7.1 |
| 0.82 / 0.56 / 0.74 / 1.10 / 764.07 µs | `perf kvm` handler averages by exit reason | same | same 20 s window, AVIC off | 2024 | 18.7.1 |
| <1% / ≤2.5% / ≤4.3% | Sysbench / 7-Zip / STREAM, SEV generations vs normal VM | 2× EPYC 7763 (Milan) | Linux 5.19-rc6 v4, QEMU 6.1.50-snp-v3 | 2023 | 18.7.2 |
| 56% / 36% / ≤14% | disk I/O (SEV-ES worst) / TCP over loopback / Redis | same | same | 2023 | 18.7.2 |
| 12.90 → 30.26 s | Large-VM boot, normal vs SEV-SNP | same | same | 2023 | 18.7.2 |
| +240% | `#VMEXIT`-entailing instruction latency, SEV-SNP vs normal VM | 1× EPYC 9654P (Genoa) | Linux 6.8, QEMU 8.2, SEV fw 1.55.30 | 2024 | 18.7.3 |
| 2.88% (MLC) vs 7.29% (Phoronix) | memory overhead, SEV-SNP vs normal VM, two suites | same | same | 2024 | 18.7.3 |
| +59% | first population of a 32 GB mapping | same | same | 2024 | 18.7.3 |
| +102% / +231% | boot time, kernel 6.8 / kernel 6.9 | same | same | 2024 | 18.7.3 |
| 16% / +41% / 16% | UnixBench Process / NPB PASSIVE / TensorFlow BERT | same | same | 2024 | 18.7.3 |
| 4.6% / 2.9% / 21% | storage bandwidth / IOPS / TCP at saturation | same | same | 2024 | 18.7.3 |

Exactly one row of that table was measured on a client part.

### 18.1.5 Quoting a figure out of this chapter

Any figure leaving this chapter travels with its row. The minimum honest form is *number, what was measured, part, software, year* — for example "about 6% average frame rate, memory integrity on versus off, Ryzen 7 5800X with an RX 7900 XTX at 720p, ComputerBase 2023". Dropping any of the five turns a conditioned measurement into a platform constant, which is the failure mode this chapter exists to prevent.

---

## 18.2 VBS and HVCI on a client machine

This is the overhead an AMD Windows PC actually encounters, and it has the worst public data in the chapter.

### 18.2.1 Where the cost comes from

Four mechanisms, each able to dominate depending on workload. All four are owned elsewhere; only their cost is owned here.

- **Claim.** With the hypervisor resident, Windows runs as a guest and operations the hypervisor intercepts become `#VMEXIT`s that did not exist on the same machine with the hypervisor off; who owns SVM in that configuration is `16-windows-platform.md`.  `[no-spec]` `[42][44]` `C:high` `V:durable`
- **Claim.** Nested paging is then active for the **whole machine**, not only for virtual machines, so the two-dimensional walk described in `06-nested-paging.md` is paid by ordinary desktop and game workloads, and its cost scales with TLB miss rate and page size rather than with anything the security feature does.  `[no-spec]` `[42][56]` `C:high` `V:durable`
- **Claim.** Kernel code-integrity enforcement moves page-permission decisions to a more privileged level, and the hardware primitive underneath it on AMD is the Guest Mode Execute Trap extension, whose mechanism and CPUID bit belong to `06-nested-paging.md`; the benchmarking article that supplies this chapter's client figure notes that parts lacking the equivalent execution-control support can cost significantly more, and attributes that to a fallback emulation path.  `[no-spec]` `[42][554]` `C:medium` `V:durable`
- **Claim.** Calls into the more privileged level are hypervisor-mediated transitions and therefore cost at least one world switch each; **no measurement of such a transition in cycles on an AMD part is recorded here**.  `[no-spec]` `[45]` `C:high` `V:durable`

### 18.2.2 The one client AMD measurement with conditions

- **Claim.** ComputerBase measured Windows 11 memory integrity (HVCI) on versus off on a **Ryzen 7 5800X (Zen 3)** paired with a Radeon RX 7900 XTX at **1280×720** — deliberately CPU-limited — and reported about **6% on average frame rate and about 8% on frame times**; published 2023-03-16.  `[no-spec]` `[554]` `C:medium` `V:durable`
- **Claim.** The per-title spread in that same test is far wider than the suite average: Forspoken showed essentially no measurable difference, while Diablo II: Resurrected lost **over 30% on frame times**. A suite average of 6% therefore says nothing about any individual title.  `[no-spec]` `[554]` `C:medium` `V:durable`
- **Claim.** That article benchmarked a dozen or more processors across AM4, AM5 and LGA 1700, but **only the Ryzen 7 5800X received a memory-integrity on/off comparison**; the Zen 4 parts in the same article (7950X3D, 7950X, 7900X3D, 7900X, 7800X3D, 7700X) and the 5800X3D ran with the feature enabled throughout, so the article supports no Zen 3 versus Zen 4 statement about this cost.  `[no-spec]` `[554]` `C:medium` `V:durable`
- **Claim.** The measurement is a media benchmark (Tier-3) and is quoted attributively; the article does not publish RAM timings, the Windows build or the graphics driver revision, so one of the five mandatory fields of §18.1 is missing and the figure may not be promoted to a platform constant.  `[no-spec]` `[554]` `C:medium` `V:durable`
- **Claim.** The toggle in that test is **memory integrity alone**, with kernel isolation left on in both arms — so the 6% figure is the marginal cost of code-integrity enforcement on a machine that already has the hypervisor resident, and it does **not** include the whole-machine nested-paging term of §18.2.1. A reader asking "what do I get back by turning all of this off" is asking about a larger number that this article does not measure.  `[no-spec]` `[554]` `C:medium` `V:durable`

### 18.2.3 The figures this chapter refuses to carry

- **Claim.** The widely relayed ranges "5–10% system-wide" and "5–25% in games" for virtualization-based security have **no traceable primary source** in this knowledge base: they appear in secondary write-ups without hardware, workload, or a statement of which setting was toggled. They are recorded as unresolved rather than averaged with the 6% figure above.  `[no-spec]` `[554]` `C:low` `V:durable`
- **Claim.** Because a GPU-bound test can hide a processor-side regression entirely, a frame-rate delta measured at high resolution and a CPU-side overhead figure are not comparable quantities, which alone explains part of the spread between circulating numbers.  `[no-spec]` `[554]` `C:medium` `V:durable`

### 18.2.4 Why the same setting costs different amounts on two AMD machines

Three machine properties move this result more than the setting does, and none of them is visible in the setting itself.

The first is **how often the lengthened walk is actually paid**. The dominant term is a two-dimensional page walk that only costs anything on a TLB miss, so a workload with a small resident set can lose nothing at all while a pointer-chasing workload on the same processor loses measurably. The second is **page size**: a workload backed by 2 MB pages on both dimensions shortens the walk itself, which is why the same toggle measured on two systems with different large-page availability is not the same experiment. The third is **whether the part has the execute-trap extension**, because without it the same protection is emulated by a more expensive software path.

- **Claim.** A measurement of this feature is therefore as much a measurement of one machine's memory behaviour as of the feature, which is sufficient by itself to explain why two correctly-run tests of "the same" configuration differ by more than the effect being measured.  `[no-spec]` `[56][554]` `C:medium` `V:durable`
- **Claim.** What a usable figure must state, at minimum: the processor and its generation; the graphics card and whether the test was processor-bound at the settings used; the exact title or benchmark, resolution and quality settings; which setting was toggled — memory integrity alone, the full security feature set, or the hypervisor entirely; whether large pages were available to the affected workload; and the Windows build.  `[no-spec]` `[42][554]` `C:high` `V:durable`

---

## 18.3 WSL2 and utility VMs

- **Claim.** A utility VM such as the one backing WSL 2 is a partition: it holds memory, its virtual processors are scheduled against the host's, and its I/O crosses a synthetic-device boundary, so its cost is present whenever it is running rather than only when the user interacts with it.  `[no-spec]` `[44][560]` `C:high` `V:durable`
- **Claim.** The costs Microsoft documents for this class are memory residency and cross-OS file-system access rather than processor overhead, because guest compute runs in guest mode at native speed while every file operation crossing between the Windows and Linux file systems traverses the synthetic transport.  `[no-spec]` `[560]` `C:medium` `V:durable`
- **Claim.** **No measurement of WSL 2, Windows Sandbox or a Windows container backend on an AMD part, carrying processor, workload and configuration, is recorded in this knowledge base.** The mechanism above is what can be stated; a percentage cannot.  `[no-spec]` `[560]` `C:high` `V:durable`
- **Claim.** The nearest quantified analogue in this chapter is the confidential-VM network result of §18.7.2 and §18.7.3, where a copy-through guest/host data path costs 21% of throughput once the processor saturates and nothing at all while the link is the bottleneck — the same shape a host-to-guest file-system crossing has, though measured on a Linux server stack and not on Windows.  `[no-spec]` `[550][551]` `C:medium` `V:durable`

### 18.3.1 The cost that is charged before the utility VM starts

The most common error in reasoning about WSL 2 on a Windows PC is to treat its cost as the cost of the Linux guest. On an AMD machine the larger term usually arrives earlier.

- **Claim.** Enabling a utility-VM feature enables the hypervisor, and from that point the Windows kernel itself runs as a guest with nested paging active machine-wide — so the whole of §18.2.1 is charged to every process on the box, including ones that never touch the utility VM, and is charged whether or not the utility VM is running.  `[no-spec]` `[42][44]` `C:high` `V:durable`
- **Claim.** A measurement that compares "WSL 2 installed" against "WSL 2 not installed" on a machine that had no other hypervisor-backed feature enabled is therefore measuring two things at once, and its result is not the cost of WSL 2; separating them requires a third configuration with the hypervisor present and the utility VM absent.  `[no-spec]` `[42][560]` `C:high` `V:durable`

---

## 18.4 Third-party VMMs: WHP versus bare SVM

- **Claim.** When a third-party VMM runs through the Windows Hypervisor Platform its guest is a Hyper-V partition, so each intercepted event is processed twice — the hardware exits to the Windows hypervisor, which decides whether it owns the event, and only then is an exit context handed to the user-mode VMM. That is one more boundary crossing per event than a VMM that owns `EFER.SVME` itself pays; the ownership question is `16-windows-platform.md`.  `[no-spec]` `[561][47]` `C:high` `V:durable`
- **Claim.** The same arrangement removes the VMM's ability to program its own VMCB intercept vectors, so optimisations that depend on intercepting less, or on a feature the platform API does not expose, are unavailable regardless of what the silicon supports.  `[no-spec]` `[561]` `C:high` `V:durable`
- **Claim.** Both major third-party vendors state the direction qualitatively and neither publishes a figure: Broadcom documents the platform-API path for VMware Workstation Pro as giving slower virtual machines with no nested virtualization, no performance counters and no RTM/HLE or PKU, and Oracle still labels the VirtualBox equivalent experimental with a performance warning. These are **vendor statements, not measurements**; the feature list itself is owned by `16-windows-platform.md`.  `[no-spec]` `[47][48]` `C:high` `V:durable`
- **Claim.** **No public measurement of the resulting difference on an AMD machine, carrying processor, guest workload and configuration, is recorded here.** The direction follows from the mechanism; the magnitude does not.  `[no-spec]` `[47][48]` `C:high` `V:durable`

This is the clearest case in the chapter where the honest answer is a mechanism plus an explicit "no measured figure". The temptation to supply a percentage is strongest exactly where users most want one.

### 18.4.1 The experiment that would settle it

The comparison is harder to run than it looks, because the two arms differ in more than one variable. A VMM that owns `EFER.SVME` runs on a machine with no hypervisor resident, so its baseline also lacks the machine-wide nested-paging cost of §18.2.1; a VMM over the platform API runs on a machine that has it. A difference measured between those two arms therefore contains both terms.

- **Claim.** A defensible design needs three configurations, not two — the VMM owning SVM directly on a machine with the hypervisor off, the same VMM over the platform API with the hypervisor on, and a hypervisor-on machine running no guest at all as the baseline for the whole-machine term — together with an exit-rate counter for the guest workload, because the platform-API penalty is charged per intercepted event and scales with exit density rather than with wall-clock time.  `[no-spec]` `[561]` `C:medium` `V:durable`
- **Claim.** Until such a measurement exists, the only quantitative statement this chapter supports about the platform-API path is the count of boundary crossings per intercepted event, which is one more than the direct path, and the exit-reason profile of §18.7.1 is the only public data showing how many such events a real workload generates.  `[no-spec]` `[553][561]` `C:medium` `V:durable`

---

## 18.5 Nesting on a PC

### 18.5.1 What the public record actually covers

- **Claim.** The Turtles project reported that nested virtualization can come "within 6-8% of single-level (non-nested) virtualization for common workloads"; that sentence is the paper's abstract-level summary, and it is **not** a per-benchmark result.  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** The paper's measured macro-benchmark overheads relative to a single-level guest are **14.5% for kernbench and 7.82% for SPECjbb**, falling to **10.3% and 6.3%** once the Intel-specific `VMREAD`/`VMWRITE` emulation cost in the middle hypervisor is discounted.  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** In the same measurement the outermost hypervisor consumed **2.28% of overall cycles** in the single-level case and **5.17%** in the nested case for kernbench — more than twice the work for the same guest workload.  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** The conditions are an IBM x3650 booted with **a single Intel Xeon 2.9 GHz core** and 3 GB of memory, Ubuntu 9.04 on a kvm-87-based kernel at all three levels, 2010. **This is an Intel VMX measurement; the paper contains no SVM measurement at all.**  `[no-spec]` `[555]` `C:high` `V:durable`

### 18.5.2 Why there is no AMD number, and what can honestly be said instead

- **Claim.** The same paper argues on mechanism that AMD should pay less: under SVM the guest and host control blocks are read and written with ordinary loads and stores, so the outer hypervisor does not intervene while the middle hypervisor edits the innermost guest's control block, which removes the trap-and-emulate cost that the 14.5% → 10.3% gap measures. `15-nested-virtualization.md` owns that mechanism.  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** That reasoning makes **10.3% a bracket, not an AMD result**: it is an Intel measurement with one Intel-specific term subtracted, on 2010 hardware, and it must never be quoted as "nested SVM costs about 10%".  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** Nested SVM in KVM was contributed concurrently with the Turtles work by Alexander Graf and Joerg Roedel; multi-dimensional paging was ported to it, but multi-level device assignment was not, so even the qualitative feature parity the paper describes is incomplete on the AMD side.  `[no-spec]` `[555]` `C:high` `V:durable`
- **Claim.** **No measurement of nested virtualization on any AMD part — server or client — carrying microarchitecture, hypervisor version and benchmark is recorded in this knowledge base.** Reporting that gap is the correct answer to "what does nesting cost on my Ryzen".  `[no-spec]` `[41][555]` `C:high` `V:durable`

### 18.5.3 Where nesting and the platform API compound

- **Claim.** On a Windows PC the nested configuration is also the configuration in which a third-party VMM runs inside a Hyper-V child partition rather than over the platform API, so the costs of §18.4 and §18.5 are paid together; Microsoft's prerequisites for that configuration are owned by `16-windows-platform.md`.  `[no-spec]` `[41][47]` `C:high` `V:durable`
- **Claim.** What decides the outcome is exit **density**, not exit **cost**: a workload that rarely triggers an intercept pays the nesting tax rarely, which is why published nested figures range from single-digit percentages to multiples on the same hardware.  `[no-spec]` `[555]` `C:high` `V:durable`

---

## 18.6 Nested paging and large pages

On any machine with a hypervisor-backed Windows feature enabled, this section describes the whole machine.

### 18.6.1 What nested paging removes

- **Claim.** VMware measured nested paging on AMD — which it calls Rapid Virtualization Indexing — delivering "performance gains of up to 42% for MMU-intensive benchmarks and up to 500% for MMU-intensive microbenchmarks"; the 42% case is the Apache compile workload at four vCPUs and Citrix XenApp gained approximately 29%.  `[no-spec]` `[552]` `C:high` `V:durable`
- **Claim.** The conditions matter more than the headline: a Dell PowerEdge 2970 with two quad-core **Opteron 8384 ("Shanghai")** and 32 GB, **ESX 3.5 Update 2**, document revision 20090311. The baseline is **the binary-translation VMM**, which VMware chose because that release supported AMD-V only together with nested paging — so the comparison is nested paging against software shadow paging, and not against AMD-V with shadow paging.  `[no-spec]` `[552]` `C:high` `V:durable`
- **Claim.** The same document records the other side of the trade in AMD's own hardware terms: "although RVI increases memory access latencies for a few workloads, this cost can be reduced by effectively using large pages in the guest and the hypervisor", and it calls large-page use in the guest "imperative" for TLB-intensive workloads such as SPECjbb2005.  `[no-spec]` `[552]` `C:high` `V:durable`

### 18.6.2 What nested paging adds

- **Claim.** AMD's own architects measured nested walks as **3.9–4.6 times slower on average than native walks**, with neither side using page-walk caching, and reported that unvirtualized server and SPEC applications outperform the virtualized versions **by 20–70%** in that no-caching configuration.  `[no-spec]` `[56]` `C:high` `V:durable`
- **Claim.** Those figures come from a **cycle-accurate simulator validated against silicon and modelling the Quad-Core AMD Opteron microarchitecture**, driven by retired-instruction traces — not from measurements on a shipping machine — and were published at ASPLOS'08, March 2008. The reference count behind them belongs to `06-nested-paging.md`.  `[no-spec]` `[56]` `C:high` `V:durable`
- **Claim.** The same study quantifies the three hardware and software remedies separately: extending the page-walk cache to the nested dimension recovers **15–38%**, adding a nested TLB a further **3–7%** (up to 46% combined against no page-walk caching), and the hypervisor using large nested pages another **3–22%**.  `[no-spec]` `[56]` `C:high` `V:durable`
- **Claim.** Oracle's VirtualBox manual gives a far more conservative figure for the last lever on shipping hardware: with nested paging enabled, large pages "can yield a performance improvement of up to 5%". The two are not in conflict — see §18.8.  `[no-spec]` `[557]` `C:medium` `V:durable`

### 18.6.3 Telling which side a workload is on

The two results in §18.6.1 and §18.6.2 look like a disagreement and are actually a classification. Nested paging wins when the rate of guest page-table updates dominates, because each one used to cost an intercept; it loses when the TLB miss rate dominates, because each miss now walks two hierarchies. Both failure modes are directly observable.

- **Claim.** A workload on the shadow-paging-limited side shows a high `#VMEXIT` rate attributable to guest page-table writes, CR3 loads and page invalidations; a workload on the walk-limited side shows few exits, a high TLB miss rate, a large fraction of cycles in page walks, and improves when either dimension is backed by larger pages. The intercepts themselves are `03-intercepts.md` and the invalidation instruction is `06-nested-paging.md`.  `[no-spec]` `[552][56]` `C:medium` `V:durable`
- **Claim.** On a Windows PC with a hypervisor-backed feature enabled there is no choice to make between the two: the hypervisor is present for isolation, nested paging is how it isolates, and shadow paging is not an option the user can select. The classification is therefore diagnostic rather than a tuning decision.  `[no-spec]` `[42]` `C:high` `V:durable`

### 18.6.4 Large pages under memory encryption

- **Claim.** The large-page lever weakens under SEV-SNP for a structural reason rather than a measured one: the reverse map describes pages at 4 KB or 2 MB only, and with SEV-SNP enabled an access to a 1 GB nested page installs only a 2 MB TLB entry — the rule itself is owned by `14-sev-snp.md`. A 1 GB host mapping therefore buys nothing beyond 2 MB on the nested dimension.  `[no-spec]` `[1]` `C:high` `V:durable`
- **Claim.** No measurement isolating the cost of that restriction is recorded here; the boot-time and memory-population figures of §18.7.2 and §18.7.3 are the closest observable consequences.  `[no-spec]` `[550][551]` `C:medium` `V:durable`

### 18.6.5 The intercept-tuning knobs, and the only published defaults

The PAUSE filter is the one intercept whose tuning is routinely asked about. AMD publishes no recommended pair; the mechanism is owned by `03-intercepts.md`, and the only public defaults are the hypervisor's.

- **Claim.** Linux KVM's SVM defaults are `pause_filter_thresh` = **128** cycles and `pause_filter_count` = **3000**, with the per-vCPU window doubling on each filtered exit (`grow` = 2), resetting to the base count on shrink (`shrink` = 0) and capped at 65535; the corresponding Intel default window in the same tree is 4096.  `[no-spec]` `[558]` `C:high` `V:durable`
- **Claim.** These are software defaults chosen by kernel developers, not hardware-recommended values, and they carry no published benchmark justification; the current value is version-bearing and any statement about it must name a kernel revision.  `[no-spec]` `[558]` `C:high` `V:durable`

### 18.6.6 Three figures this chapter deliberately does not carry

- **Claim.** "Nested paging is up to 23% faster than shadow paging" is a **2008 AMD marketing figure** relayed by AnandTech and then by a Chinese-language blog transcript, from which the pre-rebuild corpus took it and restated it as a measurement. Neither relay is admissible here: the transcript sits on a host this skill blacklists, and anandtech.com ceased publication in 2025 — its article URLs now redirect to the site's forums, so the original could not be re-read.  `[no-spec]` `[556]` `C:low` `V:durable`
- **Claim.** "Nested paging typically gains 15–30%" has **no source at all**: it was a synthesis written by the previous author, and the limitations paragraph of that same chapter contradicted it. It is recorded in `errata.md` as an open conflict and is dropped here.  `[no-spec]` `[556]` `C:low` `V:durable`
- **Claim.** "Large pages give memory-intensive workloads 10–30%" traced to a hosting-provider marketing page that this skill blacklists. The defensible figures for the same lever are the 3–22% and the up-to-5% of §18.6.2, each with its own baseline and era.  `[no-spec]` `[56][557]` `C:high` `V:durable`

---

## 18.7 Server measurements (out of client scope)

Everything in this section was measured on EPYC. It is kept because chapters `07`, `12`, `13` and `14` cross-reference it rather than restating figures, and because §18.8 needs it. **None of it describes a client Ryzen PC**, and none of it should be relayed as if it did.

### 18.7.1 AVIC and the exit profile (Zen 4 Genoa, 2024)

The mechanism is `07-virtual-interrupts-avic.md`; the measurement is Oracle's, on a cloud bare-metal instance.

- **Claim.** On an OCI BM.Standard.E5.192 bare-metal instance — a two-socket Zen 4 EPYC (Genoa) platform whose SKU the post does not name — running a 16-vCPU, 64 GB Oracle Linux 8.6 guest under `sysbench threads --threads=16 --thread-locks=8 --time=20`, `perf kvm stat` over a 20-second window counted **23,718,962** exits with AVIC off and **1,049,506** with AVIC on: approximately a **96% reduction**; published 2024-03-28.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** The same post states explicitly that a 96% drop in exit count "will not translate to a 96% improvement in performance for the benchmark, which would only be the case for a workload that is fully bottlenecked due to VM-Exit and interrupt injection latency" — the most important sentence in the measurement.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** With AVIC disabled the exit profile of that workload was dominated by two reasons: external interrupts at 10,980,413 samples (46.29%) averaging **0.82 µs** of handling time and MSR intercepts at 10,748,435 samples (45.32%) averaging **0.56 µs**; virtual-interrupt-window exits accounted for 8.38% at 0.74 µs, nested page faults for 1,961 exits at 1.10 µs, and HLT for 740 exits at 764.07 µs.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** Two properties of that table are easy to misread. The times are **`perf kvm` handler averages including the host-side handler**, not hardware world-switch latencies, and the profile is a property of this one benchmark: 91.6% of the exits are interrupts plus MSR accesses because the workload is a lock-contention microbenchmark.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** On the same platform the `kvm-unit-tests` `vmexit.flat` IPI test, averaged over 20 runs with a split irqchip, reported **5708 cycles** with AVIC disabled and **3027 cycles** with AVIC enabled, a **47% reduction**. This is the most recent cycle-level AMD figure in this chapter, and it measures IPI delivery, not a world-switch round trip.  `[no-spec]` `[553]` `C:high` `V:durable`
- **Claim.** AVIC exists on client parts as well, but **no client-side measurement of it is recorded here**, and whether a given kernel enables it by default is version-bearing and belongs to `90-dated-landscape.md`.  `[no-spec]` `[553]` `C:medium` `V:durable`

### 18.7.2 The three SEV generations (Milan, 2023)

- **Claim.** Yan and Gopalan measured all three SEV generations against a non-confidential VM on **two EPYC 7763 (Milan)** with 256 GB, Linux 5.19-rc6 v4 and QEMU-6.1.50-snp-v3 from AMD's branches, SEV firmware 1.53 build 5, with VMs pinned to avoid cross-die traffic; MASCOTS 2023.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Processor-bound work was almost unaffected: Sysbench lost **less than 1%** in the worst case (SEV-SNP, Large VM) and the 7-Zip LZMA benchmark, which is sensitive to cache and memory latency, lost **up to 1.5% on SEV and up to 2.5% on SEV-ES and SEV-SNP**.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Pure memory bandwidth cost **up to 4.3%** on a Medium VM (STREAM Scale, Triad and Add), similarly across all three generations; the Large VM showed a smaller relative loss only because its absolute throughput is about three times higher.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** The cost concentrates in I/O. On a Medium VM with FIO at 4 KB, queue depth 128, 75% random read / 25% random write against a 143.6K/47.9K IOPS baseline, **SEV-ES was the worst configuration of the three, losing 56% of disk read and write performance** — the paper attributes this to the `#VC` handler and the guest/host communication block round trip, whose mechanism is `13-sev-es-ghcb.md`. SEV-SNP's reverse-map checks are therefore not the dominant disk-I/O term.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Network cost depends entirely on where the bottleneck sits: over a real 10 Gbps link every configuration including the non-confidential VM reported the same 9.4 Gbps TCP and 2.3 Gbps UDP, and only when the test was moved to a host loopback bridge — raising the baseline to 65.13 Gbps TCP — did all three SEV settings show **about 36%** TCP degradation, with UDP losing only 3–4%.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Redis, a mixed memory and network workload, lost about 9% on writes and 8% on reads under SEV alone, rising to **up to 14% on writes and 12% on reads** under SEV-ES and SEV-SNP — measured on the **Small** VM, which the pre-rebuild corpus omitted when it quoted "14.1%".  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Boot time and footprint are the capacity-planning terms. Boot time for Small / Medium / Large VMs went from 7.79 / 7.76 / **12.90 s** for a general VM to 10.01 / 10.53 / 19.76 s under SEV, 14.91 / 14.50 / 25.87 s under SEV-ES and 15.97 / 15.52 / **30.26 s** under SEV-SNP; resident memory went from 1.28 / 1.49 / ~4 GB to 4.03 / 14.05 / 120.08 GB, because encrypted memory is reserved in advance and cannot be de-duplicated.  `[no-spec]` `[551]` `C:high` `V:durable`

### 18.7.3 SEV-SNP against Intel TDX (EPYC Genoa versus 5th Gen Xeon, 2024)

- **Claim.** Misono et al. compared the two on **one EPYC 9654P (96 cores, 4th Gen)** for SEV-SNP and **two Xeon Platinum 8570 (5th Gen)** for TDX, Linux 6.8 and QEMU 8.2 from each vendor's branch, SEV firmware 1.55.30, with hyper-threading and frequency scaling disabled and vCPUs pinned; published December 2024.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Instructions that entail a `#VMEXIT` were on average **240% slower in an SEV-SNP guest** than in a normal VM on the same host, against **472%** for a trust domain on the Intel host. Both are ratios against each machine's own baseline, plotted in nanoseconds, and the paper publishes no cycle count for either baseline.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** The paper notes that a normal VM on its Intel machine performed considerably better than a normal VM on its AMD machine, which inflates the TDX ratio; the two percentages therefore **cannot be read as an AMD-versus-Intel ranking**. The cross-vendor framing belongs to `19-comparison-intel-arm-riscv.md`.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** An SEV-SNP guest avoids some of this by construction: the launch-time CPUID page lets the guest answer `CPUID` leaf 0x40000000 inside its own exception handler without calling the host at all.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Memory results disagree by benchmark within the same paper. Intel MLC peak injection bandwidth gave SEV-SNP overheads of 3.90, 3.98, 9.08, 0.416 and 1.96% for all-reads, 3:1, 2:1, 1:1 and stream-like patterns — **average 2.88%**, against **7.86%** for TDX. The Phoronix memory test suite on the same machines reversed the ordering: **7.29% for SEV-SNP against 4.06% for TDX**. Idle random-read latency rose by 16 ns on both.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Memory acceptance is a one-time cost: populating a 32 GB mapping for the first time took **28.11 s in an SEV-SNP guest against 17.64 s in a normal VM (+59%)**, while the second population of already-accepted memory was within 5% of the normal VM.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Boot time for 8 vCPUs and 64 GB was **102% longer than a normal VM on kernel 6.8 and 231% longer on kernel 6.9** for SEV-SNP, against 394% for a trust domain — two kernels giving a factor-of-two difference on the same silicon, which is why a boot-time figure without a kernel version is meaningless.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Application-level costs above 10% were confined to three cases: UnixBench "Process" at **16%** for SEV-SNP (11% for TDX), NPB under OpenMP with `OMP_WAIT_POLICY=PASSIVE` at **+41%** execution time on average (+73% for TDX, worst single kernel "ua" at +431% on the Intel side), and TensorFlow BERT inference on the largest VM at **16%** (18% for TDX). The common cause is HLT exits from frequent sleep and wake-up.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Storage was nearly free at the offered load — **4.6% on bandwidth and 2.9% on IOPS** for SEV-SNP with virtio-blk over an NVMe device — but the paper states plainly that FIO did not reach the device's maximum and the workload was not processor-bound, which is the condition under which the result holds.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Network cost appears only under processor saturation: on the AMD machine iperf3 TCP with 8 queues reached 90 Gbps at about 40% guest CPU with vhost, while the bounce-buffered and SEV-SNP configurations lost **19% and 21%** at 100% CPU utilisation; the Intel equivalents lost 57% and 60% from a 302 Gbps baseline.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Guest-side halt polling is the documented mitigation for the HLT term, trading host CPU time for latency; the Linux default poll window is **200000 ns**.  `[no-spec]` `[559]` `C:high` `V:durable`

### 18.7.4 One-off costs that are not throughput

Two confidential-VM costs are paid once rather than per operation, and they are routinely quoted as if they were overheads.

- **Claim.** Obtaining an attestation report took **6.19 ms on average for SEV-SNP** and 2.75 ms for a trust domain; it is the slowest of the attestation primitives measured and is still a start-up cost rather than a steady-state one. The report format itself belongs to `14-sev-snp.md`.  `[no-spec]` `[550]` `C:high` `V:durable`
- **Claim.** Resident-memory inflation is a consolidation constraint rather than a per-VM slowdown: encrypted guest memory is reserved and encrypted in advance regardless of use and cannot be de-duplicated by same-page merging, which is what turns a 1.49 GB general VM into a 14.05 GB SEV VM at the same nominal size.  `[no-spec]` `[551]` `C:high` `V:durable`
- **Claim.** Neither figure belongs in an answer about steady-state throughput, and neither has a client-part equivalent, because SEV-SNP has never been available on a client part (`11-memory-encryption.md`).  `[no-spec]` `[550][551]` `C:high` `V:durable`

---

## 18.8 Conflicting measurements

Where two credible sources disagree, both appear with their conditions. Averaging them produces a number nobody measured.

**1. Nested paging: +42% versus walks 3.9–4.6× slower.**
Not a contradiction, and the same trade seen from two ends. `[552]` measures workloads where shadow-page-table synchronisation dominates, so removing it wins big; `[56]` measures the TLB-miss path that nested paging lengthens. Which side a workload lands on is decided by its ratio of page-table updates to TLB misses. Neither source licenses a single "typical gain".

**2. Large pages: 3–22% versus up to 5%.**
Different baselines and different eras. `[56]` compares a simulated Opteron using large nested pages against the same machine using four-level nested paging throughout, in 2008. `[557]` describes the incremental gain a shipping hypervisor sees from switching large pages on when nested paging is already configured.

**3. SEV-SNP versus Intel TDX memory overhead — opposite signs inside one paper.**
`[550]` reports SEV-SNP at 2.88% and TDX at 7.86% with Intel MLC, and SEV-SNP at 7.29% against TDX at 4.06% with the Phoronix memory suite, on the same two machines in the same study. The sign depends on the access pattern, so **neither ordering generalises** and a single "confidential-VM memory overhead" number does not exist. `errata.md` `O3` records this as open; the resolution offered here is that the disagreement is between benchmarks, not between papers.

**4. SEV-ES worse than SEV-SNP on disk I/O.**
`[551]` names SEV-ES "the worst performance of all tested setups" at a 56% loss in disk read and write, which puts SEV-SNP no worse than it; the paper states SEV-ES's figure in prose and leaves the other two to a figure, so only the ordering is quotable. The ordering is the expected one once the mechanism is read correctly: the dominant term is the exception-handler and shared-buffer round trip that SEV-ES introduces and SEV-SNP inherits rather than adds to. The reverse-map checks are therefore not the dominant disk-I/O cost.

**5. Confidential-VM network cost: 36% versus 0% versus 21%.**
`[551]` saw 36% over a host loopback bridge and **no difference at all** over a physical 10 Gbps link, because the link was the bottleneck. `[550]` saw 21% on a 90 Gbps local path at full processor utilisation. All three are correct; the variable is whether the processor or the wire saturates first. This is the clearest example in the chapter of a figure that inverts when a single condition changes.

**6. Virtualization-based security: 6% versus 5–10% versus 5–25%.**
Unresolved and recorded as unresolved (§18.2.2, §18.2.3). Only the first has a named processor, a named GPU, a resolution and a date. The other two have none of those and are not averaged into "about 10%".

**7. Nested virtualization: "6–8%" versus 14.5%.**
Both from `[555]`. The first is the abstract's summary across common workloads; the second is the measured kernbench figure against a single-level guest. Quote the one that matches the question, and name which.

**8. Boot-time overhead: +102% versus +231% on the same processor.**
`[550]` measured both, changing only the guest kernel (6.8 against 6.9, the latter using a different memory-initialisation scheme). A confidential-VM boot figure without a kernel version is therefore uninterpretable.

---

## 18.9 Open items

**Figures dropped in this rewrite for want of provenance.** Each was carried by the pre-rebuild chapter and is not reproduced above: "nested paging is up to 23% faster than shadow paging" (§18.6.6); "nested paging typically gains 15–30%" (§18.6.6); "large pages give memory-intensive workloads 10–30%" (§18.6.6); "not pinning vCPUs is about 3× slower" (a forum posting, no method, no parts named); "about 5% DMA overhead" (a container-platform blog post, no method); a vendor's "really close to zero" for SEV and SEV-ES after tuning (a qualitative statement, listed in the old chapter alongside measurements); and "#VC plus the guest/host communication block amplify exit cost up to 6.8×" — that multiplier appears nowhere in the paper it was attributed to, whose figures are +240% for SEV-SNP and +472% for TDX.

**Gaps this chapter reports rather than fills.**

- **Claim.** As of 2026-09-26, and across the sources surveyed for this chapter, there is no public cycle-level figure for the AMD world switch on any microarchitecture, no client-part measurement of AVIC, no AMD measurement of nested virtualization, no measurement of a third-party VMM over the Windows platform API against bare SVM, and no measurement of WSL 2 or Windows Sandbox on an AMD part. Most of the questions this chapter is asked have a mechanism answer and no numeric answer, and saying so is the deliverable. This is an absence of published measurement, not a claim that none was ever made.  `[no-spec]` `[553][555][560]` `C:high` `V:durable`
- **Claim.** The Microsoft Learn pages cited for the Windows-side mechanisms (`[42]`, `[560]`, `[561]`) **could not be re-read during this rewrite** — learn.microsoft.com was unreachable from the authoring environment on 2026-09-21 — so those three claims rest on URLs verified in `references/intel/17-windows-platform.md` rather than on a fresh read, and carry `C:medium` where the exact wording matters.  `[no-spec]` `[42][560][561]` `C:medium` `V:durable`
- **Claim.** Only one measurement in this chapter was taken on a client part at all: the 2023 Ryzen 7 5800X gaming test of §18.2.2. Everything else is a server, a simulator or a 2010-era single-core workstation, and the client relevance of each has to be argued rather than assumed.  `[no-spec]` `[554]` `C:high` `V:durable`

**Procedure for answering a performance question.**

1. Decide which quantity is being asked about — a world switch, one exit handled end to end, or a whole-workload delta. Most confusion dissolves here.
2. If the question is "what does this feature cost on my PC", answer with the mechanism (§18.2.1, §18.3, §18.4) and say plainly which parts have no measured figure.
3. If the question wants cycles for any AMD part, the answer is that no such published measurement exists (§18.1.2). Do not convert the microsecond averages of §18.7.1 into cycles.
4. Never average conflicting figures; use §18.8 and give both with their conditions.
5. Send vendor claims, product defaults and anything with an expiry date to `90-dated-landscape.md`.
6. Anything measured on EPYC stays labelled as measured on EPYC (§18.7).
