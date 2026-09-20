# 02. The Virtual Machine Control Block

> **中文速览**：VMCB 是 SVM 的中枢数据结构，本章是整个技能库最核心的一章。内容是**逐字段的偏移表**：控制区 0x000–0x3FF 与状态保存区各自完整列出，段描述符逐个成行，段属性的 12 位打包编码（TYPE/S/DPL/P/AVL/L/D/B/G）与 CPL 的真实来源，`INTERRUPT_SHADOW` 中断影子，以及 clean bits 的分组、语义、和它与嵌套分页/ASID 的交互——那是"硬件用了陈旧状态"这类 bug 的头号来源。验收标准是：读者不查 PDF 就能构造并解码一个 VMCB。字段的**语义**分散在 `03`（拦截）、`05`（退出信息）、`07`（虚拟中断）。

**Maps to:** APM Vol.2 App.B "VMCB Layout" (incl. B.1 Guest MSR Intercepts) + §15.15 "VMCB State Caching" (24593 Rev 3.45) [1]
**Owns:** every VMCB field offset (control area and state save area) · segment attribute encoding and the CPL source · `INTERRUPT_SHADOW` · clean bits and their interaction with nested paging and ASID · the CET save-area fields
**Scope:** OS-independent hardware
**See also:** `03-intercepts.md` · `05-exit-decoding.md` · `06-nested-paging.md` (nCR3, G_PAT) · `07-virtual-interrupts-avic.md` (INT_CTL, AVIC pointers)

---

## 2.1 What the VMCB is, and how software touches it

The VMCB is one 4-Kbyte page holding two areas: a **control area** at offset 0 and a **state save
area** at offset 400h. Appendix B of APM Vol.2 is the only normative layout; Table B-1 gives the
control area and Table B-2 the state save area, with B-2's offsets stated **relative to the start
of the save area, not to the VMCB**. Every offset in §2.3 below is therefore a save-area offset;
add 400h to get the VMCB offset. Guest FS base, for example, is at save-area offset 048h, which is
VMCB offset 448h.

- **Claim.** The VMCB is divided into a control area starting at VMCB offset 0 and a state save area; the control area is padded to a size of **1024 bytes**, and all unused bytes must be zero because they are reserved for future expansion — AMD recommends zeroing any newly allocated VMCB.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** When SEV-ES is not enabled, the state save area starts at VMCB offset **400h**, and Table B-2 lists offsets relative to the state save area rather than to the VMCB as a whole.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN takes the physical address of a **4-Kbyte-aligned** page in rAX (EAX in 32-bit mode) as its implicit operand; the VMCB is accessed by physical address and **should be mapped as writeback (WB) memory**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The last defined save-area offset range is 900h–BFFh (reserved), so the save area ends at save-area offset BFFh — VMCB offset FFFh — which is exactly the end of the 4-Kbyte page.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`

Three access rules follow from the appendix and §15.15, and they are the ones software gets wrong:

- **Claim.** Control-area offsets `3E0h–3FFh` are "Reserved for Host usage" — the only region of the VMCB the architecture hands to the hypervisor for its own bookkeeping.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** SMM software, or any other agent external to the hypervisor that has access to VMCBs and changes their contents, must comprehend the clean bits and adjust them accordingly, otherwise the guest may not operate as intended.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** On `#VMEXIT` the processor writes back to the VMCB the same subset of processor state that VMRUN loads, including the `V_IRQ`, `V_TPR` and `INTERRUPT_SHADOW` bits — so a hypervisor that caches its own copy of those fields must re-read them after every exit.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

When SEV-ES is enabled the save area moves out of the VMCB entirely, into a separate VMSA page.
That layout is Table B-4 and is owned by `13-sev-es-ghcb.md`; the swap-type classification that
goes with it is Table B-3.

- **Claim.** When SEV-ES is enabled the VMSA structure starts at offset 0h in the page indicated by the VMSA Pointer, and its state is classified into three swap types (A, B, C) describing how hardware handles each field during a world switch; that layout is Table B-4, not Table B-2.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** The format of the **host** save area is identical to the guest save area, except that it begins at offset 400h in the host save page — so the host TR value is stored at offset 490h relative to the start of the host save page. This is a statement about layout only; §15.5.1 still forbids software from relying on the host save area's contents. See `01-svm-intro.md` for the `VM_HSAVE_PA` contract.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

## 2.2 Control area: offsets 0x000–0x3FF

### 2.2.1 Intercept vectors, 000h–017h

| Offset | Bits | Content |
|---|---|---|
| 000h (vector 0) | 15:0 | Intercept reads of CR0–15, respectively |
| 000h | 31:16 | Intercept writes of CR0–15, respectively |
| 004h (vector 1) | 15:0 | Intercept reads of DR0–15, respectively |
| 004h | 31:16 | Intercept writes of DR0–15, respectively |
| 008h (vector 2) | 31:0 | Intercept exception vectors 0–31, respectively |
| 00Ch (vector 3) | 31:0 | INTR, NMI, SMI, INIT, VINTR, selective CR0 write, descriptor-table reads and writes, RDTSC, RDPMC, PUSHF, POPF, CPUID, RSM, IRET, INTn, INVD, PAUSE, HLT, INVLPG, INVLPGA, `IOIO_PROT`, `MSR_PROT`, task switch, `FERR_FREEZE`, shutdown |
| 010h (vector 4) | 20:0 | VMRUN, VMMCALL, VMLOAD, VMSAVE, STGI, CLGI, SKINIT, RDTSCP, ICEBP, WBINVD/WBNOINVD, MONITOR, MWAIT, MWAIT-if-armed, XSETBV, RDPRU, EFER write trap, CR0/CR3/CR4 write traps |
| 010h | 18:17, 31:21 | RESERVED |
| 014h (vector 5) | 6:0 | INVLPGB (all), INVLPGB (illegal only), INVPCID, MCOMMIT, TLBSYNC, bus lock, idle HLT |
| 014h | 31:7 | RESERVED, SBZ |

- **Claim.** The VMCB carries **six** intercept vectors at 000h, 004h, 008h, 00Ch, 010h and 014h, each 32 bits wide; vector 0 splits CR reads and writes at bit 16, vector 1 does the same for DR, and vector 2 is one bit per exception vector 0–31.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** In vector 3 (00Ch) the bit order is: 0 INTR, 1 NMI, 2 SMI, 3 INIT, 4 VINTR, 5 CR0 writes that change bits other than `CR0.TS` or `CR0.MP`, 6–9 reads of IDTR/GDTR/LDTR/TR, 10–13 writes of IDTR/GDTR/LDTR/TR, 14 RDTSC, 15 RDPMC, 16 PUSHF, 17 POPF, 18 CPUID, 19 RSM, 20 IRET, 21 INTn, 22 INVD, 23 PAUSE, 24 HLT, 25 INVLPG, 26 INVLPGA, 27 `IOIO_PROT`, 28 `MSR_PROT`, 29 task switches, 30 `FERR_FREEZE`, 31 shutdown events. Intercept semantics are owned by `03-intercepts.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** In vector 4 (010h) the bit order is: 0 VMRUN, 1 VMMCALL, 2 VMLOAD, 3 VMSAVE, 4 STGI, 5 CLGI, 6 SKINIT, 7 RDTSCP, 8 ICEBP, 9 WBINVD and WBNOINVD, 10 MONITOR/MONITORX, 11 MWAIT/MWAITX unconditionally, 12 MWAIT/MWAITX if monitor hardware is armed, 13 XSETBV, 14 RDPRU, 15 EFER writes (trap), 16 CR0 writes (trap), 19 CR3 writes (trap), 20 CR4 writes (trap); **bits 18:17 and 31:21 are RESERVED**.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Vector 4 defines write traps for only three control registers — CR0 at bit 16, CR3 at bit 19 and CR4 at bit 20 — and not a contiguous CR0–15 trap field; the gap at bits 18:17 and the reserved tail at 31:21 are printed explicitly in the layout table.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** In vector 5 (014h) the bit order is: 0 intercept all INVLPGB instructions, 1 intercept only illegally specified INVLPGB instructions, 2 INVPCID, 3 MCOMMIT, 4 TLBSYNC, 5 bus lock operations when the Bus Lock Threshold Counter is 0 (which occurs **before** the guest instruction executes), 6 HLT if a virtual interrupt is not pending; bits 31:7 are RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Vector 5 bit 4 (TLBSYNC intercept) is present only when `CPUID Fn8000_000A_EDX[24] = 1`; the layout table states the dependency in-line. CPUID enumeration is owned by `01-svm-intro.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

The exit code produced by each of these bits is **not** the bit number — see `05-exit-decoding.md`
for the segmented encoding.

### 2.2.2 Controls, 018h–067h

| Offset | Bits | Field |
|---|---|---|
| 018h–03Bh | — | RESERVED, SBZ |
| 03Ch | 15:0 | PAUSE Filter Threshold |
| 03Eh | 15:0 | PAUSE Filter Count |
| 040h | 63:0 | `IOPM_BASE_PA` — physical base address of the IOPM (bits 11:0 ignored) |
| 048h | 63:0 | `MSRPM_BASE_PA` — physical base address of the MSRPM (bits 11:0 ignored) |
| 050h | 63:0 | `TSC_OFFSET` — added in RDTSC and RDTSCP |
| 058h | 31:0 | Guest ASID |
| 058h | 39:32 | `TLB_CONTROL` |
| 058h | 40 | `ALLOW_LARGER_RAP` |
| 058h | 41 | `CLEAR_RAP` |
| 058h | 63:42 | RESERVED, SBZ |
| 060h | 63:0 | `INT_CTL` (bit detail below) |

- **Claim.** Offsets 018h–03Bh are RESERVED, SBZ; **03Ch is the PAUSE Filter Threshold (bits 15:0) and 03Eh is the PAUSE Filter Count (bits 15:0)** — two 16-bit fields, not reserved space.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `IOPM_BASE_PA` is at 040h and `MSRPM_BASE_PA` at 048h, both 64-bit physical base addresses whose **bits 11:0 are ignored**; the permission-map formats are owned by `03-intercepts.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `TSC_OFFSET` is a full 64-bit field at 050h, and 058h packs four fields: Guest ASID in bits 31:0, `TLB_CONTROL` in bits 39:32, `ALLOW_LARGER_RAP` at bit 40, `CLEAR_RAP` at bit 41, and RESERVED, SBZ in bits 63:42. Flush-command encodings are owned by `06-nested-paging.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `ALLOW_LARGER_RAP` selects the guest's return address predictor size — 0 means 32, 1 means the value of `CPUID Fn8000_0021_EBX[RapSize]` — and `CLEAR_RAP` set to 1 clears the RAP on VMRUN.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

Offset 060h is the field Linux and most hypervisor sources call `INT_CTL`. Its bit assignments are
listed here because offsets are this chapter's job; every one of their **semantics** is owned by
`07-virtual-interrupts-avic.md`.

| Bits | Field |
|---|---|
| 7:0 | `V_TPR` — 4-bit virtual TPR in bits 3:0; bits 7:4 SBZ |
| 8 | `V_IRQ` |
| 9 | `VGIF` |
| 11 | `V_NMI` |
| 12 | `V_NMI_MASK` |
| 15:13 | RESERVED, SBZ |
| 19:16 | `V_INTR_PRIO` |
| 20 | `V_IGN_TPR` |
| 23:21 | RESERVED, SBZ |
| 24 | `V_INTR_MASKING` |
| 25 | `VGIF_EN` |
| 26 | `V_NMI_ENABLE` |
| 29:27 | RESERVED, SBZ |
| 30 | x2AVIC Enable |
| 31 | AVIC Enable |
| 39:32 | `V_INTR_VECTOR` |
| 63:40 | RESERVED, SBZ |

- **Claim.** `INT_CTL` at VMCB offset 060h assigns bits 7:0 `V_TPR`, 8 `V_IRQ`, 9 `VGIF`, 11 `V_NMI`, 12 `V_NMI_MASK`, 19:16 `V_INTR_PRIO`, 20 `V_IGN_TPR`, 24 `V_INTR_MASKING`, 25 `VGIF_EN`, 26 `V_NMI_ENABLE`, 30 x2AVIC Enable, 31 AVIC Enable and 39:32 `V_INTR_VECTOR`, with 15:13, 23:21, 29:27 and 63:40 RESERVED, SBZ; the semantics are owned by `07-virtual-interrupts-avic.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** **Bit 10 of offset 060h has no row at all** in the layout table — it is neither assigned a name nor swept into a reserved range, sitting between `VGIF` at 9 and `V_NMI` at 11. Software must treat it as SBZ under the appendix's blanket "all unused bytes must be zero" rule, but the table does not say so. Bit semantics belong to `07-virtual-interrupts-avic.md`.  `[APM2 Table B-1]` `[1]` `C:medium` `V:durable`

### 2.2.3 Interrupt state, exit information and feature enables, 068h–0B7h

| Offset | Bits | Field |
|---|---|---|
| 068h | 0 | `INTERRUPT_SHADOW` — guest is in an interrupt shadow |
| 068h | 1 | `GUEST_INTERRUPT_MASK` — value of the `RFLAGS.IF` bit for an SEV-ES guest |
| 068h | 63:2 | RESERVED, SBZ |
| 070h | 63:0 | `EXITCODE` |
| 078h | 63:0 | `EXITINFO1` |
| 080h | 63:0 | `EXITINFO2` |
| 088h | 63:0 | `EXITINTINFO` |
| 090h | 0 | `NP_ENABLE` |
| 090h | 1 | Enable Secure Encrypted Virtualization |
| 090h | 2 | Enable Encrypted State for Secure Encrypted Virtualization |
| 090h | 3 | Guest Mode Execute Trap |
| 090h | 4 | `SSSCheckEn` (present iff `CPUID Fn8000_000A_EDX[19]`) |
| 090h | 5 | Virtual Transparent Encryption |
| 090h | 6 | Enable Read Only Guest Page Tables |
| 090h | 7 | Enable INVLPGB/TLBSYNC (present iff `CPUID Fn8000_000A_EDX[24]`) |
| 090h | 10:8 | RESERVED, SBZ |
| 090h | 11 | Enable Page Modification Logging |
| 090h | 63:12 | RESERVED, SBZ |
| 098h | 51:0 | AVIC `APIC_BAR`; 63:52 RESERVED, SBZ |
| 0A0h | 63:0 | Guest physical address of the GHCB |
| 0A8h | 63:0 | `EVENTINJ` |
| 0B0h | 63:0 | `N_CR3` — nested page table CR3 |

- **Claim.** Offset 068h holds two bits and no more: bit 0 `INTERRUPT_SHADOW` ("guest is in an interrupt shadow") and bit 1 `GUEST_INTERRUPT_MASK` ("value of the `RFLAGS.IF` bit for SEV-ES guest"), with bits 63:2 RESERVED, SBZ. **AMD's layout table gives the 068h qword no field name of its own**; "INT_STATE" is a hypervisor-side convention, not AMD's.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `INTERRUPT_SHADOW` is loaded into the processor by VMRUN and written back by `#VMEXIT`, so it is part of guest state rather than a pure control input; interrupt-shadow semantics are §15.21.5 and are owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The exit-information block is four consecutive qwords: `EXITCODE` at 070h, `EXITINFO1` at 078h, `EXITINFO2` at 080h and `EXITINTINFO` at 088h. **There is no separate field at 08Ch** — 08Ch is simply the upper dword of the 64-bit `EXITINTINFO` at 088h, which does carry an error code in its upper half. Decoding is owned by `05-exit-decoding.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Offset 090h is the feature-enable word: bit 0 `NP_ENABLE`, 1 SEV enable, 2 SEV-ES (encrypted state) enable, 3 Guest Mode Execute Trap, 4 `SSSCheckEn`, 5 Virtual Transparent Encryption, 6 Read Only Guest Page Tables, 7 INVLPGB/TLBSYNC enable, 11 Page Modification Logging enable, with bits 10:8 and 63:12 RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 7 of 090h is a three-state control rather than a plain enable: 0 makes INVLPGB and TLBSYNC raise `#UD` in the guest, 1 permits them, and **when the bit is not present, or the guest is an SEV-ES guest, INVLPGB and TLBSYNC are always enabled in the guest if the processor supports them**.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** AVIC `APIC_BAR` is at 098h in bits 51:0 with 63:52 RESERVED, SBZ; the guest physical address of the GHCB is a full qword at 0A0h; `EVENTINJ` is at 0A8h and `N_CR3` at 0B0h. Their semantics are owned by `07-virtual-interrupts-avic.md`, `13-sev-es-ghcb.md`, `05-exit-decoding.md` and `06-nested-paging.md` respectively.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

### 2.2.4 Virtualization enables, decode assist and pointers, 0B8h–17Fh

| Offset | Bits | Field |
|---|---|---|
| 0B8h | 0 | LBR Virtualization Enable |
| 0B8h | 1 | VMSAVE/VMLOAD Virtualization Enable |
| 0B8h | 2 | IBS Virtualization Enable |
| 0B8h | 3 | PMC Virtualization Enable |
| 0B8h | 63:4 | RESERVED, SBZ |
| 0C0h | 31:0 | VMCB Clean Bits; 63:32 RESERVED, SBZ |
| 0C8h | 63:0 | `nRIP` — next sequential instruction pointer |
| 0D0h | 7:0 | Number of bytes fetched |
| 0D0h | 127:8 | Guest instruction bytes (so the field occupies 0D0h–0DFh) |
| 0E0h | 51:0 | AVIC `APIC_BACKING_PAGE` Pointer; 63:52 RESERVED, SBZ |
| 0E8h–0EFh | — | RESERVED, SBZ |
| 0F0h | 51:12 | AVIC `LOGICAL_TABLE` Pointer; 11:0 Reserved, SBZ; 63:52 RESERVED, SBZ |
| 0F8h | 51:12 | AVIC `PHYSICAL_TABLE` Pointer |
| 0F8h | 11:0 | `AVIC_PHYSICAL_MAX_INDEX`; 63:52 RESERVED, SBZ |
| 100h–107h | — | RESERVED, SBZ |
| 108h | 51:12 | VMSA Pointer; 11:0 and 63:52 RESERVED, SBZ |
| 110h | 63:0 | `VMGEXIT_RAX` |
| 118h | 7:0 | `VMGEXIT_CPL` |
| 120h | 15:0 | Bus Lock Threshold Counter |
| 128h–133h | — | RESERVED, SBZ |
| 134h | 0 | `UPDATE_IRR` |
| 138h | 63 | `ALLOWED_SEV_FEATURES_EN`; 62 RESERVED, SBZ |
| 138h | 61:0 | `ALLOWED_SEV_FEATURES_MASK` |
| 140h | 61:0 | `GUEST_SEV_FEATURES` |
| 148h | — | RESERVED, SBZ |
| 150h | 255:0 | `REQUESTED_IRR` (32 bytes, 150h–16Fh) |
| 170h | 63:0 | `EXITINTDATA` |
| 178h | 63:0 | `EVENTINJDATA` |

- **Claim.** Offset 0B8h defines **four** virtualization-enable bits, not two: bit 0 LBR Virtualization Enable, bit 1 VMSAVE/VMLOAD Virtualization Enable, bit 2 IBS Virtualization Enable, bit 3 PMC Virtualization Enable, with 63:4 RESERVED, SBZ. Their feature semantics are owned by `03-intercepts.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The VMCB Clean Bits field is at offset 0C0h in bits 31:0, with bits 63:32 RESERVED, SBZ.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `nRIP` is a full qword at 0C8h, and the decode-assist buffer at 0D0h is 16 bytes: bits 7:0 are the number of bytes fetched and bits 127:8 are the guest instruction bytes, so the field runs 0D0h–0DFh. Decode-assist semantics are owned by `05-exit-decoding.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The three AVIC pointers differ in width: the `APIC_BACKING_PAGE` pointer at 0E0h occupies bits **51:0**, while the AVIC `LOGICAL_TABLE` pointer at 0F0h and the AVIC `PHYSICAL_TABLE` pointer at 0F8h occupy bits **51:12** — and 0F8h reuses bits 11:0 for `AVIC_PHYSICAL_MAX_INDEX` rather than reserving them. 0E8h–0EFh is RESERVED, SBZ. All AVIC semantics are owned by `07-virtual-interrupts-avic.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The SEV-ES block is 100h–11Fh: 100h–107h RESERVED, SBZ; the VMSA Pointer at 108h in bits 51:12 with 11:0 and 63:52 reserved; `VMGEXIT_RAX` at 110h; `VMGEXIT_CPL` at 118h in bits 7:0. These fields are consumed by `13-sev-es-ghcb.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The Bus Lock Threshold Counter is at 120h in bits 15:0, followed by RESERVED, SBZ at 128h–133h and `UPDATE_IRR` at bit 0 of 134h; bus-lock semantics are owned by `03-intercepts.md` and `UPDATE_IRR` by `07-virtual-interrupts-avic.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Offset 138h packs `ALLOWED_SEV_FEATURES_EN` at **bit 63** and `ALLOWED_SEV_FEATURES_MASK` in bits 61:0 with bit 62 RESERVED, SBZ; 140h holds `GUEST_SEV_FEATURES` in bits 61:0; 148h is RESERVED, SBZ. These are owned by `12-sev.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `REQUESTED_IRR` at 150h is 256 bits wide, so it occupies 150h–16Fh and the next field, `EXITINTDATA`, starts at 170h with `EVENTINJDATA` at 178h. `EXITINTDATA` and `EVENTINJDATA` are decoded in `05-exit-decoding.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

### 2.2.5 Page modification logging and the host reserve, 180h–3FFh

| Offset | Bits | Field |
|---|---|---|
| 180h–1C7h | — | RESERVED, SBZ |
| 1C8h | 63:0 | `PML_BASE` |
| 1D0h | 15:0 | `PML_INDEX` |
| 1D4h–3DFh | — | RESERVED, SBZ |
| 3E0h–3FFh | — | Reserved for Host usage |

- **Claim.** The tail of the control area is 180h–1C7h RESERVED, SBZ; `PML_BASE` at 1C8h (63:0); `PML_INDEX` at 1D0h (15:0); 1D4h–3DFh RESERVED, SBZ; 3E0h–3FFh Reserved for Host usage. Page modification logging itself is owned by `06-nested-paging.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The layout table leaves small byte ranges unlisted where a field is narrower than the gap to the next printed offset — 119h–11Fh after `VMGEXIT_CPL`, 122h–127h after the Bus Lock Threshold Counter, and 1D2h–1D3h after `PML_INDEX`. The appendix's opening rule covers them: all unused bytes must be zero because they are reserved for future expansion.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

## 2.3 State save area: offsets and the segment descriptors

All offsets in this section are **relative to the state save area**; add 400h for the VMCB offset.

### 2.3.1 The ten segment registers, 000h–09Fh

Each of the ten segment registers gets four entries: selector (word), attrib (word), limit (dword),
base (qword). The differences between them are in the Notes column and matter in practice.

| Offset | Size | Register | Field | Note |
|---|---|---|---|---|
| 000h / 002h / 004h / 008h | word / word / dword / qword | ES | selector / attrib / limit / base | base: only lower 32 bits implemented |
| 010h / 012h / 014h / 018h | word / word / dword / qword | CS | selector / attrib / limit / base | base: only lower 32 bits implemented |
| 020h / 022h / 024h / 028h | word / word / dword / qword | SS | selector / attrib / limit / base | base: only lower 32 bits implemented |
| 030h / 032h / 034h / 038h | word / word / dword / qword | DS | selector / attrib / limit / base | base: only lower 32 bits implemented |
| 040h / 042h / 044h / 048h | word / word / dword / qword | FS | selector / attrib / limit / base | base: **full 64 bits** |
| 050h / 052h / 054h / 058h | word / word / dword / qword | GS | selector / attrib / limit / base | base: **full 64 bits** |
| 060h / 062h / 064h / 068h | word / word / dword / qword | GDTR | selector / attrib / limit / base | selector and attrib RESERVED; limit: only lower 16 bits |
| 070h / 072h / 074h / 078h | word / word / dword / qword | LDTR | selector / attrib / limit / base | — |
| 080h / 082h / 084h / 088h | word / word / dword / qword | IDTR | selector / attrib / limit / base | selector and attrib RESERVED; limit: only lower 16 bits |
| 090h / 092h / 094h / 098h | word / word / dword / qword | TR | selector / attrib / limit / base | — |

- **Claim.** The ten segment registers occupy save-area offsets 000h–09Fh in the order ES, CS, SS, DS, FS, GS, GDTR, LDTR, IDTR, TR, each as a 16-byte group of selector (000h+0), attrib (+2), limit (+4) and base (+8) — so guest FS base is at save-area offset **048h**, i.e. VMCB offset 448h, and guest TR base is at save-area offset **098h**.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** For ES, CS, SS and DS the base field is annotated "Only lower 32 bits are implemented"; **FS and GS carry no such annotation** and hold a full 64-bit base, which is why 64-bit thread-local storage survives a world switch through those two registers alone.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** For GDTR and IDTR the selector and attrib entries are marked RESERVED and the limit is annotated "Only lower 16 bits are implemented"; LDTR and TR carry neither annotation, so their selector, attrib and full 32-bit limit are all live.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`

### 2.3.2 CPL, EFER and the performance block, 0A0h–13Fh

| Offset | Size | Field | Note |
|---|---|---|---|
| 0A0h–0CAh | — | RESERVED | |
| 0CBh | byte | CPL | real mode forces 0; virtual mode forces 3 |
| 0CCh | dword | RESERVED | |
| 0D0h | qword | `EFER` | |
| 0D8h–0DFh | — | RESERVED | |
| 0E0h / 0E8h | qword | `PERF_CTL0` / `PERF_CTR0` | |
| 0F0h / 0F8h | qword | `PERF_CTL1` / `PERF_CTR1` | |
| 100h / 108h | qword | `PERF_CTL2` / `PERF_CTR2` | |
| 110h / 118h | qword | `PERF_CTL3` / `PERF_CTR3` | |
| 120h / 128h | qword | `PERF_CTL4` / `PERF_CTR4` | |
| 130h / 138h | qword | `PERF_CTL5` / `PERF_CTR5` | |

- **Claim.** `CPL` is a **single byte at save-area offset 0CBh**, immediately after a RESERVED range of 0A0h–0CAh, followed by a reserved dword at 0CCh and `EFER` at 0D0h; the note on the CPL row reads "If the guest is real-mode then the CPL is forced to 0; if the guest is virtual-mode then the CPL is forced to 3".  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** Save-area offset **0CAh is inside the RESERVED range 0A0h–0CAh in Table B-2**. The byte-wide VMPL field at 0CAh exists only in Table B-4, the VMSA layout used when SEV-ES is enabled; it is owned by `14-sev-snp.md` and must not be written into a non-SEV-ES VMCB save area.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** Six performance control/counter pairs occupy 0E0h–13Fh, alternating `PERF_CTLn` then `PERF_CTRn` every 8 bytes from n = 0 to n = 5; performance-counter virtualization is owned by `03-intercepts.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`

### 2.3.3 Control registers, shadow stacks and the SYSCALL block, 140h–247h

| Offset | Size | Field |
|---|---|---|
| 140h | — | **not listed in Table B-2** |
| 148h | qword | `CR4` |
| 150h | qword | `CR3` |
| 158h | qword | `CR0` |
| 160h | qword | `DR7` |
| 168h | qword | `DR6` |
| 170h | qword | `RFLAGS` |
| 178h | qword | `RIP` |
| 180h–1BFh | — | RESERVED |
| 1C0h | qword | `INSTR_RETIRED_CTR` |
| 1C8h | qword | `PERF_CTR_GLOBAL_STS` |
| 1D0h | qword | `PERF_CTR_GLOBAL_CTL` |
| 1D8h | qword | `RSP` |
| 1E0h | qword | `S_CET` |
| 1E8h | qword | `SSP` |
| 1F0h | qword | `ISST_ADDR` |
| 1F8h | qword | `RAX` |
| 200h | qword | `STAR` |
| 208h | qword | `LSTAR` |
| 210h | qword | `CSTAR` |
| 218h | qword | `SFMASK` |
| 220h | qword | `KernelGsBase` |
| 228h | qword | `SYSENTER_CS` |
| 230h | qword | `SYSENTER_ESP` |
| 238h | qword | `SYSENTER_EIP` |
| 240h | qword | `CR2` |
| 248h–267h | 32 bytes | RESERVED |

- **Claim.** The control-register group in the save area is ordered `CR4` 148h, `CR3` 150h, `CR0` 158h, `DR7` 160h, `DR6` 168h, `RFLAGS` 170h, `RIP` 178h — note that CR4 precedes CR3 and CR0, and that DR7 precedes DR6, neither of which is numeric order.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** Save-area offset **140h has no row in Table B-2** — the table jumps from `PERF_CTR5` at 138h to `CR4` at 148h. In Table B-4 the same offset holds `XSS`, so 140h is used by the VMSA but unlisted in the VMCB save area.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** The three CET save-area fields are separate qwords: `S_CET` at 1E0h, `SSP` at 1E8h and `ISST_ADDR` at 1F0h. Two of them have MSR counterparts in AMD's shadow-stack MSR table — `S_CET` is MSR `06A2h` and `ISST_ADDR` is MSR `06A8h` — while `SSP` is the current shadow stack pointer and has no MSR address of its own.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** `RSP` is at 1D8h and `RAX` at 1F8h, with the three CET fields between them; `CR2` sits at 240h **after** the SYSCALL/SYSENTER block, not with the other control registers.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`

### 2.3.4 PAT, LBR, speculation and IBS, 268h–8FFh

| Offset | Size | Field | Condition |
|---|---|---|---|
| 268h | qword | `G_PAT` | only used if nested paging enabled |
| 270h | qword | `DBGCTL` | LBR virtualization supported and enabled |
| 278h | qword | `BR_FROM` | LBR virtualization supported and enabled |
| 280h | qword | `BR_TO` | LBR virtualization supported and enabled |
| 288h | qword | `LASTEXCPFROM` | LBR virtualization supported and enabled |
| 290h | qword | `LASTEXCPTO` | LBR virtualization supported and enabled |
| 298h | qword | `DBGEXTNCTL` | LBR **Stack** virtualization supported and enabled |
| 2A0h–2DFh | "72 bytes" | RESERVED | see §2.7 |
| 2E0h | qword | `SPEC_CTRL` | |
| 2E8h–66Fh | 904 bytes | RESERVED | |
| 670h–76Fh | 256 bytes | `LBR_STACK_FROM` / `LBR_STACK_TO` | LBR Stack virtualization |
| 770h | qword | `LBR_SELECT` | LBR Stack virtualization |
| 778h–7E7h | — | IBS virtualization state (see below) | |
| 7E8h–8BFh | 216 bytes | RESERVED | |
| 8C0h–8FFh | 8 qwords | FRED state (see below) | |
| 900h–BFFh | — | RESERVED | |

- **Claim.** `G_PAT` is at save-area offset 268h and is "only used if nested paging enabled"; it is owned by `06-nested-paging.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** The LBR block is `DBGCTL` 270h, `BR_FROM` 278h, `BR_TO` 280h, `LASTEXCPFROM` 288h and **`LASTEXCPTO` 290h** — AMD spells the last one without an underscore before `TO` — each used only when hardware acceleration of LBR virtualization is supported and enabled through bit 0 of VMCB control offset 0B8h.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** `DBGEXTNCTL` at 298h, `LBR_STACK_FROM`/`LBR_STACK_TO` at 670h–76Fh (256 bytes, holding the from/to MSRs in MSR address order) and `LBR_SELECT` at 770h are gated on **LBR Stack** virtualization, a distinct condition from plain LBR virtualization, though both are enabled by the same 0B8h bit.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** `SPEC_CTRL` is its own qword at save-area offset 2E0h, between a reserved range ending at 2DFh and a 904-byte reserved range 2E8h–66Fh; `SPEC_CTRL` virtualization is enumerated by `Fn8000_000A_EDX[20]` and owned by `17-security.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** The IBS virtualization block runs 778h–7E7h: `IBS_FETCH_CTL` 778h, `IBS_FETCH_LINADDR` 780h, `IBS_OP_CTL` 788h, `IBS_OP_RIP` 790h, `IBS_OP_DATA` 798h, `IBS_OP_DATA2` 7A0h, `IBS_OP_DATA3` 7A8h, `IBS_DC_LINADDR` 7B0h, `IBS_BRTGT_RIP` 7B8h, `IBS_FETCH_EXTD_CTL` 7C0h, `IBS_FETCH_CTL2` 7C8h, `IBS_OP_CTL2` 7D0h, `IBS_BUFFER_BASE` 7D8h, and two dwords `IBS_BUFFER_SIZE` 7E0h and `IBS_BUFFER_TAIL` 7E4h. IBS virtualization is owned by `03-intercepts.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** Eight FRED qwords close the defined part of the save area: `FRED_RSP1` 8C0h, `FRED_RSP2` 8C8h, `FRED_RSP3` 8D0h, `FRED_STKLVLS` 8D8h, `FRED_SSP1` 8E0h, `FRED_SSP2` 8E8h, `FRED_SSP3` 8F0h and `FRED_CONFIG` 8F8h, after a 216-byte reserved range at 7E8h–8BFh.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`

### 2.3.5 What is *not* in the save area

The save area is deliberately incomplete. VMRUN and `#VMEXIT` move a minimal subset; the rest has
to be moved by VMLOAD and VMSAVE, which read and write the same VMCB page.

- **Claim.** VMSAVE and VMLOAD transfer FS, GS, TR and LDTR including all hidden state, `KernelGsBase`, `STAR`, `LSTAR`, `CSTAR`, `SFMASK`, and `SYSENTER_CS`/`ESP`/`EIP` — the stack segment is **not among them**. The instruction semantics are owned by `04-world-switch.md`.  `[APM2 §15.5.2]` `[1]` `C:high` `V:durable`
- **Claim.** General-purpose registers other than RAX and RSP have no home in the VMCB save area at all; only `RAX` (1F8h), `RSP` (1D8h), `RFLAGS` (170h) and `RIP` (178h) are architecturally present, so a hypervisor must save and restore the remaining GPRs itself around every VMRUN.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** In the SEV-ES VMSA layout (Table B-4) the same registers **are** present — RCX at 308h, RDX at 310h, RBX at 318h, RBP at 328h, RSI at 330h, RDI at 338h and R8–R12 at 340h–360h — which is the structural reason an SEV-ES guest's registers are hidden from the hypervisor; that table is owned by `13-sev-es-ghcb.md`.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** Appendix B.1 "Guest MSR Intercepts" describes `INTERCEPT_MSR_VEC0`–`3` at VMSA offsets 920h–93Fh, not fields of the ordinary VMCB; those tables belong to SEV-SNP guest intercept control and are owned by `14-sev-snp.md`. The ordinary MSR permission map is `MSRPM_BASE_PA`, owned by `03-intercepts.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

## 2.4 Segment attributes and where CPL comes from

Offsets alone are not enough to build a VMCB: the `attrib` word is a **packed** form of the
in-memory descriptor, not a copy of it.

- **Claim.** Segment registers are stored in the VMCB in a format similar to that used for SMM: base and limit are fully expanded, and **segment attributes are stored as 12-bit values formed by the concatenation of bits 55:52 and 47:40 of the original 64-bit in-memory segment descriptor**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

Concretely, with `d` the 64-bit descriptor, `attrib = ((d >> 52) & 0xF00) | ((d >> 40) & 0xFF)`:
bits 3:0 of `attrib` are the descriptor Type field, bit 4 is S, bits 6:5 are DPL, bit 7 is P, bit 8
is AVL, bit 9 is L, bit 10 is D/B and bit 11 is G. Going the other way, a hypervisor rebuilding a
descriptor shifts bits 11:8 back to 55:52 and bits 7:0 back to 47:40.

- **Claim.** The descriptor **P bit is used to signal NULL segments (P = 0)** where permissible and relevant, and the rule for software is: for NULL segments set all attribute bits to zero, otherwise write the concatenation described above.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** When examining segment attributes after a `#VMEXIT`, test the P bit to decide whether a segment is NULL — but **CS and TR never contain NULL segments, so their P bit is ignored**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

Loading attributes from the VMCB may produce bit combinations that a real descriptor load would
reject, because software can write anything into the word. AMD therefore states exactly which
attribute bits hardware actually observes, per register:

| Register | Attribute bits hardware observes |
|---|---|
| CS | D, L, P, R |
| SS | B, P, E, W, and Code/Data |
| DS, ES, FS, GS | D, P, DPL, E, W, and Code/Data |
| LDTR | P, S, and Type (LDT) |
| TR | P, S, and Type (32- or 16-bit TSS) |

- **Claim.** Only some attribute bits are observed by hardware, and which ones depends on the register: CS observes D, L, P and R; SS observes B, P, E, W and Code/Data; DS, ES, FS and GS observe D, P, DPL, E, W and Code/Data; LDTR observes P, S and Type (LDT); TR observes P, S and Type (32- or 16-bit TSS).  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** For the stack segment attributes, P is observed in legacy and compatibility mode but **ignored in 64-bit mode, because all stack segments are treated as present there**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

### Where CPL comes from

This is the field most often reconstructed incorrectly, because on real hardware CPL tracks
`CS.DPL` (or `SS.DPL` in some textbook accounts). In the VMCB it is an independent byte.

- **Claim.** The processor reads the current privilege level from the **CPL field in the VMCB** (save-area offset 0CBh), and `CS.DPL` will match the CPL field; after a `#VMEXIT`, software must retrieve the CPL from that field and **not from any segment DPL**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** In virtual-x86 mode and real mode the processor **ignores the VMCB CPL field** and forces the values 3 and 0 respectively; VMRUN applies the same forcing when it loads guest state.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

### Canonicalization

- **Claim.** VMRUN and `#VMEXIT` canonicalize — that is, sign-extend to bit 63 — **all base addresses in the segment registers that have been loaded**, plus `SSP`, `ISST_ADDR` and `PL0_SSP` through `PL3_SSP`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** A non-canonical or out-of-limit guest `rIP` loaded by VMRUN is **not** illegal guest state: it delivers a `#GP` inside the guest rather than causing a `VMEXIT_INVALID`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** An ASID of zero **is** illegal guest state and causes `#VMEXIT` with `VMEXIT_INVALID`; ASID 0 is the host ASID. The full consistency-check list is owned by `04-world-switch.md`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

## 2.5 Clean bits and VMCB state caching

VMCB state caching lets the processor keep guest register values in hardware between a `#VMEXIT`
and the next VMRUN, and reload them from that cache instead of from memory. The VMCB Clean field at
control offset 0C0h is how the hypervisor tells the processor which parts of the VMCB it has not
touched.

- **Claim.** Support for VMCB state caching is indicated by `CPUID Fn8000_000A_EDX[VmcbClean] = 1`; enumeration is owned by `01-svm-intro.md`.  `[APM2 §15.15]` `[1]` `C:high` `V:durable`
- **Claim.** Each **set** bit in the VMCB Clean field allows the processor to load one register or group of registers from the hardware cache; each **clear** bit requires it to load from the VMCB. Set bits are a hint — any implementation may ignore a set bit and load from memory anyway — but **clean bits that are set to zero are always honored**.  `[APM2 §15.15.1]` `[1]` `C:high` `V:durable`
- **Claim.** SVM uses the **physical address of the VMCB** as the unique identifier of a guest virtual CPU for caching purposes; **the ASID is explicitly not a unique identifier** for that purpose.  `[APM2 §15.15]` `[1]` `C:high` `V:durable`
- **Claim.** The CPU automatically treats the VMCB Clean field as zero when the hypervisor runs a guest that is not currently cached: it compares the VMCB physical address against all cached VMCB physical addresses and, if none matches, ignores the field.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`

### The clean-bit map

| Bit | Mnemonic | Covers |
|---|---|---|
| 31:13 | — | Reserved |
| 12 | `CET` | `S_CET`, `SSP`, `ISST_ADDR` |
| 11 | `AVIC` | AVIC `APIC_BAR`; AVIC `APIC_BACKING_PAGE`, `PHYSICAL_TABLE` and `LOGICAL_TABLE` pointers |
| 10 | `LBR` | `DebugCtl` MSR, `br_from`/`br_to`, `lastint_from`/`lastint_to` |
| 9 | `CR2` | `CR2` |
| 8 | `SEG` | CS/DS/SS/ES selector, base, limit and attributes, and CPL |
| 7 | `DT` | GDT and IDT limit and base |
| 6 | `DRx` | `DR6`, `DR7` |
| 5 | `CRx` | `CR0`, `CR3`, `CR4`, `EFER` |
| 4 | `NP` | Nested paging: `NCR3`, `G_PAT` |
| 3 | `TPR` | `V_TPR`, `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR`, `V_INTR_MASKING`, `V_INTR_VECTOR` (offset 60h–67h) |
| 2 | `ASID` | ASID |
| 1 | `IOPM` | `IOMSRPM`: `IOPM_BASE`, `MSRPM_BASE` |
| 0 | `I` | Intercepts: all the intercept vectors, TSC offset, Pause Filter Count |

- **Claim.** The VMCB Clean field assigns bit 0 `I` (all intercept vectors, TSC offset, Pause Filter Count), 1 `IOPM` (`IOPM_BASE`, `MSRPM_BASE`), 2 `ASID`, 3 `TPR` (the `INT_CTL` group at offsets 60h–67h), 4 `NP` (`NCR3`, `G_PAT`), 5 `CRx` (`CR0`, `CR3`, `CR4`, `EFER`), 6 `DRx` (`DR6`, `DR7`), 7 `DT` (GDT/IDT limit and base), 8 `SEG` (CS/DS/SS/ES selector, base, limit and attributes plus CPL), 9 `CR2`, 10 `LBR`, 11 `AVIC`, 12 `CET` (`S_CET`, `SSP`, `ISST_ADDR`), with 31:13 reserved. Field semantics stay with `07-virtual-interrupts-avic.md` and `06-nested-paging.md`.  `[APM2 Figure 15-4]` `[1]` `C:high` `V:durable`

Three asymmetries in that map deserve attention when writing a hypervisor:

- The `SEG` bit covers **CS, DS, SS and ES only**. FS, GS, LDTR and TR are not in any clean group, because they are moved by VMLOAD/VMSAVE rather than by VMRUN.
- The `DT` bit covers GDT and IDT **limit and base** — not the LDTR or TR descriptors.
- `CR2` gets a bit to itself, separate from the `CRx` group, and `EFER` rides in `CRx` rather than with the MSRs.

### When software must clear bits

- **Claim.** The hypervisor must clear the specific bit every time it explicitly modifies the associated guest state in the VMCB; changes caused by **guest execution** are the processor's problem, and the hypervisor is not responsible for tracking them.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** The hypervisor must clear the **entire** VMCB Clean field to zero in exactly three circumstances: the first time a particular guest is run; when it executes the guest on a **different CPU core** than the one used last time; and when it has **moved the guest's VMCB to a different physical page** since the last run. Failure to do so may result in undefined behaviour.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** For forward compatibility a hypervisor that has not modified the VMCB may write `FFFF_FFFFh` to the clean field; it should write `0h` when the VMCB is new or potentially inconsistent with the CPU's cached copy — for instance when it has allocated a new location for an existing VMCB from a free list without tracking whether that page was recently a VMCB for another guest.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** If any VMCB field other than the explicitly uncached ones has been modified, **all clean bits that are undefined within the scope of the hypervisor must be cleared to zero** — writing `FFFF_FFFFh` on a modified VMCB is not a legal shortcut.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** **Bit 31 is a special bit reserved for the host that the CPU will never use for a clean bit**, so a hypervisor may use it for its own tracking; that is compatible with the `FFFF_FFFFh` guidance above.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`

### Fields with no clean bit at all

- **Claim.** The following are explicitly **not** cached and not represented by clean bits: `TLB_Control`; the interrupt shadow; the VMCB status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, Decode Assist and so on); event injection; and `RFLAGS`, `RIP`, `RSP`, `RAX`. Their decoding is owned by `05-exit-decoding.md`.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** Because the status and injection fields are uncached, a hypervisor may rewrite `EVENTINJ`, read `EXITCODE` and re-enter the guest without touching the clean field at all — the common fast path after an intercept needs no clean-bit maintenance.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** On processor models that support clean fields, the **final merged hardware state** is used for VMRUN's consistency checks, which may include state from fields marked clean if the processor chose to ignore the indication — so a stale clean bit can surface as a `VMEXIT_INVALID` rather than as wrong guest behaviour.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

## 2.6 Clean bits versus nested paging and ASID

This is the section that exists because "the hardware used stale state" bugs almost always land
here. Three independent mechanisms look similar and are not interchangeable.

- **Claim.** Clean bit 4 (`NP`) covers exactly two VMCB **fields**, `NCR3` and `G_PAT` — it says nothing about the contents of the nested page tables those fields point at.  `[APM2 Figure 15-4]` `[1]` `C:high` `V:durable`
- **Claim.** `TLB_Control` is in the explicitly-uncached list, so there is no clean bit that could ever describe it; the flush request in the VMCB is re-read on every VMRUN. Flush commands are owned by `06-nested-paging.md`.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** Modifying a nested page table by decreasing permission levels, clearing present bits, or changing address translations, while intending to return to the same ASID, requires a TLB command of 011b or 001b — a clean-bit change cannot express it. The commands and their encodings are owned by `06-nested-paging.md`.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN and `#VMEXIT` write CR0, CR3, CR4 and EFER but **these writes do not flush the TLB**; the VMM is responsible for explicitly invalidating any guest translations its actions may have affected. The two mechanisms available for that are owned by `06-nested-paging.md`.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`

Put the three together and the rule for a hypervisor is:

| What changed | Correct response |
|---|---|
| The value of `NCR3` or `G_PAT` in the VMCB | Clear clean bit 4 |
| The **contents** of a nested page table | Issue a TLB flush command; clean bits are irrelevant |
| The ASID field in the VMCB | Clear clean bit 2 |
| The guest moved to another core | Clear the **whole** clean field, per §15.15.2 |
| The VMCB moved to another physical page | Clear the **whole** clean field, per §15.15.2 |

- **Claim.** The clean-field state is bound to a CPU core: AMD's rule is stated as "the hypervisor executes the guest on a different CPU core than one used the last time that guest was executed", so a scheduler that migrates a vCPU must zero the clean field on the destination core.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`
- **Claim.** Whether a migrated guest also needs a new ASID is a **separate** question governed by TLB rules, not by the clean field: §15.16.1 offers allocating a new ASID and not reusing the old one as a way to flush a guest's entries on implementations without selective per-ASID flush. ASID allocation and recycling are owned by `06-nested-paging.md`.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** Global page table entries are global only **within** an ASID, not across ASIDs, when running with SVM enabled — which is why reusing an ASID across two different address spaces is unsafe even with a correct clean field.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`

## 2.7 Open items

- **The state-save area's reserved range 2A0h–2DFh is labelled "72 bytes" and is 64.** `0x2E0 − 0x2A0 = 0x40 = 64`. The same row carries the same label in Table B-2 and in Table B-4, so it is a consistent typo rather than a transcription error. Every other byte-count label in both tables checks out: 32 bytes for 248h–267h, 904 for 2E8h–66Fh, 256 for 670h–76Fh, 216 for 7E8h–8BFh. Trust the offset range, not the byte count.
- **Save-area offset 140h has no row.** Table B-2 goes from `PERF_CTR5` at 138h to `CR4` at 148h with nothing in between — not even a RESERVED row, which the table uses everywhere else. Table B-4 puts `XSS` there. Whether 140h is reserved in the non-SEV-ES save area or simply omitted from the table is not stated.
- **Control offset 060h bit 10 has no row.** Same shape of gap, inside a bit field rather than between offsets. It sits between `VGIF` (9) and `V_NMI` (11).
- **Three byte ranges in the control area are implied rather than printed**: 119h–11Fh, 122h–127h and 1D2h–1D3h. The appendix's blanket zero-fill rule covers them, but a strict reader building a field-offset table from Table B-1 alone will find holes.
- **AMD prints no table number in the `Maps to:` line's "B.1 Guest MSR Intercepts" for the ordinary MSRPM.** B.1's tables B-5 through B-8 describe `INTERCEPT_MSR_VEC0`–`3`, which are VMSA fields for SEV-SNP guest intercept control. Anyone reading "Appendix B covers guest MSR intercepts" as "Appendix B documents the MSRPM bitmap layout" will look in the wrong place; the MSRPM is described in §15.11.
- **There is no layout table for the host state save area.** Appendix B says only that its format is identical to the guest save area shifted by 400h, while §15.5.1 says implementations may put host state in hidden on-chip storage instead. The two statements are consistent only if the layout statement is read as "where an implementation does use memory". This chapter reports both and does not reconcile them.
- **The `LBR` clean bit's coverage list uses MSR names, not VMCB field names.** Figure 15-4 lists "DebugCtl MSR, br_from/to, lastint_from/to" while Table B-2 names the same fields `DBGCTL`, `BR_FROM`, `BR_TO`, `LASTEXCPFROM`, `LASTEXCPTO`. The mapping is unambiguous but is nowhere stated; `DBGEXTNCTL`, `LBR_STACK_*` and `LBR_SELECT` appear in neither list, so whether clean bit 10 covers the LBR **stack** fields is unresolved from the manual alone.
- **Linux and KVM name control offset 0B8h `VIRT_EXT` and offset 068h `INT_STATE`.** Neither name appears in the APM, which names the individual bits rather than the containing word; this chapter uses AMD's spelling throughout, and the Linux names are recorded here only so that a reader coming from kernel source can find the field.
