# intel-vt eval — scored: `mechanism-v2` + `diagnosis-v2` — 2026-09-20

Scorer: independent (did not write the answers). Protocol: `eval/RUNNER.md`.
Key: `eval/intel-vt/questions.yaml`. Answers: `answers/mechanism-v2.md` (24), `answers/diagnosis-v2.md` (20).

Scoring was literal and uncharitable. Two exceptions applied per the scoring brief:

- **`key-disputed`** — where the answer contradicts a `must_include` item and the skill's
  post-verification text supports the answer, the item is scored a **hit** and flagged, with the
  verifying chapter line quoted. Where the skill is internally inconsistent and the *owner* chapter
  supports the key, the item is scored a **miss** and still flagged.
- **Deliberate hedges** (errata O1/O3/O4, E06) count as hits.

| Metric | mechanism | diagnosis | combined | bar |
|---|---|---|---|---|
| `must_include` hits | 153/154 (99.4%) | 102/108 (94.4%) | **255/262 (97.3%)** | ≥ 90% ✅ |
| `must_not_include` asserted | 0 | 0 | **0** | 0 ✅ |
| `required_citation` valid | 24/24 (100%) | 19/20 (95.0%) | **43/44 (97.7%)** | ≥ 95% ✅ |
| `honest-gap` items scored as misses | 0 | 0 | **0** | — |
| `key-disputed` items | 5 (4 questions) | 3 (3 questions) | **8 (7 questions)** | — |

**Verdict: PASS.**

---

## 1. Mechanism subset (24 questions)

| # | id | items | citation | violations | honest-gap | key-disputed | routing as recorded |
|---|---|---|---|---|---|---|---|
| 1 | vm-entry-check-order | 8/8 | valid (SDM 3C Ch.29) | none | no | no | `04-vm-entry.md` §4.9 → answered §4.1–§4.11 |
| 2 | pir-virr-merge-and-on-sn-race | 9/9 | valid (SDM 3C §32.6 / Ch.32) | none | no | **yes ×2** | `07-apic-virtualization.md` §7.8.2–§7.8.4 |
| 3 | vmcs-shadowing-mechanism | 7/7 | valid (SDM 3C §27.6.15) | none | no | no | `14-nested-virtualization.md` §14.2, §14.3.1–4 |
| 4 | vmcs02-merging | 8/8 | valid (SDM 3C §27.6.1–§27.6.6) | none | no | no | `14-nested-virtualization.md` §14.4.1–4 |
| 5 | secure-ept-page-acceptance | 7/7 | valid (TDX-BASE §9.10.1) | none | no | no | `13-tdx.md` §13.8.1–4 |
| 6 | vtd-queued-invalidation | 7/7 | valid (VT-d 5.20 §6.5.2) | none | partial¹ | no | `10-vtd-dma-remapping.md` §10.6.1–4 |
| 7 | hvci-uses-ept | 5/5 | valid (MS Learn + SDM 3C §31.3.2) | none | no | no | `15-security.md` §15.8 + `17` §17.6 |
| 8 | virtual-interrupt-delivery | 7/7 | valid (SDM 3C §32.2.2) | none | no | no | `07-apic-virtualization.md` §7.6.3–4 |
| 9 | ept-violation-vs-misconfiguration | 9/9 | valid (SDM 3C Ch.31 / §31.3.3.1) | none | no | no | `06-address-translation.md` §6.4 + `05` §5.4.6 |
| 10 | default1-controls-and-true-msrs | 8/8 | valid (SDM 3D App.A.3.1) | none² | no | no | `08-vmx-instructions.md` §8.6.1–3 |
| 11 | idt-vectoring-reinjection | 6/6 | valid (SDM 3C §27.9.3) | none | no | no | `05-vm-exit.md` §5.6, §5.12 |
| 12 | vpid-ept-tagging | 7/7 | valid (SDM 3C Ch.31) | none | no | no | `06-address-translation.md` §6.6–§6.7 |
| 13 | ve-conversion-and-busy-field | 5/5 | valid (SDM 3C §27.6.19) | none | no | no | `06-address-translation.md` §6.11 |
| 14 | ipi-virtualization-pid-table | 7/7 | valid (SDM 3C §32.1.6) | none | no | **yes ×1** | `07-apic-virtualization.md` §7.9 |
| 15 | interrupt-index-and-source-validation | 7/7 | valid (VT-d 5.20 §5.1.3) | none | partial³ | no | `11-vtd-interrupt-remapping.md` §11.2–§11.4 |
| 16 | ooh-reported-results | 4/4 | valid (errata.md O6 + arXiv/SC'22) | none | no | no | `16-performance.md` §16.7 + errata O6 |
| 17 | hyperv-owns-vmx-root | 5/5 | valid (SDM 3C Ch.26) | none | no | no | `17-windows-platform.md` §17.1, §17.3 |
| 18 | enlightened-vmcs | 4/4 | valid (SDM 3C §27.6.15 + TLFS) | none | no | **yes ×1** | `14` §14.12.2 + `17` §17.2.3 |
| 19 | vtl-isolation-slat | 6/6 | valid (TLFS [380] + MS Learn) | none | no | no | `17` §17.2.7 + `15` §15.7 |
| 20 | tdx-tlb-tracking | 8/8 | valid (TDX-BASE §9.7) | none | no | no | `13-tdx.md` §13.8.5 |
| 21 | l1tf-mitigation-chain | **6/7** | valid (SDM 4 §2.1) | none | no | no | `15-security.md` §15.5.1 (+§15.4.2) |
| 22 | flexpriority-generation | 5/5 | valid (errata.md O1) | none | no | no | `01` + errata O1 + `07` §7.2 |
| 23 | vmfunc-generation | 4/4 | valid (errata.md E06) | none | no | no | errata E06 + `06` §6.13 |
| 24 | tdx-aes-key-strength | 4/4 | valid (TDX-ISA Ch.2) | none | no | **yes ×1** | errata O3 + `13-tdx.md` §13.4.5 |

¹ Declared `THE SKILL DOES NOT CONTAIN THIS` for IQA_REG internal layout, per-descriptor field
layouts and the ring wrap condition. **None of these is a `must_include` item**, so no item was
scored as a gap. The declaration is accurate against `10-vtd-dma-remapping.md`.

² Near-miss on the trap string `"the first VMX processors only supported the 1-setting of bits 1,
2 and 4"`. The answer writes: *"On early VMX processors, certain control bits were architecturally
required to be 1 — the default-1 controls — and the original capability MSRs report them as such.
Later processors let software clear some of them."* It never names bits 1, 2 and 4 and never says
"only supported the 1-setting", and the framing matches `02-vmcs.md` §2.8.4's own prose
("Later processors needed to allow some default-1 controls to be cleared"). **Not a violation.**

³ Declared `THE SKILL DOES NOT CONTAIN THIS` for SVT = 00b and the numeric SQ encodings. Not
`must_include` items; no scored gap.

---

## 2. Diagnosis subset (20 questions)

| # | id | items | citation | violations | honest-gap | key-disputed | routing as recorded |
|---|---|---|---|---|---|---|---|
| 1 | vmlaunch-error-7 | **5/6** | valid (SDM 3C §33.4, §29.2.1.1) | none | no | no | `08` §8.4 → `04` §4.9 |
| 2 | vmresume-error-5-after-migration | 5/5 | valid (SDM 3C §33.4, §27.11) | none | no | no | `08-vmx-instructions.md` §8.4 |
| 3 | vmlaunch-cf-no-error | 4/4 | valid (SDM 3C Ch.33) | none | no | no | `04` §4.9 + `08` §8.2 |
| 4 | vmlaunch-error-8-64bit | **5/6** | valid (SDM 3C §29.2.2–4, §33.4) | none | no | no | `08` §8.4 + `04` §4.4 |
| 5 | entry-failure-33-qualification-0 | 6/6 | valid (SDM 3C §29.8, §27.9.1) | none | no | no | `05` §5.4 + `04` §4.9 |
| 6 | entry-failure-34-msr-load | 6/6 | valid (SDM 3C §29.4, §27.8, §29.8) | none | no | **yes ×1** | `05` §5.4 + `04` §4.7/§4.9 |
| 7 | vmxon-general-protection | 6/6 | valid (SDM 3C §26.7, §26.8, Ch.33) | none | no | no | `01-vmx-intro.md` §1.4/§1.5/§1.8 |
| 8 | lost-event-during-delivery | 5/5 | valid (SDM 3C §27.9.3, §30.2.4) | none | no | no | `05-vm-exit.md` §5.6 |
| 9 | apicv-interrupts-lost-when-descheduled | 4/4 | valid (SDM 3C §32.6, §29.3.2.5) | none | no | **yes ×1** | `07-apic-virtualization.md` §7.8.2–4 |
| 10 | msix-not-delivered-after-remapping | **5/6** | valid (VT-d 5.20 §5.1.5.2) | none | no | no | `11-vtd-interrupt-remapping.md` §11.2–§11.12 |
| 11 | device-dma-faulting | 6/6 | valid (VT-d 5.20 §7.2/§7.2.1) | none | no | no | `12-vtd-faults-bios-siov.md` §12.1–§12.9 |
| 12 | seamcall-illegal-sequence | **6/7** | valid (TDX-BASE §7.1/§7.2; ABI §5.4.1) | none | no | no | `13-tdx.md` §13.7 |
| 13 | vtx-unavailable-on-windows | 6/6 | valid (SDM 3C Ch.26 + MS docs) | none | no | no | `17-windows-platform.md` §17.1 |
| 14 | driver-rejected-after-memory-integrity | 6/6 | valid (MS HVCI driver guidance + SDM §31.3.2) | none | no | no | `15` §15.7/§15.8 + `17` §17.6 |
| 15 | hypervisor-works-linux-not-windows11 | 6/6 | valid (SDM 3C Ch.26 + MS WHP docs) | none | no | no | `17` §17.1/§17.3 + `16` §16.5 |
| 16 | vbs-overhead-figure | **6/7** | valid (SDM 3C Ch.31 + MS VBS docs) | none⁴ | no | **yes ×1** | `16` §16.3.x + `15` §15.12 + errata O4 |
| 17 | modern-vmexit-cycles | 5/5 | valid (SDM 3C Ch.30 + named sources) | none⁵ | declared, costs nothing⁶ | no | `16-performance.md` §16.2.x |
| 18 | whp-vs-bare-vmx-figure | 4/4 | **INVALID**⁷ | none | declared⁶ | no | `16` §16.5 + `17` §17.3.4 |
| 19 | wsl2-overhead-figure | 4/4 | valid (MS WSL docs + KVM wiki + SDM Ch.31) | none | declared⁶ | no | `16` §16.4/§16.6 + `17` §17.4 |
| 20 | vtl-transition-cost | **2/3** | valid (TLFS + SDM 3C Ch.30) | none⁸ | declared⁶ | no | `16` §16.3.1/§16.2.5 + `15` §15.7 |

⁴ Banned string `"expect around 10% on average"` — **not asserted**. The answer's table quotes
*`"up to 10%", "as much as 15%"`* with the explicit qualifier *"**both are one title** — Microsoft
Flight Simulator: 10% on average frame rate, 15% on the 1% lows"*, and the Disagreement line says
*"My pre-training prior would have been to answer with a single 'roughly 5–10%' figure, and for
gaming specifically '5–25%'. The skill establishes that … they must not be averaged."*
**Refuted, not asserted.**

⁵ Banned string `"roughly 500 cycles on a modern core"` — not present in any form. The answer
instead writes *"My prior would have supplied something like '1000–2000 cycles on a modern part'.
The skill states that no such measurement exists in it and that extrapolating would be
fabrication."* **Refuted, not asserted.**

⁶ For `modern-vmexit-cycles`, `whp-vs-bare-vmx-figure`, `wsl2-overhead-figure` and
`vtl-transition-cost` the key's `must_include` **is** the absence statement, so
`THE SKILL DOES NOT CONTAIN THIS` is the *expected* answer and scores those items as hits, not as
`honest-gap` misses.

⁷ `required_citation: "Microsoft Learn or the measurement source, with page or section"`. The
answer names only *"Microsoft Windows Hypervisor Platform API documentation, as cited in
`17-windows-platform.md` §17.3.4 and `16-performance.md` §16.5"* — a document plus two *skill*
section numbers, never a page or section of the Microsoft source. Scored **invalid** on a strict
reading of "with page or section". This is the only citation failure in 44.

⁸ Banned string `"about 1000 cycles"` — not asserted as a VTL-transition figure. The answer
carries `~650 cycles on Westmere, 2010` and `1016 of ~3900` explicitly as *VM-exit* figures and
says *"Multiplying that by anything to estimate a VTL transition on a current laptop would be
fabrication dressed as arithmetic."* **Not a violation.**

---

## 3. `key-disputed` items, with adjudication

Each was checked against the current skill text (the corpus that just had all 2643 claims
re-verified against the Intel PDFs).

### D1 · `pir-virr-merge-and-on-sn-race` — items 1 and 2 (ON-clear ordering)

- **Key:** *"the processor clears ON first"* then *"then acknowledges the notification interrupt at
  the local APIC"*.
- **Answer:** ON is cleared at **step 3**, *after* the local-APIC acknowledge at step 1 and before
  the PIR read at step 5; the answer calls out that *"a rendering that clears ON first has the
  correctness property right and the step order wrong."*
- **Corpus:** `references/07-apic-virtualization.md:412` — *"ON is cleared at step 3 and PIR is read
  at step 5, so ON is cleared **before** PIR is read — but it is cleared **after** the local-APIC
  acknowledge at step 1, not before it. A rendering that clears ON first has the correctness
  property right and the step order wrong."* `[SDM 3C §32.6] C:high`
- **Adjudication: the key is stale.** SDM §32.6 orders the seven steps ACK → vector compare →
  clear ON → EOI → PIR merge. **Scored 2 hits.** The key items should be reworded to
  "clears ON before the atomic read-and-clear of PIR, and after the local-APIC acknowledge".

### D2 · `ipi-virtualization-pid-table` — item 5 ("flat-mode")

- **Key:** *"only physical-addressing, flat-mode, unicast IPIs are covered"*.
- **Answer:** only **physical** destination mode; *"logical destination mode (including flat mode …
  flat mode is a logical addressing form and is **not** accelerated)"*.
- **Corpus:** `references/07-apic-virtualization.md:445` — *"(An earlier wording here said
  'flat-mode', which is wrong: flat mode is a logical addressing form and is not accelerated.)"*
- **Adjudication: the key carries the erratum'd wording.** **Scored a hit.** Remove "flat-mode"
  from the key item.

### D3 · `enlightened-vmcs` — item 2 ("the VP assist page carries the enlightened VMCS")

- **Answer:** *"The VP assist page does not **hold** the enlightened VMCS; it holds the controls
  that select one"* (`EnlightenVmEntry`, `CurrentNestedVmcs`), each eVMCS being its own 4-KB page.
- **Corpus:** `references/17-windows-platform.md:65` states exactly this, `C:high`. Note the skill
  contradicts itself at `17-windows-platform.md:84` (MSR table: *"VP assist page, which also
  carries the enlightened VMCS"*), which is where the key's phrasing comes from.
- **Adjudication: I believe the answer** — §17.2.3 is the owning section and quotes the TLFS.
  **Scored a hit.** The MSR-table row at line 84 should be corrected, and the key item reworded to
  "the VP assist page selects the enlightened VMCS through `CurrentNestedVmcs`".

### D4 · `tdx-aes-key-strength` — item 2 ("base architecture describes … AES-128-XTS")

- **Answer:** the 128-bit figure in the base architecture is the **per-HKID AES-XTS tweak key**,
  not a data-key length; the ISA fixes no data-key length.
- **Corpus:** `references/errata.md` O3 — *"the 128-bit figure in the base architecture describes
  the per-HKID AES-XTS **tweak** key, not a fixed data-key length."*
- **Adjudication: the key preserves the framing errata O3 corrected.** **Scored a hit.**

### D5 · `entry-failure-34-msr-load` — item 5 (`IA32_BIOS_UPDT_TRIG`)

- **Key** lists `IA32_BIOS_UPDT_TRIG (00000079H)` among the excluded MSR-load indices.
- **Answer:** *"revision 092 does **not** list 00000079H (IA32_BIOS_UPDT_TRIG) among the excluded
  indices — older material that says it does is out of date."*
- **Corpus:** `references/04-vm-entry.md:296` — *"Rev 092 does **not** list 00000079H
  (IA32_BIOS_UPDT_TRIG) among the excluded indices."* `[SDM 3C §29.4] C:high`
- **Adjudication: the key is stale against SDM rev 092.** **Scored a hit.** Drop the MSR from the
  key item.

### D6 · `apicv-interrupts-lost-when-descheduled` — item 4 (VM entry and posted interrupts)

- **Key:** *"VM entry performs posted-interrupt processing when ON is set, so interrupts posted
  while the vCPU was not running are picked up at the next entry rather than lost"*.
- **Answer:** *"**VM entry does not perform posted-interrupt processing.**"* … *"a VMM must drain
  the PID into VIRR and RVI itself before entry"* — and makes that the first remediation step.
- **Corpus:** `references/07-apic-virtualization.md:391` — *"Posted-interrupt processing is
  triggered **only** by the arrival of an interrupt whose vector is the posted-interrupt
  notification vector. VM entry does **not** perform posted-interrupt processing: §29.3.2.5 says a
  VM entry with virtual-interrupt delivery set loads RVI and SVI …, performs PPR virtualization and
  evaluates pending virtual interrupts — nothing more."* `C:high`
- **Adjudication: the key is wrong, and this is the most consequential of the seven.** The key item
  as written would lead a VMM to rely on an entry-time drain that does not exist. **Scored a hit;
  the key item must be inverted.**

### D7 · `vbs-overhead-figure` — item 3 (provenance of the 6% figure) — *scored a MISS*

- **Key:** *"the 6% figure reached this knowledge base only through secondary reporting and the
  original benchmark, processor, titles and settings were not read"*.
- **Answer:** gives a conditions table — *"ComputerBase's own testing, Ryzen 7 5800X + Radeon RX
  7900 XTX"* — i.e. asserts the conditions **were** read, while separately reproducing the
  `[426]` mis-citation correction.
- **Corpus, both sides:**
  - `16-performance.md:141` (the **owner** per errata O4) — *"The 6% number and its attribution to
    ComputerBase reach this knowledge base only through `errata.md` O4's relay chain, and the
    original benchmark article has never been read here."*
  - `15-security.md` §15.12 — a table giving *"ComputerBase's own testing on a Ryzen 7 5800X with a
    Radeon RX 7900 XTX"*.
- **Adjudication: I believe the key, and the skill is internally inconsistent.** `errata.md` O4
  names `16-performance.md` as the owner of the figures, so §16.3.2 wins over `15-security.md`
  §15.12. The answer followed the non-owner chapter. **Scored a miss**, flagged `key-disputed`
  because the answer's source is genuinely in the skill. **Action for the maintainer: reconcile
  `15-security.md` §15.12 with `16-performance.md` §16.3.2 — one of the two is wrong about whether
  the ComputerBase article was ever read.**

---

## 4. Every missed item, with the closest verbatim sentence from the answer

### M21 · `l1tf-mitigation-chain`

**Missing:** *"where IA32_ARCH_CAPABILITIES bit 17 (FB_CLEAR) is reported, L1D_FLUSH does not
overwrite fill buffers, so an L1TF flush is not an MDS mitigation and the VERW sequence is still
required"*

**Closest verbatim sentence in the answer:**
> "**Check whether you are required to flush at all.** A **nested** VMM that finds IA32_FLUSH_CMD
> enumerated should check **IA32_ARCH_CAPABILITIES bit 3 (SKIP_L1DFL_VMENTRY)**, which indicates
> that it is **not required** to flush L1D on VM entry."

The words *FB_CLEAR*, *bit 17*, *fill buffer*, *MDS* and *VERW* appear nowhere in the answer.
**Diagnosis: locatability, not a content gap.** The fact is in the corpus at
`references/15-security.md:132` — *"on processors that report it, L1D_FLUSH does **not** overwrite
fill-buffer values, so an L1TF mitigation that flushes L1D is not automatically an MDS mitigation
and the VERW sequence is still required"* — but it lives in **§15.4.2** (the capability-MSR
section), while the answer was written out of **§15.5.1** (the L1TF section). §15.5.1's own pointer
(*"FB_CLEAR ↔ L1D_FLUSH relationship is in §15.4.2"*, line 163) was not followed.
**Fix:** restate the interaction inside §15.5.1's mitigation chain, or promote it to
`00-quickref.md`.

*Minor note on the same question (scored a hit):* the answer gives IA32_FLUSH_CMD bit 0 and the
per-guest-entry requirement but never the MSR address **10BH**, which the key item carries
parenthetically.

### G1 · `vmlaunch-error-7`

**Missing:** *"control-field failures leave the guest untouched: control returns to the instruction
after VMLAUNCH"*

**Closest verbatim sentence in the answer:**
> "A VMM that computes its control words from a compile-time constant, or that inverts the first
> half … produces a word that is legal on the machine it was tuned on and illegal on the next part.
> Error 7 does not tell you *which* control was wrong."

Nothing in the answer says where control lands. **Diagnosis: locatability.** The fact is in
`references/04-vm-entry.md` §4.11 (*"a VMfail never changes guest-visible state at all"*) and the
same answering agent stated it fully in `mechanism-v2.md` under `vm-entry-check-order`.

### G4 · `vmlaunch-error-8-64bit`

**Missing:** *"a host-state failure leaves the guest untouched and returns to the instruction after
VMLAUNCH, which is how you tell it apart from a guest-state failure"*

**Closest verbatim sentence in the answer:**
> "Host-state checks run after the control checks and before anything touches the guest, which is
> why a host-state failure leaves the guest untouched and reports a distinct number from error 7."

The *"leaves the guest untouched"* half is present verbatim; the discriminator the item actually
names — *return to the instruction after VMLAUNCH*, as against a guest-state failure landing at the
host RIP — is absent, and the answer substitutes a different discriminator ("a distinct number from
error 7"). **Diagnosis: same locatability gap as G1** — the two error-code diagnoses consistently
drop the VMfail landing-site consequence that the mechanism answer states in full.

### G10 · `msix-not-delivered-after-remapping`

**Missing:** *"an index at or beyond the table size faults with reason 21h; a clear Present bit in
the IRTE faults with 22h; a source-id verification failure faults with 26h"*

**Closest verbatim sentence in the answer:**
> "and if `interrupt_index` is equal to or larger than the number of IRTEs in the table, hardware
> treats the request as an error."

No fault reason code appears anywhere in the answer. **Diagnosis: locatability.** All three codes
are in `references/11-vtd-interrupt-remapping.md` §11.10 (lines 265–283) as individual claim lines,
and the same answering agent reproduced the whole 20h–2Bh table in `mechanism-v2.md` under
`interrupt-index-and-source-validation`. The answer routed to §11.2.2/§11.3/§11.11.2/§11.12 and
never opened §11.10.

### G12 · `seamcall-illegal-sequence`

**Missing:** *"at module scope, until the module reaches SYS_READY only the TDH.SYS.* bring-up
leaves are accepted"*

**Closest verbatim sentence in the answer:**
> "**Dispatch-level rejection, before the leaf runs.** SEAMCALL can fail with #UD, #GP(0), or
> VMfailInvalid (RFLAGS.CF = 1, RAX left unmodified) if the CPU mode is wrong, the TDX Module is
> not loaded, or the module is disabled."

This gestures at module-level rejection but never names the module state machine or `SYS_READY`.
**Diagnosis: locatability.** The fact is in `references/13-tdx.md:75` — *"Until the module's state
reaches SYS_READY, only `TDH.SYS.RD*`, `TDH.SYS.INFO`, `TDH.SYS.INIT`, `TDH.SYS.LP.INIT`,
`TDH.SYS.CONFIG`, `TDH.SYS.KEY.CONFIG` and `TDH.SYS.SHUTDOWN` are accepted"* — in §13.5, while the
answer was written out of §13.7.x + §13.19 + §13.5. The answer describes **two** state machines
where the key expects **three** scopes (module, TD life cycle, OP_STATE).

### G16 · `vbs-overhead-figure`

**Missing:** *"the 6% figure reached this knowledge base only through secondary reporting and the
original benchmark, processor, titles and settings were not read"*

**Closest verbatim sentence in the answer:**
> "| 6% frame rate, 8% frame times | memory integrity (HVCI) on vs off | ComputerBase's own
> testing, Ryzen 7 5800X + Radeon RX 7900 XTX; per-title spread large | T3 media benchmark |"

and

> "Two attributions in an earlier version of this table were wrong and are corrected: the ~6%
> memory-integrity figure is ComputerBase's own measurement, and one bibliography entry that was
> cited for 6% turns out to be a 2026-09-03 news item that quotes no frame-rate figure at all."

**Diagnosis: a corpus contradiction, not an answer defect in the ordinary sense.** See §3 D7.
The answer faithfully reproduces `15-security.md` §15.12; the key faithfully reproduces
`16-performance.md` §16.3.2; the two chapters disagree and errata O4 makes
`16-performance.md` the owner.

### G20 · `vtl-transition-cost`

**Missing:** *"the same absence applies to hypercall cost, VMBus round-trip latency and the Windows
Hypervisor Platform exit path"*

**Closest verbatim sentence in the answer:**
> "The floor itself is not known for a modern part: no public cycle-level VM-exit measurement for
> any recent client processor is recorded here."

The answer generalises the absence to VM-exit cycle figures, but never names hypercalls, VMBus or
the WHP exit path. **Diagnosis: locatability.** The fact is a single claim line at
`references/16-performance.md:294` in **§16.10.1** — *"VTL transition cost, hypercall cost, VMBus
round-trip latency and the Windows Hypervisor Platform exit path have no measurement with stated
conditions in this knowledge base"* — and the answer routed to §16.3.1 and §16.2.5 only.

---

## 5. Notes on routing and on the answers themselves

- **Routing was clean.** Both files record routing decided from `SKILL.md` §Routing before any
  chapter was opened, and every routing decision landed on a chapter that owned the answer. The
  diagnosis file additionally records `Needed quickref §0.2: no` for all 20 — `00-quickref.md`
  was never opened, so the routing table alone carried the whole subset.
- **Six of the seven misses are locatability, not content.** In every case the missing fact exists
  in the corpus, usually one section away from where the answer was written, and in three cases
  (G1/G4, G10) the *same agent* produced the missing fact in the other subset. The pattern is
  cross-section pointers that were not followed: §15.5.1→§15.4.2, §11.3→§11.10, §13.7→§13.5,
  §16.3.1→§16.10.1. Candidates for `00-quickref.md` promotion or for inlining.
- **The answers volunteer disagreements.** `default1-controls-and-true-msrs` flags a real polarity
  defect in `04-vm-entry.md` §4.3.1 (*"bits 31:0 … (a bit that is 0 there must be 0 in the control)"*,
  which is correct for the allowed-1 half and wrong for allowed-0); `ooh-reported-results` flags a
  stale `C:low`/"unresolved" label in `14-nested-virtualization.md` §14.13 that errata O6 has
  settled. Both are worth acting on independently of this score.
- **Two corpus self-contradictions surfaced by this run:** the VP assist page / eVMCS wording
  (`17-windows-platform.md:65` vs `:84`) and the 6%-figure provenance (`15-security.md` §15.12 vs
  `16-performance.md` §16.3.2). Both should be resolved in favour of the owning section.
- **Six key items should be corrected** (D1 ×2, D2, D3, D4, D5, D6). D6 is the important one: the
  key currently asserts that VM entry drains the posted-interrupt descriptor, which the corpus and
  SDM §29.3.2.5 both deny.
