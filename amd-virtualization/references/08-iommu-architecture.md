# 08. AMD-Vi: Architecture and Registers

> **中文速览**：本章是"硬件此刻在做什么"：Zen 平台上 IOMMU 在数据通路中的位置（**不是 2007 年的 HyperTransport/I-O Hub 拓扑**）、MMIO 寄存器的逐位定义、Status Register、PCI 能力块、Device Table Entry 的转换侧字段，以及事件日志 / PPR 日志 / GA 日志的**条目格式**——它们和指向它们的寄存器放在一起才有用。我要建的表在 `09`，中断重映射在 `10`。

**Maps to:** AMD I/O Virtualization Technology (IOMMU) Specification 48882-PUB Rev 3.11: Ch.1–2 + §2.2.2 "Device Table" + §3.4 (MMIO registers). The specification has five chapters and no appendices. [7]
**Owns:** the platform data path · the MMIO register map and every register bit · the Status register · the PCI capability block · the translation-side DTE fields · event, PPR and GA log entry formats · the segmented Device Table · request-type routing
**Scope:** OS-independent hardware — AMD-Vi is present on every AM4/AM5 SoC regardless of chipset.
**See also:** `09-iommu-page-tables.md` · `10-iommu-interrupt-remapping.md` · `16-windows-platform.md` (Kernel DMA Protection)

---

## 8.1 Where the IOMMU sits on a Zen platform

The IOMMU is not a chipset add-on and it is not reached over a HyperTransport link on any current
part. It is a PCI function inside the SoC's I/O complex, positioned between downstream requesters
and the memory controller, and it is discovered the same way every other platform device is
discovered: from an ACPI table, not by probing.

- **Claim.** The IOMMU is implemented as an independent PCI Function; any PCI Function containing an IOMMU capability block may not be used for any other purpose, and such a Function has no PCI BAR registers — its register window is programmed through the capability block instead.  `[IOMMU 3.11 §3.1]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU's PCI class code is System Base Peripheral (08h), subclass IOMMU (06h), programming interface 00h, as issued by the PCI-SIG.  `[IOMMU 3.11 §3.1]` `[7][53]` `C:high` `V:durable`
- **Claim.** More than one IOMMU capability block may be implemented in a single PCIe Function; when it is, the Function must be able to generate MSI-X interrupts and must assign a distinct vector to every interrupt each capability block can raise.  `[IOMMU 3.11 §3.1]` `[7]` `C:high` `V:durable`

### The fabric, not a tunnel

- **Claim.** AMD describes the platform as processor and device nodes joined by "a data fabric such as AMD Infinity Fabric, Data Fabric links or other means"; an IOMMU can only process memory transactions routed through *its* node, so a platform with several I/O interconnect trees needs an IOMMU at the root of each one.  `[IOMMU 3.11 §1.1]` `[7]` `C:high` `V:durable`
- **Claim.** AMD's own platform recommendation is that an IOMMU should be a root-complex device appearing directly at the top of the PCI tree, and it warns that some system software prohibits an IOMMU from appearing under a PCI-to-PCI bridge.  `[IOMMU 3.11 §4.5]` `[7]` `C:high` `V:durable`
- **Claim.** The HyperTransport tunnel, peripheral-bus-bridge, hybrid and chained topologies are still carried in the specification as implementation options, and the tunnel form is explicitly limited: HyperTransport supplies only 5 bits of UnitID, so a tunnel IOMMU can give distinct translations to at most 31 downstream devices and cannot tell devices apart behind a bridge.  `[IOMMU 3.11 §4.2]` `[7]` `C:high` `V:durable`
- **Claim.** On client AM4 and AM5 parts the IOMMU is integrated in the SoC's I/O die / NBIO complex and its presence does not depend on the chipset; no AMD document in this corpus states this in those words, so it is recorded here as an ecosystem fact rather than an architectural one.  `[no-spec]` `[7]` `C:medium` `V:durable`

### DeviceID derivation

- **Claim.** I/O devices that originate transactions are identified by a 16-bit DeviceID whose derivation is fabric-dependent; for PCIe and PCI-X the RequesterID maps as Bus[15:8], Device[7:3], Function[2:0], and for data-fabric requesters as Bus[15:8], UnitID[7:3], zero[2:0].  `[IOMMU 3.11 Figure 5]` `[7]` `C:high` `V:durable`
- **Claim.** AMD flags the PCIe partitioning as "a typical example" — the number of bits given to Bus, Device and Function varies with the PCI configuration, and DeviceID mapping from one bus to another is platform-specific.  `[IOMMU 3.11 §2.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** If a peripheral uses PCI phantom functions, software must replicate Device Table entries so that the index calculation retrieves a correct entry for every phantom function the device uses.  `[IOMMU 3.11 §2.2.2]` `[7]` `C:high` `V:durable`

### Request-type routing

Which tables a request touches is decided by the *kind* of request, before any table is read. This is
the routing rule set that the rest of the chapter assumes.

| Request arriving from downstream | What the IOMMU does |
|---|---|
| Response, fence or flush | passed upstream unaltered |
| Address inside the IOMMU exclusion range | passed upstream unaltered |
| Memory read / write (untranslated) | Device Table lookup, then I/O page tables; forwarded if permitted |
| Address translation (ATS) request | same lookups; translation and permissions returned to the peripheral |
| Pre-translated memory read / write | not translated again, provided the device is marked able to issue them |
| Peripheral page request (PPR) | PPR log entry, or an event-log entry if PPR is not supported |
| Upstream interrupt | Device Table lookup, then the interrupt remapping tables |
| SMI | optionally the SMI filter; never the interrupt remapping tables |
| Port I/O space transaction | Device Table lookup only, to decide whether port I/O is allowed |
| Transaction arriving from *upstream* | passed downstream unaltered |

- **Claim.** Table above reproduces the normal-operation flow: read, write and interrupt transactions generated by the IOMMU itself are never translated by the IOMMU, upstream transactions pass downstream unaltered, and interrupt addresses are never translated into system memory addresses.  `[IOMMU 3.11 §2.1.1]` `[7]` `C:high` `V:durable`
- **Claim.** Pre-translated read and write requests are not translated again if the device is marked as able to generate pre-translated addresses; the IOMMU validates only that DTE[I]=1 and does not validate the system physical address the device supplies.  `[IOMMU 3.11 §2.11]` `[7]` `C:high` `V:durable`
- **Claim.** Device Table, I/O page table and interrupt remapping table reads use an isochronous virtual channel restricted to system memory addresses, to avoid deadlock; command-buffer reads and event, PPR and guest-vAPIC log writes use the normal virtual channel.  `[IOMMU 3.11 §2.1]` `[7]` `C:high` `V:durable`
- **Claim.** The optional MARC feature lets SoC-integrated devices bypass IOMMU translation for up to four or eight statically programmed 4-Kbyte-granular apertures, with `MMIO 0030h[MarcSup]` giving the count (01b = four 3-tuples, 10b = eight) and `MMIO 0018h[MarcEn]` the global enable; a DVA outside every enabled aperture falls through to the IOMMU with no error.  `[IOMMU 3.11 §2.9]` `[7]` `C:high` `V:durable`
- **Claim.** When `MMIO 01A0h[HTRangeIgnore]`=0 the address range FD_0000_0000h–FF_FFFF_FFFFh carries special meaning — FD_F800_0000h–FD_F8FF_FFFFh is interrupt/EOI (controlled by IntCtl and the remapping tables), FD_F900_0000h legacy PIC IACK, FD_F910_0000h system management (SysMgt), FD_FC00_0000h I/O space (IoCtl), FD_FE00_0000h configuration; when HTRangeIgnore=1 those ranges are treated as ordinary guest physical addresses.  `[IOMMU 3.11 Table 3]` `[7]` `C:high` `V:durable`

## 8.2 The MMIO register map

- **Claim.** The IOMMU register window is **16 Kbytes when `MMIO 0030h[PCSup]`=0 and 512 Kbytes when PCSup=1**; software allocates and 16-Kbyte- or 512-Kbyte-aligns the region itself and programs its base through the capability block, and when PCSup=1 `BaseAddress[18:14]` must be zero.  `[IOMMU 3.11 §2.3]` `[7]` `C:high` `V:durable`
  > The figure that circulates instead is a misreading of the `BaseAddress[31:14]` field width — see `errata.md` E02.
- **Claim.** Software accesses to IOMMU registers may be no wider than 64 bits, must be naturally aligned, must have a power-of-two size in bytes, and may be as small as one byte.  `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`

| Offset | Register |
|---|---|
| 0000h | Device Table Base Address (`DevTabBase[51:12]`, `Size[8:0]`) |
| 0008h | Command Buffer Base Address (`ComBase[51:12]`, `ComLen[59:56]`) |
| 0010h | Event Log Base Address (`EventBase`, `EventLen`) |
| 0018h | **IOMMU Control** |
| 0020h / 0028h | Exclusion Base / Exclusion Range Limit (repurposed as Completion Store Base / Limit when SNP-enabled) |
| 0030h | **Extended Feature Register (EFR)** |
| 0038h | PPR Log Base Address |
| 0040h / 0048h / 0050h | Hardware Event Upper / Lower / Status |
| 0060h–00D8h | SMI Filter Register 0–15 |
| 00E0h / 00E8h | Guest Virtual APIC Log Base Address / Log Tail Address |
| 00F0h / 00F8h | PPR Log B Base Address / Event Log B Base Address |
| 0100h–0130h | Device Table Segment 1–7 Base Address |
| 0138h / 0140h / 0148h | Device-Specific Feature / Control / Status Extension |
| 0150h–0168h | MSI capability registers mapped into MMIO |
| 016Ch | Performance Optimization Control |
| 0170h–0180h | XT (x2APIC) IOMMU Interrupt Control |
| 0190h | vIOMMU Status |
| 01A0h | **Extended Feature 2 Register (EFR2)** |
| 0200h–0258h | MARC aperture 0–3 base / relocation / length triples |
| 1FF8h | IOMMU Reserved (not for software use) |
| 2000h / 2008h | Command Buffer Head / Tail Pointer |
| 2010h / 2018h | Event Log Head / Tail Pointer |
| 2020h | **IOMMU Status** |
| 2030h / 2038h | PPR Log Head / Tail Pointer |
| 2040h / 2048h | GA Log Head / Tail Pointer |
| 2050h / 2058h | PPR Log B Head / Tail Pointer |
| 2070h / 2078h | Event Log B Head / Tail Pointer |
| 2080h | PPR Log Auto Response |
| 2088h / 2090h | PPR Log / PPR Log B Overflow Early Indicator |
| 4000h–4018h | Counter Configuration and the three Bank-Lock registers |

- **Claim.** The offsets in the table above are the register map of §3.4; the SMI filter block is 16 contiguous 64-bit registers at 0060h–00D8h whose implemented count is reported by `EFR[SmiFRC]`, and the event-counter block at 4000h and above is reserved when `EFR[PCSup]`=0.  `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`

### Ring-buffer base registers

The command buffer, event log, event log B and PPR log share one register shape: a 4-Kbyte-aligned
`Base[51:12]`, a 4-bit power-of-two length at bits 59:56, everything else reserved.

- **Claim.** `ComLen`, `EventLen`, `EventLogBlen` and `PPRLogLen` all reset to 1000b, all reserve encodings below 1000b, and all run 1000b = 256 entries (4 Kbytes) through 1111b = 32768 entries (512 Kbytes) — these logs hold 16-byte records.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `GALogLen` uses the same field position but a different table because guest-vAPIC records are 8 bytes: 1000b = 512 entries (4 Kbytes) through 1100b = 8192 entries (64 Kbytes), with 1101b–1111b reserved.  `[IOMMU 3.11 §3.4.4]` `[7]` `C:high` `V:durable`
- **Claim.** Every head and tail pointer register carries its offset in bits 18:4, 16-byte aligned, with bits 3:0 and 63:19 reserved; writing a base-address register resets the matching head and tail pointers to zero, and head equal to tail means the buffer is empty.  `[IOMMU 3.11 §3.4.15]` `[7]` `C:high` `V:durable`
- **Claim.** The Device Table Base Address register's `Size[8:0]` holds an unsigned n giving a table of (n+1) × 4 Kbytes, so 000h is 4 Kbytes and the maximum 1FFh is 2 Mbytes — the size of a full 64K-entry Device Table.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** The exclusion registers at 0020h and 0028h carry a 4-Kbyte-aligned `Exclusion Base Address[51:12]` with `Allow`(1) and `ExEn`(0), and an `Exclusion Limit[51:12]` whose low 12 bits are treated as FFFh for comparison, so base equal to limit is a 4-Kbyte range; `Allow`=1 forwards every device's accesses to the range untranslated, `Allow`=0 defers to DTE[EX].  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** The exclusion range test is **not** applied to a transaction presenting a valid PASID TLP prefix, and a peripheral with a remote IOTLB may cache the result of a translation request to the range, so changing the range requires an `INVALIDATE_IOTLB_PAGES` — see `09-iommu-page-tables.md`.  `[IOMMU 3.11 §3.4.1]` `[7][53]` `C:high` `V:durable`
- **Claim.** `MMIO 00E8h[GATAddr]` holds an 8-byte-aligned system physical address at which the IOMMU shadows the guest-vAPIC log tail pointer so software need not read the MMIO register; when GATAddr is zero the shadow is not written and software must read `MMIO 2048h` instead.  `[IOMMU 3.11 §3.4.4]` `[7]` `C:high` `V:durable`
- **Claim.** Once the system is SNP-enabled, writes are discarded to the Device Table Base, Command Buffer Base, Event Log Base, Exclusion Base and Limit, PPR Log Base, GA Log Base and Tail Address, PPR Log B Base, Event Log B Base and all seven Device Table Segment Base registers, and to `Control[IommuEn]` and `Control[DevTblSegEn]`.  `[IOMMU 3.11 §2.12.2.1]` `[7]` `C:high` `V:durable`

## 8.3 Control and Status registers

### IOMMU Control Register, MMIO 0018h

| Bits | Field | Bits | Field |
|---|---|---|---|
| 63:61 | SNPAVICEn | 24 | SmiFLogEn |
| 60 | GstBufferTRPMode | 23 | SlfWBdis |
| 59 | IRTCacheDis | 22 | SmiFEn |
| 58 | GCR3TRPMode | 21:18 | CRW (RO, reserved) |
| 57 | Reserved | 17 | GAEn |
| 56 | TMPMEn | 16 | GTEn |
| 55 | GAPPIEn | 15 | PPREn |
| 54 | GAUpdateDis | 14 | PprIntEn |
| 53 | vIommuEn | 13 | PPRLogEn |
| 52 | vCmdEn | **12** | **CmdBufEn** |
| 51 | IntCapXTEn | 11 | Isoc |
| 50 | XTEn | 10 | Coherent |
| 49 | Reserved | 9 | ResPassPW |
| 48 | GDUpdateDis | 8 | PassPW |
| 47:46 | HADUpdate | 7:5 | InvTimeOut |
| 45 | EPHEn | 4 | ComWaitIntEn |
| 44:43 | NumIntRemapMode | 3 | EventIntEn |
| 42 | PprAutoRspAon | 2 | EventLogEn |
| 41 | BlkStopMrkEn | 1 | HtTunEn |
| 40 | MarcEn | **0** | **IommuEn** |
| 39 | PprAutoRspEn | | |
| 38:37 | PrivAbrtEn | | |
| 36:34 | DevTblSegEn | | |
| 33:32 | DualEventLogEn | | |
| 31:30 | DualPprLogEn | | |
| 29 | GAIntEn | | |
| 28 | GALogEn | | |
| 27:25 | GAMEn | | |

- **Claim.** The table above is the complete bit assignment of the IOMMU Control Register at MMIO offset 0018h; `IommuEn` is bit 0 and the Device Table Base Address Register must be configured before it is set.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `InvTimeOut[7:5]` selects the IOTLB invalidation time-out: 000b none, 001b 1 ms, 010b 10 ms, 011b 100 ms, 100b 1 s, 101b 10 s, 110b 100 s, 111b reserved.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `DevTblSegEn[36:34]` encodes 000b unsegmented, 001b two segments, 010b four, 011b eight, 100b–111b reserved, and must never exceed `EFR[DevTblSegSup]`.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `PrivAbrtEn[38:37]` is 00b "abort a user-privilege access to a guest supervisor page" and 01b "abort every access to a guest supervisor page regardless of the TLP PASID prefix PMR bit"; 10b and 11b are reserved and the field is reserved when `EFR[USSup]`=0.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `DualEventLogEn[33:32]` and `DualPprLogEn[31:30]` both encode 00b use buffer A, 01b use buffer B, 10b autoswap when the active buffer fills, 11b reserved; when auto-response is enabled (Control bit 39 or bit 42 set) the PPR field must not be programmed to 10b.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `NumIntRemapMode[44:43]` selects 00b = up to 512 remapped interrupts per function and 01b = up to 2048; the matching capability is `EFR2[NumIntRemapSup]` at bits 9:8.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `HADUpdate[47:46]` governs host page-table Accessed/Dirty updates and `GAUpdateDis`(54) / `GDUpdateDis`(48) separately disable hardware Accessed and Dirty updates in guest page tables.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `GCR3TRPMode`(58) switches the DTE's GCR3 table root pointer between a system physical address (0) and a guest physical address that the IOMMU must itself translate through the host page tables (1); support is `EFR2[GCR3TRPModeSup]` bit 3 — see `09-iommu-page-tables.md`.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `IRTCacheDis`(59) disables interrupt remapping table caching so software may edit entries without issuing invalidations, but setting it does not invalidate already-cached entries; its presence is detected by testing whether the bit is writable — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `Isoc`(11), `Coherent`(10), `ResPassPW`(9), `PassPW`(8) and `HtTunEn`(1) exist to drive the corresponding bits of a HyperTransport read request packet; `Coherent` resets to 1 and controls whether Device Table reads are snooped, and the per-device override is DTE[SD].  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`

### IOMMU Status Register, MMIO 2020h

| Bit | Field | Type | Bit | Field | Type |
|---|---|---|---|---|---|
| 18 | PprOvrflwEarly | RW1C | 8 | GALogRun | RO |
| 17 | PprOvrflwEarlyB | RW1C | 7 | PPRLogRun | RO |
| 16 | EventLogActive | RO | 6 | PprInt | RW1C |
| 15 | EventOvrflwB | RW1C | 5 | PprOverflow | RW1C |
| 14:13 | Reserved | — | **4** | **CmdBufRun** | **RO** |
| 12 | PprLogActive | RO | 3 | EventLogRun | RO |
| 11 | PprOvrflwB | RW1C | 2 | ComWaitInt | RW1C |
| 10 | GAInt | RW1C | 1 | EventLogInt | RW1C |
| 9 | GALOverflow | RW1C | 0 | EventOverflow | RW1C |

- **Claim.** The table above is the complete bit assignment of the IOMMU Status Register at MMIO offset 2020h; `CmdBufRun` is a **read-only bit 4 of this register**, and the control that starts or restarts command-buffer processing is `CmdBufEn`, bit 12 of the Control Register at 0018h — the two are different registers and must not be conflated.  `[IOMMU 3.11 §3.4.16]` `[7]` `C:high` `V:durable`
  > This is `errata.md` E01. `CmdBufRun` is level-sensitive: once 1 it stays 1 until command processing stops for cause, and once 0 it stays 0 until software writes `CmdBufEn`=1.
- **Claim.** `EventLogActive`(16) and `PprLogActive`(12) report which buffer of a dual-buffer pair is live (0 = A, 1 = B); when dual buffering is enabled, `EventOverflow`(0) and `PprOverflow`(5) become the A-buffer overflow indications and bits 15 and 11 the B-buffer ones.  `[IOMMU 3.11 §3.4.16]` `[7]` `C:high` `V:durable`
- **Claim.** An overflow bit latches logging off: while `EventOverflow`, `PprOverflow` or `GALOverflow` is set the IOMMU writes no new entries to that log even though the matching `…Run` bit still reads 1.  `[IOMMU 3.11 §3.4.16]` `[7]` `C:high` `V:durable`
- **Claim.** `GALOverflow` generates no interrupt when it goes from 0 to 1, and the guest vAPIC backing page is still updated while it is set, so the interrupt itself is not lost — only the log record is — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §3.4.16]` `[7]` `C:high` `V:durable`
- **Claim.** Restarting any halted log follows the same four steps: wait for the `…Run` bit to read 0, clear the matching `…En` bit in 0018h, reprogram base/head/tail as needed, write 1 to the overflow status bit to clear it (RW1C), then set the `…En` bit again.  `[IOMMU 3.11 §2.5.1]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU stops fetching commands after a `COMMAND_HARDWARE_ERROR` or an `ILLEGAL_COMMAND_ERROR`, and in that case the command head pointer does not advance past the offending entry — although it may already have advanced past it in the fetch pipeline.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`
- **Claim.** The three hardware event registers — Upper 0040h (`EventCode[63:60]` plus the first operand), Lower 0048h (the second operand) and Status 0050h (`HEV` bit 0 valid, `HEO` bit 1 overflow, both RW1C) — carry the same information as an event log entry and exist because some hardware errors make the log itself unwritable; they are reserved when `EFR[HESup]`=0.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`

## 8.4 Extended feature registers

### Extended Feature Register, MMIO 0030h

| Bits | Field | Bits | Field |
|---|---|---|---|
| 63 | SNPSup | 31 | SATSSup |
| 62 | ForcePhyDestSup | 30 | Reserved |
| 61 | V2HADDisSup | 29:28 | DualEventLogSup |
| 60:57 | Reserved | 27:26 | Reserved |
| 56 | VMGuardIOSup | 25:24 | DualPprLogSup |
| 55 | vIommuSup | 23:21 | GAMSup |
| 54 | InvIotlbTypeSup | 20:18 | SmiFRC |
| 53 | V2HDDisSup | 17:16 | SmiFSup |
| 52 | HDSup | 15:14 | GLXSup |
| 51 | AttrFWSup | 13:12 | GATS |
| 50 | EPHSup | 11:10 | HATS |
| 49 | HASup | 9 | PCSup |
| 48 | GIoSup | 8 | HESup |
| 47 | SnoopAttrSup | 7 | GASup |
| 46 | MsiCapMmioSup | 6 | IASup |
| 45 | PerfOptSup | 5 | GAPPISup |
| 44 | BlkStopMrkSup | 4 | GTSup |
| 43:42 | MarcSup | 3 | NXSup |
| 41 | PPRAutoRspSup | 2 | XTSup |
| 40 | PprOvrflwEarlySup | 1 | PPRSup |
| 39:38 | DevTblSegSup | 0 | PreFSup |
| 37 | USSup | | |
| 36:32 | PASmax[4:0] | | |

- **Claim.** The table above is the complete bit assignment of the Extended Feature Register at MMIO offset 0030h; the whole register is reserved when `Capability Offset 00h[EFRSup]`=0.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `HATS[11:10]` caps host translation depth at 00b = 4 levels, 01b = 5, 10b = 6, 11b reserved, and it bounds both DTE[Mode] and the NextLevel field of an I/O page directory entry; `GATS[13:12]` caps guest translation at 00b = 4 levels (PML4E), 01b = 5 levels (PML5E), 10b = 6 levels, 11b reserved.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `PASmax[36:32]` gives the widest PASID the IOMMU can handle internally as an encoded width, 00h = 1-bit through 13h = 20-bit with 14h–1Fh reserved, and is meaningless when `GTSup`=0; `GLXSup[15:14]` separately caps the depth of the GCR3 table at 00b one level, 01b two, 10b three, 11b reserved.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `DevTblSegSup[39:38]` reports 2^DevTblSegSup supported Device Table segments, so 00b means segmentation is unsupported and the Device Table Segment registers are reserved.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** `SmiFSup[17:16]` is 00b pass SMI through always, 01b filter under `Control[SmiFEn]` and the filter registers, 10b/11b reserved; `SmiFRC[20:18]` reports the implemented filter count as 000b = 1, 001b = 2, 010b = 4, 011b = 8, 100b = 16, 101b–111b reserved.  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- **Claim.** Each SMI filter register holds `SmiDID[15:0]`, `SmiDV`(16) and `SmiFLock`(17); once `SmiFLock` is written to 1 the whole register is read-only until a system reset, and an upstream SMI whose DeviceID matches no valid `SmiDID` is discarded and optionally logged under `Control[SmiFLogEn]`.  `[IOMMU 3.11 §3.4.3]` `[7]` `C:high` `V:durable`
- **Claim.** `GASup`(7) reports guest virtual APIC support and `GAMSup[23:21]` which modes exist (000b remapping only, 001b guest virtual APIC, 010b–111b reserved); on an SNP-enabled system these are replaced by `EFR2[SNPAVICSup]` and `Control[SNPAVICEn]` — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.12.3]` `[7]` `C:high` `V:durable`
- **Claim.** `NpCache` in the PCI capability header, not the EFR, is what tells software whether not-present entries are cached; AMD states that for hardware implementations of the IOMMU this bit must be 0.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`

### Extended Feature 2 Register, MMIO 01A0h

| Bits | Field |
|---|---|
| 63:17 | Reserved |
| 16 | SmeTioSupDis |
| 15:14 | XteeSup |
| 13 | SnpPageMode0Sup |
| 12 | HpteRsvdBitsMode |
| 11 | HTRangeIgnore |
| 10 | Reserved |
| 9:8 | NumIntRemapSup |
| 7:5 | SNPAVICSup |
| 4 | GAPPIDisSup |
| 3 | GCR3TRPModeSup |
| 2 | TMPMSup |
| 1 | SevSnpIoSup |
| 0 | Reserved |

- **Claim.** The table above is the complete bit assignment of the Extended Feature 2 Register at MMIO offset 01A0h, which like the EFR is reserved when `Capability Offset 00h[EFRSup]`=0.  `[IOMMU 3.11 §3.4.13]` `[7]` `C:high` `V:durable`
- **Claim.** `TMPMSup`(2) reports Tiered Memory Page Migration support, and when `Control[TMPMEn]`=1 host page-table entry bits 58:57 stop being reserved and become the Page Migration State field — see `09-iommu-page-tables.md`.  `[IOMMU 3.11 §3.4.13]` `[7][290]` `C:high` `V:durable`
- **Claim.** `SevSnpIoSup`(1) and `VMGuardIOSup` (EFR bit 56) both read as "SEV-TIO supported by hardware", and `XteeSup[15:14]` reports how much extended-TEE coverage exists: 00b requires sATS=1 for trusted device interfaces, 01b adds ATS and pre-translated requests, 10b untranslated only, 11b all three.  `[IOMMU 3.11 §3.4.13]` `[7]` `C:high` `V:durable`
- **Claim.** An IVHD block of type 11h or 40h carries verbatim copies of both registers — the EFR image at block offset 24 and the EFR2 image at offset 32 — and AMD tells system software to prefer those images over reading the hardware registers; see `09-iommu-page-tables.md`.  `[IOMMU 3.11 Table 96]` `[IOMMU 3.11 §5.2]` `[7]` `C:high` `V:durable`

## 8.5 The PCI capability block

- **Claim.** The IOMMU capability block is a PCI capability with `CapID` = 0Fh (Secure Device), `CapType` = 011b and `CapRev` = 0_0001b, occupying bits 7:0, 18:16 and 23:19 of the header at Capability Offset 00h.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** The capability header also carries `IotlbSup`(24), `HtTunnel`(25), `NpCache`(26), `EFRSup`(27) and `CapExt`(28), where `CapExt`=1 is what makes Capability Offset 14h meaningful.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** Capability Offset 04h holds `BaseAddress[31:14]` plus an `Enable` bit 0 that is RW1S; writing `Enable`=1 locks **every** RW register in the base capability block until the next system reset, and the base address may be changed by the same write that sets it.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** Capability Offset 08h supplies `BaseAddress[63:32]`, so the IOMMU register window may live above 4 Gbytes.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** Capability Offset 0Ch (the Range register) reports `UnitID[4:0]`, `RngValid`(7), `BusNumber[15:8]`, `FirstDevice[23:16]` and `LastDevice[31:24]`; AMD marks `UnitID` deprecated and encourages software to use the ACPI I/O topology instead of this register even when `RngValid`=1.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** Capability Offset 10h reports `MsiNum[4:0]`, `HtAtsResv`(22), `GVAsize[7:5]` (010b = 48 bits, 011b = 57 bits, all others reserved), `PAsize[14:8]` (40, 48 or 52 bits) and `VAsize[21:15]` (32, 40, 48 or 64 bits), and `MsiNumPPR[31:27]`.  `[IOMMU 3.11 §3.2]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU raises at most three interrupt sources, vectored independently: `Capability Offset 10h[MsiNum]` for event-log and completion-wait, `10h[MsiNumPPR]` for the PPR log and `14h[MsiNumGA]` for the guest vAPIC log; none of them is remapped by the IOMMU itself, MSI and MSI-X are mutually exclusive, and a PPR interrupt with neither enabled is silently dropped.  `[IOMMU 3.11 §3.1]` `[7]` `C:high` `V:durable`
- **Claim.** A second, vendor-specific capability block with `CapID` = 09h and `CapType` = 01h carries the vIOMMU resources: `VF_BaseAddress` at vendor offsets 08h/0Ch for the 256-Mbyte-aligned Virtual Function MMIO region, and `VFCntl_BaseAddress` at 10h/14h for the 4-Mbyte-aligned Virtual Function Control region, each with its own RW1S enable.  `[IOMMU 3.11 §3.3]` `[7]` `C:high` `V:durable`
- **Claim.** Hardware-accelerated vIOMMU maps each guest's IOMMU MMIO offsets 2000h–2FFFh — the pointer and status registers — onto one aligned 4-Kbyte slice of the VFMMIO region indexed by the guest's 16-bit GuestID; **every other guest MMIO offset is not handled by hardware and must still be emulated** by the hypervisor.  `[IOMMU 3.11 §2.10.2]` `[7]` `C:high` `V:durable`
- **Claim.** When vIOMMU is enabled the IOMMU's own DTE must be programmed V=1, TV=1, GV=0, Mode=100b, and host software must also enable the guest virtual APIC feature (`Control[GAEn]`=1).  `[IOMMU 3.11 §2.10.1]` `[7]` `C:high` `V:durable`

## 8.6 The Device Table Entry

- **Claim.** The Device Table is an array of **256-bit entries indexed directly by the 16-bit DeviceID**, so a fully populated table is 65,536 entries and 2 Mbytes; it must be 4-Kbyte aligned and a multiple of 4 Kbytes long.  `[IOMMU 3.11 §2.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU reads a Device Table entry in a single 256-bit transaction; AMD notes that earlier revisions allowed two 128-bit reads but that **no version of IOMMU hardware ever implemented that option**.  `[IOMMU 3.11 §2.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** A DeviceID beyond the end of the Device Table is denied I/O permission and target-aborted, and the attempt is logged; PRI requests are the exception — they are not validated against the Device Table, so software must validate the DeviceID itself during PPR processing.  `[IOMMU 3.11 §2.2.2]` `[7]` `C:high` `V:durable`

| Bits | Field | Bits | Field |
|---|---|---|---|
| 255:248 | SnoopAttribute | 105:104 | SysMgt |
| 247 | Mode0FC | 103 | EX |
| 246 | AttrV | 102 | SD |
| 245 | Reserved | 101 | Cache |
| 244:240 | Reserved | 100:99 | IoCtl |
| 239:224 | GuestID[15:0] | 98 | SA |
| 223:208 | GDeviceID[15:0] | 97 | SE |
| 207 | vImuEn | 96 | I |
| 206:192 | Reserved | 95:80 | GCR3 Table Root Pointer[30:15] |
| 191 | Lint1Pass | 79:64 | **DomainID[15:0]** |
| 190 | Lint0Pass | 63 | Reserved |
| 189:188 | IntCtl | 62 | IW |
| 187 | HPTMode | 61 | IR |
| 186 | NMIPass | 60:58 | GCR3 Table Root Pointer[14:12] |
| 185 | EIntPass | 57:56 | GLX |
| 184 | InitPass | 55 | GV |
| 183:182 | GuestPagingMode | 54 | GIoV |
| 181:180 | Reserved | 53 | GPRP |
| 179:134 | Interrupt Table Root Pointer[51:6] | 52 | PPR |
| 133 | IG | 51:12 | **Host Page Table Root Pointer[51:12]** |
| 132:129 | IntTabLen | 11:9 | **Mode[2:0]** |
| 128 | IV | 8:7 | HAD |
| 127:107 | GCR3 Table Root Pointer[51:31] | 6:4 | CXLMemAttr |
| 106 | SATS | 3:2 | Reserved |
| | | 1 | TV |
| | | 0 | V |

- **Claim.** The table above is the complete 256-bit Device Table Entry layout of Figure 7 and Table 7.  `[IOMMU 3.11 Figure 7]` `[7]` `C:high` `V:durable`
- **Claim.** `Mode[11:9]` gives the depth of the host page tables and therefore the reachable GPA width: 000b translation disabled (SPA = GPA, access still gated by IR/IW), 001b 1 level / 21-bit, 010b 2 / 30-bit, 011b 3 / 39-bit, 100b 4 / 48-bit, 101b 5 / 57-bit, 110b 6 / 64-bit, 111b reserved and reported as an event when V=1 and TV=1.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `V`(0) validates bits [127:1] of the entry and `TV`(1) validates the translation fields specifically — IW, IR, the page table root pointer, Mode and GV; when V=0 every address from that device is forwarded untranslated and all other control fields are ignored, and the interrupt half of the entry is governed separately by `IV`(128).  `[IOMMU 3.11 Table 8]` `[7]` `C:high` `V:durable`
- **Claim.** With V=1 and TV=0 the SysMgt, EX, SD, Cache, IoCtl, SA, SE and I fields are still valid and the DomainID is still used for event-log entries, but any required table walk is terminated and Mode and the page table root pointer are ignored.  `[IOMMU 3.11 Table 8]` `[7]` `C:high` `V:durable`
- **Claim.** `DomainID[79:64]` is the 16-bit software-chosen tag that the IOMMU stamps on its internal translation caches and on event log entries; devices sharing a DomainID must have identical `Mode` and page table root pointer values or IOMMU behaviour is undefined, though they may differ in `I` and `SysMgt`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** The DomainID recorded in an event log entry is undefined when V=0 and IV=1, and software is told to give devices with `GIoV`=1 unique DomainIDs.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `IoCtl[100:99]` routes port-I/O-space transactions: 00b target-abort, 01b forward untranslated (translation requests still target-aborted), 10b translate through the page tables as memory, 11b reserved and reported as an event when V=1.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `SysMgt[105:104]` routes system-management-range DMA: 00b target-abort everything, 01b forward system management messages including INTx untranslated, 10b forward INTx only, 11b translate through the page tables; in the first three encodings upstream reads, non-posted writes and translation requests are all target-aborted.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `SA`(98) suppresses event logging for **all** `IO_PAGE_FAULT` events from the device, while `SE`(97) suppresses only repeats after the first fault for as long as the DeviceID stays in the IOMMU cache; neither affects events logged for interrupts or for command processing, both are ignored when V=0, and `SmiFLogEn` governs SMI-filter faults independently.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `I`(96) is the IOTLB enable: 0 makes the IOMMU target-abort address translation requests from the peripheral, 1 makes it answer them; the bit does not affect interrupts, and setting I=1 when `Capability Offset 00h[IotlbSup]`=0 has undefined results.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `EX`(103) exempts the device's accesses to the IOMMU exclusion range from translation and access checks, `SD`(102) stops page-walk transactions for the device being snooped, and `Cache`(101) is a hint that the IOMMU should not cache GPA-to-SPA information obtained for ATS requests — AMD recommends Cache=0 for peripherals that have an IOTLB.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** The GCR3 table root pointer is **stored in three discontiguous slices** — bits 127:107 hold GCR3 TRP[51:31], bits 95:80 hold [30:15] and bits 60:58 hold [14:12] — and the whole pointer is used only when V=1, TV=1 and GV=1; see `09-iommu-page-tables.md`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `GLX[57:56]` selects a one-, two- or three-level GCR3 table (00b/01b/10b, 11b reserved) and is ignored when GV=0; AMD's guidance is GLX=00b for PASIDs up to 9 bits, 01b for 10–18 bits and 10b for 19–20 bits.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `GuestPagingMode[183:182]` sets the guest page-table start level — 00b level 4 (PML4E), 01b level 5 (PML5E), 10b and 11b reserved — is ignored when GV=0 and must be zero when `EFR[GTSup]`=0.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `GIoV`(54) is Guest I/O Protection: with it set, requests arriving without a PASID are treated as PASID 0 so that guest translation applies to non-PASID devices; requests without a PASID in the 0FEEx_xxxxh range are still handled as MSI interrupts rather than translated.  `[IOMMU 3.11 §2.2.9]` `[7]` `C:high` `V:durable`
- **Claim.** `HAD[8:7]` controls host page-table Accessed/Dirty updates — 00b none, 01b Accessed only, 10b reserved, 11b Accessed and Dirty (reserved when `EFR[HDSup]`=0) — and is only meaningful when V=1, TV=1 and `EFR[HASup]`=1.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `SATS`(106) makes the IOMMU process the device's ATS requests as *secure* ATS: it walks the page tables as usual but returns the intermediate guest physical address rather than the final system physical address, and then translates GPA to SPA in line on the resulting pre-translated DMA.  `[IOMMU 3.11 §2.11]` `[7]` `C:high` `V:durable`
- **Claim.** On an SNP-enabled system software must set DTE[V]=1 for every device — DMA from a device with V=0 is aborted with `ILLEGAL_DEV_TABLE_ENTRY` — and if `EFR2[SnpPageMode0Sup]`=0 then DTE[Mode]=0 and DTE[SATS]=0 are both unsupported; DTE[SATS]=1 together with DTE[Mode]=0 is always an `ILLEGAL_DEV_TABLE_ENTRY`.  `[IOMMU 3.11 §2.12.2.4]` `[7]` `C:high` `V:durable`
- **Claim.** `vImuEn`(207), `GuestID[239:224]` and `GDeviceID[223:208]` are the vIOMMU cluster: all devices assigned to one VM must carry the same GuestID and the same vImuEn setting, and all three fields are meaningful only when V=1, TV=1, GV=1 and `Control[vIommuEn]`=1.  `[IOMMU 3.11 §2.10]` `[7]` `C:high` `V:durable`
- **Claim.** `AttrV`(246), `Mode0FC`(247) and `SnoopAttribute[255:248]` override the No-snoop attribute of a guest ATS response: a 3-bit index built from the guest PTE's {PAT, PCD, PWT} selects one bit of SnoopAttribute, and if that bit is 1 the response's N field is set to 1, otherwise the PTE's FC bit decides.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** In SEV-TIO mode a long list of DTE fields is reserved in the *non-secure* DTE, while IW, IR, I and PPR are instead ANDed with the corresponding bit the AMD Secure Processor maintains for the TDISP device.  `[IOMMU 3.11 §2.14.1]` `[7][12]` `C:medium` `V:durable`

### Changing a Device Table entry safely

- **Claim.** The interrupt half of a DTE may be changed with one 64-bit write, and the translation half with one 128-bit write; either change must be followed by `INVALIDATE_DEVTAB_ENTRY` whenever IV=1 or V=1 held before the change — see `09-iommu-page-tables.md`.  `[IOMMU 3.11 §2.2.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** When an atomic write is impossible and V=0 beforehand, the fields may be written in any order provided the last write is the one that sets V=1; when V=1 beforehand, IW and IR must be written before or with the change to Mode, and TV and V must be in the final write.  `[IOMMU 3.11 §2.2.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** `INVALIDATE_DEVTAB_ENTRY` does not invalidate translation-cache entries, so removing a device from a domain also requires `INVALIDATE_IOMMU_PAGES` for that DomainID — AMD explicitly retracts the older statement that this was unnecessary when other devices shared the DomainID.  `[IOMMU 3.11 §2.4.2]` `[7]` `C:high` `V:durable`

## 8.7 The segmented Device Table

Segmentation exists so the Device Table does not have to be one contiguous 2-Mbyte allocation when
the DeviceID space is sparse.

- **Claim.** Device Table segmentation splits the table into 2, 4 or 8 independently located pieces; `EFR[DevTblSegSup]` reports how many the hardware supports and `Control[DevTblSegEn]` how many are enabled, and when segmentation is off or unsupported the Device Table Base Address Register at 0000h describes the single unified table.  `[IOMMU 3.11 §2.2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** When segmentation is on, MMIO 0000h becomes the base register for segment 0 and seven further registers at 0100h, 0108h, 0110h, 0118h, 0120h, 0128h and 0130h describe segments 1 through 7.  `[IOMMU 3.11 §3.4.6]` `[7]` `C:high` `V:durable`
- **Claim.** The segment base registers carry `DevTabBase[51:12]` and an 8-bit `Size[7:0]` giving (m+1) × 4 Kbytes, and the architectural maximum of that field differs per register: FFh (1 Mbyte) for segment 1, 7Fh (512 Kbytes) for segments 2 and 3, and 3Fh (256 Kbytes) for segments 4 through 7.  `[IOMMU 3.11 Table 81]` `[7]` `C:high` `V:durable`
- **Claim.** The most significant 1, 2 or 3 bits of the DeviceID select the segment — DeviceID[15] for two segments, [15:14] for four, [15:13] for eight — and the remaining low bits index inside it.  `[IOMMU 3.11 §2.2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** Full coverage of the DeviceID space requires 1 Mbyte per segment with two segments, 512 Kbytes with four and 256 Kbytes with eight; segments may be shortened in 4-Kbyte steps if the space is sparse, but the first entry of segment m always corresponds to DeviceID = m × (65536 / n) for n segments.  `[IOMMU 3.11 §2.2.2.3]` `[7]` `C:high` `V:durable`

## 8.8 Log entry formats: event, PPR and GA

Three logs, three shapes. The event log and the PPR log are circular buffers of 16-byte records; the
guest vAPIC log is a circular buffer of 8-byte records. All three are written by the IOMMU and read
by software, all three signal through the Status register, and all three stop dead on overflow.

### The event log

- **Claim.** Every event record is a 4-bit `EventCode` at bits 31:28 of dword +04, plus a 60-bit first operand (dword +00 and bits 27:0 of +04) and a 64-bit second operand (dwords +08 and +12) — 128 bits, 16 bytes.  `[IOMMU 3.11 Figure 54]` `[7]` `C:high` `V:durable`

| EventCode | Event | §  |
|---|---|---|
| 0001b | `ILLEGAL_DEV_TABLE_ENTRY` | 2.5.2 |
| 0010b | `IO_PAGE_FAULT` | 2.5.3 |
| 0011b | `DEV_TAB_HARDWARE_ERROR` | 2.5.4 |
| 0100b | `PAGE_TAB_HARDWARE_ERROR` | 2.5.5 |
| 0101b | `ILLEGAL_COMMAND_ERROR` | 2.5.6 |
| 0110b | `COMMAND_HARDWARE_ERROR` | 2.5.7 |
| 0111b | `IOTLB_INV_TIMEOUT` | 2.5.8 |
| 1000b | `INVALID_DEVICE_REQUEST` | 2.5.9 |
| 1001b | `INVALID_PPR_REQUEST` | 2.5.10 |
| 1010b | `EVENT_COUNTER_ZERO` | 2.5.11 |
| 1011b | `GUEST_EVENT_FAULT` | 2.5.12 |
| 1100b | `VIOMMU_HARDWARE_ERROR` | 2.5.13 |
| 1101b | `RMP_PAGE_FAULT` | 2.5.14 |
| 1110b | `RMP_HARDWARE_ERROR` | 2.5.15 |

- **Claim.** Rev 3.11 defines **fourteen** event codes, 0001b through 1110b, as listed above; code 0000b and 1111b are not assigned.  `[IOMMU 3.11 §2.5]` `[7]` `C:high` `V:durable`
- **Claim.** Table 42, the summary table in §2.5, is **stale relative to the sections it summarises**: it prints 1001b for both `INVALID_PPR_REQUEST` and `EVENT_COUNTER_ZERO` and declares 1010b–1111b reserved, while §2.5.11–§2.5.15 assign 1010b–1110b. Decode from the per-event figures, not from Table 42.  `[IOMMU 3.11 Table 42]` `[7]` `C:high` `V:durable`
- **Claim.** Four bits are common to the top of almost every event record: `VCmd`(31), `VPpr`(30) and `VEvent`(29) of dword +00 say the event arose while processing a virtualized command buffer, PPR log or event log, and `VNR`(27) says the vIOMMU context is unrecoverable; all four are reserved and read 0 when vIOMMU is disabled.  `[IOMMU 3.11 §2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** The `IO_PAGE_FAULT` record (0010b) carries `DeviceID[15:0]` and `PASID[19:16]` in dword +00, the flag byte `TR`(24) `RZ`(23) `PE`(22) `RW`(21) `PR`(20) `I`(19) `US`(18) `NX`(17) `GN`(16) plus `D/P[15:0]` in dword +04, and the full 64-bit device virtual address in dwords +08 and +12.  `[IOMMU 3.11 Figure 56]` `[7]` `C:high` `V:durable`
- **Claim.** `D/P[15:0]` is overloaded: it is the DomainID from the Device Table entry when GN=0 (or when guest translation is unsupported), and the low 16 bits of the guest PASID when GN=1; where no valid DomainID or PASID exists the field reads zero.  `[IOMMU 3.11 Table 57]` `[7]` `C:high` `V:durable`
- **Claim.** The `ILLEGAL_DEV_TABLE_ENTRY` record (0001b) reuses the same header but a narrower flag set — `TR`(24), `RZ`(23), `RW`(21), `I`(19), `GN`(16) and `PASID[15:0]` — and its address field is the DVA the device was attempting to access, with bits 1:0 reserved.  `[IOMMU 3.11 Figure 55]` `[7]` `C:high` `V:durable`
- **Claim.** `RZ` distinguishes the two structural failure modes throughout: 1 means a non-zero reserved bit, 0 means an invalid level encoding.  `[IOMMU 3.11 Table 56]` `[7]` `C:high` `V:durable`
- **Claim.** In the hardware-error records the address field is **not** the address the device wanted: `DEV_TAB_HARDWARE_ERROR` reports the system physical address of the failed Device Table access, `PAGE_TAB_HARDWARE_ERROR` the address of the page table entry, `ILLEGAL_COMMAND_ERROR` and `COMMAND_HARDWARE_ERROR` the address of the command itself, and `IOTLB_INV_TIMEOUT` the address of the invalidation command that timed out.  `[IOMMU 3.11 §2.5.4]` `[7]` `C:high` `V:durable`
- **Claim.** The `Type` field carried by the hardware-error records encodes 00b invalid `COMPLETION_WAIT` store address on an SNP-enabled system, 01b Master Abort, 10b Target Abort, 11b Data Error.  `[IOMMU 3.11 Table 58]` `[7]` `C:high` `V:durable`
- **Claim.** The event log is *full* when all slots but one are used, and has *overflowed* when an event arrives that would consume the last free slot; the IOMMU then sets `Status[EventOverflow]` and discards the record.  `[IOMMU 3.11 §2.5]` `[7]` `C:high` `V:durable`

### The PPR log

- **Claim.** A PPR record has the same 16-byte shape as an event record with a 4-bit `PPRCode` in place of `EventCode`; the only code defined is 0001b, `PAGE_SERVICE_REQUEST`.  `[IOMMU 3.11 Figure 74]` `[7]` `C:high` `V:durable`
- **Claim.** The `PAGE_SERVICE_REQUEST` record carries `PASID[15:0]` and `DeviceID[15:0]` in dword +00; `GN`(24), `RZ`(23), `US`(22), `WP`(21), `RP`(18), `NX`(17), `PASID[19:16]` at bits 13:10 and `PPRtag[9:0]` in dword +04; and `Address[63:12]` in dwords +08 and +12 with bits 11:0 reserved.  `[IOMMU 3.11 Figure 75]` `[7]` `C:high` `V:durable`
- **Claim.** `PPRtag[9]` is the PCIe PRI L bit and `PPRtag[8:0]` the PRI Page Request Group index, and the IOMMU is required to return that index in the response message, which is why `COMPLETE_PPR_REQUEST` takes it back verbatim — see `09-iommu-page-tables.md`.  `[IOMMU 3.11 Table 75]` `[7][53]` `C:high` `V:durable`
- **Claim.** A malformed PCIe PRI request is logged in the PPR log with RZ=1 rather than being dropped, so that software may attempt recovery; when PPR processing is not enabled the same request instead produces an `INVALID_PPR_REQUEST` event.  `[IOMMU 3.11 §2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** The PPR record always carries a full independent read, write and execute permission set; any permission the underlying peripheral protocol cannot express is filled in by the IOMMU as "permitted".  `[IOMMU 3.11 §2.6.3]` `[7]` `C:high` `V:durable`

### The guest vAPIC log

- **Claim.** A guest vAPIC record is **8 bytes, not 16**: dword +00 is `GAInformation[31:0]` and dword +04 is `OpCode[31:28]` plus `DeviceID[15:0]`, with bits 27:16 reserved.  `[IOMMU 3.11 Figure 78]` `[7]` `C:high` `V:durable`
- **Claim.** The only defined GA record is `GA_GUEST_NR`, OpCode 0001b, whose +00 dword is the 32-bit `GATag` copied from the interrupt remapping table entry and whose +04 dword names the requesting DeviceID; the semantics of that tag and of the not-running condition belong to `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 Figure 79]` `[7]` `C:high` `V:durable`
- **Claim.** Because entries are 8 bytes, the GA log's head and tail are compared after shifting right by 3, and the log is full when `{(Head ≤ Tail) ? Tail : Tail + Max} − Head` equals `Max − 1` where `Max` is the log size shifted right by 3.  `[IOMMU 3.11 §2.7.1]` `[7]` `C:high` `V:durable`

## 8.9 Open items

Six places where Rev 3.11 contradicts itself or leaves a gap. None of them is resolvable from the
document alone; each is recorded rather than guessed.

1. **Table 42 versus §2.5.11–§2.5.15.** The event-type summary assigns `EVENT_COUNTER_ZERO` the code 1001b — already taken by `INVALID_PPR_REQUEST` — and marks 1010b–1111b reserved, while the individual sections assign 1010b through 1110b. §8.8 follows the per-event figures.
2. **`CXLMemAttrEn` and `CXLMemAttrSup` have no home.** DTE[6:4] is gated on `MMIO 0018h[CXLMemAttrEn]` and `MMIO 01A0h[CXLMemAttrSup]`, but neither name appears in the bit list of the Control Register in §3.4.1 or of EFR2 in §3.4.13. Their bit positions cannot be determined from this revision.
3. **Device Table Segment register bit 8.** The field list for MMIO 01[00-30]h prints "11:9 Reserved" and "7:0 Size", leaving bit 8 unaccounted for; the figure shows the reserved gap running down to bit 8. Treat bit 8 as reserved.
4. **`RMP_HARDWARE_ERROR` is labelled with the wrong name.** Its own figure carries EventCode 1110b but the field description reads "1110b. Specifies an RMP_PAGE_FAULT entry", and its `Type` field defines 00b as Reserved where Table 58 defines 00b as the SNP completion-store violation.
5. **`AttrFWSup` points at a section number that does not exist.** EFR bit 51 refers to "Section 2.2.7.11 Extended Coherency Attributes"; the bookmark tree and the body both place Extended Coherency Attributes at §2.2.7.10.
6. **`PprBLen` and `PPRLogLen` disagree about what 1000b means.** The PPR Log Base register at 0038h documents 1000b as 256 entries / 4 Kbytes rising to 1111b = 32768 entries, which is right for 16-byte records; the PPR Log B Base register at 00F0h documents the same field as 1000b = 512 entries / 4 Kbytes rising to 1100b = 8192 entries with 1101b–1111b reserved — the guest-vAPIC log's table, which is right for 8-byte records. §8.2 follows the 0038h table for PPR and does not state an encoding for `PprBLen`.
7. **The Zen client data path is not documented at bit level in any public AMD specification.** IOMMU 48882 describes topologies generically; the per-SoC placement, the number of IOMMU instances and their DeviceID ranges are platform facts that must be read from the IVRS at runtime — see `09-iommu-page-tables.md` §9.5. No public Processor Programming Reference exists for client Ryzen parts, so this gap is structural, not an oversight.

### Linux-only contrast

Everything above is what the hardware does; what a particular OS *names* it is not architecture. On
Linux the same registers are reached through `drivers/iommu/amd/`, whose `amd_iommu_types.h`
mirrors this register map and whose `init.c` parses the IVRS. Two Linux-side notions have no
architectural counterpart and are frequently mistaken for one:

- **Claim.** "IOMMU groups" are a Linux/VFIO kernel construct describing the smallest set of devices that can be isolated from one another; the IOMMU specification defines DomainID, DeviceID and the Device Table, and contains no concept of a group.  `[IOMMU 3.11 §2.2.2]` `[7][270]` `C:high` `V:durable`
- **Claim.** The `AMD-Vi: Event logged [IO_PAGE_FAULT device=… domain=… address=… flags=…]` line familiar from `dmesg` is the Linux driver's rendering of the 16-byte record in §8.8, not a hardware format; the `flags` value is bits 31:16 of dword +04 of that record.  `[IOMMU 3.11 Figure 56]` `[7][270]` `C:medium` `V:durable`

Windows-side consumers of the IOMMU — Kernel DMA Protection, device assignment, and what VBS
requires of it — are in `16-windows-platform.md`.
