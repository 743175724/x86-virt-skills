# intel-vt eval — Claude Opus 5 (claude-opus-5), mechanism subset — 2026-09-20

Skill commit: e130c44
Questions: 24 (type: mechanism) · must_include: 148/154 (96.1%) · trap violations: 0 · citations valid: 24/24 (100%)
Routing correct on first try: 24/24 (100%)
Verdict: **PASS** (bar: ≥90% hits, 0 trap violations, ≥95% citations)

Protocol followed: read `intel-vt/SKILL.md` only, extracted `id`/`chapter`/`type`/`question`
for the 24 mechanism questions, recorded a routing decision per question from the
SKILL.md routing table *before* opening anything, then opened that chapter (plus
`errata.md`, per SKILL.md step 3, for the questions that touch commonly circulated
claims). `must_include` / `must_not_include` / `required_citation` were read only after
all 24 answers were formed.

## Per-question results

| # | id | Chapter I chose from the routing table (before opening) | Eval's chapter | Routing right 1st try | must_include | Trap | Citation |
|---|---|---|---|---|---|---|---|
| 1 | vm-entry-check-order | `04-vm-entry.md` §4.9 | 04 | yes | 8/8 | — | valid |
| 2 | pir-virr-merge-and-on-sn-race | `07-apic-virtualization.md` | 07 | yes | 9/9 | — | valid |
| 3 | vmcs-shadowing-mechanism | `14-nested-virtualization.md` | 14 | yes | 7/7 | — | valid |
| 4 | vmcs02-merging | `14-nested-virtualization.md` | 14 | yes | 8/8 | — | valid |
| 5 | secure-ept-page-acceptance | `13-tdx.md` | 13 | yes | 7/7 | — | valid |
| 6 | vtd-queued-invalidation | `10-vtd-dma-remapping.md` | 10 | yes | 7/7 | — | valid |
| 7 | hvci-uses-ept | `15-security.md` | 15 | yes | 5/5 | — | valid |
| 8 | virtual-interrupt-delivery | `07-apic-virtualization.md` | 07 | yes | 7/7 | — | valid |
| 9 | ept-violation-vs-misconfiguration | `06-address-translation.md` | 06 | yes | **7/9** | — | valid |
| 10 | default1-controls-and-true-msrs | `02-vmcs.md` | 02 | yes (ambiguous) | 8/8 | refuted, not asserted | valid |
| 11 | idt-vectoring-reinjection | `05-vm-exit.md` §5.3 | 05 | yes | **5/6** | — | valid |
| 12 | vpid-ept-tagging | `06-address-translation.md` | 06 | yes | 7/7 | — | valid |
| 13 | ve-conversion-and-busy-field | `06-address-translation.md` | 06 | yes | 5/5 | — | valid |
| 14 | ipi-virtualization-pid-table | `07-apic-virtualization.md` | 07 | yes | 7/7 | — | valid |
| 15 | interrupt-index-and-source-validation | `11-vtd-interrupt-remapping.md` | 11 | yes | **5/7** | — | valid |
| 16 | ooh-reported-results | `14-nested-virtualization.md` | 14 | yes (ambiguous) | 4/4 | not asserted | valid |
| 17 | hyperv-owns-vmx-root | `17-windows-platform.md` §17.1 | 17 | yes | 5/5 | — | valid |
| 18 | enlightened-vmcs | `17-windows-platform.md` | 17 | yes | 4/4 | — | valid |
| 19 | vtl-isolation-slat | `15-security.md` | 15 | yes | 6/6 | — | valid |
| 20 | tdx-tlb-tracking | `13-tdx.md` | 13 | yes | 8/8 | — | valid |
| 21 | l1tf-mitigation-chain | `15-security.md` §15.5 | 15 | yes | **6/7** | — | valid |
| 22 | flexpriority-generation | `07-apic-virtualization.md` (+ errata) | 07 | yes | 5/5 | — | valid |
| 23 | vmfunc-generation | `06-address-translation.md` (+ errata) | 06 | yes | 4/4 | — | valid |
| 24 | tdx-aes-key-strength | `13-tdx.md` (+ errata) | 13 | yes | 4/4 | — | valid |

Three routing decisions were genuinely ambiguous from the table alone and are marked
"ambiguous" above even though the first choice was right — see Findings.

Scoring rule applied consistently for compound `must_include` strings: an item that
restates a fact I gave under a different label (e.g. "IA32_FLUSH_CMD **(MSR 10BH)**"
when I named IA32_FLUSH_CMD and its bit) is scored a **hit**; an item that carries an
*additional distinct fact* I did not give (e.g. a numeric fault-reason code) is scored a
**miss**.

## Failures

### ept-violation-vs-misconfiguration (7/9)

**Asked:** "What is the difference between an EPT violation and an EPT misconfiguration,
and how should my handlers differ?"

**Answered (verbatim, the relevant closing part):** "Handlers: for 48, read the GPA, find
the region, then install a mapping (demand paging), emulate (MMIO), or run a policy hook
and resume. For 49, there is no recovery path — resuming without changing the entry
re-raises the same exit; dump the entry and treat it as a hypervisor bug. Most common
real cause: a non-atomic update to a live EPT entry that momentarily leaves an illegal
combination (e.g. clearing read while write is still set). An EPT violation can also
occur while reading a guest paging-structure entry."

**Missing:**
- "for a violation, qualification bits 3, 4 and 5 all clear means the guest-physical
  address is not mapped at all by EPT, while some of them set means a permission failure
  on a mapped page"
- "neither exit advances RIP: the saved guest RIP points at the faulting instruction and
  the instruction must be re-executed, not skipped"

**Trap hit:** none.

**Diagnosis:** *fact present, but in the other chapter.* Both items live in
`05-vm-exit.md` — the bits 3/4/5 rule in §5.12 (and the bit-by-bit qualification layout
in §5.4.6), the "do not advance RIP" rule in §5.3.1. Chapter 06 §6.4 says only "exit
qualification … reports the access type and the effective permissions" and hands the
layout to 05. SKILL.md's stop rule actually names this exact pair ("EPT violation
handling needs `06` for the structures and `05` for the qualification layout"), but the
routing table row for EPT sends you to 06 alone, and §6.4.4's "triaging in practice"
reads as a complete handler recipe, so a reader who obeys "Stop. One chapter plus
errata" stops one chapter short.

### idt-vectoring-reinjection (5/6)

**Asked:** "My guest hangs after a fault that happened while it was taking another fault.
What is the architectural mechanism I am missing?"

**Answered (verbatim, closing):** "Standard response: copy IDT-vectoring information and
error code into the VM-entry interruption-information and VM-entry exception error-code
fields for the next entry, adjusting for the type of the original event. For software
interrupt / privileged software exception / software exception the VM-exit instruction
length must be carried over to the VM-entry instruction length. Your hang is a dropped
event — the second fault exited while the first was being delivered, and if you handle
only the new exit reason and resume, the original interrupt/exception never reaches the
guest."

**Missing:**
- "the field must be read on every VM exit unconditionally, because a task switch, an EPT
  violation or an exception can all interrupt event delivery"

**Diagnosis:** *fact present but not found.* It is in `05-vm-exit.md` §5.12 step 3 (and a
claim line under it), not in §5.6, which is the section that owns the field. The routing
table points at §5.3. §5.6 states the layout, the valid bit and the re-injection recipe
but never says "read it on every exit"; the operational rule is two sections away in a
debugging recipe a reader may not reach.

### interrupt-index-and-source-validation (5/7)

**Asked:** "How does VT-d turn an incoming MSI into an IRTE lookup, and how does it decide
the device was allowed to raise that interrupt?"

**Answered (verbatim, the two relevant clauses):** "If the index is >= the number of IRTEs
in the table, the request is an error." … "SID is evaluated only when P is set and SVT is
01b or 10b; SQ only when P is set and SVT is 01b. Failure blocks the request."

**Missing:**
- "an index at or beyond the configured table size is an error **(fault reason 21h)**"
- "a source-id verification failure blocks the request and **is reported as fault reason
  26h**"

**Trap hit:** none — the conditions were stated correctly, only the fault codes were absent.

**Diagnosis:** *fact present but not found.* Both codes are in the same chapter, §11.10
(21h = interrupt_index exceeded the configured table size or IRTE access above HAW;
26h = source-id verification failure against SID/SVT/SQ with P set). §11.3 and §11.4.1,
which own the index computation and the validation, describe the failures only as "an
error" and "blocks the request" without naming the reason code, so an answer built from
the owning sections is numerically incomplete. Nothing in §11.3/§11.4.1 points forward to
§11.10.

### l1tf-mitigation-chain (6/7)

**Asked:** "What does a hypervisor actually have to do about L1TF, and why is turning off
hyperthreading not the whole answer?"

**Answered (verbatim, the mitigation part):** "What the hypervisor must do: flush L1D
before each guest entry — setting bit 0 of IA32_FLUSH_CMD removes all content from L1D,
and the flush must be repeated on every guest entry. Linux exposes
kvm-intel.vmentry_l1d_flush = always | cond | never, default conditional. A nested VMM
should check IA32_ARCH_CAPABILITIES bit 3 (SKIP_L1DFL_VMENTRY), which says the flush is
not required on VM entry. On the OS side, PTE inversion: a non-present entry is made to
refer to a physical address below MAXPHYADDR but above the highest cacheable memory, so
the speculative L1D lookup can never hit real data."

**Missing:**
- "where IA32_ARCH_CAPABILITIES bit 17 (FB_CLEAR) is reported, L1D_FLUSH does not
  overwrite fill buffers, so an L1TF flush is not an MDS mitigation and the VERW sequence
  is still required"

**Diagnosis:** *fact present but not found.* It is in the same chapter but in §15.4.2
(the IA32_ARCH_CAPABILITIES bit table and the claim under it), not in §15.5.1, which is
where the routing table's "§15.5" pointer and the CVE→mitigation matrix send you. §15.5.1
ends on the SMT argument and never mentions FB_CLEAR; the §15.5 matrix row for L1TF lists
"PTE inversion; L1D_FLUSH (FLUSH_CMD bit 0) on VM entry; SKIP_L1DFL_VMENTRY (ARCH_CAP bit
3); RDCL_NO; SMT policy" — FB_CLEAR appears only in the *MDS* row, so the cross-defect
interaction is invisible from the L1TF row.

## must_not_include — the one that fired inside a correction

**default1-controls-and-true-msrs** — banned string: "the first VMX processors only
supported the 1-setting of bits 1, 2 and 4".

**Answered (verbatim):** "Also: the old claim 'the first VMX processors supported only the
1-setting of bits 1, 2 and 4' describes the pin-based default-1 class, not an
early-silicon limitation."

**Recorded as: refuted, not asserted.** The answer names the misconception in order to
correct it, exactly as `02-vmcs.md` §2.8.4 does. Not a violation; question scores 8/8.

**ooh-reported-results** — banned string "EPML speeds up checkpointing by about 14x" was
not produced in any form. The answer kept "13x" (SC'22 write-up) and "about 14%" (arXiv
preprint) in separate, attributed sentences and explicitly refused to merge them.

## Notes on routing, stop rules and context cost

- Routing was right first try on all 24, but three were coin-flips that happened to land
  correctly; see Findings.
- Context cost: SKILL.md + `errata.md` + eleven chapters, all read by targeted `sed`
  ranges after a heading grep rather than whole-file reads. Whole-file reads are
  expensive here — `04-vm-entry.md` alone is ~50 KB — so the "read one chapter" guidance
  is realistically "read three or four sections of one chapter", and that is precisely
  where the four misses came from: every missed item was in a *section* of the right
  chapter (or of its named sibling) that no pointer led me to.
- `errata.md` was decisive for four questions (16, 22, 23, 24) and SKILL.md's step 3
  ("Check errata.md before writing anything that touches a commonly circulated claim")
  was sufficient to trigger reading it without any hint from the questions.

## Findings for the maintainer

### 1. Facts that are present but hard to locate (all four misses are this)

Not one miss was a content gap. Every single one was a fact sitting in a section that the
owning section does not point to:

| Missing fact | Lives in | Read instead |
|---|---|---|
| EPT-violation qualification bits 3/4/5 clear = unmapped | `05-vm-exit.md` §5.12 | `06` §6.4.4 |
| EPT violation / misconfig do not advance RIP | `05-vm-exit.md` §5.3.1 | `06` §6.4.2 |
| Read IDT-vectoring info on **every** exit | `05-vm-exit.md` §5.12 | `05` §5.6 |
| IR fault reasons 21h / 26h | `11-…` §11.10 | `11` §11.3, §11.4.1 |
| FB_CLEAR (ARCH_CAP bit 17) vs L1D_FLUSH | `15-security.md` §15.4.2 | `15` §15.5.1 |

Cheapest fixes, in order of payoff:
- `06-address-translation.md` §6.4.4: add one line — "Do not advance RIP on either exit,
  and use qualification bits 3–5 to separate 'not mapped' from 'mapped but not
  permitted'; the layout is `05-vm-exit.md` §5.4.6." Two must_include items recovered for
  one sentence, and it is a cross-reference, not a restatement, so it does not violate the
  no-restatement rule.
- `05-vm-exit.md` §5.6: move the "read it on every exit, unconditionally" claim from §5.12
  into §5.6, or duplicate the imperative there. §5.12 is a *debugging* recipe; a reader
  answering a mechanism question about reinjection reads §5.6 and stops.
- `11-vtd-interrupt-remapping.md` §11.3 / §11.4.1: append the fault-reason code to each
  failure sentence ("…is an error (fault reason 21h, §11.10)", "…blocks the request
  (fault reason 26h)"). The codes are what a reader actually needs at the point of
  failure.
- `15-security.md` §15.5.1: add the FB_CLEAR interaction to the L1TF section, or add a
  "see §15.4.2" pointer in the L1TF matrix row. Right now FB_CLEAR appears in the MDS row
  only, which hides the most consequential cross-defect fact in the chapter: flushing L1D
  is not an MDS mitigation.

### 2. Routing: no misses, but three near-misses worth wording out

The routing table is in good shape for mechanism questions. Three rows are ambiguous and
were resolved by luck or by second-guessing:

- **`ooh-reported-results`** ("What speedups does the Out of Hypervisor work report for
  EPML?"). Two rows compete: "Nested VMX, VMCS shadowing, vmcs02, nested EPT" → `14`, and
  "Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT" → `16`. The word
  *speedups* points at `16`; the answer is in `14` §14.13. Fix: add "academic results
  (Turtles, ELI, NEVE, OoH/EPML)" to the `14` row, or add "research-paper figures live in
  the chapter that owns the mechanism, not in `16`" to the `16` row.
- **`default1-controls-and-true-msrs`**. "execution/exit/entry controls" → `02`, but
  "capability MSRs" → `08`. The question names both. Both chapters answer it (02 §2.8.4
  and 08 §8.6.3 are near-duplicates of each other, which is itself worth a look given the
  no-restatement rule). Fix: make the `08` row read "VMX instruction semantics,
  VM-instruction error 1–28, capability-MSR *read rules and enumeration order*" and the
  `02` row "…controls **and the default-1 / TRUE_ MSR rule**".
- **`flexpriority-generation`**. "Which processor generation introduced X" smells like
  `90-dated-landscape.md` ("If a fact has a GA date, a version number…"). It is actually
  an errata open conflict owned by `07`. Fix: one line in the `90` row — "processor
  *generation* attributions are architecture history and stay with the owning chapter;
  disputed ones are in `errata.md`."

### 3. Where the chapter and the eval disagree

Only one, and it is mild: **`ept-violation-vs-misconfiguration` is filed under
`chapter: 06-address-translation.md`, but two of its nine `must_include` items exist only
in `05-vm-exit.md`.** I think the *eval* is right about the content (a handler-differences
question genuinely must cover "don't advance RIP" and the bits 3/4/5 triage) and the
*skill* is wrong about the layout — those two facts are handler behaviour, not
qualification-field layout, so 06 §6.4.4 is the natural home for at least a pointer. If
instead the maintainer wants to keep the strict ownership split, the eval entry should
carry `chapter: 06-address-translation.md + 05-vm-exit.md`, otherwise it silently
penalises an agent for obeying the skill's own "Stop." rule.

No other disagreement: on every disputed-fact question (16, 22, 23, 24) the chapter, the
errata entry and the eval agree exactly, including on refusing to pick a side.

### 4. Explanations that struck me as mechanically incomplete

These are the ones where the chapter answers the question but stops before the part that
makes the mechanism *work*:

- **`04-vm-entry.md` §4.1 / §4.9 — the "why" of the two failure shapes is asserted, not
  explained.** The chapter says stage 1/2 failures fall through and stage 3/5 failures go
  to the host RIP "because guest state has already been loaded". It never says the thing
  that makes this necessary: once guest state is loaded, the architectural state that
  VMLAUNCH's fall-through path would return to no longer exists, so the only way back is
  the VM-exit host-state load. §4.7.1 makes exactly this argument for the MSR areas ("the
  asymmetry is deliberate…") but the same reasoning is missing one section earlier where
  the question is actually asked. This is the one place where I had to be careful not to
  supply the reasoning from pre-training.
- **`06-address-translation.md` §6.11 — #VE non-reentrancy is stated but the failure mode
  is not closed.** The chapter says the busy field gates delivery and that a handler which
  faults again gets a VM exit. It does not say what a VMM should do with that exit
  (the guest handler is now wedged with busy = FFFFFFFFH and the VMM has to decide whether
  to clear it, inject a fault, or kill the guest). A #VE-using VMM must handle exactly
  that case; the chapter leaves the reader at the edge of it.
- **`14-nested-virtualization.md` §14.3 — VMCS shadowing's synchronisation is described
  only via KVM function names.** `copy_vmcs12_to_shadow()` / `copy_shadow_to_vmcs12()`
  carry the whole explanation of *when* the two images are reconciled. That is a Tier-2
  implementation artefact standing in for an architectural argument: the architectural
  fact is that the hardware never reconciles them, so L0 must, at every transition where
  either side could have changed. The chapter states the rule in prose above the claims
  but the citations under it are all `[301]` (KVM), not SDM.
- **`17-windows-platform.md` §17.2.3 — the enlightened VMCS is four sentences.** It says
  the guest hypervisor writes a memory structure "which Hyper-V consumes at VM entry
  instead of executing VMREAD and VMWRITE", but not how L1 *tells* L0 which fields it
  changed (the clean-fields / version bookkeeping that makes the software contract
  cheaper than shadowing) nor how L1 discovers eVMCS support. Compared with §14.3's
  treatment of hardware shadowing, this is a sketch. All three claims carry `C:medium`,
  so the chapter is honest about it — but a reader asked "how does it relate to VMCS
  shadowing" can only answer at the level of "same cost, software instead of hardware",
  which is what the eval's four items ask for and no more.
- **`13-tdx.md` §13.8.5 — the TLB-tracking protocol's liveness argument is implicit.** The
  five steps and the "tracked once every VCPU has been inactive at least once" condition
  are all there, but the chapter never states *why* an inactive-once observation is
  sufficient (a TD entry re-establishes translations under the new epoch, so any surviving
  cached entry must predate the block and cannot be re-created). It is inferable from the
  BEPOCH claim two lines down, but it is not said.
