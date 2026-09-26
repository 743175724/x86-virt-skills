# Exhaustive verification — `intel-vt/references/14-nested-virtualization.md`

**Date:** 2026-09-20 · **Claims checked:** 106 / 106 · **Verdicts:** 98 CONFIRMED · 7 WRONG · 1 UNSUPPORTED · 0 UNVERIFIABLE

Every claim in the chapter was checked against a freshly downloaded primary source. Nothing in this
table was answered from memory.

## Sources downloaded and text-extracted for this pass

| Document | URL | Extraction |
|---|---|---|
| SDM Vol.3C, Order 326019-092US, Rev 092, June 2026 | `https://cdrdv2-public.intel.com/922489/326019-092-sdm-vol-3c.pdf` | 2.18 MB → `pdftotext -layout` → 21 997 lines |
| SDM Vol.3D, Order 332831, Rev 092, June 2026 | `https://cdrdv2.intel.com/v1/dl/getContent/671269` | 1.67 MB → 15 364 lines |
| SDM Vol.4, Order 335592, Rev 092, June 2026 | `https://cdrdv2.intel.com/v1/dl/getContent/671098` | 3.00 MB → 47 031 lines |
| KVM `arch/x86/kvm/vmx/nested.c` (torvalds/linux, plain) | `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/plain/arch/x86/kvm/vmx/nested.c` | 7 510 lines |
| KVM `arch/x86/kvm/vmx/vmx.c`, `vmcs_shadow_fields.h` | same host | read for `vmx_update_exception_bitmap()` and the shadow-field tables |
| `Documentation/virt/kvm/x86/nested-vmx.rst`, `Documentation/virt/kvm/api.rst` | kernel.org | vmcs01/12/02 naming, `KVM_*_NESTED_STATE` |
| Turtles Project, OSDI '10 | `https://www.usenix.org/events/osdi10/tech/full_papers/Ben-Yehuda.pdf` | 259 KB PDF |
| Har'El, "Nested virtualization: shadow turtles", KVM Forum 2013 | `https://www.linux-kvm.org/images/e/e9/Kvm-forum-2013-nested-virtualization-shadow-turtles.pdf` | 904 KB PDF |
| arXiv:2202.13483 abstract (OoH / EPML) | `https://arxiv.org/abs/2202.13483` | fetched |
| Microsoft Learn — nested virtualization, enable-nested-virtualization, WHP API + Hyper-V APIs index, TLFS nested virtualization, TLFS VSM, "virtualization applications can't run alongside Hyper-V", nested-virtualization troubleshooting guide | `learn.microsoft.com` is unreachable from this sandbox (TLS handshake refused); the **published article sources** were read instead from the MicrosoftDocs repositories that generate those exact pages (`MicrosoftDocs/windowsserverdocs`, `MicrosoftDocs/Virtualization-Documentation`, `MicrosoftDocs/SupportArticles-docs`), plus `WebSearch` against `learn.microsoft.com` for corroboration | raw markdown |

`[no-spec]` was introduced by the linter mid-pass. 34 claims in this chapter now carry it: KVM
implementation detail, Hyper-V/WHP/VBS behaviour, and the academic lineage. **14 of those are the
Windows re-anchorings** (§14.10 ×1, §14.12 ×13) — claims previously hung on SDM sections that do not
discuss Hyper-V, WHP, WSL2, Windows Sandbox or VBS at all.

---

## 14.1 Why nesting is trap-and-emulate

| # | Claim (abbrev.) | Verdict | Evidence |
|---|---|---|---|
| 1 | Three levels L0/L1/L2; only L0 in VMX root operation | CONFIRMED | SDM 3C §26.3: "There are two kinds of VMX operation: VMX root operation and VMX non-root operation." Quote block matches `nested-vmx.rst` "Terminology" verbatim. |
| 2 | Unconditional-exit instruction list | CONFIRMED | SDM 3C §28.1.2 lists exactly CPUID, GETSEC, INVD, XSETBV + INVEPT, INVVPID, SEAMCALL, TDCALL, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF, VMXON. |
| 3 | VMREAD/VMWRITE the only VMCS-access instructions off that list | CONFIRMED | VMCLEAR/VMPTRLD/VMPTRST are on the §28.1.2 list; VMREAD/VMWRITE are governed by §27.10. |
| 4 | One L2 exit cascades into 40–50 L1→L0 exits | CONFIRMED | Slide deck [303] p.: "Exit multiplication: a single L2 exit can cause 40-50 L1 exits!" |
| 5 | Turtles: first complete x86 nested implementation, 6–8% | CONFIRMED | Turtles §1: "with as little as 6-8% overhead"; contributions list names multi-dimensional paging and multi-level device assignment. Anchor changed `[SDM 3C §26.3]` → `[no-spec]` (an academic result, not SDM content). |

## 14.2 Three control structures

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 6 | KVM names vmcs01/vmcs12/vmcs02; "the same naming appears in the Turtles paper as VMCS0→1, VMCS1→2 and VMCS0→2" | **WRONG** | The Turtles paper uses **VMCS01, VMCS12, VMCS02** — the identical names, no arrow notation. A regex census of the PDF text finds `VMCS12` ×23, `VMCS02` ×8, `VMCS01` ×6 and **zero** arrow forms (§3.2.2: "L0 prepares a VMCS (VMCS01) to run L1 … L1 defines L2's environment by creating a VMCS (VMCS12)"). Fixed; anchor → `[no-spec]`. KVM half confirmed verbatim from `nested-vmx.rst`. |
| 7 | vmcs12 may be software; bytes 8+ implementation-specific | CONFIRMED | SDM 3C Table 27-1, byte offset 8: "VMCS data (implementation-specific format)". `nested-vmx.rst`: the structure "is *opaque* to its user … accessed through the VMREAD and VMWRITE instructions". |
| 8 | ≤4 KBytes; revision id in bits 30:0; VMPTRLD fails on mismatch | CONFIRMED | SDM 3C §27.2 verbatim. |

## 14.3 VMCS shadowing

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 9 | "VMCS shadowing" is a secondary processor-based control; discovered via IA32_VMX_PROCBASED_CTLS2 | CONFIRMED | SDM 3C Table 27-7 (§27.6.2) **bit 14** = "VMCS shadowing"; §27.2: "Software can discover support for this setting by reading the VMX capability MSR IA32_VMX_PROCBASED_CTLS2 (see Appendix A.3.3)." Bit number and `[SDM 3C §27.6.2]` / `[SDM 3D App.A.3.3]` added for precision. |
| 10 | Shadow-VMCS indicator = **bit 31 of the first 4 bytes**; bits 30:0 = revision id | CONFIRMED | SDM 3C §27.10 verbatim (the chapter's excerpt is exact) and Table 27-1. |
| 11 | VMPTRLD fails if indicator 1 and control unsupported; VMCLEAR before changing it | CONFIRMED | §27.2 (VMPTRLD) and §27.10 ("Before modifying the shadow-VMCS indicator, software should execute VMCLEAR"). |
| 12 | A shadow VMCS differs in exactly two ways | CONFIRMED | §27.10: "A shadow VMCS differs from an ordinary VMCS in two ways". |
| 13 | VMCS-link pointer: 64-bit guest non-register state; FFFFFFFF_FFFFFFFFH otherwise | CONFIRMED | §27.4.2 verbatim. |
| 14 | VM entry checks the linked VMCS is a shadow VMCS; invalid link pointer is a failure cause | CONFIRMED | §27.10 → §29.3.1.5 ("Bit 31 must contain the setting of the 'VMCS shadowing' VM-execution control"); §29.8 item 4: "Failure was due to an invalid VMCS link pointer". |
| 15 | In VMX root operation both types are accessible | CONFIRMED | §27.10 verbatim. |
| 16 | Two 64-bit bitmap addresses; each bitmap 4 KBytes = 32 KBits | CONFIRMED | §27.6.15 verbatim (chapter excerpt is exact). |
| 17 | VMREAD exits if control 0 **or** operand sets any bit in 63:15 **or** the bit for 14:0 is 1 | CONFIRMED | SDM 3C Ch.33, VMREAD Operation section, verbatim; VMWRITE symmetric with the VMWRITE bitmap. |
| 18 | Bit position `x & 7` of the byte at `addr \| (x >> 3)` | CONFIRMED | Ch.33 VMREAD footnote 1: "The corresponding VMREAD bit is in bit position x & 7 of the byte at physical address addr \| (x » 3)." VMWRITE footnote identical. |
| 19 | Per-field intercept policy; only the low 32K of encoding space can be shadowed | CONFIRMED | Follows from 63:15 always exiting and 2¹⁵ = 32768 = the 32 KBits of §27.6.15. |
| 20 | KVM builds the bitmaps at module init from two shadow-field tables | CONFIRMED | `init_vmcs_shadow_fields()` memsets both to 0xFF then `clear_bit(field, …)` only for `shadow_read_only_fields` / `shadow_read_write_fields`; called from `nested_vmx_hardware_setup()`. Anchor → `[no-spec]`; detail added. |
| 21 | `copy_vmcs12_to_shadow()` before resuming L1 | CONFIRMED | `nested.c`. Anchor → `[no-spec]`. |
| 22 | `copy_shadow_to_vmcs12()` + its comment | CONFIRMED | Comment is verbatim: "Copy the writable VMCS shadow fields back to the VMCS12, in case they have been modified by the L1 guest." Anchor → `[no-spec]`. |
| 23 | Non-shadowed fields keep trapping | CONFIRMED | §27.6.15 + Ch.33 (bit set ⇒ VM exit). |
| 24 | The shadow VMCS hangs off **vmcs01**'s link pointer and is never entered | CONFIRMED | §27.10 (shadow VMCS cannot be used for VM entry); KVM `vmx->vmcs01.shadow_vmcs`. |

## 14.4 Constructing vmcs02

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 25 | Host state from vmcs01 | CONFIRMED | §27.5: "processor state is loaded from these fields on every VM exit (see Section 30.5)". |
| 26 | Guest state from vmcs12, L0 overriding what it owns incl. the VMCS-link pointer | CONFIRMED | §27.4; KVM `prepare_vmcs02()` writes `VMCS_LINK_POINTER, INVALID_GPA`. |
| 27 | `prepare_vmcs02_early()` / `prepare_vmcs02()` split | CONFIRMED | `nested.c`. Anchor → `[no-spec]`. |
| 28 | Exception bitmap = union | CONFIRMED | `vmx_update_exception_bitmap()`: `if (is_guest_mode(vcpu)) eb \|= get_vmcs12(vcpu)->exception_bitmap;` KVM comment: "EXCEPTION_BITMAP and CR0_GUEST_HOST_MASK should basically be the bitwise-or of what L1 wants to trap for L2, and what we want to trap." SDM §27.6.3 for the bitmap itself. |
| 29 | Single #PF error-code mask/match pair forces intercept-all | CONFIRMED | §27.6.3; KVM: "it is not easy (if at all possible?) to merge L0 and L1's desires, we simply ask to exit on each and every L2 page fault … setting MASK=MATCH=0 and … EB.PF=1". |
| 30 | MSR bitmaps: intersection of pass-through sets; no vmcs12 bitmap ⇒ intercept everything | CONFIRMED | §27.6.9; `nested_vmx_prepare_msr_bitmap()` returns false when vmcs12 lacks `CPU_BASED_USE_MSR_BITMAPS`, and the caller then does `exec_controls_clearbit(vmx, CPU_BASED_USE_MSR_BITMAPS)`. |
| 31 | "rather than merge two **8-KByte** I/O bitmaps" | **WRONG** | SDM 3C §27.6.4: "the 64-bit physical addresses of I/O bitmaps A and B (**each of which are 4 KBytes in size**). I/O bitmap A contains one bit for each I/O port in the range 0000H through 7FFFH; I/O bitmap B contains bits for ports in the range 8000H through FFFFH." 8 KBytes is the *pair*, not each. Corrected in place; the KVM half (`CPU_BASED_UNCOND_IO_EXITING` set, `CPU_BASED_USE_IO_BITMAPS` cleared) is confirmed in `prepare_vmcs02_early()`. |
| 32 | Pin-based unioned, preemption timer special | CONFIRMED | `exec_control = __pin_controls_get(vmcs01); exec_control \|= (vmcs12->pin_based_vm_exec_control & ~PIN_BASED_VMX_PREEMPTION_TIMER);` SDM §27.6.1 for external-interrupt/NMI exiting. |
| 33 | Processor-based: exiting controls unioned, L0-mechanism controls from L0 | CONFIRMED | `prepare_vmcs02_early()`: primary controls start from vmcs01 and OR in vmcs12; secondary start from vmcs01 with a "take only from vmcs12" mask that excludes EPT/VPID/unrestricted-guest. |
| 34 | "TSC offsets compose additively: the offset in vmcs02 is **the sum** of L0's and L1's" | **WRONG** (unconditionally stated) | `kvm_calc_nested_tsc_offset(l1_offset, l2_offset, l2_multiplier)` = *scale(l1_offset, l2_multiplier) + l2_offset*: it is a plain sum only when no TSC scaling is in play. `kvm_calc_nested_tsc_multiplier()` does compose the multipliers multiplicatively. Rewritten to state both cases. SDM §27.6.5 confirms TSC is multiplied by the multiplier *before* the offset is added. |
| 35 | CR0/CR4 guest/host masks unioned; read shadows composed | CONFIRMED | `vcpu->arch.cr0_guest_owned_bits &= ~vmcs12->cr0_guest_host_mask; vmcs_writel(CR0_GUEST_HOST_MASK, ~…)`; CR4 via `set_cr4_guest_host_mask()`; SDM §27.6.6 for mask/read-shadow semantics. |
| 36 | vmcs02's EPTP always points at an L0-controlled structure | CONFIRMED | §27.6.11; KVM never loads `vmcs12->ept_pointer` into hardware. |
| 37 | Sync-back via `sync_vmcs02_to_vmcs12()` from `__nested_vmx_vmexit()`, incl. the preemption-timer value | CONFIRMED | `nested.c` L5073 ff. calls it; the function copies `vmx_preemption_timer_value` when `VM_EXIT_SAVE_VMX_PREEMPTION_TIMER`. SDM Ch.30 for what hardware writes. |
| 38 | A lazy "rare" sync path | CONFIRMED | `sync_vmcs02_to_vmcs12_rare()` / `copy_vmcs02_to_vmcs12_rare()` gated on `need_sync_vmcs02_to_vmcs12_rare`. Anchor → `[no-spec]`. |
| 39 | `KVM_CAP_NESTED_STATE` + `KVM_GET/SET_NESTED_STATE` | CONFIRMED | `Documentation/virt/kvm/api.rst` §4.114/§4.115. Anchor → `[no-spec]`. |
| 40 | Illegal controls ⇒ VM-entry failure, fall-through, VM-instruction error | CONFIRMED | SDM 3C Ch.29 (§29.2.1.1–.3) and §27.9.5. |
| 41 | Illegal guest state ⇒ VM exit with **exit-reason bit 31 set** | CONFIRMED | Table 27-19 (§27.9.1): "31 — VM-entry failure (0 = true VM exit; 1 = VM-entry failure)"; §29.8 step 1. |
| 42 | A too-permissive merge fails silently | CONFIRMED (analysis) | Follows from the union rule; anchor → `[no-spec]`. |

## 14.5 Exit reflection

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 43 | Reflection = write vmcs12's VM-exit information fields, then a virtual VM exit | CONFIRMED | SDM §27.9 (the fields) and §30.5 (host-state loading, which the software exit mirrors). |
| 44 | `nested_vmx_l0_wants_exit()` / `nested_vmx_l1_wants_exit()` via `nested_vmx_reflect_vmexit()` | CONFIRMED | `nested.c`: "If L0 (KVM) wants the exit, it trumps L1's desires." Order added; anchor → `[no-spec]`. |
| 45 | L0-only bookkeeping exits are invisible to L1 | CONFIRMED | Turtles §3.2.3: "When the event causing the VMExit is related to L0 only, L0 handles the event and resumes L2 … From L1's perspective this event does not exist." Anchor → `[no-spec]`. |
| 46 | The virtual VM exit is a software construction | CONFIRMED | Nothing in Ch.29/Ch.30 performs an L2→L1 transition; §27.9/§30.3 define the fields L0 must fabricate. |
| 47 | Steps 4–5 concentrate bugs (L0↔L1 frame translation) | CONFIRMED | `nested_ept_inject_page_fault()` carries an explicit `from_hardware` parameter precisely to get the GVA-validity bits right; LKML [319]. Anchor → `[no-spec]`. |

## 14.6 Nested EPT

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 48 | 4-level EPT ≤ 4 entries; EPTP 5:3 = walk length − 1; 3 ⇒ 4-level, 4 ⇒ 5-level | CONFIRMED | SDM 3C §31.3.2 verbatim on both halves; Table 27-9 (§27.6.11). |
| 49 | EPT02 = composition of EPT12 and EPT01, loaded in vmcs02 | CONFIRMED | §31.3.2 (one dimension in hardware); Turtles §3.3 "multi-dimensional paging". |
| 50 | EPT02 is a shadow, invalidated on EPT12 or EPT01 change | CONFIRMED | §31.4.3 / §31.4.3.4; KVM `nested_ept_invalidate_addr()`. |
| 51 | No EPT12 ⇒ EPT02 degenerates to EPT01, L0 shadows L2's guest paging | CONFIRMED | §31.3.1 ("EPT is used when the 'enable EPT' VM-execution control is 1"). |
| 52 | EPT violation goes to L0; ownership decided by walking EPT12; `nested_ept_inject_page_fault()` | CONFIRMED | §31.3.3.2 (EPT violations cause VM exits); KVM function exists and calls `nested_vmx_vmexit()` with `EXIT_REASON_EPT_VIOLATION`. |
| 53 | Reflection must synthesise the qualification and the GVA-validity bits; hardware vs emulation differ | CONFIRMED | KVM masks `EPT_VIOLATION_GVA_IS_VALID \| EPT_VIOLATION_GVA_TRANSLATED` and picks the source by `from_hardware`: "Use the EXIT_QUALIFICATION from the VMCS if and only if the hardware VM-Exit from L2 was an EPT Violation." |
| 54 | EPT misconfiguration: same ownership logic, different trigger | CONFIRMED | §31.3.3.1; KVM maps `PFERR_RSVD_MASK` to `EXIT_REASON_EPT_MISCONFIG`. |
| 55 | Deliberately non-present EPT02 entries for L1 MMIO must be distinguished | CONFIRMED | §31.3.3.2 (not-present entry ⇒ EPT violation); KVM MMIO SPTE handling. |
| 56 | EPTP switching is VM function 0; 4-KByte list of 512 8-byte entries; exit if ECX ≥ 512 or invalid (same bits 5:3, would not fail VM entry) | CONFIRMED | §28.5.7.3 and §27.6.14 verbatim on every element. |
| 57 | On success the value is written into the EPTP field of the **current VMCS** | CONFIRMED | §28.5.7.3 pseudocode: "write tent_EPTP to the EPTP field in the current VMCS". |
| 58 | L0 has two consistent choices | CONFIRMED (analysis) | Follows from 56/57. |
| 59 | "EPT-violation #VE" converts certain violations; convertibility per entry via **bit 63** (suppress #VE) | CONFIRMED | §28.5.8.1 verbatim. |
| 60 | A converted #VE is not a VM exit, so L0 must keep suppress-#VE set where it arbitrates | CONFIRMED | §28.5.8.1 ("convertible if and only if bit 63 of the entry is 0"). |

## 14.7 Nested page-walk cost — arithmetic re-derived, not just the result

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 61 | 24 accesses for 4-level guest over 4-level EPT | CONFIRMED | Re-derived: 5 guest-physical addresses (CR3 + the four produced by PML4E/PDPTE/PDE/PTE) × 4 EPT entries = 20, plus 4 guest paging-structure reads = **24**; the 25th is the data access. Closed form (L+1)²−1 = 25−1 = 24 ✓. The chapter's own breakdown 4 + (4×4) + 4 = 24 ✓. SDM §31.3.2 supplies "at most 4 EPT paging-structure entries". |
| 62 | 124 accesses for a literal 3-D walk | CONFIRMED | Re-derived: 5 L2-GPAs → each through 4-level EPT12 yields 4 entry reads + 1 result = 5, so 25 L1-GPAs → each through 4-level EPT01 costs 5 → 125; minus the final data access = **124**. Closed form (L+1)³−1 = 5³−1 = 124 ✓. |
| 63 | An L2 TLB miss that hits in EPT02 still costs 24 | CONFIRMED | Direct consequence of 61 (hardware sees one EPT dimension). |
| 64 | Each EPT02 fill ≈ an exit + 4 × 5 = 20 further accesses | CONFIRMED | Arithmetic checks: up to 4 EPT12 entry reads, each an L1-GPA that L0 resolves at up to 5 accesses. Hedged with "roughly"; C:medium. |
| 65 | Large pages shorten every dimension at once | CONFIRMED | SDM §31.3.2: EPT PDE bit 7 = 1 maps a 2-MByte page (Table 31-5), removing one level; the guest walk loses its PTE level symmetrically. |

## 14.8 Nested VPID, INVEPT, INVVPID

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 66 | INVEPT/INVVPID always exit from non-root operation | CONFIRMED | §28.1.2. |
| 67 | INVEPT types 1/2; INVVPID types 0/1/2/3; reported in IA32_VMX_EPT_VPID_CAP | CONFIRMED | Ch.33 INVEPT ("Single-context invalidation … type is 1", "Global invalidation … type is 2") and INVVPID (individual-address 0, single-context 1, All-contexts 2, single-context retaining globals 3). The chapter's "all-context (2)" for INVEPT is the SDM's own capability-MSR wording: Vol.3D **A.10** — "If bit 26 is read as 1, the all-context INVEPT type is supported." Both anchors already present. |
| 68 | L0 maps L1's INVEPT descriptor onto the derived EPT02(s) | CONFIRMED | §31.4.3.4 guidelines; KVM `nested_ept_invalidate_addr()` / `EP4TA`-keyed roots. |
| 69 | VPIDs are a flat **16-bit** space; L0 allocates `vpid02` for L2 | CONFIRMED | §27.6.12 ("The virtual-processor identifier (VPID) is a 16-bit field") and §31.1; KVM `vmx->nested.vpid02`, "L1 entries are tagged with vmx->vpid while L2 entries are tagged with vmx->nested.vpid02". |
| 70 | No VPID for L2 ⇒ flush on every nested transition | CONFIRMED | `nested_has_guest_tlb_tag()` false ⇒ `nested_vmx_transition_tlb_flush()` flushes; §31.4.3.3 guidelines. |

## 14.9 VMX-preemption timer

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 71 | Counts down in non-root operation; exits at zero; decrements when TSC bit X changes, X ∈ 0–31, reported by IA32_VMX_MISC | CONFIRMED | §28.5.1 verbatim; Vol.3D A.6. |
| 72 | One timer per logical processor ⇒ L0 arms the nearer deadline | CONFIRMED | §28.5.1 describes a single per-logical-processor timer; KVM `hrtimer_cancel(&vmx->nested.preemption_timer)`. |
| 73 | The timer value is guest non-register state, synced back when "save VMX-preemption timer value" is set | CONFIRMED | §27.4.2 ("VMX-preemption timer value (32 bits)") and §27.7.1 VM-exit control **bit 22**; KVM gates the sync on `VM_EXIT_SAVE_VMX_PREEMPTION_TIMER`. |

## 14.10 Nested APICv

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 74 | APICv is configured by VM-execution controls and the virtual-APIC address; VID delivers without a VM exit | CONFIRMED | §27.6.8; Ch.32 preamble: "deliver virtual interrupts — all in VMX non-root operation with out a VM exit". |
| 75 | Nesting APICv is hard (virtual-APIC page named by the loaded VMCS; PI vectors must be demultiplexed) | CONFIRMED | §27.6.8 / Ch.32; KVM `nested.posted_intr_nv`. |
| 76 | The conservative fallback is not to expose APICv to L1 | CONFIRMED | [304], [320]. |
| 77 | On Windows the constraint is a feature-exposure decision | CONFIRMED, **re-anchored** | A Hyper-V statement; `[SDM 3C §27.6.8]` does not discuss Hyper-V. Anchor → `[no-spec]`, sources [311] [316]. |

## 14.11 The VMX capability MSRs

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 78 | The block runs 480H…**491H** | **WRONG** (incomplete) | Every listed address is right (verified one by one in Vol.3D App.A and in Vol.4 §2.1 Table 2-2), but the block does **not** end at 491H in rev 092: Vol.3D A.3.4 gives **IA32_VMX_PROCBASED_CTLS3 at 492H** and A.4.2 gives **IA32_VMX_EXIT_CTLS2 at 493H**, both also present in Vol.4 §2.1 immediately after 491H. An L0 that synthesises only up to 491H leaves two capability MSRs unhandled. Both added. (Note: Vol.4 Table 2-2 spells 491H "IA32_VMX_FMFUNC" — an Intel typo; Vol.3D A.11 has IA32_VMX_VMFUNC, which the chapter uses.) |
| 79 | RDMSR/WRMSR of these are intercepted; L0 returns synthesised values | CONFIRMED | §27.6.9; App.A. |
| 80 | Allowed-0/allowed-1 discipline; TRUE_* availability reported by IA32_VMX_BASIC | CONFIRMED | Vol.3D A.2 and the "If bit 55 in the IA32_VMX_BASIC MSR is read as 1 …" clauses in A.3.1/A.3.2/A.4.1/A.5. |
| 81 | CPUID VMX bit + IA32_FEATURE_CONTROL enable/lock bits | CONFIRMED | §26.6 ("CPUID.01H:ECX.VMX[5] = 1") and §26.7 (MSR 3AH, lock bit 0, bits 1 and 2). |
| 82 | Capability MSRs must be stable across save/restore | CONFIRMED | App.A + [318]. |

## 14.12 Nested VMX on a Windows PC — **every Windows claim re-checked against Microsoft Learn**

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 83 | VMXON always exits ⇒ the first hypervisor owns VMX root operation; the Windows kernel is then a guest | CONFIRMED | SDM §28.1.2 (kept — this half *is* SDM content); Learn [315]: "only one software component at a time can use this hardware. Virtualization applications can't share the hardware." |
| 84 | VBS / WSL2 / Sandbox / Docker Desktop / Hyper-V all start the hypervisor | CONFIRMED, **re-anchored** | `[SDM 3C §26.7]` (ENABLING AND ENTERING VMX OPERATION) does not mention any Windows feature → `[no-spec]`. Learn: [315] (VMware and VirtualBox named; "fall back to a slower, emulated mode"), [323] VBS, [474] WSL 2 "runs a Linux kernel inside of a lightweight utility virtual machine", [475] Windows Sandbox "relies on the Microsoft hypervisor", [481] Docker Desktop backends. |
| 85 | WHP is the user-mode API …"which is how QEMU, VMware Workstation and VirtualBox continue to work on a Hyper-V-enabled machine" | **UNSUPPORTED** (second half), **re-anchored** | Learn's *Hyper-V APIs* page defines WHP as "an extended user-mode API for third-party virtualization stacks and applications to create and manage partitions at the hypervisor level, configure memory mappings for the partition, and create and control execution of virtual processors", and its only named example is QEMU. Microsoft does **not** document VMware Workstation or VirtualBox as WHP clients — [315] says the opposite in the general case. The vendor list was removed and pointed at `90-dated-landscape.md`; the API definition is kept and now names `WHvCreatePartition` / `WHvMapGpaRange` / `WHvCreateVirtualProcessor` / `WHvRunVirtualProcessor`, all verified on [314]/[465]. Anchor `[SDM 3C §26.3]` → `[no-spec]`. |
| 86 | A WHP-hosted VMM does not execute VMXON; L0 pays the nesting cost | CONFIRMED, **re-anchored** | [314]; anchor → `[no-spec]`. |
| 87 | `Set-VMProcessor … -ExposeVirtualizationExtensions $true`, VM must be off | CONFIRMED, **re-anchored** | Learn [479]: "While the virtual machine is in the OFF state, run the following command … `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`"; `$false` disables it on a stopped VM. Anchor `[SDM 3C §26.6]` → `[no-spec]`. |
| 88 | L1 sees the VMX feature bit and the capability MSRs; Intel requirement is VT-x with EPT | CONFIRMED | SDM anchors kept (the feature bit **is** §26.6 and EPT **is** §31.3); Learn [479] prerequisite heading reads "Intel processor with VT-x and EPT technology", plus WS2016/Win10-or-later host and VM configuration version 8.0+. |
| 89 | "Nested exposure **is incompatible with** dynamic memory and with runtime memory resize" | **WRONG** | Learn [311] states the opposite of the premise: "Simply enabling nested virtualization has no effect on dynamic memory or runtime memory resize. … The incompatibility only occurs while Hyper-V is running in the VM." Only the consequence is right ("the virtual machine must be turned off to adjust its memory… even if dynamic memory is enabled, the amount of memory doesn't fluctuate"). Rewritten with the Learn quote as an excerpt; anchor `[SDM 3C §26.3]` → `[no-spec]`. |
| 90 | "Exposing … constrains mobility and save/restore … Microsoft's guidance is to treat an L1 VM as pinned to a host whose features match" | **WRONG** | No such guidance exists. Neither [311] nor [312] states any migration or save/restore restriction for a nested-enabled VM. What Microsoft *does* document (TLFS, [316] "Compatibility with Live Migration") is the opposite: "Hyper-V has the ability to live migrate a child partition from one host to another host… in the case of nested virtualization, the L1 hypervisor may need to be aware of migrations", with an opt-in notification via `HV_X64_MSR_REENLIGHTENMENT_CONTROL` (0x40000106) under the `AccessReenlightenmentControls` privilege. Claim replaced with the documented behaviour; anchor `[SDM 3C §27.11]` → `[no-spec]`. |
| 91 | Enlightened VMCS | CONFIRMED, **re-anchored** | [316] verbatim: "The hypervisor exposes an 'enlightened VMCS' feature which can be used to control virtualization-related processor behavior using a data structure in guest physical memory… thus there is no need for the L1 hypervisor to execute VMREAD or VMWRITE or VMPTRLD instructions." Added the documented mechanics (one 4-KB page, made current via the virtual-processor assist page, "clean fields" mask). Anchor `[SDM 3C §27.10]` → `[no-spec]`. |
| 92 | VBS runs the secure kernel at a higher VTL; boundary enforced with SLAT/EPT | CONFIRMED, **re-anchored** | [317] (VSM TLFS): VTLs are hierarchical, VTL0 least privileged, "Each VTL has its own set of memory access protections… managed by the hypervisor in a partition's physical address space". [323]/[476]: VBS requires a 64-bit processor with Second Level Address Translation plus Intel VT-x. `[SDM 3C §31.3]` does not discuss VBS → `[no-spec]`; VTL0/VTL1 named explicitly. |
| 93 | Hypervisor resident whenever VBS is on ⇒ nested guest is L1 | CONFIRMED, **re-anchored** | [323]; anchor `[SDM 3C §31.3.2]` → `[no-spec]`. |
| 94 | VBS and nested exposure are configured separately | CONFIRMED, **re-anchored** | [311] (exposure) and [323] (VBS) are independent switches; `[SDM 3C §26.7]` → `[no-spec]`. |
| 95 | The hypervisor-pulling features are ordinary desktop features | CONFIRMED, **re-anchored** | [315] [323] [474] [475] [481]; `[SDM 3C §26.7]` → `[no-spec]`. |
| 96 | The stack is three-deep whenever a second VMM is used | CONFIRMED, **re-anchored** | [314] [315]; `[SDM 3C §26.3]` → `[no-spec]`. |
| 97 | "Running a hypervisor inside a Hyper-V VM **adds a fourth conceptual level**… the memory-management **and mobility** restrictions apply for as long as the extensions are exposed" | **WRONG** | Two errors. (a) It adds no level: L0 = Windows hypervisor, L1 = the guest's own hypervisor, L2 = its guests — the same three-level stack the chapter defines in §14.1 and re-states one claim earlier. (b) The restriction is not "for as long as the extensions are exposed": per [311] it applies only while the inner hypervisor is running, and there is no documented mobility restriction (see #90). Rewritten; Learn's supported-scenarios section ("Production environments running Hyper-V VMs running on Hyper-V VMs are supported"; "One level of nested virtualization is supported in production") cited. Anchor → `[no-spec]`. |
| 98 | "VT-x is not available" is usually about ownership of VMX root operation | CONFIRMED | SDM §28.1.2 kept (the ownership half is SDM); [315]: apps "might not start virtual machines, or they might fall back to a slower, emulated mode", workaround "disable Hyper-V". |

## 14.13 Academic lineage — all eight anchors moved to `[no-spec]`

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 99 | Turtles: mechanism + vocabulary, best paper | CONFIRMED | Turtles §1 contributions; [302] records the Jay Lepreau Best Paper award. |
| 100 | ELI (ASPLOS '12) | CONFIRMED | [321]. |
| 101 | Dune (OSDI '12) | CONFIRMED | [305]. |
| 102 | NEVE (SOSP '17) | CONFIRMED | [306]. |
| 103 | SeKVM (S&P 2021 / SOSP 2021) | CONFIRMED | [322]. |
| 104 | OoH inverts the framing (PML, SPP, CAT, EPT to the guest OS) | CONFIRMED | [307]. SDM §31.3.6 (Page-Modification Logging) is a real section but does not discuss OoH → `[no-spec]`. |
| 105 | OoH venue correction: SC '22, not SOSP | CONFIRMED | [308] SC22 technical-paper page; arXiv:2202.13483 is the Feb-2022 preprint. |
| 106 | Unresolved conflict in OoH's own figures | CONFIRMED as a conflict — **left unresolved by instruction** | arXiv abstract re-fetched today and quoted verbatim: "EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%)". The 13× / 6× / 16× figures from [309] are reproduced as given. No averaging, no choice made. |

---

## Summary of edits

| Kind | Count |
|---|---|
| Claims corrected (WRONG) | 7 — #6, #31, #34, #78, #89, #90, #97 |
| Claim narrowed (UNSUPPORTED half removed) | 1 — #85 |
| Windows claims re-anchored off the SDM | **14** — #77, #84, #85, #86, #87, #89, #90, #91, #92, #93, #94, #95, #96, #97 |
| Other anchors moved to `[no-spec]` (KVM detail, academic results) | 20 — #5, #6, #20, #21, #22, #27, #38, #39, #42, #44, #45, #47, #99–#106 |
| Anchors made more precise | 1 — #9 gains `[SDM 3C §27.6.2]` and `[SDM 3D App.A.3.3]` |
| Headings / section numbers changed | 0 |
| Claims added or removed | 0 (106 in, 106 out) |

`node tools/lint.mjs intel-vt` → **clean**.
