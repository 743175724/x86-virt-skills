# 维度08：Intel TDX（Trust Domain Extensions）与机密计算 —— VT 家族最新重大演进

> 研究截止：2026 年中。状态标注约定：**GA** = 正式可用；**预览/邀测** = 有限开放；**规划/使能中** = 硬件就绪但软件栈未闭环。

---

## 1. 技术架构

### 1.1 SEAM 与 TDX Module（P-SEAMLDR/NP-SEAMLDR）

- **Claim**：TDX 在 VMX 之上新增 Secure Arbitration Mode（SEAM）：SEAM root 模式承载经 CPU 度量的 Intel TDX Module（作为 VMM 的"对等"安全仲裁者），TD 运行于 SEAM non-root；SEAM root 又分 Loader mode（全系统同时仅 1 核）与 Module mode（可多核并行）。VMM 通过 `SEAMCALL` 进入 SEAM root，TD 通过 `TDCALL` 请求模块服务，退出时模块保存并擦除 TD 寄存器状态防止泄露。
  - **Source**：Intel TDX Loader GitHub / Intel 开发者页面 / 稀土掘金技术解析
  - **URL**：https://github.com/intel/confidential-computing.tdx.tdx-loader ; https://www.intel.cn/content/www/cn/zh/developer/tools/trust-domain-extensions/overview.html ; https://juejin.cn/post/7307494782280613929
  - **Date**：2023–2024
  - **Excerpt**："Secure Arbitration Mode (SEAM) is an extension to VMX architecture to define a new VMX root mode called SEAM root… The SEAM range is partitioned into two sub-ranges: MODULE_RANGE and P_SEAMLDR_RANGE."
  - **Context**：SEAM 内存范围由 SEAMRR（SEAM Range Register）标识；NP-SEAMLDR ACM 初始化 SEAM 范围并把持久加载器 P-SEAMLDR 装入 P_SEAMLDR_RANGE；TDX Module 由 P-SEAMLDR 验证签名、度量后装入 MODULE_RANGE，支持运行时热更新（类似微码，内核可替换 BIOS 加载的旧版本，不持久）。
  - **Confidence**：高（Intel 官方 + kernel.org 文档 https://docs.kernel.org/arch/x86/tdx.html 一致）

- **Claim**：TDX 的关键架构元素：GPA 共享位（shared bit）、Secure EPT（地址转换完整性 + 禁止从共享内存取指）、PAMT（物理地址元数据表，跟踪页分配/初始化/TLB 一致性）、MKTME/TME-MK（AES-128-XTS 多密钥全内存加密）、远程证明。
  - **Source**：Intel 官方 TDX Module 下载页（详细说明）
  - **URL**：https://www.intel.com/content/www/us/en/download/738875/intel-trust-domain-extension-intel-tdx-module.html
  - **Date**：持续更新（检索于 2026）
  - **Excerpt**："Secure EPT … to provide address-translation integrity … Multi-key, total-memory-encryption (MKTME) engine designed to provide memory encryption using AES-128-XTS."
  - **Context**：TDX 将部分 MKTME KeyID 保留为 TDX 私有 KeyID（仅 SEAM 模式可用），BIOS 负责划分 legacy MKTME 与 TDX KeyID；内核启动日志如 `virt/tdx: BIOS enabled: private KeyID range: [16, 64)`。
  - **Confidence**：高

### 1.2 新信任模型：VMM 被移出 TCB

- **Claim**：TDX 的威胁模型把 VMM/hypervisor、主机 OS、SMM、BIOS 及云管理员均视为不可信；TD 的 CPU 状态（寄存器/MSR/TSC/PMC）与私有内存对所有非 SEAM 软件保密且带完整性保护；调试与性能监控需在 TD 创建时显式授权并记入证明报告。TCB 收敛为：CPU 硬件 + TDX Module（+ Quoting Enclave）。
  - **Source**：IBM Research "Intel TDX Demystified"、IBM Cloud 文档引 Intel TDX 白皮书（2022.02）
  - **URL**：https://research.ibm.com/publications/intel-tdx-demystified-a-top-down-approach ; https://community.ibm.com/community/user/blogs/jacob-oleary/2025/05/01/securing-your-data-using-the-power-of-ibm-cloud
  - **Date**：2024-04 / 2025-05
  - **Excerpt**："TDX aims at enforcing hardware-assisted isolation for virtual machines and minimize the attack surface exposed to host platforms, which are considered to be untrustworthy or adversarial."
  - **Context**：与 AMD 路线（PSP 安全协处理器）不同，TDX 用"受保护固件（SEAM 模式 ACM）"而非独立安全处理器实现仲裁；模块签名由 TXT/硬件度量验证。
  - **Confidence**：高

### 1.3 TD 生命周期与指令模拟

- **Claim**：TD 内执行 `CPUID/IN/OUT/HLT/RDMSR/WRMSR` 等触发 #VE（Virtualization Exception），TD OS 的 #VE handler 经 `TDCALL` 由 TDX Module 安全模拟；TD 与 VMM 共享内存仅通过 GPA 共享位映射的 shared memory（I/O 缓冲区走 SWIOTLB/bounce buffer）。
  - **Source**：稀土掘金《初识 Intel TDX 机密虚拟机技术》
  - **URL**：https://juejin.cn/post/7307494782280613929
  - **Date**：2023-12
  - **Confidence**：高（与 Intel 规范一致）

---

## 2. 证明（Attestation）：TD Quote、DCAP、PCK/PCCS

- **Claim**：TDX 远程证明链路：TD 通过 `TDG.MR.REPORT` 生成本地 TD Report（固定 1024 字节，含 MRTD/RTMR[0-3] 度量，可绑 64B REPORTDATA）→ Quoting Enclave（QE，SGX enclave）对 Report 签名生成 TD Quote（内嵌 PCK 证书链）→ 验证方用 DCAP 校验 ECDSA 签名与证书链，并拉取 collateral（TCB Info、QE Identity、PCK CRL）评估 TCB 级别与吊销状态。
  - **Source**：阿里云 TDX 文档 / Intel DCAP PCCS GitHub
  - **URL**：https://help.aliyun.com/zh/ecs/user-guide/build-a-tdx-confidential-computing-environment ; https://github.com/intel/confidential-computing.tee.dcap.pccs
  - **Date**：2025–2026
  - **Excerpt**："Quote 生成：Quoting Enclave 对 TD Report 签名并内嵌 PCK 证书链，形成可被远端独立验证的凭证。"
  - **Context**：平台需先向 Intel 注册（PCKCIDRT 采集 Platform Manifest → IRS/PCS 签发 PCK 证书）；PCCS（Provisioning Certificate Caching Service）在本地缓存 PCK 证书/TCB Info/CRL，降低对 Intel PCS 的在线依赖，支持离线/气隙模式。阿里云、火山引擎均提供区域化 DCAP/PCCS 服务（如 `sgx-dcap-server.cn-beijing.aliyuncs.com`）。
  - **Confidence**：高

- **Claim**：实测证明延迟：GCP C3 TDX 实例上硬件 TD Quote 生成约 75.6 ms，对区域 PCCS 做 DCAP 验证约 24.1 ms，是远程证明握手的关键路径瓶颈。
  - **Source**：arXiv 2605.09297（Enforcing Attestable Workflows…）
  - **URL**：https://arxiv.org/html/2605.09297v1
  - **Date**：2026-05
  - **Excerpt**："TDX quote generation requires 75.6 ms, and DCAP verification against the regional PCCS requires 24.1 ms."
  - **Confidence**：高（硬件实测）

- **Claim**：Intel 每年随 IPU（Intel Platform Update）做约两次 TCB Recovery；安全缓解影响 BIOS 组件后平台需重新注册并更新 PCK 证书与验证 collateral。
  - **Source**：Intel TDX Enabling Guide
  - **URL**：https://cc-enabling.trustedservices.intel.com/intel-tdx-enabling-guide/02/infrastructure_setup/
  - **Confidence**：高

---

## 3. 版本演进：1.0 → 1.5 → 2.0（TDX Connect）

- **Claim**：TDX 1.0 随第 4 代至强 Sapphire Rapids（2023-01-10 发布）落地，初期仅部分 SKU 支持，Emerald Rapids（2023 年末）起广泛可用；阿里云 g8i（2023-03-24）实现 TDX 机密虚拟机全球云首发。
  - **Source**：Phoronix / 阿里云新闻 / 快科技
  - **URL**：https://www.phoronix.com/news/Intel-TDX-Host-KVM-Linux-6.16 ; https://www.geekpark.net/news/316676 ; https://news.mydrivers.com/1/881/881112.htm
  - **Date**：2023 / 2025-06
  - **Excerpt**："TDX has been around since Sapphire Rapids with select SKUs and with widespread availability since Emerald Rapids in late 2023."
  - **Confidence**：高

- **Claim**：TDX Module 1.5 新增 **Live Migration（实时迁移，借助专用迁移 TD「MigTD」）** 与 **TD Partitioning（TD 内嵌套 VM）**，另有 TD 绑定密封密钥、TDREPORT 分区信息等增强；支持平台为 SPR/EMR 与 Xeon 6 E 核（Sierra Forest）。1.5 模块固件新增约 34,862 行代码（>8,000 行用于元数据与状态管理），2025 年公开发布。
  - **Source**：Intel tdx-module GitHub Releases / arXiv 2602.11434（Google×Intel 安全评估）/ 中文报道
  - **URL**：https://github.com/intel/confidential-computing.tdx.tdx-module/releases ; https://arxiv.org/abs/2602.11434 ; https://x1.mcplive.cn/?p=2411
  - **Date**：2025–2026-02
  - **Excerpt**："major changes since Intel TDX Module 1.0 - namely support for Live Migration and Trusted Domain (TD) Partitioning (nested VMs within TDs)."
  - **Context**：⚠️ 重要安全事件：Google 与 Intel 2025 Q2-Q3 对 TDX 1.5 的联合安全评估发现 **1 个可让 VMM 完全攻陷 TD 的漏洞 + 4 个可泄露 TDX Module 机密内存的漏洞**，凸显 1.5 功能扩展扩大 TCB 的代价（评估在 CSP 大规模采用前的窗口期进行，漏洞已修复流程中）。
  - **Confidence**：高

- **Claim**：**TDX 2.0 = TDX Connect**，把 TEE 扩展到设备 I/O（TEE-IO）：设备需遵循 SPDM + IDE（链路加密）+ TDISP 标准协议与 Intel Root Port/TDX Module 通信，实现设备直连 TD。硬件支持随至强 6 P 核 Granite Rapids（2025-02-24 发布时官宣 TEE-IO），但完整方案"需要 CPU + 使能的 host OS/hypervisor + TEE-IO 设备"三方齐备，**截至 2026 年仍处生态使能阶段，未端到端 GA**。
  - **Source**：Intel TDX 文档页 / CCC 2025 年 2 月通讯 / tee-io-validator GitHub / Ubuntu HWE 博客
  - **URL**：https://www.intel.cn/content/www/cn/zh/developer/tools/trust-domain-extensions/documentation.html ; https://confidentialcomputing.io/2025/03/03/welcome-to-the-2025-february-newsletter/ ; https://github.com/intel/tee-io-validator ; https://imcn.me/html/y2026/42780.html
  - **Date**：2025-02 / 2026-07
  - **Excerpt**："Intel TDX version 2.0 extends Intel TDX to support Trusted Execution Environment for device I/O (TEE-IO)." / "Solutions based on Intel TDX Connect will require a capable CPU, an enabled host OS/hypervisor, and a TEE-IO capable device."
  - **Context**：TDISP（PCIe 生态）定义 TSM/DSM 交互、TDI 状态机（CONFIG_UNLOCKED→LOCKED→RUN/ERROR），IDE 提供 AES-GCM 链路加密；机密 VM 在线迁移、可信设备分配、TDISP 等"都需要内核、KVM、QEMU、libvirt 与固件共同支持"的全栈改动。
  - **Confidence**：高

---

## 4. 与 SGX 的关系

- **Claim**：定位分化而非简单取代：SGX 是进程/应用级 TEE（小 TCB 但需改造应用、EPC 受限、无硬件迁移支持），TDX 是 VM 级 TEE（无需改应用、TCB 含 guest OS）。Intel 2022 年起在 12 代酷睿等客户端处理器移除 SGX；服务器至强保留 SGX（Ice Lake/Sapphire/Emerald 均支持；联想至强 6 UEFI 文档仍列 SGX 选项；有论文引述 Intel 路线图称 SGX 支持规划至 Xeon 7 Diamond Rapids）。同时 DCAP 证明基础设施（PCCS、PCK、QE）由 SGX 与 TDX 共用——TDX Quote 本身就由 SGX Quoting Enclave 签发。
  - **Source**：CCF 通讯《从英特尔新酷睿处理器放弃SGX看机密计算技术的发展》/ arXiv 2311.06991 / Lenovo Xeon 6 UEFI 文档 / Intel PCCS GitHub
  - **URL**：https://dl.ccf.org.cn/article/articleDetail.html?id=6475293074475008 ; https://arxiv.org/html/2311.06991v5 ; https://pubs.lenovo.com/uefi_xeon_6th/processors ; https://github.com/intel/confidential-computing.tee.dcap.pccs
  - **Date**：2022–2026
  - **Excerpt**："Intel has planned support for SGX till Intel Xeon 7 – Diamond Rapids"（论文引述）；Lenovo 文档：至强 6 BIOS 仍有 "SW Guard Extensions: Disabled(Default)/Enabled"。
  - **Context**：结论：TDX 是 Intel 服务器机密计算的战略主线（云厂商新实例均以 TDX/SEV-SNP 为主），SGX 在服务器端保留但增量投入转向 VM 级 TEE 与 TEE-IO；两者证明栈深度耦合，短期内共生。
  - **Confidence**：中高（"Diamond Rapids 为止"为论文转述，Intel 官方路线图未公开确认）

---

## 5. 竞品对比

| 维度 | Intel TDX | AMD SEV-SNP | ARM CCA |
|---|---|---|---|
| 隔离粒度 | VM（TD） | VM | VM（Realm） |
| 硬件隔离扩展 | SEAM + TDX Module | SEV 固件（PSP） | RME |
| 内存隔离管理 | Secure EPT + PAMT | RMP | GPT + Stage-2 页表 |
| 内存加密 | TME-MK（AES-128-XTS） | SME | MPE |
| 证明 | TD Quote（DCAP/PCK） | Attestation Report（VCEK） | CCA token |
| 硅可用性 | SPR 2023 起，广泛可用 | EPYC 7003 2021 起 | 2025–2026 Neoverse 起 emerging |

- **Source**：《计算机研究与发展》《Arm机密计算架构研究进展与展望》（2026）对比表；systemshardening.com
- **URL**：https://crad.ict.ac.cn/article/doi/10.7544/issn1000-1239.202550886?viewType=HTML ; https://www.systemshardening.com/articles/kubernetes/confidential-containers/
- **Date**：2026
- **Confidence**：高

- **Claim（NVIDIA 机密 GPU 协同）**：H100/H200（Hopper）与 B200（Blackwell）支持机密计算模式（PCIe 链路加密 + HBM 加密 + GPU 证明），与 TDX/SEV-SNP CVM 组合形成 CPU→GPU 端到端密态管线；Google Cloud A3（TDX+H100）已 GA，Azure NCC H100 v5 基于 SEV-SNP+H100。Ubuntu 是首个在公有云支持机密 GPU 的 Linux 发行版（Azure 预览起步）。TDX Connect/TEE-IO 即为此类 GPU 直连 TD 场景的 Intel 侧标准化路径。
  - **Source**：voltagegpu 指南 / Ubuntu 24.04 发布博客 / CCC 通讯
  - **URL**：https://voltagegpu.com/guides/confidential-computing-explained ; https://cn.ubuntu.com/blog/canonical-releases-ubuntu-24-04-noble-numbat_cn
  - **Date**：2024–2025
  - **Confidence**：高

---

## 6. 云落地现状（截至 2026 年中）

- **Azure**：DCesv5/ECesv5（SPR，TDX）2023-11-15 宣布 **public preview**、2023-12-07 可部署（⚠️ 本文件此前误记为「2023-12-01 GA」，经微软官方博客核验修正——该系列为预览状态）；Azure 首个 TDX **GA** 为 DCesv6/ECesv6/DCedsv6/ECedsv6（Emerald Rapids + AMX + 开源 paravisor OpenHCL + Azure Boost），**2026-02-26** 宣布 GA（West US/West US 3/West Europe 起步，支持 Windows Server 2025/Ubuntu 22.04/24.04/RHEL guest）。另有 NonPersistedTPM 选项实现与云厂商 TCB 职责分离。
  - Source：Microsoft Tech Community 官方博客（public preview 公告 / GA 公告）
  - URL：https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/announcing-the-public-preview-of-azure-confidential-vms-with-intel-tdx/3968256 ; https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/announcing-general-availability-of-azure-intel%C2%AE-tdx-confidential-vms/4495693
  - Date：2023-11-15 / 2026-02-26 | Confidence：高（官方一手来源，2026-09-16 复核）

- **Google Cloud**：C3 机密 VM（SPR + TDX）**2024-10-02 GA**；远程证明可选 Intel Trust Authority（独立于 Google Cloud 的第三方评估）。Confidential Space 等上层服务基于 TDX/SEV。
  - Source：SiliconANGLE / Google Cloud 博客
  - URL：https://siliconangle.com/2024/10/02/intel-google-cloud-launch-confidential-computing-instances-powered-4th-gen-xeon-processors/
  - Date：2024-10 | Confidence：高

- **阿里云**：g8i（2023-03 全球云首发 TDX，SPR；后升级 EMR）**GA**，支持地域含北京/杭州/香港/新加坡部分可用区；第 9 代 g9i/c9i/r9i 亦支持 TDX；提供区域化 PCCS、CoCo 裸金属部署指南、Cryptpilot 系统盘度量加密。已知限制：不支持实例内 reboot、不支持 VNC、暂不支持 Windows、需 UEFI 镜像。
  - Source：阿里云官方文档/新闻
  - URL：https://help.aliyun.com/zh/ecs/user-guide/build-a-tdx-confidential-computing-environment ; https://www.aliyun.com/daily-act/ecs/ecs-intel-9th
  - Date：2023–2026 | Confidence：高

- **火山引擎**：安全增强通用型 g3ilt（至强 6）/g4ilt TDX 实例，**华北2 邀测**（2024-12 发布，截至 2026-03 仍为邀测）；提供 Ubuntu 24.04/Rocky 9.5/veLinux 2.0 for TDX 开箱镜像与区域 PCCS；并发布 AICC 机密计算平台。
  - Source：火山引擎官方文档 / 腾讯新闻报道
  - URL：https://www.volcengine.com/docs/6396/1339011 ; https://view.inews.qq.com/a/20241220A07W0E00
  - Date：2024-12 / 2026-03 | Confidence：高（邀测状态明确）

- **IBM Cloud**：Virtual Servers for VPC 上 4th Gen Xeon TDX 实例（bx3dc/cx3dc profile）**GA**，2025-10 起从华盛顿（us-east）扩展至法兰克福（eu-de），起价约 $115/月。
  - Source：IBM Community 官方博客
  - URL：https://community.ibm.com/community/user/blogs/meryl-veramonti/2025/10/14/intel-tdx-frankfurt
  - Date：2025-10 | Confidence：高

- **VMware（私有云参照）**：vSphere/ESXi 9.1（2026-05 GA）将 Intel TDX 与 AMD SEV-SNP 均列为 GA 特性（TDX 要求 EMR 及更新）。
  - Source：VMware VCF 9.1 release notes 镜像
  - URL：https://vmwaretechdocs.in/content/vcf/9.1/part-1-release-notes.html
  - Date：2026-05 | Confidence：中高

### OS 支持状态

- **Ubuntu**：23.10 Intel 优化构建起 TDX 预览（2023-10，host+guest）；24.04 LTS 官方支持；**26.04 LTS（2026-04-23 发布，Resolute Raccoon）原生全面集成 SEV-SNP 与 TDX 的宿主机+客户机支持（内核、固件、工具全栈）**，并推出虚拟化 HWE 栈（qemu-hwe/libvirt-hwe/edk2-hwe/seabios-hwe）承接在线迁移、TDISP 等后续特性。
  - URL：https://cn.ubuntu.com/blog/ubuntu-26-04-lts-security-updates_cn ; https://canonical.com/blog/confidential-computing-intel-tdx-ubuntu ; https://imcn.me/html/y2026/42780.html | Confidence：高
- **RHEL**：guest Tech Preview 自 RHEL 9.2（2023）；**RHEL 10 与 RHEL 9.6（2025-05）TDX guest 正式完全支持**（可用于 GCP C3 与 Azure DCesv5/ECesv5）；host 侧经 CentOS Virtualization SIG 提供；Trustee 客户端 `trustee-guest-components` 仍为 Tech Preview。
  - URL：https://www.redhat.com/en/blog/new-updates-red-hat-enterprise-linux-confidential-virtual-machines | Confidence：高
- **openEuler**：24.03 LTS（2024-09）提供基于 TDX/SEV 的机密容器能力；24.03 LTS SP4（2026-07）GTA 远程证明新增鲲鹏 CCA 支持（x86 TDX 为既有能力）。
  - URL：https://www.elecfans.com/zt/188987/ ; https://www.openeuler.org/zh/news/20260701-openEuler%2024.03%20LTS%20SP4/... | Confidence：中高

---

## 7. 开源生态与内核合入历程

- **Claim（内核时间线）**：Linux **5.19**（2022-07）合入 TDX guest 基础支持；**6.2**（2022-12）合入 guest 证明驱动（`/dev/tdx_guest`）；6.7 起 ConfigFS TSM 报告接口（`/sys/kernel/config/tsm/report`）可用；**host 侧 KVM 支持历经多年、19+ 版补丁，最终在 Linux 6.16（2025 H2）合入主线**（私有页表镜像、TDVMCALL 转发、特殊 VM-exit 处理）。live migration、vPMU、off-TD debug 等为后续工作。
  - Source：Phoronix / LWN / kernel.org / 阿里云文档
  - URL：https://www.phoronix.com/news/Intel-TDX-Host-KVM-Linux-6.16 ; https://lwn.net/Articles/963706/ ; https://docs.kernel.org/arch/x86/tdx.html
  - Date：2022–2025 | Confidence：高
- **Claim（QEMU/libvirt）**：QEMU 主线已有 `tdx-guest` 对象与 `confidential-guest-support`（限制：需 split irqchip、私有内存无只读支持、无 SMM）；长期由 Intel 维护分支（github.com/intel/tdx），2025 年 Fedora 43 计划以 QEMU 10.1 + libvirt 11.8 + 内核 ≥6.16 打包"自包含 TDX 机密虚拟化宿主机"。Canonical 早期通过 PPA 分发 QEMU/libvirt/TDVF。
  - URL：https://www.qemu.org/docs/master/system/i386/tdx.html ; https://discussion.fedoraproject.org/t/f43-change-proposal-confidential-virtualization-host-for-intel-tdx-self-contained/148877 ; https://github.com/canonical/tdx/releases | Confidence：高
- **Claim（CoCo/容器）**：Confidential Containers（CNCF，2026-07 升为 Incubating）以 Kata Containers（`kata-qemu-tdx` RuntimeClass）把 Pod 跑入 TDX TD，guest 内 Attestation Agent + Confidential Data Hub 对接外部 Trustee（KBS/AS/RVPS），先证明再放密钥/解密镜像；支持 TDX/SEV-SNP/SE/IBM PEF 等多后端。⚠️ 2025-09 披露 CVE-2025-58354（Kata ≤3.20.0，恶意主机可使 I/O 失败跳过 initdata 验证，3.21.0 修复）——机密容器栈仍在快速成熟期。Gramine/Occlum 为 SGX 库 OS 路线，Gramine PAL 已适配 TDX/SEV。
  - URL：https://stribog.com/blog/confidential-computing-kubernetes-remote-attestation-tee ; https://cve.imfht.com/detail/CVE-2025-58354 ; https://juejin.cn/post/7672999931841675306 | Confidence：高

---

## 8. 性能开销量化研究

| 研究/来源 | 工作负载 | TDX 开销 | 备注 |
|---|---|---|---|
| Intel 官方（4th Gen Xeon） | CPU/内存密集 | SPECrate2017_int ≈3%，SPECjbb ≤4.5%，普遍 <5% | https://www.intel.com/content/www/us/en/developer/articles/technical/trust-domain-extensions-on-4th-gen-xeon-processors.html |
| Intel 官方 | Redis I/O | 读密集 3.6%；写密集且 vCPU 饱和时最高 25% | bounce buffer + TD 切换成本是主因 |
| 学术基准（arXiv 2408.00443, 2024） | NGINX I/O 密集 | 平均 28.6%（vs Native）；Gramine-SGX 67.6% | VM 级 TEE 显著优于 SGX 库 OS |
| 机密 DNA 比对评估（FGCS 2025） | 生物信息 | 小任务 73%，大任务仅 9%；SEV-SNP 大任务 29% | 规模越大摊薄越明显 |
| IBM 实验笔记（TDX Note, 2025） | 通用 | 计算 <2%、内存 ≈5%、I/O ≈7%；TD↔模块切换 ≈30µs（传统 VM ≈10µs）；2GB TD 创建 ≈200ms | https://supermarkli.github.io/posts/cbeff3a9/ |
| 机密 GPU 推理（arXiv, Mozilla 2026-07） | H100+TDX 跑 LLM | TTFB +21.8%~27.8%，全局吞吐 −17.7%~21.1% | 容量规划需计入 |
| H100 TEE 基准（Phala 2024） | LLM 推理 | 典型 <5%，70B 大模型接近 0%，8B 小模型 ~7% | I/O（PCIe 加密）是瓶颈而非计算 |
| IISWC 2025 ConfLLMInference | TDX 上 RAG/LLM | RAG pipeline 6–7%；Llama2 7B–70B <10% | CPU TEE 适合小模型/低吞吐 |

- **综合判断**：计算型负载开销普遍 <5%；I/O 密集与小任务开销显著（10%–30%）；远程证明为一次性启动开销（Quote ≈75ms）；TD 创建/销毁与上下文切换额外成本在云长生命周期场景可接受。
  - Confidence：高（多来源交叉一致）

---

## 维度总结

1. **架构本质**：TDX = SEAM 新 CPU 模式 + CPU 度量的 TDX Module（P-SEAMLDR 加载/热更新）+ TME-MK 多密钥内存加密（AES-128-XTS）+ Secure EPT/PAMT/GPA 共享位，把 VMM、主机 OS、SMM/BIOS、云管理员全部移出 TCB，是 Intel VT-x/EPT 虚拟化体系二十年来最大的信任模型重构。
2. **版本节奏**：1.0（SPR 2023 GA）→ 1.5（live migration 经 MigTD + TD Partitioning 嵌套，2025 公开；Google×Intel 评估发现 1 个 TD 攻陷级漏洞，TCB 扩大代价显现）→ 2.0/TDX Connect（TEE-IO，Granite Rapids 2025-02 硬件就绪，TDISP/IDE/SPDM 全栈使能中，未端到端 GA）。
3. **证明体系成熟且与 SGX 共生**：TD Quote 由 SGX Quoting Enclave 签发，DCAP/PCK/PCCS 基础设施复用；客户端 SGX 已砍（12 代酷睿起），服务器 SGX 保留（路线图称至 Diamond Rapids），但 Intel 战略主线已转向 VM 级 TEE。
4. **软件栈 2025 年才闭环**：guest 支持 Linux 5.19（2022），host KVM 直到 6.16（2025）才进主线；QEMU/libvirt/OVMF/证明组件靠 Ubuntu 26.04 LTS（2026-04，原生 host+guest）、RHEL 10/9.6（guest 完全支持）、openEuler 24.03、虚拟化 HWE 栈等完成发行版落地。
5. **云落地梯队**：阿里云全球首发（g8i，2023-03 GA）→ Azure（DCesv5，2023-12 GA；v6 EMR 2026 Q1 GA 计划）→ Google C3（2024-10 GA）→ IBM Cloud（2025 GA）→ 火山引擎 g3ilt/g4ilt（邀测）；VMware ESXi 9.1（2026-05）TDX GA 标志私有云就绪。
6. **性能**：计算 <5%，I/O 密集 10–30%，机密 GPU 推理吞吐损失约 18–21%；性能不是主要采纳障碍，全栈成熟度（迁移/设备直通/TDISP）与安全评估节奏才是。
7. **竞争格局**：TDX vs SEV-SNP 双雄并立（CCA 2025–26 起步），CoCo（CNCF Incubating）统一容器层抽象；TDX 的差异化押注在 TDX Connect 打通 GPU 机密 AI 管线。
