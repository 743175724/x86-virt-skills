# 06. Nested Paging

> **中文速览**：本章覆盖 SVM 下的地址转换硬件——嵌套页表的表项逐位布局、`nCR3` 与 `NP_ENABLE`、二维遍历的最坏访存代价与它的正确出处、`#NPF` 的语义与判定顺序、guest 与 nested 内存类型的合并规则、ASID 的分配与耗尽回收、`TLB_CONTROL` 与 `INVLPGA`、GMET，以及关掉嵌套分页时的影子分页纪律。`#NPF` 的位表在 `05-exit-decoding.md`，本章写语义。

**Maps to:** APM Vol.2 §15.25 "Nested Paging" (15.25.1–15.25.15) + §15.16 "TLB Control" + Ch.5 "Page Translation and Protection"; INVLPGA in APM Vol.3 §4 [1][2]
**Owns:** nested page-table entry formats · nCR3 and NP_ENABLE · the two-dimensional walk · #NPF semantics and ordering · memory-type combining · ASID allocation, exhaustion and reuse · TLB_CONTROL · INVLPGA · GMET · shadow paging when nested paging is off
**Scope:** OS-independent hardware — every part is present on client Ryzen as well as EPYC, since nested paging is a base SVM option, not a server feature. But nested paging (Microsoft calls it SLAT, AMD's marketing name was RVI) is a hard requirement for VBS on Windows; see `16-windows-platform.md`.
**See also:** `02-vmcb.md` (nCR3, G_PAT, TLB_CONTROL offsets and clean bits) · `05-exit-decoding.md` (#NPF bit table) · `11-memory-encryption.md` (the C-bit in nested entries) · `14-sev-snp.md` (RMP checks layered on the nested walk)

---

## 6.1 Why nested paging exists

Without nested paging a hypervisor has to synthesise, for every guest linear address space, a *shadow* page table that maps guest linear addresses directly to system physical addresses, and then keep that synthetic table in step with a guest page table it does not control. Nested paging removes the synthesis step: the guest keeps its own page tables and its own `CR3`, and a second, hypervisor-owned hierarchy translates the guest physical addresses that fall out of the first one.

AMD's terms, used verbatim throughout this chapter, are **guest linear address**, **guest physical address (gPA)** and **system physical address (sPA)**. There is no host linear address anywhere in a nested walk: the nested tables translate gPA to sPA directly.

- **Claim.** Nested paging is an optional SVM feature that provides two levels of address translation and thereby eliminates the need for the VMM to maintain shadow page tables.  `[APM2 §15.25]` `[1]` `C:high` `V:durable`
- **Claim.** Guest page tables (gPT) map guest linear addresses to guest physical addresses and live in guest physical memory, pointed to by gCR3; nested page tables (nPT) map guest physical addresses to system physical addresses, live in system physical memory, and are pointed to by nCR3.  `[APM2 §15.25.1]` `[1]` `C:high` `V:durable`
- **Claim.** Because gCR3 and every guest page-table entry hold guest physical addresses rather than system physical addresses, the table walker must translate a guest page-table entry's guest physical address into a system physical address before it can read that entry.  `[APM2 §15.25.1]` `[1]` `C:high` `V:durable`
- **Claim.** The most-recently used guest-linear-to-system-physical translations are cached in the TLB and used directly on subsequent guest accesses, so the two-level walk is paid only on a TLB miss.  `[APM2 §15.25.1]` `[1]` `C:high` `V:durable`

### Enabling it

- **Claim.** VMRUN enables nested paging when the `NP_ENABLE` bit — bit 0 of the VMCB control area at offset 090h, see `02-vmcb.md` — is set to 1.  `[APM2 §15.25.3]` `[1]` `C:high` `V:durable`
- **Claim.** Support for nested paging is reported by `CPUID Fn8000_000A_EDX[NP]`, which is **bit 0** of that register; AMD documents the feature as optional and not present on every SVM-capable part, so it must be probed rather than inferred from a family.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** Nested paging is allowed only if the host itself has paging enabled: executing VMRUN with `hCR0.PG` cleared and `NP_ENABLE` set terminates with `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.25.3]` `[1]` `C:high` `V:durable`
- **Claim.** The second-level translation uses the same paging mode the VMM was using when it executed the most recent VMRUN — the nested hierarchy is not configured independently of the host.  `[APM2 §15.25.3]` `[1]` `C:high` `V:durable`
- **Claim.** Nested paging is automatically disabled by `#VMEXIT`; the host never runs with a nested translation active.  `[APM2 §15.25.3]` `[1]` `C:high` `V:durable`
- **Claim.** `N_CR3`, the nested page-table CR3, lives at VMCB control-area byte offset 0B0h (see `02-vmcb.md`) and is loaded by VMRUN into nCR3.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Two extra illegal state combinations apply when `NP_ENABLE` = 1, on top of the general consistency checks: any MBZ bit of nCR3 set, and a `G_PAT.PA` field holding an unsupported type encoding or a non-zero reserved field.  `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`
- **Claim.** On Windows, VBS requires second-level address translation in hardware; the AMD side of that requirement is this chapter's machinery, and the platform detail is in `16-windows-platform.md`.  `[42]` `C:medium` `V:durable`

## 6.2 Nested page-table entry formats

Because the nested hierarchy runs in the host's paging mode (§6.1), a nested page-table entry **is** an AMD64 page-translation-table entry in the ordinary Chapter 5 format. What changes is not the encoding but the meaning of three of the permission bits — see the second half of this section.

The long-mode 4-Kbyte formats, read from the figures rather than from prose:

| Bit(s) | PML5E / PML4E | PDPE, PDE (non-leaf) | PTE (4-Kbyte leaf) | PDE (2-Mbyte leaf) | PDPE (1-Gbyte leaf) |
|---|---|---|---|---|---|
| 0 | P | P | P | P | P |
| 1 | R/W | R/W | R/W | R/W | R/W |
| 2 | U/S | U/S | U/S | U/S | U/S |
| 3 | PWT | PWT | PWT | PWT | PWT |
| 4 | PCD | PCD | PCD | PCD | PCD |
| 5 | A | A | A | A | A |
| 6 | IGN | IGN | **D** | **D** | **D** |
| 7 | **MBZ** | **0** (PS = 0) | **PAT** | **1** (PS = 1) | **1** (PS = 1) |
| 8 | **MBZ** | IGN | **G** | **G** | **G** |
| 11:9 | AVL | AVL | AVL | AVL | AVL |
| 12 | — | — | — | **PAT** | **PAT** |
| — | 51:12 next-table base | 51:12 next-table base | 51:12 page base | 20:13 MBZ, 51:21 page base | 29:13 MBZ, 51:30 page base |
| 62:52 | Available | Available | 58:52 Available; 62:59 MPK or Available | 58:52 Available; 62:59 MPK or Available | 58:52 Available; 62:59 MPK or Available |
| 63 | NX | NX | NX | NX | NX |

- **Claim.** In the long-mode 4-Kbyte PML5E and PML4E, bit 6 is ignored, **bits 7 and 8 are MBZ**, bits 11:9 are available to software, bits 51:12 hold the next-level table base address, bits 62:52 are available and bit 63 is NX.  `[APM2 Figure 5-19]` `[1]` `C:high` `V:durable`
- **Claim.** In the non-leaf PDPE and PDE, bit 7 is the page-size bit cleared to 0 while bits 6 and 8 are ignored — the MBZ rule of the two upper levels does not apply here.  `[APM2 Figure 5-21]` `[1]` `C:high` `V:durable`
- **Claim.** In the 4-Kbyte PTE, bit 6 is D, **bit 7 is PAT (not PS)**, bit 8 is G, bits 51:12 are the physical-page base, bits 58:52 are available and bits 62:59 are the memory protection key when `CR4.PKE` = 1 and available otherwise.  `[APM2 Figure 5-23]` `[1]` `C:high` `V:durable`
- **Claim.** In a 2-Mbyte leaf PDE, bit 7 is set to 1, bit 8 is G, **bit 12 is PAT**, bits 20:13 are reserved MBZ and bits 51:21 are the physical-page base; the 1-Gbyte leaf PDPE is identical except that bits 29:13 are reserved MBZ and bits 51:30 hold the base.  `[APM2 Figure 5-29]` `[APM2 Figure 5-34]` `[1]` `C:high` `V:durable`
- **Claim.** The PAT bit moves with the level: it is bit 7 when the lowest level is a PTE and bit 12 when the lowest level is a leaf PDE or leaf PDPE.  `[APM2 §5.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** The address field is architecturally 52 bits; an implementation supporting fewer physical address bits requires software to clear the unimplemented high-order bits of the field to 0.  `[APM2 §5.4.1]` `[1]` `C:high` `V:durable`
- **Claim.** Reserved bits must be cleared to 0; in long mode a set reserved bit raises a fault, which at the nested level is a `#VMEXIT(NPF)` with the RSV error bit rather than a guest `#PF`.  `[APM2 §5.4.1]` `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** NX is honoured only when `EFER.NXE` = 1, and the host's EFER governs the nested level: if the host's `EFER.NXE` is cleared, **all** nested mappings are executable at the nested level.  `[APM2 §15.25.7]` `[1]` `C:high` `V:durable`

### Where nested semantics diverge from ordinary paging

This is the part that does not transfer from an EPT mental model. At the nested level the processor does not simply repeat the guest's access type.

- **Claim.** Unless Read Only Guest Page Tables is enabled, a table walk **of the guest's page tables** is always treated as a *user write* at the nested level: the page must be user-writable in the nested tables or a `#VMEXIT(NPF)` is raised, and the Accessed and Dirty bits are always set in every nested entry touched on the way.  `[APM2 §15.25.5]` `[1]` `C:high` `V:durable`
- **Claim.** Read Only Guest Page Tables is reported by `CPUID Fn8000_000A_EDX[ROGPT]` (bit 21) and enabled per guest by setting bit 6 of VMCB offset 090h (`02-vmcb.md`); with it on, guest page-table accesses count as writes at the nested level only when an Accessed or Dirty update is actually required, which lets a hypervisor map guest page tables into read-only nested pages.  `[APM2 §15.25.5]` `[1]` `C:high` `V:durable`
- **Claim.** A walk for the guest *page* itself is likewise always a user access at the nested level, but is classified as a data read, data write or code read according to the guest's own access.  `[APM2 §15.25.5]` `[1]` `C:high` `V:durable`
- **Claim.** A page is writable by the guest only if it is writable at both levels; `gCR0.WP` affects only the interpretation of the guest entry and can never make a nested-read-only page writable at any CPL, and the host's `hCR0.WP` is ignored entirely under nested paging.  `[APM2 §15.25.7]` `[1]` `C:high` `V:durable`
- **Claim.** A page is executable by the guest only if it is executable at both levels.  `[APM2 §15.25.7]` `[1]` `C:high` `V:durable`
- **Claim.** Globality is taken from the guest alone: a page is global only if the guest entry says so, the nested entry's G bit and the host's `hCR4.PGE` are irrelevant, and a global page is global only within its ASID.  `[APM2 §15.25.7]` `[1]` `C:high` `V:durable`
- **Claim.** User/supervisor is asymmetric: a page is *user* in the guest only if the guest entry marks it user, but the nested entry must mark the page user for the guest to be allowed **any** access at all.  `[APM2 §15.25.7]` `[1]` `C:high` `V:durable`
- **Claim.** When guest and nested entries map an address with different page sizes, the TLB entry that gets created matches the **smaller** of the two — AMD calls this page splintering.  `[APM2 §15.25.9]` `[1]` `C:high` `V:durable`

### The C-bit and supervisor-shadow-stack marking

- **Claim.** The encryption attribute bit in a page-table entry, whose position is implementation-specific and reported by `CPUID Fn8000_001F_EBX` (owned by `11-memory-encryption.md`), may be applied to entries mapping 4-Kbyte, 2-Mbyte or 1-Gbyte pages.  `[APM2 §7.10]` `[1]` `C:high` `V:durable`
- **Claim.** When that bit is a physical-address bit it is masked out of the guest physical address before that address is translated through the nested page tables, so the hypervisor's nested tables need not know which guest pages are private; details in `11-memory-encryption.md`.  `[APM2 §15.34.6]` `[1]` `C:high` `V:durable`
- **Claim.** With the Supervisor Shadow Stack feature enabled, a nested page is designated as a supervisor-shadow-stack page by NX = 1 and U/S = 0 in the final nested entry plus R/W = 1 in every non-leaf nested entry on the path; AMD notes that R/W *should* be 0 in the final entry for the intended security property although the hardware does not enforce it.  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`

## 6.3 Replicated paging state

Under nested paging the processor keeps two copies of the paging control state, and a great many hypervisor bugs are really a confusion about which copy a given register write landed in.

- **Claim.** Most processor state affecting paging is replicated for host and guest — specifically CR0, CR3, CR4, EFER and PAT. CR2 is **not** replicated but is loaded by VMRUN, and the MTRRs are not replicated at all.  `[APM2 §15.25.2]` `[1]` `C:high` `V:durable`
- **Claim.** While nested paging is enabled, all guest references to the paging registers through x86 code (`MOV` to/from CRn and so on) read and write the *guest* copy; the VMM's copies are untouched and continue to govern the guest-physical-to-system-physical translation.  `[APM2 §15.25.2]` `[1]` `C:high` `V:durable`
- **Claim.** When nested paging is disabled the picture inverts: the VMM's paging control registers are stored in the host state save area and the paging control registers taken from the guest VMCB are the only active versions of those registers.  `[APM2 §15.25.2]` `[1]` `C:high` `V:durable`
- **Claim.** With nested paging enabled, VMRUN saves the VMM's CR3 in the host save area, loads the guest paging state from the guest VMCB, loads the guest PAT from the `G_PAT` field and loads nCR3 from the `N_CR3` field, while the other host paging-control bits such as `hCR4.PAE` simply remain as the VMM left them.  `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`
- **Claim.** On `#VMEXIT` with nested paging enabled the guest paging state (gCR3, gCR0 and the rest) is written back into the VMCB, but **nCR3 is not saved back**, and the processor need not reload any host paging state other than CR3 from the host save area although an implementation may do so.  `[APM2 §15.25.4]` `[1]` `C:high` `V:durable`
- **Claim.** In the VMCB clean field, bit 4 (`NP`) covers exactly `N_CR3` and `G_PAT` and bit 2 (`ASID`) covers the ASID, while `TLB_CONTROL` is on the explicit list of fields that are never cached and have no clean bit — so a clean-bits optimisation can never substitute for a TLB command. The clean-bit mechanics belong to `02-vmcb.md`.  `[APM2 §15.15.3]` `[1]` `C:high` `V:durable`
- **Claim.** Legacy PAE behaves differently inside a nested-paging guest: the guest's four PDPEs are **not** loaded into the processor when CR3 is written but are fetched on demand during a table walk, so an illegal PDPE bit combination is signalled when the entry is walked rather than at the CR3 write, and an operating system may not rely on the in-processor copy matching memory.  `[APM2 §15.25.10]` `[1]` `C:high` `V:durable`
- **Claim.** There is no provision for applying A20 masking to guest physical addresses; a VMM that needs it emulates it by changing the nested mappings.  `[APM2 §15.25.11]` `[1]` `C:high` `V:durable`

## 6.4 The two-dimensional walk

On a TLB miss the walker traverses two hierarchies at once. Every guest page-table entry it wants to read is named by a guest physical address, so reading it costs a full nested walk of its own; only after the guest walk completes is the final guest physical address itself walked through the nested tables.

- **Claim.** A TLB miss under nested paging causes several nested table walks: each guest page-table entry's guest physical address is translated through the nested tables — and nested-level faults, including write faults from setting Accessed and Dirty bits in the guest tables, can occur on those accesses — and then, once the guest linear to guest physical mapping is known and the guest permissions check out, the final guest physical address is itself walked in the nested tables.  `[APM2 §15.25.5]` `[1]` `C:high` `V:durable`
- **Claim.** If the guest has paging disabled (`gCR0.PG` = 0) there are no guest page-table entries to translate: the final guest physical address equals the guest linear address and is still translated through the nested tables.  `[APM2 §15.25.5]` `[1]` `C:high` `V:durable`

### The cost, and where the number actually comes from

> **Sourcing rule.** The worst-case reference count for the two-dimensional walk **is not stated in the APM**, which gives only the per-dimension walk lengths. Its first-party source is AMD's own nested-paging white paper and the AMD-authored ASPLOS paper that introduced the general form. An anchor of the form `[APM2 §15.25.x]` on this number is a fabrication; `errata.md` `E11` records the same rule.

- **Claim.** With four-level guest paging and four-level nested paging, a TLB miss costs at worst **24 memory references**.  `[NP-WP §4.2.2]` `[15]` `C:high` `V:durable`
- **Claim.** The general form for an *n*-level guest hierarchy over an *m*-level nested hierarchy is `nm + n + m`, which is identical to `(n+1)(m+1) − 1`; the reference subtracted by the second form is the fetch of the datum itself, which is the access the program wanted rather than a translation step.  `[NP-WP §4.2.2]` `[56]` `C:high` `V:durable`

The three terms map onto the walk described above, which is the useful way to remember it:

- `nm` — for each of the *n* guest page-table entries the walker must read, a full *m*-reference nested walk to turn that entry's guest physical address into a system physical address. With four levels each way that is 4×4 nested references.
- `n` — the *n* guest page-table entry fetches themselves, once each has an address the walker can issue.
- `m` — the final nested walk that translates the guest physical address the guest walk produced.

Adding the datum fetch back gives `(n+1)(m+1)`, which is why the two forms differ by exactly one.

Applying the formula:

| Guest levels *n* | Nested levels *m* | `nm + n + m` | Status |
|---|---|---|---|
| 4 | 4 | (4×4) + 4 + 4 = **24** | Quoted by AMD |
| 4 | 5 (or 5 over 4) | (4×5) + 4 + 5 = **29** | Derived here |
| 5 | 5 | (5×5) + 5 + 5 = **35** | Derived here |

- **Claim.** The five-level (LA57) values — 35 when both dimensions use five levels and 29 for the mixed four/five-level cases — are **derivations from `nm + n + m`, not figures quoted by any published source**; `errata.md` `O6` records that no source states either number.  `[NP-WP §4.2.2]` `[56]` `C:medium` `V:durable`

### What the hardware does about it

- **Claim.** AMD64 processors may save upper-level translation-table entries in dedicated table-walk caching structures, kept coherent with memory by the same mechanisms as the TLBs — INVLPG, moves to CR3, and modification of the paging control bits in CR0 and CR4 — and an entry is never cached while its P bit is 0.  `[APM2 §5.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** An upper-level entry that cannot lead to a valid translation may still be cached, including down a mispredicted path, so it is not safe to modify an upper-level nested entry without first clearing its present bit and then invalidating.  `[APM2 §5.5.3]` `[1]` `C:high` `V:durable`
- **Claim.** The three-tier organisation often quoted for this — a conventional TLB, a nested TLB caching guest-physical-to-system-physical translations, and page-walk caches for the upper levels — is a description of the 2008 Opteron design published by the AMD authors of the ASPLOS paper. It is a **microarchitectural** design point, not an architectural guarantee, and no AMD specification requires any particular structure.  `[no-spec]` `[56]` `C:medium` `V:durable`

Performance consequences — how much of the worst case is actually paid, and how nested paging compares with shadow paging — are deliberately **not** in this chapter. They belong to `18-performance.md`, where a number must carry a microarchitecture, a hypervisor, a benchmark and a year.

## 6.5 Nested page faults

### Fault ordering

The single most useful fact in this section is that nested and guest faults are not interleaved arbitrarily: the walk has a defined order and faults are generated in that order.

- **Claim.** The nested walk proceeds, and generates faults, in this order: (1) walk the guest page-table entries through the nested tables, setting Dirty and Accessed bits in the nested tables as needed, with any nested fault producing `#VMEXIT(NPF)`; (2) as the guest walk descends, a not-present entry or a set reserved bit at any guest level produces a guest `#PF`, with guest Accessed and Dirty bits set as needed — steps 1 and 2 repeat per guest level; (3) once the guest physical address is known, check guest permissions, any failure producing a guest `#PF`; (4) perform the final guest-physical to system-physical translation, any fault producing `#VMEXIT(NPF)`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Nested page faults are entirely a function of the nested page table and the VMM's processor mode, and guest faults are entirely a function of the guest page tables and the guest's processor mode; guest `#PF` is delivered to the guest as a normal exception with no VMM involvement unless the VMM is intercepting `#PF`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** All RMP and VMPL checks happen **after** the page-table and nested-page-table access checks and have lower priority than the existing paging checks; the RMP machinery itself is owned by `14-sev-snp.md`.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`

### What the exit carries

- **Claim.** A nested page fault exits with exit code **400h** (`VMEXIT_NPF`), described by AMD as a host-level page fault under nested paging, with the fault error code in EXITINFO1 and the guest physical address causing the fault in EXITINFO2; the exhaustive bit table is owned by `05-exit-decoding.md`.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Claim.** The low half of the `#NPF` error code mirrors a `#PF` error code with nested meanings: bit 0 (P) is 0 when the nested page was not present, bit 1 (RW) is set when the nested-level access was a write, bit 2 (US) when it was a user access, bit 3 (RSV) when reserved bits were set in the corresponding nested entry, bit 4 (ID) when it was a code read, and bit 6 (SS) when the fault came from a shadow-stack access. The numbering is recorded once, in `05-exit-decoding.md`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Two of those bits mean something counter-intuitive because of the walk rules in §6.2: host table walks for guest page tables are always reported as data writes, so RW is set even for a guest instruction fetch, and nested accesses performed by the MMU are treated as user accesses unless an enabled feature overrides that.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 32 and 33 say *which* walk faulted — bit 32 is set when the nested page fault occurred while translating the guest's final physical address, bit 33 when it occurred while translating the guest page tables — and bit 37 is set when the leaf nested entry marked the page a supervisor shadow stack page and the shadow-stack check feature is enabled. Both live in the table in `05-exit-decoding.md`.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`
- **Claim.** SEV-SNP adds further bits to the same field — bit 31 (RMP), bit 34 (ENC, the guest's effective encryption bit), bit 35 (SIZEM, a size mismatch against the RMP) and bit 36 (VMPL) — and the numbering is off by one from bit 34 upward in much secondary material; `errata.md` `E04` records the correction and `05-exit-decoding.md` owns the table.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Claim.** The processor may supply instruction decode-assist information alongside a nested page fault; decoding it is `05-exit-decoding.md`'s subject.  `[APM2 §15.25.6]` `[1]` `C:high` `V:durable`

### Faults the SSS and PML extensions add

- **Claim.** With the Supervisor Shadow Stack feature enabled, a guest supervisor-shadow-stack access to a page not designated as such produces `#VMEXIT(NPF)` with the SS error bit set, and attempting to execute from a designated page produces `#VMEXIT(NPF)` exactly as any NX = 1 page would; conversely, a supervisor shadow-stack write to a designated page is allowed to complete even though R/W = 0 in the final nested entry.  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`
- **Claim.** When the Page Modification Logging buffer index is outside the range 0 to 1FFh the write is not performed, the Dirty bit is not set, and the processor exits with `VMEXIT_PML_FULL` (exit code **407h**), which does not advance the guest rIP and is an Automatic Exit for SEV-ES and SEV-SNP guests.  `[APM2 §15.25.15]` `[1]` `C:high` `V:durable`

## 6.6 Combining guest and nested memory types

This section is what you need to map a framebuffer or an emulated MMIO window correctly, and it is the part of nested paging that has no counterpart in a naive "second page table" model.

- **Claim.** When nested paging is **disabled**, the processor behaves as though there were no guest PAT register: the host PAT MSR determines the memory type for the current VM, un-intercepted guest writes to the PAT MSR alter the host PAT MSR, and the hypervisor is responsible for context-switching the PAT contents across world switches.  `[APM2 §15.25.8]` `[1]` `C:high` `V:durable`
- **Claim.** When nested paging is **enabled**, the processor combines guest and nested memory types from six inputs: the PCD/PWT/PATi bits in both the nested and the guest entries, the PCD/PWT bits in nested CR3 and guest CR3, the guest PAT type, the host PAT type, the MTRRs, and `gCR0.CD` together with `hCR0.CD`.  `[APM2 §15.25.8]` `[1]` `C:high` `V:durable`
- **Claim.** The guest PAT register lives in the VMCB state-save area at byte offset 268h as a qword that is swapped for the guest and unused in host mode, and is loaded by VMRUN only when nested paging is enabled; the offset table is owned by `02-vmcb.md`.  `[APM2 Table B-2]` `[1]` `C:high` `V:durable`
- **Claim.** There is **no hardware support for guest MTRRs**: the MTRRs are referenced only by system physical address, and a VMM that must present MTRR behaviour to a guest simulates it by altering the memory types in the nested page tables.  `[APM2 §15.25.8]` `[1]` `C:high` `V:durable`
- **Claim.** The combining rule is two-stage — nested and guest PAT types combine into a "combined PAT type" per Table 15-19, that result combines with the MTRR type selected by the *system* physical address per Table 15-20 — and either `gCR0.CD` or `hCR0.CD` can disable caching outright.  `[APM2 §15.25.8]` `[1]` `C:high` `V:durable`

Table 15-19, guest PAT type down the side and host PAT type across:

| Guest ↓ / Host → | UC | UC− | WC | WP | WT | WB |
|---|---|---|---|---|---|---|
| **UC** | UC | UC | UC | UC | UC | UC |
| **UC−** | UC | UC− | WC | UC | UC | UC |
| **WC** | WC | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | UC | UC | WP | UC | WP |
| **WT** | UC | UC | UC | UC | WT | WT |
| **WB** | UC | UC | WC | WP | WT | WB |

Table 15-20, effective PAT type down the side and MTRR type across:

| Effective PAT ↓ / MTRR → | UC | WC | WP | WT | WB |
|---|---|---|---|---|---|
| **UC** | UC | CD | CD | CD | CD |
| **UC−** | UC | WC | CD | CD | CD |
| **WC** | WC | WC | WC | WC | WC |
| **WC+** | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | CD | WP | CD | WP |
| **WT** | UC | CD | CD | WT | WT |
| **WB** | UC | WC | WP | WT | WB |

- **Claim.** Those two tables are the normative combining rules; both are printed in the memory-type section of the nested paging chapter.  `[APM2 Table 15-19]` `[APM2 Table 15-20]` `[1]` `C:high` `V:durable`
- **Claim.** Because guest and VMM can end up using different memory types for the same physical page, AMD provides three mitigations: VMRUN and `#VMEXIT` flush the write combiners; a memory type **WC+** exists which combines writes like WC but also snoops every processor's caches, including self-snooping, so that cacheable writes are observed; and when nested and guest types are incompatible with respect to caching the combining rules produce WC+ instead of WC.  `[APM2 §15.25.8]` `[1]` `C:high` `V:durable`

## 6.7 ASID: allocation, exhaustion and reuse

- **Claim.** TLB entries are tagged with an Address Space Identifier, which distinguishes different guest *virtual* address spaces when shadow page tables are used and different guest *physical* address spaces when nested page tables are used.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`
- **Claim.** Under nested paging an ASID is associated with the guest's physical address space and is therefore common across all of that guest's virtual address spaces on a processor — the opposite of shadow paging, where an ASID tags an individual guest virtual address space.  `[APM2 §15.25.1]` `[1]` `C:high` `V:durable`
- **Claim.** ASID 0 is reserved for the host, and the current ASID is 0 whenever the CPU is not inside a guest context.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** "ASID is equal to zero" appears in VMRUN's list of illegal state combinations, so attempting VMRUN with a guest ASID of zero produces `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** The number of ASIDs a processor supports is implementation-specific and is the value returned in EBX by `CPUID Fn8000_000A` — the whole 32-bit register is the `NASID` field, not a subfield of it.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** Whether the same ASID denotes the same address space on every processor of a multiprocessor system is left to the VMM, for nested and shadow tables alike; nothing in the architecture ties an ASID to an address space globally.  `[APM2 §15.25.1]` `[1]` `C:high` `V:durable`
- **Claim.** When SEV is in use the ASID space is partitioned, with `CPUID Fn8000_001F_ECX` reporting the number of encrypted guests supported and `Fn8000_001F_EDX` reporting the minimum ASID usable by a SEV guest without encrypted state; the SEV side of ASID management lives in `12-sev.md`.  `[APM3 App.E]` `[2]` `C:high` `V:durable`

### Exhaustion and reuse

The architecture gives one explicit recycling rule, and it is the basis of every generation-counter scheme in a real hypervisor.

- **Claim.** On implementations without a way to selectively flush all translations of one specified ASID, software may flush a guest's TLB entries effectively by allocating it a **new** ASID and not reusing the old ASID until the entire TLB has been flushed at least once.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** A hypervisor that runs out of ASIDs therefore has a correct fallback, but it is a global one: bumping the generation means every previously issued ASID must be considered stale until a full TLB flush has happened on that logical processor, which is why the recycle path is normally paired with `TLB_CONTROL` = 1 rather than with per-guest invalidation.  `[APM2 §15.16.1]` `[1]` `C:medium` `V:durable`
- **Claim.** Moving a vCPU between logical processors carries an explicit obligation: for non-SNP-active guests the hypervisor must ensure the VMSA cannot use stale TLB translations, and only for SNP-active guests does hardware detect the move and manage the TLB itself; see `14-sev-snp.md`.  `[APM2 §15.36.15]` `[1]` `C:high` `V:durable`
- **Claim.** There is one further migration rule specific to virtual interrupts: when a core that last ran a different vCPU of the same VM is used to run a vCPU with xAVIC mode enabled, the VMM must flush with `TLB_CONTROL` = 3h **regardless of the respective ASID values**, or stale mappings may misdirect virtual APIC accesses to the previous vCPU's backing page; see `07-virtual-interrupts-avic.md`.  `[APM2 §15.29.4.3]` `[1]` `C:high` `V:durable`
- **Claim.** When SVM is enabled, global page-table entries are global only within an ASID and never across ASIDs — a global mapping is not a way to share a translation between guests.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`

## 6.8 TLB control and INVLPGA

### The TLB_CONTROL field

- **Claim.** `TLB_CONTROL` occupies bits 39:32 of the VMCB control area at byte offset 058h, immediately above the 32-bit guest ASID in bits 31:0 of the same qword; the layout is owned by `02-vmcb.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`

| Encoding | Function |
|---|---|
| `00h` | Do not flush |
| `01h` | Flush entire TLB — all entries, all ASIDs — on VMRUN. AMD says it should be used only on legacy hardware |
| `03h` | Flush this guest's TLB entries |
| `07h` | Flush this guest's non-global TLB entries |

- **Claim.** Those four encodings are the whole of Table 15-9 and the table carries an explicit note that **all encodings not defined in it are reserved**.  `[APM2 Table 15-9]` `[1]` `C:high` `V:durable`
- **Claim.** The first two commands are available on every processor supporting SVM; support for `03h` and `07h` is optional and indicated by `CPUID Fn8000_000A_EDX[FlushByAsid]`, which is **bit 6**, the same bit that indicates that TLB flush events such as CR3 writes and `CR4.PGE` toggles flush only the current ASID's entries.  `[APM2 §15.16.1]` `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** With `TLB_CONTROL` set to 1, VMRUN flushes the TLB for all ASIDs and for both global and non-global pages; VMRUN reads the field but does not change it, so the hypervisor must reset it itself between entries.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** A hypervisor that modifies a nested page table by decreasing permissions, clearing present bits or changing translations, and intends to re-enter the same ASID, should use TLB command `011b` or `001b` — three or one, not seven, because a downgrade can affect global entries too.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN's published list of illegal state combinations **does not** include a reserved `TLB_CONTROL` encoding, so a reserved value is not rejected by a consistency check; software must not rely on being told.  `[APM2 §15.5.1]` `[1]` `C:medium` `V:durable`
- **Claim.** A `MOV CR3`, a task switch that changes CR3, or clearing or setting `CR0.PG` or the PGE, PAE or PSE bits of CR4 affects only the TLB entries belonging to the current ASID, whether the operation happened in host or guest mode.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** All TLB entries of all ASIDs are flushed by SMI, RSM, MTRR modifications, IORR modifications and accesses to other system MSRs that affect address translation.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the VMM intercepts a guest action that would have flushed the TLB, the `#VMEXIT` occurs and **the TLB is not flushed**; the flush becomes the VMM's responsibility.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** AMD states a software rule for mode changes: when the VMM changes a guest's paging mode by editing the guest VMCB, it must flush the guest's TLB entries, and the state that counts is CR0 (PG, WP, CD, NW), CR3 (any bit), CR4 (PGE, PAE, PSE) and EFER (NXE, LMA, LME).  `[APM2 §15.16]` `[1]` `C:high` `V:durable`

Putting those rules together, the decision a hypervisor actually has to make on each VMRUN reduces to:

| Situation | Command |
|---|---|
| Nothing changed since this vCPU last ran on this logical processor | `00h` |
| Nested entries downgraded (permissions reduced, present cleared, translation changed), re-entering the same ASID | `03h` (or `01h` on a processor without FlushByAsid) |
| Guest paging mode changed in the VMCB (CR0 PG/WP/CD/NW, any CR3 bit, CR4 PGE/PAE/PSE, EFER NXE/LMA/LME) | `03h` |
| Only non-global guest entries are stale | `07h` |
| This core last ran a different vCPU of the same VM and xAVIC is on | `03h`, unconditionally |
| ASID generation rolled over and an ASID is being reused | `01h` |

- **Claim.** That mapping is a restatement of the rules above and adds nothing new; the only encoding AMD singles out as undesirable is `01h`, which it marks for legacy hardware because it discards every ASID's entries including the host's.  `[APM2 Table 15-9]` `[1]` `C:high` `V:durable`

### INVLPGA, and why it is not the nested-paging tool

- **Claim.** `INVLPGA` is encoded `0F 01 DF`, takes the linear address in the implicit register operand rAX — with the portion used determined by the effective address size — and the ASID in ECX, may invalidate additional entries beyond the targeted one, is serializing and privileged, and requires CPL 0.  `[APM3 §4 "INVLPGA"]` `[2]` `C:high` `V:durable`
- **Claim.** `INVLPGA` raises `#UD` if SVM is unsupported per `CPUID Fn8000_0001_ECX[SVM]` = 0, if SVM is not enabled (`EFER.SVME` = 0), or outside protected mode, and `#GP` if CPL is not 0.  `[APM3 §4 "INVLPGA"]` `[2]` `C:high` `V:durable`
- **Claim.** The address operand of `INVLPGA` is **always interpreted as a guest virtual address**, so the instruction is typically meaningful only with shadow page tables: AMD states plainly that it does not provide a means to invalidate a nested translation by guest physical address.  `[APM2 §15.16.2]` `[1]` `C:high` `V:durable`
- **Claim.** Plain `INVLPG` (`0F 01 /7`) differs in three ways: it invalidates regardless of the G bit and regardless of page size, it has no ASID operand, and it invalidates only entries tagged with the current PCID plus global pages irrespective of PCID.  `[APM3 §4 "INVLPG"]` `[2]` `C:high` `V:durable`
- **Claim.** Guest execution of both `INVLPG` and `INVLPGA` is interceptable, and the exit codes for them are listed once, in `05-exit-decoding.md`; the intercept bits belong to `03-intercepts.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** The broadcast instruction `INVLPGB` is gated for guests by bit 7 of VMCB offset 090h, whose presence is indicated by `CPUID Fn8000_000A_EDX[24]`; with the bit clear `INVLPGB` and `TLBSYNC` raise `#UD` in the guest, and the hypervisor may intercept guest `INVLPGB` unconditionally or only when illegally specified. The VMCB side is `02-vmcb.md`.  `[APM3 §4 "INVLPGB"]` `[2]` `C:high` `V:durable`

### The erratum question — answered negatively

The pre-rebuild corpus asserted an INVLPGA erratum on Genoa and Turin without a number. Both public revision guides were searched.

- **Claim.** Neither AMD revision guide in this corpus documents an INVLPGA erratum: the Family 19h Models 10h–1Fh guide (Genoa, Rev 1.05, 2025-11) contains no occurrence of the mnemonic at all, and the Family 1Ah Models 00h–0Fh guide (Turin, Rev 1.30, 2025-07) contains no `INVL*` erratum whatsoever. **No erratum number exists to cite.**  `[no-spec]` `[27]` `[25]` `C:high` `V:durable`
- **Claim.** The nearest published item is erratum **#1455, "PCID-Based INVLPGB May Fail to Flush Global Translations"** in the Family 19h Models 10h–1Fh guide, for which AMD expects no effect because software is not expected to use INVLPGB with PCID-based flushing, and plans no fix. It concerns INVLPGB, not INVLPGA, and conflating the two mnemonics is a plausible origin for the unnumbered claim.  `[RevGuide 57095 erratum 1455]` `[27]` `C:high` `V:durable`
- **Claim.** AMD publishes revision guides for EPYC parts only; there is no public revision guide and no public PPR for any client Ryzen, so an INVLPGA erratum affecting a desktop part could not be cited even if one existed.  `[no-spec]` `[27]` `[25]` `C:high` `V:durable`
- **Claim.** Linux KVM has nevertheless stopped using the instruction on the nested-paging path: a 2026-07 patch restricts `INVLPGA` in `svm_flush_tlb_gva()` to shadow paging and forces a full ASID bump when NPT is enabled, its rationale stating that "INVLPGA has had errata on Genoa and Turin, and even on older generations there were reports of Windows BSODs if INVLPGA was used for Hyper-V tlbflush". This is a **KVM-side decision recorded on the mailing list, asserted by a kernel maintainer**; AMD has published no erratum number for it, and nothing in either revision guide corroborates it.  `[200]` `C:medium` `V:durable`
- **Claim.** The practical consequence for anyone writing a VMM on AMD is that whole-ASID invalidation via `TLB_CONTROL`, not per-page `INVLPGA`, is the correct baseline once nested paging is on — which the architecture already implies, since the instruction cannot address a nested translation at all.  `[APM2 §15.16.2]` `[1]` `C:high` `V:durable`

## 6.9 Guest mode execute trap and the other nested-paging extensions

### GMET

- **Claim.** The Guest Mode Execute Trap extension lets a hypervisor cause nested page faults when a guest attempts to execute code at CPL 0, 1 or 2 from pages the hypervisor designates; its presence is indicated by `CPUID Fn8000_000A EDX[17] = 1` and it is selected per guest by setting bit 3 of VMCB offset 090h, a bit ignored on processors without the extension. The VMCB field table is `02-vmcb.md`.  `[APM2 §15.25.13]` `[1]` `C:high` `V:durable`
- **Claim.** GMET works by changing how the **nested** U/S bit is interpreted: NX = 1 still prohibits execution at any privilege level, but with GMET enabled and an effective NX of 0, an effective U/S of 1 combined with an execute access at CPL 0, 1 or 2 generates `#VMEXIT(NPF)`, while effective NX = 0 with effective U/S = 0 allows the code translation.  `[APM2 §15.25.13]` `[1]` `C:high` `V:durable`

| nPT NX | nPT U/S | Guest user-mode code | Guest supervisor-mode code |
|---|---|---|---|
| 1 | X | No Execute | No Execute |
| 0 | 1 | Execute | No Execute |
| 0 | 0 | Execute | Execute |

- **Claim.** That table is AMD's summary of GMET behaviour when the extension is enabled.  `[APM2 Table 15-21]` `[1]` `C:high` `V:durable`
- **Claim.** A GMET violation is **not** flagged by a dedicated error bit: software must work out whether a fault was NX-based or GMET-based by inspecting the ordinary error code together with the faulting page's effective NX and U/S settings, and AMD footnotes that on some implementations a GMET erratum may require the CPL to be read from the guest VMCB instead of from the exit information.  `[APM2 §15.25.13]` `[1]` `C:high` `V:durable`
- **Claim.** GMET is the hardware primitive underneath kernel-mode code-integrity enforcement on AMD hosts — it is how a hypervisor makes supervisor-mode execution of a page a trappable event without making the page non-executable to user mode; the Windows HVCI side is in `16-windows-platform.md`.  `[42]` `C:medium` `V:durable`

### Supervisor shadow stacks

- **Claim.** The Supervisor Shadow Stack extension restricts which guest physical addresses may back a guest supervisor shadow stack; support is `CPUID Fn8000_000A_EDX[19]` (`SupervisorShadowStack`) and it is enabled by setting bit 4 in VMCB offset 090h (`02-vmcb.md`).  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`
- **Claim.** SSS may be enabled only with nested paging enabled in the VMCB and with PAE and no-execute paging (`EFER.NXE` = 1) enabled in the host; VMRUN with SSS enabled and nested paging disabled results in `VMEXIT(INVALID)`, whereas a host that is in legacy non-PAE mode or has `EFER.NXE` = 0 causes the enable attempt to be **silently ignored**. It may be enabled whether or not the guest has turned shadow stacks on.  `[APM2 §15.25.14]` `[1]` `C:high` `V:durable`

### Page modification logging

- **Claim.** Page Modification Logging is reported by `CPUID Fn8000_000A_ECX[PML]` (bit 4) and enabled on VMRUN when bit 11 of VMCB offset 090h is set and nested paging is enabled; the offsets belong to `02-vmcb.md`.  `[APM2 §15.25.15]` `[1]` `C:high` `V:durable`
- **Claim.** When a guest write sets the Dirty bit of a nested entry, the processor writes the 4-Kbyte-aligned guest physical address (bits 11:0 cleared) into a 4-Kbyte PML buffer located at `PML_BASE`, VMCB control-area offset 1C8h, at address `PML_BASE + PML_INDEX × 8`, then decrements the index; on `#VMEXIT` the current index is written to `PML_INDEX` at offset 1D0h, and software should write 1FFh there to empty the buffer.  `[APM2 §15.25.15]` `[1]` `C:high` `V:durable`
- **Claim.** Because PML also tracks writes to guest page-table entries, a single guest write access may log several guest physical addresses.  `[APM2 §15.25.15]` `[1]` `C:high` `V:durable`

## 6.10 Shadow paging without nested paging

Nested paging is optional, and a minimal hypervisor or a guest running a paging mode the VMM wants to police still needs the shadow path. The architecture supports it explicitly rather than by omission.

- **Claim.** With shadow paging the VMM is responsible for building a shadow page table for each guest linear address space that maps it to system physical addresses; these replace the guest OS's tables as the active tables, and the VMM sets the CR3 field in the guest VMCB to the system physical address of the desired shadow table.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`
- **Claim.** The VMM is also responsible for updating the shadow table whenever the guest changes its page tables or paging control state, and for updating the Accessed and Dirty bits of the *guest's* page tables, which hardware no longer touches on its behalf.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN and `#VMEXIT` write CR0, CR3, CR4 and EFER but **do not flush the TLB**, so the VMM must explicitly invalidate any guest translations its own actions invalidated.  `[APM2 §15.16]` `[1]` `C:high` `V:durable`

The intercepts that make the shadow path work are the CR3 read and write intercepts in vector 0, the `#PF` exception intercept in vector 2, the CR0-write intercept that fires on changes to bits other than TS and MP, and the INVLPG and INVLPGA intercepts in vector 3. Their bit positions belong to `03-intercepts.md` and the byte offsets to `02-vmcb.md`.

- **Claim.** All of those controls exist in the VMCB intercept vectors — CR reads and writes in vector 0, exception vectors 0–31 in vector 2, and the INVLPG and INVLPGA intercepts among the miscellaneous instruction intercepts in vector 3 — and the enumeration is owned by `03-intercepts.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** Intercepting a flush-causing guest action is a trade: the exit occurs and the hardware flush does not, so a shadow-paging VMM that intercepts `MOV CR3` inherits the whole invalidation obligation.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`
- **Claim.** `INVLPGA` is the SVM-native tool for this path, because with shadow tables the guest virtual address it takes is exactly the tag the TLB entry carries.  `[APM2 §15.16.2]` `[1]` `C:high` `V:durable`
- **Claim.** When the guest is in PAE paging mode and nested paging is **not** enabled, VMRUN additionally reads the four PDPEs pointed to by the newly loaded CR3, and a reserved bit set in any of them causes a `#VMEXIT` — the eager behaviour that nested paging replaces with an on-demand fetch.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Paged real mode is the shadow-paging corner case: VMRUN may legally load a guest CR0 with PE = 0 and PG = 1, the intent being that the VMM runs the guest at CPL 0 with page faults intercepted and supplies a shadow table mapping guest physical memory; running a guest in paged real mode **without** intercepting page faults is undefined behaviour.  `[APM2 §15.19]` `[1]` `C:high` `V:durable`

## 6.11 Open items

- **No INVLPGA erratum number exists in the available primary sources.** "INVLPGA" has zero occurrences in either revision guide in this corpus — Genoa 57095 Rev 1.05 and Turin 58251 Rev 1.30 — so the Genoa/Turin INVLPGA issue is a KVM-side decision on the mailing list, not an AMD-published erratum. Only the adjacent INVLPGB item, `[RevGuide 57095 erratum 1455]`, is citable. AMD publishes revision guides for EPYC parts only and there is no public revision guide for client Ryzen at all, so this may never be resolvable from a first-party source. It is recorded here rather than given a fabricated number.
- **AMD's own naming of the nested CR3 is inconsistent.** §15.25.3 says "the VMCB contains the **hCR3** value for the page tables for the extra translation", while §15.25.4, Table B-1 and the rest of the chapter call the same thing `N_CR3` / nCR3. They are the same field at control-area offset 0B0h. This chapter uses nCR3 throughout; a reader hitting `hCR3` in §15.25.3 should not go looking for a second register.
- **The LA57 walk figures are derivations.** 35 for five levels in both dimensions and 29 for the mixed cases follow from `nm + n + m`, but no published source states either; `errata.md` `O6` keeps that open. Nothing here should be quoted as an AMD figure.
- **§15.25 has grown past the subsection list used to plan this chapter.** Rev 3.45 runs to 15.25.15, adding Legacy PAE Mode, A20 Masking, Detecting Nested Paging Support, the Guest Mode Execute Trap Extension, Supervisor Shadow Stacks and Page Modification Logging beyond the nine subsections earlier material assumed. Anything written against "15.25.1–15.25.9" is working from an older map.
- **Bit 37 of the nested-page-fault error code has two documented meanings** — a supervisor-shadow-stack page in the leaf nested entry (§15.25.14's feature) and the VMPL permission-mask SSS value when `VmplSSS` is enabled (§15.36.10). Whether these are the same condition expressed twice or two conditions sharing a bit is not stated; `05-exit-decoding.md` should present both readings.
- **The APM's own SEV example describes the nested walk in host-linear terms.** §15.34.6 illustrates the encryption bit with a sentence phrased as though a host virtual address were used for the nested translation. No host linear address exists in a nested walk — the nested tables translate guest physical to system physical directly — and this chapter deliberately does not reproduce that phrasing. Flagged so a future reader who finds it in the manual is not misled.
- **Page-walk-cache behaviour under nested paging is only partly specified.** §5.5.3 documents table-walk caching structures and their invalidation for ordinary paging; the manual does not say how those structures are tagged with respect to ASIDs, nor whether a `TLB_CONTROL` command of 3h is guaranteed to clear nested upper-level entries as well as final translations. Treat "flush the ASID" as the only safe assumption.
