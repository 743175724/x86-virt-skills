# 02. Virtual Machine Control Structures

> **中文速览**：VMCS 是 VMX 的中枢数据结构，本章是整个技能库最核心的一章。内容包括：VMCS region 的物理格式（revision identifier、bit 31 的 shadow-VMCS 标志、VMX-abort indicator）、六大逻辑区域、active/current 与 launched/clear 两套状态机（VMPTRLD / VMCLEAR / VMLAUNCH / VMRESUME 的约束由此而来）、**按 Vol.3D 附录 B 的 B.1–B.4 分组给出的字段编码表**，以及编码格式本身（bit 0 access type、bits 9:1 index、bits 11:10 type、bits 14:13 width）——掌握格式就能自行推导任一字段编码。控制位部分覆盖 pin-based / primary / secondary / tertiary 四组，并按 IA32_VMX_* 能力 MSR 与 IA32_VMX_BASIC bit 55 的 "true" 变体正确解释 default-1 保留位规则（旧资料把它讹传成"首批处理器只支持 bit 1/2/4 的 1-setting"，此处已重写）。最后是 guest-state / host-state 区域、exit/entry 控制字段、VM-exit information 字段，以及 §27.10 的 ordinary 与 shadow VMCS——只讲 VMCS 侧事实，嵌套场景下如何使用 shadowing 属 `14-nested-virtualization.md`。

**Maps to:** Intel SDM Vol.3C Ch.27 "Virtual Machine Control Structures" + Vol.3D App.B "Field Encoding in VMCS" (rev 092) [1][2]
**Owns:** VMCS region format · the six logical areas · the VMCS state model · every VMCS field encoding · pin-based / primary / secondary / tertiary VM-execution controls · the default-1 and reserved-bit rules · VM-exit and VM-entry control fields · VM-exit information field inventory · VM-function controls · ordinary versus shadow VMCS and the VMCS shadowing bitmap fields
**See also:** `01-vmx-intro.md` §1.6 (IA32_VMX_BASIC) · `03-nonroot-operation.md` (behaviour the controls select) · `04-vm-entry.md` (entry checks) · `05-vm-exit.md` (exit reasons and qualification semantics) · `06-address-translation.md` (EPTP, VPID, PML, SPP, HLAT semantics) · `07-apic-virtualization.md` (virtual-APIC page, posted interrupts) · `08-vmx-instructions.md` (VMREAD/VMWRITE/VMPTRLD/VMCLEAR semantics) · `14-nested-virtualization.md` (how a nesting VMM uses shadow VMCSs)

---

## 2.1 What a VMCS is, and how software touches it

A VMCS is a region of memory that holds everything the processor needs in order to run one virtual processor: the guest state to load on VM entry, the host state to load on VM-exit, the controls that decide what causes a VM-exit, and the fields in which the processor reports why a VM-exit happened. One VMCS corresponds to one virtual CPU; a multiprocessor guest has one VMCS per virtual processor.

- **Claim.** Software references a VMCS by its 64-bit physical address, called a VMCS pointer, which must be 4-KByte aligned and must not set any bit beyond the processor's physical-address width.  `[SDM 3C §27.1]` `[1]` `C:high` `V:durable`
- **Claim.** The internal layout of the VMCS data area is implementation-specific and is not architecturally documented (§27.2); software should therefore access VMCS fields only with VMREAD and VMWRITE and never with ordinary memory loads and stores, because a logical processor may hold some of an active VMCS on the processor rather than in the region (§27.11.1).  `[SDM 3C §27.2]` `[SDM 3C §27.11.1]` `[1]` `C:high` `V:durable`
- **Claim.** Every VMCS field is identified by a 32-bit encoding that VMREAD and VMWRITE take as an operand; the complete set of encodings is enumerated in the field-encoding appendix of Volume 3D.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** Software should allocate a VMCS region of the size reported in IA32_VMX_BASIC bits 44:32 and should maintain it with the memory type reported in IA32_VMX_BASIC bits 53:50 — see `01-vmx-intro.md` §1.6. (§27.2 gives the rule; the bit ranges are defined in the capability-MSR appendix.)  `[SDM 3C §27.2]` `[SDM 3D App.A.1]` `[1]` `[2]` `C:high` `V:durable`

The "no direct memory access" rule is the single most important architectural property of the VMCS. It is what lets Intel change the physical layout between processor generations while keeping the programming interface stable, and it is why the revision identifier check in VMPTRLD exists. It is also the sharpest structural contrast with AMD's VMCB, whose layout is published and accessed with ordinary loads and stores (see the cross-vendor comparison chapter, 18).

---

## 2.2 Format of the VMCS region

The first eight bytes of a VMCS region are architecturally defined; everything after them is implementation-specific data.

- **Claim.** Bytes 3:0 of a VMCS region hold the VMCS revision identifier in bits 30:0, and software must write the value reported in IA32_VMX_BASIC bits 30:0 into this field before using the region as a VMCS.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 31 of the first doubleword of a VMCS region is the shadow-VMCS indicator: 0 identifies an ordinary VMCS and 1 identifies a shadow VMCS.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** Bytes 7:4 of a VMCS region hold the VMX-abort indicator, which the processor writes with a non-zero value identifying the cause when a VMX abort occurs; the region's remaining bytes hold the VMCS data.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD fails if the revision identifier in the referenced region does not match the value reported in IA32_VMX_BASIC bits 30:0, and it fails on a region whose bit 31 is set if the processor does not support VMCS shadowing — see `14-nested-virtualization.md` for how a nesting VMM exploits this.  `[SDM 3C §27.2]` `[1]` `C:medium` `V:durable`
- **Claim.** The VMX-abort indicator is the one part of a VMCS region that software may touch with ordinary memory operations — §27.2 states that software may also write into this field, while §27.11.1 forbids ordinary access to the VMCS data that begin at byte 8; the causes of VMX aborts themselves are enumerated in §30.7.  `[SDM 3C §27.2]` `[SDM 3C §30.7]` `[1]` `C:medium` `V:durable`

---

## 2.3 Organization of VMCS data: the six logical areas

- **Claim.** VMCS data are organised into six logical groups: the guest-state area, the host-state area, the VM-execution control fields, the VM-exit control fields, the VM-entry control fields, and the VM-exit information fields.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** Processor state is saved into the guest-state area on VM exits and loaded from it on VM entries.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** Processor state is loaded from the host-state area on VM exits and is never saved into it by the processor, so the VMM is responsible for having written correct host state with VMWRITE before every VM entry.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-execution control fields govern processor behaviour in VMX non-root operation and determine in part the causes of VM exits.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-exit control fields govern VM exits and the VM-entry control fields govern VM entries, including event injection.  `[SDM 3C §27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-exit information fields are read-only: they receive information about the most recent VM-exit and cannot be written by VMWRITE on processors that do not support writing to them.  `[SDM 3C §27.3]` `[1]` `C:medium` `V:durable`

That the host state is never saved is a design choice, not an omission. The VMM chooses the moment of every VM entry and therefore already knows its own state; forcing a hardware save of host state on each entry would cost cycles on the hottest path in the system. The price is that a VMM that migrates a virtual CPU to another logical processor must rewrite the host-state area before entering, because the host RSP, the TR base and the GDTR/IDTR bases are all per-CPU.

---

## 2.4 The VMCS state model: active/current and launched/clear

Each VMCS carries two independent pieces of state, and confusing them is the most common cause of a VMM that mysteriously fails its second VM entry.

- **Claim.** A VMCS is either active or inactive on a given logical processor, and separately is either the current VMCS on that logical processor or not; each logical processor has at most one current VMCS, identified by its current-VMCS pointer.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** A VMCS also has a launch state that is either clear or launched, and this state is held in the VMCS itself rather than in a register software can query, so a VMM must track it.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** VMPTRLD makes the referenced VMCS both active and current on the executing logical processor; VMPTRST stores the current-VMCS pointer to memory.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMCLEAR makes the referenced VMCS inactive and not current, sets its launch state to clear, and ensures that VMCS data cached in the processor are written to the VMCS region in memory.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** VMLAUNCH fails unless the launch state of the current VMCS is clear, and it sets that state to launched on success; VMRESUME fails unless the launch state of the current VMCS is launched.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** Software must execute VMCLEAR for a VMCS before using it for VM entry for the first time, and must execute VMCLEAR on a logical processor before the VMCS is used on any other logical processor, because a processor may hold VMCS data in implementation-specific caches that VMCLEAR flushes.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** Intel states that VMRESUME is expected in general to have lower latency than VMLAUNCH, which is why a VMM uses VMLAUNCH only for the first entry after VMCLEAR.  `[SDM 3C §27.11.3]` `[1]` `C:medium` `V:durable`

The practical consequence for a scheduler: migrating a virtual CPU from one logical processor to another costs a VMCLEAR on the old processor and a VMPTRLD plus a full VMLAUNCH on the new one, and it invalidates whatever the old processor had cached of that VMCS. This is why hypervisors pin virtual CPUs or at least resist migrating them across NUMA nodes [106].

### 2.4.1 The state machine as code

```c
/* Once per virtual processor. size, mtype and rev_id come from
   IA32_VMX_BASIC; see 01-vmx-intro.md §1.6.                           */
void *vmcs = alloc_4k_aligned(size, mtype);
*(uint32_t *)vmcs = rev_id;          /* bit 31 = 0 -> ordinary VMCS     */
vcpu->pa       = virt_to_phys(vmcs);
vcpu->launched = false;              /* software's copy of launch state */

vmclear(vcpu->pa);                   /* inactive, not current, clear    */
vmptrld(vcpu->pa);                   /* active and current              */
/* ... VMWRITE the guest-state, host-state and control fields ...       */

/* Every VM entry, on the logical processor where the VMCS is current.  */
for (;;) {
        if (!vcpu->launched) {
                vmlaunch();          /* requires launch state == clear  */
                vcpu->launched = true;
        } else {
                vmresume();          /* requires launch state == launched */
        }
        handle_vm_exit(vcpu);        /* we only get here after a VM-exit */
}

/* Moving the virtual CPU to another logical processor.                 */
vmclear(vcpu->pa);                   /* on the OLD processor            */
vcpu->launched = false;              /* VMCLEAR reset the launch state  */
/* on the NEW processor: vmptrld(vcpu->pa), rewrite per-CPU host state,
   then VMLAUNCH again.                                                 */
```

Two lines carry the whole hazard. Forgetting `vcpu->launched = false` after a VMCLEAR produces a VMRESUME against a clear VMCS, which fails; forgetting the VMCLEAR itself produces a VMCS active on two logical processors, which is architecturally undefined and in practice corrupts the guest.

---

## 2.5 Field encodings

### 2.5.1 The encoding format

Every field encoding is a 32-bit value whose bit fields say what kind of field it is. Knowing the format means a reader can decode or derive an encoding without a table.

- **Claim.** In a VMCS field encoding, bit 0 is the access type: 0 selects a full access and 1 selects a high access, and a high access is defined only for 64-bit fields, where it addresses bits 63:32.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** In a VMCS field encoding, bits 9:1 are the field index, which distinguishes fields of the same type and width.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** In a VMCS field encoding, bits 11:10 are the field type: 0 is control, 1 is VM-exit information, 2 is guest state and 3 is host state.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** In a VMCS field encoding, bits 14:13 are the field width: 0 is 16-bit, 1 is 64-bit, 2 is 32-bit and 3 is natural-width.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** In a VMCS field encoding, bit 12 and bits 31:15 are reserved and must be 0, which is why every documented encoding fits in 15 bits.  `[SDM 3C §27.11.2]` `[SDM 3D App.A.9]` `[1]` `[2]` `C:medium` `V:durable`
- **Claim.** A natural-width field is 64 bits wide on processors supporting Intel 64 architecture and 32 bits wide otherwise, and VMREAD and VMWRITE access a 64-bit field in full outside IA-32e mode only through the pair of full and high encodings.  `[SDM 3D App.B]` `[2]` `C:medium` `V:durable`

Worked example, which every reader should be able to reproduce:

- **Claim.** Decoding the encoding 0x201A gives access type 0 (full), index 13, type 0 (control) and width 1 (64-bit), that is, the fourteenth 64-bit control field, which is the EPT pointer.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** Because the index occupies bits 9:1 and the access type occupies bit 0, consecutive fields of the same type and width are 2 apart, so a group of related fields such as the four EOI-exit bitmap entries occupies a contiguous run of even encodings.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`

Reading the format in the other direction gives a derivation rule that removes most of the need for a table at all:

```
encoding = (width << 13) | (type << 10) | (index << 1) | access

  width : 0 = 16-bit   1 = 64-bit   2 = 32-bit   3 = natural-width
  type  : 0 = control  1 = VM-exit information   2 = guest   3 = host
  index : position within that (width, type) group, counting from 0
  access: 0 = full     1 = high (64-bit fields only)
```

The four (width, type) prefixes a reader needs most often follow directly: `0x0000` is 16-bit control, `0x0800` 16-bit guest, `0x0C00` 16-bit host, `0x2000` 64-bit control, `0x2400` 64-bit read-only, `0x2800` 64-bit guest, `0x2C00` 64-bit host, `0x4000` 32-bit control, `0x4400` 32-bit read-only, `0x4800` 32-bit guest, `0x4C00` 32-bit host, `0x6000` natural-width control, `0x6400` natural-width read-only, `0x6800` natural-width guest and `0x6C00` natural-width host.

- **Claim.** The group base encodings implied by the format are `0x0000`, `0x0800` and `0x0C00` for 16-bit control, guest and host fields; `0x2000`, `0x2400`, `0x2800` and `0x2C00` for 64-bit control, read-only, guest and host fields; `0x4000`, `0x4400`, `0x4800` and `0x4C00` for the 32-bit groups; and `0x6000`, `0x6400`, `0x6800` and `0x6C00` for the natural-width groups.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** Decoding `0x6400` by the same rule gives width 3 (natural-width), type 1 (VM-exit information) and index 0, which is the exit qualification, and decoding `0x2800` gives width 1 (64-bit), type 2 (guest state) and index 0, which is the VMCS-link pointer.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`
- **Claim.** Guest-state and host-state fields of the same kind share an index within their group, which is why, for example, the guest and host natural-width CR0 fields are `0x6800` and `0x6C00`: the same index 0 with only the type digit differing.  `[SDM 3D App.B]` `[2]` `C:high` `V:durable`

The tables that follow are organised exactly as the field-encoding appendix is: B.1 16-bit fields, B.2 64-bit fields, B.3 32-bit fields, B.4 natural-width fields, each subdivided into control, read-only (where it exists), guest-state and host-state groups. Encodings are given as claims because they are the load-bearing numbers of this chapter; the ones this rebuild could not confirm are listed in §2.5.6 rather than guessed at.

### 2.5.2 B.1 — 16-bit fields

- **Claim.** 16-bit control fields: `0x0000` virtual-processor identifier (VPID) · `0x0002` posted-interrupt notification vector · `0x0004` EPTP index · `0x0006` HLAT prefix size · `0x0008` last PID-pointer index · `0x000A` virtual timer vector.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 16-bit guest-state selector fields run in the segment order ES, CS, SS, DS, FS, GS, LDTR, TR: `0x0800` ES · `0x0802` CS · `0x0804` SS · `0x0806` DS · `0x0808` FS · `0x080A` GS · `0x080C` LDTR · `0x080E` TR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** Three further 16-bit guest-state fields follow the selectors: `0x0810` guest interrupt status, `0x0812` PML index and `0x0814` guest UINV.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The guest-interrupt-status field at `0x0810` holds the requesting virtual interrupt (RVI) in bits 7:0 and the servicing virtual interrupt (SVI) in bits 15:8; its use is owned by `07-apic-virtualization.md`.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** 16-bit host-state selector fields omit LDTR: `0x0C00` ES · `0x0C02` CS · `0x0C04` SS · `0x0C06` DS · `0x0C08` FS · `0x0C0A` GS · `0x0C0C` TR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`

### 2.5.3 B.2 — 64-bit fields

- **Claim.** 64-bit control fields, pointers and bitmaps, part one: `0x2000` I/O bitmap A address · `0x2002` I/O bitmap B address · `0x2004` MSR bitmap address · `0x2006` VM-exit MSR-store address · `0x2008` VM-exit MSR-load address · `0x200A` VM-entry MSR-load address · `0x200C` executive-VMCS pointer · `0x200E` PML address · `0x2010` TSC offset.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 64-bit control fields, part two — the APIC-virtualization and EPT group: `0x2012` virtual-APIC address · `0x2014` APIC-access address · `0x2016` posted-interrupt descriptor address (see `07-apic-virtualization.md`) · `0x2018` VM-function controls · `0x201A` EPT pointer (EPTP).  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The four EOI-exit bitmap fields occupy `0x201C`, `0x201E`, `0x2020` and `0x2022` for EOI-exit bitmap 0 through EOI-exit bitmap 3.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 64-bit control fields, part three: `0x2024` EPTP-list address · `0x2026` VMREAD-bitmap address · `0x2028` VMWRITE-bitmap address · `0x202A` virtualization-exception information address · `0x202C` XSS-exiting bitmap · `0x202E` ENCLS-exiting bitmap.  `[SDM 3D App.B]` `[2]` `[106]` `C:medium` `V:durable`
- **Claim.** 64-bit control fields, part four: `0x2030` sub-page-permission table pointer · `0x2032` TSC multiplier · `0x2034` tertiary processor-based VM-execution controls.  `[SDM 3D App.B]` `[2]` `[106]` `C:medium` `V:durable`
- **Claim.** 64-bit control fields, part five — the encodings added after `0x2034`, with index `000011011B` (`0x2036`) unused: `0x2038` low PASID directory address · `0x203A` high PASID directory address · `0x203C` SEAM shared EPT pointer · `0x203E` PCONFIG-exiting bitmap · `0x2040` HLAT pointer (HLATP) · `0x2042` PID-pointer table address · `0x2044` secondary VM-exit controls · `0x204A` IA32_SPEC_CTRL mask · `0x204C` IA32_SPEC_CTRL shadow · `0x204E` guest deadline shadow · `0x2052` injected-event data.  `[SDM 3D App.B]` `[2]` `C:medium` `V:durable`
- **Claim.** The 64-bit read-only VM-exit information fields are `0x2400` guest-physical address (written on VM exits due to EPT violations and EPT misconfigurations), `0x2402` MSR data, and `0x2404` original-event data (FRED).  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 64-bit guest-state fields: `0x2800` VMCS-link pointer · `0x2802` guest IA32_DEBUGCTL · `0x2804` guest IA32_PAT · `0x2806` guest IA32_EFER · `0x2808` guest IA32_PERF_GLOBAL_CTRL.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The four guest PDPTE fields, used when the guest uses PAE paging, occupy `0x280A`, `0x280C`, `0x280E` and `0x2810` for PDPTE0 through PDPTE3.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The 64-bit guest-state list continues past the PDPTEs: `0x2812` guest IA32_BNDCFGS · `0x2814` guest IA32_RTIT_CTL · `0x2816` guest IA32_LBR_CTL · `0x2818` guest IA32_PKRS · `0x281A`–`0x2828` the eight guest FRED MSRs (FRED_CONFIG, RSP1–RSP3, STKLVLS, SSP1–SSP3) · `0x282E` guest IA32_SPEC_CTRL · `0x2830` guest deadline.  `[SDM 3D App.B]` `[2]` `[106]` `C:medium` `V:durable`
- **Claim.** 64-bit host-state fields: `0x2C00` host IA32_PAT · `0x2C02` host IA32_EFER · `0x2C04` host IA32_PERF_GLOBAL_CTRL · `0x2C06` host IA32_PKRS · `0x2C08`–`0x2C16` the eight host FRED MSRs · `0x2C1A` host IA32_SPEC_CTRL.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`

### 2.5.4 B.3 — 32-bit fields

- **Claim.** 32-bit control fields, the control words and their counts: `0x4000` pin-based VM-execution controls · `0x4002` primary processor-based VM-execution controls · `0x4004` exception bitmap · `0x4006` page-fault error-code mask · `0x4008` page-fault error-code match · `0x400A` CR3-target count.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 32-bit control fields, the exit and entry group: `0x400C` primary VM-exit controls · `0x400E` VM-exit MSR-store count · `0x4010` VM-exit MSR-load count · `0x4012` VM-entry controls · `0x4014` VM-entry MSR-load count · `0x4016` VM-entry interruption-information field · `0x4018` VM-entry exception error code · `0x401A` VM-entry instruction length.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 32-bit control fields, the remainder: `0x401C` TPR threshold · `0x401E` secondary processor-based VM-execution controls · `0x4020` PLE_Gap · `0x4022` PLE_Window · `0x4024` instruction-timeout control (see `[SDM 3C §27.6.24]`) · `0x4026` SEAM-guest KeyID. The name "notify window" does not appear in rev 092 — Intel renamed the feature.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 32-bit read-only VM-exit information fields: `0x4400` VM-instruction error (see `08-vmx-instructions.md`) · `0x4402` exit reason · `0x4404` VM-exit interruption information · `0x4406` VM-exit interruption error code · `0x4408` IDT-vectoring information field · `0x440A` IDT-vectoring error code · `0x440C` VM-exit instruction length · `0x440E` VM-exit instruction information.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 32-bit guest-state segment limits follow the same segment order as the selectors: `0x4800` ES · `0x4802` CS · `0x4804` SS · `0x4806` DS · `0x4808` FS · `0x480A` GS · `0x480C` LDTR · `0x480E` TR, followed by `0x4810` GDTR limit and `0x4812` IDTR limit.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** 32-bit guest-state access-rights fields follow the same order again: `0x4814` ES · `0x4816` CS · `0x4818` SS · `0x481A` DS · `0x481C` FS · `0x481E` GS · `0x4820` LDTR · `0x4822` TR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The remaining 32-bit guest-state fields are `0x4824` interruptibility state · `0x4826` activity state · `0x4828` SMBASE · `0x482A` guest IA32_SYSENTER_CS · `0x482E` VMX-preemption timer value.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The only 32-bit host-state field is `0x4C00`, host IA32_SYSENTER_CS.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`

### 2.5.5 B.4 — natural-width fields

- **Claim.** Natural-width control fields: `0x6000` CR0 guest/host mask · `0x6002` CR4 guest/host mask · `0x6004` CR0 read shadow · `0x6006` CR4 read shadow · `0x6008` CR3-target value 0 · `0x600A` CR3-target value 1 · `0x600C` CR3-target value 2 · `0x600E` CR3-target value 3.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** Natural-width read-only VM-exit information fields: `0x6400` exit qualification · `0x6402` I/O RCX · `0x6404` I/O RSI · `0x6406` I/O RDI · `0x6408` I/O RIP · `0x640A` guest-linear address.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** Natural-width guest-state control registers and segment bases: `0x6800` CR0 · `0x6802` CR3 · `0x6804` CR4 · then the bases in segment order, `0x6806` ES · `0x6808` CS · `0x680A` SS · `0x680C` DS · `0x680E` FS · `0x6810` GS · `0x6812` LDTR · `0x6814` TR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** The remaining natural-width guest-state fields are `0x6816` GDTR base · `0x6818` IDTR base · `0x681A` DR7 · `0x681C` RSP · `0x681E` RIP · `0x6820` RFLAGS · `0x6822` pending debug exceptions · `0x6824` guest IA32_SYSENTER_ESP · `0x6826` guest IA32_SYSENTER_EIP · `0x6828` guest IA32_S_CET · `0x682A` guest SSP · `0x682C` guest IA32_INTERRUPT_SSP_TABLE_ADDR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`
- **Claim.** Natural-width host-state fields: `0x6C00` CR0 · `0x6C02` CR3 · `0x6C04` CR4 · `0x6C06` FS base · `0x6C08` GS base · `0x6C0A` TR base · `0x6C0C` GDTR base · `0x6C0E` IDTR base · `0x6C10` host IA32_SYSENTER_ESP · `0x6C12` host IA32_SYSENTER_EIP · `0x6C14` RSP · `0x6C16` RIP · `0x6C18` host IA32_S_CET · `0x6C1A` host SSP · `0x6C1C` host IA32_INTERRUPT_SSP_TABLE_ADDR.  `[SDM 3D App.B]` `[2]` `[106]` `C:high` `V:durable`

### 2.5.6 Encodings deliberately omitted

This rebuild exists because wrong encodings are worse than missing ones. The following fields are known to exist but their encodings are **not** stated here, because they could not be confirmed against the field-encoding appendix in this pass. Read them from the appendix or from the kernel header before using them:

- the low-order "high" encodings (encoding + 1) of individual 64-bit fields, which follow mechanically from §2.5.1 but are not listed one by one;
- the index values that Appendix B leaves unused inside a group — `000011011B` in Table B-4 (`0x2036`), `000010110B` in Table B-10 (`0x482C`), and the gaps at `0x2046`/`0x2048`/`0x2050` — which are not encodings of any field;
- the bit layouts of individual control and status fields, which belong to the chapters that own the corresponding behaviour rather than to this encoding table.

The fields this list previously deferred — the secondary VM-exit controls (`0x2044`), the HLAT pointer (`0x2040`) and HLAT prefix size (`0x0006`), the PASID-translation directories (`0x2038`, `0x203A`), the instruction-timeout control (`0x4024`), the guest and host CET fields, and the last-PID-pointer index (`0x0008`) — are now stated in §2.5.2–§2.5.5.

---

## 2.6 The guest-state area

The guest-state area holds two kinds of state: fields that correspond directly to architectural registers, and fields that describe state with no register of its own.

### 2.6.1 Register state

- **Claim.** The guest-state register fields comprise CR0, CR3 and CR4; DR7; RSP, RIP and RFLAGS; for each of CS, SS, DS, ES, FS, GS, LDTR and TR the selector, base address, segment limit and access rights; the base address and limit of GDTR and IDTR; the MSRs IA32_DEBUGCTL, IA32_SYSENTER_CS, IA32_SYSENTER_ESP and IA32_SYSENTER_EIP, together with IA32_PERF_GLOBAL_CTRL, IA32_PAT, IA32_EFER, IA32_BNDCFGS, IA32_RTIT_CTL, IA32_LBR_CTL, IA32_S_CET, IA32_INTERRUPT_SSP_TABLE_ADDR, IA32_PKRS, the eight FRED MSRs and IA32_SPEC_CTRL on processors that support the corresponding load/save control; and the registers SSP and SMBASE.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The guest-state area holds the hidden, cached part of each segment register — base, limit and access rights — and not only the selector, because a descriptor cache may legitimately differ from the descriptor currently in memory and a VM entry must be able to restore that difference exactly.  `[SDM 3C §27.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The access-rights field of a segment is not the raw descriptor byte: it also carries an unusable bit indicating that the segment is not usable, which is how a null or unloaded segment is represented across a VMX transition.  `[SDM 3C §27.4.1]` `[1]` `C:medium` `V:durable`

### 2.6.2 Non-register state

- **Claim.** The guest-state area also holds non-register state: activity state, interruptibility state, pending debug exceptions, the VMCS-link pointer, the VMX-preemption timer value, the PDPTEs used with PAE paging, the guest interrupt status, the PML index, and — on processors supporting APIC-timer virtualization — the guest deadline.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** The activity state identifies the logical processor's activity: the defined states are active, HLT, shutdown and wait-for-SIPI.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** The interruptibility state records blocking that would otherwise be invisible: bit 0 blocking by STI, bit 1 blocking by MOV SS, bit 2 blocking by SMI and bit 3 blocking by NMI; bit 4 is not a blocking bit but records that the VM exit occurred in enclave mode, and bits 31:5 are reserved and must be 0 at VM entry.  `[SDM 3C §27.4.2]` `[1]` `C:high` `V:durable`
- **Claim.** When the virtual-NMIs pin-based control is 1, the blocking-by-NMI bit of the interruptibility state tracks blocking of virtual NMIs rather than of physical NMIs.  `[SDM 3C §27.6.1]` `[1]` `C:medium` `V:durable`
- **Claim.** The pending-debug-exceptions field carries debug exceptions that were recognised but not yet delivered when the VM-exit occurred, so that they can be delivered after the next VM entry.  `[SDM 3C §27.4.2]` `[1]` `C:medium` `V:durable`
- **Claim.** The VMCS-link pointer is a 64-bit guest-state field that must be either FFFFFFFF_FFFFFFFFH or the 4-KByte-aligned physical address of a VMCS region; when VMCS shadowing is in use it points at the shadow VMCS, as described in §2.11 — see `14-nested-virtualization.md` for the nested use. §27.4.2 defines the field; the 4-KByte-alignment and revision-identifier checks are performed at VM entry and specified in §29.3.1.5.  `[SDM 3C §27.4.2]` `[SDM 3C §29.3.1.5]` `[1]` `C:high` `V:durable`

Activity state is the field that makes a HLT in the guest cheap. Rather than spinning in the guest or forcing the VMM to emulate a halted CPU, the VM-exit records activity state HLT, and the next VM entry can restore it; the virtual processor is genuinely idle from the host scheduler's point of view.

---

## 2.7 The host-state area

- **Claim.** The host-state area contains CR0, CR3 and CR4; RSP and RIP; the selectors for CS, SS, DS, ES, FS, GS and TR; the base addresses of FS, GS, TR, GDTR and IDTR; IA32_SYSENTER_CS, IA32_SYSENTER_ESP and IA32_SYSENTER_EIP; and, on processors that support the corresponding "load" VM-exit control, IA32_PAT, IA32_EFER, IA32_PERF_GLOBAL_CTRL, IA32_S_CET, IA32_INTERRUPT_SSP_TABLE_ADDR, IA32_PKRS, the eight FRED MSRs, IA32_SPEC_CTRL and the register SSP.  `[SDM 3C §27.5]` `[1]` `C:high` `V:durable`
- **Claim.** The host-state area contains no LDTR selector field beyond what VM-exit processing defines, no segment limits or access rights, and no non-register state, because a VM-exit always leaves the logical processor in a known configuration: active, with no event blocking, and with host descriptors reloaded from the host GDT.  `[SDM 3C §27.5]` `[1]` `C:medium` `V:durable`
- **Claim.** In each of the host CS, SS, DS, ES, FS, GS and TR selector fields the RPL (bits 1:0) and the TI flag (bit 2) must be 0; the CS and TR selectors must not be 0000H, and the SS selector must not be 0000H if the "host address-space size" VM-exit control is 0. These constraints are checked at VM entry, not at VMWRITE time — see `04-vm-entry.md`.  `[SDM 3C §29.2.3]` `[1]` `C:medium` `V:durable`
- **Claim.** On a processor supporting Intel 64, the host address-space size VM-exit control determines whether the logical processor is in 64-bit mode after a VM-exit, and its value is loaded into CS.L, IA32_EFER.LME and IA32_EFER.LMA on every VM-exit.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`

A 64-bit VMM must set host address-space size to 1. Getting this wrong produces the classic symptom of a hypervisor that triple-faults immediately after its first VM-exit, because the processor drops to compatibility mode and the host RIP is no longer meaningful.

### 2.7.1 Guest area versus host area at a glance

| | Guest-state area | Host-state area |
|---|---|---|
| Written by the processor | Yes, on every VM-exit | Never |
| Read by the processor | On every VM entry | On every VM-exit |
| Segment selectors | CS, SS, DS, ES, FS, GS, LDTR, TR | CS, SS, DS, ES, FS, GS, TR |
| Segment bases | All eight segments | FS, GS and TR only |
| Segment limits and access rights | Present for all eight | Absent |
| GDTR and IDTR | Base and limit | Base only |
| Control registers | CR0, CR3, CR4 | CR0, CR3, CR4 |
| DR7 | Present | Absent |
| RIP, RSP, RFLAGS | All three | RIP and RSP only |
| Non-register state | Activity state, interruptibility state, pending debug exceptions, VMCS-link pointer, preemption timer, PDPTEs, interrupt status, PML index, guest deadline | None |
| Optional MSR fields | IA32_DEBUGCTL, SYSENTER trio, PAT, EFER, PERF_GLOBAL_CTRL, BNDCFGS, RTIT_CTL, LBR_CTL, S_CET, INTERRUPT_SSP_TABLE_ADDR, PKRS, the eight FRED MSRs, SPEC_CTRL | SYSENTER trio, PAT, EFER, PERF_GLOBAL_CTRL, S_CET, INTERRUPT_SSP_TABLE_ADDR, PKRS, the eight FRED MSRs, SPEC_CTRL |

The asymmetry is not an oversight. A guest can be interrupted in any state at all, including mid-way through a segment reload or with an NMI blocked, and a VM entry must restore that state bit for bit. A VM-exit, by contrast, always lands in a state the VMM chose in advance: active, unblocked, with host descriptors, in the mode the host address-space size control names. Everything the host area omits is state the architecture can reconstruct because the VMM controls it.

---

## 2.8 VM-execution control fields

The VM-execution controls are organised in four groups. Three of them are gated: the secondary controls exist only if the primary controls enable them, the tertiary controls likewise, and every group's usable bits are constrained by a capability MSR.

| Group | Width | Encoding | Gated by | Capability MSR | "True" variant |
|---|---|---|---|---|---|
| Pin-based | 32 | `0x4000` | — | IA32_VMX_PINBASED_CTLS 481H | IA32_VMX_TRUE_PINBASED_CTLS 48DH |
| Primary processor-based | 32 | `0x4002` | — | IA32_VMX_PROCBASED_CTLS 482H | IA32_VMX_TRUE_PROCBASED_CTLS 48EH |
| Secondary processor-based | 32 | `0x401E` | primary bit 31 | IA32_VMX_PROCBASED_CTLS2 48BH | none needed |
| Tertiary processor-based | 64 | `0x2034` | primary bit 17 | IA32_VMX_PROCBASED_CTLS3 492H | none needed |
| Primary VM-exit | 32 | `0x400C` | — | IA32_VMX_EXIT_CTLS 483H | IA32_VMX_TRUE_EXIT_CTLS 48FH |
| VM-entry | 32 | `0x4012` | — | IA32_VMX_ENTRY_CTLS 484H | IA32_VMX_TRUE_ENTRY_CTLS 490H |
| VM-function | 64 | `0x2018` | secondary bit 13 | IA32_VMX_VMFUNC 491H | none needed |

Every value in that table restates a claim made in the subsections below; the table exists so that a reader configuring a VMCS can see the whole control surface at once.

### 2.8.1 Pin-based VM-execution controls

- **Claim.** The pin-based VM-execution controls are a 32-bit field at encoding `0x4000` that governs the handling of asynchronous events.  `[SDM 3C §27.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** Pin-based control bit 0 is external-interrupt exiting: when it is 1, external interrupts cause VM exits and the value of RFLAGS.IF does not affect interrupt blocking.  `[SDM 3C §27.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** Pin-based control bit 3 is NMI exiting and bit 5 is virtual NMIs; bit 6 activates the VMX-preemption timer and bit 7 enables processing of posted interrupts.  `[SDM 3C §27.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** When the VMX-preemption timer is activated, it counts down in VMX non-root operation from the value in the VMX-preemption timer field and causes a VM-exit when it reaches zero, which gives a VMM a preemption source that does not depend on the guest's own timer programming.  `[SDM 3C §27.6.1]` `[1]` `C:high` `V:durable`
- **Claim.** Capability for the pin-based controls is reported by IA32_VMX_PINBASED_CTLS at 481H and, when IA32_VMX_BASIC bit 55 is 1, by IA32_VMX_TRUE_PINBASED_CTLS at 48DH.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 2.8.2 Primary processor-based VM-execution controls

- **Claim.** The primary processor-based VM-execution controls are a 32-bit field at encoding `0x4002` that governs the handling of synchronous events, mainly the execution of specific instructions.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** Primary control bits, part one: bit 2 interrupt-window exiting · bit 3 use TSC offsetting · bit 7 HLT exiting · bit 9 INVLPG exiting · bit 10 MWAIT exiting · bit 11 RDPMC exiting · bit 12 RDTSC exiting.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** Primary control bits, part two: bit 15 CR3-load exiting · bit 16 CR3-store exiting · bit 17 activate tertiary controls · bit 19 CR8-load exiting · bit 20 CR8-store exiting · bit 21 use TPR shadow · bit 22 NMI-window exiting · bit 23 MOV-DR exiting.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** Primary control bits, part three: bit 24 unconditional I/O exiting · bit 25 use I/O bitmaps · bit 27 monitor trap flag · bit 28 use MSR bitmaps · bit 29 MONITOR exiting · bit 30 PAUSE exiting · bit 31 activate secondary controls.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** If bit 31 of the primary processor-based controls is 0, VM entry and VMX non-root operation behave as if all of the secondary processor-based controls were 0.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** Capability for the primary processor-based controls is reported by IA32_VMX_PROCBASED_CTLS at 482H and, when IA32_VMX_BASIC bit 55 is 1, by IA32_VMX_TRUE_PROCBASED_CTLS at 48EH.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 2.8.3 Secondary processor-based VM-execution controls

- **Claim.** The secondary processor-based VM-execution controls are a 32-bit field at encoding `0x401E` that takes effect only when bit 31 of the primary controls is 1.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** Secondary control bits 0 to 9: bit 0 virtualize APIC accesses · bit 1 enable EPT · bit 2 descriptor-table exiting · bit 3 enable RDTSCP · bit 4 virtualize x2APIC mode · bit 5 enable VPID · bit 6 WBINVD exiting · bit 7 unrestricted guest · bit 8 APIC-register virtualization · bit 9 virtual-interrupt delivery.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** Secondary control bits 10 to 20: bit 10 PAUSE-loop exiting · bit 11 RDRAND exiting · bit 12 enable INVPCID · bit 13 enable VM functions · bit 14 VMCS shadowing (see §2.11 and `14-nested-virtualization.md`) · bit 15 enable ENCLS exiting · bit 16 RDSEED exiting · bit 17 enable PML · bit 18 EPT-violation #VE · bit 19 conceal VMX from Intel PT · bit 20 enable XSAVES/XRSTORS.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** Secondary control bits 21 to 27 and 30 to 31: bit 21 PASID translation · bit 22 mode-based execute control for EPT · bit 23 sub-page write permissions for EPT · bit 24 Intel PT uses guest-physical addresses · bit 25 use TSC scaling · bit 26 enable user wait and pause · bit 27 enable PCONFIG · bit 30 **VMM bus-lock detection** · bit 31 **instruction timeout** (a VM exit occurs if certain operations keep the processor from reaching an instruction boundary within the configured time). Bits 28 and 29 are not defined in Table 27-7 and are reserved to 0.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:medium` `V:durable`
- **Claim.** Capability for the secondary processor-based controls is reported by IA32_VMX_PROCBASED_CTLS2 at 48BH, which has no "true" variant because none of its bits is default-1.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** Table 27-7 defines every secondary control from bit 0 to bit 27 plus bits 30 and 31, so the group is fully enumerated above; the two that gate a companion bitmap are bit 15 enable ENCLS exiting (§27.6.16) and bit 27 enable PCONFIG (§27.6.17), and bit 21 PASID translation gates the PASID directories of §27.6.23.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`

### 2.8.4 Tertiary controls, and the default-1 / reserved-bit rule done properly

This is the part the old source material garbled, so it is worth stating carefully. There are two distinct mechanisms, and they behave differently.

**Mechanism one — allowed-0 and allowed-1 settings.** For the pin-based controls, primary processor-based controls, VM-exit controls and VM-entry controls, one 64-bit capability MSR describes both halves of the constraint.

- **Claim.** For IA32_VMX_PINBASED_CTLS, IA32_VMX_PROCBASED_CTLS, IA32_VMX_EXIT_CTLS and IA32_VMX_ENTRY_CTLS, bits 31:0 report the allowed-0 settings and bits 63:32 report the allowed-1 settings of the corresponding controls.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** A control may be 0 only if the corresponding bit in the allowed-0 half of its capability MSR is 0, and it may be 1 only if the corresponding bit in the allowed-1 half is 1; a VM entry that violates either constraint fails.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** A control whose allowed-0 bit is 1 is a default-1 control: on that processor it must be set to 1, and this is the mechanism — not any special property of particular bit numbers — that forces reserved bits of the control fields to specific values.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The default-1 class of the pin-based controls comprises bits 1, 2 and 4, and the default-1 class of the primary processor-based controls comprises bits 1, 4 through 6, 8, 13 through 16 and 26.  `[SDM 3D App.A]` `[2]` `[106]` `C:medium` `V:durable`
- **Claim.** The default-1 class of the primary VM-exit controls comprises bits 0–8, 10, 11, 13, 14, 16 and 17, and the default-1 class of the VM-entry controls comprises bits 0–8 and 12; software should still read the capability MSR rather than hard-code these lists.  `[SDM 3D App.A]` `[2]` `[106]` `C:medium` `V:durable`

**Mechanism two — the "true" capability MSRs.** Later processors needed to allow some default-1 controls to be cleared, most importantly CR3-load exiting and CR3-store exiting, which a VMM using EPT wants to turn off. Rather than change the meaning of the original MSRs, Intel added a parallel set.

- **Claim.** IA32_VMX_BASIC bit 55, when 1, indicates support for the "true" capability MSRs IA32_VMX_TRUE_PINBASED_CTLS at 48DH, IA32_VMX_TRUE_PROCBASED_CTLS at 48EH, IA32_VMX_TRUE_EXIT_CTLS at 48FH and IA32_VMX_TRUE_ENTRY_CTLS at 490H.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The "true" capability MSRs report the same allowed-1 settings as their non-true counterparts but may report allowed-0 settings of 0 for controls that are default-1 in the original MSRs, so software that wants to clear a default-1 control must consult the "true" MSR.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** Software that reads the original capability MSRs and treats their allowed-0 bits as mandatory will keep default-1 controls such as CR3-load exiting and CR3-store exiting enabled, which is correct but needlessly costly on a processor that supports EPT.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`
- **Claim.** The old statement that "the first VMX processors supported only the 1-setting of bits 1, 2 and 4" describes the default-1 class of the pin-based controls; it is not a property of early silicon that later silicon removed, but a reserved-bit encoding that the "true" capability MSRs later allowed software to query precisely.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

**Mechanism three — the newer control groups, which have no default-1 class at all.**

- **Claim.** The tertiary processor-based VM-execution controls are a 64-bit field at encoding `0x2034` that takes effect only when bit 17 of the primary processor-based controls is 1.  `[SDM 3C §27.6.2]` `[1]` `C:high` `V:durable`
- **Claim.** Capability for the tertiary processor-based controls is reported by IA32_VMX_PROCBASED_CTLS3 at 492H, which is a single 64-bit allowed-1 mask: a bit may be set only if the MSR reports it, and all unreported bits must be 0.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** The tertiary control bits defined in Table 27-8 are bit 0 LOADIWKEY exiting, bit 1 enable HLAT, bit 2 EPT paging-write control, bit 3 guest-paging verification, bit 4 IPI virtualization, bit 5 SEAM guest-physical address width, bit 6 enable MSR-list instructions, bit 7 virtualize IA32_SPEC_CTRL, bit 8 APIC-timer virtualization, bit 9 enable PBNDKB and bit 12 PEBS uses guest-physical addresses; bits 10, 11 and 63:13 are reserved to 0.  `[SDM 3C §27.6.2]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** The secondary VM-exit controls are a 64-bit field at encoding `0x2044`, used only when bit 31 of the primary VM-exit controls is 1, and reported by IA32_VMX_EXIT_CTLS2 at 493H — a single allowed-1 mask of the same shape as IA32_VMX_PROCBASED_CTLS3. Their defined bits are 0 save FRED, 1 load FRED, 2 load IA32_SPEC_CTRL and 3 prematurely busy shadow stack.  `[SDM 3D App.A]` `[SDM 3C §27.7.1]` `[1]` `[2]` `C:high` `V:durable`

The evolution is legible: the original four control fields were sized for the features of 2005 and carry a default-1 class as an artefact of forward-compatibility; every control group added since is a pure allowed-1 mask with no reserved-bit ceremony.

### 2.8.5 VM-function controls

- **Claim.** The VM-function controls are a 64-bit field at encoding `0x2018` that exists only when the enable-VM-functions secondary control (bit 13) is 1; bit 0 of the field enables EPTP switching.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`
- **Claim.** When EPTP switching is enabled, the EPTP-list address field at `0x2024` points at a 4-KByte-aligned list of 512 eight-byte EPTP values that guest software may select between with VMFUNC without causing a VM-exit; the address-translation consequences are owned by `06-address-translation.md`.  `[SDM 3C §27.6.14]` `[1]` `C:high` `V:durable`
- **Claim.** Capability for VM functions is reported by IA32_VMX_VMFUNC at 491H.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 2.8.6 Map of the remaining VM-execution control fields

Chapter 27 devotes a subsection to each remaining control field. The fields belong to this chapter; the behaviour they select is documented where indicated.

| Subsection | Fields | Behaviour owned by |
|---|---|---|
| §27.6.3 | Exception bitmap, page-fault error-code mask and match | `03-nonroot-operation.md` §3.4 |
| §27.6.4 | I/O bitmap A and B addresses | `03-nonroot-operation.md` §3.5 |
| §27.6.5 | TSC offset and TSC multiplier | `03-nonroot-operation.md` §3.9 |
| §27.6.6 | CR0 and CR4 guest/host masks and read shadows | `03-nonroot-operation.md` §3.7 |
| §27.6.7 | CR3-target count and CR3-target values 0–3 | `03-nonroot-operation.md` §3.8 |
| §27.6.8 | APIC-access address, virtual-APIC address, TPR threshold, EOI-exit bitmaps, guest interrupt status, posted-interrupt fields | `07-apic-virtualization.md` |
| §27.6.9 | MSR-bitmap address | `03-nonroot-operation.md` §3.6 |
| §27.6.10 | Executive-VMCS pointer | `09-smm-seam.md` |
| §27.6.11–§27.6.12 | EPT pointer, VPID | `06-address-translation.md` |
| §27.6.13 | PLE_Gap and PLE_Window | `03-nonroot-operation.md` §3.10 |
| §27.6.15 | VMREAD-bitmap and VMWRITE-bitmap addresses | §2.11 below and `14-nested-virtualization.md` |
| §27.6.16–§27.6.17 | ENCLS-exiting bitmap, PCONFIG exiting | `03-nonroot-operation.md` §3.3 |
| §27.6.18–§27.6.21 | PML address, virtualization-exception information, XSS-exiting bitmap, SPP table pointer | `06-address-translation.md` |
| §27.6.22–§27.6.23 | HLAT fields, PASID translation | `06-address-translation.md` |
| §27.6.24–§27.6.27 | Instruction timeout, IA32_SPEC_CTRL virtualization, SEAM non-root, APIC-timer virtualization | `09-smm-seam.md`, `13-tdx.md`, `07-apic-virtualization.md` |

---

## 2.9 VM-exit and VM-entry control fields

- **Claim.** The primary VM-exit controls are a 32-bit field at encoding `0x400C`, accompanied by the VM-exit MSR-store count at `0x400E`, the VM-exit MSR-load count at `0x4010`, and the corresponding 64-bit store and load addresses at `0x2006` and `0x2008`.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** VM-exit control bit 2 is save debug controls, bit 9 is host address-space size, bit 12 is load IA32_PERF_GLOBAL_CTRL, bit 15 is acknowledge interrupt on exit, bits 18 and 19 are save and load IA32_PAT, bits 20 and 21 are save and load IA32_EFER, and bit 22 is save VMX-preemption timer value.  `[SDM 3C §27.7]` `[1]` `[106]` `C:medium` `V:durable`
- **Claim.** When acknowledge interrupt on exit is 1, a VM-exit caused by an external interrupt acknowledges the interrupt controller, acquires the interrupt's vector, and stores it in the exiting-event identification field (the VM-exit interruption-information field in older versions of the manual), which is marked valid; when it is 0 the interrupt remains pending in the controller.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`
- **Claim.** The primary VM-exit controls above bit 22 are bit 23 clear IA32_BNDCFGS, bit 24 conceal VMX from Intel PT, bit 25 clear IA32_RTIT_CTL, bit 26 clear IA32_LBR_CTL, bit 27 clear UINV, bit 28 load CET state, bit 29 load IA32_PKRS, bit 30 save IA32_PERF_GLOBAL_CTL and bit 31 activate secondary controls.  `[SDM 3C §27.7.1]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** The VM-entry controls are a 32-bit field at encoding `0x4012`, accompanied by the VM-entry MSR-load count at `0x4014` and its 64-bit load address at `0x200A`.  `[SDM 3C §27.8]` `[1]` `C:high` `V:durable`
- **Claim.** VM-entry control bit 2 is load debug controls, bit 9 is IA-32e mode guest, bit **10** is entry to SMM and bit **11** is deactivate dual-monitor treatment — bits 3 and 4 are **not** the SMM controls; they fall inside the VM-entry default-1 class (bits 0–8 and 12), so writing them believing otherwise pokes a reserved bit that must be 1.  `[SDM 3C §27.8.1]` `[1]` `[106]` `C:high` `V:durable`
- **Claim.** The value of VM-entry control bit 9 (IA-32e mode guest) is loaded into IA32_EFER.LMA as part of VM entry, and into that MSR alone; it is the *VM-exit* control bit 9 (host address-space size) whose value is loaded into CS.L, IA32_EFER.LME **and** IA32_EFER.LMA on every VM exit.  `[SDM 3C §27.8.1]` `[SDM 3C §27.7.1]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-entry event-injection interface consists of the VM-entry interruption-information field at `0x4016` (rev 092: injected-event identification), the VM-entry exception error code at `0x4018` (rev 092: injected-event error code) and the VM-entry instruction length at `0x401A`, joined on FRED-capable processors by the 64-bit injected-event data field at `0x2052`.  `[SDM 3C §27.8.3]` `[SDM 3D App.B]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** In the VM-entry interruption-information field, bits 7:0 are the vector, bits 10:8 the interruption type, bit 11 the deliver-error-code flag and bit 31 the valid flag; the full type encoding and the delivery rules are owned by `04-vm-entry.md`.  `[SDM 3C §27.8]` `[1]` `C:high` `V:durable`
- **Claim.** Capability for the VM-exit and VM-entry controls is reported by IA32_VMX_EXIT_CTLS at 483H and IA32_VMX_ENTRY_CTLS at 484H, with "true" variants at 48FH and 490H when IA32_VMX_BASIC bit 55 is 1.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** Miscellaneous VMX implementation data, including the VMX-preemption timer's TSC divisor and the supported activity states, are reported by IA32_VMX_MISC at 485H, and the highest VMCS field index supported by the implementation is reported by IA32_VMX_VMCS_ENUM at 48AH.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

The MSR-load and MSR-store areas are the VMCS's extension mechanism for state the architecture does not give a dedicated field. Each is an array of 16-byte entries holding an MSR index and a value, and the counts in `0x400E`, `0x4010` and `0x4014` say how many entries the processor should process.

---

## 2.10 VM-exit information fields

These fields are written by the processor and read by the VMM. The chapter that owns their semantics is `05-vm-exit.md`; what belongs here is the inventory and the fact that they are read-only.

- **Claim.** The basic VM-exit information fields are the exit reason, the exit qualification, the guest-linear address and the guest-physical address; the exit reason and exit qualification are defined in §27.9.1 and populated as described in §30.2.1.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** The exit-reason field at `0x4402` reports the basic exit reason in its low 16 bits, and bit 31 of the field indicates a VM-exit that results from a failed VM entry rather than from an event in VMX non-root operation.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** The exit-qualification field at `0x6400` is a natural-width field whose format depends on the basic exit reason, so it must always be interpreted together with the exit reason.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** Information for vectored events is reported in the VM-exit interruption-information field and the VM-exit interruption error code, defined in §27.9.2.  `[SDM 3C §27.9.2]` `[1]` `C:high` `V:durable`
- **Claim.** Information about a VM-exit that occurred during delivery of an event through the guest IDT is reported in the IDT-vectoring information field and the IDT-vectoring error code, defined in §27.9.3.  `[SDM 3C §27.9.3]` `[1]` `C:high` `V:durable`
- **Claim.** Information about the instruction that caused a VM-exit is reported in the VM-exit instruction length and VM-exit instruction information fields, defined in §27.9.4, together with the I/O RCX, I/O RSI, I/O RDI and I/O RIP fields for string I/O.  `[SDM 3C §27.9.4]` `[1]` `C:high` `V:durable`
- **Claim.** The VM-instruction error field, defined in §27.9.5, records a numeric error code when a VMX instruction fails with VMfailValid; see `08-vmx-instructions.md` for the code list.  `[SDM 3C §27.9.5]` `[1]` `C:high` `V:durable`

The VM-exit instruction information field is the reason VMX emulation is cheap compared with earlier virtualization techniques: for most intercepted instructions the processor hands the VMM a decoded description of the operation, so the VMM does not have to fetch and disassemble guest instruction bytes.

---

## 2.11 Ordinary and shadow VMCSs

Chapter 27 distinguishes two types of VMCS. An ordinary VMCS may be the current VMCS for VM entry; a shadow VMCS exists so that VMREAD and VMWRITE executed in VMX non-root operation can be satisfied by hardware instead of by a VM-exit. Only the VMCS-side facts belong here. How a nesting VMM sets this up, and what it buys, is owned by `14-nested-virtualization.md`.

- **Claim.** A VMCS whose revision-identifier doubleword has bit 31 set to 1 is a shadow VMCS; a VMCS with bit 31 clear is an ordinary VMCS.  `[SDM 3C §27.10]` `[1]` `C:high` `V:durable`
- **Claim.** VM entry fails if the current VMCS is a shadow VMCS, so a shadow VMCS can be made current with VMPTRLD for initialisation by the VMM but can never be the VMCS a guest runs from.  `[SDM 3C §27.10]` `[1]` `C:medium` `V:durable`
- **Claim.** The shadow VMCS a guest's VMREAD and VMWRITE operate on is the VMCS referenced by the VMCS-link pointer of the current VMCS; see `14-nested-virtualization.md` for how this composes with the guest's own VMCS pointers.  `[SDM 3C §27.10]` `[1]` `C:medium` `V:durable`
- **Claim.** The VMCS shadowing feature is enabled by secondary processor-based control bit 14 and is configured by two fields, the VMREAD-bitmap address at `0x2026` and the VMWRITE-bitmap address at `0x2028`; see `14-nested-virtualization.md` for its use.  `[SDM 3C §27.6.15]` `[1]` `C:high` `V:durable`
- **Claim.** Each of the two bitmaps occupies a 4-KByte region aligned on a 4-KByte boundary, and a VMREAD or VMWRITE executed in VMX non-root operation consults the bit corresponding to the field encoding in the appropriate bitmap: a 1 causes a VM-exit and a 0 lets the access complete against the VMCS referenced by the VMCS-link pointer — see `14-nested-virtualization.md`. §27.6.15 defines the bitmaps; §28.1.3 states the exit rule.  `[SDM 3C §27.6.15]` `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** A 4-KByte bitmap holds 32,768 bits, exactly one for each encoding value below 8000H, which is why the bitmaps are 4 KBytes; the bit consulted is selected by bits 14:0 of the register source operand, and a VMREAD or VMWRITE whose operand sets any of bits 63:15 (bits 31:15 outside 64-bit mode) causes a VM exit without consulting the bitmap at all.  `[SDM 3C §27.6.15]` `[SDM 3C §28.1.3]` `[1]` `C:high` `V:durable`
- **Claim.** The processor may cache shadow-VMCS data, so software must VMCLEAR a shadow VMCS after modifying it through ordinary memory writes and before relying on the processor to read it — the same coherence rule that applies to any VMCS.  `[SDM 3C §27.11]` `[1]` `C:medium` `V:durable`

---

## 2.12 Software use of the VMCS

Section 27.11 collects the rules a VMM must follow when it manages VMCS regions; several of them are the difference between a hypervisor that works and one that fails only under migration or heavy load.

- **Claim.** Software must never make the same VMCS active on more than one logical processor at a time; the VMCS must be made inactive with VMCLEAR on the first logical processor before it is used on a second.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** Software must not modify a VMCS region with ordinary memory writes while it is active on any logical processor, because the processor may hold parts of the VMCS in implementation-specific storage that such writes would not update.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** VMREAD and VMWRITE operate on the current VMCS; if there is no current VMCS the instructions fail with VMfailInvalid, which is the failure a VMM sees when it forgets the VMPTRLD.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** A VMM may keep several VMCS regions and switch between them with VMPTRLD, which is how one logical processor time-shares several virtual processors.  `[SDM 3C §27.11]` `[1]` `C:high` `V:durable`
- **Claim.** IA32_VMX_VMCS_ENUM at 48AH reports the highest index value used for any VMCS field on the implementation, which lets software enumerate encodings without hard-coding a table.  `[SDM 3D App.A]` `[2]` `C:medium` `V:durable`

---

## 2.13 Reading this chapter against a real machine

The fastest way to validate any of the above on hardware is to dump the capability MSRs rather than trust a table. The sequence is: read IA32_VMX_BASIC to get the revision identifier, the region size, the memory type and bit 55; then read either the original or the "true" control-capability MSRs according to bit 55; then read IA32_VMX_PROCBASED_CTLS2 and, if primary bit 17 can be set, IA32_VMX_PROCBASED_CTLS3. Every control bit this chapter lists should appear as settable or not settable in that dump, and any disagreement between this chapter and the dump should be resolved in favour of the hardware and recorded in `errata.md`.
