# Chapter 09 (`references/09-smm-seam.md`) — exhaustive verification against the Intel SDM

**Scope.** Every claim line in `intel-vt/references/09-smm-seam.md`, checked one by one against the
primary PDFs. No sampling. Date of check: 2026-09-20.

**Sources downloaded and text-extracted** (`pdftotext -layout`, plus a raw pass to defeat the column
scrambling that `-layout` produces on Intel's tables):

| Bib | Document | URL | Retrieved |
|---|---|---|---|
| [1] | SDM Vol.3C, Order 326019-092US, June 2026 (cover verified) | https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf | 2026-09-20, 2,178,770 bytes |
| [2] | SDM Vol.3D, Order 332831-092US, June 2026 (cover verified) | https://cdrdv2.intel.com/v1/dl/getContent/671269 | 2026-09-20 |
| [5] | SDM Vol.4, Model-Specific Registers | https://cdrdv2.intel.com/v1/dl/getContent/671098 | 2026-09-20, 3,004,271 bytes |

The Intel TDX Module Base Architecture Specification was not needed: no claim in this chapter
restates TDX-module behaviour, so the SEAM boundary never had to be resolved outside Vol.3C Ch.35.

**Structure verified in the PDF.** Vol.3C Ch.34 = "SYSTEM MANAGEMENT MODE", Ch.35 = "SECURE
ARBITRATION MODE (SEAM)". The full §34.x / §35.x / §27.6.x heading list was extracted and every
anchor the chapter uses was matched against it. Every anchor resolves to a heading that actually
discusses its claim, with the single exception recorded at C002.

## Verdict counts

| Verdict | Count |
|---|---|
| CONFIRMED | 130 |
| WRONG | 1 — C002, a mis-anchor (the stated fact was right, the section was not) |
| UNSUPPORTED | 0 |
| UNVERIFIABLE | 0 |
| **Claim lines in the file as received** | **129** |
| **Claim lines added during this pass** | **2** (C096, C097) |
| **Rows in the table below** | **131** |

One further change is not a verdict on a claim but a confidence correction: C064 carried an SDM
*recommendation* at `C:high`; it is now `C:medium` with the SDM's own expiry caveat in the text.

## Per-claim table

Line numbers are those of the file **after** the fixes were applied.

| # | Line | Claim (short) | Anchor | Verdict | Evidence / action |
|---|---|---|---|---|---|
| C001 | L22 | Ch.34 = "System Management Mode"; Ch.35 = "Secure Arbitration Mode (SEAM)" | `[SDM 3C Ch.34]` `[SDM 3C Ch.35]` | CONFIRMED | PDF chapter headers read exactly this. **Fixed:** second anchor added — the claim named two chapters but anchored only one. |
| C002 | L23 | SEAM is a VMX extension; foundation for TDX | `[SDM 3C Ch.35]` | **WRONG (mis-anchor)** | The TDX-foundation sentence is in the Ch.35 *preamble*, not in §35.1 "MODES OF OPERATION". **Fixed:** re-anchored §35.1 → Ch.35, and the claim now records the SDM's own spelling "Trusted Domains Extensions". |
| C003 | L32 | Two treatments: default (§34.14), dual-monitor (§34.15) | `[SDM 3C §34.14]` | CONFIRMED | §34.14 "DEFAULT TREATMENT OF SMIS AND SMM WITH VMX OPERATION AND SMX OPERATION"; §34.15 "DUAL-MONITOR TREATMENT OF SMIs AND SMM". |
| C004 | L33 | Dual-monitor support discovered via IA32_VMX_BASIC | `[SDM 3C §34.15]` | CONFIRMED | §34.15 intro: "The dual-monitor treatment may not be supported by all processors. Software should consult the VMX capability MSR IA32_VMX_BASIC (see Appendix A.1)". |
| C005 | L34 | SMRR described in §34.4.2.1 under SMRAM caching | `[SDM 3C §34.4.2.1]` | CONFIRMED | §34.4.2.1 "System Management Range Registers (SMRR)", a sub-section of §34.4.2 "SMRAM Caching"; it forwards detail to §14.11.2.4. |
| C006 | L35 | SDM frames the two-way choice | `[SDM 3C §34.1.1]` | CONFIRMED | §34.1.1: "Default treatment. System firmware handles SMIs… it uses RSM to resume VMX operation" / "Dual-monitor treatment… the former is referred to as executive monitor, the latter SMM-transfer monitor (STM)". |
| C007 | L42 | SMI via SMI# pin or APIC-bus message; nonmaskable external interrupt | `[SDM 3C §34.2]` | CONFIRMED | §34.2 verbatim. |
| C008 | L43 | SMRAM default base 30000H in the internal SMBASE register | `[SDM 3C §34.11]` | CONFIRMED | §34.11 verbatim. |
| C009 | L44 | SMBASE field at offset 7EF8H; RSM reloads it on each exit | `[SDM 3C §34.11]` | CONFIRMED | §34.11 verbatim. |
| C010 | L45 | Handler entry SMBASE+8000H; save area SMBASE+FE00H..FFFFH | `[SDM 3C §34.11]` | CONFIRMED | §34.11 verbatim. |
| C011 | L46 | SMBASE resets to 30000H on RESET, unchanged on INIT | `[SDM 3C §34.11]` | CONFIRMED | §34.11 verbatim. |
| C012 | L47 | MP systems: init software must adjust SMBASE so save areas do not overlap | `[SDM 3C §34.11]` | CONFIRMED | §34.11 verbatim. An obligation on initialization firmware, but SDM-normative, so kept at `C:high`. |
| C013 | L48 | SMM revision identifier at 7EFCH; lower word = base SMM architecture version | `[SDM 3C §34.9]` | CONFIRMED | §34.9 verbatim (Figure 34-2: bit 16 I/O instruction restart, bit 17 SMBASE relocation). |
| C014 | L49 | NMIs blocked on SMI-handler entry; exactly one NMI latched | `[SDM 3C §34.8]` | CONFIRMED | §34.8 verbatim. |
| C015 | L50 | Pending NMI serviced before the next instruction after RSM | `[SDM 3C §34.8]` | CONFIRMED | §34.8 verbatim, including the "unless NMIs were blocked before the SMI" proviso. |
| C016 | L51 | IRET (dummy ISR) unblocks NMIs inside the handler | `[SDM 3C §34.8]` | CONFIRMED | §34.8 verbatim. |
| C017 | L52 | Section map: §34.4.1, §34.4.1.1, §34.5, §34.6, §34.10, §34.12, §34.13 | `[SDM 3C §34.4.1]` | CONFIRMED | All seven headings exist with the titles the claim gives. |
| C018 | L53 | §34.5.3 covers CET interactions | `[SDM 3C §34.5.3]` | CONFIRMED | §34.5.3 "Control-flow Enforcement Technology Interactions" (SSP saved, CR4.CET cleared on SMM entry). |
| C019 | L54 | §34.16 XSAVE state; §34.17/.1/.2/.3 model-specific enhancements | `[SDM 3C §34.16]` | CONFIRMED | Headings match: §34.17.1 SMM Handler Code Access Control, §34.17.2 SMI Delivery Delay Reporting, §34.17.3 Blocked SMI Reporting. |
| C020 | L64 | Default SMI delivery saves CR4.VMXE, the VMX-operation indication and the current-VMCS pointer; leaves VMX operation | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 pseudocode verbatim. |
| C021 | L65 | VMX-critical state = SS.DPL, RFLAGS.VM, STI/MOV-SS blocking, virtual-NMI blocking, pending MTF | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1, five items, with virtual-NMI blocking qualified "only if the processor is in VMX non-root operation and the 'virtual NMIs' VM-execution control is 1". |
| C022 | L66 | CR4.VMXE := 0 before ordinary SMI delivery | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 pseudocode ordering. |
| C023 | L67 | Invalidate VPID 0000H mappings for all PCIDs and all EPTRTA values | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 verbatim. |
| C024 | L68 | "enable EPT" saved to bit 0 of the 32-bit field at SMBASE+8000H+7EE0H (= SMBASE+FEE0H) | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 verbatim; arithmetic checks (8000H + 7EE0H = FEE0H). |
| C025 | L69 | EPTP saved to the 64-bit field at SMBASE+8000H+7ED8H (= SMBASE+FED8H) | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 verbatim; 8000H + 7ED8H = FED8H. |
| C026 | L70 | No VMX non-root control can cause a VM exit in SMM under the default treatment | `[SDM 3C §34.14.1]` | CONFIRMED | §34.14.1 closing paragraph verbatim. |
| C027 | L77 | RSM restores SMRAM state plus the VMX state saved at SMI delivery | `[SDM 3C §34.14.2]` | CONFIRMED | §34.14.2 "Default Treatment of RSM" pseudocode. |
| C028 | L78 | §34.14.3 CR4.VMXE protection; §34.14.4 VMXOFF and SMI unblocking | `[SDM 3C §34.14.3]` | CONFIRMED | Both headings exist with those titles. |
| C029 | L79 | IA32_SMM_MONITOR_CTL[2]=1 stops VMXOFF unblocking SMIs regardless of bit 0 | `[SDM 3C §34.14.4]` | CONFIRMED | §34.14.4 footnote 1 verbatim: "…regardless of the value of the register's valid bit (bit 0)." §34.15.5 corroborates: "the value of bit 0 is irrelevant". |
| C030 | L89 | Dual-monitor treatment = executive monitor + STM co-operation | `[SDM 3C §34.15]` | CONFIRMED | §34.15 intro verbatim. |
| C031 | L90 | Control to the STM via VM exits; return via VM entry, never RSM | `[SDM 3C §34.15.1]` | CONFIRMED | §34.15.1: "The STM returns from SMM, not by using the RSM instruction, but by using a VM entry that returns from SMM." |
| C032 | L91 | STM runs in VMX root operation and runs its own guests, inside SMM | `[SDM 3C §34.15.1]` | CONFIRMED | §34.15.1 verbatim; expanded in §34.15.3. |
| C033 | L92 | Cannot leave VMX operation while dual-monitor is active; VMXOFF fails | `[SDM 3C §34.15.1]` | CONFIRMED | §34.15.1 verbatim. |
| C034 | L96 | An SMM VM exit begins outside SMM and ends in SMM | `[SDM 3C §34.15.2]` | CONFIRMED | §34.15.2 verbatim. |
| C035 | L97 | SMM VM exits may begin in VMX root; caused by an SMI or by VMCALL in root outside SMM | `[SDM 3C §34.15.2]` | CONFIRMED | §34.15.2 verbatim. |
| C036 | L98 | VMCALL causes an SMM VM exit only if the IA32_SMM_MONITOR_CTL valid bit is set | `[SDM 3C §34.15.2]` | CONFIRMED | §34.15.2 verbatim. |
| C037 | L99 | SMIs causing SMM VM exits do so directly; no SMRAM state save | `[SDM 3C §34.15.2.1]` | CONFIRMED | §34.15.2.1 verbatim. |
| C038 | L106 | SMM-transfer VMCS and SMM-transfer VMCS pointer, established at activation | `[SDM 3C §34.15.1]` | CONFIRMED | §34.15.1 closing paragraph verbatim. |
| C039 | L107 | Step 1: executive-VMCS pointer field ← current-VMCS pointer (non-root) or VMXON pointer (root) | `[SDM 3C §34.15.2.2]` | CONFIRMED | §34.15.2.2 step 1 verbatim. |
| C040 | L108 | Step 2: current-VMCS pointer ← SMM-transfer VMCS pointer; that VMCS records exit info and governs the exit | `[SDM 3C §34.15.2.2]` | CONFIRMED | §34.15.2.2 step 2 and the paragraph that follows it. |
| C041 | L109 | The executive-VMCS pointer is the VMCS field of §27.6.10 | `[SDM 3C §27.6.10]` | CONFIRMED | §27.6.10 "Executive-VMCS Pointer" — a 64-bit field used in the dual-monitor treatment. Anchor resolves to exactly this subject. |
| C042 | L110 | §34.15.4.1 gives the checks on the executive-VMCS pointer field | `[SDM 3C §34.15.4.1]` | CONFIRMED | §34.15.4.1 "Checks on the Executive-VMCS Pointer Field": bits 11:0 zero, within the physical-address width, VMCS revision identifier. |
| C043 | L114 | Basic exit reason 5 = I/O system-management interrupt (SMI) | `[SDM 3D App.C]` | CONFIRMED | Vol.3D Table C-1 entry 5 verbatim: "An SMI arrived immediately after retirement of an I/O instruction and caused an SMM VM exit (see Section 34.15.2)." |
| C044 | L115 | Basic exit reason 6 = Other SMI | `[SDM 3D App.C]` | CONFIRMED | Table C-1 entry 6 verbatim. |
| C045 | L116 | Basic exit reason 18 = VMCALL, also produced by SMM VM exits from the executive monitor | `[SDM 3D App.C]` | CONFIRMED | Table C-1 entry 18: "…or by the executive monitor (causing an SMM VM exit; see Section 34.15.2)." |
| C046 | L117 | Exit-reason bit 29 set by SMM VM exits from VMX root operation | `[SDM 3C §34.15.2.3]` | CONFIRMED | §34.15.2.3 verbatim; Table 27-19 corroborates ("set if and only if the processor was in VMX root operation… can happen only for SMM VM exits"). |
| C047 | L118 | Exit-reason bit 28 set for a non-root SMM VM exit with a pending MTF | `[SDM 3C §34.15.2.3]` | CONFIRMED | §34.15.2.3 verbatim; Table 27-19 bit 28 "Pending MTF VM exit". |
| C048 | L119 | An SMM VM exit clears exit-reason bits 27:16 and 31:30 | `[SDM 3C §34.15.2.3]` | CONFIRMED | §34.15.2.3 verbatim. Bits 25/26/27 carry meaning for *other* VM exits per Table 27-19, so the claim's scoping to SMM VM exits is load-bearing and correct. |
| C049 | L120 | Exit qualification carries I/O-instruction information for I/O SMIs | `[SDM 3C §34.15.2.3]` | CONFIRMED | §34.15.2.3 plus Table 34-9 (size 2:0, direction 4, string 5, REP 6, operand encoding 15:7, port 31:16). |
| C050 | L127 | §34.15.4 VM entries that return from SMM, with the four named sub-sections | `[SDM 3C §34.15.4]` | CONFIRMED | §34.15.4.1 executive-VMCS pointer, .2 VM-execution control fields, .3 VM-entry control fields, .4 guest-state area. |
| C051 | L128 | §34.15.4.9 SMI blocking | `[SDM 3C §34.15.4.9]` | CONFIRMED | §34.15.4.9 "SMI Blocking". |
| C052 | L129 | A VM entry returning from SMM updates both pointers | `[SDM 3C §34.15.4.7]` | CONFIRMED | §34.15.4.7 "Updating the Current-VMCS and SMM-Transfer VMCS Pointers". |
| C053 | L133 | STM code and data live in MSEG; SMM code locates it, fills it, enables the treatment | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 opening paragraph verbatim. |
| C054 | L134 | IA32_SMM_MONITOR_CTL index 9BH | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim; Vol.4 Table 2-2 lists "Register Address: 9BH, 155 IA32_SMM_MONITOR_CTL". |
| C055 | L135 | Bit 0 valid bit; VMCALL invocation requires it; cleared on reset | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim. |
| C056 | L136 | Bit 1, bits 11:3 and bits 63:32 reserved | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim; Vol.4 Table 2-2 agrees bit for bit. |
| C057 | L137 | Bits 31:12 shifted left 12 = MSEG physical base | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim; Vol.4 Table 2-2 "31:12 MSEG Base (R/W)". |
| C058 | L138 | Certain GETSEC leaf functions clear bit 2 | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim. |
| C059 | L139 | WRMSR raises #GP(0) outside SMM or on a reserved-bit write | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim. |
| C060 | L140 | MSEG header = 32 bytes at the MSEG base, each field 32 bits | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 plus the Table 34-10 caption "(each field is 32 bits)". |
| C061 | L155 | MSEG header offsets 0/4/8/12/16/20/24/28 | `[SDM 3C §34.15.5]` | CONFIRMED | Table 34-10 exactly: revision id, STM features, GDTR limit, GDTR base offset, CS selector, EIP offset, ESP offset, CR3 offset. |
| C062 | L156 | Bit 0 of the STM features field = IA-32e mode SMM feature bit | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim (bits 31:1 reserved and must be zero). |
| C063 | L157 | MSEG revision identifier discovered via IA32_VMX_MISC | `[SDM 3C §34.15.5]` | CONFIRMED | §34.15.5 verbatim. |
| C064 | L158 | MSEG header should be in writeback cacheable memory | `[SDM 3C §34.15.5]` | CONFIRMED (confidence lowered) | §34.15.5 says software *should*, then adds "Future implementations may allow or require a different memory type" and points at IA32_VMX_BASIC. **Fixed:** `C:high` → `C:medium`, caveat written into the claim. Anchor kept — the SDM does say it. |
| C065 | L162 | Activation only if enabled, only by the executive monitor, via VMCALL in VMX root; causes an SMM VM exit | `[SDM 3C §34.15.6]` | CONFIRMED | §34.15.6 verbatim. |
| C066 | L163 | The STM deactivates via a VM entry with "deactivate dual-monitor treatment" = 1 | `[SDM 3C §34.15.7]` | CONFIRMED | §34.15.7 verbatim; also stated in §34.15.1. |
| C067 | L164 | §34.15.3 specifies the operation of the STM itself | `[SDM 3C §34.15.3]` | CONFIRMED | §34.15.3 "Operation of the SMM-Transfer Monitor". |
| C068 | L179 | Default: no exit reason. Dual-monitor: 5 or 6 for an SMI, 18 for the executive monitor's VMCALL | `[SDM 3C §34.15.2]` `[1][2]` | CONFIRMED | §34.14.1 (leaves VMX operation, no VM exit) plus Table C-1 entries 5, 6 and 18. |
| C069 | L186 | SEAM root operation = SEAM extension of VMX root; the software is a SEAM module | `[SDM 3C §35.1]` | CONFIRMED | §35.1 verbatim. |
| C070 | L187 | Loader mode (at most one LP) and module mode (many LPs in parallel) | `[SDM 3C §35.1]` | CONFIRMED | §35.1 verbatim. |
| C071 | L188 | SEAM non-root operation; the software is a SEAM guest; many LPs concurrently | `[SDM 3C §35.1]` | CONFIRMED | §35.1 verbatim. |
| C072 | L189 | Definition of the SEAM-guest VMCS | `[SDM 3C §35.1.3]` | CONFIRMED | §35.1.3 "SEAM Host-Guest Transitions" verbatim. |
| C073 | L190 | SEAM-guest KeyID and SEAM shared EPT pointer are the SEAM-specific VMCS fields | `[SDM 3C §35.1.3]` | CONFIRMED | §35.1.3 verbatim; §27.6.26 corroborates (KeyID 32-bit, shared EPTP 64-bit, Table 27-13 layout). |
| C074 | L191 | "SEAM guest-physical address width" via IA32_VMX_PROCBASED_CTLS3; "allow SEAM-guest telemetry" is a VM-entry control via IA32_VMX_ENTRY_CTLS | `[SDM 3C §35.1.3]` | CONFIRMED | §35.1.3 verbatim. |
| C075 | L192 | SEAM guests require EPT; VM entry fails if "enable EPT" is clear | `[SDM 3C §35.1.3]` | CONFIRMED | §35.1.3 verbatim. |
| C076 | L193 | SEAM non-root VMCS field group at §27.6.26 | `[SDM 3C §27.6.26]` | CONFIRMED | §27.6.26 "Fields Controlling SEAM Non-Root Operation". |
| C077 | L200 | SEAM calls: VMX root → SEAM root via SEAMCALL, similar to an SMM VM exit from VMCALL | `[SDM 3C §35.1.1]` | CONFIRMED | §35.1.1 verbatim. |
| C078 | L201 | A SEAM call uses a SEAM-transfer VMCS inside the SEAM range | `[SDM 3C §35.1.1]` | CONFIRMED | §35.1.1 verbatim. |
| C079 | L202 | RAX[63] = 0 → module mode; otherwise loader mode | `[SDM 3C §35.1.1]` | CONFIRMED | §35.1.1 verbatim; the §35.5 SEAMCALL page states the same rule from the other side ("if this value is 1… loader-mode"). |
| C080 | L203 | Loader-mode entry fails if another LP is in SEAM having entered in loader mode | `[SDM 3C §35.1.1]` | CONFIRMED | §35.1.1 verbatim. |
| C081 | L204 | SEAM returns: SEAM root → VMX root via SEAMRET, using the SEAM-transfer VMCS | `[SDM 3C §35.1.2]` | CONFIRMED | §35.1.2 verbatim. |
| C082 | L205 | A loader-mode SEAM return flushes VMCS data to memory; no current VMCS afterwards | `[SDM 3C §35.1.2]` | CONFIRMED | §35.1.2 verbatim. |
| C083 | L216 | SEAMCALL = 66 0F 01 CF; 64-bit mode, in VMX operation, outside SEAM and outside SMM | `[SDM 3C §35.5]` | CONFIRMED | §35.5 SEAMCALL opcode table and Description verbatim. |
| C084 | L217 | SEAMCALL in VMX non-root → VM exit, basic exit reason 76 | `[SDM 3C §35.5]` | CONFIRMED | §35.5 "execution causes a VM exit with exit reason 76, SEAMCALL"; Vol.3D Table C-1 entry 76 = SEAMCALL (read in raw order: 73 ENQCMDS, 74 bus lock, 75 instruction timeout, 76 SEAMCALL, 77 TDCALL). |
| C085 | L218 | #GP if IA32_SEAMRR_MASK[11] = 0 or immediately after MOV to SS / POP SS | `[SDM 3C §35.5]` | CONFIRMED | §35.5 verbatim; pseudocode "IA32_SEAMRR_MASK.VALID = 0 or events blocked by MOV SS → #GP(0)". |
| C086 | L219 | VMFailInvalid if SEAM is globally disabled, or loader mode requested while another LP is in loader mode | `[SDM 3C §35.5]` | CONFIRMED | §35.5 Description and Operation pseudocode. (The SDM also returns VMFailInvalid when the requested sub-mode is "not ready for execution"; the claim does not contradict that.) |
| C087 | L220 | TDCALL = 66 0F 01 CC; VM exit from SEAM non-root to SEAM root | `[SDM 3C §35.5]` | CONFIRMED | §35.5 TDCALL page. TDCALL executed in ordinary VMX non-root also exits, with reason 77 — not contradicted by the claim. |
| C088 | L221 | SEAMOPS only in SEAM root; some operations loader-mode only | `[SDM 3C §35.5]` | CONFIRMED | §35.5 verbatim. |
| C089 | L222 | SEAMRET privileged, SEAM root → VMX root, uses the SEAM-transfer VMCS | `[SDM 3C §35.5]` | CONFIRMED | §35.5 verbatim; §35.3.1 adds that executing it outside SEAM root raises #UD. |
| C090 | L223 | A SEAM instruction on a non-SEAM processor → #UD | `[SDM 3C §35.5]` | CONFIRMED | §35.5 verbatim. |
| C091 | L224 | SEAMOPS/SEAMRET leaf detail delegated to Intel TDX CPU Architectural Extensions | `[SDM 3C §35.5]` | CONFIRMED | §35.5: "Details are given in Intel Trust Domain CPU Architectural Extensions"; §35.3.1 repeats it. |
| C092 | L228 | SEAM range; IA32_SEAMRR_BASE 1400H, IA32_SEAMRR_MASK 1401H | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim; Vol.4 Table 2-2 lists 1400H/5120 and 1401H/5121. |
| C093 | L229 | Enumerated by IA32_MTRRCAP (FEH) bit 15 | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim; Vol.4 Table 2-2 IA32_MTRRCAP bit 15 "SEAMRR supported when set". |
| C094 | L230 | SEAM range = module sub-range + loader sub-range | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim. |
| C095 | L231 | IA32_SEAMRR_MASK bit 11 = range valid and protected | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim; Vol.4 names the bit VALID. |
| C096 | L232 | **ADDED** — IA32_SEAMRR_BASE field layout | `[SDM 4 §2.1]` | CONFIRMED (new claim) | Vol.4 Table 2-2: 2:0 reserved; 3 CONFIGURED ("When set to 1, the SEAM range is configured"); 24:4 reserved; M-1:25 BASE with M = CPUID.80000008H:EAX[7:0]; comment "Bits M-1:M-k must be 0, where k = IA32_TME_ACTIVATE.MK_TME_KEYID_BITS". Added because the chapter gave the address but not the layout. |
| C097 | L233 | **ADDED** — IA32_SEAMRR_MASK field layout | `[SDM 4 §2.1]` | CONFIRMED (new claim) | Vol.4 Table 2-2: 9:0 reserved; 10 LOCK ("When the LOCK bit is set, the IA32_SEAMRR_BASE/MASK registers are non-writable"); 11 VALID ("Returns 1 when SEAM range protections are active"); 24:12 reserved; M-1:25 MASK ("Mask value for SEAMRR matching. Lowest granularity is 32MB"). |
| C098 | L234 | Outside SEAM root: SEAM-range accesses aborted (writes ignored, reads all-ones) | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim (the SDM conditions the whole list on MASK[11] = 1). |
| C099 | L235 | In SEAM root: module sub-range allowed; loader sub-range only in loader mode | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim. |
| C100 | L236 | In SEAM root: instruction fetch outside the SEAM range prevented, response implementation-specific | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim. |
| C101 | L237 | SEAM range encrypted by TME-MK with a machine-specific, typically ephemeral key | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim. |
| C102 | L238 | WB when CR0.CD = 0 regardless of MTRR and PAT; UC when CR0.CD = 1 | `[SDM 3C §35.4.1]` | CONFIRMED | §35.4.1 verbatim. |
| C103 | L247 | IA32_TME_ACTIVATE = 982H; TME active when [1:0] = 11B | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim. |
| C104 | L248 | MK_TME_KEYID_BITS = bits 35:32; TME-MK active when TME active and the value > 0 | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim. |
| C105 | L249 | TDX_RESERVED_KEYID_BITS = bits 39:36; never exceeds MK_TME_KEYID_BITS | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim; the §34.15.4.1 footnote repeats the relationship. |
| C106 | L250 | IA32_MKTME_KEYID_PARTITIONING = 87H; NUM_MKTME_KIDS 31:0, NUM_TDX_PRIV_KIDS 63:32 | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim. |
| C107 | L251 | SEAM-private KeyIDs NUM_MKTME_KIDS+1 … +NUM_TDX_PRIV_KIDS; general-use 1 … NUM_MKTME_KIDS | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim (0 is not a TME-MK KeyID). |
| C108 | L252 | KeyID occupies bits m-1:m-k; only (m-k)-1:0 address memory | `[SDM 3C §35.2]` | CONFIRMED | §35.2 verbatim. |
| C109 | L258 | VMXOFF or VMCALL in SEAM root → #GP(0) | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim, including the "cannot invoke an SMM-transfer monitor using an SMM VM exit" consequence. |
| C110 | L259 | Entry to SEAM root blocks NMIs; IRET unblocks normally | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim. |
| C111 | L260 | SMIs, uncore machine checks and MSMIs masked in SEAM root; delivered after leaving | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim. |
| C112 | L261 | Triple faults and poisoned-cacheline machine checks → unbreakable shutdown | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim. |
| C113 | L262 | "in SEAM" TLB tag; invalidated with INVEPT, not INVVPID | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim. |
| C114 | L263 | SEAM-only MSRs; access outside SEAM → #GP(0) | `[SDM 3C §35.3.1]` | CONFIRMED | §35.3.1 verbatim. |
| C115 | L270 | SMIs/MSMIs in SEAM non-root cause a VM exit; stay pending until after the next SEAM return | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C116 | L271 | GPA width 48 if the "SEAM guest-physical address width" control is 0, even with 5-level EPT | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C117 | L272 | A GPA setting bits 51:48 → EPT violation | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C118 | L273 | SHARED bit = uppermost GPA bit (47 or 51); clear = private, set = shared | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C119 | L274 | Instruction fetch from a shared address → #GP(0) | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C120 | L275 | CR3 and PAE PDPTE registers must hold private addresses; otherwise #GP(0) | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C121 | L276 | A paging structure at a shared address → #PF with error-code bit 3 set | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim ("indicating that a reserved bit was set"). |
| C122 | L277 | Private translation uses EPTP; bits M-1:M-k replaced by KeyID bits k-1:0 | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim, for both EPT-structure accesses and the final physical address. |
| C123 | L278 | Shared translation uses the SEAM shared EPT pointer; EPTP bits 7:0 still control it | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C124 | L279 | A SEAM-private KeyID in a shared-translation structure or final address → EPT misconfiguration | `[SDM 3C §35.3.2]` | CONFIRMED | §35.3.2 verbatim. |
| C125 | L283 | Outside SEAM: CR/MSR load with a SEAM-private KeyID → #GP(0); IA32_RTIT_OUTPUT_BASE checked separately | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim (RTIT is checked when TraceEn = 1, including ToPA output buffers). |
| C126 | L284 | Non-EPT linear translation → #PF; EPT guest-physical translation → EPT misconfiguration | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim. |
| C127 | L285 | VM entry fails on a SEAM-private KeyID from any VMCS field except the SEAM shared EPT pointer | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim. |
| C128 | L286 | A VMX instruction operand with a SEAM-private KeyID fails as if a reserved bit were set | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim. |
| C129 | L287 | IA32_APIC_BASE with a non-zero KeyID → #GP(0) | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim. Note the SDM says *any* non-zero KeyID, not only SEAM-private ones; the claim states it correctly. |
| C130 | L288 | A cacheline written under a SEAM-private KeyID cannot be read under a different KeyID | `[SDM 3C §35.4.2]` | CONFIRMED | §35.4.2 verbatim. |
| C131 | L297 | Platform operations needed to enable SEAM are documented in Intel TDX CPU Architectural Extensions | `[SDM 3C §35.1]` | CONFIRMED | §35.1: "Details regarding this enabling are provided in the Intel Trust Domain CPU Architectural Extensions". |

## Findings in full

### 1. C002 — mis-anchor (the only WRONG)

The claim read: *"SEAM is specified by the SDM as an extension of VMX operation, and the SDM states
that the SEAM architecture is used as the foundation for the Trust Domain Extensions (TDX)
architecture."* anchored `[SDM 3C §35.1]`.

§35.1 is "MODES OF OPERATION". It supports the first half ("The SEAM architecture defines a
protected mode of operation called SEAM, which is an extension of VMX operation") but says nothing
about TDX. The TDX sentence is in the **Ch.35 preamble**, which precedes §35.1:

> This chapter specifies secure arbitration mode (SEAM), an extension of the virtual machines
> extensions architecture (VMX) that allows running secure virtual machines.
> The SEAM architecture is used as a foundation for Trusted Domains Extensions (TDX) architecture.

Re-anchored to `[SDM 3C Ch.35]`, which covers both halves of the claim. The claim now also records
that the preamble uses the non-standard spelling "Trusted Domains Extensions", so a reader checking
the PDF is not thrown by the mismatch.

### 2. C001 — half-anchored chapter-title claim

The claim named both chapter titles but carried only `[SDM 3C Ch.34]`. `[SDM 3C Ch.35]` added.

### 3. C064 — an SDM recommendation carried as an architectural guarantee

§34.15.5 says software *should* keep the MSEG header in writeback cacheable memory, then immediately
adds "Future implementations may allow or require a different memory type" and points at
IA32_VMX_BASIC; a footnote permits UC mapping where memory organisation demands it. That is a
firmware convention with an explicit expiry clause, not an architectural guarantee. Downgraded to
`C:medium`, with the caveat written into the claim text. The anchor is kept, because the SDM does
say it.

### 4. Prose fix — the DMA sentence in §9.7

The paragraph after the SEAMRR claims asserted that "the SEAM range is shielded from device accesses
too". Ch.35 contains no occurrence of DMA, device, IOMMU or remapping: every protection rule in
§35.4.1 is about *processor* accesses. The prose now says so explicitly and attributes device
exclusion to platform configuration outside the chapter, cross-referencing
`10-vtd-dma-remapping.md`. This was prose rather than a claim line, so no schema change was needed —
but left as it stood it was an unanchored architectural assertion attached to a run of anchored ones.

### 5. Gap filled — SEAMRR field layout (C096, C097)

The chapter gave the SEAMRR MSR addresses and MASK bit 11 but no register layout, which the brief
called out as an attention area. Vol.4 Table 2-2 (in §2.1 ARCHITECTURAL MSRS) supplies it, and two
claims were added against `[5]`. One detail in the Vol.4 comment column — "Read-only. Must be
written with 0." — sits ambiguously between the LOCK and VALID rows in both the `-layout` and the
raw text extraction, so it was deliberately omitted rather than guessed at.

## Cross-reference notes (no action taken; for the chapter-13 owner)

- No claim in this chapter restates TDX-module architecture. Everything is ISA-level SEAM: processor
  modes, the SEAM-transfer VMCS, SEAMRR, TME-MK KeyID partitioning, and the four instruction
  definitions in §35.5. The §9.10 boundary statement holds as written.
- C084 (SEAMCALL, exit reason 76) and C087 (TDCALL, exit reason 77 in Vol.3D Table C-1) are where
  this chapter touches the nested and TDX chapters; both already carry cross-references, which is
  also what keeps the linter's ownership rule quiet.

## Things checked that produced no finding

- **Every numeric value**: 30000H, 7EF8H, 7EFCH, SMBASE+8000H, SMBASE+FE00H..FFFFH, SMBASE+FEE0H
  (= 8000H + 7EE0H), SMBASE+FED8H (= 8000H + 7ED8H), MSEG header offsets 0/4/8/12/16/20/24/28,
  32-byte header, 32-bit fields.
- **Every MSR address**: IA32_SMM_MONITOR_CTL 9BH, IA32_SEAMRR_BASE 1400H, IA32_SEAMRR_MASK 1401H,
  IA32_MTRRCAP FEH, IA32_TME_ACTIVATE 982H, IA32_MKTME_KEYID_PARTITIONING 87H — each matched against
  Vol.3C and Vol.4 independently.
- **Every bit position**: SMM_MONITOR_CTL 0 / 1 / 2 / 11:3 / 31:12 / 63:32; SEAMRR_MASK 10 and 11;
  MTRRCAP 15; TME_ACTIVATE 1:0, 35:32, 39:36; MKTME_KEYID_PARTITIONING 31:0, 63:32; exit-reason 15:0,
  27:16, 28, 29, 31:30; EPTP 7:0; GPA 51:48 and SHARED bit 47/51; #PF error-code bit 3; RAX[63];
  STM-features bit 0.
- **Both VMCS anchors outside Ch.34/35**: §27.6.10 is "Executive-VMCS Pointer" and §27.6.26 is
  "Fields Controlling SEAM Non-Root Operation". Neither is a mis-anchor.
- **Exit reasons**: Vol.3D Table C-1 was read in raw reading order to defeat the column scrambling
  `-layout` produces on that table. 5 = I/O SMI, 6 = Other SMI, 18 = VMCALL, 76 = SEAMCALL,
  77 = TDCALL.
- **Dual-monitor transition rules**: the two-step pointer update (§34.15.2.2), the return-path
  pointer update (§34.15.4.7), the executive-VMCS-pointer checks (§34.15.4.1), SMI blocking
  (§34.15.4.9), activation (§34.15.6) and deactivation (§34.15.7) all match the chapter, including
  the rule that a VM entry returning from SMM stays in VMX root operation when the executive-VMCS
  pointer field holds the VMXON pointer.
- **Opcodes**: SEAMCALL 66 0F 01 CF and TDCALL 66 0F 01 CC, from the §35.5 opcode tables. Vol.3C
  gives no opcode for SEAMOPS or SEAMRET, and the chapter correctly prints "—" for both.

## Lint

`node tools/build.mjs intel-vt` was run first so `index.json` tracks the edited chapter, then
`node tools/lint.mjs intel-vt` → **lint clean** — 22 chapter files, 318 bibliography entries,
2524 distinct claims. No warnings.
