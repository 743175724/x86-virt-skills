# 90. Dated Landscape

> **中文速览**：本文件是整个技能的**时效隔离区**。云厂商实例状态、内核合入点、硅片路线图、市场份额、厂商宣传口径——一切会过期的事实全部关在这里，其他任何章节都不得出现 `V:dated` 断言。本文件的有效日期是 **2026-09-16**；引用它回答问题时，必须告诉用户这是一份带日期的快照，并要求在据此行动前回官方来源复核。需要长期稳定的架构事实，请读 `01`–`18` 章；需要已知讹传的纠正，请读 `errata.md`。

---

## As-of date: 2026-09-16

**Every claim in this file was true as of 2026-09-16 and is asserted nowhere else in this skill.** `V:dated` is permitted only here.

### Mandatory instruction to the reading agent

Any answer that depends on a fact from this file **must tell the user that it is a dated snapshot taken on 2026-09-16, and must be re-verified against the vendor's own official source before being acted on.** Do not present anything below as the current state of the world. If the user's question turns on whether something is available, shipping, merged, priced or supported *today*, say that this skill cannot know and name the page to check (Intel support article, cloud provider release notes, kernel changelog, vendor pricing page).

### Fastest-decaying category — read this before quoting anything below

Cloud GA/preview status, pricing, market share, kernel merge status and roadmaps are **the fastest-decaying and the most frequently mis-reported** class of fact in this whole domain. They decay in months, and secondary sources routinely promote a preview to "GA", collapse an announcement into a ship date, or repeat a vendor's own benchmark as an independent result. The Azure TDX case in `errata.md` (E15) is the canonical example: a public preview announced 2023-11-15 was widely recorded as a December 2023 GA, and the actual first Azure TDX GA came more than two years later.

### Status tags

Every item below carries one:

| Tag | Meaning |
|---|---|
| `[GA]` | Generally available, shipping, merged, or documented as current behaviour |
| `[announced]` | Officially announced by the vendor but not shipping, or shipping date in the future |
| `[preview]` | Preview, beta, early access, invitation-only or technology preview |
| `[vendor-stated]` | A vendor's own claim, reproduced in attributed voice; no independent corroboration |
| `[rumoured]` | Media report or leak, not confirmed by the vendor; may conflict with official figures |

**Owns:** cloud provider status, kernel/distro/hypervisor merge and release status, silicon roadmap, market and commercial figures, dated security events, and every vendor performance claim.
**See also:** `errata.md` (the corrections that arose from this material), `13-tdx.md` (TDX architecture), `16-performance.md` (measurement numbers with their conditions), `17-windows-platform.md` (durable software architecture).

---

## 90.1 Cloud provider status

### 90.1.1 AWS

- **Claim.** `[GA]` EC2 `.metal` instances are not virtualized: they do not run under a hypervisor, the customer gets the whole physical CPU, and the customer may run their own hypervisor on them — which non-metal instances do not allow.  `[550]` `C:high` `V:dated`
- **Claim.** `[GA]` Since 2026-02, AWS supports nested virtualization on *virtualized* C8i / M8i / R8i instances, enabled at launch with `--cpu-options "NestedVirtualization=enabled"`; only KVM and Hyper-V are supported as the L1 hypervisor and Graviton instances are excluded. Before that, nested virtualization was available only on bare-metal instances.  `[551]` `C:high` `V:dated`
- **Claim.** `[vendor-stated]` AWS states that the Nitro hypervisor is built on the Linux KVM core module without QEMU or a dom0, that it uses posted interrupts and APICv to reduce VM exits, and that its overhead is "typically less than 1% (hard to measure)". This figure comes from an AWS re:Invent 2017 talk; no independent benchmark reproducing it was found.  `[554]` `C:medium` `V:dated`
- **Claim.** `[preview]` At re:Invent 2025 (session CMP359) AWS announced the Nitro Isolation Engine, written in Rust and formally verified with the Isabelle proof assistant, in preview on Graviton 5; AWS describes it as the world's first formally verified hypervisor — that superlative is AWS's own and is not independently adjudicated.  `[553]` `C:medium` `V:dated`

### 90.1.2 Azure

- **Claim.** `[preview]` Azure DCesv5 / ECesv5 (Sapphire Rapids, Intel TDX) were announced as **public preview** on 2023-11-15 and became deployable on 2023-12-07 — still as a preview. They never reached GA under those names.  `[556]` `C:high` `V:dated`
- **Claim.** `[GA]` Azure's first generally available Intel TDX confidential VMs are the DCesv6 / DCedsv6 / ECesv6 / ECedsv6 series (Emerald Rapids, with the open-source OpenHCL paravisor and Azure Boost), announced GA on 2026-02-26, initially in West US, West US 3 and West Europe, with Windows Server 2025, Ubuntu 22.04/24.04 and RHEL guests.  `[557]` `C:high` `V:dated`
- **Claim.** `[GA]` Azure has supported nested virtualization since 2017-07, introduced with the Dv3 and Ev3 sizes running on Windows Server 2016 hosts.  `[558]` `C:high` `V:dated`
- **Claim.** `[announced]` Microsoft announced Azure Boost in 2023, offloading networking, storage and host management from the hypervisor and host OS to dedicated hardware; the preview figures Microsoft gave were 200 Gbps networking, up to 10 GBps remote storage throughput and 400K IOPS. These are Microsoft's own preview numbers.  `[555]` `C:medium` `V:dated`

### 90.1.3 Google Cloud

- **Claim.** `[GA]` Google Compute Engine has supported nested virtualization since 2017-09-28; it requires an Intel Haswell or later CPU platform and the L1 hypervisor must be Linux KVM. E2, memory-optimized, AMD-based, Arm-based and H4D VMs are excluded.  `[559]` `C:high` `V:dated`
- **Claim.** `[GA]` Google Cloud C3 confidential VMs (Sapphire Rapids + Intel TDX) reached GA on 2024-10-02, with remote attestation optionally served by Intel Trust Authority as an evaluator independent of Google Cloud.  `[561]` `C:high` `V:dated`
- **Claim.** `[vendor-stated]` Google states that its Titanium architecture moves hypervisor processes, the virtualization stack and storage/networking I/O management off the host CPU onto purpose-built hardware, and that the visible component is an Infrastructure Processing Unit (IPU) add-in card co-developed with Intel.  `[560]` `C:medium` `V:dated`

### 90.1.4 Alibaba Cloud

- **Claim.** `[GA]` Alibaba Cloud 8th-generation ECS g8i instances (Sapphire Rapids) integrate Intel TDX and reached GA in 2023-03; the 9th generation (g9i/c9i/r9i) also supports TDX. Documented limitations of the TDX instances include no in-instance reboot, no VNC, no Windows guest, and a UEFI image requirement.  `[562]` `C:high` `V:dated`
- **Claim.** `[GA]` Alibaba Cloud Elastic Bare Metal (EBM) servers are built on the third-generation Shenlong architecture and are documented as compatible with third-party hypervisors for hybrid- and multi-cloud deployment.  `[563]` `C:high` `V:dated`
- **Claim.** `[GA]` Alibaba Cloud's own migration documentation states that ordinary (non-bare-metal) ECS instances do not support nested-virtualization software, so VMware Workstation, VirtualBox and Hyper-V cannot run inside them.  `[564]` `C:high` `V:dated`
- **Claim.** `[vendor-stated]` Alibaba states that before Shenlong, a 32-core physical server spent about 12 cores on virtualization — "close to 40% virtualization loss" — and that the 2017 Shenlong architecture achieved near-zero-loss virtualization and was released "one month earlier than Amazon Nitro". This is a single-party account with no independent corroboration, and AWS's Nitro precursors (C3 SR-IOV in 2013, C4 EBS offload in 2015) predate 2017. Do not assert it; attribute it. See `errata.md` E13.  `[565]` `C:low` `V:dated`
- **Claim.** `[vendor-stated]` Alibaba marketing material states that Shenlong delivers "100% of physical-machine compute performance, zero virtualization loss", "5x I/O performance" and "160% overall server performance improvement". These are vendor figures without published methodology or third-party replication; they must never be written in claim voice.  `[566]` `C:low` `V:dated`

### 90.1.5 Tencent Cloud

- **Claim.** `[vendor-stated]` Tencent states that CVM virtualization overhead was about 15% before its Starlake (星星海) co-design work, that internal WeChat/QQ workloads required 8% or less to move to the cloud, and that measured overhead subsequently fell below 5%. Vendor self-report, no published methodology.  `[567]` `C:low` `V:dated`

### 90.1.6 Huawei Cloud

- **Claim.** `[vendor-stated]` Huawei states that its Qingtian (擎天) architecture offloads storage, virtualization and networking onto a dedicated Qingtian card, passing VFs through to VMs by SR-IOV so that traffic "completely bypasses the hypervisor layer", and claims "zero resource reservation, zero performance loss, zero business jitter". Vendor white-paper language, not a measurement.  `[568]` `C:low` `V:dated`
- **Claim.** `[GA]` Huawei Cloud's own documentation states that the platform does not support nested virtualization: the Workspace product bulletin bans emulator scenarios for that reason, and the HuaweiCloudStack 6.5.1 FAQ confirms VT-x cannot be exposed inside a guest.  `[569]` `C:high` `V:dated`

### 90.1.7 IBM Cloud

- **Claim.** `[GA]` IBM Cloud Virtual Servers for VPC offers 4th-Gen Xeon Intel TDX instances under the bx3dc and cx3dc profiles; availability expanded from us-east (Washington) to eu-de (Frankfurt) in 2025-10, with an entry price around USD 115 per month.  `[570]` `C:medium` `V:dated`

### 90.1.8 Volcengine

- **Claim.** `[preview]` Volcengine's security-enhanced g3ilt / g4ilt Intel TDX instances were released for invitation-only trial in the North China 2 region in 2024-12 and were still invitation-only as of 2026-03; ready-made Ubuntu 24.04, Rocky 9.5 and veLinux 2.0 for TDX images and a regional PCCS are provided.  `[571]` `C:medium` `V:dated`

### 90.1.9 Bare-metal architectures at a glance

- **Claim.** `[GA]` The five offload architectures in production as of the as-of date are AWS Nitro, Azure Boost, Google Titanium (IPU co-developed with Intel), Alibaba Shenlong/MOC and Huawei Qingtian. All five move the network/storage data plane off the host CPU; the CPU-side virtualization substrate underneath them is the same VT-x/EPT/VT-d/APICv hardware in every case. Every quantitative overhead figure any of these vendors publishes is vendor-stated.  `[553][555][560][566][568]` `C:medium` `V:dated`

---

## 90.2 Kernel, hypervisor and distro support

- **Claim.** `[GA]` TDX **guest** support entered Linux progressively from 5.19 (2022-07); the guest attestation driver arrived in 6.2.  `[575]` `C:medium` `V:dated`
- **Claim.** `[GA]` TDX **host** support in KVM was merged into mainline Linux **6.16** in the 2025-06 merge window, described in the pull request as "Initial support for TDX in KVM", covering private page tables, TDVMCALL forwarding and the TDX-specific VM-exit paths. Host support had lived out of tree for years before that.  `[574]` `C:high` `V:dated`
- **Claim.** `[GA]` TDX Module version series are platform-specific: the 1.5.x series runs on Sapphire Rapids, Emerald Rapids and Sierra Forest, and 2.0.x is required for Granite Rapids and Xeon 6+ (Clearwater Forest). A 1.5.x module will not run on Granite Rapids.  `[575][584]` `C:high` `V:dated`
- **Claim.** `[GA]` Ubuntu 25.10 (kernel 6.17, released 2025-10-09) shipped early Intel TDX host support; Ubuntu 26.04 LTS (2026-04) provides native host and guest support for both Intel TDX and AMD SEV-SNP. Canonical's documentation states guest support from 24.04 LTS and host support from 25.10.  `[576][577]` `C:high` `V:dated`
- **Claim.** `[GA]` VMware Cloud Foundation / ESXi 9.1, GA on 2026-05-12, lists Intel TDX as a generally available feature, compatible with 5th-Gen Xeon (Emerald Rapids) and later. The release notes were consulted through a third-party mirror and should be rechecked against Broadcom's original.  `[579]` `C:medium` `V:dated`
- **Claim.** `[announced]` OpenStack Nova approved the libvirt Intel TDX support specification for the 2026.2 cycle on 2026-09-07; it requires kernel ≥ 6.16, QEMU ≥ 10.1 and libvirt ≥ 11.6.  `[578]` `C:high` `V:dated`
- **Claim.** `[GA]` QEMU mainline carries a `tdx-guest` object under `confidential-guest-support`, with documented limitations: a split irqchip is required, private memory has no read-only support, and SMM is unavailable.  `[580]` `C:medium` `V:dated`
- **Claim.** `[GA]` IPI virtualization, together with the tertiary processor-based VM-execution control framework that carries it, was merged into KVM for Linux 5.19 (2022-05).  `[582]` `C:high` `V:dated`
- **Claim.** `[GA]` Notify VM exit was merged into KVM in 2022 with `KVM_CAP_X86_NOTIFY_VMEXIT`; it is off by default (`notify_window = -1`).  `[581]` `C:high` `V:dated`
- **Claim.** `[announced]` As of 2026-08 the KVM mailing list was still reviewing "KVM: TDX: Enable VM-DoS Prevention Features for TDX" (v3), which brings Notify and Bus-lock VM exit to trust domains, and the TDX KVM selftests series (v14). Neither was merged as of the as-of date.  `[583]` `C:medium` `V:dated`
- **Claim.** `[GA]` Deployment friction persists below the software stack: in 2026-03 a Granite Rapids TDX initialisation failure on a Gigabyte MS04-CE0 board was confirmed by Intel Support as a BIOS defect in the SEAMRR handover, not a CPU limitation. "The CPU supports it" is not the same as "the platform can run it".  `[573]` `C:low` `V:dated`

---

## 90.3 Silicon and roadmap

### 90.3.1 Shipping generations

- **Claim.** `[GA]` Sapphire Rapids (4th Gen Xeon), Emerald Rapids (5th Gen Xeon) and Sierra Forest (Xeon 6, E-core) run TDX Module 1.5.x; Granite Rapids (Xeon 6, P-core) runs TDX Module 2.0.x, and only the P-core Xeon 6 parts additionally carry hardware support for Intel TDX Connect (TEE-IO).  `[584][585][586]` `C:high` `V:dated`
- **Claim.** `[GA]` Intel's TDX feature-readiness page gives the TDX AES key strength as 128 bit on 4th- and 5th-Gen Xeon and **256 bit** on Xeon 6 (both E-core and P-core), and lists Trust Domain live migration, TD preservation, remote attestation and logical/cryptographic memory integrity for Xeon 6.  `[585]` `C:high` `V:dated`
- **Claim.** `[GA]` The Xeon 6 launch sequence recorded in this rebuild is Sierra Forest (Xeon 6700E) at Computex on 2024-06-04, Granite Rapids-AP (6900P) on 2024-09-24, and Granite Rapids-SP (6700P/6500P) on 2025-02-24. These dates were taken from secondary reporting of Intel's launches and were not re-verified against the individual Intel press releases; check the Xeon 6 press kit before quoting a specific day.  `[588]` `C:low` `V:dated`
- **Claim.** `[GA]` Clearwater Forest (Xeon 6+) was launched at Computex on 2026-06-01 as Intel's first Intel 18A data-center CPU, with Darkmont E-cores, up to 288 cores per socket, integrated SGX and TDX, and reuse of the LGA 7529 socket; ServeTheHome reported it as shipping, with existing 6900P boards typically needing only a BIOS update. E-core parts have no AVX-512.  `[589][590]` `C:medium` `V:dated`
- **Claim.** `[GA]` The public TDX Module 2.0 release notes list Xeon 6+ (Clearwater Forest) among supported platforms; as of 2026-08 the 1.5.x and 2.0.x lines were both still being maintained, the newest public 2.0 build dating from 2026-02-11 and the newest 1.5 build from 2026-03-30.  `[584]` `C:high` `V:dated`
- **Claim.** `[GA]` Panther Lake (Core Ultra 300) launched at CES on 2026-01-05 as Intel's first Intel 18A client SoC. Intel disclosed no new client VMX or TDX features with it; TDX remains Xeon-only and client parts still carry only VT-x and VT-d.  `[591]` `C:medium` `V:dated`

### 90.3.2 TDX Connect / TEE-IO

- **Claim.** `[announced]` Intel announced hardware support for Intel TDX Connect (TEE-IO) on Xeon 6 P-core processors on 2025-02-24. Intel's own statement is that a TDX Connect solution requires a capable CPU **plus** an enabled host OS/hypervisor **plus** a TEE-IO capable device; no end-to-end GA date has been announced. Treat "TDX Connect is GA" as false. See `errata.md` E14.  `[587][588]` `C:high` `V:dated`
- **Claim.** `[GA]` The TDX Module release history shows TDX Connect pre-production interfaces appearing in module build 2.0.04 (2024-08-14) and support for partitioned TD usage with TDX Connect in 2.0.08 (2025-01-16) — module-side plumbing, not a shipping end-to-end product.  `[584]` `C:high` `V:dated`

### 90.3.3 Roadmap

- **Claim.** `[announced]` Intel previewed Diamond Rapids (Xeon 7) at Computex 2026 for a **2027** launch: Intel 18A-P, Panther Cove-X P-cores, an officially confirmed core count +50% over Granite Rapids, 16 memory channels with roughly double the memory bandwidth, and PCIe Gen6.  `[592]` `C:medium` `V:dated`
- **Claim.** `[rumoured]` Media reports of a 256-core initial Diamond Rapids part and a later 512-core version conflict with Intel's own "+50% over Granite Rapids" figure and are unconfirmed; reports of a Coral Rapids successor around 2028 restoring SMT are likewise leak-based.  `[592]` `C:low` `V:dated`
- **Claim.** `[rumoured]` As of 2026-09-16 Intel had disclosed nothing official about Diamond Rapids' TDX module version or any new VMX features. Any statement that Diamond Rapids "will support TDX 2.x" is inference, not disclosure.  `[592]` `C:low` `V:dated`
- **Claim.** `[vendor-stated]` Intel's Xeon 6 product brief claims 5:1 average server consolidation against 2nd-Gen Xeon Scalable with an average 40% TCO gain, and Intel's MWC 2025 telecom messaging claims an average 5:1 (up to 10:1) consolidation with up to 68% TCO savings. These are Intel's marketing figures under Intel's chosen comparison baseline; quote them as Intel's claim, never as measured fact.  `[586][593]` `C:medium` `V:dated`

---

## 90.4 Market and commercial

Every figure in this section is a single analyst house's estimate with its own methodology, and analyst houses disagree. Attribute the house and the quarter; never state a share as a fact about the world.

- **Claim.** `[GA]` Gartner (published August 2025) put the 2024 worldwide IaaS public-cloud market at USD 171.8 billion, up 22.5% year over year, with the top five holding 82.1%: Amazon USD 64.8 billion / 37.7%, Microsoft 23.9%, Google 9.0%, Alibaba 7.2%, Huawei 4.1%.  `[594]` `C:medium` `V:dated`
- **Claim.** `[GA]` Synergy Research Group (published 2026-02-05) put full-year 2025 cloud infrastructure services revenue at USD 419 billion, with Q4 2025 alone at USD 119.1 billion, up 30% year over year; it gave public-cloud shares of Amazon 28%, Microsoft 21%, Google 14%, and reported CoreWeave passing USD 1.5 billion in quarterly cloud revenue.  `[595]` `C:medium` `V:dated`
- **Claim.** `[GA]` Gartner's October 2025 Market Guide for Server Virtualization Platforms, as reported by The Register, states that VMware held over 96% of server-virtualization revenue share as of 2024, and that customers' software costs rose 300–400% after the Broadcom acquisition.  `[596]` `C:medium` `V:dated`
- **Claim.** `[GA]` Mercury Research (reported 2026-02) put AMD's Q4 2025 server-CPU unit share at 28.8% against Intel's 71.2%, up 1.1 points sequentially and 3.1 points year over year — a record high for AMD. Earlier points in the same series: Q1 2018 about 1.4%, Q4 2024 25.1% units / 35.5% revenue, Q2 2025 27.3%.  `[597]` `C:medium` `V:dated`
- **Claim.** `[GA]` Omdia's Data Center Server Market Analysis put Arm-based servers at 5.3% of the overall server market in 4Q21 and 7.1% in 2Q22.  `[598]` `C:low` `V:dated`
- **Claim.** `[GA]` IBM Cloud's published entry price for a TDX-capable VPC profile was around USD 115 per month in 2025-10. Cloud pricing changes without notice and regionally; this is the only price point recorded in this skill and it should be assumed stale.  `[570]` `C:low` `V:dated`

---

## 90.5 Dated security events

- **Claim.** `[GA]` Pwn2Own Berlin 2025 ran a virtualization category with a Hyper-V Client guest-to-host escape as the highest award at USD 250,000, VMware ESXi at USD 150,000 and VMware Workstation at USD 80,000.  `[599]` `C:medium` `V:dated`
- **Claim.** `[GA]` At Pwn2Own Berlin 2025 Synacktiv demonstrated a stable VMware Workstation VM escape by exploiting a heap overflow in the PVSCSI controller implementation, building OOB-read and arbitrary read/write/call primitives and defeating CFG and Windows 11 LFH mitigations. The entry point was device emulation, not a VT-x defect — see `errata.md` E11.  `[572]` `C:high` `V:dated`
- **Claim.** `[GA]` The TDXRay research disclosed in 2026 was evaluated on Xeon Silver 4510 (Sapphire Rapids), Xeon Gold 6526Y (Emerald Rapids) and Xeon 6736P (Granite Rapids), reporting all three as affected; Intel published INTEL-SA-01271 in response. Details and the architectural analysis belong to `13-tdx.md`.  `[23]` `C:medium` `V:dated`
- **Claim.** `[GA]` Microsoft's documented default policy, as relayed by secondary sources, is that VBS and Credential Guard have been enabled by default on qualifying devices since Windows 11 22H2, that Windows Server 2025 enables Credential Guard by default, that 24H2 added a UEFI lock making VBS harder to disable, and that 25H2 (RTM build 26200, 2025-10) continues to enable VBS and HVCI by default. The primary Microsoft Learn pages were not fetched during this rebuild; verify before quoting a version number.  → mechanism in `15-security.md` §15.7.  `[552]` `C:low` `V:dated`
- **Claim.** `[GA]` A practical consequence of the above, reported consistently across community sources, is that the Windows hypervisor is resident from early boot even when the Hyper-V feature is not selected, so third-party type-2 hypervisors and Android emulators must have VBS disabled to take full control of VT-x. Quoted performance costs vary by more than a factor of four across sources and are treated as unresolved in `errata.md` O4.  → mechanism in `15-security.md` §15.7, `17-windows-platform.md` §17.1.  `[552]` `C:low` `V:dated`
