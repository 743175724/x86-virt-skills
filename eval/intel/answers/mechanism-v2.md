# intel-vt eval — `type: mechanism` (24 questions)

Skill: `C:\Users\Administrator\Desktop\Kimi_Agent\intel-vt\`, entry `SKILL.md`.
Extraction: only `id` / `type` / `question` were read, via a `node -e` regex filter that printed
`id<TAB>question` and a count on stderr. `chapter`, `must_include`, `must_not_include`,
`required_citation` and `notes` were never read or displayed. No accidental exposure occurred.

Routing was fixed for all 24 questions from the `SKILL.md` §Routing table alone, before any
chapter file was opened.

---

### vm-entry-check-order
**Routed to:** `04-vm-entry.md` §4.9 (routing row "VM-entry checks, **why VM entry failed**, event injection")
**Actually answered from:** `04-vm-entry.md` §4.1, §4.2, §4.3 (+§4.3.1–§4.3.5), §4.4, §4.5, §4.6 (+§4.6.1), §4.7 (+§4.7.1), §4.8 (+§4.8.1), §4.9, §4.10, §4.11; `errata.md` (checked — no entry bears on VM-entry ordering; E20 only fixes the SDM chapter numbering)
**Answer:**

A VM entry is not a jump. It is a long sequence of architecturally specified checks followed by a bulk state load, performed only by VMLAUNCH or VMRESUME and only in VMX root operation (executing either in non-root operation causes a VM exit, not a nested entry).

The SDM's ordered steps are:

1. Basic checks on the instruction and the current VMCS.
2. Checks on the VMX controls and on the host-state area.
3. *In parallel or in any order* — the guest-state checks, the loading of guest state, and the clearing of address-range monitoring.
4. Loading of MSRs from the VM-entry MSR-load area.
5. For VMLAUNCH, setting the VMCS launch state to "launched".
6. Trace-address pre-translation (TAPT), if the "Intel PT uses guest physical addresses" VM-execution control is 1.
7. Event injection, if requested.

Chapter 04 splits SDM step 3 into its checking half (§4.5) and its loading half (§4.6), so its own stage numbers run one ahead of the SDM's from there on. Walking it in that expanded form:

**Stage 1 — basic VMX information and instruction-state requirements (§4.2).** #UD outside VMX operation, in real-address mode, in virtual-8086 mode, or in compatibility mode (EFER.LMA = 1 with CS.L = 0); #GP(0) at CPL > 0. VMfailInvalid if the current-VMCS pointer is FFFFFFFF_FFFFFFFFH (there is no VMCS in which to record an error number). VMLAUNCH fails with error **4** if the launch state is not "clear"; VMRESUME fails with error **5** if it is not "launched"; error **26** if there is blocking by MOV SS at the time of the instruction. VMLAUNCH/VMRESUME also fail if the current VMCS is a shadow VMCS. Launch state is set "clear" only by VMCLEAR and "launched" only by a successful VMLAUNCH, and no instruction reads it back, so software must track it.

**Stage 2a — the VMX controls (§4.3).** Every failure here reports VM-instruction error **7**, "VM entry with invalid control field(s)", which does not say *which* control was wrong. Reserved-bit settings are checked against the capability MSRs; the secondary controls are checked only when primary bit 31 ("activate secondary controls") is 1, and the tertiary controls only when primary bit 17 ("activate tertiary controls") is 1. Then a long list of dependency checks, among them: NMI exiting / virtual NMIs / NMI-window exiting consistency; CR3-target count ≤ 4; 4-KByte alignment and physical-address-width limits on the I/O bitmaps, MSR bitmap, virtual-APIC address, APIC-access address, PML address, EPTP-list address, VMREAD/VMWRITE bitmaps, #VE information address, SPPTP and HLATP; "virtualize x2APIC mode" and "virtualize APIC accesses" not both 1; virtual-interrupt delivery requires external-interrupt exiting; "process posted interrupts" requires virtual-interrupt delivery **and** "acknowledge interrupt on exit", notification-vector bits 15:8 zero and a 64-byte-aligned descriptor; VPID ≠ 0000H when "enable VPID" is 1; EPTP memory type / walk length / A-D-enable / reserved bits; "enable EPT" required by unrestricted guest, PML, MBEC, SPP, Intel-PT-uses-GPA, PEBS-uses-GPA, HLAT, EPT paging-write control and guest-paging verification; TSC multiplier non-zero when TSC scaling is on. VM-exit and VM-entry control checks follow (MSR-list alignment and extent when the count is non-zero; preemption-timer consistency; secondary VM-exit controls via IA32_VMX_EXIT_CTLS2; "entry to SMM"/"deactivate dual-monitor treatment" mutual exclusion and the not-in-SMM rule). The checks on the VM-entry interruption-information field are also control checks and also produce error 7.

**Stage 2b — host state (§4.4).** Failure reports error **8**, "VM entry with invalid host-state field(s)". Host CR0/CR4 against the FIXED0/FIXED1 MSRs (CR0.NW and CR0.CD are never checked, because VM exit does not change them); CR4.CET ⇒ CR0.WP; host CR3 within physical-address width with bit 63 clear; canonical SYSENTER_ESP/EIP, FS/GS/GDTR/IDTR/TR bases; IA32_PAT byte legality; IA32_EFER LMA and LME both equal to "host address-space size"; selectors with RPL = TI = 0, CS and TR non-zero; the "host address-space size" consistency set (PCIDE/FRED/RIP-high-bits when 0, CR4.PAE and canonical RIP when 1, and the rule tied to IA32_EFER.LMA at the time of entry).

**Stage 3 — guest state (§4.5).** Control/debug registers and MSRs, segment registers and access rights, descriptor-table registers, RIP/RSP/RFLAGS, non-register state (activity state, interruptibility, pending debug exceptions, VMCS-link pointer), PDPTEs, and the IA-32e-mode consistency set (CR0.PG / CR4.PAE / EFER.LME / EFER.LMA / "IA-32e mode guest" / CS.L). **The failure mode changes here**: a guest-state failure is reported as basic exit reason **33** with the VM-entry-failure bit set.

**Stage 4 — loading guest state (§4.6).** CR0 (except ET, the reserved bits, NW and CD, which are never modified and whose field values are ignored), CR3 and CR4 in full, DR7 if "load debug controls" (bits 12 and 15:14 forced to 0, bit 10 forced to 1), the control-selected MSRs, segments with hidden parts, GDTR/IDTR, RIP/RSP/RFLAGS, the preemption-timer value; address-range monitoring is cleared. GPRs and x87/SSE/AVX state are *not* in the VMCS and are not loaded — the VMM restores them in software. VM entry never walks the guest GDT/LDT/IDT, never validates guest CR3, never saves host state, and (with VPID enabled) invalidates nothing.

**Stage 5 — VM-entry MSR-load area (§4.7).** 16-byte entries processed in order as if by WRMSR. An entry fails if bits 63:32 are non-zero; if the index is IA32_FS_BASE (C0000100H) or IA32_GS_BASE (C0000101H); if it is in the x2APIC range 00000800H–000008FFH; if it names an SMM-only MSR while the entry did not commence in SMM; if the processor refuses it model-specifically; or if WRMSR at CPL 0 would #GP. Failure is basic exit reason **34**, with the **1-based failing index in the exit qualification**.

**Stage 7 — event injection (§4.8).** Only if bit 31 (valid) of the VM-entry interruption-information field is 1, evaluated after guest state and MSRs are loaded and before the first guest instruction. Type and vector legality, the deliver-error-code rules (including the IA32_VMX_BASIC[56] dependency), the nested-exception bit (IA32_VMX_BASIC[58]), and the instruction-length range 0–15 for software events. Delivery uses the guest IDT; a fault during that delivery is subject to the exception bitmap and can exit immediately with a valid IDT-vectoring field. An injecting VM entry leaves the processor **active** whatever the activity-state field said, and clears STI/MOV-SS blocking.

**Why some failures land after VMLAUNCH and others at your host RIP.** The split is exactly the boundary at which guest state has been touched.

- Stages 1, 2a and 2b are completed **before any VM entry starts**. Nothing guest-visible has changed, so the processor can simply not enter: control passes to the instruction following VMLAUNCH/VMRESUME under the VMfail protocol — RFLAGS.CF = 1 with ZF = 0 and no error number (VMfailInvalid, used when there is no current VMCS to record one), or RFLAGS.ZF = 1 with CF = 0 and the error number written into the VM-instruction error field (VMfailValid).
- Stage 3 and stage 5 are different because **the guest-state checks and the guest-state load happen concurrently** (SDM step 3 is "in parallel or any order"). By the time a guest-state check fails, some of the processor's architectural state has already been overwritten from the guest-state area, so there is no intact context to return to. The processor therefore recovers the way a VM exit does: it loads host state from the host-state area and resumes at the **host RIP**, recording the failure in the exit-reason field with bit 31 (the VM-entry-failure indicator) set — 8000_0021H for reason 33, 8000_0022H for reason 34. MSR-load failures (stage 5) share this shape because MSR loading happens after guest state is loaded. Basic exit reason **41** is the same shape for a machine-check event during VM entry.

Consequences of the second shape that a VMM must code for: only the exit-reason and exit-qualification fields are updated — **all other VM-exit information fields are left unmodified, not undefined**; the guest-state area is not modified; no MSRs are stored to the VM-exit MSR-store area; the valid bit in the injected-event identification field is **not** cleared; NMI blocking is whatever it was before the entry; MSRs are still loaded from the VM-exit MSR-load area. And because host state was loaded, the VMM's own register context after the failure is the host-state area's context, not the context that executed VMLAUNCH — a VMM that kept state in registers across the entry must reload it in its exit path.

Exit qualification for reason 33 is 0 in most cases; the only non-zero values are **2** (PDPTE loading), **3** (NMI injection blocked by STI) and **4** (invalid VMCS-link pointer), with 1 unused. Guest-state checks may run in any order, so one reported cause does not rule out others and different processors may report different qualifications for the same VMCS.

Debugging order (§4.10): read RFLAGS immediately after the instruction (CF ⇒ bad VMCS pointer; ZF ⇒ VMREAD the error field: 7 = controls, 8 = host state, 4/5/26 = VMCS lifecycle). If control reached your host RIP instead, VMREAD the exit reason and test bit 31 *first*; then separate 33 / 34 / 41. For 34 the offending entry is at `msr_load_area + 16 * (qualification - 1)`.

**Citation given:** Intel SDM Vol.3C Ch.29 "VM Entries" (rev 092), specifically §29.2.1.1–§29.2.1.3 (control checks), §29.2.2–§29.2.4 (host-state checks), §29.3 and §29.3.1.5 (guest-state checks), §29.3.2.1/§29.3.2.5 (guest-state load), §29.4 (MSR loading), §29.5 (TAPT), §29.6/§29.6.1.1/§29.6.2 (injection), §29.7.1/§29.7.2 (post-entry state), §29.8 (failure semantics); SDM Vol.3C Ch.33 / §33.4 (VMfail protocol and error numbers); SDM Vol.3D App.C (basic exit reasons 33, 34, 41); SDM Vol.3C §27.9.1 (exit-reason field bit 31)
**Disagreement:** None on the ordering or the two failure shapes. (One adjacent wording problem inside §4.3.1 is recorded under `default1-controls-and-true-msrs`.)

---

### pir-virr-merge-and-on-sn-race
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `07-apic-virtualization.md` §7.8.2, §7.8.3, §7.8.4 (with §7.6.3/§7.6.4 for what follows the merge); `errata.md` (checked — no entry on posted-interrupt ordering)
**Answer:**

**The posting side first.** A poster — another logical processor's ICR write, the IOMMU on behalf of a passed-through device's MSI/MSI-X, or VMM software — does:

```
set PIR[Vector]
if SN = 1:            done          # deliberately silent
if ON was already 1:  done          # a notification is already in flight
set ON
send an interrupt with vector NV to the processor identified by NDST
```

The ON test is what collapses a burst of postings into a single notification. The descriptor is 64 bytes, 64-byte aligned: PIR in bits 255:0, ON at bit 256, SN at bit 257, NV at bits 279:272, NDST at bits 319:288.

**The receiving side — posted-interrupt processing, seven steps, in this order:**

1. Acknowledge the local APIC, which yields the physical vector.
2. If that physical vector is **not** the notification vector NV, this was not a notification: take an ordinary external-interrupt VM exit with the vector recorded in the exiting-event identification field.
3. Clear **ON**, atomically (a locked AND that leaves the rest of the descriptor alone).
4. Write 0 to the local APIC's EOI register, dismissing the notification interrupt.
5. `VIRR <- VIRR OR PIR` and `PIR <- 0`, atomic **as a pair** (read-and-clear).
6. If any bit was set in PIR, `RVI <- max(RVI, highest index set in PIR)`. If PIR was empty, **RVI is left unmodified** — not recomputed.
7. Evaluate pending virtual interrupts (§7.6.3), which may immediately recognise and deliver one.

The processor performs all seven **uninterruptibly**. Two orderings inside are easy to get wrong and are stated explicitly by the chapter: ON is cleared at step 3 and PIR is read at step 5, so ON is cleared **before** PIR is read — but **after** the local-APIC acknowledge at step 1. A rendering that clears ON first has the correctness property right and the step order wrong.

Note also the trigger boundary: posted-interrupt processing happens **only** on arrival of an interrupt whose vector is NV while "process posted interrupts" is 1 in VMX non-root operation; the notification itself causes no VM exit. **VM entry does not perform posted-interrupt processing** — a VM entry with virtual-interrupt delivery set loads RVI and SVI from the guest-interrupt-status field, performs PPR virtualization and evaluates pending virtual interrupts, and nothing more. So a VMM must drain the PID into VIRR/RVI itself before entry, or an interrupt posted while the vCPU was descheduled waits for the next notification.

**Why the order is the correctness argument, not an implementation detail.** Consider a poster running concurrently with the target's merge. Because ON is cleared *before* PIR is read, the window in which a poster can observe stale state is exactly the window between those two steps. A poster that lands in it sees ON = 0, sets its PIR bit, sets ON, and sends a notification. Two outcomes are possible and **both are safe**:

1. The poster's PIR bit is written before the target's atomic read-and-clear. The bit is merged into VIRR immediately, and the notification that arrives later finds PIR empty — a spurious notification whose only cost is one merge that moves nothing (and step 6 leaves RVI untouched, so it changes no architectural state beyond dismissing itself).
2. The poster's PIR bit is written after the read-and-clear. The bit stays in PIR, ON is set, and the notification the poster sent causes a second round of posted-interrupt processing that picks it up.

Had ON been cleared *after* PIR was read, a poster landing between the read and the clear would have seen ON = 1, **skipped the notification**, and left its bit in a PIR the target had just emptied — a lost interrupt. That is the whole argument: clearing ON before the atomic read-and-clear of PIR is what makes the protocol lossless, and the worst case is a redundant notification, never a dropped vector.

**SN's role in the same race.** SN exists to shut off notifications while the target vCPU is not in a position to use them: a VMM sets SN when the vCPU is descheduled or running in host context, and interrupts still accumulate in PIR for the next merge. (Measured in KVM: setting SN while the CPU runs in host context improved `perf bench sched pipe` by 6.56% and cut posted-interrupt notifications from tens of thousands per second to hundreds, at a cost of about 1.58% on the VM-exit round trip.) A VMM that *blocks* a vCPU instead repoints NV at a host wake-up vector and NDST at the host CPU so a posting wakes the vCPU through the host interrupt path, and it must refuse to block if ON is already set.

One further architectural permission makes all of this legal: the posted-interrupt descriptor is the second exception to SDM §27.11.4 — unlike most VMCS-referenced structures it *may* be modified while a logical processor whose current VMCS references it is in VMX non-root operation, but only with locked read-modify-write or other atomic operations.

After step 7, everything is ordinary virtual-interrupt delivery (§7.6.4); the merge is the junction between the posting half and the delivery half of the feature.

**Citation given:** Intel SDM Vol.3C §32.6 (posted-interrupt processing, steps 1–7), §32.2.1/§32.2.2 (evaluation and delivery), §29.3.2.5 (what VM entry does instead), §27.6.8 (posted-interrupt descriptor address and the control dependencies), §27.11.4 (the modification exception), SDM Vol.3C Ch.32 (descriptor layout); the KVM SN measurement is a non-specification source carried by the chapter as `[120]`
**Disagreement:** My prior belief matched the chapter's *correctness* claim (ON cleared before PIR is read) but I would have placed the ON clear as the **first** step of the sequence. The chapter states the clear is step 3, after the local-APIC acknowledge (step 1) and before the EOI write (step 4), and calls out that ordering explicitly as the thing renderings get wrong. I record the skill's version as authoritative.

---

### vmcs-shadowing-mechanism
**Routed to:** `14-nested-virtualization.md` (routing row "Nested VMX, **VMCS shadowing**, vmcs02, nested EPT")
**Actually answered from:** `14-nested-virtualization.md` §14.2, §14.3.1–§14.3.4 (with §14.2 for vmcs01/12/02 and `04-vm-entry.md` §4.2 for the entry-side prohibition); `errata.md` (checked — nothing on shadowing)
**Answer:**

**The problem it solves.** Without help, every VMREAD and VMWRITE L1 executes traps to L0. L1 executes dozens of them per L2 exit, which is the largest single component of exit multiplication. VMCS shadowing removes those exits by letting the hardware satisfy L1's accesses out of a real VMCS that L1 is allowed to touch while in VMX non-root operation.

**The pieces.**

1. **The control.** "VMCS shadowing" is a secondary processor-based VM-execution control — bit 14 of that 32-bit vector — and support for its 1-setting is discovered in IA32_VMX_PROCBASED_CTLS2.
2. **The shadow-VMCS indicator.** Every VMCS is either ordinary or shadow, and the type is carried by **bit 31 of the first 4 bytes of the VMCS region**: 0 ordinary, 1 shadow. Bits 30:0 of the same doubleword are the VMCS revision identifier. (IA32_VMX_BASIC bit 31 is always 0, which is what frees bit 31 of the region's first dword for this use.) VMPTRLD fails if the indicator is 1 on a processor that does not support the control, and software must VMCLEAR a VMCS before changing its indicator, because changing it while the VMCS is active may corrupt it.
3. **The VMCS-link pointer.** A 64-bit field of the guest-state area (guest non-register state). When "VMCS shadowing" is 1, VMREAD and VMWRITE executed in non-root operation access **the VMCS referenced by this pointer**. When the control is 0, software should set it to FFFFFFFF_FFFFFFFFH to avoid VM-entry failures. With the control on, VM entry checks that any VMCS referenced by the link pointer **is** a shadow VMCS; an invalid VMCS-link pointer is one of the enumerated VM-entry failure causes (exit reason 33, qualification 4). The shadow VMCS belongs to the VMCS-link pointer of **vmcs01** — the VMCS that runs L1 — not to vmcs02.
4. **The two bitmaps.** On processors supporting the control, the VM-execution control fields include the 64-bit physical addresses of a **VMREAD bitmap** and a **VMWRITE bitmap**, each 4 KBytes and therefore 32 KBits. VMREAD in non-root operation causes a VM exit if the control is 0, **or** the source operand sets any bit in 63:15, **or** the VMREAD bit corresponding to bits 14:0 of the operand is 1; otherwise it reads the VMCS referenced by the link pointer. VMWRITE is symmetric with the VMWRITE bitmap. The bit is located arithmetically: with x = operand bits 14:0 and `addr` the bitmap address, it is bit position `x & 7` of the byte at physical address `addr | (x >> 3)`.

So the bitmaps are a **per-field intercept policy**: L0 clears a bit for each field it is willing to let L1 read or write directly out of the shadow VMCS, and sets a bit for every field whose access it must still emulate. Because any encoding with a bit set in 63:15 always exits, only the low 32K of the encoding space can ever be shadowed. (KVM builds the bitmaps at module init from two tables — read-only shadow fields and read/write shadow fields — after memsetting both bitmaps to 0xFF, so everything not listed stays intercepted.)

5. **Synchronisation with vmcs12.** The shadow VMCS is hardware-format memory; vmcs12 is L0's software image of L1's intent, and they must be reconciled at every transition where either side could have changed. Before L0 resumes L1 with shadowing enabled, L0 copies the shadowed fields from vmcs12 into the shadow VMCS (KVM: `copy_vmcs12_to_shadow()`). When L1 next exits to L0, L0 copies the writable shadowed fields back out of the shadow VMCS into vmcs12 before interpreting L1's intent (KVM: `copy_shadow_to_vmcs12()`, "Copy the writable VMCS shadow fields back to the VMCS12, in case they have been modified by the L1 guest"). Fields that are not shadowed keep trapping, so L0 sees those writes immediately and needs no synchronisation for them — which is why the shadow set is chosen as the fields L1 touches most often per L2 exit, not as "all fields".

**What stops a guest hypervisor from simply running its guest out of the shadow VMCS.** A shadow VMCS differs from an ordinary VMCS in **exactly two** ways: (a) VMREAD/VMWRITE executed in VMX non-root operation can access it, and (b) **it can never be used for VM entry — VM entry fails if the current VMCS is a shadow VMCS.** That is the architectural stop. L1 can read and write the shadow VMCS all it likes; the moment it executes VMLAUNCH/VMRESUME, two things independently prevent the hardware from running L2 from it: the VMX instructions themselves cause VM exits in non-root operation (so L1's launch traps to L0 anyway), and even in root operation a shadow VMCS is not a legal source of guest state for an entry. The shadow is a *data* surface, never an *execution* surface. L0 keeps the real execution surface — vmcs02 — entirely under its own control and builds it by merging vmcs01 and vmcs12 (§14.4).

Note also that in **VMX root operation** both ordinary and shadow VMCSs can be accessed with VMREAD and VMWRITE, so L0 reads and writes the shadow VMCS with the same instructions L1 uses — there is no privileged back door and no architecturally defined layout. That matters because the VMCS data format is architecturally implementation-specific (bytes 8 and beyond are "VMCS data (implementation-specific format)" reachable only through VMREAD/VMWRITE), which is what lets vmcs12 be an ordinary software structure in the first place; L0 must still hand L1 a revision identifier it is prepared to emulate, since VMPTRLD fails on a mismatch.

**Citation given:** Intel SDM Vol.3C §27.10 (shadow VMCS definition and the two differences), §27.2 (VMCS region, revision identifier, shadow-VMCS indicator), §27.4.2 (VMCS-link pointer), §27.6.2 and Vol.3D App.A.3.3 (the secondary control and its capability MSR), §27.6.15 (VMREAD/VMWRITE bitmap addresses), Ch.33 (VMREAD/VMWRITE non-root behaviour and the bit-location arithmetic), §29.3.1.5 (the entry check on the link pointer); KVM function names are carried by the chapter as non-specification source `[301]`
**Disagreement:** None.

---

### vmcs02-merging
**Routed to:** `14-nested-virtualization.md` (routing row "Nested VMX, VMCS shadowing, **vmcs02**, nested EPT")
**Actually answered from:** `14-nested-virtualization.md` §14.2, §14.4.1, §14.4.2, §14.4.3, §14.4.4 (+§14.6 for the EPTP); `errata.md` (checked — nothing applicable)
**Answer:**

**The three structures.** `vmcs01` is built by L0 and describes how L0 runs L1 — the hardware loads it while L1 runs. `vmcs12` is built by L1 and describes how L1 wants to run L2 — **the hardware never loads it**; it is a memory image L0 interprets. `vmcs02` is built by L0 and describes how L0 actually runs L2 — the hardware loads it while L2 runs. (The names are KVM's and the Turtles paper's: VMCS01, VMCS12, VMCS02.)

**State merging (§14.4.1).**

- **Host-state area of vmcs02 comes from vmcs01.** The processor loads host state from the current VMCS on every VM exit, so an exit from L2 must land in **L0's** host state, never L1's.
- **Guest-state area comes from vmcs12** — L1's chosen register and non-register state for L2 — with L0 overriding the fields it owns, including the VMCS-link pointer. The ordinary guest-state checks of VM entry then apply to the merged result.
- KVM splits the work into a rarely changing part (`prepare_vmcs02_early()`, controls and vmcs01-derived fields) and a per-entry part (`prepare_vmcs02()`, guest state from vmcs12).

**Control merging (§14.4.2) — and this is where the unions and intersections live.** The rule is not uniform, and the chapter states the principle: **for intercepts L0 needs the union** (anything either level wants to trap must trap, because only L0 can catch it); **for permissions L0 needs the intersection** (a bypass is safe only if both levels allow it).

Unions:
- **Exception bitmap** — union of vmcs01's and vmcs12's, because an exception either level wants to intercept has to cause a real VM exit to L0 first.
- **Pin-based controls** — unioned, with the VMX-preemption timer treated specially; L0 must keep its own external-interrupt and NMI exiting regardless of what L1 asked for, because host interrupts must reach L0.
- **The "exiting" processor-based controls** — unioned with vmcs12's.
- **CR0 and CR4 guest/host masks** — unioned (a bit owned by either level must trap), while the **read shadows** are *composed* so that L2 observes the value L1 intends it to observe.

Intersections:
- **MSR bitmaps** — an MSR may be passed through to L2 only if **both** vmcs01 and vmcs12 permit it, so the merged bitmap is the **intersection of the two pass-through sets**, equivalently the union of the two intercept sets. If L1 does not use MSR bitmaps at all, L0 must intercept every MSR access.

Neither, or special:
- **Page faults** are the awkward case: there is a single page-fault error-code mask/match pair in the VMCS, so when L0 and L1 want different #PF intercept policies L0 cannot express both at once and must fall back to intercepting **all** page faults and filtering in software.
- **I/O** — rather than merge the two 4-KByte I/O bitmaps (8 KBytes total, ports 0000H–7FFFH and 8000H–FFFFH), KVM sets **unconditional I/O exiting** in vmcs02 and clears "use I/O bitmaps", then consults vmcs12's I/O bitmap in software to decide whether the exit belongs to L1.
- **L0's own mechanism-selecting controls** — enable EPT, enable VPID, unrestricted guest and the secondary controls behind them are set from **L0's** configuration and are not copied from vmcs12.
- **TSC offsets compose additively**: with no TSC scaling, the offset in vmcs02 is the sum of L0's offset for L1 and the offset L1 programmed for L2. With TSC scaling active the two multipliers compose multiplicatively and L0's offset is first scaled by L1's multiplier before the two offsets are added.
- **EPTP** — vmcs02's EPTP always points at an EPT structure **L0** controls (EPT02); L1's EPTP value from vmcs12 is data to be interpreted, never a pointer the hardware is allowed to load.

**Sync-back on an L2 exit (§14.4.3).** On a VM exit from L2 the processor writes guest state and VM-exit information into **vmcs02**. If the exit is to be reflected to L1, L0 must copy the affected state into vmcs12 so L1's VMREADs see a coherent picture (KVM: `sync_vmcs02_to_vmcs12()` from `__nested_vmx_vmexit()`), covering fields only modified after L2 runs such as the VMX-preemption timer value. Rarely read fields are synchronised lazily (`sync_vmcs02_to_vmcs12_rare()`, gated on `need_sync_vmcs02_to_vmcs12_rare`), which combined with VMCS shadowing keeps per-exit copying proportional to what L1 actually reads. Nested state that lives in no hardware VMCS — the current vmcs12, the shadow VMCS contents and L0's bookkeeping — must be saved and restored explicitly for migration or snapshot (`KVM_CAP_NESTED_STATE`, `KVM_GET_NESTED_STATE` / `KVM_SET_NESTED_STATE`).

**How a bad merge fails (§14.4.4)** — three loud failures, and knowing which is which is most of the diagnosis:
1. Illegal **control** combination ⇒ VM entry of L2 fails during the control checks and falls through to the instruction after VMLAUNCH/VMRESUME with the error in the VM-instruction error field.
2. Illegal **guest state** ⇒ a VM exit rather than a fall-through, with bit 31 of the exit reason set; L0 must distinguish "L1 gave me a bad vmcs12" (reflect a VM-entry failure to L1) from "I merged it wrongly" (an L0 bug).
3. Legal but **too permissive** ⇒ nothing fails; L2 simply gets a capability L1 never granted it. That is the security-relevant failure mode and the reason the intercept merge is a union rather than a copy.

**Citation given:** Intel SDM Vol.3C §27.4 / §27.4.1 (guest-state area), §27.5 and Ch.30 (host state loaded from the current VMCS on exit), §27.6.1–§27.6.6 (pin-based, processor-based, exception bitmap, I/O bitmaps, TSC offset, CR masks/shadows), §27.6.9 (MSR bitmaps), §27.6.11 (EPTP), §27.2 (implementation-specific VMCS data format), Ch.29 (entry checks on the merged result), §27.9.1/§27.9.5 (failure reporting); KVM function names and the Turtles naming are non-specification sources `[300]`/`[301]`
**Disagreement:** None.

---

### secure-ept-page-acceptance
**Routed to:** `13-tdx.md` §13.8 (routing row "TDX: … TD lifecycle and legal call order, **Secure EPT (§13.8)**")
**Actually answered from:** `13-tdx.md` §13.8.1, §13.8.2, §13.8.3, §13.8.4; `errata.md` (checked — no entry on page acceptance)
**Answer:**

**Why acceptance exists.** The requirement exists to defeat a specific host attack: the host VMM can remove arbitrary pages from a TD's GPA space with `TDH.MEM.PAGE.REMOVE` and replace them with zeroed pages. If the guest silently used whatever the host mapped, the host could swap live TD memory out from under it. Making the guest explicitly accept a page — and defining acceptance to zero the content — turns that substitution into something the guest must consent to. The corollary the specification states is a guest obligation: **a guest TD must track its own GPA allocation and must never accept a page it already knows to be TD-owned.**

**The exact sequence for dynamically adding a private page after TD initialization — three steps:**

1. **`TDH.MEM.SEPT.ADD`** (host SEAMCALL) — extends the Secure EPT tree if a new non-leaf level is needed.
2. **`TDH.MEM.PAGE.AUG`** (host SEAMCALL) — adds and maps a 4 KB or 2 MB page, leaving the Secure EPT leaf entry in the **PENDING** state and the page **unmeasured**. It performs a Secure EPT walk and **aborts if the mapping already exists**, which prevents re-mapping an already-mapped GPA; it then sets the leaf entry to PENDING and writes the PAMT entry with `PT_REG` and the TDR physical address as OWNER. It does **not** need to access the destination page itself — initialization is deferred.
3. **`TDG.MEM.PAGE.ACCEPT`** (guest TDCALL) — the guest accepts the page, and **acceptance zeroes the content**. This is the step that initializes the page.

**What happens if the guest touches the page before accepting it.** A guest TD access to a page whose SEPT entry is PENDING (or PENDING_EXPORTED_DIRTY) results in **either a #VE or a TD exit**, selected by three knobs: `ATTRIBUTES.SEPT_VE_DISABLE` in TD_PARAMS, `CONFIG_FLAGS.FLEXIBLE_PENDING_VE`, and — when flexible — the guest's own `TDCS.TD_CTLS.PENDING_VE_DISABLE`. Availability of the latter two is enumerated by `TDX_FEATURES0.PENDING_EPT_VIOLATION_V2` (bit 16), readable through `TDH.SYS.RD*`. The #VE behaviour supports an **accept-on-demand** guest policy; the TD-exit behaviour suits guests that map only already-accepted memory, for which touching a PENDING page is a fatal error and the host VMM normally tears the TD down. Under TD Partitioning, an L2 VM access to a PENDING page always results in an **L2→L1 exit** rather than a #VE or a TD exit.

**Two corner cases inside `TDG.MEM.PAGE.ACCEPT`'s own walk:**
- If the walk terminates on a free-equivalent entry (**FREE, REMOVED or EXPORTED_REMOVED**) at the requested level, the module performs a **TD exit with an EPT violation** carrying the error entry level and state plus the guest-requested accept level — which the host VMM may treat as the guest asking it to add the page.
- If the walk terminates on a guest-accessible leaf at a level **higher** than requested (for example a present 2 MB PTE for a 4 KB accept), `TDG.MEM.PAGE.ACCEPT` returns **success with a warning** that the page is already present and mapped at a larger size.

**Context that makes the sequence coherent.** Private GPAs (SHARED bit = 0) are translated through the Secure EPT via the legacy EPT pointer; shared GPAs (SHARED = 1) go through a separate Shared EPT pointer that the host VMM manages exactly as in legacy VMX. The SHARED bit sits at GPA bit GPAW-1, with GPAW either 48 or 52 (so bit 47 or bit 51; GPAW 52 only with 5-level EPT). There is exactly one Secure EPT structure per TD; its pages live in ordinary memory, are encrypted and integrity-protected with the TD's ephemeral private key, are never mapped into the TD's GPA space, and are **opaque to the host VMM**, which can only read an entry through `TDH.MEM.SEPT.RD`. At the end of a private translation the CPU sets the HKID bits of the resulting HPA to the TD's assigned private HKID.

On the host side of a related EPT-violation TD exit, only **Exit Qualification bits 6:0** are provided to the host VMM — the rest are withheld to avoid leaking TD secrets — and an unallocated page versus a blocked page are both reported as bits 6:3 == 0 with Extended Exit Qualification TYPE == NULL (0), so the host VMM must use its own bookkeeping to tell them apart and respond with `TDH.MEM.PAGE.AUG` or a plain re-entry. An access to a PENDING page configured to TD-exit is TYPE == PENDING_EPT_VIOLATION (6).

**Citation given:** Intel TDX Module Base Architecture Specification §9.10.1 (the three-step add/accept process and the substitution attack), §9.10.2 (`TDH.MEM.PAGE.AUG` behaviour), §9.10.3 (accept-walk corner cases), §9.10.4 (#VE vs TD exit selection), §9.1 (private/shared split, Secure EPT properties), §9.2.1 (entry states), §9.4 (EPT-violation TD exit and the truncated exit qualification); §11.3.2 and TDX ABI §3.4.3 / TDX ISA §3.2 for GPAW and the SHARED bit
**Disagreement:** None.

---

### vtd-queued-invalidation
**Routed to:** `10-vtd-dma-remapping.md` (routing row "VT-d DMA remapping, DMAR registers, translation structures, **invalidation**")
**Actually answered from:** `10-vtd-dma-remapping.md` §10.6.1, §10.6.2 (contrast), §10.6.3, §10.6.4; `errata.md` (E21 checked — it fixes the specification revision to cite, Rev 5.20 / April 2026 / D51397-019, not the stale intel.com Rev 4.1 landing page)
**Answer:**

**What it replaces.** Register-based invalidation (§6.5.1) is a one-at-a-time handshake through CCMD_REG (ICC bit 63, CIRG bits 62:61 with 01b global / 10b domain-selective / 11b device-selective, CAIG bits 60:59, FM 33:32, SID 31:16, DID 15:0) and the two adjacent IOTLB registers at ECAP_REG.IRO (IVT bit 63, IIRG 61:60, IAIG 58:57, DR bit 49, DW bit 48, DID 47:32) plus the Invalidate Address Register (ADDR 63:12, IH bit 6, AM 5:0, and page-selective invalidation only if CAP_REG.PSI is Set). Queued invalidation replaces that with a **ring of descriptors**, and it is the **only** route to PASID-granular and device-TLB invalidation.

**Setup and the ring.** Queued invalidation is supported only on hardware reporting **ECAP_REG.QI** as Set, is enabled through **GCMD_REG.QIE** and observed through **GSTS_REG.QIES**. The queue is located by **IQA_REG at offset 090h**; **IQH_REG at 080h** gives the offset of the descriptor hardware will read next, and **IQT_REG at 088h** the offset software will write next. So software writes descriptors at the tail and advances IQT; hardware consumes from the head.

**Descriptor typing.** The Type field is a **7-bit field formed by concatenating descriptor bits 11:9 and bits 3:0** — not a single contiguous field. The defined types:

| Type | Descriptor | VT-d section |
|---|---|---|
| 1h | Context-cache Invalidate (`cc_inv_dsc`) | §6.5.2.1 |
| 2h | IOTLB Invalidate (`iotlb_inv_dsc`) | §6.5.2.3 |
| 3h | Device-TLB Invalidate (`dev_tlb_inv_dsc`) | §6.5.2.5 |
| 4h | Interrupt Entry Cache Invalidate (`iec_inv_dsc`) | §6.5.2.8 |
| 5h | Invalidation Wait (`inv_wait_dsc`) | §6.5.2.9 |
| 6h | PASID-based IOTLB Invalidate (`p_iotlb_inv_dsc`) | §6.5.2.4 |
| 7h | PASID-cache Invalidate (`pc_inv_dsc`) | §6.5.2.2 |
| 8h | PASID-based-Device-TLB Invalidate (`p_dev_tlb_inv_dsc`) | §6.5.2.6 |
| 9h | Page Group Response (`page_grp_resp_dsc`) | §7.6.1 |
| Ah | HPT Cache Invalidate (`hpt_inv_desc`) | §6.5.2.7 |

**The ordering you must respect (§6.5.2.12) — hardware-enforced:**
- Hardware executes an **IOTLB** invalidation descriptor (`iotlb_inv_dsc`) **or** a **PASID-based IOTLB** descriptor (`p_iotlb_inv_dsc`) only after all **context-cache *and* PASID-cache** invalidation descriptors ahead of it in the queue are completed.
- Hardware executes a **PASID-cache** invalidation descriptor only after all **context-cache** descriptors ahead of it are completed.
- Hardware executes a **Device-TLB** invalidation descriptor only after all **IOTLB and Interrupt Entry Cache** descriptors ahead of it are completed.

So the hardware-imposed partial order is: context-cache → PASID-cache → (IOTLB / PASID-based IOTLB) → Device-TLB, with Interrupt Entry Cache also preceding Device-TLB.

**The ordering you must respect as software:**
- **Software must always request IOTLB invalidation before requesting the corresponding Device-TLB invalidation.** (This is a software obligation stated in §6.5.2.5, in addition to the hardware rule above.)
- If the **Fence (FN)** flag is 1 in an **Invalidation Wait Descriptor**, hardware must execute descriptors *following* it only after the wait command is completed — that is the general-purpose barrier in the ring.
- The Invalidation Wait Descriptor is also how software **synchronises** with hardware for descriptors submitted ahead of it; hardware generation of invalidation completion events is specified in §6.5.2.10.
- When the **Invalidation Time-out Error (ITE)** condition is signalled, hardware **aborts any Invalidation Wait Descriptor commands pending in hardware**.

**When invalidation is required at all.** VT-d Ch.6 defines the caches: context-cache (§6.2.2), PASID-cache (§6.2.3), IOTLB (§6.2.4), the paging-structure caches PML5/PML4/PDPE/PDE (§6.2.5), HPT cache (§6.2.6) and interrupt entry cache (§6.4). The **Caching Mode (CM)** field in the Capability Register indicates whether the implementation caches not-present or erroneous entries. **When CM is Set, any software update to remapping structures other than first-stage mappings — including updates to not-present entries and to present entries whose programming resulted in translation faults — requires explicit invalidation.** Implementations must support CM = 0 operation; CM = 1 exists so software emulating remapping hardware can virtualize it efficiently, and software must handle both. In practice CM = 1 is a *virtual* IOMMU signal: it lets a VMM trap every guest invalidation and keep shadow structures consistent without write-protecting the guest tables.

Normative software guidance for invalidations is in VT-d §6.5.3.3, with the HPT-enabled equivalent in §6.5.3.4; draining of requests to memory is §6.5.4 and interrupt draining §6.5.5.

**THE SKILL DOES NOT CONTAIN THIS** for the following parts of "how queued invalidation works", which the chapter deliberately does not reproduce: the internal field layout of **IQA_REG** (queue-size field, and any descriptor-width / queue-in-128-vs-256-bit-descriptor selector); the per-descriptor **field layouts** — e.g. the granularity fields inside `cc_inv_dsc` and `iotlb_inv_dsc`, the address/mask fields, and the Invalidation Wait Descriptor's Status Data / Status Address / interrupt-flag fields beyond the FN flag; and the exact wrap/full condition for the ring. It gives register offsets, the type encoding rule, the type table and the ordering rules, and points at §6.5.3.3 for normative software guidance.

**Citation given:** Intel VT-d Specification Rev 5.20 (April 2026, order number D51397-019) §6.5.2 (descriptor types and the 11:9‖3:0 Type field), §6.5.2.5 (software must invalidate IOTLB before Device-TLB), §6.5.2.9 (Invalidation Wait Descriptor), §6.5.2.11 (ITE aborts pending waits), §6.5.2.12 (hardware ordering rules), §6.1 (Caching Mode), Ch.6 (the cache inventory), §11.4.4.1 (QI enable via GCMD_REG.QIE / GSTS_REG.QIES), §11.4 (IQA_REG 090h, IQH_REG 080h, IQT_REG 088h), §6.5.3.3 / §6.5.3.4 (normative software guidance)
**Disagreement:** None.

---

### hvci-uses-ept
**Routed to:** `15-security.md` (routing row "Transient-execution CVEs … **VBS, HVCI**, Credential Guard, TXT")
**Actually answered from:** `15-security.md` §15.8 (with §15.7 for the VBS/VTL substrate) and `17-windows-platform.md` §17.6 / §17.6.1; `errata.md` E01 (MBEC generation) checked
**Answer:**

The premise of the question is the point: the attacker **does** have kernel write. Memory integrity does not try to stop the write. It removes the attacker's ability to turn written bytes into executing code, and it does so by moving the decision to a level the compromised kernel cannot reach.

**The invariant.** Memory integrity — also called hypervisor-protected code integrity (HVCI) — runs kernel-mode code integrity **inside the VBS isolated environment** rather than in the kernel it is policing. The enforced invariant is **W^X for kernel memory**: kernel pages are only made executable after passing code-integrity checks inside the secure environment, and executable pages themselves are never writable.

**The mechanism.** The mechanism is **EPT permissions**. The code page's executable permission lives in the **EPT entry the hypervisor controls**, not in the VTL0 page tables the compromised kernel controls. That is why a VTL0 kernel cannot grant itself execute rights. Expressed at the page level: a kernel page may be writable at VTL0 **or** executable at VTL0, but the secure kernel does not grant both at once, and the grant is expressed in the second-level translation permissions that the more privileged level controls. Because the decision is taken at a level the VTL0 kernel cannot write to, a compromised VTL0 kernel cannot mark its own page executable.

**So the exploit dies at a specific step.** Microsoft's own statement of the consequence is direct: even where a memory-safety defect lets an attacker modify memory, **executable code pages cannot be modified and modified memory cannot be made executable**, so the classic "write shellcode into kernel memory and jump to it" step fails.

**Why an attacker cannot just sign or re-check it.** Unsigned or improperly signed kernel code fails for the second reason: the integrity check that authorises the transition to executable happens **in the secure environment**, so a signature the VTL0 kernel would have accepted is irrelevant.

**The trust-level substrate underneath (§15.7).** VBS uses hardware virtualization and the Windows hypervisor to create an isolated environment that becomes the root of trust "of the OS that assumes the kernel can be compromised", and the virtualization support it requires must include second-level address translation — on Intel parts, VT-x with EPT. The isolation primitive is the **Virtual Trust Level**: the traditional execution model runs in VTL0 and the secure kernel and Isolated User Mode in the more privileged VTL1. The boundary is enforced by memory access permissions that "are managed by the hypervisor in a partition's physical address space, and thus cannot be modified by system level software running in the partition" — including by the VTL0 kernel.

**The hardware feature that makes it affordable.** **Mode-based execute control for EPT (MBEC)**: when the "mode-based execute control for EPT" VM-execution control is 1, an EPT entry carries a **separate execute permission for user-mode linear addresses at bit 10** alongside the supervisor-mode one, so the hypervisor can allow user code to execute a page while denying kernel execution of it **without a second set of structures**. The chapter is careful that Microsoft's own claim is narrower than the one usually quoted: Microsoft says memory integrity *works better* on processors with Mode-Based Execution Control (Intel) or Guest Mode Execute Trap (AMD), and that older processors rely on an emulation called **Restricted User Mode**, which has a bigger performance impact. (Per `errata.md` E01, MBEC first appeared in **Kaby Lake**, 7th-generation Core — not Skylake, as is commonly repeated.)

**The visible side effects, which confirm the mechanism.** A driver fails under HVCI when it *violates the invariant*, not when it is merely old: Microsoft's compatibility guidance tells drivers not to use sections that are both writable and executable, not to modify executable system memory directly, not to use dynamic code in the kernel, not to load data files as executable, and to allocate from a non-executable pool — the first step it names is "a clear separation of data and code". Kernel-mode software that allocates writable-executable memory, generates code at run time, or patches kernel code is therefore incompatible **by construction rather than by policy**. And the cost profile follows from the same structure: the expensive event is a **change of page permissions**, not ordinary execution, so the feature has a per-page cost rather than a per-call one.

**Citation given:** Microsoft Learn, virtualization-based security / memory integrity documentation (the W^X invariant, the "modified memory cannot be made executable" consequence, the VBS hardware requirement of second-level address translation) — chapter sources `[378]`, `[379]`, `[382]`, `[383]`, `[483]`; Hypervisor Top-Level Functional Specification and Microsoft's Isolated User Mode documentation for the VTL hierarchy and the hypervisor-managed physical-address-space permissions — `[380]`, `[381]`, `[463]`; Intel SDM Vol.3C §31.3.2 for mode-based execute control (EPT entry bit 10). Per the skill's output standards, Windows behaviour is cited to Microsoft (Tier-2), not to the SDM; only the MBEC hardware claim carries an Intel anchor.
**Disagreement:** None.

---

### virtual-interrupt-delivery
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `07-apic-virtualization.md` §7.6.4, with §7.6.3 (recognition) and §7.5 (RVI/SVI) for the surrounding conditions; `errata.md` (checked — nothing applicable)
**Answer:**

First, the distinction the chapter insists on: **recognition is not delivery.** A virtual interrupt is *recognized* by "evaluation of pending virtual interrupts" only when **both** "interrupt-window exiting" is 0 **and** the priority class of RVI (bits 7:4) is **strictly greater** than the priority class of VPPR (bits 7:4) — the comparison is by class, not by full vector value. A recognized virtual interrupt is then *delivered* at an instruction boundary only when **all four** conditions hold: RFLAGS.IF = 1; no blocking by STI; no blocking by MOV SS **or by POP SS**; and "interrupt-window exiting" is 0.

**When the processor decides to deliver, it performs virtual-interrupt delivery, in this order:**

```
Vector <- RVI
VISR[Vector] <- 1
SVI   <- Vector
VPPR  <- Vector & F0H
VIRR[Vector] <- 0
if any bit is set in VIRR:  RVI <- highest index of a bit set in VIRR
else:                       RVI <- 0
if logical processor is in SEAM and RVI < 31:  RVI <- 0
cease recognition of any pending virtual interrupt      # BEFORE delivery
if transactional execution is in effect:  abort it
if in enclave mode:                       cause an Asynchronous Enclave Exit
if CR4.UINTR = 1 and IA32_EFER.LMA = 1 and Vector = UINV:
    virtualize user-interrupt notification identification and processing
else:
    deliver the interrupt with Vector to guest software
```

In prose: it takes the vector from RVI; sets that vector's bit in **VISR**; copies the vector into **SVI**; sets **VPPR** to the vector's priority class (`Vector & F0H`); clears the vector's bit in **VIRR**; recomputes **RVI** as the highest remaining set bit of VIRR (or 0 if none), with the SEAM clamp forcing RVI to 0 if it is below 31; **then ceases recognition of the pending virtual interrupt**; and only after that delivers the interrupt. All of this happens **without a VM exit**.

**The ordering detail that matters:** the cessation of recognition **precedes** delivery in the SDM's pseudocode. An implementation that clears recognition afterwards can **double-deliver**.

**Two side effects before the interrupt reaches guest software:** delivery aborts any transactional execution in effect, and causes an **Asynchronous Enclave Exit** if the logical processor is in enclave mode.

**The user-interrupt branch:** if CR4.UINTR = 1, IA32_EFER.LMA = 1 and the delivered vector equals **UINV**, the processor performs virtualized user-interrupt notification identification and processing instead of ordinary delivery. That path runs the *opening* steps of EOI virtualization — clear VISR[V], recompute SVI, perform PPR virtualization — but deliberately does **not** consult the EOI-exit bitmap, so **no virtualized-EOI VM exit can occur on it**.

**What the guest sees.** Because delivery happens in VMX non-root operation, the guest's own **IDT, TSS and stack switching** are used exactly as on bare metal, and the VMM observes nothing.

**Priority and wake behaviour.** Virtual-interrupt delivery has the same priority as an interrupt-window VM exit: NMIs and higher-priority events pre-empt it, and it in turn pre-empts external interrupts and lower-priority events. It wakes a logical processor from **HLT and MWAIT** but **not** from shutdown or wait-for-SIPI. A logical processor never recognizes or delivers a virtual interrupt while "interrupt-window exiting" is 1, which is why the SDM leaves the relative priority of virtual-interrupt delivery and interrupt-window VM exits undefined.

**What causes the evaluation in the first place.** Exactly five operations cause "evaluation of pending virtual interrupts": VM entry, TPR virtualization, EOI virtualization, self-IPI virtualization, and posted-interrupt processing. The SDM says explicitly that **no other operation causes it, even one that modifies RVI or VPPR** — it is not a standing re-evaluation. The practical consequence for a VMM: a write it makes to VIRR or to the guest-interrupt-status field does not by itself trigger evaluation; recognition happens at the next VM entry. (Injection under VID is done by setting the vector's bit in VIRR on the virtual-APIC page and raising RVI with VMWRITE if the vector is higher — **not** through the injected-event identification field.)

**Citation given:** Intel SDM Vol.3C §32.2.2 (virtual-interrupt delivery pseudocode, the four delivery conditions, priority and wake behaviour), §32.2.1 (evaluation of pending virtual interrupts, the five causes, the SEAM clamp), §32.2.3 (the UINV / user-interrupt branch), §32.1.3 (VPPR rules), §27.4.2 (RVI/SVI in the guest-interrupt-status field), §29.3.2.5 (what VM entry does)
**Disagreement:** None.

---

### ept-violation-vs-misconfiguration
**Routed to:** `06-address-translation.md` (routing row "EPT structures, **EPT violation vs misconfiguration**, VPID, PML, SPP, HLAT, #VE"), plus `05-vm-exit.md` §5.4 as SKILL.md §How-to-use step 4 explicitly permits for the qualification layout
**Actually answered from:** `06-address-translation.md` §6.4, §6.4.1, §6.4.2, §6.4.3, §6.4.4; `05-vm-exit.md` §5.4.6, §5.12, §5.13; `errata.md` E16 and E17
**Answer:**

**The one-line difference, in the SDM's own words:** "An EPT **misconfiguration** occurs when, in the course of translating a guest-physical address, the logical processor encounters an EPT paging-structure entry that contains an **unsupported value**. An EPT **violation** occurs when there is no EPT misconfiguration but the EPT paging-structure entries **disallow an access** using the guest-physical address." Put in operational terms: a violation is a **policy** decision the VMM programmed on purpose; a misconfiguration is a **bug** in the table the VMM built.

| | EPT violation | EPT misconfiguration |
|---|---|---|
| Basic exit reason | **48** | **49** |
| Cause | entries well formed but deny the access, or an entry is not present | an entry contains an unsupported value |
| Typical origin | demand paging, MMIO emulation, introspection hooks, write tracking | hypervisor bug, or a torn update of a live EPT entry |
| Guest-physical address field | set | set |
| Exit qualification | defined; reports access type and effective permissions | **not defined** for this exit — the field is *cleared* |
| Convertible to #VE | yes (subject to the §6.11 conditions) | **no** |

**What exactly counts as a misconfiguration (the complete enumeration of SDM §31.3.3.1 — three conjuncts under "bit 0 is clear" and two under "the entry is present"):**
1. Bits 2:0 of an entry used in the translation are **010b** (write, no read) or **110b** (write and execute, no read) — write access is never permitted without read access.
2. Bit 0 clear, the processor does not support execute-only EPT translations (per IA32_VMX_EPT_VPID_CAP), and either bit 2 is set (the 100b execute-only case) or "mode-based execute control for EPT" is 1 and bit 10 is set. The user-mode-execute bit is subject to the same read-access requirement as bit 2.
3. Bit 0 clear while "EPT paging-write control" is 1, the entry maps a page, and bit 58 (paging-write access) is set.
4. A **present** entry sets any reserved bit: bits 7:3 in an entry referencing another EPT paging structure (bits 6:3 plus a bit 7 that must be 0 in an EPT PDE referencing a page table), page-frame alignment bits (29:12 for a 1-GByte page, 20:12 for a 2-MByte page), any address bit in 51:12 at or above the processor's physical-address width, or bit 7 at a level where that page size is unsupported.
5. A present **leaf** entry specifies EPT memory type **2, 3 or 7** in bits 5:3; the defined values are 0 (UC), 1 (WC), 4 (WT), 5 (WP), 6 (WB).

The reserved-bit and memory-type checks apply **only to entries actually used in a translation and only to present entries**, so a hypervisor may leave arbitrary values in bits 62:3 of a zeroed (not-present) entry — but **not** in bit 63, which still selects #VE convertibility, and not in bits 2:0, whose write-without-read and execute-only checks are what make the entry present in the first place. Intel warns that values reserved today may be defined later, so an entry that misconfigures on one processor may not on the next.

**How the handlers must differ.**

*Exit 48 (violation) — a recoverable, expected event.*
- Read the **guest-physical address** field (always valid on an EPT violation), then the exit qualification.
- Classify the access with qualification bits 0 (data read), 1 (data write — a read-modify-write always sets bit 1, and whether it also sets bit 0 is implementation-specific) and 2 (instruction fetch).
- Distinguish "not mapped" from "mapped but not permitted" with bits 3, 4 and 5, which report the logical-AND across the EPT entries used of, respectively, bit 0 (read), bit 1 (write) and bit 2 (execute — supervisor-mode execute when MBEC is on). **Qualification bits 5:3 all clear** means either an entry used in the translation was not present, or 4-level EPT is in use and the guest-physical address set a bit in 51:48; some of those bits set means a permission failure on a mapped page.
- **Never advance RIP.** An EPT violation is fault-like: the faulting instruction must be **restarted** after the mapping is fixed, not skipped. Advancing RIP silently corrupts the guest.
- Then do one of three things: install a mapping (demand paging), emulate the access (MMIO), or run a policy hook (introspection, write tracking) and resume.

*Exit 49 (misconfiguration) — not recoverable, and not a guest event.*
- There is **no exit qualification** — the field is cleared, so a zero there means nothing and the only architectural information you get is the guest-physical address.
- Resuming without changing the entry **re-raises the same exit**, because the value is unsupported rather than merely denying access. The only correct handling is to correct or tear down the mapping.
- Treat it as a **hypervisor bug**: dump the offending entry rather than retry. The most common real cause is a **non-atomic update to a live EPT entry** that momentarily leaves an illegal permission combination — such as clearing read while write is still set (which is case 1 above).

**Two corrections to carry into the violation handler** (`errata.md` E16 and E17, restated in both chapters):
- **Bit 7** is set when the **guest-linear-address field is valid** — it says nothing about the guest-physical-address field, which is always filled in for an EPT violation. (Bit 8, defined only when bit 7 is set, distinguishes an access to a paging-structure entry during a walk or an A/D update from an access to the translation of a linear address; when bit 7 is 0, bit 8 is reserved and cleared.)
- **Bit 6** is the logical-AND of the **user-mode execute permission (bit 10)** of the EPT entries used, and is meaningful **only when "mode-based execute control for EPT" is enabled**. It has nothing to do with the execute-disable bit of the guest's own paging structures.

**Two properties common to both:** both record the offending address in the guest-physical address VM-exit information field, and both are **unconditional** — unlike most VM exits they have no enabling control beyond "enable EPT" itself and cannot be masked, which is why every EPT-using VMM must implement both handlers. Also note that an EPT violation can occur while the processor is reading a *guest* paging-structure entry, not only on the final data page, because the guest-physical address of every guest paging structure is itself translated through EPT; and a guest page fault from the guest's own paging structures is delivered to the guest as #PF and causes no VM exit unless the exception bitmap intercepts it — only the second-level translation produces EPT violations, so the guest cannot observe them.

**Citation given:** Intel SDM Vol.3C §31.3.3.1 (EPT misconfiguration conditions), Ch.31 (the violation/misconfiguration definitions, unconditional nature, guest-paging-structure walks), §31.3.7.2 (EPT memory types), §31.3.2 (bit 63 / convertibility and MBEC entry bits), §30.2.1 (EPT-violation exit qualification bit-by-bit, the guest-physical and guest-linear address fields, and the cleared qualification for exit 49), SDM Vol.3D App.C (basic exit reasons 48 and 49), Vol.3D App.A (IA32_VMX_EPT_VPID_CAP)
**Disagreement:** None. (Both of my priors on qualification bits 6 and 7 matched the corrected text, not the widely circulated versions.)

---

### default1-controls-and-true-msrs
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "VMX instruction semantics, **capability MSRs**, what VM-instruction error N means")
**Actually answered from:** `08-vmx-instructions.md` §8.6.1, §8.6.2, §8.6.3 (+§8.6.5 for the CR0/CR4 analogue); `04-vm-entry.md` §4.3 and §4.10 for the entry-side consequence; `errata.md` (checked — nothing applicable)
**Answer:**

**Why zero-initialising is wrong.** The control-capability MSRs do not report "which bits exist". They report, per bit, whether the value 0 is allowed and whether the value 1 is allowed. In IA32_VMX_PINBASED_CTLS, IA32_VMX_PROCBASED_CTLS, IA32_VMX_EXIT_CTLS and IA32_VMX_ENTRY_CTLS, **bits 31:0 are the allowed-0 settings and bits 63:32 the allowed-1 settings**. The SDM states them as permissions:

> "VM entry allows control X to be 0 if bit X in the MSR is cleared to 0; if bit X in the MSR is set to 1, VM entry fails if control X is 0."
> "VM entry allows control X to be 1 if bit 32+X in the MSR is set to 1; if bit 32+X in the MSR is cleared to 0, VM entry fails if control X is 1."

Read as obligations: **a control whose allowed-0 bit is 1 must be 1**, and **a control whose allowed-1 bit is 0 must be 0**. A control with allowed-0 = 0 and allowed-1 = 1 is flexible. A bit whose allowed-0 setting is 1 is a **"default-1" control**: it must be set to 1 unless the corresponding TRUE_* MSR reports that it may be cleared. So a zeroed control field violates every default-1 obligation the processor has, and VM entry fails with **VM-instruction error 7, "VM entry with invalid control field(s)"** — which does not tell you *which* control was wrong.

The chapter names the specific derivation bug: **inverting the first half** — reading "allowed-0 bit is 0" as "the control must be 0" rather than "the control *may* be 0" — is what produces error 7, and it is the reason the algorithm ORs rather than ANDs with the low half.

**The derivation.** For each control field, take your desired value `v` and compute

```
v_final = (v | allowed0) & allowed1
```

where `allowed0` is the low 32 bits and `allowed1` the high 32 bits of that control's capability MSR. This forces every default-1 bit on and every unsupported bit off in one step. Treat any surviving difference in a bit that matters as "the feature is unavailable". App.A states the per-bit semantics but gives no algorithm; the canonical implementation is KVM's `adjust_vmx_controls()`.

**What the TRUE_ MSRs are for.** On early VMX processors, certain control bits were architecturally required to be 1 — the default-1 controls — and the original capability MSRs report them as such. Later processors let software clear some of them, but the original MSRs cannot say so without breaking software that reads them. So a second set of MSRs was added: **IA32_VMX_TRUE_PINBASED_CTLS (48DH), IA32_VMX_TRUE_PROCBASED_CTLS (48EH), IA32_VMX_TRUE_EXIT_CTLS (48FH) and IA32_VMX_TRUE_ENTRY_CTLS (490H)**. They use the **same two-halves layout**, and their purpose is precisely to let software discover **which of those default-1 bits may legitimately be cleared**.

**The gate.** They **may be consulted only when IA32_VMX_BASIC (MSR 480H) bit 55 is 1**, which reports that the TRUE_* MSRs are present and therefore that some default-1 bits may legitimately be cleared. The operational rule chapter 04 states: **if IA32_VMX_BASIC bit 55 is set, use the TRUE_* MSRs instead of the originals** — the non-TRUE MSRs report bits as default-1 that the processor actually lets you clear, so using them on a capable processor needlessly constrains the VMM. (All of these MSRs are read-only; writing any of them causes #GP(0).)

**Not every capability MSR has two halves.** IA32_VMX_PROCBASED_CTLS2 (48BH) uses the same two-halves layout and governs the secondary controls, which take effect only when bit 31 of the primary controls is 1. But **IA32_VMX_PROCBASED_CTLS3 (492H) is a single 64-bit allowed-1 mask**, and the SDM's stated reason is size, not default-1 policy — "there are 64 tertiary processor-based VM-execution controls, while there were only 32 secondary processor-based VM-execution controls" — so a two-halves layout would not fit. **IA32_VMX_EXIT_CTLS2 (493H)** has the same organization for the same stated reason, and **IA32_VMX_VMFUNC (491H)** is likewise a single 64-bit allowed-1 mask over the VM-function controls. IA32_VMX_PROCBASED_CTLS3 exists only on processors supporting the 1-setting of "activate tertiary controls", reported by **bit 49 of IA32_VMX_PROCBASED_CTLS** (the allowed-1 bit for primary control 17).

**The same shape appears for CR0/CR4** (§8.6.5): if bit *n* of IA32_VMX_CR0_FIXED0 is 1, CR0 bit *n* must be 1 in VMX operation; if bit *n* of IA32_VMX_CR0_FIXED1 is 0, it must be 0 — fixed-to-1, fixed-to-0, or flexible. Same for CR4 with FIXED0/FIXED1.

**The practical symptom** (`04-vm-entry.md` §4.11): "ZF set, error 7, worked on one machine and not another" means a control bit was hard-coded rather than derived from the capability MSRs. A VMM written against one microarchitecture fails this check on another.

**Citation given:** Intel SDM Vol.3D App.A.3.1 (allowed-0 / allowed-1 semantics for the four primary control MSRs, quoted verbatim), App.A.2 (the TRUE_* variants and the default-1 concept), App.A.1 (IA32_VMX_BASIC bit 55), App.A.3.3 (PROCBASED_CTLS2), App.A.3.4 (PROCBASED_CTLS3 as a single allowed-1 mask, and the SDM's stated size rationale), App.A.4.2 (EXIT_CTLS2), App.A.11 (IA32_VMX_VMFUNC), App.A.7/A.8 (CR0/CR4 FIXED MSRs); SDM Vol.3C §33.4 for error number 7; MSR addresses 480H–493H from App.A
**Disagreement:** **Yes — an internal inconsistency in the skill, which I am recording rather than silently resolving.** `08-vmx-instructions.md` §8.6.3 states the polarity correctly and at length (allowed-0 bit = 1 ⇒ control must be 1; allowed-1 bit = 0 ⇒ control must be 0), and `04-vm-entry.md` §4.3 / §4.10 agree (the `(v | allowed0) & allowed1` formula, and "the allowed-0 half of a capability MSR forces bits *on*"). But one claim line in `04-vm-entry.md` **§4.3.1** glosses both halves identically: "bits 31:0 of the MSR give the allowed-0 settings (**a bit that is 0 there must be 0 in the control**) and bits 63:32 give the allowed-1 settings (a bit that is 0 there must be 0 in the control)". The parenthetical is correct for the allowed-1 half and wrong for the allowed-0 half, where the obligation is "a bit that is **1** there must be **1** in the control". My prior belief matches §8.6.3 and the SDM quotation, and §8.6.3 is the owning section (SKILL.md: where a fact is under another chapter's `Owns:`, that chapter is authoritative — §8.6 owns the capability MSRs, and §4.3 itself defers to it). Flagging the §4.3.1 parenthetical as a defect to fix; the rest of the skill is self-consistent and correct.

---

### idt-vectoring-reinjection
**Routed to:** `05-vm-exit.md` §5.4 (routing row "**Decoding a VM exit**: exit reasons (§5.3), exit qualification layouts (§5.4), **IDT-vectoring**")
**Actually answered from:** `05-vm-exit.md` §5.6, §5.12, §5.7 (instruction length), §5.5 (the sibling field); `04-vm-entry.md` §4.8 for the re-injection side; `errata.md` (checked — nothing applicable)
**Answer:**

The mechanism you are missing is the **IDT-vectoring information field** — renamed the **original-event identification field** in SDM rev 092 — and the obligation to **re-inject** the event it reports.

**What happened to your guest.** The guest took a fault; while the processor was delivering that fault through the guest IDT, a second condition arose (a page fault on the IDT or the handler stack, an EPT violation on the handler's page, a task switch, etc.) that caused a **VM exit**. At that moment the first event had been *recognised and started* but **not delivered**. The processor does not keep it pending for you: it records it in the IDT-vectoring information field and hands you the exit. If your handler ignores that field, the original event is simply **lost** — the guest never runs its handler, and it hangs or wedges in exactly the way you describe. The chapter names this directly: forgetting this is "the classic source of 'the guest hangs after a nested fault'".

**The field.** Layout: bits 7:0 vector; bits 10:8 event type; bit 11 error-code valid; **bit 12 not currently defined (undefined on VM exit)**; bit 13 exception nested on FRED event delivery; bits 30:14 not currently defined (always 0); **bit 31 valid**. The event types are 0 external interrupt, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software exception (Table 27-21; §30.2.4's prose says "privileged software interrupt", a wording slip in the SDM itself), and 6 software exception; values 1 and 7 are not used. When bit 11 is 1, the **IDT-vectoring error code** field holds the error code of the interrupted event. Rev 092 adds a 64-bit **original-event data** field alongside the error code, which receives what FRED event delivery would have pushed and is undefined for non-FRED exits.

**Bit 31 is the whole signal:** it is set only when the VM exit occurred while the processor was delivering an event through the guest IDT, and it is the VMM's notification that an event was lost and must be re-delivered.

**The handling rule — and it is unconditional.** **VMREAD the IDT-vectoring information field on *every* VM exit, not only on exits you expect to be event-related.** This is architecturally necessary because the field is valid for exits of many different basic reasons — a task switch, an EPT violation or an exception can all interrupt event delivery. An exit handler that checks it only for selected reasons will silently drop events. In the chapter's dispatch recipe it is step 3, right after masking the exit reason: if the valid bit is set, an event was lost during delivery and must be re-injected **before or together with** whatever else you do.

**The re-injection.** The standard VMM response is to copy the IDT-vectoring information and its error code into the **VM-entry interruption-information field** and the **VM-entry exception error-code field** for the next VM entry, adjusting for the type of the original event. For a **software interrupt, privileged software exception or software exception** recorded in the field, the **VM-exit instruction length** field holds the length of the instruction that caused the event, and that value **must be carried over to the VM-entry instruction length** when re-injecting — otherwise the re-injected event's pushed RIP is wrong (on a successful injection of those types, the guest RIP is incremented by the VM-entry instruction length *before being pushed on the stack*, while for an external interrupt, NMI or hardware exception the current RIP is pushed unchanged).

**Where a clear valid bit does *not* mean "nothing was in flight".** A VM exit is **not** considered to occur during event delivery when: the original event causes the exit directly; it results in a **double fault** that causes the exit directly; the exit comes from **fetching the first instruction of the handler**; the exit is a **triple fault**; or in the **virtual-8086 INT n / #GP redirection** case. So a clear valid bit does not mean no event was in flight — it means the architecture has already accounted for it another way (typically by escalating to #DF, which you will see as the exiting event, or by the exit being the event itself).

**Do not confuse it with its sibling.** The **VM-exit interruption-information field** (rev 092: the **exiting-event identification field**) describes the event that *caused* this exit; the IDT-vectoring / original-event field describes the event that was *interrupted* by it. They can both be valid on the same exit, and they mean different things. Related trap: "NMI unblocking due to IRET" is reported in bit 12 of the **exiting-event** field for faults (and in exit-qualification bit 12 for EPT violations, PML-full, SPP events and instruction timeouts), and it is defined only when the VM exit does **not** set the valid bit in the IDT-vectoring field — another reason to read that bit first.

**Citation given:** Intel SDM Vol.3C §27.9.3 (IDT-vectoring / original-event identification field layout, event types, error code, original-event data), §30.2.4 (when an exit does and does not count as occurring during event delivery; the copy-forward response; the instruction-length carry-over), §30.2.5 (VM-exit instruction length semantics), §27.9.2 and §30.2.2/§30.2.3 (the exiting-event identification field and NMI unblocking due to IRET), §29.6.1 and §29.6.1.1 (injection through the guest IDT and the RIP push rules)
**Disagreement:** None.

---

### vpid-ept-tagging
**Routed to:** `06-address-translation.md` (routing row "EPT structures, EPT violation vs misconfiguration, **VPID**, PML, SPP, HLAT, #VE")
**Actually answered from:** `06-address-translation.md` §6.6, §6.7; `errata.md` E19 (checked — the "Intel has no ASID" misconception; supports the PCID/VPID framing below)
**Answer:**

**Why you are getting stale translations: the hardware stopped invalidating for you.** With "enable VPID" set, **VM entry and VM exit do not invalidate cached linear or combined mappings** — host and guest translations coexist in the TLB and the VMM becomes responsible for every invalidation that correctness requires. (With "enable VPID" clear, VM entries and exits invalidate the linear and combined mappings associated with VPID 0000H for all PCIDs and all EPTRTAs.) The rule of thumb: once tagging is on, every place you used to rely on an implicit flush becomes an explicit invalidation site. VM entry is also not required to invalidate any guest-physical mapping in any case.

**The three kinds of cached mapping and their tags — this is what decides which instruction you need:**

| Mapping | Translates | Tagged with |
|---|---|---|
| Linear mappings | guest-linear → physical | current **VPID** and current **PCID** |
| Guest-physical mappings | guest-physical → physical | current **EPTRTA** (EPTP bits 51:12) |
| Combined mappings | guest-linear → physical, through both hierarchies | **VPID, PCID and EPTRTA** |

When EPT is in use the processor creates **guest-physical and combined** mappings rather than linear mappings, so a combined mapping created under one EPTP value cannot be used after the EPTRTA changes.

**The two consequences that answer your question directly:**
- **Guest-physical mappings carry no VPID tag**, so **no INVVPID type can ever invalidate them** — a VMM that changes EPT and invalidates only by VPID has a stale-translation bug. Removing a guest-physical mapping requires **INVEPT**. Conversely, **INVEPT does invalidate combined mappings**, because those carry an EPTRTA tag as well.
- **Combined mappings carry all three tags at once**, so changing *either* the VPID or the EPTP is enough to stop the processor using an existing combined mapping — which is what makes multi-view EPT designs cheap. (It is also why switching EPTP with VMFUNC while VPID is enabled needs no TLB flush; without VPID the switch invalidates combined mappings associated with VPID 0000H.)

**Which instruction after which change:**

| Situation | Required invalidation |
|---|---|
| EPT paging structures modified to be **more restrictive** | **INVEPT** for the affected EPTRTA, on **every logical processor** that may have cached it |
| vCPU migrated to a different logical processor | **INVVPID** single-context for that VPID |
| VPID recycled for a different vCPU or address space | **INVVPID** single-context before first use |
| Guest executed INVLPG and the VMM is emulating it | **INVVPID** individual-address |
| Guest reloaded CR3 and the VMM is emulating it | **INVVPID** single-context-retaining-globals |

**When you do *not* need to invalidate.** Making an EPT entry **more permissive** does not require invalidation: software *may* execute INVEPT after changing a privilege bit from 0 to 1, but the only consequence of not doing so is one spurious EPT violation — which itself invalidates the stale mapping, so the access succeeds on retry. INVEPT **should** be used after: changing a privilege bit from 1 to 0; changing the address in bits 51:12; changing bit 7; or clearing bit 8 or bit 9 with EPT A/D flags enabled. Nothing derived from a **not-present or misconfigured** entry is ever cached, so those need no invalidation either.

**The types and descriptors** (owned by §6.7 for the layouts; `08-vmx-instructions.md` owns the instruction semantics):
- **INVEPT descriptor, 128 bits**: bits 63:0 EPT pointer, bits 127:64 reserved and must be 0. **Type 1 = single-context** (invalidate guest-physical and combined mappings associated with the EPTRTA in the descriptor); **type 2 = all-context** (all EPTRTA values) — the conservative choice when you cannot enumerate which EPTP values are affected.
- **INVVPID descriptor, 128 bits**: bits 15:0 VPID, bits 63:16 reserved and must be 0, bits 127:64 linear address. **Type 0 = individual-address, type 1 = single-context, type 2 = all-contexts, type 3 = single-context-retaining-globals.** INVVPID invalidates linear and combined mappings tagged with the given VPID but **never** guest-physical mappings. **Type 2 invalidates mappings for all VPID values except 0000H**, so it cannot flush VMX root operation's own translations.
- Which INVEPT and INVVPID types a processor supports is enumerated in **IA32_VMX_EPT_VPID_CAP** — read it rather than assuming all four INVVPID types exist.

**Two operational rules that catch people out.** Invalidation is **per logical processor**: after modifying EPT paging structures other logical processors may be caching, you must execute INVEPT on **each** of them. And both instructions are valid only in **VMX root operation**, so a guest that needs an invalidation against its own EPT hierarchy must be served by the VMM.

**Housekeeping that makes the tagging work at all.** VPID is a 16-bit VM-execution control field; **VPID 0000H is reserved for VMX root operation** (the current VPID is 0000H in root operation, whenever "enable VPID" is 0, and outside VMX operation entirely), and VM entry fails if "enable VPID" is 1 with a VPID field of 0000H. Give each vCPU a distinct non-zero VPID. (A processor supporting SEAM implicitly widens the tag to 17 bits and uses 10000H–1FFFFH inside SEAM, while the VMCS field stays 16 bits.)

**Citation given:** Intel SDM Vol.3C Ch.31 (the three mapping kinds and their tags, INVEPT/INVVPID descriptors and type values, what each instruction can and cannot invalidate), §31.1 (VPID 0000H reservation), §31.4.3.1 / §31.4.3.2 (what VM entry/exit invalidate with and without VPID), §31.4.3.4 (when software should and need not invalidate after EPT changes), §27.6.12 (the VPID VM-execution control field), SDM Vol.3D App.A (IA32_VMX_EPT_VPID_CAP)
**Disagreement:** None. The **INVVPID type numbering** in the chapter (0 individual-address, 1 single-context, 2 all-contexts, 3 single-context-retaining-globals) and the **INVEPT numbering** (1 single-context, 2 all-context) both match my prior belief; I note them explicitly because the eval brief flags this as a corrected area.

---

### ve-conversion-and-busy-field
**Routed to:** `06-address-translation.md` (routing row "EPT structures, … PML, SPP, HLAT, **#VE**")
**Actually answered from:** `06-address-translation.md` §6.11, §6.11.1; `errata.md` (checked — nothing applicable)
**Answer:**

**What a #VE is.** A virtualization exception is **exception vector 20**, occurs **only in VMX non-root operation**, and is delivered **in place of an EPT-violation VM exit**, so guest-resident agents can handle their own second-level faults without a round trip to the VMM. It pushes **no error code**, and if **bit 20 is set in the exception bitmap** it causes a VM exit instead of being delivered to the guest.

**The exact conditions: two prerequisites, then six conditions.**

*The prerequisites make the EPT violation **convertible*:*
1. The **"EPT-violation #VE" VM-execution control is 1**.
2. **Bit 63 is 0** in the one entry that decides convertibility — the **not-present entry if the walk stopped there, otherwise the entry that maps the page**.

*A convertible EPT violation then becomes a #VE only if **all six** of these hold:*
1. **CR0.PE = 1**;
2. the logical processor is **not in the process of delivering an event**;
3. the EPT violation **did not cause a shadow stack to become prematurely busy**;
4. it **did not result from the Intel PT output process**;
5. it **did not result from PEBS**;
6. the **32 bits at offset 4 of the virtualization-exception information area are all 0**.

**Fail any one and the EPT violation is a VM exit.**

**The information area.** The virtualization-exception information address is a 64-bit VM-execution control field at VMCS encoding **202AH** holding the physical address of the area; VM entry requires 4-KByte alignment, and the SDM defines the contents only through offset 32:

| Offset | Size | Contents |
|---|---|---|
| 0 | 4 bytes | basic exit reason (**48** for an EPT violation) |
| 4 | 4 bytes | **#VE information "busy" field** |
| 8 | 8 bytes | exit qualification |
| 16 | 8 bytes | guest-linear address |
| 24 | 8 bytes | guest-physical address |
| 32 | 2 bytes | EPTP index |

On delivering a #VE the processor writes the would-be exit reason — 48 (00000030H) — at offset 0, the exit qualification at offset 8, the guest-linear address at offset 16, the guest-physical address at offset 24, and copies the current 16-bit **EPTP index** to offset 32.

**Why a #VE handler cannot fault recursively.** The processor **sets the 4-byte field at offset 4 to FFFFFFFFH when it delivers a #VE, and never delivers another while that field is non-zero.** **Guest software must clear it**, which makes #VE **non-reentrant by construction**. Condition (6) above is the same statement read from the delivery side: with the busy field non-zero, a convertible EPT violation fails the sixth condition and is therefore taken as an **ordinary VM exit** instead. So a guest handler that faults again before clearing offset 4 gets a **VM exit** rather than a nested #VE — which is the architecture's way of preventing an unbounded exception recursion inside the guest. The escape hatch is the VMM's: the fault does not vanish, it just becomes the VMM's problem.

(The SDM explicitly permits a VMM to let the guest **write** this area — an exception to the general rule that VMCS-referenced structures must not be modified by the guest — precisely because the guest has to clear the busy field.)

**The polarity of bit 63, and its two consequences.** Bit 63 **suppresses** rather than enables conversion. Setting suppress-#VE in the entry that maps a page is how a VMM keeps specific pages exempt from guest-side handling: those EPT violations always become VM exits even with the control on. Therefore (a) turning "EPT-violation #VE" on converts **every** convertible EPT violation in the address space at once unless the VMM has already set bit 63 across the hierarchy — **including the zeroed, not-present entries it uses for demand paging, where bit 63 is the one bit the processor still reads**; and (b) because the busy field gates delivery, recursion is bounded as described above.

**Why the EPTP index is there (§6.11.1).** The EPTP index is a 16-bit VM-execution control field at VMCS encoding **0004H**; an **EPTP-switching VMFUNC writes ECX[15:0] into it**, so it tells a #VE handler which entry of the EPTP list the current EPTP came from. The two features are designed to be used together: a VMM publishes several EPT views in the EPTP list, lets guest-resident code switch between them with VMFUNC, and converts the resulting EPT violations into #VE so the guest agent can decide which view it needs — **all without a single VM exit**. Because neither the switch nor the fault leaves VMX non-root operation, this pattern is also available to guest-resident code the VMM does not trust, which is why the EPTP list is a **VMM-controlled allowlist of views** rather than an arbitrary pointer.

**Uses.** #VE is used both by guest-resident introspection agents handling their own second-level faults and, in confidential-computing designs, to reflect unmapped-private-page accesses into the guest (the TDX use of #VE is owned by `13-tdx.md`).

**Citation given:** Intel SDM Vol.3C §28.5.8 and §28.5.8.3 (vector 20, non-root only, no error code, exception-bitmap bit 20), §28.5.8.1 (the two convertibility prerequisites, the six conditions, the busy-field gate, suppress-#VE bit 63), §28.5.8.2 (what is written into the information area and the busy field set to FFFFFFFFH), §27.6.19 (virtualization-exception information address 202AH and EPTP index 0004H), §29.2.1.1 (the VM-entry alignment check), §28.5.7.3 (EPTP switching writing the EPTP index), Ch.31 (general #VE framing)
**Disagreement:** None.

---

### ipi-virtualization-pid-table
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, **IPIv**")
**Actually answered from:** `07-apic-virtualization.md` §7.9, with §7.8 for the posting path it reuses and §7.6.6 for the self-IPI precedence; `errata.md` (checked — nothing applicable)
**Answer:**

**What it adds.** Even with the full APICv stack, a guest **sending** an IPI still exits: the ICR write needs VMM attention because the hardware has no way to find the target vCPU's posted-interrupt descriptor. IPI virtualization supplies exactly that missing lookup. In one line: **IPI virtualization is posted interrupts with the lookup done in hardware.**

It is enabled by a **tertiary** processor-based VM-execution control, and with it the processor emulates the three operations that would send an IPI — a write to **page offset 300H** on the APIC-access page, **WRMSR with ECX = 830H**, and some executions of **SENDUIPI** — by posting directly into the target vCPU's posted-interrupt descriptor.

**The lookup structure.** The processor locates the target's descriptor through a **PID-pointer table indexed by the target's virtual APIC ID**, addressed by the **PID-pointer table address** field (64-bit VM-execution control field, VMCS encoding **2042H**) with its size bounded by the **last PID-pointer index** field (16-bit, encoding **0008H**). The entry is read as **8 bytes at (PID-pointer table address + T × 8)**. VM entry requires bits 2:0 of the table address to be 0 and requires both the table address and the address of its last entry (base + 8 × last index) to satisfy the physical-address-width checks.

A **PID-pointer table entry** holds bits 63:6 of the descriptor's 64-bit physical address in bits **63:6**, five **reserved bits that must be 0 in bits 5:1**, and a **valid bit in bit 0** — so every descriptor address is 64-byte aligned, and a VMM can leave entries for non-existent vCPUs marked invalid. The processor's own test is **`PID_ADDR[5:0] == 000001b`** (valid set and all five reserved bits clear), and it **clears bit 0 before dereferencing**. A VMM that sets a reserved bit gets the same APIC-write VM exit as one that leaves the entry invalid.

**The algorithm, given virtual vector V and virtual APIC ID T:**

```
if V < 16:                          APIC-write VM exit (reason 56)
if T > last_PID_pointer_index:      APIC-write VM exit (reason 56)
PID_ADDR <- 8 bytes at (PID_pointer_table_address + T*8)
if PID_ADDR sets bits beyond the physical-address width
   or PID_ADDR[5:0] != 000001b:     APIC-write VM exit (reason 56)
PID_ADDR[0] <- 0
PIR <- 32 bytes at PID_ADDR (under lock); PIR[V] <- 1; store back
NotifyInfo <- 8 bytes at PID_ADDR+32 (under lock)
if NotifyInfo.ON = 0 and NotifyInfo.SN = 0:
    NotifyInfo.ON <- 1; SendNotify <- 1
else:
    SendNotify <- 0
store NotifyInfo back
if SendNotify = 1:
    send an IPI to NotifyInfo.NDST with vector NotifyInfo.NV
continue in the guest                                   # no exit
```

Once posted, the interrupt follows exactly the path of the posted-interrupt feature: the receiving processor takes the NV notification and merges PIR into VIRR.

**Which IPIs still exit.** IPI virtualization applies **only** when the ICR write has **all** of: destination shorthand **00B (no shorthand)**, **edge** trigger mode (bit 15 = 0), **bit 12 clear**, **physical** destination mode (bit 11 = 0), **fixed** delivery mode (bits 10:8 = 000B), and **vector ≥ 16**. The memory-mapped form additionally requires reserved bits **31:20, 17:16 and 13** to be 0; on the MSR form that is enforced by WRMSR's own reserved-bit #GP check.

So these still take a **trap-like APIC-write VM exit**:
- **logical destination mode** (including **flat mode** — the chapter explicitly corrects an earlier wording that said "flat-mode" was accelerated: flat mode is a *logical* addressing form and is **not** accelerated);
- **level-triggered** IPIs;
- any **destination shorthand** (self, all-including-self, all-excluding-self) — except that shorthand 01B (self) is handled by self-IPI virtualization, below;
- **vectors below 16**;
- **non-fixed delivery modes** (NMI, INIT, SMI, SIPI, lowest-priority, ExtINT);
- and every **hardware-lookup failure**: an index beyond the last PID-pointer index, a descriptor address beyond the physical-address width, or an invalid / reserved-bit-setting table entry.

All of those fall back to a trap-like APIC-write VM exit **taken as if there had been a write to page offset 300H**, which means a VMM never has to pre-validate what the guest writes to ICR.

**Precedence with self-IPI virtualization.** The 300H write path checks **self-IPI virtualization first**: with "virtual-interrupt delivery" set and destination shorthand **01B (self)**, edge trigger, fixed delivery and vector ≥ 16, the processor performs self-IPI virtualization (set VIRR[Vector], **RVI ← max(RVI, Vector)**, then evaluate pending virtual interrupts — no VM exit). Only if that control is 0, or one of those items is false, does it fall through to the IPI-virtualization checks.

**SENDUIPI** reaches the same machinery by a different route: with "use TPR shadow" set, the processor first writes the user-PID's notification vector and destination into VICR (or VICR_HI/VICR_LO in the xAPIC-virtualized case) and then performs IPI virtualization if "IPI virtualization" is 1, or takes an APIC-write VM exit for offset 300H if it is 0.

**Reported benefit** (Intel's kernel-side measurements, not an Intel specification claim): IPI cycle counts falling **22.21%** in xAPIC mode and **15.98%** in x2APIC mode on a 2-vCPU microtest, **9.73%** on a unicast-IPI benchmark, and hackbench runtime falling **18.8%** at 8 vCPUs and **18.2%** at 96 vCPUs.

**Citation given:** Intel SDM Vol.3C §32.1.6 (IPI virtualization and the three emulated operations), §32.1.6.1 (the posting path it reuses), §32.1.6.2 (PID-pointer table lookup, entry format, the full algorithm and every fallback), §32.4.3.2 and §32.5 (the ICR-form conditions, the self-IPI precedence, and the APIC-write exit), §32.7 (SENDUIPI), §29.2.1.1 (VM-entry checks on the PID-pointer table address), SDM Vol.3D App.B (field encodings 2042H and 0008H); the cycle-count figures are Intel kernel-side measurements carried as `[117]`, not a specification claim
**Disagreement:** None.

---

### interrupt-index-and-source-validation
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, **IRTE**, interrupt posting on the VT-d side")
**Actually answered from:** `11-vtd-interrupt-remapping.md` §11.1.1, §11.2.1, §11.2.2, §11.3, §11.3.1, §11.4, §11.4.1, §11.9, §11.10; `errata.md` E07 (checked — the famous interrupt-remapping erratum is Intel's 5520/5500 erratum #53, not AMD's)
**Answer:**

**Why the mechanism exists.** On Intel 64 platforms an interrupt is just a **DWORD memory write to the range FEEx_xxxxh**. Without remapping hardware, every field that decides *where that interrupt lands* — APIC ID, vector, delivery mode — travels inside the request itself, which means **any device that can issue a DMA write can forge any interrupt to any CPU**. Interrupt remapping replaces those fields with a **16-bit handle**: an index into a table only privileged software can write.

**Step 1 — recognise the request and pick a format.** Hardware decodes requests to FEEx_xxxxh as interrupt requests. **Address bit 4 is the Interrupt Format field**: Clear = compatibility format, Set = remappable format. (If ECAP_REG.IRREQ is Set and interrupt remapping is disabled, the request is blocked; if IRREQ is Clear and remapping is not enabled, everything is processed as compatibility format. Compatibility-format requests are blocked when IRTA_REG.EIME is Set or GSTS_REG.CFIS is Clear.)

**Step 2 — extract the handle.** The remappable format carries almost nothing:

| Address bits | Field |
|---|---|
| 31:20 | Interrupt Identifier — must be **FEEh** to be decoded as an interrupt request |
| 19:5 | **Handle[14:0]** |
| 4 | Interrupt Format — must be 1b |
| 3 | **SHV** — SubHandle Valid |
| 2 | **Handle[15]** |
| 1:0 | Don't care |

| Data bits | Field |
|---|---|
| 31:16 | Reserved (0) when SHV is Set |
| 15:0 | **Subhandle**, when SHV is Set |

Note the top bit of the handle is stranded at **address bit 2**. The 16-bit Handle gives 64K unique interrupt requests per remapping hardware unit. SHV exists to support MSI constructs that have only a single address with multiple data values; when SHV is Clear the whole data field is ignored.

**Step 3 — compute `interrupt_index`.** Two lines of the specification:

```
if (address.SHV == 0)
    interrupt_index = address.handle;
else
    interrupt_index = address.handle + data.subhandle;
```

**Step 4 — bounds-check it.** If the computed `interrupt_index` is **equal to or larger than** the number of IRTEs in the table, the request is an error (**fault reason 21h**, which also covers an IRTE access above the Host Address Width). The table is a memory-resident **single-level** table located by **IRTA_REG (offset 0B8h)**: IRTA at bits 63:12 (4-KB aligned), **EIME at bit 11**, reserved 10:4, **S (Size) at bits 3:0**, with the number of entries being **2^(S+1)** and a maximum of **64K** IRTEs. Values written to IRTA_REG take effect only after the **Set Interrupt Remap Table Pointer** command.

**Step 5 — fetch the IRTE.** For a remappable request, hardware performs **reserved-field checking**, retrieves **Source-id, Handle, SHV and Subhandle**, computes and bounds-checks `interrupt_index`, then obtains the IRTE from the **Interrupt Entry Cache** or fetches it from the table. It **must read the entire 128-bit IRTE as a single operation and must not use multiple reads**, because software may change an IRTE atomically. If ECAP_REG.C (Coherent) is Clear, IRTE fetches do not snoop processor caches; implementations reporting ECAP_REG.MTS = 1 must use write-back memory type for IRTE fetches.

**Step 6 — presence, then source validation.** If the IRTE's **Present (P, bit 0)** field is Clear, the request is **blocked and treated as a fault** (reason **22h**). **Source-id checking per SVT, SID and SQ follows the presence check**, and failure blocks the request (reason **26h**). (FPD, bit 1, is evaluated *irrespective* of P; every other IRTE field is evaluated only when P is Set.)

**How it decides the device was allowed to raise that interrupt — SVT / SID / SQ.**

The IRTE for remapped interrupts (VT-d §9.9) places these at the top: **SVT bits 83:82, SQ bits 81:80, SID bits 79:64** (with DST 63:32, V 23:16, IM bit 15, AVAIL 11:8, DLM 7:5, TM bit 4, RH bit 3, DM bit 2, FPD bit 1, P bit 0).

- **SVT** specifies the **type of validation** hardware must perform on the source-id of requests referencing this IRTE, and is evaluated only when P is Set.
- **SVT = 01b**: **SID** specifies the requester-id allowed to originate requests referencing this IRTE, and **SQ** determines which bits of SID are considered in the verification.
- **SVT = 10b**: the **upper 8 bits of SID are a Startbus#** and the **lower 8 bits an Endbus#**; a referencing request must have a requester-id whose **bus number lies within that range**. This encoding may be used to verify interrupts originating behind PCI Express-to-PCI/PCI-X bridges.
- **SQ** is evaluated only when P is Set **and SVT is 01b**, and exists to verify origination of interrupts generated by devices supporting **phantom functions**. Its encodings **progressively ignore the least significant fields** of the SID and requester-id: full comparison; comparison ignoring the third least significant field; ignoring the second and third; ignoring the least three significant fields.
- **SID** is evaluated only when P is Set and SVT is **01b or 10b**.

**The limit of what this can isolate (§11.1.1).** Source-id validation is only as good as the source-id the platform can observe:
- **PCI Express and root-complex integrated devices**: source-id is the device's **PCI requester-id** — the clean case.
- **Devices behind PCIe-to-PCI/PCI-X bridges**: the requester-id may be the device's *or* the bridge's secondary-interface bus number with device/function zero — because of this aliasing, **interrupt-remapping hardware does not isolate interrupts from individual devices behind such bridges**.
- **Devices behind conventional PCI bridges**: source-id is the **legacy bridge's** requester-id, so again no per-device isolation.
- **Legacy interrupt routing**: the **I/OxAPIC** generates the transaction, and each I/OxAPIC must include a **unique 16-bit source-id** reported by BIOS through ACPI structures.
- **Non-PCI-discoverable devices that can generate MSIs** (e.g. integrated HPET) must be assigned **unique non-conflicting 16-bit source-ids**, also reported by BIOS through ACPI.

The specification's requirement behind all of this: "to support domain-isolation usages, platform hardware must be capable of uniquely identifying the requester (source-id) for each interrupt message."

**The fault codes this path can raise** (§5.1.4.1; all non-recoverable, faulting request treated as an Unsupported Request; "qualified" means reported only when FPD is Clear in the IRTE used):

| Reason | Condition | Qualified |
|---|---|---|
| 20h | Reserved field(s) Set when decoding per the remappable format | No |
| 21h | `interrupt_index` exceeded the configured table size, or IRTE access above HAW | No |
| 22h | IRTE **Present** field Clear | Yes |
| 23h | Hardware access to the table through IRTA_REG errored | No |
| 24h | Reserved fields non-zero in an IRTE with P Set (including conditional reserved fields) | Yes |
| 25h | Compatibility-format request blocked (EIME Set, or CFIS Clear) | No |
| **26h** | **Source-id verification failure against SID, SVT and SQ in an IRTE with P Set** | Yes |
| 27h / 28h | Posted-descriptor access error / reserved fields non-zero (posted IRTEs only) | Yes |
| 29h | Untranslated request-without-PASID to FEEx_xxxxh not meeting valid-interrupt requirements | No |
| 2Ah | EIME = 0 in IRTA_REG on an implementation reporting EIMER Set | No |
| 2Bh | MSI request while Interrupt Remapping disabled on hardware reporting IRREQ Set | No |

**After a successful lookup**, the IRTE supplies what the request no longer carries: V (vector, bits 23:16), DST (destination, 63:32), DM (logical vs physical interpretation of DST), RH, TM and DLM. When forwarding a remapped request to the system bus, the "Trigger Mode Level" field on the system bus is **always set to asserted (1b)**. **IM (bit 15)** selects interpretation: IM = 0 means the request is **remapped**; IM = 1 means it is **posted** and the same 128 bits are read in the posted format of §9.10.

**THE SKILL DOES NOT CONTAIN THIS** for one sub-part: the chapter states what **SVT = 01b** and **SVT = 10b** mean but never states the meaning of **SVT = 00b** (conventionally "no source-id verification") or of the fourth encoding, and it describes the four SQ behaviours qualitatively without giving the numeric SQ encodings. If you need SVT = 00b or the numeric SQ values, VT-d Rev 5.20 §9.9 must be consulted directly.

**Citation given:** Intel VT-d Specification Rev 5.20 §5.1.1 (source-id origin and the bridge/I/OxAPIC/HPET limits), §5.1.2 / §5.1.2.1 / §5.1.2.2 (formats, Interrupt Format bit 4, remappable address and data layout), §5.1.3 (the interrupt-remapping table, the `interrupt_index` computation, the bounds check, 64K maximum), §5.1.4 (hardware operation order: reserved-field check → field retrieval → index → cache/fetch → presence → source-id check; single-read requirement; ECAP_REG.C and MTS), §5.1.4.1 (fault reasons 20h–2Bh and the "qualified" definition), §9.9 (IRTE layout for remapped interrupts, SVT/SID/SQ semantics), §11.4.10 (IRTA_REG at 0B8h, EIME, S, 2^(S+1) entries), §11.4.3 (ECAP_REG.IR at bit 3), §2.5.2 (the three motivations)
**Disagreement:** None.

---

### ooh-reported-results
**Routed to:** `16-performance.md` (routing row "Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT")
**Actually answered from:** `16-performance.md` §16.7 and §16.11 item 7; `errata.md` O6 (and E04 for the venue); cross-checked against `14-nested-virtualization.md` §14.13, which `errata.md` names as the owner
**Answer:**

**Both figure sets are correct — for different publications — and they must never be merged.** The Out of Hypervisor (OoH) line of work proposes exposing hypervisor-reserved features (PML, SPP, CAT, EPT) directly to guest processes so they can be used inside a VM without the nested path. EPML is its extended-PML mechanism. There are **two publications**, and each reports its own numbers:

1. **The arXiv preprint — arXiv:2202.13483**, "Out of Hypervisor (OoH): When Nested Virtualization Becomes Practical", 2022-02-27, never revised. It reports that **EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead of about 0.5%**, compared against SPML, `/proc` and `userfaultfd`. In its own words: *"The results show that EPML reduces CRIU checkpointing time by about 14% while leading to a negligible overhead (of about 0.5%) compared to SPML, /proc, and userfaultfd."*

2. **The retitled and extended SC'22 paper** — "Out of Hypervisor (OoH): Efficient Dirty Page Tracking in Userspace Using Hardware Virtualization Features", which **adds Boehm garbage collection** to the evaluation. It reports **13× faster CRIU checkpointing, up to 6× faster Boehm garbage collection, and about 16× less overhead on the monitored application**, again versus SPML, `/proc` and `userfaultfd`. In its own words: *"EPML speeds up CRIU checkpointing (by 13×) and Boehm garbage collection (by 6×) times compared to SPML, /proc, and userfaultfd while leading to 16× less overhead on applications."*

**So the answer depends on which publication you are citing, and you must name it with the identifier.** There is no evidentiary conflict to adjudicate and no averaging to do: the two figure sets belong to two different publications of the same line of work, each correct for its own scope. Secondary sources merge them because both are called "Out of Hypervisor".

**Venue correction that travels with these numbers** (`errata.md` E04): OoH was published at **SC '22** (IEEE/ACM Supercomputing, Dallas, November 2022), **not SOSP '22**; arXiv:2202.13483 is the February 2022 preprint. The frequent SOSP attribution is wrong.

**Disagreement between two files inside the skill, recorded rather than resolved silently:** `errata.md` **O6** states that this item is **settled** (`C:high`) — "Both are correct, for different publications, so there is no evidentiary conflict to adjudicate" — and `16-performance.md` §16.7 and §16.11 item 7 agree with that at `C:high` ("Not a disagreement, and no longer recorded as one"). But `14-nested-virtualization.md` §14.13, which `errata.md` itself names as the **owner** of the underlying fact, still carries the item as an **"Unresolved conflict in OoH's own reported results (`C:low`)"** with "no choice between them is made". The substance is identical in all three places — both figure sets, with their sources, never averaged — so only the *status label and confidence* differ. Per `SKILL.md` §How-to-use step 3, `errata.md` wins where it disagrees, so the item is settled; `14-nested-virtualization.md` §14.13's "unresolved / C:low" framing is stale and should be updated to match O6.

**Citation given:** arXiv:2202.13483, "Out of Hypervisor (OoH): When Nested Virtualization Becomes Practical" (2022-02-27), abstract — chapter source `[307]`; the SC'22 paper "Out of Hypervisor (OoH): Efficient Dirty Page Tracking in Userspace Using Hardware Virtualization Features", IEEE/ACM Supercomputing, Dallas, November 2022 — chapter sources `[308]`/`[309]`/`[409]`. These are academic measurements, not Intel architecture, so per the skill's output standards they cite the paper, not the SDM.
**Disagreement:** As recorded above — an internal status/confidence inconsistency between `errata.md` O6 + `16-performance.md` (settled, C:high) and `14-nested-virtualization.md` §14.13 (unresolved, C:low). No disagreement with my prior belief; my prior was the common merged version, which both sides of the skill correctly reject.

---

### hyperv-owns-vmx-root
**Routed to:** `17-windows-platform.md` §17.1 (routing row "**Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, 'why no VT-x'**")
**Actually answered from:** `17-windows-platform.md` §17.1, §17.1.1, §17.1.2, §17.3.1–§17.3.6; `14-nested-virtualization.md` §14.12.1; `errata.md` (checked — nothing applicable)
**Answer:**

**Who owns it.** **VMX root operation has exactly one owner per logical processor: the software that executed VMXON.** The architecture provides no way to share it, so a second hypervisor must either be given the hardware or be given an interface onto whoever holds it. The architectural lock is that **VMXON causes a VM exit unconditionally in VMX non-root operation** — the first hypervisor to enter VMX root operation owns it.

On a Windows PC with any Hyper-V-backed feature enabled, that owner is **the Windows hypervisor**. Microsoft does not use Intel's vocabulary for this — "VMX root operation" appears in none of the Microsoft documents the chapter cites — but every element of the consequence is documented: "only one software component at a time can use this hardware"; the hypervisor "has exclusive control of key system hardware resources such as memory access permission controls in the CPU MMU and IOMMU early in system initialization"; "the root partition is itself a VM partition, although it has unique properties and greater privileges than guest VMs"; and "when a partition starts or resets, it begins running in VTL0". **The Windows installation the user interacts with is that root partition: a partition above the hypervisor, in VTL0.** Once the Windows hypervisor is running, the Windows kernel itself executes as a guest and **any other VMM on the machine is by definition nested**.

**What turns it on — and it is not just the Hyper-V role.** Enabling **VBS/memory integrity, Credential Guard, WSL2, Windows Sandbox, Docker Desktop's Hyper-V backend, Defender Application Guard, or the Hyper-V role** all start the Windows hypervisor. Virtualization-based security is a Hyper-V-backed feature, so enabling it starts the hypervisor **even when the user never creates a virtual machine**, and the hypervisor is resident even when no VM is running. The enablement chain has four independent layers — silicon (VMX + SLAT), firmware (virtualization enabled; VT-d separately for DMA protection), platform feature (the Windows virtualization platform installed and enabled, which puts the hypervisor on the boot path), and a consumer that actually wants it. Layers 3 and 4 are separable, which is why **"Hyper-V is not installed" is not evidence that VMX is free**.

**How to tell from inside.** CPUID with EAX=1, **bit 31 of ECX** is the hypervisor-present bit ("in a non-virtualized environment, the bit will be clear"); leaf **0x40000000** returns the maximum hypervisor CPUID leaf and a vendor signature, **"Microsoft Hv"** for Hyper-V, and leaf **0x40000001** returns the interface signature **"Hv#1"**. On a Windows PC with any Hyper-V-backed feature enabled, that detection succeeds **inside the ordinary desktop session**, because the desktop is itself in a partition — so software that treats "a hypervisor is present" as evidence of tampering will see it on a stock machine.

**What it means for a third-party VMM.** Microsoft's statement of the problem carries no VMX vocabulary — "many virtualization applications depend on hardware virtualization extensions… However, only one software component at a time can use this hardware. Virtualization applications can't share the hardware" — and third-party virtualization applications "such as VMware and VirtualBox" cannot then drive the extensions directly, either failing to start VMs or falling back to a slower emulated mode. **On such a machine a third-party VMM is no longer a hypervisor: it is a user-mode process whose guest is a partition created and scheduled by Hyper-V.** There are exactly three coexistence options:

| Option | What owns VMX root | What the third-party VMM gets | Cost |
|---|---|---|---|
| **Platform API** — the Windows Hypervisor Platform (`WinHvPlatform.dll`, SDK headers): `WHvGetCapability`, `WHvCreatePartition`, `WHvSetPartitionProperty`, `WHvSetupPartition`, `WHvMapGpaRange`, `WHvCreateVirtualProcessor`, `WHvRunVirtualProcessor` | Hyper-V | a partition it drives from user mode | an extra hop per exit; **no direct control of execution controls** |
| **Run nested** — `Set-VMProcessor -ExposeVirtualizationExtensions $true` on a stopped VM | Hyper-V | real virtualization extensions inside a child partition | the nested multiplication of `16-performance.md` §16.7 — and Microsoft states virtualization applications other than Hyper-V "aren't supported in Hyper-V virtual machines, and are likely to fail" |
| **Disable the hypervisor** | the third-party VMM | the hardware, directly | loses **every** Hyper-V-backed Windows feature at once, including the security ones |

Concrete consequences of option 1: a guest exit is handled **twice** — the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to the user-mode VMM, whereas a VMM owning VMX handles the exit in its own handler directly. The API's exit reasons are an **abstraction over** hardware exit reasons (none, memory access, x64 I/O port access, unrecoverable exception, invalid VP register value, unsupported feature, x64 interrupt window, x64 halt, x64 APIC EOI, x64 MSR access, x64 CPUID, exception, x64 RDTSC, cancelled), several enabled only through a partition property; registers are accessed **by name** and **no WHP page mentions a VMCS at all**, so a feature a VMM would implement by programming its own execution controls is available **only if the API exposes an equivalent property**. A VMM reached through WHP is not executing VMXON itself, so the exit-multiplication and VMCS-merging costs are paid by the Windows hypervisor on its behalf — the architectural reason such configurations are slower than the same VMM on a machine with no hypervisor loaded. No public measurement of that difference carrying processor, workload and configuration is recorded in this knowledge base.

**The rule generalises beyond VM products.** The single-owner rule applies to **every** consumer of VMX: a driver, debugger or analysis tool that wants to execute VMXON is in the same position as a third-party VMM and must go through the platform API or run nested. A separate failure mode with a separate fix is software that relies on writable-executable kernel memory or patches kernel code — that is blocked by memory-integrity enforcement from VTL1, not by the ownership rule, and the two should not be diagnosed together.

**The diagnostic bottom line:** "VT-x is not available" from a third-party VMM on a Windows PC is normally a statement about **who owns VMX root operation**, not about firmware. The fix is either to use the platform API, run nested, or remove the feature that started the hypervisor — and the third option disables VBS, WSL2, Sandbox, Application Guard and the container backends together.

**Citation given:** Intel SDM Vol.3C Ch.26 (one owner per logical processor; VMXON and CR4.VMXE) and §28.1.2 (VMXON causes an unconditional VM exit in non-root operation) for the hardware half. For the Windows half, per the skill's output standards, Microsoft Tier-2 sources: Microsoft Learn's third-party-virtualization-application troubleshooting article ("only one software component at a time can use this hardware") `[315]`, the Windows Hypervisor Platform API documentation `[465]`, Hyper-V architecture / root-partition and VTL0 documentation `[463]`, `[485]`, the Hypervisor Top-Level Functional Specification for the CPUID hypervisor-present bit and leaves 0x40000000/0x40000001 `[461]`, the nested-virtualization page `[479]`, and the VBS requirements pages `[378]`, `[379]`, `[476]`, `[480]`
**Disagreement:** None.

---

### enlightened-vmcs
**Routed to:** `14-nested-virtualization.md` (routing row "Nested VMX, VMCS shadowing, vmcs02, **nesting on a PC**")
**Actually answered from:** `14-nested-virtualization.md` §14.12.2 and `17-windows-platform.md` §17.2.3 (which owns the VP assist page) and §17.7; `errata.md` (checked — nothing applicable)
**Answer:**

**What it is.** Hyper-V defines an **enlightened VMCS**: a **shared-memory structure that an aware L1 hypervisor uses instead of VMREAD/VMWRITE**. It removes the same exits that VMCS shadowing removes, but **in software and without needing the hardware control** — that is, without requiring the "VMCS shadowing" secondary processor-based VM-execution control.

**The mechanics.**
- Each enlightened VMCS is **exactly one 4-KByte page** in guest memory.
- It is made current **through a field of the virtual-processor assist page, not by VMPTRLD**. The VP assist page is enabled by writing its guest-physical address to the synthetic MSR at **0x40000073**; the hypervisor overlays a per-processor structure there carrying assistance fields (end-of-interrupt assist, virtualization-fault information, and these controls).
- **The VP assist page does not *hold* the enlightened VMCS; it holds the controls that select one.** The TLFS says the L1 hypervisor "may choose to use enlightened VMCSs by writing 1 to the corresponding field in the Virtual Processor Assist Page" (**`EnlightenVmEntry`**) and that "another field in the VP assist page controls the currently active enlightened VMCS" (**`CurrentNestedVmcs`**, a GPA).
- Consequently "there is no need for the L1 hypervisor to execute **VMREAD or VMWRITE or VMPTRLD** instructions".
- It carries a **"clean fields" mask** telling L0 which parts to reload on a nested VM entry.

**How it relates to VMCS shadowing.** They attack **the same cost by two different routes**. The cost is the price of the inner hypervisor's control-structure field accesses — on Intel hardware the dominant nested cost, because without help every VMREAD/VMWRITE L1 executes traps to L0 and L1 executes dozens per L2 exit.

- **VMCS shadowing** solves it **in hardware and architecturally**: a real shadow VMCS reachable by VMREAD/VMWRITE in VMX non-root operation via the VMCS-link pointer, with per-field VMREAD/VMWRITE bitmaps deciding which accesses may bypass L0. It requires the hardware control (secondary control bit 14) and works for any L1, enlightened or not.
- **The enlightened VMCS** solves it **in software, by contract**: L1 must know about Hyper-V's structure and agree to use it, in exchange for which no VMX control-structure instruction is executed at all for those fields. It needs no hardware feature, so it works where shadowing is unavailable — but only for a guest hypervisor that has been enlightened.

The "clean fields" mask is the software analogue of what shadowing gets for free: because L0 cannot observe which fields L1 touched (there are no traps left to observe), L1 must *tell* L0 which parts changed so L0 knows what to reload into vmcs02 on a nested entry. Under shadowing, L0 instead re-synchronises the shadowed fields with vmcs12 at the transitions (`copy_vmcs12_to_shadow()` / `copy_shadow_to_vmcs12()` in KVM's implementation).

**Where it sits on a Windows PC.** This is the L0-provides-to-L1 interface in the ordinary Windows nesting stack: Hyper-V is L0, the Windows kernel and any WHP-hosted VMM sit at L1, and that VMM's guests are L2. Hyper-V exposes the extensions to a guest VM — making it an L1 — with `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`, which Microsoft documents must be issued "while the virtual machine is in the OFF state". Microsoft supports one level of nesting, including Hyper-V on Hyper-V in production.

**Citation given:** Hypervisor Top-Level Functional Specification (TLFS) — the VP assist page at synthetic MSR 0x40000073, `EnlightenVmEntry`, `CurrentNestedVmcs`, the one-4-KB-page enlightened VMCS, the "no need to execute VMREAD or VMWRITE or VMPTRLD" statement, and the clean-fields mask — chapter sources `[316]` / `[461]`; Microsoft Learn nested-virtualization documentation `[311]` / `[479]`. For the hardware counterpart the chapter anchors to Intel SDM Vol.3C §27.6.15 (VMREAD/VMWRITE bitmaps) and §27.10 (shadow VMCS). Per the skill's output standards, the Hyper-V side cites Microsoft, not the SDM.
**Disagreement:** None.

---

### vtl-isolation-slat
**Routed to:** `17-windows-platform.md` (routing row "**Hyper-V**, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, 'why no VT-x'")
**Actually answered from:** `17-windows-platform.md` §17.2.7 (+§17.6.1); `15-security.md` §15.7 (which owns VBS); `14-nested-virtualization.md` §14.12.3; `errata.md` (checked — nothing applicable)
**Answer:**

**What a VTL is.** A **Virtual Trust Level** is a privilege level *within a partition*. A virtual processor can run at one of several VTLs, **higher levels being more privileged**, and **each VTL has its own memory access protections, its own interrupt state and its own private register state**, with **explicit hypercalls to call into and return from a higher level**. The TLFS defines VTLs as hierarchical, "with higher levels being more privileged than lower levels".

**How many.** The architecture defines **up to 16 VTLs** and a hypervisor may implement fewer; **only two are currently implemented**, so "the secure world" on Windows today means exactly one additional level, not an arbitrary hierarchy. The Windows mapping (documented separately from the TLFS): "the code running in the traditional model executes in **VTL0** and it cannot access the higher privileged **VTL1**, where the **Secure Kernel** and **Isolated User Mode (IUM)** execute code". A partition begins running in VTL0 when it starts or resets.

**What hardware actually enforces the boundary.** **Second-level address translation — on Intel parts, VT-x with EPT.** Each VTL "maintains a set of guest physical memory access protections" that **the hypervisor manages** and that **software in the partition cannot modify**, and Microsoft states the isolation is "created by the Hyper-V Hypervisor which assigns memory at boot time using Second Level Address Translation (SLAT)". VBS's own requirement list names second-level address translation among the hardware it requires. So **VTL0 code cannot read or write VTL1 memory even though both run in the same partition** — the permissions live in the EPT entries the hypervisor controls, not in the VTL0 page tables the (possibly compromised) Windows kernel controls. It is the same EPT permission machinery described for virtual machines, **applied to trust levels rather than to virtual machines**.

**Why this is the interesting structural point.** This is why a Windows PC can be a **hypervisor host without hosting any virtual machine in the ordinary sense**: the isolation boundary the feature needs is a **VTL boundary inside one partition**, not a second partition. It is also why VBS's guarantee survives a kernel compromise — the boundary is enforced one level down, by software the VTL0 kernel cannot write to.

**What is built on it.** Isolated User Mode processes ("trustlets") run at **VTL1 in user mode** and complete system calls by **marshalling them to the Windows kernel running in VTL0 ring 0**, which is how a trustlet can be both protected from and dependent on the normal OS. Memory integrity (HVCI) places the code-integrity decision in the secure kernel at VTL1, so the VTL0 kernel can execute only pages validated there and kernel pages cannot be both writable and executable — the per-page enforcement is a permission split expressed in those same second-level translation permissions. Credential Guard is another VBS consumer. VBS enclaves offer the same isolation to application code, "a software-based trusted execution environment inside the address space of a host application".

**Consequence for the rest of the machine.** Because VBS requires the hypervisor to be running, a VBS-enabled Windows PC is permanently in the nested configuration: the Windows kernel is a guest, and any other VMM on the machine is nested. Note also that VBS and nested exposure are separately configured — turning on nested virtualization for a guest does not turn on VBS inside that guest.

**Citation given:** Hypervisor Top-Level Functional Specification (VTL definition, hierarchy, per-VTL memory protections / interrupt state / private register state, the call/return hypercalls, up to 16 VTLs with fewer implementable) — chapter sources `[380]` / `[463]`; Microsoft Learn Isolated User Mode and VBS documentation (VTL0/VTL1 mapping, Secure Kernel and IUM, trustlet system-call marshalling, "created by the Hyper-V Hypervisor which assigns memory at boot time using Second Level Address Translation (SLAT)", the VBS hardware requirement list) — `[378]` / `[381]` / `[388]` / `[483]`. The hardware anchor for the enforcement mechanism is Intel SDM Vol.3C Ch.31 (EPT). Per the skill's output standards, the Windows behaviour cites Microsoft, not the SDM.
**Disagreement:** None.

---

### tdx-tlb-tracking
**Routed to:** `13-tdx.md` §13.8 (routing row "TDX: … TD lifecycle and legal call order, **Secure EPT (§13.8)**")
**Actually answered from:** `13-tdx.md` §13.8.5 (+§13.8.2 for the entry states it references); `errata.md` (checked — nothing applicable)
**Answer:**

**What TLB tracking is for.** It exists **to prove that no logical processor holds a cached Secure EPT translation for a given TD private GPA range**, and it is **required before removing a mapped private page or changing a mapping size**.

**What counts as a cached translation.** Broader than TLB entries alone: for TLB-tracking purposes "cached address translation" includes **TLB entries, cached paging-structure entries, and GPAs that the module has translated to HPAs and written into VMX control-structure fields for the CPU to read**.

**The protocol — the GPA-range TLB-tracking sequence, in order:**

1. **`TDH.MEM.RANGE.BLOCK`** on each GPA range. This **blocks creation of new translations but leaves existing cached ones valid.** (In the leaf state diagram this moves a MAPPED entry to BLOCKED and increments BLOCKED_COUNT; BLOCKEDW is the variant where only write translations are blocked.)
2. **`TDH.MEM.TRACK`**, which **advances the TD's epoch counter**.
3. **An IPI to each remote logical processor running one of the TD's VCPUs.**
4. **Each such LP TD-exits on receipt of the IPI.**
5. **The VMM treats the exit as spurious and re-enters the TD.**

**The completion condition.** A GPA range is considered **tracked** once **every one of the TD's VCPUs has been inactive at least once after `TDH.MEM.TRACK`**. The subsequent **TD entry on each VCPU flushes any stale entries** — that is where the actual invalidation happens. The IPI is only a means of forcing each VCPU through an exit/entry boundary; if the VMM **knows the active-VCPU count is zero after `TDH.MEM.TRACK`**, it may **skip the IPIs** entirely.

**Where the epoch is recorded.** **BEPOCH** in the **leaf PAMT entry** records **TDCS.TD_EPOCH at the moment the private page or SEPT page was blocked**, and is meaningful only when PT is **PT_REG, PT_EPT or PT_PR**. That is what lets the module decide, later, whether a given blocked page's epoch has been passed by the tracking epoch.

**When tracking is not required.** Two cases: when the TD's **OP_STATE** implies **no VCPU can run**; and for **SEPT entries whose state implies no cached translation can exist** — **EXPORTED_BLOCKEDW, PENDING_EXPORTED_BLOCKEDW, FREE and REMOVED**.

**Why the shape is what it is.** The host VMM is untrusted, so the module cannot take the VMM's word that a page is unused, and it cannot itself shoot down other processors' TLBs. So the protocol converts "no CPU caches this translation" into two facts the module *can* verify: (a) after `TDH.MEM.RANGE.BLOCK` no *new* translation can be created, and (b) after `TDH.MEM.TRACK` advances the epoch, every VCPU that subsequently re-enters does so through a module-controlled TD entry that flushes stale entries. Once each VCPU has been observed inactive after the epoch bump, both halves together establish the property, and the module will then permit the removal or size change.

**Citation given:** Intel TDX Module Base Architecture Specification §9.7 (purpose of TLB tracking, the definition of "cached address translation", the five-step GPA-range sequence, the tracked condition and the IPI-skip optimisation, and the exemptions by OP_STATE and SEPT state); §8.3.1 (BEPOCH in the leaf PAMT entry and its PT_REG / PT_EPT / PT_PR applicability); §9.2.1 / §9.2.2 (the BLOCKED / BLOCKEDW / EXPORTED_BLOCKEDW / PENDING_EXPORTED_BLOCKEDW / FREE / REMOVED entry states and `TDH.MEM.RANGE.BLOCK`'s effect)
**Disagreement:** None.

---

### l1tf-mitigation-chain
**Routed to:** `15-security.md` §15.5 (routing row "Transient-execution CVEs (**L1TF**/MDS/TAA/Spectre) and **mitigation MSRs**")
**Actually answered from:** `15-security.md` §15.5.1 (with §15.4.2 for IA32_ARCH_CAPABILITIES); `errata.md` (checked — E11 is adjacent: hardware-level problems in this space appear as microarchitectural side channels, not VT-x defects)
**Answer:**

**The CVEs.** L1TF has **three CVEs by target**: **CVE-2018-3615** (L1 Terminal Fault-SGX, the original Foreshadow), **CVE-2018-3620** (L1 Terminal Fault-OS/SMM) and **CVE-2018-3646** (L1 Terminal Fault-VMM). Intel tracks them as **INTEL-SA-00161**.

**The mechanism.** It is a **terminal fault**: when the paging-structure entry controlling an access has the **Present bit clear or reserved bits set**, the **address bits of that entry may still be used speculatively to read the L1 data cache**. Intel states that **terminal faults can occur while reading EPT entries as well** — which is what makes this a VM-boundary problem and not only an OS problem.

**What a hypervisor actually has to do — the chain:**

1. **The OS-side convention, which the hypervisor also owes its own kernel: PTE inversion.** This is *purely a software convention about non-present entries*: an OS constructs a mitigated entry by making it refer to a physical address that is **below MAXPHYADDR but above the highest cacheable memory**, so the speculative L1D lookup can never hit real data. Linux states the rule as "the kernel ensures that the address bits of PTEs, which are not marked present, never point to cacheable physical memory space." The same reasoning applies to the non-present EPT entries the hypervisor itself builds.

2. **The VMM-side mitigation: flush L1D before each guest entry.** Intel's L1TF analysis: *"Setting bit 0 of IA32_FLUSH_CMD MSR to 1 removes all content, including secrets, from the L1D. This flush must be repeated on every guest entry when the VMM or other guests on the core may have populated secrets into the L1D."*

3. **Check whether you are required to flush at all.** A **nested** VMM that finds IA32_FLUSH_CMD enumerated should check **IA32_ARCH_CAPABILITIES bit 3 (SKIP_L1DFL_VMENTRY)**, which indicates that it is **not required** to flush L1D on VM entry. The chapter calls this the single most important nested-mitigation interaction in the chapter — an L1 hypervisor that flushes unconditionally when L0 has already told it the flush is unnecessary pays the cost for nothing.

4. **Choose a policy, because "always" is not free.** Linux exposes it as **`kvm-intel.vmentry_l1d_flush`** with three values: **`always`** (flush on every VM entry), **`cond`** (flush only when the code between VM exit and VM entry can leak host memory) and **`never`** (mitigation disabled). **The default is conditional.**

**Why turning off hyperthreading is not the whole answer — and why the flush is not either.** The two halves fail in opposite directions, and this is the crux:

- **The flush does not address a sibling thread executing concurrently.** Hyperthreads **share the L1D**, so with SMT enabled an attacker VM running on the sibling thread can sample data *after* the flush and *while* the victim guest is running — the flush happens at entry, but the sibling keeps filling and reading L1D throughout. The residual options are **disabling SMT** or **scheduling only mutually trusting work on sibling threads (core scheduling)**.
- **But disabling SMT does not substitute for the flush.** Intel's own wording, which the chapter says is frequently mis-stated and is worth keeping exactly: *"the general mitigations described in this paper should still be applied as **disabling hyperthreading does not in itself provide mitigation for L1TF**."* Turning SMT off removes the *concurrent-sibling* sampling vector; it does nothing about the sequential case where the previous context on the same logical processor left secrets in L1D, which is exactly what the entry-time flush addresses.

So the answer is that L1TF needs **both** legs — non-present-entry address inversion plus an L1D flush on guest entry, and then *either* SMT disabled *or* core scheduling — and neither leg alone closes it.

**The reason the SMT option stayed controversial** is capacity, not doubt about the mechanism: Red Hat states that "Disabling HT has the perceived effect of 50% fewer vCPU for scheduling purposes. As a result, OpenStack and Red Hat Virtualization will have a perceived performance impact of up to 50% less capacity."

**Citation given:** Intel's L1TF analysis / INTEL-SA-00161 (the terminal-fault mechanism including EPT-entry reads, the IA32_FLUSH_CMD bit-0 flush and its per-guest-entry requirement, and the "disabling hyperthreading does not in itself provide mitigation" statement) — chapter sources `[352]`, `[351]`, `[353]`, `[23]`; Intel SDM Vol.4 §2.1 for IA32_FLUSH_CMD and IA32_ARCH_CAPABILITIES bit 3 (SKIP_L1DFL_VMENTRY) `[5]`; kernel.org L1TF documentation for PTE inversion and `kvm-intel.vmentry_l1d_flush` `[361]`, `[367]`; Red Hat for the capacity statement `[376]`
**Disagreement:** None.

---

### flexpriority-generation
**Routed to:** `01-vmx-intro.md` (routing row "Enabling VMX, VMXON failures, CPUID/IA32_FEATURE_CONTROL, **VT-x history**")
**Actually answered from:** `01-vmx-intro.md` (line stating both dating disputes are deferred to `errata.md` rather than resolved); `errata.md` **O1** (the open conflict, owner `07-apic-virtualization.md`); `07-apic-virtualization.md` §7.2
**Answer:**

**This is an open conflict in the knowledge base and I must not pick a side.** Two incompatible datings are in circulation and **neither is refuted**:

- **(a) Silicon evidence — 2006.** An `inxi` dump of a **Core 2 Duo T7700 (Merom, built 2006-09)** lists the **`flexpriority`** and **`tpr_shadow`** CPU flags, which places TPR-shadow-capable hardware in **2006** (Core 2, Merom/Penryn, 2006–2007).
- **(b) Intel-side and review-press framing — 2008.** Intel-side and review-press material consistently dates the *introduction* of Intel VT FlexPriority to the **Xeon 7400 series in 2008**.

The likeliest reconciliation is **"hardware 2006, brand 2008"** — but **no source states that**, so both datings must be given and the conflict marked. Confidence on the entry is `C:medium`.

**What FlexPriority actually is, which is why the dating is slippery.** "FlexPriority" is **Intel's marketing name for TPR-shadow-based TPR virtualization — not a separate architectural facility.** The SDM describes the mechanism only as the **"use TPR shadow" VM-execution control** and TPR virtualization; the name never appears as an architectural term. Concretely it is the TPR shadow layer and nothing above it: with "use TPR shadow" = 1 and "CR8-load exiting" = 0, MOV to CR8 writes bits 7:4 of **VTPR** on the virtual-APIC page instead of causing a VM exit, and MOV from CR8 reads it; with "use TPR shadow" set and "virtual-interrupt delivery" clear, a **TPR-below-threshold VM exit (basic exit reason 43, trap-like)** occurs when bits 3:0 of the TPR threshold exceed bits 7:4 of VTPR. It was aimed at 32-bit guest operating systems that write TPR on every interrupt-priority change; on 64-bit guests the same register is reached through CR8, which the same control covers. With virtual-interrupt delivery on, the TPR threshold is not used at all — the processor evaluates pending virtual interrupts instead — which is why FlexPriority belongs to the **pre-APICv layer** of the stack.

Because it is a brand name for a control rather than a discrete feature with its own enumeration, "when was it introduced" can legitimately mean "when did silicon carry the `tpr_shadow` capability" (2006) or "when did Intel market it under that name" (2008), and the sources do not agree on which they are answering.

**Citation given:** No Intel specification anchor exists for the dating — both the chapter and the errata entry tag these claims `[no-spec]`, because "FlexPriority" is not an SDM term. The two datings rest on: an `inxi` CPU-flag dump of a Core 2 Duo T7700 (Merom, 2006-09) `[621]`, and Intel-side / review-press attribution to the Xeon 7400 series in 2008 `[622]`, recorded as `errata.md` **O1** (`C:medium`, `V:durable`) with the mechanism itself in `07-apic-virtualization.md` §7.2 and its architectural description at Intel SDM Vol.3C Ch.32 ("use TPR shadow", TPR virtualization) and §27.6.8 (TPR threshold field, encoding 401CH).
**Disagreement:** None — I had no confident prior generation for FlexPriority, and I am reporting the conflict rather than resolving it, as the skill requires.

---

### vmfunc-generation
**Routed to:** `01-vmx-intro.md` (VT-x history) with `errata.md` checked first, as SKILL.md step 3 requires for commonly circulated claims
**Actually answered from:** `errata.md` **E06** (settled correction; owner `02-vmcs.md` for the VM-function controls, `06-address-translation.md` for EPTP-switching semantics); `01-vmx-intro.md` (defers the dating to `errata.md`); `06-address-translation.md` §6.13 (also defers it)
**Answer:**

**Neither, if you have to pick one — and the skill's instruction is not to pick one.** The premise of the question (Haswell **or** Skylake) is the misconception E06 corrects: "VMFUNC belongs unambiguously to one generation", quoted as either Haswell or Skylake with the other side dropped.

**The correction:** the two attributions **measure different things and both must be given**. The instruction **entered the ISA documentation in the Haswell/Silvermont era**, and **hardware availability is commonly dated to Skylake in engineering practice** (Xen and KVM support landed **2015–2016**).

**The form the skill tells you to write it in, verbatim:** *"VMFUNC entered the SDM in the Haswell era; hardware availability is usually dated to Skylake"* — and **do not assert a single generation**. Confidence `C:medium`, `V:durable`.

The architecture chapters say the same thing from their side: `06-address-translation.md` §6.13 records that "the generation in which VMFUNC and EPTP switching became available in shipping silicon is disputed in the legacy research notes (an instruction-set definition dated to the Haswell era versus attributions to a later server generation) and is **deferred to `errata.md` rather than asserted here**", and `01-vmx-intro.md` likewise defers both this and the FlexPriority dating to `errata.md`.

**What is *not* in dispute, in case that is what you actually need.** The architecture itself: VMFUNC is enabled by the "enable VM functions" secondary processor-based VM-execution control; the VM-function controls must have no bit set that **IA32_VMX_VMFUNC** (a single 64-bit allowed-1 mask, MSR 491H) does not report; **EPTP switching is VM function 0** (stated in the VM-function control definition in Vol.3C, not in App.A.11, which names no function); if EPTP switching is enabled, "enable EPT" must be 1 and the EPTP-list address must be 4-KByte aligned and within the physical-address width; and EPTP switching selects among **at most 512 EPTP values** held in the EPTP list, writing ECX[15:0] into the **EPTP index** field (VMCS encoding 0004H) so a #VE handler can tell which view was active.

**Citation given:** `errata.md` E06 rests on two non-Intel-specification sources for the dating, `[609]` and `[610]` (`C:medium`, `V:durable`); there is no Intel anchor for a generation attribution, which is precisely why the entry exists. The undisputed architectural facts carry Intel anchors: SDM Vol.3C §27.6.14 (VM-function controls, EPTP-list address, EPTP switching as VM function 0), §29.2.1.1 (the VM-entry checks), Vol.3D App.A.11 (IA32_VMX_VMFUNC as a single allowed-1 mask, MSR 491H), Vol.3C §28.5.7.3 (EPTP index written by VMFUNC), Ch.31 (at most 512 EPTP values).
**Disagreement:** My prior leaned toward "Haswell introduced VMFUNC/EPTP switching" as the single answer. The skill says that is half the picture and instructs that both attributions be stated, because they measure different things (ISA documentation vs shipping hardware availability, with Xen/KVM support in 2015–2016). I defer to the skill and state both.

---

### tdx-aes-key-strength
**Routed to:** `13-tdx.md` with `errata.md` checked first, as SKILL.md step 3 requires
**Actually answered from:** `errata.md` **O3** (opened as a conflict, recorded as **settled**; owner `13-tdx.md`); `13-tdx.md` §13.4.5
**Answer:**

**Neither, as an unqualified statement — the key strength is per-generation, and you must always state the generation with the number.**

The re-read recorded in `13-tdx.md` §13.4.5 found three things:

1. **The TDX ISA specification defines the TME-MK interoperation but does not fix a data-encryption key length.** So there is no architectural constant to quote.
2. **The 128-bit figure that circulates in the base architecture describes the per-HKID AES-XTS *tweak* key, not a fixed data-key length.** Specifically: in **Cryptographic Integrity (Ci)** mode the memory controller computes a **28-bit MAC per cache line** over the ciphertext, a **128-bit encryption tweak**, the TD Owner bit and a **128-bit MAC key**; the tweak is produced by encrypting the physical address with a **128-bit per-HKID ephemeral AES-XTS tweak key** generated at key configuration time (`TDH.SYS.KEY.CONFIG` / `TDH.MNG.KEY.CONFIG`). That 128 is the tweak key, and it has been mistaken for the data key.
3. **Intel's TDX feature-readiness support article gives the key strength per generation: 128 bit on 4th/5th-Gen Xeon, and 256 bit on Xeon 6 (both E-core and P-core).**

**Therefore:** any blanket statement that "TDX is AES-128-XTS" is generation-specific and **wrong as a general claim**; and "TDX is AES-256" is equally wrong as a general claim. Write, for example, "AES-XTS with a 128-bit key on 4th/5th-Gen Xeon and a 256-bit key on Xeon 6". Confidence `C:medium`, `V:durable`. The entry is kept in the errata under its original conflict number **O3** because the misconception still circulates, even though it is settled.

**Adjacent facts that keep this straight.** TDX **reuses the MKTME engines and key slots**; the TDX ISA partitions the activated HKID space into **shared HKIDs** (usable by legacy MKTME) and **private HKIDs** (usable only in SEAM mode), with the partition sizes read from **IA32_MKTME_KEYID_PARTITIONING (MSR 87H)** — NUM_MKTME_KIDS in bits 31:0 numbered 1..N, NUM_TDX_PRIV_KIDS in bits 63:32 numbered N+1..N+M, and HKID 0 the legacy TME shared key. **The host VMM never has access to TD encryption keys**: it manages HKID *assignment* and triggers engine configuration through the host-side functions, while the keys themselves are generated by the module and hardware. On platforms that do not use ACT there are two integrity modes — **Ci** (encrypted plus MAC plus TD Owner bit) and **Logical Integrity (Li)** (encrypted, protected by the TD Owner bit alone); in both, the memory controllers store a **1-bit TD Owner metadatum per cache line, covered by ECC**.

**Citation given:** Intel TDX ISA specification Ch.2 (TME-MK interoperation, HKID partitioning, no fixed data-key length) `[14]`; Intel TDX Module Base Architecture Specification §5.2 (HKID partitioning), §16.2 (Ci/Li modes, the 28-bit MAC, the 128-bit tweak and the 128-bit per-HKID ephemeral AES-XTS tweak key), §2.4 (the VMM never holds TD keys) `[11]`; Intel's TDX feature-readiness / support article for the per-generation AES key size (128-bit on 4th/5th-Gen Xeon, 256-bit on Xeon 6 E-core and P-core) `[251]` / `[585]`. Recorded as `errata.md` **O3**.
**Disagreement:** My prior was the widely circulated "TDX uses AES-128-XTS". The skill says that is generation-specific and wrong as a general claim — the 128 in the base architecture is the **tweak** key, the ISA fixes no data-key length, and Intel's per-generation matrix gives 128-bit on 4th/5th-Gen Xeon and 256-bit on Xeon 6. I defer to the skill, which is newer and carries the per-generation source.
