# 英特尔虚拟化技术研究 · 维度13：2022–2026 最新微架构与产品中的虚拟化增强

> 研究日期：2026-09-16 ｜ 范围：2022–2026 年 Intel 服务器/客户端新平台中的虚拟化硬件增强、TDX 演进、VMX 新控制、软件生态与官方叙事
> 时效性重点维度。状态标注：【GA】=已发布上市；【宣布】=官方已公布未出货或细节有限；【传闻】=媒体报道/泄露，未获官方确认。

---

## 一、Xeon 6（Granite Rapids / Sierra Forest）的虚拟化特性

### 1.1 发布与 TDX 支持状态

- **Sierra Forest（至强6 能效核，Xeon 6700E 系列）**：2024-06-04（Computex）发布【GA】，最多 144 个 E-core。官方宣传以密度/能效整合为核心：与第二代至强相比媒体转码机架性能提升最高 4.2×、每瓦性能提升最高 2.6×，可按 3:1 比例做旧系统机架整合[^1^]。
- **Granite Rapids（至强6 性能核）**：6900P（AP）2024-09-24 发布【GA】，最多 128 个 Redwood Cove P-core，12 通道 DDR5-6400、支持 MRDIMM-8800，LGA 7529；6700P/6500P（SP）2025-02-24 发布【GA】[^2^][^3^][^4^]。
- **TDX 分代差异（关键）**：Intel 官方支持页与 Ubuntu 文档确认——Sapphire Rapids / Emerald Rapids / Sierra Forest 运行 **TDX Module 1.5.x**；Granite Rapids（P-core）运行 **TDX Module 2.0.x**，且只有 P-core 至强6 额外支持 **TDX Connect**（TEE-IO）[^5^][^6^][^7^]。kernel.org 文档亦注明“module 版本系列是平台专属的：1.5.x 跑在 SPR 而不能跑在 GNR，后者需要 2.0.x”[^8^]。
- **密钥强度升级**：Intel 官方 TDX readiness 页显示，4th/5th Gen Xeon 的 TDX AES 密钥强度为 128 bit，而至强6（E-core 与 P-core）均为 **256 bit**；至强6 还支持 Trust Domain 在线迁移、TD Preservation、远程证明、逻辑/加密内存完整性[^9^]。
- **生态落地状态【GA】**：VMware Cloud Foundation 9.1（GA 日期 2026-05-12）宣布 Intel TDX 正式 GA，兼容 5th Gen（Emerald Rapids）及以后平台[^10^]；实际部署中仍存在 BIOS/SEAM Loader 适配摩擦（如 2026-03 STH 论坛报告 Gigabyte 主板 BIOS 未完成 SEAMRR 移交导致 GNR 上 TDX 无法初始化，Intel 官方确认为 BIOS 问题）[^11^]。
- 2026 年出现针对 TDX 的安全研究 **TDXRay**（在 SPR/EMR/GNR 三平台验证，Intel 已发布 INTEL-SA-01271），说明 TDX 已进入真实攻防研究阶段[^12^]。

### 1.2 MRDIMM 与虚拟化密度

- Granite Rapids-AP 支持 **MRDIMM-8800**（12 通道）。第三方实测：12 通道 8800 MT/s MRDIMM 配置下单路峰值内存带宽约 **743 GB/s**，较顶级 DDR5 RDIMM 提升 40%+；代价是单条功耗升至 18–21 W[^13^]。HPE 2026-05 发布 64TB 内存服务器即采用至强6 + MRDIMM，官方口径“内存带宽较标准 DDR5 提升近 40%”[^14^]。
- 对虚拟化的意义：内存带宽/容量是 VM 密度的主要约束之一，MRDIMM 使 128 核单路的每核可用带宽不再急剧下降；内存厂商与整机厂均将 MRDIMM 定位于“提高单机 VM 数、降低虚拟化 TCO”[^15^][^16^]。

### 1.3 官方虚拟化性能宣传

- Intel 至强6 产品简介官方口径：与第二代至强可扩展相比，**平均 5:1 服务器整合**（特定场景最高 10:1），平均 TCO 收益 40%；电信场景每瓦性能提升、TCO 节省最高 68%[^17^][^18^]。
- 虚拟化基准：Supermicro/Intel VMmark 4.0.1 对比，四节点至强6 集群 vs 四节点 3rd Gen Xeon 集群，VMmark 得分 2.56 vs 1.07（+2.39×），Tiles 数 2.6 vs 1.2，CPU 数量减半、TDP 降 27%[^19^]。
- 中国区官方传播强调“至强6 的 TDX 升级为 2.0，提供更可靠、更牢固的安全密钥”[^20^]。

---

## 二、Clearwater Forest / Panther Lake（Intel 18A）

### 2.1 Clearwater Forest（至强6+，Xeon 6+）

- 2026-06-01 Computex 2026 正式发布【宣布/开始出货】：**首款 Intel 18A 数据中心 CPU**，Darkmont E-core，最多 288 核/插槽，L2 288MB + LLC 576MB，12 通道 DDR5-8000，96× PCIe 5.0 + 64× CXL 2.0，TDP 300–500W，沿用 LGA 7529；Foveros Direct 3D + EMIB 封装[^21^][^22^][^23^]。
- 虚拟化/安全特性：官方与 STH 报道确认集成 **SGX + TDX**，用于“机密和多租户部署”；TDX Module 2.0 最新公开版本（2026-02-11 build）的“Supported platforms”已列入 **Xeon 6+（Clearwater Forest）**，说明 TDX 2.0 已在 CWF 上可用【GA】[^21^][^24^][^5^]。
- 密度叙事：Intel 宣称 6990E+ 相比 6780E 平均性能 2.26×、每瓦性能 1.55×；对 Cascade Lake 时代服务器可按 **1:8–1:9 整合**；与 Foxconn 合作的液冷 rack 参考设计单机架 128 插槽、36,864 核、384TB 内存[^22^][^25^][^26^]。
- 注意：E-core 平台无 AVX-512，定位云原生/多租户吞吐型负载，这是其“VM/容器密度”叙事的架构前提[^27^]。

### 2.2 Panther Lake（酷睿 Ultra 300，客户端）

- 2025-10 架构公布、**2026-01-05 CES 2026 正式发布**【GA】：首款 Intel 18A 客户端 SoC，Cougar Cove P-core + Darkmont E-core（与 Clearwater Forest 同源 E-core），Xe3 核显，2026 年 1 月起上市[^28^][^29^]。
- 虚拟化相关：官方未披露任何新的客户端 VMX/TDX 特性；客户端依旧只有 VT-x/VT-d（TDX 仍为至强独占）。其虚拟化意义主要在消费端 VBS 普及（见第七节）。*（推断，官方材料中未见 Panther Lake 的 VMX 新增项，置信度中）*

---

## 三、近年 SDM 新增 VMX 能力清单（2022–2026 视角）

Intel 在 Sapphire Rapids 前后于 SDM/ISA Extensions Reference 中加入了一批新 VMX 控制，Linux KVM 侧逐一使能：

| 特性 | VMX 控制位置 | 说明 | KVM 合入 |
|---|---|---|---|
| **IPI virtualization** | 三级（Tertiary）处理器执行控制 bit 4 | 处理器硬件仿真 ICR 写/SENDUIPI 发 IPI，消除源 vCPU 的 VM-exit；引入 PID-pointer table；实测 IPI 处理周期 xAPIC 模式 -22.2%、x2APIC 模式 -16.0% | **Linux 5.19（2022-05）**【GA】[^30^][^31^][^32^] |
| 三级执行控制框架本身 | 主控制 bit 17 激活 | LOADIWKEY exiting(b0)、Enable HLAT(b1，hypervisor 管理的线性地址转换)、EPT paging-write control(b2)、Guest-paging verification(b3)、IPI virtualization(b4)、Virtualize IA32_SPEC_CTRL(b7) | 框架随 IPIv 于 5.19 合入[^30^][^33^] |
| **Notify VM exit** | 二级控制 bit 31 + NOTIFY_WINDOW 字段 | 客户机在“无事件窗口”状态超时即 VM-exit，防止恶意 guest（如微码死循环 CVE-2015-5307 类）造成 DoS；新增 EXIT_REASON_NOTIFY(75)、KVM_CAP_X86_NOTIFY_VMEXIT | 2022 年合入（v7 系列，LWN 2022-05）【GA】[^34^][^35^] |
| **Bus-lock detection / Bus-lock VM exit** | 二级控制 bit 30 | guest 每次总线锁触发 VM-exit，VMM 可限流/查杀（split-lock 的虚拟化对应物） | 2020–2021 起合入，TDX 场景 2025–2026 补齐（见下）[^36^][^37^] |
| **User-interrupt 相关** | VM-entry/exit 控制新增 “Load/Clear user-interrupt notification vector” | 配合 UINTR（SENDUIPI）的虚拟化；IPIv 亦覆盖 SENDUIPI 执行路径 | 随 IPIv/UINTR 生态推进[^32^][^38^] |
| **EPT 细化** | EPT A/D 位与 PML 为 2015 年 Broadwell 时代特性（不在本维度窗口）；窗口内新增为三级控制中的 **EPT paging-write(b2)/guest-paging verification(b3)/HLAT(b1)**，强化 EPT 权限粒度与页表防护 | — | HLAT 等 KVM 使能仍在社区推进（置信度中）[^33^] |

> 注：TDX 语境下 Notify/Bus-lock VM exit 需 TDX 专属编程路径——2026-08 KVM 列表仍有 “[PATCH v3] KVM: TDX: Enable VM-DoS Prevention Features for TDX”（为 TD 启用 Notify/Bus-lock VM exit）在评审中【进行中】[^37^]。

---

## 四、TDX 版本演进：1.5 / 2.0 / TDX Connect

- **TDX 1.0 → 1.5**：Intel 官方文档列出 “Incompatibilities between v1.0 and v1.5”（2023-12）；1.5 增加 TD 在线迁移、TD partitioning、TD 绑定密封密钥、TDREPORT 分区信息等。1.5.x 系列支持 SPR/EMR/SRF【GA】[^39^][^5^]。
- **TDX 2.0（Granite Rapids 起）**：2.0.x 系列随 GNR 推出，支持 GNR 与 CWF；引入 MAXGPA 虚拟化、动态 PAMT 分配、#VE 削减、TD 迁移（含分区 TD）、可调试 TD 迁移等；**TDX 2.0 = TDX Connect（TEE-IO）的载体**——把信任边界扩展到 PCIe 设备，实现 CPU↔GPU 等设备的加密通信，面向机密 AI[^5^][^40^]。
- **TDX Connect 时间线**：2024-08 TDX Module 2.0.02 出现 “TDX Connect pre-production interfaces”；2025-01-16 2.0.08 支持 “partitioned TD usage with TDX Connect”；**2025-02-24 Intel 官方新闻稿宣布至强6 P-core 硬件支持 TDX Connect**（CCC 通讯与 Intel 新闻资料室均有记录）【宣布，硬件就绪；完整方案还需主机 OS/hypervisor 与 TEE-IO 设备生态】[^41^][^42^][^43^]。
- 版本维护活跃：截至 2026-08，最新公开 2.0 build 为 2026-02-11（SVN 3.9），1.5 最新为 2026-03-30——1.5 与 2.0 两条线并行维护[^5^]。

---

## 五、Intel 官方叙事与组织变化（DCAI→DCG、IPU/DPU）

- **组织重构**：2025-04 CEO 陈立武将原“数据中心与 AI 事业部（DCAI）”拆分为数据中心集团（DCG，CPU）与 AI 集团；2025-09 任命前 Arm 高管 Kevork Kechichian 任 DCG EVP/GM，DCG 直接向 CEO 汇报；2026 年 AI 加速器团队又重新并入 DCG，理由是“AI 与现代数据中心根本相连”“行业转向推理与 agentic 方案，Xeon 是中心”[^44^][^45^][^46^]。
- **叙事变化**：虚拟化宣传从“VT-x 特性列表”转为“**整合比 + 每瓦性能 + 机密计算**”三件套：至强6 官方资料把 5:1 整合、TDX 机密 VM、TDX Connect 放在同一页[^17^]；Computex 2026 的基调是“CPU 重返 AI 基础设施中心”，288 核 CWF 面向 agentic AI 编排与多租户云[^23^][^26^]。
- **IPU/DPU 卸载线**：Intel 官网 IPU 页（2025-11 更新）将“虚拟化环境”列为头号用例：IPU 提供网络/存储虚拟化功能、基础设施与租户隔离，对 VM/容器透明、最高 1K VF、200Gb 链路——即把虚拟化数据面从主机 CPU 卸载到 IPU（Mount Evans 系）[^47^]。

---

## 六、Linux/KVM 生态合入动态（截至 2026）

| 里程碑 | 内核版本 | 时间 | 状态 |
|---|---|---|---|
| IPI virtualization（含三级控制框架） | 5.19 | 2022-05 | 【GA】[^30^] |
| Notify VM exit | ~5.19–5.20 周期 | 2022 年中 | 【GA】[^34^][^35^] |
| TDX guest 支持 | 5.19 起逐步 | 2022 起 | 【GA】[^48^] |
| **TDX host（KVM）支持** | **6.16** | 2025-06（H2'2025 发布） | 【GA 主线】——“Initial support for TDX in KVM”，含私有页表、TDVMCALL 转发、特殊 VM-exit 处理[^49^] |
| Ubuntu TDX host 支持 | Ubuntu 25.10（kernel 6.17） | 2025-10-09 | 【GA（早期/early）】；Ubuntu 26.04 LTS（2026-04）提供 TDX+SEV-SNP 完整支持[^50^][^51^][^52^] |
| OpenStack Nova libvirt TDX | 2026.2 规格已批准 | 2026-09 | 【宣布/进行中】要求 kernel≥6.16、QEMU≥10.1、libvirt≥11.6[^53^] |
| VMware VCF 9.1 Intel TDX | 9.1 | 2026-05-12 GA | 【GA】[^10^] |
| TDX KVM selftests v14、TDX DoS 防护（Notify/Bus-lock for TDX）v3 | 评审中 | 2026-08 | 【进行中】[^37^] |

---

## 七、消费级：Windows 11 24H2/25H2 的 VBS 默认策略与 VT 普及化

- 微软官方口径：**自 Windows 11 22H2 起，满足条件的设备默认启用 VBS 与 Credential Guard**；Windows Server 2025 亦默认启用 Credential Guard[^54^]。内存完整性（HVCI）在符合条件的新设备上默认开启，要求 CPU 支持 VT-x/AMD-V + SLAT、Secure Boot、兼容驱动[^55^]。
- **24H2 强化**：VBS 引入 UEFI lock，关闭更困难；VBS Enclaves 在 ≤23H2 被弃用，但 24H2+ 与 Server 2025 继续支持——即微软把 VBS 从“可选安全功能”固化为平台基线[^56^][^57^]。Windows 11 企业版热补丁（hotpatching）明确要求 VBS 开启[^58^]。
- **25H2（2025-10 发布，RTM Build 26200）**：继续默认启用 VBS+HVCI；hvloader.efi 在启动早期加载常驻 hypervisor，即使不勾选 Hyper-V 功能也占用 VMX——第三方 Type-2 hypervisor（VMware/VirtualBox）与安卓模拟器需关闭 VBS 才能获得 VT-x 完全控制权，游戏性能损失实测 5–25%[^59^][^60^][^61^]。
- 影响判断：VBS 默认化使 VT-x/EPT（SLAT）成为所有新 Windows PC 的“常备能力”，硬件虚拟化从可选特性变成 OS 安全基座的强制依赖，客观上完成了 VT 在消费端的普及化（含 Arrow Lake/Lunar Lake/Panther Lake 各代客户端平台）。

---

## 八、未来路线：Diamond Rapids（至强7）

- **Diamond Rapids【宣布】**：Computex 2026（2026-06）官方预告，**2027 年推出**，Xeon 7 品牌；18A-P 工艺，Panther Cove-X P-core，官方确认核心数较 GNR +50%（即最高 192 P-core，无 SMT）、16 通道内存（带宽翻倍，MRDIMM-2/MCR-12800，最高 1.6TB/s）、PCIe Gen6（128 条）、CXL 3.0、Oak Stream 平台 LGA 9324；已取消 8 通道变体[^62^][^63^][^64^]。
- **传闻**：初期 256 核、后续 512 核版本的报道（wccftech/超能网），与官方 192 核口径不一致，列为【传闻】[^65^]；后续 Coral Rapids（约 2028，恢复 SMT）亦为【传闻/路线图泄露】[^64^]。
- **TDX/虚拟化计划**：截至 2026-09，Intel 未对 Diamond Rapids 的 TDX 版本或 VMX 新特性做官方披露；考虑到 GNR/CWF 均已 TDX 2.0 + TDX Connect，Diamond Rapids 延续 TDX 2.x 是合理推断但无官方证据（置信度低，标注为推断）。支持 APX、提升 AMX 效率为官方确认方向[^62^][^66^]。

---

## 证据清单（Claim / Source / URL / Date / Excerpt / Context / Confidence）

1. **Claim**：Sierra Forest 至强6 能效核 2024-06 发布，3:1 整合、转码机架性能 4.2×、每瓦 2.6×。
   **Source**：新浪财经/ZOL ｜ https://finance.sina.cn/tech/2024-06-06/detail-inaxuysz5997133.d.html ｜ 2024-06-06
   **Excerpt**：“可以3:1的比例进行旧系统替换和机架整合……高达4.2倍的机架性能提升和高达2.6倍的每瓦性能提升。”
   **Context**：Intel Computex 2024 发布会官方数据的中文媒体转述。**Confidence**：高（官方口径转述）。

2. **Claim**：Granite Rapids 2024-09-24 发布，至强6 家族。
   **Source**：Wikipedia: Granite Rapids ｜ https://en.wikipedia.org/wiki/Granite_Rapids ｜ 2024-09-24
   **Excerpt**：“6th generation Xeon Scalable server processors … launched on 24 September 2024.”
   **Context**：汇总 Intel 新闻稿与 The Register 报道。**Confidence**：高。

3. **Claim**：GNR-AP 128 P-core、12 通道、MRDIMM-8800、96×PCIe5/64×CXL2.0、LGA7529、500W。
   **Source**：赛迪网（至强6 官方资料通稿）｜ http://www.ccidnet.com/zn/105184.jhtml ｜ 2025-03-24
   **Excerpt**：“单插槽可以达到128个性能核……12通道内存，并支持MRDIMM 8800MT/s……96个PCIe 5.0通道（或64个CXL 2.0通道）”
   **Context**：Intel 官方上市材料。**Confidence**：高。

4. **Claim**：6700P/6500P（GNR-SP）2025-02 发布，8–86 核，8 通道 DDR5-6400，部分支持 MRDIMM-8000。
   **Source**：同[^3^]（赛迪网通稿）｜ 2025-03-24
   **Excerpt**：“今年2月发布的至强6700/6500系列性能核处理器代号Granite Rapids-SP，集成了8到86个性能核……支持8通道DDR5 6400MT/s，部分型号还提供了MRDIMM 8000MT/s”
   **Confidence**：高。

5. **Claim**：TDX Module 1.5.x 支持 SPR/EMR/SRF；2.0.x 支持 GNR 与 Clearwater Forest；2.0 新增 MAXGPA 虚拟化、动态 PAMT、#VE 削减、TD Connect 分区用法等；两线并行维护至 2026。
   **Source**：GitHub intel/confidential-computing.tdx.tdx-module Releases ｜ https://github.com/intel/confidential-computing.tdx.tdx-module/releases ｜ 2026-08-12（抓取日）
   **Excerpt**：“Latest publicly available 2.0 release — Supported platforms: Intel Xeon 6 processor with P-cores (Granite Rapids); Intel Xeon 6+ processor (Clearwater Forest)”；“Latest publicly available 1.5 release — Supported platforms: 4th Gen (Sapphire Rapids); 5th Gen (Emerald Rapids); Intel Xeon 6 with E-cores (Sierra Forest)”；2.0.04(2024-08-14): “TDX Connect pre-production interfaces”；2.0.08(2025-01-16): “Support for partitioned TD usage with TDX Connect”
   **Context**：Intel 官方 TDX Module 发布页，最权威版本事实来源。**Confidence**：极高。

6. **Claim**：Ubuntu 文档确认各平台 TDX Module 版本对应关系；Ubuntu host 支持始于 25.10。
   **Source**：Ubuntu Server Docs ｜ https://ubuntu.com/server/docs/how-to/virtualisation/intel-tdx/ ｜ 2026-06-26
   **Excerpt**：“Guest support is available from Ubuntu 24.04 LTS onwards, while host support begins with Ubuntu 25.10.” 表格：SPR/EMR/SRF→1.5.x，GNR→2.0.x。
   **Confidence**：高。

7. **Claim**：P-core 至强6 额外支持 TDX Connect（TEE-IO）。
   **Source**：Baidu Baike(en) Intel TDX 条目 ｜ https://baike.baidu.com/en/item/Intel%C2%AE%20Trust%20Domain%20Extensions/2028134 ｜ 2025-10-10
   **Excerpt**：“models utilizing Performance-cores additionally support Intel TDX Connect technology. The Intel Xeon 6+ Series Processor (Clearwater Forest) also supports Intel TDX.”
   **Context**：二手汇编，与 Intel 产品简介[^17^]一致。**Confidence**：中高。

8. **Claim**：TDX module 版本系列是平台专属的（1.5.x SPR↛GNR，GNR 需 2.0.x）。
   **Source**：kernel.org TDX 文档 ｜ https://docs.kernel.org/arch/x86/tdx.html ｜ 未注明（现行版）
   **Excerpt**：“module version series are platform-specific. For example, the 1.5.x series runs on Sapphire Rapids but not Granite Rapids, which needs 2.0.x.”
   **Confidence**：极高。

9. **Claim**：至强6 TDX AES 密钥强度 256 bit（4th/5th Gen 为 128 bit）；支持 TD 迁移/保留/远程证明/内存完整性。
   **Source**：Intel 官方支持页 “Intel TDX Feature Readiness by Intel Xeon Processor Generation” ｜ https://www.intel.com/content/www/us/en/support/articles/000099708/processors/intel-xeon-processors.html ｜ 2026-02-24
   **Excerpt**：“Intel Xeon 6 with E-cores … Trust Domain Live Migration, Trust Domain Preservation, Remote Attestation, Logical Memory Integrity Support, and Cryptographic Memory Integrity. | 256”
   **Confidence**：极高。

10. **Claim**：VMware VCF 9.1 将 Intel TDX GA（兼容 5th Gen EMR 及以后），GA 日期 2026-05-12。
    **Source**：VMware 技术文档镜像（VCF 9.1 Release Notes）｜ https://vmwaretechdocs.in/content/vcf/9.1/part-1-release-notes.html ｜ GA 2026-05-12
    **Excerpt**：“Intel TDX - General Availability … Compatible with Intel Xeon Gen 5 (Emerald Rapids) and later.”
    **Confidence**：高（第三方镜像，建议以 Broadcom 原文复核）。

11. **Claim**：GNR 上 TDX 实际部署受 BIOS SEAM Loader 支持制约（Gigabyte MS04-CE0 案例，Intel 确认 BIOS 问题）。
    **Source**：ServeTheHome Forums ｜ https://forums.servethehome.com/index.php?threads/...54995/ ｜ 2026-03-09
    **Excerpt**：“Intel Support has officially confirmed that the processor supports all necessary features, but the Gigabyte BIOS is failing to perform the SEAMRR handover.”
    **Context**：用户案例，说明“CPU 支持≠平台可用”。**Confidence**：中（个案）。

12. **Claim**：TDXRay 安全研究影响 SPR/EMR/GNR 三代 TDX，Intel 发 INTEL-SA-01271。
    **Source**：tdxray.cpusec.org ｜ https://tdxray.cpusec.org/ ｜ 2026-04-02
    **Excerpt**：“We evaluated TDXRay on … Xeon Silver 4510 (Sapphire Rapids), Xeon Gold 6526Y (Emerald Rapids), and Xeon 6736P (Granite Rapids). All three are affected.”
    **Confidence**：高（学术团队一手）。

13. **Claim**：12 通道 MRDIMM-8800 单路实测峰值带宽约 743 GB/s，较 RDIMM +40%，单条功耗 18–21W。
    **Source**：腾讯云开发者（MRDIMM 技术实测长文）｜ https://cloud.tencent.com/developer/article/2616612 ｜ 2026-01-13
    **Excerpt**：“在12通道、8800 MT/s 的MRDIMM 配置下，单路CPU 的实测内存带宽峰值可以达到743 GB/s……较顶级DDR5 RDIMM提升40%以上。”
    **Confidence**：中高。

14. **Claim**：HPE 64TB 内存服务器采用至强6+MRDIMM，“内存带宽较标准 DDR5 提升近 40%”。
    **Source**：新浪看点 ｜ https://k.sina.com.cn/article_5953740931_162dee08306703716k.html ｜ 2026-05-12
    **Excerpt**：“首次搭载英特尔至强6处理器（代号Granite Rapids）……内存带宽较标准DDR5提升近40%……实现8800MT/s的传输速率（后续将升级至12800MT/s）”
    **Confidence**：高（官方发布转述）。

15. **Claim**：内存厂商将 MRDIMM 定位于提高虚拟化密度/降低 TCO。
    **Source**：HardDiskDirect（Micron MRDIMM 产品页）｜ https://harddiskdirect.com/mtc20f2085s1hc88xd1-1722872.html ｜ 2026-03-24
    **Excerpt**：“enabling higher virtualization density and reduced TCO through increased VMs per server.”
    **Confidence**：中（营销页）。

16. **Claim**：Dell 17G（至强6）相对 16G 最大核数 64→144，直接提升 VM 密度/整合比。
    **Source**：xByte 博客 ｜ https://www.xbyte.com/blog/dell-poweredge-r670-vs-r660-... ｜ 2026-03-04
    **Excerpt**：“For virtualization and containerized environments, this directly affects: VM density per host … this is a consolidation multiplier.”
    **Confidence**：中。

17. **Claim**：Intel 至强6 产品简介：5:1 平均服务器整合、TCO 收益 40%；TDX 2.0 扩展至 TEE-IO（TDX Connect）。
    **Source**：Intel Xeon 6 Product Brief（intel.com）｜ https://www.intel.com/content/www/us/en/products/docs/xeon-6-product-brief.html ｜ 2026-05-13
    **Excerpt**：“Achieve 5:1 average server consolidation … average TCO gain of 40 percent”；“with Intel TDX version 2.0, support is extended to the trusted execution environment (TEE) for device I/O … via Intel TDX Connect.”
    **Confidence**：极高（官方）。

18. **Claim**：至强6 电信场景平均 5:1（最高 10:1）整合、TCO 节省最高 68%。
    **Source**：EE Times（MWC25）｜ https://www.eetimes.com/at-mwc-intel-shows-xeon-6-power-for-telecom/ ｜ 2025-03-07
    **Excerpt**：“an average 5:1 consolidation of a 5-year-old server, with the potential for up to 10:1 … up to 68% savings in TCO.”
    **Confidence**：高。

19. **Claim**：至强6 VMmark 4.0.1 得分较 3rd Gen Xeon 集群 +2.39×，tiles +2.16×。
    **Source**：Supermicro/Intel 产品简报 PDF ｜ https://www.supermicro.com/products/brief/product-brief-Supermicro-Intel-VMmark-virtualization.pdf ｜ 未注明
    **Excerpt**：“VMmark 4.0.1 Score: 1.07 vs 2.56 (+2.39x); Tiles: 1.2 vs 2.6.”
    **Confidence**：中高（厂商联合简报）。

20. **Claim**：至强6 TDX 升级为 2.0（中国媒体发布会报道）。
    **Source**：雷峰网 ｜ https://m.leiphone.com/category/chipdesign/SYP7MD9UvkxVoj0E.html ｜ 2024-09-30
    **Excerpt**：“至强6的TDX升级为2.0，提供了更可靠、更牢固的安全密钥。”
    **Confidence**：高。

21. **Claim**：Clearwater Forest 2026-06-01 Computex 发布：18A 首款数据中心 CPU、288 Darkmont 核、576MB LLC、12ch DDR5-8000、LGA7529、集成 SGX+TDX 用于机密与多租户部署。
    **Source**：超能网 ｜ https://www.expreview.com/106162.html ｜ 2026-06-01
    **Excerpt**：“采用Intel 18A工艺打造的首款数据中心CPU……最多288个核心……另外还有内置于芯片的可靠性机制，包括英特尔SGX和TDX，以支持机密和多租户部署。”
    **Confidence**：高（官方发布转述）。

22. **Claim**：CWF 12 计算 tile×24 核=288 核；6990E+ 对 6780E 性能 +126%、效率 +55%；对 Cascade Lake 1:9 替换。
    **Source**：少数派 ｜ https://sspai.com/post/110592 ｜ 2026-06-02 ；IT之家 ｜ https://www.ithome.com/0/958/046.htm ｜ 2026-06-01
    **Excerpt**（IT之家）：“可以1:9的比例替换基于第二代至强可扩展'Cascade Lake'处理器的服务器。”
    **Confidence**：高。

23. **Claim**：CWF 发布会主叙事为“CPU 重返 AI 基础设施中心”（agentic AI 编排）。
    **Source**：ServeTheHome Computex 2026 keynote ｜ https://www.servethehome.com/intel-computex-2026-keynote-live-coverage/ ｜ 2026-06-02
    **Confidence**：高。

24. **Claim**：STH 证实 CWF 已出货（“Intel is finally shipping its Xeon 6+”），6900E+ 在既有 6900P 主板上通常仅需 BIOS 更新；平台含 SGX（应用隔离）与 TDX（VM 隔离）。
    **Source**：ServeTheHome ｜ https://www.servethehome.com/intel-xeon-6-clearwater-forest-is-out/ ｜ 2026-06-01
    **Excerpt**：“Intel is finally shipping its Xeon 6+ processor family, codenamed Clearwater Forest… Intel SGX handles application isolation, while Intel TDX is focused on VM isolation…”
    **Confidence**：高。

25. **Claim**：CWF 对 Sierra Forest 机架级每瓦性能 3.5×（Hot Chips 2025），IPC +17%（SPECint2017）。
    **Source**：ServeTheHome Hot Chips 2025 ｜ https://www.servethehome.com/intel-xeon-clearwater-forest-with-288-cores-on-intel-18a-at-hot-chips-2025/ ｜ 2025-08-25
    **Confidence**：高。

26. **Claim**：Intel×Foxconn 液冷 rack 参考设计：100kW、128 插槽、36,864 核、384TB 内存。
    **Source**：AGI Daily ｜ https://agidaily.cc/articles/computex-2026-ai-intel-nvidia ｜ 2026-07-12
    **Confidence**：中（二手）。

27. **Claim**：CWF（E-core）无 AVX-512，定位云原生吞吐负载。
    **Source**：ts2.tech 综述（引 The Register/STH）｜ https://ts2.tech/en/starship-soars-... ｜ 2025-08-27
    **Excerpt**：“the chip lacks support for certain advanced instructions (it sacrifices AVX-512 capability for efficiency).”
    **Confidence**：中高。

28. **Claim**：Panther Lake（酷睿 Ultra 300）2026-01-05 CES 发布，首款 18A 客户端 SoC，Cougar Cove + Darkmont，2026-01 上市。
    **Source**：VideoCardz（引 Intel CES 页面）｜ https://videocardz.com/newz/intel-core-ultra-300-panther-lake-officially-launches-at-ces-2026-on-january-5th ｜ 2025-11-20；超能网 ｜ https://m.expreview.com/102859.html ｜ 2025-11-21
    **Confidence**：高。

29. **Claim**：Panther Lake 架构 2025-10 公布并确认投产。
    **Source**：腾讯新闻/超能网 ｜ https://view.inews.qq.com/a/20251121A05ZWO00 ｜ 2025-11-21
    **Confidence**：高。

30. **Claim**：IPI virtualization（三级控制 bit4）与三级控制框架随 Linux 5.19 合入 KVM。
    **Source**：Phoronix ｜ https://www.phoronix.com/news/Intel-IPI-Virtualization-5.19 ｜ 2022-05-13
    **Excerpt**：“the remaining IPI Virtualization patches made it into KVM's 'next' branch ahead of the Linux 5.19 merge window… also other VT-x work like Tertiary VM-Execution control.”
    **Confidence**：高。

31. **Claim**：IPIv 实测 IPI 处理周期降低 22.21%（xAPIC）/15.98%（x2APIC）。
    **Source**：LWN ｜ https://lwn.net/Articles/863190/ ｜ 2021（系列 v1，2022 合入）
    **Excerpt**：“it will reduce 22.21% and 15.98% cycles consuming in xAPIC mode and x2APIC mode respectively.”
    **Confidence**：高（补丁作者实测）。

32. **Claim**：IPIv 虚拟化 MMIO/MSR ICR 写与 SENDUIPI，引入 PID-pointer table。
    **Source**：LKML/patchew v9 系列 ｜ https://lkml.indiana.edu/2205.0/01004.html ｜ 2022-05
    **Excerpt**：“the processor virtualizes following kinds of operations that send IPIs without causing VM-exits: Memory-mapped ICR writes; MSR-mapped ICR writes; SENDUIPI execution.”
    **Confidence**：极高。

33. **Claim**：三级控制定义：b0 LOADIWKEY exiting、b1 HLAT、b2 EPT paging-write、b3 guest-paging verification、b4 IPI virtualization、b7 Virtualize IA32_SPEC_CTRL。
    **Source**：腾讯云开发者（SDM 译文）｜ https://devpress.csdn.net/v1/article/detail/151683482 ｜ 2025-09-14
    **Confidence**：中高（与 VMware 能力 dump 中 “Enable HLAT / Paging-Write / Guest Paging Verification / IPI Virtualization” 字段一致）。

34. **Claim**：Notify VM exit（二级控制 bit31，NOTIFY_WINDOW 字段，EXIT_REASON_NOTIFY=75，KVM_CAP_X86_NOTIFY_VMEXIT）2022 年合入 KVM，默认关闭（notify_window=-1）。
    **Source**：LWN ｜ https://lwn.net/Articles/896122/ ｜ 2022-05-24
    **Excerpt**：“Virtual machines can exploit Intel ISA characteristics to cause functional denial of service to the VMM. This series introduces … Notify VM exit.”
    **Confidence**：高。

35. **Claim**：Notify VM exit 动机是防止恶意 guest 造成 CPU 不可用（CVE-2015-5307 类）。
    **Source**：LKML（Tao Xu, Intel）｜ https://lkml.org/lkml/2021/6/2/390 ｜ 2021-06-02
    **Confidence**：极高。

36. **Claim**：Bus-lock VM exit 检测 guest 总线锁并可限流/查杀（split-lock 之虚拟化对应）。
    **Source**：leinux 博客（KVM 源码分析）｜ https://leinux.netlify.app/2023/11/02/split-lock-bus-lock.html ｜ 2023-11-02
    **Confidence**：中高。

37. **Claim**：截至 2026-08，KVM 列表仍在评审 “KVM: TDX: Enable VM-DoS Prevention Features for TDX” v3（为 TD 启用 Notify/Bus Lock VM exit）与 TDX KVM selftests v14。
    **Source**：virt-report 日报（汇总 KVM 邮件列表）｜ https://virt.taifua.com/daily/2026-08-15.html ｜ 2026-08-15
    **Excerpt**：“启用 Notify/Bus Lock VM exit，v3 拆分便于 backport……为 TDX 提供 DoS 防护。”
    **Confidence**：中高。

38. **Claim**：SDM 已定义 user-interrupt notification vector 的 VM-entry/exit 控制（Load/Clear UINTR notification vector）。
    **Source**：VMware 社区 VT-x 能力 dump（Sapphire Rapids 平台）｜ https://communities.vmware.com/t5/.../td-p/2964057 ｜ 2021–2022
    **Excerpt**：True VM-Exit/Entry Controls 中含 “Clear/Load user-interrupt notification vector”。
    **Confidence**：中高。

39. **Claim**：Intel 官方 TDX 文档体系含 “Incompatibilities between v1.0 and v1.5”（2023-12）、迁移/分区架构规范（2024-11）、TDX Connect 归入 TDX 2.0。
    **Source**：Intel 中国开发者 TDX 文档页 ｜ https://www.intel.cn/content/www/cn/zh/developer/tools/trust-domain-extensions/documentation.html ｜ 2025-08-04
    **Excerpt**：“Intel TDX version 2.0 extends Intel TDX to support Trusted Execution Environment for device I/O (TEE-IO).”
    **Confidence**：极高。

40. **Claim**：TDX 2.0.x 支持 TD 在线迁移与分区 TD 迁移、TD-bound sealed keys、TDREPORT 分区信息。
    **Source**：同[^5^]（TDX Module Releases）｜ 2024–2026
    **Confidence**：极高。

41. **Claim**：2025-02-24 Intel 发布至强6 并宣布 TDX Connect 硬件支持（TEE-IO）。
    **Source**：Confidential Computing Consortium 通讯 ｜ https://confidentialcomputing.io/2025/03/03/welcome-to-the-2025-february-newsletter/ ｜ 2025-03-03
    **Excerpt**：“On February 24, Intel launched the latest processors in the Intel Xeon 6 family and announced support for TEE-IO. The Intel Xeon 6 processors with P-cores include hardware support for Intel TDX Connect…”
    **Confidence**：高。

42. **Claim**：Intel 新闻资料室列出 2025-02-24 “Announcing Intel TDX Connect Support on Intel Xeon 6”。
    **Source**：Intel Newsroom Press Kit ｜ https://newsroom.intel.cn/en/press-kit/press-kit-intel-xeon-6-processors ｜ 2025-06-10（页面更新）
    **Confidence**：极高。

43. **Claim**：TDX Connect 方案需 CPU + 主机 OS/hypervisor + TEE-IO 设备三方就绪，Intel 正推进生态。
    **Source**：同[^41^]
    **Excerpt**：“Solutions based on Intel TDX Connect will require a capable CPU, an enabled host OS/hypervisor, and a TEE-IO capable device.”
    **Confidence**：高。

44. **Claim**：2025-04 DCAI 拆分（DCG/AI 集团），DCG 直接向 CEO 汇报；2025-09 Kechichian 出任 DCG GM。
    **Source**：DataCenterDynamics ｜ https://www.datacenterdynamics.com/en/news/intel-announces-leadership-shuffle-appoints-new-data-center-head/ ｜ 2025-09-10
    **Excerpt**：“DCG was formerly known as the Data Center and AI Group before being split up following the appointment of current CEO Lip-Bu Tan. This rearrangement, announced in April 2025…”
    **Confidence**：高。

45. **Claim**：2026 年 AI 加速器团队重新并入 DCG，理由“AI 与现代数据中心根本相连，Xeon 是中心”。
    **Source**：CRN ｜ https://www.crn.com/news/components-peripherals/2026/exclusive-intel-taps-ex-arm-hpe-exec-... ｜ 2026（未注明具体日期）
    **Excerpt**：“AI and the modern data center are fundamentally linked… Xeon remains central across head nodes, edge deployments and many inference workloads.”
    **Confidence**：中高。

46. **Claim**：TrendForce 确认 DCAI 重组脉络（2025-09 管理层重构）。
    **Source**：TrendForce ｜ https://www.trendforce.com/news/2026/07/30/news-intel-reportedly-to-cut-103-jobs-... ｜ 2026-07-30
    **Confidence**：高。

47. **Claim**：Intel IPU 官网将“虚拟化环境”列为头号用例：多租户、网络/存储虚拟化卸载、最高 1K VF、200Gb。
    **Source**：intel.com IPU 产品页 ｜ https://www.intel.com/content/www/us/en/products/details/network-io/ipu.html ｜ 2025-11-03
    **Excerpt**：“Multiple tenants on host. IPU provides virtualized Network and Storage functionality… Transparent to VM or Containers - up to 1K VFs.”
    **Confidence**：极高。

48. **Claim**：TDX guest 支持自 Linux 5.19 起逐步合入；host 侧长期 out-of-tree，6.16 主线化；QEMU 9.2+、Ubuntu 25.10 host。
    **Source**：minzkn 内核追踪页 ｜ https://www.minzkn.com/linuxkernel/pages/confidential-computing.html ｜ 2025–2026
    **Confidence**：中高（与 Phoronix[^49^]、Ubuntu[^6^]交叉一致）。

49. **Claim**：KVM TDX host 支持合入 Linux 6.16（2025-06 合入窗口）。
    **Source**：Phoronix ｜ https://www.phoronix.com/news/Intel-TDX-Host-KVM-Linux-6.16 ｜ 2025-06-02
    **Excerpt**：“only now with the Linux 6.16 kernel … is there going to be mainline kernel support for TDX on the host-side with KVM. 'Initial support for TDX in KVM.'”
    **Confidence**：高。

50. **Claim**：Ubuntu 25.10（2025-10-09，kernel 6.17）带来 early Intel TDX host 支持，为 26.04 LTS 铺路。
    **Source**：Canonical 官方博客 ｜ https://ubuntu.com/blog/canonical-releases-ubuntu-25-10-questing-quokka ｜ 2025-10-09
    **Excerpt**：“Ubuntu 25.10 kernels will ship with Intel TDX host support… lays the foundation for native support of Intel TDX with Ubuntu 26.04 LTS.”
    **Confidence**：极高。

51. **Claim**：Ubuntu 26.04 LTS（2026-04）包含 Intel TDX 与 AMD SEV-SNP 完整支持。
    **Source**：OSTechNix ｜ https://ostechnix.com/ubuntu-26-04-lts-resolute-raccoon-features-release-notes/ ｜ 2026-04-24
    **Confidence**：中高。

52. **Claim**：NVIDIA 机密计算矩阵要求 Ubuntu 25.10/26.04 + kernel 6.17+ 跑 Intel TDX（EMR/GNR）+ GPU CC。
    **Source**：NVIDIA Docs ｜ https://docs.nvidia.com/datacenter/cloud-native/confidential-containers/latest/supported-platforms.html ｜ 2026
    **Confidence**：高。

53. **Claim**：OpenStack Nova 2026.2 批准 libvirt TDX 支持规格（kernel≥6.16、QEMU≥10.1、libvirt≥11.6）。
    **Source**：OpenStack Specs ｜ https://specs.openstack.org/openstack/nova-specs/specs/2026.2/approved/intel-tdx-libvirt-support.html ｜ 2026-09-07
    **Confidence**：高。

54. **Claim**：微软官方：Windows 11 22H2 起符合条件设备默认启用 VBS 与 Credential Guard；Server 2025 默认启用 Credential Guard。
    **Source**：hitoritech（引 Microsoft Learn）｜ https://hitoritech.com/blog/how-to-fix-netlogon-5719-on-windows-11-24h2/ ｜ 2026-05-14
    **Excerpt**：“starting with Windows 11 version 22H2, VBS and Credential Guard are enabled by default on devices that meet requirements.”
    **Confidence**：中高（引微软文档二手，建议以 Microsoft Learn 原文复核）。

55. **Claim**：内存完整性默认开启要求 CPU 支持 VT-x/AMD-V 并在固件中启用、Secure Boot、驱动兼容 HVCI。
    **Source**：IT之家（查微软官方支持文档）｜ https://www.ithome.com/0/997/293.htm ｜ 2026-09-02
    **Excerpt**：“处理器必须支持硬件虚拟化，并且 BIOS/UEFI 中应启用 Intel VT-x 或 AMD-V。”
    **Confidence**：高。

56. **Claim**：24H2 的 VBS 带 UEFI lock，持久化于固件，关闭更困难；破坏 VMware 嵌套虚拟化。
    **Source**：metis IT ｜ https://metisit.com/nieuws/virtualization-issues-with-vmware-workstation-pro-on-windows-11-version-24h2/ ｜ 2025-04-07
    **Excerpt**：“Windows 24H2 introduced … VBS with UEFI lock … the settings are persisted in EFI (firmware).”
    **Confidence**：中高。

57. **Claim**：微软在 ≤23H2 弃用 VBS Enclaves，24H2+/Server 2025 保留。
    **Source**：网易（转 cnBeta）｜ https://www.163.com/dy/article/JTC4Q27P0511BLFD.html ｜ 2025-04-17
    **Excerpt**：“Windows 11 版本 24H2 及更高版本将继续支持 VBS 飞地。Windows Server 2025 及更高版本将继续支持。”
    **Confidence**：高。

58. **Claim**：Windows 11 企业版热补丁要求 VBS 开启。
    **Source**：BornCity ｜ https://borncity.com/win/2025/04/05/windows-11-24h2-hotpatching-now-available/ ｜ 2025-04-04
    **Excerpt**：“And finally, Virtualization Based Security (VBS) must be enabled.”
    **Confidence**：中高。

59. **Claim**：25H2（2025-10 RTM Build 26200）默认启用 HVCI/VBS。
    **Source**：办文绿软（RTM 说明）｜ https://www.5071211.com/1638.html ｜ 2025-11-04
    **Excerpt**：“安全增强：默认启用 HVCI（基于虚拟化的安全性），强化内核防护。”
    **Confidence**：中（非官方站，方向与微软基线一致）。

60. **Claim**：25H2 下 hvloader.efi 早期加载常驻 hypervisor，msinfo32 恒显示“基于虚拟化的安全性：正在运行”，Type-2 hypervisor 冲突。
    **Source**：CSDN ｜ https://bbs.csdn.net/weixin_29295541/article/details/100182519 ｜ 2026-07-08
    **Confidence**：中。

61. **Claim**：VBS/HVCI 默认开启致游戏帧率下降 5–25%（Tom's Hardware 实测口径）。
    **Source**：Ted聊科技 ｜ https://adersaytech.com/windowsos-tutorial/windows-11-25h2-vbs-memory-integrity-gaming-fix.html ｜ 2026-04-12；Windows Report ｜ 2024-10-03
    **Confidence**：中高。

62. **Claim**：Diamond Rapids 官方宣布（Computex 2026）：2027 年推出、18A-P、核心数 +50%、内存带宽翻倍、PCIe Gen6。
    **Source**：少数派（引官方）｜ https://sspai.com/post/110592 ｜ 2026-06-02；aihardwareindex 汇总（引 Tom's Hardware 标题）｜ 2026-06-01
    **Excerpt**：“Intel Xeon 7 'Diamond Rapids' CPUs officially launching in 2027 on Intel 18A-P — PCIe 6.0, 50 percent higher core counts and twice the memory bandwidth.”
    **Confidence**：高（宣布事实）；细节规格中。

63. **Claim**：Diamond Rapids 192 P-core（无 SMT）、Panther Cove-X、LGA 9324、650W、Coral Rapids 2028 恢复 SMT。
    **Source**：Wccftech ｜ https://wccftech.com/intel-diamond-rapids-xeon-7-cpus-built-on-18a-p-... ｜ 2026-06-01
    **Excerpt**：“a 50% increase in core count over Granite Rapids … 192 P-cores in total … Diamond Rapids won't support SMT; that will be coming back with … Coral Rapids.”
    **Confidence**：中（媒体推算，官方仅确认 +50%）。

64. **Claim**：Diamond Rapids 属 Oak Stream 平台、18A-P、1.6TB/s 内存带宽、128×PCIe Gen6、CXL 3.0、核心数 +50% 以上。
    **Source**：华尔街见闻 ｜ https://wallstreetcn.com/articles/3780232 ｜ 2026-08-25
    **Confidence**：中高。

65. **Claim**【传闻】：Diamond Rapids 初期最高 256 核、后续 512 核版本、MRDIMM-2 达 1.6TB/s、18A（非 -P）。
    **Source**：超能网 ｜ https://m.expreview.com/105491.html ｜ 2026-04-27
    **Confidence**：低-中（与官方 192 核口径冲突，列传闻）。

66. **Claim**：Diamond Rapids 支持 APX、AMX 增强、16 通道最高 12800MT/s、128×PCIe6/CXL3.0、28GB LLC（原文疑为 288MB 量级之误，保留原文）。
    **Source**：凤凰网科技 ｜ https://tech.ifeng.com/c/8vsAdB5TKLM ｜ 2026-08-25
    **Confidence**：中。

---

## 维度总结

1. **TDX 是 2022–2026 窗口内 Intel 虚拟化最大的增量**：1.0（SPR, 2023）→ 1.5（EMR/SRF，TD 迁移/分区）→ **2.0（GNR, 2024-09）→ 2.0 + TDX Connect/TEE-IO（2025-02 宣布）→ 扩展至 Clearwater Forest（2026-06 GA）**；模块版本与平台绑定（1.5.x vs 2.0.x），至强6 起密钥强度升至 AES-256。软件侧 2025 年是分水岭：KVM host 支持合入 Linux 6.16、Ubuntu 25.10/26.04 LTS 提供生产级栈、VMware VCF 9.1（2026-05）GA TDX。
2. **Xeon 6 的虚拟化叙事 = 密度×能效×机密计算**：官方 5:1（最高 10:1）整合、TCO -40%/-68%；VMmark 实测级数据 +2.39×；MRDIMM-8800（实测 743GB/s/路）直接服务于 VM 密度与内存敏感型虚拟化负载。
3. **18A 双平台落地**：Clearwater Forest（288 E-core，SGX+TDX，面向云原生/多租户/agentic AI 编排，1:8–1:9 整合叙事）2026-06 发布并出货；Panther Lake（客户端 18A，2026-01 GA）未见新 VMX 特性，其虚拟化意义在 VBS 生态。
4. **VMX 微架构增强集中在 2022（SPR 代）**：三级执行控制框架 + IPI virtualization（Linux 5.19，IPI 开销 -16%~-22%）、Notify VM exit、Bus-lock detection 构成“防 DoS + 中断虚拟化”组合；HLAT/EPT paging-write/guest-paging verification 已在 SDM 定义，KVM 使能相对滞后；TDX 语境的 DoS 防护 2026 年仍在 KVM 列表收尾。
5. **官方定位转变**：DCAI 2025 年拆分（DCG/AI），2026 年 AI 团队回并 DCG——“Xeon 是 AI 基础设施中心”；虚拟化卸载由 IPU/DPU 承接（最高 1K VF、对 VM 透明）。
6. **消费端普及化**：Windows 11 22H2→24H2→25H2 逐级把 VBS/HVCI 变为默认且带 UEFI lock 的基线，VT-x/EPT 成为所有新 PC 的常备能力；代价是 Type-2 hypervisor 冲突与 5–25% 游戏性能损耗，成为社区主要摩擦点。
7. **未来**：Diamond Rapids（Xeon 7，2027，18A-P，+50% 核、双倍内存带宽、PCIe Gen6）已宣布但未披露 TDX/VMX 计划；256/512 核版本为传闻。TDX 攻防研究（TDXRay, 2026）与部署摩擦（BIOS/SEAM Loader）表明该技术栈已进入成熟期问题阶段。

**未决/低置信项**：Diamond Rapids 的 TDX 版本与 VMX 新特性（无官方披露）；HLAT 等三级控制的 KVM 合入确切版本；微软 VBS 默认策略的 Microsoft Learn 原文条款建议复核；Coral Rapids 规格均为泄露。
