# amd-virtualization eval — lookup (24 questions)

Procedure: read `amd-virtualization/SKILL.md` first, then routed each question through
SKILL.md §Routing (falling back to `references/00-quickref.md` §0.3 "Where the tables live"
when the routing row named a chapter-entry section rather than the owning section).
`errata.md` was read once up front, as SKILL.md step 3 requires. No other source used.

---

### amd-document-set
**Routed to:** `references/00-quickref.md` §0.1 (routing row "Document numbers, symptom triage, terminology, where a table lives") — correct route
**Answer:** The normative set, by publication number and the revision this knowledge base was verified against:

| Pub | Document | Rev | Cited as |
|---|---|---|---|
| 24593 | APM Vol.2, System Programming — SVM is Ch.15 | 3.45 (2026-07) | `[APM2 §15.x]`, `[APM2 App.B]` |
| 24594 | APM Vol.3, General-Purpose and System Instructions | 3.38 (2026-07) | `[APM3 §4 "VMRUN"]` |
| 24592 | APM Vol.1, Application Programming | 3.25 (2026-05) | `[APM1 §x]` |
| 48882 | AMD I/O Virtualization Technology (IOMMU) Specification | 3.11 (2026-04) | `[IOMMU 3.11 §x]` |
| 56860 | SEV-SNP Firmware ABI Specification | 1.59 (2026-08) | `[SNP-ABI 1.59 §x]` |
| 56421 | SEV-ES Guest-Hypervisor Communication Block | 2.04 (2025-01) | `[GHCB 2.04 §x]` |
| 55766 | Secure Encrypted Virtualization API — SEV and SEV-ES only | 3.24 (2020-04) | `[SEV-API 3.24 §x]` |
| 58019 | SVSM Guest Communication Interface | 1.01 (2026-03) | `[SVSM 1.01 §x]` |
| 70363 | AMD Memory Encryption white paper — non-normative | 2021-10 | `[MEM-WP 70363 p.n]` |
| 70366 | SEV-SNP white paper — non-normative | 2020-01 | `[SNP-WP 70366 p.n]` |
| 57095 / 58251 | Revision Guides, EPYC Fam 19h / Fam 1Ah — the only public AMD errata | 1.05 / 1.30 | `[RevGuide 57095 erratum 1458]` |

Citation traps the skill names before you go looking for a section number:
1. **APM Vol.3 Chapter 4 is alphabetical and has page numbers, not subsection numbers** — cite an instruction by mnemonic, e.g. `[APM3 §4 "PVALIDATE"]`. `[APM3 §4.7.2 VMRUN]` is a fabrication; that numbering does not exist.
2. **The IOMMU specification has five chapters and no appendices** — `[IOMMU 3.11 App.x]` is always wrong. IVRS is §5.2.
3. **There is no public PPR or revision guide for client Ryzen** — a claim about a client part that would need one says so rather than citing a document that does not exist.

Two further conventions from SKILL.md §Output standards: platform, CVE and performance facts cite their own Tier-2 source (Microsoft Learn, the Hypervisor TLFS, kernel.org, NVD, the paper, or an `[AMD-SB-nnnn]` bulletin), not the APM; and AMD appends rather than renumbers, so the real risk is invented recent section numbers (`§15.36`'s subsections especially), not stale ones.
Source: `00-quickref.md` §0.1 — a navigation file that deliberately holds no authoritative values of its own.
**Confidence:** high — no C:low or V:dated marker; the revisions are themselves the 2026-09-21 verification snapshot.

---

### vm-cr-msr-layout
**Routed to:** `references/01-svm-intro.md` §1.4 ("`VM_CR` (`C001_0114h`)") — correct route. SKILL.md's row points at §1.5; `00-quickref.md` §0.3 gives the SVM-MSR table as §1.4, which is where the layout lives.
**Answer:** `VM_CR` is MSR **`C001_0114h`** `[APM2 App.A]` `[1]`, specified in §15.30.1 / Figure 15-27.

| Bit | Field | Behaviour |
|---|---|---|
| 0 | `DPD` | Disables the external hardware debug port and certain internal debug features |
| 1 | `R_INIT` | Non-intercepted INIT signals are converted into an `#SX` exception |
| 2 | `DIS_A20M` | Disables A20 masking |
| 3 | `LOCK` | Writes to `LOCK` and `SVMDIS` are silently ignored while set |
| 4 | `SVMDIS` | Writes to `EFER` treat `SVME` as MBZ while set |
| 63:5 | — | Reserved, MBZ |

`[APM2 Figure 15-27]` `[1]`.
Behavioural rules `[APM2 §15.30.1]` `[1]`: while `LOCK` is set, writes to `LOCK` and `SVMDIS` are silently ignored; when it is clear, bits 3 and 4 are writable. Once set, `LOCK` can only be cleared using the `SVM_KEY` MSR (`C001_0118h`), and it is **not affected by INIT or SKINIT**. `SVMDIS` does **not** prevent CPUID from reporting that SVM is available; setting `SVMDIS` while `EFER.SVME` = 1 generates `#GP` regardless of `LOCK`; `SVMDIS` is not affected by SKINIT, and INIT clears it only when `LOCK` is clear. That "CPUID still says yes" clause is why a BIOS-disabled machine passes the CPUID probe and fails at the `EFER` write.
**Confidence:** high — every claim tagged `C:high` `V:durable`.

---

### vm-hsave-pa-rules
**Routed to:** `references/01-svm-intro.md` §1.4 ("`VM_HSAVE_PA` (`C001_0117h`) and its deliberately unspecified contract") — correct route
**Answer:** `VM_HSAVE_PA` is MSR **`C001_0117h`**, a 64-bit read/write MSR holding the physical address of a **4 KB** block where VMRUN saves host state and from which `#VMEXIT` reloads it; the VMM is expected to set it up before the first VMRUN `[APM2 §15.30.4]` `[1]`.
Write rules: a write causes **`#GP` if any of the low 12 bits of the written address are nonzero**, or if the address is **greater than or equal to the maximum supported physical address** for the implementation `[APM2 §15.30.4]` `[1]`.
What you may assume about the memory it points at: **nothing about its format or contents.** The format is intentionally unspecified — implementations may store only part or none of the host state in that memory and may keep some or all of it in hidden on-chip storage, so **software must not rely on the format or contents of the host save area, nor attempt to change host state by modifying it** `[APM2 §15.5.1]` `[1]`.
Practical consequences the chapter draws: a hypervisor may not snapshot, migrate or patch host state through this page, and a debugger dumping it sees implementation-dependent garbage on some parts and a recognisable state-save layout on others. Appendix B does give the host save area a format — the guest save area shifted by 400h — but it gets no table of its own, and §15.5.1 overrides it for any purpose other than reading the appendix.
Related: the SVM MSRs are available **regardless of whether SVM is enabled in `EFER.SVME`** `[APM2 §15.30]` `[1]`.
**Confidence:** high — all `C:high` `V:durable`.

---

### fn8000-0001-ecx-bit2-scope
**Routed to:** `references/01-svm-intro.md` §1.2 ("Discovering SVM: `Fn8000_0001 ECX`") — correct route
**Answer:** `Fn8000_0001_ECX[2]` is the `SVM` bit: secure virtual machine **supported**. By itself it lets you execute **no** SVM instruction — it is a support indication, and the chapter states flatly that **`ECX[2]` does not gate all eight SVM instructions** `[APM3 App.E]` `[2]`.

- The instructions gated on `EFER.SVME` are **VMRUN, VMLOAD, VMSAVE, CLGI, VMMCALL and INVLPGA — six, not eight** — and they raise `#UD` when it is clear `[APM2 §15.4]` `[1]`. So `ECX[2]` = 1 tells you that setting `EFER.SVME` (bit 12 of `C000_0080h`) is possible; those six become executable only once it is set, and `VM_CR.SVMDIS`/`LOCK` can still block that write.
- **SKINIT and STGI** are the two that are not purely `EFER.SVME`-gated: they are usable when **either** `EFER.SVME = 1` **or** `Fn8000_0001_ECX[12] (SKINIT)` = 1 `[APM2 §15.4]` `[1]`. AMD's own wording for bit 12 is "SKINIT and STGI are supported, independent of the value of `MSRC000_0080[SVME]`".
- STGI's `#UD` condition shows the three independent enumeration inputs: `EFER.SVME = 0` **and** `Fn8000_000A_EDX[SVML] = 0` **and** `Fn8000_0001_ECX[SKINIT] = 0` `[APM3 §4 "STGI"]` `[2]`. Device exclusion vector (DEV) support is part of the SKINIT architecture and is enumerated by the same `ECX[12]`.
- Neighbouring bits, for completeness: `ECX[3] ExtApicSpace`, `ECX[4] AltMovCr8`, `ECX[12] SKINIT` `[APM3 App.E]` `[2]`. Also, `Fn8000_000A` is **reserved** when `Fn8000_0001_ECX[SVM]` = 0, so `ECX[2]` additionally gates reading the SVM feature leaf at all.
**Confidence:** high — all `C:high` `V:durable`.

---

### vmcb-clean-bit-map
**Routed to:** `references/02-vmcb.md` §2.5 "Clean bits and VMCB state caching" — correct route (SKILL.md's row says §2.2; `00-quickref.md` §0.3 gives clean bits as §2.5)
**Answer:** The VMCB Clean field is at **control-area offset 0C0h**; support is enumerated by `CPUID Fn8000_000A_EDX[VmcbClean]` = bit 5 `[APM2 §15.15]` `[1]`.

| Bit | Mnemonic | Covers |
|---|---|---|
| 0 | `I` | Intercepts: all intercept vectors, TSC offset, Pause Filter Count |
| 1 | `IOPM` | `IOPM_BASE`, `MSRPM_BASE` |
| 2 | `ASID` | ASID |
| 3 | `TPR` | `V_TPR`, `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR`, `V_INTR_MASKING`, `V_INTR_VECTOR` (offsets 60h–67h) |
| 4 | `NP` | Nested paging: `NCR3`, `G_PAT` |
| 5 | `CRx` | `CR0`, `CR3`, `CR4`, `EFER` |
| 6 | `DRx` | `DR6`, `DR7` |
| 7 | `DT` | GDT and IDT limit and base |
| 8 | `SEG` | CS/DS/SS/ES selector, base, limit and attributes, plus CPL |
| 9 | `CR2` | `CR2` |
| 10 | `LBR` | `DebugCtl` MSR, `br_from`/`br_to`, `lastint_from`/`lastint_to` |
| 11 | `AVIC` | AVIC `APIC_BAR`; `APIC_BACKING_PAGE`, `PHYSICAL_TABLE` and `LOGICAL_TABLE` pointers |
| 12 | `CET` | `S_CET`, `SSP`, `ISST_ADDR` |
| 31:13 | — | Reserved |

`[APM2 Figure 15-4]` `[1]`.
Semantics: a **set** bit allows the processor to load that register or group from its hardware cache; a **clear** bit requires a load from the VMCB. Set bits are a hint any implementation may ignore, but **clean bits set to zero are always honored** `[APM2 §15.15.1]` `[1]`. The unique identifier of a guest vCPU for caching is the **physical address of the VMCB**; **the ASID is explicitly not** `[APM2 §15.15]` `[1]`.
**Bit 31** is "a special bit reserved for the host that the CPU will never use for a clean bit", so a hypervisor may use it for its own tracking — compatible with the `FFFF_FFFFh` guidance `[APM2 §15.15.3]` `[1]`.
Three asymmetries the chapter flags: `SEG` covers **CS, DS, SS and ES only** (FS, GS, LDTR and TR are moved by VMLOAD/VMSAVE and are in no clean group); `DT` covers GDT and IDT **limit and base**, not the LDTR or TR descriptors; `CR2` has a bit to itself while `EFER` rides in `CRx`.
No clean bit at all: `TLB_Control`, the interrupt shadow, the status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, Decode Assist), event injection, and `RFLAGS`/`RIP`/`RSP`/`RAX` `[APM2 §15.15.3]` `[1]`.
Clear the **entire** field in exactly three circumstances: the first run of a guest, running it on a different CPU core than last time, and having moved its VMCB to a different physical page `[APM2 §15.15.2]` `[1]`. Writing `FFFF_FFFFh` is legal only on an unmodified VMCB.
**Confidence:** high — all `C:high` `V:durable`.

---

### int-ctl-60h-layout
**Routed to:** `references/07-virtual-interrupts-avic.md` §7.1.1 "Bit layout of offset 060h" — correct route (SKILL.md's row says §7.2; `00-quickref.md` §0.3 gives §7.1)
**Answer:** AMD has no field called `INT_CTL` — that is the Linux/KVM name; AMD calls the quadword at VMCB control offset **060h** the *virtual interrupt control word*, and the encrypted copy in a SEV-ES/SNP VMSA is `VIntrCtrl` `[APM2 §15.29.4.1]` `[1]`.

| Bit(s) | AMD field name | Meaning |
|---|---|---|
| 7:0 | `V_TPR` | Virtual TPR. The field is eight bits wide; **bits 3:0 carry the 4-bit value, bits 7:4 are SBZ** |
| 8 | `V_IRQ` | Nonzero = a virtual INTR is pending |
| 9 | `VGIF` | Virtual GIF |
| 10 | *(no row in Table B-1)* | See below |
| 11 | `V_NMI` | Nonzero = a virtual NMI is pending |
| 12 | `V_NMI_MASK` | Nonzero = virtual NMIs are masked |
| 15:13 | — | RESERVED, SBZ |
| 19:16 | `V_INTR_PRIO` | Priority for the virtual interrupt |
| 20 | `V_IGN_TPR` | Nonzero = the current virtual interrupt ignores the (virtual) TPR |
| 23:21 | — | RESERVED, SBZ |
| 24 | `V_INTR_MASKING` | Virtualize masking of INTR interrupts |
| 25 | `VGIF_EN` | Virtual GIF Enable |
| 26 | `V_NMI_ENABLE` | NMI Virtualization Enable |
| 29:27 | — | RESERVED, SBZ |
| 30 | x2AVIC Enable | x2APIC MSR-interface virtualization enable |
| 31 | AVIC Enable | Per-virtual-processor AVIC enable |
| 39:32 | `V_INTR_VECTOR` | Vector for the virtual interrupt — crosses into the second doubleword |
| 63:40 | — | RESERVED, SBZ |

`[APM2 Table B-1]` `[1]`; the bit-30/31 ordering and naming are also stated in prose at `[APM2 §15.29.4.1]` `[1]`.
Two spelling traps: AMD writes `VGIF` and `VGIF_EN` (not `V_GIF` / `V_GIF_ENABLE`), and the two enables appear in prose as "x2AVIC Enable" and "AVIC Enable" — the newer feature's enable sits *below* the older one's.
**Bit 10 has no row at all**: Table B-1 jumps from bit 9 to bit 11 and its next reserved row begins at 13. It is not unused — under Alternate Injection, bit 10 of the *encrypted* `VIntrCtrl` is the `INT_SHADOW` bit, and the unencrypted interrupt-shadow bit at offset 068h bit 0 is then ignored `[APM2 §15.36.16]` `[1]` (mechanism owned by `14-sev-snp.md`). The same gap is listed as an open item in `02-vmcb.md` §2.7.
**Confidence:** high — all `C:high` `V:durable`.

---

### vmcb-state-save-offsets
**Routed to:** `references/02-vmcb.md` §2.3 "State save area: offsets and the segment descriptors" — correct route
**Answer:** **Offset convention: all state-save-area offsets are relative to the state save area; add `400h` to get the VMCB offset** (the control area occupies 000h–3FFh). The table is APM2 Table B-2.

| Field | Save-area offset | VMCB offset | Size |
|---|---|---|---|
| `CPL` | **0CBh** | 4CBh | byte |
| `EFER` | **0D0h** | 4D0h | qword |
| `CR4` | **148h** | 548h | qword |
| `CR3` | **150h** | 550h | qword |
| `CR0` | **158h** | 558h | qword |
| `RFLAGS` | **170h** | 570h | qword |
| `RIP` | **178h** | 578h | qword |
| `RSP` | **1D8h** | 5D8h | qword |
| `RAX` | **1F8h** | 5F8h | qword |
| `CR2` | **240h** | 640h | qword |

`[APM2 Table B-2]` `[1]`.
Details worth carrying: `CPL` is a **single byte at 0CBh**, immediately after RESERVED 0A0h–0CAh, followed by a reserved dword at 0CCh and `EFER` at 0D0h; the row note reads "if the guest is real-mode then the CPL is forced to 0; if the guest is virtual-mode then the CPL is forced to 3". The control-register group is ordered **CR4 (148h), CR3 (150h), CR0 (158h), DR7 (160h), DR6 (168h), RFLAGS (170h), RIP (178h)** — neither the CR order nor DR7-before-DR6 is numeric order. `RSP` is at 1D8h and `RAX` at 1F8h with the three CET fields between them (`S_CET` 1E0h, `SSP` 1E8h, `ISST_ADDR` 1F0h), and **`CR2` sits at 240h, after the SYSCALL/SYSENTER block, not with the other control registers**.
Two caveats from the same section: save-area offset **140h has no row** in Table B-2 (the table jumps from `PERF_CTR5` at 138h to `CR4` at 148h; Table B-4, the SEV-ES VMSA, puts `XSS` there), and **0CAh is inside the RESERVED range 0A0h–0CAh** — the byte-wide VMPL field at 0CAh exists only in Table B-4 and must not be written into a non-SEV-ES save area.
Also: only `RAX` (1F8h), `RSP` (1D8h), `RFLAGS` (170h) and `RIP` (178h) are architecturally present; every other GPR has no home in the VMCB save area and must be saved and restored by the hypervisor around each VMRUN.
**Confidence:** high — all `C:high` `V:durable`.

---

### intercept-vector-4-and-5
**Routed to:** `references/03-intercepts.md` §3.1 "The six intercept vectors" — correct route (the exact section SKILL.md names)
**Answer:** Your manual is a **pre-2020 revision**. In APM Vol.2 Rev 3.30, 014h–03Bh was a single RESERVED, SBZ span; Rev 3.45 defines a **sixth** intercept vector there, and a corpus that says SVM has five vectors is reporting the pre-2020 layout `[APM2 Table B-1]` `[1][150]`. The six vectors are at control-area offsets 000h, 004h, 008h, 00Ch, **010h (vector 4)** and **014h (vector 5)**.

**Vector 4 (010h) — the SVM instruction set and the write traps.** Bits 0–20 assigned; **bits 18:17 and 31:21 RESERVED** `[APM2 Table B-1]` `[1]`:

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

The write-trap block is **narrower than it used to be**: Rev 3.30 had bit 15 = EFER writes and bits 16–31 = writes of CR0–15, whereas Rev 3.45 defines only 16 (CR0), 19 (CR3) and 20 (CR4) and reserves 17, 18 and 21–31; bit 14, RESERVED in Rev 3.30, is now RDPRU. Corroborated by the exit codes, which allocate exactly **8Fh, 90h, 93h and 94h** to the EFER/CR0/CR3/CR4 write traps and nothing to CR1–CR2 or CR5–CR15 `[APM2 App.C]` `[1]`. A write **trap** is detected and delivered *after* the triggering instruction completes, so the new value is already in the register — unlike the vector-0 write intercept, taken before results are committed (`C:medium`).

**Vector 5 (014h) — the newest gates.** Seven bits, **31:7 RESERVED, SBZ** `[APM2 Table B-1]` `[1]`: **0** intercept all INVLPGB, **1** intercept only illegally specified INVLPGB, **2** INVPCID, **3** MCOMMIT, **4** TLBSYNC, **5** bus-lock operations when the Bus Lock Threshold Counter is 0, **6** HLT if a virtual interrupt is not pending (IdleHlt). The presence of bit 4 is itself conditional on `CPUID Fn8000_000A_EDX[24] (TlbiCtl)` = 1. Bit 5 is an *enable*, not a plain intercept — the bus lock only exits once the separate 16-bit Bus Lock Threshold Counter has reached zero, and the intercept is evaluated before the guest instruction executes.
Exit-code mapping: `code = 32 × vector + bit`, so vector 4 gives `80h + bit` and vector 5 gives `A0h + bit` (VMRUN = 80h, bus lock = A5h) `[APM2 App.C]` `[1]`; see also `errata.md` E06.
**Confidence:** high — the vector tables are `C:high` `V:durable`; only the trap-versus-intercept timing note is `C:medium`.

---

### msrpm-ranges-and-encoding
**Routed to:** `references/03-intercepts.md` §3.4 "The MSR permissions map" — correct route (SKILL.md's row says §3.1; `00-quickref.md` §0.3 gives IOPM/MSRPM as §3.3/§3.4)
**Answer:** The MSRPM is **four separate bit vectors of 16 Kbits (2 Kbytes) each, packed together and located in two contiguous physical pages, 4-Kbyte aligned**; each 16-Kbit vector covers a range of 8K MSRs `[APM2 §15.11]` `[1]`. Its base is `MSRPM_BASE_PA` in the VMCB (offset owned by `02-vmcb.md`).
**Encoding: two bits per MSR — the lsb controls read access, the msb controls write access; 1 means intercepted** `[APM2 §15.11]` `[1]`.
**Ranges — deliberately not contiguous** `[APM2 Table 15-8]` `[1]`:

| MSRPM byte offsets | MSRs covered |
|---|---|
| 000h–7FFh | `0000_0000h`–`0000_1FFFh` |
| 800h–FFFh | `C000_0000h`–`C000_1FFFh` |
| 1000h–17FFh | `C001_0000h`–`C001_1FFFh` |
| 1800h–1FFFh | **reserved** |

Index arithmetic (the chapter notes AMD states the two-bits-per-MSR rule and the range table but does not print this): for MSR index *i* within its 8K range the read bit is at byte `vector_base + (2i >> 3)`, bit `(2i) & 7`, and the write bit is the next bit up.
Behaviour: with `MSR_PROT` active, **any attempt to read or write an MSR not covered by the map automatically causes an intercept** — the uncovered default is "intercept", not "allow"; with `MSR_PROT` clear, RDMSR/WRMSR are never intercepted. The check order is: exceptions common to all MSRs (e.g. `#GP` when not at CPL 0) → the MSRPM intercept → MSR-specific exceptions, so the hypervisor sees the intercept before the processor decides an MSR is unimplemented. On an intercept the direction is a single value, RDMSR = 0 and WRMSR = 1, and the MSR number is in guest ECX `[APM2 §15.11]` `[1]`.
Practical trap: the shadow-stack MSRs 6A0h–6A8h fall in the first vector while **TSC Ratio `C000_0104h` falls in the second** — a hypervisor that populates only the first vector silently leaves TSC scaling writable by the guest `[APM2 §18.12]` `[APM2 §15.30.5]` `[1]`. An SNP-active guest can additionally define its own intercepts in four 8-byte VMSA vectors with the same read-lsb/write-msb encoding, and an access is intercepted if **either** the host- or guest-controlled bit is set `[APM2 §15.36.23]` `[1]` (Guest Intercept Control, owned by `14-sev-snp.md`).
**Confidence:** high — all `C:high` `V:durable`.

---

### exit-codes-60h-61h-band
**Routed to:** `references/05-exit-decoding.md` §5.1 "The exit-code space" — correct route (SKILL.md's row points at §5.2 but names §5.1 for the EXITCODE table)
**Answer:** **`60h` = `VMEXIT_INTR`, a physical INTR (maskable interrupt). `61h` = `VMEXIT_NMI`, a physical NMI** `[APM2 App.C]` `[1]`.
They sit at the bottom of the **vector-3 band, 60h–7Fh**, because `exit code = 32 × (vector number) + (bit position)` and intercept vector 3 is the word at VMCB offset 00Ch. The rest of that band:

| Code | Name | Code | Name |
|---|---|---|---|
| 60h | `VMEXIT_INTR` | 70h | `VMEXIT_PUSHF` |
| 61h | `VMEXIT_NMI` | 71h | `VMEXIT_POPF` |
| 62h | `VMEXIT_SMI` (EXITINFO1 carries more) | 72h | `VMEXIT_CPUID` |
| 63h | `VMEXIT_INIT` | 73h | `VMEXIT_RSM` |
| 64h | `VMEXIT_VINTR` | 74h | `VMEXIT_IRET` |
| 65h | `VMEXIT_CR0_SEL_WRITE` (CR0 bits other than TS/MP) | 75h | `VMEXIT_SWINT` (INTn) |
| 66h | `VMEXIT_IDTR_READ` | 76h | `VMEXIT_INVD` |
| 67h | `VMEXIT_GDTR_READ` | 77h | `VMEXIT_PAUSE` |
| 68h | `VMEXIT_LDTR_READ` | 78h | `VMEXIT_HLT` |
| 69h | `VMEXIT_TR_READ` | 79h | `VMEXIT_INVLPG` |
| 6Ah | `VMEXIT_IDTR_WRITE` | 7Ah | `VMEXIT_INVLPGA` |
| 6Bh | `VMEXIT_GDTR_WRITE` | 7Bh | `VMEXIT_IOIO` (EXITINFO1 carries more) |
| 6Ch | `VMEXIT_LDTR_WRITE` | 7Ch | `VMEXIT_MSR` |
| 6Dh | `VMEXIT_TR_WRITE` | 7Dh | `VMEXIT_TASK_SWITCH` |
| 6Eh | `VMEXIT_RDTSC` | 7Eh | `VMEXIT_FERR_FREEZE` |
| 6Fh | `VMEXIT_RDPMC` | 7Fh | `VMEXIT_SHUTDOWN` |

`[APM2 App.C]` `[1]`.
Surrounding bands, for orientation: 00h–0Fh CR reads, 10h–1Fh CR writes, 20h–2Fh DR reads, 30h–3Fh DR writes, 40h–5Fh `VMEXIT_EXCP[0-31]` (exception exit code = 40h + vector), 80h–9Fh vector 4, A0h–BFh vector 5. Outside the rule: `400h` `VMEXIT_NPF`, `401h` `AVIC_INCOMPLETE_IPI`, `402h` `AVIC_NOACCEL`, `403h` `VMEXIT_VMGEXIT`, `407h` `VMEXIT_PML_FULL`, `F000_0000h` reserved for host use, and the negatives `−1` `VMEXIT_INVALID`, `−2` `VMEXIT_BUSY`, `−3` `VMEXIT_IDLE_REQUIRED`, `−4` `VMEXIT_INVALID_PMC`.
**Confidence:** high — all `C:high` `V:durable`.

---

### npf-exitinfo1-bits
**Routed to:** `references/05-exit-decoding.md` §5.3 "Nested page faults" — correct route (SKILL.md routes `#NPF` bit layouts to `05`; `00-quickref.md` §0.2 names §5.3 for the bits and `06-nested-paging.md` §6.5 for the ordering)
**Answer:** On `#VMEXIT(NPF)` (exit code `400h`) the **faulting guest physical address is saved in `EXITINFO2`**, and `EXITINFO1` delivers an error code similar to a `#PF` error code with two extra groups bolted on `[APM2 §15.25.6]` `[1]`.

| Bit | Name | Meaning | Source |
|---|---|---|---|
| 0 | `P` | Cleared to 0 if the nested page was not present, 1 otherwise | §15.25.6 |
| 1 | `RW` | Set if the nested-page-table-level access was a write | §15.25.6 |
| 2 | `US` | Set if the nested-page-table-level access was a user access | §15.25.6 |
| 3 | `RSV` | Set if reserved bits were set in the corresponding nested PTE | §15.25.6 |
| 4 | `ID` | Set if the nested-page-table-level access was a code read | §15.25.6 |
| 5 | — | **Absent.** A `#PF` error code puts the protection-key violation here; `#NPF` defines nothing at bit 5 | — |
| 6 | `SS` | Set if the fault was caused by a shadow stack access | §15.25.6 |
| 31 | `RMP` | Set if the fault was caused by an RMP check or a VMPL check failure | §15.36.10 |
| 32 | — | Set if the fault occurred while translating the guest's **final** physical address | §15.25.6 |
| 33 | — | Set if the fault occurred while translating the **guest page tables** | §15.25.6 |
| 34 | `ENC` | Set if the guest's effective C-bit was 1 | §15.36.10 |
| 35 | `SIZEM` | Size mismatch between PVALIDATE or RMPADJUST and the RMP | §15.36.10 |
| 36 | `VMPL` | VMPL permission check failure | §15.36.10 |
| 37 | `SSS` | Two definitions — see below | §15.25.6 and §15.36.10 |

`[APM2 §15.25.6]` `[APM2 §15.36.10]` `[1]`. This is `errata.md` E04: a numbering that places the encryption mismatch at 33, the size mismatch at 34 and the VMPL violation at 35 is **off by one from bit 34 upward**.
Further points: bits 32 and 33 are printed **without mnemonics** — AMD refers to them only as `EXITINFO1[33:32]` (`GUEST_FINAL`/`GUEST_PAGE` are OS-header names, per `00-quickref.md` §0.4). **Bit 37 carries two different definitions**: §15.25.6 makes it the leaf nested PTE being marked a supervisor shadow stack page with the shadow-stack check feature enabled, while §15.36.10 makes it the VMPL permission mask `SSS` (bit 4) value when `VmplSSS` is enabled — a decoder must know which feature is active. Bit 31 is set by **every** RMP violation, while bits 34–37 are documented as bits that "may be set": the two groups are stated separately, not as one flat list. Two low-bit conventions mislead: guest page-table walks are always treated as **data writes** at the nested level (so `RW` is set even for a code read), and nested page-table accesses by the MMU count as **user** accesses unless an enabled feature overrides that. Finally, an RMP check can fail **transiently** when the accessed RMP entries are in use by other logical processors — software should retry rather than treat the fault as terminal.
**Confidence:** high — all `C:high` `V:durable`.

---

### tlb-control-values
**Routed to:** `references/06-nested-paging.md` §6.8 "TLB control and INVLPGA" — correct route (SKILL.md's row says §6.5; `00-quickref.md` §0.3 gives `TLB_CONTROL` values as §6.8)
**Answer:** `TLB_CONTROL` occupies **bits 39:32 of the VMCB control area at byte offset 058h**, immediately above the 32-bit guest ASID in bits 31:0 of the same qword `[APM2 Table B-1]` `[1]` (the layout itself is owned by `02-vmcb.md`).

| Encoding | Function |
|---|---|
| `00h` | Do not flush |
| `01h` | Flush entire TLB — all entries, all ASIDs — on VMRUN. AMD says it should be used only on legacy hardware |
| `03h` | Flush this guest's TLB entries |
| `07h` | Flush this guest's non-global TLB entries |

Those four are the whole of Table 15-9, which carries an explicit note that **all encodings not defined in it are reserved** `[APM2 Table 15-9]` `[1]`.
**What gates the extended ones:** `00h` and `01h` are available on every processor supporting SVM; **`03h` and `07h` are optional and indicated by `CPUID Fn8000_000A_EDX[FlushByAsid]`, bit 6** — the same bit that indicates TLB flush events such as CR3 writes and `CR4.PGE` toggles flush only the current ASID's entries `[APM2 §15.16.1]` `[APM3 App.E]` `[2]`.
Operational notes: with `TLB_CONTROL` = 1, VMRUN flushes all ASIDs and both global and non-global pages; **VMRUN reads the field but does not change it**, so the hypervisor must reset it between entries. A hypervisor that downgrades a nested page table (reduced permissions, cleared present bits, changed translations) and intends to re-enter the same ASID should use `011b` or `001b` — three or one, **not** seven, because a downgrade can affect global entries too. VMRUN's published list of illegal state combinations does **not** include a reserved `TLB_CONTROL` encoding, so a reserved value is not rejected by a consistency check and software must not rely on being told (`C:medium`). The field is also in the explicitly-uncached list — no clean bit can describe it, and it is re-read on every VMRUN (`02-vmcb.md` §2.6). One AVIC-driven rule: with xAVIC on a multi-vCPU VM, when a core last ran a *different* vCPU of the same VM — regardless of ASID values — that VMRUN must use `3h` `[APM2 §15.29.4.3]` `[1]`.
**Confidence:** high — encodings and gating `C:high` `V:durable`; the "a reserved value is not rejected" claim is `C:medium`.

---

### avic-id-table-entries
**Routed to:** `references/07-virtual-interrupts-avic.md` §7.5 (entry layouts) plus §7.4.2 (VMCB pointers) — correct route
**Answer:** AVIC defines three memory-resident structures — the vAPIC backing page, the Physical APIC ID Table and the Logical APIC ID Table — **each defined to fit exactly one 4-Kbyte page** (AMD reserves the right to expand them). There is one backing page **per virtual processor** but **one Physical and one Logical APIC ID Table per virtual machine**, so both table pointers hold the same value in every VMCB of that VM `[APM2 §15.29.5]` `[APM2 §15.29.5.2]` `[1]`.

**Physical APIC ID Table entry** — indexed by guest physical APIC ID, **64 bits** `[APM2 Table 15-23]` `[1]`:

| Bit(s) | Field | Description |
|---|---|---|
| 63 | `V` | Valid — the entry holds a valid backing-page pointer |
| 62 | `IR` | IsRunning — the vCPU is currently scheduled by the VMM on a physical core |
| 61:52 | — | Reserved, SBZ |
| 51:12 | Backing Page Pointer | 4-Kbyte-aligned system physical address of this vCPU's vAPIC backing page |
| 11:0 | Host Physical APIC ID | Physical APIC ID of the core hosting the vCPU. **Not valid unless `IR` is set** |

`IR` means only that the VMM has assigned a physical core; it does not distinguish a core currently executing guest software from one that has suspended guest execution. The table may be sparse, and the index of the last valid entry is what `AVIC_PHYSICAL_MAX_INDEX` records. With `CPUID Fn8000_000A_ECX[6] (x2AVIC_EXT)` = 0 it is fixed at 4 Kbytes — at most **512** vCPUs per VM; with the bit set it may span up to **eight consecutive 4-Kbyte pages**, the page count being `AVIC_PHYSICAL_MAX_INDEX[11:9] + 1` (Vol.3 restates this as "4096 vCPUs supported in x2AVIC mode"). In **xAVIC** mode it occupies only the lower half of its page — 256 eight-byte entries — physical APIC ID FFh is reserved because FFh means broadcast, and the upper 2048 bytes are reserved and should be zero `[APM2 Figure 15-18]` `[1]`.

**Logical APIC ID Table entry** — indexed by logical ID, **32 bits** `[APM2 Table 15-24]` `[1]`: bit **31 `V`** (valid), bits **30:8 reserved SBZ**, bits **7:0 Guest Physical APIC ID**. One entry per logically addressed APIC, so each vAPIC's logical ID must be unique and the VMM must mirror any guest logical-ID change into the table. Flat mode uses only the first 8 entries, with supported encodings of the form 2^i and byte offset `4 * log2(l_apic_id)`; cluster mode takes bits 7:4 as the cluster number and 3:0 as the bit-encoded APIC index, cluster Fh reserved, byte offset `(16 * c) + 4 * log2(apic_ix)`. **In x2AVIC mode the Logical APIC ID Table is not used at all** — the destination logical ID is derived arithmetically as `Logical x2APICID = (X2APICID[19:4] << 16) | (1 << X2APICID[3:0])` `[APM2 §15.29.5.3]` `[1]`.

**Where the pointers live in the VMCB** `[APM2 §15.29.4.2]` `[APM2 Table B-1]` `[1]`:

| Byte offset | Table B-1 name | Field |
|---|---|---|
| 098h | `AVIC APIC_BAR` (`V_APIC_BAR`) | bits 51:0; 63:52 RESERVED, SBZ — **098h, not 038h** |
| 0E0h | `AVIC APIC_BACKING_PAGE Pointer` | bits 51:0; 63:52 RESERVED, SBZ |
| **0F0h** | `AVIC LOGICAL_TABLE Pointer` | bits 51:12; 11:0 and 63:52 reserved |
| **0F8h** | `AVIC PHYSICAL_TABLE Pointer[51:12]` | bits 51:12; 63:52 reserved |
| 0F8h | `AVIC_PHYSICAL_MAX_INDEX` | bits 11:0 — index of the last guest physical core ID |

All four are evaluated on VMRUN, must lie in legal implementation-supported physical address ranges, must be mapped write-back cacheable, and cause a `#VMEXIT` if out of range; all point to 4-Kbyte-aligned structures so bits 11:0 are reserved — **except at 0F8h, where those bits are `AVIC_PHYSICAL_MAX_INDEX`**. VMRUN fails with `#VMEXIT(VMEXIT_INVALID)` if that index exceeds **255 in xAVIC** mode, or **511 in x2AVIC** mode when `Fn8000_000A_ECX[6]` = 0. AMD's names are `AVIC LOGICAL_TABLE Pointer` and `AVIC PHYSICAL_TABLE Pointer`; the forms `AVIC_LOGICAL_PAGE` / `AVIC_PHYSICAL_PAGE` appear nowhere in the manual. The Physical APIC ID Table is read by **both** the core and the IOMMU, which is why `IR` must be maintained on every vCPU schedule and unschedule `[APM2 §15.29.6.2]` `[1]`.
**Confidence:** high — all `C:high` `V:durable`.

---

### avic-doorbell-msr
**Routed to:** `references/07-virtual-interrupts-avic.md` §7.6 "The AVIC doorbell" — correct route
**Answer:** The doorbell is how a *remote* agent — another core sending an IPI, or the IOMMU delivering a device interrupt — tells the core currently running the target vCPU that its backing page has changed. Every core provides such a mechanism; the exact mechanism is implementation-specific but must be protected from non-privileged software on other cores and from direct access by an external device `[APM2 §15.29.8.2]` `[1]`.
The programming interface is the **Doorbell Register, MSR `C001_011Bh`**: **bits 7:0 hold the destination Physical APIC ID, bits 63:8 are Reserved, MBZ** `[APM2 Figure 15-22]` `[1]`.
**If you read it, you get `#GP`.** Writing the register sends the doorbell signal to that physical core; **any attempt to read the register raises `#GP`** `[APM2 §15.29.8.2]` `[1]`.
Two further properties: the serializing semantics of `WRMSR` are **relaxed** when writing the Doorbell Register — Vol.3's `WRMSR` page states the same exception for "some x2APIC and AVIC MSRs" `[APM3 §4 "WRMSR"]` `[2]`. And a doorbell delivered to a running guest is recognized whether or not the interrupt can be injected immediately: on the next VMRUN the delivery mechanism re-reads the IRR in the backing page, finds the highest-priority pending interrupt and injects it if masking and priority allow; a doorbell received during VMRUN processing is recognized immediately after entering the guest `[APM2 §15.29.8.2]` `[APM2 §15.29.8.3]` `[1]`.
The MSR also appears in the SVM MSR table in `01-svm-intro.md` §1.4 as `C001_011Bh`, cross-referenced to this chapter `[APM2 App.A]` `[1]`.
**Confidence:** high — all `C:high` `V:durable`.

---

### iommu-control-register-bits
**Routed to:** `references/08-iommu-architecture.md` §8.3 "IOMMU Control Register, MMIO 0018h" — correct route (SKILL.md's row says §8.6; `00-quickref.md` §0.3 gives the Control and Status registers as §8.2/§8.3)
**Answer:** All three enables live in the **IOMMU Control Register at MMIO offset 0018h** `[IOMMU 3.11 §3.4.1]` `[7]`:

- **Translation: `IommuEn`, bit 0.** The Device Table Base Address Register (MMIO 0000h: `DevTabBase[51:12]`, `Size[8:0]`) **must be configured before it is set**. `Size` is an unsigned n giving a table of (n+1) × 4 Kbytes, so 000h = 4 Kbytes and the maximum 1FFh = 2 Mbytes, the size of a full 64K-entry Device Table.
- **Command processing: `CmdBufEn`, bit 12.** Program the Command Buffer Base Address at MMIO 0008h (`ComBase[51:12]`, `ComLen[59:56]`) first, with head/tail at 2000h/2008h. **`CmdBufRun` is not a control bit** — it is read-only **bit 4 of the Status Register at MMIO 2020h**, and conflating the two is `errata.md` **E01** `[IOMMU 3.11 §3.4.16]` `[7]`. `CmdBufRun` is level-sensitive: once 1 it stays 1 until command processing stops for cause, and once 0 it stays 0 until software writes `CmdBufEn` = 1.
- **Event log: `EventLogEn`, bit 2**, plus **`EventIntEn`, bit 3** if you want an interrupt on new entries. Program the Event Log Base Address at MMIO 0010h (`EventBase`, `EventLen`) first; head/tail are at 2010h/2018h. Neighbours in the same register: `PPRLogEn` (13), `PprIntEn` (14), `PPREn` (15), `GTEn` (16), `GAEn` (17), `GALogEn` (28), `GAIntEn` (29), `ComWaitIntEn` (4).

Ring-buffer sizing: `ComLen`, `EventLen`, `EventLogBlen` and `PPRLogLen` all reset to 1000b, reserve encodings below 1000b, and run 1000b = 256 entries (4 Kbytes) through 1111b = 32768 entries (512 Kbytes) — those logs hold **16-byte** records. The GA log is the exception (8-byte records): `GALogLen` runs 1000b = 512 entries to 1100b = 8192 entries, and **software is responsible for initialising its head and tail pointers to zero** `[IOMMU 3.11 §3.4.4]` `[IOMMU 3.11 §3.4.18]` `[7]`.
Restarting any halted log is the same four steps: wait for the `…Run` bit to read 0, clear the matching `…En` bit in 0018h, reprogram base/head/tail as needed, write 1 to the overflow status bit to clear it (RW1C), then set the `…En` bit again `[IOMMU 3.11 §2.5.1]` `[7]`. Note too that once the system is SNP-enabled, writes are discarded to the Device Table Base, Command Buffer Base, Event Log Base and to `Control[IommuEn]` and `Control[DevTblSegEn]` `[IOMMU 3.11 §2.12.2.1]` `[7]`.
The chapter carries the complete 0018h bit assignment (bit 0 `IommuEn` through 63:61 `SNPAVICEn`) if you need the rest.
**Confidence:** high — all `C:high` `V:durable`.

---

### iommu-event-codes
**Routed to:** `references/08-iommu-architecture.md` §8.8 "Log entry formats: event, PPR and GA" — correct route
**Answer:** **How to read a record:** every event record is 16 bytes — a **4-bit `EventCode` at bits 31:28 of dword +04**, a 60-bit first operand (dword +00 plus bits 27:0 of +04) and a 64-bit second operand (dwords +08 and +12) `[IOMMU 3.11 Figure 54]` `[7]`.

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

**Fourteen** codes in Rev 3.11, 0001b–1110b; 0000b and 1111b are unassigned `[IOMMU 3.11 §2.5]` `[7]`.
**Decoding warning:** Table 42, the summary table in §2.5, is **stale relative to the sections it summarises** — it prints 1001b for both `INVALID_PPR_REQUEST` and `EVENT_COUNTER_ZERO` and declares 1010b–1111b reserved, while §2.5.11–§2.5.15 assign 1010b–1110b. **Decode from the per-event figures, not from Table 42** `[IOMMU 3.11 Table 42]` `[7]`. (A related open item: `RMP_HARDWARE_ERROR`'s figure carries EventCode 1110b while its field description reads "Specifies an RMP_PAGE_FAULT entry".)
Common header bits: `VCmd`(31), `VPpr`(30) and `VEvent`(29) of dword +00 say the event arose while processing a virtualized command buffer, PPR log or event log, and `VNR`(27) says the vIOMMU context is unrecoverable; all four are reserved and read 0 when vIOMMU is disabled.
`IO_PAGE_FAULT` (0010b) carries `DeviceID[15:0]` and `PASID[19:16]` in dword +00; the flag byte `TR`(24) `RZ`(23) `PE`(22) `RW`(21) `PR`(20) `I`(19) `US`(18) `NX`(17) `GN`(16) plus `D/P[15:0]` in +04; and the full 64-bit device virtual address in +08/+12. `D/P` is overloaded: the DomainID when GN=0 and the low 16 bits of the guest PASID when GN=1. `ILLEGAL_DEV_TABLE_ENTRY` (0001b) reuses the header with a narrower flag set (`TR`, `RZ`, `RW`, `I`, `GN`, `PASID[15:0]`). **`RZ` distinguishes the two structural failure modes throughout: 1 = a non-zero reserved bit, 0 = an invalid level encoding.** In the hardware-error records the address field is **not** the address the device wanted — it is the sPA of the failed Device Table access, the page table entry, the command itself, or the invalidation command that timed out, respectively; their `Type` field encodes 00b invalid `COMPLETION_WAIT` store address on an SNP-enabled system, 01b Master Abort, 10b Target Abort, 11b Data Error. The log is *full* when all slots but one are used and has *overflowed* when an event arrives that would consume the last free slot — the IOMMU then sets `Status[EventOverflow]` and discards the record `[IOMMU 3.11 §2.5]`, `§2.5.2`–`§2.5.4`, Figures 55/56, Tables 56–58 `[7]`.
**Confidence:** high — all `C:high` `V:durable`; the Table 42 discrepancy is recorded in §8.9 as an open item rather than adjudicated.

---

### dte-translation-fields
**Routed to:** `references/08-iommu-architecture.md` §8.6 "The Device Table Entry" — correct route (the exact section SKILL.md names)
**Answer:** **Size and indexing:** the Device Table is an array of **256-bit (32-byte) entries indexed directly by the 16-bit DeviceID**, so a fully populated table is 65,536 entries and **2 Mbytes**; it must be 4-Kbyte aligned and a multiple of 4 Kbytes long `[IOMMU 3.11 §2.2.2]` `[7]`. The IOMMU reads an entry in a single 256-bit transaction — earlier revisions allowed two 128-bit reads but no hardware ever implemented that. A DeviceID beyond the end of the table is denied I/O permission and target-aborted, and logged; PRI requests are the exception, being unvalidated against the Device Table.

Field positions `[IOMMU 3.11 Figure 7 / Table 7]` `[7]`:

| Field | Bits |
|---|---|
| `V` | **0** |
| `TV` | **1** |
| `Mode[2:0]` | **11:9** |
| Host Page Table Root Pointer[51:12] | **51:12** |
| `DomainID[15:0]` | **79:64** |
| `IR` / `IW` | 61 / 62 |
| `HAD[1:0]` | 8:7 |
| GCR3 Table Root Pointer | **three discontiguous slices**: [51:31] at 127:107, [30:15] at 95:80, [14:12] at 60:58 |
| `GV` / `GLX[1:0]` / `GIoV` | 55 / 57:56 / 54 |
| `IV` / Interrupt Table Root Pointer[51:6] / `IntTabLen` / `IntCtl` | 128 / 179:134 / 132:129 / 189:188 |

`Mode[11:9]` gives the depth of the host page tables and therefore the reachable GPA width: **000b translation disabled (SPA = GPA, access still gated by IR/IW), 001b 1 level / 21-bit, 010b 2 / 30-bit, 011b 3 / 39-bit, 100b 4 / 48-bit, 101b 5 / 57-bit, 110b 6 / 64-bit, 111b reserved** and reported as an event when V=1 and TV=1.
`V`(0) validates bits [127:1] of the entry; `TV`(1) validates the translation fields specifically — IW, IR, the page table root pointer, Mode and GV. With **V=0**, every address from that device is forwarded untranslated and all other control fields are ignored, while the interrupt half is governed separately by `IV`(128). With **V=1, TV=0**, the SysMgt, EX, SD, Cache, IoCtl, SA, SE and I fields are still valid and the DomainID is still used for event-log entries, but any required table walk is terminated and Mode and the root pointer are ignored `[IOMMU 3.11 Table 8]` `[7]`.
`DomainID[79:64]` is the 16-bit software-chosen tag the IOMMU stamps on its internal translation caches and on event log entries; **devices sharing a DomainID must have identical `Mode` and page table root pointer or IOMMU behaviour is undefined**, though they may differ in `I` and `SysMgt`. The DomainID in an event record is undefined when V=0 and IV=1, and devices with `GIoV`=1 should be given unique DomainIDs.
The GCR3 pointer is used only when V=1, TV=1 and GV=1; `GLX[57:56]` selects a one-, two- or three-level GCR3 table (00b/01b/10b, 11b reserved), ignored when GV=0. `HAD[8:7]` controls host page-table Accessed/Dirty updates (00b none, 01b Accessed only, 10b reserved, 11b A+D) and is meaningful only when V=1, TV=1 and `EFR[HASup]`=1.
Changing an entry: the interrupt half may be changed with one 64-bit write and the translation half with one 128-bit write, each followed by `INVALIDATE_DEVTAB_ENTRY` whenever IV=1 or V=1 held before the change. When an atomic write is impossible and V=0 beforehand, the last write must be the one setting V=1; when V=1 beforehand, IW and IR must be written before or with the change to Mode, and TV and V must be in the final write. `INVALIDATE_DEVTAB_ENTRY` does **not** invalidate translation-cache entries, so removing a device from a domain also requires `INVALIDATE_IOMMU_PAGES` for that DomainID `[IOMMU 3.11 §2.2.2.2]` `[IOMMU 3.11 §2.4.2]` `[7]`.
Segmentation (§8.7) splits the table into 2, 4 or 8 pieces selected by the top 1–3 bits of the DeviceID, with segment 0 at MMIO 0000h and segments 1–7 at 0100h–0130h.
**Confidence:** high — all `C:high` `V:durable` (the SEV-TIO reserved-field list is `C:medium` and is not relied on above).

---

### irte-guest-mode-format
**Routed to:** `references/10-iommu-interrupt-remapping.md` §10.2 "The virtualized entry, `GuestMode=1`" — correct route (SKILL.md's row says §10.4; `00-quickref.md` §0.3 gives the three IRTE formats as §10.1–§10.3)
**Answer:** `[IOMMU 3.11 Table 23]` `[7]`:

| Bits | Field | Meaning |
|---|---|---|
| 127:116 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| **115:76** | `Guest Virtual APIC Table Root Pointer` | the system physical address of the APIC backing page when `RemapEn=1` |
| 75:72 | Reserved | reserved when `RemapEn=1`, ignored when `RemapEn=0` |
| **71:64** | `Vector` | used to compute the address inside the backing page |
| **63:32** | `GATag[31:0]` | written verbatim into the GA log entry |
| 31:16 | Reserved | — |
| **15:8** | `Destination[7:0]` | destination core for the guest virtual APIC doorbell message |
| **7** | `GuestMode` | must be 1 in this format |
| **6** | `IsRun` | 1 = the guest is running and can take the interrupt; 0 = log it instead |
| **5** | `GAPPIDis` | 1 = suppress the GAPPI notification but keep updating the IRR |
| 4:3 | Reserved | — |
| **2** | `GALogIntr` | 1 = write a GA log entry when `IsRun=0`; 0 = suppress it |
| **1** | `SupIOPF` | not governed by `RemapEn` |
| **0** | `RemapEn` | validity of every other field |

Notes the chapter attaches: with `RemapEn=0` hardware ignores the whole entry except `SupIOPF`, and an interrupt that lands on it raises an **`IO_PAGE_FAULT`** rather than being silently dropped. `GAPPIDis` is meaningful only when `GuestMode=1` and `MMIO 0018h[GAPPIEn]=1`, and is reserved when `MMIO 01A0h[GAPPIDisSup]=0`. Bit 0 is **`RemapEn`** — the spelling `RemapEm` appears nowhere in the specification (`errata.md` E03).
Enablement: the 128-bit formats are selected by `GASup`/`GAMSup` in MMIO 0030h together with `GAEn`/`GAMEn` in MMIO 0018h — `GASup=1` with `GAMSup=000b` and `GAEn=1` gives the wide `GuestMode=0` remapping entry, and `GAMSup=001b` with `GAEn=1` and `GAMEn=001b` additionally gives this virtualized entry `[IOMMU 3.11 Table 21]` `[7]`. Every IOMMU in the system must be programmed to the same IRTE size, i.e. the same `GAEn`/`GAMEn` values. In x2APIC mode (`XTSup`/`XTEn`) the destination widens: `Destination[31:24]` at IRTE bits 127:120 and `Destination[23:0]` at bits 31:8 `[IOMMU 3.11 Figure 20]` `[7]`.
Caching: with `GAEn=1` and `GuestMode=1` the IOMMU does **not** cache `IsRun`, `Destination`, `GALogIntr`, `GAPPIDis` or `GATag`, so changing any of them needs no invalidation; if `RemapEn` was already 1, update the entry atomically and then invalidate the interrupt remapping table only if a cacheable field changed `[IOMMU 3.11 §2.2.5.2]` `[IOMMU 3.11 §2.3.2]` `[7]`. On an SNP-enabled system the enable moves (`SNPAVICSup` / `SNPAVICEn`) but the layout is unchanged.
**Confidence:** high — all `C:high` `V:durable`.

---

### fn8000-001f-fields
**Routed to:** `references/11-memory-encryption.md` §11.2 "Enumerating memory encryption: `Fn8000_001F`" — correct route (the exact section SKILL.md names)
**Answer:** Four registers: EAX a feature bitmap, EBX the geometry of the C-bit, ECX the guest ceiling, EDX the ASID floor. Everything in it is implementation-specific and none of it may be hardcoded.

**EAX — the feature bitmap** `[APM3 App.E]` `[2]`: 0 `SME`, 1 `SEV`, 2 `PageFlushMsr`, 3 `SEV-ES`, **4 `SEV-SNP`**, **5 `VMPL`**, 6 `RMPQUERY`, 7 `VmplSSS`, 8 `SecureTsc`, 9 `TscAuxVirtualization`, 10 `HwEnfCacheCoh`, 11 `64BitHost`, 12 `RestrictedInjection`, 13 `AlternateInjection`, 14 `DebugVirt`, 15 `PreventHostIbs`, 16 `VTE`, 17 `VmgexitParameter`, 18 `VirtualTomMsr`, 19 `IbsVirtGuestCtl`, 20 `PmcVirtGuestCtl`, 21 `RMPREAD`, 22 `GuestInterceptCtl`, 23 `SegmentedRmp`, 24 `VmsaRegProt`, 25 `SmtProtection`, 26 `SecureAvic`, 27 `AllowedSevFeatures`, 28 `SvsmCommPageMsr`, 29 `NestedVirtSnpMsr`, 30 `HvInUseWrAllowed`, 31 `IbpbOnEntry`.

**EBX — three packed fields** `[APM3 App.E]` `[2]`: **`CbitPosition` bits 5:0**, **`PhysAddrReduction` bits 11:6**, **`NumVMPL` bits 15:12**; bits 30:16 reserved; **bit 31 `COHERENCY_SFW_NO`** — the software workaround for the SEV-SNP cache-coherency issue of AMD-SB-3017 is not needed.

**ECX[31:0]** = `NumEncryptedGuests`, the number of encrypted guests supported simultaneously. **EDX[31:0]** = `MinSevNoEsAsid`, the minimum ASID usable by a guest that enables SEV with SEV-ES disabled `[APM3 App.E]` `[2]`.

**Extracting the C-bit position — three independent masks, not one:**
```
EBX = 0000_0173h
  CbitPosition      =  EBX         & 0x3F  = 0x33 = 51
  PhysAddrReduction = (EBX >>  6)  & 0x3F  = 0x05 = 5
  NumVMPL           = (EBX >> 12)  & 0x0F  = 0x0  = 0   (no VMPL support on this part)
```
A decode that treats the low byte as the position is wrong whenever `PhysAddrReduction` is non-zero. The C-bit position and the physical-address reduction are **independent fields** — the manual defines each separately and never states an arithmetic relationship, so deriving one from the other is a guess. `CbitPosition` can name a bit above the part's reported physical-address width (`Fn8000_0008_EAX[7:0] PhysAddrSize`, a different leaf that `Fn8000_001F_EBX` neither contains nor derives), in which case the C-bit is a page-table attribute bit rather than an address bit and no address space is lost to it directly.
Probing discipline: test the feature bit before reading a dependent field — `CbitPosition` only when `EAX[0]` is set, `NumVMPL` only when `EAX[5]` is set; a part can report `SME` without `SEV`, and can report `SEV-SNP = 0` while still reporting `SEV = 1`. APM Vol.2 §7.10.1 directs readers to **Vol.3 §E.4.17** for the leaf's normative field table. Related consistency check: a hypervisor enabling SEV must check the guest ASID against `ECX[NumEncryptedGuests]`, because VMRUN terminates with `VMEXIT_INVALID` if it exceeds that maximum `[APM2 §15.34.3]` `[1]`.
Do not write "`EAX[1]` reads 0 on Ryzen": `errata.md` E12 (`[reversed]`, `C:medium`) records measured Zen+/2/3 consumer parts reporting `Fn8000_001F EAX[1] = 1`.
**Confidence:** high for the leaf's fields (`C:high` `V:durable`); the client-silicon observation in E12 is `C:medium`.

---

### sev-status-bit-map
**Routed to:** `references/12-sev.md` §12.6 "The `SEV_STATUS` MSR" — correct route (the exact section SKILL.md names)
**Answer:** **MSR address `C001_0131h`.** It reports which features were enabled in the last VMRUN for that guest; it is **read-only**, accesses to it **cannot be intercepted by the hypervisor**, and it is available on every processor that supports SEV `[APM2 §15.34.10]` `[1]`.

| Bit | Field | Source |
|---|---|---|
| 0 | `SEV_Enabled` | VMCB offset `90h` |
| 1 | `SEV_ES_Enabled` | VMCB offset `90h` |
| 2 | `SNP_Active` | `SEV_FEATURES[0]` |
| 3 | `vTOM_Active` | `SEV_FEATURES[1]` |
| 4 | `ReflectVC_Active` | `SEV_FEATURES[2]` |
| 5 | `RestrictedInjection_Active` | `SEV_FEATURES[3]` |
| 6 | `AlternateInjection_Active` | `SEV_FEATURES[4]` |
| 7 | `DebugVirtualization_Active` | `SEV_FEATURES[5]` |
| 8 | `PreventHostIBS_Active` | `SEV_FEATURES[6]` |
| 9 | `SNPBTBIsolation_Active` | `SEV_FEATURES[7]` |
| 10 | `VmplSSS_Active` | `SEV_FEATURES[8]` |
| 11 | `SecureTsc_Active` | `SEV_FEATURES[9]` |
| 12 | `VmgexitParameter_Active` | `SEV_FEATURES[10]` |
| 13 | `PmcVirtualization_Active` | `SEV_FEATURES[11]` |
| 14 | `IbsVirtualization_Active` | `SEV_FEATURES[12]` |
| 15 | `GuestInterceptCtl_Active` | `SEV_FEATURES[13]` |
| 16 | `VmsaRegProt_Active` | `SEV_FEATURES[14]` |
| 17 | `SmtProtection_Active` | `SEV_FEATURES[15]` |
| 18 | `SecureAVIC_Active` | `SEV_FEATURES[16]` |
| 22:19 | Reserved (see the defect note) | — |
| 23 | `IbpbOnEntry_Active` | `SEV_FEATURES[21]` |
| 63:24 | Reserved | — |

`[APM2 §15.34.10]` `[1]`.
**Relation to `SEV_FEATURES`:** bits 0 and 1 are sourced from the VMCB, and **every bit from 2 upward mirrors `SEV_FEATURES[n − 2]`** in the VMSA. That is why `DebugVirtualization` is `SEV_FEATURES[5]` but `SEV_STATUS[7]`. A table written in `SEV_FEATURES` terms — a Linux header or a paper — will look uniformly off by two and is **not** in conflict; "correcting" AMD's table to match it is the error `errata.md` E24 exists to prevent. (`13-sev-es-ghcb.md` owns `SEV_FEATURES` and the VMSA.)
**AMD's own table has a typographical defect:** Table 15-32 prints a row reading "22-18 Reserved" immediately above the row defining bit 18 as `SecureAVIC_Active`. Both cannot be true — read the reserved range as **22:19**.
Naming: bit 7 is **`DebugVirtualization`** in AMD's table; "Debug Swap" is the Linux name and appears nowhere in AMD's documentation (`errata.md` E24, `00-quickref.md` §0.4).
What is **not** in `SEV_STATUS`: no bit for SEV-SNP *support*, only for SNP being *active* for this VM. Support is `Fn8000_001F_EAX[4]` (`11-memory-encryption.md`), global enablement is `SYSCFG[SecureNestedPagingEn]`, and per-VM activation is here — three separate conditions in that order.
**Confidence:** high — all `C:high` `V:durable`. Chapter 12 is marked **server scope** (SEV is productised on EPYC).

---

### sev-firmware-error-codes
**Routed to:** `references/12-sev.md` §12.8.2 "Status codes" — correct route (SKILL.md's row says §12.6; `00-quickref.md` §0.3 gives the SEV firmware commands as §12.8/§12.9)
**Answer:** SEV API Table 14 `[SEV-API 3.24 Table 14]` `[8]`:

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

The numbering is contiguous from `0x0000` to `0x0018` and then **jumps to `0x001F` `RB_MODE_EXITED`**, returned when a Mailbox-mode command arrives while the firmware is in Ring Buffer mode — Ring Buffer mode is then exited, the command is ignored, and a retry is recommended.
**The two that are nearly identical: `HWERROR_PLATFORM` (`0x0013`) and `HWERROR_UNSAFE` (`0x0014`).** They differ in exactly one respect — **after `HWERROR_PLATFORM` it is safe to re-allocate the parameter buffers; after `HWERROR_UNSAFE` it is not** `[SEV-API 3.24 Table 14]` `[8]`.
Two scoping notes: these are the **SEV and SEV-ES** firmware status codes from pub 55766 Rev 3.24 — **SNP firmware commands live in pub 56860** (`14-sev-snp.md`). And if the code is `INVALID_PLATFORM_STATE` or `INVALID_GUEST_STATE`, check the state machines in §12.7 first (PSTATE has three states, GSTATE seven). Spelling trap: AMD's name is `WBINVD_REQUIRED`; `SEV_RET_WBINVD_REQUIRED` is the Linux form (`00-quickref.md` §0.4).
**Confidence:** high — all `C:high` `V:durable`. Server scope.

---

### ghcb-layout-offsets
**Routed to:** `references/13-sev-es-ghcb.md` §13.4 "The GHCB layout" — correct route (the exact section SKILL.md names)
**Answer:** `[GHCB 2.04 Table 3]` `[9]`:

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
| `0x0ffa` | `0x02` | **SEV-ES/GHCB Protocol Version** | All |
| `0x0ffc` | `0x04` | **GHCB Usage** | All |

**The fields a `#VC` handler fills in** are the guest-controlled block at `0x0390`–`0x03a8` (`SW_EXITCODE`, `SW_EXITINFO1`, `SW_EXITINFO2`, `SW_SCRATCH`) plus whichever save-state fields the NAE event needs — `RAX` (`0x01f8`), `RCX`/`RDX`/`RBX`, `CPL`, `DR7`, `XCR0`, `XSS` — each marked in `VALID_BITMAP`. Only `XSS` is version-gated (protocol version 2 and later); every other defined field is present in all versions. The eight-byte slot at `0x0300` is reserved with the explicit note that RAX is already available at `0x01f8` — a hypervisor that copies the VMSA layout verbatim into the GHCB reads the wrong slot. The Shared Buffer at `0x0800` is `0x7f0` bytes and AMD commits that future versions of the specification will not alter its definition, which is why it is the buffer of choice for string I/O and MMIO staging. `X87_STATE_GPA` holds the guest physical address of a page of x87-related state in XSAVE format.
**`VALID_BITMAP`** is 16 bytes at `0x03f0` and marks which qwords of the save-state area from `0x000` through `0x3ef` — **126 qwords** — the sender has filled in. The bit index is arithmetic: divide the field's byte offset by 8 to get the qword offset; the bitmap byte is that qword offset divided by 8, and the bit within that byte is the qword offset modulo 8. AMD's worked example: **RAX at `0x01f8` → qword 63 → byte 7, bit 7** `[GHCB 2.04 §4]` `[9]`. Minimum required bits: the guest must set them for `SW_EXITCODE`, `SW_EXITINFO1` and `SW_EXITINFO2`; the hypervisor must set them for `SW_EXITINFO1` and `SW_EXITINFO2`. **Both sides must clear the whole bitmap before setting the bits for the event being performed.**
**Version and usage words:** the SEV-ES/GHCB Protocol Version at `0x0ffa` is `0x0001` for version 1 and `0x0002` for version 2. GHCB Usage at `0x0ffc` indicates the page's format — `0x00000000` means it follows the documented format, and any other value is hypervisor-defined (for example a hypercall format); on VMGEXIT the hypervisor should validate the field, must support `0x0000`, and for an unsupported value may either terminate the guest or resume it indicating an exception should be raised.
(Same chapter, worth carrying: VMGEXIT's opcode is `F2/F3 0F 01 D9` — **both prefixes are architectural**, `errata.md` E22 `[reversed]`.)
**Confidence:** high — all `C:high` `V:durable`. Server scope.

---

### snp-instructions-and-return-codes
**Routed to:** `references/14-sev-snp.md` §14.4 "The SNP instructions" — correct route (SKILL.md's row says §14.1; `00-quickref.md` §0.3 gives the SNP instructions and their error codes as §14.1–§14.4)
**Answer:** All six live in **APM Vol.3 Chapter 4**, which is alphabetical and carries page numbers only, so they are cited by mnemonic `[APM3 §4 "…"]` `[2]`:

| Mnemonic | Opcode | Page (Rev 3.38) | Who may execute | Enumerated by |
|---|---|---|---|---|
| `PSMASH` | `F3 0F 01 FF` | 432 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |
| `PVALIDATE` | `F2 0F 01 FF` | 435 | guest, **VMPL0 only** | `Fn8000_001F_EAX[SNP]` |
| `RMPADJUST` | `F3 0F 01 FE` | 447 | guest, any VMPL | `Fn8000_001F_EAX[SNP]` |
| `RMPQUERY` | `F3 0F 01 FD` | 451 | guest, any VMPL | `Fn8000_001F_EAX[6]` |
| `RMPREAD` | `F2 0F 01 FD` | 454 | hypervisor, ASID 0 | `Fn8000_001F_EAX[21]` |
| `RMPUPDATE` | `F2 0F 01 FE` | 457 | hypervisor, ASID 0 | `Fn8000_001F_EAX[SNP]` |

`RMPQUERY` and `RMPREAD` are later additions and carry their own CPUID bits instead of riding on the SNP bit. **All six are CPL0-only (`#GP(0)` otherwise), and all but `PVALIDATE` are 64-bit-mode-only (`#UD` otherwise); `PVALIDATE` is recognised in any operating mode at CPL0.** The three hypervisor instructions return **`FAIL_PERMISSION` rather than faulting** when executed at an ASID other than 0, while `RMPADJUST` and `RMPQUERY` raise `#UD` when the guest is not SNP-active. `PVALIDATE` is allowed **only at VMPL 0** and raises `#GP(0)` at any other VMPL.

**The return-code space (shared)** `[APM3 §4 "RMPUPDATE"]` `[APM3 §4 "PSMASH"]` `[2]`: `0 SUCCESS`, `1 FAIL_INPUT`, `2 FAIL_PERMISSION`, `3 FAIL_INUSE`, `4 FAIL_OVERLAP`, `6 FAIL_SIZEMISMATCH`, `7 FAIL_BADADDR` — each instruction publishes only the subset it can produce, and `OF`, `ZF`, `AF`, `PF` and `SF` are all set from the code. (The chapter lists no value 5.)
Per-instruction subsets `[APM3 §4 "PVALIDATE"]` `[APM3 §4 "RMPQUERY"]` `[2]`: `PSMASH` 0/1/2/3/7 · `PVALIDATE` 0/1/6 · `RMPADJUST` 0/1/2/6 · `RMPQUERY` 0/2 · `RMPREAD` 0/1/2 · `RMPUPDATE` 0/1/2/3/4. **A description that knows only `FAIL_OVERLAP = 4` is describing `RMPUPDATE` alone.**
Two semantics worth carrying: `PVALIDATE`'s `rFLAGS.CF` is a *changed* indicator, not an error flag — CF=0 means an SNP-active guest actually flipped the bit; CF=1 means the bit already held that value **or** the instruction ran outside an SNP-active environment, where it behaves as a NOP and still returns `SUCCESS`. And `RMPADJUST` fails with `FAIL_PERMISSION` if `TARGET_VMPL <= CURRENT_VMPL` or if the requested mask contains any bit absent from the caller's own mask — a level can only delegate downward and can never widen its own rights.
Under a nested hypervisor, `RMPUPDATE` and `PSMASH` must be replaced by WRMSR to `VIRT_RMPUPDATE` (`C001_F001h`) and `VIRT_PSMASH` (`C001_F002h`), enumerated by `Fn8000_001F_EAX[29]`; both MSRs are **not implemented in the processor** and are expected to be emulated by the top-level hypervisor `[APM2 §15.36.19]` `[1]`.
**Confidence:** high — all `C:high` `V:durable`. Server scope (SEV-SNP has never been available on a client part).

---

### attestation-report-fields
**Routed to:** `references/14-sev-snp.md` §14.11 "The attestation report" — correct route (the exact section SKILL.md names). The *current* VERSION value is version-bearing, so `90-dated-landscape.md` §90.5 was also consulted, as the chapter directs.
**Answer:** `ATTESTATION_REPORT` is **AMD's Table 27**; the structure runs to **4A0h — 1184 bytes** — and the `SIGNATURE` at 2A0h covers **bytes 0h to 29Fh inclusive** `[SNP-ABI 1.59 Table 27]` `[10]`.

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
| 188h / 189h / 18Ah | 1 each | `CPUID_FAM_ID` / `CPUID_MOD_ID` / `CPUID_STEP` | 18Bh–19Fh | 21 | reserved |

**Legal `VERSION` values:** the report version has moved across firmware ABI revisions — **3h, then 5h, then 6h — and 4h never existed** `[SNP-ABI 1.59 Table 27]` `[10]`; a source listing 2/3/5 is reporting a stale set (`errata.md` E25). The value current for a given firmware revision is version-bearing and lives in `90-dated-landscape.md` §90.5, which records that **SEV-SNP Firmware ABI Rev 1.59 sets `VERSION` to 6h** and notes an unresolved vendor conflict: Google's 2025-10-27 release note, marked "Breaking", says its SEV-SNP Confidential VMs "generate v4 attestation reports". The skill records that as a vendor statement rather than adopting it as an AMD version number `[627]` `[10]` `C:medium` **`V:dated` — a 2026-09-21 snapshot to re-verify before acting on**.
Other field notes `[SNP-ABI 1.59 Table 27 / Table 28 / §7.3 / §3.6 / App.B]` `[10]`: `SIGNING_KEY` (bits 4:2 at 48h) encodes 0 legacy VCEK, 1 VLEK, 2 chip-secret VCEK, 3–6 reserved, 7 none, and `AUTHOR_KEY_DIGEST` is zero unless `AUTHOR_KEY_EN` is 1. `POLICY` at 08h is the launch policy verbatim and **its bit 17 is reserved and must be one** — the minimal SMT-permitting policy therefore reads `0x30000`, not `0x10000`. `PLATFORM_INFO` bits: 0 `SMT_EN`, 1 `TSME_EN`, 2 `ECC_EN`, 3 `RAPL_DIS`, 4 `CIPHERTEXT_HIDING_DRAM_EN`, 5 `ALIAS_CHECK_COMPLETE`, 6 `IOMMU_WRITE_SAFE`, 7 `TIO_EN`, 63:8 reserved. `CHIP_ID` is zeroed when `MaskChipId` is set; with `MaskChipKey` = 1 the firmware writes zeroes into `SIGNATURE` instead of signing at all, and verifiers are told to check that every reserved field is zero. The only signing algorithm the ABI defines is **ECDSA P-384 with SHA-384** (algo encoding 1h, curve 2h); the signature is 512 bytes with R at 000h and S at 048h, each zero-extended little-endian. `TCB_VERSION`'s 64-bit layout **differs by product line** — Table 3 Venice, Table 4 Turin, Table 5 Genoa/Milan — so a parser assuming one misreads the others. A host can obtain a report without the guest's participation via `SNP_HV_REPORT_REQ` (96h); such a report is marked by `VMPL = 0xFFFFFFFF` and a zero-filled `REPORT_DATA`.
**Confidence:** high for the layout (`C:high` `V:durable`); **medium and `V:dated`** for "the current VERSION is 6h", which comes from `90-dated-landscape.md` and carries an unresolved vendor conflict. Server scope.
