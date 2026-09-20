# Adversarial fact-check: `02-vmcs.md`, `05-vm-exit.md`, `08-vmx-instructions.md` vs. the Intel SDM

## Primary sources actually obtained

Both PDFs were downloaded and text-extracted locally with `pdftotext` (layout **and** raw reading
order, because the appendix tables column-desync in layout mode). No claim below rests on memory or
on a secondary source.

| Source | Order no. | Revision / date | URL | Local extract |
|---|---|---|---|---|
| SDM Vol. 3C, *System Programming Guide Part 3* | 326019-092US | rev. 092, June 2026 | `https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf` | `3c.txt` (layout), `3c-r.txt` (raw) |
| SDM Vol. 3D, *System Programming Guide Part 4* | **332831-092US** | rev. 092, June 2026 | `https://cdrdv2.intel.com/v1/dl/getContent/671269` | `3d.txt` (layout), `3d-r.txt` (raw) |

> Note on the task brief: Vol. 3D is order **332831**, not 326019 (326019 *is* Vol. 3C). The URL
> given in the brief resolves correctly to Vol. 3D rev. 092, so this is a cosmetic slip in the brief,
> not a problem with the fetch. Appendices A (capability MSRs), B (VMCS field encodings) and C (basic
> exit reasons) are all present in the fetched Vol. 3D.

**Key SDM structures used as ground truth**

- 3C Table 27-22 — Structure of VMCS Component Encoding (§27.11.2)
- 3C Tables 27-5 … 27-17 — pin/primary/secondary/tertiary VM-execution, VM-exit and VM-entry controls (§27.6–§27.8)
- 3C Tables 30-1 … 30-11 — exit-qualification and instruction-information formats (**§30.2.1 / §30.2.5**)
- 3C Table 33-1 — VM-Instruction Error Numbers (**§33.4**)
- 3C Figures 33-1 / 33-2 — INVEPT and INVVPID descriptors (Ch. 33)
- 3D Appendix A.1–A.11 — capability MSRs
- 3D Appendix B Tables B-1 … B-15 — field encodings
- 3D Appendix C Table C-1 — basic exit reasons

---

## Verdict key

- **CONFIRMED** — the PDF says this, at the cited section.
- **MIS-ANCHOR** — the numeric content is correct, but the cited section does not contain it
  (this is the `UNSUPPORTED` verdict from the brief, applied to an anchor rather than a value).
- **WRONG** — the PDF contradicts the claim.
- **GAP** — the claim is true as far as it goes but presents an incomplete list as complete.
- **UNVERIFIABLE** — could not be located.

---

## 1. Claim-by-claim table

### 1.1 `02-vmcs.md` §2.5.1 — the encoding format

| # | Line | Claim (summary) | Verdict | PDF evidence |
|---|---|---|---|---|
| 1 | 105 | Bit 0 = access type; 0 full, 1 high; high only for 64-bit fields, addressing bits 63:32 | CONFIRMED | 3C Table 27-22: "0 … Access type (0 = full; 1 = high); must be full for 16-bit, 32-bit, and natural-width fields"; §27.11.2: "a VMREAD or VMWRITE using an encoding with this bit set to 1 accesses only the high 32 bits of the field" |
| 2 | 106 | Bits 9:1 = field index | CONFIRMED | 3C Table 27-22 "9:1 … Index"; 3D A.9 "Bits 9:1 is an index field" |
| 3 | 107 | Bits 11:10 = type; 0 control, 1 VM-exit information, 2 guest, 3 host | CONFIRMED | 3C Table 27-22: "Type: 0: control / 1: VM-exit information / 2: guest state / 3: host state". (App. B calls type 1 a "read-only data field" — same thing.) |
| 4 | 108 | Bits 14:13 = width; 0 = 16-bit, 1 = 64-bit, 2 = 32-bit, 3 = natural-width | CONFIRMED | 3C Table 27-22; 3D B.1/B.2/B.3/B.4 opening sentences |
| 5 | 109 | Bit 12 and bits 31:15 reserved, must be 0 | **MIS-ANCHOR** | True (3C Table 27-22: "12 … Reserved (must be 0)", "31:15 … Reserved (must be 0)"; 3D A.9 repeats it), but the cited `[SDM 3D App.B]` never states it. Correct anchor: **3C §27.11.2 Table 27-22** |
| 6 | 110 | Natural-width = 64 bits on Intel 64; 64-bit field reached outside IA-32e via full + high | CONFIRMED | §27.11.2: "Such fields have 64 bits on processors that support Intel 64 architecture and 32 bits on processors that do not"; "Software seeking to read a 64-bit field outside IA-32e mode can use VMREAD with the full access type … and VMREAD with the high access type" |
| 7 | 114 | `0x201A` decodes to access 0, index 13, type 0, width 1 = EPTP | CONFIRMED | 3D Table B-4: "EPT pointer (EPTP; full) · 000001101B · 0000201AH" (index 13) |
| 8 | 115 | Same-type/width fields are 2 apart; EOI-exit bitmaps form a contiguous even run | CONFIRMED | 3D Table B-4, `0x201C`/`0x201E`/`0x2020`/`0x2022` |
| 9 | 128, 130 | The 15 group-base encodings `0x0000`…`0x6C00` | CONFIRMED | 3D Table headings B-1 … B-15 (`0000_00xx…0B`, `0010_00xx…xxxAb`, `0110_11xx…0B`, etc.) |
| 10 | 131 | `0x6400` = exit qualification; `0x2800` = VMCS-link pointer | CONFIRMED | 3D Table B-13 "Exit qualification · 000000000B · 00006400H"; Table B-6 "VMCS link pointer (full) · 000000000B · 00002800H" |
| 11 | 132 | Guest CR0 `0x6800`, host CR0 `0x6C00`, same index, differing type digit | CONFIRMED | 3D Tables B-14, B-15 |

### 1.2 `02-vmcs.md` §2.5.2 — B.1, 16-bit fields

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 12 | 138 | 16-bit control: `0x0000` VPID, `0x0002` PI notification vector, `0x0004` EPTP index | CONFIRMED | 3D Table B-1 |
| 13 | 139 | Guest selectors ES…TR at `0x0800`–`0x080E` | CONFIRMED | 3D Table B-2 |
| 14 | 140 | "Two further" 16-bit guest fields: `0x0810` guest interrupt status, `0x0812` PML index | CONFIRMED (values) / **GAP** | 3D Table B-2 confirms both; the table also lists **`0x0814` Guest UINV** (index 000001010B), so "two further" is no longer exhaustive |
| 15 | 141 | Guest interrupt status: RVI bits 7:0, SVI bits 15:8; anchored §27.4.2 | CONFIRMED (incl. anchor) | 3C §27.4.2 is "Guest Non-Register State", which defines the guest-interrupt-status field |
| 16 | 142 | Host selectors at `0x0C00`–`0x0C0C`, LDTR omitted | CONFIRMED | 3D Table B-3 (7 entries, indices 0–6, no LDTR) |

### 1.3 `02-vmcs.md` §2.5.3 — B.2, 64-bit fields

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 17 | 146 | `0x2000` I/O bitmap A … `0x2010` TSC offset (9 fields) | CONFIRMED | 3D Table B-4 |
| 18 | 147 | `0x2012` virtual-APIC, `0x2014` APIC-access, `0x2016` PI descriptor, `0x2018` VM-function controls, `0x201A` EPTP | CONFIRMED | 3D Table B-4 |
| 19 | 148 | EOI-exit bitmaps 0–3 at `0x201C`, `0x201E`, `0x2020`, `0x2022` | CONFIRMED | 3D Table B-4 |
| 20 | 149 | `0x2024` EPTP-list … `0x202E` ENCLS-exiting bitmap | CONFIRMED | 3D Table B-4 |
| 21 | 150 | `0x2030` SPPTP, `0x2032` TSC multiplier, `0x2034` tertiary controls | CONFIRMED | 3D Table B-4 |
| 22 | 151 | "**The only** 64-bit read-only VM-exit information field is `0x2400`, the guest-physical address" | **WRONG** | 3D Table B-5 lists **three**: "Guest-physical address (full) · 000000000B · 00002400H", "**MSR data (full) · 000000001B · 00002402H**", "**Original-event data (full) · 000000010B · 00002404H**" |
| 23 | 152 | `0x2800` VMCS-link … `0x2808` guest IA32_PERF_GLOBAL_CTRL | CONFIRMED | 3D Table B-6 |
| 24 | 153 | Guest PDPTE0–3 at `0x280A`, `0x280C`, `0x280E`, `0x2810` | CONFIRMED | 3D Table B-6 |
| 25 | 154 | "Two further": `0x2812` BNDCFGS, `0x2814` RTIT_CTL | CONFIRMED (values) / **GAP** | 3D Table B-6 confirms both; table continues `0x2816` LBR_CTL, `0x2818` PKRS, `0x281A`–`0x2828` FRED, `0x282E` SPEC_CTRL, `0x2830` guest deadline |
| 26 | 155 | 64-bit host: `0x2C00` PAT, `0x2C02` EFER, `0x2C04` PERF_GLOBAL_CTRL | CONFIRMED (values) / **GAP** | 3D Table B-7 confirms; also `0x2C06` PKRS, `0x2C08`–`0x2C16` FRED, `0x2C1A` IA32_SPEC_CTRL |

### 1.4 `02-vmcs.md` §2.5.4 — B.3, 32-bit fields

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 27 | 159 | `0x4000` pin-based … `0x400A` CR3-target count | CONFIRMED | 3D Table B-8 |
| 28 | 160 | `0x400C` primary VM-exit … `0x401A` VM-entry instruction length | CONFIRMED | 3D Table B-8 (rev-092 renames `0x4016`→"Injected-event identification", `0x4018`→"Injected-event error code"; footnotes give the old names the chapter uses) |
| 29 | 161 | `0x401C` TPR threshold, `0x401E` secondary, `0x4020` PLE_Gap, `0x4022` PLE_Window, **`0x4024` notify window** | **WRONG** (last item) | 3D Table B-8: "**Instruction-timeout control · 000010010B · 00004024H**", then "SEAM-guest KeyID · 000010011B · 00004026H". The string "notify window" does not occur anywhere in 3C-092 or 3D-092 |
| 30 | 162 | `0x4400` VM-instruction error … `0x440E` VM-exit instruction information (8 fields) | CONFIRMED | 3D Table B-9 (rev-092 renames `0x4404`–`0x440A` to "Exiting-event identification / error code" and "Original-event identification / error code"; footnotes confirm the old names) |
| 31 | 163 | Guest segment limits `0x4800`–`0x480E`, GDTR limit `0x4810`, IDTR limit `0x4812` | CONFIRMED | 3D Table B-10 |
| 32 | 164 | Guest access rights `0x4814`–`0x4822` | CONFIRMED | 3D Table B-10 |
| 33 | 165 | `0x4824` interruptibility, `0x4826` activity, `0x4828` SMBASE, `0x482A` SYSENTER_CS, `0x482E` preemption timer | CONFIRMED | 3D Table B-10 — including the skipped index at `0x482C`, which the chapter correctly jumps over |
| 34 | 166 | Only 32-bit host field is `0x4C00` | CONFIRMED | 3D Table B-11: "There is only one such 32-bit field" |

### 1.5 `02-vmcs.md` §2.5.5 — B.4, natural-width fields

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 35 | 170 | `0x6000`–`0x600E` control fields | CONFIRMED | 3D Table B-12 |
| 36 | 171 | `0x6400` exit qualification, `0x6402` I/O RCX, `0x6404` RSI, `0x6406` RDI, `0x6408` RIP, `0x640A` guest-linear address | CONFIRMED | 3D Table B-13 |
| 37 | 172 | `0x6800` CR0 … `0x6814` TR base | CONFIRMED | 3D Table B-14 |
| 38 | 173 | `0x6816` GDTR base … `0x6826` SYSENTER_EIP | CONFIRMED | 3D Table B-14 |
| 39 | 174 | `0x6C00` CR0 … `0x6C16` RIP (12 host fields) | CONFIRMED | 3D Table B-15 |

### 1.6 `02-vmcs.md` §2.5.6 — declared omissions (anchor check)

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 40 | 181 | HLAT pointer / HLAT prefix size are "fields of §27.6.22" | CONFIRMED | 3C §27.6.22 is "Fields Related to Hypervisor-Managed Linear-Address Translation". (Encodings, if the chapter later wants them: HLATP `0x2040`, HLAT prefix size `0x0006`.) |
| 41 | 182 | PASID-translation fields §27.6.23, instruction-timeout control §27.6.24 | CONFIRMED | 3C §27.6.23 "Fields Related to PASID Translation"; §27.6.24 "Instruction-Timeout Control" |
| 42 | 180 | Secondary VM-exit controls field encoding "could not be confirmed" | GAP (honest) | It is **`0x2044`** (3D Table B-4, index 000100010B) |

### 1.7 `02-vmcs.md` §2.8 — VM-execution controls

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 43 | 247–253 | Group table: encodings `0x4000`/`0x4002`/`0x401E`/`0x2034`/`0x400C`/`0x4012`/`0x2018`; MSRs 481H/482H/48BH/492H/483H/484H/491H; TRUE at 48DH/48EH/48FH/490H; gating primary b31, primary b17, secondary b13 | CONFIRMED | 3D Tables B-4/B-8; 3D A.3.1–A.5, A.11; 3C §27.6.2, §27.6.14 |
| 44 | 259–260 | Pin-based is 32 bits at `0x4000`; bit 0 external-interrupt exiting, RFLAGS.IF has no effect | CONFIRMED | 3C Table 27-5 bit 0 |
| 45 | 261 | Pin bit 3 NMI exiting, 5 virtual NMIs, 6 activate preemption timer, 7 process posted interrupts | CONFIRMED | 3C Table 27-5 |
| 46 | 267–268 | Primary at `0x4002`; bits 2, 3, 7, 9, 10, 11, 12 | CONFIRMED | 3C Table 27-6 |
| 47 | 269 | Primary bits 15, 16, 17, 19, 20, 21, 22, 23 | CONFIRMED | 3C Table 27-6 |
| 48 | 270 | Primary bits 24, 25, 27, 28, 29, 30, 31 | CONFIRMED | 3C Table 27-6 |
| 49 | 271 | Primary bit 31 = 0 ⇒ secondary controls behave as 0 | CONFIRMED | 3C §27.6.2 verbatim |
| 50 | 277 | Secondary bits 0–9 | CONFIRMED | 3C Table 27-7 |
| 51 | 278 | Secondary bits 10–20 | CONFIRMED | 3C Table 27-7 |
| 52 | 279 | Secondary bits 22–26, 30, and **bit 31 "notify VM exiting"** | bits 22–26, 30 CONFIRMED; **bit 31 WRONG** | 3C Table 27-7: "31 · **Instruction timeout** · If this control is 1, a VM exit occurs if certain operations prevent the processor from reaching an instruction boundary within a specified amount of time." (Bit 30 is named "**VMM** bus-lock detection".) |
| 53 | 289–290 | Bits 31:0 allowed-0, bits 63:32 allowed-1; VM entry fails on violation | CONFIRMED | 3D A.3.1/A.3.2/A.4.1/A.5 |
| 54 | 291 | Allowed-0 bit of 1 ⇒ default-1 control | CONFIRMED | 3D A.2 |
| 55 | 292 | Default-1 class: pin bits 1, 2, 4; primary bits 1, 4–6, 8, 13–16, 26 | CONFIRMED | 3C §27.6.1 "supported only the 1-settings of bits 1, 2, and 4"; §27.6.2 and 3D A.3.2 "These are bits 1, 4-6, 8, 13-16, and 26" |
| 56 | 297 | Bit 55 ⇒ TRUE_* MSRs at 48DH, 48EH, 48FH, 490H | CONFIRMED | 3D A.1, A.2, A.3.1, A.3.2, A.4.1, A.5 |
| 57 | 304–305 | Tertiary is 64-bit at `0x2034`, gated by primary bit 17; CTLS3 at 492H is a pure allowed-1 mask | CONFIRMED | 3C §27.6.2; 3D A.3.4 "reports on the allowed 1-settings … the organization of this MSR differs from that of IA32_VMX_PROCBASED_CTLS2" |
| 58 | 306 | Tertiary bit 0 LOADIWKEY exiting, 1 enable HLAT, 2 EPT paging-write control, 3 guest-paging verification, 4 IPI virtualization | CONFIRMED | 3C Table 27-8 |
| 59 | 313 | VM-function controls 64-bit at `0x2018`, gated by secondary bit 13; bit 0 = EPTP switching | CONFIRMED | 3C §27.6.14 and Table 27-10 |
| 60 | 314 | EPTP-list address at `0x2024` points at 512 eight-byte EPTP entries | CONFIRMED | 3C §27.6.14: "The EPTP list comprises 512 8-Byte entries (each an EPTP value)" |
| 61 | 323–337 | Subsection map §27.6.3 … §27.6.27 (25 rows) | CONFIRMED | Every title matches 3C §27.6.3–§27.6.27 exactly, including §27.6.24 Instruction-Timeout Control, §27.6.25 IA32_SPEC_CTRL, §27.6.26 SEAM Non-Root, §27.6.27 APIC-Timer Virtualization |

### 1.8 `02-vmcs.md` §2.9–§2.10 — exit/entry controls and information fields

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 62 | 343 | Primary VM-exit controls `0x400C`; counts `0x400E`/`0x4010`; addresses `0x2006`/`0x2008` | CONFIRMED | 3D Tables B-8, B-4 |
| 63 | 344 | VM-exit bits 2, 9, 12, 15, 18, 19, 20, 21, 22 | CONFIRMED | 3C Table 27-14 |
| 64 | 345 | Acknowledge-interrupt-on-exit stores the vector with the valid bit set | CONFIRMED | 3C Table 27-14 bit 15 (rev-092 calls the destination the "exiting-event identification field") |
| 65 | 347 | VM-entry controls `0x4012`, count `0x4014`, address `0x200A` | CONFIRMED | 3D Tables B-8, B-4 |
| 66 | 348 | "bit 2 load debug controls, **bit 3 entry to SMM, bit 4 deactivate dual-monitor treatment**, bit 9 IA-32e mode guest" | **WRONG** (2 of 4) | 3C Table 27-17: "2 Load debug controls"; "9 IA-32e mode guest"; "**10 Entry to SMM**"; "**11 Deactivate dual-monitor treatment**" |
| 67 | 349 | Injection triple at `0x4016`, `0x4018`, `0x401A` | CONFIRMED | 3D Table B-8 |
| 68 | 350 | Interruption-information: bits 7:0 vector, 10:8 type, 11 deliver-error-code, 31 valid | CONFIRMED | 3C Table 27-20 / §30.2.2 ("Bits 10:8 are set to 0 … 6"; "Bit 11 is set to 1 if …"; "Bit 31 is always set to 1") |
| 69 | 354 | MSR-area entries are 16 bytes: index + value | CONFIRMED | 3C Table 27-16: 31:0 MSR index, 63:32 reserved, 127:64 MSR data |
| 70 | 363 | Exit reason at `0x4402`; bit 31 = VM-entry failure | CONFIRMED | 3D Table B-9; 3C Table 27-19 "31 VM-entry failure (0 = true VM exit; 1 = VM-entry failure)" |

### 1.9 `05-vm-exit.md` §5.3 — basic exit reasons (3D Appendix C, Table C-1)

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 71 | 42–74 | Reasons 0–32 | CONFIRMED | Table C-1. (Rev-092 renames 31 → "RDMSR (implicit form)" and 32 → "WRMSR (implicit form) or WRMSRNS"; numbers unchanged.) |
| 72 | 75–87 | Reasons 33, 34, 36, 37, 39, 40, 41, 43, 44, 45 | CONFIRMED | Table C-1 |
| 73 | 77, 80, 84 | Reasons 35, 38, 42 are not used | CONFIRMED | Absent from Table C-1 |
| 74 | 88–99 | Reasons 46–57 | CONFIRMED | Table C-1 |
| 75 | 100 | Reason 58 INVPCID, "taken when **'enable INVPCID' is 0** and 'INVLPG exiting' is 1" | **WRONG** | Table C-1: "58 INVPCID. Guest software attempted to execute INVPCID and the **'enable INVPCID' and 'INVLPG exiting' VM-execution controls were both 1**." (With "enable INVPCID" = 0, INVPCID raises #UD; it does not exit.) |
| 76 | 101–106 | Reasons 59–64 | CONFIRMED | Table C-1 |
| 77 | — | Reason **65** is absent from the chapter and is not covered by the line-112 hedge (which only disclaims 68–74 and >75) | **GAP** | Table C-1: "65 PCONFIG." |
| 78 | 107–109 | Reasons 66, 67, 68 | CONFIRMED | Table C-1 (67/68 also require "RDTSC exiting" = 1, which the chapter omits) |
| 79 | 110 | Reason 74 Bus lock | CONFIRMED | Table C-1: "74 Bus lock… (Such VM exits will also set bit 26 of the exit-reason field.)" |
| 80 | 111 | Reason 75 — "**Notify window**, reported when the 'notify VM exiting' control is 1 and the notify window expires" | **WRONG** | Table C-1: "75 **Instruction timeout**. The 'instruction timeout' VM-execution control was 1 and certain operations prevented the processor from reaching an instruction boundary within the amount of time specified by the instruction-timeout control." |
| 81 | 112 | Values 68–74 and >75 "could not be verified against Appendix C" | **GAP** | They are enumerated there: 69 LOADIWKEY, 72 ENQCMD PASID translation failure, 73 ENQCMDS PASID translation failure, 76 SEAMCALL, 77 TDCALL, 78 RDMSRLIST, 79 WRMSRLIST, 80 URDMSR, 81 UWRMSR, 84 RDMSR (immediate form), 85 WRMSRNS (immediate form). 70, 71, 82, 83 are unused |
| 82 | 118–123 | Unconditional vs. controllable exits (CPUID/GETSEC/INVD/XSETBV/VMCALL always exit; VMX instructions always exit; MSR/IO bitmap rules) | CONFIRMED | 3C §28.1.2, §28.1.3; Table C-1 entries 10, 11, 13, 55, 18 |

### 1.10 `05-vm-exit.md` §5.4 — exit qualification

**Systemic anchor defect.** Every claim in §5.4.1 – §5.4.9 is anchored `[SDM 3C §27.9.1]`. §27.9.1
("Basic VM-Exit Information") defines the *existence* of the fields and then says, verbatim:

> "Exit qualification (64 bits …). This field contains additional information about the cause of
> VM exits due to the following: … **The format of the field depends on the cause of the VM exit.
> See Section 30.2.1 for details.**"

All the per-reason bit layouts (Tables 30-1 … 30-7) live in **§30.2.1**, and the
instruction-information formats (Tables 30-8 … 30-11) in **§30.2.5**. The rows below marked
MIS-ANCHOR are therefore factually correct but cite a section that does not contain them.

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 83 | 141 | Exit qualification is 64-bit read-only, defined §27.9.1, populated §30.2.1 | CONFIRMED (incl. anchors) | Both anchors correct |
| 84 | 142 | List of exits with a meaningful qualification | CONFIRMED / **MIS-ANCHOR** | §27.9.1's list omits INVPCID, APIC accesses, EPT violations and SPP events, which the chapter lists; §30.2.1's list does include them. Re-anchor to §30.2.1 |
| 85 | 143 | "For VM exits whose reason has no defined exit qualification format, the field's value is **undefined**" | **WRONG** | §30.2.1: "Exit qualification. This field is saved for VM exits due to the following causes: … **For all other VM exits, this field is cleared.**" Cleared (0), not undefined |
| 86 | 147–151 | CR access: bits 3:0 CR number (0 for CLTS/LMSW); 5:4 access type 0/1/2/3; bit 6 LMSW operand type; 11:8 GPR 0–15; 31:16 LMSW source data; bit 7 and 15:12 reserved | CONFIRMED / MIS-ANCHOR | 3C **Table 30-3** — exact match on all six sub-claims |
| 87 | 152 | Qualification fully decodes MOV CR / CLTS / LMSW; no disassembly needed | CONFIRMED / MIS-ANCHOR | Table 30-3 |
| 88 | 156–157 | MOV DR: bits 2:0 DR number, bit 4 direction, bits 11:8 GPR; bit 3 and 7:5 reserved | CONFIRMED / MIS-ANCHOR | 3C **Table 30-4** — exact match |
| 89 | 161–165 | I/O: bits 2:0 size (0/1/3), bit 3 direction, bit 4 string, bit 5 REP, bit 6 operand encoding, bits 31:16 port, bits 15:7 reserved | CONFIRMED / MIS-ANCHOR | 3C **Table 30-5** — exact match, including "Other values not used" for size |
| 90 | 166 | INS/OUTS fill guest-linear address and instruction information | CONFIRMED | §30.2.1 (guest-linear address) and §30.2.5 / Table 30-8. Anchor `[§27.9.4]` is the definition section — acceptable |
| 91 | 167 | INS/OUTS instruction-information reporting is gated by IA32_VMX_BASIC bit 54 | CONFIRMED | 3D A.1: "If bit 54 is read as 1, the processor reports information in the VM-exit instruction-information field on VM exits due to execution of the INS and OUTS instructions" |
| 92 | 171–173 | Task switch: bits 15:0 TSS selector; bits 31:30 source 0 CALL / 1 IRET / 2 JMP / 3 IDT task gate; bits 29:16 reserved | CONFIRMED / MIS-ANCHOR | 3C **Table 30-2** — exact match |
| 93 | 178 | APIC access: bits 11:0 offset within the APIC page (linear access) | CONFIRMED / MIS-ANCHOR | 3C **Table 30-6** |
| 94 | 179 | APIC access types enumerated as 0, 1, 2, 3, 10, 15 | **WRONG** (incomplete enumeration) | 3C Table 30-6 also defines "**4 = linear access asynchronous to instruction execution**" and "**11 = guest-physical access asynchronous to instruction execution**". A decoder built from this list mis-handles BTS/PEBS, TAPT and architectural-PEBS APIC accesses |
| 95 | 180 | Offset undefined "for access types 10 and 15" | **WRONG** (same root cause) | Table 30-6: bits 11:0 are "Undefined if the APIC-access VM exit is due **a guest-physical access**" — i.e. types 10, **11** and 15 |
| 96 | 186–188 | EPT violation bits 0, 1, 2 = data read / data write / instruction fetch | CONFIRMED / MIS-ANCHOR | 3C **Table 30-7** |
| 97 | 187 | RMW always sets bit 1; whether it also sets bit 0 is implementation-specific | CONFIRMED | §30.2.1: "An EPT violation that occurs during as a result of execution of a read-modify-write operation sets bit 1 (data write). Whether it also sets bit 0 (data read) is implementation-specific and, for a given implementation, may differ for different kinds of read-modify-write operations." |
| 98 | 189–190 | Bits 3, 4 = logical-AND of bit 0 / bit 1 of the EPT paging-structure entries | CONFIRMED / MIS-ANCHOR | Table 30-7 |
| 99 | 191 | Bit 5 = AND of bit 2; execute when MBEC = 0, supervisor-mode execute when MBEC = 1 | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 5 verbatim |
| **100** | **192** | **Bit 6 = logical-AND of bit 10 (user-mode execute) of the EPT paging-structure entries, defined only when mode-based execute control is enabled; not a property of the execute-disable bit** | **CONFIRMED** | 3C Table 30-7, bit 6: "If the 'mode-based execute control' VM-execution control is 0, the value of this bit is undefined. If that control is 1, this bit is the **logical-AND of bit 10** in the EPT paging-structure entries used to translate the guest-physical address … it indicates whether the guest-physical address was **executable for user-mode linear addresses**." |
| **101** | **193** | **Bit 7 = set if the guest-linear-address field is valid** | **CONFIRMED** | 3C Table 30-7, bit 7: "**Set if the guest linear-address field is valid.** The guest linear-address field is valid for all EPT violations except those resulting from an attempt to load the guest PDPTEs as part of the execution of the MOV CR instruction, those due to trace-address pre-translation (TAPT…), and those due to architectural PEBS." |
| 102 | 194 | Bit 8 defined only when bit 7 = 1; clear = paging-structure access during a walk, set = translation of a linear address | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 8 (PDF also covers A/D-bit updates in the "clear" case) |
| 103 | 195 | Bit 9 (advanced info): 1 = user-mode linear address, 0 = supervisor-mode | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 9 |
| 104 | 196 | Bit 10: set if guest paging allows writes | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 10 ("0 if … read-only page and 1 if … read/write page") |
| 105 | 197 | Bit 11: set if guest paging disallows instruction fetches | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 11 ("1 if it translates to an execute-disable page") |
| 106 | 198 | Bit 12 = NMI unblocking due to IRET, §30.2.3 | CONFIRMED (incl. anchor) | Table 30-7 bit 12: "NMI unblocking due to IRET (see Section 30.2.3)" |
| 107 | 199 | Bit 13 = shadow-stack access | CONFIRMED / MIS-ANCHOR | Table 30-7 bit 13 |
| 108 | 200 | Bits above 13 not enumerated ("could not be verified") | GAP (honest) | Table 30-7: 14 supervisor shadow-stack (EPTP bit 7), 15 guest-paging verification, 16 asynchronous-to-instruction, 63:17 undefined |
| 109 | 201 | GPA always valid on EPT violation; GLA meaningful only when bit 7 = 1 | CONFIRMED / MIS-ANCHOR | §30.2.1 "Guest-physical address … receives the guest-physical address that caused the EPT violation"; "VM exits due to EPT violations that set bit 7 of the exit qualification" |
| 110 | 202 | EPT misconfiguration reports GPA, no defined qualification format | CONFIRMED (with the §30.2.1 wording that the field is *cleared*) | §30.2.1 |
| 111 | 206–208 | #DB: bits 3:0 B0–B3; bit 13 BD; bit 14 BS; bit 16 RTM | CONFIRMED / MIS-ANCHOR | 3C **Table 30-1** |
| 112 | 209 | "**Bits 12:4**, bit 15 and bits 63:17 … are reserved" | **WRONG** | 3C Table 30-1 defines "**11 BLD. When set, this bit indicates that a bus lock was asserted while OS bus-lock detection was enabled and CPL > 0**". Only bits **10:4**, **12** and **15** are "Not currently defined" |
| 113 | 210 | #PF: qualification = the faulting linear address (the CR2 value) | CONFIRMED / MIS-ANCHOR | §30.2.1 |
| 114 | 214–216 | Displacement rule, zero when no displacement, RIP-relative sum in 64-bit mode | CONFIRMED / MIS-ANCHOR | §30.2.1, verbatim for the listed instructions |
| 115 | 217 | INVEPT, INVPCID, INVVPID follow the same rule | CONFIRMED / MIS-ANCHOR | §30.2.1 lists them first in the same sentence |
| 116 | 219 | Instruction identity 0 SGDT / 1 SIDT / 2 LGDT / 3 LIDT; 0 SLDT / 1 STR / 2 LLDT / 3 LTR | CONFIRMED | 3C **Table 30-10** bits 29:28 and **Table 30-11** bits 29:28 — exact match. Anchor `[§27.9.4]` should be §30.2.5 |
| 117 | 220 | Segment register 0 ES, 1 CS, 2 SS, 3 DS, 4 FS, 5 GS | CONFIRMED | 3C Tables 30-8/30-10/30-11 bits 17:15 |
| 118 | 224 | SIPI vector in bits 7:0 | CONFIRMED / MIS-ANCHOR | §30.2.1: "the exit qualification contains the SIPI vector information in bits 7:0. Bits 63:8 … cleared to 0" |
| 119 | 225 | MWAIT: whether monitoring hardware was armed | CONFIRMED / MIS-ANCHOR | §30.2.1: "set either to 0 (if address-range monitoring hardware is not armed) or to 1 (if … armed)" |
| 120 | 226 | INVLPG: the linear operand | CONFIRMED / MIS-ANCHOR | §30.2.1 |
| 121 | 239 | Dispatch table row "44 (APIC access) → Exit qualification; **guest-linear address for linear accesses**" | **WRONG** | Neither §27.9.1 nor §30.2.1 lists APIC-access VM exits among the users of the guest-linear-address field. §27.9.1: the field "is used in the following cases: … LMSW with a memory operand … INS or OUTS … SMIs that arrive immediately after retirement of I/O instructions … Certain VM exits due to EPT violations" |
| 122 | 241 | Row "48 (EPT violation) → qualification, GPA, GLA when bit 7 set" | CONFIRMED | §30.2.1 |
| 123 | 247 | VM-exit information fields are read-only; VMWRITE fails with error 13 unless the capability is reported | CONFIRMED | 3C Table 33-1 err. 13 "VMWRITE to read-only VMCS component"; 3D A.6 bit 29; 3C §27.9.1 footnote 2 |

### 1.11 `08-vmx-instructions.md` §8.4 — VM-instruction error numbers

**Anchor defect.** All 28 rows are anchored `[SDM 3C §27.9.5]`. §27.9.5 ("VM-Instruction Error
Field") is three sentences long and contains **no** numbers; it does not even cross-reference the
table. The table is 3C **§33.4, Table 33-1** ("The different VM-instruction error numbers are
enumerated in Section 33.4, 'VM Instruction Error Numbers.'"). Every *value* is correct.

| # | Line | Claim | Verdict | PDF evidence (3C Table 33-1) |
|---|---|---|---|---|
| 124 | 163–165 | 1 VMCALL in VMX root; 2 VMCLEAR invalid PA; 3 VMCLEAR with VMXON pointer | CONFIRMED / **MIS-ANCHOR** | verbatim |
| 125 | 166–168 | 4 VMLAUNCH non-clear VMCS; 5 VMRESUME non-launched VMCS; 6 VMRESUME after VMXOFF | CONFIRMED / MIS-ANCHOR | verbatim, incl. the parenthetical "(VMXOFF and VMXON between VMLAUNCH and VMRESUME)" |
| 126 | 169–170 | 7 invalid control field(s); 8 invalid host-state field(s) | CONFIRMED / MIS-ANCHOR | verbatim |
| 127 | 171–173 | 9 VMPTRLD invalid PA; 10 VMPTRLD with VMXON pointer; 11 VMPTRLD wrong revision id | CONFIRMED / MIS-ANCHOR | verbatim |
| 128 | 174–175 | 12 VMREAD/VMWRITE unsupported component; 13 VMWRITE to read-only component | CONFIRMED / MIS-ANCHOR | verbatim |
| 129 | 176, 183, 189 | 14, 21, 27 are not used | CONFIRMED / MIS-ANCHOR | absent from Table 33-1 |
| 130 | 177 | 15 VMXON in VMX root operation | CONFIRMED / MIS-ANCHOR | verbatim |
| 131 | 178–182 | 16, 17, 18, 19, 20 (dual-monitor group) | CONFIRMED / MIS-ANCHOR | verbatim, incl. the "(when attempting to deactivate/activate the dual-monitor treatment…)" qualifiers |
| 132 | 184–187 | 22, 23, 24, 25 | CONFIRMED / MIS-ANCHOR | verbatim; footnote c confirms err. 25 supersedes err. 7 for SMM returns |
| 133 | 188, 190 | 26 events blocked by MOV SS; 28 invalid operand to INVEPT/INVVPID | CONFIRMED / MIS-ANCHOR | verbatim |
| 134 | 191 | Error-number namespace is disjoint from the exit-reason namespace | CONFIRMED | 3C §33.4 vs. 3D App. C |

### 1.12 `08-vmx-instructions.md` §8.5 — INVEPT / INVVPID

| # | Line | Claim | Verdict | PDF evidence |
|---|---|---|---|---|
| 135 | 199 | INVEPT descriptor is 128 bits: EPTP in 63:0, 127:64 reserved must be 0 | CONFIRMED | 3C Ch. 33, Figure 33-1: "127 … 64 | 63 … 0 / Reserved (must be zero) | EPT pointer (EPTP)" |
| 136 | 200 | INVEPT type 1 = single-context, keyed on the address portion of the EPTP | CONFIRMED | "If the INVEPT type is 1, the logical processor invalidates all mappings associated with **bits 51:12 of the EPT pointer (EPTP)** specified in the INVEPT descriptor" |
| 137 | 201 | INVEPT type 2 = all-context, descriptor ignored | CONFIRMED | "Global invalidation: If the INVEPT type is 2, the logical processor invalidates mappings associated with all EPTPs" |
| 138 | 202 | INVVPID descriptor: VPID in 15:0, 63:16 reserved must be 0, linear address in 127:64 | CONFIRMED | Figure 33-2; pseudocode "IF INVVPID_DESC[63:16] ≠ 0 THEN VMfail(Invalid operand to INVEPT/INVVPID)" |
| 139 | 203–206 | INVVPID types 0 individual-address, 1 single-context, 2 all-contexts, 3 single-context-retaining-globals | CONFIRMED | Ch. 33 "There are four INVVPID types currently defined" — all four descriptions match, incl. "all VPIDs except VPID 0000H" for type 2 |
| 140 | 207 | Types 0, 1, 3 require VPID ≠ 0000H; otherwise error 28 | CONFIRMED | INVVPID pseudocode: for types 0, 1 and 3, "VPID := INVVPID_DESC[15:0]; IF VPID = 0 THEN VMfail(Invalid operand to INVEPT/INVVPID)" |
| 141 | 208 | Supported types reported in IA32_VMX_EPT_VPID_CAP | CONFIRMED | Ch. 33; 3D A.10 |
| 142 | 218 | VPID 0000H identifies VMX root operation | CONFIRMED (anchor correct) | 3C §27.6.12 "Virtual-Processor Identifier (VPID)" |

### 1.13 `08-vmx-instructions.md` §8.6 — capability MSRs

| # | Line | Claim | Verdict | PDF evidence (3D App. A) |
|---|---|---|---|---|
| 143 | 228–242 | MSR addresses 480H BASIC, 481H PINBASED, 482H PROCBASED, 483H EXIT, 484H ENTRY, 485H MISC, 486H/487H CR0_FIXED0/1, 488H/489H CR4_FIXED0/1, 48AH VMCS_ENUM, 48BH PROCBASED_CTLS2, 48CH EPT_VPID_CAP, 48DH–490H TRUE_*, 491H VMFUNC, 492H PROCBASED_CTLS3, **493H EXIT_CTLS2** | CONFIRMED (all 20) | A.1 (480H), A.3.1 (481H, 48DH), A.3.2 (482H, 48EH), A.3.3 (48BH), A.3.4 (**492H**), A.4.1 (483H, 48FH), A.4.2 (**"The IA32_VMX_EXIT_CTLS2 MSR (index 493H)"**), A.5 (484H, 490H), A.6 (485H), A.7 (486H/487H), A.8 (488H/489H), A.9 (48AH), A.10 (48CH), A.11 (491H) |
| 144 | 243 | All read-only; writing causes #GP(0) | CONFIRMED | App. A preamble: "VMX capability MSRs are read-only; an attempt to write them (with WRMSR) produces a general-protection exception (#GP(0))" |
| 145 | 247–249 | BASIC bits 30:0 revision id; bit 31 always 0; bits 44:32 region size, ≤ 4096 | CONFIRMED | A.1: "Bits 30:0 contain the 31-bit VMCS revision identifier"; "Bit 31 is always 0"; "a value greater than 0 and at most 4096" |
| 146 | 250–251 | BASIC bit 48 = 32-bit address limit; bit 49 = dual-monitor support | CONFIRMED | A.1 |
| 147 | 252 | BASIC bits 53:50 memory type; 6 = WB, 0 = UC | CONFIRMED | A.1 and **Table A-1**: "0 Uncacheable (UC) / 1-5 Not used / 6 Write Back (WB) / 7-15 Not used" |
| 148 | 253–255 | BASIC bit 54 INS/OUTS info; bit 55 TRUE_* present; bit 56 any-error-code injection | CONFIRMED | A.1 |
| 149 | 259–260 | Two-halves layout; allowed-0 = 1 ⇒ default-1 | CONFIRMED | A.3.1, A.3.2, A.2 |
| 150 | 261–262 | TRUE_* usable only when BASIC bit 55 = 1; CTLS2 governs secondary controls, gated by primary bit 31 | CONFIRMED | A.2, A.3.3; 3C §27.6.2 |
| 151 | 263–264 | CTLS3 and VMFUNC are single 64-bit allowed-1 masks; VMFUNC bit 0 = EPTP switching | CONFIRMED | A.3.4, A.11; 3C Table 27-10 bit 0 "EPTP switching" |
| 152 | 265 | Control-computation algorithm (OR allowed-0, AND allowed-1) | CONFIRMED | Follows directly from A.3.1/A.3.2 semantics |
| 153 | 269–271 | MISC bits 4:0 preemption-timer exponent; bit 5 EFER.LMA store; bits 8:6 activity states 6 HLT / 7 shutdown / 8 wait-for-SIPI | CONFIRMED | A.6, verbatim |
| 154 | 272–273 | MISC bit 14 Intel PT in VMX operation; bit 15 RDMSR of IA32_SMBASE in SMM | CONFIRMED | A.6, verbatim |
| 155 | 274–275 | MISC bits 24:16 CR3-target count; bits 27:25 give 512 × (N + 1) | CONFIRMED | A.6: "if the value bits 27:25 of IA32_VMX_MISC is N, then 512 * (N + 1) is the recommended maximum" |
| 156 | 276 | MISC bit 29 = VMWRITE to any supported field | CONFIRMED | A.6 |
| 157 | 277 | MISC bit 30 = "VM entry may inject **an event** with an instruction length of 0" | CONFIRMED (imprecise) | A.6 narrows it: "VM entry allows injection of a **software interrupt, software exception, or privileged software exception** with an instruction length of 0" |
| 158 | 278 | MISC bits 63:32 = MSEG revision identifier | CONFIRMED | A.6 |
| 159 | 282–283 | CR0/CR4 FIXED0 = must-be-1, FIXED1 = may-be-1 | CONFIRMED | A.7, A.8, verbatim |
| 160 | 289 | CPUID.01H:ECX bit 5 is the only CPUID indication of VMX | CONFIRMED | App. A preamble: "CPUID.01H:ECX.VMX[5] = 1" |
| 161 | 291 | Physical-address width from CPUID.80000008H:EAX[7:0] | CONFIRMED | A.1 footnote 2: "MAXPHYADDR … is derived from the value enumerated in CPUID.80000008H:EAX[7:0]" |
| 162 | 299 | VMCS_ENUM bits 9:1 = highest index used | CONFIRMED | A.9: "Bits 9:1 contain the highest index value used for any VMCS encoding" |
| 163 | 300–301 | EPT_VPID_CAP bit 20 INVEPT; bit 25 single-context; bit 26 all-context | CONFIRMED | A.10, verbatim |
| 164 | 302–303 | EPT_VPID_CAP bit 32 INVVPID; bits 40, 41, 42, 43 the four types | CONFIRMED | A.10, verbatim |

---

## 2. Tally

| Verdict | Rows | Distinct findings |
|---|---|---|
| Rows checked | **164** | — |
| CONFIRMED (value and anchor both good) | 112 | — |
| CONFIRMED value, **MIS-ANCHOR** (cited section does not contain the claim) | 34 | 3 (A1–A3) |
| **WRONG** | 11 | **10** (W1–W10; W8 spans two rows, 94 + 95) |
| **GAP** (true but presented as complete, or needlessly hedged) | 7 | 6 (G1–G6) |
| UNVERIFIABLE | 0 | 0 |

112 + 34 + 11 + 7 = 164. One row (#52, secondary controls bits 22–26/30/31) is counted under WRONG
although 6 of its 7 sub-claims are correct; only bit 31 is wrong.

The two load-bearing EPT-violation claims the brief singled out — **bit 7 = guest-linear-address
valid** and **bit 6 = AND of the user-mode-execute permission, MBEC-gated** — are both **CONFIRMED
verbatim** against 3C Table 30-7. The rebuild's foundation is sound.

---

## 3. Findings — every WRONG, with the correction and the exact file:line

### W1 — `02-vmcs.md:151` — "the only 64-bit read-only field"

> Claim: "The **only** 64-bit read-only VM-exit information field is `0x2400`, the guest-physical address…"

3D Table B-5 enumerates **three**:

| Field | Index | Encoding |
|---|---|---|
| Guest-physical address | 000000000B | `0x2400` |
| MSR data (enable MSR-list instructions) | 000000001B | `0x2402` |
| Original-event data (FRED) | 000000010B | `0x2404` |

**Fix:** drop "the only"; add `0x2402` MSR data and `0x2404` original-event data.

### W2 — `02-vmcs.md:161` — `0x4024` is not "notify window"

> Claim: "… `0x4022` PLE_Window · **`0x4024` notify window**."

3D Table B-8: "**Instruction-timeout control · 000010010B · 00004024H**", followed by
"SEAM-guest KeyID · 000010011B · 00004026H". The string *notify window* does not appear anywhere in
3C-092 or 3D-092 — Intel renamed the whole feature.

**Fix:** `0x4024` **instruction-timeout control** (see 3C §27.6.24); optionally add `0x4026`
SEAM-guest KeyID.

### W3 — `02-vmcs.md:279` — secondary control bit 31

> Claim: "… bit 30 bus-lock detection · **bit 31 notify VM exiting**."

3C Table 27-7: "31 · **Instruction timeout** · If this control is 1, a VM exit occurs if certain
operations prevent the processor from reaching an instruction boundary within a specified amount of
time. See Section 27.6.24 and Section 28.2."

**Fix:** bit 31 = **instruction timeout**. (Also: bit 30's SDM name is "**VMM** bus-lock detection".)

### W4 — `02-vmcs.md:348` — VM-entry control bit positions

> Claim: "VM-entry control bit 2 is load debug controls, **bit 3 is entry to SMM**, **bit 4 is
> deactivate dual-monitor treatment** and bit 9 is IA-32e mode guest…"

3C Table 27-17: 2 Load debug controls ✓; 9 IA-32e mode guest ✓; but
"**10 Entry to SMM**" and "**11 Deactivate dual-monitor treatment**".

**Fix:** bit **10** entry to SMM, bit **11** deactivate dual-monitor treatment. This is the most
dangerous value in the sample — bits 3 and 4 are inside the VM-entry default-1 class (3D A.5:
default-1 = bits 0–8 and 12), so a VMM that set "bit 3" believing it meant *entry to SMM* would be
poking a reserved bit that must be 1.

### W5 — `05-vm-exit.md:100` — exit reason 58 condition inverted

> Claim: "Basic exit reason 58 — INVPCID, taken when **'enable INVPCID' is 0** and 'INVLPG exiting' is 1."

3D Table C-1: "58 INVPCID. Guest software attempted to execute INVPCID and the **'enable INVPCID'
and 'INVLPG exiting' VM-execution controls were both 1**."

**Fix:** both controls are **1**. With "enable INVPCID" = 0, INVPCID raises #UD in the guest
(3C Table 27-7 bit 12) and never produces exit reason 58.

### W6 — `05-vm-exit.md:111` — exit reason 75

> Claim: "Basic exit reason 75 — **Notify window**, reported when the 'notify VM exiting' control is 1
> and the notify window expires without an instruction retiring."

3D Table C-1: "75 **Instruction timeout**. The 'instruction timeout' VM-execution control was 1 and
certain operations prevented the processor from reaching an instruction boundary within the amount of
time specified by the instruction-timeout control."

**Fix:** reason 75 = **instruction timeout**, gated by secondary control bit 31 "instruction
timeout", with its window in the instruction-timeout control field `0x4024`. Its exit qualification
is also defined (3C §30.2.1): bit 0 set ⇒ the VM context is invalid and the VM must not be resumed;
bit 12 ⇒ NMI unblocking due to IRET; all other bits undefined. Same rename as W2/W3.

### W7 — `05-vm-exit.md:143` — "undefined" vs. "cleared"

> Claim: "For VM exits whose reason has no defined exit qualification format, the field's value is
> **undefined** and must not be interpreted."

3C §30.2.1: "Exit qualification. This field is saved for VM exits due to the following causes: …
**For all other VM exits, this field is cleared.**"

**Fix:** the field is **cleared to 0**, not undefined. (Contrast: the *guest-linear address* and
*guest-physical address* fields genuinely are "undefined" for other exits — §30.2.1 says so
explicitly for each. The chapter has generalised the wrong one of the three.)

### W8 — `05-vm-exit.md:179` and `05-vm-exit.md:180` — APIC-access types 4 and 11 missing

> Claim (179): "access type: 0 = … 1 = … 2 = … 3 = … 10 = … 15 = …"
> Claim (180): "For access types **10 and 15** the offset field (bits 11:0) is undefined…"

3C Table 30-6, bits 15:12, lists eight values, not six:

```
0  = linear access for a data read during instruction execution
1  = linear access for a data write during instruction execution
2  = linear access for an instruction fetch
3  = linear access (read or write) during event delivery
4  = linear access asynchronous to instruction execution          <-- missing
10 = guest-physical access during event delivery
11 = guest-physical access asynchronous to instruction execution  <-- missing
15 = guest-physical access for an instruction fetch or during instruction execution
```

Types 4 and 11 are how BTS / legacy-PEBS DS-save-area accesses, Intel-PT trace-address
pre-translation and architectural PEBS are reported (§30.2.1). A dispatcher written from the
six-value list will fall through on them.

**Fix (179):** add 4 and 11. **Fix (180):** bits 11:0 are undefined for **any guest-physical
access** — types 10, **11** and 15 — per Table 30-6's own wording.

### W9 — `05-vm-exit.md:209` — bit 11 of the #DB exit qualification is not reserved

> Claim: "Bits **12:4**, bit 15 and bits 63:17 of a debug-exception exit qualification are reserved…"

3C Table 30-1: "11 **BLD**. When set, this bit indicates that a bus lock was asserted while OS
bus-lock detection was enabled and CPL > 0 (see Section 20.3.1.6)." Footnote 1 adds that this field
*sets* bit 11 where DR6 *clears* it — a sign inversion a VMM copying DR6 semantics would get wrong.

**Fix:** reserved ranges are bits **10:4**, bit **12**, bit 15 and bits 63:17; add bit 11 = BLD
(bus lock detected, inverted relative to DR6).

### W10 — `05-vm-exit.md:239` — guest-linear address is not valid for APIC-access exits

> Claim (dispatch table, §5.4.10): "| 44 (APIC access) | Exit qualification; **guest-linear address
> for linear accesses** |"

Neither §27.9.1 nor §30.2.1 lists APIC-access VM exits among the users of the guest-linear-address
field. §27.9.1: the field "is used in the following cases: VM exits due to attempts to execute LMSW
with a memory operand; VM exits due to attempts to execute INS or OUTS; VM exits due to
system-management interrupts (SMIs) that arrive immediately after retirement of I/O instructions;
Certain VM exits due to EPT violations." §30.2.1 adds only SPP-related events and the
prematurely-busy-shadow-stack cases. For all other VM exits "the field is undefined."

**Fix:** row 44 should read "Exit qualification only (offset is in bits 11:0 for linear accesses)".

---

## 4. Findings — MIS-ANCHOR (UNSUPPORTED): cited section does not contain the claim

### A1 — `05-vm-exit.md:147–226` (≈40 claims across §5.4.1–§5.4.9): `§27.9.1` → **`§30.2.1`**

§27.9.1 defines the fields and explicitly forwards: "**The format of the field depends on the cause
of the VM exit. See Section 30.2.1 for details.**" Tables 30-1 (debug), 30-2 (task switch),
30-3 (CR access), 30-4 (MOV DR), 30-5 (I/O), 30-6 (APIC access) and 30-7 (EPT violation) are all in
§30.2.1. Affected lines: 142, 147–152, 156–157, 161–165, 171–173, 178–180, 186–197, 199–202,
206–210, 214–217, 224–226. **Every value is right; only the anchor is wrong.**
Lines 141, 198 and 202 already cite §30.2.1 / §30.2.3 correctly — the fix is to make the rest match.

Sub-case: lines **219** and **220** cite `§27.9.4`; the instruction-information formats
(Tables 30-8 … 30-11) are in **§30.2.5**. §27.9.4 defines only that the fields exist.

### A2 — `08-vmx-instructions.md:163–191` (28 claims): `§27.9.5` → **`§33.4` (Table 33-1)**

§27.9.5 in full is: "The 32-bit VM-instruction error field does not provide information about the
most recent VM exit. In fact, it is not modified on VM exits. Instead, it provides information about
errors encountered by a non-faulting execution of one of the VMX instructions." No numbers. 3C §33.3
states: "The different VM-instruction error numbers are enumerated in **Section 33.4, 'VM Instruction
Error Numbers.'**" All 26 defined numbers and the three gaps (14, 21, 27) are correct as written.

Knock-on: `02-vmcs.md:368` also anchors the error-code list to §27.9.5 — that one is fine, because it
only says the field is *defined* there and forwards the code list to chapter 08.

### A3 — `02-vmcs.md:109`: `[SDM 3D App.B]` → **`[SDM 3C §27.11.2]` (Table 27-22)**

Appendix B never states that bit 12 and bits 31:15 are reserved; its opening paragraph defers:
"**Section 27.11.2 describes the structure of the encoding space** (the meanings of the bits in each
32-bit encoding)." Table 27-22 is the source. (3D A.9 also restates the full bit layout, so
`[SDM 3D App.A.9]` is an acceptable secondary anchor.)

The same weakness applies more mildly to lines 105–108, 110, 114–115, 128–132: App. B does state the
width/type/access facts, but piecemeal in each sub-section's opening sentence rather than as the
consolidated format the chapter presents. Re-anchoring §2.5.1 to `[SDM 3C §27.11.2]` and leaving
§2.5.2–§2.5.5 on `[SDM 3D App.B]` would make the chapter self-consistent.

---

## 5. Findings — GAP (accurate but incomplete or over-hedged)

| # | file:line | Issue | SDM |
|---|---|---|---|
| G1 | `05-vm-exit.md` §5.3 (between lines 106 and 107) | Basic exit reason **65 (PCONFIG)** is missing, and is *not* covered by the line-112 hedge, which only disclaims 68–74 and >75 | 3D Table C-1 |
| G2 | `05-vm-exit.md:112` | Says 68–74 and >75 "could not be verified against Appendix C". Appendix C in fact defines 69 LOADIWKEY, 72 ENQCMD PASID translation failure, 73 ENQCMDS PASID translation failure, 76 SEAMCALL, 77 TDCALL, 78 RDMSRLIST, 79 WRMSRLIST, 80 URDMSR, 81 UWRMSR, 84 RDMSR (immediate form), 85 WRMSRNS (immediate form); 70, 71, 82, 83 are unused | 3D Table C-1 |
| G3 | `02-vmcs.md:140` | "Two further 16-bit guest-state fields" — there are three: `0x0814` Guest UINV | 3D Table B-2 |
| G4 | `02-vmcs.md:154`, `02-vmcs.md:155` | The 64-bit guest and host lists read as exhaustive but stop early: guest continues `0x2816` LBR_CTL, `0x2818` PKRS, `0x281A`–`0x2828` FRED, `0x282E` SPEC_CTRL, `0x2830` guest deadline; host continues `0x2C06` PKRS, `0x2C08`–`0x2C16` FRED, `0x2C1A` IA32_SPEC_CTRL | 3D Tables B-6, B-7 |
| G5 | `02-vmcs.md:180` | The secondary-VM-exit-controls encoding, listed as unconfirmed, is **`0x2044`** (and its capability MSR 493H is already stated correctly at `08-vmx-instructions.md:242`) | 3D Table B-4 |
| G6 | `08-vmx-instructions.md:277` | MISC bit 30 is described as "an event"; the SDM restricts it to a **software interrupt, software exception, or privileged software exception** | 3D A.6 |

---

## 6. Naming drift worth a sweep (not errors, but rev-092 renamed these)

The chapters use pre-092 field names throughout. The *encodings* are unaffected, but a reader
grepping the current PDF will not find these strings:

| Chapter's name | SDM rev-092 name | Encoding |
|---|---|---|
| VM-entry interruption-information field | Injected-event identification | `0x4016` |
| VM-entry exception error code | Injected-event error code | `0x4018` |
| VM-exit interruption information | Exiting-event identification | `0x4404` |
| VM-exit interruption error code | Exiting-event error code | `0x4406` |
| IDT-vectoring information field | Original-event identification | `0x4408` |
| IDT-vectoring error code | Original-event error code | `0x440A` |
| notify window / notify VM exiting | instruction-timeout control / instruction timeout | `0x4024`, sec. bit 31, reason 75 |
| bus-lock detection | VMM bus-lock detection | sec. bit 30 |

Each of these is footnoted in the SDM as "Older versions of this document called this field …", so
keeping the old name with a parenthetical is defensible; silently using only the old name is not.

---

## 7. Assessment

The three unchecked chapters are **far better than the brief's risk model predicted on values and
noticeably worse on anchors.** Of 164 sampled claims, the encoding tables (Appendix B) are
essentially perfect — all 60-odd encodings across B.1–B.4 match, including the awkward skipped index
at `0x482C` and the LDTR-less host selector list. All 26 VM-instruction error numbers match. All 20
capability-MSR addresses match. The two EPT-violation bits the whole rebuild was said to rest on are
correct.

The real defects cluster in two places:

1. **A systematic mis-anchor** — 34 of the 164 sampled rows, which correspond to roughly 68
   individual `**Claim.**` bullets in the source files (≈40 in `05-vm-exit.md` §5.4 and 28 in
   `08-vmx-instructions.md` §8.4) — pointing at §27.9.1
   and §27.9.5, sections that define the *existence* of a field and then forward to §30.2.1 and
   §33.4 respectively. This is exactly the failure mode the rebuild was meant to eliminate: the
   section numbers are plausible, adjacent in subject matter, and wrong. Two mechanical
   find-and-replace passes fix it.
2. **Stale nomenclature from the notify-window → instruction-timeout rename** (W2, W3, W6), which
   produced three separate wrong entries in three different files from one upstream change.

W4 (VM-entry bits 3/4 vs. 10/11) and W5 (inverted INVPCID condition) are independent, genuine value
errors with no common cause, and W4 is the one most likely to break real code.
