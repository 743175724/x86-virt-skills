# amd-virtualization eval — trap + diagnosis — scored by Claude Opus 5 — 2026-09-21

Skill commit: `5f2b73c` (taken from the session's git snapshot; no git command was run, per the
scoring instructions)
Scored categories: `answers/trap.md` (12) and `answers/diagnosis.md` (20). Key:
`questions.yaml`, matched by question `id`.
Scorer did not write the answers and did not write the skill.

| Category | Questions | `must_include` | `must_not_include` violations | Citations valid | Routing right first try |
|---|---|---|---|---|---|
| trap | 12 | **47 / 47 (100%)** | **0** | 12 / 12 (100%) | 12 / 12 |
| diagnosis | 20 | **133 / 139 (95.7%)** | **0** | 20 / 20 (100%) | 19 / 20 |
| **combined** | **32** | **180 / 186 (96.8%)** | **0** | **32 / 32 (100%)** | **31 / 32** |

`key-disputed` items: **2** (one excluded from the diagnosis denominator, one scored as a hit
because the answer states the specification-correct form the key gets wrong). Raw diagnosis
figure if the disputed item is counted as a miss anyway: 133 / 140 = 95.0% — still over the bar.

**Verdict: PASS.** `must_include` 96.8% ≥ 90%; `must_not_include` violations 0; citation
validity 100% ≥ 95%.

---

## Category: trap (12 questions)

| # | id | `must_include` | trap fired? | citation |
|---|---|---|---|---|
| 1 | trap-client-sev-cpuid | 4/4 | no — refuted | `errata.md E12` + `[no-spec][330]` measured dumps ✓ |
| 2 | trap-x2avic-cpuid-bit | 4/4 | no — refuted | `[APM3 App.E]` ✓ |
| 3 | trap-cmdbufrun-register | 4/4 | no — refuted | `[IOMMU 3.11 §3.4.16]` ✓ |
| 4 | trap-irte-bit0-name | 2/2 | no — refuted | `[IOMMU 3.11 §2.2.5]` ✓ |
| 5 | trap-iommu-mmio-window-size | 4/4 | no — refuted | `[IOMMU 3.11 §2.3]` ✓ |
| 6 | trap-vmexit-restores | 5/5 | no — refuted | `[APM2 §15.5.1]` ✓ |
| 7 | trap-vmload-vmsave-ss | 3/3 | no — refuted | `[APM2 §15.5.2]` ✓ |
| 8 | trap-two-dimensional-walk-count | 5/5 | no — refuted | `[NP-WP §4.2.2]` ✓ |
| 9 | trap-branch-type-confusion-cve | 4/4 | no — refuted | `[AMD-SB-1037]` + NVD `[520]` ✓ |
| 10 | trap-hyperv-image-name | 4/4 | no — see below | `[46] Windows Internals, Part 2, 7th ed.` ✓ |
| 11 | trap-enlightened-vmcb | 5/5 | no — refuted | `[464]` TLFS — nested virtualization ✓ |
| 12 | trap-vmgexit-encoding | 3/3 | no — refuted | `[APM3 §4 "VMGEXIT"]` ✓ |

**No failures in this category.** Every item in every key was found.

### Banned strings that fired inside a correction — recorded as *refuted, not asserted*

Per RUNNER.md "A refutation is not a violation." Each of the following contains a
`must_not_include` string in the sense of substring, and each takes the opposite position.

- `trap-client-sev-cpuid` — banned: "`Fn8000_001F EAX[1]` reads 0 on client Ryzen".
  **Refuted:** *"'SEV is an EPYC feature, so on a desktop Ryzen `Fn8000_001F EAX[1]` reads 0' is
  wrong — and it is wrong rather than merely imprecise."* and *"It depends on the generation, and
  on Zen+/2/3 desktop parts the bit reads **1**, not 0."*
- `trap-x2avic-cpuid-bit` — banned: "x2AVIC is EDX[14]".
  **Refuted:** *"`Fn8000_000A EDX[14]` is not x2AVIC — **bit 14 is Reserved**."*
- `trap-cmdbufrun-register` — banned: "`CmdBufRun` is at MMIO 0018h".
  **Refuted:** *"`CmdBufRun` is not in the Control Register at MMIO 0018h — it is in the **Status
  Register at MMIO 2020h**."*
- `trap-irte-bit0-name` — banned: "the field is RemapEm".
  **Refuted:** *"the misspelling that circulates in secondary material (`RemapEm`) appears nowhere
  in the specification, which uses `RemapEn` in **every one of the three IRTE tables**."*
- `trap-iommu-mmio-window-size` — banned: "the MMIO window is 14 KB".
  **Refuted:** *"14 KiB is not a size at all — it is a misreading of the `BaseAddress[31:14]`
  field width... There is no 14 KiB window."*
- `trap-vmexit-restores` — banned: "that is the whole list".
  **Refuted:** *"No — that is three of fourteen, and the fourteen are themselves an open set."*
- `trap-vmload-vmsave-ss` — banned: "VMLOAD and VMSAVE transfer SS".
  **Refuted:** *"VMLOAD/VMSAVE do **not** cover SS... **SS is not among the state VMLOAD/VMSAVE
  transfer.**"*
- `trap-two-dimensional-walk-count` — banned: "the worst case is 16 memory references" and
  "the APM states the 24-reference figure".
  **Refuted:** *"The worst case is **24** memory references, not 16"* and *"The worst-case
  reference count **is not stated in the APM**... **An anchor of the form `[APM2 §15.25.x]` on
  this number is a fabrication.**"*
- `trap-branch-type-confusion-cve` — banned: "cite CVE-2022-23816".
  **Refuted:** *"**CVE-2022-23816 is REJECTED at NVD** and must not be cited"* and *"Do not cite
  CVE-2022-23816 at all."*
- `trap-hyperv-image-name` — banned: "the image is hvix64.exe". The answer contains *"on Intel
  systems the image is `Hvix64.exe`"*, which is **required by the key's own `must_include` item
  2**, and immediately states *"on **AMD systems it is `Hvax64.exe`**"*. Not a violation.
- `trap-enlightened-vmcb` — banned: "AMD has no enlightened VMCB counterpart", "AMD has nothing
  on this side", "there is no enlightenment interface on AMD".
  **Refuted:** *"**That does not mean AMD has no enlightenment interface, and the negative form of
  this statement is a trap.**"* and *"a sharper statement than 'AMD has nothing here'."*
- `trap-vmgexit-encoding` — banned: "VMGEXIT is `F3 0F 01 D9` only", "the `F2` form is not
  architectural".
  **Refuted:** *"No. VMGEXIT's opcode is **`F2/F3 0F 01 D9`** — both prefixes... **both are
  architectural**."*

### Independent verification of the trap answers against the specification

A 47/47 result warrants a check that the answers are not agreeing with a wrong key. Four
load-bearing values were verified in the local PDF text dumps at
`C:/Users/Administrator/AppData/Local/Temp/amd-spec/txt/`:

- `APM3-24594-3.38.txt` line 42010 `18 x2AVIC`, line 42022 `15 VMSAVEvirt` — confirms
  `trap-x2avic-cpuid-bit`.
- `APM3-24594-3.38.txt` lines 26894–26895: `Opcode 0F 01 D9` (VMMCALL) then `F2/F3 0F 01 D9`
  (VMGEXIT) — confirms `trap-vmgexit-encoding`, including that the unprefixed form on the same
  page is VMMCALL.
- `IOMMU-48882-3.11.txt` line 12628: *"CmdBufRun: Command buffer is running. RO... When
  CmdBufRun = 0, the IOMMU will not fetch commands until software programs MMIO Offset
  0018h[CmdBufEn]... CmdBufRun is level-sensitive"* — confirms `trap-cmdbufrun-register`
  including the level-sensitivity clause.
- `IOMMU-48882-3.11.txt` lines 6188 and 10276: 16 Kbytes when `PCSup` = 0, 512 Kbytes when
  `PCSup` = 1, `Base Address[18:14]` = 0 in the 512-Kbyte case — confirms
  `trap-iommu-mmio-window-size`.

---

## Category: diagnosis (20 questions)

| # | id | `must_include` | trap fired? | citation | route |
|---|---|---|---|---|---|
| 1 | diag-svm-unavailable-chain | 8/8 | n/a | `[APM2 §15.30.1]` ✓ | §0.2 → 01 §1.5 ✓ |
| 2 | diag-exit-code-80h | 6/6 | no — refuted | `[APM2 App.C]` ✓ | §0.2 → 05 §5.1 ✓ |
| 3 | diag-stale-guest-tlb | **4/7** | n/a | `[APM2 §15.16.1]` ✓ | §0.2 → 06 §6.8 ✓ |
| 4 | diag-avic-incomplete-ipi | 6/6 † | no | `[APM2 Table 15-27]` ✓ | §0.2 → 07 §7.2 ✓ |
| 5 | diag-io-page-fault | 9/9 | n/a | `[IOMMU 3.11 Table 57]` ✓ | §0.2 → 09 §9.6 ✓ |
| 6 | diag-passthrough-interrupts-missing | 7/7 | no — refuted | `[IOMMU 3.11 Table 9]` ✓ | §0.2 → 10 §10.4 ✓ |
| 7 | diag-sev-launch-failure | **4/6** | n/a | `[SEV-API 3.24 Table 14]` ✓ | §0.2 → 12 §12.8 ✓ |
| 8 | diag-vc-storm-early-boot | **6/7** | n/a | `[GHCB 2.04 §2.5]` ✓ | §0.2 → 13 §13.2 ✓ |
| 9 | diag-attestation-verify-failure | 6/6 | n/a | `[SNP-ABI 1.59 Table 27]` ✓ | §0.2 → 14 §14.11 ✓ |
| 10 | diag-vmm-cannot-use-amd-v | 8/8 | no | `[101]` MS Learn ✓ | §0.2 → 16 §16.1 ✓ |
| 11 | diag-probe-chain-reads-clean | 7/7 | n/a | `[463]` TLFS ✓ | §0.2 → 16 §16.1 ✓ |
| 12 | diag-driver-rejected-memory-integrity | 7/7 | n/a | `[461]` MS Learn ✓ | SKILL.md → 16 §16.3.2 ✓ |
| 13 | diag-kernel-dma-protection-off | 8/8 | n/a | `[462]` MS Learn ✓ | SKILL.md → 16 §16.4 ✓ |
| 14 | diag-nested-hyperv-on-ryzen-7000 | 7/7 | no — refuted | `[460]` MS Learn ✓ | SKILL.md → 16 §16.5 ✓ |
| 15 | diag-vmware-virtualbox-coexistence | 6/6 | no — refuted | `[47]` Broadcom ✓ | §0.5 → 16 §16.6 ✓ |
| 16 | diag-gpu-passthrough-client | 7/7 | n/a | `[467]` MS Learn ✓ | SKILL.md → 16 §16.8 ✓ |
| 17 | diag-confirm-vbs-status | 7/7 | n/a | `[465]` MS Learn ✓ | SKILL.md → 16 §16.10 ✓ |
| 18 | diag-vbs-cost-figure | 7/7 | no — refuted | `[554]` ComputerBase ✓ | §0.2 → 18 §18.2 ✓ |
| 19 | diag-sev-es-disabled-on-snp-host | 5/5 ‡ | no — refuted | `[AMD-SB-3023]` ✓ | **§0.2 mis-route**, recovered via `errata.md` E17 |
| 20 | diag-avic-default-state | 8/8 | n/a | `[610]` kernel.org `avic.c` ✓ | SKILL.md → 90 §90.6 ✓ |

† item 6 is `key-disputed`; the answer states the specification-correct form, so it is scored a hit.
‡ item 6 is `key-disputed` and **excluded from the denominator** (6 key items → 5 scored).

### Citation-tier check

The eight Windows answers, the CVE answer and the performance answer were checked specifically
for a substituted AMD manual anchor, which would be wrong there. **None was found.** Every one
cites Microsoft Learn, the TLFS, Broadcom/Oracle, AMD-SB-3023 or ComputerBase, and four of them
say so explicitly — e.g. `diag-vbs-cost-figure`: *"this is a measurement, so per SKILL.md it
cites its own source — **ComputerBase (Tier-3), quoted attributively** — not the APM. Demanding
an APM anchor here would produce a fabricated citation."* All bracket IDs were resolved against
`references/bibliography.md` and point at the documents the key names ([46], [47], [101], [460]–
[467], [554], [610] all check out).

### Refutations in the diagnosis set (banned string present, position opposite)

- `diag-exit-code-80h` — banned: "AMD's statement in Appendix C is wrong". **Refuted:** *"Your
  table is wrong, but AMD's sentence is not"* and *"do not tell people AMD's Appendix C sentence
  is wrong; it is true under the contiguous-bit-array reading."*
- `diag-passthrough-interrupts-missing` — banned: "check that `RemapEm` is set". **Refuted:**
  *"(Note the spelling: the field is **`RemapEn`**, not `RemapEm` — `errata.md` E03.)"*
- `diag-nested-hyperv-on-ryzen-7000` — banned: "Hyper-V nested virtualization is Intel-only".
  **Refuted:** *"`errata.md` E13 exists because the claim 'Hyper-V nested virtualization is
  Intel-only' is a live misconception."*
- `diag-vmware-virtualbox-coexistence` — banned: "turn Hyper-V off first". **Refuted:** *"**No —
  and the old 'turn Hyper-V off first' advice is superseded.**"*
- `diag-vbs-cost-figure` — banned: "memory integrity costs 5-25%". **Refuted:** *"The widely
  relayed ranges **'5–10% system-wide' and '5–25% in games'** have **no traceable primary
  source**... They are recorded as **unresolved rather than averaged** with the 6%."*
- `diag-sev-es-disabled-on-snp-host` — banned: "the trigger is the CPU supporting SNP".
  **Refuted:** *"**The trigger is SNP being *enabled*, not merely *supported*.**"*

---

## Failures

### diag-stale-guest-tlb — 4/7

**Asked:** "I changed a nested page table entry and the guest keeps using the old translation.
What am I missing?"

**Missing item 1:** "VMRUN and `#VMEXIT` write CR0, CR3, CR4 and EFER but those writes do not
flush the TLB"

**Answered (verbatim, the nearest the answer comes):**
> "- **Guest paging-mode change made by the VMM editing the VMCB** requires a flush; the state
> that counts is CR0 (PG, WP, CD, NW), CR3 (any bit), CR4 (PGE, PAE, PSE) and EFER (NXE, LMA,
> LME). `[APM2 §15.16]` `[1]`"

The four registers are named, but as a rule about the VMM editing the VMCB. The answer never
states that VMRUN's and `#VMEXIT`'s own writes to those registers do not flush — which is the
mechanism that makes the symptom possible.

**Diagnosis: fact present but not found — and mis-filed by the chapter.** The claim exists
verbatim at `06-nested-paging.md:307`: *"VMRUN and `#VMEXIT` write CR0, CR3, CR4 and EFER but
**do not flush the TLB**, so the VMM must explicitly invalidate any guest translations its own
actions invalidated. `[APM2 §15.16]`"* — but it sits in **§6.10 "Shadow paging without nested
paging"**, a section a reader diagnosing a *nested-paging* staleness bug will deliberately skip.
Both `00-quickref.md` §0.2 and `SKILL.md` §Routing send this symptom to §6.8. This is a genuine
corpus defect, not an answering defect.

**Missing item 5:** "the alternative is to allocate the guest a new ASID and not reuse the old
one until the whole TLB has been flushed at least once"

**Answered (verbatim, nearest):**
> "Whole-ASID invalidation via `TLB_CONTROL`, not per-page `INVLPGA`, is the correct baseline
> once nested paging is on."

Nothing in the answer proposes allocating a fresh ASID; the string "new ASID" does not occur.

**Diagnosis: fact present but not found.** `06-nested-paging.md:212`, in **§6.7 "ASID:
allocation, exhaustion and reuse"**: *"On implementations without a way to selectively flush all
translations of one specified ASID, software may flush a guest's TLB entries effectively by
allocating it a **new** ASID and not reusing the old ASID until the entire TLB has been flushed
at least once. `[APM2 §15.16.1]`"* Right chapter, adjacent section, not pulled.

**Missing item 7:** "clean bit 4 (`NP`) covers `N_CR3` and `G_PAT`, so clearing it does not
substitute for a TLB command"

**Answered:** the phrase "clean bit" does not appear anywhere in this answer. The closest
statement of the same shape is the opening:
> "**Answer:** You are missing the `TLB_CONTROL` field on the VMRUN that re-enters the guest.
> AMD tags TLB entries by ASID and does **not** invalidate them for you when you edit a nested
> page table."

**Diagnosis: fact present but not found.** `06-nested-paging.md:94`, in **§6.3 "Replicated paging
state"**: *"In the VMCB clean field, bit 4 (`NP`) covers exactly `N_CR3` and `G_PAT` and bit 2
(`ASID`) covers the ASID, while `TLB_CONTROL` is on the explicit list of fields that are never
cached and have no clean bit — so a clean-bits optimisation can never substitute for a TLB
command. `[APM2 §15.15.3]`"* Third of three facts for one symptom living outside the section the
routing table names.

---

### diag-sev-launch-failure — 4/6

**Asked:** "My SEV guest will not launch: the firmware returns `INVALID_PLATFORM_STATE`, and
later `WBINVD_REQUIRED`. What is going on?"

**Missing item 5:** "`ACTIVATE` also requires a non-zero, valid, not-in-use SEV ASID on an
inactive guest"

**Answered (verbatim — same command, same spec section, different precondition):**
> "`ACTIVATE` then also fails, because it requires that a successful `DF_FLUSH` has been executed
> since the last `DEACTIVATE` for that ASID. `[SEV-API 3.24 §6.19.1]` `[8]`"

**Diagnosis: fact present but not found.** `12-sev.md:81`, in **§12.3 "ASIDs and encryption
keys"**: *"ACTIVATE additionally requires that the ASID be non-zero, be a valid SEV ASID, and
**not be currently used by another guest**; the guest must be inactive at the time. `[SEV-API
3.24 §6.19.1]`"* — the answer cites that exact section for a neighbouring sentence, so the page
was in hand; the three preconditions were not carried over.

**Missing item 6:** "the ASID range matters: a SEV-ES guest must use an ASID from 1h to
`MIN_SEV_ASID - 1`, and a SEV guest without SEV-ES from `MIN_SEV_ASID` to the maximum, where
`MIN_SEV_ASID` is `Fn8000_001F[EDX]` and the maximum is `Fn8000_001F[ECX]`"

**Answered:** the token `MIN_SEV_ASID` does not appear in the answer. The ASID discussion is
entirely about reuse:
> "1. **`DEACTIVATE`** the guest — the firmware uninstalls the key from the memory controller,
> marks the ASID invalid on all cores, and **records that a DF_FLUSH is required for that
> ASID**."

**Diagnosis: fact present but not found.** `12-sev.md:79`, **§12.3**: *"If a guest is SEV-ES
enabled its ASID must be **at least 1h and at most (MIN_SEV_ASID − 1)**; if it is not SEV-ES
enabled its ASID must be **at least MIN_SEV_ASID and at most the maximum SEV ASID available**.
`MIN_SEV_ASID` comes from `Fn8000_001F[EDX]` and the maximum from `Fn8000_001F[ECX]`."* Both
misses are the same root cause: `00-quickref.md` §0.2 routes "SEV guest fails to launch" to
**§12.8**, and the two ASID preconditions live in **§12.3**.

---

### diag-vc-storm-early-boot — 6/7

**Asked:** "My SEV-ES guest hangs very early in boot, apparently in a `#VC` loop, before it
reaches long mode."

**Missing item 6:** "until then the only usable channel is the GHCB MSR protocol itself - for
example the CPUID request at `GHCBInfo` `0x004`, whose response `0x005` returns one register
selected by `GHCBData[31:30]`"

**Answered (verbatim — first clause satisfied, the worked example absent):**
> "1. **The guest must use the GHCB *MSR protocol* before it can use a GHCB page at all.** The
> MSR protocol is what a guest uses when it cannot yet write the GHCB page in the clear — during
> early boot, and for the small set of operations that must work without one. `GHCBInfo` is MSR
> bits 11:0 and `GHCBData` bits 63:12. `[GHCB 2.04 Table 2]`, `[GHCB 2.04 §2.3]` `[9]`"

The strings `0x004`, `0x005` and `[31:30]` appear nowhere in the answer. Scored a miss under the
literal rule, with the leading clause acknowledged as satisfied.

**Diagnosis: fact present but not found.** `13-sev-es-ghcb.md:194–195` tabulate `0x004` CPUID
Request / `0x005` CPUID Response, and line 214, in **§13.5 "The GHCB MSR protocol"**, carries the
full claim: *"The CPUID request (`0x004`) carries the function in `GHCBData[63:32]` and the
register selector in `GHCBData[31:30]` — `0b00` EAX, `0b01` EBX, `0b10` ECX, `0b11` EDX..."* The
answer demonstrably read §13.5 (it quotes the SEV Information Response and the Termination
Request from it), so this is a surfacing failure inside a section that was open, not a routing
or content gap.

---

## `key-disputed` items

### 1. diag-avic-incomplete-ipi — `must_include` item 6 names the wrong table

**The key says:** *"for directed interrupts an invalid **Logical APIC ID Table** entry causes a
`#VMEXIT`, while for broadcast IPIs invalid entries are simply ignored"*

**The answer says:** *"**Directed versus broadcast differ at the physical-table lookup:** for
directed interrupts an invalid entry causes a `#VMEXIT`; for broadcast IPIs invalid entries are
simply ignored. `[APM2 §15.29.6.1]` `[1]`"*

**The corpus says** (`07-virtual-interrupts-avic.md:280`): *"At the physical-table lookup the
rule differs by addressing: for **directed** interrupts an invalid entry causes a `#VMEXIT`,
while for **broadcast** IPIs invalid entries are simply ignored. `[APM2 §15.29.6.1]`"*

**The specification says** (`APM2-24593-3.45.txt:28094`, §15.29.6.1, step 4 of the IPI
algorithm): *"Lookup the vAPIC backing page address in the **Physical APIC table** using the
guest physical APIC ID as an index into the table. For directed interrupts, if the selected table
entry is not valid, cause a #VMEXIT. For broadcast IPIs, invalid entries are ignored."*

**Which is right:** the answer and the corpus. The directed/broadcast asymmetry is a property of
step 4, the **Physical** APIC ID table lookup. The Logical APIC ID Table is step 3, where an
invalid entry causes a `#VMEXIT` unconditionally — there is no broadcast exemption there,
because broadcast IPIs *skip* the logical resolution entirely (step 2 jumps straight to step 4).
The key's wording would have a scorer mark a specification-correct answer wrong, and would reward
an answer that told a VMM author to look for the broadcast exemption in the wrong table.
**Scored as a hit for the answer. The key item should read "Physical APIC ID Table".**

### 2. diag-sev-es-disabled-on-snp-host — `must_include` item 6 assigns CVE-2025-48517 three firmware levels it does not have

**The key says:** *"the companion CVE-2025-48517 covers an SEV-ES guest being given an ASID from
the range reserved for SNP guests, **fixed at the same firmware levels - 1.37.23, 1.37.31 and
1.37.41**"*

**The answer says:** *"**CVE-2025-48517** — 'SEV-ES guest can be given an ASID from the range
reserved for SNP guests' — affects **EPYC 9005 "Turin"/"Turin Dense" only**, mitigated by **SEV
FW 1.37.41 only** (TurinPI 1.0.0.6, 2025-06-30), scored **4.6 Medium** by AMD."*

**The corpus says** (`17-security.md:49`, the CVE table in §17.1 — the section the key's own
`chapter:` field names as owner): `| CVE-2025-48517 | — | AMD-SB-3023, 2026-02-10 | **EPYC 9005
"Turin" / "Turin Dense" only** | SEV-ES guest can be given an ASID from the range reserved for SNP
guests | **SEV FW 1.37.41 only** (TurinPI 1.0.0.6, 2025-06-30) |`

**Where the key's three numbers actually come from** (`90-dated-landscape.md:19`): *"AMD-SB-3023
... lists the fixed SEV firmware as **1.37.23 for EPYC 7003 'Milan'**, **1.37.31 for EPYC 8004
'Siena' and for EPYC 9004 'Genoa' / 'Bergamo'**, and **1.37.41 for EPYC 9005 'Turin' / 'Turin
Dense'**."* Those are the bulletin's **per-generation** fixed levels for the bulletin as a whole
— they are not all applicable to a CVE that affects only one generation.

**Which is right:** the answer. A CVE affecting Turin only cannot be "fixed at" the Milan and
Genoa firmware levels. Two levels of the corpus agree with the answer and the key conflates a
bulletin-wide table with a per-CVE row. **Excluded from the denominator** (question 19 scored
5/5 rather than 5/6). Counting it as a miss anyway would put the diagnosis category at 134/141 =
95.0%, still a pass.

---

## Borderline calls, recorded so the score is auditable

Five diagnosis items were composite — a fact plus a subordinate clause — where the answer carried
the fact but not the clause. All five were scored **hits**. If every one were flipped to a miss
the category would be 128/139 = 92.1%, so the verdict does not depend on these calls.

1. `diag-stale-guest-tlb` item 4 — key: "`INVLPGA` invalidates by guest virtual address **and
   ASID**". The answer states *"Its address operand is **always interpreted as a guest virtual
   address**"* and the no-GPA limitation verbatim, but never says the ASID is the second operand.
2. `diag-avic-incomplete-ipi` item 5 — key: "...**and the hypervisor must deliver the interrupt
   itself or schedule the target**". The answer establishes `ID = 1` as the ordinary case and the
   `IsRunning` maintenance rule (*"`IR` must be maintained on **every vCPU schedule and
   unschedule**"*) but does not spell out the remedy in those terms.
3. `diag-attestation-verify-failure` item 6 — key: "check `VERSION` **at offset `00h`**". The
   answer gives the 3h/5h/6h progression and the parser consequence, without the offset.
4. `diag-vmm-cannot-use-amd-v` item 5 — key: "the product is reporting the symptom, not the cause
   — **nothing on the machine is misconfigured**". The answer opens *"Your hypervisor is reporting
   the symptom, not the cause"*; the "nothing is misconfigured" half appears only in the adjacent
   `diag-probe-chain-reads-clean` answer.
5. `diag-probe-chain-reads-clean` item 3 — key: "...**together with the maximum hypervisor CPUID
   leaf**". This answer gives leaf `0x40000000` → "Microsoft Hv" without the max-leaf return; the
   `diag-confirm-vbs-status` answer does give it.

One trap item was also composite: `trap-two-dimensional-walk-count` item 4, "neither the APM nor
the Intel SDM states this figure — **both** give only per-dimension walk lengths". The answer
states the first half verbatim and the second half for the APM alone (*"which gives only the
per-dimension walk lengths"*). Scored a hit.

---

## Routing

**Trap: 12/12 on first try.** Each answer names the owning chapter and section and cross-checks
it against the `errata.md` entry that owns the same misconception. All twelve were verified
against `SKILL.md` §Routing directly — e.g. "Virtual interrupts... AVIC, x2AVIC, the doorbell" →
`07-virtual-interrupts-avic.md`, "IOMMU MMIO registers... " → `08-iommu-architecture.md`,
"**what AMD has instead of VMCS shadowing**" → `15-nested-virtualization.md`.

**Diagnosis: 19/20 on first try**, as the answers self-report.

- 12 resolved from `00-quickref.md` §0.2 or §0.5 directly. Verified against the §0.2 table.
- 6 have **no §0.2 row** and were resolved from `SKILL.md` §Routing instead
  (`diag-driver-rejected-memory-integrity`, `diag-kernel-dma-protection-off`,
  `diag-nested-hyperv-on-ryzen-7000`, `diag-gpu-passthrough-client`, `diag-confirm-vbs-status`,
  `diag-avic-default-state`). Confirmed: §0.2 carries no row for memory integrity, Kernel DMA
  Protection, nested Hyper-V, GPU passthrough, VBS confirmation or AVIC defaults. All six landed
  in the right chapter; for four of them `16-windows-platform.md` §16.1.3's own symptom table then
  named the exact section. This is the routing table working as designed, not a mis-route.
- **1 §0.2 mis-route**, self-reported: `diag-sev-es-disabled-on-snp-host`. §0.2's nearest row
  ("SEV guest fails to launch / firmware returns an error") points at `12-sev.md` §12.8, which is
  not the owner; the answer reached `17-security.md` §17.1 from `errata.md` E17, which SKILL.md
  step 3 makes mandatory. §0.2 *does* carry a row `"Is this CVE relevant to me?" → 17-security.md
  §17.1`, but it is only reachable by a reader who already knows the symptom is a CVE — which is
  precisely what this question hides. Counted against routing.
- **1 within-chapter section drift**, self-reported: `diag-avic-incomplete-ipi` went to
  `07-virtual-interrupts-avic.md` §7.2 while the decode tables are at §7.8.1. §0.2 itself says
  §7.2, so the drift belongs to the quickref row, not to the answer. Right chapter; not counted
  as a mis-route.

---

## Notes — skill defects this scoring exposes

All six genuine `must_include` misses are **"fact present but not surfaced"**. Not one is a
content gap, and not one is a wrong-chapter route. Per RUNNER.md's failure table that means the
chapters bury facts the routing table has already promised, and the fix is placement, not new
content.

1. **`06-nested-paging.md` scatters one symptom's answer across four sections.** §0.2 and
   `SKILL.md` both send "guest TLB entries are stale" to **§6.8**, but three of the key's seven
   facts are elsewhere in the chapter: §6.3 (clean bit 4), §6.7 (new-ASID alternative) and —
   worst — **§6.10 "Shadow paging without nested paging"** for *"VMRUN and `#VMEXIT` write CR0,
   CR3, CR4 and EFER but do not flush the TLB"*. That claim is about nested paging's world
   switch, is cited `[APM2 §15.16]`, and is filed under the section about not using nested paging.
   It is the single highest-value fix in this run: move it into §6.8 (or cross-reference it from
   the §6.8 decision table), and add a §6.8 pointer to §6.3 and §6.7.
2. **`12-sev.md` splits launch-failure diagnosis between §12.3 and §12.8.** §0.2 names §12.8;
   the two ASID preconditions a failing `ACTIVATE` needs are in §12.3. A one-line forward
   reference from §12.8 to §12.3's ASID rules would close both misses.
3. **`13-sev-es-ghcb.md` §13.5 buries the MSR-protocol CPUID request.** The answer read §13.5 and
   still missed `0x004`/`0x005`/`GHCBData[31:30]`; the early-boot narrative in §13.2 stops at
   "use the MSR protocol" without naming the one NAE-free request an early-boot guest actually
   issues.
4. **`00-quickref.md` §0.2 has no row for a mitigation-induced functional regression** ("a
   firmware update disabled SEV-ES"). The only route in is the CVE row, which requires knowing in
   advance that a CVE is involved. Adding a symptom row — "a feature stopped working after a
   firmware or microcode update" → `17-security.md` §17.1 — would remove the one mis-route in
   this set.
5. **Two key items in `questions.yaml` are themselves wrong** (see `key-disputed` above): the
   AVIC directed/broadcast rule is misattributed to the Logical APIC ID Table, and
   CVE-2025-48517's mitigation is given three firmware levels when the corpus and the bulletin
   give it one. Both should be corrected in the key before the next run, because as written they
   penalise the specification-correct answer.

Nothing in either category produced a `must_not_include` violation. Every trap question named its
misconception in order to correct it, and eleven of the twelve stated their position in the first
sentence of the answer — the pattern RUNNER.md's refutation rule exists to protect.
