# amd-virtualization eval — trap set (12 questions)

Answered from the `amd-virtualization` skill only. Procedure followed: `SKILL.md` →
`references/errata.md` (all twelve touch a commonly circulated claim, so step 3 applied to
every one) → the single owning chapter named by the routing table or by the errata entry's
`Owner:` line. No second chapter was opened for any question.

---

### trap-client-sev-cpuid
**Premise:** incorrect — and wrong twice. The inference is wrong ("SEV is an EPYC feature" means SEV is *productised* on EPYC, which is not the same as absent from client silicon), and the value is wrong for the parts most people mean by "a desktop Ryzen". `errata.md` E12 is one of the five `[reversed]` entries: it was drafted the other way round and a primary-source check refuted the draft.
**Routed to:** `11-memory-encryption.md` §11.2 (`Fn8000_001F` field definitions) and §11.8 "What a client part does not have" (the measured dumps) — right first time; SKILL.md's routing row and its Scope-boundaries note both point here, and errata E12's `Owner:` line agrees.
**Answer:** No. Measured `Fn8000_001F` words from published CPUID dumps of shipping **non-PRO consumer desktop parts report `EAX[1] = 1`**:

| Part | EAX | EBX | ECX | EDX |
|---|---|---|---|---|
| Ryzen 5 3600X (Matisse, Zen 2) | `0001000F` | `0000016F` | `000001FD` | `00000001` |
| Ryzen 7 5800X (Vermeer, Zen 3) | `0001780F` | `00000173` | `000001FD` | `00000001` |
| Ryzen 7000 desktop (Raphael, Zen 4) | `00000001` | `000000B3` | `00000000` | `00000000` |
| Ryzen 9 9950X (Granite Ridge, Zen 5) | `00000001` | `000000B3` | `00000000` | `00000000` |

On Zen 2 and Zen 3 client desktop parts `EAX` bits 0–3 are set — `SME`, `SEV`, `PageFlushMsr`, `SEV-ES` — with `ECX = 1FDh`, i.e. **509** simultaneously encryptable guests. errata E12 adds the Ryzen 9 3900X and the Ryzen 7 5800X3D to that set. The generation matters: **Zen 4 and Zen 5 client parts read `EAX = 00000001`, `SME` only**, so `EAX[1]` is 0 *there* — but that is a statement about Zen 4+, not about "Ryzen". Separately, `Fn8000_001F_EAX[4]` (`SEV-SNP`) is **clear on every client part in the measurement set**, including the Zen 2 and Zen 3 parts that do report `SEV`; SEV-SNP has never been set on a client part. The defensible client statement is the one about TSME / AMD Memory Guard, not "`EAX[1]` reads 0 on Ryzen", which a Zen+/2/3 desktop disproves in one `cpuid` invocation.

Citations as the skill gives them: the measurements are `[no-spec]` `[330]` — InstLatx64, x86/x64 CPUID dump collection, `AuthenticAMD` directory (Matisse `0870F10`, Vermeer `0A20F12`, Raphael `0A60F12`, Granite Ridge `0B40F40`), retrieved 2026-09-21 — together with `[35]` AMD's SEV developer resources; the leaf's field definitions are `[APM3 App.E]` `[2]` (AMD64 Architecture Programmer's Manual Vol.3, pub. 24594, rev 3.38); the rule that SEV cannot be enabled when `EAX[1]` is clear is `[APM2 §15.34.3]` `[1]` (pub. 24593, rev 3.45).
**Confidence:** high that the premise is false. The supporting measurement claims are marked **`C:medium`** in the chapter and carry `[no-spec]` — there is no AMD specification for per-part CPUID values, so the evidence is a Tier-2 dump collection. As of 2026-09-26 no public revision guide covers a Family 19h or 1Ah client model range, and client PPRs 56176, 56214, 56713 and 57254 have no retrievable first-party copy (`errata.md` E27). Family 17h client parts have Revision Guide 55449.

---

### trap-x2avic-cpuid-bit
**Premise:** incorrect. `Fn8000_000A_EDX[14]` is **Reserved**. The `EDX[14]` figure comes from a 2022 kernel patch letter that carried the wrong bit, and it propagated from there (`errata.md` E09).
**Routed to:** `07-virtual-interrupts-avic.md` §7.7 "x2AVIC" — right first time.
**Answer:** x2AVIC is enumerated by **`CPUID Fn8000_000A_EDX[18]`**. `[APM2 §15.29.10]` `[1]`. §15.29.7 states the same bit a second time in the AVIC CPUID subsection: `EDX[AVIC]` (bit 13) reports AVIC, and `EDX[x2AVIC]` (bit 18) additionally reports AVIC support when the guest is using the x2APIC MSR interface. `[APM2 §15.29.7]` `[1]`. Vol.3's `Fn8000_000A_EDX` table confirms it from the other side — bit 13 `AVIC`, **bit 14 Reserved**, bit 15 `VMSAVEvirt`, bit 18 `x2AVIC`. `[APM3 App.E]` `[2]`.

Two adjacent facts, so the enumeration bit is not confused with an enable: x2AVIC mode is entered by setting **both** AVIC Enable (bit 31) **and** x2AVIC Mode Enable (bit 30) in the virtual interrupt control word at VMCB offset 60h — setting bit 30 without bit 31 makes VMRUN fail with `VMEXIT_INVALID` `[APM2 §15.29.4.1]` `[1]` — and the separate `x2AVIC_EXT` capability is an **ECX** bit, `Fn8000_000A_ECX[6]`, not an EDX bit.
**Confidence:** high — `C:high` `V:durable`, stated twice in Vol.2 and confirmed from Vol.3's table.

---

### trap-cmdbufrun-register
**Premise:** incorrect — right bit name, wrong register. `CmdBufRun` is not in the Control Register, so polling MMIO 0018h for it will never show it set no matter what the IOMMU is doing. This is `errata.md` E01.
**Routed to:** `08-iommu-architecture.md` §8.3 "Control and Status registers" (both the 0018h and the 2020h bit tables) — right first time.
**Answer:** `CmdBufRun` is a **read-only bit 4 of the IOMMU Status Register at MMIO offset 2020h** `[IOMMU 3.11 §3.4.16]` `[7]`. The control that enables and starts command-buffer processing is a different bit in a different register: **`CmdBufEn`, bit 12 of the IOMMU Control Register at MMIO offset 0018h** `[IOMMU 3.11 §3.4.1]` `[7]`. The two are different registers and must not be conflated.

What to do about the symptom: read 2020h bit 4 rather than 0018h, and check that 0018h bit 12 (`CmdBufEn`) and bit 0 (`IommuEn`) are set, with the Device Table Base Address Register configured before `IommuEn`. `CmdBufRun` is level-sensitive — once 1 it stays 1 until command processing stops for cause, and once 0 it stays 0 until software writes `CmdBufEn = 1`. To restart a halted buffer the specification gives one four-step sequence, shared by all the ring buffers: wait for the `…Run` bit to read 0, clear the matching `…En` bit in 0018h, reprogram base/head/tail as needed, write 1 to the overflow status bit to clear it (RW1C), then set the `…En` bit again. `[IOMMU 3.11 §2.5.1]` `[7]`. Citation is AMD I/O Virtualization Technology (IOMMU) Specification, pub. 48882-PUB rev 3.11.
**Confidence:** high — `C:high` `V:durable`; the chapter states its 0018h and 2020h tables are the complete bit assignments of those registers.

---

### trap-irte-bit0-name
**Premise:** none stated — this one is a plain question, not a trap premise. Worth flagging anyway that the spelling `RemapEm` circulates in secondary material and appears nowhere in the specification (`errata.md` E03).
**Routed to:** `10-iommu-interrupt-remapping.md` §10.1 "The legacy interrupt remapping table entry" — right first time.
**Answer:** Bit 0 is **`RemapEn`**: 1 = the interrupt is remapped, 0 = the interrupt is target aborted. `[IOMMU 3.11 §2.2.5]` `[7]`. The exact field boundaries of the basic 32-bit IRTE are `Vector` 23:16, `Destination` 15:8, `GuestMode` 7, `DM` 6, `RqEoi` 5, `IntType` 4:2, `SupIOPF` 1, `RemapEn` 0, with 31:24 reserved. `[IOMMU 3.11 Table 20]` `[7]`. The specification uses the `RemapEn` spelling in **every one of the three IRTE tables** — Table 20 (basic 32-bit), Table 22 (128-bit `GuestMode=0`) and Table 23 (`GuestMode=1`), where `RemapEn` is again bit 0.

Two behaviours attached to the bit: `SupIOPF` (bit 1) is meaningful **independently** of `RemapEn`, so an entry that blocks an interrupt can still be configured to log or not log the resulting fault `[IOMMU 3.11 Table 20]`; and `RemapEn = 0` is the per-vector deny — the interrupt is target aborted and reported as an `IO_PAGE_FAULT` rather than silently dropped, which is why a correctly sized table with most entries disabled is the safe default rather than a short table. `[IOMMU 3.11 §2.2.5.2]` `[7]`.
**Confidence:** high — `C:high` `V:durable`.

---

### trap-iommu-mmio-window-size
**Premise:** incorrect, and "14" is not a size at all — it is a misreading of the **`BaseAddress[31:14]` field width** in the IOMMU capability block (Capability Offset 04h) taken as a KiB figure. `errata.md` E02.
**Routed to:** `08-iommu-architecture.md` §8.2 "The MMIO register map" — right chapter, one section above the routing table's `§8.3 (registers)` pointer: the window *size* is owned by §8.2 and the per-register bit tables by §8.3. Same chapter, no second file opened.
**Answer:** The size is **conditional, not a single number**: the IOMMU register window is **16 KBytes when `MMIO 0030h[PCSup] = 0`, and 512 KBytes when `PCSup = 1`**. Software allocates the region and aligns it itself — 16-KByte- or 512-KByte-aligned to match — and programs its base through the capability block; when `PCSup = 1`, `BaseAddress[18:14]` must be zero. `[IOMMU 3.11 §2.3]` `[7]`.

`PCSup` (performance-counter support) is bit 9 of the Extended Feature Register at MMIO 0030h, and the event-counter block at 4000h and above is reserved when `EFR[PCSup] = 0` `[IOMMU 3.11 §3.4]` `[7]` — which is what the larger window is for. Access rules for the window: software accesses may be no wider than 64 bits, must be naturally aligned, must have a power-of-two size in bytes, and may be as small as one byte.
**Confidence:** high — `C:high` `V:durable`.

---

### trap-vmexit-restores
**Premise:** **partly correct.** RIP, RSP and RAX are genuinely restored, so the three named items are right. What is wrong is "the whole list": they are three of a **fourteen-item** enumerated set, and the manual introduces that set with "**at least** the following", so the list is not even closed. `errata.md` E07 — which notes it was itself incomplete until 2026-09-21, having omitted RFLAGS and all four segment selectors and anchored to §15.6, where the enumeration does not appear.
**Routed to:** `04-world-switch.md` §4.3 "#VMEXIT: what is restored and what is not", with the save-side enumeration in §4.1 "Step 1 — saving host state" — right chapter first time (the routing row points at §4.2; §4.3 is the section that owns it).
**Answer:** No. What VMRUN saves is exactly what `#VMEXIT` restores, and **§15.5.1 "Saving Host State"** is where the enumeration lives — **fourteen items, not three**: **CS.SEL and NEXT_RIP · RFLAGS and RAX · SS.SEL and RSP · CR0, CR3, CR4 and EFER · IDTR and GDTR · ES.SEL and DS.SEL**. `[APM2 §15.5.1]` `[1]`. NEXT_RIP here means the rIP of the instruction *following* the VMRUN — the address at which the host resumes.

Vol.3's pseudo-code enumerates the reload in order on the way out: GDTR, IDTR, EFER, CR0 with **`CR0.PE` forced to 1**, CR4, CR3, the host PDPEs if the host is in PAE paging mode, RFLAGS, RIP, RSP, RAX, `DR7 = "all disabled"`, `CPL = 0`, and then the ES, CS, SS and DS selectors with their descriptors reloaded from the GDT. `[APM3 §4 "VMRUN"]` `[APM2 §15.6]` `[1][2]`. `#VMEXIT` additionally forces `RFLAGS.VM = 0`.

Three items are **explicitly excluded** from that reload: **host CR2, host PAT and the host LDTR** — the pseudo-code annotates "Do not reload host CR2 or PAT", and immediately after `#VMEXIT` the processor still contains the **guest** value of LDTR. Because of that last one, the VMM must use only global-descriptor-table descriptors for CS, SS, DS and ES until it has restored its own LDTR, which is exactly what VMSAVE and VMLOAD exist for. `[APM2 §15.6]` `[1]`.
**Confidence:** high — `C:high` `V:durable`. The one caveat the skill itself flags: "at least the following" appears in both §15.5.1's host-save list and §15.6's restore list, so fourteen is a floor, not a closed set.

---

### trap-vmload-vmsave-ss
**Premise:** incorrect. SS is **not** among the state VMLOAD/VMSAVE transfer, so the pair cannot be used to skip saving it. `errata.md` E08.
**Routed to:** `04-world-switch.md` §4.4 "VMLOAD and VMSAVE" → "The exact field set" — right first time.
**Answer:** No. The pair handles exactly this state: **FS, GS, TR and LDTR including all hidden state; `KernelGsBase`; `STAR`, `LSTAR`, `CSTAR` and `SFMASK`; and `SYSENTER_CS`, `SYSENTER_ESP` and `SYSENTER_EIP`.** SS is not among them. `[APM2 §15.5.2]` `[APM3 §4 "VMLOAD"]` `[1][2]`.

You do not have to hand-save SS, though — it is covered by the *other* mechanism: **SS.SEL and RSP are in the VMRUN host-save / `#VMEXIT` restore set** (the fourteen-item list at `[APM2 §15.5.1]`), and VMRUN loads guest SS including its hidden state. So the division is: VMRUN and `#VMEXIT` swap SS; VMLOAD/VMSAVE swap the FS/GS/TR/LDTR-plus-SYSCALL/SYSENTER block that VMRUN and `#VMEXIT` do *not* touch.

Vol.3's reference pages for the two instructions list the identical field set in the identical order, so the pair is exactly symmetric — VMLOAD reads what VMSAVE writes. `[APM3 §4 "VMLOAD"]` `[APM3 §4 "VMSAVE"]` `[2]`. On ordering: with respect to the **guest's** VMCB the manual states it plainly — "VMLOAD would be executed as desired prior to executing a VMRUN, and VMSAVE at any desired point after a `#VMEXIT`" `[APM2 §15.5.2]` `[1]`; with respect to a **host** VMCB the order is the mirror image, so the full sequence is two VMSAVE/VMLOAD pairs against two different VMCBs, not one.
**Confidence:** high on the SS answer — `C:high` `V:durable`. The host-VMCB ordering corollary is marked **`C:medium`** in the chapter: it follows from instruction semantics rather than from an explicit AMD statement.

---

### trap-two-dimensional-walk-count
**Premise:** incorrect on both halves. The count is wrong — it is **24**, not 16 — and the question's implicit assumption that an APM section specifies it is also wrong. (The "4-reference native walk" part of the premise is fine for four-level paging.) `errata.md` E11.
**Routed to:** `06-nested-paging.md` §6.4 "The two-dimensional walk" — right chapter first time (the routing row lists §6.5 and §6.7–§6.8 for `#NPF` and ASID work; the chapter's `Owns:` line names the two-dimensional walk and §6.4 is its section).
**Answer:** With four-level guest paging over four-level nested paging, a TLB miss costs at worst **24 memory references**. The general form for an *n*-level guest hierarchy over an *m*-level nested hierarchy is **`nm + n + m`**, identical to `(n+1)(m+1) − 1`; the reference the second form subtracts is the fetch of the datum itself, which is the access the program actually wanted rather than a translation step. For n = m = 4 that is (4×4) + 4 + 4 = **24**. `[NP-WP §4.2.2]` `[15][56]`. The 16 in the premise is the `nm` term alone — it counts one nested walk per guest-entry fetch and drops the `n + m` terms.

**Where the number is specified — the load-bearing half of the question:** **neither the APM nor the Intel SDM states this figure.** Both give only per-dimension walk lengths. The first-party sources are **AMD's own *AMD-V Nested Paging* white paper, Rev 1.0, 2008-07 `[15]`** (§4.2.2 — the skill's anchor form is `[NP-WP §4.2.2]`), and the AMD-authored ASPLOS XIII 2008 paper **Bhargava, Serebrin, Spadini and Manne, "Accelerating Two-Dimensional Page Walks for Virtualized Systems" `[56]`**, which introduced the general form. An anchor of the form `[APM2 §15.25.x]` on this number is a **fabrication** — the skill says so in both §6.4's sourcing rule and errata E11.

Two qualifiers on "what does that cost": the three-tier mitigation usually quoted alongside it — a conventional TLB, a nested TLB caching guest-physical-to-system-physical translations, and page-walk caches for the upper levels — is a description of the **2008 Opteron design** published by the AMD authors of the ASPLOS paper. It is microarchitectural, not an architectural guarantee, and no AMD specification requires any particular structure (`[no-spec]` `[56]` `C:medium`). And the five-level (LA57) figures sometimes quoted — 35 when both dimensions use five levels, 29 for the mixed four/five-level cases — are **derivations from `nm + n + m` that no published source states**; `errata.md` O6 keeps that open, `C:medium`. Relatedly, `errata.md` O4 records that no modern measurement in this corpus supports the circulating "NPT is 15–30% faster than shadow paging" range, so it may not be stated as a present-tense fact.
**Confidence:** high for 24 and for the sourcing rule — `C:high` `V:durable`. The microarchitectural and LA57 asides are **`C:medium`** and flagged as such above.

---

### trap-branch-type-confusion-cve
**Premise:** **partly correct — right about the observation, wrong about the conclusion.** You are not misreading the bulletin: AMD-SB-1037 does literally write the pairing as "CVE-2022-29900 (RETbleed) (aka CVE-2022-23816)", which is exactly how the dead number keeps circulating. But **CVE-2022-23816 is REJECTED at NVD** — `vulnStatus: Rejected`, whose only description reads "DO NOT USE THIS CANDIDATE NUMBER. ConsultIDs: none. Reason: This candidate is unused by its CNA", with no description, no score and no references. It is not citable. The question also silently merges two distinct vulnerabilities with its slash. `errata.md` E26.
**Routed to:** `17-security.md` §17.1.3 "Transient execution — client parts included" (the CVE table and the claims beneath it) — right first time.
**Answer:** Cite **CVE-2022-29900** for **RETbleed** on AMD, and **CVE-2022-23825** for **Branch Type Confusion**. They are two different CVEs disclosed in the same bulletin, and which one you want depends on which mechanism you mean:

| CVE | Name | Bulletin | Mechanism |
|---|---|---|---|
| CVE-2022-23825 | Branch Type Confusion | AMD-SB-1037, 2022-07-12 | branch-predictor aliasing causes the wrong *branch type* to be predicted |
| CVE-2022-29900 | RETbleed | AMD-SB-1037, 2022-07-12 | mistrained return predictions give arbitrary speculative execution |

Affected parts for both rows: Athlon X4, Ryzen 2000–5000 desktop/mobile, Threadripper, and 1st/2nd Gen EPYC. AMD's remediation guidance is its "Technical Guidance for Mitigating Branch Type Confusion". AMD frames both halves as follow-ups to CVE-2017-5715 (Spectre variant 2), credits CVE-2022-29900 to Kaveh Razavi and Johannes Wikner of ETH Zurich, and states that CVE-2022-23825 was "found internally by AMD employees".

Sources exactly as the skill gives them — these are CVE facts, so the citation is the AMD bulletin and NVD, not the APM: **`[AMD-SB-1037]` `[505]`** (AMD, "AMD CPU Branch Type Confusion", severity **Medium**, published 2022-07-12, last updated 2022-07-14) and **`[520]`** (NVD record for CVE-2022-23816, REJECTED) / `[55]` NVD.
**Confidence:** high — `C:high` `V:durable`.

---

### trap-hyperv-image-name
**Premise:** none stated — a plain question. The circulating error it guards against is "Hyper-V loads `hvix64.exe` on AMD hosts" (`errata.md` E10).
**Routed to:** `16-windows-platform.md` §16.2 "The Hyper-V components on an AMD host" — right first time.
**Answer:** On an AMD host the image is **`Hvax64.exe`**. Hyper-V ships a per-architecture hypervisor binary and picks one at boot: `Hvix64.exe` on Intel, **`Hvax64.exe` on AMD**, `Hvaa64.exe` on ARM64. The loader is **`Hvloader.dll`**, invoked from the Windows boot loader, and it is what selects and starts the correct image.

**Where it is documented — the second half of the question, and the part that usually goes wrong:** ***Windows Internals, Part 2*, 7th edition** (Yosifovich, Russinovich, Solomon, Ionescu; Microsoft Press, 2021) `[46]`. It is **not** on learn.microsoft.com, so **no product-documentation citation for it exists** — do not manufacture a Microsoft Learn URL for this fact. What *is* on Microsoft Learn is the adjacent boot-configuration fact: the `hypervisorlaunchtype` BCD option, values `Off` and `Auto`, in Microsoft's boot-option reference `[474]`.

One diagnostic caveat: **both x64 images are present in `%SystemRoot%\System32` on every x64 Windows installation**, because the selection is made at boot and not at install time. Finding the Intel-build image on an AMD machine is therefore not evidence of anything, and is a common source of false "Hyper-V is misconfigured" reports.
**Confidence:** high for the image name and its sourcing — `C:high` `V:durable`. The System32 and `Hvloader.dll` details are **`C:medium`**. The chapter's open items also record that an `hvboot.sys` stage named by the pre-rebuild corpus has **no first-party source** in this corpus and is unverified — it should not be included in the boot chain.

---

### trap-enlightened-vmcb
**Premise:** incorrect as stated. Its narrow half is true — Hyper-V's *enlightened VMCS* is an Intel-side construction with no AMD analogue, because a VMCS-shaped structure in guest physical memory exists to replace VMREAD, VMWRITE and VMPTRLD, and the VMCB is *already* ordinary memory that L1 edits with loads and stores, so a memory-shaped replacement for it would replace nothing. But "**no counterpart at all**" is false: AMD has a Hyper-V enlightenment interface. This is the skill's own worked example of a plausible-reading false negative (SKILL.md, Output standards: "A negative claim needs the same evidence as a positive one").
**Routed to:** `15-nested-virtualization.md` §15.5.4 "No enlightened VMCS — but there *is* an enlightened VMCB field block" — right first time; SKILL.md names this section by number as the worked example.
**Answer:** AMD "has reserved space in the VMCB for hypervisor use, as well as an associated clean bit — **the reserved bytes are in the control section, offset 0x3E0-3FF, of the VMCB**" and "**the clean bit is bit 31**", which "must be invalidated whenever the hypervisor modifies the enlightenments area". Hyper-V uses that region through a structure named **`HV_SVM_ENLIGHTENED_VMCB_FIELDS`**, and the specification speaks throughout of "the enlightened VMCS / VMCB fields" as a **matched pair**. Source: Microsoft, *Hypervisor Top-Level Functional Specification — Nested Virtualization*, Microsoft Learn `[464]`. This is a platform fact, so it is `[no-spec]`: there is no APM anchor for it, and demanding one would produce a fabricated citation.

Linux corroborates the layout independently: its definition of the SVM control area overlays a 32-byte Hyper-V enlightenment structure onto the software-reserved region at control-area offset `3E0h`, as a union with `u8 reserved_sw[32]` `[433]`. So the real architectural difference from Intel is not absence but shape — AMD's interface **extends the existing VMCB** rather than adding a second structure to keep coherent.

One named enlightenment, with a counter-intuitive direction worth stating: setting **`EnlightenedNptTlb`** in `HV_SVM_ENLIGHTENED_VMCB_FIELDS` means that **ASID flushes no longer affect TLB entries derived from the nested page tables**, and L1 must invalidate those entries with hypercalls instead — opting in therefore *narrows* what an ASID flush covers, in exchange for not flushing NPT-derived entries on every ASID operation.
**Confidence:** high for the existence, the offset range and the clean bit — `C:high` `V:durable`. The `EnlightenedNptTlb` semantics are **`C:medium`**. All of it carries `[no-spec]` — Microsoft Learn and Linux sourcing, not AMD architecture.

---

### trap-vmgexit-encoding
**Premise:** incorrect. The `F2` form is not a transcription error — both prefixes are architectural, and AMD's instruction page prints them together. `errata.md` E22 is one of the five `[reversed]` entries: it was originally drafted as "`F3` only" and a primary-source check refuted the draft, so a secondary source asserting the `F3`-only form is the thing that is wrong.
**Routed to:** `13-sev-es-ghcb.md` §13.6.1 "VMGEXIT" — right first time.
**Answer:** VMGEXIT's opcode is **`F2/F3 0F 01 D9`**. AMD's instruction page prints both prefixes and both are architectural; do not drop the `F2`. `[APM3 §4 "VMGEXIT"]` `[2]` (AMD64 Architecture Programmer's Manual Vol.3, pub. 24594 rev 3.38 — Vol.3 Chapter 4 is ordered alphabetically and carries page numbers rather than subsection numbers, so the mnemonic form is the correct citation). The chapter reproduces the two adjacent rows of the page: *Mnemonic VMMCALL — Opcode `0F 01 D9`; Mnemonic VMGEXIT — Opcode `F2/F3 0F 01 D9`.*

Two consequences: the **unprefixed** `0F 01 D9` on the same page is **VMMCALL**, and the VMGEXIT encoding is **interpreted as VMMCALL** on processors that do not support it — including legacy processors — or when it is not executed by an SEV-ES guest. Support for VMGEXIT is indicated by `CPUID Fn8000_001F_EAX[SEV-ES] = 1`. `[APM3 §4 "VMGEXIT"]` `[2]`.
**Confidence:** high — `C:high` `V:durable`.
