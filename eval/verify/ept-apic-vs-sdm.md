# Adversarial fact-check: EPT / APICv / VM-entry vs. the Intel SDM

**Date:** 2026-09-20
**Posture:** adversarial. Goal was to find errors, not to confirm the work.

## Primary sources (all obtained, all primary — no fallback, no memory)

| Doc | URL | Result | Local extract |
|---|---|---|---|
| SDM Vol.3C, 326019-092 | `https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf` | HTTP 200, 2,178,770 B | `vol3c.txt`, 21,997 lines (`pdftotext -layout`) |
| SDM Vol.3D | `https://cdrdv2.intel.com/v1/dl/getContent/671269` | HTTP 200, 1,665,693 B | `vol3d.txt`, 15,364 lines |
| SDM Vol.3A | `https://cdrdv2.intel.com/v1/dl/getContent/671447` | HTTP 200, 9,592,181 B | `vol3a.txt`, 100,412 lines |

Scratch dir: `C:\Users\ADMINI~1\AppData\Local\Temp\claude\C--Users-Administrator-Desktop-Kimi-Agent\bbd19040-cdfd-4e00-9f07-368710a09886\scratchpad\sdm\`

**Vol.3C rev 092 chapter map (verified from the extracted body, not from memory):**
Ch.26 Introduction to VMX · **Ch.27 VMCS** · Ch.28 VMX Non-Root Operation · Ch.29 VM Entries · **Ch.30 VM Exits** · **Ch.31 VMX Support for Address Translation** · **Ch.32 APIC Virtualization and Virtual Interrupts** · Ch.33 VMX Instruction Reference · Ch.34 SMM · Ch.35 SEAM.
The two "Maps to:" headers (`06` → Ch.31, `07` → Ch.32) are **correct** for rev 092.

---

## THE HEADLINE ANSWER: SPP bit 61 is leaf-only, and 4-KByte-leaf-only

`06-address-translation.md:107` says *"61 | Sub-page write permissions | leaf entry for a 4-KByte page"*. **This is CORRECT**, and it is the strictest of the three candidate answers:

- **Table 31-7 (EPT PTE that maps a 4-KByte page)** — bit 61 = *"Sub-page write permissions. If the 'sub-page write permissions for EPT' VM-execution control is 1, writes to individual 128-byte regions of the 4-KByte page referenced by this entry may be allowed even if the page would normally not be writable."*
- **Table 31-3 (PDPTE mapping a 1-GByte page)** and **Table 31-5 (PDE mapping a 2-MByte page)** — bits **62:61 are "Ignored."** Bit 61 has no meaning in a large-page leaf.
- **Tables 31-1 / 31-2 / 31-4 / 31-6 (all non-leaf entries)** — bits **63:52 are "Ignored."** Bit 61 has no meaning in any non-leaf entry.
- §31.3.4.1: *"a guest-physical address is eligible for sub-page write permissions only if it is mapped using a 4-KByte page and bit 61 (sub-page write permissions) of the EPT PTE used to map the page is 1. (Guest-physical addresses mapped with larger pages are not eligible for sub-page write permissions.)"*
- §31.3.3.2: *"If the guest-physical address is mapped using a 4-KByte page and bit 61 (sub-page write permissions) of the EPT PTE used to map the page is 1, writes to certain 128-byte sub-pages may be allowed."*

**Verdict: the dispute resolves in favour of leaf, specifically the EPT PTE only. The skill has it right.**

---

## Claim table

Verdicts: **C** = CONFIRMED · **W** = WRONG · **U** = UNSUPPORTED (cited section exists but lacks the claim) · **?** = UNVERIFIABLE.

### `intel-vt/references/06-address-translation.md`

| # | Line | Claim | V | PDF evidence |
|---|---|---|---|---|
| 1 | 5 | Maps to Vol.3C **Ch.31** "VMX Support for Address Translation" | C | Body heading `31.3 THE EXTENDED PAGE TABLE MECHANISM (EPT)`; Ch.31 runs 31.1 VPIDs → 31.4 Caching |
| 2 | 59 | EPTP = VMCS encoding **201AH** | C | 3D Table B-4: `EPT pointer (EPTP; full)  000001101B  0000201AH` |
| 3 | 60 | EPTP 2:0 = EPT paging-structure memory type, only 0 (UC) and 6 (WB) | C | 3C Table 27-9; §31.3.7.1 "A value of 0 indicates the uncacheable type (UC), while a value of 6 indicates the write-back type (WB). Other values are reserved." |
| 4 | 61 | EPTP 5:3 = page-walk length − 1; 3 → 4-level, 4 → 5-level | C | §31.3.2 "a value of 3 configures 4-level EPT, while a value of 4 configures 5-level EPT" |
| 5 | 62 | EPTP bit 6 enables A/D flags for EPT | C | Table 27-9 |
| 6 | 63 | EPTP bit 7 enables supervisor shadow-stack access-rights enforcement | C | Table 27-9 |
| 7 | 64 | EPTP 51:12 address; 11:8 reserved must be 0 | C | Table 27-9: `11:8 Reserved`, `M-1:12` address, `63:M Reserved` |
| 8 | **67** | bits 51:12 of EPTP "is called the **EP4TA**" | **W** | `EP4TA` occurs **0 times** in Vol.3C rev 092. The term is **EPTRTA** (28 occurrences): §31.4.2 "the notation EPTRTA refers to those 40 bits"; §29/§30 "EPTRTA is the value of bits 51:12 of EPTP". Value correct, name obsolete. Propagates to lines 251, 252, 254, 255, 256, 264, 273, 275, 301, 310, 446. |
| 9 | 93–95 | bits 0/1/2 = read/write/execute at **every level**; bit 2 = supervisor-exec under MBEC | C | Tables 31-1 … 31-7 all define 0/1/2 identically |
| 10 | 96 | bits 5:3 EPT memory type — **leaf only** | C | Present only in Tables 31-3, 31-5, 31-7; non-leaf tables show `7:3 Reserved` (PML5E/PML4E/PDPTE-ref) or `6:3 Reserved` + bit 7 "Must be 0" (PDE-ref) |
| 11 | 97 | bit 6 ignore-PAT — leaf only | C | same tables |
| 12 | 98 | bit 7 = page size, in PDPTE and PDE | C | Table 31-3 "Must be 1 (otherwise, this entry references an EPT page directory)"; Table 31-6 "Must be 0 (otherwise, this entry maps a 2-MByte page)" |
| 13 | 99 | bit 8 accessed, every level, when EPTP[6]=1 | C | all seven tables |
| 14 | 100 | bit 9 dirty — **leaf only** | C | bit 9 = "Ignored." in Tables 31-1, 31-2, 31-4, 31-6 |
| 15 | 101 | bit 10 user-mode execute, every level, MBEC only | C | all seven tables |
| 16 | 102 | bit 11 ignored, every level | C | all seven tables |
| 17 | 104 | bit 57 verify-guest-paging — leaf | C | only in Tables 31-3 / 31-5 / 31-7 |
| 18 | 105 | bit 58 paging-write — leaf | C | §31.3.3.2: "EPT paging-structure entries that reference other EPT paging structures **do not use bit 58**" |
| 19 | 106 | bit 60 supervisor shadow stack — leaf, EPTP[7]=1 | C | Tables 31-3 / 31-5 / 31-7 |
| 20 | **107** | **bit 61 SPP — leaf entry for a 4-KByte page** | **C** | See headline section above |
| 21 | **108** | bit 63 suppress-#VE — "leaf entries" | **W** | Incomplete. §28.5.8.1: bit 63 also governs convertibility in a **not-present** entry *at any level* — "If bits 2:0 of an EPT paging-structure entry are all 0, the entry is not present … The EPT violation is convertible if and only if bit 63 of the entry is 0." It is ignored only in *present non-leaf* entries. |
| 22 | 115 | bit 7 reserved in PML4E, ignored in PTE | C | Table 31-2 `7:3 Reserved (must be 0)`; Table 31-7 bit 7 = "Ignored." |
| 23 | 127 / 132 | 1-GByte leaf: frame 51:30, bits 29:12 must be 0 | C | Table 31-3 `29:12 Reserved (must be 0)`, `M-1:30` address |
| 24 | 129 / 132 | 2-MByte leaf: frame 51:21, bits 20:12 must be 0 | C | Table 31-5 `20:12 Reserved (must be 0)`, `M-1:21` address |
| 25 | **149** | "the remaining bits of a not-present entry are ignored" | **W** | §31.3.2: "The processor **ignores bits 62:3**" — bit 63 is *not* ignored in a not-present entry. |
| 26 | 149 | present iff any of bits 2:0 set; +bit 10 under MBEC | C | §31.3.2 and its NOTE |
| 27 | 162 | misconfig if bits 2:0 = 010b or 110b (write without read) | C | §31.3.3.1 "Bit 0 of the entry is clear … and … Bit 1 is set" |
| 28 | 163 | misconfig if 100b without execute-only support | C | §31.3.3.1 |
| 29 | 164 | misconfig on reserved bits / alignment / above MAXPHYADDR | C | §31.3.3.1 "A reserved bit is set. This includes the setting of a bit in the range 51:12 in position MAXPHYADDR or above" |
| 30 | 165 | misconfig if memory type 2, 3 or 7; defined 0/1/4/5/6 | C | §31.3.3.1 + §31.3.7.2 "0 = UC; 1 = WC; 4 = WT; 5 = WP; and 6 = WB" |
| 31 | 174 | exit reason 48 = violation, 49 = misconfiguration | C | 3D Table C-1 |
| 32 | **181, 182, 191, 192** | anchored `[SDM 3C §27.9.1]` for the EPT-violation **exit-qualification** layout | **U (anchor)** | §27.9.1 "Basic VM-Exit Information" does not carry it and redirects: *"The format of the field depends on the cause of the VM exit. **See Section 30.2.1** for details."* EPT violations are not even in §27.9.1's exit-qualification cause list. Correct anchor: **§30.2.1, Table 30-7**. |
| 33 | 191 | qualification bit 7 = guest-linear-address field valid | C | Table 30-7: "Set if the guest linear-address field is valid." |
| 34 | 192 | qualification bit 6 = AND of bit 10, MBEC-only | C | Table 30-7: "If the 'mode-based execute control' VM-execution control is 1, this bit is the logical-AND of bit 10 in the EPT paging-structure entries used to translate the guest-physical address…" |
| 35 | 203 | qualification bits 3/4/5 report EPT permissions | C | Table 30-7 bits 3/4/5 = logical-AND of bits 0/1/2 |
| 36 | 229 | 24 memory accesses worst case (4-level × 4-level) | ? | Arithmetically consistent with §31.3.1–31.3.2 but the SDM states no such figure; cited to `[107][108]`, not the SDM. |
| 37 | 244 | VPID 16-bit; entry fails if enable-VPID=1 and VPID=0000H | C | §27.6.12 + §29.2.1.1 "the value of the VPID VM-execution control field must not be 0000H" |
| 38 | 254 | linear / guest-physical / combined mappings and their tags | C | §31.4.1, §31.4.2 (tags are VPID, PCID, **EPTRTA** — see #8) |
| 39 | 299 | INVEPT descriptor: 63:0 EPTP, 127:64 reserved | C | Figure 33-1 |
| 40 | 300 | INVVPID descriptor: 15:0 VPID, 63:16 reserved, 127:64 linear address | C | Figure 33-2 |
| 41 | 301 | INVEPT types 1 (single-context) and 2 (all-context) | C | Ch.33 INVEPT. (SDM names type 2 "Global invalidation"; semantics identical.) |
| 42 | 302 | INVVPID types 0/1/2/3 | C | Ch.33 INVVPID |
| 43 | 304 | INVVPID type 2 excludes VPID 0000H | C | "invalidates all mappings tagged with all VPIDs **except VPID 0000H**" |
| 44 | 326 | PML address = **200EH** | C | 3D Table B-4 index `000000111B` |
| 45 | 327 | PML log = 512 × 64-bit entries | C | §27.6.18 |
| 46 | 328 | PML index = **0812H**, 16-bit guest-state field | C | 3D Table B-2 (16-Bit Guest-State Fields) + §27.4.2 Guest Non-Register State. *(Note: §27.6.18/§31.3.6 loosely call it a "VM-execution control field" — an SDM internal inconsistency; Appendix B is authoritative and the skill matches it.)* |
| 47 | 329 | logged on the dirty-flag 0→1 transition, GPA with bits 11:0 cleared | C | §31.3.6 |
| 48 | 330 | index out of 0–511 → exit reason **62** | C | §31.3.6 + 3D Table C-1 "Page-modification log full" |
| 49 | 338 | fills downward from 511; index decremented after each entry | C | §31.3.6 step 2 "The PML index is decremented by 1" |
| 50 | 347 | SPPTP = **2030H** | C | 3D Table B-4 index `000011000B`; §27.6.21 |
| 51 | 349 | SPP table is a 4-level walk on the GPA | C | §31.3.4.2: SPPL4E (GPA 47:39) → SPPL3E (38:30) → SPPL2E (29:21) → SPP vector (20:12) |
| 52 | 350 | SPP leaf = 64-bit, 32 × 128-byte sub-pages, bit 2i grants, odd bits reserved | C | §31.3.4.2 "writes to address are allowed if and only if bit 2S of the sub-page permission is set to 1. (The bits at odd positions in a SPP vector are not used and must be zero.)" |
| 53 | 352 | SPP miss/misconfig → exit reason **66**, qualification distinguishes | C | 3D Table C-1 "SPP-related event"; §30.2.1 "bit 11 of the exit qualification indicates the type of event: 0 indicates an SPP misconfiguration and 1 indicates an SPP miss" |
| 54 | 353 | SPP = writes only, 4-KByte pages only | C | §31.3.4.1 |
| 55 | 369 | sub-page index from GPA bits 11:7 | C | §31.3.4.2 "Bits 11:7 of guest-physical address identify the sub-page" |
| 56 | 382 | No standalone VT-rp spec; HLAT lives in 3A §5.5.x, 3C §27.6.22, §31.2 | C | §27.6.22 exists; §31.2 "HYPERVISOR-MANAGED LINEAR-ADDRESS TRANSLATION (HLAT)" exists; Ch.31 footnotes point to 3A §5.5.1 |
| 57 | 383 | HLATP + HLAT prefix size are VM-execution control fields; HLATP holds a GPA | C | §27.6.22, Table 27-12: "**Guest-physical address** (4KB-aligned) of the first HLAT paging structure" |
| 58 | 385 | bit 58 = paging-write access, gated by "EPT paging-write control" | C | Table 31-7; §31.3.3.2 |
| 59 | **386** | bit 57 "set for the target page"; gated by "guest-paging verification" alone | **W** | §31.3.3.2: gate is **both** "guest-paging verification" **and** "EPT paging-write control" = 1. And bit 57 is read from *"the EPT paging-structure entry that maps a page for that guest-physical address"* — i.e. the EPT leaf for the page holding the **final guest paging-structure entry**, not the data page. The consequence half of the claim (every guest PSE must sit in a bit-58 page) is correct. |
| 60 | 403 | #VE is vector 20 | C | §28.5.8 "It uses vector 20 and is abbreviated #VE" |
| 61 | **404** | conversion requires "**all of the following**": control=1, bit 63=0, offset-4 field=0 | **U** | §28.5.8.1 lists six conjuncts; the claim omits **CR0.PE = 1**, **"the logical processor is not in the process of delivering an event"**, and the not-shadow-stack-prematurely-busy / not-Intel-PT / not-PEBS clauses. Presented as exhaustive; it is not. |
| 62 | 405 | #VE information address = **202AH** | C | 3D Table B-4 index `000010101B` |
| 63 | 409–416 | #VE area: 0 exit reason (48) / 4 busy / 8 qualification / 16 GLA / 24 GPA / 32 EPTP index | C | Table 28-23 — exact match, including "For EPT violations, this value is 48 (00000030H)" |
| 64 | 419 | offset 4 written FFFFFFFFH; no further #VE until cleared | C | §28.5.8.1 |
| 65 | 420 | EPTP index = 16-bit control field **0004H** | C | 3D Table B-1 index `000000010B` |
| 66 | 453 | the four EPT exit reasons are 48/49/62/66 | C | 3D Table C-1 |

### `intel-vt/references/07-apic-virtualization.md`

| # | Line | Claim | V | PDF evidence |
|---|---|---|---|---|
| 67 | 5 | Maps to Vol.3C **Ch.32** "APIC Virtualization and Virtual Interrupts" | C | Body headings 32.1 … 32.7 |
| 68 | 36 | TPR threshold = **401CH**, only bits 3:0 used | C | 3D Table B-5 `0000401CH`; §29.2.1.1 "bits 31:4 of the TPR threshold VM-execution control field must be 0" |
| 69 | 37 | exit reason **43** when TPR_threshold[3:0] > VTPR[7:4]; trap-like | C | 3D Table C-1 reason 43; §32.1.2 "Any VM exit caused by TPR virtualization is trap-like" |
| 70 | 64 | Virtual-APIC address = **2012H** | C | 3D Table B-4, index `000001001B` → 0x2000 + (9<<1) = 0x2012 |
| 71 | 79 | APIC-access address = **2014H** | C | 3D Table B-4, index `000001010B` |
| 72 | 71–78 | VTPR 080H, VPPR 0A0H, VEOI 0B0H | C | §32.1.1 verbatim |
| 73 | 74 | VISR 100H–170H, VIRR 200H–270H, 8 × 32-bit, 16 bytes apart | C | §32.1.1 "offsets 100H, 110H, 120H, 130H, 140H, 150H, 160H, and 170H" / "200H … 270H" |
| 74 | 75 | VICR_LO 300H, VICR_HI 310H | C | §32.1.1 |
| 75 | 76 | virtual self-IPI register at **3F0H** | C | §32.5 "WRMSR stores EDX:EAX at offset X on the virtual-APIC page, where X = (ECX & FFH) « 4" → 83FH → 3F0H; §32.4.3.3 "the exit qualification for the APIC-write VM exit is 3F0H" |
| 76 | 138 | PI descriptor address = **2016H** | C | 3D Table B-4, index `000001011B` |
| 77 | 139 | EOI-exit bitmaps = **201CH / 201EH / 2020H / 2022H** | C | 3D Table B-4 |
| 78 | 140 | PI notification vector = **0002H**, 16-bit control | C | 3D Table B-1, index `000000001B` |
| 79 | 141 | Guest interrupt status = **0810H**, 16-bit guest state | C | 3D Table B-2; §27.4.2 |
| 80 | 142 | §27.6.27 defines APIC-timer virtualization controls | C | Anchor resolves: "27.6.27 Fields Controlling APIC-Timer Virtualization" |
| 81 | 148 | **RVI = bits 7:0** of guest interrupt status | C | §27.4.2 "Requesting virtual interrupt (RVI). This is the **low byte** of the guest interrupt status." |
| 82 | 149 | **SVI = bits 15:8** | C | §27.4.2 "Servicing virtual interrupt (SVI). This is the **high byte** of the guest interrupt status." |
| 83 | **173, 181** | §7.6.1 TPR virtualization performs PPR virtualization **first, unconditionally** | **W** | §32.1.2 pseudocode puts PPR virtualization *inside the ELSE branch*: `IF "virtual-interrupt delivery" is 0 THEN IF VTPR[7:4] < TPR threshold THEN cause VM exit due to TPR below threshold; FI; ELSE perform PPR virtualization; evaluate pending virtual interrupts; FI;` No PPR virtualization occurs on the VID = 0 path. |
| 84 | 189 | PPR virtualization: VTPR[7:4] ≥ SVI[7:4] → VPPR := VTPR & FFH, else SVI & F0H | C | §32.1.3 verbatim |
| 85 | 200 | recognition iff RVI[7:4] > VPPR[7:4] | C | §32.2.1 — *but the SDM conjunct `"interrupt-window exiting" is 0` is omitted from the skill's pseudocode* |
| 86 | 206 | delivery needs RFLAGS.IF=1, no STI / MOV-SS blocking | C (incomplete) | §32.2.2 adds "(3) there is no blocking by MOV SS **or by POP SS**; and (4) the **'interrupt-window exiting' VM-execution control is 0**" |
| 87 | 212–224 | virtual-interrupt-delivery pseudocode (VISR/SVI/VPPR/VIRR/RVI) | C | §32.2.2 — exact match |
| 88 | 233–248 | EOI-virtualization pseudocode | C | §32.1.4 — exact match; exit reason 45 with vector in bits 7:0 of the exit qualification confirmed at §30.2.1 |
| 89 | **253–259** | self-IPI virtualization = "set VIRR bit, evaluate" | **W** | §32.1.5 has **three** steps: `VIRR[Vector] := 1;` **`RVI := max{RVI,Vector};`** `evaluate pending virtual interrupts;`. The skill's pseudocode and claim both drop the RVI update — an implementation copying this never recognises the self-IPI. |
| 90 | 280 | x2APIC MSRs 800H–8FFH; offset = (index − 800H) × 16 | C | §32.5 "X = (ECX & FFH) « 4" |
| 91 | 284 | "virtualize x2APIC mode" and "virtualize APIC accesses" mutually exclusive | C | §29.2.1.1 "If the 'virtualize x2APIC mode' VM-execution control is 1, the 'virtualize APIC accesses' VM-execution control must be 0" |
| 92 | 316–323 | PID: PIR 255:0, ON 256, SN 257, rsvd 271:258, NV 279:272, rsvd 287:280, NDST 319:288, rsvd 511:320 | **C (all 8 rows)** | Table 32-1 — exact, field-for-field match |
| 93 | 325 | PID is 64 bytes, 64-byte aligned | C | §32.1.6.1 "A PID is a 64-byte data structure"; §29.2.1.1 "Bits 5:0 of the posted-interrupt descriptor address are all 0" |
| 94 | 344 | poster: set PIR, notify only if SN=0 and ON was 0 | C | §32.1.6.1 steps 1–3 ("setting the ON bit if the ON and SN bits were both 0 in the value read") |
| 95 | 358 | merge clears ON **before** the atomic read-and-clear of PIR | C | §32.6 step 3 (clear ON) precedes step 5 (OR PIR into VIRR and clear PIR). *Minor: the skill's pseudocode puts ON←0 ahead of the local-APIC acknowledge; the SDM order is ACK (1) → clear ON (3) → EOI write (4) → merge (5).* |
| 96 | 377 | PI processing needs VID + ack-interrupt-on-exit + NV[15:8]=0 + 64-byte-aligned PID | C | §29.2.1.1 |
| 97 | 375 | use-TPR-shadow=0 ⇒ x2APIC / APIC-reg-virt / VID / IPI-virt all 0 | C | §29.2.1.1 |
| 98 | 376 | VID=1 ⇒ external-interrupt exiting=1 | C | §29.2.1.1 |
| 99 | 389 | PID-pointer table entry: bit 0 valid, 64-byte-aligned PID address | C | §32.1.6.2 "Bits 63:6 contain bits 63:6 of the 64-bit physical address of a PID. Bits 5:1 are reserved and must be 0. Bit 0 is a valid bit." |
| 100 | **390** | IPI virtualization covers "physical-addressing, **flat-mode**, unicast IPIs" | **W** | §32.5 requires *all* of: destination shorthand `00B`, **trigger mode edge (bit 15 = 0)**, bit 12 = 0, destination mode **physical (bit 11 = 0)**, **delivery mode fixed (bits 10:8 = 000B)**. "Flat mode" is a *logical*-destination model and is excluded by the physical-mode requirement, not a prerequisite; and the edge-trigger + fixed-delivery requirements are missing. The pseudocode also omits §32.1.6.2's `IF V < 16 THEN APIC-write VM exit`. |
| 101 | 100 | APIC-access exit = reason **44**, fault-like | C | 3D Table C-1; §32.4.2 |
| 102 | 101 | APIC-write exit = reason **56**, trap-like, qualification = offset | C | §32.4.3.3 "every APIC-write VM exit is trap-like … The exit qualification is the page offset of the write access" |
| 103 | 102 | APIC-access qualification: 11:0 offset, 15:12 access type | C | Table 30-6 (note: 11:0 **undefined** for guest-physical accesses — skill omits this) |
| 104 | 103 | Instruction fetches from the APIC-access page always exit | C | §32.4.2 "A read access from the APIC-access page causes an APIC-access VM exit if … The access is for an instruction fetch" |
| 105 | **108** | "APIC-register virtualization applies **only to naturally aligned 4-byte accesses**" | **W** | §32.4.2 / §32.4.3.1: an access is virtualized unless it is more than 32 bits **or** "not entirely contained within the low 4 bytes of a naturally aligned 16-byte region". A 1-, 2- or 3-byte access wholly inside 080H–083H **is** virtualized. |

### `intel-vt/references/04-vm-entry.md`

| # | Line | Claim | V | PDF evidence |
|---|---|---|---|---|
| 106 | **293** | field layout "7:0 vector; 10:8 type; 11 deliver error code; **bits 30:12 reserved**; 31 valid" | **W** | rev 092 Table 27-18 + §29.2.1.3: *"Reserved bits in the field (**30:14 and 12**) are 0."* **Bit 13 = nested-exception bit** ("may be set only if IA32_VMX_BASIC[58] = 1"). Also renamed in rev 092: the field is the **injected-event identification field** and bits 10:8 are the **event type** ("Older versions of this document called this field VM-entry interruption information"). |
| 107 | 294 | types 0–7 enumeration (0 ext-int … 7 other event) | C | Table 27-18 — exact match |
| 108 | **295** | "the only type-7 event is an MTF VM exit, only with vector 0" | **W** | §29.2.1.3: "If the event type is other event, the vector is **0** (indicating a pending MTF VM exit …) or, if FRED transitions would be enabled following VM entry …, the vector is **1 (indicating SYSCALL)** or **2 (indicating SYSENTER)**." |
| 109 | 296 | injection only if bit 31 valid = 1 | C | §27.8.3 "VM entry injects an event if and only if the valid bit (bit 31) is 1" |
| 110 | 297 | NMI ⇒ vector 2; hardware exception ⇒ vector ≤ 31 | C | §29.2.1.3 |
| 111 | **298** | deliver-error-code allowed for type 3 **or type 5** | **W** | §29.2.1.3: "The field's deliver-error-code bit is **0** if any of the following holds: (1) the event type is **not hardware exception** …". Type 5 (privileged software exception) is excluded. |
| 112 | **299** | vectors 21 (#CP) and 30 (#SX) "also permitted with bit 11 set" | **W** | §29.2.1.3: bit 11 must be 0 when "IA32_VMX_BASIC[56] is read as 0 and the vector is in one of the following ranges: 0-7, 9, 15, 16, or **18-31**". 21 and 30 fall in 18–31, so on any processor with IA32_VMX_BASIC[56]=0 setting bit 11 fails VM entry. The real gate is IA32_VMX_BASIC[56] (FRED), not "processors that support #CP/#SX". |
| 113 | 300 | error-code field bits 31:16 must be 0; used only when bit 11 = 1 | C | §29.2.1.3 + §27.8.3 "used if and only if the valid bit (bit 31) and the deliver-error-code bit (bit 11) are both set" |
| 114 | 301 | length 1–15 for types 4/5/6; 0 only if IA32_VMX_MISC[30] | C | §29.2.1.3 "in the range 0-15 … A VM-entry instruction length of 0 is allowed only if IA32_VMX_MISC[30] is read as 1" |
| 115 | 322 | VMfailInvalid: CF=1, ZF=0, no error number | C | Ch.33 `VMfailInvalid: CF := 1; … ZF := 0;` |
| 116 | 323 | VMfailValid: ZF=1, CF=0, error number stored | C | Ch.33 `VMfailValid(ErrorNumber): CF := 0; … ZF := 1;` |
| 117 | 324 | exit-reason bit 31 = 1 for reasons 33, 34, 41 | C | §29.8 "Bit 31 is set to 1 to indicate a VM-entry failure", for 33/34/41 |
| 118 | 314–316 | 33 = invalid guest state (8000_0021H), 34 = MSR loading (8000_0022H) | C | §29.8 + 3D Table C-1 |
| 119 | 325 | reason 41 = VM-entry failure due to machine-check event | C | §29.8; 3D Table C-1 |
| 120 | 326 | on entry failure: guest state not saved, MSR-store not processed, other fields unmodified | C | §29.8 "All other VM-exit information fields are unmodified … The guest-state area is not modified. No MSRs are saved into the VM-exit MSR-store area." |
| 121 | 327 | host state loaded as for a VM exit | C | §29.8 step 2 |
| 122 | 328 | reason 33 with qualification **3** = NMI injected into STI-blocked guest | C | §29.8 "3. Failure was due to an attempt to inject a non-maskable interrupt (NMI) into a guest that is blocking events through the STI blocking bit" |
| 123 | 329 | reason 33 qualification 0 normally; non-zero only for PDPTE / NMI-STI / VMCS-link | C | §29.8 lists exactly 2 (PDPTEs), 3 (NMI/STI), 4 (invalid VMCS link pointer); 1 is "Not used" |
| 124 | 317 | reason 34 qualification = 1-based failing MSR-load entry index | C | §29.8 "loaded to indicate which entry in the VM-entry MSR-load area caused the problem (1 for the first entry, 2 for the second, etc.)" |

**Totals: 124 claims sampled. CONFIRMED 111 · WRONG 11 · UNSUPPORTED 2 · UNVERIFIABLE 1.**
(#32 and #61 are the two UNSUPPORTED; #36 is the UNVERIFIABLE. #32 covers four separate claim lines sharing one bad anchor.)

---

## Anchor audit

Every section anchor sampled was resolved against the rev 092 body, not assumed:

| Anchor | Resolves to | OK? |
|---|---|---|
| `SDM 3C Ch.31` | VMX Support for Address Translation | yes |
| `SDM 3C Ch.32` | APIC Virtualization and Virtual Interrupts | yes |
| `SDM 3C §27.6.8` | Controls for APIC Virtualization | yes |
| `SDM 3C §27.6.11` | Extended-Page-Table Pointer (EPTP) | yes |
| `SDM 3C §27.6.12` | Virtual-Processor Identifier (VPID) | yes |
| `SDM 3C §27.6.18` | Control Field for Page-Modification Logging | yes |
| `SDM 3C §27.6.19` | Controls for Virtualization Exceptions | yes |
| `SDM 3C §27.6.21` | Sub-Page-Permission-Table Pointer (SPPTP) | yes |
| `SDM 3C §27.6.22` | Fields Related to Hypervisor-Managed Linear-Address Translation | yes |
| `SDM 3C §27.6.27` | Fields Controlling APIC-Timer Virtualization | yes |
| `SDM 3C §27.4.2` | Guest Non-Register State (RVI/SVI, PML index) | yes |
| `SDM 3C §27.8` | VM-Entry Control Fields (Table 27-18 in §27.8.3) | yes |
| `SDM 3C §27.9.5` | VM-Instruction Error Field | yes |
| `SDM 3C §31.2` | Hypervisor-Managed Linear-Address Translation | yes |
| `SDM 3D App.A` | VMX Capability Reporting Facility | yes |
| `SDM 3D App.C` | VMX Basic Exit Reasons | yes |
| **`SDM 3C §27.9.1`** used for exit-qualification **layouts** | Basic VM-Exit Information — defines the *field*, not its per-cause formats; redirects to §30.2.1 | **no — retarget to §30.2.1 / Table 30-7** |

`SDM 3C §27.9.1` is legitimate where the skill uses it for "the guest-physical address field is used by EPT violations and EPT misconfigurations" (that sentence is there). It is not legitimate for bits 6 and 7 of the EPT-violation exit qualification.

---

## Findings and corrections

Ordered by how badly a developer copying the text would be hurt. **No skill file was edited.**

### F1 — `intel-vt/references/04-vm-entry.md:293` — bit 13 of the injection field is not reserved
> "bits 30:12 reserved"

**Correct (rev 092):** bits **30:14 and bit 12** are reserved; **bit 13 is the nested-exception bit**, settable only when `IA32_VMX_BASIC[58] = 1`. Source: Table 27-18 and §29.2.1.3 ("Reserved bits in the field (30:14 and 12) are 0"). Also worth updating the name: rev 092 calls this the **injected-event identification field**, with bits 10:8 the **event type**.

### F2 — `intel-vt/references/04-vm-entry.md:298` — type 5 cannot carry an error code
> "Bit 11 … may be 1 only when … the interruption type is 3 (hardware exception) **or 5 (privileged software exception)**"

**Correct:** hardware exception **only**. §29.2.1.3: "The field's deliver-error-code bit is 0 if any of the following holds: (1) the event type is not hardware exception."

### F3 — `intel-vt/references/04-vm-entry.md:299` — #CP/#SX error codes are gated on IA32_VMX_BASIC[56]
**Correct:** with `IA32_VMX_BASIC[56] = 0`, bit 11 **must be 0** for vectors 0–7, 9, 15, 16 and **18–31** — which includes 21 (#CP) and 30 (#SX). Only when `IA32_VMX_BASIC[56] = 1` (a FRED-capable processor) is that restriction lifted.

### F4 — `intel-vt/references/04-vm-entry.md:295` — type 7 has three vectors, not one
**Correct:** vector **0** = pending MTF VM exit; vector **1** = SYSCALL and vector **2** = SYSENTER when FRED transitions would be enabled following VM entry (§29.2.1.3).

### F5 — `intel-vt/references/07-apic-virtualization.md:253–259` — self-IPI virtualization drops the RVI update
**Correct (§32.1.5):**
```
VIRR[Vector] := 1;
RVI := max{RVI, Vector};        <-- missing from the skill
evaluate pending virtual interrupts;
```
Without the RVI update, evaluation (`RVI[7:4] > VPPR[7:4]`) can never see the new vector.

### F6 — `intel-vt/references/07-apic-virtualization.md:173, 181` — PPR virtualization is not unconditional inside TPR virtualization
**Correct (§32.1.2):**
```
IF "virtual-interrupt delivery" is 0
    THEN IF VTPR[7:4] < TPR threshold THEN cause VM exit due to TPR below threshold; FI;
    ELSE perform PPR virtualization; evaluate pending virtual interrupts;
FI;
```
PPR virtualization happens **only** on the virtual-interrupt-delivery = 1 path.

### F7 — `intel-vt/references/07-apic-virtualization.md:108` — APIC-register virtualization is not 4-byte-only
**Correct (§32.4.2, §32.4.3.1):** an access is virtualized unless it is larger than 32 bits, or is "not entirely contained within the low 4 bytes of a naturally aligned 16-byte region" (bits 3:2 of both the first and the highest byte address are 0). Sub-4-byte accesses within a register's low 4 bytes **are** virtualized.

### F8 — `intel-vt/references/07-apic-virtualization.md:390` — IPI-virtualization eligibility is mis-stated
**Correct (§32.5, §32.1.6.2):** all of — destination shorthand `00B`, trigger mode **edge** (bit 15 = 0), bit 12 = 0, destination mode **physical** (bit 11 = 0), delivery mode **fixed** (bits 10:8 = `000B`), and vector ≥ 16. "Flat mode" is a *logical*-destination model and is excluded by the physical-mode requirement, not a prerequisite.

### F9 — `intel-vt/references/06-address-translation.md:108` and `:149` — bit 63 lives in not-present entries too
**Correct (§31.3.2, §28.5.8.1):** in a not-present entry the processor "ignores bits **62:3**" — bit 63 still governs #VE convertibility, at **any** level, not just leaves. Practical impact: a VMM that zeroes an EPT PML4E/PDE for demand paging while "EPT-violation #VE" is 1 gets a guest-visible #VE unless it also sets bit 63 in that zeroed entry.

### F10 — `intel-vt/references/06-address-translation.md:386` — bit 57 gating and placement
**Correct (§31.3.3.2):** guest-paging verification runs only when **both** "guest-paging verification" **and** "EPT paging-write control" are 1; and bit 57 is read from the EPT leaf entry that maps the page containing the **final guest paging-structure entry** for the linear address, not the EPT leaf for the data page.

### F11 — `intel-vt/references/06-address-translation.md:67` (+ 251, 252, 254, 255, 256, 264, 273, 275, 301, 310, 446) — EP4TA no longer exists
**Correct:** rev 092 uses **EPTRTA** ("EPT root-table address"), defined in §31.4.2 as bits 51:12 of the EPTP. `EP4TA` appears **zero** times in Vol.3C rev 092 — the rename accompanied 5-level EPT (a 5-level root is a PML5 table, so "EP4TA" is no longer accurate). The numeric claim (bits 51:12) is right; the name a reader would grep for is not.

### F12 (anchor) — `intel-vt/references/06-address-translation.md:181, 182, 191, 192` — wrong section for the exit-qualification layout
**Correct anchor:** `[SDM 3C §30.2.1]` / Table 30-7 "Exit Qualification for EPT Violations". §27.9.1 explicitly defers ("See Section 30.2.1 for details") and does not list EPT violations among the exit-qualification causes at all.

### F13 (completeness) — `intel-vt/references/06-address-translation.md:404` — #VE conversion conditions are not exhaustive
**Correct (§28.5.8.1):** add **CR0.PE = 1**; **the logical processor is not in the process of delivering an event**; the EPT violation did not cause a shadow stack to become prematurely busy; and it did not result from Intel PT output or from PEBS.

---

## Smaller omissions worth a line each (not counted as WRONG)

- `06-address-translation.md` §6.2.1 omits the **CR0.CD = 1 ⇒ UC** override for both EPT-paging-structure accesses and translated guest-physical accesses (§31.3.7.1, §31.3.7.2).
- `06-address-translation.md:328` — §27.6.18 / §31.3.6 call the PML index a "VM-execution control field" while Appendix B and §27.4.2 place it in **guest** non-register state. The skill follows Appendix B, which is correct; the SDM contradicts itself here. Worth an `errata.md` note.
- `06-address-translation.md:370` and the SPP pseudocode test `E.write (bit 1) = 1 → allow` is narrower than §31.3.4.1, which makes an address eligible when bit 1 is clear in **any** EPT entry used in the translation, not just the leaf.
- `06-address-translation.md:164` folds "bit 7 at a level where the page size is unsupported" into the reserved-bit case; the SDM does the same via the Table 31-3 / 31-5 footnotes, so the paraphrase is sound.
- `07-apic-virtualization.md:200` evaluation pseudocode omits the SDM's `"interrupt-window exiting" is 0` conjunct (§32.2.1) and the SEAM `RVI < 31` clamp.
- `07-apic-virtualization.md:206` delivery conditions omit **POP SS** blocking and `"interrupt-window exiting" = 0` (§32.2.2).
- `07-apic-virtualization.md:358` merge pseudocode puts `ON <- 0` ahead of the local-APIC acknowledge; §32.6's order is ACK (1) → clear ON (3) → EOI write (4) → PIR merge (5). The load-bearing claim in §7.8.4 (ON cleared *before* PIR is read) is correct.
- `07-apic-virtualization.md:102` — APIC-access exit qualification bits 11:0 are **undefined** for guest-physical accesses (Table 30-6); for APIC-access exits from *physical* accesses the whole qualification is undefined (§30.2.1, §32.4.6).

---

# Addendum — anchor audit of `15-security.md` (requested follow-up)

All six queried sections were resolved directly against the extracted rev 092 Vol.3C body.

| Anchor | Verdict | Exact heading in rev 092 | What the section is actually about |
|---|---|---|---|
| `§31.2` *(control case)* | **EXISTS** | `31.2 HYPERVISOR-MANAGED LINEAR-ADDRESS TRANSLATION (HLAT)` | HLAT paging, HLATP, prefix size. Matches `06-address-translation.md`'s use. |
| `§31.3` | **EXISTS** | `31.3 THE EXTENDED PAGE TABLE MECHANISM (EPT)` | The EPT feature: overview, translation, EPT-induced VM exits, SPP, A/D flags, PML, memory typing. |
| `§31.3.2` | **EXISTS** | `31.3.2 EPT Translation Mechanism` | 4-level vs 5-level EPT, the walk, and Tables 31-1 … 31-7 (entry formats). Nothing else. |
| `§31.3.3.2` | **EXISTS** | `31.3.3.2 EPT Violations` | The architectural conditions that raise an EPT violation (read/write/execute denial, shadow-stack, guest-paging verification). |
| `§28.1.2` | **EXISTS** | `28.1.2 Instructions That Cause VM Exits Unconditionally` | A one-paragraph list: CPUID, GETSEC, INVD, XSETBV, INVEPT, INVVPID, SEAMCALL, TDCALL, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF, VMXON. |
| `§28.1.3` | **EXISTS** | `28.1.3 Instructions That Cause VM Exits Conditionally` | Per-instruction conditional-exit rules (CLTS, ENCLS, ENQCMD/ENQCMDS, HLT, IN/OUT, INVLPG, …). |

**So: none of the six section numbers is fabricated. The control case holds, and so do the other five.** The linter-evasion hypothesis is wrong in its "invented section numbers" form.

**But the weaker form of the suspicion is confirmed, and it is the damaging one: five of the six resolve to the wrong subject.** These are real Intel sections used as filler anchors on claims the SDM does not make.

### Vol.3C rev 092 does not discuss the subject matter at all

Whole-document case-insensitive counts over the 21,997-line extract:

| Term | Hits in Vol.3C rev 092 |
|---|---|
| `terminal fault` | **0** |
| `L1TF` / `L1 Terminal` | **0** / **0** |
| `transient execution` | **0** |
| `ZombieLoad`, `Downfall`, `Retbleed`, `retpoline` | **0** each |
| `MDS` | 12 — **all of them substrings of `ENQCMDS`**, none the microarchitectural-data-sampling sense |
| `speculativ*` | 1 — an Intel PT remark at line 17959, unrelated to mitigations |
| `IA32_FLUSH_CMD`, `IA32_ARCH_CAPABILITIES` | **0** each |
| `hyperthread` | **0** |
| `HVCI`, `Credential Guard`, `Virtual Trust Level`, `VTL`, `trustlet` | **0** each |

The only mitigation-adjacent section in the volume is **`§27.6.25 Fields Controlling Virtualization of the IA32_SPEC_CTRL MSR`** (`SPEC_CTRL`, 40 hits). `15-security.md` already cites it twice, correctly.

### Per-anchor subject match in `15-security.md`

Anchor histogram for the chapter: `§28.1.2` ×17, `§31.3.2` ×13, `§31.3` ×12, `§26.7` ×9, `§28.1.3` ×8, `§31.3.3.2` ×7, `§26.2` ×3, `§27.6.25` ×2, plus singletons.

- **`§28.1.2` (17 uses) — 1 correct, 16 mismatched.** Line 17 ("VMXON, VMLAUNCH, VMRESUME, VMCLEAR, VMPTRLD, VMPTRST, VMXOFF, VMCALL, INVEPT and INVVPID all cause VM exits unconditionally") is an exact, legitimate match to the section's instruction list. Every other use is a transient-execution or VBS claim: ZombieLoad/CVE-2018-12130 (`:192`), MDSUM/CVE-2019-11091 (`:194`), TAA/CVE-2019-11135 (`:204`), SRBDS/CVE-2020-0543 (`:212`), Retbleed/CVE-2022-29901 + INTEL-SA-00702 (`:230`), Downfall/CVE-2022-40982 (`:238`), sibling threads sharing L1D and fill buffers (`:71`), core scheduling and SMT capacity (`:252`), VBS implying permanent nesting (`:284`). A 16-line list of instruction mnemonics supports none of these.
- **`§31.3.3.2` (7 uses) — 0 correct.** Used for the L1TF CVE triple and INTEL-SA-00161 (`:170`), the terminal-fault mechanism (`:172`), PTE inversion (`:174`), Intel's "Disabling hyperthreading does not in itself provide mitigation for L1TF" quotation (`:184`), and Red Hat's "50% fewer vCPUs" capacity figure (`:186`). §31.3.3.2 is the EPT-violation condition list; `terminal fault`, `L1TF` and `hyperthread` each appear 0 times in the entire volume, so the quoted Intel sentence at `:184` cannot be from the SDM — it is from the L1TF guidance document (cited as `[352]`), and that is where the anchor should point.
- **`§31.3.2` (13 uses) — 0 fully correct.** Line 18 (guest-physical addresses are translated through EPT and a forbidden access raises an EPT violation) is close enough to be defensible. The rest are not: "Intel states that terminal faults can occur while reading EPT entries" (`:129`, `:172`) is a claim *about what Intel states*, and it is not in §31.3.2 — that section is only the walk and Tables 31-1 … 31-7. The HVCI W^X claims (`:298`, `:300`, `:302`) are Microsoft behaviour.
- **`§28.1.3` (8 uses) — 0 correct.** Every use is a device-model CVE or a risk-assessment statement: VENOM/CVE-2015-3456 in QEMU's floppy controller (`:40`), QEMU USB CVE-2020-14364 (`:42`), Hyper-V `vmswitch.sys` CVE-2021-28476 (`:44`), the 2025 Pwn2Own VMware PVSCSI escape (`:46`), attack-surface guidance (`:48`, `:59`, `:61`), and "VMX does not protect the VMM from its own device models" (`:25`). §28.1.3 is a list of conditional-exit rules for CLTS, ENCLS, HLT, IN/OUT and friends. Zero overlap.
- **`§31.3` (12 uses) — 0 correct.** Used for VTL0/VTL1 (`:278`), trustlets and IUM (`:282`), Microsoft's 16 architectural trust levels (`:288`), VBS enclaves (`:290`), HVCI (`:296`, `:306`), Credential Guard, LSAIso.exe, and Kerberos TGT scope (`:314`–`:320`). `VTL`, `trustlet`, `HVCI` and `Credential Guard` all return 0 hits in Vol.3C. §31.3 does supply the *underlying* EPT machinery these features are built on, so a "see also" reference is reasonable — but it is not a source anchor for a claim about which Windows credential types are protected.

### Conclusion

The section numbers are real; the sourcing is not. Roughly **44 of the chapter's ~115 claims** (17 + 13 + 12 + 8 + 7, less the two or three genuine matches) carry a Tier-1 Intel anchor for a proposition the cited section does not contain, and in most cases for a proposition **no** section of Vol.3C contains, because the volume does not cover transient execution, L1TF/MDS, or Windows VBS at all. The signature — a handful of real section numbers reused dozens of times across unrelated subject matter, concentrated in the one chapter whose content is mostly non-Intel — is exactly what a "every claim needs a Tier-1 anchor" linter produces when the underlying claims have no Tier-1 source.

**Recommended fix:** these claims should be anchored to the sources already present in their citation lists — Intel's L1TF / MDS / SRBDS / GDS security-guidance documents and advisories (`[350]`–`[371]`, INTEL-SA-00161 / 00702 / 00828), the CVE records (`[23]`), Microsoft's VBS/HVCI/Credential Guard documentation (`[378]`–`[385]`, `[395]`), Red Hat (`[376]`) and the vendor/QEMU advisories (`[393]`, `[394]`, `[377]`) — with the Intel anchor dropped or demoted to a "see also" pointing at `06-address-translation.md`. The one Intel anchor that genuinely belongs in a mitigation context is `§27.6.25` (IA32_SPEC_CTRL virtualization), which the chapter already uses correctly. Line 17's use of `§28.1.2` should be kept as-is.
