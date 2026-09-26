# lookup answers

### vmcs-encoding-derive
**Routed to:** `02-vmcs.md` §2.5 (routing row "VMCS layout, **field encodings**, execution/exit/entry controls, shadow VMCS fields")
**Actually answered from:** `references/02-vmcs.md` §2.5.1 "The encoding format", §2.5.3 "B.2 — 64-bit fields"
**Answer:**
0x201A is the **EPT pointer (EPTP)** — a 64-bit VM-execution control field.

Here is how you get there without a table. Every VMCS field encoding is a 32-bit value whose bit fields say what kind of field it is:

- **bit 0 — access type:** 0 = full access, 1 = high access. A high access is defined only for 64-bit fields, where it addresses bits 63:32.
- **bits 9:1 — index:** distinguishes fields of the same type and width.
- **bits 11:10 — field type:** 0 = control, 1 = VM-exit information, 2 = guest state, 3 = host state.
- **bits 14:13 — width:** 0 = 16-bit, 1 = 64-bit, 2 = 32-bit, 3 = natural-width.
- **bit 12 and bits 31:15 are reserved and must be 0**, which is why every documented encoding fits in 15 bits.

Decoding 0x201A: access type 0 (full), index 13, type 0 (control), width 1 (64-bit) — that is, the fourteenth 64-bit control field, which is the EPT pointer.

Read in the other direction, the derivation rule is:

```
encoding = (width << 13) | (type << 10) | (index << 1) | access

  width : 0 = 16-bit   1 = 64-bit   2 = 32-bit   3 = natural-width
  type  : 0 = control  1 = VM-exit information   2 = guest   3 = host
  index : position within that (width, type) group, counting from 0
  access: 0 = full     1 = high (64-bit fields only)
```

The fifteen group base encodings follow directly: `0x0000` 16-bit control, `0x0800` 16-bit guest, `0x0C00` 16-bit host; `0x2000` 64-bit control, `0x2400` 64-bit read-only, `0x2800` 64-bit guest, `0x2C00` 64-bit host; `0x4000` 32-bit control, `0x4400` 32-bit read-only, `0x4800` 32-bit guest, `0x4C00` 32-bit host; `0x6000` natural-width control, `0x6400` natural-width read-only, `0x6800` natural-width guest, `0x6C00` natural-width host.

Two consequences worth keeping in your head:

- Because the index sits at bits 9:1 and the access type at bit 0, **consecutive fields of the same type and width are 2 apart**, so a related group such as the four EOI-exit bitmap entries occupies a contiguous run of even encodings.
- Guest-state and host-state fields of the same kind share an index within their group — which is why the guest and host natural-width CR0 fields are `0x6800` and `0x6C00`: same index 0, only the type digit differs.

Two more worked checks against the same rule: `0x6400` decodes to width 3 (natural-width), type 1 (VM-exit information), index 0 = the exit qualification; `0x2800` decodes to width 1 (64-bit), type 2 (guest state), index 0 = the VMCS-link pointer.

One caveat on widths: a natural-width field is 64 bits on processors supporting Intel 64 and 32 bits otherwise, and outside IA-32e mode VMREAD/VMWRITE reach a 64-bit field in full only through the pair of full and high encodings.
**Citation given:** Intel SDM Vol.3D Appendix B "Field Encoding in VMCS" — `[SDM 3D App.B]`
**Contamination note:** none

---

### tertiary-controls-encoding-and-msr
**Routed to:** `02-vmcs.md` §2.5 (routing row "VMCS layout, field encodings, **execution/exit/entry controls**")
**Actually answered from:** `references/02-vmcs.md` §2.5.3 (B.2 64-bit field encodings), §2.8 (control-group table), §2.8.4 "Tertiary controls, and the default-1 / reserved-bit rule done properly"
**Answer:**
Three separate answers, one per part of your question:

**Where they live.** The tertiary processor-based VM-execution controls are a **64-bit** VM-execution control field at VMCS field encoding **`0x2034`** (in the B.2 64-bit control group, alongside `0x2030` sub-page-permission table pointer and `0x2032` TSC multiplier).

**What turns them on.** The field takes effect only when **bit 17 of the primary processor-based VM-execution controls** ("activate tertiary controls") is 1. The primary controls are the 32-bit field at `0x4002`. Note this is a *different* gate from the secondary controls, which are gated by primary bit 31.

**Which MSR says which bits you may set.** **IA32_VMX_PROCBASED_CTLS3, MSR address 492H.** Unlike the four original control-capability MSRs, it is **a single 64-bit allowed-1 mask**: a bit may be set only if the MSR reports it, and all unreported bits must be 0. There is no allowed-0 half and therefore no default-1 class and no "true" variant — every control group Intel has added since the original four is a pure allowed-1 mask with no reserved-bit ceremony.

For context, the whole control surface in one table:

| Group | Width | Encoding | Gated by | Capability MSR | "True" variant |
|---|---|---|---|---|---|
| Pin-based | 32 | `0x4000` | — | IA32_VMX_PINBASED_CTLS 481H | IA32_VMX_TRUE_PINBASED_CTLS 48DH |
| Primary processor-based | 32 | `0x4002` | — | IA32_VMX_PROCBASED_CTLS 482H | IA32_VMX_TRUE_PROCBASED_CTLS 48EH |
| Secondary processor-based | 32 | `0x401E` | primary bit 31 | IA32_VMX_PROCBASED_CTLS2 48BH | none needed |
| Tertiary processor-based | 64 | `0x2034` | primary bit 17 | IA32_VMX_PROCBASED_CTLS3 492H | none needed |
| Primary VM-exit | 32 | `0x400C` | — | IA32_VMX_EXIT_CTLS 483H | IA32_VMX_TRUE_EXIT_CTLS 48FH |
| VM-entry | 32 | `0x4012` | — | IA32_VMX_ENTRY_CTLS 484H | IA32_VMX_TRUE_ENTRY_CTLS 490H |
| VM-function | 64 | `0x2018` | secondary bit 13 | IA32_VMX_VMFUNC 491H | none needed |

**Known tertiary control bits:** bit 0 LOADIWKEY exiting, bit 1 enable HLAT, bit 2 EPT paging-write control, bit 3 guest-paging verification, bit 4 IPI virtualization. Higher bits exist, but the knowledge base does not state their positions because they could not be confirmed — read them from the SDM rather than guessing.
**Citation given:** Intel SDM Vol.3C §27.6.2 (field and gating) — `[SDM 3C §27.6.2]`; Intel SDM Vol.3D Appendix A (capability MSR) — `[SDM 3D App.A]`; Intel SDM Vol.3D Appendix B (encoding) — `[SDM 3D App.B]`
**Contamination note:** none

---

### hlat-pointer-encoding
**Routed to:** `02-vmcs.md` §2.5 (routing row "VMCS layout, **field encodings**"); cross-checked `06-address-translation.md` (routing row "...SPP, **HLAT**, #VE")
**Actually answered from:** `references/02-vmcs.md` §2.5.6 "Encodings deliberately omitted"; `references/06-address-translation.md` §6.10 and §6.13 "Open items"; `references/07-apic-virtualization.md` (not relevant); `references/errata.md` E22
**Answer:**
**THE SKILL DOES NOT CONTAIN THIS.**

The knowledge base deliberately withholds these two encodings rather than state unverified values. Both owning chapters say so explicitly, and they point at each other:

- `02-vmcs.md` §2.5.6 lists "the HLAT pointer and HLAT prefix-size fields of §27.6.22" among the encodings that are **not** stated, "because they could not be confirmed against the field-encoding appendix in this pass."
- `06-address-translation.md` §6.10 describes HLATP and the HLAT prefix-size field functionally but defers the numbers with "(see `02-vmcs.md` for encodings)", and §6.13 repeats that "the VMCS encodings of the HLAT pointer and HLAT prefix size fields" are among the facts deliberately not stated.

What I *can* tell you:

- HLAT is enabled by an "enable HLAT" VM-execution control — **bit 1 of the tertiary processor-based VM-execution controls** (`0x2034`, gated by primary control bit 17).
- **HLATP** is a VM-execution control field holding a **guest-physical address** that roots the HLAT paging hierarchy; the **HLAT prefix size** field selects which linear addresses are translated through HLATP instead of through CR3.
- Both fields are defined in **SDM Vol.3C §27.6.22**, with the translation behaviour in **Vol.3A §5.5.1 / §5.5.3 / §5.5.5** and **Vol.3C §31.2**.

Read the actual encodings out of SDM Vol.3D Appendix B or a kernel header before using them. One warning while you are looking: there is **no standalone "Intel VT-rp specification"** — anything citing one is citing a document that does not exist. HLAT's normative content lives only inside the SDM.
**Citation given:** Intel SDM Vol.3C §27.6.22 (the fields exist and are defined there) — `[SDM 3C §27.6.22]`; Intel SDM Vol.3C §31.2 and Vol.3A §5.5.1 (HLAT behaviour) — `[SDM 3C §31.2]`, `[SDM 3A §5.5.1]`. No citation for the encodings themselves, because the knowledge base states none.
**Contamination note:** none

---

### exit-reasons-ept-family
**Routed to:** `05-vm-exit.md` §5.3 (routing row "**Decoding a VM exit**: exit reasons (§5.3)"); also `06-address-translation.md` per the SKILL.md note that EPT questions may span `06` and `05`
**Actually answered from:** `references/06-address-translation.md` §6.12 "Chapter artifact index"; `references/05-vm-exit.md` §5.3 (basic exit reason list), §5.3.1 (fault-like vs trap-like)
**Answer:**
**Four**, and an EPT-using VMM must implement handlers for all of them:

| Reason | Name | What it means |
|---|---|---|
| **48** | EPT violation | The EPT entries are well formed but deny the access, or an entry is not present |
| **49** | EPT misconfiguration | An EPT paging-structure entry contains an unsupported value — a hypervisor bug, not a policy decision |
| **62** | Page-modification log full | The PML index went out of the range 0–511; drain the buffer and reset the index |
| **66** | SPP-related event | Reported for sub-page write permissions for EPT |

Two properties make these non-optional. **EPT violations and EPT misconfigurations are unconditional**: unlike most VM exits they have no enabling control beyond "enable EPT" itself and cannot be masked. And 62 and 66 arrive as soon as you enable PML or SPP respectively.

Three handling rules that go with the list:

- **Never advance RIP on reason 48 or 49.** Both are fault-like: the saved guest RIP points at the faulting instruction and the instruction must be *re-executed* after you fix the mapping, not skipped. Advancing RIP silently corrupts the guest.
- **Reason 49 has no exit qualification.** An exit qualification is defined for EPT violations but not for misconfigurations, so a misconfiguration gives you no architectural hint beyond the guest-physical address field. There is no useful recovery path — dump the offending entry and treat it as your own bug.
- Both 48 and 49 record the offending address in the **guest-physical address** VM-exit information field (`0x2400`).

Separately, if you are counting exits your VMM will *see* rather than exits the EPT machinery raises, note that **50 (INVEPT)** and **53 (INVVPID)** are also in the list — those instructions always cause VM exits in VMX non-root operation — but they are guest instruction intercepts, not EPT-translation events.
**Citation given:** Intel SDM Vol.3D Appendix C (basic exit reasons) — `[SDM 3D App.C]`; Intel SDM Vol.3C §27.9.1 and Vol.3C Ch.31 (EPT-induced exits) — `[SDM 3C §27.9.1]`, `[SDM 3C Ch.31]`; Intel SDM Vol.3C §30.3 (fault-like vs trap-like) — `[SDM 3C §30.3]`
**Contamination note:** none

---

### exit-reason-entry-failure-values
**Routed to:** `05-vm-exit.md` §5.3 (routing row "**Decoding a VM exit**: exit reasons (§5.3)"); followed the chapter's own pointer to `04-vm-entry.md` §4.9
**Actually answered from:** `references/05-vm-exit.md` §5.2 "The exit-reason field", §5.3 (reasons 33/34/41); `references/04-vm-entry.md` §4.9 "The three failure modes", §4.10, §4.11
**Answer:**
**8000_0021H is not a guest exit at all — it is a failed VM entry.**

Bit for bit:

- **Bits 15:0 = 0021H = 33 decimal** — the basic exit reason. Reason 33 is *VM-entry failure due to invalid guest state*.
- **Bit 31 = 1** — the VM-entry-failure indicator. It is 1 for a VM entry that failed after loading guest state, and 0 for a VM exit from a running guest.
- Everything else is 0: bits 26:16 and bit 30 are reserved and cleared; bit 27 (enclave mode), bit 28 (pending MTF exit) and bit 29 (VM exit from VMX root operation, dual-monitor SMM only) are all clear here.

**Its siblings.** There are exactly three VM-entry-failure exit reasons, all with bit 31 set:

| Value | Reason | Cause | Exit qualification |
|---|---|---|---|
| **8000_0021H** | 33 — VM-entry failure due to invalid guest state | A guest-state check failed | Narrows the cause: 0 = an ordinary guest-state check; 2, 3 or 4 = PDPTE load, NMI injection blocked by STI, or an invalid VMCS-link pointer |
| **8000_0022H** | 34 — VM-entry failure due to MSR loading | An entry in the VM-entry MSR-load area failed | The **1-based index** of the failing entry; the offending entry is at `msr_load_area + 16 * (qualification - 1)` |
| **8000_0029H** | 41 — VM-entry failure due to machine-check event | A machine-check event occurred during VM entry | — |

**What it means for your handler.** Mask the exit reason with 0xFFFF before indexing a dispatch table, but **test bit 31 first** — 8000_0021H and 8000_0022H must never reach your guest-exit dispatch. On a failure of this class the processor does *not* save guest state back into the guest-state area and does *not* process the VM-exit MSR-store area; only the exit-reason and exit-qualification fields are guaranteed to be updated, and the other VM-exit information fields are undefined. Host state is loaded exactly as on a VM exit, so you resume at the host RIP with the host-state area's context — if you kept state in registers across the entry you must reload it.

**Debugging 8000_0021H specifically.** Read the exit qualification. A non-zero value sends you straight to the enumerated cases above (qualification 3, for instance, is an attempt to inject an NMI into a guest blocking events through the STI blocking bit). A qualification of **0** means "one of the ordinary guest-state checks failed" and you must re-derive the cause yourself — walk the guest-state checks in order; **segment access rights** and the **IA-32e-mode consistency set** (CR0.PG / CR4.PAE / IA32_EFER.LME / IA32_EFER.LMA / "IA-32e mode guest" / CS.L) account for most of these.

One distinction worth internalising: this failure class is *not* a VMfail. A VMfail (RFLAGS.CF or ZF set, control returning to the instruction after VMLAUNCH/VMRESUME) never changes guest-visible state at all, whereas an exit-reason-33 or -34 failure has already overwritten the processor's architectural state with the contents of the guest-state area before failing.
**Citation given:** Intel SDM Vol.3C §27.9.1 (exit-reason field layout) — `[SDM 3C §27.9.1]`; Intel SDM Vol.3D Appendix C (reasons 33/34/41) — `[SDM 3D App.C]`; Intel SDM Vol.3C Ch.29 (VM-entry failure behaviour) — `[SDM 3C Ch.29]`
**Contamination note:** none

---

### exit-qual-io-instruction
**Routed to:** `05-vm-exit.md` §5.4 (routing row "**Decoding a VM exit**: ... exit qualification layouts (§5.4)")
**Actually answered from:** `references/05-vm-exit.md` §5.4.3 "I/O instruction (reason 30)"
**Answer:**
Both come straight out of the exit qualification — you never need to disassemble the guest.

- **Port number: bits 31:16.** Bits 15:7 are reserved and cleared to 0.
- **Access size: bits 2:0** — `0` = 1 byte, `1` = 2 bytes, `3` = 4 bytes. Values 2, 4, 5, 6 and 7 are not used. (Note the gap: the field is *not* a simple log2 encoding, and 2 is not a legal value.)

The rest of the qualification for reason 30, since you will need it to emulate correctly:

| Bits | Field |
|---|---|
| 2:0 | Size of access: 0 = 1 byte, 1 = 2 bytes, 3 = 4 bytes |
| 3 | Direction: 0 = OUT, 1 = IN |
| 4 | String instruction (INS or OUTS) |
| 5 | REP prefix present |
| 6 | Operand encoding: 0 = port number came from DX, 1 = port number was an immediate operand |
| 15:7 | Reserved, cleared to 0 |
| 31:16 | Port number |

Two follow-ons for string I/O: for **INS and OUTS** the **guest-linear address** field of the VMCS holds the linear address of the source or destination, and the **VM-exit instruction information** field identifies the segment and address size. Whether the processor reports instruction information for INS and OUTS is itself a capability — it is reported by **bit 54 of IA32_VMX_BASIC**, so check it rather than assume it.

Also worth remembering when you are deciding why you took the exit at all: I/O instructions cause unconditional VM exits when "unconditional I/O exiting" is 1, are decided by the I/O bitmaps when "use I/O bitmaps" is 1, and execute in the guest when both are 0.
**Citation given:** Intel SDM Vol.3C §27.9.1 (exit qualification for I/O instructions) — `[SDM 3C §27.9.1]`; Intel SDM Vol.3C §27.9.4 (guest-linear address for INS/OUTS) — `[SDM 3C §27.9.4]`; Intel SDM Vol.3D Appendix A (IA32_VMX_BASIC bit 54) — `[SDM 3D App.A]`
**Contamination note:** none

---

### eptp-low-bits
**Routed to:** `06-address-translation.md` (routing row "EPT structures, EPT violation vs misconfiguration, VPID, PML, SPP, HLAT, #VE")
**Actually answered from:** `references/06-address-translation.md` §6.2 "The extended-page-table pointer (EPTP)", §6.2.1 "Memory types under EPT"
**Answer:**
The EPTP is a 64-bit VM-execution control field at VMCS encoding **201AH**, and it carries the configuration of the whole EPT walk in its low bits:

| Bits | Field |
|---|---|
| 2:0 | EPT paging-structure memory type |
| 5:3 | EPT page-walk length **minus 1** |
| 6 | Enable accessed and dirty flags for EPT |
| 7 | Enable enforcement of access rights for supervisor shadow-stack pages |
| 11:8 | Reserved (must be 0) |
| 51:12 | Physical address of the 4-KByte-aligned EPT PML4 table (EPT PML5 table with 5-level EPT) |

**The value that selects a 4-level hierarchy: bits 5:3 = 3.** The field holds the page-walk length *minus one*, so 3 gives a 4-level hierarchy rooted at an EPT PML4 table, and 4 gives a 5-level hierarchy rooted at an EPT PML5 table. This off-by-one is the single most common EPTP programming mistake.

Field by field:

- **Bits 2:0 (memory type).** This is the memory type used for the *processor's own accesses to the EPT paging structures*, not for guest data accesses. The only values a processor may support are **0 (uncacheable)** and **6 (write-back)**, and support is enumerated in **IA32_VMX_EPT_VPID_CAP** — read it rather than assuming WB. (The memory type for a guest access comes from bits 5:3 of the EPT *leaf entry*, not from here.)
- **Bit 6 (enable A/D flags for EPT).** When 0, the processor never sets bit 8 or bit 9 of an EPT paging-structure entry. PML depends on this bit being 1.
- **Bit 7.** Enables enforcement of access rights for supervisor shadow-stack pages, which is what gives bit 60 of an EPT leaf entry its meaning.
- **Bits 11:8.** Reserved, must be 0.
- **Bits 51:12.** The physical address of the root EPT paging structure. Bits above the processor's physical-address width must be 0.

Two things that catch people out: the EPTP holds a **host physical address, not a guest-physical address** — the VMM writes it before VM entry and the processor never translates it. And the address portion, bits 51:12, is called the **EP4TA**; it is the tag used for guest-physical and combined mappings, and it is what INVEPT type 1 invalidates against.
**Citation given:** Intel SDM Vol.3C §27.6.11 — `[SDM 3C §27.6.11]`; Intel SDM Vol.3D Appendix A (IA32_VMX_EPT_VPID_CAP) — `[SDM 3D App.A]`; Intel SDM Vol.3C Ch.31 — `[SDM 3C Ch.31]`
**Contamination note:** none

---

### ept-misconfiguration-conditions
**Routed to:** `06-address-translation.md` (routing row "EPT structures, **EPT violation vs misconfiguration**, VPID, PML, SPP, HLAT, #VE")
**Actually answered from:** `references/06-address-translation.md` §6.4 (SDM excerpt), §6.4.1 "Conditions that cause an EPT misconfiguration", §6.4.2, §6.4.4
**Answer:**
The dividing line first, because it is what the whole distinction turns on. From the SDM: *"An EPT misconfiguration occurs when, in the course of translating a guest-physical address, the logical processor encounters an EPT paging-structure entry that contains an unsupported value. An EPT violation occurs when there is no EPT misconfiguration but the EPT paging-structure entries disallow an access using the guest-physical address."* A violation is a policy decision you programmed on purpose; a misconfiguration is a bug in the table you built.

**The entry values that cause a misconfiguration:**

1. **Write without read.** Bits 2:0 of an entry used in the translation are `010b` (write, no read) or `110b` (write and execute, no read). The architecture never permits write access without read access.
2. **Execute-only where unsupported.** Bits 2:0 are `100b` (execute-only) on a processor that does not support execute-only EPT translations, as reported by **IA32_VMX_EPT_VPID_CAP**.
3. **Any reserved bit set in a present entry**, specifically:
   - bits 7:3 in an entry that references another EPT paging structure;
   - the page-frame alignment bits — **29:12 for a 1-GByte page, 20:12 for a 2-MByte page**;
   - any address bit above the processor's physical-address width;
   - bit 7 in an entry at a level where the corresponding page size is unsupported.
4. **An illegal memory type in a present leaf entry** — EPT memory type **2, 3 or 7** in bits 5:3. The defined values are 0 (UC), 1 (WC), 4 (WT), 5 (WP) and 6 (WB).

**Two scoping rules that matter in practice.** Misconfiguration checks apply **only to entries actually used in a translation** and **only to present entries** — so you may leave arbitrary values in the upper bits of a zeroed (not-present) entry without penalty.

**Not exhaustive, deliberately.** Further misconfiguration conditions exist for feature-specific bits — for example combinations of bit 2 and bit 10 under mode-based execute control, and bits that require the corresponding EPTP enable bit — but the exact conjunctions are not restated here. Read the SDM's own enumeration before relying on them.

**Handling.** A misconfiguration is basic exit reason **49**; a violation is **48**. Reason 49 has **no defined exit qualification**, so the only architectural information you get is the guest-physical address. Resuming without changing the entry re-raises the same exit, so the only correct response is to correct or tear down the mapping. The most common real cause of an unexpected misconfiguration is **a non-atomic update to a live EPT entry** that momentarily leaves an illegal permission combination — classically, clearing read while write is still set, which lands you straight in condition 1 above.
**Citation given:** Intel SDM Vol.3C Ch.31 — `[SDM 3C Ch.31]`; Intel SDM Vol.3D Appendix A (IA32_VMX_EPT_VPID_CAP) — `[SDM 3D App.A]`; Intel SDM Vol.3C §27.9.1 (the two exit reasons) — `[SDM 3C §27.9.1]`
**Contamination note:** none

---

### pml-log-and-index
**Routed to:** `06-address-translation.md` (routing row "EPT structures, EPT violation vs misconfiguration, VPID, **PML**, SPP, HLAT, #VE")
**Actually answered from:** `references/06-address-translation.md` §6.8 "Page-modification logging (PML)", §6.12; cross-checked `references/errata.md` E02
**Answer:**
**Size.** The page-modification log is a **4-KByte page** holding **512 entries of 64 bits each** — exactly filling the page. Its physical address is a 64-bit VM-execution control field at VMCS encoding **200EH**.

**Where the index lives.** The **PML index** is a **16-bit guest-state field** at VMCS encoding **0812H**. It is part of guest non-register state, so it is saved and restored across VM exits and entries with the rest of the guest state.

**Which way it fills: downwards.** Software normally initializes the index to **511**; the processor writes the entry at the position the index gives and then **decrements** the index. So the buffer fills from index 511 down toward 0, and the most recently logged entry sits at the *lowest* written index. A consumer that walks the buffer forwards from index 0 reads entries in reverse chronological order.

The whole protocol is four lines:

```
on setting bit 9 (dirty) of an EPT leaf entry from 0 to 1:
    if PML index is not in 0..511:
        page-modification log-full VM exit (basic exit reason 62)
    PML_buffer[PML index] <- GPA of the access, bits 11:0 cleared
    PML index <- PML index - 1
```

**What gets logged.** The processor logs an entry when it sets the dirty flag of an EPT leaf entry, writing the **guest-physical address of the access with bits 11:0 cleared**. PML therefore **requires EPT A/D flags (EPTP bit 6) to be enabled**.

**When it stops.** If the PML index is outside 0–511 a **page-modification log-full VM exit** occurs — **basic exit reason 62**. The VMM drains the buffer and resets the index.

**Two traps in the VMM-side protocol.** First, an entry is logged only on the **0→1 transition** of the dirty flag: a page whose dirty flag is already set is silently invisible to the log, so software that wants a page tracked must clear the dirty flag first — and, usefully in reverse, software can *pre-set* dirty flags on pages it does not wish to track. Second, the descending fill order described above.

**Scope.** PML is per-VMCS and therefore **per-vCPU**: each vCPU needs its own log page. And PML *replaces* rather than supplements write-protection-based dirty tracking — with PML you no longer clear EPT write permission on tracked pages, which removes one EPT violation per page per tracking round.

Two side notes. PML logs only **write** accesses, so it cannot by itself estimate a working-set size. And on provenance: PML's first silicon was **Broadwell Xeon (2015)**, not Skylake — the Skylake attribution is a widely circulated error.
**Citation given:** Intel SDM Vol.3C §27.6.18 (PML facility and log) — `[SDM 3C §27.6.18]`; Intel SDM Vol.3C §27.4.2 (PML index as guest non-register state) — `[SDM 3C §27.4.2]`; Intel SDM Vol.3D Appendix C (exit reason 62) — `[SDM 3D App.C]`
**Contamination note:** none

---

### virtual-apic-page-offsets
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, **virtual-APIC page**, RVI/SVI, posted interrupts, IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.3.1 "The virtual-APIC page"
**Answer:**
Offsets within the 4-KByte virtual-APIC page (located by the virtual-APIC address field at VMCS encoding 2012H):

| Offset | Virtual register | Meaning |
|---|---|---|
| **080H** | **VTPR** | virtual task-priority register |
| **0A0H** | **VPPR** | virtual processor-priority register |
| **0B0H** | **VEOI** | virtual end-of-interrupt register |
| **100H–170H** | **VISR** | virtual in-service register, 256 bits |
| **200H–270H** | **VIRR** | virtual interrupt-request register, 256 bits |

For completeness, the rest of the page's documented registers: **VICR_LO at 300H**, **VICR_HI at 310H**, and the **virtual self-IPI register at 3F0H** (corresponding to the x2APIC self-IPI MSR).

**How VISR and VIRR are laid out inside their ranges.** Each holds 256 bits as **eight 32-bit values placed 16 bytes apart**, matching the xAPIC register layout — so VIRR's eight dwords sit at 200H, 210H, 220H … 270H, and VISR's at 100H, 110H … 170H. Do not treat them as packed 32-byte bitmaps.

One practical point: the virtual-APIC page is **ordinary memory that the VMM allocates and may read and write itself**. That is how a VMM injects an interrupt under virtual-interrupt delivery — it sets the vector's bit in VIRR and raises RVI (bits 7:0 of the guest-interrupt-status field at 0810H), rather than using the VM-entry interruption-information field. SVI, in bits 15:8 of that same field, is the highest bit set in VISR.
**Citation given:** Intel SDM Vol.3C Ch.32 "APIC Virtualization and Virtual Interrupts" — `[SDM 3C Ch.32]`; Intel SDM Vol.3C §27.6.8 (virtual-APIC address field) — `[SDM 3C §27.6.8]`
**Contamination note:** none

---

### posted-interrupt-descriptor-layout
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, **posted interrupts**, IPIv")
**Actually answered from:** `references/07-apic-virtualization.md` §7.8.1 "The posted-interrupt descriptor", §7.10
**Answer:**
The posted-interrupt descriptor is a **64-byte structure aligned on a 64-byte boundary**, referenced by the posted-interrupt descriptor address field of the VMCS (encoding 2016H).

| Bits | Field |
|---|---|
| **255:0** | **PIR** — posted-interrupt requests, one bit per vector |
| **256** | **ON** — outstanding notification |
| **257** | **SN** — suppress notification |
| 271:258 | reserved |
| **279:272** | **NV** — notification vector |
| 287:280 | reserved |
| **319:288** | **NDST** — notification destination |
| 511:320 | reserved |

Field by field:

- **PIR (bits 255:0)** — a 256-bit vector bitmap with one bit per interrupt vector. This is where a poster (another logical processor, or the IOMMU) records the interrupt.
- **ON (bit 256)** — the outstanding-notification bit: it records that a notification has already been sent for interrupts sitting in PIR but not yet processed. It is what stops a storm of redundant notification IPIs.
- **SN (bit 257)** — the suppress-notification bit: when 1, a poster records the interrupt in PIR but sends **no** notification event.
- **NV (bits 279:272)** — the notification vector, the physical interrupt vector used to poke the target logical processor.
- **NDST (bits 319:288)** — the notification destination, identifying that processor by its **physical APIC ID**.

A useful cross-check: the layout is mirrored field for field by the Linux `struct pi_desc`, which declares `pir[8]` followed by a 16-bit notifications word carrying ON and SN, an 8-bit `nv`, and a 32-bit `ndst`, with 64-byte alignment.

Two VM-entry constraints you will hit if you program this: "process posted interrupts" requires **"virtual-interrupt delivery" and "acknowledge interrupt on exit" both 1**, a notification vector whose **bits 15:8 are 0**, and a **64-byte-aligned** descriptor address.
**Citation given:** Intel SDM Vol.3C Ch.32 — `[SDM 3C Ch.32]`; Intel SDM Vol.3C §27.6.8 (descriptor address field) — `[SDM 3C §27.6.8]`
**Contamination note:** none

---

### apicv-vmcs-encodings
**Routed to:** `07-apic-virtualization.md` (routing row "**APICv**, virtual-APIC page, RVI/SVI, posted interrupts, IPIv"); pulled control-field encodings from `02-vmcs.md` §2.5/§2.8, which owns them
**Actually answered from:** `references/07-apic-virtualization.md` §7.4 "VMCS fields this chapter depends on", §7.10, §7.12; `references/02-vmcs.md` §2.5.2–§2.5.4, §2.8
**Answer:**
Two sets: the data/pointer fields the APICv machinery reads, and the control fields that switch it on.

**Data and pointer fields**

| Field | Encoding | Width |
|---|---|---|
| Virtual-APIC address | **2012H** | 64-bit control |
| APIC-access address | **2014H** | 64-bit control |
| Posted-interrupt descriptor address | **2016H** | 64-bit control |
| EOI-exit bitmap 0 … 3 | **201CH, 201EH, 2020H, 2022H** | 64-bit control |
| TPR threshold | **401CH** | 32-bit control |
| Guest interrupt status (RVI in bits 7:0, SVI in bits 15:8) | **0810H** | 16-bit guest state |
| Posted-interrupt notification vector | **0002H** | 16-bit control |
| PID-pointer table address, last PID-pointer index (IPI virtualization) | **not stated by this knowledge base** — see below | |

The four EOI-exit bitmap fields together form a 256-bit map with one bit per interrupt vector.

**Control fields, and the bits inside them**

| Control field | Encoding | Bits that matter for APICv |
|---|---|---|
| Pin-based VM-execution controls | **4000H** | bit 7 process posted interrupts |
| Primary processor-based VM-execution controls | **4002H** | bit 21 use TPR shadow; bit 31 activate secondary controls; bit 17 activate tertiary controls |
| Secondary processor-based VM-execution controls | **401EH** | bit 0 virtualize APIC accesses; bit 4 virtualize x2APIC mode; bit 8 APIC-register virtualization; bit 9 virtual-interrupt delivery |
| Tertiary processor-based VM-execution controls | **2034H** | bit 4 IPI virtualization |
| Primary VM-exit controls | **400CH** | bit 15 acknowledge interrupt on exit (required with posted interrupts) |

**The dependency lattice VM entry enforces.** These cannot be set independently:

- If **"use TPR shadow" is 0**, then "virtualize x2APIC mode", "APIC-register virtualization", "virtual-interrupt delivery" and "IPI virtualization" must **all** be 0. "Use TPR shadow" also requires a valid 4-KByte-aligned virtual-APIC address.
- **"Virtual-interrupt delivery" requires "external-interrupt exiting" to be 1**, because the processor must own the physical interrupt path to arbitrate between physical and virtual interrupts.
- **"Process posted interrupts" requires "virtual-interrupt delivery" and "acknowledge interrupt on exit" to be 1**, a notification vector whose bits 15:8 are 0, and a 64-byte-aligned posted-interrupt descriptor address.

**One gap you must fill from the SDM.** The VMCS encodings of the **PID-pointer table address** and the **last PID-pointer index** — the two fields IPI virtualization needs — are **deliberately not stated** in this knowledge base; both `07-apic-virtualization.md` §7.12 and `02-vmcs.md` §2.5.6 record them as unconfirmed. Read them from SDM Vol.3D Appendix B. Everything else above is complete.

Finally, SDM rev 092 also defines **APIC-timer virtualization** controls in the VMCS (Vol.3C §27.6.27); they sit outside the APICv stack described here.
**Citation given:** Intel SDM Vol.3C §27.6.8 (APIC-virtualization control fields) — `[SDM 3C §27.6.8]`; Intel SDM Vol.3C §27.4.2 (guest interrupt status) — `[SDM 3C §27.4.2]`; Intel SDM Vol.3C §27.6.2 (processor-based control bits) — `[SDM 3C §27.6.2]`; Intel SDM Vol.3D Appendix B (encodings) — `[SDM 3D App.B]`; Intel SDM Vol.3C Ch.32 (dependency rules) — `[SDM 3C Ch.32]`
**Contamination note:** none

---

### pid-pointer-table-encoding
**Routed to:** `07-apic-virtualization.md` (routing row "APICv, virtual-APIC page, RVI/SVI, posted interrupts, **IPIv**"); followed its pointer to `02-vmcs.md` §2.5, which owns encodings
**Actually answered from:** `references/07-apic-virtualization.md` §7.4, §7.9, §7.12 "Open items"; `references/02-vmcs.md` §2.5.6 "Encodings deliberately omitted"
**Answer:**
**THE SKILL DOES NOT CONTAIN THIS.**

Neither encoding is stated, and both owning chapters say so explicitly rather than guess:

- `07-apic-virtualization.md` §7.12 lists "the VMCS encodings of the PID-pointer table address and last PID-pointer index" among the facts deliberately not stated because they could not be anchored with confidence. Its §7.4 field table has the row "PID-pointer table address, last PID-pointer index — *see `02-vmcs.md`*".
- `02-vmcs.md` §2.5.6 in turn lists "the 16-bit last-PID-pointer-index field associated with IPI virtualization" among the encodings deliberately omitted because they could not be confirmed against the field-encoding appendix.

So the two chapters point at each other and neither has the numbers. Read them from SDM Vol.3D Appendix B or a kernel header.

What the knowledge base *does* tell you about these fields:

- **Last PID-pointer index is a 16-bit field.** (`02-vmcs.md` §2.5.6 identifies it as such.)
- IPI virtualization is enabled by **bit 4 of the tertiary processor-based VM-execution controls** (`2034H`, gated by primary control bit 17).
- The processor locates the target vCPU's posted-interrupt descriptor through a **PID-pointer table indexed by the target vCPU's APIC ID**, addressed by the PID-pointer table address field with its size bounded by the last PID-pointer index field.
- A **PID-pointer table entry carries a valid bit in bit 0** alongside the 64-byte-aligned address of the descriptor, so you can mark entries for non-existent vCPUs invalid. (The rest of the entry layout is also not stated.)
- Every failure of the hardware lookup — an unsupported IPI form, an index beyond the last PID-pointer index, or an invalid table entry — falls back to a **trap-like APIC-write VM exit (reason 56)**, so you never have to pre-validate what the guest writes to ICR.

One derivation aid if you are going to read the appendix: by the encoding format, a 16-bit control field has base `0x0000`, and the known 16-bit control encodings are 0x0000 (VPID), 0x0002 (posted-interrupt notification vector) and 0x0004 (EPTP index). The last-PID-pointer index is a 16-bit field in that family, but the knowledge base does not state its index, so I will not extrapolate a value.
**Citation given:** Intel SDM Vol.3C Ch.32 (IPI virtualization and the PID-pointer table mechanism) — `[SDM 3C Ch.32]`. No citation for the encodings themselves, because the knowledge base states none.
**Contamination note:** none

---

### vminstr-error-vmptrld
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "VMX instruction semantics, capability MSRs, **what VM-instruction error N means**")
**Actually answered from:** `references/08-vmx-instructions.md` §8.3.3 "VMPTRLD", §8.4 "The VM-instruction error number table"; `references/04-vm-entry.md` §4.9 (flag protocol)
**Answer:**
ZF set means **VMfailValid** — CF is 0, ZF is 1, and the error number has been written into the **VM-instruction error field (VMCS encoding 4400H)**. VMREAD that field. (Contrast **VMfailInvalid**, which is CF = 1 with ZF = 0 and records *no* error number, because there is no valid current VMCS to store one in.)

VMPTRLD can produce exactly **three** error numbers:

| Error | Meaning | What to check |
|---|---|---|
| **9** | VMPTRLD with invalid physical address | The operand address is **not 4-KByte aligned**, or it sets bits beyond the processor's physical-address width |
| **10** | VMPTRLD with VMXON pointer | You passed the address of the **VMXON region** instead of a VMCS region |
| **11** | VMPTRLD with incorrect VMCS revision identifier | The **31-bit revision identifier** in the first dword of the referenced region does not match the processor's — or **bit 31 of that dword marks the region as a shadow VMCS** on a processor that does not support VMCS shadowing |

**How to fix each.** For **9**, allocate the VMCS region page-aligned and mask the address against the physical-address width from CPUID. For **10**, check your bookkeeping — this is almost always a swapped variable. For **11**, write `IA32_VMX_BASIC[30:0]` (MSR 480H) into the first dword of the region *before* VMPTRLD; IA32_VMX_BASIC bit 31 is always 0, which is precisely what lets bit 31 of that dword be reused as the shadow-VMCS indicator, so a stale or garbage first dword with bit 31 set will also land you here.

Two notes on VMPTRLD itself while you are debugging. It takes an **m64 operand holding the physical address** of a VMCS region and makes that VMCS both **active and current** on the executing logical processor. Only one VMCS can be current on a logical processor at a time — VMPTRLD replaces the previous current VMCS, which **remains active** until VMCLEAR is executed for it.

And one namespace warning: VM-instruction error numbers are a **flat namespace entirely separate from basic exit reasons**. Error 28 and exit reason 28 have nothing to do with each other.
**Citation given:** Intel SDM Vol.3C §27.9.5 (VM-instruction error field and the error numbers) — `[SDM 3C §27.9.5]`; Intel SDM Vol.3C Ch.33 (VMPTRLD semantics) — `[SDM 3C Ch.33]`; Intel SDM Vol.3C §27.11 (active/current VMCS) — `[SDM 3C §27.11]`
**Contamination note:** none

---

### vmx-capability-msr-addresses
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "VMX instruction semantics, **capability MSRs**, what VM-instruction error N means")
**Actually answered from:** `references/08-vmx-instructions.md` §8.6.1 "Addresses", §8.6.2, §8.6.3
**Answer:**
Every control field must be derived from these rather than from a compile-time constant — a VMM that hard-codes control values fails VM entry with **error 7** on the next microarchitecture.

| MSR | Address |
|---|---|
| IA32_VMX_BASIC | **480H** |
| IA32_VMX_PINBASED_CTLS | **481H** |
| IA32_VMX_PROCBASED_CTLS | **482H** |
| IA32_VMX_EXIT_CTLS | **483H** |
| IA32_VMX_ENTRY_CTLS | **484H** |
| IA32_VMX_MISC | **485H** |
| IA32_VMX_CR0_FIXED0 | **486H** |
| IA32_VMX_CR0_FIXED1 | **487H** |
| IA32_VMX_CR4_FIXED0 | **488H** |
| IA32_VMX_CR4_FIXED1 | **489H** |
| IA32_VMX_VMCS_ENUM | **48AH** |
| IA32_VMX_PROCBASED_CTLS2 | **48BH** |
| IA32_VMX_EPT_VPID_CAP | **48CH** |
| IA32_VMX_TRUE_PINBASED_CTLS | **48DH** |
| IA32_VMX_TRUE_PROCBASED_CTLS | **48EH** |
| IA32_VMX_TRUE_EXIT_CTLS | **48FH** |
| IA32_VMX_TRUE_ENTRY_CTLS | **490H** |
| IA32_VMX_VMFUNC | **491H** |
| IA32_VMX_PROCBASED_CTLS3 (tertiary processor-based controls) | **492H** |
| IA32_VMX_EXIT_CTLS2 (secondary VM-exit controls) | **493H** |

A contiguous block, 480H–493H. **All of them are read-only**; writing any of them causes #GP(0).

**Read them in this order at bring-up.** Start with **IA32_VMX_BASIC (480H)** — bits 30:0 are the VMCS revision identifier you must write into the first dword of every VMCS and VMXON region, bits 44:32 give the number of bytes to allocate for those regions (never more than 4096), and **bit 55 tells you whether the TRUE_\* MSRs (48DH–490H) exist**. Only if bit 55 is 1 may you consult the TRUE variants — and you need them, because they report the same allowed-1 settings as their non-true counterparts but may report allowed-0 settings of **0** for controls that are default-1 in the original MSRs. That is the only way to clear **CR3-load exiting and CR3-store exiting**, which an EPT-using VMM wants off.

Two further reading notes: the gated control groups have MSRs you should only bother with when the gate is available — 48BH matters when primary bit 31 can be set, 492H when primary bit 17 can. And **IA32_VMX_EPT_VPID_CAP (48CH)** is not optional reading if you use EPT: it enumerates the supported EPTP memory types, whether execute-only translations exist, and which INVEPT and INVVPID types the processor implements.
**Citation given:** Intel SDM Vol.3D Appendix A "VMX Capability Reporting Facility" — `[SDM 3D App.A]`
**Contamination note:** none

---

### invvpid-types
**Routed to:** `08-vmx-instructions.md` §8.4 (routing row "VMX instruction semantics, capability MSRs, **what VM-instruction error N means**"); cross-read `06-address-translation.md` §6.7, which owns the descriptor layouts
**Actually answered from:** `references/08-vmx-instructions.md` §8.5 "INVEPT and INVVPID descriptors", §8.4 (error 28), §8.5.1; `references/06-address-translation.md` §6.7
**Answer:**
**The four types:**

| Type | Name | What it invalidates |
|---|---|---|
| **0** | Individual-address | Mappings for the **linear address in the descriptor**, tagged with the descriptor's VPID |
| **1** | Single-context | **All** mappings tagged with the descriptor's VPID, **except global translations** |
| **2** | All-contexts | All mappings tagged with **any non-zero VPID**; the descriptor is ignored |
| **3** | Single-context-retaining-globals | Mappings tagged with the descriptor's VPID, **retaining** global translations |

The descriptor is 128 bits: **bits 15:0 VPID, bits 63:16 reserved and must be 0, bits 127:64 linear address** (used only by type 0).

**Why you are getting error 28.** VM-instruction error 28 is "invalid operand to INVEPT/INVVPID". For INVVPID there is one overwhelmingly likely cause:

> **For INVVPID types 0, 1 and 3 the VPID in the descriptor must not be 0000H. Using 0000H reports error number 28.**

VPID 0000H identifies **VMX root operation** — the VMM's own translations — so it is never valid for a guest invalidation. Note the asymmetry that catches people: **type 2 is the exception**, because it ignores the descriptor entirely and invalidates all *non-zero* VPIDs. Which is also why type 2 cannot be used to flush VMX root operation's own translations.

So check, in this order:

1. **Is the descriptor's VPID field zero?** If you zero-initialize the descriptor and only fill in the linear address, this is your bug. It is also the classic symptom of "my VMCS has VPID 0 because I never enabled VPID but I am calling INVVPID anyway."
2. **Are bits 63:16 of the descriptor zero?** They are reserved and must be 0.
3. **Does the processor actually support the type you are using?** Which INVEPT and INVVPID types a processor supports is enumerated in **IA32_VMX_EPT_VPID_CAP (48CH)** — you must read that MSR rather than assume all four INVVPID types exist.
4. **Are you in VMX root operation?** Both instructions are valid only there; in non-root operation INVVPID unconditionally causes a VM exit (basic exit reason 53) rather than executing.

Two semantics reminders while you are in this code. **INVVPID never invalidates guest-physical mappings** — it invalidates linear and combined mappings tagged with the given VPID; removing a guest-physical mapping requires **INVEPT**. And invalidation is **per logical processor**: after modifying structures other logical processors may be caching, you must execute the invalidation on each of them.
**Citation given:** Intel SDM Vol.3C Ch.33 (INVVPID types, descriptor, and the VPID-0 rule) — `[SDM 3C Ch.33]`; Intel SDM Vol.3C §27.9.5 (error 28) — `[SDM 3C §27.9.5]`; Intel SDM Vol.3D Appendix A (IA32_VMX_EPT_VPID_CAP) — `[SDM 3D App.A]`; Intel SDM Vol.3C §27.6.12 (VPID 0000H is VMX root operation) — `[SDM 3C §27.6.12]`
**Contamination note:** none

---

### dmar-register-offsets
**Routed to:** `10-vtd-dma-remapping.md` (routing row "VT-d DMA remapping, **DMAR registers**, translation structures, invalidation")
**Actually answered from:** `references/10-vtd-dma-remapping.md` §10.5 "The DMAR register set (Ch.11)"
**Answer:**
All offsets are relative to the remapping hardware unit's register base address.

| Offset | Register |
|---|---|
| **008h** | **Capability Register (CAP_REG)** |
| **010h** | **Extended Capability Register (ECAP_REG)** |
| **018h** | **Global Command Register (GCMD_REG)** |
| **01Ch** | **Global Status Register (GSTS_REG)** |
| **020h** | **Root Table Address Register (RTADDR_REG)** |
| **0B8h** | **Interrupt Remapping Table Address Register (IRTA_REG)** |

There are two capability registers, so if "the capability registers" means both: **CAP_REG at 008h and ECAP_REG at 010h**.

Surrounding context, since these are the ones you usually need next: VER_REG at 000h, CCMD_REG at 028h, FSTS_REG at 034h, FECTL_REG at 038h, Fault Event Data at 03Ch, Fault Event Address at 040h, Fault Event Upper Address at 044h, PMEN_REG at 064h, IQH_REG at 080h, IQT_REG at 088h, IQA_REG at 090h, Invalidation Completion Status at 09Ch, Page Request Queue Head/Tail/Address at 0C0h/0C8h/0D0h.

**One thing you must not hard-code.** Two register groups **float**: the **IOTLB registers** and the **Fault Recording Registers**. Hardware may place them at any unused or reserved address in the 4 KB register space or in adjoined 4 KB regions, and software must read the capability registers to find them — the IOTLB registers from **ECAP_REG.IRO** and the fault recording registers from **CAP_REG.FRO**. (For the latter: if the register base address is X and CAP_REG.FRO reports Y, the first Fault Recording Register is at **X + 16\*Y**, with registers 16 bytes apart.)

This is exactly why CAP_REG and ECAP_REG are the first two registers you read after mapping the unit.
**Citation given:** Intel VT-d Specification Rev 5.20 §11.4 — `[VT-d 5.20 §11.4]`
**Contamination note:** none

---

### invalidation-descriptor-types
**Routed to:** `10-vtd-dma-remapping.md` (routing row "VT-d DMA remapping, DMAR registers, translation structures, **invalidation**")
**Actually answered from:** `references/10-vtd-dma-remapping.md` §10.6.3 "Queued invalidation (§6.5.2)", §10.6.4
**Answer:**
**Where the type field is — and this is the part that trips people up.** The Type field of an invalidation descriptor is a **7-bit field formed by concatenating bits 11:9 and bits 3:0** of the descriptor. It is **not** contiguous. A decoder that reads bits 3:0 alone will work by accident on every currently defined type and then break on the first descriptor that uses the high three bits.

**The type values:**

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
| **9h** | Page Group Response (`pgrp_resp_dsc`) | §7.6.1 |
| **Ah** | HPT Cache Invalidate | §6.5.2.7 |

Note that **9h, the Page Group Response Descriptor, is not an invalidation at all** — it is submitted through the same invalidation queue and therefore shares the type space.

**Context.** Queued invalidation is supported only on hardware reporting **ECAP_REG.QI** as Set, is enabled through **GCMD_REG.QIE** and observed through **GSTS_REG.QIES**. The queue is located by **IQA_REG (090h)**, with **IQH_REG (080h)** giving the offset of the descriptor hardware will read next and **IQT_REG (088h)** the offset software will write next. It is the only route to PASID-granular and device-TLB invalidation.

**Ordering rules you will need alongside the type values:** hardware completes a PASID-based IOTLB invalidation only after all context-cache and PASID-cache invalidations ahead of it in the queue complete; it completes an IOTLB invalidation only after all context-cache invalidations ahead of it complete; and **software must always request IOTLB invalidation before the corresponding Device-TLB invalidation**. If the Fence (FN) flag is 1 in an Invalidation Wait Descriptor, hardware executes descriptors following it only after the wait command completes.
**Citation given:** Intel VT-d Specification Rev 5.20 §6.5.2 (type field and descriptor types) — `[VT-d 5.20 §6.5.2]`; §7.6.1 (Page Group Response type 9h) — `[VT-d 5.20 §7.6.1]`; §6.5.2.12 (ordering) — `[VT-d 5.20 §6.5.2.12]`
**Contamination note:** none

---

### irte-remapped-layout
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, **IRTE**, interrupt posting on the VT-d side")
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.4 "IRTE for remapped interrupts (§9.9)", §11.4.1
**Answer:**
Each IRTE is **128 bits**, and the interrupt remapping table holds at most **64K** of them. This is the layout when **IM = 0** (remapped format); when IM = 1 the same 128 bits are interpreted in the posted format of §9.10.

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

Field notes:

- **P (bit 0)** — Present. With one exception, every other field is evaluated only when P is Set.
- **FPD (bit 1)** — Fault Processing Disable. **This is the exception**: FPD is evaluated by hardware *irrespective* of the setting of P.
- **DM (bit 2)** — whether DST is interpreted as a **logical or a physical** APIC ID.
- **RH (bit 3)** — whether the request should be directed to one among N processors specified in DST, under hardware control.
- **TM (bit 4)** — Trigger Mode. But **NMI, INIT and ExtINT are edge triggered regardless** of this field.
- **DLM (bits 7:5)** — 3-bit Delivery Mode. It operates only in conjunction with specific Trigger Modes, and **software must guarantee the correct Trigger Mode**; hardware does not police it.
- **AVAIL (bits 11:8)** — available to software; hardware always ignores its programming.
- **IM (bit 15)** — 0 = remapped (this layout), 1 = posted (§9.10 layout).
- **V (bits 23:16)** — 8-bit interrupt vector. For delivery modes that ignore the vector — **including SMI** — the vector field **must be programmed to all zeros** for future compatibility.
- **DST (bits 63:32)** — target processor(s); interpretation depends on the interrupt-remapping mode in force (see the EIME bit of IRTA_REG).
- **SID / SQ / SVT (bits 79:64 / 81:80 / 83:82)** — source-id validation, below.

**Source-id validation.** SVT selects what checking hardware does on the source-id of requests referencing this IRTE. With **SVT = 01b**, SID is the requester-id allowed to originate the request and **SQ** determines which bits of SID are compared — the SQ encodings progressively ignore the least significant fields (full comparison; ignoring the third least significant field; ignoring the second and third; ignoring the least three), which exists for devices supporting phantom functions. With **SVT = 10b**, the **upper 8 bits of SID are a Startbus# and the lower 8 bits an Endbus#**, and the requester-id's bus number must fall in that range — used to verify interrupts originating behind PCI Express-to-PCI/PCI-X bridges. SID is evaluated only when P is Set and SVT is 01b or 10b; SQ only when P is Set and SVT is 01b.

One behavioural detail: when forwarding a remapped interrupt to the system bus, the "Trigger Mode Level" field in the bus request is **always set to asserted (1b)**.
**Citation given:** Intel VT-d Specification Rev 5.20 §9.9 — `[VT-d 5.20 §9.9]`; §5.1.3 (IRTE size and table limit) — `[VT-d 5.20 §5.1.3]`; §5.1.4.1 (Trigger Mode Level on forwarding) — `[VT-d 5.20 §5.1.4.1]`
**Contamination note:** none

---

### irta-reg-size-field
**Routed to:** `11-vtd-interrupt-remapping.md` (routing row "Interrupt remapping, IRTE, interrupt posting on the VT-d side")
**Actually answered from:** `references/11-vtd-interrupt-remapping.md` §11.3.1 "IRTA_REG (§11.4.10)", §11.3
**Answer:**
**Program S = 7 (0111b) in bits 3:0.**

The number of entries is **2^(X+1)** where X is the value in IRTA_REG.S. For 256 entries: 2^(X+1) = 256, so X + 1 = 8, so **X = 7**.

The full register, at offset **0B8h**:

| Bits | Field |
|---|---|
| 63:12 | **IRTA** — Interrupt Remapping Table Address |
| 11 | **EIME** — Extended Interrupt Mode Enable |
| 10:4 | Reserved |
| 3:0 | **S** — Size |

So the complete write is:

- **Bits 63:12 = IRTA**, the base of a **4 KB-aligned** interrupt remapping table. Hardware may ignore bits 63:HAW. At 128 bits per IRTE, 256 entries is 4 KB — exactly one page.
- **Bit 11 = EIME**, set according to whether you want extended (x2APIC) interrupt mode; this changes how the IRTE's DST field is interpreted.
- **Bits 10:4 = 0** (reserved).
- **Bits 3:0 = 7.**

**Two things that will bite you if you skip them.** First, **values written to IRTA_REG take effect only after software executes the Set Interrupt Remap Table Pointer command** — writing the register is not enough. Second, if the computed `interrupt_index` is **equal to or larger than** the number of IRTEs in the table, hardware treats the interrupt request as an error, so with S = 7 your valid index range is 0–255.

For reference, `interrupt_index` is computed as `address.handle` when `address.SHV` is 0, and `address.handle + data.subhandle` when SHV is 1.

One more note: IRTA_REG is treated as RsvdZ by implementations reporting Interrupt Remapping as not supported in the Extended Capability Register — check ECAP before writing.
**Citation given:** Intel VT-d Specification Rev 5.20 §11.4.10 — `[VT-d 5.20 §11.4.10]`; §5.1.3 (interrupt_index and the bounds error) — `[VT-d 5.20 §5.1.3]`
**Contamination note:** none

---

### vtd-fault-reason-codes
**Routed to:** `12-vtd-faults-bios-siov.md` (routing row "**VT-d faults and fault reason codes**, ACPI DMAR, SIOV, DMA-attack surface")
**Actually answered from:** `references/12-vtd-faults-bios-siov.md` §12.3 "Fault reason codes", §12.3.1 "Legacy-mode fault reasons"
**Answer:**
**Fault reason 2h is condition code LCT.2: the Present (P) field in the context-entry used to process the request is 0.** In plain terms — the device's requester-id resolved to a root-entry that pointed at a context-table, but the context-entry for that device is not present. The device has no domain assigned to it.

**Read the range before the code, though.** The numeric fault space is partitioned by mode and the ranges do not overlap:

- **1h–Eh** — legacy mode
- **20h–2Bh** — interrupt remapping
- **30h–34h** — root-table-address programming
- **38h–A5h** — scalable mode

So 2h is unambiguously legacy-mode. A decoder that skips this step will mislabel every scalable-mode fault as a legacy one.

**The neighbouring legacy-mode codes (the complete 1h–Eh table):**

| Reason | Condition code | Meaning |
|---|---|---|
| **1h** | LRT.2 | The Present (P) field in the **root-entry** used to process a request is 0 |
| **2h** | **LCT.2** | **The Present (P) field in the context-entry used to process a request is 0** |
| **3h** | LCT.4.x | Invalid programming of a context-entry: unsupported AW, unsupported TT, or error accessing the second-stage paging entry through SSPTPTR |
| **4h** | LGN.1.x | Address overflow in second-stage translation (above MGAW/AW, or above HAW for translated and pass-through requests) |
| **5h** | LGN.2 | Write or AtomicOp request encountered lack of **write** permission |
| **6h** | LGN.3 | Read or AtomicOp request encountered lack of **read** permission |
| **7h** | LSS.1 | Error accessing a second-stage paging entry referenced through a preceding second-stage paging entry |
| **8h** | LRT.1 | Error accessing a root-entry referenced through the RTA field of RTADDR_REG |
| **9h** | LCT.1 | Error accessing a context-entry referenced through the CTP field of a root-entry |
| **Ah** | LRT.3 | Non-zero reserved field in a root-entry with P Set |
| **Bh** | LCT.3 | Non-zero reserved field in a context-entry with P Set |
| **Ch** | LSS.2 | Non-zero reserved field in a second-stage paging entry with at least one of R or W Set |
| **Dh** | LCT.5 | The TT field in a present context-entry specifies blocking of translation requests and translated requests |
| **Eh** | LGN.4 | Output address after remapping falls in the interrupt address range FEEx_xxxxh |

The condition-code prefixes carve the space by structure: `L*` legacy mode, `S*` scalable mode, `RTA` root-table-address programming, `HPT` Host Permission Table.

**Diagnosing 2h in particular.** Note the pair it forms with its neighbours: **1h** means you never got as far as the context table (root-entry not present), **2h** means you reached the context table but the entry is empty, and **9h** means you could not even *read* the context-entry through the root-entry's CTP field (a memory access error, not an absent mapping). Read the **SID field (bits 79:64) of the Fault Recording Register** to find which device faulted; 2h almost always means a device is doing DMA before the driver or the IOMMU layer assigned it a domain, or after the domain was torn down.

One exemption worth knowing about on the neighbouring codes: for implementations reporting **ZLR** as 1 in the Capability Register, fault reason 6h does not apply to zero-length read requests to write-only mapped pages in second-stage translation.
**Citation given:** Intel VT-d Specification Rev 5.20 §7.1.3 (fault reasons) — `[VT-d 5.20 §7.1.3]`; §Ch.7 (range partitioning) — `[VT-d 5.20 Ch.7]`
**Contamination note:** none

---

### fault-recording-register-layout
**Routed to:** `12-vtd-faults-bios-siov.md` (routing row "**VT-d faults and fault reason codes**, ACPI DMAR, SIOV, DMA-attack surface")
**Actually answered from:** `references/12-vtd-faults-bios-siov.md` §12.2 "Primary fault logging", §12.2.1 "Fault Recording Register [n] (§11.4.7.6)"
**Answer:**
The three you asked for:

- **Fault reason — FR, bits 103:96** (8 bits)
- **Source-id — SID, bits 79:64** (16 bits)
- **Faulting address — FI (Fault Info), bits 63:12**; bits 11:0 are reserved, so the address is page-granular

The register is **128 bits**. Full layout:

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

Three things about this layout specifically:

- **The request type is split across two non-adjacent bits** — T1 at bit 126 and T2 at bit 92 — rather than sitting in one contiguous field. Reassemble them.
- **PV (bits 123:104) is 20 bits and is meaningful only when PP (bit 95) is Set.**
- **F (bit 127) is RW1C and sticky** — you clear a recorded fault by writing 1 to it.

**Finding the register in the first place.** There are N of them, N reported by **CAP_REG.NFR**, and their base offset floats: if the unit's register base address is X and **CAP_REG.FRO** reports Y, the first Fault Recording Register is at **X + (16 \* Y)**, and the registers are **16 bytes apart**. You cannot walk the fault ring without both fields.

**How to walk the ring.** Hardware keeps an internal index of the register that will take the next fault; it resets to zero when both TES and IES are Clear in GSTS_REG, increments on each recorded fault, and wraps from N-1 to 0. When PPF was Clear at the time of recording, hardware writes that index into the **FRI** field of FSTS_REG. Software is expected to process faults in **circular FIFO fashion starting from FRI until it finds a register with F Clear**, clearing each F as it goes.

**Two suppression behaviours that will make faults appear to go missing.** If the register at the internal index already has F Set, hardware sets **PFO (Primary Fault Overflow)** in FSTS_REG and **the new fault information is not recorded**. And hardware compares the faulting request's source-id against the SID field of every Fault Recording Register whose F is Set, and **does not record the fault if it finds a match** — so a spamming device produces one record, not thousands. To recover from overflow: process every pending fault, clear each F, then clear PFO by writing 1 to it.

One documentation warning: Rev 5.20 defines **exactly one** non-recoverable fault logging method, Primary Fault Logging. Material describing an "advanced fault logging" mode with a log buffer in memory is describing an older revision — the GCMD_REG bits that drove it (29 and 28) and CAP_REG bit 3 are now reserved or Deprecated.
**Citation given:** Intel VT-d Specification Rev 5.20 §11.4.7.6 (register layout) — `[VT-d 5.20 §11.4.7.6]`; §7.2.1 (primary fault logging protocol) — `[VT-d 5.20 §7.2.1]`; §11.4.2 (FRO and register spacing) — `[VT-d 5.20 §11.4.2]`
**Contamination note:** none

---

### tdx-leaf-numbers
**Routed to:** `13-tdx.md` §13.5 and §13.6 (routing row "TDX: **SEAMCALL/TDCALL leaves (§13.5, §13.6)**, TD lifecycle and legal call order, Secure EPT (§13.8)...")
**Actually answered from:** `references/13-tdx.md` §13.5 "Host-side interface: the SEAMCALL `TDH.*` leaves", §13.6 "Guest-side interface: the TDCALL `TDG.*` leaves", §13.8.3
**Answer:**
Three leaves, on two different interfaces:

| Operation | Leaf | Interface | Function |
|---|---|---|---|
| **Enter a TD** | **0** | SEAMCALL | **`TDH.VP.ENTER`** |
| **Host adds a private page dynamically** | **6** | SEAMCALL | **`TDH.MEM.PAGE.AUG`** |
| **Guest accepts one** | **6** | TDCALL | **`TDG.MEM.PAGE.ACCEPT`** |

Note the coincidence in the middle and bottom rows: both are leaf 6, but on **different interfaces** — SEAMCALL (host → TDX Module) versus TDCALL (guest → TDX Module). They are separate namespaces. `TDH.VP.ENTER` deliberately occupies leaf number **0** on the SEAMCALL side, as `TDG.VP.VMCALL` does on the TDCALL side.

**How the leaf number is passed.** For **SEAMCALL**, RAX bits 15:0 select the leaf number, bits 23:16 select the interface-function version number, bit 63 must be 0, and bits 62:24 are reserved and must be 0 unless a specific leaf defines them. For **TDCALL**, RAX bits 15:0 select the leaf, bits 23:16 the version, and bits 63:24 are reserved and must be 0; TDCALL is allowed only in 64-bit mode.

**The dynamic-page-addition sequence these fit into**, since the three leaves above are not independent — adding a private page after TD initialization is a **three-step** process:

1. The VMM extends Secure EPT with **`TDH.MEM.SEPT.ADD` (leaf 3)** if needed.
2. The VMM adds and maps a 4KB or 2MB page with **`TDH.MEM.PAGE.AUG` (leaf 6)**, leaving the Secure EPT entry **PENDING** and the page **unmeasured**.
3. The guest TD accepts it with **`TDG.MEM.PAGE.ACCEPT` (leaf 6)**, which **zeroes the content**.

Contrast `TDH.MEM.PAGE.AUG` with **`TDH.MEM.PAGE.ADD` (leaf 2)**, which adds a 4KB private page during **TD build time** and **contributes to MRTD** — AUG is the post-initialization, unmeasured counterpart.

**Why acceptance is mandatory.** It defeats an attack in which the host VMM removes arbitrary pages from a TD's GPA space with `TDH.MEM.PAGE.REMOVE` (leaf 29) and replaces them with zeroed pages. A guest TD must therefore track its own GPA allocation and **must never accept a page it already knows to be TD-owned**.
**Citation given:** Intel TDX Module ABI Specification §5.4.1 (SEAMCALL leaf numbers and RAX convention), §5.4.24 (`TDH.MEM.PAGE.AUG`), §5.4.81 (`TDH.VP.ENTER`), §5.5.1 (TDCALL convention), §5.5.3 (`TDG.MEM.PAGE.ACCEPT`) — `[TDX-ABI §5.4.1]`, `[TDX-ABI §5.4.24]`, `[TDX-ABI §5.4.81]`, `[TDX-ABI §5.5.1]`, `[TDX-ABI §5.5.3]`; Intel TDX Module Base Architecture Specification §9.10 / §9.10.1 and §2.11 — `[TDX-BASE §9.10]`, `[TDX-BASE §2.11]`
**Contamination note:** none

---

### tdx-gpaw-shared-bit
**Routed to:** `13-tdx.md` §13.8 (routing row "TDX: SEAMCALL/TDCALL leaves, TD lifecycle and legal call order, **Secure EPT (§13.8)**, attestation...")
**Actually answered from:** `references/13-tdx.md` §13.8.1 "The private/shared GPA split and where the SHARED bit sits"
**Answer:**
**The SHARED bit is at GPA bit GPAW-1** — and since **only GPAW values of 48 and 52 are possible**, in practice it is **bit 47 or bit 51**, nothing else.

GPAW is the effective GPA width in bits for the TD, and it is set by a **GPAW VM-execution control** which determines the position of the SHARED bit in the GPA. A separate **HKID execution control** defines the HKID used for private accesses.

**What the bit selects.** TDX ISA splits guest-physical addresses into private and shared. In SEAM non-root mode the controlling VMCS carries **two EPT pointers**:

- **SHARED == 0** → translated by the **legacy EPT pointer**, via the **Secure EPT**
- **SHARED == 1** → translated by a new **Shared EPT pointer**

The two hierarchies differ sharply in ownership. The TDX Module maintains **exactly one Secure EPT per TD**; its pages live in ordinary memory but are **encrypted and integrity-protected with the TD's ephemeral private key** and are **never mapped into the TD's GPA space**, so no software other than the module — and no device — can read them. (Any access to a Secure EPT page using a *shared* HKID can corrupt it and trigger an integrity-check failure leading to a machine-check fault.) The **Shared EPT**, by contrast, resides in host VMM memory, uses a shared HKID, and is managed directly by the host VMM exactly as with legacy VMX. The EPT level is the same for both.

At the end of a private translation the CPU **sets the HKID bits of the resulting HPA to the TD's assigned private HKID**.

**Do not confuse GPAW with the other width values.** GPAW is distinct from MAXPA and from **TDCS.VIRT_MAXPA**, and VIRT_MAXPA must not exceed the TD's configured GPAW. A TD can read its own GPAW (and ATTRIBUTES) at bootstrap via **`TDG.VP.INFO` (TDCALL leaf 1)** — which is the reliable way to locate the SHARED bit at runtime rather than assuming 47 or 51.
**Citation given:** Intel TDX Module Base Architecture Specification §9.1 (private/shared split, two EPT pointers) and §11.15.1 (GPAW, SHARED bit position, GPAW vs MAXPA) — `[TDX-BASE §9.1]`, `[TDX-BASE §11.15.1]`; Intel TDX ISA §3.2 (GPAW and HKID execution controls) — `[TDX-ISA §3.2]`; Intel TDX Module ABI Specification §3.4.5 — `[TDX-ABI §3.4.5]`
**Contamination note:** none
