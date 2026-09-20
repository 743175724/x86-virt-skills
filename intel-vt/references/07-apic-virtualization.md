# 07. APIC Virtualization and Virtual Interrupts

> **中文速览**：本章覆盖 APICv 的全部机制——TPR shadow 与 TPR threshold（市场名 FlexPriority）、APIC-access page 与 virtual-APIC page 的分工、哪些访问被虚拟化 / 哪些产生 exit reason 44 / 哪些产生 exit reason 56、RVI 与 SVI 的语义、虚拟中断的评估与投递算法（含 TPR/PPR/EOI/self-IPI 虚拟化伪代码）、virtualize x2APIC mode 与 MSR bitmap 的配合、posted-interrupt descriptor 与 PIR→VIRR 合并中的 ON/SN 竞态，以及 IPI virtualization 与 PID-pointer table。调优中断密集型负载、实现 APICv、或排查 exit reason 43/44/45/56 时读本章。VMCS 编码表在 `02-vmcs.md`，exit 原因与 qualification 在 `05-vm-exit.md`，IRTE 与 VT-d 侧的 posted interrupt 在 `11-vtd-interrupt-remapping.md`。

**Maps to:** Intel SDM Vol.3C Ch.32 "APIC Virtualization and Virtual Interrupts" (rev 092) [1]
**Owns:** virtual-APIC page semantics · APIC-access page semantics · RVI and SVI · TPR / PPR / EOI / self-IPI virtualization · virtual-interrupt evaluation and delivery · the posted-interrupt descriptor · IPI virtualization and the PID-pointer table
**See also:** `02-vmcs.md` (field encodings and control bits) · `04-vm-entry.md` (VM-entry consistency checks) · `05-vm-exit.md` (basic exit reasons and exit qualifications) · `11-vtd-interrupt-remapping.md` (IRTE and the VT-d side of posted interrupts) · `18-comparison-amd-arm-riscv.md` (AMD AVIC)

---

## 7.1 The cost of a trapped local APIC

Without hardware help, every guest touch of the local APIC is a VM exit. The guest writes TPR when it raises or lowers its interrupt priority; it writes EOI once per interrupt handled; it writes ICR for every IPI; it reads ISR, IRR and PPR while making scheduling decisions. Each of those is an MMIO access into a page the VMM has arranged to trap, or an MSR access the MSR bitmap intercepts, and each costs a round trip plus instruction decoding and device-model emulation inside the VMM.

- **Claim.** Before APIC virtualization, guest accesses to the local APIC were handled by trap-and-emulate: the VMM intercepted the access, decoded the instruction, updated its software APIC model and resumed the guest.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's own estimate presented in 2012 was that APIC virtualization eliminates up to 50% of VM exits and simplifies the emulation of up to a further 10%, with the qualifier that the figures were an internal estimate rather than a published benchmark.  `[SDM 3C Ch.32]` `[116]` `C:medium` `V:durable`
- **Claim.** A third-party review of the first APICv-capable server platform reported that the VMMs of the day needed roughly 2000 to 7000 cycles per APIC-related exit, well above the cost of the bare VMX transition.  `[SDM 3C Ch.32]` `[121]` `C:medium` `V:durable`
- **Claim.** Hardware round-trip cost for a VM exit plus VM entry was measured by Intel at about 1100 cycles on the Penryn family, about 820 on Nehalem and about 650 on Westmere with VMCS caching; these are transition costs only and exclude VMM handling.  `[SDM 3C Ch.32]` `[124]` `C:medium` `V:durable`

Two observations shape everything that follows. First, the interrupt path is *bidirectional*: exits happen both when the guest touches its APIC and when something outside wants to reach the guest. Removing one direction does not remove the other, which is why the feature stack has two halves. Second, the operations that dominate by frequency are the cheapest ones semantically — EOI writes and TPR updates carry almost no information the VMM needs — so the biggest wins come from virtualizing the boring operations, not the complicated ones.

- **Claim.** EOI is the single most frequent local-APIC operation, executed once per interrupt handled, and virtualizing it is the largest single contributor to the exit reduction attributed to virtual-interrupt delivery.  `[SDM 3C Ch.32]` `[1]` `[116]` `C:medium` `V:durable`
- **Claim.** With external device interrupts increasingly bypassed by polling-mode drivers, the residual interrupt-virtualization cost in production clouds concentrates on inter-processor interrupts, which is the gap IPI virtualization (§7.9) closes.  `[SDM 3C Ch.32]` `[117]` `C:medium` `V:durable`

APIC virtualization is not one feature but a stack of them, each requiring the one below it:

| Layer | VM-execution control | What it removes |
|---|---|---|
| 1 | use TPR shadow | exits for TPR reads and writes |
| 2 | virtualize APIC accesses | turns xAPIC MMIO into a defined, decodable event instead of an ordinary EPT fault |
| 3 | APIC-register virtualization | exits for reads of most APIC registers |
| 4 | virtual-interrupt delivery | exits for interrupt injection, EOI and priority evaluation |
| 5 | process posted interrupts | exits on the *sending* side, for another CPU or the IOMMU |
| 6 | IPI virtualization | exits for the guest's own outgoing unicast IPIs |

---

## 7.2 TPR shadow, the TPR threshold, and FlexPriority

- **Claim.** When the "use TPR shadow" VM-execution control is 1 and "CR8-load exiting" is 0, MOV to CR8 writes bits 7:4 of the VTPR field in the virtual-APIC page instead of causing a VM exit, and MOV from CR8 reads it.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** The TPR threshold is a 32-bit VM-execution control field at VMCS field encoding 401CH of which only bits 3:0 are used; see `02-vmcs.md`.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** With "use TPR shadow" set and "virtual-interrupt delivery" clear, a TPR-below-threshold VM exit occurs when the value of bits 3:0 of the TPR threshold exceeds bits 7:4 of VTPR; the exit has basic exit reason 43 and is trap-like, occurring after the write completes (see `05-vm-exit.md`).  `[SDM 3C Ch.32]` `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** The same comparison is made as part of VM entry, so a VMM that lowers VTPR while the guest is not running still gets the exit at the next entry (entry checks: see `04-vm-entry.md`).  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** With "virtual-interrupt delivery" set, the TPR threshold is not used; the processor evaluates pending virtual interrupts instead of exiting, which is why the threshold mechanism belongs to the pre-APICv layer of the stack.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

FlexPriority is Intel's marketing name for this layer — the TPR shadow and nothing above it. It was aimed at 32-bit guest operating systems that write TPR on every interrupt-priority change; on 64-bit guests the same register is reached through CR8, which the same control covers.

- **Claim.** "FlexPriority" is Intel's marketing name for TPR-shadow-based TPR virtualization, not a separate architectural facility; the SDM describes the mechanism only as the "use TPR shadow" VM-execution control and TPR virtualization.  `[SDM 3C Ch.32]` `[1]` `[121]` `C:high` `V:durable`
- **Claim.** The generation in which FlexPriority first shipped is **disputed and unresolved**: one line of evidence places it in 2008 with the Xeon 7400 series, another places TPR-shadow-capable silicon in 2006–2007 Core 2 (Merom/Penryn) parts. This skill does not assert either side; the question is flagged for adjudication in `errata.md`.  `[SDM 3C Ch.32]` `[121]` `C:low` `V:durable`

---

## 7.3 Two pages, two jobs

The single most useful thing to internalise about APIC virtualization is that there are two 4-KByte pages with completely different roles, and conflating them makes the rest of the chapter unreadable.

- The **virtual-APIC page** is *storage*. The processor reads and writes it. It holds the virtual APIC's register state.
- The **APIC-access page** is a *tripwire*. The processor never reads or writes its contents at all. Its only purpose is to define an address range whose accesses get special treatment.

### 7.3.1 The virtual-APIC page

- **Claim.** The virtual-APIC address is a 64-bit VM-execution control field at VMCS field encoding 2012H pointing to a 4-KByte page that the processor uses to store virtual-APIC register state; see `02-vmcs.md`.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`

| Offset | Virtual register | Meaning |
|---|---|---|
| 080H | VTPR | virtual task-priority register |
| 0A0H | VPPR | virtual processor-priority register |
| 0B0H | VEOI | virtual end-of-interrupt register |
| 100H–170H | VISR | virtual in-service register, 256 bits |
| 200H–270H | VIRR | virtual interrupt-request register, 256 bits |
| 300H | VICR_LO | virtual interrupt command register, low |
| 310H | VICR_HI | virtual interrupt command register, high |
| 3F0H | virtual self-IPI register | x2APIC self-IPI |

- **Claim.** VTPR is at offset 080H, VPPR at 0A0H and VEOI at 0B0H of the virtual-APIC page.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** VISR occupies offsets 100H through 170H and VIRR offsets 200H through 270H, each holding 256 bits as eight 32-bit values placed 16 bytes apart, matching the xAPIC register layout.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** VICR_LO is at offset 300H and VICR_HI at offset 310H; the virtual self-IPI register is at offset 3F0H, corresponding to the x2APIC self-IPI MSR.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** The virtual-APIC page is ordinary memory that the VMM allocates and may read and write itself, which is how a VMM injects an interrupt under virtual-interrupt delivery: it sets a bit in VIRR and raises RVI.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.3.2 The APIC-access page

- **Claim.** The APIC-access address is a 64-bit VM-execution control field at VMCS field encoding 2014H; when "virtualize APIC accesses" is 1 it identifies the 4-KByte APIC-access page, and when EPT is in use the comparison is made against the guest-physical address of the access. See `02-vmcs.md`.  `[SDM 3C §27.6.8]` `[1]` `C:medium` `V:durable`
- **Claim.** The processor never reads or writes the contents of the APIC-access page: an access to it is either serviced from the virtual-APIC page or turned into a VM exit, so the page's backing memory is irrelevant.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** The guest reaches the APIC-access page by programming IA32_APIC_BASE to a guest-physical address that matches the APIC-access address, which is why "virtualize APIC accesses" applies to xAPIC (MMIO) mode and "virtualize x2APIC mode" applies to MSR mode.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

### 7.3.3 What happens to each access

This is the table the old skill never made actionable.

| Access | Controls in effect | Outcome |
|---|---|---|
| Read of a virtualized register, 4 bytes, aligned | APIC-register virtualization = 1 | serviced from the virtual-APIC page, no exit |
| Read of VTPR (offset 080H) | use TPR shadow = 1 | serviced from VTPR, no exit |
| Read of an offset with no virtual register, or a misaligned or non-4-byte read | any | **APIC-access VM exit, reason 44** |
| Instruction fetch from the APIC-access page | any | **APIC-access VM exit, reason 44** |
| Write to VTPR (080H) | use TPR shadow = 1 | written to the virtual-APIC page, then TPR virtualization; no exit unless TPR below threshold (reason 43) |
| Write to VEOI (0B0H) | virtual-interrupt delivery = 1 | written, then EOI virtualization; exit only if the EOI-exit bitmap selects the vector (**reason 45**) |
| Write to VICR_LO (300H) encoding a self-IPI | virtual-interrupt delivery = 1 | self-IPI virtualization, no exit |
| Write to VICR_LO encoding a physical unicast IPI | IPI virtualization = 1 | posted to the target's PID, no exit |
| Any other write to a virtualized offset | APIC-register virtualization = 1 | value lands in the virtual-APIC page, then **APIC-write VM exit, reason 56** |
| Any access when only "virtualize APIC accesses" is set | APIC-register virtualization = 0 | **APIC-access VM exit, reason 44** |
| Access made as part of a page walk or event delivery rather than by an instruction's linear address | any | **APIC-access VM exit, reason 44**, flagged as a guest-physical access |

- **Claim.** An APIC-access VM exit has basic exit reason 44 and is fault-like: it occurs *before* the access completes, so the VMM must emulate the access itself.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** An APIC-write VM exit has basic exit reason 56 and is trap-like: the write has already been performed into the virtual-APIC page, and the exit qualification gives the offset of the register written, so the VMM never has to decode the instruction.  `[SDM 3D App.C]` `[SDM 3C §27.9.1]` `[2]` `[1]` `C:high` `V:durable`
- **Claim.** For an APIC-access VM exit the exit qualification carries the offset within the APIC-access page in bits 11:0 and the access type in bits 15:12, distinguishing linear data reads, linear data writes, linear instruction fetches, accesses during event delivery and guest-physical accesses; the full encoding is owned by `05-vm-exit.md`.  `[SDM 3C §27.9.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Instruction fetches from the APIC-access page are never virtualized and always cause an APIC-access VM exit, so guest code can never execute out of its own APIC page.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** APIC-register virtualization applies only to naturally aligned 4-byte accesses; other widths and alignments fall back to an APIC-access VM exit.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

The practical consequence: reason 44 means "you have to do the whole access", reason 56 means "the write already happened, go apply its side effects". A VMM's reason-56 handler reads the new value out of the virtual-APIC page at the offset the qualification gave it.

```
handler for basic exit reason 56 (APIC write):
    offset <- exit_qualification[11:0]
    value  <- read 4 bytes from virtual_APIC_page + offset
    apply the side effects of writing `value` to the APIC register at `offset`
    resume                                  # no instruction decoding, no re-execution

handler for basic exit reason 44 (APIC access):
    offset <- exit_qualification[11:0]
    type   <- exit_qualification[15:12]
    decode the faulting instruction
    emulate the read or write against the software APIC model
    advance guest RIP
    resume
```

- **Claim.** Because the APIC-write exit is trap-like and reports the offset directly, its handler needs neither instruction decoding nor guest-memory access, which is the source of Intel's claim that APIC-register virtualization "simplifies" rather than merely eliminates a class of exits.  `[SDM 3C Ch.32]` `[1]` `[116]` `C:medium` `V:durable`

---

## 7.4 VMCS fields this chapter depends on

`02-vmcs.md` owns the encoding table; the entries below are restated because the algorithms in §7.6 and §7.8 cannot be read without them.

| Field | Encoding | Width |
|---|---|---|
| Virtual-APIC address | 2012H | 64-bit control |
| APIC-access address | 2014H | 64-bit control |
| Posted-interrupt descriptor address | 2016H | 64-bit control |
| EOI-exit bitmap 0 … 3 | 201CH, 201EH, 2020H, 2022H | 64-bit control |
| TPR threshold | 401CH | 32-bit control |
| Guest interrupt status | 0810H | 16-bit guest state |
| Posted-interrupt notification vector | 0002H | 16-bit control |
| PID-pointer table address, last PID-pointer index | see `02-vmcs.md` | IPI virtualization |

- **Claim.** The EOI-exit bitmap occupies four 64-bit VM-execution control fields at encodings 201CH, 201EH, 2020H and 2022H, together forming a 256-bit map with one bit per interrupt vector; see `02-vmcs.md`.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** The posted-interrupt descriptor address is a 64-bit VM-execution control field at encoding 2016H and the posted-interrupt notification vector is a 16-bit VM-execution control field at encoding 0002H; see `02-vmcs.md`.  `[SDM 3C §27.6.8]` `[1]` `C:medium` `V:durable`
- **Claim.** Guest interrupt status is a 16-bit guest-state field at encoding 0810H, part of guest non-register state rather than of any architectural register; see `02-vmcs.md`.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** SDM rev 092 additionally defines APIC-timer virtualization controls in the VMCS, described in Vol.3C §27.6.27; they are outside the APICv stack described here and owned by `02-vmcs.md`.  `[SDM 3C §27.6.27]` `[1]` `C:medium` `V:durable`

---

## 7.5 Guest interrupt status: RVI and SVI

The guest-interrupt-status field is two independent bytes, and confusing them is the most common APICv reading error.

- **Claim.** Bits 7:0 of the guest-interrupt-status field are RVI, the requesting virtual interrupt: the vector of the highest-priority virtual interrupt waiting to be delivered to the guest.  `[SDM 3C §27.4.2]` `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 15:8 of the guest-interrupt-status field are SVI, the servicing virtual interrupt: the vector of the highest-priority virtual interrupt currently in service, that is, the highest bit set in VISR.  `[SDM 3C §27.4.2]` `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** RVI is the virtual counterpart of the physical APIC's highest pending IRR vector and SVI of its highest ISR vector; the processor keeps both in the VMCS rather than recomputing them from the virtual-APIC page on every evaluation.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** A VMM injects an interrupt under virtual-interrupt delivery by setting the vector's bit in VIRR on the virtual-APIC page and setting RVI to the vector if it is higher than the current RVI; it does not use the VM-entry interruption-information field.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

---

## 7.6 The virtual-interrupt algorithms

The following pseudocode follows the SDM's own formulation. All register names refer to fields of the virtual-APIC page except RVI and SVI, which are the two bytes of the guest-interrupt-status field.

### 7.6.1 TPR virtualization

```
TPR virtualization:
    perform PPR virtualization                       # 7.6.2
    if "virtual-interrupt delivery" = 0:
        if TPR_threshold[3:0] > VTPR[7:4]:
            VM exit: TPR below threshold (reason 43)
    else:
        evaluate pending virtual interrupts          # 7.6.3
```

- **Claim.** TPR virtualization first performs PPR virtualization, then either checks the TPR threshold (when virtual-interrupt delivery is off) or re-evaluates pending virtual interrupts (when it is on).  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.6.2 PPR virtualization

```
PPR virtualization:
    if VTPR[7:4] >= SVI[7:4]:
        VPPR <- VTPR & FFH
    else:
        VPPR <- SVI & F0H
```

- **Claim.** PPR virtualization sets VPPR to VTPR when the task priority class is at least the in-service priority class, and otherwise to SVI with its low nibble cleared.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.6.3 Evaluation of pending virtual interrupts

```
evaluate pending virtual interrupts:
    if RVI[7:4] > VPPR[7:4]:
        recognize a pending virtual interrupt
    else:
        do not recognize a pending virtual interrupt
```

- **Claim.** A virtual interrupt is recognized only when the priority class of RVI, bits 7:4, is strictly greater than the priority class of VPPR; comparison is by priority class, not by full vector value.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** Recognition is not delivery: a recognized virtual interrupt is delivered only when the guest is able to accept an interrupt, that is, when RFLAGS.IF is 1 and interrupts are not blocked by STI or by MOV SS.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.6.4 Virtual-interrupt delivery

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

- **Claim.** Virtual-interrupt delivery sets VISR for the delivered vector, copies the vector into SVI, sets VPPR to the vector's priority class, clears the vector's VIRR bit, recomputes RVI from the remaining VIRR bits, and then delivers the interrupt through the guest IDT — all without a VM exit.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** Because delivery happens in VMX non-root operation, the guest's own IDT, TSS and stack switching are used exactly as on bare metal, and the VMM observes nothing.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.6.5 EOI virtualization

```
EOI virtualization:
    Vector <- SVI
    VISR[Vector] <- 0
    if any bit is set in VISR:
        SVI <- highest index of a bit set in VISR
    else:
        SVI <- 0
    perform PPR virtualization                        # 7.6.2
    if EOI_exit_bitmap[Vector] = 1:
        VM exit: virtualized EOI (reason 45), Vector in the exit qualification
    else:
        evaluate pending virtual interrupts           # 7.6.3
```

- **Claim.** EOI virtualization clears the VISR bit for SVI, recomputes SVI, performs PPR virtualization, and exits only if the EOI-exit bitmap has the vector's bit set; that exit is a virtualized-EOI VM exit with basic exit reason 45 and the vector in the exit qualification (see `05-vm-exit.md`).  `[SDM 3C Ch.32]` `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** The EOI-exit bitmap exists so that a VMM can keep the exits it genuinely needs — typically level-triggered interrupts that require de-assertion at a virtual I/O APIC — while every other EOI, the most frequent APIC operation of all, costs nothing.  `[SDM 3C §27.6.8]` `[1]` `C:high` `V:durable`
- **Claim.** EOI virtualization uses SVI rather than the value the guest wrote to VEOI, matching the physical local APIC, where an EOI write dismisses the highest-priority in-service interrupt regardless of the value written.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** Because the exit is taken after VISR and SVI have already been updated, a virtualized-EOI handler must not repeat the dismissal itself; its job is the device-model side effect the vector's bit in the EOI-exit bitmap was set for.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

### 7.6.6 Self-IPI virtualization

```
self-IPI virtualization:
    Vector <- value written to bits 7:0 of VICR_LO (or of the self-IPI register)
    VIRR[Vector] <- 1
    evaluate pending virtual interrupts               # 7.6.3
```

- **Claim.** Self-IPI virtualization sets the requested vector in VIRR and re-evaluates pending virtual interrupts; it requires virtual-interrupt delivery and produces no VM exit.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.6.7 Where the algorithms are invoked

| Trigger | Algorithm run |
|---|---|
| Write to VTPR, or MOV to CR8 | TPR virtualization |
| Write to VEOI, or WRMSR to the x2APIC EOI register | EOI virtualization |
| Self-IPI write to VICR_LO or the self-IPI register | self-IPI virtualization |
| Posted-interrupt processing merges PIR into VIRR | evaluation of pending virtual interrupts |
| VM entry with virtual-interrupt delivery enabled | evaluation, then delivery if the guest can accept |
| Guest becomes able to accept interrupts (STI, POPF, IRET) | delivery of an already-recognized interrupt |

- **Claim.** Evaluation of pending virtual interrupts is re-run after every operation that can change RVI or VPPR — TPR virtualization, EOI virtualization, self-IPI virtualization, posted-interrupt processing and VM entry — which is what removes the need for interrupt-window exiting under APICv.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** With virtual-interrupt delivery enabled a VMM no longer tracks the guest's interruptibility itself: the pending-interrupt and interrupt-window exits that existed to tell the VMM "the guest can take an interrupt now" become unnecessary.  `[SDM 3C Ch.32]` `[1]` `[116]` `C:medium` `V:durable`

---

## 7.7 Virtualize x2APIC mode and the MSR bitmap

In x2APIC mode the local APIC is reached through MSRs rather than MMIO, so there is no APIC-access page to trip over. The equivalent mechanism is a control that redirects the MSR accesses — but only for accesses the MSR bitmap has already let through.

- **Claim.** x2APIC registers occupy MSR indices 800H through 8FFH, and the MSR index maps to the virtual-APIC page offset as offset = (MSR index − 800H) × 16.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** The "virtualize x2APIC mode" VM-execution control virtualizes RDMSR and WRMSR to the x2APIC MSR range, but only for accesses that the MSR bitmaps do not already cause to exit; the VMM must therefore clear the corresponding MSR-bitmap bits for the registers it wants virtualized (`02-vmcs.md` owns the MSR-bitmap layout).  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** In practice a VMM stops intercepting the TPR register in both directions, and additionally the EOI and self-IPI registers once virtual-interrupt delivery is on, and the ICR once IPI virtualization is on; everything else stays intercepted.  `[SDM 3C Ch.32]` `[1]` `[115]` `C:medium` `V:durable`
- **Claim.** "Virtualize x2APIC mode" and "virtualize APIC accesses" are mutually exclusive: if the former is 1 the latter must be 0, and VM entry fails otherwise (entry checks: see `04-vm-entry.md`).  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** WRMSR to an x2APIC register that is virtualized but needs VMM attention produces an APIC-write VM exit (reason 56) in exactly the same way as the MMIO write would, with the offset rather than the MSR index in the exit qualification.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

The MSR-bitmap dependency is the part that bites implementers: "virtualize x2APIC mode" is not a switch that overrides interception, it is a switch that changes what happens to accesses *which are not intercepted*. A VMM that enables the control but leaves the x2APIC range intercepted in the MSR bitmap sees exactly the behaviour it had before, and a VMM that clears interception for a register the hardware does not virtualize has handed the guest direct access to the physical MSR.

- **Claim.** The MSR bitmap is evaluated first: an x2APIC MSR access that the bitmap intercepts produces an ordinary RDMSR or WRMSR VM exit and is never virtualized, regardless of the "virtualize x2APIC mode" setting.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** Getting this pairing wrong is a real security boundary and not merely a performance issue, because clearing interception for a register the hardware does not virtualize exposes the physical register to the guest; the CVE history of this interaction is owned by `15-security.md`.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

---

## 7.8 Posted interrupts

Virtual-interrupt delivery removes the exits on the *receiving* side, but something still has to put the bit into VIRR. If that something is the VMM, a VM exit has happened somewhere — on the sending CPU, or in the host interrupt handler for a passed-through device. Posted interrupts remove that last exit by letting a remote agent record the interrupt in a memory descriptor and poke the target with an ordinary physical interrupt.

```
posting side                              receiving side
------------                              --------------
another vCPU's ICR write   \
IOMMU, for a passed-through  >-- PIR --> notification --> PIR-to-VIRR merge
device's MSI / MSI-X       /   + ON        vector NV         + RVI update
VMM software                                                      |
                                                                  v
                                                  virtual-interrupt delivery (7.6.4)
```

- **Claim.** Posted interrupts split interrupt injection into a memory-side step (record the vector in a descriptor) and a signalling step (send a physical notification interrupt), and the second step can be skipped entirely when a notification is already outstanding or is suppressed.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:high` `V:durable`

### 7.8.1 The posted-interrupt descriptor

| Bits | Field |
|---|---|
| 255:0 | PIR — posted-interrupt requests, one bit per vector |
| 256 | ON — outstanding notification |
| 257 | SN — suppress notification |
| 271:258 | reserved |
| 279:272 | NV — notification vector |
| 287:280 | reserved |
| 319:288 | NDST — notification destination |
| 511:320 | reserved |

- **Claim.** The posted-interrupt descriptor is a 64-byte structure aligned on a 64-byte boundary, referenced by the posted-interrupt descriptor address field of the VMCS.  `[SDM 3C §27.6.8]` `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 255:0 of the posted-interrupt descriptor are the posted-interrupt requests (PIR), a 256-bit vector bitmap with one bit per interrupt vector.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:high` `V:durable`
- **Claim.** Bit 256 of the posted-interrupt descriptor is ON, the outstanding-notification bit: it records that a notification has been sent for interrupts already in PIR but not yet processed.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:high` `V:durable`
- **Claim.** Bit 257 is SN, the suppress-notification bit: when it is 1 a poster records the interrupt in PIR but sends no notification event.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:high` `V:durable`
- **Claim.** Bits 279:272 are NV, the notification vector — the physical interrupt vector used to poke the target logical processor — and bits 319:288 are NDST, the notification destination, which identifies that processor by its physical APIC ID.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:high` `V:durable`
- **Claim.** The descriptor layout is mirrored field for field by the Linux `struct pi_desc`, which declares `pir[8]` followed by a 16-bit notifications word carrying ON and SN, an 8-bit `nv`, and a 32-bit `ndst`, with 64-byte alignment.  `[SDM 3C Ch.32]` `[1]` `[123]` `C:high` `V:durable`

### 7.8.2 Posting and notification

```
poster (another logical processor, or the IOMMU):
    set PIR[Vector]
    if SN = 1:
        done                       # deliberately silent
    if ON was already 1:
        done                       # a notification is already in flight
    set ON
    send an interrupt with vector NV to the processor identified by NDST
```

- **Claim.** A poster sets the vector's bit in PIR and sends a notification interrupt with vector NV to NDST only if SN is 0 and ON was not already set; the ON check is what collapses a burst of postings into a single notification.  `[SDM 3C Ch.32]` `[1]` `[118]` `C:medium` `V:durable`
- **Claim.** The processor performs posted-interrupt processing when "process posted interrupts" is 1 and it receives an interrupt with the notification vector while in VMX non-root operation; the notification interrupt itself causes no VM exit.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry also performs posted-interrupt processing when ON is set, so interrupts posted while the vCPU was not running are picked up at the next entry rather than lost.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

### 7.8.3 The PIR-to-VIRR merge

```
posted-interrupt processing:
    ON <- 0                              # cleared FIRST
    acknowledge the notification interrupt at the local APIC
    tmpPIR <- PIR; PIR <- 0              # atomic read-and-clear
    VIRR <- VIRR OR tmpPIR
    RVI  <- max(RVI, highest index of a bit set in tmpPIR)
    evaluate pending virtual interrupts  # 7.6.3
```

- **Claim.** Posted-interrupt processing clears ON, atomically reads and clears PIR, ORs the read value into VIRR on the virtual-APIC page, raises RVI to the highest vector taken from PIR if that is greater than the current RVI, and then evaluates pending virtual interrupts.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** The merge is the junction between the two halves of the feature: everything before it is posting (done by software or by the IOMMU into memory), everything after it is ordinary virtual-interrupt delivery as described in §7.6.4.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`

### 7.8.4 The ON / SN race

The ordering inside the merge is not incidental — it is the correctness argument, and it is what one-sentence summaries of posted interrupts always drop.

Consider a poster running concurrently with the target's merge. ON is cleared **before** PIR is read, so the window in which a poster can observe stale state is the window between those two steps. A poster that lands in that window sees ON = 0, sets its PIR bit, sets ON, and sends a notification. Two outcomes are possible and both are safe:

1. The poster's PIR bit is written before the target's atomic read-and-clear. The bit is merged into VIRR immediately, and the notification that arrives later finds PIR empty — a spurious notification whose only cost is one merge that moves nothing.
2. The poster's PIR bit is written after the read-and-clear. The bit stays in PIR, ON is set, and the notification the poster sent causes a second round of posted-interrupt processing that picks it up.

Had ON been cleared *after* PIR was read, a poster landing between the read and the clear would have seen ON = 1, skipped the notification, and left its bit in a PIR that the target had just emptied — a lost interrupt.

- **Claim.** Clearing ON before the atomic read-and-clear of PIR is what makes the protocol lossless: the worst case is a redundant notification, never a dropped vector.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** SN exists to shut off notifications while the target vCPU is not in a position to use them; a VMM sets SN when the vCPU is descheduled or is executing in host context, and the interrupts still accumulate in PIR for the next merge.  `[SDM 3C Ch.32]` `[1]` `[120]` `C:medium` `V:durable`
- **Claim.** Setting SN while the CPU runs in host context was measured in KVM to improve `perf bench sched pipe` by 6.56% and to cut posted-interrupt notifications from tens of thousands per second to hundreds, at a cost of about 1.58% on the VM-exit round trip.  `[SDM 3C Ch.32]` `[120]` `C:high` `V:durable`
- **Claim.** A VMM that blocks a vCPU instead repoints NV at a host wake-up vector and NDST at the host CPU, so a posting wakes the vCPU through the host interrupt path rather than being silently absorbed; it must also refuse to block if ON is already set.  `[SDM 3C Ch.32]` `[1]` `[119]` `C:medium` `V:durable`
- **Claim.** With VT-d interrupt posting, the IOMMU rather than a CPU performs the posting step for a passed-through device's MSI or MSI-X, so an external device interrupt reaches a running guest with no VMM involvement at all; the IRTE format that makes this possible is owned by `11-vtd-interrupt-remapping.md`.  `[SDM 3C Ch.32]` `[VT-d 5.20 Ch.5]` `[1]` `[8]` `[118]` `C:high` `V:durable`
- **Claim.** Linux support for VT-d posted interrupts landed as a 25-patch series spanning the IOMMU, KVM and VFIO subsystems in 2014–2015, which is why the feature requires an in-kernel irqchip, APICv and interrupt remapping simultaneously.  `[SDM 3C Ch.32]` `[119]` `C:medium` `V:durable`

---

## 7.9 IPI virtualization and the PID-pointer table

Even with the full APICv stack, a guest sending an IPI still exits: the ICR write needs VMM attention because the hardware has no way to find the target vCPU's descriptor. IPI virtualization supplies exactly that missing lookup.

- **Claim.** IPI virtualization is enabled by a tertiary processor-based VM-execution control; with it, the processor emulates the APIC writes that would send an IPI — memory-mapped ICR writes, MSR-mapped ICR writes and SENDUIPI — by posting directly into the target vCPU's posted-interrupt descriptor. See `02-vmcs.md` for the control bit.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:high` `V:durable`
- **Claim.** The processor locates the target's posted-interrupt descriptor through a PID-pointer table indexed by the target vCPU's APIC ID, addressed by the PID-pointer table address field with its size bounded by the last PID-pointer index field; see `02-vmcs.md`.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:high` `V:durable`
- **Claim.** A PID-pointer table entry carries a valid bit in bit 0 alongside the 64-byte-aligned address of the descriptor, so a VMM can leave entries for vCPUs that do not exist marked invalid.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:medium` `V:durable`
- **Claim.** IPI virtualization covers only physical-addressing, flat-mode, unicast IPIs; logical addressing, broadcast and shorthand forms still produce a trap-like APIC-write VM exit for the VMM to emulate.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:high` `V:durable`
- **Claim.** Once posted, the interrupt follows exactly the path of §7.8: the sending processor sets the PIR bit and sends the notification vector to NDST, and the receiving processor merges PIR into VIRR. IPI virtualization is posted interrupts with the lookup done in hardware.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:high` `V:durable`

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

- **Claim.** Every failure mode of the hardware lookup — an unsupported IPI form, an index beyond the last PID-pointer index, or an invalid table entry — falls back to a trap-like APIC-write VM exit, so a VMM never has to pre-validate what the guest writes to ICR.  `[SDM 3C Ch.32]` `[1]` `[117]` `C:medium` `V:durable`
- **Claim.** Intel's kernel-side measurements reported IPI cycle counts falling 22.21% in xAPIC mode and 15.98% in x2APIC mode on a 2-vCPU microtest, 9.73% on a unicast-IPI benchmark, and hackbench runtime falling 18.8% at 8 vCPUs and 18.2% at 96 vCPUs.  `[SDM 3C Ch.32]` `[117]` `C:high` `V:durable`

---

## 7.10 Control dependencies

APICv controls cannot be set independently; VM entry enforces a dependency lattice. `04-vm-entry.md` owns the complete check list and `02-vmcs.md` owns the bit positions — what matters here is the shape of the dependency.

- **Claim.** If "use TPR shadow" is 0, then "virtualize x2APIC mode", "APIC-register virtualization", "virtual-interrupt delivery" and "IPI virtualization" must all be 0; see `04-vm-entry.md`.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** "Virtual-interrupt delivery" requires "external-interrupt exiting" to be 1, because the processor must own the physical interrupt path in order to arbitrate between physical and virtual interrupts; see `04-vm-entry.md`.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** "Process posted interrupts" requires "virtual-interrupt delivery" and "acknowledge interrupt on exit" to be 1, a notification vector whose bits 15:8 are 0, and a 64-byte-aligned posted-interrupt descriptor address; see `04-vm-entry.md`.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`
- **Claim.** "Use TPR shadow" also requires a valid 4-KByte-aligned virtual-APIC address, since every layer above it reads and writes that page.  `[SDM 3C §27.6.8]` `[1]` `C:medium` `V:durable`

---

## 7.11 Chapter artifact index

| Object | Reached through | Exit reason it can produce |
|---|---|---|
| VTPR and the TPR threshold | virtual-APIC address (2012H), TPR threshold (401CH) | 43 TPR below threshold |
| APIC-access page | APIC-access address (2014H) | 44 APIC access |
| Virtual-APIC page, write path | virtual-APIC address (2012H) | 56 APIC write |
| EOI-exit bitmap | 201CH–2022H | 45 virtualized EOI |
| RVI / SVI | guest interrupt status (0810H) | — (no exit; drives delivery) |
| Posted-interrupt descriptor | posted-interrupt descriptor address (2016H), notification vector (0002H) | — (no exit) |
| PID-pointer table | PID-pointer table address, last PID-pointer index | 56 APIC write on fallback |

- **Claim.** The four APIC-related basic exit reasons a VMM must handle are 43 (TPR below threshold), 44 (APIC access), 45 (virtualized EOI) and 56 (APIC write); see `05-vm-exit.md` for the complete list.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** A correctly configured full APICv stack leaves the first three of those as rare events and reduces the fourth to writes with side effects the VMM genuinely has to model, such as LVT and I/O APIC interactions.  `[SDM 3C Ch.32]` `[1]` `[122]` `C:medium` `V:durable`

---

## 7.12 Open items

- **Claim.** The FlexPriority first-generation question stated in §7.2 is unresolved and is recorded here for adjudication in `errata.md`; no claim in this chapter depends on the answer.  `[SDM 3C Ch.32]` `[121]` `C:low` `V:durable`
- **Claim.** AMD's AVIC is the corresponding facility on the other vendor and differs in that its virtual APIC state lives in an AVIC backing page referenced from the VMCB and its remote injection uses a doorbell MSR rather than a descriptor; the comparison is owned by `18-comparison-amd-arm-riscv.md`.  `[SDM 3C Ch.32]` `[1]` `C:medium` `V:durable`

Facts deliberately **not** stated in this chapter because they could not be anchored with confidence: the complete enumeration of which APIC register offsets APIC-register virtualization services for reads; the exact bit encodings of the APIC-access exit-qualification access types (owned by `05-vm-exit.md` in any case); the VMCS encodings of the PID-pointer table address and last PID-pointer index; the bit layout of PID-pointer table entries beyond the valid bit; and the details of the APIC-timer virtualization controls introduced in §27.6.27.
