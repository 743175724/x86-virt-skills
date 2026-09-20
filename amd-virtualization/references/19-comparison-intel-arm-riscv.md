# 19. AMD versus Intel, ARM and RISC-V

> **中文速览**：本章给 AMD 侧的对照视角，与 `intel-vt/18-comparison-amd-arm-riscv.md` 互为镜像。**规则是：哪家的规范定义了这条事实，就归哪个技能**——本章陈述 AMD 侧并链接过去，不复述 Intel 侧的位级细节；反过来，Intel 事实一律锚到 Intel 文档，**永远不锚 APM**。覆盖 VMCB vs VMCS、NPT vs EPT、ASID vs PCID+VPID、AVIC vs APICv、GIF（Intel 无对应物）、**AMD 无 VMCS shadowing 对应物**（owner 是 `15-nested-virtualization.md`）、AMD 的 IOMMU vs VT-d、SEV-SNP vs TDX 的信任模型、ARM 两阶段翻译与 RISC-V H 扩展的对位。两处术语碰撞必须消歧：`SNP`（AMD 的 Secure Nested Paging vs VT-d 页表项里的 Snoop 位）与 `RVI`（AMD 营销名 Rapid Virtualization Indexing vs Intel APICv 的 Requesting Virtual Interrupt）。**本章按 lint 豁免使用 Intel 自己的术语描述 Intel**（"VM exit"、"host-physical address"），描述 AMD 时仍用 `#VMEXIT` 与 sPA。市场份额、GA 日期、产品状态见 `90-dated-landscape.md`。

**Maps to:** Intel SDM Vol.3C and Vol.3A / Intel VT-d specification / Arm Architecture Reference Manual for A-profile, the GIC and SMMU architecture specifications / RISC-V privileged architecture "H" extension — all Tier-2 here and all primary for their own side [49][50][51][52][580]
**Owns:** the AMD-side view of each correspondence, the statement of what has no counterpart on the other side, and the two terminology collisions
**Scope:** comparison; marks which features are server-platform-only on each side. Exempt from this skill's `VM Exit` and `HPA` terminology rules, because Intel's vocabulary is the correct vocabulary for Intel.
**See also:** `intel-vt/18-comparison-amd-arm-riscv.md` (the mirror) · `15-nested-virtualization.md` (owns the nesting story) · `02-vmcb.md` · `06-nested-paging.md` · `07-virtual-interrupts-avic.md` · `08-iommu-architecture.md` · `90-dated-landscape.md`

---

## 19.1 How to read this chapter

Three rules govern every line below.

**Each side is anchored to its own vendor.** AMD statements carry APM, IOMMU-specification or
SEV-document anchors; Intel statements carry SDM or VT-d anchors; ARM and RISC-V statements
carry theirs. An Intel fact anchored to the APM would resolve to a real section about an
unrelated subject, which is the single most common defect in cross-vendor material.

**Depth lives with the owner.** This chapter states the correspondence and the consequence. The
AMD bit-level detail is in the chapter that owns it here; the Intel bit-level detail is in the
sibling `intel-vt` skill. Where the two skills state the same fact they are written to agree,
and a contradiction between them is a defect in whichever one is wrong, not a difference of
opinion.

**Anything with a date leaves.** Which generation shipped what, which hypervisor enabled what by
default, and who was first are all product history and belong to `90-dated-landscape.md`.

- **Claim.** This chapter sits outside this skill's architectural band (chapters 01–14), which is deliberate: its primary sources are other vendors' specifications, and a rule requiring an AMD Tier-1 anchor on every claim could only be satisfied here by citing the APM for things the APM does not discuss.  `[no-spec]` `[49]` `C:high` `V:durable`

### 19.1.1 Procedure for answering a cross-vendor question

1. Decide which side of the question is AMD's. Anchor that side to an AMD document and name the chapter here that owns it; anchor the other side to that vendor's own specification and point at the sibling skill.
2. Prefer a structural answer to a feature-list answer. "AMD has no VMCS shadowing" is useless without the reason, which is §19.7.
3. Check `errata.md` before repeating a widely circulated comparison. Two of the most common — that Intel has no address-space identifiers, and that Hyper-V nested virtualization is Intel-only — are wrong, and the second is corrected in `16-windows-platform.md`.
4. Keep the confidential-computing halves separate: AMD mechanisms in `12-sev.md`, `13-sev-es-ghcb.md` and `14-sev-snp.md`, Intel mechanisms in the sibling skill, and nothing but the trust-model correspondence here.
5. Send anything whose answer is a date, a version or a market position to `90-dated-landscape.md`, including "who was first" questions.

---

## 19.2 Control structures: VMCB and VMCS

Both architectures add a mode pair — AMD's host and guest mode, Intel's VMX root and non-root
operation — and a memory-resident structure describing the guest. They diverge on how software
reaches that structure, and everything else follows.

- **Claim.** AMD's VMCB is an ordinary 4-Kbyte-aligned memory page whose field offsets are architecturally published, so a hypervisor reads and writes it with ordinary loads and stores and needs no dedicated accessor instruction; the layout is owned by `02-vmcb.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's VMCS has an implementation-specific layout and is reachable only through VMREAD and VMWRITE using architectural field encodings.  `[SDM 3C §27.2]` `[49]` `C:high` `V:durable`
- **Claim.** The trade is symmetric and neither side is strictly better: Intel can rearrange the VMCS between generations at the cost of one privileged instruction per field access, while AMD gets bulk access at the cost of a layout that can only be extended, never rearranged — which is why AMD's newer controls appear in previously reserved bits and in software-reserved regions rather than in relocated fields.  `[APM2 App.B]` `[SDM 3C §27.2]` `[1][49]` `C:high` `V:durable`

### 19.2.1 Host state

- **Claim.** AMD keeps host state outside the control structure: `VM_HSAVE_PA` (C001_0117h) points at a 4-Kbyte block that `VMRUN` saves host state into and `#VMEXIT` reloads from, and the block is architecturally opaque — an implementation may keep part or all of that state on-chip, and software "must not rely on the format or contents of the host state save area"; the flow is owned by `04-world-switch.md`.  `[APM2 §15.5.1]` `[APM2 §15.30.4]` `[1]` `C:high` `V:durable`
- **Claim.** Intel has no external host-state area: the VMCS contains a host-state area that the processor loads on every VM exit and never saves to.  `[SDM 3C §27.5]` `[49]` `C:high` `V:durable`
- **Claim.** The consequence is visible in nested designs: an AMD outer hypervisor must emulate a second, opaque save area for its guest hypervisor, whereas an Intel one deals with a field of a structure it already manages; see `15-nested-virtualization.md`.  `[APM2 §15.5.1]` `[SDM 3C §27.5]` `[1][49]` `C:medium` `V:durable`

### 19.2.2 Caching

- **Claim.** AMD exposes its caching contract to software: the VMCB Clean field tells the processor which register groups it may reload from an internal cache, and the identity used to decide whether a cached copy belongs to a guest is the VMCB's physical address — explicitly not the ASID. Set bits are a hint an implementation may ignore; cleared bits are always honoured. The per-bit meanings are owned by `02-vmcb.md`.  `[APM2 §15.15]` `[APM2 §15.15.1]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's equivalent optimisation is invisible: the processor may keep a working copy of the current VMCS, VMCLEAR forces it to memory, and no per-field validity contract is exposed to software.  `[SDM 3C §27.1]` `[49]` `C:high` `V:durable`

### 19.2.3 The structure table

| Dimension | AMD VMCB | Intel VMCS |
|---|---|---|
| Layout | published by byte offset | implementation-specific; encodings are architectural |
| Access | ordinary loads and stores | VMREAD / VMWRITE only |
| Host state | outside, at `VM_HSAVE_PA`, opaque | host-state area inside the VMCS |
| Activation | none; `VMRUN` takes the address in rAX | VMPTRLD / VMCLEAR establish a current VMCS |
| Entry | `VMRUN` | VMLAUNCH (clear) / VMRESUME (launched) |
| Extra state | `VMLOAD` / `VMSAVE` move a defined set | entry/exit control fields and MSR lists |
| Caching contract | clean bits, visible to software | invisible; VMCLEAR flushes |
| Exit reporting | `EXITCODE` plus `EXITINFO1`/`EXITINFO2` | exit reason plus exit qualification |

- **Claim.** The table's AMD column is sourced from the VMCB layout appendix and the VMRUN and #VMEXIT sections; the exit-reporting fields and their encodings are owned by `05-exit-decoding.md` and the entry and exit flows by `04-world-switch.md`.  `[APM2 App.B]` `[APM2 §15.5.1]` `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** The table's Intel column is sourced from the VMCS and VM-exit chapters of the SDM; the per-field depth belongs to the `intel-vt` skill.  `[SDM 3C §27.2]` `[SDM 3C §27.9.1]` `[49]` `C:high` `V:durable`

### 19.2.4 Feature discovery

- **Claim.** AMD reports SVM's presence in one CPUID feature bit and then reports the SVM revision, the number of ASIDs the processor implements and a flat list of discrete feature bits — nested paging, next-RIP save, VMCB clean bits, decode assists, flush-by-ASID, AVIC, x2AVIC, virtualized VMLOAD/VMSAVE, virtual GIF and the rest — in `Fn8000_000A`, whose EBX carries the ASID count and whose EDX carries the feature bits. Software tests a bit and then writes the corresponding VMCB field directly; the probing discipline is owned by `01-svm-intro.md`.  `[APM3 App.E]` `[APM2 §15.5.1]` `[1][2]` `C:high` `V:durable`
- **Claim.** Intel splits discovery in two: a CPUID bit reports that VMX exists, and a family of capability MSRs then reports, for every execution, exit and entry control, which settings the processor allows. An Intel hypervisor must compute each control field against allowed-0 and allowed-1 masks before writing it; an AMD hypervisor does not.  `[SDM 3D App.A]` `[586]` `C:high` `V:durable`
- **Claim.** That difference is why AMD feature questions reduce to "is the bit set" while Intel ones reduce to "is the setting permitted", and why an AMD hypervisor's start-up path is shorter but its forward-compatibility story is weaker: a control AMD adds in a previously reserved VMCB bit is invisible to older software, whereas Intel's masks make an unsupported setting fail loudly at entry.  `[APM3 App.E]` `[SDM 3D App.A]` `[2][586]` `C:medium` `V:durable`

### 19.2.5 Instruction correspondence

| Purpose | AMD | Intel |
|---|---|---|
| Enable the feature | set EFER.SVME | set CR4.VMXE, then VMXON |
| Name the control structure | the `VMRUN` operand in rAX | VMPTRLD / VMCLEAR / VMPTRST |
| Access a field | ordinary load / store | VMREAD / VMWRITE |
| Enter the guest | `VMRUN` | VMLAUNCH / VMRESUME |
| Guest-to-hypervisor call | `VMMCALL` | VMCALL |
| Move extra processor state | `VMLOAD` / `VMSAVE` | entry and exit control fields |
| Invalidate second-level translations | `TLB_CONTROL`, flush by ASID | INVEPT |
| Invalidate tagged linear translations | `INVLPGA` | INVVPID |
| Block all interrupts including NMI | `CLGI` / `STGI` | no single instruction |
| Confidential-guest call | `VMGEXIT` | a module call; see the `intel-vt` skill |

- **Claim.** The row that has no Intel entry is the interrupt-blocking row, and it is an architectural absence rather than an omission in this table: AMD's global interrupt flag has no Intel counterpart at all, which §19.6 develops.  `[APM2 §15.17]` `[SDM 3C §27.6]` `[1][49]` `C:high` `V:durable`
- **Claim.** The invalidation rows differ in kind, not only in spelling: AMD expresses the bulk operation as **data** — a field of the VMCB evaluated at `VMRUN` — while Intel expresses it as an **instruction**; the AMD side is owned by `06-nested-paging.md`.  `[APM2 App.B]` `[SDM 3C Ch.33]` `[1][49]` `C:high` `V:durable`

---

## 19.3 Second-level translation: NPT and EPT

- **Claim.** AMD's second-level translation is nested paging, switched on by `NP_ENABLE` in the VMCB and rooted at nCR3, which holds the system physical address of the nested page tables; the second stage uses the same paging mode the hypervisor was in when it executed `VMRUN`, and the structures are owned by `06-nested-paging.md`.  `[APM2 §15.25.3]` `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's second-level translation is EPT, rooted at the extended-page-table pointer in the VMCS.  `[SDM 3C §27.6.11]` `[49]` `C:high` `V:durable`
- **Claim.** The formats differ in kind. AMD's second stage runs in "the same paging mode as the VMM used when it executed the most recent VMRUN", so it is ordinary x86 paging with ordinary x86 permission semantics — a page is writable only if writable at both levels, executable only if executable at both, and must be marked user at the nested level for the guest to reach it at all. Intel's EPT entries use a distinct format with their own read, write and execute bits and their own memory-type encoding; the AMD entry format is owned by `06-nested-paging.md`.  `[APM2 §15.25.3]` `[APM2 §15.25.7]` `[SDM 3C Ch.31]` `[1][49]` `C:high` `V:durable`
- **Claim.** Fault reporting differs correspondingly: Intel splits a failed second-stage translation into two exit reasons, EPT violation and EPT misconfiguration, whereas AMD reports one exit code, `VMEXIT_NPF` (400h), and carries the distinction in the payload, with the faulting guest-physical address in the second information field; the AMD payload bits are owned by `05-exit-decoding.md`.  `[APM2 App.C]` `[SDM 3C Ch.31]` `[1][49]` `C:high` `V:durable`
- **Claim.** Fault *ordering* is specified on the AMD side and is worth stating because it is the part that ports badly: the walk visits the guest page-table entries through the nested tables first — a nested fault there is `#VMEXIT(NPF)` — then takes guest-level faults as `#PF` inside the guest, then translates the final guest-physical address, where a fault is again `#VMEXIT(NPF)`; the sequence is owned by `06-nested-paging.md`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Memory-type composition is where the two designs diverge most quietly: AMD combines the guest's PAT with the host's MTRRs and PAT according to §15.25.8, while Intel carries the type in the EPT entry itself. Code that assumes the guest's PAT alone decides the effective type is wrong on both, but wrong for different reasons; the AMD rules are owned by `06-nested-paging.md`.  `[APM2 §15.25.8]` `[SDM 3C Ch.31]` `[1][49]` `C:medium` `V:durable`
- **Claim.** The two-dimensional walk cost is identical on both architectures and is a property of the geometry, not of either vendor: with four-level guest paging over four-level second-level paging the worst case is **24 memory references**, `nm + n + m`. **Neither the APM nor the SDM states the figure** — the primary sources are AMD's nested-paging white paper and the ASPLOS paper behind it — and the derivation is owned by `06-nested-paging.md`, the measurements by `18-performance.md`.  `[NP-WP §4.2.2]` `[15][56]` `C:high` `V:durable`

---

## 19.4 Address space identifiers: ASID, PCID and VPID

This section exists mainly to kill one claim.

- **Claim.** **"Intel has no ASID mechanism" is false**, and so is its mirror image, "AMD folds process and VM tagging into a single ASID namespace". Both architectures run two tag namespaces: a guest-managed process tag and a hypervisor-managed VM tag. The sibling chapter states the same correction from the Intel side.  `[APM2 §5.5.1]` `[SDM 3C §27.6.12]` `[1][49]` `C:high` `V:durable`
- **Claim.** AMD's VM-level tag is the guest ASID, a 32-bit field at VMCB offset 058h; ASID 0 is reserved for the host, `VMRUN` with a guest ASID of zero ends in `#VMEXIT(VMEXIT_INVALID)`, and the number of ASIDs an implementation provides is returned in EBX by CPUID `Fn8000_000A` — so the field width is not the usable range. Allocation, exhaustion and reuse are owned by `06-nested-paging.md`.  `[APM2 App.B]` `[APM2 §15.25.1]` `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's VM-level tag is the VPID, a 16-bit VMCS field in which value 0000H is reserved for VMX root operation, so a hypervisor must assign non-zero VPIDs to guests.  `[SDM 3C §27.6.12]` `[49]` `C:high` `V:durable`
- **Claim.** The process-level tag is PCID on both: AMD defines it in the same terms Intel does — CR4.PCIDE (bit 17) enables it, the current 12-bit PCID is CR3[11:0], and `INVPCID` manages the tagged entries.  `[APM2 §5.5.1]` `[SDM 3A Ch.5]` `[1][580]` `C:high` `V:durable`
- **Claim.** Under SVM the scope of "global" narrows: with SVM enabled, global page-table entries are global only within an ASID, not across ASIDs, and the current ASID is 0 whenever the processor is not inside a guest context; the TLB rules are owned by `06-nested-paging.md`.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`
- **Claim.** Invalidation exposes a real asymmetry rather than a naming difference. AMD's `INVLPGA` takes a linear address in rAX and an ASID in ECX, always interprets the input as a *guest virtual* address, and AMD states it "does not provide a means to invalidate a nested translation by guest physical address" — so there is no AMD instruction with INVEPT's job; that job is done by the `TLB_CONTROL` field of the VMCB, evaluated at `VMRUN`. Both are owned by `06-nested-paging.md`.  `[APM2 §15.16.2]` `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's two invalidation instructions, INVEPT for second-level-derived entries and INVVPID for VPID-tagged linear translations, cover both jobs with instructions and are owned by the `intel-vt` skill.  `[SDM 3C Ch.33]` `[49]` `C:high` `V:durable`

| Role | AMD | Intel | ARM | RISC-V |
|---|---|---|---|---|
| VM tag | ASID, 32-bit VMCB field, 0 reserved | VPID, 16-bit VMCS field, 0 reserved | VMID in VTTBR_EL2 | VMID in hgatp |
| Process tag | PCID | PCID | ASID | ASID in satp/vsatp |
| Bulk second-level invalidate | `TLB_CONTROL` (data) | INVEPT (instruction) | TLBI by VMID | HFENCE.GVMA |
| Single-page invalidate | `INVLPGA` (guest-virtual) | INVVPID | TLBI VA | HFENCE.VVMA |

- **Claim.** The table's ARM and RISC-V columns come from those architectures' own specifications and are developed in §19.10; ARM's VMID is 8 bits in the base architecture and 16 when the wider-VMID feature is implemented and enabled, and RISC-V leaves the VMID width unspecified with an architectural maximum of 7 bits for Sv32x4 and 14 for the wider schemes.  `[ARM DDI 0487]` `[RISC-V Priv H-ext]` `[51][52]` `C:medium` `V:durable`

---

## 19.5 Interrupt virtualization: AVIC and APICv

- **Claim.** AMD's accelerator is AVIC: a vAPIC backing page holding the virtual APIC state, a Physical APIC ID Table and a Logical APIC ID Table addressed from the VMCB, and a Doorbell Register at MSR C001_011Bh that another core or the IOMMU writes to signal a running target. All of it is owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.29]` `[APM2 §15.29.8]` `[1]` `C:high` `V:durable`
- **Claim.** Intel's counterpart is the APIC-virtualization family: a virtual-APIC page, APIC-register virtualization, virtual-interrupt delivery and posted-interrupt processing.  `[SDM 3C Ch.32]` `[49]` `C:high` `V:durable`
- **Claim.** AMD also virtualizes legacy injection without AVIC, through a field packed into VMCB offset 060h that carries the virtual TPR, a pending-virtual-interrupt flag, its priority and vector, the TPR-ignore control and the interrupt-masking control — the mechanism a hypervisor uses when AVIC is not in play, and the one Intel expresses through separate VMCS fields; the bit assignments are owned by `07-virtual-interrupts-avic.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** Both designs have the same fallback shape and both report it as an exit: when AVIC cannot complete an IPI — typically because the target virtual processor is not running — it takes `AVIC_INCOMPLETE_IPI` (401h), and an access to a vAPIC register the hardware does not accelerate takes `AVIC_NOACCEL` (402h); Intel's analogue is an APIC-write exit for what it cannot virtualize. The AMD exit payloads are owned by `05-exit-decoding.md`.  `[APM2 App.C]` `[SDM 3C Ch.32]` `[1][49]` `C:high` `V:durable`
- **Claim.** The device-interrupt halves also correspond but are not interchangeable: AMD's IOMMU records interrupts that arrive for a non-running virtual processor in a guest-APIC log and can ring the doorbell for a running one, while Intel's remapping hardware posts into a descriptor and raises a notification vector. The AMD structures are owned by `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.2.5]` `[VT-d 5.20 Ch.5]` `[7][50]` `C:medium` `V:durable`
- **Claim.** One structural difference matters for software: AMD's doorbell is an MSR write addressed by *physical* APIC ID with relaxed serialization semantics and is write-only — a read faults with #GP — whereas Intel's notification is a descriptor field plus an IPI vector. A port between the two rewrites the wake-up path rather than renaming it; the AMD side is owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.29.8]` `[SDM 3C Ch.32]` `[1][49]` `C:medium` `V:durable`

---

## 19.6 The global interrupt flag has no Intel counterpart

- **Claim.** AMD defines a global interrupt flag with two instructions, `STGI` and `CLGI`, that set and clear it, and the flag's effect is total: with GIF cleared, INIT, NMI, external SMI, INTR and virtual INTR are all held pending until GIF is 1 again, and a debug exception from a breakpoint match is discarded outright. The instruction side is owned by `04-world-switch.md`.  `[APM2 §15.17]` `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
| Event arriving while GIF = 0 | AMD behaviour |
|---|---|
| INIT | held pending until GIF is 1 |
| NMI | held pending until GIF is 1 |
| External SMI | held pending until GIF is 1 |
| INTR and virtual INTR | held pending until GIF is 1 |
| Internal SMI from I/O trapping | ignored and discarded |
| Debug exception from a breakpoint-register match | ignored and discarded |
| RESET | normal operation |

- **Claim.** The table's two "discarded" rows are the part that does not survive a naive port: GIF does not uniformly defer events, it defers some and drops others, so an Intel construction that only masks delivery is not equivalent even where it looks equivalent. The instruction-side detail is owned by `04-world-switch.md`.  `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`
- **Claim.** Intel has no single-flag equivalent. The same effects are assembled from pin-based execution controls, the blocking-by-NMI interruptibility state and interrupt-window exiting, none of which is one bit a hypervisor can clear and set around a critical region.  `[SDM 3C §27.6]` `[49]` `C:medium` `V:durable`
- **Claim.** The flag is not optional plumbing on AMD, because the hardware uses it itself: `#VMEXIT` clears the GIF so that the hypervisor can complete its state switch atomically, which means an AMD hypervisor is handed the atomic window that an Intel one must construct.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- **Claim.** Because the flag is real and global, it is also the thing a guest hypervisor cannot be given, which is why AMD virtualizes it separately: virtual GIF gives a guest its own flag affecting only virtual interrupts while the real GIF stays with the outer hypervisor. The feature is part of the nested-virtualization section and is owned by `15-nested-virtualization.md`.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`

---

## 19.7 Nesting: what AMD has instead of VMCS shadowing

The mechanism is owned by `15-nested-virtualization.md`; this section states only the
correspondence, because it is the comparison readers arrive with.

- **Claim.** Intel's VMCS shadowing lets a guest hypervisor execute VMREAD and VMWRITE against a shadow VMCS without exiting, under a VM-execution control and a pair of read/write bitmaps.  `[SDM 3C §27.10]` `[49]` `C:high` `V:durable`
- **Claim.** **AMD has no equivalent, and the reason is that the problem does not arise.** Because a VMCB is ordinary memory with published offsets, a guest hypervisor's accesses to its own VMCB are plain loads and stores that never trap, so there is no privileged accessor to eliminate and nothing for a shadowing feature to accelerate. An "AMD VMCB shadowing" feature does not exist in any AMD document; see `15-nested-virtualization.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** What AMD does provide for nesting is the two features of APM Vol.2 §15.33 and nothing else: virtualized VMLOAD/VMSAVE, CPUID `Fn8000_000A_EDX[15]`, and virtual GIF, `Fn8000_000A_EDX[16]`. Both remove exits a guest hypervisor would otherwise take on every world switch of its own; both are owned by `15-nested-virtualization.md`.  `[APM2 §15.33]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`
- **Claim.** There is likewise no AMD counterpart to the "enlightened VMCS" a Windows-aware guest hypervisor uses on Intel: that structure is a software substitute for VMREAD and VMWRITE, and substituting memory for memory buys nothing when the control structure is already memory — the VMCB's layout is architecturally published and reachable with ordinary loads and stores.  `[APM2 App.B]` `[1]` `C:high` `V:durable`
- **Claim.** **The symmetric-sounding conclusion is false, though.** The Hypervisor Top-Level Functional Specification defines an enlightened **VMCB** field block in the VMCB's host-reserved region at `3E0h`–`3FFh`, governed by clean bit 31, for which Intel has no counterpart — so the asymmetry runs in both directions. This is a Microsoft interface rather than an AMD architectural one and is cited accordingly; the point is developed in `15-nested-virtualization.md` and the Windows-side detail is in `16-windows-platform.md`.  `[464]` `C:high` `V:durable`
- **Claim.** The work that remains is the same on both sides: the outer hypervisor intercepts the inner one's entry instruction, validates the control structure the inner one prepared, merges two levels of second-level translation into one table hardware can walk, and runs the inner guest under the union of both levels' intercepts. Only the per-field access cost differs, and the merged-table cost derivation — `(4+1)³ − 1 = 124` references for a hypothetical three-dimensional walk, which is why no implementation offers one — is identical in both skills.  `[APM2 §15.9]` `[SDM 3C §27.10]` `[1][49][56]` `C:medium` `V:durable`
- **Claim.** One asymmetry survives: on Intel the inner hypervisor's field accesses are instructions, so the outer hypervisor can learn which fields changed, while on AMD they are invisible stores. AMD's nearest substitute is the clean field, which the architecture obliges the inner hypervisor to maintain but permits implementations to ignore in the hardware direction — a hint, not a signal; see `15-nested-virtualization.md`.  `[APM2 §15.15.1]` `[SDM 3C §27.10]` `[1][49]` `C:medium` `V:durable`

---

## 19.8 I/O virtualization: AMD's IOMMU and VT-d

- **Claim.** The name "AMD-Vi" appears nowhere in AMD's IOMMU specification: publication 48882 Rev 3.11 titles itself the *AMD I/O Virtualization Technology (IOMMU) Specification* throughout, and "AMD-Vi" is an ecosystem name popularised by Linux. Use it if the audience expects it, but do not attribute it to AMD.  `[IOMMU 3.11 Ch.1]` `[7]` `C:high` `V:durable`
- **Claim.** The per-device translation state is a Device Table Entry, one per requester identifier, defined in §2.2.2 of the IOMMU specification; Intel reaches the equivalent state through a root-table and context-table pair, or through scalable-mode tables. The AMD structure is owned by `08-iommu-architecture.md`.  `[IOMMU 3.11 §2.2.2]` `[VT-d 5.20 Ch.3]` `[7][50]` `C:high` `V:durable`
- **Claim.** Both IOMMUs do two-level device translation, and AMD's is described in the same vocabulary as the CPU's: §2.2.3 defines the host I/O page tables, §2.2.6 the guest tables reached through a Guest CR3 Table (§2.2.6.3), and §2.2.7 the combination of the two. Intel calls the same pair first-stage and second-stage translation in scalable mode. The AMD tables are owned by `09-iommu-page-tables.md`.  `[IOMMU 3.11 §2.2.6]` `[IOMMU 3.11 §2.2.7]` `[VT-d 5.20 Ch.3]` `[7][50]` `C:high` `V:durable`
- **Claim.** Platform discovery is an ACPI table on both sides with different names and different contents: AMD's is the I/O Virtualization Reporting Structure (IVRS), defined in §5.2, and Intel's is the DMA Remapping table. Firmware that omits or misdescribes either produces the same symptom — an IOMMU the operating system will not enable. The IVRS is owned by `09-iommu-page-tables.md`.  `[IOMMU 3.11 §5.2]` `[VT-d 5.20 Ch.8]` `[7][50]` `C:high` `V:durable`
- **Claim.** Interrupt remapping corresponds field for field in purpose and not at all in format: AMD's interrupt remapping table entries are defined in §2.2.5 with a separate format for guest virtual APIC delivery, and Intel's remapping entries live in its own interrupt-remapping chapter. The AMD entries, the guest-APIC log and the associated device-table fields are owned by `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.2.5]` `[VT-d 5.20 Ch.5]` `[7][50]` `C:high` `V:durable`
- **Claim.** Control and reporting are queue-shaped on both: AMD drives the IOMMU through a command buffer whose commands are defined in §2.4 and reports faults through an event log defined in §2.5, where the page-fault event is `IO_PAGE_FAULT`; Intel uses an invalidation queue and fault-recording registers with a fault-event queue. End-to-end fault decoding on the AMD side is owned by `09-iommu-page-tables.md`.  `[IOMMU 3.11 §2.4]` `[IOMMU 3.11 §2.5]` `[VT-d 5.20 Ch.7]` `[7][50]` `C:high` `V:durable`
- **Claim.** The PCIe-defined features — address translation services, page requests and process address space identifiers — are the same specifications on both platforms, which is why device-side enablement questions usually have vendor-neutral answers even when the IOMMU programming does not; the AMD side is owned by `10-iommu-interrupt-remapping.md`.  `[IOMMU 3.11 §2.2.7]` `[7][53]` `C:medium` `V:durable`

---

## 19.9 Confidential computing: SEV-SNP and TDX

The Intel side is owned by the `intel-vt` skill; the AMD mechanisms are owned by `12-sev.md`,
`13-sev-es-ghcb.md` and `14-sev-snp.md`. Only the trust-model correspondence belongs here.

- **Claim.** The decisive difference is where mediation happens. AMD puts it **inside the guest**: an encrypted-state guest takes its own `#VC` exception, vector 29, and its handler decides what to disclose through a shared communication page, so there is no vendor-supplied software layer between guest and hypervisor. Intel interposes a signed module running in a dedicated processor mode. Every other row of the comparison follows from that placement.  `[APM2 §8.2.22]` `[APM2 §15.35.5]` `[1][585]` `C:high` `V:durable`
- **Claim.** AMD's counterpart of Intel's guest-side trusted layer is a privilege split *within* the guest rather than a module outside it — the SEV-SNP privilege levels, with the most privileged level available to host a paravisor — and it is owned by `14-sev-snp.md`.  `[APM2 §15.36.7]` `[1][17]` `C:high` `V:durable`
- **Claim.** Private and shared memory are marked differently. AMD's guest sets an encryption bit in its own page-table entries, so the guest decides page by page; the bit position is implementation-reported and the mechanism is owned by `11-memory-encryption.md`. Intel distinguishes private from shared by a guest-physical-address bit enforced through structures only its module may edit.  `[APM2 §15.34.5]` `[APM2 §15.34.6]` `[1][585]` `C:high` `V:durable`
- **Claim.** Integrity against a malicious hypervisor is where the two designs are closest in effect and furthest apart in construction: AMD adds a system-wide reverse map checked by hardware on every access, including the hypervisor's, while Intel makes the translation structures editable only from its module's mode. The AMD structure is owned by `14-sev-snp.md`.  `[APM2 §15.36.3]` `[1][585]` `C:high` `V:durable`
- **Claim.** The attestation roots differ in who signs: AMD's reports are produced and signed by the platform security processor and chain to AMD-signed keys, and their format is owned by `14-sev-snp.md`; Intel's chain anchors in its own provisioning service.  `[SNP-ABI 1.59 §7.3]` `[10][585]` `C:high` `V:durable`

| Property | SEV | SEV-ES | SEV-SNP | Intel TDX |
|---|---|---|---|---|
| Memory confidentiality | per-VM key | yes | yes | yes |
| Register confidentiality | no | yes | yes | yes |
| Integrity against a hostile host | no | no | yes, reverse map | yes, module-owned structures |
| Privilege levels inside the guest | no | no | yes | partitioning inside the domain |
| Mediator | none | the guest's own handler | the guest's own handler | a signed module in its own mode |
| Attestation root | platform security processor | same | same | vendor provisioning chain |

- **Claim.** The table restates ownership rather than adding facts: each AMD column is owned by `12-sev.md`, `13-sev-es-ghcb.md` and `14-sev-snp.md` respectively, and the Intel column by the `intel-vt` skill.  `[APM2 §15.34]` `[APM2 §15.35]` `[APM2 §15.36]` `[1][585]` `C:high` `V:durable`
- **Claim.** Both families are server-platform features and §19.12 states the client position precisely; the generational detail is `90-dated-landscape.md`'s.  `[APM2 §15.36.1]` `[1]` `C:medium` `V:durable`

---

## 19.10 ARM and RISC-V

Both express virtualization through privilege levels rather than an orthogonal mode pair, which
removes the need for a VMCB- or VMCS-shaped structure entirely.

### 19.10.1 ARM

- **Claim.** On AArch64 guest user code runs at EL0, guest kernels at EL1 and the hypervisor at EL2; there is no second axis, so a world switch is an exception entry and return rather than a dedicated instruction. Which guest operations trap to EL2 is configured in HCR_EL2 and its companions — system registers, not fields of a memory structure.  `[ARM DDI 0487]` `[51]` `C:high` `V:durable`
- **Claim.** Stage-2 translation is rooted at VTTBR_EL2, which carries both the table base and the VMID and is configured by VTCR_EL2; the guest's own translation is stage 1, so ARM pays the same two-dimensional walk cost as §19.3 with the same large-page mitigation.  `[ARM DDI 0487]` `[51]` `C:high` `V:durable`
- **Claim.** There is no architectural host-state area, because the hypervisor's own configuration lives in EL2 system registers that a running guest does not overwrite; saving and restoring guest EL1 state is software's job, which is why ARM hypervisors carry an explicit world-switch routine where x86 hypervisors carry a structure.  `[ARM DDI 0487]` `[51]` `C:high` `V:durable`
- **Claim.** Interrupt virtualization is a property of the interrupt controller rather than the processor: GICv3 provides list registers and a maintenance interrupt so virtual interrupts reach a running guest without trapping, and GICv4 extends this to direct injection from devices — the functional analogue of the AVIC delivery path of §19.5, which is owned by `07-virtual-interrupts-avic.md`.  `[ARM IHI 0069]` `[581]` `C:medium` `V:durable`
- **Claim.** The IOMMU analogue is the system memory management unit; SMMUv3 provides stage-1 and stage-2 device translation keyed by stream identifiers, filling the role §19.8 describes.  `[ARM SMMUv3]` `[582]` `C:medium` `V:durable`
- **Claim.** ARM is the only one of the four architectures compared here that extended its **privilege model** for nesting rather than adding an accelerator beside it: its nested-virtualization features trap or redirect an EL1 guest hypervisor's accesses to EL2 state, the later of the two redirecting them into a memory structure instead of trapping. Intel's contribution is an accelerator for one class of access (§19.7), AMD's is two accelerators for guest-mode execution of specific instructions, and RISC-V provides none.  `[ARM DDI 0487]` `[51]` `C:medium` `V:durable`

### 19.10.2 RISC-V

- **Claim.** The hypervisor extension turns supervisor mode into HS-mode and adds VS-mode for guest kernels and VU-mode for guest user code, so an unmodified supervisor-mode operating system runs either in HS-mode or as a VS-mode guest.  `[RISC-V Priv H-ext]` `[52]` `C:high` `V:durable`
- **Claim.** Translation becomes two-stage, the VS-stage controlled by vsatp and the G-stage by hgatp, with hgatp also carrying the VMID — the same role as AMD's ASID and Intel's VPID. The G-stage root table is 16 KiB rather than 4 KiB and must be aligned to 16 KiB, because the incoming address is two bits wider; that is a format consequence of two-stage translation, not a new mechanism.  `[RISC-V Priv H-ext]` `[52]` `C:high` `V:durable`
- **Claim.** RISC-V separates the fault taxonomy that x86 overloads: guest-page faults are distinct exception causes from ordinary page faults, and a virtual-instruction exception reports an instruction that is illegal only because it executed with virtualization active. Where AMD signals "the hypervisor must look at this" by an exit code and Intel by an exit reason, RISC-V signals it by an exception cause.  `[RISC-V Priv H-ext]` `[52]` `C:high` `V:durable`
- **Claim.** That virtual-instruction exception is also RISC-V's whole nesting story: the extension's own instructions and control registers are not available to a VS-mode guest, so a guest hypervisor's use of them traps and the outer hypervisor emulates it. There is no shadowing feature and no VLS-style accelerator; nesting is trap-and-emulate by construction.  `[RISC-V Priv H-ext]` `[52]` `C:medium` `V:durable`
- **Claim.** The extension deliberately covers processor and memory only: interrupt-controller virtualization and device translation are separate specifications — the advanced interrupt architecture and the RISC-V IOMMU — so H-extension support implies neither an APICv/AVIC analogue nor a VT-d/IOMMU analogue. This is the opposite packaging from x86, where both arrived as vendor extensions to an existing platform.  `[RISC-V Priv H-ext]` `[52][583][584]` `C:medium` `V:durable`

### 19.10.3 The four-way summary

| Concept | AMD | Intel | ARM | RISC-V |
|---|---|---|---|---|
| Mode pair | host / guest mode | VMX root / non-root | EL2 over EL1/EL0 | HS-mode over VS/VU |
| Control structure | VMCB, published offsets | VMCS, opaque | EL2 system registers | HS control registers |
| Enter guest | `VMRUN` | VMLAUNCH / VMRESUME | exception return to EL1 | return into VS-mode |
| Leave guest | `#VMEXIT` | VM exit | trap to EL2 | trap to HS-mode |
| Host state on entry | area at `VM_HSAVE_PA`, opaque | VMCS host-state area | EL2 registers | HS registers |
| Second-level translation | nested paging (nCR3) | EPT (EPTP) | stage 2 (VTTBR_EL2) | G-stage (hgatp) |
| Guest-handled fault | `#VC`, vector 29, SEV-ES only | #VE, vector 20 | — in the base architecture | virtual-instruction exception |
| Global interrupt block | `CLGI` / `STGI` | — | — | — |
| Nested-hypervisor aid | none needed for field access | VMCS shadowing | nested-virtualization features | — |
| Confidential VM | SEV / SEV-ES / SEV-SNP | TDX | — | — |
| IOMMU | AMD's IOMMU (48882) | VT-d | SMMUv3 | RISC-V IOMMU |

- **Claim.** These are functional correspondences, not equivalences: a hypervisor ported between any two of them rewrites its whole machine-dependent layer, because the state formats, the fault reporting and the invalidation contracts all differ. A guest operating system ports far more cheaply, because it changes only its paravirtual interfaces.  `[APM2 App.B]` `[SDM 3C §27.2]` `[ARM DDI 0487]` `[RISC-V Priv H-ext]` `[1][49][51][52]` `C:high` `V:durable`

---

## 19.11 Terminology collisions

Four pairs of names collide across these architectures. Each has caused real confusion in the
material this skill replaces.

- **Claim.** **`SNP`.** On AMD it is Secure Nested Paging, the third generation of SEV, defined in APM Vol.2 §15.36 and owned by `14-sev-snp.md`. In Intel's VT-d specification `SNP` is the **Snoop** field, bit 11 of a second-stage paging entry. The two have nothing in common, and a sentence containing "SNP bit" is ambiguous until the vendor is named.  `[APM2 §15.36]` `[VT-d 5.20 §3.11]` `[1][50]` `C:high` `V:durable`
- **Claim.** **`RVI`.** In AMD-adjacent material it expands to Rapid Virtualization Indexing, a marketing name for nested paging — a term that **does not appear anywhere in APM Vol.2**, which says "nested paging" throughout. In Intel's APIC virtualization it is the Requesting Virtual Interrupt, the low byte of the guest-interrupt-status field. Prefer "nested paging" for the AMD concept; if a reader says RVI, ask which one they mean.  `[APM2 §15.25]` `[SDM 3C Ch.32]` `[1][49]` `C:high` `V:durable`
- **Claim.** **"Nested paging" versus "nested virtualization".** AMD used *nested* first for two-dimensional address translation (§15.25) and later for running a hypervisor under a hypervisor (§15.33); they are different sections and different mechanisms, and the second is owned by `15-nested-virtualization.md`. "Nested page fault" always means the first.  `[APM2 §15.25]` `[APM2 §15.33]` `[1]` `C:high` `V:durable`
- **Claim.** **"AMD-V" versus "AMD-Vi".** The first is AMD's own brand for the processor feature and appears in APM Vol.2 only in passing — the manual's own term is SVM, Secure Virtual Machine. The second is the widely used name for the IOMMU and appears nowhere in publication 48882. Both are ecosystem shorthand; neither is a section heading anyone can cite.  `[APM2 §15.34]` `[IOMMU 3.11 Ch.1]` `[1][7]` `C:high` `V:durable`
- **Claim.** A fifth pair is spelling rather than meaning, and this chapter is the one place in this skill where both spellings are correct: AMD writes `#VMEXIT` and "system physical address", Intel writes "VM exit" and "host-physical address". Elsewhere in this skill only AMD's spelling is accepted.  `[APM2 §15.6]` `[SDM 3C §27.9.1]` `[1][49]` `C:high` `V:durable`

---

## 19.12 What a client PC actually has

This skill targets Windows PCs, so the split between what exists on a desktop or laptop part and
what does not is worth stating precisely. The generational detail belongs to
`90-dated-landscape.md`; the split itself is durable.

- **Claim.** Everything in §19.2 to §19.7 is present on client parts on both sides: the mode pair and its control structure, second-level translation, TLB tagging, interrupt-virtualization acceleration, an IOMMU, and — on AMD — both nesting accelerators, since virtualized VMLOAD/VMSAVE and virtual GIF are ordinary `Fn8000_000A` feature bits rather than platform features. A machine's actual answer is a CPUID read; the probing discipline is owned by `01-svm-intro.md`.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** **Server scope for the confidential-computing row.** SEV is productised on EPYC. Zen 4 and later client parts expose Secure Memory Encryption only, and SEV-SNP has never been available on a client part — but "absent from all client silicon" is too strong for SEV itself, and `errata.md` `E12` records why. The client-relevant memory-encryption chapter is `11-memory-encryption.md`.  `[APM2 §15.34.1]` `[1][35]` `C:medium` `V:durable`
- **Claim.** Intel's confidential-computing family is likewise a server-platform feature, so the §19.9 comparison is not reachable on either vendor's PC; the Intel side is owned by the `intel-vt` skill.  `[no-spec]` `[585]` `C:medium` `V:durable`
- **Claim.** Secure AVIC is inside the SEV-SNP section of the manual rather than the AVIC section, which places it on the server side of the same line even though ordinary AVIC is not; it is owned by `14-sev-snp.md`.  `[APM2 §15.36]` `[1]` `C:medium` `V:durable`
- **Claim.** Single-root I/O virtualization is a device and platform capability rather than a processor feature on either side, so its absence from a typical PC is a statement about the devices and the firmware, not about the CPU. The IOMMU's own share of it is a pair of virtual-function register blocks — control registers in §3.5 and per-function registers in §3.6 of the IOMMU specification — and those registers are owned by `08-iommu-architecture.md`.  `[IOMMU 3.11 §3.5]` `[IOMMU 3.11 §3.6]` `[7][53]` `C:medium` `V:durable`
- **Claim.** The practical consequence is that the cross-vendor differences a Windows PC actually exercises are the control-structure model, second-level translation, TLB tagging, interrupt virtualization and nesting — because those are what the platform hypervisor described in `16-windows-platform.md` programs on every boot.  `[no-spec]` `[1][49]` `C:high` `V:durable`

---

## 19.13 Open items

- **Anchor depth is uneven on purpose.** AMD statements here are anchored at section level because the APM was read; several Intel, ARM and RISC-V statements are anchored at chapter or document level because this chapter's job is the correspondence, not the other vendor's bit layout. Where a section number could not be verified against the document itself it was left coarse rather than guessed.

- **The ARM and RISC-V sections are the thinnest.** They are written from the architecture manuals' structure rather than from a page-by-page read of those manuals, and the claims carry `C:medium` accordingly. A reader who needs ARM or RISC-V depth should treat this chapter as a map, not as a source.

- **ARM's nested-virtualization features are stated in outline only.** That the architecture provides trap-and-redirect support for a guest hypervisor is well established; exactly which register accesses each feature level covers has not been checked field by field here, which is why §19.10.1's last claim is `C:medium`.

- **No performance comparison appears in this chapter, by design.** Cross-vendor benchmark numbers require matched platforms, matched hypervisor versions and a stated year, and this corpus has no such set; `18-performance.md` owns every number and says where the gaps are. A comparison chapter that quoted one vendor's figure against another's from a different platform and year would be worse than silence.

- **Terminology collisions are almost certainly not limited to the five in §19.11.** Those five are the ones that demonstrably caused errors in the material this skill replaces. Others should be added as they are found rather than invented preemptively.

- **Not covered here by design:** market share, shipment and revenue for any vendor; who shipped a feature first; the kernel or hypervisor versions in which each feature became usable; cloud instance families — all `90-dated-landscape.md`. Nested-SVM mechanism is `15-nested-virtualization.md`; Windows behaviour is `16-windows-platform.md`; every number is `18-performance.md`.
