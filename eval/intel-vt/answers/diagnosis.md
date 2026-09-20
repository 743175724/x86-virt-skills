# Diagnosis questions — intel-vt skill

### vmlaunch-error-7
**Routed to:** `08-vmx-instructions.md` §8.4 ("what VM-instruction error N means"), then `04-vm-entry.md` §4.9 ("how to *fix* a control error")
**Needed quickref §0.2:** no
**Actually answered from:** `references/08-vmx-instructions.md` §8.4, §8.6.3, §8.8; `references/04-vm-entry.md` §4.3, §4.3.1, §4.3.2, §4.9, §4.10, §4.11
**Answer:**
VM-instruction error 7 is "VM entry with invalid control field(s)". ZF set with CF clear is VMfailValid: the processor found your VMCS and rejected its *contents*, and guest state was never touched — the guest did not run at all.

The specific signature "worked on one machine, fails on a newer one" has a named cause in the failure-signature table: a control bit was hard-coded rather than derived from the capability MSRs.

Mechanism. Each control field is checked against a capability MSR whose low 32 bits are the **allowed-0** settings and whose high 32 bits are the **allowed-1** settings. A bit that is 1 in the allowed-0 half is a "default-1" bit that *must* be set; a bit that is 0 in the allowed-1 half *must* be clear. So a control word that is legal on one microarchitecture is illegal on another, and a control field cannot simply be zero-initialised. The most common derivation bug is treating the two halves as "supported" and "default" rather than as allowed-0 and allowed-1; it manifests exactly as error 7 on a processor where a default-1 control cannot be cleared.

The fix — do not hand-pick bits. For each control field, take your desired value `v` and compute

```
v_final = (v | allowed0) & allowed1
```

which forces every default-1 bit on and every unsupported bit off in one step. If IA32_VMX_BASIC bit 55 is 1, use the `TRUE_*` capability MSRs (48DH–490H) instead of the originals: the non-TRUE MSRs report bits as default-1 that the processor actually lets you clear. Do not read the `TRUE_*` MSRs unless bit 55 is 1 — those addresses are not architecturally defined on older processors. Likewise do not read IA32_VMX_PROCBASED_CTLS2 unless the primary processor-based controls report support for bit 31 ("activate secondary controls"); the secondary controls are only checked when bit 31 is 1, and otherwise VM entry behaves as if all secondary controls were 0. Tertiary controls are a 64-bit field checked against IA32_VMX_PROCBASED_CTLS3, which reports allowed-1 settings only.

Second candidate, if you also enabled a feature when you moved machines: error 7 is also produced by dependency checks — unrestricted guest without EPT, virtual-interrupt delivery without external-interrupt exiting, posted interrupts without acknowledge-interrupt-on-exit. And a few list-level checks land here too: the VM-exit MSR-store/MSR-load and VM-entry MSR-load addresses must be 16-byte aligned with the last byte inside the physical-address width.

Note that error 7 does not tell you *which* control was wrong, which is why re-deriving all of them from the capability MSRs is faster than bisecting.
**Citation given:** Intel SDM Vol.3C §27.9.5 (rev 092) for the error-7 definition; SDM Vol.3D Appendix A for the allowed-0/allowed-1 capability-MSR semantics and the bit-55 `TRUE_*` rule; SDM Vol.3C §27.6.2 for the secondary-controls gate; SDM Vol.3C §27.7 and §27.8 for the MSR-area address checks

### vmresume-error-5-after-migration
**Routed to:** `08-vmx-instructions.md` §8.4 ("what VM-instruction error N means")
**Needed quickref §0.2:** no
**Actually answered from:** `references/08-vmx-instructions.md` §8.4, §8.3.8, §8.8; `references/04-vm-entry.md` §4.2, §4.11
**Answer:**
Error 5 is "VMRESUME with non-launched VMCS". You are right that the VMCS is the correct one — that is not what the error is about. The error is about the VMCS's **launch state**, which is a separate per-VMCS attribute, not part of its contents and not something the pointer tells you.

What happened. Migrating a vCPU to another logical processor requires VMCLEAR on the old processor before VMPTRLD on the new one, because VMCLEAR is what forces VMCS data cached on that logical processor out to the VMCS region in memory — a VMCS that is active on one logical processor must not be made current on another without it. But VMCLEAR is also the only thing that sets launch state to "clear", so the very step that makes the migration correct is the step that reset your launch state. The first entry on the new processor must therefore be VMLAUNCH, not VMRESUME.

The rule underneath: a VMCS acquires launch state "clear" only from VMCLEAR and "launched" only from a successful VMLAUNCH. VMLAUNCH fails with error 4 if the state is not "clear"; VMRESUME fails with error 5 if it is not "launched". **There is no instruction that reads the launch state back, so software must track it** — this is bookkeeping the hardware will not do for you, and a VMM that tracks "have I ever run this vCPU" rather than "has this VMCS been VMCLEARed since its last launch" gets exactly your symptom.

What to do. Track launch state per VMCS *and* per logical processor, keyed off your own VMCLEAR calls. After any migration: VMCLEAR on the source LP, VMPTRLD on the target LP, VMLAUNCH once, VMRESUME thereafter. Do not "fix" this by skipping the VMCLEAR — that is the worse bug, because it leaves stale cached VMCS data behind on the old processor.

Related bring-up rule, same mechanism: a freshly allocated VMCS region must be VMCLEARed before its first use, then VMPTRLDed, then entered with VMLAUNCH. Intel states VMRESUME is expected to have lower latency than VMLAUNCH, which is why hypervisors track launch state in software and prefer VMRESUME at all.
**Citation given:** Intel SDM Vol.3C §27.9.5 (rev 092) for errors 4 and 5; SDM Vol.3C Ch.33 for the launch-state transitions and the absence of a read-back instruction; SDM Vol.3C §27.11 for the VMCLEAR-before-migration requirement and the VMRESUME latency statement

### vmlaunch-cf-no-error
**Routed to:** `08-vmx-instructions.md` §8.4 ("what VM-instruction error N means"), with `04-vm-entry.md` §4.9 for the failure-mode split
**Needed quickref §0.2:** no
**Actually answered from:** `references/08-vmx-instructions.md` §8.1, §8.4, §8.7; `references/04-vm-entry.md` §4.2, §4.9, §4.11; `references/01-vmx-intro.md` §1.8.1
**Answer:**
Start with what the flags have already told you. CF set with ZF clear is **VMfailInvalid**, and VMfailInvalid records no error number *by construction*: there is no current VMCS in which to record one. The field is not "empty" because something went wrong writing it — there was nowhere to write. Contrast VMfailValid, which sets ZF (with CF clear) and writes a number into the VM-instruction error field of the current VMCS.

The distinction to internalise: **CF means "the instruction could not even find a valid VMCS to work with"; ZF means "the instruction found the VMCS and rejected its contents"** — and only in the second case is there an error code to read. You are in the first case, so the cause is: there is no current VMCS.

The enumerated reasons:

1. **VMPTRLD was never executed.** VMXON itself sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH, so a VMM that goes straight from VMXON to VMLAUNCH lands here.
2. **VMPTRLD was executed, failed, and you did not check its flags.** VMPTRLD reports error 9 (invalid physical address), 10 (VMXON pointer) or 11 (incorrect VMCS revision identifier). Because VMX instructions do not raise exceptions for most logical errors, a VMM that ignores RFLAGS after VMPTRLD silently proceeds with no current VMCS. Checking the flags after *every* VMX instruction is the only architecturally reliable error detection.
3. **VMCLEAR made it not current.**
4. **The current VMCS is a shadow VMCS**, which is not a valid source of guest state for a VM entry.

Where to start, concretely:

- **VMPTRST** the current-VMCS pointer. FFFFFFFF_FFFFFFFFH confirms the diagnosis in one instruction.
- Re-run VMPTRLD and **branch on CF, then ZF**. If ZF comes back, VMREAD the VM-instruction error field and look up 9 / 10 / 11.
- Check the **revision identifier**: the first doubleword of the VMCS region must carry IA32_VMX_BASIC bits 30:0, with bit 31 clear. A region allocated but never stamped is the classic cause of error 11.
- Check the region is **4-KByte aligned**, within the physical-address width, of the size reported in IA32_VMX_BASIC bits 44:32, and of write-back memory type.
- Check you are **not using the same page for the VMXON region and the VMCS**.

Expect the failure mode to change once VMPTRLD succeeds: CF becoming ZF means you have progressed from "no VMCS" to "VMCS contents rejected", and the error number then routes you onward — 7 means a VMX control field, 8 means host state, 4/5/26 mean the VMCS lifecycle or the instruction boundary. And if control ever reaches your host RIP instead of the instruction after VMLAUNCH, that was not a VMfail at all: read the exit reason instead.
**Citation given:** Intel SDM Vol.3C Ch.33 (rev 092) for the VMfailInvalid / VMfailValid flag protocol, the no-current-VMCS case, the shadow-VMCS case and the VMXON pointer initialisation; SDM Vol.3C §27.9.5 for VMPTRLD errors 9, 10 and 11; SDM Vol.3D Appendix A for IA32_VMX_BASIC bits 30:0 and 44:32

### vmlaunch-error-8-64bit
**Routed to:** `08-vmx-instructions.md` §8.4 ("what VM-instruction error N means"), then `04-vm-entry.md` §4.4 (host-state checks)
**Needed quickref §0.2:** no
**Actually answered from:** `references/08-vmx-instructions.md` §8.4, §8.3.8; `references/04-vm-entry.md` §4.4, §4.9, §4.11
**Answer:**
Error 8 is "VM entry with invalid host-state field(s)" — a check on the **host-state area** failed. That already tells you something useful: host-state failures are detected before guest state is loaded, so the guest genuinely never ran, matching your report. Error 8 versus error 7 is the fastest way to separate "my control bits are wrong" from "my host context is wrong".

For a brand-new 64-bit VMM failing on its *very first* VMLAUNCH, the cause is named outright: the **"host address-space size" VM-exit control is 0**, or a host segment selector has a non-zero RPL/TI. A 64-bit VMM that forgets "host address-space size" gets error 8 on the very first VMLAUNCH, before any guest code ever runs.

The rule it violates: if the logical processor is in IA-32e mode when VM entry executes (IA32_EFER.LMA = 1), the "host address-space size" VM-exit control **must** be 1; if it is not in IA-32e mode, that control must be 0. The control drags dependencies with it:

- If "host address-space size" is **1**: host CR4.PAE must be 1, and host RIP must be canonical.
- If it is **0**: the "IA-32e mode guest" VM-entry control must be 0, host CR4.PCIDE must be 0, and bits 63:32 of the host RIP field must be 0.

Check the rest of the host-state area next, in this order:

- **Segment selectors.** Host CS, SS, DS, ES, FS, GS and TR selectors must have RPL = 0 and TI = 0 (selector bits 2:0 = 000b). Host CS must not be 0000H and host TR must not be 0000H; host SS must not be 0000H unless "host address-space size" is 1. Copying selectors straight out of a running kernel's registers is how a non-zero RPL sneaks in.
- **Canonical addresses.** Host FS base, GS base, GDTR base, IDTR base and TR base must each be canonical, as must host IA32_SYSENTER_ESP and IA32_SYSENTER_EIP.
- **Control registers.** Host CR0 must satisfy IA32_VMX_CR0_FIXED0/FIXED1 and host CR4 must satisfy IA32_VMX_CR4_FIXED0/FIXED1 — and unlike the guest checks there is **no unrestricted-guest relaxation on the host side**. Host CR3 must not set any bit beyond the physical-address width.
- **Conditional MSR fields.** If "load IA32_PERF_GLOBAL_CTRL" is 1, the host field must set no reserved bit. If "load IA32_PAT" is 1, each of the eight PAT bytes must encode a supported memory type — 0 (UC), 1 (WC), 4 (WT), 5 (WP), 6 (WB) or 7 (UC-); values 2 and 3 are reserved and fail the check. If "load IA32_EFER" is 1, the host EFER field must set no reserved bit, its LMA bit must equal the "host address-space size" control, and its LME bit must equal LMA when host CR0.PG is 1.

Fix one more thing while you are there, because it is the *next* bug you will hit: a 64-bit VMM that sets "host address-space size" but forgets **"load IA32_EFER"** gets a working first entry and a **corrupted host EFER after the first VM exit**. Set both.

Finally, note the symmetry: the same IA-32e consistency requirement exists independently on the guest side, and the two sides are checked separately and reported differently — error 8 for host, exit reason 33 for guest.
**Citation given:** Intel SDM Vol.3C §27.9.5 (rev 092) for error 8; SDM Vol.3C §27.5 for the host-state checks (fixed-bit CR0/CR4, CR3, SYSENTER, PAT, EFER, selectors, canonical bases, and the host address-space size dependencies); SDM Vol.3C Ch.29 for the IA32_EFER.LMA / "host address-space size" agreement requirement

### entry-failure-33-qualification-0
**Routed to:** `04-vm-entry.md` §4.9 ("VM-entry checks, why VM entry failed")
**Needed quickref §0.2:** no
**Actually answered from:** `references/04-vm-entry.md` §4.9, §4.10, §4.11, §4.5.2, §4.5.3, §4.5.7; `references/05-vm-exit.md` §5.2 for the exit-reason field shape
**Answer:**
Your first VM entry did **not** succeed. 8000_0021H decodes as bit 31 set plus basic exit reason 33. Bit 31 of the exit-reason field is the VM-entry-failure indicator — it is 1 for exit reasons 33, 34 and 41 and 0 for a VM exit from a running guest — and reason 33 is **"VM-entry failure due to invalid guest state"**. The failure was detected *after* guest state had been loaded, which is why it reports through the exit-reason field at your host RIP instead of through RFLAGS, and why it looks superficially like a successful entry followed by an instant exit.

**Exit qualification 0 is itself the diagnosis, and it is the unhelpful one.** For reason 33 the qualification is 0 unless the failure was one of the specific enumerated cases — PDPTE loading, NMI injection blocked by STI (qualification 3), or an invalid VMCS-link pointer. Qualification 0 therefore means "one of the ordinary guest-state checks failed", and the VMM must re-derive the cause itself.

Two consequences to handle before debugging anything:

- The processor does **not** save guest state back into the guest-state area and does **not** process the VM-exit MSR-store area. Only the exit-reason and exit-qualification fields are guaranteed to be updated; other VM-exit information fields are undefined, so do not read them.
- Host state **is** loaded exactly as for a VM exit, so your context is the host-state area's context, not the context that executed VMLAUNCH. A VMM that keeps state in registers across the entry must reload it in its exit path.

Where to look. Two groups account for most of these:

**1. Segment registers and access rights — the single most common source of exit reason 33 during guest bring-up.** The access-rights word is: bits 3:0 type, bit 4 S, bits 6:5 DPL, bit 7 P, bits 11:8 reserved, bit 12 AVL, bit 13 reserved (except L for CS), bit 14 D/B, bit 15 G, bit 16 "unusable", bits 31:17 reserved. Check: reserved bits 11:8 and 31:17 are 0 on usable segments; P = 1 on every usable segment; S = 1 for CS/SS/DS/ES/FS/GS when usable; **CS and TR must always be usable** (most checks are skipped for unusable segments, but not for these two). CS type must be 9, 11, 13 or 15 — or 3, permitted only when "unrestricted guest" is 1, and then CS.DPL must be 0. SS type must be 3 or 7; SS.DPL must equal the SS selector's RPL (unless unrestricted guest) and must be 0 if CR0.PE = 0. DS/ES/FS/GS types must have the accessed bit set, plus the readable bit if a code type, and their DPL must be ≥ the selector RPL unless the type is conforming code (12–15). CS.DPL must equal SS.DPL for non-conforming code types 9/11, and be ≤ SS.DPL for conforming types 13/15. TR must be usable with S = 0, P = 1, type 3 or 11 (type 11 when "IA-32e mode guest" is 1) and selector TI = 0. LDTR, if usable: selector TI = 0, type 2, S = 0, P = 1. G is cross-checked against the limit — if any of limit bits 11:0 is 0 then G must be 0; if any of limit bits 31:20 is 1 then G must be 1. TR, LDTR, FS and GS bases must be canonical; bits 63:32 of the CS, SS, DS and ES bases must be 0. If "IA-32e mode guest" is 1 and CS.L is 1, CS.D/B must be 0.

**2. The IA-32e mode consistency set — six pieces of state that must agree.** Getting five of six right still produces reason 33 with qualification 0, so check them as a group. For a 64-bit guest: "IA-32e mode guest" = 1, guest IA32_EFER.LMA = 1, guest IA32_EFER.LME = 1, CR0.PG = 1, CR4.PAE = 1, CS.L = 1 with D/B = 0. For a 32-bit paged guest: all of those 0, except CR0.PG = 1 and CR4.PAE either way. Also, if guest CR4.PCIDE is 1, "IA-32e mode guest" must be 1.

Worth a glance too: guest GDTR and IDTR bases must be canonical, and bits 31:16 of the GDTR and IDTR *limit* fields must be 0 — the limits are 16-bit quantities stored in 32-bit fields.

**Why segment checks dominate.** The VMCS carries the *hidden* part of every segment register — base, limit and access rights — because the descriptor cache can legitimately disagree with the descriptor in memory. VM entry therefore cannot validate a segment by re-reading the GDT; it can only check the cached values for internal consistency, and it rejects every inconsistency a real processor could never have produced. A VMM that synthesises guest segment state by hand must synthesise a state the hardware could actually have reached.

One structural note to keep the failure modes straight: a VMfail (the RFLAGS path) never changes guest-visible state at all, whereas a reason-33 or reason-34 failure has already overwritten the processor's architectural state with the contents of the guest-state area before failing.
**Citation given:** Intel SDM Vol.3C §27.9.1 (rev 092) for bit 31 of the exit-reason field; SDM Vol.3D Appendix C for basic exit reason 33; SDM Vol.3C Ch.29 for the guest-state checks, the qualification-0 rule, the enumerated non-zero qualification cases and the post-failure processor state; SDM Vol.3C §27.4.1 for the guest access-rights field layout

### entry-failure-34-msr-load
**Routed to:** `04-vm-entry.md` §4.9 ("VM-entry checks, why VM entry failed")
**Needed quickref §0.2:** no
**Actually answered from:** `references/04-vm-entry.md` §4.7, §4.7.1, §4.9, §4.10, §4.11, §4.3.4
**Answer:**
8000_0022H is bit 31 — the VM-entry-failure indicator — plus basic exit reason 34, **"VM-entry failure due to MSR loading"**. This is a failed VM entry, not a guest exit. The failing thing is one entry in your **VM-entry MSR-load area**, and the exit qualification is the **1-based index** of the entry that failed.

So with qualification 3, the offending entry is the **third** one, at

```
msr_load_area + 16 * (qualification - 1)   =   msr_load_area + 32
```

Each entry is 16 bytes: bits 31:0 the MSR index, bits 63:32 reserved and **must be 0**, bits 127:64 the value to be written. Entries are processed in order, as if by a sequence of WRMSR instructions, up to the VM-entry MSR-load count.

Read entry 3 and check it against the failure conditions. An MSR-load entry fails if:

- bits 63:32 are not 0 — the commonest one, from a struct laid out as index/value with the reserved doubleword never zeroed;
- the MSR index is **C0000100H (IA32_FS_BASE)** or **C0000101H (IA32_GS_BASE)**;
- the index is **00000079H (IA32_BIOS_UPDT_TRIG)**;
- the index is in the **x2APIC range 00000800H–000008FFH**;
- or an execution of WRMSR with that index and that value **would fault** — a reserved bit set in the value, or an MSR the processor does not implement.

State of the machine when this happens. MSR loading occurs *after* guest state has been loaded, so reason 34 leaves the processor in the same "failed VM entry" shape as reason 33: host state is loaded and control resumes at your host RIP. Guest state is not saved back, the VM-exit MSR-store area is not processed, and only the exit-reason and exit-qualification fields are guaranteed valid — treat the other VM-exit information fields as undefined.

Two things to check at the same time:

- **List-level checks live elsewhere and report differently.** The VM-entry MSR-load address must be 16-byte aligned and the last byte of the list must lie within the physical-address width; those are *control* checks and produce VM-instruction error 7 on the RFLAGS path, not reason 34. The recommended maximum number of entries in an MSR-load or MSR-store list is 512 × (1 + IA32_VMX_MISC bits 27:25).
- **Do not double-load.** MSRs that the VM-entry and VM-exit controls load directly — IA32_EFER, IA32_PAT, IA32_PERF_GLOBAL_CTRL, IA32_BNDCFGS, IA32_DEBUGCTL — should not also be placed in the MSR areas; the dedicated VMCS fields are faster and are checked at entry rather than deferred into this failure path.

Useful contrast while you are here: the asymmetry across the three MSR areas is deliberate. A VM-entry MSR-load failure is recoverable, because the VMM still gets control — this exit is that control. A VM-exit MSR-store or VM-exit MSR-load failure is not: it produces a **VMX abort**, because there is no longer a well-defined context in which to report it.
**Citation given:** Intel SDM Vol.3D Appendix C for basic exit reason 34; SDM Vol.3C §27.8 for the MSR-load area entry format and the VM-entry MSR-load address checks; SDM Vol.3C Ch.29 for the per-entry failure conditions, the qualification-as-1-based-index rule and the post-failure processor state; SDM Vol.3D Appendix A for the IA32_VMX_MISC entry-count recommendation; SDM Vol.3C §30.7 for the VMX-abort asymmetry

### vmxon-general-protection
**Routed to:** `01-vmx-intro.md` ("Enabling VMX, VMXON failures, CPUID/IA32_FEATURE_CONTROL")
**Needed quickref §0.2:** no
**Actually answered from:** `references/01-vmx-intro.md` §1.4, §1.5, §1.8, §1.8.1; `references/08-vmx-instructions.md` §8.2, §8.3.1; `references/17-windows-platform.md` §17.1.2 for the platform caveat
**Answer:**
#GP(0) from VMXON has exactly three preconditions, and each maps to one thing to test — the failure modes are few, and a VMM that reports the wrong one is guessing rather than testing:

1. **CPL is greater than 0.**
2. **IA32_FEATURE_CONTROL is locked with the applicable VMXON-enable bit clear.**
3. **CR0 or CR4 hold values outside the fixed-bit window.**

"Works on some machines and not others, firmware says VT-x is enabled" points squarely at (2).

**IA32_FEATURE_CONTROL is MSR 3AH.** Bit 0 is the lock bit: while it is 0, execution of VMXON causes a general-protection exception; once firmware sets it to 1, WRMSR to IA32_FEATURE_CONTROL causes a #GP **until the next power-up reset**. Bit 1 enables VMXON in SMX operation and bit 2 enables VMXON outside SMX operation; VMXON checks the bit matching the current SMX state and raises #GP if that bit is clear. Because the lock makes the MSR read-only once firmware has set it, system firmware uses this register to offer a durable platform option that disables VMX and that operating-system software cannot override at run time — which is exactly what makes a firmware "VT-x: Disabled" setting effective against everything running afterwards.

Why the setup screen can say "enabled" and you still get #GP: the decision is the MSR, not the menu item. The setting may not have been applied to the MSR on that boot; the platform may be setting only the SMX-mode enable (bit 1) while you are running outside SMX; or — since the lock holds until the next **power-up** reset — a warm reboot after changing the setting may not have taken effect. Across a fleet, that is just firmware version and configuration variation.

**What to do:** read MSR 3AH and branch on it.
- Bit 0 = 1 and the applicable enable bit = 0 → report **"VMX disabled by firmware"** and do not retry. There is no software path to change the MSR before the next power cycle; the user must change the firmware setting and fully power-cycle the machine.
- Bit 0 = 0 → software may set bits 0 and 2 itself, which is what the Linux `kvm_intel` module does at load time.

Then rule out the other two: confirm CPL 0, and adjust CR0 and CR4 to satisfy IA32_VMX_CR0_FIXED0/FIXED1 and IA32_VMX_CR4_FIXED0/FIXED1 before executing VMXON.

Things that are **not** this symptom, so you can exclude them quickly: CR4.VMXE = 0 gives **#UD, not #GP** — as do real-address mode, virtual-8086 mode, IA-32e mode with CS.L = 0, and a register operand. A bad VMXON-region address, a missing revision identifier in the region's first doubleword, or bit 31 set there gives VMfailInvalid (CF = 1), not an exception at all.

One platform caveat if these are Windows machines: the far more common reason a VMM cannot use VMX on a Windows PC is that Hyper-V already owns VMX root operation (see `17-windows-platform.md` §17.1). But that presents as "VT-x unavailable", not specifically as #GP(0) on VMXON, so check IA32_FEATURE_CONTROL first here.
**Citation given:** Intel SDM Vol.3C Ch.26 (rev 092) for IA32_FEATURE_CONTROL at MSR 3AH, the lock bit, and the SMX / non-SMX VMXON-enable bits; SDM Vol.3C Ch.33 for the VMXON #GP and #UD condition lists, the CR0/CR4 fixed-bit requirement and the VMXON-region VMfailInvalid cases

### lost-event-during-delivery
**Routed to:** `05-vm-exit.md` §5.4 ("Decoding a VM exit … IDT-vectoring")
**Needed quickref §0.2:** no
**Actually answered from:** `references/05-vm-exit.md` §5.5, §5.6, §5.7; `references/04-vm-entry.md` §4.8 for the re-injection side
**Answer:**
Cause: when a VM exit occurs **while the processor is delivering an event through the guest IDT**, that event delivery is abandoned. If the VMM does not re-inject it, the event is simply lost — which is exactly a guest that hangs waiting for an interrupt it was already in the middle of taking. Your exits "look normal otherwise" because the page-fault exit itself *is* normal; the damage is the discarded interrupt underneath it, and nothing in the exit reason mentions it.

Mechanism — the **IDT-vectoring information field**. Layout: bits 7:0 vector, bits 10:8 interruption type, bit 11 error-code valid, bits 30:13 reserved, bit 31 valid. **Bit 31 is set only when the VM exit occurred while the processor was delivering an event through the guest IDT; it is the VMM's signal that an event was lost and must be re-delivered.** The interruption types here are 0 external interrupt, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software interrupt, 6 software exception. When bit 11 is 1, the IDT-vectoring error code field holds the error code associated with the interrupted event.

Note this field is distinct from the VM-exit interruption-information field, which describes the event that *caused* the exit (your page fault) — not the one that was interrupted.

**The fix, and almost certainly your bug: read the IDT-vectoring information field on *every* VM exit, not only on exits you expect to be event-related.** An exit handler that checks it only for selected reasons will silently drop events whose delivery faulted. "Occasionally hangs" is the signature of a handler that checks it for some exit reasons but not the one that happened to fire.

The standard response when bit 31 is set:

1. Copy the IDT-vectoring information and its error code into the **VM-entry interruption-information** and **VM-entry exception error-code** fields for the next VM entry, adjusting for the type of the original event.
2. For a software interrupt, privileged software exception or software exception recorded there, the **VM-exit instruction length** field holds the length of the instruction that caused the event; carry it over to the **VM-entry instruction length** when re-injecting, or the guest resumes at the wrong RIP.
3. Handle the exit that actually occurred (your page fault) as usual, then re-inject.

Two adjacent traps worth checking in the same handler, since both also produce intermittent hangs:

- **NMI unblocking due to IRET.** Bit 12 of the *VM-exit interruption-information* field records that the guest was executing an IRET that removed NMI blocking before the fault which caused the VM exit; the VMM must restore NMI blocking before resuming.
- **Advancing RIP on a fault-like exit.** The conventional way to complete an emulated instruction is to add the VM-exit instruction length to guest RIP before VMRESUME; doing this for a fault-like exit that must be re-executed is a common hypervisor bug and looks similar from outside.
**Citation given:** Intel SDM Vol.3C §27.9.3 (rev 092) for the IDT-vectoring information field layout, its interruption types and the meaning of bit 31; SDM Vol.3C §30.2.4 for the re-injection procedure and the instruction-length carry-over; SDM Vol.3C §27.9.2 and §30.2.3 for the VM-exit interruption-information field and NMI unblocking due to IRET; SDM Vol.3C §27.9.4 for the VM-exit instruction length field

### apicv-interrupts-lost-when-descheduled
**Routed to:** `07-apic-virtualization.md` ("APICv, virtual-APIC page, RVI/SVI, posted interrupts")
**Needed quickref §0.2:** no
**Actually answered from:** `references/07-apic-virtualization.md` §7.8, §7.8.1, §7.8.2, §7.8.3, §7.8.4
**Answer:**
Cause: the posted-interrupt descriptor for that vCPU is still configured as though the vCPU were running. Postings land in PIR (or are suppressed outright) and nothing ever consumes them, because the thing that consumes PIR only runs on the target processor in VMX non-root operation, or at the next VM entry. Blocking a vCPU without reconfiguring its descriptor is the classic way to lose interrupts under APICv.

Mechanism. Posting splits injection into a memory step and a signalling step. The poster — another vCPU's ICR write, the IOMMU on behalf of a passed-through device's MSI/MSI-X, or VMM software — does:

```
set PIR[Vector]
if SN = 1:            done     # deliberately silent
if ON was already 1:  done     # a notification is already in flight
set ON
send an interrupt with vector NV to the processor identified by NDST
```

The receiving side (posted-interrupt processing) clears ON, acknowledges the notification at the local APIC, atomically reads-and-clears PIR, ORs it into VIRR, raises RVI to the highest vector taken, and evaluates pending virtual interrupts. That only happens when the target processor receives the NV interrupt **in VMX non-root operation** with "process posted interrupts" set — or at VM entry, which also performs posted-interrupt processing when ON is set, so interrupts posted while the vCPU was not running are picked up at the next entry rather than lost, *provided you actually re-enter*.

So for a vCPU your scheduler has just blocked, there are two ways the interrupt goes nowhere:

- **SN is still set.** SN exists to shut off notifications while the target vCPU is not in a position to use them; a poster then records the vector in PIR and sends nothing at all. The interrupts accumulate for the next merge — which never comes if nothing wakes the vCPU.
- **NV and NDST still point into the guest.** The notification is sent with the guest notification vector to the physical APIC ID of a processor that is no longer running that vCPU. It arrives somewhere that does not care, and the vector sits in PIR.

**What to do.** The rule: a VMM that blocks a vCPU must **repoint NV at a host wake-up vector and NDST at the host CPU**, so a posting wakes the vCPU through the host interrupt path rather than being silently absorbed — and it **must refuse to block if ON is already set**, because that means a notification is in flight and there is work pending. Order matters: repoint first, then check ON, and re-check before committing to the block.

For the different case of a vCPU that is merely executing in host context rather than blocked, setting SN is the correct and measured optimisation: in KVM it improved `perf bench sched pipe` by 6.56% and cut posted-interrupt notifications from tens of thousands per second to hundreds, at a cost of about 1.58% on the VM-exit round trip. But SN must be cleared and the descriptor repointed on the resume path, or the optimisation becomes the bug.

It is worth knowing the hardware merge is not where the loss comes from. Posted-interrupt processing clears **ON before** the atomic read-and-clear of PIR, and that ordering is the correctness argument. A poster landing in the window either writes its PIR bit before the read-and-clear (merged immediately; its later notification finds PIR empty — one spurious merge, costing nothing) or after it (the bit stays in PIR, ON is set, and its notification causes a second round of processing that picks it up). Had ON been cleared *after* PIR was read, a poster in that window would have seen ON = 1, skipped the notification and left its bit in a PIR the target had just emptied — a genuinely lost interrupt. So the worst case in hardware is a redundant notification, never a dropped vector. If you are losing vectors, it is your descriptor management around the block/unblock transition.

Descriptor reference for debugging: 64 bytes, 64-byte aligned, referenced by the posted-interrupt descriptor address field of the VMCS. PIR at bits 255:0 (one bit per vector), ON at 256, SN at 257, NV (notification vector) at 279:272, NDST (notification destination, a physical APIC ID) at 319:288.
**Citation given:** Intel SDM Vol.3C Ch.32 (rev 092) for posted-interrupt processing, the posting algorithm, the PIR-to-VIRR merge and its ON-before-PIR ordering, the role of SN, and the rule that a VMM blocking a vCPU repoints NV/NDST and must not block when ON is set; SDM Vol.3C §27.6.8 for the posted-interrupt descriptor address VMCS field. The KVM `sched pipe` figures are a Linux kernel patch-series measurement (Tier-2), not an Intel specification claim

### msix-not-delivered-after-remapping
**Routed to:** `11-vtd-interrupt-remapping.md` ("Interrupt remapping, IRTE, interrupt posting on the VT-d side")
**Needed quickref §0.2:** no
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.2.2, §11.3, §11.3.1, §11.10, §11.11.1, §11.11.2, §11.12
**Answer:**
"Only the ones with large index values" is close to a fingerprint. The most likely cause is the **top bit of the interrupt handle**.

In the remappable interrupt-request format the 16-bit Handle is **split and non-contiguous**: Handle[14:0] sits at address bits 19:5, but **Handle[15] is stranded at address bit 2**, nowhere near the rest. Software that builds the MSI/MSI-X address by shifting a 16-bit handle left by 5 silently loses the top bit for every handle ≥ 0x8000. Indices below 0x8000 keep working; indices at or above it alias down to (index − 0x8000) and land on the wrong IRTE, or on one that was never programmed. That is exactly your symptom.

The full remappable address format, for checking your encoder:

| Address bits | Field |
|---|---|
| 31:20 | Interrupt Identifier — must be FEEh to be decoded as an interrupt request |
| 19:5 | Handle[14:0] |
| 4 | Interrupt Format — must be 1b for remappable format |
| 3 | SHV — SubHandle Valid |
| 2 | **Handle[15]** |
| 1:0 | Don't care |

When SHV is set, data bits 15:0 carry the 16-bit Subhandle and data bits 31:16 are reserved (0); when SHV is clear the whole data field is ignored. Hardware then computes `interrupt_index = address.handle` when SHV = 0, and `address.handle + data.subhandle` when SHV = 1 — so with SHV set, a multi-vector device can walk *across* the 0x8000 boundary even when its base handle is below it.

**Second candidate with the same shape: the table is too small.** IRTA_REG.S is a **log2-minus-one** — the number of entries is 2^(S+1), so S = 0 means two entries, not one. Get that off by one and every index above the real table size fails. If the computed interrupt_index is equal to or larger than the number of IRTEs in the table, hardware treats the request as an error. The maximum is 64K IRTEs, each 128 bits.

**How to tell the two apart: read the fault log.** Interrupt-remapping faults have their own numeric range, separate from the DMA-remapping reasons:

- **21h** — interrupt_index exceeded the configured table size, or the IRTE access referenced an address above HAW. This is the too-small-table case.
- **22h** — the Present (P) field in the IRTE is clear. This is what truncated-handle aliasing usually produces: you index an entry you never programmed.
- **20h** — reserved fields set when decoding the request per the remappable format.
- **24h** — reserved fields non-zero in an IRTE with P set, including conditional reserved fields programmed wrongly.
- **26h** — source-id verification failure against the SID, SVT and SQ fields of a present IRTE.
- **25h** — a compatibility-format request was blocked (EIME set in IRTA_REG, or CFIS clear in the Global Status Register).
- **2Ah / 2Bh** — EIME is 0 on hardware reporting EIMER set; an MSI arrived while interrupt remapping is disabled on hardware reporting IRREQ set.

All interrupt-translation faults are **non-recoverable and the faulting request is treated as an Unsupported Request** — the interrupt is dropped, which is why the symptom reads as "stopped being delivered" rather than as an error surfacing at the device.

Two more things to verify:

- **Nothing written to IRTA_REG takes effect until the Set Interrupt Remap Table Pointer (SIRTP) command**, and modifying EIME while IRES = 1 is explicitly forbidden.
- If any affected interrupts come from an I/OxAPIC rather than MSI/MSI-X, the split is different again: **Interrupt_Index[15] goes in RTE bit 11**, the Interrupt Format field at bit 48, and Interrupt_Index[14:0] at bits 63:49. Getting one path right and the other wrong gives a very similar partial failure.
**Citation given:** Intel VT-d Architecture Specification Rev 5.20 §5.1.2.2 (remappable format, Handle[15] at address bit 2, SHV and Subhandle); §5.1.3 (interrupt_index computation, 64K maximum, index-exceeds-size treated as an error); §11.4.10 (IRTA_REG layout, entries = 2^(S+1), SIRTP requirement); §5.1.4.1 (interrupt-remapping fault reasons 20h–2Bh and their non-recoverable/Unsupported Request treatment); §5.1.5.1 and §5.1.5.2 (I/OxAPIC RTE and MSI/MSI-X programming)

### device-dma-faulting
**Routed to:** `12-vtd-faults-bios-siov.md` ("VT-d faults and fault reason codes")
**Needed quickref §0.2:** no
**Actually answered from:** `references/12-vtd-faults-bios-siov.md` §12.1, §12.1.1, §12.2, §12.2.1, §12.2.2, §12.9
**Answer:**
Two separate things are happening, and they need separate diagnoses: why the DMA is blocked, and why you are not being told about it.

**Why it is silent from the device's side.** A non-recoverable address translation fault causes hardware to block the request, and the exact blocking method is implementation-specific. For a faulting *read* from a PCI Express device, hardware indicates Unsupported Request (UR) or Completer Abort (CA) in the completion status of the read completion. Faulting *writes* may be discarded in any manner convenient to the implementation — dropping the cycle, completing the write with all byte enables masked off, or redirecting to a catch-all memory location. So a blocked write can vanish with no signal anywhere.

**Why your handler never fires — check these in order:**

1. **FECTL_REG.IM defaults to 1.** Non-recoverable faults are reported to software using a message-signalled interrupt controlled through the Fault Event Control Register, with vector, delivery mode and address programmed through the Fault Event Data and Fault Event Address registers. IM (Interrupt Mask) is **bit 31 of FECTL_REG with a default value of 1**, so fault interrupts are masked out of reset. A driver that programs the fault event registers but never clears IM will silently log faults it never sees. This is the single most likely answer. (IP, Interrupt Pending, is read-only at bit 30; bits 29:0 are RsvdP.)

2. **FPD — the fault is "qualified" and suppressed.** A non-recoverable fault is qualified if software can suppress its reporting by setting a Fault Processing Disable bit in the context-entry, scalable-mode context-entry, scalable-mode PASID-directory entry or scalable-mode PASID-table entry. If remapping hardware encountered **any** translation-structure entry with FPD = 1 on the path, it must not report the fault. A copied or carelessly initialised context entry with FPD set gives exactly "blocked, and nothing in the log".

3. **Primary Fault Overflow.** If the Fault Recording Register referenced by hardware's internal index already has its F field set, hardware sets **PFO (FSTS_REG bit 0)** and the new fault information is **not recorded**. To recover you must process the pending faults in every Fault Recording Register, clear each F field, and then clear PFO by writing 1 to it; hardware then resumes recording from the current internal index.

4. **Source-id de-duplication.** Hardware compares the source-id of the currently faulting request against the SID field of each Fault Recording Register whose F field is set, and does **not** record the fault if it finds a match. A device faulting in a loop therefore produces one record, not a stream — and if you never clear F, nothing further arrives.

5. **PPF gating on the event.** A Fault Event may be generated when a fault is recorded causing PPF to be set, or when an Invalidation Queue Error causes IQE to be set. If PPF was already set from an unprocessed record, no new event is raised.

**How to read the log by hand.** The number of Fault Recording Registers is reported by **CAP_REG.NFR** and their base offset by **CAP_REG.FRO** — you cannot walk the ring without both. If the register base address is X and FRO reports Y, the first Fault Recording Register is at **X + (16 × Y)**, and the registers are 16 bytes apart. Each is 128 bits: F at 127, T1 at 126, AT at 125:124, PV at 123:104, **FR (fault reason) at 103:96**, PP at 95, EXE at 94, PRIV at 93, **T2 at 92**, reserved 91:80, SID at 79:64, FI (fault info) at 63:12. Note the request **type is split across two non-adjacent bits, T1 at 126 and T2 at 92** — decoders written against very old revisions read only T1. F is RW1C and sticky.

FSTS_REG: PFO bit 0, PPF bit 1, IQE bit 4, ICE bit 5, ITE bit 6, FRI bits 15:8 (bits 3:2 and 31:16 reserved, bit 7 Deprecated in Rev 5.20). PPF is the logical OR of the F fields across all Fault Recording Registers, recomputed whenever any F field changes. Process reported faults in circular FIFO fashion starting from the register referenced by FRI until you find one with F clear. Hardware's internal index resets to zero when both TES and IES are clear in the Global Status Register.

**Two things that catch people out:**

- **"Advanced fault logging" does not exist in Rev 5.20.** Primary Fault Logging is the only method defined and must be supported by all implementations; the GCMD_REG bits that once drove advanced fault logging (29 and 28) and the CAP_REG capability bit (3) are now reserved or Deprecated. Code written against an older revision, looking for a log buffer in memory, will find nothing.
- **An ATS-capable device can be blocked with nothing in your fault log, by design.** When remapping hardware detects a *recoverable* fault on a translation request from a Device-TLB it is not reported to software as a fault at all: hardware sends a successful translation completion with limited or no permissions, and the Device-TLB detects the fault. The device then reports it in a device-specific manner, or by issuing a page-request message if it supports PCI Express Page Request Services. If it is reported device-specifically rather than through Page Request Services, software must itself ensure stale IOTLB entries in the remapping hardware are invalidated.
**Citation given:** Intel VT-d Architecture Specification Rev 5.20 §7.1.1 (non-recoverable faults, blocking, UR/CA, discarded writes, qualified faults and FPD); §7.1.2 (recoverable faults and Device-TLB behaviour); §7.2 and §7.2.1 (Primary Fault Logging, internal index, PPF, PFO, source-id match, FIFO processing); §7.3 (fault event reporting and generation conditions); §11.4.7.1 (FSTS_REG), §11.4.7.2 (FECTL_REG, IM default 1), §11.4.7.6 (Fault Recording Register layout), §11.4.2 (FRO offset arithmetic)

### seamcall-illegal-sequence
**Routed to:** `13-tdx.md` §13.7 ("TD lifecycle and legal call order")
**Needed quickref §0.2:** no
**Actually answered from:** `references/13-tdx.md` §13.7.1, §13.7.2, §13.7.3, §13.7.4, §13.19
**Answer:**
The class is a **state and sequencing mistake, not a bad-leaf mistake**. The leaf exists and your encoding is fine; you invoked it in a state where the module does not permit it. TDX enforces two nested state machines and most `TDH.*` leaves are transitions on them, so "the ABI says this leaf exists" and "this leaf is legal right now" are different questions.

**Outer machine — the TD Life Cycle**, driven by key management: TD_HKID_ASSIGNED (TD private key not yet configured) → TD_KEYS_CONFIGURED (private key configured) → TD_BLOCKED (private memory access blocked, caches being flushed) → TD_TEARDOWN (TD has no HKID). `TDH.MNG.CREATE` enters TD_HKID_ASSIGNED; `TDH.MNG.KEY.CONFIG` on non-last packages keeps it there and on the last package advances it to TD_KEYS_CONFIGURED; `TDH.MNG.VPFLUSHDONE` — permitted only when the TD has no associated VCPUs and no bound TDIs — moves it to TD_BLOCKED; `TDH.MNG.KEY.FREEID` moves it to TD_TEARDOWN. In TD_TEARDOWN, `TDH.PHYMEM.PAGE.RECLAIM` reclaims non-TDR pages, and on the TDR page it destroys the TD.

**Inner machine — OP_STATE**, which subdivides TD_KEYS_CONFIGURED: UNALLOCATED → (`TDH.MNG.ADDCX` on the last required TDCX page) UNINITIALIZED → (`TDH.MNG.INIT`) INITIALIZED → (`TDH.MR.FINALIZE`) RUNNABLE, plus the migration states. The high-value facts:

- **`TDH.VP.CREATE`, `TDH.VP.ADDCX` and `TDH.VP.INIT` are legal only in INITIALIZED.** VCPU creation and initialization are allowed only during TD build time — so calling any of them after `TDH.MR.FINALIZE` is one of the most common instances of exactly this mistake.
- `TDH.MEM.*` and `TDH.MR.EXTEND` are self-transitions of INITIALIZED; `TDH.MEM.*` is also a self-transition of RUNNABLE.
- The migration states (START_EXPORT, LIVE_EXPORT, PAUSED_EXPORT, START_IMPORT, MEMORY_IMPORT, STATE_IMPORT, LIVE_IMPORT) are entered from RUNNABLE by the migration leaves.
- A TD VCPU may run only in **RUNNABLE, LIVE_EXPORT or LIVE_IMPORT**.

**Two siblings in the same class:**

*Ordering within a sequence.* The build order is: flush any MODIFIED cache lines for the pages about to become TDR, TDCS and the Secure EPT root → `TDH.MNG.CREATE` with the TDR page PA → assign an HKID and configure the TD ephemeral key on all packages → `TDH.MNG.ADDCX` repeatedly for the TDCX pages → `TDH.MNG.INIT`. VCPU build: flush MODIFIED cache lines for the TDVPR and TDCX pages → `TDH.VP.CREATE` → `TDH.VP.ADDCX` repeatedly → `TDH.VP.INIT` → optionally `TDH.VP.WR`. Teardown mirrors it, and **the TDR page must be reclaimed last**, because every other TD page's cache lines must already have been flushed first. Measurement has its own order too: initialized by `TDH.MNG.INIT`, extended with page properties by every `TDH.MEM.PAGE.ADD`, extended with page *contents* in 256-byte chunks by `TDH.MR.EXTEND`, completed by `TDH.MR.FINALIZE`.

*Concurrency.* Concurrency is architecturally constrained rather than best-effort: the specification defines explicit and implicit concurrency restrictions, transactions, and concurrency restrictions with host priority, and OP_STATE transitions are annotated with whether they take a **shared or an exclusive lock**. Two host threads racing on the same TD get a lock or concurrency status back — which also reads as "a leaf that exists returned an error".

**Decode the status rather than guessing.** Completion status is returned in **RAX** at three levels of detail: 0 means success; a positive value (0x0000000000000001–0x7FFFFFFFFFFFFFFF) means success with an informational or warning code; a negative value (0x8000000000000000–0xFFFFFFFFFFFFFFFF) means the function aborted with an error. At the medium level the status encodes **CLASS, ERROR, NON_RECOVERABLE, FATAL** (applicable only to `TDH.*`, indicating the TD can now only be torn down) and **HOST_RECOVERABILITY_HINT**. The completion-status class occupies **bits 47:40**, and the full status-code and operand-ID definitions are given in the **ABI specification**, not the base specification — so decode CLASS and the operand ID there rather than inferring from the leaf name.

One status not to mistake for a failure: long-running interface functions are architecturally interruptible, and a caller observing **TDX_INTERRUPTED_RESUMABLE** in RAX is expected to re-issue the same leaf until it completes.

Scope note: TDX is server-only. No client Windows PC has it.
**Citation given:** Intel TDX Module Base Architecture Specification §7.1 (TD Life Cycle), §7.2 (OP_STATE and its locks), §7.3 (TD build sequence), §7.4 (VCPU build sequence), §7.5 (teardown, TDR reclaimed last), §9.7 (states in which a VCPU may run), §12.2.1 (measurement ordering), §18.1 (concurrency restrictions), §18.5 (leaf and version in RAX; regular versus transition leaves), §18.6.1–§18.6.3 (completion-status levels; class at bits 47:40), §18.9 (interruptible functions and TDX_INTERRUPTED_RESUMABLE); Intel TDX Module ABI Specification §3.1 (status-code and operand-ID definitions)

### vtx-unavailable-on-windows
**Routed to:** `17-windows-platform.md` §17.1 ("Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, 'why no VT-x'")
**Needed quickref §0.2:** no
**Actually answered from:** `references/17-windows-platform.md` §17.1, §17.1.1, §17.1.2, §17.3.1, §17.3.4, §17.3.6, §17.4.5, §17.9.1
**Answer:**
Hyper-V already owns VMX root operation. Nothing is wrong with your firmware or your CPU.

**The mechanism.** VMX root operation has exactly one owner per logical processor — the software that executed VMXON — and the architecture provides no way to share it. A second hypervisor must either be given the hardware or be given an interface onto whoever holds it. On a Windows machine with any Hyper-V-backed feature enabled, the Windows hypervisor launches *before* the Windows kernel, so the Windows installation you are typing in is the **root partition, a guest of the hypervisor running in VTL0**. Your VMXON therefore cannot succeed. CPUID reporting VMX is a statement about the processor's capability, not about who currently holds it — the two are independent, which is why your check passes and your VMXON does not.

**What turned it on.** Virtualization-based security / memory integrity, WSL2, Windows Sandbox, Docker Desktop, Defender Application Guard, or the Hyper-V role. VBS is a Hyper-V-backed feature, so enabling it starts the hypervisor even though the user never creates a virtual machine. From the hardware's point of view these are indistinguishable — every one of them turns the machine into a hypervisor host — which is why enabling any one of them changes the behaviour of all the others, and why "Hyper-V is not installed" is **not** evidence that VMX is free.

**Where in the chain it failed.** Four independent layers decide whether the hypervisor is running, and your report says the first two are fine: (1) silicon — the processor must support VMX and second-level address translation; (2) firmware — virtualization enabled, with VT-d enabled separately, and the firmware must describe its remapping hardware to the OS; (3) platform feature — the Windows virtualization platform installed and enabled, which is what puts the hypervisor on the boot path; (4) consumer — something that actually wants it. Layers 3 and 4 are separable: a machine can have the platform present with the hypervisor not running, or the hypervisor running for a security feature with no VM defined.

**Confirm it from inside the laptop.** The hypervisor-present indication in the standard CPUID feature leaf is set by convention by hypervisors and is never set by physical hardware, and CPUID leaf 0x40000000 returns a hypervisor vendor identity string followed by an interface-signature leaf. On a stock Windows PC with any of the above enabled, that detection succeeds inside the ordinary desktop session — the desktop is itself in a partition.

**Your three options, with what each costs:**

| Option | What owns VMX root | What you get | Cost |
|---|---|---|---|
| Windows Hypervisor Platform (WHP/WHPX) | Hyper-V | a partition you drive from user mode | an extra hop per exit; no direct control of VM-execution controls |
| Run nested | Hyper-V | real virtualization extensions inside a child partition | the nested cost multiplication |
| Disable the hypervisor | your VMM | the hardware, directly | loses every Hyper-V-backed Windows feature at once, including the security ones |

Option 1 is what the whole industry did: QEMU implements WHP as an accelerator, VirtualBox has a native-execution backend that uses it when the Windows hypervisor is present, VMware Workstation gained a mode that runs on top of it, and the Android emulator uses it in place of its former standalone driver. The catch is that your VMM is then no longer a hypervisor — it is a user-mode process whose guest is a partition created and scheduled by Hyper-V. Registers are accessed by name; the VMCS is never visible; a feature you would implement by programming your own execution controls is available only if the API exposes an equivalent property.

Option 3 is not a per-product setting: because VBS, WSL2, Sandbox and the container backends are all Hyper-V-backed, turning the hypervisor off to get direct VMX access disables all of them together.
**Citation given:** Intel SDM Vol.3C Ch.26 (rev 092) for the single-owner rule of VMX root operation. Windows behaviour is Tier-2 and cited to its own sources: Microsoft, "Hyper-V Architecture" (root partition / child partitions) for the hypervisor launching before the kernel; Microsoft, Hypervisor Top-Level Functional Specification — Virtual Secure Mode (VTLs); Microsoft Hypervisor TLFS for the 0x40000000 hypervisor-identification leaf range; Microsoft Learn, "Virtualization-based security (VBS) enablement and hardware requirements" and "Enable Hyper-V" for the prerequisite chain; Microsoft, Windows Hypervisor Platform API reference for the WHP option

### driver-rejected-after-memory-integrity
**Routed to:** `15-security.md` §15.5 (the row covering VBS, HVCI and Credential Guard), cross-checked against `17-windows-platform.md` §17.6
**Needed quickref §0.2:** no
**Actually answered from:** `references/15-security.md` §15.7, §15.8; `references/17-windows-platform.md` §17.6, §17.6.1, §17.3.5, §17.9.1
**Answer:**
Being signed is not sufficient, and this is not a compatibility list your driver fell off. Memory integrity (hypervisor-protected code integrity, HVCI) runs kernel-mode code integrity **inside the VBS isolated environment rather than in the kernel it is policing**, and it enforces an invariant your driver almost certainly violates.

**The enforced invariant is W^X for kernel memory:** kernel pages are only made executable after passing code-integrity checks inside the secure environment, and executable pages are never writable.

**Two distinct reasons a driver fails here, and yours is very likely the first:**

1. **It violates W^X.** Drivers that allocate memory which is simultaneously writable and executable, that generate or patch code at runtime, or that otherwise mix data and code in one section are **incompatible by construction rather than by policy**. Microsoft's guidance is to keep a clear separation of data and code and never modify code pages directly. "Loaded fine for years" is the signature of a driver doing one of these: it was legal before because the VTL0 kernel was the only thing checking.
2. **Signing, in the HVCI sense.** The integrity check that authorises the transition to executable happens in the secure environment, so a signature the VTL0 kernel would have accepted is irrelevant. Unsigned or improperly signed kernel code fails for this second reason.

**Mechanism, at the page level.** Normal Windows including kernel mode runs in VTL0; the secure kernel and Isolated User Mode run in VTL1, and VTLs are hierarchical, so VTL1 is strictly more privileged. The boundary is enforced by memory access permissions the hypervisor assigns with second-level address translation — EPT on Intel — which software inside the partition, including the VTL0 kernel, cannot change. So the code page's **executable permission lives in the EPT entry the hypervisor controls, not in the VTL0 page tables the kernel controls**. A kernel page may be writable at VTL0 *or* executable at VTL0, but the secure kernel does not grant both at once. Because the decision is taken at a level the VTL0 kernel cannot write to, a compromised — or merely self-modifying — kernel cannot mark its own page executable. That is precisely the property the feature exists to provide, and precisely the property that breaks drivers which generate code.

For exploitation this is the point: even where a memory-safety defect lets an attacker modify memory, executable code pages cannot be modified and modified memory cannot be made executable, so "write shellcode into kernel memory and jump to it" fails.

**What to do.** Fix the driver — separate code and data sections, stop allocating RWX memory, stop runtime code generation and kernel patching, and re-sign through the path HVCI accepts. There is no configuration that keeps memory integrity on and exempts the driver, because the decision is taken one privilege level down from anything the driver or the kernel can influence. The alternative is turning memory integrity off, which also gives up the VBS-backed protections built on the same isolation (Credential Guard, for instance, is a trustlet — the isolated LSA process, LSAIso.exe — that depends on it).

**Do not confuse this with the other Windows symptom that looks similar.** Software that fails because it wants to execute VMXON is blocked by a different mechanism entirely — the single-owner rule, where Hyper-V holds VMX root operation. The two failure modes have different fixes and should not be diagnosed together.

Background on why the feature is affordable at all: **mode-based execute control (MBEC)** splits EPT execute permission into user-mode and supervisor-mode execute, so the hypervisor can allow user code to execute a page while denying kernel execution of it without a second set of structures. Microsoft names Intel's MBEC, AMD's GMET and ARM's TTS2UXN as the features designed to reduce HVCI's performance and power impact. Note also that the cost profile is per-page, not per-call: the expensive event is a change of page permissions, not ordinary execution.
**Citation given:** Intel SDM Vol.3C §31.3 and §31.3.2 (rev 092) for the VBS/VTL isolation primitive, the SLAT-enforced boundary and MBEC. Windows behaviour is Tier-2 and cited to its own sources: Microsoft Learn, "Enable virtualization-based protection of code integrity (memory integrity)" for the W^X invariant and the driver-compatibility requirements (no RWX allocations, no runtime code generation or patching, separate code and data); Microsoft, Hypervisor Top-Level Functional Specification — Virtual Secure Mode, for VTL0/VTL1 and the secure kernel

### hypervisor-works-linux-not-windows11
**Routed to:** `17-windows-platform.md` §17.1 ("Hyper-V, WHP/WHPX, WSL2, Sandbox, … 'why no VT-x'")
**Needed quickref §0.2:** no
**Actually answered from:** `references/17-windows-platform.md` §17.1, §17.3.1–§17.3.6, §17.4.5, §17.7, §17.9, §17.9.1; `references/16-performance.md` §16.3.1, §16.5
**Answer:**
What changed is **who owns VMX root operation**.

On Linux your VMM (or KVM's vendor module) executes VMXON and owns the hardware outright. On Windows 11 with any Hyper-V-backed feature enabled — virtualization-based security / memory integrity, WSL2, Windows Sandbox, Docker Desktop, Defender Application Guard, or the Hyper-V role — the Windows hypervisor launched before the kernel and holds VMX root operation; Windows itself is the root partition in VTL0. There is exactly one owner per logical processor and the architecture provides no way to share it. Note that none of those features requires you to have created a virtual machine, and several are on by default on modern Windows 11 hardware, which is why "the same machine" is not the same machine from VMX's point of view.

So your type-2 VMM is no longer a hypervisor on that box: it is a **user-mode process whose guest is a partition created and scheduled by Hyper-V**, reached through the Windows Hypervisor Platform. Every product that used to drive VMX directly on Windows took this route — QEMU as an accelerator, VirtualBox's native-execution backend, VMware Workstation's Windows-hypervisor mode, the Android emulator.

**Why it misbehaves or runs slower, mechanically:**

1. **Every exit is handled twice.** The hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to your user-mode code — one more boundary crossing per exit than a VMM owning VMX root operation pays.
2. **You lose control of the execution controls.** Register access is by name through get and set calls on a virtual processor, so the VMCS is never visible to you. A feature you would implement by programming your own VM-execution controls is available only if the API exposes an equivalent property — so optimisations that depend on intercepting less, or on a control the API does not surface, are unavailable regardless of what the silicon supports. In the feature map, VPID, APICv and posted interrupts, and dirty tracking are simply **not exposed**.
3. **Exit contexts are an abstraction, not the hardware exit reason.** They classify the exit in API terms — memory access, I/O port access, MSR access, CPUID, exception, halt, cancellation — so you cannot dispatch on the hardware encoding you tuned against on Linux.
4. **The whole machine pays second-level address translation**, because the Windows kernel is itself a guest: every TLB miss on the box is walked twice, not only inside your guest.

If instead you are running your VMM inside a VM on that PC, note that nesting does not remove the single-owner rule: the innermost VMM still does not own VMX root operation, every exit it takes is mediated by the levels above, and the inner hypervisor's control-structure accesses become the dominant cost — which is what the enlightened VMCS in the VP assist page and, in hardware, VMCS shadowing exist to reduce.

**Honest limit on magnitude.** No public measurement of the WHP-versus-bare-VMX difference carrying processor, guest workload and configuration is recorded in this knowledge base. The mechanism explains the direction; it does not give you a number.

**What to do.** Three options: run through the platform API and accept the extra hop; run nested; or disable the Windows hypervisor and own VMX directly — which turns off VBS, WSL2, Sandbox and the container backends together, including the security ones. A quick confirmation that you are in this situation at all: a VMM that reports a "reduced" or "native execution" mode is telling you it has switched to the platform API, and CPUID's hypervisor-present indication plus the 0x40000000 vendor leaf will confirm a hypervisor is resident.
**Citation given:** Intel SDM Vol.3C Ch.26 (rev 092) for the single-owner rule. Windows behaviour is Tier-2: Microsoft, Windows Hypervisor Platform API reference (partition/VP object model, register access by name, exit contexts, double handling of exits); Microsoft, "Hyper-V Architecture"; Microsoft Hypervisor Top-Level Functional Specification (VP assist page, enlightened VMCS, nested exposure to child partitions); Microsoft Learn, VBS enablement and "Enable Hyper-V". Absence of a measured figure: `16-performance.md` §16.5

### vbs-overhead-figure
**Routed to:** `16-performance.md` ("Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT")
**Needed quickref §0.2:** no
**Actually answered from:** `references/16-performance.md` §16.3.1, §16.3.2, §16.3.3, §16.3.4, §16.2.8, §16.11 item 4; `references/15-security.md` §15.12; `references/errata.md` O4
**Answer:**
There is no single defensible number, and this knowledge base deliberately refuses to produce one. What it can give you is three measured figures with their conditions, and the mechanism that explains why they disagree.

**The three circulating figures, side by side, not averaged:**

| Figure | What was measured | Conditions | Source class |
|---|---|---|---|
| ~6% average frame-rate loss | memory integrity (HVCI) on vs off | third-party game benchmarks, reported second-hand | T3 media (relayed ComputerBase measurement) |
| 4.9% / 5.7% geometric mean, individual titles worse | VBS on vs off | five game titles, two of them in two APIs; Core i7-11700K and Core i7-10700K | T3 media benchmark (Tom's Hardware) |
| "up to 10%", elsewhere "as much as 15%" | the default VBS setting | game benchmarks including a high-end GPU configuration (RTX 4090) | T3 media benchmark (Tom's Hardware) |

A community figure of "5–10%" system-wide also circulates with no traceable primary source. Confidence on all of this is **low**, and the disagreement is recorded as an unresolved open conflict — none of the relayed sources states workload, hardware, driver set, or whether nested paging and large pages were in play. Do not let anyone average these into "around 10%": that produces a number nobody measured.

**Where the cost actually comes from** — four mechanisms, any of which can dominate:

1. With the hypervisor resident, the Windows kernel runs in VTL0 as a guest, so operations the hypervisor intercepts become exits that did not exist on the same machine with the hypervisor off.
2. **Second-level address translation is active for the whole machine, not only for virtual machines** — so the two-dimensional page-walk cost applies to your game and your desktop, not just to VMs. Every TLB miss on the machine is walked twice. This is the term most often missed, and the reason the cost is not confined to code that touches the security feature.
3. Memory-integrity enforcement moves kernel code-integrity decisions into VTL1, so kernel page-permission changes require a transition to a more privileged level rather than a local page-table write. The cost profile is per-page, not per-call: the expensive event is a permission change, not ordinary execution.
4. Calls into the secure kernel are VTL transitions, hypervisor-mediated, costing at least a VM-exit-class round trip. No cycle-level measurement of a VTL transition is recorded here.

**Why any quoted number is uninterpretable without two facts.** HVCI costs more than VBS alone, and MBEC availability reduces HVCI's marginal cost to roughly that of VBS alone. So a figure quoted without stating whether HVCI was enabled in addition to VBS, and whether MBEC was available, tells you nothing.

**Why two correct measurements still disagree.** Three machine properties move the result more than the setting does: TLB reach and page size determine how often the two-dimensional walk is paid at all; core type matters on hybrid processors, where a workload migrated between core types changes its own baseline; and large-page availability changes the walk depth itself. None is under your control from the security setting. On top of that, a **GPU-bound test at high resolution can hide a CPU-side regression entirely** — sufficient by itself to explain part of the spread.

**So, for your actual question — gaming.** The honest answer is that the reported losses run from roughly 5% to as much as 15–25% depending on the title, the CPU generation, whether MBEC is available and whether HVCI is on in addition to VBS, and that the magnitude on *your* machine is not established by any of these sources. If you need a number, measure it: one variable at a time (toggling memory integrity is **not** the same experiment as disabling the hypervisor, because the second also removes the machine-wide SLAT cost); a workload actually bound by the thing you are measuring; distributions and frame times rather than averages, since virtualization overhead shows up in tail latency long before it moves a mean; and the full condition set including the Windows build recorded alongside.
**Citation given:** Figures are Tier-2/Tier-3 measurement sources, not Intel architecture, and are cited as such: Tom's Hardware, "Benchmarked: Do Windows 11's Security Features Really Hobble Gaming Performance?" (the 4.9% / 5.7% geometric means on i7-11700K and i7-10700K); Tom's Hardware, "Tested: Default Windows VBS Setting Slows Games Up to 10%, Even on RTX 4090"; a secondary relay of ComputerBase memory-integrity benchmarks (the ~6% figure; the original article was not read). Mechanism anchored to Intel SDM Vol.3C §31.3.2 (rev 092) and Microsoft Hypervisor TLFS — Virtual Secure Mode. The conflict is recorded in `errata.md` O4 and `16-performance.md` §16.11 item 4, both flagged `C:low`

### modern-vmexit-cycles
**Routed to:** `16-performance.md` ("Overhead numbers …")
**Needed quickref §0.2:** no
**Actually answered from:** `references/16-performance.md` §16.2.1, §16.2.2, §16.2.3, §16.2.4, §16.2.5, §16.2.6, §16.2.7, §16.2.8, §16.12; `references/errata.md` E09
**Answer:**
**This knowledge base holds no cycle-level VM-exit measurement for any current client CPU.** No public figure for Ice Lake, Sapphire Rapids, Granite Rapids or any recent client part is recorded here; the newest hard cycle figure available is the Westmere round trip published by Intel in 2010. Stating that absence *is* the answer — extrapolating from the 2010 lineage would produce a fabricated number carrying the authority of a measured one.

**First, fix which quantity you mean**, because the two differ by a factor of several and must never be quoted interchangeably:
- the **bare hardware round trip** — VM exit plus VM entry, no handler; and
- the **end-to-end cost of handling one exit** — transition plus decode, emulation and any resulting I/O.

Conflating them is recorded as an erratum. The frequent failure mode is quoting a bare-transition figure (hundreds of cycles) as the cost of handling an exit, or an end-to-end figure (thousands) as a hardware property.

**The entire public cycle-level record this knowledge base holds, with conditions:**

| Figure | What it measures | Platform | Software | Year |
|---|---|---|---|---|
| 2409 cycles | VM entry, bare transition | 3.8 GHz Pentium 4 672 | VMware Player 1.0.1, VT-x VMM | 2006 |
| 937 cycles | VM entry, bare transition | 2.66 GHz Core 2 Duo | same | 2006 |
| 1931 / 1186 cycles | page-fault VM exit, bare transition | P4 672 / Core 2 Duo | same | 2006 |
| 11242 / 3927 / 1093 cycles | guest page-fault handling, end to end | first-generation VT-x | VT-x VMM / BT VMM / native | 2006 |
| 15826 cycles | one `in` instruction, end to end | first-generation VT-x | VT-x VMM | 2006 |
| ~1100 / ~820 / ~650 cycles | VM exit plus VM entry, **best-case** round trip | Penryn / Nehalem / Westmere | Intel measurement, no hypervisor named | 2010 |
| ~3900 cycles, of which 1016 transition | average end-to-end exit handling | Core 2 / Nehalem generation | NOVA microhypervisor | 2010 |
| +472% / +240% | VMEXIT latency *ratio* vs a non-confidential VM | server parts with confidential-VM support | Intel / AMD confidential VMs | 2025 |

There is no row for any client part and no row for anything released after 2010.

Two readings worth carrying: "best-case" in the Intel row means the floor of the hardware transition on an otherwise idle machine, not an expected value under load (the Westmere reduction is attributed to VMCS caching — VMREAD latency fell from 174 cycles on Prescott to 7 on Nehalem, which is why VMCS-field access stopped dominating exit handlers). And in NOVA's decomposition, only **26%** of the ~3900 cycles is the architectural transition, with ~15% microhypervisor-to-VMM communication and ~59% instruction and device emulation — which is why "reduce the number of exits" beats "make exits cheaper" as an optimisation strategy.

The most recent public measurement of modern Intel silicon recorded here expresses exit cost **only as a ratio**: a 2025 study reports VMEXIT latency in a confidential VM about 472% longer than in a regular VM on the same host (about 240% for the AMD equivalent), with no absolute cycle count for either baseline.

**Distrust the blog tables.** Ranges of the form "CPUID/MSR 200–1000 cycles, page-table updates 500–2000, interrupt handling 500–5000, I/O 1000–10000" circulate in engineering blogs with no published measurement method, hardware or hypervisor. The orders of magnitude are consistent with the measured work above, but the table itself is not usable as evidence.

**What can be said qualitatively about a modern exit:** certainly cheaper than Penryn's in cycles, and certainly more variable — frequency scaling, hybrid core types, SMT, cache state and mitigations all move it. That variability is part of why a single number for a current client CPU would be misleading even if one existed.

**If you need a number, measure your own machine.** A usable result needs one variable at a time, a workload actually bound by exits, distributions rather than means, the full condition set including the build, and a stated measurement definition.
**Citation given:** The absence is stated in `16-performance.md` §16.2.5 and §16.12 step 3. Measurement sources are Tier-2, cited as their own: Intel Technology Journal Vol.14 Iss.3 (2010), "Intel Virtualization Technology: Hardware Support for Efficient Processor Virtualization" (the ~1100 / ~820 / ~650 cycle round trips and the VMREAD latency); Adams & Agesen, "A Comparison of Software and Hardware Techniques for x86 Virtualization", ASPLOS 2006 (the 2006 figures); Steinberg & Kauer, "NOVA: A Microhypervisor-Based Secure Virtualization Architecture", EuroSys 2010 (the ~3900-cycle decomposition); TU München, "An Empirical Analysis of AMD SEV-SNP and Intel TDX", SIGMETRICS 2025 (the +472% / +240% ratios). Architectural framing: Intel SDM Vol.3C Ch.30 (rev 092) for what a VM exit saves and loads. The conflation caveat is `errata.md` E09

### whp-vs-bare-vmx-figure
**Routed to:** `16-performance.md` ("Overhead numbers — … WHP vs bare VMX …")
**Needed quickref §0.2:** no
**Actually answered from:** `references/16-performance.md` §16.5, §16.6, §16.2.1, §16.2.8; `references/17-windows-platform.md` §17.3.4, §17.3.6, §17.9
**Answer:**
**No public measurement of that difference carrying processor, guest workload and configuration is recorded in this knowledge base.** The direction follows from the mechanism; the magnitude does not. This is the cleanest case in the performance chapter where the honest answer is a mechanism plus an explicit "no measured figure here" — and it notes that the temptation to supply a percentage is strongest exactly where users most want one.

**Why it is slower, precisely:**

1. **Every exit is processed twice.** The hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to your user-mode VMM. That is one more boundary crossing per exit than a VMM owning VMX root operation pays, which handles the exit in its own handler directly.
2. **You cannot program your own VM-execution controls.** Register access is by name through get and set calls on a virtual processor, so the VMCS is never visible to you. Optimisations that depend on specific controls — intercepting less, or using a hardware feature the API does not expose — are unavailable regardless of what the processor supports. In the feature map, VPID, APICv and posted interrupts, and dirty tracking are **not exposed at all**.
3. **Exit contexts are an abstraction over the hardware exit reason**, classified in API terms (memory access, I/O port access, MSR access, CPUID, exception, halt, cancellation), so you also lose the ability to dispatch on the hardware encoding.

**How to reason about whether it matters for your workload.** The total is a count of boundary crossings multiplied by the cost of one, so the variable that decides your answer is **exit density**, not the per-exit delta. A guest that rarely exits pays almost nothing for the extra hop; an exit-heavy guest pays it on every crossing. Related evidence the chapter does hold, for shape rather than magnitude: a virtio-blk latency breakdown attributes 13.08% to in-guest processing, 3.85% to guest/host switching, 1.85% to host/userspace switching, 14.96% to device-model emulation and 66.27% to host I/O. The ordering is the useful part — the VMX transitions are the *smallest* term and the device model costs several times more, which is why exit-path overhead matters less for I/O-bound guests than people expect. That source is undated with no hardware description, so it is marked low confidence and is an analogue, not your number.

**If you need a figure, it is a measurement task**, and a usable result needs: one variable at a time; a workload actually bound by exits (not a GPU-bound or I/O-bound one, which will hide the effect); distributions rather than means; the full condition set including the Windows build; and a stated measurement definition.

**If the extra hop is unacceptable**, the alternatives are to run nested — real virtualization extensions inside a child partition, at the nested cost multiplication — or to disable the Windows hypervisor and own VMX directly, which turns off VBS, WSL2, Sandbox and the container backends together.
**Citation given:** The absence is stated in `16-performance.md` §16.5 and `17-windows-platform.md` §17.3.4. Mechanism is Tier-2 Windows behaviour cited to Microsoft, Windows Hypervisor Platform API reference (double exit handling, register access by name, exit contexts, no access to execution controls). The virtio-blk breakdown is from the KVM project wiki, undated and without hardware description, recorded at low confidence in `16-performance.md` §16.6. Architectural framing: Intel SDM Vol.3C Ch.30 (rev 092) for the fixed hardware cost of the exit/entry round trip

### wsl2-overhead-figure
**Routed to:** `16-performance.md` ("Overhead numbers — VBS, utility VMs, …")
**Needed quickref §0.2:** no
**Actually answered from:** `references/16-performance.md` §16.4, §16.3.1, §16.6; `references/17-windows-platform.md` §17.4.1, §17.4.5, §17.4.6, §17.2.6
**Answer:**
**No measurement of WSL2, Windows Sandbox or a Windows container backend carrying processor, workload and configuration is recorded in this knowledge base.** What can be stated is the mechanism and the shape of the cost, not a percentage.

The part of your question the skill answers squarely is the "when I am not using it" part, and it splits into two very different costs.

**1. The utility VM's own resident cost, while it is running.** A utility VM is a Hyper-V partition. Its resident cost is **memory plus scheduling**: its pages are backed by host memory while it runs, and its virtual processors are scheduled against the host's by whichever scheduler the platform is configured to use. That cost is present whenever it is running, not only when you are interacting with it. It is not primarily CPU.

**2. The much larger, indirect cost — and the one most people miss.** Enabling WSL2 makes the machine a **hypervisor host**, permanently, whether or not the Linux VM is doing anything. The Windows kernel then runs in VTL0 as a guest; operations the hypervisor intercepts become exits that did not exist before; and **second-level address translation is active for the entire machine**, so every TLB miss on the box is walked twice — in your games, your compiler and your browser, not only in the Linux VM. That is the same mechanism the VBS cost is attributed to. It also means any third-party VMM on the machine is now going through the Windows Hypervisor Platform rather than owning VMX.

The practical consequence for your question: the honest comparison is **"WSL2 enabled" versus "the hypervisor off"**, not "WSL2 running" versus "WSL2 idle". And because Sandbox, Docker Desktop, Application Guard and VBS are all Hyper-V-backed too, if any of those is already on then WSL2's marginal cost is only item 1 — the machine was already a hypervisor host.

**Where the variable cost lives when you do use it:** at the boundary, not inside the guest. Guest compute runs in VMX non-root operation at native speed; every crossing — a file operation against the host filesystem, a network packet, a device interaction — traverses the synthetic transport (VMBus ring buffers) rather than an emulated device. So the useful question about a utility VM is **how often your workload crosses the boundary**, not how fast the guest runs. This is why filesystem and network behaviour differ measurably between the two WSL designs.

**The one quantified analogue recorded here**, for shape only: a virtio-blk latency breakdown attributing 13.08% to in-guest processing, 3.85% to guest/host switching, 1.85% to host/userspace switching, 14.96% to device-model emulation and 66.27% to host I/O. The ordering is the point — the transitions are the smallest term and the device model costs several times more, and a host-to-guest filesystem crossing has the same shape. The source is undated with no hardware description, so it carries low confidence and is not a WSL2 figure.

If you need a number for your machine, measure it, one variable at a time, and note that toggling WSL2 is not the same experiment as disabling the hypervisor.
**Citation given:** The absence is stated in `16-performance.md` §16.4. Windows behaviour is Tier-2: Microsoft Learn, "Comparing WSL versions" (WSL2 runs a real Linux kernel in a lightweight utility VM, and communicates over the same synthetic transport as other Hyper-V guests); Microsoft Learn, Windows Sandbox overview; Microsoft Learn, VBS enablement / "Enable Hyper-V" for the hypervisor-host consequence; Microsoft Hypervisor Top-Level Functional Specification for VMBus and VTLs. Machine-wide SLAT cost: `16-performance.md` §16.3.1, anchored to Intel SDM Vol.3C Ch.31 (rev 092). The virtio-blk breakdown is from the KVM project wiki, undated, recorded at low confidence in `16-performance.md` §16.6

### vtl-transition-cost
**Routed to:** `16-performance.md` ("Overhead numbers — VBS, …")
**Needed quickref §0.2:** no
**Actually answered from:** `references/16-performance.md` §16.3.1, §16.2.3, §16.2.4, §16.2.5, §16.2.8; `references/17-windows-platform.md` §17.6.1, §17.2.7; `references/15-security.md` §15.7
**Answer:**
**This knowledge base records no measurement of a VTL transition in cycles.** The gap is stated explicitly rather than filled with an estimate, and I am not going to supply one.

**What can be said about the cost.** Calls into the secure kernel are VTL transitions, they are **hypervisor-mediated**, and they therefore cost at least a round trip of the VM-exit kind. That gives you a floor by analogy, not a measurement — and the only round-trip cycle figures this knowledge base holds are 2010 and older:

- **~1100 / ~820 / ~650 cycles** — best-case VM exit plus VM entry on Penryn / Nehalem / Westmere, Intel's own measurement with no hypervisor named, 2010. "Best-case" means the floor on an otherwise idle machine, not an expected value under load.
- **~3900 cycles** average end-to-end exit handling, **of which 1016 cycles (26%) was the guest/host transition itself** — NOVA microhypervisor, Core 2 / Nehalem generation, 2010.

And there is no public cycle-level VM-exit measurement for any recent client part recorded here either, so there is nothing modern to anchor the analogy to. Chaining an unmeasured VTL transition onto an extrapolated modern exit cost would compound two fabrications.

**The structural point that usually matters more than the per-transition number.** Under VBS the expensive event is not ordinary execution but a **change of kernel page permissions**. Memory integrity moves the code-integrity decision into VTL1, so a kernel page-permission change requires a transition to a more privileged level instead of a local page-table write — which is why the feature has a **per-page cost profile rather than a per-call one**. VTL0 code that never changes kernel page permissions and never calls a trustlet takes few VTL transitions; it still pays the other three VBS costs (hypervisor interception of VTL0 operations, machine-wide second-level address translation, and HVCI enforcement), and on most workloads the SLAT term dominates anyway, because every TLB miss on the machine is walked twice.

**What a transition actually crosses**, for context: normal Windows including kernel mode runs in VTL0; the secure kernel and Isolated User Mode run in VTL1; VTLs are hierarchical, so VTL1 is strictly more privileged; and the boundary is enforced by memory access permissions the hypervisor assigns with second-level address translation, which software inside the partition — including the VTL0 kernel — cannot change. Microsoft implements up to 16 trust levels architecturally but ships two, VTL0 and VTL1. Isolated User Mode trustlets at VTL1 complete system calls by marshalling them to the VTL0 kernel, so a trustlet-heavy workload crosses repeatedly in both directions.

**If you need a number, it is a measurement task on your own machine**, with the chapter's condition set recorded alongside: one variable at a time, a workload actually bound by the transitions, distributions rather than means, and the exact Windows build.
**Citation given:** The absence is stated in `16-performance.md` §16.3.1 ("this knowledge base records no measurement of a VTL transition in cycles") and §16.2.5. Round-trip figures are Tier-2, cited as their own: Intel Technology Journal Vol.14 Iss.3 (2010) for the Penryn/Nehalem/Westmere best-case round trips; Steinberg & Kauer, NOVA, EuroSys 2010, for the ~3900-cycle average with a 1016-cycle transition. VTL mechanism: Intel SDM Vol.3C §31.3 and §31.3.2 (rev 092) for the SLAT-enforced isolation, and Microsoft, Hypervisor Top-Level Functional Specification — Virtual Secure Mode, for VTL0/VTL1, the secure kernel and Isolated User Mode
