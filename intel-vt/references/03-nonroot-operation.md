# 03. VMX Non-Root Operation

> **中文速览**：本章回答一个问题——guest 在 VMX non-root operation 里跑着跑着，**什么会把控制权抢回 VMM**。内容分三层：无条件退出的指令（CPUID、INVD、XSETBV、VMX 指令族等）、由 VM-execution 控制位选择的退出（HLT/INVLPG/MWAIT/RDPMC/RDTSC/MOV-DR/MONITOR/PAUSE、描述符表指令等），以及位图与掩码构成的"选择性陷入"网络：exception bitmap（含 #PF 的 error-code mask/match 二级判定）、I/O bitmap A/B、MSR bitmap 的 4×1KB 布局、CR0/CR4 guest/host mask 与 read shadow、CR3-target 列表。最后覆盖四个调度与注入相关的控制：PAUSE-loop exiting（自旋锁持有者被抢占的检测）、interrupt-window / NMI-window exiting（等 guest 变得可注入）、monitor trap flag（对 guest 不可见的单步）、unrestricted guest（实模式 guest，依赖 EPT）。字段编码与控制位号本身属 `02-vmcs.md`；退出原因编号与 exit qualification 格式属 `05-vm-exit.md`。

**Maps to:** Intel SDM Vol.3C Ch.28 "VMX Non-Root Operation" (rev 092) [1]
**Owns:** the taxonomy of VM-exit causes · instruction behaviour changes in VMX non-root operation · exception bitmap and page-fault error-code mask/match semantics · I/O bitmap semantics · MSR bitmap layout and semantics · CR0/CR4 mask and read-shadow semantics · CR3-target matching · TSC offsetting as seen by the guest · PAUSE and PAUSE-loop exiting · interrupt-window and NMI-window exiting · monitor trap flag · unrestricted guest
**See also:** `02-vmcs.md` §2.8 (the control fields and their bit positions) · `04-vm-entry.md` (entry checks and event injection) · `05-vm-exit.md` (basic exit reasons and exit qualification formats) · `06-address-translation.md` (EPT violations and misconfigurations) · `07-apic-virtualization.md` (APIC-access and virtual-interrupt exits) · `08-vmx-instructions.md` (semantics of the VMX instructions themselves)

---

## 3.1 What VMX non-root operation is

VMX non-root operation is not a reduced-privilege mode. Guest software runs at whatever CPL it chooses, executes the same instruction encodings with the same meanings, and uses its own descriptor tables, page tables and IDT. The single architectural difference is that some instructions and some events cause a VM-exit instead of, or in addition to, their ordinary behaviour — and which ones do is chosen by the VMM through the VM-execution controls in the VMCS.

- **Claim.** In VMX non-root operation, certain instructions and certain events cause VM exits to the VMM; VM exits are the only mechanism by which control leaves VMX non-root operation.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** VM exits caused in VMX non-root operation fall into three classes: those that occur unconditionally, those that occur only because a VM-execution control selects them, and those that result from events such as exceptions, external interrupts and NMIs according to the controls and bitmaps that govern each event class.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** VMX non-root operation does not change the privilege level at which guest software runs, so a guest operating system executes at CPL 0 and a guest application at CPL 3 exactly as they would on bare metal: VMX operation places restrictions even on software running at CPL 0, so guest software can run at the privilege level for which it was designed.  `[SDM 3C §26.3]` `[1]` `C:high` `V:durable`
- **Claim.** There is no software-visible bit whose setting indicates whether a logical processor is in VMX non-root operation, which is what may allow a VMM to prevent guest software from determining that it is running in a virtual machine.  `[SDM 3C §26.3]` `[1]` `C:high` `V:durable`

The last point is an architectural property, not a security guarantee. A guest can still infer the presence of a VMM from timing, from CPUID leaves the VMM chooses to expose, or from the behaviour of instructions the VMM emulates imperfectly; those are software-level detections, discussed in `15-security.md`.

---

## 3.2 Instructions that always cause VM exits

A small set of instructions causes a VM-exit in VMX non-root operation with no control bit able to suppress it. The rationale is uniform: each of them either lets the guest observe or alter platform-global state that the VMM must arbitrate.

- **Claim.** CPUID causes a VM-exit unconditionally in VMX non-root operation, which is what lets a VMM define the feature set its guest sees and keep that set stable across a migration.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** INVD causes a VM-exit unconditionally, because invalidating caches without writing back would be visible to the rest of the platform.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** XSETBV and GETSEC cause VM exits unconditionally; GETSEC does so only when CR4.SMXE = 1, because with CR4.SMXE = 0 it raises an invalid-opcode exception instead, and when CR4.SMXE = 1 it exits regardless of CPL or RAX.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** The VMX instructions INVEPT, INVVPID, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF and VMXON cause VM exits when executed in VMX non-root operation, which is what prevents a guest from leaving VMX non-root operation by itself; the same unconditional list also names SEAMCALL and TDCALL, see `13-tdx.md`.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD and VMWRITE are the exception within the VMX instruction set: when VMCS shadowing is enabled they may be satisfied in hardware against the VMCS referenced by the VMCS link pointer rather than causing a VM-exit, and they exit only when the encoding's bit in the VMREAD or VMWRITE bitmap is 1 or when bits 63:15 of the register source operand are not all 0 — see `02-vmcs.md` §2.11 and `14-nested-virtualization.md`.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC raises an invalid-opcode exception if the enable-VM-functions control is 0 or EAX is greater than 63; otherwise it causes a VM-exit if the bit at position EAX is 0 in the VM-function controls, and an individual VM function may perform further checks that cause a VM-exit of their own — an enabled function whose checks pass runs with no VM-exit.  `[SDM 3C §28.5.7.2]` `[1]` `C:high` `V:durable`

---

## 3.3 Instruction behaviour changed by the VM-execution controls

Most interception is optional, and the set of optional interceptions is the practical definition of a VMM's policy. The following instructions cause VM exits when the corresponding control is 1 and execute normally when it is 0. The bit positions are in `02-vmcs.md` §2.8.

- **Claim.** HLT, INVLPG, MWAIT, RDPMC, RDTSC, MOV to or from DR, MONITOR and PAUSE each cause a VM-exit when their corresponding primary processor-based control is 1; INVPCID exits when INVLPG exiting and enable-INVPCID are both 1, and RDTSCP exits when RDTSC exiting and enable-RDTSCP are both 1.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** MOV to or from CR3 causes a VM-exit when CR3-load exiting or CR3-store exiting respectively is 1, subject to the CR3-target matching rule of §3.8, and MOV to or from CR8 causes a VM-exit when the corresponding CR8 control is 1.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** When descriptor-table exiting is 1, the instructions LGDT, LIDT, LLDT, LTR, SGDT, SIDT, SLDT and STR cause VM exits; the four load forms were always privileged, and it is the four store forms SGDT, SIDT, SLDT and STR that on pre-VMX x86 could read descriptor-table state at CPL 3 without faulting.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** WBINVD and WBNOINVD both cause VM exits when WBINVD exiting is 1, and RDRAND and RDSEED cause VM exits when their respective exiting controls are 1.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** ENCLS and PCONFIG cause VM exits under the control of their own bitmaps and controls, described with the corresponding control fields in Vol.3C §27.6.16 and §27.6.17.  `[SDM 3C §27.6.16]` `[1]` `C:medium` `V:durable`
- **Claim.** Some controls do not select a VM-exit but change whether an instruction is available at all: RDTSCP, INVPCID and XSAVES/XRSTORS cause an invalid-opcode exception in VMX non-root operation unless their respective enabling secondary controls are 1, and that exception takes priority over any other the instruction may incur.  `[SDM 3C §28.3]` `[1]` `C:high` `V:durable`
- **Claim.** RDMSR and WRMSR cause VM exits according to the MSR bitmaps when the use-MSR-bitmaps control is 1 and unconditionally when it is 0 — see §3.6.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** I/O instructions cause VM exits according to the I/O bitmaps or unconditionally, according to two separate controls — see §3.5.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`

### 3.3.1 The interception surface at a glance

The table pairs each selectable interception with the reason a VMM would want it. Bit positions are in `02-vmcs.md` §2.8; nothing in this table is a new fact.

| Intercepted by | What it catches | Why a VMM turns it on |
|---|---|---|
| HLT exiting | Guest idle loop | Hand the physical CPU back to the host scheduler |
| INVLPG exiting | Guest TLB maintenance | Shadow paging only; unnecessary with EPT |
| MWAIT / MONITOR exiting | Guest use of the monitor-wait idle idiom | Prevent a guest from parking a physical core |
| RDPMC exiting | Performance counters | Keep host counters out of the guest's reach |
| RDTSC exiting | Time-stamp counter reads | Timing obfuscation; normally replaced by TSC offsetting |
| MOV-DR exiting | Debug register access | Multiplex debug registers between host and guest |
| CR3-load / CR3-store exiting | Guest address-space switches | Shadow paging; default-1 on early parts, see §3.8 |
| CR8-load / CR8-store exiting | Task-priority register access | Superseded by the TPR shadow on APIC-virtualization hardware |
| Descriptor-table exiting | LGDT, LIDT, LLDT, LTR, SGDT, SIDT, SLDT, STR | Protect or observe guest descriptor tables |
| WBINVD exiting | Cache write-back and invalidate | Platform-wide cache effects |
| RDRAND / RDSEED exiting | Hardware random number generation | Entropy policy and determinism for record-replay |
| PAUSE exiting | Every PAUSE | Crude spin detection; normally replaced by §3.10 |
| Use I/O bitmaps | Selected I/O ports | Device emulation |
| Use MSR bitmaps | Selected MSRs | Everything from feature hiding to side-channel mitigation control |
| Monitor trap flag | Every instruction | Introspection and hypervisor-assisted debugging |
| Unconditional I/O exiting | Every I/O instruction | Coarse fallback when no bitmap is allocated |

---

## 3.4 Events, not instructions

- **Claim.** Exceptions — faults, traps and aborts — cause VM exits according to the exception bitmap, described in §3.4.1; the bitmap also governs the exceptions generated by INT1, INT3, INTO, BOUND, UD0, UD1, UD2 and UDB.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** A VM-exit occurs, rather than a processor shutdown, when the logical processor encounters an exception while attempting to call the double-fault handler and that exception does not itself cause a VM-exit through the exception bitmap, which lets a VMM report a guest crash instead of taking the platform down.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** Task switches never occur in VMX non-root operation: an attempted task switch causes a VM-exit, and the VMM must emulate the task switch if it wants to support one; the gate, selector and TSS-descriptor checks still run first, so a fault in any of them takes priority over the VM-exit.  `[SDM 3C §28.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** INIT signals never initialise a logical processor in VMX non-root operation; they cause VM exits instead, and a start-up IPI causes a VM-exit when the logical processor is in the wait-for-SIPI activity state and is discarded without a VM-exit when it is not. In the wait-for-SIPI state INIT signals are themselves blocked and cause no VM-exit.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** External interrupts cause VM exits when the external-interrupt exiting pin-based control is 1, in which case RFLAGS.IF no longer blocks them; NMIs cause VM exits when the NMI exiting pin-based control is 1.  `[SDM 3C §27.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** The VMX-preemption timer counts down in VMX non-root operation when the activate-VMX-preemption-timer pin-based control was 1 at the last VM entry, and a VM-exit occurs when it reaches zero, giving the VMM a preemption source independent of the guest's own timer programming; it does not cause a VM-exit from the wait-for-SIPI state.  `[SDM 3C §28.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Accesses to memory in VMX non-root operation may cause VM exits through EPT — EPT violations and EPT misconfigurations — whose semantics are owned by `06-address-translation.md`.  `[SDM 3C §28.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** Accesses to the APIC-access page and the virtual-APIC page may cause APIC-access and APIC-write VM exits, whose semantics are owned by `07-apic-virtualization.md`.  `[SDM 3C §28.5.6]` `[1]` `C:high` `V:durable`

### 3.4.1 The exception bitmap

- **Claim.** The exception bitmap is a 32-bit field with one bit for each exception vector 0 through 31: when a bit is 1 the corresponding exception causes a VM-exit, and when it is 0 the exception is delivered normally through the guest's own IDT.  `[SDM 3C §27.6.3]` `[1]` `C:high` `V:durable`
- **Claim.** Page faults are governed by a second level of filtering: the processor checks whether PFEC & PFEC_MASK = PFEC_MATCH, where PFEC is the error code the page fault produced; on equality the specification of exception-bitmap bit 14 is followed, and on inequality the meaning of that bit is reversed.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** Consequently the configuration "all page faults cause VM exits" is bit 14 = 1 with mask 00000000H and match 00000000H, and the configuration "no page fault causes a VM-exit" is bit 14 = 1 with mask 00000000H and match FFFFFFFFH.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** Selective page-fault interception is what the mask and match pair buys: a VMM can intercept only page faults whose error code has a chosen shape, leaving all others to the guest.  `[SDM 3C §28.2]` `[1]` `C:medium` `V:durable`
- **Claim.** NMIs are not controlled by the exception bitmap even though NMI uses vector 2; they are controlled by the NMI exiting pin-based control.  `[SDM 3C §27.6.1]` `[1]` `C:medium` `V:durable`

The mask/match mechanism is a fossil of the shadow-paging era, when a VMM intercepted every guest page fault in order to maintain shadow page tables and needed a way to avoid intercepting the faults that were genuinely the guest's own. With EPT, most VMMs set bit 14 to 0 and never look at the mask again; the mechanism survives in introspection and anti-cheat hypervisors that want a narrow class of faults.

### 3.4.2 VM exits that happen during event delivery

An exception or interrupt being delivered through the guest's IDT can itself cause a VM-exit — the IDT access can hit an EPT violation, or the delivery can raise a second exception whose bitmap bit is set. The architecture handles this by recording that the VM-exit interrupted an event delivery, so the VMM can re-deliver the original event rather than losing it.

- **Claim.** When a VM-exit occurs during delivery of an event through the guest IDT, the processor records the interrupted event in the 32-bit original-event identification field — called the IDT-vectoring information field in older versions of the manual — and its error code in the original-event error code field, so that the VMM can reinject the original event after handling the exit.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM that ignores the original-event identification field silently drops guest events, which manifests as a guest that hangs or panics under memory pressure rather than as any visible hypervisor fault; the field's format is owned by `05-vm-exit.md`.  `[SDM 3C §27.9.3]` `[1]` `C:medium` `V:durable`

This is the interaction that makes the exception bitmap harder to reason about than it first appears: turning on interception for a common exception does not only add VM exits, it adds VM exits that can occur in the middle of delivering other events, and each of them has to be unwound correctly.

---

## 3.5 I/O bitmaps

- **Claim.** When the unconditional-I/O-exiting control is 1 and the use-I/O-bitmaps control is 0, every execution of IN, INS, OUT or OUTS in VMX non-root operation causes a VM-exit regardless of port number; when both controls are 0 these instructions execute normally.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** When the use-I/O-bitmaps control is 1, the unconditional-I/O-exiting control is ignored and interception is decided per port by two bitmaps.  `[SDM 3C §27.6.4]` `[1]` `C:high` `V:durable`
- **Claim.** I/O bitmap A occupies 4 KBytes and contains one bit for each I/O port in the range 0000H through 7FFFH; I/O bitmap B occupies 4 KBytes and covers ports 8000H through FFFFH; each bitmap's physical address must be 4-KByte aligned.  `[SDM 3C §27.6.4]` `[1]` `C:high` `V:durable`
- **Claim.** An I/O access causes a VM-exit if the bit corresponding to any port it touches is 1, so a word or doubleword access spanning several port numbers is intercepted if any of those ports is intercepted; an I/O operation that wraps around the 16-bit port space, touching FFFFH and 0000H, always causes a VM-exit.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** General-protection exceptions raised by the I/O permission bits in the guest's own TSS take priority over VM exits, so an access the guest's I/O permission bitmap forbids faults rather than causing an I/O VM-exit; I/O VM exits do, however, take priority over a #GP from an unusable or overrun segment and over an alignment-check exception raised by INS or OUTS.  `[SDM 3C §28.1.1]` `[1]` `C:high` `V:durable`

Two 4-KByte bitmaps give a VMM complete per-port control over a 64K port space at a fixed 8 KByte cost per virtual machine, which is why device models in user space (QEMU and equivalents) can be attached port by port without any additional interception machinery.

### 3.5.1 String and repeated I/O

INS and OUTS complicate interception because one instruction can perform many port accesses and touch guest memory as well.

- **Claim.** A VM-exit caused by INS or OUTS reports the guest-linear address of the memory operand in the guest-linear address field, and on processors that report IA32_VMX_BASIC bit 54 as 1 it also fills the VM-exit instruction-information field with a description of the addressing used.  `[SDM 3C §27.9.1]` `[SDM 3D App.A]` `[1][2]` `C:high` `V:durable`
- **Claim.** The I/O RCX, I/O RSI, I/O RDI and I/O RIP fields hold the values those registers had before an I/O instruction started, but they are used **only** for VM exits due to SMIs that arrive immediately after retirement of an I/O instruction; an ordinary I/O VM-exit does not fill them, so a VMM emulating a repeated string I/O instruction must read the guest's registers itself.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`

The practical rule is that a VMM must never assume an intercepted I/O instruction transferred one datum. Emulating a REP INS by performing a single access and then advancing RIP by the instruction length loses the rest of the transfer; the VMM must either emulate the whole repetition or leave RIP alone and let the guest re-execute the instruction after the VMM has made progress on it.

---

## 3.6 MSR bitmaps

- **Claim.** When the use-MSR-bitmaps control is 0, every execution of RDMSR and WRMSR in VMX non-root operation causes a VM-exit.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`
- **Claim.** When the use-MSR-bitmaps control is 1, the MSR-bitmap address field supplies the 4-KByte-aligned physical address of a 4-KByte region divided into four 1-KByte bitmaps.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`
- **Claim.** The four 1-KByte regions are, in order from the MSR-bitmap address: the read bitmap for low MSRs at offset 0, covering MSR addresses 00000000H through 00001FFFH; the read bitmap for high MSRs at offset 1024, covering C0000000H through C0001FFFH; the write bitmap for low MSRs at offset 2048; and the write bitmap for high MSRs at offset 3072.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`
- **Claim.** With the bitmaps in use, RDMSR or WRMSR causes a VM-exit if the value in RCX lies in neither covered range, or if the bit corresponding to that MSR in the applicable bitmap is 1; a bit value of 0 lets the access execute against the physical MSR without a VM-exit.  `[SDM 3C §27.6.9]` `[1]` `C:high` `V:durable`

Each covered range holds 8192 MSR addresses and each 1-KByte bitmap holds 8192 bits, which is the arithmetic behind the layout. The cost model this creates is what makes MSR pass-through practical: a VMM can leave performance-critical MSRs such as the FS and GS bases fully unintercepted while trapping every access to MSRs that carry platform policy.

### 3.6.1 Indexing the bitmap

```c
/* Returns the byte offset and bit position for one MSR in one direction.
   Returns false for MSR numbers outside the two covered ranges: those
   always cause a VM-exit and have no bit to set.                        */
static bool msr_bitmap_slot(uint32_t msr, bool write,
                            size_t *byte, unsigned *bit)
{
        size_t base;

        if (msr <= 0x00001fffu)                  /* low range          */
                base = write ? 2048 : 0;         /* +2048 write, +0 read  */
        else if (msr >= 0xc0000000u && msr <= 0xc0001fffu)   /* high range */
                base = (write ? 3072 : 1024), msr -= 0xc0000000u;
        else
                return false;                    /* uncovered: always exits */

        *byte = base + (msr / 8);
        *bit  = msr % 8;
        return true;
}
```

A bit set to 1 means "intercept"; a bit cleared to 0 means "let the guest touch the physical MSR". The default a VMM should start from is an all-ones bitmap — intercept everything — and then clear bits deliberately, because the failure mode of the opposite default is a guest that can write a platform MSR the host depends on.

---

## 3.7 CR0 and CR4 guest/host masks and read shadows

The mask-and-shadow pair is the mechanism that lets a VMM own individual control-register bits while leaving the rest to the guest, and lie convincingly about the bits it owns.

- **Claim.** Each of CR0 and CR4 has a guest/host mask and a read shadow in the VMCS; a bit set to 1 in the mask is owned by the host and a bit set to 0 is owned by the guest.  `[SDM 3C §27.6.6]` `[1]` `C:high` `V:durable`
- **Claim.** An attempt by guest software to set a host-owned bit to a value that differs from the corresponding bit of the read shadow causes a VM-exit; an attempt that writes the same value the read shadow already holds does not.  `[SDM 3C §27.6.6]` `[1]` `C:high` `V:durable`
- **Claim.** A guest read of CR0 or CR4 with MOV from CR, and of CR0 with SMSW, returns for host-owned bits the values in the read shadow and for guest-owned bits the values actually in the control register.  `[SDM 3C §27.6.6]` `[1]` `C:high` `V:durable`
- **Claim.** CLTS and LMSW are covered by the same mechanism: whether they cause a VM-exit depends on the CR0 guest/host mask and the read shadow applied to the CR0 bits they can modify.  `[SDM 3C §27.6.6]` `[1]` `C:medium` `V:durable`
- **Claim.** Guest-owned bits are genuinely owned: a guest write to them takes effect in the physical control register with no VM-exit, which is why a VMM must never leave a bit guest-owned if the host depends on its value.  `[SDM 3C §27.6.6]` `[1]` `C:high` `V:durable`

The canonical use is CR4.VMXE: a VMM that does not expose nested virtualization owns that bit in the CR4 mask and clears it in the CR4 read shadow, so the guest sees VMXE as 0 and any attempt to set it exits to the VMM. The same pattern hides features the VMM has not implemented without needing to intercept every CR4 write.

### 3.7.1 The three-value truth table

For one bit position, the behaviour is fully determined by three values: the mask bit, the read-shadow bit and the value the guest writes.

| Mask bit | Guest reads | Guest writes a differing value | Guest writes the same value |
|---|---|---|---|
| 0 (guest owns it) | The real control-register bit | Takes effect, no VM-exit | Takes effect, no VM-exit |
| 1 (host owns it) | The read-shadow bit | VM-exit | No VM-exit; the real bit is unchanged |

The last cell is the subtle one and the reason the read shadow exists at all. A guest that reads CR4, modifies an unrelated bit and writes the whole register back is writing its own view of every host-owned bit — the read-shadow value. If that case caused a VM-exit, every read-modify-write of a control register would trap, which would make the mechanism useless. Because the comparison is against the read shadow rather than against the real register, the common case costs nothing and only a genuine attempt to change a host-owned bit exits.

A VMM must therefore keep the read shadow consistent with the fiction it is telling. If the VMM emulates a CR4 write that sets a host-owned bit it has decided to allow, it must update both the real register and the read shadow; updating only the real register leaves the guest reading a stale value forever.

---

## 3.8 CR3-target controls

- **Claim.** The VMCS provides a 32-bit CR3-target count and four CR3-target values, and a VM entry fails if the CR3-target count is greater than 4; future processors may support a different number of CR3-target values, and software should read IA32_VMX_MISC bits 24:16 — a value between 0 and 256 — to learn how many this processor provides.  `[SDM 3C §27.6.7]` `[SDM 3D App.A]` `[1][2]` `C:high` `V:durable`
- **Claim.** When CR3-load exiting is 1 and the CR3-target count is non-zero, a MOV to CR3 whose source value matches one of the first CR3-target-count target values does not cause a VM-exit; a MOV to CR3 with any other value does.  `[SDM 3C §27.6.7]` `[1]` `C:high` `V:durable`
- **Claim.** When the CR3-target count is 0 and CR3-load exiting is 1, every MOV to CR3 causes a VM-exit.  `[SDM 3C §27.6.7]` `[1]` `C:high` `V:durable`

The CR3-target list is a shadow-paging optimisation: a VMM maintaining shadow page tables registers the shadow roots for the address spaces the guest switches between most often, so ordinary context switches inside the guest run without a VM-exit while a switch to an unknown address space still traps. A VMM using EPT normally sets CR3-load exiting to 0 — which on early processors was impossible, because that control is default-1 unless the "true" capability MSR says otherwise (see `02-vmcs.md` §2.8.4) — and then the CR3-target list is unused.

---

## 3.9 TSC offsetting and RDTSC exiting as the guest sees them

- **Claim.** When the use-TSC-offsetting control is 1, executions of RDTSC and RDTSCP in VMX non-root operation, and reads of the IA32_TIME_STAMP_COUNTER MSR, return the value of the time-stamp counter plus the 64-bit TSC-offset field from the VMCS, with no VM-exit; this applies only while RDTSC exiting is 0.  `[SDM 3C §27.6.5]` `[1]` `C:high` `V:durable`
- **Claim.** When the use-TSC-scaling secondary control is 1, the time-stamp counter is first multiplied by the 64-bit TSC-multiplier field and the product shifted right 48 bits, and the TSC offset is added to that shifted value, which is what allows a virtual machine to keep a consistent apparent TSC frequency after migration between hosts with different frequencies.  `[SDM 3C §27.6.5]` `[SDM 3C §28.3]` `[1]` `C:high` `V:durable`
- **Claim.** When RDTSC exiting is 1, RDTSC and RDTSCP cause VM exits instead, and the VMM supplies whatever value it chooses; RDTSC exiting takes precedence over TSC offsetting.  `[SDM 3C §27.6.5]` `[1]` `C:medium` `V:durable`

This is the clearest example of the VMX design rule at work: the architecture does not change what RDTSC means, it changes the value RDTSC observes. Migration-safe timekeeping falls out of the offset field, and the expensive option — a VM-exit per RDTSC — remains available for cases such as sandbox timing obfuscation where correctness is not the goal.

---

## 3.10 PAUSE exiting and PAUSE-loop exiting

- **Claim.** When the PAUSE-exiting primary control is 1, every execution of PAUSE in VMX non-root operation causes a VM-exit, at CPL 0 and at CPL greater than 0 alike, and PAUSE-loop exiting is ignored.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** PAUSE-loop exiting is a secondary control that uses two 32-bit fields, PLE_Gap and PLE_Window, to cause a VM-exit only when the guest appears to be spinning rather than on every PAUSE.  `[SDM 3C §27.6.13]` `[1]` `C:high` `V:durable`
- **Claim.** With PAUSE exiting 0 and PAUSE-loop exiting 1 at CPL 0, an execution of PAUSE whose distance in time from the previous CPL-0 PAUSE exceeds PLE_Gap is treated as the first of a loop; otherwise the processor measures the time since the most recent PAUSE so treated and causes a VM-exit if that exceeds PLE_Window. Both are measured by a counter running at the same rate as the time-stamp counter.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** PAUSE-loop exiting applies only to executions of PAUSE at CPL 0, where guest kernel spinlocks live; the control is ignored when CPL is greater than 0.  `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`

The problem being solved is lock-holder preemption. When the host scheduler deschedules a virtual CPU that holds a guest kernel spinlock, the other virtual CPUs of that guest burn their whole time slices spinning. PAUSE exiting would catch this but costs a VM-exit per PAUSE; PAUSE-loop exiting costs nothing until a spin actually lasts too long, at which point the VMM can yield the physical CPU to a sibling virtual CPU.

---

## 3.11 Interrupt-window and NMI-window exiting

These two controls exist for one purpose: to tell the VMM the moment a guest becomes able to accept an event the VMM wants to inject.

- **Claim.** When interrupt-window exiting is 1, a VM-exit occurs at the beginning of any instruction at which RFLAGS.IF is 1 and there is no blocking by STI and no blocking by MOV SS, that is, at the first moment the guest could accept an interrupt.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** When NMI-window exiting is 1, a VM-exit occurs before execution of any instruction at which there is no virtual-NMI blocking **and** no blocking of events by MOV SS and none by STI, that is, at the first moment the guest could accept an NMI.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** NMI-window exiting requires the virtual-NMIs pin-based control to be 1 — a VM entry fails if NMI-window exiting is 1 while virtual NMIs is 0 — and virtual NMIs in turn requires NMI exiting to be 1.  `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** A window VM-exit occurs before execution of the instruction at whose boundary it is recognised, so no guest instruction is lost and the VMM can inject an event and resume at the same RIP; neither window exit occurs in the wait-for-SIPI state, and an interrupt-window exit also does not occur in the shutdown state.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`

The usage pattern is always the same: the VMM has an event to deliver, finds the guest currently unable to take it, sets the window control, gets a VM-exit as soon as the guest is ready, injects the event through the VM-entry interruption-information field (see `04-vm-entry.md`), and clears the window control. Leaving the control set after injection is a classic hypervisor bug that produces an unbounded VM-exit storm.

---

## 3.12 Unrestricted guest

- **Claim.** The unrestricted-guest secondary control determines whether guest software may run in unpaged protected mode or in real-address mode; if bit 31 of the primary processor-based controls is 0, VMX non-root operation behaves as if the control were 0.  `[SDM 3C §28.6]` `[1]` `C:high` `V:durable`
- **Claim.** When unrestricted guest is 1, VM entry does not check guest CR0.PE and guest CR0.PG against the values that the CR0 fixed-bit MSRs would otherwise require, which is exactly the relaxation that permits a real-mode guest: bit 0 (PE) and bit 31 (PG) of the guest CR0 field are simply not checked.  `[SDM 3C §29.3.1.1]` `[1]` `C:high` `V:durable`
- **Claim.** Unrestricted guest requires EPT: a VM entry fails if the unrestricted-guest control is 1 while the enable-EPT control is 0, because with CR0.PG = 0 each linear address is passed straight to the EPT mechanism for translation, with a guest memory type of WB.  `[SDM 3C §29.2.1.1]` `[SDM 3C §28.6]` `[1]` `C:high` `V:durable`
- **Claim.** Without unrestricted guest, a VMM must emulate a guest's real-mode and unpaged-protected-mode execution in software until the guest enables paging, which is the historical reason hypervisors carried full x86 instruction emulators.  `[SDM 3C §28.6]` `[1]` `C:medium` `V:durable`

This is the control that completed the "run an unmodified operating system from its own boot sector" story. Before it, a guest's first instructions — the real-mode boot path — could not execute natively, so every VMM needed an emulator good enough to run firmware and a bootloader. The first-generation CR0 restriction that made this necessary is documented in `01-vmx-intro.md` §1.5.

---

## 3.13 Monitor trap flag

- **Claim.** The monitor trap flag is a primary processor-based control that, when 1, enables a debugging feature causing MTF VM exits on instruction boundaries in VMX non-root operation — in the ordinary case, the boundary following execution of each guest instruction — which gives the VMM a single-stepping facility.  `[SDM 3C §28.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** Monitor-trap-flag VM exits are delivered as VM exits and not through RFLAGS.TF or the debug-exception mechanism — they take priority over debug-trap exceptions rather than being one — so a guest cannot detect single-stepping by reading its own flags or by hooking its #DB handler; the SDM states the priority but does not itself assert undetectability.  `[SDM 3C §28.5.2]` `[1]` `C:medium` `V:durable`
- **Claim.** A monitor-trap-flag VM-exit can be pending at boundaries other than ordinary instruction completion — after delivery of a fault or of a pending event, after one iteration of a REP-prefixed string instruction, at the fallback address of XBEGIN, and from the HLT activity state — so a VMM must expect MTF exits that do not correspond to a retired instruction; no MTF VM-exit occurs in the shutdown or wait-for-SIPI activity states, and none occurs at all if another VM-exit reaches the boundary first.  `[SDM 3C §28.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** The monitor trap flag is unrelated to the MONITOR and MWAIT instructions despite the name, which refers to trapping, not to the MONITOR address-range monitor.  `[SDM 3C §28.5.2]` `[1]` `C:medium` `V:durable`

The monitor trap flag is what makes hypervisor-based introspection and hypervisor-assisted debugging viable: the VMM can step a guest through a region of code without changing any guest-visible state, which neither RFLAGS.TF nor breakpoint instructions can do.

---

## 3.13.1 What VMX non-root operation leaves untouched

It is as important to know what does *not* change, because every one of these is a place where a VMM does not need to do anything and where a bug report blaming VMX is almost certainly wrong.

- **Claim.** Paging behaves normally in VMX non-root operation: the guest's own paging structures translate linear addresses, and when EPT is enabled the resulting guest-physical addresses are translated a second time rather than the first translation being altered — see `06-address-translation.md`.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** Segmentation, privilege checking and the delivery of exceptions through the guest IDT behave in VMX non-root operation exactly as they do outside VMX operation, except where an exception's bitmap bit selects a VM-exit instead of delivery.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** External interrupts that the pin-based controls do not intercept are delivered to the guest normally, subject to RFLAGS.IF and the guest's own local APIC and IDT.  `[SDM 3C §28.2]` `[1]` `C:high` `V:durable`
- **Claim.** Instructions that no control intercepts execute at full hardware speed with no VMM involvement whatsoever, which is the property that distinguishes hardware-assisted virtualization from binary translation and paravirtualization.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`

The last claim is the entire economic argument for VMX. The cost of virtualization under VMX is not a tax on every instruction; it is the exit rate multiplied by the cost of an exit. Everything in this chapter is therefore a lever on the first factor, and everything in `02-vmcs.md` about state areas is a lever on the second.

---

## 3.14 Interception facilities owned by other chapters

Several further causes of VM exits are configured by VM-execution controls but documented elsewhere, because their semantics belong to a larger mechanism:

| Facility | Owner |
|---|---|
| EPT violations, EPT misconfigurations, page-modification log-full, EPT-violation #VE, sub-page-permission exits | `06-address-translation.md` |
| APIC-access exits, APIC-write exits, TPR-below-threshold exits, virtualized-EOI exits | `07-apic-virtualization.md` |
| VMREAD and VMWRITE interception through the shadowing bitmaps | `14-nested-virtualization.md` |
| The exit reason numbers and exit-qualification formats for everything in this chapter | `05-vm-exit.md` |
| The event-injection path a VMM uses after handling a VM-exit | `04-vm-entry.md` |
| Bus-lock detection and notify VM exits | `05-vm-exit.md` |

---

## 3.15 Designing an interception policy

The chapter's practical content reduces to a small number of engineering rules that follow directly from the claims above.

- **Claim.** Every optional interception costs at minimum one VM-exit and one VM entry per occurrence, so the correct default is to intercept nothing that the VMM does not need, and to use the bitmaps and masks to narrow an interception rather than to enable a whole class.  `[SDM 3C Ch.28]` `[1]` `C:medium` `V:durable`
- **Claim.** Interceptions that cannot be disabled — CPUID, GETSEC, INVD, XSETBV, the VMX instruction set, task switches, triple faults, INIT and SIPI — define the floor of a VMM's exit rate and cannot be optimised away by configuration.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** A control that the capability MSRs report as default-1 must remain set on that processor, so a VMM's interception policy is always the intersection of what it wants and what IA32_VMX_PROCBASED_CTLS and its "true" variant allow — see `02-vmcs.md` §2.8.4.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 3.15.1 One cycle of the loop

```
     VM entry
        |
        v
  guest executes ... ------------------------------+
        |                                          |
        | an intercepted instruction, an event,    | nothing intercepted:
        | or an EPT/APIC condition occurs          | the guest keeps running
        v                                          |
     VM-exit  -- processor writes exit reason,     |
        |        exit qualification, instruction   |
        |        length and information            |
        v                                          |
  VMM reads the exit reason (05-vm-exit.md)        |
        |                                          |
        +-- emulate, or update a bitmap/mask, or   |
        |   queue an event for injection           |
        |                                          |
        +-- if the guest cannot take the event yet:|
        |   set interrupt-window or NMI-window     |
        |   exiting (§3.11) and enter anyway ------+
        |
        +-- advance guest RIP by the VM-exit
        |   instruction length when the exit was
        |   caused by a completed instruction
        v
     VM entry (VMRESUME), optionally injecting an
     event through the VM-entry interruption-
     information field (04-vm-entry.md)
```

Two of those steps are where correctness is usually lost. Advancing RIP by the VM-exit instruction length is correct only for exits caused by an instruction the processor completed the decode of; doing it for a fault-like exit re-enters the guest one instruction too far. And a window control set for an injection must be cleared once the injection succeeds, or the next entry produces an immediate exit and the loop spins.

### 3.15.2 Misconfigurations that look like hardware faults

| Symptom | Configuration to re-check |
|---|---|
| VM-exit storm with an exit reason for an interrupt or NMI window | A window control left set after the event was injected (§3.11) |
| Guest triple-faults during its boot sector | Unrestricted guest not enabled, or enabled without EPT (§3.12) |
| Guest sees a control-register bit it should not | That bit is guest-owned in the CR0 or CR4 mask (§3.7) |
| Every MSR access exits despite a bitmap being allocated | The use-MSR-bitmaps control is 0, so the bitmap is ignored (§3.6) |
| Ports behave as intercepted although their bitmap bits are 0 | Unconditional I/O exiting is 1 and use-I/O-bitmaps is 0 (§3.5) |
| A VM-exit rate that does not drop when CR3 exiting is disabled | CR3-load exiting is default-1 and the "true" capability MSR was never read (§3.8) |
| Guest single-steps itself unexpectedly | Monitor trap flag left set from a previous introspection session (§3.13) |

---

## 3.16 What a verifier should check against the PDF

Chapter 28's internal section numbering **has** now been verified against the rev-092 PDF — §28.1 Instructions That Cause VM Exits (§28.1.1 priority, §28.1.2 unconditional, §28.1.3 conditional), §28.2 Other Causes of VM Exits, §28.3 Changes to Instruction Behavior, §28.4 Other Changes (§28.4.1 event blocking, §28.4.2 task switches), §28.5 Features Specific to VMX Non-Root Operation (§28.5.1 preemption timer, §28.5.2 monitor trap flag, §28.5.7 VM functions) and §28.6 Unrestricted Guests — so the anchors below are section-level. Every claim in this chapter was checked against the PDF on 2026-09-20; the items that changed are:

1. **The unconditional-exit list** (§3.2) is, in full: CPUID, GETSEC, INVD, XSETBV, INVEPT, INVVPID, SEAMCALL, TDCALL, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF and VMXON. GETSEC exits only with CR4.SMXE = 1.
2. **The I/O RCX / RSI / RDI / RIP fields** (§3.5.1) were **wrong**: §27.9.4 restricts them to VM exits caused by SMIs arriving immediately after an I/O instruction retires. They are not filled on an ordinary I/O VM-exit.
3. **The NMI-window condition** (§3.11) was incomplete: §28.2 also requires no blocking by MOV SS and none by STI, not virtual-NMI blocking alone.
4. **The CR3-target count check** (§3.8) was **wrong**: §29.2.1.1 fails VM entry when the count is greater than 4, not when it exceeds the IA32_VMX_MISC figure; IA32_VMX_MISC bits 24:16 are informational and may report up to 256.
5. **The monitor-trap-flag activity-state rule** (§3.13) was **wrong** in the other direction: §28.5.2 says no MTF VM-exit occurs in the shutdown or wait-for-SIPI states, while an MTF exit from the HLT state does occur.
6. **The descriptor-table claim** (§3.3) conflated the load and store forms: LGDT, LIDT, LLDT and LTR were always privileged; only SGDT, SIDT, SLDT and STR ran at CPL 3 on pre-VMX x86.
7. **The IDT-vectoring field names** (§3.4.2) are the pre-092 names. Rev 092 calls them the original-event identification field and the original-event error code field; both names are now given.

No bit positions are stated in this chapter; they all live in `02-vmcs.md` §2.8, so a correction to a control's bit number needs to be made there once rather than in both files.
