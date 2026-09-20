# 11. VT-d Interrupt Remapping

> **中文速览**：本章只讲一件事——VT-d 如何拦下写往 FEEx_xxxxh 的中断请求，用一张表把它重新定向。内容包括：compatibility 与 remappable 两种中断请求格式、`interrupt_index` 的算法、**IRTE 的完整逐位布局**（remapped 格式与 posted 格式各一份）、SID/SVT/SQ 三件套做的源验证、x2APIC 与 EIME 的强绑定关系，以及开启中断重映射的 SIRTP/IRE 握手。中断投递（interrupt posting）部分讲 IRTE 如何指向 posted-interrupt descriptor 并把中断交给 CPU 侧——**descriptor 本身的 PIR/ON/SN 语义归 `07-apic-virtualization.md`**，这里只讲 VT-d 这一侧。**本章是 IRTE 的唯一 owner。**

**Maps to:** Intel VT-d Architecture Specification Rev 5.20 Ch.5 "Interrupt Remapping", with entry formats in Ch.9 §9.9 and §9.10 and registers in Ch.11 §11.4.10 [8]
**Owns:** IRTE (both formats), the remappable interrupt-request format, interrupt-index computation, source-id validation (SID/SVT/SQ), IRTA_REG, the interrupt-remapping enable handshake, the VT-d side of interrupt posting
**See also:** `07-apic-virtualization.md` (posted-interrupt descriptor semantics, PIR/ON/SN, virtual-interrupt delivery), `10-vtd-dma-remapping.md` (registers, interrupt entry cache invalidation), `12-vtd-faults-bios-siov.md` (fault reporting registers)

---

## 11.1 What interrupt remapping is for

On Intel 64 platforms an interrupt is a DWORD memory write to the range FEEx_xxxxh. Without
remapping hardware, every field that decides *where that interrupt lands* — APIC ID, vector,
delivery mode — travels inside the request itself, which means any device that can issue a DMA
write can forge any interrupt to any CPU. Interrupt remapping replaces those fields with a 16-bit
handle, an index into a table only privileged software can write.

Two further consequences fall out of the same mechanism: an 8-bit APIC ID no longer has to fit in
the request, which is what makes x2APIC usable on large systems; and a device's interrupts can be
migrated between CPUs by editing one table entry rather than reprogramming the device.

- **Claim.** VT-d Chapter 5 is titled "Interrupt Remapping" and covers interrupt remapping in §5.1 and interrupt posting in §5.2.  `[VT-d 5.20 Ch.5]` `[8]` `C:high` `V:durable`
- **Claim.** Interrupt-remapping support is enumerated by the IR field at bit 3 of the Extended Capability Register.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** The VT-d specification identifies interrupt isolation, interrupt migration and x2APIC support as the three motivations for hardware interrupt remapping.  `[VT-d 5.20 §2.5.2]` `[8]` `C:high` `V:durable`

### 11.1.1 Where the source-id of an interrupt comes from

Source-id validation is only as good as the source-id the platform can observe, and for several
classes of interrupt source that identity is aliased or synthesised. This is the limit of what interrupt
remapping can isolate.

- **Claim.** To support domain-isolation usages, platform hardware must be capable of uniquely identifying the requester (source-id) for each interrupt message.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For message-signaled interrupt requests from PCI Express devices and from root-complex integrated PCI or PCI Express devices, the source-id is the device's PCI requester-id.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For message-signaled interrupt requests from devices behind PCI Express-to-PCI/PCI-X bridges, the requester identifier may be that of the interrupting device or the bridge's secondary-interface bus number with device and function number zero; because of this aliasing, interrupt-remapping hardware does not isolate interrupts from individual devices behind such bridges.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For message-signaled interrupt requests from devices behind conventional PCI bridges the source-id is the requester-id of the legacy bridge device, so interrupt-remapping hardware does not isolate such requests from individual devices either.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** For devices using legacy interrupt routing the I/OxAPIC generates the interrupt-request transaction, and interrupt-remapping hardware requires each I/OxAPIC in the platform to include a unique 16-bit source-id in its requests, reported by BIOS through ACPI structures.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Other platform devices that are not PCI discoverable yet can generate message-signaled interrupts, such as integrated High Precision Event Timer devices, must be assigned unique non-conflicting 16-bit source-ids reported by BIOS through ACPI structures.  `[VT-d 5.20 §5.1.1]` `[8]` `C:high` `V:durable`

## 11.2 Interrupt request formats

### 11.2.1 Compatibility format

- **Claim.** The Interrupt Format field is address bit 4; it is Clear for compatibility-format interrupt requests and Set for remappable-format interrupt requests.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** Compatibility-format interrupt requests are specified in VT-d §5.1.2.1 and remappable-format requests in §5.1.2.2.  `[VT-d 5.20 §5.1.2]` `[8]` `C:high` `V:durable`
- **Claim.** Compatibility-format interrupts are blocked when Extended Interrupt Mode is enabled (IRTA_REG.EIME Set) or when compatibility-format interrupts are disabled (GSTS_REG.CFIS Clear).  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`

### 11.2.2 Remappable format

The remappable format carries almost nothing: a handle, a flag saying whether the data half also
contributes, and the top bit of the handle stranded at address bit 2.

| Address bits | Field |
|---|---|
| 31:20 | Interrupt Identifier — must be FEEh to be decoded as an interrupt request |
| 19:5 | Handle[14:0] |
| 4 | Interrupt Format — must be 1b for remappable format |
| 3 | SHV — SubHandle Valid |
| 2 | Handle[15] |
| 1:0 | Don't Care |

| Data bits | Field |
|---|---|
| 31:16 | Reserved (0) when SHV is Set |
| 15:0 | Subhandle, when SHV is Set |

- **Claim.** In the remappable interrupt-request format, address bits 31:20 are the Interrupt Identifier and a DWORD DMA write with FEEh in those bits is decoded as an interrupt request by the root complex.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** In the remappable format, address bits 19:5 carry Handle[14:0], bit 4 is the Interrupt Format field (1b), bit 3 is SubHandle Valid (SHV), bit 2 carries Handle[15], and bits 1:0 are ignored by interrupt-remapping hardware.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** The 16-bit Handle provides 64K unique interrupt requests per remapping hardware unit.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** SHV specifies whether the interrupt request payload contains a valid Subhandle, which enables MSI constructs supporting only a single address with multiple data values.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** When SHV is Set, data bits 15:0 contain the 16-bit Subhandle and data bits 31:16 are treated as reserved (0); when SHV is Clear the whole data field is ignored by hardware.  `[VT-d 5.20 §5.1.2.2]` `[8]` `C:high` `V:durable`

## 11.3 The interrupt-remapping table and interrupt_index

> When an entry lookup or validation fails, the resulting fault reasons (20h–2Bh, including
> 21h and 26h) are listed in §11.10, not here.

- **Claim.** Interrupt-remapping hardware uses a memory-resident single-level table called the Interrupt Remapping Table, whose base address and size are specified through the Interrupt Remap Table Address Register.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Each entry in the interrupt remapping table is 128 bits in size and is called an Interrupt Remapping Table Entry (IRTE).  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** The maximum number of IRTEs in an interrupt remapping table is 64K.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`

The index computation is two lines of the spec, reproduced verbatim in structure:

```
if (address.SHV == 0)
    interrupt_index = address.handle;
else
    interrupt_index = address.handle + data.subhandle;
```

- **Claim.** For remappable-format requests, hardware computes interrupt_index as address.handle when address.SHV is 0, and as address.handle + data.subhandle when SHV is 1.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** If the computed interrupt_index is equal to or larger than the number of IRTEs in the remapping table, hardware treats the interrupt request as an error.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** Remapping hardware units in a platform may be configured to share an interrupt-remapping table or to use independent tables.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`

### 11.3.1 IRTA_REG (§11.4.10)

| Bits | Field |
|---|---|
| 63:12 | IRTA — Interrupt Remapping Table Address |
| 11 | EIME — Extended Interrupt Mode Enable |
| 10:4 | Reserved |
| 3:0 | S — Size |

- **Claim.** IRTA_REG lives at register offset 0B8h, with IRTA at bits 63:12, EIME at bit 11, reserved bits 10:4 and S (Size) at bits 3:0.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** The number of entries in the interrupt remapping table is 2^(X+1), where X is the value programmed in IRTA_REG.S.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** The IRTA field points to the base of a 4 KB-aligned interrupt remapping table, and hardware may ignore bits 63:HAW.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** Values written to IRTA_REG take effect only after software executes the Set Interrupt Remap Table Pointer command.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** IRTA_REG is treated as RsvdZ by implementations reporting Interrupt Remapping as not supported in the Extended Capability Register.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`

## 11.4 IRTE for remapped interrupts (§9.9)

This is the canonical layout. Anything that contradicts this table is wrong.

| Bits | Field |
|---|---|
| 127:84 | Reserved |
| 83:82 | SVT — Source Validation Type |
| 81:80 | SQ — Source-id Qualifier |
| 79:64 | SID — Source Identifier |
| 63:32 | DST — Destination ID |
| 31:24 | Reserved |
| 23:16 | V — Vector |
| 15 | IM — IRTE Mode |
| 14:12 | Reserved |
| 11:8 | AVAIL — Available to software |
| 7:5 | DLM — Delivery Mode |
| 4 | TM — Trigger Mode |
| 3 | RH — Redirection Hint |
| 2 | DM — Destination Mode |
| 1 | FPD — Fault Processing Disable |
| 0 | P — Present |

- **Claim.** In the IRTE for remapped interrupts, P is bit 0, FPD bit 1, DM (Destination Mode) bit 2, RH (Redirection Hint) bit 3, TM (Trigger Mode) bit 4, DLM (Delivery Mode) bits 7:5, AVAIL bits 11:8, reserved bits 14:12, IM (IRTE Mode) bit 15, V (Vector) bits 23:16, reserved bits 31:24 and DST (Destination ID) bits 63:32.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** In the IRTE for remapped interrupts, SID occupies bits 79:64, SQ bits 81:80, SVT bits 83:82 and bits 127:84 are reserved.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** IM = 0 indicates that interrupt requests processed through the IRTE are remapped; IM = 1 indicates they are posted and the entry is interpreted in the posted format of §9.10.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The AVAIL field at bits 11:8 is available to software and hardware always ignores its programming.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The V field is an 8-bit field containing the interrupt vector associated with the remapped interrupt request, evaluated only when the Present field is Set.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The DST field identifies the remapped interrupt request's target processor or processors, and its interpretation depends on the interrupt-remapping mode in force.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** RH indicates whether the remapped interrupt request should be directed to one among N processors specified in the Destination ID field, under hardware control.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** DM indicates whether the Destination ID field should be interpreted as a logical or a physical APIC ID.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The 3-bit DLM field specifies how the remapped interrupt is handled, operates only in conjunction with specific Trigger Modes, and correct Trigger Modes must be guaranteed by software.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The all-zeros rule applies to SMI alone: for SMI (DLM = 010b) the vector field is ignored "but must be programmed to all zeros for future compatibility", whereas for NMI (100b) and INIT (101b) the specification says only that the vector information is ignored, with no zeroing requirement.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** NMI, INIT and ExtINT are edge triggered regardless of the setting of the Trigger Mode field, and platforms supporting interrupt remapping are expected or recommended to generate SMI, NMI and INIT through a dedicated pin or platform-specific special messages.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The FPD field is evaluated by hardware irrespective of the setting of the Present field, while all other IRTE fields are evaluated only when P is Set.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** When forwarding a remapped interrupt request to the system bus, the "Trigger Mode Level" field in the request on the system bus is always set to asserted (1b).  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`

### 11.4.1 Source-id validation: SVT, SID and SQ

The three fields together answer "is this device allowed to raise this interrupt?".

- **Claim.** The SVT field specifies the type of validation interrupt-remapping hardware must perform on the source-id of interrupt requests referencing the IRTE, and is evaluated only when P is Set.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** When SVT is 01b, the SID field specifies the requester-id allowed to originate interrupt requests referencing the IRTE, and the SQ field determines which bits of the SID field are considered in the verification.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** When SVT is 10b, the upper 8 bits of the SID field contain a Startbus# and the lower 8 bits an Endbus#, and a referencing interrupt request must have a requester-id whose bus number lies within that range; this encoding may be used to verify interrupts originating behind PCI Express-to-PCI/PCI-X bridges.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The SQ field is evaluated by hardware only when the Present field is Set and the SVT field is 01b, and exists to verify origination of interrupt requests generated by devices supporting phantom functions.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The SQ encodings progressively ignore the least significant fields of the SID and requester-id: full comparison, comparison ignoring the third least significant field, comparison ignoring the second and third least significant fields, and comparison ignoring the least three significant fields.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`
- **Claim.** The SID field is evaluated by hardware only when the Present field is Set and the SVT field is 01b or 10b.  `[VT-d 5.20 §9.9]` `[8]` `C:high` `V:durable`

## 11.5 IRTE for posted interrupts (§9.10)

When IM is 1 the same 128 bits mean something else. Note that the shared fields — P, FPD, AVAIL,
IM, the vector byte, SID, SQ, SVT — keep their positions, which is what makes a mode switch a
single atomic store.

| Bits | Field |
|---|---|
| 127:96 | PDAH — Posted Descriptor Address High (address bits 63:32) |
| 95:84 | Reserved |
| 83:82 | SVT — Source Validation Type |
| 81:80 | SQ — Source-id Qualifier |
| 79:64 | SID — Source Identifier |
| 63:38 | PDAL — Posted Descriptor Address Low (address bits 31:6) |
| 37:24 | Reserved |
| 23:16 | VV — Virtual Vector |
| 15 | IM — IRTE Mode (1) |
| 14 | URG — Urgent |
| 13:12 | Reserved |
| 11:8 | AVAIL |
| 7:2 | Reserved |
| 1 | FPD |
| 0 | P |

- **Claim.** In the IRTE for posted interrupts, P is bit 0, FPD bit 1, reserved bits 7:2, AVAIL bits 11:8, reserved bits 13:12, URG bit 14, IM bit 15, VV (Virtual Vector) bits 23:16 and reserved bits 37:24.  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`
- **Claim.** In the IRTE for posted interrupts, PDAL occupies bits 63:38 and specifies address bits 31:6 of the 64-byte aligned descriptor, SID bits 79:64, SQ bits 81:80, SVT bits 83:82, reserved bits 95:84 and PDAH bits 127:96 specifying address bits 63:32.  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`
- **Claim.** In the posted IRTE, hardware treats PDAH upper address bits 63:HAW as Reserved(0).  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`
- **Claim.** IM = 1 indicates interrupt requests processed through the IRTE are posted, and hardware implementations not supporting Posted Interrupts (PI = 0 in the Capability Register) treat the IM field as Reserved(0).  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`
- **Claim.** URG indicates whether the interrupt posted through the IRTE has latency-sensitive processing requirements, is evaluated only when both P and IM are Set, and is treated as Reserved(0) where PI = 0 in the Capability Register.  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`
- **Claim.** For posted-format IRTEs the vector field is the Virtual Vector and is used to determine which bit to Set when posting the interrupt, rather than to generate a remapped interrupt request as in remappable format.  `[VT-d 5.20 §5.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Software is recommended to reserve a full cacheline to host the structure addressed by PDAL/PDAH for optimal performance.  `[VT-d 5.20 §9.10]` `[8]` `C:high` `V:durable`

## 11.6 Interrupt posting: the VT-d side

Interrupt posting turns an interrupt from "a message delivered to a CPU" into "a bit set in memory,
plus an optional nudge". The memory structure and everything the CPU does with it belong to
`07-apic-virtualization.md`; what follows is strictly what the remapping hardware unit does.

- **Claim.** Interrupt-posting capability is an extension of interrupt-remapping hardware that enables a remappable-format interrupt request to be posted in a coherent main-memory resident data structure, with an optional notification event to the CPU complex.  `[VT-d 5.20 §5.2]` `[8]` `C:high` `V:durable`
- **Claim.** Remapping hardware support for interrupt posting is reported through the Posted Interrupt Support (PI) field at bit 59 of the Capability Register.  `[VT-d 5.20 §11.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** The IRTE Mode (IM) field alone decides whether a remappable interrupt request is subject to interrupt-remapping or interrupt-posting; all remappable requests are first processed through the Interrupt Remapping Table either way.  `[VT-d 5.20 §5.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** The structure that the posted IRTE addresses through PDAL/PDAH is 64-byte aligned and sized, must be allocated by system software in coherent write-back main memory, and its field semantics are owned by `07-apic-virtualization.md` — see that chapter, not this one.  `[VT-d 5.20 §5.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** When posting, hardware performs an atomic read-modify-write that always snoops processor caches irrespective of the value of the Page-walk Coherency (C) field in the Extended Capability Register.  `[VT-d 5.20 §5.2.3]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware implementations reporting Memory Type Support (MTS = 1 in ECAP_REG) must use the write-back memory type for the atomic operation that updates the posted structure.  `[VT-d 5.20 §5.2.3]` `[8]` `C:high` `V:durable`
- **Claim.** During posting hardware claims exclusive ownership of the hosting cache-line, and if it detects invalid programming such as non-zero reserved fields it releases ownership and blocks the interrupt request.  `[VT-d 5.20 §5.2.3]` `[8]` `C:high` `V:durable`
- **Claim.** After the atomic update, hardware promotes the cache-line to be globally observable before generating any notification event, and may write back the cache-line at any time after that step.  `[VT-d 5.20 §5.2.3]` `[8]` `C:high` `V:durable`
- **Claim.** Interrupts generated by the remapping hardware itself are not subject to interrupt posting.  `[VT-d 5.20 §5.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d §5.2.5 is an informative section illustrating how VMM software may use interrupt-posting hardware for virtual-interrupt delivery; §5.2.6 covers interrupt posting for level-triggered interrupts.  `[VT-d 5.20 §5.2.5]` `[8]` `C:high` `V:durable`

### 11.6.1 Ordering requirements (§5.2.4)

- **Claim.** Before an interrupt is posted and made visible to software, all preceding inbound DMA writes must be committed to their destinations.  `[VT-d 5.20 §5.2.4]` `[8]` `C:high` `V:durable`
- **Claim.** An upstream read completion must wait until all preceding interrupts are completed, whether remapped or posted; for a posted interrupt, completion means both the atomic descriptor update and the associated notification event have completed.  `[VT-d 5.20 §5.2.4]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware must ensure the descriptor update is observable to software before issuing the notification event for that descriptor.  `[VT-d 5.20 §5.2.4]` `[8]` `C:high` `V:durable`

## 11.7 x2APIC and the EIME dependency

This is the coupling that makes interrupt remapping a prerequisite rather than an optimisation on
large systems: an 8-bit destination field cannot address a 32-bit APIC ID space.

- **Claim.** When IRTA_REG.EIME is 0, xAPIC mode is active and hardware interprets only bits 15:8 of the Destination-ID field in IRTEs, treating the high 16 bits and low 8 bits as reserved.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** When IRTA_REG.EIME is 1, x2APIC mode is active and hardware interprets all 32 bits of the Destination-ID field in IRTEs.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** EIME is implemented as RsvdZ on implementations reporting ECAP_REG.EIM as Clear.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** Software must program EIME as Set on implementations reporting Extended Interrupt Mode Enable Required (EIMER) as Set in the Extended Capability Register.  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** Software must not modify EIME while interrupt remapping is active (GSTS_REG.IRES = 1).  `[VT-d 5.20 §11.4.10]` `[8]` `C:high` `V:durable`
- **Claim.** If EIMER is reported Set and Extended Interrupt Mode is disabled, all interrupt requests are blocked.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** Programming remapping hardware event interrupts differs between Intel 64 xAPIC mode (§5.1.6.1) and Intel 64 x2APIC mode (§5.1.6.2).  `[VT-d 5.20 §5.1.6]` `[8]` `C:high` `V:durable`

## 11.8 The enable handshake

Enabling interrupt remapping is a two-step, one-shot-then-latch sequence on GCMD_REG. The
register-level rules, including the 96FFFFFFh one-shot mask, are in `10-vtd-dma-remapping.md`
§10.5.3; what matters here is the order.

1. Program IRTA_REG with the table base, the size field S, and EIME.
2. Set GCMD_REG.SIRTP (bit 24); wait for GSTS_REG.IRTPS (bit 24).
3. Invalidate the interrupt entry cache with an `iec_inv_dsc` global invalidation.
4. Set GCMD_REG.IRE (bit 25); wait for GSTS_REG.IRES (bit 25).
5. Optionally clear GCMD_REG.CFI (bit 23) to block compatibility-format interrupts; observe
   GSTS_REG.CFIS.

- **Claim.** SIRTP is GCMD_REG bit 24 and its completion is reported by GSTS_REG.IRTPS at bit 24; IRE is GCMD_REG bit 25 and its status IRES is GSTS_REG bit 25.  `[VT-d 5.20 §11.4.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** CFI is GCMD_REG bit 23 and CFIS is GSTS_REG bit 23, controlling and reporting whether compatibility-format interrupts are permitted.  `[VT-d 5.20 §11.4.4.2]` `[8]` `C:high` `V:durable`
- **Claim.** The Set Interrupt Remapping Table Pointer operation is specified in VT-d §6.7, and hardware reporting ESIRTPS (CAP_REG bit 62) performs an implicit invalidation as part of that operation.  `[VT-d 5.20 §6.7]` `[8]` `C:medium` `V:durable`
- **Claim.** The interrupt entry cache is described in VT-d §6.4 and is invalidated using the Interrupt Entry Cache Invalidate Descriptor, type 4h, specified in §6.5.2.8.  `[VT-d 5.20 §6.4]` `[8]` `C:high` `V:durable`
- **Claim.** The maximum supported value for the Interrupt Mask (IM) field of the Interrupt Entry Cache Invalidate Descriptor is reported by ECAP_REG.MHMV at bits 23:20.  `[VT-d 5.20 §11.4.3]` `[8]` `C:high` `V:durable`
- **Claim.** Interrupt draining is specified in VT-d §6.5.5.  `[VT-d 5.20 §6.5.5]` `[8]` `C:high` `V:durable`

## 11.9 Hardware operation, step by step (§5.1.4)

- **Claim.** Hardware decodes requests to the address range FEEx_xxxxh as interrupt requests, and when Interrupt Remapping Required is reported Set (ECAP_REG.IRREQ = 1) with interrupt remapping disabled, the interrupt request is blocked.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** When ECAP_REG.IRREQ is Clear and interrupt remapping is not enabled, all interrupt requests are processed per the compatibility interrupt request format.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** For a remappable-format request hardware performs reserved-field checking, retrieves Source-id, Handle, SHV and Subhandle, computes and bounds-checks interrupt_index, then obtains the IRTE from the Interrupt Entry Cache or fetches it from the interrupt-remapping table.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** If ECAP_REG.C (Coherent) is reported Clear, IRTE fetches from memory do not snoop the processor caches.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware must read the entire IRTE as a single operation and must not use multiple reads, because software may change the contents of the IRTE atomically.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** Hardware implementations reporting MTS = 1 in ECAP_REG must use write-back memory type for IRTE fetches.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`
- **Claim.** If the Present field in the IRTE is Clear, the interrupt request is blocked and treated as a fault; source-id checking per SVT, SID and SQ follows the presence check, and failure blocks the request.  `[VT-d 5.20 §5.1.4]` `[8]` `C:high` `V:durable`

## 11.10 Interrupt-remapping fault reasons (§5.1.4.1)

Interrupt-remapping faults occupy their own numeric range, distinct from the DMA-remapping fault
reasons in `12-vtd-faults-bios-siov.md`. All of them are non-recoverable and the faulting request is
treated as an Unsupported Request.

| Fault reason | Condition | Qualified |
|---|---|---|
| 20h | Decoding of the request per the remappable format detected one or more reserved fields Set | No |
| 21h | interrupt_index exceeded the configured table size, or IRTE access referenced an address above HAW | No |
| 22h | The Present (P) field in the IRTE is Clear | Yes |
| 23h | Hardware access to the interrupt-remapping table through IRTA_REG resulted in error | No |
| 24h | Reserved fields not zero in an IRTE with P Set, including wrongly programmed conditional reserved fields | Yes |
| 25h | A Compatibility-format interrupt request was blocked (EIME Set, or CFIS Clear) | No |
| 26h | Source-id verification failure against SID, SVT and SQ in an IRTE with P Set | Yes |
| 27h | Hardware access to the posted descriptor via the PDAH/PDAL fields resulted in error | Yes |
| 28h | Reserved fields not zero in the posted descriptor | Yes |
| 29h | An untranslated request-without-PASID to FEEx_xxxxh that does not meet the requirements of a valid interrupt | No |
| 2Ah | EIME is 0 in IRTA_REG on an implementation reporting EIMER Set in ECAP_REG | No |
| 2Bh | An MSI request arrived while Interrupt Remapping is disabled on hardware reporting IRREQ Set in ECAP_REG | No |

- **Claim.** Interrupt-remapping fault reason 20h is detection of one or more reserved fields Set when decoding the request per the remappable format, and is not a qualified fault.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 21h covers an interrupt_index greater than the configured interrupt-remapping table size, or a hardware attempt to access the corresponding IRTE at an address above the Host Address Width.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 22h is a Clear Present field in the IRTE corresponding to the interrupt_index.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 23h is an error accessing the interrupt-remapping table through the IRTA field of IRTA_REG.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 24h is detection of one or more reserved fields not initialized to zero in an IRTE with the Present field Set, including conditional reserved fields programmed wrongly.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 25h is a blocked Compatibility-format interrupt request, either because EIME is Set in IRTA_REG or because CFIS is Clear in the Global Status Register.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 26h is a blocked Remappable interrupt request due to verification failure of the requester's source-id against the SID, SVT and SQ fields of an IRTE with P Set.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reasons 27h and 28h apply only to interrupt requests processed through IRTEs programmed for interrupt posting: 27h for an access error reaching the posted descriptor via the IRTE's address fields, 28h for non-zero reserved fields in that descriptor.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 29h is an untranslated request-without-PASID to the interrupt address range FEEx_xxxxh that does not meet all the requirements to be considered a valid interrupt.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 2Ah is an EIME value of 0 in IRTA_REG on an implementation reporting Extended Interrupt Mode Enable Required (EIMER) as Set in the Extended Capability Register.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Fault reason 2Bh is an MSI request received while Interrupt Remapping is disabled on remapping hardware reporting Interrupt Remapping Required (IRREQ) as Set in the Extended Capability Register.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** An interrupt-remapping fault condition is treated as qualified if it is reported to software only when the Fault Processing Disable (FPD) field is Clear in the IRTE used to process the faulting request.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`
- **Claim.** Interrupt translation faults are non-recoverable and the faulting interrupt request is treated as an Unsupported Request by the remapping hardware.  `[VT-d 5.20 §5.1.4.1]` `[8]` `C:high` `V:durable`

## 11.11 Programming the interrupt sources

An IRTE is useless until some device is told to emit a remappable-format request that indexes it.
Both routes scatter the 16-bit index across non-adjacent fields.

### 11.11.1 I/OxAPIC Redirection Table Entries (§5.1.5.1)

- **Claim.** VT-d §5.1.5 specifies how to program interrupt sources to generate remappable interrupts, with I/OxAPIC programming in §5.1.5.1 and MSI/MSI-X register programming in §5.1.5.2.  `[VT-d 5.20 §5.1.5]` `[8]` `C:high` `V:durable`
- **Claim.** In an I/OxAPIC Redirection Table Entry programmed for remapping, the most significant bit of the interrupt index, Interrupt_Index[15], is programmed in bit 11 of the RTE.  `[VT-d 5.20 §5.1.5.1]` `[8]` `C:high` `V:durable`
- **Claim.** In the same RTE, Figure 5-3 places the Interrupt Format field (programmed to 1b) at bit 48 and Interrupt_Index[14:0] at bits 63:49, with the Vector remaining at bits 7:0.  `[VT-d 5.20 §5.1.5.1]` `[8]` `C:medium` `V:durable`
- **Claim.** The Trigger Mode field programmed in an I/OxAPIC RTE must match the Trigger Mode field in the IRTE it references, which is required for proper functioning of level-triggered interrupts.  `[VT-d 5.20 §5.1.5.1]` `[8]` `C:high` `V:durable`
- **Claim.** For level-triggered interrupts, the Vector field programmed in the I/OxAPIC RTE must match the Vector field programmed in the referenced IRTE, which is required for correct processing of the End-Of-Interrupt broadcast by the I/OxAPIC.  `[VT-d 5.20 §5.1.5.1]` `[8]` `C:high` `V:durable`

### 11.11.2 MSI and MSI-X registers (§5.1.5.2)

- **Claim.** To generate remappable interrupts from MSI or MSI-X, software programs address bits 31:20 with 0FEEh, sets the Interrupt Format field and the SHV field, and places Interrupt_Index[14:0] and Interrupt_Index[15] in the remaining address fields defined by the remappable format.  `[VT-d 5.20 §5.1.5.2]` `[8]` `C:high` `V:durable`
- **Claim.** The Interrupt_Index programmed into an MSI or MSI-X address is the index of the IRTE that remaps the corresponding interrupt requests.  `[VT-d 5.20 §5.1.5.2]` `[8]` `C:high` `V:durable`
- **Claim.** Devices supporting MSI allow software to enable multiple vectors, up to 32, in powers of two, which is why the Subhandle mechanism exists.  `[VT-d 5.20 §5.1.5.2]` `[8]` `C:high` `V:durable`

### 11.11.3 The remapping hardware's own interrupts

- **Claim.** Programming of remapping hardware event interrupts is specified in VT-d §5.1.6, and handling of platform events in §5.1.7.  `[VT-d 5.20 §5.1.6]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d §5.3 summarizes memory type and snoop behaviour for interrupt-remapping structures.  `[VT-d 5.20 §5.3]` `[8]` `C:high` `V:durable`

### 11.11.4 Interrupt migration in practice

Because every attribute that used to live in the device's MSI registers now lives in the IRTE, moving
an interrupt to a different CPU is a single 128-bit store plus an interrupt-entry-cache invalidation —
the device is never touched and never knows.

- **Claim.** The remappable interrupt format specifies only the fields needed to compute the interrupt_index; all other attributes of the remapped request come from the IRTE, which is what decouples interrupt attributes from the device programming.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** The interrupt-remapping architecture defines hardware caching of frequently used IRTEs, and defines invalidation commands for the interrupt entry cache precisely so that software can update an IRTE dynamically.  `[VT-d 5.20 §5.1.3]` `[8]` `C:high` `V:durable`

## 11.12 Pitfalls

1. **Handle[15] is at address bit 2, not adjacent to the other handle bits.** Software that builds the
   MSI address by shifting a 16-bit handle left by 5 silently loses the top bit for handles ≥ 0x8000.
2. **IRTA_REG.S is a log2-minus-one.** Entries = 2^(S+1), so S = 0 means two entries, not one.
3. **Bit 15 (IM) reinterprets the whole entry.** Reading a posted IRTE with remapped-format field
   offsets yields a plausible-looking but wrong vector and destination.
4. **The posted-format vector is a *virtual* vector used as a bit index**, not a vector delivered on
   the bus. Confusing the two is the most common error in secondary descriptions of posting.
5. **Nothing in IRTA_REG takes effect until SIRTP.** Writing the register alone changes no behaviour,
   and modifying EIME while IRES = 1 is explicitly forbidden.
6. **Do not restate posted-interrupt descriptor semantics here.** PIR, ON, SN, NV and NDST belong to
   `07-apic-virtualization.md`; this chapter stops at the address the IRTE hands over.
