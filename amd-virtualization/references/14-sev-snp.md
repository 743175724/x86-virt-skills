# 14. SEV-SNP: Integrity, VMPL and Attestation

> **中文速览**：本章覆盖 SEV-SNP 的全部机制：RMP 的容量公式与粒度约束、RMP 条目的字段与软件可见的 16 字节结构、每类访问的检查规则与故障优先级、完整的 11 个页状态、六条 SNP 指令的操作数与返回码、VMPL 模型与权限掩码、Restricted/Alternate Injection、vTOM、Secure TSC、Secure AVIC、Segmented RMP、SNP CPUID 页、SNP 固件命令全表、ATTESTATION_REPORT 与 TCB_VERSION 的逐字段布局、SVSM 的调用约定与协议族，以及 VCEK/VLEK/CSVCEK 的证书链。**六条 SNP 指令全部在 APM Vol.3 Ch.4**，按助记符引用；它们不在 Vol.2、不在任何附录。CVE 叙述在 `17-security.md`，云可用性与固件版本史在 `90-dated-landscape.md`。

**Maps to:** APM Vol.2 §15.36 "Secure Nested Paging (SEV-SNP)" (23 subsections, p.623–646 of Rev 3.45) + SEV-SNP Firmware ABI 56860 Rev 1.59 (Ch.5 Page Management · Ch.7 Guest Messages · Ch.8 Command Reference) + SVSM 58019 Rev 1.01; SNP instructions in APM Vol.3 §4 [1][2][10][11]
**Owns:** the RMP entry and RMP check rules · page states · SNP instruction semantics and error codes · VMPL · restricted and alternate injection · vTOM · Secure TSC · Secure AVIC · Segmented RMP · the SNP CPUID page · SNP firmware commands · ATTESTATION_REPORT · SVSM · VCEK/VLEK and the KDS chain
**Scope:** **Server scope.** SEV is productised on EPYC. Zen 4 and later client parts expose SME only, and SEV-SNP has never been available on a client part. Read this chapter for EPYC questions; client memory encryption is `11-memory-encryption.md`.
**See also:** `12-sev.md` (key hierarchy, ASID binding, threat model) · `13-sev-es-ghcb.md` (VMSA, `#VC`, GHCB, VMGEXIT) · `05-exit-decoding.md` (the RMP bits in the `#NPF` tables) · `06-nested-paging.md` (nested paging and TLB control) · `17-security.md` (CVEs) · `90-dated-landscape.md` (firmware and cloud timelines)

---

## 14.1 The Reverse Map Table

SEV-SNP adds *integrity* to what SEV and SEV-ES already encrypt. The mechanism is one system-wide table that inverts the nested page tables: for every system physical address (sPA) that may ever be handed to a guest, the Reverse Map Table (RMP) records who owns it and which guest physical address it is allowed to appear at. The hypervisor still builds the nested page tables, but it can no longer make a page appear twice, appear in the wrong guest, or be swapped underneath a running guest without the guest noticing.

- **Claim.** SEV-SNP is layered on SEV and SEV-ES and requires both; its integrity protection rests on the RMP, a structure in system memory shared globally by all logical processors that enforces a one-to-one mapping between system physical addresses and guest physical addresses.  `[APM2 §15.36]` `[1]` `C:high` `V:durable`
- **Claim.** Every page of physical memory potentially assignable to guests has exactly one RMP entry, and the RMP combined with all guests' nested page tables guarantees a page cannot be mapped into two guests at once nor mapped twice into one guest.  `[SNP-ABI 1.59 §5.1]` `[10]` `C:high` `V:durable`
- **Claim.** The CPU half of SEV-SNP described in the APM is not sufficient on its own: the lifecycle of an SNP VM also requires the AMD Secure Processor (AMD-SP) ABI published as pub 56860.  `[APM2 §15.36]` `[1][10]` `C:high` `V:durable`

### Enabling SEV-SNP

- **Claim.** Enabling SEV-SNP is a two-step procedure — construct the RMP, then set `VMPLEn` and `SecureNestedPagingEn` in `SYSCFG` (MSR `C001_0010`) on **every core in the system**; `MemEncryptionModEn` must already be set.  `[APM2 §15.36.2]` `[1]` `C:high` `V:durable`
- **Claim.** Once `SecureNestedPagingEn` is 1 the memory map freezes: writes to `SYSCFG` are silently ignored, while writes to the fixed-range MTRRs, the IORR registers, `TOP_MEM`/`TOP_MEM2` and `SMM_KEY` raise `#GP(0)`.  `[APM2 §15.36.2]` `[1]` `C:high` `V:durable`
- **Claim.** *SNP-enabled* (globally on in `SYSCFG`) and *SNP-active* (`SEV_FEATURES` bit 0 set in a VM's VMSA at offset 3B0h, see `13-sev-es-ghcb.md`) are distinct: an SNP-enabled system runs both SNP-active and non-SNP-active VMs, but an SNP-active VM only runs on an SNP-enabled system.  `[APM2 §15.36.2]` `[1]` `C:high` `V:durable`
- **Claim.** SEV-SNP support, VMPL support and the SNP feature set are enumerated in `Fn8000_001F_EAX` — bit 4 SNP, 5 VMPL, 6 RMPQUERY, 7 VmplSSS, 18 VirtualTom, 21 RMPREAD, 22 GuestInterceptCtl, 23 SegmentedRmp, 25 SmtProtection, 26 SecureAvic, 27 AllowedSevFeatures, 29 NestedVirtSnpMsr, 31 IbpbOnEntry — with the implemented VMPL count in `Fn8000_001F_EBX[15:12]`; the leaf is published once, in `11-memory-encryption.md`.  `[APM2 §15.36.1]` `[1]` `C:high` `V:durable`

### Where the RMP lives and how big it has to be

- **Claim.** `RMP_BASE` (MSR `C001_0132`) and `RMP_END` (MSR `C001_0133`) hold the sPA of the first and last byte of the RMP; software must program them identically on every core and before enabling SEV-SNP globally.  `[APM2 §15.36.4]` `[1]` `C:high` `V:durable`
- **Claim.** `RMP_BASE` and `RMP_END+1` must be 8 KB aligned architecturally, and the APM warns that the AMD-SP may be stricter; it is — `SNP_INIT_EX` with `INIT_RMP=1` returns `INVALID_ADDRESS` unless `RMP_BASE` is **1 MB aligned** and `RMP_END − RMP_BASE + 1` is a multiple of 1 MB.  `[APM2 §15.36.4]` `[SNP-ABI 1.59 §8.9]` `[1][10]` `C:high` `V:durable`
- **Claim.** The region holds a **16 KB processor bookkeeping area** followed by RMP entries of **16 bytes each**, so the covered sPA range runs from 0h to `((RMP_END + 1 − RMP_BASE − 16KB) / 16B) × 4KB`.  `[APM2 §15.36.4]` `[1]` `C:high` `V:durable`
- **Claim.** 16 bytes per 4 KB page is **1/256 — about 0.39 % — of covered DRAM** plus the 16 KB header; AMD's own worked example confirms the arithmetic, since covering the first 4 GB from `RMP_BASE = 10_0000h` needs `RMP_END = 110_3FFFh`, an RMP "just over 16MB".  `[APM2 §15.36.4]` `[1]` `C:high` `V:durable`
- **Claim.** Any page **not** covered by the RMP is permanently a Hypervisor-Owned page and can never be assigned to a guest — which is why an RMP is sized to cover all of system memory rather than a subset.  `[APM2 §15.36.5]` `[1]` `C:high` `V:durable`
- **Claim.** Software must zero the whole `RMP_BASE`..`RMP_END` range before setting `SecureNestedPagingEn` (leaving every page hypervisor-owned); the AMD-SP then finalises initialisation and blocks direct software writes to that memory, after which only the RMP instructions or the AMD-SP may change an entry.  `[APM2 §15.36.4]` `[1]` `C:high` `V:durable`

### Entry contents

The APM publishes the RMP entry as a *field list*, not as a bit layout. The only byte-exact encodings AMD publishes are the 16-byte software structures that `RMPREAD` writes and `RMPUPDATE` reads.

- **Claim.** An RMP entry carries `Assigned`, `Page_Size` (0 = 4 KB, 1 = 2 MB), `Immutable`, `Guest_Physical_Address`, `ASID`, `VMSA`, `Validated`, and one VMPL permission mask per implemented VMPL.  `[APM2 Table 15-34]` `[1]` `C:high` `V:durable`
- **Claim.** Ownership is encoded by three fields together: hypervisor is `Assigned=0, ASID=0`; a guest is `Assigned=1, ASID=<guest ASID>`; the AMD-SP is `Assigned=1, ASID=0, Immutable=1`.  `[APM2 Table 15-35]` `[1]` `C:high` `V:durable`
- **Claim.** `RMPREAD` returns a 16-byte structure: `GUEST_PA` at 00h (8 B), `ASSIGNED` at 08h bit 0, `PAGE_SIZE` at 09h bit 0 with `2MB_REGION_STATUS` at 09h bit 1, `IMMUTABLE` at 0Ah bit 0, one reserved SBZ byte at 0Bh, and `ASID` at 0Ch (4 B).  `[APM3 §4 "RMPREAD"]` `[2]` `C:high` `V:durable`
- **Claim.** `RMPUPDATE` consumes the same shape without the region status — `GUEST_PA` 00h, `ASSIGNED` 08h, `PAGE_SIZE` 09h, `IMMUTABLE` 0Ah, reserved 0Bh, `ASID` 0Ch — so the permission masks, `Validated` and the `VMSA` flag are not software-writable through it.  `[APM3 §4 "RMPUPDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** Four instructions may alter an entry and each owns a disjoint field set: `RMPUPDATE` (hypervisor — GPA, Assigned, Page_Size, Immutable, ASID), `PSMASH` (hypervisor — split 2 MB into 512×4 KB), `RMPADJUST` (guest — the VMPL permission masks, plus the `VMSA` flag at VMPL0), `PVALIDATE` (guest — the `Validated` flag).  `[APM2 §15.36.3]` `[1]` `C:high` `V:durable`

### Granularity — an architectural constraint, not a tuning knob

- **Claim.** The RMP describes pages at **4 KB or 2 MB only**; there is no 1 GB RMP entry, and with SEV-SNP enabled an access to a 1 GB nested page installs only a 2 MB TLB entry and is treated as a 2 MB access for checking purposes.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** `RMPUPDATE` invalidates **all TLB entries in the system** that translate to the modified page, and `PSMASH` invalidates all system TLB entries translating to the 2 MB page it expands — RMP maintenance is a system-wide, not a per-core, operation.  `[APM3 §4 "RMPUPDATE"]` `[APM3 §4 "PSMASH"]` `[2]` `C:high` `V:durable`

## 14.2 RMP checks by access class

With SEV-SNP globally enabled the processor checks the RMP on **every** memory access — hypervisor, legacy guest, non-SNP guest and SNP guest alike. Which checks run, and which fault a failure raises, depend on the accessor and the effective C-bit.

- **Claim.** The processor defines seven structural RMP checks: **RMP-Covered** (an entry exists below `RMP_END`), **Hypervisor-Owned** (`Assigned=0`, and for a 2 MB access every constituent 4 KB entry must also have `Assigned=0`), **Guest-Owned** (entry ASID matches the current VM), **Reverse-Map** (entry GPA matches the translation's guest physical address), **Validated**, **Mutable** (`Immutable=0`) and **Page-Size** (RMP `Page_Size` agrees with the nested page table).  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** An eighth check, **VMPL**, tests the current VMPL's permission mask; it has the lowest priority of all RMP checks and page validation the next lowest, so a simultaneous Page-Size and Validated failure reports the Page-Size failure.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** All RMP checks run **after** the page-table and nested-page-table checks and have lower priority than them; see `06-nested-paging.md` for the walk itself.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`

| Accessor | SNP-active | Access | C-bit | Checks | Fault |
|---|---|---|---|---|---|
| Host | — | data write, page-table access | — | Hypervisor-Owned | `#PF` |
| Guest | No | data write, page-table access | — | Hypervisor-Owned | `#VMEXIT(NPF)` |
| Guest | Yes | instruction fetch, page-table access | — | RMP-Covered · Guest-Owned · Reverse-Map · Mutable · Page-Size | `#VMEXIT(NPF)` |
| Guest | Yes | (same) | — | Validated | `#VC` |
| Guest | Yes | (same) | — | VMPL | `#VMEXIT(NPF)` |
| Guest | Yes | data write | 0 | Hypervisor-Owned | `#VMEXIT(NPF)` |
| Guest | Yes | data read or write | 1 | RMP-Covered · Guest-Owned · Reverse-Map · Mutable · Page-Size | `#VMEXIT(NPF)` |
| Guest | Yes | (same) | 1 | Validated | `#VC` |
| Guest | Yes | (same) | 1 | VMPL | `#VMEXIT(NPF)` |

- **Claim.** The table above reproduces AMD's Table 15-38, split so that each check group shows the fault it raises; the ordering of rows is also the priority order.  `[APM2 Table 15-38]` `[1]` `C:high` `V:durable`
- **Claim.** A page-validation failure delivers `#VC` with error code **`PAGE_NOT_VALIDATED` (0x404)** and saves the faulting guest virtual address to CR2.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** The effective C-bit is always 1 for a guest instruction fetch, a page-table access, or a data write to private memory, and an Accessed/Dirty update is treated as a data write at an inherent page size of 4 KB; the C-bit itself is owned by `11-memory-encryption.md`.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** An access whose RMP entries are concurrently in use on another logical processor may take a spurious RMP violation (`#PF` or `#VMEXIT(NPF)`) that software is expected to retry rather than treat as an error.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** §15.36.10 defines bit **31 (RMP)** in the page-fault error code for any RMP or VMPL check failure, and adds bits **34 (ENC)**, **35 (SIZEM)**, **36 (VMPL)** and **37 (SSS)** on `#VMEXIT(NPF)`; the full bit table including 32 GUEST_FINAL and 33 GUEST_PAGE lives in `05-exit-decoding.md`.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`

### VMRUN's own RMP checks

- **Claim.** With SEV-SNP globally enabled, VMRUN checks that the VMCB, AVIC backing page, PML buffer and IBS buffer are Hypervisor-Owned, faulting `#GP(0)` for the VMCB and `#VMEXIT(VMEXIT_INVALID)` for the other three; the AVIC structures belong to `07-virtual-interrupts-avic.md`.  `[APM2 Table 15-40]` `[1]` `C:high` `V:durable`
- **Claim.** A VMSA page for an SNP-active guest must additionally pass RMP-Covered, Guest-Owned, Reverse-Map, Mutable and a **VMSA** check (the `VMSA` field equal to 1), which is set either by the AMD-SP or by a vCPU at VMPL0 using `RMPADJUST`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`
- **Claim.** Where a VMRUN check depends on page size, 4 KB is assumed; the AVIC logical table, AVIC physical table, `IOPM_BASE_PA` and `MSRPM_BASE_PA` are deliberately **not** checked because hardware only reads them; those AVIC tables belong to `07-virtual-interrupts-avic.md`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`
- **Claim.** After a successful VMRUN, hardware marks the VMCB and every checked page in-use, so `RMPUPDATE` against them returns `FAIL_INUSE`; the marking clears automatically on `#VMEXIT`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`
- **Claim.** `VM_HSAVE_PA` must point at a hypervisor-owned page or the WRMSR takes `#GP(0)`, and a VMRUN attempted while `VM_HSAVE_PA` is 0 also takes `#GP(0)`; the MSR is owned by `01-svm-intro.md`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`
- **Claim.** On processors that support SEV-SNP, executing VMSAVE inside an SEV-ES or SNP-active guest is not supported and produces `#VMEXIT(VMSAVE)`; executed in host mode against a page failing its RMP check it produces `#GP(0)` instead.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`
- **Claim.** All port I/O (`IN`, `INS`, `OUT`, `OUTS`) and `CPUID` executed by an SNP-active guest are treated as intercepted regardless of the VMCB intercept bits and the IOPM, and unconditionally produce a non-automatic exit — see `13-sev-es-ghcb.md`.  `[APM2 §15.36.12]` `[1]` `C:high` `V:durable`

### Memory types and TLB management

- **Claim.** Hardware forces coherent memory types for SNP-active guest accesses so the hypervisor cannot corrupt guest memory through a non-coherent type: **UC becomes CD and WC becomes WC+**.  `[APM2 Table 15-41]` `[1]` `C:high` `V:durable`
- **Claim.** Hardware, not the hypervisor, keeps the TLB correct when an SNP-active guest's VMSA moves between logical processors, tracking it in the VMSA fields `TLB_ID` (byte offset 3D0h) and `PCPU_ID` (byte offset 3D8h); software initialises both to zero at guest creation and hardware owns them thereafter — the VMSA is documented in `13-sev-es-ghcb.md`.  `[APM2 §15.36.15]` `[1]` `C:high` `V:durable`
- **Claim.** Guest software forces a flush by writing 0 to `PCPU_ID`; hardware writes a non-zero value back once it has flushed on the next VMRUN, giving the guest a completion signal it can poll — the required idiom after an `RMPADJUST` that tightens a VMPL's permissions.  `[APM2 §15.36.15]` `[1]` `C:high` `V:durable`
- **Claim.** The hypervisor can still force flushes through `TLB_CONTROL`, where values 3h and 7h invalidate both global and non-global guest entries; that field is owned by `06-nested-paging.md`.  `[APM2 §15.36.15]` `[1]` `C:high` `V:durable`

## 14.3 Page states and transitions

The RMP fields combine into a small set of named page states. The three states software usually talks about — hypervisor, guest-invalid, guest-valid — cannot explain swapping, migration or guest context pages. The firmware ABI defines eleven.

- **Claim.** A page's state is completely determined by the `Assigned`, `Validated`, `ASID`, `Immutable`, `GPA` and `VMSA` fields of its RMP entry.  `[SNP-ABI 1.59 §5.3]` `[10]` `C:high` `V:durable`

| State | Assigned | Validated | ASID | Immutable | GPA | VMSA |
|---|---|---|---|---|---|---|
| Hypervisor | 0 | 0 | 0 | 0 | — | — |
| HV-fixed | 0 | 0 | 0 | 1 | — | — |
| Reclaim | 1 | 0 | 0 | 0 | — | — |
| Firmware | 1 | 0 | 0 | 1 | 0 | 0 |
| Context | 1 | 0 | 0 | 1 | 0 | 1 |
| Metadata | 1 | 0 | 0 | 1 | >0 | — |
| Pre-Guest | 1 | 0 | >0 | 1 | — | — |
| Guest-Invalid | 1 | 0 | >0 | 0 | — | — |
| Pre-Swap | 1 | 1 | >0 | 1 | — | — |
| Guest-Valid | 1 | 1 | >0 | 0 | — | — |
| Default | *page has no RMP entry* | | | | | |

- **Claim.** Those eleven states and their defining field values are AMD's Table 14; AMD spells the immutable hypervisor state **HV-fixed**, and **Default** — a page whose sPA indexes past `RMP_END` — has Hypervisor-page permissions but **cannot transition to any other state**.  `[SNP-ABI 1.59 Table 14]` `[10]` `C:high` `V:durable`
- **Claim.** HV-fixed pages cannot be created by `RMPUPDATE`; software uses `SNP_PAGE_SET_STATE` or `SNP_INIT_EX` with a range list, and a page stays HV-fixed until the RMP is reinitialised.  `[SNP-ABI 1.59 §5.3]` `[10]` `C:high` `V:durable`
- **Claim.** Firmware pages are hypervisor-donated writable memory that the firmware owns; because `Immutable` is set the hypervisor can neither write them nor alter their entry, and when the firmware hands one back it lands in **Reclaim**, the only exit from immutability.  `[SNP-ABI 1.59 §5.3]` `[10]` `C:high` `V:durable`
- **Claim.** A Context page holds all of a guest's context, encrypted and integrity-protected in an implementation-specific format, and `SNP_GCTX_CREATE` is the only way to make one.  `[SNP-ABI 1.59 §5.3]` `[10]` `C:high` `V:durable`
- **Claim.** A Metadata page holds the security attributes of swapped-out pages in a well-defined format; the firmware converts a Firmware page into one by making the GPA field non-zero.  `[SNP-ABI 1.59 §5.3]` `[10]` `C:high` `V:durable`
- **Claim.** The asymmetry that makes the scheme sound: `RMPUPDATE` can invalidate a page but never validate one, so the hypervisor cannot manufacture a Pre-Swap or Guest-Valid page without a guest `PVALIDATE` or firmware assistance.  `[SNP-ABI 1.59 §5.3.2]` `[10]` `C:high` `V:durable`
- **Claim.** `PVALIDATE` cannot move Pre-Guest or Pre-Swap pages either, because both carry `Immutable = 1`.  `[SNP-ABI 1.59 §5.3.3]` `[10]` `C:high` `V:durable`

### Page validation

- **Claim.** Every page assigned to a VM starts unvalidated; a private-memory access to an unvalidated page raises `#VC`, and the guest uses `PVALIDATE` to set the flag at startup and to clear it when handing memory back, for example after a memory hot-unplug.  `[APM2 §15.36.6]` `[1]` `C:high` `V:durable`
- **Claim.** Validation is what makes hypervisor remapping detectable: once a page is validated, any `RMPUPDATE` that unassigns, reassigns or remaps it clears `Validated`, so the next guest access faults instead of silently reading substituted data.  `[APM2 §15.36.6]` `[1]` `C:high` `V:durable`

### Large pages

- **Claim.** `PSMASH` converts a 2 MB entry into 512 4 KB entries **while preserving the `Validated` bit**; the results get consecutive `Guest_Physical_Address` values, `Page_Size = 0`, and every other field copied from the original. Doing the same conversion with `RMPUPDATE` clears `Validated`.  `[APM2 §15.36.11]` `[1]` `C:high` `V:durable`
- **Claim.** The two page-size mismatches resolve in opposite directions: a 4 KB `PVALIDATE` or `RMPADJUST` against a 2 MB entry takes `#VMEXIT(NPF)` with `SIZEM` set so the hypervisor can smash and let the guest retry, while a 2 MB `PVALIDATE` against 4 KB entries returns `FAIL_SIZEMISMATCH` so the guest can fall back to 512 individual calls.  `[APM2 Table 15-39]` `[1]` `C:high` `V:durable`
- **Claim.** Coalescing 4 KB pages back into a 2 MB page has no x86 instruction — it needs the guest or the AMD-SP, and the firmware exposes it as `SNP_PAGE_UNSMASH`.  `[APM2 §15.36.11]` `[SNP-ABI 1.59 §8.26]` `[1][10]` `C:high` `V:durable`

## 14.4 The SNP instructions

All six live in APM Vol.3 Chapter 4, which is alphabetical and carries page numbers only — they are cited by mnemonic.

| Mnemonic | Opcode | Page (Rev 3.38) | Caller | Enumerated by |
|---|---|---|---|---|
| `PSMASH` | `F3 0F 01 FF` | 432 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |
| `PVALIDATE` | `F2 0F 01 FF` | 435 | guest, **VMPL0 only** | `Fn8000_001F_EAX[SNP]` |
| `RMPADJUST` | `F3 0F 01 FE` | 447 | guest, any VMPL | `Fn8000_001F_EAX[SNP]` |
| `RMPQUERY` | `F3 0F 01 FD` | 451 | guest, any VMPL | `Fn8000_001F_EAX[6]` |
| `RMPREAD` | `F2 0F 01 FD` | 454 | hypervisor, ASID 0 | `Fn8000_001F_EAX[21]` |
| `RMPUPDATE` | `F2 0F 01 FE` | 457 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |

- **Claim.** The six opcodes and enumeration bits are as tabulated; `RMPQUERY` and `RMPREAD` are later additions and carry their own CPUID bits instead of riding on the SNP bit, while the leaf itself is owned by `11-memory-encryption.md`.  `[APM3 §4 "RMPQUERY"]` `[APM3 §4 "RMPREAD"]` `[2]` `C:high` `V:durable`
- **Claim.** All six are CPL0-only (`#GP(0)` otherwise) and all but `PVALIDATE` are 64-bit-mode-only (`#UD` otherwise); `PVALIDATE` is recognised in any operating mode at CPL0.  `[APM3 §4 "PVALIDATE"]` `[APM3 §4 "RMPADJUST"]` `[2]` `C:high` `V:durable`
- **Claim.** The three hypervisor instructions return `FAIL_PERMISSION` rather than faulting when executed at an ASID other than 0, while `RMPADJUST` and `RMPQUERY` raise `#UD` when the guest is not SNP-active.  `[APM3 §4 "PSMASH"]` `[APM3 §4 "RMPADJUST"]` `[2]` `C:high` `V:durable`

### Return codes

- **Claim.** The shared return-code space is `0 SUCCESS`, `1 FAIL_INPUT`, `2 FAIL_PERMISSION`, `3 FAIL_INUSE`, `4 FAIL_OVERLAP`, `6 FAIL_SIZEMISMATCH`, `7 FAIL_BADADDR`, each instruction publishing only the subset it can produce; `OF`, `ZF`, `AF`, `PF` and `SF` are all set from the code.  `[APM3 §4 "RMPUPDATE"]` `[APM3 §4 "PSMASH"]` `[2]` `C:high` `V:durable`
- **Claim.** Per instruction the sets are: `PSMASH` 0/1/2/3/7, `PVALIDATE` 0/1/6, `RMPADJUST` 0/1/2/6, `RMPQUERY` 0/2, `RMPREAD` 0/1/2, `RMPUPDATE` 0/1/2/3/4 — a description that knows only `FAIL_OVERLAP=4` is describing `RMPUPDATE` alone.  `[APM3 §4 "PVALIDATE"]` `[APM3 §4 "RMPQUERY"]` `[2]` `C:high` `V:durable`

### PVALIDATE

- **Claim.** `PVALIDATE` takes the guest virtual address in `rAX`, the page size in `ECX[0]` and the new `Validated` value in `EDX[0]`; it is **only allowed at VMPL 0** and raises `#GP(0)` at any other VMPL.  `[APM3 §4 "PVALIDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** `rFLAGS.CF` is a *changed* indicator, not an error flag: `CF = 0` means an SNP-active guest actually flipped the bit, `CF = 1` means the bit already held that value **or** the instruction ran outside an SNP-active environment, where it behaves as a NOP and still returns `SUCCESS`.  `[APM3 §4 "PVALIDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** A `PVALIDATE` whose translation leaves the RMP-covered range, or whose entry is immutable, unassigned, GPA-mismatched, ASID-mismatched or page-size-mismatched against the nested page table, exits with `#VMEXIT(NPF)` instead of returning a code.  `[APM3 §4 "PVALIDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** `PVALIDATE` raises `#PF` if the effective C-bit was 0 during the guest page-table walk, so validating shared memory is impossible by construction; the C-bit is owned by `11-memory-encryption.md`.  `[APM3 §4 "PVALIDATE"]` `[2]` `C:high` `V:durable`

### RMPADJUST and RMPQUERY

- **Claim.** `RMPADJUST` takes the guest virtual address in `RAX`, the page size in `RCX[0]`, and packs the rest into `RDX`: `[7:0]` `TARGET_VMPL`, `[15:8]` `TARGET_PERM_MASK`, `[16]` `VMSA` (ignored unless the current VMPL is 0), `[63:17]` reserved.  `[APM3 §4 "RMPADJUST"]` `[2]` `C:high` `V:durable`
- **Claim.** `RMPADJUST` fails with `FAIL_PERMISSION` if `TARGET_VMPL <= CURRENT_VMPL` or if the requested mask contains any bit absent from the caller's own mask — a level can only delegate downward and can never widen its own rights.  `[APM3 §4 "RMPADJUST"]` `[2]` `C:high` `V:durable`
- **Claim.** `RMPADJUST` raises `#VC(PAGE_NOT_VALIDATED)` on an unvalidated page, so delegation is only possible on memory the guest has already accepted.  `[APM3 §4 "RMPADJUST"]` `[2]` `C:high` `V:durable`
- **Claim.** `RMPQUERY` is the read side — target level in `RDX[7:0]`, returning the mask in `RDX[15:8]`, the `VMSA` flag in `RDX[16]` (zero unless the caller is at VMPL0) and the page size in `RCX[0]` — and it too refuses a target that is not numerically higher than the caller.  `[APM3 §4 "RMPQUERY"]` `[2]` `C:high` `V:durable`

### RMPUPDATE, PSMASH, RMPREAD

- **Claim.** `RMPUPDATE` takes the target sPA in `RAX` and the address of the new 16-byte state in `RCX`; `FAIL_OVERLAP` is returned whenever a 4 KB update would coexist with an assigned 2 MB entry covering the same region, or a 2 MB update would cover any assigned 4 KB entry.  `[APM3 §4 "RMPUPDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** When `RMPUPDATE` changes any of `ASID`, `GUEST_PA`, `PAGE_SIZE` or `ASSIGNED`, hardware clears `VALIDATED` and the `VMSA` flag, grants **full permissions to VMPL0** and zeroes the masks of VMPL1 through VMPL(N−1), where N is `Fn8000_001F_EBX[15:12]` — see `11-memory-encryption.md` for the leaf.  `[APM3 §4 "RMPUPDATE"]` `[2]` `C:high` `V:durable`
- **Claim.** `PSMASH` takes a 2 MB-aligned sPA in `RAX` and returns `FAIL_BADADDR` (7) when the entry is immutable, unassigned, or not a 2 MB entry.  `[APM3 §4 "PSMASH"]` `[2]` `C:high` `V:durable`
- **Claim.** `RMPREAD` exists because the raw in-memory entry encoding is not architectural: it takes the sPA in `RAX` and a destination buffer in `RCX`, and its `2MB_REGION_STATUS` tells a 2 MB-aligned caller whether any 4 KB page from `RAX+0x1000` to `RAX+0x1FF000` is assigned.  `[APM3 §4 "RMPREAD"]` `[2]` `C:high` `V:durable`
- **Claim.** An entry's address comes from the architectural `GET_RMP_ENTRY_ADDR` pseudocode function — `RMP_BASE + 0x4000 + (sPA / 0x1000) × 16` for a non-segmented RMP, and a two-level walk when Segmented RMP is enabled.  `[APM3 §2.5.3]` `[2]` `C:high` `V:durable`

### Under a nested hypervisor

- **Claim.** A hypervisor running as a guest must replace `RMPUPDATE` and `PSMASH` with WRMSR to `VIRT_RMPUPDATE` (`C001_F001h`) and `VIRT_PSMASH` (`C001_F002h`); both MSRs and their enumeration bit `Fn8000_001F_EAX[29]` are **not implemented in the processor** and are expected to be emulated by the top-level hypervisor — see `15-nested-virtualization.md`.  `[APM2 §15.36.19]` `[1]` `C:high` `V:durable`
- **Claim.** `VIRT_RMPUPDATE` passes the 4 KB-aligned GPA in `RAX` and the new entry in `RDX` (bytes 7:0) and `R8` (bytes 15:8), returning the `RMPUPDATE` code in `RAX`; `VIRT_PSMASH` passes a 2 MB-aligned GPA in `RAX` and returns the `PSMASH` code in `RAX`.  `[APM2 §15.36.19]` `[1]` `C:high` `V:durable`

## 14.5 Virtual Machine Privilege Levels

VMPLs let a guest split itself into privilege domains the hypervisor cannot arbitrate. Each level of a vCPU is a separate VMSA, and each RMP entry carries one permission mask per implemented level.

- **Claim.** Within one vCPU the levels are represented by distinct VMSAs expected to run mutually exclusively, each tagged by the `VMPL` field in its VMSA; VMPL0 is the most privileged and numbering increases as privilege decreases.  `[APM2 §15.36.7]` `[1]` `C:high` `V:durable`

| Bit | Name | Meaning when 0 |
|---|---|---|
| 0 | Read (RD) | reads cause `#VMEXIT(NPF)` |
| 1 | Write (WR) | writes cause `#VMEXIT(NPF)` |
| 2 | Execute-User (XU) | execution at CPL 3 causes `#VMEXIT(NPF)` |
| 3 | Execute-Supervisor (XS) | execution at CPL < 3 causes `#VMEXIT(NPF)` |
| 4 | Supervisor-Shadow-Stack (SSS) | supervisor shadow-stack accesses cause `#VMEXIT(NPF)` |
| 7:5 | Reserved | SBZ |

- **Claim.** The permission mask is the five-bit layout above with bits 7:5 reserved SBZ, and the firmware reuses the identical encoding for the `VMPL1_PERMS`, `VMPL2_PERMS` and `VMPL3_PERMS` parameters of `SNP_LAUNCH_UPDATE`.  `[APM2 Table 15-36]` `[SNP-ABI 1.59 Table 73]` `[1][10]` `C:high` `V:durable`
- **Claim.** Three combinations are architecturally invalid and make `RMPADJUST` fail — a non-readable page with any other permission set (`R==0 && Permissions[7:1]!=0`), an executable supervisor shadow-stack page (`SSS==1 && (XU==1 || XS==1)`), and supervisor-executable without user-executable (`XS==1 && XU==0`) — and the firmware rejects the same three with `INVALID_PARAM`.  `[APM2 Table 15-37]` `[SNP-ABI 1.59 §8.18.2]` `[1][10]` `C:high` `V:durable`
- **Claim.** When the hypervisor assigns a page, VMPL0 receives full permissions and every other level none; the guest then uses `RMPADJUST` to hand out subsets downward, and a vCPU at VMPL1 can alter neither its own mask nor VMPL0's.  `[APM2 §15.36.7]` `[1]` `C:high` `V:durable`
- **Claim.** VMPL Supervisor Shadow Stack lets an SNP guest, rather than the hypervisor, designate which guest physical pages may back a supervisor shadow stack; it is enumerated by `Fn8000_001F_EAX[7]`, enabled by `SEV_FEATURES` bit 8, and is **mutually exclusive** with the nested-page-controlled form — setting both fails VMRUN with `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.36.7]` `[1]` `C:high` `V:durable`
- **Claim.** With VMPL SSS enabled, both supervisor and user shadow-stack accesses must target private pages; otherwise the guest takes `#PF` with the reserved-bit error code set.  `[APM2 §15.36.7]` `[1]` `C:high` `V:durable`
- **Claim.** The attestation path bounds levels at four in practice: `SNP_MSG_REPORT_REQ.VMPL` must be at least the current level and at most three, a guest-requested report carries 0–3, and a host-requested report carries `0xFFFFFFFF`.  `[SNP-ABI 1.59 §7.3]` `[10]` `C:high` `V:durable`

### Switching level, and reflecting `#VC` across one

- **Claim.** A guest changes the level its vCPU runs at by asking the hypervisor through the SNP Run VMPL event; each level needs its own VMSA and may have its own GHCB, and the hypervisor must update both system physical addresses before re-entering — the event encoding is in `13-sev-es-ghcb.md`.  `[GHCB 2.04 §4.1.14]` `[9]` `C:high` `V:durable`
- **Claim.** `SEV_FEATURES` bit 2 (`ReflectVC`) turns every event that would raise `#VC` into an Automatic Exit with exit code `VMEXIT_VC`, saving the original event into the VMSA fields `GUEST_EXITCODE`, `GUEST_EXITINFO1`, `GUEST_EXITINFO2`, `GUEST_EXITINTINFO` and `GUEST_NRIP`; those values decode exactly as in `05-exit-decoding.md`.  `[APM2 §15.36.9]` `[1]` `C:high` `V:durable`
- **Claim.** Reflect `#VC` is what lets a VMPL0 service handle a lower level's `#VC`: the hypervisor re-enters the vCPU at VMPL0, which reads the exit information out of the VMPL3 VMSA, transacts with the hypervisor, writes the response back and asks for the vCPU to resume at VMPL3.  `[APM2 §15.36.9]` `[1]` `C:high` `V:durable`
- **Claim.** Those five VMSA fields are populated by hardware on **every** Automatic Exit whether or not `ReflectVC` is set; for non-reflected exits they simply mirror the VMCB values.  `[APM2 §15.36.9]` `[1]` `C:high` `V:durable`

### Guest Intercept Control

- **Claim.** Guest Intercept Control lets a higher-privilege level intercept and emulate events for a lower one; it is enumerated by `Fn8000_001F_EAX[22]` and enabled by `SEV_FEATURES` bit 13.  `[APM2 §15.36.23]` `[1]` `C:high` `V:durable`
- **Claim.** The guest-controlled intercepts are eight 4-byte vectors in the VMSA starting at offset **900h**, laid out identically to the host-controlled vectors at VMCB offset 0h, and an event is intercepted if **either** bit is set; the host-side vectors belong to `03-intercepts.md`.  `[APM2 §15.36.23]` `[1]` `C:high` `V:durable`
- **Claim.** Guest-controlled MSR intercepts occupy four 8-byte vectors in the VMSA starting at offset **920h**, two bits per MSR with the low bit for read and the high bit for write; any MSR without defined bits there is **unconditionally intercepted**, so undefined guest intercept bits should be initialised to 1 at VM creation.  `[APM2 §15.36.23]` `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** x2APIC MSRs are exempt from guest intercept control while Secure AVIC mode is in use.  `[APM2 §15.36.23]` `[1]` `C:high` `V:durable`

## 14.6 Restricted and alternate injection

- **Claim.** `SEV_FEATURES` bits 3 and 4 select Restricted Injection and Alternate Injection; they are **mutually exclusive per VMSA** and enabling both fails VMRUN with `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** Restricted Injection disables all hypervisor interrupt queuing and event injection except `#HV`, **vector 28**, which is reserved for SNP guest use and never generated by hardware; it may only be injected as an exception (`EVENTINJ[Type]=3`) without an error code, and only into a VMSA running with Restricted Injection.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** With Restricted Injection, VMRUN fails with `VMEXIT_INVALID` if the hypervisor attempts an unsupported injection or tries to run the guest with AVIC enabled; the guest learns about events through a para-virtual interface for which `#HV` is the doorbell — see `07-virtual-interrupts-avic.md`.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** Alternate Injection moves queuing and injection into the guest: on VMRUN, event injection is read from the VMSA `EventInjCtrl` field at offset 3E0h and interrupt queuing from the VMSA `VIntrCtrl` field at offset 3B8h, while the VMCB `EventInjCtrl` at offset A8h is ignored — the host-side fields are in `02-vmcb.md`.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** Under Alternate Injection only `V_INTR_MASKING`, Virtual GIF Mode and AVIC Enable are still taken from the VMCB `VIntrCtrl` at offset 60h, AVIC Enable must be 0, and `V_TPR`, `V_IRQ`, `VGIF`, `V_INTR_PRIO`, `V_IGN_TPR`, `V_INTR_VECTOR`, `V_NMI`, `V_NMI_MASK` and `V_NMI_EN` all come from the VMSA instead.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 10 of the encrypted `VIntrCtrl` becomes the `INT_SHADOW` bit and the unencrypted one at VMCB offset 68h bit 0 is ignored; on `#VMEXIT`, `V_TPR`, `V_IRQ`, `V_NMI`, `V_NMI_MASK` and `INT_SHADOW` are written back only to the encrypted copy — see `02-vmcb.md`.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 63 of the encrypted `VIntrCtrl` is a `BUSY` bit: a VMRUN against a VMSA with `BUSY=1` fails with `VMEXIT_BUSY`, which is how a higher level marks a VMSA temporarily non-runnable while editing it.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** With either feature enabled, hardware treats physical INTR, NMI, INIT and `#MC` as intercepted regardless of the VMCB intercept bits, and under Alternate Injection guest accesses to the x2APIC MSR range `0x800`–`0x8FF` are intercepted regardless of the MSR permission bitmap.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`
- **Claim.** When Alternate Injection is on and a `#VC` occurred while processing an interrupt or exception, hardware sets `GUEST_EXITINTINFO.V` and `VINTR_CTRL[BUSY]` in the VMSA so a higher-privileged level can re-inject the interrupted event — see `05-exit-decoding.md` for the field format.  `[APM2 §15.36.9]` `[1]` `C:high` `V:durable`

## 14.7 vTOM, Secure TSC and Secure AVIC

Everything in this section is a per-VM opt-in selected through `SEV_FEATURES` in the VMSA at launch. The hypervisor cannot turn a protection on behind the guest's back; it can only refuse to run a guest that asks for one it will not permit.

| `SEV_FEATURES` bit | Feature | APM subsection |
|---|---|---|
| 0 | SNPActive | §15.36.2 |
| 1 | vTOM | §15.36.8 |
| 2 | ReflectVC | §15.36.9 |
| 3 / 4 | RestrictedInjection / AlternateInjection | §15.36.16 |
| 5 | DebugVirtualization | §15.36.13 |
| 6 | PreventHostIBS | §15.36.17 |
| 7 | BTBIsolation | §15.36.17 |
| 8 | VmplSSS | §15.36.7 |
| 9 | SecureTscEn | §15.36.18 |
| 13 | GuestInterceptCtl | §15.36.23 |
| 14 | VmsaRegProt | §15.36.17 |
| 15 | SmtProtection | §15.36.17 |
| 16 | SecureAvic | §15.36.21 |
| 21 | IbpbOnEntry | §15.36.17 |

- **Claim.** The `SEV_FEATURES` bit assignments above are each stated in the §15.36 subsection that defines the feature; the complete VMSA-side field, including the non-SNP bits 10–12, is published in `13-sev-es-ghcb.md`.  `[APM2 §15.36.2]` `[1]` `C:high` `V:durable`
- **Claim.** `SEV_STATUS` reports the same features **two bit positions higher** — `SEV_STATUS[n]` corresponds to `SEV_FEATURES[n−2]` for n ≥ 2 — because `SEV_STATUS` bits 0 and 1 carry SEV and SEV-ES enablement from the VMCB rather than from the VMSA; the register itself is owned by `12-sev.md`.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`
- **Claim.** A hypervisor can bound the set with Allowed SEV Features: enumerated by `Fn8000_001F_EAX[27]`, enabled by bit 63 at VMCB offset 138h, with `ALLOWED_SEV_FEATURES_MASK` bits 61:0 corresponding one-to-one to `SEV_FEATURES` bits 61:0 — VMCB layout belongs to `02-vmcb.md`.  `[APM2 §15.36.20]` `[1]` `C:high` `V:durable`
- **Claim.** When the mask is enabled, VMRUN checks every `SEV_FEATURES` bit set in the VMSA is also set in the mask and fails with `VMEXIT_INVALID` otherwise; on `#VMEXIT` the effective `SEV_FEATURES` is written to `GUEST_SEV_FEATURES` at VMCB offset 140h (see `02-vmcb.md`). Some features are unavailable entirely unless the mask is enabled and permits them.  `[APM2 §15.36.20]` `[1]` `C:high` `V:durable`

### Virtual Top-of-Memory

- **Claim.** With `SEV_FEATURES` bit 1 set, the VMSA's 2 MB-aligned `VIRTUAL_TOM` field — not the guest page tables — determines the C-bit for **data** accesses: below `VIRTUAL_TOM` the effective C-bit is 1, at or above it is 0, while page-table accesses and instruction fetches always run with an effective C-bit of 1. The C-bit itself is owned by `11-memory-encryption.md`.  `[APM2 §15.36.8]` `[1]` `C:high` `V:durable`
- **Claim.** With vTOM enabled the C-bit in the guest page-table entries must be zero for all accesses; setting it produces `#PF` with a reserved-bit error. This is what lets an unmodified guest OS with no notion of the C-bit — whose ordinary use is in `11-memory-encryption.md` — run inside an SNP VM behind a paravisor.  `[APM2 §15.36.8]` `[1]` `C:high` `V:durable`
- **Claim.** The Virtual TOM MSR `C001_0135` can change `VIRTUAL_TOM` at run time; it is enumerated by `Fn8000_001F_EAX[18]`, is read-write only while Virtual TOM is active (`#GP(0)` otherwise), has bits 63:52 and 20:0 reserved and read-as-zero, and a WRMSR to it flushes the current ASID's TLB entries.  `[APM2 §15.36.8]` `[1]` `C:high` `V:durable`

### Secure TSC

- **Claim.** With `SEV_FEATURES` bit 9 set, the guest's view of the time-stamp counter through `RDTSC`, `RDTSCP` or the TSC MSR is computed as the hardware TSC scaled by the VMSA's `GUEST_TSC_SCALE` and then offset by `GUEST_TSC_OFFSET`; the P0 frequency, `TSC_RATIO` (`C001_0104h`) and the VMCB `TSC_OFFSET` at offset 50h are **not** used — the hypervisor loses its handle on guest time.  `[APM2 §15.36.18]` `[1]` `C:high` `V:durable`
- **Claim.** `GUEST_TSC_SCALE` is an 8.32 fixed-point number — 8 integer bits and 32 fraction bits.  `[APM2 §15.36.18]` `[1]` `C:high` `V:durable`
- **Claim.** A Secure TSC guest may read `GUEST_TSC_FREQ` (MSR `C001_0134h`) for the effective guest TSC frequency in MHz; the MSR is read-only and both a write and a read from outside a Secure TSC guest raise `#GP(0)`. Guests are not expected to write the TSC MSR, and values read after such a write are undefined.  `[APM2 §15.36.18]` `[1]` `C:high` `V:durable`
- **Claim.** A guest that builds its own VMSA obtains the right scale and offset from the firmware with the `SNP_MSG_TSC_INFO_REQ` guest message, which returns `GUEST_TSC_SCALE` at offset 8h, `GUEST_TSC_OFFSET` at 10h and `TSC_FACTOR` at 18h.  `[SNP-ABI 1.59 §7.9]` `[10]` `C:high` `V:durable`
- **Claim.** `TSC_FACTOR` encodes the percentage drop from nominal to mean TSC frequency caused by clocking, applied as `GUEST_TSC_FREQ × (1 − TSC_FACTOR × 0.00001)`; a value of 200 is a 0.2 % reduction. It is also published to the guest in the secrets page at offset 160h.  `[SNP-ABI 1.59 §7.9]` `[SNP-ABI 1.59 Table 75]` `[10]` `C:high` `V:durable`

### Secure AVIC

- **Claim.** Secure AVIC accelerates APIC accesses for SNP guests while keeping the APIC state guest-owned; it is enumerated by `Fn8000_001F_EAX[26]`, selected by `SEV_FEATURES` bit 16, and **supports only the x2APIC MSR interface**.  `[APM2 §15.36.21.1]` `[1]` `C:high` `V:durable`
- **Claim.** Secure AVIC is mutually exclusive with Restricted Injection, Alternate Injection and hypervisor-controlled AVIC: if `SecureAvic` is set and either the VMCB AVIC Enable bit or `SEV_FEATURES` bits 3 or 4 is set, VMRUN fails with `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.36.21.2]` `[1]` `C:high` `V:durable`
- **Claim.** The Secure AVIC Control MSR `C001_0138` holds `SecureAvicEn` at bit 0, `AllowedNmi` at bit 1, bits 11:2 reserved MBZ, `GuestApicBackingPagePtr` in bits 51:12 and bits 63:52 reserved MBZ; VMRUN loads it from VMSA offset 320h and fails with `VMEXIT_INVALID` if `SecureAvicEn` is set while the pointer is not a valid guest physical address.  `[APM2 Figure 15-32]` `[1]` `C:high` `V:durable`
- **Claim.** The control MSR may only be accessed in Secure AVIC mode — any other access raises `#GP(0)` — and a write that sets `SecureAvicEn` with an invalid backing-page pointer also raises `#GP(0)`.  `[APM2 §15.36.21.3]` `[1]` `C:high` `V:durable`
- **Claim.** Interrupt injection becomes a negotiation: the host-controlled `RequestedIRR` at VMCB offset 150h is ANDed with the guest-controlled 256-bit `AllowedIRR` vector — bit *n* at bit position *n* mod 32 of offset `204h + n/32` in the guest APIC backing page — and ORed into that page's IRR, after which VMRUN clears `UpdateIRR` and `RequestedIRR` in the VMCB (see `02-vmcb.md`).  `[APM2 §15.36.21.2]` `[1]` `C:high` `V:durable`
- **Claim.** `V_NMI` is set by hardware if the guest-controlled `V_NMI` in the VMSA is set, or both the guest-controlled `AllowedNmi` and the host-controlled `V_NMI` in the VMCB are set, or `NmiReq` (offset 278h bit 0) in the guest APIC backing page is set, which VMRUN then clears.  `[APM2 §15.36.21.2]` `[1]` `C:high` `V:durable`
- **Claim.** The guest APIC backing page must stay pinned between VMRUN and `#VMEXIT` because some acceleration sequences are not restartable: a nested page fault on it sets `EXITINFO1` bit 63 (Not Restartable) and the VMSA `BUSY` bit, and an unvalidated backing page raises `#VC` with error code `NOT_RESTARTABLE` (0x406) — the exit fields are in `05-exit-decoding.md`.  `[APM2 §15.36.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** Secure AVIC classifies each guest APIC access as Allow, Fault (no access, `#VC`) or Trap (access performed, then `#VC`); behaviour matches x2AVIC except for Interrupt Command Register accesses, and x2APIC MSR intercepts in the MSR permission bitmap are ignored while Secure AVIC is enabled.  `[APM2 §15.36.21.5]` `[1]` `C:high` `V:durable`
- **Claim.** Hardware accelerates self-IPIs — an ICR MSR (`830h`) write with destination shorthand `01b`, and a `SELF_IPI` MSR (`83Fh`) write — while ICR writes with shorthand `10b`, `11b` or a specific target trap out with `AVIC_INCOMPLETE_IPI` and reason ID 5 (Unaccelerated IPI); the physical and logical APIC ID tables are unused in this mode.  `[APM2 §15.36.21.6]` `[1]` `C:high` `V:durable`
- **Claim.** In Secure AVIC mode, physical INTR, NMI, INIT and `#MC` are treated as intercepted regardless of the VMCB intercept bits, and on `#VMEXIT` the guest virtual interrupt state (`VIntrCtrl` bits 15:0) plus the control MSR are saved into the VMSA.  `[APM2 §15.36.21.2]` `[1]` `C:high` `V:durable`

### Debug registers and side-channel protections

- **Claim.** `SEV_FEATURES` bit 5 (`DebugVirtualization`) fully virtualises the debug registers by swapping `DR[0-3]` and `DR[0-3]_ADDR_MASK` as type "B" state; AMD's name for this feature is DebugVirtualization.  `[APM2 §15.36.13]` `[1]` `C:high` `V:durable`
- **Claim.** BTB Isolation (`SEV_FEATURES` bit 7) makes hardware guarantee that no code outside the guest context can influence the guest's branch-target predictions, flushing the BTB when necessary; hardware never writes new BTB prediction information while `SPEC_CTRL[IBRS]` is set, so AMD recommends hypervisor exit-handling code run with IBRS to avoid forcing a flush.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`
- **Claim.** IBPB on Entry (`SEV_FEATURES` bit 21, enumerated by `Fn8000_001F_EAX[31]`) makes hardware write `PRED_CMD[IBPB]=1` before executing any guest instruction on entry.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`
- **Claim.** `PreventHostIBS` (`SEV_FEATURES` bit 6) forbids the hypervisor from sampling the guest: VMRUN fails with `VMEXIT_INVALID` unless `IbsFetchCtl[IbsFetchEn]` and `IbsOpCtl[IbsOpEn]` are both 0.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`
- **Claim.** VMSA Register Protection (`SEV_FEATURES` bit 14) obfuscates selected registers before they are written to the VMSA on an Automatic Exit by XOR with an 8-byte nonce stored in the VMSA and refreshed pseudo-randomly on every Automatic Exit; which fields are obfuscated is implementation-specific, and a new VMSA should start with a random nonce.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`
- **Claim.** SMT Protection (`SEV_FEATURES` bit 15, enumerated by `Fn8000_001F_EAX[25]`) requires the sibling thread to be idle and in host mode at VMRUN or the instruction fails with `VMEXIT_IDLE_REQUIRED`; the hypervisor must HLT the sibling or place it in an I/O C-state first.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`
- **Claim.** An idle sibling does not leave the idle state on a wake-up event while SMT Protection is active; instead the processor writes the APIC ICR once with the value of the `IDLE_WAKEUP_ICR` MSR (`C001_0137h`) — only in x2APIC mode — and stays idle until the other thread enters host mode. That MSR has the same layout and access properties as the x2APIC ICR.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`

## 14.8 Segmented RMP

A single contiguous RMP is a NUMA problem: every core's RMP lookups land in one node's memory. Segmented RMP breaks it into per-range tables.

- **Claim.** Segmented RMP allocates non-contiguous RMP memory so each range of system physical addresses has its own RMP, which reduces access latency on NUMA systems; it is enumerated by `Fn8000_001F_EAX[23]`.  `[APM2 §15.36.22]` `[APM2 §15.36.22.1]` `[1]` `C:high` `V:durable`
- **Claim.** When Segmented RMP is supported, `Fn8000_0025_EAX[5:0]` (`MinRmpSegSize`) and `Fn8000_0025_EAX[11:6]` (`MaxRmpSegSize`) give the minimum and maximum segment sizes as 2^value Mbytes, and `Fn8000_0025_EBX[9:0]` (`NumCachedSegments`) gives how many segment definitions hardware caches.  `[APM2 §15.36.22.1]` `[1]` `C:high` `V:durable`
- **Claim.** `Fn8000_0025_EBX[10]` (`NumSegReduction`) selects the table size: 0 allows up to **512** RMP segments, 1 allows up to `NumCachedSegments`; for best performance the segment count should not exceed `NumCachedSegments`.  `[APM2 §15.36.22.1]` `[1]` `C:high` `V:durable`
- **Claim.** The Segmented RMP Configuration MSR `C001_0136` carries `SegRmpEn` at bit 0, bits 7:1 reserved MBZ, `RmpSegSize` at bits 13:8 and bits 63:14 reserved MBZ; segment size is 2^`RmpSegSize`, a value outside the min/max range raises `#GP(0)`, and the register becomes read-only once `SecureNestedPagingEn` is 1.  `[APM2 Figure 15-33]` `[1]` `C:high` `V:durable`
- **Claim.** With Segmented RMP enabled, `RMP_BASE` must be **1 MB aligned** (checked when `SecureNestedPagingEn` is set, `#GP(0)` otherwise); the first 16 KB of the region is processor bookkeeping and the next 4 KB holds the RMP Segment Table, which must be populated before enabling SNP and cannot be modified by software afterwards.  `[APM2 §15.36.22.2]` `[1]` `C:high` `V:durable`
- **Claim.** An RMP Segment Table entry is 8 bytes: `CoveredSize` in bits 19:0, `SegRmpBase` in bits 51:20, bits 63:52 reserved MBZ. `CoveredSize` is expressed in Gbytes, 0 means the segment is uncovered, and the RMP for a segment occupies `4MB × CoveredSize`.  `[APM2 Figure 15-34]` `[APM2 §15.36.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** A page has an RMP entry under Segmented RMP only if an RST entry exists for its address, that entry's `CoveredSize` is non-zero, and the page falls within the RMP defined by `SegRmpBase` and `CoveredSize`; otherwise it is a Hypervisor-Owned page.  `[APM2 §15.36.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** Reserved bits set in an RST entry produce a `#PF` or `#VMEXIT(NPF)` reserved-bit error during the walk when `NumSegReduction` is 0; when it is 1, a `#GP(0)` is raised at the 0-to-1 transition of `SecureNestedPagingEn` if any defined RST entry's RMP is outside valid physical address space.  `[APM2 §15.36.22.3]` `[1]` `C:high` `V:durable`
- **Claim.** RMP initialisation itself has a staged form so guests need not be suspended for the whole operation: `SNP_INIT_START`, `SNP_INIT_CONTINUE` and `SNP_INIT_FINISH` pre-initialise a segmented or non-segmented RMP, tracked in the firmware's `SNP_PREINIT_STATE`, after which `SNP_INIT_EX` runs with `INIT_RMP = 0`.  `[SNP-ABI 1.59 §5.2]` `[10]` `C:high` `V:durable`

## 14.9 The SNP CPUID page

The direct answer to "can a hypervisor lie to an SNP guest about CPUID?" is: it can try, the firmware filters the answer, and the guest measures the filtered answer.

- **Claim.** `SNP_LAUNCH_UPDATE` with `PAGE_TYPE_CPUID` (06h) inserts a hypervisor-supplied CPUID page, and the firmware checks every function structure on it before the page is encrypted and measured into the guest.  `[SNP-ABI 1.59 §8.18.2.6]` `[10]` `C:high` `V:durable`
- **Claim.** The CPUID page begins with `COUNT` at offset 00h, reserved dwords at 04h and 08h, and up to `COUNT_MAX` = **64** `CPUID_FUNCTION` records from offset 10h to C0Fh, of which only the first `COUNT` are valid.  `[SNP-ABI 1.59 Table 76]` `[10]` `C:high` `V:durable`
- **Claim.** Each `CPUID_FUNCTION` record is 48 bytes: `EAX_IN` 00h, `ECX_IN` 04h, `XCR0_IN` 08h, `XSS_IN` 10h, then the four outputs `EAX` 18h, `EBX` 1Ch, `ECX` 20h, `EDX` 24h, and a reserved qword at 28h — so the record is keyed by the XCR0 and `IA32_XSS` values in force at execution, not just the leaf.  `[SNP-ABI 1.59 Table 20]` `[10]` `C:high` `V:durable`
- **Claim.** The firmware only checks functions in the standard (`Fn0000_0000`–`Fn0000_FFFF`) or extended (`Fn8000_0000`–`Fn8000_FFFF`) ranges; anything outside those ranges passes through unchecked.  `[SNP-ABI 1.59 §8.18.2.6]` `[10]` `C:high` `V:durable`
- **Claim.** On the launch path an insecure value is a launch failure, not a silent correction: the firmware updates the field with an acceptable value and then returns `INVALID_PARAM`, leaving the page unencrypted, unmeasured and in its original state.  `[SNP-ABI 1.59 §8.18.2.6]` `[10]` `C:high` `V:durable`
- **Claim.** The same service exists at run time as the `SNP_MSG_CPUID_REQ`/`RSP` guest message pair (types 1 and 2), where the firmware silently substitutes acceptable values in the response; AMD notes this message may be removed in future versions as redundant with the CPUID page.  `[SNP-ABI 1.59 §7.1]` `[10]` `C:high` `V:durable`
- **Claim.** The policy the firmware applies to CPUID output is not published in the ABI document — it points at the PPR, which AMD does not publish for client parts and which is not in this corpus.  `[SNP-ABI 1.59 §8.18.2.6]` `[10]` `C:medium` `V:durable`
- **Claim.** A guest that finds the CPUID data unacceptable terminates through the termination request, whose AMD-owned reason code set 0x0 defines only `0x00` general, `0x01` protocol range unsupported and `0x02` SEV-SNP features unsupported; `GHCB_TERM_CPUID` is a **Linux** name in the Linux-owned reason code set, not an AMD-defined code — see `13-sev-es-ghcb.md`.  `[GHCB 2.04 §4.1.17]` `[9][400]` `C:high` `V:durable`

## 14.10 SNP firmware commands

The SNP ABI extends the SEV mailbox protocol of pub 55766 (see `12-sev.md`) with its own command identifiers and status codes.

| ID | Command | ID | Command |
|---|---|---|---|
| 81h | `SNP_INIT` | C0h | `SNP_PAGE_SWAP_OUT` |
| 82h | `SNP_SHUTDOWN` | C1h | `SNP_PAGE_SWAP_IN` |
| 83h | `SNP_PLATFORM_STATUS` | C2h | `SNP_PAGE_MOVE` |
| 84h | `SNP_DF_FLUSH` | C3h | `SNP_PAGE_MD_INIT` |
| 85h | `SNP_INIT_EX` | C6h | `SNP_PAGE_SET_STATE` |
| 86h | `SNP_SHUTDOWN_EX` | C7h | `SNP_PAGE_RECLAIM` |
| 87h | `SNP_INIT_START` | C8h | `SNP_PAGE_UNSMASH` |
| 88h | `SNP_INIT_CONTINUE` | C9h | `SNP_CONFIG` |
| 89h | `SNP_INIT_FINISH` | CAh | `DOWNLOAD_FIRMWARE_EX` |
| 90h | `SNP_DECOMMISSION` | CBh | `SNP_COMMIT` |
| 91h | `SNP_ACTIVATE` | CDh | `SNP_VLEK_LOAD` |
| 92h | `SNP_GUEST_STATUS` | CEh | `FEATURE_INFO` |
| 93h | `SNP_GCTX_CREATE` | CFh | `SNP_PLATFORM_STATUS_EX` |
| 94h | `SNP_GUEST_REQUEST` | D0h–EFh | reserved (SEV-TIO) |
| 95h | `SNP_ACTIVATE_EX` | F0h | `SNP_CSVCEK_CERT` |
| 96h | `SNP_HV_REPORT_REQ` | F1h | `SNP_GET_CORIM` |
| 97h | `SNP_TSC_INFO` | F2h | `SNP_GET_CSR` |
| A0h/A1h/A2h | `SNP_LAUNCH_START` / `_UPDATE` / `_FINISH` | F3h | `SNP_GET_TPM_INFO` |
| B0h/B1h | `SNP_DBG_DECRYPT` / `_ENCRYPT` | B2h | `SNP_VERIFY_MITIGATION` |

- **Claim.** The command identifiers above are AMD's Table 16 in full; the range `D0h`–`EFh` is reserved for SEV-TIO and the identifiers `C4h`, `C5h` and `CCh` are not assigned.  `[SNP-ABI 1.59 Table 16]` `[10]` `C:high` `V:durable`
- **Claim.** The ABI adds status codes on top of the SEV set: `19h INVALID_PAGE_SIZE`, `1Ah INVALID_PAGE_STATE`, `1Bh INVALID_MDATA_ENTRY`, `1Ch INVALID_PAGE_OWNER`, `1Dh AEAD_OFLOW`, `1Fh EXIT_RING_BUFFER`, `20h RMP_INIT_REQUIRED`, `21h BAD_SVN`, `22h BAD_VERSION`, `23h SHUTDOWN_REQUIRED`, `24h UPDATE_FAILED`, `25h RESTORE_REQUIRED`, `26h RMP_INIT_FAILED`, `27h INVALID_KEY`.  `[SNP-ABI 1.59 Table 17]` `[10]` `C:high` `V:durable`
- **Claim.** `SNP_INIT_EX` parameters are a bitfield at offset 00h — bit 0 `INIT_RMP`, bit 1 `LIST_PADDR_EN`, bit 2 `RAPL_DIS`, bit 3 `CIPHERTEXT_HIDING_DRAM_EN`, bit 4 `TIO_EN`, bit 5 `VIOMMU_EN` — plus `LIST_PADDR` at 08h and `MAX_SNP_ASID` at 10h.  `[SNP-ABI 1.59 Table 53]` `[10]` `C:high` `V:durable`
- **Claim.** With `INIT_RMP = 1` the firmware requires `MemoryEncryptionModEn`, `SecureNestedPagingEn`, `VMPLEn` and `MFDM` set in `SYSCFG` on all cores, `VM_HSAVE_PA` zero on all cores, `HWCR[SmmLock]` set on all cores, and all MTRRs, `IORR_BASE`, `IORR_MASK`, `TOM` and `TOM2` programmed identically, returning `INVALID_CONFIG` otherwise.  `[SNP-ABI 1.59 §8.9.2]` `[10]` `C:high` `V:durable`
- **Claim.** `SNP_INIT_EX` also initialises the IOMMU for RMP enforcement and moves the IOMMU event log, PPR log and completion-wait buffers into an RMP state that is read-only to the hypervisor and unassignable to guests; the IOMMU side is in `08-iommu-architecture.md`.  `[SNP-ABI 1.59 §8.9.2]` `[10]` `C:high` `V:durable`
- **Claim.** Ciphertext hiding is a platform-level option, not a per-guest one: `CIPHERTEXT_HIDING_DRAM_EN` at `SNP_INIT_EX` returns `INVALID_CONFIG` if the platform cannot do it or if CXL memory is present, and sets the maximum SNP ASID to `MAX_SNP_ASID`; a guest can *require* it through the launch policy.  `[SNP-ABI 1.59 §8.9.2]` `[10]` `C:high` `V:durable`
- **Claim.** A guest is launched with `SNP_LAUNCH_START` (binds a migration agent and initialises the launch digest context), `SNP_LAUNCH_UPDATE` (inserts pages and extends the digest) and `SNP_LAUNCH_FINISH` (finalises the digest and binds the identity keys); only after `SNP_LAUNCH_FINISH` may VMRUN be issued.  `[SNP-ABI 1.59 §4.5]` `[10]` `C:high` `V:durable`
- **Claim.** `SNP_LAUNCH_UPDATE` page types are `01h PAGE_TYPE_NORMAL`, `02h VMSA`, `03h ZERO`, `04h UNMEASURED`, `05h SECRETS`, `06h CPUID`, with 00h reserved; the type occupies bits 3:1 of the parameter word and the page size bit 0.  `[SNP-ABI 1.59 Table 72]` `[10]` `C:high` `V:durable`
- **Claim.** The launch digest is extended as `DIGEST_NEW := SHA-384(PAGE_INFO)`, where `PAGE_INFO` is 112 bytes: `DIGEST_CUR` at 0h (48 B), `CONTENTS` at 30h (48 B), `LENGTH` at 60h, `PAGE_TYPE` at 62h, `IMI_PAGE` at 63h bit 0, the three VMPL permission masks packed at 64h (VMPL1 bits 15:8, VMPL2 23:16, VMPL3 31:24) and `GPA` at 68h. The measurement therefore binds the gPA and the VMPL permissions, not just the bytes.  `[SNP-ABI 1.59 Table 74]` `[10]` `C:high` `V:durable`
- **Claim.** A guest's state machine is `GSTATE_INIT` (0h), `GSTATE_LAUNCH` (1h) and `GSTATE_RUNNING` (2h), stored in `GCTX.State`, and each state admits only a fixed command set.  `[SNP-ABI 1.59 Table 10]` `[10]` `C:high` `V:durable`

### The secrets page

`PAGE_TYPE_SECRETS` produces a 4 KB page the firmware fills, encrypts with the guest's VEK and measures. Three different specifications carve it up, which is why its layout is so often reported wrongly.

| Offset | Size | Field |
|---|---|---|
| 000h | 4 | `VERSION` — 5h in this specification |
| 004h | 4 | `IMI_EN` at bit 0 (unsupported, MBZ) |
| 008h | 4 | `FMS` — family/model/stepping as in `CPUID Fn0000_0001_EAX` |
| 00Ch | 4 | reserved |
| 010h | 16 | `GOSVW` |
| 020h / 040h / 060h / 080h | 32 each | `VMPCK0` … `VMPCK3` |
| 0A0h–0FFh | 96 | reserved for guest OS usage |
| 100h–13Fh | 64 | `VMSA_TWEAK_BITMAP` — bit *k* marks the *k*th VMSA quadword as tweaked |
| 140h–15Fh | 32 | reserved for guest OS usage |
| 160h | 4 | `TSC_FACTOR` |
| 164h | 4 | reserved |
| 168h | 8 | `LAUNCH_MIT_VECTOR` |
| 170h | 8 | `LAUNCH_TCB_VERSION` |
| 178h | 8 | reserved |
| 180h | 32 | `LAUNCH_ETCB_VERSION` |
| 1A0h–FFFh | — | reserved |

- **Claim.** The secrets page layout above is AMD's Table 75; its `VERSION` is 5h in ABI Rev 1.59, and the firmware guarantees the contents stay confidential to the guest and the firmware.  `[SNP-ABI 1.59 Table 75]` `[10]` `C:high` `V:durable`
- **Claim.** The two regions 56860 marks "reserved for guest OS usage" are claimed by other specifications: **0A0h–0FFh** is the 96-byte Secrets Page Guest Reserved Area defined by the GHCB specification — including the AP Jump Table physical address at offset 0x0010 *within that area*, i.e. secrets-page offset 0B0h — and is documented in `13-sev-es-ghcb.md`; **140h–15Fh** is the SVSM discovery block of §14.12.  `[SNP-ABI 1.59 Table 75]` `[GHCB 2.04 §2.7]` `[9][10]` `C:high` `V:durable`
- **Claim.** Guest activation must precede any memory assignment: `SNP_ACTIVATE` binds the ASID and installs the guest's VEK in that ASID's key slot, and the hypervisor must have run `WBINVD` on all cores followed by `SNP_DF_FLUSH` first; `SNP_ACTIVATE_EX` restricts activation to selected core complexes. The ASID and key hierarchy are owned by `12-sev.md`.  `[SNP-ABI 1.59 §4.4]` `[10]` `C:high` `V:durable`
- **Claim.** Swapping is a firmware operation, not a hypervisor one: `SNP_PAGE_SWAP_OUT` encrypts a page with the Offline Encryption Key and writes a metadata entry, `SNP_PAGE_SWAP_IN` reverses it, and `SNP_PAGE_MD_INIT` creates the Metadata pages they need.  `[SNP-ABI 1.59 §4.11]` `[10]` `C:high` `V:durable`
- **Claim.** A guest can refuse the whole swap and move machinery through launch policy bit 25 (`PAGE_SWAP_DISABLE`), after which `SNP_PAGE_MOVE`, `SNP_PAGE_SWAP_OUT` and `SNP_PAGE_SWAP_IN` return `POLICY_FAILURE`; the policy bitmap is owned by `12-sev.md`.  `[SNP-ABI 1.59 §8.23.2]` `[10]` `C:high` `V:durable`
- **Claim.** Migration needs a Migration Agent — itself an SNP VM bound to the primary VM at launch, part of its TCB, and the supplier of the VMRK; a guest launched without one can never be exported and can only relocate by shutting down.  `[SNP-ABI 1.59 §4.11]` `[10]` `C:high` `V:durable`
- **Claim.** Guest messages ride on `SNP_GUEST_REQUEST` and are protected with AES-256-GCM under one of four per-guest VMPCKs, each with its own monotonically increasing sequence number; out-of-order delivery causes the firmware to reject subsequent messages.  `[SNP-ABI 1.59 Ch.7]` `[10]` `C:high` `V:durable`
- **Claim.** The message header is 96 bytes: `AUTHTAG` at 00h (32 B), `MSG_SEQNO` in bits 63:0 at 20h with bits 127:64 reserved, `ALGO` at 30h, `HDR_VERSION` at 31h (1h for this specification), `HDR_SIZE` at 32h, `MSG_TYPE` at 34h, `MSG_VERSION` at 35h, `MSG_SIZE` at 36h, reserved at 38h, `MSG_VMPCK` at 3Ch, reserved through 5Fh, and the encrypted payload from 60h; the tag authenticates **from offset 20h to the end of the payload**, so the header from the sequence number onward is bound to the message.  `[SNP-ABI 1.59 Table 104]` `[10]` `C:high` `V:durable`
- **Claim.** Message types run `1/2` CPUID request and response, `3/4` key request and response, `5/6` report request and response, `7/8` export, `9`–`12` reserved import and absorb, `13/14` VMRK, `15/16` absorb with no migration agent, `17/18` TSC info, `27/28` vIOMMU config, `31/32` CSR, `37/38` TPM info.  `[SNP-ABI 1.59 Table 106]` `[10]` `C:high` `V:durable`

## 14.11 The attestation report

- **Claim.** A guest asks for a report with `SNP_MSG_REPORT_REQ`: 64 bytes of `REPORT_DATA` at 00h, the requested VMPL at 40h and `KEY_SEL` in bits 1:0 at 44h, where 0 selects VLEK if installed else the key indicated by `CsVcekPref`, 1 the legacy VCEK, 2 the VLEK and 3 the chip-secret VCEK.  `[SNP-ABI 1.59 Table 26]` `[10]` `C:high` `V:durable`

| Offset | Size | Field | Offset | Size | Field |
|---|---|---|---|---|---|
| 00h | 4 | `VERSION` | 1A0h | 64 | `CHIP_ID` |
| 04h | 4 | `GUEST_SVN` | 1E0h | 8 | `COMMITTED_TCB` |
| 08h | 8 | `POLICY` | 1E8h | 1 | `CURRENT_BUILD` |
| 10h | 16 | `FAMILY_ID` | 1E9h | 1 | `CURRENT_MINOR` |
| 20h | 16 | `IMAGE_ID` | 1EAh | 1 | `CURRENT_MAJOR` |
| 30h | 4 | `VMPL` | 1EBh | 1 | reserved |
| 34h | 4 | `SIGNATURE_ALGO` | 1ECh | 1 | `COMMITTED_BUILD` |
| 38h | 8 | `CURRENT_TCB` | 1EDh | 1 | `COMMITTED_MINOR` |
| 40h | 8 | `PLATFORM_INFO` | 1EEh | 1 | `COMMITTED_MAJOR` |
| 48h | 4 | flags: `AUTHOR_KEY_EN` b0, `MASK_CHIP_KEY` b1, `SIGNING_KEY` b4:2 | 1EFh | 1 | reserved |
| 50h | 64 | `REPORT_DATA` | 1F0h | 8 | `LAUNCH_TCB` |
| 90h | 48 | `MEASUREMENT` | 1F8h | 8 | `LAUNCH_MIT_VECTOR` |
| C0h | 32 | `HOST_DATA` | 200h | 8 | `CURRENT_MIT_VECTOR` |
| E0h | 48 | `ID_KEY_DIGEST` | 208h | 24 | reserved MBZ |
| 110h | 48 | `AUTHOR_KEY_DIGEST` | 220h | 32 | `CURRENT_ETCB` |
| 140h | 32 | `REPORT_ID` | 240h | 32 | `LAUNCH_ETCB` |
| 160h | 32 | `REPORT_ID_MA` | 260h | 32 | `COMMITTED_ETCB` |
| 180h | 8 | `REPORTED_TCB` | 280h | 32 | reserved MBZ |
| 188h/189h/18Ah | 1 each | `CPUID_FAM_ID` / `CPUID_MOD_ID` / `CPUID_STEP` | 2A0h | 512 | `SIGNATURE` |
| 4Ch | 4 | reserved MBZ | 18Bh–19Fh | 21 | reserved |

- **Claim.** The `ATTESTATION_REPORT` layout above is AMD's Table 27; the structure runs to 4A0h — 1184 bytes — and the signature at 2A0h covers **bytes 0h to 29Fh inclusive**.  `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`
- **Claim.** The report's `VERSION` field has moved across firmware ABI revisions — 3h, then 5h, then 6h — and **4h never existed**; the value current for a given firmware revision is version-bearing and belongs to `90-dated-landscape.md`.  `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`
- **Claim.** `SIGNING_KEY` (bits 4:2 at offset 48h) encodes 0 legacy VCEK, 1 VLEK, 2 chip-secret VCEK, 3–6 reserved, 7 none, and `AUTHOR_KEY_DIGEST` is zero unless `AUTHOR_KEY_EN` is 1.  `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`
- **Claim.** The `POLICY` field at offset 08h is the launch policy verbatim, and bit 17 of it is **reserved and must be one** — which is why the minimal SMT-permitting policy reads `0x30000` (bits 16 and 17) rather than `0x10000`. The bitmap as a whole is owned by `12-sev.md`.  `[SNP-ABI 1.59 Table 12]` `[10]` `C:high` `V:durable`
- **Claim.** `CHIP_ID` is zeroed when `MaskChipId` is set; when `MaskChipKey` is 1 the firmware writes zeroes into `SIGNATURE` instead of signing at all, and also blocks the guest from using the VCEK in key derivation. Verifiers are told to check every reserved field is zero.  `[SNP-ABI 1.59 §7.3]` `[SNP-ABI 1.59 §3.6]` `[10]` `C:high` `V:durable`
- **Claim.** `PLATFORM_INFO` bits are 0 `SMT_EN`, 1 `TSME_EN`, 2 `ECC_EN`, 3 `RAPL_DIS`, 4 `CIPHERTEXT_HIDING_DRAM_EN`, 5 `ALIAS_CHECK_COMPLETE`, 6 `IOMMU_WRITE_SAFE`, 7 `TIO_EN`, with 63:8 reserved; bits 5 and 6 report hardware or firmware mitigations whose CVEs are catalogued in `17-security.md`.  `[SNP-ABI 1.59 Table 28]` `[10]` `C:high` `V:durable`
- **Claim.** `TCB_VERSION` is a 64-bit structure whose field layout **differs by product line**: Table 3 for "Venice" is 23:16 SNP, 15:8 TEE, 7:0 FMC with 63:24 reserved and no boot loader field; Table 4 for "Turin" is 63:56 MICROCODE, 31:24 SNP, 23:16 TEE, 15:8 BOOT_LOADER, 7:0 FMC; Table 5 for "Genoa" and "Milan" is 63:56 MICROCODE, 55:48 SNP, 15:8 TEE, 7:0 BOOT_LOADER. A parser that assumes one layout misreads the others.  `[SNP-ABI 1.59 §2.3]` `[10]` `C:high` `V:durable`
- **Claim.** `ETCB_VERSION` is a separate 256-bit extended TCB covering the CPU microcode and further components; for "Venice" it spans 14 named fields from `IP_KEY_MANAGER` at bits 7:0 up to `AMD Root Guest` at bits 111:104.  `[SNP-ABI 1.59 §2.4]` `[10]` `C:high` `V:durable`
- **Claim.** The firmware derives the signing key from the systemwide `ReportedTcb`, which the hypervisor sets and the firmware guarantees never exceeds the installed TCB; it starts equal to `CurrentTcb`, is set by a non-zero `REPORTED_TCB` in `SNP_CONFIG`, and resets to `CommittedTcb` on `SNP_COMMIT` or a zero `REPORTED_TCB`.  `[SNP-ABI 1.59 §3.4]` `[10]` `C:high` `V:durable`
- **Claim.** `ReportedTcb` exists so a host can install new firmware and keep signing with the old key until guest owners have fetched the new certificates — which is exactly why a verifier must compare `REPORTED_TCB` against its own minimum baseline rather than trusting that it reflects the running firmware.  `[SNP-ABI 1.59 §3.4]` `[10]` `C:high` `V:durable`
- **Claim.** `SNP_LAUNCH_FINISH` optionally takes an ID block (`LD` at 0h, `FAMILY_ID` 30h, `IMAGE_ID` 40h, `VERSION` 50h which must be 1h, `GUEST_SVN` 54h, `POLICY` 58h) plus an ID authentication structure holding `ID_KEY_ALGO`, `AUTH_KEY_ALGO` and a signature over the whole ID block; the firmware checks the supplied digest and policy against the computed ones and validates the signature, then stores the keys in the guest context so they appear in every report.  `[SNP-ABI 1.59 Table 79]` `[SNP-ABI 1.59 Table 80]` `[10]` `C:high` `V:durable`
- **Claim.** The only signing algorithm the ABI defines is **ECDSA P-384 with SHA-384**, encoding 1h, with curve P-384 encoded 2h; the signature is 512 bytes holding R at 000h and S at 048h, each zero-extended little-endian, remainder reserved.  `[SNP-ABI 1.59 App.B]` `[10]` `C:high` `V:durable`
- **Claim.** A host can obtain a guest's report without the guest's participation using `SNP_HV_REPORT_REQ` (96h); such a report is marked by `VMPL = 0xFFFFFFFF` and a zero-filled `REPORT_DATA`.  `[SNP-ABI 1.59 §7.3]` `[SNP-ABI 1.59 §8.33]` `[10]` `C:high` `V:durable`
- **Claim.** A guest with a migration agent carries the agent's report ID in `REPORT_ID_MA`, and a verifier that accepts such a report must also verify the migration agent's own report — the agent is inside the guest's TCB.  `[SNP-ABI 1.59 §4.11]` `[10]` `C:high` `V:durable`

## 14.12 The Secure VM Service Module

An SVSM is guest-owned firmware that runs at VMPL0 and offers services to the guest OS at a lower level. It is the answer to "who does the guest trust for a vTPM, for `PVALIDATE`, or for APIC emulation, if not the hypervisor?"

- **Claim.** The SVSM advertises itself by writing into the region of the secrets page reserved for it: `SVSM_BASE` at 0x140 (8 B), `SVSM_SIZE` at 0x148 (8 B), `SVSM_CAA` at 0x150 (8 B), `SVSM_MAX_VERSION` at 0x158 (4 B), `SVSM_GUEST_VMPL` at 0x15C (1 B) and three reserved bytes at 0x15D. Those bytes are zeroed when the firmware builds the secrets page, so a zero `SVSM_SIZE` means no SVSM is present.  `[SVSM 1.01 §4.1]` `[11]` `C:high` `V:durable`
- **Claim.** The firmware's own secrets page definition marks 140h–15Fh only as "reserved for guest OS usage" — the field assignment is owned by pub 58019, not 56860, and the two must be read together.  `[SNP-ABI 1.59 Table 75]` `[10][11]` `C:high` `V:durable`
- **Claim.** The SVSM is expected to zero the VMPL0 VMPCK in the secrets page before handing control down, so the guest OS cannot read or forge the SVSM's conversation with the AMD-SP.  `[SVSM 1.01 §4.1]` `[11]` `C:high` `V:durable`
- **Claim.** Components without access to the secrets page discover the SVSM through two deliberately non-architectural hooks handled by the guest's own `#VC` handler: `CPUID(EAX=8000_001F)` returning `EAX[28]=1`, and a read of MSR `C001_F000` returning the Calling Area's guest physical address. Neither is ever set or implemented by hardware or by AMD-SP-generated CPUID data.  `[SVSM 1.01 §4.2]` `[11]` `C:high` `V:durable`
- **Claim.** The Calling Area is a 4 KB-aligned page outside the SVSM's memory with unrestricted VMPL permissions: `SVSM_CALL_PENDING` at 0x000 (1 B), `SVSM_MEM_AVAILABLE` at 0x001, `SVSM_NO_EOI_REQ` at 0x002 and five reserved bytes at 0x003 that the SVSM need not verify.  `[SVSM 1.01 §5]` `[11]` `C:high` `V:durable`
- **Claim.** A call loads `RAX` with the protocol number in bits 63:32 and the call identifier in bits 31:0, sets `SVSM_CALL_PENDING` to 1 and executes VMGEXIT; the guest must then clear `SVSM_CALL_PENDING` **atomically** and inspect the old value, because a non-zero old value means the host never ran the call — see `13-sev-es-ghcb.md`.  `[SVSM 1.01 §5]` `[11]` `C:high` `V:durable`
- **Claim.** The SVSM defends itself against a host that enters it spuriously: on entry it sets `VMSA.EFER.SVME = 0` for the calling vCPU so the host cannot re-enter it, checks `SVSM_CALL_PENDING`, and checks `VMSA.EXITCODE` indicates a VMGEXIT boundary — failing either, it restores `SVME` and returns without acting; the VMGEXIT mechanism is in `13-sev-es-ghcb.md`.  `[SVSM 1.01 §5]` `[11]` `C:high` `V:durable`
- **Claim.** Protocol numbers are 0 Core, 1 Attestation, 2 vTPM, 3 APIC Emulation, 4 UEFI Management Mode, with `0x8000_0000`–`0x8000_FFFF` reserved for AMD reference-implementation protocols.  `[SVSM 1.01 §5]` `[11]` `C:high` `V:durable`
- **Claim.** Result codes returned in `RAX` are 32-bit and partitioned: 0 `SVSM_SUCCESS`; the rest of the range up to 0x0000_0FFF reserved (AMD's table prints that range's lower bound as 0x0000_0000, overlapping `SVSM_SUCCESS`); 0x0000_1000–0x3FFF_FFFF protocol-defined; 0x4000_0000–0x7FFF_FFFF a request for more memory with bits 29:0 giving the number of 4 KB pages needed; then `0x8000_0000 SVSM_ERR_INCOMPLETE`, `0x8000_0001 SVSM_ERR_UNSUPPORTED_PROTOCOL`, `0x8000_0002 SVSM_ERR_UNSUPPORTED_CALL`, `0x8000_0003 SVSM_ERR_INVALID_ADDRESS`, `0x8000_0004 SVSM_ERR_INVALID_FORMAT`, `0x8000_0005 SVSM_ERR_INVALID_PARAMETER`, `0x8000_0006 SVSM_ERR_INVALID_REQUEST`, `0x8000_0007 SVSM_ERR_BUSY`.  `[SVSM 1.01 §5]` `[11]` `C:high` `V:durable`
- **Claim.** Every SVSM must implement the Core protocol, whose calls are 0 `SVSM_CORE_REMAP_CA`, 1 `SVSM_CORE_PVALIDATE`, 2 `SVSM_CORE_CREATE_VCPU`, 3 `SVSM_CORE_DELETE_VCPU`, 4 `SVSM_CORE_DEPOSIT_MEM`, 5 `SVSM_CORE_WITHDRAW_MEM`, 6 `SVSM_CORE_QUERY_PROTOCOL`, 7 `SVSM_CORE_CONFIGURE_VTOM`; versioning is strictly additive and version 2 adds a 4 KB fallback flag to `SVSM_CORE_PVALIDATE`.  `[SVSM 1.01 §6]` `[11]` `C:high` `V:durable`
- **Claim.** `SVSM_CORE_PVALIDATE` exists because the instruction is architecturally restricted to VMPL0: a guest OS running at VMPL1 or lower physically cannot execute it and must ask the SVSM.  `[APM3 §4 "PVALIDATE"]` `[SVSM 1.01 §6.3]` `[2][11]` `C:high` `V:durable`
- **Claim.** The APIC Emulation protocol (ID 3) exists to support Alternate Injection and offers 0 `SVSM_APIC_QUERY_FEATURES`, 1 `SVSM_APIC_CONFIGURE_EMULATION`, 2 `SVSM_APIC_READ_REGISTER`, 3 `SVSM_APIC_WRITE_REGISTER`, 4 `SVSM_APIC_CONFIGURE_VECTOR`.  `[SVSM 1.01 §9]` `[11]` `C:high` `V:durable`
- **Claim.** APIC emulation covers a fixed register set addressed by x2APIC MSR number — `0x802` x2APIC ID (RO), `0x808` TPR (R/W), `0x80A` PPR (RO), `0x80B` EOI (WO), `0x80D` LDR (RO), `0x810`–`0x817` ISR (RO), `0x818`–`0x81F` TMR (RO), `0x820`–`0x827` IRR (RO), `0x830` ICR (R/W), `0x83F` self-IPI (WO) — and only Fixed and NMI IPI types are in the basic protocol.  `[SVSM 1.01 §9.1]` `[11]` `C:high` `V:durable`
- **Claim.** Two optional APIC capabilities are advertised in the query response: bit 0 timer functionality and bit 1 INIT and SIPI message delivery, with bits 63:2 reserved MBZ.  `[SVSM 1.01 §9.1]` `[11]` `C:high` `V:durable`
- **Claim.** The remaining protocols are Attestation (`SVSM_ATTEST_SERVICES`, `SVSM_ATTEST_SINGLE_SERVICE`), vTPM (`SVSM_VTPM_QUERY`, `SVSM_VTPM_CMD`) and UEFI Management Mode (`SVSM_UEFI_MM_REQUEST`), each publishing a service attestation GUID and manifest so a verifier can see which services were present.  `[SVSM 1.01 §7]` `[SVSM 1.01 §8]` `[11]` `C:high` `V:durable`

## 14.13 VCEK, VLEK and the key distribution service

- **Claim.** The VCEK is derived from chip-unique secrets **and** a `TCB_VERSION`, so it changes when the TCB does; it can be computed for any `TCB_VERSION` at or below `CurrentTcb`, which is what lets secrets migrate across firmware updates, and it is endorsed by a chain rooted in an AMD manufacturing CA.  `[SNP-ABI 1.59 §2.2]` `[10]` `C:high` `V:durable`
- **Claim.** EPYC supports two VCEK flavours: the **legacy VCEK**, whose certificate chain is fetched from the AMD Key Distribution Service, and the **chip-secret VCEK (CSVCEK)**, whose chain is retrieved on-device through the SNP ABI and is derived using a Device Identifier Composition Engine.  `[SNP-ABI 1.59 §2.2]` `[10]` `C:high` `V:durable`
- **Claim.** The CSVCEK chain runs AMD Root CA → AMD IDevID Signer CA (both fixed per family and distributed by AMD) → IDevID → … → CSVCEK, with the lower certificates following the Caliptra 1.x formats and retrieved on-device via `SNP_CSVCEK_CERT` (F0h).  `[SNP-ABI 1.59 App.C]` `[10]` `C:high` `V:durable`
- **Claim.** The VLEK is an ECDSA P-384 key certified by AMD and derived from a **per-cloud-service-provider seed held by AMD's Key Derivation Service**, not from a chip secret; the provider asks the KDS for a VLEK hashstick for a given TCB and `CHIP_ID`, the KDS wraps it with a transport key derived from a chip-unique secret, and the provider installs it with `SNP_VLEK_LOAD` (CDh).  `[SNP-ABI 1.59 §3.7]` `[10]` `C:high` `V:durable`
- **Claim.** Once loaded, the VLEK is a drop-in replacement for the VCEK everywhere; the hypervisor can force its use by setting `VCEK_DIS` in `SNP_LAUNCH_FINISH`, otherwise the guest chooses per request through `KEY_SEL`.  `[SNP-ABI 1.59 §3.7]` `[10]` `C:high` `V:durable`
- **Claim.** The firmware returns `INVALID_KEY` when the selection is unsatisfiable: `KEY_SEL=0` with no VLEK loaded and `VcekDis` set, `KEY_SEL=1` with `VcekDis` set, `KEY_SEL=2` with no VLEK loaded, or `KEY_SEL=3` with `VcekDis` set or `CsVcekEn` clear.  `[SNP-ABI 1.59 §7.3]` `[10]` `C:high` `V:durable`
- **Claim.** The verifier's rule follows from the key derivation, not from policy: because the signing key is derived from `ReportedTcb`, a report only proves the platform was at **some** TCB at or below the installed one, so the verifier must independently require `REPORTED_TCB` ≥ its own accepted baseline and must fetch the certificate for exactly that TCB.  `[SNP-ABI 1.59 §3.4]` `[SNP-ABI 1.59 §2.2]` `[10]` `C:high` `V:durable`
- **Claim.** The KDS endpoint URLs and their per-TCB query parameters are specified in pub 57230 (VCEK certificate and KDS interface), which is not part of the locally verified corpus; 56860 states only that the legacy VCEK chain comes from the KDS and that AMD provides an interface to retrieve a VLEK certificate for a provider at a specified TCB version.  `[SNP-ABI 1.59 §3.7]` `[10][13]` `C:medium` `V:durable`
- **Claim.** Certificates are issued per TCB version rather than per report, so revocation granularity is the TCB, not the individual VM — a compromised guest cannot be revoked through this chain, which is why the launch measurement and the ID block carry the guest-specific identity instead.  `[SNP-ABI 1.59 §2.2]` `[SNP-ABI 1.59 §4.6]` `[10]` `C:medium` `V:durable`
- **Claim.** Attestation must be evaluated somewhere the host cannot reach: the report is signed by the AMD-SP and unforgeable by the hypervisor, but nothing stops a malicious host from tampering with a verifier it also runs, so the relying party must be outside the machine under attestation.  `[SNP-ABI 1.59 §7.3]` `[10]` `C:medium` `V:durable`
- **Claim.** Guest key derivation is the second consumer of the same key material: `SNP_MSG_KEY_REQ` mixes a selectable set of guest identity fields into a 32-byte derived key returned in `SNP_MSG_KEY_RSP`, and `MaskChipKey` blocks the VCEK from being used in that derivation as well as in signing.  `[SNP-ABI 1.59 §7.2]` `[SNP-ABI 1.59 §3.6]` `[10]` `C:high` `V:durable`

## 14.14 Open items

- **The raw RMP entry encoding is not published.** AMD gives the field list (Table 15-34) and the 16-byte software structures used by `RMPREAD` and `RMPUPDATE`, but never the in-memory bit layout of an entry. Software that reads the RMP directly rather than through `RMPREAD` is relying on an unpublished layout.
- **Two internal cross-references in §15.36 are stale in Rev 3.45.** §15.36.9 points at "Section 15.36.15" for Alternate Injection, which is actually §15.36.16 (TLB management is §15.36.15); §15.36.12 points at "Section 15.36.8" for VMSAVE restrictions, which is §15.36.12 itself, and refers to "Table 15-39" where it means Table 15-40. Neither affects the normative content, and AMD has no documentation errata channel — corrections merge silently into the next revision.
- **56860 Rev 1.59 mis-numbers its own TCB_VERSION table.** The prose says "described in Table 4 for processors codenamed Venice" while the Venice table is captioned Table 3 and Table 4 is Turin. Cite the caption, not the prose.
- **`§15.36.21` subsections are body-only.** The Rev 3.45 bookmark tree stops at §15.36.21; the headings `15.36.21.1`–`15.36.21.6` and `15.36.22.1`–`15.36.22.3` exist only as printed section titles in the body. They are cited here on that basis.
- **The KDS URL grammar is unverified here.** Pub 57230 is not in the locally verified corpus, so no endpoint path or query-parameter names are asserted in §14.13.
- **CPUID validation policy is undocumented in public.** 56860 §8.18.2.6 defers the per-function acceptability policy to the PPR, and AMD publishes no PPR for the parts this matters on.
- **Claim.** There is no architectural limit of 255 vCPUs on an SEV-SNP guest; 255 is a hypervisor-side xAPIC-era limit and configurations using x2APIC exceed it. No AMD specification states any such bound.  `[no-spec]` `[57]` `C:medium` `V:durable`
- **Not in this chapter.** Ciphertext-hiding availability by generation, firmware revision history, ABI feature-introduction dates and cloud availability are in `90-dated-landscape.md`; CacheWarp, WeSee, RMPocalypse, BadRAM and the rest of the SNP attack literature are in `17-security.md`; the SEV key hierarchy, ASID partitioning, `SEV_STATUS` and the guest policy bitmap are in `12-sev.md`.
