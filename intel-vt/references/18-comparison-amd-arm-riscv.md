# 18. Cross-Vendor Comparison: Intel VMX vs AMD SVM, ARM and RISC-V

> **中文速览**：本章逐机制对照 Intel VMX 与 AMD SVM：VMCS（布局不公开、只能 VMREAD/VMWRITE 访问）对 VMCB（偏移已定义、可直接内存访问）、VMLAUNCH/VMRESUME 对 VMRUN、VM_HSAVE_PA 宿主状态区、VMLOAD/VMSAVE、VMCB clean bits、EPT 对 NPT/nCR3、拦截位向量与 EXITCODE/EXITINFO1/EXITINFO2、EFER.SVME 与 VM_CR、TLB_CONTROL、V_INTR、INVLPGA。两个旧资料普遍漏掉的对照点在此补齐：**#VC（SEV-ES，向量 29）对 #VE（Intel，向量 20）**，以及**AMD 没有 VMCS shadowing 的对应物**（原因是它根本没有 VMREAD/VMWRITE）。另纠正一条广为流传的错误：**"Intel 没有 ASID 机制"是错的**——Intel 用 PCID 标识进程上下文、VPID 标识 VM 上下文。SEV 内部机制（C-bit、VMPL 0-3、RMP、RMPUPDATE/PSMASH/RMPADJUST、GHCB、SNP 证明报告）与 TDX 对照，TDX 本身由 `13-tdx.md` 拥有。§18.11 标出哪些特性是服务器平台专属、在客户端 Windows PC 上根本不存在。市场份额、出货量与产品状态一律不在本章，见 `90-dated-landscape.md`。

**Maps to:** AMD APM Vol.2 Ch.15 (Secure Virtual Machine) and App.B (Layout of VMCB); Arm ARM (DDI 0487); RISC-V privileged architecture, "H" extension. Intel-side statements carry Intel anchors.
**Owns:** all AMD / ARM / RISC-V architectural facts in this skill, and every Intel-versus-other-vendor mapping.
**See also:** `02-vmcs.md` · `05-vm-exit.md` · `06-address-translation.md` · `07-apic-virtualization.md` · `13-tdx.md` (TDX is owned there) · `14-nested-virtualization.md` · `errata.md` · `90-dated-landscape.md` (product status, default-on timelines, anything with a shipping date).

---

## 18.1 The one-sentence difference

Both architectures add a processor mode pair — Intel's VMX root and VMX non-root operation, AMD's host and guest mode — and a memory-resident structure that describes the guest. They diverge on how software touches that structure, and the divergence propagates into everything else.

- **Claim.** Intel's VMCS has an implementation-defined layout and is accessed only through VMREAD and VMWRITE with architectural field encodings; the structures and encodings are owned by `02-vmcs.md`.  `[SDM 3C §27.2]` `[1]` `C:high` `V:durable`
- **Claim.** AMD's VMCB is an ordinary 4 KB memory structure whose field offsets are architecturally defined, so a hypervisor reads and writes it with ordinary loads and stores and no dedicated instruction.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** The consequence of Intel's choice is that the VMCS layout can change between processor generations without breaking software, at the cost of one privileged instruction per field access; the consequence of AMD's choice is cheap bulk access at the cost of a frozen layout that must be extended rather than rearranged.  `[SDM 3C §27.2]` `[AMD APM 2 App.B]` `[1][41]` `C:high` `V:durable`

Everything in §18.2 through §18.6 is downstream of this single decision.

### 18.1.1 How the anchors in this chapter work

Each side of every comparison is anchored to its own vendor's normative document: Intel
statements to the SDM, AMD statements to the APM and AMD's firmware interface
specifications, ARM statements to the Arm Architecture Reference Manual and the GIC and SMMU
specifications, RISC-V statements to the ratified privileged architecture. Kernel sources are
used as corroboration where they encode a vendor constant, never as the primary source for an
architectural fact.

Where a section number could not be verified against the document itself, the anchor is given
at chapter or appendix level rather than guessed. AMD anchors are therefore a mixture: section
anchors such as `[AMD APM 2 §15.30.1]` where the section was read in publication 24593
revision 3.45 (July 2026), and the coarser `[AMD APM 2 Ch.15]`, `[AMD APM 2 App.B]` and
`[AMD APM 2 App.C]` — SVM, the VMCB layout and the intercept exit codes — everywhere else.

---

## 18.2 Control structures and the transition

### 18.2.1 Enabling the feature

- **Claim.** On Intel, VMX is enabled by setting CR4.VMXE and executing VMXON, gated by the feature-control MSR whose lock and enable bits firmware may set; see `01-vmx-intro.md`.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** On AMD, SVM is enabled by setting EFER.SVME (bit 12), and firmware can disable it through the VM_CR MSR at 0xC0010114, whose SVMDIS bit (bit 4) makes a write to EFER treat SVME as must-be-zero and whose LOCK bit (bit 3) causes writes to LOCK and SVMDIS to be silently ignored; once LOCK is set it can be cleared only through the SVM_KEY MSR and is not affected by INIT or SKINIT.  `[AMD APM 2 §15.30.1]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD requires a host save area before any VMRUN: its physical address is written to the VM_HSAVE_PA MSR at 0xC0010117, and the processor uses that area — not the VMCB — to save host state across a guest execution.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Intel has no equivalent external host-state area: the VMCS itself contains a host-state area, which the processor loads on every VM exit and never saves to.  `[SDM 3C §27.5]` `[1]` `C:high` `V:durable`

### 18.2.2 Structure comparison

| Dimension | Intel VMCS | AMD VMCB |
|---|---|---|
| Layout | implementation-specific; field encodings are architectural | defined by offset in the APM's VMCB layout appendix |
| Access | VMREAD / VMWRITE only | ordinary memory loads and stores |
| Host state | host-state area inside the VMCS | not in the VMCB; separate host save area via VM_HSAVE_PA |
| Activation | VMCLEAR / VMPTRLD establish a current VMCS | none; VMRUN takes the VMCB physical address as its operand |
| Granularity of save/restore | per field, by software | whole-structure save and restore by the processor |
| Extra state | loaded and saved by VM entry/exit control fields | VMLOAD / VMSAVE move a defined set of hidden state |
| Caching contract | processor may cache; VMCLEAR flushes to memory | processor may cache; clean bits tell it what to reload |

- **Claim.** A VMCB is a 4-Kbyte-aligned page divided into two areas: a control area that starts at offset zero and is padded to 1024 bytes, and a state-save area holding saved guest state in the remainder; the intercept bit vectors occupy the first dwords of the control area.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`

### 18.2.3 Entering and leaving the guest

- **Claim.** Intel uses two entry instructions, VMLAUNCH for a VMCS in the clear state and VMRESUME for one in the launched state, and the instruction semantics are owned by `08-vmx-instructions.md`.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** AMD uses a single entry instruction, VMRUN, which takes the VMCB's physical address in rAX, saves host state to the area addressed by VM_HSAVE_PA, loads guest state from the VMCB, and runs the guest until an intercepted event causes #VMEXIT.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** On #VMEXIT the processor writes guest state back into the VMCB's state-save area, restores host state from the host save area, and resumes the host at the instruction after VMRUN — so on AMD the hypervisor's exit handler is the fall-through path of its entry instruction.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** VMLOAD and VMSAVE move a further set of processor state that VMRUN does not touch — the FS, GS, TR and LDTR hidden state, the kernel GS base, the SYSCALL target MSRs STAR, LSTAR, CSTAR and SFMASK, and SYSENTER_CS/ESP/EIP — letting a hypervisor skip that cost when it does not need it.  `[AMD APM 2 §15.5.2]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Intel expresses the same selectivity differently: the VM-entry and VM-exit control fields and the MSR-load/store lists decide what is transferred, rather than a separate instruction; see `02-vmcs.md` and `04-vm-entry.md`.  `[SDM 3C §27.7]` `[1]` `C:high` `V:durable`

### 18.2.4 Caching: VMCB clean bits versus VMCS caching

- **Claim.** AMD defines VMCB clean bits: the VMCB Clean field at VMCB offset 0C0h, bits 31:0, in which the hypervisor clears a bit for each group of VMCB state it has modified, allowing the processor to reuse cached copies of the groups whose bits remain set; support is reported by CPUID Fn8000_000A_EDX[VmcbClean].  `[AMD APM 2 §15.15.1]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Intel's equivalent optimisation is invisible to software: the processor may maintain a cached working copy of the current VMCS, VMCLEAR is the operation that forces it to memory, and no per-field validity contract is exposed.  `[SDM 3C §27.1]` `[1]` `C:high` `V:durable`
- **Claim.** Intel reported the effect of that caching as a reduction in best-case VM exit plus VM entry round-trip latency from about 820 cycles to about 650 cycles across two generations; see `16-performance.md` §16.2.3 for the conditions.  `[no-spec]` `[400]` `C:high` `V:durable`

### 18.2.5 Exit information

- **Claim.** Intel reports the cause of a VM exit in the basic exit-reason field and elaborates it in the exit qualification and the other VM-exit information fields, all read with VMREAD; the encodings and semantics are owned by `05-vm-exit.md`.  `[SDM 3C §27.9.1]` `[1]` `C:high` `V:durable`
- **Claim.** AMD reports the cause in the VMCB control area as EXITCODE, with EXITINFO1 and EXITINFO2 carrying cause-specific detail and EXITINTINFO describing an event that was in delivery when the exit occurred.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD's exit codes are grouped by intercept class: intercepted exceptions produce codes 40h–5Fh for vectors 0–31 (0x40 + vector), and the nested-page-fault exit code VMEXIT_NPF is 400h, with EXITINFO1 carrying the fault error code and EXITINFO2 the guest physical address causing the fault.  `[AMD APM 2 App.C]` `[no-spec]` `[41][506]` `C:high` `V:durable`
- **Claim.** Later SVM additions extended the same code space rather than adding a second reporting channel: AVIC_INCOMPLETE_IPI is 401h, AVIC_NOACCEL is 402h and VMEXIT_VMGEXIT, the SEV-ES guest-to-hypervisor call, is 403h.  `[AMD APM 2 App.C]` `[no-spec]` `[41][506]` `C:high` `V:durable`
- **Claim.** The structural difference is that Intel splits "why" and "about what" across a reason field and a qualification field whose meaning depends on the reason, while AMD splits it across EXITCODE plus two general-purpose information words; neither is more expressive, but code written against one does not port field-by-field to the other.  `[SDM 3C §27.9.1]` `[AMD APM 2 App.B]` `[1][41]` `C:high` `V:durable`

### 18.2.6 Intercepts

- **Claim.** Intel selects which guest operations cause VM exits through layered VM-execution controls plus the exception bitmap, I/O bitmaps, MSR bitmaps and control-register masks and shadows; these are owned by `02-vmcs.md` and `03-nonroot-operation.md`.  `[SDM 3C §27.6]` `[1]` `C:high` `V:durable`
- **Claim.** AMD expresses the same selection as intercept bit vectors at the start of the VMCB control area — one dword at offset 000h for control-register reads and writes, one at 004h for debug-register accesses, one at 008h carrying one bit per exception vector, and further dwords at 00Ch–014h for instruction and event intercepts — supplemented by an I/O permissions map and an MSR permissions map whose physical addresses are the VMCB fields IOPM_BASE_PA (040h) and MSRPM_BASE_PA (048h).  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD additionally defines a global interrupt flag with the STGI and CLGI instructions to set and clear it, giving the hypervisor an architectural way to block all interrupts including NMI and SMI during a critical region; Intel has no single-flag equivalent and controls these events through pin-based controls and interrupt-window exiting instead.  `[AMD APM 2 Ch.15]` `[SDM 3C §27.6.1]` `[41][1]` `C:medium` `V:durable`

### 18.2.7 Feature discovery

- **Claim.** Intel splits discovery in two: a CPUID bit reports that VMX exists, and a family of capability MSRs then reports, for every VM-execution, VM-exit and VM-entry control, which settings the processor allows; `01-vmx-intro.md` and `08-vmx-instructions.md` own the detail.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`
- **Claim.** AMD reports the presence of SVM in a CPUID feature bit and then reports the SVM revision, the number of address-space identifiers the processor implements, and a set of discrete feature bits — NP, NRIPS, VmcbClean, DecodeAssists, FlushByAsid, AVIC and others — in CPUID Fn8000_000A, whose EBX returns the number of ASIDs and whose EDX carries the feature bits.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** The structural difference matters to hypervisor code: an Intel hypervisor must compute each control field against allowed-0 and allowed-1 masks before writing it, whereas an AMD hypervisor tests discrete feature bits and then writes VMCB fields directly.  `[SDM 3D App.A]` `[AMD APM 2 Ch.15]` `[2][41]` `C:high` `V:durable`

### 18.2.8 Instruction correspondence

| Purpose | Intel | AMD |
|---|---|---|
| Enable the feature | CR4.VMXE plus VMXON / VMXOFF | set EFER.SVME |
| Designate the control structure | VMPTRLD / VMCLEAR / VMPTRST | the VMRUN operand in rAX |
| Access a field | VMREAD / VMWRITE | ordinary loads and stores |
| Enter the guest | VMLAUNCH / VMRESUME | VMRUN |
| Guest-to-hypervisor call | VMCALL | VMMCALL |
| Move extra processor state | entry and exit control fields | VMLOAD / VMSAVE |
| Invalidate second-level translations | INVEPT | TLB_CONTROL, flush by ASID |
| Invalidate tagged linear translations | INVVPID | INVLPGA |
| Block all interrupts including NMI | no single instruction | CLGI / STGI |
| Confidential-guest call | see `13-tdx.md` | VMGEXIT |

- **Claim.** The confidential-computing row is the only one where the two designs converge on the same shape — a guest-initiated, guest-controlled exit — and even there the Intel path goes through a module rather than a new instruction encoding; VMGEXIT is AMD's, and the Intel side is owned by `13-tdx.md`.  `[AMD GHCB]` `[no-spec]` `[44][11]` `C:medium` `V:durable`

---

## 18.3 Memory virtualization

### 18.3.1 EPT versus NPT

- **Claim.** Intel's second-level translation is EPT, rooted at the extended-page-table pointer in the VMCS, and is owned by `06-address-translation.md`.  `[SDM 3C §27.6.11]` `[1]` `C:high` `V:durable`
- **Claim.** AMD's second-level translation is nested paging, enabled by the NP_ENABLE bit in the VMCB control area and rooted at nCR3, a VMCB field holding the system physical address of the nested page tables; the second stage uses the same paging mode the hypervisor was using when it executed VMRUN.  `[AMD APM 2 §15.25.3]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD's nested page tables use the ordinary x86 paging format, so the same page-table walker and the same entry format serve both stages, whereas Intel's EPT entries use a distinct format with their own permission and memory-type encodings.  `[AMD APM 2 Ch.15]` `[SDM 3C Ch.31]` `[41][1]` `C:medium` `V:durable`
- **Claim.** A failed second-stage translation is reported as an EPT violation or an EPT misconfiguration on Intel — two distinct exit reasons for a missing/insufficient permission versus a malformed entry — and as a single nested page fault exit code on AMD, with the distinction carried in EXITINFO1.  `[SDM 3D App.C]` `[AMD APM 2 Ch.15]` `[2][41]` `C:high` `V:durable`
- **Claim.** Both architectures pay the same two-dimensional page-walk cost; the worst-case access count is quantified in `16-performance.md` §16.8.2 and the large-page mitigation in §16.8.5.  `[no-spec]` `[406]` `C:high` `V:durable`

### 18.3.2 TLB tagging: the "Intel has no ASID" error

This is the most persistent false statement in cross-vendor material, and it is worth stating precisely what each side has.

- **Claim.** The assertion that Intel has no ASID mechanism is wrong. Intel uses two separate tag namespaces: PCIDs identify process contexts and are carried in the low 12 bits of CR3 when CR4.PCIDE is set, and VPIDs identify virtual-machine contexts; see `errata.md`.  `[SDM 3A Ch.5]` `[SDM 3C §27.6.12]` `[3][1]` `C:high` `V:durable`
- **Claim.** Intel's VPID field in the VMCS is 16 bits wide, and VPID value 0000H is reserved for VMX root operation, so a hypervisor must assign non-zero VPIDs to guests.  `[SDM 3C §27.6.12]` `[1]` `C:high` `V:durable`
- **Claim.** AMD's guest ASID field occupies bits 31:0 at offset 058h of the VMCB control area, so it is 32 bits wide; ASID 0 is reserved for the host and VMRUN with a guest ASID of zero ends in #VMEXIT(VMEXIT_INVALID); the number of ASIDs a processor actually implements is returned in EBX by CPUID Fn8000_000A, so the architectural field width is not the usable range.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** The real difference is structural rather than "one vendor has tagging and the other does not". AMD's ASID is the **VM-level** tag — the direct analogue of Intel's VPID — written by the hypervisor into the VMCB, and it is 32 bits wide against VPID's 16.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** The process-level namespace is **not** an Intel-only facility, and this settles a question this chapter previously left open: the AMD APM defines PCID in the same terms Intel does — CR4.PCIDE (bit 17) enables it, the current 12-bit PCID is CR3[11:0], presence is reported by CPUID function 1 ECX[PCID], and INVPCID manages the tagged entries. Both vendors therefore run two namespaces, a guest-managed process tag and a hypervisor-managed VM tag; the earlier framing here, that AMD folds both roles into a single ASID namespace, was wrong and is withdrawn.  `[AMD APM 2 §5.5.1]` `[SDM 3A Ch.5]` `[41][3]` `C:high` `V:durable`
- **Claim.** ARM's equivalent of VPID is the VMID in VTTBR_EL2 bits [63:48], which is 8 bits in the base architecture and 16 bits when FEAT_VMID16 is implemented **and** VTCR_EL2.VS is 1; ARM keeps a separate ASID for stage-1 process contexts, so all three architectures carry two namespaces: a process tag and a VM tag.  `[ARM DDI 0487]` `[no-spec]` `[48]` `C:medium` `V:durable`

### 18.3.3 Invalidation

- **Claim.** Intel invalidates cached translations with INVEPT for EPT-derived entries and INVVPID for VPID-tagged linear-address translations, each with single-context and global forms; the instruction semantics are owned by `08-vmx-instructions.md`.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** AMD provides INVLPGA, which invalidates one guest virtual address within a specified ASID, taking the address in rAX and the ASID in ECX.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD also provides a TLB_CONTROL field in the VMCB, evaluated at VMRUN, an 8-bit field at bits 39:32 of offset 058h whose encodings are 00h do nothing, 01h flush the entire TLB (all entries, all ASIDs; legacy hypervisors only), 03h flush this guest's TLB entries and 07h flush this guest's non-global entries, all other values reserved — a bulk operation expressed as data rather than as an instruction.  `[AMD APM 2 App.B]` `[no-spec]` `[41][506]` `C:high` `V:durable`
- **Claim.** The split shows up directly in KVM: the same vendor-neutral "flush guest TLB" hook is implemented with a single-context INVVPID on Intel and with an ASID flush on AMD.  `[no-spec]` `[505]` `C:high` `V:durable`

---

## 18.4 Interrupt virtualization: APICv versus AVIC

- **Claim.** Intel's APIC virtualization family — a virtual-APIC page, APIC-register virtualization, virtual-interrupt delivery and posted-interrupt processing — is owned by `07-apic-virtualization.md`.  `[SDM 3C Ch.32]` `[1]` `C:high` `V:durable`
- **Claim.** AMD's counterpart is AVIC, which uses a vAPIC backing page for the virtual APIC state plus Physical and Logical APIC ID Tables addressed from the VMCB, and signals a running target through the Doorbell Register at MSR C001_011Bh.  `[AMD APM 2 §15.29]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** AMD additionally virtualizes legacy interrupt injection through fields packed into offset 060h of the VMCB control area — V_TPR, V_IRQ (a virtual interrupt is pending), V_INTR_PRIO, V_INTR_VECTOR, V_IGN_TPR and V_INTR_MASKING — which is the mechanism a hypervisor uses when AVIC is not in play.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** When AVIC hardware cannot complete an inter-processor interrupt, for example because the target virtual processor is not running, it produces an incomplete-IPI exit and the hypervisor finishes the delivery in software; Intel's IPI virtualization takes the analogous fallback by producing an APIC-write exit for IPIs it cannot virtualize.  `[no-spec]` `[506]` `[419]` `C:medium` `V:durable`

### 18.4.1 Delivery paths and their fallbacks

- **Claim.** When an AVIC-accelerated interrupt targets a virtual processor that is currently running, the hardware updates that processor's backing page and notifies it through a doorbell mechanism, with no exit on either side.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:medium` `V:durable`
- **Claim.** When the target is not running, the hardware cannot complete delivery and takes the incomplete-IPI exit so that the hypervisor can make the target runnable — the same problem Intel solves by having software rewrite the notification vector of a blocked vCPU, the software equivalent described in `07-apic-virtualization.md`.  `[no-spec]` `[506][472]` `C:medium` `V:durable`
- **Claim.** For assigned devices the IOMMU participates on both sides: AMD's IOMMU keeps guest-APIC information and a log of interrupts that arrived for a non-running virtual processor, while Intel's interrupt-remapping hardware posts into a descriptor and raises a notification vector; see `11-vtd-interrupt-remapping.md`.  `[46]` `[VT-d 5.20 Ch.5]` `[8]` `C:medium` `V:durable`

### 18.4.2 The erratum asymmetry

- **Claim.** The two features have had very different operational histories: APIC virtualization has shipped enabled by default on supporting Intel hardware, while AVIC was disabled by default in KVM for years.  `[no-spec]` `[451][503]` `C:high` `V:durable`
- **Claim.** AMD erratum #1235 is the documented cause on one family: hardware may read a stale is-running indication during ICR write emulation and fail to generate the expected AVIC IPI-failure exit, so the hypervisor never wakes the blocked target virtual processor and the guest hangs.  `[no-spec]` `[502]` `C:high` `V:durable`
- **Claim.** The upstream remedy was to restrict AVIC on affected parts and to propose enabling it by default only from a later core generation; the dates and kernel versions of that transition belong in `90-dated-landscape.md`.  `[no-spec]` `[501][502]` `C:high` `V:durable`
- **Claim.** A second, independent cause of AVIC being unavailable is platform firmware that leaves it disabled, and a third is IOMMU-side support for guest APIC delivery being absent on older platforms; none of these are architectural defects in AVIC itself.  `[no-spec]` `[501]` `C:medium` `V:durable`

> `errata.md` records the related correction: the best-documented *interrupt-remapping* erratum is on the Intel side (the 5520/5500 chipset erratum worked around in the kernel), not on AMD's. The two errata are frequently conflated because both end in "interrupts are not delivered".

---

## 18.5 Guest-visible fault delivery: #VE versus #VC

This is the most useful direct Intel-to-AMD analogy and it is missing from most comparison material.

- **Claim.** Intel defines the virtualization exception, #VE, as vector 20: with the appropriate VM-execution control set, certain EPT violations are delivered to the guest as an exception instead of causing a VM exit, with the details placed in a virtualization-exception information area; see `06-address-translation.md` §6.11.  `[SDM 3C §28.5.8]` `[SDM 3C §27.6.19]` `[1]` `C:high` `V:durable`
- **Claim.** AMD defines the VMM communication exception, #VC, as vector 29: in an SEV-ES guest, operations that the hypervisor would normally intercept are instead delivered to the guest's own handler, which then decides what to disclose to the hypervisor.  `[AMD APM 2 Ch.15]` `[no-spec]` `[44]` `[41]` `C:high` `V:durable`
- **Claim.** The two exceptions serve opposite purposes despite the structural similarity: #VE exists to let a guest handle an address-translation fault without a round trip to the hypervisor, whereas #VC exists because an encrypted-state guest must *not* let the hypervisor see its registers, so the guest mediates every interaction itself.  `[SDM 3C §28.5.8]` `[AMD APM 2 Ch.15]` `[1][41]` `C:high` `V:durable`
- **Claim.** Intel's confidential-computing analogue of #VC is the trust-domain exit path mediated by the TDX module rather than a new exception vector; that path is owned by `13-tdx.md`.  `[no-spec]` `[11]` `C:medium` `V:durable`

### 18.5.1 How each exception is armed

- **Claim.** #VE delivery is opt-in twice over: a VM-execution control must enable conversion of EPT violations into virtualization exceptions, and delivery is further selectable per translation entry, so a hypervisor decides exactly which guest-physical pages produce a guest-handled fault instead of an exit — the "EPT-violation #VE" VM-execution control must be 1 and suppress-#VE (bit 63) must be 0 in the deciding entry; the controlling bits are owned by `02-vmcs.md` and `06-address-translation.md`.  `[SDM 3C §28.5.8]` `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`
- **Claim.** #VC is not selectable in the same way: in an encrypted-state guest the affected events are delivered to the guest by construction, so the guest must have a handler and a communication page in place before it triggers one, which is why the protocol includes a register-only mode for the boot phase.  `[AMD GHCB]` `[no-spec]` `[44]` `C:high` `V:durable`
- **Claim.** Both mechanisms convert what would have been a hypervisor round trip into a guest-local fault, but the beneficiary differs: #VE saves the exit, while #VC preserves confidentiality and costs an extra round trip through the guest's own handler.  `[SDM 3C §28.5.8]` `[AMD GHCB]` `[1][44]` `C:high` `V:durable`

---

## 18.6 Nested virtualization: AMD has no VMCS-shadowing equivalent

- **Claim.** Intel's VMCS shadowing lets a guest hypervisor execute VMREAD and VMWRITE against a shadow VMCS without exiting, controlled by read and write bitmaps pointed to from the VMCS; see `14-nested-virtualization.md`, which owns the mechanism.  `[SDM 3C §27.6.15]` `[1]` `C:high` `V:durable`
- **Claim.** AMD has no equivalent feature, and the reason is structural rather than a gap in the feature set: because a VMCB is ordinary memory, a guest hypervisor's accesses to its own VMCB are plain loads and stores that never trap, so there is nothing for a shadowing feature to accelerate.  `[AMD APM 2 App.B]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Both architectures still require the host hypervisor to intercept the guest hypervisor's entry instruction and to build a merged control structure for the innermost guest; the merging work is the same on both sides, and only the field-access cost differs; cross-reference `14-nested-virtualization.md`.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][503]` `C:medium` `V:durable`
- **Claim.** The software workaround on the Intel side when hardware shadowing is unavailable — and the equivalent optimisation when running under another hypervisor — is a memory-based enlightened structure in place of VMREAD/VMWRITE; see `17-windows-platform.md` §17.2.3.  `[no-spec]` `[461]` `C:medium` `V:durable`

### 18.6.1 What the outer hypervisor must do on each side

- **Claim.** On both architectures the outer hypervisor intercepts the inner hypervisor's entry instruction, validates the control structure the inner one prepared, merges the two levels of second-level translation into one set of tables that the hardware can walk, and runs the inner guest with the union of both levels' intercepts; see `14-nested-virtualization.md`.  `[SDM 3C Ch.31]` `[AMD APM 2 Ch.15]` `[1][41]` `C:high` `V:durable`
- **Claim.** The difference is in how the outer hypervisor learns what changed: on Intel the inner hypervisor's field accesses are instructions that either exit or are handled by VMCS shadowing, so the outer hypervisor can know which fields were touched, whereas on AMD they are ordinary stores it cannot observe; see `14-nested-virtualization.md`.  `[SDM 3C §27.6.15]` `[AMD APM 2 App.B]` `[1][41]` `C:medium` `V:durable`
- **Claim.** AMD's answer to that blindness is the clean-bit field, which the inner hypervisor is required to maintain and which the outer hypervisor can therefore read as a summary of what it must re-copy — the same information Intel obtains from the access itself, supplied as data instead.  `[AMD APM 2 App.B]` `[no-spec]` `[41][503]` `C:medium` `V:durable`

---

## 18.7 Confidential computing: SEV internals versus TDX

TDX itself is owned by `13-tdx.md`. This section documents the AMD mechanisms in the detail the comparison needs, and then states the correspondence.

### 18.7.1 Three generations, three added properties

- **Claim.** SEV encrypts guest memory with a per-VM key held by the platform security processor, so the hypervisor reads ciphertext; the guest's register state and its nested page tables remain under hypervisor control.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** SEV-ES adds encryption of the guest register state, which is saved in a separate save area rather than in the hypervisor-readable part of the VMCB; intercepts that would have required register inspection become guest-mediated exchanges instead.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][44]` `C:high` `V:durable`
- **Claim.** SEV-SNP adds memory integrity through the reverse map table, privilege levels within the guest, and an attestation report covering the launch state; it is the generation at which a malicious hypervisor loses the ability to remap or replay guest pages undetected.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][47]` `C:high` `V:durable`
- **Claim.** The platform-level commands a hypervisor issues to launch, update and attest such a guest — as opposed to the instructions the processor executes — are defined in AMD's separate firmware interface specifications.  `[no-spec]` `[45][43]` `C:medium` `V:durable`

### 18.7.2 The C-bit

- **Claim.** SEV marks encrypted memory with a C-bit in the guest's own page-table entries: one physical-address bit, whose position is implementation-specific and is reported by CPUID Fn8000_001F[EBX], is set in a page-table entry — at any level, and for 4 KB, 2 MB or 1 GB pages — to mark that page's contents as encrypted with the guest's key.  `[AMD APM 2 §7.10.4]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Because the C-bit lives in the guest page tables, the *guest* decides which of its pages are private and which are shared, and the shared pages are how it communicates with the hypervisor at all.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41]` `C:high` `V:durable`
- **Claim.** Intel's equivalent is structurally different: TDX distinguishes private from shared memory by a guest-physical-address bit and enforces it through translation structures that only the TDX module may edit; see `13-tdx.md`.  `[no-spec]` `[11]` `C:medium` `V:durable`

### 18.7.3 The reverse map table

- **Claim.** SEV-SNP adds a reverse map table, a single system-wide table with one entry per system physical page recording which guest owns the page, the guest-physical address it is assigned to, whether the guest has validated it, and its page size.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][47]` `C:high` `V:durable`
- **Claim.** The processor checks every memory access, including accesses made by the hypervisor, against the reverse map table, which is what turns SEV's confidentiality into integrity: the hypervisor can no longer remap or alias a guest page undetected.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][47]` `C:high` `V:durable`
- **Claim.** RMPUPDATE is the hypervisor-side instruction that writes a reverse-map entry, and PSMASH splits a large-page entry into the corresponding set of 4 KB entries.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][42]` `C:medium` `V:durable`
- **Claim.** PVALIDATE is the guest-side instruction that marks a page validated in its own reverse-map entries, so a page the hypervisor added without the guest's participation is unusable until the guest accepts it.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][42]` `C:medium` `V:durable`
- **Claim.** RMPADJUST adjusts the per-privilege-level permissions recorded for a page and is also how a page is marked as a save area for another virtual processor.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][42]` `C:medium` `V:durable`
- **Claim.** The corresponding Intel structures are the physical-address metadata table and the module-owned translation structures described in `13-tdx.md`; the functional difference is that AMD enforces ownership with a hardware-checked table while Intel enforces it by making the translation structures editable only from the module's mode.  `[no-spec]` `[11]` `C:medium` `V:durable`

### 18.7.4 Virtual machine privilege levels

- **Claim.** SEV-SNP defines virtual machine privilege levels within a guest, numbered from VMPL0 upwards with VMPL0 the most privileged; permissions are recorded per page per level in the reverse map table, and the number of levels an implementation provides is reported in CPUID Fn8000_001F[EBX] bits 15:12 rather than fixed by the architecture — AMD's SEV-SNP white paper describes the four-level VMPL0–VMPL3 arrangement that shipping parts report.  `[AMD APM 2 §15.36.7]` `[no-spec]` `[41][47]` `C:high` `V:durable`
- **Claim.** VMPLs exist so that a guest can host its own trusted component — a paravisor or security module at VMPL0 — that is protected from the rest of the guest operating system without involving the hypervisor.  `[no-spec]` `[47]` `C:medium` `V:durable`
- **Claim.** Intel's arrangement for the same requirement is trust-domain partitioning with an L1 layer inside the trust domain, described in `13-tdx.md`; the difference is that AMD's levels are a property of memory permissions while Intel's are a nested-virtualization construct inside the domain.  `[no-spec]` `[20]` `C:medium` `V:durable`

### 18.7.5 The GHCB protocol

- **Claim.** An SEV-ES or SEV-SNP guest communicates with the hypervisor through a guest-hypervisor communication block: a page the guest marks shared, whose address the hypervisor sees in the VMCB, and in which the guest places the exit code and parameters it is willing to disclose.  `[AMD GHCB]` `[no-spec]` `[44]` `C:high` `V:durable`
- **Claim.** The guest completes the exchange by executing VMGEXIT, which produces an #VMEXIT whose exit code identifies it as a guest-requested exit; the hypervisor reads the block, acts, writes results back, and resumes the guest.  `[AMD GHCB]` `[no-spec]` `[44][506]` `C:high` `V:durable`
- **Claim.** A register-only variant of the protocol uses the GHCB MSR at 0xC0010130 for the early boot phase and for simple requests, before a full shared page is available.  `[AMD GHCB]` `[no-spec]` `[44]` `C:medium` `V:durable`
- **Claim.** The hypervisor side of this protocol, including how a host validates a guest request and how it manages reverse-map state for the pages involved, is implemented in the Linux SEV support and documented with it.  `[no-spec]` `[504][507]` `C:medium` `V:durable`
- **Claim.** The whole protocol exists because SEV-ES encrypts the guest register state: without it, an intercepted CPUID or I/O instruction would leave the hypervisor with nothing to read.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][44]` `C:high` `V:durable`
- **Claim.** Intel's functional equivalent is the guest-hypervisor communication interface used by trust domains, in which the guest likewise chooses what to place in shared memory before the module mediates the exit; see `13-tdx.md`.  `[no-spec]` `[16]` `C:medium` `V:durable`

### 18.7.6 Attestation

- **Claim.** An SNP guest obtains an attestation report by issuing a guest request through the communication block; the AMD security processor returns a signed report containing the launch measurement, guest-supplied report data, the requesting privilege level, the guest policy, platform trusted-computing-base version information and a chip identifier.  `[AMD SNP-ABI]` `[no-spec]` `[43]` `C:high` `V:durable`
- **Claim.** Verification of that report chains to AMD-signed keys, so the relying party's root of trust is the AMD security processor.  `[AMD SNP-ABI]` `[no-spec]` `[43][47]` `C:medium` `V:durable`
- **Claim.** Intel's report generation and quote-signing chain differs in structure and anchors in Intel's provisioning service; the mechanism and its documents are owned by `13-tdx.md`.  `[no-spec]` `[11][16]` `C:medium` `V:durable`
- **Claim.** A 2025 study measured both stacks on their own hardware and reported millisecond-scale attestation primitives on each, alongside the VMEXIT latency amplification quoted in `16-performance.md` §16.2.5; cross-vendor absolute comparisons from that study are bounded by the two platforms' different baselines.  `[no-spec]` `[500]` `C:medium` `V:durable`

### 18.7.7 What each design removes from the trusted computing base

| Property | SEV | SEV-ES | SEV-SNP | Intel TDX |
|---|---|---|---|---|
| Guest memory confidentiality | yes, per-VM key | yes | yes | yes |
| Guest register confidentiality | no | yes | yes | yes |
| Memory integrity against a malicious host | no | no | yes, reverse map table | yes, module-owned translation structures |
| Privilege levels inside the guest | no | no | yes, VMPLs (count reported by CPUID) | trust-domain partitioning |
| Mediator between guest and host | none | guest's own exception handler | guest's own exception handler | a signed module in a dedicated processor mode |
| Attestation root | platform security processor | platform security processor | platform security processor | Intel's quoting and provisioning chain |

- **Claim.** The row that matters most for reasoning about attacks is the mediator row: AMD places the mediation inside the guest, in a handler the guest itself provides, while Intel interposes a signed module outside the guest; everything else in the table follows from that placement, and the Intel side is owned by `13-tdx.md`.  `[AMD GHCB]` `[no-spec]` `[44][11]` `C:medium` `V:durable`

---

## 18.8 ARM

ARM expresses virtualization through its exception-level model rather than through an orthogonal mode pair, which removes the need for a control structure like the VMCS or VMCB.

- **Claim.** On AArch64, guest user code runs at EL0, guest kernels at EL1, and the hypervisor at EL2; there is no additional "root/non-root" axis, so a world switch is an exception entry and return rather than a dedicated instruction pair.  `[ARM DDI 0487]` `[no-spec]` `[48][51]` `C:high` `V:durable`
- **Claim.** Which guest operations trap to EL2 is configured in the hypervisor configuration register HCR_EL2 and its companions, so ARM's analogue of Intel's VM-execution controls is a set of system registers rather than fields in a memory structure.  `[ARM DDI 0487]` `[no-spec]` `[48]` `C:high` `V:durable`
- **Claim.** Second-stage translation is rooted at VTTBR_EL2, which holds both the stage-2 translation-table base address and the VMID, and is configured by VTCR_EL2; a stage-2 fault is taken to EL2, and HPFAR_EL2 holds the faulting intermediate physical address for *some* of those aborts — translation, access-flag and address-size faults on stage 2, plus permission faults on stage-2 translation of a stage-1 table walk — and is UNKNOWN for the rest.  `[ARM DDI 0487]` `[no-spec]` `[48]` `C:high` `V:durable`
- **Claim.** Because the guest's own translation is stage 1 and the hypervisor's is stage 2, ARM's page-walk amplification is the same two-dimensional problem as EPT's, with the same large-page mitigation.  `[ARM DDI 0487]` `[no-spec]` `[48]` `C:medium` `V:durable`
- **Claim.** Virtualization host extensions let a host operating system kernel run directly at EL2 with its EL1 register accesses redirected, removing the EL2/EL1 switching cost that early ARM hypervisors paid on every host kernel entry — an optimisation with no x86 counterpart, because x86 hosts already run in the privileged mode they need.  `[ARM DDI 0487]` `[no-spec]` `[48][51]` `C:medium` `V:durable`
- **Claim.** Interrupt virtualization is a property of the interrupt controller rather than the CPU: GICv3 gives the hypervisor list registers and a maintenance interrupt so that virtual interrupts are delivered to a running guest without trapping, and GICv4 extends this to direct injection of virtual interrupts from devices, which is the functional analogue of Intel's posted interrupts.  `[ARM IHI 0069]` `[no-spec]` `[49]` `C:medium` `V:durable`
- **Claim.** The IOMMU analogue is the system memory management unit, whose version 3 provides stage-1 and stage-2 device translation keyed by stream identifiers, occupying the role VT-d fills on Intel; see `10-vtd-dma-remapping.md` for the Intel side.  `[ARM SMMUv3]` `[no-spec]` `[52]` `C:medium` `V:durable`

### 18.8.1 Consequences of the exception-level model

- **Claim.** ARM has no architectural host-state area and no control structure to activate: the hypervisor's *configuration and execution* state — HCR_EL2, VTTBR_EL2, VTCR_EL2, VBAR_EL2, TTBR0_EL2, SP_EL2 — lives in EL2 system registers that the hardware does not overwrite when a guest runs. The exception-syndrome registers are not in that set: the Arm ARM makes FAR_EL2 and HPFAR_EL2 UNKNOWN on execution at EL1 or EL0 and ESR_EL2 UNKNOWN on exception return from EL2. Saving and restoring guest EL1 state is software's job, which is why ARM hypervisors carry an explicit world-switch routine where x86 hypervisors carry a structure.  `[ARM DDI 0487]` `[no-spec]` `[48][51]` `C:high` `V:durable`
- **Claim.** ARM's equivalent of Intel's intercept controls is likewise distributed: trap-enable bits are spread across EL2 configuration registers rather than collected into one control field, so "what causes an exit" is answered by reading several registers rather than one structure.  `[ARM DDI 0487]` `[no-spec]` `[48]` `C:medium` `V:durable`
- **Claim.** The corresponding advantage is that the exception model already supplies the transition, so ARM needed no new instruction pair for entry and exit and no new processor mode orthogonal to the existing privilege levels.  `[ARM DDI 0487]` `[no-spec]` `[48][51]` `C:medium` `V:durable`

---

## 18.9 RISC-V

- **Claim.** The RISC-V hypervisor extension turns supervisor mode into HS-mode and adds two guest modes, VS-mode for guest kernels and VU-mode for guest user code, so an unmodified supervisor-mode operating system runs either in HS-mode or as a VS-mode guest.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:high` `V:durable`

> **Excerpt** `[50]`: "The hypervisor extension changes supervisor mode into hypervisor-extended supervisor mode (HS-mode, or hypervisor mode for short)… The hypervisor extension also adds another stage of address translation, from guest physical addresses to supervisor physical addresses… Regular S-mode operating systems can execute without modification either in HS-mode or as VS-mode guests."

- **Claim.** Address translation becomes two-stage: the VS-stage is controlled by vsatp and the G-stage by hgatp, with hgatp also carrying the VMID that tags cached translations — the same role as Intel's VPID; the VMID width is UNSPECIFIED and may be zero, with a maximum of 7 bits for Sv32x4 and 14 bits for Sv39x4/Sv48x4/Sv57x4.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:high` `V:durable`
- **Claim.** The G-stage root page table is wider than a normal root page table because the incoming address is widened by 2 bits: the root table alone becomes 16 KiB instead of 4 KiB and must be aligned to a 16 KiB boundary, and the lowest two bits of hgatp's PPN always read zero. This is a format consequence of two-stage translation rather than a new mechanism.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:high` `V:durable`
- **Claim.** The extension adds hstatus to record guest-related trap context, hedeleg and hideleg to delegate exceptions and interrupts to VS-mode, explicit hypervisor load and store instructions so that HS-mode software can access guest memory with guest privilege, and HFENCE instructions to invalidate the two stages separately.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:high` `V:durable`
- **Claim.** Guest-page faults are distinct exception causes separate from ordinary page faults — codes 20 (instruction), 21 (load) and 23 (store/AMO) against 12, 13 and 15 for ordinary page faults — and the virtual-instruction exception, code 22, reports an instruction that is illegal only because it was executed with V=1; a cleaner separation than x86's overloading of existing faults.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:high` `V:durable`
- **Claim.** RISC-V's design visibly follows ARM's: privilege modes and control-and-status registers rather than a hypervisor-defined control block, with the guest context held in registers and hypervisor software structures.  `[RISC-V Priv H-ext]` `[ARM DDI 0487]` `[no-spec]` `[50][48]` `C:medium` `V:durable`

### 18.9.1 What the H extension does not cover

- **Claim.** The hypervisor extension defines CPU and memory virtualization only: interrupt-controller virtualization and device address translation are specified separately, so a RISC-V platform's equivalents of APICv and VT-d are not implied by H-extension support.  `[RISC-V Priv H-ext]` `[no-spec]` `[50]` `C:medium` `V:durable`
- **Claim.** This is the opposite packaging from x86, where interrupt and IOMMU virtualization arrived as vendor extensions to an existing platform, and closer to ARM's, where the interrupt controller and the system MMU are separate architecture specifications; see §18.8.  `[ARM IHI 0069]` `[ARM SMMUv3]` `[no-spec]` `[49][52]` `C:medium` `V:durable`

---

## 18.10 Summary of the correspondences

| Concept | Intel | AMD | ARM | RISC-V |
|---|---|---|---|---|
| Mode pair | VMX root / non-root | host / guest mode | EL2 over EL1/EL0 | HS-mode over VS/VU |
| Control structure | VMCS (opaque) | VMCB (defined offsets) | EL2 system registers | HS CSRs |
| Enter guest | VMLAUNCH / VMRESUME | VMRUN | exception return to EL1 | SRET into VS-mode |
| Leave guest | VM exit | #VMEXIT | trap to EL2 | trap to HS-mode |
| Host state on entry | VMCS host-state area | area at VM_HSAVE_PA | EL2 registers | HS registers |
| Second-stage translation | EPT (EPTP) | nested paging (nCR3) | stage 2 (VTTBR_EL2) | G-stage (hgatp) |
| VM tag | VPID (16-bit field) | ASID (32-bit field) | VMID (8, or 16 with FEAT_VMID16) | VMID in hgatp (VMIDMAX 7 / 14) |
| Process tag | PCID | PCID | ASID | ASID in satp/vsatp |
| Interrupt acceleration | APICv, posted interrupts | AVIC, V_INTR fields | GICv3 list registers, GICv4 | AIA (out of scope here) |
| Guest-handled fault | #VE (vector 20) | #VC (vector 29, SEV-ES) | — in the base architecture | virtual-instruction exception |
| Nested field-access aid | VMCS shadowing | none needed | — | — |
| Confidential VM | TDX (see `13-tdx.md`) | SEV / SEV-ES / SEV-SNP | — | — |
| IOMMU | VT-d | AMD-Vi | SMMUv3 | RISC-V IOMMU |

- **Claim.** The rows of this table are functional correspondences, not equivalences: a hypervisor port between any two of these architectures rewrites the entire machine-dependent layer, because the state formats, the fault reporting and the invalidation contracts all differ.  `[SDM 3C Ch.27]` `[AMD APM 2 App.B]` `[ARM DDI 0487]` `[RISC-V Priv H-ext]` `[1][41][48][50]` `C:high` `V:durable`
- **Claim.** The rows are also the right granularity for judging portability claims: a guest operating system ports across these architectures by changing its paravirtual interfaces, while a hypervisor ports by rewriting the rows.  `[no-spec]` `[450][458]` `C:medium` `V:durable`
- **Claim.** The Linux kernel makes exactly this split visible: a common x86 layer with per-vendor implementation tables, and entirely separate architecture trees for ARM and RISC-V.  `[no-spec]` `[451][503][508]` `C:high` `V:durable`

---

## 18.11 What a client Windows PC actually has

This skill targets Windows PCs, so it matters which of the features above exist on a client
part at all. The generational detail belongs in `90-dated-landscape.md`; the split itself is
durable.

- **Claim.** The core of both architectures is present on client parts: the mode pair and its control structure, second-level translation, TLB tagging, and the IOMMU that Windows uses for Kernel DMA Protection; a desktop or laptop processor from either vendor supports the mechanisms in §18.2 through §18.4.  `[no-spec]` `[1][41]` `C:medium` `V:durable`
- **Claim.** The confidential-computing features compared in §18.7 are server-platform features: both vendors' virtual-machine memory-encryption technologies require platform support that client parts do not provide, so neither the reverse map table nor the Intel equivalent is reachable on a PC.  `[AMD APM 2 Ch.15]` `[no-spec]` `[41][11]` `C:medium` `V:durable`
- **Claim.** Features aimed at dense multi-tenant servers — device virtualization with many functions per device, and IPI virtualization as measured in `16-performance.md` §16.10 — are likewise server-platform features, and their absence changes which optimisations are even available on a PC rather than only how fast they are.  `[no-spec]` `[419][21]` `C:medium` `V:durable`
- **Claim.** Guest-visible fault delivery splits the same way: the Intel virtualization exception of §18.5 is an ordinary VMX feature, while its AMD counterpart exists only inside an encrypted-state guest and therefore only on server platforms.  `[SDM 3C §28.5.8]` `[AMD GHCB]` `[1][44]` `C:medium` `V:durable`
- **Claim.** The practical consequence for a Windows PC is that the interesting cross-vendor differences are the ones in §18.2 to §18.6 — control-structure model, second-level translation, TLB tagging, interrupt virtualization and nesting — because those are what the platform hypervisor described in `17-windows-platform.md` actually programs.  `[no-spec]` `[1][41]` `C:high` `V:durable`

## 18.12 Procedure for answering a cross-vendor question

1. Identify which side of the question is Intel. Anchor that side to an Intel document and the chapter that owns it; anchor the other side to that vendor's own specification.
2. Prefer a structural answer to a feature-list answer. "AMD has no VMCS shadowing" is only useful with the reason (§18.6).
3. Check `errata.md` before repeating a widely circulated comparison. Two of the most common — that Intel lacks address-space identifiers, and that the notorious interrupt-remapping erratum is AMD's — are wrong.
4. Keep confidential-computing answers split: AMD mechanisms here, Intel mechanisms in `13-tdx.md`, cross-vendor measurements in `16-performance.md`.
5. Send every market, adoption or release-timing question to `90-dated-landscape.md`, including "who was first" questions whose answer is a shipping date rather than an architectural property.

## 18.13 Out of scope for this chapter

Deferred to `90-dated-landscape.md`:

- All market, share, shipment and revenue material, for every vendor in this chapter, without exception.
- The release and kernel versions in which AVIC became default-enabled, and the generations affected by each erratum workaround.
- Product availability of confidential-computing instance families on each cloud, which is also partly owned by `13-tdx.md`.
- Vendor-stated "first to ship" claims for any feature in this chapter, which are shipping dates rather than architectural properties.
- The generations on which each vendor's confidential-computing feature is available, and the firmware or platform prerequisites of each.
- Cross-vendor live-migration support statements from virtualization vendors, which are product policy rather than architecture; the architectural obstacle — divergent CPUID feature sets, vendor-specific MSRs and vendor-specific saved state formats — is stated above and needs no product citation.
