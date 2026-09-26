# 06. VMX Support for Address Translation

> **中文速览**：本章覆盖 VMX 下的地址转换硬件——EPT 页表结构与 EPTP、EPT violation 与 EPT misconfiguration 的判定条件与区别、两维页表遍历的最坏访存代价、VPID 与三类转换缓存的标记规则、INVEPT/INVVPID 描述符格式、PML 脏页日志、SPP 子页写权限、HLAT 与 #VE。实现或调试 GPA→HPA 映射、内存自省 hook、脏页跟踪，或排查 exit reason 48/49/62/66 时，先读本章。指令语义在 `08-vmx-instructions.md`，exit qualification 的完整布局在 `05-vm-exit.md`，VMCS 字段编码表在 `02-vmcs.md`。相邻章节：`03-nonroot-operation.md`（non-root 下的访问行为）与 `07-apic-virtualization.md`（APIC-access page 与 EPT 的交互）。

**Maps to:** Intel SDM Vol.3C Ch.31 "VMX Support for Address Translation" (rev 092) [1]
**Owns:** EPT paging-structure formats · EPTP · EPT violation / EPT misconfiguration conditions · VPID and translation caching · INVEPT / INVVPID descriptor formats and types · PML · SPP · HLAT · the virtualization-exception information area
**See also:** `02-vmcs.md` (VMCS field encodings and control bits) · `05-vm-exit.md` (basic exit reasons and exit qualifications) · `08-vmx-instructions.md` (INVEPT / INVVPID instruction semantics) · `14-nested-virtualization.md` (nested EPT) · `18-comparison-amd-arm-riscv.md` (AMD NPT, ARM stage-2)

---

## 6.1 Why EPT exists

Memory virtualization needs two translations: guest-linear address → guest-physical address, owned by the guest's own paging structures, and guest-physical address → physical address, owned by the VMM. Without hardware support a VMM must collapse both into one set of *shadow* paging structures that it loads into CR3 itself, and then keep those structures coherent with the guest's.

Coherence is the whole cost. The VMM write-protects the guest's paging-structure pages, takes a VM exit on every guest write to them, decodes the faulting instruction, walks its own GPA→HPA map, patches the shadow entry, and resumes. Guest CR3 writes, INVLPG, and every shadow miss are VM exits too, and each guest process needs its own shadow hierarchy.

```
shadow paging, per guest write to a paging structure:
    write-protect fault -> VM exit
    VMM: decode the faulting instruction
    VMM: read the guest PTE that is being written
    VMM: translate the new GPA through its own GPA->HPA map
    VMM: write the corresponding shadow PTE
    VMM: unprotect, single-step or emulate, re-protect
    VM entry

EPT, per guest write to a paging structure:
    (nothing)
```

EPT removes the synchronization entirely: the guest owns CR3, page faults and INVLPG stay inside the guest, and the processor walks *two* hierarchies in hardware. The price is paid on TLB misses instead of on paging-structure writes — see §6.5.

- **Claim.** EPT is the VMX facility that translates guest-physical addresses to physical addresses in hardware; when it is enabled the guest's own paging structures translate guest-linear addresses to guest-physical addresses and guest page faults, CR3 writes, and INVLPG no longer require VMM intervention.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Shadow paging measured up to 29.2% slower than native on paging-update-intensive workloads (4-KByte pages, `connected` benchmark), with the excess attributed to the additional VM exits needed to keep shadow paging structures coherent. No Intel specification documents this: the string "shadow paging" does not occur anywhere in Vol.3C rev 092.  `[no-spec]` `[109]` `C:medium` `V:durable`
- **Claim.** On MMU-intensive benchmarks a 2009 vendor evaluation on Nehalem-generation Xeon measured EPT up to 48% faster than shadow paging, and up to 600% faster on MMU-intensive microbenchmarks; the same evaluation found SPECjbb2005 *slower* under EPT with small pages, which large guest pages reversed. A vendor measurement, not an architectural statement.  `[no-spec]` `[114]` `C:medium` `V:durable`

EPT is enabled by the "enable EPT" secondary processor-based VM-execution control; bit positions for that and every other control named in this chapter are owned by `02-vmcs.md`.

What EPT does *not* remove is just as important. It eliminates the memory-management VM exits — paging-structure writes, CR3 loads, INVLPG, guest page faults — but it leaves I/O, APIC and instruction-interception exits untouched, and it makes every remaining TLB miss more expensive. A VMM that turns EPT on and keeps write-protecting guest memory for introspection has traded one exit source for another.

- **Claim.** EPT does not by itself remove I/O, APIC or instruction-interception VM exits; it removes the exits caused by guest paging activity, which is why post-EPT exit profiles are dominated by interrupt and I/O sources (see `07-apic-virtualization.md`).  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** A VMM may deliberately reintroduce EPT-induced exits by clearing permission bits — demand paging, MMIO emulation, write tracking for live migration, and introspection hooks are all implemented as intentional EPT violations.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

---

## 6.2 The extended-page-table pointer (EPTP)

The EPTP names the root of the EPT hierarchy and carries the configuration of the whole walk in its low bits.

| Bits | Field |
|---|---|
| 2:0 | EPT paging-structure memory type |
| 5:3 | EPT page-walk length minus 1 |
| 6 | Enable accessed and dirty flags for EPT |
| 7 | Enable enforcement of access rights for supervisor shadow-stack pages |
| 11:8 | Reserved (must be 0) |
| 51:12 | Physical address of the 4-KByte aligned EPT PML4 table (EPT PML5 table with 5-level EPT) |

- **Claim.** The EPT pointer (EPTP) is a 64-bit VM-execution control field at VMCS field encoding 201AH; see `02-vmcs.md` for the full encoding table.  `[SDM 3C §27.6.11]` `[1]` `C:high` `V:durable`
- **Claim.** EPTP bits 2:0 specify the memory type used for accesses to the EPT paging structures themselves; the only values a processor may support are 0 (uncacheable) and 6 (write-back), and support is enumerated in IA32_VMX_EPT_VPID_CAP. This field is consulted only when CR0.CD = 0: if CR0.CD = 1 every EPT paging-structure access is uncacheable regardless of EPTP bits 2:0, and the MTRRs have no effect either way.  `[SDM 3C §27.6.11]` `[SDM 3C §31.3.7.1]` `[SDM 3D App.A]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** EPTP bits 5:3 hold the EPT page-walk length minus 1, so the value is 3 for a 4-level EPT hierarchy rooted at an EPT PML4 table and 4 for a 5-level hierarchy rooted at an EPT PML5 table.  `[SDM 3C §27.6.11]` `[1]` `[26]` `C:high` `V:durable`
- **Claim.** EPTP bit 6 enables accessed and dirty flags for EPT; when it is 0 the processor never sets bit 8 or bit 9 of an EPT paging-structure entry.  `[SDM 3C §27.6.11]` `[1]` `C:high` `V:durable`
- **Claim.** EPTP bit 7 enables enforcement of access rights for supervisor shadow-stack pages, which is what gives bit 60 of an EPT leaf entry its meaning.  `[SDM 3C §27.6.11]` `[1]` `C:medium` `V:durable`
- **Claim.** EPTP bits 51:12 hold the physical address of the root EPT paging structure; bits above the processor's physical-address width must be 0, and bits 11:8 are reserved and must be 0.  `[SDM 3C §27.6.11]` `[1]` `C:high` `V:durable`
- **Claim.** The EPTP holds a physical address, not a guest-physical address: the VMM writes it before VM entry and the processor never translates it.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

The address portion of the EPTP, bits 51:12, is called the **EPTRTA** and is the tag used for guest-physical and combined mappings — see §6.6.

### 6.2.1 Memory types under EPT

EPT participates in memory-type determination twice: once for the processor's own accesses to the EPT paging structures (EPTP bits 2:0), and once for the guest's accesses to the pages those structures map (bits 5:3 and bit 6 of the leaf entry).

- **Claim.** The memory type in EPTP bits 2:0 applies to the processor's accesses to the EPT paging structures themselves, not to guest data accesses; the memory type for a guest access comes from bits 5:3 of the EPT leaf entry.  `[SDM 3C §27.6.11]` `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** When CR0.CD = 0 and bit 6 (ignore PAT memory type) of the last EPT paging-structure entry is 1, the effective memory type for guest accesses to that page is the EPT memory type in bits 5:3 alone; when bit 6 is 0 the EPT memory type is combined with the type the guest's own PAT selects. If CR0.CD = 1 the effective memory type is UC whatever bits 6 and 5:3 say, and the MTRRs never affect an access using a guest-physical address.  `[SDM 3C §31.3.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** Setting EPT memory type to write-back (6) with ignore-PAT set is the usual configuration for ordinary guest RAM, and uncacheable (0) for pages backing emulated MMIO that the VMM has not otherwise trapped.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

---

## 6.3 EPT paging-structure entry formats

This is the part of the architecture most often paraphrased wrongly. An EPT hierarchy mirrors IA-32e paging in shape — PML5 → PML4 → page-directory-pointer table → page directory → page table — but every entry uses a different bit layout: there is no present bit, no user/supervisor bit, and no XD bit. Presence is encoded in the permission bits themselves.

Three differences from IA-32e paging are worth stating explicitly, because they are where hand-written EPT code goes wrong:

1. **No present bit.** An entry is present because it grants at least one access right (§6.3.3). Zeroing an entry is how you make it absent.
2. **No user/supervisor bit.** Privilege is not an EPT concept; the guest's own paging structures decide user versus supervisor, and EPT sees only the resulting access. Mode-based execute control is the single exception, and it distinguishes only *execute* permission.
3. **No execute-disable bit.** Execute permission is granted by bit 2 (and bit 10), not withheld by a disable bit, and an entry may legitimately grant execute without read if the processor supports execute-only translations.

### 6.3.1 Bits defined across the hierarchy

| Bit(s) | Name | Where it applies |
|---|---|---|
| 0 | Read access | every level |
| 1 | Write access | every level |
| 2 | Execute access (supervisor-mode execute when MBEC is enabled) | every level |
| 5:3 | EPT memory type | leaf entries only |
| 6 | Ignore PAT memory type | leaf entries only |
| 7 | Page size — 1 means the entry is a leaf | EPT PDPTE and EPT PDE |
| 8 | Accessed | every level, when EPTP bit 6 is 1 |
| 9 | Dirty | leaf entries only, when EPTP bit 6 is 1 |
| 10 | User-mode execute access | every level, when MBEC is enabled |
| 11 | Ignored (used by hypervisors as a software bit) | every level |
| 51:12 | Physical address (alignment varies by level) | every level |
| 57 | Verify guest paging | leaf entries |
| 58 | Paging-write access | leaf entries |
| 60 | Supervisor shadow stack | leaf entries, when EPTP bit 7 is 1 |
| 61 | Sub-page write permissions | leaf entry for a 4-KByte page |
| 63 | Suppress #VE | leaf entries, **and not-present entries at any level** (for a not-present entry the SDM ignores only bits 62:3) |

- **Claim.** In every EPT paging-structure entry, bit 0 is read access, bit 1 is write access and bit 2 is execute access; when "mode-based execute control for EPT" is enabled, bit 2 grants execute access only for supervisor-mode linear addresses.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 10 of an EPT paging-structure entry is execute access for user-mode linear addresses; it has meaning only when "mode-based execute control for EPT" is enabled and is ignored otherwise.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Mode-based execute control for EPT is enabled by a secondary processor-based VM-execution control (bit position owned by `02-vmcs.md`); the generation in which it first shipped is adjudicated in `errata.md` **E01** — **Kaby Lake**, not Skylake —.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

MBEC is the hardware mechanism Windows HVCI relies on to keep kernel code pages non-writable while executable; that use is covered in `15-security.md` §15.8 and cited to Microsoft there.
- **Claim.** With mode-based execute control enabled, a single EPT entry can grant execute permission to supervisor-mode linear addresses (bit 2) while denying it to user-mode linear addresses (bit 10) or the reverse, which is what lets a VMM enforce W^X across the guest's own privilege boundary.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 5:3 of an EPT leaf entry are the EPT memory type and bit 6 is "ignore PAT memory type"; both are defined only in entries that map a page, and in non-leaf entries bits 7:3 are reserved and must be 0.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 7 of an EPT PDPTE or an EPT PDE selects a leaf mapping: 1 in an EPT PDPTE maps a 1-GByte page and 1 in an EPT PDE maps a 2-MByte page; bit 7 is reserved and must be 0 in an EPT PML4E and is ignored in an EPT PTE.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 8 of an EPT paging-structure entry is the accessed flag and bit 9 of an EPT leaf entry is the dirty flag; both are set by the processor only when EPTP bit 6 is 1, and bit 9 is ignored in entries that reference another EPT paging structure.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Bit 11 of an EPT paging-structure entry is ignored by the processor, which is why hypervisors use it to carry software state next to the hardware entry.  `[SDM 3C Ch.31]` `[1]` `[115]` `C:medium` `V:durable`
- **Claim.** Bit 63 is suppress-#VE: when it is 1, an EPT violation taken through that entry is never converted into a virtualization exception. It carries this meaning in an entry that maps a page **and** in an entry that is not present at any level of the hierarchy; the processor ignores it only in a *present* entry that references another EPT paging structure. For any one EPT violation, exactly one entry's bit 63 decides convertibility — the not-present entry if the walk stopped there, otherwise the entry that maps the page.  `[SDM 3C §28.5.8.1]` `[SDM 3C §31.3.2]` `[1]` `C:high` `V:durable`

### 6.3.2 Address fields and level-specific reserved bits

| Entry | Maps / references | Address bits | Additional reserved bits |
|---|---|---|---|
| EPT PML5E | EPT PML4 table | 51:12 | 7:3 must be 0 |
| EPT PML4E | EPT page-directory-pointer table | 51:12 | 7:3 must be 0 |
| EPT PDPTE (bit 7 = 0) | EPT page directory | 51:12 | 7:3 must be 0 |
| EPT PDPTE (bit 7 = 1) | 1-GByte page | 51:30 | 29:12 must be 0 |
| EPT PDE (bit 7 = 0) | EPT page table | 51:12 | 7:3 must be 0 |
| EPT PDE (bit 7 = 1) | 2-MByte page | 51:21 | 20:12 must be 0 |
| EPT PTE | 4-KByte page | 51:12 | — |

- **Claim.** An EPT PDPTE that maps a 1-GByte page holds the page frame in bits 51:30 and must have bits 29:12 clear; an EPT PDE that maps a 2-MByte page holds it in bits 51:21 and must have bits 20:12 clear; an EPT PTE holds a 4-KByte frame in bits 51:12.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Support for 2-MByte and 1-GByte EPT pages and for execute-only EPT translations is not architecturally guaranteed; each is enumerated separately in IA32_VMX_EPT_VPID_CAP, which also reports EPT A/D-flag support and INVEPT/INVVPID type support.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

### 6.3.3 Worked entry values

| Intent | EPT PTE contents |
|---|---|
| Ordinary guest RAM, write-back | bits 2:0 = 111b, bits 5:3 = 6, bit 6 = 1, address in 51:12 |
| Read-only page (write tracking) | bits 2:0 = 101b — every guest write becomes an EPT violation |
| Execute-only page (code hook) | bits 2:0 = 100b — requires execute-only support; reads and writes exit |
| Not present (demand paging) | all of bits 2:0 = 0 — any access becomes an EPT violation |
| Illegal, causes exit 49 | bits 2:0 = 110b — write and execute without read |

- **Claim.** Setting bits 2:0 to 101b (read and execute, no write) is the canonical write-tracking configuration and produces an EPT violation on each guest write, whereas 100b (execute-only) hides the page's contents from guest reads and is the basis of execute-only code hooks.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

### 6.3.4 Presence

- **Claim.** An EPT paging-structure entry is present if any of bits 2:0 is 1; when "mode-based execute control for EPT" is enabled, bit 10 also makes an entry present. An access through a not-present entry causes an EPT violation, and the processor ignores **bits 62:3** of that entry rather than checking them for misconfiguration — bit 63 is *not* among the ignored bits while the “EPT-violation #VE” VM-execution control is 1, because it still decides whether the resulting EPT violation is convertible to a #VE (with that control 0, bit 63 is ignored too).  `[SDM 3C §31.3.2]` `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`

---

## 6.4 EPT violations and EPT misconfigurations

Both events are VM exits produced while translating a guest-physical address, and they mean completely different things: a violation is a *policy* decision the VMM programmed on purpose, a misconfiguration is a *bug* in the table the VMM built.

> **Excerpt** (SDM, EPT-induced VM exits):
> "An EPT misconfiguration occurs when, in the course of translating a guest-physical address, the logical processor encounters an EPT paging-structure entry that contains an unsupported value. An EPT violation occurs when there is no EPT misconfiguration but the EPT paging-structure entries disallow an access using the guest-physical address."

### 6.4.1 Conditions that cause an EPT misconfiguration

- **Claim.** An EPT misconfiguration occurs if bits 2:0 of an EPT paging-structure entry used in a translation are 010b (write, no read) or 110b (write and execute, no read): the architecture never permits write access without read access.  `[SDM 3C §31.3.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT misconfiguration occurs if bit 0 is clear, the processor does not support execute-only EPT translations (as reported by IA32_VMX_EPT_VPID_CAP), and either bit 2 is set — the 100b execute-only case — or "mode-based execute control for EPT" is 1 and bit 10 is set. The user-mode-execute bit is subject to the same read-access requirement as bit 2.  `[SDM 3C §31.3.3.1]` `[SDM 3D App.A]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** An EPT misconfiguration occurs if bit 0 is clear while "EPT paging-write control" is 1, the entry maps a page, and bit 58 (paging-write access) is set: paging writes may not be permitted to a page the guest may not even read.  `[SDM 3C §31.3.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT misconfiguration occurs if a present entry sets any reserved bit: bits 7:3 in an entry that references another EPT paging structure (bits 6:3 plus a bit 7 that must be 0 in an EPT PDE that references a page table), the page-frame alignment bits (29:12 for a 1-GByte page, 20:12 for a 2-MByte page), any address bit in the range 51:12 at or above the processor's physical-address width, or bit 7 in an entry at a level where the corresponding page size is unsupported.  `[SDM 3C §31.3.3.1]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT misconfiguration occurs if a present leaf entry specifies EPT memory type 2, 3 or 7 in bits 5:3; the defined values are 0 (UC), 1 (WC), 4 (WT), 5 (WP) and 6 (WB).  `[SDM 3C §31.3.3.1]` `[SDM 3C §31.3.7.2]` `[1]` `C:high` `V:durable`
- **Claim.** The reserved-bit and memory-type misconfiguration checks apply only to entries actually used in a translation and only to *present* entries, so a hypervisor may leave arbitrary values in bits 62:11 and 9:3 of a zeroed (not-present) entry — but not in bits 2:0, whose settings make the entry present in the first place; not in **bit 10**, which under "mode-based execute control for EPT" also makes an entry present, so a recycled entry that still has bit 10 set is walked normally rather than faulting; and not in bit 63, which while the "EPT-violation #VE" control is 1 still selects #VE convertibility.  `[SDM 3C §31.3.3.1]` `[SDM 3C §31.3.2]` `[1]` `C:high` `V:durable`

Those six claims are the complete enumeration of §31.3.3.1: three conjuncts under "bit 0 is clear" (bit 1 set; no execute-only support with bit 2 or the MBEC bit 10 set; paging-write control with bit 58 set on an entry that maps a page) and two under "the entry is present" (a reserved bit is set; the last entry used in the translation carries EPT memory type 2, 3 or 7). Intel warns that values reserved today may be defined later, so an entry that misconfigures on one processor may not on the next.

### 6.4.2 How the two exits differ

| | EPT violation | EPT misconfiguration |
|---|---|---|
| Basic exit reason | 48 | 49 |
| Cause | entries are well formed but deny the access, or an entry is not present | an entry contains an unsupported value |
| Typical origin | demand paging, MMIO emulation, introspection hooks, write tracking | hypervisor bug or torn update of a live EPT entry |
| Guest-physical address field | set | set |
| Exit qualification | defined, and reports the access type and the effective permissions | not defined for this exit |
| Convertible to #VE | yes, subject to §6.11 | no |

- **Claim.** EPT violations exit with basic exit reason 48 and EPT misconfigurations with basic exit reason 49; both record the offending address in the guest-physical address VM-exit information field (see `05-vm-exit.md` for the information-field inventory).  `[SDM 3C §30.2.1]` `[SDM 3D App.C]` `[1]` `[2]` `C:high` `V:durable`
- **Claim.** An exit qualification is defined for EPT violations but not for EPT misconfigurations, which is why a misconfiguration gives the VMM no architectural hint beyond the guest-physical address (see `05-vm-exit.md`).  `[SDM 3C §30.2.1]` `[1]` `C:medium` `V:durable`
- **Claim.** A guest page fault caused by the guest's own paging structures is delivered to the guest as #PF (vector 14) and causes no VM exit unless the exception bitmap intercepts it; only the second-level translation produces EPT violations, so the guest cannot observe them.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** An EPT violation can occur while the processor is reading a *guest* paging-structure entry, not only while accessing the final data page, because the guest-physical address of every guest paging structure is itself translated through EPT.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** EPT violations and EPT misconfigurations are unconditional: unlike most VM exits they have no enabling control beyond "enable EPT" itself and cannot be masked, which is why every EPT-using VMM must implement both handlers.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

### 6.4.3 Two corrections to the EPT-violation exit qualification

`05-vm-exit.md` owns the complete layout. Two fields are so widely mis-stated that they are recorded here as corrections, and `errata.md` carries the matching entries.

- **Claim.** In the exit qualification for an EPT violation, bit 7 reports that the guest-linear-address VM-exit information field is valid; it says nothing about the guest-physical-address field, which is always filled in on an EPT violation (full layout: see `05-vm-exit.md`).  `[SDM 3C §30.2.1]` `[1]` `C:high` `V:durable`
- **Claim.** In the exit qualification for an EPT violation, bit 6 is the logical-AND of the user-mode execute permission (bit 10) across the EPT paging-structure entries used to translate the guest-physical address, and it is meaningful only when "mode-based execute control for EPT" is enabled; it is not derived from the guest paging structures' execute-disable bit (see `05-vm-exit.md`).  `[SDM 3C §30.2.1]` `[1]` `C:high` `V:durable`

### 6.4.4 Triaging the two exits in practice

Two handler rules decide whether your exit-48 path is correct at all. Both are properties of the
exit, so `05-vm-exit.md` owns their full statement — but a reader who arrives here for EPT and
stops, as the skill's own stop rule tells them to, needs them now:

- **Never advance RIP on an EPT violation.** It is fault-like: the faulting instruction must be
  restarted after the mapping is fixed, not skipped. Advancing RIP silently corrupts the guest.
  Full exit semantics in `05-vm-exit.md` §5.3.1.
- **Qualification bits 3, 4 and 5 tell you whether the guest-physical address was mapped at all**
  (they report the EPT permissions present for the access), which is what separates a demand-paging
  miss from a permission denial. The complete qualification layout, including the corrected bits 6
  and 7, is in `05-vm-exit.md` §5.4 — see §6.4.3 for the two corrections.

A VMM handling exit 48 reads the guest-physical address field, finds the memory region it belongs to, and does one of three things: install a mapping (demand paging), emulate an access (MMIO), or run a policy hook (introspection, write tracking) and then resume. A VMM that takes exit 49 has no useful recovery path — the table it built is invalid — so the correct response is to dump the offending entry and treat it as a hypervisor bug rather than to retry.

- **Claim.** Because EPT misconfiguration indicates an unsupported entry value rather than a denied access, resuming the guest without changing the entry re-raises the same exit; the only correct handling is to correct or tear down the mapping.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** The most common real cause of an unexpected EPT misconfiguration is a non-atomic update to a live EPT entry that momentarily leaves an illegal permission combination, such as clearing read while write is still set.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

---

## 6.5 The cost of a two-dimensional page walk

With EPT enabled, every guest-physical address produced during the guest's own page walk must itself be translated through EPT — including the guest's CR3 value and each guest paging-structure entry's frame address.

```
walk(GVA) with 4-level guest paging and 4-level EPT:
  translate guest CR3 (a GPA) through EPT ................. 4 accesses
  for each guest level L4, L3, L2, L1:
      translate the entry's GPA through EPT ............... 4 accesses
      read the guest paging-structure entry ............... 1 access
                                                           ---------
  total                                    4 + 4 x (4 + 1) = 24 accesses
```

- **Claim.** With 4-level guest paging and 4-level EPT, a TLB miss costs up to 24 memory accesses: 4 to translate the guest CR3 value through EPT, plus 5 for each of the 4 guest paging-structure levels (4 EPT accesses plus 1 read of the guest entry). A native 4-level walk costs at most 4. The SDM states the walk structure, not the total; the figure is the arithmetic that follows from it.  `[SDM 3C §31.3.2]` `[107]` `[108]` `C:high` `V:durable`
- **Claim.** The commonly repeated figure of 20 memory accesses counts only the EPT paging-structure reads (5 EPT walks of 4 levels each) and omits the 4 reads of the guest paging-structure entries themselves; the complete worst case is 24.  `[SDM 3C §31.3.2]` `[107]` `C:high` `V:durable`
- **Claim.** The same arithmetic gives 35 worst-case accesses when both the guest hierarchy and the EPT hierarchy use 5 levels (5 + 5 x 6); 5-level EPT is configured by an EPTP page-walk-length field of 4 and uses guest-physical address bits 56:0.  `[SDM 3C §31.3.2]` `[26]` `C:medium` `V:durable`

This is why large pages matter more under EPT than natively: a 2-MByte or 1-GByte mapping removes a level from *both* dimensions and raises TLB reach, and it is why the performance bottleneck of memory virtualization moved from exit frequency to TLB coverage.

- **Claim.** A 2-MByte EPT leaf entry removes one level from the EPT dimension of every walk that passes through it, and a 2-MByte *guest* page removes one level from the guest dimension; the two are independent, so the best case requires large pages on both sides.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Because the worst case scales multiplicatively rather than additively, no single answer to "is EPT faster than shadow paging" holds across workloads: EPT wins where paging-structure updates dominate and loses where TLB misses dominate, and measured gaps in both directions of up to 34% have been reported for individual benchmarks. The two-dimensional walk is architectural (§31.3.2), but no Intel specification states a workload comparison.  `[no-spec]` `[108]` `[114]` `C:medium` `V:durable`
- **Claim.** Paging-structure caches mitigate the two-dimensional walk by caching upper levels of both hierarchies, so the 24-access figure is a worst case for a cold walk rather than the expected cost of a TLB miss.  `[SDM 3C §31.4.1]` `[1]` `[107]` `C:medium` `V:durable`

---

## 6.6 VPID and the caching of translation information

- **Claim.** VPID is a 16-bit VM-execution control field; when "enable VPID" is 1 the processor tags cached translations with the current VPID so that VMX transitions no longer have to invalidate them (see `02-vmcs.md` for the encoding).  `[SDM 3C §27.6.12]` `[SDM 3C §31.1]` `[1]` `C:high` `V:durable`
- **Claim.** VPID 0000H is reserved for VMX root operation: the current VPID is 0000H whenever the processor is in VMX root operation or whenever "enable VPID" is 0, and VM entry fails if "enable VPID" is 1 while the VPID field is 0000H (entry checks: see `04-vm-entry.md`). The current VPID is also 0000H outside VMX operation entirely; a processor supporting SEAM implicitly widens the tag to 17 bits and uses 10000H–1FFFFH inside SEAM, while the VMCS field stays 16 bits.  `[SDM 3C §31.1]` `[1]` `C:high` `V:durable`

The processor caches three kinds of translation, and the tagging rules differ:

| Mapping | Translates | Tagged with |
|---|---|---|
| Linear mappings | guest-linear → physical | current VPID and current PCID |
| Guest-physical mappings | guest-physical → physical | current EPTRTA |
| Combined mappings | guest-linear → physical, through both hierarchies | current VPID, current PCID and current EPTRTA |

- **Claim.** VMX distinguishes linear mappings, guest-physical mappings and combined mappings; linear mappings are associated with the current VPID and PCID, guest-physical mappings with the current EPTRTA, and combined mappings with all three.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** When EPT is in use the processor creates guest-physical and combined mappings rather than linear mappings, so a combined mapping created under one EPTP value cannot be used after the EPTRTA changes.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** Because combined mappings are tagged with VPID, PCID and EPTRTA simultaneously, switching EPTP with VMFUNC while VPID is enabled does not require a TLB flush; without VPID the switch invalidates combined mappings associated with VPID 0000H.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** Intel provides two independent address-space identifiers: PCID tags translations per process inside one linear-address space, and VPID tags them per virtual processor; the assertion that Intel has no ASID-style mechanism is false.  `[SDM 3A Ch.5]` `[SDM 3C §27.6.12]` `[1]` `[3]` `C:high` `V:durable`
- **Claim.** Intel measured a 25% vConsolidate improvement on Nehalem from enabling EPT and VPID together, relative to the same platform without them. A vendor benchmark result, published outside the SDM.  `[no-spec]` `[124]` `C:medium` `V:durable`

A VMM must give each vCPU a distinct non-zero VPID, and must invalidate by VPID when a vCPU migrates to another logical processor or when it reuses a VPID for a different address space. The rule of thumb is that the hardware will never invalidate on your behalf once tagging is on — the whole point of VPID is that VMX transitions stop flushing — so every place the VMM used to rely on an implicit flush becomes an explicit invalidation site:

| Situation | Required invalidation |
|---|---|
| EPT paging structures modified to be more restrictive | INVEPT for the affected EPTRTA on every logical processor that may have cached it |
| vCPU migrated to a different logical processor | INVVPID single-context for that VPID |
| VPID recycled for a different vCPU or address space | INVVPID single-context before first use |
| Guest executed INVLPG and the VMM is emulating it | INVVPID individual-address |
| Guest reloaded CR3 and the VMM is emulating it | INVVPID single-context-retaining-globals |

- **Claim.** With "enable VPID" set, VM entry and VM exit do not invalidate cached linear or combined mappings, so host and guest translations coexist in the TLB and the VMM becomes responsible for every invalidation that correctness requires; with "enable VPID" clear, VM entries and VM exits invalidate the linear and combined mappings associated with VPID 0000H for all PCIDs and all EPTRTAs.  `[SDM 3C §31.4.3.1]` `[SDM 3C §31.4.3.2]` `[1]` `C:high` `V:durable`
- **Claim.** Making an EPT entry *more* permissive does not require invalidation — software *may* execute INVEPT after changing a privilege bit from 0 to 1, but the only consequence of not doing so is one spurious EPT violation, which itself invalidates the stale mapping so the access succeeds on retry. INVEPT *should* be used after changing a privilege bit 2:0 from 1 to 0 (and, under "mode-based execute control for EPT", after changing privilege bit 10 from 1 to 0), changing the address in bits 51:12, changing bit 7 of an EPT PDPTE or EPT PDE, changing **bits 5:3 or bit 6 of the last entry used in a translation** — the memory-type bits, so a WB→UC retype needs it — or clearing bit 8 or bit 9 with EPT A/D flags enabled. Nothing derived from a not-present or misconfigured entry is ever cached, so those need no invalidation either.  `[SDM 3C §31.4.3.4]` `[1]` `C:high` `V:durable`

Two consequences are worth separating out, because they are the places where VPID and EPT interact rather than compose. First, guest-physical mappings are tagged by EPTRTA only, so INVVPID can never remove them no matter which type is used — a VMM that changes EPT and invalidates only by VPID has a stale-translation bug. Second, combined mappings carry all three tags at once, so changing *either* the VPID or the EPTP is enough to stop the processor using an existing combined mapping, which is what makes multi-view EPT designs cheap.

- **Claim.** Guest-physical mappings carry no VPID tag, so no INVVPID type can invalidate them; conversely INVEPT does invalidate combined mappings, because those are tagged with an EPTRTA as well.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** Nested virtualization multiplies these hierarchies rather than adding to them, and the shadowing of an L1 EPT hierarchy into an L0-maintained one is owned by `14-nested-virtualization.md`.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

---

## 6.7 INVEPT and INVVPID descriptors

`08-vmx-instructions.md` owns the instruction semantics, the operand encodings and the VM-instruction error codes. This section owns the descriptor layouts and the type values, because they are part of the address-translation architecture rather than of the instruction set proper.

**INVEPT descriptor — 128 bits**

| Bits | Field |
|---|---|
| 63:0 | EPT pointer (EPTP) |
| 127:64 | Reserved (must be 0) |

**INVVPID descriptor — 128 bits**

| Bits | Field |
|---|---|
| 15:0 | VPID |
| 63:16 | Reserved (must be 0) |
| 127:64 | Linear address |

- **Claim.** The INVEPT descriptor is 128 bits: bits 63:0 hold an EPT pointer and bits 127:64 are reserved and must be 0.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** The INVVPID descriptor is 128 bits: bits 15:0 hold a VPID, bits 63:16 are reserved and must be 0, and bits 127:64 hold a linear address.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT defines type 1, single-context invalidation (invalidate guest-physical and combined mappings associated with the EPTRTA in the descriptor), and type 2, all-context invalidation (invalidate them for all EPTRTA values); see `08-vmx-instructions.md`.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID defines type 0 individual-address, type 1 single-context, type 2 all-contexts, and type 3 single-context-retaining-globals; see `08-vmx-instructions.md`.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID invalidates linear mappings and combined mappings tagged with the given VPID but never guest-physical mappings; removing a guest-physical mapping requires INVEPT.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVVPID type 2 invalidates mappings for all VPID values except 0000H, which is why it cannot be used to flush VMX root operation's own translations.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** Which INVEPT and INVVPID types a processor supports is enumerated in IA32_VMX_EPT_VPID_CAP, so a VMM must read that MSR rather than assume all four INVVPID types exist.  `[SDM 3D App.A]` `[2]` `C:high` `V:durable`

Invalidation is per logical processor: after modifying EPT paging structures that other logical processors may be caching, the VMM must execute INVEPT on each of them.

- **Claim.** Both instructions are valid only in VMX root operation, so a guest that needs an invalidation performed against its own EPT hierarchy must be served by the VMM; nested emulation of INVEPT and INVVPID is owned by `14-nested-virtualization.md`.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`
- **Claim.** INVEPT type 2 (all-context) invalidates guest-physical and combined mappings for every EPTRTA and is the conservative choice when a VMM cannot enumerate which EPTP values are affected.  `[SDM 3C Ch.31]` `[1]` `C:high` `V:durable`

---

## 6.8 Page-modification logging (PML)

PML replaces write-protection-based dirty tracking with a hardware log. Instead of taking an EPT violation on the first write to each page, the processor records the guest-physical address when it sets a dirty flag.

```
on setting bit 9 (dirty) of an EPT leaf entry from 0 to 1:
    if PML index is not in 0..511:
        page-modification log-full VM exit (basic exit reason 62)
    PML_buffer[PML index] <- GPA of the access, bits 11:0 cleared
    PML index <- PML index - 1
```

- **Claim.** PML uses a 4-KByte page-modification log whose physical address is a 64-bit VM-execution control field at VMCS field encoding 200EH; see `02-vmcs.md`.  `[SDM 3C §27.6.18]` `[1]` `C:high` `V:durable`
- **Claim.** The page-modification log holds 512 entries of 64 bits each, filling the 4-KByte page.  `[SDM 3C §27.6.18]` `[1]` `[110]` `C:high` `V:durable`
- **Claim.** The PML index is a 16-bit guest-state field at VMCS field encoding 0812H (see `02-vmcs.md`); software normally initializes it to 511 and the processor decrements it after each logged entry, so the log fills downwards.  `[SDM 3C §27.4.2]` `[1]` `[110]` `C:high` `V:durable`
- **Claim.** The processor logs an entry when it sets the dirty flag of an EPT leaf entry, writing the guest-physical address of the access with bits 11:0 cleared; PML therefore requires EPT A/D flags (EPTP bit 6) to be enabled.  `[SDM 3C §27.6.18]` `[1]` `C:high` `V:durable`
- **Claim.** When the PML index is out of the range 0 to 511 a page-modification log-full VM exit occurs, with basic exit reason 62 (see `05-vm-exit.md`); the VMM drains the buffer and resets the index.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`
- **Claim.** PML is per-VMCS and therefore per-vCPU: each vCPU needs its own log page, and KVM allocates one when the "enable PML" secondary control is set (`02-vmcs.md` owns the control bit).  `[SDM 3C §27.6.18]` `[1]` `[115]` `C:medium` `V:durable`
- **Claim.** The PML facility is specified in SDM Vol.3C; its first silicon was the Broadwell generation of Intel Xeon processors in 2015, and attributions to a later microarchitecture are incorrect.  `[SDM 3C §27.6.18]` `[1]` `[110]` `C:high` `V:durable`
- **Claim.** A measurement study on Xen 4.7 reported PML shortening VM live-migration and checkpointing time by up to 10.18% and reducing migration's impact on application performance by up to 0.95%, with no additional power cost; PML logs only write accesses, so it cannot by itself estimate a working-set size. The second clause is §31.3.6 (entries are added only when a dirty flag goes 0→1); the migration figures rest on [110] alone.  `[SDM 3C §31.3.6]` `[110]` `C:medium` `V:durable`

The VMM side of the protocol is short but has two traps in it. First, an entry is logged only on the 0→1 *transition* of the dirty flag, so a page whose dirty flag is already set is silently invisible to the log; software that wants a page tracked must clear the dirty flag first, and software that wants a page *not* tracked can pre-set it. Second, the log is written in descending index order, so entries appear in the buffer from high index to low and a consumer that walks the buffer forwards reads them in reverse chronological order.

- **Claim.** Because logging is triggered by the 0→1 transition of an EPT dirty flag, a page whose dirty flag is already 1 generates no further log entries until the VMM clears it; correspondingly a VMM can pre-set dirty flags on pages it does not wish to track.  `[SDM 3C §27.6.18]` `[1]` `[115]` `C:medium` `V:durable`
- **Claim.** Entries are written at the position given by the PML index and the index is then decremented, so the buffer fills from index 511 downwards and the most recently logged entry sits at the lowest written index.  `[SDM 3C §27.6.18]` `[1]` `[110]` `C:high` `V:durable`
- **Claim.** PML replaces, rather than supplements, the write-protection approach to dirty tracking: with PML the VMM no longer needs to clear EPT write permission on every page it is tracking, which removes one EPT violation per page per tracking round.  `[SDM 3C §27.6.18]` `[1]` `C:high` `V:durable`

---

## 6.9 Sub-page write permissions (SPP)

SPP refines write permission below page granularity, so a VMM can write-protect a 128-byte structure without write-protecting the whole 4-KByte page around it.

- **Claim.** SPP is controlled by the "sub-page write permission for EPT" secondary processor-based VM-execution control and is rooted at the sub-page-permission table pointer (SPPTP), a 64-bit VM-execution control field at VMCS field encoding 2030H; see `02-vmcs.md`.  `[SDM 3C §27.6.21]` `[1]` `[111]` `C:high` `V:durable`
- **Claim.** Bit 61 is the sub-page-permission bit and is defined **only in an EPT PTE that maps a 4-KByte page** — in a 1-GByte or 2-MByte leaf, bits 62:61 are ignored. The VMM clears write access (bit 1) in one of the entries used to translate the address and sets bit 61 in the EPT PTE, and the processor then consults the SPP table on a write to that page.  `[SDM 3C §31.3.4.1]` `[1]` `[111]` `C:high` `V:durable`
- **Claim.** The SPP table is a 4-level structure walked with the guest-physical address, exactly like EPT; its non-leaf entries hold the 4-KByte-aligned physical address of the next-level SPP table.  `[SDM 3C Ch.31]` `[1]` `[111]` `C:medium` `V:durable`
- **Claim.** An SPP leaf entry is 64 bits covering one 4-KByte page as 32 sub-pages of 128 bytes; bit 2i grants write permission to sub-page i and bit 2i+1 is reserved.  `[SDM 3C Ch.31]` `[1]` `[111]` `C:high` `V:durable`
- **Claim.** If the sub-page's write-permission bit is set the write proceeds; otherwise the write is disallowed and reported as an EPT violation.  `[SDM 3C Ch.31]` `[1]` `[111]` `C:medium` `V:durable`
- **Claim.** An SPP miss occurs when bit 0 (the valid bit) of an SPPL4E, SPPL3E or SPPL2E reached by the walk is 0; an SPP misconfiguration occurs when such an entry has its valid bit set but sets a reserved bit (bits 11:1, or any bit at or above MAXPHYADDR), or when an odd-position bit is set in the final SPP vector. Both are SPP-related events with basic exit reason 66, and bit 11 of the exit qualification distinguishes them: 0 indicates a misconfiguration, 1 a miss (see `05-vm-exit.md`).  `[SDM 3C §31.3.4.2]` `[SDM 3C §30.2.1]` `[SDM 3D App.C]` `[1]` `[2]` `[111]` `C:high` `V:durable`
- **Claim.** SPP applies only to write accesses and only to 4-KByte pages; it does not refine read or execute permission and does not apply to 2-MByte or 1-GByte EPT leaf entries.  `[SDM 3C Ch.31]` `[1]` `[111]` `C:medium` `V:durable`

```
write to GPA, EPT leaf entry E for the 4-KByte page containing GPA:
  if E.write (bit 1) = 1:
      allow                                   # SPP never consulted
  else if "sub-page write permission for EPT" = 0 or E.SPP (bit 61) = 0:
      EPT violation (exit reason 48)
  else:
      walk the SPP table from SPPTP using GPA
      on miss or malformed entry: SPP-related event (exit reason 66)
      i <- (GPA >> 7) & 31                    # which 128-byte sub-page
      if SPP_leaf[2*i] = 1: allow
      else:                 EPT violation (exit reason 48)
```

- **Claim.** A 4-KByte page contains 32 sub-pages of 128 bytes, so the sub-page index is derived from bits 11:7 of the guest-physical address and selects one bit pair in the 64-bit SPP leaf entry.  `[SDM 3C Ch.31]` `[1]` `[111]` `C:medium` `V:durable`
- **Claim.** SPP is consulted only for a write that would otherwise be disallowed because bit 1 is clear in **any** of the EPT paging-structure entries used to translate the guest-physical address — not only in the leaf — so enabling SPP costs nothing on pages that remain writable and the SPP walk happens only on the writes the VMM already wanted to see. A write disallowed for any other reason, such as a not-present entry, is never eligible.  `[SDM 3C §31.3.4.1]` `[1]` `[111]` `C:high` `V:durable`

The intended users are guest-kernel integrity monitors that need to protect individual structures — an IDT entry, a function pointer table, a page-table entry — without paying a full-page write trap for every unrelated neighbour in the same 4-KByte page.

---

## 6.10 Hypervisor-managed linear-address translation (HLAT)

HLAT lets the VMM, rather than the guest kernel, decide how a chosen range of guest-linear addresses is translated — closing the "paging remap" attack in which malicious guest-kernel code repoints a linear address at different physical memory while leaving the EPT permissions alone.

The attack HLAT answers is specific. EPT protects *guest-physical* pages, but the guest kernel still owns the guest-linear → guest-physical map. An attacker with guest-kernel write primitives does not need to defeat EPT: it edits the guest's own paging structures so that a linear address the hypervisor believes is code now resolves to a guest-physical page the hypervisor believes is data. The three VT-rp mechanisms close the three ways of doing this — HLAT removes the guest's authority over the chosen linear range, paging-write access restricts which pages may act as paging structures at all, and guest-paging verification makes the processor check that a translation only went through such pages.

- **Claim.** There is no standalone Intel VT-rp specification; HLAT's normative definition lives in the SDM only, principally in Vol.3A §5.5.1, §5.5.3 and §5.5.5, in the VMCS field descriptions of Vol.3C §27.6.22, and in Vol.3C §31.2. Citations to a separate "VT-rp specification" are citations to a document that does not exist.  `[SDM 3A §5.5.1]` `[SDM 3C §31.2]` `[3]` `[1]` `C:high` `V:durable`
- **Claim.** HLAT is enabled by an "enable HLAT" VM-execution control and roots its paging hierarchy at the HLAT pointer (HLATP), a VM-execution control field holding a guest-physical address; a companion HLAT prefix size field selects which linear addresses are translated through HLATP instead of CR3 (see `02-vmcs.md` for encodings).  `[SDM 3C §27.6.22]` `[SDM 3C §31.2]` `[1]` `C:high` `V:durable`
- **Claim.** HLAT paging structures have the same format as ordinary paging structures except for bit 11, the restart bit: when the processor encounters a set restart bit at any level during an HLAT walk it abandons HLAT and restarts the translation of the entire linear address using ordinary CR3-rooted paging, with the restarted walk also capping the page size at which the result may be cached.  `[SDM 3A §5.5.4]` `[SDM 3A §5.5.5]` `[3]` `[112]` `[113]` `C:medium` `V:durable`
- **Claim.** Bit 58 of an EPT entry that maps a page is paging-write access: with "EPT paging-write control" set, clearing the write-access bit in that entry no longer prevents a *paging write* — a processor write to a guest paging-structure entry to update an accessed or dirty flag — if bit 58 is 1. Entries that reference another EPT paging structure do not use bit 58 and must still grant write access for paging writes.  `[SDM 3C §31.3.3.2]` `[1]` `[112]` `C:medium` `V:durable`
- **Claim.** Bit 57 of an EPT leaf entry is verify guest paging: when **both** the "guest-paging verification" and "EPT paging-write control" VM-execution controls are enabled and this bit is set in the EPT leaf entry for the **guest paging-structure page** (not the data page), the processor checks that every guest paging-structure entry used to reach that page lies in a page whose EPT leaf entry has the paging-write access bit set, and reports a failure as an EPT violation — flagged by bit 15 of the EPT-violation exit qualification.  `[SDM 3C §31.3.3.2]` `[1]` `[112]` `C:medium` `V:durable`
- **Claim.** Together, HLAT plus paging-write access plus guest-paging verification are the hardware under Microsoft's Hypervisor-enforced Paging Translation (HVPT); the vendor describes the HLAT prefix size check as the first step that decides whether an address is translated through the hypervisor-owned or the guest-owned hierarchy. The SDM anchors cover the three hardware mechanisms only; the HVPT name and its design are Microsoft's, from [113].  `[SDM 3C §31.2]` `[SDM 3C §31.3.3.2]` `[1]` `[113]` `C:medium` `V:durable`

| Mechanism | Enabled by | State it adds | What it prevents |
|---|---|---|---|
| HLAT | "enable HLAT" VM-execution control | HLATP, HLAT prefix size | the guest changing the translation of a protected linear range |
| Paging-write access | "EPT paging-write control" | EPT leaf bit 58 | arbitrary guest-physical pages acting as paging structures |
| Guest-paging verification | "guest-paging verification" | EPT leaf bit 57 | a translation reaching a protected page through unapproved paging structures |

- **Claim.** The three VT-rp mechanisms have three separate tertiary VM-execution control bits and neither paging-write access nor guest-paging verification requires HLAT to be in use — both constrain ordinary CR3-rooted translation. They are not fully independent of each other, however: guest-paging verification is performed only when "guest-paging verification" **and** "EPT paging-write control" are both 1.  `[SDM 3C §31.3.3.2]` `[SDM 3C §27.6.2]` `[1]` `[112]` `C:medium` `V:durable`

---

## 6.11 Virtualization exceptions (#VE)

A virtualization exception converts what would have been an EPT-violation VM exit into an exception delivered inside the guest, so guest-resident agents can handle their own second-level faults without a round trip to the VMM.

- **Claim.** The virtualization exception is exception vector 20 (#VE), occurs only in VMX non-root operation, and is delivered in place of an EPT-violation VM exit. It pushes no error code, and if bit 20 is set in the exception bitmap it causes a VM exit instead of being delivered to the guest.  `[SDM 3C §28.5.8]` `[SDM 3C §28.5.8.3]` `[1]` `C:high` `V:durable`
- **Claim.** Conversion has two prerequisites and then six conditions. The prerequisites make the EPT violation *convertible*: the "EPT-violation #VE" VM-execution control is 1, and bit 63 is 0 in the one entry that decides convertibility (the not-present entry if the walk stopped there, otherwise the entry that maps the page). A convertible EPT violation then becomes a #VE only if **all six** of these hold: (1) CR0.PE = 1; (2) the logical processor is not in the process of delivering an event; (3) the EPT violation did not cause a shadow stack to become prematurely busy; (4) it did not result from the Intel PT output process; (5) it did not result from PEBS; and (6) the 32 bits at offset 4 of the virtualization-exception information area are all 0. Fail any one and the EPT violation is a VM exit.  `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`
- **Claim.** The virtualization-exception information address is a 64-bit VM-execution control field at VMCS field encoding 202AH holding the physical address of the virtualization-exception information area; VM entry requires the address to be 4-KByte aligned, and the SDM defines the area's contents only through offset 32 (see `02-vmcs.md`).  `[SDM 3C §27.6.19]` `[SDM 3C §29.2.1.1]` `[1]` `C:high` `V:durable`

**Virtualization-exception information area**

| Offset | Size | Contents |
|---|---|---|
| 0 | 4 bytes | basic exit reason (48 for an EPT violation) |
| 4 | 4 bytes | #VE information "busy" field |
| 8 | 8 bytes | exit qualification |
| 16 | 8 bytes | guest-linear address |
| 24 | 8 bytes | guest-physical address |
| 32 | 2 bytes | EPTP index |

- **Claim.** On delivering a #VE the processor writes into the virtualization-exception information area the value that would have been the exit reason — 48 (00000030H) for an EPT violation — at offset 0, the exit qualification at offset 8, the guest-linear address at offset 16 and the guest-physical address at offset 24, and copies the current 16-bit EPTP index to offset 32.  `[SDM 3C §28.5.8.2]` `[1]` `C:high` `V:durable`
- **Claim.** The processor sets the 4-byte field at offset 4 to FFFFFFFFH when it delivers a #VE and never delivers another while that field is non-zero; guest software must clear it, which makes #VE non-reentrant by construction. The SDM explicitly permits a VMM to let the guest write this area, as an exception to the general rule that VMCS-referenced structures must not be modified by the guest.  `[SDM 3C §28.5.8.1]` `[SDM 3C §28.5.8.2]` `[1]` `C:high` `V:durable`
- **Claim.** The EPTP index is a 16-bit VM-execution control field at VMCS field encoding 0004H; an EPTP-switching VMFUNC writes ECX[15:0] into it, so it tells a #VE handler which entry of the EPTP list the current EPTP came from (see `02-vmcs.md`).  `[SDM 3C §27.6.19]` `[SDM 3C §28.5.7.3]` `[1]` `C:high` `V:durable`
- **Claim.** Setting suppress-#VE (bit 63) in the entry that maps a page is how a VMM keeps specific pages exempt from guest-side handling: those EPT violations always become VM exits even when the "EPT-violation #VE" control is 1.  `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`

Two consequences follow from the polarity of bit 63. Because suppression is opt-*out* per entry rather than opt-in, turning the "EPT-violation #VE" control on converts every convertible EPT violation in the address space at once unless the VMM has already set bit 63 across the hierarchy; and because the busy field gates delivery, a guest handler that faults again before clearing offset 4 gets a VM exit rather than a nested #VE, which is the architecture's way of preventing an unbounded exception recursion inside the guest.

- **Claim.** Because bit 63 suppresses rather than enables conversion, enabling "EPT-violation #VE" makes every convertible EPT violation a guest-visible exception unless the VMM has explicitly set bit 63 in the entries it wants to keep for itself — including the zeroed, not-present entries it uses for demand paging, where bit 63 is the one bit the processor still reads.  `[SDM 3C §28.5.8.1]` `[1]` `C:high` `V:durable`
- **Claim.** #VE is used both by guest-resident introspection agents that handle their own second-level faults and, in confidential-computing designs, to reflect unmapped-private-page accesses into the guest; the TDX use of #VE is owned by `13-tdx.md`.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

---

### 6.11.1 #VE together with EPTP switching

The EPTP index field exists because the two features are designed to be used together. A VMM publishes several EPT views in the EPTP list, lets guest-resident code switch between them with VMFUNC, and converts the resulting EPT violations into #VE so that the guest agent can decide which view it needs — all without a single VM exit. The EPTP index tells the handler which view it was running under when the fault occurred.

- **Claim.** A guest-resident agent combining VMFUNC EPTP switching with #VE can change its own memory view and handle its own second-level faults entirely in VMX non-root operation; the EPTP index at offset 32 of the virtualization-exception information area identifies the active view.  `[SDM 3C §28.5.7.3]` `[SDM 3C §28.5.8.2]` `[1]` `C:medium` `V:durable`
- **Claim.** Because neither the switch nor the fault leaves VMX non-root operation, this pattern is also available to guest-resident code the VMM does not trust, which is why the EPTP list is a VMM-controlled allowlist of views rather than an arbitrary pointer.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`

---

## 6.12 Chapter artifact index

Every architectural object this chapter describes, with the VMCS field or exit reason that reaches it. Encodings are restated here only as a navigation aid; `02-vmcs.md` owns the encoding table and `05-vm-exit.md` owns the exit-reason table.

| Object | Reached through | Exit reason it can produce |
|---|---|---|
| EPT hierarchy | EPTP (201AH) | 48 EPT violation, 49 EPT misconfiguration |
| Guest-physical mappings | EPTRTA (EPTP bits 51:12) | — (invalidated by INVEPT) |
| Linear / combined mappings | VPID field | — (invalidated by INVVPID) |
| Page-modification log | PML address (200EH), PML index (0812H) | 62 page-modification log full |
| Sub-page permission table | SPPTP (2030H) | 66 SPP-related event, 48 EPT violation |
| HLAT hierarchy | HLATP, HLAT prefix size | 48 EPT violation (verification failure) |
| #VE information area | virtualization-exception information address (202AH), EPTP index (0004H) | exception vector 20 instead of exit 48 |

- **Claim.** The four EPT-related basic exit reasons a VMM must be prepared to handle are 48 (EPT violation), 49 (EPT misconfiguration), 62 (page-modification log full) and 66 (SPP-related event); see `05-vm-exit.md` for the complete list.  `[SDM 3D App.C]` `[2]` `C:high` `V:durable`

---

## 6.13 Open items

- **Claim.** EPTP-switching via VMFUNC selects among at most 512 EPTP values held in the EPTP list; the VM-function control bits and the EPTP-list address field are owned by `02-vmcs.md` and the instruction behaviour by `08-vmx-instructions.md`.  `[SDM 3C Ch.31]` `[1]` `C:medium` `V:durable`
- **Claim.** The generation in which VMFUNC and EPTP switching became available in shipping silicon is disputed in the legacy research notes (an instruction-set definition dated to the Haswell era versus attributions to a later server generation) and is deferred to `errata.md` rather than asserted here.  `[SDM 3C Ch.31]` `[1]` `C:low` `V:durable`

Two items this list used to defer are now stated and anchored: the mode-based-execute-control misconfiguration conjunction is in §6.4.1, and the VMCS encodings of the HLAT pointer (`0x2040`) and HLAT prefix size (`0x0006`) are owned by `02-vmcs.md` §2.5.3 (the 64-bit control fields) and §2.5.2 (the 16-bit control fields) respectively, both confirmed against Vol.3D App.B Tables B-1 and B-4.

What remains deliberately **not** stated in this chapter because it could not be anchored with confidence: the exit-qualification bit layout for SPP-related events beyond the miss/misconfiguration distinction in bit 11; and the precise ordering rules between EPT A/D updates and PML logging on a single access.
