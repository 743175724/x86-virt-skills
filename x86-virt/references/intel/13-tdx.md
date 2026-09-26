# 13. Intel Trust Domain Extensions (TDX)

> **中文速览**：本章是 TDX 的规范级参考，覆盖信任模型、SEAM 之上的 TDX Module 架构、四类控制结构（TDR / TDCS / TDVPR+TDVPS / PAMT）、SEAMCALL（`TDH.*`）与 TDCALL（`TDG.*`）的完整 leaf 枚举与 leaf 编号、TD 生命周期状态机、Secure EPT 状态与页接受流程、GHCI/TDVMCALL 调用约定、TDREPORT 证明链，以及 TD Migration / TD Partitioning / TDX Connect 三个扩展。需要写 VMM 侧 TDX 使能代码、TD guest 侧 enlightenment，或需要判断某个调用序列是否合法时读它。ISA 级 SEAM 事实（SEAMCALL/SEAMRET/SEAMOPS 指令语义、SEAMRR、SEAM-only MSR）归 `09-smm-seam.md`，本章只做交叉引用；EPT 结构本体归 `06`；所有带日期的落地状态（云厂商 GA、内核合入版本、发行版支持）归 `90`。

**Maps to:** Intel TDX Module Base Architecture Specification, Order 348549-008 (May 2026) [11]; Intel TDX Module ABI Specification, Order 348551-008 (May 2026) [12]
**Owns:** all TDX facts — SEAM-hosted TDX Module architecture, TDR/TDCS/TDVPR/TDVPS/PAMT/TDMR, the `TDH.*` and `TDG.*` leaf spaces and their leaf numbers, TD life cycle and OP_STATE, Secure EPT states and page acceptance, TLB tracking, GHCI/TDVMCALL, MRTD/RTMR/TDREPORT_STRUCT attestation, TD Migration, TD Partitioning, TDX Connect, plus CVE-2025-30513 and TDXRay
**See also:** `09-smm-seam.md` (SEAM ISA: instruction semantics, SEAMRR, SEAM MSRs) · `06-address-translation.md` (EPT paging structures) · `02-vmcs.md` (VMCS fields) · `05-vm-exit.md` (exit reasons and qualification) · `15-security.md` (transient-execution mitigation matrix) · `90-dated-landscape.md` (availability, kernel/distro/cloud dates)

> **⚠ Scope: server only.** This skill targets Windows PCs, and **no client part
> implements TDX** — it is a Xeon feature, gated on SEAM support that consumer
> silicon does not ship. Read this chapter only for a Xeon, confidential-computing
> or cloud question. If someone asks whether their desktop or laptop "has TDX",
> the answer is no; see `18-comparison-amd-arm-riscv.md` §18.11 for what a client
> Windows PC actually has. The chapter is kept complete and specification-anchored
> because the architecture is asked about often, not because it applies locally.

---

## 13.1 The document set, and how this chapter cites it

TDX is not specified in the SDM. It is specified by a set of standalone Intel documents plus an ABI data release; the nine rows below are the ones this chapter anchors against. Intel's own specification set (ABI §1.1, Table 1.1) is larger — it also names the TDX Module Interrupt Virtualization Architecture Specification, the TD Migration and TDX Connect ABI reference specifications, and TDX Module ABI Incompatibilities. Section numbers used as anchors in this chapter were read from the PDFs themselves (cover pages and tables of contents extracted on 2026-09-20); the order numbers and revisions match the baseline in `CONVENTIONS.md §5`.

| Anchor prefix | Document | Order-Rev | Bib |
|---|---|---|---|
| `TDX-BASE` | TDX Module Base Architecture Specification | 348549-008US, May 2026 | [11] |
| `TDX-ABI` | TDX Module ABI Specification | 348551-008US, May 2026 | [12] |
| — | TDX Module ABI Definitions (PDF/CSV/JSON tables) | June 2026 | [13] |
| `TDX-ISA` | Intel Trust Domain CPU Architectural Extensions | 343754-003US, Aug 2026 | [14] |
| `TDX-SEAMLDR` | TDX SEAM Loader (SEAMLDR) Interface Specification | 343755-004US, May 2025 | [15] |
| `TDX-GHCI` | Guest-Hypervisor Communication Interface v1.5 | 348552-004US, Mar 2023 | [16] |
| `TDX-CONNECT` | TDX Connect Architecture Specification | 354629-003US, Jun 2025 | [17] |
| `TDX-MIG` | TD Migration Architecture Specification | 348550-008US, Jun 2026 | [19] |
| `TDX-PART` | TD Partitioning Architecture Specification | 354807-006US, May 2026 | [20] |

Two structural quirks matter when navigating these PDFs. The Base spec is split into "Section 1: Introduction and Overview" (chapters 1–3) and "Section 2: Architecture Specification" (chapters 4 onward), but chapter numbering is continuous, so `§9.2` is unambiguous. The TD Partitioning spec restarts its chapter numbering at 10 and 20 rather than 1 and 2, so `§11.1` is its overview introduction, not a typo.

- **Claim.** The TDX Module Base Architecture Specification is Order 348549-008US, dated May 2026, and is 209 pages.  `[TDX-BASE §1.1]` `[11]` `C:high` `V:durable`
- **Claim.** The TDX Module ABI Specification is Order 348551-008US, dated May 2026, and is 335 pages; it is the normative source for interface-function leaf numbers, operands and completion status codes.  `[TDX-ABI §1.1]` `[12]` `C:high` `V:durable`
- **Claim.** The GHCI document is titled "Guest Hypervisor Communication Interface (GHCI) for Intel Trust Domain Extensions (Intel TDX) 1.5", Order 348552-004US, March 2023 — it has not been revised since, so its internal SDM chapter cross-references are stale and must not be propagated.  `[TDX-GHCI §1.1]` `[16]` `C:high` `V:durable`

---

## 13.2 Trust model: what TDX removes from the TCB

TDX's security objective is to run a VM — a Trust Domain (TD) — whose memory contents and CPU state are confidential from, and integrity-protected against, all other software on the platform, including the host VMM that schedules it. The mechanism is not a separate security coprocessor (that is AMD's approach with the PSP; see `18-comparison-amd-arm-riscv.md`) but a new CPU mode, SEAM, that hosts a CPU-measured firmware module which arbitrates between VMM and TD.

- **Claim.** SEAM is an extension of VMX operation and, like VMX, has root and non-root forms: SEAM root operation, whose software is a *SEAM module* and which has two sub-modes — loader mode (at most one logical processor at a time) and module mode (multiple logical processors in parallel) — and SEAM non-root operation, whose software is a *SEAM guest*. The older phrasing "SEAM VMX root / SEAM VMX non-root / operation in SEAM" survives only in the SEAMLDR specification; 343754-003 and SDM Vol.3C §35.1 both use the newer wording.  `[TDX-ISA §1.1]` `[SDM 3C §35.1]` `[TDX-SEAMLDR §1.1]` `[14][15]` `C:high` `V:durable`
- **Claim.** SEAM root operation hosts a CPU-attested software module, the Intel TDX Module, which builds, tears down and starts execution of TDs; VMs launched or resumed from SEAM VMX root are TDs, and VMs launched or resumed from legacy VMX root are legacy VMs. The "CPU-attested" and "legacy VMs" wording is the SEAMLDR specification's; 343754-003 covers the same ground in its Appendix A.1 without those two phrases.  `[TDX-SEAMLDR §1.1]` `[15][14]` `C:high` `V:durable`
- **Claim.** The TDX Module uses the SEAM instruction-set extensions to protect the confidentiality and integrity of TD memory contents and CPU state from all other software including the hosting VMM, unless explicitly shared by the TD itself.  `[TDX-SEAMLDR §1.1]` `[TDX-BASE Ch.2]` `[15][11]` `C:high` `V:durable`
- **Claim.** TDX defines two logical modes on top of the CPU modes: logical TDX root mode (VMX root, entering SEAM root only while a host-side function executes) and logical TDX non-root mode (SEAM non-root for TD guest execution, with brief excursions to VMX root while a guest-side function executes).  `[TDX-BASE §2.3]` `[11]` `C:high` `V:durable`
- **Claim.** Host-side interface function names begin with `TDH` (Trust Domain Host) and are invoked by the VMM with `SEAMCALL`; guest-side interface function names begin with `TDG` (Trust Domain Guest) and are invoked by the TD with `TDCALL`. In both cases the leaf is selected by an input operand in RAX.  `[TDX-BASE §2.11]` `[11]` `C:high` `V:durable`
- **Claim.** In SEAM root operation, SMIs, uncore machine checks and machine-check SMIs (MSMIs) are masked and delivered only after leaving SEAM root operation; `VMXOFF` and `VMCALL` executed in SEAM root operation raise #GP(0).  `[TDX-ISA §3.1]` `[14]` `C:high` `V:durable`
- **Claim.** `INVD` causes a #GP when executed while the SEAM range is valid and protected, because invalidating caches without write-back could corrupt SEAM software's modified data.  `[TDX-ISA §4.2]` `[14]` `C:high` `V:durable`

The TCB that remains is: the CPU (microcode and hardware), the TDX Module, and — for remote attestation only — the quote-signing path described in §13.13. The VMM, host OS, SMM, BIOS after MCHECK, devices, and the platform operator are outside it. Guest OS code inside the TD is inside the TD's own TCB, which is the principal architectural difference from SGX's process-granular enclave model.

---

## 13.3 SEAM range, the TDX Module, and the loading path

`09-smm-seam.md` owns the ISA-level definition of the SEAM range registers and the SEAM transfer VMCS. What follows is the minimum needed to understand where the TDX Module lives and how it gets there.

- **Claim.** The SEAM range is allocated by the MSR pair IA32_SEAMRR_BASE (MSR 1400H) and IA32_SEAMRR_MASK (MSR 1401H); their existence is enumerated by IA32_MTRRCAP (MSR FEH) bit 15. See `09-smm-seam.md` for the full ISA treatment.  `[TDX-ISA §4.1]` `[14]` `C:high` `V:durable`
- **Claim.** Bit 11 of IA32_SEAMRR_MASK indicates that the SEAM range is valid and protected; when it is 1, accesses to SEAM-range physical addresses from outside SEAM root operation are aborted — writes ignored, reads returning all-ones.  `[TDX-ISA §4.1]` `[14]` `C:high` `V:durable`
- **Claim.** The SEAM range is partitioned by the processor into two sub-ranges, MODULE_RANGE (bottom of the range, holding the TDX Module and the per-LP SEAM transfer VMCSs) and P_SEAMLDR_RANGE (top of the range, defined by the per-core CRs CR_SEAMLDR_RR_BASE and CR_SEAMLDR_RR_MASK, accessible only in loader-mode SEAM root operation).  `[TDX-ISA §4.1]` `[TDX-SEAMLDR §1.1]` `[14][15]` `C:high` `V:durable`
- **Claim.** In the module sub-range, the SEAM transfer VMCS for logical processor x resides at byte offset (x + 1) * 4096, where x is the x2APIC ID returned by CPUID.1FH.0:EDX.  `[TDX-ISA §4.1]` `[14]` `C:high` `V:durable`
- **Claim.** The contents of the SEAM range are encrypted by the TME-MK engine with a machine-specific key that is typically ephemeral and regenerated on each platform restart.  `[TDX-ISA §4.1]` `[14]` `C:high` `V:durable`
- **Claim.** The loading chain is two-stage: Intel's Non-Persistent SEAM Loader (NP-SEAMLDR), an authenticated code module launched via `GETSEC[ENTERACCS]`, initializes the SEAM range and installs the embedded P-SEAMLDR image into P_SEAMLDR_RANGE; the persistent P-SEAMLDR then measures, verifies and installs TDX Module images into MODULE_RANGE.  `[TDX-SEAMLDR §1.1]` `[15]` `C:high` `V:durable`
- **Claim.** The P-SEAMLDR exposes four SEAMCALL-reachable API functions, leaves 0 to 3: SEAMLDR.INFO, SEAMLDR.INSTALL, SEAMLDR.SHUTDOWN and SEAMLDR.SEAMINFO.  `[TDX-SEAMLDR Ch.4]` `[15]` `C:high` `V:durable`
- **Claim.** SEAMLDR.INSTALL authenticates SEAM_SIGSTRUCT, verifies that the measured image equals SEAM_SIGSTRUCT.MRSEAM, and — in the "update" scenario — rejects an image whose SEAMSVN is lower than the currently installed module's SEAMSVN.  `[TDX-SEAMLDR §4.2]` `[15]` `C:high` `V:durable`
- **Claim.** On CPUs supporting TD-preserving updates, SEAMLDR.INSTALL checks that the handoff data left in MODULE_RANGE by the outgoing module is valid and that its version is one the incoming module can consume, as declared by the MODULE_HV, MIN_UPDATE_HV and NO_DOWNGRADE fields of SEAM_SIGSTRUCT.  `[TDX-SEAMLDR §4.2]` `[15]` `C:high` `V:durable`
- **Claim.** A SEAMCALL whose RAX bit 63 is 1 is dispatched to the P-SEAMLDR rather than to the TDX Module; for TDX Module interface functions RAX bit 63 must be 0.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** The SVN of the NP-SEAMLDR ACM is reported in IA32_SGX_SVN_STATUS bits 63:56, and an OS/VMM is expected to read that MSR before launching the ACM to decide whether a newer ACM is required.  `[TDX-SEAMLDR §1.1]` `[15]` `C:high` `V:durable`
- **Claim.** The TDX Module's platform-scope lifecycle after loading is `TDH.SYS.INIT` (global, once) → `TDH.SYS.LP.INIT` (per logical processor) → `TDH.SYS.RD`/`TDH.SYS.RDALL`/`TDH.SYS.INFO` (enumeration) → `TDH.SYS.CONFIG` (global configuration of TDMRs and PAMTs) → `TDH.SYS.KEY.CONFIG` (per package) → `TDH.SYS.TDMR.INIT` (incremental TDMR/PAMT initialization).  `[TDX-BASE §4.2]` `[TDX-BASE §4.3]` `[11]` `C:high` `V:durable`
- **Claim.** Until the module's state reaches SYS_READY, only `TDH.SYS.RD*`, `TDH.SYS.INFO`, `TDH.SYS.INIT`, `TDH.SYS.LP.INIT`, `TDH.SYS.CONFIG`, `TDH.SYS.KEY.CONFIG` and `TDH.SYS.SHUTDOWN` are accepted; in state SYS_DISABLE only `TDH.SYS.DISABLE` is accepted.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** TD-preserving module update is driven by `TDH.SYS.SHUTDOWN` (shut down and prepare handoff data) followed, after the new image is installed by SEAMLDR.INSTALL, by `TDH.SYS.UPDATE` (repopulate module state from handoff data).  `[TDX-BASE §4.6]` `[11]` `C:high` `V:durable`

---

## 13.4 Control structures — TDR, TDCS, TDVPR/TDVPS, PAMT

This is the part the previous edition of this skill omitted entirely. There are two scopes (TD and TD-VCPU) and three access classes (shared, private, opaque).

- **Claim.** TDX control structures are classified as shared (managed directly by the host VMM, encrypted with a shared HKID), private (mapped into the TD's GPA space and directly accessible by the TD), or opaque (not directly accessible to any software except the TDX Module, nor to DMA, and encrypted with a private HKID).  `[TDX-BASE §6.1]` `[11]` `C:high` `V:durable`
- **Claim.** All guest-TD control structures reside in memory pages allocated by the host VMM out of the pre-configured TDMRs, and are physically addressable by the host VMM even when opaque.  `[TDX-BASE §6.1]` `[11]` `C:high` `V:durable`

### 13.4.1 TDR — Trust Domain Root

- **Claim.** TDR is the root control structure of a guest TD and occupies a single 4KB naturally aligned page; it is the first TD page allocated and the last removed, and its physical address serves as the TD's unique identifier for as long as any TD page or control structure resides in memory.  `[TDX-BASE §6.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDR is encrypted with the Intel TDX *global* private HKID, not the TD's own ephemeral key, so that the module can still control the TD while the TD's private HKID is unknown or while its key-management state forbids access to TD-key-encrypted memory.  `[TDX-BASE §6.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDR holds fields controlling the guest TD build and teardown process and fields managing memory-encryption keys.  `[TDX-BASE §6.2.1]` `[11]` `C:high` `V:durable`

### 13.4.2 TDCS — Trust Domain Control Structure

- **Claim.** TDCS is the main TD-scope control structure, encrypted with the guest TD's ephemeral private key, and is a multi-page logical structure composed of multiple TDCX physical pages added by `TDH.MNG.ADDCX`.  `[TDX-BASE §6.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** TDCS holds TD-wide operation fields, execution-control configuration (debuggability, permitted CPU features), measurement fields, the EPTP pointing at the Secure EPT root page together with EPT attributes, the MSR bitmaps shared by all of the TD's VCPUs, the Secure EPT root page itself, and a constant zero page encrypted with the TD's private key.  `[TDX-BASE §6.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** TDCS may hold forward links to Secure EPT pages and to Migration Stream Context (MIGSC) pages.  `[TDX-BASE §6.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** TDCS.OP_STATE is a defined metadata field of TDCS and is the TD's operation sub-state (see §13.7.2).  `[TDX-ABI §4.1.3]` `[12]` `C:high` `V:durable`

### 13.4.3 TDVPR and TDVPS — the VCPU structures

- **Claim.** TDVPS (Trust Domain Virtual Processor State) is the root control structure of a TD VCPU; it is a single logical structure composed of multiple physical 4KB pages and holds VCPU state while the VCPU is not running.  `[TDX-BASE §6.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDVPR (Trust Domain Virtual Processor Root) is the 4KB root page of TDVPS, and its physical address serves as the unique identifier of the VCPU for as long as it resides in memory.  `[TDX-BASE §6.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDCX (Trust Domain Control structure eXtension) 4KB pages extend TDVPR to provide enough physical space for the logical TDVPS; the required number of TDVPR/TDCX pages is enumerated to the VMM by `TDH.SYS.RD*` or `TDH.SYS.INFO`.  `[TDX-BASE §6.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** Logically, TDVPS comprises the TD VMCS, TD VMCS auxiliary structures (virtual-APIC page, virtualization-exception information area, and similar), TD VCPU management fields, and TD VCPU state fields (GPRs, CRs, DRs, MSRs, extended state) not held in the TD VMCS.  `[TDX-BASE §6.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** MSR bitmaps are held in TDCS rather than TDVPS because they are required to have the same value for every VCPU of the same TD.  `[TDX-BASE §6.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDVPR and TDCX pages are encrypted with the TD's ephemeral private key and are opaque to software and DMA; the host VMM allocates their memory but cannot read them, and must use `TDH.VP.RD`/`TDH.VP.WR` for metadata access.  `[TDX-BASE §6.3.1]` `[TDX-BASE §6.4]` `[TDX-ABI §4.2]` `[11][12]` `C:high` `V:durable`
- **Claim.** The Shared EPT and some other VMX control structures are deliberately not protected; they are the non-protected VCPU-scope structures the host VMM manages directly.  `[TDX-BASE §6.3.2]` `[11]` `C:high` `V:durable`

**Relationship to the VMCS a TD's vCPU runs on.** A TD vCPU still executes under an ordinary VMCS — the "TD VMCS" — but that VMCS lives inside TDVPS, is not mapped in any linear address space, and is written only by the TDX Module. The host VMM reaches the small set of fields it is permitted to influence through `TDH.VP.WR`, not through `VMWRITE`.

- **Claim.** After `TDH.VP.INIT`, the host VMM typically writes a small permitted set of TD VMCS execution controls through `TDH.VP.WR`: the Shared EPTP, the posted-interrupt descriptor address (see `07-apic-virtualization.md` for that structure), the posted-interrupt notification vector and "process posted interrupts" control, bus-lock detection, and notify-window / notification exiting.  `[TDX-BASE §7.4]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.VP.INIT` copies TDCS.EPTP — the address of the Secure EPT root page — into the VCPU's TD VMCS EPTP field, clearing the HKID bits to 0 so that the host VMM can still use `INVEPT` for the Shared EPT, which shares an ASID with the Secure EPT.  `[TDX-BASE §9.8]` `[11]` `C:high` `V:durable`

### 13.4.4 TDMR and PAMT — physical page ownership and type

- **Claim.** A Trust Domain Memory Region (TDMR) is a host-VMM-declared range of convertible memory pages, based on the Convertible Memory Range (CMR) information checked and securely recorded by MCHECK at boot.  `[TDX-BASE §8.1]` `[11]` `C:high` `V:durable`
- **Claim.** TDMR configuration is "soft" — no hardware range registers are used; each TDMR is a single physical address range whose size is a multiple of 1GB and which is 1GB-aligned, TDMRs may not overlap, and TDMRs are configured at platform scope.  `[TDX-BASE §8.2]` `[11]` `C:high` `V:durable`
- **Claim.** A TDMR may contain reserved areas, each 4KB-aligned with a size that is a multiple of 4KB; this lets the VMM carve non-TDX holes out of a 1GB-granular TDMR.  `[TDX-BASE §8.2]` `[11]` `C:high` `V:durable`
- **Claim.** With static PAMT each TDMR is controlled by one logical Physical Address Metadata Table composed of three arrays — PAMT_1G, PAMT_2M and PAMT_4K — corresponding to the three page-mapping sizes; PAMT memory is VMM-allocated and encrypted with the TDX global private HKID.  `[TDX-BASE §8.1]` `[11]` `C:high` `V:durable`
- **Claim.** With dynamic PAMT (where supported), the 4KB pages holding PAMT_4K entries are allocated on demand by the host VMM via `TDH.PHYMEM.PAMT.ADD`/`TDH.PHYMEM.PAMT.REMOVE`, and a statically allocated per-TDMR PAMT_PAGE_BITMAP controls their allocation.  `[TDX-BASE §8.1]` `[TDX-BASE §8.3]` `[11]` `C:high` `V:durable`
- **Claim.** PAMT enforces three properties: every physical page in a TDMR has a well-defined page type and page size; a physical page in a TDMR is assigned to at most one TD; and the page size of any private TD page mapped in Secure EPT matches its PAMT page-size attribute.  `[TDX-BASE §8.3]` `[11]` `C:high` `V:durable`
- **Claim.** A leaf PAMT entry holds PT (page type), OWNER (bits 51:12 of the owning TD's TDR physical address), BEPOCH (the TDCS.TD_EPOCH value at the time the page or SEPT page was blocked by `TDH.MEM.RANGE.BLOCK`), and, for migration, MIG_EPOCH and EXPORT_COUNT.  `[TDX-BASE §8.3.1]` `[11]` `C:high` `V:durable`
- **Claim.** Defined PAMT page types are PT_NDA (not directly assigned at this level), PT_RSVD (4KB page reserved for non-TDX use, used to implement TDMR reserved areas), PT_REG (TD private page), PT_PR (removed private page pending completion of removal or reclamation, on ACT platforms only), PT_TDR, PT_TDCX, PT_TDVPR, PT_EPT (Secure EPT page), PT_TR (only on modules implementing page resize without tracking, enumerated by TDX_FEATURES0.NON_BLOCKING_RESIZE, bit 35), PT_PAMT (dynamic PAMT only, at PAMT_2M), plus additional types defined for TDX Connect.  `[TDX-BASE §8.3.2]` `[11]` `C:high` `V:durable`
- **Claim.** PT_PR applies only to platforms that protect TDX memory using the Access Control Table, as enumerated by TDX_FEATURES0.ACT (bit 14).  `[TDX-BASE §8.3.2]` `[11]` `C:high` `V:durable`

### 13.4.5 Key IDs and TME-MK integration

- **Claim.** TDX reuses the MKTME encryption engines and key slots, and the TDX ISA partitions the activated HKID space into shared HKIDs (usable by legacy MKTME) and private HKIDs (usable only in SEAM mode); the partition sizes are read from IA32_MKTME_KEYID_PARTITIONING (MSR 87H).  `[TDX-BASE §5.2]` `[TDX-ISA Ch.2]` `[11][14]` `C:high` `V:durable`
- **Claim.** IA32_MKTME_KEYID_PARTITIONING.NUM_MKTME_KIDS[31:0] enumerates the general-use TME-MK key identifiers, numbered 1..NUM_MKTME_KIDS; NUM_TDX_PRIV_KIDS[63:32] enumerates the SEAM-private key identifiers, numbered NUM_MKTME_KIDS+1 .. NUM_MKTME_KIDS+NUM_TDX_PRIV_KIDS. HKID 0 is the legacy TME shared key.  `[TDX-ISA Ch.2]` `[TDX-BASE §5.2]` `[14][11]` `C:high` `V:durable`
- **Claim.** IA32_TME_ACTIVATE (MSR 982H) field MK_TME_KEYID_BITS[35:32] gives the number of physical-address bits interpreted as a KeyID, and TDX_RESERVED_KEYID_BITS[39:36] gives the number of KeyID bits that may be set only in SEAM-private KeyIDs; with m = CPUID.80000008H:EAX[7:0], k = MK_TME_KEYID_BITS and p = TDX_RESERVED_KEYID_BITS, a physical address contains a SEAM-private KeyID if it sets any of bits m-1:m-p.  `[TDX-ISA Ch.2]` `[14]` `C:high` `V:durable`
- **Claim.** The host VMM never has access to TD encryption keys; it manages HKID *assignment* and triggers engine configuration through the host-side functions, while the keys themselves are generated by the module and hardware.  `[TDX-BASE §2.4]` `[11]` `C:high` `V:durable`
- **Claim.** Attempting to load a control register or MSR with a physical address carrying a SEAM-private KeyID from outside SEAM operation raises #GP(0); a paging-structure entry with such an address causes a page fault, an EPT paging-structure entry with such an address causes an EPT misconfiguration, and VM entry fails if it would load such an address from any VMCS field other than the SEAM shared EPT pointer.  `[TDX-ISA §4.2]` `[14]` `C:high` `V:durable`
- **Claim.** On platforms that do not use ACT, TDX supports two memory-integrity modes: Cryptographic Integrity (Ci), where memory content is encrypted and protected by a MAC plus a TD Owner bit, and Logical Integrity (Li), where it is encrypted and protected by the TD Owner bit alone; in both modes the memory controllers store a 1-bit TD Owner metadatum per cache line, covered by ECC.  `[TDX-BASE §16.2]` `[11]` `C:high` `V:durable`
- **Claim.** In Ci mode the memory controller computes a 28-bit MAC per cache line over the ciphertext, a 128-bit encryption tweak, the TD Owner bit and a 128-bit MAC key; the tweak is produced by encrypting the physical address with a 128-bit per-HKID ephemeral AES-XTS tweak key generated at key configuration time (`TDH.SYS.KEY.CONFIG` / `TDH.MNG.KEY.CONFIG`).  `[TDX-BASE §16.2]` `[11]` `C:high` `V:durable`
- **Claim.** The TDX ISA specification defines the TME-MK interoperation but does not fix a data-encryption key length; Intel's per-generation TDX feature-readiness matrix reports an AES key size of 128 bits for 4th and 5th Gen Xeon and 256 bits for Xeon 6 (both E-core and P-core), so any blanket statement that "TDX is AES-128-XTS" is generation-specific and wrong as a general claim.  `[TDX-ISA Ch.2]` `[14][251]` `C:medium` `V:durable`

---

## 13.5 Host-side interface: the SEAMCALL `TDH.*` leaves

- **Claim.** For a SEAMCALL to the TDX Module, RAX bits 15:0 select the leaf number and bits 23:16 the interface-function version number; **bit 24 is INTERRUPT_MODE**, selecting whether pending interrupts are detected regardless of the host VMM's RFLAGS.IF (support enumerated by TDX_FEATURES0.HOST_SIDE_INTERRUPT_MODE, bit 62) and ignored by non-interruptible leaves; **bits 62:25** are reserved and must be 0; bit 63 selects P-SEAMLDR dispatch and must be 0 for TDX Module interface functions.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** SEAMCALL may fail before reaching a leaf function — with #UD, #GP(0), or a VMfailInvalid condition signalled by RFLAGS.CF = 1 — if the CPU mode is wrong, the TDX Module has not been loaded, or the module has been disabled; on VMfailInvalid, RAX is left unmodified.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** On a successful dispatch, the module returns via SEAMRET with RAX set to the leaf function's completion status code.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`

Leaf numbers below are from the SEAMCALL leaf-number table in the ABI specification. Grouping follows the module's own classification in the Base spec.

**TDX Module management (`TDH.SYS.*`, `TDH.EXT.*`)**

- **Claim.** `TDH.SYS.INIT` (leaf 33) globally initializes the module; `TDH.SYS.LP.INIT` (35) initializes it per logical processor; `TDH.SYS.CONFIG` (45) globally configures it; `TDH.SYS.KEY.CONFIG` (31) configures the TDX global private key on the current package; `TDH.SYS.TDMR.INIT` (36) partially initializes a TDMR.  `[TDX-ABI §5.4.1]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.SYS.INFO` (32), `TDH.SYS.RD` (34) and `TDH.SYS.RDALL` (37) enumerate module global-scope metadata; `TDH.SYS.WR` (63) writes a global-scope metadata field and is itself marked an unreleased-feature preview in the ABI specification.  `[TDX-ABI §5.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.SYS.SHUTDOWN` (52) shuts the module down and prepares handoff data, `TDH.SYS.UPDATE` (53) repopulates module state from handoff data, and `TDH.SYS.DISABLE` (69) disables the module; `TDH.SYS.LP.SHUTDOWN` (44) does nothing and exists only for backward compatibility.  `[TDX-ABI §5.4.1]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.EXT.INIT` (60) and `TDH.EXT.MEM.ADD` (61) initialize the TDX Module extension mechanism and add up to 512 4KB pages to the module's memory pool; the ABI specification marks these as an unreleased-feature preview.  `[TDX-ABI §5.4.12]` `[TDX-ABI §5.4.13]` `[12]` `C:medium` `V:durable`

**TD management (`TDH.MNG.*`)**

- **Claim.** `TDH.MNG.CREATE` (leaf 9) creates a guest TD and its TDR root page and generates the TD's random ephemeral key.  `[TDX-ABI §5.4.46]` `[TDX-BASE §7.3]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.KEY.CONFIG` (leaf 8) configures the TD private key on a single package and must be repeated for every package on the platform.  `[TDX-ABI §5.4.48]` `[TDX-BASE §7.1]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.ADDCX` (leaf 1) adds one TDCX control-structure page to a TD and is called repeatedly until TDCS has the required number of pages.  `[TDX-ABI §5.4.45]` `[TDX-BASE §7.3]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.INIT` (leaf 21) initializes per-TD control structures in TDR and TDCS from a TD_PARAMS input structure, and creates the Secure EPT root page inside one of the previously added TDCX pages, setting TDCS.EPTP.  `[TDX-ABI §5.4.47]` `[TDX-BASE §7.3]` `[TDX-BASE §9.8]` `[12][11]` `C:high` `V:durable`
- **Claim.** TD_PARAMS carries ATTRIBUTES and XFAM, other configuration such as the number of L2 VMs, a set of user-provided measurement fields that will appear in TDREPORT_STRUCT, and the virtual CPUID and virtual MSR configuration for the TD.  `[TDX-BASE §7.3]` `[TDX-ABI §3.4.5]` `[11][12]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.VPFLUSHDONE` (leaf 19) verifies that all of a TD's VCPUs have been flushed by `TDH.VP.FLUSH`, and `TDH.MNG.KEY.FREEID` (leaf 20) marks the TD's HKID as free.  `[TDX-ABI §5.4.52]` `[TDX-ABI §5.4.49]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.RD` (11) and `TDH.MNG.WR` (13) read and write TD-scope metadata; `TDH.MNG.KEY.RECLAIMID` (27) does nothing and is retained only for backward compatibility. Both deprecated leaves (27 and `TDH.SYS.LP.SHUTDOWN`'s 44) are documented in their own ABI sections but omitted from the Table 5.4 leaf-number summary, so their numbers look like gaps there.  `[TDX-ABI §5.4.51]` `[TDX-ABI §5.4.53]` `[TDX-ABI §5.4.50]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`

**VCPU scope (`TDH.VP.*`)**

- **Claim.** `TDH.VP.CREATE` (leaf 10) creates a guest TD VCPU and its TDVPR root page; `TDH.VP.ADDCX` (4) adds a TDCX page to that VCPU; `TDH.VP.INIT` (22) initializes the per-VCPU control structures.  `[TDX-ABI §5.4.80]` `[TDX-ABI §5.4.79]` `[TDX-ABI §5.4.83]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.VP.ENTER` (leaf 0) enters TDX non-root operation — it is the TD-entry primitive and deliberately occupies leaf number 0, as ABI Table 5.4 and Base Table 2.3 both state. Its own ABI section's RAX table misprints the leaf number as 10 (`TDH.VP.CREATE`'s value); that is a defect in 348551-008US and 0 is correct.  `[TDX-ABI §5.4.81]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.VP.FLUSH` (leaf 18) flushes the address-translation caches and the cached TD VMCS associated with a TD VCPU, dissociating it from the logical processor.  `[TDX-ABI §5.4.82]` `[TDX-BASE §10.3]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.VP.RD` (26) and `TDH.VP.WR` (43) read and write VCPU-scope metadata; they are the host VMM's metadata route into TDVPS, whose pages are opaque control structures under the TD's private HKID.  `[TDX-ABI §5.4.84]` `[TDX-ABI §5.4.85]` `[12]` `C:high` `V:durable`

**Physical memory management (`TDH.PHYMEM.*`)**

- **Claim.** `TDH.PHYMEM.PAGE.RECLAIM` (leaf 28) reclaims a physical page owned by a TD — a private page, a Secure EPT page or a control-structure page — and marks it PT_NDA in the PAMT.  `[TDX-ABI §5.4.58]` `[TDX-BASE §7.5]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.PHYMEM.PAGE.WBINVD` (leaf 41) writes back and invalidates all cache lines associated with a specified memory page and HKID; `TDH.PHYMEM.CACHE.WB` (40) writes back the cache contents of a WBINVD domain.  `[TDX-ABI §5.4.59]` `[TDX-ABI §5.4.56]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.PHYMEM.PAGE.RDMD` (leaf 24) reads the PAMT metadata of a page in a TDMR; `TDH.PHYMEM.PAMT.ADD` (58) and `TDH.PHYMEM.PAMT.REMOVE` (59) add and remove a pair of dynamic-PAMT pages.  `[TDX-ABI §5.4.57]` `[TDX-ABI §5.4.60]` `[TDX-ABI §5.4.61]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.PHYMEM.CACHE.WB` executes on the WBINVD domain of the logical processor it runs on, and TDX operations requiring it must run it on one LP per WBINVD domain on the platform; on newer processors a WBINVD domain may be a group of LPs within a package rather than a whole package.  `[TDX-BASE §5.3]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.PHYMEM.CACHE.WB` is not required when TDX_FEATURES0.SKIP_PHYMEM_CACHE_WB (bit 34), readable through `TDH.SYS.RD`, is 1.  `[TDX-BASE §5.3]` `[11]` `C:high` `V:durable`

**Private memory management (`TDH.MEM.*`)**

- **Claim.** `TDH.MEM.SEPT.ADD` (leaf 3) adds and maps a 4KB Secure EPT page; `TDH.MEM.SEPT.REMOVE` (30) removes one; `TDH.MEM.SEPT.RD` (25) reads a Secure EPT entry, which the VMM cannot read directly.  `[TDX-ABI §5.4.36]` `[TDX-ABI §5.4.38]` `[TDX-ABI §5.4.37]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.PAGE.ADD` (leaf 2) adds a 4KB private page during TD build time and contributes to MRTD; `TDH.MEM.PAGE.AUG` (6) dynamically adds a 4KB or 2MB private page to an already-initialized TD in the PENDING state and is *not* measured.  `[TDX-ABI §5.4.23]` `[TDX-ABI §5.4.24]` `[TDX-BASE §9.9]` `[TDX-BASE §9.10]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.PAGE.REMOVE` (leaf 29) removes a private page from a guest TD; `TDH.MEM.PAGE.RELOCATE` (5) relocates a mapped 4KB page from one HPA to another.  `[TDX-ABI §5.4.28]` `[TDX-ABI §5.4.27]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.PAGE.DEMOTE` (leaf 15) splits a 2MB or 1GB private mapping into 512 4KB or 2MB mappings; `TDH.MEM.PAGE.PROMOTE` (23) merges 512 consecutive 4KB or 2MB mappings into one 2MB or 1GB mapping.  `[TDX-ABI §5.4.25]` `[TDX-ABI §5.4.26]` `[TDX-BASE §9.13]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.RANGE.BLOCK` (leaf 7) blocks a TD private GPA range against creation of new translations; `TDH.MEM.RANGE.UNBLOCK` (39) removes the block.  `[TDX-ABI §5.4.29]` `[TDX-ABI §5.4.30]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.TRACK` (leaf 38) increments the TD's TLB-tracking epoch counter and is the second step of the TLB-tracking protocol (§13.8.5).  `[TDX-ABI §5.4.40]` `[TDX-BASE §9.7]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.RD` (12) and `TDH.MEM.WR` (14) read and write the private memory of a *debuggable* guest TD only.  `[TDX-ABI §5.4.31]` `[TDX-ABI §5.4.41]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`

**Measurement, service TDs, interrupts, migration and scan**

- **Claim.** `TDH.MR.EXTEND` (leaf 16) extends the TD's build-time measurement register during TD build; `TDH.MR.FINALIZE` (17) finalizes it, after which further `TDH.MEM.PAGE.ADD` or `TDH.MR.EXTEND` calls fail.  `[TDX-ABI §5.4.54]` `[TDX-ABI §5.4.55]` `[TDX-BASE §12.2.1]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.SERVTD.BIND` (leaf 48) binds a service TD to a target TD and returns a binding handle; `TDH.SERVTD.PREBIND` (49) pre-binds one before the target TD is finalized; `TDH.SERVTD.REBIND` rebinds an existing binding.  `[TDX-ABI §5.4.62]` `[TDX-ABI §5.4.64]` `[TDX-ABI §5.4.63]` `[TDX-BASE §13.2]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDH.INTR.CONFIG` (leaf 62) allocates and initializes interrupt-related TD-scope metadata for one specific L1 or L2 VM within a TD.  `[TDX-ABI §5.4.22]` `[12]` `C:medium` `V:durable`
- **Claim.** Migration leaves occupy the ranges 64–75 (`TDH.EXPORT.*`, within which 67 is unassigned and 69 is `TDH.SYS.DISABLE`) and 80–87 (`TDH.IMPORT.*`, contiguous and exclusive), with `TDH.MIG.SETUP`, `TDH.MIG.SETUP.ABORT` and `TDH.MIG.STREAM.CREATE` defined alongside them; their semantics are specified in the TD Migration documents rather than in the base ABI text.  `[TDX-ABI §5.4.1]` `[TDX-ABI §5.4.2]` `[12]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.SCAN.RANGE` (92), `TDH.MEM.SCAN.COMP` (93), `TDH.MEM.SCAN.CONFIG` (94) and `TDH.MEM.SCAN.RESET` (95) form a memory-scan family, leaves 96 and 97 are `TDH.MIG.STREAM.CREATE` and `TDH.SERVTD.REBIND`, and the **TDX Connect** leaves begin at **128** with `TDH.IOMMU.SETUP` — `TDH.TDI.*` occupy 136–141 and 164–166, `TDH.MMIO.*` 154–160.  `[TDX-ABI §5.4]` `[12]` `C:medium` `V:durable`

---

## 13.6 Guest-side interface: the TDCALL `TDG.*` leaves

- **Claim.** For TDCALL, RAX bits 15:0 select the leaf number, bits 23:16 select the interface-function version, and bits 63:24 are reserved and must be 0; the TDX Module allows TDCALL only in 64-bit mode.  `[TDX-ABI §5.5.1]` `[12]` `C:high` `V:durable`
- **Claim.** The only TDCALL-level completion status codes defined in common are TDX_SUCCESS and TDX_OPERAND_INVALID (invalid leaf number); everything else is leaf-specific.  `[TDX-ABI §5.5.1]` `[12]` `C:high` `V:durable`

**VCPU scope and host communication**

- **Claim.** `TDG.VP.VMCALL` (leaf 0) calls a host VM service and carries all of the GHCI sub-function surface (§13.11); GHCI also normatively covers `TDG.VP.VEINFO.GET`, which is how a TD reads the #VE that prompted the call.  `[TDX-ABI §5.5.26]` `[TDX-BASE §2.11]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.VP.INFO` (leaf 1) returns the TD execution-environment information a TD needs to bootstrap, including GPAW and ATTRIBUTES.  `[TDX-ABI §5.5.21]` `[TDX-ABI §3.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VEINFO.GET` (leaf 3) retrieves the virtualization-exception information for the most recent #VE; the VE_INFO area itself lives in TDVPS and is not directly accessible to the TD.  `[TDX-ABI §5.5.25]` `[TDX-BASE §11.14.1]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.VP.CPUIDVE.SET` (leaf 5) lets the TD control whether CPUID execution delivers #VE.  `[TDX-ABI §5.5.19]` `[12]` `C:high` `V:durable`
- **Claim.** `TDG.VP.RD` (9) and `TDG.VP.WR` (10) read and write VCPU-scope metadata from inside the TD.  `[TDX-ABI §5.5.24]` `[TDX-ABI §5.5.27]` `[12]` `C:high` `V:durable`
- **Claim.** `TDG.VP.ENTER` (25), `TDG.VP.INVEPT` (26) and `TDG.VP.INVGLA` (27) exist for TD Partitioning: they enter an L2 VCPU and invalidate cached L2 EPT translations or cached translations for selected pages in an L2 VM.  `[TDX-ABI §5.5.20]` `[TDX-ABI §5.5.22]` `[TDX-ABI §5.5.23]` `[12]` `C:high` `V:durable`

**Memory**

- **Claim.** `TDG.MEM.PAGE.ACCEPT` (leaf 6) accepts a pending private page into the TD, zeroing its content as part of the operation.  `[TDX-ABI §5.5.3]` `[TDX-BASE §9.10]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.MEM.PAGE.ATTR.RD` (23) reads the GPA mapping and attributes of a TD private page and `TDG.MEM.PAGE.ATTR.WR` (24) writes the attributes; these are the L2 page-alias management primitives used under TD Partitioning.  `[TDX-ABI §5.5.4]` `[TDX-ABI §5.5.5]` `[TDX-PART §21.2]` `[12][20]` `C:high` `V:durable`
- **Claim.** `TDG.MEM.PAGE.RELEASE` (leaf 30) lets the guest TD release a private page so the host VMM can remove it, and is gated by CONFIG_FLAGS.PAGE_RELEASE.  `[TDX-ABI §5.5.6]` `[TDX-BASE §9.12]` `[12][11]` `C:high` `V:durable`

**Measurement and attestation**

- **Claim.** `TDG.MR.REPORT` (leaf 4) creates a cryptographic report of the TD — a TDREPORT_STRUCT.  `[TDX-ABI §5.5.9]` `[12]` `C:high` `V:durable`
- **Claim.** `TDG.MR.RTMR.EXTEND` (leaf 2) extends a run-time measurement register.  `[TDX-ABI §5.5.10]` `[TDX-BASE §12.2.2]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.MR.VERIFYREPORT` (leaf 22) verifies a TD report generated on the current platform, enabling local (TD-to-TD) attestation without going out to a Quoting Enclave.  `[TDX-ABI §5.5.11]` `[TDX-BASE §12.5]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.MR.ASSIGNSVNS` (28) assigns dynamic SVN values given TDSIGSTRUCTs and reference measurements, and `TDG.MR.KEY.GET` (29) derives a persistent key customized to the TD's measurements and policy; both are feature-gated — `TDG.MR.ASSIGNSVNS` by TDX_FEATURES0.TD_SIGNING_AND_SVN (bit 22).  `[TDX-ABI §5.5.7]` `[TDX-ABI §5.5.8]` `[TDX-BASE §12.3]` `[12][11]` `C:medium` `V:durable`

**Metadata and service TDs**

- **Claim.** `TDG.VM.RD` (leaf 7) and `TDG.VM.WR` (leaf 8) read and write a TD-scope metadata field from inside the TD; `TDG.SYS.RD` (11) and `TDG.SYS.RDALL` (12) read guest-readable TDX Module global-scope metadata.  `[TDX-ABI §5.5.17]` `[TDX-ABI §5.5.18]` `[TDX-ABI §5.5.15]` `[TDX-ABI §5.5.16]` `[12]` `C:high` `V:durable`
- **Claim.** `TDG.SERVTD.RD` (18) and `TDG.SERVTD.WR` (20) let a bound service TD read and write target-TD metadata, and `TDG.SERVTD.REBIND.APPROVE` (33) approves rebinding a new service TD instance.  `[TDX-ABI §5.5.12]` `[TDX-ABI §5.5.14]` `[TDX-ABI §5.5.13]` `[TDX-BASE §13.4]` `[12][11]` `C:high` `V:durable`
- **Claim.** `TDG.INTR.POST` (leaf 32) posts a virtual interrupt to an arbitrary VCPU of an L2 VM; the ABI specification marks it as an unreleased Enhanced Interrupt Virtualization preview.  `[TDX-ABI §5.5.2]` `[12]` `C:medium` `V:durable`
- **Claim.** Guest-side leaves 64 and above belong to TDX Connect — `TDG.SPDM.TPA.SET`/`GET` (64/65), `TDG.TDI.VALIDATE` (66), `TDG.TDI.RD` (67), `TDG.TDI.REQUEST` (68), `TDG.DMAR.ACCEPT` (70), `TDG.TDI.MMIO.ACCEPT` (71), `TDG.IQ.INV.REQUEST` (72), `TDG.DMAR.RELEASE` (73) and `TDG.IQ.INV.STATUS` (74).  `[TDX-ABI §5.5.1]` `[12]` `C:medium` `V:durable`

---

## 13.7 TD life cycle and the legal call ordering

TDX enforces two nested state machines. The outer one is the TD Life Cycle state machine, driven by key management; the inner one, OP_STATE, sub-divides the state in which a TD spends nearly all of its life.

### 13.7.1 TD Life Cycle state machine

- **Claim.** The TD Life Cycle states are TD_HKID_ASSIGNED (TD private key not yet configured), TD_KEYS_CONFIGURED (TD private key configured), TD_BLOCKED (private memory access blocked, caches being flushed) and TD_TEARDOWN (TD has no HKID).  `[TDX-BASE §7.1]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.CREATE` enters TD_HKID_ASSIGNED; `TDH.MNG.KEY.CONFIG` on non-last packages keeps the TD there, and `TDH.MNG.KEY.CONFIG` on the last package advances it to TD_KEYS_CONFIGURED.  `[TDX-BASE §7.1]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.VPFLUSHDONE`, permitted only when the TD has no associated VCPUs and no bound TDIs, moves the TD from TD_KEYS_CONFIGURED to TD_BLOCKED; `TDH.MNG.KEY.FREEID` then moves it to TD_TEARDOWN.  `[TDX-BASE §7.1]` `[11]` `C:high` `V:durable`
- **Claim.** In TD_TEARDOWN, `TDH.PHYMEM.PAGE.RECLAIM` on non-TDR pages reclaims them, and `TDH.PHYMEM.PAGE.RECLAIM` on the TDR page destroys the TD.  `[TDX-BASE §7.1]` `[11]` `C:high` `V:durable`

### 13.7.2 OP_STATE — the secondary state machine

- **Claim.** OP_STATE sub-divides TD_KEYS_CONFIGURED; the baseline states are UNALLOCATED, UNINITIALIZED, INITIALIZED and RUNNABLE, and the remaining states exist only to support TD migration.  `[TDX-BASE §7.2]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MNG.KEY.CONFIG` on the last package leaves the TD in UNALLOCATED; `TDH.MNG.ADDCX` on the last required TDCX page advances it to UNINITIALIZED; `TDH.MNG.INIT` advances it to INITIALIZED; `TDH.MR.FINALIZE` advances it to RUNNABLE.  `[TDX-BASE §7.2]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.VP.CREATE`, `TDH.VP.ADDCX` and `TDH.VP.INIT` are legal only in the INITIALIZED state — VCPU creation and initialization are allowed only during TD build time.  `[TDX-BASE §7.2]` `[TDX-BASE §7.4]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.*` and `TDH.MR.EXTEND` are self-transitions of INITIALIZED, and `TDH.MEM.*` is also a self-transition of RUNNABLE. The migration states are **not** all entered from RUNNABLE: on the export side RUNNABLE → (`TDH.EXPORT.STATE.IMMUTABLE`) → START_EXPORT → LIVE_EXPORT → (`TDH.EXPORT.PAUSE`) → PAUSED_EXPORT → POST_EXPORT, but the *import* chain begins at **UNINITIALIZED** — (`TDH.IMPORT.STATE.IMMUTABLE`) → START_IMPORT / MEMORY_IMPORT → STATE_IMPORT → POST_IMPORT → LIVE_IMPORT — and only rejoins RUNNABLE through `TDH.IMPORT.END`.  `[TDX-BASE §7.2]` `[11]` `C:high` `V:durable`
- **Claim.** The only OP_STATE values in which a TD VCPU may run are RUNNABLE, LIVE_EXPORT and LIVE_IMPORT; this is the condition under which TLB tracking becomes mandatory.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`

### 13.7.3 Build → measure → finalize

The legal ordering for building a TD, in the module's own words:

- **Claim.** The typical TD creation sequence is: flush any MODIFIED cache lines for the pages about to become TDR, TDCS and the Secure EPT root; `TDH.MNG.CREATE` with the TDR page PA; assign an HKID and configure the TD ephemeral key on all packages; `TDH.MNG.ADDCX` repeatedly for the TDCX pages; `TDH.MNG.INIT` with the TD initialization parameters.  `[TDX-BASE §7.3]` `[11]` `C:high` `V:durable`
- **Claim.** The typical VCPU creation sequence is: flush MODIFIED cache lines for the TDVPR and TDCX pages; `TDH.VP.CREATE` with the TDVPR page PA and owner TDR PA; `TDH.VP.ADDCX` repeatedly; `TDH.VP.INIT` with the TDVPR PA and a VMM-provided identifier; optionally `TDH.VP.WR` for the permitted TD VMCS controls.  `[TDX-BASE §7.4]` `[11]` `C:high` `V:durable`
- **Claim.** A four-level Secure EPT is built by calling `TDH.MEM.SEPT.ADD` once per level below the root, with the target GPA and the EPT level as inputs; the root page (EPML4 or EPML5) is not added explicitly because `TDH.MNG.INIT` creates it inside TDCS.  `[TDX-BASE §9.8]` `[11]` `C:high` `V:durable`
- **Claim.** Measurement is initialized by `TDH.MNG.INIT`, extended with page properties by every `TDH.MEM.PAGE.ADD`, extended with page *contents* in 256-byte chunks by `TDH.MR.EXTEND`, and completed by `TDH.MR.FINALIZE`.  `[TDX-BASE §12.2.1]` `[11]` `C:high` `V:durable`

### 13.7.4 Teardown

- **Claim.** The typical TD teardown sequence is: reclaim the HKID and flush TLB and cache per the key-reclamation sequence; `TDH.PHYMEM.PAGE.RECLAIM` repeatedly for all TD private and control-structure pages, marking them PT_NDA; `TDH.PHYMEM.PAGE.RECLAIM` on the TDR page; `TDH.PHYMEM.PAGE.WBINVD` on the TDR page to flush its MODIFIED cache lines.  `[TDX-BASE §7.5]` `[11]` `C:high` `V:durable`
- **Claim.** The TDR page must be reclaimed last, because all other TD pages' cache lines must already have been flushed before the TDR page is reclaimed.  `[TDX-BASE §7.5]` `[11]` `C:high` `V:durable`

---

## 13.8 Secure EPT and private memory management

### 13.8.1 The private/shared GPA split and where the SHARED bit sits

- **Claim.** TDX ISA introduces private versus shared GPAs distinguished by a SHARED bit in the guest-physical address; in SEAM non-root mode the controlling VMCS carries two EPT pointers — the legacy EPT pointer translates GPAs with SHARED == 0 via the Secure EPT, and a new Shared EPT pointer translates GPAs with SHARED == 1.  `[TDX-BASE §9.1]` `[11]` `C:high` `V:durable`
- **Claim.** A GPAW VM-execution control determines the position of the SHARED bit in the GPA, and a separate HKID execution control defines the HKID used for private accesses.  `[TDX-BASE §9.1]` `[TDX-ISA §3.2]` `[11][14]` `C:high` `V:durable`
- **Claim.** GPAW is the effective GPA width in bits for the TD; the SHARED bit is at GPA bit GPAW-1, and only GPAW values of 48 and 52 are possible — so the shared bit is bit 47 or bit 51, and GPAW 52 may be selected only with 5-level EPT.  `[TDX-BASE §11.3.2]` `[TDX-ABI §3.4.3]` `[TDX-ISA §3.2]` `[11][12][14]` `C:high` `V:durable`
- **Claim.** GPAW is distinct from MAXPA and from TDCS.VIRT_MAXPA; VIRT_MAXPA must not exceed the TD's configured GPAW.  `[TDX-BASE §11.15.1]` `[11]` `C:high` `V:durable`
- **Claim.** The TDX Module maintains exactly one Secure EPT structure per TD; Secure EPT pages reside in ordinary memory, are encrypted and integrity-protected with the TD's ephemeral private key, and are never mapped into the TD's GPA space, so no software other than the module and no device can read them.  `[TDX-BASE §9.1]` `[11]` `C:high` `V:durable`
- **Claim.** Any access to a Secure EPT page using a shared HKID can corrupt it and trigger an integrity-check failure leading to a machine-check fault.  `[TDX-BASE §9.1]` `[11]` `C:high` `V:durable`
- **Claim.** The Shared EPT resides in host VMM memory, uses a shared HKID, and is managed directly by the host VMM exactly as with legacy VMX; the EPT level is the same for Secure and Shared EPT.  `[TDX-BASE §9.1]` `[TDX-BASE §11.15]` `[11]` `C:high` `V:durable`
- **Claim.** At the end of a private translation the CPU sets the HKID bits of the resulting HPA to the TD's assigned private HKID.  `[TDX-BASE §2.4.2]` `[11]` `C:high` `V:durable`

### 13.8.2 Secure EPT entry states

- **Claim.** From the CPU's perspective Secure EPT has the same structure as a legacy VMX EPT; the TDX Module additionally encodes a state value in each Secure EPT entry using multiple bits, and the entry is opaque to the host VMM, which must read it through `TDH.MEM.SEPT.RD`.  `[TDX-BASE §9.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** The Base specification's Table 9.1 enumerates twenty L1 Secure EPT entry states, in this order: FREE, REMOVED, NL_MAPPED, NL_BLOCKED, MAPPED, BLOCKED, BLOCKEDW, EXPORTED_BLOCKEDW, EXPORTED_DIRTY, EXPORTED_DIRTY_BLOCKEDW, PENDING, PENDING_BLOCKED, PENDING_BLOCKEDW, PENDING_EXPORTED_BLOCKEDW, PENDING_EXPORTED_DIRTY, PENDING_EXPORTED_DIRTY_BLOCKEDW, REMOVE_IN_PROGRESS, MMIO_MAPPED, MMIO_BLOCKED and MMIO_PENDING; some are applicable only when the corresponding module feature is supported. The ABI specification's own L1 state encoding is longer — it adds EXPORTED, EXPORTED_MODIFIED, EXPORTED_BLOCKED, EXPORTED_REMOVED, EXPORTED_REMOVE_IN_PROGRESS, PENDING_EXPORTED, PENDING_EXPORTED_MODIFIED and PENDING_EXPORTED_BLOCKED, all gated on the migration features — so this list is the Base spec's, not the whole encoding space.  `[TDX-BASE §9.2.1]` `[TDX-ABI §3.6.2]` `[11][12]` `C:high` `V:durable`
- **Claim.** FREE means the entry maps no GPA range; NL_MAPPED and NL_BLOCKED are the non-leaf equivalents of MAPPED and BLOCKED; REMOVE_IN_PROGRESS means an interrupted `TDH.MEM.PAGE.REMOVE`; the MMIO_* states exist for TDX Connect private MMIO pages.  `[TDX-BASE §9.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** BLOCKED means the page is still mapped but new address translations to it are blocked; BLOCKEDW means only write translations are blocked. The `*BLOCKEDW`, `EXPORTED_*` and `PENDING_EXPORTED_*` states exist for TD migration and their full state diagrams are in the TD Migration specification.  `[TDX-BASE §9.2.1]` `[TDX-BASE §9.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** In the leaf state diagram, `TDH.MEM.PAGE.ADD` creates a MAPPED entry and increments MEM_COUNT; `TDH.MEM.RANGE.BLOCK` moves MAPPED to BLOCKED and increments BLOCKED_COUNT; `TDH.MEM.RANGE.UNBLOCK` and `TDH.MEM.PAGE.RELOCATE` decrement BLOCKED_COUNT.  `[TDX-BASE §9.2.2]` `[11]` `C:high` `V:durable`

### 13.8.3 Page acceptance, and why an unaccepted page faults

- **Claim.** Dynamically adding a TD private page after TD initialization is a three-step process: the VMM extends Secure EPT with `TDH.MEM.SEPT.ADD` if needed; the VMM adds and maps a 4KB or 2MB page with `TDH.MEM.PAGE.AUG`, leaving the SEPT entry PENDING and the page unmeasured; the guest TD accepts it with `TDG.MEM.PAGE.ACCEPT`, which zeroes the content.  `[TDX-BASE §9.10.1]` `[11]` `C:high` `V:durable`
- **Claim.** The acceptance requirement exists to defeat an attack in which the host VMM removes arbitrary pages from a TD's GPA space with `TDH.MEM.PAGE.REMOVE` and replaces them with zeroed pages; a guest TD must therefore track its own GPA allocation and must never accept a page it already knows to be TD-owned.  `[TDX-BASE §9.10.1]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.PAGE.AUG` does not need to access the destination page itself; the page is initialized later by `TDG.MEM.PAGE.ACCEPT`.  `[TDX-BASE §9.10.2]` `[11]` `C:high` `V:durable`
- **Claim.** `TDH.MEM.PAGE.AUG` performs a Secure EPT walk and aborts if the mapping already exists, which prevents re-mapping of an already-mapped GPA; it then sets the leaf entry to PENDING and writes the PAMT entry with PT_REG and the TDR PA as OWNER.  `[TDX-BASE §9.10.2]` `[11]` `C:high` `V:durable`
- **Claim.** A guest TD access to a page whose SEPT entry is PENDING (or PENDING_EXPORTED_DIRTY) results in either a #VE or a TD exit, selected by ATTRIBUTES.SEPT_VE_DISABLE in TD_PARAMS, by CONFIG_FLAGS.FLEXIBLE_PENDING_VE, and — when flexible — by the guest's own TDCS.TD_CTLS.PENDING_VE_DISABLE.  `[TDX-BASE §9.10.4]` `[11]` `C:high` `V:durable`
- **Claim.** Availability of CONFIG_FLAGS.FLEXIBLE_PENDING_VE and TDCS.TD_CTLS.PENDING_VE_DISABLE is enumerated by TDX_FEATURES0.PENDING_EPT_VIOLATION_V2 (bit 16), readable through `TDH.SYS.RD*`.  `[TDX-BASE §9.10.4]` `[11]` `C:high` `V:durable`
- **Claim.** The #VE behaviour supports an accept-on-demand guest policy; the TD-exit behaviour suits guests that map only already-accepted memory, for which touching a PENDING page is a fatal error and the host VMM normally tears the TD down.  `[TDX-BASE §9.10.4]` `[11]` `C:high` `V:durable`
- **Claim.** Under TD Partitioning, an L2 VM access to a PENDING page always results in an L2→L1 exit rather than a #VE or a TD exit.  `[TDX-BASE §9.10.4]` `[11]` `C:high` `V:durable`
- **Claim.** If `TDG.MEM.PAGE.ACCEPT`'s Secure EPT walk terminates on a free-equivalent entry (FREE, REMOVED or EXPORTED_REMOVED) at the requested level, the module performs a TD exit with an EPT violation carrying the error entry level and state plus the guest-requested accept level — which the host VMM may treat as the guest asking it to add the page.  `[TDX-BASE §9.10.3]` `[11]` `C:high` `V:durable`
- **Claim.** If the walk terminates on a guest-accessible leaf at a level *higher* than requested (for example a present 2MB PTE for a 4KB accept), `TDG.MEM.PAGE.ACCEPT` returns success with a warning that the page is already present and mapped at a larger size.  `[TDX-BASE §9.10.3]` `[11]` `C:high` `V:durable`

### 13.8.4 TD exit on EPT violation

- **Claim.** A guest TD access to a non-present private GPA — meaning no Secure EPT entry exists, or the entry is not in the MAPPED state — causes in most cases an asynchronous TD exit with an EPT-violation exit reason.  `[TDX-BASE §9.4]` `[11]` `C:high` `V:durable`
- **Claim.** On an EPT-violation TD exit only Exit Qualification bits 6:0 are provided to the host VMM; the remaining bits are withheld to avoid leaking TD secrets. See `05-vm-exit.md` for the architectural definition of the field.  `[TDX-BASE §9.4]` `[11]` `C:high` `V:durable`
- **Claim.** An unallocated page and a blocked page are both indicated by Exit Qualification bits 6:3 == 0 with Extended Exit Qualification TYPE (bits 3:0) == NULL (0); the host VMM must use its own bookkeeping to tell them apart and respond with `TDH.MEM.PAGE.AUG` or with a plain re-entry.  `[TDX-BASE §9.4]` `[11]` `C:high` `V:durable`
- **Claim.** An access to a PENDING page that is configured to TD-exit rather than #VE is indicated by Extended Exit Qualification TYPE == PENDING_EPT_VIOLATION (6).  `[TDX-BASE §9.4]` `[11]` `C:high` `V:durable`
- **Claim.** A write to a page blocked for writing is indicated by Exit Qualification bit 1 == 1 (write access) together with bit 4 == 0, and is resolved by `TDH.EXPORT.UNBLOCKW`.  `[TDX-BASE §9.4]` `[11]` `C:high` `V:durable`

### 13.8.5 TLB tracking and `TDH.MEM.TRACK`

- **Claim.** TLB tracking exists to prove that no logical processor holds a cached Secure EPT translation for a given TD private GPA range; it is required before removing a mapped private page or changing a mapping size.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** "Cached address translation" for TLB-tracking purposes includes TLB entries, cached paging-structure entries, and GPAs that the module has translated to HPAs and written into VMX control-structure fields for the CPU to read.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** The GPA-range TLB-tracking sequence is: (1) `TDH.MEM.RANGE.BLOCK` on each GPA range, which blocks creation of new translations but leaves existing cached ones valid; (2) `TDH.MEM.TRACK`, which advances the TD's epoch counter; (3) an IPI to each remote logical processor running one of the TD's VCPUs; (4) each such LP TD-exits on receipt of the IPI; (5) the VMM treats the exit as spurious and re-enters the TD.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** A GPA range is considered tracked once every one of the TD's VCPUs has been inactive at least once after `TDH.MEM.TRACK`; the subsequent TD entry on each VCPU flushes any stale entries. If the VMM knows the active-VCPU count is zero after `TDH.MEM.TRACK`, it may skip the IPIs.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** TLB tracking is not required when the TD's OP_STATE implies no VCPU can run, nor for SEPT entries whose state implies no cached translation can exist — EXPORTED_BLOCKEDW, PENDING_EXPORTED_BLOCKEDW, FREE and REMOVED.  `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** BEPOCH in the leaf PAMT entry records TDCS.TD_EPOCH at the moment the private page or SEPT page was blocked, and is meaningful only when PT is PT_REG, PT_EPT or PT_PR.  `[TDX-BASE §8.3.1]` `[11]` `C:high` `V:durable`

---

## 13.9 The TD VCPU: transitions, activity state, ASID and LP association

- **Claim.** TDVPS.VCPU_STATE holds the VCPU activity state, whose values are VCPU_UNINITIALIZED (not yet initialized by `TDH.VP.INIT`), VCPU_IMPORT (state incompletely imported), VCPU_READY, VCPU_ACTIVE (executing in logical TDX non-root mode on some LP) and VCPU_DISABLED (being torn down).  `[TDX-BASE §10.1.3]` `[11]` `C:high` `V:durable`
- **Claim.** TD entry and TD exit normally toggle a VCPU between VCPU_READY and VCPU_ACTIVE; a non-recoverable TD exit due to a triple fault instead transitions the VCPU to VCPU_DISABLED.  `[TDX-BASE §10.1.3]` `[11]` `C:high` `V:durable`
- **Claim.** The activity state machine enforces that a VCPU may be entered only when its TDVPS pages are resident and have been initialized by `TDH.VP.INIT` or successfully imported by `TDH.IMPORT.STATE.VP`, and only when its state is consistent — that is, no non-recoverable TD exit has occurred.  `[TDX-BASE §10.1.3]` `[11]` `C:high` `V:durable`
- **Claim.** For a partitioned TD a VCPU counts as VCPU_ACTIVE whether it is executing in the L1 VM or in one of the L2 VMs.  `[TDX-BASE §10.1.3]` `[11]` `C:high` `V:durable`
- **Claim.** The TD ASID is composed of an implicit SEAM bit (1 bit, acting as bit 16 of VPID, set by the CPU in SEAM mode so TD ASIDs cannot collide with legacy ASIDs), a 16-bit VPID assigned per TD (or per VM in a partitioned TD), 40 bits taken from EPTP bits 51:12 with the HKID bits cleared, and the 16-bit legacy PCID.  `[TDX-BASE §10.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** All VCPUs of the same TD share one ASID, so whenever `TDH.VP.ENTER` runs on an LP with a different VCPU than the one that last executed there, the TDX Module flushes that TD's cached TLB translations with `INVEPT`.  `[TDX-BASE §10.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** Because the ASID component is the TD's Secure EPTP, the host VMM must flush *Shared* EPT translations by executing `INVEPT` with the TD's EPTP — not its Shared EPTP — obtaining the value from the TD VMCS through `TDH.VP.RD`; for a partitioned TD the same applies per L2 VM using that VM's EPTP.  `[TDX-BASE §10.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** Shared EPT flushing is not enforced by the TDX Module; alternatively the host VMM may use the same `TDH.MEM.TRACK`-plus-IPI protocol it uses for Secure EPT.  `[TDX-BASE §10.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** Some TD VCPU state is non-coherently cached — address translations, and the TD VMCS, which VMX requires to be made current with `VMPTRLD` and written back and made non-current with `VMCLEAR` before its memory image may be handled on another LP; this is why VCPU-to-LP association must be managed explicitly with `TDH.VP.FLUSH` and `TDH.MNG.VPFLUSHDONE`.  `[TDX-BASE §10.3.1]` `[TDX-BASE §10.3.2]` `[TDX-BASE §5.6.3]` `[11]` `C:high` `V:durable`

---

## 13.10 CPU virtualization inside a TD

TDX splits CPU behaviour into three buckets: features virtualized architecturally as in ordinary VMX non-root operation, features paravirtualized through #VE and `TDG.VP.VMCALL`, and features blocked outright.

- **Claim.** The TDX Module blocks certain instructions in TDX non-root mode; execution causes a VM exit to the module, which then injects #UD, #GP(0), or — where no Intel 64 architectural exception fits — #VE.  `[TDX-BASE §11.7]` `[11]` `C:high` `V:durable`
- **Claim.** Instructions that unconditionally cause #UD in a TD are ENCLS, ENCLV, RSM, GETSEC, SEAMCALL, SEAMRET, and most VMX instructions — INVEPT, INVVPID, VMCLEAR, VMFUNC, VMLAUNCH, VMPTRLD, VMPTRST, VMREAD, VMRESUME, VMWRITE, VMXOFF and VMXON.  `[TDX-BASE §11.7.1]` `[11]` `C:high` `V:durable`
- **Claim.** Instructions that unconditionally cause #VE(NON_CONFIG_PARAVIRT) so the guest can paravirtualize them are IN, OUT, the string I/O forms (INS*, OUTS*), HLT, WBINVD, WBNOINVD, INVD and VMCALL; the specification's reason is that x86 provides no standard way to enumerate these as unsupported.  `[TDX-BASE §11.7.1]` `[11]` `C:high` `V:durable`
- **Claim.** WBNOINVD causes #VE regardless of the value of virtual CPUID(0x80000008).EBX[9], even though that bit is host-configurable — TDX never allows a guest TD to execute it.  `[TDX-BASE §11.7.1]` `[11]` `C:high` `V:durable`
- **Claim.** Guest TD execution of ENQCMD results in #GP(0); ENQCMDS results in #UD at CPL 0 and #GP(0) otherwise.  `[TDX-BASE §11.7.1]` `[11]` `C:high` `V:durable`
- **Claim.** PCONFIG causes #UD or #VE depending on feature enabling, again to permit paravirtualization.  `[TDX-BASE §11.7.1]` `[11]` `C:high` `V:durable`
- **Claim.** Beyond outright blocking, CPUID causes #VE when the leaf and sub-leaf are not virtualized by the module, and RDMSR/WRMSR cause #GP(0) when an MSR is virtualized as non-existent or #VE when an MSR is not virtualized at all.  `[TDX-BASE §11.7.3]` `[11]` `C:high` `V:durable`
- **Claim.** CPU-feature availability inside the TD is configured by the host VMM in TD_PARAMS and constrained by the module: ATTRIBUTES selects TD attributes such as debuggability, and XFAM selects the extended-state features the TD may use.  `[TDX-BASE §11.2.1]` `[TDX-ABI §3.4.1]` `[TDX-ABI §3.4.2]` `[11][12]` `C:high` `V:durable`
- **Claim.** The base specification treats CPUID virtualization, MSR virtualization, platform-topology virtualization and TSC virtualization as distinct configurable surfaces, each with a host-VMM configuration step and, in several cases, a guest-TD control step; interrupt handling and APIC virtualization is named as a surface but its whole section is a one-line deferral to a separate Interrupt Virtualization specification.  `[TDX-BASE §11.10]` `[TDX-BASE §11.11]` `[TDX-BASE §11.12]` `[TDX-BASE §11.13]` `[TDX-BASE §11.17]` `[11]` `C:high` `V:durable`

### 13.10.1 #VE inside a TD

- **Claim.** The TDX Module extends the VMX definition of #VE and injects it into the guest TD wherever an operation is not allowed under TDX but no architectural exception such as #GP(0) applies — disallowed instructions, disallowed MSR accesses, many CPUID leaves.  `[TDX-BASE §11.14]` `[11]` `C:high` `V:durable`
- **Claim.** The virtualization-exception information area (VE_INFO) is maintained inside TDVPS and is not directly accessible to the guest TD; it is read with `TDG.VP.VEINFO.GET`.  `[TDX-BASE §11.14.1]` `[11]` `C:high` `V:durable`
- **Claim.** VE_INFO fields are EXIT_REASON at offset 0 (4 bytes), VALID at offset 4 (4 bytes), EXIT_QUALIFICATION at offset 8 (8 bytes), GLA at offset 16 (8 bytes), GPA at offset 24 (8 bytes) and EPTP_INDEX at offset 32 (2 bytes), plus non-architectural instruction-length and instruction-information fields used when EXIT_REASON is not EPT violation.  `[TDX-BASE §11.14.1]` `[11]` `C:high` `V:durable`
- **Claim.** VE_INFO.VALID == 0 means the area holds no valid contents; neither the CPU nor the module will update VE_INFO while VALID is non-zero, and after writing the area they set VALID to 0xFFFFFFFF.  `[TDX-BASE §11.14.1]` `[11]` `C:high` `V:durable`
- **Claim.** The intended design is for a TDX-enlightened guest OS to install a #VE handler that emulates the requested operation on behalf of non-enlightened drivers and applications; the guest should avoid instructions that can themselves cause #VE inside the #VE handler.  `[TDX-BASE §11.14]` `[TDX-GHCI §2.3]` `[11][16]` `C:high` `V:durable`
- **Claim.** The module distinguishes architectural #VE injection due to EPT violations from non-architectural #VE that it injects itself, and it also defines #VE for x86 behaviour TDX does not support and for TDX-specific behaviour.  `[TDX-BASE §11.1.3]` `[TDX-BASE §11.1.4]` `[TDX-BASE §11.14.2]` `[TDX-BASE §11.14.3]` `[11]` `C:high` `V:durable`

---

## 13.11 GHCI: `TDG.VP.VMCALL` and paravirtualized I/O

GHCI specifies the *contents* of the conversation between a TD and its host VMM; the TDX Module only relays it. Everything in this section is untrusted by construction.

- **Claim.** `TDG.VP.VMCALL` is TDCALL leaf function 0 and is used to invoke services from the host VMM.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** On input, RAX holds the TDCALL leaf number (0), RCX holds a bitmap selecting which guest GPRs and XMM registers are passed through to the VMM and back, R10 selects the namespace (0 means the sub-function in R11 is defined by GHCI; any other R10 value means R10 and R11 are both vendor-specific), and R11 holds the sub-function number.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** On output, RAX always returns TDX_SUCCESS (0), RCX is unmodified, R10 carries the sub-function return value, and R11 and the other selected GPRs carry sub-function-specific results.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** GHCI explicitly forbids using RBP as a TDVMCALL input or output parameter and directs software to clear bit 5 (RBP) of the GPR mask in RCX, because RBP is conventionally a frame pointer.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** The XMM0–XMM15 registers are passed through in both directions when the corresponding RCX bit is set, and are otherwise preserved.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** The TDX paravirtualization sub-functions in R11 (when R10 == 0) are GetTdVmCallInfo (0x10000), MapGPA (0x10001), GetQuote (0x10002), ReportFatalError (0x10003), SetupEventNotifyInterrupt (0x10004) and Service (0x10005).  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** The instruction-execution sub-functions occupy the low sub-function space, in bits 15:0: Instruction.CPUID = 10, Instruction.HLT = 12, Instruction.IO = 30, Instruction.RDMSR = 31, Instruction.WRMSR = 32, #VE.RequestMMIO = 48, Instruction.WBINVD = 54, Instruction.PCONFIG = 65.  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** The TDVMCALL sub-function completion codes returned in R10 are TDG.VP.VMCALL_SUCCESS (0x0), TDG.VP.VMCALL_RETRY (0x1), TDG.VP.VMCALL_OPERAND_INVALID (0x8000000000000000), TDG.VP.VMCALL_GPA_INUSE (0x8000000000000001) and TDG.VP.VMCALL_ALIGN_ERROR (0x8000000000000002).  `[TDX-GHCI §2.4.1]` `[16]` `C:high` `V:durable`
- **Claim.** From the host VMM's perspective a `TDCALL[TDG.VP.VMCALL]` is a trap-like VM exit reported through the SEAMRET flow; the VMM services the request and resumes the TD with `SEAMCALL[TDH.VP.ENTER]`.  `[TDX-GHCI Ch.3]` `[16]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VMCALL<#VE.RequestMMIO>` passes the access size in R12 (1, 2, 4 or 8 bytes), the direction in R13 (0 = read, 1 = write), the MMIO address in R14 and the write data in R15; a read returns its data in R11.  `[TDX-GHCI §3.7]` `[16]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VMCALL<Instruction.IO>` passes the access size in R12 (1, 2 or 4 bytes only), the direction in R13, the port number in R14 and the write data in R15; a read returns its data in R11.  `[TDX-GHCI §3.9]` `[16]` `C:high` `V:durable`
- **Claim.** The VMM emulates MMIO in shared-GPA space and induces a #VE on those accesses by mapping the shared GPAs with the suppress-#VE bit cleared in the corresponding Shared EPT entries.  `[TDX-GHCI §3.7]` `[16]` `C:high` `V:durable`
- **Claim.** The prescribed guest flow for MMIO emulation is: take the #VE, call `TDCALL[TDG.VP.VEINFO.GET]`, validate that the #VE exit reason is 48 (EPT violation causing #VE), decode the faulting instruction locally, validate the accessed region and the source of the access, and only then issue `TDG.VP.VMCALL<#VE.RequestMMIO>`.  `[TDX-GHCI §3.7]` `[16]` `C:high` `V:durable`
- **Claim.** GHCI states that `TDG.VP.VMCALL` is by design an untrusted operation to be used for untrusted I/O, with any cryptographic protection of TD data supplied by the TD itself — which is why TD guests place DMA buffers in shared memory and bounce data through them.  `[TDX-GHCI §3.7]` `[TDX-BASE §14.2]` `[16][11]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VMCALL<MapGPA>` is the sub-function by which a TD converts memory between the private and shared halves of its GPA space, and is the basis of TD memory ballooning.  `[TDX-GHCI §3.2]` `[TDX-GHCI §5.2]` `[16]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VMCALL<GetQuote>` is the sub-function a TD uses to send a TDREPORT_STRUCT to the VMM and request its conversion into a Quote.  `[TDX-GHCI §3.3]` `[TDX-GHCI §5.4]` `[16]` `C:high` `V:durable`
- **Claim.** `TDG.VP.VMCALL<Instruction.HLT>` passes an Interrupt Blocked Flag in R12, which the TD clears when RFLAGS.IF == 1 or when the TDCALL immediately follows an STI, and sets otherwise.  `[TDX-GHCI §3.8]` `[16]` `C:high` `V:durable`

---

## 13.12 I/O models without TDX Connect

- **Claim.** TDX does not prescribe a single I/O convention; the common models are emulated devices, paravirtualized devices, SR-IOV devices and direct device assignment, and a TD provider may combine them.  `[TDX-BASE §14.1]` `[11]` `C:high` `V:durable`
- **Claim.** MMIO can be virtualized either by paravirtualized drivers that replace MMIO accesses with `TDG.VP.VMCALL` directly, or by non-paravirtualized drivers whose accesses fault to a #VE handler that decodes the instruction and then issues `TDG.VP.VMCALL`.  `[TDX-BASE §14.1]` `[TDX-BASE §14.3]` `[11]` `C:high` `V:durable`
- **Claim.** In both the paravirtualized and the #VE-based MMIO model, TD software must place every data buffer passed to or from a `TDG.VP.VMCALL`-invoked VMM function in the TD's shared memory space — which is the architectural reason TD guests use bounce buffers.  `[TDX-BASE §14.2]` `[TDX-BASE §14.3]` `[11]` `C:high` `V:durable`
- **Claim.** For directly assigned and SR-IOV devices without TDX Connect, the device's MMIO resources must be mapped in the TD's shared GPA space and DMA data buffers must live in shared memory, programmed into the IOMMU page tables.  `[TDX-BASE §14.4]` `[11]` `C:high` `V:durable`
- **Claim.** Only shared GPA memory may be mapped in the VT-d remapping tables; if a translation yields a physical address carrying a TD private KeyID, the IOMMU aborts the transaction and reports a DMA-remapping failure. See `10-vtd-dma-remapping.md` for the remapping structures themselves.  `[TDX-BASE §14.5]` `[11]` `C:high` `V:durable`
- **Claim.** If the GPA presented to the IOMMU is private (SHARED bit 0), the IOMMU may abort and report a DMA-remapping failure even when the translated physical address carries a non-private HKID; this is a deliberate debug aid against a TD or VMM programming a bad GPA into a device.  `[TDX-BASE §14.5]` `[11]` `C:high` `V:durable`
- **Claim.** Shared Virtual Memory should be avoided with TDs, because VT-d tables can only map shared memory.  `[TDX-BASE §14.6]` `[11]` `C:high` `V:durable`

---

## 13.13 Attestation

- **Claim.** TDCS.MRTD is a SHA-384 digest of the TD build process; control-structure pages (TDR, TDCX, TDVPR) and Secure EPT pages are not measured.  `[TDX-BASE §12.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** MRTD extension by GPA uses a 128-byte buffer containing the GPA and the leaf-function name, so that a page added at a given GPA by a given function is uniquely represented.  `[TDX-BASE §12.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** A TD loader may deliberately omit `TDH.MR.EXTEND` for a page whose initial contents the TD will overwrite, in which case only the page's GPA, not its data, enters MRTD.  `[TDX-BASE §12.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** Four RTMR registers are provided; the array is initialized to zero at build and extended at run time by the guest with `TDCALL(TDG.MR.RTMR.EXTEND)`.  `[TDX-BASE §12.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** RTMR extension follows TPM PCR semantics: after `TDG.MR.RTMR.EXTEND(index=i, value=x)`, RTMR[i] = SHA384(RTMR[i] || x).  `[TDX-BASE §12.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** The expected use of RTMRs is TPM emulation during guest-TD OS secure boot by the virtual BIOS.  `[TDX-BASE §12.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** Beyond MRTD and the RTMRs, the attested measurement set includes SERVTD_HASH and SERVTD_EXT_HASH, which measure bound service TDs.  `[TDX-BASE §12.2.3]` `[TDX-BASE §12.2.4]` `[11]` `C:high` `V:durable`

### 13.13.1 TDREPORT_STRUCT

- **Claim.** TDREPORT_STRUCT is the output of `TDG.MR.REPORT` and is composed of a generic MAC structure (REPORTMACSTRUCT), a TEE_TCB_INFO structure and a TDX-specific TDINFO_STRUCT.  `[TDX-ABI §3.9.2]` `[12]` `C:high` `V:durable`
- **Claim.** TDREPORT_STRUCT layout is REPORTMACSTRUCT at offset 0 (256 bytes), TEE_TCB_INFO at offset 256 (239 bytes), 17 reserved zero bytes at offset 495, and TDINFO at offset 512.  `[TDX-ABI §3.9.2]` `[12]` `C:high` `V:durable`
- **Claim.** TDREPORT_STRUCT size depends on REPORTMACSTRUCT.REPORTTYPE.VERSION: versions 0 and 1 are 1024 bytes and version 2, where supported, is 1280 bytes; TD software should size its buffer from MAX_TDREPORT_SIZE as enumerated by `TDG.SYS.RD`.  `[TDX-ABI §3.9.2]` `[12]` `C:high` `V:durable`
- **Claim.** REPORTMACSTRUCT is common to Intel's TEEs including SGX and TDX; it is MAC-protected and contains hashes of the rest of the report structure, including TEE_INFO_HASH over TDINFO_STRUCT and TEE_TCB_INFO_HASH over TEE_TCB_INFO.  `[TDX-ABI §3.9.5]` `[12]` `C:high` `V:durable`
- **Claim.** REPORTMACSTRUCT carries a 16-byte CPUSVN, a 48-byte TEE_TCB_INFO_HASH, a 48-byte TEE_INFO_HASH, 64 bytes of REPORTDATA and a 32-byte MAC; the MAC is an HMAC-SHA-256 computed over the first 224 bytes of the report using the CPU's report key held in CR_REPORT_MAC_KEY.  `[TDX-ISA Ch.6]` `[TDX-ISA Ch.7]` `[14]` `C:high` `V:durable`
- **Claim.** TEE_TCB_INFO is 239 bytes and is defined by the TDX architectural extensions specification; it carries VALID at offset 0, TEE_TCB_SVN at 8, MRSEAM at 24 — the SHA-384 measurement of the TDX Module that *created* the TD — and TEE_TCB_SVN2 at 128, the SVN of the module current at report time. MRSIGNERSEAM (offset 72) and TEE_TCB_INFO.ATTRIBUTES (offset 120) are set to all zeros and marked invalid for TDX, because the module is Intel-provided.  `[TDX-ABI §3.9.3]` `[TDX-ISA Ch.6]` `[12][14]` `C:high` `V:durable`
- **Claim.** TDINFO_STRUCT is the TDX-specific TEE_INFO part of TDREPORT_STRUCT; it holds the TD's measurements and the initial configuration locked at initialization plus the run-time-extendable RTMRs, and those values are copied out of TDCS by `TDG.MR.REPORT`.  `[TDX-ABI §3.9.7]` `[12]` `C:high` `V:durable`
- **Claim.** ATTRIBUTES is a 64-bit attested field supplied by the host VMM in TD_PARAMS, reported to the guest by `TDG.VP.INFO` and `TDG.VM.RD*` and included in TDREPORT_STRUCT — which is how a verifier learns whether the TD was created debuggable.  `[TDX-ABI §3.4.1]` `[12]` `C:high` `V:durable`
- **Claim.** XFAM is likewise a TD_PARAMS field reported to the guest by CPUID(0x0D, 0x01) and included in TDREPORT_STRUCT.  `[TDX-ABI §3.4.2]` `[12]` `C:high` `V:durable`
- **Claim.** For a TD that has been migrated, TEE_TCB_INFO.MRSEAM and TEE_TCB_INFO.TEE_TCB_SVN are those of the TDX Module on the *destination* platform at the time of destination-TD creation by `TDH.MNG.CREATE`, **before import** — not those of the module that built the TD on the source platform, and not those of the module current when the report is taken. Only TEE_TCB_SVN2 reflects the module current at `TDG.MR.REPORT` time, which is why the two SVNs can differ after a TD-preserving module update.  `[TDX-ABI §3.9.3]` `[TDX-BASE §12.7.1]` `[12][11]` `C:high` `V:durable`

### 13.13.2 From TDREPORT to Quote — and the SGX dependency

- **Claim.** Local verification uses the CPU: the module produces the MACed report via the SEAMOPS[SEAMREPORT] instruction, and a verifying TD checks it with `TDG.MR.VERIFYREPORT`, which is backed by SEAMOPS[SEAMVERIFYREPORT].  `[TDX-BASE §12.5]` `[TDX-ISA Ch.7]` `[11][14]` `C:high` `V:durable`
- **Claim.** Local report verification can legitimately fail if the CPU's MAC key changed between generation and verification — for example because both TDs were migrated, or because CPU microcode or the TDX Module was updated — and the prescribed recovery is to regenerate the report and retry, typically three to five times.  `[TDX-BASE §12.5.1]` `[11]` `C:high` `V:durable`
- **Claim.** To create a remotely verifiable attestation, TDREPORT_STRUCT must be converted into a Quote signed by a certified quote-signing key.  `[TDX-BASE §12.6.1]` `[11]` `C:high` `V:durable`
- **Claim.** On platforms that support Intel SGX, Quoting Enclaves produce TDX or SGX Quotes; the architecture allows separate Quoting Enclaves per provider and does not require the Quoting Enclave to run inside a TD.  `[TDX-BASE §12.6.2]` `[11]` `C:high` `V:durable`
- **Claim.** The quote-generation flow is: the TD invokes `TDCALL(TDG.MR.REPORT)`; the module uses SEAMOPS[SEAMREPORT] to build a MACed TDREPORT_STRUCT from CPU-held module measurements and TDCS-held TD measurements; the TD passes the report out through `TDG.VP.VMCALL<GetQuote>`; the TD Quoting Enclave verifies it with the ENCLU[EVERIFYREPORT2] leaf — which lets it verify without access to the CPU HMAC key — and then signs the report body with an ECDSA-384 signing key.  `[TDX-GHCI §5.4]` `[TDX-BASE §12.6.2]` `[16][11]` `C:high` `V:durable`
- **Claim.** **SGX was not replaced by TDX.** Server-class Xeon retains SGX, and TDX remote attestation depends on it: without an SGX Quoting Enclave (or the alternative security-engine path below) a TDREPORT cannot become a remotely verifiable Quote.  `[TDX-BASE §12.6.1]` `[TDX-BASE §12.6.2]` `[11]` `C:high` `V:durable`
- **Claim.** On platforms with an enabled Security Engine (ESE/S3M), an alternative path exists: the security engine can create an attestation X.509 certificate, and a Quoting TD certified by security-engine-based attestation can produce either legacy-style Quotes or X.509 certificates.  `[TDX-BASE §12.6.1]` `[TDX-BASE §12.6.3]` `[11]` `C:high` `V:durable`
- **Claim.** Intel performs TCB recovery for TDX, and a TD-preserving module update has explicit implications for the reported TCB, which the specification treats as a first-class part of the attestation architecture.  `[TDX-BASE §12.7]` `[11]` `C:high` `V:durable`
- **Claim.** Platform-bound sealing is specified as part of the measurement and attestation chapter, and the guest-side primitive is `TDG.MR.KEY.GET`, which derives a persistent key customized to the TD's measurements and policy.  `[TDX-BASE §12.8]` `[TDX-ABI §5.5.8]` `[11][12]` `C:high` `V:durable`

---

## 13.14 Service TDs and binding

A service TD is a TD that is granted controlled metadata access to another TD. It is the mechanism by which TDX adds privileged functionality without adding code to the TDX Module itself; the Migration TD is currently its only consumer.

- **Claim.** Each target TD's TDCS contains a service-TD binding table whose slots carry SERVTD_BINDING_STATE, SERVTD_INFO_HASH, SERVTD_TYPE, SERVTD_ATTR and SERVTD_UUID.  `[TDX-BASE §13.2.1]` `[11]` `C:high` `V:durable`
- **Claim.** SERVTD_BINDING_STATE values include NOT_BOUND, PRE_BOUND, BOUND (value 2) and REBIND_BOUND (value 3); in BOUND state SERVTD_UUID, SERVTD_INFO_HASH, SERVTD_TYPE and SERVTD_ATTR have been set and are checked on any subsequent binding.  `[TDX-BASE §13.2.2]` `[11]` `C:high` `V:durable`
- **Claim.** SERVTD_TYPE determines which target-TD metadata fields the service TD may read and write and whether multiple bindings of that type may coexist for one target TD; a service TD implementing several types may be bound several times.  `[TDX-BASE §13.2.3]` `[11]` `C:high` `V:durable`
- **Claim.** SERVTD_ATTR bits are currently all fixed-0, which yields a class binding that is non-migratable in the sense that only part of the binding state migrates, and rebinding is permitted with any TD having the same SERVTD_INFO_HASH, SERVTD_TYPE and SERVTD_ATTR; SERVTD_UUID is not checked and is updated by rebinding.  `[TDX-BASE §13.2.4]` `[11]` `C:high` `V:durable`
- **Claim.** TD_UUID is a 256-bit random universally unique TD identifier created by `TDH.MNG.CREATE` and stored in the TD's TDR; when a service TD is bound, its TD_UUID is written to the target TD's SERVTD_UUID slot field.  `[TDX-BASE §13.2.5]` `[11]` `C:high` `V:durable`
- **Claim.** SERVTD_INFO_HASH is a SHA-384 over the service TD's measurable attributes — ATTRIBUTES, XFAM, MRTD, MRCONFIGID, MROWNER, MROWNERCONFIG, RTMR0–RTMR3 and SERVTD_HASH — with fields selected out by SERVTD_ATTR.IGNORE_TDINFO replaced by zero.  `[TDX-BASE §13.2.6]` `[TDX-ABI §3.9.7]` `[11][12]` `C:high` `V:durable`
- **Claim.** SERVTD_HASH summarizes all service TDs bound or pre-bound to a target TD and is calculated by `TDH.MR.FINALIZE` at the end of TD build and by `TDH.IMPORT.STATE.IMMUTABLE` on TD import — so a TD's attestation covers which service TDs may inspect it.  `[TDX-BASE §13.2.7]` `[11]` `C:high` `V:durable`

---

## 13.15 Module versioning and module/platform binding

- **Claim.** The TDX Module version is five 16-bit fields — MAJOR_VERSION, MINOR_VERSION, UPDATE_VERSION, INTERNAL_VERSION and BUILD_NUM — rendered as a dotted string such as "1.5.08.04.0234".  `[TDX-ABI §3.3.2]` `[12]` `C:high` `V:durable`
- **Claim.** MAJOR_VERSION and MINOR_VERSION together form the module's main version number and are, in the ABI specification's own words, "usually related to the supported SOCs" — module version series are therefore platform-bound by design, not merely by convention.  `[TDX-ABI §3.3.2]` `[12]` `C:high` `V:durable`
- **Claim.** The kernel's TDX documentation states that module version series are platform-specific, giving the example that the 1.5.x series runs on Sapphire Rapids but not on Granite Rapids, which requires 2.0.x. No Intel specification states this; it is a kernel-documentation fact.  `[no-spec]` `[250]` `C:medium` `V:durable`
- **Claim.** TD Partitioning and TD Migration are each specified as a separate document set rather than as a revision of the base architecture, which is what §2.8 and §2.9 state; the mapping of those features onto module version series — 1.0 → 1.5 adding Migration and Partitioning, 1.5 → 2.0 adding TDX Connect — appears in no Intel specification and is an ecosystem convention.  `[TDX-BASE §2.8]` `[TDX-BASE §2.9]` `[11][250]` `C:medium` `V:durable`
- **Claim.** The module also enumerates capability at a finer granularity than version through the TDX_FEATURES0 bitmap readable by `TDH.SYS.RD*` and `TDG.SYS.RD`; feature-gated behaviour in this chapter cites the specific bit where the specification gives one.  `[TDX-ABI §3.3.3]` `[12]` `C:high` `V:durable`

> Silicon generations, cloud availability, kernel merge windows and distribution support are deliberately absent here. See `90-dated-landscape.md`.

---

## 13.16 TD Migration

- **Claim.** TD migration involves a passive migrated TD that is not aware it is being migrated, plus a Migration TD (MigTD) on each of the source and destination platforms whose role is to implement and evaluate a migration policy covering TDX platform TCB requirements, platform features and acceptable destination MigTD TCB requirements.  `[TDX-MIG §2.3]` `[19]` `C:high` `V:durable`
- **Claim.** The MigTD is a service TD: it is bound to the target TD with `TDH.SERVTD.BIND`, receives a binding handle, and reaches the target TD's metadata through `TDG.SERVTD.RD`/`TDG.SERVTD.WR`.  `[TDX-BASE §13.2]` `[TDX-BASE §13.4]` `[TDX-GHCI §5.5]` `[11][16]` `C:high` `V:durable`
- **Claim.** Service TD binding may be pre-established: before `TDH.MR.FINALIZE`, the host VMM may call `TDH.SERVTD.PREBIND` to write the binding fields, including SERVTD_HASH, into the target TD's service-TD table, so the binding is reflected in the target TD's measurement.  `[TDX-GHCI §5.5]` `[TDX-BASE §13.1]` `[16][11]` `C:high` `V:durable`
- **Claim.** A migration session is divided into an in-order memory migration phase and an out-of-order memory migration phase, followed by commitment; abort paths exist for both export and import.  `[TDX-MIG §2.5]` `[19]` `C:high` `V:durable`
- **Claim.** Multiple migration streams may be created to use several logical processors concurrently; each stream enforces export/import ordering within itself, and ordering across concurrent streams is enforced by migration epochs, with any given page migrated at most once per epoch.  `[TDX-MIG §2.5]` `[19]` `C:high` `V:durable`
- **Claim.** MIGSC (Migration Stream Context) is an opaque single-4KB-page control structure created by `TDH.MIG.STREAM.CREATE`, and it can be created only while no migration session is in progress.  `[TDX-MIG §5.6.1]` `[19]` `C:high` `V:durable`
- **Claim.** The `*BLOCKEDW`, `EXPORTED_*` and `PENDING_EXPORTED_*` Secure EPT states exist to support write-blocking-based and non-blocking export; their state diagrams are given in the TD Migration specification rather than the base specification.  `[TDX-BASE §9.2.2]` `[TDX-MIG §8.2]` `[11][19]` `C:high` `V:durable`

---

## 13.17 TD Partitioning

- **Claim.** TD Partitioning lets a TD contain up to 4 VMs: a primary L1 VM that may act as an L1 VMM, plus up to 3 nested L2 VMs that are its guests.  `[TDX-PART §11.1]` `[20]` `C:high` `V:durable`
- **Claim.** The stated design target is a minimal environment supporting Microsoft VSM and similar architectures — one unmodified legacy VM plus up to two additional supervisory VMs inside a guest TD.  `[TDX-PART §11.1]` `[20]` `C:high` `V:durable`
- **Claim.** Within a TD the L1 VMM is inside the TCB of its L2 VMs, and the L1-to-L2 relationship mirrors a legacy VMM-to-VM relationship; apart from that, TD Partitioning preserves the base TDX security properties.  `[TDX-PART §11.2]` `[20]` `C:high` `V:durable`
- **Claim.** A TD VCPU under partitioning runs either in the L1 VMM or in one of the L2 VMs, and L1↔L2 transitions always occur within the same VCPU.  `[TDX-PART §11.1]` `[20]` `C:high` `V:durable`
- **Claim.** L2 support adds its own control-structure surface: additions to TDCS and TDVPS, L2 Secure EPT entries with their own partial state diagram, and L2 page aliasing managed through `TDG.MEM.PAGE.ATTR.RD`/`TDG.MEM.PAGE.ATTR.WR`.  `[TDX-PART §20.2]` `[TDX-PART §21.2]` `[20]` `C:high` `V:durable`

---

## 13.18 TDX Connect / TEE-IO

- **Claim.** TDX Connect defines a TEE Security Manager (TSM) — the host-side security authority, realized by the TDX Module together with the Intel CPU Root Complex extension that supports trusted DMA mapping, secure MMIO and PCIe IDE link protection — and a Device Security Manager (DSM) residing on the device, which enforces TDISP security requirements and maintains the per-TDI state machine.  `[TDX-CONNECT §1.3]` `[TDX-CONNECT §2.1]` `[17]` `C:high` `V:durable`
- **Claim.** TSM and DSM establish a secure SPDM session over the PCIe DOE mailbox transport; TDISP and IDE protocol messages are encapsulated in that session using AES-256-GCM, and the session is used to exchange device identity certificates and attestation measurements, provision IDE keys and manage TDI state transitions.  `[TDX-CONNECT §1.3]` `[17]` `C:high` `V:durable`
- **Claim.** The PCI-SIG TDI state machine has four key states: CONFIG_UNLOCKED (default; the VMM configures the TDI, memory requests from a TVM are rejected), CONFIG_LOCKED (configuration frozen pre-assignment; any later configuration change forces ERROR), RUN (the TVM has accepted the TDI into its TCB and the TDI is operational), and ERROR (security violation or misconfiguration; TVM memory requests are rejected).  `[TDX-CONNECT §1.3]` `[17]` `C:high` `V:durable`
- **Claim.** Transitions are driven by TDISP messages generated by the TSM: LOCK_INTERFACE_REQUEST moves CONFIG_UNLOCKED → CONFIG_LOCKED, and START_INTERFACE_REQUEST enables trusted DMA from the TDI to the TVM and trusted MMIO from the TVM to the TDI, moving the TDI to RUN.  `[TDX-CONNECT §1.3]` `[17]` `C:high` `V:durable`
- **Claim.** The guest-side acceptance path is: the TD verifies the device attestation and TDISP report with `TDG.TDI.VALIDATE`, then enables DMA and MMIO mappings, then requests the RUN transition; the corresponding host-side commands are the `TDH.TDI.*` and `TDH.MMIO.*` SEAMCALL leaves, which sit in the TDX Connect block beginning at leaf **128** (`TDH.TDI.*` at 136–141 and 164–166, `TDH.MMIO.*` at 154–160).  `[TDX-CONNECT §2.6]` `[TDX-ABI §5.4.1.2]` `[17][12]` `C:medium` `V:durable`
- **Claim.** When a TDI is bound and in RUN state, its DMA requests travel over the default IDE stream marked as a TEE request (IDE T = 1); the host Root Port decrypts and authenticates the request and forwards it to the IOMMU preserving the T = 1 designation, so the IOMMU can identify TEE-IO requests.  `[TDX-CONNECT §2.2]` `[17]` `C:high` `V:durable`
- **Claim.** Secure EPT gains three MMIO states — MMIO_MAPPED, MMIO_BLOCKED and MMIO_PENDING — for private MMIO pages under TDX Connect, and TLB tracking is extended both to those MMIO pages and, by an analogous mechanism, to IOMMU TLBs for attached devices.  `[TDX-BASE §9.2.1]` `[TDX-BASE §9.7]` `[11]` `C:high` `V:durable`
- **Claim.** TDX Connect has a multi-part dependency that the specification set itself does not treat as complete: a working deployment requires a capable CPU, an enabled host OS/hypervisor and a TEE-IO-capable device, and the specification set itself still describes parts of the flow as in development — §2.3 defers to an Intel TDX NRX Architecture Specification that is "still under development". The CPU-plus-host-OS-plus-device requirement is Intel's own product wording rather than a specification statement. See `90-dated-landscape.md` for the current ecosystem state.  `[TDX-CONNECT §2.3]` `[17][587]` `C:medium` `V:durable`

> **Document number — resolved.** The PDF served from Intel's content-delivery link for the TDX Connect
> Architecture Specification carries the cover mark **"354629 003-US June 2025"**, which is what
> `CONVENTIONS.md §5` and bibliography entry [17] both record. The widely-repeated "354629-004" is
> wrong. One caution for re-checkers: an older content endpoint still serves **354629 001-US, March
> 2023** — check the cover before trusting a downloaded copy.

---

## 13.19 Interface-function conventions: status, identification, concurrency

Everything in this section applies uniformly across the `TDH.*` and `TDG.*` families, and is what makes the leaf tables in §13.5 and §13.6 usable without reading every leaf definition.

- **Claim.** Completion status is returned in RAX at three levels of detail. At the coarsest level, 0 means success, a positive value (0x0000000000000001–0x7FFFFFFFFFFFFFFF) means success with an informational or warning code, and a negative value (0x8000000000000000–0xFFFFFFFFFFFFFFFF) means the function aborted with an error.  `[TDX-BASE §18.6.1]` `[11]` `C:high` `V:durable`
- **Claim.** At the medium level the status encodes CLASS, ERROR, NON_RECOVERABLE (the error or TD failure is probably not recoverable), FATAL (applicable only to `TDH.*`, indicating the TD can now only be torn down) and HOST_RECOVERABILITY_HINT.  `[TDX-BASE §18.6.2]` `[11]` `C:high` `V:durable`
- **Claim.** The completion-status class occupies bits 47:40 of the status structure, and the full status-code and operand-ID definitions are given in the ABI specification rather than the base specification.  `[TDX-ABI §3.1]` `[TDX-BASE §18.6.3]` `[12][11]` `C:high` `V:durable`
- **Claim.** A TD is identified by its TD handle, which is the TDR HPA, and by TD_UUID, a 256-bit integer; a VCPU is identified by its VCPU handle, which is the TDVPR HPA, plus a VCPU index, and a VM within a partitioned TD by a VM index.  `[TDX-BASE §18.7]` `[11]` `C:high` `V:durable`
- **Claim.** The interface-function leaf number and version number are carried together in RAX for both SEAMCALL and TDCALL, and the specification distinguishes "regular" leaf functions from "transition" leaf functions — TD entry and TD exit — which have different CPU-state preservation conventions.  `[TDX-BASE §18.5.1]` `[TDX-BASE §18.5.2]` `[TDX-BASE §18.5.3]` `[11]` `C:high` `V:durable`
- **Claim.** TD metadata is not accessed by offset but through a metadata interface: MD_FIELD_ID identifies a field or a field sequence and is composed of a context code, a class code and a field code, with distinct class-code spaces for module global scope, TD scope (TDR and TDCS) and VCPU scope (TDVPS).  `[TDX-ABI §3.10.1]` `[TDX-ABI §3.10.3]` `[TDX-BASE §18.8]` `[12][11]` `C:high` `V:durable`
- **Claim.** Long-running interface functions are architecturally interruptible: the specification defines interruptible host-side functions, interruptible guest-side functions and rate-limited guest-side functions, and a caller observing TDX_INTERRUPTED_RESUMABLE in RAX is expected to re-issue the same leaf until it completes.  `[TDX-BASE §18.9]` `[11]` `C:high` `V:durable`
- **Claim.** Concurrency is architecturally constrained rather than best-effort: the specification defines explicit and implicit concurrency restrictions, transactions, and concurrency restrictions with host priority, and OP_STATE transitions are annotated with whether they take a shared or an exclusive lock.  `[TDX-BASE §18.1]` `[TDX-BASE §7.2]` `[11]` `C:high` `V:durable`

---

## 13.20 Robustness: debug, machine checks, denial of service and side channels

- **Claim.** The module architecture explicitly addresses TD-induced denial of service, covering bus-lock detection by the TD OS, bus-lock TD exit, instruction-timeout TD exit, and denial of service caused by long-latency guest-side interface functions.  `[TDX-BASE §11.16]` `[11]` `C:high` `V:durable`
- **Claim.** Single-step and zero-step attacks have a dedicated mitigation section: the module detects and mitigates them, the host VMM is expected to behave in a specified way, and an optional guest-TD zero-step notification exists.  `[TDX-BASE §17.3]` `[11]` `C:high` `V:durable`
- **Claim.** The guest is not directly made aware of the zero-step mitigation actions that caused EPT-violation TD exits to the host VMM unless it opts into the notification.  `[TDX-BASE §17.3]` `[11]` `C:high` `V:durable`
- **Claim.** The module checks and virtualizes the CPU's side-channel protection enumeration and covers branch-prediction side-channel mitigation as part of its architecture, rather than leaving it to the guest.  `[TDX-BASE §17.1]` `[TDX-BASE §17.2]` `[11]` `C:high` `V:durable`
- **Claim.** The debug architecture has two halves: on-TD debug, using software running inside the TD, and off-TD debug, using software outside it.  `[TDX-BASE §15.1]` `[TDX-BASE §15.3]` `[11]` `C:high` `V:durable`
- **Claim.** A guest TD is debuggable if and only if its ATTRIBUTES.DEBUG bit is 1; in that mode the host VMM can use TDX Module functions to read and modify TD VCPU state and TD private memory that are otherwise inaccessible.  `[TDX-BASE §15.3]` `[11]` `C:high` `V:durable`
- **Claim.** A debuggable TD is by nature untrusted, and because ATTRIBUTES is carried in TDREPORT_STRUCT, its debuggability is visible to every party the TD attests to — this is the architectural guarantee that a relying party can refuse a debuggable TD.  `[TDX-BASE §15.3]` `[11]` `C:high` `V:durable`
- **Claim.** Where TDX_FEATURES0.DEBUG_RO_TD_MIGRATION is supported, a debuggable TD with ATTRIBUTES.MIGRATABLE = 1 may be migrated, but its debuggability is then reduced: the host VMM may read TD memory but not write it, and may write only the metadata that is writable for a non-debuggable TD.  `[TDX-BASE §15.3]` `[11]` `C:high` `V:durable`
- **Claim.** The off-TD debug interface is the eight functions of Table 15.5 — `TDH.MNG.RD`, `TDH.MNG.WR`, `TDH.MEM.SEPT.RD`, `TDH.VP.RD`, `TDH.VP.WR`, `TDH.MEM.RD`, `TDH.MEM.WR` and `TDH.PHYMEM.PAGE.RDMD` — several of which read non-secret state regardless of the DEBUG attribute; the DEBUG bit widens what counts as readable or writable rather than unlocking new leaves.  `[TDX-BASE §15.3]` `[11]` `C:high` `V:durable`
- **Claim.** TDX defines memory-integrity error logging, machine checks and unbreakable shutdowns as part of its architecture, and specifies how machine-check events are handled during guest TD operation when delivered as an #MC exception, as an MSMI under EMCA2, or as a CMCI.  `[TDX-BASE §16.2]` `[TDX-BASE §16.5]` `[11]` `C:high` `V:durable`

---

## 13.21 Known vulnerabilities and public security research

Facts in this section were misfiled in other chapters in the previous edition and belong here by the ownership table in `CONVENTIONS.md §7`. They bound what the TDX trust model actually delivers. Rollout status, cloud-fleet remediation and IPU cadence belong in `90-dated-landscape.md`.

### 13.21.1 CVE-2025-30513 — TOCTOU on TD ATTRIBUTES during migration import

- **Claim.** CVE-2025-30513 is a vulnerability in the **Intel TDX Module** — not in SEAMLDR, BIOS or silicon — published in Intel advisory **INTEL-SA-01397**, "2026.1 IPU, Intel TDX module Advisory", released 2026-02-10.  `[no-spec]` `[253]` `C:high` `V:durable`
- **Claim.** Its class is a race condition / time-of-check-time-of-use flaw, catalogued as CWE-362, with impact "escalation of privilege" by a local privileged attacker — in practice a malicious host VMM.  `[no-spec]` `[253]` `C:high` `V:durable`
- **Claim.** Intel scores it CVSS 3.1 **7.9 High**, vector `CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:N`, and CVSS 4.0 **8.4 High**; NVD publishes 8.3 for the identical CVSS 4.0 vector, so any citation should name its source.  `[no-spec]` `[253]` `C:high` `V:durable`
- **Claim.** The mechanism is that `TDH.MNG.INIT` can be executed after `TDH.IMPORT.STATE.IMMUTABLE` has begun: a compromised destination VMM interrupts the immutable-state import and interleaves `TDH.MNG.INIT`, mutating the TD's 64-bit ATTRIBUTES bitmap after it has been imported and attested, and flipping a migratable non-debuggable TD into a debuggable one — which under §13.20 grants the host VMM full access to TD private memory and VCPU state.  `[TDX-BASE §7.2]` `[TDX-ABI §3.4.1]` `[TDX-BASE §15.3]` `[11][12][255]` `C:high` `V:durable`
- **Claim.** Affected TDX Module versions are 1.5.20 and earlier on 4th and 5th Gen Xeon Scalable and on Xeon 6 E-core parts, and 2.0.12 and earlier on Xeon 6 P-core and Xeon 6 SoC parts; remediation is in module 1.5.24/1.5.25 and 2.0.14 onward, and Intel initiated a TCB recovery on disclosure.  `[TDX-BASE §12.7]` `[253]` `C:medium` `V:durable`
- **Claim.** CVE-2025-30513 was one of five CVEs from a joint Google–Intel security assessment of TDX with Live Migration support conducted in Q2–Q3 2025: one vulnerability enabling a VMM to fully compromise a TD, and four enabling a malicious VMM or TD to leak confidential memory of the TDX Module (CVE-2025-32007, CVE-2025-27572, CVE-2025-32467, CVE-2025-27940).  `[no-spec]` `[255]` `C:high` `V:durable`
- **Claim.** The four memory-leak CVEs are scored 4.1–4.4 in the Google report's own severity table, which **matches** Intel's CVSS 3.1 scores in INTEL-SA-01397 — 4.4 for CVE-2025-32007 and 4.1 for the other three; Intel separately publishes CVSS 4.0 5.6 Medium for each of the four, and 5.6 is the 4.0 score, not the 3.1 score. The same advisory also carries CVE-2025-31944 (CVSS 3.1 5.3), a race condition causing denial of service found internally at Intel, which did not come from the Google assessment.  `[no-spec]` `[253][255]` `C:high` `V:durable`
- **Claim.** This CVE cluster is the concrete evidence for the general point that Migration and Partitioning enlarge the TCB: both add module code paths running at SEAM root privilege and new opaque control structures (MIGSC, L2 control-structure extensions) reachable from host-supplied inputs — the two specifications' own interface-function chapters are the inventory of that added surface, and the Google assessment says so in as many words.  `[TDX-MIG §5.2]` `[TDX-PART §11.9]` `[19][20][255]` `C:medium` `V:durable`

### 13.21.2 TDXRay — microarchitectural side-channel analysis of TDX

- **Claim.** TDXRay is peer-reviewed security research — "TDXRay: Microarchitectural Side-Channel Analysis of Intel TDX for Real-World Workloads", published at IEEE Symposium on Security and Privacy 2026 by authors from CISPA, UC San Diego and Google.  `[no-spec]` `[252]` `C:high` `V:durable`
- **Claim.** TDXRay composes four host-side primitives — SEPTrace (page-level tracking by blocking Secure EPT translations), Load+Probe (cache-line detection by timing), TSX-Probe (TSX transaction aborts on cached lines) and MWAIT-Probe (MWAIT monitoring a physical address, including TD private memory) — to produce cache-line-granular memory-access traces of unmodified TDs using only architecturally legitimate host interfaces.  `[no-spec]` `[252]` `C:high` `V:durable`
- **Claim.** The authors demonstrate AES T-table key recovery and recovery of LLM user prompts from a single trace by observing tokenizer memory accesses, and report that Xeon Silver 4510 (Sapphire Rapids), Xeon Gold 6526Y (Emerald Rapids) and Xeon 6736P (Granite Rapids) are all affected.  `[no-spec]` `[252]` `C:high` `V:durable`
- **Claim.** **TDXRay has no INTEL-SA advisory number, no CVE and no CVSS score.** Intel's response is security *announcement* **INTEL-2026-04-02-001** of 2026-04-02, which treats the behaviour as architecturally permitted observation of shared microarchitectural resources and places the mitigation burden on developers following Intel's side-channel-resistance guidance.  `[no-spec]` `[254]` `C:high` `V:durable`
- **Claim.** The widely repeated attribution of TDXRay to **INTEL-SA-01271 is wrong**: that advisory is the Intel Gaudi Software Installer Advisory of 2025-05-13, covering CVE-2024-45067, an incorrect-default-permissions issue (CWE-276) in Gaudi software installers before version 1.18, with no relationship to TDX. The mislabel originates in link text on the TDXRay project site whose href actually points at the announcement above.  `[no-spec]` `[254][256]` `C:high` `V:durable`
- **Claim.** TDXRay is consistent with the specification's own threat model rather than a violation of it: the TDX Module explicitly acknowledges single-step and zero-step observation as attacks the host VMM can mount, and mitigates rather than eliminates them.  `[TDX-BASE §17.3]` `[11]` `C:high` `V:durable`

---

## 13.22 What this chapter deliberately does not state

Omissions here are intentional. Each is a place where a plausible-looking but unverified detail would be worse than silence.

- Per-leaf input and output operand tables. The ABI specification defines input operands, output operands, operand information and completion status codes for most of its 84 host-side `§5.4.x` and 26 guest-side `§5.5.x` leaf sections — 31 of the host-side sections say only "this leaf function is defined in the [TD Migration ABI Spec]". Reproducing any of them from memory is exactly the failure mode this rebuild exists to eliminate. Read `[12]` and the machine-readable ABI definitions `[13]`.
- Completion status code numeric values. Only the status *structure* (class in bits 47:40) is stated here; the codes and operand IDs themselves are not in the ABI PDF at all — `[TDX-ABI §3.1.3]` points at separate machine-readable files (`interface_functions_completion_status_details.pdf`/`.csv`, `…_operand_ids.pdf`/`.csv`, `interface_functions_completion_status.json`).
- TDCS and TDVPS field-by-field layouts. These are metadata-addressed, not offset-addressed; use MD_FIELD_ID and the description files in `[TDX-ABI §4.1]` / `[TDX-ABI §4.2]`.
- The size of TDCS and TDVPS in pages. The specification says the count is enumerated at run time by `TDH.SYS.RD*`/`TDH.SYS.INFO` and does not fix it.
- Per-leaf definitions for the TDX Connect leaves beyond the handful named in §13.5 and §13.6. Their leaf numbers and names *are* in 348551-008 Table 5.4 — the host-side block runs 128–166 and the guest-side block 64–74 — but none of them has a §5.4.x or §5.5.x section; the operand and status-code definitions are in the TDX Connect ABI supplement.
