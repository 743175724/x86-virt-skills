# 03 AMD 客户端世代矩阵：Zen 1 → Zen 5（研究稿）

Ticket: `.scratch/virt-skills-v2/issues/03-amd-gen-matrix.md`
As of: **2026-09-26**
格式与 `02-intel-gen-matrix.md` 对齐：**世代 × 维度矩阵 + 逐条来源 + 缺口清单**。

**与 Intel 侧的节对照表**（便于并排阅读；左为本文，右为 `02-intel-gen-matrix.md`）：

| 本文（AMD） | Intel 侧对应 | 备注 |
|---|---|---|
| §0 八条结论 | `## TL;DR` | |
| §0.5 实机测量记录 | `## 9. 本次 session 的执行环境声明` | **两侧都有真机**：Intel 侧 Core Ultra 7 265KF，AMD 侧本机 9950X3D |
| §1 family/model/stepping | `## 1. 矩阵 A：CPUID DisplayFamily_DisplayModel` | Intel 用 `DisplayFamily_DisplayModel`，AMD 用 `famXXh_modelXXh` |
| §3.1 的 `Fn8000_000A_EDX` 矩阵 | `## 2. 矩阵 B：虚拟化相关特性的世代引入点` | AMD 的等价物是单张 SVM 能力叶；Intel 是 `IA32_VMX_*` MSR 族 |
| §2 客户端混合核心 | `## 3. 混合拓扑（维度 2）` | **核心对照点**，见下 |
| —（AMD 客户端普遍保留 SMT） | `## 4. 超线程取消（维度 3）` | AMD 侧无对应：实测的 Zen 5 客户端件仍全部 SMT2 |
| §5 AGESA / 微码 | `## 5. 微码作为行为变量（维度 4）` | |
| §6 勘误通道复核 | `## 8. 勘误通道（维度 5）` | |
| §4 安全勘误按型号映射 | （Intel 侧并入第 5/8 节） | |
| §7 缺口清单 | `## 7. 缺口清单（Gaps）` | |
| §8 来源 | `## 10. 来源清单` | |
| —（IOMMU 未纳入本 ticket） | `## 6. VT-d / IOMMU 平台侧（维度 6）` | AMD IOMMU 侧不在 03 的范围内 |

---

## 元信息：证据分级与方法

本文的证据分三层，每条 claim 都标注了它属于哪一层。这个分级本身是交付物的一部分——
上游 ticket 要求"负面声明需与正面声明同等证据"，而本次调查里**最强的几条结论来自实测**，
不是来自文档推断。

| 级别 | 含义 | 本文用法 |
|---|---|---|
| `M:local` | **本机实测**。在一台 AMD Ryzen 9 9950X3D 上执行 CPUID / 读注册表得到 | 最高权重。可复现，脚本见 §5.4 |
| `M:dump` | **真机 CPUID dump**。InstLatx64 公开的逐逻辑 CPU CPUID/MSR 转储 | 用于跨机型、跨世代横向比较；是硬件的自述，不是二手表格 |
| `D:amd` | **AMD 第一方文档**。docs.amd.com / amd.com 上的 PPR、Revision Guide、Security Bulletin、白皮书 | 用于给实测值提供 field 定义与语义 |
| `D:kernel` | **Linux mainline 源码**（v7.3-rc4/rc5，`git.kernel.org` 原始文件） | 用于 family/model → 微架构世代的权威映射 |
| `GAP` | 查不到，明确声明 | §7 |

> **本次调查的执行机器恰好就是被研究对象。** 承接本 ticket 的 agent 运行在一台
> **AMD Ryzen 9 9950X3D**（`AMD64 Family 26 Model 68 Stepping 0` = `fam1Ah_model44h`，
> Granite Ridge，Zen 5 客户端桌面）上。这不是巧合可以浪费的——本文若干关键结论是在这台机器上
> 直接测出来的，而不是从文档里推出来的。`map.md` 记录的"用户手上有真机 Intel 265KF"应当补一条：
> **agent 侧还有一台 Zen 5 客户端桌面机可用于实测**。 `M:local`

---

## §0 八条结论（先看这里）

1. **技能里那条反复出现的声明是错的，而且错得很彻底。**
   `SKILL.md:165-167` 等六处断言 *"client Ryzen has no public revision guide and no public PPR"*。
   **客户端 PPR 确实存在、公开、可下载、且每页盖着 `[AMD Public Use]`。** 本次实际下载并解压了
   `57930-A0-PUB_3.00.pdf`（PPR for AMD Family 1Ah Model 70h = Strix Halo / Ryzen AI Max 300，
   1017 页，Rev 3.00，2025-04-30）。另有四份客户端 PPR 经第一方 URL 确认。详见 §6。
   → **这条边界被打破，"按型号查"这条路的可行性大幅提升。**

2. **AMD 客户端的混合核心是调度问题，不是正确性问题——而且这条现在有实测证据。**
   在 Ryzen AI 9 HX 370（`fam1Ah_model24h`，4× Zen 5 + 8× Zen 5c）上逐逻辑 CPU 比对 CPUID：
   `Fn8000_000A`（SVM 能力叶）在全部 24 个逻辑 CPU 上**逐位相同**；差异只出现在
   `Fn8000_001D`（L3 大小/共享数）、`Fn8000_0026`（core type / 每级逻辑处理器数）、
   `Fn8000_001E`（身份字段）。详见 §2。

3. **但"AMD 不像 Intel 那样不均匀"这个说法也是错的。** 客户端 AMD 的 cache 拓扑逐核不同有
   **两个独立成因**：hybrid CCX（Strix Point）和 **X3D 单边堆叠**（9950X3D 上 CPU 0–15 报 96 MB L3、
   CPU 16–31 报 32 MB L3，全是 Zen 5 核，`Fn8000_0026` 完全不标记任何异构位）。详见 §2.4。

4. **AVIC 在客户端不能按世代查表。** 实测发现**同一 family/model/stepping、不同机器，
   `Fn8000_000A_EDX[13] AVIC` 取值相反**：`fam1Ah_model44h` 的四份 dump 里三份 AVIC=0、
   一份 AVIC=1，本机（微码更高）AVIC=1。AMD 自己的 PPR 给出了文档级解释：
   在 `Fn8000_000A_EDX` 那张表里，**只有 bit 13 (AVIC) 和 bit 18 (x2AVIC) 写的是 `Reset: 1`，
   其余每一位都写 `Reset: Fixed,1`**，而 PPR 的 Table 9 定义 `Fixed` = "The read value that applies
   at all times"。详见 §3。

5. **客户端勘误通道存在且是编号独立的。** `AMD-SB-4xxx` 是 AMD 的 **Client** 公告序列
   （4001/4002/4004/4008/4012/4013/4017，2022-05 至 2026-05），与 `AMD-SB-3xxx` 的 Server/EPYC 序列并列。
   更关键的是 **AMD-SB-4013 的脚注逐字写着**
   *"Refer to Errata #1165, #1166 and #1526 on the corresponding **Client Revision Guide** of the product"*
   ——AMD 自己承认存在"Client Revision Guide"这一文档类别。详见 §6。

6. **微码会改变客户端上 CPUID 可见的虚拟化能力。** 这不是推断：`fam1Ah_model44h` 上
   AVIC/x2AVIC 两位的有无与 `MSR 0000_008B` patch level 单调相关（0x0B40400C / 0x0B40401A /
   0x0B404022 → 0；0x0B404023 → 1；本机 0x0B404035 → 1）。详见 §3.2 与 §5。
   本机另有第二个实例：微码 `0x0B404035` **恰好等于**内核 `zen5_rdseed_microcode[]` 对该型号要求的
   最低值，低一档 RDSEED 就会被连同 CPUID 位一起抹掉（§4.5）。

7. **AMD 确实为客户端部件发过带编号的虚拟化勘误，而且措辞极其强硬。**
   Revision Guide 55449 Rev 1.21 p.87 的 **erratum 1235**（AVIC guest 可能漏处理 IPI）
   适用 package 含 **AM4**，其 **Suggested Workaround 逐字是 "None. Do not enable AVIC."**，
   Fix Planned 是 "No fix planned"。**这是 AVIC 默认关了十年的最强单一理由**，也是对
   "客户端勘误无法引用"这一说法的直接反例。详见 §3.4。

8. **有一条影响 Zen 4 客户端的严重虚拟化缺陷，AMD 从未给它编号。**
   `fam19h` models `18h–1Fh` 与 `60h–7Fh`（Storm Peak / Raphael / Dragon Range / Phoenix /
   Phoenix 2 / Hawk Point）会**advertise 但不应使用** virtualized VMLOAD/VMSAVE，使用会导致
   **随机 host 重启**。全部公开记录只有一条内核 commit（`a5ca1dc46a6b`，作者是 AMD 员工）
   加一个 kernel bugzilla 条目。**`fam1Ah`（Zen 5）不受影响，本机实测 bit 15 = 1 且内核不清它。**
   裸机 thin hypervisor 不会自动获得这个缓解。详见 §4.4。

---

## §0.5 实机测量记录（`M:local`）——与文档性结论分开存放

> **被测机器**：AMD Ryzen 9 9950X3D · 16C/32T · `AuthenticAMD` ·
> `AMD64 Family 26 Model 68 Stepping 0` = **`fam1Ah_model44h` stepping 0**（Granite Ridge，Zen 5 桌面）
> **CPUID signature** `Fn0000_0001_EAX = 0x00B40F40`
> **运行微码** `MSR 0000_008B = 0x0B404035`
> **BIOS** AMI `F12a`，ReleaseDate 2026-03-11 · **OS** Windows 11 Pro 26200
> **测量日期 2026-09-26** · 方法：PowerShell + 内联 x64 CPUID stub（§5.4），逐核用
> `ProcessorAffinity` 绑定

**原始读数（未绑核，任意核）：**
```
Fn0000_0001 : EAX=00B40F40 EBX=11200800 ECX=7ED8320B EDX=178BFBFF
Fn8000_0001 : EAX=00B40F40 EBX=00000000 ECX=75C237FF EDX=2FD3FBFF   -> ECX[2] SVM = 1
Fn8000_000A : EAX=00000001 EBX=00008000 ECX=00000000 EDX=FEBFBDFF
              SvmRev=1 · NASID=0x8000=32768 ASID
Fn8000_001F : EAX=00000001 EBX=000000B3 ECX=00000000 EDX=00000000
              -> SME=1, SEV=0, NumEncryptedGuests=0, CbitPos=51, PhysAddrReduction=2
Fn8000_0008 : EAX=00003030 EBX=791EF257 ECX=0000501F EDX=00010000
Fn8000_0021 : EAX=593FFFCF EBX=00080382 ECX=00000000 EDX=00000000
Fn0000_0007.0: EAX=00000001 EBX=F1BF97AB ECX=19405FCE EDX=10000110  -> EBX[18] RDSEED = 1
Fn8000_0000 : EAX=80000028  (max extended leaf)
```

`Fn8000_000A_EDX = 0xFEBFBDFF` 逐位：`NP`(0)=1 `LbrVirt`(1)=1 `SVML`(2)=1 `NRIPS`(3)=1
`TscRateMsr`(4)=1 `VmcbClean`(5)=1 `FlushByAsid`(6)=1 `DecodeAssists`(7)=1 **`PmcVirt`(8)=1**
`PauseFilter`(10)=1 *bit11=1（文档标 Reserved）* `PauseFilterThreshold`(12)=1 **`AVIC`(13)=1**
`VMSAVEvirt`(15)=1 `VGIF`(16)=1 `GMET`(17)=1 **`x2AVIC`(18)=1** `SSSCheck`(19)=1 `SpecCtrl`(20)=1
`ROGPT`(21)=1 `HOST_MCE_OVERRIDE`(23)=1 **`TlbiCtl`(24)=0** `VNMI`(25)=1 `IbsVirt`(26)=1
`ExtLvtAvicAccessChg`(27)=1 `NestedVirtVmcbAddrChk`(28)=1 `BusLockThreshold`(29)=1
`IdleHltIntercept`(30)=1 *bit31=1（APM 3.38 标 Reserved；PPR 57930 命名为 `EnhancedShutdownIntercept`）*

**逐核绑定读数（`Fn8000_001D` 子叶 3 = L3）：**
```
CPU  0 : 8000001D.3 EAX=0003C163 ECX=00017FFF -> L3 96 MB, 16 LP 共享 | 8000001E EAX=00000000 EBX=00000100 | 80000026.0 EAX=00000001 EBX=00000002 CoreType=0 | 8000000A EDX=FEBFBDFF
CPU  1 : 同上（96 MB）
CPU 16 : 8000001D.3 EAX=0003C163 ECX=00007FFF -> L3 32 MB, 16 LP 共享 | 8000001E EAX=00000010 EBX=00000108 | 80000026.0 EAX=00000001 EBX=00000002 CoreType=0 | 8000000A EDX=FEBFBDFF
CPU 17 : 同上（32 MB）
CPU 30 : 同上（32 MB）
```

**从这台机器上直接确立的五条：**

| # | 结论 | 详见 |
|---|---|---|
| 1 | **非混合部件也存在 cache 拓扑不对称。** 同一封装内 `Fn8000_001D` 随执行核返回 96 MB 或 32 MB，而 `Fn8000_0026` 的 `AsymmetricCores`/`HeterogeneousCoreTopology`/`CoreType` **全为 0**，完全不标记这件事。**AMD 的 cache 不对称不需要 hybrid SKU。** | §2.4 |
| 2 | **`Fn8000_000A` 在两个 CCD 上逐位相同**（`FEBFBDFF`）——SVM 能力面是均匀的，不均匀的只有 cache。 | §2.4 |
| 3 | **本机 AVIC=1、x2AVIC=1**，而三份同 `fam1Ah_model44h` st0、微码更低的公开 dump 报 AVIC=0、x2AVIC=0。**AVIC 在客户端不是世代常量。** | §3.2 |
| 4 | **Zen 5 客户端只有 SME，没有 SEV**（`Fn8000_001F_EAX=1`、`ECX=0`）——确认语料库 `90-dated-landscape.md:82-84`。 | §1 / §8 |
| 5 | **微码正好卡在内核 RDSEED 门槛上**（`0x0B404035` = `zen5_rdseed_microcode[]` 对该型号要求的最低值），RDSEED 位因此保留。 | §4.5 |

**这台机器不能回答什么（必须写明）：** `GAP`
Granite Ridge 是**纯 Zen 5、没有 Zen 5c**。因此 **§2 里关于 Zen 5 vs Zen 5c 的全部结论
都是文档 + 公开 dump 得出的，未在本机验证**；要在金属上验证需要一颗 Strix Point / Krackan Point
（Ryzen AI 300/400）部件。本机也**没有做任何 VMRUN/VMCB 级别的测量**。

---

## §1 family / model / stepping 编码

### 1.1 主表——沿用现有 EPYC 表的键格式

键格式与 `amd-virtualization/references/90-dated-landscape.md:46-57` 的现有表一致
（`famXXh_modelXXh`，源自 AMD 自己的固件包文件名）。
**"CPUID signature" 列是 `Fn0000_0001_EAX` 的实测原值**，可直接与任意 CPUID 工具对照；
**"品牌串"列是这颗 CPU 自己在 `Fn8000_0002..0004` 里报的名字**——不是从新闻稿抄来的型号表。 `M:dump`

| Zen 世代 | 代号 | famXXh_modelXXh | CPUID sig | stepping | 实测到的品牌串（该 CPU 自述） |
|---|---|---|---|---|---|
| Zen 1 | Summit Ridge / Whitehaven | `fam17h_model01h` | `00800F11` | 1 | AMD Ryzen 7 1800X Eight-Core Pro… |
| Zen 1 | Raven Ridge | `fam17h_model11h` | `00810F10` | 0 | AMD Ryzen 5 2500U with Radeon Ve… |
| Zen 1 | Dali / Pollock | `fam17h_model20h` | `00820F01` | 1 | AMD 3020e with Radeon Graphics |
| Zen 1 | （半定制，Subor/Fenghuang） | `fam17h_model50h` | `00850F00` | 0 | DG02SRTBP4MFA |
| Zen+ | Pinnacle Ridge / Colfax | `fam17h_model08h` | `00800F82` | 2 | AMD Ryzen 5 2600X Six-Core Proce… |
| Zen+ | Picasso | `fam17h_model18h` | `00810F81` | 1 | AMD Ryzen 5 3550H with Radeon Ve… |
| Zen 2 | Castle Peak（TR 3000 / PRO 3000WX） | `fam17h_model31h` | `00830F10` | 0 | AMD Ryzen Threadripper 3970X 32-… |
| Zen 2 | Cyan Skillfish（4700S 桌面套件） | `fam17h_model47h` | `00840F70` | 0 | AMD 4700S 8-Core Processor Deskt… |
| Zen 2 | Renoir | `fam17h_model60h` | `00860F01` | 1 | AMD Ryzen 7 4800H with Radeon Gr… |
| Zen 2 | Lucienne | `fam17h_model68h` | `00860F81` | 1 | AMD Ryzen 5 5500U with Radeon Gr… |
| Zen 2 | Matisse | `fam17h_model71h` | `00870F10` | 0 | AMD Ryzen 5 3600X / 3600 / 3100 / PRO 3900 |
| Zen 2 | （4800S 桌面套件） | `fam17h_model84h` | `00880F40` | 0 | AMD 4800S 8-Core Processor Deskt… |
| Zen 2 | Van Gogh | `fam17h_model90h` | `00890F02` | 2 | AMD Custom APU 0405 |
| Zen 2 | Mendocino | `fam17h_modelA0h` | `008A0F00` | 0 | AMD Ryzen 3 7320U with Radeon Gr… |
| Zen 4 | Storm Peak（TR 7000 / PRO 7000WX） | `fam19h_model18h` | `00A10F81` | 1 | AMD Ryzen Threadripper PRO 7995W… |
| Zen 3 | Vermeer（B0） | `fam19h_model21h` | `00A20F10` | 0 | AMD Ryzen 9 5950X / 5900X |
| Zen 3 | Vermeer（B2，含 X3D） | `fam19h_model21h` | `00A20F12` | 2 | AMD Ryzen 7 5800X / 5700X3D / 5600X3D |
| Zen 3+ | Rembrandt / Rembrandt-R | `fam19h_model44h` | `00A40F41` | 1 | AMD Ryzen 7 7735HS with Radeon G… |
| Zen 3 | Cezanne / Barcelo | `fam19h_model50h` | `00A50F00` | 0 | AMD Ryzen 7 5800HS Creator Editi… |
| Zen 4 | Raphael / Dragon Range | `fam19h_model61h` | `00A60F12` | 2 | AMD Ryzen 9 7950X / 7950X3D / 7800X3D；亦见 EPYC 4124P |
| Zen 4 | Phoenix | `fam19h_model74h` | `00A70F41` | 1 | AMD Ryzen 9 7940H w/ Radeon 780M |
| Zen 4 | Phoenix / Hawk Point | `fam19h_model75h` | `00A70F52` | 2 | AMD Ryzen 7 8845HS / 8700G |
| Zen 4 + **Zen 4c** | **Phoenix 2**（首个客户端混合） | `fam19h_model78h` | `00A70F80` | 0 | AMD Ryzen Z1 |
| Zen 4 | Hawk Point 2 | `fam19h_model7Ch` | `00A70FC0` | 0 | AMD Ryzen 5 PRO 215 w/ Radeon 74… |
| Zen 5 | Shimada Peak（TR 9000 / PRO 9000WX） | `fam1Ah_model08h` | `00B00F81` | 1 | AMD Ryzen Threadripper PRO 9985W… |
| Zen 5 + **Zen 5c** | **Strix Point**（Ryzen AI 300）**及 Gorgon Point**（Ryzen AI 400） | `fam1Ah_model24h` | `00B20F40` | 0 | AMD Ryzen AI 9 HX 370 / AI 7 PRO 360 / **AI 9 465** |
| Zen 5 | Granite Ridge / Fire Range | `fam1Ah_model44h` | `00B40F40` | 0 | AMD Ryzen 9 9950X / 9950X3D / 9800X3D / 9700X |
| Zen 5 + Zen 5c | Krackan Point | `fam1Ah_model60h` | `00B60F00` | 0 | AMD Ryzen AI 7 PRO 350 w/ Radeon… |
| Zen 5 | Gorgon Point（低阶） | `fam1Ah_model68h` | `00B60F80` | 0 | AMD Ryzen AI 5 430 w/ Radeon 840… |
| Zen 5 | Strix Halo | `fam1Ah_model70h` | `00B70F00` | 0 | AMD RYZEN AI MAX+ 395 w/ Radeon… |

**两条对本 ticket 特别重要的读法：**

- **Ryzen AI 400 系列不是新 model。** `fam1Ah_model24h` 同时覆盖 Strix Point（Ryzen AI 300）与
  Gorgon Point（Ryzen AI 400，如 "AMD Ryzen AI 9 465"）；`fam1Ah_model68h` 也报 Gorgon Point
  （"AMD Ryzen AI 5 430"）。**按 family/model 查会把 300 系与 400 系混在一起**，这是"按型号查"
  路线必须显式处理的一个塌陷。 `M:dump`
- **同一 model 跨客户端/服务器。** `fam19h_model61h` 的 dump 里既有 Ryzen 9 7950X3D 也有
  **EPYC 4124P**——EPYC 4004 就是 AM5 Raphael。family/model 不能单独用来判断"这是客户端还是服务器"。 `M:dump`

> **不在本表范围（仅为对照）**：`fam19h_model01h` Milan、`fam19h_model11h` Genoa、
> `fam19h_modelA0h` Bergamo、`fam1Ah_model02h` Turin、`fam1Ah_model11h` Turin Dense。
> 这些是现有 EPYC 表已覆盖的行。

### 1.2 Zen 世代归属：内核里的权威映射

AMD 的产品页从不说 "Zen N"（现有表已记录这一点）。**唯一逐 family/model 精确给出世代归属的
第一方级来源是 Linux mainline 的 `early_init_amd()`**，它是一个平铺 switch，不是 `x86_cpu_id` 表：
`arch/x86/kernel/cpu/amd.c:478-531`（v7.3-rc4）。 `D:kernel`

| family | model 范围 | 内核设置的合成 flag |
|---|---|---|
| `0x17` | `0x00…0x2f`, `0x50…0x5f` | `X86_FEATURE_ZEN1` |
| `0x17` | `0x30…0x4f`, `0x60…0x7f`, `0x90…0x91`, `0xa0…0xaf` | `X86_FEATURE_ZEN2` |
| `0x19` | `0x00…0x0f`, `0x20…0x5f` | `X86_FEATURE_ZEN3` |
| `0x19` | `0x10…0x1f`, `0x60…0xaf` | `X86_FEATURE_ZEN4` |
| `0x1a` | `0x00…0x2f`, `0x40…0x4f`, `0x60…0x7f`, `0xd0…0xd7` | `X86_FEATURE_ZEN5` |
| `0x1a` | `0x50…0x5f`, `0x80…0xaf`, `0xc0…0xcf`, `0xd8…0xef` | **`X86_FEATURE_ZEN6`**（已在 mainline） |

**三个必须知道的坑：**
- 内核**不区分 Zen+ 和 Zen 1**（`fam17h_model08h/18h` 都归 `ZEN1`），也**不区分 Zen 3+ 和 Zen 3**
  （`fam19h_model44h` Rembrandt 落在 `0x20…0x5f`，归 `ZEN3`）。营销上的 "Zen+/Zen 3+" 在内核里不存在。
- 这些 flag 分散在三个不同的 feature word：`ZEN5/ZEN6` 在 word 3，`ZEN` 在 word 7，
  `ZEN1/2/3/4` 在 word 11（`cpufeatures.h:77,78,221,316-319`）。grep 一个 word 会漏。
- **内核里几乎没有营销代号。** 全树搜索 `Raphael|Vermeer|Matisse|Granite Ridge` **零命中**。
  唯一成表的 family/model↔代号绑定在 `drivers/hwmon/k10temp.c:478-534`，且只覆盖
  `F17h M0x47 = Cyan Skillfish`、`M0x60 = Renoir`、`M0x68 = Lucienne`、`F19h M0x08 = Chagall`、
  `M0x50-5F = Green Sardine`、`M0x40-4F = Yellow Carp`、`F1Ah M0x00-1F = Turin`、
  `M0x40-4F = Zen5 Ryzen Desktop`。**本文 §1.1 的代号列因此主要靠 CPUID 品牌串 + InstLatx64
  dump 文件名，而不是内核。** `D:kernel`

### 1.3 微码 patch level 的编码规律（观察所得，非文档）

`linux-firmware` 的 `amd-ucode/README` 列出 AMD 自己打包的每个容器里的
`Family=0x.. Model=0x.. Stepping=0x..: Patch=0x........`，是逐 family/model/stepping 的第一方清单。
把它与实测值放在一起，patch level 呈现一个稳定规律： `D:amd` + `M:local`

```
patch = 0x0 <family-0x0F : 2 nibbles> <model : 2 nibbles> <stepping : 1> <revision : 2>
```

验证：`fam1Ah_model44h st0` → `0x0B 40 4 0 35` = `0x0B404035`（本机实测值，且与 linux-firmware 所列一致）；
`fam19h_model21h st2` → `0x0A 20 1 2 11` = `0x0A201211`；`fam17h_model71h st0` → `0x08 70 1 0 34`。

> **这是本文从数据里归纳出的规律，AMD 没有在任何找到的文档里定义 patch level 的位域。**
> PPR 57930 对 `MSR0000_008B` 的全部描述只有一句：
> *"This returns an identification number for the microcode patch that has been loaded.
> If no patch has been loaded, this returns 0."*（p.124）。规律好用，但**不要当成规范**。 `GAP`

`linux-firmware` 当前为 family 1Ah 打包的条目（全部 Zen 5，客户端+服务器混在一个容器里）：
model `02h`/st1 → `0x0B00217B`；`08h`/st1 → `0x0B008121`；`11h`/st0 → `0x0B101068`；
**`24h`/st0 → `0x0B204037`**；**`44h`/st0 → `0x0B404035`**；`44h`/st1 → `0x0B404108`；
**`60h`/st0 → `0x0B600037`**；**`68h`/st0 → `0x0B608038`**；**`70h`/st0 → `0x0B700037`**。 `D:amd`

---

## §2 客户端混合核心

### 2.1 实测：Zen 5 核 vs Zen 5c 核，逐位 diff

样本：InstLatx64 `AuthenticAMD0B20F40_K20_StrixPoint_06_CPUID.txt`，
**AMD Ryzen AI 9 HX 370**（`fam1Ah_model24h` st0），4× Zen 5 + 8× Zen 5c，24 个逻辑 CPU，
转储工具逐 CPU 标注 `AMD P-Core` / `AMD E-Core`。
把 CPU #0（P-Core）与 CPU #8（E-Core）的 80 条 CPUID 行完整 diff，**只有以下 4 组有差异**： `M:dump`

```
CPUID 00000001:  00B20F40-00180800-...    vs  00B20F40-10180800-...
                 └ 仅 EBX[31:24] InitialApicId 0x00 vs 0x10；EAX/ECX/EDX 全同

CPUID 0000000B:  ...-00000000 [SL00/01]   vs  ...-00000010 [SL00/01]
                 └ 仅 EDX = x2APIC ID

CPUID 80000006:  ...-00809140 [L3 16384 KB] vs ...-00409140 [L3 8192 KB]
CPUID 8000001D:  0001C163-03C0003F-00003FFF-00000001 [SL03, L3 16 MB]
             vs  0003C163-03C0003F-00001FFF-00000001 [SL03, L3  8 MB]
                 └ NumSharingCache 8 LP vs 16 LP；NumSets 16384 vs 8192

CPUID 8000001E:  EAX=00000000 EBX=00000100  vs  EAX=00000010 EBX=00000108
                 └ 仅 ExtendedApicId 与 CoreId；ThreadsPerCore 两边都是 2

CPUID 80000026:  SL00 60000001-00000002-00000100-00000000 [P-Core]
             vs  SL00 60000001-10000002-00000100-00000010 [E-Core]
                 SL01 C0000004-00000008-...  vs  C0000004-00000010-...
                 └ EBX[31:28] CoreType 0 vs 1；SL01 的 LogProcThisLevel 8 vs 16
```

**没有差异的（逐位相同，24 个逻辑 CPU 全同）：**

| 叶子 | 实测值（全 24 LP 一致） |
|---|---|
| **`Fn8000_000A`（SVM 能力叶）** | **`EAX=00000001 EBX=00008000 ECX=00000000 EDX=FEBFBDFF`** |
| `Fn8000_0001` | `00B20F40-10000000-75C237FF-2FD3FBFF` |
| `Fn8000_001F`（SME/SEV） | `00000001-000000B3-00000000-00000000` |
| `Fn8000_0008` | `00003030-791EF257-00005017-00010000` |
| `Fn0000_0007` SL00 | `00000001-F1BF97AB-19405FCE-10000110` |
| `Fn8000_0021` | `593F6FCF-00080382-00000000-00000000` |

`EBX = 0x00008000` → **两种核都报 32768 个 ASID**。`EDX = 0xFEBFBDFF` 解码后 NP / VmcbClean /
FlushByAsid / DecodeAssists / PmcVirt / AVIC / x2AVIC / VGIF / GMET / VNMI / NestedVirtVmcbAddrChk /
BusLockThreshold / IdleHltIntercept 等全部置位，**两种核完全一致**。

MSR 侧同样检查了（`..._07_CPUID.txt` 带 MSR 段）：P-core 与 E-core 的 MSR 块差异只有
`MPERF/APERF`（0xE7/0xE8）、`P-state/电压`（0xC0010293）、能量计数器（0xC001029A/B）；
**`MSR 0000_008B`（microcode patch level）和 `MSR C001_1023` 两边相同**——两种核跑同一份微码。 `M:dump`

### 2.2 AMD 自己怎么定义这些字段（PPR 57930）

以上实测值的语义不需要猜，AMD 的客户端 PPR 逐位写明了。
来源：**PPR for AMD Family 1Ah Model 70h, Revision A0**，Pub #57930，Rev 3.00，2025-04-30，
每页页脚 `[AMD Public Use]`，本次已实际下载解压（4,289,830 bytes zip → 1017 页 PDF）。 `D:amd`

**`CPUID_Fn80000026_EAX_x0[0...3] [Extended CPU Topology]`（p.121）逐字：**
> 31 `AsymmetricCores`. … When set, not all cores in the system report the same value in
> `ExtCpuTopologyEbx[LogProcThisLevel]` for `ExtCpuTopologyEcx[LevelType]=0x1`.
> 30 `HeterogeneousCoreTopology`. … When set, not all instances at the current hierarchy level have
> the same Core Type topology. The core type is reported in `ExtCpuTopologyEbx[CoreType]`.
> 29 `EfficiencyRankingAvailable`. … 28:5 Reserved. 4:0 `CoreMaskWidth`.

**`CPUID_Fn80000026_EBX_x0[0...3]`（p.122）逐字：**
> 31:28 `CoreType`. … "Defines per-core architectural feature differentiation (microarchitectural
> resources, etc.) that may lead to a different performance, core clock boost, and power characteristic.
> Only valid while LevelType=Core." ValidValues: `0h` Performance Core, `1h` Efficiency Core, `Fh-2h` Reserved.
> 27:24 `NativeModelId`. … ValidValues: **`0h` Zen5 Core**, `Fh-1h` Reserved.
> 23:16 `ProcessorPowerEfficiencyRanking`. 15:0 `LogProcThisLevel`.

**`CPUID_Fn80000026_ECX_x0[0...3]`（p.122）：** `15:8 LevelType` = `01h` Core / `02h` **Complex** /
`03h` **CCD (Die)** / `04h` Socket。

据此把 §2.1 的实测值翻译回来： `M:dump` + `D:amd`
- Strix Point 的 `EAX_x00 = 0x60000001` → **`HeterogeneousCoreTopology=1`、`EfficiencyRankingAvailable=1`、
  `AsymmetricCores=0`**（Core 级：两种核都是 2 线程，所以不"非对称"，但"异构"）。
- `EAX_x01 = 0xC0000004` → **Complex 级 `AsymmetricCores=1` 且 `HeterogeneousCoreTopology=1`**
  ——两个 CCX 一个 8 LP 一个 16 LP。
- `EBX_x00` 的 `CoreType`：P 核 `0h` = Performance Core，E 核 `1h` = Efficiency Core。
- **`NativeModelId` 两种核都是 `0h`。** 在 57930（纯 Zen 5 的 Strix Halo）里 `0h` 定义为 "Zen5 Core"。
  Strix Point 的 Zen 5c 核报的也是 `0h`——**AMD 自己的字段没有把 Zen 5c 区分成另一个 native model**。
  （限定：57930 覆盖的是 model 70h；Strix Point 自己的 PPR 是 57254，本次**未能取得第一方副本**，
  所以 model 24h 上 `NativeModelId` 的 ValidValues 表未经直接核对。见 §7。）

Linux 侧读法完全对应（v7.3-rc4）： `D:kernel`
- flag 是 **`X86_FEATURE_AMD_HTR_CORES`**（不是旧名 `..._HETEROGENEOUS_CORES`，v6.15 改名，
  commit `3aba0b40cacd`），是 Linux 合成位 word 21 bit 6，真实来源由
  `arch/x86/kernel/cpu/scattered.c:70` 给出：`{ X86_FEATURE_AMD_HTR_CORES, CPUID_EAX, 30, 0x80000026, 0 }`。
- `arch/x86/kernel/cpu/topology_amd.c:178-183`：
  `if (cpu_feature_enabled(X86_FEATURE_AMD_HTR_CORES)) { tscan->c->topo.hw_cpu_type = cpuid_ebx(0x80000026); ... }`
- 位域拆解在 `arch/x86/include/asm/processor.h:110-130`：
  `amd_num_processors:16, amd_power_eff_ranking:8, amd_native_model_id:4, amd_type:4`。
- 值定义 `arch/x86/include/asm/topology.h:117-121`：
  `AMD_CPU_TYPE_PERFORMANCE=0, AMD_CPU_TYPE_EFFICIENCY=1, AMD_CPU_TYPE_LOW_POWER=2`。
- **Intel/AMD 分叉是干净的**：`topology_common.c:162-181` 里 `CPUID.1A` 只在 `X86_VENDOR_INTEL`
  分支读，`0x80000026` 只在 AMD 分支读。**AMD 从不碰 leaf 0x1A，Intel 从不碰 0x80000026。**

| | Intel | AMD |
|---|---|---|
| 存在性标志 | `CPUID.7.EDX[15]` `X86_FEATURE_HYBRID_CPU`（真 CPUID 位） | `CPUID.0x80000026:0.EAX[30]`（Linux 合成 word 21） |
| core type 寄存器 | `CPUID.1A.EAX[31:24]` | `CPUID.0x80000026:0.EBX[31:28]` |
| 取值 | `ATOM=0x20`, `CORE=0x40` | `PERFORMANCE=0`, `EFFICIENCY=1`, `LOW_POWER=2` |

### 2.3 对照组：Phoenix 2 是混合的，但 CPUID 完全不说

**`fam19h_model78h`（Ryzen Z1）是 Zen 4 + Zen 4c，比 Strix Point 早一代的客户端混合件。**
在它的 dump（12 个逻辑 CPU）上： `M:dump`

- `CPUID 8000001D` SL03（L3）在**全部 12 个逻辑 CPU 上完全相同**：
  `0002C163-03C0003F-00003FFF-00000001` → 16 MB L3，`NumSharingCache` = 12 LP。单 CCX，共享一块 L3。
- `CPUID 80000026` SL00 在**全部 12 个逻辑 CPU 上 EAX = `0x00000001`、EBX = `0x00000002`**
  → `HeterogeneousCoreTopology = 0`，`CoreType = 0`（全报 Performance Core）。
- `CPUID 8000000A` 全同 `1EBF9CFF`。

**结论：Phoenix 2 在硅片上是混合的，但它的 CPUID 拓扑叶子一个字都没说。** 一个 hypervisor
在 Phoenix 2 上**无法**从 CPUID 分辨两种核；在 Strix Point 上**可以**（通过 `Fn8000_0026`）。
这条对"按型号查"的价值很高：**"AMD 客户端混合核心" 这个概念本身在 `fam19h_model78h` 和
`fam1Ah_model24h` 上的可观测性是不同的。**

### 2.4 反例：不混合也不均匀——X3D 的 L3 不对称

本机实测（Ryzen 9 9950X3D，`fam1Ah_model44h` st0，非混合、全 Zen 5），把线程绑定到不同逻辑 CPU
后读 `Fn8000_001D` 子叶 3： `M:local`

```
CPU  0: 8000001D.3 EAX=0003C163 ECX=00017FFF -> L3 96 MB shared by 16 LPs | 80000026.0 EAX=00000001 CoreType=0 | 8000000A EDX=FEBFBDFF
CPU  1: 同上 (96 MB)
CPU 16: 8000001D.3 EAX=0003C163 ECX=00007FFF -> L3 32 MB shared by 16 LPs | 80000026.0 EAX=00000001 CoreType=0 | 8000000A EDX=FEBFBDFF
CPU 17: 同上 (32 MB)
CPU 30: 同上 (32 MB)
```

InstLatx64 的 9950X3D dump 独立佐证：32 个逻辑 CPU 中 16 个报 96 MB、16 个报 32 MB。
同 dump 集里 9950X（非 X3D）全部 32 个报 32 MB，9800X3D 全部 16 个报 96 MB。 `M:dump`

**三条推论：**
1. `Fn8000_001D` 在客户端 AMD 上**逐核可变**，有两个彼此独立的成因：hybrid CCX、X3D 单边堆叠。
2. `Fn8000_0026` 的 `AsymmetricCores` / `HeterogeneousCoreTopology` **完全不标记 X3D 的这种不对称**
   ——因为按 AMD 的定义它们说的是 `LogProcThisLevel` 和 `CoreType`，不是 cache 容量。
   **想知道 L3 是否对称，只能读 `Fn8000_001D`，不能读 `Fn8000_0026`。**
3. `Fn8000_000A` 在两个 CCD 上仍然逐位相同。

顺带一个内核侧的隐患（值得记入未来 ticket 而非本文结论）：
`arch/x86/kernel/cpu/cacheinfo.c:512-518` 构造 `shared_cpu_map` 时用
`first = apicid - (apicid % nshared)`，这假设每个 cache node 占据一块大小相等、自然对齐的
APIC ID 区间。在 P/E 簇共享 L3 分组大小不同的部件上，这个算术的正确性不是显然的。
内核 `arch/x86/kernel/cpu/` 目录下没有任何关于异构/非对称 cache 的注释。 `D:kernel`

### 2.5 §2 的结论，以及它的限定

**在已测样本上，AMD 客户端的混合核心是性能/调度问题，不是正确性问题。**
支撑这一点的是"`Fn8000_000A` 在两种核上逐位相同"这一**正面实测**，不是"没听说有差异"这种推断。

**限定必须写清楚：**
- 样本是 **1 台 Ryzen AI 9 HX 370 + 1 台 Ryzen AI 7 PRO 360 + 1 台 Ryzen AI 9 465**
  （均 `fam1Ah_model24h`）和 1 台 Ryzen Z1（`fam19h_model78h`）。Krackan Point（`fam1Ah_model60h`）
  只取到单核视角，未做逐核 diff。
- 检查范围是 **CPUID + dump 里包含的那几十个 MSR**。**VMCB 行为、`#VMEXIT` 时序、
  `ASID` 分配的实际行为没有测过**，本文不对它们发表意见。
- 因此准确的说法是：**"两种核在 CPUID 报告的 SVM 能力面上完全一致；差异集中在 cache 拓扑、
  core type 与身份字段。"** 而不是 "Zen 5 与 Zen 5c 在 SVM 上没有任何行为差异"。

---

## §3 AVIC 的世代门控

### 3.1 实测：逐 family/model 的 `Fn8000_000A_EDX` 矩阵

位名取自 `amd-virtualization/references/01-svm-intro.md:94-131`（APM Vol.3 Rev 3.38 的完整 EDX 表），
并与 PPR 57930 p.103 的 `CPUID_Fn8000000A_EDX` 逐条对照。值为实测。 `M:dump` + `M:local`

| famXXh_modelXXh | 代表部件 | EDX | AVIC[13] | x2AVIC[18] | 备注 |
|---|---|---|---|---|---|
| `fam17h_model01h/08h/11h/18h/20h/50h` | Zen 1 / Zen+ 全部 | `0001BCFF` | **1** | 0 | |
| `fam17h_model31h/47h/60h/68h/71h/84h/90h/A0h` | Zen 2 全部 | `0013BCFF` | **1** | 0 | 比 Zen1 多 GMET(17)+SpecCtrl(20) |
| `fam19h_model21h` st**0** | Vermeer B0 | `001BBCFF` | **1** | 0 | |
| `fam19h_model21h` st**2** | Vermeer B2 / X3D | `101BBCFF` | **1** | 0 | **比 st0 多 bit 28 NestedVirtVmcbAddrChk** |
| `fam19h_model44h/50h` | Rembrandt / Cezanne | `101BBCFF` | **1** | 0 | |
| `fam19h_model18h` | Storm Peak (TR 7000) | `1FBFBCFF` | **1** | **1** | 唯一多出 bit 24 `TlbiCtl` |
| `fam19h_model61h` | Raphael / Dragon Range | `1EBFBCFF` | **1** | **1** | 8 台机器全同 |
| `fam19h_model74h` | Phoenix (7940H) | `1EBF9CFF` | **0** | **1** | ← AVIC 缺失、x2AVIC 在 |
| `fam19h_model75h` | Hawk Point 8845HS | `1EBF9CFF` | **0** | **1** | |
| `fam19h_model75h` | Phoenix 8700G | `1EBFBCFF` | **1** | **1** | ← **同 model 同 stepping，与上一行相反** |
| `fam19h_model78h/7Ch` | Phoenix 2 / Hawk Point 2 | `1EBF9CFF` | **0** | **1** | |
| `fam1Ah_model08h` | Shimada Peak (TR 9000) | `FFBFBDFF` | **1** | **1** | 唯一多出 bit 24 `TlbiCtl` |
| `fam1Ah_model24h/60h/68h/70h` | Strix Point / Krackan / Gorgon / Strix Halo | `FEBFBDFF` | **1** | **1** | |
| `fam1Ah_model44h` | Granite Ridge（3 台） | `FEBB9DFF` | **0** | **0** | ← 两位都缺 |
| `fam1Ah_model44h` | Granite Ridge（1 台 dump + **本机**） | `FEBFBDFF` | **1** | **1** | ← **同 model 同 stepping，与上一行相反** |

**逐位世代演进（只列首次出现的位）：**

| 位 | 名称 | 客户端上首次实测到置位的世代 |
|---|---|---|
| 13 | `AVIC` | **Zen 1**（`fam17h_model01h` 起即为 1） |
| 17 | `GMET` | Zen 2 |
| 20 | `SpecCtrl` | Zen 2 |
| 19 | `SSSCheck` | Zen 3 |
| 28 | `NestedVirtVmcbAddrChk` | Zen 3（`fam19h_model21h` **stepping 2**，stepping 0 无） |
| 18 | `x2AVIC` | **Zen 4** |
| 21 / 23 / 25 / 26 / 27 | `ROGPT` / `HOST_MCE_OVERRIDE` / `VNMI` / `IbsVirt` / `ExtLvtAvicAccessChg` | Zen 4 |
| 8 / 29 / 30 / 31 | `PmcVirt` / `BusLockThreshold` / `IdleHltIntercept` / bit 31 | **Zen 5** |
| 24 | `TlbiCtl` | **仅 Threadripper**（`fam19h_model18h`、`fam1Ah_model08h`）；主流客户端桌面/移动件全为 0 |

其中 bit 31 在语料库现有的 APM Rev 3.38 表里标的是 **Reserved**，而所有 Zen 5 实测件上都读 1。
**PPR 57930 p.103 把它命名为 `EnhancedShutdownIntercept`**：
> 31 `EnhancedShutdownIntercept`. Read-only. Reset: Fixed,1. "Support for EXITINFO1 on shutdown
> intercept and nested shutdown intercepts will result in a non-interceptible shutdown."

→ **语料库 `01-svm-intro.md` 的 EDX 表有一个可修正的空位。** `D:amd`
（bit 11 则是另一回事：它在 APM 表和 PPR 里都是 Reserved，却在**从 Zen 1 到 Zen 5 的每一个
实测件上都读 1**。这是一个"文档说保留、硬件读 1"的位，软件必须屏蔽。见 §7。）

### 3.2 关键发现：AVIC 位在客户端不是世代常量

两组"同 family/model/stepping、结果相反"的实测对照：

**(a) `fam1Ah_model44h` st0（Granite Ridge），按微码 patch level 排序：** `M:dump` + `M:local`

| 部件 | `MSR 0000_008B` patch level | `Fn8000_000A_EDX` | AVIC | x2AVIC |
|---|---|---|---|---|
| Ryzen 7 9700X | `0x0B40400C` | `FEBB9DFF` | 0 | 0 |
| Ryzen 9 9950X | `0x0B40401A` | `FEBB9DFF` | 0 | 0 |
| Ryzen 7 9800X3D | `0x0B404022` | `FEBB9DFF` | 0 | 0 |
| Ryzen 9 9950X3D | `0x0B404023` | `FEBFBDFF` | **1** | **1** |
| **Ryzen 9 9950X3D（本机实测）** | **`0x0B404035`** | **`FEBFBDFF`** | **1** | **1** |

注意 9800X3D（AVIC=0）与 9950X3D（AVIC=1）**都是 X3D 部件**，所以这不是 X3D/非 X3D 的差别；
在已取样本里，AVIC/x2AVIC 的有无与 patch level **单调**。

**(b) `fam19h_model75h` st2（Phoenix / Hawk Point）：** Ryzen 7 8845HS 报 `1EBF9CFF`（AVIC=0），
Ryzen 7 8700G 报 `1EBFBCFF`（AVIC=1）。同 family/model/stepping。 `M:dump`

此外 `fam19h_model74h/75h/78h/7Ch` 上出现的 **AVIC=0 而 x2AVIC=1** 组合，正是语料库
`90-dated-landscape.md:277` 已记录的那种情况——KVM 会打印
`[Firmware Bug]: Cannot enable x2AVIC, AVIC is unsupported` 然后把两者都关掉。
**现在这条有实测样本了。**

### 3.3 AMD 自己的文档解释了为什么会这样

PPR 57930 p.103 的 `CPUID_Fn8000000A_EDX` 表里，**每一个已定义位的复位描述都是 `Reset: Fixed,1`，
只有两个例外**： `D:amd`

> 18 `X2AVIC`: virtualized X2APIC. Read-only. **Reset: 1.** 1=Virtualized X2APIC is supported.
> 13 `AVIC`: AMD virtual interrupt controller. Read-only. **Reset: 1.** 1=Support indicated for SVM mode
> virtualized interrupt controller; Indicates support for `Core::X86::Msr::AvicDoorbell`.

而同一份 PPR 的 **Table 9 "Reset Type Definitions"（p.30）** 逐字定义：
> `Cold` — Cold reset. The value is applied only at cold reset.
> **`Fixed` — The read value that applies at all times.**

**即：写 `Fixed` 的位保证任何时候读出来都是那个值；只写 `Reset: 1` 的位不保证。
而 AVIC 与 x2AVIC 恰好就是全表仅有的两个不带 `Fixed` 的位，也恰好就是实测中唯一在同型号不同机器上
取值相反的两个位。** 文档与实测在这里完全咬合。

（限定：57930 覆盖的是 `fam1Ah_model70h`，而实测对照组 (a) 是 `fam1Ah_model44h`。
Granite Ridge 的 PPR 是 **57896**，本次未能取得第一方副本，所以 model 44h 上这两位是否也不带
`Fixed` 未经直接核对。见 §7。）

### 3.4 AMD 自己的 AVIC 勘误：erratum 1235，而且它写在一份**覆盖客户端**的 Revision Guide 里

**Revision Guide for AMD Family 17h Models 00h-0Fh Processors, Pub 55449, Rev 1.21, 2023-08, p.87**，逐字： `D:amd`

> **1235 Guest With AVIC (Advanced Virtual Interrupt Controller) Enabled May Fail to Process IPI
> (Inter-Processor Interrupt) Until Guest Is Re-Scheduled**
> **Description** — Under a highly specific and detailed set of internal timing conditions, if a guest
> with AVIC enabled is about to be de-scheduled by the hypervisor, it may fail to process an IPI until
> after the guest is re-scheduled.
> **Potential Effect on System** — A guest may not process an IPI until the guest is re-scheduled.
> **Suggested Workaround** — **None. Do not enable AVIC.**
> **Fix Planned** — **No fix planned**

四条读法：
1. **这是一条 AMD 第一方、带编号、覆盖客户端部件的虚拟化勘误。** 55449 的适用 package 含 **AM4**
   （以及 SP3/SP3r2/SP4/SP4r2），其 Table 12 按 *AMD Ryzen Processors* / *2nd Generation AMD Ryzen
   Processors* / *AMD Ryzen Threadripper* 分列。**语料库"客户端勘误无法引用"的说法在这一条上直接失效。**
2. 同样的文本也出现在 **Pub 56323 Rev 1.03, 2026-02（Family 17h Models 30h-3Fh）p.39**。
   erratum 1235 最早出现在 55449 的修订历史是 **2019-07 rev 1.17**。
3. **"None. Do not enable AVIC." 是 AVIC 默认关了十年的最强单一理由**——AMD 自己让你别开。
4. **erratum 1235 不出现在 Family 1Ah 的 Revision Guide（58251 Rev 1.30, 2025-07）里。**
   那份里唯一与 AVIC 相关的是 **#1579**，讲的是 **Secure AVIC**（SEV-SNP）下
   *"guest vAPIC … IRR … backing page may be corrupted"*，与经典 AVIC 无关。 `D:amd`

### 3.5 KVM 当前是怎么判的（v7.3-rc4 实读）

`arch/x86/kvm/svm/avic.c:1257-1336`，`avic` 模块参数**已不是 bool，而是三态 int，默认 `AVIC_AUTO_MODE (-1)`**： `D:kernel`

```c
static bool __init avic_want_avic_enabled(void)
{
	if (avic == AVIC_AUTO_MODE)
		avic = boot_cpu_has(X86_FEATURE_X2AVIC) &&
		       (cpu_feature_enabled(X86_FEATURE_ZEN4) || boot_cpu_data.x86 >= 0x1A);

	if (!avic || !npt_enabled)
		return false;

	/* AVIC is a prerequisite for x2AVIC. */
	if (!boot_cpu_has(X86_FEATURE_AVIC) && !force_avic) {
		if (boot_cpu_has(X86_FEATURE_X2AVIC))
			pr_warn(FW_BUG "Cannot enable x2AVIC, AVIC is unsupported\n");
		return false;
	}
	...
	/*
	 * Print a scary message if AVIC is force enabled to make it abundantly
	 * clear that ignoring CPUID could have repercussions.  See Revision
	 * Guide for specific AMD processor for more details.
	 */
```

以及 `avic_hardware_setup()` 里的 erratum 1235 处理（**只关 IPI 虚拟化，不关 AVIC**）：
```c
	/*
	 * Disable IPI virtualization for AMD Family 17h (Zen1 and Zen2) and
	 * Hygon Family 18h (derived from AMD Zen1) CPUs due to erratum 1235,
	 * ...
	 */
	if (boot_cpu_data.x86 == 0x17 || boot_cpu_data.x86 == 0x18)
		enable_ipiv = false;
```

**注意 KVM 源码里那句注释 `"See Revision Guide for specific AMD processor for more details."`
——内核自己就假定读者能拿到对应型号的 Revision Guide。** 这与 §6 的复核结论一致。

Per-VM 运行时抑制条件（`arch/x86/kvm/svm/svm.h:931-946` `AVIC_REQUIRED_APICV_INHIBITS`）包含
`_HYPERV`（Hyper-V SynIC/AutoEOI）、`_NESTED`（嵌套 SVM）、`_SEV`、`_IRQWIN`、`_PIT_REINJ`、
`_BLOCKIRQ`、`_APIC_ID_MODIFIED`、`_PHYSICAL_ID_ALIASED/TOO_BIG` 等——
**即使 host 侧开了 AVIC，单个 VM 仍可能被逐条抑制。** `D:kernel`

架构位的第一方定义（**APM Vol.2, Pub 24593, Rev 3.45, 2026-07, §15.29.7**），逐字： `D:amd`
> "CPUID Fn8000_000A_EDX[AVIC] (bit 13) = 1 indicates support for the AVIC architecture on that
> hardware. Additionally, CPUID Fn8000_000A_EDX[x2AVIC] (bit 18) = 1 indicates support for the AVIC
> architecture when the guest is using x2APIC MSR interface."

§15.29.10：*"x2AVIC mode is enabled by setting AVIC Enable (bit 31) and x2AVIC Mode Enable (bit 30)
in VMCB offset 60h to 1."*

> **附带的书目修正**：**AMD CPUID Specification, Pub 25481 已作废。** 其 rev 2.36 (2013-05) 封面自述
> *"This Specification is Obsolete. NOTE: The content of this specification has moved to an appendix of
> the AMD64 Architecture Programmer's Manual, Volume 3, order #24594."* 任何仍把 25481 当作
> CPUID 权威的引用都应改指 APM Vol.3 附录 E。 `D:amd`

### 3.6 这对"按世代查 AVIC"意味着什么

- **不能建一张"Zen N → AVIC 可用"的表。** 唯一正确的答案是"在这台机器上执行 `CPUID Fn8000_000A`"。
  这与语料库 `07-virtual-interrupts-avic.md:340-341` 现有的结论一致——**本文是给那条结论补上了
  它一直缺的实测证据，而不是推翻它。**
- 能建的表是**下限表**：x2AVIC 在客户端**最早出现在 Zen 4**（`fam19h`），Zen 1–Zen 3 的实测样本
  无一例外为 0。这是一个安全的世代下界。
- AVIC 位本身**从 Zen 1 起就一直在**，它的缺席是平台/固件/微码行为，不是世代退化。

**KVM 侧的默认开关史已在语料库 `90-dated-landscape.md:254-289` 完整记录并带 commit 号**
（v4.7 引入且默认关闭 → v6.18 commit `ca2967de5a5b` 翻转为 auto，条件是
`boot_cpu_has(X86_FEATURE_X2AVIC) && (cpu_feature_enabled(X86_FEATURE_ZEN4) || boot_cpu_data.x86 >= 0x1A)`；
erratum 1235 只禁用 Family 17h/Hygon 18h 上的 IPI 虚拟化而非整个 AVIC）。
**本 ticket 不重复该段调查**；本文只补一条与它直接咬合的实测事实：

> KVM 的 auto 模式要求 `X86_FEATURE_X2AVIC` **且** Zen 4+。按 §3.1 的实测矩阵，
> 这条件在 `fam19h_model61h`（Raphael）、`fam1Ah_model24h/60h/68h/70h`、`fam1Ah_model08h` 上成立，
> 在 `fam19h_model74h/75h(8845HS)/78h/7Ch` 上**因为 AVIC=0 而不成立**，
> 在 `fam1Ah_model44h` 上**取决于该机器的微码/固件**。
> 也就是说：**Linux 6.18+ 在 Zen 5 客户端桌面上是否默认开 AVIC，是一台一台不同的。** `M:dump` + `M:local`

---

## §4 安全勘误的 family / model 映射

语料库现有覆盖挂在架构特性下（`17-security.md:73-74`），不可按型号查。本节把它们落到
`famXXh_modelXXh` + 微码/AGESA 门槛。

### 4.1 Zenbleed — CVE-2023-20593 — AMD-SB-7008

**AMD 公告本身不给客户端微码号，只给 AGESA。** 公告标题逐字是 `Cross-Process Information Leak`
（"Zenbleed" 一词在公告全文中不出现）；全文只印了**一个**微码号 `0x0830107B`，且是给
2nd Gen EPYC "Rome" 的。 `D:amd`

AMD-SB-7008 的客户端受影响行与缓解版本（逐字）： `D:amd`

| 段 | 产品 | AGESA / PI 版本（及日期） |
|---|---|---|
| DESKTOP | Ryzen 3000 Desktop ("Matisse") | `ComboAM4v2PI 1.2.0.C` (2024-02-07)；`ComboAM4PI 1.0.0.B` (2024-03-20) |
| DESKTOP | Ryzen 4000 Desktop w/ Radeon ("Renoir" AM4) | `ComboAM4v2PI 1.2.0.Ca` (2024-03-14) |
| HEDT | Threadripper 3000 ("Castle Peak" HEDT) | `CastlePeakPI-SP3r3 1.0.0.A` (2023-11-21) |
| WORKSTATION | Threadripper PRO 3000WX ("Castle Peak" WS SP3) | `CastlePeakWSPI-sWRX8 1.0.0.C` (2023-11-29)；`ChagallWSPI-sWRX8 1.0.0.7` (2024-01-11) |
| MOBILE | Ryzen 5000 Mobile ("Lucienne") | **`CezannePI-FP6 1.0.1.0`** (2024-01-25) |
| MOBILE | Ryzen 4000 Mobile ("Renoir") | `RenoirPI-FP6 1.0.0.D` (2024-02-29) |
| MOBILE | Ryzen 7020 ("Mendocino" FT6) | `MendocinoPI-FT6 1.0.0.6` (2024-01-03) |

**陷阱：Lucienne（Zen 2）的修复走 `CezannePI-FP6`（Cezanne 是 Zen 3）的 AGESA 名。
按 AGESA 字符串反推微架构会错。** 另：Ryzen 5000 **桌面**（Vermeer，Zen 3）不在列——Zenbleed 是
Zen 2 独有；列表里的 "Ryzen 5000" 只有**移动版 Lucienne**。

**要按 family/model/stepping 查微码门槛，唯一可用的第一方级来源是 Linux 内核的表**
（`arch/x86/kernel/cpu/amd.c:957-963`，v7.3-rc4，逐字）： `D:kernel`

```c
static const struct x86_cpu_id amd_zenbleed_microcode[] = {
	ZEN_MODEL_STEP_UCODE(0x17, 0x31, 0x0, 0x0830107b),
	ZEN_MODEL_STEP_UCODE(0x17, 0x60, 0x1, 0x0860010c),
	ZEN_MODEL_STEP_UCODE(0x17, 0x68, 0x1, 0x08608107),
	ZEN_MODEL_STEP_UCODE(0x17, 0x71, 0x0, 0x08701033),
	ZEN_MODEL_STEP_UCODE(0x17, 0xa0, 0x0, 0x08a00009),
	{}
};
```

即：`fam17h_model31h` st0 ≥ `0x0830107B`、`fam17h_model60h` st1 ≥ `0x0860010C`、
`fam17h_model68h` st1 ≥ `0x08608107`、`fam17h_model71h` st0 ≥ `0x08701033`、
`fam17h_modelA0h` st0 ≥ `0x08A00009`。

Chicken bit 与判定逻辑（`amd.c:966-980`）：微码不达标时置
`MSR_AMD64_DE_CFG`（**`0xC0011029`**）**bit 9** `MSR_AMD64_DE_CFG_ZEN2_FP_BACKUP_FIX_BIT`
（`msr-index.h:680,683`），并打印
`"Zenbleed: please update your microcode for the most optimal fix"`；达标则清掉该位。
注意它先判 `if (cpu_has(c, X86_FEATURE_HYPERVISOR)) return;` —— **guest 里不做这件事**。 `D:kernel`

### 4.2 SRSO / Inception — CVE-2023-20569 — AMD-SB-7005

公告标题逐字是 `Return Address Security Bulletin`。AMD 的世代表述逐字： `D:amd`
> "AMD recommends customers apply either the standalone µcode patch or a BIOS update that
> incorporates the µcode patch, as applicable, for products based on **"Zen 3" and "Zen 4"** CPU
> architectures. … **No µcode patch or BIOS update … is necessary for products based on "Zen" or
> "Zen 2" CPU architectures because these architectures are already designed to flush branch type
> predictions from the branch predictor.**"

客户端行：Zen 3/Zen 4 给 AGESA，Zen 1/Zen 2 一律 `Not applicable` + `OS Config Options:
Refer to your OS vendor`。抽样： `D:amd`
- Ryzen 5000 Desktop（Vermeer）/ Ryzen 5000 Desktop w/ Radeon（Cezanne）→ `ComboAM4v2PI 1.2.0.B` (2023-08-25)
- Ryzen 7000 Desktop（Raphael）→ `ComboAM5 1.0.8.0` (2023-08-25)
- Ryzen 6000 / 7035（Rembrandt）→ `RembrandtPI-FP7_1.0.0.9a` (2023-08-31)
- Ryzen 5000 w/Radeon / 7030（Cezanne/Barcelo）→ `CezannePI-FP6 1.0.0.Fa` (2023-08-22)
- Ryzen 7040（Phoenix）→ `PhoenixPI-FP8-FP7_1.0.0.2a` (2023-08-23)
- Ryzen 7045（Dragon Range）→ `DragonRangeFL1PI 1.0.0.3b` (2023-08-30)
- Threadripper PRO 5000WX（Chagall）→ `ChagallWSPI-sWRX8 1.0.0.7` (2024-01-11)

**跨 VM 影响：AMD-SB-7005 公告正文里 "virtual machine" / "hypervisor" / "guest" / "host" 全部零出现。**
公告只说 "speculation is constrained within the current address space … only potentially exploitable
locally"。但**它自己链接的白皮书**明说了跨 VM： `D:amd`
"Technical Update Regarding Speculative Return Stack Overflow", **Revision 2.0, February 2024**：
> "These processors may be vulnerable to SRSO across other boundaries, such as **across the guest/host boundary**."
> "Processors which set `SRSO_MSR_FIX=1` support an MSR bit which **mitigates SRSO across guest/host boundaries**.
> Software may enable this by setting **bit 4 (`BpSpecReduce`) of MSR `C001_102E`**."
> "**Mitigation of SRSO across user/user or VM/VM boundaries requires the use of IBPB unless `SRSO_NO` is 1.**"

→ **对本技能特别重要：客户端用户只读公告会得到"这只是本地问题"的印象，
跨 VM 的部分只写在白皮书里。**

### 4.3 TSA（Transient Scheduler Attacks）— AMD-SB-7029 — 客户端跨 VM 的最强一条

公告标题 `AMD Transient Scheduler Attacks`，2025-07-08 发布，CVE-2024-36350 / -36357（各 5.6 Medium）
+ -36348 / -36349（各 3.8 Low）。四个 CVSS 向量都带 **`S:C`（Scope: Changed）**。 `D:amd`

配套白皮书 "Technical Guidance for Mitigating Transient Scheduler Attacks", **Revision 2.0, July 2025** 逐字：
> "As of the date of this whitepaper, **only Family 19h products are known to be vulnerable to TSA**."
> **TSA-L1**："…may potentially result in information leakage from the OS kernel to a user application,
> **from a hypervisor to a guest VM**, from one user application to another, **or from one guest VM to another**."
> **TSA-SQ**："AMD does not believe TSA-SQ is likely to result in information leakage between a
> hypervisor and guest VM…"
> 缓解："AMD recommends OS and hypervisor software execute this **VERW** instruction whenever the system
> transitions from trusted to untrusted code, … **or when transitioning from the hypervisor to a VM**."
> "Note that **VERW is the only mitigation recommended by AMD for TSA**. Other cache flushing operations
> such as `WBINVD` or the `FLUSH_CMD` MSR (0x10B) may not be effective mitigations for TSA-L1."
> §7 "TSA AND AMD SEV-SNP"："AMD believes TSA may result in the ability for a malicious hypervisor to
> infer data used by an AMD SEV-SNP guest."

**该白皮书的 "APPENDIX: MINIMUM MICROCODE REVISIONS" 是本次找到的
唯一一份按 family/model/stepping 列客户端微码门槛的 AMD 第一方表**： `D:amd`

| Family/Model/Stepping | Code Name | Microcode Version |
|---|---|---|
| Fam 19h, Model 21h, Stepping 0h | Vermeer | `0x0A20102E` |
| Fam 19h, Model 21h, Stepping 2h | Vermeer | `0x0A201211` |
| Fam 19h, Model 44h, Stepping 1h | Rembrandt | `0x0A404108` |
| Fam 19h, Model 50h, Stepping 0h | Cezanne | `0x0A500012` |
| Fam 19h, Model 61h, Stepping 2h | Raphael | `0x0A60120A` |
| Fam 19h, Model 74h, Stepping 1h | Phoenix | `0x0A704108` |
| Fam 19h, Model 75h, Stepping 2h | Hawkpoint1 | `0x0A705208` |
| Fam 19h, Model 78h, Stepping 0h | Phoenix2 | `0x0A708008` |
| Fam 19h, Model 7Ch, Stepping 0h | Hawkpoint2 | `0x0A70C008` |
| Fam 19h, Model 18h, Stepping 1h | Stormpeak | `0x0A108109` |
| Fam 19h, Model 08h, Stepping 2h | Chagall | `0x0A00820D` |

（服务器行 Milan/Genoa/Bergamo 略。）新增 CPUID 位：`Fn8000_0021_ECX[2] TSA_L1_NO`、`TSA_SQ_NO`、`VERW_CLEAR`。

公告里的客户端 PI 版本抽样：Vermeer / Cezanne AM4 → `ComboAM4v2PI 1.2.0.E + OS Updates` (2025-01-22)；
Raphael X3D → `ComboAM5PI 1.2.0.3`(2025-01-08) / `1.0.0.a`(2025-01-14) / `1.1.0.3c`(2025-01-27)；
Phoenix AM5（Ryzen 8000）→ `ComboAM5PI 1.2.0.3`/`1.1.0.3c`；Phoenix/Hawk Point 移动 →
`PhoenixPI-FP8-FP7 1.2.0.0` (2024-12-16)；Rembrandt/7035 → `RembrandtPI-FP7 1.0.0.Bb` (2024-12-26)；
Dragon Range → `DragonRangeFL1 1.0.0.3g` (2024-12-18)。
**Matisse / Picasso / Renoir / Castle Peak / Chagall WS 一律 `Not affected`**——与"只有 Family 19h 受影响"一致。 `D:amd`

### 4.4 Zen 4 客户端的 virtualized VMLOAD/VMSAVE 缺陷 —— 一条**没有 AMD 勘误号**的缺陷

这条是 ticket 04 带过来的，值得在本文按 family/model 定死。
Linux commit **`a5ca1dc46a6b610dd4627d8b633d6c84f9724ef0`**，作者 **Mario Limonciello (AMD)**，
2024-11-05，`Cc: stable`，逐字： `D:kernel`

> **Subject: x86/CPU/AMD: Clear virtualized VMLOAD/VMSAVE on Zen4 client**
> "A number of Zen4 client SoCs advertise the ability to use virtualized VMLOAD/VMSAVE, but using
> these instructions is reported to be a cause of a **random host reboot**. These instructions aren't
> intended to be advertised on Zen4 client so clear the capability."
> `Link: https://bugzilla.kernel.org/show_bug.cgi?id=219009`

当前 mainline 的代码（`arch/x86/kernel/cpu/amd.c:1015-1030`，在 **`init_amd_zen4()`** 内）：
```c
	/*
	 * These Zen4 SoCs advertise support for virtualized VMLOAD/VMSAVE
	 * in some BIOS versions but they can lead to random host reboots.
	 */
	switch (c->x86_model) {
	case 0x18 ... 0x1f:
	case 0x60 ... 0x7f:
		clear_cpu_cap(c, X86_FEATURE_V_VMSAVE_VMLOAD);
		break;
	}
```

**精确影响范围**（`init_amd_zen4()` 只在 `X86_FEATURE_ZEN4` 置位时调用 = `fam19h` models
`0x10…0x1f` 与 `0x60…0xaf`，switch 再收窄一次）： `D:kernel`

| famXXh_modelXXh | 部件 | 受影响？ |
|---|---|---|
| `fam19h_model10h…17h` | Genoa（服务器） | 否 |
| **`fam19h_model18h…1Fh`** | **Storm Peak（TR 7000 / PRO 7000WX）** | **是** |
| **`fam19h_model61h`** | **Raphael / Dragon Range** | **是** |
| **`fam19h_model74h/75h/78h/7Ch`** | **Phoenix / Hawk Point / Phoenix 2 / Hawk Point 2** | **是** |
| `fam19h_model80h…AFh` | Bergamo 等 | 否 |
| **`fam1Ah`（全部 Zen 5）** | Granite Ridge / Strix Point / Strix Halo / Krackan / Shimada Peak | **否**——`init_amd_zen5()` 是另一个函数，不含此 clear |

**本机实测核对：** `fam1Ah_model44h` st0，`Fn8000_000A_EDX = FEBFBDFF` → **bit 15 `VMSAVEvirt` = 1**，
且不在被清列表内，所以内核会保留它。**Zen 5 客户端不受此缺陷影响。** `M:local`（2026-09-26）

**三条对本技能重要的性质：**
1. **AMD 没有为它发过勘误号，也没有公告。** 它的全部公开记录是一条内核 commit 加一个
   kernel bugzilla 条目。**这正是"客户端勘误通道"问题的典型形态**：AMD 的员工把修复提交到内核，
   但没有走 AMD-SB 或 Revision Guide。 `GAP`
2. commit message 说 *"in some BIOS versions"*——又一个**固件决定 CPUID 可见性**的客户端案例，
   与 §3.2 的 AVIC 现象同类。
3. **裸机 hypervisor 不会自动获得这个缓解。** 内核的 clear 只影响 Linux 自己；一个在
   `fam19h_model61h` 上直接读 `Fn8000_000A_EDX[15]` 并据此使用 virtualized VMLOAD/VMSAVE 的
   thin hypervisor 会踩到随机重启。**这应当成为 v2 开发轨道的一条硬性检查项。**

### 4.5 内核里按 family/model/stepping 屏蔽特性的四张微码表

这四张表是目前**唯一**可以按 `famXXh_modelXXh` + stepping 查"需要哪个微码版本"的机器可读来源，
全部在 `arch/x86/kernel/cpu/amd.c`，共用宏
`#define ZEN_MODEL_STEP_UCODE(fam, model, step, ucode) X86_MATCH_VFM_STEPS(VFM_MAKE(X86_VENDOR_AMD, fam, model), step, step, ucode)`（`:383-385`）。 `D:kernel`

| 表 | 针对 | 覆盖 | 不达标时的动作 |
|---|---|---|---|
| `erratum_1386_microcode[]` (`:881-885`) | **AMD erratum 1386**（XSAVES 故障） | `fam17h_model01h` st2 ≥ `0x0800126E`；`fam17h_model31h` st0 ≥ `0x08301052` | `clear_cpu_cap(X86_FEATURE_XSAVES)` |
| `amd_zenbleed_microcode[]` (`:957-963`) | **Zenbleed** CVE-2023-20593 | 见 §4.1 | 置 `MSR_AMD64_DE_CFG` bit 9 |
| `amd_tsa_microcode[]` (`:387-405`) | **TSA** | 16 条 `fam19h` 条目 | 见 §4.3 |
| **`zen5_rdseed_microcode[]`** (`:1032-1043`) | **Zen 5 RDSEED 故障** | 见下表 | `clear_cpu_cap(X86_FEATURE_RDSEED)` **并且** `msr_clear_bit(MSR_AMD64_CPUID_FN_7, 18)`，打印 `"RDSEED32 is broken. Disabling the corresponding CPUID bit."` |

`zen5_rdseed_microcode[]` 全表（`init_amd_zen5()` 目前**只做这一件事**）：

| famXXh_modelXXh | stepping | 最低微码 |
|---|---|---|
| `fam1Ah_model02h` | 1 | `0x0B00215A` |
| `fam1Ah_model08h` | 1 | `0x0B008121` |
| `fam1Ah_model11h` | 0 | `0x0B101054` |
| **`fam1Ah_model24h`**（Strix / Gorgon Point） | 0 | **`0x0B204037`** |
| **`fam1Ah_model44h`**（Granite Ridge） | 0 | **`0x0B404035`** |
| `fam1Ah_model44h` | 1 | `0x0B404108` |
| `fam1Ah_model60h`（Krackan） | 0 | `0x0B600037` |
| `fam1Ah_model68h` | 0 | `0x0B608038` |
| `fam1Ah_model70h`（Strix Halo） | 0 | `0x0B700037` |

> **本机实测：微码正好落在门槛上。** 这台 9950X3D 是 `fam1Ah_model44h` st0，运行微码
> **`0x0B404035`**——与表中该行要求的最低值**逐位相等**。因此内核不会清 RDSEED；
> 实测 `Fn0000_0007_EBX = F1BF97AB`，**bit 18 `RDSEED` = 1**，与预期一致。
> **再低一个微码版本，这台机器上 CPUID 里的 RDSEED 位就会被内核连同 `MSR_AMD64_CPUID_FN_7` bit 18
> 一起抹掉。** 这是"微码是行为变量"这句话在本机上的第二个实例（第一个是 §3.2 的 AVIC）。 `M:local`（2026-09-26）

**注意 `msr_clear_bit(MSR_AMD64_CPUID_FN_7, 18)` 这个动作本身**：内核通过一个 MSR
**改写 CPUID 的返回值**。也就是说在 AMD 客户端上，`CPUID` 的输出不但受微码影响，
还可以被 ring-0 软件改写。任何"读一次 CPUID 就缓存"的 hypervisor 都要知道这件事。 `D:kernel`

### 4.6 内核无条件清掉 Zen 2 的 INVLPGB

`init_amd_zen2()` 里（`amd.c:995-996`），无条件、不看微码： `D:kernel`
```c
	/* Correct misconfigured CPUID on some clients. */
	clear_cpu_cap(c, X86_FEATURE_INVLPGB);
```

这与 §3.1 观察到的 `Fn8000_000A_EDX[24] TlbiCtl` 分布互为印证：**`TlbiCtl` 在实测的主流客户端
桌面/移动件上全为 0，只有 Threadripper（`fam19h_model18h`、`fam1Ah_model08h`）为 1。**
`TlbiCtl` 正是 `INVLPGB`/`TLBSYNC` 在 VMCB 里的 hypervisor enable 位
（语料库 `06-nested-paging.md:262`，`[APM3 §4 "INVLPGB"]`）。
**结论：客户端上不要指望 `INVLPGB` 的 guest 侧控制；内核甚至认为 Zen 2 客户端的这个 CPUID 位本身是错的。**

### 4.7 一条必须收进本文的公告：AMD-SB-7059

**`Guest Initiated Machine Check Errors`**，CVE-2023-31364，**CVSS 8.3 High**，2026-02-24 发布。 `D:amd`
> Summary: "AMD received a report from the security team at Amazon Web Services (AWS) indicating that
> **it may be possible for guest VMs to cause a crash of a host system**. … it may be possible for a
> guest VM to trigger a fatal machine check error (MCE) on the host potentially causing a crash
> resulting in **denial of service for all co-located guest VMs**."

EPYC 每一代都给了 PI 修复（NaplesPI 1.0.0.R / RomePI 1.0.0.N / MilanPI 1.0.0.H / GenoaPI 1.0.0.G /
TurinPI 1.0.0.7）。**"AMD Athlon™ and AMD Ryzen™ Processors" 一栏下的每一个客户端产品族
（Ryzen 3000/4000/5000/6000/7000/7020/7040/7045/8000 桌面与移动、TR PRO 3000WX / 5000WX）
全部是 `No fix planned`**，脚注逐字：
> "The attack is launched from a harmful virtual machine (VM) that exploits the system's error-handling
> abilities. These errors happen due to incorrect memory access. **This type of attack is not common for
> client processors.**"

同样地，AMD-SB-4013 里的 CVE-2024-21961（guest VM → host DoS，via PCIe Link）在每一个客户端产品上
也是 `No fix planned, Refer to Errata #:1165, 1166, 1526`。

→ **这是本技能面向 Windows PC 客户端的一条硬结论：AMD 明确把"客户端不是虚拟化平台"写进了
不修复的理由。** 在客户端做 guest→host 隔离假设时必须知道这一点。

---

## §5 AGESA / 微码作为行为变量

### 5.1 为什么这一节是必须的

§3.2 已经证明：**在客户端，微码 patch level 与 `Fn8000_000A` 里 AVIC/x2AVIC 两位的可见性相关。**
所以"这颗 CPU 支持什么"在客户端不是一个纯硅片问题——微码/AGESA 是一个真实的行为变量。

### 5.2 Windows 上怎么读运行中的微码版本

本机实测，注册表键 `HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0`： `M:local`

```
Identifier                = AMD64 Family 26 Model 68 Stepping 0
ProcessorNameString       = AMD Ryzen 9 9950X3D 16-Core Processor
CPU Family Model Stepping = 11800384          -> 0x00B40F40  (= CPUID Fn0000_0001_EAX 原值)
Update Revision           = 35 40 40 0B       -> little-endian DWORD 0x0B404035
Previous Update Revision  = 35 40 40 0B
Update Status             = 6
```

- `Update Revision` 是 **REG_BINARY、小端**；`35 40 40 0B` → `0x0B404035`。
- 该值与 `linux-firmware` 里 `Family=0x1a Model=0x44 Stepping=0x00: Patch=0x0b404035` **完全一致**，
  两条独立来源互证。 `M:local` + `D:amd`
- `CPU Family Model Stepping` 直接是 `Fn0000_0001_EAX`，可以不跑 CPUID 就拿到 signature。

PowerShell 一行：
```powershell
$v = Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0'
'{0:X8}' -f [BitConverter]::ToUInt32($v.'Update Revision',0)   # -> 0B404035
```

### 5.3 Linux 上怎么读

- 微码版本：`/sys/devices/system/cpu/cpu0/microcode/version`、`/proc/cpuinfo` 的 `microcode` 行，
  内核里是 `boot_cpu_data.microcode`（`match.c:64-72` 的 `x86_match_min_microcode_rev()` 就拿它比）。 `D:kernel`
- 架构上的来源是 **`MSR 0000_008B` `PatchLevel`**，PPR 57930 p.124 逐字：
  *"This returns an identification number for the microcode patch that has been loaded.
  If no patch has been loaded, this returns 0."* `D:amd`
- **AGESA 版本**：内核有一个专门的 DMI 打印器 `print_dmi_agesa()`（`arch/x86/kernel/cpu/amd.c:1427`,
  `late_initcall`），其注释逐字给了样例串
  `/* Sample string: AGESA!V9 StrixKrackanPI-FP8 1.1.0.0c */`，`pr_info("AGESA: %s\n", ...)`。
  **即 AGESA 版本是从 SMBIOS/DMI 里读出来的字符串，不是 MSR。** `D:kernel`
  Windows 侧对应 `Get-CimInstance Win32_BIOS` 的 `SMBIOSBIOSVersion`（本机为 `F12a`，
  AMI，ReleaseDate 2026-03-11）——**注意这是 OEM 的 BIOS 版本号，不含 AGESA 串**，
  AGESA 串需要读 DMI OEM strings。 `M:local`

### 5.4 复现脚本

本文所有 `M:local` 数据用一段 PowerShell + 内联 x64 stub 取得（`VirtualAlloc(PAGE_EXECUTE_READWRITE)`
+ `Marshal.GetDelegateForFunctionPointer`，stub 为
`49 89 D9 | 89 C8 | 89 D1 | 0F A2 | 41 89 00 | 41 89 58 04 | 41 89 48 08 | 41 89 50 0C | 4C 89 CB | C3`，
约定 `RCX=leaf, RDX=subleaf, R8=uint[4]`）。逐核测量用
`[System.Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity` 绑核。
**这段东西值得进 v2 的开发轨道**——它正好是 ticket 里"agent 要能动手写代码"的一个最小样例，
而且不需要驱动、不需要管理员权限。 `M:local`

### 5.5 AGESA ↔ 微码的关系，以及客户端的验证缺口

AMD 最清楚的一句在 AMD-SB-7005 的 Datacenter 表头，逐字： `D:amd`
> "**Apply either µcode patch or AGESA firmware. When released, the AGESA™ firmware will include the
> µcode patches.**"

**但客户端拿不到可验证的数字。** 三条经核对的事实：
1. AMD-SB-7008 / 7005 / 7029 / 7033 的**客户端行全部只给 AGESA / PI 版本串，不给微码 patch level**；
   微码号只出现在 Data Center 段。 `D:amd`
2. AMD-SB-7033 只在 Data Center 段给出
   *"To confirm the recommended mitigation is installed, you can verify by referring to the microcode
   version(s) listed below each PI version."* ——**客户端段没有这句，也没有那些数字。** `D:amd`
3. 术语在 2025 年前后漂移：旧公告写 "AGESA™ firmware"，2025–2026 的公告（SB-7029/7033/4013/4017/7052/7064）
   写 "**Platform Initialization (PI) firmware**"，版本串格式不变。**按 "AGESA" 一词检索会漏掉全部近期公告。** `D:amd`

**唯一一处 AMD 给出客户端 family/model/stepping → 微码版本的第一方表，是 §4.3 的 TSA 白皮书附录。**
这是当前"按型号查微码门槛"能拿到的最好东西。

`ComboAM4PI` / `ComboAM4v2PI` / `ComboAM5PI` / `<Codename>PI-<Socket>` 这套命名**没有任何 AMD 文档定义**；
AGESA 的正式规范 "AMD Generic Encapsulated Software Architecture (AGESA) Interface Specification for
Arch2008"（pub **44065**, Rev 3.04, 2017-01-09, `https://docs.amd.com/v/u/en-US/44065_Arch2008`）
存在但内容未能取回。AMD 每份公告都链接的 `glossary-of-terms.pdf` 里**没有 AGESA、microcode 或
Platform Initialization 的词条**。 `D:amd` / `GAP`

---

## §6 勘误通道复核 —— 本 ticket 的关键项

### 6.1 被复核的声明

技能在六处断言（`SKILL.md:165-167`、`00-quickref.md:37`、`01-svm-intro.md:292`、
`03-intercepts.md:7,317-318`、`06-nested-paging.md:270,319`、`07-virtual-interrupts-avic.md:340-341`）：

> **"AMD publishes no errata channel for client parts. Revision guides exist for EPYC families only;
> client Ryzen has no public revision guide and no public PPR."**

**复核结论：三个分句全部不成立。** 以下逐条给证据。

### 6.2 「no public PPR」—— 错。已实际下载一份并解压

本次**实际下载、解压、读取**了一份客户端 PPR： `D:amd`

```
URL   : https://docs.amd.com/api/khub/documents/fEY1GkRkcoEhenFftZyr8Q/content
HTTP  : 200, Content-Type: application/zip, Content-Length: 4289830
       Content-Disposition: inline; filename="57930-A0-PUB_3.00.zip"
解压后: 57930-A0-PUB_3.00.pdf (5.1 MB, 1017 页) + README.txt
封面  : "57930 Rev 3.00 - Apr 30, 2025 / PPR for AMD Family 1Ah Model 70h A0 /
        Processor Programming Reference (PPR) for AMD Family 1Ah Model 70h, Revision A0 Processors"
页脚  : 每页 "[AMD Public Use]"
部件  : Family 1Ah Model 70h = Strix Halo = Ryzen AI Max 300 系列（客户端）
```

**这份文档里有本 ticket 需要的一切**：`CPUID_Fn8000000A_EDX` 全 32 位（p.103）、
`CPUID_Fn80000026_EAX/EBX/ECX`（p.121-122）、`CPUID_Fn8000001D`（p.106）、
`MSR0000_008B PatchLevel`（p.124）、`CPUID_Fn80000008_EBX`（p.101）、Reset Type Definitions（p.30）。

经第一方 URL 确认的客户端 PPR（每份封面均 `[AMD Public Use]`）： `D:amd`

| 标题（封面逐字） | Pub # | Rev | 日期 | 客户端部件 | 文档内 package |
|---|---|---|---|---|---|
| PPR for AMD Family 17h Model 20h, Revision A1 Processors | 55772-A1 | 3.08 | 2021-04-14 | Dali / Pollock | FT5, FP5, AM4 |
| PPR for AMD Family 17h Models 31h, Revision B0 | 55803 | 0.93 | 2020-10-28 | Castle Peak (TR 3000) | — |
| PPR for AMD Family 17h Model 60h, Revision A1 Processors | 55922-A1 | 3.06 | 2020-09-28 | Renoir | FP6, AM4 |
| PPR for AMD Family 19h Model 51h, Revision A1 Processors | 56569-A1 | 3.03 | 2021-09-21 | Cezanne | FP6, AM4 |
| PPR for AMD Family 19h Model 70h, Revision A0 Processors | 57019 | 3.00 | 2023-02-07 | Phoenix | FP7, FP7r2 |
| **PPR for AMD Family 1Ah Model 70h, Revision A0 Processors** | **57930** | **3.00** | **2025-04-30** | **Strix Halo** | **FP11** |

另有 **Open-Source Register Reference For AMD Family 17h Processors Models 00h–2Fh**，pub **56255**,
Rev 3.03, 2018-07，第一方 HTTP 200：
`https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/56255_OSRR.pdf`
——models 00h–2Fh 全是客户端（Summit Ridge / Raven Ridge / Picasso / Dali）。 `D:amd`

> **对 `01-svm-intro.md:292` 的直接影响。** 那条 claim 说 *"the third-party-circulated PPR 56713 is not
> in AMD's public index and is not citable"*。**56713 本身的第一方副本本次仍未找到**（见 §7），
> 那一半仍然成立；但它所支撑的一般性结论（"客户端没有 PPR"）已经不成立。

### 6.3 「revision guides exist for EPYC families only」—— 错，但方向上有一半是对的

**反例（客户端在列）：** `D:amd`
- **Revision Guide for AMD Family 17h Models 00h-0Fh Processors**, Pub **55449**, Rev **1.21**,
  2023-08，98 页，`https://docs.amd.com/api/khub/documents/abOrVU_gcO7ZsC3qDF4uNQ/content`。
  它的 **Table 12 "Cross-Reference of Errata to Processor Segments"** 的列包括
  **AMD Ryzen Processors / 2nd Generation AMD Ryzen Processors / AMD Ryzen Threadripper /
  2nd Generation AMD Ryzen Threadripper Processors**，与 EPYC 并列。修订历史逐字：
  *"Added 2nd Generation AMD Ryzen™ Threadripper™ silicon information to Overview, Table 4, and Table 12."*
  文档收录 60+ 条编号勘误（#1017 … #1488），**其中 p.87 的 erratum 1235 就是一条虚拟化勘误
  （AVIC/IPI），适用 package 含 AM4**——见 §3.4。**这一条单独就足以推翻"客户端勘误无法引用"。**
- 更老的客户端专属：**47534** Family 14h Models 00h-0Fh Rev 3.18（仅 C-Series / E-Series APU）、
  **48063** Family 15h Models 00h-0Fh Rev 3.24（FX-Series + Opteron），均在
  `.../archived-tech-docs/revision-guides/` 下 HTTP 200。

**但方向性的观察有一半为真：当代（Family 19h / 1Ah）的公开 Revision Guide 确实都是 EPYC 范围。**
本次逐份核对了封面（其中三份已下载并用 PyMuPDF 提取封面文字）： `D:amd`

| Pub # | 标题（封面逐字） | Rev / 日期 | 覆盖 |
|---|---|---|---|
| 56323 | Revision Guide for AMD Family 17h Models 30h-3Fh Processors | 1.01 / 1.03 | EPYC 7002 |
| **56683** | **Revision Guide for AMD Family 19h Models 00h-0Fh Processors** | **1.08 / August 2023** | Milan（服务器） |
| 57095 | Revision Guide for AMD Family 19h Models 10h-1Fh Processors | 1.01 / 1.05 | Genoa |
| 57926 | Revision Guide for AMD Family 19h Models A0h-AFh Processors | 1.05 | Bergamo |
| **58251** | **Revision Guide for AMD Family 1Ah Models 00h-0Fh Processors** | **1.10 / March 2025** | Turin |
| **58730** | **Revision Guide for AMD Family 1Ah Models 10h-1Fh Processors** | **1.10 / March 2025** | Turin Dense |

对应客户端 model 范围（`fam19h` 的 20h-2Fh / 40h-7Fh、`fam1Ah` 的 20h-2Fh / 40h-4Fh / 60h-7Fh）
**没有找到对应的公开 Revision Guide。** 实测确认：56683 / 58251 / 58730 三份全文里
**都不含 AMD-SB-4013 引用的勘误号 #1165 / #1166 / #1526**（三份的号段分别是 1155–1489 与 1155–1590）。

### 6.4 「no errata channel for client parts」—— 错，而且 AMD 自己给它起了名字

**(a) `AMD-SB-4xxx` 是编号独立的 Client 公告序列**，与 `AMD-SB-3xxx`（Server/EPYC）并列。
2026-02-10 当天 SB-4013（客户端）与 SB-3023（EPYC）同步发布；2026-05-12 SB-4017 与 SB-3030 同步发布。 `D:amd`

| ID | 标题（逐字） | 发布 |
|---|---|---|
| `AMD-SB-4017` | AMD Athlon™, AMD Ryzen™, and AMD Ryzen™ Embedded Series Processor Vulnerabilities – May 2026 | 2026-05-12 |
| `AMD-SB-4013` | AMD Athlon™ and AMD Ryzen™ Processor Vulnerabilities – February 2026 | 2026-02-10 |
| `AMD-SB-4012` | AMD Client Vulnerabilities - August 2025 | 2025-08-12 |
| `AMD-SB-4008` | AMD Client Processor Vulnerabilities - February 2025 | 2025-02-11 |
| `AMD-SB-4004` | Client Vulnerabilities - Aug 2024 | 2024-08-13 |
| `AMD-SB-4002` | AMD Client Vulnerabilities - November 2023 | 2023-11-14 |
| `AMD-SB-4001` | Client Vulnerabilities - May 2023 | 2023-05-09 |
| `AMD-SB-1031` | AMD Client Vulnerabilities - January 2023 | 2023-01-10 |
| `AMD-SB-1027` | AMD Client Vulnerabilities - May 2022 | 2022-05-10 |

SB-4013 覆盖 30 个客户端产品族，一直到最新硅片：Ryzen 9000 Desktop、Ryzen 9000HX Mobile、
**Ryzen AI 300**、**Ryzen AI Max 300**、Threadripper 9000 / PRO 9000 WX、Ryzen Z1 / Z2 / Z2 Extreme / Z2 Go。

**(b) AMD 自己使用「Client Revision Guide」这个词。** AMD-SB-4013 的脚注逐字： `D:amd`
> "**2 Refer to Errata #1165, #1166 and #1526 on the corresponding Client Revision Guide of the product**"
> "**3 Refer to Erratum #1526 on the corresponding Client Revision Guide of the product**"

**(c) 客户端公告里印的是逐 SKU 的 AGESA/PI 版本串**，例如 AMD-SB-7033（EntrySign, CVE-2024-36347）：
Ryzen 9000 Desktop "Granite Ridge" → `ComboAM5PI 1.2.0.3c` (2025-03-27)；
**Ryzen AI 300 "StrixKracken" → `StrixKrackenPI-FP8 1.1.0.0b` (2025-03-26)**；
**Ryzen AI Max+ "StrixHalo" → `StrixHaloPI-FP11 1.0.0.1` (2025-03-20)**；
**Ryzen 9000HX "Fire Range" → `FireRangeFL1PI 1.0.0.0a` (2025-04-23)**；
Threadripper PRO 7000 WX "Storm Peak" → `StormPeakPI-SP6 1.0.0.1k`/`1.1.0.0i`。 `D:amd`

**(d) 但这个通道的可发现性很差，这一点必须一起记下来。** AMD 的公告索引
（`https://www.amd.com/en/resources/product-security.html`）是**一张没有分页、没有筛选器的平表**，
只有 `AMD ID | Title | Type | CVEs | Published | Last Updated` 六列，`Type` 只有
"Security Bulletins" / "Security Briefs" 两个值。**没有 Client/Server/Embedded 筛选。**
更麻烦的是：**客户端用户真正关心的 CPU 漏洞（Zenbleed 7008、Inception 7005、TSA 7029、
OP Cache Corruption 7052、Guest-Initiated MCE 7059）全都在 `7xxx` 跨段号段里，不在 `4xxx` 客户端号段里。** `D:amd`

### 6.5 建议替换的声明文本

把六处现有声明替换为（保留原有的"负面需同等证据"纪律，但把边界画准）：

> **AMD 为客户端部件发布 PPR 和安全公告，但当代客户端 model 范围没有公开的 Revision Guide。**
> 客户端 PPR 公开在 docs.amd.com，封面标注 `[AMD Public Use]`：55772-A1 (Dali)、55803 (Castle Peak)、
> 55922-A1 (Renoir)、56569-A1 (Cezanne)、57019 (Phoenix)、57930 (Strix Halo)；另有 56255 OSRR
> 覆盖 Family 17h Models 00h–2Fh。Revision Guide 55449 Rev 1.21 的 Table 12 按
> Ryzen / Ryzen Threadripper 分列勘误。当代客户端勘误通过 `AMD-SB-4xxx` Client 公告序列发布，
> 其 Affected Products 表逐 SKU 印 AGESA/PI 版本；AMD-SB-4013 (2026-02) 引用
> "the corresponding **Client Revision Guide** of the product" 上的 errata #1165/#1166/#1526。
> **真正的缺口比原声明窄得多**：(1) 未找到 Family 19h/1Ah 客户端 model 范围的公开 Revision Guide；
> (2) 未找到 Matisse/Vermeer/Raphael/Strix Point 四份 PPR（56176/56214/56713/57254）的第一方副本；
> (3) 客户端公告只给 AGESA/PI 版本，不给可验证的微码 patch level。

---

## §7 缺口清单（查不到就声明，不要填塞）

1. **`fam1Ah_model24h`（Strix Point）自己的 PPR 57254 未取得第一方副本。**
   已试：docs.amd.com 文档索引 API（14,138 条记录，零命中）、`docs.amd.com/v/u/en-US/57254*` 多种 slug
   （WebFetch 返回 404）、`/content/dam/.../programmer-references/` 直链（404）、
   `/system/files/TechDocs/57254.pdf`（301 重定向到文档中心搜索页）。
   **后果：Zen 5c 核上 `Fn80000026_EBX[27:24] NativeModelId` 的 ValidValues 表未经直接核对。**
   本文 §2.2 用的是 57930（model 70h，纯 Zen 5）的定义。`GAP`
2. **`fam1Ah_model44h`（Granite Ridge）的 PPR 57896 同样未取得第一方副本。**
   后果：§3.3 那条"AVIC/x2AVIC 是全表仅有的不带 `Fixed` 的两位"是在 model 70h 的 PPR 上验证的，
   **未在 model 44h 上直接验证**，而 §3.2 的实测对照组恰好是 model 44h。`GAP`
3. **同样未找到第一方副本的客户端 PPR**：54945 (Summit Ridge)、55570 (Picasso)、56176 (Matisse)、
   56214 (Vermeer)、56713 (Raphael)。搜索引擎索引到过 amd.com 上的真实标题
   （如 `.../tech-docs/processor-programming-reference-ppr-for-amd-family-17h-model-71h-revision-b0`），
   说明它们曾经第一方托管。**注意：`https://www.amd.com/en/support/tech-docs/<slug>` 是一个
   catch-all SPA 路由，对任意字符串都返回 HTTP 200，不能当作存在性证据**（本次已验证并弃用该方法）。`GAP`
4. **"Client Revision Guide" 的出版编号与公开副本未找到。** AMD 在 SB-4013 里点名引用它并给出
   errata #1165 / #1166 / #1526，但这三个号不在已核对的 55449（≤#1488）、56683、58251、58730 里。`GAP`
5. **AMD 文档中心的 Coveo 搜索索引无法查询**（org `xilinxcomprode2rjoqok`，
   searchHub `tech-docs-hub-sh`，页面内匿名 token `xxa724b833-…` 查询恒返回 `totalCount: 0`）。
   若能查通，§7.1–7.4 的几条缺口很可能一次补齐。**这是一条值得单独立 ticket 的工具性缺口。** `GAP`
6. **`Fn8000_000A_EDX` bit 11 在 APM Rev 3.38 和 PPR 57930 里都标 Reserved，但在
   Zen 1 到 Zen 5 的每一个实测件上都读 1。** 没有找到任何命名它的文档。
   实务上的含义是明确的（软件必须屏蔽保留位），但**它到底是什么，查不到**。`GAP`
7. **Zen 5c 的频率上限没有第一方数值来源。** ticket 描述里写的"~4 GHz"未能在 AMD 文档中找到；
   CPUID 只给 cache 拓扑，不给频率。本文因此**只用实测的 L3/CCX 差异描述两种核的区别，
   不引用任何频率数字**。`GAP`
8. **未做的实测**：VMCB 行为、`#VMEXIT` 时序、ASID 分配在 Zen 5 / Zen 5c 上的差异。
   §2.5 的结论只覆盖 CPUID 报告面。本机（Granite Ridge）**没有 Zen 5c 核**，
   §2 的混合结论**全部未在金属上验证**。`GAP`
8b. **Zen 4 客户端 virtualized VMLOAD/VMSAVE 缺陷没有 AMD 勘误号、没有 AMD 公告。**
   （§4.4）全部公开记录 = 内核 commit `a5ca1dc46a6b` + `bugzilla.kernel.org/show_bug.cgi?id=219009`。
   本次**未能**在任何 AMD-SB 公告或 Revision Guide 中找到对应条目。
   该缺陷与 CVE-2024-53114 的对应关系**未经第一方核实**（web search 预算耗尽，见 §7.11）。`GAP`
8c. **Hyper-V 是否使用 AVIC，未确立。** 未找到任何 Microsoft 文档说明 Hyper-V 在 AMD 上是否
   使用 AVIC/x2AVIC。可验证的只有反向关系：KVM 必须为使用 Hyper-V SynIC/AutoEOI 的 guest 关闭 AVIC
   （`APICV_INHIBIT_REASON_HYPERV` ∈ `AVIC_REQUIRED_APICV_INHIBITS`，`svm.h:935`）。
   **这是一条负面缺口，不是负面结论**——本技能面向 Windows PC，这条应单独立 ticket。`GAP`
8d. **`MSR_AMD64_CPUID_FN_7` 的 MSR 地址未在本次读到的头文件中定位到**
   （`msr-index.h` 无该符号，可能已移入 `asm/msr.h` 或新头）。用法确凿
   （`amd.c:991,1049` 两处 `msr_clear_bit(MSR_AMD64_CPUID_FN_7, 18)`），但**地址值未取得**。`GAP`
9. **Krackan Point（`fam1Ah_model60h`，也是 Zen 5 + Zen 5c）未做逐核 CPUID diff**，
   只取到单核视角。样本量 = 1 个混合 model 的 3 台机器。`GAP`
10. **AGESA 正式规范 44065 (Rev 3.04, 2017) 的正文未取回**；
    `ComboAM4PI` / `ComboAM5PI` 命名方案**没有任何 AMD 文档定义**，所有解释均为第三方。`GAP`
11. **本次会话的 WebSearch 预算已用尽（200/200）。** 以下三项因此未完成，需由后续 session 接手：
    (a) CVE-2024-53114 ↔ commit `a5ca1dc46a6b` 的对应关系；
    (b) AMD 是否有命名 x2AVIC 首发世代的营销/博客文档（目前"Zen 4 首发"由 AMD 员工提交的内核
    commit `ca2967de5a5b` 的 commit message 加实测 CPUID 两条共同支撑，**不是** AMD 产品页）；
    (c) Hyper-V 的 AVIC 使用情况（见 7.8c）。`GAP`

---

## §8 来源

**AMD 第一方文档**
- PPR for AMD Family 1Ah Model 70h, Revision A0 Processors, Pub 57930, Rev 3.00, 2025-04-30 —
  `https://docs.amd.com/v/u/en-US/57930-A0-PUB_3.00` ·
  内容 `https://docs.amd.com/api/khub/documents/fEY1GkRkcoEhenFftZyr8Q/content`（**本次已下载**）
- PPR 55772-A1 (Dali) `…/ukL~Q~GmC1JQf3xYKn~Nmw/content` · PPR 55922-A1 (Renoir) `…/DFHNcOJsT9chiUCoYP_T9w/content` ·
  PPR 56569-A1 (Cezanne) `…/pl6ZFPOSOcLQBUlgPjv3jw/content` · PPR 57019 (Phoenix) `…/wLoiR_d0cHMr4pft_4FHGA/content` ·
  PPR 55803 (Castle Peak) `…/oWGePLWshQVJC~bQ63RRUg/content`
- OSRR for AMD Family 17h Models 00h–2Fh, Pub 56255, Rev 3.03 —
  `https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/56255_OSRR.pdf`
- Revision Guide 55449 Rev 1.21, 2023-08 (Fam 17h 00h-0Fh, 含 Ryzen/Threadripper 段；**erratum 1235 在 p.87**)
  `…/abOrVU_gcO7ZsC3qDF4uNQ/content` · Revision Guide 56323 Rev 1.03, 2026-02 (Fam 17h 30h-3Fh; erratum 1235 在 p.39)
  `…/V2_PYRjhtUCkuQy_LbO5Zg/content`
- APM Vol.2, Pub **24593**, Rev **3.45**, 2026-07, §15.29.7 / §15.29.10（AVIC 与 x2AVIC 的 CPUID 位定义）·
  APM Vol.3, Pub **24594**, Rev **3.38**, 2026-07, App. E §E.4.9（`Fn8000_000A` 全表）·
  **Pub 25481 "CPUID Specification" 已作废**，其封面自述内容已并入 APM Vol.3 附录
- Revision Guide 56683 / 58251 / 58730 —
  `https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/revision-guides/{56683,58251,58730}.pdf`（**本次已下载并提取封面**）
- 安全公告：AMD-SB-7008 / 7005 / 7029 / 7033 / 7052 / 7059 / 4008 / 4012 / 4013 / 4017 —
  `https://www.amd.com/en/resources/product-security/bulletin/amd-sb-<id>.html`；索引
  `https://www.amd.com/en/resources/product-security.html`
- Technical Update Regarding Speculative Return Stack Overflow, Rev 2.0, 2024-02 —
  `https://www.amd.com/content/dam/amd/en/documents/corporate/cr/speculative-return-stack-overflow-whitepaper.pdf`
- Technical Guidance for Mitigating Transient Scheduler Attacks, Rev 2.0, 2025-07 —
  `https://www.amd.com/content/dam/amd/en/documents/resources/bulletin/technical-guidance-for-mitigating-transient-scheduler-attacks.pdf`
- `linux-firmware` `amd-ucode/README` — `https://gitlab.com/kernel-firmware/linux-firmware/-/raw/main/amd-ucode/README`

**Linux mainline**（torvalds/linux, v7.3-rc4/rc5, 经 `git.kernel.org/…/plain/<path>` 取原始文件）
- `arch/x86/kernel/cpu/amd.c:383-385`（`ZEN_MODEL_STEP_UCODE`）、`:387-405`（TSA 微码表）、
  `:478-531`（Zen 世代 family/model 映射）、`:881-904`（erratum 1386）、`:957-980`（Zenbleed）、
  `:982-999`（`init_amd_zen2`：Cyan Skillfish RDSEED、无条件清 `INVLPGB`）、
  `:1015-1030`（**Zen 4 客户端 V_VMSAVE_VMLOAD clear**）、`:1032-1052`（Zen 5 RDSEED 微码表）、`:1427`（AGESA DMI）
- `arch/x86/kvm/svm/avic.c:68-107`（三态 `avic` 参数）、`:1228-1238`、`:1257-1336`
  （`avic_want_avic_enabled()` / `avic_hardware_setup()`，erratum 1235）·
  `arch/x86/kvm/svm/svm.h:931-946`（`AVIC_REQUIRED_APICV_INHIBITS`）· `arch/x86/kvm/svm/svm.c:158,177,5713-5750`
- commit `a5ca1dc46a6b610dd4627d8b633d6c84f9724ef0`（Mario Limonciello (AMD), 2024-11-05,
  "x86/CPU/AMD: Clear virtualized VMLOAD/VMSAVE on Zen4 client",
  `https://bugzilla.kernel.org/show_bug.cgi?id=219009`）·
  commit `ca2967de5a5b`（v6.18，AVIC 默认翻转）· commit `8de4a1c8164e`（v6.17，erratum 1235 关 IPIv）·
  commit `9a12fa5213cf`（v7.1，Hygon 18h，CVE-2026-64172）· commit `aae99a7c9ab3`（v6.0，x2AVIC CPUID 位）·
  commit `3aba0b40cacd`（v6.15，`AMD_HTR_CORES` 改名）· commit `1ad466706671`（v6.13，异构核 flag）
- `arch/x86/kernel/cpu/topology_amd.c:63-127, 178-183` · `topology_common.c:35-66, 162-181`
- `arch/x86/kernel/cpu/scattered.c:70` · `arch/x86/include/asm/processor.h:71-78, 110-130`
- `arch/x86/include/asm/topology.h:117-121` · `arch/x86/include/asm/cpufeatures.h:77,78,221,316-319,444,512`
- `arch/x86/include/asm/msr-index.h:680,683` · `arch/x86/kernel/cpu/match.c:56,64-72`
- `arch/x86/kernel/cpu/cacheinfo.c:44-57, 239-253, 293-341, 512-518` · `drivers/hwmon/k10temp.c:478-534`

**真机 CPUID dump**（InstLatx64, `github.com/InstLatx64/InstLatx64`, `AuthenticAMD/`）
本文使用 34 份 `*_CPUID.txt`，覆盖 `fam17h` 14 个 model、`fam19h` 9 个 model、`fam1Ah` 6 个 model。
关键几份：`AuthenticAMD0B20F40_K20_StrixPoint_06_CPUID.txt`（HX 370，24 LP 逐核 + P/E 标注）、
`…_07_CPUID.txt`（AI 7 PRO 360，含 MSR 段）、`AuthenticAMD0B40F40_K20_GraniteRidge_{02,03,04,06}_CPUID.txt`、
`AuthenticAMD0A70F80_K19_Phoenix2_01_CPUID.txt`、`AuthenticAMD0A70F52_K19_{Phoenix,HawkPoint}_01_CPUID.txt`。

**本机实测**
AMD Ryzen 9 9950X3D · `fam1Ah_model44h` st0 · CPUID sig `00B40F40` · microcode `0x0B404035` ·
BIOS AMI `F12a` (2026-03-11) · Windows 11 Pro 26200 · 2026-09-26。

**语料库内部交叉引用**（本文确认而非推翻的既有结论）
`amd-virtualization/references/01-svm-intro.md:94-131`（`Fn8000_000A_EDX` 全表）·
`07-virtual-interrupts-avic.md:340-341`（客户端 AVIC 只能靠 CPUID）·
`90-dated-landscape.md:46-57`（EPYC 表，本文沿用其键格式）·`:82-84`（客户端只有 SME）·
`:254-289`（AVIC 默认开关史，带 commit 号）·`17-security.md:73-74`（Zenbleed/SRSO 的 AGESA 版本）
