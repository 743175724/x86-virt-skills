# Closing the 36 UNVERIFIABLE claims — APM Vol.2/Vol.3 and the Revision Guides, read locally

**Pass date:** 2026-09-21. **Verifier:** independent agent; did not author these chapters and did
not write the previous report.
**Predecessor:** `.scratch/amd-virt-refine/verify/ch15-90.md`. That pass could not retrieve APM
Vol.2 (`docs.amd.com` serves a 2.5 KB JS shell) and therefore marked 36 items UNVERIFIABLE.
**No chapter file was modified.** This report is the only file written.

## Corpus actually read in this pass

`C:/Users/Administrator/AppData/Local/Temp/amd-spec/pdf/` — read page-by-page with PyMuPDF
(not `pdftotext`), so table cells were recovered from glyph coordinates rather than from a
linearised text stream. Where a value came out of a table (Table 15-7's Priority column,
Table 15-10, Table B-1, Table C-1, the Revision Guide erratum pages) the page was re-rendered and
the row reconstructed by y-coordinate before the value was accepted.

| Document | Revision / date on cover | Used for |
|---|---|---|
| `APM2-24593-3.45.pdf` | Rev 3.45, July 2026 | ch15 §15.1–§15.4; ch17 §17.3, §17.5, §17.6, §17.7; ch19 |
| `APM3-24594-3.38.pdf` | Rev 3.38, July 2026 | `VMRUN` and `SKINIT` pseudocode; App.E CPUID |
| `RevGuide-57095-19h-10h-1Fh.pdf` | Rev 1.05, November 2025 | ch17 §17.7.2, §17.7.3, §17.8 |
| `RevGuide-58251-1Ah-00h-0Fh.pdf` | Rev 1.30, July 2025 | ch17 erratum 1579, §17.8 |
| `IOMMU-48882-3.11.pdf` | Rev 3.11 | ch19 L273 negative claim |

**Page-number convention used below.** `pdfp N` is the PDF page index. APM Vol.2 Rev 3.45 runs
**printed = pdfp − 63**; APM Vol.3 Rev 3.38 runs **printed = pdfp − 42**. Both Revision Guides have
**printed = pdfp** (no offset). Per the brief, a printed/index divergence is not reported as an
error; every anchor below is judged on the *section*, never on a page index.

---

## Denominator and tally

The predecessor's 36 UNVERIFIABLE items were:

| Group | Chapter | Count | In scope here? |
|---|---|---|---|
| H7 — §15.1–§15.4 APM-anchored claims | `15-nested-virtualization.md` | 6 | **yes** |
| 17-E — §17.3, §17.5, §17.6, §17.7 | `17-security.md` | 18 | **yes** |
| I5 — 48 APM anchors + SDM/ARM/RISC-V | `19-comparison-intel-arm-riscv.md` | 7 | **yes** (APM half) |
| G12 — ASPLOS'08 `[56]` figures | `18-performance.md` | 5 | **no** — not an AMD document, not in the local corpus |
| **Total** | | **36** | **31 groups in scope** |

Those 31 groups expand to individual claim lines. **I checked 144 individual claims.**

| Chapter | Checked | WRONG | UNSUPPORTED | IMPRECISE | CORRECT-AS-WRITTEN | still unverifiable |
|---|---|---|---|---|---|---|
| `15-nested-virtualization.md` | 38 | 0 | 0 | 2 | 35 | 1 |
| `17-security.md` | 58 | 0 | **1** | 6 | 51 | 0 |
| `19-comparison-intel-arm-riscv.md` | 48 | 0 | **1** | 1 | 46 | 0 (APM half) |
| **Total** | **144** | **0** | **2** | **9** | **132** | **1** |

**There are no WRONG findings.** Every value quoted from the APM or a Revision Guide in the
in-scope sections is right. The defects found are two unsupported anchors/inferences and nine
anchor-or-quotation imprecisions.

**All 31 in-scope UNVERIFIABLE groups are now closed.** One residual item and the five out-of-scope
ch18 items are listed under "Still unverifiable" at the end.

---

## 1. `15-nested-virtualization.md` — 38 claims, 0 WRONG, 2 IMPRECISE, 35 CORRECT, 1 residual

### 1.1 The claim the previous pass singled out — Table 15-7, and the table-mangling trap

**L21.** "AMD makes this explicit as an implementation requirement: 'Checks exceptions (#GP) before
the intercept. The current implementation requires that the VMRUN intercept always be set in the
VMCB.' — Table 15-7, the `VMRUN` row" · `[APM2 §15.9]` `[APM2 Table 15-7]`

This is exactly the kind of cell the brief warns about, so the row was reconstructed from glyph
coordinates on **pdfp 599** (printed 536) rather than trusted to a text dump:

```
y=404.2 | INVLPGA | INVLPGA | Checks all exceptions (#GP) before the intercept.
y=420.2 |                    Checks exceptions (#GP) before the intercept.
y=431.2 | VMRUN   | VMRUN
y=434.8 |                    The current implementation requires that the VMRUN
y=443.8 |                    intercept always be set in the VMCB.
y=458.2 | VMLOAD  | VMLOAD | Checks exceptions (#GP) before the intercept.
```

The two sentences sit in the Priority column of the `VMRUN` row, between the `INVLPGA` and `VMLOAD`
rows. **No row shift.** Table 15-7 begins under the heading `15.9 Instruction Intercepts`
(pdfp 597, printed 534: "Table 15-7 specifies the instructions that check a given intercept…").

**Verdict: CORRECT-AS-WRITTEN.** Value and anchor both confirmed.

*Side effect worth recording:* this also independently confirms the predecessor's **ch19 I1**
verdict. `[APM2 §15.9]` really is the instruction-intercept section, so the same anchor attached in
`19-comparison-intel-arm-riscv.md` L181 to a page-walk cost derivation cannot be supported. See §3.1.

### 1.2 Everything else in §15.1–§15.4 — verbatim confirmations

| Line | Claim (abbreviated) | APM Vol.2/3 Rev 3.45/3.38 | Verdict |
|---|---|---|---|
| L25 | `VMEXIT_VMRUN` 80h … `VMEXIT_SKINIT` 86h · `[App.C]` | Table C-1, pdfp 848: "80h VMEXIT_VMRUN … 81h VMEXIT_VMMCALL … 82h VMEXIT_VMLOAD … 83h VMEXIT_VMSAVE … 84h VMEXIT_STGI … 85h VMEXIT_CLGI … 86h VMEXIT_SKINIT". Appendix C = "SVM Intercept Exit Codes", pdfp 847 | CORRECT |
| L27 | pseudocode order: CPL and address checks, then `IF (intercepted(VMRUN)) #VMEXIT (VMRUN)` · `[APM3 §4 "VMRUN"]` | APM3 pdfp 545: "IF (CPL != 0) EXCEPTION [#GP] / IF (rAX contains an unsupported physical address) EXCEPTION [#GP] / IF (intercepted(VMRUN)) #VMEXIT (VMRUN)". `VMRUN` is in **Chapter 4 System Instruction Reference** (starts pdfp 419) | CORRECT |
| L35 | §15.33's stated purpose · `[§15.25]` `[§15.33]` | pdfp 672 verbatim: "Hardware support for improved performance of nested virtualization, which is the act of running a hypervisor as a guest under a higher-level hypervisor, is provided through the features described here. These relieve the top-level hypervisor from performing certain common, high-overhead operations that can occur with nested virtualization." | CORRECT |
| L39 | §15.33 has **exactly two** subsections; the revision history records it as an addition for those two | Bookmark tree: only 15.33.1 and 15.33.2; pdfp 673 shows 15.33.1, 15.33.2, then 15.34. Revision History: "**June 2015 · 3.25 · Added new section 15.33 Nested Virtualization for coverage of VMSAVE and VMLOAD Virtualization and Virtual GIF.**" | CORRECT — the negative half ("any 'AMD VMCB shadowing' attributed to this section is an invention") holds |
| L66 | `#VMEXIT` writes back "the same subset of processor state as is loaded by the VMRUN instruction" | pdfp 591, §15.6, verbatim | CORRECT |
| L68 | `#VMEXIT` clears intercepts, resets ASID to 0, clears GIF, clears `V_IRQ`/`V_INTR_MASKING` | pdfp 591 §15.6: "Disables interrupts by clearing the GIF… • Clears all intercepts. • Resets the current ASID register to zero (host ASID). • Clears the V_IRQ and V_INTR_MASKING bits inside the processor." | CORRECT — all four, in one list |
| L72 | `VM_HSAVE_PA` C001_0117h, 4-Kbyte block, #GP on low-12-bits-nonzero or ≥ max phys addr · `[§15.30.4]` | pdfp 670 §15.30.4: "holds the physical address of a 4KB block of memory where VMRUN saves host state, and from which #VMEXIT reloads host state… Writing this MSR causes a #GP if: • any of the low 12 bits of the address written are nonzero, or • the address written is greater than or equal to the maximum supported physical address" | CORRECT |
| L74 | "software must not rely on the format or contents of the host state save area, nor attempt to change host state by modifying the contents of the host save area" · `[§15.5.1]` | pdfp 586, **inside §15.5.1 Basic Operation** (§15.5.2 starts pdfp 590), verbatim | CORRECT |
| L80 | IOPM = 12-Kbyte map, "two 4-Kbyte pages plus the first three bits of a third", "accessed by physical address"; MSRPM = four 16-Kbit vectors in two contiguous pages · `[§15.10.1]` `[§15.11]` | pdfp 600 §15.10.1: "occupies 12 Kbytes of contiguous physical memory… a linear array of 64K+3 bits (two 4-Kbyte pages, and the first three bits of a third 4-Kbyte page)… The IOPM is accessed by physical address". pdfp 602 §15.11: "four separate bit vectors of 16 Kbits (2 Kbytes) each… must be packed together and located in two contiguous physical pages" | CORRECT |
| L82 | out-of-range map → `#VMEXIT(VMEXIT_INVALID)` | pdfp 600 and pdfp 602, both: "this is treated as illegal VMCB state and causes a #VMEXIT(VMEXIT_INVALID)" | CORRECT |
| L88 | "must clear specific bits in the VMCB Clean field every time it explicitly modifies the associated guest state in the VMCB" · `[§15.15.1]` `[§15.15.2]` | pdfp 610, first sentence of **§15.15.2**, verbatim. Chapter cites both, so covered | CORRECT |
| L90 | "the clean bits are a hint, since any given processor implementation may ignore bits that are set to 1 on any given VMRUN" / "clean bits that are set to zero are always honored" · `[§15.15.1]` | pdfp 610, **both inside §15.15.1** (the §15.15.2 heading follows them). Anchor checked specifically because three subsections start on this page | CORRECT — anchor is precisely right |
| L92 | the not-cached list, "explicitly not cached and not represented by Clean bits" · `[§15.15.2]` | pdfp 612: "The following are explicitly not cached and not represented by Clean bits: • TLB_Control • Interrupt shadow • VMCB status fields (Exitcode, EXITINFO1, EXITINFO2, EXITINTINFO, Decode Assist, etc.) • Event injection • RFLAGS, RIP, RSP, RAX" — chapter's seven items match one-for-one, end of §15.15.2 | CORRECT |
| L94 | "the SVM architecture uses the physical address of the VMCB as a unique identifier…" / "the ASID is not a unique identifier for a guest virtual CPU"; clear the whole field on first run / different core / different physical page · `[§15.15]` `[§15.15.2]` | pdfp 610: both quotes in the **§15.15 intro** (before the §15.15.1 heading) ✓; the three circumstances are the §15.15.2 bullet list ✓. (AMD writes "clear the entire VMCB field"; the chapter's "clean field" is the correct reading) | CORRECT |
| L98 | `EXITINFO1`/`EXITINFO2` "undefined for intercepts that do not define them" · `[§15.6]` | pdfp 591 §15.6: "the contents of the EXITINFO1 and EXITINFO2 fields are undefined for intercepts where their use is not indicated" | CORRECT |
| L116 | intercepts are per-VMCB control bits; `#VMEXIT` clears them all · `[§15.7]` `[§15.6]` | pdfp 592 §15.7 opening + pdfp 591 §15.6 | CORRECT |
| L138 | GIF cleared automatically so the switch is atomic; all intercepts cleared · `[§15.6]` | pdfp 591: "Disables interrupts by clearing the GIF, so that after the #VMEXIT, VMM software can complete the state switch atomically" | CORRECT |
| L148 | `EXITINTINFO` records an intercept taken during IDT delivery · `[§15.7.2]` | pdfp 593, **§15.7.2 "Intercepts During IDT Interrupt Delivery"**: "all intercepts indicate (in the EXITINTINFO field in the VMCB) whether they occurred during exception or interrupt delivery though the IDT. This mechanism allows the VMM to complete the intercepted interrupt delivery, even when it is no longer possible to recreate…" | CORRECT — anchor is §15.7.2, not §15.7.1, and §15.7.2 is what the chapter cites |
| L150 | injected events "are not subject to intercept checks" · `[§15.20]` | pdfp 615 §15.20, verbatim, including AMD's own parenthetical about secondary exceptions | CORRECT |
| L152 | event impossible for the guest mode → `VMEXIT_INVALID`; software interrupts need `Fn8000_000A_EDX[NRIPS]` · `[§15.20]` | pdfp 615: "If the VMM attempts to inject an event that is impossible for the guest mode (e.g., a #BR exception when the guest is in 64-bit mode), the event injection will fail… VMRUN will immediately exit with an error code of VMEXIT_INVALID." and "Software interrupts cannot be properly injected if the processor does not support the NextRIP field. Support is indicated by CPUID Fn8000_000A_EDX[NRIPS] = 1." | CORRECT — "impossible for the guest mode" is AMD's own phrase, not a paraphrase |
| L160 | gPT "map guest linear addresses to guest physical addresses", nPT "map guest physical addresses to system physical addresses" · `[§15.25.1]` `[Figure 15-13]` | pdfp 632 §15.25.1, both verbatim; "Figure 15-13. Address Translation with Nested Paging" on pdfp 633 | CORRECT |
| L173 | "the extra translation uses the same paging mode as the VMM used when it executed the most recent VMRUN"; `#VMEXIT` reloads no host paging state other than CR3 · `[§15.25.3]` `[§15.25.4]` | pdfp 634: first quote is in **§15.25.3**, the CR3 statement in **§15.25.4** ("#VMEXIT need not reload any host paging state other than CR3 from the host save area"). Both anchors cited; boundary checked on-page because §15.25.3/4/5 all begin on pdfp 634 | CORRECT |
| L175 | `N_CR3` MBZ bit set, or illegal `G_PAT`, → `#VMEXIT(VMEXIT_INVALID)` · `[§15.25.4]` | pdfp 634 §15.25.4: "the following conditions are considered illegal state combinations… • Any MBZ bit of nCR3 is set. • Any G_PAT.PA field has an unsupported type encoding or any reserved field in G_PAT has a non-zero value." | CORRECT |
| L177 | "is automatically disabled by #VMEXIT" · `[§15.25.3]` | pdfp 634 §15.25.3, verbatim | CORRECT |
| L202 | fault ordering per §15.25.6 | Bookmark: §15.25.6 "Nested versus Guest Page Faults, Fault Ordering", pdfp 635 | CORRECT |
| L204 | ASID 0 reserved; `VMRUN` with ASID 0 → `#VMEXIT(VMEXIT_INVALID)`; count in EBX of `Fn8000_000A` · `[§15.25.1]` `[§15.5.1]` | pdfp 633, **above the §15.25.2 heading, i.e. still §15.25.1**: "The ASID value of zero is reserved for the host; if the VMM attempts to execute VMRUN with a guest ASID of zero, the result is #VMEXIT(VMEXIT_INVALID)." pdfp 588 (§15.5.1): "The value returned in EBX after executing CPUID Fn8000_000A is the number of ASIDs supported by the processor." pdfp 589 illegal-state list: "ASID is equal to zero." | CORRECT — both anchors land |
| L206 | `INVLPGA`: rAX/ECX, "is always interpreted as a guest virtual address", "does not provide a means to invalidate a nested translation by guest physical address" · `[§15.16.2]` | pdfp 614, **§15.16.2 "Invalidate Page, Alternate ASID"** (the §15.17 heading follows on the same page), both quotes verbatim | CORRECT |

Also confirmed structurally, no value at issue: **L45, L84** (`[App.B]` = "VMCB Layout", pdfp 826),
**L58** (`[§15.33]`), **L142** (`[§15.9]`), **L162, L171** (`[§15.25.1]`/`[§15.25.3]`),
**L196, L198** (`[§15.25.5]` = "Nested Table Walk", pdfp 634).

### F1 — IMPRECISE — L144 (the VLS condition list is incomplete)

**As written:** "unless virtualized VMLOAD/VMSAVE is available *and* enabled for L2 *and* nested
paging is on, L0 must keep both intercepts set…" · `[APM2 §15.33.1]`

**What §15.33.1 says** (pdfp 673, printed 610):

> "VMSAVE and VMLOAD virtualization support is indicated by CPUID Fn8000_000A_EDX[15]=1. VMSAVE
> and VMLOAD virtualization is enabled by setting VMCB offset 0B8h, bit 1 to 1. When VMSAVE and
> VMLOAD virtualization is enabled and the corresponding instruction intercept bits are not set,
> the following checks are performed when VMSAVE or VMLOAD are executed by the guest:
> • **Nested paging must be enabled** • **The hypervisor must be in 64-bit mode** • **Secure
> Encrypted Virtualization must be disabled**
> If any of the above checks fail, VMEXIT_VMSAVE or VMEXIT_VMLOAD is generated."

The three conditions the chapter names (available = `EDX[15]`, enabled = VMCB `0B8h` bit 1,
nested paging on) are all genuine. But AMD lists **three** runtime checks and the chapter names
only one of them; **64-bit host mode** and **SEV disabled** are missing.

Strictly the sentence is still true — it states only "if not (A∧B∧C), keep the intercepts" — and
the omission is fail-safe, because when a missing check fails hardware generates the exit anyway.
But the natural reading is that A∧B∧C licenses clearing the intercepts, and it does not.

**Verdict: IMPRECISE.** Anchor `[APM2 §15.33.1]` is exactly right; the condition list under it is
a proper subset of the manual's. Low severity — no safety hole.

### F2 — IMPRECISE — L76 (an APM anchor carrying the Intel half of a comparison)

**As written:** "This is the sharpest structural difference from Intel's arrangement, where the
host-state area is part of the control structure and is therefore reachable by the same accessor as
everything else" · `[APM2 §15.5.1]` `[1]` `C:medium`

§15.5.1 supports the AMD half (host state in an opaque area addressed by `VM_HSAVE_PA`, confirmed
above at L74). It says nothing whatever about Intel, and no other anchor is offered.

**Verdict: IMPRECISE** — same class as the predecessor's ch19 I1, one notch milder because the
claim is `C:medium` and the AMD half is genuinely anchored. Worth noting that
`19-comparison-intel-arm-riscv.md` L56 makes the **same** comparison and does it correctly, with
`[APM2 §15.5.1]` **and** `[SDM 3C §27.5]`. ch15 L76 should carry the SDM anchor too, or drop the
Intel clause and defer, as the sentence's own tail already does.

*Note for a future lint rule:* the `offSpec` subject regex would not catch this either — the
subject is "Intel's arrangement", not a Windows or CVE token. A cheaper rule: **any claim sentence
containing "Intel" must carry a non-APM anchor.**

---

## 2. `17-security.md` — 58 claims, 0 WRONG, 1 UNSUPPORTED, 6 IMPRECISE, 51 CORRECT

### 2.1 The specific re-check the brief asked for: the SKINIT GIF ordering

**The contradiction is real, both documents are current, and §17.5.2 describes it correctly.**

**APM Vol.2 Rev 3.45, §15.27.6 "SKINIT Operation", pdfp 645–646 (printed 582–583).** Steps 4, 5 and
6, quoted in full and in order:

> "4. Read the SL image from memory and transmit it to the TPM in a manner that cannot be emulated
> by software.
> 5. Signal the TPM to complete the hash and verify the signature. If any failures have occurred
> along the way, the TPM will conclude that no valid SL was started.
> **6. Clear the Global Interrupt Flag.** This disables all interrupts, including NMI, SMI and INIT
> and ensures that the subsequent code can execute atomically. If the processor enters the shutdown
> state (due to a triple fault for instance) while GIF is clear, it can only be restarted by means
> of a RESET."

**APM Vol.3 Rev 3.38, `SKINIT`, Action pseudocode, pdfp 515 (printed 473)**, quoted in full and in
order:

> ```
> Enable SL_DEV, to protect 64Kbyte of physical memory starting at
> the physical address in EAX
> GIF = 0
> Read the SL length from offset 0x0002 in the SLB
> Copy the SL image to the TPM for attestation
> Read the SL entrypoint offset from offset 0x0000 in the SLB
> Jump to the SL entrypoint, at EIP = EAX+entrypoint offset
> ```

`GIF = 0` sits immediately after the `SL_DEV` enable and **two lines before** "Copy the SL image to
the TPM for attestation". Vol.2 puts the same action **two steps after** the equivalent transfer.

Both cover pages read "July 2026" (Vol.2 `24593—Rev. 3.45—July 2026`; Vol.3
`24594—Rev. 3.38—July 2026`). Nothing in either volume's Revision History reconciles them.

**L221 — Verdict: CORRECT-AS-WRITTEN.** Step number, relative order, both revisions and both dates
are right, and the chapter is right that AMD has not reconciled them. §17.8's judgement (treat
Vol.2 as normative for the architecture and the Vol.3 pseudocode as an abbreviated description) is
the defensible reading, and it is correctly labelled a judgement.

**Two things the chapter does not say, which strengthen its own §17.8 position:**

1. Vol.3's pseudocode reorders a **second** action the same way: it sets `ESP = EAX + 0x00010000`
   in the register-initialisation block, *before* `SL_DEV`/`GIF`/TPM, whereas Vol.2 puts the ESP
   update at **step 7**, after the TPM transfer. So the GIF placement is not an isolated slip; the
   Vol.3 listing is not a step-ordered specification at all. That is direct evidence for §17.8's
   "abbreviated description" reading, and it is stronger evidence than anything §17.5.2 currently
   offers.
2. Vol.3's pseudocode omits the multiprocessor handshake (Vol.2 step 3) entirely.

### F3 — UNSUPPORTED — L222 (the stated observable consequence is contradicted by the paragraph the claim itself cites)

**As written:**

> "The observable consequence is small but real: with the Vol.2 ordering an SMI or NMI **can still
> be taken during the TPM transfer**, and with the Vol.3 ordering it cannot. Vol.2 states separately
> that interrupts pending before or asserted during `SKINIT` — including SMI, INIT and NMI — are
> held pending until software sets GIF to 1, **which is consistent with either ordering**."
> `[APM2 §15.27.6]` `C:medium`

**What Vol.2 says**, pdfp 646 (printed 583), the "Pending interrupts" paragraph of §15.27.6 —
the very paragraph the claim's second sentence paraphrases:

> "Pending interrupts. Device interrupts that may be pending prior to SKINIT execution due to
> EFLAGS.IF being clear, or that assert during the execution of SKINIT, will be held pending until
> software subsequently sets GIF to 1. Similarly, **SMI, INIT and NMI interrupts that assert after
> the start of SKINIT execution will also be held pending until GIF is set to 1.**"

AMD's statement is unconditional and is anchored to **the start of SKINIT execution**, not to
step 6. Under it, an SMI or NMI asserted at step 4 is held pending — so the chapter's stated
observable consequence does not hold on Vol.2's own text, and the paragraph is **not** "consistent
with either ordering": it resolves the discrepancy in favour of the Vol.3 placement.

The second sentence is a faithful paraphrase of a real paragraph. The **inference drawn from it is
not supported**, and it is the load-bearing half of the claim.

**Verdict: UNSUPPORTED.** The textual discrepancy recorded at L221 survives untouched; what fails is
L222's account of what the discrepancy is observable *as*. The accurate statement is the opposite
one and is more interesting: **AMD's own prose already tells you the architectural answer** — SMI,
INIT and NMI are masked from the start of `SKINIT` — so the Vol.2 step list is the document that is
out of step with the rest of Vol.2, and §17.8's "treat Vol.2 as normative" advice should be
narrowed to "treat Vol.2's *prose* as normative; its step 6 placement is the anomaly."

Severity: moderate. Nobody is misled about a value, but a reader is told a masking window exists
that AMD says does not, and §17.8's resolution is pointed the wrong way.

### 2.2 The rest of §17.5 — 21 claims, all CORRECT-AS-WRITTEN except one anchor

| Line | Claim | APM Vol.2 Rev 3.45 | Verdict |
|---|---|---|---|
| L202 | SLB is a 64-Kbyte range at any 64-Kbyte-aligned address below 4 Gbyte; SL image at offset 0; physical address of the SLB is `SKINIT`'s only input operand in EAX · `[§15.27.3]` | pdfp 643 §15.27.3, verbatim: "The secure loader block is a 64Kbyte range of physical memory which may be located at any 64Kbyte-aligned address below 4Gbyte. The SL image must have been loaded into the SLB starting at offset 0 before executing SKINIT. The physical address of the SLB is provided as an input operand (in the EAX register) to SKINIT" | CORRECT |
| L203 | first 16-bit word = entry point offset, second = length; **max 65535 bytes**; hash must cover both fields · `[§15.27.2]` | pdfp 642–643 §15.27.2: "The first word (16 bits) of the SL image must specify the SL entry point as an unsigned offset into the [image]…"; "the maximum length allowed is 65535 bytes"; "The digital signature hash must include the entry point and length fields." Figure 15-14 confirms the word order (`EP Offset` at bits 15:0, `Length` at 31:16) | CORRECT |
| L204 | `SKINIT` sets ESP to `EAX + 10000h`; the gap is SL scratch/stack before DEV protection · `[§15.27.3]` | pdfp 643: "Memory between the end of the SL image and the end of the SLB may be used immediately upon entry by the SL as secure scratch space, such as for an initial stack, before DEV protections are set up… SKINIT sets the ESP register to the appropriate top-of-stack value (EAX + 10000h)." | CORRECT |
| L205 | SL runs in flat 32-bit protected mode with paging disabled; derive a base from EAX for position-independence · `[§15.27.3]` | pdfp 643, verbatim | CORRECT |
| L206 | the SLB layout is given as a figure · `[Figure 15-14]` | pdfp 644, "Figure 15-14. SLB Example Layout" | CORRECT |
| L210 | the **eight steps**, enumerated | pdfp 645–646, all eight, in the chapter's order and with the chapter's content | CORRECT |
| L211 | CS selector 8h read/execute, SS 10h read/write expand-up, base 0 limit 4G; DS/ES/FS/GS left as 16-bit real-mode segments; SS segment override until DS reloaded | pdfp 645 step 1, verbatim including "Initialized data in the SLB may be referenced using the SS segment override prefix until DS is reloaded" | CORRECT |
| L212 | GPRs cleared except EAX/EDX/ESP; cache and x87/SSE control survive; most MSRs retain values but **EFER is cleared**; `VM_CR.DPD`/`R_INIT`/`DIS_A20M` unconditionally set to 1 | pdfp 645 step 1, verbatim: "The EFER MSR, however, is cleared. The DPD, R_INIT and DIS_A20M flags in the VM_CR register are unconditionally set to 1." | CORRECT |
| L213 | hidden `SL_DEV_BASE`, one 64-Kbyte-aligned 64-Kbyte region, protected from external access and from GART-translated access, and blocks all device access to PCI configuration space · `[§15.24.8]` | pdfp 631 **§15.24.8 "Secure Initialization Support"**, verbatim: "The host bridge logic includes a hidden (not accessible to software) SL_DEV_BASE address register. SL_DEV_BASE points to a 64KB-aligned 64KB region of physical memory. When SL_DEV_EN is 1, the 64KB region defined by SL_DEV_BASE is protected from external access (as if it were protected by the DEV), as well as from any access (both CPU and external accesses) via GART-translated addresses. Additionally, the SL_DEV mechanism, when enabled, blocks all device accesses to PCI Configuration space." | CORRECT — all four properties |
| L215 | one-way transfer; "initiates execution of the Secure Loader unconditionally" | pdfp 646, verbatim | CORRECT |
| L216 | no instruction/data breakpoint traps, no `EFLAGS.TF` trace traps; disables implementation-specific debug features; a debug SL re-enables by clearing `VM_CR.DPD` on entry | pdfp 646, verbatim ("immediately upon entry") | CORRECT |
| L226 | abort = set GIF to 1 and clear `VM_CR` · `[§15.27.7]` | pdfp 646 §15.27.7, verbatim | CORRECT |
| L227 | BSP only; save processor-specific system register state; idle the APs; INIT IPI then wait for local APIC busy to clear; "a fixed delay of no more than 1000 processor cycles may be necessary" · `[§15.27.8]` | pdfp 646–647, verbatim, including the exact cycle phrase | CORRECT |
| L228 | startup IPI 8-bit vector → upper 8 bits of a 20-bit physical address; AP code in the lowest 1 Mbyte, entry at offset 0 of that page; APs start in 16-bit real mode · `[§15.27.8]` | pdfp 647, verbatim | CORRECT |
| L229 | integrity of AP startup code via the hashed SL image + DEV before copying; no further INIT IPI between the BSP's `SKINIT` and the APs' startup IPI; **APs must not execute `SKINIT`** · `[§15.27.8]` | pdfp 647: "for example by including the startup code in the hashed SL image and setting up DEV protection for it before copying it to the desired area. **The AP startup code does not need to (and should not) execute SKINIT.** Care must also be taken to avoid issuing another INIT IPI from any processor after the BSP executes SKINIT and before all APs have received a Startup IPI, as this could compromise the integrity of AP initialization." | CORRECT |
| L230 | MP abort: restore GIF and clear `VM_CR` on BSP and every AP that responded; clear `SL_DEV_EN` in the DEV control register for each processor with a distinct memory controller · `[§15.27.8]` | pdfp 647, verbatim, both bullets | CORRECT |
| L234 | `#SX` = vector 30, fault class, only defined error code **1**, contributory fault · `[§15.28]` | pdfp 648 §15.28, verbatim: "dispatches to vector 30, and behaves like other fault-class exceptions… The only error code currently defined is 1, and indicates redirection of INIT has occurred. The #SX exception is a contributory fault." | CORRECT |
| L235 | `#SX`'s purpose; `VM_CR.R_INIT`; INIT gated by GIF, held pending while GIF is 0 · `[§15.28]` | pdfp 648, verbatim | CORRECT |
| L240 | "A full-text search of APM Vol.2 Rev 3.45 returns **zero** occurrences of 'PCR'" | **Verified independently: `grep -owc 'PCR'` over the full Rev 3.45 extraction returns `0`.** | CORRECT — the negative claim is true |

### F4 — IMPRECISE — L214 (the "cannot be emulated" rationale is §15.27.5, not §15.27.4)

**As written:** "The TPM used by `SKINIT` is a discrete device on the LPC link off the system I/O
hub; it recognises the special `SKINIT` bus transactions, **which exist precisely so that the TPM
can distinguish true execution of a secure loader from software emulation of it**." · `[APM2 §15.27.4]`

The first half is §15.27.4 verbatim (pdfp 644: "This device is attached to an LPC link off the
system I/O hub. It recognizes special SKINIT transactions, receives the SL image sent by SKINIT and
verifies the signature."). The **rationale** in the second half is §15.27.5 (pdfp 645): "The use of
this special protocol is intended to allow the TPM to detect true execution, as opposed to
emulation, of a trusted Secure Loader…" — a different subsection, not cited.

**Verdict: IMPRECISE.** Value right; the anchor covers only the first clause. Fix: add
`[APM2 §15.27.5]`.

### 2.3 §17.3 — 12 claims, 11 CORRECT, 1 IMPRECISE

All four section anchors check out against the bookmark tree: `[APM2 §3.2.9]` = "Speculation
Control Registers" (pdfp 130), `[APM2 §15.37.1]` = "SPEC_CTRL Virtualization" (pdfp 709),
`[APM2 §15.37.2]` = "ERAPS Virtualization" (pdfp 710), `[APM2 Table A-11]` = "Speculation Control
MSRs" (pdfp 823).

| Line | Claim | APM Vol.2 Rev 3.45 | Verdict |
|---|---|---|---|
| L161 | `SPEC_CTRL` = 048h, `PRED_CMD` = 049h; a `WRMSR` to **either** does not serialize memory but is dispatch-serializing | pdfp 131 and pdfp 133 carry the identical sentence for each register: "Unlike most MSRs, a WRMSR to [SPEC_CTRL / PRED_CMD] does not serialize memory operations. However, a write to this register is dispatch serializing and prevents execution of younger instructions until the WRMSR has completed." | CORRECT — "either" is justified |
| L162 | bit 0 `IBRS` (`EBX` bit 14), bit 1 `STIBP` (bit 15), bit 2 `SSBD` (bit 24), bit 7 `PSFD` (bit 28); IBRS enables STIBP behaviour regardless of the STIBP bit | pdfp 131–133, every bit number exact. And pdfp 132 verbatim: "Note that STIBP mode is automatically enabled when SPEC_CTRL[IBRS] is set, **regardless of value of SPEC_CTRL[STIBP]**." | CORRECT — including the "regardless" clause, which is AMD's own wording |
| L163 | `VIRT_SPEC_CTRL` C001_011F; `Fn8000_0008_EBX[SsbdVirtSpecCtrl]` bit 25; bit 2; "it is preferred that software uses `SPEC_CTRL[SSBD]`" | pdfp 132–133: "On these processors, indicated by CPUID Fn8000_0008[SsbdVirtSpecCtrl] (bit 25) = 1, SSBD is enabled by setting VIRT_SPEC_CTRL (MSR C001_011F) bit 2… However, it is preferred that software uses SPEC_CTRL[SSBD] in this case." | CORRECT, quote verbatim |
| L164 | `Fn8000_0008_EBX[SsbdNotRequired]` bit 26 | pdfp 133, verbatim | CORRECT |
| L165 | `PRED_CMD` write-only; bit 0 `IBPB`, bit 7 `SBPB` (`Fn8000_0021_EAX[SBPB]` bit 27); clears the RAP when `Fn8000_0008_EBX[IBPB_RET]` (bit 30) = 1; writing both performs an IBPB | pdfp 133–134, every element verbatim: "If PRED_CMD MSR is written with both IBPB and SBPB bits set to 1, the processor performs an IBPB operation. Support for SBPB is indicated by CPUID Fn8000_0021_EAX[SBPB] (bit 27) = 1." | CORRECT — five values, all exact |
| L170 | `Fn8000_000A_EDX[SpecCtrl]` bit 20; "for most guests, processor behavior is controlled by the logical OR of the two registers"; `VMRUN` loads from VMCB or VMSA, `#VMEXIT` saves back · `[§15.37.1]` | pdfp 709 §15.37.1, verbatim including "VMCB or VMSA" | CORRECT |
| L171 | the BTB-isolation exception; host IBRS via `SPEC_CTRL[IBRS]` **or** `EFER[AIBRSE]`; BTB isolation is §15.36.17 · `[§15.37.1]` | pdfp 710: "For SNP-active guests with BTB isolation enabled (see Section 15.36.17, 'Side-Channel Protection,' on page 637), the host IBRS value, controlled by SPEC_CTRL[IBRS] or EFER[AIBRSE], does not affect the guest IBRS." — the chapter's cross-reference to §15.36.17 is AMD's own | CORRECT |
| L173 | ERAPS `Fn8000_0021_EAX[ERAPS]` bit 24; VMCB **58h bit 40** `ALLOW_LARGER_RAP` (0 → 32, 1 → `Fn8000_0021_EBX[RapSize]`, always ≥ 32); **bit 41** `CLEAR_RAP` clears on `VMRUN` · `[§15.37.2]` | pdfp 710 §15.37.2, verbatim, including "RapSize is always equal or greater than 32" | CORRECT — six values, all exact |
| L179 | host and guest `SPEC_CTRL` ORed; a guest cannot clear a control the host set | pdfp 709 | CORRECT |
| L181 | `IbpbOnEntry`, `SEV_FEATURES` bit 21, `Fn8000_001F[IbpbOnEntry]` bit 31, hardware writes `PRED_CMD[IBPB] = 1` before executing guest instructions · `[§15.36.17]` | pdfp 701 (**inside §15.36.17 "Side-Channel Protection", pdfp 700–702**), verbatim: "SNP-active guests may choose to enable Indirect Branch Prediction Barrier (IBPB) on Entry through SEV_FEATURES bit 21 (IbpbOnEntry). Support for IBPB on Entry is indicated by CPUID Fn8000_001F[IbpbOnEntry], bit 31. When entering a guest context with IbpbOnEntry enabled, CPU hardware writes PRED_CMD[IBPB]=1 before executing guest instructions." | CORRECT |
| L166 | Table A-11 "Speculation Control MSRs" | Bookmark tree, pdfp 823 | CORRECT |

### F5 — IMPRECISE — L172 (`EFER[AIBRSE]` is defined in §3.1.7, not §3.2.9)

**As written:** "Automatic IBRS is a separate enable: `EFER` **bit 21** `AIBRSE`, enumerated by
`Fn8000_0021_EAX[AutomaticIBRS]` (**bit 8**), gives IBRS protection to **the listed privileged
contexts** without `SPEC_CTRL[IBRS]` being set." · `[APM2 §3.2.9]`

Both values are right. `EFER` bit 21 = `AIBRSE` "Automatic IBRS Enable" is in the EFER bit table on
pdfp 120 and described on pdfp 122 — **§3.1.7 "Extended Feature Enable Register (EFER)"**
(pdfp 119). `Fn8000_0021_EAX[AutomaticIBRS]` bit 8 is in §3.2.9 (pdfp 132), which then says only
"Refer to the description of **EFER[AIBRSE] on page 59** for more details."

So the cited section carries the CPUID half and a pointer; the EFER bit number **and** "the listed
privileged contexts" — the substance the claim turns on — live in §3.1.7.

**Verdict: IMPRECISE.** Fix: `[APM2 §3.1.7]` `[APM2 §3.2.9]`.

### 2.4 §17.6 SMM containerization — 10 claims, 9 CORRECT, 1 IMPRECISE

| Line | Claim | APM Vol.2 Appendix D | Verdict |
|---|---|---|---|
| L259 | Appendix D has one numbered section D.1, **plus a D.1.1 that is not in the bookmark tree** | Bookmark tree has exactly "Appendix D SMM Containerization [pdfp 850]" → "D.1 SMM Containerization Pseudocode [pdfp 850]". The heading "**D.1.1 Converting Simple Containerization into Secure Containerization**" is on pdfp 855 and is **absent from the tree** | CORRECT — an unusually precise structural claim, and it holds |
| L260 | "To minimally participate in SMM activity, the VMM can implement simple containerization … VMMs that do not trust SMM code should implement secure containerization, which requires further extension of the code provided here." | pdfp 850, the appendix's **first paragraph**, verbatim | CORRECT |
| L261 | SMM intercept in **all** guest VMCBs; `#VMEXIT(SMI)` → emulate entry → repeated `VMRUN` with `RSM` intercept until `#VMEXIT(RSM)` → emulate `RSM`; `SMM_CTL` written `ENTER+DISMISS+SMI_CYCLE` in, `EXIT+RSM_CYCLE` out | pdfp 850–851: "must set the SMM intercept bit in all guest VMCBs"; "`wrmsr(SMM_CTL_MSR, ENTER+DISMISS+SMI_CYCLE)`"; "`do { VMRUN(smm_vmcb) } until we see #VMEXIT(RSM)`"; "`wrmsr(SMM_CTL_MSR, EXIT+RSM_CYCLE)`" | CORRECT — both `SMM_CTL` operand lists exact |
| L262 | built from zeroes; `RSM`/`VMRUN`/`MSR` intercepts; MSRPM intercepting EFER read and write; shadow `EFER.SVME` returning 0; own ASID with no TLB entries | pdfp 851: "clear smm_vmcb to all zeros"; "set intercepts in smm_vmcb: RSM / VMRUN / MSR"; "msr protection map with efer read and efer write set"; "the hypervisor should shadow the SVME bit of EFER and return EFER.SVME=0 on reads of EFER"; "the hypervisor should ensure that no TLB entries for this ASID are present in the TLB" | CORRECT — all five |
| L263 | CS `{(smmbase & 0x00ffff00) >> 4, 0x089B, 0xffff_ffff, smmbase}`; ES/SS/DS/FS/GS `{0x0000, 0x0893, 0xffff_ffff, 0x0000_0000}`; CPL 0; EFER `0x1000`; CR4 0; DR7 `0x0000_0400`; RFLAGS `0x0000_0002`; RIP `0x0000_8000`; CR0 copied with bits 0, 2, 3, 31 cleared; **fourteen** GPRs, all but RAX and RSP | pdfp 851–852, **every literal character-for-character**, including "CR0: clear bits 0, 2, 3, 31" and "copy 14 guest GPRs from guest_regs (all except RAX, RSP)" | CORRECT — ten literals, zero drift |
| L264 | save area at `smmbase + 0xfe00`; `smm_revision` = `0x30064`; Vol.3 `RSM` checks **except** the one disallowing `CR0.PG = 1` with `CR0.PE = 0`; expected revision `0x0003_0064`; native `RSM` would shut down, so the hypervisor chooses | pdfp 852 and 854–855, verbatim: "`smmsave_physical_addr = smmbase + 0xfe00`"; "`smmsave.smm_revision = 0x30064`"; "Perform the RSM consistency checks listed in volume 3 of the AMD64 Architecture Programmer's manual, except the check that disallows CR0.PG = 1 when CR0.PE = 0. Note that the expected value for the SMM revision field is 0x0003_0064. If any of the checks fail, the native RSM instruction would have caused a processor shutdown… The hypervisor may wish to destroy the guest or cause its own shutdown." | CORRECT — including AMD's own use of both `0x30064` and `0x0003_0064` for the same value |
| L266 | secure containerization adds four things: I/O ports via the IOPM, MSRs via the MSRPM, paged real mode behind a limiting page table, optional concealment of GPR/FP contents | pdfp 855 D.1.1: "the hypervisor must limit the SMM handler's access to I/O ports, MSRs, and memory… set appropriate bits in the I/O Protection Map and the MSR Protection map and emulate any accesses… should run the SMM handler in paged real mode, with a page table that appropriately limits memory accessible to [it]" | CORRECT |
| L267 | SMM-Lock: `HWCR` bit 0 `SmmLock`, MSR **C001_0015h**; once set cannot be cleared by software except via write-only `SMM_KEY` (**C001_0119h**) or a processor reset; **not affected by INIT or `SKINIT`** · `[§15.32]` | pdfp 672 §15.32/§15.32.1, verbatim: "The SMM-Lock feature allows platform firmware to prevent System Management Interrupts (SMI) from being intercepted in SVM… The SmmLock bit (bit 0) is located in the HWCR MSR (C001_0015h)… Once set, the bit cannot be cleared by software and writes to it are ignored. SmmLock can only be cleared using the SMM_KEY MSR (see Section 15.32.2), or by a processor reset. **This bit is not affected by INIT or SKINIT.**" | CORRECT — all four elements |
| L268 | SVM-Lock: `SVM_KEY` (C001_0118h) write-only, **reads return zero**, and if the key is zero while `VM_CR.LOCK` is set then `LOCK` can only be cleared by a processor reset · `[§15.31.1]` | **Checked specifically because the identical two properties are printed for `SMM_KEY` one section later, which is exactly how a transposition would look.** They are not transposed. §15.31.1 begins on pdfp 671 and **runs over onto pdfp 672**, where it ends: "**If SVM Key is zero when VM_CR.LOCK is one, VM_CR.LOCK can only be cleared by a processor reset. To preserve the security of the SVM key, reading the SVM_KEY MSR always returns zero.**" — both sentences are genuinely about `SVM_KEY`, above the §15.32 heading | CORRECT — a near-miss that reads as an error if only the first page of §15.31.1 is read |

### F6 — IMPRECISE — L265 (`EXITINFO2` is not "the faulting address")

**As written:** "the pseudocode reconstructs the restart state from the upper doubleword of the
guest's exit-information field and **from the faulting address**…"

The rest of L265 is exact — pdfp 853: `iorestart_dword[31:0] = g_vmcb.exitinfo1[63:32]` (the upper
doubleword ✓); `guest_indexreg = &guest_regs[RDI] // type=IN` and `&guest_regs[RSI] // type=OUT` ✓;
`mask = (1<<address_size) - 1` ✓; `if (g->RFLAGS D-bit is set) operand_size = -operand_size` ✓.

But the second source is `Copy g_vmcb.exitinfo2 to smmsave.iorestart_rip`. For an IOIO intercept
`EXITINFO2` is a **RIP**, not a faulting address; the pseudocode uses it as the I/O restart RIP.

**Verdict: IMPRECISE.** Low severity; "from the restart RIP in `EXITINFO2`" would be exact.

### 2.5 §17.7 erratum-driven feature masking — 12 claims, 9 CORRECT, 3 IMPRECISE

| Line | Claim | Source | Verdict |
|---|---|---|---|
| L276 | 57095 = Family 19h Models 10h–1Fh, **Rev 1.05, 2025-11**; 58251 = Family 1Ah Models 00h–0Fh, **Rev 1.30, 2025-07**; every public guide is for EPYC · `[RevGuide 57095 p.5]` | Covers: "Revision Guide for AMD Family 19h Models 10h-1Fh Processors · Publication Number: 57095 · Revision: 1.05 · Date: November 2025" and "…Family 1Ah Models 00h-0Fh… 58251 · Revision: 1.30 · Date: July 2025". p.5: "This revision guide includes information on the following products: • AMD EPYC™ 9004 Series Processors • AMD EPYC™ 9004 Series Processors with AMD 3D V-Cache™ Technology" | CORRECT — both revisions, both dates, and the p.5 anchor |
| L283 | OS-visible workarounds "are provisional and should be removed or disabled when the erratum is corrected in a subsequent hardware release" · `[App.E]` | pdfp 856, Appendix E's **second sentence**, verbatim | CORRECT |
| L284 | the published process has **seven** steps, as enumerated | pdfp 858, **E.1 "Erratum Process Overview"**, seven numbered steps, each matching the chapter's clause including step 5's model-ID fallback and step 6's conditional application | CORRECT — all seven, in order |
| L285 | `OSVW_ID_Length` is a *firmware* property; OSVW IDs and bit positions "are global across all AMD processors" and are never re-used | pdfp 856: "The OSVW ID number for the erratum and the bit position within the erratum status bit vector, once assigned, **are global across all AMD processors**; the OSVW ID and bit position will not be re-used." Firmware ownership is E.1 step 2 ("firmware update to add the new erratum status bit… The OSVW_ID_Length field in OSVW MSR0 is incremented by one") | CORRECT, quote verbatim |
| L289 | `Fn8000_0001_ECX[OSVW]` **bit 9**; unique, never-reused IDs; MSR bank at **C001_0140h** · `[App.E]` | pdfp 856: "Support for the OSVW mechanism is indicated by CPUID Fn8000_0001_ECX[OSVW] = 1" and "The bank of OSVW MSRs is located at address C001_0140h, starting with OSVW MSR0." App.E gives no bit number; **APM Vol.3 App.E, pdfp 691, supplies it: "9 | OSVW | OS visible workaround."** | CORRECT — bit 9 confirmed, though from Vol.3 |
| L290 | `OSVW_ID_Length` in bits 15:0; `MSR address = OSVW_MSR0 + 1 + floor(OSVW_ID / 64)`, bit `OSVW_ID mod 64`; 1 = apply, 0 = "if a workaround is installed, it must be disabled" | pdfp 857, verbatim: "MSR address = OSVW_MSR0 + 1 + floor (OSVW_ID /64) • Bit offset in MSR = OSVW_ID modulo 64"; "1 = Hardware contains the erratum; an OS software workaround is required. 0 = Hardware has corrected the erratum; an OS software workaround is unnecessary. If one is installed, it must be disabled." | CORRECT — formula character-for-character |
| L291 | the model-ID fallback rule | pdfp 857, verbatim | CORRECT |
| L292 | "the OS should never write into these registers"; firmware may | pdfp 856: "The OSVW MSRs should be treated as read-only registers for the OS. The OS should never write into these registers. Hardware allows platform firmware writes to these registers." | CORRECT, quote verbatim |
| L298 | Erratum **1579**, Family 1Ah 00h–0Fh, title, Secure AVIC condition, "guest may miss an interrupt, or fail to clear an interrupt", workaround left to system software, "No fix planned" | RevGuide 58251 p.49, verbatim: "if **Secure AVIC** (Advanced Virtual Interrupt Controller) is enabled in a guest, the guest vAPIC… IRR… backing page may be corrupted. / Potential Effect on System: Guest may miss an interrupt, or fail to clear an interrupt. / Suggested Workaround: System software may contain the workaround for this erratum. / Fix Planned: No fix planned" | CORRECT — every element |
| L300 | firmware can clear a single CPUID bit; probe every bit | Consistent with App.E; a discipline statement, not a value | CORRECT |
| **§17.8** | erratum **1235** appears in **neither** local guide | **Verified:** `1235` occurs in 57095 only inside the microcode patch level `0A101235h` (p.79) and not at all as an erratum number; zero occurrences in 58251. The chapter's open item is exactly right | CORRECT |
| **§17.8** | zero occurrences of "PCR" in Vol.2 Rev 3.45 | Verified, count = 0 | CORRECT |

### F7 — IMPRECISE — L293 (the page anchor is off by one)

**As written:** "for Family 19h Models 10h–1Fh, 'system software shall program the
`OSVW_ID_Length` to 0005h prior to hand-off to the OS', with `OSVW_ID_Length` in MSR C001_0140h and
the status vector in C001_0141h." · `[RevGuide 57095 p.8]` `C:medium`

Every value is right. But in 57095 Rev 1.05 (printed page = PDF index, no offset):

- **p.8** carries the heading "MSRC001_0140 OS Visible Work-around MSR0 (OSVW_ID_Length)" and ends
  with "The reset default value of this register is 0000_0000_0000_0000h."
- **p.9** carries the quoted sentence — "System software shall program the OSVW_ID_Length to 0005h
  prior to hand-off to the OS." — as its **first line**, plus Table 3, plus the whole of
  "MSRC001_0141 OS Visible Work-around MSR1 (OSVW_Status)".

So two of the claim's three elements, including the quoted sentence, are on p.9.

**Verdict: IMPRECISE.** Fix: `[RevGuide 57095 pp.8–9]`.

### F8 — IMPRECISE — L297 (erratum 1458: a silently corrected CPUID string, and the workaround's precedence)

**As written:** "applies with AVIC enabled on parts that report **bit 27 of `Fn8000_000A_EDX`** …
**The suggested workaround is to program `MSRC001_10E6[32]` to 0b**, and the guide says 'No fix
planned'." · `[RevGuide 57095 erratum 1458]`

**What 57095 p.57 says:**

> "With AVIC (Advanced Virtual Interrupt Controller) enabled, processors that set
> **CPUID_Fn8000_00A_EDC[27]=1** will: • Generate a #VMEXIT(fault) instead of allowing guest reads
> of the Extended Interrupt Local Vector Table Registers. • Generate a #VMEXIT(fault) instead of
> generating a #VMEXIT(trap) on guest write access…
> Suggested Workaround: **System software may contain the workaround for this erratum. If the
> workaround mentioned above is not available**, program MSRC001_10E6[32] to 0b."

Two small gaps:

1. The guide prints `CPUID_Fn8000_00A_EDC[27]` — two typos of AMD's own (`Fn8000_00A` for
   `Fn8000_000A`, `EDC` for `EDX`). The chapter silently normalises both. The normalisation is
   **substantively correct** — APM Vol.3 App.E (pdfp 703) gives `Fn8000_000A_EDX[27] =
   ExtLvtAvicAccessChg`, "Extended Interrupt Local Vector Table Register AVIC Access changes",
   which is precisely this erratum's subject. But `grep Fn8000_000A_EDX` over 57095 returns **0**
   hits, so a reader checking the chapter against the guide will not find the string.
2. `MSRC001_10E6[32] = 0b` is AMD's **fallback**, applied only when the system-software workaround
   is unavailable. The chapter presents it as *the* suggested workaround.

**Verdict: IMPRECISE** on both counts. Title, mechanism, both `#VMEXIT` behaviours, the MSR literal
and "No fix planned" are all exact. Fix: say the guide prints `Fn8000_00A_EDC[27]` (an AMD typo for
`Fn8000_000A_EDX[27]`, `ExtLvtAvicAccessChg`), and restore the workaround's precedence.

### F9 — IMPRECISE — L299 (erratum 1465's quoted "Potential Effect" is truncated)

**As written:** "AMD's 'Potential Effect on System' is **'None expected. Hypervisors are expected to
intercept HLT'**".

**57095 p.62:** "None expected. Hypervisors are expected to intercept HLT **when running SEV-SNP
Guests**."

The dropped qualifier is the one that makes AMD's sentence a statement about SEV-SNP rather than
about HLT interception generally. Same class as the predecessor's ch16 F4/F5 quotation-hygiene
findings.

Everything else in L299 is exact. **Erratum 1465**: "A core will hang under the following
conditions: • SEV-SNP Guest has SMT Protection for Guests enabled, and • The hypervisor does not
intercept the HLT instruction, and • The guest executes a HLT instruction." — matches the chapter
clause for clause; "Suggested Workaround: None"; "No fix planned" ✓. **Erratum 1467**: the chapter's
"a 2M or larger page … an SVM structure (a VMCB, a VMSA or an AVIC backing page) allocated on a 2M
boundary" is p.63's Description **verbatim** ("The hypervisor writes to a 2M or larger page, and An
SVM data structure (VMCB, VMSA, or AVIC backing page) … is allocated starting at a 2M boundary
within the 2M or larger page used for the access"), and the two workaround bullets are verbatim;
"No fix planned" ✓. (The chapter's "2M or larger" tracks AMD's Description text; AMD's *title* for
1467 says "2M or 1G". Not an error — the chapter followed the more precise of AMD's two phrasings.
The chapter does omit "associated with a currently running guest", which narrows the condition.)

**Verdict: IMPRECISE** (the 1465 quotation only).

---

## 3. `19-comparison-intel-arm-riscv.md` — 48 claims, 0 WRONG, 1 UNSUPPORTED, 1 IMPRECISE, 46 CORRECT

### 3.1 L181 — UNSUPPORTED, now confirmed against the PDF rather than inferred

The predecessor flagged this structurally, without the manual. It is now confirmed from the source.

**As written:** "the merged-table cost derivation — `(4+1)³ − 1 = 124` references for a hypothetical
three-dimensional walk … is identical in both skills." · `[APM2 §15.9]` `[SDM 3C §27.10]`

**APM Vol.2 Rev 3.45 §15.9** is "**Instruction Intercepts**" (pdfp 597, printed 534). Its entire
content is Table 15-7 and the sentence introducing it: "Table 15-7 specifies the instructions that
check a given intercept and, where relevant, how the intercept is prioritized relative to
exceptions." There is no page-walk material in it, and `15-nested-virtualization.md` L21 correctly
anchors the same section to Table 15-7 (§1.1 above).

**Verdict: UNSUPPORTED — confirmed.** The predecessor's remedy stands: drop `[APM2 §15.9]` and
match the owning chapter's `[no-spec]` `[56][434]`. Note also that no section of APM Vol.2 could
support this figure: the chapter that owns it says so explicitly ("no AMD document states it"), and
that is consistent with everything read in this pass.

### 3.2 The AMD half of ch19's 47 other APM anchors — all CORRECT

| Line | Value / anchor | Confirmed | Verdict |
|---|---|---|---|
| L110 | `VMEXIT_NPF` = **400h**, distinction carried in the payload, faulting guest-physical address in the second information field · `[App.C]` | Table C-1, pdfp 849: "400h · VMEXIT_NPF · Nested paging: host-level page fault occurred (EXITINFO1 contains fault error code; **EXITINFO2 contains the guest physical address causing the fault**)" | CORRECT |
| L145 | `AVIC_INCOMPLETE_IPI` **401h**, `AVIC_NOACCEL` **402h** · `[App.C]` | Table C-1, pdfp 849, both | CORRECT |
| L122 | ASID is a **32-bit** field at VMCB offset **058h**; ASID 0 reserved; `VMRUN` with ASID 0 → `VMEXIT_INVALID`; count in EBX of `Fn8000_000A` · `[App.B]` `[§15.25.1]` `[§15.5.1]` | Table B-1, pdfp 829: "**058h | 31:0 | Guest ASID**"; plus the §15.25.1 and §15.5.1 confirmations at ch15 L204 | CORRECT — all three anchors land |
| L144 | VMCB offset **060h** packs virtual TPR, pending-virtual-interrupt flag, its priority and vector, the TPR-ignore control and the interrupt-masking control · `[App.B]` | pdfp 611, VMCB clean bit 3: "TPR | **V_TPR, V_IRQ, V_INTR_PRIO, V_IGN_TPR, V_INTR_MASKING, V_INTR_VECTOR (Offset 60h–67h)**" — the chapter's six items, in AMD's own grouping | CORRECT |
| L142, L147 | Doorbell Register at **MSR C001_011Bh**; addressed by *physical* APIC ID; relaxed serialization; **write-only, a read faults #GP** · `[§15.29]` `[§15.29.8]` | pdfp 664, inside **§15.29.8 "New Processor Mechanisms"**: "Sending a doorbell signal to a another core is initiated by writing the physical APIC ID corresponding to that core to the Doorbell Register (MSR C001_011Bh)… **The serializing semantics of WRMSR are relaxed when writing to the Doorbell Register. Any attempt to read from this register results in a #GP.**" | CORRECT — all four properties, exact anchor |
| L153 | with GIF cleared: INIT, NMI, external SMI, INTR and virtual INTR all held pending; a debug exception from a breakpoint match **discarded outright** · `[§15.17]` `[Table 15-10]` | Table 15-10 reconstructed by coordinates on pdfp 614: `INIT | Held pending until GIF==1`; `NMI | Held pending until GIF==1`; `External SMI | Held pending until GIF==1`; `INTR and vINTR | Held pending until GIF==1`; `Debug exception or trap, due to breakpoint register match | Ignored and discarded` | CORRECT |
| L164 | "the table's **two** 'discarded' rows" | Table 15-10 has exactly two `Ignored and discarded` cells: the breakpoint-match row and `Internal SMI (I/O Trapping)` | CORRECT — the count is exact |
| L125 | with SVM enabled, global PTEs are global **only within an ASID**; the current ASID is **0** whenever the processor is not inside a guest context · `[§15.16]` | pdfp 612: "When running with SVM enabled, global page table entries (PTEs) are global only within an ASID". pdfp 613: "**The current ASID is 0 when the CPU is not inside a guest context.**" Both inside §15.16 | CORRECT — both halves verbatim |
| L109 | second stage in "the same paging mode as the VMM used when it executed the most recent VMRUN"; writable only if writable at both levels, executable only if executable at both, and **must be marked user at the nested level for the guest to reach it at all** · `[§15.25.3]` `[§15.25.7]` | pdfp 634 (§15.25.3) for the quote; pdfp 637 (§15.25.7 "Combining Nested and Guest Attributes"): "A page is considered user in the guest only if it is marked as user at the guest level. **The page must be marked user in the nested page table to allow any guest access at all.**" | CORRECT |
| L112 | AMD combines the guest's PAT with the host's MTRRs and PAT per §15.25.8 · `[§15.25.8]` | pdfp 637 §15.25.8 "Combining Memory Types, MTRRs": "the processor combines guest and nested page table memory types. Registers that affect memory types include: … The guest PAT type… The host PAT type… The MTRRs (which are referenced based only on system physical address)." | CORRECT |
| L107, L111 | `NP_ENABLE`, nCR3 · `[§15.25.3]` `[§15.25.4]`; fault ordering · `[§15.25.6]` | pdfp 634; bookmark §15.25.6 "Nested versus Guest Page Faults, Fault Ordering" | CORRECT |
| L126 | `INVLPGA` rAX/ECX, guest-virtual only, "does not provide a means to invalidate a nested translation by guest physical address"; the bulk job is the `TLB_CONTROL` field evaluated at `VMRUN` · `[§15.16.2]` `[App.B]` | pdfp 614 §15.16.2 (quote verbatim); Table B-1 pdfp 829: "058h | **39:32 | TLB_CONTROL** | 00h—Do nothing | 01h—Flush entire TLB… | 03h—Flush this guest's TLB e[ntries]…" | CORRECT — including the "data not instruction" framing of L101 |
| L54 | `VM_HSAVE_PA` C001_0117h → 4-Kbyte block; opaque; "must not rely on the format or contents of the host state save area" · `[§15.5.1]` `[§15.30.4]` | pdfp 586 and pdfp 670 | CORRECT |
| L60 | clean field; identity is the VMCB's **physical address, explicitly not the ASID**; set bits a hint, cleared bits always honoured · `[§15.15]` `[§15.15.1]` | pdfp 610; both anchors land on the right subsections (see ch15 L90/L94) | CORRECT |
| L81, L83, L178, L284 | `Fn8000_000A`: EBX = ASID count, EDX = the feature bits; VLS = `EDX[15]`, vGIF = `EDX[16]` · `[APM3 App.E]` | APM Vol.3 **Appendix E "Obtaining Processor Information Via the CPUID Instruction"** (pdfp 669); the `Fn8000_000A` tables are at pdfp 702–703: "Fn8000_000A_EBX … NASID: Number of available address space identifiers (ASID)"; EDX feature list. §15.33.1/2 (pdfp 673) give `EDX[15]=1` for VMSAVE/VMLOAD virtualization and `EDX[16]=1` for Virtual GIF | CORRECT — anchor and both bit numbers |
| L166, L167 | `#VMEXIT` clears GIF for an atomic switch · `[§15.6]`; virtual GIF · `[§15.33.2]` | pdfp 591; pdfp 673 | CORRECT |
| L182 | the clean field is "a hint, not a signal" · `[§15.15.1]` | pdfp 610 §15.15.1 | CORRECT |
| L203 | `#VC` is **vector 29** · `[§8.2.22]` `[§15.35.5]` | Bookmarks: §8.2.22 "**#VC—VMM Communication Exception (Vector 29)**" (pdfp 325 printed / pdfp 388 index region) and §15.35.5 "#VC Exception" (pdfp 682) | CORRECT — the section title itself carries the vector |
| L204, L205, L206, L218, L219 | VMPL · `[§15.36.7]`; C-bit in guest PTEs · `[§15.34.5]` `[§15.34.6]`; RMP · `[§15.36.3]`; `[§15.34]` `[§15.35]` `[§15.36]`; `[§15.36.1]` | Bookmark titles all match: "Virtual Machine Privilege Levels", "SEV Encryption Behavior", "Page Table Support", "Reverse Map Table", "Determining Support for SEV-SNP" | CORRECT |
| L271 | "**RVI** … does not appear anywhere in APM Vol.2" | **Verified: `grep -owc 'RVI'` = 0 and `grep -ic 'Rapid Virtualization'` = 0 over the full Rev 3.45 extraction.** | CORRECT |
| L273 | "**AMD-Vi** … appears nowhere in publication 48882"; "**AMD-V** … appears in APM Vol.2 only in passing" | **Verified: `AMD-Vi` = 0 hits in IOMMU 48882 Rev 3.11; `AMD-V` (excluding `AMD-Vi`) = exactly 3 hits in APM Vol.2 Rev 3.45.** Three occurrences in a 900-page manual is "in passing" | CORRECT — both negatives, and the qualitative "in passing" is fair |
| L272 | §15.25 vs §15.33 | See ch15 L35/L39 | CORRECT |
| L287 | "Secure AVIC is inside the SEV-SNP section of the manual rather than the AVIC section" · `[§15.36]` | Bookmark tree: **§15.36.21 Secure AVIC** (pdfp 703) — inside §15.36 SEV-SNP, not §15.29 AVIC | CORRECT — a structural claim, and it is exactly right |
| L48, L50, L76, L101, L177, L179, L261 | `[App.B]` = VMCB Layout | pdfp 826 | CORRECT |
| L56 | the nested consequence · `[§15.5.1]` **and** `[SDM 3C §27.5]` | AMD half confirmed; carries a second-vendor anchor, unlike ch15 L76 | CORRECT |
| L121 | both architectures run two tag namespaces · `[§5.5.1]` `[SDM 3C §27.6.12]` | §5.5.1 "Process Context Identifier" (pdfp 222) + §15.16 ASID | CORRECT |

### F10 — IMPRECISE — L124 (`CR4.PCIDE` bit 17 and `INVPCID` are §3.1.3, not §5.5.1)

**As written:** "AMD defines it in the same terms Intel does — **CR4.PCIDE (bit 17)** enables it,
the current 12-bit PCID is CR3[11:0], and **`INVPCID` manages the tagged entries**." · `[APM2 §5.5.1]`

All three values are right. §5.5.1 "Process Context Identifier" (pdfp 222) covers two of them —
"When enabled (by setting CR4.PCIDE=1), the processor associates the current 12-bit PCID with each
TLB mapping" and "The current PCID is the value in CR3[11:0]" — but gives **no bit number** and does
not mention `INVPCID`. Both are in **§3.1.3 "CR4 Register"** (pdfp 112–113): the CR4 bit table
("**17 | PCIDE | Process Context Identifier Enable | R/W**") and "Processor Context Identifier
Enable (PCIDE). **Bit 17.** … System software must set this bit to 1 to **enable execution of the
INVPCID instruction**".

**Verdict: IMPRECISE.** Fix: `[APM2 §3.1.3]` `[APM2 §5.5.1]`. Same class as ch17 F5.

---

## 4. Still unverifiable, and why

| Item | Where | Why it cannot be settled here |
|---|---|---|
| **The 24-memory-reference figure's anchor** `[NP-WP §4.2.2]` | ch15 L186; restated ch19 L113 | The AMD **nested-paging white paper** is not in the local corpus (`SNP-WP-70366.pdf` is the SEV-SNP white paper, a different document). The *number* is separately sound — the chapter and `errata.md` E11 both state correctly that **neither the APM nor the Intel SDM contains it**, and this pass confirms the APM half: nothing in §15.25.5 "Nested Table Walk" (pdfp 634) states a total reference count. So the claim's most important assertion — that it is not an APM fact — is **confirmed**; only the white-paper section number is unchecked. |
| **ASPLOS'08 `[56]`, 5 figures** | ch18 §18.6.2 | Out of scope per the brief, and the paper is not in the local corpus. Unchanged from the predecessor. |
| **Intel SDM, ARM and RISC-V anchors** | ch19 `[SDM 3C …]`, `[SDM 3A Ch.5]`, `[SDM 3D App.A]`, `[VT-d 5.20 §3.11]`, `[ARM DDI 0487]`, `[ARM IHI 0069]`, `[ARM SMMUv3]`, `[RISC-V Priv H-ext]` | None of these documents is in the local corpus, which is AMD-only. **The AMD half of every mixed claim is verified above; the non-AMD half is not.** ch19 §19.13 L295/L297 already disclose that the ARM and RISC-V sections are written from manual structure and carry `C:medium`, which remains an honest disclosure. |
| **TPM PCR indices for SKINIT** | ch17 §17.8 | Genuinely unpublished by AMD, and this pass **proves** it rather than assuming it: zero occurrences of "PCR" in Vol.2 Rev 3.45. This is the honest-negative case — the right sources are TCG's D-RTM Architecture and PC Client Platform Firmware Profile, neither of which is an AMD document. No action needed; the chapter already says exactly this. |
| **Erratum 1235's home document** | ch17 §17.8 | Confirmed absent from both local guides (57095 Rev 1.05 and 58251 Rev 1.30). A Family 17h guide (55449 or 56323) is the remaining candidate and is not in the corpus. The chapter's open item states precisely this and needs no change. |

---

## 5. What a maintainer should act on, in priority order

1. **`17-security.md` L222 — UNSUPPORTED.** Vol.2's own "Pending interrupts" paragraph (§15.27.6,
   pdfp 646) states that SMI, INIT and NMI asserting **after the start of `SKINIT` execution** are
   held pending until GIF is set to 1. So there is no masking window during the TPM transfer under
   either ordering, and that paragraph is not "consistent with either ordering" — it favours the
   Vol.3 placement. Rewrite the consequence, and narrow §17.8's resolution from "treat Vol.2 as
   normative" to "treat Vol.2's prose as normative; the step-6 placement is the anomaly." The L221
   discrepancy itself is correct and should stay. Adding the second Vol.3 reordering (ESP) would
   make the "abbreviated description" argument much stronger.
2. **`19-comparison-intel-arm-riscv.md` L181 — UNSUPPORTED, now source-confirmed.** §15.9 is
   "Instruction Intercepts". Drop `[APM2 §15.9]`.
3. **Anchor fixes (three of a kind, all "the cited section holds the pointer, not the substance"):**
   `17-security.md` L172 add `[APM2 §3.1.7]`; `19-comparison` L124 add `[APM2 §3.1.3]`;
   `17-security.md` L214 add `[APM2 §15.27.5]`.
4. **`17-security.md` L293** — `[RevGuide 57095 p.8]` → `pp.8–9`.
5. **`17-security.md` L297** — record that 57095 prints `Fn8000_00A_EDC[27]` (AMD's typo for
   `Fn8000_000A_EDX[27]`, `ExtLvtAvicAccessChg`), and restore the workaround's precedence
   (`MSRC001_10E6[32] = 0b` is the fallback, not the primary).
6. **`17-security.md` L299** — restore "when running SEV-SNP Guests" to the erratum-1465 quotation.
7. **`15-nested-virtualization.md` L144** — §15.33.1 lists three runtime checks (nested paging
   enabled, hypervisor in 64-bit mode, SEV disabled); the chapter names one.
8. **`15-nested-virtualization.md` L76** — an APM-only anchor on a two-sided AMD/Intel comparison.
   `19-comparison` L56 makes the same claim correctly with an SDM anchor alongside.
9. **`17-security.md` L265** — `EXITINFO2` is the I/O restart RIP, not "the faulting address".

### Two notes on method, for the next pass

- **`pdftotext` would have produced at least one false finding here.** The `VMRUN` row of Table 15-7
  and the whole of Table 15-10 read correctly only after reconstructing rows from glyph
  y-coordinates; the linearised stream interleaves the Instruction, Checked-By and Priority columns
  of adjacent rows. Every table value in this report was taken from coordinates.
- **Section boundaries inside a page defeat a bookmark-only section map.** Three subsections begin
  on APM Vol.2 pdfp 610 (§15.15, §15.15.1, §15.15.2) and three on pdfp 634 (§15.25.3/4/5). A
  page→section lookup built from the bookmark tree assigns all of them to the last one and would
  have mis-flagged `15-nested-virtualization.md` L90, L173 and L177 as wrongly anchored. Each was
  resolved by reading the page and locating the text relative to the printed heading. The same trap
  produced a near-miss at `17-security.md` L268, where §15.31.1's last two sentences spill onto
  pdfp 672 above the §15.32 heading and are easily mistaken for the `SMM_KEY` text that follows —
  the two registers carry word-for-word parallel sentences. Reading only the first page of §15.31.1
  would have yielded a confident and wrong WRONG.
