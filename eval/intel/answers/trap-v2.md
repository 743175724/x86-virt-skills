# intel-vt eval — `type: trap` subset (12 questions)

Blinding: only `id`, `type` and `question` were extracted from `questions.yaml`, with a
regex that captures those three fields and nothing else. `chapter`, `must_include`,
`must_not_include`, `required_citation` and `notes` were never read or printed.
No contamination occurred on any of the twelve.

Routing was decided for all twelve from the `SKILL.md` routing table alone and written to
a scratch file before any chapter was opened.

---

### trap-ept-qual-bit7
**Routed to:** `05-vm-exit.md` §5.4 (routing row "Decoding a VM exit: … exit qualification layouts (§5.4)"), plus `errata.md` per SKILL.md step 3
**Actually answered from:** `references/05-vm-exit.md` §5.4.6 "EPT violation (reason 48) — including two corrections"; `references/errata.md` E16
**Answer:**
Bit 7 of the EPT-violation exit qualification tells you that **the guest-linear-address field of the VMCS is valid for this VM exit** — nothing more. It is a validity flag for the *linear* address, not for the physical one.

The distinction matters because the widely circulated reading — "bit 7 means the guest-physical address is valid" — is wrong. On an EPT violation the guest-physical-address field always holds the address whose translation failed; it is reported in its own VM-exit information field and needs no validity flag. The guest-linear-address field is the one that may or may not be meaningful, because an EPT violation can arise from an access that has no linear address behind it (for example a guest-physical access that is not the translation of a linear address). Bit 7 is how the processor tells you which case you are in.

Two consequences for a VMM's fault handler:

- Read the guest-linear-address field only when bit 7 is set. When bit 7 is 0 the field's contents are undefined, not zero.
- Bit 7 gates the bits above it. Bit 8 is defined only when bit 7 is set (it distinguishes an access to a paging-structure entry during a page walk or an A/D-bit update, which clears bit 8, from an access to a guest-physical address that is the translation of a linear address, which sets it); when bit 7 is 0, bit 8 is reserved and cleared to 0. Bit 9 (user-mode vs supervisor-mode linear address) is defined only when bits 7 and 8 are both set and the processor supports advanced VM-exit information for EPT violations, and bits 10 and 11 are defined under that same condition.

One further detail from the same section: if the violation occurred in enclave mode and not during delivery of an event incident to enclave mode, bits 11:0 of *both* address fields are cleared.

The skill records the wrong reading as propagating from stale Chinese transcriptions of a 2017-era SDM mirror (`errata.md` E16).
**Citation given:** Intel SDM Vol.3C §30.2.1 (format populated), with the qualification field itself defined in Vol.3C §27.9.1 — SDM Vol.3C order 326019-092, rev 092, June 2026. Corroborating errata entry: this skill's `errata.md` E16.
**Disagreement:** None. My prior belief was already that bit 7 flags guest-linear-address validity, which is what the skill says; the "guest-physical address is valid" reading is the folklore version and both the skill and I reject it.

---

### trap-ept-qual-bit6
**Routed to:** `05-vm-exit.md` §5.4, plus `errata.md`
**Actually answered from:** `references/05-vm-exit.md` §5.4.6; `references/errata.md` E17; cross-checked against `references/06-address-translation.md` §6.3.1 (EPT entry bit 10) and §6.4.3
**Answer:**
No — it has nothing to do with XD. Bit 6 is **the logical-AND of bit 10, the user-mode execute-access bit, of the EPT paging-structure entries used to translate the guest-physical address of the access**, and it is defined only when the "mode-based execute control for EPT" VM-execution control is 1. When MBEC is 0, bit 6 is undefined and must be masked off rather than interpreted.

The confusion has two separate roots and it is worth keeping them apart:

1. **Wrong permission bit.** XD (execute-disable) is a bit in the *guest's own* paging structures. Bit 6 aggregates a bit in the *EPT* paging structures. EPT has no XD bit at all: EPT entry bit 2 is execute-access and bit 10 is user-mode execute-access. Privilege is not an EPT concept except through MBEC, which is exactly what splits execute permission in two.
2. **Wrong polarity of concept.** XD is a *deny* bit; EPT bits 2 and 10 are *grant* bits. An AND of grant bits across the walk yields "every level granted this", which is the standard way the qualification reports bits 3, 4 and 5 as well.

The neighbouring bits confirm the pattern: bit 3 is the AND of EPT entry bit 0 (read access), bit 4 the AND of bit 1 (write access), bit 5 the AND of bit 2 (execute access — supervisor-mode execute when MBEC is enabled), and bit 6 the AND of bit 10 (user-mode execute, MBEC only). With MBEC on, a single EPT entry can grant supervisor execute via bit 2 while denying user execute via bit 10 or the reverse, which is what bits 5 and 6 let the VMM distinguish after the fault.

If you do want the guest's execute-disable state, it is reported elsewhere in the same qualification: **bit 11** is set when the *guest* paging-structure entries used for the translation disallow instruction fetches (that is, when XD applies), and it is defined only when bits 7 and 8 are set and the processor supports advanced VM-exit information for EPT violations. Bit 10 under the same conditions reports whether the guest paging-structure entries allow writes.
**Citation given:** Intel SDM Vol.3C §30.2.1 (SDM Vol.3C order 326019-092, rev 092, June 2026); EPT entry bit 10 defined in Vol.3C Ch.31. Corroborating errata entry: this skill's `errata.md` E17.
**Disagreement:** None. My prior belief matches the skill — bit 6 is the AND of the EPT user-mode-execute bit under MBEC. The "AND of the XD bits" formulation in the question is the circulating error, and both the skill and I reject it.

---

### trap-zombieload-cve
**Routed to:** `15-security.md` §15.5 (routing row "Transient-execution CVEs (L1TF/MDS/TAA/Spectre) and mitigation MSRs"), plus `errata.md`
**Actually answered from:** `references/15-security.md` §15.5.2 "MDS, and the ZombieLoad naming correction" and the CVE matrix at §15.5; `references/errata.md` E18
**Answer:**
ZombieLoad is **CVE-2018-12130** — MFBDS, Microarchitectural Fill Buffer Data Sampling. It is the fill-buffer variant of MDS.

It is emphatically **not** CVE-2019-11091. That identifier belongs to **MDSUM** (Microarchitectural Data Sampling Uncacheable Memory), a different member of the same family reached through uncacheable memory.

The full MDS set, all four covered by Intel advisory **INTEL-SA-00233** (2019-05-14):

| CVE | Variant | Buffer sampled |
|---|---|---|
| CVE-2018-12126 | MSBDS | store buffer |
| CVE-2018-12127 | MLPDS | load ports |
| **CVE-2018-12130** | **MFBDS — this is ZombieLoad** | fill buffers |
| CVE-2019-11091 | MDSUM | uncacheable memory |

A naming point the skill makes explicitly: neither Intel nor the Linux kernel uses the name "ZombieLoad" at all. Intel's analysis and the kernel's MDS table give only the CVE number and the MFBDS expansion; "ZombieLoad" is the researchers' name from the paper (Schwarz et al., 2019) and exists only in the academic and press vocabulary. So if you are grepping Intel or kernel documentation for the alias you will find nothing — search for CVE-2018-12130 or MFBDS.

Mitigation, since it is usually the next question: a buffer overwrite performed by VERW on parts enumerating MD_CLEAR at CPUID.(EAX=7H,ECX=0):EDX[10]. On MFBDS-affected parts VERW overwrites the fill buffers for **all logical processors on the physical core** (as it does for MLPDS), whereas for MSBDS it overwrites only the current logical processor's store buffer. Immunity is reported by MDS_NO, IA32_ARCH_CAPABILITIES bit 5; FB_CLEAR is bit 17. SMT policy is part of the mitigation for this family, not an optional extra.

Adjacent but distinct: what the press sometimes calls "ZombieLoad v2" is TSX Asynchronous Abort, **CVE-2019-11135**, which the skill treats as its own defect at §15.5.3 (TAA_NO is IA32_ARCH_CAPABILITIES bit 8; TSX can be disabled via IA32_TSX_CTRL at MSR 122H bits 0/1). The skill does not use the "v2" alias.
**Citation given:** Intel advisory INTEL-SA-00233 (2019-05-14) for the four MDS CVEs; ZombieLoad Attack, Schwarz et al. 2019 (zombieloadattack.com) for the alias; mitigation-bit positions from Intel SDM Vol.4 §2.1 (IA32_ARCH_CAPABILITIES). Per the skill's own output standards these are security-advisory sources, not SDM architecture sections, and are cited as such. Corroborating errata entry: `errata.md` E18.
**Disagreement:** None. My prior belief is the same as the skill's: ZombieLoad = CVE-2018-12130 (MFBDS), and CVE-2019-11091 = MDSUM. The swap named in the question is the circulating error.

---

### trap-intel-asid
**Routed to:** `06-address-translation.md` (routing row lists VPID as owned there), with `18-comparison-amd-arm-riscv.md` for the cross-vendor framing
**Actually answered from:** `references/06-address-translation.md` §6.6 "VPID and the caching of translation information"; `references/18-comparison-amd-arm-riscv.md` §18.3.2 "TLB tagging: the 'Intel has no ASID' error" and the §18.12 comparison table; `references/errata.md` E19
**Answer:**
Intel has tagging, and it does **not** flush on every transition. The premise that Intel lacks an ASID-style mechanism is a specific, named error in this knowledge base (`errata.md` E19).

Intel provides **two** address-space identifier namespaces, with different scopes:

- **PCID** — tags linear-address translations by *process* context. Enabled by CR4.PCIDE (bit 17), the current 12-bit PCID lives in CR3[11:0], presence is reported by CPUID function 1 ECX[PCID], and INVPCID manages the tagged entries.
- **VPID** — tags them by *virtual-processor / VM* context. A 16-bit VM-execution control field in the VMCS, with INVVPID to invalidate.

VPID is the direct analogue of AMD's ASID. When "enable VPID" is 1 the processor tags cached translations with the current VPID, and **VM entry and VM exit no longer invalidate cached linear or combined mappings** — host and guest translations coexist in the TLB. That is the whole point of the feature. Only when "enable VPID" is clear do VM entries and exits invalidate the linear and combined mappings associated with VPID 0000H, for all PCIDs and all EPTRTAs.

Details worth having:

- VPID 0000H is reserved for VMX root operation. The current VPID is 0000H in VMX root operation, whenever "enable VPID" is 0, and outside VMX operation entirely; VM entry *fails* if "enable VPID" is 1 while the VPID field is 0000H. So a VMM must assign each vCPU a distinct non-zero VPID. (A processor supporting SEAM implicitly widens the tag to 17 bits and uses 10000H–1FFFFH inside SEAM, while the VMCS field stays 16 bits.)
- Three mapping kinds are tagged differently: linear mappings by VPID + PCID; guest-physical mappings by EPTRTA only; combined mappings by VPID + PCID + EPTRTA. A consequence: **INVVPID can never invalidate guest-physical mappings**, so a VMM that changes EPT and invalidates only by VPID has a stale-translation bug. Conversely INVEPT does invalidate combined mappings, since those carry an EPTRTA tag too.
- The flip side of tagging is that the hardware stops flushing on your behalf, so every place that relied on an implicit flush becomes an explicit invalidation site: INVVPID single-context when a vCPU migrates to another logical processor or when a VPID is recycled; INVVPID individual-address when emulating guest INVLPG; INVVPID single-context-retaining-globals when emulating a guest CR3 reload; INVEPT for the affected EPTRTA when EPT structures become more restrictive.

Versus AMD, the honest comparison is structural rather than "one vendor has tagging and the other does not":

| Role | Intel | AMD |
|---|---|---|
| VM tag | VPID, 16-bit VMCS field, INVVPID | ASID, 32-bit field at VMCB offset 058h bits 31:0, INVLPGA / TLB_CONTROL |
| Process tag | PCID | PCID (CR4.PCIDE, CR3[11:0], INVPCID) |

So both vendors run a guest-managed process tag plus a hypervisor-managed VM tag. The real differences are the VM tag's width (VPID 16 bits against ASID 32 — and on AMD the *implemented* count comes from CPUID Fn8000_000A EBX, so the architectural field width is not the usable range; ASID 0 is reserved for the host and VMRUN with guest ASID 0 ends in #VMEXIT(VMEXIT_INVALID)) and the invalidation interface: Intel uses instructions (INVEPT/INVVPID) where AMD expresses bulk flushes as data in the VMCB TLB_CONTROL field evaluated at VMRUN. The skill notes that the mirror-image error — "AMD is short a process-level tag" — is equally common and equally wrong.

For completeness, ARM's VM tag is the VMID in VTTBR_EL2[63:48] (8 bits, or 16 with FEAT_VMID16 when VTCR_EL2.VS is 1) with a separate stage-1 ASID; RISC-V carries a VMID in hgatp plus an ASID in satp/vsatp. All four architectures carry two namespaces.
**Citation given:** Intel SDM Vol.3C §27.6.12 (VPID field), Vol.3C §31.1 (VPID and reserved value 0000H), Vol.3C Ch.31 (mapping kinds and tagging), Vol.3C §31.4.3.1–§31.4.3.2 (invalidation on VMX transitions), Vol.3A Ch.5 (PCID); AMD APM Vol.2 App.B (ASID field, VMCB offset 058h) and §5.5.1 (AMD PCID). Corroborating errata entry: `errata.md` E19.
**Disagreement:** None. My prior belief is the same as the skill's — VPID is Intel's VM-level tag and PCID its process-level tag, and Intel does not flush unconditionally on VMX transitions when VPID is enabled. The skill adds a correction I would not have volunteered unprompted: AMD also has PCID, so the once-common framing "AMD folds both roles into one ASID namespace" is wrong. I accept that; the AMD APM §5.5.1 anchor is checkable.

---

### trap-mbec-generation
**Routed to:** `06-address-translation.md` (MBEC is an EPT execute-permission control, owned there), plus `errata.md`
**Actually answered from:** `references/06-address-translation.md` §6.3.1 (EPT entry bits 2 and 10, and the line explicitly deferring the generation question to errata); `references/errata.md` E01
**Answer:**
No — **Kaby Lake**, not Skylake. Mode-based execute control first appeared in the 7th-generation Core parts (late 2016 into 2017). The AMD counterpart, GMET (guest-mode execute trap), appeared in Zen 2.

What MBEC actually does, so the generation claim has something to attach to: it splits the EPT execute permission in two. Normally EPT entry bit 2 is simply "execute access". With "mode-based execute control for EPT" enabled (a secondary processor-based VM-execution control), bit 2 becomes execute permission for **supervisor-mode** linear addresses and bit 10 becomes execute permission for **user-mode** linear addresses. Bit 10 has meaning only when MBEC is on and is ignored otherwise. That lets one EPT entry grant execute to supervisor addresses while denying it to user addresses, or the reverse — enforcing W^X across the guest's own privilege boundary, which EPT alone cannot express because privilege is otherwise not an EPT concept.

Two knock-on effects in the same chapter: with MBEC enabled, bit 10 also makes an EPT entry *present* (an entry is present if any of bits 2:0 is 1, or bit 10 when MBEC is on), and bit 10 is subject to the same read-access requirement as bit 2 for misconfiguration purposes — if bit 0 is clear and the processor does not support execute-only EPT translations, setting bit 10 under MBEC causes an EPT misconfiguration. On the exit side, MBEC is what makes exit-qualification bit 6 meaningful (see the bit-6 answer).

MBEC is the hardware accelerator behind Windows HVCI, which is why the generation matters in practice — it is the dividing line for which client parts get HVCI cheaply.

**Source-quality caveat, which the skill is explicit about:** the *architecture* of MBEC is SDM-anchored, but the *generation* attribution is not. `errata.md` E01 carries it at `C:high` on the strength of an LWN patch-series article ("Intel MBEC is a hardware feature, introduced in the Kabylake generation", 2025-12) and a Wikipedia page — a Tier-2 and a Tier-3 source. No Intel specification states a microarchitecture name for MBEC, because the SDM does not do generation attributions. Treat "Kaby Lake" as well-corroborated secondary fact rather than as a specification claim.
**Citation given:** Intel SDM Vol.3C Ch.31 for the mechanism (EPT entry bit 2 / bit 10 under mode-based execute control), SDM Vol.3C order 326019-092 rev 092. For the generation itself there is no Intel anchor: LWN.net, "KVM: nested MBEC support", 2025-12 (https://lwn.net/Articles/1051782/), plus Wikipedia "Second Level Address Translation". Adjudicated in this skill's `errata.md` E01.
**Disagreement:** None on the answer — my prior belief is also Kaby Lake, and "Skylake" is the circulating error the question is fishing with. A partial disagreement on *confidence*: I would have stated Kaby Lake as a plain fact, whereas the skill flags that the only sources are Tier-2/Tier-3 and that no Intel document names the generation. The skill's framing is the more defensible one and I have adopted it.

---

### trap-pml-generation
**Routed to:** `06-address-translation.md` (PML listed in the routing row), plus `errata.md`
**Actually answered from:** `references/06-address-translation.md` §6.8 "Page-modification logging (PML)"; `references/errata.md` E02
**Answer:**
**Broadwell** — specifically the Broadwell generation of Intel **Xeon** (server) processors, 2015. The common attribution to Skylake is wrong, and the skill states flatly that attributions to a later microarchitecture are incorrect.

The server qualifier is the part usually dropped. PML arrived on Broadwell Xeon, not on Broadwell client parts, which is why it reads as a "server feature" in hypervisor code.

What it is, briefly: PML replaces write-protection-based dirty tracking with a hardware log. Instead of taking an EPT violation on the first write to each tracked page, the processor records the guest-physical address when it sets an EPT dirty flag. Mechanically — a 4-KByte page-modification log whose physical address sits in a 64-bit VM-execution control field at VMCS encoding 200EH, holding 512 entries of 64 bits; a 16-bit PML index guest-state field at encoding 0812H that software normally initializes to 511 and the processor decrements after each entry, so the log fills *downwards*; and a page-modification log-full VM exit (basic exit reason 62) when the index leaves the range 0–511. PML requires EPT A/D flags (EPTP bit 6). It is per-VMCS and therefore per-vCPU, so each vCPU needs its own log page.

Two traps in the protocol the chapter calls out: an entry is logged only on the **0→1 transition** of a dirty flag, so a page whose dirty flag is already set is silently invisible to the log (clear it first to track a page, pre-set it to exclude one); and because the buffer fills from index 511 downwards, a consumer walking it forwards reads entries in reverse chronological order.

Reported benefit, with its conditions attached: a measurement study on Xen 4.7 reported PML shortening VM live-migration and checkpointing time by up to 10.18% and reducing migration's impact on application performance by up to 0.95%, with no additional power cost. PML logs only write accesses, so it cannot by itself estimate a working-set size.

**Source-quality caveat, as with MBEC:** the PML *mechanism* is SDM-anchored (Vol.3C §27.6.18, §31.3.6). The *generation* is not — the SDM names no microarchitecture. `errata.md` E02 rests on the KVM 4.x merge-window pull request describing PML as "a new feature in Broadwell Xeons that speeds up dirty page tracking" and on Intel-adjacent material calling it a feature of "Intel's Broadwell server platform".
**Citation given:** Intel SDM Vol.3C §27.6.18 (PML address field, log size, logging rule) and §31.3.6 (entries added only on a dirty-flag 0→1 transition), SDM Vol.3D App.C (exit reason 62); SDM Vol.3C order 326019-092 rev 092. For the generation: Paolo Bonzini's 2015 Linux/KVM pull request, and secondary Intel-platform material — no Intel specification states it. Adjudicated in `errata.md` E02.
**Disagreement:** None on the answer — my prior belief is also Broadwell (Xeon), and "Skylake" is the circulating error. Same confidence nuance as MBEC: I would have asserted the generation flatly; the skill correctly marks it as secondary-sourced because the SDM does not attribute features to microarchitectures.

---

### trap-ept-walk-accesses
**Routed to:** `06-address-translation.md` (routing row "EPT structures …"), plus `errata.md`
**Actually answered from:** `references/06-address-translation.md` §6.5 "The cost of a two-dimensional page walk"; `references/errata.md` E03
**Answer:**
**24 memory accesses**, for 4-level guest paging with 4-level EPT. A native 4-level walk costs at most 4.

The arithmetic, which is the part worth carrying because it is what makes the number checkable:

```
translate guest CR3 (itself a GPA) through EPT ............ 4 accesses
for each guest level L4, L3, L2, L1:
    translate the entry's GPA through EPT ................. 4 accesses
    read the guest paging-structure entry ................. 1 access
                                                           ---------
total                                     4 + 4 x (4 + 1) = 24 accesses
```

Every guest-physical address produced during the guest's own walk must itself be translated through EPT — including the guest's CR3 value and each guest paging-structure entry's frame address. That is what makes the walk two-dimensional.

**The commonly repeated figure of 20 is wrong**, and the skill diagnoses exactly why: 20 counts only the EPT paging-structure reads (5 EPT walks × 4 levels) and omits the 4 reads of the guest paging-structure entries themselves. The complete worst case is 24.

Three qualifications that belong with the number:

- **It is a worst case for a cold walk, not the expected cost of a TLB miss.** Paging-structure caches hold upper levels of *both* hierarchies, so real walks are usually much shorter.
- **5-level/5-level gives 35** (5 + 5 × 6). 5-level EPT is configured by an EPTP page-walk-length field of 4 and uses guest-physical address bits 56:0.
- **The SDM states the walk structure, not the total.** The figure is arithmetic that follows from §31.3.2; it is not a number Intel prints. The skill says so explicitly, and I would flag the same thing before putting "24" in a document that claims an Intel anchor.

Why it matters: because the worst case scales multiplicatively rather than additively, large pages matter more under EPT than natively — a 2-MByte or 1-GByte mapping removes a level from *both* dimensions and raises TLB reach. A 2-MByte EPT leaf removes a level from the EPT dimension, a 2-MByte guest page removes one from the guest dimension, and the two are independent, so the best case needs large pages on both sides. This is also why there is no single answer to "is EPT faster than shadow paging": EPT wins where paging-structure updates dominate and loses where TLB misses dominate, with measured gaps up to 34% reported in *both* directions on individual benchmarks.
**Citation given:** Intel SDM Vol.3C §31.3.2 for the walk structure (and §31.4.1 for paging-structure caches), SDM Vol.3C order 326019-092 rev 092 — with the explicit caveat that the total of 24 is derived arithmetic, not a figure the SDM prints. Supporting literature: Gandhi, Hill & Swift, "Agile Paging", ISCA 2016; Teabe et al., "(No)Compromis", VEE 2021. Corroborating errata entry: `errata.md` E03.
**Disagreement:** None. My prior belief is also 24 for the 4-level/4-level worst case, with 20 as the circulating undercount. The skill's addition that the SDM gives the structure but not the total is a citation-hygiene point I agree with.

---

### trap-ooh-venue
**Routed to:** `bibliography.md` (routing row "Full citation list"), with `14-nested-virtualization.md` as the owning chapter
**Actually answered from:** `references/14-nested-virtualization.md` (publication-venue correction); `references/bibliography.md` entries [607] and [608]; `references/errata.md` E04 and O6
**Answer:**
**SC '22** — the IEEE/ACM International Conference for High Performance Computing, Networking, Storage and Analysis (Supercomputing), Dallas, November 2022. Authors Stella Bitchebe and Alain Tchana. The frequently repeated attribution to **SOSP '22 is wrong**.

There is a preprint, and it is a different document with a different title, which is the root of most of the confusion:

| | arXiv preprint | SC '22 paper |
|---|---|---|
| Title | "Out of Hypervisor (OoH): When Nested Virtualization Becomes Practical" | "Out of Hypervisor (OoH): Efficient Dirty Page Tracking in Userspace Using Hardware Virtualization Features" |
| Identifier | arXiv:2202.13483, 2022-02-27, never revised | SC '22 proceedings, November 2022 |

The idea itself inverts the usual framing: rather than emulating hardware inside a VM so a hypervisor can run there, OoH exposes individual hypervisor-oriented features (PML, SPP, CAT, EPT) to the guest OS so that *processes* inside a VM can use them.

**Cite the right one for the numbers, because the two report different results** and mixing them is a known downstream error (`errata.md` O6, which the skill records as settled — both figure sets are correct, for different publications, so there is nothing to adjudicate):

- The **arXiv preprint** reports EPML reducing CRIU checkpointing time by about **14%** at about **0.5%** overhead, against SPML, `/proc` and `userfaultfd`.
- The retitled and extended **SC '22** paper, which adds Boehm garbage collection, reports **13×** faster CRIU checkpointing, up to **6×** faster Boehm GC, and about **16×** less overhead on the monitored application.

Name the publication with the number; never merge the two.

**One internal inconsistency in the skill, flagged for the maintainer:** `14-nested-virtualization.md` still presents the results discrepancy as an "Unresolved conflict in OoH's own reported results (`C:low`)", whereas `errata.md` O6 records it as settled at `C:high` with the two-publications explanation. Per SKILL.md step 3 ("Where it disagrees with a familiar statement, it wins") and the errata header, errata is authoritative, so I have answered from O6 — but chapter 14 appears not to have been updated when O6 was resolved. The venue claim itself is consistent across both files.
**Citation given:** Bitchebe, S. and Tchana, A., "Out of Hypervisor (OoH): efficient dirty page tracking in userspace using hardware virtualization features", SC '22 (IEEE/ACM Supercomputing), November 2022 — https://sc22.supercomputing.org/proceedings/tech_paper/tech_paper_pages/pap130.html. Preprint: arXiv:2202.13483, 2022-02-27. Both are Tier-2 academic sources with no Intel anchor, as the skill's output standards require for non-Intel claims. Corroborating errata entries: `errata.md` E04 (venue) and O6 (results).
**Disagreement:** My prior belief was weakly held and I want to be honest about it rather than claim a match I did not have. I associated OoH with Bitchebe and Tchana and with a 2022 systems venue, but I could not have named SC '22 with confidence, and "SOSP '22" is exactly the kind of plausible substitution I might have produced under pressure. The skill states SC '22 with a proceedings URL; I defer to it, and it is independently checkable at the link given.

---

### trap-sdm-vmx-chapter-numbers
**Routed to:** `00-quickref.md` (routing row "Document numbers, symptom triage, terminology, where a table lives"), plus `errata.md`
**Actually answered from:** `references/00-quickref.md` §0.1 "The Intel document set" and its "Three traps" note; `references/errata.md` E20; cross-checked against the `Maps to:` lines of chapters `01`–`09`
**Answer:**
I can give you the chapters, but **not the one you asked for — "Virtualization of System Resources" no longer exists as an SDM chapter.** Citing it means citing a stale manual, typically one of the 2017-era HTML mirrors still quoted in secondary material. The same applies to two sibling titles that circulate with it: "Handling Boundary Conditions in a VMM" and "Managing State". None of the three is a chapter in the current SDM.

In **SDM revision 092 (June 2026)** the VMX chapters are **Vol.3C Ch.26–35**:

| Ch. | Title |
|---|---|
| 26 | Introduction to Virtual Machine Extensions |
| 27 | Virtual Machine Control Structures |
| 28 | VMX Non-Root Operation |
| 29 | VM Entries |
| 30 | VM Exits |
| 31 | VMX Support for Address Translation |
| 32 | APIC Virtualization and Virtual Interrupts |
| 33 | VMX Instruction Reference |
| 34 | System Management Mode |
| 35 | Secure Arbitration Mode (SEAM) |

The three appendices you will also need live in **Vol.3D**: App.A the VMX capability reporting facility, App.B VMCS field encodings, App.C basic exit reasons. HLAT paging is in **Vol.3A** §5.5.x.

Document numbers for the citation line: Vol.3C is **326019-092**, Vol.3D **332831-092**, Vol.3A **253668-092**, Vol.4 (MSR definitions) **335592-092**, all rev 092, June 2026.

**The practical rule:** any citation to a VMX chapter number outside 26–35, or to any of those three titles, is from a superseded manual. If you have a remembered chapter number from an older SDM, it is almost certainly off by three — the block shifted, so old Ch.23 (Introduction to VMX) is now Ch.26, old Ch.24 (VMCS) is now Ch.27, and so on.

As for *what you were probably after*: "Virtualization of System Resources" covered how a VMM virtualizes system-level facilities. That material no longer has a chapter of its own; the guest-side behaviour it described is now distributed across Ch.28 (VMX Non-Root Operation) and the relevant feature chapters. The skill does not state a one-to-one mapping from the old chapter to a new one, and I am not going to invent one — the honest answer is that the chapter was dissolved, not renumbered.
**Citation given:** Intel SDM Vol.3C Ch.26–35, order 326019-092, rev 092 (June 2026); Vol.3D App.A/B/C, order 332831-092; Vol.3A §5.5.x, order 253668-092. Adjudicated in this skill's `errata.md` E20 and summarized in `00-quickref.md` §0.1.
**Disagreement:** **Yes — a real one, and it is mine to concede.**
- *My prior belief:* the VMX block is Vol.3C **Ch.23–33** — 23 Introduction to VMX, 24 VMCS, 25 VMX Non-Root Operation, 26 VM Entries, 27 VM Exits, 28 VMX Support for Address Translation, 29 APIC Virtualization, 30 VMX Instruction Reference, 31 VMX for SMM, **32 Virtualization of System Resources**, 33 Handling Boundary Conditions in a VMM. On that numbering the chapter the question asks for does exist, and I would have cited it as Ch.32.
- *The skill:* rev 092 places the block at **Ch.26–35**, and those three chapter titles no longer exist.

I am reporting the skill's position as the answer. The numbering is internally consistent across the knowledge base — every `Maps to:` line in chapters `01`–`09` independently uses 26, 27, 28, 29, 30, 31, 32, 33, 34/35 in the matching order — and rev 092 (June 2026) postdates my training data, so a renumbering after my cutoff is exactly the situation where my memory is the unreliable party. Note also that the arrival of Ch.35 (SEAM) is itself evidence of a real restructuring rather than a transcription slip. Flagging it anyway, since a wrong chapter number is a silent citation failure.

---

### trap-vt-rp-specification
**Routed to:** `06-address-translation.md` (HLAT listed in the routing row), plus `errata.md` and `00-quickref.md` for document numbers
**Actually answered from:** `references/06-address-translation.md` §6.10 "Hypervisor-managed linear-address translation (HLAT)"; `references/errata.md` E22; `references/00-quickref.md` §0.1
**Answer:**
**There is no such document.** No standalone "Intel VT-rp specification" exists, and a citation to one is a citation to a document that does not exist — a fabricated source. The skill lists this among the three traps in its document-set table.

The normative content lives **only inside the SDM**, in three places:

| Topic | Where |
|---|---|
| Linear-address translation behaviour (HLAT walks, the restart bit) | SDM Vol.3A §5.5.1, §5.5.3, §5.5.5 |
| VMCS fields (enable-HLAT control, HLATP, HLAT prefix size) | SDM Vol.3C §27.6.22 |
| HLAT under VMX, and the EPT-side bits | SDM Vol.3C §31.2; paging-write access and guest-paging verification at §31.3.3.2 |

The three VT-rp mechanisms, since "VT-rp" is a marketing umbrella over them rather than a single feature:

| Mechanism | Enabled by | State it adds | What it prevents |
|---|---|---|---|
| HLAT | "enable HLAT" VM-execution control | HLATP, HLAT prefix size | the guest changing the translation of a protected linear range |
| Paging-write access | "EPT paging-write control" | EPT leaf bit 58 | arbitrary guest-physical pages acting as paging structures |
| Guest-paging verification | "guest-paging verification" | EPT leaf bit 57 | a translation reaching a protected page through unapproved paging structures |

Each has its own tertiary VM-execution control bit. Neither paging-write access nor guest-paging verification requires HLAT to be in use — both constrain ordinary CR3-rooted translation. They are not fully independent of each other, though: guest-paging verification is performed only when "guest-paging verification" **and** "EPT paging-write control" are both 1. A verification failure is reported as an EPT violation, flagged by **bit 15** of the EPT-violation exit qualification.

Two mechanism details that are easy to get wrong: HLAT paging structures have the same format as ordinary paging structures *except* bit 11, the **restart bit** — when the processor meets a set restart bit at any level during an HLAT walk it abandons HLAT and restarts translation of the whole linear address using ordinary CR3-rooted paging, and the restarted walk also caps the page size at which the result may be cached. And bit 57 must be set in the EPT leaf entry for the **guest paging-structure page**, not the data page.

The attack model, briefly, since it explains why the feature exists: EPT protects guest-*physical* pages, but the guest kernel still owns the guest-linear → guest-physical map. An attacker with guest-kernel write primitives need not defeat EPT at all — it edits the guest's own paging structures so a linear address the hypervisor believes is code resolves to a page the hypervisor believes is data. The three mechanisms close the three ways of doing that.

On the Windows side this hardware is what sits under Microsoft's **Hypervisor-enforced Paging Translation (HVPT)**. The HVPT name and design are Microsoft's and cite Microsoft, not Intel.

If you want a document number for something adjacent: HLAT-class features appear in the **Intel Architecture Instruction Set Extensions and Future Features Programming Reference (319433-062)** for material not yet folded into the SDM, and that is the only Intel document besides the SDM the skill lists as carrying forward-looking VMX content. It is still not a "VT-rp specification".
**Citation given:** Intel SDM Vol.3A §5.5.1 / §5.5.3 / §5.5.5 (order 253668-092), Vol.3C §27.6.22, §31.2 and §31.3.3.2 (order 326019-092), rev 092, June 2026. Adjudicated in `errata.md` E22; summarized in `00-quickref.md` §0.1. Microsoft HVPT framing is a Microsoft source, not an Intel one.
**Disagreement:** None. My prior belief also is that no standalone VT-rp specification exists and that HLAT is documented in the SDM (with early disclosure in the ISA Extensions reference, 319433). The question presupposes a document that is not there, and the skill and I agree in refusing the premise rather than naming a plausible-sounding order number.

---

### trap-tdxray-advisory
**Routed to:** `13-tdx.md` §13.21 (named explicitly in the routing row: "TDX CVEs and advisories, TDXRay (§13.21)")
**Actually answered from:** `references/13-tdx.md` §13.21.2 "TDXRay — microarchitectural side-channel analysis of TDX"; `references/bibliography.md` entries [252], [254], [256]
**Answer:**
**There is no advisory number and no CVE.** The question's premise does not hold, and the honest answer is to reject it rather than supply an identifier.

TDXRay has **no INTEL-SA advisory number, no CVE and no CVSS score.** Intel's response is a security **announcement**, not an advisory: **INTEL-2026-04-02-001**, dated **2026-04-02**. Intel treats the behaviour as architecturally permitted observation of shared microarchitectural resources and places the mitigation burden on developers following Intel's side-channel-resistance guidance. An announcement of that kind does not carry a CVE, which is why there is none to give you.

**The identifier you have probably seen is wrong.** The widely repeated attribution of TDXRay to **INTEL-SA-01271 is incorrect**: that advisory is the **Intel Gaudi Software Installer Advisory** of 2025-05-13, covering **CVE-2024-45067**, an incorrect-default-permissions issue (CWE-276) in Gaudi software installers before version 1.18. It has no relationship to TDX whatsoever. The skill traces the mislabel to link text on the TDXRay project site whose `href` actually points at the announcement above — so the wrong number is one careless copy away from the right one, which is exactly how it spread.

What TDXRay is: peer-reviewed security research — "TDXRay: Microarchitectural Side-Channel Analysis of Intel TDX for Real-World Workloads", **IEEE Symposium on Security and Privacy (S&P) 2026**, by authors from CISPA, UC San Diego and Google. It composes four host-side primitives — **SEPTrace** (page-level tracking by blocking Secure EPT translations), **Load+Probe** (cache-line detection by timing), **TSX-Probe** (TSX transaction aborts on cached lines) and **MWAIT-Probe** (MWAIT monitoring a physical address, including TD private memory) — to produce cache-line-granular memory-access traces of unmodified TDs using only architecturally legitimate host interfaces.

Why that yields no CVE: TDXRay is consistent with the TDX threat model rather than a violation of it. The TDX Module specification explicitly acknowledges single-step and zero-step observation as attacks the host VMM can mount, and mitigates rather than eliminates them. A finding inside the stated threat model is research, not a vulnerability with an identifier.

Practical guidance: cite the announcement number **INTEL-2026-04-02-001** and the S&P 2026 paper. If a compliance process demands a CVE for this, the correct response is that none exists — not to reach for INTEL-SA-01271.
**Citation given:** Intel security announcement **INTEL-2026-04-02-001**, 2026-04-02 (https://www.intel.com/content/www/us/en/security-center/announcement/security-announcement-2026-04-02-001.html) — Tier-1 Intel source, but an announcement, not an advisory. Paper: Hornetz, Yavarzadeh, Cheu, Gascon, Gerlach, Moghimi, Schoppmann, Schwarz, Zhang, "TDXRay: Microarchitectural Side-Channel Analysis of Intel TDX for Real-World Workloads", IEEE S&P 2026 (https://tdxray.cpusec.org/). Threat-model anchor: Intel TDX Base Architecture Specification §17.3 (order 348549-008). For the misattribution: INTEL-SA-01271 is the Intel Gaudi Software Installer Advisory, 2025-05-13, CVE-2024-45067.
**Disagreement:** No substantive disagreement, but I had no firm prior here and want that on the record rather than implied. TDXRay sits at the very edge of my training data, and I could not have produced either "INTEL-2026-04-02-001" or "no CVE exists" from memory with confidence. Under pressure to name an identifier, INTEL-SA-01271 is plausibly what I would have surfaced, since that is the number circulating — which is precisely the failure the skill documents. I am reporting the skill's position, and its two checkable discriminators (the Gaudi advisory's own subject and CVE-2024-45067, and the `href`-vs-link-text explanation of how the mislabel arose) are what make it credible rather than merely assertive.

---

### trap-vtd-current-revision
**Routed to:** `00-quickref.md` (routing row "Document numbers"), with `90-dated-landscape.md` as the versions file
**Actually answered from:** `references/00-quickref.md` §0.1 and its "Three traps" note; `references/10-vtd-dma-remapping.md` §10.1 "Which document this chapter tracks"; `references/errata.md` E21
**Answer:**
Cite **Rev 5.20, April 2026, order number D51397-019**. The Intel page you are looking at is stale — Rev 4.1 is superseded by roughly three years.

The staleness is specifically diagnosed in this knowledge base. The intel.com landing page for the VT-d specification carries page metadata dated **2023-03-22**, and its content endpoint (`content-details/774206`) was still serving **Rev 4.1** when checked on **2026-09-20**. A reader who trusts the page rather than the PDF cover will work from a superseded document — not a cosmetic problem, because the revision changed terminology and register definitions.

**The rule: take the revision from the PDF cover page, not from the intel.com page metadata.** That is how the whole document table in this knowledge base was built.

Two substantive changes you inherit by moving to Rev 5.20:

- **Terminology.** Rev 5.20 says **first-stage** and **second-stage** where earlier revisions and most secondary material say *first-level* and *second-level*. Use the Rev 5.20 spelling — "First-Stage Translation" (§3.6), "Second-Stage Translation" (§3.7), nested translation (§3.8), pass-through (§3.9). Worth knowing: that rename is *older* than this revision — the Revision History dates it to Rev 3.4, December 2021 — so material still using "level" is older than Rev 3.4 or was copied without checking.
- **Register bits.** Examples of things that differ if you are reading Rev 4.1: in Rev 5.20 CAP_REG bit 3 is plain **Reserved (RsvdZ)** while **only bit 23** carries the DEP "Deprecated" marking (bit 3 lost the advanced-fault-logging capability outright rather than being deprecated in place); ECAP_REG bits 5, 24 and 28 are marked Deprecated and must be reported as 0.

Direct PDF: https://cdrdv2-public.intel.com/919688/D51397-019-vt-directed-io-spec.pdf

Citation form used throughout this knowledge base: `[VT-d 5.20 §3.4.1]`, i.e. revision plus section.

One related item the skill leaves deliberately unsettled, in case you need the history: the publication date of VT-d **Rev 1.0** is an open conflict (`errata.md` O2) — 2006-03 is the date in the revision history carried forward for Rev 1.0, while 2006-08 is the publication date of the Intel Technology Journal 10(3) paper by Abramson et al. that first described VT-d publicly. No Intel document consulted settles it. Cite Rev 5.20 for anything current and flag the 1.0 date as unsettled.
**Citation given:** Intel Virtualization Technology for Directed I/O Architecture Specification, order **D51397-019, Rev 5.20, April 2026** — revision read from the PDF cover page. Stale-source reference: intel.com content-details entry 774206, page metadata 2023-03-22, serving Rev 4.1 as of 2026-09-20. Adjudicated in `errata.md` E21; document table in `00-quickref.md` §0.1.
**Disagreement:** **Yes, on what the current revision is.**
- *My prior belief:* the newest VT-d specification I can recall is **Rev 4.1, March 2023** — the same thing the intel.com page shows — with no later revision known to me. Asked cold, I would have confirmed the user's Rev 4.1 and told them they were up to date.
- *The skill:* the current specification is **Rev 5.20, April 2026, D51397-019**, and Rev 4.1 / the March 2023 date is exactly the stale-landing-page artifact to avoid.

I am reporting the skill's position. April 2026 is at or past my training cutoff, so a revision I have never seen is expected rather than suspicious; the skill gives an order number, a cover date and a direct cdrdv2 URL, and chapter `10` is written against Rev 5.20 section numbers throughout (§3.6/§3.7 stage naming, §11.4.2 CAP_REG, §11.4.3 ECAP_REG), which is heavier internal corroboration than a transcription error would produce. Recording the disagreement anyway, because "the vendor's own page says 4.1" is a reasonable objection a user will raise and the answer needs the PDF-cover-versus-page-metadata explanation to survive it.
