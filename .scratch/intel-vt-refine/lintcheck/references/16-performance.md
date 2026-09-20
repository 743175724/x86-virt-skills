# 16. Performance on a Windows PC: Measured Costs and the Conditions They Were Measured Under

> **中文速览**：本章收录与 Windows PC 相关的虚拟化开销数据，规则只有一条——**每个数字必须带测量条件**（微架构、软件与配置、基准、年份、以及这个数字到底在测什么）。没有条件的数字比没有数字更糟，因为它会被当成普适常数。本章先给出所有开销的共同底层项（VM-exit 的"裸往返"与"端到端"成本之别，以及**2010 年之后再无公开周期级测量**这一事实），再依次处理 PC 上真正会遇到的四类开销：VBS/内存完整性、WSL2 等工具 VM、第三方 VMM 经 WHP 运行相对直接用 VMX、以及 PC 上的嵌套虚拟化；随后是 EPT 两面性（在开了 VBS 的机器上，EPT 对**整台机器**生效）与投机执行缓解措施代价。§16.11 并列冲突来源并解释差异，**从不取平均**。游戏帧率那三个广为流传的 VBS 数字（6% / 5–10% / 5–25%）在本章按"未经核实、条件缺失"处理。

**Maps to:** no single Intel specification chapter. This chapter is measurement literature; Intel anchors appear only where an architectural mechanism is named, and the mechanism itself is defined in chapters 01–14.
**Owns:** every quantitative performance figure in this skill, together with the conditions under which it was measured.
**See also:** `06-address-translation.md` (EPT) · `07-apic-virtualization.md` (APICv, posted interrupts) · `14-nested-virtualization.md` (nested mechanism) · `15-security.md` (the Windows security features whose cost is discussed here) · `17-windows-platform.md` (the platform these numbers describe) · `90-dated-landscape.md` (vendor claims, product status, defaults).

---

## 16.1 The contract for every number in this chapter

A virtualization overhead figure is meaningless without five pieces of context:

1. **Microarchitecture** — VMX transition cost changed by a factor of roughly four across the first three generations, so "a VM exit costs N cycles" is a statement about a specific part.
2. **Software and configuration** — most of the cost of an exit is the handler, and on a PC the relevant configuration is *which* hypervisor-backed features are switched on.
3. **Benchmark and parameters** — title, resolution, I/O size, concurrency, page size and SMT state each move results by more than the effect being measured.
4. **Year** — the software stack under most of the classic figures is a decade old.
5. **Measurement definition** — above all, *what was timed*: a bare hardware round trip, an exit handled end to end, or a whole-workload delta.

Point 5 is the single most common source of error in secondary literature. This chapter records the definition alongside the number in every claim and refuses to collapse two definitions into one figure.

### 16.1.1 The record template

Every figure below is written so that it can be re-quoted without losing its conditions:

| Field | Why it is mandatory |
|---|---|
| what was measured | bare VMX round trip, end-to-end exit handling, or a whole-workload delta |
| microarchitecture or platform | transition cost and cache behaviour are generation properties |
| software and configuration | which hypervisor, which features enabled, which build |
| benchmark and parameters | the settings that dominate the result |
| year | the stack under most classic figures is a decade old |

Where a source omits one of these fields, the omission is recorded in the claim rather than quietly filled in. Several sources in this chapter are quoted precisely so that their missing conditions are on the record: `[416]` carries no date and no hardware, `[422]` carries no method at all, and `[426]` is a second-hand report of a benchmark this knowledge base has not read.

A number quoted without its conditions does not become "approximately right"; it becomes a false universal.

---

## 16.2 The term underneath everything: VM-exit and VM-entry cost

Every figure later in this chapter — the cost of memory integrity, of a utility VM, of a VMM running on the Windows Hypervisor Platform — is ultimately a count of boundary crossings multiplied by the cost of one. This section fixes what "the cost of one" means.

### 16.2.1 Two different quantities

- **Claim.** A VM exit saves guest state to the VMCS guest-state area and loads host state from the host-state area, which is why the hardware round trip has a fixed cost independent of what the hypervisor then does; see `05-vm-exit.md`.  `[SDM 3C Ch.30]` `[1]` `C:high` `V:durable`
- **Claim.** "VM-exit cost" in the literature denotes either the bare hardware round trip (VM exit plus VM entry, no handler) or the end-to-end cost of handling one exit (transition plus decode, emulation and any resulting I/O); the two differ by a factor of several and must never be quoted interchangeably.  `[400][402]` `C:high` `V:durable`

> This distinction is recorded as an erratum: see `errata.md`. The frequent failure mode is quoting a bare-transition figure (hundreds of cycles) as the cost of handling an exit, or an end-to-end figure (thousands of cycles) as a hardware property.

### 16.2.2 First-generation VT-x (2006)

- **Claim.** Adams and Agesen measured a VM entry at 2409 cycles on a 3.8 GHz Pentium 4 672 and at 937 cycles on a 2.66 GHz Core 2 Duo; conditions: HP xw4300 workstation, VMware Player 1.0.1 built with both a binary-translation VMM and a VT-x VMM, figure is the bare transition.  `[401]` `C:high` `V:durable`
- **Claim.** In the same measurement a page-fault VM exit cost 1931 cycles on the Pentium 4 672 and 1186 cycles on the Core 2 Duo (bare exit, not the handler).  `[401]` `C:high` `V:durable`
- **Claim.** In the same measurement a single `in` instruction under the VT-x VMM cost 15826 cycles end to end, because completing the I/O required a full round trip to the VMM; this is a whole-event figure, not a transition figure.  `[401]` `C:high` `V:durable`
- **Claim.** In the same measurement, handling one guest page fault cost 11242 cycles under the VT-x VMM, 3927 cycles under the binary-translation VMM and 1093 cycles natively — the result that made first-generation VT-x slower than software virtualization for MMU-heavy work, because that generation had no EPT.  `[401]` `C:high` `V:durable`

### 16.2.3 The Penryn → Nehalem → Westmere lineage (Intel, 2010)

- **Claim.** Intel reported a best-case round-trip latency (VM exit plus VM entry) of about 1100 clock cycles on the Penryn family, about 820 cycles on Nehalem (75% of Penryn) and about 650 cycles on Westmere (60% of Penryn), the Westmere reduction being attributed to VMCS caching.  `[400]` `C:high` `V:durable`
- **Claim.** Intel reported VMREAD latency falling from 174 cycles on Prescott to 7 cycles on Nehalem, which is why VMCS-field access stopped being a dominant term in exit handlers.  `[400]` `C:high` `V:durable`

> **Excerpt** `[400]`: "The best-case, round-trip latency (VM exit plus VM entry) on Nehalem is only about 75% (820 clock cycles) of that seen on the earlier Intel Penryn family of processors (1100 cycles). VMCS caching on Westmere reduces that latency to about 650 clocks—which translates to 60% of the latency on the Penryn family of processors."

Note "best-case": this is the floor of the hardware transition on an otherwise idle machine, not an expected value under load.

### 16.2.4 End-to-end handling cost (NOVA, 2010)

- **Claim.** In NOVA the average cost of handling one VM exit was approximately 3900 cycles, of which 1016 cycles (26%) were the guest/host mode transition itself and about 600 cycles (15%) were microhypervisor-to-VMM communication, leaving about 59% for instruction and device emulation; derived by dividing a 1.27 s difference by 867341 VM exits.  `[402]` `C:high` `V:durable`
- **Claim.** The NOVA figures were taken on Core 2 / Nehalem-generation hardware with the NOVA microhypervisor and its user-level VMM; this knowledge base does not record the exact part, so they should be treated as generation-level rather than part-level.  `[402]` `C:medium` `V:durable`

Even in a microhypervisor designed for short paths, the architectural transition is only about a quarter of the total. That ratio is the reason "reduce the number of exits" beats "make exits cheaper" as an optimisation strategy.

### 16.2.5 What this knowledge base does not have

- **Claim.** No public cycle-level VM-exit measurement for Ice Lake, Sapphire Rapids, Granite Rapids or any recent client part is recorded in this knowledge base; the newest hard cycle figure available here is the Westmere round trip published in 2010.  `[400]` `C:high` `V:durable`
- **Claim.** The most recent public measurement of modern Intel silicon recorded here expresses exit cost only as a ratio: a 2025 study reports VMEXIT latency in a confidential VM about 472% longer than in a regular VM on the same host, and about 240% longer for the AMD equivalent on its host, with no absolute cycle count for either baseline; see `18-comparison-amd-arm-riscv.md`.  `[500]` `C:high` `V:durable`

Stating this absence is more useful than extrapolating. A modern exit is certainly cheaper than Penryn's in cycles and certainly more variable — frequency scaling, hybrid core types, SMT, cache state, mitigations — and any extrapolation would be a fabricated number carrying the authority of a measured one.

### 16.2.6 Figures that circulate without a method

- **Claim.** Ranges of the form "CPUID/MSR 200–1000 cycles, page-table updates 500–2000, interrupt handling 500–5000, I/O 1000–10000" circulate in engineering blogs with no published measurement method, hardware or hypervisor; the orders of magnitude are consistent with `[401]` and `[402]`, but the table itself is not usable as evidence.  `[422]` `C:low` `V:durable`

### 16.2.7 The exit-cost figures in one table

| Figure | What it measures | Platform | Software | Year |
|---|---|---|---|---|
| 2409 cycles | VM entry, bare transition | 3.8 GHz Pentium 4 672 | VMware Player 1.0.1, VT-x VMM | 2006 |
| 937 cycles | VM entry, bare transition | 2.66 GHz Core 2 Duo | VMware Player 1.0.1, VT-x VMM | 2006 |
| 1931 / 1186 cycles | page-fault VM exit, bare transition | P4 672 / Core 2 Duo | same | 2006 |
| 11242 / 3927 / 1093 cycles | guest page-fault handling, end to end | first-generation VT-x | VT-x VMM / BT VMM / native | 2006 |
| 15826 cycles | one `in` instruction, end to end | first-generation VT-x | VT-x VMM | 2006 |
| ~1100 / ~820 / ~650 cycles | VM exit plus VM entry, best-case round trip | Penryn / Nehalem / Westmere | Intel measurement, no hypervisor named | 2010 |
| ~3900 cycles, of which 1016 transition | average end-to-end exit handling | Core 2 / Nehalem generation | NOVA microhypervisor | 2010 |
| +472% / +240% | VMEXIT latency ratio versus a non-confidential VM | server parts with confidential-VM support | Intel / AMD confidential VMs | 2025 |

The first seven rows are the entire public cycle-level record this knowledge base holds. There is no row for any client part, and no row for anything released after 2010.

### 16.2.8 Producing a number for your own machine

The absence of published figures for most Windows-side costs (§16.3, §16.4, §16.5) does not
make the question unanswerable; it makes it a measurement task. A result that satisfies this
chapter's contract needs:

1. **One variable at a time.** Toggling memory integrity is not the same experiment as
   disabling the hypervisor, because the second also removes the second-level translation
   cost that applies to the whole machine (§16.3.1).
2. **A workload that is bound by the thing being measured.** A GPU-bound game at high
   resolution will show nothing; a CPU-bound or syscall-bound workload will.
3. **Distributions, not means.** Virtualization overhead shows up in tail latency and frame
   times long before it moves an average.
4. **The full condition set of §16.1.1 recorded alongside the result**, including the build,
   because the same toggle is not the same feature set across builds.
5. **A stated measurement definition.** "Frames per second lost" and "cycles added per exit"
   are different quantities and cannot be compared.

- **Claim.** Any figure produced without step 1 is uninterpretable, because the two toggles remove different mechanisms: one removes code-integrity enforcement from VTL1, the other removes the hypervisor and with it the second-level translation that was active for every workload on the machine.  `[463][476]` `C:high` `V:durable`

---

## 16.3 What virtualization-based security costs on a client machine

This is the overhead most Windows PC users actually encounter, and it is the one with the worst public data.

### 16.3.1 Where the cost comes from

Four mechanisms, each of which can dominate depending on the workload:

- **Claim.** With the hypervisor resident, the Windows kernel runs in VTL0 as a guest, so operations that the hypervisor intercepts become exits that did not exist on the same machine with the hypervisor off; see `17-windows-platform.md` §17.1.  `[462][463]` `C:high` `V:durable`
- **Claim.** Second-level address translation is active for the whole machine, not only for virtual machines, so the two-dimensional page-walk cost quantified in §16.8.2 applies to ordinary desktop and game workloads on a machine with virtualization-based security enabled.  `[SDM 3C Ch.31]` `[1][463]` `C:high` `V:durable`
- **Claim.** Memory-integrity enforcement moves kernel code-integrity decisions into VTL1, so kernel page-permission changes require a transition to a more privileged level rather than a local page-table write; see `15-security.md`, which owns the feature.  `[463][483]` `C:high` `V:durable`
- **Claim.** Calls into the secure kernel are VTL transitions, which are hypervisor-mediated and therefore cost at least a round trip of the kind measured in §16.2; this knowledge base records no measurement of a VTL transition in cycles.  `[463]` `C:high` `V:durable`

The second mechanism is the one most often missed: the cost is not confined to code that interacts with the security feature. Every TLB miss on the machine is walked twice.

### 16.3.2 The three circulating figures, unreconciled

- **Claim.** Three figures for the cost of Windows virtualization-based security circulate widely — about 6% average frame-rate loss in games, "5–10%" as a general system figure, and "5–25%" as a gaming figure — and none of them reaches this knowledge base with a complete condition set.  `[426]` `C:low` `V:durable`
- **Claim.** The 6% figure is attributed to third-party testing of memory integrity and reached this knowledge base only through secondary reporting; the original benchmark article, its processor, its titles and its settings were not read.  `[426]` `C:low` `V:durable`
- **Claim.** The "5–10%" and "5–25%" figures have no traceable primary source in this knowledge base; they appear in secondary write-ups without hardware, workload or the distinction between enabling memory integrity alone and enabling the full feature set.  `[426]` `C:low` `V:durable`
- **Claim.** Adjudicating these three figures is an open item recorded in `errata.md`; until a measurement with conditions is found, the defensible answer is a mechanism explanation plus a statement that the magnitude is workload-dependent and not established here.  `[426]` `C:low` `V:durable`

### 16.3.3 What a usable measurement would have to state

Any figure quoted for this feature needs, at minimum: the processor and its generation; the GPU and whether the workload is CPU-bound or GPU-bound at the tested settings; the exact title or benchmark, resolution and quality settings; which features were toggled — memory integrity alone, the full security feature set, or the hypervisor entirely; whether large pages were available to the affected workload; and the Windows build. A comparison that toggles memory integrity is not measuring the same thing as one that disables the hypervisor, because the second also removes the second-level translation cost of §16.3.1.

- **Claim.** Because a GPU-bound test can hide a CPU-side regression entirely, frame-rate deltas measured at high resolution and a processor-side overhead figure are not comparable quantities, which is sufficient by itself to explain part of the spread between the circulating numbers.  `[426]` `C:medium` `V:durable`

### 16.3.4 Why the same feature costs different amounts on different machines

Three machine properties move the result more than the feature setting does. TLB reach and
page size determine how often the two-dimensional walk of §16.8.2 is paid at all. Core type
matters on hybrid processors, where a workload migrated between core types changes its own
baseline. And the availability of large pages to the affected workload changes the walk depth
itself. None of these is under the user's control from the security setting, which is why two
correctly-run measurements of "the same" configuration can differ by more than the effect.

- **Claim.** Because the dominant term is a page-walk cost that depends on page size and TLB behaviour, a measurement of this feature is a measurement of a particular machine's memory behaviour as much as of the feature; see §16.8.2 and §16.8.5.  `[406][417]` `C:medium` `V:durable`

---

## 16.4 Utility VMs: WSL2, Sandbox, container backends

- **Claim.** A utility VM is a partition: it holds memory, its virtual processors are scheduled against the host's, and its I/O crosses a synthetic-device boundary, so its cost is present whenever it is running and not only when the user is interacting with it; see `17-windows-platform.md` §17.4.  `[474][475]` `C:high` `V:durable`
- **Claim.** The dominant reported costs for this class are memory residency and cross-boundary filesystem access rather than CPU overhead, because the guest's compute runs in non-root operation at native speed while every file operation that crosses between host and guest filesystems traverses the synthetic transport.  `[474]` `C:medium` `V:durable`
- **Claim.** No measurement of WSL2, Windows Sandbox or a Windows container backend carrying processor, workload and configuration is recorded in this knowledge base; the mechanism above is what can be stated, and a figure cannot.  `[474][475][481]` `C:high` `V:durable`
- **Claim.** The one quantified analogue is the cross-boundary I/O breakdown in §16.6, which shows that for a virtualized block operation the transitions are the smallest term and the device model the largest — the same shape a host-to-guest filesystem crossing has.  `[416]` `C:low` `V:durable`

---

## 16.5 A third-party VMM on the Windows Hypervisor Platform versus on bare VMX

- **Claim.** When a third-party VMM runs through the Windows Hypervisor Platform, its guest is a Hyper-V partition and each exit is processed twice: the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to the user-mode VMM, which is one more boundary crossing than a VMM owning VMX root operation pays; see `17-windows-platform.md` §17.3.4.  `[465]` `C:high` `V:durable`
- **Claim.** The same arrangement removes the VMM's ability to program its own VM-execution controls, so optimisations that depend on specific controls — intercepting less, or using a feature the API does not expose — are unavailable regardless of what the hardware supports.  `[465]` `C:high` `V:durable`
- **Claim.** No public measurement of the resulting difference carrying processor, guest workload and configuration is recorded in this knowledge base; the direction follows from the mechanism, the magnitude does not.  `[465]` `C:high` `V:durable`

This is the cleanest example in the chapter of a case where the honest answer is a mechanism and an explicit "no measured figure here". The temptation to supply a percentage is strongest exactly where users most want one.

---

## 16.6 Containers on a Windows PC, and the server study behind the intuition

Linux containers on Windows run inside a utility VM, so the classic container-versus-VM comparison does not apply directly: on Windows both costs are paid at once.

- **Claim.** The IBM container-versus-VM study ran on an IBM System x3650 M4 with two Sandy Bridge-EP Xeon E5-2665 processors and 256 GB of RAM, Ubuntu 13.10 with Linux 3.11, and KVM with QEMU 1.5 and virtio; report RC25482 (2014), published at ISPASS 2015.  `[407]` `C:high` `V:durable`
- **Claim.** In that study KVM delivered about half the IOPS of a container on random I/O with read latency two to three times higher, lost more than 40% throughput on a MySQL/SysBench workload where the container stayed within about 2% of native, and reached 125 GFLOPS on Linpack against the container's 275 GFLOPS; sequential 1 MB I/O was near native for both.  `[407]` `C:high` `V:durable`
- **Claim.** Those figures characterise a 2013-era stack and establish the *shape* of virtualization overhead — the I/O path, not the CPU — rather than current magnitudes; no replication on a modern stack is recorded here, so they must never be updated by estimation.  `[407]` `C:high` `V:durable`
- **Claim.** A virtio-blk latency breakdown published on the KVM project wiki attributes 25699 ns (13.08%) to in-guest processing, 7561 ns (3.85%) to guest/host switching, 3640 ns (1.85%) to host/userspace switching, 29393 ns (14.96%) to device-model emulation and 130235 ns (66.27%) to host I/O; the page carries no date and no hardware description.  `[416]` `C:low` `V:durable`

Even from an undated source the ordering is the useful part: the VMX transitions are the smallest term and the device model costs several times more. That ordering is why I/O optimisation moved from "reduce exits" to "shorten or remove the device-model path", and it is why a synthetic-device design such as VMBus matters more on a PC than the exit cost does.

---

## 16.7 Nested virtualization on a PC

- **Claim.** The Turtles project reported that with optimisations including multi-dimensional paging, nested virtualization reached roughly 6–8% additional overhead relative to single-level virtualization for the workloads and hardware used in the paper; OSDI 2010, x86 with no hardware nesting support.  `[408]` `C:high` `V:durable`
- **Claim.** In the same paper, for kernbench the outer hypervisor consumed 2.28% of overall cycles in the single-level case and 5.17% in the nested case — more than twice the work for the same guest workload.  `[408]` `C:high` `V:durable`
- **Claim.** The 6–8% figure is a lower bound achieved under that paper's optimisations and workload selection, not a general expectation.  `[408]` `C:high` `V:durable`
- **Claim.** A preprint citing prior work reports that forwarding each inner-guest exit outward and back adds two extra world switches per round trip, that nested second-level-translation fault handling adds four, that throughput can fall by up to 4.3x for I/O-intensive applications and that container startup latency rises by 114% versus bare metal; these figures are second-hand and their original conditions are not recorded here.  `[423]` `C:low` `V:durable`
- **Claim.** The Out of Hypervisor line of work (SC'22, arXiv 2202.13483) proposes exposing hypervisor-reserved features directly to guest processes to avoid the nested path, and reports a checkpoint-time reduction of about 14% at about 0.5% overhead for its page-modification-logging case study; the series reports several headline figures that this knowledge base has not reconciled.  `[409]` `C:low` `V:durable`

### 16.7.1 Why the cost multiplies

An inner-guest exit is not handled where it is taken. The outermost hypervisor takes it, decides whether it or the inner hypervisor owns it, and if the inner one owns it, constructs the appearance of an exit for that hypervisor, which runs its handler and attempts an entry that must itself be intercepted. The mechanism is owned by `14-nested-virtualization.md`; what belongs here is the consequence for measurement: exit *density*, not exit *cost*, decides the outcome, which is why nested figures range from single-digit percentages to multiples depending only on the workload.

On a Windows PC this is the configuration that runs a VM inside a VM, and also the configuration in which a third-party VMM runs inside a Hyper-V child partition rather than on the Windows Hypervisor Platform. The costs of §16.5 and this section compound.

---

## 16.8 EPT: what it removes and what it adds

On a machine with any hypervisor-backed feature enabled, this section describes the whole machine, not just its virtual machines.

### 16.8.1 What EPT removes

- **Claim.** With EPT enabled, the hardware walks guest-physical to host-physical translations without hypervisor involvement, eliminating the shadow-paging exits caused by guest page-table writes, CR3 loads and INVLPG; the mechanism is defined in `06-address-translation.md`.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** NOVA measured that nested paging eliminates more than 99% of VM exits and reduces virtualization overhead on memory-bound workloads from more than 20% to 1–3%; conditions: kernel build plus disk benchmarks, NOVA microhypervisor, Core 2 / Nehalem-generation hardware, 2010.  `[402]` `C:high` `V:durable`
- **Claim.** The same measurement counted 181966391 virtual-TLB fills under shadow paging versus 867341 total VM exits under nested paging.  `[402]` `C:high` `V:durable`
- **Claim.** VMware measured EPT delivering up to 48% improvement on MMU-intensive macro benchmarks and up to 600% on MMU-intensive microbenchmarks, while also observing increased memory-access latency on a few workloads; conditions: ESX on EPT-capable Intel hardware compared against ESX shadow paging, c. 2009.  `[403]` `C:high` `V:durable`

> **Excerpt** `[403]`: "EPT provides performance gains of up to 48% for MMU-intensive benchmarks and up to 600% for MMU-intensive microbenchmarks. We have also observed that although EPT increases memory access latencies for a few workloads, this cost can be reduced by effectively using large pages in the guest and the hypervisor."

### 16.8.2 What EPT adds: the two-dimensional page walk

- **Claim.** A TLB miss under EPT requires up to 24 memory accesses instead of the 4 required by a native page walk, because every guest paging-structure address is itself a guest-physical address that must be translated by an EPT walk.  `[406]` `C:high` `V:durable`
- **Claim.** The 24-access worst case decomposes as 4 guest paging-structure reads plus an EPT walk for each of the 5 guest-physical addresses produced (CR3 and four paging-structure entries) at 4 accesses each: 4 + 5×4 = 24; the general form is G + (G+1)×E for G guest levels and E EPT levels.  `[406]` `C:high` `V:durable`
- **Claim.** By the same arithmetic, 2 MB pages on both levels reduce the worst case to 15 accesses (G = 3, E = 3), which is the quantitative reason large pages matter more with second-level translation active than without it; this is arithmetic from the model in `[406]`, not an independent measurement.  `[406]` `C:medium` `V:durable`
- **Claim.** The same model applied to five-level paging on both stages yields a worst case of 35 accesses (G = 5, E = 5); this is arithmetic extended to a paging mode the cited measurements predate, not a measured figure, and must be labelled as such.  `[SDM 3C Ch.31]` `[1][406]` `C:medium` `V:durable`

> The figure "20 accesses" is a known misstatement that counts only the EPT reads; see `errata.md`.

### 16.8.3 Where shadow paging still wins

- **Claim.** Ahn et al. measured mcf running 17% faster with shadow paging than with hardware two-dimensional page walks; conditions: Xen on a Xeon E5530 (Nehalem-EP) with EPT, ISCA 2012.  `[404]` `C:high` `V:durable`
- **Claim.** Wang et al. reported a gap of up to 34% between shadow paging and hardware-assisted memory virtualization for a few benchmarks, with no significant difference for more than half of the cases; VEE 2011.  `[405]` `C:medium` `V:durable`
- **Claim.** Teabe et al. report that their direct-segment design outperforms shadow paging by up to 30% and EPT by up to 370%, which bounds how badly a two-dimensional walk can behave under extreme TLB pressure; VEE 2021.  `[406]` `C:high` `V:durable`

EPT wins when page-table update frequency dominates; shadow paging wins when TLB miss rate dominates. Neither is universally better — and on a PC with a resident hypervisor there is no choice to make, because the hypervisor is there for isolation, not for performance.

### 16.8.4 Diagnosing which side a workload is on

The two failure modes are directly observable. A workload dominated by shadow-paging synchronisation shows a high rate of exits for guest page-table writes, CR3 loads and INVLPG. A workload dominated by two-dimensional walk cost shows few exits, a high TLB miss rate and a high page-walk-cycles fraction, and improves when either stage is backed by large pages. The conflicting results in §16.8.3 are therefore a classification problem, not a disagreement.

### 16.8.5 Large pages as the reconciling variable

- **Claim.** Microsoft's Hyper-V team reported that second-level address translation hardware gives about a 20% improvement overall but about a 20% reduction when large-page support is disabled, so whether large pages are used can produce roughly a 40% delta on the same hardware; vendor engineering blog, figures given as approximations, original post c. 2010.  `[417]` `C:medium` `V:durable`
- **Claim.** Oracle's VirtualBox manual gives a far more conservative figure for the same lever: up to 5% improvement from large pages when nested paging is enabled.  `[418]` `C:medium` `V:durable`
- **Claim.** Gregg reports that combining large pages with kernel page-table isolation turned a 2.1% loss into a 3.0% gain, i.e. large pages mitigate walk cost and mitigation-induced TLB pressure at the same time.  `[410]` `C:medium` `V:durable`

---

## 16.9 The cost of speculative-execution mitigations

Mitigation cost is not virtualization cost, but it is charged on the same events — boundary crossings — so on a machine with a resident hypervisor the two compound.

### 16.9.1 Kernel page-table isolation

- **Claim.** Gregg reports overhead ranging from 1% to more than 800%, the dominant factors being syscall rate, page-fault rate and working-set size; Linux 4.14 with PCID.  `[410]` `C:high` `V:durable`
- **Claim.** In the same analysis about 50000 syscalls per second per CPU corresponds to roughly 2% overhead, a working set beyond 10 MB can turn a 1% overhead into 7% through TLB flushing, and an unfavourable cache-access pattern added a further 10 points, reaching 17%.  `[410]` `C:high` `V:durable`
- **Claim.** In the same analysis a database benchmark at 75000 syscalls per second per CPU lost 5% on an 8-CPU system and 3% on a 64-CPU system, while a different application at 210000 syscalls per second per CPU lost 25%; production estimates were 0.1%–6%, falling below 2% after tuning with PCID and large pages.  `[410]` `C:high` `V:durable`
- **Claim.** Gregg also notes that the total cost arrives in four separate layers — kernel page-table isolation, microcode, hypervisor changes and compiler-inserted thunks — so a single-layer measurement understates it.  `[410]` `C:high` `V:durable`

### 16.9.2 L1D flushing and SMT

- **Claim.** Linux kernel documentation reports that flushing the L1 data cache on VM entry causes performance degradation in the range of 1% to 50%, depending on VM-exit and VM-entry frequency and the type of computation in the guest.  `[411]` `C:high` `V:durable`
- **Claim.** Red Hat's guidance for the same vulnerability lists disabling EPT as one mitigation path while warning of a large performance impact, and disabling simultaneous multithreading as another.  `[424]` `C:medium` `V:durable`
- **Claim.** The best-conditioned public measurement of the SMT-scheduling remedy comes from a server product: VMware measured about 30–35% capacity loss at full load for a scheduler that uses one thread per core, and about 11% worst-case impact at 75% load for a variant that lets both threads of a core run vCPUs of the same VM; vSphere 6.7 U2, 2019.  `[412]` `C:high` `V:durable`

### 16.9.3 Why the costs compound

Kernel page-table isolation is charged per system call and per address-space switch; L1D flushing is charged per VM entry; microcode barriers sit on several paths including VM entry. A workload whose boundary-crossing rate is already high therefore pays both on the same events, which is why a mitigation percentage measured without a hypervisor understates what the same workload loses on a machine where one is resident.

### 16.9.4 Hypervisor-level page-table isolation

- **Claim.** Microsoft Research reports that Xen's hypervisor-level page-table isolation is generally unusable with server workloads, showing 50% overhead on HTTP servers and on a write-intensive key-value benchmark, while their secret-free design shows a geometric-mean overhead of 0.2%.  `[413]` `C:high` `V:durable`

This is the most expensive tier of mitigation in the chapter — an order of magnitude above guest-level isolation for the same class of defence.

---

## 16.10 Optimisations, and where the public data is thin

- **Claim.** Intel's estimate presented at Linux Plumbers Conference 2012 was that APIC virtualization would eliminate up to 50% of VM exits and simplify the emulation of up to a further 10%; the slides label this an internal estimation and give no benchmark, hardware or hypervisor version.  `[420]` `C:medium` `V:durable`
- **Claim.** With VT-d posted interrupts enabled, external interrupts from assigned devices reach a running guest without VMM intervention, removing the injection exit entirely; this is an architectural statement, and no public cycle-level measurement of the saving is recorded here.  `[421]` `C:high` `V:durable`
- **Claim.** The patch series adding IPI virtualization to KVM reported a 22.21% reduction in cycles in xAPIC mode (6059 to 4713) and 15.98% in x2APIC mode (4338 to 3645) on a two-vCPU unit test, a 9.73% saving on a unicast IPI microbenchmark, and hackbench runtime reductions of 18.8% at 8 vCPUs and 18.2% at 96 vCPUs; measured by the patch authors on Sapphire Rapids, which is a server part.  `[419]` `C:high` `V:durable`
- **Claim.** An SR-IOV study reached 10 Gbps line rate in all measured situations and, with all optimisations, 9.57 Gbps at 193% CPU utilisation — 48% higher CPU cost than native, down from 499% before optimisation; Xen HVM guests, c. 2010, and a server-class configuration with no client equivalent.  `[414]` `C:medium` `V:durable`
- **Claim.** The KVM halt-polling commit reports timer latency of about 8000–10000 cycles with polling enabled versus 20000–120000 without, bought with host CPU time spent busy-waiting; a bug report describes host system time reaching about 90% with the shipped default and about 25% after reducing the poll window to 200 µs.  `[415][425]` `C:medium` `V:durable`

### 16.10.1 Features with no conditioned public measurement here

- **Claim.** Posted-interrupt processing, page-modification logging, sub-page write permissions, hypervisor-managed linear-address translation, VMCS shadowing, notify VM exit and bus-lock detection are each defined in the Intel documentation cited by chapters 02, 06, 07 and 14, and for each of them this chapter records no public measurement carrying microarchitecture, software version and benchmark; see the chapter that owns each mechanism.  `[1][9]` `C:high` `V:durable`
- **Claim.** The same is true of every Windows-side mechanism in `17-windows-platform.md`: VTL transition cost, hypercall cost, VMBus round-trip latency and the Windows Hypervisor Platform exit path have no measurement with stated conditions in this knowledge base.  `[461][465]` `C:high` `V:durable`

---

## 16.11 Reconciliation: sources that disagree

Where two credible sources disagree, both are recorded with their conditions. Averaging them produces a number nobody measured.

**1. VM-exit cost: ~650 cycles versus ~3900 cycles.**
Not a disagreement. `[400]` measures the bare hardware round trip on Westmere with no handler; `[402]` measures the average end-to-end cost of handling an exit on earlier hardware. The NOVA decomposition shows both at once: 1016 of its 3900 cycles are the transition.

**2. EPT: +48% versus −17%.**
`[403]` measures MMU-intensive workloads where shadow-paging synchronisation dominates; `[404]` measures a benchmark with a high TLB miss rate and few page-table updates. Both are correct; together they are the evidence for two-sidedness.

**3. Large pages: ~40% delta versus ≤5%.**
`[417]` compares second-level-translation hardware with large pages against the same hardware without them, on a 2010-era stack, with figures stated as approximations. `[418]` describes the incremental gain from enabling large pages on an already-configured nested-paging setup. Different baselines, different eras.

**4. Virtualization-based security: 6% versus 5–10% versus 5–25%.**
Unresolved, and recorded as unresolved (§16.3.2). The three figures differ in what was toggled, what was measured and whether the test was CPU-bound. This is the chapter's clearest example of figures that must not be averaged into "around 10%".

**5. Mitigations: 0.28% / 5% / 5–30% / 800%.**
All plausible for their stated conditions. `[410]` supplies the explanatory model — syscall rate, working-set size, page-fault rate, PCID availability — which is why this chapter cites the model rather than any single percentage.

**6. Nested virtualization: 6–8% versus 4.3x.**
`[408]` is an optimised lower bound on 2010 hardware with selected workloads; `[423]` quotes a second-hand worst case for I/O-intensive applications. The variable is exit density.

**7. Out of Hypervisor: unresolved.**
The series reports both large speedup factors and small percentages for what secondary sources treat as one result. The figures in §16.7 therefore carry `C:low`, and the discrepancy is recorded rather than resolved.

---

## 16.12 Procedure for answering a performance question

1. Decide which quantity the question is about: a bare transition, an exit handled end to end, or a whole-workload delta. Most confusion dissolves here.
2. If the question is "what does this feature cost on my PC", answer with the mechanism (§16.3.1, §16.4, §16.5) and say plainly which parts have no measured figure here.
3. If the question wants cycles for a part newer than Westmere, the answer is that this knowledge base holds no such measurement (§16.2.5). Do not interpolate from §16.2.3.
4. Never average conflicting figures; use §16.11 and give both with their conditions.
5. Send vendor claims, product defaults and anything with an expiry date to `90-dated-landscape.md`.

---

## 16.13 Out of scope for this chapter

- Cloud-provider and datacentre overhead claims, consolidation ratios, network-function-virtualization throughput and datacentre energy figures: outside the scope of a Windows PC skill, and where they are needed at all they belong in `90-dated-landscape.md` as attributed vendor statements.
- Marketing formulations such as "zero virtualization loss", "indistinguishable from bare metal" or fixed multiples of I/O improvement.
- Confidential-computing overhead attached to specific product generations, owned by `13-tdx.md`, with cross-vendor ratios in `18-comparison-amd-arm-riscv.md`.
- Which Windows build or hardware generation enables a security feature by default, which changes the *population* affected by §16.3 but not its mechanism.
