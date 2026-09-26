# Errata — Known Misconceptions and Their Corrections

> **中文速览**：本文件收录关于 AMD 虚拟化的常见讹传及其纠正。很多讹传以中文流传，因此每条都给出中英双语表述。**动笔或回答前必查本文件**：如果你要写的内容与这里某一条相冲突，按本文件改口径。每条都附真实出处。文末 "Open conflicts" 一节列出证据相互矛盾、本次重构**不做裁决**的条目——引用这些话题时必须同时给出两种说法。

**How to use.** Each entry gives the misconception in Chinese and English, the correction as a claim line with a real citation, and the chapter that owns the underlying fact. Entries `E01`–`E26` are settled. Of the seven open conflicts, **`O1` and `O5` were resolved during the rebuild and `O3` was reframed** — all three keep their original numbers because the wrong version still circulates — **`O2` is half-bounded**, `O4` and `O6` remain genuinely open, and **`O7` was added after the second eval run** when a scorer found the corpus asserting one side of a contradiction in AMD's own Table 27. On the genuinely open ones: do not pick a side, state both.

**Citations.** Every entry carries at least one `[N]`. Where the only available source is weak, the entry says so and carries `C:low`.

**Time-sensitivity.** Several entries correct a misreported *date or status*. The correction itself is a durable historical statement and is tagged `V:durable`; whatever the current status is belongs to `90-dated-landscape.md` and must be re-verified there.

**⚠️ Five of these entries exist because a proposed correction was itself wrong.** During the rebuild's verification pass, `E12`, `E20`, `E21`, `E22` and `E23` were each drafted the other way round, and a primary-source check refuted the draft. They are marked **`[reversed]`**. If you find a secondary source asserting the drafted version, it is the secondary source that is wrong.

---

## Settled corrections

### E01 · `CmdBufRun` lives in the Status register

- 讹传：IOMMU 只在 Control Register（MMIO 0018h）的 `CmdBufRun = 1` 时处理命令。
- Misconception: "The IOMMU processes commands only when `CmdBufRun` in the Control Register (MMIO 0018h) is set."

- **Claim.** `CmdBufRun` is a read-only status bit at **bit 4 of the IOMMU Status Register, MMIO offset 2020h**; the control that enables command-buffer processing is **`CmdBufEn`, Control Register MMIO offset 0018h bit 12**.  `[IOMMU 3.11 §3.4]` `[7]` `C:high` `V:durable`
- **Owner:** `08-iommu-architecture.md`

### E02 · The IOMMU MMIO window is not 14 KiB, and its size is conditional

- 讹传：IOMMU 的 MMIO 窗口是 14 KiB。
- Misconception: "The IOMMU MMIO region is 14 KiB."

- **Claim.** The IOMMU MMIO region is **16 KBytes when `MMIO offset 0030h[PCSup]` is 0, and 512 KBytes when `PCSup` is 1**. The figure "14" is a misreading of the `BaseAddress[31:14]` field width, not a size.  `[IOMMU 3.11 §2.3]` `[7]` `C:high` `V:durable`
- **Owner:** `08-iommu-architecture.md`

### E03 · The IRTE bit-0 field is `RemapEn`

- 讹传：中断重映射表项的第 0 位叫 `RemapEm`。
- Misconception: "The interrupt remapping table entry's bit 0 is called `RemapEm`."

- **Claim.** The field is **`RemapEn`**. The specification uses that spelling throughout; `RemapEm` appears nowhere in it.  `[IOMMU 3.11 §2.2.5]` `[7]` `C:high` `V:durable`
- **Owner:** `10-iommu-interrupt-remapping.md`

### E04 · `#NPF` EXITINFO1 bit numbers

- 讹传：`#NPF` 的 EXITINFO1 中 bit 33 = 加密位不匹配、bit 34 = 页大小不匹配、bit 35 = VMPL 违例。
- Misconception: "In `#NPF` EXITINFO1, bit 33 is the encryption mismatch, bit 34 the page-size mismatch and bit 35 the VMPL violation."

- **Claim.** The AMD-defined bits are **31 (RMP), 32 (GUEST_FINAL), 33 (GUEST_PAGE), 34 (ENC), 35 (SIZEM), 36 (VMPL) and 37 (SSS)**; EXITINFO2 holds the faulting guest physical address. The mistaken numbering is off by one from bit 34 upward.  `[APM2 §15.36.10]` `[1]` `C:high` `V:durable`
- **Owner:** `05-exit-decoding.md`

### E05 · VMRUN's CR4 and EFER checks are MBZ rules, not fixed masks

- 讹传：VMRUN 的一致性检查是 "CR4[63:11] 非零" 与 "EFER[63:15] 非零"。
- Misconception: "VMRUN fails consistency checks when `CR4[63:11]` or `EFER[63:15]` is non-zero."

- **Claim.** The current manual states these as "**any MBZ bit of CR4 is set**" and "**any MBZ bit of EFER is set**"; the fixed bit ranges come from the 2005 SVM manual and no longer hold — CR4 bits 11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are all architecturally defined today, so the old form would reject a legal guest state.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`
- **Note.** Read the rule, not the constant. The point of this entry is that the manual states an **MBZ test**, so a hypervisor should test MBZ rather than hard-code any range; the enumeration above is illustrative and moves as AMD defines bits. The range itself was corrected from 20–24 to 20–23 on 2026-09-21 — Figure 3-7 prints CR4 bits 63:24 as Reserved, MBZ.
- **Owner:** `04-world-switch.md`

### E06 · Exit codes are segmented, not intercept-bit positions

- 讹传：EXITCODE 的数值等于对应拦截位在拦截向量中的位序。
- Misconception: "An exit code equals the position of its intercept bit within the intercept vector."

- **Claim.** The encoding is segmented: CR reads 00h–0Fh, CR writes 10h–1Fh, exceptions 40h–5Fh, intercept vector 3 at `0x60 + bit` and intercept vector 4 at `0x80 + bit` — so the VMRUN intercept, which is bit 0 of vector 4, is exit code **80h**.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Do not over-correct this one.** App.C's own sentence *is* that "intercept exit codes are equal to the bit position of the corresponding flag in the VMCB's intercept vector", and read one way that is true: treat the six intercept words at `000h`–`014h` as a single contiguous bit array and the rule is `code = 32 × vector + bit`. **The misconception is reading the bit index within a single 32-bit word** and expecting it to be the exit code. Correct the reading, not AMD's sentence.  `[APM2 App.C]` `[1]` `C:high` `V:durable`
- **Owner:** `05-exit-decoding.md`

### E07 · What `#VMEXIT` restores

- 讹传：`#VMEXIT` 只恢复 host 的 RIP、RSP、RAX 三个寄存器。
- Misconception: "`#VMEXIT` restores only the host's RIP, RSP and RAX."

- **Claim.** The enumerated set is **fourteen items**, and it is given in **§15.5.1 "Saving Host State"** — what VMRUN saves is exactly what `#VMEXIT` restores: **CS.SEL and NEXT_RIP · RFLAGS and RAX · SS.SEL and RSP · CR0, CR3, CR4 and EFER · IDTR and GDTR · ES.SEL and DS.SEL**. `#VMEXIT` additionally forces CR0.PE to 1.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** Three qualifiers matter. The manual says "**at least** the following", so the list is **not closed**. **Host LDTR is explicitly not saved or restored** — the manual states it in the same bullet as IDTR and GDTR. And APM Vol.3's VMRUN pseudo-code names two further non-restores, **host CR2 and host PAT**.  `[APM2 §15.5.1]` `[1][2]` `C:high` `V:durable`
- **Note.** This entry was itself incomplete until 2026-09-21: it omitted **RFLAGS and all four segment selectors** (CS, SS, ES, DS) and anchored to §15.6, where the enumeration does not appear. Corrected against Rev 3.45 p.523.
- **Owner:** `04-world-switch.md`

### E08 · VMLOAD and VMSAVE do not touch SS

- 讹传：VMLOAD/VMSAVE 传输的寄存器包括 SS。
- Misconception: "VMLOAD/VMSAVE transfer SS along with the other segment state."

- **Claim.** They transfer FS, GS, TR, LDTR, KernelGsBase, STAR, LSTAR, CSTAR, SFMASK and SYSENTER_CS/ESP/EIP. **SS is not among them.**  `[APM2 §15.5.2]` `[1]` `C:high` `V:durable`
- **Owner:** `04-world-switch.md`

### E09 · x2AVIC is `Fn8000_000A EDX[18]`

- 讹传：x2AVIC 的 CPUID 位是 `Fn8000_000A EDX[14]`。
- Misconception: "x2AVIC is enumerated by `Fn8000_000A EDX[14]`."

- **Claim.** x2AVIC is **`Fn8000_000A EDX[18]`**. `EDX[14]` is reserved; `EDX[13]` is AVIC and `EDX[15]` is VMSAVEvirt. A 2022 kernel patch letter carried `EDX[14]` in error and the mistake propagated.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Owner:** `07-virtual-interrupts-avic.md`

### E10 · The Hyper-V image on AMD hosts

- 讹传：AMD 平台上的 Hyper-V hypervisor 镜像是 `hvix64.exe`。
- Misconception: "Hyper-V loads `hvix64.exe` on AMD hosts."

- **Claim.** On Intel systems `Hvix64.exe` is loaded; **on AMD systems the image is `Hvax64.exe`**, and on ARM64 it is `Hvaa64.exe`. This is documented in *Windows Internals*, not in the learn.microsoft.com product documentation.  `[46]` `C:high` `V:durable`
- **Owner:** `16-windows-platform.md`

### E11 · The worst-case two-dimensional walk, and where the number comes from

- 讹传：嵌套分页把原生的 4 次查表变成 16 次。
- Misconception: "Nested paging turns a 4-reference native walk into a 16-reference walk."

- **Claim.** With four-level guest paging and four-level nested paging the worst case is **24 memory references**, following the general form `nm + n + m` (identical to `(n+1)(m+1) − 1`); the subtracted reference is the fetch of the datum itself.  `[NP-WP §4.2.2]` `[15][56]` `C:high` `V:durable`
- **Sourcing rule.** **Neither the APM nor the Intel SDM states this figure** — both give only per-dimension walk lengths. Cite the AMD-V Nested Paging white paper or the ASPLOS'08 paper. An anchor of the form `[APM2 §15.25.x]` on this number is a fabrication.
- **Owner:** `06-nested-paging.md`

### E12 · SEV on client parts `[reversed]`

- 讹传：SEV/SEV-ES/SEV-SNP 只存在于 EPYC，客户端 Ryzen 上 `Fn8000_001F EAX[1]` 读 0。
- Misconception: "SEV is EPYC-only; `Fn8000_001F EAX[1]` reads 0 on every client Ryzen."

- **Claim.** SEV is **productised** on EPYC, which is not the same as absent from client silicon: CPUID dumps from non-PRO consumer parts including the Ryzen 9 3900X and the Ryzen 7 5800X3D report `Fn8000_001F EAX[1] = 1` with 509 ASIDs. **Zen 4 and later client parts expose SME only**, and **SEV-SNP has never been set on a client part**.  `[35]` `C:medium` `V:durable`
- **Do not write** "`EAX[1]` reads 0 on Ryzen" — a Zen+/2/3 desktop disproves it immediately. The defensible client statement is about TSME / AMD Memory Guard.
- **Owner:** `11-memory-encryption.md`

### E13 · Nested virtualization on AMD under Hyper-V

- 讹传：Hyper-V 的嵌套虚拟化不支持 AMD。
- Misconception: "Hyper-V nested virtualization is Intel-only."

- **Claim.** Microsoft documents nested virtualization for "**AMD EPYC / Ryzen processor or later**", with the host running Windows Server 2022 or later, or Windows 11 or later, and a **VM configuration version of 9.3 or higher**. Microsoft names no Zen generation — do not add one.  `[41]` `C:high` `V:durable`
- **Owner:** `16-windows-platform.md`

### E14 · Hyper-V and SEV

- 讹传：Hyper-V 不支持 AMD SEV（无条件表述）。
- Misconception: "Hyper-V does not support AMD SEV."

- **Claim.** Client and Server Hyper-V do not expose SEV to guests, but the statement is false as an unconditional one: Azure's Hyper-V hosts run SEV-SNP confidential VMs with a paravisor at VMPL0. State the scope, not the bare negative.  `[41]` `C:medium` `V:durable`
- **Note.** The current cloud status belongs in `90-dated-landscape.md`; only the mechanism statement is durable.
- **Owner:** `16-windows-platform.md`

### E15 · Running VMware or VirtualBox alongside Hyper-V

- 讹传：要跑 VMware Workstation 或 VirtualBox，必须先关掉 Hyper-V。
- Misconception: "You must disable Hyper-V to run VMware Workstation or VirtualBox."

- **Claim.** Both run over the Windows Hypervisor Platform with VBS enabled — VMware Workstation Pro from **15.5.5** (Broadcom calls it "Host VBS Mode") and VirtualBox from **6.0**. The limits are documented rather than incidental: slower VMs, **no nested virtualization**, no performance counters, no RTM/HLE and no PKU; VirtualBox still labels the path experimental.  `[47][48]` `C:high` `V:durable`
- **Owner:** `16-windows-platform.md`

### E16 · SEVurity is not SEVerity

- 讹传：AMD-SB-1004 对应的是 SEVurity。
- Misconception: "AMD-SB-1004 is AMD's response to SEVurity."

- **Claim.** AMD-SB-1004 acknowledges **SEVerity, CVE-2020-12967**, and the same bulletin also covers **CVE-2021-26311**, which is the *undeSErVed trust* paper from the University of Lübeck. Both were presented at **WOOT'21** and the bulletin was published 2021-05-11. **SEVurity** is a different paper again — first author Luca Wilke, IEEE S&P 2020 — and carries no CVE.  `[19]` `C:high` `V:durable`
- **Note.** AMD-SB-1004's own severity rating is **Medium**, while NVD scores both its CVEs **7.2 High**. Quote whichever you cite, and say which.
- **Owner:** `17-security.md`

### E17 · Why SEV-ES is disabled on some SNP systems

- 讹传："SEV-ES 在支持 SNP 的 CPU 上被禁用" 是 Zen 5 的代际特性。
- Misconception: "SEV-ES being disabled on SNP-capable CPUs is a Zen 5 generational property."

- **Claim.** It is the documented side effect of a security mitigation: applying the CVE-2025-48514 mitigation "will result in disabling **SEV-ES** when SEV-SNP is **enabled**". Three details matter — only SEV-ES is affected (not SEV), the trigger is SNP being *enabled* rather than merely supported, and the fix spans Zen 3, 4 and 5.  `[AMD-SB-3023]` `[23]` `C:high` `V:durable`
- **Owner:** `17-security.md`

### E18 · The 255-vCPU figure is not an architectural limit

- 讹传：SEV-SNP 的 vCPU 上限是 255，这是架构限制。
- Misconception: "SEV-SNP guests are architecturally limited to 255 vCPUs."

- **Claim.** 255 is a hypervisor-side xAPIC-era limit, not a property of SEV-SNP. Configurations using x2APIC exceed it.  `[57]` `C:medium` `V:durable`
- **Owner:** `14-sev-snp.md`

### E19 · The memory-encryption mode is generational

- 讹传：SEV 全代使用 AES-XEX（有时误写成 "AES-XE"）。
- Misconception: "The SEV family uses AES-XEX throughout."

- **Claim.** The encryption mode differs by generation and must be stated per generation rather than as a family-wide property; "AES-XE" is not a mode name at all.  `[35]` `C:low` `V:durable`
- **Note.** The per-generation mapping is an open conflict — see `O1`. Current values belong in `90-dated-landscape.md`.
- **Owner:** `90-dated-landscape.md`

### E20 · CVE-2024-25744 is a Heckler CVE `[reversed]`

- 讹传：CVE-2024-25744 是 Intel TDX 的内核问题，与 SEV-SNP 无关。
- Misconception: "CVE-2024-25744 is an Intel TDX guest issue and does not concern AMD."

- **Claim.** AMD's bulletin assigns **CVE-2024-25742, 25743 and 25744 all to Heckler**, and the kernel fix is titled "Disable 32-bit emulation by default on TDX **and SEV**", touching `mem_encrypt_amd.c`. 25744 covers TDX *and* SEV; 25743 is the AMD-specific interrupt-0/14 half. The paper appeared at USENIX Security 2024.  `[AMD-SB-3008]` `[20]` `C:high` `V:durable`
- **What the old corpus actually got wrong** was the affected-generation column (it listed feature names, not generations) and an internal date conflict (2024-08 in the table against 2024-03 in the prose) — not the attribution.
- **Owner:** `17-security.md`

### E21 · IVRS device-entry lengths `[reversed]`

- 讹传：IVRS 设备条目的长度规则是 type <40h → 4 字节、40h–7Fh → 8 字节、80h–BFh → 16 字节。
- Misconception: "IVRS device entries of type 80h–BFh are 16 bytes."

- **Claim.** The specification defines **00h–3Fh as 4 bytes, 40h–7Fh as 8 bytes and 80h–FFh as variable length**. There is no fixed 16-byte class; that figure is an extrapolation from a kernel-side shift expression.  `[IOMMU 3.11 §5.2]` `[7]` `C:high` `V:durable`
- **Owner:** `09-iommu-page-tables.md`

### E22 · VMGEXIT accepts both prefixes `[reversed]`

- 讹传：VMGEXIT 的编码只有 `F3 0F 01 D9`，`F2` 形式是错的。
- Misconception: "VMGEXIT is `F3 0F 01 D9` only."

- **Claim.** The instruction reference gives the opcode as **`F2/F3 0F 01 D9`** — both prefixes are architectural.  `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
- **Owner:** `13-sev-es-ghcb.md`

### E23 · CVE-2021-29657's CVSS `[reversed]`

- 讹传：CVE-2021-29657 的 CVSS 基础分是 7.8。
- Misconception: "CVE-2021-29657 scores 7.8."

- **Claim.** NVD publishes **7.4** (`CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H`, scored by `nvd@nist.gov`).  `[55]` `C:high` `V:durable`
- **Owner:** `17-security.md`

### E24 · `SEV_STATUS` bit 7 is DebugVirtualization

- 讹传：`SEV_STATUS`（C001_0131h）bit 7 叫 "Debug Swap"。
- Misconception: "`SEV_STATUS` bit 7 is Debug Swap."

- **Claim.** AMD's table names bit 7 **`DebugVirtualization`**; "Debug Swap" is the Linux-side name and appears nowhere in AMD's documentation. The same table defines bit 3 vTOM, 4 ReflectVC, 5 RestrictedInjection, 6 AlternateInjection, 11 SecureTsc, 16 VmsaRegProt, 18 SecureAVIC and 23 IbpbOnEntry.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`
- **Claim.** That list is not the whole register. Rev 3.45 also defines **0 SEV, 1 SEV-ES, 2 `SNP_Active`, 8 `PreventHostIBS`, 9 `SNPBTBIsolation`, 10 `VmplSSS`, 12 `VmgexitParameter`, 13 `PmcVirtualization`, 14 `IbsVirtualization`, 15 `GuestInterceptCtl` and 17 `SmtProtection`**.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`
- **Claim.** `SEV_STATUS` and the VMSA's `SEV_FEATURES` word are the same feature set offset by two: **`SEV_STATUS[n] = SEV_FEATURES[n−2]` for every n ≥ 2**, because bits 0 and 1 carry SEV and SEV-ES from the VMCB rather than from `SEV_FEATURES`. This is why `DebugVirtualization` is `SEV_FEATURES[5]` but `SEV_STATUS[7]` — a Linux header or paper written in `SEV_FEATURES` terms will look uniformly off by two, and "correcting" the table to match it is the error this note exists to prevent.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`
- **Note.** AMD's own table prints "22-18 Reserved" directly above the row defining bit 18; read it as 22:19.
- **Owner:** `12-sev.md`

### E25 · The attestation report version

- 讹传：ATTESTATION_REPORT 的 VERSION 取值是 2/3/5。
- Misconception: "The attestation report VERSION field is 2, 3 or 5."

- **Claim.** The report version has moved across firmware ABI revisions and **4h never existed**, so a corpus listing 2/3/5 as the possible values is reporting a stale set rather than an enumeration.  `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`
- **Note on the anchor.** Only the *current* value is attested by the cited table; the earlier points of the progression come from earlier ABI revisions, and **3h is attested in neither locally held revision (1.58, 1.59)**. Cite the revision you read for whichever value you quote, rather than citing one table for the whole sequence. The durable claim here is that the set moves and that 4h was never in it.
`[10]` `C:high` `V:durable`
- **Note.** The **current** version value is version-bearing and belongs in `90-dated-landscape.md`; what is durable is that the set is a moving progression and that 4h was never in it.
- **Owner:** `14-sev-snp.md`

---

### E26 · CVE-2022-23816 is a REJECTED identifier

- 讥传：Branch Type Confusion / RETbleed 在 AMD 侧的编号是 CVE-2022-23816（或 23825 / 23816 两个并列）。
- Misconception: "AMD's Branch Type Confusion / RETbleed identifier is CVE-2022-23816."

- **Claim.** **CVE-2022-23816 is REJECTED at NVD.** The record's `vulnStatus` is `Rejected` and its only description reads "DO NOT USE THIS CANDIDATE NUMBER. ConsultIDs: none. Reason: This candidate is unused by its CNA." The citable identifier is **CVE-2022-29900**. AMD-SB-1037 itself writes the pairing as "CVE-2022-29900 (RETbleed) (aka CVE-2022-23816)", which is how the dead number keeps circulating.  `[55]` `C:high` `V:durable`
- **Owner:** `17-security.md`

### E27 · "AMD publishes no errata channel for client parts" — **this skill's own claim, false in all three clauses**

- 讥传：AMD 不为客户端部件发布勘误；修订指南只覆盖 EPYC；客户端 Ryzen 既无公开修订指南也无公开 PPR。
- Misconception: "AMD publishes no errata channel for client parts. Revision guides exist for EPYC families only; client Ryzen has no public revision guide and no public PPR."

This was **not** a claim the corpus inherited from elsewhere. It was written here, and it stood in **eight** places — `SKILL.md`, `00-quickref.md`, `06-nested-paging.md` twice, `07-virtual-interrupts-avic.md`, `17-security.md`, this file's `O2`, and a `$comment` in `lint.config.json`. It is the **third fabricated negative** in this corpus; the first two are recorded in `README.md` and are what put "a negative claim needs the same evidence as a positive one" into the work contract. The contract did not prevent a third.

- **Claim.** Revision Guide 55449 covers client parts: its applicable packages include AM4, and its Table 12 cross-references errata to *AMD Ryzen Processors*, *2nd Generation AMD Ryzen Processors* and *AMD Ryzen Threadripper* segments. Erratum 1235 at p.87 is a first-party, numbered, client-scoped virtualization erratum.  `[RevGuide 55449 erratum 1235]` `[29]` `C:high` `V:durable`
- **Claim.** Client Processor Programming References are published first-party and marked `[AMD Public Use]` — Cezanne 56569, Phoenix 57019, Strix Halo 57930, plus Dali 55772-A1, Castle Peak 55803 and Renoir 55922-A1, with OSRR 56255 for Family 17h Models 00h–2Fh.  `[no-spec]` `[31][32][33]` `[660]` `[661]` `C:high` `V:durable`
- **Claim.** `AMD-SB-4xxx` is a numbered client bulletin series running parallel to the `AMD-SB-3xxx` server series, and AMD-SB-4013 points readers at "the corresponding Client Revision Guide of the product" for errata #1165, #1166 and #1526.  `[AMD-SB-4013]` `[662]` `C:high` `V:durable`

**How it survived:** the refutation was already inside the skill. `bibliography.md` lists the Cezanne, Phoenix and Strix Halo client PPRs as T1 entries `[31]`–`[33]`, **three lines below** a note asserting that Phoenix and Strix had no public PPR. This is the same shape as the earlier defect recorded in `README.md`, where a chapter held the corroborating definition in its own citation and drew the opposite conclusion from it.

**What replaces it** — a negative scoped to documents and a date, per the work contract: as of **2026-09-26**, no public revision guide covers a Family 19h or 1Ah *client* model range; four client PPRs (56176, 56214, 56713, 57254) have no retrievable first-party copy; and client bulletins give an AGESA/PI version rather than a microcode patch level.

- **Owner:** `17-security.md`

## Open conflicts

These are recorded, not resolved. When a chapter touches one, it must present both readings and say the question is open.

### O1 · SEV key slots per generation — **resolved 2026-09-21**

This asked for a first-party source naming **both** the generation and the count, because the pre-rebuild corpus assigned 509 to Milan in one chapter and to Rome in two others. AMD's own SEV developer page carries exactly that table, and two independent captures agree:

- **Claim.** AMD states **15 keys for EPYC 7001, 509 for EPYC 7002, and 1006 for "8004 & 9004"**. The encryption mode moves with it: **128-bit AES XEX on 7001**, and **256-bit AES-XTS from the 8004/9004 row** — which resolves the `E19` entanglement too. The table's `rowspan` makes 8005 and 9005 share the 8004/9004 capability cell.  `[35]` `C:high` `V:durable`
- **Owner:** `12-sev.md`. Generation-to-product availability stays in `90-dated-landscape.md`; the key-slot count is a shipped hardware property and is durable.

### O2 · AVIC erratum #1235's disclosure year — **settled 2026-09-26, number kept**

The erratum was described both as the reason AVIC stayed off by default "for about eight years" and as a 2025–2026 item. Both halves are now settled; the entry keeps its `O` number because the 2025–2026 framing still circulates.

- **Claim.** Erratum #1235 is named in `arch/x86/kvm/svm/avic.c` from **Linux 5.17**, and is absent at 5.16. A 2025–2026 disclosure is therefore ruled out; whatever carries those later dates is not the erratum's first appearance.  `[57]` `C:high` `V:durable`
- **Claim.** AMD's own publication is **Revision Guide 55449, Family 17h Models 00h–0Fh**, where erratum 1235 sits at p.87 and first enters the document's revision history at **rev 1.17, 2019-07**. The "about eight years" framing is therefore the accurate one. The same text also appears at `[RevGuide 56323 p.39]`.  `[RevGuide 55449 erratum 1235]` `[29]` `[30]` `C:high` `V:durable`

**What blocked this for so long was a false premise, not a missing document.** The prior text reasoned that the erratum "most likely belongs to a Family 17h guide" — which was correct — and then concluded it might never be resolvable because "there is no public revision guide for client Ryzen". That second clause was false: 55449 is public, first-party, and covers client parts. The hypothesis was right and was abandoned on a fabricated negative. See `E27`.

### O3 · SEV-SNP versus TDX memory overhead — **reframed 2026-09-21**

Previously recorded as "two published measurements disagree in sign". Tracing the sources showed that is not the shape of the conflict: **both figures come from the same TUM study**, one from its MLC microbenchmark and one from its Phoronix memory suite. The disagreement is **between benchmarks inside one paper**, not between two papers — which makes averaging them even less defensible, and makes "a later study overturned the earlier one" simply false.

Present both with the benchmark that produced each. The figures and their platform conditions are owned by `18-performance.md` §18.8; note that the study's platform is **1× EPYC 9654P** (the 2× configuration in circulation is its *Intel* comparison machine).

### O4 · Whether any modern measurement supports "NPT is 15–30% faster than shadow paging"

The figure traces to a 2008 vendor number relayed through a hardware site. No modern measurement in this corpus supports a single range. Until one is found, the claim may not be stated as a present-tense fact.

### O5 · The chapter map of the SEV API specification — **resolved 2026-09-21**

This entry previously said pub 55766 has "Ch.1–Ch.6, no §7". **That was wrong, and so was `CONVENTIONS.md` §5.** The Rev 3.24 bookmark tree gives: Ch.1 Overview · Ch.2 Key Management · Ch.3 Guest Policy · Ch.4 Mailbox Register Protocol · Ch.5 Platform Management API · Ch.6 Guest Management API · **Ch.7 Debugging API (p.109, §7.1 `DBG_DECRYPT`, §7.2 `DBG_ENCRYPT`)** · **App.A Usage Flows** · **App.B AMD CA Certificates** · **App.C SEV Certificates**.

The entry is kept under its original number because the wrong map circulated in the pre-rebuild corpus. Two naming traps inside the document are real and remain:

- §6.8's heading and Table 61 print **"ATTESATION"**; Table 13 and Table 43 spell `ATTESTATION` correctly, command ID `036h`.
- `034h` is `LAUNCH_UPDATE_SECRET` in Table 13 but `LAUNCH_SECRET` in the §6.6 heading.

Note also that 55766 covers **SEV and SEV-ES only** — SNP firmware commands are in 56860.

### O6 · The five-level (LA57) two-dimensional walk figure

Applying `nm + n + m` to five-level paging in both dimensions gives 35, and mixed four/five-level cases give 29. **No published source states either number** — they are derivations. Any chapter using them must say so and carry `C:medium`.

### O7 · `AUTHOR_KEY_DIGEST` — AMD's Table 27 contradicts itself

- **Claim.** `AUTHOR_KEY_EN`, bit 0 at offset `48h`, reads "Indicates that the digest of the author key is **present** in AUTHOR_KEY_DIGEST. Set to the value of GCTX.AuthorKeyEn." The `AUTHOR_KEY_DIGEST` row at offset `110h` reads "SHA-384 digest of the Author public key that certified the ID key, if provided in … **Zeroes if AUTHOR_KEY_EN is 1**." Those cannot both be true.  `[SNP-ABI 1.59 Table 27]` `[10]` `C:high` `V:durable`
- **Do not resolve it by picking the sensible reading.** The bit-0 description is the one that makes operational sense, and an earlier draft of `14-sev-snp.md` asserted it as settled. That is the failure this file exists to prevent: a specification contradicting itself is an open conflict, not an invitation to choose. Anything relying on this field for attestation policy should treat it as unreliable and say so.
- **Owner:** `14-sev-snp.md` §14.11, which now states both halves.
