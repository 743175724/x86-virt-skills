# amd-virtualization eval — trap + diagnosis — Claude Opus 5 (independent scorer) — 2026-09-21

Skill commit: not recorded — no git command was run in this session.
Scored files: `answers/trap.md` (12), `answers/diagnosis.md` (20). Key: `questions.yaml`, matched by `id`.
Scored blind to `results/run-1/` and `answers/run-1/`, which were not opened.

| Category | Questions | `must_include` | % | Trap violations | Citations valid | Routing (self-reported) |
|---|---|---|---|---|---|---|
| trap | 12 | 47/47 | **100%** | **0** | 12/12 (100%) | 12/12 first time |
| diagnosis | 20 | 132/141 | **93.6%** | **0** | 20/20 (100%) | 19/20 first time |
| **combined** | **32** | **179/188** | **95.2%** | **0** | **32/32 (100%)** | **31/32** |

**Verdict: PASS.** `must_include` 95.2% ≥ 90%; violations 0; citations 100% ≥ 95%.

`key-disputed` items: **none.** Every load-bearing value was re-derived from the specification
independently before being credited; see "Independent verification" below. Two sourcing defects
that do *not* change any score are recorded under "Notes".

---

## Per-question scores

### trap (47/47)

| id | `must_include` | citation | routing |
|---|---|---|---|
| trap-client-sev-cpuid | 4/4 | valid (`errata.md` E12 + §11.8 measured dumps, `[no-spec]` `[330]`) | right |
| trap-x2avic-cpuid-bit | 4/4 | valid (`[APM3 App.E]`) | right |
| trap-cmdbufrun-register | 4/4 | valid (`[IOMMU 3.11 §3.4.16]`) | right |
| trap-irte-bit0-name | 2/2 | valid (`[IOMMU 3.11 §2.2.5]`) | right |
| trap-iommu-mmio-window-size | 4/4 | valid (`[IOMMU 3.11 §2.3]`) | right (see note) |
| trap-vmexit-restores | 5/5 | valid (`[APM2 §15.5.1]`) | right |
| trap-vmload-vmsave-ss | 3/3 | valid (`[APM2 §15.5.2]`) | right |
| trap-two-dimensional-walk-count | 5/5 | valid (`[NP-WP §4.2.2]` `[15][56]`) | right |
| trap-branch-type-confusion-cve | 4/4 | valid (`[AMD-SB-1037]` + NVD; **no APM anchor**) | right |
| trap-hyperv-image-name | 4/4 | valid (`[46]` Windows Internals Pt.2 7e; **no APM anchor**) | right |
| trap-enlightened-vmcb | 5/5 | valid (`[464]` HTLFS; **no APM anchor**) | right |
| trap-vmgexit-encoding | 3/3 | valid (`[APM3 §4 "VMGEXIT"]`) | right |

Routing note, `trap-iommu-mmio-window-size`: the answer self-reports that the routing row points at
`08-iommu-architecture.md` §8.3 while the window *size* is owned by §8.2. Same chapter, no second
file opened. Counted as correct routing; flagged as a routing-table imprecision under Notes.

### diagnosis (132/141)

| id | `must_include` | citation | routing |
|---|---|---|---|
| diag-svm-unavailable-chain | 7/8 | valid (`[APM2 §15.30.1]`) | right |
| diag-exit-code-80h | 6/6 | valid (`[APM2 App.C]`) | right |
| diag-stale-guest-tlb | 5/7 | valid (`[APM2 §15.16.1]`) | right |
| diag-avic-incomplete-ipi | 6/7 | valid (`[APM2 Table 15-27]`) | right |
| diag-io-page-fault | 9/9 | valid (`[IOMMU 3.11 Table 57]`) | right |
| diag-passthrough-interrupts-missing | 5/7 | valid (`[IOMMU 3.11 Table 9]`) | right |
| diag-sev-launch-failure | 4/6 | valid (`[SEV-API 3.24 Table 14]`) | right |
| diag-vc-storm-early-boot | 7/7 | valid (`[GHCB 2.04 §2.5]`) | right |
| diag-attestation-verify-failure | 6/6 | valid (`[SNP-ABI 1.59 Table 27]`) | right |
| diag-vmm-cannot-use-amd-v | 8/8 | valid (`[101]`; no APM anchor) | right |
| diag-probe-chain-reads-clean | 6/7 | valid (`[463]`; no APM anchor) | right |
| diag-driver-rejected-memory-integrity | 7/7 | valid (`[461]`; no APM anchor) | right |
| diag-kernel-dma-protection-off | 8/8 | valid (`[462]`; no APM anchor) | right |
| diag-nested-hyperv-on-ryzen-7000 | 7/7 | valid (`[460]`; no APM anchor) | right |
| diag-vmware-virtualbox-coexistence | 6/6 | valid (`[47]`; no APM anchor) | **landed short** |
| diag-gpu-passthrough-client | 7/7 | valid (`[467]`; no APM anchor) | right |
| diag-confirm-vbs-status | 7/7 | valid (`[465]`; no APM anchor) | right |
| diag-vbs-cost-figure | 7/7 | valid (`[554]`; `[no-spec]`) | right |
| diag-sev-es-disabled-on-snp-host | 6/6 | valid (`[AMD-SB-3023]`; no APM anchor) | right |
| diag-avic-default-state | 8/8 | valid (`[610]` kernel.org) | right |

Routing, as the answers self-report it: 31/32 right first time. The one exception is
`diag-vmware-virtualbox-coexistence`, which self-reports: *"landed short: §0.2's Windows-symptoms
block has no row for this symptom"*, found one step later via `00-quickref.md` §0.5 item 4. The
answer disclosed this rather than hiding it; scored as the answer reports it.

---

## Scoring rule applied to bundled items

Several `must_include` entries bundle a primary fact with a second, distinct fact. The rule used
throughout, applied uniformly: **an item scores a hit when every distinct verifiable fact it names
appears in the answer; a restatement or definition of the primary fact does not have to be
reproduced.** Where the missing half is a standalone claim (a specific value, name, behaviour or
recommendation), the item is a miss. Three borderline calls are recorded explicitly in the failures
below or here:

- `diag-probe-chain-reads-clean` item 2 — "the hypervisor-present bit, which is set by hypervisors
  and clear on a physical processor". Answer: *"**Is a hypervisor already present?** `CPUID` leaf 1,
  **`ECX` bit 31**"*. **Hit** — the trailing clause defines the bit the answer already identifies.
- `diag-probe-chain-reads-clean` item 3 — the answer omits "in EBX, ECX and EDX together with the
  maximum hypervisor CPUID leaf" but gives leaf `0x40000000` → "Microsoft Hv". **Hit** on the
  diagnostic fact; the register split is elaboration.
- `diag-passthrough-interrupts-missing` item 5 — the key asks that `SupIOPF` set *or* DTE `IG` set
  suppresses the fault. The answer gives *"`IG`(133) suppresses interrupt-caused `IO_PAGE_FAULT`
  logging, and with `IG=0` the decision falls to `SupIOPF` in the IRTE"*, which is the same two
  suppression paths and matches `[IOMMU 3.11 Table 7]` bit 133 verbatim. **Hit.**

---

## Failures

Nine `must_include` misses, all in `diagnosis`. Every one is quoted.

### diag-svm-unavailable-chain — 7/8
**Asked:** "CPUID says SVM is present but my `WRMSR` to `EFER` takes a `#GP` and `SVME` reads back 0. Walk the chain."
**Missing:** "setting `SVMDIS` while `EFER.SVME` is 1 generates a `#GP` regardless of `VM_CR.LOCK`"
**Answered (the nearest the answer comes, verbatim):**
> "`VM_CR.SVMDIS` **does not prevent CPUID from reporting that SVM is available**, so a BIOS-disabled machine passes the CPUID probe and fails at the `EFER` write; while `SVMDIS` is set, writes to `EFER` treat `SVME` as MBZ, which is exactly the "`#GP`, or the bit reads back 0" pair you are seeing `[APM2 §15.30.1]`, `[APM2 Figure 15-27]`, `[1]`. Setting an `EFER` enable bit for a feature the processor does not support is itself a `#GP(0)` `[APM2 §3.1.7]` `[1]`."

That is the *opposite direction* of the missing rule: the answer covers writing `EFER.SVME` while
`SVMDIS` is set, not writing `SVMDIS` while `EFER.SVME` is set. Step 5 of the answer's chain covers
`LOCK` but says only that *"writes to `LOCK` and `SVMDIS` are silently ignored"* while `LOCK` is set
— which, taken alone, invites exactly the wrong inference that `SVMDIS` writes are always harmless.
**Trap hit:** none.
**Diagnosis:** **fact present but not found.** It is in `01-svm-intro.md` §1.4, subsection
"`VM_CR` (`C001_0114h`)": *"setting `SVMDIS` while `EFER.SVME` is 1 generates a `#GP` fault
regardless of the current state of `VM_CR.LOCK`"*. The answer states it opened §1.4 for the MSR
definitions. Verified in the specification: APM2 §15.30.1, "Setting SVMDIS while EFER.SVME is 1
generates a #GP fault, regardless of the current state of VM_CR.LOCK."

### diag-stale-guest-tlb — 5/7
**Asked:** "I changed a nested page table entry and the guest keeps using the old translation. What am I missing?"
**Missing (1):** "the alternative is to allocate the guest a new ASID and not reuse the old one until the whole TLB has been flushed at least once"
**Missing (2):** "clean bit 4 (`NP`) covers `N_CR3` and `G_PAT`, so clearing it does not substitute for a TLB command"
**Answered (verbatim, the full list of remedies the answer offers):**
> "The tool is the **`TLB_CONTROL` field, bits 39:32 of the VMCB control area at byte offset `058h`** … Its four — and only four — encodings are `00h` do not flush, `01h` flush entire TLB …, `03h` flush this guest's entries, `07h` flush this guest's non-global entries"

and the three "further traps" it names are `VMRUN` not clearing `TLB_CONTROL`, reserved encodings
not being consistency-checked, and `INVLPGA`. Neither the ASID-reallocation alternative nor the
clean-bit caveat appears anywhere in the answer — a grep of the answer for "new ASID", "clean bit",
"N_CR3" and "G_PAT" returns nothing.
**Trap hit:** none.
**Diagnosis:** **fact present but not found**, for both. The answer opened `06-nested-paging.md`
§6.8 only. Missing (1) is at §6.7 "Exhaustion and reuse": *"software may flush a guest's TLB entries
effectively by allocating it a **new** ASID and not reusing the old ASID until the entire TLB has
been flushed at least once. `[APM2 §15.16.1]`"*. Missing (2) is at §6.3 "Replicated paging state":
*"bit 4 (`NP`) covers exactly `N_CR3` and `G_PAT` … so a clean-bits optimisation can never
substitute for a TLB command. `[APM2 §15.15.3]`"*. Both are verified in the specification
(APM2 §15.16.1 and §15.15.3). Note that missing (1) lives in the very APM section the question's
`required_citation` names, so the chapter split (§6.7 vs §6.8) is what lost it.

### diag-avic-incomplete-ipi — 6/7
**Asked:** "I am taking exit code `401h` repeatedly and a guest vCPU has stopped receiving interrupts. How do I decode it and what are the causes?"
**Missing:** "for directed interrupts an invalid Logical APIC ID Table entry causes a `#VMEXIT`, while for broadcast IPIs invalid entries are simply ignored"
**Answered (the closest the answer comes, verbatim, from its Table 15-27 reproduction):**
> "| 3 | Invalid Backing Page Pointer | The vAPIC Backing Page Pointer in the Physical APIC ID Table held an invalid physical address | Physical table index for shorthand/broadcast; logical or physical per destination mode for directed IPIs |"

That is the *Index* column's directed-vs-broadcast split, not the validity rule. The answer nowhere
says what happens when an entry is invalid in each case.
**Trap hit:** none — the banned string "there are four defined ID values" is refuted, not asserted:
*"**The `ID` values (Table 15-27) — there are six, 0 through 5, not four**"*.
**Diagnosis:** **chapter lacks the fact.** A grep of the entire `references/` corpus for
"invalid entries are ignored", "entry is not valid" and "not valid, cause" returns nothing.
`07-virtual-interrupts-avic.md` §7.6.1 reproduces AMD's six-step IPI delivery sequence but drops the
clause: its step 4 reads *"look up the backing-page address in the Physical APIC table using the
guest physical APIC ID as index"* and stops there. The fact is in the specification —
APM2 §15.29.6.1 step 4: *"For directed interrupts, if the selected table entry is not valid, cause a
#VMEXIT. For broadcast IPIs, invalid entries are ignored."* This is a real content gap: add the
clause to chapter 07's step 4.

### diag-passthrough-interrupts-missing — 5/7
**Asked:** "A passthrough device's MSIs never reach the guest, and the device is otherwise working. Where do I look?"
**Missing (1):** "with `IV` = 0 all interrupts are forwarded without remapping" (the second half of the same item — `IntCtl` 00b target-aborts, only 10b remaps — *is* present)
**Answered (verbatim):**
> "**The device's DTE interrupt cluster (bits 191:128).** `IV`(128) interrupt-map-valid; **`IntCtl`(189:188)**: `00b` = fixed and arbitrated interrupts **target aborted**, `01b` = forwarded unmapped, `10b` = **remapped**, `11b` reserved and reported as an event when `IV=1`. Only `10b` validates against the per-device table `[IOMMU 3.11 Table 7]`, `[IOMMU 3.11 Table 9]` `[7]`. `IntCtl=00b` is a very common cause of "MSIs silently vanish"."

The answer names `IV` and even cites Table 9 — the table whose entire content is the IV × IntCtl
matrix — but never states the `IV = 0` row. For this symptom that row is the more dangerous one:
with `IV = 0` the MSI is *forwarded*, not aborted, so the whole `IntCtl` analysis the answer offers
is dead code until `IV` is known to be 1.

**Missing (2):** "GA log overflow stops the log entirely and logging stays disabled until software runs the restart procedure, so an empty GA log is not evidence that nothing is pending"
**Answered (the only GA-log statement in the answer, verbatim):**
> "with **`IsRun=0` and `GALogIntr=1`** it writes a **GA log entry** carrying `GATag` and signals an interrupt (the hypervisor must be draining the GA log, or the wake-up never happens)"

"must be draining the GA log" is not the overflow rule and does not deliver the diagnostic payload —
that an empty log proves nothing.
**Trap hit:** none — the banned "check that `RemapEm` is set" is refuted: *"the IRTE bit-0 field is
spelled **`RemapEn`**, not `RemapEm`"*.
**Diagnosis:** **fact present but not found**, for both. Missing (1) is in
`10-iommu-interrupt-remapping.md` §10.3 — the very section the answer says it opened:
*"With `IV=0` all interrupts are forwarded without remapping; with `IV=1` the four `IntCtl`
encodings give target abort, forward unmapped, remap, and undefined behaviour respectively.
`[IOMMU 3.11 Table 9]`"*. Missing (2) is in §10.5 "The GA log and guest vAPIC wake-up", which the
answer did not open: *"GA log overflow does not drop one entry and carry on — it stops the log …
logging stays disabled until software runs the restart procedure."* Both verified in the
specification: IOMMU 3.11 Table 9 (p.75, `IV`=0 → "All interrupts are forwarded without remapping"),
and IOMMU 3.11 §2.7.1 p.189 plus MMIO 2020h[GALOverflow] p.255, with the restart procedure at
§2.7.4 p.191.

### diag-sev-launch-failure — 4/6
**Asked:** "My SEV guest will not launch: the firmware returns `INVALID_PLATFORM_STATE`, and later `WBINVD_REQUIRED`. What is going on?"
**Missing (1):** "`ACTIVATE` also requires a non-zero, valid, not-in-use SEV ASID on an inactive guest"
**Missing (2):** "the ASID range matters: a SEV-ES guest must use an ASID from 1h to `MIN_SEV_ASID - 1`, and a SEV guest without SEV-ES from `MIN_SEV_ASID` to the maximum, where `MIN_SEV_ASID` is `Fn8000_001F[EDX]` and the maximum is `Fn8000_001F[ECX]`"
**Answered (everything the answer says about `ACTIVATE`, verbatim):**
> "**`ACTIVATE` requires that a successful `DF_FLUSH` has been executed since the last `DEACTIVATE` for that ASID** `[SEV-API 3.24 §6.19.1]` `[8]`."

and, separately:

> "Other codes worth having to hand if the sequence shifts: `INVALID_ASID` `0x000D`, `ASID_OWNED` `0x000C`, `ACTIVE` `0x0012`, `INVALID_ADDRESS` `0x0009`, and `RB_MODE_EXITED` `0x001F`"

Listing the three status codes that report the violated preconditions is not stating the
preconditions, and the ASID *range* rule — the one that makes a correctly sequenced SEV-ES launch
fail on a host that assigns from the wrong half of the range — is absent entirely. A grep of the
answer for "MIN_SEV_ASID", "inactive" and "Fn8000_001F" returns nothing.
**Trap hit:** none.
**Diagnosis:** **fact present but not found.** Both live in `12-sev.md` §12.3.1 "The ASID range is
partitioned by SEV-ES, not shared" — a section the answer did not open; it self-reports routing to
§12.8, §12.7 and §12.4. Chapter 12 carries them verbatim: *"If a guest is SEV-ES enabled its ASID
must be **at least 1h and at most (MIN_SEV_ASID − 1)** … `MIN_SEV_ASID` comes from
`Fn8000_001F[EDX]` and the maximum from `Fn8000_001F[ECX]`"* and *"ACTIVATE additionally requires
that the ASID be non-zero, be a valid SEV ASID, and **not be currently used by another guest**; the
guest must be inactive at the time."* Both verified against SEV-API 3.24 §6.19.1 p.96, and the
range direction was checked specifically for reversal — it is not reversed in the key, the corpus or
the specification. (Caution for future scorers: the flat text extraction renders
`(MIN_SEV_ASID-1)` as `(MIN_SEV_ASID1)` because the hyphen falls at a PDF line break.)

### diag-probe-chain-reads-clean — 6/7
**Asked:** "I walked the whole hardware chain on a Windows machine … every stage reads healthy, but VMRUN never runs. What did I get wrong?"
**Missing:** "Microsoft recommends basing compatibility decisions on that signature rather than on the vendor string" (the first half of the item — leaf `0x40000001` returns `Hv#1` — is present)
**Answered (verbatim, in full):**
> "2. **If so, which one?** `CPUID` leaf `0x40000000` → "Microsoft Hv"; leaf `0x40000001` → `"Hv#1"` (§16.9) `[463]`."

**Trap hit:** none.
**Diagnosis:** **fact present but not found.** `16-windows-platform.md` §16.9 "Detecting a
hypervisor" — the section the answer cites by number on this very line — states it:
*"Leaf `0x40000001` returns the interface signature, `EAX = 0x31237648` ("Hv#1"), and Microsoft
recommends that "software only base compatibility decisions on the interface signature reported
through leaf 0x40000001" rather than on the vendor string. `[463]`"*. The same answer file *does*
give this clause under `diag-vmm-cannot-use-amd-v` and `diag-confirm-vbs-status`, so the chapter is
not at fault — the answer compressed it out here.

---

## Independent verification of load-bearing values

Every value credited below was re-derived from the primary source before being scored, so that a
shared error between answer and key could not pass. Wide tables were read from the rendered PDF page
(`pdftotext -layout`), not the flat extraction, because column association is unreliable there.

**Confirmed against APM2 24593 rev 3.45 / APM3 24594 rev 3.38:**
- §15.5.1 host-save list is exactly fourteen items and is introduced "VMRUN saves **at least** the
  following host state information"; "VMRUN does not save or restore the host LDTR". Counted: CS.SEL,
  NEXT_RIP, RFLAGS, RAX, SS.SEL, RSP, CR0, CR3, CR4, EFER, IDTR, GDTR, ES.SEL, DS.SEL = 14.
- §15.6: "Forces CR0.PE = 1, RFLAGS.VM = 0"; "Immediately after #VMEXIT, the processor still
  contains the guest value for LDTR". APM3 VMRUN pseudo-code: "// Do not reload host CR2 or PAT".
- §15.5.2: FS, GS, TR, LDTR (all hidden state); KernelGsBase; STAR, LSTAR, CSTAR, SFMASK;
  SYSENTER_CS/ESP/EIP. **SS is not in the list.**
- `Fn8000_000A_EDX`: 18 x2AVIC, 17 GMET, 16 VGIF, 15 VMSAVEvirt, **14 Reserved**, 13 AVIC,
  6 FlushByAsid, 2 SVML, 0 NP. `Fn8000_000A_ECX[6]` = x2AVIC_EXT.
- §15.29.4.1: AVIC Enable = bit 31, x2AVIC Mode Enable = bit 30 of VMCB offset 60h; bit 30 without
  bit 31 → VMEXIT_INVALID. (Unscored side claim in `trap-x2avic-cpuid-bit`; correct.)
- Table 15-25/15-26/15-27: EXITINFO1 = ICRH 63:32 / ICRL 31:0; EXITINFO2 = ID 63:32, reserved 31:12,
  Index 11:0 meaningful for ID 1–3; **six ID values 0–5**, ">5 Reserved", ID 5 = "Un-accelerated IPI
  — Destination Shorthand is not set to Self (Secure AVIC)".
- Table C-1: `80h VMEXIT_VMRUN` "VMRUN instruction"; bands 0h–Fh, 10h–1Fh, 20h–2Fh, 30h–3Fh,
  40h–5Fh, 60h–7Fh, 80h–9Fh, A0h–BFh; 400h/401h/402h/403h/407h and −1…−4 outside the rule; App.C
  sentence "Intercept exit codes are equal to the bit position of the corresponding flag in the
  VMCB's intercept vector" — defensible on the contiguous-array reading, as the answer argues.
- §15.16, Table 15-9, §15.16.1, §15.16.2, §15.29.4.3: all TLB claims confirmed, including the
  xAVIC multiprocessor `TLB_CONTROL = 3h` requirement.
- §15.30.1, §15.31, §15.31.1, §15.4 pseudo-code: VM_CR bit layout (DPD 0, R_INIT 1, DIS_A20M 2,
  LOCK 3, SVMDIS 4), SVM_KEY write-only compare-and-clear semantics, zero-key → reset only, and all
  four outcome names `SVM_NOT_AVAIL` / `SVM_ALLOWED` / `SVM_DISABLED_AT_BIOS_NOT_UNLOCKABLE` /
  `SVM_DISABLED_WITH_KEY`.
- §15.35.5: `#VC` vector 29, precise/contributory/fault-type/unmaskable; error code = `#VMEXIT` code;
  "it is inadvisable for the hypervisor to set the VMCB intercept bit for the #VC exception".
- APM3 instruction page: `VMMCALL — 0F 01 D9`; `VMGEXIT — F2/F3 0F 01 D9`; VMGEXIT interpreted as
  VMMCALL on non-supporting processors.

**Confirmed against IOMMU 48882-PUB rev 3.11 (rendered pages):**
- MMIO 0018h bit 12 = `CmdBufEn` (bit column 12/11/10/9/8/7:5 → CmdBufEn/Isoc/Coherent/ResPassPW/
  PassPW/InvTimeOut, p.221); MMIO 2020h bit 4 = `CmdBufRun`, RO, level-sensitive (bit column 5/4/3/2/1/0
  → PprOverflow/CmdBufRun/EventLogRun/ComWaitInt/EventLogInt/EventOverflow, p.256).
- §2.3 p.120 verbatim: "If MMIO Offset 0030h[PCSup] = 0, 16 Kbytes of space must be allocated. If
  MMIO Offset 0030h[PCSup] = 1, 512 Kbytes of space must be allocated." `BaseAddress[18:14]` must be
  zero when PCSup = 1 (p.—, EFR text). `PCSup` is EFR bit 9 (p.227 bit column 15:14/13:12/11:10/9/8 →
  GLXSup/GATS/HATS/PCSup/HESup) — the answer's unscored side claim is correct.
- `RemapEn` occurs 22 times in the document; `RemapEm` occurs **0** times. Table 20 (p.92):
  Destination 15:8, GuestMode 7, DM 6, RqEoi 5, IntType 4:2, SupIOPF 1, RemapEn 0 — exactly the
  layout the answer prints, and "SupIOPF is meaningful independent of the value of RemapEn" is
  verbatim.
- Table 57 / Figure 56 (pp.152–154): EventCode 31:28 = 0010b; GN 16, I 19, PR 20, RW 21, PE 22,
  RZ 23, TR 24 — **all seven individually confirmed**; "RZ is only meaningful when PR=1", "PE is
  only meaningful when PR=1"; RZ 1 = reserved bit, 0 = invalid level encoding; +08/+12 = DVA.
  §2.1.3.2 p.52 confirms target abort with no retry. The answer's decode of `+04 = 2050_0000h`
  (bits 29, 22, 20 → EventCode 2h, PR 1, PE 1, RW 0, RZ 0, GN 0, TR 0, I 0) is arithmetically and
  semantically correct.
- DTE: `IV` 128, `IntTabLen` 132:129, `IG` 133, Interrupt Table Root Pointer 179:134, `IntCtl`
  189:188 — all five confirmed from Figure 7 p.63 and Table 7 pp.65–67; ITRP "only used when
  interrupt translation is enabled (IntCtl=10b)"; IRTE index = MSI Data[10:0] (p.90).

**Confirmed against SEV-API 55766 rev 3.24, SNP-ABI 56860 rev 1.59, GHCB 56421 rev 2.04:**
- Table 14 is the status-code table; `INVALID_PLATFORM_STATE` 0x0001, `INVALID_GUEST_STATE` 0x0002,
  `INVALID_ADDRESS` 0x0009, `ASID_OWNED` 0x000C, `INVALID_ASID` 0x000D, `WBINVD_REQUIRED` 0x000E,
  `DF_FLUSH_REQUIRED` 0x000F, `ACTIVE` 0x0012, `RB_MODE_EXITED` 0x001F.
- Table 16: three platform states. **Table 43: exactly seven guest states**, UNINIT 0h → SENT 6h.
- Table 27 (ATTESTATION_REPORT): `SIGNATURE` at `2A0h`–`49Fh` = 512 bytes, "Signature of bytes 0h to
  29Fh inclusive"; `SIGNING_KEY` bits 4:2 at `48h` = 0 Legacy VCEK / 1 VLEK / 2 Chip-secret VCEK /
  3–6 Reserved / 7 None; `VMPL` = 0xffffffff for a host-requested report; Table 146 encoding 1h =
  ECDSA P-384 with SHA-384; Table 148 R at `000h`, S at `048h`, zero-extended little-endian.
  Table 3 (Venice, **no BOOT_LOADER field**), Table 4 (Turin), Table 5 (Genoa/Milan) — three
  genuinely different bit layouts, matching the answer's three rows field for field.
- GHCB Table 2 / §2.3.1: **0x002 = SEV Information Request (guest), 0x001 = SEV Information
  (hypervisor)**, `GHCBData[31:24]` = encryption bit number. Checked specifically for reversal — the
  answer has them the right way round. 0x004/0x005 CPUID request/response with register selector in
  `GHCBData[31:30]`; function `0x0000_000d` unsupported; §2.3 "The hypervisor must not intercept
  access to MSR 0xc001_0130".

**Confirmed against the corpus:** `11-memory-encryption.md` §11.8's measured CPUID table is
reproduced by `trap-client-sev-cpuid` exactly, row for row (`0001000F` / `0001780F` / `00000001` /
`00000001`, `ECX = 000001FD` = 509).

---

## `must_not_include` — refuted, not asserted (0 violations)

Every banned string that surfaces anywhere in either file does so inside a correction. All 22
occurrences, quoted:

| id | banned string | the answer's sentence |
|---|---|---|
| trap-client-sev-cpuid | "`Fn8000_001F EAX[1]` reads 0 on client Ryzen" | "not "`EAX[1]` reads 0 on Ryzen", which a Zen+/2/3 desktop disproves in one `cpuid` invocation" |
| trap-x2avic-cpuid-bit | "x2AVIC is EDX[14]" | "**Premise:** incorrect. `Fn8000_000A_EDX[14]` is **Reserved**." |
| trap-cmdbufrun-register | "`CmdBufRun` is in the Control Register" | "`CmdBufRun` is not in the Control Register, so polling MMIO 0018h for it will never show it set" |
| trap-irte-bit0-name | "the field is RemapEm" | "the spelling `RemapEm` circulates in secondary material and appears nowhere in the specification" |
| trap-iommu-mmio-window-size | "the IOMMU MMIO region is 14 KiB" | "**Premise:** incorrect, and "14" is not a size at all" |
| trap-vmexit-restores | "that is the whole list" | "What is wrong is "the whole list": they are three of a **fourteen-item** enumerated set" |
| trap-vmload-vmsave-ss | "VMLOAD and VMSAVE transfer SS" | "SS is **not** among the state VMLOAD/VMSAVE transfer, so the pair cannot be used to skip saving it" |
| trap-two-dimensional-walk-count | "the worst case is 16 memory references" | "The 16 in the premise is the `nm` term alone — it counts one nested walk per guest-entry fetch and drops the `n + m` terms" |
| trap-two-dimensional-walk-count | "the APM states the 24-reference figure" | "**neither the APM nor the Intel SDM states this figure** … An anchor of the form `[APM2 §15.25.x]` on this number is a **fabrication**" |
| trap-branch-type-confusion-cve | "cite CVE-2022-23816" | "**CVE-2022-23816 is REJECTED at NVD** … It is not citable." |
| trap-hyperv-image-name | "Hyper-V loads `hvix64.exe` on AMD hosts" | "The circulating error it guards against is "Hyper-V loads `hvix64.exe` on AMD hosts"" |
| trap-enlightened-vmcb | "AMD has no enlightened VMCB counterpart" | "But "**no counterpart at all**" is false: AMD has a Hyper-V enlightenment interface." |
| trap-vmgexit-encoding | "VMGEXIT is `F3 0F 01 D9` only" | "both prefixes are architectural, and AMD's instruction page prints them together … a secondary source asserting the `F3`-only form is the thing that is wrong" |
| diag-exit-code-80h | "the exit code equals the bit position of the intercept bit within its 32-bit word" | "Reading the bit index inside its own 32-bit word is the misconception, and it collapses five distinct bands onto one" |
| diag-exit-code-80h | "AMD's statement in Appendix C is wrong" | "AMD's own sentence is defensible on the contiguous-bit-array reading, so correct the reading, not AMD's sentence" |
| diag-avic-incomplete-ipi | "there are four defined ID values" | "**there are six, 0 through 5, not four**" |
| diag-vmm-cannot-use-amd-v | "re-enable SVM Mode in the BIOS" | "**nothing on the machine is misconfigured** — hardware present and enabled, firmware correct" |
| diag-nested-hyperv-on-ryzen-7000 | "nested virtualization is not supported on AMD" | ""Hyper-V nested virtualization is Intel-only" is **false**" |
| diag-vmware-virtualbox-coexistence | "turn Hyper-V off first" | "the "turn Hyper-V off first" advice is **superseded**" |
| diag-vbs-cost-figure | "memory integrity costs 5-25%" | "the widely relayed "**5–10% system-wide**" and "**5–25% in games**" ranges have **no traceable primary source**" |
| diag-sev-es-disabled-on-snp-host | "SEV-ES is disabled on SNP-capable CPUs because of a Zen 5 generational change" | "**No — it is not a Zen 5 generational change.**" |
| diag-passthrough-interrupts-missing | "check that `RemapEm` is set" | "the IRTE bit-0 field is spelled **`RemapEn`**, not `RemapEm`" |

---

## Notes

**No `key-disputed` items.** The key survived independent re-derivation of every load-bearing value
in both sets. Two items were examined closely as dispute candidates and cleared:

1. `diag-passthrough-interrupts-missing` `required_citation: "IOMMU 3.11 Table 9"`. Table 9 is *not*
   the DTE field table (that is Table 7 with Figure 7); it is "IV and IntCtl Fields in Device Table
   Entry for Fixed and Arbitrated Interrupts", the IV × IntCtl behaviour matrix. But since
   `must_include` item 1 is precisely the IV × IntCtl behaviour, Table 9 is the correct anchor for
   the item the key is testing. **Not disputed** — but a scorer working from the DTE bit numbers
   alone could reasonably mistake this for a wrong citation, so it is worth a word in the key's
   `notes`.
2. `diag-sev-launch-failure` ASID-range direction. Checked explicitly for reversal against
   SEV-API 3.24 §6.19.1: SEV-ES → `[1h, MIN_SEV_ASID−1]`, SEV-without-ES → `[MIN_SEV_ASID, max]`,
   EDX = MIN_SEV_ASID, ECX = maximum. The key has it right.

**Skill and key defects the scoring exposed** (none change a score):

- **Content gap, `07-virtual-interrupts-avic.md` §7.6.1.** AMD's IPI delivery sequence
  (APM2 §15.29.6.1) step 4 ends "For directed interrupts, if the selected table entry is not valid,
  cause a #VMEXIT. For broadcast IPIs, invalid entries are ignored." The chapter reproduces the
  six-step sequence but drops that sentence, and it appears nowhere else in `references/`. This is
  the only miss in either set that the corpus could not have supplied. Fix: restore the clause to
  step 4.
- **Citation defect, `errata.md` E25 and `14-sev-snp.md` §14.11.** Both anchor "the report's
  `VERSION` has moved across firmware ABI revisions — 3h, then 5h, then 6h" to
  `[SNP-ABI 1.59 Table 27]`. Rev 1.59 Table 27 says only "Set to 6h for this specification"; the
  local 1.58 historical copy says 5h; **"3h" is attested in neither**, and 1.59's revision history
  does not mention a VERSION bump. The progression claim is a cross-document inference, not
  something Table 27 states. It should carry the two revisions it can actually source, or an
  explicit "compare rev 1.58 and rev 1.59" anchor. The answer reproduced the claim faithfully and is
  scored a hit; the *anchor* is what is weak.
- **Corpus contradicts the specification's literal text, `14-sev-snp.md` line 419.** The chapter
  (and the key's `notes` for `diag-attestation-verify-failure`) states "`AUTHOR_KEY_DIGEST` is zero
  unless `AUTHOR_KEY_EN` is 1." SNP-ABI 1.59 Table 27, offset `110h`, reads "**Zeroes if
  AUTHOR_KEY_EN is 1.**" — the opposite polarity. AMD's own Table 27 is self-inconsistent here (the
  `AUTHOR_KEY_EN` bit at `48h` bit 0 says the digest *is present* when the bit is set), and 1.58
  carries the same wording, so this is an AMD document defect rather than a transcription slip. It
  is not in `must_include` for any question in these two sets, so no score moves — but the corpus
  currently asserts one side of an unresolved contradiction as settled `C:high`. It belongs in
  `errata.md` as an open conflict, presented both ways.
- **Routing-table imprecision, `SKILL.md` → chapter 08.** The routing row sends IOMMU-register
  questions to §8.3, but the MMIO window *size* is owned by §8.2. The answer found it anyway and
  said so; the row should name both, or §8.3 should forward.
- **Quickref gap, `00-quickref.md` §0.2.** The Windows-symptoms block has no row for "can I run
  VMware/VirtualBox with Hyper-V on?" — the answer had to fall through to §0.5 item 4. Given that
  this is one of the most common real questions in the chapter's scope and has a settled erratum
  (E15), it should have a §0.2 row.
- **Section-boundary losses.** Five of the nine diagnosis misses are facts that sit one section away
  from where the answer routed: §6.3 and §6.7 (not §6.8), §10.5 (not §10.4), §12.3.1 (not §12.4),
  §1.4's `VM_CR` subsection. This is the "chapter buries it" failure mode in RUNNER.md's table, and
  the cheapest fix is a cross-reference line at the head of the destination section rather than
  promotion to `00-quickref.md`: e.g. §6.8 should open "before choosing a `TLB_CONTROL` value, see
  §6.7 for the new-ASID alternative and §6.3 for why clean bit 4 is not a substitute", and §12.4
  should open "the ASID you are reusing must also be legal — see §12.3.1".
