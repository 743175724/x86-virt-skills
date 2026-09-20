# Independent scoring — `lookup` (24) + `trap` (12) — 2026-09-20

Scorer: independent agent. **Did not write the answers.** Graded strictly against
`eval/questions.yaml` (`must_include`, `must_not_include`, `required_citation`) under
`eval/RUNNER.md`, plus the caller's additional rule that an explicit
"THE SKILL DOES NOT CONTAIN THIS" scores every `must_include` item for that question
as a **miss**, flagged `honest-gap`.

Answer files graded:
- `C:\Users\Administrator\Desktop\Kimi_Agent\eval\answers\lookup.md`
- `C:\Users\Administrator\Desktop\Kimi_Agent\eval\answers\trap.md`

---

## Subset: `lookup` (24 questions)

| id | items | cite | violations | honest-gap | routing as recorded by answerer | key chapter | route ok |
|---|---|---|---|---|---|---|---|
| vmcs-encoding-derive | 6/6 | y | — | — | `02-vmcs.md` §2.5 | 02-vmcs.md | y |
| tertiary-controls-encoding-and-msr | 4/4 | y | — | — | `02-vmcs.md` §2.5 | 02-vmcs.md | y |
| hlat-pointer-encoding | **0/3** | y | none | **yes** | `02-vmcs.md` §2.5 + `06` | 02-vmcs.md | y |
| exit-reasons-ept-family | 4/4 | y | — | — | `05-vm-exit.md` §5.3 (+06) | 05-vm-exit.md | y |
| exit-reason-entry-failure-values | 5/5 | y | — | — | `05-vm-exit.md` §5.3 → `04` §4.9 | 05-vm-exit.md | y |
| exit-qual-io-instruction | 5/5 | y | — | — | `05-vm-exit.md` §5.4 | 05-vm-exit.md | y |
| eptp-low-bits | 5/5 | y | — | — | `06-address-translation.md` | 06 | y |
| ept-misconfiguration-conditions | 4/4 | y | none | — | `06-address-translation.md` | 06 | y |
| pml-log-and-index | 5/5 | y | — | — | `06-address-translation.md` | 06 | y |
| virtual-apic-page-offsets | 5/5 | y | — | — | `07-apic-virtualization.md` | 07 | y |
| posted-interrupt-descriptor-layout | 6/6 | y | — | — | `07-apic-virtualization.md` | 07 | y |
| apicv-vmcs-encodings | 7/7 | y | — | — | `07` (+`02` for encodings) | 07 | y |
| pid-pointer-table-encoding | **0/3** | y | none | **yes** | `07` → `02` §2.5 | 07 | y |
| vminstr-error-vmptrld | 3/3 | y | — | — | `08-vmx-instructions.md` §8.4 | 08 | y |
| vmx-capability-msr-addresses | 10/10 | y | — | — | `08-vmx-instructions.md` §8.4 | 08 | y |
| invvpid-types | 6/6 | y | — | — | `08` §8.4 (+`06` §6.7) | 08 | y |
| dmar-register-offsets | 7/7¹ | y | — | — | `10-vtd-dma-remapping.md` | 10 | y |
| invalidation-descriptor-types | 11/11 | y | — | — | `10-vtd-dma-remapping.md` | 10 | y |
| irte-remapped-layout | 14/14 | y | — | — | `11-vtd-interrupt-remapping.md` | 11 | y |
| irta-reg-size-field | 6/6 | y | none | — | `11-vtd-interrupt-remapping.md` | 11 | y |
| vtd-fault-reason-codes | 6/6 | y | — | — | `12-vtd-faults-bios-siov.md` | 12 | y |
| fault-recording-register-layout | 7/7 | y | — | — | `12-vtd-faults-bios-siov.md` | 12 | y |
| tdx-leaf-numbers | 4/4 | y | — | — | `13-tdx.md` §13.5/§13.6 | 13 | y |
| tdx-gpaw-shared-bit | 4/4 | y | — | — | `13-tdx.md` §13.8 | 13 | y |

**Subtotal `lookup`: 134/140 must_include = 95.7% · citations 24/24 = 100% ·
asserted violations 0 · honest-gap 2 · routing correct 24/24.**

¹ `dmar-register-offsets` item 7 scored as a hit with a recorded shortfall — see
"Partial items" below.

---

## Subset: `trap` (12 questions)

| id | items | cite | violations | honest-gap | routing as recorded by answerer | key chapter | route ok |
|---|---|---|---|---|---|---|---|
| trap-ept-qual-bit7 | 3/3 | y | 0 asserted; 1 refuted | — | `05-vm-exit.md` §5.4 | 05 | y |
| trap-ept-qual-bit6 | 4/4 | y | 0 asserted; 1 refuted | — | `05-vm-exit.md` §5.4 | 05 | y |
| trap-zombieload-cve | 4/4 | y | 0 asserted; 1 refuted | — | `15-security.md` §15.5 | 15 | y |
| trap-intel-asid | **3/4** | y | 0 asserted; 1 refuted | — | `06-address-translation.md` | 06 | y |
| trap-mbec-generation | 4/4 | y | 0 asserted; 1 refuted | — | `06-address-translation.md` | 06 | y |
| trap-pml-generation | 2/2 | y | 0 asserted; 1 refuted | — | `06-address-translation.md` | 06 | y |
| trap-ept-walk-accesses | 4/4 | y | 0 asserted; 1 refuted | — | `06-address-translation.md` | 06 | y |
| trap-ooh-venue | 3/3 | y | 0 asserted; 1 refuted | — | `bibliography.md` (self-flagged imprecise) | 14-nested-virtualization.md | **n** |
| trap-sdm-vmx-chapter-numbers | 5/5 | y | 0 asserted; 1 borderline² | — | `00-quickref.md` | 00-quickref.md | y |
| trap-vt-rp-specification | 5/5 | y | 0 asserted; 1 borderline³ | — | `06-address-translation.md` | 06 | y |
| trap-tdxray-advisory | 4/4 | y | 0 asserted; 1 refuted | — | `13-tdx.md` §13.21 | 13 | y |
| trap-vtd-current-revision | 3/3 | **n** | 0 asserted; 1 refuted | — | `00-quickref.md` (+`10` §10.1) | 10-vtd-dma-remapping.md | partial |

**Subtotal `trap`: 44/45 must_include = 97.8% · citations 11/12 = 91.7% ·
asserted violations 0 · refuted-not-asserted 12 (10 clean + 2 borderline) ·
honest-gap 0 · routing correct 10/12.**

---

## Combined

| Metric | Value | Bar | Result |
|---|---|---|---|
| `must_include` | **178/185 = 96.2%** | ≥ 90% | PASS |
| asserted `must_not_include` violations | **0** | 0 | PASS |
| `required_citation` validity | **35/36 = 97.2%** | ≥ 95% | PASS |
| `honest-gap` | 2 | — | — |

**Verdict: PASS.**

Alternative reading, for the maintainer's information only: if the two
`honest-gap` questions were scored against the key as literally written — their
`must_include` items *are* the expected hedge, and the answers reproduce all six
verbatim — the combined score would be **184/185 = 99.5%** and `lookup` would be
140/140 = 100%. The 96.2% figure above applies the caller's stricter rule that a
declared non-answer never earns credit.

---

## Every missed item, with the closest verbatim sentence from the answer

### hlat-pointer-encoding — 0/3 (`honest-gap`)

Scored zero solely under the non-answer rule. All three items are textually
present; this is a **content gap in the skill**, not a phrasing failure by the
answerer.

- **Missed:** "this knowledge base does not state those encodings"
  **Closest:** "**THE SKILL DOES NOT CONTAIN THIS.** … The knowledge base deliberately withholds these two encodings rather than state unverified values."
- **Missed:** "they are listed among the encodings deliberately omitted because they could not be confirmed"
  **Closest:** "`02-vmcs.md` §2.5.6 lists \"the HLAT pointer and HLAT prefix-size fields of §27.6.22\" among the encodings that are **not** stated, \"because they could not be confirmed against the field-encoding appendix in this pass.\""
- **Missed:** "read them from the Vol.3D field-encoding appendix or from a kernel header before using them"
  **Closest:** "Read the actual encodings out of SDM Vol.3D Appendix B or a kernel header before using them."

Diagnosis: **chapter lacks the fact** (by design). Remedy is to source the two
encodings, not to change the answer.

### pid-pointer-table-encoding — 0/3 (`honest-gap`)

Same shape. All three items textually present; scored zero under the non-answer rule.

- **Missed:** "this knowledge base does not state those encodings"
  **Closest:** "**THE SKILL DOES NOT CONTAIN THIS.** Neither encoding is stated, and both owning chapters say so explicitly rather than guess."
- **Missed:** "they are among the facts deliberately omitted because they could not be anchored"
  **Closest:** "`07-apic-virtualization.md` §7.12 lists \"the VMCS encodings of the PID-pointer table address and last PID-pointer index\" among the facts deliberately not stated because they could not be anchored with confidence."
- **Missed:** "the field roles are known - the table is indexed by the target APIC ID and each entry carries a valid bit in bit 0 - but the encodings are not"
  **Closest:** "The processor locates the target vCPU's posted-interrupt descriptor through a **PID-pointer table indexed by the target vCPU's APIC ID** … A **PID-pointer table entry carries a valid bit in bit 0** alongside the 64-byte-aligned address of the descriptor."

Diagnosis: **chapter lacks the fact** (by design).

### trap-intel-asid — 3/4 (a real content divergence)

- **Missed:** "what is true is narrower: Intel does not use the name ASID and does not use a single identifier for both roles, whereas **AMD's 32-bit ASID covers the VM-tagging role alone**"
  **Closest (first half — matches):** "Intel does not use the *name* ASID, and does not use a single identifier for both roles. It keeps a **guest-managed PCID namespace and a hypervisor-managed VPID namespace** that combine when both are active."
  **Contradicting sentence (second half):** "AMD folds process-level and VM-level tagging into **one 32-bit ASID namespace** managed by the hypervisor (ASID 0 belongs to the host; the number actually implemented is reported by CPUID, so the architectural field width is not the usable range)."

Diagnosis: **content conflict, not phrasing.** The key says AMD's ASID covers the
VM-tagging role *alone*; the answer says it covers *both* process-level and
VM-level tagging. One of `18-comparison-amd-arm-riscv.md` §18.3.2 and the key is
wrong about AMD. Worth resolving before the next run — this is the only substantive
factual divergence in either subset.

### trap-vtd-current-revision — citation invalid

- **Required:** `VT-d 5.20 Ch.1`
  **Closest given:** "Intel VT-d Architecture Specification, order **D51397-019, Rev 5.20, April 2026** (revision per PDF cover page); recorded at `00-quickref.md` §0.1, `10-vtd-dma-remapping.md` §10.1 and `errata.md` E21."
  The answer names the document, revision and order number but **no Ch.1 anchor**.
  The only chapter anchors it offers are illustrative and different: "Ch.3 \"DMA
  Remapping\", Ch.4 \"Support For Device-TLBs\", Ch.6 \"Caching Translation
  Information\", Ch.9 \"Translation Structure Formats\", Ch.11 \"Register
  Descriptions\"."

Diagnosis: **citation missing.** The chapter almost certainly carries the anchor
(`10-vtd-dma-remapping.md` §10.1 "Which document this chapter tracks"); the answer
did not surface it. Either add `[VT-d 5.20 Ch.1]` to the revision claim in
`00-quickref.md` §0.1, or relax `required_citation` to accept the order number.

---

## Partial items (scored as hits, recorded for transparency)

- **`dmar-register-offsets` item 7** — "the IOTLB registers and the fault recording
  registers are not at fixed offsets - they come from ECAP_REG.IRO and CAP_REG.FRO,
  **each scaled by 16**". The answer states the float, both source fields, and the
  ×16 scaling **for FRO only**: "the **IOTLB registers** from **ECAP_REG.IRO** and
  the fault recording registers from **CAP_REG.FRO**. (For the latter: if the
  register base address is X and CAP_REG.FRO reports Y, the first Fault Recording
  Register is at **X + 16\*Y**, with registers 16 bytes apart.)" The IRO scaling is
  never given. Scored a hit because the item's operative claim is fully asserted;
  a maintainer may want `10-vtd-dma-remapping.md` §10.5 to state the IRO scaling
  explicitly.

- **`irta-reg-size-field` item 6** — the answer names the command ("values written
  to IRTA_REG take effect only after software executes the Set Interrupt Remap Table
  Pointer command") but not the register bit `GCMD_REG.SIRTP`. Scored a hit on
  substance.

- **`invvpid-types` item 6** — "error 28 is also reported when the processor does
  not support the requested type" is conveyed positionally rather than as a direct
  sentence: it appears as check 3 in a numbered list headed "**Why you are getting
  error 28.** … So check, in this order:" — "**Does the processor actually support
  the type you are using?** Which INVEPT and INVVPID types a processor supports is
  enumerated in **IA32_VMX_EPT_VPID_CAP (48CH)**". Scored a hit; the causal link is
  clear from the framing.

---

## `must_not_include` — refuted, not asserted

Zero banned strings were asserted. Twelve trap answers named a misconception in
order to correct it. The ten unambiguous cases, quoted:

| id | banned string | the answer's own position (verbatim) |
|---|---|---|
| trap-ept-qual-bit7 | "bit 7 means the guest-physical address is valid" | "It is not a \"guest-physical address is valid\" indicator — that is the widely circulated misreading, and the skill records it as a settled erratum." |
| trap-ept-qual-bit6 | "bit 6 is the logical-AND of the XD bits" | "No. Bit 6 has nothing to do with the XD (execute-disable) bit of the guest's own paging structures." |
| trap-zombieload-cve | "ZombieLoad is CVE-2019-11091" | "It is commonly misattributed to CVE-2019-11091. That identifier belongs to a **different** member of the same family: **MDSUM**." |
| trap-intel-asid | "Intel does not have an ASID-like mechanism" / "Intel flushes the TLB on every VMX transition" | "Intel does not flush on every transition, and the claim that Intel has no ASID-style mechanism is **wrong as stated**." |
| trap-mbec-generation | "MBEC was introduced with Skylake" | "No — that is the misconception this knowledge base records as erratum E01. **Mode-Based Execute Control first appeared in Kaby Lake** … not Skylake." |
| trap-pml-generation | "PML was introduced with Skylake" | "It was not Skylake; that attribution is recorded as erratum E02." |
| trap-ept-walk-accesses | "up to 20 memory accesses" | "The commonly repeated figure of **20 is wrong** — it is recorded as erratum E03." |
| trap-ooh-venue | "was published at SOSP" | "It was **not** SOSP '22; that attribution is recorded as erratum E04." |
| trap-tdxray-advisory | "TDXRay is covered by INTEL-SA-01271" | "**The widely repeated attribution of TDXRay to INTEL-SA-01271 is wrong.** INTEL-SA-01271 is the **Intel Gaudi Software Installer Advisory** of 2025-05-13." |
| trap-vtd-current-revision | "the current VT-d specification is Rev 4.1" | "Cite **Rev 5.20, April 2026, order number D51397-019** … Do **not** cite Rev 4.1." |

### Two borderline cases — judged *not asserted*, flagged for review

² **`trap-sdm-vmx-chapter-numbers`**, banned: "Virtualization of System Resources is
SDM Vol.3C chapter 32". The answer's **Disagreement** section says: "\"Virtualization
of System Resources\" and \"Handling Boundary Conditions in a Virtual Machine
Monitor\" *were* real SDM Vol.3C chapter titles in older revisions (around Ch.32 and
Ch.33 in the pre-renumbering scheme)." This is past-tense, hedged ("around"), and
framed inside the correction — the same paragraph ends "The skill says they no longer
exist, which is consistent — but a reader should understand that someone citing them
has a stale manual". **Not a violation**, but it is the nearest miss in the set: the
answerer volunteered old chapter numbers from its own memory, which the skill's own
output standard forbids.

³ **`trap-vt-rp-specification`**, banned: "the Intel VT-rp specification, document
number". The answer's **Disagreement** section volunteers: "before this material was
folded into the SDM, VT-rp (HLAT, paging-write control, guest-paging verification)
was documented in the **Intel Architecture Instruction Set Extensions and Future
Features Programming Reference, document 319433**". It immediately disclaims the
banned framing — "it does not change the answer, because 319433 is a future-features
reference rather than a VT-rp specification" — and hedges confidence. **Not a
violation** (a different document is named, and the non-existence claim is
reaffirmed), but this is exactly the shape the trap guards against and a reader
skimming could take away "VT-rp has a document number". Recommend the maintainer
either adopt the 319433 provenance into `06-address-translation.md` §6.10 with a
Tier-1 anchor, or add a lint rule pairing "VT-rp" with any document number.

---

## Routing notes

- `lookup`: 24/24 routed to the chapter the key names. No routing defects.
- `trap`: 2 of 12 imprecise, both self-reported by the answerer.
  - `trap-ooh-venue` routed to `bibliography.md`; the key owns it in
    `14-nested-virtualization.md`. Answerer's own note: "the routing table has no row
    that obviously captures \"where was paper X published\", and the
    nested-virtualization row does not mention research provenance. That is a
    routing-table gap." **Fix: add a research-provenance cue to the
    nested-virtualization routing row in `SKILL.md`.** The answer was still correct
    because `errata.md` E04 carries the fact.
  - `trap-vtd-current-revision` routed to `00-quickref.md`; the key owns it in
    `10-vtd-dma-remapping.md`. The answerer read both, so this is a soft miss — the
    document-revision fact is genuinely duplicated in the quickref.

## Note on answerer self-disclosure

Three trap answers (`trap-sdm-vmx-chapter-numbers`, `trap-vt-rp-specification`,
`trap-vtd-current-revision`) contain a **Disagreement** section in which the answerer
supplies facts from its own pre-training rather than the skill, each explicitly
labelled as such. None changed a `must_include` outcome and none produced a
violation, but two of the three are the borderline cases above. The protocol's
"answer from the skill alone" rule is being honoured in the answer body and relaxed
in the disagreement footer; the maintainer may want that footer excluded from the
graded text in future runs.
