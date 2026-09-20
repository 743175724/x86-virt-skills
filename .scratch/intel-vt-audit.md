# intel-vt audit — four failure classes imported from the amd-virtualization rebuild

Audit date: 2026-09-21. Read-only: no chapter, index or eval file was modified.

Corpora used for verification:
- `C:/Users/Administrator/AppData/Local/Temp/amd-spec/` — full AMD document set (APM Vol.1/2/3, IOMMU 3.11, SEV/SNP/SVSM/GHCB, revision guides). Used for every comparative negative.
- `learn.microsoft.com` via `curl -sS -H "X-Return-Format: html" "https://r.jina.ai/…"` — HTML mode throughout, because markdown mode drops headings.
- **The Intel SDM is not in the corpus.** Every Intel-internal negative below is classified by the quality of its scoping, not by re-reading the manual. Where that is the reason for a verdict, the finding says so.

`node tools/lint.mjs` and `node tools/build.mjs --check` both pass clean on the tree as audited, so nothing below is catchable by the existing gates.

## Headline

| Class | Checked | WRONG | STALE | UNSUPPORTED | UNSCOPED | Clean |
|---|---|---|---|---|---|---|
| 1 — fabricated negatives | 31 selected from 153 candidates | **1** | — | 5 | 6 | 19 |
| 2 — routing anchors | 7 anchored rows | — | — | 2 mismatched (1 is the chapter's entry point) | — | 2 clean, 3 partial |
| 3 — one fact in two files | 12 + ~220 + 80 questions / 446 key items | — | **14** | — | — | see per-part tables |
| 4 — navigational pointers | 68 pointer→section pairs | — | — | — | — | **68 / 68 resolve** |

The single **WRONG**: `intel-vt/references/18-comparison-amd-arm-riscv.md:189`.

The 14 **STALE**: `intel-vt/SKILL.md:31` · `eval/intel-vt/questions.yaml:7` · `errata.md:226` (×2) · `errata.md:68` + `core-facts.md:74` · `12-vtd-faults-bios-siov.md:417` vs `bibliography.md:99` · and 9 eval-key items at `questions.yaml:787, :533, :535, :378, :565, :619, :909, :925, :444`. Plus 2 intra-file contradictions (`17-windows-platform.md:302`, `16-performance.md:141`/`:313`).

---

## Class 1 — fabricated negatives

### Denominator

| Sweep | Count |
|---|---|
| Prescribed grep `(Intel\|SDM\|VT-x\|VMX\|VT-d\|TDX) … (has no\|have no\|does not exist\|is not defined\|no equivalent\|no counterpart)` | **16 hits** |
| Broad sweep, 22 negation patterns across all 23 corpus files | **153 candidate sentences** |
| Substantive existence negatives after triage (assertions that a named feature / counterpart / document / identifier / measurement does not exist) | **31 selected for individual verification** |
| Remainder of the 153 | 122 — triaged, not individually verified. They divide into mechanism-internal SDM statements carrying a section anchor ("there is no current VMCS", "second-stage entries have no Present bit", "the exit qualification is cleared to 0") and knowledge-base-scoped absence statements ("no public measurement … is recorded in this knowledge base", 9 of these in `16` and `17`). I spot-checked the scoping of a sample; none of the sampled ones was an unbounded universal about a vendor, a document or a counterpart, which is the class this audit is hunting. |

Of the 16 prescribed-grep hits, **11 are not absence claims at all**: 7 are locations of the *already-corrected* "Intel has no ASID" refutation (errata E19 and its restatements), and 4 are false positives (`01:264` "has no current relevance", `05:351` "the failure mode that has no handler", `13:143` "has not been loaded", `errata:108` "which Intel has no[t] confirmed publicly"). Only 5 are live absence claims, and 4 of those are in `18-comparison-amd-arm-riscv.md`.

### Verdict counts (31 checked)

| Verdict | Count |
|---|---|
| **WRONG** | **1** |
| UNSUPPORTED | 5 |
| UNSCOPED | 6 |
| CORRECT-AS-WRITTEN | 19 |

### WRONG

**`intel-vt/references/18-comparison-amd-arm-riscv.md:189`**

As written:
> - **Claim.** Both architectures still require the host hypervisor to intercept the guest hypervisor's entry instruction and to build a merged control structure for the innermost guest; **the merging work is the same on both sides, and only the field-access cost differs**; cross-reference `14-nested-virtualization.md`.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][503]` `C:medium` `V:durable`

What I verified, in the chapter's own cited document:

- **AMD APM Vol.2 (24593 rev 3.45) §15.33 is titled "Nested Virtualization"** and opens: *"Hardware support for improved performance of nested virtualization, which is the act of running a hypervisor as a guest under a higher-level hypervisor, is provided through the features described here. **These relieve the top-level hypervisor from performing certain common, high-overhead operations that can occur with nested virtualization.**"* (`amd-spec/txt/APM2-24593-3.45.txt:28521–28522`, p.609)
- §15.33.1 **VMSAVE and VMLOAD Virtualization** — CPUID `Fn8000_000A_EDX[15]`, enabled by VMCB offset `0B8h` bit 1; lets the guest hypervisor execute VMSAVE/VMLOAD without an intercept (`:28534–28539`).
- §15.33.2 **Virtual GIF** — CPUID `Fn8000_000A_EDX[16]`, enabled by VMCB offset `60h` bit 25 (`VGIF_EN`), VGIF loaded on VMRUN from `60h` bit 9; lets the guest hypervisor execute STGI/CLGI without an intercept (`:28540–28543`).
- The APM revision history records these as a deliberate addition: *"Added new section 15.33 Nested Virtualization for coverage of VMSAVE and VMLOAD Virtualization and Virtual GIF."* (`:1033`). §15.33 is present in both the 3.30-historical and 3.45 texts.

Both features reduce **intercept** cost, not field-access cost. The claim's cited anchor is `[AMD APM 2 Ch.15]`, and §15.33 is inside Ch.15 — so the corroborating definition is inside the citation the claim already carries, and the claim draws the opposite conclusion from it. That is the same shape as the AMD-side enlightened-VMCB error.

The word "no" does not appear in this sentence, which is why the prescribed grep does not find it. It is an absence claim phrased as an equivalence.

`grep -rniE "vgif|virtual gif|vmload virtualization|15\.33"` over `intel-vt/references/` returns **nothing** — the whole corpus never mentions either feature. `14-nested-virtualization.md` contains zero occurrences of "AMD".

### UNSUPPORTED

**1. `18-comparison-amd-arm-riscv.md:190`** — *"The software workaround **on the Intel side** when hardware shadowing is unavailable … is a memory-based enlightened structure in place of VMREAD/VMWRITE."* `[no-spec]` `[461]`

The sentence is literally true, but it is the closing claim of a section arguing that AMD gets no help, and reference **[461] is the TLFS itself**, which carries the AMD counterpart. Verified live (`X-Return-Format: html`) at `learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/tlfs/nested-virtualization`: the page's headings are `Enlightened VMCS (Intel)` … and **`Enlighened VMCB fields (AMD)`** [Microsoft's own typo], whose body reads *"…for hypervisor use, as well as an associated clean bit. The reserved bytes are in the control section, **offset 0x3E0-3FF**, of the VMCB. The clean bit is **bit 31**."* Misleading by omission, from inside its own citation.

**2. `18-comparison-amd-arm-riscv.md:185`** — section heading *"## 18.6 Nested virtualization: AMD has no VMCS-shadowing equivalent"*. The negative is scoped correctly to VMCS shadowing, but the heading generalises it to "Nested virtualization", which is the exact title of AMD APM Vol.2 §15.33. A reader routed here by the heading concludes AMD has no nested-virtualization hardware support.

**3. `18-comparison-amd-arm-riscv.md:87`** — *"…**Intel has no single-flag equivalent** and controls these events through pin-based controls and interrupt-window exiting instead."* `[AMD APM 2 Ch.15]` `[SDM 3C §27.6.1]` `C:medium`. The AMD half is verified (APM Vol.2 §15.17 "Global Interrupt Flag, STGI and CLGI Instructions", p.551). The Intel half is an unbounded universal anchored only to §27.6.1, the section describing the *alternative* mechanism — an anchor for the positive half that cannot establish the negative.

**4. `08-vmx-instructions.md:305`** — *"**There is no CPUID leaf that enumerates** EPT, VPID, unrestricted guest, APICv **or any other VMX feature**."* `[SDM 3D App.A]`. "Or any other VMX feature" is unbounded, and App.A is the capability-MSR appendix — it documents the MSRs, it cannot establish the absence of a leaf elsewhere in CPUID space. The immediately preceding claim at `08:304` ("CPUID.01H:ECX bit 5 is the only CPUID indication that VMX operation is supported") is the defensible scoped form of the same point.

**5. `18-comparison-amd-arm-riscv.md:267`** — *"…there is no additional 'root/non-root' axis"* on AArch64. `[ARM DDI 0487]` with no revision and no section. The Arm ARM is not in the corpus; not checkable as cited.

### UNSCOPED (a negative with no document/revision bound)

**1. `12-vtd-faults-bios-siov.md:258`** — *"VT-d has no PCI configuration space, so everything about its topology reaches software through one ACPI table."* Bare prose, **no citation, no revision**, in a chapter where every neighbouring claim carries `[VT-d 5.20 §x]`. The substance is very likely right; the form is the one this class exists to catch.

**2. `18-comparison-amd-arm-riscv.md:277`** — *"ARM has no architectural host-state area and no control structure to activate."* `[ARM DDI 0487]` — document named, no revision, no section.

**3. `18-comparison-amd-arm-riscv.md:278`** — *"…trap-enable bits are spread across EL2 configuration registers rather than collected into one control field."* Same anchor, same gap.

**4. `errata.md:68` (E07)** — *"…early AMD IOMMUs lacked interrupt remapping at all, and pre-Zen 3 IOMMUs did not support AVIC — which is feature absence, not an erratum."* `[611]`, `C:high`. "Early AMD IOMMUs" and "pre-Zen 3 IOMMUs" carry no specification revision and no date. The local AMD IOMMU spec (48882 rev 3.11) documents both interrupt remapping (§2.2.5 "Interrupt Remapping Tables") and Guest Virtual APIC (§2.2.8, §2.7), so the claim is only about unspecified older silicon and cannot be checked as written. The Intel half of E07 (5520/5500 erratum #53) is properly scoped; the AMD parenthetical is not, and it is tagged `C:high`.

**5. `13-tdx.md:553`** — *"**TDXRay has no INTEL-SA advisory number, no CVE and no CVSS score.**"* `[no-spec]` `[254]` `C:high` **`V:durable`**. An absence-of-CVE claim is inherently decaying — a CVE can be assigned tomorrow — but it carries no as-of date and is tagged durable. The same fact at `90-dated-landscape.md:179` is correctly tagged `V:dated` under the file's 2026-09-16 as-of. The two do not contradict each other (90 omits the CVSS clause but asserts nothing different), so this is not STALE; it is an unscoped negative sitting outside the file that SKILL.md reserves for time-sensitive facts.

Related, same pattern, not counted separately: `18-comparison-amd-arm-riscv.md:162` — *"a third [cause of AVIC being unavailable] is **IOMMU-side support for guest APIC delivery being absent on older platforms**"*. Same unbounded "older platforms" as E07, but hedged as one cause among three rather than asserted at `C:high`.

**6. `00-quickref.md:22`** — *"| SIOV spec | 337679-002, **Rev 1.1** (2020-09) | Scalable I/O Virtualization. **No later revision exists.** |"* A flat, undated existence negative in a navigation table. The same fact is properly hedged in the other two places it appears — `core-facts.md:79` ("no later revision **has been published**, so it is stale but current", `C:medium`) and `bibliography.md:35` ("Stale but current — no later revision published"). All three agree; only the quickref form is unbounded.

### CORRECT-AS-WRITTEN (19)

Comparative, checked against the AMD corpus:

| Location | Claim | Verification |
|---|---|---|
| `18:45` | "Intel has no equivalent external host-state area" | AMD side verified: `VM_HSAVE_PA` MSR `C001_0117h`, APM Vol.2 §15.30.4 (`APM2…3.45.txt:28438–28439`) and §15.5.1 (`:25252`). The Intel negative follows directly from the positive the claim cites (`SDM 3C §27.5`: the VMCS *contains* the host-state area). |
| `18:188` | "AMD has no equivalent feature [to VMCS shadowing]" | Narrow claim, structural reason is sound: a VMCB is ordinary memory, so there are no trapping field accesses to accelerate. Nothing in the AMD corpus contradicts the VMCS-shadowing-specific negative. The problem is the surrounding framing (see `:185`, `:189`, `:190`), not this sentence. |
| `18:341` | "'AMD has no VMCS shadowing' is only useful with the reason (§18.6)" | Procedure note, correctly scoped, and it explicitly demands the reason rather than the bare negative. |
| `18:332` | "neither the reverse map table nor the Intel equivalent is reachable on a PC" | Consistent with AMD SEV-SNP being EPYC-only and with `13-tdx.md`'s server-only scope. |
| `06:260`, `18:124`, `18:128`, `core-facts:48`, `core-facts:116`, `bibliography:356`, `errata:159` (E19) | the "Intel has no ASID mechanism" **refutation** | This is a fabricated negative that has already been caught and corrected, in seven places, consistently, with the AMD half anchored to `AMD APM 2 §5.5.1` (PCID: CR4.PCIDE, CR3[11:0], CPUID Fn1 ECX, INVPCID). It is the model the rest of the corpus should follow, and it is why the prescribed grep looks noisier than it is. |

Document-existence negatives, all properly bounded:

| Location | Why it passes |
|---|---|
| `06:34` | *"the string 'shadow paging' does not occur anywhere in **Vol.3C rev 092**"* — a checkable string claim bounded to a named revision. Exemplary form. |
| `06:385`, `00-quickref:30`, `errata` E22 | "no standalone Intel VT-rp specification" — scoped: names exactly where the normative content does live (Vol.3A §5.5.1/§5.5.3/§5.5.5, Vol.3C §27.6.22, §31.2). |
| `00-quickref:30`, `errata` E20 | SDM chapter titles "no longer exist" — bounded to rev 092 and enumerates the replacement Ch.26–35. |
| `14:5` | "SDM Vol.3C (rev 092) has no dedicated nested-virtualization chapter" — bounded to a revision, then lists the sections that do carry the material. |
| `15:154` | "**No specification states this.**" — immediately followed by what Intel's L1TF analysis *does* state. |
| `90:162` / `errata` E14 | "no end-to-end GA date has been announced" — E14 says "as of 2026-09-16" explicitly. |
| `core-facts:79`, `bibliography:35` | SIOV "no later revision published" — hedged and confidence-marked (see UNSCOPED #6 for the quickref variant). |

Intel-internal negatives with an adequate section anchor: `03:18` (`SDM 3C §26.3`), `04:34` (`SDM 3C Ch.33`), `02:280`, `08:32` (`SDM 3C §28.5.7.2`, with the reason given).

Microsoft / TLFS negatives — all four verified live in HTML mode:

| Location | Claim | Live check |
|---|---|---|
| `14-nested-virtualization.md:346` | *"Microsoft's Intel-side prerequisite **heading** reads 'Intel processor with VT-x and EPT technology'"* | **Exact match.** `…/user-guide/enable-nested-virtualization` has `Prerequisites` → `Intel processor with VT-x and EPT technology` → `AMD EPYC / Ryzen processor or later`. This is the positive form of the fact the AMD rebuild got wrong, and the Intel side has it right. |
| `14:348` + the block quote at `14:350` | Microsoft on dynamic memory / runtime memory resize | **Verbatim match** against `…/user-guide/nested-virtualization`. |
| `14:352` | "Neither the nested-virtualization page nor the troubleshooting guide states a migration or save/restore prohibition for an L1 VM" | Confirmed: the page's only stated constraints are the dynamic-memory one and non-Microsoft virtualization apps. |
| `17-windows-platform.md:176` | "**Microsoft gives no mechanism for this**" (WSL2 cross-OS file performance) | Confirmed against `…/windows/wsl/compare-versions`: the page states the exception ("with the exception of performance across OS file systems") and gives no mechanism. The chapter already labels its own explanation as inference and tags it `C:low`. |

### Bonus finding outside the four classes — a citation that does not resolve to its content

`intel-vt/references/bibliography.md:258`

```
[479] Microsoft Learn. Run Hyper-V in a virtual machine with nested virtualization. https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization — T2
```

The **title** is the "Run Hyper-V in a Virtual Machine with Nested Virtualization" page; the **URL** is the "What is Nested Virtualization for Hyper-V?" page, which is already `[311]` at `bibliography.md:131` with the identical URL. The two entries are distinct references pointing at one page.

This matters because `14-nested-virtualization.md:346` rests on the `Prerequisites` heading and cites `[311] [479]` — and neither of those URLs serves a page containing that heading. The heading is on `…/user-guide/**enable-**nested-virtualization`, which appears nowhere in the bibliography. The claim is right; its citation cannot be followed to it.

---

## Class 2 — routing anchors that are entry points rather than owning sections

`intel-vt/SKILL.md` lines 59–78. **20 routing rows, 7 carrying a `§n.m` anchor — all 7 checked.**

`tools/lint.mjs` §8 ("routing integrity", lines 396–411) already verifies that the file exists and that `§sec` exists in it. It does not — and cannot — verify that the named section *owns* what the row promises, which is why the two mismatches below survive a clean lint.

| Verdict | Count |
|---|---|
| Anchor is the chapter's opening section | **1** |
| Anchor is a real section but does not own the row's emphasised promise | **1** |
| Partial: anchor owns the emphasised promise, other promises in the row live elsewhere | 3 |
| Clean | 2 |

### Mismatches

**1. `SKILL.md:75` — anchor is the chapter's entry point**

```
| **Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, "why no VT-x"** | `17-windows-platform.md` §17.1 |
```

`§17.1` ("The fact that explains most Windows VT questions") is the **first section of the chapter**, at line 11, immediately after the front matter. It owns exactly one of the row's six promises — the last one.

- row → anchor says **§17.1** → **Hyper-V** lives in **§17.2**
- row → anchor says **§17.1** → **WHP/WHPX** lives in **§17.3**
- row → anchor says **§17.1** → **WSL2** lives in **§17.4.1**
- row → anchor says **§17.1** → **Sandbox** lives in **§17.4.2**
- row → anchor says **§17.1** → **Kernel DMA Protection** lives in **§17.5**
- row → anchor says **§17.1** → *"why no VT-x"* lives in **§17.1** ✓

This is the AMD pattern exactly. Five of six lookups fall through to `00-quickref.md` §0.3 / §0.2 or to the chapter's own `§17.9.1` symptom table.

**2. `SKILL.md:73` — anchor does not own the emphasised promise**

```
| Transient-execution CVEs (L1TF/MDS/TAA/Spectre) and **mitigation MSRs**, VBS, HVCI, Credential Guard, TXT — not TDX advisories, those are `13` | `15-security.md` §15.5 |
```

`§15.5` is "The CVE → mechanism → mitigation matrix". It names the controls, but the **mitigation MSRs** — the bolded promise — are `§15.4`. `§15.5`'s own opening note says so: *"The matrix names the controls; their **interactions** are in §15.4."*

- row → anchor says **§15.5** → **mitigation MSR addresses and bit definitions** live in **§15.4.1** (`IA32_SPEC_CTRL` 48H, `IA32_PRED_CMD` 49H, `IA32_FLUSH_CMD` 10BH, `IA32_TSX_CTRL` 122H, `IA32_MCU_OPT_CTRL` 123H) and **§15.4.2** (`IA32_ARCH_CAPABILITIES` 10AH)
- row → anchor says **§15.5** → **VBS** lives in **§15.7**
- row → anchor says **§15.5** → **HVCI** lives in **§15.8**
- row → anchor says **§15.5** → **Credential Guard** lives in **§15.9**
- row → anchor says **§15.5** → **TXT** lives in **§15.11**
- row → anchor says **§15.5** → **the CVE family mapping** lives in **§15.5** ✓

Note `00-quickref.md:53` already routes "Driver rejected after enabling memory integrity" → `15-security.md` §15.8 directly, i.e. the quick-reference index is already compensating for this row.

### Partial (anchor correct for the emphasised promise; row's other promises elsewhere)

| Row | Anchor | Emphasised promise | Where the row's other promises live |
|---|---|---|---|
| `SKILL.md:60` `02-vmcs.md` §2.5 | §2.5 "Field encodings" ✓ owns **field encodings** | — | VMCS layout → §2.2/§2.3; execution/exit/entry controls → §2.8/§2.9; shadow VMCS fields → §2.11 |
| `SKILL.md:62` `04-vm-entry.md` §4.9 | §4.9 "The three failure modes — how to tell them apart" ✓ owns **why VM entry failed** (it even opens *"This is the section to read first when a VM entry misbehaves"*) | — | *"how to **fix** a control error"* → **§4.10** item 5 and `08-vmx-instructions.md` §8.6, not §4.9; VM-entry checks → §4.3–§4.5; event injection → §4.8 |
| `SKILL.md:71` `13-tdx.md` §13.7 | §13.7 "TD life cycle and the legal call ordering" ✓ matches the row's "TD lifecycle and legal call order" | — | Every other promise carries its own inline `§` (§13.5, §13.6, §13.8, §13.13, §13.21), so nothing is stranded — but the row's **bolded** item is §13.21 while the row-level anchor is §13.7 |

### Clean

| Row | Anchor | Why it passes |
|---|---|---|
| `SKILL.md:63` `05-vm-exit.md` §5.4 | §5.4 "Exit qualification" | The row names §5.3 and §5.4 inline itself. Only IDT-vectoring (→ §5.6) is unanchored. |
| `SKILL.md:66` `08-vmx-instructions.md` §8.4 | §8.4 "The VM-instruction error number table" | Exactly owns the bolded *"what VM-instruction error N means"*. |

---

## Class 3 — one fact written in two files, corrected in only one

### Part A — `SKILL.md` and the eval header against the corpus

10 facts that `intel-vt/SKILL.md` asserts *about* the corpus, plus 2 the eval header asserts, checked against what the corpus actually contains.

| # | Fact | Locations | Verdict |
|---|---|---|---|
| 1 | normative baseline: SDM rev 092 (2026-06) / VT-d Rev 5.20 (2026-04) / TDX module docs (2026-05/08) | `SKILL.md:18` vs `00-quickref.md` §0.1 table | agree |
| 2 | dated snapshot 2026-09-16 | `SKILL.md:19`, `:107`, `:137` vs `90-dated-landscape.md:7` "As-of date: 2026-09-16" | agree |
| 3 | errata carries 28 entries = 22 settled + 2 later-settled (O3, O6) + 4 open | `SKILL.md:45–47` vs `errata.md` (E01–E22 = 22, O1–O6 = 6; header marks O3/O6 settled, O1/O2/O4/O5 open) | agree |
| 4 | **"Chapters run 300–550 lines each"** | `SKILL.md:31` vs actual | **STALE** — see below |
| 5 | "The newest hard figure is Westmere-era, 2010" | `SKILL.md:136` vs `16-performance.md:77` | agree |
| 6 | no modern public cycle-level VM-exit measurement in this KB | `SKILL.md:134` vs `16:77`, `16:99` | agree |
| 7 | "TDX is server-only. No client Windows PC has it." | `SKILL.md:127` vs `13-tdx.md:9`, `00-quickref.md:118`, `18:331` | agree |
| 8 | time-sensitive facts live only in `90-dated-landscape.md` | `SKILL.md:131–133` vs `13-tdx.md:553` (TDXRay absence-of-CVE tagged `V:durable`) | tension — reported as Class 1 UNSCOPED #5, not a contradiction |
| 9 | `index.json` regenerated from `SKILL.md` | `node tools/build.mjs --check` | agree — "generated files are up to date" |
| 10 | whole-corpus lint | `node tools/lint.mjs` | clean — 22 chapter files, 318 bibliography entries, 2648 distinct claims |
| 11 | eval header question counts 80 = 24 lookup + 24 mechanism + 20 diagnosis + 12 trap | `eval/intel-vt/questions.yaml:3–7` vs actual | agree exactly |
| 12 | **eval header: "trap 12 (one per confirmed erratum - all must be present)"** | `questions.yaml:7` vs `errata.md` | **STALE** — see below |

#### STALE 1 — `intel-vt/SKILL.md:31`

> Chapters run 300–550 lines each; the routing table below resolves to a section.

Actual line counts contradict both ends of the range:

- `13-tdx.md` — **567 lines**, above the stated 550
- `90-dated-landscape.md` — **179 lines**, well below the stated 300 (it is a routing-table destination, `SKILL.md:77`)

The rest do fall in range (`09-smm-seam.md` 312 … `10-vtd-dma-remapping.md` 540). The statement is a reader's budgeting hint, so the cost is low, but it is a fact stated in one file that the files it describes disagree with, and nothing validates it.

#### STALE 2 — `eval/intel-vt/questions.yaml:7`

> `#   trap       12  (one per confirmed erratum - all must be present)`

`errata.md` carries **22 settled corrections** (E01–E22). The 12 trap questions reference only **11** of them — E01, E02, E03, E04, E16, E17, E18, E19, E20, E21, E22 — and the twelfth (`trap-tdxray-advisory`, `questions.yaml:1141`) maps to no errata entry at all; it tests the INTEL-SA-01271 mislabel recorded at `13-tdx.md:554`, which never became an E-number.

Eleven settled errata have **no trap question**: **E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15.**

So "one per confirmed erratum — all must be present" is false in both directions. This is the classic shape: errata.md grew past 12 settled entries and the eval header still describes the original 12-for-12 mapping.

#### Also noted

`00-quickref.md:82` repeats the Class 2 routing mismatch rather than compensating for it:

```
| CVE → mechanism → mitigation MSR/bit | `15-security.md` §15.5 |
```

`§15.4` — the section that actually defines the mitigation MSR **addresses** — is pointed to from **nowhere**: not `SKILL.md`, not `00-quickref.md`, not `core-facts.md`. On the AMD side the quick-reference index rescued 10 of 24 failed lookups; here the fallback carries the same error as the routing table, so a "which MSR, at what address" question has no working route.

`bibliography.md:258` `[479]` and `bibliography.md:131` `[311]` are two distinct references carrying the **identical URL** with different titles — detailed under Class 1 → *Bonus finding*.

### Part B — corpus-internal duplication (chapters ↔ errata ↔ core-facts ↔ quickref ↔ bibliography)

**Denominator:** ~220 duplicated facts compared across 13 categories · **28 errata entries** (E01–E22, O1–O6) read in full · **83 errata cross-references** resolved (38 numbered `E<NN>`/`O<N>` citations from non-errata files, 17 unnumbered `errata.md` pointers, 28 owner-chapter pointers inside errata.md) · **197 cross-file `file.md §N.N` pointers** resolved.

**Result: 3 disagreements (one with two sub-parts), plus 4 cross-reference defects and 2 intra-file contradictions.** Every finding below I re-read on both sides myself.

#### STALE 3 — the 6% VBS/HVCI figure: `errata.md` O4 was never updated when the chapters found the primary source

This is the chapter-vs-errata failure mode, and it is the same entry twice.

| Location | Value |
|---|---|
| `intel-vt/references/errata.md:226` (O4) | *"a ComputerBase measurement relayed as an approximately 6% average gaming frame-rate drop with HVCI on … **None of the relayed sources states workload, hardware, driver set** or whether nested paging and large pages were in play"* `C:low` |
| `intel-vt/references/16-performance.md:142` | *"The 6% figure **does have a primary source, found later than this section was written**: **ComputerBase's own testing on a Ryzen 7 5800X with a Radeon RX 7900 XTX**, reporting ~6% on frame rate and **~8% on frame times**"* |
| `intel-vt/references/15-security.md:389` (table row) | *"6% on frame rate, 8% on frame times \| memory integrity (HVCI) on vs off \| **ComputerBase's own testing on a Ryzen 7 5800X with a Radeon RX 7900 XTX**; per-title spread large"* |

errata O4 asserts the conditions are unknown; two chapters state them. errata O4 also omits the 8%-frame-times half of the figure entirely. Because SKILL.md:47 tells the reader *"Where it disagrees with a familiar statement, it wins"*, the stale side is the one with priority.

**STALE 3b — same entry, second stale claim.** `errata.md:226`: *"a **5–25%** gaming range **attributed to Tom's Hardware testing**"* versus `16-performance.md:143` and `15-security.md:393`: *"The '5–10%' and '5–25%' figures, by contrast, have **no traceable primary source** in this knowledge base."* One side names a source; the other says there is none.

#### STALE 4 — the Intel 5520/5500 interrupt-remapping erratum: one erratum or two?

| Location | Value |
|---|---|
| `intel-vt/references/errata.md:68` (E07) | *"the 5520/5500 chipsets' **erratum #53**"* — singular, `C:high` |
| `intel-vt/references/core-facts.md:74` | *"Intel's own 5520/5500 chipset **erratum #53**"* — singular, `C:high` |
| `intel-vt/references/12-vtd-faults-bios-siov.md:415` | *"These are Intel's errata … and **there are two of them, #47 and #53**."* |
| `intel-vt/references/12-vtd-faults-bios-siov.md:417` | names both in full: **#47** *"Receiving two identical interrupt requests in back to back cycles may corrupt attributes of remapped interrupt…"* **and #53** *"In-flight remap-able interrupts not drained on interrupt invalidation command"* |
| `intel-vt/references/bibliography.md:99` | *"(errata **#47 and #53**, interrupt-remapping unit reliability)"* |

The owning chapter — which `errata.md:69` itself names as owner (`12-vtd-faults-bios-siov.md` §12.8) — and the bibliography say two; errata and core-facts say one. Chapter 12 explicitly frames the plural as a correction of a prior singular framing, so the correction landed in the chapter and the bibliography and was never carried back to `errata.md` or `core-facts.md`.

#### STALE 5 — date of the Intel 5520/5500 Chipset Specification Update

| Location | Value | Confidence |
|---|---|---|
| `intel-vt/references/12-vtd-faults-bios-siov.md:417` | *"Document Number 321329-015US, **February 2015**"* | asserted at `C:high` |
| `intel-vt/references/bibliography.md:99` | *"Specification update issued **2011-09**"* | `C:low`, *"document metadata not verified against the Intel PDF"* |

Only one side is hedged, and the unhedged side is the one with no verification note.

#### Intra-file contradictions (same fact, two places in one file)

1. **`17-windows-platform.md:248` vs `:302`** — §17.8.1 was corrected, the §17.9 feature-map table was not.
   - `:248` — *"The vendor module **no longer issues VMXON itself** — its `vmx_enable_virtualization_cpu()` hook calls the kernel's shared x86 virtualization layer, which executes the instruction."*
   - `:302` — table row *"VMX root entry (`01`) … KVM (contrast): **the vendor module executes VMXON**"*
2. **`16-performance.md:142` vs `:141` and `:313`** — §16.3.2 line 142 records that the 6% primary source was found; line 141 still carries the pre-correction wording, and §16.11 item 4 at `:313` still says *"the page this chapter cited for the 6% figure does not contain it, so the relay chain is shorter than it looked."* Line 142 is explicitly labelled the later finding, so the other two are the stale side.

#### Cross-reference defects (pointer resolves, but to the wrong place — invisible to the linter)

| Location | Defect |
|---|---|
| `06-address-translation.md:465` | Says the HLAT pointer `0x2040` and prefix-size `0x0006` are owned by `02-vmcs.md` **§2.5.2 and §2.5.4**. `0x0006` is in §2.5.2 (`02-vmcs.md:138`) ✓, but `0x2040` is in **§2.5.3** "B.2 — 64-bit fields" (`02-vmcs.md:151`). §2.5.4 is "B.3 — 32-bit fields" and holds no 64-bit encoding. Both sections exist, so the Class 4 check passes — the pointer simply aims at the wrong table. |
| `errata.md:235` (O5) | Names `16-performance.md` as owner of the H100+TDX result set (TTFT +21.8%/+27.8%, throughput −17.7%/−21.1%). `16-performance.md` has **zero** occurrences of "H100". The owner is dangling; only errata carries the fact. |
| `errata.md:211` (O2) | Names `10-vtd-dma-remapping.md` as owner of the VT-d Rev 1.0 date question. That file contains no "2006" and no "Rev 1.0" statement. Dangling owner. |
| `18-comparison-amd-arm-riscv.md:161` | Routes the AVIC default-on transition's "dates and kernel versions" to `90-dated-landscape.md`, which has **zero** occurrences of "AVIC" or "1235". The 2025-06 proposal date lives only in `errata.md:76`. |

#### Clean

All of the following were compared on both sides and **agree everywhere**: 21 distinct VMCS field encodings across ~35 restatements in 05/06/07/core-facts · the 480H–493H capability-MSR block plus 3AH, 1400H/1401H, FEH, 982H, 87H across 01/02/08/09/13/14 · 19 basic exit-reason restatements · VM-instruction error numbers 1–28 · `IA32_VMX_BASIC` bit fields (01 §1.6 vs 08 §8.6.2) · VT-d fault reason codes and the 20h–2Bh range · ~8 VT-d register bit layouts · ~35 document-metadata facts (SDM rev 092 and all order numbers, VT-d Rev 5.20 / D51397-019 / April 2026 plus the stale-landing-page pair, SIOV Rev 1.1, all five TDX order numbers) except STALE 5 · the E20 SDM Ch.26–35 mapping against every chapter's "Maps to:" line · 20 shared SDM section anchors · 21 attribution facts (every MDS CVE↔name, INTEL-SA-00233/-00161/-00598/-00702/-00828, VENOM, MBEC=Kaby Lake, PML=Broadwell Xeon 2015, OoH=SC'22, VMFUNC and FlexPriority correctly left disputed in all four places each) · ~28 duplicated measurement figures (24-not-20 memory references, 2409/937/3900/1016/26%/15826, 48%/600%, 34%, the OoH 14%/0.5% vs 13×/6×/16× split) · ~15 dated facts duplicated errata↔90 (AWS 2026-02, Azure 2023-11-15/2023-12-07/2026-02-26, TDX Connect 2025-02-24, Shenlong/Nitro, all four vendor overhead quotes, TDX AES 128/256 per generation) · **errata internal integrity: all 38 numbered `E<NN>`/`O<N>` citations resolve to an existing entry and that entry is about the topic the citing text claims — no citation to a non-existent E-number anywhere in the corpus.**

### Part C — `eval/intel-vt/questions.yaml` keys against their own chapters

**Denominator: 80 / 80 questions · 446 `must_include` items · 29 `must_not_include` items · 80 `required_citation` strings.** Every `chapter:` file exists; no duplicate ids.

Only **3 of 80** questions carry an "UPDATED / CORRECTED / fixed" marker (`hlat-pointer-encoding` L44, `apicv-interrupts-lost-when-descheduled` L819, `trap-mbec-generation` L1052) — and **all nine disagreements below fall in the 77 unmarked questions.** That is the predicted pattern: the chapter was corrected, the key was not.

#### STALE key items — 9 across 8 questions

| # | Question / yaml line | Key says | Chapter says | Chapter line |
|---|---|---|---|---|
| 1 | `entry-failure-34-msr-load` · **`eval/intel-vt/questions.yaml:787`** | an entry fails if the index is "…**IA32_BIOS_UPDT_TRIG (00000079H)**…" | *"**Rev 092 does not list 00000079H (IA32_BIOS_UPDT_TRIG) among the excluded indices.**"* | `04-vm-entry.md:296` |
| 2 | `vpid-ept-tagging` · **`questions.yaml:533`** | "guest-physical mappings tagged with the current **EP4TA**" | "guest-physical mappings with the current **EPTRTA**" | `06-address-translation.md:257` |
| 3 | `vpid-ept-tagging` · **`questions.yaml:535`** | "combined mappings … carry an **EP4TA** as well" | "…tagged with an **EPTRTA** as well" | `06-address-translation.md:278` |
| 4 | `pir-virr-merge-and-on-sn-race` · **`questions.yaml:378`–`:379`** | "the processor **clears ON first**", then acknowledges the local APIC | pseudocode: step 1 acknowledge the local APIC, step 3 `ON <- 0`; and in prose: *"it is cleared **after** the local-APIC acknowledge at step 1, not before it. **A rendering that clears ON first has the correctness property right and the step order wrong.**"* | `07-apic-virtualization.md:398,401,412` |
| 5 | `ipi-virtualization-pid-table` · **`questions.yaml:565`** | "only physical-addressing, **flat-mode**, unicast IPIs are covered" | *"(An earlier wording here said "**flat-mode**", which is **wrong**: flat mode is a *logical* addressing form and is not accelerated.)"* | `07-apic-virtualization.md:445` |
| 6 | `enlightened-vmcs` · **`questions.yaml:619`** | "the VP assist page **carries** the enlightened VMCS" | *"The VP assist page **does not hold** the enlightened VMCS; it holds the controls that select one … each enlightened VMCS is a separate 4-KB page in guest memory"* | `17-windows-platform.md:65` (restated `:84`) |
| 7 | `hypervisor-works-linux-not-windows11` · **`questions.yaml:909`** | "on Linux **the vendor module executes VMXON itself**" | *"The vendor module **no longer issues VMXON itself**"* | `17-windows-platform.md:248` |
| 8 | `vbs-overhead-figure` · **`questions.yaml:925`** | the 6% figure reached the KB "**only through secondary reporting**" and the "processor, titles and settings **were not read**" | *"The 6% figure **does have a primary source** … ComputerBase's own testing on a Ryzen 7 5800X with a Radeon RX 7900 XTX"* | `16-performance.md:142` (corroborated `15-security.md:389`) |
| 9 | `vtd-queued-invalidation` · **`questions.yaml:444`** | IOTLB descriptor completes only after all **context-cache** descriptors ahead of it | *"**One rule covers both IOTLB forms** … only after all context-cache **and PASID-cache** invalidation descriptors ahead of it … are completed."* | `10-vtd-dma-remapping.md:484` |

Notes on severity: #1, #5 and #6 are cases where the chapter carries an **explicit inline retraction of the key's exact wording** — the strongest form of the failure. #2/#3 are decisive because `08-vmx-instructions.md:206` states that *"the older name EP4TA occurs zero times in Vol.3C and Vol.3D rev 092 and should not be used"*, and I confirmed `EP4TA` appears in the entire repository exactly three times: once in that refutation and twice in the eval key. #7 and #8 leave the conclusion intact and only the mechanism/provenance stale. #9 is the mildest — the key is short a term rather than wrong.

#### Borderline — same numbers, different assertion (reported, not counted above)

- `vtl-isolation-slat` `questions.yaml:634`: key says "**Microsoft implements** up to 16 trust levels architecturally"; `15-security.md:303` says *"the **TLFS states that** up to 16 VTLs **are supported** architecturally, that a hypervisor **may implement fewer**, and that only two are currently implemented."* Identical count, different assertion.
- `ve-conversion-and-busy-field` `questions.yaml:549`: key says "**all three** conditions must hold"; `06-address-translation.md:407` says *"two prerequisites and then **six** conditions … only if **all six** of these hold."* The three the key names are present and identical in value; the count is not.

#### Stale `notes:` fields — same failure class, ungraded side (5)

| yaml line | Note says | Chapter says |
|---|---|---|
| `questions.yaml:183` `pid-pointer-table-encoding` | "Chapter 07 §7.12 and chapter 02 §2.5.6 **both record the omission**. Inventing an encoding scores zero." | `07-apic-virtualization.md:512` — those encodings *"were **resolved** … and have been **moved into the body**"*; `02-vmcs.md:185` — they *"**are now stated** in §2.5.2–§2.5.5"*. The `must_include` items (0x2042, 0x0008) are correct, so **a grader following the note would penalise the answer the key demands.** This is the un-updated sibling of `hlat-pointer-encoding`, which *was* updated 2026-09-21. |
| `questions.yaml:1166` `trap-vtd-current-revision` | "**Rev 5.20** also renames first-level/second-level to first-stage/second-stage" | `10-vtd-dma-remapping.md:17–19` — that rename *"**is older than this revision** — the Revision History dates it to **Rev 3.4, December 2021**."* |
| `questions.yaml:1106` `trap-ooh-venue` | calls errata O6 "the separate **unresolved** conflict" | `14-nested-virtualization.md:392` — *"**Resolved** (see `errata.md` O6)"*, *"The two figure sets are **not in conflict**."* |
| `questions.yaml:462` `hvci-uses-ept` | "Microsoft names MBEC, AMD GMET **and ARM TTS2UXN**" | `15-security.md:323` names only MBEC and GMET; "TTS2UXN" and "ARM" appear nowhere in chapter 15. |
| `questions.yaml:226` `invvpid-types` | "Type 2 **ignores the descriptor**" | `08-vmx-instructions.md:211` — *"the descriptor is **not** ignored — the check `IF INVVPID_DESC[63:16] != 0 THEN VMfail` precedes the type dispatch."* |

#### `required_citation` — 16 of 80 are not verbatim in the named chapter

`questions.yaml:10` states the invariant: *"Every required_citation is an anchor that appears verbatim in that chapter."* It holds for 64/80.

**Present but not a substring, blocked by markdown or compounding (3):** `questions.yaml:338` `TDX-ABI §5.4.81 or §5.4.24 or §5.5.3` (all three present individually at `13-tdx.md:168, :183, :216`; only the compound form fails) · `:597` `errata.md O6` (chapter has `` `errata.md` O6 `` with a backtick between the tokens) · `:1063` `errata.md E01` (chapter has `` `errata.md` **E01** ``).

**Genuinely absent (13):** `:636`, `:680`, `:692`, `:803`, `:901`, `:932`, `:959`, `:971`, `:984`, `:1031`, `:1105`, `:1121`, `:1165`. The clearest are `:803` (`SDM 3C Ch.26` — zero occurrences in `01-vmx-intro.md`, which uses `§26.3`/`§26.7`/`§26.8`), `:932` (`SDM 3C §31.3.2` — zero occurrences in `16-performance.md`), `:1105` (`errata.md E04` — "E04" has zero occurrences in `14-nested-virtualization.md`), `:1121` (`SDM 3C Ch.26` — `00-quickref.md` carries no backticked SDM anchors at all), `:1165` (`VT-d 5.20 Ch.1` — zero occurrences in `10-vtd-dma-remapping.md`), and `:959`/`:971`/`:984`, which are the literal instruction string `Microsoft Learn or the measurement source, with page or section` — an instruction, not a citation.

Six of the thirteen carry an inline `# was <SDM anchor>` comment: deliberate re-anchorings that traded a verbatim-in-chapter string for a more accurate bibliography-style one and broke the header invariant in passing. The other seven have no comment and look unintentional.

#### Two questions name the wrong chapter

- `trap-sdm-vmx-chapter-numbers` names `00-quickref.md`, but that file states *"**Owns:** nothing"* and *"No values are reproduced here."* Its `must_include` L1114 (the ten chapter-number→title pairs) and the "outside 26–35" half of L1117 exist only in `errata.md:172`, which is also the only place carrying the `[SDM 3C Ch.26]` anchor the key requires.
- `trap-vtd-current-revision` names `10-vtd-dma-remapping.md`, which gives only "a 2023 date" (`:16`). The exact tokens the key demands — `2023-03-22`, "checked on `2026-09-20`" — and the `[VT-d 5.20 Ch.1]` anchor live in `errata.md:180`.

Same shape, milder: `vmfunc-generation`'s specifics live in `errata.md:60` not chapter 06; `flexpriority-generation`'s T7700 evidence and "hardware 2006, brand 2008" reconciliation live in `errata.md:202` not chapter 07.

#### Other NOT-STATED `must_include` items (chapter silent, no conflicting value)

`default1-controls-and-true-msrs` L507/L508 (in chapter 04, not 02) · `vm-entry-check-order` L367 "stage 6" (chapter 04 labels 1, 2a, 2b, 3, 4, 5, 7 — no "Stage 6") · `vmresume-error-5-after-migration` L730 · `trap-intel-asid` L1042 "AMD's 32-bit ASID" (chapter 18, not 06) · `trap-mbec-generation` L1057/L1060 (the "Kaby Lake, not Skylake" fix at `06:112` is real; "7th-generation"/"2016 to 2017"/"GMET … Zen 2" are not in chapter 06) · `irta-reg-size-field` L293 "S = 7" (derivable, never written) · `tdx-aes-key-strength` L701 · `wsl2-overhead-figure` L970 (chapter 17:175, not 16) · `virtual-interrupt-delivery` L469 omits the chapter's co-required "interrupt-window exiting = 0".

#### Clean

All **29 `must_not_include`** items: zero literal occurrences corpus-wide; every surfacing is an explicit refutation. Every VMCS field encoding in the key (0x201A, 0x2034, 0x2040, 0x0006, 0x2042, 0x0008, 200EH, 0812H, 202AH, 2012H/2014H/2016H/201CH–2022H/401CH/0810H/0002H) · all 15 VMX capability-MSR name→address pairings 480H–493H · all basic exit reason numbers · all VM-instruction error numbers · every exit-qualification bit layout including both polarity traps and the two EPT-qualification traps · the 0x201A worked example and reconstruction formula · EPTP low bits · EPT misconfiguration memory types · PML · #VE · the 24-access walk decomposition · VT-rp section numbers · IA32_FEATURE_CONTROL bits · virtual-APIC page offsets · posted-interrupt descriptor bit ranges · all VT-d register offsets, the IRO/FRO ×16 rule, all 11 invalidation descriptor types, the 14-field IRTE layout, the Fault Recording Register layout · all TDX leaf numbers and RAX field splits, GPAW, completion-status class bits, state machines, the 5-step TLB-tracking protocol · every TDXRay identifier and date · VMCS shadowing · all eight vmcs02 union/intersection rules · all four MDS CVE→variant mappings · L1TF MSRs and bits · every cycle figure.

Both previously-updated questions were confirmed correctly fixed on **both** sides: `hlat-pointer-encoding` and `apicv-interrupts-lost-when-descheduled`.

### Class 3 totals

| Part | Compared | Disagreements |
|---|---|---|
| A — SKILL.md / eval header vs corpus | 12 facts | **2 STALE** |
| B — corpus-internal | ~220 duplicated facts, 28 errata entries, 83 errata cross-refs, 197 section pointers | **3 STALE (one with 2 sub-parts) + 2 intra-file contradictions + 4 dangling/mis-aimed cross-references** |
| C — eval keys vs chapters | 80 questions, 446 `must_include`, 29 `must_not_include`, 80 `required_citation` | **9 STALE key items across 8 questions**, 2 borderline, 5 stale `notes:`, 16 non-verbatim `required_citation`, 2 wrong-chapter |

---

## Class 4 — navigational pointers that do not resolve

Checked every `` `NN-file.md` §X `` pointer in `00-quickref.md` and `core-facts.md`, resolving each against the `^#{1,6} <n.m…>` headings of the target file.

| Metric | Count |
|---|---|
| Pointer→section pairs checked | **68** (55 in `00-quickref.md`, 13 in `core-facts.md`) |
| Target file missing | **0** |
| Target section missing | **0** |
| Distinct files referenced by name in the two index files | 16 in `00-quickref.md`, 21 in `core-facts.md` — **all exist** |

**This class comes back completely clean.** Every pointer resolves, including the multi-section forms (`§4.3–§4.5`, `§13.5, §13.6`, `§7.6, §7.8`) and the one three-level anchor (`18-comparison-amd-arm-riscv.md` §18.3.2).

Cross-check on the extraction: the two files contain 57 and 44 section sigils respectively. Every sigil not paired with a corpus filename was verified to be an **Intel** section reference (`§27.3`, `§27.9.1`, `§30.2.1`, `§5.5.x`, …), correctly excluded — no intra-corpus pointer was missed by the pattern.

The premise holds: `tools/lint.mjs` validates only `SKILL.md`'s routing table (lines 396–411) and never reads `00-quickref.md` or `core-facts.md` pointers. They are unguarded — they are simply also correct.

---
