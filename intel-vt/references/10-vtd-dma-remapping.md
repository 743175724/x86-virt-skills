# 10. VT-d DMA Remapping

> **中文速览**：本章是 VT-d 的正文——remapping hardware unit 如何把一个 DMA 请求的 source-id 翻译成域内地址。内容分四块：legacy mode 与 scalable mode 的表结构走法（RTADDR_REG.TTM 决定）、**Ch.9 全部翻译结构的逐位布局**（root-entry / scalable-mode root-entry / context-entry / scalable-mode context-entry / PASID directory 与 table entry / first-stage 与 second-stage 页表项）、**Ch.11 的 DMAR 寄存器组与偏移**、以及 Ch.6 的缓存与失效（寄存器式 vs queued invalidation，九种失效描述符）。最后是 Ch.4 的 Device-TLB/ATS 与 PASID 管线。中断重映射与 IRTE 在 `11-vtd-interrupt-remapping.md`；故障、ACPI DMAR 表与 SIOV 在 `12-vtd-faults-bios-siov.md`。

**Maps to:** Intel VT-d Architecture Specification Rev 5.20 Ch.3 "DMA Remapping", Ch.4 "Support For Device-TLBs", Ch.6 "Caching Translation Information", Ch.9 "Translation Structure Formats", Ch.11 "Register Descriptions" [8]
**Owns:** the remapping-hardware model, source-id, legacy vs scalable mode, all DMA translation structure layouts, the DMAR register set, invalidation descriptors, ATS/PRI/PASID plumbing
**See also:** `11-vtd-interrupt-remapping.md` (IRTE, interrupt posting), `12-vtd-faults-bios-siov.md` (faults, ACPI DMAR, SIOV), `06-address-translation.md` (the CPU-side second-stage analogue)

---

## 10.1 The remapping hardware unit

> **Which document this chapter tracks.** Intel Virtualization Technology for Directed I/O
> Architecture Specification, order **D51397-019, Rev 5.20, April 2026** — the revision printed
> on the PDF cover. The intel.com landing page for this specification is stale: it shows a
> 2023 date and its content endpoint still serves **Rev 4.1**, so a reader who trusts the page
> rather than the cover will work from a superseded document. Rev 5.20 also renamed
> first-level/second-level to **first-stage/second-stage**. See `errata.md` E21.

VT-d is not a device on a bus. It is one or more **remapping hardware units** in the root complex,
each owning a 4-KByte memory-mapped register region whose location firmware reports through ACPI
(see `12-vtd-faults-bios-siov.md` for the DMAR table). Everything a driver does to VT-d is a load or
store to that region, plus reads and writes of the in-memory structures the registers point at.

- **Claim.** The register set for each remapping hardware unit is placed at a size-aligned memory-mapped location whose exact position is implementation-dependent and is communicated to system software by BIOS through the ACPI DMA-remapping hardware reporting structures.  `[VT-d 5.20 §11.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware implementations that support relocating the remapping registers in the system address map must provide the ability to lock their location by hardware-specific secure initialization software.  `[VT-d 5.20 §11.1]` `[8]` `C:high` `V:durable`
- **Claim.** Software is expected to access 32-bit remapping registers as aligned doublewords, and must access 64-bit and 128-bit registers as either aligned quadwords or aligned doublewords; hardware may disassemble a quadword access into two doubleword accesses and must then complete them in order, lower doubleword first.  `[VT-d 5.20 §11.2]` `[8]` `C:high` `V:durable`
- **Claim.** Locked operations to remapping hardware registers are not supported and software must not issue them.  `[VT-d 5.20 §11.2]` `[8]` `C:high` `V:durable`

## 10.2 Source-id

- **Claim.** The attribute identifying the originator of an I/O transaction is called the source-id; for PCI Express devices the source-id is the requester identifier in the transaction layer header, composed of the device's PCI Bus, Device and Function number.  `[VT-d 5.20 §3.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** In the requester-id format the Bus number occupies bits 15:8, the Device number bits 7:3, and the Function number bits 2:0.  `[VT-d 5.20 §3.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** For PCI Express devices supporting Alternative Routing-ID Interpretation (ARI), the bits traditionally used for the Device Number field are instead used to expand the Function Number field.  `[VT-d 5.20 §3.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** For root-complex integrated devices the source-id may be derived from the root-complex internal implementation rather than carried in the transaction.  `[VT-d 5.20 §3.4.1]` `[8]` `C:high` `V:durable`

Chapter 3 spends §3.12 on the awkward cases — devices behind PCI Express-to-PCI/PCI-X bridges,
conventional PCI bridges, phantom functions, SR-IOV and Scalable I/O Virtualization capable
devices — because the source-id a remapping hardware unit observes is not always the one the
endpoint driver would name.

## 10.3 Domains and the two table-walk modes

- **Claim.** Chapter 3 of the VT-d specification is titled "DMA Remapping" and defines domains and address translation in §3.2, legacy mode address translation in §3.4.2 and scalable mode address translation in §3.4.3.  `[VT-d 5.20 Ch.3]` `[8]` `C:high` `V:durable`
- **Claim.** The mode a remapping hardware unit operates in is selected by the Translation Table Mode (TTM) field, bits 11:10 of the Root Table Address Register.  `[VT-d 5.20 §11.4.5]` `[8]` `C:high` `V:durable`
- **Claim.** RTADDR_REG.TTM = 00b selects legacy mode and RTADDR_REG.TTM = 01b selects scalable mode.  `[VT-d 5.20 §3.11.4]` `[8]` `C:high` `V:durable`
- **Claim.** RTADDR_REG.TTM programmed to 11b selects Abort DMA Mode on hardware reporting ADMS = 1 in the Extended Capability Register; programming 11b where ADMS = 0, or programming 10b at all, is a fault condition.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** RTADDR_REG bit 7 is SSIRWE (Second Stage I/O Read/Write Enable) and bits 63:12 are RTA, the root-table address.  `[VT-d 5.20 §11.4.5]` `[8]` `C:high` `V:durable`
- **Claim.** Setting RTADDR_REG.SSIRWE while TTM is programmed to legacy mode (00b) is an invalid programming fault condition.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

Legacy mode walks root-table → context-table → second-stage paging entries and handles only
requests-without-PASID. Scalable mode walks scalable-mode root-table → scalable-mode
context-table → PASID directory → PASID table, and the PASID-table entry then selects first-stage,
second-stage, nested or pass-through translation.

**Terminology note.** Rev 5.20 says *first-stage* and *second-stage* where earlier revisions and much
secondary material say *first-level* and *second-level*. Use the Rev 5.20 spelling; the paging-entry
mnemonics are correspondingly FS-PML5E/FS-PML4E/FS-PDPE/FS-PDE/FS-PTE and
SS-PML5E/SS-PML4E/SS-PDPE/SS-PDE/SS-PTE.

- **Claim.** Rev 5.20 names the translation stages "First-Stage Translation" (§3.6) and "Second-Stage Translation" (§3.7), with nested translation in §3.8 and pass-through translation in §3.9.  `[VT-d 5.20 §3.6]` `[8]` `C:high` `V:durable`

## 10.4 Translation structure formats (Ch.9)

This is the section the previous edition of this skill omitted entirely: it named root-entry,
context-entry and PASID table without ever laying out a single field.

### 10.4.1 Root-entry (§9.1) — 128 bits

| Bits | Field |
|---|---|
| 127:64 | Reserved |
| 63:12 | CTP — Context-table Pointer |
| 11:1 | Reserved |
| 0 | P — Present |

- **Claim.** A root-entry is 128 bits: bit 0 is Present (P), bits 11:1 are reserved, bits 63:12 are the Context-table Pointer (CTP) and bits 127:64 are reserved.  `[VT-d 5.20 §9.1]` `[8]` `C:high` `V:durable`
- **Claim.** The context-table referenced by a root-entry CTP is 4 KB in size and size-aligned, and hardware treats CTP bits 63:HAW as reserved where HAW is the platform host address width.  `[VT-d 5.20 §9.1]` `[8]` `C:high` `V:durable`
- **Claim.** The Root Table Address Register points at a table of root-entries when its TTM field is 00b.  `[VT-d 5.20 §9.1]` `[8]` `C:high` `V:durable`

### 10.4.2 Scalable-mode root-entry (§9.2) — 128 bits

The scalable-mode root-entry splits one bus number across two context-tables, which is why a
scalable-mode context-table covers 128 device-functions rather than 256.

| Bits | Field |
|---|---|
| 127:76 | UCTP — Upper Context Table Pointer |
| 75:65 | Reserved |
| 64 | UP — Upper Present |
| 63:12 | LCTP — Lower Context Table Pointer |
| 11:1 | Reserved |
| 0 | LP — Lower Present |

- **Claim.** A scalable-mode root-entry has LP (Lower Present) at bit 0, LCTP (Lower Context Table Pointer) at bits 63:12, UP (Upper Present) at bit 64 and UCTP (Upper Context Table Pointer) at bits 127:76.  `[VT-d 5.20 §9.2]` `[8]` `C:high` `V:durable`
- **Claim.** Both the upper and lower scalable-mode context-tables are 4 KB in size and size-aligned, and the Root Table Address Register points at a table of scalable-mode root-entries when TTM is 01b.  `[VT-d 5.20 §9.2]` `[8]` `C:high` `V:durable`

### 10.4.3 Context-entry (§9.3) — 128 bits, legacy mode

| Bits | Field |
|---|---|
| 127:88 | Reserved |
| 87:72 | DID — Domain Identifier |
| 71 | Reserved |
| 70:67 | IGN — Ignored |
| 66:64 | AW — Address Width |
| 63:12 | SSPTPTR — Second Stage Page Translation Pointer |
| 11:4 | Reserved |
| 3:2 | TT — Translation Type |
| 1 | FPD — Fault Processing Disable |
| 0 | P — Present |

- **Claim.** A context-entry has P at bit 0, FPD at bit 1, TT (Translation Type) at bits 3:2, SSPTPTR at bits 63:12, AW (Address Width) at bits 66:64, ignored bits at 70:67, and DID (Domain Identifier) at bits 87:72.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** Context-entry AW encodings are 000b reserved, 001b = 39-bit AGAW (3-level page table), 010b = 48-bit AGAW (4-level), 011b = 57-bit AGAW (5-level), and 100b–111b reserved.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** Context-entry TT encodings are 00b (untranslated requests translated through SSPTPTR; translated and translation requests blocked), 01b (untranslated, translated and translation requests supported, reserved when ECAP.DT = 0), 10b (untranslated requests processed as pass-through, SSPTPTR ignored, reserved when ECAP.PT = 0) and 11b reserved.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** The context-entry TT field applies only to requests-without-PASID, because hardware blocks all requests-with-PASID in legacy mode before they can use the context table.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** When context-entry TT indicates pass-through (10b), the AW field must be programmed to the largest AGAW value supported by hardware.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** Context-entries programmed with the same domain identifier must always reference the same address translation through SSPTPTR.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** When the Caching Mode (CM) field in the Capability Register is Set, the domain-id value of zero is architecturally reserved and software must not use it.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** The FPD field is evaluated by hardware irrespective of the setting of the Present field, so a not-present entry can still suppress fault reporting.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`

### 10.4.4 Scalable-mode context-entry (§9.4) — 256 bits

| Bits | Field |
|---|---|
| 255:85 | Reserved |
| 84 | RID_PRIV — Requester ID to PrivilegeModeRequested Assignment |
| 83:64 | RID_PASID — Requester ID to PASID Assignment |
| 63:12 | PASIDDIRPTR — PASID Directory Pointer |
| 11:9 | PDTS — PASID Directory Size |
| 8:7 | Reserved |
| 6 | EPTR — Enable PASID in Translated Requests |
| 5 | HPTE — HPT Enable |
| 4 | PRE — Page Request Enable |
| 3 | PASIDE — PASID Enable |
| 2 | DTE — Device-TLB Enable |
| 1 | FPD — Fault Processing Disable |
| 0 | P — Present |

- **Claim.** A scalable-mode context-entry is 256 bits with P at bit 0, FPD at bit 1, DTE at bit 2, PASIDE at bit 3, PRE at bit 4, HPTE at bit 5, EPTR at bit 6, PDTS at bits 11:9, PASIDDIRPTR at bits 63:12, RID_PASID at bits 83:64 and RID_PRIV at bit 84.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** A value of X in the PDTS field indicates that the scalable-mode PASID-directory has 2^(X+7) entries.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** Requests-without-PASID processed through a scalable-mode context-entry are treated as requests-with-PASID whose PASID value is taken from the RID_PASID field, with ExecuteRequested treated as 0.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** RID_PASID is treated as Reserved(0) on implementations reporting RPS = 0 in the Extended Capability Register, and such implementations use a PASID value of 0 for requests-without-PASID.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** RID_PRIV is treated as Reserved(0) on implementations reporting RPRIVS = 0 in the Extended Capability Register, which then use a PrivilegeModeRequested value of 0 for requests-without-PASID.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** DTE = 0 blocks translation requests (with or without PASID) and translated requests received through that scalable-mode context-entry; DTE = 1 allows translation requests to be processed through the PASID structures while translated requests bypass address translation.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** PRE is treated as Reserved(0) where ECAP.PRS = 0; when Clear, page requests reporting recoverable address translation faults are blocked.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** PASIDE is treated as Reserved(0) where ECAP.PASID = 0; when Clear, requests-with-PASID received through that scalable-mode context-entry are blocked. PASIDE does not apply to requests-without-PASID.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** EPTR is treated as Reserved(0) where ECAP.PTRS = 0; when Clear, translated requests with PASID are treated as Unsupported Request.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** HPTE is treated as Reserved(0) where ECAP.HPTS = 0; when Set, processing of translated requests includes the Host Permission Table.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** Programming DTE = 0 together with PRE = 1 in a scalable-mode context-entry is an illegal combination and raises a fault.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

### 10.4.5 Scalable-mode PASID-directory entry (§9.5) — 64 bits

| Bits | Field |
|---|---|
| 63:12 | SMPTBLPTR — Scalable-Mode PASID Table Pointer |
| 11:2 | Reserved |
| 1 | FPD |
| 0 | P |

- **Claim.** A scalable-mode PASID-directory entry has P at bit 0, FPD at bit 1, reserved bits 11:2, and SMPTBLPTR at bits 63:12 pointing at the base of a 4 KB scalable-mode PASID-table.  `[VT-d 5.20 §9.5]` `[8]` `C:high` `V:durable`
- **Claim.** SMPTBLPTR is always treated as a Host Physical Address, with bits 63:HAW reserved.  `[VT-d 5.20 §9.5]` `[8]` `C:high` `V:durable`
- **Claim.** If a scalable-mode PASID-directory entry is referenced through a scalable-mode context-entry whose FPD field is 1, the directory entry's own FPD field has no effect.  `[VT-d 5.20 §9.5]` `[8]` `C:high` `V:durable`

### 10.4.6 Scalable-mode PASID-table entry (§9.6) — 512 bits

This is the central structure of scalable mode: 64 bytes holding both stages of translation plus the
domain id and memory-type controls.

| Bits | Field |
|---|---|
| 0 | P — Present |
| 1 | FPD — Fault Processing Disable |
| 4:2 | AW — Address Width |
| 8:6 | PGTT — PASID Granular Translation Type |
| 9 | SSADE — Second Stage Access/Dirty Enable |
| 63:12 | SSPTPTR — Second Stage Page Table Pointer |
| 79:64 | DID — Domain Identifier |
| 87 | PWSNP — Page-walk Snoop |
| 88 | PGSNP — Page Snoop |
| 127:96 | PAT — Page Attribute Table |
| 128 | SRE — Supervisor Requests Enable |
| 131:130 | FSPM — First Stage Paging Mode |
| 132 | WPE — Write Protect Enable |
| 135 | EAFE — Extended Accessed Flag Enable |
| 191:140 | FSPTPTR — First Stage Page Table Pointer |

- **Claim.** A scalable-mode PASID-table entry is 512 bits wide.  `[VT-d 5.20 §9.6]` `[8]` `C:high` `V:durable`
- **Claim.** In a scalable-mode PASID-table entry, P is bit 0, FPD is bit 1, AW is bits 4:2, PGTT is bits 8:6, SSADE is bit 9, SSPTPTR is bits 63:12 and DID is bits 79:64.  `[VT-d 5.20 §9.6]` `[8]` `C:high` `V:durable`
- **Claim.** In a scalable-mode PASID-table entry, PWSNP is bit 87, PGSNP is bit 88, PAT is bits 127:96, SRE is bit 128, FSPM is bits 131:130, WPE is bit 132, EAFE is bit 135 and FSPTPTR is bits 191:140.  `[VT-d 5.20 §9.6]` `[8]` `C:high` `V:durable`
- **Claim.** PGTT encodings 000b, 101b, 110b and 111b are invalid; PGTT = 001b requires ECAP_REG.FSTS to be Set and PGTT = 010b requires the corresponding second-stage support bit, otherwise the entry is treated as invalidly programmed.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** PGTT = 011b selects nested translation, in which the FSPTPTR of a present scalable-mode PASID-table entry is itself translated through the second stage.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** PGTT = 100b selects pass-through translation.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** SSADE controls whether Accessed and Dirty flags are enabled in second-stage paging entries; when SSADE = 0 the A and D bits in second-stage entries are ignored by hardware.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** A scalable-mode PASID-table entry whose SRE field is 0 blocks untranslated and translation requests carrying a Set Privileged-mode-Requested field.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`

### 10.4.7 First-stage paging entries (§9.7)

First-stage paging entries reuse the IA-32e paging format, with VT-d-specific reinterpretations.

| Bits (FS-PTE, 4 KB page) | Field |
|---|---|
| 63:52 | IGN |
| 51:HAW | Reserved |
| (HAW-1):12 | ADDR |
| 11 | IGN |
| 10 | EA — Extended Accessed |
| 9 | IGN |
| 8 | G — Global (ignored by hardware) |
| 7 | PAT |
| 6 | D — Dirty |
| 5 | A — Accessed |
| 4 | PCD |
| 3 | PWT |
| 2 | U/S |
| 1 | R/W |
| 0 | P |

- **Claim.** In a first-stage PTE mapping a 4-KByte page, P is bit 0, R/W bit 1, U/S bit 2, PWT bit 3, PCD bit 4, A bit 5, D bit 6, PAT bit 7, G bit 8, EA bit 10, ADDR bits (HAW-1):12, bits 51:HAW reserved and bits 63:52 ignored.  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware ignores the G (Global) bit in first-stage paging entries and functions as if it were Clear.  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`
- **Claim.** The Extended Accessed (EA) bit at position 10 is meaningful only when EAFE = 1 in the relevant scalable-mode PASID-table entry, and is otherwise ignored.  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`
- **Claim.** In first-stage paging entries, bit 7 is PS (Page Size) for PDPE and PDE entries — must be 1 to map a 1-GByte or 2-MByte page respectively, and 0 to reference the next-level table.  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`
- **Claim.** The ADDR field of a first-stage paging entry is treated as a Guest Physical Address when the PGTT field in the relevant scalable-mode PASID-table entry is programmed as nested (011b).  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`
- **Claim.** Reserved bits 29:13 in a first-stage PDPE mapping a 1-GByte page, and bits 20:13 in a PDE mapping a 2-MByte page, must be zero.  `[VT-d 5.20 §9.7]` `[8]` `C:high` `V:durable`

### 10.4.8 Second-stage paging entries (§9.8)

Second-stage entries are a different format from the CPU's EPT entries and from first-stage entries:
read and write are separate bits at 0 and 1, and there is no Present bit.

| Bits (SS-PTE, 4 KB page) | Field |
|---|---|
| 63 | IGN |
| 62 | IW — I/O Write |
| 61 | IR — I/O Read |
| 60:52 | IGN |
| 51:HAW | Reserved |
| (HAW-1):12 | ADDR |
| 11 | SNP — Snoop |
| 10 | IGN |
| 9 | D — Dirty |
| 8 | A — Accessed |
| 7 | IGN (PS on SS-PDPE / SS-PDE) |
| 6 | IPAT — Ignore PAT |
| 5:3 | EMT — Extended Memory Type |
| 2 | IGN |
| 1 | W — Write |
| 0 | R — Read |

- **Claim.** In a second-stage PTE mapping a 4-KByte page, R is bit 0, W is bit 1, EMT is bits 5:3, IPAT is bit 6, A is bit 8, D is bit 9, SNP is bit 11, ADDR is bits (HAW-1):12, IR is bit 61 and IW is bit 62.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** In second-stage SS-PDPE and SS-PDE entries, bit 7 is PS (Page Size): 1 maps a 1-GByte or 2-MByte page respectively, 0 references the next-level second-stage table.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** The SNP field at bit 11 indicates whether accesses to the page must snoop processor caches, and is treated as reserved(0) on implementations reporting SC = 0 in the Extended Capability Register.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** IR and IW (bits 61 and 62) are treated as Reserved(0) when Second Stage I/O Read/Write bits are not enabled; when enabled, IW = 0 denies write permission and IR = 0 denies read permission for the region controlled by the entry.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** IPAT and EMT are ignored by hardware when the Extended Memory Type Enable (EMTE) field is Clear in the relevant scalable-mode PASID-table entry or when the Translation Table Mode is legacy (TTM = 00b).  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** Second-stage A and D bits at positions 8 and 9 are ignored by hardware when SSADE = 0 in the relevant scalable-mode PASID-table entry.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`
- **Claim.** In second-stage paging entries the address field is a Host Physical Address; in the 1-GByte and 2-MByte page-mapping forms, reserved fields 29:12 and 20:12 respectively must be zero.  `[VT-d 5.20 §9.8]` `[8]` `C:high` `V:durable`

## 10.5 The DMAR register set (Ch.11)

Offsets are relative to the remapping hardware unit's register base address. Two register groups —
the IOTLB registers and the fault recording registers — float, and their offsets must be read out of
capability registers.

| Offset | Register |
|---|---|
| 000h | Version Register (VER_REG) |
| 008h | Capability Register (CAP_REG) |
| 010h | Extended Capability Register (ECAP_REG) |
| 018h | Global Command Register (GCMD_REG) |
| 01Ch | Global Status Register (GSTS_REG) |
| 020h | Root Table Address Register (RTADDR_REG) |
| 028h | Context Command Register (CCMD_REG) |
| 034h | Fault Status Register (FSTS_REG) |
| 038h | Fault Event Control Register (FECTL_REG) |
| 03Ch | Fault Event Data Register |
| 040h | Fault Event Address Register |
| 044h | Fault Event Upper Address Register |
| 064h | Protected Memory Enable Register (PMEN_REG) |
| 068h | Protected Low-Memory Base Register |
| 06Ch | Protected Low-Memory Limit Register |
| 070h | Protected High-Memory Base Register |
| 078h | Protected High-Memory Limit Register |
| 080h | Invalidation Queue Head (IQH_REG) |
| 088h | Invalidation Queue Tail (IQT_REG) |
| 090h | Invalidation Queue Address Register (IQA_REG) |
| 09Ch | Invalidation Completion Status Register |
| 0A0h | Invalidation Completion Event Control Register (IECTL) |
| 0A4h | Invalidation Completion Event Data Register |
| 0A8h | Invalidation Completion Event Address Register |
| 0ACh | Invalidation Completion Event Upper Address Register |
| 0B0h | Invalidation Queue Error Record Register |
| 0B8h | Interrupt Remapping Table Address Register (IRTA_REG) |
| 0C0h | Page Request Queue Head Register |
| 0C8h | Page Request Queue Tail Register |
| 0D0h | Page Request Queue Address Register |
| 0DCh | Page Request Status Register |
| 0E0h | Page Request Event Control Register |
| 100h / 108h | MTRR Capability / MTRR Default Type Register |
| 300h | Performance Monitoring Capability Register |
| 400h | Enhanced Command Register |
| DC0h | RDT Configuration Register |
| E00h | Virtual Command Register |
| E30h | Virtual Command Capability Register |
| (from ECAP.IRO) | IOTLB Registers |
| (from CAP.FRO) | Fault Recording Registers [n] |

- **Claim.** In the remapping register region, VER_REG is at 000h, CAP_REG at 008h, ECAP_REG at 010h, GCMD_REG at 018h, GSTS_REG at 01Ch, RTADDR_REG at 020h and CCMD_REG at 028h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** FSTS_REG is at 034h, the Fault Event Control Register at 038h, Fault Event Data at 03Ch, Fault Event Address at 040h and Fault Event Upper Address at 044h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Protected Memory Enable Register is at 064h, Protected Low-Memory Base at 068h, Protected Low-Memory Limit at 06Ch, Protected High-Memory Base at 070h and Protected High-Memory Limit at 078h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Invalidation Queue Head is at 080h, Invalidation Queue Tail at 088h, Invalidation Queue Address Register at 090h, Invalidation Completion Status Register at 09Ch and the Invalidation Queue Error Record Register at 0B0h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Invalidation Completion Event Control, Data, Address and Upper Address registers are at 0A0h, 0A4h, 0A8h and 0ACh respectively.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Interrupt Remapping Table Address Register is at 0B8h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Request Queue Head, Tail and Address registers are at 0C0h, 0C8h and 0D0h, the Page Request Status Register at 0DCh and the Page Request Event Control Register at 0E0h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The MTRR Capability Register is at 100h and the MTRR Default Type Register at 108h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Performance Monitoring Capability Register is at 300h, the Enhanced Command Register at 400h, the RDT Configuration Register at DC0h, the Virtual Command Register at E00h and the Virtual Command Capability Register at E30h.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware may place the IOTLB registers and fault recording registers at any unused or reserved address in the 4 KB register space or in adjoined 4 KB regions; software must read the Capability Register to determine their offsets.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`

### 10.5.1 CAP_REG (§11.4.2)

| Bits | Field |
|---|---|
| 63 | ESRTPS — Enhanced Set Root Table Pointer Support |
| 62 | ESIRTPS — Enhanced Set Interrupt Remap Table Pointer Support |
| 61 | ECMDS — Enhanced Command Support |
| 60 | FS5LP — First Stage 5-level Paging Support |
| 59 | PI — Posted Interrupts |
| 56 | FS1GP — First Stage 1-GByte Page Support |
| 55 | DRD — Read Draining |
| 54 | DWD — Write Draining |
| 53:48 | MAMV — Maximum Address Mask Value |
| 47:40 | NFR — Number of Fault-recording Registers |
| 39 | PSI — Page Selective Invalidation |
| 37:34 | SSLPS — Second Stage Large Page Support |
| 33:24 | FRO — Fault-recording Register offset |
| 22 | ZLR — Zero Length Read |
| 21:16 | MGAW — Maximum Guest Address Width |
| 12:8 | SAGAW — Supported Adjusted Guest Address Widths |
| 7 | CM — Caching Mode |
| 6 | PHMR — Protected High-Memory Region |
| 5 | PLMR — Protected Low-Memory Region |
| 4 | RWBF — Required Write-Buffer Flushing |
| 2:0 | ND — Number of domains supported |

- **Claim.** In CAP_REG, ND is bits 2:0, RWBF bit 4, PLMR bit 5, PHMR bit 6, CM bit 7, SAGAW bits 12:8, MGAW bits 21:16, ZLR bit 22, FRO bits 33:24, SSLPS bits 37:34, PSI bit 39, NFR bits 47:40, MAMV bits 53:48, DWD bit 54, DRD bit 55, FS1GP bit 56, PI bit 59, FS5LP bit 60, ECMDS bit 61, ESIRTPS bit 62 and ESRTPS bit 63.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** In Rev 5.20 CAP_REG bit 3 is plain **Reserved (RsvdZ)** while **only bit 23 carries the DEP "Deprecated" marking**; both read as 0. The distinction matters when reading the register table — bit 3 lost the advanced-fault-logging capability outright rather than being deprecated in place.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** CAP_REG.ND encodes domain-id width: 000b = 4-bit (16 domains), 001b = 6-bit (64), 010b = 8-bit (256), 011b = 10-bit (1024), 100b = 12-bit (4K).  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** The Maximum Guest Address Width is computed as N+1 where N is the value in CAP_REG.MGAW; an implementation supporting 48-bit MGAW reports 47 (101111b).  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** CAP_REG.SSLPS bit 0 indicates support for a 21-bit offset to page frame (2 MB) and bit 1 a 30-bit offset (1 GB); bits 2 and 3 are reserved.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** If the register base address is X and CAP_REG.FRO reports Y, the address of the first fault recording register is X + (16 * Y).  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** The number of fault recording registers is N+1 where N is CAP_REG.NFR; implementations must support at least one per remapping hardware unit and the maximum is 256.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** CAP_REG.MAMV gives the maximum supported value for the Address Mask field in IVA_REG and in the IOTLB Invalidation Descriptor, and is valid only when CAP_REG.PSI is Set.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`

### 10.5.2 ECAP_REG (§11.4.3)

| Bits | Field | Bits | Field |
|---|---|---|---|
| 0 | C — Page-walk Coherency | 40 | PASID |
| 1 | QI — Queued Invalidation | 41 | DIT — Device-TLB |
| 2 | DT — Device-TLB support | 42 | PDS — Page-request Drain |
| 3 | IR — Interrupt Remapping | 43 | SMTS — Scalable Mode |
| 4 | EIM — Extended Interrupt Mode | 44 | VCS — Virtual Command |
| 6 | PT — Pass Through | 45 | SSADS — Second-Stage A/D |
| 7 | SC — Snoop Control | 46 | SSTS — Second-stage translation |
| 17:8 | IRO — IOTLB Register Offset | 47 | FSTS — First-stage translation |
| 23:20 | MHMV — Maximum Handle Mask Value | 48 | SMPWCS |
| 25 | MTS — Memory Type | 49 | RPS — RID-PASID Support |
| 26 | NEST — Nested Translation | 50 | TDXCS — TDX Connect |
| 29 | PRS — Page Request | 51 | PMS — Performance Monitoring |
| 30 | ERS — Execute Request | 52 | ADMS — Abort DMA Mode |
| 31 | SRS — Supervisor Request | 53 | RPRIVS — RID_PRIV |
| 33 | NWFS — No Write Flag | 55 | HPTS — HPT Support |
| 34 | EAFS — Extended Accessed Flag | 56 | PTRS — PASID in Translated Requests |
| 39:35 | PSS — PASID Size | 57 | SSIRWS |
| | | 58 | SMS — Stop Marker |
| | | 59 | HPT1GPS |
| | | 60 | RDTS |
| | | 61 | EIMER |
| | | 62 | IRREQ — Interrupt Remapping Required |

- **Claim.** In ECAP_REG, C is bit 0, QI bit 1, DT bit 2, IR bit 3, EIM bit 4, PT bit 6, SC bit 7, IRO bits 17:8, MHMV bits 23:20, MTS bit 25, NEST bit 26, PRS bit 29, ERS bit 30, SRS bit 31, NWFS bit 33, EAFS bit 34 and PSS bits 39:35.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** In ECAP_REG, PASID is bit 40, DIT bit 41, PDS bit 42, SMTS bit 43, VCS bit 44, SSADS bit 45, SSTS bit 46, FSTS bit 47, SMPWCS bit 48, RPS bit 49, TDXCS bit 50, PMS bit 51, ADMS bit 52, RPRIVS bit 53, HPTS bit 55, PTRS bit 56, SSIRWS bit 57, SMS bit 58, HPT1GPS bit 59, RDTS bit 60, EIMER bit 61 and IRREQ bit 62.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** ECAP_REG bits 5, 24 and 28 are marked Deprecated in Rev 5.20 and must be reported as 0.  `[VT-d 5.20 §11.4.3]` `[8]` `C:medium` `V:durable`
- **Claim.** If the register base address is X and ECAP_REG.IRO reports Y, the IOTLB registers are at X + (16 * Y).  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** ECAP_REG.SC = 1 means hardware supports the 1-setting of the SNP field in second-stage page-table entries and the PGSNP field in scalable-mode PASID-table entries.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** ECAP_REG.MHMV reports the maximum supported value for the Interrupt Mask field in the Interrupt Entry Cache Invalidation Descriptor, and reads as 0 when IR is Clear.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** ECAP_REG.EIM = 1 indicates hardware supports 32-bit APIC-IDs (x2APIC mode); implementations reporting IR as Clear also report EIM as Clear.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`

### 10.5.3 GCMD_REG / GSTS_REG and the handshake protocol (§11.4.4)

| Bit | GCMD_REG | GSTS_REG |
|---|---|---|
| 31 | TE — Translation Enable | TES |
| 30 | SRTP — Set Root Table Pointer | RTPS |
| 27 | WBF — Write Buffer Flush | WBFS |
| 26 | QIE — Queued Invalidation Enable | QIES |
| 25 | IRE — Interrupt Remapping Enable | IRES |
| 24 | SIRTP — Set Interrupt Remap Table Pointer | IRTPS |
| 23 | CFI — Compatibility Format Interrupt | CFIS |

- **Claim.** In GCMD_REG, TE is bit 31, SRTP bit 30, WBF bit 27, QIE bit 26, IRE bit 25, SIRTP bit 24 and CFI bit 23; bits 29:28 and 22:0 are reserved in Rev 5.20.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** GSTS_REG mirrors GCMD_REG with TES at bit 31, RTPS bit 30, WBFS bit 27, QIES bit 26, IRES bit 25, IRTPS bit 24 and CFIS bit 23; bits 29:28 and 22:0 are reserved.  `[VT-d 5.20 §11.4.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** All GCMD_REG command fields are write-only; software reads the corresponding GSTS_REG field to observe the result.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** If multiple control fields in GCMD_REG need to be modified, software must serialize the modifications through multiple writes to the register.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`

The spec gives the handshake as explicit pseudocode, and it is worth reproducing because getting it
wrong is the classic way to accidentally clear an unrelated enable bit:

```
1. Tmp    = Read GSTS_REG
2. Status = (Tmp & 96FFFFFFh)          // reset the one-shot bits
3. Command = Y ? (Status | (1 << X)) : (Status & ~(1 << X))
4. Write Command to GCMD_REG
5. Wait until GSTS_REG[X] indicates the command is serviced
```

- **Claim.** To update GCMD_REG bit X to value Y, software reads GSTS_REG, masks the result with 96FFFFFFh to reset the one-shot bits, sets or clears bit X, writes the result to GCMD_REG, and waits until GSTS_REG[X] indicates the command is serviced.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Behaviour is undefined if GCMD_REG is written while a command is in progress on the Enhanced Command Interface (ECRESP_REG.IP = 1).  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware must enable or disable remapping logic only at deterministic transaction boundaries, so that an in-flight transaction is either subject to remapping or not at all.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Set Root Table Pointer operation is specified in VT-d §6.6, Set Interrupt Remapping Table Pointer operation in §6.7 and Write Buffer Flushing in §6.8.  `[VT-d 5.20 §6.6]` `[8]` `C:high` `V:durable`

The mask 96FFFFFFh preserves bits 31, 28, 26, 25 and 23:0 and clears bits 30, 29, 27 and 24 —
that is, it zeroes exactly the one-shot commands SRTP, WBF and SIRTP while preserving the latched
enables TE, QIE and IRE.

### 10.5.4 Protected memory registers (§11.4.8)

- **Claim.** In the Protected Memory Enable Register, EPM (Enable Protected Memory) is bit 31 and PRS (Protected Region Status) is bit 0.  `[VT-d 5.20 §11.4.8.1]` `[8]` `C:high` `V:durable`
- **Claim.** The protected low-memory region is described by the Protected Low-Memory Base and Limit registers (§11.4.8.2 and §11.4.8.3) and the protected high-memory region by the Protected High-Memory Base and Limit registers (§11.4.8.4 and §11.4.8.5).  `[VT-d 5.20 §11.4.8]` `[8]` `C:high` `V:durable`
- **Claim.** Support for the protected low- and high-memory regions is reported by CAP_REG.PLMR (bit 5) and CAP_REG.PHMR (bit 6).  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`

## 10.6 Caching and invalidation (Ch.6)

### 10.6.1 What is cached

- **Claim.** VT-d Chapter 6 defines the context-cache (§6.2.2), PASID-cache (§6.2.3), IOTLB (§6.2.4), paging-structure caches PML5-cache / PML4-cache / PDPE-cache / PDE-cache (§6.2.5), HPT cache (§6.2.6) and interrupt entry cache (§6.4).  `[VT-d 5.20 Ch.6]` `[8]` `C:high` `V:durable`
- **Claim.** The Caching Mode field in the Capability Register indicates whether the hardware implementation caches not-present or erroneous translation-structure entries.  `[VT-d 5.20 §6.1]` `[8]` `C:high` `V:durable`
- **Claim.** When CM is Set, any software update to remapping structures other than first-stage mappings, including updates to not-present entries and to present entries whose programming resulted in translation faults, requires explicit invalidation of the caches.  `[VT-d 5.20 §6.1]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware implementations of the architecture must support operation corresponding to CM = 0; CM = 1 exists so that software emulating remapping hardware can virtualize it efficiently, and software managing remapping hardware should handle both caching modes.  `[VT-d 5.20 §6.1]` `[8]` `C:high` `V:durable`

CM = 1 is therefore a *virtual* IOMMU signal in practice: it lets a VMM trap every guest invalidation
and keep shadow structures consistent without write-protecting the guest tables.

### 10.6.2 Register-based invalidation (§6.5.1)

- **Claim.** In CCMD_REG, ICC (Invalidate Context-Cache) is bit 63, CIRG (Context Invalidation Request Granularity) bits 62:61, CAIG (Context Actual Invalidation Granularity) bits 60:59, FM (Function Mask) bits 33:32, SID bits 31:16 and DID bits 15:0.  `[VT-d 5.20 §11.4.6.1]` `[8]` `C:high` `V:durable`
- **Claim.** CCMD_REG.CIRG encodes global invalidation as 01b, domain-selective invalidation as 10b and device-selective invalidation as 11b.  `[VT-d 5.20 §11.4.6.1]` `[8]` `C:high` `V:durable`
- **Claim.** The IOTLB registers consist of two adjacently placed 64-bit registers: the Invalidate Address Register at the offset reported by ECAP_REG.IRO, and the IOTLB Invalidate Register at that offset plus 008h.  `[VT-d 5.20 §11.4.6.2]` `[8]` `C:high` `V:durable`
- **Claim.** In the IOTLB Invalidate Register, IVT (Invalidate IOTLB) is bit 63, IIRG (IOTLB Invalidation Request Granularity) bits 61:60, IAIG (IOTLB Actual Invalidation Granularity) bits 58:57, DR (Drain Reads) bit 49, DW (Drain Writes) bit 48 and DID bits 47:32.  `[VT-d 5.20 §11.4.6.3]` `[8]` `C:high` `V:durable`
- **Claim.** In the Invalidate Address Register, ADDR is bits 63:12, IH (Invalidation Hint) is bit 6 and AM (Address Mask) is bits 5:0.  `[VT-d 5.20 §11.4.6.4]` `[8]` `C:high` `V:durable`
- **Claim.** Page-selective invalidation through IVA_REG is available only on hardware reporting CAP_REG.PSI as Set.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`

### 10.6.3 Queued invalidation (§6.5.2)

Queued invalidation replaces the one-at-a-time register handshake with a ring of descriptors. It is
the only route to PASID-granular and device-TLB invalidation.

- **Claim.** Queued invalidation is supported only on hardware reporting ECAP_REG.QI as Set, is enabled through GCMD_REG.QIE and observed through GSTS_REG.QIES.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** The invalidation queue is located by IQA_REG at offset 090h, with IQH_REG at 080h giving the offset of the descriptor hardware will read next and IQT_REG at 088h the offset software will write next.  `[VT-d 5.20 §11.4]` `[8]` `C:high` `V:durable`
- **Claim.** The Type field of an invalidation descriptor is a 7-bit field formed by concatenating bits 11:9 and bits 3:0 of the descriptor.  `[VT-d 5.20 §6.5.2]` `[8]` `C:high` `V:durable`

| Type | Descriptor | Section |
|---|---|---|
| 1h | Context-cache Invalidate (`cc_inv_dsc`) | §6.5.2.1 |
| 2h | IOTLB Invalidate (`iotlb_inv_dsc`) | §6.5.2.3 |
| 3h | Device-TLB Invalidate (`dev_tlb_inv_dsc`) | §6.5.2.5 |
| 4h | Interrupt Entry Cache Invalidate (`iec_inv_dsc`) | §6.5.2.8 |
| 5h | Invalidation Wait (`inv_wait_dsc`) | §6.5.2.9 |
| 6h | PASID-based IOTLB Invalidate (`p_iotlb_inv_dsc`) | §6.5.2.4 |
| 7h | PASID-cache Invalidate (`pc_inv_dsc`) | §6.5.2.2 |
| 8h | PASID-based-Device-TLB Invalidate (`p_dev_tlb_inv_dsc`) | §6.5.2.6 |
| 9h | Page Group Response (`pgrp_resp_dsc`) | §7.6.1 |
| Ah | HPT Cache Invalidate | §6.5.2.7 |

- **Claim.** Invalidation descriptor type 1h is the Context-cache Invalidate Descriptor, 2h the IOTLB Invalidate Descriptor, 3h the Device-TLB Invalidate Descriptor, 4h the Interrupt Entry Cache Invalidate Descriptor and 5h the Invalidation Wait Descriptor.  `[VT-d 5.20 §6.5.2]` `[8]` `C:high` `V:durable`
- **Claim.** Invalidation descriptor type 6h is the PASID-based IOTLB Invalidate Descriptor, 7h the PASID-cache Invalidate Descriptor, 8h the PASID-based-Device-TLB Invalidate Descriptor and Ah the HPT Cache Invalidate Descriptor.  `[VT-d 5.20 §6.5.2]` `[8]` `C:high` `V:durable`
- **Claim.** The Page Group Response Descriptor, submitted through the invalidation queue, carries Type value 9h.  `[VT-d 5.20 §7.6.1]` `[8]` `C:high` `V:durable`

### 10.6.4 Ordering and completion rules (§6.5.2.12)

- **Claim.** Hardware completes a PASID-based IOTLB invalidation descriptor only after all context-cache and PASID-cache invalidation descriptors ahead of it in the invalidation queue are completed.  `[VT-d 5.20 §6.5.2.12]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware completes an IOTLB invalidation descriptor only after all context-cache invalidation descriptors ahead of it in the invalidation queue are completed.  `[VT-d 5.20 §6.5.2.12]` `[8]` `C:high` `V:durable`
- **Claim.** Software must always request IOTLB invalidation before requesting the corresponding Device-TLB invalidation.  `[VT-d 5.20 §6.5.2.5]` `[8]` `C:high` `V:durable`
- **Claim.** If the Fence (FN) flag is 1 in an Invalidation Wait Descriptor, hardware must execute descriptors following it only after the wait command is completed.  `[VT-d 5.20 §6.5.2.12]` `[8]` `C:high` `V:durable`
- **Claim.** The Invalidation Wait Descriptor allows software to synchronize with hardware for descriptors submitted ahead of it, and hardware generation of invalidation completion events is specified in §6.5.2.10.  `[VT-d 5.20 §6.5.2.9]` `[8]` `C:high` `V:durable`
- **Claim.** When the Invalidation Time-out Error (ITE) condition is signalled, hardware aborts any Invalidation Wait Descriptor commands pending in hardware.  `[VT-d 5.20 §6.5.2.11]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d §6.5.3.3 gives normative guidance to software for invalidations, and §6.5.3.4 the equivalent guidance when HPT is enabled.  `[VT-d 5.20 §6.5.3.3]` `[8]` `C:high` `V:durable`
- **Claim.** Draining of requests to memory is specified in §6.5.4 and interrupt draining in §6.5.5.  `[VT-d 5.20 §6.5.4]` `[8]` `C:high` `V:durable`

## 10.7 Device-TLBs, ATS, PRI and PASID (Ch.4)

### 10.7.1 Device-TLB operation

- **Claim.** VT-d Chapter 4 "Support For Device-TLBs" defines Device-TLB operation in §4.1, comprising translation requests (§4.1.1), translation completions (§4.1.2), translated requests (§4.1.3) and invalidation requests and completions (§4.1.4).  `[VT-d 5.20 Ch.4]` `[8]` `C:high` `V:durable`
- **Claim.** Device-TLB support is enumerated by ECAP_REG.DT (bit 2), and in legacy mode is enabled per device by the context-entry TT field value 01b.  `[VT-d 5.20 §9.3]` `[8]` `C:high` `V:durable`
- **Claim.** In scalable mode, device-TLB use is gated by the DTE field at bit 2 of the scalable-mode context-entry.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d §4.5 gives recommended software sequences to enable ATS (§4.5.1) and to disable ATS (§4.5.2).  `[VT-d 5.20 §4.5]` `[8]` `C:high` `V:durable`
- **Claim.** Handling of ATS protocol errors is specified in §4.2.1, root-port control of ATS address types in §4.2.2, and handling of translation requests in §4.2.3.  `[VT-d 5.20 §4.2]` `[8]` `C:high` `V:durable`
- **Claim.** Device TLBs in System-on-Chip integrated devices are treated separately in §4.4.  `[VT-d 5.20 §4.4]` `[8]` `C:high` `V:durable`
- **Claim.** Rev 5.20 adds the Host Permission Table in §4.2.4, a permission structure consulted when processing translated requests, with its entry formats HPTL4E through HPTL1E in §9.12.  `[VT-d 5.20 §4.2.4]` `[8]` `C:high` `V:durable`

### 10.7.2 Page requests and PASID

The recoverable-fault path — page requests, the page request queue, and page group responses —
is owned by `12-vtd-faults-bios-siov.md`. What belongs here is the enabling plumbing.

- **Claim.** Page Request Service support is enumerated by ECAP_REG.PRS (bit 29) and enabled per device by the PRE field at bit 4 of the scalable-mode context-entry.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** PASID support is enumerated by ECAP_REG.PASID (bit 40), and the supported PASID width is reported by ECAP_REG.PSS at bits 39:35.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** The PASID field in a scalable-mode context-entry's RID_PASID occupies 20 bits (83:64), consistent with the 20-bit PASID space.  `[VT-d 5.20 §9.4]` `[8]` `C:high` `V:durable`
- **Claim.** Supervisor Request support is enumerated by ECAP_REG.SRS (bit 31) and Execute Request support by ECAP_REG.ERS (bit 30).  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** Requests carrying an Execute-Requested (ER) field set are rejected on hardware reporting Major Version 8 and above in VER_REG unless the configuration permits them, and on Major Version 7 and below when ECAP_REG.ERS is 0.  `[VT-d 5.20 §7.1.3]` `[8]` `C:medium` `V:durable`
- **Claim.** VT-d §3.12.7 explicitly covers Intel Scalable I/O Virtualization capable devices as a category of DMA request origination, alongside SR-IOV capable devices in §3.12.6.  `[VT-d 5.20 §3.12.7]` `[8]` `C:high` `V:durable`

## 10.8 Special request handling in Chapter 3

- **Claim.** Requests crossing page boundaries are handled per §3.13, zero-length reads per §3.14, requests to the interrupt address range per §3.15, requests to reserved system memory per §3.16, and root-complex peer-to-peer considerations per §3.17.  `[VT-d 5.20 §3.13]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware detecting an output address in the interrupt address range FEEx_xxxxh after remapping raises a fault in both legacy mode and scalable mode.  `[VT-d 5.20 §7.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Snoop behaviour is specified in §3.10 and memory type in §3.11, with the effective memory type derivation in §3.11.3 and the mode-specific rules in §3.11.4.1 (legacy) and §3.11.4.2 (scalable).  `[VT-d 5.20 §3.11]` `[8]` `C:high` `V:durable`
- **Claim.** Appendix A of the VT-d specification tabulates snoop and memory type for the various remapping structures.  `[VT-d 5.20 App.A]` `[8]` `C:high` `V:durable`

## 10.9 Pitfalls

1. **Do not call it "first-level"/"second-level" in Rev 5.20 prose.** The spec renamed these to
   first-stage and second-stage, and the register bit names followed (FSTS, SSTS, SSADS, SSPTPTR).
2. **A scalable-mode context-table is half the size you expect.** The scalable-mode root-entry has two
   context-table pointers, upper and lower, each covering 128 device-functions.
3. **Second-stage entries have no Present bit.** Presence is implied by R or W being set; a reserved-field
   check only applies when at least one permission bit is set.
4. **IOTLB and fault recording register offsets are not constants.** They come from ECAP_REG.IRO and
   CAP_REG.FRO, scaled by 16.
5. **The GCMD_REG one-shot mask matters.** Writing a naively-constructed value re-triggers SRTP,
   WBF or SIRTP, or clears TE/QIE/IRE. Always build the command from GSTS_REG masked with
   96FFFFFFh.
6. **Bit 3 of CAP_REG and bits 5/24/28 of ECAP_REG are deprecated in Rev 5.20.** Material written
   against earlier revisions assigns them meanings (notably advanced fault logging) that no longer
   apply — see `12-vtd-faults-bios-siov.md`.
