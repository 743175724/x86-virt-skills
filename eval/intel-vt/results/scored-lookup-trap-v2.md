# intel-vt eval — scored: `lookup-v2` + `trap-v2` — independent scorer — 2026-09-20

Skill commit: `c40421e` (after the 2643-claim PDF verification pass, 152 errors fixed)
Scorer: independent — did not write the answers, did not see them before scoring.
Protocol: `eval/RUNNER.md`. Answers graded item-by-item against `questions.yaml`
(`must_include`, `must_not_include`, `required_citation`).

| Metric | lookup-v2 | trap-v2 | Combined |
|---|---|---|---|
| `must_include` (strict, key as written) | 133/140 (95.0%) | 45/45 (100%) | **178/185 (96.2%)** |
| `must_include` (key-disputed items adjudicated) | 138/140 (98.6%) | 45/45 (100%) | **183/185 (98.9%)** |
| Asserted `must_not_include` violations | 0 | 0 | **0** |
| Misconceptions quoted in order to refute / recant | 0 | 11 | **11** |
| `required_citation` valid | 24/24 (100%) | 11/12 (91.7%) | **35/36 (97.2%)** |
| `honest-gap` questions | 0 | 0 | **0** |
| `key-disputed` | 3 | 1 | **4** |
| Routing matched the key's `chapter` | 24/24 | 11/12 | **35/36** |

**Verdict: PASS** (≥90% must_include, 0 asserted violations, ≥95% citations).

One caveat is load-bearing and is set out in §3 below: if the `hlat-pointer-encoding`
key is honoured mechanically, that question's `must_not_include` fires and the run is
a **FAIL**. I judge that key stale — the skill now states the encoding with an
`[SDM 3D App.B]` anchor and the value is correct — so I score it `key-disputed`
rather than as a violation.

---

## 1. Per-question table — `lookup-v2` (24)

| id | items | citation | violations | honest-gap | key-disputed | routing (as recorded) |
|---|---|---|---|---|---|---|
| vmcs-encoding-derive | 6/6 | valid (SDM 3D App.B) | none | no | no | `02-vmcs.md` §2.5 ✓ |
| tertiary-controls-encoding-and-msr | 4/4 | valid (SDM 3D App.A §A.3.4) | none | no | no | `02-vmcs.md` §2.5 ✓ |
| hlat-pointer-encoding | **1/3** | valid (SDM 3D App.B) | literal match, **disputed** | no | **YES** | `02-vmcs.md` §2.5 ✓ |
| exit-reasons-ept-family | 4/4 | valid (SDM 3D App.C) | none | no | no | `05-vm-exit.md` §5.3 ✓ |
| exit-reason-entry-failure-values | 5/5 | valid (SDM 3C §27.9.1) | none | no | no | `05-vm-exit.md` §5.2/§5.3 ✓ |
| exit-qual-io-instruction | 5/5 | valid (SDM 3C §30.2.1, Table 30-5) | none | no | **YES** (anchor) | `05-vm-exit.md` §5.4 ✓ |
| eptp-low-bits | 5/5 | valid (SDM 3C §27.6.11) | none | no | no | `06-address-translation.md` ✓ |
| ept-misconfiguration-conditions | 4/4 | valid (SDM 3C §31.3.3.1) | none | no | no | `06-address-translation.md` ✓ |
| pml-log-and-index | 5/5 | valid (SDM 3C §27.6.18) | none | no | no | `06-address-translation.md` ✓ |
| virtual-apic-page-offsets | 5/5 | valid (SDM 3C Ch.32) | none | no | no | `07-apic-virtualization.md` ✓ |
| posted-interrupt-descriptor-layout | 6/6 | valid (SDM 3C Ch.32, §27.6.8) | none | no | no | `07-apic-virtualization.md` ✓ |
| apicv-vmcs-encodings | 7/7 | valid (SDM 3C §27.6.8) | none | no | no | `07-apic-virtualization.md` ✓ |
| pid-pointer-table-encoding | **0/3** | valid (SDM 3C §32.1.6.2) | none | no | **YES** | `07-apic-virtualization.md` ✓ |
| vminstr-error-vmptrld | 3/3 | valid (SDM 3C §27.9.5) | none | no | no | `08-vmx-instructions.md` §8.4 ✓ |
| vmx-capability-msr-addresses | 10/10 | valid (SDM 3D App.A §A.1–§A.11) | none | no | no | `08-vmx-instructions.md` §8.4/§8.6 ✓ |
| invvpid-types | 6/6 | valid (SDM 3C Ch.33, §33.4) | none | no | no | `08-vmx-instructions.md` ✓ |
| dmar-register-offsets | 7/7 | valid (VT-d 5.20 §11.4) | none | no | no | `10-vtd-dma-remapping.md` ✓ |
| invalidation-descriptor-types | 11/11 | valid (VT-d 5.20 §6.5.2) | none | no | no | `10-vtd-dma-remapping.md` ✓ |
| irte-remapped-layout | 14/14 | valid (VT-d 5.20 §9.9) | none | no | no | `11-vtd-interrupt-remapping.md` ✓ |
| irta-reg-size-field | 6/6 | valid (VT-d 5.20 §11.4.10) | none | no | no | `11-vtd-interrupt-remapping.md` ✓ |
| vtd-fault-reason-codes | **5/6** | valid (VT-d 5.20 §7.1.3) | none | no | no | `12-vtd-faults-bios-siov.md` ✓ |
| fault-recording-register-layout | 7/7 | valid (VT-d 5.20 §11.4.7.6) | none | no | no | `12-vtd-faults-bios-siov.md` ✓ |
| tdx-leaf-numbers | **3/4** | valid (TDX-ABI §5.4.81/§5.4.24/§5.5.3) | none | no | no | `13-tdx.md` §13.5/§13.6 ✓ |
| tdx-gpaw-shared-bit | 4/4 | valid (TDX-BASE §11.15.1) | none | no | no | `13-tdx.md` §13.8 ✓ |

**Subtotal:** 133/140 strict (95.0%); 138/140 adjudicated (98.6%). Citations 24/24.
Genuine content misses: **2** (`vtd-fault-reason-codes`, `tdx-leaf-numbers`).

## 2. Per-question table — `trap-v2` (12)

| id | items | citation | violations | honest-gap | key-disputed | routing (as recorded) |
|---|---|---|---|---|---|---|
| trap-ept-qual-bit7 | 3/3 | valid (SDM 3C §30.2.1 **and** §27.9.1) | 1 refuted | no | no | `05-vm-exit.md` §5.4 + errata ✓ |
| trap-ept-qual-bit6 | 4/4 | valid (SDM 3C §30.2.1) | 1 refuted | no | **YES** (anchor) | `05-vm-exit.md` §5.4 + errata ✓ |
| trap-zombieload-cve | 4/4 | valid (INTEL-SA-00233) | 1 refuted | no | no | `15-security.md` §15.5 ✓ |
| trap-intel-asid | 4/4 | valid (SDM 3C §27.6.12) | 1 refuted | no | no | `06-address-translation.md` + `18` ✓ |
| trap-mbec-generation | 4/4 | valid (`errata.md` E01) | 1 refuted | no | no | `06-address-translation.md` + errata ✓ |
| trap-pml-generation | 2/2 | valid (SDM 3C §27.6.18) | 1 refuted | no | no | `06-address-translation.md` + errata ✓ |
| trap-ept-walk-accesses | 4/4 | valid (SDM 3C §31.3.2) | 1 refuted | no | no | `06-address-translation.md` + errata ✓ |
| trap-ooh-venue | 3/3 | valid (`errata.md` E04) | 1 refuted | no | no | `bibliography.md`, owner `14` (key: 14) ~ |
| trap-sdm-vmx-chapter-numbers | 5/5 | valid (SDM 3C Ch.26–35) | 1 **recanted** | no | no | `00-quickref.md` ✓ |
| trap-vt-rp-specification | 5/5 | valid (SDM 3C §31.2) | none | no | no | `06-address-translation.md` ✓ |
| trap-tdxray-advisory | 4/4 | valid (TDX-BASE §17.3) | 1 refuted | no | no | `13-tdx.md` §13.21 ✓ |
| trap-vtd-current-revision | 3/3 | **INVALID** (no VT-d Ch.1 / no section on the revision claim) | 1 **recanted** | no | no | `00-quickref.md` + `90` (key: `10`) ✗ |

**Subtotal:** 45/45 (100%). Citations 11/12 (91.7%). Asserted violations **0**.

### Refuted / recanted, not asserted — with the quote

1. `trap-ept-qual-bit7` — *"the widely circulated reading — \"bit 7 means the guest-physical address is valid\" — is wrong."*
2. `trap-ept-qual-bit6` — *"The \"AND of the XD bits\" formulation in the question is the circulating error, and both the skill and I reject it."*
3. `trap-zombieload-cve` — *"It is emphatically **not** CVE-2019-11091."*
4. `trap-intel-asid` — *"The premise that Intel lacks an ASID-style mechanism is a specific, named error in this knowledge base (`errata.md` E19)."* Also *"Intel has tagging, and it does **not** flush on every transition."*
5. `trap-mbec-generation` — *"No — **Kaby Lake**, not Skylake."*
6. `trap-pml-generation` — *"The common attribution to Skylake is wrong…"*
7. `trap-ept-walk-accesses` — *"**The commonly repeated figure of 20 is wrong**, and the skill diagnoses exactly why…"*
8. `trap-ooh-venue` — *"The frequently repeated attribution to **SOSP '22 is wrong**."*
9. `trap-sdm-vmx-chapter-numbers` — **recanted prior belief, not the answer's position.** The banned string appears inside a self-correction: *"*My prior belief:* the VMX block is Vol.3C **Ch.23–33** — … **32 Virtualization of System Resources**, 33 Handling Boundary Conditions in a VMM. On that numbering the chapter the question asks for does exist, and I would have cited it as Ch.32."* The stated answer is the opposite: *"**not the one you asked for — \"Virtualization of System Resources\" no longer exists as an SDM chapter.**"* and *"I am reporting the skill's position as the answer."* Scored a pass under RUNNER's refutation rule, but flagged: this is the closest any answer in the set comes to a violation, and a maintainer tightening `lint.config.json` should be aware the string is reachable through the "Disagreement" section.
10. `trap-tdxray-advisory` — *"The widely repeated attribution of TDXRay to **INTEL-SA-01271 is incorrect**…"*
11. `trap-vtd-current-revision` — same recantation shape: *"*My prior belief:* the newest VT-d specification I can recall is **Rev 4.1, March 2023**…"* against the stated answer *"Cite **Rev 5.20, April 2026, order number D51397-019**."*

---

## 3. `key-disputed` adjudications

### 3.1 `hlat-pointer-encoding` — **the key is stale; the answer is right**

Key demands the hedge *"this knowledge base does not state those encodings"* and bans
*"the HLAT pointer is at encoding 0x2040"*. The answer states `0x2040` (HLATP) and
`0x0006` (HLAT prefix size).

Evidence the key is the stale party:

- `intel-vt/references/02-vmcs.md:151` now carries the claim, anchored:
  *"…`0x2040` HLAT pointer (HLATP) · `0x2042` PID-pointer table address…"* `[SDM 3D App.B]`.
- `intel-vt/references/02-vmcs.md:185` explicitly records the resolution:
  *"The fields this list previously deferred — … the HLAT pointer (`0x2040`) and HLAT
  prefix size (`0x0006`) … — are now stated in §2.5.2–§2.5.5."*
- The values are correct against SDM Vol.3D App.B (`0x0006` HLAT prefix size sits in the
  16-bit control group beside `0x0004` EPTP index and `0x0008` last PID-pointer index;
  `0x2040` sits in the 64-bit control group beside `0x203E` and `0x2042`).

I believe the **answer**. The `must_not_include` string is therefore recorded as a
key artifact, not an asserted misconception. The answer also independently satisfies the
one surviving key item — *"verify against Vol.3D Appendix B or your kernel header before
hard-coding it"* — and it flagged, unprompted, that `06-address-translation.md:465` still
lists these encodings in its "deliberately not stated" list. **That stale open-items line
in chapter 06 is a real maintenance defect and should be deleted**; it is almost certainly
what the key was written against.

### 3.2 `pid-pointer-table-encoding` — **the key is stale; the answer is right**

Same shape. The key demands the omission hedge and bans `0x2036`; the answer gives
`0x2042` / `0x0008` — so the banned string never fires, only the three `must_include`
items miss.

- `intel-vt/references/07-apic-virtualization.md:443` states it directly, anchored
  `[SDM 3D App.B]` `[SDM 3C §29.2.1.1]` at `C:high`.
- `intel-vt/references/07-apic-virtualization.md:512` records the resolution:
  *"Four items previously listed here as unanchorable were resolved against the rev-092
  PDFs in the 07/08 verification pass … the VMCS encodings of the PID-pointer table
  address (2042H) and last PID-pointer index (0008H)…"*

I believe the **answer**. Key needs rewriting to demand `2042H` / `0008H`.

### 3.3 `exit-qual-io-instruction` and `trap-ept-qual-bit6` — citation anchors

Both keys require `SDM 3C §27.9.1`. Every claim in the corpus these answers came from is
anchored `[SDM 3C §30.2.1]`:

- `05-vm-exit.md:172–177` — all six I/O exit-qualification claims, `[SDM 3C §30.2.1]`.
- `05-vm-exit.md:207` — *"Exit-qualification bit 6 is the logical-AND of bit 10…"*, `[SDM 3C §30.2.1]`.

§30.2.1 (Ch.30 "VM Exits", Basic VM-Exit Information) is where rev 092 prints the
per-cause qualification layouts and Table 30-5; §27.9.1 defines the VMCS field generically.
The answers reproduced the corpus anchor faithfully. **Counted valid**; the keys should be
re-pointed at §30.2.1.

---

## 4. Every missed item, with the closest verbatim sentence from the answer

### `hlat-pointer-encoding` (2 misses — both key-disputed, see §3.1)

- **Missing:** "this knowledge base does not state those encodings"
  **Closest:** *"**HLAT pointer (HLATP):** 64-bit VM-execution control field at encoding **`0x2040`**."*
  **Diagnosis:** key stale — the skill does state it.
- **Missing:** "they are listed among the encodings deliberately omitted because they could not be confirmed"
  **Closest:** *"`06-address-translation.md` §6.13 still lists \"the VMCS encodings of the HLAT pointer and HLAT prefix size fields\" among facts it deliberately does not state … but chapter 06's open-items list is stale."*
  **Diagnosis:** key stale — and the answer diagnosed the staleness itself.
- **Hit:** "read them from the Vol.3D field-encoding appendix or from a kernel header before using them" → *"verify against Vol.3D Appendix B or your kernel header before hard-coding it."*

### `pid-pointer-table-encoding` (3 misses — all key-disputed, see §3.2)

- **Missing:** "this knowledge base does not state those encodings"
  **Closest:** *"**PID-pointer table address:** 64-bit VM-execution control field at encoding **`0x2042`**."*
- **Missing:** "they are among the facts deliberately omitted because they could not be anchored"
  **Closest:** *"encodings owned by `references/02-vmcs.md` §2.5.2–§2.5.3"*
- **Missing:** "the field roles are known — the table is indexed by the target APIC ID and each entry carries a valid bit in bit 0 — but the encodings are not"
  **Closest:** *"the processor locates the target vCPU's posted-interrupt descriptor through a **PID-pointer table indexed by the target's virtual APIC ID** … five **reserved bits that must be 0 in bits 5:1**, and a **valid bit in bit 0**."*
  **Diagnosis:** both role facts are present verbatim; only the trailing "but the encodings are not" clause is contradicted, and it is contradicted correctly.

### `vtd-fault-reason-codes` (1 miss — **genuine**)

- **Missing:** "legacy-mode reasons occupy 1h to Eh; interrupt-remapping reasons occupy 20h to 2Bh and scalable-mode reasons 38h to A5h, so the range decides the namespace"
  **Closest:** *"Two adjacent ranges you may also hit: **30h–34h** are root-table-address programming faults … and there is a separate scalable-mode reason table if RTADDR_REG.TTM = 01b. Make sure you are reading the right table for your translation mode."*
  **Diagnosis:** **fact present but not surfaced.** `12-vtd-faults-bios-siov.md:115` carries it
  verbatim — *"Fault reason ranges do not overlap across modes: legacy-mode reasons occupy
  **1h–Eh**, interrupt-remapping **20h–2Bh**, root-table-address programming **30h–34h**, and
  scalable-mode **38h–A5h**."* `[VT-d 5.20 Ch.7]`. The answerer read §12.3.1 and stopped; the
  disambiguation rule lives in the §12.9 pitfalls section at the far end of the chapter.
  Fix: promote it into §12.3.1's preamble, or into `00-quickref.md`.

### `tdx-leaf-numbers` (1 miss — **genuine**)

- **Missing:** "the leaf number is in RAX bits 15:0 for both SEAMCALL and TDCALL, with the interface-function version in bits 23:16"
  **Closest:** *"Its *own* ABI section's RAX table misprints the leaf number as 10, which is `TDH.VP.CREATE`'s value."*
  **Diagnosis:** **fact present but not surfaced.** `13-tdx.md:142` (SEAMCALL) and `13-tdx.md:202`
  (TDCALL) both state the RAX field split at `C:high`. The answer touched the RAX table only to
  flag the 348551-008US misprint, and never gave the calling convention the question's key
  wanted. Ironically the answer was in the same paragraph it cited.

### `trap-vtd-current-revision` (citation invalid — **genuine**)

- **Required:** `VT-d 5.20 Ch.1`
  **Given:** *"Intel Virtualization Technology for Directed I/O Architecture Specification, order
  **D51397-019, Rev 5.20, April 2026** — revision read from the PDF cover page. … Adjudicated in
  `errata.md` E21; document table in `00-quickref.md` §0.1."*
  **Diagnosis:** names the document, order number, revision and date, but no chapter, section or
  table of the VT-d spec for the revision claim itself (the body's §3.6/§3.7/§11.4.2/§11.4.3 are
  cited for the terminology and register-bit deltas, not for the revision). The corpus does anchor
  this correctly — `errata.md:180` and `core-facts.md:69` both carry `[VT-d 5.20 Ch.1]` — so this is
  the answer dropping an anchor that was there to copy, not a corpus gap. Scored strictly as the
  one citation failure of the run. Arguable: a maintainer may reasonably hold that an order number
  plus a cover date identifies a revision more precisely than "Ch.1" does.

---

## 5. Notes

- **Routing.** 35/36 questions were routed to the key's `chapter` before any file was opened.
  The one clean miss is `trap-vtd-current-revision`, routed to `00-quickref.md` (document-number
  row) with `90-dated-landscape.md`, where the key names `10-vtd-dma-remapping.md`; the answerer
  did read `10-vtd-dma-remapping.md` §10.1 anyway and lost nothing. `trap-ooh-venue` went to
  `bibliography.md` first but named `14-nested-virtualization.md` as the owning chapter, so it
  is scored as matched.
- **No `honest-gap` anywhere.** Both files answered every question from the skill; neither used
  "THE SKILL DOES NOT CONTAIN THIS". Two questions (`hlat-pointer-encoding`,
  `pid-pointer-table-encoding`) were *designed* to require that hedge, and the skill has since
  been improved past it — which is why they read as misses.
- **Two stale-corpus defects the answers found unprompted**, both worth fixing:
  `06-address-translation.md:465` still lists the HLAT encodings as "deliberately not stated";
  `14-nested-virtualization.md` still presents the OoH results discrepancy as an unresolved
  `C:low` conflict when `errata.md` O6 has settled it at `C:high`.
- **Trap subset is clean at 45/45 with zero asserted violations.** The two "Disagreement"
  sections that recite a wrong prior belief (`trap-sdm-vmx-chapter-numbers`,
  `trap-vtd-current-revision`) are the only places a banned string appears in
  non-quotation form; both recant explicitly in the same paragraph.
