# 08. VMX Instructions and Capability Reporting

> **中文速览**：本章是 VMX 指令集的规格书，对应 SDM Vol.3C 第 33 章 "VMX Instruction Reference"、§27.9.5（VM-instruction error 字段）与 Vol.3D 附录 A（VMX 能力报告 MSR）。三块硬内容：每条指令的操作数、前置状态、异常与失败路径（#UD / #GP / VMfailInvalid / VMfailValid 及 CF/ZF 标志协议）；**完整的 VM-instruction error 编号表 1–28**——这是排查 VMfailValid 的唯一入口，旧版技能整表缺失；INVEPT/INVVPID 的描述符格式与 type 取值。最后是能力 MSR 480H–493H 的地址与语义，写控制字段前必须先读它们，否则 VM entry 会以 error 7 失败。VM-entry 检查清单见 `04-vm-entry.md`，退出原因见 `05-vm-exit.md`。

**Maps to:** Intel SDM Vol.3C Ch.33 "VMX Instruction Reference" and §27.9.5 (rev 092) [1]; Vol.3D App.A "VMX Capability Reporting Facility" [2]
**Owns:** VMX instruction semantics, operands and exception behaviour; the VM-instruction error number table; INVEPT/INVVPID descriptors and types; the VMX capability-reporting MSRs.
**See also:** `04-vm-entry.md` §4.2 (which errors a failed VM entry produces) · `05-vm-exit.md` §5.3 (exit reasons for VMX instructions executed in VMX non-root operation) · `02-vmcs.md` (what the fields VMREAD/VMWRITE address actually mean)

---

## 8.1 The instruction set and the flag protocol

- **Claim.** The VMX instruction set consists of thirteen instructions: VMXON, VMXOFF, VMPTRLD, VMPTRST, VMCLEAR, VMREAD, VMWRITE, VMLAUNCH, VMRESUME, VMCALL, VMFUNC, INVEPT and INVVPID.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Twelve of the thirteen VMX instructions report their outcome through RFLAGS using one of three conventions: VMsucceed, VMfailInvalid or VMfailValid. VMFUNC is the exception — the SDM gives its Flags Affected as “Depends on the VM function specified in EAX”.  `[SDM 3C §33.2]` `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMsucceed clears CF, PF, AF, ZF, SF and OF.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMfailInvalid sets CF to 1 and clears PF, AF, ZF, SF and OF; no error number is recorded, because there is no current VMCS in which to record one.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMfailValid sets ZF to 1, clears CF, PF, AF, SF and OF, and writes an error number into the VM-instruction error field of the current VMCS.  `[SDM 3C §33.2]` `[1]` `C:high` `V:durable`
- **Claim.** The architectural rule that selects between the two failure conventions is the pseudo-function `VMfail(ErrorNumber)`: if the VMCS pointer is valid, report VMfailValid with the error number; otherwise report VMfailInvalid.  `[SDM 3C §33.2]` `[1]` `C:high` `V:durable`
- **Claim.** That distinction is load-bearing for debugging. Most per-instruction pseudocode calls `VMfail(N)`, not `VMfailValid(N)`, so when there is no current VMCS the failure surfaces as **CF = 1 with no error number recorded at all** rather than as ZF = 1 with N. VMXON executed in VMX root operation is the classic case: VMXON itself sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH, so a second VMXON usually reports VMfailInvalid, and error 15 is observed only once a VMCS has been made current. Only VMLAUNCH/VMRESUME and VMCALL’s dual-monitor path call `VMfailValid` directly.  `[SDM 3C §33.2]` `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-instruction error field is a 32-bit read-only VM-exit information field; software reads it with VMREAD after any instruction that set ZF.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

> Debugging convention that follows from this: after every VMX instruction, test CF first, then ZF. `CF=1` means "the VMCS pointer or the operand was structurally unusable"; `ZF=1` means "the VMCS is fine, but the operation was rejected for a reason with a number".

---

## 8.2 Failure taxonomy common to all VMX instructions

- **Claim.** On a processor where CPUID.01H:ECX.VMX[bit 5] is 0 no VMX instruction is executable, but Ch.33 states no CPUID condition in any exception table — the mechanism is indirect. VMXON raises #UD because CR4.VMXE cannot be set, and every other VMX instruction raises #UD because the logical processor is never in VMX operation.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Every VMX instruction except VMXON causes #UD if executed outside VMX operation: VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMREAD, VMRESUME, VMWRITE, VMXOFF, INVEPT, INVVPID and **VMCALL** all carry “#UD If executed outside VMX operation”, and VMFUNC carries “#UD If executed outside VMX **non-root** operation”. VMXON is the one instruction designed to be executed outside VMX operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The eleven VMM instructions cause #UD if executed in real-address mode, in virtual-8086 mode, or in compatibility mode (IA32_EFER.LMA = 1 with CS.L = 0); §33.1 states the compatibility-mode rule for exactly that group, immediately before it turns to the guest-available instructions.  `[SDM 3C §33.1]` `[1]` `C:high` `V:durable`
- **Claim.** The two guest-available instructions behave differently. VMCALL’s virtual-8086 and compatibility-mode exception tables both read “#UD **If executed outside VMX non-root operation**”, and its Operation tests for non-root operation *before* testing RFLAGS.VM and CS.L — so a virtual-8086 or compatibility-mode guest that executes VMCALL takes a **VM exit**, not #UD. VMFUNC’s tables in those modes say “Same exceptions as in protected mode”, which is again #UD only outside non-root operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** The eleven VMM instructions cause #GP(0) if executed with CPL greater than 0, and rev 092 adds “or in SEAM root operation” to several of them. VMCALL’s condition is narrower — “If the current privilege level is not 0 **and the logical processor is in VMX root operation**” — and VMFUNC has no CPL condition at all: §28.5.7.2 leaves CPL checking to the individual VM function.  `[SDM 3C Ch.33]` `[SDM 3C §28.5.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** Instructions with a memory operand can raise three ordinary memory-access exceptions — #GP(0) for a non-canonical or out-of-segment address, #SS(0) for a stack-segment violation, and #PF for a page fault. **#AC is not among them**: the string “#AC” does not occur anywhere in Ch.33, and it cannot, because alignment checking reports violations only at CPL 3 while every VMX instruction with a memory operand already requires CPL 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** §28.1.2’s list of instructions that cause VM exits **unconditionally** in VMX non-root operation is CPUID, GETSEC, INVD and XSETBV, plus the VMX-introduced INVEPT, INVVPID, SEAMCALL, TDCALL, VMCALL, VMCLEAR, VMLAUNCH, VMPTRLD, VMPTRST, VMRESUME, VMXOFF and VMXON — with the basic exit reasons listed in `05-vm-exit.md` §5.3.  `[SDM 3C §28.1.2]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD and VMWRITE are deliberately **absent** from that unconditional list; they sit in §28.1.3 among the conditional exits, because VMCS shadowing lets them execute in non-root operation (see `14-nested-virtualization.md`).  `[SDM 3C §28.1.2]` `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
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
- **Claim.** VMFUNC is the only VMX instruction with no VMX flag convention of its own; Ch.33 gives its Flags Affected as “Depends on the VM function specified in EAX”. The stronger guarantee that no register and no flag changes is stated only for VM function 0: “Execution of the EPTP-switching VM function does not modify the state of any registers; no flags are modified.”  `[SDM 3C Ch.33]` `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`

---

## 8.3 Per-instruction reference

### 8.3.1 VMXON — Enter VMX Operation

- **Claim.** VMXON takes a single m64 source operand containing the 4-KByte-aligned physical address of the VMXON region; a register operand causes #UD.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #UD if CR4.VMXE is 0, if CR0.PE is 0, or if RFLAGS.VM is 1.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #GP(0) if the lock bit (bit 0) of IA32_FEATURE_CONTROL is clear, if the processor is in SMX operation and bit 1 of that MSR is clear, or if it is outside SMX operation and bit 2 is clear. The same pseudocode branch also lists **CPL > 0** and **being in A20M mode** as #GP(0) causes.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON causes #GP(0) if the values in CR0 or CR4 are not permitted in VMX operation according to IA32_VMX_CR0_FIXED0/FIXED1 and IA32_VMX_CR4_FIXED0/FIXED1.  `[SDM 3C Ch.33]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** VMXON reports VMfailInvalid if the operand address is not 4-KByte aligned, sets any bit beyond the processor's physical-address width, or if the 31-bit revision identifier at the start of the VMXON region does not match the processor's VMCS revision identifier or has bit 31 set.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXON executed while already in VMX root operation reports `VMfail(“VMXON executed in VMX root operation”)` — error number 15 if a VMCS is current, VMfailInvalid with no number recorded if none is.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** A successful VMXON enters VMX root operation, sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH, blocks INIT signals, and blocks and disables A20M.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

**The VMXON region.**

- **Claim.** The VMXON region has the same format conventions as a VMCS region — a 4-KByte-aligned block whose first dword holds the VMCS revision identifier — but it is never accessed with VMREAD or VMWRITE.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** Software should allocate the VMXON region with the number of bytes reported in IA32_VMX_BASIC bits 44:32, and should write the 31-bit VMCS revision identifier to bits 30:0 of its first 4 bytes with bit 31 cleared. Zeroing the rest is **not** required — the SDM says software “need not initialize the VMXON region in any other way”.  `[SDM 3D App.A.1]` `[SDM 3C §27.11]` `[2]` `[1]` `C:high` `V:durable`
- **Claim.** Software should use a separate VMXON region per logical processor, and must not access or modify a logical processor’s VMXON region between its VMXON and its VMXOFF.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** Every VMCS region and every structure referenced by a VMCS pointer should be mapped with the memory type reported in IA32_VMX_BASIC bits 53:50; mapping them UC instead is architecturally permitted but the SDM discourages it because software accesses to those structures suffer. App.A.1 enumerates the VMCS, VMCS-referenced structures and the MSEG header rather than the VMXON region, but §27.2 directs that the VMCS region and related structures be kept in writeback-cacheable memory.  `[SDM 3D App.A.1]` `[SDM 3C §27.2]` `[2]` `[1]` `C:high` `V:durable`

### 8.3.2 VMXOFF — Leave VMX Operation

- **Claim.** VMXOFF takes no operands; it leaves VMX operation, unblocks INIT signals, **conditionally** re-enables A20M (the pseudocode does so only outside SMX operation), and clears any address-range monitoring.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMXOFF reports `VMfail` with error number 23 if executed while the dual-monitor treatment of SMIs and SMM is active.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Whether VMXOFF unblocks SMIs depends on IA32_SMM_MONITOR_CTL, and bit 28 of IA32_VMX_MISC reports whether that MSR's bit 2 may be set.  `[SDM 3D App.A.6]` `[2]` `C:medium` `V:durable`

### 8.3.3 VMPTRLD — Load Pointer to Virtual-Machine Control Structure

- **Claim.** VMPTRLD takes an m64 operand holding the physical address of a VMCS region and makes that VMCS both active and current on the executing logical processor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 9 if the operand address is not 4-KByte aligned or sets bits beyond the physical-address width.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 10 if the operand address equals the VMXON pointer.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD reports error number 11 if the 31-bit revision identifier in the referenced region does not match the processor's, or if bit 31 of that dword marks the region as a shadow VMCS on a processor that does not support VMCS shadowing (see `14-nested-virtualization.md`).  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Only one VMCS can be current on a logical processor at a time; VMPTRLD replaces the previous current VMCS, which remains **active** until VMCLEAR is executed for it — §27.1: “Any other VMCS that had been active remains so, but no other VMCS is current.”  `[SDM 3C §27.1]` `[1]` `C:high` `V:durable`

### 8.3.4 VMPTRST — Store Pointer to Virtual-Machine Control Structure

- **Claim.** VMPTRST takes an m64 destination operand and writes the current-VMCS pointer into it; if there is no current VMCS it writes FFFFFFFF_FFFFFFFFH.  `[SDM 3C §27.1]` `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRST causes #UD if its operand is a register.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

### 8.3.5 VMCLEAR — Clear Virtual-Machine Control Structure

- **Claim.** VMCLEAR takes an m64 operand holding the physical address of a VMCS region; it sets that VMCS's launch state to "clear", renders it inactive and not current, and ensures that data held in processor caches for that VMCS is written back to memory.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** If the operand address equals the current-VMCS pointer, VMCLEAR also sets the current-VMCS pointer to FFFFFFFF_FFFFFFFFH.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR reports error number 2 if the operand address is not 4-KByte aligned or sets bits beyond the physical-address width.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR reports error number 3 if the operand address equals the VMXON pointer.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR must be executed for a VMCS region before its first use, and must be executed on the current logical processor before the same VMCS is used on another logical processor.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.6 VMREAD — Read Field from Virtual-Machine Control Structure

- **Claim.** VMREAD has the form `VMREAD r/m64, r64` in 64-bit mode and `VMREAD r/m32, r32` outside it: the second operand supplies the field encoding and the first receives the field's contents.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD reports VMfailInvalid if there is no current VMCS — and, in VMX non-root operation under VMCS shadowing, if the **VMCS-link pointer** is not valid (see `14-nested-virtualization.md`). The pseudocode tests two different pointers depending on which operation the processor is in.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD reports error number 12 if the field encoding does not name a VMCS component supported by the processor.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** It is the **destination** operand whose width varies, not the source: the source register always carries the field encoding, while the destination “is always 32 bits outside IA-32e mode … and 64 bits in 64-bit mode”. So in 64-bit mode one VMREAD returns an entire 64-bit field, and outside IA-32e mode the field must be read in two halves — full access type for bits 31:0, high access type for bits 63:32.  `[SDM 3C Ch.33]` `[SDM 3C §27.11.2]` `[1]` `C:high` `V:durable`

### 8.3.7 VMWRITE — Write Field to Virtual-Machine Control Structure

- **Claim.** VMWRITE has the form `VMWRITE r64, r/m64` in 64-bit mode and `VMWRITE r32, r/m32` outside it: the first operand supplies the field encoding and the second supplies the value.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports VMfailInvalid if there is no current VMCS — and, in VMX non-root operation under VMCS shadowing, if the **VMCS-link pointer** is not valid (see `14-nested-virtualization.md`).  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports error number 12 if the field encoding names an unsupported VMCS component.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** VMWRITE reports error number 13 if the field encoding names a **VM-exit information field** and the processor does not support writing to such fields; that is the exact class the pseudocode names, and it is the class IA32_VMX_MISC bit 29 unlocks.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 29 of IA32_VMX_MISC reports whether VMWRITE may write to any supported VMCS field; with it clear, "VMWRITE cannot be used to modify VM-exit information fields". That capability is what lets a nested VMM synthesize exit information for its guest (see `14-nested-virtualization.md`).  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** VMCS fields must not be accessed by ordinary memory reads and writes; the VMCS-data layout is implementation-specific and only VMREAD and VMWRITE are architecturally defined accessors. §27.2 supplies the layout half (“The format of these data is implementation-specific”) and §27.11.1 the prohibition (“Software should never access or modify the VMCS data of an active VMCS using ordinary memory operations”).  `[SDM 3C §27.2]` `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.8 VMLAUNCH and VMRESUME — Launch/Resume Virtual Machine

- **Claim.** VMLAUNCH and VMRESUME take no operands and attempt a VM entry using the current VMCS.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH reports error number 4 if the launch state of the current VMCS is not "clear"; VMRESUME reports error number 5 if the launch state is not "launched".  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Both instructions report error number 26 if there is blocking by MOV SS when they execute; the Description broadens the prohibition to POP SS as well (“VM entry is not allowed when events are blocked by MOV SS or POP SS”), though the error number itself is named for MOV SS.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Both instructions report error number 7 if any check on the VMX controls fails, and error number 8 if any check on the host-state area fails; the full check lists are in `04-vm-entry.md` §4.3 and §4.4.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Failures detected after guest state has been loaded are not reported through RFLAGS at all: they appear as VM exits with basic exit reason 33, 34 or 41 and the VM-entry-failure bit set in the exit-reason field.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** Intel states that “in general, VMRESUME will have lower latency than VMLAUNCH”, and that migrating a VMCS between logical processors forces VMCLEAR and therefore a VMLAUNCH; the SDM’s own advice is to avoid unnecessary migration. That hypervisors track launch state in software to prefer VMRESUME is the engineering consequence, not an Intel statement.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`

### 8.3.9 VMCALL — Call to VM Monitor

- **Claim.** VMCALL takes no operands and causes a VM exit with basic exit reason 18 when executed in VMX non-root operation; this is the architectural hypercall primitive.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCALL executed in VMX root operation reports `VMfail` with error number 1 when the dual-monitor preconditions are absent — precisely: in SMM, or on a logical processor that does not support the dual-monitor treatment, or with the valid bit of IA32_SMM_MONITOR_CTL clear. With no current VMCS this surfaces as VMfailInvalid rather than error 1.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`
- **Claim.** Under the dual-monitor treatment, VMCALL executed in VMX root operation activates the SMM-transfer monitor and is subject to its own checks, which produce error numbers 19, 20, 22 and 24.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:medium` `V:durable`
- **Claim.** VMCALL causes #UD only if executed **outside VMX non-root operation** in virtual-8086 or compatibility mode — inside non-root operation in those modes it takes an ordinary VM exit — and #GP(0) if CPL is greater than 0 while in VMX root operation, or if in SEAM root operation.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`

### 8.3.10 VMFUNC — Invoke VM Function

- **Claim.** VMFUNC takes its function number in EAX; Ch.33 encodes it as ZO (no architectural operands) and describes it only as “Invoke VM function specified in EAX”. ECX is not a general VMFUNC operand — it is specific to VM function 0, where it selects an EPTP-list entry. VMFUNC is one of **two** guest-available VMX instructions, the other being VMCALL.  `[SDM 3C Ch.33]` `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC causes #UD in exactly three cases: executed outside VMX non-root operation; the “enable VM functions” secondary control is 0; or **EAX is greater than 63** — that is, EAX ≥ 64. EAX = 63 is a legal function number, since only VM functions 0–63 can be enabled.  `[SDM 3C Ch.33]` `[SDM 3C §28.5.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** VM function 0 is EPTP switching: ECX selects an entry in the EPTP list, and a successful invocation replaces the current EPT pointer without a VM exit.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`
- **Claim.** A VM function that is *disabled* — the bit at position EAX is 0 in the VM-function controls — is **not** a #UD: it causes a VM exit with basic exit reason 59, with the VMFUNC instruction length saved in the VM-exit instruction-length field. Confusing this with the #UD cases is the common error.  `[SDM 3C §28.5.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** A VM function that is enabled but cannot be completed — for example because ECX is 512 or greater, or the selected EPTP-list entry is invalid — likewise causes a VM exit with basic exit reason 59 rather than an exception.  `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** VMFUNC has no VMfail convention, because its failure path is #UD or a VM exit. Ch.33 does not promise that RFLAGS is preserved — it says “Flags Affected: depends on the VM function specified in EAX” — and the guarantee that no flags change is given only for VM function 0.  `[SDM 3C Ch.33]` `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`

### 8.3.11 INVEPT — Invalidate Translations Derived from EPT

- **Claim.** INVEPT has the form `INVEPT r64, m128` in 64-bit mode and `INVEPT r32, m128` outside it: the register operand supplies the INVEPT type and the memory operand supplies a 128-bit INVEPT descriptor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT’s #UD list has exactly three entries: not in VMX operation; the logical processor does not support EPT (IA32_VMX_PROCBASED_CTLS2[33] = 0); or it supports EPT but not the INVEPT instruction (IA32_VMX_EPT_VPID_CAP[20] = 0). There is **no** register-operand #UD — that condition is listed only for VMCLEAR, VMPTRLD, VMPTRST and VMXON.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT reports `VMfail` with error number 28 if the type value is not supported by the processor or if the descriptor is invalid for the requested type.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`

### 8.3.12 INVVPID — Invalidate Translations Based on VPID

- **Claim.** INVVPID has the form `INVVPID r64, m128` in 64-bit mode and `INVVPID r32, m128` outside it: the register operand supplies the INVVPID type and the memory operand supplies a 128-bit INVVPID descriptor.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID’s #UD list is the parallel three: not in VMX operation; the logical processor does not support VPIDs (IA32_VMX_PROCBASED_CTLS2[37] = 0); or it supports VPIDs but not the INVVPID instruction (IA32_VMX_EPT_VPID_CAP[32] = 0). Again there is no register-operand #UD.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID reports `VMfail` with error number 28 if the type value is not supported or if the descriptor is invalid for the requested type — for example a VPID of 0000H with a type that requires a non-zero VPID, or any non-zero value in descriptor bits 63:16.  `[SDM 3C Ch.33]` `[SDM 3C §33.4]` `[1]` `C:high` `V:durable`

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
- **Claim.** INVEPT type 1 is a single-context invalidation: it invalidates all guest-physical mappings and combined mappings associated with bits 51:12 of the EPT pointer specified in the descriptor — for all VPIDs and all PCIDs.  `[SDM 3C Ch.33]` `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** Rev 092 calls those 40 bits the **EPTRTA** (“EPT root-table address”), defined in §31.4.2; the older name **EP4TA** occurs zero times in Vol.3C and Vol.3D rev 092 and should not be used. The rename accompanied 5-level EPT, where the root is a PML5 table rather than a PML4 table.  `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT type 2 invalidates guest-physical mappings and combined mappings associated with **all** EPTPs — Ch.33 rev 092 names it “Global invalidation” while §31.4.3.1 and App.A.10 call it “all-context”. Its descriptor contents are not used, but the memory operand is still read, so it can still fault.  `[SDM 3C Ch.33]` `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** The INVVPID descriptor is 128 bits: bits 15:0 contain the VPID, bits 63:16 are reserved and must be 0, and bits 127:64 contain a linear address used only by type 0.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 0 is an individual-address invalidation: it invalidates mappings for the linear address in the descriptor, tagged with the descriptor's VPID.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 1 is a single-context invalidation: it invalidates **all** linear mappings and combined mappings tagged with the descriptor’s VPID, for all PCIDs and (for combined mappings) all EPTRTAs. It does **not** spare global translations — sparing them is what distinguishes type 3.  `[SDM 3C Ch.33]` `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 2 is an all-contexts invalidation: it invalidates all linear and combined mappings tagged with any VPID except 0000H, for all PCIDs. The VPID and linear-address fields of the descriptor are unused, but the descriptor is **not** ignored — the check `IF INVVPID_DESC[63:16] != 0 THEN VMfail` precedes the type dispatch and so applies to type 2 as well.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 3 is a single-context-retaining-globals invalidation: it invalidates mappings tagged with the descriptor’s VPID except global translations — the logical processor is not *required* to invalidate information used for global translations, although it may.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** For INVVPID types 0, 1 and 3 the VPID in the descriptor must not be 0000H; using 0000H reports error number 28.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Which INVEPT and INVVPID types a processor supports is reported in IA32_VMX_EPT_VPID_CAP, and software must not assume that all types exist.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`

---

### 8.5.1 When software must invalidate

- **Claim.** Software should execute INVEPT with the **single-context** type after any of the changes §31.4.3.4 enumerates to an EPT paging-structure entry — clearing a privilege bit 2:0 from 1 to 0, changing the address in bits 51:12, clearing the accessed flag, changing bit 7 in an EPT PDPTE or PDE, or changing bits 5:3, bit 6 or the dirty flag in a leaf entry — with a descriptor whose EPTP references the modified structure.  `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** §31.4.3.3 states the VPID-reuse rule as a prohibition rather than an invalidation duty: a VMM “should not use the same VPID for different non-EPT guests that use different page tables”, because doing so may let one guest use the other’s translations. The invalidation duty it does state is the second half — if the VMM emulates operations that would have invalidated guest translations, it may need INVVPID to do so itself.  `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** When a VMM cannot determine which EPTRTAs are affected, the global (type 2) INVEPT covers all EPTPs and INVVPID type 2 covers all non-zero VPIDs. The SDM itself does not present these as a fallback: §31.4.3.4 recommends the **single-context** INVEPT type for every change it enumerates, with the descriptor carrying an EPTP that references the modified structure.  `[SDM 3C §31.4]` `[1]` `C:medium` `V:durable`
- **Claim.** The two instructions have overlapping, not disjoint, domains. §31.4.3.1: INVVPID invalidates **linear mappings and combined mappings**; INVEPT invalidates **guest-physical mappings and combined mappings**. Combined mappings — those derived from both guest paging structures and EPT — are reachable by either instruction; only linear mappings are INVVPID-only and only guest-physical mappings are INVEPT-only.  `[SDM 3C §31.4]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID with VPID 0000H is never valid for a guest. §31.1 lists three situations in which the current VPID is 0000H — outside VMX operation, in VMX root operation, and in VMX non-root operation when “enable VPID” is 0 — and adds that VM entry ensures the VPID field is never 0000H. (§27.6.12 only declares the field’s existence and forwards to §31.1.)  `[SDM 3C §31.1]` `[1]` `C:high` `V:durable`

---

## 8.6 The VMX capability-reporting MSRs

Every control field must be derived from these MSRs rather than from a compile-time constant. A VMM that hard-codes control values fails VM entry with error 7 on the next microarchitecture.

### 8.6.1 Addresses

- **Claim.** IA32_VMX_BASIC is MSR address 480H.  `[SDM 3D App.A.1]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PINBASED_CTLS is MSR address 481H.  `[SDM 3D App.A.3.1]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS is MSR address 482H.  `[SDM 3D App.A.3.2]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EXIT_CTLS is MSR address 483H.  `[SDM 3D App.A.4.1]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_ENTRY_CTLS is MSR address 484H.  `[SDM 3D App.A.5]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC is MSR address 485H.  `[SDM 3D App.A.6]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_CR0_FIXED0 is MSR address 486H and IA32_VMX_CR0_FIXED1 is MSR address 487H.  `[SDM 3D App.A.7]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_CR4_FIXED0 is MSR address 488H and IA32_VMX_CR4_FIXED1 is MSR address 489H.  `[SDM 3D App.A.8]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMCS_ENUM is MSR address 48AH.  `[SDM 3D App.A.9]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 is MSR address 48BH.  `[SDM 3D App.A.3.3]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP is MSR address 48CH.  `[SDM 3D App.A.10]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_TRUE_PINBASED_CTLS is MSR address 48DH, IA32_VMX_TRUE_PROCBASED_CTLS is 48EH, IA32_VMX_TRUE_EXIT_CTLS is 48FH, and IA32_VMX_TRUE_ENTRY_CTLS is 490H.  `[SDM 3D App.A.2]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMFUNC is MSR address 491H.  `[SDM 3D App.A.11]` `[2]` `[5]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS3, which reports the tertiary processor-based controls, is MSR address 492H.  `[SDM 3D App.A.3.4]` `[2]` `[5]` `[153]` `C:high` `V:durable`
- **Claim.** The capability MSR reporting the secondary VM-exit controls, IA32_VMX_EXIT_CTLS2, is MSR address 493H; App.A.4.2 names it explicitly and Vol.4 gates it on `CPUID.01H:ECX[5] && IA32_VMX_EXIT_CTLS[63]`.  `[SDM 3D App.A.4.2]` `[SDM 4 Ch.2]` `[2]` `[5]` `[153]` `C:high` `V:durable`
- **Claim.** All of these MSRs are read-only; an attempt to write any of them causes #GP(0).  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 8.6.2 IA32_VMX_BASIC

- **Claim.** IA32_VMX_BASIC bits 30:0 contain the 31-bit VMCS revision identifier that software must write into the first dword of every VMCS region and VMXON region.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 31 is always 0, which is what allows bit 31 of a region's first dword to be reused as the shadow-VMCS indicator.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 44:32 report the number of bytes software should allocate for a VMXON region or a VMCS region; the value never exceeds 4096.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 48, when 1, indicates that physical addresses used for the VMXON region, the VMCS regions and all structures referenced by VMCS pointers are limited to 32 bits; the bit is always 0 on processors that support Intel 64 architecture, so on any 64-bit part it is dead.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 49 reports support for the dual-monitor treatment of SMIs and SMM.  `[SDM 3D App.A.1]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_BASIC bits 53:50 report the memory type software **should use** for the VMCS, for data structures referenced by pointers in the VMCS, and for the MSEG header; the value 6 denotes write-back and the value 0 denotes uncacheable, and values 1–5 and 7–15 are not used. Software may instead map any of those regions UC, which the SDM discourages except where necessary for the MSEG header.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 54 reports whether VM exits due to INS and OUTS supply information in the VM-exit instruction information field.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 55 reports that the TRUE_* capability MSRs (48DH–490H) are present, and therefore that some default-1 control bits may legitimately be cleared.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 56, when 1, means software can use VM entry to deliver a hardware exception **with or without an error code, regardless of vector**. It lifts the vector-based restriction on the *deliver-error-code bit*, not a restriction on the error-code *value*: the check that bits 31:16 of the injected-event error-code field are 0 applies either way. With bit 56 read as 0, bit 11 may be set only for #DF, #TS, #NP, #SS, #GP, #PF and #AC.  `[SDM 3D App.A.1]` `[SDM 3C §29.2.1.3]` `[2]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_VMX_BASIC bit 58, when 1, reports VMX nested-exception support: software may mark an injected event as a nested exception, and VM exits indicate whether an event was an exception encountered during FRED event delivery. Any processor supporting FRED transitions provides it.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** The remaining IA32_VMX_BASIC bits — 47:45, 57 and 63:59 — are reserved and read as 0, so bits 30:0, 31, 44:32, 48, 49, 53:50, 54, 55, 56 and 58 are the complete rev-092 field list.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`

### 8.6.3 The control-capability MSRs and the TRUE_* variants

- **Claim.** In IA32_VMX_PINBASED_CTLS, IA32_VMX_PROCBASED_CTLS, IA32_VMX_EXIT_CTLS and IA32_VMX_ENTRY_CTLS, bits 31:0 are the allowed-0 settings and bits 63:32 the allowed-1 settings. The SDM states them as permissions, not as assignments: *"VM entry allows control X to be 0 if bit X in the MSR is cleared to 0; if bit X in the MSR is set to 1, VM entry fails if control X is 0"*, and *"VM entry allows control X to be 1 if bit 32+X in the MSR is set to 1; if bit 32+X in the MSR is cleared to 0, VM entry fails if control X is 1."*  `[SDM 3D App.A.3.1]` `[2]` `C:high` `V:durable`
- **Claim.** Read as obligations, that means: a control whose **allowed-0 bit is 1 must be 1**, and a control whose **allowed-1 bit is 0 must be 0**. A control with allowed-0 = 0 and allowed-1 = 1 is flexible. Inverting the first half — reading "allowed-0 bit is 0" as "the control must be 0" rather than "the control may be 0" — is the derivation bug that produces VM-instruction error 7, and it is the reason the algorithm below ORs rather than ANDs with the low half.  `[SDM 3D App.A.3.1]` `[2]` `[154]` `C:high` `V:durable`
- **Claim.** A control bit whose allowed-0 setting is 1 is a "default-1" control: it must be set to 1 unless the corresponding TRUE_* MSR reports that it may be cleared.  `[SDM 3D App.A.2]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_TRUE_PINBASED_CTLS, IA32_VMX_TRUE_PROCBASED_CTLS, IA32_VMX_TRUE_EXIT_CTLS and IA32_VMX_TRUE_ENTRY_CTLS use the same two-halves layout and may be consulted only when IA32_VMX_BASIC bit 55 is 1.  `[SDM 3D App.A.2]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 uses the same two-halves layout and governs the secondary processor-based controls, which take effect only when bit 31 of the primary controls is 1.  `[SDM 3D App.A.3.3]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS3 is different: it is a single 64-bit allowed-1 mask. The SDM's stated reason is size, not default-1 policy — *"there are 64 tertiary processor-based VM-execution controls, while there were only 32 secondary processor-based VM-execution controls"* — so a two-halves layout would not fit. IA32_VMX_EXIT_CTLS2 has the same organization for the same stated reason.  `[SDM 3D App.A.3.4]` `[2]` `[153]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS3 exists only on processors that support the 1-setting of "activate tertiary controls", which is reported by bit 49 of IA32_VMX_PROCBASED_CTLS (the allowed-1 bit for primary control 17).  `[SDM 3D App.A.3.4]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMFUNC is likewise a single 64-bit allowed-1 mask over the VM-function controls.  `[SDM 3D App.A.11]` `[2]` `C:high` `V:durable`
- **Claim.** That EPTP switching is VM function 0 is not stated in App.A.11, which names no function: it comes from the VM-function control definition in Vol.3C.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`
- **Claim.** The OR-then-AND derivation algorithm — start from the desired value, OR in the allowed-0 half of the capability MSR, AND with the allowed-1 half, and treat any surviving difference in a bit that matters as "the feature is unavailable" — follows from the per-bit semantics above; App.A states those semantics but gives no algorithm, and the canonical implementation is KVM's `adjust_vmx_controls()`.  `[SDM 3D App.A.3.1]` `[2]` `[154]` `C:high` `V:durable`

### 8.6.4 IA32_VMX_MISC

- **Claim.** IA32_VMX_MISC bits 4:0 give the exponent relating the VMX-preemption timer rate to the TSC: the timer decrements once every time bit *n* of the TSC changes, where *n* is this value.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 5 reports that VM exits store the value of IA32_EFER.LMA into the "IA-32e mode guest" VM-entry control.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 8:6 report which activity states the processor supports: bit 6 HLT, bit 7 shutdown, bit 8 wait-for-SIPI.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 14 reports that Intel Processor Trace can be used in VMX operation.  `[SDM 3D App.A.6]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_MISC bit 15 reports that RDMSR can be used in system-management mode to read IA32_SMBASE.  `[SDM 3D App.A.6]` `[2]` `C:medium` `V:durable`
- **Claim.** IA32_VMX_MISC bits 24:16 report the number of CR3-target values supported by the processor.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 27:25 encode the recommended maximum number of entries in the VM-exit MSR-store, VM-exit MSR-load and VM-entry MSR-load lists as 512 × (1 + value).  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 29 reports that VMWRITE may write to any supported VMCS field, including read-only fields.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 28 reports that bit 2 of IA32_SMM_MONITOR_CTL may be set to 1; VMXOFF unblocks SMIs unless that bit is 1.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bit 30 reports that VM entry allows injection of a **software interrupt, software exception, or privileged software exception** with an instruction length of 0 — not of any event. Hardware exceptions, NMIs and external interrupts do not use the VM-entry instruction-length field at all.  `[SDM 3D App.A.6]` `[SDM 3C §29.2.1.3]` `[2]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 63:32 contain the 32-bit MSEG revision identifier used by the dual-monitor treatment of SMIs and SMM.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_MISC bits 13:9 and bit 31 are reserved and read as 0, so the defined fields are 4:0, 5, 8:6, 14, 15, 24:16, 27:25, 28, 29, 30 and 63:32.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`
- **Claim.** Exceeding the MSR-list maximum that bits 27:25 recommend produces undefined processor behaviour, including possibly a machine check during the VMX transition.  `[SDM 3D App.A.6]` `[2]` `C:high` `V:durable`

### 8.6.5 Fixed CR0 and CR4 MSRs

- **Claim.** If bit *n* of IA32_VMX_CR0_FIXED0 is 1, then bit *n* of CR0 must be 1 in VMX operation; if bit *n* of IA32_VMX_CR0_FIXED1 is 0, then bit *n* of CR0 must be 0.  `[SDM 3D App.A.7]` `[2]` `C:high` `V:durable`
- **Claim.** The same rule applies to CR4 with IA32_VMX_CR4_FIXED0 and IA32_VMX_CR4_FIXED1: a bit is fixed to 0 (0 in both MSRs), fixed to 1 (1 in both), or flexible (0 in FIXED0 and 1 in FIXED1).  `[SDM 3D App.A.8]` `[2]` `C:high` `V:durable`
- **Claim.** That CR4.VMXE must be 1 in VMX operation is stated in Vol.3C, not in App.A.8: VMXON raises #UD with CR4.VMXE = 0, and once in VMX operation CR4.VMXE cannot be cleared.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** Attempting to clear a required bit with MOV to CR0/CR4, CLTS or LMSW while in VMX operation causes #GP.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** When the "unrestricted guest" control is 1, the CR0.PE and CR0.PG requirements from IA32_VMX_CR0_FIXED0 are not applied to the guest CR0 field, which is what allows an unpaged or real-address-mode guest.  `[SDM 3C Ch.29]` `[1]` `C:high` `V:durable`

### 8.6.6 What CPUID does and does not tell you

- **Claim.** CPUID.01H:ECX bit 5 is the only CPUID indication that VMX operation is supported; all finer-grained VMX feature discovery is done through the IA32_VMX_* MSRs, not through CPUID.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** There is no CPUID leaf that enumerates EPT, VPID, unrestricted guest, APICv or any other VMX feature; a VMM must read IA32_VMX_PROCBASED_CTLS2 and IA32_VMX_EPT_VPID_CAP instead.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The physical-address width (MAXPHYADDR) used by every "must not set bits beyond the physical-address width" check is derived from CPUID.80000008H:EAX bits 7:0 — but not always equal to it: if IA32_TME_ACTIVATE[0] is 1, MAXPHYADDR is reduced by IA32_TME_ACTIVATE[39:36] whenever the logical processor is outside SEAM, and is not reduced inside SEAM.  `[SDM 3D App.A.1]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_FEATURE_CONTROL (MSR address 3AH) gates VMXON independently of the capability MSRs: bit 0 is the lock bit, bit 1 enables VMXON inside SMX operation and bit 2 enables VMXON outside SMX operation.  `[SDM 3C Ch.26]` `[1]` `[5]` `C:high` `V:durable`
- **Claim.** Once bit 0 of IA32_FEATURE_CONTROL is set, any WRMSR to that MSR causes #GP(0) until the next power-up reset, which is how firmware makes a "VT disabled" setting stick.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`

---

### 8.6.7 IA32_VMX_VMCS_ENUM and IA32_VMX_EPT_VPID_CAP

- **Claim.** IA32_VMX_VMCS_ENUM bits 9:1 report the highest index value used for any VMCS encoding, which lets software enumerate the field space without probing every possible encoding.  `[SDM 3D App.A.9]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 20 reports that the INVEPT instruction is supported.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 25 reports support for the single-context INVEPT type and bit 26 reports support for the all-context INVEPT type.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bit 32 reports that the INVVPID instruction is supported.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_EPT_VPID_CAP bits 40, 41, 42 and 43 report support for the individual-address, single-context, all-contexts and single-context-retaining-globals INVVPID types respectively.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`
- **Claim.** Most of the remaining bits of IA32_VMX_EPT_VPID_CAP describe EPT structural capabilities — execute-only translations, supported page-walk lengths, supported EPT memory types, 2-MByte and 1-GByte page support, and accessed/dirty flags — which are owned by chapter `06`.  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`
- **Claim.** Three of them are not structural and are easy to miss: bit 22 reports advanced VM-exit information for EPT violations, bit 23 reports supervisor shadow-stack control, and bits 53:48 enumerate the maximum HLAT prefix size (expected to read 1 on any processor supporting the 1-setting of "enable HLAT").  `[SDM 3D App.A.10]` `[2]` `C:high` `V:durable`

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
- **Claim.** The TRUE_* capability MSRs (48DH–490H) must not be read unless IA32_VMX_BASIC bit 55 is 1; on older processors those MSR addresses are not architecturally defined.  `[SDM 3D App.A.2]` `[2]` `C:high` `V:durable`
- **Claim.** IA32_VMX_PROCBASED_CTLS2 must not be read unless the primary processor-based controls report support for bit 31, "activate secondary controls"; that support is itself reported in the allowed-1 half of IA32_VMX_PROCBASED_CTLS.  `[SDM 3D App.A.3.3]` `[2]` `C:high` `V:durable`
- **Claim.** Treating the two halves of a capability MSR as "supported" and "default" rather than as allowed-0 and allowed-1 — or reading a cleared allowed-0 bit as *must be 0* instead of *may be 0* — manifests as VM-instruction error 7 on processors where a default-1 control cannot be cleared; §8.6.3 states the polarity that avoids it.  `[SDM 3D App.A.2]` `[2]` `[154]` `C:high` `V:durable`
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
