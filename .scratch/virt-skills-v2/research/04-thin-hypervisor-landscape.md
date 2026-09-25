# 04 开源 thin hypervisor 参考实现现状调研

Ticket: `.scratch/virt-skills-v2/issues/04-thin-hypervisor-landscape.md`
Type: research
调研日期: 2026-09-26
调研方式: 纯网络只读。未克隆任何仓库，未执行任何 git 命令。

## 证据纪律声明

- 每条项目状态claim 都带 URL + 具体文件/issue 编号 + 日期。
- **负面 claim（"项目 X 已不维护"）一律给日期戳来源**，不用"看起来很久没动"之类的推断。
- 本环境**无法直连 `learn.microsoft.com` 与 `techcommunity.microsoft.com`**（WebFetch 全部返回 `Socket is closed`）。
  这与 `README.md:200-204` 记录的既有情况一致。凡是只能通过搜索结果摘录得到的微软原文，
  在正文中标注为 `[MS-间接]`，**在写入 v2 正文之前必须重新直连核对**。
  可直连拿到原文的微软文档（GitHub 上的 docs 源码仓库）标注为 `[MS-直连]`。
- 凡是我没有找到证据的地方，写"未找到"并说明搜了什么，而不是留白或猜测。

---

## 0. 结论摘要

1. **今天还能站的肩膀只有三副半**：`tandasat/barevisor`（MIT，2026-08-02，**唯一同时覆盖 Intel+AMD 且同时覆盖 Windows 驱动+UEFI 的在维护项目**）、
   `ionescu007/SimpleVisor`（BSD-2-Clause，2024-05-08，最小结构范本）、
   `tandasat/SimpleSvm`（MIT，2025-03-03，AMD 侧 C 语言范本）。
   "半副"是 `HyperDbg/HyperDbg`——活跃度最高、工程完整度最高，但 **GPL-3.0，代码一行都不能进本仓库**，只能读和引。
2. **经典四件套里有三件已经死了或不能用**：`HyperPlatform` 已于 **2026-05-18 被作者归档**；
   `hvpp` 最后一次 push 是 **2021-03-15**；`Bareflank/hypervisor` 的 `LICENSE.md` 里写的版权人是
   **mkdocs-material 的作者 Martin Donath**，与源码头部的 Assured Information Security 不一致，
   GitHub 因此判定为 `NOASSERTION`——**许可证元数据有缺陷，在澄清之前不得 vendor**。
3. **现代硬件上确实会坏，而且坏法是按型号的**。最硬的一条证据：Linux 内核 commit
   `a5ca1dc46a6b`（2024-11-05）——**一批 Zen 4 客户端 SoC 声称支持 virtualized VMLOAD/VMSAVE，
   实际使用会导致随机重启**，内核的修法是直接把这个能力位清掉。
   这直接证明 ticket 09 的"按型号查"轨道有真实价值，且**必须带微码/AGESA 维度**。
4. **可编译骨架代码可以发**，但理由不是"教程是 MIT 所以能抄"，而是"**骨架的形状由 ISA 决定，不由作者决定，自己写就行**"。
   见 §6。
5. **现代 Windows 上最大的障碍不是 PatchGuard，也不是 HVCI，是 Hyper-V 已经占着 root**，
   而且这道墙从 **2026 年 10 月起会自动扩张到更多机器**（微软将通过质量更新自动打开 Memory Integrity）。

---

## 1. 项目对照表

### 1.1 主表

| 项目 | 目标形态 | 厂商 | 语言 | 许可证 | 最后 push | 状态（日期戳） |
|---|---|---|---|---|---|---|
| [`tandasat/barevisor`](https://github.com/tandasat/barevisor) | **Windows 驱动 + UEFI**（共享 OS-agnostic core） | **Intel + AMD** | Rust + `.S` | **MIT** | **2026-08-02** | 活跃，未归档 |
| [`HyperDbg/HyperDbg`](https://github.com/HyperDbg/HyperDbg) | Windows 驱动（调试器产品） | **Intel only** | C | **GPL-3.0** | **2026-09-22** | 最活跃；4084 stars |
| [`SinaKarvandi/Hypervisor-From-Scratch`](https://github.com/SinaKarvandi/Hypervisor-From-Scratch) | Windows 驱动（教程） | Intel only | C | **MIT** | **2026-05-13** | 仍在更新 |
| [`Zero-Tang/NoirVisor`](https://github.com/Zero-Tang/NoirVisor) | Windows 驱动（XP+）；UEFI / 裸机移植中 | **Intel + AMD**（另称覆盖 VIA/Zhaoxin/Hygon） | C（Rust 重写中） | **MIT** | **2026-09-20** | 活跃 |
| [`ionescu007/SimpleVisor`](https://github.com/ionescu007/SimpleVisor) | **Windows 驱动 + UEFI**（`nt/` 与 `uefi/` 两个后端） | Intel only | C + 10 行 asm | **BSD-2-Clause**（见 §1.2 注 A） | **2024-05-08** | 未归档，但停滞 |
| [`tandasat/MiniVisorPkg`](https://github.com/tandasat/MiniVisorPkg) | **UEFI**（可引导 OS） | Intel（未见 AMD 声明） | C | **MIT** | **2024-08-15** | 未归档，停滞 |
| [`tandasat/SimpleSvm`](https://github.com/tandasat/SimpleSvm) | Windows 驱动 | **AMD only** | C++ | **MIT** | **2025-03-03** | 未归档 |
| [`tandasat/SimpleSvmHook`](https://github.com/tandasat/SimpleSvmHook) | Windows 驱动 | **AMD only** | C++ | **MIT** | **2021-02-18** | 未归档，停滞 |
| [`tandasat/Hypervisor-101-in-Rust`](https://github.com/tandasat/Hypervisor-101-in-Rust) | 裸机 / fuzzing 课程 | **Intel + AMD** | Rust | **MIT** | **2025-09-27** | 课程材料 |
| [`wbenny/hvpp`](https://github.com/wbenny/hvpp) | Windows 驱动 | Intel only | C++ | **MIT** | **2021-03-15** | 未归档但 4 年半无提交 |
| [`Bareflank/hypervisor`](https://github.com/Bareflank/hypervisor) | Windows / Linux / UEFI（SDK） | Intel + AMD（宣称） | C++ | **元数据缺陷**（见 §1.2 注 B） | **2024-08-14** | README 把"完整功能"指向 MicroV |
| [`Bareflank/MicroV`](https://github.com/Bareflank/MicroV) | micro-VM | Intel + AMD（宣称） | C++ | MIT（README 声明） | — | README 仍写 "expected to be some time Q1 of 2022" |
| [`asamy/ksm`](https://github.com/asamy/ksm) | Windows + Linux 驱动 | Intel only | C | **GPL-2.0** | **2021-10-20** | 停滞 + 许可证不可用 |
| [`Gbps/gbhv`](https://github.com/Gbps/gbhv) | Windows 驱动（EPT hooking） | Intel only | C | **CC-BY-4.0**（见 §1.2 注 C） | **2023-04-24** | 停滞 + 许可证不适用于代码 |
| [`Air14/airhv`](https://github.com/Air14/airhv) | Windows 驱动 | Intel only | C++ | MIT | **2023-12-10** | 停滞 |
| [`memN0ps/illusion-rs`](https://github.com/memN0ps/illusion-rs) | **UEFI** Type-1 | Intel only（README 明确 ❌ AMD） | Rust | MIT | 2026-05-14 | **已归档 2026-05-14** |
| [`memN0ps/matrix-rs`](https://github.com/memN0ps/matrix-rs) | Windows 驱动 Type-2 | Intel only | Rust | MIT | 2026-05-14 | **已归档** |
| [`tandasat/HyperPlatform`](https://github.com/tandasat/HyperPlatform) | Windows 驱动（VM-exit 过滤平台） | Intel only | C++ | **MIT** | 2023-11-24 | **已归档 2026-05-18** |

所有 `pushed_at` / `archived` / `license.spdx_id` 取自 GitHub REST API `/repos/{owner}/{name}`，读取时间 2026-09-26。
归档日期取自仓库页面横幅原文。

### 1.2 逐项注解（这几条会直接影响 §6）

**注 A — `SimpleVisor` 没有 LICENSE 文件。**
`GET /repos/ionescu007/SimpleVisor/contents/` 返回的根目录只有
`.gitattributes .gitignore README.md ntint.h shv.c shv.h shv.sln shv.vcxproj shv_x.h shvutil.c shvvmx.c shvvmxhv.c shvvmxhvx64.asm shvvp.c vmx.h` 加 `nt/` `uefi/` 两个目录——
**没有 LICENSE / COPYING**，所以 GitHub 的 `license.spdx_id` 是 `null`。
许可证条款只存在于 `README.md`，原文："Copyright 2016 Alex Ionescu. All rights reserved.
Redistribution and use in source and binary forms, with or without modification, are permitted
provided that the following conditions are met: 1. Redistributions of source code must retain
the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice..."
——两条条件，即 **BSD-2-Clause**。
源文件头（`shv.c`）只有 `Copyright (c) Alex Ionescu. All rights reserved.`，不含授权文字。
**后果**：如果 v2 要引用它的任何一行，条款必须从 `README.md` 抄进第三方声明，不能指望源文件头。

**注 B — `Bareflank/hypervisor` 的许可证元数据是坏的。**
`LICENSE.md`（1100 bytes）正文是 MIT，但版权行写的是 **"Copyright © 2016 - 2019 Martin Donath"**
——那是 mkdocs-material 主题的作者，不是 Bareflank 的。
而源码头（`kernel/src/main.cpp`）写的是 **"Copyright (C) 2020 Assured Information Security, Inc."** + MIT 全文，
**且没有 SPDX-License-Identifier 行**。README 里则写 "The Bareflank Hypervisor is licensed under the MIT License."
GitHub 因此把 `license.spdx_id` 判为 `NOASSERTION`。三处不一致，读取时间 2026-09-26。
**后果：实质上是 MIT，但在上游澄清之前不要 vendor。只引用、只描述。**

**注 C — `Gbps/gbhv` 是 CC-BY-4.0。**
这是一个**不适用于软件**的许可证。FSF 的许可证清单对 CC BY 4.0 的原话是
"like all CC licenses, it *should not be used on software*"。
ASF 的第三方许可证政策把 CC-BY 2.5/3.0/4.0 列为 Category B，并要求
"only include them in binary form"。**结论：只能引用，不能抄进源码树。**

**注 D — `HyperPlatform` 归档横幅原文**：
"This repository was archived by the owner on May 18, 2026. It is now read-only."
这是"项目 X 已不维护"这条负面 claim 的日期戳来源。

**注 E — `illusion-rs` 归档横幅原文**：
"This repository was archived by the owner on May 14, 2026. It is now read-only."
README 里对能力的自述是逐条打勾/打叉的，其中
"❌ AMD processors with AMD-V (SVM) and Nested Page Tables (NPT) support"、
"❌ Support for running as a nested hypervisor under Microsoft Hyper-V (Type-2)"、
"❌ Support for running ... on top of Microsoft Hyper-V (Type-1) with Virtualization Based Security (VBS) Enabled"。

**注 F — `Hypervisor-From-Scratch` 自己承认早期章节是坏的。**
README 原话："hypervisors change over time because new features are added to the operating systems
or using new technologies"，并要求实际项目"use the driver from the latest parts"，
因为 "earlier parts keep untouched" 会遇到 "errors and instability problems"。
系列 Part 8 首发 2020-03-24，整套教程在 **2022 年 8 月做过一次全面改写**。
**这条对 v2 极其重要**：一个 AI 去读 Part 2–5 的代码，读到的是作者本人声明已知有问题的版本。

**注 G — 没找到的东西。**
- 未找到任何**仍在维护的、AMD-only 的、C/C++ 的 Windows 驱动型 thin hypervisor**。
  AMD 侧目前唯一的活体是 `barevisor`（Rust）和 `NoirVisor`（C，双厂商）。
  `SimpleSvm`（2025-03-03）与 `SimpleSvmHook`（2021-02-18）都未归档但也不能算活跃。
- 未找到 `SimpleVisor` / `hvpp` / `HyperPlatform` 任何一个的官方"停止维护"声明。
  它们的状态只能由 `pushed_at` 和归档位来陈述，本文即如此陈述。

---

## 2. 能不能在现代硬件上跑

这一节直接回答 ticket 09 的"按型号查有没有实际价值"。**答案是有，而且不止 CPU 型号一维。**

### 2.1 Intel 12 代混合核

**规范层面的根因，有 Intel 第一方原文：**
Intel 的 12th Gen Core 开发者指南对 CPUID 的原话是
**"CPUID, by design, returns different values depending on the core it is executed on."**
并要求 "When checking **Core Type** you should momentarily 'pin' the target logical processor"。
Core Type 从 `CPUID.1AH` 的 EAX[31:24] 读，`20H` = Intel Atom（E-core），`40H` = Intel Core（P-core）；
hybrid 标志在 `CPUID.07H:EDX[15]`。
来源：<https://www.intel.com/content/www/us/en/developer/articles/guide/12th-gen-intel-core-processor-gamedev-guide.html>

**Intel SDM 早就要求逐处理器检查，不是混合核时代才新增的：**
SDM Vol.3C §31.8.1 "Initialization"（较新修订里编号为 §32.8.1，同一节；
本次通过 SDM 正文镜像页确认相邻小节为 §31.8.2 "Moving a VMCS Between Processors"、
§31.8.5 "CPUID Emulation"）原文：
**"Before enabling VMX, an MP-aware VMM must check to make sure that all processors in the system
are compatible and support features required."**
并要求逐 logical processor 检查 CPUID、VMCS revision identifier、
以及 VMX capability MSR 的 allowed-0 / allowed-1 字段。

**Intel 自己的工具也踩过"探一个核套用全部"这个坑：**
`intel/intel-cmt-cat` wiki 的 "Hybrid architectures" 页（最后编辑 **2024-05-09**）原文：
"Linux and pqos tool utilize CPUID to discover the capacity bitmask length, however it
**does not account for different CBM lengths based on core type**."
具体后果是在 i9-12900E 上把 E-core 的 L2 CBM 按 16 路（`0xFFFF`）编程，而实际是 10 路（`0x3FF`）。
**这是 RDT/CAT，不是 VMX**——引用它是为了说明这个 bug 类别真实存在，不要当成 VMX 结论。
另一条同类：`pytorch/cpuinfo` PR #350（**2025-11-21**，open）引 Intel 原文，并补出具体清单：
"In particular, **leaves 1, 4, 0x0b, 0x1a, and 0x1f are known to vary by core**."
以及 LWN 上 Ricardo Neri（Intel）的混合核补丁说明（**2020-10-02**）：
"A hybrid part has CPUs with more than one type of micro-architecture. Thus,
**certain features may only be present in a specific CPU type**."

**工业级的失败演示：VMware ESXi 在 Alder Lake 上 PSOD，而且失败的正是拓扑检查。**
virten.net（**2022-11-27**）记录的 PSOD 原文串：
"HW feature incompatibility detected; cannot start" /
**"Fatal CPU mismatch on feature 'Hyperthreads per core'"** /
**"Fatal CPU mismatch on feature 'Cores per package'"** /
"Fatal CPU mismatch on feature 'Cores per die'"。
绕法 `cpuUniformityHardCheckPanic=FALSE`。
Broadcom KB **395554** 的原因说明："Starting with ESXi 7.0, a CPU uniformity check is enforced.
A PSOD may occur if a mismatch in CPU features is detected."（该 KB 页面未渲染出更新日期，按无日期处理。）
13 代还额外需要 `ignoreMsrFaults=TRUE`，否则开机 VM 时 PSOD "GP Exception 13 in world"
（williamlam.com，**2023-04-22**；该站返回 HTTP 403，日期与内容由 virten.net 交叉确认，`[Tier-2]`）。
**注意被点名的失配项是 "Hyperthreads per core" 与 "Cores per package"**
——也就是"软件假设了统一的 SMT/拓扑比例"这一类，这同时也关系到 §2.2。

**真正由混合核引起、且有代码修复的 hypervisor 缺陷，只找到一条，但它非常关键：**
`Zero-Tang/NoirVisor` issue **#35**，标题
"Splitting a 2MiB page into 512 4KiB pages degrades system performance on hybrid CPUs
(Intel 12th Gen and higher)"，报告人 `papstuc`，开于 **2024-09-04**，关于 **2024-09-08**。
机器 i7-14700K；对照组 i7-8700K 无此问题。报告原文：

> "each individual core has it's own L2 cache, which is not the case on hybrid CPUs with
> E-cores (**4 E-cores share one L2 cache**)"

修复结论（2024-09-08，维护者 `Zero-Tang` 当日确认）：

> "Finally fixed this issue. It works when having **one global EPT paging structure that is
> shared across all cores**. I guess having one for each core is just not really cache-friendly
> when having a shared cache across cores."

**这条对 v2 的价值在于：被惩罚的不是某个 bug，是"每个逻辑处理器一份 EPT/NPT 层次"这个设计习惯本身**
——而这恰好是几乎所有参考实现的默认写法。见 §4 的 T15。

**也有正面数据点：**
`ionescu007/SimpleVisor` PR **#49**（**2022-07-16**，至今 open，14 👍）自述
"Full support for booting windows in UEFI environment on multi core.
**Tested on Windows 21H2 on Intel 4th and 12th generation**."——但 PR 里没有任何混合核专门处理。
`tandasat/barevisor` 的 "Supported hardware models" 只列两块板：Intel **PICO-MTU4-SEMI**（Meteor Lake，本身就是混合部件）
与 AMD **LLM1v6SQ**。**即最新的那个项目把混合核 SKU 当作一等支持平台。**

**另有两条"thin hypervisor 在 12/13 代上坏了但从未被诊断出来"的开放记录：**
- `tandasat/MiniVisorPkg` issue **#11**（**2023-02-15**，**至今 open**）：报告人从 i7-10900K 换到 **i9-13900K** 后，
  基于 MiniVisorPkg 的引擎停止工作，失败在 `EnableHypervisor` 期间的 `HandleHostException`，
  **所有核都失败**，`InterruptNumber 0x6C`——报告人称其
  "**undocumented, reserved as far as I can tell**"，错误码 `0x0`，`CR2 = 0`。
- `tandasat/MiniVisorPkg` issue **#12**（**2023-05-17**，open，**i9-12900KS**）：
  `ExitBootServicesHandler` 之后崩溃，"crash only occurs when allocating more than one core…
  using a single core works without issues"。同形状的还有 **#15**（2024-07-15，open，未指明 CPU）。
  **必须如实说明**：#12 的上下文是 Hyper-V VM 的 vCPU 数量，读起来更像 AP bring-up 的 SMP bug，
  **不能当作已证实的 P-core/E-core 非对称 bug**。
  反方向的一条是 **#21**（**2026-08-24**，已关闭）："MiniVisor not working when HyperThreading is enabled
  on **Haswell-E**"——在 Ivy Bridge 上开 HT 正常。怀疑点在 `HandleInitSignal` / `HandleStartupIpi`。

**一条必须写清楚的负面结论：**
**没有找到任何来源——厂商、内核或仓库——证明 VMX capability MSR
（`IA32_VMX_BASIC` / `IA32_VMX_PROCBASED_CTLS` 等）在任何已出货型号上真的在 P-core 与 E-core 之间不同。**
搜索范围：13 个参考仓库的全量 issue+PR 枚举，加 KVM/Xen/QEMU 邮件列表。
**所以"混合核上 VMX 能力位会不一样"这句话目前是无来源的推测，v2 不得写成 claim。**
能写成 claim 的只有两条：SDM §31.8.1 **要求**逐 LP 检查（规范要求，不是观测），
以及 CPUID 的若干 leaf 确实逐核不同（Intel 原文 + cpuinfo PR #350 的 leaf 清单）。

在 13 个参考项目的 issue 里，**没有任何一条把失败归因于 P/E 非对称或 `CPUID.1AH`**。
HyperDbg 全文搜 `alder lake|raptor lake|e-core|hybrid|12th gen` 只有 2 条命中，都是误报；
其 CHANGELOG 从 v0.1.0.0（2022-05-31）到 v0.24.0.0（2026-09-22）零条混合核相关条目。
**这条负面结论的正确读法是"这些项目的用户太少，不是没问题"**
——规范要求（§31.8.1）、Intel 自家工具的同类 bug、ESXi 的拓扑检查崩溃、NoirVisor #35 的缓存回归，四条都摆在那里。

### 2.2 Arrow Lake / Core Ultra 200S（无超线程）

**结论先写：这条假设目前没有证据支持。**
在 13 个参考仓库的全量 issue+PR，以及 KVM / Xen / QEMU 邮件列表里，
搜 `Arrow Lake`、`Core Ultra`、`200S`、`285K`、`265K`、`245K`、`Lion Cove`、`Skymont`、
`no hyperthreading`、`SMT`、`logical processors per core`——**全部零命中**。
**没有一条报告说 hypervisor 代码因为"假设每核 2 个逻辑处理器"或"假设 SMT 存在"而失败。**
（唯一与 HT 相关的是 MiniVisorPkg #21，方向相反：Haswell-E 上**开启** HT 才坏。）

**离得最近的真实事件，恰恰反证了 SMT 假说：**
Intel 官方 "Field Update 1 of 2: Intel Core Ultra 200S Series Performance Status"（**2024-12-18**）
列出的五项根因之一是 "BSODs when attempting to launch game titles utilizing the Easy Anti-Cheat service"
——EAC 正是一个 hypervisor 支撑的反作弊。**Intel 给出的根因原文是：**

> "A known issue between **Windows 11 24H2 and the April 2024 (or older) Easy Anti-Cheat driver**
> bundled with PC games."

修复方式是 Epic 分发更新后的 EAC 驱动，**不是微码，也不是 VMX 修正**。
即：Arrow Lake 上确实有 hypervisor 相邻驱动蓝屏，但厂商把它归因于
**OS 版本 × 驱动版本的交互**，不是缺少 SMT，也不是 VMX/EPT 行为变化。
相关用户串（HTTP 403，仅片段级）：ASUS ROG 论坛 1053629
"ASUS Z890-F + Intel Ultra 7 265k HYPERVISOR_ERROR 20001 only when [EAC titles]"，标记已解决。
`HYPERVISOR_ERROR`（bugcheck `0x20001`）是 **Windows 自己的 hypervisor** 崩溃，不是第三方驱动崩溃。
**Intel 官方页面本次返回 HTTP 403，日期与原文由 thefpsreview.com（2024-12-18）交叉确认，标 `[Tier-2]`。**
用户手上正是 265KF，**这条可以而且应该在真机上复现验证**（对应 ticket 09 的真机条款）。

**Arrow Lake 与虚拟化相关、但与本题无关的两条（列出以免后人误引）：**
- `tempered-steel/proxmox-arrowlake-iommu-incident`（事件日期 **2026-03-17**，约 7.5 小时中断）：
  Core Ultra 9 **285H**（family 6, model 197, stepping 2），Proxmox VE，Linux **6.17.13** 的 DMAR/IOMMU 回归，
  PTE 访问违例（reason `0x05` 写 / `0x06` 读）。
  **报告明确指向 DMAR/Xe2-LPG 初始化竞态，全文未提 HT、SMT 或核数假设。**
- VMX preemption timer 勘误：KVM 补丁集 "[PATCH v7 0/2] KVM: VMX: Workaround VMX preemption timer erratum"
  （Sean Christopherson，**2026-07-31**）原文：
  "Due to a widespread Intel erratum (e.g. **EMR158**), programming the VMX preemption timer with certain
  large values may cause the timer to expire earlier than expected. The recommended workaround is to cap
  the timer value to strictly less than `2^25 * CPUID.15H:EBX[31:0] / CPUID.15H:EAX[31:0]`."
  **该 cover letter 没有点名任何客户端微架构**（Arrow / Alder / Raptor 均未出现），
  **不要把它归给 Arrow Lake**。对照：`SimpleVisor` issue **#42**（2019-10-19）报告过
  "VM exit #52 timing inaccuracy" 与 "random Windows restarts"。
  凡是用 preemption timer 的骨架都受这条约束。

**总结：Arrow Lake 上"第三方 thin hypervisor 因无 SMT 而失败"——无证据，不得写。
"Arrow Lake + 虚拟化 = 有公开故障报告"——有证据，但已知根因是 OS/驱动版本，不是硅。**

### 2.3 AMD Zen 4 / Zen 5

**这是本次调研里最硬的一条现代硅证据，而且它正好落在"骨架代码会踩的坑"上。**

Linux 内核 commit **`a5ca1dc46a6b610dd4627d8b633d6c84f9724ef0`**，
标题 `x86/CPU/AMD: Clear virtualized VMLOAD/VMSAVE on Zen4 client`，
作者 Mario Limonciello（AMD），committer Borislav Petkov（AMD），**2024-11-05** 合入 `x86/urgent`，
并 Cc `stable@`。提交信息原文：

> "A number of Zen4 client SoCs advertise the ability to use virtualized
> VMLOAD/VMSAVE, but using these instructions is reported to be a cause
> of a random host reboot.
>
> These instructions aren't intended to be advertised on Zen4 client
> so clear the capability."

代码注释原文："These Zen4 SoCs advertise support for virtualized VMLOAD/VMSAVE
in some BIOS versions but they can lead to random host reboots."
**影响的 `x86_model` 范围是 `0x18`–`0x1f` 与 `0x60`–`0x7f`**；随 **Linux 6.12**（2024-11-17）发布；
登记为 **CVE-2024-53114**。
关联 bug：<https://bugzilla.kernel.org/show_bug.cgi?id=219009>
邮件列表原文：<https://lkml.indiana.edu/hypermail/linux/kernel/2411.0/06883.html>（2024-11-06）
Phoronix 报道（2024-11-17）描述症状为 "Running nested VMs on AMD Ryzen 7000/8000 (ZEN4) CPUs
results in random host's reboots. There is no kernel panic, no log entries..."，
并指出修复只针对客户端 Zen 4，EPYC 不受影响。

**商业 hypervisor 上的独立复现**：Broadcom 社区串
"Nested virtualization crash on AMD Zen4 CPUs due to VMLoad function"，首帖 **2026-05-24**，
机器 Ryzen 5 7600（Zen 4 Raphael）。原文：
"randomly crash the whole PC (power loss / reboot) after a random time interval, could be a few hours
under heavy load, or a few days if i just have one VM open"；
"Sudden reboot with no crashdump. no kernel panic, and nothing logged."
`vmware.log` 里出现 "Virtualized VMSAVE/VMLOAD"，且报告人指出**单纯做 CPUID masking 仍然会崩**。
Broadcom 员工 **2026-07-05** 回复 "Engineering team is looking into this issue and will be addressed soon"；
此后 Workstation 26H1u1 的日志里出现 "Disabling virtualized VMSAVE/VMLOAD"。

**最关键的一句**：`SimpleSvm`、`SimpleSvmHook`、`NoirVisor`、`barevisor`
**四个项目里都没有这个 model-range 规避**——
逐仓库 commit / issue 搜索无任何一条引用该勘误或 CVE-2024-53114。
也就是说，**照抄它们中任何一个的 AMD 骨架，都会在 Zen 4 客户端上随机重启。**

**对 v2 的含义（三层）：**
1. **CPUID 说支持 ≠ 可以用。** 一个"探测到能力位就打开"的骨架，在 Zen 4 客户端上会随机重启。
2. **这个差异是按 family/model **和** BIOS 版本**的**（注释原文就是 "in some BIOS versions"）。
   ticket 09 若只按 `famXXh_modelXXh` 建表，**答案会是错的**——必须带固件/AGESA 维度。
3. 这是 ticket 09 "AMD 客户端没有公开勘误通道"的一个**反例入口**：
   AMD 不发客户端 revision guide，但 AMD 自己的内核工程师会把勘误写进 Linux commit。
   **Linux 内核的 `arch/x86/kernel/cpu/amd.c` 是 AMD 客户端勘误事实上的公开通道。**

**第二条：`SimpleSvm` 在 Zen 4/5 上确实开箱蓝屏——但真实根因不是 SVM 的世代变化。**
这条必须完整讲，因为它同时是一条现代硅证据、一条骨架陷阱、和一个"相关性不是因果"的教学案例。

`tandasat/SimpleSvm` issue **#3** "BlueScreen"，报告人 `willi7758521`，开于 **2025-02-14**，关于 **2025-03-03**。
正文："Blue screen occured When loading this driver. my Cpu is 7900x"。
**2025-02-28** 在第二台机器 **Ryzen 5 7500F** 上复现。观察到的 exit code 是 `0x400`（NPF），**2025-02-22**。

报告人 **2025-02-18** 的这句话是**最容易被误引的一句**：

> "It seems that the blue screen only occured at zen4 and zen5 CPU, zen3 is run normally."

而维护者 `tandasat` **2025-02-21** 的回复直接否定了这个相关性：

> "I tried it on **Ryzen 8845HS (which is Zen4)** but could not reproduce the issue."

**真正的根因，`tandasat` 于 2025-03-02 给出：**

> "The issue is your system is configured to use **physical memory address greater than 512 GB for MMIO**.
> This is coming from `nvlddmkm`."

即 SimpleSvm 的 NPT 恒等映射构建器**忽略了 PML4 索引**，只覆盖到 512 GB。
报告人的修法（2025-03-02）是把
`translationPa = (i * 512) + j;` 改成 `translationPa = (pml4Index * 512 + i) * 512 + j;`。
经 PR **#4**（开于 2025-03-02）合入 `master`，commit **c4a479e**，**2025-03-03**
——**这也正是该仓库至今的最后一次提交。**

**如实的表述**：一个招牌级的 thin hypervisor 在 2025 年确实在 Zen 4 与 Zen 5 硅上开箱蓝屏，
花了维护者三周。但近因是**平台把 MMIO 放到了 512 GB 以上（NVIDIA GPU BAR）**，
从而暴露了 hypervisor 自己的 512 GB 恒等映射 bug——**不是 Zen 4/5 的 SVM 架构变化**。
"只有 Zen 4/5 才坏"是单个报告人的观察，已被维护者在 8845HS 上的测试推翻。
**这条进 §4 的陷阱清单（T16）。**

**其他 Zen 4/5 线索：**
- QubesOS issue #10897（2026-05-27）："I have Zen 5 / AMD 9000 series hardware, which requires Xen 4.20 or later."
  ——说明 Zen 5 在发布时并非所有 hypervisor 都开箱可用。该 issue 未说明早期 Xen 具体坏在哪。
  Xen 4.20（2025-03）确实加入了 Zen 5 支持，含 SRSO 缓解处理。
- Microsoft Q&A 上有一条 "Windows 11 25H2 (26200.8737): enabling the hypervisor causes a boot hang
  into Automatic Repair on Ryzen 5 9600X — Linux KVM works on the same hardware"。
  **本次无法直连 learn.microsoft.com 核实**，标 `[MS-间接, 待核]`。
- `tandasat/SimpleSvmHook` 的 AMD 故障报告**全部早于 Zen 3**：
  #10 Ryzen 5 3500X（2023-01-22，open）、#6 Ryzen 5 3600（2020-12-20）、
  #5 Ryzen 7 2700X（2020-09-04，open）、#2 Ryzen 3600（2019-08-31）。
  **Zen 3/4/5 的报告一条都没有**——该仓库 2021-02-18 后无提交，这更像是没有用户，而不是没有问题。
- **未找到** `barevisor` / `NoirVisor` 在 Zen 4/5 上的失败报告。

**必须纠正 ticket 里的一处前提：Zenbleed 是 Zen 2，不是 Zen 4/5。**
CVE-**2023-20593**，`VZEROUPPER` 的推测回滚缺陷，只影响 AMD Zen 2。
"Zen 4 / Zen 5 的 Zenbleed 时代微码"把两件无关的事混在了一起；
**Zen 4 上真正与 hypervisor 有关的微码故事是 §2.3 开头那条 VMLOAD/VMSAVE。**

**SRSO 的情况**：`CPUID Fn8000_0021_EAX[31]`（`SRSO_MSR_FIX`）指示软件可用 `MSR BP_CFG[BpSpecReduce]`，
KVM 于 2024-12 加入支持。**但没有任何报告显示 SRSO 相关 MSR 弄坏了上述任何一个 thin hypervisor。**

### 2.4 一个被忽略的维度：Windows 版本比 CPU 型号更常成为杀手

`tandasat/HyperPlatform` issue #90（**2022-10-17**）原文：

> "When the operating system is running at Win 10.19043 or 19044, calling the function
> EptpConstructTables to construct ept tables will generate BSOD, because
> MmGetVirtualForPhysical cannot convert the physical address corresponding to the
> NonPagedPoolNx type memory."

同一症状在 #96（2024-05-06）、#97（2024-06-24）、#98（2025-01-21）反复出现，全部 open，全部无人回复。
**"用 `MmGetVirtualForPhysical` 把物理地址转回虚拟地址来构建 EPT"是被抄得最广的一段模式之一，
而它从 Win10 19043 起就不可靠了。**

（HyperPlatform issue #99（2025-09-08）标题是 "The version after 24H2 freezes during startup"，
但正文说的是 `Airhv.sys`——那是另一个项目 `Air14/airhv`。**不能用作 HyperPlatform 的证据**，在此标注以免后人误引。）

### 2.5 对 ticket 09 的结论

按型号查**有**实际价值，但**键不能只有 CPU 型号**。证据要求至少五维：

| 维度 | 证据 | 强度 |
|---|---|---|
| CPU family/model | Zen 4 client（`x86_model` `0x18`–`0x1f`、`0x60`–`0x7f`）的 virtual VMLOAD/VMSAVE → 随机重启（Linux `a5ca1dc46a6b`，CVE-2024-53114） | **强，一手** |
| **同一 package 内的核类型与缓存拓扑** | NoirVisor #35：4 个 E-core 共享 L2 ⇒ per-core EPT 退化，需改为全核共享；ESXi 的失配项正是 "Hyperthreads per core" / "Cores per package"；Intel 官方 "CPUID ... returns different values depending on the core"；SDM §31.8.1 要求逐 LP 检查 | **强，一手** |
| **固件 / 微码 / AGESA** | Linux 注释原文 "in some BIOS versions" | **强，一手** |
| **Windows build** | HyperPlatform #90：Win10 19043 起 `MmGetVirtualForPhysical` 行为变化；Intel 把 Arrow Lake 的 EAC 蓝屏归因于 "Windows 11 24H2 和 April 2024 或更旧的 EAC 驱动" | **强** |
| **平台配置（非 CPU）** | SimpleSvm #3：真正的变量是"MMIO 是否落在 512 GB 以上"，由独立 GPU 决定，与 CPU 世代无关——报告人误判成了 Zen 4/5 | **强，且是反例** |

**最后一行是给 ticket 09 的一个警告**：一张只按 CPU 型号组织的表，
会把 SimpleSvm #3 这类故障**归档到错误的格子里**，并把"Zen 4/5 有问题"这个错误相关性固化下来。
表结构必须能表达"这不是 CPU 的问题"。

---

## 3. 最小骨架的公共部件清单（Intel / AMD 对照）

### 3.1 结构证据：两个仓库的目录布局说明了同一件事

**`tandasat/barevisor`**（`src/hvcore/src/hypervisor/`，读取于 2026-09-26）——
共享层与厂商层是干净分开的：

- 共享：`allocator.rs` `apic_id.rs` `capture_registers.S/.inc` `gdt_tss.rs` `host.rs`
  `interrupt_handlers.S/.rs` `paging_structures.rs` `panic.rs` `platform_ops.rs`
  `registers.rs` `segment.rs` `serial_logger.rs` `support.rs` `switch_stack.rs` `x86_instructions.rs`
- `intel/`：`vmx.rs`(3.4 KB) `guest.rs`(**59.7 KB**) `epts.rs`(7.0 KB) **`mtrr.rs`(11.2 KB)** `run_guest.S`(6.1 KB)
- `amd/`：`svm.rs`(0.5 KB) `guest.rs`(**29.9 KB**) `npts.rs`(2.1 KB) `run_guest.S`(5.5 KB)

两条可量化的观察：
1. **Intel 的 guest 设置代码约是 AMD 的 2 倍**（59.7 KB vs 29.9 KB），
   `epts.rs` 也是 `npts.rs` 的 3 倍多。
2. **`mtrr.rs` 只在 Intel 侧存在，AMD 侧没有对应文件。**

**`ionescu007/SimpleVisor`** 的文件切分（同一思想的 C 版本）：
`shv.c`（DriverEntry/Unload）· `shvvp.c`（per-virtual-processor）· `shvvmx.c`（VMX 设置）·
`shvvmxhv.c`（退出处理）· `shvvmxhvx64.asm`（那 10 行汇编）· `shvutil.c` ·
`nt/` 与 `uefi/`（两个平台后端）。

**`wbenny/hvpp`**：`src/hvpp/hvpp/`（hypervisor 库）· `src/hvpp/hvpp/lib/`（内存管理、日志）·
`src/hvppdrv/`（驱动工程）· `src/hvppctrl/`（用户态控制程序）。

**共同结论：所有活下来的实现都是"OS-agnostic core + 薄平台后端 + 薄厂商后端"三层。**
v2 的开发轨道如果要给骨架，就应该给这个三层形状，而不是一个 Windows-only 的单体驱动。

### 3.2 部件清单与厂商分歧

`Maps to:` 列指向本仓库**已有**的章节——这说明 v2 的开发轨道**大部分不需要写新事实，
只需要给这些已有事实排一个实现顺序**（把 AMD `00-quickref.md` §0.6 的思路推到底）。

| # | 部件 | Intel | AMD | 分歧程度 | Maps to |
|---|---|---|---|---|---|
| 1 | 驱动入口 / 卸载 | `DriverEntry` + `DriverUnload`；UEFI 侧是 `EfiMain` | 同 | **无分歧**（OS 层） | — |
| 2 | 能力探测 | `CPUID.1:ECX[5]`；`IA32_FEATURE_CONTROL` bit0 lock / bit2；`IA32_VMX_BASIC` | `CPUID Fn8000_0001_ECX[2]`；`VM_CR.SVMDIS`；`Fn8000_000A`（`SvmRev`、`NASID`、特性位） | **大** | `intel-vt/01-vmx-intro.md` §1.4 / `amd-virtualization/01-svm-intro.md` §1.4 |
| 3 | 打开开关 | `CR4.VMXE=1` + CR0/CR4 fixed bits 调整 | `EFER.SVME=1`；**没有 CR4 位，没有 fixed-bit 调整** | **大** | 同上 |
| 4 | 每处理器 host 上下文 | **VMXON region**（大小/revision 来自 `IA32_VMX_BASIC`），再 `VMXON` | **`VM_HSAVE_PA`** 指向 4 KB host save block；无 VMXON 等价指令 | **大** | `01-vmx-intro.md` §1.7 / `01-svm-intro.md`（`C001_0117h`） |
| 5 | 每 vCPU 控制结构 | **VMCS**：不透明，只能 `VMREAD`/`VMWRITE`，字段有编码表，写入会失败并要检查 | **VMCB**：普通 4 KB 内存结构，偏移公开，用普通 store 写 | **最大**——代码形状完全不同 | `intel-vt/02-vmcs.md` / `amd-virtualization/02-vmcb.md` |
| 6 | host GDT / IDT / TSS / 栈 | 大部分由 **VMCS host-state area** 描述，退出时硬件自动恢复 | VMRUN 只保存**部分** host 状态到 `VM_HSAVE_PA`；**GPR 不保存**，必须自己在汇编里存取；段隐藏状态要 `VMSAVE`/`VMLOAD` | **大** | `intel-vt/04-vm-entry.md` / `amd-virtualization/04-world-switch.md` |
| 7 | 拦截配置 | 四组 control：pin-based / primary / secondary / tertiary processor-based，**每组都要做 allowed-0 / allowed-1 调整**；`IA32_VMX_BASIC[55]` 决定用不用 TRUE-MSR | VMCB control area 里的**拦截位向量**，直接置位；另有 MSR permissions map 与 IOIO permissions map 的物理地址字段 | **大**——Intel 的"adjust controls"步骤在 AMD 侧不存在 | `intel-vt/03-nonroot-operation.md` / `amd-virtualization/03-intercepts.md` |
| 8 | 二级地址转换恒等映射 | **EPT**：独立的 EPT pointer；EPT 表项格式自成一套，**含内存类型位，必须参考 MTRR**（`barevisor` 的 `intel/mtrr.rs`） | **NPT**：`nCR3` 在 VMCB；NPT 表项就是**普通长模式页表格式**；有效内存类型由硬件合成，**无独立 MTRR 模块** | **大** | `intel-vt/06-address-translation.md` / `amd-virtualization/06-nested-paging.md` |
| 9 | TLB 标签 | **VPID**，可选，要显式开 + `INVVPID` | **ASID**，**强制**：VMCB.ASID 为 0 则 VMRUN 失败；另有 `TLB_CONTROL` 字段与 `INVLPGA` | **中** | 同上 |
| 10 | 世界切换汇编 | `VMLAUNCH` / `VMRESUME`；失败要读 VM-instruction error | `VMRUN`；**必须用 `CLGI` / `STGI` 围起来**（GIF），Intel 无 GIF 概念 | **大** | `intel-vt/08-vmx-instructions.md` / `amd-virtualization/04-world-switch.md` |
| 11 | 退出分发循环 | `Exit Reason` + `Exit Qualification` + VM-exit interruption info；**VM-exit instruction length 是 VMCS 字段，直接读** | `EXITCODE` + `EXITINFO1/2` + `EXITINTINFO`；**`nRIP` 只在 `NRIPS` 支持时才有，否则必须自己译码推进 RIP** | **大**——这是"推进 RIP"这一最常见动作的分歧点 | `intel-vt/05-vm-exit.md` / `amd-virtualization/05-exit-decoding.md` |
| 12 | CPUID 拦截与仿真 | CPUID **无条件**产生 VM exit，无法关闭 | CPUID 拦截是**可选的**，要在 VMCB 里显式打开 | **中** | `03-nonroot-operation.md` / `03-intercepts.md` |
| 13 | MSR 拦截与仿真 | MSR bitmap（4 KB，四段 2 KB 位图），受 `use MSR bitmaps` control 控制；**不开 bitmap 则所有 MSR 访问都退出** | VMCB 的 MSR permissions map（**MSRPM，2 位/MSR，8 KB**），三段稀疏布局 | **大**——位图布局和位宽都不同 | 同上 |
| 14 | SMP bring-up | Windows 上两条路：`KeIpiGenericCall`（一次性拉齐所有 LP，运行在 IPI_LEVEL）或 `KeSetSystemAffinityThreadEx` 循环 | 同 | **无厂商分歧**，但 **SDM §31.8.1 要求逐 LP 做能力检查**（见 §2.1） | — |
| 15 | 卸载 / teardown | 每个 LP 上 `VMXOFF`，再清 `CR4.VMXE`；通常靠一条 magic `CPUID`/`VMCALL` 触发退出，在退出处理里就地 `VMXOFF` 并跳回 guest RIP/RSP | 清 `EFER.SVME`；magic 指令用 `VMMCALL` | **中** | `01-vmx-intro.md` / `01-svm-intro.md` |
| 16 | 电源状态 | S3/S4 恢复后 VMX 状态丢失，必须重新走 4→5→10 | 同 | 无厂商分歧，**但是所有教程的共同盲区**（见 §4 T12） | — |

### 3.3 一个容易被跳过但两边都要有的部件

**host 侧的 IDT 与异常处理。** `barevisor` 的共享层里 `interrupt_handlers.S` + `interrupt_handlers.rs`
是**独立文件**，不是附属品。骨架如果让 host 复用 guest 的 IDT，
那么 host 代码里的任何一次 fault 都会以 guest 的身份被处理——这就是 HyperPlatform issue #87
（"Hypervisors escape"，2021-12-05）所说的 "guest can manipulate shared IDT/APIC" 那一类问题的入口。

---

## 4. 已知陷阱清单

分三类。**第一类是有具名来源的、教学材料本身的 bug**——这一类最值钱，
因为它符合本仓库"价值来自指出流传中的错误"的既定定位。

### 4.1 教学材料自身的已知错误（每条都有 issue 编号和日期）

| ID | 陷阱 | 来源 | 为什么 AI 会抄 |
|---|---|---|---|
| **T1** | **MSR bitmap 置位算术写反。** `Hypervisor-From-Scratch` Part 6 的 `Processor.c` 里 `SetBit()` 用 `N = 7 - (Bit % 8)`，正确的是 `N = Bit % 8`。 | HFS issue **#25**，开于 **2024-08-29**，由 PR #27 修复 | 2024-08-29 之前的所有快照、fork、教程转载都带着这个 bug；它不会立刻崩，只会让拦截的 MSR 错位 |
| **T2** | **VMCS region 分配 8 KB。** 代码写 `VmcsSize = 2 * VMCS_SIZE;`，而 Intel 文档说 "A VMCS region comprises up to 4-KBytes"。 | HFS issue **#18**，开于 **2022-04-13**，无回复 | 无害地浪费内存，但同时教会了"硬编码常量"而不是"从 `IA32_VMX_BASIC` 读大小" |
| **T3** | **IRQL 用法自相矛盾。** `AllocateVmxonRegion`/`AllocateVmcsRegion` 里写 `if (KeGetCurrentIrql() > DISPATCH_LEVEL) { KeRaiseIrqlToDpcLevel(); }`——而 `KeRaiseIrqlToDpcLevel` 在 IRQL > DISPATCH_LEVEL 时正是会 bug check 的。且 `DriverEntry` 保证在 PASSIVE_LEVEL。 | HFS issue **#32**，开于 **2026-01-04**，**至今 open** | 这是"防御性代码"的外观，AI 最容易照抄 |
| **T4** | **用 `MmGetVirtualForPhysical` 构建 EPT。** Win10 19043/19044 起，它无法转换 `NonPagedPoolNx` 内存的物理地址，返回 NULL，随即 BSOD。 | HyperPlatform issue **#90**（2022-10-17），复现于 #96（2024-05-06）、#97（2024-06-24）、#98（2025-01-21），**全部 open 无回复** | 这是"物理→虚拟反查"的标准写法，抄得极广 |
| **T5** | **HFS 作者本人声明早期章节有已知问题。** README 要求实际项目用最新一 part 的驱动，因为早期 part "keep untouched"、会有 "errors and instability problems"。 | `SinaKarvandi/Hypervisor-From-Scratch` README | AI 检索"hypervisor 教程 VMCS 设置"时，命中的往往正是 Part 5，而不是 Part 8 |

### 4.2 硬件 / 平台类陷阱

| ID | 陷阱 | 来源 |
|---|---|---|
| **T6** | **在 CPU 0 上读一次 CPUID / VMX capability MSR，然后套用到所有 LP。** 混合核上这是错的。Intel 原文："CPUID, by design, returns different values depending on the core it is executed on"，并要求先 pin。SDM §31.8.1 要求逐 LP 检查 CPUID、VMCS revision identifier 和 capability MSR 的 allowed-0/allowed-1 字段。ESXi 的 "Fatal CPU mismatch on feature" PSOD 是这条的工业级演示。 | Intel 12th Gen GameDev Guide；Intel SDM Vol.3C §31.8.1；williamlam.com `[Tier-2]` |
| **T7** | **"CPUID 说支持就打开"。** Zen 4 客户端 SoC 声称支持 virtualized VMLOAD/VMSAVE，实际用了会随机重启；Linux 的做法是直接清掉该能力位。 | Linux commit `a5ca1dc46a6b`（2024-11-05）；kernel bug 219009 |
| **T8** | **假设 1 GB EPT 页可用。** SimpleVisor README 自己写明："VMWare Workstation 11, but without EPT (VMWare does not support 1GB EPTs)"。必须查 `IA32_VMX_EPT_VPID_CAP`。 | `ionescu007/SimpleVisor` README |
| **T9** | **建 EPT 恒等映射时不看 MTRR。** `barevisor` 在 Intel 侧保留了独立的 `mtrr.rs`（11.2 KB），AMD 侧没有对应物——说明这是 Intel 特有且不可省的一步。 | `tandasat/barevisor` 目录布局，读取于 2026-09-26 |
| **T10** | **不处理 S3/S4。** `hvpp` README 自己写明："hvpp currently doesn't exit VMX mode on sleep or hibernate (S3 and S4 power states)"。抄它的骨架，合盖一次就完。 | `wbenny/hvpp` README |
| **T15** | **"每个逻辑处理器一份 EPT/NPT 层次"这个默认写法，在混合核上是性能陷阱。** 4 个 E-core 共享一个 L2；per-core 的页表结构因此不 cache-friendly。修复是**改成全核共享一份 EPT 结构**。这不是 bug，是**设计习惯被新拓扑惩罚**——所有参考实现的默认写法都是 per-core。 | `Zero-Tang/NoirVisor` issue **#35**，2024-09-04 开 / 2024-09-08 关，i7-14700K；对照 i7-8700K 无此问题 |
| **T16** | **恒等映射只覆盖 512 GB。** 把 PML4 索引漏掉、只按 PDPT×PD 两层算物理地址，在 MMIO 落到 512 GB 以上的平台上（例如带独立 GPU 的机器，`nvlddmkm`）立刻蓝屏。**而这类平台在 2025 年已经是常见配置，不是边缘情况。** | `tandasat/SimpleSvm` issue **#3** 的最终诊断（2025-03-02）+ PR #4 / commit `c4a479e`（2025-03-03） |
| **T17** | **用 VMX preemption timer 却不按勘误封顶。** Intel 有一条广泛存在的勘误（例如 `EMR158`），某些较大的 timer 值会**提前到期**；推荐规避是把值封到严格小于 `2^25 * CPUID.15H:EBX[31:0] / CPUID.15H:EAX[31:0]`。 | KVM "[PATCH v7 0/2] KVM: VMX: Workaround VMX preemption timer erratum"，Sean Christopherson，**2026-07-31**；对照 `SimpleVisor` issue #42（2019-10-19）报告的 "VM exit #52 timing inaccuracy" 与 "random Windows restarts" |

### 4.3 设计 / 工程类陷阱

| ID | 陷阱 | 来源 |
|---|---|---|
| **T11** | **在 VM-exit handler 里调用 Windows API。** HyperPlatform 用户文档的明确告诫："Avoid using API inside a VM-exit handler"；配套还有 "Use a guest CR3 value for memory access"、"Do not step-in to VMLAUNCH and VMRESUME"、"Use breakpoints moderately in a VM-exit handler"，以及 "Incompatibility with the Driver Verifier"。 | <https://tandasat.github.io/HyperPlatform/userdocument/index.html> |
| **T12** | **把参考实现当成安全边界。** SimpleVisor README 原文："SimpleVisor is designed to minimize code size and complexity -- this does come at a cost of robustness"、"does not do any such error checking, validation, and exception handling. It is not robust software designed for production use, but rather a reference code base."。HyperPlatform issue #87（2021-12-05，"Hypervisors escape"）报告 guest 可以操纵共享的 IDT/APIC。 | 两处原文 |
| **T13** | **"先把 Hyper-V 关掉"这条建议已经过时。** 本仓库 `amd-virtualization/references/errata.md` E15 已经收录了这一条（`00-quickref.md` 明确指向它）。但几乎所有 hypervisor 教程仍在教这句。 | 本仓库既有内容 |
| **T14** | **教程写于 VBS 默认关闭的年代。** HyperPlatform README 自己记录：Windows 10 RS4 及以后，Credential Guard 默认开启会让虚拟化被自动禁用，报 error 3224698910。而绝大多数教程的"环境准备"只说"打开 test signing"。 | `tandasat/HyperPlatform` README |

---

## 5. Windows 平台的三堵墙

ticket 08 第 2 问要求正面回答这三件事。按"挡在前面的顺序"排，而不是按名气排。

### 5.1 第一堵墙（最高）：Hyper-V / VBS 已经占着 VMX root

这是**唯一一堵会让驱动根本装不上的墙**，另外两堵都在它后面。

参考实现自己的说法，逐条带来源：

- `ionescu007/SimpleVisor` README：
  **"However, if your machine is already running under a hypervisor such as Hyper-V or Xen, SimpleVisor will not load."**
- `HyperDbg` 的 Build & Install 文档：
  **"HyperDbg and VBS are both hypervisors running on ring -1. These hypervisors are not compatible,
  and you should disable VBS (and its sub-components like HVCI, Device Guard, etc.)."**
  要求的操作包括：关 Core Isolation 的 Memory Integrity、关 Firmware Protection、
  关 "Virtual Machine Platform" 与 "Windows Hypervisor Platform" 功能、
  执行 `bcdedit /set hypervisorlaunchtype off`。
- `HyperDbg` 的 Run-on-Hyper-V 文档：
  **"Hyper-V has an unknown problem with HyperDbg and HyperDbg-style hypervisors.
  You might encounter unknown errors."**
  并要求 `Set-VMProcessor -VMName <name> -ExposeVirtualizationExtensions $true`
  ——**注意这是一条对"某个 Hyper-V 来宾 VM"生效的命令**，
  也就是说官方支持的路径是"跑在 Hyper-V 的来宾里"，而不是"跑在 root partition 里"。
- `HyperDbg` issue **#690**（2026-09-12）：
  **"Currently, HyperDbg virtualizes the host OS. By implementing VMCS shadowing, we could support
  running another hypervisor (like Hyper-V, VMware, or VirtualBox) inside HyperDbg."**
  ——反过来读：**今天它必须是最外层的那一个。**
- `memN0ps/illusion-rs` README 的能力清单里明确打叉：
  "❌ Support for running ... on top of Microsoft Hyper-V (Type-1) with Virtualization Based Security (VBS) Enabled"。
- `HyperDbg` FAQ：**"The current version of HyperDbg only supports Intel x64 processors."**；
  Build 文档：**"HyperDbg's driver is NOT digitally signed."**

**而这堵墙正在扩张，时间点就在下个月。**
微软 Windows IT Pro Blog 文章 "Expanding memory integrity protection across Windows devices"
（<https://techcommunity.microsoft.com/blog/windows-itpro-blog/expanding-memory-integrity-protection-across-windows-devices/4551984>，
发布于 **2026-09-01**，作者 Peter Waxman）宣布：
**从 2026 年 10 月起，Windows 质量更新将在"合格设备"上自动启用 memory integrity**；
在 VBS 尚未启用的机器上，这轮更新会**顺带把 VBS 打开**；
已被管理员或用户显式关闭的机器不受影响。
Help Net Security（2026-09-03）转述原文：
"Beginning in October 2026, Windows quality updates start enabling memory integrity protection
on eligible devices with little or no additional configuration."
**本环境无法直连 techcommunity.microsoft.com（`Socket is closed`），以上标 `[MS-间接]`，写入 v2 前必须直连核对。**

**对 ticket 08 的直接含义**：选项 (c)"一个能在用户 265KF 真机上加载起来的完整 thin hypervisor"
不是被许可证砍掉的，是被这条砍掉的——它要求用户**长期关闭 Memory Integrity 并顶着每月质量更新**。
这件事可以做（用于研究），但**不能作为技能的默认教学路径**，否则技能教出来的第一步就是让用户降低系统安全性。

### 5.2 第二堵墙：HVCI / Memory Integrity 对驱动的约束

微软的规则本身是可直连拿到的（GitHub 上的 docs 源码仓库）：
`MicrosoftDocs/windows-driver-docs` → `windows-driver-docs-pr/driversecurity/implement-hvci-compatible-code.md`，
front-matter **`ms.date: 07/20/2022`**。`[MS-直连]` 要求逐条为：

> - "Opts in to NX by default"
> - "Uses NX APIs/flags for memory allocation (NonPagedPoolNx)"
> - "Does not use sections that are both writable and executable"
> - "Does not attempt to directly modify executable system memory"
> - "Does not use dynamic code in kernel"
> - "Does not load data files as executable"
> - "Section alignment is a multiple of 0x1000 (PAGE_SIZE). E.g. DRIVER_ALIGNMENT=0x1000"

该文档并列出受影响的 DDI，包括 `ExAllocatePool`、`MmAllocateContiguousMemory`、
`MmMapLockedPages`、`ZwAllocateVirtualMemory`、`ZwCreateSection` 等及其变体。

**对骨架代码的具体含义**：host 的代码页、VM-exit trampoline、任何跳转目标
**必须来自驱动映像自身的节，不能来自运行时分配的可执行池**。
任何"分配一块 `NonPagedPool` 然后往里写代码再跳进去"的写法在 HVCI 下天然不兼容。

**但要把因果说对**：HVCI 打开 ⟹ VBS 打开 ⟹ Hyper-V hypervisor 在跑 ⟹ §5.1 已经把你挡住了。
所以 **HVCI 的分配规则在"第三方 hypervisor 自己当最外层"这个场景里其实轮不到生效**。
它真正生效的场景是：作为 Hyper-V 来宾里的嵌套 hypervisor，或作为一个必须与 VBS 共存的普通驱动。
**v2 不要把这两个场景混起来讲**——这正是现有教程普遍讲错的地方。

### 5.3 第三堵墙（最矮）：PatchGuard / KPP

微软文档 "Kernel patch protection for x64-based operating systems"
（`learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc759759`）
被保护的结构包括 **system service dispatch tables、IDT、GDT**；
违反会产生 **bug check `0x109`** 并关机。
**本环境无法直连 learn.microsoft.com，以上为搜索结果摘录，标 `[MS-间接, 待核]`。**

**对 thin hypervisor 的实际含义，这一堵比想象中矮：**
一个**只做虚拟化**的 thin hypervisor——建 EPT/NPT、拦 CPUID、拦 MSR、装退出处理器——
**不修改任何 PatchGuard 检查的 guest 可见字节**，因此不触发 KPP。
会触发的是另一类动作：hook `IA32_LSTAR`、改 SSDT、改 guest 的 IDT/GDT。
**EPT/NPT hooking 这一整套技术存在的理由就是绕开这一点**：
页表层面换页，guest 读到的物理页内容不变。

实践上另有一条：`HyperDbg` 的 Build 文档推荐在启动时挂 WinDbg 来关闭 Driver Signature Enforcement，
并指出这样做**同时会阻止 PatchGuard 初始化**。这是社区通行做法，
也说明"真机调试 hypervisor"与"生产环境安全配置"是两套互斥的机器状态。

### 5.4 三堵墙的排序结论（给 ticket 08）

```
Hyper-V/VBS 占着 root   →  驱动根本不会加载      ← 唯一的硬墙，且 2026-10 起覆盖面扩大
        ↓（假设已关闭 VBS）
HVCI 分配规则            →  此时 HVCI 也已随 VBS 关闭，规则不生效
        ↓
驱动签名 / test signing  →  需要 test signing 或挂调试器
        ↓
PatchGuard              →  纯虚拟化不触发；挂调试器时本就不初始化
```

**一句话：写给现代 Windows 的 thin hypervisor 骨架，第一章不是 `DriverEntry`，
是"先判断这台机器上 VMX root / SVM 归谁"。**
这一判断本仓库已经有内容：`intel-vt/references/17-windows-platform.md`、
`amd-virtualization/references/16-windows-platform.md`
（后者的章首摘要已经写着"**在 Windows 上这条探测链会给出错误答案**——
机器全部'正常'而 VMM 仍起不来"）。开发轨道要做的是把它提到第一步，而不是当附录。

---

## 6. 许可证结论

**（这一节是 ticket 08 可以直接照做的部分。）**

### 6.1 先把本仓库自己的状态说清楚

- 本仓库在三处声明 Apache-2.0：`intel-vt/SKILL.md:15`、`amd-virtualization/SKILL.md:16`、`README.md:213`。
- **但工作树里没有 `LICENSE` 文件，也没有 `NOTICE` 文件。**
  （2026-09-26 用 `find . -maxdepth 3 -iname "LICENSE*" -o -iname "NOTICE*" -o -iname "COPYING*"`，排除 `.git/`，零命中。）
- **这是任何 vendor 第三方代码的先决条件。** 应交给 ticket 05（repo hygiene）补齐。

### 6.2 "cited, never reproduced" 适用于开源代码吗？

**不适用——但结论仍然是"基本不抄"，理由完全不同。**

现有立场针对的是 Intel / AMD / Microsoft 的规范 PDF。那些文档**根本没有授予任何再分发许可**，
所以"只引不抄"是**唯一合法选项**，没有选择余地。

开源代码是另一种法律客体：**MIT 和 BSD-2-Clause 明确授予再分发权**，条件是保留版权与许可声明。
所以从许可证角度，**抄是合法的**。两种情况必须在 v2 的文档里分开写，不能一句"都只引不抄"糊过去。

### 6.3 逐许可证的可包含性（权威依据）

依据一：**Apache 软件基金会第三方许可证政策**（<https://www.apache.org/legal/resolved.html>）。
原文定义：
- Category A："Licenses in Category A may be included in Apache Software Foundation products."
- Category B："Licenses in Category B may be, under certain conditions, included in Apache Software Foundation products."
- Category X："Licenses in Category X may **NOT** be included in Apache Software Foundation products."

依据二：**FSF 许可证清单**（<https://www.gnu.org/licenses/license-list.en.html>）。
Apache 2.0："This is a free software license, compatible with version 3 of the GNU GPL"，
但 "this license is not compatible with GPL version 2"。
CC BY 4.0："like all CC licenses, it *should not be used on software*"。

| 许可证 | ASF 分类 | 能否进本仓库源码树 | 涉及的项目 |
|---|---|---|---|
| **MIT** | Category A | **可以**（须保留版权行与许可全文） | HyperPlatform, hvpp, Hypervisor-From-Scratch, SimpleSvm, SimpleSvmHook, MiniVisorPkg, Hypervisor-101-in-Rust, **barevisor**, NoirVisor, illusion-rs, matrix-rs, airhv |
| **BSD-2-Clause** | Category A | **可以**（条款须从 README 抄录，见 §1.2 注 A） | **SimpleVisor** |
| **GPL-2.0** | **Category X** | **不可以** | ksm |
| **GPL-3.0** | **Category X** | **不可以** | **HyperDbg** |
| **LGPL 2/2.1/3** | **Category X** | **不可以** | Bareflank 早期版本（未在本次核实） |
| **CC-BY-4.0** | Category B（"only include them in binary form"） | **源码形式不可以** | gbhv |
| **元数据缺陷** | — | **澄清前不可以** | Bareflank/hypervisor（§1.2 注 B） |

**方向性要点，必须写进 v2**：Apache-2.0 与 GPLv3 的兼容是**单向**的。
Apache-2.0 的代码可以被合进 GPLv3 项目；**GPLv3 的代码不能合进 Apache-2.0 项目**。
所以"HyperDbg 是开源的所以能参考代码"这句话只在"读"这个意义上成立，在"抄"这个意义上不成立。

### 6.4 明确结论：v2 能不能内含可编译的骨架代码

**能。三个深度档位 (a) 只讲结构 / (b) 可编译最小骨架 / (c) 完整可加载实现，
一个都没有被许可证砍掉。**
砍掉 (c) 的是 §5.1 的平台现实和长期维护成本，不是法律。

**推荐 (b)，并附下列六条规则。**

> **R1｜骨架代码是本仓库的原创作品，按本仓库的 Apache-2.0 发布。**
> 不从任何上游项目复制文件、函数或成段代码。
> 理由不是"怕侵权"，而是三条工程理由：
> (i) 骨架的形状由 ISA 决定——"`VMXON` 之前必须先置 `CR4.VMXE`"是 Intel 规范陈述的事实，不是谁的表达；
> (ii) 抄 MIT 代码会让本仓库永久背上逐个上游的版权声明，并要维护一份与之同步的 NOTICE；
> (iii) **最关键**：这是一套会被 AI 复述的语料。如果 v2 内含 MIT 派生的代码，
> 每一个读了这个技能并把代码吐出来的 agent 都在替用户承担一份它不会履行的署名义务。
> 原创的 Apache-2.0 代码没有这条尾巴。

> **R2｜上游项目按"URL + commit/日期"引用，与规范按"文档号 + 修订号"引用同构。**
> 现有的锚点纪律可以自然延伸：一段代码引用 `[repo@commit]`，就像一条 claim 引用 `[SDM §x]`。

> **R3｜例外：为了指出教学材料里的错误，可以引用最小必要的片段。**
> 限于"足以identify那个错误"的长度，必须署名，必须写清它不是 v2 的写法。
> **只对 MIT / BSD 项目这样做**（T1/T2/T3 的来源 `Hypervisor-From-Scratch` 是 MIT，安全）。
> **对 GPL 项目一律只描述、不引用代码。**

> **R4｜硬边界：`HyperDbg`（GPL-3.0）与 `ksm`（GPL-2.0）的代码一行都不进本仓库。**
> 可以读、可以引 URL、可以描述其架构与结论。ASF Category X，无例外。

> **R5｜`Gbps/gbhv`（CC-BY-4.0）与 `Bareflank/hypervisor`（元数据缺陷）同样只引不抄。**

> **R6｜先决条件（交 ticket 05）：在仓库根补 `LICENSE`（Apache-2.0 全文）。**
> 如果 R3 被实际使用，再补 `NOTICE` 或 `THIRD-PARTY-NOTICES.md`。
> 今天两者都不存在。

### 6.5 一条容易被误读的边界，写清楚以免后人反复讨论

**"不复制规范原文"约束的是规范的*文字*，不是它*描述的过程*。**
"先查 `IA32_FEATURE_CONTROL` 的 lock 位，再置 `CR4.VMXE`，再准备 VMXON region，再执行 `VMXON`"
——这是事实序列，本仓库已经以 claim 形式收录（`intel-vt/references/01-vmx-intro.md:47-52`）。
**把同一个序列写成代码，不改变它的法律性质。**
所以 v2 的骨架代码不与 "cited, never reproduced" 冲突，前提是：代码是自己写的，
注释里不逐字抄规范段落，且每一步仍然指回它所依据的 claim 锚点。

---

## 7. 给 v2 开发轨道的落地建议

**站在谁的肩膀上：**

| 角色 | 项目 | 理由 |
|---|---|---|
| **主参照** | **`tandasat/barevisor`**（MIT，2026-08-02） | **唯一同时满足四条**：在维护、双厂商（Intel+AMD）、双目标（Windows 驱动 + UEFI）、单一 OS-agnostic core。这正好是 ticket 06 要决定的形状 |
| **最小结构范本** | `ionescu007/SimpleVisor`（BSD-2） | `nt/` + `uefi/` 后端切分最干净；10 行汇编的极简主义；但只到 Skylake，且 2024-05-08 后停滞 |
| **Windows 驱动 C 形状** | `tandasat/HyperPlatform`（MIT） | **已归档 2026-05-18，只作结构参考，绝不作依赖**；其 user document 是现成的"陷阱清单" |
| **AMD 侧 C 范本** | `tandasat/SimpleSvm`（MIT，2025-03-03） | AMD 侧目前最接近"最小可读实现"的 C 代码 |
| **完整产品的需求清单** | `HyperDbg/HyperDbg`（**GPL-3.0**） | 只读、只引、**绝不抄**。它的文档是对 VBS/Hyper-V 冲突讲得最直白的一手材料 |
| **双厂商 C 的另一个活体** | `Zero-Tang/NoirVisor`（MIT，2026-09-20） | 活跃、双厂商、MIT，但复杂度远高于教学需要，且无官方测试 CPU 清单 |
| **不要建在其上** | `hvpp`(2021-03-15)、`Bareflank`(元数据缺陷)、`ksm`(GPL-2.0)、`gbhv`(CC-BY)、`illusion-rs`/`matrix-rs`(均已归档 2026-05-14) | 见 §1 |

**语言问题（ticket 08 第 3 问）的一条外部证据**：
`barevisor` 与 `Hypervisor-101-in-Rust` 都用 Rust + 独立 `.S` 文件，
根本绕开了"MSVC x64 不支持内联汇编"这个问题；
`SimpleVisor` 在 C 下的解法是把汇编压到 10 行放进单独的 `.asm`。
**两条路都是"把汇编隔离成独立文件"，没有第三条路。**

**给 ticket 09 的输入**：见 §2.5 的四维表。

---

## 8. 未解问题与证据缺口

1. **`[MS-间接]` 的三条微软原文必须重新直连核对**：
   PatchGuard 保护结构清单与 bug check `0x109`；
   2026-10 起自动启用 memory integrity 的公告原文；
   Ryzen 5 9600X 上 Windows 11 25H2 启用 hypervisor 导致启动挂起的那条 Q&A。
   本环境 `learn.microsoft.com` 与 `techcommunity.microsoft.com` 均 `Socket is closed`。
2. **Intel 社区那条 265KF `HYPERVISOR_ERROR` 讨论串**（HTTP 403）未能直连。
   **用户手上就有 265KF，这条应当直接真机复现，而不是继续找文档。**
3. **`barevisor` 的测试硬件只写了两个内部代号**（Intel "PICO-MTU4-SEMI"、AMD "LLM1v6SQ"），
   无法据此判断它在 Arrow Lake / Zen 5 上是否验证过。
4. **未核实 `Bareflank` 早期版本（v1/v2）的实际许可证**（常被称为 LGPL-2.1）。
   由于 master 的元数据本身有缺陷，这条应在任何引用之前一并澄清。
5. **未找到**任何参考项目对 Arrow Lake 无 SMT 的适配 PR 或失败报告。这是一条负面结论，
   搜索范围见 §2.2；它可能意味着问题不存在，也可能只意味着用户群太小。**不要把它当成"没问题"来引用。**

---

## 附录 A：来源清单

**GitHub REST API（`/repos/{owner}/{name}`，全部读取于 2026-09-26）**：
ionescu007/SimpleVisor · tandasat/HyperPlatform · wbenny/hvpp · Bareflank/hypervisor ·
SinaKarvandi/Hypervisor-From-Scratch · HyperDbg/HyperDbg · tandasat/SimpleSvm ·
tandasat/SimpleSvmHook · Zero-Tang/NoirVisor · asamy/ksm · tandasat/MiniVisorPkg ·
tandasat/Hypervisor-101-in-Rust · tandasat/barevisor · memN0ps/illusion-rs ·
memN0ps/matrix-rs · Gbps/gbhv · Air14/airhv

**仓库文件与页面**：
- `raw.githubusercontent.com/ionescu007/SimpleVisor/master/README.md`（licence, tested hardware, caveats, Hyper-V 声明）
- `raw.githubusercontent.com/ionescu007/SimpleVisor/master/shv.c`（文件头）
- `api.github.com/repos/Bareflank/hypervisor/contents/LICENSE.md`（版权人 Martin Donath）
- `raw.githubusercontent.com/Bareflank/hypervisor/master/kernel/src/main.cpp`（AIS 版权 + MIT，无 SPDX 行）
- `raw.githubusercontent.com/Bareflank/hypervisor/master/README.md`
- `raw.githubusercontent.com/tandasat/barevisor/main/README.md` 与 `/LICENSE`（MIT, Copyright (c) 2024 Satoshi Tanda）
- `api.github.com/repos/tandasat/barevisor/contents/src/hvcore/src/hypervisor{,/intel,/amd}`（模块布局与文件大小）
- `raw.githubusercontent.com/wbenny/hvpp/master/README.md`（MIT, S3/S4 限制, 目录布局）
- `raw.githubusercontent.com/tandasat/HyperPlatform/master/README.md`（MIT, Credential Guard error 3224698910）
- `github.com/tandasat/HyperPlatform`（归档横幅：May 18, 2026）
- `github.com/memN0ps/illusion-rs`（归档横幅：May 14, 2026；能力打叉清单）
- `raw.githubusercontent.com/SinaKarvandi/Hypervisor-From-Scratch/master/README.md`（MIT；早期 part 的自我免责）
- `raw.githubusercontent.com/Zero-Tang/NoirVisor/master/README.md`
- `raw.githubusercontent.com/tandasat/SimpleSvm/master/README.md`
- `raw.githubusercontent.com/HyperDbg/docs/master/getting-started/{faq,build-and-install}.md`
- `raw.githubusercontent.com/HyperDbg/docs/master/tips-and-tricks/nested-virtualization-environments/run-hyperdbg-on-hyper-v.md`
- `tandasat.github.io/HyperPlatform/userdocument/index.html`

**Issue（含日期）**：
- Hypervisor-From-Scratch #18(2022-04-13) · #25(2024-08-29) · #32(2026-01-04)
- HyperPlatform #87(2021-12-05) · #90(2022-10-17) · #96(2024-05-06) · #97(2024-06-24) · #98(2025-01-21) · #99(2025-09-08)
- SimpleSvm #3(2025-02-14 开 / 2025-03-03 关)
- HyperDbg #690(2026-09-12)
- QubesOS/qubes-issues #10897(2026-05-27)

**规范与厂商文档**：
- Intel SDM Vol.3C §31.8.1 "Initialization"（"an MP-aware VMM must check..."），
  相邻小节 §31.8.2 / §31.8.5 已核对；较新修订编号为 §32.8.1
- Intel, "Game Dev Guide for 12th Gen Intel Core Processor Hybrid Architecture"
  （CPUID.1AH、Core Type 20H/40H、`CPUID.07H:EDX[15]`、"CPUID, by design, returns different values..."）

**Linux 内核**：
- commit `a5ca1dc46a6b610dd4627d8b633d6c84f9724ef0`,
  `x86/CPU/AMD: Clear virtualized VMLOAD/VMSAVE on Zen4 client`, 2024-11-05,
  bug <https://bugzilla.kernel.org/show_bug.cgi?id=219009>；
  邮件原文 <https://lkml.indiana.edu/hypermail/linux/kernel/2411.0/06883.html>
- Phoronix, "Linux Fixes Hosts Randomly Rebooting During Virtualization With Ryzen 7000/8000 CPUs", 2024-11-17 `[Tier-2]`

**许可证权威来源**：
- ASF, "Third Party Licensing Policy" <https://www.apache.org/legal/resolved.html>（Category A/B/X 定义与名单）
- FSF, "Various Licenses and Comments about Them" <https://www.gnu.org/licenses/license-list.en.html>
  （Apache-2.0 与 GPLv2/v3 的兼容方向；CC BY 4.0 "should not be used on software"）

**微软文档**：
- `[MS-直连]` `MicrosoftDocs/windows-driver-docs` → `windows-driver-docs-pr/driversecurity/implement-hvci-compatible-code.md`，`ms.date: 07/20/2022`
- `[MS-间接]` learn.microsoft.com KPP 页面 `previous-versions/.../cc759759`
- `[MS-间接]` techcommunity.microsoft.com "Expanding memory integrity protection across Windows devices"（2026-09-01），
  经 Help Net Security 2026-09-03 转述交叉确认

**其他 `[Tier-2]`**：
- williamlam.com 关于 ESXi 与 Intel 混合架构的文章（"Fatal CPU mismatch on feature"、`cpuUniformityHardCheckPanic=FALSE`）
- community.intel.com 关于 Ultra 200S 265K 触发 `HYPERVISOR_ERROR` 的讨论串（403，未直连）
