# 17. Vulnerabilities, Mitigations and Measured Launch

> **中文速览**：本章有两个互不相干的主题。**§17.1–§17.4 是 CVE → 架构机制 → 可部署缓解的矩阵**，覆盖 SEV 家族、瞬态执行类、nSVM 逃逸与 AMD-SP/微码签名；每行尽可能给出可机检的缓解锚点（微码级别、SEV 固件版本与 SPL、AGESA/PI 版本、内核 commit、证明报告里的位）。**§17.5–§17.7 是 SKINIT/DRTM、APM 附录 D 的 SMM 容器化，以及勘误驱动的特性屏蔽**（OSVW、修订指南）。两条纪律贯穿全章：**CVE 永不挂 APM 锚点**——它锚到 `AMD-SB-nnnn` 公告或 NVD/论文；**CVSS 只取 NVD 或 CNA**，并逐条注明取自谁。AMD 的公告里从不印营销名（"CacheWarp"、"BadRAM"、"RMPocalypse" 都是社区叫法），所以矩阵把公告号当主键。

**Maps to:** AMD security bulletins (AMD-SB-xxxx) + per-family Revision Guides + APM Vol.2 §15.27 "Secure Startup with SKINIT" + §15.37 Speculation Control Virtualization + App.D "SMM Containerization" + App.E "OS-Visible Workarounds" [1][18]
**Owns:** §17.1–§17.4 the CVE → mechanism → mitigation matrix and the attack-surface taxonomy; §17.5–§17.7 SKINIT/DRTM, SMM containerization and the erratum-driven feature-masking discipline
**Scope:** mixed — SEV CVEs are server scope; transient-execution and nested-SVM issues apply to client parts too.
**See also:** `12-sev.md` (key hierarchy, threat model) · `13-sev-es-ghcb.md` (`#VC`, GHCB) · `14-sev-snp.md` (RMP, VMPL, attestation report) · `16-windows-platform.md` (Windows security features) · `90-dated-landscape.md` (current firmware and microcode levels) · `errata.md` (`E16`, `E17`, `E20`, `E23`, and open conflict `O2`)

---

## 17.1 The CVE matrix

### 17.1.1 How to read a row, and what an anchor may be

A row is only useful if a reader can check on their own machine whether it still applies. Three
rules make that possible, and all three exist because the pre-rebuild corpus broke them.

- **Claim.** A CVE is not an architectural fact and carries no APM anchor: the AMD64 Programmer's Manual documents mechanisms, not defects, so the Tier-1 anchor for a CVE is its AMD security bulletin `AMD-SB-nnnn`, and where no bulletin exists the row falls back to NVD or the disclosing paper.  `[no-spec]` `[18]` `C:high` `V:durable`
- **Claim.** AMD's bulletins never print the community name of an attack. AMD-SB-3020 is titled "SEV-SNP RMP Initialization Vulnerability", AMD-SB-3015 "Undermining Integrity Features of SEV-SNP with Memory Aliasing", AMD-SB-3005 "AMD INVD Instruction Security Notice" and AMD-SB-3027 "SEV-SNP Guest Stack Pointer Corruption Vulnerability" — "RMPocalypse", "BadRAM", "CacheWarp" and "StackWarp" appear nowhere in them, so the bulletin number, not the nickname, is the stable key.  `[no-spec]` `[18][22][21][500][502]` `C:high` `V:durable`
- **Claim.** CVSS values are taken from NVD's primary scoring (`nvd@nist.gov`) or from the assigning CNA, and the two frequently disagree: for CVE-2023-20592 AMD's own bulletin table prints **5.3 (Medium)** while NVD's primary score is **6.5 (Medium)** with vector `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`. A row that gives a score must say whose score it is.  `[AMD-SB-3005]` `[500][516]` `C:high` `V:durable`
- **Claim.** Affected parts are named by product generation (EPYC 7003 "Milan", EPYC 9004 "Genoa", EPYC 9005 "Turin", Ryzen family) and never by feature name: "affects SEV-ES" answers no deployment question, because every EPYC since Naples has SEV-ES.  `[no-spec]` `[18]` `C:high` `V:durable`

A *machine-checkable mitigation anchor* is a value software can read: a microcode patch level, a
SEV firmware version with its security patch level (SPL), an AGESA/PI package version, a Linux
commit that landed in a named release, or a bit in the attestation report. "Apply the latest BIOS"
is not one.

### 17.1.2 SEV, SEV-ES and SEV-SNP — server scope

**Server scope.** Every row in this table is an EPYC row. SEV-SNP has never been available on a
client part; what a client machine has is in `11-memory-encryption.md`.

| CVE | Community name / paper | Bulletin, published | Affected EPYC generations | Mechanism | Machine-checkable mitigation anchor |
|---|---|---|---|---|---|
| CVE-2019-9836 | — (SEV key recovery) | none; NVD 2019-06-25 | SEV firmware (AMD-SP) ≤ 0.17 build 11 | insecure cryptographic implementation in the SEV key exchange | SEV firmware newer than 0.17 build 11 |
| CVE-2020-12967 | SEVerity (WOOT'21) | AMD-SB-1004, 2021-05-11 | 1st/2nd/3rd Gen EPYC + EPYC Embedded | no nested-page-table protection under SEV/SEV-ES → code injection | none for SEV/SEV-ES; AMD's stated mitigation is SEV-SNP (3rd Gen EPYC onward) |
| CVE-2021-26311 | undeSErVed trust (WOOT'21) | AMD-SB-1004, 2021-05-11 | same | guest address space can be rearranged without attestation noticing | same |
| CVE-2021-46744 | CipherLeaks | AMD-SB-1033, 2022-05-10 | SEV | ciphertext of guest memory observable over time | see bulletin |
| CVE-2023-20592 | CacheWarp (USENIX Sec'24) | AMD-SB-3005, 2023-11-14 | 1st/2nd Gen (SEV, SEV-ES), 3rd Gen (SEV, SEV-ES, SEV-SNP) | `INVD` write-back behaviour lets a hypervisor revert guest stores | Milan µcode B1 `0x0A0011D1` / Milan-X B2 `0x0A001234`, SEV FW `1.37.10`, `TCB[SNP] ≥ 0x14`, MilanPI 1.0.0.C — apply before `SNP_INIT_EX`, re-init the RMP with `INIT_RMP = 1` |
| CVE-2024-25742 | WeSee (IEEE S&P'24) | AMD-SB-3008, 2024-04-05 | SEV-ES and SEV-SNP guests running Linux | hypervisor injects vector 29 and steers the handler | Linux commit `e3ef461af35a` "x86/sev: Harden #VC instruction emulation somewhat", released in 6.9 |
| CVE-2024-25743 | Heckler (USENIX Sec'24) | AMD-SB-3008, 2024-04-05 | same | hypervisor injects vectors 0 and 14 to reach a userspace `SIGFPE` handler | AMD names no upstream commit for this half; the hardware answer is restricted/alternate injection |
| CVE-2024-25744 | Heckler, `int80` half | AMD-SB-3008, 2024-04-05 | **Intel TDX and AMD SEV** | untrusted VMM triggers `int80` syscall handling | Linux commit `b82a8dbd3d2f` "Disable 32-bit emulation by default on TDX and SEV", released in 6.6.7 |
| CVE-2024-21944 | BadRAM (IEEE S&P 2025) | AMD-SB-3015, 2024-12-10 | Milan, Milan-X, Genoa, Genoa-X, Bergamo, Siena | DIMM SPD metadata forged to alias physical memory | `ALIAS_CHECK_COMPLETE`: attestation-report `PLATFORM_INFO` byte 0h bit 5, and `STRUCT_PLATFORM_STATUS` byte 03h bit 1; Milan PI 1.0.0.D + SEV FW 1.55.22 (hex 1.37.16) SPL = 0x17 |
| CVE-2024-56161 | EntrySign (Google) | AMD-SB-3019, 2025-02-03 | Naples through Turin | microcode patch loader accepts a forged signature | Milan µcode `0x0A0011DB` / Milan-X `0x0A001244`, SEV FW 1.55.29 (hex 1.37.1D), `TCB[SNP] = 0x18`, MilanPI 1.0.0.F |
| CVE-2025-0033 | RMPocalypse (ACM CCS 2025) | AMD-SB-3020, 2025-10-13 | Milan/Milan-X, Genoa family, Turin (Naples, Rome, EPYC 4004 not affected) | race while the AMD-SP initialises the RMP lets a hypervisor seed dirty cache lines over it | SEV FW Milan `1.37.23` SPL = 0x1B, Genoa `1.37.31` SPL = 0x1B, Turin `1.37.41` SPL = 0x04 |
| CVE-2025-29943 | StackWarp (USENIX Sec 2026) | AMD-SB-3027, 2026-01-15 | Milan/Milan-X, Genoa family, Turin | an undocumented configuration bit, set from the sibling SMT thread, corrupts the guest stack pointer | `TCB[MICROCODE] ≥ DE` (Milan B1), `≥ 47` (Milan-X), `≥ 56` (Genoa), `≥ 51` (Turin C1), `≥ 4E` (Turin Dense) |
| CVE-2025-48514 | — | AMD-SB-3023, 2026-02-10 | Milan, Siena/Genoa family, Turin | SEV firmware lets an SEV-ES guest be created so as to attack an SNP guest | SEV FW 1.37.23 / 1.37.31 / 1.37.41 — **the mitigation disables SEV-ES whenever SEV-SNP is enabled** |
| CVE-2025-48517 | — | AMD-SB-3023, 2026-02-10 | **EPYC 9005 "Turin" / "Turin Dense" only** | SEV-ES guest can be given an ASID from the range reserved for SNP guests | **SEV FW 1.37.41 only** (TurinPI 1.0.0.6, 2025-06-30) |
| CVE-2023-4155 | — | none; NVD 2023-09-13 | any host running Linux KVM with multi-vCPU SEV-ES/SEV-SNP guests | double-fetch race re-enters the `VMGEXIT` handler recursively | build with `CONFIG_VMAP_STACK` (stack guard pages) plus the KVM fix |

- **Claim.** The table above is sourced row by row to the bulletins it names plus NVD; the AMD-side rows are `AMD-SB-1004`, `1033`, `3005`, `3008`, `3015`, `3019`, `3020`, `3023` and `3027`, and the two rows with no bulletin (CVE-2019-9836, CVE-2023-4155) are NVD-only.  `[AMD-SB-3020]` `[19][22][23][500][501][502][506][511][514][515]` `C:high` `V:durable`
- **Claim.** Severities, with their source named: CVE-2019-9836 5.3 Medium (NVD), CVE-2020-12967 and CVE-2021-26311 both 7.2 High (NVD), CVE-2021-46744 6.5 Medium (NVD), CVE-2023-20592 5.3 Medium (AMD) versus 6.5 Medium (NVD), CVE-2024-25742 6.5 Medium and CVE-2024-25743 7.1 High (both Red Hat as CNA, no NVD primary), CVE-2024-25744 8.8 High (NVD primary), CVE-2024-21944 5.3 Medium (AMD), CVE-2024-56161 7.2 High (AMD), CVE-2025-0033 6.0 Medium under CVSS 3.1 and 5.9 Medium under CVSS 4.0 (AMD), CVE-2025-29943 3.2 Low under CVSS 3.1 and 4.6 Medium under CVSS 4.0 (AMD), CVE-2025-48514 4.0 Medium and CVE-2025-48517 4.6 Medium (both AMD, CVSS 4.0 only), CVE-2023-4155 5.6 Medium (NVD primary).  `[AMD-SB-3023]` `[23][510][511][512][513][514][515][516][521][523][524]` `C:high` `V:durable`
- **Claim.** CVE-2024-25744 is not an Intel-only issue: NVD's description names `arch/x86/coco/tdx/tdx.c` **and** `arch/x86/mm/mem_encrypt_amd.c`, and AMD-SB-3008 lists it beside CVE-2024-25742 and CVE-2024-25743 — see `errata.md` `E20`.  `[AMD-SB-3008]` `[20][513]` `C:high` `V:durable`
- **Claim.** The three CVEs in AMD-SB-3008 were assigned by CERT/CC, and the bulletin points at APM Vol.2 §15.36.16 "Interrupt Injection Restrictions" as the hardware feature designed to defeat the attack while noting it is "not currently supported in Linux"; the mechanism itself belongs to `14-sev-snp.md`.  `[AMD-SB-3008]` `[20]` `C:high` `V:durable`
- **Claim.** CVE-2024-25742 is WeSee's CVE and CVE-2024-25743/25744 are Heckler's, even though AMD files all three under one bulletin whose summary quotes only the Heckler paper: the WeSee authors state "WeSee is tracked under CVE-2024-25742", and the two papers are different — WeSee is IEEE S&P 2024 (Distinguished Paper), Heckler is USENIX Security 2024.  `[AMD-SB-3008]` `[20][525][526]` `C:high` `V:durable`
- **Claim.** AMD-SB-3008 carries "Potential Impact: N/A" and "Severity: N/A" — AMD assigns the bulletin no severity at all, because its position is that the defect lies in the Linux kernel implementation rather than in the hardware.  `[AMD-SB-3008]` `[20]` `C:high` `V:durable`
- **Claim.** AMD-SB-1004 is the SEVerity bulletin, not the SEVurity bulletin: it names two WOOT'21 papers, "SEVerity: Code Injection Attacks against Encrypted Virtual Machines" (Fraunhofer AISEC with TU Munich) → CVE-2020-12967, and "undeSErVed trust: Exploiting Permutation-Agnostic Remote Attestation" (University of Lübeck) → CVE-2021-26311. No paper called SEVurity appears in it; SEVurity is a separate, earlier paper with no CVE — see `errata.md` `E16`.  `[AMD-SB-1004]` `[19]` `C:high` `V:durable`
- **Claim.** The CVE-2025-48514 mitigation has a documented functional cost that a deployment must plan for: AMD-SB-3023 footnote 2 reads "Applying mitigation CVE-2025-48514 will result in disabling SEV-ES when SEV-SNP is enabled", and the mitigation spans Zen 3 (Milan), Zen 4 (Genoa/Siena) and Zen 5 (Turin) — it is not a Zen 5 generational property. See `errata.md` `E17`.  `[AMD-SB-3023]` `[23]` `C:high` `V:durable`
- **Claim.** BadRAM's mitigation is attestable from inside the guest, which makes it the cleanest machine-checkable anchor in the table: `ALIAS_CHECK_COMPLETE` "indicates that alias detection has completed since the last system reset and there are no aliasing addresses", and it resets to 0. The report structure itself is owned by `14-sev-snp.md`.  `[AMD-SB-3015]` `[21][10]` `C:high` `V:durable`
- **Claim.** Attacks that carry no CVE still belong in the record. SEVered (2018, Fraunhofer AISEC) extracts plaintext guest memory by remapping pages under a network service and has no CVE; AMD answered "ZENHAMMER: Rowhammer Attacks on AMD Zen-Based Platforms" with a Security *Brief*, AMD-SB-7021 of 2024-03-25, which also carries no CVE.  `[AMD-SB-7021]` `[18][508][531][532]` `C:high` `V:durable`

### 17.1.3 Transient execution — client parts included

**Client-relevant.** Unlike the SEV rows, everything here applies to a desktop or laptop Ryzen as
well as to EPYC.

| CVE | Community name | Bulletin, published | Affected parts | Mechanism | Machine-checkable mitigation anchor |
|---|---|---|---|---|---|
| CVE-2021-46778 | SQUIP | AMD-SB-1039, 2022-08-09 | Zen 1, Zen 2, Zen 3 with SMT | execution-unit scheduler queue contention is observable across SMT threads | disable SMT, or make the secret-dependent code constant-time |
| CVE-2022-23825 | Branch Type Confusion | AMD-SB-1037, 2022-07-12 | Athlon X4, Ryzen 2000–5000 desktop/mobile, Threadripper, 1st/2nd Gen EPYC | branch-predictor aliasing causes the wrong *branch type* to be predicted | AMD's "Technical Guidance for Mitigating Branch Type Confusion" |
| CVE-2022-29900 | RETbleed | AMD-SB-1037, 2022-07-12 | same | mistrained return predictions give arbitrary speculative execution | same |
| CVE-2023-20593 | Zenbleed | AMD-SB-7008, 2023-07-24 | **Zen 2 only** — Rome, Matisse, Renoir, Lucienne, Castle Peak, Mendocino, Embedded 7002/V2000 | a YMM register is not correctly zeroed, leaking another thread's data | EPYC 7002 µcode `0x0830107B` (2023-06-06); AGESA ComboAM4v2PI 1.2.0.C / ComboAM4PI 1.0.0.B / CezannePI-FP6 1.0.1.0 / RenoirPI-FP6 1.0.0.D |
| CVE-2023-20569 | Inception / SRSO | AMD-SB-7005, 2023-08-08 | Zen 3 and Zen 4 need the patch; AMD states Zen and Zen 2 do not, because they already flush branch-type predictions | a non-architectural `CALL` seeds the return address predictor | µcode Milan B0 `0x0A001079`, B1 `0x0A0011CF` or `0x0A0011D1`, Milan-X B2 `0x0A001234`, Genoa B1 `0x0A10113E`, Genoa-X B2 `0x0A10123E`, Bergamo A1 `0x0AA00116`; SEV FW 01.01.37.08 (3rd Gen) / 01.01.37.16 (4th Gen); AGESA MilanPI 1.0.0.C (2023-12-18), GenoaPI 1.0.0.9 (2023-07-28); Linux `/sys/devices/system/cpu/vulnerabilities/spec_rstack_overflow` |
| CVE-2024-36350, CVE-2024-36357, CVE-2024-36348, CVE-2024-36349 | Transient Scheduler Attacks (TSA) | AMD-SB-7029, 2025-07-08 | see the per-family tables in the bulletin; Naples is "Not affected" for three of the four | 36350 infers data from previous stores, 36357 from the L1D cache, 36348 leaks control registers past UMIP, 36349 leaks `TSC_AUX` | per-family Platform Initialization firmware; AMD's "Technical Guidance for Mitigating Transient Scheduler Attacks" |

- **Claim.** The table above is sourced to AMD-SB-1039, AMD-SB-1037, AMD-SB-7008, AMD-SB-7005 and AMD-SB-7029, with NVD supplying the scores where AMD's bulletin does not print one.  `[AMD-SB-7029]` `[24][503][504][505][507][517][518][519][522]` `C:high` `V:durable`
- **Claim.** Severities: CVE-2021-46778 5.6 Medium (NVD), CVE-2022-23825 6.5 Medium (NVD), CVE-2023-20593 5.5 Medium (NVD), CVE-2023-20569 4.7 Medium (NVD), CVE-2024-36350 and CVE-2024-36357 both 5.6 Medium and CVE-2024-36348 and CVE-2024-36349 both 3.8 Low (all four AMD, with no NVD primary score).  `[AMD-SB-7029]` `[24][517][518][519][522]` `C:high` `V:durable`
- **Claim.** AMD's Branch Type Confusion bulletin covers two CVEs and states the identity explicitly as "CVE-2022-29900 (RETbleed) (aka CVE-2022-23816)"; **NVD has since REJECTED CVE-2022-23816** with the note "This candidate is unused by its CNA", so the citable identifier for the AMD RETbleed variant is **CVE-2022-29900**.  `[AMD-SB-1037]` `[505][520]` `C:high` `V:durable`
- **Claim.** Both halves of AMD-SB-1037 are framed by AMD as follow-ups to CVE-2017-5715 (Spectre variant 2), and AMD credits CVE-2022-29900 to Kaveh Razavi and Johannes Wikner of ETH Zurich while stating CVE-2022-23825 was "found internally by AMD employees".  `[AMD-SB-1037]` `[505]` `C:high` `V:durable`
- **Claim.** AMD-SB-7029 records where TSA came from: AMD found it "while investigating a Microsoft report titled 'Enter, Exit, Page Fault, Leak: Testing Isolation Boundaries for Microarchitectural Leaks'".  `[AMD-SB-7029]` `[24]` `C:high` `V:durable`

### 17.1.4 Hypervisor-side escapes and platform issues

| CVE | Layer | Bulletin / source | Mechanism | Fix |
|---|---|---|---|---|
| CVE-2021-3653 | Linux KVM (nested SVM) | none; NVD 2021-09-29 | the interrupt-control field of a guest-supplied VMCB was copied through unvalidated | fixed before Linux 5.14-rc7 |
| CVE-2021-3656 | Linux KVM (nested SVM) | none; NVD 2022-03-04 | the `virt_ext` field (AMD's name for the same location is VMCB offset 0B8h) was copied through unvalidated | commit `c7dfa4009965` |
| CVE-2021-29657 | Linux KVM (nested SVM) | none; NVD 2021-07-22 | TOCTOU double fetch of VMCB12 in `nested_svm_vmrun` → use-after-free | commit `a58d9166a756`, released in 5.10.28 and 5.11.12 |
| CVE-2024-36347 | AMD microcode loader | AMD-SB-7033, 2025-03-05 | microcode signature verification | see bulletin |

- **Claim.** CVE-2021-29657's NVD primary score is **7.4 (High)** with vector `CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H`, scored by `nvd@nist.gov`; the 7.8 figure that circulates is not an NVD value — see `errata.md` `E23`.  `[510]` `C:high` `V:durable`
- **Claim.** CVE-2021-3653 and CVE-2021-3656 both carry NVD primary 8.8 (High), `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`; the nested-SVM field-validation analysis behind them is owned by `15-nested-virtualization.md` and is not repeated here.  `[430][431]` `C:high` `V:durable`
- **Claim.** EntrySign spans two bulletins rather than one: AMD-SB-3019 "AMD SEV Confidential Computing Vulnerability" (CVE-2024-56161, 7.2 High, AMD) and AMD-SB-7033 "AMD CPU Microcode Signature Verification Vulnerability" (CVE-2024-36347, published 2025-03-05); AMD-SB-3019 also warns that once its PI version is installed "microcode cannot be hot-loaded" below the listed level and that attempting it on an older BIOS raises `#GP`.  `[AMD-SB-3019]` `[501][509][530]` `C:medium` `V:durable`

### 17.1.5 The SEV literature read as one sequence

The SEV rows are not a scatter of independent bugs. Read in order they are a single argument being
worked out in public, and knowing the order tells a reader which mitigations subsume which.

**Phase 1 — no integrity (2018–2021).** SEV and SEV-ES encrypt guest memory but do not protect its
*mapping*, so a hypervisor can move ciphertext around. SEVered reads plaintext out by remapping
pages under a network service; SEVerity injects code the same way; undeSErVed trust shows the
attestation cannot notice the rearrangement.

**Phase 2 — SEV-SNP answers phase 1, and the attack surface moves (2022–2024).** With the reverse
map table enforcing the mapping, research moves to what SNP still does not cover: the ciphertext
itself (CipherLeaks), cache write-back behaviour (CacheWarp), and the one channel the guest must
keep open to a hostile hypervisor — exceptions and interrupts (Heckler, WeSee).

**Phase 3 — the trusted base itself (2024–2026).** The most recent work attacks the things SNP
takes as given: the DRAM geometry the firmware trusts (BadRAM), the microcode signature chain
(EntrySign), the RMP's own initialisation window (RMPocalypse), and undocumented pipeline
configuration reachable from a sibling thread (StackWarp).

- **Claim.** AMD's answer to phase 1 is stated as a product boundary rather than a patch: AMD-SB-1004's mitigation section says the mitigation "requires the use of SEV-SNP, which is only supported on 3rd Gen AMD EPYC", and for earlier EPYC recommends "following security best practices" — that is, CVE-2020-12967 and CVE-2021-26311 have no fix on Naples or Rome.  `[AMD-SB-1004]` `[19]` `C:high` `V:durable`
- **Claim.** CacheWarp is the clearest phase-2 example of "confidentiality held, integrity did not": the paper — "CacheWarp: Software-based Fault Injection using Selective State Reset", USENIX Security 2024 — reverts a guest's data modifications at single-store granularity, which is enough to restore an old return address on the stack or an old value of a security-critical variable without ever decrypting anything.  `[AMD-SB-3005]` `[500][527]` `C:high` `V:durable`
- **Claim.** StackWarp's authors give the mechanism AMD's bulletin leaves as "an undocumented MSR bit": they describe a synchronisation failure in the stack engine, driven by toggling bit 19 of MSR `0xC0011029` from the sibling hyperthread, which withholds and then releases an attacker-chosen offset into the victim guest's stack pointer. They state the underlying behaviour is present on Zen 1 through Zen 5, whereas AMD-SB-3027 lists only Milan through Turin as affected *products*.  `[AMD-SB-3027]` `[502][528]` `C:medium` `V:durable`
- **Claim.** The phase-3 attacks are also where AMD's own severities are lowest — 5.3, 6.0, 3.2 — because each needs administrator privilege on the host, physical access, or both; the scores measure incremental privilege, not how much of the confidential-computing promise is voided. RMPocalypse's authors describe the result as compromising "all confidential computing guarantees" while AMD rates it Medium, and both statements are correct under their own scales.  `[AMD-SB-3020]` `[22][529]` `C:high` `V:durable`
- **Claim.** The threat model that makes these severities legible — a malicious or compromised hypervisor is *in scope* for SEV-SNP and *out of scope* for SEV and SEV-ES memory integrity — is owned by `12-sev.md`, and the mechanisms that implement it by `14-sev-snp.md`; this chapter classifies findings against that model rather than restating it.  `[no-spec]` `[17]` `C:medium` `V:durable`

### 17.1.6 What this matrix deliberately does not hold

- **Claim.** "Which firmware level should I be on today" is a dated fact and lives in `90-dated-landscape.md`; this chapter records only "the fix was introduced at X", which stays true. Likewise, the performance cost of any mitigation belongs to `18-performance.md`.  `[no-spec]` `[18]` `C:high` `V:durable`
- **Claim.** The matrix is a sample of an index, not the index: AMD's public bulletin list holds well over a hundred CPU-side entries, including several SEV items this chapter does not expand — AMD-SB-3007 (CVE-2023-31346, CVE-2023-31347), AMD-SB-3029 (CVE-2025-29934, stale TLB entry), AMD-SB-3034 (CVE-2025-54510, SEV-SNP routing misconfiguration) and Security *Briefs* with no CVE at all such as AMD-SB-3021, AMD-SB-3024 and AMD-SB-3036. Read the index before concluding an attack is unanswered.  `[18]` `C:high` `V:durable`

## 17.2 Attack-surface taxonomy: hardware, firmware, hypervisor

Attributing a defect to the wrong layer is how a row becomes unactionable: the fix channel,
the attestation evidence and the party who ships the patch are all different per layer.

| Layer | Who fixes it | What the fix looks like | Rows above |
|---|---|---|---|
| AMD silicon | AMD, via microcode or a hardware revision | a microcode patch level; or a Revision Guide erratum with "No fix planned" and a software workaround | CacheWarp, StackWarp, Zenbleed, Inception, TSA, Branch Type Confusion, SQUIP |
| AMD-SP / SEV firmware | AMD, via SEV firmware and the PI/AGESA package | a SEV firmware version plus an SPL, reflected in the guest's attestation report | RMPocalypse, BadRAM, CVE-2025-48514/48517, CVE-2019-9836 |
| Platform firmware (BIOS/UEFI, SMM) | OEM, from AMD's PI package | an AGESA/PI version and a BIOS release | the SMM CVEs batched in AMD-SB-3023 |
| Hypervisor software | the hypervisor vendor or the kernel community | a commit in a named release | CVE-2021-3653, CVE-2021-3656, CVE-2021-29657, CVE-2023-4155, and the Linux half of Heckler/WeSee |

- **Claim.** The taxonomy is not cosmetic: a silicon fix changes `TCB[MICROCODE]`, a SEV firmware fix changes `TCB[SNP]` and the security patch level, and both appear in the SEV-SNP attestation report, whereas a hypervisor fix is invisible to attestation by construction — a confidential guest cannot verify its host's kernel version. The TCB fields themselves are owned by `14-sev-snp.md`.  `[AMD-SB-3019]` `[10][501]` `C:high` `V:durable`
- **Claim.** AMD's own bulletins mix layers within one document, so the layer must be read from the mitigation column rather than the title: AMD-SB-3023 batches SMM input-validation defects, SEV firmware access-control defects and one microcode bounds-check defect under a single "AMD EPYC™ and AMD EPYC™ Embedded Series Processor Vulnerabilities – February 2026" heading carrying **twenty distinct CVE IDs across twenty-one rows** — one ID appears twice with two different defect descriptions. The count is itself volatile: AMD revised the bulletin after first publication.  `[AMD-SB-3023]` `[23]` `C:high` `V:durable`
- **Claim.** A fourth category exists and resists all three fix channels: physical and DRAM-level attacks. BadRAM needs physical access, a non-compliant DIMM or control of the BIOS root of trust; ZenHammer needs none of AMD's cooperation to be studied; AMD's advice for BadRAM begins with "utilizing memory modules that lock SPD, as well as following physical security best practices".  `[AMD-SB-3015]` `[21][508]` `C:high` `V:durable`

### 17.2.1 Attributing a new report

When a new paper or advisory appears, four questions settle the row before any prose is written,
and they are worth asking in this order because each one narrows the next.

1. **Is there an AMD bulletin?** Search the product-security index by title, not by nickname — AMD titles describe mechanisms ("SEV-SNP RMP Initialization Vulnerability"), so a nickname search finds nothing.
2. **Is it a bulletin or a brief?** AMD publishes *Security Briefs* for research it has assessed as needing no product change; these carry "N/A" in the CVE column and are the correct citation for an attack with no CVE.
3. **Which layer ships the fix?** Read the mitigation column, not the summary. A row whose mitigation is a PI/AGESA version is a firmware row even if the paper is about silicon behaviour.
4. **Is the score AMD's, NVD's or a third CNA's?** For Linux-reported issues the CNA is frequently Red Hat, and NVD may never publish a primary score at all.

- **Claim.** The bulletin-versus-brief distinction is load-bearing and visible in the index: AMD-SB-7021 (ZenHammer), AMD-SB-3021 (SEV ciphertext side channels), AMD-SB-3024 (SEV-SNP physical memory aliasing) and AMD-SB-3036 (physical address bit leakage on SEV-SNP systems) are all Security Briefs with "N/A" in the CVE column, while AMD-SB-3020 and AMD-SB-3027 are Security Bulletins with CVEs and firmware tables.  `[18]` `C:high` `V:durable`
- **Claim.** Two of the rows in §17.1.2 have no NVD primary score at all — CVE-2024-25742 and CVE-2024-25743 are scored only by the assigning CNA — so "the NVD score" is not always an available answer and a row must name whichever source it used.  `[511][512]` `C:high` `V:durable`

## 17.3 Transient execution on AMD

The architectural surface that mitigations are programmed through is documented, even though the
defects are not. Three registers and one VMCB control carry almost all of it.

- **Claim.** The two architectural speculation-control MSRs are `SPEC_CTRL` (MSR 048h) and `PRED_CMD` (MSR 049h); a `WRMSR` to either does not serialize memory operations but is dispatch-serializing, preventing younger instructions from executing until it completes.  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** In `SPEC_CTRL`, bit 0 is `IBRS` (enumerated by `Fn8000_0008_EBX[IBRS]`, bit 14), bit 1 is `STIBP` (bit 15), bit 2 is `SSBD` (bit 24) and bit 7 is `PSFD` (bit 28); setting `IBRS` automatically enables `STIBP` behaviour regardless of the `STIBP` bit.  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** `VIRT_SPEC_CTRL` (MSR C001_011F) exists only as a legacy path: on processors that report `Fn8000_0008_EBX[SsbdVirtSpecCtrl]` (bit 25), `SSBD` is enabled through `VIRT_SPEC_CTRL` bit 2 instead, and where both registers exist AMD states that "it is preferred that software uses `SPEC_CTRL[SSBD]`".  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** Some parts need no `SSBD` at all, reported by `Fn8000_0008_EBX[SsbdNotRequired]` (bit 26) — so an SSBD-setting hypervisor must probe rather than assume, exactly as `01-svm-intro.md` requires for every other feature bit.  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** `PRED_CMD` is write-only; bit 0 is `IBPB`, and bit 7 is `SBPB` (Selective Branch Prediction Barrier, enumerated by `Fn8000_0021_EAX[SBPB]`, bit 27), which additionally clears the return address predictor when `Fn8000_0008_EBX[IBPB_RET]` (bit 30) is 1. Writing both `IBPB` and `SBPB` performs an `IBPB`.  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** The full MSR list is APM Vol.2 Table A-11 "Speculation Control MSRs".  `[APM2 Table A-11]` `[1]` `C:high` `V:durable`

### 17.3.1 How the hypervisor virtualizes it

- **Claim.** SVM implements a host `SPEC_CTRL` and a guest `SPEC_CTRL`, enumerated by `Fn8000_000A_EDX[SpecCtrl]` (bit 20). `VMRUN` loads the guest value from the VMCB or the VMSA, `#VMEXIT` saves it back and leaves only the host value in effect, and "for most guests, processor behavior is controlled by the logical OR of the two registers".  `[APM2 §15.37.1]` `[1]` `C:high` `V:durable`
- **Claim.** The OR rule has one documented exception: for SNP-active guests with BTB isolation enabled, the host `IBRS` value — whether set through `SPEC_CTRL[IBRS]` or through `EFER[AIBRSE]` — does not affect the guest `IBRS`. BTB isolation itself is `14-sev-snp.md` material (APM Vol.2 §15.36.17).  `[APM2 §15.37.1]` `[1]` `C:high` `V:durable`
- **Claim.** Automatic IBRS is a separate enable: `EFER` bit 21 `AIBRSE`, enumerated by `Fn8000_0021_EAX[AutomaticIBRS]` (bit 8), gives IBRS protection to the listed privileged contexts without `SPEC_CTRL[IBRS]` being set.  `[APM2 §3.2.9]` `[1]` `C:high` `V:durable`
- **Claim.** ERAPS virtualization, enumerated by `Fn8000_0021_EAX[ERAPS]` (bit 24), gives the hypervisor two controls in the VMCB at offset 58h: bit 40 `ALLOW_LARGER_RAP` (0 forces the guest return address predictor to 32 entries; 1 gives the default `Fn8000_0021_EBX[RapSize]`, which is always ≥ 32) and bit 41 `CLEAR_RAP` (clears the predictor on `VMRUN`). The field layout is owned by `02-vmcb.md`.  `[APM2 §15.37.2]` `[1]` `C:high` `V:durable`
- **Claim.** On Linux the SRSO mitigation state is readable at `/sys/devices/system/cpu/vulnerabilities/spec_rstack_overflow` and selectable with `spec_rstack_overflow=`; the default is "Mitigation: Safe RET", the `ibpb-vmexit` option addresses the guest-to-host direction only, and a machine reporting `SRSO_USER_KERNEL_NO` switches automatically because the user/kernel boundary is no longer affected. This is a Linux-only control.  `[533]` `C:high` `V:durable`
- **Claim.** Microcode is a precondition, not an alternative: the kernel's own SRSO document opens with "it is required that the latest microcode be loaded for mitigations to be effective", and the sysfs file has distinct "Vulnerable: No microcode" and "Vulnerable: Safe RET, no microcode" states to say so.  `[533]` `C:high` `V:durable`

### 17.3.2 What is and is not the guest's problem

- **Claim.** The split of responsibility is architectural rather than conventional. Because the processor keeps host and guest `SPEC_CTRL` separately and ORs them for most guests, a guest that sets `IBRS` or `SSBD` for itself gets that protection even on a host that has not set it — but it cannot *clear* a control the host has set, which is the point of the OR.  `[APM2 §15.37.1]` `[1]` `C:high` `V:durable`
- **Claim.** Conversely, nothing a guest programs mitigates the cross-thread cases: SQUIP, the SMT half of the SRSO exploit chain and StackWarp all depend on a sibling logical processor, so the deployable answers are scheduling policy or disabling SMT, both of which are host decisions.  `[AMD-SB-1039]` `[502][507]` `C:medium` `V:durable`
- **Claim.** SNP-active guests have one extra lever the manual documents as a guest-selectable feature: `IbpbOnEntry`, `SEV_FEATURES` bit 21, enumerated by `Fn8000_001F[IbpbOnEntry]` (bit 31), makes hardware write `PRED_CMD[IBPB] = 1` before executing guest instructions on entry; the feature set it belongs to is owned by `14-sev-snp.md`.  `[APM2 §15.36.17]` `[1]` `C:high` `V:durable`

## 17.4 Escapes in the nested SVM path

The three KVM CVEs in §17.1.4 share one shape, and it is worth stating once because it predicts
where the next one will be.

- **Claim.** All three failures are the same class: a field of the guest-supplied VMCB was consumed without being validated or was re-read after validation. CVE-2021-3653 let L1 turn on interrupt-controller acceleration for L2, CVE-2021-3656 let L1 clear the `VMLOAD`/`VMSAVE` intercepts together with the virtualization enable, and CVE-2021-29657 was a double fetch of the same structure between check and use. The field-by-field rules that prevent this are owned by `15-nested-virtualization.md`.  `[430][431][510]` `C:high` `V:durable`
- **Claim.** CVE-2023-4155 is the SEV-ES analogue on the other side of the trust boundary: a multi-vCPU guest can re-enter the host's `VMGEXIT` handler recursively through a double fetch, overflowing the host kernel stack; the guest-side protocol is owned by `13-sev-es-ghcb.md`.  `[514]` `C:high` `V:durable`
- **Claim.** The structural lesson is that a nested hypervisor's inputs are attacker-controlled memory that can change under it, so every consumed field needs a single read into private storage followed by validation — not validation in place.  `[no-spec]` `[430][514]` `C:medium` `V:durable`

## 17.5 Measured launch: SKINIT and the SLB

`SKINIT` is AMD's dynamic root of trust for measurement. It re-initialises one processor into a
known state, hands a small image to a TPM for measurement, and jumps into it — with interrupts
globally masked so the sequence cannot be interrupted. The instruction encoding, its `#UD`
conditions and its CPUID gating are owned by `04-world-switch.md` and `01-svm-intro.md`; this
section owns the protocol around it.

### 17.5.1 The secure loader block

- **Claim.** The secure loader block (SLB) is a **64-Kbyte range of physical memory at any 64-Kbyte-aligned address below 4 Gbyte**; the SL image must already be loaded at offset 0 in it before `SKINIT` executes, and the physical address of the SLB is `SKINIT`'s only input operand, in EAX.  `[APM2 §15.27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The SL image's first 16-bit word is the entry point as an unsigned offset into the image and the second 16-bit word is the image length in bytes; **the maximum length is 65535 bytes**, and the digital-signature hash must cover both fields.  `[APM2 §15.27.2]` `[1]` `C:high` `V:durable`
- **Claim.** `SKINIT` sets ESP to `EAX + 10000h`, so the space between the end of the SL image and the end of the SLB is available to the secure loader as scratch and initial stack before any DEV protection has been established; the amount needed is what caps the usable image size in practice.  `[APM2 §15.27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The secure loader must be written to run in flat 32-bit protected mode with paging disabled, and AMD recommends deriving a base address from EAX so the SL code is position-independent.  `[APM2 §15.27.3]` `[1]` `C:high` `V:durable`
- **Claim.** The SLB layout is given as a figure, not only as prose.  `[APM2 Figure 15-14]` `[1]` `C:high` `V:durable`

### 17.5.2 The eight steps, in AMD's order

- **Claim.** APM Vol.2 §15.27.6 numbers the operation in eight steps: (1) re-initialise processor state as for INIT and enter flat 32-bit protected mode with paging off; (2) form the SLB base by clearing bits 15:0 of EAX and enable `SL_DEV` over the 64-Kbyte region; (3) on a multiprocessor, perform the interprocessor handshake of §15.27.8; (4) read the SL image and transmit it to the TPM in a manner software cannot emulate; (5) signal the TPM to complete the hash and verify the signature; (6) **clear the Global Interrupt Flag**; (7) set ESP to SLB base + 65536; (8) add the 16-bit entry-point offset to the SLB base and jump to it.  `[APM2 §15.27.6]` `[1]` `C:high` `V:durable`
- **Claim.** In step 1, CS is loaded with selector 8h read/execute and SS with selector 10h read/write expand-up, both with base 0 and limit 4G; **DS, ES, FS and GS are left as 16-bit real-mode segments** and the SL must reload them before use, which is why initialised data in the SLB is referenced through an SS segment override until DS is reloaded.  `[APM2 §15.27.6]` `[1]` `C:high` `V:durable`
- **Claim.** Also in step 1: all general-purpose registers are cleared except EAX (SLB base), EDX (family/model/stepping) and ESP; cache contents and the x87/SSE control registers survive; most MSRs retain their values but **EFER is cleared**; and `VM_CR.DPD`, `VM_CR.R_INIT` and `VM_CR.DIS_A20M` are **unconditionally set to 1**.  `[APM2 §15.27.6]` `[1]` `C:high` `V:durable`
- **Claim.** `SL_DEV` is not the DEV: the host bridge holds a hidden `SL_DEV_BASE` register covering one 64-Kbyte-aligned 64-Kbyte region, and while `SL_DEV_EN` is 1 that region is protected from external access and from all access through GART-translated addresses, and the mechanism additionally blocks all device access to PCI configuration space.  `[APM2 §15.24.8]` `[1]` `C:high` `V:durable`
- **Claim.** The TPM used by `SKINIT` is a discrete device on the LPC link off the system I/O hub; it recognises the special `SKINIT` bus transactions, which exist precisely so that the TPM can distinguish true execution of a secure loader from software emulation of it.  `[APM2 §15.27.4]` `[1]` `C:high` `V:durable`
- **Claim.** The transfer is one-way: `SKINIT` does not wait for a TPM response and "initiates execution of the Secure Loader unconditionally" — the TPM's verdict constrains what the SL and security kernel can later unseal, not whether the SL runs.  `[APM2 §15.27.6]` `[1]` `C:high` `V:durable`
- **Claim.** `SKINIT` does not honour instruction or data breakpoint traps or `EFLAGS.TF` trace traps, and it disables implementation-specific hardware debug features; a debug build of an SL re-enables them by clearing `VM_CR.DPD` on entry.  `[APM2 §15.27.6]` `[1]` `C:high` `V:durable`

**A Vol.2 / Vol.3 discrepancy worth knowing.** The two volumes disagree about *where* the GIF is
cleared relative to the TPM transfer, and any implementation or teaching material has to pick one.

- **Claim.** APM Vol.2 §15.27.6 places "Clear the Global Interrupt Flag" at **step 6, after** reading the SL image to the TPM (step 4) and signalling the TPM to complete the hash (step 5). The Vol.3 `SKINIT` Action pseudocode places `GIF = 0` **before** "Copy the SL image to the TPM for attestation". Both are current (Vol.2 Rev 3.45, Vol.3 Rev 3.38, both 2026-07); AMD has not reconciled them.  `[APM2 §15.27.6]` `[APM3 §4 "SKINIT"]` `[1][2]` `C:high` `V:durable`
- **Claim.** The observable consequence is small but real: with the Vol.2 ordering an SMI or NMI can still be taken during the TPM transfer, and with the Vol.3 ordering it cannot. Vol.2 states separately that interrupts pending before or asserted during `SKINIT` — including SMI, INIT and NMI — are held pending until software sets GIF to 1, which is consistent with either ordering.  `[APM2 §15.27.6]` `[1]` `C:medium` `V:durable`

### 17.5.3 Abort and multiprocessor startup

- **Claim.** If the secure loader decides it cannot bring up a valid security kernel, the documented abort is to set GIF to 1 and clear the `VM_CR` MSR, restoring normal processor operation.  `[APM2 §15.27.7]` `[1]` `C:high` `V:durable`
- **Claim.** The driver that launches the SL must run on the bootstrap processor, must save processor-specific system register state for later restoration, must idle the application processors, must then send an INIT IPI to all of them and wait for the local APIC busy indication to clear; depending on implementation "a fixed delay of no more than 1000 processor cycles may be necessary" before executing `SKINIT` so that APIC INIT state is sensed reliably.  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`
- **Claim.** The startup IPI carries an 8-bit vector that supplies the upper 8 bits of a 20-bit physical address, so AP startup code must live in the lowest 1 Mbyte with its entry point at offset 0 of that page, and the APs begin executing there in 16-bit real mode.  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`
- **Claim.** The SL must ensure the integrity of the AP startup code itself — AMD's suggested method is to include it in the hashed SL image and set up DEV protection for it before copying it into place — and must avoid any further INIT IPI between the BSP's `SKINIT` and the APs' startup IPI, which would compromise AP initialisation. **APs must not execute `SKINIT`.**  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`
- **Claim.** Aborting on a multiprocessor requires two clean-up actions on every processor that responded: restore GIF and clear `VM_CR`, and for each processor with its own memory controller clear `SL_DEV_EN` in the DEV control register so the 64-Kbyte SL range becomes device-accessible again.  `[APM2 §15.27.8]` `[1]` `C:high` `V:durable`

### 17.5.4 `#SX`, and why DRTM needs it

- **Claim.** The security exception `#SX` dispatches to **vector 30**, behaves as a fault-class exception, pushes an error code whose only defined value is **1** (INIT redirection occurred), and is a contributory fault.  `[APM2 §15.28]` `[1]` `C:high` `V:durable`
- **Claim.** `#SX` exists so that an external INIT can be turned into an exception the VMM handles — its stated purpose is to let the VMM destroy sensitive information before re-issuing the INIT without redirection. Redirection is controlled by `VM_CR.R_INIT`, which `SKINIT` sets unconditionally, and INIT is gated by GIF, so a redirected INIT asserted while GIF is 0 is held until GIF becomes 1.  `[APM2 §15.28]` `[1]` `C:high` `V:durable`

### 17.5.5 Who actually uses this on a Windows PC

- **Claim.** Windows consumes AMD's DRTM through **System Guard Secure Launch**, which re-establishes trust after boot rather than relying on the static root of trust; the Windows-side requirements, enablement and the related SMM protections belong to `16-windows-platform.md`. This claim was not re-fetched from Microsoft Learn during this pass and carries the lower confidence accordingly.  `[534]` `C:medium` `V:durable`
- **Claim.** The APM never mentions a TPM PCR index. A full-text search of APM Vol.2 Rev 3.45 returns **zero** occurrences of "PCR": AMD specifies that the SL image is transmitted to the TPM and hashed, and leaves which platform configuration register receives the measurement to the TCG specifications. Any statement that SKINIT measures into PCR 17 or 18 must be sourced to TCG, not to AMD.  `[no-spec]` `[1]` `C:high` `V:durable`

## 17.6 SMM containerization

System management mode is the one privilege level a hypervisor cannot simply outrank. An SMI
suspends whatever was running, including a VMM, and hands control to firmware the VMM did not
write and cannot inspect. AMD's answer is to let the VMM *host* the SMM handler: intercept the
SMI, build a guest whose state looks exactly like an SMM entry, and run the firmware handler
inside it. The SMI intercept semantics themselves are owned by `03-intercepts.md`; Appendix D owns
the containerization model.

This matters for two reasons beyond tidiness. It is the only architected way for a VMM to keep
its own invariants across an SMI — most obviously to hide `EFER.SVME` from firmware that would
otherwise see a hypervisor running. And it is the reason platform-firmware defects keep appearing
in AMD's SEV bulletins: on a containerized platform an SMM bug is reachable from the same
hypervisor that confidential guests are being defended against.

- **Claim.** The SMM surface is a live part of the matrix, not a legacy concern: the February 2026 batch bulletin AMD-SB-3023 alone carries CVE-2025-29950 (SMM stack overwrite, 7.1), CVE-2024-36355 (SMRAM write that alters the S3 wake path, 7.0), CVE-2024-36311 (a time-of-check-to-time-of-use race in the SMM communications buffer, 4.6) and CVE-2025-0012 (overlap between the segmented reverse map table and SMM memory, 6.8) — all scored by AMD under CVSS 4.0.  `[AMD-SB-3023]` `[23]` `C:high` `V:durable`

- **Claim.** Appendix D is a single appendix with one numbered section, D.1 "SMM Containerization Pseudocode", plus an unnumbered-in-the-bookmark-tree subsection D.1.1 "Converting Simple Containerization into Secure Containerization"; because the appendix has no citable section numbering beyond its letter, everything here anchors as `App.D`.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** AMD separates two ambition levels and says so in the first paragraph: "To minimally participate in SMM activity, the VMM can implement simple containerization … VMMs that do not trust SMM code should implement secure containerization, which requires further extension of the code provided here."  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** The control flow is: set the SMM intercept in **all** guest VMCBs; on `#VMEXIT(SMI)`, emulate SMM entry and then `VMRUN` a purpose-built container with the `RSM` intercept set, repeatedly, until `#VMEXIT(RSM)`; then emulate `RSM`. Entry and exit from SMM are signalled to hardware by writing `SMM_CTL` — `ENTER+DISMISS+SMI_CYCLE` on the way in and `EXIT+RSM_CYCLE` on the way out.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** The container VMCB is built from zeroes with the `RSM`, `VMRUN` and `MSR` intercepts set and an MSR permission map that intercepts `EFER` reads and writes, because the hypervisor must shadow `EFER.SVME` and return 0 for it; the container is given its own ASID for which no TLB entries may exist.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** The container's initial state is fully specified: CS is `{(smmbase & 0x00ffff00) >> 4, 0x089B, 0xffff_ffff, smmbase}` and ES/SS/DS/FS/GS are `{0x0000, 0x0893, 0xffff_ffff, 0x0000_0000}`; CPL = 0, EFER = 0x1000 (SVME = 1), CR4 = 0, DR7 = 0x0000_0400, RFLAGS = 0x0000_0002 and RIP = 0x0000_8000, with CR0 copied from the guest but bits 0, 2, 3 and 31 cleared. Fourteen general-purpose registers — all but RAX and RSP — are copied across.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** The SMM save area is at physical `smmbase + 0xfe00`, `smmsave.smm_revision` is written as `0x30064`, and the emulated `RSM` must perform the Vol.3 `RSM` consistency checks — except the one disallowing `CR0.PG = 1` with `CR0.PE = 0` — expecting SMM revision `0x0003_0064`; a native `RSM` failing those checks would shut the processor down, so the hypervisor must decide for itself whether to destroy the guest or shut down.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** I/O restart is the fiddly part: the pseudocode reconstructs the restart state from the upper doubleword of the guest's exit-information field and from the faulting address, choosing RDI as the index register for `IN`-type string operations and RSI for `OUT`-type, masking by the address size and negating the operand size when `RFLAGS.DF` is set. The exit-information encodings themselves are owned by `05-exit-decoding.md`.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** Going from simple to *secure* containerization means four additional things: restrict the handler's I/O ports through the I/O permission map, restrict its MSRs through the MSR permission map, run it in paged real mode behind a page table that limits reachable memory, and optionally conceal the guest's general-purpose and floating-point register contents from it.  `[APM2 App.D]` `[1]` `C:high` `V:durable`
- **Claim.** Containerization can be taken away from the hypervisor by firmware: SMM-Lock lets platform firmware prevent SMI from being intercepted at all, through `HWCR` bit 0 (`SmmLock`, MSR C001_0015h), which once set cannot be cleared by software except through the write-only `SMM_KEY` MSR (C001_0119h) or a processor reset, and which is **not affected by INIT or `SKINIT`**.  `[APM2 §15.32]` `[1]` `C:high` `V:durable`
- **Claim.** The parallel lock on the virtualization side is SVM-Lock: `SVM_KEY` (C001_0118h) is write-only, reads return zero, and if the key is zero while `VM_CR.LOCK` is set then `LOCK` can only be cleared by a processor reset — a firmware-level way to deny SVM to the operating system entirely. The `VM_CR` bit definitions belong to `01-svm-intro.md`.  `[APM2 §15.31.1]` `[1]` `C:high` `V:durable`

## 17.7 Erratum-driven feature masking

AMD has no documentation-errata channel, and its only public *silicon* errata documents cover
EPYC. That asymmetry decides how a feature may be tested for.

- **Claim.** AMD publishes no equivalent of Intel's "SDM Documentation Changes": corrections to the APM are folded silently into the next revision and recorded only in the volume's own Revision History table.  `[no-spec]` `[1]` `C:high` `V:durable`
- **Claim.** The closest thing to an errata channel is the per-family Revision Guide, and **every public one is for EPYC**: 55449 and 56323 (Family 17h), 57095 (Family 19h Models 10h–1Fh, Rev 1.05, 2025-11), 57926 (19h A0h), 58251 (Family 1Ah Models 00h–0Fh, Rev 1.30, 2025-07) and 58730 (1Ah 10h–1Fh). **Client Ryzen — Vermeer, Raphael, Phoenix, Strix — has no public revision guide and no public PPR**, so a client erratum claim must say that no AMD document records it rather than cite one that does not exist.  `[RevGuide 57095 p.5]` `[25][27]` `C:high` `V:durable`

### 17.7.1 The erratum process, as AMD describes it

Appendix E is not a list of errata — it is a description of the *process*, and reading it explains
why a workaround must be conditional rather than permanent.

- **Claim.** AMD states the intent up front: OS-visible workarounds "are provisional and should be removed or disabled when the erratum is corrected in a subsequent hardware release". A workaround that a driver applies unconditionally is a defect in the driver, not a safety margin.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** The published process has seven steps: AMD assigns an OSVW ID and tells OS vendors the starting range of affected models plus a suggested workaround; AMD works with firmware vendors and OEMs to add the new status bit for affected silicon revisions and increment `OSVW_ID_Length` by one; OS vendors schedule the workaround; the OS first compares the erratum's OSVW ID with `OSVW_ID_Length`; if the ID is greater or equal, the firmware does not know the erratum and the OS falls back to the model ID; if it is less, the OS applies the workaround only when the status bit is set; and once AMD fixes the erratum in silicon, updated firmware clears that status bit so the workaround stops being applied.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** Two consequences follow directly. First, `OSVW_ID_Length` is a *firmware* property, so the same processor can report different lengths before and after a BIOS update. Second, OSVW IDs and their bit positions "are global across all AMD processors" and are never re-used, which is what makes a workaround written once safe to carry forward.  `[APM2 App.E]` `[1]` `C:high` `V:durable`

### 17.7.2 OSVW: the architected way to ask

- **Claim.** The OS-Visible Workaround mechanism exists precisely so software need not infer erratum status from the model number: support is reported by `Fn8000_0001_ECX[OSVW]` (bit 9), each OS-visible erratum gets a globally unique OSVW ID that is never re-used, and the status bit vector lives in the MSR bank starting at **C001_0140h**.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** `OSVW MSR0` holds `OSVW_ID_Length` in bits 15:0, and the status vector is read as `MSR address = OSVW_MSR0 + 1 + floor(OSVW_ID / 64)`, bit `OSVW_ID mod 64`; a status bit of 1 means "hardware contains the erratum, apply the workaround" and 0 means "hardware has corrected it — if a workaround is installed, it must be disabled".  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** The fallback rule is explicit and is the only place where model-number inference is sanctioned: if an erratum's OSVW ID is greater than or equal to `OSVW_ID_Length`, the running firmware does not know about that erratum and the OS must compare the processor model ID against the starting model AMD supplied.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** The OSVW MSRs are read-only to the operating system — "the OS should never write into these registers" — while platform firmware may write them, which is why a firmware update can retire a workaround without any OS change.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** The Revision Guides pin the value: for Family 19h Models 10h–1Fh, "system software shall program the `OSVW_ID_Length` to 0005h prior to hand-off to the OS", with `OSVW_ID_Length` in MSR C001_0140h and the status vector in C001_0141h.  `[RevGuide 57095 p.8]` `[27]` `C:medium` `V:durable`

### 17.7.3 Worked examples, and why per-bit probing is the only safe rule

- **Claim.** Erratum 1458 for Family 19h Models 10h–1Fh, "Processor May Fail to Accelerate Guest Access to Extended Interrupt Local Vector Table Registers", applies with AVIC enabled on parts that report bit 27 of `Fn8000_000A_EDX`; the processor generates a `#VMEXIT(fault)` on guest reads instead of accelerating them, and on writes instead of the expected `#VMEXIT(trap)`. The suggested workaround is to program `MSRC001_10E6[32]` to 0b, and the guide says **"No fix planned"**. The AVIC mechanism is owned by `07-virtual-interrupts-avic.md`.  `[RevGuide 57095 erratum 1458]` `[27]` `C:high` `V:durable`
- **Claim.** Erratum 1579 for Family 1Ah Models 00h–0Fh, "Guest vAPIC … IRR … Backing Page May Be Corrupted", applies when Secure AVIC is enabled in a guest; the effect is that the "guest may miss an interrupt, or fail to clear an interrupt", the workaround is left to system software, and it too is marked **"No fix planned"**.  `[RevGuide 58251 erratum 1579]` `[25]` `C:high` `V:durable`
- **Claim.** Two more SEV-SNP errata in the Family 19h guide show the same pattern of a workaround that constrains the hypervisor rather than a fix: erratum 1465 hangs a core if an SNP guest with SMT protection executes `HLT` while the hypervisor does not intercept it — AMD's "Potential Effect on System" is "None expected. Hypervisors are expected to intercept HLT" — and erratum 1467 raises an unexpected `#PF` when the hypervisor writes a 2M or larger page that contains an SVM structure (a VMCB, a VMSA or an AVIC backing page) allocated on a 2M boundary. The workaround is to use 4K mappings in such regions or to avoid 2M-aligned SVM allocations. Both are "No fix planned"; the AVIC structure is `07-virtual-interrupts-avic.md`.  `[RevGuide 57095 erratum 1465]` `[RevGuide 57095 erratum 1467]` `[27]` `C:high` `V:durable`
- **Claim.** The operational rule that falls out: because firmware can clear a single CPUID feature bit to hide an errant feature, and because AMD's `Fn8000_000A_EDX` bits are individually meaningful, **a hypervisor must probe every feature bit it intends to use and may never infer one bit from another or from the processor generation**. This is the same discipline `01-svm-intro.md` states for the enable chain, applied to errata.  `[APM2 App.E]` `[1]` `C:high` `V:durable`
- **Claim.** The corollary for this skill's readers is a scope statement, not a hedge: on a client Ryzen there is no document that says which errata the part carries, so the only trustworthy source of "is this feature present and correct here" is CPUID plus the OSVW vector on the machine in front of you.  `[no-spec]` `[1][18]` `C:medium` `V:durable`

## 17.8 Open items

- **Erratum #1235.** The AVIC erratum cited elsewhere as the reason AVIC stayed off by default appears in **neither** locally available Revision Guide — a text search of 57095 Rev 1.05 (Family 19h Models 10h–1Fh) and 58251 Rev 1.30 (Family 1Ah Models 00h–0Fh) finds no erratum 1235. It may live in a Family 17h guide (55449 or 56323), which is not part of the local corpus. Its disclosure year remains an open conflict — see `errata.md` `O2` — and the default-state history belongs to `90-dated-landscape.md`.
- **The Vol.2 / Vol.3 GIF ordering.** §17.5.2 records the discrepancy rather than resolving it. It cannot be resolved from the manuals, and AMD has no documentation-errata channel to ask through. An implementer should treat the Vol.2 ordering as normative for the *architecture* and the Vol.3 pseudocode as an abbreviated description, but that is a judgement, not a sourced fact.
- **TPM PCR indices for SKINIT.** The APM names none (verified: zero occurrences of "PCR" in Vol.2 Rev 3.45). The TCG D-RTM Architecture specification and the PC Client Platform Firmware Profile are the right sources; neither could be retrieved during this pass, so no PCR number is asserted anywhere in this chapter.
- **System Guard Secure Launch details.** learn.microsoft.com was unreachable during this pass, so §17.5.5 carries a single `C:medium` claim and defers the substance to `16-windows-platform.md`, which should verify the page title, the AMD hardware prerequisites and the enablement path directly.
- **CVE-2024-25743's fix.** AMD-SB-3008 names upstream commits `f35e46631b28` and `e3ef461af35a`, and NVD attaches `e3ef461af35a` to CVE-2024-25742 and `b82a8dbd3d2f` to CVE-2024-25744. No commit is attached to CVE-2024-25743 by either source; whether one exists upstream is unresolved here.
- **StackWarp's generational reach.** AMD-SB-3027 lists only Milan through Turin as affected products, while the authors' site states the underlying stack-engine behaviour is present on Zen 1 through Zen 5. Both statements can be true — AMD's product table is about SEV-SNP exposure — but the wider claim is not confirmed by an AMD document.
- **Bulletins summarised from the index only.** The rows in §17.1.5 (AMD-SB-3007, 3021, 3024, 3029, 3034, 3036) are taken from AMD's bulletin index table rather than from each bulletin's own page. Anyone expanding one of them into a matrix row must read the bulletin first.
