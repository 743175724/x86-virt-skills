# amd-virtualization eval — trap (12 questions)

Worked from `amd-virtualization/SKILL.md` → `references/errata.md` → the one owning
chapter per question. No web access, no PDFs, no outside recall.

---

### trap-client-sev-cpuid

**Premise in the question:** **incorrect.** "SEV is an EPYC feature, so on a desktop Ryzen
`Fn8000_001F EAX[1]` reads 0" is wrong — and it is wrong rather than merely imprecise.
*Productised on EPYC* is not the same as *absent from client silicon*. Measured CPUID dumps
from shipping non-PRO consumer desktop parts report `Fn8000_001F_EAX[1] = 1`. The premise is
only true for Zen 4 and later client parts, and the question states it as universal.

**Routed to:** `11-memory-encryption.md` §11.8 "What a client part does not have" (and
§11.8.1) — **correct route**. `errata.md` E12 `[reversed]` names `11-memory-encryption.md`
as the owner, SKILL.md's routing table sends `Fn8000_001F` / "what a client PC actually has"
to chapter 11, and SKILL.md's own Scope-boundaries section states the correction inline.

**Answer:**
It depends on the generation, and on Zen+/2/3 desktop parts the bit reads **1**, not 0.

Measured `Fn8000_001F` words from published CPUID dumps of shipping client parts:

| Part (client, non-PRO) | EAX | EBX | ECX | EDX |
|---|---|---|---|---|
| Ryzen 5 3600X (Matisse, Zen 2) | `0001000F` | `0000016F` | `000001FD` | `00000001` |
| Ryzen 7 5800X (Vermeer, Zen 3) | `0001780F` | `00000173` | `000001FD` | `00000001` |
| Ryzen 7000 desktop (Raphael, Zen 4) | `00000001` | `000000B3` | `00000000` | `00000000` |
| Ryzen 9 9950X (Granite Ridge, Zen 5) | `00000001` | `000000B3` | `00000000` | `00000000` |

- Client Zen 2 and Zen 3 desktop parts report `Fn8000_001F_EAX` bits 0–3 set — `SME`, **`SEV`**,
  `PageFlushMsr` and `SEV-ES` — with `ECX = 1FDh`, i.e. 509 simultaneously encryptable guests.
  `[no-spec]` `[330]` (InstLatx64 CPUID dump collection, `AuthenticAMD`) `C:medium` `V:durable`
- On **Zen 4 and Zen 5 client parts** the same register reads `00000001` — `SME` only — with
  `ECX` and `EDX` zero. That is the only generation for which your sentence holds.
  `[no-spec]` `[330]` `C:medium` `V:durable`
- `Fn8000_001F_EAX[4]` (`SEV-SNP`) is **clear on every client part** in that measurement set,
  including the Zen 2/Zen 3 parts that do report `SEV`. SEV-SNP has never been set on a client
  part. `[no-spec]` `[330][35]` `C:medium` `V:durable`
- The defensible client statement is about **TSME / AMD Memory Guard**, not about `EAX[1]`
  reading 0. On Zen 4+ client silicon a guest cannot be encrypted with a per-VM key because
  `EAX[1]` is clear there and, with `MemEncryptionModEn` = 0, the VMCB control bit for SEV is
  ignored outright. `[APM2 §15.34.3]` `[1][330]` `C:medium` `V:durable`
- Also recorded as `errata.md` **E12 `[reversed]`** — that entry exists because the proposed
  correction was drafted the other way round and a primary-source check refuted it. `[35]` `C:medium`

**Confidence:** **high** that the premise is false (two independent statements of it, and a
single `cpuid` on a Zen 2/3 desktop disproves it). The underlying measurements themselves are
marked **`C:medium`** in the skill and are anchored `[no-spec]` — they are machine-generated
CPUID dumps, not an AMD specification claim. `V:durable`.

---

### trap-x2avic-cpuid-bit

**Premise in the question:** **incorrect.** `Fn8000_000A EDX[14]` is not x2AVIC — **bit 14 is
Reserved**. The `EDX[14]` figure comes from a 2022 kernel patch letter that carried the wrong
bit number, and the mistake propagated from there.

**Routed to:** `07-virtual-interrupts-avic.md` §7.7 "x2AVIC" — **correct route**. SKILL.md
routes AVIC/x2AVIC to `07-virtual-interrupts-avic.md`; `errata.md` E09 names the same owner.

**Answer:**
x2AVIC is enumerated by **`CPUID Fn8000_000A_EDX[18]`**.

- x2AVIC accelerates performance-sensitive APIC accesses when the guest drives the x2APIC
  **MSR** interface rather than the MMIO interface, and is reported by
  `CPUID Fn8000_000A_EDX[x2AVIC]` = **bit 18**. `[APM2 §15.29.10]` `[1]` `C:high` `V:durable`
- §15.29.7 states the same bit a second time in the AVIC CPUID subsection:
  `Fn8000_000A_EDX[AVIC]` (**bit 13**) reports AVIC, and `Fn8000_000A_EDX[x2AVIC]` (**bit 18**)
  additionally reports AVIC support when the guest uses the x2APIC MSR interface.
  `[APM2 §15.29.7]` `[1]` `C:high` `V:durable`
- Vol.3's `Fn8000_000A_EDX` table confirms it from the other side: bit 13 `AVIC`, **bit 14
  Reserved**, bit 15 `VMSAVEvirt`, bit 18 `x2AVIC`. `[APM3 App.E]` `[2]` `C:high` `V:durable`
- `errata.md` **E09** records the provenance of the `EDX[14]` error. `[APM3 App.E]` `[2]` `C:high`

Do not confuse the CPUID bit with the *enables*: x2AVIC mode is entered by setting **both**
AVIC Enable (bit 31) and x2AVIC Mode Enable (bit 30) in the virtual interrupt control word at
VMCB offset 60h; setting bit 30 without bit 31 makes VMRUN fail with `VMEXIT_INVALID`.
`[APM2 §15.29.4.1]` `[1]` `C:high` `V:durable`

**Confidence:** **high.** Marked `C:high` `V:durable` in the skill, stated by two independent
APM anchors (Vol.2 §15.29.10 / §15.29.7 and Vol.3 App.E).

---

### trap-cmdbufrun-register

**Premise in the question:** **incorrect.** `CmdBufRun` is not in the Control Register at MMIO
0018h — it is in the **Status Register at MMIO 2020h**. You are polling the wrong register, at
a bit position (in 0018h, bit 4 is `ComWaitIntEn`) that has nothing to do with command-buffer
progress. `CmdBufRun` is also **read-only**, so it is not something you set; what you set is
`CmdBufEn`.

**Routed to:** `08-iommu-architecture.md` §8.3 "Control and Status registers" (IOMMU Control
Register MMIO 0018h; IOMMU Status Register MMIO 2020h) — **correct route**. SKILL.md routes
"IOMMU MMIO registers" to chapter 08; `errata.md` E01 names the same owner.

**Answer:**
Two different registers are being conflated.

- **`CmdBufRun` is a read-only bit 4 of the IOMMU Status Register, MMIO offset 2020h.** The
  control that starts or restarts command-buffer processing is **`CmdBufEn`, bit 12 of the
  Control Register at MMIO 0018h**. The two must not be conflated.
  `[IOMMU 3.11 §3.4.16]` `[7]` `C:high` `V:durable`
- In the Control Register at 0018h, bit 12 is `CmdBufEn` and bit 0 is `IommuEn`; the Device
  Table Base Address Register must be configured before `IommuEn` is set.
  `[IOMMU 3.11 §3.4.1]` `[7]` `C:high` `V:durable`
- `CmdBufRun` is **level-sensitive**: once 1 it stays 1 until command processing stops for
  cause, and once 0 it stays 0 until software writes `CmdBufEn` = 1. `errata.md` **E01**.
  `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`

So: read bit 4 of **2020h**, not 0018h; and if it reads 0, the fix is to write `CmdBufEn`
(0018h bit 12), because the bit will not set by itself.

Two further causes worth checking if you are already reading 2020h correctly:

- The IOMMU **stops fetching commands** after a `COMMAND_HARDWARE_ERROR` or an
  `ILLEGAL_COMMAND_ERROR`, and in that case the command head pointer does not advance past the
  offending entry — though it may already have advanced past it in the fetch pipeline.
  `[IOMMU 3.11 §2.4]` `[7]` `C:high` `V:durable`
- Restarting any halted ring follows the same four steps: wait for the `…Run` bit to read 0,
  clear the matching `…En` bit in 0018h, reprogram base/head/tail as needed, write 1 to the
  overflow status bit to clear it (RW1C), then set the `…En` bit again.
  `[IOMMU 3.11 §2.5.1]` `[7]` `C:high` `V:durable`

**Confidence:** **high.** `C:high` `V:durable` throughout, with the full bit tables for both
registers reproduced in §8.3.

---

### trap-irte-bit0-name

**Premise in the question:** **no premise stated** — this is a plain question, and nothing in
it is wrong. (The trap it is probing is the `RemapEm` misspelling; the question does not
assert it.)

**Routed to:** `10-iommu-interrupt-remapping.md` §10.1 "The legacy interrupt remapping table
entry" — **correct route**. SKILL.md routes "IRTE formats" to chapter 10; `errata.md` E03
names the same owner.

**Answer:**
Bit 0 of an interrupt remapping table entry is **`RemapEn`**.

- The exact field boundaries of the basic (32-bit) IRTE are `Vector` 23:16, `Destination` 15:8,
  `GuestMode` 7, `DM` 6, `RqEoi` 5, `IntType` 4:2, `SupIOPF` 1, **`RemapEn` 0**, with 31:24
  reserved. `[IOMMU 3.11 Table 20]` `[7]` `C:high` `V:durable`
- The field at bit 0 is spelled **`RemapEn`**; the misspelling that circulates in secondary
  material (`RemapEm`) appears nowhere in the specification, which uses `RemapEn` in **every
  one of the three IRTE tables**. `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`
- Semantics: `RemapEn = 1` means the interrupt is remapped; `RemapEn = 0` means it is **target
  aborted** and reported as an `IO_PAGE_FAULT` — it is the per-vector deny, which is why a
  correctly sized table with most entries disabled is the safe default rather than a short
  table. `[IOMMU 3.11 Table 20]` `[IOMMU 3.11 §2.2.5.2]` `[7]` `C:high` `V:durable`
- It keeps bit 0 in the 128-bit formats too: in the `GuestMode = 0` wide entry and in the
  `GuestMode = 1` virtualized entry (root pointer 115:76, `Vector` 71:64, `GATag` 63:32,
  `Destination[7:0]` 15:8, `GuestMode` 7, `IsRun` 6, `GAPPIDis` 5, reserved 4:3, `GALogIntr` 2,
  `SupIOPF` 1, **`RemapEn` 0**). `[IOMMU 3.11 Table 22]` `[IOMMU 3.11 Table 23]` `[7]` `C:high`
- `SupIOPF` (bit 1) is meaningful **independently** of `RemapEn`, so an entry that blocks an
  interrupt can still be configured to log or not log the resulting fault.
  `[IOMMU 3.11 Table 20]` `[7]` `C:high` `V:durable`
- Recorded as `errata.md` **E03**.

**Confidence:** **high.** `C:high` `V:durable`, with the spelling confirmed across all three
IRTE tables in the specification.

---

### trap-iommu-mmio-window-size

**Premise in the question:** **incorrect.** 14 KiB is not a size at all — it is a misreading of
the **`BaseAddress[31:14]` field width** in the capability block. The real size is conditional,
and neither of its two values is 14 KiB.

**Routed to:** `08-iommu-architecture.md` §8.2 "The MMIO register map" — **correct route**.
SKILL.md routes "IOMMU MMIO registers" to chapter 08; `errata.md` E02 names the same owner.

**Answer:**
The IOMMU register window is **16 KBytes when `MMIO 0030h[PCSup]` = 0, and 512 KBytes when
`PCSup` = 1**. There is no 14 KiB window.

- The IOMMU register window is 16 Kbytes when `MMIO 0030h[PCSup]` = 0 and 512 Kbytes when
  `PCSup` = 1; **software allocates and 16-Kbyte- or 512-Kbyte-aligns the region itself** and
  programs its base through the capability block, and when `PCSup` = 1, `BaseAddress[18:14]`
  must be zero. `[IOMMU 3.11 §2.3]` `[7]` `C:high` `V:durable`
- The "14" figure is a misreading of the `BaseAddress[31:14]` field width, not a size.
  `errata.md` **E02**. `[IOMMU 3.11 §2.3]` `[7]` `C:high` `V:durable`
- `PCSup` is bit 9 of the Extended Feature Register at MMIO 0030h; note also that the
  event-counter block at 4000h and above is **reserved when `EFR[PCSup]` = 0** — which is the
  concrete reason the window is smaller in that case. `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`
- Access rules for that window: software accesses to IOMMU registers may be no wider than 64
  bits, must be naturally aligned, must have a power-of-two size in bytes, and may be as small
  as one byte. `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`

**Confidence:** **high.** `C:high` `V:durable`, stated identically in chapter 08 §8.2 and in
`errata.md` E02, both anchored to `[IOMMU 3.11 §2.3]`.

---

### trap-vmexit-restores

**Premise in the question:** **incorrect** — the list is right as far as it goes but is badly
incomplete. RIP, RSP and RAX are three of **fourteen** enumerated items, and even the fourteen
are not a closed set, because the manual says "**at least** the following".

**Routed to:** `04-world-switch.md` §4.3 "#VMEXIT: what is restored and what is not" (with
§4.1 step 1 "saving host state", since what VMRUN saves is exactly what `#VMEXIT` restores) —
**correct route**. SKILL.md routes `#VMEXIT` to chapter 04; `errata.md` E07 names the same owner.

**Answer:**
No — that is three of fourteen, and the fourteen are themselves an open set.

**The enumerated set** (VMRUN saves it, `#VMEXIT` restores it), given in **§15.5.1 "Saving Host
State"**: **CS.SEL and NEXT_RIP · RFLAGS and RAX · SS.SEL and RSP · CR0, CR3, CR4 and EFER ·
IDTR and GDTR · ES.SEL and DS.SEL** — fourteen items, not three.
`[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

**The reload order**, as the Vol.3 pseudo-code enumerates it: GDTR, IDTR, EFER, CR0 with
**`CR0.PE` forced to 1**, CR4, CR3, the host PDPEs if the host is in PAE paging mode, RFLAGS,
RIP, RSP, RAX, `DR7 = "all disabled"`, `CPL = 0`, and then the ES, CS, SS and DS selectors with
their descriptors reloaded from the GDT.
`[APM3 §4 "VMRUN"]` `[APM2 §15.6]` `[1][2]` `C:high` `V:durable`

**Three qualifiers that matter:**

1. **The list is not closed.** The manual says "at least the following", in §15.5.1's host-save
   list and again in §15.6's `#VMEXIT` description. A VMM must not treat either as closed.
   `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
2. **Three items are explicitly *not* restored: host CR2, host PAT and the host LDTR.** The
   Vol.3 pseudo-code annotates "Do not reload host CR2 or PAT", and immediately after `#VMEXIT`
   the processor still contains the **guest** value of LDTR.
   `[APM3 §4 "VMRUN"]` `[APM2 §15.6]` `[1][2]` `C:high` `V:durable`
   Consequence you must code for: because LDTR still holds the guest value, for CS, SS, DS and
   ES the VMM must use only descriptors from the **GDT** until it has restored its own LDTR —
   which is what VMSAVE/VMLOAD exist for. `[APM2 §15.6]` `[1]` `C:high` `V:durable`
3. **`#VMEXIT` additionally forces state** rather than restoring it: `CR0.PE = 1`,
   `RFLAGS.VM = 0`, host CPL = 0, and all breakpoints disabled in the host DR7.
   `[APM2 §15.6]` `[1]` `C:high` `V:durable`

Also part of the exit sequence, before any of the above: `#VMEXIT` clears `GIF`, writes guest
state back to the VMCB, records `EXITCODE` (+ `EXITINFO1`/`EXITINFO2`), clears all intercepts,
resets the ASID to 0, and clears the internal `V_IRQ`, `V_INTR_MASKING` and `TSC_OFFSET`.
`[APM2 §15.6]` `[1]` `C:high` `V:durable`

`errata.md` **E07** records this misconception, and notes that the errata entry itself was
incomplete until 2026-09-21 (it had omitted RFLAGS and all four segment selectors and anchored
to §15.6, where the enumeration does not appear — corrected against Rev 3.45 p.523). **Cite
§15.5.1 for the enumeration, not §15.6.**

**Confidence:** **high** for the enumeration and the three non-restores (`C:high` `V:durable`),
with the explicit caveat that the skill flags the set as **open** — a future APM revision may
add to it without renumbering anything.

---

### trap-vmload-vmsave-ss

**Premise in the question:** **incorrect.** VMLOAD/VMSAVE do **not** cover SS. If you skip
saving SS on the strength of that assumption you will lose host SS state.

**Routed to:** `04-world-switch.md` §4.4 "VMLOAD and VMSAVE" → "The exact field set" —
**correct route**. SKILL.md routes VMLOAD/VMSAVE to chapter 04; `errata.md` E08 names the
same owner.

**Answer:**
No. **SS is not among the state VMLOAD/VMSAVE transfer.**

- The pair handles exactly this state: **FS, GS, TR and LDTR including all hidden state;
  `KernelGsBase`; `STAR`, `LSTAR`, `CSTAR` and `SFMASK`; and `SYSENTER_CS`, `SYSENTER_ESP` and
  `SYSENTER_EIP`.** SS is **not among them** — it is handled by VMRUN and `#VMEXIT` instead.
  `[APM2 §15.5.2]` `[APM3 §4 "VMLOAD"]` `[1][2]` `C:high` `V:durable`
- So you are not "skipping" anything: SS.SEL and RSP are in the fourteen-item set that VMRUN
  saves and `#VMEXIT` restores, and on `#VMEXIT` the SS selector is reloaded with its descriptor
  from the GDT. `[APM2 §15.5.1]` `[APM2 §15.6]` `[1]` `C:high` `V:durable`
- The Vol.3 reference pages for the two instructions list the identical field set in the
  identical order, so the pair is exactly symmetric — VMLOAD reads what VMSAVE writes.
  `[APM3 §4 "VMLOAD"]` `[APM3 §4 "VMSAVE"]` `[2]` `C:high` `V:durable`
- Recorded as `errata.md` **E08**.

What VMLOAD/VMSAVE **do** let you skip is the hidden FS/GS/TR/LDTR state that software cannot
otherwise reach — that is their whole purpose, and LDTR in particular, since `#VMEXIT` leaves
the *guest* LDTR loaded. `[APM2 §15.5.2]` `[1]` `C:high` `V:durable`

One caveat on ordering: the guest-side rule is quoted by AMD — "VMLOAD would be executed as
desired prior to executing a VMRUN, and VMSAVE at any desired point after a `#VMEXIT`"
`[APM2 §15.5.2]` `[1]` `C:high`. The mirror-image **host-side** sequence (save host extra state,
load guest extra state, VMRUN, then on `#VMEXIT` save guest extra state and load host extra
state — two VMSAVE/VMLOAD pairs against two different VMCBs) is a **derivation**, not a
quotation; the skill marks it **`C:medium`** and its §4.9 open items say AMD never writes the
four-instruction sequence out.

**Confidence:** **high** on the SS answer itself (`C:high` `V:durable`, two anchors). The
host-side pairing advice attached above is flagged **`C:medium`** by the skill.

---

### trap-two-dimensional-walk-count

**Premise in the question:** **incorrect**, twice over. (a) The worst case is **24** memory
references, not 16. (b) The implied "where is the number specified" — the APM — is also wrong:
**neither the APM nor the Intel SDM states this figure.**

**Routed to:** `06-nested-paging.md` §6.4 "The two-dimensional walk" → "The cost, and where
the number actually comes from" — **correct route**. SKILL.md routes "the two-dimensional walk"
to chapter 06; `errata.md` E11 names the same owner.

**Answer:**
With four-level guest paging over four-level nested paging, a TLB miss costs at worst
**24 memory references**, not 16.

- **Claim.** With four-level guest paging and four-level nested paging, a TLB miss costs at
  worst **24 memory references**. `[NP-WP §4.2.2]` `[15]` `C:high` `V:durable`
- **General form.** For an *n*-level guest hierarchy over an *m*-level nested hierarchy the
  count is **`nm + n + m`**, identical to `(n+1)(m+1) − 1`; the reference subtracted by the
  second form is the fetch of the datum itself, which is the access the program wanted rather
  than a translation step. `[NP-WP §4.2.2]` `[56]` `C:high` `V:durable`

Where the 24 comes from, term by term (4 guest levels, 4 nested levels):

- `nm` = 4×4 = 16 — for **each** of the *n* guest page-table entries the walker must read, a
  full *m*-reference nested walk to turn that entry's guest physical address into a system
  physical address. **This is the 16 in your note** — it is one term of three, not the total.
- `n` = 4 — the guest page-table entry fetches themselves.
- `m` = 4 — the final nested walk translating the guest physical address the guest walk produced.
- Total 16 + 4 + 4 = **24**.

**Where the number is specified — and where it is not:**

> **Sourcing rule.** The worst-case reference count **is not stated in the APM**, which gives
> only the per-dimension walk lengths. Its first-party source is AMD's own nested-paging white
> paper and the AMD-authored ASPLOS paper that introduced the general form. **An anchor of the
> form `[APM2 §15.25.x]` on this number is a fabrication.**

Cite instead:
- `[NP-WP §4.2.2]` — **AMD, "AMD-V™ Nested Paging", white paper Rev 1.0, 2008-07** `[15]`
- `[56]` — **Bhargava, Serebrin, Spadini, Manne (AMD), "Accelerating Two-Dimensional Page Walks
  for Virtualized Systems", ASPLOS XIII, 2008**

`errata.md` **E11** states the same sourcing rule.

**What it costs:** the 24 references are the worst case on a TLB miss. The APM does describe
the mechanism — each guest PTE's guest physical address is translated through the nested tables,
and nested-level faults, **including write faults from setting Accessed and Dirty bits in the
guest tables**, can occur on those accesses `[APM2 §15.25.5]` `[1]` `C:high`. Hardware mitigates
it with table-walk caching structures kept coherent by INVLPG, moves to CR3 and changes to the
paging control bits in CR0/CR4 `[APM2 §5.5.3]` `[1]` `C:high`. The three-tier organisation often
quoted for this (TLB + nested TLB + page-walk caches) is a **microarchitectural** description of
the 2008 Opteron published by the AMD authors of the ASPLOS paper — not an architectural
guarantee; no AMD specification requires any particular structure. `[no-spec]` `[56]` `C:medium`.

For LA57: `nm + n + m` gives **35** for five levels both ways and **29** for the mixed
four/five-level cases, but these are **derivations, not figures quoted by any published
source** — `errata.md` **O6** keeps that open. `C:medium`. Do not quote them as AMD figures.

**Confidence:** **high** for 24 and for the sourcing rule (`C:high` `V:durable`). The LA57
derivations and the microarchitectural three-tier description are **`C:medium`**.

---

### trap-branch-type-confusion-cve

**Premise in the question:** **incorrect in its operative part, though understandable.** AMD's
bulletin does literally print that number — AMD-SB-1037 writes the pairing as "CVE-2022-29900
(RETbleed) (aka CVE-2022-23816)", which is exactly how the dead number keeps circulating — but
**CVE-2022-23816 is REJECTED at NVD** and must not be cited. So "AMD's bulletin shows
CVE-2022-23816" is true as an observation and wrong as a citation decision.

**Routed to:** `17-security.md` §17.1.3 "Transient execution — client parts included" (the CVE
table and the claims immediately following it) — **correct route**. SKILL.md routes "CVEs and
their mitigations, transient execution" to chapter 17; `errata.md` E26 names the same owner.

**Answer:**
Cite **CVE-2022-29900** for RETbleed on AMD, and **CVE-2022-23825** for Branch Type Confusion.
Do not cite CVE-2022-23816 at all.

AMD-SB-1037 (published **2022-07-12**, last updated 2022-07-14, AMD severity **Medium**) covers
**two** CVEs, and your question runs them together:

| CVE | Name | Bulletin | Affected | Mechanism |
|---|---|---|---|---|
| **CVE-2022-23825** | **Branch Type Confusion** | AMD-SB-1037, 2022-07-12 | Athlon X4, Ryzen 2000–5000 desktop/mobile, Threadripper, 1st/2nd Gen EPYC | branch-predictor aliasing causes the wrong *branch type* to be predicted |
| **CVE-2022-29900** | **RETbleed** | AMD-SB-1037, 2022-07-12 | same | mistrained return predictions give arbitrary speculative execution |

`[AMD-SB-1037]` `[505]` `C:high` `V:durable`

- **Claim.** AMD's Branch Type Confusion bulletin covers two CVEs and states the identity
  explicitly as "CVE-2022-29900 (RETbleed) (aka CVE-2022-23816)"; **NVD has since REJECTED
  CVE-2022-23816** with the note "This candidate is unused by its CNA", so the citable
  identifier for the AMD RETbleed variant is **CVE-2022-29900**.
  `[AMD-SB-1037]` `[505][520]` `C:high` `V:durable`
- The NVD record's `vulnStatus` is `Rejected`, and its only description reads "DO NOT USE THIS
  CANDIDATE NUMBER. ConsultIDs: none. Reason: This candidate is unused by its CNA." No
  description, no score, no references. `errata.md` **E26**. `[55]` `[520]` `C:high` `V:durable`
- Attribution, if you need it: both halves of AMD-SB-1037 are framed by AMD as follow-ups to
  CVE-2017-5715 (Spectre v2); AMD credits **CVE-2022-29900 to Kaveh Razavi and Johannes Wikner
  of ETH Zurich**, and states **CVE-2022-23825 was "found internally by AMD employees"**.
  `[AMD-SB-1037]` `[505]` `C:high` `V:durable`
- Mitigation ownership: Branch Type Confusion is fixed by AMD via microcode or a hardware
  revision, with AMD's "Technical Guidance for Mitigating Branch Type Confusion" as the
  software-workaround document. `[AMD-SB-1037]` `[505]` `C:high` `V:durable`

Citation form note: per SKILL.md, CVE facts cite **NVD / the AMD security bulletin**, not the
APM — there is no APM section for a CVE.

**Confidence:** **high.** `C:high` `V:durable`, with the REJECTED status confirmed directly
from the NVD record `[520]` and the bulletin's own wording quoted `[505]`.

---

### trap-hyperv-image-name

**Premise in the question:** **no premise stated** — a plain question, nothing asserted to be
wrong. (The trap it probes is the widely repeated `hvix64.exe`; the question does not claim it.)

**Routed to:** `16-windows-platform.md` §16.2 "The Hyper-V components on an AMD host" —
**correct route**. SKILL.md routes "Hyper-V on AMD, VBS, HVCI, WSL2" to chapter 16; `errata.md`
E10 names the same owner.

**Answer:**
On a Ryzen desktop Hyper-V loads **`Hvax64.exe`**.

- **Claim.** Hyper-V ships a **per-architecture** hypervisor binary and picks one at boot: on
  Intel systems the image is `Hvix64.exe`, on **AMD systems it is `Hvax64.exe`**, and on ARM64
  it is `Hvaa64.exe`. `[46]` `C:high` `V:durable`
- **Where it is documented — and where it is not.** This is documented in ***Windows Internals,
  Part 2*, 7th edition** (Yosifovich, Russinovich, Solomon, Ionescu; Microsoft Press, 2021)
  `[46]`. It is **not** on learn.microsoft.com, **so no product-documentation citation for it
  exists.** Do not manufacture a Microsoft Learn URL for this fact.
- Recorded as `errata.md` **E10** — the misconception being that Hyper-V loads `hvix64.exe` on
  AMD hosts.

Per SKILL.md's output standards, Windows behaviour is a Tier-2 citation with its source, not an
APM anchor — here the source is a book, and the skill says so explicitly rather than
substituting a plausible-looking Microsoft Learn link.

Adjacent, and flagged as a **gap** rather than answered: the skill's §16 open items record that
the pre-rebuild corpus placed an **`hvboot.sys`** stage between `hvloader.dll` and the
hypervisor image; **no first-party source in this corpus documents it** for a current Windows
release, and *Windows Internals* describes the loader as `Hvloader.dll`. The skill records the
stage as **unverified** rather than repeating it.

**Confidence:** **high** for the binary name (`C:high` `V:durable`). Note that the source is
**Tier-2** (a book, not a specification), and that the boot-chain stage below it is explicitly
**unresolved** in the skill.

---

### trap-enlightened-vmcb

**Premise in the question:** **incorrect** — and SKILL.md names this exact case as its worked
example of a plausible-reading false negative. The correct statement has two halves, and
"AMD has no counterpart at all" collapses them into one wrong one. AMD has **no enlightened
VMCS** equivalent, but there **is** an enlightened **VMCB** field block, defined by Microsoft's
TLFS.

**Routed to:** `15-nested-virtualization.md` §15.5.4 "No enlightened VMCS — but there *is* an
enlightened VMCB field block" — **correct route**. SKILL.md routes "what AMD has instead of
VMCS shadowing" to chapter 15 and explicitly names §15.5.4 as the worked example for negative
claims.

**Answer:**
No. The accurate statement is two-sided.

**The negative half (true, and narrow).** Hyper-V's **enlightened VMCS** is an Intel-side
construction — a full VMCS-shaped structure in guest physical memory that an aware L1 edits with
ordinary memory instructions instead of VMREAD, VMWRITE and VMPTRLD — and it has **no AMD
counterpart, because the VMCB is already ordinary memory** that L1 accesses with loads and
stores, so a memory-shaped replacement for it would replace nothing.
`[no-spec]` `[464]` `C:high` `V:durable`

**The positive half (which the premise erases).**

- **That does not mean AMD has no enlightenment interface, and the negative form of this
  statement is a trap.** The **Hypervisor Top-Level Functional Specification** says AMD "has
  reserved space in the VMCB for hypervisor use, as well as an associated clean bit — the
  reserved bytes are in the control section, **offset 0x3E0–0x3FF**, of the VMCB" and that "the
  **clean bit is bit 31**", which "must be invalidated whenever the hypervisor modifies the
  enlightenments area". Hyper-V uses that region through a structure named
  **`HV_SVM_ENLIGHTENED_VMCB_FIELDS`**, and the specification speaks throughout of "the
  enlightened VMCS / VMCB fields" as a **matched pair**.
  `[no-spec]` `[464]` (Microsoft, *Hypervisor Top-Level Functional Specification — Nested
  Virtualization*, Microsoft Learn) `C:high` `V:durable`
- **Linux corroborates the layout independently**: its definition of the SVM control area
  overlays a **32-byte** Hyper-V enlightenment structure onto the software-reserved region at
  control-area offset `3E0h`, as a union with `u8 reserved_sw[32]`. So the interface is an
  **extension of the existing VMCB** rather than a second structure to keep coherent — which is
  the real architectural difference from Intel's enlightened VMCS, and a sharper statement than
  "AMD has nothing here". `[no-spec]` `[433]` `C:high` `V:durable`
- One named AMD enlightenment, with a counter-intuitive direction: setting **`EnlightenedNptTlb`**
  in `HV_SVM_ENLIGHTENED_VMCB_FIELDS` means **ASID flushes no longer affect TLB entries derived
  from the nested page tables**, and L1 must invalidate those with hypercalls instead. Opting in
  therefore *narrows* what an ASID flush covers, in exchange for not flushing NPT-derived
  entries on every ASID operation. `[no-spec]` `[464]` **`C:medium`** `V:durable`

**What AMD actually defines for nesting acceleration** (the other half of "instead of VMCS
shadowing"): APM §15.33 defines exactly **two** features — **VLS (Virtualized VMLOAD/VMSAVE)**
and **vGIF**. There is no "VMCB shadowing"; do not go looking for one.

Note the citation shape: these are `[no-spec]` claims — Microsoft's TLFS and the Linux header,
not the APM — because an enlightenment interface is not AMD architecture and has no APM section.

**Confidence:** **high** that the premise is false and on the existence, offset (`3E0h–3FFh`)
and clean bit (31) of the block. Two caveats the skill carries: the `EnlightenedNptTlb`
semantics are **`C:medium`**, and §15.7 open items record that **the enlightenment block's
contents were described from the Linux structure definition and have not been checked against
Microsoft's TLFS in this pass**, which is why that part is `C:medium`.

---

### trap-vmgexit-encoding

**Premise in the question:** **incorrect.** The `F2` form is **not** a transcription error —
both prefixes are architectural, and AMD's instruction page prints them as one encoding.

**Routed to:** `13-sev-es-ghcb.md` §13.6.1 "VMGEXIT" — **correct route**. SKILL.md routes
"SEV-ES … VMGEXIT" to chapter 13; `errata.md` E22 names the same owner.

**Answer:**
No. VMGEXIT's opcode is **`F2/F3 0F 01 D9`** — both prefixes.

- **Claim.** VMGEXIT's opcode is **`F2/F3 0F 01 D9`** — AMD's instruction page prints both
  prefixes, and **both are architectural**. The unprefixed **`0F 01 D9` on the same page is
  VMMCALL**. `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
  > As printed: Mnemonic VMMCALL — Opcode `0F 01 D9`; Mnemonic VMGEXIT — Opcode `F2/F3 0F 01 D9`.
- This is `errata.md` **E22 `[reversed]`** — one of the five entries that exist *because the
  proposed correction was itself wrong*. The draft asserted exactly your premise ("`F3` only,
  `F2` is an error") and a primary-source check refuted it. **If you find a secondary source
  asserting the `F3`-only version, it is the secondary source that is wrong.**

Related facts from the same section, since removing `F2` is usually a decoder-table edit:

- Support is indicated by CPUID `Fn8000_001F_EAX[SEV-ES] = 1`, and the VMGEXIT encoding is
  **interpreted as VMMCALL** on processors that do not support it — including legacy processors
  — or when it is not executed by an SEV-ES guest. `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
- VMGEXIT is **always intercepted** and unconditionally causes a `#VMEXIT`; **there is no
  intercept bit for it**, and it behaves like a **trap**, so a subsequent VMRUN resumes
  execution after the VMGEXIT. `[APM2 §15.35.6]` `[1][2]` `C:high` `V:durable`
- It is allowed in **all modes and at all privilege levels**, and raises `#UD` if
  `EFER.SVME = 0` or `Fn8000_0001_ECX[SVM] = 0`. `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`

Citation-form note: APM Vol.3 Chapter 4 is ordered alphabetically and carries page numbers, not
subsection numbers — hence `[APM3 §4 "VMGEXIT"]`. A form like `[APM3 §4.7.x VMGEXIT]` would be
a fabrication.

**Confidence:** **high.** `C:high` `V:durable`, and the entry is specifically hardened against
the `F3`-only reading by a primary-source check during the rebuild.

---

## Routing summary

| # | Question | Routed to | Right? |
|---|---|---|---|
| 1 | trap-client-sev-cpuid | `11-memory-encryption.md` §11.8 / §11.8.1 | correct |
| 2 | trap-x2avic-cpuid-bit | `07-virtual-interrupts-avic.md` §7.7 | correct |
| 3 | trap-cmdbufrun-register | `08-iommu-architecture.md` §8.3 | correct |
| 4 | trap-irte-bit0-name | `10-iommu-interrupt-remapping.md` §10.1 | correct |
| 5 | trap-iommu-mmio-window-size | `08-iommu-architecture.md` §8.2 | correct |
| 6 | trap-vmexit-restores | `04-world-switch.md` §4.3 (+ §4.1) | correct |
| 7 | trap-vmload-vmsave-ss | `04-world-switch.md` §4.4 | correct |
| 8 | trap-two-dimensional-walk-count | `06-nested-paging.md` §6.4 | correct |
| 9 | trap-branch-type-confusion-cve | `17-security.md` §17.1.3 | correct |
| 10 | trap-hyperv-image-name | `16-windows-platform.md` §16.2 | correct |
| 11 | trap-enlightened-vmcb | `15-nested-virtualization.md` §15.5.4 | correct |
| 12 | trap-vmgexit-encoding | `13-sev-es-ghcb.md` §13.6.1 | correct |

**Premises judged incorrect: 10 of 12.** Q4 (`trap-irte-bit0-name`) and Q10
(`trap-hyperv-image-name`) state no premise — they are plain questions, and both were answered
without contradicting anything the user said.
