# amd-virtualization — diagnosis set (20 questions)

Answered from the `amd-virtualization` skill only. Procedure: `SKILL.md` →
`references/00-quickref.md` §0.2 (symptom → chapter) → the one chapter it named
→ `errata.md` (SKILL.md step 3 requires it before writing).

---

### diag-svm-unavailable-chain
**Routed to:** `01-svm-intro.md` §1.5 (via §0.2 row "CPUID says SVM is present, `VMRUN` still fails") — correct route. §1.5's own "Failure symptoms, mapped back to the chain" table carries this exact symptom.

**Answer:** Two causes are possible, and they are distinguished in a fixed order.

**Step 0, and on a Windows PC do this first.** §1.5 puts it ahead of the hardware chain deliberately: read `Fn0000_0001_ECX[31]`, the hypervisor-present bit. If it is 1, a hypervisor already holds the processor and nothing in the hardware chain will explain anything — go to `16-windows-platform.md` §16.1. `[APM2 §15.2.2]` `[1]`

**The hardware cause.** `EFER.SVME` reading back 0 after a `#GP` on the `WRMSR` is stage 3 or 4 of AMD's own detection chain, and the discriminator is `VM_CR`:

- `VM_CR` is MSR `C001_0114h`; bit 3 is `LOCK` and bit 4 is `SVMDIS`. **While `SVMDIS` is set, writes to `EFER` treat `SVME` as MBZ** — which is precisely "the write faults / the bit reads back 0". `[APM2 Figure 15-27]`, `[APM2 §15.30.1]` `[1]`
- The trap is that **`VM_CR.SVMDIS` does not prevent CPUID from reporting SVM available**. That sentence is why the symptom exists at all: a BIOS-disabled machine passes the CPUID probe and fails at the `EFER` write. `[APM2 §15.30.1]` `[1]`
- Also note `EFER` itself: "attempting to set an enable bit in `EFER` for a feature the processor does not support results in a `#GP(0)`." `[APM2 §3.1.7]` `[1]`

**The chain to walk, which is AMD's own pseudocode** `[APM2 §15.4]` `[1]`:

1. `Fn8000_0001_ECX[2] == 0` → `SVM_NOT_AVAIL`. Nothing recoverable.
2. `VM_CR.SVMDIS == 0` → `SVM_ALLOWED`. Note the polarity: the *absence* of a disable, not the presence of an enable, clears the gate.
3. `SVMDIS == 1` and `Fn8000_000A_EDX[2] SVML == 0` → `SVM_DISABLED_AT_BIOS_NOT_UNLOCKABLE`. No key mechanism exists; only a firmware setting change helps. **This is the case behind almost every "enable SVM in BIOS" instruction.**
4. `SVMDIS == 1` and `SVML == 1` → `SVM_DISABLED_WITH_KEY`. SVM-Lock is present, so the block may be releasable with the 64-bit key through `SVM_KEY` (`C001_0118h`), obtained from platform firmware or the TPM.
5. Only then set `EFER.SVME` (`C000_0080h` bit 12), and set `VM_HSAVE_PA` (`C001_0117h`) before the first VMRUN.

**How to confirm, and the lock sub-case.** Read `VM_CR` back. If `SVMDIS = 1`, that is the cause. If you then try to clear it and cannot, read `LOCK`: while `VM_CR.LOCK` is set, **writes to `LOCK` and `SVMDIS` are silently ignored**, `LOCK` can only be cleared via `SVM_KEY`, and it is not affected by INIT or SKINIT. `SVM_KEY` is write-only (reads return zero); with `LOCK` set a write *compares* and clears `LOCK` only on a non-zero match — so **read `VM_CR.LOCK` back after writing `SVM_KEY` to find out whether the unlock succeeded**. If the key is zero while `LOCK` is one, only a processor reset clears it. `[APM2 §15.30.1]`, `[APM2 §15.31.1]` `[1]`

One further inversion worth knowing: setting `SVMDIS` while `EFER.SVME` is already 1 generates a `#GP` regardless of `LOCK`. `[APM2 §15.30.1]` `[1]`

**Confidence:** high. All the architectural claims are `C:high` `V:durable`. The Windows step-0 claim ("the chain lies here") is `C:medium` and is marked `[no-spec]` — the APM does not model a second hypervisor occupying host mode, so that row is diagnosed from the hypervisor-present bit and the platform, not from `VM_CR`.

---

### diag-exit-code-80h
**Routed to:** `05-exit-decoding.md` §5.1 (via §0.2 row "I have an exit code and do not know what it means") — correct route. `errata.md` E06 is the matching errata entry.

**Answer:** Your table is wrong, but AMD's sentence is not — and the fix is to correct your *reading* of it, not to correct AMD.

`80h` is right. **`80h` is `VMEXIT_VMRUN`.** `00h` is `VMEXIT_CR0_READ`. `[APM2 App.C]` `[1]`

The encoding is **segmented**, not a per-word bit index. Appendix C says intercept exit codes "are equal to the bit position of the corresponding flag in the VMCB's intercept vector" — where *the intercept vector* means **the six 32-bit words at offsets `000h` through `014h` read as one contiguous bit array**, not an index inside whichever single word the bit happens to live in. `[APM2 App.C]` `[1]`

Written arithmetically:

> `exit code = 32 × (vector number) + (bit position within that vector)`

which reproduces every band: vector 0 → CR reads `00h–0Fh` and CR writes `10h–1Fh`; vector 1 → DR reads `20h–2Fh`, DR writes `30h–3Fh`; vector 2 → exceptions `40h–5Fh`; vector 3 → `60h–7Fh`; vector 4 → `80h–9Fh`; vector 5 → `A0h–BFh`. `[APM2 App.C]` `[APM2 App.B]` `[1]`

The VMRUN intercept is **bit 0 of vector 4**, so `32 × 4 + 0 = 128 = 80h`. Reading the bit's index inside its own 32-bit word is the misconception, and it collapses five distinct bands onto one — every vector's bit 0 would come out as `00h`. `[APM2 App.C]` `[1]`, `errata.md` E06

**How to confirm:** check a second intercept in the same word. Vector 4 bit 1 is VMMCALL → `81h`, bit 2 VMLOAD → `82h`, bit 3 VMSAVE → `83h`. If those also arrive 80h-based, your decoder is off by the band, not by the bit. The same rule reduces for exceptions to `exit code = 40h + vector`, which is why §15.12 says the exception vector number can be derived from `EXITCODE` alone. `[APM2 App.C]` `[APM2 §15.12]` `[1]`

**Scope limit on the rule:** it does not extend past `BFh`. `400h`, `401h`, `402h`, `403h`, `407h` and the four negative codes are architectural exits and failure reports, not intercept-vector bits. `[APM2 App.C]` `[1]`

**Confidence:** high. `C:high` `V:durable` throughout. `errata.md` E06 additionally warns **not to over-correct** this — do not tell people AMD's Appendix C sentence is wrong; it is true under the contiguous-bit-array reading.

---

### diag-stale-guest-tlb
**Routed to:** `06-nested-paging.md` §6.8 (via §0.2 row "Guest TLB entries are stale after I changed a page table") — correct route.

**Answer:** You are missing the `TLB_CONTROL` field on the VMRUN that re-enters the guest. AMD tags TLB entries by ASID and does **not** invalidate them for you when you edit a nested page table.

**The field.** `TLB_CONTROL` is bits 39:32 of the VMCB control area at byte offset `058h`, immediately above the 32-bit guest ASID in bits 31:0 of the same qword. `[APM2 Table B-1]` `[1]` Its four encodings are the whole of Table 15-9, and the table explicitly states all other encodings are reserved `[APM2 Table 15-9]` `[1]`:

| Encoding | Function |
|---|---|
| `00h` | Do not flush |
| `01h` | Flush entire TLB — all entries, all ASIDs — on VMRUN. AMD says use only on legacy hardware |
| `03h` | Flush this guest's TLB entries |
| `07h` | Flush this guest's non-global TLB entries |

**The rule that applies to you.** A hypervisor that modifies a nested page table by **decreasing permissions, clearing present bits or changing translations**, and intends to re-enter the same ASID, should use TLB command `011b` or `001b` — **three or one, not seven**, because a downgrade can affect global entries too. `[APM2 §15.16.1]` `[1]`

**Three traps that produce exactly your symptom:**

1. **`07h` is not a substitute for `03h`.** It flushes only non-global entries; a downgraded global entry survives it.
2. **VMRUN reads `TLB_CONTROL` but does not change it**, so the hypervisor must reset it itself between entries — a stale `00h` left in the field silently skips the flush. `[APM2 §15.16.1]` `[1]`
3. **A reserved `TLB_CONTROL` value is not rejected.** VMRUN's published list of illegal state combinations does not include one, so software must not rely on being told. `[APM2 §15.5.1]` `[1]` `C:medium`

**Do not reach for `INVLPGA`.** Its address operand is **always interpreted as a guest virtual address**, and AMD states plainly that it **does not provide a means to invalidate a nested translation by guest physical address** — so it is a shadow-paging tool. Whole-ASID invalidation via `TLB_CONTROL`, not per-page `INVLPGA`, is the correct baseline once nested paging is on. `[APM2 §15.16.2]` `[1]`

**Check `FlushByAsid` first.** `03h` and `07h` are optional; support is `CPUID Fn8000_000A_EDX[FlushByAsid]`, **bit 6**. Without it, use `01h`. `[APM2 §15.16.1]` `[APM3 App.E]` `[2]`

**Other stale-translation causes in the same section, if the above is already right:**

- **Guest paging-mode change made by the VMM editing the VMCB** requires a flush; the state that counts is CR0 (PG, WP, CD, NW), CR3 (any bit), CR4 (PGE, PAE, PSE) and EFER (NXE, LMA, LME). `[APM2 §15.16]` `[1]`
- **If you intercepted a guest action that would have flushed the TLB, the `#VMEXIT` occurs and the TLB is not flushed** — the flush becomes your responsibility. `[APM2 §15.16.1]` `[1]`
- **vCPU migration between logical processors:** for non-SNP guests the hypervisor must ensure no stale translations are used; hardware only manages this itself for SNP-active guests. `[APM2 §15.36.15]` `[1]`
- **xAVIC special case:** when a core that last ran a different vCPU of the same VM runs a vCPU with xAVIC enabled, flush with `TLB_CONTROL = 3h` **regardless of the respective ASID values**, or stale mappings misdirect virtual APIC accesses to the previous vCPU's backing page. `[APM2 §15.29.4.3]` `[1]`
- **If you are on Hyper-V's nested path:** the TLFS `EnlightenedNptTlb` enlightenment works the opposite way round from the obvious reading — setting it to 1 means "ASID flushes do **not** affect TLB entries derived from the NPT; hypercalls must be used". A nested hypervisor that sets it and keeps flushing by ASID alone will leave stale nested translations. `[464]` (`16-windows-platform.md` §16.5.1)

**Confidence:** high for the architecture (`C:high` `V:durable`). The "reserved encoding is not rejected" claim is `C:medium`.

---

### diag-avic-incomplete-ipi
**Routed to:** `07-virtual-interrupts-avic.md` §7.2 (via §0.2 row "Interrupts stop being delivered to a guest vCPU") — correct chapter, though the decoding table is at §7.8.1 within it; `05-exit-decoding.md` §5.2 carries the same payload tables as the general owner.

**Answer:** `401h` is **`AVIC_INCOMPLETE_IPI`** — an IPI that could not be delivered to all targeted vCPUs, canonically because at least one target was not allocated to a physical core at the time. `[APM2 App.C]`, `[APM2 §15.29.9.1]` `[1]`

**How to decode it.** Two payloads:

- **`EXITINFO1`** holds the values written to the vAPIC ICR: **ICRH in bits 63:32, ICRL in bits 31:0**. `[APM2 §15.29.9]` `[APM2 Table 15-25]` `[1]`
- **`EXITINFO2`** holds the failure reason **`ID` in bits 63:32**, bits 31:12 reserved, and an **`Index` in bits 11:0 that is meaningful only for `ID` 1–3** and reserved otherwise. `[APM2 §15.29.9]` `[APM2 Table 15-26]` `[1]`

**The `ID` values — there are six, 0 through 5, not four** `[APM2 Table 15-27]` `[1]`:

| ID | Cause | Index |
|---|---|---|
| 0 | Invalid interrupt type — trigger mode was level, or the destination type is unsupported | Reserved |
| 1 | **IPI target not running** — `IsRunning` clear in the Physical APIC ID Table | Index of the physical/logical table entry for the unscheduled target |
| 2 | Invalid IPI target — not covered by the physical or logical ID table | Index of the entry for the invalid target |
| 3 | Invalid backing page pointer — the vAPIC Backing Page Pointer held an invalid physical address | Index into the physical table (shorthand/broadcast) or the logical/physical table per destination mode (directed) |
| 4 | Invalid IPI vector — **VEC < 16** | Reserved |
| 5 | Un-accelerated IPI — Destination Shorthand is not Self (Secure AVIC) | Reserved |
| > 5 | Reserved | Reserved |

`ID = 5` is the Secure AVIC path: in Secure AVIC mode an ICR write whose DSH is not Self traps out with this reason, and the Physical and Logical APIC ID tables are not used at all. `[APM2 §15.36.21]` `[1]`

**The likely cause of "repeatedly, and one vCPU has stopped receiving interrupts": `ID = 1` combined with a stale `IsRunning` bit.** The Physical APIC ID Table entry has `V` at bit 63, **`IR` (IsRunning) at bit 62**, Backing Page Pointer at 51:12 and Host Physical APIC ID at 11:0 — and the Host Physical APIC ID is **not valid unless `IR` is set**. `[APM2 Table 15-23]` `[1]` `IR` means only that the VMM has assigned a physical core to the vCPU. `[APM2 §15.29.5.2]` `[1]` The table is read by **both the core and the IOMMU**, which is why `IR` must be maintained on **every vCPU schedule and unschedule, not merely at VM creation**. `[APM2 §15.29.6.2]` `[1]` A hypervisor that fails to re-set `IR` when it reschedules a vCPU produces exactly this: repeated `401h` with `ID = 1`, and a vCPU that never gets woken.

**Other causes to check, in the order the hardware evaluates them** (the six-step IPI algorithm, `[APM2 §15.29.6.1]` `[1]`):

- **Logical-ID table problems** — three logical-lookup conditions each force a `#VMEXIT`: an invalid entry (`V` clear at bit 31), a valid entry whose Guest Physical APIC ID is > 255 in xAVIC, and a valid entry with an invalid backing page pointer. The Logical APIC ID Table maps one entry per logically addressed APIC, so **each vAPIC's logical ID must be unique, and if the guest changes its APIC's logical ID the VMM must mirror the change into this table**. `[APM2 §15.29.5.3]`, `[APM2 Table 15-24]` `[1]`
- **Directed versus broadcast differ at the physical-table lookup:** for directed interrupts an invalid entry causes a `#VMEXIT`; for broadcast IPIs invalid entries are simply ignored. `[APM2 §15.29.6.1]` `[1]`
- **One table per VM, not per vCPU.** There is one Physical APIC ID Table and one Logical APIC ID Table per virtual machine, so the two pointers hold the same value in every VMCB of the VM. `[APM2 §15.29.5.2]` `[1]`
- **Unsupported message types:** AVIC hardware accelerates the fixed message type to one or more logical destinations plus self and broadcast via ICRL DSH; **every other message type must be emulated by the VMM**. `[APM2 §15.29.5.3]` `[1]`
- **Doorbell handling.** The remote-wake path is the Doorbell Register, MSR `C001_011Bh`, bits 7:0 = destination Physical APIC ID, 63:8 reserved MBZ; **any attempt to read it raises `#GP`**. A doorbell to a running guest is recognized whether or not the interrupt can be injected immediately, and VMRUN re-reads the backing page IRR on entry. `[APM2 Figure 15-22]`, `[APM2 §15.29.8.2]`, `[APM2 §15.29.8.3]` `[1]`
- **If the interrupt came from a passthrough device rather than another vCPU**, the loss is on the IOMMU side — see `10-iommu-interrupt-remapping.md` §10.5, where GA log overflow stops the log entirely.

**Confidence:** high — every claim above is `C:high` `V:durable`. Note the chapter records as an open item that **AVIC availability on a client Ryzen cannot be settled from AMD primary sources** (no public PPR or revision guide for client parts, `C:medium`); only `CPUID Fn8000_000A` on the machine settles it.

---

### diag-io-page-fault
**Routed to:** `09-iommu-page-tables.md` §9.6 (via §0.2 row "`IO_PAGE_FAULT` in the event log") — correct route. The chapter works this exact record (`2050_0000h`) as its worked example.

**Answer, part 1 — the retry question, which is the part people get wrong.** **No, it cannot be retried.** An `IO_PAGE_FAULT` is **not recoverable in the way a CPU page fault is**: the underlying data fabric and PCIe protocols give the IOMMU no way to tell a device to retry, so the IOMMU **target-aborts** the faulting request, sets the legacy PCI Signaled Target Abort bit where applicable, and logs the event. **There is no faulting-access restart.** `[IOMMU 3.11 §2.1.3.2]` `[7]`

Two refinements:

- For an **untranslated posted request** the IOMMU gives the device no indication at all that translation failed — a posted write has no completion to carry one — so the write is simply dropped. A **non-posted** request gets the abort as its completion status. `[IOMMU 3.11 §1.1]` `[7][53]` `C:medium`
- An **address translation request** behaves differently on purpose: the IOMMU returns translation-not-present with R=W=0 and **creates no event log entry**, leaving the peripheral to decide — that is the whole point of ATS and PRI. `[IOMMU 3.11 §2.5.3]` `[7]`

The practical consequence: **every page the device may ever touch must be mapped before the device touches it. There is no demand paging for a non-PRI device.**

**Answer, part 2 — decoding `2050_0000h` at dword +04.** `2050_0000h` = `0010 0000 0101 0000 …b`. Decode order is fixed `[IOMMU 3.11 Table 57]` `[7]`:

1. **`EventCode` = bits 31:28 = `2h` → `IO_PAGE_FAULT`.** The record follows Figure 56 (owned by `08-iommu-architecture.md` §8.8).
2. **`DeviceID` = bits 15:0 of dword +00.** Convert Bus[15:8] / Device[7:3] / Function[2:0] to locate the device, and use the same value as the Device Table index — through the segment base register if segmentation is enabled.
3. **`GN` = bit 16 = 0** → the faulting address is a **guest physical address**, and `D/P[15:0]` is the **DomainID**, not a PASID.
4. **`PR` = bit 20 = 1** → **the page was marked present, so this is not a missing mapping.**
5. **`PE` = bit 22 = 1** and **`RW` = bit 21 = 0** → **a *read* that the cumulative permissions denied.** (`PE` and `RZ` are only meaningful when `PR = 1`.)
6. **`RZ` = bit 23 = 0** → the failure was an **invalid level encoding**, not a reserved bit. That points at **DTE[Mode]**, at a **PDE Next Level above `EFR[HATS]`**, or at a **Next Level not below its own table's level**.
7. **`TR` = bit 24 = 0** → an ordinary transaction, not a translation request. **`I` = bit 19 = 0** → a memory request, not an interrupt.
8. **The address in dwords +08/+12** is the device virtual address the peripheral asked for — a GPA here since GN=0. Walk it with §9.1 (host v1 tables) or §9.2 (guest v2/GCR3).

**So: a present page, a denied read, and an invalid level encoding — look at your paging-mode/level configuration, starting at the DTE's `Mode` field, not at a missing mapping.**

**Two follow-ups the chapter flags:**

- AMD states TLB caching behaviour for an entry that caused an event is **undefined**, and that some implementations insert the entry before verifying it — so **software should invalidate the address that caused the event.** `[IOMMU 3.11 §2.1.3]` `[7]`
- When an **early-terminated walk** produces the event, the reported information is whatever the completed part of the walk computed, starting from the DTE — so a fault record can describe a DomainID and permissions from a walk that never reached a PTE. `[IOMMU 3.11 §2.1.3]` `[7]`

**If you see no record at all where you expect one**, five bits decide visibility: DTE `V`(0), `TV`(1), `SA`(98) (suppresses **all** memory-side `IO_PAGE_FAULT` entries for the device), `SE`(97) (log only the first fault while the DeviceID stays cached), and `IG`(133) (suppresses interrupt-caused faults). `[IOMMU 3.11 §2.5.3]`, `[IOMMU 3.11 Table 7]` `[7]`

The full enumerated software cause list for a memory-side `IO_PAGE_FAULT` is at `[IOMMU 3.11 Table 44]` `[7]`.

**Confidence:** high — the decode claims are `C:high` `V:durable`. The posted-request detail is `C:medium`. Note the Linux `AMD-Vi: Event logged [IO_PAGE_FAULT device=… flags=…]` line is the **driver's rendering**, a driver convention and not part of the hardware format (`C:medium`); **Windows exposes no comparable text log.**

---

### diag-passthrough-interrupts-missing
**Routed to:** `10-iommu-interrupt-remapping.md` §10.4 (via §0.2 row "A passthrough device's interrupts never arrive") — correct route.

**Answer:** The device working otherwise tells you DMA translation is fine — and that is the point: **the interrupt path is a separate path with separate controls.** Interrupt remapping and address translation may be enabled and operated separately for the same device, and accesses to the interrupt address range **go through the interrupt remapping portion of the IOMMU and not through address translation** (a transaction processed as an interrupt has its pretranslated/untranslated attribute ignored). `[IOMMU 3.11 §2.1.4.2]`, `[IOMMU 3.11 §2.2.5]` `[7]` So the page tables — the mechanism people reach for first — are explicitly not in this path.

**Where to look, in the order the hardware evaluates:**

**1. The address range.** MSIs must land in `FD_F800_0000h`–`FD_F8FF_FFFFh` (Interrupt/EOI). The adjacent `FD_0000_0000h`–`FD_F7FF_FFFFh` is reserved interrupt address space and a request there produces an **`INVALID_DEVICE_REQUEST`** event, not an `IO_PAGE_FAULT`. `[IOMMU 3.11 Table 3]` `[7]`

**2. The DTE interrupt cluster — bits 191:128 of the 256-bit device table entry** `[IOMMU 3.11 Figure 7]` `[7]`. Check in this order:

- **`IV` (bit 128), interrupt map valid.** With `IV=0` all interrupts are forwarded without remapping.
- **`IntCtl` (bits 189:188).** `00b` = fixed and arbitrated interrupts **target aborted** ← the silent-drop case; `01b` = forwarded unmapped; `10b` = remapped; `11b` = reserved and reported as an event when `IV=1`. `[IOMMU 3.11 Table 7]`, `[IOMMU 3.11 Table 9]` `[7]`
- **`Interrupt Table Root Pointer` (179:134)**, 128-byte aligned, **used only when `IntCtl=10b`**; otherwise ignored.
- **`IntTabLen` (132:129)** — `2^IntTabLen` entries (0000b=1 … 1010b=1024, 1011b=2048); `11xxb` is reserved and reported as an event when `IV=1`. **A table that is too short is a common cause**, because the index is not bounds-clamped for you.

**3. The IRTE index and `RemapEn`.** The IRTE index is **`MSI Data[10:0]`**. `[IOMMU 3.11 §2.2.5]` `[7]` **`RemapEn=0` is the per-vector deny: the interrupt is target aborted and reported as an `IO_PAGE_FAULT`** — which is why a correctly sized table with most entries disabled is the safe default rather than a short table. `[IOMMU 3.11 §2.2.5.2]` `[7]` (Note the spelling: the field is **`RemapEn`**, not `RemapEm` — `errata.md` E03.)

**4. Message type routing.** With `DM=0` only MT 0 (Fixed) and 1 (Arbitrated) are controlled by the DTE and IRTE; MT 2 goes to `SmiFLogEn`, 3/4/6 to `NMIPass`, 5 to `InitPass`, 7 to `EIntPass`, 11 to `Lint1Pass`, 14 to `Lint0Pass`, and **8, 9, 10, 12, 13, 15 are target aborted**. With `DM=1` only MT 0–1 reach the remapping tables unless `NumIntRemapSup=01b` and `NumIntRemapMode=01b`. `[IOMMU 3.11 Table 19]` `[7]`

**5. If the guest vAPIC (AVIC posting) path is in use**, walk the full sequence: check `GASup`/`GAMSup`/`GAEn`/`GAMEn`; pick IRTE size and stride (a 32-bit IRTE falls back to the basic path); select the DTE for that `DeviceID`; index the IRTE; `RemapEn=0` → `IO_PAGE_FAULT`; `GuestMode=0` → plain remap; `GuestMode=1` → post into the guest. `[IOMMU 3.11 §2.2.5.2]` `[7]` Feature enablement is a four-way matrix of `GASup` / `GAEn` / `IV` / `IRTE[GuestMode]`. `[IOMMU 3.11 Table 6]` `[7]`

**6. The wake-up half — the most likely cause of "device fine, interrupts never arrive".** After setting the IRR bit the IOMMU re-reads the IRTE: with **`IsRun=0` and `GALogIntr=1`** it writes a **GA log** entry carrying `GATag` and signals an interrupt; with **`IsRun=1`** it sends a **guest APIC doorbell** to the core named by `Destination`. `[IOMMU 3.11 §2.2.5.2]` `[7]` Two failure modes here:

- **GA log overflow does not drop one entry and carry on — it stops the log.** The overflow status bit is set, subsequent guest vAPIC event data is **discarded**, and logging stays disabled until software runs the restart procedure. A hypervisor that does not handle overflow therefore **stops being told about *any* undelivered guest interrupt**, not merely the one that overflowed. `[IOMMU 3.11 §2.7.1]` `[7]`
- **A stale `IsRun`/`IsRunning`.** The Physical APIC ID Table is written by the VMM and read by **both** the core and the IOMMU, so `IR` must be maintained on every vCPU schedule/unschedule. `[APM2 §15.29.6.2]` `[1]` And if the IOMMU reads an entry whose **`V` bit is clear it aborts the virtual interrupt delivery and logs an error**. `[APM2 §15.29.6.2]` `[1]`
- If **GAPPI** is enabled (`GAPPISup` + `GAPPIEn`), the GA log write is suppressed for `IsRun=0` when `GALogIntr=0` and a GAPPI interrupt is raised instead, with **`Vector = IRTE[GATag[7:0]]`** — so `GATag` must be allocated with GAPPI in mind even on systems intending to use the log. `[IOMMU 3.11 §2.2.5.4]` `[7]`

**7. Why you may be seeing nothing in the event log.** Three overlapping suppressors: DTE **`IG`** (bit 133) suppresses logging for interrupt-caused `IO_PAGE_FAULT`s; with `IG=0` the decision falls to **`SupIOPF`** in the IRTE; and `SmiFLogEn` independently covers SMI-filter entries. The memory-side `SA`/`SE` bits **explicitly do not affect** interrupt events. `[IOMMU 3.11 Table 7]` `[7]` Clear `IG` and `SupIOPF` before concluding nothing is being logged.

**8. After any table edit**, issue `INVALIDATE_INTERRUPT_TABLE` (command `05h`) for that device — it invalidates all cached interrupt information for one device including the cached guest vAPIC table base pointer. `[IOMMU 3.11 §2.4.5]`, `[IOMMU 3.11 Figure 48]` `[7]`

**Confidence:** high — `C:high` `V:durable` throughout, except the "earlier revisions defined MT 0010b–1111b with DM=1 as remappable" note (`C:medium`) and the DMA-attack corroboration (`C:medium`).

---

### diag-sev-launch-failure
**Routed to:** `12-sev.md` §12.8 (via §0.2 row "SEV guest fails to launch / firmware returns an error") — correct route; the two codes resolve in §12.7.1 and §12.4 of the same chapter.

**Answer:** Two different problems, in sequence. Neither is a guest bug.

**`INVALID_PLATFORM_STATE` (`0x0001`)** — the firmware refuses commands that are wrong for the current state, and the platform state machine is the first thing to check. `[SEV-API 3.24 Table 14]` `[8]`

PSTATE has exactly three states: **`UNINIT` (0h)**, **`INIT` (1h)**, **`WORKING` (2h)** — and **guest commands are only valid in the INIT and WORKING platform states.** `[SEV-API 3.24 §5.1.2]` `[8]` So a `LAUNCH_START` issued while the platform is still `UNINIT` returns exactly this. The allowed platform commands in `UNINIT` are INIT, PLATFORM_RESET, PLATFORM_STATUS, DOWNLOAD_FIRMWARE, GET_ID, DF_FLUSH and NOP — note `LAUNCH_*` is not among them. `[SEV-API 3.24 Table 16]` `[8]`

Three concrete causes:

1. **`INIT` was never issued, or was issued and then `SHUTDOWN`.** Confirm with `PLATFORM_STATUS`, which is legal in all three states.
2. **The machine came back from S4/S5.** Firmware volatile state survives S0–S3 and is **lost across S4, S5 and mechanical off**, after which the firmware starts from reset and must be re-initialized. `[SEV-API 3.24 Table 17]` `[8]`
3. **A corrupt persistent store.** If a power failure corrupted it, the next `INIT` returns an integrity-check failure and **the platform must be reset with `PLATFORM_RESET`**. `[SEV-API 3.24 §5.1.5]` `[8]`

Also confirm you are not tripping the serialization rule: the API processes commands **serially** — software must not issue a further command before receiving the response to the previous one, and an early command is ignored with no change to the platform or any guest context. `[SEV-API 3.24 §4.7]` `[8]` And if you are in Ring Buffer mode, a Mailbox-mode command returns **`0x001F RB_MODE_EXITED`**, not `INVALID_PLATFORM_STATE`. `[SEV-API 3.24 Table 14]` `[8]`

(If the error were `INVALID_GUEST_STATE` (`0x0002`) instead, the same reasoning applies to GSTATE, which has **seven** states — `UNINIT` 0h, `LUPDATE` 1h, `LSECRET` 2h, `RUNNING` 3h, `SUPDATE` 4h, `RUPDATE` 5h, `SENT` 6h — with `LAUNCH_START` and `RECEIVE_START` the **only** two commands that create a guest context. `[SEV-API 3.24 Table 43]`, `[SEV-API 3.24 §1.3.3]` `[8]`)

**`WBINVD_REQUIRED` (`0x000E`)** — this is the ASID-reuse handshake, and it is by design. `[SEV-API 3.24 §4.5]` `[8]` (`SEV_RET_WBINVD_REQUIRED` is the Linux spelling; AMD's Table 14 name is `WBINVD_REQUIRED` — see `00-quickref.md` §0.4.)

Reusing an ASID means reprogramming a key slot while caches and data-fabric write buffers may still hold the previous tenant's plaintext or differently-keyed ciphertext. The firmware enforces a **three-step handshake** `[SEV-API 3.24 §6.21.1]`, `[SEV-API 3.24 §6.22.1]`, `[SEV-API 3.24 §1.3.2]` `[8]`:

1. **`DEACTIVATE`** the guest — the firmware uninstalls the key from the memory controller, marks the ASID invalid on all cores, and **records that a DF_FLUSH is required for that ASID**.
2. **`WBINVD` on every hardware thread the guest was active on.** This is x86 system software's job, not the firmware's.
3. **`DF_FLUSH`**, which verifies step 2 happened and flushes the data-fabric write buffers.

**`DF_FLUSH` itself returns `WBINVD_REQUIRED` when the `WBINVD` has not been executed.** `[SEV-API 3.24 §4.5]` `[8]` That is almost certainly your case: you skipped step 2, or ran `WBINVD` on a subset of the threads the guest had been active on. `ACTIVATE` then also fails, because it requires that a successful `DF_FLUSH` has been executed since the last `DEACTIVATE` for that ASID. `[SEV-API 3.24 §6.19.1]` `[8]`

Related code to distinguish: **`DF_FLUSH_REQUIRED` is `0x000F`** — "DF_FLUSH invocation required", i.e. step 3 is missing rather than step 2. `[SEV-API 3.24 §4.5]` `[8]`

**Useful optimisation once it works:** `DF_FLUSH` marks **all** previously deactivated ASIDs usable at once, so a hypervisor may batch many `DEACTIVATE` calls and flush the cache and data fabric only once afterwards. `[SEV-API 3.24 §1.3.2]` `[8]`

**Confidence:** high — all `C:high` `V:durable`. Scope note: pub 55766 covers **SEV and SEV-ES only**; SNP firmware commands are in 56860 (`errata.md` O5).

---

### diag-vc-storm-early-boot
**Routed to:** `13-sev-es-ghcb.md` §13.2 (via §0.2 row "`#VC` storms, or a guest hangs in early boot under SEV-ES") — correct route.

**Answer:** This is the documented early-boot ordering hazard, and the phrase "before it reaches long mode" is the tell.

**The governing rule:** **before long mode or 32-bit PAE paging is established, all guest memory accesses are forced to use the guest's encryption key**, so the hypervisor would only see **ciphertext** in the GHCB. A guest must therefore **avoid any unplanned NAE event until it has discovered the encryption-bit position and marked the GHCB shared.** `[GHCB 2.04 §2.5]` `[9]`

So the failure shape is: an NAE event fires earlier than the guest's boot code planned for; `#VC` is raised; the handler tries to use a GHCB that is either not yet established or still private/encrypted; the hypervisor reads garbage or cannot act; the guest faults again — and because `#VC` **cannot be masked**, the loop is self-sustaining.

**Why it cannot be masked:** `#VC` is **exception vector 29**; it is **precise, contributory, fault-type, cannot be masked**, and is **always generated by hardware** when an SEV-ES enabled guest is running and an NAE event occurs. `[APM2 §15.35.5]` `[1]`

**How to identify which NAE is doing it:** **the `#VC` error code equals the `#VMEXIT` code of the event that caused the NAE** — so the handler dispatches on the exit code it would otherwise never see. `[APM2 §15.35.5]` `[1][9]` Capture the error code at the first `#VC` and look it up in `05-exit-decoding.md` §5.1. (AMD's own worked example uses `0x41`, the `#DB` intercept error code, in the NMI-completion flow — `[GHCB 2.04 §4.4]` `[9]`.)

**The things to check, in order:**

1. **The guest must use the GHCB *MSR protocol* before it can use a GHCB page at all.** The MSR protocol is what a guest uses when it cannot yet write the GHCB page in the clear — during early boot, and for the small set of operations that must work without one. `GHCBInfo` is MSR bits 11:0 and `GHCBData` bits 63:12. `[GHCB 2.04 Table 2]`, `[GHCB 2.04 §2.3]` `[9]`
2. **Get the encryption-bit position from the SEV Information response (`GHCBInfo = 0x001`):** `GHCBData[63:48]` max GHCB protocol version, `[47:32]` min, **`[31:24]` the SEV page-table encryption bit number**, which the hypervisor takes from `Fn8000_001F EBX[5:0]`. `[GHCB 2.04 §2.3.1]` `[9]` Until the guest has this, it cannot mark anything shared correctly.
3. **Version negotiation must succeed.** A guest that cannot support any protocol version in the range the hypervisor advertises **must request termination** — rather than looping. `[GHCB 2.04 §2.4.1]` `[9]`
4. **The hypervisor must not intercept MSR `C001_0130h`**, or the guest cannot establish a GHCB at all. `[GHCB 2.04 §2.3]` `[9]` This is a very common hypervisor-side cause of exactly this symptom.
5. **The hypervisor must not set the `#VC` intercept.** AMD says it is inadvisable, since that would prevent the guest handling NAEs at all; the hypervisor should likewise avoid intercepting events that occur *inside* the `#VC` handler, such as IRET. `[APM2 §15.35.5]` `[1]`
6. **The GHCB page must be mapped decrypted.** It is a 4,096-byte page the guest must map decrypted so both sides can reach it; hardware never accesses it directly. `[APM2 §15.35.7]` `[1][9]`
7. **For SEV-SNP guests only, GPA registration is mandatory** before the first GHCB VMGEXIT, and a hypervisor **must terminate** a guest presenting a GHCB GPA that does not match the currently registered value. `[GHCB 2.04 §2.3.2]` `[9]`
8. **Reentrancy.** If the storm involves NMI context, use a separate GHCB, or save the active GHCB contents on entry and restore on exit. `[GHCB 2.04 §4.1]` `[9]`

**The escape hatch the spec provides, instead of looping:** the MSR-protocol **Termination Request (`0x100`)**, with `GHCBData[15:12]` the reason-code set and `[23:16]` the reason code. AMD owns set `0x0`: `0x00` general termination, `0x01` GHCB protocol range not supported, `0x02` SEV-SNP features not supported. After requesting termination the guest should execute an HLT loop or SHUTDOWN as a safeguard in case the hypervisor does not comply. `[GHCB 2.04 §2.3.1]` `[9]` A guest hanging rather than terminating cleanly is itself a sign this path is not implemented.

**One more early-boot resource trap:** SEV-ES requires x86 system software to **donate a 1 MB region aligned on a 1 MB boundary** to the firmware for exclusive use until `SHUTDOWN` (the Trusted Memory Region), and **x86 attempts to access it while donated raise exceptions that frequently destabilise the system.** `[SEV-API 3.24 §5.1.7]` `[8]` (from `12-sev.md` §12.7.1)

**Confidence:** high — `C:high` `V:durable` throughout.

---

### diag-attestation-verify-failure
**Routed to:** `14-sev-snp.md` §14.11 (via §0.2 row "Attestation report fails to verify") — correct route; §14.13 in the same chapter covers the key/cert half.

**Answer:** Three distinct failure families. Separate them first, because the fixes are unrelated.

**A. Signature verification fails.**

1. **Wrong certificate for the TCB.** The firmware derives the signing key from the systemwide **`ReportedTcb`**, which the hypervisor sets — it starts equal to `CurrentTcb`, is set by a non-zero `REPORTED_TCB` in `SNP_CONFIG`, and resets to `CommittedTcb` on `SNP_COMMIT` or a zero `REPORTED_TCB`. `[SNP-ABI 1.59 §3.4]` `[10]` `ReportedTcb` exists so a host can install new firmware and keep signing with the old key until guest owners have fetched new certificates. **So you must fetch the certificate for exactly the TCB in the report**, not for the running firmware. `[SNP-ABI 1.59 §3.4]`, `[SNP-ABI 1.59 §2.2]` `[10]`
2. **Wrong signed range.** The structure runs to `4A0h` — **1184 bytes** — and the `SIGNATURE` at `2A0h` covers **bytes `0h` to `29Fh` inclusive**. `[SNP-ABI 1.59 Table 27]` `[10]` Hashing the whole buffer, or stopping at the wrong offset, fails every time.
3. **Wrong algorithm or encoding.** The **only** signing algorithm the ABI defines is **ECDSA P-384 with SHA-384**, encoding `1h`, curve P-384 encoded `2h`; the signature is **512 bytes holding R at `000h` and S at `048h`, each zero-extended little-endian**, remainder reserved. `[SNP-ABI 1.59 App.B]` `[10]` Little-endian R/S is the classic parser bug — most crypto libraries want big-endian.
4. **Wrong key entirely.** Read **`SIGNING_KEY`, bits 4:2 at offset `48h`**: 0 = legacy VCEK, 1 = VLEK, 2 = chip-secret VCEK, 3–6 reserved, **7 = none**. `[SNP-ABI 1.59 Table 27]` `[10]` A VLEK-signed report verified against a VCEK chain will fail; the VLEK is derived from a **per-CSP seed held by AMD's Key Derivation Service**, not from a chip secret, and the hypervisor can force its use with `VCEK_DIS`. `[SNP-ABI 1.59 §3.7]` `[10]` The CSVCEK chain is different again: AMD Root CA → AMD IDevID Signer CA → IDevID → … → CSVCEK, with lower certificates in Caliptra 1.x formats retrieved on-device via `SNP_CSVCEK_CERT` (F0h). `[SNP-ABI 1.59 App.C]` `[10]`
5. **There is no signature at all.** When **`MaskChipKey` is 1 the firmware writes zeroes into `SIGNATURE` instead of signing.** `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §3.6]` `[10]` Likewise `CHIP_ID` is zeroed when `MaskChipId` is set.
6. **Unsatisfiable key selection** returns `INVALID_KEY` rather than a bad report: `KEY_SEL=0` with no VLEK loaded and `VcekDis` set, `KEY_SEL=1` with `VcekDis` set, `KEY_SEL=2` with no VLEK loaded, `KEY_SEL=3` with `VcekDis` set or `CsVcekEn` clear. `[SNP-ABI 1.59 §7.3]` `[10]`

**B. "Nonsense TCB numbers" — this is almost certainly the parser, and the skill names the exact cause.**

**`TCB_VERSION` is a 64-bit structure whose field layout differs by product line** `[SNP-ABI 1.59 §2.3]` `[10]`:

| Product line | Layout |
|---|---|
| "Venice" (Table 3) | 23:16 SNP, 15:8 TEE, 7:0 FMC; 63:24 reserved; **no boot loader field** |
| "Turin" (Table 4) | 63:56 MICROCODE, 31:24 SNP, 23:16 TEE, 15:8 BOOT_LOADER, 7:0 FMC |
| "Genoa"/"Milan" (Table 5) | 63:56 MICROCODE, 55:48 SNP, 15:8 TEE, 7:0 BOOT_LOADER |

**A parser that assumes one layout misreads the others.** That is the single most likely cause of "nonsense TCB numbers". There is also a separate **`ETCB_VERSION`**, a 256-bit extended TCB (for "Venice", 14 named fields from `IP_KEY_MANAGER` at 7:0 up to `AMD Root Guest` at 111:104), carried at `220h`/`240h`/`260h`. `[SNP-ABI 1.59 §2.4]`, `[SNP-ABI 1.59 Table 27]` `[10]`

Second parser trap: **`VERSION` has moved across firmware ABI revisions — 3h, then 5h, then 6h — and 4h never existed.** A parser hardcoded to a stale set (e.g. 2/3/5) will reject valid reports. `[SNP-ABI 1.59 Table 27]` `[10]`, `errata.md` E25. The value current for a given firmware revision is version-bearing and belongs to `90-dated-landscape.md` (`V:dated`).

Third: **`POLICY` at offset `08h` bit 17 is reserved and must be one**, which is why the minimal SMT-permitting policy reads `0x30000` and not `0x10000`. A checker expecting `0x10000` flags a valid report. `[SNP-ABI 1.59 Table 12]` `[10]`

**C. The report verifies but the verification is meaningless.** Four rules from the same chapter:

- **Check every reserved field is zero** — AMD tells verifiers to do this explicitly. `[SNP-ABI 1.59 §7.3]` `[10]`
- **Independently require `REPORTED_TCB` ≥ your own accepted baseline.** A report only proves the platform was at *some* TCB at or below the installed one. `[SNP-ABI 1.59 §3.4]`, `[SNP-ABI 1.59 §2.2]` `[10]`
- **A host-generated report is not a guest attestation.** `SNP_HV_REPORT_REQ` (96h) lets a host obtain a report without the guest's participation; such a report is marked by **`VMPL = 0xFFFFFFFF` and a zero-filled `REPORT_DATA`.** `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §8.33]` `[10]`
- **The relying party must be outside the machine under attestation.** The report is unforgeable by the hypervisor, but nothing stops a malicious host tampering with a verifier it also runs. `[SNP-ABI 1.59 §7.3]` `[10]` `C:medium`
- If `REPORT_ID_MA` is populated, a migration agent is present and **you must also verify the agent's own report** — the agent is inside the guest's TCB. `[SNP-ABI 1.59 §4.11]` `[10]`

**Confidence:** high for the layout, algorithm and TCB-layout claims (`C:high` `V:durable`). `C:medium` on the KDS endpoint detail — **the KDS endpoint URLs and per-TCB query parameters are in pub 57230, which is not part of this corpus**; 56860 states only that the legacy VCEK chain comes from the KDS. If your failure is at the certificate-fetch step specifically, the skill does not carry the URL format.

---

### diag-vmm-cannot-use-amd-v
**Routed to:** `16-windows-platform.md` §16.1 (via §0.2 row 1, "'AMD-V is disabled in BIOS' but BIOS says it is on") — correct route; §16.1.3's symptom table has this exact row.

**Answer:** Your hypervisor is reporting the symptom, not the cause. **The Windows hypervisor already holds SVM host mode**, and the third-party product's error string is simply the nearest message it has for "I could not set `EFER.SVME`".

**The mechanism.** On AMD, SVM host mode has exactly one owner per logical processor: the software that set `EFER.SVME` and pointed `VM_HSAVE_PA` at its own save area. Microsoft states the constraint without vendor vocabulary: "many virtualization applications depend on hardware virtualization extensions" — the page names "Intel VT-x and AMD-V" — but **"only one software component at a time can use this hardware. Virtualization applications can't share the hardware."** `[101]` On AMD the resource being claimed is **not** a VMXON region; it is `EFER.SVME` plus the host state-save area. `[101]` `C:medium`

**What pulls the hypervisor in.** Enabling **the Hyper-V role, the Virtual Machine Platform optional component (which WSL 2 uses), Windows Sandbox, Docker Desktop's Windows backends, memory integrity or Credential Guard** launches the Windows hypervisor at boot, **whether or not a virtual machine is ever created**; Microsoft documents that "third-party virtualization applications … can't run alongside Hyper-V, Memory Integrity, or Credential Guard". `[101]` Once that has happened the Windows installation you interact with **is a guest**: the root partition, running in **VTL0** above the hypervisor. **"Hyper-V is not installed" is therefore not evidence that SVM is free** — VBS is a Hyper-V-backed feature. `[44][101]`

Note especially **memory integrity**, which is on by default on many consumer Windows 11 installs and which most users would not describe as "a hypervisor".

**How to confirm, in this order** (§16.1.1 is explicit that reversing the order is what produces this report):

1. **Is a hypervisor present?** `CPUID` leaf 1, **`ECX` bit 31** — "if this bit is set, a hypervisor is present". `[463]`
2. **Which one?** Leaf **`0x40000000`** returns `EBX = 0x7263694D` ("Micr"), `ECX = 0x666F736F` ("osof"), `EDX = 0x76482074` ("t Hv") — the string **"Microsoft Hv"**. Leaf `0x40000001` returns the interface signature `EAX = 0x31237648` ("Hv#1"), and Microsoft recommends basing compatibility decisions on the **interface signature**, not the vendor string. `[463]`
3. **From the desktop, without code:** `msinfo32.exe` → System Summary → **"Virtualization-based Security Services Running"**; and `bcdedit /enum {current}` → **`hypervisorlaunchtype`** (`Auto` or `Off`). `[465][474]` The useful negative check: **if `msinfo32` reports VBS running, no amount of work on the `VM_CR`/`EFER` chain will free SVM.** `[101][465]`
4. **Only then** the hardware chain in `01-svm-intro.md`.

**A caution for anyone probing from inside:** a guest-side reading of `VM_CR` or `EFER` under Hyper-V is **not** a reading of the physical processor's state — the values a nested VMM sees are whatever the level above chose to present. `[464]` `C:medium`

**What to do about it — three options, and only three** (§16.6.2). There is **no fourth**: the architecture provides no way for two pieces of software to hold SVM host mode on one logical processor at the same time. `[101]`

| Option | What it means on AMD | What it costs |
|---|---|---|
| **Run over WHP** (recommended) | The VMM becomes a user-mode client of Hyper-V; its guest is a Hyper-V partition and is already nested | No nesting inside the guest, no performance counters, no RTM/HLE, no PKU; slower |
| Run nested under Hyper-V | VM with `Set-VMProcessor -ExposeVirtualizationExtensions $true` | Microsoft does not support non-Hyper-V virtualization applications inside a Hyper-V VM |
| Turn the hypervisor off | `bcdedit /set hypervisorlaunchtype off`, reboot | **Every** Hyper-V-backed feature stops: VBS, memory integrity, Credential Guard, WSL 2, Sandbox, Docker Desktop's Windows backends |

The third option was the standard advice before WHP existed and is **now usually the wrong first move** — `errata.md` E15 records the older framing as superseded. `[47][101][474]`

**Vendor support for the WHP path is real and current:** VMware Workstation Pro from **15.5.5** ("Host VBS Mode"), VirtualBox from **6.0**. `[47][478]`

**Citation note:** this is Windows behaviour, so per SKILL.md the citations are **Microsoft Learn and the TLFS (Tier-2), not the APM** — there is no APM section for it.

**Confidence:** high. Most claims `C:high` `V:durable`; the "resource being claimed is `EFER.SVME` not VMXON" phrasing and the guest-side-MSR caution are `C:medium`.

---

### diag-probe-chain-reads-clean
**Routed to:** `16-windows-platform.md` §16.1 (via §0.2 row "My VMM/driver/debugger cannot execute VMRUN on Windows") — correct route. `01-svm-intro.md` §1.5's own failure table also routes this row here explicitly.

**Answer:** You asked the questions in the wrong order. **The hardware chain describes the silicon and says nothing about a second hypervisor already occupying host mode** — so a clean read of every stage is exactly what you should expect on a Windows PC with any Hyper-V-backed feature on.

`01-svm-intro.md` §1.5's own symptom table makes this explicit: for the row **"Everything reads clean but VMRUN never runs"**, the "Most likely stage" column reads **"Not a hardware stage"** and the discriminator is **`Fn0000_0001_ECX[31] = 1`**. The chapter states plainly that this row **has no APM stage, because the APM does not model a second hypervisor already occupying host mode; it is diagnosed from the hypervisor-present bit and the platform, not from `VM_CR`.** `[no-spec]` `[100]` `C:medium`

**The correct order of questions on Windows** `[101][463]`:

1. **Is a hypervisor already present?** CPUID leaf 1, **ECX bit 31**.
2. **If so, which one?** CPUID leaf **`0x40000000`** → "Microsoft Hv"; leaf `0x40000001` → `"Hv#1"` interface signature, which is what Microsoft says to base compatibility decisions on. `[463]`
3. **Only then** the hardware chain: CPUID `Fn8000_0001 ECX[2]` → `VM_CR` (`SVMDIS`, `LOCK`) → `EFER.SVME` → `VM_HSAVE_PA`.

**Reversing (1) and (3) is what produces the "everything looks fine but VMRUN never runs" report.** `[101][463]`

**And the values you read may not even be real.** A guest-side reading of `VM_CR` or `EFER` under Hyper-V is **not** a reading of the physical processor's state; the values a nested VMM sees are whatever the level above chose to present, so **they cannot be used to decide whether the platform is free.** `[464]` `C:medium` That is why your chain "reads healthy" — you may be reading a presented view.

**What makes this hard to debug**, stated directly in §16.1.3: **nothing on the machine is misconfigured.** The hardware is present and enabled, the firmware is correct, and the platform is behaving as designed — the only thing that changed is which software holds SVM host mode. `[101]` `C:medium`

**Windows-side confirmation** (§16.10, all first-party):

| Question | Command | What to read |
|---|---|---|
| Does the machine meet the Hyper-V requirements? | `systeminfo.exe` | the "Hyper-V Requirements" section — VM Monitor Mode extensions, virtualization enabled in firmware, SLAT, hardware-enforced DEP `[475]` |
| Is VBS running? | `msinfo32.exe` → System Summary | "Virtualization-based Security Services Running" `[465]` |
| Scriptable | `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning` | non-empty list `[465]` |
| Is the hypervisor on the boot path? | `bcdedit /enum {current}` | `hypervisorlaunchtype` — `Auto` or `Off` `[474]` |
| Hypervisor present from inside? | CPUID leaf 1 ECX[31], leaf `0x40000000` | §16.9 `[463]` |

One subtlety: **`hypervisorlaunchtype` reading `Auto` means the hypervisor is on the boot path; it does not by itself prove the hypervisor launched**, because the silicon and firmware layers can still refuse. Read `systeminfo` and `msinfo32` together to separate those cases. `[474][475]` `C:medium`

**The decisive negative check:** if `msinfo32` reports virtualization-based security running, **no amount of work on the `VM_CR` and `EFER` chain will free SVM** — the answer is §16.6 (WHP), not a firmware setting. `[101][465]`

**Confidence:** high on the ordering rule and the diagnostic commands (`C:high`). The "no APM stage exists for this" claim is deliberately marked `[no-spec]` `C:medium` — the skill is explicit that this row has **no AMD specification anchor**, which is itself the point.

---

### diag-driver-rejected-memory-integrity
**Routed to:** `16-windows-platform.md` §16.3.2 / §16.3.5 — **no §0.2 row for this symptom**; routed via SKILL.md §Routing ("Hyper-V on AMD, VBS, HVCI…" → `16-windows-platform.md`), and §16.1.3's symptom table then names the section ("A kernel driver that generates or patches code fails to load" → §16.3.2). Correct chapter.

**Answer:** Your driver is almost certainly allocating writable-executable memory, generating code at run time, or patching kernel code. Under memory integrity (HVCI) that is **incompatible by construction rather than by policy** — and being correctly signed does not help, because the signature was never the thing being checked.

**The mechanism.** Memory integrity moves the kernel-mode code-integrity decision into the **secure kernel in VTL1**, so a VTL0 kernel page cannot be both writable and executable. The constraint is **enforced from VTL1 using nested-paging permissions the VTL0 kernel cannot modify**, so a compromised — or merely creative — VTL0 driver **cannot mark its own page executable**. `[461][465]`

That is why "it loaded for years": the years-long signature check is a VTL0 check on the image. HVCI adds a *page-permission* check enforced from a higher trust level, which your driver's code-generation pattern violates at run time.

**Why the rest of the machine changed too.** Turning memory integrity on launches the Windows hypervisor if it was not already running, which makes Windows a VTL0 guest — see §16.1. Above the hypervisor the split is by Virtual Trust Level: the ordinary kernel in **VTL0**, the secure kernel **`securekernel.exe`** in **VTL1**. `[45]`

**The AMD-specific part.** The hardware primitive underneath is **GMET — the Guest Mode Execute Trap extension, `CPUID Fn8000_000A EDX[17]`** — which lets a hypervisor make supervisor-mode execution of a page a trappable event **without making the page non-executable to user mode**, exactly the primitive kernel-mode code-integrity enforcement needs. `[42][461]` Microsoft lists **"MBEC/GMET Required"** as compatibility bit 4 (hex `0x00000010`) in its x64 compatibility-issue table, alongside "SLAT required" (bit 1, `0x00000002`), "IOMMU required" (bit 3, `0x00000008`) and "Hardware virtualization required" (bit 10, `0x00000400`). **GMET is the AMD half of that pair.** `[461]` Microsoft's default-enablement hardware table names the AMD floor as **"AMD Zen 2 architecture and newer"**. `[461]`

Without GMET the feature is still enforced, but the hypervisor falls back on making pages non-executable for **both** privilege levels and taking a nested page fault on every transition — which is why Microsoft treats MBEC/GMET as a compatibility gate for the default-on path rather than an optional tuning knob. `[461]` `C:medium`

**How to confirm:**

1. **Confirm memory integrity is actually the new variable** — `msinfo32.exe` → System Summary → "Virtualization-based Security Services Running"; scriptable as `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning`. `[465]` (Microsoft explicitly says checking whether `LsaIso.exe` is running "isn't a recommended method". `[465]`)
2. **Toggle memory integrity off and retest.** If the driver loads, the diagnosis is confirmed. This is a diagnostic step, not a fix — it disables the protection.
3. **Audit the driver for the three patterns**: W+X allocations, runtime code generation (JIT), and kernel code patching/hooking. The remedy is to remove them; there is no signing or attestation route around a VTL1-enforced page permission.

**One adjacent symptom worth ruling out, because it has the same trigger and a different cause:** §16.1.3 lists "A game or anti-cheat behaves differently after enabling WSL 2" as **hypervisor-present detection, not a hardware change**. §16.9 makes the separation explicit: software that treats "a hypervisor is present" as evidence of tampering will see it on an untampered machine, and **the two causes — presence detection, and memory-integrity enforcement against drivers that generate code — are separate mechanisms with one symptom.** `[463][101]` `C:medium` If the failing component is anti-cheat or DRM rather than your own driver, check which of the two you have.

**Citation note:** Windows behaviour, so the anchors are Microsoft Learn (Tier-2), not the APM. GMET's bit table and VMCB enable are owned by `06-nested-paging.md` if you need the hardware side.

**Confidence:** high — the enforcement mechanism and the MBEC/GMET compatibility-bit values are `C:high` `V:durable`; the GMET-fallback cost characterisation and the anti-cheat note are `C:medium`. Whether a specific Windows build enables memory integrity by default on a given part is a product-status question the skill defers to `90-dated-landscape.md` (`V:dated`).

---

### diag-kernel-dma-protection-off
**Routed to:** `16-windows-platform.md` §16.4 / §16.4.1 — **no §0.2 row**; routed via SKILL.md §Routing ("Kernel DMA Protection" → `16-windows-platform.md`), and §16.1.3's symptom table names §16.4.1 exactly ("`msinfo32` shows Kernel DMA Protection `Off` although the IOMMU is enabled"). Correct chapter and section.

**Answer:** Because **enabling the IOMMU is not the requirement.** Kernel DMA Protection additionally needs **firmware opt-in data that a consumer desktop board does not publish** — and on an AM5 desktop the honest answer to "what would it take" is usually **nothing you can do**; it needs a firmware change from the board vendor.

**Microsoft gives exactly two diagnoses** `[43][462]`:

1. If the field is `Off` **and** "Hyper-V - Virtualization Enabled in Firmware" is **`NO`** → the firmware switch is the cause; turn it on.
2. If the field remains `Off` with that switch **on** → **"the system doesn't support Kernel DMA Protection"**. This is the usual outcome on a consumer desktop board, because the firmware **never sets the IVRS `IVinfo` DMA-remap indicator**, never satisfies the pre-boot isolation rules, and **may not grant `_OSC` PCI Express native control**.

Since you have already enabled the IOMMU, you are in case 2.

**The sharpest AMD delta in the chapter, and the actual blocker.** The ACPI opt-in indicator is **vendor-specific**: on Intel platforms firmware sets `DMA_CTRL_PLATFORM_OPT_IN_FLAG` in the **DMAR** table's flags field, while **on AMD platforms firmware must set the "DMA remap support" bit in the IVRS table's `IVinfo` field.** `[462]` IVRS itself is owned by `09-iommu-page-tables.md` (§5.2 of the IOMMU spec). A board that never emits that bit cannot support the feature no matter what its setup menu offers.

**The full AMD requirement set** `[462][43]`:

- **IOMMU present and enabled *by default* by firmware** — not merely enableable. The OEM page names both IOMMUs in the same row: "IOMMU (Intel VT-D, **AMD-Vi**)", and requires "All I/O devices capable of DMA must be behind an enabled (by default) IOMMU", on "64-bit IA processors with virtualization extensions, including Intel VT-X and AMD-v".
- **The IVRS `IVinfo` DMA-remap bit set** (above).
- **Pre-boot isolation:** "No device may perform DMA outside of RMRR regions (Intel) or **IVMD blocks (AMD)** after `ExitBootServices()`", and a violation is expected to raise an IOMMU fault and **bug check `0xE6`**.
- **`_OSC` PCI Express Native Control:** "Enabling PCI Express Native Control using `_OSC` ACPI method is **required** for Kernel DMA Protection support."
- **TPM 2.0** — discrete or firmware — with firmware required to extend an **`EV_EFI_ACTION` event carrying the string "DMA Protection Disabled" into `PCR[7]`** on any boot where the IOMMU or Kernel DMA Protection is disabled.

**Explicitly *not* a prerequisite: VBS.** Microsoft states the requirement as UEFI firmware support plus "Hyper-V - Virtualization Enabled in Firmware", which is the IOMMU and virtualization firmware switch, **not** VBS. `[43]` So do not go enabling VBS to try to fix this.

**The corollary that sets expectations correctly:** turning `IOMMU` from `Auto` to `Enabled` in an AM4/AM5 setup menu **makes the IOMMU usable for passthrough and for VBS, and does not by itself make Kernel DMA Protection available**, because the feature additionally needs firmware opt-in data the board does not publish. `[43][462]` `C:medium`

**How to confirm:** `msinfo32.exe` → System Information → the **"Kernel DMA Protection"** field reads `ON` when the platform supports it; check **"Hyper-V - Virtualization Enabled in Firmware"** in the same view to distinguish Microsoft's two cases. `[43]`

**Two scope limits worth knowing before chasing this further** `[43]`: the feature "only protects against drive-by DMA attacks **after the OS is loaded**. It's the responsibility of the system firmware/BIOS to protect against attacks via the Thunderbolt 3 ports during boot", and it "doesn't protect against DMA attacks via 1394/FireWire, PCMCIA, CardBus, or ExpressCard". The ports in scope are the hot-pluggable PCIe classes — "Thunderbolt, USB4, and CFexpress" — with time-based enforcement (blocked if plugged in before an authorized user logs in or while the screen is locked); per-device, "A value of 2 means that the device driver supports DMA-remapping".

**Firmware-menu caveat:** the `AMD CBS → NBIO Common Options → IOMMU` path and the `SVM Mode` label are **board-vendor convention, not specification** — the skill marks them `[no-spec]` `C:low` because no AMD or Microsoft document specifies them and they vary by vendor and AGESA version. Treat them as a place to look, not a fact to quote.

**Confidence:** high on the requirement set and the two-diagnosis rule (`C:high` `V:durable`, Microsoft Learn Tier-2). `C:medium` on the "Auto→Enabled doesn't help" corollary; `C:low` on the firmware menu paths.

---

### diag-nested-hyperv-on-ryzen-7000
**Routed to:** `16-windows-platform.md` §16.5 — **no §0.2 row**; routed via SKILL.md §Routing → `16-windows-platform.md`, whose §16.1.3 symptom table names §16.5 ("Nested Hyper-V refuses to start inside a VM on an AMD host"). Correct chapter. `errata.md` E13 is the matching entry.

**Answer:** **Yes — nested virtualization on AMD under Hyper-V is supported**, and `errata.md` E13 exists because the claim "Hyper-V nested virtualization is Intel-only" is a live misconception. But **your Ryzen 7000 is not the operative question**, and that is the substance of the answer.

**Microsoft publishes separate prerequisite sets for the two vendors on the same page**, selected by an Intel tab and an AMD tab. The **AMD** set is `[460]`:

- **"The Hyper-V host must be either Windows Server 2022 or later, or Windows 11 or later"**
- **"VM configuration version 9.3 or higher"**

(The Intel set, for contrast, is Windows Server 2016 or later / Windows 10 or later with configuration version 8.0 or higher — **it does not apply to you**.)

The AMD prerequisites sit under the page's own heading **"AMD EPYC / Ryzen processor or later"**, so Microsoft does state a processor-family requirement. `[460]`

**What Microsoft names nowhere is a Zen generation.** "EPYC / Ryzen or later" is a **product-family phrase, not a silicon generation**, and the operative gates are the host OS version and the VM configuration version. **Do not convert it into "Zen 2 or later" or any similar reading.** `[41][460]`

**The checklist, in the order that produces the fewest wasted attempts** (§16.5):

1. **Host OS** — Windows Server 2022 or later, or Windows 11 or later. You have Windows 11, so this passes. (Note: an AMD host on Windows Server 2019 or Windows 10 **cannot do this at all**, however new the processor is.)
2. **VM configuration version 9.3 or higher.** **This is the gate that usually fails.** A virtual machine carried forward from an older host **keeps the configuration version it was created with**, so this fails on machines whose host and processor are both new enough; the version is a per-VM property and **has to be raised explicitly**.
3. **VM powered off**, then:
   `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`
   (the same cmdlet with `$false` reverses it). `[460]`
4. **Networking**, if the innermost guests need network access through the same adapter: either enable MAC address spoofing on the level-1 VM's adapter —
   `Get-VMNetworkAdapter -VMName <VMName> | Set-VMNetworkAdapter -MacAddressSpoofing On`
   — or use NAT inside the level-1 VM. This is the same on both vendors. `[460]`

**Steps 1 and 2 are the two gates that differ from the Intel case, and both are properties of the host and the VM rather than of the silicon — which is why "my Ryzen 7000 should support this" is never the operative question.** `[460]`

**Limits on what you can run inside.** Microsoft's stated limits are vendor-neutral: the VM must be turned off to adjust its memory, and **"Virtualization applications other than Hyper-V aren't supported"** inside a Hyper-V VM — so a nested VMware or VirtualBox installation is outside what Microsoft supports. `[41]`

**One AMD-side design note, in case you are writing the nested hypervisor rather than running one** (§16.5.1): there is **no enlightened VMCS on AMD** — that is an Intel-only construct, and AMD has no equivalent because the VMCB is already ordinary memory that software reads and writes directly. But it does **not** follow that Hyper-V has no AMD-side enlightenment: the TLFS states AMD "has reserved space in the VMCB for hypervisor use, as well as an associated clean bit. The reserved bytes are in the control section, **offset `0x3E0-0x3FF`**, of the VMCB" and "**The clean bit is bit 31**", which Hyper-V uses via `HV_SVM_ENLIGHTENED_VMCB_FIELDS`. The hypervisor must invalidate that clean bit whenever it modifies the area. `[464]` Watch `EnlightenedNptTlb`, which works the opposite way round from the obvious reading (see diag-stale-guest-tlb).

**Citation note:** Windows behaviour, so Microsoft Learn (Tier-2), not the APM. The nested SVM mechanism itself (vmcb12/vmcb02, intercept merging) is owned by `15-nested-virtualization.md`.

**Confidence:** high — `C:high` `V:durable`. A documentation caveat the chapter records: the "AMD EPYC / Ryzen processor or later" heading is an `<h3>` element and a text-extraction proxy that flattens headings **drops it** — an earlier draft wrongly concluded Microsoft had removed the phrase. Re-fetch with HTML preserved before asserting it is gone.

---

### diag-vmware-virtualbox-coexistence
**Routed to:** `16-windows-platform.md` §16.6 (via `00-quickref.md` §0.5 item 4, "Can I run VMware or VirtualBox with Hyper-V enabled?") — correct route. `errata.md` E15 is the matching entry.

**Answer:** **No — and the old "turn Hyper-V off first" advice is superseded.** `errata.md` E15 records it as a misconception; §0.5 states the current answer as "Yes, with documented limits".

**Both run over the Windows Hypervisor Platform (WHP) with VBS enabled** `[47][478]`:

- **VMware Workstation Pro from 15.5.5** — Broadcom calls it **"Host VBS Mode"**.
- **VirtualBox from 6.0**, whose release notes read "Added support for using Hyper-V as the fallback execution core on Windows host, to avoid inability to run VMs at the price of reduced performance".

**What WHP is.** It "adds an extended user-mode API for third-party virtualization stacks and applications to create and manage partitions at the hypervisor level", configure memory mappings, and create and control virtual processors; a set of C-style functions returning `HRESULT`, exported from **`WinHvPlatform.dll`**, with entry points such as `WHvCreatePartition`, `WHvSetupPartition`, `WHvMapGpaRange` and `WHvRunVirtualProcessor`. `[100]`

**What changes for you — a role change, not a feature loss.** A third-party VMM running over WHP **is no longer the software that executes VMRUN.** It is a user-mode process whose guest is a partition created and scheduled by Hyper-V, and **its guest is therefore already nested** — every cost in `15-nested-virtualization.md` applies to it. `[100]`

**The documented limits** (these are documented rather than incidental) `[47][48]`:

- **Slower virtual machines**
- **No nested virtualization inside the WHP-backed guest**
- **No performance counters**
- **No RTM/HLE**
- **No PKU**
- **VirtualBox has continued to label the path experimental**

**Your three options, and there is no fourth** (§16.6.2):

| Option | What it means on AMD | What it costs |
|---|---|---|
| **Run over WHP** | VMM becomes a user-mode client of Hyper-V; its guest is a Hyper-V partition, already nested | the limits above; speed per `18-performance.md` |
| Run nested under Hyper-V | VMM inside a Hyper-V VM with `-ExposeVirtualizationExtensions $true` (§16.5) | Microsoft doesn't support non-Hyper-V virtualization apps inside a Hyper-V VM — a development arrangement, not a supported one |
| Turn the hypervisor off | `bcdedit /set hypervisorlaunchtype off`, reboot; the VMM executes VMRUN itself | **every** Hyper-V-backed feature stops: VBS, memory integrity, Credential Guard, WSL 2, Windows Sandbox, Docker Desktop's Windows backends |

**Why the third option is now usually the wrong first move:** it "trades the machine's security posture for a compatibility problem the first option already solves". `[47][101][474]`

**The fourth option that does not exist:** "share the extensions". The architecture provides **no way for two pieces of software to hold SVM host mode on one logical processor at the same time**, which is why every row above is a form of giving up direct ownership or taking it entirely. `[101]`

**One thing to check before you decide anything:** you may already have the hypervisor running without having installed Hyper-V. **WSL 2** "uses … a lightweight utility virtual machine" and is "running as a Hyper-V virtual machine" `[473]`; **Windows Sandbox** "relies on the Microsoft hypervisor" `[471]`; **Docker Desktop's default Windows backend is WSL 2** `[477]`. **From the processor's point of view these are indistinguishable**, which is why enabling any one changes the behaviour of all the others and of any third-party VMM. `[101][473]`

**How much slower** is a performance question the chapter defers to `18-performance.md` — and note §18.4 records that **no WHP-versus-bare-SVM measurement exists** in this corpus.

**Citation note:** Windows/vendor behaviour, so Microsoft Learn, Broadcom and Oracle documentation (Tier-2), not the APM.

**Confidence:** high — `C:high` `V:durable`, with the version numbers (15.5.5, 6.0) stated as durable historical facts. `C:medium` only on the deferral of the speed figure.

---

### diag-gpu-passthrough-client
**Routed to:** `16-windows-platform.md` §16.8 (§16.8.1 / §16.8.2) — **no §0.2 row**; routed via SKILL.md §Routing → `16-windows-platform.md`, whose §16.1.3 symptom table names §16.8.1 ("A discrete GPU cannot be assigned to a VM on a desktop board"). Correct chapter.

**Answer:** **Not by Discrete Device Assignment.** The chapter states it directly: "the answer to 'can I pass my Radeon through on Windows 11' is: **not by DDA**, which Microsoft documents only for Windows Server on server-class hardware; the supported client paths are the paravirtualized ones, and they **share** the GPU rather than assigning it." `[467][469][470]` `C:medium`

**Why DDA is out — two independent hardware requirements a desktop board does not meet** `[467][468]`:

1. **Host OS and platform class.** Microsoft documents DDA for a host "running **Windows Server 2016 or later**" and requires "**server class hardware** that's capable of granting the operating system control over configuring the PCIe fabric (**Native PCI Express Control**)". It is **not documented as a client-Windows capability**, and a desktop AM5 board does not meet the platform requirement.
2. **Isolation.** The PCIe root complex must "support **Access Control Services (ACS)**, which enables Hyper-V to force all PCIe traffic through the Input-Output Memory Management Unit". Microsoft notes these capabilities "may be hidden in BIOS settings, sometimes behind SR-IOV configuration options".

Two further DDA limits, if you are evaluating server hardware instead: **devices using legacy INTx PCI interrupts are not supported**, and **DDA is one GPU to one VM** — "each physical GPU can provide acceleration to at most one VM". `[467][469]`

**How to confirm on a given machine:** Microsoft ships a survey script, **`SurveyDDA.ps1`**, that identifies compatible hardware and reports the MMIO space a device needs — the Windows counterpart to a Linux user's inspection of kernel isolation groups. Also `Get-VMHostAssignableDevice`. `[467]` (The assignment sequence, for reference, is `Dismount-VMHostAssignableDevice -Force -LocationPath $locationPath`, then `Add-VMAssignableDevice -LocationPath $locationPath -VMName <VMName>`, then install the vendor driver in the guest. The device is addressed by **PCI location path**; **there is no Windows equivalent of a kernel isolation group.** `[468]`)

**What a client Windows 11 PC actually gets instead** `[469][470][472][476][479]`:

- **WDDM GPU paravirtualization** — the mechanism a client PC reaches in everyday use, available "starting in **Windows 10, version 1803 (WDDM 2.4)**", whose documented consumers are **Hyper-V virtual machines (client and server), Windows Sandbox, and Hyper-V isolated containers**. `[470]`
- **Windows Sandbox** exposes it as a configuration element: **`vGPU`** takes `Enable`, `Disable` or `Default`, where `Default` "currently denotes that vGPU is enabled" and `Disable` falls back to software rendering. Microsoft warns that "Enabling virtualized GPU can potentially increase the attack surface of the sandbox". `[472]`
- **WSL** gets GPU acceleration on "**Windows 11 or Windows 10, version 21H2 or higher**" with the GPU vendor's ordinary Windows driver installed on the host — **the guest does not take the device away from the host.** `[479]`
- **GPU partitioning** is the sharing mechanism on the server side: "Beginning with **Windows Server 2025**, GPU partitioning allows you to share a physical GPU device with multiple virtual machines", giving each "a dedicated fraction of the GPU" through the **SR-IOV** interface; the cmdlet is **`Add-VMGpuPartitionAdapter`**. `[469][476]`

**The key distinction to set expectations:** all of the client paths **share** the GPU with the host; none of them hands the device to the guest. If your requirement is exclusive device ownership (e.g. for a guest-side driver that must own the hardware), the skill says Windows client does not offer it.

**An explicit Linux warning, because it is the usual next move:** §16.11 marks the VFIO path as a Linux-only contrast section — `vfio-pci`, `amd_iommu=on`, `/sys/kernel/iommu_groups` — and notes **none of it exists on Windows**; reaching for it "is the commonest way a Linux-trained reader misdiagnoses a Windows machine". `[57]` Relatedly, GPU reset quirks handled on Linux by out-of-tree work such as `vendor-reset` **have no Windows analogue, because a Windows host never hands a client GPU to a guest in the first place** — which removes the failure mode rather than solving it. `[no-spec]` `[57]` `C:low`

**Open item the chapter flags:** Microsoft documents GPU partitioning for Windows Server 2025 and WDDM GPU paravirtualization for client Hyper-V/Sandbox/isolated containers, but **this corpus found no single Learn page stating the client Hyper-V GPU-partitioning story end to end.** §16.8.2 states only what is sourced.

**Confidence:** high that DDA is server scope (`C:high`, Microsoft Learn Tier-2); **`C:medium`** on the summary answer itself, exactly as the chapter marks it, and the client GPU-partitioning story is an acknowledged documentation gap. Which product supports GPU partitioning in which release is deferred to `90-dated-landscape.md` (`V:dated`).

---

### diag-confirm-vbs-status
**Routed to:** `16-windows-platform.md` §16.10 (with §16.9 for the hypervisor half) — **no §0.2 row**; routed via SKILL.md §Routing → `16-windows-platform.md`. Correct chapter.

**Answer:** These are **two different questions** and the chapter answers them with two different checks — that separation is the substance of the answer.

**Is VBS running?** `msinfo32.exe` → **System Summary** → the field **"Virtualization-based Security Services Running"**. The scriptable equivalent is:

```
(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning
```

— a **non-empty list** of running services means VBS is running. For Credential Guard specifically, Microsoft's documented check is to "confirm that **Credential Guard** is shown next to **Virtualization-based Security Services Running**". Microsoft explicitly says checking whether **`LsaIso.exe` is running "isn't a recommended method"**. `[465]`

**Did the hypervisor launch?** Two checks, and neither alone is sufficient:

- **`bcdedit /enum {current}`** → read **`hypervisorlaunchtype`**. It takes the values **`Off`** and **`Auto`**, and Microsoft's boot-option reference describes it as controlling "the hypervisor launch options". `[474]`
- **`systeminfo.exe`** → scroll to the **"Hyper-V Requirements"** section; the reported items are **VM Monitor Mode extensions, virtualization enabled in firmware, second-level address translation, and hardware-enforced DEP**. Every line must read `Yes`. `[475]`

**The caveat that makes this two checks rather than one:** **`hypervisorlaunchtype` reading `Auto` means the hypervisor is on the boot path; it does not by itself prove the hypervisor launched**, because the silicon and firmware layers can still refuse. **Reading `systeminfo` and `msinfo32` together separates those cases.** `[474][475]` `C:medium`

**The from-inside check, which is the most direct evidence a hypervisor is actually running** (§16.9):

- **CPUID leaf 1, `ECX` bit 31** — the "hypervisor present bit"; "if this bit is set, a hypervisor is present". `[463]`
- **CPUID leaf `0x40000000`** identifies which: Hyper-V returns `EBX = 0x7263694D` ("Micr"), `ECX = 0x666F736F` ("osof"), `EDX = 0x76482074` ("t Hv") — **"Microsoft Hv"** — plus the maximum hypervisor CPUID leaf. `[463]`
- **CPUID leaf `0x40000001`** returns the interface signature **`EAX = 0x31237648` ("Hv#1")**, and Microsoft recommends that "software only base compatibility decisions on the interface signature reported through leaf `0x40000001`" rather than on the vendor string. `[463]`

Note: on a stock Windows PC with any Hyper-V-backed feature enabled, **this detection succeeds from inside the ordinary desktop session**, because the desktop is itself in a partition. `[463][101]` `C:medium`

**The full §16.10 table:**

| Question | Command | What to read |
|---|---|---|
| Does this machine meet the Hyper-V requirements? | `systeminfo.exe` | "Hyper-V Requirements" — every line `Yes` |
| Is VBS running, and with what? | `msinfo32.exe` → System Summary | "Virtualization-based Security Services Running" |
| Is Credential Guard among them? | `msinfo32.exe` → System Summary | `Credential Guard` listed next to that field |
| Same, scriptable | the `Win32_DeviceGuard` query above | a non-empty list |
| Is Kernel DMA Protection on? | `msinfo32.exe` | "Kernel DMA Protection" reads `ON` |
| Is the hypervisor on the boot path? | `bcdedit /enum {current}` | `hypervisorlaunchtype` — `Auto` or `Off` |
| Which devices can be assigned? | `Get-VMHostAssignableDevice`, `SurveyDDA.ps1` | server hosts only |
| Is a hypervisor present at all, from inside? | CPUID leaf 1 ECX[31], leaf `0x40000000` | §16.9 |

**The decisive inference, which is why this check matters:** **if `msinfo32` reports virtualization-based security running, no amount of work on the `VM_CR` and `EFER` chain in `01-svm-intro.md` will free SVM** — the answer is WHP (§16.6), not a firmware setting. `[101][465]`

The chapter also notes the pre-rebuild corpus diagnosed all of this with `dmesg`, `lspci`, `/sys` and `cpuid`, **none of which exist on the target platform**; the table above is the first-party Windows equivalent set.

**Citation note:** Windows behaviour, so Microsoft Learn and the TLFS (Tier-2), not the APM.

**Confidence:** high — the commands and what to read are `C:high` `V:durable`. `C:medium` on the "`Auto` does not prove it launched" caveat and on the hypervisor-present detection note.

---

### diag-vbs-cost-figure
**Routed to:** `18-performance.md` §18.2 (via §0.2 row "How much does VBS cost me?") — correct route.

**Answer:** The skill gives you **one** client AMD measurement with conditions, and is explicit that it "has the worst public data in the chapter". Here it is with every condition attached, because a figure without its conditions is not usable.

**The measurement.** **ComputerBase** measured Windows 11 **memory integrity (HVCI) on versus off** on a **Ryzen 7 5800X (Zen 3)** paired with a **Radeon RX 7900 XTX** at **1280×720** — deliberately CPU-limited — and reported about **6% on average frame rate and about 8% on frame times**; published **2023-03-16**. `[554]` `C:medium`

**Four qualifications that matter more than the number:**

1. **The per-title spread is far wider than the suite average.** In the same test **Forspoken showed essentially no measurable difference**, while **Diablo II: Resurrected lost over 30% on frame times**. **A suite average of 6% therefore says nothing about any individual title.** `[554]` `C:medium`
2. **It is a Zen 3 result only.** That article benchmarked a dozen or more processors across AM4, AM5 and LGA 1700, but **only the Ryzen 7 5800X received a memory-integrity on/off comparison**; the Zen 4 parts (7950X3D, 7950X, 7900X3D, 7900X, 7800X3D, 7700X) and the 5800X3D ran with the feature **enabled throughout**. **The article supports no Zen 3 versus Zen 4 statement about this cost.** `[554]` `C:medium`
3. **It measures less than "turning all of this off".** The toggle was **memory integrity alone, with kernel isolation left on in both arms** — so the 6% is the **marginal cost of code-integrity enforcement on a machine that already has the hypervisor resident**, and it does **not** include the whole-machine nested-paging term. Someone asking "what do I get back by turning all of this off" is asking about a **larger** number this article does not measure. `[554]` `C:medium`
4. **It is a Tier-3 media benchmark, quoted attributively, and one mandatory field is missing.** The article does not publish RAM timings, the Windows build or the graphics driver revision, so **the figure may not be promoted to a platform constant.** `[554]` `C:medium`

**Figures the chapter explicitly refuses to carry.** The widely relayed ranges **"5–10% system-wide" and "5–25% in games"** have **no traceable primary source** in this knowledge base — they appear in secondary write-ups without hardware, workload, or a statement of which setting was toggled. They are recorded as **unresolved rather than averaged** with the 6%. `[554]` `C:low` (Do not average them; the chapter's standing rule is to present conflicting measurements side by side and never average.)

**Where the cost comes from** (§18.2.1) — four mechanisms, each able to dominate:

- With the hypervisor resident, **Windows runs as a guest** and operations the hypervisor intercepts become `#VMEXIT`s that did not exist with the hypervisor off. `[no-spec]` `[42][44]`
- **Nested paging is active for the whole machine**, not only for VMs, so the two-dimensional walk is paid by ordinary desktop and game workloads; its cost scales with **TLB miss rate and page size**, not with anything the security feature does. `[no-spec]` `[42][56]`
- Kernel code-integrity enforcement moves page-permission decisions to a more privileged level; on AMD the primitive is **GMET**, and the benchmarking article notes parts lacking equivalent execution-control support can cost **significantly more** via a fallback emulation path. `[no-spec]` `[42][554]` `C:medium`
- Calls into the more privileged level cost at least one world switch each — and **no measurement of such a transition in cycles on an AMD part is recorded here.** `[no-spec]` `[45]`

**Why your machine may differ from the 6%** (§18.2.4) — three machine properties move this more than the setting does: **how often the lengthened walk is actually paid** (a small resident set can lose nothing; pointer-chasing loses measurably), **page size** (2 MB pages on both dimensions shorten the walk, so two systems with different large-page availability are not running the same experiment), and **whether the part has the execute-trap extension**. A measurement of this feature is **as much a measurement of one machine's memory behaviour as of the feature**. `[56][554]` `C:medium`

**If you want a number for your own machine**, §18.2.4 says what a usable figure must state at minimum: the processor and generation; the graphics card and whether the test was processor-bound at those settings; the exact title/benchmark, resolution and quality; **which setting was toggled** (memory integrity alone, the full security feature set, or the hypervisor entirely); whether large pages were available; and the Windows build. Note also that a **GPU-bound test can hide a processor-side regression entirely**, so a frame-rate delta at high resolution and a CPU-side overhead figure are not comparable quantities. `[42][554]`

**Citation note:** this is a measurement, so per SKILL.md it cites its own source — **ComputerBase (Tier-3), quoted attributively** — not the APM. Demanding an APM anchor here would produce a fabricated citation.

**Confidence:** medium, and the skill marks it so. The measurement is `C:medium` `V:durable`; the circulating 5–10%/5–25% ranges are `C:low` and are **not** endorsed. The corpus also records (SKILL.md Known limits) that **exactly one measurement in `18-performance.md` was taken on a client part** — this is it.

---

### diag-sev-es-disabled-on-snp-host
**Routed to:** `17-security.md` §17.1 — **§0.2 has no row for this symptom**; its nearest row ("SEV guest fails to launch / firmware returns an error") would have sent me to `12-sev.md` §12.8, which is **not** the owner. I reached the right chapter from **`errata.md` E17**, which SKILL.md step 3 requires reading before writing and which names `17-security.md` as owner. **Counted as the one §0.2 mis-route in this set.**

**Answer:** **No — it is not a Zen 5 generational change.** `errata.md` E17 exists specifically to correct that reading.

**It is the documented side effect of a security mitigation.** AMD-SB-3023 **footnote 2** reads: *"Applying mitigation **CVE-2025-48514** will result in disabling **SEV-ES** when SEV-SNP is **enabled**."* `[AMD-SB-3023]` `[23]`

**The underlying defect:** CVE-2025-48514 — "SEV firmware lets an SEV-ES guest be created so as to attack an SNP guest". Bulletin **AMD-SB-3023, published 2026-02-10**. Affected: **Milan, Siena/Genoa family, Turin**. Mitigation: **SEV FW 1.37.23 / 1.37.31 / 1.37.41** — and that mitigation is what disables SEV-ES whenever SEV-SNP is enabled. `[AMD-SB-3023]` `[23]`

**Three details that matter, and each is a way the common retelling goes wrong** (`errata.md` E17):

1. **Only SEV-ES is affected — not SEV.** Plain SEV guests keep working.
2. **The trigger is SNP being *enabled*, not merely *supported*.** A part that supports SNP but has it disabled is unaffected.
3. **The fix spans Zen 3, Zen 4 and Zen 5** — Milan (Zen 3), Genoa/Siena (Zen 4) and Turin (Zen 5). **It is not a Zen 5 generational property.** `[AMD-SB-3023]` `[23]`

So your firmware update applied the CVE-2025-48514 mitigation; the behaviour you are seeing is the documented functional cost, and it would have appeared on a Milan or Genoa host too.

**How to confirm:** check the SEV firmware version installed against the mitigation versions above (1.37.23 Milan / 1.37.31 Genoa / 1.37.41 Turin), and check whether SEV-SNP is *enabled* on the host — disabling SNP restores SEV-ES, which is the trade-off the bulletin describes. **This is a deployment planning item, not a bug to report.**

**Severity, with the source named:** AMD scores CVE-2025-48514 **4.0 Medium, CVSS 4.0 only** — AMD is the scoring source; there is no NVD primary for it. `[AMD-SB-3023]` `[23]`

**A neighbouring CVE in the same bulletin, worth ruling out if your symptom is ASID-related rather than SEV-ES-wide:** **CVE-2025-48517** — "SEV-ES guest can be given an ASID from the range reserved for SNP guests" — affects **EPYC 9005 "Turin"/"Turin Dense" only**, mitigated by **SEV FW 1.37.41 only** (TurinPI 1.0.0.6, 2025-06-30), scored **4.6 Medium** by AMD. `[AMD-SB-3023]` `[23]` *That* one is generation-specific; CVE-2025-48514 is not.

**Context on the bulletin, so you read it correctly:** AMD-SB-3023 batches SMM input-validation defects, SEV firmware access-control defects and one microcode bounds-check defect under a single "AMD EPYC™ and AMD EPYC™ Embedded Series Processor Vulnerabilities – February 2026" heading carrying **twenty distinct CVE IDs across twenty-one rows** (one ID appears twice with two different defect descriptions). **The layer must be read from the mitigation column rather than the title**, and the count is itself volatile — AMD revised the bulletin after first publication. `[AMD-SB-3023]` `[23]`

**Citation note:** a CVE and a vendor security bulletin, so per SKILL.md the citation is the **AMD security bulletin `[AMD-SB-3023]`**, not an APM section. There is no APM anchor for this and demanding one would produce a fabrication.

**Confidence:** high — `C:high` `V:durable`, sourced to AMD's own bulletin footnote. Note the firmware version numbers are the mitigation levels stated in the bulletin; current firmware status for a given host is a dated fact to verify locally.

---

### diag-avic-default-state
**Routed to:** `90-dated-landscape.md` §90.6 — **no §0.2 row**; routed via SKILL.md §Routing, which names "**AVIC default-state history**" as belonging to `90-dated-landscape.md` (and `90-dated-landscape.md`'s `Owns:` line claims it explicitly). Correct chapter.

**Answer:** **Both statements you read were true — at different times.** The section exists precisely because "is AVIC on by default?" has had **three different correct answers, and the answer changed recently.**

**The short version:** **AVIC landed in Linux 4.7 and was off by default for its entire life until Linux 6.18**, which enables it automatically on Zen 4 and later parts that **also** report x2AVIC.

- "AVIC has been on by default since *(some older version)*" is **wrong**.
- "AVIC is off by default" is **now wrong** on current kernels and new hardware.

**The timeline** `[610][611]`:

| Release | What changed |
|---|---|
| v4.6 | the `X86_FEATURE_AVIC` CPU feature flag appears |
| v4.7 | AVIC support lands in KVM, **off by default** |
| v5.17 | erratum #1235 named in `avic.c`, in a comment about a missing memory barrier on `IsRunning` |
| v5.19 | the `force_avic` override is added (in `svm.c`); **default unchanged** |
| v6.0 | x2AVIC support; `force_avic` moves into `avic.c` |
| v6.17 | `enable_ipiv` appears; IPI virtualization disabled on the erratum-#1235 families |
| **v6.18** | **the default flips to "auto"**; guest-side Secure AVIC arrives in the same release |
| v6.19 | `X86_FEATURE_X2AVIC_EXT` — x2AVIC for 4096 vCPUs |

**Before:** from introduction until **Linux 6.17 inclusive**, KVM's AVIC switch was a plain boolean defaulting to off — `static bool avic; module_param(avic, bool, 0444);`. AVIC support first appears in `arch/x86/kvm/svm.c` at **v4.7** (112 occurrences at v4.7, none at v4.6). `[610][611]`

**The flip:** **Linux 6.18**, commit **`ca2967de5a5b`** ("KVM: SVM: Enable AVIC by default for Zen4+ if x2AVIC is support"), authored by **Naveen N Rao (AMD) on 2025-09-19**, committed by **Sean Christopherson on 2025-09-23**. Rationale verbatim: *"AVIC and x2AVIC are fully functional since Zen 4, with no known hardware errata. Enable AVIC and x2AVIC by default on Zen4+ so long as x2AVIC is supported (to avoid enabling partial support for APIC virtualization by default)."* `[611]`

**What "default" now means precisely:** an **"auto" mode encoded as `-1`**, distinct from both `y` and `n`, so KVM can tell "user said nothing" from "user said yes". The module parameter accepts the literal string `auto` as well as booleans. In auto mode KVM enables AVIC when **x2AVIC is present in CPUID AND the CPU is Zen 4 or newer**:

```
avic = boot_cpu_has(X86_FEATURE_X2AVIC) &&
       (cpu_feature_enabled(X86_FEATURE_ZEN4) || boot_cpu_data.x86 >= 0x1A)
```

**On a Zen 3 or older part, AVIC therefore remains off unless the user asks for it.** `[610][611]`

**Three further gates apply regardless of the default** `[610]`:

- AVIC **requires nested paging** (`!npt_enabled` disables it).
- It is **refused on an SNP-enabled host lacking `HvInUseWrAllowed`** — KVM logs "AVIC disabled: missing HvInUseWrAllowed on SNP-enabled system".
- Forcing it on a part whose CPUID does not report AVIC needs **`force_avic`**, registered with `module_param_unsafe`, producing "AVIC unsupported in CPUID but force enabled, your system might crash and burn".

**How to confirm on your machine — and a trap:** **reading the parameter back is misleading by design.** The getter resolves auto mode to **`N`**, so `/sys/module/kvm_amd/parameters/avic` **can read `N` on a machine where AVIC is in fact enabled**, until module initialisation has resolved the mode. A follow-up commit on 2026-03-02 ("KVM: SVM: Fix UBSAN warning when reading avic parameter") exists because of this three-valued parameter. `[610]` `C:medium` Also: **firmware can mask AVIC while leaving x2AVIC visible**; KVM detects that and prints `[Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported`, then disables both — so **generation capability tables are not a substitute for reading CPUID on the actual machine.** `[610]`

**What is still disabled, and why you may have read "off":** current mainline still disables **IPI virtualization — not AVIC as a whole** — on **AMD Family 17h (Zen 1 and Zen 2) and Hygon Family 18h**, attributed in-tree to "erratum 1235, which results in missed VM-Exits on the sender and thus missed wake events for blocking vCPUs due to the CPU failing to see a software update to clear IsRunning". `enable_ipiv` and this workaround appear at **v6.17** — one release before the default flip, which is the order that makes the flip safe to reason about. `[610]`

**The disclosure year is settled** (`errata.md` O2). `1235` first appears in `arch/x86/kvm/svm/avic.c` at **v5.17** (absent at v5.16), so a 2025–2026 disclosure is **ruled out**. AMD's publication is Revision Guide **55449**, Family 17h Models 00h–0Fh, p.87, first listed at **rev 1.17, 2019-07**. It is absent from 57095 Rev 1.05 (Genoa) and 58251 Rev 1.30 (Turin) because those are the wrong families. As of 2026-09-26 the remaining document gap is a Family 19h or 1Ah *client* model range, and client PPRs 56176, 56214, 56713 and 57254 have no retrievable first-party copy (`errata.md` E27). `[RevGuide 55449 erratum 1235][610][29][27][25]` `C:high`

**Windows note:** none of the above is Windows behaviour — this is the **KVM/Linux** default-state history, which is the only place a first-party default is documented. On a Windows host the question is settled by `CPUID Fn8000_000A` on the machine.

**Confidence:** high on the timeline and the commit (`C:high`), medium on the parameter-readback trap and the erratum-date question (`C:medium`).

**⚠ V:dated — every statement in this answer is from `90-dated-landscape.md`, a snapshot taken 2026-09-21.** Nothing after that date is covered, and the skill requires that these be reported as a snapshot the reader must **re-verify against the cited source before acting on any version number or default**.

---

## Summary

- **Answered from the skill: 20 of 20.** No question required a fact the skill does not carry.
- **Not covered: 0 questions**, though three answers carry an explicitly stated internal gap: the **KDS endpoint URL/query format** (pub 57230, outside the corpus) in diag-attestation-verify-failure; the **client Hyper-V GPU-partitioning story end to end** (acknowledged open item) in diag-gpu-passthrough-client; and **no WHP-versus-bare-SVM measurement exists** in the corpus, noted in diag-vmware-virtualbox-coexistence and diag-vbs-cost-figure.
- **§0.2 mis-routes: 1** — diag-sev-es-disabled-on-snp-host. §0.2 has no row for "a mitigation disabled SEV-ES"; its nearest row would have sent me to `12-sev.md` §12.8 instead of the owning chapter `17-security.md` §17.1. `errata.md` E17 (read per SKILL.md step 3) supplied the correct owner.
- **§0.2 had no row but SKILL.md §Routing resolved correctly: 6** — diag-driver-rejected-memory-integrity, diag-kernel-dma-protection-off, diag-nested-hyperv-on-ryzen-7000, diag-gpu-passthrough-client, diag-confirm-vbs-status, diag-avic-default-state. For four of those, `16-windows-platform.md` §16.1.3's own symptom table then named the exact section.
- **One within-chapter section drift:** diag-avic-incomplete-ipi routed to §7.2 per §0.2; the decoding tables are at §7.8.1 of the same chapter (and §5.2 of `05-exit-decoding.md`, the owner). Right chapter, adjacent section.
- **Citation tiers used as the skill directs:** APM Vol.2/Vol.3, IOMMU 48882, SEV-API 55766, GHCB 56421, SNP-ABI 56860 for architecture; **Microsoft Learn / TLFS** for all eight Windows symptoms; **AMD-SB-3023** for the CVE symptom; **ComputerBase (Tier-3, attributed)** for the performance figure; **kernel.org / the KVM commit** for the AVIC default history. No APM anchor was invented for a platform, CVE or measurement claim.
