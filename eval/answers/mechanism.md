# mechanism answers (24 questions)

Source skill: `C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\` (entry `SKILL.md`).
Routing was recorded from the SKILL.md routing table before any chapter was opened.

---

### vm-entry-check-order
**Routed to:** `04-vm-entry.md` §4.9 (routing row: "VM-entry checks, **why VM entry failed**, event injection")
**Actually answered from:** `references/04-vm-entry.md` §4.1, §4.2, §4.3, §4.4, §4.5, §4.6, §4.7, §4.8, §4.9, §4.10
**Answer:**
A VM entry is not a jump. It is a fixed, ordered sequence of architecturally specified checks followed by a bulk state load. The SDM's ordered stages, as the chapter gives them, are:

1. **Basic checks on the instruction and the current VMCS.** VMLAUNCH/VMRESUME #UD outside VMX operation, in real-address mode, in virtual-8086 mode or in compatibility mode (IA32_EFER.LMA=1 with CS.L=0); #GP(0) at CPL>0. If the current-VMCS pointer is FFFFFFFF_FFFFFFFFH there is no VMCS to record an error in, so the failure is VMfailInvalid. VMLAUNCH fails (error 4) if the launch state is not "clear"; VMRESUME fails (error 5) if it is not "launched". Entry fails with error 26 if there is blocking by MOV SS at the time the instruction executes. Entry also fails if the current VMCS is a shadow VMCS.
2. **Stage 2a — checks on the VMX controls.** Every control-field failure here is VM-instruction error 7, "VM entry with invalid control field(s)". This covers reserved-bit settings against the capability MSRs (bits 31:0 = allowed-0, bits 63:32 = allowed-1), the secondary controls (checked only when primary bit 31 is 1), the tertiary controls (checked against IA32_VMX_PROCBASED_CTLS3, allowed-1 only), and the dependency lattice: NMI exiting / virtual NMIs / NMI-window exiting; CR3-target count ≤ 4; alignment and physical-address-width limits on the I/O bitmaps, MSR bitmap, virtual-APIC address, APIC-access address, PML address, EPTP-list address, VMREAD/VMWRITE bitmaps, virtualization-exception information address, sub-page-permission-table pointer; "virtualize x2APIC mode" and "virtualize APIC accesses" not both 1; virtual-interrupt delivery requires external-interrupt exiting; process posted interrupts requires virtual-interrupt delivery + acknowledge-interrupt-on-exit + NV bits 15:8 = 0 + a 64-byte-aligned descriptor; VPID must not be 0000H when enable VPID is 1; EPTP memory type/walk length/A-D bit/reserved-bit checks; unrestricted guest requires enable EPT; enable PML requires enable EPT. VM-exit control checks (save-preemption-timer requires the timer activated; MSR-store/MSR-load list 16-byte alignment and end-of-list within PA width) and VM-entry control checks (MSR-load list alignment; "entry to SMM" and "deactivate dual-monitor treatment" not both 1) are in the same stage and also give error 7. The checks on the VM-entry interruption-information field are also control checks and also produce error 7.
3. **Stage 2b — checks on the host-state area.** Failure here is VM-instruction error 8, "VM entry with invalid host-state field(s)": host CR0/CR4 against the FIXED0/FIXED1 MSRs (no unrestricted-guest relaxation on the host side), host CR3 within PA width, canonical SYSENTER_ESP/EIP, PERF_GLOBAL_CTRL reserved bits, IA32_PAT byte encodings, IA32_EFER (LMA must equal "host address-space size"; LME must equal LMA when host CR0.PG=1), host selectors with RPL=0 and TI=0, CS and TR selectors non-zero, canonical FS/GS/GDTR/IDTR/TR bases, and the "host address-space size" consistency set.
4. **Stage 3 — checks on the guest-state area.** CR0/CR3/CR4/DR7/MSRs, segment registers and access rights, descriptor-table registers, RIP/RSP/RFLAGS, non-register state, PDPTEs, and the IA-32e-mode consistency set.
5. **Stage 4 — loading guest state.** CR0/CR3/CR4, DR7 (if "load debug controls"), the controlled MSRs, the segment registers and their hidden parts, GDTR/IDTR, RIP/RSP/RFLAGS; some CR0/CR4 bits come from the read shadow rather than the guest-state area because the guest/host masks make them host-owned. Address-range monitoring is cleared. The VMX-preemption timer is loaded and starts counting. GPRs and x87/SSE/AVX state are *not* in the VMCS and are not loaded.
6. **Stage 5 — loading MSRs from the VM-entry MSR-load area.** 16-byte entries, processed in order as if by WRMSR.
7. **For VMLAUNCH, setting the launch state to "launched".**
8. **Stage 7 — event injection**, if the VM-entry interruption-information field's valid bit (bit 31) is 1. The field is evaluated after guest state and MSRs are loaded and before the first guest instruction executes.

**Why the two different landing points.** The dividing line is exactly whether the entry has already overwritten architectural state.

- Failure of **stage 1 or stage 2** (basic checks, VMX controls, host-state area) means *no VM entry started*. Nothing guest-visible has changed. Control therefore passes to the instruction following VMLAUNCH/VMRESUME with the VMfail flag protocol set: VMfailInvalid is RFLAGS.CF=1 with ZF=0 and no error number recorded (there is no valid current VMCS to store one in); VMfailValid is RFLAGS.ZF=1 with CF=0 and the error number written into the VM-instruction error field.
- Failure of **stage 3 (guest-state checks) or stage 5 (MSR loading)** happens *after guest state has been loaded*. The processor's architectural state has already been overwritten with the contents of the guest-state area, so there is no longer a context in which "the instruction after VMLAUNCH" is meaningful. The logical processor therefore loads host state exactly as it would on a VM exit and passes control to the host RIP, recording the failure in the exit-reason field: basic exit reason 33 (8000_0021H) "VM-entry failure due to invalid guest state", or 34 (8000_0022H) "VM-entry failure due to MSR loading", with the exit qualification holding the 1-based index of the failing MSR-load entry for 34. Bit 31 of the exit-reason field is the VM-entry-failure indicator and is 1 for exit reasons 33, 34 and 41 (machine-check event during VM entry). On such a failure the processor does not save guest state back into the guest-state area and does not process the VM-exit MSR-store area; only the exit-reason and exit-qualification fields are guaranteed to be updated, and other VM-exit information fields are undefined. For reason 33 the exit qualification is 0 unless the failure was one of the enumerated cases (PDPTE loading, NMI injection blocked by STI — qualification 3, invalid VMCS-link pointer), so qualification 0 means "one of the ordinary guest-state checks failed" and the VMM must re-derive the cause.

A practical consequence the chapter stresses: because a failed VM entry loads host state on the way out, the VMM's context after an exit-reason-33 failure is the host-state area's context, not the context that executed VMLAUNCH — a VMM that keeps state in registers across the entry must reload it in its exit path. The one-line discriminator is that a VMfail never changes guest-visible state at all, while an exit-reason-33/34 failure already overwrote the processor's architectural state before failing.

**Citation given:** Intel SDM Vol.3C Ch.29 "VM Entries" (rev 092); SDM 3C §27.9.5 (VM-instruction error numbers), §27.9.1 (exit-reason field), §27.5 (host-state area), §27.4.1 (loading guest state), §27.7/§27.8 (MSR areas, VM-entry controls), Ch.33 (VMLAUNCH/VMRESUME); SDM Vol.3D App.A (capability MSRs) and App.C (basic exit reasons).

---

### pir-virr-merge-and-on-sn-race
**Routed to:** `07-apic-virtualization.md` (routing row: "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.8, §7.8.1, §7.8.2, §7.8.3, §7.8.4, and §7.6.3/§7.6.4
**Answer:**
Posted interrupts split injection into a memory-side step (record the vector in a descriptor) and a signalling step (send a physical notification interrupt). The PIR-to-VIRR merge is the junction between the two halves: everything before it is *posting* (done by software or by the IOMMU into memory), everything after it is ordinary virtual-interrupt delivery.

**The descriptor.** The posted-interrupt descriptor is a 64-byte, 64-byte-aligned structure referenced by the posted-interrupt descriptor address field of the VMCS: bits 255:0 PIR (one bit per vector), bit 256 ON (outstanding notification), bit 257 SN (suppress notification), bits 279:272 NV (notification vector), bits 319:288 NDST (notification destination, the target's physical APIC ID).

**The posting side.**
```
set PIR[Vector]
if SN = 1:  done                 # deliberately silent
if ON was already 1:  done       # a notification is already in flight
set ON
send an interrupt with vector NV to the processor identified by NDST
```
The ON check is what collapses a burst of postings into a single notification.

**The merge (posted-interrupt processing).** The processor performs this when "process posted interrupts" is 1 and it receives an interrupt with the notification vector while in VMX non-root operation; the notification interrupt itself causes no VM exit. VM entry also performs posted-interrupt processing when ON is set, so interrupts posted while the vCPU was not running are picked up at the next entry rather than lost. The steps, in order:
```
posted-interrupt processing:
    ON <- 0                              # cleared FIRST
    acknowledge the notification interrupt at the local APIC
    tmpPIR <- PIR; PIR <- 0              # atomic read-and-clear
    VIRR <- VIRR OR tmpPIR
    RVI  <- max(RVI, highest index of a bit set in tmpPIR)
    evaluate pending virtual interrupts  # §7.6.3
```
That is: clear ON, acknowledge the notification, atomically read-and-clear PIR, OR the read value into VIRR on the virtual-APIC page, raise RVI to the highest vector taken from PIR if that exceeds the current RVI, then evaluate pending virtual interrupts (recognize if RVI[7:4] > VPPR[7:4]), which leads into virtual-interrupt delivery (§7.6.4) when the guest can accept an interrupt.

**Why the order is a correctness argument, not an implementation detail.** Consider a poster running concurrently with the target's merge. Because ON is cleared **before** PIR is read, the window in which a poster can observe stale state is the window between those two steps. A poster that lands in that window sees ON = 0, sets its PIR bit, sets ON, and sends a notification. Two outcomes are possible and both are safe:

1. The poster's PIR bit is written **before** the atomic read-and-clear. The bit is merged into VIRR immediately, and the notification that arrives later finds PIR empty — a spurious notification whose only cost is one merge that moves nothing.
2. The poster's PIR bit is written **after** the read-and-clear. The bit stays in PIR, ON is set, and the notification the poster sent causes a second round of posted-interrupt processing that picks it up.

Had ON been cleared *after* PIR was read, a poster landing between the read and the clear would have seen ON = 1, skipped the notification, and left its bit in a PIR that the target had just emptied — a lost interrupt. So clearing ON before the atomic read-and-clear of PIR is what makes the protocol lossless: the worst case is a redundant notification, never a dropped vector.

**SN's role in the same race.** SN exists to shut off notifications while the target vCPU is not in a position to use them; a VMM sets SN when the vCPU is descheduled or is executing in host context, and interrupts still accumulate in PIR for the next merge. Setting SN while the CPU runs in host context was measured in KVM to improve `perf bench sched pipe` by 6.56% and to cut posted-interrupt notifications from tens of thousands per second to hundreds, at a cost of about 1.58% on the VM-exit round trip. A VMM that *blocks* a vCPU must not simply rely on SN: it repoints NV at a host wake-up vector and NDST at the host CPU so a posting wakes the vCPU through the host interrupt path rather than being silently absorbed, and it must refuse to block if ON is already set.

**Citation given:** Intel SDM Vol.3C Ch.32 "APIC Virtualization and Virtual Interrupts" (rev 092); descriptor address field SDM 3C §27.6.8. KVM SN measurement is a Tier-2 kernel source, reference [120] in the skill's bibliography.

---

### vmcs-shadowing-mechanism
**Routed to:** `14-nested-virtualization.md` (routing row: "Nested VMX, **VMCS shadowing**, vmcs02, nested EPT")
**Actually answered from:** `references/14-nested-virtualization.md` §14.1, §14.3.1–§14.3.4; cross-checks in `references/02-vmcs.md` §2.2, §2.8.3 and `references/04-vm-entry.md` §4.2
**Answer:**
**The problem.** VMREAD and VMWRITE are the only VMCS-access instructions that are *not* on the unconditional-exit list for VMX non-root operation. Without help, every VMREAD and VMWRITE that L1 executes traps to L0. L1 executes dozens of them per L2 exit, which is the largest single component of exit multiplication (a single L2 exit can cascade into 40–50 L1→L0 exits). VMCS shadowing removes those exits by letting the hardware satisfy L1's accesses out of a real VMCS that L1 is allowed to touch while in VMX non-root operation.

**The control.** "VMCS shadowing" is a secondary processor-based VM-execution control (secondary bit 14); support for its 1-setting is discovered by reading IA32_VMX_PROCBASED_CTLS2 (48BH).

**The shadow-VMCS indicator.** Every VMCS is either an ordinary VMCS or a shadow VMCS, and the type is carried by the shadow-VMCS indicator: **bit 31 of the first 4 bytes of the VMCS region** — 0 means ordinary, 1 means shadow. Bits 30:0 of the same doubleword are the VMCS revision identifier. (IA32_VMX_BASIC bit 31 is always 0, which is what frees bit 31 of the region's first dword for this use.) VMPTRLD fails if the indicator is 1 and the processor does not support the 1-setting of "VMCS shadowing", and software must VMCLEAR a VMCS before changing its indicator, because changing it while the VMCS is active may corrupt it.

**The VMCS-link pointer.** The VMCS-link pointer is a 64-bit field of the guest-state area (guest non-register state). When "VMCS shadowing" is 1, VMREAD and VMWRITE executed in VMX non-root operation access the VMCS referenced by this pointer; otherwise software should set the field to FFFFFFFF_FFFFFFFFH to avoid VM-entry failures. VM entry checks that any VMCS referenced by the VMCS-link pointer is a shadow VMCS, and an invalid VMCS-link pointer is one of the enumerated VM-entry failure causes. Importantly, the shadow VMCS belongs to the VMCS-link pointer of **vmcs01** (the VMCS that runs L1); it is not vmcs02 and is never entered.

**The two bitmaps.** On processors supporting the 1-setting, the VM-execution control fields include two 64-bit physical addresses, the VMREAD-bitmap address and the VMWRITE-bitmap address. Each bitmap is 4 KBytes and therefore contains 32 KBits. VMREAD in VMX non-root operation causes a VM exit if the "VMCS shadowing" control is 0, **or** the source operand sets any bit in the range 63:15, **or** the VMREAD bit corresponding to bits 14:0 of the source operand is 1; otherwise the instruction reads the VMCS referenced by the VMCS-link pointer. VMWRITE is symmetric with the VMWRITE bitmap. The bit is located arithmetically: letting x be bits 14:0 of the operand and addr the bitmap address, the corresponding bit is bit position x & 7 of the byte at physical address addr | (x >> 3). The bitmaps are therefore a per-field intercept policy: L0 clears a bit for every field it will let L1 access directly out of the shadow VMCS, and sets a bit for every field whose access it must still emulate. Because encodings with any bit set in 63:15 always exit, only the low 32K of the encoding space can ever be shadowed. KVM builds these bitmaps at module init from two tables of field encodings (read-only shadow fields and read/write shadow fields), leaving everything else intercepted.

**Synchronisation with vmcs12.** The shadow VMCS is hardware-format memory; vmcs12 is L0's software image of L1's intent, and the two must be reconciled at every transition where either side could have changed. Before L0 resumes L1 with shadowing enabled, L0 copies the shadowed fields from vmcs12 into the shadow VMCS so L1's subsequent VMREADs observe the state L0 believes it has (KVM: `copy_vmcs12_to_shadow()`). When L1 next exits to L0, L0 copies the writable shadowed fields back out of the shadow VMCS into vmcs12 before interpreting L1's intent (KVM: `copy_shadow_to_vmcs12()`). Fields that are not shadowed keep trapping, so L0 sees those writes immediately and needs no synchronisation for them; the shadow set is consequently chosen as the fields L1 touches most often per L2 exit, not "all fields".

**What stops L1 running its guest out of the shadow VMCS.** A shadow VMCS differs from an ordinary VMCS in exactly two ways: (1) **it can never be used for VM entry — VM entry fails if the current VMCS is a shadow VMCS**, and (2) VMREAD/VMWRITE executed in VMX non-root operation can access it. That first property is the whole answer: the hardware simply refuses to launch from a shadow VMCS, so L1 can read and write the structure at full speed but can never turn it into a running machine. The actual entry still has to go through VMLAUNCH/VMRESUME, which unconditionally exits from VMX non-root operation to L0, and L0 runs L2 from vmcs02 — a structure L1 never touches. Note also that in VMX *root* operation both ordinary and shadow VMCSs can be accessed with VMREAD and VMWRITE, so L0 reads and writes the shadow VMCS with the same instructions L1 uses: there is no privileged back door and no architecturally defined layout.

**Citation given:** Intel SDM Vol.3C §27.10 (VMCS types / shadowing), §27.2 (VMCS region format and shadow-VMCS indicator), §27.4.2 (VMCS-link pointer), §27.6.15 (VMREAD/VMWRITE bitmap addresses), §29.3.1.5 (VMCS-link-pointer entry check), Ch.33 (VMREAD/VMWRITE), §28.1.2 (unconditional exits); SDM Vol.3D App.A (IA32_VMX_PROCBASED_CTLS2). KVM function names are Tier-2, reference [301].

---

### vmcs02-merging
**Routed to:** `14-nested-virtualization.md` (routing row: "Nested VMX, VMCS shadowing, **vmcs02**, nested EPT")
**Actually answered from:** `references/14-nested-virtualization.md` §14.2, §14.4.1, §14.4.2, §14.4.3, §14.4.4
**Answer:**
**The three structures.** L1 thinks it is manipulating a VMCS; it is not, it is manipulating a memory image that L0 interprets. Three structures exist at once:

| Name | Built by | Describes | Loaded by hardware? |
|---|---|---|---|
| `vmcs01` | L0 | how L0 runs L1 | yes, while L1 runs |
| `vmcs12` | L1 | how L1 wants to run L2 | never |
| `vmcs02` | L0 | how L0 actually runs L2 | yes, while L2 runs |

(The Turtles paper calls these VMCS0→1, VMCS1→2 and VMCS0→2.) vmcs12 can be an ordinary software structure because the VMCS data format is architecturally implementation-specific — bytes 8 and beyond hold "VMCS data (implementation-specific format)" reachable only through VMREAD/VMWRITE — so L1 cannot depend on any particular layout. L0 must, however, hand L1 a revision identifier it is prepared to emulate, because VMPTRLD checks it.

**The shape of the merge.** vmcs02's host-state area must be L0's, because a real VM exit from L2 must land in L0; its guest-state area must be L1's picture of L2; and its controls must satisfy L0 and L1 simultaneously.

- **Host-state area — taken from vmcs01.** The processor loads host state from the current VMCS on every VM exit, so L2's exits must load L0's host state, never L1's.
- **Guest-state area — taken from vmcs12**, L1's chosen register and non-register state for L2, with L0 overriding the fields it owns (including the VMCS-link pointer). The guest-state checks of VM entry then apply to the merged result.
- KVM splits the work into `prepare_vmcs02_early()` (controls and fields derived from vmcs01, rarely changing) and `prepare_vmcs02()` (guest state from vmcs12, per entry).

**The merging rule for controls is not uniform.** For *intercepts* L0 needs the **union** — anything either level wants to trap must trap, because only L0 can catch it. For *permissions* L0 needs the **intersection** — a bypass is safe only if both levels allow it.

Unions (intercepts):
- **Exception bitmap:** vmcs02's is the union of vmcs01's and vmcs12's.
- **Pin-based controls:** unioned, with the VMX-preemption timer treated specially. L0 must keep its own external-interrupt and NMI exiting regardless of what L1 asked for, because host interrupts must reach L0.
- **Processor-based "exiting" controls:** unioned with vmcs12's.
- **CR0 and CR4 guest/host masks:** unioned — a bit owned by either level must trap — while the read shadows are composed so that L2 observes the value L1 intends it to observe.

Intersections (permissions/pass-through):
- **MSR bitmaps:** an MSR may be passed through to L2 only if **both** vmcs01 and vmcs12 permit it, so the merged bitmap is the intersection of the two pass-through sets — equivalently the union of the two intercept sets. If L1 does not use MSR bitmaps at all, L0 must intercept every MSR access.

Neither union nor intersection — L0-owned or specially composed:
- **Processor-based controls that select L0's own mechanisms** — enable EPT, enable VPID, unrestricted guest, and the secondary controls behind them — are set from L0's configuration and are not simply copied from vmcs12.
- **EPTP:** the EPTP in vmcs02 always points at an EPT structure L0 controls (EPT02); L1's EPTP value from vmcs12 is data to be interpreted, never a pointer the hardware is allowed to load.
- **TSC offsets compose additively:** the offset programmed in vmcs02 is the sum of L0's offset for L1 and the offset L1 programmed for L2, so L2 sees both adjustments; with TSC scaling the multipliers compose multiplicatively.
- **Page faults are the awkward case:** there is a single page-fault error-code mask and match pair in the VMCS, so when L0 and L1 want different #PF intercept policies L0 cannot express both at once and must fall back to intercepting all page faults and filtering them in software.
- **I/O:** rather than merge two 8-KByte I/O bitmaps, KVM sets unconditional I/O exiting in vmcs02 and clears "use I/O bitmaps", then consults vmcs12's I/O bitmap in software to decide whether the exit belongs to L1.

**Sync-back on an L2 exit.** On a VM exit from L2 the processor writes guest state and VM-exit information into vmcs02. If the exit is to be reflected, L0 must copy the affected state into vmcs12 so L1's VMREADs see a coherent picture (KVM: `sync_vmcs02_to_vmcs12()` from `__nested_vmx_vmexit()`), covering fields only modified after L2 runs, such as the VMX-preemption timer value. Rarely read fields are synchronised lazily, which combined with VMCS shadowing keeps per-exit copying proportional to what L1 actually reads. Nested state that lives outside any hardware VMCS — the current vmcs12, the shadow VMCS contents and L0's bookkeeping — must be saved and restored explicitly for migration or snapshot (`KVM_CAP_NESTED_STATE`, `KVM_GET/SET_NESTED_STATE`).

**How a bad merge fails.** Three loud failures, and which one you get is most of the diagnosis: (a) illegal merged *controls* → VM entry of L2 fails during the control-field checks and control falls through to the instruction after VMLAUNCH/VMRESUME with the error in the VM-instruction error field; (b) illegal merged *guest state* → a VM exit with bit 31 of the exit reason set, so L0 must distinguish "L1 gave me a bad vmcs12" (reflect a VM-entry failure to L1) from "I merged it wrongly" (an L0 bug); (c) legal but too permissive → nothing fails and L2 simply gets a capability L1 never granted it, which is the security-relevant failure mode and the reason the intercept merge is a union rather than a copy.

**Citation given:** Intel SDM Vol.3C §27.1/§27.2/§27.3 (VMCS), §27.4 and Ch.29 (guest state and VM-entry checks), §27.5 and Ch.30 (host state and VM exits), §27.6.1/§27.6.2 (pin- and processor-based controls), §27.6.3 (exception bitmap and #PF mask/match), §27.6.4 (I/O bitmaps), §27.6.5 (TSC offsetting), §27.6.6 (CR masks/read shadows), §27.6.9 (MSR bitmaps), §27.6.11 (EPTP), §27.9 and §27.11. KVM function names and `KVM_CAP_NESTED_STATE` are Tier-2, references [301] and [318]; Turtles naming is [302]/[300].

---

### secure-ept-page-acceptance
**Routed to:** `13-tdx.md` §13.8 (routing row: "TDX: … Secure EPT (§13.8)")
**Actually answered from:** `references/13-tdx.md` §13.8.1, §13.8.2, §13.8.3, §13.8.4
**Answer:**
**Why acceptance exists.** The acceptance requirement exists to defeat an attack in which the host VMM removes arbitrary pages from a TD's GPA space with `TDH.MEM.PAGE.REMOVE` and replaces them with zeroed pages. Because the host VMM is outside the TD's TCB but still manages physical memory, a page it hands the TD after TD initialization is untrusted by construction. Acceptance is the TD's own act of taking ownership of a GPA. The corollary the specification states is that a guest TD must track its own GPA allocation and must **never accept a page it already knows to be TD-owned** — otherwise the host could use the accept step itself to zero live TD memory.

**The exact sequence.** Dynamically adding a TD private page after TD initialization is a three-step process:

1. **The VMM extends Secure EPT with `TDH.MEM.SEPT.ADD`** if a new Secure-EPT page is needed to cover the GPA range.
2. **The VMM adds and maps a 4KB or 2MB page with `TDH.MEM.PAGE.AUG`.** This leaves the Secure EPT (SEPT) leaf entry in the **PENDING** state and the page **unmeasured** — `TDH.MEM.PAGE.AUG` does not access the destination page at all. It performs a Secure EPT walk and aborts if the mapping already exists, which prevents re-mapping of an already-mapped GPA; it then sets the leaf entry to PENDING and writes the PAMT entry with PT_REG and the TDR PA as OWNER.
3. **The guest TD accepts it with `TDG.MEM.PAGE.ACCEPT`, which zeroes the content.** The page is initialized here, not by AUG.

**What happens if the TD touches a PENDING page before accepting it.** A guest TD access to a page whose SEPT entry is PENDING (or PENDING_EXPORTED_DIRTY) results in **either a #VE or a TD exit**, selected by `ATTRIBUTES.SEPT_VE_DISABLE` in TD_PARAMS, by `CONFIG_FLAGS.FLEXIBLE_PENDING_VE`, and — when flexible — by the guest's own `TDCS.TD_CTLS.PENDING_VE_DISABLE`. Availability of the latter two is enumerated by `TDX_FEATURES0.PENDING_EPT_VIOLATION_V2` (bit 16), readable through `TDH.SYS.RD*`. The #VE behaviour supports an accept-on-demand guest policy; the TD-exit behaviour suits guests that map only already-accepted memory, for which touching a PENDING page is a fatal error and the host VMM normally tears the TD down. On the TD-exit path, an access to a PENDING page configured to TD-exit is indicated by Extended Exit Qualification TYPE == PENDING_EPT_VIOLATION (6). Under TD Partitioning, an L2 VM access to a PENDING page always results in an L2→L1 exit rather than a #VE or a TD exit.

**Edge cases of the accept itself.**
- If `TDG.MEM.PAGE.ACCEPT`'s Secure EPT walk terminates on a free-equivalent entry (FREE, REMOVED or EXPORTED_REMOVED) at the requested level, the module performs a TD exit with an EPT violation carrying the error entry level and state plus the guest-requested accept level — which the host VMM may treat as the guest asking it to add the page.
- If the walk terminates on a guest-accessible leaf at a level *higher* than requested (for example a present 2MB PTE for a 4KB accept), `TDG.MEM.PAGE.ACCEPT` returns success with a warning that the page is already present and mapped at a larger size.

**Context that makes this coherent.** Private GPAs (SHARED bit = 0, at GPA bit GPAW−1, i.e. bit 47 or bit 51) are translated through the Secure EPT, which the TDX Module alone maintains — one per TD, resident in ordinary memory but encrypted and integrity-protected with the TD's ephemeral private key and never mapped into the TD's GPA space. The SEPT leaf states relevant here are FREE, PENDING and MAPPED; `TDH.MEM.PAGE.ADD` (build time) creates a MAPPED entry directly and increments MEM_COUNT, whereas post-initialization `TDH.MEM.PAGE.AUG` creates a PENDING entry that only the guest's accept can promote.

**Citation given:** Intel TDX Module Base Architecture Specification §9.10.1, §9.10.2, §9.10.3, §9.10.4 (page acceptance and PENDING behaviour); §9.1 and §9.2.1/§9.2.2 (Secure EPT, SHARED bit, entry states); §9.4 (EPT-violation TD exit); §11.15.1 (GPAW). Skill bibliography reference [11].

---

### vtd-queued-invalidation
**Routed to:** `10-vtd-dma-remapping.md` (routing row: "VT-d DMA remapping, DMAR registers, translation structures, invalidation")
**Actually answered from:** `references/10-vtd-dma-remapping.md` §10.6.1, §10.6.2, §10.6.3, §10.6.4
**Answer:**
**What it replaces and when you need it.** Queued invalidation replaces the one-at-a-time register handshake (CCMD_REG for the context cache, IVA_REG + the IOTLB Invalidate Register for the IOTLB) with a ring of descriptors. It is the **only** route to PASID-granular and device-TLB invalidation.

**Enabling and locating the queue.** Queued invalidation is supported only on hardware reporting `ECAP_REG.QI` as Set, is enabled through `GCMD_REG.QIE`, and is observed through `GSTS_REG.QIES`. The invalidation queue is located by `IQA_REG` at offset 090h, with `IQH_REG` at 080h giving the offset of the descriptor hardware will read next and `IQT_REG` at 088h the offset software will write next. Software appends descriptors and advances the tail; hardware consumes from the head.

**Descriptor typing.** The Type field of an invalidation descriptor is a 7-bit field formed by concatenating bits 11:9 and bits 3:0 of the descriptor. The defined types are:

| Type | Descriptor | Spec section |
|---|---|---|
| 1h | Context-cache Invalidate (`cc_inv_dsc`) | §6.5.2.1 |
| 2h | IOTLB Invalidate (`iotlb_inv_dsc`) | §6.5.2.3 |
| 3h | Device-TLB Invalidate (`dev_tlb_inv_dsc`) | §6.5.2.5 |
| 4h | Interrupt Entry Cache Invalidate (`iec_inv_dsc`) | §6.5.2.8 |
| 5h | Invalidation Wait (`inv_wait_dsc`) | §6.5.2.9 |
| 6h | PASID-based IOTLB Invalidate (`p_iotlb_inv_dsc`) | §6.5.2.4 |
| 7h | PASID-cache Invalidate (`pc_inv_dsc`) | §6.5.2.2 |
| 8h | PASID-based-Device-TLB Invalidate (`p_dev_tlb_inv_dsc`) | §6.5.2.6 |
| 9h | Page Group Response (`pgrp_resp_dsc`) | §7.6.1 |
| Ah | HPT Cache Invalidate | §6.5.2.7 |

**The ordering you must respect.** Two of the rules are enforced by hardware and two are obligations on software:

*Hardware-enforced completion ordering (§6.5.2.12):*
- Hardware completes a **PASID-based IOTLB** invalidation descriptor only after all **context-cache and PASID-cache** invalidation descriptors ahead of it in the queue are completed.
- Hardware completes an **IOTLB** invalidation descriptor only after all **context-cache** invalidation descriptors ahead of it in the queue are completed.

That is, the hierarchy invalidates outside-in automatically: context/PASID caches drain before the IOTLB-level descriptors behind them can retire. The rationale is that the coarser cache names the structures the finer cache was populated from, so retiring the finer one first would leave a window for repopulation from a stale coarser entry.

*Software obligations:*
- **Software must always request IOTLB invalidation before requesting the corresponding Device-TLB invalidation.** This one is not inferred by hardware; getting it backwards lets the device-TLB be refilled from a still-stale IOTLB.
- Use the **Invalidation Wait Descriptor** (type 5h) to synchronize with hardware for descriptors submitted ahead of it. If the **Fence (FN) flag is 1** in an Invalidation Wait Descriptor, hardware must execute descriptors following it only after the wait command is completed — that is the general-purpose barrier for cases the two hardware rules above do not cover.

**Completion, errors and caching mode.**
- Hardware generation of invalidation completion events is specified in §6.5.2.10.
- When the **Invalidation Time-out Error (ITE)** condition is signalled, hardware aborts any Invalidation Wait Descriptor commands pending in hardware.
- What is cached, and therefore what you may need to invalidate, is defined in VT-d Ch.6: the context-cache (§6.2.2), PASID-cache (§6.2.3), IOTLB (§6.2.4), the paging-structure caches PML5-/PML4-/PDPE-/PDE-cache (§6.2.5), the HPT cache (§6.2.6) and the interrupt entry cache (§6.4).
- The **Caching Mode (CM)** field of the Capability Register indicates whether the implementation caches not-present or erroneous translation-structure entries. When CM is Set, any software update to remapping structures other than first-stage mappings — **including updates to not-present entries and to present entries whose programming resulted in translation faults** — requires explicit invalidation. Hardware implementations of the architecture must support operation corresponding to CM = 0; CM = 1 exists so software emulating remapping hardware can virtualize it efficiently, and software managing remapping hardware should handle both modes. In practice CM = 1 is a *virtual* IOMMU signal: it lets a VMM trap every guest invalidation and keep shadow structures consistent without write-protecting the guest tables.
- VT-d §6.5.3.3 gives normative guidance to software for invalidations, and §6.5.3.4 the equivalent guidance when HPT is enabled; draining of requests to memory is §6.5.4 and interrupt draining §6.5.5. The chapter points to those sections rather than restating their content.

**Citation given:** Intel VT-d Specification Rev 5.20 (April 2026, order number D51397-019) §6.1, §6.2.x, §6.4, §6.5.2, §6.5.2.5, §6.5.2.9, §6.5.2.10, §6.5.2.11, §6.5.2.12, §6.5.3.3, §6.5.4, §11.4, §11.4.4.1. Skill bibliography reference [8].

---

### hvci-uses-ept
**Routed to:** `15-security.md` §15.5 (routing row: "Transient-execution CVEs … **mitigation MSRs**, VBS, HVCI, Credential Guard, TXT")
**Actually answered from:** `references/15-security.md` §15.7, §15.8; corroborated by `references/17-windows-platform.md` §17.6, §17.6.1, §17.2.7
**Answer:**
Memory integrity (also called hypervisor-protected code integrity, HVCI) works by **moving the code-integrity decision to a place the compromised kernel cannot reach, and expressing the result in a page-permission the compromised kernel cannot write**.

**The substrate: VBS and VTLs.** Virtualization-based security uses the Windows hypervisor and second-level address translation — EPT on Intel parts — to create an isolated environment that becomes a root of trust for the OS, built on the assumption that the normal kernel can be compromised. The isolation primitive is the Virtual Trust Level: normal Windows, kernel mode included, runs in **VTL0**, while the secure kernel and Isolated User Mode run in **VTL1**, and VTLs are hierarchical, so VTL1 is strictly more privileged than VTL0. The boundary is enforced by memory access permissions the hypervisor assigns with SLAT, which software inside the partition — including the VTL0 kernel — cannot change. This is the same EPT permission machinery as for virtual machines, applied to trust levels rather than to VMs.

**What HVCI adds.** Memory integrity runs kernel-mode code integrity **inside the VBS isolated environment rather than in the kernel it is policing**. The enforced invariant is W^X for kernel memory: kernel memory pages are only made executable after passing code-integrity checks inside the secure environment, and executable pages themselves are never writable. Expressed per page (17.6.1): a kernel page may be writable at VTL0 **or** executable at VTL0, but the secure kernel does not grant both at once, and the grant is expressed in the second-level translation permissions that the more privileged level controls.

**Why kernel write is not enough for the attacker.** The mechanism is EPT permissions: **the code page's executable permission lives in the EPT entry the hypervisor controls, not in the VTL0 page tables the compromised kernel controls.** So even where a memory-safety defect lets an attacker modify memory, executable code pages cannot be modified and modified memory cannot be made executable — the classic "write shellcode into kernel memory and jump to it" step fails. A VTL0 kernel cannot grant itself execute rights, because the decision is taken at a level it cannot write to. The attacker's kernel-write primitive operates on VTL0 page tables and VTL0 memory; the permission that actually gates instruction fetch is one level down, in a structure only VTL1/the hypervisor may edit. Unsigned or improperly signed kernel code fails for the second, independent reason: the integrity check that authorises the transition to executable happens in the secure environment, so a signature the VTL0 kernel would have accepted is irrelevant.

**The hardware feature that makes it affordable.** Mode-based execute control for EPT (MBEC) splits EPT execute permission into user-mode execute and supervisor-mode execute, so the hypervisor can allow user code to execute a page while denying kernel execution of it without maintaining a second set of structures. Microsoft names Intel's MBEC, AMD's GMET and ARM's TTS2UXN as the features designed to reduce HVCI's performance and power impact. (Per the skill's errata E01, MBEC first shipped in Kaby Lake, not Skylake.)

**The collateral damage, and why it is structural.** A driver fails under HVCI when it violates the invariant, not because it is old: drivers that allocate memory that is simultaneously writable and executable, generate or patch code at runtime, or otherwise mix data and code in one section are incompatible by construction rather than by policy. The cost profile follows the same structure — the expensive event is a change of page permissions, not ordinary execution, so the feature has a per-page cost profile rather than a per-call one.

**Citation given:** Intel SDM Vol.3C §31.3 and §31.3.2 (VMX support for address translation / EPT permissions) for the hardware; Microsoft Learn and the Hypervisor Top-Level Functional Specification for the Windows behaviour — skill bibliography references [378], [379], [380], [381], [382], [383], [388], [463], [476], [483]. Note: HVCI, VTLs and driver-compatibility rules are Windows behaviour, so per the skill's output standards the authoritative citation is Microsoft, not Intel; the Intel anchor covers only the EPT/MBEC machinery.

---

### virtual-interrupt-delivery
**Routed to:** `07-apic-virtualization.md` (routing row: "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.5, §7.6.2, §7.6.3, §7.6.4, §7.6.7
**Answer:**
**The state it operates on.** The guest-interrupt-status field is two independent bytes: bits 7:0 are **RVI**, the requesting virtual interrupt (the vector of the highest-priority virtual interrupt waiting to be delivered), and bits 15:8 are **SVI**, the servicing virtual interrupt (the vector of the highest-priority virtual interrupt currently in service, i.e. the highest bit set in VISR). RVI is the virtual counterpart of the physical APIC's highest pending IRR vector and SVI of its highest ISR vector; the processor keeps both in the VMCS rather than recomputing them from the virtual-APIC page on every evaluation. Everything else — VIRR, VISR, VTPR, VPPR — lives on the virtual-APIC page.

**Recognition comes first, and is not delivery.** Evaluation of pending virtual interrupts is:
```
if RVI[7:4] > VPPR[7:4]:  recognize a pending virtual interrupt
else:                     do not recognize
```
A virtual interrupt is recognized only when the **priority class** of RVI (bits 7:4) is strictly greater than the priority class of VPPR — the comparison is by priority class, not by full vector value. VPPR itself is produced by PPR virtualization: `if VTPR[7:4] >= SVI[7:4] then VPPR <- VTPR & FFH else VPPR <- SVI & F0H`. Recognition is not delivery: a recognized virtual interrupt is delivered only when the guest is able to accept an interrupt, that is, when RFLAGS.IF is 1 and interrupts are not blocked by STI or by MOV SS.

**What the processor does when it decides to deliver.** The virtual-interrupt-delivery algorithm, in the SDM's own formulation:
```
virtual-interrupt delivery:
    Vector <- RVI
    VISR[Vector] <- 1
    SVI   <- Vector
    VPPR  <- Vector & F0H
    VIRR[Vector] <- 0
    if any bit is set in VIRR:
        RVI <- highest index of a bit set in VIRR
    else:
        RVI <- 0
    deliver the interrupt with Vector through the guest IDT
    stop recognizing the pending virtual interrupt
```
In words and in order: it takes the vector from RVI; sets that vector's bit in VISR (moving it to in-service); copies the vector into SVI; sets VPPR to the vector's priority class; clears the vector's bit in VIRR; recomputes RVI from the remaining VIRR bits (0 if none are set); and then delivers the interrupt through the guest IDT — **all without a VM exit**. Because delivery happens in VMX non-root operation, the guest's own IDT, TSS and stack switching are used exactly as on bare metal, and the VMM observes nothing.

**When the algorithm is invoked.** Evaluation of pending virtual interrupts is re-run after every operation that can change RVI or VPPR: TPR virtualization (a write to VTPR or MOV to CR8), EOI virtualization (a write to VEOI or WRMSR to the x2APIC EOI register), self-IPI virtualization, posted-interrupt processing (the PIR→VIRR merge), and VM entry. Delivery of an already-recognized interrupt then happens as soon as the guest becomes able to accept interrupts (STI, POPF, IRET). This is what removes the need for interrupt-window exiting under APICv: with virtual-interrupt delivery enabled a VMM no longer tracks the guest's interruptibility itself, and the pending-interrupt and interrupt-window exits that existed to tell the VMM "the guest can take an interrupt now" become unnecessary.

**How a VMM injects under this scheme.** A VMM injects by setting the vector's bit in VIRR on the virtual-APIC page and setting RVI to the vector if it is higher than the current RVI; it does **not** use the VM-entry interruption-information field.

**Control dependencies.** "Virtual-interrupt delivery" requires "use TPR shadow" to be 1 (if use-TPR-shadow is 0, virtualize x2APIC mode, APIC-register virtualization, virtual-interrupt delivery and IPI virtualization must all be 0) and requires "external-interrupt exiting" to be 1, because the processor must own the physical interrupt path in order to arbitrate between physical and virtual interrupts. With virtual-interrupt delivery set, the TPR threshold is not used — the processor evaluates pending virtual interrupts instead of taking a TPR-below-threshold exit.

**Citation given:** Intel SDM Vol.3C Ch.32 "APIC Virtualization and Virtual Interrupts" (rev 092), with §27.4.2 for the guest-interrupt-status field and §27.6.8 for the APICv VM-execution control fields; SDM Vol.3D App.C for the related exit reasons (43, 45, 56).

---

### ept-violation-vs-misconfiguration
**Routed to:** `06-address-translation.md` (routing row: "EPT structures, **EPT violation vs misconfiguration**, VPID, PML, SPP, HLAT, #VE"), plus `05-vm-exit.md` §5.4 for the qualification layout as SKILL.md §How-to-use step 4 directs
**Actually answered from:** `references/06-address-translation.md` §6.4, §6.4.1, §6.4.2, §6.4.3, §6.4.4; `references/05-vm-exit.md` §5.4.6; `references/errata.md` E16, E17
**Answer:**
**The one-line distinction.** Both are VM exits produced while translating a guest-physical address, and they mean completely different things: **a violation is a *policy* decision the VMM programmed on purpose; a misconfiguration is a *bug* in the table the VMM built.** The SDM's own wording: "An EPT misconfiguration occurs when, in the course of translating a guest-physical address, the logical processor encounters an EPT paging-structure entry that contains an unsupported value. An EPT violation occurs when there is no EPT misconfiguration but the EPT paging-structure entries disallow an access using the guest-physical address." Note the precedence built into that sentence — misconfiguration is checked first; a violation is what you get when there is *no* misconfiguration.

**What causes a misconfiguration.** Checks apply only to entries actually used in a translation and only to present entries (so arbitrary values may be left in the upper bits of a zeroed, not-present entry). An EPT misconfiguration occurs if:
- bits 2:0 of an entry used in the translation are 010b (write, no read) or 110b (write and execute, no read) — the architecture never permits write without read;
- bits 2:0 are 100b (execute-only) on a processor that does not support execute-only EPT translations, as reported by IA32_VMX_EPT_VPID_CAP;
- a present entry sets any reserved bit: bits 7:3 in an entry that references another EPT paging structure, the page-frame alignment bits (29:12 for a 1-GByte page, 20:12 for a 2-MByte page), any address bit above the processor's physical-address width, or bit 7 at a level where the corresponding page size is unsupported;
- a present leaf entry specifies EPT memory type 2, 3 or 7 in bits 5:3 (defined values are 0 UC, 1 WC, 4 WT, 5 WP, 6 WB).

Further feature-specific misconfiguration conditions exist (for example combinations of bit 2 and bit 10 under mode-based execute control, and bits requiring the corresponding EPTP enable bit), and the chapter deliberately does not restate those conjunctions — it says to read the SDM's own enumeration before relying on them.

**How the two exits differ:**

| | EPT violation | EPT misconfiguration |
|---|---|---|
| Basic exit reason | 48 | 49 |
| Cause | entries well formed but deny the access, or an entry is not present | an entry contains an unsupported value |
| Typical origin | demand paging, MMIO emulation, introspection hooks, write tracking | hypervisor bug or torn update of a live EPT entry |
| Guest-physical address field | set | set |
| Exit qualification | defined; reports the access type and the effective permissions | **not defined** for this exit |
| Convertible to #VE | yes (subject to the #VE rules) | no |

Both are **unconditional**: unlike most VM exits they have no enabling control beyond "enable EPT" itself and cannot be masked, so every EPT-using VMM must implement both handlers. Both can occur while the processor is reading a *guest* paging-structure entry, not only when accessing the final data page, because the guest-physical address of every guest paging structure is itself translated through EPT. A guest page fault caused by the guest's own paging structures is delivered to the guest as #PF and causes no VM exit unless the exception bitmap intercepts it — only the second-level translation produces EPT violations, so the guest cannot observe them.

**How the handlers should differ.**

*Exit 48 (violation).* This is a recoverable, expected event. Read the guest-physical address field, find the memory region it belongs to, and do one of three things: install a mapping (demand paging), emulate an access (MMIO), or run a policy hook (introspection, write tracking) and then resume. Two handler rules govern correctness:
- **Never advance RIP on an EPT violation.** It is fault-like: the faulting instruction must be restarted after the mapping is fixed, not skipped. Advancing RIP silently corrupts the guest.
- **Use qualification bits 3, 4 and 5 to tell whether the guest-physical address was mapped at all** — they report the EPT permissions present for the access, which separates a demand-paging miss from a permission denial.

The qualification layout (owned by `05-vm-exit.md` §5.4.6): bit 0 data read, bit 1 data write (a read-modify-write always sets bit 1; whether it also sets bit 0 is implementation-specific), bit 2 instruction fetch; bit 3 = AND of bit 0 (read) of the EPT entries used, bit 4 = AND of bit 1 (write), bit 5 = AND of bit 2 (execute, or supervisor-mode execute when MBEC is on); **bit 6 = AND of bit 10, user-mode execute, defined only when MBEC is enabled — it is not derived from the guest's execute-disable bit**; **bit 7 = the guest-*linear*-address field is valid — it says nothing about the guest-physical-address field, which is always filled in on an EPT violation**; bit 8 (only when bit 7 set) distinguishes a guest-paging-structure access from a guest-linear-address translation; bits 9/10/11 (advanced VM-exit information) report user-mode linear address, guest-write-allowed, guest-fetch-disallowed; bit 12 NMI unblocking due to IRET; bit 13 shadow-stack access. Bits above 13 are not enumerated by the chapter because their positions could not be verified. Bits 6 and 7 are the two corrections carried in `errata.md` (E17 and E16) — the commonly circulated readings of them are wrong.

*Exit 49 (misconfiguration).* There is **no useful recovery path** — the table you built is invalid. You get no architectural hint beyond the guest-physical address, because no exit qualification format is defined for this exit. Because the exit indicates an unsupported entry value rather than a denied access, resuming the guest without changing the entry simply re-raises the same exit; the only correct handling is to correct or tear down the mapping. The correct response in practice is to dump the offending entry and treat it as a hypervisor bug rather than to retry. The most common real cause is a **non-atomic update to a live EPT entry** that momentarily leaves an illegal permission combination, such as clearing read while write is still set.

**Citation given:** Intel SDM Vol.3C Ch.31 "VMX Support for Address Translation" (EPT-induced VM exits, misconfiguration conditions), §27.9.1 (exit qualification for EPT violations), §30.2.1 (how the information fields are filled); SDM Vol.3D App.A (IA32_VMX_EPT_VPID_CAP) and App.C (basic exit reasons 48 and 49). Errata entries E16 and E17 of this skill carry the two qualification corrections.

---

### default1-controls-and-true-msrs
**Routed to:** `02-vmcs.md` §2.5 (routing row: "VMCS layout, **field encodings**, execution/exit/entry controls") and `08-vmx-instructions.md` §8.4 (routing row: "VMX instruction semantics, capability MSRs")
**Actually answered from:** `references/02-vmcs.md` §2.8 and §2.8.4; `references/08-vmx-instructions.md` §8.6.2, §8.6.3; `references/04-vm-entry.md` §4.3 and §4.10
**Answer:**
**Why zero-initialising fails.** There are two distinct mechanisms and they behave differently; the second exists because of the first.

*Mechanism one — allowed-0 and allowed-1 settings.* For the pin-based controls, primary processor-based controls, VM-exit controls and VM-entry controls, one 64-bit capability MSR describes both halves of the constraint: **bits 31:0 report the allowed-0 settings and bits 63:32 report the allowed-1 settings**. A control may be 0 only if the corresponding bit in the allowed-0 half is 0, and it may be 1 only if the corresponding bit in the allowed-1 half is 1; a VM entry that violates either constraint fails. Consequently **a control whose allowed-0 bit is 1 is a "default-1" control: on that processor it must be set to 1.** This — not any special property of particular bit numbers — is the mechanism that forces reserved bits of the control fields to specific values. So a field of all zeroes will have every default-1 bit wrong, and VM entry fails with VM-instruction error 7, "VM entry with invalid control field(s)". The error number does not say which control was wrong.

The chapter names the default-1 classes it could verify: the default-1 class of the **pin-based** controls comprises **bits 1, 2 and 4**, and the default-1 class of the **primary processor-based** controls comprises **bits 1, 4 through 6, 8, 13 through 16 and 26** (tagged `C:medium`). The VM-exit and VM-entry controls likewise have default-1 reserved bits whose exact membership is reported by their capability MSRs; software must read the MSR rather than hard-code the list. The chapter also corrects an old claim: "the first VMX processors supported only the 1-setting of bits 1, 2 and 4" is a description of the pin-based default-1 class, not a property of early silicon that later silicon removed.

**The derivation rule.** Do not hand-pick bits. For each control field, take your desired value `v` and compute
```
v_final = (v | allowed0) & allowed1
```
where `allowed0` is the low 32 bits and `allowed1` the high 32 bits of that control's capability MSR. This forces every default-1 bit on and every unsupported bit off in one step. If the result differs from the desired value in a bit that matters, the feature is unavailable on that processor. This is also the answer to the classic "error 7, worked on one machine and not another" signature: a control bit was hard-coded rather than derived, and a VMM written against one microarchitecture fails this check on another.

*Mechanism two — the TRUE_ capability MSRs.* Later processors needed to allow some default-1 controls to be **cleared**, most importantly **CR3-load exiting and CR3-store exiting**, which a VMM using EPT wants to turn off (with EPT the VMM does not need to see every guest CR3 change). Rather than change the meaning of the original MSRs — which would have broken existing software — Intel added a parallel set.

- **IA32_VMX_BASIC bit 55**, when 1, reports that the TRUE_ capability MSRs are present, and therefore that some default-1 control bits may legitimately be cleared.
- The four are **IA32_VMX_TRUE_PINBASED_CTLS at 48DH, IA32_VMX_TRUE_PROCBASED_CTLS at 48EH, IA32_VMX_TRUE_EXIT_CTLS at 48FH and IA32_VMX_TRUE_ENTRY_CTLS at 490H.** They use the same two-halves layout and may be consulted only when IA32_VMX_BASIC bit 55 is 1.
- They **report the same allowed-1 settings as their non-true counterparts but may report allowed-0 settings of 0 for controls that are default-1 in the original MSRs.** So software that wants to clear a default-1 control must consult the TRUE_ MSR.
- Software that reads the original capability MSRs and treats their allowed-0 bits as mandatory will keep default-1 controls such as CR3-load and CR3-store exiting enabled: **correct, but needlessly costly** on a processor that supports EPT.

The operational rule the entry chapter states: **if IA32_VMX_BASIC bit 55 is set, use the TRUE_ MSRs instead of the originals**, because the non-TRUE MSRs report bits as default-1 that the processor actually lets you clear, needlessly constraining the VMM.

**Which control groups have no TRUE_ variant, and why.** The secondary processor-based controls (IA32_VMX_PROCBASED_CTLS2, 48BH) use the same two-halves layout but have no TRUE variant because none of their bits is default-1. IA32_VMX_PROCBASED_CTLS3 (492H, tertiary controls) is different in kind: it is a **single 64-bit allowed-1 mask**, because the tertiary controls have no default-1 bits. IA32_VMX_VMFUNC (491H) is likewise a single 64-bit allowed-1 mask over the VM-function controls. All of these MSRs are read-only; writing any of them causes #GP(0).

**Citation given:** Intel SDM Vol.3D Appendix A "VMX Capability Reporting Facility" (rev 092) for the allowed-0/allowed-1 semantics, the default-1 rule, IA32_VMX_BASIC bit 55 and the TRUE_ MSR addresses 48DH–490H; SDM Vol.3C §27.6.1/§27.6.2 for the control fields themselves and §27.9.5 for VM-instruction error 7.

---

### idt-vectoring-reinjection
**Routed to:** `05-vm-exit.md` §5.4 (routing row: "**Decoding a VM exit**: exit reasons (§5.3), exit qualification layouts (§5.4), IDT-vectoring")
**Actually answered from:** `references/05-vm-exit.md` §5.6 (and its handling rule); `references/04-vm-entry.md` §4.8, §4.8.1
**Answer:**
The mechanism you are missing is **IDT-vectoring information and VMM re-injection**. A guest that hangs after "a fault that happened while it was taking another fault" is a guest whose first event was silently dropped by the hypervisor.

**What happens in hardware.** While the processor is delivering an event to the guest through the **guest IDT**, that delivery can itself fault (a #PF on the IDT or the stack, a #GP on a bad descriptor, and so on). If the second event is one the VMM has asked to intercept, a VM exit occurs *in the middle of the first event's delivery*. At that moment the first event has not been delivered and has been discarded by the transition — unless the VMM re-injects it, it is lost forever. That is the hang: the guest is waiting for an interrupt or fault that the hypervisor threw away.

**The fields that tell you.** The processor records the interrupted event in the IDT-vectoring information field:
- bits 7:0 vector; bits 10:8 interruption type; bit 11 error-code valid; bits 30:13 reserved; **bit 31 valid**.
- Interruption types: 0 external interrupt, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software interrupt, 6 software exception.
- **Bit 31 is set only when the VM exit occurred while the processor was delivering an event through the guest IDT; it is the VMM's signal that an event was lost and must be re-delivered.**
- When bit 11 is 1, the **IDT-vectoring error code** field holds the error code associated with the interrupted event.

**The handling rule.** Read the IDT-vectoring information field on **every** VM exit, not only on exits you expect to be event-related. An exit handler that checks it only for selected reasons will silently drop events whose delivery faulted — which is exactly the symptom described.

**The re-injection procedure.** The standard VMM response is to copy the IDT-vectoring information and error code into the **VM-entry interruption-information field** and the **VM-entry exception error-code field** for the next VM entry, adjusting for the type of the original event. For a **software interrupt, privileged software exception or software exception** recorded in the IDT-vectoring information field, the **VM-exit instruction length field holds the length of the instruction that caused the event, and that length must be carried over to the VM-entry instruction length** when re-injecting. (This matters because injection of a software interrupt or software exception advances guest RIP by the VM-entry instruction length before the event is delivered, which is precisely how a VMM re-injects an event that faulted during delivery without re-executing the faulting instruction.)

**Constraints on the injection side that this interacts with.** The VM-entry interruption-information field is 32 bits: bits 7:0 vector, bits 10:8 interruption type, bit 11 deliver error code, bits 30:12 reserved, bit 31 valid; types are 0 external interrupt, 1 reserved, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software exception, 6 software exception, 7 other event. Injection happens only if bit 31 is 1, and the processor evaluates the field after guest state and MSRs have been loaded and before the first guest instruction executes. Type 2 requires vector 2; type 3 requires vector ≤ 31. Bit 11 (deliver error code) may be 1 only when guest CR0.PE is 1, the type is 3 or 5, and the vector is one of 8, 10, 11, 12, 13, 14, 17 (plus 21 #CP and 30 #SX on processors that support them). Bits 31:16 of the exception error-code field must be 0. For types 4, 5 and 6 the VM-entry instruction length must be 1–15, unless IA32_VMX_MISC bit 30 reports support for zero-length injection.

**Two properties that keep re-injection from looping.** First, **injected events are not filtered by the exception bitmap**: an injected event is delivered to the guest, and only a *subsequent* fault encountered during that delivery is subject to the bitmap — so re-injecting the original event does not immediately bounce back out. Second, the event injected on VM entry is delivered using the guest IDT and the guest's own descriptor tables, so if delivery faults again you get another exit with a valid IDT-vectoring information field, and the same procedure applies. If the guest's own state makes delivery impossible (external interrupt with RFLAGS.IF = 0, or STI/MOV-SS blocking in the interruptibility-state field), do **not** inject: set "interrupt-window exiting" and wait for the VM exit with basic exit reason 7 (or "NMI-window exiting" and basic exit reason 8 for NMIs). Note also that injection does not update the guest interruptibility-state field by itself, so after injecting an NMI the VMM owns the resulting NMI-blocking state.

**Citation given:** Intel SDM Vol.3C §27.9.3 (IDT-vectoring information field and error code), §30.2.4 (re-injection and instruction length), §27.8 and Ch.29 (VM-entry interruption-information field, injection checks), §27.6.2 (interrupt-window / NMI-window exiting); SDM Vol.3D App.A (IA32_VMX_MISC bit 30).

---

### vpid-ept-tagging
**Routed to:** `06-address-translation.md` (routing row: "EPT structures, EPT violation vs misconfiguration, **VPID**, PML, SPP, HLAT, #VE")
**Actually answered from:** `references/06-address-translation.md` §6.6, §6.7; corroborated by `references/08-vmx-instructions.md` §8.6.7 (capability bits) and `references/04-vm-entry.md` §4.6.1
**Answer:**
**Why you are getting stale translations at all.** With "enable VPID" set, **VM entry and VM exit no longer invalidate cached linear or combined mappings**, so host and guest translations coexist in the TLB and the VMM becomes responsible for every invalidation that correctness requires. VM entry does not flush the TLB when VPIDs are in use. The rule of thumb is that the hardware will never invalidate on your behalf once tagging is on — the whole point of VPID is that VMX transitions stop flushing — so **every place the VMM used to rely on an implicit flush becomes an explicit invalidation site.**

**The three mapping kinds and their tags.** This is the part that decides which instruction you need:

| Mapping | Translates | Tagged with |
|---|---|---|
| Linear mappings | guest-linear → physical | current VPID and current PCID |
| Guest-physical mappings | guest-physical → physical | current EP4TA |
| Combined mappings | guest-linear → physical, through both hierarchies | current VPID, current PCID **and** current EP4TA |

When EPT is in use the processor creates **guest-physical and combined** mappings rather than linear mappings, so a combined mapping created under one EPTP value cannot be used after the EP4TA changes. VPID is a 16-bit VM-execution control field; VPID 0000H is reserved for VMX root operation (the current VPID is 0000H whenever the processor is in VMX root operation or whenever "enable VPID" is 0), and VM entry fails if "enable VPID" is 1 while the VPID field is 0000H.

**The decisive asymmetry.** Two consequences are where VPID and EPT *interact* rather than compose:
1. **Guest-physical mappings carry no VPID tag, so no INVVPID type can invalidate them.** A VMM that changes EPT and invalidates only by VPID has a stale-translation bug. Removing a guest-physical mapping requires **INVEPT**.
2. **Combined mappings carry all three tags at once**, so changing *either* the VPID or the EPTP is enough to stop the processor using an existing combined mapping — and **INVEPT does invalidate combined mappings**, because those are tagged with an EP4TA as well. (This is also what makes multi-view EPT designs cheap, and why switching EPTP with VMFUNC while VPID is enabled does not require a TLB flush; without VPID the switch invalidates combined mappings associated with VPID 0000H.)

**Which invalidation after which change:**

| Situation | Required invalidation |
|---|---|
| EPT paging structures modified to be **more restrictive** | INVEPT for the affected EP4TA on **every logical processor** that may have cached it |
| vCPU migrated to a different logical processor | INVVPID single-context for that VPID |
| VPID recycled for a different vCPU or address space | INVVPID single-context before first use |
| Guest executed INVLPG and the VMM is emulating it | INVVPID individual-address |
| Guest reloaded CR3 and the VMM is emulating it | INVVPID single-context-retaining-globals |

**The permissiveness rule.** Making an EPT entry **more permissive does not require invalidation**, because the processor never caches a negative result; making it **more restrictive, or changing the physical address it points to, does.**

**Descriptors and types.**
- INVEPT descriptor, 128 bits: bits 63:0 EPT pointer (EPTP), bits 127:64 reserved (must be 0). Types: **1 = single-context** (invalidate guest-physical and combined mappings associated with the EP4TA in the descriptor), **2 = all-context** (for all EP4TA values — the conservative choice when you cannot enumerate which EPTP values are affected).
- INVVPID descriptor, 128 bits: bits 15:0 VPID, bits 63:16 reserved (must be 0), bits 127:64 linear address. Types: **0 individual-address, 1 single-context, 2 all-contexts, 3 single-context-retaining-globals**. INVVPID type 2 invalidates mappings for all VPID values **except 0000H**, so it cannot be used to flush VMX root operation's own translations.
- Which types a processor supports is enumerated in **IA32_VMX_EPT_VPID_CAP** (48CH) — read it rather than assuming all four INVVPID types exist. (Bit 20 INVEPT supported; bit 25 single-context INVEPT; bit 26 all-context INVEPT; bit 32 INVVPID supported; bits 40/41/42/43 the four INVVPID types.)

**Two operational cautions.** Invalidation is **per logical processor**: after modifying EPT paging structures that other logical processors may be caching, execute INVEPT on each of them. And both instructions are valid only in VMX root operation, so a guest that needs an invalidation against its own EPT hierarchy must be served by the VMM.

Also give each vCPU a distinct non-zero VPID, and invalidate by VPID when a vCPU migrates to another logical processor or when you reuse a VPID for a different address space.

**Citation given:** Intel SDM Vol.3C Ch.31 "VMX Support for Address Translation" (mapping kinds and tagging, INVEPT/INVVPID descriptors and types, invalidation requirements) and §27.6.12 (the VPID field and VPID 0000H); SDM Vol.3A Ch.5 (PCID); SDM Vol.3D App.A (IA32_VMX_EPT_VPID_CAP); SDM 3C Ch.29 (VM entry does not flush the TLB under VPID).

---

### ve-conversion-and-busy-field
**Routed to:** `06-address-translation.md` (routing row: "EPT structures, EPT violation vs misconfiguration, VPID, PML, SPP, HLAT, **#VE**")
**Actually answered from:** `references/06-address-translation.md` §6.11, §6.11.1; cross-check `references/04-vm-entry.md` §4.3.2 (entry check on the information address)
**Answer:**
**What #VE is.** A virtualization exception converts what would have been an EPT-violation VM exit into an exception delivered inside the guest, so guest-resident agents can handle their own second-level faults without a round trip to the VMM. The virtualization exception is **exception vector 20 (#VE)** and is delivered in VMX non-root operation in place of an EPT-violation VM exit.

**The exact conversion conditions.** An EPT violation is converted to a #VE **only if all of the following hold**:
1. the **"EPT-violation #VE" VM-execution control is 1** (secondary processor-based control bit 18);
2. **bit 63 (suppress-#VE) of the EPT leaf entry used in the translation is 0**;
3. the **32-bit field at offset 4 of the virtualization-exception information area is 0** (the "busy" field).

Two further facts bound the conversion: **EPT misconfigurations (exit reason 49) are never convertible to #VE** — only EPT violations are — and the virtualization-exception information address is a 64-bit VM-execution control field at VMCS encoding **202AH** pointing at a 4-KByte area, which VM entry checks is 4-KByte aligned and within the physical-address width when the control is 1.

**The virtualization-exception information area:**

| Offset | Size | Contents |
|---|---|---|
| 0 | 4 bytes | basic exit reason (48 for an EPT violation) |
| 4 | 4 bytes | #VE information **"busy"** field |
| 8 | 8 bytes | exit qualification |
| 16 | 8 bytes | guest-linear address |
| 24 | 8 bytes | guest-physical address |
| 32 | 2 bytes | EPTP index |

On delivering a #VE the processor writes 48 at offset 0, the exit qualification at offset 8, the guest-linear address at offset 16 and the guest-physical address at offset 24, and copies the current EPTP index to offset 32.

**Why a #VE handler cannot fault recursively.** The processor **sets the 4-byte field at offset 4 to FFFFFFFFH when it delivers a #VE and never delivers another while that field is non-zero; guest software must clear it, which makes #VE non-reentrant by construction.** Because the busy field is one of the three conversion conditions, once it is FFFFFFFFH condition (3) fails, so the next convertible EPT violation is not converted — **a guest handler that faults again before clearing offset 4 gets an ordinary VM exit rather than a nested #VE.** That is the architecture's way of preventing an unbounded exception recursion inside the guest: the fault does not vanish and it does not nest, it escalates to the VMM. The handler's contract is therefore: consume the information area, then clear offset 4 before it can take another #VE.

**The polarity trap in bit 63.** Because suppression is opt-**out** per entry rather than opt-in, turning the "EPT-violation #VE" control on converts **every** convertible EPT violation in the address space at once unless the VMM has already set bit 63 across the hierarchy. Setting suppress-#VE (bit 63) in an EPT leaf entry is how a VMM keeps specific pages exempt from guest-side handling: those EPT violations always become VM exits even when the control is 1.

**Why the EPTP index is there.** The EPTP index is a 16-bit VM-execution control field at VMCS encoding 0004H; it tells #VE handlers which entry of the EPTP list the current EPTP came from after an EPTP-switching VMFUNC. The two features are designed to be used together: a VMM publishes several EPT views in the EPTP list, lets guest-resident code switch between them with VMFUNC, and converts the resulting EPT violations into #VE so the guest agent can decide which view it needs — all without a single VM exit. Because neither the switch nor the fault leaves VMX non-root operation, this pattern is also available to guest-resident code the VMM does not trust, which is why the EPTP list is a VMM-controlled allowlist of views rather than an arbitrary pointer.

**Where else it is used.** #VE serves both guest-resident introspection agents handling their own second-level faults and, in confidential-computing designs, reflecting unmapped-private-page accesses into the guest (the TDX use of #VE is owned by `13-tdx.md`).

**Citation given:** Intel SDM Vol.3C §27.6.19 (virtualization-exception information address, information area layout, busy field, EPTP index) and Ch.31 "VMX Support for Address Translation" (#VE vector 20, conversion conditions, suppress-#VE bit 63); SDM 3C Ch.29 for the VM-entry check on the information address.

---

### ipi-virtualization-pid-table
**Routed to:** `07-apic-virtualization.md` (routing row: "APICv, virtual-APIC page, RVI/SVI, posted interrupts, **IPIv**")
**Actually answered from:** `references/07-apic-virtualization.md` §7.9, with §7.8 for the posting path and §7.10 for the control dependency
**Answer:**
**The gap IPIv fills.** Even with the full APICv stack, a guest sending an IPI still exits: the ICR write needs VMM attention because **the hardware has no way to find the target vCPU's descriptor**. Posted interrupts remove the exit on the receiving side, but somebody still has to identify which posted-interrupt descriptor belongs to the destination APIC ID. IPI virtualization supplies exactly that missing lookup — it is **posted interrupts with the lookup done in hardware**.

**The mechanism.** IPI virtualization is enabled by a **tertiary processor-based VM-execution control**. With it, the processor emulates the APIC writes that would send an IPI — **memory-mapped ICR writes, MSR-mapped ICR writes and SENDUIPI** — by posting directly into the target vCPU's posted-interrupt descriptor. The processor locates that descriptor through a **PID-pointer table indexed by the target vCPU's APIC ID**, addressed by the **PID-pointer table address** field with its size bounded by the **last PID-pointer index** field. A PID-pointer table entry carries a **valid bit in bit 0** alongside the 64-byte-aligned address of the descriptor, so a VMM can leave entries for non-existent vCPUs marked invalid.

**The algorithm:**
```
guest writes ICR to send a unicast physical IPI, IPI virtualization enabled:
    if the write is not physical-addressing / flat / unicast:
        APIC-write VM exit (reason 56)
    target_apic_id <- destination field of the ICR write
    if target_apic_id > last_PID_pointer_index:
        APIC-write VM exit (reason 56)
    entry <- PID_pointer_table[target_apic_id]
    if entry.valid = 0:
        APIC-write VM exit (reason 56)
    PID <- descriptor addressed by entry
    set PID.PIR[Vector]; if PID.SN = 0 and PID.ON was 0: set PID.ON and send PID.NV to PID.NDST
    continue in the guest                      # no exit
```
Once posted, the interrupt follows exactly the posted-interrupt path: the sending processor sets the PIR bit and sends the notification vector to NDST, and the receiving processor merges PIR into VIRR and delivers through virtual-interrupt delivery.

**Which IPIs still exit.** **IPI virtualization covers only physical-addressing, flat-mode, unicast IPIs.** Logical addressing, broadcast and shorthand forms still produce a trap-like **APIC-write VM exit (basic exit reason 56)** for the VMM to emulate. Beyond the form of the IPI, two lookup failures also fall back to reason 56: an index **beyond the last PID-pointer index**, and an **invalid table entry** (valid bit 0). Every failure mode of the hardware lookup falls back to that same trap-like exit, so a VMM never has to pre-validate what the guest writes to ICR.

**Control dependency.** IPI virtualization requires "use TPR shadow" to be 1 — if use-TPR-shadow is 0, then virtualize x2APIC mode, APIC-register virtualization, virtual-interrupt delivery and IPI virtualization must all be 0.

**Reported benefit (vendor measurement, attributed).** Intel's kernel-side measurements reported IPI cycle counts falling **22.21% in xAPIC mode and 15.98% in x2APIC mode** on a 2-vCPU microtest, **9.73%** on a unicast-IPI benchmark, and hackbench runtime falling **18.8% at 8 vCPUs and 18.2% at 96 vCPUs**.

**Gap the chapter declares:** the VMCS encodings of the PID-pointer table address and last PID-pointer index, and the bit layout of PID-pointer table entries beyond the valid bit, are explicitly listed in §7.12 as facts the chapter does not state because they could not be anchored with confidence. **THE SKILL DOES NOT CONTAIN THIS** for those two encodings and the full entry layout.

**Citation given:** Intel SDM Vol.3C Ch.32 "APIC Virtualization and Virtual Interrupts" (rev 092); SDM Vol.3D App.C for basic exit reason 56 (APIC write). The performance figures are Intel's own kernel-patch measurements, skill bibliography reference [117].

---

### interrupt-index-and-source-validation
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row: "Interrupt remapping, **IRTE**, interrupt posting on the VT-d side")
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.1.1, §11.2.1, §11.2.2, §11.3, §11.3.1, §11.4.1, §11.9
**Answer:**
**Step 1 — recognising the write as an interrupt.** An MSI is a DWORD memory write to the FEEx_xxxxh address range; the root complex decodes requests to that range as interrupt requests. Address **bits 31:20 are the Interrupt Identifier and must be FEEh** for the write to be decoded as an interrupt request. **Address bit 4 is the Interrupt Format field**: Clear = compatibility format, Set = remappable format. Compatibility-format interrupts are blocked when Extended Interrupt Mode is enabled (IRTA_REG.EIME Set) or when compatibility-format interrupts are disabled (GSTS_REG.CFIS Clear). If ECAP_REG.IRREQ is Set (interrupt remapping required) and interrupt remapping is disabled, the interrupt request is blocked; if IRREQ is Clear and remapping is not enabled, all interrupt requests are processed per the compatibility format.

**Step 2 — pulling the handle out of the remappable format.** The remappable format carries almost nothing:

| Address bits | Field |
|---|---|
| 31:20 | Interrupt Identifier (FEEh) |
| 19:5 | Handle[14:0] |
| 4 | Interrupt Format (1b) |
| 3 | SHV — SubHandle Valid |
| 2 | Handle[15] |
| 1:0 | Don't Care |

Data bits 15:0 hold the Subhandle when SHV is Set, and data bits 31:16 are then reserved (0); when SHV is Clear the whole data field is ignored by hardware. The 16-bit Handle provides 64K unique interrupt requests per remapping hardware unit. SHV exists for MSI constructs that support only a single address with multiple data values.

**Step 3 — computing interrupt_index.** Two lines of the spec:
```
if (address.SHV == 0)
    interrupt_index = address.handle;
else
    interrupt_index = address.handle + data.subhandle;
```
If the computed interrupt_index is **equal to or larger than the number of IRTEs** in the remapping table, hardware treats the interrupt request as an error.

**Step 4 — the table and the fetch.** The interrupt remapping table is a memory-resident **single-level** table whose base and size come from IRTA_REG (offset 0B8h: IRTA bits 63:12, EIME bit 11, S bits 3:0). The number of entries is **2^(X+1)** where X is IRTA_REG.S, with a maximum of 64K entries; each IRTE is **128 bits**. Values written to IRTA_REG take effect only after software executes the Set Interrupt Remap Table Pointer command. Hardware performs reserved-field checking, retrieves Source-id, Handle, SHV and Subhandle, computes and bounds-checks interrupt_index, then obtains the IRTE from the **Interrupt Entry Cache** or fetches it from the table. **Hardware must read the entire IRTE as a single operation and must not use multiple reads**, because software may change the IRTE contents atomically. If ECAP_REG.C (Coherent) is Clear, IRTE fetches do not snoop the processor caches; implementations reporting MTS = 1 in ECAP_REG must use write-back memory type for IRTE fetches.

**Step 5 — was this device allowed to raise this interrupt?** Order matters: **if the Present (P) field in the IRTE is Clear the request is blocked and treated as a fault; source-id checking per SVT, SID and SQ follows the presence check, and failure blocks the request.** The three fields together answer "is this device allowed to raise this interrupt?":
- **SVT** specifies the type of validation hardware must perform on the source-id of requests referencing this IRTE, and is evaluated only when P is Set.
- **SVT = 01b:** the **SID** field specifies the requester-id allowed to originate interrupt requests referencing the IRTE, and the **SQ** field determines which bits of SID are considered in the verification. SQ is evaluated only when P is Set and SVT is 01b, and exists to verify origination of requests from devices supporting **phantom functions**. Its encodings progressively ignore the least significant fields of the SID and requester-id: full comparison; comparison ignoring the third least significant field; ignoring the second and third; ignoring the least three significant fields.
- **SVT = 10b:** the upper 8 bits of SID contain a **Startbus#** and the lower 8 bits an **Endbus#**, and a referencing request must have a requester-id whose bus number lies within that range; this encoding may be used to verify interrupts originating behind PCI Express-to-PCI/PCI-X bridges.
- The SID field is evaluated only when P is Set and SVT is 01b or 10b.

**Where the source-id comes from — and the limit of the whole scheme.** Source-id validation is only as good as the source-id the platform can observe. To support domain isolation, platform hardware must be capable of uniquely identifying the requester for each interrupt message. For MSIs from PCI Express devices and root-complex integrated PCI/PCIe devices, the source-id **is the device's PCI requester-id**. But for devices **behind PCI Express-to-PCI/PCI-X bridges** the requester identifier may be that of the interrupting device *or* the bridge's secondary-interface bus number with device and function zero — because of this aliasing, interrupt-remapping hardware **does not isolate interrupts from individual devices behind such bridges**. The same holds for devices behind conventional PCI bridges, where the source-id is the legacy bridge device's requester-id. For legacy interrupt routing the **I/OxAPIC** generates the transaction, and interrupt remapping requires each I/OxAPIC to include a unique 16-bit source-id reported by BIOS through ACPI structures; other non-PCI-discoverable MSI-capable devices (e.g. integrated HPETs) must likewise be assigned unique non-conflicting 16-bit source-ids reported by BIOS through ACPI.

**Faults.** When an entry lookup or validation fails, the resulting fault reasons occupy a distinct numeric range, 20h–2Bh, enumerated in the chapter's §11.10.

**Citation given:** Intel VT-d Specification Rev 5.20 (April 2026) §5.1.1 (source-id origin), §5.1.2 / §5.1.2.1 / §5.1.2.2 (request formats), §5.1.3 (interrupt remapping table and interrupt_index), §5.1.4 and §5.1.4.1 (hardware operation and fault reasons), §9.9 (IRTE and SVT/SID/SQ), §11.4.10 (IRTA_REG). Skill bibliography reference [8].

---

### ooh-reported-results
**Routed to:** `16-performance.md` (routing row: "Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT"; no routing row names Out-of-Hypervisor directly)
**Actually answered from:** `references/errata.md` O6 (and E04); `references/14-nested-virtualization.md` §14.13; `references/16-performance.md` §16.7-cited claim and §16.11 item 7
**Answer:**
**The honest answer is that the knowledge base records two conflicting figure sets and deliberately does not choose between them.** This is an open conflict (errata entry **O6**, `C:low` / `C:medium`), and the skill's rule is to state both.

- **The SC'22 write-up reports:** EPML speeds up **CRIU checkpointing by 13×** and **Boehm garbage collection by 6×** compared to SPML, `/proc` and userfaultfd, **while leading to 16× less overhead on applications**.
  > "EPML speeds up CRIU checkpointing (by 13×) and Boehm garbage collection (by 6×) times compared to SPML, /proc, and userfaultfd while leading to 16× less overhead on applications."
- **The arXiv preprint (arXiv:2202.13483) abstract instead reports:** EPML **reduces CRIU checkpointing time by about 14%** while leading to **a negligible overhead of about 0.5%** compared to SPML, `/proc` and userfaultfd.
  > "The results show that EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%) compared to SPML, /proc, and userfaultfd."

The two figure sets come from **different versions of the same work** and are routinely mixed by secondary sources. Both are reproduced with their sources; they are **not averaged**, and no choice between them is made. Always say which version a number comes from. `16-performance.md` therefore carries these figures at `C:low` and lists the discrepancy in its unresolved-conflicts section rather than resolving it.

**Two pieces of context the skill attaches.** First, a publication-venue correction (errata **E04**): **OoH was published at SC'22** (IEEE/ACM Supercomputing, Dallas, November 2022), not SOSP'22; arXiv:2202.13483 (2022-02-27) is the preprint. The frequent attribution to SOSP 2022 is wrong. Second, what EPML is: Out of Hypervisor inverted the usual nesting framing — instead of emulating hardware inside a VM so a hypervisor can run there, it exposes individual hypervisor-oriented features (PML, SPP, CAT, EPT) to the guest OS so that **processes inside a VM** can use them; EPML is the page-modification-logging case study of that idea, compared against SPML, `/proc` and userfaultfd.

**Citation given:** Out of Hypervisor, SC'22 (IEEE/ACM Supercomputing, November 2022) and arXiv:2202.13483 — skill bibliography references [307], [308], [309]; recorded as errata entries E04 and O6 and in `14-nested-virtualization.md` §14.13. The chapter's Intel anchor for the underlying feature is SDM Vol.3C §31.3.6. This is a paper measurement, not Intel architecture, so per the skill's output standards the citation is the paper, not the SDM.

---

### hyperv-owns-vmx-root
**Routed to:** `17-windows-platform.md` §17.1 (routing row: "**Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, 'why no VT-x'**"; also called out in SKILL.md's "The Windows fact that resolves most questions")
**Actually answered from:** `references/17-windows-platform.md` §17.1, §17.1.1, §17.1.2, §17.2.1, §17.3 heading context, §17.7; corroborated by `references/15-security.md` §15.7 and `references/14-nested-virtualization.md` §14.12
**Answer:**
**The architectural fact.** **VMX root operation has exactly one owner per logical processor: the software that executed VMXON.** The architecture provides no way to share it, so a second hypervisor must either be given the hardware or be given an interface onto whoever holds it.

**Who that owner is on a Windows PC.** When the Windows hypervisor is running, it is that owner: **it launches before the Windows kernel, and the Windows installation the user interacts with becomes the root partition — a guest of the hypervisor, running in VTL0.** Hyper-V is a Type-1 hypervisor running directly on the hardware in VMX root operation, with everything else, including the Windows installation that manages it, in a partition. The root partition is privileged — it owns the physical device drivers, the virtualization management stack, and power/plug-and-play policy, and creates child partitions by making hypercalls — but it is still a guest.

**Why this is the normal state, not an exotic one.** Virtualization-based security is a Hyper-V-backed feature, so enabling it starts the hypervisor **even when the user never creates a virtual machine**; the same is true of every utility-VM feature — WSL2, Windows Sandbox, Docker Desktop, Defender Application Guard — and of the Hyper-V role itself. A VBS-enabled Windows PC is permanently in the nested configuration. The enablement question actually decomposes into four independent layers: (1) **silicon** — the processor must support VMX and second-level address translation; (2) **firmware** — virtualization enabled in firmware setup, with VT-d enabled separately for DMA protection and described to the OS; (3) **platform feature** — the Windows virtualization platform installed and enabled, which puts the hypervisor on the boot path; (4) **consumer** — something must actually want it, and the hypervisor's launch policy decides whether it starts. Layers 3 and 4 are separable, which is why **"Hyper-V is not installed" is not evidence that VMX is free.**

**What it means for a third-party VMM.** Any question of the form "why can't my hypervisor, driver or debugger use VT-x on this machine" resolves to the same answer: **Hyper-V already holds VMX root operation**, and the requesting software must either

- go through the **Windows Hypervisor Platform (WHP/WHPX)** — the API Hyper-V exposes so third-party VMMs can create and run partitions without owning the hardware (this is how VirtualBox, VMware Workstation, QEMU and the Android emulator run on such a machine);
- **run as a nested guest** — Hyper-V can expose virtualization extensions to a child partition so the guest may itself run a hypervisor; or
- **require that the hypervisor be turned off.**

Any third-party VMM on that machine is already running nested through the Windows Hypervisor Platform. Nesting does not remove the single-owner rule: the innermost VMM still does not own VMX root operation, and every exit it takes is mediated by the levels above it, which is why nested configurations compound the cost. On Intel hardware the inner hypervisor's control-structure accesses are the dominant nested cost — which is what the enlightened VMCS in the VP assist page and, in hardware, VMCS shadowing exist to reduce.

**How to tell from inside.** A guest can detect a hypervisor through CPUID: the hypervisor-present indication in the standard feature leaf is set by convention by hypervisors and is never set by physical hardware, and the leaf at 0x40000000 returns a hypervisor vendor identity string, followed by an interface-signature leaf. On a Windows PC with any Hyper-V-backed feature enabled, that detection succeeds **inside the ordinary desktop session**, because the desktop is itself in a partition — so software that treats "a hypervisor is present" as evidence of tampering will see it on a stock machine.

**Citation given:** Intel SDM Vol.3C Ch.26 "Introduction to Virtual Machine Extensions" (rev 092) for the single-owner property of VMX root operation. Everything Windows-specific is Tier-2: Microsoft Learn and the Hypervisor Top-Level Functional Specification — skill bibliography references [461], [462], [463], [465], [476], [479], [480]. Per the skill's output standards, Windows behaviour cites Microsoft, not Intel.

---

### enlightened-vmcs
**Routed to:** `17-windows-platform.md` (routing row: "**Hyper-V**, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection"), with `14-nested-virtualization.md` for the VMCS-shadowing side
**Actually answered from:** `references/17-windows-platform.md` §17.2.3, §17.2.5, §17.7, §17.9 table; `references/14-nested-virtualization.md` §14.3 and §14.12.2-area claim; `references/18-comparison-amd-arm-riscv.md` §188-area claim
**Answer:**
**What it is.** Each virtual processor under Hyper-V may enable a **VP assist page** by writing its guest-physical address to the synthetic MSR at **0x40000073**; the hypervisor overlays a per-processor structure there carrying assistance fields such as end-of-interrupt assist and virtualization-fault information. **The VP assist page also carries the enlightened VMCS: a guest hypervisor reads and writes an in-memory structure that Hyper-V consumes at VM entry instead of executing VMREAD and VMWRITE.** That is the interface a nested hypervisor uses on Windows.

**How it relates to VMCS shadowing.** They solve the same problem by different means. The cost being attacked is identical: **the price of the inner hypervisor's control-structure field accesses**, which on Intel hardware is the dominant nested cost. Without help, every VMREAD and VMWRITE an L1 hypervisor executes traps out, and L1 executes dozens of them per L2 exit.

- **VMCS shadowing** is the **hardware** answer: a secondary processor-based VM-execution control plus a shadow VMCS reached through the VMCS-link pointer, with VMREAD/VMWRITE bitmaps deciding per field which accesses the hardware may satisfy directly and which still exit. It requires that hardware control to exist on the part.
- **The enlightened VMCS** is the **software** answer: a shared-memory structure that an aware L1 uses instead of VMREAD/VMWRITE, which **removes the same exits that VMCS shadowing removes but in software and without needing the hardware control**. It is a software contract between Hyper-V and an enlightened inner hypervisor rather than an architectural facility. Because the guest writes plain memory, there is no trap to remove in the first place; Hyper-V reads the structure when it next enters the inner guest.

The skill states the relationship twice, from both sides: from the Windows chapter, "the enlightened VMCS addresses the same cost that VMCS shadowing addresses in hardware … by a software contract instead"; from the nested chapter, Hyper-V "additionally defines an 'enlightened VMCS' … which removes the same exits that VMCS shadowing removes but in software and without needing the hardware control". The comparison chapter adds that a memory-based enlightened structure in place of VMREAD/VMWRITE is also the workaround on the Intel side when hardware shadowing is unavailable, and the equivalent optimisation when running under another hypervisor.

**Where it sits in the wider picture.** It is one of Hyper-V's **enlightenments** — operations that would trap replaced by operations the hypervisor provides directly, each existing because the trapping version was measurably expensive (the reference TSC page for timekeeping, the EOI assist for interrupt completion, flush and IPI hypercalls, spinlock notification). The Windows chapter's feature map records nested support as "exposed to child partitions, with the enlightened VMCS" on Hyper-V, against "module parameter, hardware shadowing where available" for KVM. The confidence marker the skill attaches to the eVMCS claims is `C:medium`.

**What the skill does not give.** The chapters do not describe the enlightened VMCS **field layout, its version/revision negotiation, the clean-fields/dirty-bitmap mechanism, or the CPUID bits that advertise it** — **THE SKILL DOES NOT CONTAIN THIS.** It states only the location (VP assist page via MSR 0x40000073), the purpose, and the relationship to VMCS shadowing.

**Citation given:** Microsoft Hypervisor Top-Level Functional Specification (VP assist page, synthetic MSR 0x40000073, enlightened VMCS) — skill bibliography reference [461], with the nested-virtualization TLFS page as [316]; Intel SDM Vol.3C §27.6.15 and §27.10 for the VMCS-shadowing mechanism it is being compared with. Per the skill's output standards this is a Windows/Microsoft claim, so the authoritative citation is the TLFS, not the SDM.

---

### vtl-isolation-slat
**Routed to:** `15-security.md` (routing row: "… **VBS, HVCI, Credential Guard**, TXT"), with `17-windows-platform.md` for the Hyper-V-side description
**Actually answered from:** `references/15-security.md` §15.7; `references/17-windows-platform.md` §17.2.7, §17.6.1; `references/06-address-translation.md` referenced for the hardware
**Answer:**
**What a VTL is.** A **Virtual Trust Level** is a privilege dimension *inside a single Hyper-V partition*, orthogonal to ring level. A virtual processor can run at one of several VTLs, **higher levels being more privileged, each with its own memory access protections, its own interrupt state and its own private register state, with explicit hypercalls to call into and return from a higher level.** The architecture defines **up to 16 VTLs**; Windows ships two: **VTL0** for the normal kernel and user mode, **VTL1** for the secure kernel and the isolated user-mode processes ("trustlets") that depend on it. VTLs are hierarchical, so VTL1 is strictly more privileged than VTL0 — including more privileged than the VTL0 *kernel*.

**What hardware actually enforces the boundary.** **Second-level address translation — EPT on Intel parts.** Each VTL has its own set of guest-physical access permissions, assigned by the hypervisor, so VTL0 code cannot read or write VTL1 memory even though both run in the same partition. The decisive property is that these are **memory access permissions the hypervisor assigns with SLAT, which software inside the partition — including the VTL0 kernel — cannot change.** It is the same EPT permission machinery described in the address-translation chapter, applied to trust levels rather than to virtual machines. The VTL0 kernel's own page tables are irrelevant to the boundary: it can edit them freely and still cannot reach a guest-physical page whose EPT permissions the hypervisor has withheld.

**Why this design exists.** VBS is built on the assumption that the normal kernel can be compromised; the isolated environment becomes a root of trust for the OS. The consequence is that **a Windows PC can be a hypervisor host without hosting any virtual machine in the ordinary sense: the isolation boundary the feature needs is a VTL boundary inside one partition, not a second partition.** A trustlet at VTL1 user mode completes system calls by marshalling them to the Windows kernel running in VTL0 ring 0 — which is how it can be both protected from and dependent on the normal OS. The same VTL1 isolation is offered to application code as VBS enclaves: a user-mode enclave whose memory the normal OS cannot read, built on the hypervisor's SLAT enforcement rather than on a separate enclave instruction set.

**What it is used for, and the per-page shape of the enforcement.** HVCI puts the kernel code-integrity decision in VTL1, so the VTL0 kernel can execute only pages the secure kernel has validated, and kernel pages cannot be both writable and executable — expressed as a permission split across trust levels: a kernel page may be writable at VTL0 **or** executable at VTL0, but the secure kernel does not grant both at once, and the grant lives in the second-level translation permissions the more privileged level controls. Credential Guard is the other headline consumer, isolating LSA secrets in the LSAIso.exe trustlet.

**Platform requirements follow from the mechanism, not policy.** VBS needs a processor with virtualization extensions and second-level address translation — **VT-x with EPT on Intel** — enabled in firmware; the protections layered on top of it assume Secure Boot and a TPM for measurement. Because VBS requires the hypervisor to be running, a VBS-enabled Windows PC is permanently in the nested configuration in which Hyper-V owns VMX root operation.

**Citation given:** Intel SDM Vol.3C §31.3 and §31.3.2 (VMX support for address translation; EPT permissions) and Ch.31 generally for the hardware; Microsoft Learn and the Hypervisor Top-Level Functional Specification for the VTL model and VBS — skill bibliography references [378], [380], [381], [388], [395], [463], [476], [483]. Per the skill's output standards, VTLs are Windows architecture and cite Microsoft; only the SLAT/EPT enforcement carries an Intel anchor.

---

### tdx-tlb-tracking
**Routed to:** `13-tdx.md` §13.8 (routing row: "TDX: SEAMCALL/TDCALL leaves, TD lifecycle and legal call order, **Secure EPT (§13.8)**, attestation")
**Actually answered from:** `references/13-tdx.md` §13.8.5, with §13.8.2 (SEPT states) and §8.3.1-cited PAMT/BEPOCH claim
**Answer:**
**What "prove" means here.** TLB tracking exists to prove that **no logical processor holds a cached Secure EPT translation for a given TD private GPA range**; it is required before removing a mapped private page or changing a mapping size. Crucially, "cached address translation" for TLB-tracking purposes is broader than the TLB: it **includes TLB entries, cached paging-structure entries, and GPAs that the module has translated to HPAs and written into VMX control-structure fields for the CPU to read.** All three must be known-stale before the page can be pulled.

**The protocol, in order.** The GPA-range TLB-tracking sequence is:

1. **`TDH.MEM.RANGE.BLOCK` on each GPA range.** This blocks *creation of new* translations but **leaves existing cached ones valid**. (In the SEPT leaf state machine this moves MAPPED → BLOCKED and increments BLOCKED_COUNT; BLOCKED means the page is still mapped but new address translations to it are blocked, while BLOCKEDW blocks only write translations. `TDH.MEM.RANGE.UNBLOCK` and `TDH.MEM.PAGE.RELOCATE` decrement BLOCKED_COUNT.)
2. **`TDH.MEM.TRACK`, which advances the TD's epoch counter.** The epoch is the mechanism that makes "has this VCPU been through a transition since the block?" a checkable fact rather than a guess.
3. **An IPI to each remote logical processor running one of the TD's VCPUs.**
4. **Each such LP TD-exits on receipt of the IPI.**
5. **The VMM treats the exit as spurious and re-enters the TD.**

**The completion condition.** A GPA range is considered **tracked once every one of the TD's VCPUs has been inactive at least once after `TDH.MEM.TRACK`**; the subsequent TD entry on each VCPU flushes any stale entries. So the IPI is not itself the flush — it is a way to force each VCPU through an exit/entry pair, and the *entry* is what flushes. If the VMM knows the **active-VCPU count is zero** after `TDH.MEM.TRACK`, it may **skip the IPIs** entirely.

**When tracking is not required.** TLB tracking is not required when the TD's **OP_STATE implies no VCPU can run**, nor for SEPT entries whose state implies no cached translation can exist — **EXPORTED_BLOCKEDW, PENDING_EXPORTED_BLOCKEDW, FREE and REMOVED**.

**The bookkeeping that records it.** **BEPOCH** in the leaf PAMT entry records `TDCS.TD_EPOCH` at the moment the private page or SEPT page was blocked, and is meaningful only when PT is PT_REG, PT_EPT or PT_PR. That stored epoch is what the module compares against to decide whether the block predates all VCPUs' transitions.

**Why the host cannot shortcut it.** The host VMM is outside the TD's TCB; it manages physical memory but is not trusted to assert that no CPU holds a translation. The epoch counter plus the per-VCPU inactivity requirement turns the claim into something the TDX Module can verify itself from state the host cannot forge — which is why removal of a mapped private page is gated on it rather than on the host simply issuing an invalidation.

**Citation given:** Intel TDX Module Base Architecture Specification §9.7 (TLB tracking and `TDH.MEM.TRACK`), §9.2.1 and §9.2.2 (Secure EPT entry states and the leaf state diagram), §8.3.1 (PAMT BEPOCH). Skill bibliography reference [11].

---

### l1tf-mitigation-chain
**Routed to:** `15-security.md` §15.5 (routing row: "Transient-execution CVEs (**L1TF**/MDS/TAA/Spectre) and **mitigation MSRs**")
**Actually answered from:** `references/15-security.md` §15.5.1, §15.3, §15.4.1, §15.4.2, §15.4.3, §15.5.8
**Answer:**
**What the defect is.** L1TF is a **terminal fault**: when the paging-structure entry controlling an access has the Present bit clear or reserved bits set, the address bits of that entry may still be used **speculatively to read the L1 data cache**. Intel states that terminal faults can occur while reading **EPT entries** as well — which is why a VMM's own EPT paging-structure entries are part of the mitigation surface, not just the guest's page tables. L1TF has three CVEs by target: **CVE-2018-3615 (L1TF-SGX, the original Foreshadow), CVE-2018-3620 (L1TF-OS/SMM) and CVE-2018-3646 (L1TF-VMM)**, tracked by Intel as INTEL-SA-00161.

**Why it bites virtualization hardest.** The attacker in a multi-tenant VM setting legitimately controls a whole operating system, **including page tables**, so it can construct exactly the architectural preconditions the defect requires (non-present or reserved-bit entries). Sibling logical processors share the L1 data cache, so a co-resident VM is inside the same structure-sharing domain as its victim. And the victim is unusually valuable — the hypervisor's own memory or another tenant's memory — which is why Intel assigns a VMM-specific CVE.

**What a hypervisor actually has to do — the chain.**

1. **PTE inversion (OS side, and the hypervisor is an OS too).** This is purely a software convention about non-present entries: construct a mitigated entry so it refers to a **physical address that is below MAXPHYADDR but above the highest cacheable memory**, so the speculative L1D lookup can never hit real data. Linux states the rule as "the kernel ensures that the address bits of PTEs, which are not marked present, never point to cacheable physical memory space." The same reasoning applies to how a VMM lays out non-present EPT entries.
2. **L1D flush before each guest entry (VMM side).** "Setting bit 0 of IA32_FLUSH_CMD MSR to 1 removes all content, including secrets, from the L1D. **This flush must be repeated on every guest entry.**" IA32_FLUSH_CMD is at MSR **10BH**, write-only, bit 0 = L1D_FLUSH, enumerated by **CPUID.07H.00H:EDX[28]**.
3. **Check whether you need to flush at all.** A nested VMM that finds IA32_FLUSH_CMD enumerated should check **IA32_ARCH_CAPABILITIES (10AH) bit 3, SKIP_L1DFL_VMENTRY**, which indicates it is **not required** to flush L1D on VM entry — the skill calls this the single most important nested-mitigation interaction in the chapter. Also note **RDCL_NO (bit 0)** for parts not susceptible at all. A VMM must virtualize IA32_ARCH_CAPABILITIES **honestly**: telling a guest a mitigation is unnecessary when the underlying part needs it disables the guest's own defences.
4. **Policy knob.** Linux exposes this as `kvm-intel.vmentry_l1d_flush` with three values: `always` (flush on every VM entry), `cond` (flush only when the code between VM exit and VM entry can leak host memory) and `never` (mitigation disabled); **the default is conditional**. The conditional variants exist precisely because the unconditional ones are expensive — the flush is per-transition work that scales with exit rate.

**Why turning off hyperthreading is not the whole answer — in both directions.**

- **Flushing does not address a sibling thread executing concurrently.** Hyperthreads share the L1D, so with SMT enabled an attacker VM can sample data *after* the flush, while the victim is running on the other thread of the same physical core. The flush is a point-in-time operation at the transition; the sibling is a continuous leak channel. So SMT-off (or core scheduling — scheduling only mutually trusting work on sibling threads) is the residual option **on top of** the flush, not instead of it.
- **And equally, disabling SMT is not by itself a mitigation.** Intel's own wording, which the skill keeps verbatim because it is frequently mis-stated: **"Disabling hyperthreading does not in itself provide mitigation for L1TF."** A single-threaded core still leaks across a VM-exit boundary if the L1D is not flushed and non-present entries are not inverted. The two halves are complementary: PTE inversion + L1D flush handle the sequential (same-thread, across-transition) channel; SMT restriction handles the concurrent (cross-thread) channel.

**The cost, stated honestly.** Three of the transient-execution mitigations are per-transition work — L1D flush before each guest entry, the VERW buffer-clearing sequence, RSB filling on VM exit — and all scale with exit rate, which is why exit-reduction features and mitigation cost interact. One is per-context-switch work (IBPB between guests). One is **structural**: restricting which workloads may share a physical core, whether by disabling SMT outright or by core scheduling, which changes capacity planning rather than per-operation latency. Red Hat states that disabling HT has the perceived effect of **50% fewer vCPUs** for scheduling purposes, with a corresponding platform capacity impact — which is why the SMT option stayed controversial.

**One adjacent trap the chapter flags.** On processors reporting **FB_CLEAR (IA32_ARCH_CAPABILITIES bit 17)**, L1D_FLUSH does **not** overwrite fill-buffer values — so an L1TF mitigation that flushes L1D is **not automatically an MDS mitigation**, and the VERW sequence is still required.

**Citation given:** Intel SDM Vol.3C §31.3.2 and §31.3.3.2 (terminal faults, EPT entries, SMT exposure); Intel SDM Vol.4 §2.1 Table 2-2 "IA-32 Architectural MSRs" rev 092 (IA32_FLUSH_CMD 10BH, IA32_ARCH_CAPABILITIES 10AH and its bit definitions, CPUID enumeration bits); Intel's L1TF guidance / INTEL-SA-00161 and the Linux kernel L1TF documentation — skill bibliography references [5], [23], [351], [352], [353], [361], [367], [376].

---

### flexpriority-generation
**Routed to:** `01-vmx-intro.md` (routing row: "Enabling VMX, VMXON failures, CPUID/IA32_FEATURE_CONTROL, **VT-x history**"), with `errata.md` per SKILL.md step 3
**Actually answered from:** `references/errata.md` **O1** (open conflict) and `references/07-apic-virtualization.md` §7.2 and §7.12
**Answer:**
**This is a recorded open conflict and the skill deliberately does not pick a side.** Errata entry **O1** classifies it as an unresolved disagreement where the evidence genuinely conflicts, and the skill's rule for such entries is to state both readings and mark the conflict.

The two incompatible datings, neither refuted:

- **(a) 2006–2007 Core 2 (Merom / Penryn).** Silicon evidence: an `inxi` dump of a **Core 2 Duo T7700 (Merom, built 2006-09)** lists the `flexpriority` and `tpr_shadow` CPU flags, which places TPR-shadow-capable hardware in 2006.
- **(b) 2008, Xeon 7400 series.** Intel-side and review-press framing consistently dates the *introduction* of Intel VT FlexPriority to the **Xeon 7400 series in 2008**.

The likeliest reconciliation is **"hardware 2006, brand 2008"** — but **no source states that**, so both datings must be given and neither asserted. Confidence on the entry is `C:medium`; the APIC chapter carries the same flag at `C:low` and lists it in its open-items section, noting that no claim in that chapter depends on the answer.

**What FlexPriority actually is, which is the part that is not in dispute.** "FlexPriority" is **Intel's marketing name for TPR-shadow-based TPR virtualization, not a separate architectural facility**; the SDM describes the mechanism only as the "use TPR shadow" VM-execution control and TPR virtualization. Concretely: when "use TPR shadow" is 1 and "CR8-load exiting" is 0, MOV to CR8 writes bits 7:4 of the VTPR field in the virtual-APIC page instead of causing a VM exit, and MOV from CR8 reads it. With "use TPR shadow" set and "virtual-interrupt delivery" clear, a TPR-below-threshold VM exit (basic exit reason 43, trap-like) occurs when bits 3:0 of the TPR threshold field (VMCS encoding 401CH) exceed bits 7:4 of VTPR; the same comparison is made as part of VM entry. It was aimed at 32-bit guest operating systems that write TPR on every interrupt-priority change; on 64-bit guests the same register is reached through CR8, which the same control covers. With virtual-interrupt delivery set, the TPR threshold is not used, which is why the threshold mechanism belongs to the pre-APICv layer of the stack.

**Citation given:** Intel SDM Vol.3C Ch.32 and §27.6.8 for the mechanism (the SDM does not name FlexPriority or date it). The generation dispute is carried in this skill's `errata.md` **O1**, with sources [621] (the `inxi` silicon dump) and [622] (Intel-side / review-press Xeon 7400 framing) in the skill bibliography. There is no Intel specification anchor for a generation date, which is part of why the conflict stands.

---

### vmfunc-generation
**Routed to:** `01-vmx-intro.md` (routing row: "VT-x history"), with `errata.md` per SKILL.md step 3; the owning chapter turned out to be `02-vmcs.md` (VM-function controls) / `06-address-translation.md` (EPTP switching)
**Actually answered from:** `references/errata.md` **E06**; `references/06-address-translation.md` §6.13 open items; `references/02-vmcs.md` §2.8.5
**Answer:**
**Neither, on its own — the question's premise is the error.** Errata entry **E06** records exactly this misconception: "VMFUNC belongs unambiguously to one generation", quoted as either Haswell or Skylake with the other side dropped.

**The correction.** **The two attributions measure different things and both must be given:**
- the instruction **entered the ISA documentation in the Haswell / Silvermont era**;
- **hardware availability is commonly dated to Skylake in engineering practice** (Xen and KVM support landed 2015–2016).

The skill prescribes the exact wording: write it as **"VMFUNC entered the SDM in the Haswell era; hardware availability is usually dated to Skylake"**, and **do not assert a single generation**. Confidence `C:medium`, durable. The address-translation chapter states the same thing from its side: the generation in which VMFUNC and EPTP switching became available in shipping silicon is disputed in the legacy research notes (an instruction-set definition dated to the Haswell era versus attributions to a later server generation) and is deferred to `errata.md` rather than asserted (`C:low`).

**What is not disputed — the architecture.** The VM-function controls are a **64-bit field at VMCS encoding `0x2018`** that exists only when the **enable-VM-functions secondary control (secondary bit 13)** is 1; **bit 0 of the field enables EPTP switching**. When EPTP switching is enabled, the **EPTP-list address field at `0x2024`** points at a 4-KByte-aligned list of **512 eight-byte EPTP values** that guest software may select between with VMFUNC **without causing a VM exit**. Capability is reported by **IA32_VMX_VMFUNC at MSR 491H**, a single 64-bit allowed-1 mask, whose **bit 0 reports support for the EPTP-switching VM function**. VM entry checks that, if "enable VM functions" is 1, the VM-function controls set no bit IA32_VMX_VMFUNC does not report, and that if EPTP switching is enabled then "enable EPT" is 1 and the EPTP-list address is 4-KByte aligned and within the physical-address width.

So the practically useful answer to "which generation do I need?" is not a codename at all: **read IA32_VMX_VMFUNC bit 0** (and IA32_VMX_PROCBASED_CTLS2 bit 13). The skill notes separately that there is no CPUID leaf enumerating VMX features — all finer-grained VMX discovery is through the IA32_VMX_* MSRs.

**Citation given:** Intel SDM Vol.3C §27.6.14 (VM-function controls, EPTP-switching, EPTP-list address) and Ch.29 (the VM-entry checks); SDM Vol.3D App.A (IA32_VMX_VMFUNC at 491H, allowed-1 mask, bit 0). The generation dispute itself has no Intel anchor and is carried in this skill's `errata.md` **E06**, sources [609] (ISA documentation "Added in: Haswell, Silvermont") and [610] (Skylake-era availability in engineering practice).

---

### tdx-aes-key-strength
**Routed to:** `13-tdx.md` (routing row: "TDX: SEAMCALL/TDCALL leaves, TD lifecycle …"), with `errata.md` per SKILL.md step 3
**Actually answered from:** `references/errata.md` **O3** (open conflict); `references/13-tdx.md` §13.4.5
**Answer:**
**Neither answer is unconditionally correct — this is a recorded open conflict (errata O3), and the honest answer is "it depends on the generation, and the two sources do not state it the same way."**

**What the two sources say:**
- **The TDX base architecture** describes the MKTME / TME-MK engine as providing memory encryption using **AES-128-XTS**.
- **Intel's TDX feature-readiness support article** gives the TDX AES key strength as **128 bit on 4th-Gen and 5th-Gen Xeon, and 256 bit on Xeon 6** (both E-core and P-core).

Both appear in Intel material and the difference is **generation-dependent**, but the two sources do not state it the same way, so the conflict is recorded rather than resolved (`C:medium`). The prescribed handling: **state the generation with the number, and do not write an unqualified "TDX uses AES-128-XTS"** until the base specification's own text has been re-read for a per-generation qualifier. The TDX chapter puts it as: the TDX ISA specification defines the TME-MK interoperation but **does not fix a data-encryption key length**; Intel's per-generation feature-readiness matrix reports 128 bits for 4th/5th-Gen Xeon and 256 bits for Xeon 6, **so any blanket statement that "TDX is AES-128-XTS" is generation-specific and wrong as a general claim.**

**One place where 128 bits is definite and is a different quantity.** Do not conflate the *data* encryption key with the XTS *tweak* key. In **Cryptographic Integrity (Ci)** mode the memory controller computes a **28-bit MAC** per cache line over the ciphertext, a **128-bit encryption tweak**, the TD Owner bit and a **128-bit MAC key**; the tweak is produced by encrypting the physical address with a **128-bit per-HKID ephemeral AES-XTS tweak key** generated at key configuration time (`TDH.SYS.KEY.CONFIG` / `TDH.MNG.KEY.CONFIG`). That 128-bit figure is the tweak key and the MAC key, stated unambiguously; it is not the data-encryption key length the question is about. (On platforms that do not use ACT, TDX supports two integrity modes: Ci as above, and **Logical Integrity (Li)** where memory is encrypted and protected by the TD Owner bit alone; in both modes the memory controllers store a 1-bit TD Owner metadatum per cache line, covered by ECC.)

**Citation given:** Intel TDX Module Base Architecture Specification §16.2 (Ci/Li integrity modes, 128-bit tweak and MAC keys) and §5.2 / TDX ISA Ch.2 (TME-MK integration, no fixed data-key length) — skill bibliography references [11] and [14]; Intel's TDX feature-readiness support article for the per-generation 128/256-bit figures — reference [251]/[585]. Recorded as open conflict **O3** in this skill's `errata.md`.

---

## Contamination disclosure (applies to the whole file)

While inspecting the YAML structure of `eval/questions.yaml` to build a safe extraction filter, I incidentally saw the `must_include` and `required_citation` fields of the **first two LOOKUP questions** (`vmcs-encoding-derive` and `tertiary-controls-encoding-and-msr`). Neither is a `mechanism` question, so neither is in this subset and no answer above is affected. After that I verified a regex that emits only `id` / `type` / `question`, confirmed it matched all 80 records with the expected type counts (lookup 24, mechanism 24, diagnosis 20, trap 12) and that every question string was complete on one line, and used only that filtered output. **No expected-answer field for any mechanism question was seen.**
