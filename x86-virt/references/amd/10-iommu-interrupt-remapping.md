# 10. AMD-Vi: Interrupt Remapping and Address Translation Services

> **中文速览**：本章自足：两种 IRTE 格式（legacy 32 位与 128 位 guest-vAPIC 格式）、device table entry 里的中断簇（`IntCtl`、`IV`、`IntTabLen` 的 `2^n` 编码、中断表根指针与五个 Pass 位）、`INVALIDATE_INTERRUPT_TABLE`、GA log 的**语义**（条目格式在 `08`）、GAPPI，以及 ATS/PRI/PASID。要配 MSI 重映射或排查直通设备中断的读者不必跳到别的文件。AVIC 的 CPU 侧接口在 `07-virtual-interrupts-avic.md`；IOMMU 寄存器、事件日志与 PPR 日志的条目格式在 `08-iommu-architecture.md`；页表、命令与 IVRS 在 `09-iommu-page-tables.md`。**IRTE 的第 0 位叫 `RemapEn`**——旧资料里那个拼法是讹传，见 `errata.md` E03。

**Maps to:** IOMMU 48882-PUB Rev 3.11 §2.2.5 "Interrupt Remapping Tables" (§2.2.5.1–§2.2.5.4) + §2.2.8 + §2.3.2 + §2.4.5 + §2.7; adjacent: §2.10 vIOMMU, §2.11 Secure ATS, §2.12.3, §2.14.6 [7]
**Owns:** all three IRTE formats · the device-table interrupt cluster · **GA log semantics** (the entry format is owned by `08-iommu-architecture.md`) · GAPPI · ATS, PRI and PASID
**Scope:** OS-independent hardware. SR-IOV content is marked server scope. Windows-side gating (Kernel DMA Protection, DDA, GPU-P) belongs to `16-windows-platform.md`; Linux/VFIO appears only as a labelled contrast in §10.6.
**See also:** `07-virtual-interrupts-avic.md` (AVIC on the CPU side) · `08-iommu-architecture.md` (MMIO registers, the translation-side device-table fields, event and PPR log entry formats) · `09-iommu-page-tables.md` (commands, IVRS) · `errata.md`

---

## 10.1 The legacy interrupt remapping table entry

An upstream fixed or arbitrated interrupt is a posted write to the interrupt address range, not a
memory transaction, so it is steered by the interrupt-remapping path and never by the I/O page
tables. The entry that steers it is the interrupt remapping table entry (IRTE), indexed out of a
per-device table whose root pointer and length live in the device table entry (§10.3).

The specification defines three IRTE layouts, and which one hardware reads is a property of the
IOMMU's mode, not of the entry: a 32-bit basic entry, and two 128-bit entries selected by
`IRTE[GuestMode]`. This section covers the basic one; §10.2 covers the other two.

- **Claim.** The basic IRTE is 32 bits wide and is the only format supported when the IOMMU does not implement the guest virtual APIC feature (`MMIO Offset 0030h[GASup]=0`) or when that feature is not enabled (`MMIO Offset 0018h[GAEn]=0`).  `[IOMMU 3.11 Table 21]` `[7]` `C:high` `V:durable`

| Bits | Field | Meaning |
|---|---|---|
| 31:24 | Reserved | — |
| 23:16 | `Vector` | the interrupt vector for the interrupt |
| 15:8 | `Destination` | the APIC logical or physical address to send the interrupt to |
| 7 | `GuestMode` | must be zero in this format |
| 6 | `DM` | destination mode: 1 = logical, 0 = physical |
| 5 | `RqEoi` | 1 = an EOI cycle is required |
| 4:2 | `IntType` | 000b = Fixed, 001b = Arbitrated, 010b–111b = reserved |
| 1 | `SupIOPF` | 1 = suppress the `IO_PAGE_FAULT` log entry this IRTE would cause |
| 0 | `RemapEn` | 1 = the interrupt is remapped, 0 = the interrupt is target aborted |

- **Claim.** Those are the exact field boundaries of the basic IRTE — `Vector` 23:16, `Destination` 15:8, `GuestMode` 7, `DM` 6, `RqEoi` 5, `IntType` 4:2, `SupIOPF` 1, `RemapEn` 0, with 31:24 reserved.  `[IOMMU 3.11 Table 20]` `[7]` `C:high` `V:durable`
- **Claim.** The field at bit 0 is spelled **`RemapEn`**; the misspelling that circulates in secondary material appears nowhere in the specification, which uses `RemapEn` in every one of the three IRTE tables.  `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`
- **Claim.** `SupIOPF` is meaningful independently of `RemapEn`, so an entry that blocks an interrupt can still be configured to log or not log the resulting fault.  `[IOMMU 3.11 Table 20]` `[7]` `C:high` `V:durable`
- **Claim.** `RqEoi=1` obliges software to perform the reverse mapping of the vector number itself; the IOMMU does not do it.  `[IOMMU 3.11 Table 20]` `[7]` `C:high` `V:durable`
- **Claim.** Interrupt remapping table walks are always coherent.  `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`

## 10.2 The 128-bit guest vAPIC entry

When the IOMMU supports the guest virtual APIC (`MMIO Offset 0030h[GASup]=1`) and software
enables it, the entry widens to 128 bits and splits in two: `GuestMode=0` entries are still
ordinary remapping entries, just in the wide layout, and `GuestMode=1` entries post the interrupt
into a guest's virtual APIC instead of delivering it to a physical local APIC.

- **Claim.** Software must program every IOMMU in a system to use the same IRTE size, which means the same values of `MMIO Offset 0018h[GAEn]` and `MMIO Offset 0018h[GAMEn]` on all of them.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** The 128-bit formats are selected by `GASup`/`GAMSup` in `MMIO Offset 0030h` together with `GAEn`/`GAMEn` in `MMIO Offset 0018h`: `GASup=1` with `GAMSup=000b` and `GAEn=1` gives the wide remapping entry, and `GASup=1` with `GAMSup=001b`, `GAEn=1` and `GAMEn=001b` additionally gives the virtualized entry.  `[IOMMU 3.11 Table 21]` `[7]` `C:high` `V:durable`

### The wide remapping entry, `GuestMode=0`

| Bits | Field |
|---|---|
| 127:72 | Reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| 71:64 | `Vector` |
| 63:16 | Reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| 15:8 | `Destination` |
| 7 | `GuestMode` — must be zero in this format |
| 6 | `DM` |
| 5 | `RqEoi` |
| 4:2 | `IntType` |
| 1 | `SupIOPF` |
| 0 | `RemapEn` |

- **Claim.** In the `GuestMode=0` 128-bit entry `Vector` moves to bits 71:64 while `Destination` stays at 15:8 and the control bits 7:0 keep the meanings they have in the basic entry; bits 127:72 and 63:16 are reserved when `RemapEn=1` and ignored when `RemapEn=0`.  `[IOMMU 3.11 Table 22]` `[7]` `C:high` `V:durable`

### The virtualized entry, `GuestMode=1`

| Bits | Field | Meaning |
|---|---|---|
| 127:116 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| 115:76 | `Guest Virtual APIC Table Root Pointer` | the system physical address of the APIC backing page when `RemapEn=1` |
| 75:72 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| 71:64 | `Vector` | used to compute the address inside the backing page |
| 63:32 | `GATag[31:0]` | written verbatim into the GA log entry (§10.5) |
| 31:16 | Reserved | — |
| 15:8 | `Destination[7:0]` | destination core for the guest virtual APIC doorbell message |
| 7 | `GuestMode` | must be 1 in this format |
| 6 | `IsRun` | 1 = the guest is running and can take the interrupt; 0 = log it instead |
| 5 | `GAPPIDis` | 1 = suppress the GAPPI notification but keep updating the IRR |
| 4:3 | Reserved | — |
| 2 | `GALogIntr` | 1 = write a GA log entry when `IsRun=0`; 0 = suppress it |
| 1 | `SupIOPF` | not governed by `RemapEn` |
| 0 | `RemapEn` | validity of every other field |

- **Claim.** Those are the exact field boundaries of the `GuestMode=1` IRTE: root pointer 115:76, `Vector` 71:64, `GATag` 63:32, `Destination[7:0]` 15:8, `GuestMode` 7, `IsRun` 6, `GAPPIDis` 5, reserved 4:3, `GALogIntr` 2, `SupIOPF` 1, `RemapEn` 0.  `[IOMMU 3.11 Table 23]` `[7]` `C:high` `V:durable`
- **Claim.** In this format `RemapEn=0` makes hardware ignore the whole entry except `SupIOPF`, and an interrupt that lands on it raises an `IO_PAGE_FAULT` rather than being silently dropped.  `[IOMMU 3.11 Table 23]` `[7]` `C:high` `V:durable`
- **Claim.** `GAPPIDis` is meaningful only when `GuestMode=1` and `MMIO Offset 0018h[GAPPIEn]=1`, and is reserved when `MMIO Offset 01A0h[GAPPIDisSup]=0`.  `[IOMMU 3.11 Table 23]` `[7]` `C:high` `V:durable`

### x2APIC mode widens `Destination` to 32 bits

- **Claim.** When `MMIO 0x30[XTSup]=1` software sets `MMIO 0x18[XTEn]=1` and `MMIO 0x18[GAEn]=1`, which enables a 128-bit IRTE carrying a 32-bit destination; `GAEn` must be set even when the guest virtual APIC will not be used, in which case every IRTE should carry `GuestMode=0`.  `[IOMMU 3.11 §2.2.5.3]` `[7]` `C:high` `V:durable`
- **Claim.** In that layout the destination is split — `Destination[31:24]` at IRTE bits 127:120 and `Destination[23:0]` at bits 31:8 — and `Destination[31:8]` is reserved and must be zero when `MMIO 0x30[XTSup]=0` or `MMIO 0x18[XTEn]=0`.  `[IOMMU 3.11 Figure 20]` `[7]` `C:high` `V:durable`
- **Claim.** When `MMIO 0x18[IntCapXTEn]=1`, interrupts originating from the IOMMU itself are sent according to the XT IOMMU Interrupt Control Registers at `MMIO 0x170`–`0x180` instead of the IOMMU's own MSI capability registers.  `[IOMMU 3.11 §2.2.5.3]` `[7]` `C:high` `V:durable`

### Which fields are cached, and how to change an entry

- **Claim.** With `GAEn=1` and `GuestMode=1` the IOMMU does not cache `IsRun`, `Destination`, `GALogIntr`, `GAPPIDis` or `GATag`, so changing any of them needs no invalidation.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** To change guest interrupt virtualization information: if `RemapEn` was 0, the changes may be made in any order provided the last one sets `RemapEn=1`; if `RemapEn` was already 1, update the entry atomically and then invalidate the interrupt remapping table if any cacheable field changed.  `[IOMMU 3.11 §2.3.2]` `[7]` `C:high` `V:durable`

### SEV-SNP and SEV-TIO change the enable, not the layout

- **Claim.** On an SNP-enabled system guest virtual APIC support is reported by `MMIO Offset 01A0h[SNPAVICSup]` instead of `MMIO Offset 0030h[GAMSup]`, and is enabled by `MMIO Offset 0018h[SNPAVICEn]` instead of `MMIO Offset 0018h[GAMEn]`.  `[IOMMU 3.11 §2.12.3]` `[7]` `C:high` `V:durable`
- **Claim.** With SNP enabled, interrupt virtualization is restricted to devices managed by the hypervisor or assigned to non-SNP guests; interrupts from devices mapped to an SNP guest must be remapped through the interrupt remapping table and delivered via the hypervisor.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** A VMM may still reach an SNP guest by creating a VMM-managed vAPIC backing page and programming those devices with `GuestMode=1` and `IsRun=0`, which AMD documents as a way to cope with a shortage of physical-APIC IRR bits on systems with many device vectors.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** MSI and MSI-X interrupts from a TDISP device may be secure (`T=1`) or non-secure (`T=0`), and all of them are delivered to the hypervisor, which is responsible for injecting them into the guest.  `[IOMMU 3.11 §2.14.6]` `[7]` `C:high` `V:durable`

## 10.3 The DTE interrupt cluster

Bits 191:128 of the 256-bit device table entry are the interrupt half. They are independent of the
translation half: interrupt remapping and address translation may be enabled and operated
separately for the same device.

| Bits | Field | Meaning |
|---|---|---|
| 191 | `Lint1Pass` | LINT1 (legacy PIC NMI) pass-through |
| 190 | `Lint0Pass` | LINT0 (legacy PIC ExtInt) pass-through |
| 189:188 | `IntCtl` | how fixed and arbitrated interrupts are handled |
| 187 | `HPTMode` | host page table mode hint (a translation-side hint, reserved when `SATSSup=0`) |
| 186 | `NMIPass` | NMI pass-through |
| 185 | `EIntPass` | ExtInt pass-through |
| 184 | `InitPass` | INIT pass-through |
| 183:182 | `GuestPagingMode` | translation-side; start level of the guest page table |
| 181:180 | Reserved | — |
| 179:134 | `Interrupt Table Root Pointer[51:6]` | SPA of the interrupt remapping table, 128-byte aligned |
| 133 | `IG` | ignore unmapped interrupts: suppress `IO_PAGE_FAULT` logging for interrupts |
| 132:129 | `IntTabLen` | table length, `2^IntTabLen` entries |
| 128 | `IV` | interrupt map valid |

- **Claim.** Those are the exact bit positions of the interrupt cluster in the device table entry — `Lint1Pass` 191, `Lint0Pass` 190, `IntCtl` 189:188, `NMIPass` 186, `EIntPass` 185, `InitPass` 184, interrupt table root pointer 179:134, `IG` 133, `IntTabLen` 132:129, `IV` 128; the translation-side fields interleaved with them (`HPTMode` 187, `GuestPagingMode` 183:182) belong to `08-iommu-architecture.md`.  `[IOMMU 3.11 Figure 7]` `[7]` `C:high` `V:durable`
- **Claim.** `IntTabLen` encodes the number of entries as a power of two — 0000b = 1 entry, 0001b = 2, 0010b = 4, 0011b = 8, up to 1010b = 1024 and 1011b = 2048 entries — and 11xxb is reserved and reported as an event when `IV=1`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** The interrupt remapping table must start on a 128-byte boundary, and its root pointer is used only when `IntCtl=10b`; otherwise it is ignored.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** `IntCtl` encodes 00b = fixed and arbitrated interrupts target aborted, 01b = forwarded unmapped, 10b = remapped, 11b = reserved, and 11b is reported as an event when `IV=1`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** With `IV=0` all interrupts are forwarded without remapping; with `IV=1` the four `IntCtl` encodings give target abort, forward unmapped, remap, and undefined behaviour respectively.  `[IOMMU 3.11 Table 9]` `[7]` `C:high` `V:durable`

### The five pass-through bits

- **Claim.** With `IV=0`, LINT0, LINT1, SMI, NMI, INIT and ExtInt are all passed through unmapped; with `IV=1` each of `Lint0Pass`, `Lint1Pass`, `NMIPass`, `InitPass` and `EIntPass` chooses between target abort (0) and pass-through unmapped (1) for its interrupt type.  `[IOMMU 3.11 Table 10]` `[7]` `C:high` `V:durable`
- **Claim.** There is no pass field for SMI: with `IV=1` SMI requests are still passed through unmapped, and the control for them is the SMI filter, not the device table entry — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 10]` `[7]` `C:high` `V:durable`

### Three overlapping fault-suppression controls

`IG`, `SupIOPF` and `SmiFLogEn` all suppress `IO_PAGE_FAULT` log entries, and confusing them is
easy because two of them sit in different structures.

- **Claim.** `IG` at bit 133 suppresses event logging for interrupt messages that cause `IO_PAGE_FAULT`; with `IG=0` the decision falls to `SupIOPF` in the IRTE, and `MMIO Offset 0018h[SmiFLogEn]` independently controls entries generated by the SMI filter.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** The device-table `SA` and `SE` bits suppress faults from memory accesses and explicitly do **not** affect events logged because of interrupts or command processing; that is why interrupt faults need `IG` and `SupIOPF` at all — the memory-side bits are described in `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`

### Feature enablement, and invalidating the table

- **Claim.** Interrupt features follow a four-way matrix of `MMIO Offset 0030h[GASup]`, `MMIO Offset 0018h[GAEn]`, `IV` and `IRTE[GuestMode]`: remapping alone when `GASup=0`; supported-but-not-enabled when `GAEn=0`; remapping active when `IV=1` with `GuestMode=0`; remapping and virtualization both active when `IV=1` with `GuestMode=1`.  `[IOMMU 3.11 Table 6]` `[7]` `C:high` `V:durable`
- **Claim.** `INVALIDATE_INTERRUPT_TABLE` invalidates all cached interrupt information for one device, including the guest virtual APIC table base pointer if it was cached.  `[IOMMU 3.11 §2.4.5]` `[7]` `C:high` `V:durable`
- **Claim.** Its command format is four dwords: `DeviceID[15:0]` in bits 15:0 of dword `+00`, the command number `05h` in bits 31:28 of dword `+04`, and everything else reserved.  `[IOMMU 3.11 Figure 48]` `[7]` `C:high` `V:durable`

## 10.4 Remapping an MSI, end to end

### Step 0 — the interrupt address range is not translated

- **Claim.** Accesses to the interrupt address range go through the interrupt remapping portion of the IOMMU and not through address translation, so a transaction being processed as an interrupt has its pretranslated/untranslated attribute ignored.  `[IOMMU 3.11 §2.1.4.2]` `[7]` `C:high` `V:durable`
- **Claim.** That range is `FD_F800_0000h`–`FD_F8FF_FFFFh` (Interrupt/EOI), controlled by `IntCtl` and the interrupt remapping tables; the adjacent `FD_0000_0000h`–`FD_F7FF_FFFFh` is reserved interrupt address space and a request there produces an `INVALID_DEVICE_REQUEST` event.  `[IOMMU 3.11 Table 3]` `[7]` `C:high` `V:durable`
- **Claim.** Software should not configure the IOMMU such that an address translation can produce a special address such as the interrupt address range.  `[IOMMU 3.11 §2.1.4.2]` `[7]` `C:high` `V:durable`

### Step 1 — the message type decides which control applies

With destination mode 0 and `MMIO Offset 01A0h[NumIntRemapSup]` of 00b or 01b, the HyperTransport
message-type field routes the request to exactly one control:

| MT | Controlled by |
|---|---|
| 0 (Fixed), 1 (Arbitrated) | the device table entry and the IRTE |
| 2 | `MMIO Offset 0018h[SmiFLogEn]` |
| 3, 4, 6 | `NMIPass` |
| 5 | `InitPass` |
| 7 | `EIntPass` |
| 11 | `Lint1Pass` |
| 14 | `Lint0Pass` |
| 8, 9, 10, 12, 13, 15 | target abort |

- **Claim.** That is the message-type routing for `DM=0`; with `DM=1` only MT 0–1 reach the remapping tables unless `NumIntRemapSup=01b` and `MMIO Offset 0018h[NumIntRemapMode]=01b`, in which case MT 0–7 do and MT 8–15 are target aborted. `NumIntRemapSup=10b`–`11b` is reserved.  `[IOMMU 3.11 Table 19]` `[7]` `C:high` `V:durable`
- **Claim.** The remapped path supports up to 512 interrupts per function in every configuration except `NumIntRemapSup=01b` with `NumIntRemapMode=01b` and `DM=1`, which supports up to 2K interrupts per function.  `[IOMMU 3.11 Table 19]` `[7]` `C:high` `V:durable`
- **Claim.** Earlier revisions of the specification defined interrupt types 0010b–1111b with `DM=1` as remappable instead of target aborted; AMD states that no systems are known to rely on that older behaviour.  `[IOMMU 3.11 Table 19]` `[7]` `C:medium` `V:durable`

### Step 2 — index, read, rewrite

- **Claim.** The interrupt table offset comes from the concatenation shown in Figure 14 and corresponds directly to data bits 10:0 of the originating MSI message, so the IRTE index is `MSI Data[10:0]`; hardware applies the stride for the 32-bit or 128-bit entry size selected by the registers.  `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`
- **Claim.** After reading the entry, the IOMMU builds the new interrupt message address by OR-ing `IRTE[23:2]` with bits 63:2 of the HyperTransport interrupt address range base `FFFF_FFFD_F800_0000h`.  `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`

### Step 3 — with the guest virtual APIC enabled

- **Claim.** The full sequence is: check `GASup`/`GAMSup`/`GAEn`/`GAMEn`; pick the IRTE size and stride; if 32-bit, fall back to the basic path; select the entry for that `DeviceID` in the device table; index the IRTE with the incoming vector; if `RemapEn=0`, report an `IO_PAGE_FAULT`; if `GuestMode=0`, remap as in §10.1 using the wide layout; if `GuestMode=1`, post the interrupt into the guest.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** Posting into the guest is a bit index of `IRTE[Vector] modulo 32`, a byte offset of `(IRTE[Vector] / 32) << 4`, and an atomic set of one bit at `IRTE[GuestVirtualAPICTableRootPointer] + 0200h + byte offset`.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** Hardware may widen that read-modify-write: the atomic OR may use any power-of-two byte width from 1 to 32 bytes, and the multi-byte operation may not exceed 256 bits, with the divisor scaled accordingly.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** After setting the IRR bit the IOMMU re-reads the IRTE: with `IsRun=0` and `GALogIntr=1` it writes a GA log entry carrying `GATag` and signals an interrupt; with `IsRun=1` it sends a guest APIC doorbell to the core named by `Destination`, taken from the same memory read as `IsRun` — the CPU side of that doorbell is in `07-virtual-interrupts-avic.md`.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** The guest virtual APIC table is what makes this possible at all: when it is in use the IOMMU can deliver device interrupts directly to running guests without hypervisor intervention, and the feature requires matching APIC-virtualization support in the processor — AVIC, documented in `07-virtual-interrupts-avic.md`.  `[IOMMU 3.11 §2.2.8]` `[1][7]` `C:high` `V:durable`

### Why this is a security boundary, not just a routing feature

An interrupt is a posted write. A peripheral that can emit an arbitrary write to the interrupt
address range can therefore name an arbitrary vector on an arbitrary CPU unless something checks
it, and the page tables — the mechanism people reach for first — are explicitly not in that path.

- **Claim.** Interrupt remapping is the only check on the interrupt path: with `IV=1` and `IntCtl=01b` fixed and arbitrated interrupts are forwarded unmapped, with `IntCtl=00b` they are target aborted, and only `IntCtl=10b` validates them against a per-device table whose entries software controls.  `[IOMMU 3.11 Table 9]` `[7]` `C:high` `V:durable`
- **Claim.** `RemapEn=0` is the per-vector deny: the interrupt is target aborted and reported as an `IO_PAGE_FAULT`, which is why a correctly sized table with most entries disabled is the safe default rather than a short table.  `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- **Claim.** DMA-capable peripherals are a demonstrated attack class against IOMMU-protected hosts, including devices that are trusted by the platform and then behave maliciously; the published work targets the translation path rather than the interrupt path, so it corroborates the threat model rather than this specific mechanism.  `[no-spec]` `[310]` `C:medium` `V:durable`

## 10.5 The GA log and guest vAPIC wake-up

The `IsRun=1` path needs no software. The `IsRun=0` path is the interesting one: the interrupt is
already recorded in the guest's virtual IRR, but nothing will consume it until the hypervisor
schedules that vCPU. The specification defines two ways to tell the hypervisor, and one way to
tell it nothing at all.

1. `GALogIntr=0` and no GAPPI — the IRR bit is set and the hypervisor is not notified.
2. `GALogIntr=1` — a GA log entry naming the device and the `GATag`, plus an MSI.
3. GAPPI — no log entry, a direct interrupt to a physical core instead.

### The log

- **Claim.** The GA log is a circular buffer in system physical memory holding virtual interrupt requests that could not be delivered because the target virtual processor was not running; each entry identifies the source by `DeviceID` and the target by the `GATag` software put in the IRTE.  `[IOMMU 3.11 §2.7.1]` `[7]` `C:high` `V:durable`
**The entry layout lives in `08-iommu-architecture.md`.** That chapter owns the entry
format of all three logs — event, PPR and guest-vAPIC — because a log format is only
usable next to the registers that point at it and the Status register you read when the
log misbehaves. It states the eight-byte record, its generic form and the one defined
type, from Figures 78 and 79 and Table 76. What follows here is what the record *means*.

- **Claim.** The one defined record type carries the 32-bit `GATag` that software wrote into the interrupt remapping table entry, so the tag is the hypervisor's own handle for the target virtual processor: the IOMMU never interprets it, it only copies it back, which is what lets a hypervisor pick any encoding it likes for vCPU identity.  `[IOMMU 3.11 §2.7.3]` `[7]` `C:high` `V:durable`
- **Claim.** The record is written when the IOMMU receives an interrupt for a device whose entry has `GuestMode=1` and whose `IsRun` indicates the guest is not currently running; the interrupt itself is still recorded in the virtual APIC backing page, so the log entry is a notification that a pending interrupt needs the hypervisor to schedule the target, not a record of a lost interrupt.  `[IOMMU 3.11 §2.7.3]` `[7]` `C:high` `V:durable`

**The log's plumbing is in `08-iommu-architecture.md`.** Sizing via the Guest Virtual
APIC Log Base Address Register, the head and tail pointers and their in-memory shadow,
the shift-by-three full/empty arithmetic, overflow behaviour and the restart procedure
are all register-level mechanics, and they sit there with the rest of the MMIO map and
the Status register bits you read when a log stops advancing. The division is that `08`
owns the GA log **as a data structure** and this chapter owns it **as a signal**.

One consequence worth stating here, because it changes how you debug a missing interrupt:

- **Claim.** GA log overflow does not drop one entry and carry on — it stops the log: the overflow status bit is set, subsequent guest virtual APIC event data is discarded, and logging stays disabled until software runs the restart procedure. A hypervisor that does not handle overflow therefore stops being told about *any* undelivered guest interrupt, not merely the one that overflowed.  `[IOMMU 3.11 §2.7.1]` `[7]` `C:high` `V:durable`

### GAPPI: skipping the log entirely

- **Claim.** When `MMIO Offset 0030h[GAPPISup]=1` and `MMIO Offset 0018h[GAPPIEn]=1`, guest interrupts to non-running guests still update the vAPIC backing page IRR, the GA log write is suppressed for `IsRun=0` when `GALogIntr=0`, and instead a GAPPI interrupt is raised when all of the guest IRR bits were clear before the last update — that is, when the new interrupt is the first one pending to the vCPU.  `[IOMMU 3.11 §2.2.5.4]` `[7]` `C:high` `V:durable`
- **Claim.** The GAPPI interrupt is issued with `Destination = IRTE[Destination]`, `Vector = IRTE[GATag[7:0]]`, message type 0, destination mode 0 and `RQEOI = 0`.  `[IOMMU 3.11 §2.2.5.4]` `[7]` `C:high` `V:durable`
- **Claim.** AMD states that implementations may not be able to determine perfectly whether all IRR bits were previously clear, so spurious GAPPI interrupts may occur and software must tolerate them.  `[IOMMU 3.11 §2.2.5.4]` `[7]` `C:high` `V:durable`
- **Claim.** `MMIO Offset 01A0h[GAPPIDisSup]=1` together with `IRTE[GAPPIDis]=1` suppresses the GAPPI interrupt while still updating the backing-page IRR, which gives a per-vector opt-out rather than a per-IOMMU one.  `[IOMMU 3.11 §2.2.5.4]` `[7]` `C:high` `V:durable`

The practical consequence for a hypervisor is that GAPPI replaces a memory write plus a log-consuming
MSI handler with a single interrupt whose vector is carried in the low byte of `GATag`. That reuse of
`GATag` is why `GATag` must be allocated with GAPPI in mind even on systems that intend to use the log.

## 10.6 Address Translation Services, PRI and PASID

ATS lets a peripheral hold translations in its own IOTLB; PRI lets it ask software to make a page
present instead of failing; PASID lets one device carry many address spaces. All three are PCI-SIG
protocols that the IOMMU implements [53]; the AMD-specific parts are which device-table bits gate
them and how faults and completions are routed.

### ATS

- **Claim.** ATS is gated per device by the `I` bit (IOTLB enable) at device-table bit 96: with `I=0` the IOMMU target aborts ATS requests from the peripheral, with `I=1` it answers them — see `08-iommu-architecture.md` for the surrounding fields.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`
- **Claim.** A base-function ATS request carries no PASID TLP prefix and translates a GPA to an SPA; the optional enhancement carries a valid PASID and a canonical guest virtual address and translates a GVA to an SPA.  `[IOMMU 3.11 §1.3.4]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU must update Accessed and Dirty bits in the guest page tables while servicing an ATS request as if the peripheral had really accessed memory, using the access level in the ATS packet; when processing a GPA it treats the page tables as read-only.  `[IOMMU 3.11 §1.3.4]` `[7]` `C:high` `V:durable`
- **Claim.** ATS responses do not signal faults: for a translation request the IOMMU returns the result and lets the peripheral inspect it, which is the mechanism that makes PRI useful.  `[IOMMU 3.11 §2.1.3.2]` `[7]` `C:high` `V:durable`
- **Claim.** The privilege conversion is defined case by case: a not-present PTE returns `R=0 W=0`; a present read-only PTE with the no-write hint clear causes a re-walk on a TLB hit and otherwise sets `A` and returns `R=1 W=0`; a present writable PTE with the no-write hint clear sets `A` and `D` and returns `R=1 W=1`; with the hint set it sets `A` only and returns `R=1 W=0`.  `[IOMMU 3.11 Table 32]` `[7]` `C:high` `V:durable`
- **Claim.** Software must invalidate after removing write or execute permission, after changing a page from present to not-present, and after changing `U/S` from user to supervisor; promotions need no invalidation because the IOMMU re-walks.  `[IOMMU 3.11 §2.2.7.6]` `[7]` `C:high` `V:durable`
- **Claim.** The `N` field in an ATS response controls NoSnoop: `N=1` forces the device to generate DMA with `NoSnoop=0`, while `N=0` leaves the choice to the device; for guest translations `N` is always 1 unless `MMIO Offset 0030h[AttrFWSup]=1`, in which case `AttrV`, `SnoopAttribute` and `Mode0FC` in the device table entry determine it — those fields are `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.7.9]` `[7]` `C:high` `V:durable`

### Secure ATS

- **Claim.** Ordinary ATS hands the device an SPA and then only checks that the device was allowed to issue translated DMA, so a malicious device or a compromised IOTLB can emit translated DMA with arbitrary system physical addresses.  `[IOMMU 3.11 §2.11]` `[7]` `C:high` `V:durable`
- **Claim.** Secure ATS closes that gap: with `MMIO Offset 0030h[SATSSup]=1` and the `SATS` bit at device-table bit 106 set, the IOMMU walks the full page table but returns the **GPA** rather than the SPA, and performs in-line GPA-to-SPA translation on translated DMA from that device.  `[IOMMU 3.11 §2.11]` `[7]` `C:high` `V:durable`
- **Claim.** When SNP is enabled, software must set `SATS=1` whenever `I=1`, or an `ILLEGAL_DEV_TABLE_ENTRY` event is logged; `MMIO Offset 01A0h[SnpPageMode0Sup]=1` relaxes this to allow `SATS=0`.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`

### PASID

- **Claim.** The PASID TLP prefix carries a 24-bit payload: `PMR` (privileged mode requested) at bit 23, `Exe` (execute requested) at 22, `PNP` (PASID not present) at 21, a reserved bit at 20 that the IOMMU nevertheless passes through as received, and `PASID[19:0]` at 19:0.  `[IOMMU 3.11 Table 33]` `[7]` `C:high` `V:durable`
- **Claim.** A transaction is said to contain a valid PASID when the prefix has `PNP=0b` and the address is untranslated; with `PNP=1b` the IOMMU ignores the `PASID`, `PMR` and `Exe` fields.  `[IOMMU 3.11 §2.2.7.7]` `[7]` `C:high` `V:durable`
- **Claim.** A prefix is treated as a PASID prefix when `Fmt=001b` and `Type=100b`; the IOMMU inspects only the first prefix on a packet, passes the rest through, and its behaviour for a PASID prefix that is not the first is undefined.  `[IOMMU 3.11 §2.2.7.7]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU processes the PASID prefix on memory-access, ATS and PRI packets and does **not** process it on MSI or MSI-X interrupt packets; a prefix the IOMMU cannot process is reported as an `INVALID_DEVICE_REQUEST` event.  `[IOMMU 3.11 §2.2.7.7]` `[7]` `C:high` `V:durable`
- **Claim.** The maximum PASID value an implementation supports is `2^PASmax - 1`, read from `MMIO Offset 0030h[PASmax]`; each peripheral may support fewer, and software must mark out-of-range PASIDs not-valid in the guest CR3 tables.  `[IOMMU 3.11 §2.2.7.8]` `[7]` `C:high` `V:durable`

### PRI, and how a page request comes back

- **Claim.** AMD's support for PCI-SIG PRI is peripheral page request (PPR) logging: the IOMMU cannot service a PRI request itself, so with `MMIO Offset 0018h[PPRLogEn]=1` it converts every PRI request into a PPR log entry while there is room, and with `PPRLogEn=0` it discards them.  `[IOMMU 3.11 §2.6]` `[7]` `C:high` `V:durable`
- **Claim.** After servicing the request software issues `COMPLETE_PPR_REQUEST` (command number `07h`) for the originating `DeviceID`, which makes the IOMMU emit the PCIe completion packet.  `[IOMMU 3.11 §2.4.7]` `[7]` `C:high` `V:durable`
- **Claim.** For PCIe, `CompletionTag[15:12]` carries the PRI Response Code, `CompletionTag[11:9]` must be zero and `CompletionTag[8:0]` carries the PRI Page Request Group Index taken from the `PPRtag` of the `PAGE_SERVICE_REQUEST` entry; the IOMMU does not validate the tag, so software must copy it faithfully.  `[IOMMU 3.11 Table 40]` `[7]` `C:high` `V:durable`
- **Claim.** With `GN=1` the IOMMU inserts the supplied PASID into the PCIe TLP prefix of the completion; with `GN=0` the PASID field is ignored and no prefix is inserted.  `[IOMMU 3.11 §2.4.7]` `[7]` `C:high` `V:durable`

The PPR log entry layout itself is in `08-iommu-architecture.md`, next to the registers that point at
it. `IO_PAGE_FAULT` decoding is in `09-iommu-page-tables.md`.

### SR-IOV — server scope

- **Claim.** SR-IOV is a PCI-SIG capability rather than an AMD-Vi one; the "Virtual Function" MMIO regions the IOMMU specification defines in §3.5 and §3.6 are vIOMMU resources for guest IOMMU register access and are unrelated to PCIe SR-IOV virtual functions, so the two must not be conflated.  `[IOMMU 3.11 §3.6]` `[7][53]` `C:high` `V:durable`

### Linux-only contrast

Linux exposes AMD-Vi through the `amd_iommu` kernel parameters and groups devices into
`/sys/kernel/iommu_groups`.

- **Claim.** "IOMMU group" is a Linux/VFIO kernel construct describing the smallest set of devices the kernel can isolate from one another; it is not an AMD architectural concept and appears nowhere in the IOMMU specification, whose isolation unit is the `DomainID` defined in `08-iommu-architecture.md`.  `[no-spec]` `[57]` `C:high` `V:durable`

## 10.7 Hardware-accelerated vIOMMU

Hardware-accelerated vIOMMU is durable architecture, not a roadmap item: it defines how a guest's
own IOMMU registers and data structures are serviced by hardware instead of trapped and emulated.
It belongs here because interrupt remapping is the part of it that changes shape.

- **Claim.** vIOMMU is reported by `MMIO Offset 0030h[vIommuSup]=1` and lets the IOMMU directly access and process guest data structures — guest command buffers, guest PPR logs and guest event logs — and send interrupts directly to guest IOMMU drivers.  `[IOMMU 3.11 §2.10]` `[7]` `C:high` `V:durable`
- **Claim.** Three device-table fields carry it: `vImuEn` at bit 207 marks the owning guest as vIOMMU-enabled, `GuestID[15:0]` at bits 239:224 identifies the VM, and `GDeviceID[15:0]` at bits 223:208 gives the guest's view of the device ID; all devices assigned to one VM must share the same `GuestID` and `vImuEn` — see `08-iommu-architecture.md` for the rest of the entry.  `[IOMMU 3.11 Figure 7]` `[7]` `C:high` `V:durable`
- **Claim.** Hypervisor software maps guest IOMMU MMIO accesses in the range `2000h`–`2FFFh` onto the aligned 4-Kbyte section of the Virtual Function MMIO region belonging to that `GuestID`; every other guest MMIO address is not handled by vIOMMU hardware and must still be emulated.  `[IOMMU 3.11 §2.10.2]` `[7]` `C:high` `V:durable`
- **Claim.** When vIOMMU is enabled host software must also enable the guest virtual APIC (`MMIO Offset 0018h[GAEn]`), and the IOMMU's own `DeviceID` must have an entry with `V=1`, `TV=1`, `GV=0`, `Mode=100b` in the device table described by `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.10.1]` `[7]` `C:high` `V:durable`
- **Claim.** With vIOMMU enabled the interrupt remapping table reached through the IOMMU's own entry in the device table (`08-iommu-architecture.md`) becomes two-level: the interrupt table root pointer at bits 179:134 becomes the base of a level-1 table, `IntTabLen` becomes that table's length, and software must allocate two consecutive 4-Kbyte pages for it.  `[IOMMU 3.11 §2.10.4]` `[7]` `C:high` `V:durable`
- **Claim.** A level-1 interrupt table entry is 64 bits: `Interrupt Table Base Pointer` at bits 51:6, which must be 8-Kbyte aligned so that bits 12:6 are zero, `IntTabLen` at bits 5:2 with the same power-of-two encoding as the device-table field, and a valid bit `V` at bit 0.  `[IOMMU 3.11 Table 78]` `[7]` `C:high` `V:durable`
- **Claim.** The level-1 table is indexed by `{Vector[1:0], GuestID[15:0]}`, and `Vector[1:0]` selects the guest IOMMU's interrupt source: 00 = event/general interrupt, 01 = PPR interrupt, 10 and 11 reserved.  `[IOMMU 3.11 Figure 83]` `[7]` `C:high` `V:durable`
- **Claim.** The EOI special bus cycle is not supported when vIOMMU is enabled: software must configure all device interrupts as edge-triggered through the IOMMU remapping facilities and additionally write the vector number into the EOI register of the originating I/O APIC by hand.  `[IOMMU 3.11 §2.10.5]` `[7]` `C:high` `V:durable`
- **Claim.** Guest PRI requests are steered by `vImuEn`: with `vImuEn=1` they are logged in the guest PPR buffer, with `vImuEn=0` in the host PPR buffer.  `[IOMMU 3.11 §2.10.6]` `[7]` `C:high` `V:durable`
- **Claim.** Only five commands are supported for guests under vIOMMU: `COMPLETION_WAIT`, `INVALIDATE_DEVTAB_ENTRY`, `INVALIDATE_IOMMU_PAGES`, `INVALIDATE_IOTLB_PAGES` and `COMPLETE_PPR_REQUEST` — notably not `INVALIDATE_INTERRUPT_TABLE`.  `[IOMMU 3.11 §2.10.7]` `[7]` `C:high` `V:durable`

## 10.8 Open items

**Inconsistencies inside Rev 3.11 itself.** These are reported, not resolved; where a value matters,
this chapter follows the register definition in Chapter 3 over the prose in Chapter 2.

- `Vector` in the `GuestMode=1` IRTE is labelled `Vector[8:0]` in Table 23 but occupies the 8-bit field 71:64 in Figure 18. Nine bits do not fit. The delivery algorithm only ever uses `IRTE[Vector] modulo 32` and `IRTE[Vector] / 32`, so the arithmetic is unaffected, but the label cannot be taken literally.
- §2.7.1 says GA logging is enabled by `MMIO Offset 0018h[GAEn]`, while the restart procedure in §2.7.4 and the Chapter 3 register definition both name a separate `MMIO Offset 0018h[GALogEn]` bit. Treat `GAEn` as the guest-virtual-APIC enable and `GALogEn` as the log enable.
- The GA log status bit is called `GAInt` in §2.7.1 and `GALogInt` in the `GAIntEn` register definition; both refer to `MMIO Offset 2020h`.
- §3.1 places `MsiNumGA` at `Capability Offset 10h`; the register itself is defined in IOMMU Miscellaneous Information Register 1 at `Capability Offset 14h`, bits 4:0, which is also what §2.7.1 and the `GAIntEn` definition say.
- §2.10.2 writes the guest MMIO window as "offsets 2000h and 2FFFFh"; Figure 82 and the accompanying "aligned 4KB section" both give `2000h`–`2FFFh`.
- Table 38 assigns dword `+04` bits 27:20 to Reserved and says nothing about 19:0, while Figure 48 shows the whole of `+04` below the opcode as reserved.

**Not covered by any AMD specification.**

- **Claim.** No AMD specification states the firmware default for interrupt remapping on a given client board: the IOMMU specification defines discovery through the ACPI IVRS table (`09-iommu-page-tables.md`) and says nothing about defaults, and AMD publishes neither a client Ryzen PPR nor a client revision guide.  `[no-spec]` `[7]` `C:medium` `V:durable`

**Boundary with `08-iommu-architecture.md`** (settled 2026-09-21). `recheck-findings.md`
carried two decisions that contradicted each other — §1 gave this chapter the GA log
"format and semantics", while §2's three-way IOMMU re-cut moved every log entry format
into `08`. §2 won: it is the later and broader decision, and `08` already owns the event
and PPR log formats, so leaving one of the three here was the kind of hairline split that
drifts. The format is there; the semantics are here.

**Deliberately absent.**

- The MMIO register bit tables for `0018h`, `0030h`, `01A0h` and `2020h`. This chapter names those fields by register offset and field name only; the bit positions are `08-iommu-architecture.md`.
- `IO_PAGE_FAULT` event-entry decoding, including the `I` bit that distinguishes an interrupt fault from a memory fault: `09-iommu-page-tables.md`.
- AVIC's backing page, its physical and logical APIC ID tables, the doorbell MSR and x2AVIC: `07-virtual-interrupts-avic.md`.
- Everything Windows: Kernel DMA Protection, DDA and GPU-P are `16-windows-platform.md`.
