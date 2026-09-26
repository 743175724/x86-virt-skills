# Adversarial re-check of the corrections applied to `01`–`08`

Scope: every correction recorded in `full-01-03.md` (14), `full-02-06.md` (11 `W` + 19 completeness
repairs), `full-04-05.md` (16 in `04`, 14 rows in `05`) and `full-07-08.md` (26 distinct).
**100 items judged**, plus one un-recorded defect handed over by the coordinator.

Nothing here rests on memory. Every verdict was taken against text extracted from the three
primary PDFs, in raw reading order and — for every table — cross-read in `-layout`:

| PDF | Order number | Local file |
|---|---|---|
| SDM Vol.3C | 326019-**092**US, June 2026 | `/tmp/sdm3c.pdf` |
| SDM Vol.3D | 332831-**092**US, June 2026 | `/tmp/sdm3d.pdf` |
| SDM Vol.4 | 335592-**092**US, June 2026 | `/tmp/vol4.pdf` |

`-layout` desynchronises Table 27-7, Table 27-8, Table 27-18 and Table C-1 in these files — the
bit/number column and the description column drift apart by whole rows. Every bit position and
exit-reason number below was therefore pinned twice, once per extraction, before being accepted.

## Verdict totals

| Verdict | Count |
|---|---|
| `CORRECT` | **91** |
| `STILL-WRONG` | **0** |
| `OVER-CORRECTED` | **1** |
| `INCOMPLETE` | **8** |
| total | **100** |

Plus **1 un-recorded defect** (chapter `04` §4.3.1, below) — the only inverted-polarity error left
in the corpus, and the worst single item in this pass.

`node tools/lint.mjs intel-vt` → **clean**, 22 chapter files, 318 bibliography entries,
2645 distinct claims (2643 before this pass; two claims split).

---

## 1. Un-recorded defect — the surviving allowed-0 inversion

**`04-vm-entry.md` §4.3.1** — `STILL-WRONG`. Never recorded as a correction, so no worklist
caught it. It read:

> bits 31:0 of the MSR give the allowed-0 settings (**a bit that is 0 there must be 0 in the
> control**) and bits 63:32 give the allowed-1 settings (a bit that is 0 there must be 0 in the
> control)

Vol.3D App.A.3.1: *"VM entry allows control X … to be 0 **if bit X in the MSR is cleared to 0**;
if bit X in the MSR is **set to 1**, VM entry fails if control X is 0."* A cleared allowed-0 bit is
a **permission** to be 0, never an obligation. Read literally the claim forced every flexible
control to 0, and it contradicted three places in the corpus that are right: §4.3's own
`(v | allowed0) & allowed1` recipe four lines above it, §4.10, and `08` §8.6.3, which owns the fact.

**Fixed** — the claim now quotes both halves of App.A.3.1 verbatim and states the obligations:
allowed-0 bit = **1** ⇒ control must be **1**; allowed-1 bit = **0** ⇒ control must be **0**.
Anchor sharpened `[SDM 3D App.A]` → `[SDM 3D App.A.3.1]`.

I swept the rest of the batch for prose restatements of the same rule.
`02:290`, `02:291`, `04:380`, `04:382`, `08:267`, `08:268`, `08:342`, `14:320`, `18:93` and the
`01:198` MSR table all state the polarity correctly. `04` §4.3.1 was the only surviving copy.

---

## 2. `OVER-CORRECTED` — 1

### O-1 · `01-vmx-intro.md:210` — the UC memory-type consequence

| | |
|---|---|
| Recorded as | `full-01-03.md` item 3 — "UC degrades *software* accesses (A.1 fn 3), not 'the performance of VMX transitions'" |
| As it read after the fix | "…mapping such a structure uncacheable is permitted but makes **software's own accesses to it slower**." `[SDM 3C §27.2]` |
| Verdict | **`OVER-CORRECTED`** |

The fixer read Vol.3D App.A.1 footnote 3 and concluded the SDM nowhere says UC hurts *transitions*.
But the claim is anchored to **3C §27.2**, whose own footnote 3 says exactly that, and more strongly:

> "Alternatively, software may map any of these regions or structures with the UC memory type.
> Doing so is **strongly discouraged** unless necessary as it will cause **the performance of
> transitions using those structures to suffer significantly**. In addition, the processor will
> continue to use the memory type reported in the VMX capability MSR IA32_VMX_BASIC…"

The original consequence clause was true and sourced; the "fix" deleted it, substituted a weaker
statement lifted from a different volume, and left it under the section that contradicts it. It
also dropped "the processor will continue to use the memory type reported in IA32_VMX_BASIC" —
the part a VMM author acts on.

**Right value / fixed text:** UC is permitted but **strongly discouraged** because it makes the
performance of *transitions* using those structures suffer significantly, and the processor keeps
using the IA32_VMX_BASIC memory type regardless; App.A.1 fn 3's *software-access* cost is a
separate, additional effect and is now attributed to `[SDM 3D App.A.1]`.

---

## 3. `INCOMPLETE` — 8

### I-1 · `05-vm-exit.md:117` — exit reasons 80/81 given the wrong conditions

The fix folded reasons 78–81 into one claim with a shared MSR-bitmap condition. Table C-1 gives
URDMSR/UWRMSR a **different shape**:

> "URDMSR … � The 'use MSR bitmaps' VM-execution control is 0. � The MSR address is in the range
> **0000H-1FFFH** and bit n is 1 in the read bitmap for low MSRs … � **The MSR address is in the
> range 2000H-3FFFH.**"

There is no `C0000000H` high range for reasons 80/81, and the third condition is a *specific*
range, taken unconditionally — not "outside the bitmapped ranges". §28.1.2's URDMSR/UWRMSR entries
agree. **Split into two claims**, each with its own condition set.

### I-2 · `06-address-translation.md:169` — "arbitrary values in bits 62:3" is unsafe under MBEC

The fix scoped the zeroed-entry permission to bits 62:3, which is §31.3.2's base-case wording.
**Bit 10 lies inside that range.** §31.3.2 NOTE: *"If the 'mode-based execute control for EPT'
VM-execution control is 1, an EPT paging-structure entry is **present if any of bits 2:0 or bit 10
is 1**. If bits 2:0 are all 0 but bit 10 is 1, the entry is used normally…"* A VMM that recycles
EPT entries for demand paging and leaves bit 10 set under MBEC gets a live mapping instead of a
fault — and the chapter's own sibling claim at `:151` states the MBEC presence rule correctly, so
the two lines contradicted each other. **Fixed:** bits **62:11 and 9:3**, with bits 2:0, bit 10 and
bit 63 each called out.

### I-3 · `06-address-translation.md:274` — the "should INVEPT" list drops two cases

The should/may split the repair added is right; the enumeration carries four of §31.4.3.4's six:

> "-- For the last EPT paging-structure entry used to translate a guest-physical address …
> changing either **bits 5:3 or bit 6**. (These bits determine the effective memory type…)"
> …footnote 1: *"If the 'mode-based execute control for EPT' … software should use the INVEPT
> instruction after changing privilege bit **10** from 1 to 0."*

A VMM that retypes a page WB→UC and trusts the chapter's list runs with a stale memory type.
**Fixed:** both cases added, with the memory-type consequence stated.

### I-4 · `04-vm-entry.md:176` — the SS DPL checks are not usability-gated

The CS half of the fix is right (§29.3.1.2 phrases every CS rule as *"If the register is CS **or**
if the register is usable"*). The rest of the sentence was not: **SS's DPL rules carry no usability
condition** — *"SS. — If the 'unrestricted guest' VM-execution control is 0, the DPL must equal the
RPL from the selector field. — The DPL must be 0 either if the Type … for CS is 3 … or if bit 0 in
the CR0 field … is 0."* Contrast the DS/ES/FS/GS DPL rule, which is explicitly gated on
*"(2) the register is usable"*. **Fixed:** the skipped checks are now named (Type, S, P,
reserved bits, G), LDTR's total exemption kept, and the SS-DPL exception stated.

### I-5 · `04-vm-entry.md` §4.8 — right bit layout, retired field name

The layout the fix confirmed is correct against **Table 27-18**, bit for bit. The **name is not**:
`"VM-entry interruption-information"` occurs **0** times in rev 092 Vol.3C, and Table 27-18 is
titled *"Format of the **Injected-Event Identification** Field"* (24 occurrences), with bits 10:8
now the **event type** (*"Older versions of this document called this sub-field interruption
type"*). Chapters `03` and `05` were renamed by the same batch of fixes; `04` was left behind and
used both names in one file. **Fixed** across §4.3.1, §4.5.5, §4.8: field, sub-field and the
**injected-event error code** field (App.B Table B-4 — *not* "injected-event exception error
code", which occurs 0 times), plus `[SDM 3C §27.8]` → `[SDM 3C §27.8.3]`. Also added §29.7's
definition of **injecting** (valid bit 1 **and** event type 0, 2, 3, 4, 5 or 6 — type 7 excluded),
on which the two corrected §4.8.1 claims depend.

### I-6 · `05-vm-exit.md:31` — the cleared remainder, and a mis-anchored sentence

The bit facts are right. The "remainder is cleared" sentence and the SMM parenthetical are
**§30.2.1**, not §27.9.1, and §30.2.1 states the remainder as *"(bits 31:28 and bits 24:16)"* —
the chapter had narrowed the SMM caveat to bits 24:16 alone. **Fixed:** both anchors carried, the
remainder widened, and the separate VM-entry-failure case (bit 31 set, bits 30:16 cleared) noted.

### I-7 · `05-vm-exit.md:317` — right content, wrong anchor

The guest-linear-address set is right and the negative about APIC accesses holds. But §30.2.1's
list has **five** items and does **not** contain the SMI case — that one is §27.9.1
(and §34.15.2.3). The verify report asserted §30.2.1 contains it, and that misreading landed in
the citation. **Fixed:** both anchors, with the split stated in the claim.

### I-8 · `05-vm-exit.md:285` — an inference presented as specification

"VM exits due to APIC accesses and EPT misconfigurations do not report it at all" is not stated.
§30.2.3 opens *"A VM exit may occur during execution of the IRET instruction **for reasons
including the following**…"* — an open list. The inference is sound (Table 30-6's bit 12 is part of
the 15:12 access-type field; an EPT misconfiguration saves no exit qualification) but it is derived.
**Fixed:** the SDM's "including" is quoted, and the negative is given as the derivation it is.

---

## 4. `CORRECT` — 91, and what was actually opened

Every one of the 91 was judged against the PDF, not against the report that claimed it. The
highest-blast-radius items, and the text that settles each:

| Area | Settled by |
|---|---|
| `08:259`/`268` allowed-0 / allowed-1 polarity | App.A.3.1 quoted in full; A.2 default-1 class; A.3.3/A.3.4/A.4.1/A.4.2 read for the exceptions |
| `08:204`–`213` INVVPID type numbering | Ch.33 INVVPID *Description* **and** its `CASE INVVPID_TYPE OF` pseudocode, plus §31.4.3.1 — type 1 spares nothing, type 3 retains globals, the `INVVPID_DESC[63:16] ≠ 0` test precedes the dispatch |
| `08:206` `EPTRTA` | 23 lines / 36 occurrences in Vol.3C, **0** of `EP4TA` in 3C and 3D; defined §31.4.2 as bits 51:12 of EPTP |
| `04:138` host EFER | §29.2.2 — *"the values of the **LMA and LME** bits … must **each** be that of the 'host address-space size' VM-exit control"*, no CR0.PG qualifier anywhere in §29.2.2 |
| `04:211` guest RIP canonicality | §29.3.1.4 — *"The guest RIP value is **not required to be canonical**"*, and no check at all at 64 linear-address bits |
| `05` §5.3 exit reasons 0–85 | Table C-1 walked end to end in both extractions; 65 PCONFIG and 66 SPP-related event pinned by continuity from 47 Access to LDTR/TR; number column jumps 69 → 72, confirming 70/71 unused |
| `05:263` reason **32 has** a qualification | §30.2.1 — *"For WRMSR, the exit qualification is 0, while for WRMSRNS it is 1."* No analogous sentence exists for reason 31 |
| `02:349` VM-entry control bit 9 | Table 27-17 — *"Its value is loaded into IA32_EFER.**LMA** as part of VM entry"*; Table 27-14 bit 9 — *"loaded into CS.L, IA32_EFER.LME, and IA32_EFER.LMA on every VM exit"* |
| `02` field-encoding additions | App.B Tables B-1/B-2/B-4/B-6/B-7/B-14/B-15 read in raw order; every hex encoding and index verified digit by digit (`0x0814`, `0x2816`, `0x2818`, `0x281A`–`0x2828`, `0x282E`, `0x2830`, `0x6828`, `0x682A`, `0x682C`, `0x2C06`–`0x2C1A`, `0x6C18`–`0x6C1C`) |
| `06:351` EPT leaf-only bits | Tables 31-1 … 31-7 row by row; bit 61 only in the 4-KByte PTE, 62:61 *"Ignored"* in the 1-G and 2-M leaves |
| `07` §7.8.3 posted-interrupt order | §32.6's seven steps, verbatim and in order, including step 2's ordinary external-interrupt exit and step 6's *"if no bit was set in PIR, RVI is left unmodified"* |
| `07` §7.9 IPI-virtualization conditions | §32.4.3.2 read in `-layout` (the raw extraction drops the sub-bullets): shorthand 00B, edge, bit 12 = 0, physical, fixed; §32.5 for the 830H MSR path and its reserved-bit #GP |
| `07` §7.6.6 self-IPI RVI update | §32.1.5 — `VIRR[Vector] := 1; RVI := max{RVI,Vector}; evaluate`, gated on "virtual-interrupt delivery" = 1 |

`07` and `08` came through with **26 of 26 CORRECT** — every quotation in `full-07-08.md` that I
re-tested was accurate, including the ones it could most easily have fabricated (the §32.6 step
list, the §32.2.1 "No other operations do so" sentence, and the §32.4 footnote 1 physical-address
rule).

## 5. Extras handed over by the coordinator

- **`06` §6.13 open items** — stale, now corrected. The HLAT pointer and HLAT prefix-size encodings
  are stated in `02` §2.5.2/§2.5.4 and both check out against App.B: **HLAT prefix size = index
  `000000011B` → `00000006H`** (Table B-1) and **HLATP (full) = `00002040H`** (Table B-4). The
  mode-based-execute-control misconfiguration conjunction is likewise now stated, in §6.4.1. Both
  dropped from the deferred list; the SPP-qualification and A/D-vs-PML-ordering items stay.
- **Allowed-0 / allowed-1 sweep** — see §1. One instance, fixed.

## 6. Other repairs made in passing

Verified against the PDF, fixed, and listed here so they are not mistaken for verdicts:

- `04:145` — the host `IA32_INTERRUPT_SSP_TABLE_ADDR` canonical check is **§29.2.4**, not §29.2.2.
  The §29.2.2 half (reserved bits, SUPPRESS/TRACKER, SSP bits 1:0) was right.
- `03:100` — "in SDM revisions before 092" invented a revision boundary; the PDF says only
  *"Older versions of this document called this field IDT-vectoring information."* Reworded.
- `01:38` — the §1.1.2 table still said the VMXON region "has the same format" as a VMCS, which the
  same batch of fixes had removed from `01:211`. Now "the same amount of memory and the same
  revision identifier".
- `01:170` — "Which memory type **must** the regions use"; App.A.1 says *should*.
- `02:345` — still used the retired "VM-exit interruption-information field" after §5.5 renamed it;
  now the **exiting-event identification field**, old name noted.
- `06:151` — "bit 63 is not among the ignored bits" was unconditional; §31.3.2 adds *"If the
  'EPT-violation #VE' VM-execution control is 0, this bit is ignored."* Scoped.

## 7. Noted, not changed

- `full-04-05.md:314` says "the **82** defined values are 0–34, 36, 37, 39–41, 43–69, 72–81, 84,
  85". The enumeration is right; the count is **79**. It did not propagate — the chapter states no
  total.
- `full-02-06.md` W2 says Table B-6 "continues for **nine** more entries past `0x2814`" and then
  lists twelve. The chapter asserts no count, so nothing in the skill is wrong.
- `04` §4.5 states the **host**-side CR4.FRED rule but not the guest-side one (§29.3.1.1: *"If the
  'IA-32e mode guest' VM-entry control is 0, bit 32 in the CR4 field … must be 0"*). An omission,
  not a defective correction; left for whoever owns chapter `04`'s completeness.
