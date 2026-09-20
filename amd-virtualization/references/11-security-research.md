## 11. 安全研究:攻击面演进与漏洞史

本章对 AMD 虚拟化攻击面做编年式审计:范围覆盖 SVM/SEV 架构公开以来(2017–2026)具名的学术攻击与 CVE 共 30 项,含论文原文(PoC 多数开源)、AMD 官方安全公告(AMD-SB 系列)与 NVD 条目三方交叉核实。第 8–10 章阐述的 SEV/SEV-ES/SEV-SNP 三代机制是本章的审计对象;第 3 章的 VMCB 与第 5 章的 AVIC 是 11.4 节的技术背景。阅读本章时需注意两条方法论约定:其一,漏洞"修复状态"以 AMD 官方公告口径为准,第三方评分与厂商评分分歧处已在文中注明裁定依据;其二,"已确立事实"(论文实验数据、公告原文)与"推断/解读"(攻击面迁移规律)分别陈述。

### 漏洞速查总表

表 11-1 汇总 2017–2026 年间 30 项代表性攻击与漏洞,按披露时间排序;"影响代际"中的 Naples/Rome/Milan/Genoa/Turin 分别对应 EPYC 7001/7002/7003/9004/9005 系列。

**表 11-1 AMD 虚拟化漏洞与攻击速查总表(2017–2026)**

| # | 攻击/漏洞 | CVE/公告 | 披露时间 | 影响代际 | 修复状态 |
|---|---|---|---|---|---|
| 1 | Hetzelt & Buhren(VMCB 明文读取/页重放)[^317^] | 无 | 2017-04 | SEV | 寄存器明文由 SEV-ES 修复;重放待 SEV-SNP |
| 2 | Du 等(无完整性加密分析)[^318^] | 无 | 2017-12 | SEV | SEV-SNP 修复;Naples/Rome 不可修复 |
| 3 | SEVered(nPT 重映射明文提取)[^226^] | 无 | 2018-05 | SEV | 架构缺陷;SEV-SNP RMP 根治 |
| 4 | Extracting Secrets from Encrypted VMs | 无 | 2019-01 | SEV | SEV-SNP 修复 |
| 5 | SEV 固件 ECDH 无效曲线攻击[^319^] | CVE-2019-9836 | 2019-06 | SEV 固件 | 固件更新 |
| 6 | SEVerESt(VMCB 侧信道/应用指纹)[^320^] | 无 | 2019-07 | SEV/SEV-ES | SEV-ES 大部分缓解;指纹残留 |
| 7 | Unprotected I/O(DMA 加解密预言机)[^225^] | 无 | 2019-08 | SEV/SEV-ES | SEV-SNP 限制 HV 写权限后部分缓解 |
| 8 | Insecure Until Proven Updated(证明缺陷)[^321^] | 无 | 2019-11 | SEV 固件 | 固件更新(TCB 版本纳入证明) |
| 9 | SEVurity(无完整性内存加密代码注入)[^322^] | 无 | 2020-05 | SEV(Milan 前) | SEV-SNP 修复 |
| 10 | KVM 嵌套 SVM double-fetch 逃逸[^323^] | CVE-2021-29657 | 2021-03 | Linux KVM-AMD | 内核 5.10.28/5.11.12 修复 |
| 11 | SEVerity(I/O 通道代码注入)[^324^] | CVE-2020-12967 / AMD-SB-1004 | 2021-05 | SEV/SEV-ES | 无固件修复,要求迁移 SEV-SNP |
| 12 | undeSErVed(证明不感知内存重排)[^233^] | CVE-2021-26311 / AMD-SB-1004 | 2021-05 | SEV/SEV-ES | 同上,要求迁移 SEV-SNP |
| 13 | CipherLeaks(VMSA 密文侧信道)[^231^] | CVE-2020-12966 / AMD-SB-1013 | 2021-08 | SEV/ES/SNP 全代 | VMSA 寄存器保护硬件补丁;根因未除 |
| 14 | CrossLine(ASID 滥用)[^325^] | 无 | 2021-11 | SEV/SEV-ES | V1 被 SNP 阻止;V2 被 SEV-ES 限制 |
| 15 | One Glitch(电压毛刺攻陷 AMD-SP)[^326^] | 无 | 2021-11 | Zen 1–3 | 不修(物理攻击超出威胁模型) |
| 16 | IOMMU TLB 未刷新[^327^] | CVE-2021-26312 | 2021 | SEV + IOMMU | 固件修复 |
| 17 | Google P0 SEV-SNP/AMD-SP 安全审计[^328^] | 多个固件 issue | 2022-05 | SEV-SNP 固件 | 固件滚动修复 |
| 18 | CacheWarp(INVD 缓存回滚)[^329^] | CVE-2023-20592 / AMD-SB-3005 | 2023-11-14 | EPYC 7001/7002/7003 | 仅 Milan 微码修复;1st/2nd Gen 不予修复 |
| 19 | IOMMU DTE 故障绕过 RMP[^330^] | CVE-2023-20584 | 2023 | SEV-SNP + IOMMU | 固件/微码修复 |
| 20 | WeSee(恶意 #VC 注入)[^245^] | CVE-2024-25742 | 2024-05 | SEV-SNP | Linux 内核补丁;推荐 Restricted/Alternate Injection |
| 21 | Heckler/Ahoi(恶意中断注入)[^331^] | CVE-2024-25743 / 25744 | 2024-08 | SEV-SNP(及 TDX) | 25744 内核补丁;25743 披露时未完全缓解 |
| 22 | BadRAM(SPD 别名攻破 RMP/证明)[^268^] | CVE-2024-21944 | 2024-12 | SEV-SNP、SGX、TDX | 启动时内存别名检测 |
| 23 | 微码签名验证不当(可加载恶意微码)[^332^] | CVE-2024-56161 | 2025-02 | Zen 1–4 | 微码/固件修复 |
| 24 | CounterSEVeillance(PMC 侧信道)[^333^] | 无 | 2025-02 | SEV-SNP | 未修复;228 个 PMC 事件对 HV 可见 |
| 25 | SEV-ES guest攻击 SNP guest[^334^] | CVE-2025-48514 / 48517 | 2025-07 | SEV 固件 | 固件修复;副作用:SNP 启用时禁用 SEV-ES |
| 26 | Relocate-Vote(SNP 页迁移密文侧信道)[^335^] | AMD-SB-3021 | 2025-08-12 | SEV-SNP | ABI 1.58 新增 `PAGE_SWAP_DISABLE` guest策略 |
| 27 | RMPocalypse(RMP 初始化竞态)[^261^] | CVE-2025-0033 / AMD-SB-3020 | 2025-10-13 | EPYC 7003/8004/9004/9005 | 固件修复;AMD 官方定级 Medium |
| 28 | TEE.fail / Battering RAM(总线插接/运行时别名)[^336^] | 无 | 2025-10 | SEV-SNP(含 Ciphertext Hiding)、SGX、TDX | 不修(物理攻击超出威胁模型) |
| 29 | StackWarp(栈引擎 rsp 操纵)[^337^] | CVE-2025-29943 / AMD-SB-3027 | 2026-01 公开 | Zen 1–5 | 微码 2025-07/2025-10 发布;Embedded AGESA 2026-04 |
| 30 | AVIC erratum #1235(ICR 读陈旧 IsRunning)[^23^] | CVE-2026-64172 | 2025–2026 | Zen 1/Zen 2 及 Hygon 18h | 软件 workaround(禁用 IPI 虚拟化);Zen 4+ 不受影响 |

**解读**:表中 30 项样本呈现三个可量化特征。第一,时间分布明显右移——2017–2021 年(第 1–16 行)的攻击几乎全部针对 SEV/SEV-ES 的"内存加密无完整性"与"VMCB 明文"两项架构原罪,修复方式高度一致地指向 SEV-SNP;2023 年后(第 18–30 行)的攻击则分散于微架构状态、中断语义、密文可观测性、固件实现与物理层五个互不相同的子面,表明 RMP 收敛了页表层攻击面后,攻击并未减少而是扩散。第二,AMD 的修复姿态分层清晰:30 项中"微码/固件修复"约 12 项、"新代际/ABI 消化"约 9 项、"明确不修"5 项(第 15、18 部分代际、28 行及 SEVerity/undeSErVed 两项)——不修决策集中于旧代际平台与物理攻击两类。第三,绝大多数攻击要求主机管理员/恶意 hypervisor(以下简称 HV)权限,这既是机密计算威胁模型的题中之义,也意味着 CVSS 评分普遍被厂商定在中低段(如 StackWarp Low 4.6、RMPocalypse Medium),评分与论文演示的破坏力之间存在系统性落差,部署方不应以 CVSS 作为唯一风险排序依据。

### 攻击面迁移时间线

![AMD 虚拟化攻击面迁移时间线(2017–2026)](images/sec11_attack_surface_timeline.png)

**图 11-1** 攻击面迁移时间线:横轴为公开披露时间,纵轴按攻击所在抽象层分组,虚线标注 SEV(2017)、SEV-ES(2019)、SEV-SNP(2021)与 Zen 5 Ciphertext Hiding(2024)四个防御里程碑。度量范围为表 11-1 中有明确披露时间的 26 项攻击;时间取论文发表或公告发布月份。来源:各攻击条目引自表 11-1 对应文献,代际里程碑引自 AMD 官方资料[^12^]。

图中可读出 11.5 节将展开的核心规律:底部"内存/页表完整性"层在 2017–2021 年密集出现后,于 SNP 落地(2021-03 虚线)后近乎绝迹,仅 RMPocalypse(2025-10)以固件实现缺陷形态回归;而"微架构状态""中断/异常语义""物理层"三层的首次出现时间分别为 2023、2024、2021 年(物理层在 2025 年密集化)——攻击面每次迁移都落在上一代信任边界之外、抽象层级更低或更物理的位置。

### 11.1 SEV 时代攻击(2017–2021)

#### 11.1.1 无完整性原罪:nPT 重映射、VMCB 明文与证明盲区

SEV 第一代的安全叙事建立在三个后来被逐一证伪的隐式信任上:hypervisor 可读寄存器与页表但行为良性、页级加密无需完整性、固件证明无需绑定版本。最早的密码学分析来自 Du 等(2017-12):SEV 的 AES-XE tweak 基于主机物理地址而非guest物理地址,HV 可在不同 VM 间交换密文页而guest仍能"成功"解密,从而获得 root 权限[^318^]。Hetzelt 与 Buhren(ACM VEE'17)给出首个系统性分析:VMCB 未加密使 HV 可读取/篡改guest寄存器并发起 ROP 攻击;内存无完整性叠加 nPT 由 HV 维护,可经页错误序列定位密码页并在 SSH 登录中重放,直接获取 root[^317^]。寄存器明文问题由 SEV-ES(2019,VMSA 加密)修复,而重放问题直到 SEV-SNP 的 RMP 才根治。

SEVered(EuroSec'18,Fraunhofer AISEC)把页表层缺陷推向极致:GVA→GPA 翻译由guest控制,而 GPA→HPA 的二级地址翻译(SLAT/nPT)由 HV 维护,恶意 HV 重映射guest页后以 VM 内远程服务(Apache/nginx/OpenSSH)为"回显通道",即可以明文提取 SEV 加密 VM 的全部内存;实测对 Apache/nginx 提取速率 79.4 KB/s、对 OpenSSH 41.6 KB/s,成功导出测试服务器完整 2 GB 内存[^226^][^338^][^227^]。这是纯架构设计缺陷,无微码可修,Naples/Rome 平台永远无法修复。同一时期,SEVerESt(ACM AsiaCCS'19)通过持续监控未加密的 VMCB 寄存器值对guest内应用做指纹识别并部分提取内存[^320^];SEV-ES 加密 VMSA 后大部分失效,但应用指纹在 SEV-ES 下仍然可行[^244^]。I/O 路径上,Li 等(USENIX Security'19)指出 SEV 的 DMA 必须经过未加密的 SWIOTLB 反弹缓冲区,HV 借此构造内存解密/加密预言机,并发现 SEV 页错误泄漏含页内偏移的完整出错地址(不同于 SGX 的偏移掩码),形成细粒度页错误侧信道[^225^][^339^];论文明确判断该 I/O 安全问题在 SNP 修复完整性后仍将存在[^225^]。

SEVurity(IEEE S&P 2020)逆向了 AMD 改进后的 tweak 函数,在最小假设下(仅需一次guest内存写观察)构造高速加密预言机,向 SEV VM 注入并执行任意代码[^322^][^340^]——"没有完整性的内存加密必然失败"这一结论直接促成了 RMP 的设计。CrossLine(ACM CCS'21)是首个不依赖内存完整性缺陷的 SEV 攻击:SEV 用 ASID 控制密文页/缓存行/TLB 访问,攻击者 VM 将 ASID 改为受害者 ASID 即可冒充受害者;V1 借页表遍历解密受害者页表(SEV-ES 下仍可用),V2 短暂执行受害者加密指令构造加解密预言机[^325^][^341^]。

这一时代的终局性公告是 AMD-SB-1004(2021-05-11),同时对应两篇 WOOT'21 论文[^233^]:SEVerity(CVE-2020-12967,CVSS 3.1 7.2)利用 SEV-ES 禁止 DMA 直写加密内存的事实,经 I/O 通道注入任意代码并用 HV 定位触发执行,成功率 100%[^324^][^342^];undeSErVed trust(CVE-2021-26311)发现guest地址空间内存可被重排而证明机制检测不到(排列无关证明),HV 可借此在guest内执行任意代码[^233^][^343^]。AMD 明确表示不为这两个漏洞发布固件更新——"AMD is not releasing updated firmware to address these vulnerabilities",缓解措施就是使用 SEV-SNP(仅 3rd Gen EPYC Milan 起支持)[^344^]。固件与证明层的其余发现包括:CVE-2019-9836(2019-06),SEV 固件 ECDH 实现的无效曲线攻击可恢复平台 DH 密钥,固件更新修复[^319^];Insecure Until Proven Updated(CCS 2019)发现远程证明未绑定固件 TCB 版本,旧固件可冒充最新平台[^321^];One Glitch to Rule Them All(CCS'21)对 AMD-SP 的 ROM bootloader 做电压故障注入,以成本低于 50 美元的设备提取 SEV/SEV-ES 的 CEK 与 SEV-SNP 的 VCEK seed,覆盖 Zen 1–3 全代,AMD 视作超威胁模型不予修复[^326^][^345^]。

### 11.2 密文与侧信道

#### 11.2.1 从 CipherLeaks 到 Ciphertext Hiding:确定性加密的十年账单

CipherLeaks(CVE-2020-12966,USENIX Security'21,AMD-SB-1013)揭示了 SEV 全代(SEV/ES/SNP)共有的结构性弱点:内存加密采用 AES-XEX 模式,同一物理地址同一明文永远产生同一密文,且 HV 被允许读取密文。通过监控 VMEXIT 时 VMSA 页密文变化推断寄存器值,研究者以 100% 准确率攻破 OpenSSL 常数时间 RSA 与 ECDSA(恢复 RSA 私钥 d 与 ECDSA nonce k)——这是第一个对 SEV-SNP 的实际攻击[^231^][^244^]。披露时间线为 2020-12 报告 AMD,embargo 至 2021-08-10,AMD 同日发布 AMD-SB-1013 并给出 VMSA 寄存器保护硬件补丁(SNP)[^231^][^346^]。但补丁只保护 VMSA 页:A Systematic Look at Ciphertext Side Channels(IEEE S&P 2022)将密文侧信道推广到任意内存页(内核数据结构、栈、堆),证明 VMSA 补丁"明显不足",因为根因——无状态且无认证的加密模式叠加 HV 对密文的无限制读访问——未被修复[^347^]。后续工作沿同一根因持续产出:HyperTheft(CCS 2024)经密文侧信道窃取 TEE 内神经网络模型权重[^348^];Heracles 利用 `SNP_PAGE_MOVE` API 构造选择明文预言机实现字节粒度内存泄漏[^280^]。

Relocate-Vote(USENIX Security'25,AMD-SB-3021)滥用 SNP 硬件页迁移操作提取加密内存的稀疏性信息(零/非零模式),可泄漏页表结构乃至 LLM 推理 token;2025-01-22 报告 AMD,embargo 至 2025-08-12,AMD 在 SEV-SNP ABI 1.58 引入 `PAGE_SWAP_DISABLE` guest策略并发布安全简报[^335^];同期 ETH Zurich 的"选择明文预言机"工作亦被 AMD-SB-3021 一并回应[^349^]。与密文侧信道平行,CounterSEVeillance(NDSS 2025)证明观测面不限于密文:228 个性能监控计数器(PMC)事件对潜在恶意 HV 暴露,结合 APIC 单步执行实现指令级分辨率,8 分钟内从单次 Mbed TLS 签名提取完整 RSA-4096 密钥,并首次攻击 SEV-SNP VM 内的 TOTP 验证(平均 31.1 次猜测恢复 6 位 TOTP);该攻击在全部打补丁的系统上仍有效,无 CVE、未修复[^333^]。

硬件层的根本性对策迟至 Zen 5(EPYC 8005/9005,Turin)才出现:Ciphertext Hiding 在硬件层面限制 HV 读取密文,已列入 AMD 官方 SEV 代际表[^12^][^280^][^350^]。但 TEE.fail(2025-10)证明其仍可被 DDR5 物理总线插接绕过(见 11.3.1)——密文侧信道家族以"软件补丁→ABI 策略→硬件特性→物理层回潮"的路径完整演绎了一次攻防循环。

### 11.3 SNP 时代攻击

#### 11.3.1 RMP 之外:微架构状态、中断语义与物理层

SEV-SNP 的 RMP 使经典页表重映射与重放攻击灭绝,但 RMP 只保护 DRAM 页的归属与完整性,不保护缓存一致性、流水线状态、中断语义与物理总线——2022 年后的高质量攻击几乎全部落在这些未覆盖面上。

SNP 时代的开门审计来自 Google Project Zero 与 Google Cloud Security(2022-05),对 AMD Secure Processor 与 SEV-SNP 固件的深度审计发现批量问题:失效guest泄漏 launch secrets、HMAC 越界读、RsaPssVerify 越界写、SEV-ES integrity pointer 落在 TMR 之外、RMP 降级攻击、IOMMU TLB 在 SNP-INIT 时未刷新、固件接受可塑 MMIO 页、ASID 下溢等,多数经固件滚动修复[^328^]。

**CacheWarp(CVE-2023-20592,AMD-SB-3005)** 是首个纯软件击破 SNP 完整性的攻击:CISPA 与 TU Graz 发现 `INVD` 指令在 AMD CPU 上可在不写回的情况下丢弃脏缓存行(实际行为与官方手册不符),恶意 HV 配合 APIC 定时器单步执行,即以单条 store 粒度回滚guest VM 的内存修改[^329^][^351^][^352^]。两个原语——TimeWarp(丢弃 call 指令隐式压栈的返回地址,使执行流"时间倒流")与 DropForge(丢弃数据写)——支撑三个演示:10 秒内从 Intel IPP 库完整恢复 RSA-CRT 私钥(Bellcore 攻击)、免密登录 OpenSSH、sudo 提权 root[^353^][^354^]。2023-11-14 协同披露,AMD-SB-3005 定级 Medium,**仅 3rd Gen EPYC(Milan)提供微码修复,1st/2nd Gen 不予修复**,理由是"SEV/SEV-ES 本就不承诺内存完整性且 SNP 不可用"[^355^][^356^];Ubuntu 确认修复微码含于上游 commit `b250b32a`[^357^]。Zen 4/5 上 CacheWarp 已被修复[^337^]。

**WeSee(CVE-2024-25742,IEEE S&P 2024)** 把攻击面迁到异常语义:ETH Zurich 发现 HV 可在任意时刻向执行 SEV-SNP VM 的 CPU 注入 29 号向量(#VC 异常);VM 的 #VC handler 不校验异常真实起因,而 handler 本身会在 VM 与 HV 间复制数据/寄存器。精心构造的注入可获得跳过指令、泄漏寄存器、篡改寄存器、任意内存读写四个原语并级联为任意代码注入;演示包括泄漏 NGINX 的 kTLS 密钥、篡改防火墙规则,以及用 2891 次 #VC 注入获得内核 root shell[^245^]。修复为 Linux 内核补丁(AMD 工程师参与),根治手段是 SNP 的 Restricted Injection / Alternate Injection 模式[^245^]。同团队的 **Heckler/Ahoi 家族(CVE-2024-25743/25744,USENIX Security'24)** 将攻击泛化为"HV 注入恶意中断/异常触发受害者 handler 副作用":用 `int 0x80` 等在 SEV-SNP 与 Intel TDX 上绕过 OpenSSH 与 sudo 认证;25744 已有内核补丁,25743 在披露时(2024-03)仍未完全缓解[^331^]。

**BadRAM(CVE-2024-21944,IEEE S&P 2025)** 首次从物理内存配置层击穿 RMP:改写 DIMM 的 SPD 芯片使内存容量虚报一倍,引入"幽灵地址位"制造物理地址别名,从而篡改/重放密文并操纵 RMP 本身;端到端演示重放 SEV-SNP 启动摘要(launch digest),使被篡改的 VM 镜像以不变的证明报告通过验证[^268^]。按交叉验证裁定,CVE-2024-21944 归属 BadRAM(别名/输入校验类),与 RMPocalypse 的 CVE-2025-0033 是两个独立漏洞。修复为 Intel 与 AMD 增加启动时静态别名检测;但同期 Battering RAM 以 47.62 美元物料的 DDR4 插接器在运行时动态引入别名,绕过启动检测[^336^]。

**RMPocalypse(CVE-2025-0033,AMD-SB-3020,2025-10-13 披露,ETH Zurich,发表于 ACM CCS 2025,可远程利用、无需物理访问[^358^])**:SNP 初始化窗口期内 RMP 存在竞争条件,管理员权限攻击者可以单次 8 字节写入 RMP,破坏 SEV-SNP guest内存完整性;影响 EPYC 7003/8004/9004/9005(含 Embedded),微软确认 Azure 机密计算 AMD 集群受影响并滚动修复[^261^]。固件修复已发布[^346^]。严重性评级存在第三方与厂商分歧:第三方汇总给出 8.2(High),AMD 官方公告与 NVD(CNA 为 AMD)定级 Medium(CVSS:3.1 约 6.0,需高权限本地攻击),本文采厂商口径[^346^][^359^]。

**StackWarp(CVE-2025-29943,AMD-SB-3027)** 由 CacheWarp 原班团队(CISPA)发现:Zen 1–5 的栈引擎(stack engine)微架构优化存在缺陷,HV 通过一个未公开的 MSR 控制位,在与目标 VM 并行的超线程上冻结/释放栈引擎 delta,确定性地平移 SEV-SNP guest的 `rsp`;将 `rsp` 移到旧栈帧可跳过函数尾声乃至整个函数,实现控制流劫持;演示包括从单个故障签名恢复 RSA-2048 私钥、绕过 OpenSSH 与 sudo 认证、内核态代码执行。与 CacheWarp 不同,StackWarp 不触碰缓存状态,在 CacheWarp 已修复的 Zen 5 上依然有效[^337^][^360^][^361^]。时间线统一表述为:2025 年协同披露并先行发布微码(2025-07 与 2025-10,覆盖 EPYC 7003/8004/9004/9005),2026-01 公开报道与论文(USENIX Security 2026);EPYC Embedded 8004/9004 的 AGESA 补丁计划 2026-04。AMD 定级 Low(CVSS v4 4.6,因需主机管理员权限),官方声明补丁"自去年 7 月起便已可用";缓解建议包括对高完整性 CVM 临时禁用 SMT[^362^][^363^][^364^][^365^]。

2025 年还有一批 SEV 固件 CVE 值得部署方跟踪:**CVE-2025-48514/48517**——SEV 固件访问控制粒度不足,特权攻击者可创建 SEV-ES guest攻击 SNP guest;修复固件为 Milan SEV FW 1.37.23(2025-07-03)、Genoa 1.37.31、Turin 1.37.41,**副作用是应用缓解后启用 SEV-SNP 时将禁用 SEV-ES**,OpenStack 与 KubeVirt 均已被迫适配[^334^][^366^][^367^];**CVE-2025-29934**(SNP guest带过期 TLB 项运行)、**CVE-2025-52536**(固件锁位防护不当可降级固件)等经微码批次修复[^368^];**CVE-2024-56161**(2025-02 公开,Google 发现)——AMD CPU ROM 微码补丁加载器签名验证使用不安全哈希,本地管理员可加载恶意 CPU 微码,危及 SNP 机密guest的机密性与完整性[^332^][^369^];**CVE-2025-0029**——主机诱发故障处理不当可选择性丢弃guest DMA 写[^369^]。

物理层在 2025 年 10 月出现两个标志性工作:**TEE.fail** 用成本低于 1000 美元的自制 DDR5 interposer 被动记录内存总线流量,利用确定性 AES-XTS 密文做字典攻击,即使启用 Ciphertext Hiding 仍从 SEV-SNP VM 提取 OpenSSL ECDSA/ECDH 私钥,并伪造 Intel TDX 证明通过 DCAP "UpToDate" 验证;AMD 发布公报明确不予修复——物理攻击超出现有产品威胁模型[^370^][^371^][^372^]。**Battering RAM** 则暴露了"为更大保护内存容量而省略密码学新鲜度校验"这一可扩展内存加密设计的根本局限[^336^]。

### 11.4 SVM/KVM/IOMMU 层漏洞

#### 11.4.1 契约解析层:double-fetch、IOMMU 错误路径与 AVIC erratum

与 SEV 系的"密码学/微架构"攻击不同,本节漏洞位于 hypervisor 软件栈对公开硬件数据结构的解析路径上(第 3 章背景:VMCB 布局完全公开且由软件直接读写)。**CVE-2021-29657**(2021-03,Google Project Zero)是代表性案例:`nested_svm_vmrun()` 对位于 L1 guest 内存中的 vmcb12 存在双重获取(double fetch),构成 TOCTOU 竞争与 use-after-free,AMD KVM guest可绕过宿主机 MSR 访问控制实现 guest→host 逃逸;CVSS 3.1 7.4(High),修复于 Linux 5.10.28/5.11.12(commit `a58d9166a756`)[^323^][^17^][^13^]。其结构性根源在于:L0 必须对攻击者可控内存中的 VMCB12 做"拷贝-校验-使用",校验与使用之间的一致性窗口无法由硬件消除——上游内核直到 2026 年仍在合并 nSVM 加固修复(如 7.2 合并窗口的 VMRUN 仿真副作用修复)[^373^]。

IOMMU 侧漏洞均指向"RMP 由 CPU 与 IOMMU table walker 共同检查"这一耦合面的错误处理路径:**CVE-2021-26312**——IOMMU TLB 未刷新,IO 设备可写入本无权访问的内存[^327^];**CVE-2023-20584**——IOMMU 处理指向特殊地址范围的 DTE(设备表项)故障时,错误处理路径未正确执行 RMP 校验,已被攻陷的 HV 可构造恶意 DTE 绕过 SEV-SNP 完整性保证[^330^];**CVE-2024-21953**——IOMMU 输入验证不当,恶意 HV 可重配置 IOMMU 寄存器导致guest内存完整性损失[^374^]。更上游的结构根因是 SEV 的 IOMMU 只支持以 HV 的 VEK 做 DMA,迫使 SWIOTLB 反弹缓冲设计,这正是 11.1 节 I/O 预言机攻击的成因[^375^];Google P0 审计亦独立发现 "IOMMU TLB not flushed on SNP-INIT"[^328^]。

**AVIC erratum #1235(CVE-2026-64172)** 是中断虚拟化层的代表性硬件勘误:Zen 1/Zen 2(Family 17h)及衍生自 Zen 1 的 Hygon Family 18h 上,ICR 写模拟期间硬件可能读到陈旧的 `IsRunning=1`,从而不发出 `AVIC_IPI_FAILURE_TARGET_NOT_RUNNING` 退出,导致 KVM 漏掉对阻塞目标 vCPU 的唤醒、vCPU 挂起;上游 workaround 是禁用 IPI 虚拟化(不在 Physical ID 表设 IsRunning,所有非 self-IPI 走退出模拟)[^23^][^121^]。该 erratum 使 KVM 上游将 AVIC 默认关闭约八年,直到 2025-06 AMD 的 RFC 以"AVIC 自 Zen 4 起功能完整"为由提议 Zen 4+ 默认启用,旧 CPU 需 `force_avic=1`[^23^]。它与 11.3 节 Ahoi 家族共同说明:中断/异常路径横跨 CPU、IOMMU 与 guest/hypervisor 三方状态,是 AMD"显式软件契约"设计下 TOCTOU 与语义注入最密集的子系统。

### 11.5 攻防平衡

#### 11.5.1 AMD 五级响应工具箱与攻击面迁移规律

对 30 项样本的修复路径做归纳,AMD 的响应呈现稳定的五级工具箱(表 11-2),实质是一套"按缺陷所在抽象层选择最便宜修复层"的分层消化策略。

**表 11-2 AMD 漏洞响应工具箱(按抽象层归纳)**

| 层级 | 手段 | 代表实例 |
|---|---|---|
| 1. CPU 微码 | 微码更新(经 OS/BIOS 分发) | CacheWarp(仅 Milan)[^355^];StackWarp(2025-07/10)[^363^];CVE-2024-56161[^332^] |
| 2. SEV 固件(PSP) | 固件更新,TCB 版本可经证明报告远程验证 | CVE-2025-48514/48517(FW 1.37.23/31/41)[^334^];CVE-2019-9836[^319^];RMPocalypse(AMD-SB-3020)[^346^];Google P0 审计批次[^328^] |
| 3. 固件 ABI 修订 | 新增guest策略/交互模式 | CipherLeaks → VMSA 寄存器保护(AMD-SB-1013)[^346^];Relocate-Vote → ABI 1.58 `PAGE_SWAP_DISABLE`[^335^];WeSee/Heckler → Restricted/Alternate Injection[^245^] |
| 4. 新硬件特性 | 新一代 CPU 消化根因 | SEV-SNP 的 RMP(消化 SEVered/SEVurity 类);Zen 5 Ciphertext Hiding[^12^] |
| 5. 不予修复声明 | 威胁模型排除/代际放弃 | Naples/Rome 的 CacheWarp[^356^];SEVerity/undeSErVed 要求迁移 SNP[^344^];物理攻击(One Glitch、TEE.fail/Battering RAM)[^372^] |

两点补充观察:其一,修复可能自带破坏性副作用——CVE-2025-48514 的固件修复使 SNP 启用时 SEV-ES 被禁用[^334^],StackWarp 的彻底缓解可能需要禁用 SMT[^376^],"修复即 Breaking Change"要求编排系统跟踪固件行为变化;其二,工具箱的存在使"安全性"从一次性硬件属性变为持续固件治理服务,采购与合规评估的有效锚点因此从硬件型号转移到证明报告的 TCB 版本——开源生态已将其产品化,如 Confidential Containers 要求主机 SEV 固件 ≥ 1.55 且证明报告 v3+[^307^]。

在攻击侧,六年 20 余个独立样本支撑一条可复用的迁移规律:**防御每形式化排除一类信任假设,攻击就沿最小阻力方向——尚未被排除的假设——向更低或更物理的抽象层迁移**。路径为:内存(SEVered/SEVurity 的 nPT 重映射)→ 寄存器(VMCB 明文,SEV-ES 收敛)→ 页表/证明(undeSErVed、CrossLine,SNP 收敛)→ 微架构(CacheWarp 的缓存、StackWarp 的栈引擎——RMP 只保护内存,不保护缓存一致性与流水线状态)→ 中断/异常语义(WeSee 的 #VC、Heckler 的 `int 0x80`——SNP 宣称防中断注入,但 handler 的软件实现重新引入了语义信任)→ 物理层(BadRAM/TEE.fail/Battering RAM)。AMD 自认的威胁模型排除项与实证残余面高度吻合:可用性、高级物理攻击、特定侧信道(含 PRIME+PROBE 与页错误侧信道)在 LSSNA 2021 的官方表述中即被明确排除[^259^];其中侧信道排除项此后被 CounterSEVeillance(228 个 PMC 事件)持续实证[^333^]。

对部署者的实操含义可归纳为四条:以 SNP 证明报告的 TCB 版本为信任锚而非 CPU 型号(同一型号在不同固件下安全性不同,CacheWarp 在 Milan 可修、在 Rome 不可修);跟踪 AGESA/SEV FW 基线并将 CVE-2025-48514 的 SEV-ES 禁用副作用纳入编排适配;高价值 CVM 评估禁用 SMT;Naples/Rome 存量按"无法达到 SNP 基线"处理并规划硬件轮换。

本章的局限需如实说明:样本以公开学术攻击与 CVE 为限,未公开披露或云厂商内部发现的事件不在统计内,实际漏洞密度应高于表 11-1;CVSS 评分统一采厂商口径,可能系统性低估论文演示的实际破坏力;物理攻击(One Glitch、TEE.fail)的设备成本数据来自论文自报,缺少独立复现测量。
