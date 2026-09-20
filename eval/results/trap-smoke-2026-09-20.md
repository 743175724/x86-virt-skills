# intel-vt eval — Claude Opus 5 (Claude Code agent) — 2026-09-20

Scope: **trap subset only** (12 of 80 questions, `type: trap`). Protocol: `eval/RUNNER.md`.

Skill commit: `21ac437`
Questions: 12 · must_include: **44/45 (97.8%)** · trap violations: **0 asserted / 1 literal substring match** · citations valid: **12/12 (100%)**
Routing (first-try, vs. the eval's own `chapter` key): **7/12 (58%)** · Routing (functional: first chapter opened + mandatory `errata.md` answered it): **10/12 (83%)**

Verdict: **PASS on substance** (44/45 = 97.8% ≥ 90%; 0 misconceptions asserted; 100% citations)
Verdict: **FAIL under strictly literal `must_not_include` substring matching** (Q4 contains the banned string inside an explicit refutation → question zeroed → 41/45 = 91.1%, 1 violation)

The two verdicts differ on one technicality and nothing else. See Finding 3a — I believe the eval string, not the skill and not the answer, is what is wrong. A human should adjudicate before this run is treated as a regression.

## Method note

SKILL.md was read first and alone. Routing choices for all 12 questions were written down
before any chapter or `errata.md` was opened. Chapters were then opened one question at a
time. `must_include` / `must_not_include` / `required_citation` were revealed only after all
12 answers were fixed in writing. No pre-training recall was used; every fact below is
traceable to a line in the corpus.

## Per-question scoring

| # | id | Chapter I chose from the routing table | Eval's `chapter` key | Routing right first try? | must_include | Trap | Citation |
|---|---|---|---|---|---|---|---|
| 1 | trap-ept-qual-bit7 | `05-vm-exit.md` §5.3 (+errata) | `05-vm-exit.md` | yes | 3/3 | clean | valid |
| 2 | trap-ept-qual-bit6 | `05-vm-exit.md` §5.3 (+errata) | `05-vm-exit.md` | yes | 4/4 | clean | valid |
| 3 | trap-zombieload-cve | `15-security.md` §15.5 | `15-security.md` | yes | 4/4 | clean | valid |
| 4 | trap-intel-asid | `18-comparison-amd-arm-riscv.md` | `06-address-translation.md` | **no** (answered anyway) | 3/4 | **substring flag** | valid |
| 5 | trap-mbec-generation | `06-address-translation.md` | `06-address-translation.md` | yes (but chapter lacks the fact) | 4/4 | clean | valid |
| 6 | trap-pml-generation | `06-address-translation.md` | `06-address-translation.md` | yes | 2/2 | clean | valid |
| 7 | trap-ept-walk-accesses | `06-address-translation.md` | `06-address-translation.md` | yes | 4/4 | clean | valid |
| 8 | trap-ooh-venue | `bibliography.md` | `14-nested-virtualization.md` | **no** (venue found, correction came from errata) | 3/3 | clean (narrow escape) | valid |
| 9 | trap-sdm-vmx-chapter-numbers | `00-quickref.md` | `00-quickref.md` | yes | 5/5 | clean | valid |
| 10 | trap-vt-rp-specification | `00-quickref.md` | `06-address-translation.md` | **no** (core fact found; SDM sections came from errata E22 / `06` §6.10) | 5/5 | clean | valid |
| 11 | trap-tdxray-advisory | `15-security.md` §15.5 | `13-tdx.md` | **no** (`15` has zero mentions of TDXRay) | 4/4 | clean | valid |
| 12 | trap-vtd-current-revision | `00-quickref.md` | `10-vtd-dma-remapping.md` | **no** (answered fully by `00` §0.1 + errata E21) | 3/3 | clean | valid |

Totals: 44/45 `must_include` items, 12/12 citations, 0 asserted misconceptions.

## Failures

### trap-intel-asid — one missed `must_include` item

**Asked:** "AMD has ASIDs for tagging TLB entries per VM. Does Intel have anything equivalent, or does it flush on every transition?"

**Answered (verbatim, in full):**

> Intel does not flush on every transition, and the claim that Intel has no ASID mechanism is
> wrong. Intel has two tag namespaces rather than AMD's one: PCID tags linear-address
> translations by process context (low 12 bits of CR3 when CR4.PCIDE is set), and VPID tags
> them by virtual-processor/VM context. VPID is a 16-bit VMCS field; value 0000H is reserved
> for VMX root operation, so a hypervisor must give guests non-zero VPIDs, and INVVPID
> invalidates VPID-tagged translations (INVEPT covers EPT-derived ones). AMD's guest ASID is a
> 32-bit VMCB field with ASID 0 for the host, and it covers the VM-tagging role alone. The real
> difference is structural: AMD folds process- and VM-level tagging into one hypervisor-managed
> ASID namespace, Intel keeps a guest-managed PCID namespace and a hypervisor-managed VPID
> namespace that combine when both are active. ARM is like Intel here (VMID in VTTBR_EL2, 8 or
> 16 bits, plus a separate stage-1 ASID). Source: Intel SDM Vol.3C §27.6.12 (and SDM Vol.3A
> Ch.5 for PCID), AMD APM Vol.2 App.B; errata E19.

**Missing:** `"what is true is narrower: Intel does not use the name ASID and does not use a
single identifier for both roles, whereas AMD's 32-bit ASID covers the VM-tagging role alone"`
— scored a **miss**. Two of the three clauses are present verbatim in substance ("does not use
a single identifier for both roles" → "AMD folds process- and VM-level tagging into one …
namespace, Intel keeps a guest-managed PCID namespace and a hypervisor-managed VPID
namespace"; "AMD's 32-bit ASID covers the VM-tagging role alone" → present word-for-word).
The clause **"Intel does not use the *name* ASID"** was never stated. Scored literally, per
RUNNER's "do not argue the answer into a hit", the compound item fails.

**Trap hit:** none asserted. But the banned string `"Intel has no ASID mechanism"` **does occur
as a literal substring**, in the clause *"the claim that Intel has no ASID mechanism is wrong"*
— i.e. inside an explicit refutation. Flagged, not scored as a violation. See Finding 3a.

**Diagnosis:** compound `must_include` item; routing sent me to `18` rather than `06` but `18`
§18.3.2 contained the complete answer including the required `[SDM 3C §27.6.12]` anchor.

### trap-ooh-venue — narrow escape, no failure

No item missed and no violation, but worth recording: `must_not_include` bans the literal
strings `"SOSP'22"` and `"SOSP 2022"`, while `must_include` item 3 **requires** the answer to
say "the frequent attribution to SOSP in 2022 is wrong". My answer read *"not SOSP '22, which
is the frequent misattribution"* — it escapes both banned strings only because I happened to
write `SOSP '22` with a space rather than `SOSP'22`. Same defect class as 3a.

## Notes

- **Context cost.** SKILL.md + 6 chapter sections + `errata.md` answered all 12. No chapter was
  read in full; the routing table's promise of "one chapter plus errata" held for 10 of 12.
- **`errata.md` is doing most of the work on this subset.** Every one of the 12 traps has a
  matching errata entry (E01–E04, E16–E22), and for Q5 and Q8 errata was the *only* place the
  answer existed in usable form. The instruction in SKILL.md §"How to use this skill" step 3
  ("check errata.md before writing anything") is what makes the trap subset survivable; if a
  reader skips it, at least 2 of 12 flip to wrong answers and several others lose the
  "…and the common claim is wrong" half of the answer.
- **Stop rule works.** SKILL.md's worked example ("EPT violation handling needs `06` for the
  structures and `05` for the qualification layout") routed Q1 and Q2 correctly on the first
  try; this is the single most load-bearing sentence in the routing section.

## Findings for the maintainer

### 1. Fact present in the corpus but the chapter that owns it does not have it (chapter-structure problem)

**Q5, MBEC generation.** Three files point at each other and none of them carries the claim:

- `references/06-address-translation.md` §6.3.1 line 112: *"…the generation in which it first
  shipped is a history fact owned by `01-vmx-intro.md` and adjudicated in `errata.md`."*
- `references/01-vmx-intro.md` contains **zero** occurrences of "MBEC", "mode-based",
  "Kaby Lake" or "Skylake". The pointer is dangling.
- `references/errata.md` E01's `Owner:` line says the owner is **`06-address-translation.md`** —
  pointing straight back at the chapter that disclaimed it.

The fact survives only in `errata.md` E01 and a one-line row of the `00-quickref.md` §0.4
terminology table. The eval key names `06-address-translation.md` as the chapter, so by the
key this scored a routing *hit* that would have produced "the skill does not say" had I not
followed the mandatory errata step. **Fix:** put the Kaby-Lake claim in `06` §6.3.1 (with its
`[600][601]` anchors and the `C:high` marker), delete the `01-vmx-intro.md` pointer, and make
E01's `Owner:` line consistent with wherever it lands.

Nothing else in the subset was "present but hard to find" — `05` §5.4.6 and §5.13, `06` §6.5
and §6.8, `13` §13.21.2, `15` §15.5.2 and `00` §0.1 all surfaced their fact in the first
section I opened.

### 2. Routing misses, with the wording that would have prevented each

| Q | Where I went, and why | Where it lives | Routing-table wording that fixes it |
|---|---|---|---|
| 11 | Row *"Transient-execution CVEs and **mitigation MSRs**, VBS, HVCI… → `15-security.md` §15.5"*. "Intel advisory number and CVE" reads as a CVE question. `15-security.md` has **no** occurrence of "TDXRay". | `13-tdx.md` §13.21.2 | Amend the `13` row to *"TDX: SEAMCALL/TDCALL leaves, TD lifecycle, Secure EPT, attestation, **TDX CVEs and Intel advisories (CVE-2025-30513, INTEL-SA-01397, TDXRay)**"*, and qualify the `15` row: *"…transient-execution CVEs on client/CPU cores (TDX-specific CVEs and advisories are in `13-tdx.md`)"*. This is the one genuine routing failure of the twelve. |
| 12 | Row *"**Document numbers**, symptom triage, terminology, where a table lives → `00-quickref.md`"*. The question is literally "which revision should I cite". | key says `10-vtd-dma-remapping.md`; `00` §0.1 + errata E21 answered it completely | Either accept `00-quickref.md` in the key, or add *"which VT-d revision to cite"* to the `10` row. I'd argue the key is the thing to change: `00` §0.1 is exactly the right place for "what do I cite", and it answered 3/3 with a valid `[VT-d 5.20 Ch.1]` anchor. |
| 10 | Same *"Document numbers"* row — "point me at the specification" is a document-lookup question. | key says `06-address-translation.md` §6.10 | `00` §0.1 "Three traps" gives the no-such-document fact but **not** the SDM section list; those came from errata E22 and `06` §6.10. Add **HLAT/VT-rp** to the `06` row explicitly — it already lists "HLAT", so extend it to *"HLAT and VT-rp (paging-write control, guest-paging verification — there is no separate VT-rp spec)"* — **and** add the three SDM section pointers to `00` §0.1 so the quickref route is self-sufficient. |
| 8 | Row *"Full citation list → `bibliography.md`"*. "Where was X published" is a bibliography question. | key says `14-nested-virtualization.md` §14.13 | `bibliography.md` [307]/[308] gave the correct venue but carries no "not SOSP" correction, so the trap was only defused by the mandatory errata read. Add to the `14` row: *"…nesting on a PC, **research-paper provenance (Out of Hypervisor)**"*, or add a one-line header note to `bibliography.md`: *"publication-venue corrections live in `errata.md`"*. |
| 4 | Row *"Intel vs AMD SVM/SEV… → `18-comparison-amd-arm-riscv.md`"*. The question opens *"AMD has ASIDs…"*, which SKILL.md's own scope rules send to `18`. | key says `06-address-translation.md` §6.6 | **The key is wrong here, or at least too narrow.** `18` §18.3.2 is titled *"TLB tagging: the 'Intel has no ASID' error"* and carries the required `[SDM 3C §27.6.12]` anchor plus the AMD 32-bit ASID and ARM VMID comparisons that three of the four `must_include` items need. Make the key accept `06` **or** `18`. |

Net: one routing-table defect (Q11), one chapter-coverage gap reachable only via errata (Q10
section list), and three cases where the eval key disagrees with SKILL.md's own routing rather
than the routing being wrong.

### 3. Places where the chapter and the eval disagree — needs human adjudication

#### 3a. `must_not_include` is substring-matched, but `must_include` requires naming the misconception. **The eval is wrong.**

This is the most important finding in the run, because it is the only thing standing between
this subset and a clean pass.

- **`trap-intel-asid`.** `must_not_include: "Intel has no ASID mechanism"`. But
  `must_include` item 1 is *"Intel has two address-space identifier mechanisms, **not none**"*,
  which invites exactly the refute-the-claim sentence that trips it. Worse, the skill's own
  corpus would fail its own eval:
  - `references/18-comparison-amd-arm-riscv.md` line 123 — heading: **`### 18.3.2 TLB tagging: the "Intel has no ASID" error`**
  - `references/18-comparison-amd-arm-riscv.md` line 127 — *"The assertion that Intel has no ASID mechanism is wrong."*
  - `references/errata.md` E19 — *`Misconception: "Intel processors have no ASID mechanism; ASID is AMD-only."`*

  A rule that scores the skill's own correction as a trap violation is measuring the wrong
  thing. RUNNER.md's own worked example confirms the intent is **assertion**, not occurrence:
  *"If the answer said 'bit 7 indicates the physical address is valid', that is a miss **and** a
  trap violation."*
- **`trap-ooh-venue`.** Same shape. `must_not_include: ["SOSP'22", "SOSP 2022"]` versus
  `must_include: "the frequent attribution to SOSP in 2022 is wrong"`. My answer escaped only
  on a space character (`SOSP '22`). A correct answer that writes "not SOSP 2022" is punished.

**Recommended fix (pick one):**
1. Restate each banned string in assertion form — `"ZombieLoad is CVE-2019-11091"` (already
   correct), `"Intel has no ASID mechanism, so it flushes"` / `"Intel flushes the TLB on every
   VMX transition"` (the second is already there and is the one that actually matters),
   `"published at SOSP'22"` / `"OoH was published at SOSP"`. Drop the bare noun-phrase forms.
2. Or add a `negation_window` to the scorer: a banned string does not count when preceded
   within ~8 tokens by `not`, `no longer`, `wrong`, `is not`, `misconception`, `incorrectly`,
   or an opening quotation mark.

Option 1 is cheaper and deterministic, and it is what the `lint.mjs` MISCONCEPTIONS rules
RUNNER.md §"What a failure means" asks for will need anyway — otherwise the lint rule will fire
on `18` §18.3.2's own heading on the first run.

#### 3b. `trap-tdxray-advisory`'s maintainer note is stale. **The eval is wrong.**

The question carries: *"NOTE FOR MAINTAINERS: `90-dated-landscape.md` currently contradicts
this and must be fixed."* It no longer contradicts it. `references/90-dated-landscape.md`
line 179 reads: *"…Intel responded with security announcement INTEL-2026-04-02-001 on
2026-04-02, **not** with an INTEL-SA advisory — TDXRay has no advisory number and no CVE."*
That agrees with `13-tdx.md` §13.21.2 in both facts and framing. Delete the note, or it will
keep sending someone to fix an already-fixed file.

#### 3c. Two `required_citation` values point at the skill, contradicting SKILL.md's output standard. **Genuine conflict; a human must choose.**

- `trap-mbec-generation`: `required_citation: "errata.md E01"`
- `trap-ooh-venue`: `required_citation: "errata.md E04"`

SKILL.md §"Output standards" says, first bullet: *"**Cite the specification, not this skill.**
… Reproduce the Intel document and section in your answer."* An answer that obeys SKILL.md
literally would cite `[600][601]` / SC'22 and **fail** these two citation checks; an answer
that satisfies the eval violates the stated output standard. I satisfied both by naming the
errata entry *and* the underlying sources, but that is a workaround, not a resolution.

My read: the **eval** is closer to right on the facts and the **skill** is right on the
principle. Neither MBEC's generation nor a paper's venue is an Intel-specification fact, so no
`[SDM …]` anchor can exist for them — E01 cites `[600][601]` and E04 cites `[607][608]`, both
secondary. The clean resolution is to change `required_citation` to the **bibliography
reference numbers** (`[600]`/`[601]` and `[607]`/`[608]`) rather than the errata filename, and
to add a carve-out to SKILL.md's output standard: *"History, provenance and product facts have
no specification anchor; cite the bibliography reference number instead."* Failing that, the
two documents will keep pulling answers in opposite directions.

#### 3d. Compound `must_include` items make partial credit meaningless. **Eval hygiene.**

`trap-intel-asid` item 4 bundles three independent assertions into one string; I satisfied two
and lost the whole item on the third ("Intel does not use the *name* ASID"). RUNNER.md promises
*"partial credit per item, not per question"*, which only works if items are atomic. Split it
into three. Several other trap items (`trap-ept-qual-bit6` item 4, `trap-sdm-vmx-chapter-numbers`
item 2 with its ten-chapter list) are compound too, and happen to have been answered in full
here — they are latent scoring noise.
