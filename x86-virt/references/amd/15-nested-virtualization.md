# 15. Nested SVM

> **中文速览**：在 Windows PC 上嵌套不是服务器特性而是常态：只要开启 VBS / WSL2 / 沙盒 / Docker Desktop / Hyper-V 角色，Hyper-V 就占据 SVM，Windows 内核本身以 guest 身份运行，其他 VMM 一律经 WHP 嵌套运行。本章覆盖 AMD 侧的嵌套模型：vmcb12 与 vmcb02 的构造、拦截合并、嵌套 NPT 的遍历代价推导、以及"AMD 用什么代替 VMCS shadowing"这个问题的完整答案。答案有两半：**否定的一半**是 AMD 没有 VMCS shadowing 的对应物，也没有 eVMCS（但**不要推成「AMD 这边什么都没有」**——TLFS 明确定义了 VMCB `3E0h–3FFh` 的 enlightened VMCB 字段块，clean bit 31）——因为 VMCB 本来就是普通内存，L1 对 vmcb12 的读写是不会陷入的 load/store，没有东西可以影子化；**肯定的一半**是 APM §15.33 只定义了两个嵌套加速特性，**VLS（Virtualized VMLOAD/VMSAVE）与 vGIF**，它们才是实际减少嵌套退出的手段。不要去找一个不存在的"VMCB shadowing"。

**Maps to:** APM Vol.2 §15.33 "Nested Virtualization" (§15.33.1 VMSAVE/VMLOAD Virtualization, §15.33.2 Virtual GIF) plus the single-level SVM machinery of §15.5–§15.25 that nesting composes, and kernel and Microsoft primary sources (Tier-2) [1] [2]
**Owns:** the nested SVM model · vmcb12/vmcb02 construction · intercept merging and exit reflection · nested NPT and its cost derivation · the "no VMCS shadowing equivalent, and no enlightened VMCS, but an enlightened VMCB field block that Intel has no counterpart for" fact and what AMD has instead · the shape of nesting on Windows
**Scope:** mixed — §15.33 is normative and OS-independent; the software-composition rules and the Windows material are Tier-2. Client-relevant: VLS and vGIF are ordinary SVM features, not server-platform features.
**See also:** `04-world-switch.md` (VMRUN/#VMEXIT, VLS instruction semantics) · `06-nested-paging.md` (nested paging, ASID, TLB control) · `07-virtual-interrupts-avic.md` (vGIF mechanism, virtual interrupt delivery) · `16-windows-platform.md` (Windows-side enablement and prerequisites) · `17-security.md` (the nested-SVM CVEs) · `18-performance.md` (every nesting number) · `19-comparison-intel-arm-riscv.md` (the Intel/ARM/RISC-V view)

---

## 15.1 The nested model

Nested virtualization is running a hypervisor as the guest of another hypervisor. The three levels
have no AMD-defined names; this chapter uses the convention the literature and the kernel use:
**L0** is the hypervisor that actually executes `VMRUN` on the hardware, **L1** is the hypervisor
running as L0's guest, and **L2** is L1's guest. AMD's own manual describes only the two-party
case — host mode and guest mode — and then adds two features that make the three-party case
cheaper.

- **Claim.** SVM defines exactly one guest mode; the architecture provides no second hardware level, so an L1 hypervisor cannot enter guest mode itself. AMD makes this explicit as an implementation requirement: "The current implementation requires that the VMRUN intercept always be set in the VMCB."  `[APM2 §15.9]` `[APM2 Table 15-7]` `[1]` `C:high` `V:durable`

  > "Checks exceptions (#GP) before the intercept. The current implementation requires that the VMRUN intercept always be set in the VMCB." — Table 15-7, the `VMRUN` row [1]

- **Claim.** Every SVM instruction an L1 hypervisor needs has its own intercept and its own exit code, so L0 sees each one individually: `VMEXIT_VMRUN` is 80h, `VMEXIT_VMMCALL` 81h, `VMEXIT_VMLOAD` 82h, `VMEXIT_VMSAVE` 83h, `VMEXIT_STGI` 84h, `VMEXIT_CLGI` 85h and `VMEXIT_SKINIT` 86h; the full encoding and the decoding rules belong to `05-exit-decoding.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`

- **Claim.** `VMRUN` takes the VMCB's physical address in rAX and checks exceptions before the intercept — the pseudocode order is the CPL and address checks, then `IF (intercepted(VMRUN)) #VMEXIT (VMRUN)` — so an L1 hypervisor that issues an illegal `VMRUN` gets a fault in L1 rather than an exit L0 has to attribute; the instruction-side detail is owned by `04-world-switch.md`.  `[APM3 §4 "VMRUN"]` `[2]` `C:high` `V:durable`

### 15.1.1 "Nested paging" is not "nested virtualization"

AMD used the word *nested* first for the two-level address translation of §15.25 and only later
for running a hypervisor under a hypervisor. The two are separate sections of the manual and
separate mechanisms, and conflating them is the most common way to misread this chapter.

- **Claim.** APM Vol.2 §15.25 "Nested Paging" is the guest-linear → guest-physical → system physical translation performed by hardware for a *single* level of virtualization; APM Vol.2 §15.33 "Nested Virtualization" is a different, later section about running a hypervisor as a guest, and its stated purpose is to relieve the top-level hypervisor of "certain common, high-overhead operations that can occur with nested virtualization."  `[APM2 §15.25]` `[APM2 §15.33]` `[1]` `C:high` `V:durable`

  > "Hardware support for improved performance of nested virtualization, which is the act of running a hypervisor as a guest under a higher-level hypervisor, is provided through the features described here. These relieve the top-level hypervisor from performing certain common, high-overhead operations that can occur with nested virtualization." — §15.33 [1]

- **Claim.** §15.33 has exactly two subsections — §15.33.1 VMSAVE and VMLOAD Virtualization and §15.33.2 Virtual GIF — and the manual's revision history records the section as an addition covering those two features and nothing else. Any "AMD VMCB shadowing" feature attributed to this section is an invention.  `[APM2 §15.33]` `[1]` `C:high` `V:durable`

### 15.1.2 The three control blocks

- **Claim.** Three VMCBs are in play under nesting, and only one of them is ever handed to hardware: **vmcb01**, the VMCB with which L0 runs L1; **vmcb12**, the VMCB L1 prepared for L2, which L0 sees only as a page of L1 guest-physical memory; and **vmcb02**, the VMCB L0 synthesises from the other two and passes to `VMRUN`. The naming is a software convention from the Turtles work and the Linux implementation, not AMD terminology.  `[no-spec]` `[432][434]` `C:high` `V:durable`

- **Claim.** L0 cannot let hardware consume vmcb12 directly for two independent reasons: every physical address in a VMCB control area is a system physical address to hardware but an L1 guest-physical address in vmcb12, and the intercept vectors in vmcb12 describe only what L1 wants, not what L0 needs; the field-by-field layout is owned by `02-vmcb.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

### 15.1.3 What the hardware does and does not do

| Step | Who does it under single-level virtualization | Who does it under nesting |
|---|---|---|
| Decide what the guest may not do | hypervisor writes intercept vectors | L0 computes the union of L0's and L1's |
| Enter the guest | hardware, on `VMRUN` | hardware, on L0's `VMRUN` of vmcb02 |
| Report the exit | hardware, into the VMCB | hardware into vmcb02; L0 copies or reflects |
| Translate guest-physical | hardware, through the nested page tables | hardware through one composed table L0 built |
| Save and restore the host | hardware, via `VM_HSAVE_PA` | hardware for L0; L0 in software for L1 |
| Deliver an event | hardware, from `EVENTINJ` | L0 re-checks L1's intercepts, then injects |

- **Claim.** The table's shape is the whole of nesting on AMD: hardware still performs exactly one world switch and one two-dimensional translation, and every additional level is collapsed into those by L0 in software. The only architectural help AMD provides is the pair of features in §15.33.  `[APM2 §15.33]` `[1]` `C:high` `V:durable`

---

## 15.2 Building vmcb02

### 15.2.1 State

- **Claim.** `VMRUN` loads guest state from the VMCB and saves a minimal host state set; `#VMEXIT` writes back "the same subset of processor state as is loaded by the VMRUN instruction", so the state halves of vmcb02 and vmcb12 can largely be copied through — the exception list and what `#VMEXIT` does *not* restore are owned by `04-world-switch.md`.  `[APM2 §15.5.1]` `[APM2 §15.6]` `[1]` `C:high` `V:durable`

- **Claim.** `#VMEXIT` additionally clears all intercepts, resets the current ASID register to zero (the host ASID), clears the GIF, and clears the processor's internal `V_IRQ` and `V_INTR_MASKING` copies — so when L0 gains control after an L2 exit the machine is in plain host mode with no residue of either guest level; the interrupt-state half is owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### 15.2.2 Host state: why `VM_HSAVE_PA` cannot be forwarded

- **Claim.** `VM_HSAVE_PA` (C001_0117h) holds the physical address of a 4-Kbyte block where `VMRUN` saves host state and from which `#VMEXIT` reloads it, and a write faults with #GP if any of the low 12 bits of the address are non-zero or the address is at or above the implementation's maximum supported physical address — both conditions L0 must reproduce when it emulates L1's write.  `[APM2 §15.30.4]` `[1]` `C:high` `V:durable`

- **Claim.** The host save area is architecturally opaque: implementations may store part or none of the host state there and keep the rest in hidden on-chip memory, and AMD states that "software must not rely on the format or contents of the host state save area, nor attempt to change host state by modifying the contents of the host save area." L0 therefore cannot inspect the area L1 nominated, cannot hand L1's address to hardware, and must save and restore L1's host state itself.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

- **Claim.** This is the sharpest structural difference from Intel's arrangement, where the host-state area is part of the control structure and is therefore reachable by the same accessor as everything else; the comparison is made in `19-comparison-intel-arm-riscv.md`.  `[APM2 §15.5.1]` `[1]` `C:medium` `V:durable`

### 15.2.3 Fields that must be re-derived rather than copied

- **Claim.** Every VMCB control field naming memory must be re-derived: `IOPM_BASE_PA` addresses a 12-Kbyte I/O permissions map (two 4-Kbyte pages plus the first three bits of a third) and `MSRPM_BASE_PA` a map of four 16-Kbit vectors in two contiguous pages, both "accessed by physical address", and in vmcb12 those addresses are L1 guest-physical; the map formats are owned by `03-intercepts.md`.  `[APM2 §15.10.1]` `[APM2 §15.11]` `[1]` `C:high` `V:durable`

- **Claim.** An out-of-range permissions-map address is not a silent error: if the last byte of either map is at or above the maximum supported physical address, `VMRUN` treats it as illegal VMCB state and takes `#VMEXIT(VMEXIT_INVALID)`, so L0 must validate the translated addresses before they reach vmcb02 rather than letting hardware reject them on L1's behalf.  `[APM2 §15.10.1]` `[APM2 §15.11]` `[1]` `C:high` `V:durable`

- **Claim.** The same rule applies to `N_CR3`, to the AVIC table pointers and to any other VMCB field holding an address; the complete list of address-bearing fields and their offsets is owned by `02-vmcb.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

### 15.2.4 Clean bits under nesting

- **Claim.** The VMCB Clean field controls which guest register values `VMRUN` may take from the processor's VMCB state cache instead of from memory, and the hypervisor "must clear specific bits in the VMCB Clean field every time it explicitly modifies the associated guest state in the VMCB" — which means L1, obeying the architecture, leaves L0 a summary of what it changed in vmcb12 since the last entry; the field layout and the per-bit meanings are owned by `02-vmcb.md`.  `[APM2 §15.15.1]` `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`

- **Claim.** L0 may use that summary only as a hint and never as a guarantee. The architecture makes set bits advisory in the hardware direction — "the clean bits are a hint, since any given processor implementation may ignore bits that are set to 1 on any given VMRUN", while "clean bits that are set to zero are always honored" — and nothing prevents a buggy or hostile L1 from leaving a bit set over a field it changed. The consequence of trusting it is a wrong L2, not a compromised L0, but it is still not a validation mechanism; the clean bits themselves are owned by `02-vmcb.md`.  `[APM2 §15.15.1]` `[1]` `C:high` `V:durable`

- **Claim.** The architecture also names what the clean bits say nothing about, and the list is exactly the part of the VMCB that matters most under nesting: `TLB_CONTROL`, the interrupt shadow, the status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, the decode assist), event injection, and RFLAGS/RIP/RSP/RAX are "explicitly not cached and not represented by Clean bits". L0 must therefore re-read every one of those from vmcb12 on each entry regardless of what the clean field says; the fields themselves are owned by `05-exit-decoding.md` and `06-nested-paging.md`.  `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`

- **Claim.** The caching identity is the VMCB's physical address, and explicitly not the ASID: "the SVM architecture uses the physical address of the VMCB as a unique identifier for the guest virtual CPU… For the purposes of VMCB state caching, the ASID is not a unique identifier for a guest virtual CPU." L0 must therefore keep one stable vmcb02 page per (L1 virtual CPU, vmcb12) pair rather than recycling one scratch page, and must clear the whole clean field on first run, on a move to a different core and on a move to a different physical page.  `[APM2 §15.15]` `[APM2 §15.15.2]` `[1]` `C:high` `V:durable`

### 15.2.5 Sync-back on an L2 exit

- **Claim.** Hardware writes the exit description into the VMCB it was given, so `EXITCODE`, `EXITINFO1`, `EXITINFO2` and `EXITINTINFO` land in vmcb02 and L0 must copy them into vmcb12 before it reflects an exit to L1; the fields' encodings are owned by `05-exit-decoding.md`. The contents of `EXITINFO1` and `EXITINFO2` are undefined for intercepts that do not define them, so a blind copy propagates garbage L1 may act on.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### 15.2.6 Linux-only: how KVM arranges this

- **Claim.** The Linux implementation keeps the same three structures under the same names — `svm->vmcb01`, the L1-supplied `vmcb12`, and `svm->nested.vmcb02` — and caches a sanitised copy of the vmcb12 control area rather than re-reading L1 memory during exit handling.  `[no-spec]` `[432]` `C:medium` `V:durable`

- **Claim.** Sanitisation there is explicit and enumerated: the checks reject a vmcb12 whose `VMRUN` intercept is clear, whose ASID is zero or whose nested CR3 or permissions-map bases are not legal guest-physical addresses, and the copy-in step masks off feature-enable bits the virtual CPU model does not expose.  `[no-spec]` `[432]` `C:medium` `V:durable`

---

## 15.3 Merging intercepts

### 15.3.1 The union rule

Hardware consults one set of intercept vectors, one I/O permissions map and one MSR permissions
map: the ones in the VMCB it was given. Two levels of intercepts must therefore be flattened into
one before entry.

- **Claim.** Intercepts are a per-VMCB property evaluated for the guest currently running, and `#VMEXIT` clears them all, so there is no architectural notion of "the outer hypervisor's intercepts" persisting behind the inner ones.  `[APM2 §15.7]` `[APM2 §15.6]` `[1]` `C:high` `V:durable`

- **Claim.** The composition L0 must perform is therefore a union, bit by bit: vmcb02's intercept vectors are vmcb01's OR vmcb12's, its permissions maps are the bitwise OR of L0's and L1's, and the result is the set of L2 operations that will trap to *either* hypervisor. Nothing in the architecture computes this; it is entirely L0's software.  `[no-spec]` `[432][434]` `C:high` `V:durable`

- **Claim.** The union is not optional in either direction. Dropping an L0 intercept hands L2 a capability L0 withheld from L1; dropping an L1 intercept silently changes L2's behaviour relative to running on bare L1.  `[no-spec]` `[432]` `C:high` `V:durable`

### 15.3.2 Reflect or handle

- **Claim.** On every L2 exit L0 answers one question: did L1 ask for this? If the corresponding bit is set in vmcb12 — or, for an I/O or MSR access, in L1's permissions map — L0 synthesises an `#VMEXIT` into vmcb12 and resumes L1; otherwise L0 handles the exit itself and re-enters L2 without L1 ever learning of it.  `[no-spec]` `[432][434]` `C:high` `V:durable`

- **Claim.** The asymmetry that makes nesting expensive is that both outcomes cost a real `#VMEXIT` first. An exit L1 would have handled directly on bare metal becomes an exit to L0, a software decision, a synthesised exit into vmcb12, an entry into L1, L1's handling, L1's `VMRUN`, and another exit to L0 to build vmcb02 again; performance figures for this belong to `18-performance.md`.  `[no-spec]` `[434]` `C:medium` `V:durable`

Written out, the reflected path is:

1. L2 executes something intercepted. Hardware takes `#VMEXIT` into vmcb02, clears all intercepts, clears the GIF, resets the current ASID to 0 and returns control to L0 at the instruction after its `VMRUN`.
2. L0 reads `EXITCODE` from vmcb02 and asks whether L1 requested this intercept in vmcb12.
3. If not, L0 handles it and re-enters L2 — one exit, no L1 involvement, and L1 never learns it happened.
4. If so, L0 copies the exit description and any in-flight event record into vmcb12, writes back the guest state L1 expects to see there, and resumes L1 with a synthesised `#VMEXIT` — which for L1 means resuming at the instruction after *its* `VMRUN`.
5. L1 handles the exit, possibly writes vmcb12, and executes `VMRUN` again. That `VMRUN` is intercepted, so L0 regains control, re-validates vmcb12, refreshes vmcb02 and re-enters L2.

- **Claim.** The step that has no analogue in single-level virtualization is step 4: L0 must make L1's world look as though hardware had exited to it, which means writing fields hardware would have written and restoring the illusion that L1's `VMRUN` returned normally. Nothing in the architecture assists this; it is the whole content of a nested-SVM implementation.  `[no-spec]` `[432][434]` `C:medium` `V:durable`

- **Claim.** Two properties of `#VMEXIT` make step 1 safe and are worth naming because a reader coming from Intel expects to have to arrange them: the GIF is cleared automatically so L0's state switch is atomic without any instruction of its own, and all intercepts are cleared so no residue of L1's policy applies while L0 runs.  `[APM2 §15.6]` `[1]` `C:high` `V:durable`

### 15.3.3 Intercepts L0 keeps for itself

- **Claim.** Some intercepts L0 may never clear whatever vmcb12 says. `VMRUN` is the architectural case — the implementation requires that intercept always be set, which is also what makes L1's `VMRUN` visible at all.  `[APM2 §15.9]` `[1]` `C:high` `V:durable`

- **Claim.** `VMLOAD` and `VMSAVE` are the practical case: unless virtualized VMLOAD/VMSAVE is available *and* enabled for L2 *and* nested paging is on, L0 must keep both intercepts set so that it can translate the guest-supplied VMCB address itself. Clearing them on L1's word is exactly the second defect catalogued in §15.5.5.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

### 15.3.4 Events in flight: `EXITINTINFO` and `EVENTINJ`

- **Claim.** An intercept can fire while the guest is delivering an event through the IDT, and the hardware records that in `EXITINTINFO` so the hypervisor can complete a delivery it can no longer recreate — under nesting, L0 must carry that record across into vmcb12 whenever it reflects the exit, or L1 loses the event; the field format is owned by `05-exit-decoding.md`.  `[APM2 §15.7.2]` `[1]` `C:high` `V:durable`

- **Claim.** Injection runs the other way and has a trap in it: events injected through `EVENTINJ` "are not subject to intercept checks". When L0 injects an event into L2 on L1's behalf it therefore has to apply L1's exception intercept bits in software first — hardware will not do it, and an injected exception that L1 had asked to intercept would otherwise be delivered straight into L2.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`

- **Claim.** Two further `EVENTINJ` rules survive into the nested case: an event impossible for the guest mode fails the entry with `VMEXIT_INVALID` rather than being ignored, and software interrupts cannot be injected correctly unless the processor supports the next-sequential-instruction pointer, indicated by CPUID `Fn8000_000A_EDX[NRIPS]`. L0 must therefore emulate an injection request from L1 that it cannot satisfy rather than pass it through.  `[APM2 §15.20]` `[1]` `C:high` `V:durable`

---

## 15.4 Nested paging under nesting

### 15.4.1 Three dimensions, two of them in hardware

- **Claim.** With nested paging enabled, hardware walks exactly two dimensions: guest page tables rooted at gCR3, which "map guest linear addresses to guest physical addresses", and nested page tables rooted at nCR3, which "map guest physical addresses to system physical addresses". Hardware has no third root register; the structures and the entry format are owned by `06-nested-paging.md`.  `[APM2 §15.25.1]` `[APM2 Figure 15-13]` `[1]` `C:high` `V:durable`

- **Claim.** Nesting adds a third dimension in principle — L2-linear → L2-guest-physical → L1-guest-physical → system physical — so L0 must compose L1's nested page table (call it npt12) with its own (npt01) into a single table, npt02, that maps L2 guest-physical addresses directly to system physical addresses, and give hardware only that.  `[APM2 §15.25.3]` `[1]` `[434]` `C:high` `V:durable`

| Mapping | Maintained by | Rooted at | Walked by |
|---|---|---|---|
| L2 linear → L2 guest-physical | L2's own kernel | gCR3, in vmcb12's state-save area | hardware |
| L2 guest-physical → L1 guest-physical (npt12) | L1 | `N_CR3` in vmcb12 | L0, in software |
| L1 guest-physical → system physical (npt01) | L0 | `N_CR3` in vmcb01 | hardware when L1 runs; L0 in software when resolving npt12 entries |
| L2 guest-physical → system physical (npt02) | L0, composed from the two above | `N_CR3` in vmcb02 | hardware |

- **Claim.** Only the first and last rows of that table are ever walked by hardware in the same `VMRUN`; the middle two exist only in software, which is the structural reason the nested cost shows up as exits and software walks rather than as longer hardware walks. The naming npt12/npt02 follows the vmcb12/vmcb02 convention of §15.1.2 and is not AMD's.  `[APM2 §15.25.1]` `[1]` `[434]` `C:medium` `V:durable`

- **Claim.** npt02 must be built in L0's paging mode, not L1's: "the extra translation uses the same paging mode as the VMM used when it executed the most recent VMRUN", and `#VMEXIT` reloads no host paging state other than CR3, so the second-stage format is fixed by L0's own CR4/EFER at the moment of entry and L1 has no say in it.  `[APM2 §15.25.3]` `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`

- **Claim.** `VMRUN` with nested paging enabled rejects an `N_CR3` with any must-be-zero bit set, and rejects an illegal `G_PAT`, with `#VMEXIT(VMEXIT_INVALID)` — so a malformed nCR3 that L1 supplies must be caught by L0 during composition, because the address hardware sees is L0's, not L1's.  `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`

- **Claim.** Nested paging is also not a persistent mode: it "is automatically disabled by #VMEXIT", so each entry to L2 re-establishes npt02 from vmcb02 and there is no state L0 can leave armed between entries.  `[APM2 §15.25.3]` `[1]` `C:high` `V:durable`

### 15.4.2 The cost, derived

The single-level figure is the starting point and is **not** stated by the APM; the only primary
sources for it are AMD's nested-paging white paper and the ASPLOS paper behind it.

- **Claim.** With four-level guest paging over four-level nested paging the worst-case walk is **24 memory references**, following `nm + n + m` — equivalently `(n+1)(m+1) − 1`, where the subtracted reference is the fetch of the datum itself. Neither the APM nor any Intel manual states this number; the derivation and its consequences are owned by `06-nested-paging.md`.  `[NP-WP §4.2.2]` `[15][56]` `C:high` `V:durable`

Extend the same rule — *every address a walk produces at level k is only a "physical" address in
the next dimension's terms, so it must itself be translated* — to a third dimension of four levels:

- the L2 guest walk produces 5 L2-guest-physical addresses (the one in gCR3 plus the four entries read);
- each, translated through a four-level npt12, produces 5 L1-guest-physical addresses, so 5 × 5 = 25;
- each of those, translated through a four-level npt01, costs up to 5 system accesses: 25 × 5 = 125;
- the last of the 125 is the data access itself, leaving **124** for the walk.

- **Claim.** A literal three-dimensional walk with four levels in each dimension would cost `(4+1)³ − 1 = 124` memory references per TLB miss. **This number is a derivation, not a published figure** — no AMD document states it — which is precisely why no x86 implementation offers a third translation dimension and why L0 collapses the third dimension into npt02 in software. The identical derivation appears on the Intel side, so the two subtrees agree on it.  `[no-spec]` `[56][434]` `C:medium` `V:durable`

- **Claim.** What L2 actually pays on a hit is therefore the ordinary 24, because it is running on npt02 like any single-level guest; the nested penalty sits entirely in the npt02 fill path.  `[APM2 §15.25.5]` `[1]` `[56]` `C:medium` `V:durable`

- **Claim.** Each npt02 fill costs one `#VMEXIT(NPF)` to L0 plus a software walk of npt12 — up to four entry reads, each of them an access to L1-guest-physical memory that L0 must itself resolve through npt01 — so the marginal cost of a nested fault is an exit plus roughly `4 × 5 = 20` further references, not the 124 of a hypothetical hardware three-dimensional walk. Measured consequences belong to `18-performance.md`.  `[APM2 §15.25.5]` `[1]` `[56]` `C:medium` `V:durable`

### 15.4.3 Faults, ASIDs and invalidation

- **Claim.** Fault attribution is already defined for two dimensions and carries over unchanged: a fault in the nested page tables produces `#VMEXIT(NPF)` while a fault in the guest page tables produces `#PF` inside the guest, in the order given by §15.25.6. Under nesting the `#VMEXIT(NPF)` arrives at L0, which must then decide whether the fault is L0's own (npt02 not yet filled) or one L1 would have taken (absent from npt12), and reflect only the latter; the `#NPF` payload bits are owned by `05-exit-decoding.md`.  `[APM2 §15.25.6]` `[1]` `[432]` `C:high` `V:durable`

- **Claim.** ASIDs are a hardware-wide namespace L1 does not own. ASID 0 is reserved for the host, `VMRUN` with a guest ASID of zero ends in `#VMEXIT(VMEXIT_INVALID)`, and the number of ASIDs a processor implements is the value returned in EBX by CPUID `Fn8000_000A` — so the ASID L1 wrote into vmcb12 is a virtual number that L0 must map onto a real one, distinct from L1's own; allocation, exhaustion and reuse are owned by `06-nested-paging.md`.  `[APM2 §15.25.1]` `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

- **Claim.** `INVLPGA` cannot be forwarded. It takes a linear address in rAX and an ASID in ECX, the input "is always interpreted as a guest virtual address", and AMD states that it "does not provide a means to invalidate a nested translation by guest physical address" — so L1's invalidation of an L2 mapping is a request L0 must translate into an npt02 operation of its own, not an instruction L0 can replay; `TLB_CONTROL` and `INVLPGA` are owned by `06-nested-paging.md`.  `[APM2 §15.16.2]` `[1]` `C:high` `V:durable`

---

## 15.5 What AMD has instead of VMCS shadowing

### 15.5.1 The negative half: there is nothing to shadow

- **Claim.** **AMD has no equivalent of Intel's VMCS shadowing, and the reason is structural rather than a gap in the feature list.** A VMCB is an ordinary memory page whose field offsets are architecturally defined, so L1's reads and writes of vmcb12 are plain loads and stores that never trap. There is no privileged accessor to eliminate and therefore nothing for a shadowing feature to accelerate; the VMCB layout is owned by `02-vmcb.md`, and the Intel-side comparison is in `19-comparison-intel-arm-riscv.md`.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

- **Claim.** The same property removes the cost Intel's feature exists to remove but does not remove the merging work: L0 still has to read vmcb12, validate it, compose vmcb02 and copy results back, exactly as an Intel L0 does. What AMD saves is per-field access cost, not per-entry composition cost.  `[APM2 App.B]` `[1]` `[434]` `C:medium` `V:durable`

- **Claim.** Because L1's stores to vmcb12 are invisible to L0, L0 has no hardware signal telling it which fields changed; the nearest substitute is the clean field of §15.2.4, which the architecture obliges L1 to maintain but permits implementations to ignore in the other direction.  `[APM2 §15.15.1]` `[1]` `C:medium` `V:durable`

#### Answering the question in order

When someone asks "what is AMD's VMCS shadowing?", the complete answer has four parts and
omitting any one of them leaves the questioner looking for something that is not there.

1. **There is no such feature**, and the manual's nested-virtualization section names only two, neither of which is a shadowing mechanism.
2. **The reason is that the VMCB is ordinary memory**, so the exits Intel's feature removes do not occur on AMD in the first place.
3. **The real accelerators are VLS and vGIF**, which remove a different set of exits — the ones a guest hypervisor takes on `VMLOAD`, `VMSAVE`, `STGI` and `CLGI` around each of its own world switches.
4. **The merging work is unchanged.** Neither feature reduces what L0 must do per entry; they reduce what L1 must exit for per entry.

- **Claim.** Parts 3 and 4 together are why "AMD nests more cheaply because it has no VMREAD" is only half true: AMD removes a per-field cost that Intel pays and Intel removes, through shadowing, a per-access cost AMD never incurs, while both pay the same per-entry composition cost.  `[APM2 §15.33]` `[APM2 App.B]` `[1]` `[434]` `C:medium` `V:durable`

### 15.5.2 The positive half, part one: virtualized VMLOAD/VMSAVE (VLS)

- **Claim.** VMSAVE and VMLOAD virtualization lets those instructions execute in guest mode with the guest supplying the VMCB address in RAX as a **guest-physical** address, which the processor translates before saving or loading the register state; support is reported by CPUID `Fn8000_000A_EDX[15]`, named `VMSAVEvirt` in AMD's CPUID table.  `[APM2 §15.33.1]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`

  > "VMSAVE and VMLOAD virtualization feature allows these instructions to execute in guest mode, where the guest specifies the VMCB address in RAX as a guest physical address. The VMCB address is translated to a host physical address, which is used to save or load the register state. VMSAVE and VMLOAD virtualization support is indicated by CPUID Fn8000_000A_EDX[15]=1." — §15.33.1 [1]

- **Claim.** VLS is enabled by setting bit 1 at VMCB offset 0B8h — the same byte carries LBR virtualization at bit 0, IBS virtualization at bit 2 and PMC virtualization at bit 3; the control area layout is owned by `02-vmcb.md`, and the Linux name for that field is not AMD's.  `[APM2 §15.33.1]` `[APM2 App.B]` `[1]` `C:high` `V:durable`

- **Claim.** When VLS is enabled and the corresponding instruction intercepts are clear, three checks run at each guest execution of VMSAVE or VMLOAD — **nested paging must be enabled, the hypervisor must be in 64-bit mode, and Secure Encrypted Virtualization must be disabled** — and any failure produces `VMEXIT_VMSAVE` or `VMEXIT_VMLOAD` instead.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

- **Claim.** The intercept bits always win: "if the VMSAVE or VMLOAD intercept bits are set, the corresponding instructions are intercepted regardless of VMSAVE and VMLOAD virtualization enablement", which is what lets L0 keep control while still advertising the feature.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

- **Claim.** A fault while translating the guest-supplied VMCB address produces `#VMEXIT(NPF)`, so the failure is reported to L0 as an ordinary nested page fault rather than as an instruction error.  `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

- **Claim.** This is the feature that matters most for nesting because of what L1 does with those instructions: on bare hardware L1 executes VMLOAD before each `VMRUN` and VMSAVE after each `#VMEXIT` to move the hidden segment and SYSCALL state the world switch does not carry, so without VLS every one of those is an exit to L0. With VLS the address L1 supplies is an L1 guest-physical address and the translation through npt02 is exactly the mapping L0 already maintains; the instruction semantics are owned by `04-world-switch.md`.  `[APM2 §15.5.2]` `[APM2 §15.33.1]` `[1]` `C:high` `V:durable`

### 15.5.3 The positive half, part two: virtual GIF (vGIF)

- **Claim.** Virtual GIF lets STGI and CLGI execute in guest mode and control virtual interrupts instead of the real global interrupt flag; support is reported by CPUID `Fn8000_000A_EDX[16]`, named `VGIF`.  `[APM2 §15.33.2]` `[APM3 App.E]` `[1][2]` `C:high` `V:durable`

- **Claim.** vGIF is enabled by setting bit 25 (`VGIF_EN`) at VMCB offset 60h; the virtual flag itself is bit 9 of the same field, loaded on `VMRUN` and saved on `#VMEXIT`. Virtual interrupts are masked when VGIF is 0 and may be taken when it is 1, and when the feature is enabled and STGI/CLGI are not intercepted, a guest execution of those instructions sets or clears VGIF. As with VLS, a set intercept bit overrides the feature. The interrupt-control field's bit assignments are owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.33.2]` `[1]` `C:high` `V:durable`

- **Claim.** The pointer runs both ways in the manual: §15.17, which defines the real GIF and STGI/CLGI, says that "implementations may provide hardware support for virtualizing the GIF in nested virtualization scenarios" and sends the reader to §15.33 — so vGIF is documented as a nesting feature, not as an interrupt feature that happens to help nesting.  `[APM2 §15.17]` `[1]` `C:high` `V:durable`

- **Claim.** What vGIF removes is the busiest instruction pair in a hypervisor's inner loop. With GIF cleared, INIT, NMI, external SMI, INTR and virtual INTR are all held pending, so L1 brackets each world switch with CLGI/STGI; without vGIF each of those is an exit to L0, and the real GIF stays under L0's exclusive control.  `[APM2 §15.17]` `[APM2 Table 15-10]` `[1]` `C:high` `V:durable`

- **Claim.** vGIF also participates in ordinary delivery, not only in nesting: a virtual INTR is taken only when a virtual interrupt of sufficient priority is pending, EFLAGS.IF is set, **virtual interrupts are enabled with VGIF**, and the processor is not in an interrupt shadow; the evaluation rule is owned by `07-virtual-interrupts-avic.md`.  `[APM2 §15.21.4]` `[1]` `C:high` `V:durable`

### 15.5.4 No enlightened VMCS — but there *is* an enlightened VMCB field block

- **Claim.** Hyper-V's **enlightened VMCS** is an Intel-side construction — a full VMCS-shaped structure in guest physical memory that an aware L1 edits with ordinary memory instructions instead of VMREAD, VMWRITE and VMPTRLD — and it has no AMD counterpart, because the VMCB is already ordinary memory that L1 accesses with loads and stores, so a memory-shaped replacement for it would replace nothing.  `[no-spec]` `[464]` `C:high` `V:durable`
- **Claim.** **That does not mean AMD has no enlightenment interface, and the negative form of this statement is a trap.** The Hypervisor Top-Level Functional Specification says that AMD "has reserved space in the VMCB for hypervisor use, as well as an associated clean bit — the reserved bytes are in the control section, offset 0x3E0-3FF, of the VMCB" and that "the clean bit is bit 31", which "must be invalidated whenever the hypervisor modifies the enlightenments area". Hyper-V uses that region through a structure named `HV_SVM_ENLIGHTENED_VMCB_FIELDS`, and the specification speaks throughout of "the enlightened VMCS / VMCB fields" as a matched pair. The Windows-side detail is owned by `16-windows-platform.md`; the reserved-region contract is owned by `02-vmcb.md`.  `[no-spec]` `[464]` `C:high` `V:durable`

- **Claim.** Linux corroborates the layout independently: its definition of the SVM control area overlays a 32-byte Hyper-V enlightenment structure onto the software-reserved region at control-area offset `3E0h`, as a union with `u8 reserved_sw[32]`. So the interface is an extension of the existing VMCB rather than a second structure to keep coherent — which is the real architectural difference from Intel's enlightened VMCS, and a sharper statement than the claim that AMD has nothing here.  `[no-spec]` `[433]` `C:high` `V:durable`
- **Claim.** One named AMD enlightenment is a TLB opt-in, and its direction is the opposite of the intuitive one: setting `EnlightenedNptTlb` in `HV_SVM_ENLIGHTENED_VMCB_FIELDS` means that **ASID flushes no longer affect TLB entries derived from the nested page tables**, and the L1 must invalidate those entries with hypercalls instead. Opting in therefore *narrows* what an ASID flush covers, in exchange for not flushing NPT-derived entries on every ASID operation. The ASID machinery is owned by `06-nested-paging.md`.  `[no-spec]` `[464]` `C:medium` `V:durable`

### 15.5.5 What the two nested-SVM CVEs teach about these fields

Both are Linux implementation defects rather than architectural ones, and both have the same
shape: a vmcb12 control field copied through to vmcb02 without validation. Their remediation
history and severity accounting belong to `17-security.md`; they appear here because each one
names a field this chapter has just described.

- **Claim.** CVE-2021-3653 is improper validation of the interrupt-control field of a guest-supplied VMCB: because the field was copied through, a malicious L1 could enable AVIC for L2, and "the L2 guest would be allowed to read/write physical pages of the host, resulting in a crash of the entire system, leak of sensitive data or potential guest-to-host escape." It is scored 8.8 (`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`) and affects Linux before 5.14-rc7; the AVIC fields themselves are owned by `07-virtual-interrupts-avic.md`.  `[430]` `C:high` `V:durable`

- **Claim.** CVE-2021-3656 is the VLS counterpart: improper validation of the VMCB field at offset 0B8h let a malicious L1 "disable both VMLOAD/VMSAVE intercepts and VLS (Virtual VMLOAD/VMSAVE) for the L2 guest", with the same host-page read/write consequence and the same 8.8 score and vector. This is why §15.3.3 lists those two intercepts as ones L0 sets from its own policy rather than from vmcb12.  `[431]` `C:high` `V:durable`

- **Claim.** The generalisable rule is that a vmcb12 field which *enables* hardware behaviour is a capability grant, not data: it must be re-derived from what L0 decided to expose, never copied. Fields that merely *describe* guest state can be copied after range checking.  `[no-spec]` `[430][431][432]` `C:medium` `V:durable`

---

## 15.6 Nesting on Windows

On a Windows PC nesting is the default condition rather than an advanced configuration, and the
Windows-side prerequisites, firmware settings and diagnostics are owned by
`16-windows-platform.md`. What belongs here is only the mapping onto the model above.

- **Claim.** Once the Windows hypervisor is loaded, it is L0: the Windows kernel itself runs as a guest, and any other virtualization stack on the machine is by construction an L1 running on the mechanisms of §15.2 to §15.4 rather than on bare SVM; the ownership question is answered in `16-windows-platform.md`.  `[44]` `C:high` `V:durable`

- **Claim.** The features that load it are ordinary desktop features — VBS and memory integrity, WSL2, Windows Sandbox, Docker Desktop's Hyper-V backend, the Hyper-V role — so the three-level stack is on the critical path of everyday developer workloads, not of server consolidation; see `16-windows-platform.md`.  `[41][44]` `C:medium` `V:durable`

- **Claim.** Nested virtualization on AMD under Hyper-V is **supported**, and the widely repeated claim that it is Intel-only is wrong: Microsoft documents it for an "AMD EPYC / Ryzen processor or later" with a host running Windows Server 2022 or later or Windows 11 or later and a VM configuration version of 9.3 or higher. Microsoft names no Zen generation, so neither does this skill; `errata.md` records the correction and `16-windows-platform.md` owns the prerequisite list.  `[41]` `C:high` `V:durable`

- **Claim.** The per-VM switch that turns a Hyper-V guest into an L1 is `Set-VMProcessor -ExposeVirtualizationExtensions $true`; the exact invocation, the VM-state requirement and the interaction with dynamic memory belong to `16-windows-platform.md`.  `[41]` `C:high` `V:durable`

- **Claim.** A third-party VMM reached through the Windows Hypervisor Platform is *already* an L1, not a peer of Hyper-V, which is why such configurations behave like nesting rather than like bare SVM — VMware Workstation Pro takes this path from 15.5.5 and VirtualBox from 6.0; the coexistence rules are owned by `16-windows-platform.md`.  `[47][48]` `C:high` `V:durable`

- **Claim.** The documented ceiling on that path is the one this chapter predicts: a VMM running over the platform API cannot itself nest further, because it is not the one executing `VMRUN` and there is no fourth level to give it. Broadcom lists "no nested virtualization" among the documented limits of the host-VBS mode, alongside slower VMs and the absence of performance counters.  `[47]` `C:high` `V:durable`

- **Claim.** Every number attached to any of this — the cost of VBS on a client machine, of WSL2, of a VMM over the platform API versus bare SVM, of nesting on a PC — is owned by `18-performance.md` and is not restated here.  `[no-spec]` `[41]` `C:high` `V:durable`

---

## 15.7 Open items

- **The manual documents two features and no model.** §15.33 is two paragraphs plus two subsections; everything in §15.2 to §15.4 of this chapter is a software composition rule derived from single-level architecture, corroborated against an implementation, and marked as such. AMD publishes no nested-SVM programming guide, so there is no primary source that could raise those claims above their present confidence.

- **The 124-reference figure is a derivation.** It is stated here with `C:medium` and `[no-spec]` because no AMD document contains it; `errata.md` `O6` records the same caution for the five-level two-dimensional figures. If a primary source is ever found, the anchor changes and the confidence rises; until then it may not be quoted as a published measurement.

- **Whether any shipping implementation ignores set clean bits is unverifiable from the public documents.** §15.15.1 permits it and no revision guide or PPR in the verified corpus says which parts do. L0 implementations that treat the clean field as authoritative are relying on behaviour the architecture explicitly declines to guarantee.

- **Client-part availability of VLS and vGIF is not enumerated per generation here.** Both are ordinary CPUID feature bits in `Fn8000_000A_EDX`, so the answer for a given machine is a `CPUID` read rather than a document lookup; the per-generation landscape belongs to `90-dated-landscape.md` and the probing discipline to `01-svm-intro.md`.

- **Hyper-V's AMD-side enlightenment block is described here from the Linux structure definition only.** Microsoft's hypervisor top-level functional specification is the document that would settle its contents; it has not been checked against that specification in this pass, which is why the claim is `C:medium`.

- **Not covered here by design:** the Windows enablement procedure and its prerequisites (`16-windows-platform.md`), the remediation and severity accounting for the two CVEs (`17-security.md`), all performance figures (`18-performance.md`), the Intel, ARM and RISC-V comparison (`19-comparison-intel-arm-riscv.md`), and kernel versions or product timelines (`90-dated-landscape.md`).
