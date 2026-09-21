# amd-virtualization eval — lookup + mechanism — scored by Claude Opus 5 — 2026-09-21

Skill commit: `5f2b73c` (taken from the session's git snapshot; no git command was run, per the
scoring instructions). Working tree was dirty: `references/errata.md`, `index.json`,
`questions.yaml` and `README.md` all carry uncommitted edits, which matters for one of the
disputed keys below.
Scored categories: `answers/lookup.md` (24) and `answers/mechanism.md` (24). Key:
`questions.yaml`, matched by question `id`.
Scorer did not write the answers and did not write the skill.

| Category | Questions | `must_include` | `must_not_include` violations | Citations valid | Routing right first try |
|---|---|---|---|---|---|
| lookup | 24 | **147 / 152 (96.7%)** | **0** | 24 / 24 (100%) | 24 / 24 |
| mechanism | 24 | **170 / 170 (100%)** | **0** | 24 / 24 (100%) | 24 / 24 |
| **combined** | **48** | **317 / 322 (98.4%)** | **0** | **48 / 48 (100%)** | **48 / 48** |

`key-disputed` items: **2**, both in `mechanism` and both excluded from its denominator
(172 raw items → 170 scorable). Both are cases where the answer states the
specification-correct form and the key states something the APM contradicts — exactly the
failure mode the dispute clause exists for. If they were counted as misses anyway,
mechanism would be 170 / 172 = 98.8% and combined 317 / 324 = 97.8% — still over the bar.

**Verdict: PASS.** `must_include` 98.4% ≥ 90%; `must_not_include` violations 0; citation
validity 100% ≥ 95%.

Independent verification: every load-bearing value quoted below was checked against the
local PDFs at `C:/Users/Administrator/AppData/Local/Temp/amd-spec/`, not against the corpus
alone — including the two wide tables (`APM2 Table B-1`, `Table B-2`) read with
`pdftotext -layout` and column-realigned by hand, because the plain text extraction shifts
the offset column by one row. No shared key/answer error survived that check.

---

## Category: lookup (24 questions)

| # | id | `must_include` | trap | citation | route |
|---|---|---|---|---|---|
| 1 | amd-document-set | 8/8 | — | `00-quickref.md §0.1` ✓ | ✓ |
| 2 | vm-cr-msr-layout | 7/7 | — | `[APM2 Figure 15-27]` ✓ | ✓ |
| 3 | vm-hsave-pa-rules | 6/6 | — | `[APM2 §15.30.4]` ✓ | ✓ |
| 4 | fn8000-0001-ecx-bit2-scope | 5/5 | — | `[APM3 App.E]` ✓ | ✓ |
| 5 | vmcb-clean-bit-map | **7/8** | — | `[APM2 Figure 15-4]` ✓ | ✓ |
| 6 | int-ctl-60h-layout | 6/6 | — | `[APM2 Table B-1]` ✓ | ✓ (see note R1) |
| 7 | vmcb-state-save-offsets | 8/8 | — | `[APM2 Table B-2]` ✓ | ✓ |
| 8 | intercept-vector-4-and-5 | 5/5 | refuted ×2 | `[APM2 Table B-1]` ✓ | ✓ |
| 9 | msrpm-ranges-and-encoding | 5/5 | — | `[APM2 Table 15-8]` ✓ | ✓ |
| 10 | exit-codes-60h-61h-band | **7/8** | — | `[APM2 App.C]` ✓ | ✓ |
| 11 | npf-exitinfo1-bits | 7/7 | refuted ×3 | `[APM2 §15.36.10]` ✓ | ✓ |
| 12 | tlb-control-values | 7/7 | — | `[APM2 Table 15-9]` ✓ | ✓ |
| 13 | avic-id-table-entries | 6/6 | — | `[APM2 Table 15-23]` ✓ | ✓ |
| 14 | avic-doorbell-msr | 4/4 | — | `[APM2 Figure 15-22]` ✓ | ✓ |
| 15 | iommu-control-register-bits | **5/7** | — | `[IOMMU 3.11 §3.4.1]` ✓ | ✓ |
| 16 | iommu-event-codes | 5/5 | — | `[IOMMU 3.11 §2.5]` ✓ | ✓ |
| 17 | dte-translation-fields | 8/8 | — | `[IOMMU 3.11 Figure 7]` ✓ | ✓ |
| 18 | irte-guest-mode-format | 6/6 | refuted | `[IOMMU 3.11 Table 23]` ✓ | ✓ |
| 19 | fn8000-001f-fields | 5/5 | — | `[APM3 App.E]` ✓ | ✓ |
| 20 | sev-status-bit-map | 6/6 | refuted | `[APM2 §15.34.10]` ✓ | ✓ |
| 21 | sev-firmware-error-codes | 5/5 | — | `[SEV-API 3.24 Table 14]` ✓ | ✓ |
| 22 | ghcb-layout-offsets | **6/7** | not asserted | `[GHCB 2.04 Table 3]` ✓ | ✓ |
| 23 | snp-instructions-and-return-codes | 8/8 | — | `[APM3 §4 "RMPUPDATE"]` ✓ | ✓ |
| 24 | attestation-report-fields | 5/5 | refuted | `[SNP-ABI 1.59 Table 27]` ✓ | ✓ |

**Totals: 147 / 152 (96.7%), 0 trap violations, 24 / 24 citations valid.**

## Category: mechanism (24 questions)

| # | id | `must_include` | trap | citation | route |
|---|---|---|---|---|---|
| 1 | clean-bits-mechanism | 8/8 | — | `[APM2 §15.15.2]` ✓ | ✓ |
| 2 | intercept-priority-ordering | 7/7 | — | `[APM2 §15.7]` ✓ | ✓ |
| 3 | tsc-offset-and-ratio-composition | 6/6 | — | `[APM2 §15.30.5]` ✓ | ✓ |
| 4 | vmrun-ordering | 8/8 | — | `[APM2 §15.5.1]` ✓ | ✓ |
| 5 | vmrun-consistency-checks | 5/5 **+1 key-disputed** | refuted ×2 | `[APM2 §15.5]` ✓ | ✓ |
| 6 | gif-stgi-clgi-vgif | 7/7 | — | `[APM2 §15.17]` ✓ | ✓ (2nd chapter, predicted) |
| 7 | event-injection-and-reinjection | 8/8 | — | `[APM2 §15.20]` ✓ | ✓ |
| 8 | nested-permission-combining | 8/8 | — | `[APM2 §15.25.7]` ✓ | ✓ |
| 9 | memory-type-combining | 7/7 | — | `[APM2 §15.25.8]` ✓ | ✓ |
| 10 | npf-check-ordering | 6/6 | — | `[APM2 §15.25.6]` ✓ | ✓ (2nd chapter, predicted) |
| 11 | asid-allocation-and-exhaustion | 7/7 | — | `[APM2 §15.16.1]` ✓ | ✓ |
| 12 | gmet-mechanism | 6/6 | — | `[APM2 §15.25.13]` ✓ | ✓ |
| 13 | avic-ipi-delivery-path | 7/7 | — | `[APM2 §15.29.6.1]` ✓ | ✓ |
| 14 | vnmi-virtualization | 7/7 **+1 key-disputed** | — | `[APM2 §15.21.10]` ✓ | ✓ |
| 15 | io-page-table-walk | 7/7 | — | `[IOMMU 3.11 §2.2.3]` ✓ | ✓ |
| 16 | gcr3-pasid-translation | 7/7 | — | `[IOMMU 3.11 §2.2.6.3]` ✓ | ✓ |
| 17 | msi-remapping-end-to-end | 7/7 | — | `[IOMMU 3.11 §2.2.5.2]` ✓ | ✓ |
| 18 | ga-log-and-gappi | 7/7 | — | `[IOMMU 3.11 §2.2.5.4]` ✓ | ✓ |
| 19 | c-bit-mechanics | 7/7 | — | `[APM2 §7.10.4]` ✓ | ✓ |
| 20 | ghcb-establishment | 7/7 | — | `[GHCB 2.04 §2.3.1]` ✓ | ✓ |
| 21 | rmp-page-states | 8/8 | — | `[SNP-ABI 1.59 Table 14]` ✓ | ✓ |
| 22 | vmpl-and-rmpadjust | 8/8 | — | `[APM2 §15.36.7]` ✓ | ✓ |
| 23 | vmcb02-construction | 8/8 | — | `[APM2 App.B]` ✓ | ✓ |
| 24 | vmcb-versus-vmcs | 7/7 | — | `[APM2 App.B]` + `[SDM 3C §27.2]` ✓ | ✓ |

**Totals: 170 / 170 (100%) scorable, 2 key-disputed excluded, 0 trap violations,
24 / 24 citations valid.**

---

## Failures

### lookup · vmcb-clean-bit-map

**Asked:** "Give me the VMCB clean-bit map: where the field is, what each bit covers, and what
bit 31 is for."

**Missing:** `must_include` item 1, in the clause "…with bits 63:32 reserved SBZ".

**Answered (verbatim, the whole of what the answer says about the field's extent):**

> The VMCB Clean field is at **control-area offset 0C0h**; support is enumerated by
> `CPUID Fn8000_000A_EDX[VmcbClean]` = bit 5 `[APM2 §15.15]` `[1]`.

and, in the map, the last row:

> | 31:13 | — | Reserved |

The offset (`0C0h`) and the implicit 31:0 extent are there; the qualifier that the upper half
of the quadword, bits 63:32, is RESERVED SBZ is not stated anywhere in the answer. All other
seven items hit, including the bit-31 host-reserved rule.

**Verified against the specification:** `APM2 Rev 3.45 Table B-1` (p.768, read from the PDF and
column-realigned) prints `0C0h | 31:0 | VMCB Clean Bits.` immediately followed by
`63:32 | RESERVED, SBZ`. The key item is correct.

**Diagnosis: the fact is present but was not found.** It lives in the same chapter the answer
routed to but in a different section: `02-vmcb.md` §2.2.4 "Virtualization enables, decode assist
and pointers, 0B8h–17Fh", line 158 (`| 0C0h | 31:0 | VMCB Clean Bits; 63:32 RESERVED, SBZ |`) and
again as a claim at line 183. The answer read §2.5 "Clean bits and VMCB state caching", which
carries the per-bit map and the caching contract but never restates the field's width. A reader
routed to the clean-bit *semantics* section is never shown the field's *extent*.

### lookup · exit-codes-60h-61h-band

**Asked:** "I have exit codes `60h` and `61h` in a trace. What are they, and what else is in that
band?"

**Missing:** `must_include` item 8 — "when an external or virtual interrupt is intercepted the
interrupt is left pending rather than consumed".

**Answered (verbatim, the closing paragraph — the only place the answer discusses the band's
semantics rather than its contents):**

> Surrounding bands, for orientation: 00h–0Fh CR reads, 10h–1Fh CR writes, 20h–2Fh DR reads,
> 30h–3Fh DR writes, 40h–5Fh `VMEXIT_EXCP[0-31]` (exception exit code = 40h + vector), 80h–9Fh
> vector 4, A0h–BFh vector 5. Outside the rule: `400h` `VMEXIT_NPF`, `401h`
> `AVIC_INCOMPLETE_IPI`, `402h` `AVIC_NOACCEL`, `403h` `VMEXIT_VMGEXIT`, `407h`
> `VMEXIT_PML_FULL`, `F000_0000h` reserved for host use, and the negatives `−1`
> `VMEXIT_INVALID`, `−2` `VMEXIT_BUSY`, `−3` `VMEXIT_IDLE_REQUIRED`, `−4`
> `VMEXIT_INVALID_PMC`.

The answer names every code in the band correctly and derives the band from `32 × vector + bit`,
but never says what happens to the interrupt itself. The other seven items hit.

**Diagnosis: the chapter lacks the fact.** The rule is in the corpus — `03-intercepts.md` §3.2,
line 110: *"When an external or virtual interrupt is intercepted, the interrupt is **left
pending** rather than consumed. `[APM2 §15.7]`"* — but it appears **nowhere in
`05-exit-decoding.md`**, which is the chapter this question's key names and the chapter SKILL.md
routes exit-code questions to. A grep for `pending` across `05-exit-decoding.md` returns only the
`VMEXIT_IDLE_HLT` row, an AVIC index note, and the `EXITINTINFO` acknowledge-cycle claim. The same
agent *did* produce this fact in `mechanism/intercept-priority-ordering`, which routes to `03`.
The fix is a cross-reference or a one-line restatement in `05` §5.1, where 60h/61h are defined:
knowing an `INTR` exit leaves the interrupt pending is the first thing a person decoding a `60h`
needs, and it is currently only reachable from the intercept chapter.

### lookup · iommu-control-register-bits (two items)

**Asked:** "Which bits of the IOMMU Control Register do I need to bring up translation, command
processing and the event log?"

**Missing:**
- item 3 — "bit 1 `HtTunEn`, bit 2 `EventLogEn`, bit 3 `EventIntEn`, bit 4 `ComWaitIntEn`"
  (partial: `EventLogEn` 2, `EventIntEn` 3 and `ComWaitIntEn` 4 are all present; only
  `HtTunEn` at bit 1 is absent — scored as a miss because the item is one listed fact)
- item 4 — "bits 7:5 `InvTimeOut`, bit 8 `PassPW`, bit 9 `ResPassPW`, bit 10 `Coherent`,
  bit 11 `Isoc`" (absent entirely)

**Answered (verbatim, the only enumeration of neighbouring bits, and the closing line):**

> Neighbours in the same register: `PPRLogEn` (13), `PprIntEn` (14), `PPREn` (15), `GTEn` (16),
> `GAEn` (17), `GALogEn` (28), `GAIntEn` (29), `ComWaitIntEn` (4).

> The chapter carries the complete 0018h bit assignment (bit 0 `IommuEn` through 63:61
> `SNPAVICEn`) if you need the rest.

**Verified against the specification:** `IOMMU 3.11 §3.4.1` defines `HtTunEn` as
"HyperTransport™ tunnel translation enable. RW. Reset 0b." adjacent to `IommuEn` in the register's
bit list, and `Isoc`/`Coherent`/`ResPassPW`/`PassPW` in the 11:8 block with `InvTimeOut` at 7:5.
The key items are correct.

**Diagnosis: the fact is present but was not found — and the answer knew it.** The complete
0018h assignment is in the chapter and section the answer routed to,
`08-iommu-architecture.md` §8.3 "IOMMU Control Register, MMIO 0018h", lines 132–140 (a two-column
table containing `| 41 | BlkStopMrkEn | 1 | HtTunEn |`, `| 47:46 | HADUpdate | 7:5 | InvTimeOut |`,
`| 48 | GDUpdateDis | 8 | PassPW |`, etc.) with claim lines at 152 and 160. The answer saw the
table, said so, and chose to answer the question as asked — the three bring-up tasks — rather
than reproduce the register. This is the one failure in the set that is a *key scope* problem as
much as a skill problem: the question asks for the bits needed to bring up translation, command
processing and the event log, and `HtTunEn`, `InvTimeOut`, `PassPW`, `ResPassPW`, `Coherent` and
`Isoc` are needed for none of the three. I did not mark it `key-disputed` — every listed value is
factually right and lives in the named chapter — but a key that demands the whole register should
be attached to a question that asks for the whole register.

### lookup · ghcb-layout-offsets

**Asked:** "Give me the GHCB layout: the fields a `#VC` handler fills in, the valid bitmap, and
the version and usage words."

**Missing:** `must_include` item 1 — "the GHCB is a 4096-byte page the guest must map decrypted,
and its format is defined by software rather than by hardware - hardware never accesses it
directly".

**Answered (verbatim, the opening — the answer goes straight to the offset table and never
characterises the page):**

> **Answer:** `[GHCB 2.04 Table 3]` `[9]`:
>
> | Offset | Size | Contents | Versions |
> |---|---|---|---|
> | `0x0000` | `0xcb` | RESERVED | — |
> | `0x00cb` | `0x01` | `CPL` | All |

The table runs to `0x0ffc`/`0x04`, so a 4096-byte page is implied arithmetically, but "must map
decrypted", "format defined by software" and "hardware never accesses it directly" appear nowhere
in the answer. The other six items hit, including the 126-qword bitmap rule and all fourteen
offsets, every one of which I confirmed against `GHCB 2.04 Table 3` in the PDF
(`0x03f0 | 0x10 | VALID_BITMAP | Bitmap to indicate valid qwords in the save state area starting
from offset 0x000 through offset 0x3ef (126 qwords)`).

**Diagnosis: the fact is present but was not found.** It is in the same chapter, one section
earlier: `13-sev-es-ghcb.md` §13.3 "Establishing the GHCB", line 112 —
*"The GHCB is a 4,096-byte page that the guest must map decrypted so that guest and hypervisor
can both reach it; hardware never accesses the GHCB directly, and consequently its format is
defined by software rather than fixed by hardware. `[APM2 §15.35.7]`"*. The answer routed to §13.4
"The GHCB layout", exactly where SKILL.md's row sends "the GHCB layout", and §13.4 opens with the
table. The *what it is* sentence sits in the *how you establish it* section; the *where the fields
are* section assumes you already read it. The same agent reproduced the sentence verbatim in
`mechanism/ghcb-establishment`, which routes to §13.3 — so this is a section-boundary artefact,
not a content gap.

---

## `key-disputed` items

### KD1 · mechanism · vmrun-consistency-checks — CR4 bit 24

**Key says (must_include item 4):**

> "CR4 bits 11, 12, 16-18 and **20-24** and EFER bits 15, 17, 18 and 21 are architecturally
> defined today, so the old masks would reject a legal guest state"

**Answer says (verbatim):**

> **CR4 bits 11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are architecturally defined
> today**, so a validator using the fixed masks would **reject legal guest state**
> `[APM2 §15.5]` `[1]`. `errata.md` **E05** records the same correction (its wording gives the CR4
> range as 20–24; the chapter gives 20–23 — take the chapter's, and in either case implement it as
> "consult the current MBZ definition", not as a literal constant).

**What the specification says:** `APM2 Rev 3.45 §3.1.3, Figure 3-7 "CR4 Register"` (p.48) prints
the field row `Bits 63:24` with mnemonic `Reserved` and access type `MBZ`. The highest
architecturally defined CR4 bit is **23 (CET)** — "Control-flow Enforcement Technology (CET).
Bit 23." — followed directly by "CR1 and CR5-CR7 Registers…". There is no CR4 bit 24 on AMD64;
Intel's PKS at bit 24 has no AMD counterpart. The answer's `20–23` is exactly right and the key's
`20–24` is wrong. (The EFER half of both is right: Figure 3-9 defines 15 `TCE`, 17 `MCOMMIT`,
18 `INTWB`, 21 `AIBRSE` — and also 20 `UAIE` and 24 `EnhancedTlbi`, which neither side lists.)

**Which is right:** the answer. **The key is stale, and the corpus already knows it.** The
uncommitted `references/errata.md` in the working tree now reads "CR4 bits 11, 12, 16–18 and
20–23" with an explicit note: *"The range itself was corrected from 20–24 to 20–23 on 2026-09-21 —
Figure 3-7 prints CR4 bits 63:24 as Reserved, MBZ."* `04-world-switch.md` §4.2 line 98 says 20–23
too. Only `questions.yaml` still carries the pre-correction number. The answer's parenthetical
("its wording gives the CR4 range as 20–24") describes the *pre-correction* errata text, so the
answer was written against the older errata and reached the correct value anyway.

**Action for the key:** change `20-24` to `20-23` in `questions.yaml`. Not counted against the
answer. This item would have failed a specification-correct answer, which is precisely the case
the dispute clause is for.

### KD2 · mechanism · vnmi-virtualization — the virtual-NMI delivery condition

**Key says (must_include item 5):**

> "a virtual NMI is taken when `V_NMI` is set, virtual NMIs are unmasked, and there is no
> interrupt shadow"

**Answer says (verbatim):**

> **The delivery condition — three terms, and note what is *not* in the list.** The processor
> takes a virtual NMI when: **virtual NMIs are not masked**, **virtual interrupts are enabled with
> `VGIF`**, and **the processor is not in an interrupt shadow** `[APM2 §15.21.10]` `[1]`. There is
> no `EFLAGS.IF` term and no `V_TPR` priority comparison

**What the specification says:** `APM2 Rev 3.45 §15.21.10 "NMI Virtualization"` (p.557),
verbatim:

> The processor takes a virtual NMI if:
>  - virtual NMIs are not masked,
>  - virtual interrupts are enabled with VGIF, and
>  - the processor is not in an interrupt shadow.

The answer reproduces AMD's enumerated list term for term. The key substitutes "`V_NMI` is set"
for the `VGIF` term. `V_NMI` being set is not one of AMD's three conditions — it is the separate
pending indicator ("V_NMI: Indicates whether a virtual NMI is pending in the guest") — and the
`VGIF` term, which the key drops, is the genuinely surprising and load-bearing one, since it is
what couples virtual-NMI delivery to vGIF rather than to the real GIF.

**Which is right:** the answer. The corpus agrees with it too —
`07-virtual-interrupts-avic.md` line 101 states the three conditions in AMD's words. The key is
the only outlier.

**Action for the key:** restate item 5 as AMD does, or split it into "virtual NMIs are not
masked", "virtual interrupts are enabled with `VGIF`" and "no interrupt shadow". Not counted
against the answer. As written, this key penalises an answer that quotes the manual and rewards
one that paraphrases it wrongly.

---

## `must_not_include` audit

Eleven banned strings across seven questions. **Zero asserted.** Every one that appears at all
appears inside a correction:

| Question | Banned string | Disposition |
|---|---|---|
| intercept-vector-4-and-5 | "vector 4 bits 16 to 31 intercept writes of CR0 through CR15" | **refuted, not asserted** — *"Rev 3.30 had bit 15 = EFER writes and bits 16–31 = writes of CR0–15, whereas Rev 3.45 defines only 16 (CR0), 19 (CR3) and 20 (CR4) and reserves 17, 18 and 21–31"* |
| intercept-vector-4-and-5 | "there is no sixth intercept vector" | **refuted, not asserted** — *"a corpus that says SVM has five vectors is reporting the pre-2020 layout"* |
| npf-exitinfo1-bits | bit 33 encryption / 34 page-size / 35 VMPL | **refuted, not asserted** — *"a numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is **off by one from bit 34 upward**"* |
| irte-guest-mode-format | "bit 0 is `RemapEm`" | **refuted, not asserted** — *"Bit 0 is **`RemapEn`** — the spelling `RemapEm` appears nowhere in the specification"* |
| sev-status-bit-map | "bit 7 is Debug Swap" | **refuted, not asserted** — *"bit 7 is **`DebugVirtualization`** in AMD's table; 'Debug Swap' is the Linux name and appears nowhere in AMD's documentation"* |
| ghcb-layout-offsets | "the valid bitmap is at offset 0xFF0" | **not asserted at all** — the answer's table gives `0x0ff0 \| 0x0a \| RESERVED` and `VALID_BITMAP` at `0x03f0` |
| attestation-report-fields | "the VERSION field takes the values 2, 3 or 5" | **refuted, not asserted** — *"a source listing 2/3/5 is reporting a stale set (`errata.md` E25)"* |
| vmrun-consistency-checks | "`CR4[63:11]` non-zero" / "`EFER[63:15]` non-zero" | **refuted, not asserted** — *"come from the **2005-era SVM manual**, are superseded, and appear nowhere in Rev 3.45"* |

The banned-string-in-a-correction pattern fired eight times and was correct eight times, which is
the behaviour RUNNER.md §"Scoring honestly" predicts. A substring lint rule over these answers
would report eight false positives.

---

## Routing

**First-try chapter correctness: 48 / 48.** Every question reached a chapter that actually
holds the fact, and no answer reported being sent somewhere the answer was not.

Two mechanism questions needed a second chapter, and both are splits SKILL.md predicts in
advance rather than routing failures:

- `gif-stgi-clgi-vgif` — `04-world-switch.md` §4.6 for GIF/STGI/CLGI, then
  `07-virtual-interrupts-avic.md` §7.3 for vGIF. `04`'s section says "Where the mechanism side
  lives" and `07`'s `Owns:` line claims "vGIF on the mechanism side"; the question asks both.
- `npf-check-ordering` — `06-nested-paging.md` §6.5 for the ordering, `05-exit-decoding.md` §5.3
  for the `EXITINFO1` bits. SKILL.md names this exact case ("decoding an `#NPF`, for example,
  needs `05` for the bit layout and `06` for the semantics").

**Note R1 — the key's `chapter:` and SKILL.md's routing table disagree for
`int-ctl-60h-layout`.** The key names `02-vmcb.md` (notes point at §2.2.2); the answer routed to
`07-virtual-interrupts-avic.md` §7.1.1 because SKILL.md's row reads
*"Virtual interrupts, **the offset-60h control word**, vGIF, AVIC, x2AVIC, the doorbell →
`07-virtual-interrupts-avic.md` §7.2"*. Both chapters carry the layout and the answer scored 6/6,
so this is not a failure — but SKILL.md has two rows that both claim offset 60h ("VMCB field
offsets, control area…" → `02`, and "the offset-60h control word" → `07`), and the eval key has
silently picked the other one. Worth reconciling so the routing measurement means something.

---

## Notes

### The real skill defect this pass exposes: the routing table's section anchors are entry
### points, not owning sections

Ten of the twenty-four lookup answers recorded that SKILL.md's routing row named a section that
does **not** own the fact, and that they had to fall back to `00-quickref.md` §0.3 "Where the
tables live" to find the owning section. Verbatim from the answers:

| Question | What the answer recorded |
|---|---|
| vm-cr-msr-layout | "SKILL.md's row points at §1.5; `00-quickref.md` §0.3 gives the SVM-MSR table as §1.4" |
| vmcb-clean-bit-map | "SKILL.md's row says §2.2; `00-quickref.md` §0.3 gives clean bits as §2.5" |
| int-ctl-60h-layout | "SKILL.md's row says §7.2; `00-quickref.md` §0.3 gives §7.1" |
| msrpm-ranges-and-encoding | "SKILL.md's row says §3.1; `00-quickref.md` §0.3 gives IOPM/MSRPM as §3.3/§3.4" |
| exit-codes-60h-61h-band | "SKILL.md's row points at §5.2 but names §5.1 for the EXITCODE table" |
| tlb-control-values | "SKILL.md's row says §6.5; `00-quickref.md` §0.3 gives `TLB_CONTROL` values as §6.8" |
| iommu-control-register-bits | "SKILL.md's row says §8.6; `00-quickref.md` §0.3 gives the Control and Status registers as §8.2/§8.3" |
| irte-guest-mode-format | "SKILL.md's row says §10.4; `00-quickref.md` §0.3 gives the three IRTE formats as §10.1–§10.3" |
| sev-firmware-error-codes | "SKILL.md's row says §12.6; `00-quickref.md` §0.3 gives the SEV firmware commands as §12.8/§12.9" |
| snp-instructions-and-return-codes | "SKILL.md's row says §14.1; `00-quickref.md` §0.3 gives the SNP instructions as §14.1–§14.4" |

Nothing failed because of it — every chapter was the right chapter, and `00-quickref.md` §0.3
caught every case — but the routing table is currently load-bearing on a second lookup that is
not documented as mandatory. Either make the `§n.m` suffixes point at owning sections, or drop
them and let §0.3 be the section-level index it already is. Right now they read as precise and
are not.

### Failure taxonomy for this pass

| Diagnosis | Count | Which |
|---|---|---|
| routing sent it to the wrong chapter | **0** | — |
| the chapter lacks the fact | **1** | exit-codes-60h-61h-band (the fact is in the corpus, in `03-intercepts.md` §3.2, but not in `05-exit-decoding.md`) |
| **the fact is present but was not found** | **4** | vmcb-clean-bit-map (§2.2.4 vs §2.5), iommu-control-register-bits ×2 (§8.3, seen and deliberately not reproduced), ghcb-layout-offsets (§13.3 vs §13.4) |
| citation missing | **0** | — |
| `key-disputed` | **2** | KD1, KD2 above |

Four of the five genuine misses are "present but not found", matching the pattern the trap +
diagnosis pass reported. Three of those four are **section-boundary** misses inside the correct
chapter: the fact a question needs sits one section away from the section that owns the table the
question asks about. The recurring shape is *characterisation in one section, layout in the
next* — what the clean field's extent is (§2.2.4) versus what its bits mean (§2.5); what the GHCB
*is* (§13.3) versus where its fields are (§13.4). A promotion to `00-quickref.md`, as RUNNER.md's
"Fix" column suggests, would work, but a cheaper fix for these two is a single orienting sentence
at the head of the layout section.

The one true content gap is the interrupt-left-pending rule's absence from `05-exit-decoding.md`.

### Verification performed

Independently checked against `C:/Users/Administrator/AppData/Local/Temp/amd-spec/`, so that a
shared key/answer error could not pass: document revisions for all six normative publications
(24593 Rev 3.45 Jul 2026 · 24594 Rev 3.38 Jul 2026 · 48882 Rev 3.11 Apr 2026 · 56860 Rev 1.59
Aug 2026 · 56421 Rev 2.04 Jan 2025 · 55766 Rev 3.24 Apr 2020 — all correct);
`VM_CR` `C001_0114h` and all five bits plus the `LOCK`/`SVM_KEY`/`SVMDIS` rules (Figure 15-27);
`VM_HSAVE_PA` `C001_0117h` and both `#GP` conditions (§15.30.4); the TSC composition formula,
8.32 format and read-side-only rule (§15.30.5); the MSRPM geometry, range table and check order
(§15.11, Table 15-8); `TLB_CONTROL` encodings, the reserved note and `FlushByAsid` gating
(Table 15-9); the clean-field bit map (Figure 15-4) and the `FFFF_FFFFh`/`0h` guidance (§15.15.3);
the whole offset-60h field list including the bit-10 gap and the x2AVIC-below-AVIC ordering;
the `#NPF` `EXITINFO1` bits 0–4/6/32/33/37 (§15.25.6) and 31/34/35/36/37 (§15.36.10) — confirming
`errata.md` E04; the four-step `#NPF` fault ordering (§15.25.6); the nested permission-combining
rules (§15.25.7); the vector-4 and vector-5 intercept function lists (Table B-1); the VMCB
control-area offsets `050h`/`058h`/`0C0h`/`0C8h`/`0E0h`/`0F0h`/`0F8h`/`098h` (Table B-1, read from
the PDF and realigned); the state-save offsets `0CBh` CPL, `0D0h` EFER, `148h` CR4, `150h` CR3,
`158h` CR0, `160h` DR7, `168h` DR6, `170h` RFLAGS, `178h` RIP, `1D8h` RSP, `1F8h` RAX, `240h` CR2,
`268h` G_PAT and the missing `140h` row (Table B-2, likewise);
`Fn8000_000A_EDX` bit 16 `VGIF` and bit 25 `VNMI`; the doorbell MSR `C001_011Bh`, its `#GP`-on-read
rule and relaxed `WRMSR` serialization (Figure 15-22, §15.29.8.2); `SEV_STATUS` `C001_0131`
read-only and un-interceptable (§15.34.10); all six SNP instruction opcodes (APM3 Ch.4);
the GHCB tail of Table 3 including `VALID_BITMAP` at `0x03f0` and the 126-qword note;
the attestation report's `2A0h-49Fh SIGNATURE` and "Signature of bytes 0h to 29Fh inclusive";
IOMMU `HtTunEn`/`CmdBufEn`/`EventLogEn` definitions (§3.4.1) and the fourteen event sections
§2.5.2–§2.5.15. Every one matched the answers. The only two mismatches found anywhere were
between the **key** and the specification, and both are recorded above as `key-disputed`.
