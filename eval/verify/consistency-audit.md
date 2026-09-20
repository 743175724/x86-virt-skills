# intel-vt consistency audit — defect classes the linter cannot catch

Audited: `C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\` — `SKILL.md` (145 lines) plus
`references/*.md` (23 files, 8,303 lines, 2,540 extracted `- **Claim.**` lines).
Date: 2026-09-20. **No file in the skill was modified.**

Out of scope by instruction (already enforced by `tools/lint.mjs`): claim schema, Tier-1 anchor
grammar, bibliography resolution, the `V:dated` quarantine mechanism, routing-table integrity,
ownership heuristics, generated-file drift.

Severity key: **blocking** = wrong or misleading to a reader · **should-fix** · **cosmetic**.

Finding counts: Class 1 = 6 · Class 2 = 7 · Class 3 = 5 · Class 4 = 9 · Class 5 = 11. Total 38.

---

## Class 1 — Cross-file contradictions not recorded in `errata.md`

Method: extracted all 2,540 claims, indexed by number/date/revision/generation, grouped by subject,
and compared every cross-file pair sharing ≥7 content tokens but differing in a numeric token.
Every conflict already adjudicated in `errata.md` (O1 FlexPriority, O2 VT-d 1.0, O3 TDX AES,
O4 VBS overhead *as stated there*, O5 H100 arXiv, O6 OoH results) was excluded. What follows is the
residue.

### 1.1 Two different, non-overlapping "three circulating VBS/HVCI figures" tables — **blocking**

- `references/errata.md:226` (O4) records the conflict as **6% / 5–10% / 5–25%**, sources `[627][628][629]`.
- `references/16-performance.md:140` reproduces exactly those three — **6% / "5–10%" / "5–25%"** — but sources them to `[426]`.
- `references/15-security.md:374-376` presents a **different** set of three: **~6%**, **4.9% / 5.7% geometric mean** (five titles, i7-11700K and i7-10700K), and **"up to 10%", elsewhere "as much as 15%"** — sources `[389][390][391]`.

The 4.9%/5.7% and the 10%/15% figures do not appear in `errata.md` at all, and the "5–10%" and
"5–25%" figures do not appear in `15-security.md`'s table. A reader routed to 15 and a reader routed
to 16 are handed irreconcilable answers to the same question, and the errata entry adjudicates only
one of the two presentations.
*Fix:* make `errata.md` O4 enumerate all five distinct figures with their sources, and have 15 §15.12
and 16 §16.3.2 both reproduce that one list.

### 1.2 `15-security.md:378` states a range its own table contradicts — **blocking**

The claim says VBS/HVCI overhead figures "range from about **5% to about 25%**", but the table
immediately above it (`15-security.md:374-376`) tops out at **15%**. The 25% upper bound has no
support anywhere in chapter 15; it comes from `[629]`, which chapter 15 does not cite.
*Fix:* change the claim to "about 5% to about 15% among the figures tabulated here" and cite `[629]`
explicitly if the 25% figure is to be kept.

### 1.3 Duplicate bibliography IDs make one source look like several — **should-fix**

31 groups of bibliography entries resolve to identical URLs, because the 100–199 / 200–249 / 400–449 /
600–649 ID bands each re-registered the same document. Consequence: the same fact appears in two
chapters citing two different-looking sources, which reads as independent corroboration. Worst cases:

| IDs | Same document | Fact cited from two IDs |
|---|---|---|
| `bibliography.md:87` `[124]` / `:200` `[400]` | Intel Technology Journal 14(3), 2010 | identical ~1100/820/650-cycle figures at `07-apic-virtualization.md:18` and `16-performance.md:61` |
| `:84` `[121]` / `:355` `[621]` | AnandTech Xeon E5-2600 v2 | FlexPriority dating at `07-apic-virtualization.md:49` vs `errata.md:202` |
| `:190` `[391]` / `:361` `[627]` | ithome.com | the 6% HVCI figure at `15-security.md:378` vs `errata.md:226` |
| `:77` `[114]` / `:203` `[403]` | VMware EPT evaluation 2009 | 48%/600% at `06-address-translation.md:35` vs `16-performance.md:221` |
| `:71` `[108]` / `:206` `[406]` / `:340` `[606]` | (No)Compromis, VEE 2021 | 24-memory-reference derivation across 06, 16, errata |
| `:127` `[307]` / `:209` `[409]` / `:342` `[608]` | arXiv:2202.13483 | OoH preprint across 14, 16, errata |

*Fix:* collapse each group to one canonical ID and repoint the citing claims; keep the band scheme as
a comment, not as a reason to duplicate.

### 1.4 `[3]` and `[4]` cannot both be correct — **should-fix**

`bibliography.md:17` `[3]` (SDM **Vol.3A**, order 253668) and `bibliography.md:18` `[4]` (SDM
**Vol.3B**, order 253669) carry the *identical* URL `https://cdrdv2.intel.com/v1/dl/getContent/671447`.
One of the two resolves to the wrong volume, so every `[3]`/`[4]` citation inherits an unverifiable link.
*Fix:* re-read the two Intel download endpoints and give each volume its own.

### 1.5 `05-vm-exit.md` enumerates the exit reasons it says it does not enumerate — **cosmetic**

`05-vm-exit.md:112` says "Basic exit reason values **between 68 and 74** … this chapter deliberately
does not enumerate them", while `:109` enumerates **68 (TPAUSE)** and `:110` enumerates **74 (Bus lock)**.
*Fix:* write "values 69 through 73".

### 1.6 The same erratum carries two confidences in three files — **cosmetic**

`12-vtd-faults-bios-siov.md:405-406` state the Intel 5500/5520 interrupt-remapping errata at `C:low`;
`errata.md:68` (E07) and `core-facts.md:74` state the same erratum at `C:high`. The divergence is
defensible (12 cites the unverified Intel spec-update `[201]`, errata cites the verified kernel thread
`[611]`) but nothing in the corpus says so, so a reader sees the same fact at two confidences.
*Fix:* add one clause to `12:405` saying the `C:low` applies to the *document metadata*, not to the
existence of the erratum.

---

## Class 2 — Orphaned facts (pointer target does not carry the promised fact)

Method: resolved every `` `NN-file.md` §X `` and `errata.md EN/ON` pointer (0 structurally dangling —
the linter covers that), then checked the *content* of each declared `Owner:` and "owned by X" target.

### 2.1 `errata.md` E07 `Owner: 11-vtd-interrupt-remapping.md` — target has nothing — **blocking**

`errata.md:71` names `11-vtd-interrupt-remapping.md` as the owner of the Intel 5520/5500
interrupt-remapping erratum. Chapter 11 contains **zero** occurrences of "erratum", "5520", "5500",
"X58", "#53" or "set_irq_remapping_broken". The fact actually lives in
`12-vtd-faults-bios-siov.md:400-410` (§12.8.3). This is the exact failure mode the corpus was
previously bitten by (06 → 01 for MBEC).
*Fix:* change E07's owner to `12-vtd-faults-bios-siov.md` §12.8.3.

### 2.2 `errata.md` O2 `Owner: 10-vtd-dma-remapping.md` — target has nothing — **blocking**

`errata.md:215` names chapter 10 as owner of the VT-d Rev 1.0 dating conflict. Chapter 10 contains no
occurrence of "2006", "Rev 1.0", "revision history" or "Abramson"; the whole conflict exists only in
`errata.md:209-215`. A reader routed to 10 and told to stop can never corroborate either side.
*Fix:* either add a two-line revision-history subsection to chapter 10, or mark O2's owner as
`errata.md` itself.

### 2.3 `errata.md` O5 `Owner: 16-performance.md` — target has nothing — **blocking**

`errata.md:236` names `16-performance.md` as owner of the H100 + TDX confidential-inference study.
Chapter 16 contains no occurrence of "H100", "TTFT", "Mistral", "Qwen3" or "2607.19353". The only
adjacent content is `18-comparison-amd-arm-riscv.md:244`, which points *back* at
`16-performance.md` §16.2.5 — and §16.2.5 (`16-performance.md:78`) carries a different study
(the 472% VMEXIT-latency ratio). The pointer chain 18 → 16 → (nothing) → errata → 16 is circular.
*Fix:* add the H100 result set to `16-performance.md` §16.2.5 with both identifiers, or reassign O5.

### 2.4 Three-way ownership of the VBS overhead conflict — **should-fix**

- `errata.md:227` (O4): "**Owner:** `16-performance.md`".
- `15-security.md:6` `Owns:` line claims "**the VBS overhead-figure conflict**".
- Both `15-security.md` §15.12 and `16-performance.md` §16.3.2 carry a full treatment, and SKILL.md
  §"Read the one chapter" says "cross-chapter restatement is prohibited".

*Fix:* pick one owner (16, per errata) and reduce the other to a one-line pointer.

### 2.5 `SKILL.md` and `00-quickref.md` route the same question to different chapters — **should-fix**

`SKILL.md:80` routing table sends "Overhead numbers — VBS, utility VMs, …" to `16-performance.md`
**only**. `references/00-quickref.md:117` sends "How much does VBS cost me?" to
"`15-security.md` §15.12, `16-performance.md` §16.3".
*Fix:* make SKILL.md's row read `16-performance.md` §16.3 **and** `15-security.md` §15.12, or strip
15's table.

### 2.6 `07-apic-virtualization.md:49` asserts a two-sided dispute while citing only one side — **cosmetic**

The claim states both the 2008 Xeon 7400 dating and the 2006 Core 2 dating, but cites only `[121]`
(AnandTech), which supports the 2008 side alone. The evidence for the 2006 side (`[622]`, the inxi
dump) appears only in `errata.md:202`.
*Fix:* add `[622]` to `07-apic-virtualization.md:49`.

### 2.7 `errata.md` E12 `Owner: 13-tdx.md` — target carries only part of the entry — **cosmetic**

`errata.md:110` names chapter 13 as owner. Chapter 13 does carry the SGX coupling (`13-tdx.md:429`),
but contains **zero** occurrences of "DCAP", "PCK" or "PCCS" — the shared attestation infrastructure
that E12 and `core-facts.md:85` both rest on.
*Fix:* add one claim to `13-tdx.md` §13.13.2 naming the DCAP/PCK/PCCS chain.

---

## Class 3 — Unreachable facts (a routed reader obeying the "Stop." rule never opens them)

Judged by: does a developer doing the chapter's core task need the fact?

### 3.1 The VBS overhead *conditions* exist only in a chapter the routing does not send you to — **blocking**

`SKILL.md:80` routes overhead questions to `16-performance.md`. `16-performance.md:138-142` gives the
three figures but **no hardware, no titles, no toggle definition**. The only place those conditions
exist is `15-security.md:374-376` (five titles, two APIs, i7-11700K / i7-10700K, "default VBS setting",
"high-end GPU configuration"). SKILL.md's own output standard (`SKILL.md:110`, "Numbers keep their
conditions") is therefore unsatisfiable for a reader who followed the routing and stopped.
*Fix:* move the conditions table into `16-performance.md` §16.3.2 and leave a pointer in 15.

### 3.2 The 5520/5500 erratum is filed where interrupt-remapping readers are never sent — **blocking**

`SKILL.md:74` routes "Interrupt remapping, **IRTE**, interrupt posting on the VT-d side" to
`11-vtd-interrupt-remapping.md`. The only documented interrupt-remapping *defect* on Intel silicon
lives in `12-vtd-faults-bios-siov.md:400-410`, and `errata.md:71` also points at 11 (see 2.1). Anyone
debugging an unreliable IR unit follows the routing to 11, reads errata, and is sent back to 11.
*Fix:* add a two-line pointer in `11-vtd-interrupt-remapping.md` §11.12 to `12` §12.8.3.

### 3.3 `07-apic-virtualization.md:437` — the APICv acceptance criterion is in the artifact index — **should-fix**

"A correctly configured full APICv stack leaves the first three of those [exit reasons 43, 44, 45] as
rare events and reduces the fourth [56] to writes with side effects the VMM genuinely has to model,
such as LVT and ICR." The words "rare" and "LVT" appear **nowhere else in chapter 07** (verified for
all lines < 424). This is the only statement of what a correct APICv bring-up should look like, and it
sits in §7.11 "Chapter artifact index", past the point a task-focused reader stops.
*Fix:* move it into §7.8 (virtual-interrupt delivery) and leave the index row as a pointer.

### 3.4 `06-address-translation.md:459` — the EPTP-list bound is in "Open items" — **should-fix**

"EPTP-switching via VMFUNC selects among at most **512** EPTP values held in the EPTP list" is stated
only in §6.13 Open items. Earlier in chapter 06 the EPTP index and list are discussed
(`06-address-translation.md:405-430`) without the 512 bound. It is recoverable from
`02-vmcs.md:314`, but a reader routed to 06 for "EPT structures … VMFUNC" and stopping does not get it.
*Fix:* restate the 512 bound in §6.11 under the deliberate-restatement exception of `SKILL.md:31`.

### 3.5 Per-chapter exit-reason sets live only in "Chapter artifact index" — **cosmetic**

`06-address-translation.md:453` (exit reasons 48/49/62/66) and `07-apic-virtualization.md:436`
(43/44/45/56) are the only places each chapter states its exit-reason set as a set. Both are faithful
restatements of `05-vm-exit.md:85-107`, so nothing is lost, but the index heading buries the most
useful two lines in each chapter.
*Fix:* promote both to the chapter opening, beside the `Owns:` line.

---

## Class 4 — Anchor-claim mismatch, judged by internal plausibility

No PDFs were consulted. Every finding is an anchor that is implausible *on its face* given the claim
it carries, or a section number outside the chapter that should hold it. Key control used: which
`SDM 3C §NN.x` subsections the chapter that **owns** that SDM chapter actually cites.

### 4.1 `15-security.md` anchors 115 of 115 claims to Intel, including Microsoft and Red Hat claims — **blocking**

Every single claim in `15-security.md` carries an `SDM`/`VT-d` Tier-1 anchor. This directly violates
the skill's own output standard at `SKILL.md:99-107`: "Platform and measurement claims cite their own
source, not Intel… Chapters `15`, `16`, `17` and `90` are where this applies." For comparison,
`16-performance.md` carries an Intel anchor on 4 of 69 claims and `17-windows-platform.md` on 17 of 101.

The subsections used are the tell. `15-security.md` cites `SDM 3C §31.3` ×12, `§31.3.2` ×13,
`§31.3.3.2` ×7, `§28.1.2` ×17, `§28.1.3` ×8 — while `06-address-translation.md`, which **owns**
SDM 3C Ch.31, cites only `§31.2` (6×) and never `§31.3`, and `03-nonroot-operation.md`, which **owns**
Ch.28, cites **no** `§28.x` anchor at all. Two chapters' worth of subsection numbers exist nowhere
outside `15-security.md`.
*Fix:* strip the Intel anchor from every non-Intel claim in chapter 15 and let the `[N]` Tier-2 source
stand alone, as `16-performance.md` already does.

### 4.2 `15-security.md:186` — a Red Hat capacity statement anchored to an address-translation subsection — **blocking**

"Red Hat states that disabling HT has the perceived effect of 50% fewer vCPUs for scheduling purposes"
carries `` `[SDM 3C §31.3.3.2]` ``. SDM 3C Ch.31 is "VMX Support for Address Translation"; it contains
no vCPU-scheduling or SMT-capacity content, and `[376]` (Red Hat) is the real source.
*Fix:* drop the anchor.

### 4.3 `15-security.md:314` and `:316` — Credential Guard and `LSAIso.exe` anchored to `SDM 3C §31.3` — **blocking**

"Credential Guard protects NTLM password hashes, Kerberos Ticket Granting Tickets…" and "the normal
LSA process talks to an isolated LSA process, LSAIso.exe" both carry `` `[SDM 3C §31.3]` ``. The SDM
documents no Microsoft product. Same pattern at `:278`, `:282`, `:288`, `:290`, `:296`, `:320`.
*Fix:* anchor to `[384]` / `[381]` (Microsoft Learn) only.

### 4.4 `15-security.md:44`, `:46`, `:61` — Hyper-V/VMware CVE claims anchored to `SDM 3C §28.1.3` — **should-fix**

CVE-2021-28476 (`vmswitch.sys`), the Pwn2Own 2025 VMware PVSCSI escape, and the VENOM/QEMU-USB
history all carry `` `[SDM 3C §28.1.3]` ``, a subsection `03-nonroot-operation.md` never cites.
*Fix:* keep `[393]` / `[377]` / `[375]` and drop the anchor.

### 4.5 Third-party measurements anchored to SDM chapters — **should-fix**

- `06-address-translation.md:34` "Shadow paging measured up to 29.2% slower" → `` `[SDM 3C Ch.31]` ``, real source `[109]`.
- `06-address-translation.md:35` "a 2009 vendor evaluation … 48% faster … 600% faster" → `` `[SDM 3C Ch.31]` ``, real source `[114]`.
- `06-address-translation.md:236`, `:258` (25% vConsolidate) → `` `[SDM 3C Ch.31]` ``.
- `07-apic-virtualization.md:16` (Intel LPC 2012, "up to 50% of VM exits") → `` `[SDM 3C Ch.32]` ``, real source `[116]`.
- `07-apic-virtualization.md:18` (1100/820/650 cycles) → `` `[SDM 3C Ch.32]` ``, real source `[124]`.
- `07-apic-virtualization.md:376` (KVM `perf bench sched pipe` +6.56%) → `` `[SDM 3C Ch.32]` ``, real source `[120]`.
- `07-apic-virtualization.md:409` (IPI cycle counts −22.21% / −15.98%) → `` `[SDM 3C Ch.32]` ``, real source `[117]`.

The SDM publishes no benchmark results. Note that `16-performance.md` carries the *same* figures with
no SDM anchor, which is the correct treatment.
*Fix:* remove the SDM anchors from these seven claims.

### 4.6 `06-address-translation.md:332` and `:333` — silicon history and a Xen study anchored to `§27.6.18` — **should-fix**

`:332` "its first silicon was the Broadwell generation of Intel Xeon processors in 2015" and `:333`
"A measurement study on Xen 4.7 reported PML shortening VM live-migration … by up to 10.18%" both
carry `` `[SDM 3C §27.6.18]` ``. The SDM states no microarchitecture introduction dates —
`errata.md:28` (E02) correctly sources the same fact to `[602][603]`.
*Fix:* anchor `:332` to `[602][603]` and `:333` to `[110]`.

### 4.7 `12-vtd-faults-bios-siov.md:405` and `:406` — chipset errata anchored to the VT-d spec — **should-fix**

Both carry `` `[VT-d 5.20 Ch.?]` `` for a claim whose subject is the *Intel 5500/5520 Chipset
Specification Update*. The VT-d architecture specification does not carry chipset errata; `[201]` is
the correct and only anchor.
*Fix:* delete the `VT-d 5.20 Ch.?` anchor from both.

### 4.8 `14-nested-virtualization.md` — KVM source-level detail anchored to SDM sections — **should-fix**

`:45` (KVM's vmcs01/vmcs12/vmcs02 naming) → `` `[SDM 3C §27.1]` ``; `:89` → `` `[SDM 3C §27.6.15]` ``;
`:95`, `:97` (`copy_shadow_to_vmcs12`) → `` `[SDM 3C §27.10]` ``; `:115` (`prepare_vmcs02_early()`) →
`` `[SDM 3C §27.3]` ``; `:127` → `` `[SDM 3C §27.6.4]` ``; `:141` → `` `[SDM 3C Ch.30]` ``; `:143` →
`` `[SDM 3C §27.9]` ``. The SDM names no KVM function. Real source in every case is `[301]`.
*Fix:* keep `[301]` and drop the anchors, or reword each claim so the anchored half is the
architectural rule and the KVM half is a separate sentence with its own citation.

### 4.9 `07-apic-virtualization.md:379` — a VT-d/Linux history claim anchored to the APIC-virtualization chapter — **cosmetic**

"Linux support for VT-d posted interrupts landed as a 25-patch series spanning the IOMMU, KVM and
VFIO subsystems in 2014–2015" carries `` `[SDM 3C Ch.32]` ``. Both the subject (VT-d) and the kind of
fact (kernel history) are outside that chapter; `[119]` is the source.
*Fix:* drop the anchor.

---

## Class 5 — Confidence and volatility miscalibration

### Quarantine leaks (`V:durable` on facts that will decay) — the most damaging subclass

`SKILL.md:135` is unambiguous: "If a fact has a GA date, a version number, a price or a market share,
it is in `90-dated-landscape.md` **and nowhere else**."

#### 5.1 `13-tdx.md:493` — a GA-status claim tagged `V:durable` outside chapter 90 — **blocking**

"TDX Connect is **not end-to-end generally available**: a working deployment requires a capable CPU,
an enabled host OS/hypervisor and a TEE-IO-capable device, and the specification set itself still
describes parts of the flow as in development." `C:medium` `V:durable`.

A negative GA status is still a GA status and decays the moment Intel ships. `errata.md:127` (E14)
explicitly routes this to "current status → `90-dated-landscape.md` §90.3.3", and
`90-dated-landscape.md:162` already carries it correctly as `V:dated`. This is a straight
quarantine leak that will be reported to a user without the 2026-09-16 re-verification warning
that `SKILL.md:117` requires.
*Fix:* retag `13-tdx.md:493` as an architectural claim about what a deployment *requires*, delete the
"not generally available" clause, and leave the status to §90.3.3.

#### 5.2 `13-tdx.md:153` — "unreleased-feature preview" tagged `V:durable` — **should-fix**

"`TDH.EXT.INIT` (60) and `TDH.EXT.MEM.ADD` (61) … the ABI specification marks these as an
**unreleased-feature preview**." Preview status is the single fastest-decaying fact class in this
domain (`core-facts.md:122` says so).
*Fix:* keep the leaf numbers as `V:durable`, move the release-status clause to §90.3.3 as `V:dated`.

#### 5.3 `13-tdx.md:231` — same defect — **should-fix**

"`TDG.INTR.POST` (leaf 32) … the ABI specification marks it as an **unreleased** Enhanced Interrupt
Virtualization **preview**." `V:durable`.
*Fix:* as 5.2.

#### 5.4 `13-tdx.md:39` — a document-currency claim tagged `V:durable` — **should-fix**

"Order 348552-004US, March 2023 — **it has not been revised since**, so its internal SDM chapter
cross-references are stale." "Has not been revised since" is true only as of the snapshot date.
*Fix:* reword to "as of the 2026-09-16 snapshot recorded in §90" or move the currency clause to 90.

#### 5.5 `18-comparison-amd-arm-riscv.md:157` — a default-enablement state tagged `V:durable` — **should-fix**

"APIC virtualization has shipped enabled by default on supporting Intel hardware, while AVIC **was
disabled by default in KVM for years**." `C:high` `V:durable`. `errata.md:76` (E08) records that the
upstream move to enable AVIC by default from Zen 4 was proposed in 2025-06 — a fact 18 omits, so the
durable-tagged sentence is already drifting.
*Fix:* add the Zen 4 qualifier and retag the enablement half as a pointer to §90.

#### 5.6 Specification revision/date/page-count metadata tagged `V:durable` — **cosmetic**

`13-tdx.md:37` ("Order 348549-008US, dated May 2026, and is 209 pages"), `:38` ("348551-008US … 335
pages"), and `core-facts.md:69` ("The **current** VT-d specification is Rev 5.20, April 2026, order
D51397-019"). All change on the next revision. Partly justified by the `normative-baseline` field in
`SKILL.md:18`, which is why this is cosmetic rather than a leak.
*Fix:* drop the word "current" from `core-facts.md:69` and say "the baseline revision for this skill".

### Confidence too high for the source tier

#### 5.7 `16-performance.md:260`, `:261`, `:262`, `:263` — four `C:high` claims whose only source is a blog — **should-fix**

All four cite `[410]` alone — `bibliography.md:210`, Brendan Gregg's KPTI/KAISER blog post, explicitly
marked **T3**. The bibliography's own tier key (`bibliography.md:5`) says T3 is "never the sole source
for an architectural claim"; these are quantitative performance claims (1%–800% range, 50000
syscalls/s ≈ 2%, 75000 syscalls/s → 5% / 3%, four-layer cost decomposition) with no T1 or T2 backing.
*Fix:* demote all four to `C:medium`, or add a T2 corroborator.

#### 5.8 `90-dated-landscape.md:130` — a GA date at `C:high` from a news site — **should-fix**

"Google Cloud C3 confidential VMs … reached GA on **2024-10-02**" `C:high`, sole source `[561]`
SiliconANGLE (T3). GA dates are the error class `errata.md:135` (E15) singles out as most
frequently mis-reported.
*Fix:* demote to `C:medium` pending a Google Cloud release-note citation.

#### 5.9 `90-dated-landscape.md:145` — a kernel merge version at `C:high` from Phoronix — **should-fix**

"TDX **host** support in KVM was merged into mainline Linux **6.16**" `C:high`, sole source `[574]`
Phoronix (T3). The corpus elsewhere cites kernel.org and LKML directly as T2 (`[301]`, `[575]`).
*Fix:* cite the merge commit or the pull-request thread and keep `C:high`, or demote.

### Confidence too low for the source

#### 5.10 `12-vtd-faults-bios-siov.md:405` and `:406` — `C:low` against an Intel primary document — **cosmetic**

`:405` cites `[201]`, which `bibliography.md:99` marks **T1** (Intel's own 5520/5500 Chipset
Specification Update), plus `[202]` (T2, Citrix). The identical fact is `C:high` at `errata.md:68`
and `core-facts.md:74`. The `C:low` is deliberate — `[201]`'s own annotation says "document metadata
not verified against the Intel PDF; cited at C:low" — but nothing at the point of use says so.
*Fix:* promote to `C:medium` and state that the low confidence attaches to the document metadata,
not to the erratum.

#### 5.11 `16-performance.md:190` — `C:low` on a fully-conditioned T2 breakdown — **cosmetic**

"A virtio-blk latency breakdown published on the KVM project wiki attributes 25699 ns (13.08%) to
in-guest processing, 7561 ns (3.85%) to guest/host switching…" `C:low`, source `[416]` (T2). The claim
carries no hedging language and the numbers are precise and attributed; the only weakness noted in
`bibliography.md:216` is that the wiki page is undated.
*Fix:* promote to `C:medium` and state the undated-source caveat inline.

---

## Method notes and residual risk

- Claim extraction, tier joining, cross-reference resolution, encoding/bit-position collision
  detection, near-duplicate-claim numeric diffing, tail-section reachability and bibliography URL
  deduplication were all done by script over the full corpus; spot checks were read by hand.
- **Verified clean, no findings:** all `` `NN-file.md` §X `` and `errata EN/ON` pointers resolve
  structurally (0 dangling); no VMCS field-encoding disagreement between `02-vmcs.md` and the feature
  chapters that restate them; no disagreement on the 24-memory-reference figure across 06, 14, 16,
  core-facts and errata E03; no disagreement on EPT-violation exit-qualification bits 3–7 across 05,
  06, core-facts and errata E16/E17; the VT-d Pitfalls sections in 10, 11 and 12 are faithful
  summaries of facts that all appear in their chapter bodies; `errata.md` does hold exactly 22 `E`
  entries and 6 `O` entries as `SKILL.md:44` claims; all seven `SKILL.md` routing section anchors exist.
- **Residual risk:** Class 4 is plausibility-only. Anchors flagged here may still be correct, and
  anchors *not* flagged may still be wrong — only the PDFs settle it. The highest-value next step is
  to check the 32 `SDM 3C §31.3*` and 26 `SDM 3C §28.1.*` anchors in `15-security.md` against the
  rev 092 PDF; if those subsections do not exist or do not say what is claimed, finding 4.1 escalates
  from a standards violation to fabricated citations.
