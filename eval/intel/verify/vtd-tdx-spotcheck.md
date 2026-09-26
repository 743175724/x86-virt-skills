# Adversarial spot-check: VT-d and TDX chapters vs. primary Intel specifications

Date: 2026-09-20. Independent audit. No skill file was modified.

## Sources actually obtained (all downloaded and text-extracted this session)

| Tag | Document | Cover as printed | Retrieval |
|---|---|---|---|
| VT-d | Intel VT for Directed I/O Architecture Specification | **April 2026, Revision 5.20, Order Number D51397-019** | `https://cdrdv2-public.intel.com/919688/D51397-019-vt-directed-io-spec.pdf` (12.8 MB) |
| TDX-BASE | Intel TDX Module Base Architecture Specification | **348549-008US, May 2026**, 209 pages | `https://cdrdv2.intel.com/v1/dl/getContent/733575` |
| TDX-ABI | Intel TDX Module ABI Reference Specification | **348551-008US, May 2026**, 335 pages | `https://cdrdv2.intel.com/v1/dl/getContent/733579` |
| SIOV | Intel Scalable I/O Virtualization Technical Specification | **September 2020, Order Number 337679-002, Rev 1.1** | `https://cdrdv2.intel.com/v1/dl/getContent/671403` (29 pages) |
| TDX-CONNECT | Intel TDX Connect Architecture Specification | **354629 003-US, June 2025**, 29 pages | `https://cdrdv2.intel.com/v1/dl/getContent/773614` |

Not obtained: Intel Trust Domain CPU Architectural Extensions (343754), TD Migration spec (348550),
TD Partitioning spec (354807), GHCI (348552). Claims resting solely on those are marked UNVERIFIABLE.

Extraction method: `pdftotext -layout` for prose and `pdftotext -table` for every bit-field and offset
table. Table mode was necessary wherever `-layout` produced column-shifted output, which it does
throughout VT-d Ch.11 and TDX ABI Table 5.4 — a naive `-layout` read of those tables is off by one row
and would itself manufacture errors.

---

## Per-claim results

### A. `10-vtd-dma-remapping.md` — register map, translation structures, invalidation

| # | Claim (abbreviated) | Anchor | Verdict |
|---|---|---|---|
| A1 | VER_REG 000h, CAP_REG 008h, ECAP_REG 010h, GCMD 018h, GSTS 01Ch, RTADDR 020h, CCMD 028h | §11.4 | CONFIRMED (each register's own "Register Offset" field) |
| A2 | FSTS 034h, FECTL 038h, FEDATA 03Ch, FEADDR 040h, FEUADDR 044h | §11.4 | CONFIRMED |
| A3 | PMEN 064h, PLMBASE 068h, PLMLIMIT 06Ch, PHMBASE 070h, PHMLIMIT 078h | §11.4 | CONFIRMED (PMEN 064h explicit) |
| A4 | IQH 080h, IQT 088h, IQA 090h, ICS 09Ch, IQERCD 0B0h | §11.4 | CONFIRMED |
| A5 | Invalidation completion event ctrl/data/addr/upper = 0A0h/0A4h/0A8h/0ACh | §11.4 | CONFIRMED (spec names them "Invalidation Event …" — cosmetic difference) |
| A6 | IRTA_REG at 0B8h | §11.4 | CONFIRMED |
| A7 | PQH 0C0h, PQT 0C8h, PQA 0D0h, PRS 0DCh, PECTL 0E0h | §11.4 | CONFIRMED |
| A8 | MTRRCAP 100h, MTRRDEF 108h | §11.4 | CONFIRMED |
| A9 | PERFCAP 300h, ECMD 400h, RDTC DC0h, VCMD E00h, VCCAP E30h | §11.4 | CONFIRMED |
| A10 | CAP_REG field map ND 2:0 … ESRTPS 63 (21 fields) | §11.4.2 | CONFIRMED (all 21) |
| A11 | **CAP_REG bits 3 and 23 are "marked Deprecated"** | §11.4.2 | **WRONG** — bit 23 is `DEP: Deprecated`; **bit 3 is `R: Reserved`, RsvdZ, default 0h** |
| A12 | CAP.ND 000b=16 … 100b=4K domains | §11.4.2 | CONFIRMED (spec also defines 101b=16K, 110b=64K, 111b reserved) |
| A13 | MGAW = N+1; 48-bit MGAW reports 47 (101111b) | §11.4.2 | CONFIRMED verbatim |
| A14 | SSLPS bit 0 = 2 MB, bit 1 = 1 GB, bits 2–3 reserved | §11.4.2 | CONFIRMED |
| A15 | First fault recording register = X + (16 * FRO) | §11.4.2 | CONFIRMED verbatim |
| A16 | NFR: count = N+1, minimum one (NFR=0), maximum 256 | §11.4.2 | CONFIRMED |
| A17 | MAMV = max AM for IVA_REG and iotlb_inv_dsc, valid only when PSI Set | §11.4.2 | CONFIRMED |
| A18 | ECAP_REG bits 0–39 map (C, QI, DT, IR, EIM, PT, SC, IRO, MHMV, MTS, NEST, PRS, ERS, SRS, NWFS, EAFS, PSS) | §11.4.3 | CONFIRMED |
| A19 | ECAP_REG bits 40–62 map (PASID 40 … IRREQ 62) | §11.4.3 | CONFIRMED (all 21, incl. TDXCS 50, RPRIVS 53, HPTS 55, PTRS 56, SSIRWS 57, SMS 58, HPT1GPS 59, RDTS 60, EIMER 61, IRREQ 62) |
| A20 | ECAP bits 5, 24, 28 Deprecated | §11.4.3 | CONFIRMED (all three read `DEP: Deprecated`) |
| A21 | IOTLB registers at X + (16 * IRO) | §11.4.3 | CONFIRMED verbatim |
| A22 | GCMD: TE 31, SRTP 30, WBF 27, QIE 26, IRE 25, SIRTP 24, CFI 23; 29:28 and 22:0 reserved | §11.4.4.1 | CONFIRMED |
| A23 | GSTS mirrors GCMD (TES 31 … CFIS 23); 29:28, 22:0 reserved | §11.4.4.2 | CONFIRMED |
| A24 | GCMD update pseudocode with mask **96FFFFFFh** | §11.4.4.1 | CONFIRMED verbatim ("Status = (Tmp & 96FFFFFFh) // Reset the one-shot bits") |
| A25 | RTADDR: TTM 11:10, SSIRWE bit 7, RTA 63:12 | §11.4.5 | CONFIRMED |
| A26 | CCMD: ICC 63, CIRG 62:61, CAIG 60:59, FM 33:32, SID 31:16, DID 15:0 | §11.4.6.1 | CONFIRMED |
| A27 | CIRG: 01b global, 10b domain-selective, 11b device-selective | §11.4.6.1 / §6.5.2.1 | CONFIRMED (00b reserved) |
| A28 | IOTLB regs = IVA_REG at IRO offset, IOTLB_REG at +008h | §11.4.6.2 | CONFIRMED verbatim |
| A29 | IOTLB_REG: IVT 63, IIRG 61:60, IAIG 58:57, DR 49, DW 48, DID 47:32 | §11.4.6.3 | CONFIRMED |
| A30 | IVA_REG: ADDR 63:12, IH 6, AM 5:0 | §11.4.6.4 | CONFIRMED |
| A31 | PMEN: EPM bit 31, PRS bit 0 | §11.4.8.1 | CONFIRMED |
| A32 | Root-entry: P 0, rsvd 11:1, CTP 63:12, rsvd 127:64 | §9.1 | CONFIRMED |
| A33 | SM root-entry: LP 0, LCTP 63:12, UP 64, UCTP 127:76, rsvd 75:65 | §9.2 | CONFIRMED |
| A34 | Context-entry: P 0, FPD 1, TT 3:2, SSPTPTR 63:12, AW 66:64, IGN 70:67, DID 87:72 | §9.3 | CONFIRMED |
| A35 | SM context-entry 256-bit: P 0, FPD 1, DTE 2, PASIDE 3, PRE 4, HPTE 5, EPTR 6, PDTS 11:9, PASIDDIRPTR 63:12, RID_PASID 83:64, RID_PRIV 84 | §9.4 | CONFIRMED |
| A36 | PDTS = X → 2^(X+7) directory entries | §9.4 | CONFIRMED verbatim |
| A37 | DTE=0 with PRE=1 illegal → fault 43h | §7.1.3 | CONFIRMED (SCT.4.1) |
| A38 | SM PASID-dir entry: P 0, FPD 1, rsvd 11:2, SMPTBLPTR 63:12 | §9.5 | CONFIRMED |
| A39 | SM PASID-table entry is 512 bits | §9.6 | CONFIRMED (table runs to bit 511) |
| A40 | PASID-table entry low half: P 0, FPD 1, AW 4:2, PGTT 8:6, SSADE 9, SSPTPTR 63:12, DID 79:64 | §9.6 | CONFIRMED |
| A41 | PASID-table entry high half: PWSNP 87, PGSNP 88, PAT 127:96, SRE 128, FSPM 131:130, WPE 132, EAFE 135, FSPTPTR 191:140 | §9.6 | CONFIRMED |
| A42 | FS-PTE 4 KB: P0 R/W1 U/S2 PWT3 PCD4 A5 D6 PAT7 G8 EA10, ADDR (HAW-1):12, 51:HAW rsvd, 63:52 IGN | §9.7 | CONFIRMED |
| A43 | G bit ignored, hardware acts as if Clear | §9.7 | CONFIRMED verbatim |
| A44 | FS PDPE 1 GB rsvd 29:13; FS PDE 2 MB rsvd 20:13 | §9.7 | CONFIRMED |
| A45 | SS-PTE 4 KB: R0 W1 EMT5:3 IPAT6 A8 D9 SNP11 ADDR(HAW-1):12 IR61 IW62 | §9.8 | CONFIRMED |
| A46 | SS 1 GB rsvd 29:12; SS 2 MB rsvd 20:12 | §9.8 | CONFIRMED |
| A47 | Descriptor Type = concatenation of bits 11:9 and 3:0, 7 bits | §6.5.2 | CONFIRMED verbatim |
| A48 | Types 1h cc, 2h iotlb, 3h dev_tlb, 4h iec, 5h wait | §6.5.2.1/.3/.5/.8/.9 | CONFIRMED, and all five section anchors resolve |
| A49 | Types 6h p_iotlb, 7h pc, 8h p_dev_tlb, Ah HPT | §6.5.2.4/.2/.6/.7 | CONFIRMED, anchors resolve |
| A50 | Page Group Response Descriptor is Type 9h | §7.6.1 | CONFIRMED |

### B. `11-vtd-interrupt-remapping.md` — IRTE formats and IR faults

| # | Claim | Anchor | Verdict |
|---|---|---|---|
| B1 | Remappable address: 31:20 Interrupt Identifier (FEEh), 19:5 Handle[14:0], 4 Interrupt Format, 3 SHV, 2 Handle[15], 1:0 don't care | §5.1.2.2 Table 13 | CONFIRMED verbatim |
| B2 | 16-bit Handle → 64K unique interrupt requests per unit | §5.1.2.2 | CONFIRMED verbatim |
| B3 | IRTA_REG 0B8h: IRTA 63:12, EIME 11, rsvd 10:4, S 3:0 | §11.4.10 | CONFIRMED |
| B4 | Table size = 2^(S+1) | §11.4.10 | CONFIRMED ("number of entries … is 2^(X+1)") |
| B5 | EIME=0 → hardware interprets only Destination-ID bits 15:8; EIME=1 → all 32 bits | §11.4.10 | CONFIRMED verbatim |
| B6 | EIME RsvdZ when ECAP.EIM Clear; must be Set when EIMER Set; must not change while IRES=1 | §11.4.10 | CONFIRMED (all three) |
| B7 | Remapped IRTE: P0 FPD1 DM2 RH3 TM4 DLM7:5 AVAIL11:8 rsvd14:12 IM15 V23:16 rsvd31:24 DST63:32 | §9.9 | CONFIRMED |
| B8 | Remapped IRTE: SID 79:64, SQ 81:80, SVT 83:82, rsvd 127:84 | §9.9 | CONFIRMED |
| B9 | SVT=10b uses SID upper 8 bits as Startbus#, lower 8 as Endbus# | §9.9 | CONFIRMED verbatim |
| B10 | Posted IRTE: P0 FPD1 rsvd7:2 AVAIL11:8 rsvd13:12 URG14 IM15 VV23:16 rsvd37:24 | §9.10 | CONFIRMED |
| B11 | Posted IRTE: PDAL 63:38, SID 79:64, SQ 81:80, SVT 83:82, rsvd 95:84, PDAH 127:96 | §9.10 | CONFIRMED |
| B12 | IR fault reasons 20h–2Bh and their conditions | §5.1.4.1 Table 15 | CONFIRMED (all twelve conditions match) |
| B13 | **Qualified column: 25h = Yes** | §5.1.4.1 Table 15 | **WRONG** — Table 15 reads **No** |
| B14 | **Qualified column: 27h = No** | §5.1.4.1 Table 15 | **WRONG** — Table 15 reads **Yes** |
| B15 | **Qualified column: 28h = No** | §5.1.4.1 Table 15 | **WRONG** — Table 15 reads **Yes** |
| B16 | 20h/21h/23h/29h not qualified; 22h/24h/26h qualified | §5.1.4.1 | CONFIRMED |
| B17 | IR faults non-recoverable, treated as Unsupported Request | §5.1.4.1 | CONFIRMED (Behavior column: "Unsupported Request") |

### C. `12-vtd-faults-bios-siov.md` — faults, DMAR, SIOV

| # | Claim | Anchor | Verdict |
|---|---|---|---|
| C1 | Only Primary Fault Logging is defined; must be supported by all implementations | §7.2 | CONFIRMED verbatim |
| C2 | **Advanced fault logging deprecated / absent in Rev 5.20** | §7.2 + revision history | CONFIRMED that Rev 5.20 defines Primary Fault Logging only. Caveat: the revision history attributes "Removal of Advanced Fault Logging" to **Rev 4.0** |
| C3 | Fault Recording Register: F127 T1 126 AT125:124 PV123:104 FR103:96 PP95 EXE94 PRIV93 T2 92 rsvd91:80 SID79:64 FI63:12 rsvd11:0 | §11.4.7.6 | CONFIRMED (exact) |
| C4 | F is RW1CS/sticky; PV is 20 bits, valid only when PP Set | §11.4.7.6 | CONFIRMED |
| C5 | Type split across T1 (126) and T2 (92) | §11.4.7.6 | CONFIRMED ("expands the Type field from 1-bit to 2-bit") |
| C6 | FSTS: PFO0 PPF1 IQE4 ICE5 ITE6 FRI15:8; 3:2 and 31:16 rsvd; bit 7 Deprecated | §11.4.7.1 | CONFIRMED (bit 7 literally `DEP: Deprecated`) |
| C7 | PFO/IQE/ICE/ITE RW1CS; PPF/FRI read-only | §11.4.7.1 | CONFIRMED (ROS for PPF/FRI) |
| C8 | FECTL: IM bit 31 default 1, IP bit 30 RO, 29:0 RsvdP | §11.4.7.2 | CONFIRMED |
| C9 | Fault-reason ranges: legacy 1h–Eh, IR 20h–2Bh, RTA 30h–34h, scalable 38h–A5h, non-overlapping | Ch.7 / §7.1.3 | CONFIRMED |
| C10 | Legacy 1h LRT.2, 2h LCT.2, 3h LCT.4, 4h LGN.1, 5h LGN.2, 6h LGN.3, 7h LSS.1, 8h LRT.1, 9h LCT.1, Ah LRT.3, Bh LCT.3, Ch LSS.2, Dh LCT.5, Eh LGN.4 | §7.1.3 Table 30 | CONFIRMED (all 14 code/mnemonic pairs) |
| C11 | RTA.1 30h, RTA.2 31h, RTA.3 32h, RTA.4 33h, RTA.5 34h | §7.1.3 | CONFIRMED |
| C12 | SRT 38h–3Ah, SCT 40h–49h, SPD 50h–52h, SPT 58h–60h, SFS 70h–77h + 90h–91h, SSS 78h–7Dh, SGN 80h–89h, HPT A0h–A5h | §7.1.3 | CONFIRMED (every mnemonic/number pair matched) |
| C13 | 43h covers DTE=0&PRE=1, RID_PASID > PDTS max, EPTR/PASIDE inconsistency | §7.1.3 | CONFIRMED |
| C14 | 46h = request PASID larger than PDTS max in SM context-entry | §7.1.3 | CONFIRMED verbatim |
| C15 | 5Ch = Major Version 7 and below with ER Set | §7.1.3 | CONFIRMED |
| C16 | 89h = PASID exceeds PSS in ECAP | §7.1.3 | CONFIRMED |
| C17 | Page Request Descriptor: Type 01h 7:0, PP8, RID31:16, PASID51:32, EXR52, PMR53, RDR64, WRR65, LPIG66, PRGI75:67, ADDR127:76 | §7.4.1.1 | CONFIRMED (field prose and figure bit boundaries both match) |
| C18 | PRGI is 9 bits; undefined if RDR and WRR both 0 | §7.4.1.1 | CONFIRMED verbatim |
| C19 | RID upper 8 bits = bus, lower 8 = device+function | §7.4.1.1 | CONFIRMED verbatim |
| C20 | PRS_REG: PPR0, PRO1, both RW1CS, 31:2 rsvd | §11.4.11.4 | CONFIRMED |
| C21 | PQH/PQT carry offsets in bits 18:5; 4:0 and 63:19 rsvd | §11.4.11.1/.2 | CONFIRMED |
| C22 | PQA: PQA 63:12, PQS 2:0, 11:3 rsvd | §11.4.11.3 | CONFIRMED |
| C23 | DMAR header: Signature 0, Length 4, Revision 8, Checksum 9, OEMID 10, OEM Table ID 16, OEM Rev 24, Creator ID 28, Creator Rev 32 | §8.1 | CONFIRMED |
| C24 | HAW 1 byte at 36, HAW = N+1, 40-bit platform reports 100111b | §8.1 | CONFIRMED verbatim |
| C25 | Flags 1 byte at 37, 10 reserved bytes at 38, structures at 48 | §8.1 | CONFIRMED |
| C26 | Flags bit0 INTR_REMAP, bit1 X2APIC_OPT_OUT, bit2 DMA_CTRL_PLATFORM_OPT_IN_FLAG, bit3 DMA_REMAP_OPT_OUT, bits 7:4 reserved | §8.1 | CONFIRMED (all four, incl. the IRREQ and EIMER couplings) |
| C27 | Structure types 0 DRHD, 1 RMRR, 2 ATSR, 3 RHSA, 4 ANDD, 5 SATC, 6 SIDP, >6 reserved | §8.2 | CONFIRMED |
| C28 | Every structure starts with 2-byte Type then 2-byte Length; numerical order; skip by Length | §8.2 | CONFIRMED verbatim |
| C29 | DRHD: Type 2@0, Length 2@2, Flags 1@4, Size 1@5, Segment 2@6, Register Base 8@8; length 16 + device scope | §8.3 | CONFIRMED |
| C30 | DRHD Size bits 3:0 → 2^N 4 KB pages (2^(N+12) bytes), bits 7:4 reserved | §8.3 | CONFIRMED verbatim |
| C31 | **SIOV cover reads "September 2020, Order Number 337679-002, Rev 1.1"** | SIOV cover | **CONFIRMED verbatim.** The "Rev 1.0" in secondary sources is wrong |
| C32 | SIOV §1.2.3: all ADIs share the function's Requester ID; PASIDs distinguish; 20-bit PASID in a PASID TLP Prefix | SIOV §1.2.3 | CONFIRMED verbatim |
| C33 | SIOV §3.1 describes "three-stage" scalable-mode translation, with the three steps as stated | SIOV §3.1 | CONFIRMED verbatim |
| C34 | SIOV §3.2 interrupt-isolation wording; §3.3 is PASID translation | SIOV §3.2/§3.3 | CONFIRMED |
| C35 | SIOV anchors §1.2.1/1.2.2/1.2.4/2.2/2.5.1/2.5.2/4.1–4.4 | SIOV TOC | CONFIRMED — every anchor resolves to the named section |

### D. `13-tdx.md` — leaf numbers, Secure EPT, TDREPORT, TDX Connect

| # | Claim | Anchor | Verdict |
|---|---|---|---|
| D1 | TDX-BASE is 348549-008US, May 2026, 209 pages | cover | CONFIRMED |
| D2 | TDX-ABI is 348551-008US, May 2026, 335 pages | cover | CONFIRMED |
| D3 | SEAMCALL RAX: 15:0 leaf, 23:16 version, bit 63 must be 0; **bits 62:24 reserved** | §5.4.1 Table 5.2 | UNSUPPORTED — bit **24 is INTERRUPT_MODE** (a common field, not leaf-defined); reserved is **62:25**; bit 63 is P-SEAMLDR |
| D4 | TDCALL RAX: 15:0 leaf, 23:16 version, 63:24 reserved must be 0; 64-bit mode only | §5.5.1 Table 5.245 | CONFIRMED verbatim |
| D5 | TDH.SYS.INIT 33, LP.INIT 35, SYS.CONFIG 45, SYS.KEY.CONFIG 31, SYS.TDMR.INIT 36 | Table 5.4 + per-leaf tables | CONFIRMED (all 5) |
| D6 | TDH.SYS.INFO 32, SYS.RD 34, SYS.RDALL 37, SYS.WR 63 | same | CONFIRMED |
| D7 | TDH.SYS.SHUTDOWN 52, SYS.UPDATE 53, SYS.DISABLE 69, SYS.LP.SHUTDOWN 44 (deprecated no-op) | same | CONFIRMED (§5.4.71 states leaf 44 and "deprecated; provided for backward compatibility") |
| D8 | TDH.EXT.INIT 60, TDH.EXT.MEM.ADD 61, marked unreleased preview | §5.4.12/.13 | CONFIRMED (numbers and the "Unreleased Feature" banner) |
| D9 | TDH.MNG.CREATE 9, KEY.CONFIG 8, ADDCX 1, INIT 21, VPFLUSHDONE 19, KEY.FREEID 20, RD 11, WR 13, KEY.RECLAIMID 27 | Table 5.4 + per-leaf | CONFIRMED (all 9; §5.4.50 is titled "(Deprecated)" and "does not do anything") |
| D10 | **TDH.VP.ENTER = leaf 0** | Table 5.4 | CONFIRMED. Note: the spec contradicts itself — §5.4.81.1.1 Table 5.214 prints "Leaf Number … : 10", colliding with TDH.VP.CREATE. Table 5.4 (the authoritative summary) says 0; the chapter is right |
| D11 | TDH.VP.CREATE 10, ADDCX 4, INIT 22, FLUSH 18, RD 26, WR 43 | Table 5.4 + per-leaf | CONFIRMED |
| D12 | TDH.PHYMEM.PAGE.RECLAIM 28, PAGE.WBINVD 41, CACHE.WB 40, PAGE.RDMD 24, PAMT.ADD 58, PAMT.REMOVE 59 | same | CONFIRMED |
| D13 | TDH.MEM.SEPT.ADD 3, SEPT.REMOVE 30, SEPT.RD 25 | same | CONFIRMED |
| D14 | TDH.MEM.PAGE.ADD 2, PAGE.AUG 6, PAGE.REMOVE 29, PAGE.RELOCATE 5, DEMOTE 15, PROMOTE 23 | same | CONFIRMED |
| D15 | TDH.MEM.RANGE.BLOCK 7, RANGE.UNBLOCK 39, TRACK 38, MEM.RD 12, MEM.WR 14 | same | CONFIRMED |
| D16 | TDH.MR.EXTEND 16, MR.FINALIZE 17 | same | CONFIRMED |
| D17 | TDH.SERVTD.BIND 48, SERVTD.PREBIND 49 | Table 5.4 | CONFIRMED (REBIND, left un-numbered in the chapter, is 97) |
| D18 | TDH.INTR.CONFIG 62 | Table 5.4 | CONFIRMED |
| D19 | TDH.MEM.SCAN.RANGE 92, COMP 93, CONFIG 94, RESET 95 | Table 5.4 | CONFIRMED |
| D20 | **"leaf numbers at and above 96 are used by TDX Connect functions such as TDH.MMIO.MAP, TDH.IQ.INV.REQUEST, TDH.MEM.SHARED.SEPT.WR and TDH.TDI.MT.*"** | Table 5.4 | **WRONG** — 96 = TDH.MIG.STREAM.CREATE, 97 = TDH.SERVTD.REBIND. TDX Connect starts at **128** (TDH.IOMMU.SETUP). The four named leaves are **158, 161, 163 and 164–166** |
| D21 | Migration leaves occupy 64–75 (TDH.EXPORT.*) and 80–87 (TDH.IMPORT.*) | Table 5.4 | UNSUPPORTED — 80–87 correct; within 64–75, leaf **69 is TDH.SYS.DISABLE**, not an export leaf. TDH.MIG.STREAM.CREATE is 96, not adjacent; TDH.MIG.SETUP/.SETUP.ABORT carry no number in Table 5.4 |
| D22 | TDG.VP.VMCALL 0, VP.INFO 1, VEINFO.GET 3, CPUIDVE.SET 5, VP.RD 9, VP.WR 10 | §5.5.1.4 Table 5.247 | CONFIRMED |
| D23 | TDG.VP.ENTER 25, INVEPT 26, INVGLA 27 | same | CONFIRMED |
| D24 | TDG.MEM.PAGE.ACCEPT 6, ATTR.RD 23, ATTR.WR 24, RELEASE 30 | same | CONFIRMED |
| D25 | TDG.MR.REPORT 4, RTMR.EXTEND 2, VERIFYREPORT 22, ASSIGNSVNS 28, KEY.GET 29 | same | CONFIRMED |
| D26 | TDG.VM.RD 7, VM.WR 8, SYS.RD 11, SYS.RDALL 12 | same | CONFIRMED |
| D27 | TDG.SERVTD.RD 18, SERVTD.WR 20, SERVTD.REBIND.APPROVE 33 | same | CONFIRMED |
| D28 | TDG.INTR.POST 32 | same | CONFIRMED |
| D29 | Guest TDX Connect leaves: SPDM.TPA.SET/GET 64/65, TDI.VALIDATE 66, TDI.RD 67, TDI.REQUEST 68, DMAR.ACCEPT 70, TDI.MMIO.ACCEPT 71, IQ.INV.REQUEST 72, DMAR.RELEASE 73, IQ.INV.STATUS 74 | Table 5.247 | CONFIRMED (all ten) |
| D30 | Secure EPT holds a state value encoded by multiple bits; entry opaque to the VMM; read via TDH.MEM.SEPT.RD | TDX-BASE §9.2.1 | CONFIRMED verbatim |
| D31 | The 20 L1 SEPT states, in the order listed (FREE … MMIO_PENDING) | TDX-BASE §9.2.1 Table 9.1 | CONFIRMED — exact set and exact order |
| D32 | FREE maps no GPA range; REMOVE_IN_PROGRESS = interrupted TDH.MEM.PAGE.REMOVE | TDX-BASE §9.2.1 | CONFIRMED |
| D33 | BLOCKED = mapped but new translations blocked; BLOCKEDW = write translations blocked | TDX-BASE §9.2.1 | CONFIRMED |
| D34 | TDREPORT_STRUCT = REPORTMACSTRUCT + TEE_TCB_INFO + TDINFO_STRUCT | TDX-ABI §3.9.2 | CONFIRMED verbatim |
| D35 | Layout: REPORTMACSTRUCT 0 (256 B), TEE_TCB_INFO 256 (239 B), 17 reserved bytes at 495, TDINFO at 512 | TDX-ABI §3.9.2 Table 3.46 | CONFIRMED exactly |
| D36 | Size: VERSION 0 and 1 → 1024 B; VERSION 2 (if supported) → 1280 B; size from MAX_TDREPORT_SIZE via TDG.SYS.RD | TDX-ABI §3.9.2 | CONFIRMED verbatim |
| D37 | REPORTMACSTRUCT: CPUSVN 16 B, TEE_TCB_INFO_HASH 48 B, TEE_INFO_HASH 48 B, REPORTDATA 64 B, MAC 32 B, MAC over first 224 bytes | TDX-ABI §3.9.5 Table 3.48 | CONFIRMED (MAC at offset 224; every field at 0–223 marked "MAC: Yes") |
| D38 | MAC is HMAC-SHA-256 with CR_REPORT_MAC_KEY | TDX-ISA Ch.6/7 | UNVERIFIABLE — TDX-ISA (343754) not retrieved; the ABI says only "model-specific MAC" |
| D39 | TEE_TCB_INFO is 239 bytes, defined by the architectural-extensions spec | TDX-ABI §3.9.3 | CONFIRMED verbatim |
| D40 | **TDX Connect cover reads 354629-003, not the widely-repeated -004** | TDX-CONNECT cover | **CONFIRMED.** `cdrdv2.intel.com/v1/dl/getContent/773614` serves **"354629 003-US, June 2025"** on the cover and in all 29 page footers |
| D41 | TDH.TDI.* / TDH.MMIO.* host commands are "at leaf numbers 96 and above" (§13.18) | Table 5.4 | **WRONG** — TDH.TDI.* are 136–141 and 164–166; TDH.MMIO.* are 154–160 |

**Totals: 143 claims checked — 132 CONFIRMED, 6 WRONG, 4 UNSUPPORTED, 1 UNVERIFIABLE.**

---

## Findings and corrections

### F1 — CAP_REG bit 3 is Reserved, not Deprecated (WRONG)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\10-vtd-dma-remapping.md:345`

> "CAP_REG bits 3 and 23 are marked Deprecated in Rev 5.20 and must be reported as 0 for backward compatibility."

Rev 5.20 §11.4.2 gives bit 23 as `DEP: Deprecated` with "This field must be reported as 0 to ensure
backward compatibility with older software", but bit 3 as:

```
 3   RsvdZ   0h   R: Reserved   • Reserved.
```

The spec deliberately distinguishes the two labels — ECAP bits 5, 24 and 28 are all `DEP: Deprecated`,
and CAP bit 23 is too, but CAP bit 3 (formerly Advanced Fault Logging) is plain Reserved.

Correction: "CAP_REG bit 23 is marked Deprecated and must be reported as 0; bit 3 is Reserved (RsvdZ)."
The same defect appears in the pitfall at `10-vtd-dma-remapping.md:533`.

### F2 — Three inverted entries in the interrupt-remapping Qualified column (WRONG x3)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\11-vtd-interrupt-remapping.md:269, :271, :272`

VT-d 5.20 §5.1.4.1 Table 15 "Interrupt Remapping Fault Conditions" reads:

| Reason | Spec "Qualified" | Chapter says |
|---|---|---|
| 25h | **No** | Yes |
| 27h | **Yes** | No |
| 28h | **Yes** | No |

The spec's assignment is the sensible one: 25h (compatibility-format request blocked) is detected before
any IRTE is consulted, so no FPD bit exists to suppress it; 27h and 28h are posted-descriptor errors
reached *through* a present IRTE, whose FPD does apply. The chapter has these exactly inverted.

Fix: line 269 → `| No |`; lines 271 and 272 → `| Yes |`.

### F3 — TDX Connect SEAMCALL leaves do not start at 96 (WRONG x2)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\13-tdx.md:196`
`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\13-tdx.md:490`

TDX-ABI 348551-008US Table 5.4 assigns:

- 96 `TDH.MIG.STREAM.CREATE`, 97 `TDH.SERVTD.REBIND` — neither is a TDX Connect function;
- TDX Connect begins at **128** `TDH.IOMMU.SETUP`, then 129 `TDH.IOMMU.CLEAR`,
  130–131 `TDH.SPDM.CREATE/DELETE`, 132–135 `TDH.IDE.STREAM.*`,
  136–141 `TDH.TDI.BIND/CREATE/REMOVE/GET.STATE/START/STOP`,
  142–144 `TDH.SPDM.CONNECT/DISCONNECT/MNG`, 150–153 `TDH.DMAR.*`,
  154–160 `TDH.MMIO.*` (158 = `TDH.MMIO.MAP`), 161–162 `TDH.IQ.INV.REQUEST/PROCESS`,
  163 `TDH.MEM.SHARED.SEPT.WR`, 164–166 `TDH.TDI.MT.ADD/REMOVE/RD`.

Correction for both lines: "leaf numbers 128 and above are used by TDX Connect functions
(`TDH.IOMMU.SETUP` 128 … `TDH.MMIO.MAP` 158, `TDH.IQ.INV.REQUEST` 161,
`TDH.MEM.SHARED.SEPT.WR` 163, `TDH.TDI.MT.*` 164–166); leaves 96 and 97 are
`TDH.MIG.STREAM.CREATE` and `TDH.SERVTD.REBIND`."

### F4 — SEAMCALL RAX bit 24 is INTERRUPT_MODE (UNSUPPORTED)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\13-tdx.md:142` says "bits 62:24 are
reserved and must be 0 unless a specific leaf defines them". TDX-ABI Table 5.2 defines bit 24 as
`INTERRUPT_MODE`, a *common* field gated on `TDX_FEATURES0.HOST_SIDE_INTERRUPT_MODE` (bit 62) and simply
ignored by non-interruptible interface functions — not leaf-defined. Reserved is 62:25. Bit 63 is
`P-SEAMLDR` and must be 0 for TDX Module interface functions.

### F5 — The 64–75 migration range contains a non-migration leaf (UNSUPPORTED)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\13-tdx.md:195`. Leaf 69 inside that range
is `TDH.SYS.DISABLE`; 64–68 and 70–75 are `TDH.EXPORT.*`. The chapter itself correctly states
`TDH.SYS.DISABLE (69)` at line 149, so the two claims contradict each other.
`TDH.MIG.STREAM.CREATE` is 96, not "alongside" 64–87.

### F6 — "Advanced fault logging removed in Rev 5.20" is a revision misattribution (minor)

`C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\references\12-vtd-faults-bios-siov.md:33`
and the pitfall at `:421-422`. Rev 5.20 does define Primary Fault Logging only, so the statement is true, but
the VT-d revision history attributes "Removal of Advanced Fault Logging" to **Rev 4.0**. Anyone citing
5.20 as the removing revision is one revision off.

### Both authoring-time findings independently confirmed

- **SIOV Rev 1.1.** The PDF cover and every page footer read "Intel Scalable I/O Virtualization -
  Rev 1.1, September 2020 / Order No. 337679-002". The "Rev 1.0" in secondary sources is wrong.
- **TDX Connect 354629-003.** The content endpoint `cdrdv2.intel.com/v1/dl/getContent/773614` serves
  354629 003-US, June 2025. The intel.com content-details page for 773614 labels "354629 004-US
  (Latest)" with a 2023-03-15 date the document does not carry, and the static mirror
  `cdrdv2-public.intel.com/773614/intel-tdx-connect-architecture-specification.pdf` serves an older
  **354629 001-US, March 2023**. The chapter's note is accurate; "-004" is a landing-page artifact, not
  a document anyone is currently serving.

### Observations that are not errors

- The TDX ABI contains an internal inconsistency the chapter navigated correctly: §5.4.81 Table 5.214
  prints leaf number 10 for `TDH.VP.ENTER`, colliding with `TDH.VP.CREATE`. Table 5.4 says 0.
- Rev 5.20 names the 0A0h–0ACh group "Invalidation Event …" registers; the chapter calls them
  "Invalidation Completion Event …". Offsets are right; the name is the Rev 4.x spelling.
- The VT-d revision history records "Deprecated Register Based Invalidation (Section 6.5.1)" (May 2022).
  Chapter §10.6.2 documents register-based invalidation without flagging that deprecation.
- Chapter §10.4.6's PASID-table-entry table omits CD (bit 89), EMTE (bit 90) and the HPT fields
  (HPTSZ 257:256, HPT prefetch-disable 258, HPT root pointer at 268, and the 335:320 field).
  Incomplete, not incorrect — and §10.4.8 does reference EMTE by name.

## Verdict on the PDF-verification claim

**It largely holds, with three genuine defects.** Every section anchor sampled resolved to the right
section of the right document — §9.1–§9.10, §11.4.x, §6.5.2.x, §7.1.3, §8.1–§8.3 in VT-d; §1.2.x, §2.x,
§3.x, §4.x in SIOV; §5.4.x/§5.5.x/§3.9.x in the TDX ABI; §9.2.1 in the TDX Base spec. The bit-exact
content that a from-memory author reliably gets wrong is right here: the 96FFFFFFh mask, `2^(X+7)` for
PDTS, MGAW's 101111b example, FSPTPTR at 191:140, the T1/T2 split at 126/92, all 14 legacy and roughly
40 scalable fault-reason codes with their mnemonics, all ten invalidation descriptor types *with their
section numbers*, the complete 20-state Secure-EPT list in source order, the TDREPORT 0/256/495/512
offsets, and roughly 60 TDX leaf numbers. That is not reconstructable from memory. Both revision
findings the author flagged are real, and one of them (TDX Connect) required noticing that two Intel
URLs for the same document serve different revisions.

The three defects cluster where the source table itself is awkward: an inverted narrow "Qualified"
column in VT-d Table 15, a "Deprecated" versus "Reserved" label conflation in CAP_REG, and a leaf-range
boundary in a TDX ABI table that spans four pages. All three are consistent with an author who did read
the PDFs but mis-parsed a shifted table column — the same trap this audit hit before switching from
`pdftotext -layout` to `pdftotext -table`. The set does not need redoing; these named fixes do.
