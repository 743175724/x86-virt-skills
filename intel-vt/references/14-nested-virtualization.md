# 14. Nested Virtualization

> **中文速览**：本章讲清楚"VMX 之上再跑一层 VMM"到底是怎么实现的：L0/L1/L2 模型、vmcs01 / vmcs12 / vmcs02 三份控制结构、VMCS shadowing 的完整规格（影子指示位、VMCS-link 指针、VMREAD/VMWRITE 位图）、vmcs02 的构造与控制项合并规则、嵌套 EPT 以及"EPT violation 该由 L0 处理还是反射给 L1"的判定规则。本章还把嵌套页表遍历的最坏访存次数**推导**出来，而不是抛一个数字。在 Windows PC 上这不是冷门话题：只要开了 VBS、WSL2、Windows Sandbox、Docker Desktop 或 Hyper-V，Hyper-V 就占据了 VMX root operation，Windows 内核本身已经是 guest，其它 VMM 只能经 WHP 以嵌套方式运行——见 §14.12。相邻章节：`02-vmcs.md`（VMCS 字段编码）、`06-address-translation.md`（EPT/VPID 结构）、`07-apic-virtualization.md`（APICv）、`15-security.md`（VBS/HVCI）、`90-dated-landscape.md`（时效性生态信息）。

**Maps to:** Intel SDM Vol.3C (rev 092) has no dedicated nested-virtualization chapter; the normative material is §27.2, §27.4.2, §27.6.15 and §27.10 (shadow VMCSs), §28.1.2 (VMX instructions that always exit), Ch.31 (EPT/VPID) and Vol.3D App.A (VMX capability reporting) [1] [2]
**Owns:** the L0/L1/L2 model · VMCS shadowing · vmcs02 construction, control merging and sync-back · exit reflection · nested EPT (EPT12/EPT02) · nested VPID/INVEPT/INVVPID emulation · the nested page-walk cost derivation
**See also:** `02-vmcs.md` (VMCS region format and field encodings) · `06-address-translation.md` (EPT paging structures, VPID) · `07-apic-virtualization.md` (APICv, posted interrupts) · `08-vmx-instructions.md` (instruction semantics) · `15-security.md` (VBS/HVCI) · `16-performance.md` · `90-dated-landscape.md`

---

## 14.1 Why nesting is trap-and-emulate

Intel 64 defines exactly two VMX modes — VMX root operation and VMX non-root operation — and one processor is in one of them at a time. There is no third privilege level to give a guest hypervisor. Nested virtualization is therefore not a hardware mode: it is the emulation of the whole VMX instruction set and of the VMCS by the one VMM that actually holds VMX root operation.

The standard terminology, used by the Turtles paper and adopted verbatim by the Linux kernel, is three levels:

- **L0** — the hypervisor running on bare metal in VMX root operation.
- **L1** — the guest hypervisor, itself a VM of L0.
- **L2** — the nested guest that L1 believes it is running.

- **Claim.** In nested virtualization there are three levels: the host hypervisor L0, the guest hypervisor L1, and its nested guest L2; only L0 ever executes in VMX root operation, so every VM exit taken by L2 is delivered to L0.  `[SDM 3C §26.3]` `[1]` `[300]` `C:high` `V:durable`

  > "Single-level virtualization has two levels — the host (KVM) and the guests. In nested virtualization, we have three levels: The host (KVM), which we call L0, the guest hypervisor, which we call L1, and its nested guest, which we call L2." [300]

- **Claim.** The architecture makes nesting possible because almost the entire VMX instruction set exits unconditionally from VMX non-root operation: CPUID, GETSEC, INVD and XSETBV, plus INVEPT, INVVPID, SEAMCALL, TDCALL, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF and VMXON (see `13-tdx.md` for SEAMCALL and TDCALL).  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`

- **Claim.** VMREAD and VMWRITE are the only VMCS-access instructions that are not on the unconditional-exit list; their behaviour in VMX non-root operation depends on the "VMCS shadowing" VM-execution control, which is what makes the shadow-VMCS optimisation of §14.3 possible.  `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`

- **Claim.** Because L1's own handling of one L2 exit is itself a long sequence of trapping operations, a single L2 VM exit can cascade into 40–50 exits from L1 to L0 — the "exit multiplication" effect that dominates nested overhead.  `[SDM 3C §28.1.2]` `[303]` `C:medium` `V:durable`

- **Claim.** The Turtles project (OSDI '10) was the first complete x86 nested implementation and reported performance within 6–8% of single-level virtualization for common workloads, using multi-dimensional paging for MMU virtualization and multi-level device assignment for I/O.  `[no-spec]` `[302]` `C:medium` `V:durable`

---

## 14.2 Three control structures: vmcs01, vmcs12, vmcs02

L1 thinks it is manipulating a VMCS. It is not: it is manipulating a memory image that L0 interprets. Three structures exist at once.

| Name | Built by | Describes | Loaded by hardware? |
|---|---|---|---|
| `vmcs01` | L0 | how L0 runs L1 | yes, while L1 runs |
| `vmcs12` | L1 | how L1 wants to run L2 | never |
| `vmcs02` | L0 | how L0 actually runs L2 | yes, while L2 runs |

- **Claim.** KVM names the three structures vmcs01 ("the VMCS that L0 built for L1"), vmcs12 ("the VMCS that L1 builds for L2") and vmcs02 ("the VMCS which L0 builds to actually run L2"); the Turtles paper uses the identical names — it writes VMCS01, VMCS12 and VMCS02, not an arrow notation.  `[no-spec]` `[300]` `[302]` `C:high` `V:durable`

- **Claim.** vmcs12 can be an ordinary software structure because the VMCS data format is architecturally implementation-specific — bytes 8 and beyond of a VMCS region hold "VMCS data (implementation-specific format)" and may only be reached through VMREAD/VMWRITE, so L1 cannot depend on any particular layout; see `02-vmcs.md` for the field-encoding scheme.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`

- **Claim.** A VMCS region is up to 4 KBytes, its first 4 bytes hold the VMCS revision identifier in bits 30:0, and VMPTRLD fails if that identifier differs from the one the processor uses — so L0 must hand L1 a revision identifier it is prepared to emulate.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`

---

## 14.3 VMCS shadowing, fully specified

Without help, every VMREAD and VMWRITE that L1 executes traps to L0. L1 executes dozens of them per L2 exit, which is the largest single component of exit multiplication. VMCS shadowing removes those exits by letting the hardware satisfy L1's accesses out of a real VMCS that L1 is allowed to touch while in VMX non-root operation.

### 14.3.1 The control and the shadow-VMCS indicator

- **Claim.** "VMCS shadowing" is a secondary processor-based VM-execution control; it is bit 14 of that 32-bit vector, and software discovers support for its 1-setting by reading the VMX capability MSR IA32_VMX_PROCBASED_CTLS2.  `[SDM 3C §27.6.2]` `[SDM 3C §27.2]` `[SDM 3D App.A.3.3]` `[1]` `[2]` `C:high` `V:durable`

- **Claim.** Every VMCS is either an ordinary VMCS or a shadow VMCS, and the type is carried by the **shadow-VMCS indicator: bit 31 of the first 4 bytes of the VMCS region** — 0 means ordinary, 1 means shadow. Bits 30:0 of the same doubleword are the VMCS revision identifier.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`

  > "Every VMCS is either an ordinary VMCS or a shadow VMCS. A VMCS's type is determined by the shadow-VMCS indicator in the VMCS region (this is the value of bit 31 of the first 4 bytes of the VMCS region; see Table 27-1): 0 indicates an ordinary VMCS, while 1 indicates a shadow VMCS." [1] §27.10

- **Claim.** VMPTRLD fails if the shadow-VMCS indicator is 1 and the processor does not support the 1-setting of the "VMCS shadowing" VM-execution control, and software must VMCLEAR a VMCS before changing its shadow-VMCS indicator, because changing it while the VMCS is active may corrupt it.  `[SDM 3C §27.2]` `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`

- **Claim.** A shadow VMCS differs from an ordinary VMCS in exactly two ways: it can never be used for VM entry (VM entry fails if the current VMCS is a shadow VMCS), and VMREAD/VMWRITE executed in VMX non-root operation can access it.  `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`

### 14.3.2 The VMCS-link pointer

- **Claim.** The VMCS-link pointer is a 64-bit field of the guest-state area (guest non-register state); if the "VMCS shadowing" VM-execution control is 1, VMREAD and VMWRITE access the VMCS referenced by this pointer, and otherwise software should set the field to FFFFFFFF_FFFFFFFFH to avoid VM-entry failures.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`

- **Claim.** When the "VMCS shadowing" VM-execution control is 1, VM entry checks that any VMCS referenced by the VMCS-link pointer is a shadow VMCS; an invalid VMCS-link pointer is one of the enumerated VM-entry failure causes.  `[SDM 3C §27.10]` `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`

- **Claim.** In VMX root operation both ordinary and shadow VMCSs can be accessed with VMREAD and VMWRITE, so L0 reads and writes the shadow VMCS with the same instructions L1 uses — there is no privileged back door and no architecturally defined layout; see `02-vmcs.md`.  `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`

### 14.3.3 The VMREAD-bitmap and VMWRITE-bitmap addresses

- **Claim.** On processors supporting the 1-setting of "VMCS shadowing", the VM-execution control fields include two 64-bit physical addresses, the VMREAD-bitmap address and the VMWRITE-bitmap address; each bitmap is 4 KBytes in size and therefore contains 32 KBits (see `02-vmcs.md` for the encodings of the two address fields).  `[SDM 3C §27.6.15]` `[1]` `C:high` `V:durable`

  > "On processors that support the 1-setting of the 'VMCS shadowing' VM-execution control, the VM-execution control fields include the 64-bit physical addresses of the VMREAD bitmap and the VMWRITE bitmap. Each bitmap is 4 KBytes in size and thus contains 32 KBits." [1] §27.6.15

- **Claim.** VMREAD in VMX non-root operation causes a VM exit if the "VMCS shadowing" control is 0, **or** the source operand sets any bit in the range 63:15, **or** the VMREAD bit corresponding to bits 14:0 of the source operand is 1; otherwise the instruction reads the VMCS referenced by the VMCS-link pointer. VMWRITE is symmetric with the VMWRITE bitmap.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

- **Claim.** The bit is located arithmetically: letting x be bits 14:0 of the operand and addr the bitmap address, the corresponding bit is bit position x & 7 of the byte at physical address addr | (x >> 3).  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

- **Claim.** The bitmaps are therefore a per-field intercept policy: L0 clears a bit for every field it is willing to let L1 read or write directly out of the shadow VMCS, and sets a bit for every field whose access it must still emulate; because encodings with any bit set in 63:15 always exit, only the low 32K of the encoding space can ever be shadowed.  `[SDM 3C §27.6.15]` `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

- **Claim.** KVM builds these bitmaps at module init from two tables of field encodings — the read-only shadow fields and the read/write shadow fields — and clears the corresponding bitmap bits only for fields in those tables, leaving everything else intercepted (`init_vmcs_shadow_fields()` memsets both bitmaps to 0xFF first).  `[no-spec]` `[301]` `C:medium` `V:durable`

### 14.3.4 Shadow ↔ vmcs12 synchronisation rules

The shadow VMCS is hardware-format memory; vmcs12 is L0's software image of L1's intent. They must be reconciled at every transition where either side could have changed.

- **Claim.** Before L0 resumes L1 with shadowing enabled, L0 copies the shadowed fields from vmcs12 into the shadow VMCS, so that L1's subsequent VMREADs observe the state L0 believes it has; KVM performs this in `copy_vmcs12_to_shadow()`.  `[no-spec]` `[301]` `C:high` `V:durable`

- **Claim.** When L1 next exits to L0, L0 copies the writable shadowed fields back out of the shadow VMCS into vmcs12 before interpreting L1's intent; KVM performs this in `copy_shadow_to_vmcs12()`, whose comment reads "Copy the writable VMCS shadow fields back to the VMCS12, in case they have been modified by the L1 guest."  `[no-spec]` `[301]` `C:high` `V:durable`

- **Claim.** Fields that are not shadowed keep trapping, so L0 sees those writes immediately and no synchronisation is needed for them; the shadow set is consequently chosen as the fields L1 touches most often per L2 exit, not as "all fields".  `[SDM 3C §27.6.15]` `[301]` `[303]` `C:medium` `V:durable`

- **Claim.** The shadow VMCS belongs to the VMCS-link pointer of **vmcs01** (the VMCS that runs L1); it is not vmcs02 and is never entered.  `[SDM 3C §27.4.2]` `[SDM 3C §27.10]` `[1]` `[301]` `C:high` `V:durable`

---

## 14.4 Constructing vmcs02

vmcs02 is a merge. Its host-state area must be L0's, because a real VM exit from L2 must land in L0; its guest-state area must be L1's picture of L2; and its controls must satisfy L0 and L1 simultaneously.

### 14.4.1 State merging

- **Claim.** The host-state area of vmcs02 is taken from vmcs01: the processor loads host state from the current VMCS on every VM exit, so L2's exits must load L0's host state, never L1's.  `[SDM 3C §27.5]` `[SDM 3C Ch.30]` `[1]` `[300]` `C:high` `V:durable`

- **Claim.** The guest-state area of vmcs02 is taken from vmcs12 — L1's chosen register and non-register state for L2 — with L0 overriding the fields it owns, including the VMCS-link pointer, and with the guest-state checks of VM entry then applying to the merged result.  `[SDM 3C §27.4]` `[SDM 3C Ch.29]` `[1]` `[300]` `C:high` `V:durable`

- **Claim.** KVM splits the merge into a rarely changing part and a per-entry part: `prepare_vmcs02_early()` establishes the controls and the fields derived from vmcs01, and `prepare_vmcs02()` completes the guest state from vmcs12 before VMLAUNCH/VMRESUME of L2.  `[no-spec]` `[301]` `C:high` `V:durable`

### 14.4.2 Control merging

The merging rule is not uniform. For intercepts, L0 needs the **union** (anything either level wants to trap must trap, because only L0 can catch it). For permissions, L0 needs the **intersection** (a bypass is safe only if both levels allow it).

- **Claim.** Exception bitmap: vmcs02's exception bitmap is the union of vmcs01's and vmcs12's, because an exception either level wants to intercept has to cause a real VM exit to L0 first; see `02-vmcs.md` for the bitmap field itself.  `[SDM 3C §27.6.3]` `[1]` `[301]` `C:high` `V:durable`

- **Claim.** Page faults are the awkward case: there is a single page-fault error-code mask and match pair in the VMCS, so when L0 and L1 want different #PF intercept policies L0 cannot express both at once and must fall back to intercepting all page faults and filtering them in software; see `02-vmcs.md` for the mask/match semantics.  `[SDM 3C §27.6.3]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** MSR bitmaps: an MSR may be passed through to L2 only if **both** vmcs01 and vmcs12 permit it, so the merged bitmap is the intersection of the two pass-through sets — equivalently the union of the two intercept sets; if L1 does not use MSR bitmaps at all, L0 must intercept every MSR access.  `[SDM 3C §27.6.9]` `[1]` `[301]` `C:high` `V:durable`

- **Claim.** I/O: rather than merge the two I/O bitmaps A and B — each 4 KBytes, 8 KBytes in total, covering ports 0000H–7FFFH and 8000H–FFFFH — KVM sets unconditional I/O exiting in vmcs02 and clears "use I/O bitmaps", then consults vmcs12's I/O bitmap in software to decide whether the exit belongs to L1; see `02-vmcs.md` for the I/O-bitmap fields.  `[SDM 3C §27.6.4]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** Pin-based controls are unioned, with the VMX-preemption timer treated specially (§14.9): L0 must keep its own external-interrupt and NMI exiting regardless of what L1 asked for, because host interrupts must reach L0.  `[SDM 3C §27.6.1]` `[1]` `[301]` `C:high` `V:durable`

- **Claim.** Processor-based controls split into two groups: "exiting" controls are unioned with vmcs12's, while the controls that select L0's own mechanisms — enable EPT, enable VPID, unrestricted guest, and the secondary controls behind them — are set from L0's configuration and are not simply copied from vmcs12; see `02-vmcs.md`.  `[SDM 3C §27.6.2]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** Time-stamp counter offsets compose additively: with no TSC scaling in play the offset programmed in vmcs02 is the sum of L0's offset for L1 and the offset L1 programmed for L2, so that L2 sees both adjustments; when TSC scaling is active the two multipliers compose multiplicatively and L0's offset is first scaled by L1's multiplier before the two offsets are added.  `[SDM 3C §27.6.5]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** CR0 and CR4 guest/host masks are unioned — a bit owned by either level must trap — while the read shadows are composed so that L2 observes the value L1 intends it to observe.  `[SDM 3C §27.6.6]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** The EPTP in vmcs02 always points at an EPT structure that L0 controls (EPT02, §14.6); L1's EPTP value from vmcs12 is data to be interpreted, never a pointer the hardware is allowed to load.  `[SDM 3C §27.6.11]` `[1]` `[301]` `C:high` `V:durable`

### 14.4.3 Sync-back on an L2 exit

- **Claim.** On a VM exit from L2, the processor writes guest state and VM-exit information into vmcs02; if the exit is to be reflected, L0 must copy the affected state into vmcs12 so that L1's VMREADs see a coherent picture. KVM does this in `sync_vmcs02_to_vmcs12()`, called from `__nested_vmx_vmexit()`, and it covers fields that are only modified after L2 runs, such as the VMX-preemption timer value.  `[SDM 3C Ch.30]` `[301]` `C:high` `V:durable`

- **Claim.** Rarely read fields are synchronised lazily rather than on every exit, which is why KVM separates a "rare" sync path; combined with VMCS shadowing this keeps the per-exit copying proportional to what L1 actually reads (`sync_vmcs02_to_vmcs12_rare()`, gated on `need_sync_vmcs02_to_vmcs12_rare`).  `[no-spec]` `[301]` `[304]` `C:medium` `V:durable`

- **Claim.** Nested state that lives outside any hardware VMCS — the current vmcs12, the shadow VMCS contents and L0's nesting bookkeeping — must be saved and restored explicitly for a VM with nesting enabled to be migrated or snapshotted; the kernel exposes this as `KVM_CAP_NESTED_STATE` with `KVM_GET_NESTED_STATE` / `KVM_SET_NESTED_STATE`.  `[no-spec]` `[318]` `C:high` `V:durable`

### 14.4.4 How a bad merge fails

A merge bug does not usually produce a subtle misbehaviour; it produces one of three loud failures, and knowing which one is which is most of the diagnosis.

- **Claim.** If the merged controls are not a legal combination, VM entry of L2 fails during the checks on VM-execution, VM-exit and VM-entry control fields, and control falls through to the instruction after VMLAUNCH/VMRESUME with the failure recorded in the VM-instruction error field — see `08-vmx-instructions.md` for the error numbers and `04-vm-entry.md` for the check order.  `[SDM 3C Ch.29]` `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

- **Claim.** If the merged guest state is illegal, the failure is a VM exit rather than a fall-through — the exit reason has bit 31 set to indicate a VM-entry failure — so L0 must be able to distinguish "L1 gave me a bad vmcs12" (reflect a VM-entry failure to L1) from "I merged it wrongly" (an L0 bug); see `04-vm-entry.md`.  `[SDM 3C Ch.29]` `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`

- **Claim.** If the merge is legal but too permissive, nothing fails: L2 simply gets a capability L1 never granted it, which is the security-relevant failure mode and the reason the intercept merge is a union rather than a copy.  `[no-spec]` `[301]` `C:medium` `V:durable`

---

## 14.5 Exit reflection: L0 or L1?

Every L2 exit lands in L0. L0 then decides between two outcomes: handle it silently and resume L2, or synthesise a virtual VM exit into L1.

- **Claim.** Reflecting an exit to L1 means writing the VM-exit information fields of vmcs12 (exit reason, exit qualification, and the relevant event and instruction-information fields) and then performing a virtual VM exit: loading L1's state from vmcs12's host-state area and resuming L1 as if the hardware had exited to it; see `05-vm-exit.md` for the information fields themselves.  `[SDM 3C §27.9]` `[SDM 3C §30.5]` `[1]` `[300]` `C:high` `V:durable`

- **Claim.** The decision is a two-question test in KVM: does L0 itself need this exit (its own intercepts, shadow-structure maintenance, host interrupts, emulation), and does L1's vmcs12 configuration ask for it? These are the `nested_vmx_l0_wants_exit()` and `nested_vmx_l1_wants_exit()` predicates consulted by `nested_vmx_reflect_vmexit()`, in that order — L0's need trumps L1's.  `[no-spec]` `[301]` `C:medium` `V:durable`

- **Claim.** An exit caused purely by L0's own bookkeeping — for example a missing entry in a structure L1 cannot see — is never visible to L1: L0 fixes the structure and re-enters L2 directly, which is why L1 cannot count exits to detect that it is nested with any reliability.  `[no-spec]` `[301]` `[302]` `C:medium` `V:durable`

### 14.5.1 Life of an L2 VM exit

Putting §14.3 to §14.5 together, one reflected exit runs as follows:

1. L2 executes something vmcs02 intercepts. The processor performs a VM exit, saves L2 state into vmcs02's guest-state area, records the exit reason and qualification in vmcs02's VM-exit information fields, and loads **L0's** host state from vmcs02's host-state area.
2. L0 runs. It reads the exit reason from vmcs02 and asks the two ownership questions of §14.5.
3. If L0 owns the exit, it handles it — fills an EPT02 entry, services a host interrupt, emulates an instruction — and re-enters L2 with VMRESUME on vmcs02. L1 observes nothing.
4. If L1 owns the exit, L0 copies the relevant L2 state out of vmcs02 into vmcs12's guest-state area and writes vmcs12's VM-exit information fields, translating anything that is expressed in L0 terms into L1 terms (a host-physical address becomes an L1-guest-physical address, an L0 vector becomes an L1 vector).
5. L0 then performs the *virtual* VM exit: it loads L1's state from vmcs12's host-state area into vmcs01's guest-state area, refreshes the shadow VMCS from vmcs12 so L1's VMREADs see the new exit information, and enters L1 with VMRESUME on vmcs01.
6. L1 runs its exit handler, reading and writing what it believes is its VMCS — most of those accesses are satisfied by hardware out of the shadow VMCS, with no exit.
7. L1 finishes with VMRESUME, which exits unconditionally to L0.
8. L0 pulls the writable shadow fields back into vmcs12, re-merges vmcs02, and enters L2 again.

- **Claim.** The virtual VM exit is a software construction: nothing in the architecture performs it, so every field L1 can observe after an exit — guest state, exit reason, exit qualification, event information — exists in vmcs12 only because L0 wrote it there.  `[SDM 3C §27.9]` `[SDM 3C §30.3]` `[1]` `[300]` `C:high` `V:durable`

- **Claim.** Steps 4 and 5 are where correctness bugs concentrate, because they are the only place where values must be translated between L0's and L1's frames of reference rather than copied; the recurring nested-EPT exit-qualification corrections are exactly this class of bug.  `[no-spec]` `[301]` `[319]` `C:medium` `V:durable`

---

## 14.6 Nested EPT: EPT12, EPT02 and the reflection rule

With three levels there are three address spaces to compose: L2-guest-physical → L1-guest-physical → host-physical. Hardware offers only one level of EPT, so the composition happens in software.

| Name | Built by | Maps |
|---|---|---|
| EPT01 | L0 | L1-guest-physical → host-physical |
| EPT12 | L1 | L2-guest-physical → L1-guest-physical |
| EPT02 | L0 | L2-guest-physical → host-physical |

- **Claim.** 4-level EPT accesses at most 4 EPT paging-structure entries to translate a guest-physical address; the page-walk length is configured in EPTP bits 5:3 as one less than the walk length, so 3 selects 4-level EPT and 4 selects 5-level EPT; see `06-address-translation.md` for the entry formats.  `[SDM 3C §31.3.2]` `[1]` `C:high` `V:durable`

- **Claim.** L0 loads EPT02 — the functional composition of EPT12 and EPT01 — in vmcs02, so that the hardware performs a normal two-dimensional walk while L2 runs; this is the "multi-dimensional paging" of the Turtles paper, which multiplexes the third translation into the two dimensions the hardware provides.  `[SDM 3C §31.3.2]` `[1]` `[302]` `C:high` `V:durable`

- **Claim.** EPT02 is a shadow: it is populated on demand from EPT12 and EPT01, and it must be invalidated whenever L1 modifies EPT12 (observed through L1's INVEPT, §14.8) or whenever L0's own mapping of L1 memory changes.  `[SDM 3C §31.4.3]` `[1]` `[301]` `C:high` `V:durable`

- **Claim.** If L1 does not enable EPT for L2, there is no EPT12: L2-guest-physical equals L1-guest-physical, EPT02 degenerates to EPT01, and L0 must instead shadow L2's own guest paging structures — the slow path that nested EPT exists to avoid.  `[SDM 3C §31.3.1]` `[1]` `[300]` `C:medium` `V:durable`

### 14.6.1 The decision rule for an EPT violation under L2

This is the practical crux of nested memory virtualization, and it is a three-step rule:

1. **The exit always goes to L0 first.** Only L0 is in VMX root operation, and EPT violations are reported against the EPT structure the hardware loaded, which is EPT02.
2. **L0 walks EPT12 for the faulting L2-guest-physical address.** If EPT12 has no valid entry for that address, or its permissions do not allow the access type that faulted, the fault is L1's to handle: L0 synthesises an EPT violation into vmcs12 and reflects it.
3. **Otherwise the fault is L0's own shadowing artefact.** EPT12 permits the access but EPT02 lacked the mapping, or L0's own backing of the page needs work. L0 resolves it, installs or updates the EPT02 entry, and re-enters L2 with no L1 involvement.

- **Claim.** An EPT violation taken while L2 runs is delivered to L0, which decides ownership by consulting EPT12: if the nested MMU finds the address missing in EPT12, the EPT violation is injected into L1 (KVM's `nested_ept_inject_page_fault()`), and otherwise L0 fixes EPT02 and resumes L2 without L1 ever seeing the fault.  `[SDM 3C §31.3.3.2]` `[1]` `[301]` `C:high` `V:durable`

- **Claim.** When L0 reflects the violation it must also synthesise the exit qualification and the guest-physical / guest-linear address fields that L1 will read, and getting the guest-linear-address validity bits right depends on whether the fault came from a hardware EPT-violation exit or from L0's instruction emulation — a distinction KVM has had to correct repeatedly; see `05-vm-exit.md` for the qualification layout.  `[SDM 3C §31.3.3.2]` `[SDM 3C §27.9.1]` `[1]` `[319]` `C:medium` `V:durable`

- **Claim.** EPT misconfigurations follow the same ownership logic but with a different trigger: a misconfiguration reflects an illegal entry, so L0 must determine whether the illegal entry is one L1 wrote into EPT12 (reflect) or one L0 constructed in EPT02 (a bug in L0); see `06-address-translation.md`.  `[SDM 3C §31.3.3.1]` `[1]` `C:medium` `V:durable`

- **Claim.** The same ownership question arises for accesses to L1's emulated MMIO regions: an EPT02 entry deliberately left non-present so that L0 traps the access must be distinguished from a genuine EPT12 fault before anything is reflected.  `[SDM 3C §31.3.3.2]` `[1]` `[301]` `C:medium` `V:durable`

### 14.6.2 Nested VM functions and virtualization exceptions

Two EPT-adjacent features let a guest change or absorb EPT behaviour *without* exiting, which is precisely what makes them awkward to nest: the mechanism that removes the exit also removes L0's opportunity to intervene.

- **Claim.** EPTP switching is VM function 0: software in VMX non-root operation selects an entry from the EPTP list — a 4-KByte structure of 512 8-byte entries named by the EPTP-list address — using ECX, and VMFUNC causes a VM exit if ECX ≥ 512 or if the selected value is not valid for switching, where valid requires the same EPT page-walk length in bits 5:3 and a value that would not cause VM entry to fail.  `[SDM 3C §28.5.7.3]` `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`

- **Claim.** On success the selected value is written into the EPTP field of the **current VMCS** and used for subsequent guest-physical translation; under nesting the current VMCS is vmcs02, so a VMFUNC issued by L2 would install an L1-chosen EPTP into a VMCS that only L0 may populate.  `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`

- **Claim.** L0 therefore has two consistent choices and no third: leave the VM-function controls clear in vmcs02 so that L2's VMFUNC exits and is emulated, or pre-compose an EPTP list of L0-built EPT02 hierarchies corresponding one-for-one to L1's list, so that the hardware switch lands on a shadow L0 already trusts.  `[SDM 3C §28.5.7.3]` `[SDM 3C §27.6.14]` `[1]` `C:medium` `V:durable`

- **Claim.** Virtualization exceptions are the symmetric case: if the "EPT-violation #VE" VM-execution control is 1, certain EPT violations are converted into a #VE delivered to the guest instead of a VM exit, and convertibility is controlled per entry by bit 63 of an EPT paging-structure entry (suppress #VE); see `06-address-translation.md`.  `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`

- **Claim.** A converted #VE is not a VM exit, so L0 never sees it: L0 may only enable conversion in vmcs02 for faults it is content to hand straight to L2, and must keep the suppress-#VE bit set in every EPT02 entry whose faults it needs to arbitrate under §14.6.1.  `[SDM 3C §28.5.8.1]` `[1]` `C:medium` `V:durable`

---

## 14.7 Deriving the nested page-walk cost

The single-level figure is well known but usually quoted without its derivation, and the nested figure is usually not quoted at all. Both follow from one rule: **every address a walk produces at level k is a "physical" address only in the next dimension's terms, so it must itself be translated.**

### 14.7.1 Single level: 24 accesses

With 4-level guest paging over 4-level EPT:

- The guest walk needs 5 guest-physical addresses translated: the one in CR3, and the four addresses produced by reading the guest PML4E, PDPTE, PDE and PTE. (The fifth is the final data address.)
- Each guest-physical address costs a full 4-entry EPT walk: 5 × 4 = **20 EPT paging-structure accesses**.
- Reading the four guest paging-structure entries themselves costs **4 accesses**.
- Total 20 + 4 = **24 memory accesses** for one TLB miss, against 4 on bare metal.

The same result falls out of the closed form (L + 1)² − 1 with L = 4: 25 − 1 = 24.

- **Claim.** The worst-case two-dimensional page walk for 4-level guest paging over 4-level EPT is **24 memory accesses**, not 20: 4 guest paging-structure reads plus 4 EPT walks of 4 accesses each for the guest-physical addresses, plus the 4-access EPT walk of the final guest-physical address. The "20" figure counts only the EPT reads.  `[SDM 3C §31.3.2]` `[1]` `[310]` `C:high` `V:durable`

### 14.7.2 Nested: the 124-access walk that hardware never performs

Add a third dimension (L2-guest-virtual → L2-guest-physical → L1-guest-physical → host-physical), each 4 levels deep, and apply the same rule:

- The L2 guest walk produces 5 L2-guest-physical addresses.
- Each of those, translated through a 4-level EPT12, produces 5 L1-guest-physical addresses (4 EPT12 entry reads plus the result), so 5 × 5 = 25 L1-guest-physical addresses.
- Each of those, translated through a 4-level EPT01, costs up to 5 host accesses: 25 × 5 = 125.
- The final one of those 125 is the data access itself, so the walk proper is **124 memory accesses** — the closed form (L + 1)³ − 1 = 5³ − 1.

- **Claim.** A literal three-dimensional walk with 4-level paging at each level would cost (4 + 1)³ − 1 = **124 memory accesses** per TLB miss, which is why no x86 implementation provides a third translation dimension and why L0 collapses the third dimension into EPT02 in software.  `[SDM 3C §31.3.2]` `[1]` `[302]` `C:medium` `V:durable`

### 14.7.3 What L2 actually pays

- **Claim.** Because L2 runs on EPT02, an L2 TLB miss that hits in EPT02 costs the same **24** accesses as single-level virtualization; the nested penalty is not in the successful walk but in the EPT02 fill path.  `[SDM 3C §31.3.2]` `[1]` `[302]` `C:medium` `V:durable`

- **Claim.** Each EPT02 fill costs a VM exit to L0 plus a software walk of EPT12 — up to 4 EPT12 entry reads, each of them an access to L1-guest-physical memory that L0 must itself resolve — so the marginal cost of a nested fault is an exit plus roughly 4 × 5 = 20 further accesses, rather than the 124 of a hypothetical hardware 3D walk.  `[SDM 3C §31.3.2]` `[SDM 3C §31.3.3.2]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** Large pages shorten every dimension of this arithmetic simultaneously: a 2-MByte mapping removes one level from the guest walk and one from each EPT walk it participates in, which is why huge pages matter more under nesting than under single-level virtualization.  `[SDM 3C §31.3.2]` `[1]` `[310]` `C:medium` `V:durable`

---

## 14.8 Nested VPID, INVEPT and INVVPID

- **Claim.** INVEPT and INVVPID cause VM exits unconditionally in VMX non-root operation, so L1 can never invalidate real hardware caching itself — every invalidation L1 requests is an emulation request to L0.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`

- **Claim.** INVEPT supports two invalidation types, single-context (1) and all-context (2), and INVVPID supports four: individual-address (0), single-context (1), all-context (2) and single-context-retaining-globals (3); supported types are reported in IA32_VMX_EPT_VPID_CAP; see `06-address-translation.md` and `08-vmx-instructions.md`.  `[SDM 3C Ch.33]` `[SDM 3D App.A]` `[1]` `[2]` `C:high` `V:durable`

- **Claim.** L0 emulates L1's INVEPT by mapping the EPTP operand in the descriptor onto the EPT02 it derived from that EPTP12 and invalidating the corresponding derived mappings; an all-context INVEPT from L1 must invalidate every EPT02 L0 built for that L1.  `[SDM 3C §31.4.3.4]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** VPIDs are a flat 16-bit tag space owned by L0, so L1's VPIDs are virtual: L0 allocates a distinct host VPID for L2 (KVM calls it vpid02) and translates L1's INVVPID descriptors onto it, so that L1 and L2 translations are tagged apart and a transition between them need not flush; see `06-address-translation.md` for the VPID field.  `[SDM 3C §27.6.12]` `[SDM 3C §31.1]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** If L0 cannot give L2 its own VPID — VPID support disabled, or the tag space exhausted — correctness is preserved by flushing on every nested transition, which is a real performance cliff rather than a functional failure.  `[SDM 3C §31.4.3.3]` `[1]` `[301]` `C:medium` `V:durable`

---

## 14.9 The VMX-preemption timer under nesting

- **Claim.** If VM entry was performed with the 1-setting of the "activate VMX-preemption timer" VM-execution control, the timer counts down in VMX non-root operation and causes a VM exit at zero; it decrements by 1 each time bit X of the TSC changes, where X is in the range 0–31 and is reported by IA32_VMX_MISC.  `[SDM 3C §28.5.1]` `[SDM 3D App.A]` `[1]` `[2]` `C:high` `V:durable`

- **Claim.** There is one timer per logical processor, so when both L0 and L1 want one L0 must arm vmcs02's timer with the smaller of the two remaining deadlines and, on expiry, decide whether the deadline was its own or L1's.  `[SDM 3C §28.5.1]` `[1]` `[301]` `C:medium` `V:durable`

- **Claim.** The timer value is guest non-register state that the processor updates only while the guest runs, so it is one of the fields L0 must read out of vmcs02 and write back into vmcs12 on the sync-back path of §14.4.3 when the "save VMX-preemption timer value" VM-exit control is set.  `[SDM 3C §27.4.2]` `[SDM 3C §27.7]` `[1]` `[301]` `C:medium` `V:durable`

---

## 14.10 Nested APICv and posted interrupts

- **Claim.** APIC virtualization is configured by VM-execution controls and by the virtual-APIC address, and virtual-interrupt delivery evaluates and delivers interrupts in non-root operation without a VM exit; the mechanism is owned by `07-apic-virtualization.md` — see that chapter for the register set and the descriptor format.  `[SDM 3C §27.6.8]` `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

- **Claim.** Nesting APICv is hard because the hardware evaluates virtual interrupts against the virtual-APIC page named in the currently loaded VMCS: to let L1 believe it owns APICv, L0 must either emulate L1's virtualized-APIC state in software or compose L1's virtual-APIC page into vmcs02, and posted-interrupt notification vectors must be demultiplexed between L0's own use and L1's — see `07-apic-virtualization.md`.  `[SDM 3C §27.6.8]` `[1]` `[301]` `[304]` `C:medium` `V:durable`

- **Claim.** The conservative fallback, taken by hypervisors for years, is simply not to expose APICv to L1: L1 then uses the legacy virtual-APIC path and every L2 interrupt costs exits, which is correct but slow.  `[SDM 3C §27.6.8]` `[1]` `[304]` `[320]` `C:medium` `V:durable`

- **Claim.** On Windows hosts the same constraint shows up as a feature-exposure decision rather than a tunable: the set of virtualization features a nested Hyper-V guest sees is fixed by the host's exposure policy, and features the host hypervisor does not project are simply absent from the L1 guest.  `[no-spec]` `[311]` `[316]` `C:medium` `V:durable`

---

## 14.11 The VMX capability MSRs L0 must synthesise

L1 does not discover the hardware. It discovers what L0 tells it the hardware is.

- **Claim.** The VMX capability MSRs occupy a contiguous block of architectural MSR addresses: IA32_VMX_BASIC at 480H, IA32_VMX_PINBASED_CTLS at 481H, IA32_VMX_PROCBASED_CTLS at 482H, IA32_VMX_EXIT_CTLS at 483H, IA32_VMX_ENTRY_CTLS at 484H, IA32_VMX_MISC at 485H, the CR0/CR4 FIXED0/FIXED1 pairs at 486H–489H, IA32_VMX_VMCS_ENUM at 48AH, IA32_VMX_PROCBASED_CTLS2 at 48BH, IA32_VMX_EPT_VPID_CAP at 48CH, the TRUE_* controls at 48DH–490H, IA32_VMX_VMFUNC at 491H, IA32_VMX_PROCBASED_CTLS3 at 492H and IA32_VMX_EXIT_CTLS2 at 493H.  `[SDM 4 §2.1]` `[SDM 3D App.A]` `[5]` `[2]` `C:high` `V:durable`

- **Claim.** RDMSR and WRMSR of these addresses from L1 either exit via the MSR bitmap or are intercepted outright, so L0 returns synthesised values describing only the subset of VMX it is prepared to emulate; exposing a control L0 cannot emulate is a correctness bug, not merely a performance one.  `[SDM 3C §27.6.9]` `[SDM 3D App.A]` `[1]` `[2]` `[301]` `C:medium` `V:durable`

- **Claim.** The synthesised values must respect the architecture's reserved-bit discipline: the allowed-0 and allowed-1 settings reported in the capability MSRs, and the TRUE_* variants whose availability is itself reported by IA32_VMX_BASIC, define which control bits L1 may legally clear or set; see `02-vmcs.md` and `04-vm-entry.md`.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

- **Claim.** L1 must also be given a consistent VMX discovery path below the capability MSRs: the CPUID feature bit for VMX and the enable/lock bits of IA32_FEATURE_CONTROL, without which L1's VMXON fails before any VMCS is ever built.  `[SDM 3C §26.6]` `[SDM 3C §26.7]` `[1]` `C:high` `V:durable`

- **Claim.** Because the capability MSRs are part of the guest-visible CPU model, they must be stable across a save/restore or migration of L1 — which is the other half of the nested-state problem of §14.4.3.  `[SDM 3D App.A]` `[2]` `[318]` `C:medium` `V:durable`

---

## 14.12 Nested VMX on a Windows PC

On a Windows machine nested VMX is not an exotic server configuration. It is the ordinary state of the system as soon as any virtualization-dependent Windows feature is switched on.

### 14.12.1 Hyper-V owns VMX root operation

- **Claim.** VMXON causes a VM exit unconditionally in VMX non-root operation, so the first hypervisor to enter VMX root operation owns it: once the Windows hypervisor is running, the Windows kernel itself executes as a guest and any other VMM on the machine is by definition nested.  `[SDM 3C §28.1.2]` `[1]` `[315]` `C:high` `V:durable`

- **Claim.** Enabling VBS, WSL2, Windows Sandbox, Docker Desktop's Hyper-V backend or the Hyper-V role all start the Windows hypervisor; Microsoft's stated reason is that "only one software component at a time can use this hardware", so third-party virtualization applications "such as VMware and VirtualBox" cannot then drive the extensions directly and either fail to start VMs or fall back to a slower emulated mode; see `15-security.md` for the VBS side.  `[no-spec]` `[315]` `[323]` `[474]` `[475]` `[481]` `C:high` `V:durable`

- **Claim.** The Windows Hypervisor Platform (WHP) is the user-mode API — `WinHvPlatform.dll` in System32, headers in the Windows SDK — that lets a third-party virtualization stack create partitions (`WHvCreatePartition`), map guest-physical memory (`WHvMapGpaRange`) and create and run virtual processors (`WHvCreateVirtualProcessor`, `WHvRunVirtualProcessor`) on the Windows hypervisor instead of on the bare hardware; which products use it is ecosystem information and belongs to `90-dated-landscape.md`.  `[no-spec]` `[314]` `[465]` `C:high` `V:durable`

- **Claim.** A VMM reached through WHP is not executing VMXON itself: the exit multiplication and merging costs of §14.1 and §14.4 are paid by the Windows hypervisor on its behalf, which is the architectural reason such configurations are slower than the same VMM on a machine with no hypervisor loaded.  `[no-spec]` `[314]` `C:medium` `V:durable`

### 14.12.2 Exposing VMX to a Hyper-V guest

- **Claim.** Hyper-V exposes the virtualization extensions to a guest VM — making that guest an L1 — with `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`, which Microsoft documents must be issued "while the virtual machine is in the OFF state"; `$false` disables it again, also only on a stopped VM.  `[no-spec]` `[311]` `[313]` `[479]` `C:high` `V:durable`

- **Claim.** With the extensions exposed, the L1 guest sees the VMX feature bit, the capability MSRs of §14.11 and enough of the VMX instruction set to run its own hypervisor; Microsoft's Intel-side prerequisite heading reads "Intel processor with VT-x and EPT technology", with a Windows Server 2016 / Windows 10 or later host and VM configuration version 8.0 or higher.  `[SDM 3C §26.6]` `[SDM 3C §31.3]` `[311]` `[479]` `C:high` `V:durable`

- **Claim.** Exposing the extensions is **not** by itself incompatible with dynamic memory or runtime memory resize — Microsoft states that simply enabling nested virtualization has no such effect and that the incompatibility appears only while Hyper-V is actually running inside the VM; once it is running, the VM must be turned off to change its memory assignment, so memory does not fluctuate even when dynamic memory is configured.  `[no-spec]` `[311]` `[312]` `C:high` `V:durable`

  > "When Hyper-V is running inside a virtual machine, the virtual machine must be turned off to adjust its memory. Meaning that even if dynamic memory is enabled, the amount of memory doesn't fluctuate. Simply enabling nested virtualization has no effect on dynamic memory or runtime memory resize. […] The incompatibility only occurs while Hyper-V is running in the VM." [311]

- **Claim.** Live migration of an L1 partition is supported rather than forbidden, but it is not transparent to L1: Microsoft documents that in the case of nested virtualization the L1 hypervisor may need to be aware of migrations, and that it can ask to be notified through the synthetic MSR `HV_X64_MSR_REENLIGHTENMENT_CONTROL` (40000106H), enumerated by the `AccessReenlightenmentControls` privilege. Neither the nested-virtualization page nor the troubleshooting guide states a migration or save/restore prohibition for an L1 VM.  `[no-spec]` `[316]` `[311]` `[312]` `C:medium` `V:durable`

- **Claim.** Hyper-V additionally defines an "enlightened VMCS": a shared-memory structure that an aware L1 uses instead of VMREAD/VMWRITE, which removes the same exits that VMCS shadowing removes but in software and without needing the hardware control of §14.3; each enlightened VMCS is exactly one 4-KByte page, is made current through a field of the virtual-processor assist page rather than by VMPTRLD, and carries a "clean fields" mask telling L0 which parts to reload on a nested VM entry.  `[no-spec]` `[316]` `C:medium` `V:durable`

### 14.12.3 Interaction with VBS and HVCI

- **Claim.** VBS runs the secure kernel at a higher virtual trust level (VTL1) than the normal Windows kernel (VTL0), and each VTL has its own hypervisor-managed guest-physical memory access protections; Microsoft lists Second Level Address Translation — on Intel parts, EPT — among the hardware VBS requires, so a machine with VBS enabled is already using the nested-capable path described in this chapter for its own security architecture; see `15-security.md`, which owns VBS and HVCI.  `[no-spec]` `[323]` `[317]` `[476]` `C:high` `V:durable`

- **Claim.** Because the hypervisor is resident whenever VBS is on, a nested guest on such a machine is L1 to the Windows hypervisor, and the memory its own guests touch is translated through two software-composed dimensions exactly as in §14.6; see `15-security.md` for the security consequences.  `[no-spec]` `[323]` `C:medium` `V:durable`

- **Claim.** VBS and nested exposure are separately configured: turning on nested virtualization for a guest does not turn on VBS inside that guest, and a guest that is to run VBS itself needs both the exposed extensions and its own VBS configuration (see `15-security.md`).  `[no-spec]` `[311]` `[323]` `C:medium` `V:durable`

### 14.12.4 The practical shape of nesting on a Windows PC

- **Claim.** The Windows features that pull the hypervisor in are ordinary desktop features, not server roles: memory integrity and other VBS-dependent protections, WSL2, Windows Sandbox, Docker Desktop's Hyper-V backend, and Hyper-V itself — once any of them is on, the hypervisor is resident even when no virtual machine is running; see `15-security.md`.  `[no-spec]` `[315]` `[323]` `[474]` `[475]` `[481]` `C:high` `V:durable`

- **Claim.** The stack on such a machine is therefore three-deep whenever a second VMM is used: the Windows hypervisor is L0, the Windows kernel and any WHP-hosted VMM sit at L1, and that VMM's guests are L2 — so the merging, reflection and shadow-EPT machinery of §14.4 to §14.6 is on the critical path of an everyday developer workload.  `[no-spec]` `[314]` `[315]` `C:medium` `V:durable`

- **Claim.** Running a hypervisor *inside* a Hyper-V VM is the case that `-ExposeVirtualizationExtensions` enables; it is exactly the three-level L0/L1/L2 stack of §14.1 and adds no further hardware level. Microsoft supports one level of nesting, including in production for Hyper-V on Hyper-V, and the memory restriction of §14.12.2 applies for as long as the inner hypervisor is running.  `[no-spec]` `[311]` `[312]` `C:high` `V:durable`

- **Claim.** The diagnostic consequence is that "VT-x is not available" from a third-party VMM on a Windows PC is normally a statement about who owns VMX root operation, not about firmware: the fix is either to use the platform API or to remove the feature that started the hypervisor.  `[SDM 3C §28.1.2]` `[314]` `[315]` `C:high` `V:durable`

---

## 14.13 Academic lineage

- **Claim.** The Turtles Project (IBM Research – Haifa, OSDI '10) established both the mechanism and the vocabulary used in this chapter — merged VMCSs, multi-dimensional paging, multi-level device assignment — and won the conference's best-paper award.  `[no-spec]` `[302]` `C:medium` `V:durable`

- **Claim.** ELI (ASPLOS '12) attacked the interrupt half of the same problem in software by delivering physical interrupts directly to guests, anticipating the direction later taken in hardware by APIC virtualization and posted interrupts; see `07-apic-virtualization.md`.  `[no-spec]` `[321]` `C:medium` `V:durable`

- **Claim.** Dune (OSDI '12) used VT-x to provide a *process* abstraction rather than a machine abstraction, running ordinary processes in VMX non-root operation so that they could safely use privileged hardware features such as page tables and ring protection.  `[no-spec]` `[305]` `C:medium` `V:durable`

- **Claim.** NEVE (SOSP '17) showed the same overheads on ARM and proposed hardware extensions — logging and deferring hypervisor-instruction traps — reporting up to an order of magnitude improvement over the then-current architecture and directly influencing ARM's nested-virtualization support.  `[no-spec]` `[306]` `C:medium` `V:durable`

- **Claim.** SeKVM (IEEE S&P 2021, with the multiprocessor memory-model extension at SOSP 2021) produced machine-checked proofs for a commodity KVM-derived hypervisor, making the trusted core of the L0 layer a formally verified artefact rather than an assumption.  `[no-spec]` `[322]` `C:medium` `V:durable`

- **Claim.** Out of Hypervisor (OoH) inverted the usual framing: instead of emulating hardware inside a VM so that a hypervisor can run there, expose individual hypervisor-oriented features (PML, SPP, CAT, EPT) to the guest OS so that processes inside a VM can use them.  `[no-spec]` `[307]` `C:medium` `V:durable`

- **Claim.** **Publication-venue correction:** OoH was published at SC '22 (IEEE/ACM Supercomputing, Dallas, November 2022); arXiv:2202.13483 is the February 2022 preprint. The frequent attribution of OoH to SOSP in 2022 is wrong.  `[no-spec]` `[307]` `[308]` `[309]` `C:high` `V:durable`

- **Claim.** **Unresolved conflict in OoH's own reported results (`C:low`).** The arXiv preprint's abstract states that EPML "reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%)", whereas the later write-up reports that EPML speeds up CRIU checkpointing by 13× and Boehm garbage collection by 6× with 16× less overhead on applications. Both figures are reproduced here with their sources; they are not averaged and no choice between them is made.  `[no-spec]` `[307]` `[309]` `C:low` `V:durable`

  > "The results show that EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%) compared to SPML, /proc, and userfaultfd." — arXiv:2202.13483 abstract [307]
  >
  > "EPML speeds up CRIU checkpointing (by 13×) and Boehm garbage collection (by 6×) times compared to SPML, /proc, and userfaultfd while leading to 16× less overhead on applications." — later version of the same work [309]

---

## 14.14 Out of scope for this chapter

- Cloud-provider nested-virtualization support (which instance families expose VMX, when each provider enabled it, which L1 hypervisors are permitted) is time-sensitive and belongs to `90-dated-landscape.md`.
- Distribution and product defaults (whether a given OS ships nesting on or off) likewise belong to `90-dated-landscape.md`.
- VMCS region format and field encodings: `02-vmcs.md`.
- EPT paging-structure entry formats, PML, SPP and VPID semantics: `06-address-translation.md`.
- APICv register virtualization and the posted-interrupt descriptor: `07-apic-virtualization.md`.
- VBS, HVCI, Credential Guard and the security consequences of a resident hypervisor: `15-security.md`.
