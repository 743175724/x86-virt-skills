# intel-vt eval — `lookup` subset (24 questions)

Method: `SKILL.md` read once at the start; chapter chosen from the routing table
and recorded before any chapter file was opened; `errata.md` read once and checked
against every answer. Questions were extracted with a regex that emits only `id`
and `question`, so no expected-answer field was read.

---

### vmcs-encoding-derive
**Routed to:** `02-vmcs.md` §2.5 (routing row "VMCS layout, **field encodings**…")
**Actually answered from:** `references/02-vmcs.md` §2.5.1 "The encoding format"
**Answer:**
0x201A is the **EPT pointer (EPTP)** — a 64-bit VM-execution control field.

Decode it by the four bit fields of a VMCS field encoding:

- **bit 0** — access type: 0 = full access, 1 = high access. A high access is defined only for 64-bit fields, where it addresses bits 63:32.
- **bits 9:1** — field index: distinguishes fields of the same type and width.
- **bits 11:10** — field type: 0 = control, 1 = VM-exit information, 2 = guest state, 3 = host state.
- **bits 14:13** — field width: 0 = 16-bit, 1 = 64-bit, 2 = 32-bit, 3 = natural-width.
- **bit 12 and bits 31:15** are reserved and must be 0, which is why every documented encoding fits in 15 bits.

0x201A = 0010 0000 0001 1010b, so access = 0 (full), index = 13, type = 0 (control), width = 1 (64-bit): the fourteenth 64-bit control field, which is the EPT pointer.

To go the other way and derive an arbitrary encoding without a table:

```
encoding = (width << 13) | (type << 10) | (index << 1) | access

  width : 0 = 16-bit   1 = 64-bit   2 = 32-bit   3 = natural-width
  type  : 0 = control  1 = VM-exit information   2 = guest   3 = host
  index : position within that (width, type) group, counting from 0
  access: 0 = full     1 = high (64-bit fields only)
```

The group base encodings that fall out of this are `0x0000` / `0x0800` / `0x0C00` (16-bit control, guest, host); `0x2000` / `0x2400` / `0x2800` / `0x2C00` (64-bit control, read-only, guest, host); `0x4000` / `0x4400` / `0x4800` / `0x4C00` (32-bit); and `0x6000` / `0x6400` / `0x6800` / `0x6C00` (natural-width).

Two consequences worth keeping in your head while reading a trace:

- Because the index sits at bits 9:1 and the access type at bit 0, **consecutive fields of the same type and width are 2 apart**, so a related group (for example the four EOI-exit bitmap entries at 0x201C–0x2022) is a contiguous run of even encodings.
- Guest and host fields of the same kind share an index, so they differ only in the type digit — guest CR0 is `0x6800` and host CR0 is `0x6C00`.

Two more worked checks: `0x6400` decodes to width 3 (natural-width), type 1 (VM-exit information), index 0 — the exit qualification; `0x2800` decodes to width 1 (64-bit), type 2 (guest state), index 0 — the VMCS-link pointer.

One caveat on widths: a natural-width field is 64 bits on processors supporting Intel 64 and 32 bits otherwise, and outside IA-32e mode VMREAD/VMWRITE reach a full 64-bit field only through the full-plus-high encoding pair.
**Citation given:** Intel SDM Vol.3D Appendix B, "Field Encoding in VMCS" (rev 092); the reserved-bit claim additionally from SDM Vol.3C §27.11.2 and Vol.3D §A.9.
**Disagreement:** none.

---

### tertiary-controls-encoding-and-msr
**Routed to:** `02-vmcs.md` §2.5 (field encodings / execution controls)
**Actually answered from:** `references/02-vmcs.md` §2.8 (control-group table) and §2.8.4 "Tertiary controls, and the default-1 / reserved-bit rule done properly"
**Answer:**
- **Where they live:** the tertiary processor-based VM-execution controls are a **64-bit field at VMCS encoding `0x2034`**.
- **What turns them on:** they take effect only when **bit 17 of the primary processor-based VM-execution controls** ("activate tertiary controls") is 1. That is the tertiary analogue of primary bit 31, which gates the secondary controls.
- **Which MSR:** **IA32_VMX_PROCBASED_CTLS3, MSR address 492H.** Unlike the four original control MSRs it is *not* split into allowed-0/allowed-1 halves — it is a single 64-bit **allowed-1 mask**: a bit may be set only if the MSR reports it, and every unreported bit must be 0. There is no "true" variant and no default-1 class, because none of these bits is default-1. Every control group Intel has added since the original four works this way.

For completeness, the defined tertiary bits in Table 27-8 are: 0 LOADIWKEY exiting, 1 enable HLAT, 2 EPT paging-write control, 3 guest-paging verification, 4 IPI virtualization, 5 SEAM guest-physical address width, 6 enable MSR-list instructions, 7 virtualize IA32_SPEC_CTRL, 8 APIC-timer virtualization, 9 enable PBNDKB, 12 PEBS uses guest-physical addresses. Bits 10, 11 and 63:13 are reserved to 0.

Do not confuse this with the **secondary VM-exit controls**, which are also a 64-bit field with the same allowed-1 shape: those are at encoding `0x2044`, gated by bit 31 of the primary VM-exit controls, and reported by IA32_VMX_EXIT_CTLS2 at **493H**.
**Citation given:** Intel SDM Vol.3C §27.6.2 (the field and its gating bit) and Vol.3D Appendix A, §A.3.4 (IA32_VMX_PROCBASED_CTLS3 at 492H); SDM Vol.3D §A.4.2 for IA32_VMX_EXIT_CTLS2 at 493H.
**Disagreement:** none.

---

### hlat-pointer-encoding
**Routed to:** `02-vmcs.md` §2.5 (routing row for field encodings; HLAT *semantics* would be `06-address-translation.md`, but the question asks for encodings, which §2.5 owns)
**Actually answered from:** `references/02-vmcs.md` §2.5.2 (16-bit control fields), §2.5.3 (64-bit control fields, part five) and §2.5.6; cross-checked against `references/06-address-translation.md` §6.10
**Answer:**
- **HLAT pointer (HLATP):** 64-bit VM-execution control field at encoding **`0x2040`**.
- **HLAT prefix size:** 16-bit VM-execution control field at encoding **`0x0006`**.

HLATP holds a guest-physical address and roots the hypervisor-owned paging hierarchy; the prefix-size field selects which linear addresses are translated through HLATP instead of through CR3. Both are enabled by the "enable HLAT" tertiary VM-execution control (tertiary bit 1, field `0x2034`).

Two things to be careful about when citing this:

1. `02-vmcs.md` tags this group of newer 64-bit control encodings `C:medium`, so verify against Vol.3D Appendix B or your kernel header before hard-coding it.
2. There is **no standalone "Intel VT-rp specification"** to cite for HLAT — the normative content is in the SDM only (Vol.3A §5.5.1/§5.5.3/§5.5.5, Vol.3C §27.6.22, Vol.3C §31.2). `errata.md` E22 records this; a citation to a "VT-rp spec" is a fabricated source.

**Internal inconsistency worth flagging in the skill itself:** `06-address-translation.md` §6.13 still lists "the VMCS encodings of the HLAT pointer and HLAT prefix size fields" among facts it deliberately does not state because they could not be anchored, while `02-vmcs.md` §2.5.6 explicitly says those fields "are now stated in §2.5.2–§2.5.5". The encoding-owning chapter (`02`) wins under the skill's own rule, but chapter 06's open-items list is stale.
**Citation given:** Intel SDM Vol.3D Appendix B (field encodings); SDM Vol.3C §27.6.22 and §31.2 for the fields' meaning.
**Disagreement:** none.

---

### exit-reasons-ept-family
**Routed to:** `05-vm-exit.md` §5.3 (routing row "Decoding a VM exit: exit reasons (§5.3)")
**Actually answered from:** `references/05-vm-exit.md` §5.3; `references/06-address-translation.md` §6.12 (chapter artifact index) — this is the one question of the set that genuinely spans two chapters, as SKILL.md step 4 anticipates
**Answer:**
The skill states a direct answer: **the four EPT-related basic exit reasons a VMM must be prepared to handle are 48, 49, 62 and 66.**

| Reason | Name | Why an EPT-using VMM sees it |
|---|---|---|
| **48** | EPT violation | entries are well formed but deny the access, or an entry is not present — demand paging, MMIO emulation, introspection hooks, write tracking |
| **49** | EPT misconfiguration | an entry contains an unsupported value; typically a hypervisor bug or a torn update of a live entry |
| **62** | Page-modification log full | only if you enable PML |
| **66** | SPP-related event | only if you enable sub-page write permissions; reports an SPP miss or SPP misconfiguration |

48 and 49 are not optional: **EPT violations and EPT misconfigurations are unconditional** — they have no enabling control beyond "enable EPT" itself and cannot be masked, which is why every EPT-using VMM must implement both handlers.

Adjacent reasons the same VMM will also hit, though they are instruction exits rather than translation faults:

- **50 — INVEPT** and **53 — INVVPID**: both instructions cause VM exits unconditionally in VMX non-root operation, so a nesting VMM must emulate them.
- **59 — VMFUNC**: taken when a VMFUNC invocation cannot complete, which includes a *disabled* VM function and an out-of-range or invalid EPTP-list selection under EPTP switching.

Handling notes that matter as much as the numbers:

- For 48 and 49 the saved guest RIP points at the faulting instruction and the instruction must be **re-executed, not skipped** — do not advance RIP.
- Reason 48 gives you an exit qualification plus the guest-physical address, plus the guest-linear address when qualification bit 7 is set. Reason **49 gives you the guest-physical address only** — no exit qualification is saved for it, so the field is *cleared*, not merely format-less.
- Reason 48 is convertible to a #VE; reason 49 is not.
**Citation given:** Intel SDM Vol.3D Appendix C, "VMX Basic Exit Reasons" (rev 092) for the numbers; SDM Vol.3C §30.2.1 for the information fields and §30.3 for the RIP rule; SDM Vol.3C Ch.31 for the unconditional-exit property.
**Disagreement:** none.

---

### exit-reason-entry-failure-values
**Routed to:** `05-vm-exit.md` §5.2/§5.3 (routing row "Decoding a VM exit")
**Actually answered from:** `references/05-vm-exit.md` §5.2 and §5.3; `references/04-vm-entry.md` §4.9, which `05` explicitly forwards to for this case
**Answer:**
**8000_0021H is not a guest exit at all — it is a failed VM entry.**

Bit for bit:

- **Bit 31 = 1** is the **VM-entry-failure indicator**: 0 means a VM exit from a running guest, 1 means a VM entry that failed *after* loading guest state.
- **Bits 15:0 = 0021H = 33 decimal** is the basic exit reason: **VM-entry failure due to invalid guest state**.
- **Bits 30:16 are cleared** on such a failure.

So the processor detected a guest-state check failure, loaded host state exactly as it would on a VM exit, and resumed you at the host RIP.

Its siblings — the complete set of VM-entry failures reported through the exit-reason field, all with bit 31 set:

| Value | Basic reason | Meaning |
|---|---|---|
| **8000_0021H** | 33 | VM-entry failure due to invalid guest state |
| **8000_0022H** | 34 | VM-entry failure due to MSR loading |
| **8000_0029H** | 41 | VM-entry failure due to machine-check event |

What to read next in each case:

- **Reason 33:** the exit qualification narrows it. It is **0 in most cases**; the only non-zero values are **2** (PDPTE loading), **3** (NMI injection blocked by STI) and **4** (invalid VMCS-link pointer). **1 is not used.** Guest-state checks may run in any order, so one reported cause does not rule out others, and two processors may report different qualifications for the same VMCS.
- **Reason 34:** the exit qualification holds the **1-based index** of the failing entry in the VM-entry MSR-load area.

Two traps:

1. **On a VM-entry failure the processor updates only the exit-reason and exit-qualification fields.** Every other VM-exit information field is *left unmodified* — not undefined — so it still holds whatever the previous VM exit or you put there. The guest-state area is not modified, nothing is saved to the VM-exit MSR-store area, and the valid bit in the injected-event identification field is **not** cleared. Reading a stale interruption-information field here is a classic misdiagnosis.
2. In your dispatch loop, **test bit 31 before anything else**, and mask with 0xFFFF before indexing a table. Note also that bits 25 and 26 of the exit-reason field are *not* reserved — 25 is prematurely-busy shadow stack and 26 is bus lock — so a handler must mask them off too.

A fourth failure shape exists but does *not* appear in the exit-reason field: **VMfail**, where the failure is caught in the basic checks, the VMX controls or the host-state area. Control returns to the instruction after VMLAUNCH/VMRESUME with RFLAGS.CF or ZF set and an error number in the VM-instruction error field — not to the host RIP.
**Citation given:** Intel SDM Vol.3C §27.9.1 (exit-reason field layout), Vol.3D Appendix C (basic exit reasons 33, 34, 41), Vol.3C §29.8 (what a VM-entry failure does and does not write, and the qualification values).
**Disagreement:** none.

---

### exit-qual-io-instruction
**Routed to:** `05-vm-exit.md` §5.4 (routing row "exit qualification layouts (§5.4)")
**Actually answered from:** `references/05-vm-exit.md` §5.4.3 "I/O instruction (reason 30)"
**Answer:**
Both come out of the exit qualification:

- **Port number: bits 31:16.**
- **Access size: bits 2:0** — 0 = 1 byte, 1 = 2 bytes, **3 = 4 bytes**. Values 2, 4, 5, 6 and 7 are not used. (Note the encoding is *size minus one*, so there is no value 2.)

The rest of the layout, which you will want in the same handler:

| Bits | Meaning |
|---|---|
| 2:0 | size of access (0 = 1 byte, 1 = 2 bytes, 3 = 4 bytes) |
| 3 | direction: 0 = OUT, 1 = IN |
| 4 | string instruction (INS or OUTS) |
| 5 | REP prefix present |
| 6 | operand encoding: 0 = port came from DX, 1 = port was an immediate |
| 15:7 | not currently defined |
| 31:16 | port number |
| 63:32 | not currently defined |

Because bits 15:7 and 63:32 are "not currently defined" in Table 30-5 rather than guaranteed zero, mask them.

For INS and OUTS specifically: the **guest-linear address** field holds the base of the relevant segment plus (E)DI for INS or (E)SI for OUTS — ES is always the relevant segment for INS, DS for OUTS unless a prefix overrides — and the value is undefined if that segment is unusable. The **VM-exit instruction-information** field identifies the segment and the address size, but whether the processor reports instruction information for INS/OUTS is itself a capability, reported by **bit 54 of IA32_VMX_BASIC** — check it before relying on that field.

One thing *not* to reach for: the I/O RCX / I/O RSI / I/O RDI / I/O RIP fields are **undefined for ordinary INS/OUTS exits**. They are filled in only for SMM VM exits due to SMIs arriving immediately after retirement of an I/O instruction.
**Citation given:** Intel SDM Vol.3C §30.2.1, Table 30-5 ("Exit Qualification for I/O Instructions"); SDM Vol.3D Appendix A for the IA32_VMX_BASIC bit 54 capability.
**Disagreement:** none.

---

### eptp-low-bits
**Routed to:** `06-address-translation.md` (routing row "EPT structures…")
**Actually answered from:** `references/06-address-translation.md` §6.2 "The extended-page-table pointer (EPTP)"
**Answer:**

| Bits | Field |
|---|---|
| 2:0 | EPT paging-structure memory type |
| 5:3 | EPT page-walk length **minus 1** |
| 6 | Enable accessed and dirty flags for EPT |
| 7 | Enable enforcement of access rights for supervisor shadow-stack pages |
| 11:8 | Reserved (must be 0) |
| 51:12 | Physical address of the 4-KByte-aligned root EPT paging structure (PML4 table, or PML5 table with 5-level EPT) |

**A 4-level EPT hierarchy is selected by writing 3 into bits 5:3** — the field is walk-length minus one. A 5-level hierarchy rooted at an EPT PML5 table takes the value 4.

The rest of the low bits:

- **Bits 2:0** give the memory type used for the processor's accesses to the **EPT paging structures themselves**, not for guest data accesses (those take their type from bits 5:3 of the EPT leaf entry). The only values a processor may support are **0 (uncacheable)** and **6 (write-back)**, and support is enumerated in IA32_VMX_EPT_VPID_CAP. This field is consulted only when CR0.CD = 0; if CR0.CD = 1 every EPT paging-structure access is uncacheable regardless, and the MTRRs have no effect either way.
- **Bit 6** enables A/D flags for EPT. With it 0 the processor never sets bit 8 or bit 9 of an EPT paging-structure entry — which also means **PML cannot work without it**.
- **Bit 7** enables enforcement of access rights for supervisor shadow-stack pages; it is what gives bit 60 of an EPT leaf entry its meaning.
- **Bits 11:8** are reserved and must be 0, and any address bit above the processor's physical-address width must also be 0.

Two framing points: the EPTP holds a **host physical address**, not a guest-physical one — you write it before VM entry and the processor never translates it. And bits 51:12 are the **EPTRTA** (EPT root-table address, the rev-092 name; the older "EP4TA" does not appear in rev 092), which is the tag used for guest-physical and combined mappings and the value INVEPT type 1 matches on.
**Citation given:** Intel SDM Vol.3C §27.6.11 (EPTP field layout), with §31.3.7.1 and Vol.3D Appendix A for the memory-type and capability rules; §31.4.2 for the EPTRTA name.
**Disagreement:** none.

---

### ept-misconfiguration-conditions
**Routed to:** `06-address-translation.md` (routing row "EPT violation vs misconfiguration")
**Actually answered from:** `references/06-address-translation.md` §6.4.1 "Conditions that cause an EPT misconfiguration"
**Answer:**
An EPT misconfiguration (basic exit reason 49) means an entry *used in the translation* contains a value the architecture does not permit — as opposed to a violation, where the entries are well formed but deny the access. The complete enumeration is:

**Three conditions under "bit 0 (read access) is clear":**

1. **Bits 2:0 are 010b (write, no read) or 110b (write and execute, no read).** The architecture never permits write access without read access.
2. **Bit 0 clear, the processor does not support execute-only EPT translations** (as reported by IA32_VMX_EPT_VPID_CAP), **and** either bit 2 is set (the 100b execute-only case) or "mode-based execute control for EPT" is 1 and bit 10 (user-mode execute) is set. The user-mode-execute bit is subject to the same read-access requirement as bit 2.
3. **Bit 0 clear while "EPT paging-write control" is 1, the entry maps a page, and bit 58 (paging-write access) is set.** Paging writes may not be permitted to a page the guest may not even read.

**Two conditions under "the entry is present":**

4. **Any reserved bit is set** — bits 7:3 in an entry that references another EPT paging structure (bits 6:3 plus a bit 7 that must be 0 in an EPT PDE referencing a page table); the page-frame alignment bits (29:12 for a 1-GByte page, 20:12 for a 2-MByte page); any address bit in 51:12 at or above the processor's physical-address width; or bit 7 at a level where the corresponding page size is unsupported.
5. **A present leaf entry specifies EPT memory type 2, 3 or 7 in bits 5:3.** The defined values are 0 (UC), 1 (WC), 4 (WT), 5 (WP) and 6 (WB).

**Scope rules that save you work:** the reserved-bit and memory-type checks apply **only to entries actually used in a translation and only to *present* entries**. So a hypervisor may leave arbitrary values in bits 62:3 of a zeroed (not-present) entry — but *not* in bit 63, which still selects #VE convertibility, and not in bits 2:0, whose write-without-read and execute-only checks are what make the entry present in the first place.

Intel warns that values reserved today may be defined later, so an entry that misconfigures on one processor may not on the next.

Practical note: a misconfiguration gives you **no exit qualification** — it is not among the causes for which one is saved, so the field is *cleared*. You get the guest-physical address and nothing else. In practice reason 49 means a hypervisor bug or a torn update of a live EPT entry, not a guest action.
**Citation given:** Intel SDM Vol.3C §31.3.3.1 ("EPT Misconfigurations"), with §31.3.7.2 for the memory-type values, §31.3.2 for the present/not-present rule, Vol.3D Appendix A for the execute-only capability, and §30.2.1 for the absent exit qualification.
**Disagreement:** none.

---

### pml-log-and-index
**Routed to:** `06-address-translation.md` (routing row "…PML…")
**Actually answered from:** `references/06-address-translation.md` §6.8 "Page-modification logging (PML)"
**Answer:**
- **Size:** the page-modification log is a **4-KByte page holding 512 entries of 64 bits each** — exactly filling the page. Its physical address is a 64-bit VM-execution control field at VMCS encoding **`0x200E`**.
- **Where the index lives:** the **PML index is a 16-bit guest-state field at VMCS encoding `0x0812`** — a VMCS field, not a location in the buffer.
- **Which way it fills: downwards.** Software normally initialises the index to **511**; the processor writes the entry at the position given by the index and then **decrements** it. So the buffer fills from index 511 toward 0, and the most recently logged entry sits at the *lowest* written index. A consumer that walks the buffer forwards reads entries in reverse chronological order.

The logging rule:

```
on setting bit 9 (dirty) of an EPT leaf entry from 0 to 1:
    if PML index is not in 0..511:
        page-modification log-full VM exit (basic exit reason 62)
    PML_buffer[PML index] <- GPA of the access, bits 11:0 cleared
    PML index <- PML index - 1
```

The processor logs when it sets the dirty flag of an EPT leaf entry, writing the guest-physical address of the access with **bits 11:0 cleared**. When the index goes out of the range 0–511 you take a **page-modification log-full VM exit, basic exit reason 62**; the VMM drains the buffer and resets the index.

Three things that bite people:

1. **PML requires EPT A/D flags** (EPTP bit 6) to be enabled — no dirty-flag updates, no log entries.
2. An entry is logged only on the **0→1 transition** of the dirty flag. A page whose dirty flag is already 1 is silently invisible to the log, so software that wants a page tracked must clear the flag first — and software that wants a page *not* tracked can pre-set it.
3. PML is **per-VMCS and therefore per-vCPU**: each vCPU needs its own log page.

PML *replaces* rather than supplements write-protection-based dirty tracking: you no longer clear EPT write permission on every tracked page, which removes one EPT violation per page per tracking round. It logs only write accesses, so it cannot by itself estimate a working-set size.

Generation, since it is commonly misreported: PML's first silicon was **Broadwell Xeon (2015)**, not Skylake — `errata.md` E02 carries that correction.
**Citation given:** Intel SDM Vol.3C §27.6.18 (the PML address field, log size and logging rule), §27.4.2 (PML index as guest-state field), §31.3.6 (the 0→1 transition rule), Vol.3D Appendix C (exit reason 62).
**Disagreement:** none.

---

### virtual-apic-page-offsets
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page…")
**Actually answered from:** `references/07-apic-virtualization.md` §7.3.1 "The virtual-APIC page"
**Answer:**

| Offset | Register |
|---|---|
| **080H** | **VTPR** — virtual task-priority register |
| **0A0H** | **VPPR** — virtual processor-priority register |
| **0B0H** | **VEOI** — virtual end-of-interrupt register |
| **100H–170H** | **VISR** — virtual in-service register, 256 bits |
| **200H–270H** | **VIRR** — virtual interrupt-request register, 256 bits |

VISR and VIRR each hold 256 bits as **eight 32-bit values placed 16 bytes apart**, matching the xAPIC register layout — so the in-service dwords are at 100H, 110H, 120H, 130H, 140H, 150H, 160H, 170H and the interrupt-request dwords at 200H, 210H, … 270H. The offsets are the same as the corresponding xAPIC MMIO offsets, which is the point.

**A rule you must not break:** software may modify the virtual-APIC page of a logical processor that is in VMX non-root operation **only outside the fields that correspond to virtualized APIC registers** — VTPR, VPPR, VEOI, VISR, VIRR, VICR_LO and VICR_HI. To touch any of those, the VMM must first ensure that no logical processor whose current VMCS references the page is in VMX non-root operation. This is the exception-to-the-exception of the general §27.11.4 rule, and it is the usual cause of lost or duplicated virtual interrupts.

Related but distinct: **RVI and SVI are not on this page.** They are the low and high bytes of the guest-interrupt-status **VMCS** field at encoding `0x0810`, written with VMWRITE — whereas VIRR is written with an ordinary store to the page. Injecting an interrupt under virtual-interrupt delivery means doing both: set the vector's bit in VIRR, and raise RVI to that vector if it is higher than the current RVI.
**Citation given:** Intel SDM Vol.3C Ch.32 ("APIC Virtualization and Virtual Interrupts"), with §32.1 for the software-modification rule and §27.4.2 for the guest-interrupt-status field.
**Disagreement:** none.

---

### posted-interrupt-descriptor-layout
**Routed to:** `07-apic-virtualization.md` (routing row "…posted interrupts…")
**Actually answered from:** `references/07-apic-virtualization.md` §7.8.1 "The posted-interrupt descriptor"
**Answer:**
The posted-interrupt descriptor is a **64-byte structure aligned on a 64-byte boundary**, referenced by the posted-interrupt descriptor address field of the VMCS (encoding `0x2016`).

| Bits | Field |
|---|---|
| **255:0** | **PIR** — posted-interrupt requests, one bit per vector (256-bit bitmap) |
| **256** | **ON** — outstanding notification |
| **257** | **SN** — suppress notification |
| 271:258 | reserved |
| **279:272** | **NV** — notification vector |
| 287:280 | reserved |
| **319:288** | **NDST** — notification destination |
| 511:320 | reserved |

Field semantics:

- **PIR** holds the interrupts that have been posted but not yet merged into the target's VIRR.
- **ON** records that a notification has already been sent for interrupts sitting in PIR but not yet processed — it is what stops a poster from sending a redundant notification IPI.
- **SN**, when 1, tells a poster to record the interrupt in PIR but send **no** notification event.
- **NV** is the physical interrupt vector used to poke the target logical processor.
- **NDST** identifies that processor by its **physical APIC ID**.

The layout is mirrored field for field by Linux's `struct pi_desc`, which declares `pir[8]` followed by a 16-bit notifications word carrying ON and SN, an 8-bit `nv` and a 32-bit `ndst`, with 64-byte alignment — useful as a cross-check when you are reading a kernel dump.

The companion VMCS field is the **posted-interrupt notification vector**, a 16-bit VM-execution control field at encoding `0x0002`, and processing of posted interrupts is enabled by **pin-based control bit 7**.
**Citation given:** Intel SDM Vol.3C Ch.32 and §27.6.8 (the descriptor and the VMCS field that points at it).
**Disagreement:** none.

---

### apicv-vmcs-encodings
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.4 "VMCS fields this chapter depends on" and §7.10; `references/02-vmcs.md` §2.5 and §2.8 own the full encoding and control tables
**Answer:**
The fields a full APICv stack needs:

| Field | Encoding | Width |
|---|---|---|
| Virtual-APIC address | **2012H** | 64-bit control |
| APIC-access address | **2014H** | 64-bit control |
| Posted-interrupt descriptor address | **2016H** | 64-bit control |
| EOI-exit bitmap 0 … 3 | **201CH, 201EH, 2020H, 2022H** | 64-bit control |
| TPR threshold | **401CH** | 32-bit control |
| Guest interrupt status (RVI/SVI) | **0810H** | 16-bit guest state |
| Posted-interrupt notification vector | **0002H** | 16-bit control |
| PID-pointer table address (IPIv) | **2042H** | 64-bit control |
| Last PID-pointer index (IPIv) | **0008H** | 16-bit control |

Notes on each group:

- The **four EOI-exit bitmap fields** together form a 256-bit map, one bit per vector: a set bit means EOI virtualization for that vector still takes a VM exit (basic exit reason 45).
- **Guest interrupt status** is split: bits 7:0 are **RVI** (requesting virtual interrupt), bits 15:8 are **SVI** (servicing virtual interrupt). It is guest non-register state, not an architectural register.
- **TPR threshold** is only meaningful with "use TPR shadow" set and "virtual-interrupt delivery" clear.
- The last two rows are needed only if you are enabling **IPI virtualization**.

The control bits that turn the pieces on (owned by `02-vmcs.md`): secondary processor-based bit 0 "virtualize APIC accesses", bit 4 "virtualize x2APIC mode", bit 8 "APIC-register virtualization", bit 9 "virtual-interrupt delivery"; primary bit 21 "use TPR shadow"; pin-based bit 7 "process posted interrupts"; and tertiary bit 4 "IPI virtualization" (which itself needs primary bit 17 to activate the tertiary controls).

Caveat the skill attaches to these: `02-vmcs.md` is authoritative for the encodings and `07` restates them only because its algorithms cannot be read without them; if the two ever disagree, `02` wins. Also, rev 092 adds APIC-timer virtualization controls (Vol.3C §27.6.27) that are outside this APICv stack.
**Citation given:** Intel SDM Vol.3C §27.6.8 (APIC-virtualization VMCS fields), §27.4.2 (guest interrupt status), Vol.3D Appendix B (encodings), Vol.3C §27.6.2 (the enabling control bits).
**Disagreement:** none.

---

### pid-pointer-table-encoding
**Routed to:** `07-apic-virtualization.md` (routing row "…IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.4 and §7.9 "IPI virtualization and the PID-pointer table"; encodings owned by `references/02-vmcs.md` §2.5.2–§2.5.3
**Answer:**
- **PID-pointer table address:** 64-bit VM-execution control field at encoding **`0x2042`**.
- **Last PID-pointer index:** 16-bit VM-execution control field at encoding **`0x0008`**.

How they are used: with IPI virtualization enabled (tertiary VM-execution control bit 4), the processor locates the target vCPU's posted-interrupt descriptor through a **PID-pointer table indexed by the target's virtual APIC ID**. The entry is read as 8 bytes at `PID-pointer table address + T × 8`, and the last PID-pointer index bounds the table's size — an index above it falls back to an APIC-write VM exit (reason 56).

VM-entry checks on these fields: **bits 2:0 of the table address must be 0**, and both the table address and the address of its last entry must satisfy the physical-address-width checks.

Entry format, since you will need it in the same breath: a PID-pointer table entry holds bits 63:6 of the descriptor's 64-bit physical address in **bits 63:6**, five **reserved bits that must be 0 in bits 5:1**, and a **valid bit in bit 0**. So every descriptor address is 64-byte aligned, and a VMM can mark entries for non-existent vCPUs invalid. The processor's actual test is `PID_ADDR[5:0] == 000001b` — valid set and all five reserved bits clear — and it clears bit 0 before dereferencing. Setting a reserved bit gets you the same APIC-write VM exit as leaving the entry invalid.
**Citation given:** Intel SDM Vol.3D Appendix B (encodings), Vol.3C §32.1.6.2 (PID-pointer table lookup and entry format), Vol.3C §29.2.1.1 (the VM-entry checks).
**Disagreement:** none.

---

### vminstr-error-vmptrld
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "what VM-instruction error N means")
**Actually answered from:** `references/08-vmx-instructions.md` §8.3.3 (VMPTRLD) and §8.4 (the VM-instruction error number table)
**Answer:**
ZF set means **VMfailValid**: there was a valid current VMCS, so the processor wrote an error number into the VM-instruction error field (VMCS encoding `0x4400`). VMREAD that field. VMPTRLD can produce exactly three error numbers:

| Error | Meaning | What to check |
|---|---|---|
| **9** | VMPTRLD with invalid physical address | The operand address is not 4-KByte aligned, or it sets bits beyond the processor's physical-address width |
| **10** | VMPTRLD with VMXON pointer | You passed the address of the VMXON region instead of a VMCS region |
| **11** | VMPTRLD with incorrect VMCS revision identifier | The 31-bit revision identifier in the region does not match the processor's (read it from IA32_VMX_BASIC), **or** bit 31 of that dword marks the region as a shadow VMCS on a processor that does not support VMCS shadowing |

Error 11 is by far the most common in new code: the first dword of a freshly allocated VMCS region must be initialised with the revision identifier from **IA32_VMX_BASIC (MSR 480H)** before VMPTRLD, and bit 31 of that dword is the shadow-VMCS flag, not part of the identifier.

If instead you see **CF set with ZF clear**, that is **VMfailInvalid** — there was no valid current VMCS in which to record a number, so there is no error code to read. Do not go looking for one.

One behavioural note while you are here: VMPTRLD makes the referenced VMCS both **active and current**, and only one VMCS can be current on a logical processor at a time. The previously current VMCS remains **active** until you execute VMCLEAR for it — "Any other VMCS that had been active remains so, but no other VMCS is current."

Finally: the VM-instruction error numbers are a **flat namespace entirely separate from the basic exit reason namespace**. Error 9 and exit reason 9 have nothing to do with each other.
**Citation given:** Intel SDM Vol.3C Ch.33 (VMPTRLD) and §33.4 (VM-instruction error numbers); §27.9.5 for the VM-instruction error field; §27.1 for the active/current rule.
**Disagreement:** none.

---

### vmx-capability-msr-addresses
**Routed to:** `08-vmx-instructions.md` §8.4/§8.6 (routing row "VMX instruction semantics, **capability MSRs**")
**Actually answered from:** `references/08-vmx-instructions.md` §8.6.1 "Addresses"
**Answer:**

| MSR | Address |
|---|---|
| IA32_VMX_BASIC | **480H** |
| IA32_VMX_PINBASED_CTLS | **481H** |
| IA32_VMX_PROCBASED_CTLS | **482H** |
| IA32_VMX_EXIT_CTLS | **483H** |
| IA32_VMX_ENTRY_CTLS | **484H** |
| IA32_VMX_MISC | **485H** |
| IA32_VMX_CR0_FIXED0 / CR0_FIXED1 | **486H / 487H** |
| IA32_VMX_CR4_FIXED0 / CR4_FIXED1 | **488H / 489H** |
| IA32_VMX_VMCS_ENUM | **48AH** |
| IA32_VMX_PROCBASED_CTLS2 | **48BH** |
| IA32_VMX_EPT_VPID_CAP | **48CH** |
| IA32_VMX_TRUE_PINBASED_CTLS | **48DH** |
| IA32_VMX_TRUE_PROCBASED_CTLS | **48EH** |
| IA32_VMX_TRUE_EXIT_CTLS | **48FH** |
| IA32_VMX_TRUE_ENTRY_CTLS | **490H** |
| IA32_VMX_VMFUNC | **491H** |
| IA32_VMX_PROCBASED_CTLS3 (tertiary controls) | **492H** |
| IA32_VMX_EXIT_CTLS2 (secondary VM-exit controls) | **493H** |

A contiguous block, **480H through 493H**. All of them are **read-only**; writing any one causes #GP(0).

Bring-up rules that go with the list:

- Read **IA32_VMX_BASIC bit 55** first. If it is 1, the **TRUE_\*** MSRs (48DH–490H) exist, and you should prefer them over 481H–484H — they may report allowed-0 settings of 0 for controls that are default-1 in the originals, which is how you turn *off* CR3-load exiting and CR3-store exiting when you are using EPT.
- Derive **every** control field from its capability MSR; a VMM that hard-codes control values fails VM entry with **error 7** on the next microarchitecture. The usual algorithm is OR in the allowed-0 half, AND with the allowed-1 half, and treat any surviving difference in a bit you care about as "feature unavailable" (KVM's `adjust_vmx_controls()`).
- **PROCBASED_CTLS2 (48BH), PROCBASED_CTLS3 (492H), VMFUNC (491H) and EXIT_CTLS2 (493H) have no "true" variant** — they are pure allowed-1 masks with no default-1 class.
- Separately from all of these, **IA32_FEATURE_CONTROL (MSR 3AH)** gates VMXON itself: bit 0 lock, bit 1 VMXON inside SMX, bit 2 VMXON outside SMX. It is not a capability MSR but you cannot get off the ground without it.
- IA32_VMX_EXIT_CTLS2 is additionally gated on `CPUID.01H:ECX[5] && IA32_VMX_EXIT_CTLS[63]`.
**Citation given:** Intel SDM Vol.3D Appendix A, §A.1–§A.11 (each MSR's address and semantics); SDM Vol.3C Ch.26 and Vol.4 Ch.2 for IA32_FEATURE_CONTROL at 3AH.
**Disagreement:** none.

---

### invvpid-types
**Routed to:** `08-vmx-instructions.md` (routing row "VMX instruction semantics… what VM-instruction error N means"); descriptor layouts also in `06-address-translation.md` §6.7
**Actually answered from:** `references/08-vmx-instructions.md` §8.3.12 and §8.5; cross-checked with `references/06-address-translation.md` §6.7
**Answer:**
**The four types:**

| Type | Name | What it invalidates |
|---|---|---|
| **0** | Individual-address | mappings for the linear address in the descriptor, tagged with the descriptor's VPID |
| **1** | Single-context | **all** linear and combined mappings tagged with the descriptor's VPID, for all PCIDs and (for combined mappings) all EPTRTAs. It does **not** spare global translations |
| **2** | All-contexts | all linear and combined mappings tagged with **any VPID except 0000H**, for all PCIDs |
| **3** | Single-context-retaining-globals | mappings tagged with the descriptor's VPID **except** global translations — the processor is not *required* to invalidate global-translation information, though it may |

The descriptor is 128 bits: **bits 15:0 VPID**, **bits 63:16 reserved and must be 0**, **bits 127:64 linear address** (used only by type 0).

**Why you keep getting error 28.** Error 28 is "invalid operand to INVEPT/INVVPID", reported as VMfail when the type value is unsupported or the descriptor is invalid for the requested type. In practice it is almost always one of these four:

1. **VPID = 0000H with type 0, 1 or 3.** Those three types require a non-zero VPID. This is the single most common cause. VPID 0000H is never valid for a guest — the SDM lists it only for outside VMX operation, VMX root operation, and non-root operation with "enable VPID" = 0, and VM entry ensures the VPID field is never 0000H. Corollary: **INVVPID type 2 cannot be used to flush VMX root operation's own translations**, because it skips 0000H.
2. **Non-zero bits anywhere in descriptor bits 63:16.** The check `IF INVVPID_DESC[63:16] != 0 THEN VMfail` runs **before** the type dispatch, so it applies to **type 2 as well** — even though type 2 ignores the VPID and linear-address fields, the descriptor is *not* ignored. Zero the whole 128 bytes before filling it in.
3. **The processor does not support the type you asked for.** Which INVEPT and INVVPID types exist is enumerated in **IA32_VMX_EPT_VPID_CAP (48CH)** — read it rather than assuming all four exist.
4. For type 0, a malformed linear address in bits 127:64.

Two related checks if you are seeing **#UD** rather than error 28: INVVPID faults with #UD if you are not in VMX operation, if the processor does not support VPIDs (IA32_VMX_PROCBASED_CTLS2[37] = 0), or if it supports VPIDs but not the INVVPID instruction (IA32_VMX_EPT_VPID_CAP[32] = 0). There is no register-operand #UD.

And a scope reminder: INVVPID invalidates **linear and combined** mappings; it never touches guest-physical mappings. Removing one of those needs INVEPT. Combined mappings are reachable by either instruction.
**Citation given:** Intel SDM Vol.3C Ch.33 (INVVPID) and §33.4 (error 28); §31.4 and §31.4.3.1 for the invalidation domains; §31.1 for the VPID 0000H rule; Vol.3D §A.10 for IA32_VMX_EPT_VPID_CAP.
**Disagreement:** none.

---

### dmar-register-offsets
**Routed to:** `10-vtd-dma-remapping.md` (routing row "VT-d DMA remapping, DMAR registers…")
**Actually answered from:** `references/10-vtd-dma-remapping.md` §10.5 "The DMAR register set (Ch.11)"; IRTA_REG cross-checked against `references/11-vtd-interrupt-remapping.md` §11.3.1
**Answer:**
Offsets are relative to the remapping hardware unit's register base address (which you get from the ACPI DMAR table's DRHD structure):

| Offset | Register |
|---|---|
| **008h** | Capability Register (**CAP_REG**) |
| **010h** | Extended Capability Register (**ECAP_REG**) — you will need this one too |
| **018h** | Global Command Register (**GCMD_REG**) |
| **01Ch** | Global Status Register (**GSTS_REG**) |
| **020h** | Root Table Address Register (**RTADDR_REG**) |
| **0B8h** | Interrupt Remapping Table Address Register (**IRTA_REG**) |

Neighbours worth having in the same map: VER_REG at 000h, CCMD_REG at 028h, FSTS_REG at 034h, the fault-event registers at 038h/03Ch/040h/044h, the invalidation queue at IQH 080h / IQT 088h / IQA 090h, and the page-request queue at 0C0h/0C8h/0D0h.

**Two register groups float and are not at fixed offsets:**

- the **IOTLB registers**, at `base + 16 × ECAP_REG.IRO`;
- the **Fault Recording Registers**, at `base + 16 × CAP_REG.FRO`, spaced 16 bytes apart, with `CAP_REG.NFR + 1` of them.

Hardware may place either group at any unused or reserved address in the 4 KB register space or in adjoined 4 KB regions, so you must read the capability registers to find them — there is no legal way to hard-code those two.

One protocol note: **GCMD_REG and GSTS_REG are a handshake pair.** You set a command bit in GCMD_REG and then poll the corresponding status bit in GSTS_REG; nothing you write to RTADDR_REG or IRTA_REG takes effect until the matching Set Root Table Pointer / Set Interrupt Remap Table Pointer command has been issued and observed.
**Citation given:** Intel VT-d Specification Rev 5.20 (April 2026, order number D51397-019) §11.4, with §11.4.2 and §11.4.3 for the FRO/IRO offset formulas and §11.4.10 for IRTA_REG.
**Disagreement:** none. (Note per `errata.md` E21: the intel.com VT-d landing page metadata is stale and still advertises Rev 4.1 — take the revision from the PDF cover page.)

---

### invalidation-descriptor-types
**Routed to:** `10-vtd-dma-remapping.md` (routing row "…translation structures, invalidation")
**Actually answered from:** `references/10-vtd-dma-remapping.md` §10.6.3 "Queued invalidation (§6.5.2)"
**Answer:**
**Where the type field is — and this is the part that catches people:** the Type field is a **7-bit field formed by concatenating bits 11:9 and bits 3:0** of the descriptor. It is *not* a contiguous 4-bit field at bits 3:0, even though every currently defined value fits in the low nibble.

| Type | Descriptor | Section |
|---|---|---|
| **1h** | Context-cache Invalidate (`cc_inv_dsc`) | §6.5.2.1 |
| **2h** | IOTLB Invalidate (`iotlb_inv_dsc`) | §6.5.2.3 |
| **3h** | Device-TLB Invalidate (`dev_tlb_inv_dsc`) | §6.5.2.5 |
| **4h** | Interrupt Entry Cache Invalidate (`iec_inv_dsc`) | §6.5.2.8 |
| **5h** | Invalidation Wait (`inv_wait_dsc`) | §6.5.2.9 |
| **6h** | PASID-based IOTLB Invalidate (`p_iotlb_inv_dsc`) | §6.5.2.4 |
| **7h** | PASID-cache Invalidate (`pc_inv_dsc`) | §6.5.2.2 |
| **8h** | PASID-based-Device-TLB Invalidate (`p_dev_tlb_inv_dsc`) | §6.5.2.6 |
| **9h** | Page Group Response (`page_grp_resp_dsc`) | §7.6.1 |
| **Ah** | HPT Cache Invalidate (`hpt_inv_desc`) | §6.5.2.7 |

Note that 9h, the Page Group Response Descriptor, is submitted through the same invalidation queue even though it is specified in the page-request chapter rather than the invalidation chapter.

Queued invalidation is available only where **ECAP_REG.QI** is set, is enabled through **GCMD_REG.QIE** and observed through **GSTS_REG.QIES**. The queue is located by IQA_REG (090h), with IQH_REG (080h) giving the offset hardware will read next and IQT_REG (088h) the offset software will write next.

The ordering rules you must respect when composing a batch:

- An **IOTLB** invalidation (`iotlb_inv_dsc`) or a **PASID-based IOTLB** invalidation (`p_iotlb_inv_dsc`) executes only after all **context-cache *and* PASID-cache** invalidations ahead of it in the queue have completed.
- A **PASID-cache** invalidation executes only after all **context-cache** invalidations ahead of it have completed.
- A **Device-TLB** invalidation executes only after all **IOTLB and Interrupt Entry Cache** invalidations ahead of it have completed.

So the natural batch order is context-cache → PASID-cache → IOTLB → Device-TLB, closed by an Invalidation Wait descriptor.
**Citation given:** Intel VT-d Specification Rev 5.20 §6.5.2 (descriptor types and the split Type field), §6.5.2.12 (ordering and completion), §7.6.1 (Page Group Response), §11.4.4.1 and §11.4 (QI enabling and queue registers).
**Disagreement:** none.

---

### irte-remapped-layout
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, **IRTE**…")
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.4 "IRTE for remapped interrupts (§9.9)" and §11.4.1
**Answer:**
An IRTE is **128 bits**. The remapped format (IM = 0):

| Bits | Field |
|---|---|
| 127:84 | Reserved |
| **83:82** | **SVT** — Source Validation Type |
| **81:80** | **SQ** — Source-id Qualifier |
| **79:64** | **SID** — Source Identifier |
| **63:32** | **DST** — Destination ID |
| 31:24 | Reserved |
| **23:16** | **V** — Vector |
| **15** | **IM** — IRTE Mode |
| 14:12 | Reserved |
| **11:8** | **AVAIL** — Available to software |
| **7:5** | **DLM** — Delivery Mode |
| **4** | **TM** — Trigger Mode |
| **3** | **RH** — Redirection Hint |
| **2** | **DM** — Destination Mode |
| **1** | **FPD** — Fault Processing Disable |
| **0** | **P** — Present |

Field semantics:

- **P (bit 0)** — Present. **FPD (bit 1)** is evaluated by hardware *irrespective* of P; every other field is evaluated only when P is set.
- **DM (bit 2)** — whether DST is a logical or a physical APIC ID.
- **RH (bit 3)** — whether the request may be directed to one among N processors specified in DST, under hardware control.
- **TM (bit 4)** — trigger mode. **NMI, INIT and ExtINT are edge triggered regardless of TM.**
- **DLM (bits 7:5)** — 3-bit delivery mode; operates only in conjunction with specific trigger modes, and software must guarantee the correct ones. For **SMI (DLM = 010b)** the vector field is ignored *but must be programmed to all zeros for future compatibility*; for **NMI (100b)** and **INIT (101b)** the vector is merely ignored with no zeroing requirement. Platforms supporting interrupt remapping are expected to generate SMI, NMI and INIT through a dedicated pin or platform-specific messages instead.
- **AVAIL (bits 11:8)** — free for software; hardware always ignores it.
- **IM (bit 15)** — 0 means remapped (this format); **1 means posted**, and the entry is reinterpreted in the §9.10 posted format.
- **V (bits 23:16)** — the 8-bit interrupt vector, evaluated only when P is set.
- **DST (bits 63:32)** — target processor(s). **Its width depends on IRTA_REG.EIME:** with EIME = 0 (xAPIC mode) hardware interprets **only bits 15:8** of this field, treating the high 16 and low 8 bits as reserved; with EIME = 1 (x2APIC mode) it interprets **all 32 bits**. Getting this wrong is the classic "interrupts go to CPU 0" bug.
- **SID / SQ / SVT (bits 79:84)** — source-id validation. SVT selects what check hardware performs on the interrupt's source-id; when **SVT = 01b**, SID is the requester-id allowed to originate requests through this IRTE and SQ selects which bits of SID are compared. Evaluated only when P is set.

One forwarding detail: when a remapped request is put on the system bus, the "Trigger Mode Level" field in that request is **always set to asserted (1b)**.
**Citation given:** Intel VT-d Specification Rev 5.20 §9.9 ("Interrupt Remapping Table Entry (IRTE) for Remapped Interrupts"), with §5.1.4 for bus forwarding and §11.4.10 for the EIME dependency.
**Disagreement:** none.

---

### irta-reg-size-field
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, IRTE…")
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.3.1 "IRTA_REG (§11.4.10)", §11.8 and §11.12
**Answer:**
**Program S = 7 (0111b).**

The number of entries is **2^(S+1)**, where S is IRTA_REG.S. For 256 entries you need 2^8, so S+1 = 8 and **S = 7**. It is a log2-*minus-one*: S = 0 means two entries, not one. This off-by-one is the most common IRTA_REG mistake.

IRTA_REG lives at register offset **0B8h** and is laid out as:

| Bits | Field |
|---|---|
| **63:12** | **IRTA** — interrupt remapping table address |
| **11** | **EIME** — Extended Interrupt Mode Enable |
| 10:4 | Reserved |
| **3:0** | **S** — Size |

So the full write for a 256-entry table is: the 4-KByte-aligned table base in bits 63:12, EIME in bit 11 as appropriate, zeros in 10:4, and 7 in bits 3:0.

Three things to get right alongside S:

1. **The table must be 4-KByte aligned**, and hardware may ignore bits 63:HAW of IRTA. At 16 bytes per IRTE, 256 entries is 4 KB exactly — one page.
2. **EIME (bit 11) must match your APIC mode.** With EIME = 0 hardware interprets only bits 15:8 of an IRTE's Destination-ID; with EIME = 1 it interprets all 32. If ECAP_REG reports **EIMER** set, leaving EIME at 0 is itself a fault (reason 2Ah).
3. **Nothing in IRTA_REG takes effect until you execute the Set Interrupt Remap Table Pointer (SIRTP) command** via GCMD_REG and observe it in GSTS_REG. Writing the register alone changes no behaviour. Only after SIRTP do you set the interrupt-remapping enable bit.

Also: the maximum table size is **64K IRTEs**, and if a computed `interrupt_index` is equal to or larger than the number of entries, hardware treats the request as an error. IRTA_REG reads as RsvdZ on implementations that do not report interrupt remapping in ECAP_REG.
**Citation given:** Intel VT-d Specification Rev 5.20 §11.4.10 (IRTA_REG), with §5.1.3 for the table-size and index-range rules and §5.1.4.1 for fault reason 2Ah.
**Disagreement:** none.

---

### vtd-fault-reason-codes
**Routed to:** `12-vtd-faults-bios-siov.md` (routing row "**VT-d faults and fault reason codes**…")
**Actually answered from:** `references/12-vtd-faults-bios-siov.md` §12.3.1 "Legacy-mode fault reasons"
**Answer:**
**Fault reason 2h (condition code LCT.2) is: the Present (P) field in the context-entry used to process the request is 0.** In other words, the device's source-id resolved to a context-entry that you never marked present — the device is issuing DMA before (or after) you set up its context-entry, or the root-entry is pointing at the wrong context table.

It is a **qualified** fault, which means the FPD (Fault Processing Disable) bit in the offending entry can suppress its reporting.

The neighbouring legacy-mode codes:

| Reason | Code | Qualified | Meaning |
|---|---|---|---|
| 1h | LRT.2 | No | Present field in the **root-entry** is 0 |
| **2h** | **LCT.2** | **Yes** | **Present field in the context-entry is 0** |
| 3h | LCT.4.x | Yes | Invalid programming of a context-entry: unsupported AW, unsupported TT, or error accessing the second-stage paging entry through SSPTPTR |
| 4h | LGN.1.x | Yes | Address overflow in second-stage translation (above MGAW/AW, or above HAW for translated and pass-through requests) |
| 5h | LGN.2 | Yes | Write or AtomicOp request encountered lack of write permission |
| 6h | LGN.3 | Yes | Read or AtomicOp request encountered lack of read permission |
| 7h | LSS.1 | Yes | Error accessing a second-stage paging entry referenced through a preceding one |
| 8h | LRT.1 | No | Error accessing a root-entry through the RTA field of RTADDR_REG |
| 9h | LCT.1 | No | Error accessing a context-entry through the CTP field of a root-entry |
| Ah | LRT.3 | No | Non-zero reserved field in a root-entry with P set |
| Bh | LCT.3 | Yes | Non-zero reserved field in a context-entry with P set |
| Ch | LSS.2 | Yes | Non-zero reserved field in a second-stage paging entry with at least one of R or W set |
| Dh | LCT.5 | Yes | Present context-entry whose TT field specifies blocking of translation requests (without PASID) and translated requests |
| Eh | LGN.4 | Yes | Output address after remapping falls in the interrupt address range FEEx_xxxxh |

Two adjacent ranges you may also hit: **30h–34h** are root-table-address programming faults (30h/RTA.1 is invalid RTADDR_REG programming — TTM = 11b where ADMS = 0, TTM = 10b, TTM = 01b where SMTS = 0, or SSIRWE set while TTM = 00b), and there is a separate scalable-mode reason table if RTADDR_REG.TTM = 01b. Make sure you are reading the right table for your translation mode.

One exception on 6h: for implementations reporting **ZLR = 1** in CAP_REG, reason 6h does not apply to zero-length read requests to write-only mapped pages in second-stage translation.

To find which device did it, read the **SID field (bits 79:64)** of the same Fault Recording Register.
**Citation given:** Intel VT-d Specification Rev 5.20 §7.1.3 ("Non-Recoverable Fault Reason Encodings"), legacy-mode table.
**Disagreement:** none.

---

### fault-recording-register-layout
**Routed to:** `12-vtd-faults-bios-siov.md` (routing row "VT-d faults and fault reason codes")
**Actually answered from:** `references/12-vtd-faults-bios-siov.md` §12.2.1 "Fault Recording Register [n] (§11.4.7.6)" and §12.2
**Answer:**
The three you asked for:

- **Fault reason (FR): bits 103:96**
- **Source-id (SID): bits 79:64**
- **Faulting address (FI, "Fault Info"): bits 63:12** — bits 11:0 are reserved, so the recorded address is page-granular.

The full 128-bit register:

| Bits | Field |
|---|---|
| **127** | **F** — Fault |
| 126 | T1 — Type bit 1 |
| 125:124 | AT — Address Type |
| 123:104 | PV — PASID Value |
| **103:96** | **FR — Fault Reason** |
| 95 | PP — PASID Present |
| 94 | EXE — Execute |
| 93 | PRIV — Privilege Mode |
| 92 | T2 — Type bit 2 |
| 91:80 | Reserved |
| **79:64** | **SID — Source Identifier** |
| **63:12** | **FI — Fault Info** |
| 11:0 | Reserved |

Reading notes:

- **F (bit 127) is RW1C and sticky** — you clear a recorded fault by writing 1 to it. Until you do, that register is occupied.
- **The request type is split across two non-adjacent bits, T1 at 126 and T2 at 92** — it is not one contiguous field. This trips up people writing a decoder from the field names alone.
- **PV (bits 123:104) is 20 bits and is meaningful only when PP (bit 95) is set.**

**Finding the register in the first place**, which you need before any of the above:

- Base: **`register base + 16 × CAP_REG.FRO`**, and the registers are **16 bytes apart**.
- Count: **`CAP_REG.NFR + 1`** — NFR reports N, not the count. A ring walk driven by NFR alone is short by one register. At least one per remapping unit; maximum 256.
- Start index: **FSTS_REG.FRI** gives the index of the first register to process. Process in circular FIFO fashion from there until you find one with F clear.
- If the register at hardware's internal index already has F set, hardware sets **PFO (Primary Fault Overflow)** in FSTS_REG and **the new fault is not recorded**. To recover, process every pending fault, clear each F, then clear PFO by writing 1 to it.
- The internal index resets to zero when both TES and IES are clear in GSTS_REG, increments per recorded fault, and wraps from N-1 to 0.

One caveat when you are counting faults: **fault compression is optional.** If hardware supports it, a fault whose source-id matches an already-pending register is silently not recorded — so a device producing a storm of identical faults will not fill the log, while a device varying its source-id still can. On an implementation without compression, identical repeated faults will log and overflow.
**Citation given:** Intel VT-d Specification Rev 5.20 §11.4.7.6 (Fault Recording Register layout), §11.4.2 (FRO and NFR formulas) and §7.2.1 (primary fault logging, FRI, PFO, compression).
**Disagreement:** none.

---

### tdx-leaf-numbers
**Routed to:** `13-tdx.md` §13.5/§13.6 (routing row "TDX: SEAMCALL/TDCALL leaves (§13.5, §13.6)")
**Actually answered from:** `references/13-tdx.md` §13.5 (host-side `TDH.*` leaves), §13.6 (guest-side `TDG.*` leaves), §13.8.3 (page acceptance)
**Answer:**

| Purpose | Interface | Leaf |
|---|---|---|
| **Entering a TD** | `TDH.VP.ENTER` (SEAMCALL) | **0** |
| **Host adding a private page dynamically** | `TDH.MEM.PAGE.AUG` (SEAMCALL) | **6** |
| **Guest accepting one** | `TDG.MEM.PAGE.ACCEPT` (TDCALL) | **6** |

The two 6's are not a mistake — `TDH.*` (host, SEAMCALL) and `TDG.*` (guest, TDCALL) are **separate leaf-number spaces**.

**A documentation defect you should know about:** `TDH.VP.ENTER` deliberately occupies leaf number **0** — both ABI Table 5.4 and Base Table 2.3 say so. Its *own* ABI section's RAX table misprints the leaf number as 10, which is `TDH.VP.CREATE`'s value. That is a defect in 348551-008US; **0 is correct.**

The dynamic page-addition flow those leaves belong to is three steps:

1. The VMM extends Secure EPT with **`TDH.MEM.SEPT.ADD` (leaf 3)** if a new Secure EPT page is needed.
2. The VMM adds and maps a 4KB or 2MB page with **`TDH.MEM.PAGE.AUG` (leaf 6)**, leaving the Secure EPT entry **PENDING**. The page is *not* measured — unlike `TDH.MEM.PAGE.ADD` (leaf 2), which is the build-time equivalent and does contribute to MRTD. AUG does not even need to access the destination page.
3. The guest TD accepts it with **`TDG.MEM.PAGE.ACCEPT` (leaf 6)**, which **zeroes the content** as part of the operation.

If `TDG.MEM.PAGE.ACCEPT`'s Secure EPT walk terminates on a free-equivalent entry (FREE, REMOVED or EXPORTED_REMOVED) at the requested level, the module performs a TD exit with an EPT violation carrying the error entry level and state plus the guest-requested accept level — which the host VMM may treat as the guest asking it to add the page.

Scope reminder from the skill: **TDX is server-only** — no client Windows PC has it.
**Citation given:** Intel TDX Module ABI Specification (348551-008US) §5.4.81 (`TDH.VP.ENTER`), §5.4.24 (`TDH.MEM.PAGE.AUG`), §5.5.3 (`TDG.MEM.PAGE.ACCEPT`), and Table 5.4; Intel TDX Module Base Architecture Specification §2.11, §9.10.
**Disagreement:** none — though note my prior recollection had no strong value for `TDH.VP.ENTER`'s leaf number, and the skill's explicit flagging of the ABI misprint (10 vs 0) is newer than anything I would have recalled.

---

### tdx-gpaw-shared-bit
**Routed to:** `13-tdx.md` §13.8 (routing row "…Secure EPT (§13.8)…")
**Actually answered from:** `references/13-tdx.md` §13.8.1 "The private/shared GPA split and where the SHARED bit sits"
**Answer:**
**The SHARED bit is at GPA bit GPAW-1**, where GPAW is the TD's configured effective guest-physical address width. **Only GPAW values of 48 and 52 are possible, so in practice the SHARED bit is either bit 47 or bit 51.** GPAW = 52 may be selected only with 5-level EPT.

What the bit does: TDX distinguishes **private** from **shared** GPAs by this bit, and in SEAM non-root mode the controlling VMCS carries **two EPT pointers**:

- the legacy **EPT pointer** translates GPAs with **SHARED == 0** via the **Secure EPT**;
- a separate **Shared EPT pointer** translates GPAs with **SHARED == 1**.

The position is set by a **GPAW VM-execution control**; a separate HKID execution control defines the HKID used for private accesses. A TD learns its own GPAW at bootstrap from **`TDG.VP.INFO` (TDCALL leaf 1)**, which returns GPAW along with ATTRIBUTES.

Two distinctions that matter:

- **GPAW is not MAXPA and not TDCS.VIRT_MAXPA.** VIRT_MAXPA must not exceed the TD's configured GPAW.
- On the IOMMU side: if a GPA presented to the IOMMU is private (SHARED bit 0), the IOMMU may abort and report a DMA-remapping failure even when the translated physical address carries a non-private HKID. That is a deliberate debug aid against a TD or VMM programming a bad GPA into a device.
**Citation given:** Intel TDX Module Base Architecture Specification §9.1 and §11.3.2, with §11.15.1 for the GPAW/VIRT_MAXPA relationship and §14.5 for the IOMMU behaviour; Intel TDX Module ABI Specification §3.4.3 and §5.5.21; Intel TDX ISA Specification §3.2.
**Disagreement:** none.

---

## Contamination disclosures

None. The extraction regex emitted only `id` and `question` for the 24 `lookup`
entries; `chapter`, `must_include`, `must_not_include`, `required_citation` and
`notes` were never printed to the terminal and never entered context. No later
command read `questions.yaml` again.

## Coverage

- Answered from the skill: **24 / 24**
- Marked "THE SKILL DOES NOT CONTAIN THIS": **0**
