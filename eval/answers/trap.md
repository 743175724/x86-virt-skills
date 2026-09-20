# intel-vt evaluation — `type: trap` (12 questions)

Blinding: only `id`, `type` and `question` were extracted from `eval/questions.yaml`.
`chapter`, `must_include`, `must_not_include`, `required_citation` and `notes` were
never read. No contamination occurred on any of the twelve.

Routing was recorded from the SKILL.md routing table *before* any chapter was opened.
SKILL.md "How to use this skill" rule 3 directs that `references/errata.md` be checked
before writing anything touching a commonly circulated claim, so `errata.md` is a
second source on every question below by the skill's own instruction.

---

### trap-ept-qual-bit7
**Routed to:** `05-vm-exit.md` §5.4 — routing row "**Decoding a VM exit**: exit reasons (§5.3), exit qualification layouts (§5.4)"
**Actually answered from:** `references/05-vm-exit.md` §5.4.6 "EPT violation (reason 48) — including two corrections"; `references/errata.md` E16; cross-check `05-vm-exit.md` §5.4.10 table row for reason 48
**Answer:**
Bit 7 of the EPT-violation exit qualification is set if the **guest-linear-address field of the VMCS is valid** for this VM exit. It is not a "guest-physical address is valid" indicator — that is the widely circulated misreading, and the skill records it as a settled erratum.

The distinction matters because the two fields behave differently on an EPT violation:

- The **guest-physical address** is reported in its own VM-exit information field and is **always** valid for an EPT violation. There is no qualification bit gating it, because it never needs one — the guest-physical address is precisely the address whose translation failed.
- The **guest-linear address** field is meaningful **only when bit 7 is set**. An EPT violation can occur on an access that has no linear address behind it (for example a walk of the guest's own paging structures initiated from a guest-physical address), which is exactly the case bit 7 exists to flag.

Bit 7 also gates bit 8: bit 8 is defined only when bit 7 is set, and it then distinguishes an access to a guest paging-structure entry during a page walk (bit 8 clear) from a translation of a guest-linear address (bit 8 set). Bits 9, 10 and 11 are defined only when bits 7 and 8 are both set and the processor supports advanced VM-exit information for EPT violations.

Practical consequence for a VMM: on exit reason 48, read the guest-physical address unconditionally, and read the guest-linear address only after testing qualification bit 7. Code that treats bit 7 as "GPA valid" will either skip a GPA that was always there or consume a stale guest-linear address field.

The skill notes the provenance of the wrong reading: it propagates from stale Chinese transcriptions of a 2017-era SDM mirror.
**Citation given:** Intel SDM Vol.3C §27.9.1 (Basic VM-Exit Information / exit qualification for EPT violations); field-population behaviour Intel SDM Vol.3C §30.2.1. Bibliography refs [1], [619]. Confidence `C:high`, `V:durable`.
**Disagreement:** None. My own recollection of the SDM matches the skill: bit 7 = guest-linear-address field valid.

---

### trap-ept-qual-bit6
**Routed to:** `05-vm-exit.md` §5.4 — same routing row as above
**Actually answered from:** `references/05-vm-exit.md` §5.4.6; `references/errata.md` E17; supporting detail `references/06-address-translation.md` §6.3 (EPT entry bit table, bits 2 and 10) and its EPT-violation cross-reference claim
**Answer:**
No. Bit 6 has nothing to do with the XD (execute-disable) bit of the guest's own paging structures.

Bit 6 of the EPT-violation exit qualification is the **logical-AND of bit 10 — user-mode execute access — of the EPT paging-structure entries used to translate the address of the access**, and it is **defined only when the "mode-based execute control for EPT" VM-execution control is 1**. When MBEC is off, bit 6 is undefined and must not be interpreted.

The surrounding bits make the structure clear, and they are all ANDs across the EPT paging-structure entries used in the translation — never across guest paging structures:

- Bit 3 = logical-AND of bit 0 (read access) of the EPT entries used.
- Bit 4 = logical-AND of bit 1 (write access) of the EPT entries used.
- Bit 5 = logical-AND of bit 2 of the EPT entries used. With MBEC off, bit 2 is plain execute access; with MBEC on, bit 2 is **supervisor-mode** execute access.
- Bit 6 = logical-AND of bit 10 of the EPT entries used, which is **user-mode** execute access, meaningful only with MBEC on.

So bits 5 and 6 are a matched pair under MBEC: supervisor-execute and user-execute respectively. That pairing is the whole point of mode-based execute control — a single EPT entry can grant execute permission to supervisor-mode linear addresses (bit 2) while denying it to user-mode linear addresses (bit 10), or the reverse, which is how a VMM enforces W^X across the guest's own privilege boundary and is the hardware accelerator behind Windows HVCI.

The execute-disable bit does appear in this qualification, but at a different position: **bit 11**, under the advanced-VM-exit-information conditions (bits 7 and 8 both set, processor support present), is set if the guest paging-structure entries used for the translation disallow instruction fetches — that is, where XD applies. Confusing bit 6 with bit 11 is the error the question is probing. EPT paging-structure entries have no XD bit at all: the EPT format has no present bit, no user/supervisor bit and no XD bit; presence is encoded in the permission bits themselves.
**Citation given:** Intel SDM Vol.3C §27.9.1 (exit qualification for EPT violations); EPT paging-structure entry bit 10 at Intel SDM Vol.3C Ch.31. Bibliography refs [1], [619]. Confidence `C:high`, `V:durable`.
**Disagreement:** None. My prior matches the skill.

---

### trap-zombieload-cve
**Routed to:** `15-security.md` §15.5 — routing row "Transient-execution CVEs (L1TF/MDS/TAA/Spectre) and **mitigation MSRs**"
**Actually answered from:** `references/15-security.md` §15.5.2 "MDS, and the ZombieLoad naming correction", plus the MDS row of the transient-execution table in §15.5; `references/errata.md` E18
**Answer:**
ZombieLoad is **CVE-2018-12130**, the fill-buffer variant, known formally as **MFBDS (Microarchitectural Fill Buffer Data Sampling)**.

It is commonly misattributed to CVE-2019-11091. That identifier belongs to a **different** member of the same family: **MDSUM (Microarchitectural Data Sampling Uncacheable Memory)**, a separate variant reached through uncacheable memory.

MDS is four distinct defects with four CVEs, all covered by Intel advisory **INTEL-SA-00233**:

| CVE | Variant | Buffer sampled |
|---|---|---|
| CVE-2018-12126 | MSBDS (Microarchitectural Store Buffer Data Sampling) | store buffer |
| CVE-2018-12127 | MLPDS (Microarchitectural Load Port Data Sampling) | load ports |
| **CVE-2018-12130** | **MFBDS — this is ZombieLoad** | fill buffers |
| CVE-2019-11091 | MDSUM (Microarchitectural Data Sampling Uncacheable Memory) | uncacheable memory |

The academic names RIDL, Fallout and ZombieLoad map onto this same set from the researchers' side; "ZombieLoad" is the researchers' name for the fill-buffer variant, which Intel and the Linux kernel both identify as CVE-2018-12130.

Mitigation, for completeness: microcode plus a buffer overwrite performed by VERW on processors enumerating MD_CLEAR at CPUID.(EAX=7H,ECX=0):EDX[10]. On parts affected by MSBDS, VERW overwrites the store buffer for the current logical processor; on parts affected by MFBDS it overwrites the fill buffers for all logical processors on the physical core; on parts affected by MLPDS it overwrites the load-port writeback buses. Enumeration of immunity is MDS_NO (IA32_ARCH_CAPABILITIES bit 5), with FB_CLEAR at bit 17, and SMT policy is part of the mitigation picture.
**Citation given:** Intel SDM Vol.3C §28.1.2 (and Vol.4 §2.1 for the VERW/MD_CLEAR mitigation); Intel advisory INTEL-SA-00233. Bibliography refs [354], [362], [369], [370], [23]. Confidence `C:high`, `V:durable`.
**Disagreement:** None. My prior matches the skill (ZombieLoad v1 = CVE-2018-12130). One adjacent fact the skill does not state and I did not assert as its content: the follow-on "ZombieLoad Variant 2" is generally identified with TAA, CVE-2019-11135, which is a TSX-asynchronous-abort issue rather than an MDS CVE. That is my own knowledge, offered as context only, and is not sourced from this knowledge base.

---

### trap-intel-asid
**Routed to:** `06-address-translation.md` — routing row "EPT structures, EPT violation vs misconfiguration, **VPID**, PML, SPP, HLAT, #VE"
**Actually answered from:** `references/06-address-translation.md` §6.6 "VPID and the caching of translation information"; `references/18-comparison-amd-arm-riscv.md` §18.3.2 "TLB tagging: the 'Intel has no ASID' error" and the §18.12 comparison table; `references/errata.md` E19
**Answer:**
Intel does not flush on every transition, and the claim that Intel has no ASID-style mechanism is **wrong as stated**. Intel has **two** address-space identifier mechanisms, with different scopes:

- **PCID** — process-context identifier. Tags linear-address translations by process context; carried in the low 12 bits of CR3 when CR4.PCIDE is set. Guest-managed.
- **VPID** — virtual-processor identifier. A **16-bit VM-execution control field** in the VMCS, with **INVVPID** to invalidate. Tags translations by virtual-processor / VM context. Hypervisor-managed.

With "enable VPID" set to 1, the processor tags cached translations with the current VPID, and **VM entry and VM exit no longer invalidate cached linear or combined mappings** — host and guest translations coexist in the TLB. That is exactly the AMD-ASID benefit. VPID 0000H is reserved for VMX root operation: the current VPID is 0000H whenever the processor is in VMX root operation or whenever "enable VPID" is 0, and VM entry **fails** if "enable VPID" is 1 while the VPID field is 0000H.

The true difference from AMD is narrower and structural, not presence versus absence:

- Intel does not use the *name* ASID, and does not use a single identifier for both roles. It keeps a **guest-managed PCID namespace and a hypervisor-managed VPID namespace** that combine when both are active.
- AMD folds process-level and VM-level tagging into **one 32-bit ASID namespace** managed by the hypervisor (ASID 0 belongs to the host; the number actually implemented is reported by CPUID, so the architectural field width is not the usable range).
- For reference, ARM matches Intel's two-namespace arrangement rather than AMD's single one: VMID in VTTBR_EL2 (8 bits, or 16 with the larger-VMID feature) for the VM tag, and a separate stage-1 ASID for process contexts. RISC-V likewise uses VMID in hgatp plus ASID in satp/vsatp.

The caching model is worth stating because it governs what you must invalidate. VMX distinguishes three mapping classes: **linear mappings** (tagged by current VPID and PCID), **guest-physical mappings** (tagged by current EP4TA only) and **combined mappings** (tagged by VPID, PCID and EP4TA together). Two consequences follow. Guest-physical mappings carry no VPID tag, so **no INVVPID type can invalidate them** — a VMM that changes EPT and invalidates only by VPID has a stale-translation bug; INVEPT is required, and INVEPT does also invalidate combined mappings. Conversely, because combined mappings carry all three tags, changing either the VPID or the EPTP suffices to stop the processor using an existing combined mapping, which is what makes multi-view EPT designs cheap and is why VMFUNC EPTP switching with VPID enabled needs no TLB flush.

The cost of tagging is that the hardware stops flushing on your behalf, so every place a VMM previously relied on an implicit transition flush becomes an explicit invalidation site: INVVPID single-context when a vCPU migrates to another logical processor or when a VPID is recycled, INVVPID individual-address when emulating a guest INVLPG, and INVVPID single-context-retaining-globals when emulating a guest CR3 reload. Each vCPU must get a distinct non-zero VPID.

Note also that INVVPID is the Intel counterpart to AMD's INVLPGA (which takes an address in rAX and an ASID in ECX); the same vendor-neutral "flush guest TLB" hook in KVM is implemented with a single-context INVVPID on Intel and an ASID flush on AMD.
**Citation given:** Intel SDM Vol.3C §27.6.12 (VPID) and Vol.3C Ch.31 (VMX support for address translation / translation caching); Intel SDM Vol.3A Ch.5 (PCID). AMD side: AMD APM Vol.2 App.B and Ch.15. ARM DDI 0487. Bibliography refs [1], [3], [41], [48], [505], [618], [632]. Confidence `C:high` (Intel side), `C:medium` (cross-vendor framing), `V:durable`.
**Disagreement:** None. My prior matches the skill.

---

### trap-mbec-generation
**Routed to:** `06-address-translation.md` — MBEC is an EPT execute-permission feature, so the "EPT structures … #VE" routing row
**Actually answered from:** `references/06-address-translation.md` §6.3 (EPT entry bits 2 and 10, and the claim that explicitly defers the generation question to errata E01); `references/errata.md` E01
**Answer:**
No — that is the misconception this knowledge base records as erratum E01. **Mode-Based Execute Control first appeared in Kaby Lake** (7th-generation Core, late 2016 into 2017), not Skylake.

What MBEC does: it splits the single EPT execute permission into two. In an EPT paging-structure entry, bit 2 normally grants execute access; with "mode-based execute control for EPT" enabled, **bit 2 grants execute access only for supervisor-mode linear addresses**, and **bit 10 becomes execute access for user-mode linear addresses** (bit 10 has meaning only when MBEC is enabled and is ignored otherwise). A single EPT entry can therefore grant execute to supervisor-mode linear addresses while denying it to user-mode ones, or the reverse — which is how a VMM enforces W^X across the guest's own privilege boundary. MBEC also changes the presence rule: an EPT entry is present if any of bits 2:0 is 1, and with MBEC enabled bit 10 also makes an entry present.

MBEC is enabled by a secondary processor-based VM-execution control (the bit position is owned by `02-vmcs.md`), and it is the hardware accelerator behind **Windows HVCI** (`15-security.md` §15.8). It is also what gives EPT-violation exit-qualification bits 5 and 6 their supervisor/user-execute meanings.

The AMD counterpart, **GMET** (guest-mode execute trap), appeared in **Zen 2**.
**Citation given:** Intel SDM Vol.3C Ch.31 (EPT paging-structure entry bits 2 and 10, mode-based execute control). Generation attribution: `errata.md` E01, bibliography refs [600], [601]. Confidence `C:high`, `V:durable`.
**Disagreement:** None. My prior is also Kaby Lake / 7th-gen Core.

---

### trap-pml-generation
**Routed to:** `06-address-translation.md` — routing row lists **PML** explicitly
**Actually answered from:** `references/06-address-translation.md` §6.8 "Page-modification logging (PML)"; `references/errata.md` E02
**Answer:**
Page-modification logging was introduced with **Broadwell — specifically Broadwell Xeon (server), 2015**. It was not Skylake; that attribution is recorded as erratum E02.

The skill's chapter states it directly: the PML facility is specified in SDM Vol.3C and "its first silicon was the Broadwell generation of Intel Xeon processors in 2015, and attributions to a later microarchitecture are incorrect." The supporting evidence is the KVM 4.x merge-window pull request describing PML as "a new feature in Broadwell Xeons that speeds up dirty page tracking", plus Intel material calling it a feature of "Intel's Broadwell server platform".

Mechanically, PML replaces write-protection-based dirty tracking with a hardware log. Instead of taking an EPT violation on the first write to each tracked page, the processor records the guest-physical address when it sets an EPT dirty flag:

- The log is a 4-KByte page-modification log whose physical address is a 64-bit VM-execution control field at **VMCS encoding 200EH**.
- The **PML index** is a 16-bit guest-state field at **VMCS encoding 0812H**; software normally initialises it to 511, and the processor decrements it after each logged entry, so the log fills **downwards** and the most recently logged entry sits at the lowest written index.
- Each logged entry is the guest-physical address of the access with bits 11:0 cleared. PML therefore **requires EPT A/D flags (EPTP bit 6)** to be enabled.
- When the PML index leaves the range 0–511, a **page-modification log-full VM exit** occurs, basic **exit reason 62**; the VMM drains the buffer and resets the index.
- PML is per-VMCS and therefore per-vCPU: each vCPU needs its own log page. KVM allocates one when the "enable PML" secondary control is set.

Two consequences the chapter draws: PML *replaces* rather than supplements write-protection dirty tracking, removing one EPT violation per page per tracking round; and because PML logs only write accesses it cannot by itself estimate a working-set size. A measurement study on Xen 4.7 reported PML shortening VM live-migration and checkpointing time by up to 10.18% and reducing migration's impact on application performance by up to 0.95%, with no additional power cost.
**Citation given:** Intel SDM Vol.3C §27.6.18 (PML address, logging behaviour), §27.4.2 (PML index), Vol.3D App.C (exit reason 62). Generation attribution: `errata.md` E02, bibliography refs [110], [602], [603]. Confidence `C:high`, `V:durable`.
**Disagreement:** None. My prior is also Broadwell (Xeon E5 v4-era server parts, 2015).

---

### trap-ept-walk-accesses
**Routed to:** `06-address-translation.md` — routing row "EPT structures …"
**Actually answered from:** `references/06-address-translation.md` §6.5 "The cost of a two-dimensional page walk"; `references/errata.md` E03
**Answer:**
**24 memory accesses**, for a 4-level guest hierarchy over a 4-level EPT hierarchy. The commonly repeated figure of **20 is wrong** — it is recorded as erratum E03.

The arithmetic, exactly as the chapter gives it:

```
walk(GVA) with 4-level guest paging and 4-level EPT:
  translate guest CR3 (a GPA) through EPT ................. 4 accesses
  for each guest level L4, L3, L2, L1:
      translate the entry's GPA through EPT ............... 4 accesses
      read the guest paging-structure entry ............... 1 access
                                                           ---------
  total                                    4 + 4 x (4 + 1) = 24 accesses
```

That is 4 accesses to translate the guest CR3 value through EPT, plus 5 for each of the 4 guest paging-structure levels (4 EPT accesses to translate that level's guest-physical address, plus 1 to read the guest entry itself). A native 4-level walk costs at most 4.

Why "20" circulates: it counts only the EPT paging-structure reads — 5 EPT walks of 4 levels each — and **omits the 4 reads of the guest paging-structure entries themselves**.

Two important qualifications the chapter attaches:

- **This is a cold-walk worst case, not the expected cost of a TLB miss.** Paging-structure caches hold upper levels of *both* hierarchies, so the 24-access figure is an upper bound rather than a typical cost.
- **5-level/5-level** gives **35** worst-case accesses by the same arithmetic: 5 + 5 x 6.

The structural point is that the cost scales **multiplicatively** rather than additively. That is why large pages matter more under EPT than natively: a 2-MByte EPT leaf removes one level from the EPT dimension of every walk through it, and a 2-MByte *guest* page removes one level from the guest dimension; the two are independent, so the best case needs large pages on both sides. It is also why no single answer to "is EPT faster than shadow paging" holds across workloads — EPT wins where paging-structure updates dominate and loses where TLB misses dominate, with measured gaps in both directions of up to 34% reported for individual benchmarks.
**Citation given:** Intel SDM Vol.3C Ch.31 (VMX support for address translation). Bibliography refs [26], [107], [108], [114]; correction recorded at `errata.md` E03. Confidence `C:high` for the 24 figure, `C:medium` for the 35 figure and the shadow-paging comparison, `V:durable`.
**Disagreement:** None. My prior is also 24 for the 4/4 case.

---

### trap-ooh-venue
**Routed to:** `bibliography.md` — routing row "Full citation list". (Recorded before opening; the errata and chapter text show the owning chapter is actually `14-nested-virtualization.md`, so this route was imprecise — see "Actually answered from".)
**Actually answered from:** `references/errata.md` E04 and open conflict O6; `references/14-nested-virtualization.md`, the publication-venue correction claim in its nested-virtualization research section; `references/bibliography.md` entries [307], [308], [409], [607], [608]
**Answer:**
**SC '22** — the IEEE/ACM International Conference for High Performance Computing, Networking, Storage and Analysis (Supercomputing), Dallas, **November 2022**. It was **not** SOSP '22; that attribution is recorded as erratum E04.

Full provenance:

- **Conference version:** S. Bitchebe and A. Tchana, "Out of Hypervisor: Efficient Dirty Page Tracking in Userspace Using Hardware Virtualization Features", SC '22, IEEE/ACM Supercomputing, Dallas, 2022-11.
- **Preprint:** arXiv:2202.13483, "Out of Hypervisor (OoH): When Nested Virtualization Becomes Practical", 2022-02-27.

What the paper does, for context: OoH inverts the usual nested-virtualization framing. Instead of emulating hardware inside a VM so that a hypervisor can run there, it exposes individual hypervisor-oriented features — PML, SPP, CAT, EPT — to the guest OS so that **processes inside a VM** can use them. EPML is its extended-PML mechanism for userspace dirty-page tracking.

**Warning attached by the skill, which you must carry if you cite OoH's numbers.** The paper's own reported results exist in two mutually inconsistent sets, recorded as **open conflict O6**, and the skill's rule is to state both and not merge them:

- The **SC '22** result quoted is that EPML speeds up CRIU checkpointing by **13x** and Boehm garbage collection by **6x** relative to SPML, `/proc` and `userfaultfd`, with **16x** less overhead on the monitored application.
- The **arXiv preprint abstract** instead reports a checkpoint-time reduction of about **14%** with negligible overhead of about **0.5%**: "The results show that EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%) compared to SPML, /proc, and userfaultfd."

These come from different versions of the same work and are routinely mixed. Always say which version a number comes from.
**Citation given:** SC '22 technical-paper page, IEEE/ACM Supercomputing, Dallas, 2022-11 (bibliography [308] / [607]); arXiv:2202.13483, 2022-02-27 (bibliography [307] / [608]). Chapter anchor as given in `14-nested-virtualization.md`: Intel SDM Vol.3C §31.3.6. Confidence `C:high` for the venue, `C:low`/`C:medium` for the conflicting results, `V:durable`.
**Disagreement:** None on the venue. Note on routing rather than content: I routed from the SKILL.md table to `bibliography.md`, but the fact is owned by `14-nested-virtualization.md`; the routing table has no row that obviously captures "where was paper X published", and the nested-virtualization row does not mention research provenance. That is a routing-table gap, not a factual disagreement.

---

### trap-sdm-vmx-chapter-numbers
**Routed to:** `00-quickref.md` — routing row "Document numbers, symptom triage, terminology, where a table lives"
**Actually answered from:** `references/00-quickref.md` §0.1 "The Intel document set" (document table and the "Three traps" note); `references/errata.md` E20; cross-check `references/01-vmx-intro.md` `Maps to:` line
**Answer:**
Two parts to this, and the second part is the trap.

**Which chapters cover VMX.** In **SDM revision 092** the VMX chapters are **Vol.3C Ch.26–35** (order number 326019-092, rev 092, 2026-06):

| Ch. | Title |
|---|---|
| 26 | Introduction to Virtual Machine Extensions |
| 27 | Virtual-Machine Control Structures |
| 28 | VMX Non-Root Operation |
| 29 | VM Entries |
| 30 | VM Exits |
| 31 | VMX Support for Address Translation |
| 32 | APIC Virtualization |
| 33 | VMX Instruction Reference |
| 34 | System Management Mode |
| 35 | SEAM |

Plus **Vol.3D** (332831-092): **App.A** the capability-reporting facility (VMX capability MSRs), **App.B** VMCS field encodings, **App.C** basic exit reasons.

**The chapter you asked for does not exist.** There is no SDM chapter titled **"Virtualization of System Resources"** in revision 092. Nor is there one titled "Handling Boundary Conditions in a VMM" or "Managing State". The SDM renumbered and reorganised its VMX chapters; those three titles **no longer exist as chapters**. Any citation to them — or to a VMX chapter number that does not fall in 26–35 — comes from a stale manual, typically the 2017-era HTML mirrors that secondary material still quotes. The skill's output standard is explicit on this: do not invent section numbers, and remembered numbers from older manuals are wrong.

If what you actually want is the material those old chapters carried, it now sits inside the chapters above — for example VM-exit information fields and the exit qualification are in the VMCS chapter at **§27.9.1**, VM-exit behaviour in **Ch.30**, and address-translation support in **Ch.31**.
**Citation given:** Intel SDM Vol.3C, order 326019-092, rev 092 (2026-06), Ch.26–35; Intel SDM Vol.3D, order 332831-092, App.A/B/C. Recorded at `00-quickref.md` §0.1 and `errata.md` E20; bibliography refs [1], [2], [619]. Confidence `C:high`, `V:durable`.
**Disagreement:** Partial, and about numbering rather than substance. From memory I would have given the VMX chapters as Vol.3C **Ch.23–33** (23 Introduction to VMX, 24 VMCS, 25 VMX Non-Root Operation, 26 VM Entries, 27 VM Exits, 28 VMX Support for Address Translation, 29 APIC Virtualization, 30 VMX Instruction Reference), which is the numbering in the SDM revisions I know well. The skill's rev-092 mapping is exactly my remembered numbering **plus 3**, and it is internally consistent (the exit qualification at old §24.9.1 becomes §27.9.1; address translation at old Ch.28 becomes Ch.31), so I regard the skill as describing a genuine later renumbering rather than contradicting me. Revision 092 is dated 2026-06, past the point where my own recollection of Intel document revisions is reliable, so **I report the skill's numbers**. Second, smaller point: "Virtualization of System Resources" and "Handling Boundary Conditions in a Virtual Machine Monitor" *were* real SDM Vol.3C chapter titles in older revisions (around Ch.32 and Ch.33 in the pre-renumbering scheme). The skill says they no longer exist, which is consistent — but a reader should understand that someone citing them has a stale manual, not a fabricated citation.

---

### trap-vt-rp-specification
**Routed to:** `06-address-translation.md` — routing row lists **HLAT** explicitly
**Actually answered from:** `references/06-address-translation.md` §6.10 "Hypervisor-managed linear-address translation (HLAT)"; `references/errata.md` E22; `references/00-quickref.md` §0.1 "Three traps"
**Answer:**
I cannot, because **no such document exists**. There is no standalone Intel VT-rp specification. A citation to one is a citation to a document that does not exist — the skill records this as erratum E22 and lists it among the three document traps in the quick reference.

The normative content for VT-rp lives **only inside the SDM**:

| VT-rp topic | Where it is normatively defined |
|---|---|
| Linear-address translation behaviour, HLAT paging structures and the restart bit | Intel SDM **Vol.3A §5.5.1, §5.5.3, §5.5.5** |
| The VMCS fields (HLAT pointer, HLAT prefix size, the enabling controls) | Intel SDM **Vol.3C §27.6.22** |
| HLAT and the EPT-side mechanisms | Intel SDM **Vol.3C §31.2** |

What VT-rp actually comprises — three independently enabled, independently useful mechanisms:

1. **HLAT** (hypervisor-managed linear-address translation). Enabled by an "enable HLAT" VM-execution control; roots its paging hierarchy at the **HLAT pointer (HLATP)**, a VM-execution control field holding a guest-physical address, with a companion **HLAT prefix size** field selecting which linear addresses translate through HLATP instead of CR3. HLAT paging structures have the same format as ordinary paging structures except for **bit 11, the restart bit**: when the processor meets a set restart bit during an HLAT walk it abandons HLAT and restarts the translation through ordinary CR3-rooted paging.
2. **Paging-write access** — **bit 58** of an EPT leaf entry, given meaning by the "EPT paging-write control" VM-execution control. It marks a page that the processor's paging hardware is permitted to write as a paging structure.
3. **Guest-paging verification** — **bit 57** of an EPT leaf entry, under the "guest-paging verification" VM-execution control. When set for a target page, the processor checks that every guest paging-structure entry used to reach that page lies in a page whose EPT leaf entry has paging-write access set; a failure is reported as an EPT violation.

The attack these close is specific: EPT protects *guest-physical* pages, but the guest kernel still owns the guest-linear → guest-physical map, so an attacker with guest-kernel write primitives can edit the guest's own paging structures to make a linear address the hypervisor believes is code resolve to a page the hypervisor believes is data. HLAT removes the guest's authority over a chosen linear range; paging-write access restricts which pages may act as paging structures at all; guest-paging verification makes the processor check that a translation only went through such pages. Paging-write access and guest-paging verification constrain ordinary CR3-rooted translation and **do not require HLAT to be in use**.

On Windows, these three together are the hardware under Microsoft's **Hypervisor-enforced Paging Translation (HVPT)**.

One gap the chapter declares honestly: the **VMCS encodings of the HLAT pointer and HLAT prefix size fields are not stated** in this knowledge base, because they could not be anchored with confidence.
**Citation given:** Intel SDM Vol.3A §5.5.1 / §5.5.3 / §5.5.5; Intel SDM Vol.3C §27.6.22; Intel SDM Vol.3C §31.2. Microsoft HVPT: Windows OS Platform blog (bibliography [113]), a Tier-2 source. Bibliography refs [1], [3], [112], [113]. Confidence `C:high` on the non-existence claim, `C:medium` on the mechanism details, `V:durable`.
**Disagreement:** Minor, and about history rather than the answer. I agree there is no standalone VT-rp specification today and that the SDM is normative. My recollection adds one thing the skill does not mention: before this material was folded into the SDM, VT-rp (HLAT, paging-write control, guest-paging verification) was documented in the **Intel Architecture Instruction Set Extensions and Future Features Programming Reference, document 319433** — which the skill's own document table does list, described as covering "features not yet in the SDM". I state this with moderate confidence only; it does not change the answer, because 319433 is a future-features reference rather than a VT-rp specification, and anyone working today should cite the SDM sections above. Flagging it because a maintainer may want the chapter to say "was previously carried in 319433, now normative in the SDM" rather than leaving a reader puzzled about where they once saw VT-rp documented separately.

---

### trap-tdxray-advisory
**Routed to:** `13-tdx.md` §13.21 — routing row "TDX: … **TDX CVEs and advisories, TDXRay (§13.21)**"
**Actually answered from:** `references/13-tdx.md` §13.21.2 "TDXRay — microarchitectural side-channel analysis of TDX" (and §13.21.1 for the neighbouring CVE that is sometimes confused with it); `references/errata.md` (no TDXRay entry — the correction is carried in the chapter itself)
**Answer:**
**There is no advisory number and no CVE.** TDXRay has **no INTEL-SA advisory number, no CVE and no CVSS score**. If you need an identifier, the correct one is not an advisory at all: it is Intel **security announcement INTEL-2026-04-02-001**, dated **2026-04-02**.

What TDXRay is: peer-reviewed security research — "TDXRay: Microarchitectural Side-Channel Analysis of Intel TDX for Real-World Workloads", published at the **IEEE Symposium on Security and Privacy 2026** by authors from CISPA, UC San Diego and Google. It composes four host-side primitives to produce cache-line-granular memory-access traces of unmodified TDs using only architecturally legitimate host interfaces:

- **SEPTrace** — page-level tracking by blocking Secure EPT translations
- **Load+Probe** — cache-line detection by timing
- **TSX-Probe** — TSX transaction aborts on cached lines
- **MWAIT-Probe** — MWAIT monitoring a physical address, including TD private memory

Why no CVE was issued: Intel's announcement treats the behaviour as **architecturally permitted observation of shared microarchitectural resources** and places the mitigation burden on developers following Intel's side-channel-resistance guidance. This is consistent with the specification's own threat model rather than a violation of it — the TDX Module explicitly acknowledges single-step and zero-step observation as attacks the host VMM can mount, and mitigates rather than eliminates them.

**The widely repeated attribution of TDXRay to INTEL-SA-01271 is wrong.** INTEL-SA-01271 is the **Intel Gaudi Software Installer Advisory** of 2025-05-13, covering **CVE-2024-45067**, an incorrect-default-permissions issue (CWE-276) in Gaudi software installers before version 1.18. It has no relationship to TDX whatsoever. The mislabel originates in link text on the TDXRay project site whose href actually points at the security announcement above.

For contrast, TDX vulnerabilities that *do* carry advisory numbers are a separate matter — for example **CVE-2025-30513**, a TOCTOU on TD ATTRIBUTES during migration import in the Intel TDX Module, published in **INTEL-SA-01397** ("2026.1 IPU, Intel TDX module Advisory", released 2026-02-10), one of five CVEs from a joint Google–Intel assessment of TDX with Live Migration. Do not let that advisory be borrowed for TDXRay either.
**Citation given:** `13-tdx.md` anchors this to the Intel TDX Base Architecture Specification §17.3 (TDX-BASE, order 348549-008); Intel security announcement INTEL-2026-04-02-001 (2026-04-02); IEEE S&P 2026 paper. Bibliography refs [11], [252], [254], [256]. Confidence `C:high`, `V:durable`.
**Disagreement:** None — and I want to be explicit that I have **no independent prior** here. TDXRay, the 2026-04 announcement and INTEL-SA-01397 all postdate my reliable knowledge, so this answer rests entirely on the knowledge base and I could not have caught an error in it from memory.

---

### trap-vtd-current-revision
**Routed to:** `00-quickref.md` — routing row "Document numbers, symptom triage, terminology, where a table lives"
**Actually answered from:** `references/00-quickref.md` §0.1 "The Intel document set" and its "Three traps" note; `references/10-vtd-dma-remapping.md` §10.1 "Which document this chapter tracks"; `references/errata.md` E21 (and O2 for the Rev 1.0 dating conflict)
**Answer:**
Cite **Rev 5.20, April 2026, order number D51397-019** — the Intel Virtualization Technology for Directed I/O Architecture Specification. Do **not** cite Rev 4.1.

The intel.com page you are looking at is **stale**, and this is recorded as erratum E21. The landing page shows a **2023-03-22** date, and when checked on **2026-09-20** its content endpoint was still serving **Rev 4.1**. A reader who trusts the page rather than the PDF will work from a superseded document.

**The rule the skill gives: always take the revision from the PDF cover page, not from the intel.com page metadata.** The whole document table in `00-quickref.md` §0.1 was built that way — "Revisions were read from the PDF cover pages; where intel.com's landing-page metadata disagrees, the PDF governs."

One substantive consequence of the revision gap, beyond the number itself: **Rev 5.20 renamed first-level/second-level translation to first-stage/second-stage**. So terminology taken from Rev 4.1 will not match current section text, and a Rev 5.20 citation reads for example `[VT-d 5.20 §7.1.3]`.

Anchor examples from the current revision, for the shape of a correct citation: Ch.3 "DMA Remapping", Ch.4 "Support For Device-TLBs", Ch.6 "Caching Translation Information", Ch.9 "Translation Structure Formats", Ch.11 "Register Descriptions".

Separately, and worth knowing if you are dating VT-d's history rather than citing it: the date of **Rev 1.0** is an **open conflict** in this knowledge base (O2). 2006-03 is the date carried in the revision history used across this material; 2006-08 is the publication date of the Intel Technology Journal 10(3) architecture paper by Abramson et al. that first described VT-d publicly, and industry writeups additionally cite a Spring IDF 2006 announcement with no Intel press release to anchor it. No Intel document consulted settles it — cite Rev 5.20 for anything current and flag the 1.0 date as unsettled.
**Citation given:** Intel VT-d Architecture Specification, order **D51397-019, Rev 5.20, April 2026** (revision per PDF cover page); recorded at `00-quickref.md` §0.1, `10-vtd-dma-remapping.md` §10.1 and `errata.md` E21. Bibliography refs [8], [620]. Confidence `C:high`, `V:durable`.
**Disagreement:** Soft, and I flag it because it bears on how much weight to put on my confirmation. **My own recollection also tops out at Rev 4.1 (March 2023)** — I have no independent knowledge of a Rev 5.20 or of order number D51397-019, and April 2026 sits at the edge of my reliable knowledge of Intel document revisions. In other words, my memory is the very stale answer this question traps, and I am not in a position to corroborate the skill here. **I report the skill's answer (Rev 5.20, D51397-019, April 2026)** because it is the sourced, dated one and its account of the stale landing page is specific and checkable (it names a check date of 2026-09-20). A maintainer should treat my agreement as absent rather than supporting: the one fact I could contribute — that Rev 4.1 was current as of early 2023 — is exactly what the errata says the stale page is still serving.

---

## Summary of source use

| id | Routed to (pre-registered) | Answered from |
|---|---|---|
| trap-ept-qual-bit7 | `05-vm-exit.md` §5.4 | `05-vm-exit.md` §5.4.6, §5.4.10; `errata.md` E16 |
| trap-ept-qual-bit6 | `05-vm-exit.md` §5.4 | `05-vm-exit.md` §5.4.6; `errata.md` E17; `06-address-translation.md` §6.3 |
| trap-zombieload-cve | `15-security.md` §15.5 | `15-security.md` §15.5 table, §15.5.2; `errata.md` E18 |
| trap-intel-asid | `06-address-translation.md` | `06-address-translation.md` §6.6; `18-comparison-amd-arm-riscv.md` §18.3.2; `errata.md` E19 |
| trap-mbec-generation | `06-address-translation.md` | `06-address-translation.md` §6.3; `errata.md` E01 |
| trap-pml-generation | `06-address-translation.md` | `06-address-translation.md` §6.8; `errata.md` E02 |
| trap-ept-walk-accesses | `06-address-translation.md` | `06-address-translation.md` §6.5; `errata.md` E03 |
| trap-ooh-venue | `bibliography.md` (imprecise) | `14-nested-virtualization.md`; `errata.md` E04, O6; `bibliography.md` [307][308] |
| trap-sdm-vmx-chapter-numbers | `00-quickref.md` | `00-quickref.md` §0.1; `errata.md` E20 |
| trap-vt-rp-specification | `06-address-translation.md` | `06-address-translation.md` §6.10; `errata.md` E22; `00-quickref.md` §0.1 |
| trap-tdxray-advisory | `13-tdx.md` §13.21 | `13-tdx.md` §13.21.2 (and §13.21.1) |
| trap-vtd-current-revision | `00-quickref.md` | `00-quickref.md` §0.1; `10-vtd-dma-remapping.md` §10.1; `errata.md` E21, O2 |
