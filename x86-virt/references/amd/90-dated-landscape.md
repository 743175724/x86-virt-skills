# 90. Dated Landscape

> **中文速览**：**时效隔离区。本文件里的每一条都会过期。** 架构章承诺"明年仍然为真"，这里不承诺。所有 `V:dated` 的断言只能出现在这个文件里，lint 强制。本章收纳：EPYC/Ryzen 代际与产品状态、SEV 固件与文档修订、内核/QEMU/libvirt/工具链的合入版本、云厂商可用性、AVIC 默认开关的演进史、以及尚未落地的路线图项。**使用前必须以官方来源复核**——本章给出的每个 URL 都是可复核入口，不是结论。

**As of 2026-09-21.** Every statement below is a snapshot taken on that date. Re-verify against the cited source before acting on any version number, date, SKU, region or price.

**Maps to:** nothing normative — this file exists so the architecture chapters can stay true.
**Owns:** every fact with a date, a version, a SKU, a price, a market share or a roadmap position; the AVIC default-state history
**Scope:** dated snapshot
**See also:** every chapter (this file holds their volatile halves) · `errata.md` (open conflicts `O1` and `O2` are discussed here)

---

## 90.1 As-of date and how to use this file

Three rules govern this chapter.

1. **`V:dated` is legal only here.** `tools/lint.mjs` rejects a `V:dated` claim in any other file. That is the whole mechanism: a fact with an expiry date cannot leak into a chapter that promises durability.
2. **No APM anchors.** This chapter is outside the `01`–`14` architecture range and its subject matter — products, dates, kernels, clouds — is not documented by the AMD64 Programmer's Manual. Attaching an APM section number to a product fact is the citation-filler failure this rebuild exists to remove. Sources here are AMD's own product and security pages, kernel.org, the projects' own repositories, and the cloud vendors' own documentation.
3. **A stated gap beats a plausible guess.** §90.8 lists everything that could not be sourced. Those entries are deliberate; do not fill them from memory.

Where a fact was established by probing a source tree at successive release tags (the technique used throughout §90.4), the claim says so. "First appears at `vX.Y`, absent at the preceding tag" is a statement about the tree, and it is what was actually checked — it is not the same as "the feature was complete in `vX.Y`", and §90.4 flags the one place where those diverge.

## 90.2 EPYC and Ryzen generations

AMD publishes one table that maps EPYC generations to SEV capabilities. Reproduced here cell-for-cell, because it is the only first-party source that names a generation and a key count in the same row — which is exactly what `errata.md` open conflict `O1` demanded before anyone states that mapping.

| AMD EPYC Server CPU Generation | New Features | New Capabilities |
|---|---|---|
| AMD EPYC 7001 | Encrypted State via confidential VMs | 128-bit AES XEX encryption · 128 threads · 15 keys |
| AMD EPYC 7002 | Encrypted CPU registers via Encrypted State (ES) | 256 Threads · 509 Keys · Enhanced scalability |
| AMD EPYC 7003 | Hypervisor isolation and guest attestation support via Secure Nested Paging (SNP) | *(empty)* |
| AMD EPYC 8004 & 9004 | Memory Encryption for CXL attached memory | Stronger 256-bit AES-XTS encryption · 512 Threads · 1006 Keys · Support for up to 63 Multi Host Keys |
| AMD EPYC 8005 | *(empty)* | Segmented RMP · Secure AVIC · Performance Counter (PMC) Virtualization · Guest Intercept Controls · Ciphertext Hiding |
| AMD EPYC 9005 | Trusted I/O via TDISP (formerly SEV-TIO) | *(shared with the 8005 row — one cell spanning both)* |
| AMD EPYC 9006 | *(empty)* | Reverse Map Table Optimizations (RMPOPT) · Enhanced AMD Secure Processor (ASAP) root of trust · Integrated Caliptra · Post Quantum computing (PQC) support (LMS only) · Physical & Side Channel Attack Mitigations |

- **Claim.** AMD's SEV developer page carries a table headed "SEV Functionality and Capabilities for Each AMD EPYC™ Server CPU Generation" whose rows are the seven generations above; the key counts it states are **15 keys for EPYC 7001, 509 Keys for EPYC 7002, and 1006 Keys for the combined "EPYC 8004 & 9004" row**. No other count appears, and EPYC 7003, 8005, 9005 and 9006 are given no key count at all.  `[35]` `C:high` `V:dated`
- **Claim.** The same table attributes **"128-bit AES XEX encryption" to EPYC 7001** and **"Stronger 256-bit AES-XTS encryption" to the "EPYC 8004 & 9004" row**; it states no encryption mode for 7002, 7003, 8005, 9005 or 9006. This is the first-party mapping that `errata.md` `E19` and `O1` were waiting for, and it resolves the encryption-mode half of `O1`: the change of mode is attached by AMD to the 8004/9004 row, not to any earlier one.  `[35]` `C:high` `V:dated`
- **Claim.** AMD's 7001 row wording is confusing on its own terms — it reads "Encrypted State via confidential VMs" for 7001 while the *next* row, 7002, reads "Encrypted CPU registers via Encrypted State (ES)". SEV-ES is the 7002 row. Quote the table, but do not read the 7001 row as attributing SEV-ES to Naples.  `[35]` `C:medium` `V:dated`
- **Claim.** In AMD's table the **EPYC 8005 and 9005 rows share a single "New Capabilities" cell** (Segmented RMP, Secure AVIC, PMC Virtualization, Guest Intercept Controls, Ciphertext Hiding), and 9005 alone adds **"Trusted I/O via TDISP (formerly SEV-TIO)"** as its New Feature. A flat reading of the page that ignores the merged cell will mis-assign those five capabilities to 8005 only.  `[35]` `C:high` `V:dated`
- **Claim.** The counts AMD prints are **"keys"**, not "ASIDs". The architectural field that a hypervisor actually reads is the CPUID leaf documented in `11-memory-encryption.md`; treat AMD's marketing count as the product statement and the CPUID value as the authority for a given part.  `[35]` `C:medium` `V:dated`

### The product matrix, keyed the way AMD keys it

AMD's SEV material identifies a generation by **EPYC series number and codename**, never by "Zen *N*". The family/model column below comes from AMD's own firmware package filenames; the codenames from AMD-SB-3023's per-generation tables; the SEV feature column from the table above. The Zen column is filled in only where a primary source names it, and is left blank otherwise rather than inferred.

| EPYC series | AMD codename | CPU family / model (from AMD's firmware package names) | What the kernel calls that family | SEV capability AMD attributes to the generation |
|---|---|---|---|---|
| 7001 | Naples | `fam17h_model01h` | family 17h — "Zen1 and Zen2" | SEV — memory encryption, 15 keys, 128-bit AES XEX |
| 7002 | Rome | `fam17h_model3xh` | family 17h — "Zen1 and Zen2" | SEV-ES — encrypted CPU registers, 509 keys |
| 7003 | Milan | `fam19h_model0xh` | family 19h | SEV-SNP — hypervisor isolation and guest attestation |
| 8004 / 9004 | Siena / Bergamo / Genoa | `fam19h_model1xh` (Genoa) | family 19h; a synthetic `X86_FEATURE_ZEN4` flag exists, but this survey did not source the Genoa↔Zen 4 equation from AMD | CXL memory encryption, 1006 keys, 256-bit AES-XTS, 63 Multi Host Keys |
| 8005 / 9005 | Turin / Turin Dense | `fam1ah_model0xh` | family 1Ah — treated as Zen 5 or later | Segmented RMP, Secure AVIC, PMC virtualization, Guest Intercept Controls, Ciphertext Hiding; 9005 adds Trusted I/O via TDISP |
| 9006 | — | — | — | RMPOPT, ASAP root of trust, Caliptra, PQC (LMS only) — announced, undated |

- **Claim.** AMD's own SEV firmware package filenames bind generation to CPU family and model: `amd_sev_fam17h_model01h_*` is labelled Naples, `fam17h_model3xh` Rome, `fam19h_model0xh` Milan, `fam19h_model1xh` Genoa and `fam1ah_model0xh` Turin. That is a first-party family/model mapping, and it is more reliable than a codename table copied from a news article.  `[35]` `C:high` `V:dated`
- **Claim.** AMD-SB-3023 gives the codenames for each EPYC series in its own headings: 7001 "Naples", 7002 "Rome", 7003 "Milan", 8004 "Siena", 9004 "Genoa" and separately 9004 "Bergamo" / "Siena", 9005 "Turin" / "Turin Dense". Note that the bulletin lists Siena under both the 8004 and a 9004 heading; treat the 8004/9004 boundary as AMD prints it rather than tidying it.  `[AMD-SB-3023]` `[23]` `C:high` `V:dated`
- **Claim.** The only Zen-generation names available from a primary source in this survey are the kernel's: mainline's AVIC code calls **Family 17h "Zen1 and Zen2"** and **Hygon Family 18h "derived from AMD Zen1"**, and its AVIC auto-mode test treats `X86_FEATURE_ZEN4` and `family >= 0x1A` as the Zen 4 and Zen 5-or-later cases. AMD's own SEV pages name no Zen generation at all.  `[610]` `[35]` `C:medium` `V:dated`

### Launch dates

Every date below is the dateline on AMD's own launch announcement, read from the announcement itself.

| Generation | Announcement dateline | Where it lives now |
|---|---|---|
| EPYC 7001 Naples | "AUSTIN, Texas 6/20/2017" | AMD press release, Internet Archive capture only — the live URL is gone |
| EPYC 7002 Rome | "SANTA CLARA, Calif. 08/07/2019" | AMD press release, Internet Archive capture only |
| EPYC 7003 Milan | "SANTA CLARA, Calif., March 15, 2021" | live on AMD's newsroom |
| EPYC 9004 Genoa | "SANTA CLARA, Calif., Nov. 10, 2022" | live on AMD's newsroom |
| EPYC 9004 Bergamo | "SANTA CLARA, Calif., June 13, 2023" | live on AMD's newsroom |
| EPYC 8004 Siena | "SANTA CLARA, Calif., Sept. 18, 2023" | live on AMD's newsroom |
| EPYC 9005 Turin | "Oct. 10, 2024 (GLOBE NEWSWIRE)" | live on AMD's investor-relations newsroom |
| EPYC 8005 | "May 19, 2026" | AMD blog, not a press release |

- **Claim.** The eight datelines above are AMD's own, read from AMD's announcement pages on the as-of date; the Naples and Rome announcements survive only as Internet Archive captures because AMD has retired the live URLs.  `[650]` `[651]` `[652]` `[653]` `[654]` `[655]` `[656]` `[657]` `C:high` `V:dated`
- **Claim.** Two of those dates are independently corroborated by AMD's per-SKU product pages, which carry a **Launch Date** field: EPYC 7763 reads **03/15/2021** and EPYC 9755 reads **10/10/2024**.  `[648]` `[649]` `C:high` `V:dated`
- **Claim.** The Turin announcement is also the source for the codename convention AMD uses in public: "5th Gen AMD EPYC™ processors, formerly codenamed 'Turin'". AMD leads with the generation number and treats the codename as historical.  `[656]` `C:high` `V:dated`
- **Claim.** AMD retires the per-SKU product pages of superseded generations: pages for representative Naples (7601), Rome (7742), Genoa (9654), Bergamo (9754) and Siena (8534P) parts all return **HTTP 404**, which is why the launch dates above come from announcements rather than from the product database.  `[648]` `C:high` `V:dated`
- **Claim.** The AMD EPYC 8005 series is described in AMD's own blog as "eight to 84, proven 'Zen 5' cores in a … 70 to 225 watt TDP, single-socket platform" — the same Zen 5 generation as the 9005 series, which is consistent with AMD's SEV table giving 8005 and 9005 a shared capability cell.  `[657]` `[35]` `C:high` `V:dated`

### Client silicon

- **Claim.** SEV is **productised on EPYC**, and that is a statement about products, not about silicon capability: measured CPUID dumps from non-PRO consumer parts (Ryzen 9 3900X, Ryzen 7 5800X3D) report `Fn8000_001F EAX[1] = 1` with 509 ASIDs, while **Zen 4 and later client parts expose SME only** and **SEV-SNP has never been set on a client part**. The durable form of this correction and its source live in `errata.md`; what belongs here is the product consequence — no AMD client SKU is sold with SEV as a supported feature, and the client memory-encryption story is TSME, covered in `11-memory-encryption.md`.  `[35]` `C:medium` `V:dated`

### AVIC on client tracks the microcode patch level, not the model

The durable architectural form — that `Fn8000_000A_EDX` bits 13 and 18 are the only two in that leaf permitted to change after reset — lives in `07-virtual-interrupts-avic.md`. What is dated is which patch level flips them.

- **Claim.** Measured on `fam1Ah_model44h`, one model and stepping across five microcode patch levels read from `MSR 0000_008B`: `0x0B40400C`, `0x0B40401A` and `0x0B404022` report AVIC = 0, while `0x0B404023` and `0x0B404035` report AVIC = 1. An AVIC availability statement about a client part must therefore name the patch level, not only the family and model — which is why a per-model lookup table keyed on CPUID alone answers this question wrong.  `[no-spec]` `[33]` `C:medium` `V:dated`

### The client errata gaps, scoped to documents and a date

The durable form — that AMD's client errata channel exists, and what it consists of — lives in `17-security.md`. What is dated is the gap list, because each entry closes the moment AMD publishes or a copy is located.

- **Claim.** As of **2026-09-26**, three things are genuinely absent: no public revision guide covers a Family 19h or 1Ah **client** model range; four client PPRs (56176 Matisse, 56214 Vermeer, 56713 Raphael, 57254 Strix Point) have no retrievable first-party copy; and the `AMD-SB-4xxx` client bulletins give an AGESA/PI version string rather than a verifiable microcode patch level. A client-errata gap statement must be scoped to these three and re-checked before reuse.  `[no-spec]` `[662]` `C:high` `V:dated`

## 90.3 Firmware and ABI revisions

### SEV firmware AMD currently ships

AMD's SEV developer page hosts one firmware package per generation, and it prints each version **in decimal with the hexadecimal form in brackets**.

| Package | Generation | Version as AMD prints it |
|---|---|---|
| `amd_sev_fam17h_model01h_0.17.49.zip` | EPYC 7xx1 (Naples) | 0.17.49 [hex 00.11.31] |
| `amd_sev_fam17h_model3xh_0.24.22.zip` | EPYC 7xx2 (Rome) | 0.24.22 [hex 00.18.16] |
| `amd_sev_fam19h_model0xh_1.58.02.zip` | EPYC 7xx3 (Milan) | 1.58.02 [hex 1.3A.02] |
| `amd_sev_fam19h_model1xh_1.58.02.zip` | EPYC 9xx4 (Genoa) | 1.58.02 [hex 1.3A.02] |
| `amd_sev_fam1ah_model0xh_1.58.06.zip` | EPYC 9xx5 (Turin) | 1.58.06 [hex 1.3A.06] |

- **Claim.** The five SEV firmware packages AMD offers for download, and the generations they are labelled for, are exactly the five rows above; AMD annotates each with both decimal and hexadecimal, e.g. "SEV firmware 1.58.02 [hex 1.3A.02] for EPYC 7xx3 (Milan)".  `[35]` `C:high` `V:dated`

### The firmware versions a security advisory pins

- **Claim.** AMD-SB-3023, titled "AMD EPYC™ and AMD EPYC™ Embedded Series Processor Vulnerabilities – February 2026", lists the fixed SEV firmware as **1.37.23 for EPYC 7003 "Milan"**, **1.37.31 for EPYC 8004 "Siena" and for EPYC 9004 "Genoa" / "Bergamo"**, and **1.37.41 for EPYC 9005 "Turin" / "Turin Dense"**, alongside platform-initialisation packages MilanPI 1.0.0.H, GenoaPI 1.0.0.H and TurinPI 1.0.0.6.  `[AMD-SB-3023]` `[23]` `C:high` `V:dated`
- **Claim.** The bulletin's footnote 2, which is attached to the CVE-2025-48514 row of every affected generation, reads in full: "Applying mitigation CVE-2025-48514 will result in disabling SEV-ES when SEV-SNP is enabled". Three qualifiers matter and all three are in that sentence — it disables **SEV-ES only** (not SEV), the trigger is SEV-SNP being **enabled** (not merely supported), and the footnote appears on the Milan, Siena, Genoa/Bergamo and Turin tables alike.  `[AMD-SB-3023]` `[23]` `C:high` `V:dated`
- **Claim.** The same bulletin's SEV table marks CVE-2025-48514 as **N / N / Y** across the SEV, SEV-ES and SEV-SNP columns, i.e. AMD classifies it as an SEV-SNP issue whose mitigation costs SEV-ES.  `[AMD-SB-3023]` `[23]` `C:high` `V:dated`

### The notation trap

- **Claim.** The version strings in AMD-SB-3023 are **hexadecimal**, not decimal: the same tables print builds as `1.37.1F`, `1.37.2A` and `1.37.2B`, which cannot be decimal. Read against AMD's download page, where 1.58.02 decimal is annotated "hex 1.3A.02", the bulletin's `1.37.xx` is therefore `1.55.xx` decimal — older than, and superseded by, the 1.58.x packages AMD currently ships. Do not compare a bulletin version with a download-page version without converting first.  `[23]` `[35]` `C:medium` `V:dated`

### Document revisions AMD's own portal advertises

- **Claim.** The specification table on AMD's SEV developer page lists, as of the as-of date: SEV-TIO Firmware Interface **0.92, August 2026**; SEV-SNP Firmware ABI **1.59, August 2026**; GHCB Standardization **2.04, January 2025**; Secure Encrypted Virtualization API **3.24, April 2020**; VCEK Certificate and KDS Interface **1.00, January 2025**; SVSM Specification **1.0, July 2023**; AMD64 APM Volume 2 **3.44, March 2026**. These are revision numbers only; the content each document specifies belongs to its owning chapter, e.g. `13-sev-es-ghcb.md`.  `[35]` `C:high` `V:dated`
- **Claim.** Two of those entries lag the documents themselves: the APM Vol.2 PDF on `docs.amd.com` is **Rev 3.45 (2026-07)**, and the SVSM Guest Communication Interface PDF is **Rev 1.01 (2026-03)**, not the 1.0 (July 2023) the page advertises. Treat the developer page as an index, not as the revision of record; the revision of record is the PDF cover.  `[35]` `[1]` `[11]` `C:high` `V:dated`
- **Claim.** AMD's SEV page links `github.com/AMDESE/AMDSEV` as "Linux open source code under development" and links `github.com/AMDESE/sev-tool` with the label **"Deprecated AMD SEV Tool for managing SEV platform certificates"** — AMD's own page marks its old tool deprecated.  `[35]` `[642]` `C:high` `V:dated`

## 90.4 Kernel, QEMU, libvirt and tooling

### Linux mainline

Each row below was established by fetching the named file from `git.kernel.org` at successive release tags and binary-searching for the first tag that contains the symbol. "First tag" is a statement about the tree at that tag.

| Capability | Marker probed | First tag | Absent at |
|---|---|---|---|
| AVIC CPU feature flag | `X86_FEATURE_AVIC` in `arch/x86/include/asm/cpufeatures.h` | v4.6 | v4.5 |
| AVIC support in KVM | `avic` in `arch/x86/kvm/svm.c` (112 hits at v4.7, 0 at v4.6) | v4.7 | v4.6 |
| SME CPU feature | `X86_FEATURE_SME\b` in `cpufeatures.h` | v4.14 | v4.13 |
| vGIF CPU feature | `X86_FEATURE_VGIF` (same file) | v4.14 | v4.13 |
| SEV CPU feature | `X86_FEATURE_SEV` (same file) | v4.16 | v4.15 |
| SEV host ioctl family | `enum sev_cmd_id` in `include/uapi/linux/kvm.h` | v4.16 | v4.15 |
| SEV-ES CPU feature | `X86_FEATURE_SEV_ES` in `cpufeatures.h` | v5.10 | v5.9 |
| SEV-ES guest `#VC` vector | `X86_TRAP_VC` in `arch/x86/include/asm/trapnr.h` | v5.10 | v5.9 |
| SEV-ES host support in KVM | `sev_es_init_vmcb` in `arch/x86/kvm/svm/sev.c` | v5.11 | v5.10 |
| Erratum #1235 first named in KVM | `1235` in `arch/x86/kvm/svm/avic.c` | v5.17 | v5.16 |
| SNP guest enablement MSR | `MSR_AMD64_SEV_SNP_ENABLED` in `msr-index.h` | v5.19 | v5.18 |
| `force_avic` override | `force_avic` in `arch/x86/kvm/svm/svm.c` (moves to `avic.c` at v6.0) | v5.19 | v5.18 |
| x2AVIC CPU feature | `X86_FEATURE_X2AVIC` in `cpufeatures.h` | v6.0 | v5.19 |
| SNP CPU feature | `X86_FEATURE_SEV_SNP` in `cpufeatures.h` | v6.9 | v6.8 |
| `KVM_SEV_INIT2` | `arch/x86/include/uapi/asm/kvm.h` | v6.10 | v6.9 |
| SNP **host** support in KVM | `KVM_SEV_SNP_LAUNCH_START` (same file) | v6.11 | v6.10 |
| Guest Secure TSC | `snp_secure_tsc_prepare` in `arch/x86/include/asm/sev.h` | v6.14 | v6.13 |
| Segmented RMP | `rmp_segment` in `arch/x86/virt/svm/sev.c` (57 hits at v6.14, 0 at v6.13) | v6.14 | v6.13 |
| SVSM vTPM driver | `TCG_SVSM` in `drivers/char/tpm/Kconfig` | v6.16 | v6.15 |
| `ALLOWED_SEV_FEATURES` VMCB field | `allowed_sev_features` in `arch/x86/include/asm/svm.h` | v6.16 | v6.15 |
| `enable_ipiv` parameter and the erratum #1235 IPI-virtualization workaround | `enable_ipiv` in `svm/avic.c` | v6.17 | v6.16 |
| Secure TSC in KVM | `SVM_SEV_FEAT_SECURE_TSC` in `svm.h` | v6.18 | v6.17 |
| SNP Secure TSC CPU feature | `X86_FEATURE_SNP_SECURE_TSC` in `cpufeatures.h` | v6.18 | v6.17 |
| SNP ciphertext hiding in KVM | `ciphertext_hiding_asids` in `svm/sev.c` | v6.18 | v6.17 |
| Secure AVIC guest support | `AMD_SECURE_AVIC` in `arch/x86/Kconfig` | v6.18 | v6.17 |
| AVIC enabled by default | `AVIC_AUTO_MODE` in `svm/avic.c` | v6.18 | v6.17 |
| x2AVIC for 4K vCPUs | `X86_FEATURE_X2AVIC_EXT` in `cpufeatures.h` | v6.19 | v6.18 |
| Generic PCIe TDISP framework | `drivers/pci/tsm.c` (`CONFIG_PCI_TSM`) | v6.19 | v6.18 |
| AMD SEV-TIO host support | `drivers/crypto/ccp/sev-dev-tio.c` | v6.19 | v6.18 |

- **Claim.** The table above states, for each marker, the first mainline tag in which `git.kernel.org` serves a copy of the named file containing that symbol, and the immediately preceding tag in which it does not.  `[610]` `[57]` `C:high` `V:dated`
- **Claim.** One row is a trap and must not be read as a feature date: the **whole `enum sev_cmd_id`, including `KVM_SEV_ES_INIT`, was already present in v4.16** as a UAPI placeholder, five releases before SEV-ES host support actually landed. Probing for an ioctl *name* dates the UAPI reservation, not the implementation — which is why the SEV-ES row above is anchored to `sev_es_init_vmcb` in the KVM SVM code (v5.11) instead.  `[610]` `C:high` `V:dated`
- **Claim.** `KVM_SEV_INIT` and `KVM_SEV_ES_INIT` appear to "first land" in `arch/x86/include/uapi/asm/kvm.h` at v6.9, but that is a **header reorganisation**, not a feature: the enum moved there from `include/uapi/linux/kvm.h`, where it had lived since v4.16.  `[610]` `C:high` `V:dated`
- **Claim.** Two more traps of the same family, recorded because they produce plausible wrong answers. A substring search for `X86_FEATURE_SME` matches **`X86_FEATURE_SMEP`**, which has existed since long before SME and yields a false "v4.6"; the word-bounded search gives **v4.14**, the release that actually added `#define X86_FEATURE_SME ( 7*32+10)`. And the **AVIC CPU feature flag (v4.6) predates KVM's AVIC support (v4.7)** by one release, so citing the flag as the AVIC merge version is off by one.  `[610]` `C:high` `V:dated`
- **Claim.** The **guest-side Secure AVIC driver merged in v6.18, but the KVM host side has not merged** as of the as-of date: current mainline's `arch/x86/kvm/svm/avic.c` and `arch/x86/kvm/svm/sev.c` contain no `SECURE_AVIC`, `secure_avic` or `savic` symbol, and `SVM_SEV_FEAT_SECURE_TSC` is the only new SNP VMSA feature in `svm.h`. Treat Secure AVIC as guest-enabled and host-pending.  `[610]` `C:medium` `V:dated`
- **Claim.** KVM exposes SNP ciphertext hiding through the module parameter **`kvm_amd.ciphertext_hiding_asids`**, and enabling it partitions the joint ASID range — the kernel's own comment states that "SEV-ES may effectively be disabled if all ASIDs from the joint range are assigned to SEV-SNP", and KVM prints `SEV-SNP ciphertext hiding enabled` when it takes effect. This is a second, independent route to a host with SEV-SNP but no usable SEV-ES, distinct from the AMD-SB-3023 mitigation in §90.3.  `[610]` `C:high` `V:dated`
- **Claim.** As of the as-of date `kernel.org` reports mainline **7.3-rc3**, latest stable **7.2.6**, and longterm series **6.18.52, 6.12.110, 6.6.157, 6.1.188, 5.15.221 and 5.10.270**; the 7.1 series is marked EOL and linux-next is `next-20260918`. Every "6.x" version in the table above is therefore historical, and 6.18 is a longterm branch.  `[612]` `C:high` `V:dated`

### QEMU

- **Claim.** QEMU gained SEV in **2.12** ("Support for AMD Secure Encrypted Virtualization"), SEV-ES in **6.0** ("Support for running SEV-ES encrypted guests."), and SEV-SNP in **9.1** ("Support for SEV-SNP using the \"-object sev-snp-guest\" command line option."). Probing the source tree agrees: `target/i386/sev.c` first appears at v2.12.0, `sev_es_enabled` at v6.0.0, and the `sev-snp-guest` QOM type at v9.1.0.  `[631]` `[632]` `[633]` `[635]` `C:high` `V:dated`
- **Claim.** The current QEMU stable release is **11.1.1**, published 2026-08-26; the master branch's `VERSION` file reads **11.1.50**.  `[634]` `[635]` `C:high` `V:dated`

### libvirt

- **Claim.** libvirt's `<launchSecurity type='sev'>` element is annotated **"Since 4.4.0"** and `<launchSecurity type='sev-snp'>` **"Since 10.5.0"**. A nearby "Since 7.6.0" on the same page belongs to `type='s390-pv'` (IBM Secure Execution) and is not an AMD version.  `[636]` `C:high` `V:dated`
- **Claim.** libvirt's master branch declares version **12.8.0**.  `[637]` `C:high` `V:dated`

### Tooling

- **Claim.** AMD's `AMDESE/sev-tool` repository is **archived** and its README carries a deprecation notice routing users to the VirTEE tools: legacy SEV and SEV-ES to `sevctl`, SEV-SNP guest tooling to `snpguest`, SEV-SNP host tooling to `snphost`.  `[641]` `C:high` `V:dated`
- **Claim.** Latest releases of the VirTEE tools as of the as-of date: **`sevctl` 0.6.2 (2025-05-29)**, **`snphost` v0.7.0 (2025-11-17)**, **`snpguest` 0.10.0 (2025-11-13)**. `sevctl` describes itself as covering "the entire management API for the Naples generation of processors"; the two `snp*` tools are the SNP-era replacements, not a rename of `sevctl`.  `[638]` `[639]` `[640]` `C:high` `V:dated`

### Hypervisors other than KVM

One line per hypervisor, because "does X support SEV-SNP?" is asked constantly and the answers are short.

| Hypervisor | SEV | SEV-ES | SEV-SNP | Basis |
|---|---|---|---|---|
| KVM / QEMU | yes, since Linux 4.16 / QEMU 2.12 | yes, since Linux 5.11 / QEMU 6.0 | yes, since Linux 6.11 / QEMU 9.1 | source tree and changelogs |
| VMware ESXi | — | yes, since vSphere 7.0 Update 1 | not documented in the 8.0 or 9.0 branches | Broadcom documentation |
| Xen | not documented | not documented | not documented | documented absence in `SUPPORT.md` |
| Hyper-V, on-premises | not documented | not documented | not documented | documented absence in Microsoft's Windows Server docs |
| Hyper-V, Azure | — | — | yes, as the Azure confidential-VM product | Azure documentation, §90.5 |

- **Claim.** **Xen** does not document SEV, SEV-ES or SEV-SNP support: the project's `SUPPORT.md` feature-support matrix contains zero occurrences of the string "SEV" while explicitly listing AMD SVM, AMD IOMMU and nested paging. This is a documented absence, not an explicit "unsupported" statement — Xen publishes no sentence either way.  `[643]` `C:medium` `V:dated`
- **Claim.** **VMware ESXi** supports SEV-ES from **vSphere 7.0 Update 1** — "In vSphere 7.0 Update 1 and later, you can activate Secure Encrypted Virtualization-Encrypted State (SEV-ES) on supported AMD CPUs and guest operating systems" — and the 8.0 and 9.0 documentation branches contain no SEV-SNP page at all.  `[644]` `C:high` `V:dated`
- **Claim.** **On-premises Hyper-V** is not documented as exposing SEV or SEV-SNP to guests: Microsoft's Windows Server 2025 "what's new" and the Hyper-V generation-2 VM security documentation contain no SEV or SEV-SNP mention, and Hyper-V's own guest-confidentiality story there is Shielded VMs built on TPM and VBS. Microsoft publishes no explicit denial, so this is an absence finding; the AMD-specific Windows delta is `16-windows-platform.md`.  `[618]` `C:medium` `V:dated`

## 90.5 Cloud and confidential-computing ecosystem

| Cloud | Families with AMD confidential computing | EPYC generation the vendor names | Technology the vendor names | Vendor-dated milestone |
|---|---|---|---|---|
| Azure | DCasv5 / DCadsv5 / ECasv5 / ECadsv5 | third-generation EPYC (Milan) | SEV-SNP | GA date not sourced (§90.8) |
| Azure | DCasv6 / DCadsv6 / ECasv6 / ECadsv6 | AMD EPYC 9004 (Genoa) | SEV-SNP | status disputed between two Microsoft channels |
| Azure | NCCadsH100v5 | not named on the overview page | SEV-SNP plus a GPU TEE | — |
| AWS | specific m6a / c6a / r6a sizes only | third-generation EPYC (Milan) | SEV-SNP | C6a "Posted on: Feb 14, 2022" |
| AWS | c7a / r7a / m7a | fourth-generation EPYC (Genoa) | SME only; not on the SEV-SNP list | — |
| GCP | N2D | EPYC Milan | SEV **and** SEV-SNP | SEV-SNP GA 2024-06-18 |
| GCP | C2D / C3D / C4D / g4-standard-48 | Milan / Genoa / Turin / Turin | SEV; SEV-SNP not listed | C3D SEV GA 2024-09-20; C4D GA 2025-06-13 |
| OCI | VM.Standard.E3.Flex / E4.Flex | not named | SEV without SNP | OCI confidential computing GA 2023-02-01 |
| OCI | VM.Standard.E5.Flex / E6.Flex | not named | SEV-SNP | — |
| IBM Cloud | none | — | — | — |

Each row is restated as a sourced claim below.

### Microsoft Azure

- **Claim.** Azure's confidential-VM size list is **DCasv5 / DCadsv5 / DCasv6 / DCadsv6** (general purpose) and **ECasv5 / ECadsv5 / ECasv6 / ECadsv6** (memory optimised), plus **NCCadsH100v5** for the GPU case. The `DCesv6` / `ECesv6` families on the same page are **Intel TDX, not AMD** — the letter before `sv6` is the discriminator and mixing them up is the most common error in this area.  `[613]` `[614]` `C:high` `V:dated`
- **Claim.** DCasv5 uses "AMD's third-Generation EPYC™ 7763v processor" and its host-specification table reads **"AMD EPYC (Milan) [x86-64]"**; DCasv6 "runs on AMD's fourth-generation EPYC™ processors" and its table reads **"AMD EPYC 9004 (Genoa) [x86-64]"**. Both series are described as offering SEV-SNP, and the v6 sizes run from `Standard_DC2as_v6` (2 vCPU, 8 GiB) to `Standard_DC96as_v6` (96 vCPU, 384 GiB).  `[615]` `[616]` `C:high` `V:dated`
- **Claim.** Azure brands no confidential-VM option as plain "SEV" or "SEV-ES"; the only AMD technology its confidential-computing overview names is **SEV-SNP**.  `[614]` `C:high` `V:dated`
- **Claim.** Two Microsoft channels disagree about the DCasv6/ECasv6 status as of the as-of date: the confidential-computing product overview says they "are currently in gated preview", while a Microsoft Tech Community post is titled as a general-availability announcement for the same families. This is recorded as unresolved, not adjudicated — see §90.8.  `[614]` `C:low` `V:dated`
- **Claim.** Windows guests are supported on Azure confidential VMs: **Windows 11 (21H2, 22H2, 23H2 editions)**, **Windows 10 22H2**, and **Windows Server Datacenter / Server Core / Azure Edition for 2019, 2022 and 2025**. Linux options are Ubuntu 20.04 (AMD SEV-SNP only), 22.04 and 24.04 LTS, RHEL 9.4+, Rocky 9.4 and SUSE 15 SP5 in tech preview.  `[613]` `C:high` `V:dated`
- **Claim.** Azure confidential VMs **do not support** Azure Site Recovery, accelerated networking, live migration, boot-diagnostics screenshots or dynamic memory, and confidential disk encryption is limited to disks smaller than 128 GB.  `[613]` `C:high` `V:dated`
- **Claim.** Azure makes attestation a **boot gate**, not a reporting feature: "If the compute platform is missing critical settings for your VM's isolation, Azure Attestation will not attest to the platform's health during boot, and will instead prevent the VM from starting. This scenario happens if you haven't enabled SEV-SNP, for example."  `[613]` `C:high` `V:dated`
- **Claim.** Each Azure confidential VM carries its own **vTPM instance complying with the TPM 2.0 specification**, which Microsoft describes as running "in a secure environment outside the reach of any VM", plus a small encrypted **virtual machine guest state (VMGS) disk of several megabytes** holding the vTPM and UEFI bootloader state — and that disk may incur a monthly storage cost.  `[613]` `C:high` `V:dated`
- **Claim.** Beyond whole VMs, Azure exposes AMD SEV-SNP through **confidential AKS worker nodes** ("worker-node-level confidentiality on AMD SEV-SNP hardware") and through the **NCCadsH100v5** GPU family, which Microsoft describes as combining "GPU performance with linked CPU and GPU TEEs".  `[614]` `C:high` `V:dated`
- **Claim.** **OpenHCL** (formerly codenamed Underhill) is Microsoft's open-source paravisor built from OpenVMM. Its own documentation describes the boundary in terms of **Virtual Trust Levels — OpenHCL in VTL2, the guest OS in VTL0** — backed by Intel TDX, AMD SEV-SNP or software VSM. Microsoft's documentation does **not** assign a VMPL number to that boundary; the only VMPL mention in the whole guide is a *roadmap* item to "extend KVM to fully support multiple VMPLs on SNP machines, and update OpenHCL to support using architectural GHCB calls to switch VMPLs, rather than Hyper-V-specific hypercalls". The widely repeated "OpenHCL runs at VMPL0" is therefore not a Microsoft statement; VMPL semantics are `14-sev-snp.md` and the GHCB is `13-sev-es-ghcb.md`.  `[617]` `C:high` `V:dated`

### Amazon Web Services

- **Claim.** The AWS product pages state that **M6a and C6a are "powered by 3rd generation AMD EPYC processors"** and that "They also support AMD SEV-SNP", whereas the **R7a and C7a pages state "powered by 4th generation AMD EPYC processors" and make no SEV-SNP claim at all** — the 7a pages advertise only always-on memory encryption. The generation boundary and the SEV-SNP boundary do not coincide: the newer silicon is the one without the documented SEV-SNP option.  `[623]` `[624]` `[625]` `C:high` `V:dated`
- **Claim.** AWS documents SEV-SNP on a **specific list of sizes in the 6a families only**: `m6a.large` through `m6a.8xlarge`, `c6a.large` through `c6a.16xlarge`, and `r6a.large` through `r6a.4xlarge`; no 7a size appears, including in AWS's own `describe-instance-types` example filtered on `amd-sev-snp`. The AWS User Guide renders client-side and could not be re-read from the capture host on the as-of date, so this size list carries the confidence of a single capture — re-read it before sizing anything.  `[621]` `[622]` `C:medium` `V:dated`
- **Claim.** AWS's SEV-SNP region and price terms differ by tenancy: on **Dedicated Hosts** it is available in any commercial AWS Region at **no additional charge**, while under **shared tenancy** it is limited to **US East (Ohio) and Europe (Ireland)** and carries "an additional hourly usage fee that is equivalent to 10 percent of the On-Demand hourly rate". Same single-capture caveat as the size list.  `[620]` `[621]` `C:medium` `V:dated`
- **Claim.** AWS states SEV-SNP guest OS support as **AL2023, RHEL 9.3, SLES 15 SP4, and Ubuntu 23.04 and later**, and documents that from **AMD EPYC (Milan)** onward instance memory is always encrypted — that baseline is SME and is separate from opting a VM into SEV-SNP.  `[620]` `[621]` `C:medium` `V:dated`

### Google Cloud

- **Claim.** Google's supported-configurations table has the columns *machine series · CPU platform · Confidential Computing technology · Live migration support · GPU support*. Its AMD rows read: **N2D — AMD EPYC Milan — "AMD SEV on Milan" and "AMD SEV-SNP on Milan"**; **C2D — AMD EPYC Milan — AMD SEV**; **C3D — AMD EPYC Genoa — AMD SEV**; **C4D — AMD EPYC Turin — AMD SEV**; **`g4-standard-48` — AMD EPYC Turin — AMD SEV plus NVIDIA**. SEV-SNP appears in the technology column of **N2D alone**; for the other series the table simply does not list it, rather than printing an explicit "not supported" for SEV-SNP — the "Not supported" cells on those rows belong to the live-migration and GPU columns.  `[626]` `C:high` `V:dated`
- **Claim.** Live migration in that same table is **Supported on C3D**, **"Supported on AMD SEV VM instances only" on N2D** — i.e. not for the SEV-SNP configuration on the one series that offers it — and **Not supported on C2D, C4D or `g4-standard-48`**. GPU support is listed only for `g4-standard-48` among the AMD rows.  `[626]` `C:high` `V:dated`
- **Claim.** Google's Confidential VM release notes date the milestones as: **Confidential VM GA on N2D with 2nd-generation EPYC Rome, 2020-12-01**; **Milan on N2D and C2D GA, 2022-06-16**; **SEV-SNP preview on N2D, 2024-01-19**; **SEV-SNP GA, 2024-06-18** ("AMD SEV-SNP is supported on N2D machine types with AMD EPYC Milan CPU platforms"); **C3D SEV GA, 2024-09-20**; **C4D GA with 5th-generation EPYC Turin, 2025-06-13**.  `[627]` `C:high` `V:dated`
- **Claim.** Google documents **no SEV-ES option**: the string "SEV-ES" does not occur on its supported-configurations, Confidential VM overview or release-notes pages. Google's two AMD tiers are "AMD SEV" and "AMD SEV-SNP".  `[626]` `[627]` `C:high` `V:dated`
- **Claim.** Google's release notes carry an entry dated **2025-10-27 marked "Breaking"**: "Following a firmware update, Confidential VM instances with AMD SEV-SNP generate v4 attestation reports. Attestation report parsers that are designed for v3 attestation reports might break." This is recorded as a vendor statement, not adopted as an AMD version number: the SEV-SNP Firmware ABI Rev 1.59 sets the report's `VERSION` field to **6h**, and the settled reading in this skill is that a value of 4h never existed. Anyone reconciling the two should start from the firmware ABI revision the platform actually reports; the field itself is `14-sev-snp.md`.  `[627]` `[10]` `C:medium` `V:dated`
- **Claim.** Two further dated Google entries matter operationally: **live migration for Confidential VM instances reached GA on 2026-04-07** for configurations that meet stated criteria beginning with a C3D machine type, and an advisory dated **2026-07-28** warns that "Starting August 2026, Confidential VM instances using AMD SEV-SNP might have longer boot times and performance changes due to a guest kernel migration and security updates", expected to be resolved by **November 2026**, with SEV and Intel TDX instances unaffected.  `[627]` `C:high` `V:dated`
- **Claim.** Google also publishes a security bulletin channel for this hardware: an entry dated **2026-04-14** records "A vulnerability affecting AMD SEV-SNP Confidential VM instances was discovered and has been addressed", pointing at bulletin **GCP-2026-021**. Cloud-side bulletins are a second disclosure channel alongside AMD's own; the CVE-to-mitigation matrix is `17-security.md`.  `[627]` `C:high` `V:dated`

### Oracle Cloud and IBM Cloud

- **Claim.** OCI confidential computing reached GA on **2023-02-01** per Oracle's Compute release notes, and Oracle's own documentation splits it by shape: **VM.Standard.E3.Flex and E4.Flex offer SEV without SNP; E5.Flex and E6.Flex offer SEV-SNP**. Oracle does not name the EPYC generation behind any of those shapes — the strings "Milan", "Genoa", "Turin" and "Rome" do not appear on the page.  `[628]` `[629]` `C:high` `V:dated`
- **Claim.** IBM Cloud offers **no AMD confidential computing**: its confidential-computing page names only Intel SGX, Intel TDX and IBM Secure Execution for Linux on IBM Z/LinuxONE, with no occurrence of "AMD" or "SEV".  `[630]` `C:medium` `V:dated`

### Confidential-computing open source

- **Claim.** CNCF **Confidential Containers** is at release **v0.22.0 (2026-07-28)** and its companion **Trustee** attestation and secret-delivery component is at **v0.22.0**; the project lists AMD SEV-SNP among the TEE technologies it supports.  `[645]` `[646]` `C:high` `V:dated`
- **Claim.** The **CoCo Operator repository is archived**, with its README stating "This repository is deprecated and will be archived on February 1st, 2026", and the project now directs deployments at a **Helm chart** — "The Confidential Containers Operator has been superseded by the Confidential Containers Helm Chart, which is now the official and recommended way to deploy Confidential Containers". Any runbook that still installs the operator is out of date.  `[659]` `C:high` `V:dated`
- **Claim.** **COCONUT-SVSM** publishes dated development snapshots rather than stable releases; the newest is **v2026.08-devel (2026-08-28)**. Anything that depends on "the SVSM release" should pin a snapshot tag.  `[647]` `C:high` `V:dated`
- **Claim.** The Linux guest side of the SVSM story is the **`tpm_svsm` driver (`CONFIG_TCG_SVSM`), first present at v6.16**, which lets a guest at a lower privilege level talk to a vTPM provided by the SVSM rather than by the host.  `[610]` `C:high` `V:dated`

## 90.6 Default-state history: AVIC and friends

This section exists because "is AVIC on by default?" has had three different correct answers, and the answer changed recently.

The short version: **AVIC landed in Linux 4.7 and was off by default for its entire life until Linux 6.18**, which enables it automatically on Zen 4 and later parts that also report x2AVIC. Anything that says "AVIC has been on by default since <older version>" is wrong, and anything that says "AVIC is off by default" is now wrong on current kernels and new hardware.

| Release | What changed |
|---|---|
| v4.6 | the `X86_FEATURE_AVIC` CPU feature flag appears |
| v4.7 | AVIC support lands in KVM, off by default |
| v5.17 | erratum #1235 is named in `avic.c`, in a comment about a missing memory barrier on `IsRunning` |
| v5.19 | the `force_avic` override is added (in `svm.c`); the default is unchanged |
| v6.0 | x2AVIC support; `force_avic` moves into `avic.c` |
| v6.17 | `enable_ipiv` appears and IPI virtualization is disabled on the erratum-#1235 families |
| v6.18 | the default flips to "auto"; guest-side Secure AVIC arrives in the same release |
| v6.19 | `X86_FEATURE_X2AVIC_EXT` — x2AVIC for 4096 vCPUs |

- **Claim.** From its introduction until Linux 6.17 inclusive, KVM's AVIC switch was a plain boolean that **defaulted to off**: `static bool avic; module_param(avic, bool, 0444);`, with the in-tree comment explaining only that "the defaults differ for APICv support between VMX and SVM". AVIC support itself first appears in `arch/x86/kvm/svm.c` at **v4.7** — 112 occurrences of `avic` at v4.7 against none at v4.6.  `[610]` `[611]` `C:high` `V:dated`
- **Claim.** **Linux 6.18 flipped the default.** Commit `ca2967de5a5b` ("KVM: SVM: Enable AVIC by default for Zen4+ if x2AVIC is support"), authored by Naveen N Rao (AMD) on 2025-09-19 and committed by Sean Christopherson on 2025-09-23, states the rationale verbatim: "AVIC and x2AVIC are fully functional since Zen 4, with no known hardware errata. Enable AVIC and x2AVIC by default on Zen4+ so long as x2AVIC is supported (to avoid enabling partial support for APIC virtualization by default)."  `[611]` `C:high` `V:dated`
- **Claim.** The new default is an **"auto" mode, encoded as `-1`**, distinct from both `y` and `n`, so that KVM can tell "user said nothing" from "user said yes". The module parameter accepts the literal string `auto` in addition to boolean values, and `KERNEL_PARAM_OPS_FL_NOARG` keeps a bare `avic` meaning `avic=y`.  `[610]` `[611]` `C:high` `V:dated`
- **Claim.** In auto mode KVM enables AVIC when **x2AVIC is present in CPUID and the CPU is Zen 4 or newer** — the current code is `avic = boot_cpu_has(X86_FEATURE_X2AVIC) && (cpu_feature_enabled(X86_FEATURE_ZEN4) || boot_cpu_data.x86 >= 0x1A)`, the family test being needed because the kernel sets at most one synthetic ZenX flag. On a Zen 3 or older part, AVIC therefore remains off unless the user asks for it.  `[610]` `C:high` `V:dated`
- **Claim.** Three further gates apply regardless of the default: AVIC requires **nested paging** (`!npt_enabled` disables it), it is refused on an SNP-enabled host that lacks `HvInUseWrAllowed` (KVM logs "AVIC disabled: missing HvInUseWrAllowed on SNP-enabled system"), and forcing it on a part whose CPUID does not report AVIC requires the **`force_avic` parameter, which is registered with `module_param_unsafe`** and produces the warning "AVIC unsupported in CPUID but force enabled, your system might crash and burn".  `[610]` `C:high` `V:dated`
- **Claim.** Reading the parameter back is misleading by design: the getter resolves auto mode to `N`, so `/sys/module/kvm_amd/parameters/avic` can read `N` on a machine where AVIC is in fact enabled, until module initialisation has resolved the mode. A follow-up commit on 2026-03-02 ("KVM: SVM: Fix UBSAN warning when reading avic parameter") exists specifically because of this three-valued parameter.  `[610]` `C:medium` `V:dated`
- **Claim.** Firmware can mask AVIC while leaving x2AVIC visible; KVM detects that combination and prints `[Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported`, then disables both. Generation capability tables are therefore not a substitute for reading CPUID on the actual machine.  `[610]` `C:high` `V:dated`

### Erratum 1235 and what it still costs

- **Claim.** Current mainline still disables **IPI virtualization** — not AVIC as a whole — on **AMD Family 17h (Zen 1 and Zen 2) and Hygon Family 18h**, with the in-tree comment attributing it to "erratum 1235, which results in missed VM-Exits on the sender and thus missed wake events for blocking vCPUs due to the CPU failing to see a software update to clear IsRunning". The `enable_ipiv` parameter and this workaround appear in `avic.c` at **v6.17** — one release before the default flip, which is the order that makes the flip safe to reason about.  `[610]` `C:high` `V:dated`
- **Claim.** The erratum's **upstream visibility can be bounded even though its AMD disclosure date cannot**: the number `1235` first appears in `arch/x86/kvm/svm/avic.c` at **v5.17** (absent at v5.16), in a comment observing that "the processor needs a matching memory barrier on interrupt delivery between writing IRR and reading IsRunning; the lack of this barrier might be the cause of errata #1235". So the erratum was public and named in mainline Linux no later than the v5.17 release.  `[610]` `C:high` `V:dated`
- **Claim.** Erratum 1235 is a Family 17h item, so it is absent from the Family 19h Models 10h–1Fh guide (pub 57095, Rev 1.05, November 2025) and the Family 1Ah Models 00h–0Fh guide (pub 58251), which cover Genoa and Turin. It is present in Revision Guide 55449, Family 17h Models 00h–0Fh, at p.87, and that document's revision history first lists it at rev 1.17, 2019-07 (`errata.md` E27 and O2). The v5.17 bound dates the kernel's reference, which cannot be a 2025–2026 disclosure.  `[RevGuide 55449 erratum 1235]` `[610]` `[29]` `[27]` `[25]` `C:high` `V:dated`

### The rest of the interrupt-virtualization timeline

- **Claim.** x2AVIC's CPU feature flag first appears in mainline at **v6.0**, and the extended form for 4096 vCPUs (`X86_FEATURE_X2AVIC_EXT`) at **v6.19**; guest-side **Secure AVIC** (`CONFIG_AMD_SECURE_AVIC`, which depends on `AMD_MEM_ENCRYPT` and `X86_X2APIC` and does not support xAPIC mode) first appears at **v6.18**. So AVIC becoming a default and guest-side Secure AVIC becoming available happened in the same release — while the KVM host side of Secure AVIC is still absent from mainline, as §90.4 records.  `[610]` `C:high` `V:dated`
- **Claim.** When x2AVIC is enabled, KVM picks the physical-ID ceiling from `X86_FEATURE_X2AVIC_EXT` and logs the result as "x2AVIC enabled (max %u vCPUs)"; when x2AVIC is absent but AVIC is on, it instead sets `allow_apicv_in_x2apic_without_x2apic_virtualization`. The vCPU ceiling a given host reports is therefore a function of the CPU's extended-x2AVIC bit, not of a fixed architectural number.  `[610]` `C:high` `V:dated`
- **Claim.** vGIF's CPU feature flag has been in mainline since **v4.14**, far ahead of the AVIC default flip; vGIF and VMLOAD/VMSAVE virtualization were never gated behind the AVIC parameter.  `[610]` `C:high` `V:dated`

## 90.7 Roadmap

- **Claim.** AMD's forward-looking generation row is **EPYC 9006**, to which it attributes RMPOPT, an enhanced AMD Secure Processor root of trust, integrated Caliptra, post-quantum signature support restricted to LMS, and physical and side-channel attack mitigations. AMD attaches **no date and no firmware or kernel availability** to any of them, and none of the five has a corresponding symbol in the mainline markers surveyed in §90.4.  `[35]` `[610]` `C:medium` `V:dated`
- **Claim.** **EPYC 9006 has a live AMD product page** as of the as-of date, headed "AMD EPYC™ 9006 Series Server CPUs", listing **SP7 and SP8** sockets and naming the part in a footnote as **"AMD EPYC™ 'Venice' 9996 (512 total cores)" in a two-socket comparison** — i.e. 256 cores per socket. AMD labels the numbers on that page "Preliminary performance estimates based on AMD engineering projections or measurements as of July 22, 2026 and subject to change". A general-availability or shipping date is **not stated**, so "announced and detailed" is as far as this chapter goes.  `[658]` `C:high` `V:dated`
- **Claim.** **SEV-TIO has begun landing in mainline, in stages.** A generic PCIe TDISP framework (`drivers/pci/tsm.c`, `CONFIG_PCI_TSM`) and AMD's own host side (`drivers/crypto/ccp/sev-dev-tio.c`) both first appear at **v6.19**; neither file exists at v6.18. The specification is at **Rev 0.92 (August 2026)**. Treat this as partially landed and still moving, not as a completed feature — and do not describe the kernel state without naming the release you checked.  `[610]` `[35]` `[12]` `C:medium` `V:dated`
- **Claim.** Of the five capabilities AMD lists against the shared 8005/9005 row, three now have mainline markers — **Segmented RMP (v6.14, `rmp_segment` in `arch/x86/virt/svm/sev.c`)**, **ciphertext hiding (v6.18, `kvm_amd.ciphertext_hiding_asids`)** and **guest-side Secure AVIC (v6.18, `CONFIG_AMD_SECURE_AVIC`)** — while **PMC virtualization and Guest Intercept Controls were not resolved to a mainline marker** in this survey. Their architectural definitions are durable and live in `14-sev-snp.md` and `03-intercepts.md`; only their availability is dated.  `[35]` `[610]` `C:medium` `V:dated`
- **Claim.** No AMD source found in this pass names a generation after 9006. Third-party roadmaps circulate a post-Venice codename and a shipping window, but **AMD itself publishes neither**, so this chapter states neither.  `[658]` `C:medium` `V:dated`
- **Claim.** The one Hyper-V version requirement worth keeping alongside the roadmap, because it is a version fact: Microsoft's nested-virtualization prerequisites list an **"AMD EPYC / Ryzen processor or later"**, a host running **Windows Server 2022 or later, or Windows 11 or later**, and **VM configuration version 9.3 or higher** — against Windows Server 2016 / Windows 10 and configuration version 8.0 on the Intel side. Microsoft names no Zen generation; do not add one. The behaviour behind the requirement is `16-windows-platform.md`.  `[41]` `C:high` `V:dated`

## 90.8 Open items

Everything below was looked for and not found. These are gaps, not oversights.

- **Azure DCasv5 / ECasv5 GA date.** Not stated on any Azure documentation page reachable in this pass. Microsoft's `learn.microsoft.com`, `azure.microsoft.com` and `techcommunity.microsoft.com` were unreachable at the network layer; the docs content used above came from Microsoft's own public docs-as-code repositories, which carry the article text but not the Azure Updates announcements that hold GA dates.
- **Azure DCasv6 / ECasv6: GA or gated preview.** Two Microsoft channels disagree (§90.5). Unresolved on purpose.
- **AWS GA dates for R6a, M7a, C7a and R7a.** The C6a "Posted on: Feb 14, 2022" What's-New entry was found; the others were not, and the M6a date that exists is on the AWS blog rather than the What's New feed.
- **Re-reading the AWS SEV-SNP size, region and price details.** `docs.aws.amazon.com` renders client-side; a plain fetch returns the application shell, and the text-extraction proxy resolved to the EC2 landing page instead of the requested article. The size list, region split and 10-percent surcharge in §90.5 therefore rest on a single capture and are carried at `C:medium`. The AMD-generation and SEV-SNP statements on the `aws.amazon.com/ec2/instance-types/*` product pages were re-read directly and are `C:high`.
- **Google's "v4 attestation report" against the firmware ABI's `VERSION = 6h`.** Recorded in §90.5, not adjudicated. Resolving it needs the firmware revision that was actually deployed at the time of Google's 2025-10-27 note, which Google does not state.
- **A shipping or GA date for EPYC 9006 "Venice".** AMD publishes a detailed product page and preliminary performance projections dated 2026-07-22, but no availability date. Third-party roadmaps give a window; none of them is AMD.
- **Any AMD statement about a generation after 9006.** Not found.
- **Market share.** No first-party, citable figure for AMD's server or confidential-computing share was found, and the analyst numbers that circulate are not primary sources. This chapter states none. If a number is needed, get it from AMD's own quarterly filings and cite the filing.
- **Prices.** The only sourced price signal in this chapter is AWS's "10 percent of the On-Demand hourly rate" for shared-tenancy SEV-SNP. No AMD list prices, no Azure or GCP confidential-VM premium, are stated.
- **Erratum 1235's disclosure year.** Settled in §90.6 from Revision Guide 55449 rev 1.17 (2019-07) and `errata.md` O2. The two EPYC guides cover the wrong families; 55449 is the Family 17h client guide and does contain it.
- **Secure AVIC on the KVM host side.** Reported here as "not merged" from a negative grep of current mainline `svm/avic.c` and `svm/sev.c`. A negative grep is weaker than a positive one; if a host-side symbol exists under a name not tried, this entry is wrong and should be corrected rather than trusted.
- **SEV firmware version notation.** The hexadecimal reading of AMD-SB-3023's `1.37.xx` strings is an inference from the hex digits AMD itself prints in the build field (`1.37.1F`, `1.37.2A`, `1.37.2B`) plus the decimal/hex annotation on the download page. AMD states no conversion rule in either place. Carried at `C:medium`; if a bulletin ever prints an explicit rule, upgrade it.
- **PMC virtualization and Guest Intercept Controls in mainline.** Not resolved to a kernel symbol in this survey. Absent from the table in §90.4 rather than guessed at. (Segmented RMP and SEV-TIO were resolved on a second pass and are now in the table.)
- **How complete SEV-TIO is.** The host-side files exist from v6.19, but "the files exist" is not "the feature works end to end". Device binding, secure DMA and attestation each need their own check before anyone relies on them.
- **On-premises Hyper-V and SEV-SNP.** Microsoft publishes no statement either way; the finding in §90.4 is an absence across three Microsoft documentation sources, not a denial.
- **Xen and SEV.** Same shape of finding: `SUPPORT.md` says nothing about SEV in either direction.
- **The 15 / 509 / 1006 key counts and the generations they belong to** are now sourced to AMD's own table (§90.2), which closes the first-party-source requirement in `errata.md` `O1` for the encryption mode and the counts. What remains open in `O1` is the pre-rebuild corpus's inconsistency, not the AMD statement — anyone citing a different mapping should be checked against `[35]` first.
