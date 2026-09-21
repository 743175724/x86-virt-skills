# amd-virtualization eval — lookup (24 questions)

Answered using only the `amd-virtualization` skill. Entry point `amd-virtualization/SKILL.md`
read first; routing taken from its §Routing table, with `references/00-quickref.md` §0.2/§0.3
as the stated fallback. `errata.md` checked before writing, per SKILL.md step 3.

---

### amd-document-set
**Routed to:** `00-quickref.md` §0.1 "The AMD document set" (routing row "Document numbers, symptom triage, terminology, where a table lives") — right first time
**Answer:** Publication numbers, not titles, identify an AMD document. The normative set and the revisions this knowledge base was verified against:

| Pub | Document | Rev | Cited as |
|---|---|---|---|
| 24593 | APM Vol.2, System Programming — **SVM is Ch.15** | 3.45 (2026-07) | `[APM2 §15.x]`, `[APM2 App.B]` |
| 24594 | APM Vol.3, General-Purpose and System Instructions | 3.38 (2026-07) | `[APM3 §4 "VMRUN"]` |
| 24592 | APM Vol.1, Application Programming | 3.25 (2026-05) | `[APM1 §x]` |
| 48882 | AMD I/O Virtualization Technology (IOMMU) Specification | 3.11 (2026-04) | `[IOMMU 3.11 §x]` |
| 56860 | SEV-SNP Firmware ABI Specification | 1.59 (2026-08) | `[SNP-ABI 1.59 §x]` |
| 56421 | SEV-ES Guest-Hypervisor Communication Block | 2.04 (2025-01) | `[GHCB 2.04 §x]` |
| 55766 | Secure Encrypted Virtualization API — **SEV and SEV-ES only** | 3.24 (2020-04) | `[SEV-API 3.24 §x]` |
| 58019 | SVSM Guest Communication Interface | 1.01 (2026-03) | `[SVSM 1.01 §x]` |
| 70363 | AMD Memory Encryption white paper — **non-normative** | 2021-10 | `[MEM-WP 70363 p.n]` |
| 70366 | SEV-SNP white paper — **non-normative** | 2020-01 | `[SNP-WP 70366 p.n]` |
| 57095 / 58251 | Revision Guides, EPYC Fam 19h / 1Ah — **the only public AMD errata** | 1.05 / 1.30 | `[RevGuide 57095 erratum 1458]` |

The skill's metadata states the normative baseline as APM Vol.2 rev 3.45 / Vol.3 rev 3.38 (2026-07), IOMMU 48882 rev 3.11 (2026-04), SEV-SNP ABI 56860 rev 1.59 (2026-08), with a dated snapshot of 2026-09-21.

Three citation traps, stated verbatim in §0.1:
1. **APM Vol.3 Chapter 4 is alphabetical and has page numbers, not subsection numbers.** Cite an instruction by mnemonic. `[APM3 §4.7.2 VMRUN]` is invented. (SKILL.md repeats this: the correct form is `[APM3 §4 "PVALIDATE"]`.)
2. **The IOMMU specification has five chapters and no appendices.** `[IOMMU 3.11 App.x]` is always wrong. IVRS is §5.2.
3. **There is no public PPR or revision guide for client Ryzen.** A claim about a client part that needs one says so rather than citing a document that does not exist.

Two further traps SKILL.md's Output standards add: do not invent section numbers (AMD appends rather than renumbers, so the risk is invented *recent* numbers, `§15.36`'s subsections especially); and Windows, CVE and performance facts have no APM section at all — cite Microsoft Learn, the Hypervisor TLFS, kernel.org, NVD, the paper, or an `[AMD-SB-nnnn]` bulletin instead. `01-svm-intro.md` §1.7 adds that AMD's own cross-references inside the CPUID tables are unreliable (Vol.3 points PML at "§15.24.25", which does not exist; Vol.2 places it at §15.25.15), and that Appendix A's cross-reference for `SEV_STATUS` points at §15.35.10 when the section is §15.34.10 — never use Appendix A's page cross-references as section authorities.
**Confidence:** high; navigation file only — §0.1 is explicitly a document index and holds no architectural values.

---

### vm-cr-msr-layout
**Routed to:** `01-svm-intro.md` §1.4 "SVM-related MSRs", subsection "`VM_CR` (`C001_0114h`)" — right first time
**Answer:** `VM_CR` is MSR **`C001_0114h`**, specified in APM Vol.2 §15.30.1 / Figure 15-27.

| Bit | Field | Behaviour |
|---|---|---|
| 0 | `DPD` | Disables the external hardware debug port and certain internal debug features |
| 1 | `R_INIT` | Non-intercepted INIT signals are converted into an `#SX` exception |
| 2 | `DIS_A20M` | Disables A20 masking |
| 3 | `LOCK` | Writes to `LOCK` and `SVMDIS` are silently ignored while set |
| 4 | `SVMDIS` | Writes to `EFER` treat `SVME` as MBZ while set |
| 63:5 | — | Reserved, MBZ |

`[APM2 Figure 15-27]` `[1]`

Behavioural rules `[APM2 §15.30.1]` `[1]`:
- While `VM_CR.LOCK` is set, writes to `LOCK` and `SVMDIS` are silently ignored; when it is clear, bits 3 and 4 can be written. Once set, `LOCK` can only be cleared using the `SVM_KEY` MSR (`C001_0118h`), and it is **not affected by INIT or SKINIT**.
- `VM_CR.SVMDIS` does **not** prevent CPUID from reporting that SVM is available — this is why a BIOS-disabled machine passes the CPUID probe and fails at the `EFER` write.
- Setting `SVMDIS` while `EFER.SVME` is 1 generates a `#GP` fault regardless of the current state of `VM_CR.LOCK`.
- `SVMDIS` is not affected by SKINIT, and INIT clears it only when `LOCK` is clear.

Open item from §1.7: `VM_CR.SVMDIS` is described as **read-only** in §15.31 and as writable-under-conditions in §15.30.1. The chapter states the §15.30.1 rules and flags the wording conflict rather than picking one.
**Confidence:** high (`C:high` `V:durable` on every claim line); the read-only/writable wording conflict is recorded as an open item, not resolved.

---

### vm-hsave-pa-rules
**Routed to:** `01-svm-intro.md` §1.4, subsection "`VM_HSAVE_PA` (`C001_0117h`) and its deliberately unspecified contract" — right first time
**Answer:** `VM_HSAVE_PA` is MSR **`C001_0117h`**, a 64-bit read/write MSR holding the physical address of a **4 KB** block where VMRUN saves host state and from which `#VMEXIT` reloads it. The VMM is expected to set it up before the first VMRUN. `[APM2 §15.30.4]` `[1]`

**Write rules.** Writing `VM_HSAVE_PA` causes a **`#GP`** if any of the **low 12 bits** of the written address are nonzero, or if the address is **greater than or equal to the maximum supported physical address** for the implementation. `[APM2 §15.30.4]` `[1]`

**What you may assume about the memory.** Nothing about its format or contents. The format of the host save area is **intentionally unspecified**: implementations may store only part or none of the host state in the memory pointed to by `VM_HSAVE_PA` and may keep some or all of it in hidden on-chip storage, so **software must not rely on the format or contents of the host save area, nor attempt to change host state by modifying it**. `[APM2 §15.5.1]` `[1]`

Practical consequence stated by the chapter: a hypervisor may not snapshot, migrate or patch host state through this page, and a debugger dumping it will see implementation-dependent garbage on some parts and a recognisable state-save layout on others. Appendix B does give the host save area a format — the guest save area shifted by 400h — but it gets no table of its own, and §15.5.1 overrides it for any purpose other than reading the appendix.

Related: `VM_HSAVE_PA` unset or misaligned is the §1.5 discriminator for "first VMRUN faults or shuts down". `02-vmcb.md` §2.7 records as an open item that the two statements (Appendix B's shifted layout versus §15.5.1's hidden-storage licence) are consistent only if the layout statement is read as "where an implementation does use memory"; the skill reports both and does not reconcile them.
**Confidence:** high (`C:high` `V:durable`); the host-save-area layout question itself is flagged as an unresolved open item in `02-vmcb.md` §2.7.

---

### fn8000-0001-ecx-bit2-scope
**Routed to:** `01-svm-intro.md` §1.2 "Discovering SVM: `Fn8000_0001 ECX`" — **landed short, found via §0.3.** The SKILL.md routing row for "CPUID feature bits" names §1.4 (MSRs) and §1.5 (the enable chain); the owning section is §1.2, which is what `00-quickref.md` §0.3 gives ("`Fn8000_0001` / `Fn8000_000A` feature bits → `01-svm-intro.md` §1.2, §1.3"). Right chapter, wrong anchor.
**Answer:** `Fn8000_0001_ECX[2]` is the `SVM` bit — "Secure virtual machine supported". **It does not by itself let you execute anything.** This is the single most commonly mis-stated fact about SVM discovery: **`ECX[2]` does not gate all eight SVM instructions.**

- The instructions gated on **`EFER.SVME`** are **VMRUN, VMLOAD, VMSAVE, CLGI, VMMCALL and INVLPGA — six, not eight** — and they raise `#UD` when it is clear. `[APM2 §15.4]` `[1]`
- **SKINIT and STGI** are usable when **either** `EFER.SVME = 1` **or** `Fn8000_0001_ECX[SKINIT] = 1` (bit 12); they are the two SVM instructions that are not purely `EFER.SVME`-gated. AMD's description of bit 12 is "SKINIT and STGI are supported, independent of the value of `MSRC000_0080[SVME]`". `[APM2 §15.4]`, `[APM3 App.E]` `[1][2]`
- STGI's `#UD` condition is `EFER.SVME = 0` **and** `Fn8000_000A_EDX[SVML] = 0` **and** `Fn8000_0001_ECX[SKINIT] = 0` — three independent enumeration inputs, only one of which is `EFER.SVME`. Device exclusion vector (DEV) support is part of the SKINIT architecture and is enumerated by the same bit, `Fn8000_0001_ECX[SKINIT] = 1`. `[APM3 §4 "STGI"]` `[2]`

So `ECX[2] = 1` means only: the part has SVM, and the `Fn8000_000A` leaf is now legal to read (it is **reserved** when `Fn8000_0001_ECX[SVM] = 0`, so a blind read returns undefined data). To actually execute the six `EFER.SVME`-gated instructions you must still get through the rest of AMD's chain — `VM_CR.SVMDIS`, then SVM-Lock — and set `EFER.SVME` (`C000_0080h` bit 12). `[APM3 App.E]`, `[APM2 §15.4]` `[1][2]`

The other defined bits in the same word: bit 3 `ExtApicSpace` (extended APIC register space at offset 400h from the APIC base), bit 4 `AltMovCr8` (`LOCK MOV CR0` means `MOV CR8`). `[APM3 App.E]` `[2]`
**Confidence:** high (`C:high` `V:durable`).

---

### vmcb-clean-bit-map
**Routed to:** `02-vmcb.md` §2.5 "Clean bits and VMCB state caching" — right first time
**Answer:** The VMCB Clean field is at **control-area offset 0C0h**. Support is indicated by `CPUID Fn8000_000A_EDX[VmcbClean]` (bit 5). `[APM2 §15.15]` `[1]`

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

`[APM2 Figure 15-4]` `[1]`

**Bit 31** is what you asked about specifically: it is **a special bit reserved for the host that the CPU will never use for a clean bit**, so a hypervisor may use it for its own tracking. That is compatible with the guidance that a hypervisor which has not modified the VMCB may write `FFFF_FFFFh` to the whole field. `[APM2 §15.15.3]` `[1]`

Semantics: each **set** bit allows the processor to load that register or group from its hardware cache; each **clear** bit requires a load from the VMCB. Set bits are a hint any implementation may ignore, but **clean bits set to zero are always honored**. SVM uses the **physical address of the VMCB** as the unique identifier of a guest vCPU for caching — **the ASID is explicitly not** that identifier. `[APM2 §15.15]`, `[APM2 §15.15.1]` `[1]`

Three asymmetries the chapter flags: `SEG` covers **CS, DS, SS and ES only** (FS, GS, LDTR and TR are in no clean group, because VMLOAD/VMSAVE move them); `DT` covers GDT and IDT **limit and base** only, not the LDTR or TR descriptors; and `CR2` gets a bit to itself while `EFER` rides in `CRx`.

The field must be cleared **entirely** in exactly three circumstances: first run of a guest, execution on a **different CPU core** than last time, and the VMCB having **moved to a different physical page**. `[APM2 §15.15.2]` `[1]` Fields with **no** clean bit at all: `TLB_Control`, the interrupt shadow, the status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, Decode Assist), event injection, and `RFLAGS`/`RIP`/`RSP`/`RAX`. `[APM2 §15.15.3]` `[1]`
**Confidence:** high (`C:high` `V:durable`). One open item in §2.7: Figure 15-4's `LBR` coverage list uses MSR names while Table B-2 uses VMCB field names, and `DBGEXTNCTL`, `LBR_STACK_*` and `LBR_SELECT` appear in neither — whether clean bit 10 covers the LBR **stack** fields is unresolved from the manual alone.

---

### int-ctl-60h-layout
**Routed to:** `07-virtual-interrupts-avic.md` §7.1 / §7.1.1 "Bit layout of offset 060h" — right first time
**Answer:** `INT_CTL` is the Linux/KVM name and **does not occur anywhere in APM Vol.2 Rev 3.45**. AMD calls the quadword at VMCB control-area offset 060h the **virtual interrupt control word**; the encrypted copy in a SEV-ES/SEV-SNP VMSA is **`VIntrCtrl`**. `[APM2 §15.29.4.1]` `[1]` `[240]`

| Bit(s) | AMD field name | Meaning |
|---|---|---|
| 7:0 | `V_TPR` | The virtual TPR for the guest. **Bits 3:0 carry the 4-bit value; bits 7:4 are SBZ.** |
| 8 | `V_IRQ` | If nonzero, a virtual INTR is pending |
| 9 | `VGIF` | Virtual GIF |
| 10 | *(unassigned in Table B-1)* | No row — see below |
| 11 | `V_NMI` | If nonzero, a virtual NMI is pending |
| 12 | `V_NMI_MASK` | If nonzero, virtual NMIs are masked |
| 15:13 | — | RESERVED, SBZ |
| 19:16 | `V_INTR_PRIO` | Priority for the virtual interrupt |
| 20 | `V_IGN_TPR` | If nonzero, the current virtual interrupt ignores the (virtual) TPR |
| 23:21 | — | RESERVED, SBZ |
| 24 | `V_INTR_MASKING` | Virtualize masking of INTR interrupts |
| 25 | `VGIF_EN` | Virtual GIF Enable |
| 26 | `V_NMI_ENABLE` | NMI Virtualization Enable |
| 29:27 | — | RESERVED, SBZ |
| 30 | x2AVIC Enable | x2APIC MSR-interface virtualization enable |
| 31 | AVIC Enable | Per-virtual-processor AVIC enable |
| 39:32 | `V_INTR_VECTOR` | Vector to use for the virtual interrupt |
| 63:40 | — | RESERVED, SBZ |

`[APM2 Table B-1]`, `[APM2 §15.29.4.1]` `[1]`

Three things worth carrying: `V_TPR` is **eight bits wide (7:0)**, not 3:0 — only bits 3:0 hold the value and 7:4 are SBZ. The two enables are in the counter-intuitive order **x2AVIC Enable at 30, AVIC Enable at 31** — the newer feature's enable sits *below* the older one's. And AMD's spellings are `VGIF` / `VGIF_EN`, not `V_GIF` / `V_GIF_ENABLE`; bits 30 and 31 are written in prose as "x2AVIC Enable" and "AVIC Enable", not as underscored identifiers.

**Bit 10 is a genuine gap.** Table B-1 lists bit 9, then bit 11; its reserved rows are 15:13, 23:21, 29:27 and 63:40, none of which covers bit 10. The bit is not unused: under Alternate Injection, bit 10 of the *encrypted* `VIntrCtrl` field is the `INT_SHADOW` bit, and the unencrypted interrupt-shadow bit at offset 068h bit 0 is then ignored. `[APM2 §15.36.16]` `[1]` (`02-vmcb.md` §2.7 records the same gap as an open item.)
**Confidence:** high (`C:high` `V:durable`); the bit-10 gap is an open item in the manual itself, reported as such.

---

### vmcb-state-save-offsets
**Routed to:** `02-vmcb.md` §2.3 "State save area: offsets and the segment descriptors" (§2.3.2, §2.3.3) — right first time
**Answer:** **Offset convention:** all state-save-area offsets are **relative to the state save area; add 400h for the VMCB offset.** (The VMCB control area is 0x000–0x3FF; the save area begins at 0x400.)

| Field | Save-area offset | VMCB offset | Size |
|---|---|---|---|
| `CPL` | **0CBh** | 4CBh | **byte** |
| `EFER` | **0D0h** | 4D0h | qword |
| `CR4` | **148h** | 548h | qword |
| `CR3` | **150h** | 550h | qword |
| `CR0` | **158h** | 558h | qword |
| `RFLAGS` | **170h** | 570h | qword |
| `RIP` | **178h** | 578h | qword |
| `RSP` | **1D8h** | 5D8h | qword |
| `RAX` | **1F8h** | 5F8h | qword |
| `CR2` | **240h** | 640h | qword |

`[APM2 Table B-2]` `[1]`

Four orderings that catch people out, all stated by the chapter:
- **CR4 precedes CR3 and CR0** (148h / 150h / 158h) — not numeric order — and `DR7` (160h) precedes `DR6` (168h).
- **`CR2` sits at 240h, after the SYSCALL/SYSENTER block**, not with the other control registers. It also has its own clean bit (9), separate from `CRx` (5).
- **`CPL` is a single byte at 0CBh**, immediately after a RESERVED range of 0A0h–0CAh, followed by a reserved dword at 0CCh and `EFER` at 0D0h. The table's note reads "If the guest is real-mode then the CPL is forced to 0; if the guest is virtual-mode then the CPL is forced to 3". Software must retrieve CPL from **this field and not from any segment DPL** after a `#VMEXIT`, though `CS.DPL` will match it. `[APM2 §15.5.1]` `[1]`
- **`RSP` is at 1D8h and `RAX` at 1F8h, with the three CET fields between them** (`S_CET` 1E0h, `SSP` 1E8h, `ISST_ADDR` 1F0h).

Two warnings the chapter attaches: save-area offset **0CAh is inside the RESERVED range 0A0h–0CAh in Table B-2** — the byte-wide VMPL field at 0CAh exists only in Table B-4, the SEV-ES VMSA layout, and must not be written into a non-SEV-ES VMCB save area. And **offset 140h has no row at all** in Table B-2 (the table jumps from `PERF_CTR5` at 138h to `CR4` at 148h); Table B-4 puts `XSS` there. Whether 140h is reserved in the non-SEV-ES save area or simply omitted is not stated — §2.7 open item.

Also load-bearing: general-purpose registers **other than RAX and RSP have no home in the VMCB save area at all** — only `RAX` (1F8h), `RSP` (1D8h), `RFLAGS` (170h) and `RIP` (178h) are architecturally present, so a hypervisor must save and restore the remaining GPRs itself around every VMRUN. `[APM2 Table B-2]` `[1]`
**Confidence:** high (`C:high` `V:durable`); the 140h gap is an acknowledged open item.

---

### intercept-vector-4-and-5
**Routed to:** `03-intercepts.md` §3.1 "The six intercept vectors" — right first time
**Answer:** **Your manual is out of date, not wrong for its revision.** SVM defines **six** 32-bit intercept vectors at VMCB control-area offsets 000h, 004h, 008h, 00Ch, 010h (vector 4) and **014h (vector 5)**. Vector 5 at 014h **did not exist in Rev 3.30**, where 014h–03Bh was a single RESERVED, SBZ span. A corpus that says SVM has five intercept vectors is reporting the pre-2020 layout. `[APM2 Table B-1]` `[1][150]`

**Vector 4 (010h)** — the SVM instruction set and the write traps. Bits 0–20 assigned; **bits 18:17 and 31:21 RESERVED**:

| Bit | Intercept | Bit | Intercept |
|---|---|---|---|
| 0 | VMRUN | 11 | MWAIT/MWAITX, unconditionally |
| 1 | VMMCALL | 12 | MWAIT/MWAITX only if monitor hardware is armed |
| 2 | VMLOAD | 13 | XSETBV |
| 3 | VMSAVE | 14 | RDPRU |
| 4 | STGI | 15 | EFER writes (trap) |
| 5 | CLGI | 16 | CR0 writes (trap) |
| 6 | SKINIT | 17–18 | RESERVED |
| 7 | RDTSCP | 19 | CR3 writes (trap) |
| 8 | ICEBP | 20 | CR4 writes (trap) |
| 9 | WBINVD and WBNOINVD | 21–31 | RESERVED |
| 10 | MONITOR/MONITORX | | |

`[APM2 Table B-1]` `[1]`

The write-trap block is **narrower than it used to be**: Rev 3.30 defined bit 15 as "intercept writes of EFER" and bits **16–31** as "intercept writes of CR0–15", whereas Rev 3.45 defines only **16 (CR0), 19 (CR3) and 20 (CR4)** and reserves 17, 18 and 21–31. Bit 14, RESERVED in Rev 3.30, is now RDPRU. Corroborated by the exit-code assignment, which allocates exactly **8Fh, 90h, 93h and 94h** to the EFER, CR0, CR3 and CR4 write traps and nothing to CR1–CR2 or CR5–CR15. `[APM2 Table B-1]`, `[APM2 App.C]` `[1][150]`

**Vector 5 (014h)** — "the newest gates". Seven bits, **31:7 RESERVED, SBZ**:

| Bit | Intercept |
|---|---|
| 0 | intercept all INVLPGB |
| 1 | intercept only illegally specified INVLPGB |
| 2 | INVPCID |
| 3 | MCOMMIT |
| 4 | TLBSYNC |
| 5 | bus-lock operations when the Bus Lock Threshold Counter is 0 |
| 6 | HLT if a virtual interrupt is not pending (IdleHlt) |

`[APM2 Table B-1]` `[1]`

Two conditions on vector 5: bit 4 (TLBSYNC) is **present only when `CPUID Fn8000_000A_EDX[24]` (TlbiCtl) = 1**; and bit 5 is an *enable*, not a plain intercept — the bus lock only exits when the separate 16-bit Bus Lock Threshold Counter has reached zero, and the intercept is evaluated before the guest instruction executes. `[APM2 Table B-1]`, `[APM3 App.E]` `[1][2]`

Exit codes follow `code = 32 × vector + bit`, so vector 4 lands at **80h + bit** (VMRUN = 80h) and vector 5 at **A0h + bit** (bus lock = A5h). `[APM2 App.C]` `[1]`
**Confidence:** high (`C:high` `V:durable`); the trap-versus-intercept timing distinction carries `C:medium`.

---

### msrpm-ranges-and-encoding
**Routed to:** `03-intercepts.md` §3.4 "The MSR permissions map" — right first time
**Answer:** The MSRPM consists of **four separate bit vectors of 16 Kbits (2 Kbytes) each**, packed together and located in **two contiguous physical pages**, **4-Kbyte aligned**. Each 16-Kbit vector covers a range of 8K MSRs. `[APM2 §15.11]` `[1]`

**Encoding: each MSR is covered by two bits — the lsb controls read access, the msb controls write access** — and a value of 1 means the operation is intercepted. `[APM2 §15.11]` `[1]`

**The covered ranges are not contiguous:** `[APM2 Table 15-8]` `[1]`

| MSRPM byte offsets | MSRs covered |
|---|---|
| 000h–7FFh | 0000_0000h–0000_1FFFh |
| 800h–FFFh | C000_0000h–C000_1FFFh |
| 1000h–17FFh | C001_0000h–C001_1FFFh |
| 1800h–1FFFh | **reserved** |

Derived arithmetic (AMD states the two-bits-per-MSR rule and the range table but **does not print this**): the read bit for an MSR at index *i* within its 8K-MSR range lies at byte `vector_base + (2i >> 3)`, bit `(2i) & 7`; the write bit is the next bit up. `[APM2 §15.11]` `[1]`

Four behavioural rules:
- **If MSR_PROT is active, any attempt to read or write an MSR *not covered* by the MSRPM automatically causes an intercept** — the uncovered default is "intercept", not "allow". With MSR_PROT clear, RDMSR/WRMSR are never intercepted.
- RDMSR and WRMSR check in order: exceptions common to all MSRs (e.g. `#GP` when not at CPL 0), **then** the MSRPM intercept, **then** exceptions specific to the MSR (password protection, unimplemented MSRs, reserved bits). A hypervisor therefore sees the intercept **before** the processor decides the MSR is unimplemented.
- On an MSR intercept, direction is reported by a single value — **RDMSR is 0, WRMSR is 1** — and the MSR number is in the guest's ECX.
- Practical trap: the shadow-stack MSRs **6A0h–6A8h** sit in the first vector (000h–7FFh) while the **TSC Ratio MSR `C000_0104h`** sits in the second (800h–FFFh), so a hypervisor that only populates the first vector silently leaves TSC scaling writable by the guest. `[APM2 §18.12]`, `[APM2 §15.30.5]` `[1]`

An SNP-active guest can additionally define its own MSR intercepts in four 8-byte vectors in the VMSA, with the same read-lsb/write-msb encoding; a RDMSR/WRMSR is intercepted if **either** the host-controlled or guest-controlled bit is set (Guest Intercept Control, owned by `14-sev-snp.md`). `[APM2 §15.36.23]` `[1]`

The base address comes from `MSRPM_BASE_PA` in the VMCB, whose offset is owned by `02-vmcb.md`; note `02-vmcb.md` §2.7 warns that Appendix B.1 "Guest MSR Intercepts" is about `INTERCEPT_MSR_VEC0`–`3` (VMSA fields), **not** the MSRPM — the MSRPM is described in §15.11.
**Confidence:** high (`C:high` `V:durable`).

---

### exit-codes-60h-61h-band
**Routed to:** `05-exit-decoding.md` §5.1 "The exit-code space" — right first time
**Answer:** **`60h` is `VMEXIT_INTR`** — a physical INTR (maskable interrupt). **`61h` is `VMEXIT_NMI`** — a physical NMI. `[APM2 App.C]` `[1]`

They sit at the bottom of the **vector-3 band, `60h`–`7Fh`**. The encoding rule is `exit code = 32 × (vector number) + (bit position within that vector)`, so intercept vector 3 (VMCB offset 00Ch) maps to `60h + bit`. `[APM2 App.C]` `[1]`

The rest of the band:

| Code | Name | Cause |
|---|---|---|
| `62h` | `VMEXIT_SMI` | Physical SMI (`EXITINFO1` provides more information) |
| `63h` | `VMEXIT_INIT` | Physical INIT |
| `64h` | `VMEXIT_VINTR` | Virtual INTR |
| `65h` | `VMEXIT_CR0_SEL_WRITE` | Write of CR0 changed bits other than `CR0.TS` or `CR0.MP` |
| `66h`–`69h` | `VMEXIT_IDTR_READ` / `GDTR_READ` / `LDTR_READ` / `TR_READ` | Reads of IDTR, GDTR, LDTR, TR |
| `6Ah`–`6Dh` | `VMEXIT_IDTR_WRITE` / `GDTR_WRITE` / `LDTR_WRITE` / `TR_WRITE` | Writes of the same four |
| `6Eh` | `VMEXIT_RDTSC` | RDTSC |
| `6Fh` | `VMEXIT_RDPMC` | RDPMC |
| `70h` | `VMEXIT_PUSHF` | PUSHF |
| `71h` | `VMEXIT_POPF` | POPF |
| `72h` | `VMEXIT_CPUID` | CPUID |
| `73h` | `VMEXIT_RSM` | RSM |
| `74h` | `VMEXIT_IRET` | IRET |
| `75h` | `VMEXIT_SWINT` | Software interrupt (INTn) |
| `76h` | `VMEXIT_INVD` | INVD |
| `77h` | `VMEXIT_PAUSE` | PAUSE |
| `78h` | `VMEXIT_HLT` | HLT |
| `79h` | `VMEXIT_INVLPG` | INVLPG |
| `7Ah` | `VMEXIT_INVLPGA` | INVLPGA |
| `7Bh` | `VMEXIT_IOIO` | IN or OUT accessing protected port (`EXITINFO1` provides more) |
| `7Ch` | `VMEXIT_MSR` | RDMSR or WRMSR access to protected MSR |
| `7Dh` | `VMEXIT_TASK_SWITCH` | Task switch |
| `7Eh` | `VMEXIT_FERR_FREEZE` | FP legacy handling enabled, processor frozen in an x87/mmx instruction awaiting an interrupt |
| `7Fh` | `VMEXIT_SHUTDOWN` | Shutdown |

`[APM2 App.C]` `[1]`

**The trap that matters for a trace with 60h/61h in it:** when an external or virtual interrupt is intercepted — the `60h`, `61h` and `64h` exits — **the interrupt is left pending rather than consumed**, so it is still asserted when the guest is re-entered. A handler that treats `VMEXIT_INTR` as delivery, rather than as notification that an interrupt is waiting, will re-exit immediately and livelock. `[APM2 §15.7]` `[1]`
**Confidence:** high (`C:high` `V:durable`).

---

### npf-exitinfo1-bits
**Routed to:** `05-exit-decoding.md` §5.3 "Nested page faults" — **landed short.** The SKILL.md routing row sends EXITINFO layouts to §5.2, and `00-quickref.md` §0.3 does too ("All `EXITINFO1`/`EXITINFO2` layouts → §5.2"); the `#NPF` layout actually lives in **§5.3**, which is what §0.2's symptom row gives ("`#NPF` … `05-exit-decoding.md` §5.3 for the bits"). Right chapter, resolved via §0.2 rather than §0.3.
**Answer:** On `#VMEXIT(NPF)` (exit code `400h`), **`EXITINFO2` holds the faulting guest physical address** and `EXITINFO1` delivers an error code similar to a `#PF` error code. `[APM2 §15.25.6]` `[1]`

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

`[APM2 §15.25.6]`, `[APM2 §15.36.10]` `[1]`

Five things the chapter insists on (this is `errata.md` E04 — the most heavily mis-transcribed layout in SVM):
- **A numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is off by one from bit 34 upward.** AMD prints "Bit 34 (ENC)", "Bit 35 (SIZEM)", "Bit 36 (VMPL)", "Bit 37 (SSS)".
- **Bit 5 is absent.** A `#PF` error code puts the protection-key violation there; the NPF error code defines nothing at bit 5 and puts the shadow-stack indication at bit 6 instead.
- Bits 32 and 33 are printed **without mnemonics** — AMD refers to them only as `EXITINFO1[33:32]` — and they answer one question: whether the fault happened during the walk of the guest's page tables or during the final guest-physical to system-physical translation. (OS headers call these `GUEST_FINAL`/`GUEST_PAGE`; AMD gives only bit numbers — `00-quickref.md` §0.4.)
- **Bit 37 carries two non-equivalent definitions.** §15.25.6: the leaf NPT entry is marked a supervisor shadow stack page with the shadow-stack check feature enabled. §15.36.10: the VMPL permission mask `SSS` (bit 4) value when `VmplSSS` is enabled. A decoder must know which feature is active before reading it.
- Bit 31 is set on **every** RMP violation, while bits 34–37 are documented as bits that "may be set" — two separate statements, not one flat list.

Two low-bit conventions that mislead: table walks for guest page tables are always treated as **data writes** at the nested page table level (so `RW` is set even for a code read), and NPT accesses performed by the MMU are treated as **user** accesses unless an enabled feature overrides that. Also: an RMP check can fail **transiently** if the accessed RMP entries are in use by other logical processors — software should retry rather than treat the fault as terminal. `[APM2 §15.36.10]` `[1]`
**Confidence:** high (`C:high` `V:durable`); bit 37's dual definition is reported as unresolved in the manual, not guessed.

---

### tlb-control-values
**Routed to:** `06-nested-paging.md` §6.8 "TLB control and INVLPGA" — right first time (SKILL.md routing row §6.7–§6.8; §0.3 confirms §6.8)
**Answer:** **Where it lives:** `TLB_CONTROL` occupies **bits 39:32 of the VMCB control area at byte offset 058h**, immediately above the 32-bit guest ASID in bits 31:0 of the same qword. `[APM2 Table B-1]` `[1]`

**Legal values** — these four are the whole of Table 15-9, which carries an explicit note that **all encodings not defined in it are reserved**:

| Encoding | Function |
|---|---|
| `00h` | Do not flush |
| `01h` | Flush entire TLB — all entries, all ASIDs — on VMRUN. AMD says it should be used only on legacy hardware |
| `03h` | Flush this guest's TLB entries |
| `07h` | Flush this guest's non-global TLB entries |

`[APM2 Table 15-9]` `[1]`

**What gates the extended ones:** the first two commands are available on **every** processor supporting SVM; support for **`03h` and `07h` is optional and indicated by `CPUID Fn8000_000A_EDX[FlushByAsid]`, which is bit 6** — the same bit that indicates TLB flush events such as CR3 writes and `CR4.PGE` toggles flush only the current ASID's entries. `[APM2 §15.16.1]`, `[APM3 App.E]` `[1][2]`

Operational rules:
- With `TLB_CONTROL` = 1, VMRUN flushes the TLB for all ASIDs and both global and non-global pages. **VMRUN reads the field but does not change it**, so the hypervisor must reset it itself between entries.
- A hypervisor that decreases permissions, clears present bits or changes translations in a nested page table and intends to re-enter the **same ASID** should use **`011b` or `001b` — three or one, not seven**, because a downgrade can affect global entries too.
- **A reserved `TLB_CONTROL` encoding is not rejected by any consistency check** — VMRUN's published list of illegal state combinations does not include it, so software must not rely on being told (`C:medium`).
- `TLB_Control` is in the explicitly-uncached list, so **no clean bit ever describes it**; the flush request is re-read on every VMRUN (`02-vmcb.md` §2.6).
- Cross-chapter: with xAVIC enabled on a multi-vCPU VM, a core that last ran a *different* vCPU of the same VM must flush with **`3h`, regardless of the ASID values**. `[APM2 §15.29.4.3]` `[1]`
**Confidence:** high (`C:high` `V:durable`); the "reserved encoding is not checked" claim is `C:medium`.

---

### avic-id-table-entries
**Routed to:** `07-virtual-interrupts-avic.md` §7.5 (entries) and §7.4.2 (VMCB pointers) — **landed short, found via §0.3.** The SKILL.md routing row for chapter 07 names §7.1 and §7.8; `00-quickref.md` §0.3 gives "AVIC backing page, APIC ID tables, AVIC exit codes → §7.4, §7.5, §7.8".
**Answer:** AVIC defines three memory-resident structures — the vAPIC backing page, the Physical APIC ID Table and the Logical APIC ID Table — **each defined to fit exactly one 4-Kbyte page**, with AMD reserving the right to expand the size in future implementations. There is one backing page **per virtual processor** but **one Physical and one Logical APIC ID Table per virtual machine**, so the two table pointers hold the same value in every VMCB of the VM. `[APM2 §15.29.5]`, `[APM2 §15.29.5.2]` `[1]`

**Physical APIC ID Table entry** — indexed by guest physical APIC ID, **64 bits** per entry: `[APM2 Table 15-23]` `[1]`

| Bit(s) | Field | Description |
|---|---|---|
| 63 | `V` | Valid. Set = this entry holds a valid backing-page pointer |
| 62 | `IR` | IsRunning. The vCPU is currently scheduled by the VMM on a physical core |
| 61:52 | — | Reserved, SBZ |
| 51:12 | Backing Page Pointer | 4-Kbyte-aligned system physical address of this vCPU's vAPIC backing page |
| 11:0 | Host Physical APIC ID | Physical APIC ID of the core hosting the vCPU. **Not valid unless `IR` is set** |

`IR` means only that the VMM has **assigned** a physical core to the vCPU; it does not distinguish a core currently executing guest software from one that has suspended guest execution and is in host mode. The table may be populated sparsely. With `CPUID Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) = 0 it is fixed at 4 Kbytes, allowing at most **512** vCPUs per VM; with the bit set it may span up to **eight consecutive 4-Kbyte pages**, the page count being `AVIC_PHYSICAL_MAX_INDEX[11:9] + 1` (Vol.3 restates this as "4096 vCPUs supported in x2AVIC mode"). In **xAVIC** mode it occupies only the **lower half** of its page — 256 eight-byte entries — and physical APIC ID FFh is reserved because FFh means broadcast; the upper 2048 bytes are reserved and should be zero. `[APM2 §15.29.5.2]`, `[APM2 Figure 15-18]` `[1]`

**Logical APIC ID Table entry** — indexed by logical ID, **32 bits** per entry: `[APM2 Table 15-24]` `[1]`

| Bit(s) | Field | Description |
|---|---|---|
| 31 | `V` | Valid. Set = this entry holds a valid physical APIC ID |
| 30:8 | — | Reserved, SBZ |
| 7:0 | Guest Physical APIC ID | The guest physical APIC ID selected when logically addressed |

One entry per logically addressed APIC, which implies **each vAPIC's logical ID must be unique**; if the guest changes its APIC's logical ID the VMM must mirror the change. In **flat mode** only the first 8 entries are used and the byte offset for `l_apic_id` is `4 * log2(l_apic_id)`. In **cluster mode** bits 7:4 are the cluster number and 3:0 the bit-encoded APIC index (cluster Fh reserved), offset `(16 * c) + 4 * log2(apic_ix)`. **In x2AVIC mode the Logical APIC ID Table is not used at all** — the destination logical ID is derived arithmetically as `Logical x2APICID = (X2APICID[19:4] << 16) | (1 << X2APICID[3:0])`. `[APM2 §15.29.5.3]` `[1]`

**The pointers in the VMCB** — AMD's own names, and note `V_APIC_BAR` is at **098h**, not 038h: `[APM2 §15.29.4.2]`, `[APM2 Table B-1]` `[1]`

| Byte offset | Table B-1 name | Field |
|---|---|---|
| 098h | `AVIC APIC_BAR` (`V_APIC_BAR`) | bits 51:0; 63:52 RESERVED, SBZ |
| 0E0h | `AVIC APIC_BACKING_PAGE Pointer` | bits 51:0; 63:52 RESERVED, SBZ |
| **0F0h** | **`AVIC LOGICAL_TABLE Pointer`** | bits 51:12; 11:0 and 63:52 reserved |
| **0F8h** | **`AVIC PHYSICAL_TABLE Pointer[51:12]`** | bits 51:12; 63:52 reserved |
| 0F8h | `AVIC_PHYSICAL_MAX_INDEX` | bits 11:0 — index of the last guest physical core ID |

The forms `AVIC_LOGICAL_PAGE` and `AVIC_PHYSICAL_PAGE` appear nowhere in the manual and must not be used. All four pointers are evaluated on VMRUN, must lie in legal implementation-supported physical address ranges, must be mapped write-back cacheable, and cause a `#VMEXIT` if out of range. All point to 4-Kbyte-aligned structures so bits 11:0 are reserved — **except at 0F8h**, where those bits are `AVIC_PHYSICAL_MAX_INDEX`. VMRUN fails with `#VMEXIT(VMEXIT_INVALID)` if `AVIC_PHYSICAL_MAX_INDEX` exceeds **255 in xAVIC mode**, or **511 in x2AVIC mode when `Fn8000_000A_ECX[6]` is 0**. These pointers are covered by clean bit 11 (`AVIC`). `[APM2 §15.29.4.3]` `[1]`
**Confidence:** high (`C:high` `V:durable`).

---

### avic-doorbell-msr
**Routed to:** `07-virtual-interrupts-avic.md` §7.6 "The AVIC doorbell" — **landed short.** The SKILL.md routing row names the doorbell as a topic but anchors only §7.1 and §7.8, and `00-quickref.md` §0.3 has no doorbell row; §7.6 was found from the chapter's own heading list. (`01-svm-intro.md` §1.4's MSR table also forwards `C001_011Bh` to this chapter.) Right chapter, anchor not supplied by either navigation table.
**Answer:** The doorbell is how a *remote* agent — another core sending an IPI, or the IOMMU delivering a device interrupt — tells the core currently running the target vCPU that its backing page has changed.

**The register: `Doorbell Register`, MSR `C001_011Bh`.** Bits **7:0** hold the destination Physical APIC ID; bits **63:8** are Reserved, MBZ. `[APM2 Figure 15-22]` `[1]` (Also listed at that address in `01-svm-intro.md` §1.4's Appendix A MSR table, `[APM2 App.A]` `[1]`.)

**If you read it: `#GP`.** Writing the register sends the doorbell signal to that physical core; **any attempt to read the register raises `#GP`**. `[APM2 §15.29.8.2]` `[1]`

Three further properties:
- Every core provides a doorbell mechanism used by other cores (for IPIs) and by the IOMMU (for device interrupts). The **exact mechanism is implementation-specific** but must be protected from non-privileged software on other cores and from direct access by an external device. `[APM2 §15.29.8.2]` `[1]`
- **The serializing semantics of `WRMSR` are relaxed** when writing the Doorbell Register — Vol.3's `WRMSR` page states the same exception for "some x2APIC and AVIC MSRs". `[APM3 §4 "WRMSR"]` `[2]`
- A doorbell delivered to a running guest is recognized **whether or not the interrupt can be injected immediately**; on the next VMRUN the delivery mechanism re-reads the IRR in the backing page, finds the highest-priority pending interrupt and injects it if masking and priority allow. VMRUN itself re-evaluates APIC state on guest entry and recognizes any doorbell received during VMRUN processing immediately after entering the guest. `[APM2 §15.29.8.2]`, `[APM2 §15.29.8.3]` `[1]`

In the IPI path, the doorbell is sent at step 5 using the **Host Physical APIC ID from the Physical APIC ID Table entry**, and only if that entry's `IsRunning` bit is set; if any destination was not scheduled on a physical core, a `#VMEXIT` results. `[APM2 §15.29.6.1]` `[1]`
**Confidence:** high (`C:high` `V:durable`).

---

### iommu-control-register-bits
**Routed to:** `08-iommu-architecture.md` §8.3 "Control and Status registers", IOMMU Control Register MMIO 0018h — right first time
**Answer:** Three bits, all in the **IOMMU Control Register at MMIO offset 0018h**:

| Purpose | Bit | Field |
|---|---|---|
| Translation | **0** | **`IommuEn`** |
| Command processing | **12** | **`CmdBufEn`** |
| Event log | **2** | **`EventLogEn`** |

`[IOMMU 3.11 §3.4.1]` `[7]`

**Ordering requirement:** the **Device Table Base Address Register must be configured before `IommuEn` is set**. `[IOMMU 3.11 §3.4.1]` `[7]`

Two companions you will likely also want: **`EventIntEn` (bit 3)** to raise an interrupt on event-log writes, and **`ComWaitIntEn` (bit 4)** for `COMPLETION_WAIT` interrupts.

**The trap — this is `errata.md` E01.** `CmdBufRun` is **not** the enable and is **not in this register**. It is a **read-only status bit at bit 4 of the IOMMU Status Register, MMIO offset 2020h**. The control that starts or restarts command-buffer processing is `CmdBufEn`, bit 12 of the Control Register at 0018h — two different registers that must not be conflated. `CmdBufRun` is level-sensitive: once 1 it stays 1 until command processing stops for cause, and once 0 it stays 0 until software writes `CmdBufEn`=1. `[IOMMU 3.11 §3.4]`, `[IOMMU 3.11 §3.4.16]` `[7]`

Two operational notes for bring-up:
- An overflow bit **latches logging off**: while `EventOverflow` (Status bit 0) is set the IOMMU writes no new entries even though `EventLogRun` (Status bit 3) still reads 1. Restarting any halted log takes the same four steps — wait for the `…Run` bit to read 0, clear the matching `…En` bit in 0018h, reprogram base/head/tail as needed, write 1 to the overflow status bit to clear it (RW1C), then set the `…En` bit again. `[IOMMU 3.11 §3.4.16]`, `[IOMMU 3.11 §2.5.1]` `[7]`
- The IOMMU **stops fetching commands** after a `COMMAND_HARDWARE_ERROR` or an `ILLEGAL_COMMAND_ERROR`, and the command head pointer does not advance past the offending entry. `[IOMMU 3.11 §2.4]` `[7]`

The full 0018h bit assignment is in §8.3; other bits of note for a passthrough bring-up are `GTEn`(16), `GAEn`(17), `PPREn`(15), `PPRLogEn`(13), `GALogEn`(28), `XTEn`(50) and `InvTimeOut[7:5]`.
**Confidence:** high (`C:high` `V:durable`); the `CmdBufEn`/`CmdBufRun` distinction is a settled errata entry (E01).

---

### iommu-event-codes
**Routed to:** `08-iommu-architecture.md` §8.8 "Log entry formats: event, PPR and GA" — right first time
**Answer:** **Reading an event record.** The event log is a circular buffer of **16-byte (128-bit) records**. Every record is a **4-bit `EventCode` at bits 31:28 of dword +04**, plus a **60-bit first operand** (dword +00 and bits 27:0 of +04) and a **64-bit second operand** (dwords +08 and +12). `[IOMMU 3.11 Figure 54]` `[7]`

**The fourteen codes** — 0001b through 1110b; **0000b and 1111b are not assigned**: `[IOMMU 3.11 §2.5]` `[7]`

| EventCode | Event | § |
|---|---|---|
| 0001b | `ILLEGAL_DEV_TABLE_ENTRY` | 2.5.2 |
| 0010b | `IO_PAGE_FAULT` | 2.5.3 |
| 0011b | `DEV_TAB_HARDWARE_ERROR` | 2.5.4 |
| 0100b | `PAGE_TAB_HARDWARE_ERROR` | 2.5.5 |
| 0101b | `ILLEGAL_COMMAND_ERROR` | 2.5.6 |
| 0110b | `COMMAND_HARDWARE_ERROR` | 2.5.7 |
| 0111b | `IOTLB_INV_TIMEOUT` | 2.5.8 |
| 1000b | `INVALID_DEVICE_REQUEST` | 2.5.9 |
| 1001b | `INVALID_PPR_REQUEST` | 2.5.10 |
| 1010b | `EVENT_COUNTER_ZERO` | 2.5.11 |
| 1011b | `GUEST_EVENT_FAULT` | 2.5.12 |
| 1100b | `VIOMMU_HARDWARE_ERROR` | 2.5.13 |
| 1101b | `RMP_PAGE_FAULT` | 2.5.14 |
| 1110b | `RMP_HARDWARE_ERROR` | 2.5.15 |

**Decode from the per-event figures, not from Table 42.** Table 42, the summary table in §2.5, is **stale relative to the sections it summarises**: it prints 1001b for *both* `INVALID_PPR_REQUEST` and `EVENT_COUNTER_ZERO` and declares 1010b–1111b reserved, while §2.5.11–§2.5.15 assign 1010b–1110b. `[IOMMU 3.11 Table 42]` `[7]`

Common header bits: `VCmd`(31), `VPpr`(30) and `VEvent`(29) of dword +00 say the event arose while processing a virtualized command buffer, PPR log or event log, and `VNR`(27) says the vIOMMU context is unrecoverable; all four are reserved and read 0 when vIOMMU is disabled. `[IOMMU 3.11 §2.5.2]` `[7]`

Two record shapes worth having:
- **`IO_PAGE_FAULT` (0010b):** `DeviceID[15:0]` and `PASID[19:16]` in dword +00; the flag byte `TR`(24) `RZ`(23) `PE`(22) `RW`(21) `PR`(20) `I`(19) `US`(18) `NX`(17) `GN`(16) plus `D/P[15:0]` in dword +04; the full 64-bit device virtual address in dwords +08 and +12. **`D/P[15:0]` is overloaded**: the DomainID from the DTE when GN=0 (or guest translation unsupported), the low 16 bits of the guest PASID when GN=1; zero where neither exists. `[IOMMU 3.11 Figure 56]`, `[IOMMU 3.11 Table 57]` `[7]`
- **`ILLEGAL_DEV_TABLE_ENTRY` (0001b):** same header, narrower flag set — `TR`(24), `RZ`(23), `RW`(21), `I`(19), `GN`(16) and `PASID[15:0]`; address field is the DVA the device attempted, bits 1:0 reserved. `[IOMMU 3.11 Figure 55]` `[7]`

Three decoding rules:
- **`RZ` distinguishes the two structural failure modes throughout: 1 = a non-zero reserved bit, 0 = an invalid level encoding.** `[IOMMU 3.11 Table 56]` `[7]`
- **In hardware-error records the address field is not the address the device wanted.** `DEV_TAB_HARDWARE_ERROR` reports the sPA of the failed Device Table access, `PAGE_TAB_HARDWARE_ERROR` the address of the page table entry, `ILLEGAL_COMMAND_ERROR` and `COMMAND_HARDWARE_ERROR` the address of the command itself, and `IOTLB_INV_TIMEOUT` the address of the invalidation command that timed out. Their `Type` field encodes 00b invalid `COMPLETION_WAIT` store address on an SNP-enabled system, 01b Master Abort, 10b Target Abort, 11b Data Error. `[IOMMU 3.11 §2.5.4]`, `[IOMMU 3.11 Table 58]` `[7]`
- The log is **full** when all slots but one are used, and has **overflowed** when an event arrives that would consume the last free slot; the IOMMU then sets `Status[EventOverflow]` and **discards** the record. `[IOMMU 3.11 §2.5]` `[7]`

(For contrast: PPR records share the 16-byte shape with a `PPRCode` in place of `EventCode` and define only 0001b `PAGE_SERVICE_REQUEST`; GA log records are **8 bytes**, not 16.)
**Confidence:** high (`C:high` `V:durable`); Table 42's staleness is recorded as a defect in AMD's own document.

---

### dte-translation-fields
**Routed to:** `08-iommu-architecture.md` §8.6 "The Device Table Entry" — right first time
**Answer:** **Size and indexing.** The Device Table is an array of **256-bit (32-byte) entries indexed directly by the 16-bit DeviceID**, so a fully populated table is 65,536 entries and **2 Mbytes**. It must be 4-Kbyte aligned and a multiple of 4 Kbytes long. The IOMMU reads a DTE in a **single 256-bit transaction**; AMD notes earlier revisions allowed two 128-bit reads but **no version of IOMMU hardware ever implemented that option**. `[IOMMU 3.11 §2.2.2]` `[7]`

**The fields you asked for:** `[IOMMU 3.11 Figure 7]`, `[IOMMU 3.11 Table 7]` `[7]`

| Field | Bits |
|---|---|
| `V` | **0** |
| `TV` | **1** |
| `Mode[2:0]` | **11:9** |
| Host Page Table Root Pointer[51:12] | **51:12** |
| `DomainID[15:0]` | **79:64** |

**`Mode[11:9]`** gives the depth of the host page tables and therefore the reachable GPA width: 000b translation disabled (SPA = GPA, access still gated by IR/IW), 001b 1 level / 21-bit, 010b 2 / 30-bit, 011b 3 / 39-bit, 100b 4 / 48-bit, 101b 5 / 57-bit, 110b 6 / 64-bit, 111b reserved and reported as an event when V=1 and TV=1. `[IOMMU 3.11 Table 7]` `[7]`

**`V`(0) and `TV`(1) are not the same switch.** `V` validates bits [127:1] of the entry; `TV` validates the **translation** fields specifically — IW, IR, the page table root pointer, Mode and GV. With **V=0** every address from that device is forwarded untranslated and all other control fields are ignored (the interrupt half is governed separately by `IV`(128)). With **V=1 and TV=0** the SysMgt, EX, SD, Cache, IoCtl, SA, SE and I fields are still valid and the DomainID is still used for event-log entries, but any required table walk is terminated and Mode and the page table root pointer are ignored. `[IOMMU 3.11 Table 8]` `[7]`

**`DomainID[79:64]`** is the 16-bit software-chosen tag the IOMMU stamps on its internal translation caches and on event log entries. **Devices sharing a DomainID must have identical `Mode` and page table root pointer values or IOMMU behaviour is undefined**, though they may differ in `I` and `SysMgt`. The DomainID recorded in an event log entry is undefined when V=0 and IV=1, and software is told to give devices with `GIoV`=1 unique DomainIDs. `[IOMMU 3.11 Table 7]` `[7]`

Two adjacent facts that bite in practice:
- The **GCR3 table root pointer is stored in three discontiguous slices** — bits 127:107 hold GCR3 TRP[51:31], bits 95:80 hold [30:15] and bits 60:58 hold [14:12] — used only when V=1, TV=1 and GV=1.
- On an **SNP-enabled system software must set DTE[V]=1 for every device**; DMA from a device with V=0 is aborted with `ILLEGAL_DEV_TABLE_ENTRY`. `[IOMMU 3.11 §2.12.2.4]` `[7]`

**Changing an entry safely:** the interrupt half may be changed with one 64-bit write and the translation half with one 128-bit write; either change must be followed by `INVALIDATE_DEVTAB_ENTRY` whenever IV=1 or V=1 held before the change. When an atomic write is impossible and V=0 beforehand, fields may be written in any order provided the **last write sets V=1**; when V=1 beforehand, IW and IR must be written before or with the change to Mode, and **TV and V must be in the final write**. Note also that `INVALIDATE_DEVTAB_ENTRY` does **not** invalidate translation-cache entries, so removing a device from a domain also requires `INVALIDATE_IOMMU_PAGES` for that DomainID — AMD explicitly retracts the older statement that this was unnecessary when other devices shared the DomainID. `[IOMMU 3.11 §2.2.2.2]`, `[IOMMU 3.11 §2.4.2]` `[7]`
**Confidence:** high (`C:high` `V:durable`); the SEV-TIO DTE reservation list carries `C:medium`.

---

### irte-guest-mode-format
**Routed to:** `10-iommu-interrupt-remapping.md` §10.2 "The 128-bit guest vAPIC entry" → "The virtualized entry, `GuestMode=1`" — right first time (routing row §10.1–§10.3)
**Answer:** The 128-bit `GuestMode=1` IRTE posts the interrupt into a guest's virtual APIC instead of delivering it to a physical local APIC. It is available when the IOMMU supports the guest virtual APIC (`MMIO Offset 0030h[GASup]=1`) and software enables it.

| Bits | Field | Meaning |
|---|---|---|
| 127:116 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| **115:76** | **`Guest Virtual APIC Table Root Pointer`** | the system physical address of the APIC backing page when `RemapEn=1` |
| 75:72 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| **71:64** | **`Vector`** | used to compute the address inside the backing page |
| **63:32** | **`GATag[31:0]`** | written verbatim into the GA log entry |
| 31:16 | Reserved | — |
| **15:8** | **`Destination[7:0]`** | destination core for the guest virtual APIC doorbell message |
| **7** | **`GuestMode`** | must be 1 in this format |
| **6** | **`IsRun`** | 1 = the guest is running and can take the interrupt; 0 = log it instead |
| **5** | **`GAPPIDis`** | 1 = suppress the GAPPI notification but keep updating the IRR |
| 4:3 | Reserved | — |
| **2** | **`GALogIntr`** | 1 = write a GA log entry when `IsRun=0`; 0 = suppress it |
| **1** | **`SupIOPF`** | not governed by `RemapEn` |
| **0** | **`RemapEn`** | validity of every other field |

`[IOMMU 3.11 Table 23]` `[7]`

Four rules attached to it:
- **`RemapEn=0` makes hardware ignore the whole entry except `SupIOPF`**, and an interrupt that lands on it raises an `IO_PAGE_FAULT` rather than being silently dropped. `[IOMMU 3.11 Table 23]` `[7]`
- `GAPPIDis` is meaningful only when `GuestMode=1` **and** `MMIO Offset 0018h[GAPPIEn]=1`, and is reserved when `MMIO Offset 01A0h[GAPPIDisSup]=0`. `[IOMMU 3.11 Table 23]` `[7]`
- **Caching:** with `GAEn=1` and `GuestMode=1` the IOMMU does **not** cache `IsRun`, `Destination`, `GALogIntr`, `GAPPIDis` or `GATag`, so changing any of them needs **no invalidation**. If `RemapEn` was already 1, update atomically and then invalidate the interrupt remapping table only if a *cacheable* field changed. `[IOMMU 3.11 §2.2.5.2]`, `[IOMMU 3.11 §2.3.2]` `[7]`
- **Enablement:** the 128-bit formats are selected by `GASup`/`GAMSup` in `MMIO Offset 0030h` together with `GAEn`/`GAMEn` in `MMIO Offset 0018h` — `GASup=1` with `GAMSup=000b` and `GAEn=1` gives the wide `GuestMode=0` remapping entry, and `GASup=1` with `GAMSup=001b`, `GAEn=1` and `GAMEn=001b` additionally gives this virtualized entry. **Software must program every IOMMU in a system to use the same IRTE size**, i.e. the same `GAEn` and `GAMEn` on all of them. `[IOMMU 3.11 Table 21]`, `[IOMMU 3.11 §2.2.5.2]` `[7]`

Note on the destination width: in x2APIC mode (`MMIO 0x30[XTSup]=1`, `MMIO 0x18[XTEn]=1`, `MMIO 0x18[GAEn]=1`) the destination is split — `Destination[31:24]` at IRTE bits **127:120** and `Destination[23:0]` at bits **31:8** — and `Destination[31:8]` is reserved and must be zero when `XTSup=0` or `XTEn=0`. `[IOMMU 3.11 Figure 20]`, `[IOMMU 3.11 §2.2.5.3]` `[7]`

Spelling: bit 0 is **`RemapEn`** — `RemapEm` appears nowhere in the specification (`errata.md` E03, `[IOMMU 3.11 §2.2.5]`).
**Confidence:** high (`C:high` `V:durable`).

---

### fn8000-001f-fields
**Routed to:** `11-memory-encryption.md` §11.2 "Enumerating memory encryption: `Fn8000_001F`" (incl. §11.2.2 worked decode) — right first time
**Answer:** `Fn8000_001F` is the single leaf answering "what memory encryption does this part have, and how do I use it". Its four registers carry, respectively, a feature bitmap, the geometry of the C-bit, the ASID ceiling and the ASID floor. It is a plain leaf with **no subfunction**. Everything in it is implementation-specific and **none of it may be hardcoded**.

**EAX — the feature bitmap** `[APM3 App.E]` `[2]`:

| Bit | Field | Bit | Field |
|---|---|---|---|
| 31 | `IbpbOnEntry` | 15 | `PreventHostIbs` |
| 30 | `HvInUseWrAllowed` | 14 | `DebugVirt` |
| 29 | `NestedVirtSnpMsr` | 13 | `AlternateInjection` |
| 28 | `SvsmCommPageMsr` | 12 | `RestrictedInjection` |
| 27 | `AllowedSevFeatures` | 11 | `64BitHost` |
| 26 | `SecureAvic` | 10 | `HwEnfCacheCoh` |
| 25 | `SmtProtection` | 9 | `TscAuxVirtualization` |
| 24 | `VmsaRegProt` | 8 | `SecureTsc` |
| 23 | `SegmentedRmp` | 7 | `VmplSSS` |
| 22 | `GuestInterceptCtl` | 6 | `RMPQUERY` |
| 21 | `RMPREAD` | 5 | `VMPL` |
| 20 | `PmcVirtGuestCtl` | 4 | `SEV-SNP` |
| 19 | `IbsVirtGuestCtl` | 3 | `SEV-ES` |
| 18 | `VirtualTomMsr` | 2 | `PageFlushMsr` |
| 17 | `VmgexitParameter` | 1 | `SEV` |
| 16 | `VTE` | 0 | `SME` |

**EBX — three packed fields plus one flag** `[APM3 App.E]` `[2]`:
- **`CbitPosition` in bits 5:0** — the C-bit's location in a page-table entry
- **`PhysAddrReduction` in bits 11:6** — the physical-address bit reduction
- **`NumVMPL` in bits 15:12** — the number of VM permission levels
- bits 30:16 reserved; **bit 31 `COHERENCY_SFW_NO`** — indicates the software workaround for the SEV-SNP cache-coherency issue of AMD-SB-3017 is *not* needed

**ECX[31:0]** is **`NumEncryptedGuests`**, the number of encrypted guests supported simultaneously. **EDX[31:0]** is **`MinSevNoEsAsid`**, the minimum ASID value usable by a guest that enables SEV with SEV-ES disabled. `[APM3 App.E]` `[2]`

**Extracting the C-bit position** — three independent masks, because three fields share EBX's low 16 bits:

```
EBX = 0000_0173h
  CbitPosition      = EBX        & 0x3F  = 0x33 = 51
  PhysAddrReduction = (EBX >> 6) & 0x3F  = 0x05 = 5
  NumVMPL           = (EBX >> 12) & 0xF  = 0x0  = 0   (no VMPL support on this part)
```

**A decode that treats the low byte as a position is wrong whenever `PhysAddrReduction` is non-zero.** `[APM3 App.E]` `[2]`

Two working rules the chapter states: the C-bit position and the physical-address reduction are **independent fields** — the manual defines each separately and never states an arithmetic relationship, so deriving one from the other is a guess. And `CbitPosition` **can name a bit above the part's reported physical-address width** (`Fn8000_0008_EAX[7:0]`, `PhysAddrSize`), in which case the C-bit is a page-table attribute bit rather than an address bit and no address space is lost to it directly. `Fn8000_001F_EBX` neither contains `PhysAddrSize` nor is derivable from it.

Probing discipline: test the *feature* bit before reading any dependent field — `CbitPosition` is only meaningful when `EAX[0]` is set, `NumVMPL` only when `EAX[5]` is set. A part can report `SME` without `SEV`, and reports `SEV-SNP = 0` while still reporting `SEV = 1`.

Where the APM sends you: support is reported in `Fn8000_001F[EAX]`, and when present `Fn8000_001F[EBX]` supplies the additional information needed to use it, including which page-table bit marks a page encrypted `[APM2 §7.10.1]` `[1]`; the APM directs readers to **Volume 3 section E.4.17** for the complete CPUID detail `[APM2 §7.10.1]` `[1][2]`.
**Confidence:** high (`C:high` `V:durable`).

---

### sev-status-bit-map
**Routed to:** `12-sev.md` §12.6 "The `SEV_STATUS` MSR" — right first time
**Answer:** **Address: `C001_0131h`.** Guests read the currently active SEV features from `SEV_STATUS`, which reports which features were enabled in the **last VMRUN** for that guest. It is **read-only**, accesses to it **cannot be intercepted by the hypervisor**, and it is available on every processor that supports SEV. `[APM2 §15.34.10]` `[1]`

| Bit | Field | Source |
|---|---|---|
| 63:24 | Reserved | — |
| 23 | `IbpbOnEntry_Active` | `SEV_FEATURES[21]` |
| 22:19 | Reserved (see note) | — |
| 18 | `SecureAVIC_Active` | `SEV_FEATURES[16]` |
| 17 | `SmtProtection_Active` | `SEV_FEATURES[15]` |
| 16 | `VmsaRegProt_Active` | `SEV_FEATURES[14]` |
| 15 | `GuestInterceptCtl_Active` | `SEV_FEATURES[13]` |
| 14 | `IbsVirtualization_Active` | `SEV_FEATURES[12]` |
| 13 | `PmcVirtualization_Active` | `SEV_FEATURES[11]` |
| 12 | `VmgexitParameter_Active` | `SEV_FEATURES[10]` |
| 11 | `SecureTsc_Active` | `SEV_FEATURES[9]` |
| 10 | `VmplSSS_Active` | `SEV_FEATURES[8]` |
| 9 | `SNPBTBIsolation_Active` | `SEV_FEATURES[7]` |
| 8 | `PreventHostIBS_Active` | `SEV_FEATURES[6]` |
| 7 | `DebugVirtualization_Active` | `SEV_FEATURES[5]` |
| 6 | `AlternateInjection_Active` | `SEV_FEATURES[4]` |
| 5 | `RestrictedInjection_Active` | `SEV_FEATURES[3]` |
| 4 | `ReflectVC_Active` | `SEV_FEATURES[2]` |
| 3 | `vTOM_Active` | `SEV_FEATURES[1]` |
| 2 | `SNP_Active` | `SEV_FEATURES[0]` |
| 1 | `SEV_ES_Enabled` | VMCB offset `90h` |
| 0 | `SEV_Enabled` | VMCB offset `90h` |

`[APM2 §15.34.10]` `[1]`

**Relationship to `SEV_FEATURES`: the two are the same feature set offset by two.** Bits 0 and 1 are sourced from the **VMCB** (offset 90h), and **every bit from 2 upward mirrors `SEV_FEATURES[n − 2]`** in the VMSA — which is why `DebugVirtualization` is `SEV_FEATURES[5]` but `SEV_STATUS[7]`. A table written in `SEV_FEATURES` terms, such as a Linux header or a paper, is offset by exactly two from this one and **is not in conflict with it**; "correcting" AMD's table to match the header is the error `errata.md` E24 exists to prevent. `[APM2 §15.34.10]` `[1]`

**AMD's own table has a typographical defect.** Table 15-32 prints a row reading "22-18 Reserved" immediately above the row that defines bit 18 as `SecureAVIC_Active`. The two cannot both be true; **read the reserved range as 22:19.** Noted rather than silently corrected because a reader checking against the PDF will see the printed form.

**Naming:** AMD's name for bit 7 is **`DebugVirtualization`**. "Debug Swap" is the Linux-side name and appears nowhere in AMD's documentation (`errata.md` E24, `00-quickref.md` §0.4).

**What is not in `SEV_STATUS`:** there is **no bit for SEV-SNP *support***, only for SNP being *active* for this VM. Support lives in `Fn8000_001F_EAX[4]`, global enablement in `SYSCFG[SecureNestedPagingEn]`, and per-VM activation here — three separate conditions, in that order.
**Confidence:** high (`C:high` `V:durable`); the 22:18/22:19 reserved-range conflict is a documented defect in AMD's table, reported not resolved.

---

### sev-firmware-error-codes
**Routed to:** `12-sev.md` §12.8 "The firmware command set" → §12.8.2 "Status codes" — right first time
**Answer:** The status code is a **16-bit value in bits 15:0 of `CmdResp`** on a response (bit 31 = 1 marks a response; bits 25:16 carry the Command ID). `[SEV-API 3.24 §4.1.1]` `[8]`

The defined values, from Table 14 of the SEV API (pub **55766 rev 3.24**, which covers **SEV and SEV-ES only** — SNP firmware commands are in 56860):

| Code | Name | Code | Name |
|---|---|---|---|
| `0x0000` | `SUCCESS` | `0x000D` | `INVALID_ASID` |
| `0x0001` | `INVALID_PLATFORM_STATE` | `0x000E` | `WBINVD_REQUIRED` |
| `0x0002` | `INVALID_GUEST_STATE` | `0x000F` | `DF_FLUSH_REQUIRED` |
| `0x0003` | `INVALID_CONFIG` | `0x0010` | `INVALID_GUEST` |
| `0x0004` | `INVALID_LENGTH` | `0x0011` | `INVALID_COMMAND` |
| `0x0005` | `ALREADY_OWNED` | `0x0012` | `ACTIVE` |
| `0x0006` | `INVALID_CERTIFICATE` | `0x0013` | `HWERROR_PLATFORM` |
| `0x0007` | `POLICY_FAILURE` | `0x0014` | `HWERROR_UNSAFE` |
| `0x0008` | `INACTIVE` | `0x0015` | `UNSUPPORTED` |
| `0x0009` | `INVALID_ADDRESS` | `0x0016` | `INVALID_PARAM` |
| `0x000A` | `BAD_SIGNATURE` | `0x0017` | `RESOURCE_LIMIT` |
| `0x000B` | `BAD_MEASUREMENT` | `0x0018` | `SECURE_DATA_INVALID` |
| `0x000C` | `ASID_OWNED` | `0x001F` | `RB_MODE_EXITED` |

The numbering is **contiguous from `0x0000` to `0x0018` and then jumps to `0x001F` `RB_MODE_EXITED`**, returned when a Mailbox-mode command arrives while the firmware is in Ring Buffer mode; Ring Buffer mode is then exited, the command is ignored, and a retry is recommended. `[SEV-API 3.24 Table 14]` `[8]`

**The two that are nearly identical: `HWERROR_PLATFORM` (`0x0013`) and `HWERROR_UNSAFE` (`0x0014`).** They differ in exactly one respect: **after `HWERROR_PLATFORM` it is safe to re-allocate the parameter buffers, and after `HWERROR_UNSAFE` it is not.** `[SEV-API 3.24 Table 14]` `[8]`

Two adjacent facts worth having when a command fails:
- **`INVALID_ADDRESS`** is returned for any pointer whose **bits 46:43 are non-zero**, that overlaps `TSseg` or `ASeg`, that is above the maximum physical address `7FD_0000_0000`, or that lies within a Trusted Memory Region disallowing x86 access. All pointers passed to the firmware are 64-bit system physical addresses. `[SEV-API 3.24 §4.8]` `[8]`
- The API processes commands **serially**: software must not issue a further command before receiving the response to the previous one, and any command sent early must be ignored by the firmware with no change to the platform or any guest context. `[SEV-API 3.24 §4.7]` `[8]`

Spelling note (`00-quickref.md` §0.4): AMD's Table 14 name is **`WBINVD_REQUIRED`**; `SEV_RET_WBINVD_REQUIRED` is the Linux spelling.
**Confidence:** high (`C:high` `V:durable`). Note the source document is rev 3.24 dated **2020-04** — the oldest in the normative set — and covers SEV/SEV-ES only.

---

### ghcb-layout-offsets
**Routed to:** `13-sev-es-ghcb.md` §13.4 "The GHCB layout" (incl. §13.4.1) — right first time
**Answer:** Full layout, from GHCB spec pub **56421 rev 2.04**:

| Offset | Size | Contents | Versions |
|---|---|---|---|
| `0x0000` | `0xcb` | RESERVED | — |
| `0x00cb` | `0x01` | `CPL` | All |
| `0x00cc` | `0x74` | RESERVED | — |
| `0x0140` | `0x08` | `XSS` | **2+** |
| `0x0148` | `0x18` | RESERVED | — |
| `0x0160` | `0x08` | `DR7` | All |
| `0x0168` | `0x90` | RESERVED | — |
| `0x01f8` | `0x08` | `RAX` | All |
| `0x0200` | `0x100` | RESERVED | — |
| `0x0300` | `0x08` | RESERVED — "RAX already available at `0x01f8`" | — |
| `0x0308` | `0x08` | `RCX` | All |
| `0x0310` | `0x08` | `RDX` | All |
| `0x0318` | `0x08` | `RBX` | All |
| `0x0320` | `0x70` | RESERVED | — |
| `0x0390` | `0x08` | `SW_EXITCODE` — guest controlled exit code | All |
| `0x0398` | `0x08` | `SW_EXITINFO1` — guest controlled exit information 1 | All |
| `0x03a0` | `0x08` | `SW_EXITINFO2` — guest controlled exit information 2 | All |
| `0x03a8` | `0x08` | `SW_SCRATCH` — guest controlled additional information | All |
| `0x03b0` | `0x38` | RESERVED | — |
| `0x03e8` | `0x08` | `XCR0` | All |
| `0x03f0` | `0x10` | `VALID_BITMAP` | All |
| `0x0400` | `0x08` | `X87_STATE_GPA` | All |
| `0x0408` | `0x3f8` | RESERVED | — |
| `0x0800` | `0x7f0` | Shared Buffer | All |
| `0x0ff0` | `0x0a` | RESERVED | — |
| `0x0ffa` | `0x02` | SEV-ES/GHCB Protocol Version | All |
| `0x0ffc` | `0x04` | GHCB Usage | All |

`[GHCB 2.04 Table 3]` `[9]`

**The fields a `#VC` handler fills in** are the four software-controlled words at `0x0390`–`0x03a8`: `SW_EXITCODE`, `SW_EXITINFO1`, `SW_EXITINFO2` and `SW_SCRATCH`, plus whatever guest register state the specific NAE event requires (`RAX` at `0x01f8`, `RCX`/`RDX`/`RBX` at `0x0308`/`0x0310`/`0x0318`, `CPL`, `DR7`, `XCR0`, `XSS`), and the matching valid bits.

**Only `XSS` is version-gated** (GHCB protocol version 2 and later); every other defined field is present in all versions.

**Trap:** the eight-byte slot at **`0x0300` is reserved** with the explicit note that RAX is already available at `0x01f8` — a hypervisor that copies the VMSA layout verbatim into the GHCB will read the wrong slot for RAX. `[GHCB 2.04 Table 3]` `[9]`

**`VALID_BITMAP`** — 16 bytes at `0x03f0`, marking which qwords of the save-state area from offset `0x000` through `0x3ef` (**126 qwords**) the sender has filled in. The bit index is derived arithmetically: divide the field's byte offset by 8 to get the qword offset; the `VALID_BITMAP` byte offset is that qword offset divided by 8, and the bit within that byte is the qword offset modulo 8. **AMD's worked example: RAX at `0x01f8` gives qword 63, byte 7, bit 7.** At a minimum the **guest** must set the valid bits for `SW_EXITCODE`, `SW_EXITINFO1` and `SW_EXITINFO2`, and the **hypervisor** must set them for `SW_EXITINFO1` and `SW_EXITINFO2`. **Both sides must clear the whole bitmap before setting the bits for the event being performed** — the guest before each NAE event, the hypervisor before writing results. `[GHCB 2.04 Table 3]`, `[GHCB 2.04 §4]` `[9]`

**Version and usage words:**
- **SEV-ES/GHCB Protocol Version at `0x0ffa`** (2 bytes): `0x0001` for protocol version 1, `0x0002` for version 2.
- **GHCB Usage at `0x0ffc`** (4 bytes): `0x00000000` means the page follows the documented format; **any other value is hypervisor-defined** (for example a hypercall format). On VMGEXIT the hypervisor should validate this field, **must support the value `0x0000`**, and for an unsupported value may either terminate the guest or resume it indicating an exception should be raised. `[GHCB 2.04 Table 3]` `[9]`

The **Shared Buffer at `0x0800`** is `0x7f0` bytes, and AMD commits that future versions of the specification **will not alter its definition** — which is why it is the buffer of choice for string I/O and MMIO staging. `X87_STATE_GPA` holds the GPA of a page containing x87-related state in the format produced by XSAVE. `[GHCB 2.04 Table 3]` `[9]`
**Confidence:** high (`C:high` `V:durable`).

---

### snp-instructions-and-return-codes
**Routed to:** `14-sev-snp.md` §14.4 "The SNP instructions" — right first time
**Answer:** **Six** instructions, all in APM Vol.3 Chapter 4, which is alphabetical and carries page numbers only — **they are cited by mnemonic**, e.g. `[APM3 §4 "PVALIDATE"]`.

| Mnemonic | Opcode | Page (Rev 3.38) | Caller | Enumerated by |
|---|---|---|---|---|
| `PSMASH` | `F3 0F 01 FF` | 432 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |
| `PVALIDATE` | `F2 0F 01 FF` | 435 | guest, **VMPL0 only** | `Fn8000_001F_EAX[SNP]` |
| `RMPADJUST` | `F3 0F 01 FE` | 447 | guest, any VMPL | `Fn8000_001F_EAX[SNP]` |
| `RMPQUERY` | `F3 0F 01 FD` | 451 | guest, any VMPL | `Fn8000_001F_EAX[6]` |
| `RMPREAD` | `F2 0F 01 FD` | 454 | hypervisor, ASID 0 | `Fn8000_001F_EAX[21]` |
| `RMPUPDATE` | `F2 0F 01 FE` | 457 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |

`[APM3 §4 "RMPQUERY"]`, `[APM3 §4 "RMPREAD"]` `[2]`

`RMPQUERY` and `RMPREAD` are later additions and carry **their own CPUID bits** instead of riding on the SNP bit.

**Privilege and mode.** All six are **CPL0-only** (`#GP(0)` otherwise) and **all but `PVALIDATE` are 64-bit-mode-only** (`#UD` otherwise); `PVALIDATE` is recognised in any operating mode at CPL0. The three hypervisor instructions return **`FAIL_PERMISSION` rather than faulting** when executed at an ASID other than 0, while `RMPADJUST` and `RMPQUERY` raise **`#UD`** when the guest is not SNP-active. `PVALIDATE` is **only allowed at VMPL 0** and raises `#GP(0)` at any other VMPL. `[APM3 §4 "PVALIDATE"]`, `[APM3 §4 "RMPADJUST"]`, `[APM3 §4 "PSMASH"]` `[2]`

**The return-code space** (shared; `OF`, `ZF`, `AF`, `PF` and `SF` are all set from the code):

| Code | Name |
|---|---|
| 0 | `SUCCESS` |
| 1 | `FAIL_INPUT` |
| 2 | `FAIL_PERMISSION` |
| 3 | `FAIL_INUSE` |
| 4 | `FAIL_OVERLAP` |
| 6 | `FAIL_SIZEMISMATCH` |
| 7 | `FAIL_BADADDR` |

(Note there is no 5.) **Each instruction publishes only the subset it can produce:** `PSMASH` 0/1/2/3/7 · `PVALIDATE` 0/1/6 · `RMPADJUST` 0/1/2/6 · `RMPQUERY` 0/2 · `RMPREAD` 0/1/2 · `RMPUPDATE` 0/1/2/3/4. **A description that knows only `FAIL_OVERLAP=4` is describing `RMPUPDATE` alone.** `[APM3 §4 "RMPUPDATE"]`, `[APM3 §4 "PSMASH"]`, `[APM3 §4 "PVALIDATE"]`, `[APM3 §4 "RMPQUERY"]` `[2]`

Three behaviours that are easy to get wrong:
- **`PVALIDATE`'s `rFLAGS.CF` is a *changed* indicator, not an error flag.** `CF = 0` means an SNP-active guest actually flipped the bit; `CF = 1` means the bit already held that value **or** the instruction ran outside an SNP-active environment, where it behaves as a NOP and still returns `SUCCESS`.
- **`RMPADJUST` can only delegate downward:** `FAIL_PERMISSION` if `TARGET_VMPL <= CURRENT_VMPL` or if the requested mask contains any bit absent from the caller's own mask. It raises `#VC(PAGE_NOT_VALIDATED)` on an unvalidated page.
- **`RMPREAD` exists because the raw in-memory entry encoding is not architectural.** An entry's address comes from the architectural `GET_RMP_ENTRY_ADDR` pseudocode — `RMP_BASE + 0x4000 + (sPA / 0x1000) × 16` for a non-segmented RMP `[APM3 §2.5.3]` `[2]`.

**Under a nested hypervisor:** a hypervisor running as a guest must replace `RMPUPDATE` and `PSMASH` with WRMSR to **`VIRT_RMPUPDATE` (`C001_F001h`)** and **`VIRT_PSMASH` (`C001_F002h`)**; both MSRs and their enumeration bit `Fn8000_001F_EAX[29]` are **not implemented in the processor** and are expected to be emulated by the top-level hypervisor. `[APM2 §15.36.19]` `[1]`
**Confidence:** high (`C:high` `V:durable`).

---

### attestation-report-fields
**Routed to:** `14-sev-snp.md` §14.11 "The attestation report" — right first time
**Answer:** A guest asks for a report with `SNP_MSG_REPORT_REQ` (64 bytes of `REPORT_DATA` at 00h, the requested VMPL at 40h, `KEY_SEL` in bits 1:0 at 44h). `[SNP-ABI 1.59 Table 26]` `[10]`

**`ATTESTATION_REPORT` layout — AMD's Table 27:** `[SNP-ABI 1.59 Table 27]` `[10]`

| Offset | Size | Field | Offset | Size | Field |
|---|---|---|---|---|---|
| 00h | 4 | `VERSION` | 1A0h | 64 | `CHIP_ID` |
| 04h | 4 | `GUEST_SVN` | 1E0h | 8 | `COMMITTED_TCB` |
| 08h | 8 | `POLICY` | 1E8h | 1 | `CURRENT_BUILD` |
| 10h | 16 | `FAMILY_ID` | 1E9h | 1 | `CURRENT_MINOR` |
| 20h | 16 | `IMAGE_ID` | 1EAh | 1 | `CURRENT_MAJOR` |
| 30h | 4 | `VMPL` | 1EBh | 1 | reserved |
| 34h | 4 | `SIGNATURE_ALGO` | 1ECh | 1 | `COMMITTED_BUILD` |
| 38h | 8 | `CURRENT_TCB` | 1EDh | 1 | `COMMITTED_MINOR` |
| 40h | 8 | `PLATFORM_INFO` | 1EEh | 1 | `COMMITTED_MAJOR` |
| 48h | 4 | flags: `AUTHOR_KEY_EN` b0, `MASK_CHIP_KEY` b1, `SIGNING_KEY` b4:2 | 1EFh | 1 | reserved |
| 4Ch | 4 | reserved MBZ | 1F0h | 8 | `LAUNCH_TCB` |
| 50h | 64 | `REPORT_DATA` | 1F8h | 8 | `LAUNCH_MIT_VECTOR` |
| 90h | 48 | `MEASUREMENT` | 200h | 8 | `CURRENT_MIT_VECTOR` |
| C0h | 32 | `HOST_DATA` | 208h | 24 | reserved MBZ |
| E0h | 48 | `ID_KEY_DIGEST` | 220h | 32 | `CURRENT_ETCB` |
| 110h | 48 | `AUTHOR_KEY_DIGEST` | 240h | 32 | `LAUNCH_ETCB` |
| 140h | 32 | `REPORT_ID` | 260h | 32 | `COMMITTED_ETCB` |
| 160h | 32 | `REPORT_ID_MA` | 280h | 32 | reserved MBZ |
| 180h | 8 | `REPORTED_TCB` | 2A0h | 512 | `SIGNATURE` |
| 188h/189h/18Ah | 1 each | `CPUID_FAM_ID` / `CPUID_MOD_ID` / `CPUID_STEP` | 18Bh–19Fh | 21 | reserved |

The structure runs to **4A0h — 1184 bytes** — and the signature at 2A0h covers **bytes 0h to 29Fh inclusive**.

**Legal `VERSION` values.** The report version has moved across firmware ABI revisions — **3h, then 5h, then 6h — and 4h never existed.** A corpus listing 2/3/5 as the possible values is reporting a stale set rather than an enumeration (`errata.md` E25). The value **current** for a given firmware revision is version-bearing and belongs to `90-dated-landscape.md` — re-verify it there rather than treating any single number as durable. `[SNP-ABI 1.59 Table 27]` `[10]`

Field details worth carrying:
- **`SIGNING_KEY`** (bits 4:2 at offset 48h) encodes 0 legacy VCEK, 1 VLEK, 2 chip-secret VCEK, 3–6 reserved, 7 none. `AUTHOR_KEY_DIGEST` is zero unless `AUTHOR_KEY_EN` is 1.
- **`POLICY`** at 08h is the launch policy verbatim, and **bit 17 of it is reserved and must be one** — which is why the minimal SMT-permitting policy reads `0x30000` (bits 16 and 17), not `0x10000`. `[SNP-ABI 1.59 Table 12]` `[10]`
- **`PLATFORM_INFO`** bits: 0 `SMT_EN`, 1 `TSME_EN`, 2 `ECC_EN`, 3 `RAPL_DIS`, 4 `CIPHERTEXT_HIDING_DRAM_EN`, 5 `ALIAS_CHECK_COMPLETE`, 6 `IOMMU_WRITE_SAFE`, 7 `TIO_EN`, 63:8 reserved. `[SNP-ABI 1.59 Table 28]` `[10]`
- **`CHIP_ID`** is zeroed when `MaskChipId` is set; when `MaskChipKey` is 1 the firmware writes **zeroes into `SIGNATURE`** instead of signing at all. Verifiers are told to check that every reserved field is zero. `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §3.6]` `[10]`
- **`TCB_VERSION` layout differs by product line** — Table 3 "Venice": 23:16 SNP, 15:8 TEE, 7:0 FMC, 63:24 reserved, no boot loader field; Table 4 "Turin": 63:56 MICROCODE, 31:24 SNP, 23:16 TEE, 15:8 BOOT_LOADER, 7:0 FMC; Table 5 "Genoa"/"Milan": 63:56 MICROCODE, 55:48 SNP, 15:8 TEE, 7:0 BOOT_LOADER. **A parser that assumes one layout misreads the others.** `[SNP-ABI 1.59 §2.3]` `[10]`
- **Signature:** the only algorithm the ABI defines is **ECDSA P-384 with SHA-384**, encoding 1h, curve P-384 encoded 2h; 512 bytes holding R at 000h and S at 048h, each zero-extended little-endian, remainder reserved. `[SNP-ABI 1.59 App.B]` `[10]`
- A host can obtain a report **without the guest's participation** using `SNP_HV_REPORT_REQ` (96h); such a report is marked by **`VMPL = 0xFFFFFFFF`** and a zero-filled `REPORT_DATA`. `[SNP-ABI 1.59 §7.3]`, `[SNP-ABI 1.59 §8.33]` `[10]`
- A guest with a migration agent carries the agent's report ID in **`REPORT_ID_MA`**, and a verifier accepting such a report must also verify the migration agent's own report — the agent is inside the guest's TCB. `[SNP-ABI 1.59 §4.11]` `[10]`
**Confidence:** high (`C:high` `V:durable`) for the layout and for "4h never existed"; the **current** VERSION value is `V:dated` and lives in `90-dated-landscape.md`, which carries a 2026-09-21 snapshot that must be re-verified before acting on it.
