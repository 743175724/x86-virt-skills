# 12. VT-d Faults, BIOS Reporting, Performance Monitoring and SIOV

> **中文速览**：本章补齐旧版技能完全缺失的三块内容。第一块是**故障处理**：不可恢复故障与可恢复故障的分野、primary fault logging、Fault Recording Register 的逐位格式，以及一张覆盖 legacy 与 scalable 两套编码的**故障原因码表**（LRT/LCT/LSS/LGN/RTA/SRT/SCT/SPD/SPT/SFS/SSS/SGN/HPT）。第二块是可恢复故障路径：page request queue、page request descriptor 与 page group response。第三块是 **ACPI DMAR 表**及其七种子结构（DRHD/RMRR/ATSR/RHSA/ANDD/SATC/SIDP），外加性能监控与 SIOV。最后是安全面：DMA 攻击、pre-boot DMA 保护缺口，以及 5520/5500 #53 这条**Intel 自家的**中断重映射勘误。

**Maps to:** Intel VT-d Architecture Specification Rev 5.20 Ch.7 "Address Translation Faults", Ch.8 "BIOS Considerations", Ch.10 "Performance Monitoring" [8]; Intel Scalable I/O Virtualization Technical Specification [21]
**Owns:** VT-d fault taxonomy and fault-reason codes, fault recording registers, the page request queue and page group response flow, the ACPI DMAR table and its remapping structures, VT-d performance monitoring, SIOV/ADI, VT-d security considerations
**See also:** `10-vtd-dma-remapping.md` (register offsets, translation structures, invalidation), `11-vtd-interrupt-remapping.md` (interrupt-remapping fault reasons 20h–2Bh), `15-security.md` (platform security posture)

---

## 12.1 The two fault classes

VT-d splits translation failures along a single axis: can the request be retried after software fixes
something, or not?

- **Claim.** VT-d Chapter 7 is titled "Address Translation Faults" and distinguishes non-recoverable address translation faults (§7.1.1) from recoverable address translation faults (§7.1.2).  `[VT-d 5.20 Ch.7]` `[8]` `C:high` `V:durable`
- **Claim.** Memory requests that result in non-recoverable address translation faults are blocked by hardware, with the exact blocking method implementation-specific.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For faulting read requests from PCI Express devices, hardware indicates "Unsupported Request" (UR) or "Completer Abort" (CA) in the completion status field of the read completion.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Faulting write requests may be discarded in any manner convenient to the implementation, such as dropping the cycle, completing the write with all byte enables masked off, or redirecting to a catch-all memory location.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** When remapping hardware detects a recoverable fault on a translation request from a Device-TLB it is not reported to software as a fault; instead hardware sends a successful translation completion with limited or no permissions, and the Device-TLB detects the fault.  `[VT-d 5.20 §7.1.2]` `[8]` `C:high` `V:durable`
- **Claim.** A device may report a recoverable fault either in a device-specific manner or, if it supports the PCI Express Page Request Services capability, by issuing a page-request message to the remapping hardware.  `[VT-d 5.20 §7.1.2]` `[8][200]` `C:high` `V:durable`
- **Claim.** Device-TLB implementations must ensure that a device request which led to a reported translation fault does not reuse the same faulty translation on retry after software has signalled that the fault was handled.  `[VT-d 5.20 §7.1.2]` `[8]` `C:high` `V:durable`
- **Claim.** If a recoverable page fault is reported in a device-specific manner rather than through Page Request Services, software must itself ensure stale IOTLB entries in the remapping hardware are invalidated.  `[VT-d 5.20 §7.1.2]` `[8]` `C:high` `V:durable`

### 12.1.1 "Qualified" faults and FPD

- **Claim.** A non-recoverable fault condition is considered "qualified" if software can suppress reporting of the fault by setting one of the Fault Processing Disable (FPD) bits in the context-entry, scalable-mode context-entry, scalable-mode PASID-directory entry or scalable-mode PASID-table entry.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For a request encountering a qualified non-recoverable fault, if remapping hardware encountered any translation structure entry with FPD = 1, it must not report the fault to software.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`

## 12.2 Primary fault logging

Rev 5.20 defines exactly one non-recoverable fault logging method. Material describing an
"advanced fault logging" mode with a log buffer in memory is describing a revision older than 4.0,
where it was removed: the GCMD_REG bits that drove it (29 and 28) are reserved, CAP_REG bit 3 is
plain Reserved (RsvdZ) and bit 23 is the one marked Deprecated — see `10-vtd-dma-remapping.md` §10.5.1 and §10.5.3.

- **Claim.** The remapping architecture defines Primary Fault Logging as the default fault logging method that must be supported by all implementations of the architecture.  `[VT-d 5.20 §7.2]` `[8]` `C:high` `V:durable`
- **Claim.** The primary method for logging non-recoverable faults is through Fault Recording Registers, whose count is **CAP_REG.NFR + 1** (the NFR field reports N, not the count — a ring walk driven by NFR alone is short by one register) and whose base is **register-base + 16 × CAP_REG.FRO**, with FSTS_REG.FRI giving the index to start from; you cannot walk the fault ring without both → register layout in `10-vtd-dma-remapping.md` §10.5.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware maintains an internal index referencing the Fault Recording Register in which the next non-recoverable fault will be recorded; the index resets to zero when both TES and IES are Clear in the Global Status Register, increments on each recorded fault, and wraps from N-1 to 0.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware maintains the Primary Pending Fault (PPF) field in the Fault Status Register as the logical OR of the Fault (F) fields across all Fault Recording Registers, recomputed whenever any F field is updated by hardware or software.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** If the Fault Recording Register referenced by the internal index already has its F field Set, hardware sets the Primary Fault Overflow (PFO) field in the Fault Status Register and the new fault information is not recorded.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware compares the source-id of the currently faulting request against the SID field of each Fault Recording Register whose F field is Set, and does not record the fault information if it finds a match.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** When PPF is Clear at the time of recording, hardware records the internal index in the Fault Recording Index (FRI) field of the Fault Status Register, sets the F field, increments the internal index, and an interrupt may be generated.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Software is expected to process reported non-recoverable faults in circular FIFO fashion starting from the register referenced by FRI until it finds a Fault Recording Register with F Clear.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** To recover from a primary fault overflow, software must process the pending faults in every Fault Recording Register, clear each F field, and then clear PFO by writing 1 to it; hardware then resumes recording from the current internal index.  `[VT-d 5.20 §7.2.1]` `[8]` `C:high` `V:durable`

### 12.2.1 Fault Recording Register [n] (§11.4.7.6) — 128 bits

| Bits | Field |
|---|---|
| 127 | F — Fault |
| 126 | T1 — Type bit 1 |
| 125:124 | AT — Address Type |
| 123:104 | PV — PASID Value |
| 103:96 | FR — Fault Reason |
| 95 | PP — PASID Present |
| 94 | EXE — Execute |
| 93 | PRIV — Privilege Mode |
| 92 | T2 — Type bit 2 |
| 91:80 | Reserved |
| 79:64 | SID — Source Identifier |
| 63:12 | FI — Fault Info |
| 11:0 | Reserved |

- **Claim.** A Fault Recording Register is 128 bits with F at bit 127, T1 at bit 126, AT at bits 125:124, PV at bits 123:104, FR at bits 103:96, PP at bit 95, EXE at bit 94, PRIV at bit 93, T2 at bit 92, reserved bits 91:80, SID at bits 79:64, FI at bits 63:12 and reserved bits 11:0.  `[VT-d 5.20 §11.4.7.6]` `[8]` `C:high` `V:durable`
- **Claim.** The F field is RW1C and sticky: software clears a recorded fault by writing 1 to it.  `[VT-d 5.20 §11.4.7.6]` `[8]` `C:high` `V:durable`
- **Claim.** The request type of a recorded fault is encoded across two separate bits, T1 at 126 and T2 at 92, rather than in one contiguous field.  `[VT-d 5.20 §11.4.7.6]` `[8]` `C:high` `V:durable`
- **Claim.** The PASID Value field is 20 bits wide and is meaningful only when the PASID Present field at bit 95 is Set.  `[VT-d 5.20 §11.4.7.6]` `[8]` `C:high` `V:durable`
- **Claim.** If the register base address is X and CAP_REG.FRO reports Y, the first Fault Recording Register is at X + (16 * Y), and the registers are 16 bytes apart.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`

### 12.2.2 FSTS_REG and FECTL_REG (§11.4.7.1, §11.4.7.2)

| FSTS_REG bit | Field |
|---|---|
| 31:16 | Reserved |
| 15:8 | FRI — Fault Record Index |
| 7 | Deprecated |
| 6 | ITE — Invalidation Time-out Error |
| 5 | ICE — Invalidation Completion Error |
| 4 | IQE — Invalidation Queue Error |
| 3:2 | Reserved |
| 1 | PPF — Primary Pending Fault |
| 0 | PFO — Primary Fault Overflow |

- **Claim.** In FSTS_REG, PFO is bit 0, PPF bit 1, IQE bit 4, ICE bit 5, ITE bit 6, FRI bits 15:8; bits 3:2 and 31:16 are reserved and bit 7 is marked Deprecated in Rev 5.20.  `[VT-d 5.20 §11.4.7.1]` `[8]` `C:high` `V:durable`
- **Claim.** PFO, IQE, ICE and ITE are RW1CS (sticky, write-1-to-clear) while PPF and FRI are read-only status.  `[VT-d 5.20 §11.4.7.1]` `[8]` `C:high` `V:durable`
- **Claim.** In FECTL_REG, IM (Interrupt Mask) is bit 31 with a default value of 1, IP (Interrupt Pending) is read-only at bit 30, and bits 29:0 are RsvdP.  `[VT-d 5.20 §11.4.7.2]` `[8]` `C:high` `V:durable`
- **Claim.** Non-recoverable faults are reported to software using a message-signaled interrupt controlled through the Fault Event Control Register, with vector, delivery mode and address programmed through the Fault Event Data and Fault Event Address Registers.  `[VT-d 5.20 §7.3]` `[8]` `C:high` `V:durable`
- **Claim.** A Fault Event may be generated when a fault is recorded causing PPF to be Set, or when an Invalidation Queue Error causes the IQE field in the Fault Status Register to be Set.  `[VT-d 5.20 §7.3]` `[8]` `C:high` `V:durable`

Because FECTL_REG.IM defaults to 1, fault interrupts are masked out of reset; a driver that
programs the fault event registers but never clears IM will silently log faults it never sees.

## 12.3 Fault reason codes

> **Before decoding the reason, check RMRR.** A very common cause of a device faulting immediately
> after assignment is not a wrong reason code but a missing reserved region: if the device is
> covered by an RMRR in the ACPI DMAR table, the second-stage structures must provide an
> **identity mapping with read and write permission** over that region, or legitimate firmware
> DMA faults. RMRR structures are in §12.5.

VT-d Table 30 assigns each fault condition both a mnemonic condition code and a numeric fault
reason. The condition-code prefixes carve the space by structure: `L*` for legacy mode, `S*` for
scalable mode, `RTA` for root-table-address programming, `HPT` for the Host Permission Table.

**Read the range before the table.** The numeric space is partitioned by mode, and the range a
reason falls in is what selects which table below applies. A decoder that skips this step will
mislabel every scalable-mode fault as a legacy one.

- **Claim.** Fault reason ranges do not overlap across modes: legacy-mode reasons occupy **1h–Eh**, interrupt-remapping **20h–2Bh**, root-table-address programming **30h–34h**, and scalable-mode **38h–A5h**.  `[VT-d 5.20 Ch.7]` `[8]` `C:high` `V:durable`

Interrupt-remapping reasons (20h–2Bh) are owned by `11-vtd-interrupt-remapping.md` §11.10.

### 12.3.1 Legacy-mode fault reasons

| Reason | Condition code | Meaning |
|---|---|---|
| 1h | LRT.2 | The Present (P) field in the root-entry used to process a request is 0 |
| 2h | LCT.2 | The Present (P) field in the context-entry used to process a request is 0 |
| 3h | LCT.4.x | Invalid programming of a context-entry: unsupported AW, unsupported TT, or error accessing the second-stage paging entry through SSPTPTR |
| 4h | LGN.1.x | Address overflow in second-stage translation (above MGAW/AW, or above HAW for translated and pass-through requests) |
| 5h | LGN.2 | Write or AtomicOp request encountered lack of write permission |
| 6h | LGN.3 | Read or AtomicOp request encountered lack of read permission |
| 7h | LSS.1 | Error accessing a second-stage paging entry referenced through a preceding second-stage paging entry |
| 8h | LRT.1 | Error accessing a root-entry referenced through the RTA field of RTADDR_REG |
| 9h | LCT.1 | Error accessing a context-entry referenced through the CTP field of a root-entry |
| Ah | LRT.3 | Non-zero reserved field in a root-entry with P Set |
| Bh | LCT.3 | Non-zero reserved field in a context-entry with P Set |
| Ch | LSS.2 | Non-zero reserved field in a second-stage paging entry with at least one of R or W Set |
| Dh | LCT.5 | The TT field in a present context-entry specifies blocking of translation requests and translated requests |
| Eh | LGN.4 | Output address after remapping falls in the interrupt address range FEEx_xxxxh |

- **Claim.** Legacy-mode fault reason 1h is a Clear Present field in the root-entry (condition LRT.2) and 2h a Clear Present field in the context-entry (LCT.2).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason 3h (LCT.4) is invalid programming of a context-entry, covering an unsupported Address-Width value, an unsupported Translation-Type value, and an error accessing the second-stage paging entry referenced through SSPTPTR.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason 4h (LGN.1) is address overflow in second-stage translation, 5h (LGN.2) lack of write permission for a Write or AtomicOp request, and 6h (LGN.3) lack of read permission for a Read or AtomicOp request.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason 7h (LSS.1) is an error accessing a second-stage paging entry referenced through the address field of a preceding second-stage paging entry.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason 8h (LRT.1) is an error accessing a root-entry through the RTA field of RTADDR_REG, and 9h (LCT.1) an error accessing a context-entry through the CTP field of a root-entry.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reasons Ah, Bh and Ch are non-zero reserved fields in a root-entry (LRT.3), a context-entry (LCT.3) and a second-stage paging entry (LSS.2) respectively.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason Dh (LCT.5) is a present context-entry whose TT field specifies blocking of translation requests without PASID and translated requests.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Legacy-mode fault reason Eh (LGN.4) is an output address after remapping that lands in the interrupt address range FEEx_xxxxh.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** For implementations reporting ZLR as 1 in the Capability Register, fault reason 6h does not apply to zero-length read requests to write-only mapped pages in second-stage translation.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

### 12.3.2 Root-table-address programming faults (30h–34h)

- **Claim.** Fault reason 30h (RTA.1) is invalid programming of RTADDR_REG: TTM = 11b where ADMS = 0, TTM = 10b, TTM = 01b where SMTS = 0, or SSIRWE Set while TTM = 00b.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 31h (RTA.2) is a TTM value of 00b in RTADDR_REG used to process a request-with-PASID.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 32h (RTA.3) applies on implementations supporting Page Request Service when a legacy-mode TTM value is used to process a page request.  `[VT-d 5.20 §7.1.3]` `[8]` `C:medium` `V:durable`
- **Claim.** Fault reason 33h (RTA.4) applies on implementations supporting Abort DMA Mode (ADMS = 1) when TTM = 11b is used to process a request.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 34h (RTA.5) is a request-with-PASID carrying a Set Execute-Requested (ER) field on hardware implementations with VER_REG Major Version 8 and above.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

### 12.3.3 Scalable-mode fault reasons

| Range | Prefix | Structure |
|---|---|---|
| 38h–3Ah | SRT | Scalable-mode root-table |
| 40h–49h | SCT | Scalable-mode context-table |
| 50h–52h | SPD | Scalable-mode PASID-directory |
| 58h–60h | SPT | Scalable-mode PASID-table |
| 70h–77h, 90h–91h | SFS | First-stage paging structures |
| 78h–7Dh | SSS | Second-stage paging structures |
| 80h–89h | SGN | Scalable-mode general |
| A0h–A5h | HPT | Host Permission Table |

- **Claim.** Scalable-mode root-table fault reasons are 38h (error accessing a scalable-mode root-entry through RTA), 39h (Clear Present field in the UP/LP fields of a scalable-mode root-entry) and 3Ah (non-zero reserved field in a scalable-mode root-entry with the corresponding present field Set).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Scalable-mode context-table fault reasons are 40h (error accessing a scalable-mode context-entry through UCTP/LCTP), 41h (Clear Present field), 42h (non-zero reserved field with P Set) and 43h (invalid programming of the scalable-mode context-entry).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 43h covers the inconsistent combinations DTE = 0 with PRE = 1, a RID_PASID value larger than the maximum permitted by PDTS, and EPTR = 1 with PASIDE inconsistently programmed.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 44h is a Clear DTE field in the scalable-mode context-entry used to process a translation request or translated request, and 45h a Clear PASIDE field used to process a request with PASID.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 46h is a PASID value in the request larger than the maximum supported by the PDTS field of the scalable-mode context-entry, and 47h a Clear PRE field used to process a page request.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 48h is a request whose PASID value matches the RID_PASID value in the scalable-mode context-entry used to process it, and 49h a Clear EPTR field used to process a translated request with PASID.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Scalable-mode PASID-directory fault reasons are 50h (error accessing the PASID-directory entry through PASIDDIRPTR), 51h (Clear Present field) and 52h (non-zero reserved field in a present PASID-directory entry).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Scalable-mode PASID-table fault reasons are 58h (error accessing the PASID-table entry through SMPTBLPTR), 59h (Clear Present field), 5Ah (non-zero reserved field in a present entry) and 5Bh (invalid programming of the PASID-table entry).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 5Bh covers an unsupported Address-Width value, an unsupported or reserved PGTT value, an unsupported First Stage Paging Mode value, and an FSPTPTR above the MGAW/AW limit under nested translation.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 5Ch applies to hardware with VER_REG Major Version 7 and below processing a request with the Execute-Requested field Set while ECAP_REG.ERS is 0, and 5Dh is a Clear Supervisor Requests Enable (SRE) field processing a request with Privileged-mode-Requested Set.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 60h is a Translated Request whose address exceeds the size of the HPT governed by the HPT Size field, when HPT is enabled.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** First-stage fault reasons are 70h (error accessing a first-stage paging entry), 71h (Clear Present field in a first-stage paging entry), 72h (non-zero reserved field with P Set) and 73h (error accessing the FS-PML4 or FS-PML5 entry through FSPTPTR).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** First-stage nested-translation fault reasons are 74h (ADDR in a first-stage paging entry above the MGAW/AW limit), 75h and 76h (read of the FS-PML4/PML5 entry or of a first-stage paging entry blocked by lack of read permission in the nested second stage) and 77h (A/D/EA flag update blocked by lack of write permission in the nested second stage).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 90h is hardware encountering a needed first-stage paging-structure update while set up not to snoop processor caches (ECAP_REG.SMPWC = 0 or PWSNP = 0 in the PASID-table entry), and 91h a failure to update an Accessed, Dirty or Extended-Accessed flag in a first-stage paging structure.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Second-stage scalable-mode fault reasons are 78h (error accessing a second-stage paging entry), 79h (a second-stage paging entry with R = W = 0 or with the effective read and write permissions both denied), 7Ah (non-zero reserved field with at least one permission bit set) and 7Bh (error accessing the second-stage paging entry referenced through SSPTPTR in the PASID-table entry).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 7Ch is a needed second-stage A/D bit update while set up not to snoop processor caches, and 7Dh a failure to update the Accessed or Dirty bit in second-stage tables.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Scalable-mode general fault reason 80h is a non-canonical input address for first-stage translation, where address bits 63:N differ from bit N-1 with N = 48 for 4-level paging and 57 for 5-level paging.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 81h is a first-stage translation for a request with user privilege (PR = 0) that encountered a present first-stage paging entry with U/S = 0.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 83h is an input address that is a Host Address greater than the Host Address Width supported by the DMA remapping hardware.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 84h is an address above the MGAW/AW limit in an untranslated or translation request using second-stage-only translation (PGTT = 010b) in scalable mode.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reasons 85h and 86h are scalable-mode lack of write permission and lack of read permission respectively; pass-through translations do not encounter these conditions.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 87h is an output address in the interrupt address range FEEx_xxxxh detected in scalable mode, covering untranslated requests, translation requests through a non-pass-through PASID-table entry, and translated requests.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 89h relates to a PASID value in a request exceeding the size reported by the corresponding field in the Extended Capability Register.  `[VT-d 5.20 §7.1.3]` `[8]` `C:medium` `V:durable`
- **Claim.** Host Permission Table fault reasons are A0h (error accessing an HPT entry through a preceding HPT entry), A1h (non-zero reserved field in an HPT entry), A2h (error accessing the HPT entry referenced through the HPT Root field in a PASID-table entry), A3h (HPT walk terminated before a non-zero PPi for a translated zero-length read), A4h (lack of write permission in the HPT tables) and A5h (lack of read permission in the HPT tables).  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

Interrupt-remapping fault reasons occupy 20h–2Bh and are owned by
`11-vtd-interrupt-remapping.md` §11.10; they are not repeated here.

## 12.4 The recoverable-fault path: page requests

### 12.4.1 Page Request Queue

- **Claim.** VT-d §7.4 specifies recoverable fault reporting, with handling of page requests in §7.4.1 and the Page Request Descriptor format in §7.4.1.1.  `[VT-d 5.20 §7.4]` `[8]` `C:high` `V:durable`
- **Claim.** When a Page Request Descriptor is written to the Page Request Queue, hardware sets the Pending Page Request (PPR) field in the Page Request Status Register.  `[VT-d 5.20 §7.5]` `[8]` `C:high` `V:durable`
- **Claim.** When hardware encounters a Page Request Queue full condition while attempting to write a page request, it sets the Page Request Overflow (PRO) field in the Page Request Status Register.  `[VT-d 5.20 §7.5]` `[8]` `C:high` `V:durable`
- **Claim.** In the Page Request Status Register, PPR is bit 0 and PRO is bit 1, both RW1CS, with bits 31:2 reserved.  `[VT-d 5.20 §11.4.11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Request Queue Head and Tail registers carry their queue offsets in bits 18:5, with bits 4:0 and 63:19 reserved.  `[VT-d 5.20 §11.4.11.1]` `[8]` `C:high` `V:durable`
- **Claim.** In the Page Request Queue Address Register, PQA occupies bits 63:12 and PQS (Page Queue Size) bits 2:0, with bits 11:3 reserved.  `[VT-d 5.20 §11.4.11.3]` `[8]` `C:high` `V:durable`
- **Claim.** A Page Request Event interrupt is suppressed if PPR or PRO is already Set; otherwise the Interrupt Pending (IP) field in the Page Request Event Control Register is Set, and the event is generated only if the Interrupt Mask (IM) field is Clear.  `[VT-d 5.20 §7.5]` `[8]` `C:high` `V:durable`
- **Claim.** If IP was 1 when software clears IM, the Page Request Event interrupt is generated and IP is cleared; if IP was 1 when software clears both PPR and PRO, IP is cleared without an interrupt.  `[VT-d 5.20 §7.5]` `[8]` `C:high` `V:durable`
- **Claim.** A page request is "received" when it arrives at the remapping hardware ingress, "accepted" when the corresponding descriptor write is issued, and "delivered" when that write becomes visible to software followed by the increment of the Page Request Queue Tail register.  `[VT-d 5.20 §7.5]` `[8]` `C:high` `V:durable`
- **Claim.** Page request ordering and draining is specified in §7.7, page group response ordering and draining in §7.8, pending page request handling on terminal conditions in §7.9, the software steps to drain page requests and responses in §7.10, and revoking PASIDs with pending page faults in §7.11.  `[VT-d 5.20 §7.7]` `[8]` `C:high` `V:durable`

### 12.4.2 Page Request Descriptor (§7.4.1.1) — 256 bits

| Bits | Field |
|---|---|
| 255:128 | Reserved |
| 127:76 | ADDR — Address [63:12] |
| 75:67 | PRGI — Page Request Group Index |
| 66 | LPIG — Last Page in Group |
| 65 | WRR — Write Requested |
| 64 | RDR — Read Requested |
| 63:54 | Reserved |
| 53 | PMR — Privileged Mode Requested |
| 52 | EXR — Execute Requested |
| 51:32 | PASID |
| 31:16 | RID — Requester-ID |
| 15:9 | Reserved |
| 8 | PP — PASID Present |
| 7:0 | Type (01h) |

- **Claim.** A Page Request Descriptor carries Type 01h in bits 7:0, PP at bit 8, RID at bits 31:16, PASID at bits 51:32, EXR at bit 52, PMR at bit 53, RDR at bit 64, WRR at bit 65, LPIG at bit 66, PRGI at bits 75:67 and ADDR bits 63:12 of the page address at descriptor bits 127:76.  `[VT-d 5.20 §7.4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Request Group Index field is 9 bits wide and identifies the page group a request belongs to; it is undefined if both the Read Requested and Write Requested fields are 0.  `[VT-d 5.20 §7.4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** A page group is composed of one or more individual page requests sharing the same Page Request Group Index value, and LPIG = 1 marks the last request in that group.  `[VT-d 5.20 §7.4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Page requests with PASID Present = 1 are page-requests-with-PASID and those with PASID Present = 0 are page-requests-without-PASID; the PASID field is undefined when PP is 0.  `[VT-d 5.20 §7.4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** In the Page Request Descriptor's Requester-ID field, the upper 8 bits specify the bus number and the lower 8 bits the device and function number, and software copies them into the Requester-ID of the Page Group Response Descriptor.  `[VT-d 5.20 §7.4.1.1]` `[8]` `C:high` `V:durable`

### 12.4.3 Page Group Response (§7.6.1)

- **Claim.** A Page Group Response Descriptor is issued by software in response to a page request that indicated it was the last request in a group, and must be issued only after servicing all page requests with the same Page Request Group Index.  `[VT-d 5.20 §7.6.1]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Group Response Descriptor is written by software to the Invalidation Queue and its Type field, formed from bits 11:9 and bits 3:0, carries the value 9h.  `[VT-d 5.20 §7.6.1]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Group Response Descriptor is a 256-bit descriptor and results in an invalid descriptor error if submitted to an invalidation queue configured for 128-bit descriptors (IQA_REG.DW = 0).  `[VT-d 5.20 §7.6.1]` `[8]` `C:high` `V:durable`
- **Claim.** Implementations reporting ECAP_REG.PRS as Clear treat Page Group Response Descriptors as invalid descriptors.  `[VT-d 5.20 §7.6.1]` `[8]` `C:high` `V:durable`

Response codes (Table 32):

| Value | Status | Meaning |
|---|---|---|
| 0h | Success | All page requests in the group were successfully serviced |
| 1h | Invalid Request | One or more page requests in the group were not successfully serviced |
| 2h–Eh | Reserved | Not used |
| Fh | Response Failure | Servicing encountered a non-recoverable error |

- **Claim.** Page group response codes are 0h Success, 1h Invalid Request, 2h–Eh Reserved and Fh Response Failure.  `[VT-d 5.20 §7.6]` `[8]` `C:high` `V:durable`
- **Claim.** The Response Code follows the response code definition in the Page Group Response message specified by the PCI Express specification.  `[VT-d 5.20 §7.6]` `[8][200]` `C:high` `V:durable`

## 12.5 ACPI DMAR table (Ch.8)

VT-d has no PCI configuration space, so everything about its topology reaches software through one
ACPI table.

### 12.5.1 The DMAR table header

| Offset | Length | Field |
|---|---|---|
| 0 | 4 | Signature "DMAR" |
| 4 | 4 | Length |
| 8 | 1 | Revision |
| 9 | 1 | Checksum |
| 10 | 6 | OEMID |
| 16 | 8 | OEM Table ID |
| 24 | 4 | OEM Revision |
| 28 | 4 | Creator ID |
| 32 | 4 | Creator Revision |
| 36 | 1 | Host Address Width |
| 37 | 1 | Flags |
| 38 | 10 | Reserved |
| 48 | — | Remapping structures |

- **Claim.** The DMA Remapping Reporting Structure uses the ACPI signature "DMAR", with Length at offset 4, Revision at 8, Checksum at 9, OEMID at 10, OEM Table ID at 16, OEM Revision at 24, Creator ID at 28 and Creator Revision at 32.  `[VT-d 5.20 §8.1]` `[8][203]` `C:high` `V:durable`
- **Claim.** The Host Address Width field is a single byte at offset 36 and the platform HAW is computed as N+1 where N is the value reported; a platform supporting 40 bits of physical addressability reports 100111b.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** The DMAR Flags field is a single byte at offset 37, followed by 10 reserved bytes at offset 38, with the remapping structures beginning at offset 48.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** DMAR Flags bit 0 is INTR_REMAP, indicating whether the platform supports interrupt remapping; it must be Set for implementations reporting ECAP_REG.IRREQ as Set.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** DMAR Flags bit 1 is X2APIC_OPT_OUT, by which platform firmware requests system software to opt out of enabling x2APIC mode; it is valid only when INTR_REMAP is Set and must be Clear on implementations reporting EIMER as Set.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** DMAR Flags bit 2 is DMA_CTRL_PLATFORM_OPT_IN_FLAG, which firmware is recommended to Set to report that any platform-initiated DMA is restricted to reserved memory regions reported in RMRR structures at the point control is transferred to system software, such as on ExitBootServices().  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** DMAR Flags bit 3 is DMA_REMAP_OPT_OUT, by which platform firmware may request system software to opt out of enabling DMA remapping (TE); bits 7:4 are reserved.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** All reserved fields in DMAR remapping structures must be initialized to 0.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`

### 12.5.2 Remapping structure types (§8.2)

| Type | Structure | Purpose |
|---|---|---|
| 0 | DRHD | Defines one remapping hardware unit: its register base, size, PCI segment, and device scope |
| 1 | RMRR | Reports BIOS-reserved memory regions a listed device needs DMA access to |
| 2 | ATSR | Identifies PCI Express root ports supporting ATS transactions, per PCI segment |
| 3 | RHSA | Associates a remapping hardware unit with a NUMA proximity domain |
| 4 | ANDD | Declares an ACPI name-space enumerated device capable of issuing DMA |
| 5 | SATC | Identifies SoC-integrated devices that have a validated address translation cache |
| 6 | SIDP | Reports special properties of SoC-integrated devices that constrain remapping configuration |

- **Claim.** DMAR remapping structure types are 0 = DRHD, 1 = RMRR, 2 = ATSR, 3 = RHSA, 4 = ANDD, 5 = SATC and 6 = SIDP; values greater than 6 are reserved for future use.  `[VT-d 5.20 §8.2]` `[8]` `C:high` `V:durable`
- **Claim.** All remapping structures start with a two-byte Type field followed by a two-byte Length field giving the size in bytes of the structure including sub-structures.  `[VT-d 5.20 §8.2]` `[8]` `C:high` `V:durable`
- **Claim.** BIOS implementations must report remapping structure types in numerical order, so all DRHD structures precede all RMRR structures and so on.  `[VT-d 5.20 §8.2]` `[8]` `C:high` `V:durable`
- **Claim.** Software skips remapping structures it does not comprehend by skipping the number of bytes indicated by the Length field, which is how forward compatibility is preserved.  `[VT-d 5.20 §8.2]` `[8]` `C:high` `V:durable`

### 12.5.3 DRHD (§8.3)

- **Claim.** A DRHD structure uniquely represents a remapping hardware unit, and there must be at least one instance for each PCI segment in the platform.  `[VT-d 5.20 §8.3]` `[8]` `C:high` `V:durable`
- **Claim.** In a DRHD structure, Type is 2 bytes at offset 0, Length 2 bytes at offset 2, Flags 1 byte at offset 4, Size 1 byte at offset 5, Segment Number 2 bytes at offset 6 and Register Base Address 8 bytes at offset 8; the total length is 16 plus the size of the Device Scope structure.  `[VT-d 5.20 §8.3]` `[8]` `C:high` `V:durable`
- **Claim.** DRHD Flags bit 0 is INCLUDE_PCI_ALL: when Clear the unit's scope is only the devices explicitly identified in the Device Scope field, and when Set the unit covers all PCI-compatible devices in the segment except those reported under other units.  `[VT-d 5.20 §8.3]` `[8]` `C:high` `V:durable`
- **Claim.** A DRHD structure with INCLUDE_PCI_ALL Set must be enumerated by BIOS after all other DRHD structures for the same segment, and may still use the Device Scope field to enumerate I/OxAPIC and HPET devices.  `[VT-d 5.20 §8.3]` `[8]` `C:high` `V:durable`
- **Claim.** DRHD Size bits 3:0 indicate the size of the remapping hardware register set as 2^N 4 KB pages, that is 2^(N+12) bytes; bits 7:4 are reserved.  `[VT-d 5.20 §8.3]` `[8]` `C:high` `V:durable`
- **Claim.** Device Scope structures are specified in §8.3.1, with reporting scope for I/OxAPICs in §8.3.1.1, for MSI-capable HPET timer blocks in §8.3.1.2 and for ACPI name-space devices in §8.3.1.3.  `[VT-d 5.20 §8.3.1]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d §8.3.2 through §8.3.6 cover the implications of DRHD device scope for ARI, SR-IOV, PCI/PCI Express hot plug, PCI resource rebalancing and BAR provisioning.  `[VT-d 5.20 §8.3.2]` `[8]` `C:high` `V:durable`
- **Claim.** Remapping hardware unit hot plug, including ACPI name space mapping and the expected reporting sequence, is specified in §8.10.  `[VT-d 5.20 §8.10]` `[8]` `C:high` `V:durable`

### 12.5.4 RMRR and its security caveat (§8.4)

RMRR is where firmware tells the OS "this device must keep DMA access to this physical range, no
matter what your isolation policy says". Every RMRR is a permanent identity-mapped hole in a
domain's address space.

- **Claim.** BIOS reports reserved memory regions that may be DMA targets through RMRR structures, along with the devices that require access to each region.  `[VT-d 5.20 §8.4]` `[8]` `C:high` `V:durable`
- **Claim.** Reserved memory ranges that are not DMA targets, or that are targets of BIOS-initiated DMA only during the pre-boot phase such as from a boot disk drive, must not be included in reserved memory region reporting.  `[VT-d 5.20 §8.4]` `[8]` `C:high` `V:durable`
- **Claim.** The base address of each RMRR region must be 4 KB aligned and its size an integer multiple of 4 KB, and BIOS must report the addresses as reserved or as EFI runtime in the system memory map.  `[VT-d 5.20 §8.4]` `[8]` `C:high` `V:durable`
- **Claim.** For legacy reserved-memory usages to function, when system software enables DMA remapping the second-stage translation structures for the respective devices are expected to be set up to provide identity mapping for the specified reserved memory regions with read and write permissions.  `[VT-d 5.20 §3.16]` `[8]` `C:high` `V:durable`
- **Claim.** The specification states that platform implementations supporting reserved memory must carefully consider the system software and security implications of its usages, and that these usages are beyond the scope of the specification.  `[VT-d 5.20 §3.16]` `[8]` `C:high` `V:durable`
- **Claim.** Methods used to distinguish accesses to reserved system memory must not depend on simple address-based decoding, because DMA virtual addresses can overlap the host physical addresses of reserved system memory.  `[VT-d 5.20 §3.16]` `[8]` `C:high` `V:durable`

The practical consequence: a device covered by an over-broad RMRR cannot be safely assigned to an
untrusted domain, because the identity mapping the firmware demands would be visible to that
domain.

### 12.5.5 ATSR, RHSA, ANDD, SATC, SIDP

- **Claim.** An ATSR structure is provided per PCI segment supporting Device-TLBs and identifies the PCI Express root ports supporting ATS transactions; software must enable ATS on endpoints behind a root port only if that root port is reported as supporting ATS.  `[VT-d 5.20 §8.5]` `[8]` `C:high` `V:durable`
- **Claim.** The RHSA structure is optional and applies to NUMA platforms, associating each remapping hardware unit's base address with the proximity domain it belongs to, so software can allocate its translation structures from nearby memory.  `[VT-d 5.20 §8.6]` `[8]` `C:high` `V:durable`
- **Claim.** An ANDD structure uniquely represents an ACPI name-space enumerated device capable of issuing DMA, and is used together with Device-Scope entries of type ACPI_NAMESPACE_DEVICE.  `[VT-d 5.20 §8.7]` `[8]` `C:high` `V:durable`
- **Claim.** The SATC structure identifies devices that have an address translation cache validated per the SoC-integrated Device-TLB requirements, and it is recommended that system software enable ATC for such devices.  `[VT-d 5.20 §8.8]` `[8]` `C:high` `V:durable`
- **Claim.** The SIDP structure identifies devices with special properties that may restrict how system software configures the remapping structures governing them, using the Flags field in the Device Scope Entry to indicate each property.  `[VT-d 5.20 §8.9]` `[8]` `C:high` `V:durable`
- **Claim.** System software that uses the SIDP structure must ignore SATC structures that may also be present.  `[VT-d 5.20 §8.9]` `[8]` `C:high` `V:durable`

## 12.6 Performance monitoring (Ch.10)

- **Claim.** VT-d Chapter 10 specifies performance monitoring, with discovery and enumeration in §10.1, configuration registers in §10.2, event counters in §10.3, filter support in §10.4, configuration error checks in §10.5, interrupt generation in §10.6 and the event list in §10.7.  `[VT-d 5.20 Ch.10]` `[8]` `C:high` `V:durable`
- **Claim.** Performance monitoring support is enumerated by ECAP_REG.PMS at bit 51; if an implementation does not support performance monitoring, PERFCAP_REG reads as 0 and the other performance monitoring registers are not supported.  `[VT-d 5.20 §10.1]` `[8]` `C:high` `V:durable`
- **Claim.** The locations of the performance monitoring configuration, freeze, overflow and counter register groups are reported to software through dedicated offset registers rather than being fixed.  `[VT-d 5.20 §10.1]` `[8]` `C:high` `V:durable`
- **Claim.** Software configures a counter by specifying an Event Group Index and an Event Select bitmask in the corresponding Performance Monitoring Counter Configuration Register.  `[VT-d 5.20 §10.1]` `[8]` `C:high` `V:durable`
- **Claim.** An Event Capability Register corresponding to each Event Group indicates the events supported in that group; when its ES field is zero, software should not configure any counter to use that group.  `[VT-d 5.20 §10.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware may report up to a maximum of 15 Event Groups through the Event Group Count field in the Performance Monitoring Capability Register.  `[VT-d 5.20 §10.7]` `[8]` `C:high` `V:durable`
- **Claim.** Event Group 0h includes IOMMU_CLOCKS (clock cycles of the IOMMU hardware), IOMMU_REQUESTS (all incoming untranslated, translated and translation requests), PW_OCCUPANCY (occupancy of requests requiring a page walk), ATS_BLOCKED, TOTAL_OCCUPANCY and MEM_OCCUPANCY.  `[VT-d 5.20 §10.7]` `[8]` `C:high` `V:durable`
- **Claim.** Event Group 1h includes IOMMU_MRDS (memory reads), IOMMU_ATOMIC_AD_UPDATE (atomic updates of Accessed/Dirty bits during page walk), IOMMU_MEM_BLOCKED, PG_REQ_POSTED (page requests received and posted) and PG_REQ_OVERFLOW (auto-generated responses due to page request queue overflow).  `[VT-d 5.20 §10.7]` `[8]` `C:high` `V:durable`
- **Claim.** A further event group provides cache-effectiveness counters including CTXT_CACHE_LOOKUP, CTXT_CACHE_HIT and PASID_CACHE_LOOKUP, with Page Table Level available as an applicable filter for some events.  `[VT-d 5.20 §10.7]` `[8]` `C:high` `V:durable`
- **Claim.** Filters available to performance monitoring counters include Requester ID, Domain ID, PASID, Address Type and Page Table Level, each configured through its own register group.  `[VT-d 5.20 §11.4.13]` `[8]` `C:high` `V:durable`
- **Claim.** Enabling a counter with an unsupported event/filter pairing causes hardware error-check logic to report an error, which is how software discovers which filters an implementation supports for a given event.  `[VT-d 5.20 §10.7]` `[8]` `C:high` `V:durable`
- **Claim.** Counter overflow behaviour is specified in §10.3.1 and counter stop and resume in §10.3.2.  `[VT-d 5.20 §10.3.1]` `[8]` `C:high` `V:durable`

## 12.7 Scalable I/O Virtualization

SIOV asks a different question from SR-IOV. SR-IOV asks the device to replicate a whole PCIe
Function per tenant; SIOV asks it only to replicate the fast-path queue resources, tag their DMA with
a PASID, and let software compose the rest.

**Document status.** The SIOV specification has not been revised since 2020 — treat it as
stale-but-current. Note also a metadata discrepancy recorded below.

- **Claim.** The Intel Scalable I/O Virtualization Technical Specification PDF cover reads "September 2020, Order Number: 337679-002, Rev 1.1"; secondary sources and the skill's own bibliography entry describe it as Rev 1.0, and the PDF cover governs.  `[SIOV Ch.1]` `[21][204]` `C:high` `V:durable`
- **Claim.** Intel Scalable IOV distinguishes intercepted-path accesses, which go through the virtual device composition module, from direct-path accesses, which are mapped directly to the device; the device implementation controls which operations fall in which category.  `[SIOV §1.2.1]` `[21]` `C:high` `V:durable`
- **Claim.** Intercepted-path accesses typically include initialization, control, configuration, management, QoS, error processing and reset, while direct-path accesses typically include data-path work submission and work completion processing.  `[SIOV §1.2.1]` `[21]` `C:high` `V:durable`
- **Claim.** Scalable IOV defines the granularity of sharing of a device as an "Assignable Device Interface" (ADI); each ADI instance encompasses the set of device resources allocated by software to support the direct-path operations for a virtual device.  `[SIOV §1.2.2]` `[21]` `C:high` `V:durable`
- **Claim.** All ADIs on a device function use the same PCIe Requester ID corresponding to the device's PCIe Function, and Process Address Space Identifiers distinguish upstream memory transactions performed for different ADIs.  `[SIOV §1.2.3]` `[21]` `C:high` `V:durable`
- **Claim.** The 20-bit PASID associated with a transaction is conveyed in a PCI Express PASID TLP Prefix.  `[SIOV §1.2.3]` `[21][200]` `C:high` `V:durable`
- **Claim.** Endpoint devices must support the PCI Express PASID capability and must have it enabled before enabling ADIs; before an ADI is activated it must be configured with a PASID value.  `[SIOV §2.2]` `[21][200]` `C:high` `V:durable`
- **Claim.** All upstream memory requests and ATS Translation Requests generated by an ADI must be tagged with the assigned PASID using the PASID TLP Prefix, while interrupts generated by ADIs are not tagged with the PASID TLP Prefix.  `[SIOV §2.2]` `[21]` `C:high` `V:durable`
- **Claim.** Each ADI must have a primary PASID used for direct-path operations, and may have optional secondary PASIDs whose usage is device dependent.  `[SIOV §2.2]` `[21]` `C:high` `V:durable`
- **Claim.** If multiple ADIs are assigned to the same address domain they may be assigned the same PASID; if ADIs of a virtual device are mapped to secondary address domains within a VM, each such ADI gets a unique PASID and its requests are subject to nested GVA→GPA→HPA translation.  `[SIOV §2.2]` `[21]` `C:high` `V:durable`
- **Claim.** A device-specific component called the Virtual Device Composition Module (VDCM) is responsible for managing virtual device instances; the VMM maps direct-path accesses from the guest onto the provisioned ADIs and traps intercepted-path accesses, forwarding them to the VDCM for emulation.  `[SIOV §1.2.4]` `[21]` `C:high` `V:durable`
- **Claim.** Depending on the VMM implementation, VDCM may be instantiated as a separate user or kernel module, or packaged as part of the host driver, and virtualization management software may use VDCM interfaces for suspend, resume, reset and migration of virtual devices.  `[SIOV §1.2.4]` `[21]` `C:high` `V:durable`
- **Claim.** ADI interrupts may be stored in an Interrupt Message Storage (IMS) rather than in MSI or MSI-X structures, specified in SIOV §2.5.1, with ADI interrupt isolation in §2.5.2.  `[SIOV §2.5.1]` `[21]` `C:high` `V:durable`
- **Claim.** For interrupt isolation across devices, the host platform should support interrupt remapping for all interrupt messages programmed in MSI, MSI-X or IMS on the device.  `[SIOV §3.2]` `[21]` `C:high` `V:durable`
- **Claim.** PASID-granular address translation enables upstream requests from each ADI to have a unique address translation, and the address space a PASID targets may be HPA, HVA, HIOVA, GPA, GVA or GIOVA depending on how the DMA remapping hardware is programmed.  `[SIOV §3.1]` `[21]` `C:high` `V:durable`
- **Claim.** SIOV describes Intel platform support as three-stage scalable mode address translation: Requester-ID selects root and context structures, the PASID selects the PASID structures, and the PASID-table entry selects first-level, second-level, pass-through or nested translation.  `[SIOV §3.1]` `[21]` `C:high` `V:durable`
- **Claim.** SIOV §3.3 specifies PASID translation as a platform requirement, distinct from address-space isolation in §3.1 and interrupt isolation in §3.2.  `[SIOV §3.3]` `[21]` `C:high` `V:durable`
- **Claim.** The VT-d specification itself treats Intel Scalable I/O Virtualization capable devices as a distinct category when identifying the origination of DMA requests, in §3.12.7.  `[VT-d 5.20 §3.12.7]` `[8]` `C:high` `V:durable`
- **Claim.** SIOV's reference software model divides responsibilities between a host driver (§4.1), the VDCM (§4.2), a guest driver (§4.3) and the composed virtual device (§4.4).  `[SIOV §4.1]` `[21]` `C:high` `V:durable`

The structural contrast with SR-IOV, stated at the level the specification supports: SR-IOV
replicates the PCIe Function itself, so each virtual instance consumes a Requester ID, configuration
space, BARs and MSI-X structures in silicon. SIOV keeps one Function and one Requester ID and
distinguishes tenants by PASID, so the per-instance hardware cost is the queue resources alone and
the "configuration space" is emulated by the VDCM.

- **Claim.** Because all ADIs share the hosting function's Requester ID and are distinguished only by PASID, SIOV's per-instance hardware cost does not include a replicated PCIe Function, configuration space or Requester ID as SR-IOV's does.  `[SIOV §1.2.3]` `[21]` `C:high` `V:durable`

## 12.8 Security considerations

### 12.8.1 What remapping hardware does and does not protect

- **Claim.** The fault architecture blocks requests rather than merely logging them: a non-recoverable fault causes the request to be blocked, and the blocking is independent of whether the fault is reported to software.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Setting FPD suppresses fault *reporting* only; it does not permit the faulting request, so an FPD-heavy configuration degrades observability rather than isolation.  `[VT-d 5.20 §7.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Because hardware suppresses recording of a fault whose source-id matches an already-pending Fault Recording Register, a device generating a storm of identical faults will not fill the fault log, but a device varying its source-id can drive PFO.  `[VT-d 5.20 §7.2.1]` `[8]` `C:medium` `V:durable`

### 12.8.2 The pre-boot DMA protection gap

The window between platform reset and the OS programming the remapping hardware is the one
VT-d cannot cover on its own, which is exactly what DMAR flag bit 2 exists to describe.

- **Claim.** DMA_CTRL_PLATFORM_OPT_IN_FLAG exists so firmware can assert that platform-initiated DMA is confined to RMRR-reported regions at the moment control is handed to system software, and system software may then program remapping hardware to block DMA outside RMRR except for memory explicitly registered by device drivers.  `[VT-d 5.20 §8.1]` `[8]` `C:high` `V:durable`
- **Claim.** The specification's own statement that RMRR must exclude ranges targeted by BIOS-initiated DMA only during the pre-boot phase implies that pre-boot DMA is expected to have ceased before the OS establishes its translation structures.  `[VT-d 5.20 §8.4]` `[8]` `C:medium` `V:durable`
- **Claim.** Protected Memory Range registers (PMEN_REG, PLMBASE/PLMLIMIT, PHMBASE/PHMLIMIT) provide a DMA-protection mechanism independent of the translation structures, enabled by PMEN_REG.EPM at bit 31 and reported active by PRS at bit 0.  `[VT-d 5.20 §11.4.8.1]` `[8]` `C:high` `V:durable`

### 12.8.3 The Intel 5520/5500 interrupt-remapping erratum

The old edition of this skill attributed this erratum to the wrong party. It is **Intel's** erratum, in
Intel's own chipset specification update, against Intel silicon.

- **Claim.** Intel documented an interrupt-remapping defect in the Intel 5500/5520/X58 chipset specification update as errata #47 and #53, which make the interrupt remapping unit unreliable on affected steppings.  `[VT-d 5.20 Ch.?]` `[201][202]` `C:low` `V:durable`
- **Claim.** The documented mitigation for the 5500/5520 interrupt-remapping erratum is to disable interrupt remapping in BIOS on affected platforms, and hypervisor and OS vendors added quirks that refuse to enable interrupt remapping on the affected chipset steppings.  `[VT-d 5.20 Ch.?]` `[202]` `C:low` `V:durable`
- **Claim.** With interrupt remapping disabled, the architectural source-id verification described in `11-vtd-interrupt-remapping.md` is not performed, so an assigned device can direct interrupt requests that the platform would otherwise have blocked under fault reason 26h.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`

The general lesson is the one worth carrying: DMA remapping without interrupt remapping is not
device isolation. A device that cannot reach memory outside its domain can still, absent interrupt
remapping, raise an arbitrary interrupt vector on an arbitrary CPU.

## 12.9 Pitfalls

1. **"Advanced fault logging" is gone.** Rev 5.20 defines Primary Fault Logging only; the CAP_REG and
   GCMD_REG bits that once carried advanced fault logging are reserved or Deprecated.
2. **Fault reason ranges do not overlap across modes**, and the range selects the table — see
   §12.3, where the ranges are stated before the tables they govern.
3. **The fault type is split across two non-adjacent bits** (T1 at 126, T2 at 92) in the Fault Recording
   Register. Decoders written against very old revisions read only T1.
4. **FECTL_REG.IM defaults to 1.** No fault interrupts arrive until software clears it.
5. **A page group response goes to the invalidation queue, not the page request queue**, and it is a
   256-bit descriptor, so an invalidation queue configured for 128-bit descriptors rejects it.
6. **RMRR is a stated isolation compromise, not a bug.** The specification explicitly pushes the
   security analysis of reserved memory out of scope.
7. **SIOV's revision is 1.1 on the PDF cover, not 1.0**, and the document has not been revised since
   September 2020. Cite the cover.
