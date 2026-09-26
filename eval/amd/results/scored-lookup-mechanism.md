# amd-virtualization eval — lookup + mechanism — scored by an independent agent — 2026-09-21

Scored against `eval/amd-virtualization/questions.yaml`, matched by question `id`, under
the contract in `eval/RUNNER.md`. The scorer did not write the answers, the questions or
the skill. Load-bearing values were re-verified against the corpus
(`amd-virtualization/references/`) and, for AMD architectural facts, against the
specifications themselves — reading the rendered PDF pages by coordinate wherever a value
comes from one of AMD's wide tables, because `pdftotext` mis-associates their columns.

The archived `run-1/` results and answers were not read.

| Category | Questions | `must_include` | `must_not_include` violations | Citations valid | Routing (self-reported) |
|---|---|---|---|---|---|
| lookup | 24 | **145 / 152 (95.4%)** | **0** (9 named, all refuted) | **24 / 24 (100%)** | 24/24 right chapter; 20 "right first time", 4 "landed short" |
| mechanism | 24 | **171 / 172 (99.4%)** | **0** (2 named, both refuted) | **24 / 24 (100%)** | 24/24 right chapter; 8 anchors exact, 15 "landed short", 1 needed a second (named) chapter |
| **combined** | **48** | **316 / 324 (97.5%)** | **0** | **48 / 48 (100%)** | — |

**Verdict: PASS.** `must_include` 97.5% ≥ 90%; violations 0; citations 100% ≥ 95%.
Each category also clears the bar on its own.

`key-disputed` items: **none.** Every value checked held against the specification. See
*Key audit* below for the two items that were interrogated hardest and survived, and for
one **question-design** defect that is not a key error but drives most of the lookup loss.

---

## Scoring convention used

`must_include` items are scored **as written, one item = one unit**. Several items bundle
a run of named values (`"bit 13 PPRLogEn, bit 14 PprIntEn, bit 15 PPREn, bit 16 GTEn,
bit 17 GAEn"`). Such an item is credited only when every named value appears. Where an
answer supplied some but not all, the failure entry says exactly which were present, so
the reader can recompute under a laxer rule. Under a "majority of the bundle counts"
rule, lookup would be 147/152 (96.7%) — the verdict does not change either way.

A restatement of a fact already given is not double-charged: `exit-codes-60h-61h-band`
item 7 (`"they are intercept vector 3 at 0x60 + bit, so 60h is vector 3 bit 0 …"`) is
credited because the answer states the encoding rule and the vector-3 band explicitly;
the `so` clause is the same fact arithmetically restated, not a second value.

---

## LOOKUP — 24 questions

`must_include` **145 / 152 (95.4%)** · violations **0** · citations **24 / 24**

Per-question hits: `amd-document-set` 8/8 · `vm-cr-msr-layout` 7/7 ·
`vm-hsave-pa-rules` 6/6 · `fn8000-0001-ecx-bit2-scope` 5/5 · **`vmcb-clean-bit-map` 7/8** ·
`int-ctl-60h-layout` 6/6 · `vmcb-state-save-offsets` 8/8 · `intercept-vector-4-and-5` 5/5 ·
`msrpm-ranges-and-encoding` 5/5 · `exit-codes-60h-61h-band` 8/8 · `npf-exitinfo1-bits` 7/7 ·
`tlb-control-values` 7/7 · `avic-id-table-entries` 6/6 · `avic-doorbell-msr` 4/4 ·
**`iommu-control-register-bits` 3/7** · `iommu-event-codes` 5/5 ·
**`dte-translation-fields` 7/8** · `irte-guest-mode-format` 6/6 · `fn8000-001f-fields` 5/5 ·
`sev-status-bit-map` 6/6 · `sev-firmware-error-codes` 5/5 · **`ghcb-layout-offsets` 6/7** ·
`snp-instructions-and-return-codes` 8/8 · `attestation-report-fields` 5/5.

### Failures

#### vmcb-clean-bit-map — 7/8
**Asked:** "Give me the VMCB clean-bit map: where the field is, what each bit covers, and what bit 31 is for."
**Missing:** `"the VMCB Clean Bits field is at control-area offset 0C0h, bits 31:0, with bits 63:32 reserved SBZ"`
**Answered (verbatim, the whole of what the answer says about the field's location):**
> **Answer:** The VMCB Clean field is at **control-area offset 0C0h**. Support is indicated by `CPUID Fn8000_000A_EDX[VmcbClean]` (bit 5). `[APM2 §15.15]` `[1]`

The bit range is never given. The answer's own map table opens with `| 31:13 | — | Reserved |`,
and later says a clean hypervisor "may write `FFFF_FFFFh` to the whole field", which implies
32 bits — but `bits 31:0` and `bits 63:32 RESERVED, SBZ` are not stated.
**Trap hit:** none.
**Diagnosis: fact present but not found.** It lives in `02-vmcb.md` **§2.2.4**, line 158 —
`| 0C0h | 31:0 | VMCB Clean Bits; 63:32 RESERVED, SBZ |` — restated as a claim at line 183.
Verified against APM Vol.2 Table B-1 p.768 and §15.15.1 ("The VMCB Clean field (VMCB offset
0C0h, bits 31:0)"): the key is correct. **The routing row named the section.** SKILL.md's
row for VMCB field offsets reads `02-vmcb.md §2.2 (control area) · §2.3 (save area) ·
§2.5 (clean bits)`; the answer opened only §2.5 and self-reported "right first time".

#### iommu-control-register-bits — 3/7
**Asked:** "Which bits of the IOMMU Control Register do I need to bring up translation, command processing and the event log?"
**Missing (4 items):**
- `"bit 1 HtTunEn, bit 2 EventLogEn, bit 3 EventIntEn, bit 4 ComWaitIntEn"` — bits 2, 3 and 4 given; **`HtTunEn` (bit 1) absent.**
- `"bits 7:5 InvTimeOut, bit 8 PassPW, bit 9 ResPassPW, bit 10 Coherent, bit 11 Isoc"` — only `InvTimeOut[7:5]` given; **`PassPW`, `ResPassPW`, `Coherent`, `Isoc` absent.**
- `"bit 13 PPRLogEn, bit 14 PprIntEn, bit 15 PPREn, bit 16 GTEn, bit 17 GAEn"` — 13, 15, 16, 17 given; **`PprIntEn` (bit 14) absent.**
- `"bit 28 GALogEn and bit 29 GAIntEn"` — 28 given; **`GAIntEn` (bit 29) absent.**

**Answered (verbatim, the whole of the answer's coverage of the rest of the register):**
> The full 0018h bit assignment is in §8.3; other bits of note for a passthrough bring-up are `GTEn`(16), `GAEn`(17), `PPREn`(15), `PPRLogEn`(13), `GALogEn`(28), `XTEn`(50) and `InvTimeOut[7:5]`.

**Trap hit:** none. The `CmdBufEn`(12)/`CmdBufRun` distinction the trap set depends on is
answered correctly and at length.
**Diagnosis: fact present but not found.** The complete map is in
`08-iommu-architecture.md` **§8.3**, the very section the answer opened and named — lines
129–147 give `1 HtTunEn`, `8 PassPW`, `9 ResPassPW`, `10 Coherent`, `11 Isoc`,
`14 PprIntEn`, `29 GAIntEn`. Verified against the IOMMU 3.11 spec: all seven field names
exist and §3.4.1 defines them; the key is correct. The answer read the section and chose
to print a subset. **See the question-design note below — the question is narrower than
the key, which is the real root cause.**

#### dte-translation-fields — 7/8
**Asked:** "How big is a Device Table Entry, how is it indexed, and where are `V`, `TV`, `Mode`, the page-table root pointer and `DomainID`?"
**Missing:** `"bit 61 IR and bit 62 IW"`
**Answered (verbatim — every mention of IR/IW in the answer, none of which gives a bit position):**
> **`Mode[11:9]`** gives the depth of the host page tables and therefore the reachable GPA width: 000b translation disabled (SPA = GPA, access still gated by IR/IW) …

> `TV` validates the **translation** fields specifically — IW, IR, the page table root pointer, Mode and GV.

The field table lists only `V`(0), `TV`(1), `Mode[2:0]`(11:9), Host Page Table Root
Pointer(51:12) and `DomainID[15:0]`(79:64).
**Trap hit:** none.
**Diagnosis: fact present but not found.** `08-iommu-architecture.md` §8.6 line 280–281
carries `| 189:188 | IntCtl | 62 | IW |` and `| 187 | HPTMode | 61 | IR |`. IOMMU 3.11
defines both (§2.2.2, "IW: I/O write permission", "IR: I/O read permission"); the key is
correct. Same section the answer opened and named.

#### ghcb-layout-offsets — 6/7
**Asked:** "Give me the GHCB layout: the fields a `#VC` handler fills in, the valid bitmap, and the version and usage words."
**Missing:** `"the GHCB is a 4096-byte page the guest must map decrypted, and its format is defined by software rather than by hardware - hardware never accesses it directly"`
**Answered (verbatim — the answer's entire preamble before the offset table):**
> **Answer:** Full layout, from GHCB spec pub **56421 rev 2.04**:

Nothing in the section says "decrypted", "4096", "shared", "software-defined" or
"hardware never accesses it". The table happens to run to `0x0ffc + 4 = 0x1000`, but the
property is never stated.
**Trap hit:** none — `"the valid bitmap is at offset 0xFF0"` is **refuted**, not asserted:
> | `0x0ff0` | `0x0a` | RESERVED | — |

**Diagnosis: fact present but not found.** It is a single claim line in
`13-sev-es-ghcb.md` **§13.3** (line 112): *"The GHCB is a 4,096-byte page that the guest
must map decrypted so that guest and hypervisor can both reach it; hardware never accesses
the GHCB directly, and consequently its format is defined by software rather than fixed by
hardware. `[APM2 §15.35.7]`"*. The answer opened only §13.4 and self-reported "right first
time". **The routing row named §13.3** (`13-sev-es-ghcb.md §13.3 (establishing it) · §13.4
(layout) · §13.5 (MSR protocol)`). Notably the **same answerer quotes this sentence almost
verbatim** in the mechanism answer `ghcb-establishment`, so this is a coverage miss inside
one question, not a corpus gap. Worth flagging to the key's owner: the `notes` field on
this question says "Chapter 13 sections 13.4 and 13.4.1", which is where the item is *not*.

### `must_not_include` — lookup

Nine banned strings across six questions. **Zero asserted. Nine refuted**, each with the
correcting sentence:

| Question | Banned string | Verdict | Refuting sentence (verbatim) |
|---|---|---|---|
| intercept-vector-4-and-5 | "vector 4 bits 16 to 31 intercept writes of CR0 through CR15" | refuted | "Rev 3.30 defined bit 15 as "intercept writes of EFER" and bits **16–31** as "intercept writes of CR0–15", whereas Rev 3.45 defines only **16 (CR0), 19 (CR3) and 20 (CR4)** and reserves 17, 18 and 21–31." |
| intercept-vector-4-and-5 | "there is no sixth intercept vector" | refuted | "A corpus that says SVM has five intercept vectors is reporting the pre-2020 layout." |
| npf-exitinfo1-bits | "bit 33 is the encryption mismatch" / "bit 34 is the page-size mismatch" / "bit 35 is the VMPL violation" | refuted (all three) | "**A numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is off by one from bit 34 upward.** AMD prints "Bit 34 (ENC)", "Bit 35 (SIZEM)", "Bit 36 (VMPL)", "Bit 37 (SSS)"." |
| irte-guest-mode-format | "bit 0 is `RemapEm`" | refuted | "Spelling: bit 0 is **`RemapEn`** — `RemapEm` appears nowhere in the specification" |
| sev-status-bit-map | "bit 7 is Debug Swap" | refuted | "AMD's name for bit 7 is **`DebugVirtualization`**. "Debug Swap" is the Linux-side name and appears nowhere in AMD's documentation" |
| ghcb-layout-offsets | "the valid bitmap is at offset 0xFF0" | refuted | "`0x0ff0` \| `0x0a` \| RESERVED" (and `VALID_BITMAP` placed at `0x03f0`) |
| attestation-report-fields | "the VERSION field takes the values 2, 3 or 5" | refuted | "A corpus listing 2/3/5 as the possible values is reporting a stale set rather than an enumeration (`errata.md` E25)." |

### Citations — lookup

24/24 valid. Every answer names the required vendor document and the section, table or
figure: `[APM2 Figure 15-27]`, `[APM2 §15.30.4]`, `[APM3 App.E]`, `[APM2 Figure 15-4]`,
`[APM2 Table B-1]`, `[APM2 Table B-2]`, `[APM2 Table 15-8]`, `[APM2 App.C]`,
`[APM2 §15.36.10]`, `[APM2 Table 15-9]`, `[APM2 Table 15-23]`, `[APM2 Figure 15-22]`,
`[IOMMU 3.11 §3.4.1]`, `[IOMMU 3.11 §2.5]`, `[IOMMU 3.11 Figure 7]`,
`[IOMMU 3.11 Table 23]`, `[APM2 §15.34.10]`, `[SEV-API 3.24 Table 14]`,
`[GHCB 2.04 Table 3]`, `[APM3 §4 "RMPUPDATE"]`, `[SNP-ABI 1.59 Table 27]`. The
non-vendor case, `amd-document-set`, correctly names `00-quickref.md §0.1`, which is what
that question's key asks for. No bare "per the manual" anywhere.

Two citation-hygiene positives worth recording: `snp-instructions-and-return-codes` cites
APM Vol.3 Chapter 4 **by mnemonic** (`[APM3 §4 "RMPUPDATE"]`), which is the form the
document set's own trap list demands; and no answer invents an `[IOMMU 3.11 App.x]`.

---

## MECHANISM — 24 questions

`must_include` **171 / 172 (99.4%)** · violations **0** · citations **24 / 24**

Per-question hits: `clean-bits-mechanism` 8/8 · `intercept-priority-ordering` 7/7 ·
`tsc-offset-and-ratio-composition` 6/6 · `vmrun-ordering` 8/8 ·
`vmrun-consistency-checks` 6/6 · `gif-stgi-clgi-vgif` 7/7 ·
`event-injection-and-reinjection` 8/8 · `nested-permission-combining` 8/8 ·
`memory-type-combining` 7/7 · `npf-check-ordering` 6/6 ·
`asid-allocation-and-exhaustion` 7/7 · `gmet-mechanism` 6/6 ·
`avic-ipi-delivery-path` 7/7 · `vnmi-virtualization` 8/8 · `io-page-table-walk` 7/7 ·
`gcr3-pasid-translation` 7/7 · `msi-remapping-end-to-end` 7/7 · `ga-log-and-gappi` 7/7 ·
`c-bit-mechanics` 7/7 · `ghcb-establishment` 7/7 · `rmp-page-states` 8/8 ·
`vmpl-and-rmpadjust` 8/8 · **`vmcb02-construction` 7/8** · `vmcb-versus-vmcs` 7/7.

### Failures

#### vmcb02-construction — 7/8
**Asked:** "When L1 asks to run L2 on AMD, what does L0 have to build, and how are the two hypervisors' intercepts combined?"
**Missing:** `"ASIDs are a hardware-wide namespace L1 does not own, so the ASID L1 wrote into vmcb12 is a virtual number L0 must map onto a real one"`
**Answered (verbatim — every occurrence of "ASID" in the answer; neither states the namespace rule or the mapping obligation):**
> 1. L2 executes something intercepted. Hardware takes `#VMEXIT` into vmcb02, **clears all intercepts, clears the GIF, resets the current ASID to 0** and returns control to L0 at the instruction after its `VMRUN` `[APM2 §15.6]`.

> Because **the caching identity is the VMCB's physical address and explicitly not the ASID**, L0 must keep **one stable vmcb02 page per (L1 virtual CPU, vmcb12) pair** rather than recycling a scratch page …

The answer's "Fields that must be re-derived rather than copied" paragraph lists
`IOPM_BASE_PA`, `MSRPM_BASE_PA`, `N_CR3` and the AVIC pointers, but never the ASID.
**Trap hit:** none.
**Diagnosis: fact present but not found — and the one place a short routing anchor
plausibly cost an item.** The fact is a single claim in `15-nested-virtualization.md`
**§15.4.3 "Faults, ASIDs and invalidation"**: *"ASIDs are a hardware-wide namespace L1 does
not own… so the ASID L1 wrote into vmcb12 is a virtual number that L0 must map onto a real
one, distinct from L1's own. `[APM2 §15.25.1]` `[APM2 §15.5.1]`"*. SKILL.md's routing row
for chapter 15 anchors **§15.5 only**; the answer recovered §15.2 and §15.3 from the
chapter's own `Owns:` line and never reached §15.4.3. The key's own `notes` name
"sections 15.1.2, 15.2.3, 15.2.4 and 15.3.1" — it does not name §15.4.3 either, so no
navigation aid in the repository, including the key, points at the only home of this item.

### `must_not_include` — mechanism

Two banned strings, on `vmrun-consistency-checks`. **Zero asserted. Both refuted** in one
sentence:

> The fixed-mask forms `CR4[63:11]` and `EFER[63:15]` come from the 2005-era SVM manual, are superseded, and appear nowhere in Rev 3.45 — **CR4 bits 11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are architecturally defined today**, so the fixed masks would reject legal guest state `[APM2 §15.5]`.

### Citations — mechanism

24/24 valid. `[APM2 §15.15.2]`, `[APM2 §15.7]`, `[APM2 §15.30.5]`, `[APM2 §15.5.1]`,
`[APM2 §15.5]`, `[APM2 §15.17]`, `[APM2 §15.20]`, `[APM2 §15.25.7]`, `[APM2 §15.25.8]`,
`[APM2 §15.25.6]`, `[APM2 §15.16.1]`, `[APM2 §15.25.13]`, `[APM2 §15.29.6.1]`,
`[APM2 §15.21.10]`, `[IOMMU 3.11 §2.2.3]`, `[IOMMU 3.11 §2.2.6.3]`,
`[IOMMU 3.11 §2.2.5.2]`, `[IOMMU 3.11 §2.2.5.4]`, `[APM2 §7.10.4]`, `[GHCB 2.04 §2.3.1]`,
`[SNP-ABI 1.59 Table 14]`, `[APM2 §15.36.7]`, `[APM2 App.B]` (twice) all appear where
required.

`vmcb-versus-vmcs` is the one question whose Intel half is necessarily non-AMD; the answer
cites Intel SDM sections (`[SDM 3C §27.2]`, `[SDM 3D App.A]`) rather than stretching an APM
anchor over them, which is what the key's `notes` ask for. `vmcb02-construction` correctly
marks the union rule and the three-block naming `[no-spec]` and cites the kernel/Turtles
references for them instead of manufacturing an APM section.

---

## Key audit

**No `key-disputed` items.** Every value that the score turns on was checked against the
specification independently of the answer, using coordinate-correct extraction from the
rendered PDFs for anything that comes out of a wide AMD table. Nothing was contradicted.
The checks that mattered most:

- **VMCB Clean field, offset and width** — Table B-1 p.768 gives `0C0h | 31:0 | VMCB Clean
  Bits` and `0C0h | 63:32 | RESERVED, SBZ`; §15.15.1 repeats it. Key correct, answer
  incomplete. (Worth recording for a future key revision: Figure 15-4's own row for bits
  31:13 is plain "Reserved" — the host-reservation of bit 31 comes only from §15.15.3's
  prose, exactly as the key's `notes` say.)
- **Offset-060h bit 10** — genuinely absent. The reserved spans in Table B-1 are 15:13,
  23:21, 29:27 and 63:40; verified at word-coordinate level that no row was dropped in
  extraction (rows at uniform 16 pt spacing, bit 9 → bit 11). The answer's "bit 10 is a
  genuine gap" is right, and the key's decision not to require it is right.
- **Intercept vector 5 at 014h** — all seven bits and `31:7 RESERVED, SBZ` confirmed in
  rev 3.45; the rev 3.30 text confirmed to carry the single row `014h–03Bh | RESERVED,
  SBZ`. The answer's history is accurate. (One naming nuance neither side is charged for:
  the literal string "IdleHlt" does not appear in Table B-1 — bit 6 reads "Intercept HLT
  instruction if a virtual interrupt is not pending". The name is AMD's, from Vol.3's
  `IdleHltIntercept` CPUID bit.)
- **Vector 4 write traps** — 14 RDPRU, 15 EFER-write trap, 16 CR0, `18:17 RESERVED`,
  19 CR3, 20 CR4, `31:21 RESERVED`. Confirmed; the answer's Appendix C corroboration
  (8Fh/90h/93h/94h and nothing for CR1–2 or CR5–15) is sound.
- **State-save offsets** — all twelve confirmed, including `CPL` as a byte at `0CBh` and
  `CR2` at `240h`, plus the "offsets are relative to the state-save area, which starts at
  VMCB 400h when SEV-ES is not enabled" convention. The 140h gap the answer flags is real
  in Table B-2, not an extraction artifact.
- **`TLB_CONTROL`** — `058h` bits 39:32 above the 32-bit ASID at 31:0, the four encodings,
  and Table 15-9's "All other encodings are reserved" note. `FlushByAsid` is
  `Fn8000_000A_EDX[6]`, confirmed directly in Vol.3 Appendix E.
- **CPUID `Fn8000_000A_EDX` bit numbers used across both sets** — read directly from
  Vol.3 Appendix E: `NRIPS` 3, `TscRateMsr` 4, `VmcbClean` 5, `FlushByAsid` 6,
  `AVIC` 13, `VMSAVEvirt` 15, `VGIF` 16, `GMET` 17, `x2AVIC` 18, `ROGPT` 21,
  `TlbiCtl` 24, `VNMI` 25. Every use in both answer files matches.
- **MSRPM** — four 16-Kbit vectors in two contiguous pages, 8K MSRs each, lsb read /
  msb write, and Table 15-8's fourth row `1800h–1FFFh | Reserved`. One nuance the key
  already encodes and the answer preserves: the auto-intercept rule is **conditional on
  `MSR_PROT`** ("*If the MSR_PROT intercept is active*, any attempt to read or write an
  MSR not covered by the MSRPM will automatically cause an intercept"). Both are correct.
- **`VM_CR` / `VM_HSAVE_PA` / Doorbell** — Figure 15-27's bit order (63 Reserved-MBZ,
  4 SVMDIS, 3 LOCK, 2 DIS_A20M, 1 R_INIT, 0 DPD) confirmed by coordinate; §15.30.4's two
  `#GP` conditions confirmed verbatim; Figure 15-22's `63:8 Reserved, MBZ` /
  `7:0 Physical APIC ID` and "Any attempt to read from this register results in a #GP"
  confirmed.
- **IOMMU Control Register** — the full assignment was read off the rendered register
  figure in §3.4.1 (printed pp. 217–222): `0 IommuEn, 1 HtTunEn, 2 EventLogEn,
  3 EventIntEn, 4 ComWaitIntEn, 7:5 InvTimeOut, 8 PassPW, 9 ResPassPW, 10 Coherent,
  11 Isoc, 12 CmdBufEn, 13 PPRLogEn, 14 PprIntEn, 15 PPREn, 16 GTEn, 17 GAEn,
  28 GALogEn, 29 GAIntEn`. Every position the key gives is correct, and matches the
  corpus's §8.3 table. `pdftotext` scrambles this figure into an unordered list of field
  names, which is why it was read from the rendered page.
- **DTE `IR`(61) / `IW`(62)** — confirmed against Figure 7 and Table 7, and in the corpus
  table. Also confirmed: 256-bit entries indexed by the 16-bit DeviceID, 65,536 possible
  entries, `V` 0, `TV` 1, `Mode[2:0]` 11:9, root pointer 51:12, `DomainID[15:0]` 79:64.
- **IOMMU event codes** — §2.5.2 through §2.5.15 enumerate exactly the fourteen events the
  key names, in the key's order, each confirmed from its own figure/table rather than from
  the summary. The "decode from the per-event figures, not from Table 42" warning is a
  real and *compound* defect in AMD's own document: Table 42 prints `1001b` for
  `EVENT_COUNTER_ZERO` as well as for `INVALID_PPR_REQUEST` (Table 68 says `1010b`), and
  its last row declares `1010b–1111b` reserved, so it never lists `GUEST_EVENT_FAULT`,
  `VIOMMU_HARDWARE_ERROR`, `RMP_PAGE_FAULT` or `RMP_HARDWARE_ERROR` at all. A third,
  smaller typo sits in Table 72, whose bits-31:28 row reads "1110b. Specifies an
  **RMP_PAGE_FAULT** entry" under a figure and title that both say
  `RMP_HARDWARE_ERROR` — that one is not in the corpus and would be a reasonable
  addition to `errata.md`.
- **`GuestMode = 1` IRTE** — Figure 18 / Table 23 confirm every field boundary the key
  gives. `"RemapEm"` occurs **zero** times in the document and `RemapEn` twenty-two times,
  so errata E03 is well founded. The chapter's recorded open item is also real: Table 23
  names the field `Vector[8:0]` inside an 8-bit slot at 71:64.
- **`Fn8000_001F`** — Vol.3 §E.4.17 confirms EAX bits 0–6 and 21 and the EBX packing
  (`CbitPosition` 5:0, `PhysAddrReduction` 11:6, `NumVMPL` 15:12), ECX
  `NumEncryptedGuests`, EDX `MinSevNoEsAsid`.
- **`SEV_STATUS`** — §15.34.10 (section number confirmed, against Appendix A's bad
  cross-reference to §15.35.10), `C001_0131`, read-only, "accesses … cannot be intercepted
  by the hypervisor", and every bit the key lists. AMD's Table 15-32 really does print
  `63:24 Reserved` / `23 IbpbOnEntry_Active` / `22-18 Reserved` / `18 SecureAVIC_Active` /
  `17 SmtProtection_Active` in that order — the key's item and the answer's handling of it
  are both correct.
- **GHCB Table 3 and SEV status codes** — every offset confirmed, `0x0ff0 | 0x0a |
  RESERVED` confirmed, and `HWERROR_PLATFORM` / `HWERROR_UNSAFE` differ in exactly the one
  clause the key names ("It is safe to re-allocate parameter buffers" vs "Re-allocating
  parameter buffers is not safe").
- **SNP opcodes and return codes** — all six opcodes confirmed from their Mnemonic/Opcode
  rows; value 5 appears in no return-code table and the only `FAIL_*` names in the volume
  are the six the key lists. Nuance the answer already reflects: rev 3.38 has no single
  consolidated return-code table, only per-instruction ones.
- **Attestation report VERSION** — rev 1.59's Table 27 says "Set to **6h** for this
  specification"; the archived rev **1.58** in the same source set says "Set to **5h**".
  That is direct evidence for the key's durable claim that the value is a moving
  progression, and against the banned `2, 3 or 5` enumeration. Every offset the key lists
  is confirmed, including `SIGNATURE` at `2A0h–49Fh` described as "Signature of bytes 0h
  to 29Fh inclusive of this report".
- **RMP page states** — HV-fixed, Pre-Guest, Guest-Invalid, Pre-Swap and Guest-Valid all
  present in SNP-ABI 1.59, along with "The RMPUPDATE instruction cannot create HV-fixed
  pages… software should use SNP_PAGE_SET_STATE or SNP_INIT_EX", "RMPUPDATE can invalidate
  a page but cannot validate a page", and "Pre-Guest and Pre-Swap pages have their
  RMP.Immutable flags equal to 1, which prevents the guest from transitioning them".
- **GHCB MSR / `G_PAT` / `EVENTINJ`** — `C001_0130`, saved and restored through VMCB
  `0A0h`, guest-mode-only with `#GP` in host mode; `G_PAT` at save-area `268h`;
  Figure 15-5's encoding matching `EXITINTINFO` and the unconditional-before-first-guest-
  instruction rule. All confirmed.

### Not a key error, but a question-design defect worth fixing

`iommu-control-register-bits` supplies **four of the seven lookup misses on its own**, and
the cause is a mismatch between the question and its key, not a wrong value.

The question asks: *"Which bits of the IOMMU Control Register do I need to bring up
translation, command processing and the event log?"* — three named subsystems. The key
then requires the **whole register map**, including `HtTunEn`, `PassPW`, `ResPassPW`,
`Coherent`, `Isoc`, `PprIntEn` and `GAIntEn`, none of which is needed to bring up
translation, command processing or the event log. An answer that answered exactly the
question asked — which this one did, correctly, plus the `CmdBufEn`/`CmdBufRun` trap — is
scored at 3/7.

This is **not** marked `key-disputed`, because the rule for that is a key item that
contradicts the specification, and these items are all accurate. But it should be repaired
in one of two ways before the next run: either widen the question ("give me the full 0018h
bit assignment, and say which bits bring up translation, command processing and the event
log"), or trim the key to the bits the question asks about and move the rest to `notes`.
Left as it is, this question measures answer verbosity rather than skill coverage.
Excluded from the denominator entirely, lookup would be **142/145 = 97.9%**; scored with
the four bundles credited, **149/152 = 98.0%**. It is left in and scored as written,
because the rule for excluding an item is that the key contradicts the specification, and
here it does not.

---

## Did the short routing anchors cost `must_include` items?

The mechanism answerer reports 15 of 24 anchors "landed short (in-chapter)" and says
`00-quickref.md` §0.3 could not rescue them because it indexes tables while those were
prose sections. Scored against outcomes, the honest answer is:

**Yes — but exactly once, out of 172 mechanism items (0.6%).**

- **`vmcb02-construction`, the ASID-namespace item, is a real loss to the anchor.**
  SKILL.md's chapter-15 row anchors **§15.5** alone. The fact lives in **§15.4.3**. The
  answerer reached §15.2 and §15.3 from the chapter's `Owns:` line and stopped there;
  neither the routing row, nor §0.3, nor the key's own `notes` names §15.4.3. This one is
  the anchor's fault, and the fix is a routing-table edit, not a content edit.
- **The other 14 "landed short" answers lost nothing.** Every one of them recovered the
  owning section from the chapter's heading list or `Owns:` line and scored 6/6, 7/7 or
  8/8. For those, a short anchor cost a second look, not a fact.

The more interesting finding runs the other way, and it is in the **lookup** set:

**Two lookup items were lost in sections the routing row explicitly named, on answers that
self-reported "right first time".**

- `vmcb-clean-bit-map`: the row names `§2.2 · §2.3 · §2.5`; the answer opened §2.5 only;
  the missing item is in §2.2.4.
- `ghcb-layout-offsets`: the row names `§13.3 · §13.4 · §13.5`; the answer opened §13.4
  only; the missing item is in §13.3 — and the *same answerer* quotes that sentence
  correctly in the mechanism answer `ghcb-establishment`.

So the routing table is not the dominant failure mode here. **A short anchor cost one item;
not following a multi-section anchor that was already correct cost two.** Both lookup cases
were additionally invisible in the self-report — an answer that opens one of three named
sections and calls it "right first time" is over-reporting its own routing accuracy, which
is the metric a future run would trust. That self-report gap is worth more attention than
the anchor length.

---

## Notes

- **Routing, as self-reported.** Lookup: 24/24 correct chapter; 20 "right first time",
  4 "landed short" (`fn8000-0001-ecx-bit2-scope` → §1.2 not §1.4/§1.5; `npf-exitinfo1-bits`
  → §5.3 not §5.2; `avic-id-table-entries` → §7.4/§7.5 not §7.1/§7.8; `avic-doorbell-msr`
  → §7.6, an anchor neither SKILL.md nor §0.3 supplies). None of those four lost an item —
  all scored full marks. Mechanism: 24/24 correct chapter, 8 anchors exact, 15 short,
  1 (`gif-stgi-clgi-vgif`) needing a second chapter that SKILL.md already names. The
  self-report is accurate as far as it goes, but see above — it does not catch a
  multi-section row only partly followed.
- **Skill defects the scoring exposed.**
  1. **`SKILL.md` routing row for chapter 15 anchors §15.5 only.** §15.5 is "what AMD has
     instead of VMCS shadowing"; a question about building vmcb02 needs §15.2, §15.3 and
     §15.4.3. This cost a real item. Add those anchors.
  2. **Two specific facts are buried where a single-section reader will not meet them,**
     and both were missed: the Clean field's `31:0` / `63:32 SBZ` width lives in §2.2.4
     while every clean-bit *discussion* is in §2.5, and the GHCB's
     "4,096-byte / decrypted / software-defined" contract lives in §13.3 while the layout
     is in §13.4. Per RUNNER.md's failure table these are "the chapter buries it; promote
     to `00-quickref.md`" — or, cheaper, repeat the one-line property at the head of §2.5
     and §13.4.
  3. **`00-quickref.md` §0.3 indexes tables, not prose sections.** The mechanism answerer's
     diagnosis of this is correct and it is a genuine structural limit — but on this
     evidence it is a *latency* cost, not an accuracy cost. Worth fixing on ergonomics
     grounds, not because it is losing facts.
  4. **`IR`(61)/`IW`(62) are in `08-iommu-architecture.md` §8.6's wide two-column table**
     and were skipped by a reader that reproduced the same table's other rows. If the DTE
     permission bits are load-bearing (they are — they gate every access with `Mode` = 000b),
     they deserve a line of prose, not just a table cell.
  5. **One AMD document defect found during verification is not yet in `errata.md`:**
     IOMMU 3.11 Table 72 (`RMP_HARDWARE_ERROR` fields) has a copy-paste error in its
     bits-31:28 row — "1110b. Specifies an **RMP_PAGE_FAULT** entry" — under a figure and
     title that both say `RMP_HARDWARE_ERROR`. The corpus already records Table 42's two
     larger defects; this is a third in the same family and belongs with them. No answer
     was charged for it.
- **Answer quality beyond the key.** Both files consistently distinguish what AMD states
  from what the chapter derives (`msrpm-ranges-and-encoding` says outright that AMD "does
  not print" the index arithmetic; `vmcb02-construction` marks the union rule `[no-spec]`),
  carry confidence and volatility markers, and report AMD's own documentation defects
  (Table 42's stale codes, the `22-18 Reserved` row above the bit-18 definition,
  `EXITINFO1` bit 37's double definition, offset-140h's missing row, bit 10's missing row)
  rather than silently correcting them. The trap discipline is strong: all eleven banned
  strings across the two sets appear only inside corrections, and seven of them are
  corrected explicitly by name.
- **Scope of this run.** lookup and mechanism only. `diagnosis` (20) and `trap` (12) were
  not scored here. The archived `run-1/` material was not read, so these numbers are
  independent of it.
