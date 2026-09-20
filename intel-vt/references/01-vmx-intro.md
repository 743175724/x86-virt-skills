# 01. Introduction to Virtual Machine Extensions

> **中文速览**：本章讲 VMX 的"开机前半小时"——两种处理器操作模式（VMX root / VMX non-root）如何划分 VMM 与 guest 的世界，一个 VMM 从上电到跑起第一个 guest 要走的完整生命周期（CPUID 探测 → IA32_FEATURE_CONTROL 解锁 → CR0/CR4 固定位调整 → CR4.VMXE → VMXON region → VMXON → VMXOFF），以及这条链路上每个能力寄存器的确切位含义（CPUID.1:ECX.VMX[bit 5]、IA32_FEATURE_CONTROL bit 0/1/2、IA32_VMX_BASIC）。写 hypervisor 初始化代码、排查 "VMXON 触发 #GP 或 VMfailInvalid"、判断某台机器为何不能跑实模式 guest 时读本章。VMCS 自身的格式与字段编码见 `02-vmcs.md`；non-root 下"什么会触发 VM-exit"见 `03-nonroot-operation.md`；VMX 指令逐条语义见 `08-vmx-instructions.md`。章末附简史，其中日期类事实一律标注 Tier-2 来源，不冒充 SDM 原文。

**Maps to:** Intel SDM Vol.3C Ch.26 "Introduction to Virtual Machine Extensions" (rev 092) [1]
**Owns:** VMX operation modes · VMM/guest life cycle · the VMX enabling chain (CPUID / IA32_FEATURE_CONTROL / CR4.VMXE / CR0-CR4 fixed bits) · IA32_VMX_BASIC · VMXON region format · entering and leaving VMX operation · VT-x history
**See also:** `02-vmcs.md` (VMCS region and field encodings) · `03-nonroot-operation.md` (what causes VM exits) · `08-vmx-instructions.md` (per-instruction semantics and error numbers) · `09-smm-seam.md` (SMM interaction and the dual-monitor treatment)

---

## 1.1 VMX root operation and VMX non-root operation

Virtual Machine Extensions do not change the meaning of any pre-existing instruction. They add a second, orthogonal axis to the privilege model: a logical processor is either in **VMX root operation**, where a virtual-machine monitor runs, or in **VMX non-root operation**, where guest software runs. Both forms of operation support all four privilege levels, so a guest operating system keeps running at CPL 0 and sees the machine it was written for. What changes in VMX non-root operation is not what instructions mean but which instructions and events hand control back to the VMM.

- **Claim.** VMX defines two forms of processor operation: VMX root operation, in which a VMM runs, and VMX non-root operation, in which guest software runs; both support all four privilege levels.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Software in VMX root operation behaves largely as it does outside VMX operation, with two principal differences: the VMX instruction set is available, and the values that software may load into control registers are restricted.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** VMX non-root operation is restricted not by altering instruction semantics but by making selected instructions and events cause transitions to the VMM, which is what allows an unmodified guest operating system to run at CPL 0.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** A transition from VMX root operation into VMX non-root operation is a VM entry; a transition from VMX non-root operation back to VMX root operation is a VM-exit.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Both kinds of VMX transition are managed by the virtual-machine control structure (VMCS), whose format and field set are owned by `02-vmcs.md`.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`

This is the direct answer to the classical x86 virtualization problem. On pre-VMX IA-32 a set of sensitive instructions did not fault when executed outside CPL 0, so a monitor could not intercept them merely by deprivileging the guest (§1.10.1). VMX makes interception a property of the *mode*, configured per virtual machine by the VMM, rather than a property of the instruction encoding.

### 1.1.1 Why a second axis rather than a new privilege level

The alternative design — adding a "ring -1" below CPL 0 — would have forced every guest operating system to move, because an operating system's own code is written on the assumption that CPL 0 is the most privileged level and that its own data structures, its IDT and its page tables are the ones in force. By making root and non-root a second axis instead, VMX leaves the guest's entire privilege model intact: the guest keeps CPL 0, its own IDT, its own GDT, its own CR3 and its own page tables, and the VMM's equivalents are swapped in wholesale by the VM-exit.

This choice is what makes the rest of the architecture look the way it does. Because the two worlds have completely separate register state, the VMCS must carry two full state areas (`02-vmcs.md` §2.6 and §2.7). Because a guest at CPL 0 can execute anything, interception has to be configurable per instruction class rather than derived from privilege (`03-nonroot-operation.md`). And because the guest's own IDT stays in force, a VMM that wants to deliver an exception to the guest injects it rather than emulating a dispatch, which is why event injection is part of VM entry rather than a separate mechanism (`04-vm-entry.md`).

### 1.1.2 Terminology used throughout this knowledge base

| Term | Meaning | Not to be confused with |
|---|---|---|
| VMX operation | The state a logical processor is in between VMXON and VMXOFF | VMX non-root operation, which is one of its two forms |
| VMX root operation | The form of VMX operation in which the VMM runs | Being outside VMX operation entirely |
| VMX non-root operation | The form of VMX operation in which guest software runs | A privilege level; it is orthogonal to CPL |
| VM entry | A transition into VMX non-root operation | VMXON, which enters VMX operation but no guest |
| VM-exit | A transition out of VMX non-root operation | VMXOFF, which leaves VMX operation altogether |
| VMXON region | The per-logical-processor region VMXON takes as operand | A VMCS: it has the same format but is never accessed by VMREAD or VMWRITE |
| VMCS | The per-virtual-processor control structure | The VMXON region |

The spellings in the left column — "VM entry" unhyphenated, "VM-exit" hyphenated, "guest-physical address" as one hyphenated term — are the forms this knowledge base uses everywhere, so that a reader can grep for them.

---

## 1.2 The VMM and guest life cycle

The life cycle of a VMM on one logical processor is a strict sequence. Software must enable VMX in the platform and in the processor before any VMX instruction other than VMXON can be used, and it leaves VMX operation only through VMXOFF.

1. Check that the processor supports VMX — CPUID, §1.3.
2. Check that platform firmware has enabled VMXON — IA32_FEATURE_CONTROL, §1.4.
3. Adjust CR0 and CR4 to values supported in VMX operation, and set CR4.VMXE — §1.5.
4. Allocate and initialise a VMXON region — §1.7.
5. Execute VMXON; the logical processor is now in VMX root operation — §1.8.
6. Per virtual processor: allocate a VMCS, VMCLEAR it, VMPTRLD it, populate it with VMWRITE — see `02-vmcs.md`.
7. Enter the guest with VMLAUNCH (first entry after VMCLEAR) or VMRESUME (subsequent entries), service each VM-exit, re-enter.
8. Execute VMXOFF to leave VMX operation, after which CR4.VMXE may be cleared.

- **Claim.** A logical processor enters VMX operation by executing VMXON and leaves it by executing VMXOFF; VMXOFF is the only architectural exit from VMX operation.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM must use VMLAUNCH for the first VM entry with a given VMCS after that VMCS has been made clear by VMCLEAR, and VMRESUME for subsequent VM entries with the same VMCS; the underlying launch-state model is owned by `02-vmcs.md` §2.4.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Processor state that a VM-exit does not save into the VMCS — notably the general-purpose registers — is the VMM's responsibility to save and restore in software around each VM entry.  `[SDM 3C Ch.26]` `[1]` `C:medium` `V:durable`

That last point is a deliberate cost trade. VMX saves and restores only the state whose correctness the hardware must guarantee (control registers, the hidden parts of segment registers, descriptor-table registers, the instruction pointer and flags) and leaves cheap-to-save state to software. It is why a production VM entry path is a hand-written assembly stub wrapped around VMLAUNCH/VMRESUME rather than a single instruction.

### 1.2.1 The enabling sequence in one listing

Every constant in the listing below is stated as a claim in §1.3 through §1.7; the listing exists to show the order, not to introduce new facts.

```c
/* Enter VMX operation on one logical processor. Error paths abbreviated. */

if (!(cpuid_1().ecx & (1u << 5)))            /* CPUID.1:ECX.VMX[bit 5]        */
        return -ENODEV;                      /* no VMX on this part           */

uint64_t fc = rdmsr(IA32_FEATURE_CONTROL);   /* MSR 3AH                       */
if (!(fc & FC_LOCK))                         /* bit 0 clear: firmware left it */
        wrmsr(IA32_FEATURE_CONTROL,          /* open, so we may set it        */
              fc | FC_LOCK | FC_VMXON_OUTSIDE_SMX);   /* bits 0 and 2         */
else if (!(fc & FC_VMXON_OUTSIDE_SMX))       /* bit 2 clear and locked        */
        return -EPERM;                       /* VMX disabled by firmware      */

uint64_t basic  = rdmsr(IA32_VMX_BASIC);     /* MSR 480H                      */
uint32_t rev_id = basic & 0x7fffffffu;       /* bits 30:0                     */
size_t   size   = (basic >> 32) & 0x1fffu;   /* bits 44:32, never above 4096  */
unsigned mtype  = (basic >> 50) & 0xfu;      /* bits 53:50, 6 = write-back    */
bool     have_true_msrs = (basic >> 55) & 1; /* bit 55                        */

/* Force CR0 and CR4 into the window the fixed-bit MSRs allow.               */
cr0 = (cr0 | rdmsr(IA32_VMX_CR0_FIXED0)) & rdmsr(IA32_VMX_CR0_FIXED1);
cr4 = (cr4 | rdmsr(IA32_VMX_CR4_FIXED0)) & rdmsr(IA32_VMX_CR4_FIXED1);
write_cr0(cr0);
write_cr4(cr4 | CR4_VMXE);                   /* CR4 bit 13                    */

void *vmxon = alloc_4k_aligned(size, mtype); /* one region per logical CPU    */
*(uint32_t *)vmxon = rev_id;                 /* bit 31 must remain 0          */

if (vmxon_insn(virt_to_phys(vmxon)))         /* CF set: VMfailInvalid         */
        return -EIO;
/* The logical processor is now in VMX root operation. */
```

The `(value | FIXED0) & FIXED1` idiom is the whole of the fixed-bit rule expressed in two operations: the OR forces on every bit the FIXED0 MSR requires, and the AND forces off every bit the FIXED1 MSR forbids. A VMM that computes this per logical processor rather than once per system will also behave correctly on a platform with heterogeneous cores.

---

## 1.3 Discovering VMX: CPUID.1:ECX.VMX[bit 5]

- **Claim.** CPUID function 1 returns a VMX feature flag in ECX bit 5, written CPUID.1:ECX.VMX[bit 5]; the value 1 indicates that the processor supports VMX operation.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** When CPUID.1:ECX.VMX[bit 5] is 0, the VMX capability MSRs are not architecturally defined on that processor, so software must test the CPUID bit before reading them.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** The detailed capabilities of a processor's VMX implementation are reported not by CPUID but by a family of read-only VMX capability MSRs, enumerated in the VMX capability reporting facility appendix.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

CPUID answers only "does this part implement VMX at all". Every other question a VMM has — which controls exist, which of them may be turned off, how large a VMCS is, what memory type it must use — is answered by the capability MSRs. A correct VMM therefore never infers feature availability from a model number.

---

## 1.4 IA32_FEATURE_CONTROL: the platform lock and the two enable bits

Even on a processor that supports VMX, platform firmware decides whether VMXON is permitted. That decision lives in one MSR which firmware writes and then locks; the lock holds until the next power-up reset, which is what makes a "Intel VT-x: Disabled" firmware setting effective against software that runs afterwards.

- **Claim.** IA32_FEATURE_CONTROL is MSR address 3AH.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_FEATURE_CONTROL bit 0 is the lock bit: while it is 0, execution of VMXON causes a general-protection exception; once it is set to 1, WRMSR to IA32_FEATURE_CONTROL causes a general-protection exception until the next power-up reset.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_FEATURE_CONTROL bit 1 enables VMXON in SMX operation and bit 2 enables VMXON outside SMX operation; VMXON checks the bit that matches the current SMX state and causes a general-protection exception if that bit is clear.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Because the lock bit makes the MSR read-only once firmware has set it, system firmware uses IA32_FEATURE_CONTROL to offer a durable platform option that disables VMX and that operating-system software cannot override at run time.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`

A VMM that finds bit 0 set and bit 2 clear must report "VMX disabled by firmware" rather than retry: there is no software path to change the MSR before the next power cycle. A VMM that finds bit 0 clear may set bits 0 and 2 itself, which is what the Linux kvm_intel module does at load time [106].

---

## 1.5 CR4.VMXE and the CR0/CR4 fixed-bit MSRs

- **Claim.** System software enables VMX by setting CR4.VMXE, which is CR4 bit 13; VMXON causes an invalid-opcode exception if executed with CR4.VMXE = 0.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Once a logical processor is in VMX operation it is not possible to clear CR4.VMXE; the bit can be cleared only after VMXOFF.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** The values CR0 and CR4 may hold in VMX operation are constrained by four capability MSRs: IA32_VMX_CR0_FIXED0 at 486H, IA32_VMX_CR0_FIXED1 at 487H, IA32_VMX_CR4_FIXED0 at 488H and IA32_VMX_CR4_FIXED1 at 489H.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The fixed-bit rule is: if bit N of the FIXED0 MSR is 1 then bit N of the corresponding control register must be 1 in VMX operation, and if bit N of the FIXED1 MSR is 0 then bit N of that control register must be 0.  `[SDM 3C Ch.26]` `[2]` `C:high` `V:durable`
- **Claim.** In VMX operation, an attempt by CLTS, LMSW or MOV to CR to give a fixed bit an unsupported value causes a general-protection exception.  `[SDM 3C Ch.26]` `[1]` `C:medium` `V:durable`
- **Claim.** The first processors to support VMX operation required CR0.PE, CR0.NE, CR0.PG and CR4.VMXE to be 1 in VMX operation, which restricted VMX operation to paged protected mode and therefore prevented guest software from running in unpaged protected mode or in real-address mode.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** The guest-side half of that restriction was later removed by the unrestricted-guest control; see `03-nonroot-operation.md` §3.12 rather than assuming the first-generation rule still applies.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`

The distinction matters when reading older material. The fixed-bit MSRs constrain CR0 and CR4 **in VMX operation**, that is, for the VMM's own register values. A guest's CR0.PE and CR0.PG are checked separately at VM entry, and it is those guest checks that the unrestricted-guest control relaxes.

---

## 1.6 IA32_VMX_BASIC: the VMX basic capability MSR

IA32_VMX_BASIC is the first MSR a VMM reads after CPUID. It supplies the revision identifier that must be stamped into every VMXON region and VMCS, the size and memory type of those regions, and the flag that tells software whether the "true" control-capability MSRs exist.

- **Claim.** IA32_VMX_BASIC is MSR address 480H and is read-only.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 30:0 contain the 31-bit VMCS revision identifier that software must write into the first four bytes of every VMXON region and every VMCS region; bit 31 of the MSR is always 0.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 44:32 report the number of bytes software should allocate for the VMXON region and for each VMCS region; the reported value is never greater than 4096.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 53:50 report the memory type the logical processor uses to access the VMXON region, the VMCS and referenced data structures; the value 0 means uncacheable and the value 6 means write-back.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 48, when 1, indicates that physical addresses used for the VMXON region, the VMCS and structures referenced by VMCS pointer fields are limited to 32 bits.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 49, when 1, indicates support for the dual-monitor treatment of SMIs and SMM, whose mechanics are owned by `09-smm-seam.md`.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 54, when 1, indicates that the processor reports instruction information on VM exits due to the INS and OUTS instructions.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 55, when 1, indicates that the IA32_VMX_TRUE_PINBASED_CTLS, IA32_VMX_TRUE_PROCBASED_CTLS, IA32_VMX_TRUE_EXIT_CTLS and IA32_VMX_TRUE_ENTRY_CTLS MSRs are supported and report which default-1 controls may be cleared; the default-1 rule itself is explained in `02-vmcs.md` §2.8.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 56, when 1, indicates that VM entry allows injection of a software interrupt, software exception or privileged software exception with an instruction length of 0.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

The revision identifier is not decorative. A VMCS stamped with another processor generation's revision identifier is rejected by VMPTRLD, and that rejection is precisely the mechanism that makes an implementation-specific, undocumented VMCS layout safe across generations.

### 1.6.1 Reading IA32_VMX_BASIC on a real machine

A single `rdmsr 0x480` answers five separate questions, and reading it is the fastest way to sanity-check any claim in this chapter against the hardware in front of you:

| Field | Bits | Question it answers |
|---|---|---|
| Revision identifier | 30:0 | What value must be stamped into the VMXON region and every VMCS? |
| Region size | 44:32 | How many bytes must each region be? |
| 32-bit address limit | 48 | Must VMCS-referenced physical addresses fit in 32 bits? |
| Dual-monitor support | 49 | Can this processor host an SMM monitor? |
| Memory type | 53:50 | Which memory type must the regions use — 6 means write-back? |
| INS/OUTS reporting | 54 | Will VM exits on string I/O carry instruction information? |
| "True" MSRs present | 55 | Must default-1 controls be read from the ordinary or the "true" capability MSRs? |
| Zero-length injection | 56 | May VM entry inject a software event with instruction length 0? |

A VMM should record all of these once per logical processor at initialisation. Re-reading them per VM entry is wasted work; ignoring bit 55 in particular is the mistake that leaves CR3 exiting enabled forever on a machine that supports EPT (see `02-vmcs.md` §2.8.4).

### 1.6.2 The rest of the capability MSR family

IA32_VMX_BASIC is the head of a contiguous block of read-only MSRs. Knowing the whole block by address is useful because a VMX capability dump is the first artefact worth collecting from any machine whose behaviour is in question.

- **Claim.** The VMX capability MSRs occupy a contiguous block beginning at 480H; besides those named elsewhere in this chapter, the block includes IA32_VMX_MISC at 485H, IA32_VMX_VMCS_ENUM at 48AH, IA32_VMX_EPT_VPID_CAP at 48CH and the secondary VM-exit control capability MSR at 493H.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_MISC at 485H reports implementation parameters that no other MSR carries, including the rate at which the VMX-preemption timer decrements relative to the time-stamp counter, the activity states the implementation supports, and the number of CR3-target values it provides.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

| MSR | Address | Read it for | Owner |
|---|---|---|---|
| IA32_VMX_BASIC | 480H | Revision identifier, region size and type, "true" MSR support | §1.6 |
| IA32_VMX_PINBASED_CTLS | 481H | Pin-based control constraints | `02-vmcs.md` §2.8.1 |
| IA32_VMX_PROCBASED_CTLS | 482H | Primary processor-based control constraints | `02-vmcs.md` §2.8.2 |
| IA32_VMX_EXIT_CTLS | 483H | VM-exit control constraints | `02-vmcs.md` §2.9 |
| IA32_VMX_ENTRY_CTLS | 484H | VM-entry control constraints | `02-vmcs.md` §2.9 |
| IA32_VMX_MISC | 485H | Preemption-timer rate, activity states, CR3-target count | §1.6.2 |
| IA32_VMX_CR0_FIXED0/1 | 486H/487H | CR0 constraints in VMX operation | §1.5 |
| IA32_VMX_CR4_FIXED0/1 | 488H/489H | CR4 constraints in VMX operation | §1.5 |
| IA32_VMX_VMCS_ENUM | 48AH | Highest VMCS field index | `02-vmcs.md` §2.12 |
| IA32_VMX_PROCBASED_CTLS2 | 48BH | Secondary control constraints | `02-vmcs.md` §2.8.3 |
| IA32_VMX_EPT_VPID_CAP | 48CH | EPT and VPID capabilities | `06-address-translation.md` |
| IA32_VMX_TRUE_* | 48DH–490H | Real allowed-0 settings for default-1 controls | `02-vmcs.md` §2.8.4 |
| IA32_VMX_VMFUNC | 491H | Supported VM functions | `02-vmcs.md` §2.8.5 |
| IA32_VMX_PROCBASED_CTLS3 | 492H | Tertiary control constraints | `02-vmcs.md` §2.8.4 |

---

## 1.7 The VMXON region

- **Claim.** The operand of VMXON is a memory operand holding the 4-KByte-aligned physical address of the VMXON region.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** The VMXON region must be aligned on a 4-KByte boundary, so bits 11:0 of its physical address must be 0, and VMXON fails if the address sets any bit beyond the processor's physical-address width.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Software should allocate the VMXON region with the size reported in IA32_VMX_BASIC bits 44:32 and must write the VMCS revision identifier from IA32_VMX_BASIC bits 30:0 into the first four bytes of the region before executing VMXON.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON fails if bits 30:0 of the first four bytes of the VMXON region do not match the VMCS revision identifier reported in IA32_VMX_BASIC, or if bit 31 of that doubleword is 1.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The VMXON region should be held in memory of the type reported in IA32_VMX_BASIC bits 53:50 — write-back on processors that report 6 — because using an uncacheable type is architecturally permitted but significantly degrades the performance of VMX transitions.  `[SDM 3C Ch.26]` `[1]` `C:medium` `V:durable`
- **Claim.** The VMXON region uses the same region format as a VMCS but is never accessed by VMREAD or VMWRITE; after VMXON the region belongs to the logical processor and software must not read or write its contents.  `[SDM 3C Ch.26]` `[1]` `C:medium` `V:durable`
- **Claim.** Each logical processor requires its own VMXON region, which stays bound to that logical processor for as long as it remains in VMX operation.  `[SDM 3C Ch.26]` `[1]` `C:medium` `V:durable`

---

## 1.8 VMXON and VMXOFF

The complete per-instruction semantics — operand forms, the full exception list, the numeric error codes — belong to `08-vmx-instructions.md`. What matters here is the state change VMXON makes and the two failure channels a VMM must test after every VMX instruction.

- **Claim.** VMXON causes an invalid-opcode exception if executed with a register operand, with CR0.PE = 0, with CR4.VMXE = 0, with RFLAGS.VM = 1, or in IA-32e mode with CS.L = 0.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`
- **Claim.** VMXON causes a general-protection exception if executed at CPL greater than 0, if the current values of CR0 or CR4 are unsupported in VMX operation per the fixed-bit MSRs, or if the IA32_FEATURE_CONTROL lock bit or the applicable VMXON-enable bit is clear.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`
- **Claim.** On successful VMXON the logical processor enters VMX operation, sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH, blocks INIT signals, and blocks and disables A20M.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMX instructions report failure through two distinguishable channels: VMfailInvalid sets RFLAGS.CF and is used when there is no valid current VMCS, while VMfailValid sets RFLAGS.ZF and records a numeric error code in the VMCS — see `08-vmx-instructions.md` for the error-code list.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXOFF takes the logical processor out of VMX operation, after which CR4.VMXE may be cleared and INIT signals and A20M behave as they do outside VMX operation.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`

Because VMXON blocks INIT, a logical processor in VMX operation cannot be restarted through the normal INIT–SIPI path. A VMM that must allow platform reset, kexec or a crash dump therefore has to execute VMXOFF on every online logical processor first; production hypervisors do exactly this in their reboot and panic paths [106].

### 1.8.1 Diagnosing a failed VMXON

The failure modes are few and each maps to exactly one precondition, so a VMM that reports the wrong one is usually guessing rather than testing.

| Observed result | Precondition to check |
|---|---|
| #UD | CR4.VMXE is 0, or the processor is in real-address or virtual-8086 mode, or the code segment is 32-bit while in IA-32e mode, or the operand was a register |
| #GP(0) | CPL is greater than 0, or IA32_FEATURE_CONTROL is locked with the applicable VMXON-enable bit clear, or CR0/CR4 hold values outside the fixed-bit window |
| RFLAGS.CF = 1 (VMfailInvalid) | The operand address is not 4-KByte aligned or exceeds the physical-address width, or the doubleword at the start of the VMXON region does not carry the revision identifier from IA32_VMX_BASIC bits 30:0, or its bit 31 is set |
| VMXON succeeds, VMPTRLD sets CF | The VMCS region was not stamped with the revision identifier, or the same page is being used for both the VMXON region and the VMCS |
| First VM entry sets CF rather than ZF | There is no current VMCS: VMPTRLD was never executed, or a VMCLEAR made it not current |
| First VM entry sets ZF | The control or host-state checks failed; the reason is a numeric code in the VM-instruction error field — see `08-vmx-instructions.md` |

The distinction between the two flags is worth internalising early: CF means "the instruction could not even find a valid VMCS to work with", ZF means "the instruction found the VMCS and rejected its contents", and only in the second case is there an error code to read.

---

## 1.9 What else changes in VMX operation

- **Claim.** In VMX operation the processor blocks INIT signals and disables A20M, and both effects persist until VMXOFF.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The VMX instruction set is usable only in VMX root operation; executing a VMX instruction in VMX non-root operation causes a VM-exit instead of executing the instruction, which is what prevents a guest from escaping by issuing VMXOFF.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** System-management interrupts and system-management mode interact with VMX operation through a separate architecture — the default treatment and the dual-monitor treatment — owned by `09-smm-seam.md`.  `[SDM 3C Ch.34]` `[1]` `C:medium` `V:durable`

### 1.9.1 Bringing up application processors under a VMM

Because VMXON blocks INIT, the order in which a VMM starts secondary logical processors matters. The bootstrap processor cannot execute VMXON and then expect to start the others with the ordinary INIT–SIPI–SIPI sequence, because those signals no longer initialise a processor that is already in VMX operation. The workable orders are to bring every application processor out of reset first and have each of them execute its own VMXON, which is what an operating-system-hosted VMM does when it loads as a driver, or to leave the application processors in wait-for-SIPI and hand the SIPI to the guest, which is what a VMM that virtualizes processor start-up does — in that case the SIPI is delivered to a guest whose activity state is wait-for-SIPI and produces a VM-exit instead (see `03-nonroot-operation.md` §3.4).

A related consequence appears at shutdown. Kernel crash paths, kexec and firmware-assisted reboot all assume they can INIT the processors; a VMM that has not executed VMXOFF turns all three into a hang. This is the single most common integration bug in kernel-resident hypervisors and it has nothing to do with the VMCS.

### 1.9.2 The VT family names

"VT-x" names the processor extensions this chapter describes, and it is only one member of a family of marketing names that address different parts of the platform. They are not interchangeable, and a question about one is rarely a question about another.

- **Claim.** VT-x denotes the IA-32 and Intel 64 processor virtualization extensions — VMX — while Intel Virtualization Technology for Directed I/O, VT-d, is a separate platform specification covering DMA remapping and interrupt remapping, published as its own document rather than in the SDM.  `[VT-d 5.20 Ch.1]` `[8]` `C:high` `V:durable`
- **Claim.** VT-d is owned by chapters 10 through 12 of this knowledge base and its specification is a distinct Intel document with its own revision numbering, so SDM chapter numbers never apply to it.  `[VT-d 5.20 Ch.1]` `[8]` `C:high` `V:durable`

VT-i, the Itanium counterpart described alongside VT-x in the 2005 IEEE Computer paper, has no current relevance and is mentioned here only because the historical sources treat the two as one announcement (§1.10.2). VT-c is a network-controller marketing name and does not correspond to any processor feature.

---

## 1.10 A short history of VT-x

This section is deliberately fenced off from the architectural claims above. **The SDM dates nothing.** Every date below rests on a Tier-2 or Tier-3 source. Where a claim carries both an SDM anchor and a non-Intel citation, the SDM anchor attests the *mechanism* and the other citation attests the *date*. Feature-to-generation attributions that the old source material could support only with blog or encyclopaedia pages have been dropped rather than restated, and the evidence graph of the old history file — whose timeline table pointed at evidence records that do not exist — has not been carried over.

### 1.10.1 The problem VMX was built to solve

- **Claim.** The formal criterion for classical trap-and-emulate virtualization was stated by Popek and Goldberg in Communications of the ACM 17(7), July 1974, pages 412–421: a VMM can be constructed if the set of sensitive instructions is a subset of the privileged instructions.  `[SDM 3C Ch.26]` `[103]` `C:high` `V:durable`
- **Claim.** Robin and Irvine showed at the 9th USENIX Security Symposium in August 2000 that IA-32 violates that criterion, identifying a group of sensitive instructions — commonly counted as seventeen — that do not fault when executed outside CPL 0, which is why pre-VMX x86 monitors needed binary translation or paravirtualization.  `[SDM 3C Ch.26]` `[104]` `C:high` `V:durable`
- **Claim.** VMX resolves the problem without changing those instructions: in VMX non-root operation the VMM configures which instructions and events cause a VM-exit, so instructions such as SGDT, SIDT, SLDT, SMSW, PUSHF and POPF can be intercepted without being privileged.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`

### 1.10.2 From Vanderpool to VT-x

- **Claim.** Intel announced the release of a preliminary external architecture specification for the virtualization extensions then codenamed Vanderpool on 2005-01-20, covering both IA-32 and Itanium platforms.  `[SDM 3C Ch.26]` `[100]` `C:high` `V:durable`
- **Claim.** The first systematic public description of the architecture, "Intel Virtualization Technology" by Uhlig, Neiger, Rodgers and colleagues, appeared in IEEE Computer 38(5), May 2005, pages 48–56, and covered both VT-x for IA-32 and VT-i for Itanium.  `[SDM 3C Ch.26]` `[101]` `C:high` `V:durable`
- **Claim.** Intel shipped the first VT-x-capable processors, the Pentium 4 models 662 and 672, on 2005-11-14; this date is attested only by a Tier-3 encyclopaedia source and should be re-verified against Intel product documentation before being published as fact.  `[SDM 3C Ch.26]` `[105]` `C:low` `V:durable`
- **Claim.** A further Intel account of the VT-x design rationale, by Neiger and colleagues, appeared in the Intel Technology Journal volume 10 issue 3 in August 2006.  `[SDM 3C Ch.26]` `[102]` `C:medium` `V:durable`

### 1.10.3 How the architecture grew

The shape of VMX growth is legible in the SDM itself, with no dating source required: the VM-execution controls were extended in layers, each layer gated by a bit in the layer above it.

- **Claim.** The original VM-execution controls comprised the pin-based and primary processor-based controls; a secondary 32-bit control field was added and gated behind bit 31 of the primary controls, and a tertiary 64-bit control field was added later and gated behind the "activate tertiary controls" bit of the primary controls — the bit lists are owned by `02-vmcs.md` §2.8.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** The same layered-extension pattern later reached the VM-exit controls, where a secondary VM-exit control field has its own capability MSR — see `02-vmcs.md` §2.9.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** The first-generation requirement that a guest run in paged protected mode was lifted by the unrestricted-guest control, and the cost of intercepting address translation was removed by EPT; both arrived as VM-execution controls rather than as new processor modes, preserving the "no new instruction semantics" design rule.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`

### 1.10.4 What this chapter deliberately does not claim

The material this chapter was rebuilt from attached specific microarchitecture generations to specific VMX features, sourced to encyclopaedia and blog pages. Those attributions have not been carried over: a Tier-3 source is never sufficient for a hardware-availability claim, and Intel does not publish a feature-to-generation table. Where first availability matters to a reader, the answerable question is not "which generation" but "does IA32_VMX_PROCBASED_CTLS2 report this control on this part", which is answered in `02-vmcs.md` §2.8.

Two dating disputes from the old material remain open and are recorded in `errata.md` rather than resolved here: the generation in which FlexPriority first shipped, and the generation to which VMFUNC and EPTP switching should be attributed.

---

## 1.11 Where the rest of VMX lives

| Question | File |
|---|---|
| VMCS region format, field encodings, control-bit lists, guest and host state areas | `02-vmcs.md` |
| What causes a VM-exit in VMX non-root operation; bitmaps, masks, windows | `03-nonroot-operation.md` |
| VM-entry checks and the loading sequence | `04-vm-entry.md` |
| VM-exit reasons, exit qualification, VM-exit information fields | `05-vm-exit.md` |
| EPT, VPID, PML, SPP, HLAT | `06-address-translation.md` |
| APIC virtualization and posted interrupts | `07-apic-virtualization.md` |
| Per-instruction VMX semantics and error numbers | `08-vmx-instructions.md` |
| SMM, the dual-monitor treatment, SEAM | `09-smm-seam.md` |
| Nested virtualization, including the use made of VMCS shadowing | `14-nested-virtualization.md` |

---

## 1.12 Checklist before the first VM entry

Everything in this list is a consequence of a claim above; the list is the order in which a VMM should verify its own state when the first VM entry does not work.

1. **CPUID.1:ECX.VMX[bit 5] is 1.** If not, nothing else in this chapter applies (§1.3).
2. **IA32_FEATURE_CONTROL bit 0 is 1 and the enable bit matching the current SMX state is 1.** If the MSR is locked with the enable bit clear, the platform has to be reconfigured in firmware (§1.4).
3. **CR0 and CR4 have been passed through the FIXED0/FIXED1 window, and CR4.VMXE is set.** Do this per logical processor, not once for the system (§1.5).
4. **The VMXON region is 4-KByte aligned, of the size IA32_VMX_BASIC reports, in memory of the type it reports, and stamped with the revision identifier with bit 31 clear** (§1.6, §1.7).
5. **VMXON returned with neither CF nor ZF set.** If a flag is set, use the table in §1.8.1 before changing anything else.
6. **Each virtual processor has its own VMCS, stamped with the same revision identifier, VMCLEARed before its first use, and VMPTRLDed on the logical processor that is about to enter** (see `02-vmcs.md` §2.4).
7. **The host-state area describes the logical processor that will take the VM-exit**, including host RSP, host RIP, the TR base and the GDTR and IDTR bases, and the host address-space size VM-exit control is 1 on a 64-bit VMM (see `02-vmcs.md` §2.7).
8. **VMLAUNCH is used for the first entry and VMRESUME for every entry after it**, with the launch state tracked in software (see `02-vmcs.md` §2.4).

Items 1 through 5 belong to this chapter; items 6 through 8 are the handover point to `02-vmcs.md`, which owns everything about the structure the processor reads once VMX operation has begun.

---

## 1.13 What a verifier should check against the PDF

Claims in this chapter marked `C:high` were either read from the SDM text directly or are structurally forced by other claims that were. The items below are marked `C:medium` or `C:low` and are the ones worth a second pass against Volume 3C chapter 26, Volume 3C chapter 33 and Volume 3D appendix A:

1. **IA32_VMX_BASIC bits 48, 49, 54 and 56** (§1.6). The bit positions are stated from the capability appendix but were not re-read from the PDF in this pass; bits 30:0, 44:32, 53:50 and 55 are the load-bearing ones and are `C:high`.
2. **The exact #UD and #GP condition lists for VMXON** (§1.8). The conditions listed are the ones a VMM must handle, but the SDM's list is longer and the ordering between conditions matters for which exception is reported.
3. **The claim that the VMXON region must not be accessed by software after VMXON** (§1.7). This is architecturally required but the precise wording of the prohibition should be quoted before being relied on in a security argument.
4. **The 2005-11-14 ship date** (§1.10.2) is `C:low` on a Tier-3 source and should either be re-anchored to Intel product documentation or dropped.
5. **The dual-monitor treatment reference** (§1.6, §1.9) is a pointer into `09-smm-seam.md`; if that chapter contradicts the bit-49 claim here, that chapter wins.

Nothing in this chapter depends on a section number finer than a chapter for Volume 3C, which is deliberate: chapter 26's internal section numbering was not verified in this pass, so every anchor here is either a chapter-level Volume 3C anchor or an appendix-level Volume 3D anchor.
