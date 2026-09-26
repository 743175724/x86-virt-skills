# 09. AMD-Vi: Translation Tables, Commands and ACPI

> **中文速览**：本章是"我要建的表"：host（v1）与 guest（v2）I/O 页表的格式、GCR3 表、每条命令的 opcode 与字段布局、以及 IVRS 的解析（表头、IVHD 类型、设备条目长度规则、IVMD 类型码）。末尾有一节把这些串起来：**端到端解一个 `IO_PAGE_FAULT`**——那是最常见的真实任务，也是旧版最难回答的问题。寄存器与日志条目格式在 `08`。

**Maps to:** IOMMU 48882-PUB Rev 3.11: §2.2.3 (host tables) · §2.2.6 (guest) · §2.2.7 (guest/nested) · §2.4 (commands) · §5.2 (IVRS) · §5.3 (IVHD) [7]
**Owns:** v1 and v2 I/O page tables · GCR3 tables · command formats and opcodes · IVRS parsing · the end-to-end IO_PAGE_FAULT walkthrough
**Scope:** OS-independent hardware
**See also:** `08-iommu-architecture.md` (registers, DTE, log formats) · `10-iommu-interrupt-remapping.md`

---

## 9.1 Host I/O page tables (v1)

The host (v1) format is a generalisation of AMD64 long-mode paging with two additions the processor
does not have: a level field in every directory entry, which lets a walk *skip* levels, and a page-size
override in the translation entry, which lets one entry describe a page that is not a power-of-512
multiple of 4 Kbytes.

- **Claim.** The host I/O page tables are a multi-level tree of 4-Kbyte tables indexed by 9 virtual-address bits per level, holding 8-byte entries.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** A page table entry is a **page translation entry (PTE) when its Next Level field is 0h or 7h**, and a **page directory entry (PDE) for every other Next Level value**; there is no separate type bit.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU zero-fills high-order physical address bits: the architecture produces at most a 52-bit system physical address, so SPA bits 63:53 are always zero.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`

### The three entry shapes

| Bits | Not present (PR=0) | PTE (PR=1, NextLevel 0h/7h) | PDE (PR=1, NextLevel ≠ 0h/7h) |
|---|---|---|---|
| 63 | Ignored | Ignored | Ignored |
| 62 | Ignored | IW | IW |
| 61 | Ignored | IR | IR |
| 60 | Ignored | FC | Reserved |
| 59 | Ignored | U | Reserved |
| 58:57 | Ignored | Page Migration State[1:0] | Reserved |
| 56:52 | Ignored | Reserved | Reserved |
| 51:12 | Ignored | Page Address[51:12] | Next Table Address[51:12] |
| 11:9 | Ignored | NextLevel (0h or 7h) | NextLevel |
| 8:7 | Ignored | Ignored | Ignored |
| 6 | Ignored | D | Ignored |
| 5 | Ignored | A | A |
| 4:1 | Ignored | Ignored | Ignored |
| 0 | **PR = 0** | **PR = 1** | **PR = 1** |

- **Claim.** The table above is the complete layout of the three host I/O page table entry forms; when PR=0 the remaining 63 bits are ignored and the page is not present.  `[IOMMU 3.11 Table 16]` `[7]` `C:high` `V:durable`
- **Claim.** `IW`(62) and `IR`(61) are ANDed cumulatively down the walk together with the Device Table entry's own IW and IR, and the IW/IR of any **skipped** level are treated as 1 — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 17]` `[7]` `C:high` `V:durable`
- **Claim.** `FC`(60), Force Coherent, decides the source of the upstream coherent attribute for an untranslated DMA: 1 means the IOMMU sets it, 0 means it passes through the originating request's state, and the resulting value is returned to an ATS requester as the No-snoop bit.  `[IOMMU 3.11 Table 17]` `[7]` `C:high` `V:durable`
- **Claim.** `U`(59) is passed to a peripheral in an ATS response for a GPA-to-SPA translation only; for a GVA-to-SPA translation hardware must return U=0 in the ATS response — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 Table 17]` `[7][53]` `C:high` `V:durable`
- **Claim.** PTE bits 58:57 are the Page Migration State field when `EFR2[TMPMSup]`=1 and `Control[TMPMEn]`=1, and reserved otherwise; AMD documents their use in a separate Tiered Memory Page Migration operations guide, order #58151, which is not part of the IOMMU specification.  `[IOMMU 3.11 Table 17]` `[7][290]` `C:high` `V:durable`
- **Claim.** `A`(5) is set by the IOMMU on first read or write only when `EFR[HDSup]`=1 and DTE[HAD] is 01b or 11b; `D`(6) is set on first write only when `EFR[HDSup]`=1 and DTE[HAD]=11b. Neither bit is ever cleared by the IOMMU — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 17]` `[7]` `C:high` `V:durable`
- **Claim.** The PDE's Next Level value may not exceed the DTE[Mode] value of the device, and the maximum Next Level any directory entry may carry is bounded by `EFR[HATS]`; exceeding either limit causes an `IO_PAGE_FAULT`, as does a Next Level greater than or equal to the level of the table the entry was fetched from; the Mode field itself is in `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 18]` `[7]` `C:high` `V:durable`

### Levels, default page sizes and the size override

| Level | Virtual-address bits indexing the table | Default page size of a translation entry at that level |
|---|---|---|
| 6 | 63:57 | — |
| 5 | 56:48 | 2^48 |
| 4 | 47:39 | 2^39 |
| 3 | 38:30 | 2^30 (1 Gbyte) |
| 2 | 29:21 | 2^21 (2 Mbytes) |
| 1 | 20:12 | 4096 |

- **Claim.** The table above is the level parameter table: the index field width is always 9 bits except at level 6, which uses the 7 bits 63:57.  `[IOMMU 3.11 Table 15]` `[7]` `C:high` `V:durable`
- **Claim.** Setting **NextLevel = 7h in a translation entry overrides the default page size**: the page size is then determined by the position of the first zero bit in the page address starting from bit 12, and the resulting size must be larger than the level's default and smaller than the default of the next higher level.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** Address bits 51:32 can encode page sizes above 4 Gbytes, bits 63:52 are zero-extended, and two extremes are called out: a level-6 entry with page address 7_FFFFh covers the entire cache while F_FFFFh is undefined.  `[IOMMU 3.11 Table 14]` `[7]` `C:high` `V:durable`
- **Claim.** An oversize page requires the PTE to be **replicated**: the low virtual-address bits that now index inside the enlarged page can no longer uniquely index the page table, so for a 32-Kbyte page the level-1 PTE must be repeated 8 times, leaving 64 unique PTEs in a 4-Kbyte table.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`

### Walking, and what terminates a walk

- **Claim.** Translation starts by comparing the device virtual address against the root table's level; a non-zero bit above the range that level selects terminates the walk with an `IO_PAGE_FAULT`, and so does a non-zero bit in any virtual-address range belonging to a **skipped** level.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** A walk also terminates with an `IO_PAGE_FAULT` on a non-zero reserved bit in any entry, on a Next Level field greater than or equal to the current table's level, and on a translation entry whose physical address is not aligned to the page size that level implies.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** AMD strongly recommends, but does not require, that an implementation cache at least 4-Kbyte translations, and permits larger pages to be cached by splitting them into several 4-Kbyte cache entries.  `[IOMMU 3.11 §2.2.3]` `[7]` `C:high` `V:durable`
- **Claim.** Because the IOMMU's Next Level fields occupy bit positions the processor ignores, one set of AMD64 long-mode tables can serve both the CPU and the IOMMU provided those fields are initialised for each entry's level — the processor has no level-skipping facility of its own.  `[IOMMU 3.11 §2.2.3]` `[7][1]` `C:high` `V:durable`
- **Claim.** In the worked example AMD gives, a level-4 root whose level-3 index is zero points straight at a level-2 table (PDE Next Level = 2h), and a level-2 entry with Next Level = 0h terminates on a 2-Mbyte page with the low 21 address bits as the offset.  `[IOMMU 3.11 Figure 11]` `[7]` `C:high` `V:durable`

## 9.2 Guest I/O page tables (v2) and GCR3

Guest translation adds a second dimension. A request that arrives with a valid PASID is translated
GVA → GPA through *ordinary AMD64 long-mode page tables* owned by the guest, and every guest-physical
address produced along the way — including the table pointers themselves — is then translated GPA → SPA
through the v1 tables of §9.1.

- **Claim.** Guest address translation exists only when `EFR[GTSup]`=1, is armed globally by `Control[GTEn]` and per device by DTE[GV], and the depth of the GCR3 lookup is set by DTE[GLX] within the limit `EFR[GLXSup]` — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 24]` `[7]` `C:high` `V:durable`
- **Claim.** The guest page tables are directly compatible with the AMD64 long-mode format, and the IOMMU interprets PML5E, PML4E, PDPE, PDE and PTE exactly as the processor does.  `[IOMMU 3.11 §2.2.6.5]` `[7][1]` `C:high` `V:durable`
  > The processor-side definition of those entries is `[APM2 §5.3]` and `[APM2 §5.4.1]`; this chapter does not restate it.
- **Claim.** The guest address size is capped by `EFR[GATS]` and exceeding it generates an `IO_PAGE_FAULT`; with `GATS`=01b the start level is chosen per device by DTE[GuestPagingMode] (see `08-iommu-architecture.md`), and a level-5 guest table is indexed by GVA bits 56:48 to select the PML5E.  `[IOMMU 3.11 §2.2.6.4]` `[7]` `C:high` `V:durable`

### The GCR3 table

- **Claim.** The GCR3 table is the PASID-indexed array that turns a PASID into a guest page-table root; a one-level table is a single naturally aligned 4-Kbyte page holding 512 eight-byte entries, indexed by **PASID[8:0]**, and the IOMMU ignores the upper PASID bits when DTE[GLX]=00b — the GLX field is in `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** A GCR3 base pointer entry is `V`(0), Reserved(2:1), Ignored(4:3) — where the processor's PCD and PWT live, and which the IOMMU ignores — Reserved(11:5), Guest Page Table Pointer[51:12] and Reserved(63:52); when V=0 the whole entry is ignored by hardware.  `[IOMMU 3.11 Table 26]` `[7]` `C:high` `V:durable`
- **Claim.** With DTE[GLX]=01b the DTE points at a **GCR3 level-2 table indexed by PASID[17:9]** whose entries point at level-1 tables; with GLX=10b it points at a level-3 table **indexed by PASID[19:18]**, structurally identical to the level-2 table, and the IOMMU ignores the unused remainder of that level-3 table; DTE[GLX] itself is in `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** The maximum translatable PASID width follows from GLX: 9 bits with a one-level table, 18 with two levels and 20 with three; `EFR[PASmax]` separately bounds what the IOMMU can handle internally, so the two limits must both be satisfied.  `[IOMMU 3.11 Table 11]` `[7]` `C:high` `V:durable`
- **Claim.** Every GCR3 base pointer in a level-1 table, and every table pointer in a level-2 or level-3 table, is a **guest physical address** that the IOMMU must itself translate through the host tables.  `[IOMMU 3.11 §2.2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** The GCR3 table root pointer inside the Device Table entry is a system physical address when `Control[GCR3TRPMode]`=0 and a guest physical address, translated through the host tables named by DTE[Host Page Table Root Pointer], when it is 1; support is `EFR2[GCR3TRPModeSup]` — see `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** IOMMU TLBs are **not** cleared when a GCR3 table entry changes; software must issue an invalidation command.  `[IOMMU 3.11 §2.2.6.3]` `[7]` `C:high` `V:durable`
- **Claim.** Several GCR3 entries may point at the same guest page table, which is how a peripheral shares one guest address space between its default-PASID and non-zero-PASID traffic under Guest I/O Protection.  `[IOMMU 3.11 §2.2.9]` `[7]` `C:high` `V:durable`

### Combining the two dimensions

- **Claim.** There are exactly four operating combinations: V=0 (no translation or checking at all, and ATS and PRI requests fail); V=1, GV=0 (GPA-to-SPA only, with skip-levels, large pages and access control); V=1, GV=1, Mode=0 (GVA-to-GPA with the nested stage in pass-through, so GPA equals SPA); and V=1, GV=1 with both table sets programmed (full GVA-to-SPA).  `[IOMMU 3.11 §2.2.7.1]` `[7]` `C:high` `V:durable`
- **Claim.** Read and write permission for a guest translation is the AND of the guest page-table permission, the nested page-table permission and the DTE's IR/IW bit; executable (NX) and user/supervisor permission are **ignored** whenever the peripheral supplies a GPA or an SPA rather than a GVA — see `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.7.2]` `[7]` `C:high` `V:durable`
- **Claim.** No-execute enforcement requires `EFR[NXSup]`=1 and applies to a request whose PCIe TLP PASID prefix carries EXE; supervisor-page enforcement requires `EFR[USSup]`=1 and is governed by `Control[PrivAbrtEn]`, which either honours the prefix's PMR bit (00b) or blocks every user access regardless (01b).  `[IOMMU 3.11 §2.2.6.2]` `[7][53]` `C:high` `V:durable`
- **Claim.** When the IOMMU updates Accessed and Dirty bits in guest descriptors it uses processor-compatible interlocked 64-bit naturally aligned operations, and re-reads the descriptor inside the atomic region so that it can drop the update if another agent already made it.  `[IOMMU 3.11 §2.2.7.4]` `[7]` `C:high` `V:durable`
- **Claim.** Because the IOMMU must rewalk the guest tables whenever cached information says "denied", software is **not** required to invalidate when it *promotes* guest privileges or makes a not-present guest page present — but it **is** required to invalidate when it demotes privileges or unmaps a page.  `[IOMMU 3.11 §2.2.7.3]` `[7]` `C:high` `V:durable`
- **Claim.** The AMD64 memory-type bits (PAT) in guest page tables are ignored by the IOMMU when it is outside the coherence domain.  `[IOMMU 3.11 §2.2.7.3]` `[7]` `C:high` `V:durable`

## 9.3 The command buffer

- **Claim.** Software drives the IOMMU through a circular buffer of 128-bit commands in system memory: it writes commands, advances the tail pointer, and the IOMMU consumes them at its own pace.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`
- **Claim.** The buffer must be 4-Kbyte aligned, a multiple of 4 Kbytes long, and at most 32768 entries (512 Kbytes); its base and length live in MMIO 0008h, its head in 2000h and its tail in 2008h — see `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU fetches commands in FIFO order and must never re-fetch one, but it **may execute them concurrently**; `COMPLETION_WAIT` is the only synchronisation primitive.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`
- **Claim.** Writing the tail pointer to a value equal to or beyond the head after adding commands leaves IOMMU behaviour undefined, as does writing the head pointer while `Status[CmdBufRun]`=1 or setting either pointer beyond the length given by `ComLen`.  `[IOMMU 3.11 §3.4.15]` `[7]` `C:high` `V:durable`
- **Claim.** Restarting a halted command processor is a fixed five-step sequence: wait for `Status[CmdBufRun]`=0, clear `Control[CmdBufEn]`, reprogram base/head/tail as needed (optionally copying entries to a new buffer), then write `Control[CmdBufEn]`=1 with `ComWaitIntEn` as desired.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`

### Ordering rules

- **Claim.** On receiving `INVALIDATE_IOMMU_PAGES` or `INVALIDATE_INTERRUPT_TABLE`, the IOMMU must first complete every cache invalidation belonging to earlier `INVALIDATE_DEVTAB_ENTRY` commands; on receiving `INVALIDATE_IOTLB_PAGES` it must first complete both earlier `INVALIDATE_DEVTAB_ENTRY` and earlier `INVALIDATE_IOMMU_PAGES` work.  `[IOMMU 3.11 §2.4.11.1]` `[7]` `C:high` `V:durable`
- **Claim.** An invalidation is complete only when no DMA relying on the pre-invalidation cache contents can still be in flight: read responses for all matching outstanding DMA reads must have arrived, and already-translated DMA writes must have been pushed to the host bridge with an upstream Fence, plus a Fence-then-Flush on the isochronous channel when both channels are in use.  `[IOMMU 3.11 §2.4.11.2]` `[7]` `C:high` `V:durable`
- **Claim.** The canonical teardown order for a domain is: update the in-memory structures, `INVALIDATE_DEVTAB_ENTRY` for every device, `INVALIDATE_IOMMU_PAGES` for the domain, `INVALIDATE_IOTLB_PAGES` for every IOTLB-capable device, then `COMPLETION_WAIT`.  `[IOMMU 3.11 §2.4.4]` `[7]` `C:high` `V:durable`

## 9.4 Command formats

- **Claim.** Every command is a 4-bit opcode plus a 60-bit and a 64-bit operand — 128 bits, 16 bytes — with the opcode occupying **bits 31:28 of dword +04** of the record.  `[IOMMU 3.11 Figure 43]` `[7]` `C:high` `V:durable`

| Opcode | Command | § |
|---|---|---|
| 01h | `COMPLETION_WAIT` | 2.4.1 |
| 02h | `INVALIDATE_DEVTAB_ENTRY` | 2.4.2 |
| 03h | `INVALIDATE_IOMMU_PAGES` | 2.4.3 |
| 04h | `INVALIDATE_IOTLB_PAGES` | 2.4.4 |
| 05h | `INVALIDATE_INTERRUPT_TABLE` | 2.4.5 |
| 06h | `PREFETCH_IOMMU_PAGES` | 2.4.6 |
| 07h | `COMPLETE_PPR_REQUEST` | 2.4.7 |
| 08h | `INVALIDATE_IOMMU_ALL` | 2.4.8 |
| 09h | `INSERT_GUEST_EVENT` | 2.4.9 |
| 0Ah | `RESET_VMMIO` | 2.4.10 |

- **Claim.** Rev 3.11 defines ten command opcodes, 01h through 0Ah, as listed above.  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`

### 01h COMPLETION_WAIT

| Dword | Bits | Field |
|---|---|---|
| +00 | 31:3 | Store Address[31:3] |
| +00 | 2 | `f` — flush queue |
| +00 | 1 | `i` — completion interrupt |
| +00 | 0 | `s` — completion store |
| +04 | 31:28 | 01h |
| +04 | 27:20 | Reserved |
| +04 | 19:0 | Store Address[51:32] |
| +08 / +12 | 31:0 | Store Data[31:0] / Store Data[63:32] |

- **Claim.** The table above is the `COMPLETION_WAIT` layout; `s`=1 makes the IOMMU write the 64-bit Store Data to the Store Address, `i`=1 makes it set `Status[ComWaitInt]`, and both may be set in the same command.  `[IOMMU 3.11 Table 34]` `[7]` `C:high` `V:durable`
- **Claim.** `f`=0 lets the IOMMU begin executing later independent commands while the wait is outstanding; `f`=1 forces strict in-order execution until the `COMPLETION_WAIT` finishes.  `[IOMMU 3.11 Table 34]` `[7]` `C:high` `V:durable`
- **Claim.** The completion store must target system memory, must be coherent, must not use the isochronous channel, and hardware must not set the PassPW bit when performing it.  `[IOMMU 3.11 Table 34]` `[7]` `C:high` `V:durable`
- **Claim.** On an SNP-enabled system the store address of a host `COMPLETION_WAIT` must fall inside the Completion Store Base/Limit window — the repurposed exclusion-range registers — and that window is marked immutable in the reverse map so the CPU can read it but not write it.  `[IOMMU 3.11 §2.12.2.2]` `[7]` `C:high` `V:durable`
- **Claim.** A `COMPLETION_WAIT` may wait for earlier `COMPLETION_WAIT` commands to finish as well; only when there is no earlier one in the buffer is it guaranteed to finish immediately after all older commands.  `[IOMMU 3.11 §2.4.1]` `[7]` `C:high` `V:durable`

### 02h INVALIDATE_DEVTAB_ENTRY and 05h INVALIDATE_INTERRUPT_TABLE

- **Claim.** Both commands have the same minimal shape — `DeviceID[15:0]` at +00 bits 15:0, the opcode at +04 bits 31:28, everything else reserved — and both act on a single DeviceID.  `[IOMMU 3.11 Table 35]` `[7]` `C:high` `V:durable`
- **Claim.** `INVALIDATE_INTERRUPT_TABLE` discards all cached interrupt information for the device including the cached guest virtual APIC table base pointer — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.4.5]` `[7]` `C:high` `V:durable`
- **Claim.** After invalidating the Device Table entry of an IOTLB-capable device (`08-iommu-architecture.md`), software should immediately follow with an `INVALIDATE_IOTLB_PAGES` for the same DeviceID sized to cover the whole 64-bit address space; for a multi-function device that clears only the named function.  `[IOMMU 3.11 §2.4.2]` `[7]` `C:high` `V:durable`

### 03h INVALIDATE_IOMMU_PAGES

| Dword | Bits | Field |
|---|---|---|
| +00 | 31:20 | Reserved |
| +00 | 19:0 | PASID[19:0] |
| +04 | 31:28 | 03h |
| +04 | 27:16 | Reserved |
| +04 | 15:0 | DomainID[15:0] |
| +08 | 31:12 | Address[31:12] |
| +08 | 11:3 | Reserved |
| +08 | 2 | `GN` — guest / nested |
| +08 | 1 | `PDE` — also flush directory entries |
| +08 | 0 | `S` — size |
| +12 | 31:0 | Address[63:32] |

- **Claim.** The table above is the `INVALIDATE_IOMMU_PAGES` layout; `S`=0 invalidates 4 Kbytes and `S`=1 makes the size the position of the first zero bit in the address starting at bit 12, using the same encoding as the page-size override.  `[IOMMU 3.11 Table 36]` `[7]` `C:high` `V:durable`
- **Claim.** `GN`=0 means the address is a GPA, so matching nested translations are invalidated and **all** guest translations in the domain must go too if guest translation is active for any device in it; `GN`=1 means the address is a GVA and only guest translations for the named PASID are invalidated, with no nested translations touched.  `[IOMMU 3.11 Table 36]` `[7]` `C:high` `V:durable`
- **Claim.** `PDE`=1 additionally flushes cached page directory entries, and when GN=1 it is the guest PDEs and PTE that are invalidated while the nested/host PDE is ignored.  `[IOMMU 3.11 Table 36]` `[7]` `C:high` `V:durable`
- **Claim.** To invalidate one process address space, AMD prescribes GN=1, PDE=1, S=1 and `Address[63:12]` = 7_FFFF_FFFF_FFFFh with the PASID and DomainID set; the same address with S=1, PDE=1 and GN=0 invalidates everything in the domain at both nested and guest levels.  `[IOMMU 3.11 §2.4.3]` `[7]` `C:high` `V:durable`
- **Claim.** The size of each invalidation must be greater than or equal to the largest page being invalidated, and an implementation is free to invalidate more than asked, up to its entire translation cache.  `[IOMMU 3.11 §2.4.3]` `[7]` `C:high` `V:durable`

### 04h INVALIDATE_IOTLB_PAGES

| Dword | Bits | Field |
|---|---|---|
| +00 | 31:24 | Maxpend[7:0] |
| +00 | 23:16 | PASID[15:8] |
| +00 | 15:0 | DeviceID[15:0] |
| +04 | 31:28 | 04h |
| +04 | 27:24 | PASID[19:16] |
| +04 | 23:16 | PASID[7:0] |
| +04 | 15:0 | QueueID[15:0] |
| +08 | 31:12 | Address[31:12] |
| +08 | 11:6 | Reserved |
| +08 | 5:4 | `Type` |
| +08 | 3 | Reserved |
| +08 | 2 | `GN` |
| +08 | 1 | Reserved |
| +08 | 0 | `S` |
| +12 | 31:0 | Address[63:32] |

- **Claim.** The table above is the `INVALIDATE_IOTLB_PAGES` layout — note that the 20-bit PASID is split across three discontiguous fields.  `[IOMMU 3.11 Table 37]` `[7]` `C:high` `V:durable`
- **Claim.** This command exists only where remote IOTLB caching is supported (`Capability Offset 00h[IotlbSup]`), and the IOMMU does **not** check DTE[I] before forwarding the invalidation to the peripheral — see `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.4.4]` `[7]` `C:high` `V:durable`
- **Claim.** `Type[5:4]` selects 00b standard ATS invalidation, 01b invalidate the range without flushing dependent transactions, 10b invalidate the range and flush all outstanding transactions including ones outside it, 11b reserved; it must be 00b when `EFR[InvIotlbTypeSup]`=0, and how a device advertises 01b/10b support is outside the specification.  `[IOMMU 3.11 Table 37]` `[7]` `C:high` `V:durable`
- **Claim.** To clear an entire IOTLB, set S=1 with `Address[63:32]` = 7FFF_FFFFh and `Address[31:12]` = F_FFFFh; `Address[63:32]` = FFFF_FFFFh leaves IOMMU behaviour undefined.  `[IOMMU 3.11 Table 37]` `[7]` `C:high` `V:durable`
- **Claim.** `QueueID` exists because several functions of a multi-function device may share one invalidation queue, so flow control cannot be tracked per DeviceID; `Maxpend` caps how many invalidations the IOMMU keeps in flight against one QueueID and its correct value comes from the device's IOTLB capability.  `[IOMMU 3.11 Table 37]` `[7][53]` `C:high` `V:durable`
- **Claim.** When GN=0 the GPA is sent to the peripheral with no TLP prefix and PASID[15:0] is ignored; when GN=1 the GVA is sent using the PASID TLP prefix.  `[IOMMU 3.11 §2.4.4]` `[7][53]` `C:high` `V:durable`

### 06h PREFETCH_IOMMU_PAGES

| Dword | Bits | Field |
|---|---|---|
| +00 | 31:24 | PFCount[7:0] |
| +00 | 23:16 | Reserved |
| +00 | 15:0 | DeviceID[15:0] |
| +04 | 31:28 | 06h |
| +04 | 27:20 | Reserved |
| +04 | 19:0 | PASID[19:0] |
| +08 | 31:12 | Address[31:12] |
| +08 | 11:5 | Reserved |
| +08 | 4 | `Inval` — invalidate first |
| +08 | 3 | Reserved |
| +08 | 2 | `GN` |
| +08 | 1 | Reserved |
| +08 | 0 | `S` |
| +12 | 31:0 | Address[63:32] |

- **Claim.** The table above is the `PREFETCH_IOMMU_PAGES` layout; the command is advisory, `PFCount`=00h is treated as one translation, and the command is reserved and raises `ILLEGAL_COMMAND_ERROR` when `EFR[PreFSup]`=0.  `[IOMMU 3.11 Table 39]` `[7]` `C:high` `V:durable`
- **Claim.** `GN`=1 is **reserved** for this command — software must program GN=0 and supply a GPA, and hardware ignores the bit; `Inval`=1 turns the command into an invalidation followed by a prefetch, and while the prefetch half may be ignored the invalidation half is mandatory.  `[IOMMU 3.11 Table 39]` `[7]` `C:high` `V:durable`
- **Claim.** A prefetch never reports an `IO_PAGE_FAULT` and never reports an access violation, because it carries no read/write/execute intent and because not-valid and not-present entries are not cached at all; those errors surface later, when a real peripheral transaction rewalks the tables.  `[IOMMU 3.11 §2.4.6.1]` `[7]` `C:high` `V:durable`
- **Claim.** A `COMPLETION_WAIT` may treat a `PREFETCH_IOMMU_PAGES` with `Inval`=0 as complete immediately when the hint is ignored, but must not signal completion before a prefetch with `Inval`=1 has completed.  `[IOMMU 3.11 §2.4.6.1]` `[7]` `C:high` `V:durable`

### 07h COMPLETE_PPR_REQUEST

| Dword | Bits | Field |
|---|---|---|
| +00 | 31:16 | Reserved |
| +00 | 15:0 | DeviceID[15:0] |
| +04 | 31:28 | 07h |
| +04 | 27:20 | Reserved |
| +04 | 19:0 | PASID[19:0] |
| +08 | 31:3 | Reserved |
| +08 | 2 | `GN` |
| +08 | 1:0 | Reserved |
| +12 | 31:16 | Reserved |
| +12 | 15:0 | CompletionTag[15:0] |

- **Claim.** The table above is the `COMPLETE_PPR_REQUEST` layout; for PCIe, `CompletionTag[15:12]` is the PRI Response Code, `CompletionTag[11:9]` must be zero and `CompletionTag[8:0]` is the PRI Page Request Group index taken verbatim from the `PPRtag` of the logged request — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 40]` `[7][53]` `C:high` `V:durable`
- **Claim.** The IOMMU does not validate the CompletionTag; with GN=1 it inserts the PASID into the PCIe TLP prefix and with GN=0 it inserts no prefix at all.  `[IOMMU 3.11 §2.4.7]` `[7]` `C:high` `V:durable`
- **Claim.** An error while processing this command is reported as an `INVALID_PPR_REQUEST` event rather than as a command error, and the command itself is reserved — raising `ILLEGAL_COMMAND_ERROR` — when `EFR[PPRSup]`=0.  `[IOMMU 3.11 §2.4.7]` `[7]` `C:high` `V:durable`

### 08h INVALIDATE_IOMMU_ALL, 09h INSERT_GUEST_EVENT, 0Ah RESET_VMMIO

- **Claim.** `INVALIDATE_IOMMU_ALL` carries nothing but its opcode at +04 bits 31:28 and clears every cached Device Table portion, GCR3 entry, page directory entry, page table entry and interrupt remapping entry for all DeviceIDs and all domains; it is gated on `EFR[IASup]` and raises `ILLEGAL_COMMAND_ERROR` otherwise.  `[IOMMU 3.11 Table 41]` `[7]` `C:high` `V:durable`
- **Claim.** `INVALIDATE_IOMMU_ALL` leaves operational status untouched — translations, event and PPR processing continue, outstanding walk results are discarded, pending Accessed/Dirty updates complete normally, and the only register it changes is the command head pointer; it does **not** flush any remote IOTLB.  `[IOMMU 3.11 §2.4.8]` `[7]` `C:high` `V:durable`
- **Claim.** `INVALIDATE_IOMMU_ALL` is not supported in a guest command buffer; AMD advises the hypervisor to emulate a guest IOMMU with `IASup`=0, and a guest issuing it gets `ILLEGAL_COMMAND_ERROR`.  `[IOMMU 3.11 §2.4.8]` `[7]` `C:high` `V:durable`
- **Claim.** `INSERT_GUEST_EVENT` (09h) is always written as a **pair** — the command followed immediately by a guest event entry, consuming two command-buffer slots — and injects that entry into the event log of the guest named by `GuestID[15:0]`; the IOMMU does not validate the injected entry.  `[IOMMU 3.11 §2.4.9]` `[7]` `C:high` `V:durable`
- **Claim.** `INSERT_GUEST_EVENT` requires `EFR[vIommuSup]`=1 and `Control[vIommuEn]`=1, is legal only in the host command buffer, and raises `ILLEGAL_COMMAND_ERROR` if it appears in a virtualized guest command buffer.  `[IOMMU 3.11 §2.4.9]` `[7]` `C:high` `V:durable`
- **Claim.** `RESET_VMMIO` (0Ah) carries `GuestID[15:0]` at +00 bits 15:0, `All`(27) to reset the whole virtual IOMMU for that guest — which also clears `VMVld` in VF Control MMIO offset 10h — and `VCmd`(31) to reset only that guest's virtual command buffer.  `[IOMMU 3.11 §2.4.10]` `[7]` `C:high` `V:durable`
- **Claim.** After a vIOMMU fault the IOMMU may clear `vCmdRun` alone or both `vCmdRun` and `vIommuRun`; software must clear and then re-set the matching `vIommuEn`/`vCmdEn` bits to restart, and must reprogram the guest's VF Control registers before resuming that guest.  `[IOMMU 3.11 §2.4.10]` `[7]` `C:high` `V:durable`

## 9.5 The ACPI IVRS table

Nothing above is discoverable by probing. How many IOMMUs exist, where their register windows are,
which DeviceIDs each one serves, and which DTE bits firmware wants set for which device — all of it
arrives in one ACPI table, and firmware's word overrides the hardware registers.

- **Claim.** The I/O Virtualization Reporting Structure (IVRS) is the single ACPI table describing every IOMMU in a platform, and AMD states that information conveyed in the IVRS **overrides** the corresponding information available from the IOMMU hardware registers — system software is required to honour the ACPI settings.  `[IOMMU 3.11 Ch.5]` `[7][54]` `C:high` `V:durable`
- **Claim.** On Windows the IVRS is read like any other ACPI table, through `EnumSystemFirmwareTables`/`GetSystemFirmwareTable` with the provider signature `'ACPI'` and the table ID being the four signature characters packed as a little-endian DWORD.  `[IOMMU 3.11 §5.2]` `[7][291][292]` `C:medium` `V:durable`

### Header

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Signature `"IVRS"` |
| 4 | 4 | Length of the whole structure including all definition blocks |
| 8 | 1 | Revision — 01h or 02h |
| 9 | 1 | Checksum |
| 10 | 6 | OEM ID |
| 16 | 8 | OEM Table ID |
| 24 | 4 | OEM Revision |
| 28 | 4 | Creator ID |
| 32 | 4 | Creator Revision |
| 36 | 4 | IVinfo |
| 40 | 8 | Reserved, must be zero |
| 48 | — | First I/O Virtualization Definition Block |

- **Claim.** The table above is the 48-byte IVRS header; Revision 01h permits only IVHD types 10h and 11h, Revision 02h additionally permits type 40h, and 03h–FFh are reserved. The IVRS Revision field is unrelated to the revision level of the IOMMU hardware.  `[IOMMU 3.11 Table 86]` `[7]` `C:high` `V:durable`
- **Claim.** `IVinfo` is `EFRSup`(0), a DMA-remap-support flag(1), Reserved(4:2), `GVAsize[7:5]`, `PAsize[14:8]`, `VAsize[21:15]`, `HtAtsResv`(22) and Reserved(31:23), each mirroring the identically named capability-block field — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 88]` `[7]` `C:high` `V:durable`
- **Claim.** When the DMA-remap-support flag is set, the platform must declare every ACPI device instance using an F0h device entry with a string UID, and no other ACPI device entry type is permitted — though PCI-style entries and ranges remain legal.  `[IOMMU 3.11 Table 88]` `[7]` `C:high` `V:durable`

### IVHD blocks

- **Claim.** Three IVHD types exist: 10h and 11h carry fixed-DeviceID entries only, 40h additionally carries ACPI HID named devices; 11h and 40h are reserved when `IVinfo[EFRSup]`=0, and each IOMMU in the platform is described by exactly one IVHD block containing at least one device entry.  `[IOMMU 3.11 §5.2.2.1]` `[7]` `C:high` `V:durable`
- **Claim.** All three types share the first 24 bytes: Type(0,1), Flags(1,1), Length(2,2), IOMMU DeviceID(4,2), Capability offset(6,2), IOMMU base address(8,8), PCI Segment Group(16,2), IOMMU info(18,2) and a 4-byte field at offset 20 — "IOMMU Feature Reporting" for type 10h, "IOMMU Attributes" for 11h and 40h.  `[IOMMU 3.11 Table 91]` `[7]` `C:high` `V:durable`
- **Claim.** A type 10h block's device entries begin at offset 24; a type 11h or 40h block inserts an 8-byte verbatim EFR image at offset 24 and an 8-byte EFR2 image at offset 32, so its device entries begin at offset 40.  `[IOMMU 3.11 Table 96]` `[7]` `C:high` `V:durable`
- **Claim.** The IVHD Flags byte is `HtTunEn`(0), `PassPW`(1), `ResPassPW`(2), `Isoc`(3), `IotlbSup`(4) and `Coherent`(5) — recommended settings for the matching Control-register bits, with `Coherent` recommended as 1 — plus `PreFSup`(6) and `PPRSup`(7) in type 10h only; bits 7 and 6 are reserved in types 11h and 40h.  `[IOMMU 3.11 Table 92]` `[7]` `C:high` `V:durable`
- **Claim.** The IOMMU info halfword at offset 18 is `MSInum[4:0]`, Reserved(7:5), `UnitID[12:8]` and Reserved(15:13).  `[IOMMU 3.11 Table 93]` `[7]` `C:high` `V:durable`
- **Claim.** A type 10h block's IOMMU Feature Reporting dword is `XTSup`(0), `NXSup`(1), `GTSup`(2), `GLXSup[4:3]`, `IASup`(5), `GASup`(6), `HESup`(7), `PASmax[12:8]`, `PNCounters[16:13]`, `PNBanks[22:17]`, `MsiNumPPR[27:23]`, `GATS[29:28]` and `HATS[31:30]`; it is reserved when `IVinfo[EFRSup]`=0.  `[IOMMU 3.11 Table 94]` `[7]` `C:high` `V:durable`
- **Claim.** A type 11h or 40h block's IOMMU Attributes dword is `HATDis`(0), Reserved, `PNCounters[16:13]`, `PNBanks[22:17]`, `MsiNumPPR[27:23]` and Reserved(31:28); `HATDis`=1 means host address translation is unsupported, `EFR[HATS]` is meaningless, and a non-zero host page table root pointer in a Device Table entry would raise `ILLEGAL_DEV_TABLE_ENTRY` — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 98]` `[7]` `C:high` `V:durable`
- **Claim.** On a type 10h block, performance-counter support has to be *derived*: `PNBanks` and `PNCounters` both zero means unsupported. A type 11h or 40h block answers it directly through its EFR image, which is why AMD recommends reading features from the type 11h block, then the type 10h block, and only then the MMIO registers.  `[IOMMU 3.11 §5.2.2.1]` `[IOMMU 3.11 §5.2]` `[7]` `C:high` `V:durable`

### Device entries

| Type range | Entry length |
|---|---|
| 00h–3Fh | 4 bytes |
| 40h–7Fh | 8 bytes |
| 80h–FFh | **variable length** |

- **Claim.** The device-entry length rule has exactly three classes as above: **there is no fixed 16-byte class**. Types 80h–FFh are variable-length and their size must be computed from the entry's own contents.  `[IOMMU 3.11 Table 103]` `[7]` `C:high` `V:durable`
  > This is `errata.md` E21. The "80h–BFh is 16 bytes" figure is an extrapolation from a kernel-side shift expression, not from the specification.
- **Claim.** The 4-byte entries are: type 0 **reserved** (not padding), 1 "All" — the setting applies to every DeviceID the IOMMU controls, 2 "Select" — one DeviceID, 3 "Start of range", 4 "End of range" (whose setting byte is 00h, the range inheriting the setting from the type 3 entry), and 05h–3Fh reserved.  `[IOMMU 3.11 Table 105]` `[7]` `C:high` `V:durable`
- **Claim.** The 8-byte entries are: 40h–41h reserved, 42h "Alias select", 43h "Alias start of range", 44h–45h reserved, 46h "Extended select", 47h "Extended start of range", 48h "Special device", 49h–7Fh reserved; an alias range and an extended range are both terminated by a 4-byte type 4 entry.  `[IOMMU 3.11 Table 107]` `[7]` `C:high` `V:durable`
- **Claim.** An alias entry carries the peripheral's own DeviceID in bytes 1–2 and the DeviceID it actually uses as source identification in bytes 5–6; when any alias entry is present the same IVHD may not also cover those peripherals with a type 1, 2 or 3 entry.  `[IOMMU 3.11 §5.2.2.1]` `[7]` `C:high` `V:durable`
- **Claim.** The one-byte DTE Setting carried by a device entry is `INITPass`(0), `EIntPass`(1), `NMIPass`(2), `ATCPermit`(3), `SysMgt[5:4]`, `Lint0Pass`(6) and `Lint1Pass`(7) — firmware telling software which DTE bits that device needs — see `08-iommu-architecture.md`.  `[IOMMU 3.11 Table 106]` `[7]` `C:high` `V:durable`
- **Claim.** The extended setting dword in a type 46h/47h entry — the second half of the per-device settings whose base byte is defined above and whose target fields live in `08-iommu-architecture.md` — is `CXLDevice[2:0]`, Reserved(30:3) and `AtsDisabled`(31), where `AtsDisabled`=1 means the device must be prevented from issuing address translation requests.  `[IOMMU 3.11 Table 108]` `[7]` `C:high` `V:durable`
- **Claim.** A type 48h special-device entry carries a Variety byte — 00h reserved, 01h IOAPIC, 02h HPET, 03h–FFh reserved — and a Handle that is the I/O APIC ID from the ACPI MADT or the HPET Number from the HPET table.  `[IOMMU 3.11 Table 109]` `[7][54]` `C:high` `V:durable`
- **Claim.** The type F0h ACPI HID entry is Type(0,1), DeviceID(1,2), settings byte(3,1) as above (`08-iommu-architecture.md`), HID(4,8), CID(12,8), Unique ID Format(20,1) — 0 absent, 1 integer, 2 character string — Unique ID Length(21,1) and the UID itself from offset 22; with no UID the entry is 22 bytes long.  `[IOMMU 3.11 Table 110]` `[7]` `C:high` `V:durable`
- **Claim.** An integer HID occupies the low 4 bytes of its 8-byte field with the upper 4 zero-padded; a string HID must be a valid 8-byte ACPI ID or a 7-byte PNP ID with the upper byte zero-padded; the CID is optional and zero when absent.  `[IOMMU 3.11 Table 110]` `[7][54]` `C:high` `V:durable`
- **Claim.** Every DeviceID an IOMMU serves must appear in its IVHD, including unpopulated ones — virtual functions and empty hot-plug slots — and the simplest legal IVRS is one range covering 0000h–FFFFh per IOMMU; a DeviceID that can never generate DMA or interrupts may be omitted, but a DeviceID used as an alias target may not.  `[IOMMU 3.11 §5.2.2.1]` `[7]` `C:high` `V:durable`
- **Claim.** In a mixed-format IVHD the fixed-length entries must all precede the variable-length ones, and ranges are ordered by treating the DeviceID as a plain 16-bit integer, so 0100h follows 00FFh.  `[IOMMU 3.11 §5.2.2.1]` `[7]` `C:high` `V:durable`

### IVMD blocks

- **Claim.** An IVMD describes a memory constraint and applies to the IVHD immediately preceding it; the three type codes are **20h = all peripherals, 21h = one specified DeviceID, 22h = a DeviceID range** whose end is carried in the auxiliary-data field.  `[IOMMU 3.11 Table 112]` `[7]` `C:high` `V:durable`
- **Claim.** Every IVMD block is 32 bytes: Type(0,1), Flags(1,1), Length(2,2)=32, DeviceID(4,2), Auxiliary data(6,2), PCI Segment Group(8,2), Reserved(10,6), Start address(16,8) as a system physical address and Memory block length(24,8).  `[IOMMU 3.11 Table 111]` `[7]` `C:high` `V:durable`
- **Claim.** The IVMD Flags byte is `Unity`(0) — the virtual address must equal the physical address — `IR`(1), `IW`(2), `ExclusionRange`(3) and Reserved(7:4); when `ExclusionRange`=1 the IR, IW and Unity bits are ignored.  `[IOMMU 3.11 Table 113]` `[7]` `C:high` `V:durable`
- **Claim.** To keep a memory range out of every peripheral address space entirely, firmware emits an IVMD of type 20h with IR=0 and IW=0; that combination also requires Unity=0.  `[IOMMU 3.11 §5.2.2.2]` `[7]` `C:high` `V:durable`

### The device-tree alternative

- **Claim.** For platforms where ACPI is not wanted, the same information may be supplied as an I/O Virtualization Device Tree with one `iommu@` node per IOMMU carrying `ivrs,revision`, `ivrs,ivinfo`, an `ivhd` child and optional `ivmd` children; the device entries are carried as raw byte arrays of 4, 8 or 22-plus bytes.  `[IOMMU 3.11 §5.3.1]` `[7]` `C:high` `V:durable`

## 9.6 Decoding an IO_PAGE_FAULT end to end

### First, the part people get wrong

- **Claim.** An `IO_PAGE_FAULT` is **not recoverable in the way a CPU page fault is**. The underlying data fabric and PCIe protocols give the IOMMU no way to tell a device to retry, so the IOMMU target-aborts the faulting request, sets the legacy PCI Signaled Target Abort bit where applicable, and logs the event. There is no faulting-access restart.  `[IOMMU 3.11 §2.1.3.2]` `[7]` `C:high` `V:durable`
- **Claim.** For an untranslated posted request the IOMMU gives the device no indication at all that the translation failed — a posted write has no completion to carry one — so the write is simply dropped; a non-posted request gets the abort as its completion status.  `[IOMMU 3.11 §1.1]` `[7][53]` `C:medium` `V:durable`
- **Claim.** An address translation request behaves differently on purpose: the IOMMU returns a translation-not-present response with R=W=0 and **creates no event log entry**, leaving the peripheral to decide what to do — which is the whole point of ATS and PRI — see `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.5.3]` `[7]` `C:high` `V:durable`

The practical consequence is the one that answers "why did my passed-through device die instead of
retrying": every page the device may ever touch has to be mapped before the device touches it. There
is no demand paging for a non-PRI device.

### The five Device Table bits in the fault path

Only five bits decide whether a fault is visible at all, and four of them live in the Device Table
entry described in `08-iommu-architecture.md`:

| Bit | Where | Effect on `IO_PAGE_FAULT` logging |
|---|---|---|
| `V`(0) | DTE | 0 → no translation happens, so no translation fault can be raised |
| `TV`(1) | DTE | 0 with V=1 → the walk is terminated; an untranslated non-interrupt transaction raises the fault |
| `SA`(98) | DTE | 1 → suppress **all** memory-side `IO_PAGE_FAULT` log entries for this device |
| `SE`(97) | DTE | 1 → log only the first fault while the DeviceID stays cached |
| `IG`(133) | DTE | 1 → suppress logging for interrupt-caused faults |

- **Claim.** `IO_PAGE_FAULT` logging is controlled by exactly the DTE's `SA`, `SE` and `IG` bits plus `SupIOPF` in the interrupt remapping table entry; `SA` and `SE` are ignored when V=0, neither affects interrupt or command-processing events, and `Control[SmiFLogEn]` controls SMI-filter faults independently of all four — see `08-iommu-architecture.md` and `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.5.3]` `[7]` `C:high` `V:durable`
- **Claim.** `SE`'s filtering depends on Device Table cache behaviour, so AMD warns software not to assume exactly one entry per device; the state behind it is cleared by an `INVALIDATE_DEVTAB_ENTRY` for that device or by the DeviceID being evicted from the cache.  `[IOMMU 3.11 Table 7]` `[7]` `C:high` `V:durable`

### Working a record

Take a 16-byte event record whose dword +04 is `2050_0000h` and whose dwords +08/+12 give the address.
The decode order is fixed:

1. **`EventCode`** = bits 31:28 of +04 = 2h → `IO_PAGE_FAULT`, so the record follows Figure 56 (§8.8).
2. **`DeviceID`** = bits 15:0 of +00. Convert with Bus[15:8] / Device[7:3] / Function[2:0] to locate the device, and use the same value as the index into the Device Table — through the segment base register if segmentation is enabled.
3. **`GN`** = bit 16 of +04. Here 0, so the faulting address is a guest physical address and `D/P[15:0]` is the **DomainID**, not a PASID.
4. **`PR`** = bit 20 of +04. Here 1: the page was marked present, so this is not a missing mapping.
5. **`PE`** = bit 22 and **`RW`** = bit 21. Here PE=1 and RW=0 — a *read* that the cumulative permissions denied. `PE` and `RZ` are only meaningful when PR=1.
6. **`RZ`** = bit 23. Here 0, so the failure was an invalid level encoding rather than a reserved bit — which points at DTE[Mode], at a PDE Next Level above `EFR[HATS]`, or at a Next Level not below its own table's level.
7. **`TR`** = bit 24 distinguishes a translation request from an ordinary transaction, and **`I`** = bit 19 an interrupt from a memory request.
8. **The address** in +08/+12 is the device virtual address the peripheral asked for — a GVA when GN=1, a GPA otherwise. Walk it with §9.1 or §9.2 as appropriate.

- **Claim.** The decode order above follows the field semantics of the `IO_PAGE_FAULT` record: `PR` gates the meaning of `PE` and `RZ`, `RW` is meaningful only when PR=1, TR=0 and I=0, and `GN` selects whether `D/P` is a DomainID or a PASID.  `[IOMMU 3.11 Table 57]` `[7]` `C:high` `V:durable`
- **Claim.** An interrupt transaction that arrives carrying a PASID is not allowed and is logged with I=1, GN=1 and the PASID in the `D/P` and `PASID[19:16]` fields — a combination that would otherwise look like a guest memory fault.  `[IOMMU 3.11 §2.5.3]` `[7]` `C:high` `V:durable`
- **Claim.** When an early-terminated walk produces the event, the reported information is whatever the completed part of the walk computed, starting from the Device Table entry — so a fault record can describe a DomainID and permissions derived from a walk that never reached a PTE — see `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.1.3]` `[7]` `C:high` `V:durable`
- **Claim.** AMD states that TLB caching behaviour for an entry that caused an event is undefined and that some implementations insert the entry before verifying it, so software should invalidate the address that caused the event.  `[IOMMU 3.11 §2.1.3]` `[7]` `C:high` `V:durable`
- **Claim.** The software causes enumerated for a memory-side `IO_PAGE_FAULT` are: a reserved paging mode in the Device Table entry (`08-iommu-architecture.md`), a PTE page-size encoding smaller or larger than that level's default, an invalid level encoding including one exceeding `EFR[GATS]` or `EFR[HATS]`, a non-zero address bit above the root level or in a skipped level, a non-zero reserved bit in a PTE, a clear valid bit, TV=0 on an untranslated non-interrupt transaction, a PASID outside `EFR[PASmax]`, and read, write, execute or supervisor permission violations.  `[IOMMU 3.11 Table 44]` `[7]` `C:high` `V:durable`

### Linux-only contrast

- **Claim.** The `AMD-Vi: Event logged [IO_PAGE_FAULT device=… domain=… address=… flags=…]` line is the Linux driver's rendering of this record, with `domain` being the `D/P` field and `flags` the bit field decoded in steps 3–7 above; it is a driver convention, not part of the hardware format.  `[IOMMU 3.11 Figure 56]` `[7][270]` `C:medium` `V:durable`

Windows exposes no comparable text log; the IVRS is read through the firmware-table API above, and
the platform-side story — Kernel DMA Protection, device assignment, what VBS requires — is in
`16-windows-platform.md`.

## 9.7 Open items

1. **`INSERT_GUEST_EVENT` has no field-definition table**, uniquely among the ten commands — §2.4.9 gives a figure and prose only. The figure is nonetheless unambiguous and reproduces identically under both `-layout` and `-raw`: opcode **09h at `+04` bits 31:28** and **`GuestID[15:0]` at `+04` bits 15:0**, which §9.4 states. What remains genuinely absent is a per-field description table of the kind every other command has, so the *semantics* of the remaining payload bytes are undocumented.
2. **`RESET_VMMIO`'s opcode field is printed as five bits.** Its field table lists "31:27 +04 = 0Ah" and "26:0 +04 Reserved", which both overlaps at bit 27 and contradicts the 4-bit opcode of the generic command format in §2.4. §9.4 follows the generic format.
3. **The IVMD block has two conflicting byte maps.** Table 111 places the PCI Segment Group at bytes 8–9 and Reserved at 10–15; Table 112 lists Reserved at offset 8 with size 8 *and* PCI Segment Group at offset 8 with size 2. §9.5 follows Table 111.
4. **Type 40h's Attributes dword double-assigns bit 0.** Table 102 lists "12:0 Reserved" and "0 HATDis" in the same table, where the equivalent Table 98 for type 11h correctly reads "12:1 Reserved".
5. **PDE bit 5 and PTE bit 6 have no "cleared by" agent.** The specification says the IOMMU never clears A or D and that software must clear them, and separately requires an invalidation when software does — but does not say what happens if software clears a bit the IOMMU is concurrently setting outside an atomic region. Only the IOMMU's own update path is specified as interlocked.
6. **The Tiered Memory Page Migration semantics of PTE[58:57] are out of scope here.** The IOMMU specification defines only when the bits stop being reserved and refers to order #58151, which is not part of the corpus behind this skill.
7. **`PREFETCH_IOMMU_PAGES` mentions a `Repl` bit that its own figure does not define.** §2.4.6 says "When Repl=1, the IOMMU is advised to replace an existing translation entry in the case of a cache conflict", but neither Figure 49 nor Table 39 contains a field of that name.
