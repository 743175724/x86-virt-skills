# 05. Decoding a #VMEXIT

> **中文速览**：拿着一个退出码来的读者落在这一章。内容是三张穷举表加两组语义：完整的 EXITCODE 表（含 `−1` VMEXIT_INVALID 与 `0x400` NPF）、每类退出的 EXITINFO1/EXITINFO2 布局（含 `#NPF` 的 31/34/35/36/37 位——旧资料在这里整体错位一位）、以及 NRIP、Decode Assist、EVENTINJ 与 EXITINTINFO。事件注入方向与退出解码相反，但放在同一章：它们共用同一批字段，且 `07` 的投递算法要引用它们。

**Maps to:** APM Vol.2 App.C "SVM Intercept Exit Codes" + §15.8 "Decode Assists" (24593 Rev 3.45) [1]
**Owns:** the exit-code table · every EXITINFO1/EXITINFO2 layout including the `#NPF` bits · NRIP · Decode Assist · EVENTINJ · EXITINTINFO · the interrupt shadow as it appears in exit information
**Scope:** OS-independent hardware
**See also:** `03-intercepts.md` (what causes each exit) · `06-nested-paging.md` (#NPF semantics) · `14-sev-snp.md` (what the RMP bits mean)

---

## 5.1 The exit-code space

- **Claim.** On a `#VMEXIT` the reason for the exit is stored in the `EXITCODE` field of the VMCB, and the defined values are enumerated in Appendix C of APM Vol.2.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

### The encoding rule

The exit-code numbering looks arbitrary until you line it up against the intercept bit vectors,
at which point it becomes completely mechanical.

- **Claim.** Appendix C's own statement of the rule is that intercept exit codes "are equal to the bit position of the corresponding flag in the VMCB's intercept vector" — where *the intercept vector* means the six 32-bit words at offsets `000h` through `014h` read as one contiguous bit array, rather than an index inside whichever single word the bit happens to live in.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** Written arithmetically, `exit code = 32 × (vector number) + (bit position within that vector)`, which reproduces every band in the table: vector 0 gives CR reads `00h–0Fh` and CR writes `10h–1Fh`, vector 1 gives DR reads `20h–2Fh` and DR writes `30h–3Fh`, vector 2 gives exceptions `40h–5Fh`, vector 3 gives `60h–7Fh`, vector 4 gives `80h–9Fh` and vector 5 gives `A0h–BFh`.  `[APM2 App.C]` `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** The consequence that catches people out is that the VMRUN intercept, being bit 0 of vector 4, is exit code **80h** and not `00h`: reading a code as the bit's index inside its own 32-bit word is the misconception, and it collapses five distinct bands onto one.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** For exceptions the rule reduces to `exit code = 40h + vector`, which is why §15.12 says the exception vector number can be derived from the `EXITCODE` alone.  `[APM2 App.C]` `[APM2 §15.12]` `[1]` `C:high` `V:durable`
- **Claim.** The rule does not extend past `BFh`: `400h`, `401h`, `402h`, `403h` and `407h` are not intercept-vector bits, and neither are the four negative codes — those are architectural exits and failure reports, not intercepts.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

### The complete table

| Code | Name | Cause |
|---|---|---|
| `00h–0Fh` | `VMEXIT_CR[0-15]_READ` | Read of CR 0 through 15, respectively |
| `10h–1Fh` | `VMEXIT_CR[0-15]_WRITE` | Write of CR 0 through 15, respectively |
| `20h–2Fh` | `VMEXIT_DR[0-15]_READ` | Read of DR 0 through 15, respectively |
| `30h–3Fh` | `VMEXIT_DR[0-15]_WRITE` | Write of DR 0 through 15, respectively |
| `40h–5Fh` | `VMEXIT_EXCP[0-31]` | Exception vector 0–31, respectively |
| `60h` | `VMEXIT_INTR` | Physical INTR (maskable interrupt) |
| `61h` | `VMEXIT_NMI` | Physical NMI |
| `62h` | `VMEXIT_SMI` | Physical SMI (the `EXITINFO1` field provides more information) |
| `63h` | `VMEXIT_INIT` | Physical INIT |
| `64h` | `VMEXIT_VINTR` | Virtual INTR |
| `65h` | `VMEXIT_CR0_SEL_WRITE` | Write of CR0 changed bits other than `CR0.TS` or `CR0.MP` |
| `66h` | `VMEXIT_IDTR_READ` | Read of IDTR |
| `67h` | `VMEXIT_GDTR_READ` | Read of GDTR |
| `68h` | `VMEXIT_LDTR_READ` | Read of LDTR |
| `69h` | `VMEXIT_TR_READ` | Read of TR |
| `6Ah` | `VMEXIT_IDTR_WRITE` | Write of IDTR |
| `6Bh` | `VMEXIT_GDTR_WRITE` | Write of GDTR |
| `6Ch` | `VMEXIT_LDTR_WRITE` | Write of LDTR |
| `6Dh` | `VMEXIT_TR_WRITE` | Write of TR |
| `6Eh` | `VMEXIT_RDTSC` | RDTSC instruction |
| `6Fh` | `VMEXIT_RDPMC` | RDPMC instruction |
| `70h` | `VMEXIT_PUSHF` | PUSHF instruction |
| `71h` | `VMEXIT_POPF` | POPF instruction |
| `72h` | `VMEXIT_CPUID` | CPUID instruction |
| `73h` | `VMEXIT_RSM` | RSM instruction |
| `74h` | `VMEXIT_IRET` | IRET instruction |
| `75h` | `VMEXIT_SWINT` | Software interrupt (INTn instructions) |
| `76h` | `VMEXIT_INVD` | INVD instruction |
| `77h` | `VMEXIT_PAUSE` | PAUSE instruction |
| `78h` | `VMEXIT_HLT` | HLT instruction |
| `79h` | `VMEXIT_INVLPG` | INVLPG instructions |
| `7Ah` | `VMEXIT_INVLPGA` | INVLPGA instruction |
| `7Bh` | `VMEXIT_IOIO` | IN or OUT accessing protected port (the `EXITINFO1` field provides more information) |
| `7Ch` | `VMEXIT_MSR` | RDMSR or WRMSR access to protected MSR |
| `7Dh` | `VMEXIT_TASK_SWITCH` | Task switch |
| `7Eh` | `VMEXIT_FERR_FREEZE` | FP legacy handling enabled, and processor is frozen in an x87/mmx instruction waiting for an interrupt |
| `7Fh` | `VMEXIT_SHUTDOWN` | Shutdown |
| `80h` | `VMEXIT_VMRUN` | VMRUN instruction |
| `81h` | `VMEXIT_VMMCALL` | VMMCALL instruction |
| `82h` | `VMEXIT_VMLOAD` | VMLOAD instruction |
| `83h` | `VMEXIT_VMSAVE` | VMSAVE instruction |
| `84h` | `VMEXIT_STGI` | STGI instruction |
| `85h` | `VMEXIT_CLGI` | CLGI instruction |
| `86h` | `VMEXIT_SKINIT` | SKINIT instruction |
| `87h` | `VMEXIT_RDTSCP` | RDTSCP instruction |
| `88h` | `VMEXIT_ICEBP` | ICEBP instruction |
| `89h` | `VMEXIT_WBINVD` | WBINVD or WBNOINVD instruction |
| `8Ah` | `VMEXIT_MONITOR` | MONITOR or MONITORX instruction |
| `8Bh` | `VMEXIT_MWAIT` | MWAIT or MWAITX instruction |
| `8Ch` | `VMEXIT_MWAIT_CONDITIONAL` | MWAIT or MWAITX instruction, if monitor hardware is armed |
| `8Dh` | `VMEXIT_XSETBV` | XSETBV instruction |
| `8Eh` | `VMEXIT_RDPRU` | RDPRU instruction |
| `8Fh` | `VMEXIT_EFER_WRITE_TRAP` | EFER MSR write trap |
| `90h` | `VMEXIT_CR0_WRITE_TRAP` | CR0 write trap |
| `93h` | `VMEXIT_CR3_WRITE_TRAP` | CR3 write trap |
| `94h` | `VMEXIT_CR4_WRITE_TRAP` | CR4 write trap |
| `A0h` | `VMEXIT_INVLPGB` | INVLPGB instruction |
| `A1h` | `VMEXIT_INVLPGB_ILLEGAL` | Illegal INVLPGB instruction |
| `A2h` | `VMEXIT_INVPCID` | INVPCID instruction |
| `A3h` | `VMEXIT_MCOMMIT` | MCOMMIT instruction |
| `A4h` | `VMEXIT_TLBSYNC` | TLBSYNC instruction |
| `A5h` | `VMEXIT_BUSLOCK` | Bus lock while Bus Lock Threshold Counter value is 0 |
| `A6h` | `VMEXIT_IDLE_HLT` | HLT instruction if a virtual interrupt is not pending |
| `400h` | `VMEXIT_NPF` | Nested paging: host-level page fault occurred |
| `401h` | `AVIC_INCOMPLETE_IPI` | Virtual IPI delivery not completed |
| `402h` | `AVIC_NOACCEL` | Guest access to a vAPIC register not handled by AVIC hardware |
| `403h` | `VMEXIT_VMGEXIT` | VMGEXIT instruction |
| `407h` | `VMEXIT_PML_FULL` | Page Modification Logging Buffer overflow |
| `F000_0000h` | Unused | Reserved for Host |
| `−1` | `VMEXIT_INVALID` | Invalid guest state in VMCB |
| `−2` | `VMEXIT_BUSY` | BUSY bit was set in the VMSA |
| `−3` | `VMEXIT_IDLE_REQUIRED` | The sibling thread is not in an idle state |
| `−4` | `VMEXIT_INVALID_PMC` | Invalid PMC state |

- **Claim.** The table above reproduces every row of the exit-code appendix in Rev 3.45, including the four negative codes and the `F000_0000h` value that is reserved for host use rather than generated by hardware.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** `−2`, `−3` and `−4` are VMRUN failure reports rather than intercepts: `VMEXIT_BUSY` means the BUSY bit was set in the VMSA, `VMEXIT_IDLE_REQUIRED` means the sibling thread was not idle under SMT protection, and `VMEXIT_INVALID_PMC` means invalid PMC state — the first two are SEV-SNP conditions described in `14-sev-snp.md` and the third belongs with the counter virtualization in `03-intercepts.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

### Three numbering traps in the printed table

- **Claim.** There is no unbroken `8Ch–9Fh` write-trap band. Only four write traps are defined — `8Fh` EFER, `90h` CR0, `93h` CR3 and `94h` CR4 — and `8Ch`, `8Dh` and `8Eh` are MWAIT-conditional, XSETBV and RDPRU; the gaps at `91h`, `92h` and `95h–9Fh` correspond to bits the intercept vector marks RESERVED.  `[APM2 App.C]` `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** The full-band form `90h–9Fh VMEXIT_CR[0-15]_WRITE_TRAP` is not an invention: it is what Rev 3.30 (2018) printed, and Rev 3.45 narrowed it to the three control registers that actually have write traps. A corpus carrying the wide band is quoting a superseded revision.  `[APM2 App.C]` `[185]` `C:high` `V:durable`
- **Claim.** Rev 3.45 prints rows `8Eh` (RDPRU) and `8Dh` (XSETBV) in that order, out of numeric sequence; the code-to-name pairing is nevertheless the one the intercept vector implies, since vector 4 bit 13 is XSETBV and bit 14 is RDPRU.  `[APM2 App.C]` `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** `VMEXIT_ICEBP` (`88h`) exists as a separate intercept because a vector-1 exception raised by the single-byte INT1/ICEBP instruction does **not** trigger the `#DB` exception intercept; ICEBP can only be caught through its own instruction intercept.  `[APM2 §15.12.2]` `[1]` `C:high` `V:durable`

## 5.2 Exit information by event class

- **Claim.** The governing rule is stated once, in the `#VMEXIT` description: the contents of `EXITINFO1` and `EXITINFO2` are **undefined** for intercepts where their use is not indicated, so a VMM may not read them speculatively.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### Exception intercepts (40h–5Fh)

- **Claim.** When an intercepted exception defines an error code, SVM delivers that error code in `EXITINFO1` — the same value the exception would have pushed onto the stack.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`
- **Claim.** The saved CS.SEL and rIP match what the exception would have pushed, with one documented exception: for the interrupt-based instructions INT3 (opcode `CCh`), INTO and BOUND, the rIP of the instruction itself is stored rather than the rIP of the next instruction.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`

| Intercepted exception | `EXITINFO1` | `EXITINFO2` |
|---|---|---|
| `#DE`, `#UD`, `#NM`, `#DF`, `#MF`, `#XF` | undefined | undefined |
| `#DB` | undefined | undefined |
| `#BP`, `#OF`, `#BR` | undefined | undefined |
| `#TS` | undefined (see the task-switch intercept) | undefined (see the task-switch intercept) |
| `#NP` | error code | undefined |
| `#SS` | error code | undefined |
| `#GP` | error code | (not specified) |
| `#PF` | page-fault error code | faulting address |
| `#AC` | error code | undefined |
| `#MC` | undefined | undefined |
| `#SX` | error code | undefined |
| `#CP` | error code | undefined |

- **Claim.** The dispositions above are the per-exception statements of §15.12.1 through §15.12.21; vectors 2 and 9 have intercept bits that are not implemented and whose effect if set is undefined.  `[APM2 §15.12]` `[1]` `C:high` `V:durable`
- **Claim.** `#PF` is the richest case: the intercept is tested **before** CR2 is written by the exception, `EXITINFO1` carries the protected-mode error code even when the guest runs in paged real mode, and `EXITINFO2` carries the faulting address.  `[APM2 §15.12.15]` `[1]` `C:high` `V:durable`
- **Claim.** `#DB` writes DR6 and DR7 before the intercept in both its fault-type and its trap-type forms, so the values saved in the VMCB match what a `#DB` handler would have seen; fault-type `#DB` leaves the saved CS:rIP on the faulting instruction while trap-type `#DB` leaves it on the following one.  `[APM2 §15.12.2]` `[1]` `C:high` `V:durable`
- **Claim.** `#MC` is checked after all machine-check registers have been written but before other guest state is modified, and on processors where `Fn8000_000A_EDX[HOST_MCE_OVERRIDE]` (bit 23) is 1 a host with `CR4.MCE = 1` converts containable guest machine checks into `#VMEXIT(MC)` instead of a shutdown.  `[APM2 §15.12.18]` `[1]` `C:high` `V:durable`

### IOIO (7Bh)

| Bits | Field | Meaning |
|---|---|---|
| 31:16 | `PORT` | Intercepted I/O port |
| 15:13 | — | Reserved |
| 12:10 | `SEG` | Effective segment number |
| 9 | `A64` | 64-bit address |
| 8 | `A32` | 32-bit address |
| 7 | `A16` | 16-bit address |
| 6 | `SZ32` | 32-bit operand size |
| 5 | `SZ16` | 16-bit operand size |
| 4 | `SZ8` | 8-bit operand size |
| 3 | `REP` | Repeated port access |
| 2 | `STR` | String-based port access (INS, OUTS) |
| 1 | — | Reserved |
| 0 | `TYPE` | Access type: 0 = OUT, 1 = IN |

- **Claim.** The fourteen fields above are the `EXITINFO1` layout for an IOIO intercept, and `EXITINFO2` holds the rIP of the instruction *following* the IN or OUT so the VMM can resume the guest after emulating the access.  `[APM2 §15.10.2]` `[APM2 Figure 15-2]` `[1]` `C:high` `V:durable`
- **Claim.** `SEG` defaults to DS for OUTS and is always ES, encoded as 0, for INS.  `[APM2 §15.10.3]` `[1]` `C:high` `V:durable`

### MSR (7Ch)

- **Claim.** The MSR intercept encodes direction and nothing else: `EXITINFO1 = 0` for an intercepted RDMSR and `EXITINFO1 = 1` for an intercepted WRMSR. The MSR number is not supplied — it is in guest ECX.  `[APM2 §15.11]` `[1]` `C:high` `V:durable`

### SMI (62h)

- **Claim.** Bit 0 (`SMISRC`) of `EXITINFO1` distinguishes an SMI caused internally by I/O trapping (0) from one asserted externally (1), and bit 1 (`MCREDIR`) reports an SMI due to a redirected machine-check error.  `[APM2 §15.13.3]` `[1]` `C:high` `V:durable`
- **Claim.** If the SMI was asserted while the guest was executing an I/O instruction, the upper 32 bits of `EXITINFO1` describe that instruction — `PORT` in 63:48, `BRP` (I/O breakpoint matches) in 47:44, `TF` in 43, `A64`/`A32`/`A16` in 41/40/39, `SZ32`/`SZ16`/`SZ8` in 38/37/36, `REP` in 35, `STR` in 34, `VAL` in 33 and `TYPE` in 32 — with `SEG` in bits 12:10 and the rIP of the I/O instruction in `EXITINFO2`.  `[APM2 §15.13.3]` `[APM2 Figure 15-3]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 33 (`VAL`) is the validity gate for that whole upper half: if the SMI was not asserted during an I/O instruction the extra bits are undefined.  `[APM2 §15.13.3]` `[1]` `C:high` `V:durable`

### Task switch (7Dh)

- **Claim.** A task-switch intercept delivers the incoming TSS selector in `EXITINFO1[15:0]` and the error code to push in the new task, if applicable, in `EXITINFO2[31:0]`; that error-code field is undefined when no error code applies.  `[APM2 §15.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** `EXITINFO2[63:32]` carries four scattered auxiliary bits rather than a packed field: bit **36** set if the task switch was caused by an IRET, bit **38** set if it was caused by a far jump, bit **44** set if the task switch has an error code, and bit **48** holding the value of `EFLAGS.RF` that would have been saved in the outgoing TSS had the switch not been intercepted.  `[APM2 §15.14.1]` `[1]` `C:high` `V:durable`
- **Claim.** A task switch checks only the single task-switch intercept bit rather than the CR3-write and LDTR-write intercepts it would otherwise trip, and the check happens after the incoming TSS and task gate have been validated but before the switch takes place.  `[APM2 §15.14.1]` `[1]` `C:high` `V:durable`

### Bus lock (A5h) and shutdown (7Fh)

- **Claim.** `EXITINFO1` and `EXITINFO2` are both set to 0 on a `VMEXIT_BUSLOCK`, and the processor writes the current value of the Bus Lock Threshold Counter back on the exit.  `[APM2 §15.14.5]` `[1]` `C:high` `V:durable`
- **Claim.** After an intercepted shutdown the VMCB control area is valid **except** for offsets `60h`, `61h` and `68h`, and the state-save area is undefined — the offsets themselves are catalogued in `02-vmcb.md`.  `[APM2 §15.14.3]` `[1]` `C:high` `V:durable`

### AVIC (401h and 402h)

- **Claim.** For `AVIC_INCOMPLETE_IPI`, `EXITINFO1` holds the values written to the vAPIC ICR registers — ICRH in bits 63:32 and ICRL in bits 31:0.  `[APM2 §15.29.9]` `[APM2 Table 15-25]` `[1]` `C:high` `V:durable`
- **Claim.** `EXITINFO2` for the same exit holds the failure reason in bits 63:32 (`ID`) and, for `ID` values 1 through 3, a table index in bits 11:0; bits 31:12 are reserved and the index is reserved for all other `ID` values.  `[APM2 §15.29.9]` `[APM2 Table 15-26]` `[1]` `C:high` `V:durable`

| `ID` | Cause | Index field |
|---|---|---|
| 0 | Invalid interrupt type — trigger mode was level or the destination type is unsupported | Reserved |
| 1 | IPI target not running — the target's IsRunning bit was clear | Index of the physical or logical ID table entry |
| 2 | Invalid IPI target — not covered by the physical or logical ID table | Index of the entry for the invalid target |
| 3 | Invalid backing page pointer — the vAPIC Backing Page Pointer field held an invalid physical address | Index into the physical or logical ID table, depending on delivery mode |
| 4 | Invalid IPI vector — the vector was below 16 | Reserved |
| 5 | Un-accelerated IPI — destination shorthand is not Self (Secure AVIC) | Reserved |
| > 5 | Reserved | Reserved |

- **Claim.** There are **six** defined `ID` values, 0 through 5, not four; values above 5 are reserved. The index field is meaningful only for `ID` 1, 2 and 3 — the interrupt-delivery machinery behind them is in `07-virtual-interrupts-avic.md`.  `[APM2 Table 15-27]` `[1]` `C:high` `V:durable`
- **Claim.** For `AVIC_NOACCEL`, `EXITINFO1` holds the offset of the un-accelerated register in bits 11:4 and the direction in bit 32 — set for an attempted write, clear for an attempted read — with bits 3:0, 31:12 and 63:33 reserved; `APIC_Offset[3:0]` is always zero because vAPIC registers are 16-byte aligned.  `[APM2 §15.29.9]` `[APM2 Table 15-28]` `[1]` `C:high` `V:durable`
- **Claim.** `EXITINFO2` for `AVIC_NOACCEL` is meaningful in exactly one case: if `EXITINFO1` indicates a write to the vAPIC EOI register at offset `B0h`, bits 7:0 hold the highest in-service vector found in the virtual ISR; otherwise the field is undefined.  `[APM2 §15.29.9]` `[APM2 Table 15-29]` `[1]` `C:high` `V:durable`
- **Claim.** `AVIC_NOACCEL` is also raised for a non-register condition: an attempted EOI when the highest-priority in-service interrupt is set for level-triggered mode.  `[APM2 §15.29.9]` `[1]` `C:high` `V:durable`

### VMGEXIT (403h) and PML full (407h)

- **Claim.** Exit code `403h` reports a VMGEXIT; the exit information is not in the VMCB at all but in the guest-hypervisor communication block, whose layout and protocol are owned by `13-sev-es-ghcb.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** Exit code `407h` reports a Page Modification Logging buffer overflow; the buffer and its semantics belong to `06-nested-paging.md`.  `[APM2 App.C]` `[APM2 §15.25.15]` `[1]` `C:high` `V:durable`

### The interrupt shadow in exit information

- **Claim.** `INTERRUPT_SHADOW` is not carried in `EXITINFO1` or `EXITINFO2` but written back into the VMCB alongside `V_IRQ` and `V_TPR` on every `#VMEXIT`, and loaded again by VMRUN — it indicates the single-instruction window after an instruction such as STI during which interrupts are not recognised.  `[APM2 §15.6]` `[APM2 §15.21.5]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM that re-injects an event must read it, because the processor takes a virtual INTR only when it is not in an interrupt shadow; the rest of the virtual-interrupt delivery conditions are in `07-virtual-interrupts-avic.md`.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`

## 5.3 Nested page faults

Exit code `400h` carries the most heavily mis-transcribed bit layout in SVM. The low bits are a
`#PF`-shaped error code; the high bits are two unrelated groups bolted on by nested paging and by
SEV-SNP, documented in two different sections.

- **Claim.** On `#VMEXIT(NPF)` the faulting **guest physical address** is saved in `EXITINFO2` and `EXITINFO1` delivers an error code similar to a `#PF` error code.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`

| Bit | Name | Meaning | Source |
|---|---|---|---|
| 0 | `P` | Cleared to 0 if the nested page was not present, 1 otherwise | §15.25.6 |
| 1 | `RW` | Set if the nested-page-table-level access was a write | §15.25.6 |
| 2 | `US` | Set if the nested-page-table-level access was a user access | §15.25.6 |
| 3 | `RSV` | Set if reserved bits were set in the corresponding nested page table entry | §15.25.6 |
| 4 | `ID` | Set if the nested-page-table-level access was a code read | §15.25.6 |
| 6 | `SS` | Set if the fault was caused by a shadow stack access | §15.25.6 |
| 31 | `RMP` | Set if the fault was caused by an RMP check or a VMPL check failure | §15.36.10 |
| 32 | — | Set if the fault occurred while translating the guest's final physical address | §15.25.6 |
| 33 | — | Set if the fault occurred while translating the guest page tables | §15.25.6 |
| 34 | `ENC` | Set if the guest's effective C-bit was 1 | §15.36.10 |
| 35 | `SIZEM` | Set if the fault was caused by a size mismatch between PVALIDATE or RMPADJUST and the RMP | §15.36.10 |
| 36 | `VMPL` | Set if the fault was caused by a VMPL permission check failure | §15.36.10 |
| 37 | `SSS` | Two definitions — see below | §15.25.6 and §15.36.10 |

- **Claim.** The bit numbers above are AMD's own, printed as "Bit 34 (ENC)", "Bit 35 (SIZEM)", "Bit 36 (VMPL)" and "Bit 37 (SSS)" in the RMP access-check section and as bits 0–4, 6, 32, 33 and 37 in the nested-paging section; a numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is off by one from bit 34 upward. The meaning of the RMP-related bits is explained in `14-sev-snp.md`.  `[APM2 §15.36.10]` `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Bit **5** is absent. A `#PF` error code puts the protection-key violation there; the nested-page-fault error code defines nothing at bit 5 and puts the shadow-stack indication at bit 6 instead.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 32 and 33 are printed without mnemonics — AMD refers to them only as `EXITINFO1[33:32]` — and they answer one question: whether the nested fault happened during the walk of the guest's page tables or during the final guest-physical to system-physical translation.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 37 carries two definitions in two sections and they are not the same statement: §15.25.6 defines it as the leaf nested-page-table entry being marked a supervisor shadow stack page with the shadow-stack check feature enabled, while §15.36.10 defines it as the VMPL permission mask `SSS` (bit 4) value when `VmplSSS` is enabled — that second reading is an SEV-SNP concept defined in `14-sev-snp.md`. A decoder must know which feature is active before reading the bit.  `[APM2 §15.25.6]` `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 31 is documented as the error bit set on an RMP-check-related `#PF` and every RMP violation sets it, while bits 34 through 37 are documented as bits that "may be set" on a `#VMEXIT(NPF)` — the two groups are stated separately and are not one flat list.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** Two conventions in the low bits routinely mislead: table walks for guest page tables are always treated as **data writes** at the nested page table level (so `RW` is set even for a code read), and nested page table accesses performed by the MMU are treated as **user** accesses unless an enabled feature overrides that — the fault-ordering rules are in `06-nested-paging.md`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** An RMP check can also fail transiently: any memory access that results in an RMP check may produce an RMP violation if the accessed RMP entries are in use by other logical processors, and software should retry the access rather than treat the fault as terminal.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`

## 5.4 NRIP and Decode Assist

### NRIP

- **Claim.** The next sequential instruction pointer (`nRIP`) is saved in the guest VMCB control area at location `C8h`; the field itself is catalogued in `02-vmcb.md`.  `[APM2 §15.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** `nRIP` is filled on all `#VMEXIT`s due to instruction intercepts as defined in §15.9, plus MSR and IOIO intercepts, plus exceptions caused by the INT3, INTO and BOUND instructions. **For all other intercepts nRIP is reset to zero** — it is defined as zero, not left undefined.  `[APM2 §15.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** `nRIP` is the RIP that would be pushed if the current instruction took a trap-style debug exception and caused no change in control flow; if the intercepted instruction *would* have changed control flow, `nRIP` points at the next sequential instruction rather than at the branch target.  `[APM2 §15.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** Support for the NRIP save is enumerated by `CPUID Fn8000_000A_EDX[NRIPS]`, which is **bit 3** of that register — `Fn8000_0001_ECX[10]` is IBS and has nothing to do with it.  `[APM2 §15.7.1]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`
- **Claim.** NRIP has a second, non-obvious role: software interrupts cannot be properly injected on a processor that does not support the NextRIP field, and a hypervisor must emulate software-interrupt injection when `NRIPS` is 0.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`

### Decode Assists

- **Claim.** Decode assists let a hypervisor decode guest instructions more cheaply, and support is enumerated by `CPUID Fn8000_000A_EDX[DecodeAssists]`, bit 7.  `[APM2 §15.8]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`

| Intercept | `EXITINFO1` layout |
|---|---|
| MOV CRx | bits 3:0 GPR number; bits 62:4 zero; bit 63 set if the instruction was a MOV CRx |
| MOV DRx | bits 3:0 GPR number; bits 63:4 zero |
| INTn | bits 7:0 software interrupt number; bits 63:8 zero |
| INVLPG | bits 63:0 linear address |

- **Claim.** The four layouts above are the decode-assist `EXITINFO1` formats; for MOV CRx the GPR number is accompanied by bit 63 as a "this really was a MOV CRx" flag.  `[APM2 §15.8.1]` `[APM2 §15.8.2]` `[APM2 §15.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 63 is the discriminator for the four instructions that touch CR0 without being a MOV: LMSW and CLTS provide no additional information and leave bit 63 clear, and SMSW likewise provides nothing and leaves it clear, whereas MOV-to-CR and MOV-from-CR both supply the GPR number with bit 63 set.  `[APM2 §15.8.1]` `[1]` `C:high` `V:durable`
- **Claim.** The INVLPG layout gives the linear address after segment-base addition and address-size masking; for an INVLPGA intercept no linear address is provided in `EXITINFO1` at all, because it is already in guest rAX — the instruction is described in `06-nested-paging.md`.  `[APM2 §15.8.3]` `[1]` `C:high` `V:durable`

### Guest Instruction Bytes

- **Claim.** On a nested page fault or an intercepted `#PF`, guest instruction bytes at guest CS:RIP are stored into the 16-byte-wide Guest Instruction Bytes field at VMCB offset `0D0h`, with the number of bytes fetched in bits 3:0, zero in bits 7:4 and the instruction bytes in bits 127:8; the field's place in the layout is in `02-vmcb.md`.  `[APM2 §15.8.4]` `[1]` `C:high` `V:durable`
- **Claim.** Up to 15 bytes are recorded and the default is always 15; fewer are returned only if a fault such as a not-present page or a CS-limit overrun occurs while fetching, and a count of zero means no bytes were fetched.  `[APM2 §15.8.4]` `[1]` `C:high` `V:durable`
- **Claim.** Two validity rules bound the field: it is filled in only during **data** page faults — instruction-fetch page faults provide no additional information — and all other intercepts clear bits 7:0 to zero to indicate an invalid condition, while implementations may leave the remaining bytes untouched.  `[APM2 §15.8.4]` `[1]` `C:high` `V:durable`

## 5.5 Event injection and re-injection

`EVENTINJ` and `EXITINTINFO` point in opposite directions but share one encoding, which is why
they belong on the same page: a VMM re-injects a lost event by copying the second into the first.

### EVENTINJ

- **Claim.** A VMM injects an exception or interrupt into a guest by setting bits in the VMCB `EVENTINJ` field before executing VMRUN; the guest then takes the event unconditionally before executing its first instruction.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`

| Bits | Field | Meaning |
|---|---|---|
| 7:0 | `VECTOR` | 8-bit IDT vector; ignored when `TYPE` is 2 (NMI) |
| 10:8 | `TYPE` | Event type, see the table below |
| 11 | `EV` | Error Code Valid — set if the exception should push an error code |
| 30:12 | — | Reserved, SBZ |
| 31 | `V` | Valid — set if an event is to be injected |
| 63:32 | `ERRORCODE` | Error code to push when `EV` is 1; ignored otherwise |

| `TYPE` | Meaning |
|---|---|
| 0 | External or virtual interrupt (INTR) |
| 2 | NMI |
| 3 | Exception (fault or trap) |
| 4 | Software interrupt (INTn instruction) |

- **Claim.** The `EVENTINJ` layout above is the field definition, and its encoding matches that of `EXITINTINFO` field for field.  `[APM2 §15.20]` `[APM2 Figure 15-5]` `[1]` `C:high` `V:durable`
- **Claim.** `TYPE` has **four** defined values — 0, 2, 3 and 4 — and value 1 is not among them; values not listed are unused and reserved.  `[APM2 Table 15-11]` `[1]` `C:high` `V:durable`
- **Claim.** Injected events are treated as though they had occurred normally in the guest, including being recorded in `EXITINTINFO`, with five documented departures.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Departure one: injected events are not subject to intercept checks, although secondary exceptions raised during delivery of an injected event *are* subject to exception intercepts.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Departure two: an injected NMI does not block delivery of further NMIs.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Departure three: attempting to inject an event that is impossible for the guest mode — the manual's example is a `#BR` while the guest is in 64-bit mode — makes the injection fail with no guest instruction executed, and VMRUN exits immediately with `VMEXIT_INVALID`.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Departure four: injecting an exception with `TYPE = 3` and vector 3 or 4 behaves like the trap raised by INT3 or INTO, so the processor checks the DPL of the IDT descriptor before dispatching.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Departure five: intercepted `#DB` faults resulting from a guest ICEBP cannot be injected, because ICEBP does no DPL check whereas INTn injection does; a hypervisor must emulate ICEBP injection itself.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** Two further conditions make VMRUN fail with `VMEXIT_INVALID`: a reserved `TYPE` value, and `TYPE = 3` with a vector that does not correspond to an exception — a category that explicitly includes vector 2, which is an NMI and not an exception.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`
- **Claim.** The `EVENTINJ` field is cleared in the VMCB on `#VMEXIT`, so a hypervisor that wants the same event injected again must rewrite it.  `[APM3 §4 "VMRUN"]` `[2]` `C:high` `V:durable`
- **Claim.** SEV-ES narrows what may be injected: software interrupts and exception vectors 3 and 4 may not be injected into an SEV-ES guest, and attempting it makes VMRUN fail with `VMEXIT_INVALID` — see `13-sev-es-ghcb.md`.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`

### EXITINTINFO

| Bits | Field | Meaning |
|---|---|---|
| 7:0 | `VECTOR` | 8-bit IDT vector of the interrupt or exception |
| 10:8 | `TYPE` | Qualifies the event the guest was delivering |
| 11 | `EV` | Error Code Valid — set if the guest exception would have pushed an error code |
| 30:12 | — | Reserved |
| 31 | `V` | Valid — set if the intercept occurred during IDT delivery |
| 63:32 | `ERRORCODE` | The error code the guest exception would have pushed; undefined when `EV` is 0 |

- **Claim.** `EXITINTINFO` exists because an intercept can occur while the guest is delivering an exception or interrupt through the IDT, at which point information needed to resume transparently may already be unrecoverable — for an external interrupt the processor has already run the acknowledge cycle against the PIC or APIC and the interrupt is no longer pending.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** All intercepts indicate in `EXITINTINFO` whether they occurred during IDT delivery, and the layout above is the field definition.  `[APM2 §15.7.2]` `[APM2 Figure 15-1]` `[1]` `C:high` `V:durable`
- **Claim.** The `TYPE` values are the same four as for injection — 0 external or virtual interrupt, 2 NMI, 3 exception, 4 software interrupt — with values not indicated unused and reserved.  `[APM2 Table 15-1]` `[1]` `C:high` `V:durable`
- **Claim.** The classification of INT1/ICEBP, INT3 and INTO is counter-intuitive and explicit: despite the instruction names, the events raised by opcodes `F1h`, `CCh` and `CEh` count as **exceptions** for `EXITINTINFO` purposes, and only events raised by INTn (opcode `CDh`) count as software interrupts.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** When several exceptions are in flight, `EXITINTINFO` records the aggregate of all of them except the last, intercepted one; the intercepted exception itself is described by `EXITCODE` and, where defined, `EXITINFO1` and `EXITINFO2`.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** The manual's worked example is worth memorising: a guest `#GP` during whose delivery a `#NP` arises resolves to `#DF` by x86 rules, and an intercepted `#PF` during the attempt to deliver that `#DF` reports `#PF` in `EXITCODE` with `#DF` in `EXITINTINFO`; if the VMM reflects rather than repairs the `#PF`, combining it with the recorded `#DF` gives a triple fault or shutdown.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** The pseudo-code fixes the ordering: an intercepted exception exits before `EXITINTINFO` is written, the combined result is checked against the `#DF` and shutdown intercepts next, `EXITINTINFO` is then set to the event being delivered, and it is cleared by setting `V` to 0 once the exception has been successfully taken in the guest.  `[APM2 §15.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** The invariant that follows is the one a decoder should rely on: when an exception triggers an intercept, `EXITCODE` (and optionally `EXITINFO1` and `EXITINFO2`) always reflects the *intercepted* exception, while `EXITINTINFO`, if valid, reflects the *prior* exception the guest was attempting to deliver.  `[APM2 §15.7.3]` `[1]` `C:high` `V:durable`

### What the guest state in the VMCB means at the moment of exit

- **Claim.** The guest state saved in the VMCB is the processor state as of the moment the intercept triggers, which for a trap intercept means *after* the triggering instruction has completed — the saved CS:rIP points at the following instruction and the saved DR7 includes the effects of the matching breakpoint.  `[APM2 §15.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** Instruction intercepts occur before the instruction's results are committed, but at an intercept-specific priority relative to its exception checks: generally after simple exceptions such as `#UD` or a CPL-related `#GP` and before memory-access and operand-value exceptions, with documented exceptions such as RSM — the per-instruction priority table is in `03-intercepts.md`.  `[APM2 §15.7]` `[1]` `C:high` `V:durable`

## 5.6 Open items

- **The exit-code table's table number is deliberately not used as an anchor.** Appendix C contains
  exactly one table and this chapter anchors to `[APM2 App.C]` throughout. The bookmark tree for
  Rev 3.45 does name it, but appendix table numbers have not been treated as stable in this rebuild,
  and nothing in the chapter depends on the number.

- **`#GP`'s `EXITINFO2` is unstated.** §15.12.14 says `EXITINFO1` holds the error code and, unlike
  the neighbouring subsections for `#NP`, `#SS`, `#AC`, `#SX` and `#CP`, says nothing at all about
  `EXITINFO2`. The table in §5.2 records that as "not specified" rather than guessing "undefined";
  the general rule in §15.6 means a VMM must treat it as undefined regardless.

- **Bit 37 of the nested-page-fault error code is genuinely double-defined.** Both readings are
  printed in Rev 3.45, in §15.25.6 and §15.36.10. There is no text reconciling them. A decoder must
  branch on which feature is enabled; this chapter records both rather than picking one.

- **Bits 32 and 33 have no AMD mnemonics.** Names in circulation for them come from operating-system
  headers, not from the manual, and are not used here.

- **`#VMEXIT(NPF)` under Secure AVIC and segmented RMP is out of scope here.** Further
  `EXITINFO1` definitions may be added by features documented in §15.36.21 and §15.36.22; those
  sections belong to `14-sev-snp.md` and were not audited for additional error bits.

- **Not covered here.** Which intercept bit produces a given code is `03-intercepts.md`; the VMCB
  offsets referenced (`C8h`, `0D0h`, `60h`, `61h`, `68h`) are `02-vmcb.md`; nested-page-fault
  ordering and semantics are `06-nested-paging.md`; the AVIC data structures behind `401h` and
  `402h` are `07-virtual-interrupts-avic.md`; and the `403h` payload is `13-sev-es-ghcb.md`.
