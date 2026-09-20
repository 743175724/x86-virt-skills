# 08. VMX Instructions and Capability Reporting

> **中文速览**：本章是 VMX 指令集的规格书，对应 SDM Vol.3C 第 33 章 "VMX Instruction Reference"、§27.9.5（VM-instruction error 字段）与 Vol.3D 附录 A（VMX 能力报告 MSR）。三块硬内容：每条指令的操作数、前置状态、异常与失败路径（#UD / #GP / VMfailInvalid / VMfailValid 及 CF/ZF 标志协议）；**完整的 VM-instruction error 编号表 1–28**——这是排查 VMfailValid 的唯一入口，旧版技能整表缺失；INVEPT/INVVPID 的描述符格式与 type 取值。最后是能力 MSR 480H–493H 的地址与语义，写控制字段前必须先读它们，否则 VM entry 会以 error 7 失败。VM-entry 检查清单见 `04-vm-entry.md`，退出原因见 `05-vm-exit.md`。

**Maps to:** Intel SDM Vol.3C Ch.33 "VMX Instruction Reference" and §27.9.5 (rev 092) [1]; Vol.3D App.A "VMX Capability Reporting Facility" [2]
**Owns:** VMX instruction semantics, operands and exception behaviour; the VM-instruction error number table; INVEPT/INVVPID descriptors and types; the VMX capability-reporting MSRs.
**See also:** `04-vm-entry.md` §4.2 (which errors a failed VM entry produces) · `05-vm-exit.md` §5.3 (exit reasons for VMX instructions executed in VMX non-root operation) · `02-vmcs.md` (what the fields VMREAD/VMWRITE address actually mean)

---

## 8.1 The instruction set and the flag protocol

- **Claim.** The VMX instruction set consists of thirteen instructions: VMXON, VMXOFF, VMPTRLD, VMPTRST, VMCLEAR, VMREAD, VMWRITE, VMLAUNCH, VMRESUME, VMCALL, VMFUNC, INVEPT and INVVPID.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Every VMX instruction reports its outcome through RFLAGS using one of three conventions: VMsucceed, VMfailInvalid or VMfailValid.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMsucceed clears CF, PF, AF, ZF, SF and OF.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMfailInvalid sets CF to 1 and clears PF, AF, ZF, SF and OF; no error number is recorded, because there is no current VMCS in which to record one.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMfailValid sets ZF to 1, clears CF, PF, AF, SF and OF, and writes an error number into the VM-instruction error field of the current VMCS.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** The architectural rule that selects between the two failure conventions is: if there is a current VMCS, report VMfailValid with an error number; otherwise report VMfailInvalid.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-instruction error field is a 32-bit read-only VM-exit information field; software reads it with VMREAD after any instruction that set ZF.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

> Debugging convention that follows from this: after every VMX instruction, test CF first, then ZF. `CF=1` means "the VMCS pointer or the operand was structurally unusable"; `ZF=1` means "the VMCS is fine, but the operation was rejected for a reason with a number".

---

## 8.2 Failure taxonomy common to all VMX instructions

- **Claim.** All VMX instructions cause #UD if CPUID.01H:ECX.VMX[bit 5] is 0, that is, if the processor does not support VMX operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMREAD, VMRESUME, VMWRITE, VMXOFF, INVEPT and INVVPID cause #UD if executed outside VMX operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** All VMX instructions cause #UD if executed in real-address mode, in virtual-8086 mode, or in compatibility mode (IA32_EFER.LMA = 1 with CS.L = 0).  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** All VMX instructions cause #GP(0) if executed with CPL greater than 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Instructions with a memory operand can raise the ordinary memory-access exceptions — #GP(0) for a non-canonical or out-of-segment address, #SS(0) for a stack-segment violation, #PF for a page fault, and #AC for an unaligned access when alignment checking is enabled.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** In VMX non-root operation, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMREAD, VMRESUME, VMWRITE, VMXOFF, VMXON, INVEPT and INVVPID cause VM exits rather than executing, with the basic exit reasons listed in `05-vm-exit.md` §5.3.  `[SDM 3C Ch.28]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD and VMWRITE are the exception to that rule: when the "VMCS shadowing" control is 1 they may execute in VMX non-root operation against a shadow VMCS, subject to the VMREAD and VMWRITE bitmaps (see `14-nested-virtualization.md`).  `[SDM 3C §27.6.15]` `[1]` `C:high` `V:durable`

---

### 8.2.1 Instruction summary

| Instruction | Operands | Where it may execute | Primary failure modes |
|---|---|---|---|
| VMXON | m64 (VMXON region PA) | Outside VMX operation, CPL 0 | #UD, #GP(0), VMfailInvalid, error 15 |
| VMXOFF | none | VMX root operation | #UD, #GP(0), error 23 |
| VMPTRLD | m64 (VMCS PA) | VMX root operation | errors 9, 10, 11 |
| VMPTRST | m64 (destination) | VMX root operation | #UD on register operand |
| VMCLEAR | m64 (VMCS PA) | VMX root operation | errors 2, 3 |
| VMREAD | r/m, r (encoding) | VMX root operation; non-root with VMCS shadowing | VMfailInvalid, error 12 |
| VMWRITE | r (encoding), r/m | VMX root operation; non-root with VMCS shadowing | VMfailInvalid, errors 12, 13 |
| VMLAUNCH | none | VMX root operation | errors 4, 7, 8, 26 |
| VMRESUME | none | VMX root operation | errors 5, 6, 7, 8, 26 |
| VMCALL | none | VMX non-root operation (exit 18); root only under dual-monitor | error 1 in root operation |
| VMFUNC | EAX, ECX (implicit) | VMX non-root operation | #UD; VM exit 59 on failure |
| INVEPT | r (type), m128 | VMX root operation | #UD, error 28 |
| INVVPID | r (type), m128 | VMX root operation | #UD, error 28 |

- **Claim.** VMCALL and VMFUNC are the only two VMX instructions intended for execution by guest software; the other eleven are VMM instructions and cause VM exits if a guest executes them.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC is the only VMX instruction that neither causes a VM exit nor sets a VMX flag convention on success — it completes entirely within VMX non-root operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

---

## 8.3 Per-instruction reference

### 8.3.1 VMXON — Enter VMX Operation

- **Claim.** VMXON takes a single m64 source operand containing the 4-KByte-aligned physical address of the VMXON region; a register operand causes #UD.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #UD if CR4.VMXE is 0, if CR0.PE is 0, or if RFLAGS.VM is 1.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #GP(0) if the lock bit (bit 0) of IA32_FEATURE_CONTROL is clear, if the processor is in SMX operation and bit 1 of that MSR is clear, or if it is outside SMX operation and bit 2 is clear.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #GP(0) if the values in CR0 or CR4 are not permitted in VMX operation according to IA32_VMX_CR0_FIXED0/FIXED1 and IA32_VMX_CR4_FIXED0/FIXED1.  `[SDM 3C Ch.33]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** VMXON reports VMfailInvalid if the operand address is not 4-KByte aligned, sets any bit beyond the processor's physical-address width, or if the 31-bit revision identifier at the start of the VMXON region does not match the processor's VMCS revision identifier or has bit 31 set.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON executed while already in VMX root operation reports VMfailValid with error number 15.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** A successful VMXON enters VMX root operation, sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH, blocks INIT signals, and blocks and disables A20M.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

**The VMXON region.**

- **Claim.** The VMXON region has the same format conventions as a VMCS region — a 4-KByte-aligned block whose first dword holds the VMCS revision identifier — but it is never accessed with VMREAD or VMWRITE.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** Software should allocate the VMXON region with the number of bytes reported in IA32_VMX_BASIC bits 44:32 and should zero it before writing the revision identifier.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The VMXON region and every VMCS region should be mapped with the memory type reported in IA32_VMX_BASIC bits 53:50; using an uncacheable mapping when write-back is reported is architecturally permitted but significantly degrades performance.  `[SDM 3C §27.11]` `[1]` `[2]` `C:high` `V:durable`

### 8.3.2 VMXOFF — Leave VMX Operation

- **Claim.** VMXOFF takes no operands and leaves VMX operation, unblocking INIT signals and re-enabling A20M.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXOFF reports VMfailValid with error number 23 if executed under the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Whether VMXOFF unblocks SMIs depends on IA32_SMM_MONITOR_CTL, and bit 28 of IA32_VMX_MISC reports whether that MSR's bit 2 may be set.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

### 8.3.3 VMPTRLD — Load Pointer to Virtual-Machine Control Structure

- **Claim.** VMPTRLD takes an m64 operand holding the physical address of a VMCS region and makes that VMCS both active and current on the executing logical processor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 9 if the operand address is not 4-KByte aligned or sets bits beyond the physical-address width.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 10 if the operand address equals the VMXON pointer.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 11 if the 31-bit revision identifier in the referenced region does not match the processor's, or if bit 31 of that dword marks the region as a shadow VMCS on a processor that does not support VMCS shadowing (see `14-nested-virtualization.md`).  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Only one VMCS can be current on a logical processor at a time; VMPTRLD replaces the previous current VMCS, which remains active until VMCLEAR is executed for it.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.4 VMPTRST — Store Pointer to Virtual-Machine Control Structure

- **Claim.** VMPTRST takes an m64 destination operand and writes the current-VMCS pointer into it; if there is no current VMCS it writes FFFFFFFF_FFFFFFFFH.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRST causes #UD if its operand is a register.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

### 8.3.5 VMCLEAR — Clear Virtual-Machine Control Structure

- **Claim.** VMCLEAR takes an m64 operand holding the physical address of a VMCS region; it sets that VMCS's launch state to "clear", renders it inactive and not current, and ensures that data held in processor caches for that VMCS is written back to memory.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** If the operand address equals the current-VMCS pointer, VMCLEAR also sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR reports error number 2 if the operand address is not 4-KByte aligned or sets bits beyond the physical-address width.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR reports error number 3 if the operand address equals the VMXON pointer.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR must be executed for a VMCS region before its first use, and must be executed on the current logical processor before the same VMCS is used on another logical processor.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.6 VMREAD — Read Field from Virtual-Machine Control Structure

- **Claim.** VMREAD has the form `VMREAD r/m64, r64` in 64-bit mode and `VMREAD r/m32, r32` outside it: the second operand supplies the field encoding and the first receives the field's contents.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD reports VMfailInvalid if there is no current VMCS.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD reports error number 12 if the field encoding does not name a VMCS component supported by the processor.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** In 64-bit mode the source operand is 64 bits wide and can read an entire 64-bit field; outside 64-bit mode a 64-bit field must be read in two halves using the "high" access type of its field encoding.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

### 8.3.7 VMWRITE — Write Field to Virtual-Machine Control Structure

- **Claim.** VMWRITE has the form `VMWRITE r64, r/m64` in 64-bit mode and `VMWRITE r32, r/m32` outside it: the first operand supplies the field encoding and the second supplies the value.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports VMfailInvalid if there is no current VMCS.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports error number 12 if the field encoding names an unsupported VMCS component.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports error number 13 if the field encoding names a read-only VMCS component and the processor does not permit writes to such fields.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 29 of IA32_VMX_MISC reports whether VMWRITE may write to any supported VMCS field, including the read-only VM-exit information fields; this capability is what allows a nested VMM to synthesize exit information for its guest.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** VMCS fields must not be accessed by ordinary memory reads and writes; the VMCS region layout is implementation-specific and only VMREAD and VMWRITE are architecturally defined accessors.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`

### 8.3.8 VMLAUNCH and VMRESUME — Launch/Resume Virtual Machine

- **Claim.** VMLAUNCH and VMRESUME take no operands and attempt a VM entry using the current VMCS.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH reports error number 4 if the launch state of the current VMCS is not "clear"; VMRESUME reports error number 5 if the launch state is not "launched".  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Both instructions report error number 26 if there is blocking by MOV SS when they execute.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Both instructions report error number 7 if any check on the VMX controls fails, and error number 8 if any check on the host-state area fails; the full check lists are in `04-vm-entry.md` §4.3 and §4.4.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Failures detected after guest state has been loaded are not reported through RFLAGS at all: they appear as VM exits with basic exit reason 33, 34 or 41 and the VM-entry-failure bit set in the exit-reason field.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** Intel states that VMRESUME is expected to have lower latency than VMLAUNCH, which is why hypervisors track launch state in software and prefer VMRESUME.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.9 VMCALL — Call to VM Monitor

- **Claim.** VMCALL takes no operands and causes a VM exit with basic exit reason 18 when executed in VMX non-root operation; this is the architectural hypercall primitive.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCALL executed in VMX root operation outside the dual-monitor treatment of SMIs and SMM reports VMfailValid with error number 1.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`
- **Claim.** Under the dual-monitor treatment, VMCALL executed in VMX root operation activates the SMM-transfer monitor and is subject to its own checks, which produce error numbers 19, 20, 22 and 24.  `[SDM 3C §27.9.5]` `[1]` `C:medium` `V:durable`
- **Claim.** VMCALL causes #UD if executed in virtual-8086 mode or in compatibility mode, and #GP(0) if CPL is greater than 0 in VMX root operation.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`

### 8.3.10 VMFUNC — Invoke VM Function

- **Claim.** VMFUNC takes its function number in EAX and a function-specific parameter in ECX, and is the only VMX instruction intended to be executed by guest software in VMX non-root operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC causes #UD if executed in VMX root operation, if the "enable VM functions" secondary control is 0, if EAX is 63 or greater, or if the bit of the VM-function controls selected by EAX is 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VM function 0 is EPTP switching: ECX selects an entry in the EPTP list, and a successful invocation replaces the current EPT pointer without a VM exit.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`
- **Claim.** If the requested VM function cannot be completed — for example because ECX is 512 or greater, or the selected EPTP list entry is invalid — VMFUNC causes a VM exit with basic exit reason 59 instead of raising an exception.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC does not modify RFLAGS; it has no VMfail convention, because its failure path is a VM exit.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`

### 8.3.11 INVEPT — Invalidate Translations Derived from EPT

- **Claim.** INVEPT has the form `INVEPT r64, m128` in 64-bit mode and `INVEPT r32, m128` outside it: the register operand supplies the INVEPT type and the memory operand supplies a 128-bit INVEPT descriptor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT causes #UD if the processor does not support EPT, and #UD if the memory operand is a register.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT reports VMfailValid with error number 28 if the type value is not supported by the processor or if the descriptor is invalid for the requested type.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

### 8.3.12 INVVPID — Invalidate Translations Based on VPID

- **Claim.** INVVPID has the form `INVVPID r64, m128` in 64-bit mode and `INVVPID r32, m128` outside it: the register operand supplies the INVVPID type and the memory operand supplies a 128-bit INVVPID descriptor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID causes #UD if the processor does not support VPIDs, and #UD if the memory operand is a register.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID reports VMfailValid with error number 28 if the type value is not supported or if the descriptor is invalid for the requested type — for example a VPID of 0000H with a type that requires a non-zero VPID.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

---

## 8.4 The VM-instruction error number table

This is the table the audit found missing. Every one of these values can appear in the VM-instruction error field after ZF is set by a VMX instruction.

- **Claim.** VM-instruction error 1: VMCALL executed in VMX root operation.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 2: VMCLEAR with invalid physical address.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 3: VMCLEAR with VMXON pointer.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 4: VMLAUNCH with non-clear VMCS.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 5: VMRESUME with non-launched VMCS.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 6: VMRESUME after VMXOFF — that is, VMXOFF and VMXON were executed between the VMRESUME and the corresponding VMLAUNCH.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 7: VM entry with invalid control field(s).  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 8: VM entry with invalid host-state field(s).  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 9: VMPTRLD with invalid physical address.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 10: VMPTRLD with VMXON pointer.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 11: VMPTRLD with incorrect VMCS revision identifier.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 12: VMREAD/VMWRITE from/to unsupported VMCS component.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 13: VMWRITE to read-only VMCS component.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 14 is not used.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 15: VMXON executed in VMX root operation.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 16: VM entry with invalid executive-VMCS pointer.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 17: VM entry with non-launched executive VMCS.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 18: VM entry with executive-VMCS pointer not VMXON pointer, reported when deactivating the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 19: VMCALL with non-clear VMCS, reported when activating the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 20: VMCALL with invalid VM-exit control fields.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 21 is not used.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 22: VMCALL with incorrect MSEG revision identifier, reported when activating the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 23: VMXOFF under dual-monitor treatment of SMIs and SMM.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 24: VMCALL with invalid SMM-monitor features, reported when activating the dual-monitor treatment of SMIs and SMM.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 25: VM entry with invalid VM-execution control fields in executive VMCS, reported when returning from SMM (see chapter `09`).  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 26: VM entry with events blocked by MOV SS.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** VM-instruction error 27 is not used.  `[SDM 3C §33.4]` `[1]` `[150]` `C:medium` `V:durable`
- **Claim.** VM-instruction error 28: invalid operand to INVEPT/INVVPID.  `[SDM 3C §33.4]` `[1]` `[150]` `C:high` `V:durable`
- **Claim.** The error numbers form a single flat namespace that is entirely separate from the basic exit reason namespace; error 28 and exit reason 28 have nothing to do with each other.  `[SDM 3C §33.4]` `[1]` `[2]` `C:high` `V:durable`

**Reading the table for diagnosis.** Errors 1, 15 and 23 mean "the instruction was executed in the wrong operating mode". Errors 2, 3, 9, 10 and 11 mean "the physical address or the region's revision identifier is wrong". Errors 4, 5, 6 and 26 mean "the VMCS lifecycle or the instruction boundary is wrong". Errors 7 and 8 mean "the VMCS contents are wrong" and send you to `04-vm-entry.md`. Errors 16 through 25 occur only under the dual-monitor treatment of SMIs and SMM, described in chapter `09` (SMM and SEAM). Error 12, 13 and 28 are operand errors.

---

## 8.5 INVEPT and INVVPID descriptors

- **Claim.** The INVEPT descriptor is 128 bits: bits 63:0 contain the EPT pointer and bits 127:64 are reserved and must be 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT type 1 is a single-context invalidation: it invalidates all EPT-derived mappings associated with the EP4TA (the address portion of the EPT pointer) specified in the descriptor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT type 2 is an all-context invalidation: it invalidates EPT-derived mappings associated with all EP4TAs, and the descriptor is ignored.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The INVVPID descriptor is 128 bits: bits 15:0 contain the VPID, bits 63:16 are reserved and must be 0, and bits 127:64 contain a linear address used only by type 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 0 is an individual-address invalidation: it invalidates mappings for the linear address in the descriptor, tagged with the descriptor's VPID.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 1 is a single-context invalidation: it invalidates all mappings tagged with the descriptor's VPID, except global translations.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 2 is an all-contexts invalidation: it invalidates all mappings tagged with any non-zero VPID, and the descriptor is ignored.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 3 is a single-context-retaining-globals invalidation: it invalidates mappings tagged with the descriptor's VPID while retaining global translations.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** For INVVPID types 0, 1 and 3 the VPID in the descriptor must not be 0000H; using 0000H reports error number 28.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Which INVEPT and INVVPID types a processor supports is reported in IA32_VMX_EPT_VPID_CAP, and software must not assume that all types exist.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

---

### 8.5.1 When software must invalidate

- **Claim.** Software must execute INVEPT after modifying an EPT paging-structure entry in a way that could make a cached translation or a cached EPT paging-structure entry stale.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Software must execute INVVPID after reassigning a VPID to a different virtual processor, or after changing guest paging structures in a way the guest itself did not invalidate.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT with the all-context type is the conservative choice when the VMM cannot determine which EP4TAs are affected; INVVPID with the all-contexts type plays the same role for VPID-tagged mappings.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Neither INVEPT nor INVVPID affects the other's mappings: combined mappings derived from both guest paging structures and EPT are invalidated by INVEPT, while mappings tagged only by VPID are invalidated by INVVPID.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** INVVPID with VPID 0000H is never valid for a guest, because VPID 0000H identifies VMX root operation.  `[SDM 3C §27.6.12]` `[1]` `C:high` `V:durable`

---

## 8.6 The VMX capability-reporting MSRs

Every control field must be derived from these MSRs rather than from a compile-time constant. A VMM that hard-codes control values fails VM entry with error 7 on the next microarchitecture.

### 8.6.1 Addresses

- **Claim.** IA32_VMX_BASIC is MSR address 480H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PINBASED_CTLS is MSR address 481H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS is MSR address 482H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EXIT_CTLS is MSR address 483H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_ENTRY_CTLS is MSR address 484H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC is MSR address 485H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_CR0_FIXED0 is MSR address 486H and IA32_VMX_CR0_FIXED1 is MSR address 487H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_CR4_FIXED0 is MSR address 488H and IA32_VMX_CR4_FIXED1 is MSR address 489H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMCS_ENUM is MSR address 48AH.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 is MSR address 48BH.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP is MSR address 48CH.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_TRUE_PINBASED_CTLS is MSR address 48DH, IA32_VMX_TRUE_PROCBASED_CTLS is 48EH, IA32_VMX_TRUE_EXIT_CTLS is 48FH, and IA32_VMX_TRUE_ENTRY_CTLS is 490H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMFUNC is MSR address 491H.  `[SDM 3D App.A]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS3, which reports the tertiary processor-based controls, is MSR address 492H.  `[SDM 3D App.A]` `[2]` `[5]` `[153]` `C:high` `V:durable`
- **Claim.** The capability MSR reporting the secondary VM-exit controls, IA32_VMX_EXIT_CTLS2, is MSR address 493H.  `[SDM 3D App.A]` `[2]` `[153]` `C:medium` `V:durable`
- **Claim.** All of these MSRs are read-only; an attempt to write any of them causes #GP(0).  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 8.6.2 IA32_VMX_BASIC

- **Claim.** IA32_VMX_BASIC bits 30:0 contain the 31-bit VMCS revision identifier that software must write into the first dword of every VMCS region and VMXON region.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 31 is always 0, which is what allows bit 31 of a region's first dword to be reused as the shadow-VMCS indicator.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 44:32 report the number of bytes software should allocate for a VMXON region or a VMCS region; the value never exceeds 4096.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 48, when 1, indicates that physical addresses used for the VMXON region, the VMCS regions and all structures referenced by VMCS pointers are limited to 32 bits.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 49 reports support for the dual-monitor treatment of SMIs and SMM.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 53:50 report the memory type the processor uses for the VMCS, the VMXON region and referenced structures; the value 6 denotes write-back and the value 0 denotes uncacheable.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 54 reports whether VM exits due to INS and OUTS supply information in the VM-exit instruction information field.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 55 reports that the TRUE_* capability MSRs (48DH–490H) are present, and therefore that some default-1 control bits may legitimately be cleared.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 56 reports that VM entry permits injection of a hardware exception with any error code value, including 0, without the usual consistency check.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

### 8.6.3 The control-capability MSRs and the TRUE_* variants

- **Claim.** In IA32_VMX_PINBASED_CTLS, IA32_VMX_PROCBASED_CTLS, IA32_VMX_EXIT_CTLS and IA32_VMX_ENTRY_CTLS, bits 31:0 are the allowed-0 settings — a control whose bit is 0 there must be 0 — and bits 63:32 are the allowed-1 settings — a control whose bit is 0 there must not be 1.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** A control bit whose allowed-0 setting is 1 is a "default-1" control: it must be set to 1 unless the corresponding TRUE_* MSR reports that it may be cleared.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_TRUE_PINBASED_CTLS, IA32_VMX_TRUE_PROCBASED_CTLS, IA32_VMX_TRUE_EXIT_CTLS and IA32_VMX_TRUE_ENTRY_CTLS use the same two-halves layout and may be consulted only when IA32_VMX_BASIC bit 55 is 1.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 uses the same two-halves layout and governs the secondary processor-based controls, which take effect only when bit 31 of the primary controls is 1.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS3 is different: it is a single 64-bit allowed-1 mask, because the tertiary processor-based controls have no default-1 bits.  `[SDM 3D App.A]` `[2]` `[153]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMFUNC is likewise a single 64-bit allowed-1 mask over the VM-function controls, and bit 0 of it reports support for the EPTP-switching VM function.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The correct algorithm for computing a control value is: start from the desired value, OR in the allowed-0 half of the capability MSR, and AND with the allowed-1 half; if the result differs from the desired value in a bit that matters, the feature is unavailable on that processor.  `[SDM 3D App.A]` `[2]` `[154]` `C:high` `V:durable`

### 8.6.4 IA32_VMX_MISC

- **Claim.** IA32_VMX_MISC bits 4:0 give the exponent relating the VMX-preemption timer rate to the TSC: the timer decrements once every time bit *n* of the TSC changes, where *n* is this value.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 5 reports that VM exits store the value of IA32_EFER.LMA into the "IA-32e mode guest" VM-entry control.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 8:6 report which activity states the processor supports: bit 6 HLT, bit 7 shutdown, bit 8 wait-for-SIPI.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 14 reports that Intel Processor Trace can be used in VMX operation.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_MISC bit 15 reports that RDMSR can be used in system-management mode to read IA32_SMBASE.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_MISC bits 24:16 report the number of CR3-target values supported by the processor.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 27:25 encode the recommended maximum number of entries in the VM-exit MSR-store, VM-exit MSR-load and VM-entry MSR-load lists as 512 × (1 + value).  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 29 reports that VMWRITE may write to any supported VMCS field, including read-only fields.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 30 reports that VM entry may inject an event with an instruction length of 0.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 63:32 contain the 32-bit MSEG revision identifier used by the dual-monitor treatment of SMIs and SMM.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 8.6.5 Fixed CR0 and CR4 MSRs

- **Claim.** If bit *n* of IA32_VMX_CR0_FIXED0 is 1, then bit *n* of CR0 must be 1 in VMX operation; if bit *n* of IA32_VMX_CR0_FIXED1 is 0, then bit *n* of CR0 must be 0.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The same rule applies to CR4 with IA32_VMX_CR4_FIXED0 and IA32_VMX_CR4_FIXED1; CR4.VMXE is always required to be 1 in VMX operation.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** Attempting to clear a required bit with MOV to CR0/CR4, CLTS or LMSW while in VMX operation causes #GP.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** When the "unrestricted guest" control is 1, the CR0.PE and CR0.PG requirements from IA32_VMX_CR0_FIXED0 are not applied to the guest CR0 field, which is what allows an unpaged or real-address-mode guest.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`

### 8.6.6 What CPUID does and does not tell you

- **Claim.** CPUID.01H:ECX bit 5 is the only CPUID indication that VMX operation is supported; all finer-grained VMX feature discovery is done through the IA32_VMX_* MSRs, not through CPUID.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** There is no CPUID leaf that enumerates EPT, VPID, unrestricted guest, APICv or any other VMX feature; a VMM must read IA32_VMX_PROCBASED_CTLS2 and IA32_VMX_EPT_VPID_CAP instead.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The physical-address width used by every "must not set bits beyond the physical-address width" check is the value reported by CPUID.80000008H:EAX bits 7:0.  `[SDM 3C Ch.33]` `[1]` `C:medium` `V:durable`
- **Claim.** IA32_FEATURE_CONTROL (MSR address 3AH) gates VMXON independently of the capability MSRs: bit 0 is the lock bit, bit 1 enables VMXON inside SMX operation and bit 2 enables VMXON outside SMX operation.  `[SDM 3C Ch.26]` `[1]` `[5]` `C:high` `V:durable`
- **Claim.** Once bit 0 of IA32_FEATURE_CONTROL is set, any WRMSR to that MSR causes #GP(0) until the next power-up reset, which is how firmware makes a "VT disabled" setting stick.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`

---

### 8.6.7 IA32_VMX_VMCS_ENUM and IA32_VMX_EPT_VPID_CAP

- **Claim.** IA32_VMX_VMCS_ENUM bits 9:1 report the highest index value used for any VMCS encoding, which lets software enumerate the field space without probing every possible encoding.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 20 reports that the INVEPT instruction is supported.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 25 reports support for the single-context INVEPT type and bit 26 reports support for the all-context INVEPT type.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 32 reports that the INVVPID instruction is supported.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bits 40, 41, 42 and 43 report support for the individual-address, single-context, all-contexts and single-context-retaining-globals INVVPID types respectively.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The remaining bits of IA32_VMX_EPT_VPID_CAP describe EPT structural capabilities — execute-only translations, supported page-walk lengths, supported EPT memory types, 2-MByte and 1-GByte page support, and accessed/dirty flags — which are owned by chapter `06`.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

---

## 8.7 A bring-up and debugging recipe

1. **Before VMXON**: read CPUID.01H:ECX bit 5, then IA32_FEATURE_CONTROL, then the four fixed CR MSRs; adjust CR0 and CR4 to satisfy them and set CR4.VMXE.
2. **Allocate regions** of the size reported in IA32_VMX_BASIC bits 44:32, with write-back memory type, and write the revision identifier from bits 30:0 into the first dword.
3. **Compute every control field** from its capability MSR using the OR-then-AND algorithm in §8.6.3, preferring the TRUE_* MSR when IA32_VMX_BASIC bit 55 is 1.
4. **After any VMX instruction**, branch on CF then ZF. On ZF, VMREAD the VM-instruction error field and look it up in §8.4.
5. **If the error is 7 or 8**, the problem is in the VMCS contents, not in the instruction: go to `04-vm-entry.md` §4.3 and §4.4.
6. **If control reached the host RIP instead of the next instruction**, this was not a VMfail at all — read the exit reason and consult `05-vm-exit.md`.

- **Claim.** Because VMX instructions do not raise exceptions for most logical errors, a VMM that ignores RFLAGS after VMREAD or VMWRITE will silently operate on stale or unwritten VMCS fields; checking the flags after every VMX instruction is the only architecturally reliable error detection.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

---

## 8.8 Common pitfalls

- **Claim.** Reading any IA32_VMX_* MSR before confirming CPUID.01H:ECX.VMX[bit 5] causes #GP(0); the capability MSRs do not exist on a processor without VMX support.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The TRUE_* capability MSRs (48DH–490H) must not be read unless IA32_VMX_BASIC bit 55 is 1; on older processors those MSR addresses are not architecturally defined.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 must not be read unless the primary processor-based controls report support for bit 31, "activate secondary controls"; that support is itself reported in the allowed-1 half of IA32_VMX_PROCBASED_CTLS.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** Treating the two halves of a capability MSR as "supported" and "default" rather than as allowed-0 and allowed-1 is the most common derivation bug, and it manifests as VM-instruction error 7 on processors where a default-1 control cannot be cleared.  `[SDM 3D App.A]` `[2]` `[154]` `C:high` `V:durable`
- **Claim.** VMREAD and VMWRITE on a 64-bit field outside 64-bit mode require two accesses using the full and high access types of the field encoding; a single 32-bit access silently reads or writes only half the field.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Writing the VMCS region with ordinary stores instead of VMWRITE corrupts the VMCS and is reported, if it is reported at all, only as VMX abort indicator 3 at the next VM exit.  `[SDM 3C §30.7]` `[1]` `C:high` `V:durable`
- **Claim.** A VMCS that is active on one logical processor must not be made current on another; the required sequence is VMCLEAR on the first processor, then VMPTRLD on the second.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

---

## 8.9 Cross-references

- Meaning of individual VMCS fields and control bits that these instructions read and write: `02-vmcs.md`.
- Which VM-entry check produces which error number, and the three VM-entry failure modes: `04-vm-entry.md`.
- Basic exit reasons produced when VMX instructions execute in VMX non-root operation: `05-vm-exit.md` §5.3.
- INVEPT/INVVPID invalidation semantics in terms of EPT and VPID tagging: chapter `06`.
- The dual-monitor treatment of SMIs and SMM, which is the source of error numbers 16 through 25: chapter `09` (SMM and SEAM).
- VMREAD/VMWRITE against a shadow VMCS and the VMREAD/VMWRITE bitmaps: `14-nested-virtualization.md`.
