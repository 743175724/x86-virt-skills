# amd-virtualization eval — diagnosis (20 questions)

Answered from the `amd-virtualization` skill only. Route taken: `SKILL.md` →
`references/00-quickref.md` §0.2 (symptom → chapter, plus the Windows-symptoms
block) → the one chapter named → `references/errata.md` before writing.

---

### diag-svm-unavailable-chain
**Routed to:** `01-svm-intro.md` §1.5 (with the MSR definitions in §1.4) — right first time (§0.2 row "CPUID says SVM is present, `VMRUN` still fails")
**Answer:** The near-certain cause is **`VM_CR.SVMDIS = 1`** — SVM disabled by platform firmware. `VM_CR.SVMDIS` **does not prevent CPUID from reporting that SVM is available**, so a BIOS-disabled machine passes the CPUID probe and fails at the `EFER` write; while `SVMDIS` is set, writes to `EFER` treat `SVME` as MBZ, which is exactly the "`#GP`, or the bit reads back 0" pair you are seeing `[APM2 §15.30.1]`, `[APM2 Figure 15-27]`, `[1]`. Setting an `EFER` enable bit for a feature the processor does not support is itself a `#GP(0)` `[APM2 §3.1.7]` `[1]`.

Walk AMD's own detection algorithm, which it gives as pseudocode and names the outcomes of `[APM2 §15.4]` `[1]`:

1. `CPUID Fn8000_0001_ECX[2] (SVM) == 0` → `SVM_NOT_AVAIL`. Nothing recoverable. (Not your case.)
2. `VM_CR.SVMDIS == 0` → `SVM_ALLOWED`. Note the polarity: it is the *absence* of the disable, not the presence of an enable, that clears the gate. **Read `VM_CR` (`C001_0114h`) — this is the discriminator.**
3. `SVMDIS == 1` **and** `CPUID Fn8000_000A_EDX[2] (SVML) == 0` → `SVM_DISABLED_AT_BIOS_NOT_UNLOCKABLE`. There is no key mechanism; only a firmware setting change fixes it. This is the case behind almost every "enable SVM in BIOS" instruction.
4. `SVMDIS == 1` **and** `SVML == 1` → `SVM_DISABLED_WITH_KEY`. SVM-Lock is present, so the block may be releasable with the 64-bit key through `SVM_KEY` (`C001_0118h`), obtained from platform firmware or the TPM `[APM2 §15.31]` `[1]`.
5. Also read **`VM_CR.LOCK` (bit 3)**: while it is set, writes to `LOCK` and `SVMDIS` are *silently ignored*, and it can only be cleared through `SVM_KEY`; it survives INIT and SKINIT. `SVM_KEY` is write-only — reading returns zero — and with `LOCK` set a write *compares* and clears `LOCK` only on a non-zero match; if the key is zero while `LOCK` is one, only a processor reset clears it. Read `VM_CR.LOCK` back after writing `SVM_KEY` to see whether the unlock took `[APM2 §15.30.1]`, `[APM2 §15.31.1]` `[1]`.
6. Only then set `EFER.SVME` (`C000_0080h` bit 12, reset value 0) `[APM2 §3.1.7]` `[1]`, and set `VM_HSAVE_PA` (`C001_0117h`, 4 KB, `#GP` if any low 12 bits are nonzero or the address is ≥ max physical) before the first `VMRUN` `[APM2 §15.30.4]` `[1]`.

**Windows caveat, which the skill puts ahead of the hardware chain (step 0 of §1.5):** if this is a Windows PC with Hyper-V, the Virtual Machine Platform (WSL2), Windows Sandbox, Defender Application Guard, Credential Guard or memory integrity enabled, the Windows hypervisor already holds `EFER.SVME` and your `VM_CR`/`EFER` reads under it are not readings of the physical processor at all. Check `CPUID Fn0000_0001_ECX[31]` (hypervisor-present) *first* `[APM2 §15.2.2]` `[1]`; Microsoft documents that third-party virtualization applications cannot run alongside Hyper-V, memory integrity or Credential Guard (Microsoft Learn, "Virtualization applications do not work together with Hyper-V, Device Guard, and Credential Guard") `[101]`. See `16-windows-platform.md` §16.1.
**Confidence:** high. The Windows step-0 claim is `C:high`; the "everything reads clean" row is `[no-spec]` `C:medium` because the APM does not model a second hypervisor occupying host mode. `errata.md` carries nothing that changes this chain. Note the skill's own open item: `VM_CR.SVMDIS` is called "read-only" in §15.31 and specified as conditionally writable in §15.30.1 — the chapter follows §15.30.1 and flags the conflict.

---

### diag-exit-code-80h
**Routed to:** `05-exit-decoding.md` §5.1 — right first time (§0.2 row "I have an exit code and do not know what it means")
**Answer:** **Your table is right; your reading of Appendix C is wrong.** `80h` is the correct exit code for the VMRUN intercept.

The encoding is **segmented, not per-word**. Appendix C's sentence is that intercept exit codes "are equal to the bit position of the corresponding flag in the VMCB's intercept vector" — where *the intercept vector* means the six 32-bit words at VMCB offsets `000h`–`014h` read as **one contiguous bit array**, not an index inside whichever single word the bit lives in `[APM2 App.C]` `[1]`. Arithmetically:

> `exit code = 32 × (vector number) + (bit position within that vector)`

which reproduces every band: vector 0 → CR reads `00h–0Fh` and CR writes `10h–1Fh`; vector 1 → DR reads `20h–2Fh`, DR writes `30h–3Fh`; vector 2 → exceptions `40h–5Fh`; vector 3 → `60h–7Fh`; **vector 4 → `80h–9Fh`**; vector 5 → `A0h–BFh` `[APM2 App.C]` `[APM2 App.B]` `[1]`. VMRUN is bit 0 of vector 4, so `32 × 4 + 0 = 128 = 80h` — and the table confirms `80h = VMEXIT_VMRUN`, "VMRUN instruction" `[APM2 App.C]` `[1]`.

Reading the bit index inside its own 32-bit word is the misconception, and it collapses five distinct bands onto one — `00h` is `VMEXIT_CR0_READ`, not VMRUN.

**`errata.md` E06 applies and adds a "do not over-correct" warning:** AMD's own sentence is defensible on the contiguous-bit-array reading, so correct the reading, not AMD's sentence `[APM2 App.C]` `[1]` `C:high` `V:durable`. Two boundary notes from the same section: the rule does not extend past `BFh` (`400h`, `401h`, `402h`, `403h`, `407h` and the four negative codes are architectural exits/failure reports, not intercept bits), and for exceptions it reduces to `exit code = 40h + vector` `[APM2 App.C]`, `[APM2 §15.12]` `[1]`.
**Confidence:** high (`C:high`, `V:durable`).

---

### diag-stale-guest-tlb
**Routed to:** `06-nested-paging.md` §6.8 — right first time (§0.2 row "Guest TLB entries are stale after I changed a page table")
**Answer:** You are missing an explicit TLB invalidation on the next `VMRUN`. **`VMRUN` and `#VMEXIT` write CR0, CR3, CR4 and EFER but do not flush the TLB**, whether or not nested paging is on — it is a property of the world switch, so the VMM must invalidate any guest translations its own actions invalidated `[APM2 §15.16]` `[1]`.

The tool is the **`TLB_CONTROL` field, bits 39:32 of the VMCB control area at byte offset `058h`** (the guest ASID is bits 31:0 of the same qword) `[APM2 Table B-1]` `[1]`. Its four — and only four — encodings are `00h` do not flush, `01h` flush entire TLB (all entries, all ASIDs; AMD marks it for legacy hardware only), `03h` flush this guest's entries, `07h` flush this guest's non-global entries; all other encodings are reserved `[APM2 Table 15-9]` `[1]`.

For your exact case: **a hypervisor that modifies a nested page table by decreasing permissions, clearing present bits or changing translations, and re-enters the same ASID, should use TLB command `011b` or `001b` — three or one, not seven**, because a downgrade can affect global entries too `[APM2 §15.16.1]` `[1]`. Support for `03h`/`07h` is optional and enumerated by `CPUID Fn8000_000A_EDX[FlushByAsid]`, **bit 6**; without it, use `01h` `[APM2 §15.16.1]`, `[APM3 App.E]` `[2]`.

Three further traps the section names:

- **`VMRUN` reads `TLB_CONTROL` but does not clear it** — the hypervisor must reset it between entries `[APM2 §15.16.1]` `[1]`.
- **A reserved `TLB_CONTROL` encoding is not caught by a consistency check** — it is absent from VMRUN's illegal-state list, so software must not rely on being told `[APM2 §15.5.1]` `[1]` `C:medium`.
- **`INVLPGA` is not the nested-paging tool.** Its address operand is *always* interpreted as a guest **virtual** address, and AMD states plainly that it provides no means to invalidate a nested translation by guest physical address `[APM2 §15.16.2]` `[1]`. Whole-ASID invalidation via `TLB_CONTROL`, not per-page `INVLPGA`, is the correct baseline once nested paging is on.

Also: if you changed the guest's *paging mode* in the VMCB — CR0 (PG, WP, CD, NW), any CR3 bit, CR4 (PGE, PAE, PSE) or EFER (NXE, LMA, LME) — AMD states a software rule that you must flush the guest's entries `[APM2 §15.16]` `[1]`. And if you intercepted a guest action that would itself have flushed the TLB, the `#VMEXIT` happens and **the TLB is not flushed**; the flush becomes yours `[APM2 §15.16.1]` `[1]`.

**Errata / open-item check:** the chapter answers the circulating "INVLPGA erratum on Genoa and Turin" claim **negatively** — neither public revision guide contains the mnemonic, and **no erratum number exists to cite** `[no-spec]` `[27]` `[25]` `C:high`; the nearest real item is erratum **#1455, "PCID-Based INVLPGB May Fail to Flush Global Translations"** `[RevGuide 57095 erratum 1455]` `[27]`, which is a different instruction. Linux KVM has nonetheless stopped using `INVLPGA` on the NPT path, but that is a maintainer's mailing-list rationale, not an AMD erratum `[200]` `C:medium`.
**Confidence:** high for the architectural rules (`C:high`, `V:durable`); the KVM-side note is `C:medium`.

---

### diag-avic-incomplete-ipi
**Routed to:** `07-virtual-interrupts-avic.md` §7.8 (§0.2 row "`AVIC_INCOMPLETE_IPI` (401h) …"), with §7.2 in the same chapter for the second half of the symptom (§0.2 row "Interrupts stop being delivered to a guest vCPU") — right first time
**Answer:** `401h` is **`AVIC_INCOMPLETE_IPI`**, raised when an IPI could not be delivered to all targeted vCPUs — canonically because at least one target was not allocated to a physical core at the time `[APM2 §15.29.9.1]` `[1]`. AVIC defines exactly two new `#VMEXIT` events, `401h` and `402h` `AVIC_NOACCEL` `[APM2 App.C]` `[1]`.

**How to decode it.** Two payloads:

- **First payload** carries the two written command-register values: **bits 63:32 = the value written to vAPIC ICRH, bits 31:0 = the value written to ICRL** `[APM2 Table 15-25]` `[1]`.
- **Second payload** carries the failure reason: **`ID` in bits 63:32**, reserved 31:12, and an **`Index` in bits 11:0** that is meaningful only for `ID` = 1–3 and reserved otherwise `[APM2 Table 15-26]` `[1]`. (Field-table conventions for exit information live in `05-exit-decoding.md` §5.2.)

**The `ID` values (Table 15-27) — there are six, 0 through 5, not four** `[APM2 Table 15-27]` `[1]`:

| ID | Cause | What it means | Index |
|---|---|---|---|
| 0 | Invalid Interrupt type | Trigger mode was level, or the destination type is unsupported | Reserved |
| 1 | IPI Target Not Running | `IsRunning` of the singlecast/broadcast/multicast target is clear in the physical APIC ID table | Index of the physical/logical table entry for the unscheduled target |
| 2 | Invalid IPI Target | Target ID not covered by the physical or logical ID table | Index of the entry for the invalid target |
| 3 | Invalid Backing Page Pointer | The vAPIC Backing Page Pointer in the Physical APIC ID Table held an invalid physical address | Physical table index for shorthand/broadcast; logical or physical per destination mode for directed IPIs |
| 4 | Invalid IPI Vector | The IPI vector was illegal (`VEC < 16`) | Reserved |
| 5 | Un-accelerated IPI | Destination Shorthand is not Self (Secure AVIC) | Reserved |

`ID = 5` is the Secure AVIC path: in Secure AVIC mode an ICR write whose DSH is not Self traps out with this reason, and the Physical and Logical APIC ID tables are not used at all `[APM2 §15.36.21]` `[1]`.

**For the "a vCPU stopped receiving interrupts" half:** the repeated-exit-plus-silent-vCPU shape points at `ID = 1` (target's `IsRunning` clear — the hypervisor must schedule the target and re-deliver) or `ID = 3` (a bad backing-page pointer in that vCPU's Physical APIC ID Table entry). One adjacent rule in the same chapter's owner for ASIDs is a common cause of an AVIC-era vCPU going deaf after migration: **when a core that last ran a different vCPU of the same VM is used to run a vCPU with xAVIC mode enabled, the VMM must flush with `TLB_CONTROL = 3h` regardless of the respective ASID values**, or stale mappings misdirect virtual APIC accesses to the previous vCPU's backing page `[APM2 §15.29.4.3]` `[1]` (owned by `06-nested-paging.md` §6.7).

**Errata check.** `errata.md` `E09`: x2AVIC is `Fn8000_000A EDX[18]`, not `EDX[14]` — relevant if you are probing capability while debugging this `[APM3 App.E]` `[2]`. `errata.md` `O2` is an **open conflict**: AMD's disclosure date for AVIC erratum **#1235** is unresolved and must not be asserted; what *is* settled is that #1235 is named in `arch/x86/kvm/svm/avic.c` from **Linux 5.17** and absent at 5.16, ruling out a 2025–2026 disclosure `[57]`. The erratum causes missed VM-exits on the sender because the CPU fails to see a software update clearing `IsRunning`, which is why current mainline disables **IPI virtualization** (not AVIC as a whole) on Family 17h/18h — see `90-dated-landscape.md` §90.6, `V:dated`.
**Confidence:** high for the architecture (`C:high`, `V:durable`). The erratum-1235 context is `C:medium` and `V:dated`, and its AMD disclosure date is an open conflict — state both readings, do not pick one.

---

### diag-io-page-fault
**Routed to:** `09-iommu-page-tables.md` §9.6 — right first time (§0.2 row "`IO_PAGE_FAULT` in the event log")
**Answer:** **Can it be retried? No.** An `IO_PAGE_FAULT` is **not recoverable the way a CPU page fault is**: the underlying data fabric and PCIe protocols give the IOMMU no way to tell a device to retry, so the IOMMU **target-aborts** the faulting request, sets the legacy PCI Signaled Target Abort bit where applicable, and logs the event. **There is no faulting-access restart** `[IOMMU 3.11 §2.1.3.2]` `[7]`. For an untranslated **posted** request the device gets no indication at all — a posted write has no completion to carry one — so the write is simply dropped; a non-posted request gets the abort as its completion status `[IOMMU 3.11 §1.1]` `[7][53]` `C:medium`. The practical rule: every page the device may ever touch must be mapped before it touches it; there is no demand paging for a non-PRI device. (An **address translation request** is the deliberate exception — it gets a translation-not-present response with R=W=0 and **creates no event log entry**, which is the point of ATS/PRI `[IOMMU 3.11 §2.5.3]` `[7]`.)

**Decoding `+04 = 2050_0000h`** (bits set: 29, 22, 20), in the fixed decode order:

1. **`EventCode` = bits 31:28 = `2h` → `IO_PAGE_FAULT`**, so the record follows Figure 56 (format owned by `08-iommu-architecture.md` §8.8).
2. **`DeviceID` = bits 15:0 of dword `+00`.** Convert with Bus[15:8] / Device[7:3] / Function[2:0] to locate the device, and use the same value as the Device Table index — through the segment base register if segmentation is enabled.
3. **`GN` = bit 16 = 0** → the faulting address is a **guest physical address** and `D/P[15:0]` is the **DomainID**, not a PASID.
4. **`PR` = bit 20 = 1** → the page was marked **present**, so this is **not** a missing mapping.
5. **`PE` = bit 22 = 1** and **`RW` = bit 21 = 0** → a **read that the cumulative permissions denied**. (`PE` and `RZ` are only meaningful when `PR = 1`.)
6. **`RZ` = bit 23 = 0** → the failure was an **invalid level encoding**, not a reserved bit — which points at `DTE[Mode]`, at a PDE Next Level above `EFR[HATS]`, or at a Next Level not below its own table's level.
7. **`TR` = bit 24 = 0** (an ordinary transaction, not a translation request) and **`I` = bit 19 = 0** (a memory request, not an interrupt).
8. **The address** in dwords `+08`/`+12` is the device virtual address the peripheral asked for — a GPA here, since `GN = 0`. Walk it with §9.1 (host v1 tables) or §9.2 (guest v2/GCR3) as appropriate.

That ordering is the field semantics of the record: `PR` gates the meaning of `PE` and `RZ`; `RW` is meaningful only when `PR=1`, `TR=0`, `I=0`; `GN` selects whether `D/P` is a DomainID or a PASID `[IOMMU 3.11 Table 57]` `[7]`.

**Two follow-ups worth doing.** AMD states that **TLB caching behaviour for an entry that caused an event is undefined** — some implementations insert the entry before verifying it — so **software should invalidate the address that caused the event** `[IOMMU 3.11 §2.1.3]` `[7]`. And if you expected more records than you got, check the suppression bits: DTE `SA`(98) suppresses **all** memory-side `IO_PAGE_FAULT` entries for the device, `SE`(97) logs only the first fault while the DeviceID stays cached, `IG`(133) suppresses interrupt-caused faults, and `IRTE[SupIOPF]` and `Control[SmiFLogEn]` act independently `[IOMMU 3.11 §2.5.3]`, `[IOMMU 3.11 Table 7]` `[7]`.

The enumerated software causes for a memory-side `IO_PAGE_FAULT` are: a reserved paging mode in the DTE, a PTE page-size encoding smaller or larger than that level's default, an invalid level encoding including one exceeding `EFR[GATS]` or `EFR[HATS]`, a non-zero address bit above the root level or in a skipped level, a non-zero reserved bit in a PTE, a clear valid bit, `TV=0` on an untranslated non-interrupt transaction, a PASID outside `EFR[PASmax]`, and read/write/execute/supervisor permission violations `[IOMMU 3.11 Table 44]` `[7]`. Given `PR=1`, `PE=1`, `RW=0`, `RZ=0`, the two that fit are the **permission violation on a read** and the **invalid level encoding**.
**Confidence:** high (`C:high`, `V:durable`), except the posted-request detail (`C:medium`). No `errata.md` entry bears on this decode; note the IOMMU document has **five chapters and no appendices**, so `[IOMMU 3.11 App.x]` is always wrong (`00-quickref.md` §0.1).

---

### diag-passthrough-interrupts-missing
**Routed to:** `10-iommu-interrupt-remapping.md` §10.4 (with §10.3 for the DTE fields) — right first time (§0.2 row "A passthrough device's interrupts never arrive")
**Answer:** Look at the **interrupt remapping path**, not the I/O page tables. Accesses to the interrupt address range go through the interrupt-remapping portion of the IOMMU and **not** through address translation, so a transaction processed as an interrupt has its pretranslated/untranslated attribute ignored — the page tables are explicitly not in this path `[IOMMU 3.11 §2.1.4.2]` `[7]`. The range is `FD_F800_0000h`–`FD_F8FF_FFFFh`; the adjacent `FD_0000_0000h`–`FD_F7FF_FFFFh` is reserved and a request there produces an `INVALID_DEVICE_REQUEST` event `[IOMMU 3.11 Table 3]` `[7]`.

Check, in order:

1. **The device's DTE interrupt cluster (bits 191:128).** `IV`(128) interrupt-map-valid; **`IntCtl`(189:188)**: `00b` = fixed and arbitrated interrupts **target aborted**, `01b` = forwarded unmapped, `10b` = **remapped**, `11b` reserved and reported as an event when `IV=1`. Only `10b` validates against the per-device table `[IOMMU 3.11 Table 7]`, `[IOMMU 3.11 Table 9]` `[7]`. `IntCtl=00b` is a very common cause of "MSIs silently vanish".
2. **`IntTabLen`(132:129)** — `2^IntTabLen` entries, 0000b=1 up to 1011b=2048, `11xxb` reserved and reported as an event when `IV=1`. **A table too short for the vector index is a deny**, so size it fully and disable individual entries rather than truncating the table `[IOMMU 3.11 Table 7]` `[7]`.
3. **Interrupt Table Root Pointer (179:134)** — SPA of the remapping table, **128-byte aligned**, and used **only when `IntCtl=10b`**; otherwise ignored `[IOMMU 3.11 Table 7]` `[7]`.
4. **The IRTE itself.** The index is `MSI Data[10:0]` — the interrupt table offset corresponds directly to data bits 10:0 of the originating MSI message, with the stride set by the 32-bit or 128-bit entry size `[IOMMU 3.11 §2.2.5]` `[7]`. **`RemapEn = 0` is the per-vector deny: the interrupt is target aborted and reported as an `IO_PAGE_FAULT`** `[IOMMU 3.11 §2.2.5.2]` `[7]`. Then the IOMMU builds the new message address by OR-ing `IRTE[23:2]` with bits 63:2 of `FFFF_FFFD_F800_0000h` `[IOMMU 3.11 §2.2.5]` `[7]`.
5. **The message type.** With `DM=0`, only MT 0 (Fixed) and 1 (Arbitrated) are controlled by the DTE and IRTE; MT 2 goes to `SmiFLogEn`, MT 3/4/6 to `NMIPass`, 5 to `InitPass`, 7 to `EIntPass`, 11 to `Lint1Pass`, 14 to `Lint0Pass`, and 8/9/10/12/13/15 are **target aborted**. With `DM=1` only MT 0–1 reach the remapping tables unless `NumIntRemapSup=01b` and `Control[NumIntRemapMode]=01b` `[IOMMU 3.11 Table 19]` `[7]`.
6. **If you are using the guest virtual APIC (posted interrupts),** the full sequence is: check `GASup`/`GAMSup`/`GAEn`/`GAMEn`; pick IRTE size and stride; a 32-bit entry falls back to the basic path; select the DTE for that `DeviceID`; index the IRTE with the incoming vector; `RemapEn=0` → `IO_PAGE_FAULT`; `GuestMode=0` → remap with the wide layout; `GuestMode=1` → post into the guest `[IOMMU 3.11 §2.2.5.2]` `[7]`. Posting sets one bit atomically at `IRTE[GuestVirtualAPICTableRootPointer] + 0200h + ((Vector / 32) << 4)`, bit `Vector mod 32`. The IOMMU then re-reads the IRTE: with **`IsRun=0` and `GALogIntr=1`** it writes a **GA log entry** carrying `GATag` and signals an interrupt (the hypervisor must be draining the GA log, or the wake-up never happens); with **`IsRun=1`** it sends a guest APIC doorbell to the core named by `Destination` `[IOMMU 3.11 §2.2.5.2]` `[7]`. This also requires matching APIC virtualization in the processor — AVIC (`07-virtual-interrupts-avic.md`) `[IOMMU 3.11 §2.2.8]` `[1][7]`.
7. **Feature enablement matrix:** `MMIO 0030h[GASup]`, `MMIO 0018h[GAEn]`, `IV`, `IRTE[GuestMode]` — remapping alone when `GASup=0`; supported-but-not-enabled when `GAEn=0` `[IOMMU 3.11 Table 6]` `[7]`.
8. **After any table edit, invalidate.** `INVALIDATE_INTERRUPT_TABLE` invalidates all cached interrupt information for one device, including a cached guest virtual APIC table base pointer `[IOMMU 3.11 §2.4.5]` `[7]`.
9. **If you see nothing in the event log at all**, that may be suppression rather than success: `IG`(133) suppresses interrupt-caused `IO_PAGE_FAULT` logging, and with `IG=0` the decision falls to `SupIOPF` in the IRTE. The memory-side `SA`/`SE` bits explicitly do **not** affect interrupt events `[IOMMU 3.11 Table 7]` `[7]`.

**Errata check — `errata.md` `E03`:** the IRTE bit-0 field is spelled **`RemapEn`**, not `RemapEm`; `RemapEm` appears nowhere in the specification `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`.
**Confidence:** high (`C:high`, `V:durable`).

---

### diag-sev-launch-failure
**Routed to:** `12-sev.md` §12.8 (status codes and command set), §12.7 (the state machines) and §12.4 (the ASID-reuse handshake) — right first time (§0.2 row "SEV guest fails to launch / firmware returns an error")
**Answer:** Two different problems, in sequence, and the second is the real one.

**`INVALID_PLATFORM_STATE` = status `0x0001`** `[SEV-API 3.24 Table 14]` `[8]`. The firmware refuses commands that are wrong for the current state, so **the state machines are the first thing to check** when you get this. PSTATE has exactly three states — `UNINIT` (0h), `INIT` (1h), `WORKING` (2h) — and **guest commands are only valid in the `INIT` and `WORKING` platform states** `[SEV-API 3.24 §5.1.2]` `[8]`. In `UNINIT` the only permitted commands are `INIT`, `PLATFORM_RESET`, `PLATFORM_STATUS`, `DOWNLOAD_FIRMWARE`, `GET_ID`, `DF_FLUSH` and `NOP` `[SEV-API 3.24 Table 16]` `[8]`. So: you issued `LAUNCH_START` (or similar) before `INIT`, or after a `SHUTDOWN`, or after an S4/S5 transition — **firmware volatile state survives S0–S3 and is lost across S4, S5 and mechanical off**, after which the firmware starts from reset and must be re-initialized `[SEV-API 3.24 Table 17]` `[8]`. Read `PLATFORM_STATUS` (`004h`) to see which state you are actually in. If `INIT` itself fails an integrity check — the persistent PDH/PEK/CEK/OCA store corrupted by a power failure — the platform must be reset with **`PLATFORM_RESET`** `[SEV-API 3.24 §5.1.5]` `[8]`. Note also that `INVALID_GUEST_STATE` (`0x0002`) is the GSTATE analogue; GSTATE has **seven** states, `UNINIT` 0h, `LUPDATE` 1h, `LSECRET` 2h, `RUNNING` 3h, `SUPDATE` 4h, `RUPDATE` 5h, `SENT` 6h, each with its own permitted command set `[SEV-API 3.24 Table 43]` `[8]`.

**`WBINVD_REQUIRED` = status `0x000E`** ("WBINVD instruction required") `[SEV-API 3.24 §4.5]` `[8]`. This is the **ASID-reuse handshake**, and it is the likelier cause of a launch that fails at `ACTIVATE`. Reusing an ASID means reprogramming a key slot while caches and data-fabric write buffers may still hold the previous tenant's data, so the firmware enforces three steps:

1. **`DEACTIVATE`** the previous guest — the firmware uninstalls its key from the memory controller, marks the ASID invalid on all cores, disallows its use by all CCXs, and **records that a `DF_FLUSH` is required for that ASID** `[SEV-API 3.24 §6.21.1]` `[8]`.
2. **`WBINVD` on every hardware thread the previous guest was active on.** x86 system software must do this **before** invoking `DF_FLUSH` `[SEV-API 3.24 §6.22.1]` `[8]`.
3. **`DF_FLUSH`** (`00Ah`), which flushes the data-fabric write buffers per core and records the flush as done for **all** deactivated ASIDs `[SEV-API 3.24 §6.22.1]` `[8]`.

**`ACTIVATE` requires that a successful `DF_FLUSH` has been executed since the last `DEACTIVATE` for that ASID** `[SEV-API 3.24 §6.19.1]` `[8]`. `DF_FLUSH` itself returns `WBINVD_REQUIRED` when the `WBINVD` has not been executed; the companion code is `DF_FLUSH_REQUIRED` = `0x000F` `[SEV-API 3.24 §4.5]` `[8]`. Because `DF_FLUSH` clears **all** previously deactivated ASIDs at once, you may batch many `DEACTIVATE` calls and flush once afterwards `[SEV-API 3.24 §1.3.2]` `[8]`. The whole enforcement exists so that unencrypted data associated with the **previous** key is written back to memory before the key changes `[SEV-API 3.24 §1.3.2]` `[8]`.

Other codes worth having to hand if the sequence shifts: `INVALID_ASID` `0x000D`, `ASID_OWNED` `0x000C`, `ACTIVE` `0x0012`, `INVALID_ADDRESS` `0x0009`, and `RB_MODE_EXITED` `0x001F` (a Mailbox-mode command arrived while the firmware was in Ring Buffer mode — Ring Buffer mode is exited, the command ignored, retry recommended) `[SEV-API 3.24 Table 14]` `[8]`. Also: the API processes commands **serially** — do not issue the next before the previous response arrives `[SEV-API 3.24 §4.7]` `[8]`.

**Terminology, per `00-quickref.md` §0.4:** AMD's name is **`WBINVD_REQUIRED`** (Table 14); `SEV_RET_WBINVD_REQUIRED` and `SEV_RET_DFFLUSH_REQUIRED` are the Linux spellings of the same two codes `[8][350]`. **`errata.md` `O5`** is worth knowing while searching the document: pub 55766 does have a Chapter 7 (Debugging API), and §6.8/Table 61 misprint "ATTESATION"/"ATTESTATON" while the command table spells `ATTESTATION` (`036h`) — search both spellings. Note pub 55766 covers **SEV and SEV-ES only**; SNP firmware commands are in 56860.
**Confidence:** high (`C:high`, `V:durable`).

---

### diag-vc-storm-early-boot
**Routed to:** `13-sev-es-ghcb.md` §13.2 (with §13.5 for the fix) — right first time (§0.2 row "`#VC` storms, or a guest hangs in early boot under SEV-ES")
**Answer:** This is the documented early-boot hazard, and it is a *pre-C-bit* problem, not a handler bug.

**`#VC` is exception vector 29**: precise, contributory, fault-type, **cannot be masked**, and **always** generated by hardware when an SEV-ES-enabled guest is running and a Non-Automatic Exit (NAE) event occurs `[APM2 §15.35.5]` `[1]`. Its error code equals the `#VMEXIT` code of the causing event, so the handler dispatches on an exit code it would otherwise never see `[APM2 §15.35.5]` `[1][9]`.

**The cause of a pre-long-mode hang:** *before long mode or 32-bit PAE paging is established, all guest memory accesses are forced to use the guest's encryption key*, so the hypervisor would only see **ciphertext** in the GHCB. **A guest must therefore avoid any unplanned NAE event until it has discovered the encryption-bit position and marked the GHCB shared** `[GHCB 2.04 §2.5]` `[9]`. If an unplanned NAE fires in that window, the `#VC` handler has no usable GHCB, the VMGEXIT round trip cannot complete, and the guest loops — exactly your symptom. (The C-bit position itself is `11-memory-encryption.md`.)

**What the guest should be using in that window instead:** the **GHCB MSR protocol**, which exists precisely for "when it cannot yet write the GHCB page in the clear — during early boot, and for the small set of operations that must work without one" `[GHCB 2.04 Table 2]` `[9]`. `GHCBInfo` is MSR bits 11:0 and `GHCBData` bits 63:12; the early-boot codes are `0x002` SEV Information Request / `0x001` SEV Information (whose `GHCBData[31:24]` carries the **SEV page-table encryption bit number**, taken by the hypervisor from `CPUID Fn8000_001F EBX[5:0]`), `0x004`/`0x005` CPUID Request/Response, and `0x100` Termination Request `[GHCB 2.04 §2.3.1]` `[9]`. Note the CPUID request returns **one register per invocation** (selector in `GHCBData[31:30]`), does **not** support non-zero sub-leaves, and explicitly does not support function `0x0000_000D` `[GHCB 2.04 §2.3.1]` `[9]`.

**Hypervisor-side causes to rule out, in this order:**

- **Are you intercepting MSR `C001_0130h`?** "The hypervisor must not intercept access to MSR `C001_0130h`, or the guest cannot establish a GHCB at all" `[GHCB 2.04 §2.3]` `[9]`.
- **Did you set the `#VC` intercept?** It is "inadvisable for the hypervisor to set the VMCB intercept bit for `#VC`, since that would prevent the guest handling NAEs at all", and you should likewise avoid intercepting events that occur *inside* the `#VC` handler, such as `IRET` `[APM2 §15.35.5]` `[1]`.
- **Version negotiation.** In the SEV Information value, `GHCBData[63:48]` is the max protocol version, `[47:32]` the min, `[31:24]` the encryption bit number; AMD's example writes `0x0001_0001_2f00_0001` to VMCB offset `0A0h` for version-1-only with encryption bit 47 `[GHCB 2.04 §2.3.1]`, `[GHCB 2.04 §2.4.1]` `[9]`. A guest that cannot support any version in the advertised range must request termination `[GHCB 2.04 §2.4.1]` `[9]` — and after a termination request the guest should HLT-loop or SHUTDOWN as a safeguard, which can *look* like a hang `[GHCB 2.04 §2.3.1]` `[9]`.
- **SEV-SNP only:** GHCB GPA registration is required — the guest must use Register GHCB GPA (`0x012`) before its first GHCB-based VMGEXIT, registering automatically unregisters any previous one, and the hypervisor **must terminate** a guest presenting a GHCB GPA that does not match the registered value `[GHCB 2.04 §2.3.2]` `[9]`. An SNP guest should take the encryption-bit position from the firmware-validated CPUID page, not the SEV Information MSR `[GHCB 2.04 §2.4.2]` `[9]`.
- **Firmware/TMR:** SEV-ES requires x86 system software to donate a **1 MB region on a 1 MB boundary** to the firmware (the Trusted Memory Region) until `SHUTDOWN`, and x86 attempts to access it while donated raise exceptions that frequently destabilise the system `[SEV-API 3.24 §5.1.7]` `[8]`.

**Errata check — `errata.md` `E22` (`[reversed]`):** VMGEXIT's opcode is **`F2/F3 0F 01 D9`** — **both** prefixes are architectural; "F3 only" is the misconception `[APM3 §4 "VMGEXIT"]` `[2]`. The unprefixed `0F 01 D9` is VMMCALL, and the VMGEXIT encoding is interpreted as VMMCALL on processors that do not support it or when not executed by an SEV-ES guest `[APM3 §4 "VMGEXIT"]` `[2]` — a plausible way to produce a mystery early-boot loop if you assembled the wrong form.
**Confidence:** high (`C:high`, `V:durable`). The skill records one relevant gap: the two AE lists (GHCB 2.04 Table 6 vs APM Rev 3.45) are **not in sync** and AMD publishes no erratum channel saying which supersedes — §13.6.2 records the difference rather than resolving it.

---

### diag-attestation-verify-failure
**Routed to:** `14-sev-snp.md` §14.11 (with §14.13 for the key/certificate half) — right first time (§0.2 row "Attestation report fails to verify")
**Answer:** The usual causes split into three groups.

**A. Signature-verification failures.**

- **You are hashing the wrong byte range.** The `ATTESTATION_REPORT` structure runs to `4A0h` — **1184 bytes** — with `SIGNATURE` at `2A0h` (512 bytes), and **the signature covers bytes `0h` to `29Fh` inclusive** `[SNP-ABI 1.59 Table 27]` `[10]`.
- **You are parsing the signature wrong.** The only signing algorithm the ABI defines is **ECDSA P-384 with SHA-384** (algorithm encoding `1h`, curve P-384 encoding `2h`); the 512-byte signature holds **R at offset `000h` and S at `048h`, each zero-extended little-endian**, remainder reserved `[SNP-ABI 1.59 App.B]` `[10]`. Big-endian/DER assumptions fail here.
- **`MaskChipKey` is set.** When `MaskChipKey` is 1 the firmware **writes zeroes into `SIGNATURE` instead of signing at all**, and also blocks the guest from using the VCEK in key derivation. (`MaskChipId` separately zeroes `CHIP_ID`.) `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §3.6]` `[10]`
- **Wrong key, or the wrong certificate for the TCB.** `SIGNING_KEY` (bits 4:2 at offset `48h`) encodes 0 legacy VCEK, 1 VLEK, 2 chip-secret VCEK, 3–6 reserved, 7 none `[SNP-ABI 1.59 Table 27]` `[10]`. The firmware derives the signing key from the systemwide **`ReportedTcb`**, so **you must fetch the certificate for exactly that TCB** — a report only proves the platform was at *some* TCB at or below the installed one, and the verifier must independently require `REPORTED_TCB` ≥ its own accepted baseline `[SNP-ABI 1.59 §3.4]`, `[SNP-ABI 1.59 §2.2]` `[10]`. `ReportedTcb` exists precisely so a host can install new firmware and keep signing with the *old* key until guest owners have fetched new certificates `[SNP-ABI 1.59 §3.4]` `[10]`. The legacy VCEK chain comes from the AMD Key Distribution Service; the CSVCEK chain is retrieved on-device (AMD Root CA → AMD IDevID Signer CA → IDevID → … → CSVCEK, Caliptra 1.x formats, `SNP_CSVCEK_CERT` `F0h`); the VLEK is derived from a per-CSP seed at AMD's Key Derivation Service and installed with `SNP_VLEK_LOAD` (`CDh`) `[SNP-ABI 1.59 §2.2]`, `[SNP-ABI 1.59 App.C]`, `[SNP-ABI 1.59 §3.7]` `[10]`. If the key selection is unsatisfiable the firmware returns `INVALID_KEY` rather than a bad report `[SNP-ABI 1.59 §7.3]` `[10]`. **KDS endpoint URLs and per-TCB query parameters are in pub 57230, which is not part of this corpus** `C:medium` — the skill does not state them.
- **You skipped the zero checks.** Verifiers are told to check that every reserved field is zero `[SNP-ABI 1.59 §7.3]` `[10]`. `AUTHOR_KEY_DIGEST` is zero unless `AUTHOR_KEY_EN` is 1 `[SNP-ABI 1.59 Table 27]` `[10]`.

**B. "Nonsense TCB numbers" — this is the single most likely parser bug.** **`TCB_VERSION` is a 64-bit structure whose field layout differs by product line:** Table 3 for **"Venice"** is 23:16 SNP, 15:8 TEE, 7:0 FMC, 63:24 reserved, **no boot-loader field**; Table 4 for **"Turin"** is 63:56 MICROCODE, 31:24 SNP, 23:16 TEE, 15:8 BOOT_LOADER, 7:0 FMC; Table 5 for **"Genoa" and "Milan"** is 63:56 MICROCODE, 55:48 SNP, 15:8 TEE, 7:0 BOOT_LOADER. **A parser that assumes one layout misreads the others** `[SNP-ABI 1.59 §2.3]` `[10]`. There is also a separate 256-bit **`ETCB_VERSION`** (`CURRENT_ETCB` at `220h`, `LAUNCH_ETCB` `240h`, `COMMITTED_ETCB` `260h`) — for "Venice" it spans 14 named fields from `IP_KEY_MANAGER` at bits 7:0 up to `AMD Root Guest` at 111:104 `[SNP-ABI 1.59 §2.4]` `[10]`.

**C. Structural/offset mistakes.** Report offsets that commonly trip parsers: `VERSION` `00h`, `POLICY` `08h`, `SIGNATURE_ALGO` `34h`, `CURRENT_TCB` `38h`, `PLATFORM_INFO` `40h`, flags at `48h`, `REPORT_DATA` `50h`, `MEASUREMENT` `90h` (48 B), `HOST_DATA` `C0h`, `REPORT_ID` `140h`, `REPORT_ID_MA` `160h`, **`REPORTED_TCB` `180h`**, `CHIP_ID` `1A0h` (64 B), `COMMITTED_TCB` `1E0h`, `LAUNCH_TCB` `1F0h`, `SIGNATURE` `2A0h` `[SNP-ABI 1.59 Table 27]` `[10]`. Two more:

- **`POLICY` bit 17 is reserved and must be one**, which is why the minimal SMT-permitting policy reads `0x30000`, not `0x10000` `[SNP-ABI 1.59 Table 12]` `[10]`.
- A **host-requested** report (`SNP_HV_REPORT_REQ`, `96h`) is marked by `VMPL = 0xFFFFFFFF` and a zero-filled `REPORT_DATA` — do not mistake one for a guest report `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §8.33]` `[10]`.
- If `REPORT_ID_MA` is populated, a **migration agent** is inside the guest's TCB and **its own report must also be verified** `[SNP-ABI 1.59 §4.11]` `[10]`.

**Errata check — `errata.md` `E25`:** the report's **`VERSION` has moved across firmware ABI revisions — 3h, then 5h, then 6h — and 4h never existed**, so a parser (or a corpus) that whitelists "2/3/5" is enforcing a stale set and will reject valid reports `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`. The *current* value for a given firmware revision is version-bearing and lives in `90-dated-landscape.md`.

**Finally, a design check rather than a parse check:** attestation must be evaluated somewhere the host cannot reach. The report is signed by the AMD-SP and unforgeable by the hypervisor, but nothing stops a malicious host tampering with a verifier it also runs `[SNP-ABI 1.59 §7.3]` `[10]` `C:medium`.
**Confidence:** high for the layout and algorithm (`C:high`); `C:medium` for the KDS-interface and revocation-granularity points, and the skill states outright that the KDS endpoint specification (pub 57230) is not in the verified corpus.

---

### diag-vmm-cannot-use-amd-v
**Routed to:** `16-windows-platform.md` §16.1 — right first time (§0.2 row ""AMD-V is disabled in BIOS" but BIOS says it is on")
**Answer:** **The product is reporting a symptom, not a cause.** On this machine the **Windows hypervisor already holds `EFER.SVME`**, and your VMM cannot have it.

- Microsoft states the constraint without vendor vocabulary: "many virtualization applications depend on hardware virtualization extensions" — the page names "Intel VT-x and AMD-V" — but **"only one software component at a time can use this hardware. Virtualization applications can't share the hardware."** (Microsoft Learn, "Virtualization applications do not work together with Hyper-V, Device Guard, and Credential Guard") `[101]` `C:high`.
- On AMD the resource claimed is not a VMXON region but **`EFER.SVME` plus the host state-save area**, so the rule is "whoever set `EFER.SVME`" `[101]` `C:medium`.
- **Enabling any one of these launches the Windows hypervisor at boot, whether or not a VM is ever created:** the Hyper-V role, the **Virtual Machine Platform** optional component (which **WSL 2** uses), **Windows Sandbox**, **Docker Desktop's Windows backends**, **memory integrity**, or **Credential Guard** `[101]` `C:high`. From the processor's point of view these are indistinguishable, which is why enabling one changes the behaviour of all the others `[101][473]` `C:high`.
- Once that has happened, **the Windows you interact with is a guest**: the root partition, running in VTL0 above the hypervisor, with the hypervisor holding SVM host mode. VBS is a Hyper-V-backed feature, which is why **"Hyper-V is not installed" is not evidence that SVM is free** (Microsoft Learn, "Hyper-V architecture") `[44][101]` `C:high`.
- **There is no fourth option.** The architecture provides no way for two pieces of software to hold SVM host mode on one logical processor at the same time `[101]` `C:high`.

**Confirm it in one step** (§16.9, §16.10): `CPUID` leaf 1, **`ECX` bit 31** is the hypervisor-present bit — "if this bit is set, a hypervisor is present"; leaf `0x40000000` returns the vendor identity, Hyper-V returning `EBX=0x7263694D`, `ECX=0x666F736F`, `EDX=0x76482074` — **"Microsoft Hv"**; leaf `0x40000001` returns the interface signature `EAX=0x31237648` ("Hv#1"), and Microsoft recommends basing compatibility decisions on that signature rather than the vendor string (Microsoft Learn, TLFS — Feature Discovery) `[463]` `C:high`. Cross-check with `msinfo32` → "Virtualization-based Security Services Running" and `bcdedit /enum {current}` → `hypervisorlaunchtype` `[465][474]`.

**Your three options** (§16.6.2):

| Option | What it means on AMD | What it costs |
|---|---|---|
| Run over the **Windows Hypervisor Platform** | Your VMM becomes a user-mode client of Hyper-V; its guest is a Hyper-V partition and is **already nested** | No nesting inside the guest, no performance counters, no RTM/HLE, no PKU; slower VMs `[100][47][48]` |
| Run **nested** under Hyper-V | Inside a Hyper-V VM with `-ExposeVirtualizationExtensions $true` (§16.5) | Microsoft does not support non-Hyper-V virtualization applications inside a Hyper-V VM — a development arrangement, not a supported one `[41]` |
| **Turn the hypervisor off** | `bcdedit /set hypervisorlaunchtype off`, then reboot; your VMM executes `VMRUN` itself | **Every** Hyper-V-backed feature stops: VBS, memory integrity, Credential Guard, WSL 2, Windows Sandbox, Docker Desktop's Windows backends `[101][474]` |

The third was the standard advice before the WHP path existed and is **now usually the wrong first move** — it trades the machine's security posture for a compatibility problem the first option already solves `[47][101][474]` `C:high`.

**Errata check — `errata.md` `E15`:** the "turn Hyper-V off first" advice is **superseded**. VMware Workstation Pro supports the WHP path from **15.5.5** ("Host VBS Mode"), VirtualBox from **6.0** `[47][48][478]` `C:high` `V:durable`. Also `E10`: on AMD hosts the hypervisor image is **`Hvax64.exe`**, not `Hvix64.exe` — and **both x64 images are present in `%SystemRoot%\System32` on every x64 Windows installation** because the selection is made at boot, so finding the Intel-build image on an AMD machine is not evidence of a misconfiguration `[46]`.
**Confidence:** high. Source is Microsoft Learn (Tier-2), not an AMD manual — per the skill's output standards, Windows behaviour has no APM section and demanding one produces a fabricated citation.

---

### diag-probe-chain-reads-clean
**Routed to:** `16-windows-platform.md` §16.1.1 — right first time (§0.2 row "My VMM/driver/debugger cannot execute VMRUN on Windows"; `01-svm-intro.md` §1.5's own symptom table forwards the identical row here)
**Answer:** **You asked the questions in the wrong order.** The hardware chain is a statement about silicon and firmware; it says nothing about who already owns host mode.

`01-svm-intro.md` gives the correct hardware chain — CPUID `Fn8000_0001 ECX[2]` → `VM_CR` (`SVMDIS`, `LOCK`) → `EFER.SVME` → `VM_HSAVE_PA`. On a Windows PC with any Hyper-V-backed feature enabled, **every stage of that chain reads healthy and the VMM still cannot start**, because the chain describes the hardware and says nothing about a second hypervisor already occupying host mode `[101][463]` `C:high`.

**The correct order of questions on Windows is:**

1. **Is a hypervisor already present?** `CPUID` leaf 1, **`ECX` bit 31** (§16.9) `[463]`.
2. **If so, which one?** `CPUID` leaf `0x40000000` → "Microsoft Hv"; leaf `0x40000001` → `"Hv#1"` (§16.9) `[463]`.
3. **Only then** the hardware chain in `01-svm-intro.md`.

**Reversing (1) and (3) is what produces exactly the "everything looks fine but VMRUN never runs" report** `[101][463]` `C:high`.

Two further reasons your readings are not evidence:

- **A guest-side reading of `VM_CR` or `EFER` under Hyper-V is not a reading of the physical processor's state.** The values a nested VMM sees are whatever the level above chose to present, so they cannot be used to decide whether the platform is free `[464]` `C:medium`.
- **`01-svm-intro.md`'s own failure table has this row and marks it `[no-spec]`:** "Everything reads clean but VMRUN never runs" has **no APM stage**, because the APM does not model a second hypervisor occupying host mode; it is diagnosed from the hypervisor-present bit and the platform, not from `VM_CR` `[no-spec]` `[100]` `C:medium`.

**The Windows-side confirmation** (§16.10): run `systeminfo.exe` and read the "Hyper-V Requirements" section — every line should read `Yes` `[475]`; `msinfo32.exe` → System Summary → "Virtualization-based Security Services Running"; `bcdedit /enum {current}` → `hypervisorlaunchtype`, `Auto` or `Off` `[474]`. Note `hypervisorlaunchtype = Auto` means the hypervisor is **on the boot path**; it does not by itself prove the hypervisor launched, because the silicon and firmware layers can still refuse — reading `systeminfo` and `msinfo32` together separates those cases `[474][475]` `C:medium`. And the useful negative: **if `msinfo32` reports virtualization-based security running, no amount of work on the `VM_CR`/`EFER` chain will free SVM — the answer is §16.6, not a firmware setting** `[101][465]` `C:high`.

§16.1.3 makes the structural point explicitly: in this class of symptom **nothing on the machine is misconfigured** — hardware present and enabled, firmware correct, platform behaving as designed; the only thing that changed is which software holds SVM host mode `[101]` `C:medium`.
**Confidence:** high. Microsoft Learn plus the TLFS feature-discovery page are the sources; the guest-side-MSR-reading and no-APM-stage claims are `C:medium`.

---

### diag-driver-rejected-memory-integrity
**Routed to:** `16-windows-platform.md` §16.3 (specifically §16.3.5 and §16.3.2) — right first time (Windows-symptoms row "A driver is rejected, or fails to load, once memory integrity is on")
**Answer:** Memory integrity (HVCI) moves the **kernel-mode code-integrity decision into the secure kernel in VTL1**, so a VTL0 kernel page cannot be both writable and executable. Your driver's signature is irrelevant to this: the rejection is about *what the driver does*, not who signed it.

- **Kernel-mode software that allocates writable-executable memory, generates code at run time, or patches kernel code is incompatible with memory integrity by construction rather than by policy**: the constraint is enforced from VTL1 using **nested-paging permissions the VTL0 kernel cannot modify**, so a compromised — or merely creative — VTL0 driver cannot mark its own page executable (Microsoft Learn, memory integrity enablement / Configure Credential Guard) `[461][465]` `C:high`.
- That is why "it loaded for years" and "it is signed" are both consistent with the new failure: nothing about the driver changed; the enforcement level did. Microsoft lists driver compatibility with memory integrity as a platform requirement in its own right `[42]` `C:high`.

**What to check, and what to do:**

1. **Confirm memory integrity is actually the gate.** `msinfo32.exe` → System Summary → "Virtualization-based Security Services Running"; scriptable as `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning` `[465]` `C:high`.
2. **Read Microsoft's compatibility-issue codes.** Its x64 compatibility-issue table gives **"MBEC/GMET Required" as bit 4 (`0x00000010`)**, alongside "SLAT required" (bit 1, `0x00000002`), "IOMMU required" (bit 3, `0x00000008`) and "Hardware virtualization required" (bit 10, `0x00000400`) `[461]` `C:high`. A code here tells you whether the block is your driver or the platform.
3. **Fix the driver, not the OS.** The only durable remedy is removing the W+X allocation / runtime code generation / kernel patching. The alternative — disabling memory integrity — also disables the protection for everything else on the machine, and disabling the hypervisor entirely takes VBS, Credential Guard, WSL 2, Windows Sandbox and Docker Desktop's Windows backends with it `[101][474]` `C:high`.

**Two adjacent things this is *not*:** §16.1.3 separates them deliberately. A game or anti-cheat behaving differently after WSL 2 was enabled is **hypervisor-present detection** (`CPUID` leaf 1 `ECX[31]`, §16.9), not a driver-integrity rejection — software that treats "a hypervisor is present" as evidence of tampering will see it on a completely untampered machine `[463][101]` `C:medium`. And a *third-party VMM* failing is the SVM-ownership problem of §16.1, not this.

**On AMD specifically:** the hardware primitive that makes this affordable is **GMET — the Guest Mode Execute Trap extension, `CPUID Fn8000_000A EDX[17]`** — which lets the hypervisor make supervisor-mode execution of a page a trappable event **without** making the page non-executable to user mode. Without it, the feature is still enforced, but the hypervisor must make pages non-executable for both privilege levels and take a nested page fault on every transition, which is why Microsoft treats MBEC/GMET as a compatibility gate for the default-on path rather than an optional tuning knob `[42][461]` `C:high`/`C:medium`. Microsoft's default-enablement hardware table names the AMD floor as **"AMD Zen 2 architecture and newer"**, with 8 GB RAM, a ≥64 GB SSD, compatible drivers, and "Virtualization must be enabled" in BIOS `[461]` `C:high`.
**Confidence:** high. Source is Microsoft Learn (Tier-2); no APM anchor belongs on a claim in this chapter. `errata.md` has no entry bearing on this. Whether a specific Windows build enables memory integrity by default on a given part is a product-status question for `90-dated-landscape.md` (`V:dated`).

---

### diag-kernel-dma-protection-off
**Routed to:** `16-windows-platform.md` §16.4 / §16.4.1 — right first time (Windows-symptoms row "A Thunderbolt or PCIe device is blocked before login" → §16.4; §16.1.3 carries the exact `msinfo32`-Off row too)
**Answer:** **Because enabling the IOMMU is necessary but nowhere near sufficient — your board almost certainly does not publish the firmware opt-in data the feature requires, and on a consumer AM5 desktop that is not something you can fix from the setup menu.**

Microsoft gives **exactly two diagnoses** for a `msinfo32` "Kernel DMA Protection" field reading `Off` `[43][462]` `C:high`:

1. If it is `Off` **and** "Hyper-V - Virtualization Enabled in Firmware" reads `NO`, the firmware switch is the cause — turn it on.
2. If it remains `Off` **with that switch on**, then "**the system doesn't support Kernel DMA Protection**" — which is **the usual outcome on a consumer desktop board**.

**Why.** The sharpest AMD-specific requirement is an ACPI opt-in indicator, and it is vendor-specific: on Intel platforms firmware sets `DMA_CTRL_PLATFORM_OPT_IN_FLAG` in the **DMAR** table's flags field, while **on AMD platforms firmware must set the "DMA remap support" bit in the IVRS table's `IVinfo` field** (Microsoft Learn, Kernel DMA Protection for OEMs) `[462]` `C:high`. IVRS itself is owned by `09-iommu-page-tables.md` §9.5. Consumer boards typically never set it, never satisfy the pre-boot isolation rules, and may not grant `_OSC` PCI Express native control `[43][462]` `C:high`.

The corollary, stated directly for your case: **turning `IOMMU` from `Auto` to `Enabled` in an AM4/AM5 setup menu makes the IOMMU usable for passthrough and for VBS, and does *not* by itself make Kernel DMA Protection available**, because the feature additionally needs firmware opt-in data the board does not publish `[43][462]` `C:medium`.

**The full requirement set, so you can see what "it would take":**

- "All I/O devices capable of DMA must be behind an **enabled (by default)** IOMMU" — the OEM page names both in one row, "IOMMU (Intel VT-D, AMD-Vi)" — on "64-bit IA processors with virtualization extensions, including Intel VT-X and AMD-v" `[462]` `C:high`. Note *enabled by default by firmware*, not merely enableable `[462]`.
- The **IVRS `IVinfo` DMA-remap support bit** set by firmware (above).
- The pre-boot rule, with its AMD half: "No device may perform DMA outside of RMRR regions (Intel) or **IVMD blocks (AMD)** after `ExitBootServices()`", and a violation is expected to raise an IOMMU fault and **bug check `0xE6`** `[462]` `C:high`.
- "**Enabling PCI Express Native Control using `_OSC` ACPI method is required** for Kernel DMA Protection support" `[462]` `C:high`.
- A **TPM 2.0** (discrete or firmware), with firmware required to extend an `EV_EFI_ACTION` event carrying the string **"DMA Protection Disabled"** into `PCR[7]` on any boot where the IOMMU or Kernel DMA Protection is disabled `[462]` `C:high`.

**So: what would it take?** Firmware changes only the board vendor can ship — the IVRS `IVinfo` indicator, default-on IOMMU, IVMD-scoped pre-boot DMA, `_OSC` native PCIe control — plus a TPM 2.0. Practically, on a consumer AM5 desktop, it takes a board whose firmware was built to Microsoft's Kernel DMA Protection OEM requirements; there is no user-side switch that adds them.

**Two things it is *not*.** **VBS is not a prerequisite**: Microsoft states the requirement as UEFI firmware support plus "Hyper-V - Virtualization Enabled in Firmware", which is the IOMMU and virtualization firmware switch, **not** VBS `[43]` `C:high`. And the scope is narrower than people assume: the feature "only protects against drive-by DMA attacks **after the OS is loaded**" — pre-boot Thunderbolt 3 protection is the system firmware's job — and it "doesn't protect against DMA attacks via 1394/FireWire, PCMCIA, CardBus, or ExpressCard" `[43]` `C:high`. In scope are the hot-pluggable PCIe classes — "PCIe hot plug devices such as Thunderbolt, USB4, and CFexpress" — and enforcement is time-based: peripherals with DMA-remapping-incompatible drivers are blocked from starting if plugged in before an authorized user logs in or while the screen is locked, after which the driver starts normally until reboot or unplug; a device's driver capability shows as "A value of 2 means that the device driver supports DMA-remapping" `[43]` `C:high`.

**Firmware-menu caveat (§16.7):** the `SVM Mode` label and the `AMD CBS → NBIO Common Options → IOMMU` path with an `Auto` default that many boards resolve to disabled are **convention, not specification** — no AMD or Microsoft document in this corpus specifies these labels, and they vary by board vendor and AGESA version `[no-spec]` `[7]` `C:low`. Treat them as a place to look, not a fact to quote.
**Confidence:** high for the Microsoft-sourced requirements (`C:high`); the AM5 corollary is `C:medium`, and the firmware-menu labels are `C:low` / `[no-spec]`.

---

### diag-nested-hyperv-on-ryzen-7000
**Routed to:** `16-windows-platform.md` §16.5 — right first time (Windows-symptoms row "Nested virtualization inside a Hyper-V VM will not enable")
**Answer:** **Yes — nested virtualization on AMD under Hyper-V is supported.** But "my Ryzen 7000 should support this" is never the operative question: **both gates that differ from the Intel case are properties of the host OS and the VM, not of the silicon** `[460]` `C:high`.

Microsoft publishes separate prerequisite sets for the two vendors on the same page, selected by an Intel tab and an AMD tab. The **AMD** set is:

- "The Hyper-V host must be either **Windows Server 2022 or later, or Windows 11 or later**"
- "**VM configuration version 9.3 or higher**"

(The Intel set is Windows Server 2016 / Windows 10 or later with configuration version 8.0 or higher — it does **not** apply to you.) `[460]` `C:high`

The AMD prerequisites sit under the page's own heading **"AMD EPYC / Ryzen processor or later"**, so Microsoft does state a processor-family requirement `[460]` `C:high`. **What Microsoft names nowhere is a Zen generation** — "EPYC / Ryzen or later" is a product-family phrase, not a silicon generation. **Do not convert it into "Zen 2 or later" or any similar reading** `[41][460]` `C:high`.

**The checklist, in the order that wastes fewest attempts:**

1. **Host OS** — Windows Server 2022 or later, or Windows 11 or later. An AMD host on Windows Server 2019 or Windows 10 **cannot do this at all**, however new the processor is.
2. **VM configuration version 9.3 or higher.** A VM carried forward from an older host keeps the configuration version it was created with, so this gate fails on machines whose host *and* processor are both new enough. It is a per-VM property and must be raised explicitly.
3. **VM powered off**, then `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true` (the same cmdlet with `$false` reverses it) `[460]` `C:high`.
4. **Networking**, if the innermost guests need it through the same adapter: enable MAC address spoofing on the level-1 VM's adapter — `Get-VMNetworkAdapter -VMName <VMName> | Set-VMNetworkAdapter -MacAddressSpoofing On` — or use NAT inside the level-1 VM. Same on both vendors `[460]` `C:high`.

**Limits Microsoft states** (vendor-neutral): the VM must be turned off to adjust its memory, and "**Virtualization applications other than Hyper-V aren't supported**" inside a Hyper-V VM — so a nested VMware or VirtualBox installation is outside what Microsoft supports `[41]` `C:high`.

**Errata check — `errata.md` `E13`:** "Hyper-V nested virtualization is Intel-only" is **false**; Microsoft documents it for "AMD EPYC / Ryzen processor or later" with the host and configuration-version gates above, and **names no Zen generation — do not add one** `[41]` `C:high` `V:durable`.

**Worth knowing while debugging (§16.5.1):** AMD has **no enlightened VMCS** — that construct is Intel-only, and the problem it solves does not exist on SVM because the VMCB is already ordinary memory. But it does **not** follow that Hyper-V has no AMD-side enlightenment: the TLFS states that "AMD has reserved space in the VMCB for hypervisor use, as well as an associated clean bit. The reserved bytes are in the control section, offset `0x3E0-3FF`, of the VMCB" and "The clean bit is bit 31", and Hyper-V "utilizes the reserved VMCB area to configure enlightenments" through `HV_SVM_ENLIGHTENED_VMCB_FIELDS` `[464]` `C:high`. One named enlightenment works the opposite way from the obvious reading: **`EnlightenedNptTlb` = "ASID flushes do not affect TLB entries derived from the NPT — hypercalls must be used to invalidate NPT TLB entries"**, so setting it to 1 *removes* NPT-derived entries from an ASID flush's scope, and a nested hypervisor that sets the bit and keeps flushing by ASID alone will leave stale nested translations `[464]` `C:high`.
**Confidence:** high. Source is Microsoft Learn (Tier-2). One documentation caveat the skill records: the "AMD EPYC / Ryzen processor or later" heading is an `<h3>` element that a text-extraction proxy can drop — re-fetch with HTML preserved before asserting Microsoft removed it.

---

### diag-vmware-virtualbox-coexistence
**Routed to:** `16-windows-platform.md` §16.6 — **landed short: §0.2's Windows-symptoms block has no row for this symptom**; found via `00-quickref.md` **§0.5 item 4** ("Can I run VMware or VirtualBox with Hyper-V enabled?" → §16.6), which routes directly and flags `errata.md` `E15`
**Answer:** **No — not any more.** Coexistence with VBS is the documented, current answer, and it **replaces** the older "turn Hyper-V off first" advice.

- **VMware Workstation Pro** supports the Windows Hypervisor Platform path from **15.5.5**; Broadcom calls it "**Host VBS Mode**" `[47]` `C:high`.
- **VirtualBox** gained it in **6.0**, whose release notes read "Added support for using Hyper-V as the fallback execution core on Windows host, to avoid inability to run VMs at the price of reduced performance" `[478]` `C:high`.

**What it costs**, and these limits are documented rather than incidental: **slower virtual machines, no nested virtualization inside the WHP-backed guest, no performance counters, no RTM/HLE and no PKU** — and **VirtualBox has continued to label the path experimental** `[47][48]` `C:high`. How much slower is a performance question, and `18-performance.md` §18.4 records that **no WHP-versus-bare-SVM measurement exists** in this corpus.

**What actually changes underneath:** it is a role change rather than a feature loss. A third-party VMM running over WHP **is no longer the software that executes `VMRUN`** — it is a user-mode process whose guest is a partition created and scheduled by Hyper-V, so **its guest is already nested** and every cost in `15-nested-virtualization.md` applies to it `[100]` `C:high`. The WHP API is a set of C-style functions returning `HRESULT`, exported from `WinHvPlatform.dll`, with entry points such as `WHvCreatePartition`, `WHvSetupPartition`, `WHvMapGpaRange` and `WHvRunVirtualProcessor` `[100]` `C:high`.

**If you do turn Hyper-V off** — `bcdedit /set hypervisorlaunchtype off`, then reboot — your VMM executes `VMRUN` itself, but **every Hyper-V-backed feature stops**: VBS, memory integrity, Credential Guard, WSL 2, Windows Sandbox and Docker Desktop's Windows backends `[101][474]` `C:high`. The skill is explicit that this "is now usually the wrong first move… it trades the machine's security posture for a compatibility problem the first option already solves" `[47][101][474]` `C:high`.

**Errata check — `errata.md` `E15` is directly on point and settled:** "You must disable Hyper-V to run VMware Workstation or VirtualBox" is a **misconception**; both run over the Windows Hypervisor Platform with VBS enabled, from Workstation Pro 15.5.5 and VirtualBox 6.0 respectively `[47][48]` `C:high` `V:durable`.
**Confidence:** high. Sources are Broadcom's and Oracle's own documentation plus Microsoft Learn (Tier-2). The specific product versions are durable historical facts; current product status would belong to `90-dated-landscape.md`.

---

### diag-gpu-passthrough-client
**Routed to:** `16-windows-platform.md` §16.8 (§16.8.1 and §16.8.2) — right first time (Windows-symptoms row "GPU passthrough to a VM is unavailable on a desktop Windows host — DDA is server scope")
**Answer:** **Not by Discrete Device Assignment, no.** The supported client paths **share** the GPU rather than assigning it.

**Why DDA is out:** Microsoft documents DDA for a host "running **Windows Server 2016 or later**" and requires "**server class hardware** that's capable of granting the operating system control over configuring the PCIe fabric (**Native PCI Express Control**)". It is **not documented as a client-Windows capability, and a desktop AM5 board does not meet the platform requirement** `[467][468]` `C:high`. The second hardware requirement is isolation: the PCIe root complex must "support **Access Control Services (ACS)**, which enables Hyper-V to force all PCIe traffic through the Input-Output Memory Management Unit", and Microsoft notes these capabilities "may be hidden in BIOS settings, sometimes behind SR-IOV configuration options" `[467]` `C:high`. Also: devices using **legacy INTx** PCI interrupts are not supported for DDA, and DDA is **one GPU to one VM** — "each physical GPU can provide acceleration to at most one VM" `[467][469]` `C:high`.

**What you actually get on Windows 11** `[467][469][470]` `C:medium` for the summary claim:

- **WDDM GPU paravirtualization** is the mechanism a client Windows PC reaches in everyday use, available "starting in **Windows 10, version 1803 (WDDM 2.4)**", whose documented consumers are **Hyper-V virtual machines — client and server — Windows Sandbox, and Hyper-V isolated containers** `[470]` `C:high`. The host keeps the device; the guest gets accelerated rendering through it.
- **Windows Sandbox** exposes it as a configuration element: `vGPU` takes `Enable`, `Disable` or `Default`, where `Default` "currently denotes that vGPU is enabled" and `Disable` falls back to software rendering. Microsoft warns that "Enabling virtualized GPU can potentially increase the attack surface of the sandbox" `[472]` `C:high`.
- **WSL** gets GPU acceleration on "Windows 11 or Windows 10, version 21H2 or higher" with the GPU vendor's ordinary Windows driver installed on the host — **the guest does not take the device away from the host** `[479]` `C:high`.
- **GPU partitioning** (the SR-IOV-based sharing mechanism, cmdlet `Add-VMGpuPartitionAdapter`) is documented "**Beginning with Windows Server 2025**", giving each VM "a dedicated fraction of the GPU instead of the entire GPU" `[469][476]` `C:high` — i.e. Microsoft documents it for Server, not for client Windows 11.

**If you were on a server host**, the DDA sequence is: survey with `SurveyDDA.ps1`; `Dismount-VMHostAssignableDevice -Force -LocationPath $locationPath`; `Add-VMAssignableDevice -LocationPath $locationPath -VMName <VMName>`; then install the vendor's driver **inside the guest**. The device is addressed by **PCI location path** — there is no Windows equivalent of a Linux kernel isolation group `[467][468]` `C:high`.

**Do not reach for the Linux playbook.** §16.11 marks VFIO as a contrast section: `amd_iommu=on`, `/sys/kernel/iommu_groups` and `vfio-pci` have **no Windows equivalents**, and GPU reset quirks handled on Linux by out-of-tree work such as `vendor-reset` have **no Windows analogue, because a Windows host never hands a client GPU to a guest in the first place** — which removes the failure mode rather than solving it `[57][467]` `C:high` / `C:low`.

**Open item the skill declares:** Microsoft documents GPU partitioning for Windows Server 2025 and WDDM GPU paravirtualization for client Hyper-V / Sandbox / isolated containers, but **this corpus found no single Learn page stating the client Hyper-V GPU-partitioning story end to end** (§16.12) — so the skill states only what is sourced, and which product supports GPU partitioning in which release is a `V:dated` question for `90-dated-landscape.md`.
**Confidence:** high for the DDA and paravirtualization facts (`C:high`); the summary "not by DDA; the supported client paths share the GPU" claim is marked `C:medium`, and the end-to-end client GPU-partitioning story is an acknowledged gap.

---

### diag-confirm-vbs-status
**Routed to:** `16-windows-platform.md` §16.10 — right first time (Windows-symptoms row "Is VBS / memory integrity actually running on this machine?")
**Answer:** Three checks, all first-party, and they answer **two different questions** — "is the hypervisor on the boot path / did it launch" and "is VBS running, with what services".

| Question | Command | What to read |
|---|---|---|
| Does this machine meet the Hyper-V requirements? | `systeminfo.exe` | the "Hyper-V Requirements" section — **every line must read `Yes`** |
| **Is VBS running, and with what?** | `msinfo32.exe` → System Summary | "**Virtualization-based Security Services Running**" |
| Is Credential Guard among them? | `msinfo32.exe` → System Summary | `Credential Guard` listed next to that field |
| Same, scriptable | `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning` | a **non-empty list** of running services |
| Is Kernel DMA Protection on? | `msinfo32.exe` | the "Kernel DMA Protection" field reads `ON` |
| **Is the hypervisor on the boot path?** | `bcdedit /enum {current}` | `hypervisorlaunchtype` — `Auto` or `Off` |
| Is a hypervisor present at all, from inside? | `CPUID` leaf 1 `ECX[31]`; leaf `0x40000000` | §16.9 |

Sources and the exact wording:

- **The `systeminfo` route is Microsoft's documented check**: run `Systeminfo.exe` and "scroll to the Hyper-V requirements section to review the report", where the reported items are **VM Monitor Mode extensions, virtualization enabled in firmware, second-level address translation, and hardware-enforced DEP** (Microsoft Learn, Hyper-V requirements) `[475]` `C:high`.
- **The VBS route is Microsoft's documented check too**: in System Information, "confirm that **Credential Guard** is shown next to **Virtualization-based Security Services Running**", with the scriptable equivalent being the `Win32_DeviceGuard` query above. Microsoft explicitly says checking whether `LsaIso.exe` is running "**isn't a recommended method**" (Microsoft Learn, Configure Credential Guard) `[465]` `C:high`.
- **`hypervisorlaunchtype` takes the values `Off` and `Auto`**, and Microsoft's boot-option reference describes it as controlling "the hypervisor launch options" (Microsoft Learn, BCDEdit /set) `[474]` `C:high`.

**The distinction that matters:** `hypervisorlaunchtype` reading `Auto` means the hypervisor is **on the boot path**; **it does not by itself prove the hypervisor launched**, because the silicon and firmware layers of §16.1.2 can still refuse. **Reading `systeminfo` and `msinfo32` together separates those cases** `[474][475]` `C:medium`. And the definitive answer for whether the hypervisor actually launched comes from inside: **`CPUID` leaf 1 `ECX` bit 31 — the hypervisor-present bit — "if this bit is set, a hypervisor is present"**, with leaf `0x40000000` returning "**Microsoft Hv**" and leaf `0x40000001` the interface signature `"Hv#1"`, which Microsoft recommends as the basis for compatibility decisions `[463]` `C:high`.

**The useful corollary:** if `msinfo32` reports virtualization-based security running, **no amount of work on the `VM_CR`/`EFER` chain in `01-svm-intro.md` will free SVM** — the answer is §16.6, not a firmware setting `[101][465]` `C:high`.

One `[no-spec]`-adjacent caution from §16.2 that avoids a false positive: **both x64 hypervisor images (`Hvix64.exe`, `Hvax64.exe`) are present in `%SystemRoot%\System32` on every x64 Windows installation** because the selection is made at boot, so their presence proves nothing `[46]` `C:medium`.
**Confidence:** high. All commands and field names are from Microsoft Learn (Tier-2) — per the skill's output standards these carry no APM anchor. `errata.md` has no entry that changes them.

---

### diag-vbs-cost-figure
**Routed to:** `18-performance.md` §18.2 (§18.2.2 for the figure, §18.2.3 for what the chapter refuses) — right first time (§0.2 row ""How much does VBS cost me?"")
**Answer:** There is **exactly one client-AMD measurement with usable conditions** in this knowledge base, and it is a media benchmark, quoted attributively.

**The figure, with its full conditions** — it does not travel without them:

> **ComputerBase** measured **Windows 11 memory integrity (HVCI) on versus off** on a **Ryzen 7 5800X (Zen 3)** paired with a **Radeon RX 7900 XTX** at **1280×720** — deliberately CPU-limited — and reported about **6% on average frame rate and about 8% on frame times**. Published **2023-03-16**. `[no-spec]` `[554]` `C:medium`

**Three qualifications that change how you should use it:**

1. **The per-title spread is far wider than the suite average.** Forspoken showed essentially no measurable difference, while **Diablo II: Resurrected lost over 30% on frame times**. A suite average of 6% therefore says **nothing** about any individual title `[no-spec]` `[554]` `C:medium`.
2. **It is Zen 3 only.** That article benchmarked a dozen or more processors across AM4, AM5 and LGA 1700, but **only the Ryzen 7 5800X received a memory-integrity on/off comparison** — the Zen 4 parts (7950X3D, 7950X, 7900X3D, 7900X, 7800X3D, 7700X) and the 5800X3D ran with the feature enabled throughout. **The article supports no Zen 3 versus Zen 4 statement about this cost** `[no-spec]` `[554]` `C:medium`.
3. **The toggle is memory integrity alone**, with kernel isolation left on in both arms. So the 6% is the *marginal* cost of code-integrity enforcement on a machine that **already has the hypervisor resident** — it does **not** include the whole-machine nested-paging term. "What do I get back by turning all of this off" is a **larger** number that this article does not measure `[no-spec]` `[554]` `C:medium`.

**Figures this chapter explicitly refuses to carry:** the widely relayed "**5–10% system-wide**" and "**5–25% in games**" ranges have **no traceable primary source** — they appear in secondary write-ups without hardware, workload, or a statement of which setting was toggled. They are recorded as unresolved and are **not** averaged with the 6% `[no-spec]` `[554]` `C:low`.

**Why your machine may differ by more than the effect** (§18.2.4): three properties move the result more than the setting does — **how often the lengthened two-dimensional walk is actually paid** (it only costs on a TLB miss, so a small-resident-set workload can lose nothing while pointer-chasing loses measurably); **page size** (2 MB pages on both dimensions shorten the walk, so the same toggle on two systems with different large-page availability is not the same experiment); and **whether the part has the execute-trap extension (GMET)**, without which the protection is emulated by a more expensive software path. A measurement of this feature is therefore as much a measurement of one machine's memory behaviour as of the feature `[no-spec]` `[56][554]` `C:medium`.

**Where the cost comes from** (§18.2.1): the hypervisor being resident turns some operations into `#VMEXIT`s that did not exist with it off; **nested paging is then active for the whole machine, not only for VMs**, so ordinary desktop and game workloads pay the two-dimensional walk; code-integrity enforcement moves page-permission decisions to a more privileged level (GMET is the AMD primitive); and calls into that level cost at least one world switch each — **for which no cycle measurement on an AMD part is recorded here** `[no-spec]` `[42][44][45][56][554]`.

**If you want a number for your own machine** (§18.1.3): change **one variable at a time** (toggling memory integrity is a *different experiment* from disabling the hypervisor, because the second also removes nested paging machine-wide and the two cannot be pooled); use a workload **bound by the thing being measured** (a GPU-bound game at 4K will show nothing); and report **distributions, not means** — virtualization cost shows up in frame times and tail latency long before it moves an average `[no-spec]` `[42][554]` `C:high`.
**Confidence:** medium — the skill marks this figure `C:medium` and Tier-3 (a media benchmark, quoted attributively). One of §18.1's five mandatory fields is missing: the article publishes no RAM timings, Windows build or graphics driver revision, **so the figure may not be promoted to a platform constant**. The "5–10% / 5–25%" figures are `C:low` and unsourced. Per the chapter's sourcing rule, no APM section number belongs on any benchmark result — `[no-spec]` is the correct marker.

---

### diag-sev-es-disabled-on-snp-host
**Routed to:** `17-security.md` §17.1.2 — right first time (§0.2 row "A firmware or microcode update **disabled a feature** that used to work → `17-security.md` §17.1 — mitigations disable features; check `errata.md` first"), and `errata.md` `E17` settles it
**Answer:** **No — it is not a Zen 5 generational change.** It is the **documented side effect of a security mitigation**, and it spans three generations.

**AMD-SB-3023, published 2026-02-10, covers CVE-2025-48514**: "SEV firmware lets an SEV-ES guest be created so as to attack an SNP guest", affecting **Milan, the Siena/Genoa family, and Turin**. The mitigation is **SEV firmware 1.37.23 / 1.37.31 / 1.37.41**, and **AMD-SB-3023 footnote 2 reads: "Applying mitigation CVE-2025-48514 will result in disabling SEV-ES when SEV-SNP is enabled."** `[AMD-SB-3023]` `[23]` `C:high` `V:durable`

**Three details matter, and they are exactly the ones that get lost** (`errata.md` `E17`):

1. **Only SEV-ES is affected — not plain SEV.**
2. **The trigger is SNP being *enabled*, not merely supported.** If you turn SEV-SNP off on the host, the constraint does not apply.
3. **The fix spans Zen 3 (Milan), Zen 4 (Genoa/Siena) and Zen 5 (Turin)** — so "it's a Zen 5 thing" is wrong in both directions: it is not new to Zen 5, and it is not confined to it. `[AMD-SB-3023]` `[23]` `C:high` `V:durable`

**How to confirm it on your host:** check the **SEV firmware version** against the mitigation anchors above — the bulletin's machine-checkable anchor is the firmware version itself (1.37.23 Milan / 1.37.31 Genoa family / 1.37.41 Turin). A firmware update to or past those levels is what changed the behaviour. The severity AMD assigns CVE-2025-48514 is **4.0 Medium (AMD, CVSS 4.0 only)** `[23]` `C:high`.

**A companion CVE in the same bulletin, in case your host is Turin:** **CVE-2025-48517** — "SEV-ES guest can be given an ASID from the range reserved for SNP guests" — affects **EPYC 9005 "Turin"/"Turin Dense" only**, mitigated by **SEV FW 1.37.41 only** (TurinPI 1.0.0.6, 2025-06-30), severity **4.6 Medium (AMD)** `[AMD-SB-3023]` `[23]` `C:high`.

**Two conventions from §17.1.1 worth applying here:** a CVE is not an architectural fact and **carries no APM anchor** — the Tier-1 anchor is the AMD security bulletin `AMD-SB-nnnn` `[no-spec]` `[18]` `C:high`; and **affected parts are named by product generation, never by feature name** — "affects SEV-ES" answers no deployment question, because every EPYC since Naples has SEV-ES `[no-spec]` `[18]` `C:high`. **Scope note:** every row in that table is an EPYC row; SEV-SNP has never been available on a client part.
**Confidence:** high (`C:high`, `V:durable`). This is a settled erratum (`E17`), sourced to AMD's own bulletin, not to the APM.

---

### diag-avic-default-state
**Routed to:** `90-dated-landscape.md` §90.6 — right first time (Windows-symptoms row "Is AVIC on by default on my kernel? → `90-dated-landscape.md` §90.6 — `V:dated`, re-verify")
**Answer:** **Both things you read were true at different times, and the answer changed recently.** "Is AVIC on by default?" has had three different correct answers.

**The short version: AVIC landed in Linux 4.7 and was off by default for its entire life until Linux 6.18**, which enables it automatically on Zen 4 and later parts that also report x2AVIC. So "AVIC has been on by default since <some older version>" is wrong, and "AVIC is off by default" is **now** wrong on current kernels and new hardware.

| Release | What changed |
|---|---|
| v4.6 | the `X86_FEATURE_AVIC` CPU feature flag appears |
| v4.7 | AVIC support lands in KVM, **off by default** |
| v5.17 | erratum #1235 is named in `avic.c` (missing memory barrier on `IsRunning`) |
| v5.19 | the `force_avic` override is added; default unchanged |
| v6.0 | x2AVIC support; `force_avic` moves into `avic.c` |
| v6.17 | `enable_ipiv` appears; IPI virtualization disabled on the erratum-#1235 families |
| **v6.18** | **the default flips to "auto"**; guest-side Secure AVIC arrives in the same release |
| v6.19 | `X86_FEATURE_X2AVIC_EXT` — x2AVIC for 4096 vCPUs |

- From introduction until **Linux 6.17 inclusive**, KVM's switch was a plain boolean defaulting to off: `static bool avic; module_param(avic, bool, 0444);`. AVIC support first appears in `arch/x86/kvm/svm.c` at **v4.7** — 112 occurrences of `avic` at v4.7 against none at v4.6 `[610][611]` `C:high` `V:dated`.
- **Linux 6.18 flipped the default.** Commit **`ca2967de5a5b`** ("KVM: SVM: Enable AVIC by default for Zen4+ if x2AVIC is support"), authored by Naveen N Rao (AMD) 2025-09-19, committed by Sean Christopherson 2025-09-23: "AVIC and x2AVIC are fully functional since Zen 4, with no known hardware errata. Enable AVIC and x2AVIC by default on Zen4+ so long as x2AVIC is supported (to avoid enabling partial support for APIC virtualization by default)." `[611]` `C:high` `V:dated`
- The new default is an **"auto" mode encoded as `-1`**, distinct from both `y` and `n`, so KVM can tell "user said nothing" from "user said yes"; the parameter accepts the literal string `auto` `[610][611]` `C:high` `V:dated`.
- **In auto mode KVM enables AVIC when x2AVIC is present in CPUID and the CPU is Zen 4 or newer**: `avic = boot_cpu_has(X86_FEATURE_X2AVIC) && (cpu_feature_enabled(X86_FEATURE_ZEN4) || boot_cpu_data.x86 >= 0x1A)`. **On a Zen 3 or older part, AVIC remains off unless you ask for it** `[610]` `C:high` `V:dated`.

**Three gates apply regardless of the default** `[610]` `C:high` `V:dated`: AVIC requires **nested paging** (`!npt_enabled` disables it); it is refused on an **SNP-enabled host lacking `HvInUseWrAllowed`** (KVM logs "AVIC disabled: missing HvInUseWrAllowed on SNP-enabled system"); and forcing it on a part whose CPUID does not report AVIC needs **`force_avic`**, registered with `module_param_unsafe` and warning "AVIC unsupported in CPUID but force enabled, your system might crash and burn".

**Two traps when you go to check your own machine:**

- **Reading the parameter back is misleading by design.** The getter resolves auto mode to `N`, so `/sys/module/kvm_amd/parameters/avic` **can read `N` on a machine where AVIC is in fact enabled**, until module initialisation has resolved the mode `[610]` `C:medium` `V:dated`.
- **Firmware can mask AVIC while leaving x2AVIC visible.** KVM detects that and prints `[Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported`, then disables both. **Generation capability tables are not a substitute for reading CPUID on the actual machine** `[610]` `C:high` `V:dated`.

**Erratum #1235, which is why it stayed off so long:** current mainline still disables **IPI virtualization** — not AVIC as a whole — on **AMD Family 17h (Zen 1/Zen 2) and Hygon Family 18h**, attributing it to "erratum 1235, which results in missed VM-Exits on the sender and thus missed wake events for blocking vCPUs due to the CPU failing to see a software update to clear IsRunning". `enable_ipiv` and this workaround appear at **v6.17**, one release before the flip `[610]` `C:high` `V:dated`.

**`errata.md` `O2` is settled.** Number `1235` first appears in `arch/x86/kvm/svm/avic.c` at **v5.17** (absent at v5.16), so a 2025–2026 disclosure is ruled out. AMD's own publication is Revision Guide **55449**, Family 17h Models 00h–0Fh, p.87, first listed at **rev 1.17, 2019-07**. It is absent from 57095 and 58251 because those cover Genoa and Turin. As of 2026-09-26 the remaining document gap is a Family 19h or 1Ah *client* model range, plus client PPRs 56176, 56214, 56713 and 57254, which have no retrievable first-party copy (`errata.md` E27). `[RevGuide 55449 erratum 1235][610][29][27][25]` `C:high`.

**Client-part caveat from `07-virtual-interrupts-avic.md` §7.9:** whether a given desktop or mobile Ryzen has AVIC enabled by firmware is a microcode property. Family 17h client parts have Revision Guide 55449; as of 2026-09-26 no public revision guide covers a Family 19h or 1Ah client model range (`errata.md` E27). `CPUID Fn8000_000A` on the machine is what settles the bit. `[no-spec]` `[29][30]` `C:medium`.
**Confidence:** high for the kernel timeline, but **everything in this answer is `V:dated`** — it is a **2026-09-21 snapshot** and the skill requires you to re-verify it before acting on it. Nothing after that date is covered.

---

## Summary

- **Answered from the skill: 20 / 20.** None required "the skill does not state this", though four answers carry an explicit gap the skill declares: no KDS endpoint specification (pub 57230 is outside the corpus, `diag-attestation-verify-failure`); no end-to-end client GPU-partitioning Learn page (`diag-gpu-passthrough-client`); no WHP-versus-bare-SVM measurement (`diag-vmware-virtualbox-coexistence`, `diag-vbs-cost-figure`); and no AMD disclosure date for AVIC erratum 1235 (`diag-avic-incomplete-ipi`, `diag-avic-default-state`, open conflict `O2`).
- **Routed right first time: 19 / 20.** The exception is `diag-vmware-virtualbox-coexistence`: **§0.2's Windows-symptoms block has no row for VMM coexistence**. It was found one step later in `00-quickref.md` §0.5 item 4, which routes to §16.6 and names `errata.md` `E15`.
- **Errata that bore directly on an answer:** `E06` (exit-code segmentation, `diag-exit-code-80h`), `E03` (`RemapEn`, `diag-passthrough-interrupts-missing`), `E25` (report VERSION set, `diag-attestation-verify-failure`), `E13` (nested Hyper-V on AMD, `diag-nested-hyperv-on-ryzen-7000`), `E15` (VMware/VirtualBox coexistence, `diag-vmware-virtualbox-coexistence`), `E17` (SEV-ES disabled under SNP, `diag-sev-es-disabled-on-snp-host`), `O2` (AVIC erratum 1235, two answers). `E10`, `E22`, `E09`, `E14` and `O5` were checked and noted where adjacent.
- **Dated facts:** only `diag-avic-default-state` rests on `V:dated` material (`90-dated-landscape.md`, snapshot 2026-09-21).
