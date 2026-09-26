# intel-vt eval — diagnosis subset (20 questions)

Routing for every question was decided from the `## Routing` table in `intel-vt/SKILL.md`
(plus the "The Windows fact that resolves most questions" block) **before** any reference file
was opened. `references/00-quickref.md` §0.2 was never opened, so every "Needed quickref §0.2"
answer below is `no`.

---

### vmlaunch-error-7
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "what VM-instruction error N means"), then `04-vm-entry.md` §4.9 (routing row "why VM entry failed — and how to *fix* a control error")
**Needed quickref §0.2:** no
**Actually answered from:** `08-vmx-instructions.md` §8.4, §8.6.3, §8.8; `04-vm-entry.md` §4.3, §4.3.1, §4.10, §4.11
**Answer:**
**Cause.** VM-instruction error 7 is "VM entry with invalid control field(s)". It does not mean the instruction was wrong; it means the contents of the VMCS control fields are wrong. The specific signature you describe — worked on the old box, fails on the new one — is a named failure signature in the skill: a control bit was hard-coded rather than derived from the capability MSRs.

**Mechanism.** Each control field (pin-based, primary processor-based, VM-exit, VM-entry) is checked at VM entry against a capability MSR whose low 32 bits are the *allowed-0* settings and whose high 32 bits are the *allowed-1* settings. The SDM states these as permissions: a control whose allowed-0 bit is 1 **must be 1** (a "default-1" control), and a control whose allowed-1 bit is 0 **must be 0**. Both halves are microarchitecture-specific. A VMM that computes its control words from a compile-time constant, or that inverts the first half — reading "allowed-0 bit is 0" as "the control must be 0" instead of "the control may be 0" — produces a word that is legal on the machine it was tuned on and illegal on the next part. Error 7 does not tell you *which* control was wrong.

**What to do.**
1. Stop hand-picking bits. For every control field, take your desired value `v` and compute `v_final = (v | allowed0) & allowed1`, where `allowed0` is bits 31:0 and `allowed1` bits 63:32 of that field's capability MSR. This forces every default-1 bit on and every unsupported bit off in one step. Any bit you wanted that does not survive means "the feature is unavailable on this part" — handle it, do not force it.
2. Read `IA32_VMX_BASIC` (480H) bit 55. If it is 1, use the `TRUE_*` MSRs — `IA32_VMX_TRUE_PINBASED_CTLS` (48DH), `TRUE_PROCBASED_CTLS` (48EH), `TRUE_EXIT_CTLS` (48FH), `TRUE_ENTRY_CTLS` (490H) — instead of 481H–484H. Do **not** read the TRUE_* MSRs when bit 55 is 0; those addresses are not architecturally defined there.
3. Only read `IA32_VMX_PROCBASED_CTLS2` (48BH) if bit 31 ("activate secondary controls") is reported settable in the primary controls; only read `IA32_VMX_PROCBASED_CTLS3` (492H) if primary bit 17 ("activate tertiary controls") is settable. CTLS3 and `IA32_VMX_EXIT_CTLS2` (493H) are single 64-bit **allowed-1 masks**, not two-halves MSRs — applying the OR-then-AND algorithm to them is itself a bug.
4. If the error appeared right after you enabled a new feature rather than after a hardware change, it is a dependency check, not a capability-MSR bug. The ones the skill names: unrestricted guest requires enable EPT; virtual-interrupt delivery requires external-interrupt exiting; process posted interrupts requires virtual-interrupt delivery **and** acknowledge-interrupt-on-exit, an NV with bits 15:8 zero, and a 64-byte-aligned descriptor address; enable VPID requires a non-zero VPID; enable PML, mode-based execute control, sub-page write permissions, HLAT and several others all require enable EPT; use TSC scaling requires a non-zero TSC multiplier; virtualize x2APIC mode and virtualize APIC accesses must not both be 1.
5. Error 7 also covers the VM-entry interruption-information checks, so if you are injecting an event, that field is in scope too.

**Citation given:** Intel SDM Vol.3C §33.4 (error number table) and §29.2.1.1 (checks on VM-execution controls); Intel SDM Vol.3D App.A.2 and App.A.3.1 (allowed-0/allowed-1 semantics and the TRUE_* MSRs)
**Disagreement:** none

---

### vmresume-error-5-after-migration
**Routed to:** `08-vmx-instructions.md` §8.4 ("what VM-instruction error N means")
**Needed quickref §0.2:** no
**Actually answered from:** `08-vmx-instructions.md` §8.4, §8.8; `04-vm-entry.md` §4.2, §4.11
**Answer:**
**Cause.** Error 5 is "VMRESUME with non-launched VMCS". You are right that the VMCS is the correct one — that is not what the error is about. The error is about its **launch state**, which is per-VMCS bookkeeping, not per-pointer. Migrating the vCPU reset it.

**Mechanism.** A VMCS has a launch state. It becomes "clear" only from VMCLEAR and becomes "launched" only from a successful VMLAUNCH. VMLAUNCH fails with error 4 if the state is not "clear"; VMRESUME fails with error 5 if the state is not "launched". Separately, a VMCS that is active on one logical processor must not be made current on another — the required sequence is VMCLEAR on the old processor, then VMPTRLD on the new one, because VMCLEAR is what forces the processor's cached VMCS data out to the VMCS region in memory. That mandatory VMCLEAR is exactly what put the launch state back to "clear". So the first entry on the new logical processor must be a VMLAUNCH, and your code issued VMRESUME.

**What to do.** Track the launch state in software — there is no instruction that reads it back. Make your migration path set a per-vCPU "needs launch" flag whenever you VMCLEAR, and have the entry path choose VMLAUNCH when the flag is set and VMRESUME otherwise. Concretely, on migration: VMCLEAR on the source LP → VMPTRLD on the destination LP → VMLAUNCH. If you ever see the mirror-image error 4 on a first entry, that is the same bug in the other direction: VMLAUNCH issued on a VMCS already in the "launched" state.

**Citation given:** Intel SDM Vol.3C §33.4 (VM-instruction error 5) and §27.11 (VMCLEAR required before a VMCS is used on a different logical processor)
**Disagreement:** none

---

### vmlaunch-cf-no-error
**Routed to:** `04-vm-entry.md` §4.9 ("why VM entry failed"), cross-checked against `08-vmx-instructions.md` §8.2
**Needed quickref §0.2:** no
**Actually answered from:** `04-vm-entry.md` §4.2, §4.9, §4.11; `08-vmx-instructions.md` §8.1, §8.2; `01-vmx-intro.md` §1.8, §1.8.1
**Answer:**
**Cause.** You start by realising that this is not a failed VM entry at all — you never got into the entry checks. CF set with ZF clear is **VMfailInvalid**, and the error field is empty because there was no current VMCS in which to record a number. The overwhelmingly likely cause is that VMPTRLD was never executed on this logical processor, or a VMCLEAR made the pointer not-current.

**Mechanism.** VMX instructions report through one of three flag conventions. VMsucceed clears CF, PF, AF, ZF, SF and OF. **VMfailInvalid** sets RFLAGS.CF (ZF = 0) and records nothing — it is used when the instruction could not find a valid current VMCS to work with. **VMfailValid** sets RFLAGS.ZF (CF = 0) and writes a numeric code into the VM-instruction error field of the current VMCS. Internalise the split: CF means "could not find a valid VMCS", ZF means "found the VMCS and rejected its contents", and only the second case has an error code to read. If the current-VMCS pointer is FFFFFFFF_FFFFFFFFH, VMLAUNCH and VMRESUME fail with VMfailInvalid by definition.

**What to do.**
1. Confirm the flag reading first: CF = 1 and ZF = 0 is VMfailInvalid; do not VMREAD the error field at all, since the value there is stale from whatever happened last.
2. Check that VMPTRLD ran on *this* logical processor for *this* VMCS, and that it succeeded — VMPTRLD has its own failures (errors 9, 10, 11: bad physical address, VMXON pointer passed as a VMCS pointer, wrong VMCS revision identifier). A VMPTRLD that quietly failed leaves no current VMCS.
3. Check the VMCS region itself: 4-KByte aligned, within the physical-address width, the first dword stamped with the revision identifier from `IA32_VMX_BASIC` bits 30:0, and not the same page as your VMXON region.
4. Check your VMCLEAR ordering — a VMCLEAR of the current VMCS makes it not-current.
5. Note that a shadow VMCS is also not a valid source of guest state for a VM entry.
6. General rule this bug is an instance of: VMX instructions do not raise exceptions for logical errors, so branch on CF then ZF after **every** VMX instruction. A VMM that ignores RFLAGS after VMREAD/VMWRITE silently operates on stale or unwritten fields.

**Citation given:** Intel SDM Vol.3C Ch.33 (VMfailInvalid and the flag protocol; VMLAUNCH/VMRESUME with no current VMCS) and §27.9.5 (VM-instruction error field)
**Disagreement:** none

---

### vmlaunch-error-8-64bit
**Routed to:** `08-vmx-instructions.md` §8.4 for the number, `04-vm-entry.md` §4.4 for the checks
**Needed quickref §0.2:** no
**Actually answered from:** `04-vm-entry.md` §4.4, §4.11; `08-vmx-instructions.md` §8.4
**Answer:**
**Cause.** Error 8 is "VM entry with invalid host-state field(s)" — the host-state area of your VMCS, not the guest. On a brand-new 64-bit VMM failing its very first VMLAUNCH, the skill names two prime suspects: the **"host address-space size" VM-exit control is 0**, or a **host segment selector has a non-zero RPL or TI**.

**Mechanism.** Host-state checks run after the control checks and before anything touches the guest, which is why a host-state failure leaves the guest untouched and reports a distinct number from error 7. The rule that catches every new 64-bit VMM is the IA-32e consistency rule: if the logical processor is in IA-32e mode when VM entry executes (IA32_EFER.LMA = 1), the "host address-space size" VM-exit control **must** be 1; if it is outside IA-32e mode, both that control and the "IA-32e mode guest" VM-entry control must be 0. Zero-initialised VM-exit controls leave host address-space size at 0, and a 64-bit VMM is by definition in IA-32e mode.

**Checklist to walk, in this order.**
1. **Host address-space size = 1.** With it 1, host CR4.PAE must be 1 and host RIP must be canonical. With it 0, "IA-32e mode guest" must be 0, host CR4.PCIDE and CR4.FRED must be 0, and bits 63:32 of host RIP must be 0.
2. **Host selectors.** CS, SS, DS, ES, FS, GS and TR must have RPL = 0 and TI = 0 (selector bits 2:0 = 000b). Host CS must not be 0000H, host TR must not be 0000H, and host SS must not be 0000H unless host address-space size is 1.
3. **Canonical bases.** Host FS base, GS base, GDTR base, IDTR base and TR base must each be canonical, as must IA32_SYSENTER_ESP and IA32_SYSENTER_EIP.
4. **Host CR0/CR4** must satisfy IA32_VMX_CR0_FIXED0/FIXED1 and IA32_VMX_CR4_FIXED0/FIXED1 — there is no unrestricted-guest relaxation on the host side. CR0.NW and CR0.CD are never checked. If host CR4.CET (bit 23) is 1, host CR0.WP (bit 16) must be 1.
5. **Host CR3** must set no bit beyond the physical-address width, and bit 63 must be 0 even though MOV to CR3 gives that bit a meaning when CR4.PCIDE = 1.
6. **Conditionally loaded MSR fields.** If "load IA32_PAT" is 1, all eight bytes must be a supported type (0, 1, 4, 5, 6, 7 — values 2 and 3 fail). If "load IA32_PERF_GLOBAL_CTRL" is 1, no reserved bit. If "load IA32_EFER" is 1, no reserved bit and **both** LMA and LME must equal the host address-space size control (no CR0.PG qualifier on the host side).

**One more trap worth pre-empting.** Setting host address-space size but forgetting "load IA32_EFER" gives you a *working* first entry and a corrupted host EFER after the first VM exit — a much nastier failure than error 8.

**Citation given:** Intel SDM Vol.3C §29.2.2, §29.2.3 and §29.2.4 (host-state checks); §33.4 (VM-instruction error 8)
**Disagreement:** none

---

### entry-failure-33-qualification-0
**Routed to:** `05-vm-exit.md` §5.4 for the encoding, `04-vm-entry.md` §4.9 for the failure mode
**Needed quickref §0.2:** no
**Actually answered from:** `04-vm-entry.md` §4.9, §4.10, §4.11, §4.5 (subsection index); `05-vm-exit.md` §5.12
**Answer:**
**Cause.** It did not succeed. 8000_0021H has bit 31 set — that is the VM-entry-failure indicator — so the basic reason is 33 (0x21), "VM-entry failure due to invalid **guest state**". Your guest-state area failed a check. Qualification 0 for reason 33 means "an ordinary guest-state check", with no further narrowing.

**Mechanism.** VM entry has three distinguishable failure modes, and this is the second:

| Mode | Detected in | Control goes to | Observed as |
|---|---|---|---|
| VMfail | basic checks, VMX controls, host state | instruction after VMLAUNCH/VMRESUME | RFLAGS.CF or ZF; error number in the VM-instruction error field |
| Exit reason 33 | guest-state checks | host RIP, via a host-state load | exit reason 8000_0021H; qualification narrows the cause |
| Exit reason 34 | VM-entry MSR-load area | host RIP, via a host-state load | exit reason 8000_0022H; qualification = 1-based failing index |

Because guest state has already been loaded when the failure is detected, the processor unloads it by loading host state exactly as it would for a VM exit — which is why you land at your host RIP and why it *looks* like a successful entry followed by an immediate exit. For reason 33 the qualification is 0 in most cases; the only non-zero values are **2** (PDPTE loading), **3** (NMI injection blocked by STI) and **4** (invalid VMCS-link pointer). 1 is not used. So qualification 0 is the "no extra information" case, not a distinct cause.

**What to do.**
1. Always test bit 31 of the exit-reason field before dispatching. A value with bit 31 set is a failed VM entry, not a guest exit, and must not go through your normal exit dispatch.
2. With qualification 0, walk the guest-state checks in order. The skill points at two clusters as accounting for most of these: **segment registers and access rights**, and the **IA-32e mode consistency set** — CR0.PG, CR4.PAE, IA32_EFER.LME, IA32_EFER.LMA, the "IA-32e mode guest" VM-entry control and CS.L must all agree.
3. Do not treat one reported cause as exhaustive. Guest-state checks may run in any order, so a reported qualification does not rule out other faults, and two different processors may report different qualifications for the same VMCS.
4. Know what the failure did and did not touch, or you will misread your own logs: only the exit-reason and exit-qualification fields are updated. **All other VM-exit information fields are left unmodified — not undefined** — so they still hold whatever the previous exit or you put there. The guest-state area is not modified, no MSRs are saved to the VM-exit MSR-store area, and the valid bit in the injected-event identification field is **not** cleared. NMI blocking is whatever it was before the entry, and MSRs are still loaded from the VM-exit MSR-load area.
5. Reload your own context in the exit path: after this failure your VMM is running with the host-state area's context, not the context that executed VMLAUNCH, so anything you were keeping in registers across the entry is gone.

**Citation given:** Intel SDM Vol.3C §29.8 (VM-entry failures and the exit-qualification values for reason 33) and §27.9.1 (exit-reason field, bit 31); Intel SDM Vol.3D App.C (basic exit reasons)
**Disagreement:** none

---

### entry-failure-34-msr-load
**Routed to:** `05-vm-exit.md` §5.4 for the encoding, `04-vm-entry.md` §4.9/§4.7 for the failing structure
**Needed quickref §0.2:** no
**Actually answered from:** `04-vm-entry.md` §4.7, §4.7.1, §4.9, §4.10, §4.11
**Answer:**
**The failing thing.** 8000_0022H is basic exit reason **34** with the VM-entry-failure bit set: "VM-entry failure due to MSR loading". An entry in your **VM-entry MSR-load area** was rejected. The exit qualification is the **1-based index** of the entry that failed, so qualification 3 means the **third** entry.

**Where it is.** The area is an array of 16-byte entries, so the offending entry is at

```
msr_load_area + 16 * (qualification - 1)   =   msr_load_area + 32
```

Entry layout: bits 31:0 the MSR index, bits 63:32 reserved and **must be 0**, bits 127:64 the value to be written. Entries are processed in order, as if by a sequence of WRMSRs.

**Why an entry gets rejected.** Any one of these:
- bits 63:32 of the entry are not 0;
- the index is C0000100H (IA32_FS_BASE) or C0000101H (IA32_GS_BASE);
- the index is in the x2APIC range — bits 31:8 = 000008H, i.e. 00000800H–000008FFH;
- the index names an MSR writable only in SMM while the VM entry did not commence in SMM;
- the processor refuses the MSR for model-specific reasons;
- WRMSR with that index and value at CPL 0 would raise #GP.

Note that revision 092 does **not** list 00000079H (IA32_BIOS_UPDT_TRIG) among the excluded indices — older material that says it does is out of date.

**Two specific traps.** IA32_EFER should not be in the area at all: attempts to modify LMA through it are ignored (as WRMSR attempts are), and because VM entry has already established CR0.PG = 1, a WRMSR changing LME would fault. And if IA32_SPEC_CTRL is in the area while the "virtualize IA32_SPEC_CTRL" VM-execution control is 1, the value loaded is undefined — do not do it. MSRs with dedicated VMCS fields and load controls — IA32_EFER, IA32_PAT, IA32_PERF_GLOBAL_CTRL, IA32_BNDCFGS, IA32_DEBUGCTL — are validated by the control and host/guest-state checks before any state is loaded; an MSR-area entry is only discovered to be bad at this late stage. Prefer the dedicated fields.

**What else to check while you are there.** Keep the list within the recommended maximum, 512 × (1 + IA32_VMX_MISC[27:25]) entries — exceeding it produces undefined behaviour, possibly a machine check during the transition. The list base must be 16-byte aligned, and if the count is non-zero the last byte (address + 16 × count − 1) must lie within the physical-address width (that one is a control check and would give you error 7, not reason 34).

**Same shape as reason 33.** Because MSR loading happens after guest state has been loaded, this leaves the processor in the same "failed VM entry" shape as reason 33: host state is loaded and control resumes at your host RIP. Note the asymmetry with the exit side — an entry-side MSR failure gives you exit reason 34, whereas a **VM-exit** MSR-store or MSR-load failure takes a VMX abort instead. The SDM states the outcomes and never explains why.

**Citation given:** Intel SDM Vol.3C §29.4 (loading MSRs on VM entry and the rejection conditions), §27.8 (MSR-area entry format), §29.8 (failure shape); Intel SDM Vol.3D App.C (basic exit reason 34) and App.A (MSR-list maximum)
**Disagreement:** none

---

### vmxon-general-protection
**Routed to:** `01-vmx-intro.md` (routing row "Enabling VMX, VMXON failures, CPUID/IA32_FEATURE_CONTROL"); held `17-windows-platform.md` §17.1 in reserve because of SKILL.md's "The Windows fact that resolves most questions"
**Needed quickref §0.2:** no
**Actually answered from:** `01-vmx-intro.md` §1.4, §1.5, §1.8, §1.8.1; `08-vmx-instructions.md` §8.6.6; `17-windows-platform.md` §17.1
**Answer:**
**Cause.** "Firmware shows VT-x as enabled" and "VMXON is permitted" are two different facts, and the second is decided by a lock-once MSR whose exact bit pattern varies by firmware. The skill lists exactly four preconditions whose violation produces #GP(0) from VMXON — one of them is almost certainly what differs across your fleet.

**Mechanism.** VMXON causes **#GP(0)** if:
1. CPL is greater than 0;
2. the current CR0 or CR4 hold values unsupported in VMX operation per the fixed-bit MSRs (IA32_VMX_CR0_FIXED0/1 at 486H/487H, IA32_VMX_CR4_FIXED0/1 at 488H/489H);
3. the **IA32_FEATURE_CONTROL** lock bit is clear, **or** the applicable VMXON-enable bit is clear;
4. the logical processor is in A20M mode.

(By contrast, CR4.VMXE = 0, real-address or virtual-8086 mode, compatibility mode, or a register operand give **#UD**, not #GP; and a bad VMXON-region address or a missing revision identifier gives VMfailInvalid with CF set. Use the exception type to bisect.)

The third condition is the one that varies machine to machine. IA32_FEATURE_CONTROL is MSR 3AH, cleared to zero at reset. Bit 0 is the lock. Bit 1 enables VMXON **in** SMX operation; bit 2 enables VMXON **outside** SMX operation. VMXON checks the bit matching the current SMX state and #GPs if that bit is clear. Once bit 0 is set, any WRMSR to the MSR #GPs until the next power-up reset — that is precisely how firmware makes a setting stick. So a firmware that sets bit 0 and bit 1 but not bit 2 shows "VT-x enabled" in setup and still #GPs on an ordinary VMXON outside SMX. A firmware that sets the lock while VT-x was toggled off in a previous boot, without a full power cycle, produces the same divergence.

**What to do.**
1. Before VMXON, read CPUID.01H:ECX bit 5 (the only CPUID indication of VMX; there is no leaf enumerating EPT, VPID, APICv or anything else). Do not read any IA32_VMX_* MSR until you have — they do not architecturally exist otherwise and RDMSR will #GP(0).
2. Read IA32_FEATURE_CONTROL (3AH) and branch on it explicitly. If **bit 0 is clear**, you may set bits 0 and 2 yourself and proceed — this is what Linux's `kvm_intel` does at load time. If **bit 0 is set and bit 2 is clear**, report "VMX disabled by firmware" and stop: there is no software path to change the MSR before the next power cycle. Retrying is pointless. Tell the user to power-cycle (not warm-reboot) after changing the firmware setting.
3. Read the four fixed-CR MSRs and adjust CR0 and CR4 to satisfy them, then set CR4.VMXE (bit 13), before VMXON. A bit is fixed-to-1 (1 in FIXED0), fixed-to-0 (0 in FIXED1), or flexible.
4. Confirm you are at CPL 0 and not in A20M.
5. **Windows-specific escape hatch.** If these are Windows machines, check separately whether the Windows hypervisor is already running on the failing ones — VMX root operation has exactly one owner per logical processor, the architecture provides no way to share it, and VBS/memory integrity, WSL2, Sandbox, Docker Desktop or the Hyper-V role each put Hyper-V in that seat while the Windows kernel runs as a VTL0 guest. Detect it with CPUID.01H:ECX bit 31 (hypervisor present) and leaf 0x40000000 ("Microsoft Hv"). Caveat: the skill establishes that VMXON exits unconditionally from VMX non-root operation and that the owning hypervisor decides what happens next; it does **not** state which exception Hyper-V injects, so I cannot tell you that this path specifically produces #GP(0). Treat it as a second hypothesis to test, not as the diagnosis.

**Citation given:** Intel SDM Vol.3C §26.7 (IA32_FEATURE_CONTROL, CR4.VMXE), §26.8 (fixed-bit rule) and Ch.33 (VMXON exception conditions); Intel SDM Vol.3D App.A.7/A.8 (fixed CR MSRs). Windows-side: Microsoft Hyper-V / TLFS documentation as cited in `17-windows-platform.md` §17.1
**Disagreement:** none

---

### lost-event-during-delivery
**Routed to:** `05-vm-exit.md` §5.4 (routing row explicitly names IDT-vectoring)
**Needed quickref §0.2:** no
**Actually answered from:** `05-vm-exit.md` §5.6, §5.7, §5.12
**Answer:**
**Cause.** You are dropping the event. When a VM exit occurs while the processor is delivering an event through the guest IDT, that event is **lost** — the hardware does not retry it. It records what it was delivering in the **IDT-vectoring information field** (renamed the *original-event identification field* in SDM rev 092) and expects you to re-inject it. Your handler almost certainly reads that field only for exit reasons it thinks are "event-related", and a page fault taken during interrupt delivery is not on that list. The skill calls the resulting symptom by name: "the guest hangs after a nested fault".

**Mechanism.** Field layout: bits 7:0 vector, bits 10:8 event type, bit 11 error-code valid, bit 12 not currently defined (undefined on VM exit), bit 13 exception nested on FRED event delivery, bits 30:14 always 0, **bit 31 valid**. Event types are 0 external interrupt, 2 NMI, 3 hardware exception, 4 software interrupt, 5 privileged software exception, 6 software exception; 1 and 7 are not used. (The SDM's own prose at §30.2.4 says "privileged software interrupt" for type 5 — that is a wording slip in the manual; Table 27-21 is correct.) Bit 31 is set only when the exit occurred during delivery through the guest IDT, and it is your signal that an event was lost. When bit 11 is 1, the IDT-vectoring error code field holds that event's error code. Rev 092 adds a 64-bit *original-event data* field carrying what FRED delivery would have pushed; it is undefined for non-FRED exits.

**The fix.**
1. **VMREAD the IDT-vectoring information field on every VM exit, unconditionally** — not only on exits you expect to be event-related. It is valid for exits of many different basic reasons: a task switch, an EPT violation or an exception can all interrupt event delivery. An exit handler that checks it selectively will silently drop events.
2. If bit 31 is set, copy the IDT-vectoring information and error code into the **VM-entry interruption-information** and **VM-entry exception error-code** fields for the next entry, adjusting for the type of the original event. Do this before or together with whatever else the exit requires.
3. For a **software interrupt, privileged software exception or software exception** recorded there, also copy the **VM-exit instruction length** into the **VM-entry instruction length** — the length of the instruction that caused the event must be carried over, or the re-injection is wrong.

**One thing not to over-read.** A **clear** valid bit does not mean no event was in flight. The architecture explicitly does *not* consider an exit to occur "during event delivery" when: the original event causes the exit directly; it results in a double fault that causes the exit directly; the exit comes from fetching the first instruction of the handler; the exit is a triple fault; or in the virtual-8086 INT n / #GP redirection case.

**Citation given:** Intel SDM Vol.3C §27.9.3 (IDT-vectoring / original-event identification field layout) and §30.2.4 (VM exits during event delivery, the re-injection procedure, and the exclusions)
**Disagreement:** none

---

### apicv-interrupts-lost-when-descheduled
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Needed quickref §0.2:** no
**Actually answered from:** `07-apic-virtualization.md` §7.8.2, §7.8.3, §7.8.4
**Answer:**
**Cause.** Posted interrupts are lossless with respect to the *hardware* protocol, but they are only drained by one event: the arrival of an interrupt whose vector is the posted-interrupt notification vector, while the target is in VMX non-root operation. **VM entry does not perform posted-interrupt processing.** So a vector posted into PIR while your scheduler had the vCPU blocked sits there until some *later* notification happens to arrive. If the poster was suppressed (SN = 1) or elided its notification (ON already 1), no later notification may ever come. That is your missing interrupt.

**Mechanism.** The posted-interrupt descriptor is a 64-byte, 64-byte-aligned structure: bits 255:0 PIR (one bit per vector), bit 256 ON (outstanding notification), bit 257 SN (suppress notification), bits 279:272 NV (notification vector), bits 319:288 NDST (notification destination, a physical APIC ID). A poster sets PIR[vector]; if SN = 1 it stops there deliberately; if ON was already 1 it stops there too (that is what collapses a burst into one notification); otherwise it sets ON and sends vector NV to NDST.

Receiving side, on arrival of NV in non-root operation, the processor runs seven uninterruptible steps: (1) acknowledge the local APIC; (2) if the physical vector is not NV, take an ordinary external-interrupt VM exit instead; (3) clear ON atomically; (4) write 0 to the local APIC EOI register; (5) atomically `VIRR |= PIR` and clear PIR; (6) if any bit was set, `RVI = max(RVI, highest index set in PIR)` — if PIR was empty, RVI is left unmodified; (7) evaluate pending virtual interrupts. ON being cleared at step 3, *before* PIR is read at step 5, is the correctness argument: the worst case is a redundant notification, never a dropped vector. (It is cleared after the APIC acknowledge at step 1, not before it — renderings that put it first have the property right and the order wrong.)

By contrast, §29.3.2.5 says a VM entry with virtual-interrupt delivery set loads RVI and SVI from the guest-interrupt-status field, performs PPR virtualization and evaluates pending virtual interrupts — **and nothing more**. No PIR drain.

**What to do.**
1. **Drain the PID into VIRR and RVI yourself before every VM entry.** Merge PIR into the virtual-APIC page's VIRR and raise RVI to the highest index you merged, using locked read-modify-write. The descriptor is one of the two structures the SDM allows to be modified while a logical processor whose current VMCS references it is in non-root operation — but only with locked RMW or other atomic operations.
2. **Pick the right mechanism for "descheduled" versus "blocked", they are different.**
   - *Running in host context / descheduled but runnable:* set **SN**. Interrupts still accumulate in PIR for the next merge, and you suppress a storm of pointless notifications. (KVM measured this as a 6.56% improvement on `perf bench sched pipe`, cutting notifications from tens of thousands per second to hundreds, at a cost of about 1.58% on the VM-exit round trip.)
   - *Blocking the vCPU:* do **not** just set SN — repoint **NV** at a host wake-up vector and **NDST** at the host CPU, so a posting wakes the vCPU through the host interrupt path instead of being silently absorbed. And **refuse to block if ON is already set**, otherwise you block with a notification already in flight and nothing will re-arm.
3. Sanity-check the entry controls while you are there: "process posted interrupts" requires "virtual-interrupt delivery" = 1, "acknowledge interrupt on exit" = 1, NV bits 15:8 = 0, and a 64-byte-aligned in-range descriptor address; a violation gives VM-instruction error 7, not a lost interrupt, but the set-up is easy to get half right.

**Citation given:** Intel SDM Vol.3C §32.6 (posted-interrupt processing, the seven steps, and that only NV arrival triggers it), Ch.32 (descriptor layout, ON/SN/NV/NDST), §29.3.2.5 (what VM entry with virtual-interrupt delivery does), §27.11.4 (modification of VMCS-referenced structures); KVM measurement per the source cited in `07-apic-virtualization.md` §7.8.4
**Disagreement:** none

---

### msix-not-delivered-after-remapping
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, IRTE, interrupt posting on the VT-d side")
**Needed quickref §0.2:** no
**Actually answered from:** `11-vtd-interrupt-remapping.md` §11.2.2, §11.3, §11.11.2, §11.12
**Answer:**
**Cause.** "Works for small indices, fails for large ones" is a single, specific bug: **Handle[15] does not live next to the other handle bits.** In the remappable MSI/MSI-X address format, Handle[14:0] sits at address bits 19:5 but **Handle[15] is stranded at address bit 2**. Software that builds the address by taking a 16-bit handle and shifting it left by 5 silently loses the top bit for every handle ≥ 0x8000. Those requests then index IRTE `handle − 0x8000`, which is either wrong or out of range — and the interrupt never arrives.

**Mechanism.** The remappable-format address is: bits 31:20 Interrupt Identifier (must be FEEh to be decoded as an interrupt request); bits 19:5 Handle[14:0]; bit 4 Interrupt Format (must be 1b for remappable); bit 3 SHV (SubHandle Valid); **bit 2 Handle[15]**; bits 1:0 don't care. When SHV is set, data bits 15:0 are the Subhandle and data bits 31:16 are reserved (0). Hardware computes

```
if (address.SHV == 0) interrupt_index = address.handle;
else                  interrupt_index = address.handle + data.subhandle;
```

and if `interrupt_index` is equal to or larger than the number of IRTEs in the table, hardware treats the request as an error. The 16-bit handle gives 64K unique interrupt requests per remapping unit, and the table can hold at most 64K IRTEs.

**Check these, in order.**
1. **Handle[15] → address bit 2.** Fix your address builder. This is the one that matches your symptom exactly.
2. **IRTA_REG.S is a log2-minus-one.** Entries = 2^(S+1), so S = 0 means *two* entries, not one. A table sized with a naive log2 is half as large as you think, and every index in the upper half is an error.
3. **Nothing in IRTA_REG takes effect until SIRTP.** Writing the register alone changes no behaviour. The order is: program IRTA_REG (base, S, EIME) → set GCMD_REG.SIRTP (bit 24), wait for GSTS_REG.IRTPS (bit 24) → invalidate the interrupt entry cache with a global `iec_inv_dsc` → set GCMD_REG.IRE (bit 25), wait for GSTS_REG.IRES (bit 25) → optionally clear GCMD_REG.CFI (bit 23) and observe GSTS_REG.CFIS. And EIME must not be modified while IRES = 1.
4. **If the failure is total rather than index-dependent, look at EIME instead.** Compatibility-format interrupts are blocked when EIME is set or when CFIS is clear — so any source you did not convert to remappable format dies at that moment. If ECAP_REG.EIMER is reported Set and Extended Interrupt Mode is disabled, **all** interrupt requests are blocked. With EIME = 0, hardware interprets only bits 15:8 of the IRTE Destination-ID; with EIME = 1 it interprets all 32 bits — so an x2APIC destination programmed with EIME = 0 goes to the wrong place.
5. **For the I/OxAPIC path**, the same scatter applies differently: Interrupt_Index[15] goes in RTE bit 11, Interrupt Format at bit 48, Interrupt_Index[14:0] at bits 63:49. For level-triggered interrupts, the RTE's Trigger Mode and Vector must match the referenced IRTE's.
6. If you are decoding IRTEs to debug this, remember bit 15 (IM) reinterprets the whole entry — reading a posted-format IRTE with remapped-format offsets gives a plausible-looking but wrong vector and destination.

**Citation given:** Intel VT-d Rev 5.20 §5.1.2.2 (remappable interrupt-request format, Handle[15] at address bit 2), §5.1.3 (interrupt_index computation and the out-of-range error), §5.1.5.2 (programming MSI/MSI-X), §11.4.10 (IRTA_REG, S, EIME), §5.1.4.1 and §5.1.4 (compatibility-format blocking, EIMER)
**Disagreement:** none

---

### device-dma-faulting
**Routed to:** `12-vtd-faults-bios-siov.md` (routing row "VT-d faults and fault reason codes"), with `10-vtd-dma-remapping.md` in reserve for register layout
**Needed quickref §0.2:** no
**Actually answered from:** `12-vtd-faults-bios-siov.md` §12.1, §12.1.1, §12.2, §12.2.1, §12.2.2, §12.3, §12.3.1, §12.9
**Answer:**
Two separate problems, and you should treat them separately: (a) why the DMA is blocked, and (b) why you are not being told about it.

**(b) first — why your fault handler never fires.** The likeliest single cause: **FECTL_REG.IM (Interrupt Mask, bit 31) defaults to 1.** Fault interrupts are masked out of reset. A driver that programs the Fault Event Data and Fault Event Address registers but never clears IM will silently log faults it never sees. Clear IM. Other reasons the notification can go missing:
- **FPD.** A non-recoverable fault is "qualified" if software can suppress its reporting by setting a Fault Processing Disable bit in the context-entry, scalable-mode context-entry, PASID-directory entry or PASID-table entry. If remapping hardware encountered *any* translation-structure entry with FPD = 1 on that walk, it must not report the fault. Note FPD cannot hide everything: the non-qualified legacy reasons are 1h, 8h, 9h and Ah, plus all five root-table-address faults 30h–34h — i.e. exactly the ones raised at or before the root-entry, before hardware has read any entry carrying an FPD bit.
- **Event suppression.** §7.3 defines four fault-event trigger conditions (a recorded fault setting PPF; IQE; ICE; ITE), and the event is **suppressed if any of PPF, PFO, IQE, ICE or ITE is already Set**. One unacknowledged sticky bit from earlier in boot stops all subsequent fault interrupts.
- **Primary fault overflow.** If the Fault Recording Register at the internal index already has F set, hardware sets PFO and **does not record** the new fault. To recover you must process every Fault Recording Register, clear each F, then clear PFO by writing 1 to it.
- **Fault compression** (optional, implementation-dependent): if supported, hardware compares the faulting request's source-id against the SID of each Fault Recording Register with F set and does not record a match — so a repeating device produces one record, not a stream.
- **You may be walking the ring wrong.** Registers count = **CAP_REG.NFR + 1** (NFR reports N, not the count — a ring walk driven by NFR alone is short by one), and the base is **register-base + 16 × CAP_REG.FRO**, with FSTS_REG.FRI giving the index to start from. Process in circular FIFO order from FRI until you find an F that is clear. The F field is RW1C and sticky.
- **And check the obvious:** this is Primary Fault Logging only. Rev 5.20 removed "advanced fault logging"; if your driver is looking for a log buffer in memory it is implementing a pre-4.0 revision, and the GCMD_REG bits that drove it are now reserved.

**(a) why the DMA is blocked.** Before decoding any reason code, **check RMRR**. A very common cause of a device faulting immediately after you turn remapping on is a missing reserved region: if the device is covered by an RMRR structure in the ACPI DMAR table, your second-stage structures must provide an **identity mapping with read and write permission** over that region, or legitimate firmware DMA faults. RMRR is a stated isolation compromise, not a bug — and a device covered by an over-broad RMRR cannot be safely assigned to a guest at all.

Otherwise, read the reason code and **read the range before the table** — the numeric space is partitioned by mode and the range selects which table applies: legacy-mode 1h–Eh, interrupt-remapping 20h–2Bh, root-table-address programming 30h–34h, scalable-mode 38h–A5h. A decoder that skips this mislabels every scalable-mode fault as a legacy one. The legacy reasons you will hit on a fresh bring-up: 1h root-entry Present = 0; 2h context-entry Present = 0; 3h invalid context-entry programming (unsupported AW, unsupported TT, or error accessing the second-stage paging entry via SSPTPTR); 4h address overflow above MGAW/AW; 5h no write permission; 6h no read permission; 8h/9h error accessing the root-entry or context-entry; Ah/Bh/Ch non-zero reserved field; Dh the context-entry's TT blocks translation requests; Eh output address lands in FEEx_xxxxh.

**Two decoding traps.** The request **type is split across two non-adjacent bits** — T1 at bit 126 and T2 at bit 92 of the Fault Recording Register — so decoders written against very old revisions read only T1. And the full register is: F(127), T1(126), AT(125:124), PV(123:104), FR(103:96), PP(95), EXE(94), PRIV(93), T2(92), rsvd(91:80), SID(79:64), FI(63:12), rsvd(11:0).

**What the block itself looks like on the bus.** Non-recoverable faults are blocked by hardware in an implementation-specific way: faulting reads from PCIe devices get UR or CA in the completion status, and faulting writes may simply be discarded. So the device may report a timeout or nothing at all — do not expect it to tell you.

**Citation given:** Intel VT-d Rev 5.20 §7.2 and §7.2.1 (Primary Fault Logging, PPF/PFO/FRI, compression), §11.4.7.1 and §11.4.7.2 (FSTS_REG, FECTL_REG.IM default 1), §11.4.7.6 and §11.4.2 (Fault Recording Register layout, NFR/FRO), §7.3 (fault event triggers and suppression), §7.1.1 (non-recoverable faults, blocking behaviour, FPD/qualified), §7.1.3 and Ch.7 (fault reason ranges and codes), §8.4 (RMRR)
**Disagreement:** none

---

### seamcall-illegal-sequence
**Routed to:** `13-tdx.md` §13.7 (routing row names "TD lifecycle and legal call order")
**Needed quickref §0.2:** no
**Actually answered from:** `13-tdx.md` §13.7.1, §13.7.2, §13.7.3, §13.7.4, §13.19, §13.5
**Answer:**
**The class of mistake.** Almost always a **state-machine / ordering violation**, not a missing feature. "The leaf exists" and "the leaf is legal right now, for this TD, from this LP, at this concurrency" are different statements. TDX enforces two nested state machines and the module rejects any leaf issued outside the state that permits it.

**The two state machines.**
- **TD Life Cycle** (driven by key management): `TD_HKID_ASSIGNED` → `TD_KEYS_CONFIGURED` → `TD_BLOCKED` → `TD_TEARDOWN`. `TDH.MNG.CREATE` enters HKID_ASSIGNED; `TDH.MNG.KEY.CONFIG` on non-last packages keeps it there and on the **last** package advances to KEYS_CONFIGURED; `TDH.MNG.VPFLUSHDONE` — permitted only when the TD has no associated VCPUs and no bound TDIs — moves to BLOCKED; `TDH.MNG.KEY.FREEID` moves to TEARDOWN. In TEARDOWN, `TDH.PHYMEM.PAGE.RECLAIM` reclaims non-TDR pages and, on the TDR page, destroys the TD.
- **OP_STATE**, which sub-divides KEYS_CONFIGURED: `UNALLOCATED` → (`TDH.MNG.ADDCX` on the last required TDCX page) → `UNINITIALIZED` → (`TDH.MNG.INIT`) → `INITIALIZED` → (`TDH.MR.FINALIZE`) → `RUNNABLE`. The remaining states exist only for migration.

**The ordering rules people break.**
- `TDH.VP.CREATE`, `TDH.VP.ADDCX` and `TDH.VP.INIT` are **legal only in INITIALIZED** — VCPU creation and initialization happen only during TD build time, not after finalize.
- `TDH.MEM.*` and `TDH.MR.EXTEND` are self-transitions of INITIALIZED; `TDH.MEM.*` is also a self-transition of RUNNABLE.
- The only OP_STATEs in which a TD VCPU may run are RUNNABLE, LIVE_EXPORT and LIVE_IMPORT.
- Migration states are **not** all entered from RUNNABLE. Export: RUNNABLE → START_EXPORT → LIVE_EXPORT → PAUSED_EXPORT → POST_EXPORT. Import begins at **UNINITIALIZED** → START_IMPORT / MEMORY_IMPORT → STATE_IMPORT → POST_IMPORT → LIVE_IMPORT, rejoining RUNNABLE only through `TDH.IMPORT.END`.
- Build order: flush MODIFIED cache lines for the pages that will become TDR/TDCS/Secure-EPT root → `TDH.MNG.CREATE` → assign HKID and configure the key **on all packages** → `TDH.MNG.ADDCX` repeatedly → `TDH.MNG.INIT`. Secure EPT: `TDH.MEM.SEPT.ADD` once per level below the root; the root is **not** added explicitly, `TDH.MNG.INIT` creates it inside TDCS. Measurement: initialized by `TDH.MNG.INIT`, extended by every `TDH.MEM.PAGE.ADD` (properties) and by `TDH.MR.EXTEND` (contents, in 256-byte chunks), completed by `TDH.MR.FINALIZE`.
- Teardown: reclaim HKID and flush → `TDH.PHYMEM.PAGE.RECLAIM` for all private and control pages → **TDR page last** (all other pages' cache lines must already be flushed) → `TDH.PHYMEM.PAGE.WBINVD` on the TDR page.

**Three other classes worth ruling out before you blame the state machine.**
1. **Concurrency.** Concurrency is architecturally constrained, not best-effort: the spec defines explicit and implicit restrictions, transactions, and restrictions with host priority, and OP_STATE transitions are annotated with whether they take a shared or an exclusive lock. A leaf that is legal in this state can still be rejected because another LP holds the lock.
2. **Dispatch-level rejection, before the leaf runs.** SEAMCALL can fail with #UD, #GP(0), or VMfailInvalid (RFLAGS.CF = 1, RAX left unmodified) if the CPU mode is wrong, the TDX Module is not loaded, or the module is disabled. That is not a leaf error at all. Also check your RAX encoding: bits 15:0 leaf number, bits 23:16 **interface-function version number**, bit 24 INTERRUPT_MODE, **bits 62:25 reserved and must be 0**, bit 63 selects P-SEAMLDR and must be 0 for TDX Module functions. A wrong version number looks like "the leaf doesn't work".
3. **Interruption, mistaken for failure.** Long-running interface functions are architecturally interruptible; `TDX_INTERRUPTED_RESUMABLE` in RAX means re-issue the same leaf until it completes, not that it failed.

**How to read what you got back.** RAX is a completion status at three levels: 0 = success; a positive value (1 … 0x7FFF_FFFF_FFFF_FFFF) = success with an informational or warning code; a negative value = the function aborted with an error. The medium level encodes CLASS, ERROR, NON_RECOVERABLE, FATAL (host-side only — the TD can then only be torn down) and HOST_RECOVERABILITY_HINT. The class occupies bits 47:40; the full status-code and operand-ID definitions are in the **ABI specification**, not the Base specification — so decode against the ABI doc, and check the FATAL bit before you retry anything.

**Citation given:** Intel TDX Module Base Specification §7.1 (TD Life Cycle), §7.2 (OP_STATE), §7.3–§7.5 (build, VCPU, teardown sequences), §9.7, §9.8, §12.2.1, §18.5.1–§18.5.3, §18.6.1–§18.6.3, §18.9, §18.1; Intel TDX Module ABI Specification §5.4.1 (SEAMCALL RAX encoding and pre-leaf failures), §3.1 (status codes)
**Disagreement:** none

---

### vtx-unavailable-on-windows
**Routed to:** `17-windows-platform.md` §17.1 (routing row "Hyper-V, WHP/WHPX, WSL2, Sandbox, Kernel DMA Protection, 'why no VT-x'"; SKILL.md flags this as the Windows fact that resolves most questions)
**Needed quickref §0.2:** no
**Actually answered from:** `17-windows-platform.md` §17.1, §17.1.1, §17.1.2, §17.3, §17.3.5, §17.3.6, §17.4
**Answer:**
**Cause.** Nothing is wrong with your hardware. VT-x is present, enabled and **already in use** — by the Windows hypervisor. VMX root operation has exactly one owner per logical processor: the software that executed VMXON. The architecture provides no way to share it. On a stock Windows 11 laptop that owner is Hyper-V, and your VMM is asking for something that is not available to ask for.

**Mechanism.** Once Hyper-V is running, the Windows installation you are logged into is itself a partition — the root partition, running in VTL0. Microsoft does not use Intel's vocabulary, but states every element: "only one software component at a time can use this hardware"; the hypervisor "has exclusive control of key system hardware resources … early in system initialization"; "the root partition is itself a VM partition, although it has unique properties and greater privileges than guest VMs"; "when a partition starts or resets, it begins running in VTL0". Crucially, **virtualization-based security is a Hyper-V-backed feature**, so the hypervisor starts even though you never created a VM. So do WSL2, Windows Sandbox, Docker Desktop and Defender Application Guard — all of them are partitions and all of them pull in the hypervisor. "Hyper-V is not installed" is therefore not evidence that VMX is free.

**Confirm it in thirty seconds.** Execute CPUID with EAX=1 and check **ECX bit 31**, the hypervisor-present bit — "in a non-virtualized environment, the bit will be clear". Then read leaf **0x40000000** for the vendor identity signature: "Microsoft Hv" for Hyper-V. Leaf 0x40000001 returns the interface signature "Hv#1". This detection succeeds inside an ordinary desktop session on a stock machine, because the desktop is in a partition.

**Which of four layers said no.** "Is the hypervisor running" is decided at four independent layers, and your question is really "which layer": (1) **silicon** — VMX plus second-level address translation; (2) **firmware** — virtualization enabled, and VT-d separately if you want DMA protection, and firmware must describe its remapping hardware to the OS; (3) **platform feature** — the Windows virtualization platform installed and enabled, which is what puts the hypervisor on the boot path; (4) **consumer** — something that actually wants it (the Hyper-V role, VBS, or a utility VM). Layers 3 and 4 are separable, which is exactly why your machine can look "clean" in Windows Features and still have the hypervisor resident.

**What to do — three options, and they are the whole set.**

| Option | Who owns VMX root | What you get | What it costs |
|---|---|---|---|
| **Windows Hypervisor Platform (WHP/WHPX)** | Hyper-V | a partition you drive from user mode | one extra boundary crossing per exit; **no direct control of VM-execution controls**, so any optimisation that depends on intercepting less or using a control the API does not expose is unavailable regardless of what the silicon supports |
| **Run nested** | Hyper-V | real virtualization extensions inside a child partition | the nested cost multiplication; and Microsoft states that virtualization applications other than Hyper-V "aren't supported in Hyper-V virtual machines, and are likely to fail" |
| **Turn the hypervisor off** | you | the hardware, directly | you lose **every** Hyper-V-backed feature at once — memory integrity, Credential Guard, WSL2, Sandbox, Application Guard, container backends — not just the one you think you are disabling |

If you go the WHP route, the object model is: `WHvGetCapability` → `WHvCreatePartition` (creates only the object) → `WHvSetPartitionProperty` → `WHvSetupPartition` (creates the actual hypervisor partition) → `WHvMapGpaRange` → `WHvCreateVirtualProcessor` → `WHvRunVirtualProcessor`, which returns an exit context. Note that exit contexts are an **abstraction over** hardware exit reasons, not the hardware encodings — and registers are accessed by name, with no VMCS anywhere in the API.

**One caveat about diagnosis.** If your software's actual complaint is that it cannot allocate writable-executable kernel memory or patch kernel code, that is a *different* mechanism — memory-integrity enforcement from VTL1 — with a different fix. Do not diagnose the two together.

**Citation given:** Microsoft Hyper-V architecture and "Virtualization applications do not work together with Hyper-V, Device Guard, and Credential Guard" troubleshooting documentation; Microsoft Hypervisor Top-Level Functional Specification (VTLs, hypervisor CPUID leaves 0x40000000/0x40000001); Microsoft Windows Hypervisor Platform API documentation; Intel SDM Vol.3C Ch.26 (single owner of VMX root operation) — all as cited in `17-windows-platform.md` §17.1 and §17.3
**Disagreement:** none

---

### driver-rejected-after-memory-integrity
**Routed to:** `15-security.md` §15.5 (routing row lists VBS/HVCI under chapter 15), cross-read `17-windows-platform.md` §17.6 for the platform-side mechanism
**Needed quickref §0.2:** no
**Actually answered from:** `15-security.md` §15.7, §15.8; `17-windows-platform.md` §17.6, §17.6.1, §17.3.5
**Answer:**
**Cause.** "It is signed" is necessary and not sufficient. Memory integrity (HVCI) moves the kernel-mode code-integrity decision **out of the kernel it is policing** and into the secure kernel at VTL1. Your driver is being rejected for one of two reasons, and they need different fixes:

1. **It violates the W^X invariant.** The enforced rule is that kernel memory pages become executable only after passing code-integrity checks inside the secure environment, and executable pages are never writable. A driver fails "when it violates the invariant rather than when it is merely old". Microsoft's compatibility guidance is explicit: do not use sections that are both writable and executable; do not modify executable system memory directly; do not use dynamic code in the kernel; do not load data files as executable; allocate from a **non-executable pool**. The first step Microsoft names is "a clear separation of data and code".
2. **The signature is not one the secure kernel accepts.** The integrity check that authorises the write→execute transition happens in the secure environment, so a signature the VTL0 kernel would have accepted is simply irrelevant. If your driver is signed in a way that satisfied the old path but not HVCI's policy, it fails here — and "it loaded fine for years" is exactly what that looks like.

**Mechanism — why you cannot work around it.** The executable permission for a code page lives in the **EPT entry the hypervisor controls**, not in the VTL0 page tables your (or a compromised) kernel controls. Memory access permissions are "managed by the hypervisor in a partition's physical address space, and thus cannot be modified by system level software running in the partition" — including by the VTL0 kernel. A page may be writable at VTL0 **or** executable at VTL0, but the secure kernel does not grant both at once. That is precisely the property the feature exists to provide, and also the property that breaks drivers which generate code.

Two useful corollaries. The cost profile is **per-page-permission-change, not per-call**, because the expensive event is changing page permissions, not ordinary execution. And **MBEC** (mode-based execute control for EPT) is what makes this affordable: with that VM-execution control set, an EPT entry carries a separate user-mode execute permission at bit 10 alongside the supervisor-mode one at bit 2, so the hypervisor can allow user execution of a page while denying kernel execution without a second set of structures. Microsoft's own statement is narrower than the version usually quoted: memory integrity "works better" on processors with MBEC (Intel) or GMET (AMD), and older processors fall back to an emulation called Restricted User Mode "which has a bigger impact on performance".

**What to do.**
1. Audit the PE sections for any that are both writable and executable. Split them.
2. Remove run-time code generation, kernel code patching and direct modification of executable system memory. There is no HVCI-compatible way to do these.
3. Move allocations to a non-executable pool.
4. Do not load data files as executable.
5. Re-sign to the policy the secure kernel enforces, and re-test with memory integrity on.
6. **Do not confuse this with the other failure.** If the driver's real problem is that it wants to execute VMXON — a hypervisor, debugger or analysis driver — that is the single-owner rule of `17-windows-platform.md` §17.1, a completely different mechanism with a completely different fix. The skill is explicit that the two failure modes "should not be diagnosed together".
7. Separately, if the product in question is protection software that objects to a hypervisor being present at all, that is a third thing: it is observing the hypervisor through the CPUID indications and treating its presence as untrusted. Whether a *specific* named product is currently incompatible is a product-status question that this knowledge base deliberately does not carry.

**Citation given:** Microsoft "Virtualization-based Security (VBS)" and "Memory integrity / HVCI" documentation, Microsoft's HVCI driver compatibility guidance, and the Hypervisor Top-Level Functional Specification / Isolated User Mode documentation (VTL0-VTL1 permission split) — as cited in `15-security.md` §15.7–§15.8 and `17-windows-platform.md` §17.6; Intel SDM Vol.3C §31.3.2 for mode-based execute control
**Disagreement:** none

---

### hypervisor-works-linux-not-windows11
**Routed to:** `17-windows-platform.md` §17.1 (routing row "why no VT-x"), with `16-performance.md` for the magnitude question
**Needed quickref §0.2:** no
**Actually answered from:** `17-windows-platform.md` §17.1, §17.3.4, §17.3.6, §17.8.1; `16-performance.md` §16.3.1, §16.5
**Answer:**
**What changed: who owns the hardware.** On Linux, your VMM (or KVM under it) is in VMX root operation. The KVM host is in VMX root operation whenever virtualization is enabled, with no software fallback — initialisation simply fails on a processor without VMX. Your VMM handles its exits in its own handler, directly.

On Windows 11, the Windows hypervisor almost certainly got there first. Any Hyper-V-backed feature — virtualization-based security / memory integrity, WSL2, Windows Sandbox, Docker Desktop, Application Guard, or the Hyper-V role — starts the hypervisor, and from that moment the Windows kernel is a VTL0 guest and Hyper-V owns VMX root operation. Your type-2 VMM is then not a hypervisor at all: it is a user-mode process whose guest is a Hyper-V partition, reached through the Windows Hypervisor Platform. The structural difference in one line: all these designs put CPU and memory virtualization below the device model; Windows is distinctive in that **its own kernel is on the guest side of that line**.

**Why it is slower — three compounding mechanisms.**
1. **An extra boundary crossing per exit.** Under WHP, each guest exit is processed twice: the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to your user-mode VMM. That is one more crossing than a VMM owning VMX root pays.
2. **You lose control of the VM-execution controls.** The arrangement removes your ability to program your own controls, so optimisations that depend on intercepting less, or on using a hardware feature the API does not expose, are unavailable **regardless of what the silicon supports**. The WHP API exposes registers by name and exit contexts in API terms; no WHP page mentions a VMCS at all.
3. **Second-level address translation is active for the whole machine.** With the hypervisor resident, SLAT applies to ordinary desktop workloads, not just to VMs — every TLB miss on the machine is walked twice. This is the term most often missed, and it is why "disable memory integrity" and "disable the hypervisor" are not the same experiment.

**Why it "misbehaves" and not just slows down.** Two further effects: guest-visible processor facilities — timers, performance-monitoring, some MSRs — may be virtualized or intercepted when a hypervisor is resident, and which ones is a property of Hyper-V's interception configuration rather than of the processor. And if you instead run nested inside a Hyper-V child partition, Microsoft states flatly that virtualization applications other than Hyper-V "aren't supported in Hyper-V virtual machines, and are likely to fail".

**What to do.** Pick one of exactly three options: (a) port to WHP and accept the extra hop and the lost controls; (b) run nested, accepting that it is unsupported for non-Hyper-V VMMs and that the WHP and nesting costs compound; (c) turn the hypervisor off and take the hardware — which disables every Hyper-V-backed feature at once, including memory integrity and Credential Guard, not just the one you think you are switching off.

**On the magnitude.** THE SKILL DOES NOT CONTAIN A FIGURE FOR THIS. No public measurement of the WHP-versus-bare-VMX difference carrying processor, guest workload and configuration is recorded in this knowledge base. The direction follows from the mechanism; the magnitude does not. The skill is explicit that this is the cleanest case in which the honest answer is a mechanism plus "no measured figure here", and that the temptation to supply a percentage is strongest exactly where users most want one.

**Citation given:** Microsoft Windows Hypervisor Platform API documentation and Hyper-V architecture documentation (single-owner rule, double exit handling, nested support statement); Microsoft nested-virtualization documentation; Linux KVM documentation/source for the Linux side — all as cited in `17-windows-platform.md` §17.1, §17.3 and §17.8.1; Intel SDM Vol.3C Ch.26 for the single-owner rule and Ch.31 for second-level translation
**Disagreement:** none

---

### vbs-overhead-figure
**Routed to:** `16-performance.md` (routing row "Overhead numbers — VBS, utility VMs, WHP vs bare VMX, nesting, EPT"), then `15-security.md` §15.12 and `errata.md` O4
**Needed quickref §0.2:** no
**Actually answered from:** `16-performance.md` §16.1, §16.3.1, §16.3.2, §16.3.3, §16.3.4; `15-security.md` §15.12; `errata.md` O4
**Answer:**
**There is no single number, and the skill refuses to invent one.** Three figures circulate widely, they were produced by different tests toggling different things on different hardware, and this knowledge base presents them side by side rather than averaging them. Here they are with their conditions:

| Figure | What was actually toggled | Conditions | Class |
|---|---|---|---|
| 6% frame rate, 8% frame times | memory integrity (HVCI) on vs off | ComputerBase's own testing, Ryzen 7 5800X + Radeon RX 7900 XTX; per-title spread large | T3 media benchmark |
| 4.9% and 5.7% geometric mean in prose; single titles to ~8% | VBS on vs off, against a VBS-and-HVCI-off baseline | five titles (two in two APIs), Core i7-11700K and Core i7-10700K + RTX 3090 at 1920×1080 | T3 media benchmark |
| "up to 10%", "as much as 15%" | the default VBS setting on vs off | **both are one title** — Microsoft Flight Simulator: 10% on average frame rate, 15% on the 1% lows; Core i9-13900K + RTX 4090. The same article's suite-wide figure is about 5% | T3 media benchmark |

**How to read them.** As suite-level geometric means they span roughly **4% to 6%**; single titles reach about **8%**; one title reaches **15% on its 1% lows**, not on its average frame rate. The confidence on the whole cluster is low. The widely repeated "5–25%" gaming range and the "5–10%" system-wide figure have **no traceable primary source** in this knowledge base and appear in secondary write-ups without hardware, workload, or the distinction between enabling memory integrity alone and enabling the full feature set. Two attributions in an earlier version of this table were wrong and are corrected: the ~6% memory-integrity figure is ComputerBase's own measurement, and one bibliography entry that was cited for 6% turns out to be a 2026-09-03 news item that quotes no frame-rate figure at all and says only that the feature "may have some impact on some PC gaming performance". Adjudicating the three remains an **open conflict**, not a settled fact.

**Why the spread is real and not just sloppiness.** Four mechanisms contribute, each able to dominate: (1) with the hypervisor resident, operations Hyper-V intercepts become exits that did not exist with it off; (2) **second-level address translation is active for the whole machine**, so the two-dimensional page walk applies to your game, not just to VMs — this is the term most often missed; (3) memory-integrity enforcement moves kernel page-permission changes into a VTL1 transition rather than a local page-table write; (4) calls into the secure kernel are VTL transitions, hypervisor-mediated, costing at least a round trip. On top of that, three machine properties move the result **more than the setting does**: TLB reach and page size (how often the two-dimensional walk is paid at all), core type on hybrid processors (a workload migrated between core types changes its own baseline), and whether large pages are available to the affected workload (which changes the walk depth). None of these is under your control from the security setting — which is why two correctly-run measurements of "the same" configuration can differ by more than the effect.

**So what should you actually do.** If you want a number for *your* machine, measure it, and make the measurement interpretable:
1. **One variable at a time.** Toggling memory integrity is not the same experiment as disabling the hypervisor — the second also removes the whole-machine SLAT cost.
2. **A workload bound by the thing being measured.** A GPU-bound game at high resolution will show nothing. That alone explains part of the spread between the circulating numbers, since a frame-rate delta measured GPU-bound and a processor-side overhead figure are not comparable quantities.
3. **Distributions, not means.** This shows up in tail latency and frame times long before it moves an average — which is exactly why one of the circulating figures is a 1%-low number.
4. Record processor and generation, GPU and whether the test is CPU- or GPU-bound, exact title/resolution/quality, which features were toggled, whether large pages were available, and the Windows build.
5. State the measurement definition. "Frames per second lost" and "cycles added per exit" are different quantities.

**A non-performance cost worth naming.** With the hypervisor resident, third-party virtualization applications must go through the platform API rather than driving VT-x directly, which changes their performance characteristics independently of any frame-rate measurement.

**Citation given:** `16-performance.md` §16.3.2 and §16.3.3 and `15-security.md` §15.12 record these as T3 media benchmarks with the conditions above; the conflict is tracked as open item O4 in `errata.md`. Mechanism claims: Microsoft VBS/memory-integrity documentation for the feature, Intel SDM Vol.3C Ch.31 for second-level address translation. There is no Intel specification section for any of these numbers, and demanding one would produce a fabricated citation.
**Disagreement:** My pre-training prior would have been to answer with a single "roughly 5–10%" figure, and for gaming specifically "5–25%". The skill establishes that the "5–10%" and "5–25%" figures have no traceable primary source, that the three real measurements toggled different things, and that they must not be averaged. I am reporting the skill's position.

---

### modern-vmexit-cycles
**Routed to:** `16-performance.md` (routing row "Overhead numbers"); SKILL.md's "Known limits" flags this exact gap
**Needed quickref §0.2:** no
**Actually answered from:** `16-performance.md` §16.1, §16.2.1–§16.2.7; `errata.md` E09
**Answer:**
**THE SKILL DOES NOT CONTAIN THIS.** There is no public cycle-level VM-exit measurement for Ice Lake, Sapphire Rapids, Granite Rapids, or **any** client part recorded in this knowledge base. The newest hard cycle figure for the cost of an exit available here is the **Westmere** round trip published by Intel in **2010**. The skill states this absence deliberately rather than extrapolating, on the grounds that an extrapolation would be a fabricated number carrying the authority of a measured one.

**Before anything else: which quantity do you mean?** This is the single most common error in the secondary literature, and it is recorded as an erratum. "VM-exit cost" denotes either **(a)** the bare hardware round trip — VM exit plus VM entry, no handler — or **(b)** the end-to-end cost of handling one exit, including decode, emulation and any resulting I/O. **The two differ by a factor of several and must never be quoted interchangeably.** Quoting a bare-transition figure (hundreds of cycles) as the cost of handling an exit, or an end-to-end figure (thousands) as a hardware property, is the standard failure.

**The entire public cycle-level record this knowledge base holds:**

| Figure | What it measures | Platform | Software | Year |
|---|---|---|---|---|
| 2409 cycles | VM entry, bare transition | 3.8 GHz Pentium 4 672 | VMware Player 1.0.1, VT-x VMM | 2006 |
| 937 cycles | VM entry, bare transition | 2.66 GHz Core 2 Duo | same | 2006 |
| 1931 / 1186 cycles | page-fault VM exit, bare transition | P4 672 / Core 2 Duo | same | 2006 |
| 11242 / 3927 / 1093 cycles | guest page-fault handling, end to end | first-gen VT-x | VT-x VMM / BT VMM / native | 2006 |
| 15826 cycles | one `in` instruction, end to end | first-gen VT-x | VT-x VMM | 2006 |
| ~1100 / ~820 / ~650 cycles | VM exit + VM entry, **best-case** round trip | Penryn / Nehalem / Westmere | Intel measurement, no hypervisor named | 2010 |
| ~3900 cycles, of which 1016 is the transition | average end-to-end exit handling | Core i7 920 (Nehalem) 2.67 GHz | NOVA microhypervisor | 2010 |

Intel's own wording for the newest row: "The best-case, round-trip latency (VM exit plus VM entry) on Nehalem is only about 75% (820 clock cycles) of that seen on the earlier Intel Penryn family of processors (1100 cycles). VMCS caching on Westmere reduces that latency to about 650 clocks—which translates to 60% of the latency on the Penryn family." Note **"best-case"**: that is the floor on an otherwise idle machine, not an expected value under load. In the same era Intel reported VMREAD latency falling from 174 cycles on Prescott to 7 on Nehalem, which is why VMCS-field access stopped dominating exit handlers.

**The one modern data point, and it is a ratio, not a cycle count.** A 2024–25 study reports VMEXIT-entailing instruction latency about **472% higher inside an Intel TDX trust domain** than in a normal VM on the same host, and about **240% higher** for an AMD SEV-SNP guest on its own host — two different machines (a 5th-gen Xeon Platinum 8570 and a 4th-gen EPYC), each compared against a normal VM on itself. The study plots nanoseconds and gives **no cycle count for either baseline**, so it cannot be converted into the number you asked for.

**Also circulating, and not usable.** Ranges of the form "CPUID/MSR 200–1000 cycles, page-table updates 500–2000, interrupt handling 500–5000, I/O 1000–10000" appear in engineering blogs with no published method, hardware or hypervisor. The orders of magnitude are consistent with the 2006 and 2010 measurements, but the table is not evidence.

**What can be said qualitatively, and no more.** A modern exit is certainly cheaper than Penryn's in cycles and certainly more variable — frequency scaling, hybrid core types, SMT, cache state, and speculative-execution mitigations all move it. But the more useful design fact from the record above is the NOVA result: even in a microhypervisor designed for short paths, the architectural transition was only about **26%** of the total (1016 of ~3900 cycles), with ~15% for microhypervisor-to-VMM communication and ~59% for instruction and device emulation. That ratio is why "reduce the number of exits" beats "make exits cheaper" as an optimisation strategy.

**If you need a number for a current part, measure it** and record: what was timed (bare round trip vs end-to-end), microarchitecture, hypervisor and configuration, benchmark and parameters, and year. A number quoted without its conditions does not become "approximately right" — it becomes a false universal.

**Citation given:** Intel SDM Vol.3C Ch.30 for the architectural fact that the hardware round trip has a fixed cost independent of the handler. The figures are not Intel architecture and carry their own sources: Adams & Agesen (ASPLOS 2006) for the 2006 rows; Intel's published Nehalem/Westmere latency statement for the 2010 round trip; the NOVA paper (EuroSys 2010) for the end-to-end breakdown; the 2024–25 TDX/SEV-SNP study for the ratio — all as catalogued in `16-performance.md` §16.2.7 and `errata.md` E09.
**Disagreement:** My prior would have supplied something like "1000–2000 cycles on a modern part". The skill states that no such measurement exists in it and that extrapolating would be fabrication. I am reporting the skill's position and withholding the number.

---

### whp-vs-bare-vmx-figure
**Routed to:** `16-performance.md` (routing row names "WHP vs bare VMX" explicitly)
**Needed quickref §0.2:** no
**Actually answered from:** `16-performance.md` §16.5, §16.7; `17-windows-platform.md` §17.3.4, §17.3.6
**Answer:**
**THE SKILL DOES NOT CONTAIN THIS.** No public measurement of the difference carrying processor, guest workload and configuration is recorded in this knowledge base. The skill names this as its cleanest example of a case where the honest answer is a mechanism plus an explicit "no measured figure here" — and notes that the temptation to supply a percentage is strongest exactly where users most want one. **The direction follows from the mechanism; the magnitude does not.**

**What is established — the mechanism, and it is specific.**
1. **One extra boundary crossing per exit.** When your VMM runs through the Windows Hypervisor Platform, its guest is a Hyper-V partition and each exit is processed twice: the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to your user-mode VMM. A VMM owning VMX root operation handles the exit in its own handler directly, paying one crossing instead of two.
2. **You lose the execution controls.** The arrangement removes your ability to program your own VM-execution controls. Optimisations that depend on specific controls — intercepting less, or using a hardware feature the API does not expose — are unavailable **regardless of what the hardware supports**. This is a capability loss, not a latency tax, and in some workloads it will dominate the extra hop.

**What determines the magnitude for you.** Exit **density**, not exit cost. The same reasoning the skill applies to nesting applies here: figures range from single-digit percentages to multiples depending only on the workload. A guest that runs mostly in non-root operation at native speed will barely notice; one that exits constantly will pay the double-handling on every one. So the answer for your VMM is a property of your guest's exit profile, which you can measure directly by counting exits per second and classifying them.

**One thing not to confuse.** Running through WHP and running **nested** inside a Hyper-V child partition are different configurations with different costs, and they **compound** if you do both. Nesting has its own multiplication — the outermost hypervisor takes every inner-guest exit, decides ownership, and if the inner hypervisor owns it, constructs the appearance of an exit for that hypervisor, which runs its handler and attempts an entry that must itself be intercepted.

**If you want a number, produce it yourself**, and make it interpretable: one variable at a time; a workload actually bound by exits rather than by compute or GPU; distributions rather than means; and the full condition set recorded — processor and generation, hypervisor and Windows build, guest workload and parameters, and a stated measurement definition.

**Citation given:** Microsoft Windows Hypervisor Platform API documentation, as cited in `17-windows-platform.md` §17.3.4 and `16-performance.md` §16.5, for the double-handling and the loss of execution-control programming. There is no Intel specification section for this, and there is no measured figure in this knowledge base to cite.
**Disagreement:** none

---

### wsl2-overhead-figure
**Routed to:** `16-performance.md` (routing row "Overhead numbers — VBS, utility VMs, …")
**Needed quickref §0.2:** no
**Actually answered from:** `16-performance.md` §16.4, §16.6; `17-windows-platform.md` §17.4.1, §17.4.6
**Answer:**
**THE SKILL DOES NOT CONTAIN A FIGURE.** No measurement of WSL2, Windows Sandbox or a Windows container backend carrying processor, workload and configuration is recorded in this knowledge base. What can be stated is the mechanism — and the mechanism is actually the more useful answer to "what does it cost me when I am not using it".

**The part you pay whether you use it or not.** WSL2 is a Hyper-V virtual machine — Microsoft states this flatly — and a utility VM is a **partition**: it holds memory, its virtual processors are scheduled against the host's, and its I/O crosses a synthetic-device boundary. So its **resident** cost is memory plus scheduling, and it is present whenever the utility VM is running, not only when you are interacting with it.

**The much larger, and usually overlooked, part.** Enabling WSL2 enables the platform. The optional component it requires, Virtual Machine Platform, is "a subset of Hyper-V architecture" and needs the machine's virtualization capabilities — so your machine becomes a hypervisor host. From that moment:
- the Windows kernel runs in VTL0 as a guest, and operations Hyper-V intercepts become exits that did not exist with the hypervisor off;
- **second-level address translation is active for the whole machine, not just for VMs** — every TLB miss on the box is walked twice, for your desktop and your games, not only inside WSL2;
- every third-party VMM on the machine is now nested or must go through the platform API.

That whole-machine cost is the honest answer to "when I am not using it", and it is the same cost VBS imposes. It does not go away when WSL2 is idle; it goes away when the hypervisor is not running.

**The variable cost, when you do use it.** Concentrated at the boundary, not inside the guest: guest compute runs in non-root operation at native speed, while every crossing — a file operation against the host filesystem, a network packet, a device interaction — traverses the synthetic transport. This is why Microsoft documents cross-filesystem file performance as *faster* under the older WSL design than under WSL2, and tells users to keep project files in the filesystem matching the tools using them. (Microsoft gives no mechanism for that; the synthetic-transport explanation is this knowledge base's inference from the transport, not a documented attribution — flagged low confidence.)

**The one quantified analogue, and its limits.** The closest thing to a number here is a virtio-blk latency breakdown: 25699 ns (13.08%) in-guest processing, 7561 ns (3.85%) guest/host switching, 3640 ns (1.85%) host/userspace switching, 29393 ns (14.96%) device-model emulation, 130235 ns (66.27%) host I/O — measured on a 2010 Linux/KVM stack (2x4-core host, 8 GB, 12 LVM-striped FC LUNs, kvm.git 2010-05-22 with qemu-kvm 0.12.4, a 1-vCPU 4 GB guest, virtio disk with `cache=none`), **not on Windows**. Do not quote the absolute numbers for WSL2. The useful part is the **ordering**: VMX transitions are the smallest term and the device model costs several times more — the same shape a host-to-guest filesystem crossing has. That ordering is why a synthetic-device design such as VMBus matters more on a PC than exit cost does.

**What to do.** The useful question about a utility VM is **how often your workload crosses the boundary**, not how fast the guest runs. If you want a number: shut WSL2 down (`wsl --shutdown`) and measure the idle delta, then measure with the hypervisor entirely disabled — those are two different experiments, and the second also removes the machine-wide SLAT cost. Record processor, workload, Windows build and what exactly was toggled.

**Citation given:** Microsoft WSL documentation ("WSL 2 is running as a Hyper-V virtual machine"; Virtual Machine Platform as "a subset of Hyper-V architecture"; cross-filesystem performance guidance) and Windows Sandbox / Docker Desktop documentation, as cited in `17-windows-platform.md` §17.4; the virtio-blk breakdown is from the KVM project wiki as cited in `16-performance.md` §16.6. Intel SDM Vol.3C Ch.31 for second-level address translation. No Intel specification covers what WSL2 costs, and demanding one would produce a fabricated citation.
**Disagreement:** none

---

### vtl-transition-cost
**Routed to:** `16-performance.md` (routing row "Overhead numbers — VBS, …"), cross-checked `15-security.md` §15.7 for the VTL mechanism
**Needed quickref §0.2:** no
**Actually answered from:** `16-performance.md` §16.3.1, §16.2.5; `15-security.md` §15.7; `17-windows-platform.md` §17.6.1
**Answer:**
**THE SKILL DOES NOT CONTAIN THIS.** The knowledge base states it explicitly: "Calls into the secure kernel are VTL transitions, which are hypervisor-mediated and therefore cost at least a round trip of the kind measured in §16.2; **this knowledge base records no measurement of a VTL transition in cycles.**" There is no number here, and I will not construct one.

**What can be said, and what it does and does not license.**
- A VTL transition is **hypervisor-mediated**, so it costs **at least** a VM-exit/VM-entry round trip. That gives you a floor, not a value.
- The floor itself is not known for a modern part: no public cycle-level VM-exit measurement for any recent client processor is recorded here. The newest hard round-trip figure available is Intel's **best-case ~650 cycles on Westmere, 2010** — a decade-and-a-half-old server-class part, measured on an otherwise idle machine. Multiplying that by anything to estimate a VTL transition on a current laptop would be fabrication dressed as arithmetic.
- The transition is only part of the cost. In the one end-to-end breakdown the skill carries (NOVA, 2010), the architectural transition was about **26%** of the total cost of handling an exit; the rest was handler work. A VTL transition likewise includes whatever the secure kernel then does.

**The mechanism, which is what you can actually act on.** VTLs are hierarchical, with higher levels more privileged; the traditional execution model runs in VTL0 and the secure kernel and Isolated User Mode in VTL1. The boundary is enforced by memory access permissions managed by the hypervisor in the partition's physical address space, which system-level software in the partition — including the VTL0 kernel — cannot modify. The architecturally important consequence for cost: the feature has a **per-page-permission-change cost profile, not a per-call one**. The expensive event is a change of page permissions, not ordinary execution. So the number that predicts your workload's cost is how often it triggers kernel page-permission changes or secure-kernel calls, not the price of one transition.

Note also that on a VBS machine the transition cost is **not** the dominant term for most workloads. Second-level address translation is active for the whole machine, so every TLB miss is walked twice — that applies to all code on the box, whether or not it ever touches VTL1, and it is the mechanism most often missed when people go looking for a per-transition figure.

**If you need the number, measure it**, and state what you timed: a VTL0→VTL1→VTL0 round trip is not the same quantity as "the cost of a secure-kernel call", and neither is comparable to a frame-rate delta. Record microarchitecture, Windows build, which features were enabled, and the distribution rather than the mean.

**Citation given:** Microsoft Hypervisor Top-Level Functional Specification and Isolated User Mode documentation for the VTL hierarchy and hypervisor-managed permissions (as cited in `15-security.md` §15.7 and `17-windows-platform.md` §17.6.1); Intel SDM Vol.3C Ch.30 for the VM-exit/entry round trip that forms the floor. `16-performance.md` §16.3.1 records the absence of any cycle measurement. There is no Intel specification section for a VTL transition — it is not an Intel architectural concept.
**Disagreement:** none
