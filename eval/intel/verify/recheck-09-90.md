# Adversarial re-check of the corrections recorded in `full-09`, `full-10-11`, `full-12-13`, `full-14`, `full-15-17`, `full-16-18-90`

The corrections themselves had never been checked. Each one below was re-read as the chapter
**now** states it, and judged against the governing text in a source opened for this pass — not
against the fixer's report, and not from memory.

## Sources opened for this pass

| Source | How obtained |
|---|---|
| VT-d Rev 5.20, D51397-019, April 2026 | `cdrdv2-public.intel.com/919688/…`, `pdftotext -raw` (the `-layout` dump desynchronises the register tables; every bit position below was read from the per-bit description table, not the figure legend) |
| SDM Vol.3C / 3D / 4, rev 092 | Intel cdrdv2, text-extracted |
| Intel TDX Module Base Spec 348549-008US, May 2026 | `cdrdv2.intel.com/v1/dl/getContent/733575` |
| Intel TDX Module ABI Reference 348551-008US, May 2026 | `cdrdv2.intel.com/v1/dl/getContent/733579` |
| Intel Scalable I/O Virtualization, 337679-002 **Rev 1.1**, September 2020 | `cdrdv2-public.intel.com/671403/…` |
| AMD64 APM Vol.2, pub 24593, **rev 3.45, July 2026** | `docs.amd.com/api/khub/documents/LNBl5evreogi0r25VIFF2g/content` |
| Microsoft Learn — nested virtualization (both the hyper-v-on-windows and the windows-server copy), Hyper-V scheduler types | `raw.githubusercontent.com` (`Virtualization-Documentation`, `windowsserverdocs`), live/main branches |
| Hypervisor TLFS — nested virtualization, VP properties, `HV_VP_ASSIST_PAGE`, feature discovery, timers | same repo, live branch |
| Windows Hypervisor Platform — `WHvRunVirtualProcessor`, `WHvExitContextDataTypes` | same repo, live branch |
| INTEL-SA-01397 | Intel security centre |
| Arm DDI 0601 — `HPFAR_EL2` | Arm registers reference (developer.arm.com now serves an SPA shell; read from a complete mirror of the same register page) |
| Intel L1TF guidance | intel.com advisory-guidance article |

## Verdict counts

| Verdict | Count |
|---|---|
| CORRECT | 57 |
| STILL-WRONG | 0 |
| OVER-CORRECTED | 0 |
| INCOMPLETE | 1 |

One defect found, and fixed in this pass. A further block of corrections in the batch rests on
secondary sources (benchmark papers, CVE advisories, kernel source, product pages); those were not
re-opened and are listed at the end as **not re-checked**, not as CORRECT.

---

## `09-smm-seam.md`

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| C001 | Second anchor `[SDM 3C Ch.35]` added to the two-chapter title claim | CORRECT | Vol.3C chapter headers read "SYSTEM MANAGEMENT MODE" and "SECURE ARBITRATION MODE (SEAM)" |
| C002 | Re-anchored §35.1 → Ch.35; records the SDM's spelling "Trusted Domains Extensions" | CORRECT | The sentence "The SEAM architecture is used as a foundation for Trusted Domains Extensions (TDX) architecture" sits in the Ch.35 preamble, above the §35.1 heading. §35.1 "MODES OF OPERATION" does not contain it |
| C064 | `C:high` → `C:medium`, caveat written into the claim | CORRECT | §34.15.5: "software should maintain the MSEG header in writeback cacheable memory. **Future implementations may allow or require a different memory type.** Software should consult the VMX capability MSR IA32_VMX_BASIC" |

## `10-vtd-dma-remapping.md` / `11-vtd-interrupt-remapping.md` — the nine claims

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| A11 | TTM anchored `§11.4.5` | CORRECT | §11.4.5 is Root Table Address Register; §3.11.4 is "Determining Memory Type" |
| A44 | SSPTPTR **(HAW-1):12**, bits 63:HAW Reserved, "unlike the root, context and PASID-directory entries" | CORRECT | §9.6 bit table: `63:HAW  R: Reserved  Reserved. Must be 0` / `HAW-1:12  SSPTPTR`. The qualification is exact — §9.3's own Bits column really does print `63:12` for the context-entry SSPTPTR (with the HAW rule only in prose), so §9.6 is the odd one out, as the claim says |
| A45 | FSPTPTR **(HAW+127):140**, bits 191:(HAW+128) Reserved | CORRECT | §9.6: `191:HAW+128  R: Reserved` / `HAW+127:140  FSPTPTR: First Stage Page Translation Pointer` |
| A60 | IW Reserved(0); **IR merely ignored** | CORRECT | §9.8, every SS paging-entry table: "62 IW … **is treated as Reserved(0)** when Second Stage I/O Read/Write bits are not enabled"; "61 IR … **is ignored** when Second Stage I/O Read/Write bits are not enabled" |
| A117 | IOTLB descriptor waits on context-cache **and** PASID-cache | CORRECT | §6.5.2.12 bullet 1 names `cc_inv_dsc` **and** `pc_inv_dsc` |
| A130 | HPT added **Rev 5.0, August 2024**; 5.20's only HPT change is the §7.1.3 NA faults | CORRECT | Revision history, August 2024 / 5.0: "Added support for Host Permission Tables. (Section 4.2.4)". Rev 5.20 has exactly three bullets, the first "Some fault conditions are not applicable (NA) when HPT is not enabled Section 7.1.3" |
| A135 | RTA.5 unconditional on MajVer ≥ 8; MajVer ≤ 7 conditional on ERS = 0; ERS deprecated | CORRECT | Table 30 RTA.5 carries no configuration clause; SPT.4.4 carries the "and the Execute Requests Support (ERS) field is 0" condition; ECAP bit 30: "This field is planned for deprecation. Implementations **must** report this field as Clear" |
| B38 | Vector zeroing stated for **SMI only** | CORRECT | §9.9 DLM 010b: "the vector field is ignored, but **must be programmed to all zeros for future compatibility**". 100b (NMI) and 101b (INIT) say only that the vector information is ignored |
| B41 | Trigger-Mode-Level footnote anchored `§5.1.4` | CORRECT | Footnote 2 ("the 'Trigger Mode Level' field … is always set to 'asserted' (1b)") belongs to §5.1.4's numbered step list, alongside footnote 1 on the IM field; it is merely printed on the page that §5.1.4.1 opens |

### …and the seven non-claim fixes

| Where | Verdict | Evidence |
|---|---|---|
| §10.1 rename moved to **Rev 3.4, December 2021** | CORRECT | Revision history, December 2021 / 3.4: "Renamed 'First-level' to 'First-stage'. Renamed 'Second-level' to 'Second-stage'." Rev 5.20's three bullets contain no rename |
| §10.4.6 table now HAW-relative | CORRECT | as A44 / A45 |
| §10.4.8 "bitwise compatible" | CORRECT | §9.8: "second-stage paging entries are **bitwise compatible** with the Intel 64 processor's EPT paging entry format" |
| `page_grp_resp_dsc`, `hpt_inv_desc` | CORRECT | §7.6.1 "The Page Group Response Descriptor (`page_grp_resp_dsc`)"; §6.5.2.7 "The HPT Cache Invalidate Descriptor (`hpt_inv_desc`)" |
| DIT = Device-TLB **Invalidation Throttle** | CORRECT | ECAP bit 41 verbatim |
| Pitfall 6: CAP bit 3 plain RsvdZ; DEP on CAP.23 and ECAP.5 / 24 / 28 | CORRECT | CAP_REG "3  RsvdZ  0h  R: Reserved"; the four `DEP: Deprecated` rows fall at CAP.23 and ECAP.28 / 24 / 5 |
| Fault reasons 2Ah / 2Bh Qualified = **No** | CORRECT | Table 15 rows read `2Ah No` and `2Bh No` |

## `12-vtd-faults-bios-siov.md` / `13-tdx.md`

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| W1 | Fault compression **optional** | CORRECT | §7.2.1: "**If hardware supports compression¹** of multiple faults from the same requester, it compares the source-id (SID) field…"; next bullet "(**or if hardware does not support compression of faults**)" |
| W2 | §12.8.1 conditioned on compression support | CORRECT | follows from W1; the claim now states the without-compression case explicitly |
| W3 | SIOV cover **Rev 1.1**; 1.0 = June 2018 technical preview | CORRECT | Cover: "September 2020 / Order Number: 337679-002, Rev 1.1". Revision history: "June 2018  1.0  Technical preview release" |
| W4 | Translation type selected at **stage 2**; stage 3 is the walk | CORRECT | SIOV §3.1 items 2 and 3, verbatim |
| W5 | 5520/5500 Spec Update errata #47 / #53; X58 absent from it; anchor → `[no-spec]` | CORRECT on the checkable half | VT-d Rev 5.20 contains **zero** occurrences of "X58", "5520", "5500" or "erratum"; the only two hits for "errata" are copyright-page boilerplate. The `[VT-d 5.20 Ch.?]` anchor was indeed fabricated. The chipset Spec Update PDF could not be retrieved this pass, so the erratum *titles* remain attested only by `[201]` — which is what `[no-spec]` is for |
| W6 | Workaround text and device IDs; anchor → `[no-spec]` | CORRECT on the checkable half | same |
| W7 | RAX **bit 24 = INTERRUPT_MODE**, **62:25** reserved, bit 63 P-SEAMLDR | CORRECT | ABI Table 5.2, §5.4.1: `24 INTERRUPT_MODE … Support … enumerated by TDX_FEATURES0.HOST_SIDE_INTERRUPT_MODE (bit 62)`, `62:25 Reserved Must be 0`, `63 P-SEAMLDR Must be 0 for TDX Module interface functions` |
| W8 | Import chain begins at **UNINITIALIZED** | CORRECT | Base spec Figure 7.2 text layer: `UNINITIALIZED` … `START_IMPORT / Immutable state import is in progress / TDH.IMPORT.STATE.IMMUTABLE`; only `START_EXPORT` hangs off RUNNABLE, and `TDH.IMPORT.END` is the rejoin |
| W9 | TEE_TCB_INFO offsets; MRSEAM = the TD-**creating** module; MRSIGNERSEAM and ATTRIBUTES zeroed | CORRECT | ABI Table 3.47: `MRSEAM 24 48 The measurement of the TDX Module **that created the TD**`, `MRSIGNERSEAM 72 48 Set to all 0's.`, `ATTRIBUTES 120 8 Set to all 0's.`, `TEE_TCB_SVN2 128 16 … **current** TDX Module`, `RESERVED 144 95` (144 + 95 = 239 bytes, as the claim says). `VALID = 0x301FF` leaves bits 9 and 15 clear, so offsets 72 and 120 really are *marked invalid* as well as zeroed |
| W10 | Migrated-TD MRSEAM is destination-platform, at `TDH.MNG.CREATE`, **before import**; re-anchored §3.9.3 | CORRECT | Table 3.47 "TD Migration" note, verbatim; §3.9.3 is "TEE_TCB_INFO (Reference)" and §3.9.2 is TDREPORT_STRUCT, so the re-anchor is right too |
| W11 | TDX Connect block begins at **128**; `TDH.TDI.*` 136–141 and 164–166; `TDH.MMIO.*` 154–160; anchor → §5.4.1.2 | CORRECT | ABI §5.4.1.2 "SEAMCALL Leaf Numbers": 96 `TDH.MIG.STREAM.CREATE`, 97 `TDH.SERVTD.REBIND`, 128 `TDH.IOMMU.SETUP`; 136–141 `TDH.TDI.BIND/CREATE/REMOVE/GET.STATE/START/STOP`; 154–160 `TDH.MMIO.*`; 164–166 `TDH.TDI.MT.*` |
| W12 | **Eight** off-TD debug functions, incl. `TDH.PHYMEM.PAGE.RDMD` | CORRECT | Base spec Table 15.5 has exactly eight rows; the eighth is `TDH.PHYMEM.PAGE.RDMD  Read page metadata (PAMT information)` across all three columns |
| W13 | Intel's CVSS 3.1 **matches** Google's 4.4 / 4.1×3; 5.6 is the CVSS 4.0 score; CVE-2025-31944 at 5.3 | CORRECT | INTEL-SA-01397: 30513 7.9/8.4, 31944 5.3/5.6, 32007 4.4/5.6, 32467 4.1/5.6, 27572 4.1/5.6, 27940 4.1/5.6 |

## `14-nested-virtualization.md`

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| #31 | I/O bitmaps A and B, **4 KBytes each**, 8 KBytes the pair | CORRECT | SDM 3C §27.6.4: "the 64-bit physical addresses of I/O bitmaps A and B (**each of which are 4 KBytes in size**)" |
| #78 | Block extended to **492H** IA32_VMX_PROCBASED_CTLS3 and **493H** IA32_VMX_EXIT_CTLS2 | CORRECT | Vol.3D A.3.4 "The IA32_VMX_PROCBASED_CTLS3 MSR (index 492H)"; A.4.2 "The IA32_VMX_EXIT_CTLS2 MSR (index 493H)"; both in Vol.4 Table 2-2 immediately after 491H |
| #89 | Nested exposure is **not** by itself incompatible with dynamic memory | CORRECT — and the excerpt is verbatim | Learn: "When Hyper-V is running inside a virtual machine, the virtual machine must be turned off to adjust its memory. Meaning that even if dynamic memory is enabled, the amount of memory doesn't fluctuate. **Simply enabling nested virtualization has no effect on dynamic memory or runtime memory resize.** […] **The incompatibility only occurs while Hyper-V is running in the VM.**" The claim's ellipsis elides only the "For virtual machines without dynamic memory enabled…" sentence |
| #90 | L1 live migration **is** supported, via `HV_X64_MSR_REENLIGHTENMENT_CONTROL` | CORRECT — verbatim | TLFS *Nested Virtualization* → "Compatibility with Live Migration": "Hyper-V has the ability to live migrate a child partition from one host to another host… in the case of nested virtualization, the L1 hypervisor may need to be aware of migrations." → "Live Migration Notification": "This capability is enumerated in CPUID as 'AccessReenlightenmentControls' privilege. The L0 hypervisor exposes a synthetic MSR (HV_X64_MSR_REENLIGHTENMENT_CONTROL)…", `#define HV_X64_MSR_REENLIGHTENMENT_CONTROL (0x40000106)` |
| #97 | No fourth level; "Microsoft supports one level of nesting, including in production for Hyper-V on Hyper-V" | CORRECT | The hyper-v-on-windows copy gives "Production environments running Hyper-V VMs running on Hyper-V VMs are supported"; the **windows-server** copy of the same article carries the other half literally: "**One level of nested virtualization is supported in production**, which allows for isolated container deployments" |
| #91 | Enlightened VMCS mechanics added | CORRECT | TLFS: "Each enlightened VMCS is exactly one page (4 KB) in size and must be initially zeroed"; "writing 1 to the corresponding field in the Virtual Processor Assist Page"; "Another field in the VP assist page controls the currently active enlightened VMCS"; the "Clean Fields" subsection |

## `15-security.md` / `17-windows-platform.md`

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| S19 | All seven SPEC_CTRL extension bits come from **one** leaf, CPUID.07H.02H:EDX, and the U/S pairs share a bit | CORRECT | Vol.4 Table 2-2 enumeration column: PSFD←EDX[0]; IPRED_DIS_U **and** IPRED_DIS_S←EDX[1]; RRSBA_DIS_U **and** RRSBA_DIS_S←EDX[2]; DDPD_U←EDX[3]; BHI_DIS_S←EDX[4]; bit 9 Reserved |
| S27 | SKIP_L1DFL_VMENTRY guidance is addressed to **first-level** VMMs | CORRECT | Intel L1TF guidance: "**First-level VMMs** that perform an L1D flush before VMENTER may set SKIP_L1DFL_VMENTRY in the IA32_ARCH_CAPABILITIES value exposed to guests. These VMMs should set SKIP_L1DFL_VMENTRY in any case where a nested VMM may be present." The claim's added gloss — that this is what a nested VMM inside the guest then reads — is the advisory's own second sentence |
| S101 | Re-anchored VT-d `Ch.6` → `§3.2` / `§3.4` | CORRECT | §3.2 "Domains and Address Translation": "A domain is abstractly defined as an isolated environment in the platform…"; §3.4 "Mapping Devices to Domains". Ch.6 is "Caching Translation Information" |
| **W20** | **VP assist page holds `EnlightenVmEntry` and `CurrentNestedVmcs`, not the enlightened VMCS** | **INCOMPLETE — fixed in this pass** | The *claim* is right and matches `HV_VP_ASSIST_PAGE` (`ApicAssist`, `VtlControl`, `NestedEnlightenmentsControl`, `BOOLEAN EnlightenVmEntry`, `HV_GPA CurrentNestedVmcs`, `VirtualizationFaultInformation`) and the TLFS text. But the corrected error survived **twice more in the same chapter**: the §17.2.5 synthetic-MSR table still read "0x40000073 \| VP assist page, **which also carries the enlightened VMCS**" — the exact sentence W20 set out to remove — and §17.9 still said "the enlightened VMCS **in** the VP assist page". Both rewritten: the table row now reads "VP assist page: EOI assist, VTL control, and the `EnlightenVmEntry` / `CurrentNestedVmcs` controls that select an enlightened VMCS (§17.2.3)", and §17.9 now says "selected through the VP assist page" |
| W26 | 0x40000000–0x400000FF is a **CPUID leaf** range | CORRECT | TLFS feature discovery: "This determines the semantics of the leaves from `0x40000002` through `0x400000FF`". Synthetic MSRs sit above it: `0x40000114` / `0x40000115` STIME_UNHALTED (timers page), the nested block from `0x40001002` |
| W35 | Core scheduler's stated reason is **isolation** | CORRECT — verbatim | `[485]`: "It **creates a strong security boundary for guest workload isolation**. Guest virtual processors can only run on underlying physical core pairs, reducing vulnerability to side-channel snooping attacks." |
| W36 | Root scheduler: heterogeneous cores yes; **foreground work and power policy never mentioned** | CORRECT — verbatim | `[485]`: "the hypervisor gives the root partition control of work scheduling"; "the NT scheduler manages all aspects of assigning work to system logical processors"; reasons "support virtualization-based security and WDAG workload isolation" and "properly operate future systems with heterogenous core architectures"; "the only supported hypervisor scheduler configuration for client systems". No "foreground" and no "power" anywhere on the page |
| W43 / §17.1 | Microsoft's own statement carries no VMX vocabulary; the VMXON step labelled as the Intel-side reading | CORRECT | KB wording "only one software component at a time can use this hardware. Virtualization applications can't share the hardware" |
| W46 | `WHV_RUN_VP_EXIT_REASON` has **fourteen** values | CORRECT | `WHvRunVirtualProcessor.md` names thirteen (incl. `X64ApicEoi`), `WHvExitContextDataTypes.md` names thirteen (incl. `X64Rdtsc`); the union is exactly the fourteen the claim lists |
| — | "Microsoft does not support third-party VMMs inside Hyper-V VMs" | CORRECT — verbatim, twice over | "**Virtualization applications other than Hyper-V aren't supported in Hyper-V virtual machines, and are likely to fail**", plus the supported-scenarios entry "Third party virtualization on Hyper-V virtualization isn't supported, ensure your hypervisor vendor supports this scenario". Both §17.1 and §17.7 quote the first sentence accurately |

## `16-performance.md`, `18-comparison-amd-arm-riscv.md`, `90-dated-landscape.md`, `core-facts.md`, `errata.md`

| # | Correction as applied | Verdict | Evidence |
|---|---|---|---|
| 18.2.1 | `VM_CR` LOCK: not a "next reset" rule — cleared only through the SVM_KEY MSR | CORRECT — verbatim | APM §15.30.1: "**LOCK—Bit 3.** When this bit is set, writes to LOCK and SVMDIS are silently ignored… Once set, LOCK can only be cleared using the SVM_KEY MSR (See Section 15.31.) This bit is not affected by INIT or SKINIT." SVMDIS is bit 4, as the claim says |
| 18.3.2 / 18.10 | AMD **has** PCID; both vendors run two namespaces | CORRECT | APM §5.5.1 "Process Context Identifier": "When enabled (by setting CR4.PCIDE=1), the processor associates the current 12-bit PCID with each TLB mapping it creates… The current PCID is the value in CR3[11:0]… PCID-tagged TLB contents may also be managed using the INVPCID instruction… The presence of PCID functionality is indicated by CPUID Function 1, ECX[PCID]=1." CR4 bit 17 is PCIDE in the CR4 table |
| 18.3.1 | "Rapid virtualization indexing" clause removed; replaced with §15.25.3's own sentence | CORRECT | "Rapid Virtualization" / "RVI" occur **0** times in APM rev 3.45; §15.25.3 does contain "uses the same paging mode as the VMM used when it executed the most recent VMRUN" |
| 18.7.4 | VMPL count is implementation-reported, not architectural | CORRECT | APM §15.36.7: "VMPLs are identified numerically starting at 0 with VMPL0 being the most privileged. The number of VMPLs available in an implementation is indicated in **bits 15:12 of CPUID Fn8000_001F[EBX]**" |
| 18.8 | `HPFAR_EL2` scoped to the listed fault classes | CORRECT | DDI 0601: written for "A Translation fault, Access Flag fault, or Address Size fault on a stage 2 translation not on a stage 1 translation table walk" and "A Translation fault, Access Flag fault, Address Size fault, **or Permission fault** on stage 2 translation of an address accessed in a stage 1 translation table walk"; "For all other exceptions taken to EL2, this register is UNKNOWN." The claim's summary is faithful; it omits only the FEAT_RME GPC case, and it does say "some" |
| 18.8.1 | EL2 syndrome registers are the exception to "hardware does not overwrite" | CORRECT | DDI 0601: "Execution at EL1 or EL0 makes HPFAR_EL2 become UNKNOWN", and the same construction for FAR_EL2 |
| 18.5 / 18.5.1 / 18.11 | #VE re-anchored `§27.6.19` → `§28.5.8` (and `§28.5.8.1`) | CORRECT | Vol.3C §28.5.8 "Virtualization Exceptions", §28.5.8.1 "Convertible EPT Violations" |
| 18.3.1 | Pointers `§16.3.2` → `§16.8.2` / `§16.8.5` | CORRECT | both headings exist and carry the walk cost and the large-page mitigation; §16.3.2 is the VBS gaming figures |
| core-facts D1 | Single-ASID bullet rewritten | CORRECT | follows from the APM §5.5.1 reading above |
| core-facts D5 | Posted-interrupt descriptor **2016H**, notification vector **0002H** | CORRECT | Vol.3D Table B-1 (16-bit control fields) and Table B-4. The raw extraction desynchronises Table B-1's Encoding column — read against the index column, VPID(0) = 00000000H, notification vector(1) = **00000002H**, EPTP index(2) = 00000004H; Table B-4 gives `Posted-interrupt descriptor address (full) … 00002016H` |
| errata E19 | Extended with the mirror-image error | CORRECT | follows from 18.3.2 |
| 90.1.2 | Retagged `[GA]` → `[announced]`, rewritten as a scheduled rollout | CORRECT | the claim now states the 2026-10 date as future relative to the file's 2026-09-16 as-of date and says why; internally consistent |

---

## Cross-chapter sweep

Because the one defect found was a *surviving instance* of a corrected error rather than a bad
replacement value, every other correction in the batch was also swept for leftovers across all 22
reference files. Searched for and **not** found anywhere: "single ASID" / AMD-single-namespace
framing, an 8-KByte I/O bitmap, a TDX Connect leaf base of 96, a 480H–491H capability block,
`SSPTPTR at bits 63:12` in the scalable-mode entry, `FSPTPTR is bits 191:140`, "each enumerated by
its own CPUID leaf", "nested VMMs specifically", a seven-function off-TD debug set, "CVSS 3.1 5.6",
the mandatory phrasing of fault compression, "Rev 5.20 … renamed", four architectural VMPLs, and
"rapid virtualization indexing". The only hits were the two in `17-windows-platform.md` recorded
under W20, now fixed.

## Not re-checked this pass

These corrections rest on secondary sources — benchmark papers, CVE advisories, kernel source
trees, vendor product pages — rather than on a specification. Their sources were not re-opened,
so they carry **no verdict** here rather than a clean one:

`14` #6 (Turtles VMCS-naming census) and #34 (KVM `kvm_calc_nested_tsc_offset`);
`16` the five WRONG (NOVA host part, IBM RC25482 Linpack figures, the linux-kvm.org wiki
conditions, the IPI-virtualization attribution, the §16.2.5 scoping) and the §16.3.2 UNSUPPORTED;
`15` / `17` the CVE, quotation and vendor-page corrections S10, S43, S44, S46, S48, S59, S61–S64,
S72, S75, S76, S78, S81, S83, S90, S91, S98, S106, W8, W10, W12, W18, W25, W48, W58, W59, W61,
W73, W75, W85, W86, W92, W96, W98, and the three VBS overhead attributions;
`core-facts` D2–D4 (chapter-ownership drift, checkable only against the chapters themselves,
which were not in dispute).

`12` / `13` W5 and W6 are a partial case, recorded as such above.

## Lint

`node tools/lint.mjs intel-vt` → **clean** — 22 chapter files, 318 bibliography entries,
2645 distinct claims. (`index.json` was rebuilt with `tools/build.mjs` after the chapter-17 edit.)
