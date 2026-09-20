# 07. Virtual Interrupts and AVIC

> **中文速览**：本章覆盖中断虚拟化的两条路径：软件路径（VMCB 偏移 60h 虚拟中断控制字的逐位定义、虚拟中断的评估与投递、vGIF、NMI 虚拟化）与硬件路径（AVIC 的 vAPIC backing page、physical/logical APIC ID 表、doorbell MSR、x2AVIC，以及 AVIC 相关的两个退出）。**AMD 手册里没有 `INT_CTL` 这个名字**——它是 KVM 的叫法，正文一律用 AMD 的 "virtual interrupt control word at offset 60h"。AVIC 与 IOMMU 的 GA 协作只在 `10-iommu-interrupt-remapping.md` 讲一次，本章只给 CPU 侧接口。事件注入的字段布局在 `05-exit-decoding.md`，STGI/CLGI 的指令语义在 `04-world-switch.md`。

**Maps to:** APM Vol.2 §15.21 "Interrupt and Local APIC Support" (15.21.1–15.21.10) + §15.29 "Advanced Virtual Interrupt Controller" (15.29.1–15.29.10, incl. 15.29.10 x2AVIC) + §15.17 (GIF) + §15.33.2 (Virtual GIF) + App.B Table B-1; CPUID in APM Vol.3 App.E [1][2]
**Owns:** every bit of the offset-60h virtual interrupt control word · virtual-interrupt evaluation and delivery · vGIF on the mechanism side · AVIC and x2AVIC · the doorbell MSR · the two AVIC exits
**Scope:** OS-independent hardware — AVIC is enumerated per part by CPUID and its use is firmware- and hypervisor-dependent; the default-state history belongs to `90-dated-landscape.md`.
**See also:** `02-vmcb.md` (VMCB offsets, INTERRUPT_SHADOW, clean bits) · `03-intercepts.md` (VINTR, NMI and INTR intercept bits) · `04-world-switch.md` (STGI/CLGI instruction semantics) · `05-exit-decoding.md` (EVENTINJ, EXITINTINFO, the exit-code table) · `10-iommu-interrupt-remapping.md` (IRTE, GA log, GAPPI) · `14-sev-snp.md` (Secure AVIC)

---

## 7.1 The INT_CTL field

`INT_CTL` is the Linux/KVM name. AMD calls the quadword at offset 060h of the VMCB control area the **virtual interrupt control word**, and the encrypted copy carried in a SEV-ES/SEV-SNP VMSA is called **VIntrCtrl**. Both spellings describe the same bits; this chapter uses AMD's field names throughout so that a reader holding the manual open finds the same tokens.

- **Claim.** The architectural name for the quadword at offset 060h of the VMCB control area — whose overall map is `02-vmcb.md`'s — is the *virtual interrupt control word*; the token `INT_CTL` does not occur anywhere in APM Vol.2 Rev 3.45 and is the Linux/KVM identifier for the same field.  `[APM2 §15.29.4.1]` `[1]` `[240]` `C:high` `V:durable`
- **Claim.** Every bit of the field is defined in one place — Table B-1's rows for byte offsets 060h and 060h (continued) — and the layout below is that table verbatim.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Ownership note: the surrounding control-area map, the `INTERRUPT_SHADOW` field at offset 068h and the clean-bit encodings that cover offsets 060h–067h and the AVIC pointers belong to `02-vmcb.md`; this chapter owns only the meaning of the bits.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

### 7.1.1 Bit layout of offset 060h

| Bit(s) | AMD field name | Meaning |
|---|---|---|
| 7:0 | `V_TPR` | The virtual TPR for the guest. **Bits 3:0 carry the 4-bit value; bits 7:4 are SBZ.** |
| 8 | `V_IRQ` | If nonzero, a virtual INTR is pending. |
| 9 | `VGIF` | Virtual GIF. |
| 10 | *(unassigned in Table B-1)* | No row; see 7.1.2. |
| 11 | `V_NMI` | If nonzero, a virtual NMI is pending. |
| 12 | `V_NMI_MASK` | If nonzero, virtual NMIs are masked. |
| 15:13 | — | RESERVED, SBZ |
| 19:16 | `V_INTR_PRIO` | Priority for the virtual interrupt. |
| 20 | `V_IGN_TPR` | If nonzero, the current virtual interrupt ignores the (virtual) TPR. |
| 23:21 | — | RESERVED, SBZ |
| 24 | `V_INTR_MASKING` | Virtualize masking of INTR interrupts. |
| 25 | `VGIF_EN` | Virtual GIF Enable. |
| 26 | `V_NMI_ENABLE` | NMI Virtualization Enable. |
| 29:27 | — | RESERVED, SBZ |
| 30 | x2AVIC Enable | x2APIC MSR-interface virtualization enable. |
| 31 | AVIC Enable | Per-virtual-processor AVIC enable. |
| 39:32 | `V_INTR_VECTOR` | Vector to use for the virtual interrupt. |
| 63:40 | — | RESERVED, SBZ |

- **Claim.** `V_TPR` occupies **bits 7:0**, not bits 3:0: Table B-1 defines the field as eight bits wide and states that only bits 3:0 hold the 4-bit virtual TPR value while bits 7:4 are SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `V_IRQ` is bit 8, `VGIF` bit 9, `V_NMI` bit 11 and `V_NMI_MASK` bit 12; bits 15:13 are RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `V_INTR_PRIO` is bits 19:16 and `V_IGN_TPR` is bit 20; bits 23:21 are RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `V_INTR_MASKING` is bit 24, `VGIF_EN` bit 25 and `V_NMI_ENABLE` bit 26; bits 29:27 are RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** x2AVIC Enable is bit 30 and AVIC Enable is bit 31 — in that order, with the enable for the newer feature *below* the enable for the older one.  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** `V_INTR_VECTOR` is bits 39:32, so the field crosses into the second doubleword of the quadword; bits 63:40 are RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The AMD spellings are `VGIF` and `VGIF_EN`, not `V_GIF` / `V_GIF_ENABLE`, and the two enables at bits 30 and 31 are written in prose as "x2AVIC Enable" and "AVIC Enable" rather than as underscored identifiers.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

### 7.1.2 The gap at bit 10

Table B-1 lists a row for bit 9 and then a row for bit 11; its reserved rows are 15:13, 23:21, 29:27 and 63:40. Bit 10 is covered by none of them.

- **Claim.** Table B-1 assigns no name and no reserved range to **bit 10** of the offset-060h word — the table jumps from bit 9 to bit 11 and its next reserved row begins at bit 13.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The bit is not unused: under Alternate Injection, bit 10 of the *encrypted* VIntrCtrl field is defined as the `INT_SHADOW` bit, and the unencrypted interrupt-shadow bit at offset 068h bit 0 is then ignored. That mechanism is owned by `14-sev-snp.md`.  `[APM2 §15.36.16]` `[1]` `C:high` `V:durable`

### 7.1.3 What V_INTR_MASKING changes

- **Claim.** With `V_INTR_MASKING` cleared to 0, guest `EFLAGS.IF` controls both virtual and physical interrupts.  `[APM2 §15.21.1]` `[1]` `C:high` `V:durable`
- **Claim.** With `V_INTR_MASKING` set to 1, the host `EFLAGS.IF` value captured at VMRUN controls physical interrupts for the duration of guest execution, and the guest's own `EFLAGS.IF` controls virtual interrupts only.  `[APM2 §15.21.1]` `[1]` `C:high` `V:durable`
- **Claim.** `V_TPR` is loaded from the VMCB by VMRUN and written back by `#VMEXIT`; the physical APIC's TPR always governs physical interrupts and `V_TPR` always governs virtual interrupts.  `[APM2 §15.21.2]` `[1]` `C:high` `V:durable`
- **Claim.** With `V_INTR_MASKING` = 0, writes to CR8 affect both the APIC TPR and `V_TPR`, and CR8 reads behave as they would without SVM; with `V_INTR_MASKING` = 1, CR8 writes affect only `V_TPR` and CR8 reads return `V_TPR`.  `[APM2 §15.21.2]` `[1]` `C:high` `V:durable`
- **Claim.** On `#VMEXIT` the processor clears its internal copies of `V_IRQ` and `V_INTR_MASKING`, so a pending virtual interrupt cannot leak into host execution and interrupt control reverts to normal.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`

### 7.1.4 TPR access from 32-bit code

- **Claim.** The CR8-based TPR virtualization of §15.21.2 reaches only CR8 accesses; in 32-bit mode the TPR is traditionally reached through its memory-mapped register, which a VMM classically virtualizes by leaving the APIC page unmapped and emulating on the resulting `#PF` intercept.  `[APM2 §15.21.3]` `[1]` `C:high` `V:durable`
- **Claim.** SVM therefore exposes CR8 to 32-bit code through an alternate encoding of MOV TO/FROM CR8 — MOV TO/FROM CR0 carrying a LOCK prefix — and those encodings are available in both 64-bit and 32-bit mode **even when SVM is disabled in `EFER.SVME`**.  `[APM2 §15.21.3]` `[1]` `C:high` `V:durable`

## 7.2 Evaluating and delivering a virtual interrupt

A virtual INTR is not a queued message. It is a *state* described by three fields — `V_IRQ`, `V_INTR_PRIO` and `V_INTR_VECTOR` — which VMRUN loads into on-chip registers and which the processor re-evaluates continuously while the guest runs.

- **Claim.** `V_IRQ`, `V_INTR_PRIO` and `V_INTR_VECTOR` together state whether a virtual interrupt is pending and, if so, its vector number and priority; VMRUN loads this information into corresponding on-chip registers.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** The processor takes a virtual INTR only when all four of the following hold: `V_IRQ` and `V_INTR_PRIO` indicate a pending virtual interrupt whose priority is **strictly greater** than `V_TPR`; interrupts are enabled in `EFLAGS.IF`; virtual interrupts are enabled with `VGIF`; and the processor is not in an interrupt shadow.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** The only behavioural difference from a physical interrupt is the vector's origin: it comes from the `V_INTR_VECTOR` register rather than from an INTACK cycle to the local APIC.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** Setting `V_IGN_TPR` declares that the currently pending virtual interrupt is not subject to TPR masking; the priority comparison against `V_TPR` is then omitted. AMD names ExtINT-type injection as the intended use.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** When the processor dispatches a virtual interrupt through the IDT, `V_IRQ` is cleared **after** the check for virtual-interrupt intercepts and **before** the IDT is accessed; on `#VMEXIT` `V_IRQ` is written back to the VMCB so the VMM can tell whether the interrupt was taken.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** Physical interrupts take priority over virtual interrupts, whether the physical interrupt is taken directly or through a `#VMEXIT`.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`

### 7.2.1 Virtual interrupts versus EVENTINJ

The two mechanisms are not alternatives on the same axis. `EVENTINJ` is an *unconditional* delivery performed by VMRUN; a virtual interrupt is a *pending condition* the guest may or may not become eligible to take.

- **Claim.** An event injected through `EVENTINJ` is delivered by VMRUN unconditionally before the guest executes its first instruction, and injected events are not subject to intercept checks — although secondary exceptions raised while delivering one are. The field layout lives in `05-exit-decoding.md`.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** A virtual INTR, by contrast, is gated on `EFLAGS.IF`, the `V_TPR` comparison, `VGIF` and the interrupt shadow, so a VMM that needs guaranteed delivery at VMRUN uses `EVENTINJ` and one that needs the guest's own masking respected uses `V_IRQ`.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`
- **Claim.** When NMI Virtualization is enabled and `EVENTINJ` is used to inject an NMI, VMRUN sets `V_NMI_MASK` in the guest state — the injected NMI therefore participates in the virtualized masking state machine rather than bypassing it.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`

### 7.2.2 Interrupt shadows and the VINTR intercept

- **Claim.** The x86 interrupt shadow is a single-instruction window in which interrupts are not recognized — the classic case being the instruction after an `STI` that raises `EFLAGS.IF` — and the VMCB `INTERRUPT_SHADOW` field records whether the guest is currently inside one. It is saved on `#VMEXIT` and loaded on VMRUN.  `[APM2 §15.21.5]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM that needs control at the moment the guest becomes able to take a virtual interrupt enables the **VINTR intercept**; the intercept fires just before the guest takes the virtual interrupt, with the interrupt still pending in the VMCB `V_IRQ` field.  `[APM2 §15.21.6]` `[1]` `C:high` `V:durable`
- **Claim.** AMD states that VINTR is not required for ordinary fixed local-APIC interrupts and names its real uses as emulating ExtINT delivery mode — which TPR does not mask — and legacy PICs in auto-EOI mode. The intercept bit position and its exit code are owned by `03-intercepts.md` and `05-exit-decoding.md`.  `[APM2 §15.21.6]` `[1]` `C:high` `V:durable`

### 7.2.3 NMI virtualization

- **Claim.** NMI Virtualization is enumerated by `CPUID Fn8000_000A_EDX[VNMI]` = bit 25.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** It is enabled by setting `V_NMI_ENABLE`, bit 26 of the word at offset 60h, and **requires the NMI intercept bit to be set**: running a guest with `V_NMI_ENABLE` and no NMI intercept produces `#VMEXIT(INVALID)`.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`
- **Claim.** Once NMI Virtualization is on, the NMI intercept applies to **physical** NMIs only, not to virtual ones.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`
- **Claim.** The processor takes a virtual NMI when virtual NMIs are not masked, virtual interrupts are enabled with `VGIF`, and the processor is not in an interrupt shadow; on recognition it clears `V_NMI` and sets `V_NMI_MASK` before the IDT is accessed.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`
- **Claim.** `V_NMI_MASK` is cleared when the guest completes an `IRET`, and also when a `#VMEXIT` occurs while the virtual NMI is being delivered — in that case `EXITINTINFO` is set appropriately and `V_NMI_MASK` is **saved as 0**. That field's layout is in `05-exit-decoding.md`.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`
- **Claim.** Physical NMI takes priority over virtual NMI, mirroring the INTR rule.  `[APM2 §15.21.10]` `[1]` `C:high` `V:durable`

### 7.2.4 Masking in the local APIC, and INIT

- **Claim.** SVM adds a **256-bit IER (interrupt enable) register** to the local APIC that resets to all ones, is read/write through the memory-mapped APIC page, and restricts which vectors participate in the APIC's highest-priority-pending computation — so one guest cannot block another's interrupts by never servicing its own.  `[APM2 §15.21.7]` `[1]` `C:high` `V:durable`
- **Claim.** SVM also lets the VMM issue *specific* end-of-interrupt commands to the local APIC, clearing pending interrupts in any order rather than always the highest-priority one.  `[APM2 §15.21.7]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM can have INIT redirected into a `#SX` exception by setting `R_INIT` in the `VM_CR` MSR, which lets it scrub sensitive context before re-asserting INIT without redirection; the INIT and `#SX` machinery itself is owned by `04-world-switch.md`.  `[APM2 §15.21.8]` `[1]` `C:high` `V:durable`

## 7.3 The virtual global interrupt flag

The GIF is the master gate. §15.17 defines what GIF = 0 actually blocks, and §15.33.2 defines the virtualized copy that lets a nested guest run `STGI`/`CLGI` without exiting.

### 7.3.1 What GIF = 0 masks

- **Claim.** With GIF = 0 the processor **holds pending** INIT, NMI, external SMI, INTR and vINTR until GIF becomes 1.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** With GIF = 0 a debug exception or trap caused by a breakpoint-register match, and an internal (I/O trapping) SMI, are **ignored and discarded** rather than held. This asymmetry is the point of the flag.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** RESET, a debug trace trap due to `EFLAGS.TF`, A20M and the non-architecturally-visible implementation signals continue to operate normally with GIF = 0.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** A machine check with GIF = 0 is held pending until GIF = 1 **if the implementation can**, and otherwise causes shutdown — AMD leaves this implementation-dependent.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** `#SX` is marked "n/a" for GIF = 0 because it can only arise from a redirected INIT, and the redirection happens only when GIF = 1 — with GIF = 0 the INIT is simply held.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`

### 7.3.2 vGIF

- **Claim.** Virtual GIF support is indicated by `CPUID Fn8000_000A_EDX[VGIF]` = bit 16.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`
- **Claim.** Virtual GIF is enabled by setting `VGIF_EN`, bit 25 of the word at offset 60h; the virtual flag `VGIF` itself is bit 9, loaded on VMRUN and saved on `#VMEXIT`.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`
- **Claim.** Virtual interrupts are masked when `VGIF` is 0 and may be taken when `VGIF` is 1 — `VGIF` gates the *virtual* interrupt path, whereas the real GIF gates the physical one.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`
- **Claim.** When Virtual GIF is enabled and the STGI/CLGI intercepts are clear, the guest executes `STGI` and `CLGI` itself and they set or clear `VGIF` respectively; the instruction-side semantics are owned by `04-world-switch.md`.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`
- **Claim.** Setting the STGI or CLGI intercept bits intercepts those instructions **regardless of whether Virtual GIF is enabled** — vGIF does not override an explicit intercept.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`

## 7.4 AVIC: the backing page

AVIC replaces per-access emulation of the local APIC with a per-virtual-processor page of memory plus a permissions filter in front of it.

- **Claim.** AVIC presents each guest with a virtual interrupt controller compliant with the local APIC architecture, and accelerates two things only: guest access to performance-critical APIC registers, and the initiation of intra- and inter-processor interrupts. Acceleration of *device* interrupt delivery is explicitly not addressed by AVIC hardware and is the IOMMU's job — see `10-iommu-interrupt-remapping.md`.  `[APM2 §15.29.1]` `[1]` `C:high` `V:durable`
- **Claim.** AVIC is enumerated by `CPUID Fn8000_000A_EDX[AVIC]` = bit 13.  `[APM2 §15.29.7]` `[1]` `C:high` `V:durable`
- **Claim.** AVIC is enabled per virtual processor by bit 31 of the word at offset 60h, and **any guest configured to use AVIC must also enable nested paging**.  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Enabling AVIC implicitly disables `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR` and `V_INTR_VECTOR` — the software virtual-interrupt path of 7.2 is switched off, and §15.29.8.3 repeats that those fields are ignored on VMRUN when AVIC mode is on.  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Enabling AVIC also changes CR8 behaviour **independently of `V_INTR_MASKING`**: CR8 writes update `V_TPR` and the backing page, and CR8 reads return `V_TPR`.  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`

### 7.4.1 Where the page lives, and how it is found

- **Claim.** The guest sees its vAPIC image in guest physical address space; that image is backed by a page in system physical address (sPA) space called the **vAPIC backing page**, which stays pinned for the lifetime of the virtual machine even while the virtual processor is not running, because some fields are updated when the guest is not running.  `[APM2 §15.29.2]` `[1]` `C:high` `V:durable`
- **Claim.** System software must install a nested-page-table translation granting the guest read and write permission for the backing page. AVIC hardware walks the nested page table **to check permissions only** and does not use the system physical address from the leaf entry — it takes the address from the `AVIC APIC_BACKING_PAGE` pointer in the VMCB instead.  `[APM2 §15.29.3]` `[1]` `C:high` `V:durable`
- **Claim.** System firmware initializes the guest vAPIC base and `V_APIC_BAR` to FEE0_0000h; if the guest relocates its APIC by writing the APIC Base Address Register (MSR 0000_001Bh), the VMM should intercept that write and update both `V_APIC_BAR` and the guest-physical side of the nested-page-table mapping.  `[APM2 §15.29.3]` `[1]` `C:high` `V:durable`

### 7.4.2 The VMCB fields — real names and real offsets

| Byte offset | Table B-1 name | §15.29.4.2 name | Field |
|---|---|---|---|
| 098h | `AVIC APIC_BAR` | `V_APIC_BAR` | bits 51:0; 63:52 RESERVED, SBZ |
| 0E0h | `AVIC APIC_BACKING_PAGE Pointer` | `APIC_BACKING_Page Pointer` | bits 51:0; 63:52 RESERVED, SBZ |
| 0F0h | `AVIC LOGICAL_TABLE Pointer` | `Logical APIC Table Pointer` | bits 51:12; 11:0 and 63:52 reserved |
| 0F8h | `AVIC PHYSICAL_TABLE Pointer[51:12]` | `Physical APIC Table Pointer` | bits 51:12; 63:52 reserved |
| 0F8h | `AVIC_PHYSICAL_MAX_INDEX` | same | bits 11:0 |

- **Claim.** `V_APIC_BAR` sits at byte offset **098h**, and not at 038h: Table B-1 puts `AVIC APIC_BAR` in bits 51:0 of offset 098h and §15.29.4.2 gives the same offset in prose.  `[APM2 §15.29.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** The backing-page pointer is at offset 0E0h, the Logical APIC Table pointer at 0F0h and the Physical APIC Table pointer at 0F8h; §15.29.4.2 describes each as a 52-bit system physical address (sPA) pointer.  `[APM2 §15.29.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** `AVIC_PHYSICAL_MAX_INDEX` shares offset 0F8h with the physical-table pointer, occupying bits 11:0, and holds the index of the last guest physical core ID for the guest.  `[APM2 §15.29.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** AMD's own names are `AVIC APIC_BACKING_PAGE Pointer`, `AVIC LOGICAL_TABLE Pointer` and `AVIC PHYSICAL_TABLE Pointer`; the forms `AVIC_LOGICAL_PAGE` and `AVIC_PHYSICAL_PAGE` appear nowhere in the manual and must not be used.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** All four pointers are evaluated on VMRUN, must lie in legal implementation-supported physical address ranges, must be mapped write-back cacheable, and cause a `#VMEXIT` if they are out of range. All point to 4-Kbyte-aligned structures, so bits 11:0 are reserved and should be zero — **except at offset 0F8h**, where those bits are `AVIC_PHYSICAL_MAX_INDEX`.  `[APM2 §15.29.4.3]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN fails with `#VMEXIT(VMEXIT_INVALID)` if `AVIC_PHYSICAL_MAX_INDEX` exceeds **255 in xAVIC mode**, or exceeds **511 in x2AVIC mode when `CPUID Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) is 0**.  `[APM2 §15.29.4.3]` `[1]` `C:high` `V:durable`
- **Claim.** With xAVIC enabled on a multi-vCPU VM, when the VMM schedules a vCPU on a core that last ran a *different* vCPU of the same VM — **regardless of the ASID values** — it must flush the TLB on that VMRUN using a `TLB_CONTROL` value of 3h, or stale mappings may misdirect virtual APIC accesses to the previous vCPU's backing page. Those encodings are owned by `06-nested-paging.md`.  `[APM2 §15.29.4.3]` `[1]` `C:high` `V:durable`

### 7.4.3 Register access behaviour

AMD defines **three** filter outcomes, not four. "Accelerated by AVIC" is a sub-case of *Allow* that appears in the behaviour column of Table 15-22, and is not a fourth filter verdict.

- **Claim.** The register-level permissions filter handles an attempted guest access in one of three ways: **Allow** (the backing-page access completes, and in certain cases a write additionally triggers a hardware acceleration action), **Fault** (an SVM intercept before the access, causing a `#VMEXIT`), or **Trap** (an SVM intercept immediately after the access completes, causing a `#VMEXIT`).  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** Accesses to register locations not listed in Table 15-22 are allowed to read and write the backing page, and reads or writes inside the backing page but outside the defined vAPIC register offsets complete normally.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** All vAPIC registers are 32 bits wide at 16-byte-aligned offsets; the result of reading or writing any byte in `[register_offset + 4 : register_offset + 15]` is **undefined**.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`

The table below is Table 15-22 in full. The two behaviour columns are identical for xAVIC and x2AVIC unless the row says otherwise.

| xAPIC offset | x2APIC MSR | Register | Read | Write |
|---|---|---|---|---|
| 20h | 802h | APIC ID | Allowed | `#VMEXIT` (trap) |
| 30h | 803h | APIC Version | Allowed | `#VMEXIT` (fault) |
| 80h | 808h | Task Priority (TPR) | Allowed | **Accelerated by AVIC** |
| 90h | 809h | Arbitration Priority (APR) | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| A0h | 80Ah | Processor Priority (PPR) | Allowed | `#VMEXIT` (fault) |
| B0h | 80Bh | End of Interrupt (EOI) | Allowed | **Accelerated** for edge-triggered; `#VMEXIT` (trap) for level-triggered |
| C0h | — | Remote Read | Allowed | `#VMEXIT` (trap) |
| D0h | 80Dh | Logical Destination | Allowed | `#VMEXIT` (trap) |
| E0h | — | Destination Format | Allowed | `#VMEXIT` (trap) |
| F0h | 80Fh | Spurious Interrupt Vector | Allowed | `#VMEXIT` (trap) |
| 100h–170h | 810h–817h | In-Service (ISR) | Allowed | `#VMEXIT` (fault) |
| 180h–1F0h | 818h–81Fh | Trigger Mode (TMR) | Allowed | `#VMEXIT` (fault) |
| 200h–270h | 820h–827h | Interrupt Request (IRR) | Allowed | `#VMEXIT` (fault) |
| 280h | 828h | Error Status (ESR) | Allowed | `#VMEXIT` (trap) |
| 300h | 830h | Interrupt Command Low (ICRL) | Allowed | **Accelerated by AVIC**, or `#VMEXIT` (trap) for advanced functions |
| 310h | — | Interrupt Command High (ICRH) | Allowed (xAVIC) | Allowed (xAVIC) |
| 320h | 832h | Timer LVT | Allowed | `#VMEXIT` (trap) |
| 330h | 833h | Thermal LVT | Allowed | `#VMEXIT` (trap) |
| 340h | 834h | Performance Counter LVT | Allowed | `#VMEXIT` (trap) |
| 350h | 835h | Local Interrupt 0 LVT | Allowed | `#VMEXIT` (trap) |
| 360h | 836h | Local Interrupt 1 LVT | Allowed | `#VMEXIT` (trap) |
| 370h | 837h | Error LVT | Allowed | `#VMEXIT` (trap) |
| 380h | 838h | Timer Initial Count | Allowed | `#VMEXIT` (trap) |
| 390h | 839h | Timer Current Count | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| 3E0h | 83Eh | Timer Divide Configuration | Allowed | `#VMEXIT` (trap) |
| — | 83Fh | Self IPI (x2APIC only) | — | Allowed (x2AVIC) |
| 400h | 840h | Extended APIC Feature | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| 410h | 841h | Extended APIC Control | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| 420h | 842h | Specific EOI (SEOI) | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| 480h–4F0h | 848h–84Fh | Interrupt Enable (IER) | `#VMEXIT` (fault) | `#VMEXIT` (fault) |
| 500h–570h | 850h–857h | Extended Interrupt [7:0] LVT | Allowed if `EDX[27]`=1, else `#VMEXIT` (fault) | trap if `EDX[27]`=1, else `#VMEXIT` (fault) |
| 580h–FFFh | — | Reserved | `#VMEXIT` (fault) | `#VMEXIT` (fault) |

- **Claim.** The table above reproduces Table 15-22 including its x2APIC MSR column; ICRH has no separate x2APIC MSR because x2APIC folds ICRL and ICRH into the single 64-bit ICR MSR at 830h.  `[APM2 Table 15-22]` `[1]` `C:high` `V:durable`
- **Claim.** The Extended Interrupt LVT rows at 500h–570h / 850h–857h are the only conditional rows: they are Read-Allowed / Write-trap when `CPUID Fn8000_000A_EDX[27]` is 1 and fault in both directions when it is 0. Vol.3 names that bit `ExtLvtAvicAccessChg`.  `[APM2 Table 15-22]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`
- **Claim.** Note the trap/fault asymmetry that a VMM must respect: ISR, TMR and IRR writes **fault** (intercepted before the write lands) while ESR and the LVT writes **trap** (intercepted after), so the backing page already holds the new value when an LVT exit is taken but not when an IRR exit is.  `[APM2 Table 15-22]` `[1]` `C:high` `V:durable`
- **Claim.** The 256-bit IER of §15.21.7 is reachable through the backing page only by exiting: Table 15-22 marks IER at xAPIC 480h–4F0h / x2APIC 848h–84Fh as fault on both read and write, so under AVIC the VMM, not the guest, owns it.  `[APM2 Table 15-22]` `[1]` `C:high` `V:durable`

### 7.4.4 The registers with hardware side effects

- **Claim.** On a guest TPR write the value lands in the backing page and hardware copies the **upper 4 bits** into `V_TPR` in the VMCB; all TPR reads return the backing-page value, and TPR accesses made through MOV CR8 update both the backing page and `V_TPR`.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** CR8 and `V_TPR` do not share the APIC TPR's format: only the Task Priority bits are kept, in bits 3:0 of CR8 and `V_TPR`, and the Task Priority Subclass is not stored. A memory-mapped TPR write updates bits 3:0 of CR8 and `V_TPR`; a CR8 write updates backing-page TPR bits 7:4 and zeroes bits 3:0.  `[APM2 Figure 15-16]` `[1]` `C:high` `V:durable`
- **Claim.** A guest PPR write causes a `#VMEXIT` **without** updating the backing page. Hardware owns the PPR value, refreshing it in the backing page whenever the TPR or the highest in-service interrupt changes, and uses it to gate virtual-interrupt delivery. PPR reads are allowed.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** A guest EOI write makes AVIC hardware clear the highest-priority in-service (ISR) bit in the backing page and re-evaluate whether another pending interrupt should be delivered; if that highest-priority in-service interrupt is level-mode in the corresponding TMR bit, the EOI write instead causes a `#VMEXIT` so the VMM can emulate level-triggered behaviour.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** ICRL writes are accelerated only when the Message Type is Fixed **and** the Trigger Mode is edge-triggered; self and broadcast delivery via the ICRL Destination Shorthand (DSH) field are also supported, in both logical and physical APIC ID formats. Every other IPI type causes a `#VMEXIT`.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** ICRH writes are simply allowed, because writing ICRH has no immediate hardware side effect — the IPI is initiated by the ICRL write.  `[APM2 §15.29.3.1]` `[1]` `C:high` `V:durable`

## 7.5 AVIC: the physical and logical APIC ID tables

- **Claim.** AVIC defines three memory-resident structures — the vAPIC backing page, the Physical APIC ID Table and the Logical APIC ID Table — each defined to fit exactly one 4-Kbyte page, with AMD reserving the right for future implementations to expand the size.  `[APM2 §15.29.5]` `[1]` `C:high` `V:durable`
- **Claim.** There is one backing page per virtual processor but **one Physical APIC ID Table and one Logical APIC ID Table per virtual machine**, so the two table pointers hold the same value in every VMCB of the VM.  `[APM2 §15.29.5.2]` `[1]` `C:high` `V:durable`

### 7.5.1 Physical APIC ID Table entry

Indexed by guest physical APIC ID. 64 bits per entry.

| Bit(s) | Field | Description |
|---|---|---|
| 63 | `V` | Valid. Set = this entry holds a valid backing-page pointer. |
| 62 | `IR` | IsRunning. The vCPU is currently scheduled by the VMM on a physical core. |
| 61:52 | — | Reserved, SBZ |
| 51:12 | Backing Page Pointer | 4-Kbyte-aligned system physical address of this vCPU's vAPIC backing page. |
| 11:0 | Host Physical APIC ID | Physical APIC ID of the core hosting the vCPU. **Not valid unless `IR` is set.** |

- **Claim.** The Physical APIC ID Table entry is laid out as above: `V` at bit 63, `IR` (IsRunning) at bit 62, reserved 61:52, Backing Page Pointer at 51:12 and Host Physical APIC ID at 11:0.  `[APM2 Table 15-23]` `[1]` `C:high` `V:durable`
- **Claim.** `IR` means only that the VMM has assigned a physical core to the vCPU; it does not distinguish a core currently executing guest software from one that has suspended guest execution and is in host mode.  `[APM2 §15.29.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** The table may be populated sparsely, using the valid bit to mark assigned IDs, and the index of the last valid entry is what `AVIC_PHYSICAL_MAX_INDEX` records.  `[APM2 §15.29.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** With `CPUID Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) = 0 the table is fixed at 4 Kbytes, allowing at most **512** virtual processors per VM; with the bit set it may span up to **eight consecutive 4-Kbyte pages**, the page count being `AVIC_PHYSICAL_MAX_INDEX[11:9] + 1`.  `[APM2 §15.29.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** Vol.3 describes `x2AVIC_EXT` as "4096 vCPUs supported in x2AVIC mode", which is the eight-page table restated as a vCPU count.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** In **xAVIC** mode the Physical APIC ID table occupies only the lower half of its 4-Kbyte page — 256 eight-byte entries — and physical APIC ID FFh is reserved because FFh means broadcast; the upper 2048 bytes are reserved and should be set to zero.  `[APM2 Figure 15-18]` `[1]` `C:high` `V:durable`

### 7.5.2 Logical APIC ID Table entry

Indexed by logical ID. 32 bits per entry.

| Bit(s) | Field | Description |
|---|---|---|
| 31 | `V` | Valid. Set = this entry holds a valid physical APIC ID. |
| 30:8 | — | Reserved, SBZ |
| 7:0 | Guest Physical APIC ID | The guest physical APIC ID selected when logically addressed. |

- **Claim.** The Logical APIC ID Table entry is `V` at bit 31, reserved 30:8, and Guest Physical APIC ID at bits 7:0.  `[APM2 Table 15-24]` `[1]` `C:high` `V:durable`
- **Claim.** The table maps a logically addressed interrupt to a guest physical APIC ID, one entry per logically addressed APIC — which implies that **each vAPIC's logical ID must be unique**. If the guest changes its APIC's logical ID, the VMM must mirror the change into this table.  `[APM2 §15.29.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** AVIC hardware supports the fixed message type to one or more logical destinations, plus self and broadcast via the ICRL DSH field; every other message type must be emulated by the VMM.  `[APM2 §15.29.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** In **flat mode** only the first 8 entries are used; although the logical APIC ID is an eight-bit value, supported encodings must be of the form 2^i for i = 0 to 7, and the byte offset for a given `l_apic_id` is `4 * log2(l_apic_id)`.  `[APM2 §15.29.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** In **cluster mode** bits 7:4 of the logical APIC ID are the cluster number and bits 3:0 the bit-encoded APIC index; cluster number Fh is reserved, four encodings are supported for the APIC index, and the byte offset is `(16 * c) + 4 * log2(apic_ix)`.  `[APM2 §15.29.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** In x2AVIC mode the Logical APIC ID Table is not used at all; the destination logical ID is derived arithmetically from the target x2APIC ID as `Logical x2APICID = (X2APICID[19:4] << 16) | (1 << X2APICID[3:0])`.  `[APM2 §15.29.5.3]` `[1]` `C:high` `V:durable`

## 7.6 The AVIC doorbell

The doorbell is how a *remote* agent — another core sending an IPI, or the IOMMU delivering a device interrupt — tells the core currently running the target vCPU that its backing page has changed.

- **Claim.** Every core provides a doorbell mechanism used by other cores (for IPIs) and by the IOMMU (for device interrupts) to signal the target physical core that a virtual interrupt needs processing; the exact mechanism is implementation-specific but must be protected from non-privileged software on other cores and from direct access by an external device.  `[APM2 §15.29.8.2]` `[1]` `C:high` `V:durable`
- **Claim.** The programming interface is the **Doorbell Register, MSR `C001_011Bh`**: bits 7:0 hold the destination Physical APIC ID and bits 63:8 are Reserved, MBZ.  `[APM2 Figure 15-22]` `[1]` `C:high` `V:durable`
- **Claim.** Writing the register sends the doorbell signal to that physical core; **any attempt to read the register raises `#GP`**.  `[APM2 §15.29.8.2]` `[1]` `C:high` `V:durable`
- **Claim.** The serializing semantics of `WRMSR` are relaxed when writing the Doorbell Register — Vol.3's `WRMSR` page states the same exception for "some x2APIC and AVIC MSRs".  `[APM3 §4 "WRMSR"]` `[2]` `C:high` `V:durable`
- **Claim.** A doorbell delivered to a running guest is recognized whether or not the interrupt can be injected immediately; on the next VMRUN the delivery mechanism re-reads the IRR in the backing page, finds the highest-priority pending interrupt and injects it if masking and priority allow.  `[APM2 §15.29.8.2]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN itself re-evaluates the APIC state in the backing page on guest entry, delivers the highest-priority pending IRR interrupt if masking and priority allow, and recognizes any doorbell received during VMRUN processing immediately after entering the guest.  `[APM2 §15.29.8.3]` `[1]` `C:high` `V:durable`

### 7.6.1 Hardware IPI delivery

- **Claim.** AVIC processes an IPI in six steps: (1) if DSH is 01b (self), update the IRR in the backing page, signal a doorbell to self and stop; (2) if DSH is non-zero or the destination field is FFh (broadcast), jump to step 4; (3) resolve logically addressed destinations through the Logical APIC ID Table; (4) look up the backing-page address in the Physical APIC table using the guest physical APIC ID as index; (5) for every valid destination, atomically set the IRR bit in that destination's backing page, check IsRunning, and if set send a doorbell using the host physical core number from the table; (6) if any destination was not scheduled on a physical core, cause a `#VMEXIT`.  `[APM2 §15.29.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** Three logical-lookup conditions each cause a `#VMEXIT`: an invalid entry (`V` clear), a valid entry whose Guest Physical APIC ID is greater than 255 (xAVIC), and a valid entry containing an invalid backing page pointer.  `[APM2 §15.29.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** At the physical-table lookup the rule differs by addressing: for **directed** interrupts an invalid entry causes a `#VMEXIT`, while for **broadcast** IPIs invalid entries are simply ignored.  `[APM2 §15.29.6.1]` `[1]` `C:high` `V:durable`

### 7.6.2 Device interrupts — the CPU-side contract

The IOMMU half of this story — the IRTE formats, the GA log and GAPPI — is owned by `10-iommu-interrupt-remapping.md` and is not repeated here. What follows is only the part of the protocol the CPU side defines.

- **Claim.** Device-interrupt delivery to a vCPU is performed by an IOMMU with virtual interrupt capability, in six steps: the message arrives carrying source device and vector; the device ID yields the target guest physical APIC ID; that ID indexes the **Physical APIC ID Table** to find the backing page's system physical address; any required vector translation is applied; the corresponding IRR bit in the backing page is set atomically; and finally the doorbell is sent using the Host Physical APIC ID from the table entry if IsRunning is set.  `[APM2 §15.29.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** If the I/O virtualization hardware reads a Physical APIC ID Table entry whose `V` bit is clear it **aborts the virtual interrupt delivery and logs an error**; if the target vCPU is merely not running, the interrupt is presented when that vCPU is made active again, and the hardware may hand the VMM extra information to aid scheduling.  `[APM2 §15.29.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** The Physical APIC ID Table is therefore a shared structure written by the VMM and read by **both** the core and the IOMMU — which is why its `IR` bit must be maintained on every vCPU schedule and unschedule, not merely at VM creation.  `[APM2 §15.29.6.2]` `[1]` `C:high` `V:durable`

## 7.7 x2AVIC

- **Claim.** x2AVIC accelerates performance-sensitive APIC accesses when the guest drives the **x2APIC MSR interface** rather than the MMIO interface, and is reported by `CPUID Fn8000_000A_EDX[x2AVIC]` = **bit 18**.  `[APM2 §15.29.10]` `[1]` `C:high` `V:durable`
- **Claim.** §15.29.7 states the same bit a second time, in the AVIC CPUID subsection: `Fn8000_000A_EDX[AVIC]` (bit 13) reports AVIC, and `Fn8000_000A_EDX[x2AVIC]` (bit 18) additionally reports AVIC support when the guest is using the x2APIC MSR interface.  `[APM2 §15.29.7]` `[1]` `C:high` `V:durable`
- **Claim.** Vol.3's `Fn8000_000A_EDX` table confirms it from the other side: bit 13 is `AVIC`, bit 15 is `VMSAVEvirt`, bit 18 is `x2AVIC` and **bit 14 is Reserved** — so a source giving `EDX[14]` here is repeating the 2022 patch-letter error rather than the manual, as errata `E09` records.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** x2AVIC mode is entered by setting **both** AVIC Enable (bit 31) and x2AVIC Mode Enable (bit 30) in the word at offset 60h; setting bit 30 without bit 31 makes VMRUN fail with a `VMEXIT_INVALID` error code.  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** With AVIC Enable set, bit 30 selects the mode: cleared means xAVIC virtualization (the MMIO local-APIC interface), set means x2AVIC virtualization (the MSR local-APIC interface).  `[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** In x2AVIC mode the x2APIC MSR intercept checks and access checks are evaluated at **higher priority** than AVIC access-permission checks — an MSR intercept wins over the AVIC filter.  `[APM2 §15.29.10]` `[1]` `C:high` `V:durable`
- **Claim.** x2APIC combines ICRL and ICRH into one 64-bit ICR MSR at 830h; in x2AVIC mode bits 31:0 and 63:32 of that MSR map to backing-page offsets 300h (ICRL) and 310h (ICRH), and SELF_IPI MSR 83Fh is accelerated exactly like the ICR MSR.  `[APM2 §15.29.10]` `[1]` `C:high` `V:durable`
- **Claim.** `V_APIC_BAR` and the logical destination table are **not used** in x2AVIC mode — consistent with x2APIC having no relocatable MMIO window and with the arithmetic derivation of the logical ID in 7.5.2.  `[APM2 §15.29.10]` `[1]` `C:high` `V:durable`
- **Claim.** The behavioural differences from xAVIC visible in Table 15-22 are narrow: ICRH is Read-Allowed / Write-Allowed only in xAVIC, and the Self IPI register at MSR 83Fh is Write-Allowed only in x2AVIC.  `[APM2 Table 15-22]` `[1]` `C:high` `V:durable`

## 7.8 AVIC exits and their payloads

- **Claim.** AVIC defines exactly two new `#VMEXIT` events, with exit codes **401h `AVIC_INCOMPLETE_IPI`** and **402h `AVIC_NOACCEL`**; their place in the full table belongs to `05-exit-decoding.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

### 7.8.1 AVIC_INCOMPLETE_IPI (401h)

- **Claim.** `AVIC_INCOMPLETE_IPI` is raised when an IPI could not be delivered to all targeted vCPUs — canonically because at least one target was not allocated to a physical core at the time.  `[APM2 §15.29.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** The first payload for this exit carries the two written command-register values: bits 63:32 are the value written to vAPIC ICRH and bits 31:0 the value written to ICRL. The general decoding tables are in `05-exit-decoding.md`.  `[APM2 Table 15-25]` `[1]` `C:high` `V:durable`
- **Claim.** The second payload carries the failure reason in bits 63:32 (`ID`), reserved bits 31:12, and an `Index` in bits 11:0 that is meaningful only for `ID` = 1 through 3 and reserved otherwise; see `05-exit-decoding.md` for the field-table conventions.  `[APM2 Table 15-26]` `[1]` `C:high` `V:durable`

`ID` values (Table 15-27):

| ID | Cause | Description | Index |
|---|---|---|---|
| 0 | Invalid Interrupt type | Trigger mode was level, or the destination type is unsupported. | Reserved |
| 1 | IPI Target Not Running | IsRunning of the singlecast/broadcast/multicast target is clear in the physical APIC ID table. | Index of the physical or logical table entry for the unscheduled target |
| 2 | Invalid IPI Target | Target ID invalid — not covered by the physical or logical ID table. | Index of the entry for the invalid target |
| 3 | Invalid Backing Page Pointer | The vAPIC Backing Page Pointer in the Physical APIC ID Table held an invalid physical address. | For shorthand/broadcast, index into the Physical APIC ID Table; for directed IPIs, index of the logical or physical table depending on destination mode |
| 4 | Invalid IPI Vector | The IPI vector was an illegal value (VEC < 16). | Reserved |
| 5 | Un-accelerated IPI | Destination Shorthand is not set to Self (Secure AVIC). | Reserved |
| > 5 | Reserved | — | Reserved |

- **Claim.** Table 15-27 defines **six** `ID` values, 0 through 5, with everything above 5 reserved — and not four. Values 4 (`Invalid IPI Vector`, VEC < 16) and 5 (`Un-accelerated IPI`) are as architectural as the first four.  `[APM2 Table 15-27]` `[1]` `C:high` `V:durable`
- **Claim.** `ID` = 5 is the Secure AVIC path: in Secure AVIC mode an ICR write whose DSH is not Self traps out with this reason, and the Physical and Logical APIC ID tables are not used at all. Secure AVIC itself is owned by `14-sev-snp.md`.  `[APM2 §15.36.21]` `[1]` `C:high` `V:durable`

### 7.8.2 AVIC_NOACCEL (402h)

- **Claim.** `AVIC_NOACCEL` is raised on a guest access to an APIC register that AVIC does not accelerate, **and also** when an EOI is attempted while the highest-priority in-service interrupt is level-triggered.  `[APM2 §15.29.9.2]` `[1]` `C:high` `V:durable`
- **Claim.** The first payload places the R/W indicator at **bit 32** — set means a write was attempted, clear a read — and the register offset at **bits 11:4** as `APIC_Offset[11:4]`; bits 3:0, 31:12 and 63:33 are reserved. `APIC_Offset[3:0]` is zero by construction because every register is 16-byte aligned. Decoding conventions are in `05-exit-decoding.md`.  `[APM2 Table 15-28]` `[1]` `C:high` `V:durable`
- **Claim.** The second payload carries a vector in bits 7:0 — the highest in-service vector found in the virtual APIC ISR — and it is meaningful only when the first payload indicates a write to the EOI register at offset B0h; otherwise the value is undefined. See `05-exit-decoding.md`.  `[APM2 Table 15-29]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM decoding this exit must therefore read the offset field first: it is what distinguishes a level-triggered-EOI exit, whose vector field is meaningful, from every other un-accelerated register access, whose vector field is not.  `[APM2 §15.29.9.2]` `[1]` `C:high` `V:durable`

## 7.9 Open items

- **The manual has no row for bit 10 of the offset-60h word.** Table B-1 skips from bit 9 to bit 11 and no reserved range covers it. The only text that assigns bit 10 is the Alternate Injection description in §15.36.16, and that defines it in the *encrypted* VIntrCtrl. Whether bit 10 is reserved or merely undocumented in the unencrypted field is not stated anywhere. Treat it as reserved and do not write it.
- **"Three ways" versus a four-name taxonomy.** §15.29.3.1 enumerates Allow / Fault / Trap, but Table 15-22's behaviour column adds "Accelerated by AVIC" as though it were a peer. Software that models the filter as a four-valued enumeration will be right in practice and wrong about the manual; this chapter states the three-valued form because that is what the normative sentence says.
- **Vol.3's `Fn8000_000A_ECX` table carries a copy-paste slip**: the sentence introducing the ECX feature table says "The value returned in EDX provides…". The bit rows themselves are unambiguous, and `x2AVIC_EXT` is an ECX bit — §15.29.4.3 and §15.29.5.2 both cite it as `Fn8000_000A_ECX`.
- **Where the 512-vCPU and 256-entry figures each apply.** §15.29.5.2 gives 512 vCPUs for a 4-Kbyte table while Figure 15-18 shows the xAVIC table using only the lower 2048 bytes, i.e. 256 entries with FFh reserved. The two are consistent once mode is fixed — 256 in xAVIC, 512 in x2AVIC, 4096 with `x2AVIC_EXT` — but the manual never puts the three numbers in one place, which is why they are stated per mode above.
- **Client availability.** AMD publishes neither a Processor Programming Reference nor a revision guide for client Ryzen parts, so whether a given desktop or mobile part has AVIC enabled by firmware cannot be settled from AMD primary sources — only `CPUID Fn8000_000A` on the machine settles it. The default-enablement history and the hypervisor-side switches belong to `90-dated-landscape.md`, and `errata.md` `O2` records that the disclosure year of the AVIC erratum is an unresolved conflict.
  - **Claim.** No public Processor Programming Reference and no public revision guide exists for client Ryzen parts — every published AMD revision guide covers an EPYC family — so an AVIC availability statement about a client part must rest on a CPUID reading rather than on a document.  `[no-spec]` `[30]` `C:medium` `V:durable`
- **Silicon errata affecting AVIC are out of scope here by ownership.** Errata-driven feature masking is owned by `17-security.md` and dated status by `90-dated-landscape.md`. This chapter deliberately names no erratum, because the anchor grammar in `CONVENTIONS.md` §2 has no form for a revision guide and inventing one would be worse than the omission. Two are worth routing there: one Family 19h erratum on the `EDX[27]` extended-LVT acceleration described in 7.4.3, and one Family 1Ah erratum on Secure AVIC IRR backing-page corruption.
- **Performance.** No figure in this chapter is a measurement; every quantity above is an architectural constant. IPI-rate and exit-rate numbers for AVIC belong to `18-performance.md`.
