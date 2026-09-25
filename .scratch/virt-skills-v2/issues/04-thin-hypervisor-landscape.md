# 04 开源 thin hypervisor 参考实现现状调研

Type: research
Status: resolved
Blocked by: —

## Question

用户的原话是希望 AI「精通这门技术，不单单是修复，编写开发都能随心所欲地实现」。
但诊断显示：整个约 548k token 的 corpus 里，**开发内容几乎为零**——
Intel 侧仅 3 段 C 代码且被明确免责为"只展示顺序，不引入新事实"
（`01-vmx-intro.md:64-85`、`02-vmcs.md:63-80`、`03-nonroot-operation.md:138-155`），
**AMD 侧零代码**。`SimpleVisor` / `HyperPlatform` / `hvpp` / `bareflank` 命中全为 0。
"thin hypervisor" 全库出现 1 次，还是在 `15-security.md:279` 把 Blue Pill 当 rootkit 描述。

**调研现有开源轻量级 hypervisor 实现，回答：v2 的开发轨道应该站在谁的肩膀上。**

（原问题的 5 个维度见 git 历史；已全部作答。）

---

## Answer

完整报告：[`research/04-thin-hypervisor-landscape.md`](../research/04-thin-hypervisor-landscape.md)（863 行）。

### 主参照：`tandasat/barevisor`

**MIT，最后推送 2026-08-02。** 唯一同时满足：Intel + AMD 双厂商、
Windows 驱动 + UEFI 双形态、且带一个 OS-agnostic 的单一 core。
**这正好是 06 要决定的形状**，所以它应当作为主参照。

次选：

| 项目 | 许可证 | 最后活动 | 定位 |
|---|---|---|---|
| `ionescu007/SimpleVisor` | BSD-2 | 2024-05-08 | 结构最干净，但**只测到 Skylake** |
| `tandasat/SimpleSvm` | MIT | 2025-03-03 | AMD 侧的 C 范本 |
| `Zero-Tang/NoirVisor` | MIT | 2026-09-20 | 双厂商，但复杂度过高，不适合当教材 |

### 经典四件套已经废了三件

- **`HyperPlatform` 于 2026-05-18 被作者归档。**
- `hvpp` 停在 2021-03-15。
- **`Bareflank/hypervisor` 许可证存疑**：`LICENSE.md` 的版权人写的是
  mkdocs-material 的作者 Martin Donath，与源码头部的 Assured Information Security 不符，
  GitHub 判定为 `NOASSERTION`。**澄清前不得 vendor。**
- `HyperDbg` 最活跃、文档最好，但 **GPL-3.0 —— 一行都不能进本仓库。**

### 许可证结论：可编译骨架**可以**发，但不该抄

**许可证没有砍掉任何一个深度档位。** 依据 ASF 第三方许可证政策：
MIT / BSD-2 属 Category A（可包含）；GPL-2/3 与 LGPL 全属 Category X（不可包含）；
CC-BY-4.0（`gbhv`）的源码形式不可用。

**但推荐路线不是"抄 MIT 代码"，而是自己写原创 Apache-2.0 骨架。** 理由是工程的，不是法律的：

1. 骨架形状由 ISA 决定，不由作者决定——照抄没有技术收益。
2. vendor MIT 代码会让仓库**永久背上署名义务**。
3. **最关键：这是会被 AI 复述的语料。** 每一个读了技能又把代码吐出来的 agent，
   都在替用户承担一份**它不会履行**的署名义务。

报告里给了 R1–R6 六条可直接执行的规则。

> ⚠️ **先决条件**：本仓库 `README.md:211-213` 声明 Apache-2.0，
> 但**根本没有 `LICENSE` 文件，也没有 `NOTICE`**（实测 2026-09-26 确认）。
> 已转入 ticket 05 第 10 条。

### 现代 Windows 上最大的障碍不是 PatchGuard

**是 Hyper-V / VBS 已经占着 VMX root operation** ——唯一一堵会让驱动**根本装不上**的墙。
HyperDbg 文档原话：

> *"HyperDbg and VBS are both hypervisors running on ring -1. These hypervisors are not compatible."*

而且**微软从 2026 年 10 月起（即下个月）会通过质量更新自动启用 Memory Integrity，
并顺带打开 VBS**。这意味着开发轨道如果不正面处理 VBS 共存，
写出来的骨架在越来越多的机器上直接装不上。

PatchGuard 反而是最矮的一道：纯虚拟化不改任何它检查的 guest 可见字节。

### 两条纠正——**不得写成 claim**

1. **「混合核上 VMX 能力位会不同」和「Arrow Lake 取消超线程会搞坏 hypervisor」，
   穷尽搜索后零证据。** 这两条是本图早期的推测，必须撤回，不得进入任何章节。

   **真实的混合核缺陷是另一回事**：`NoirVisor` issue #35 ——
   **4 个 E-core 共享一个 L2**，导致"每核一份 EPT"这个
   **所有参考实现的默认写法**在 12 代以后退化。修法是改成全核共享一份。
   这条有具体 issue 可引，是真的。

2. **Zen 4 客户端声称支持 virtualized VMLOAD/VMSAVE，用了会随机重启。**
   证据：Linux commit `a5ca1dc46a6b`（CVE-2024-53114）。
   **SimpleSvm / SimpleSvmHook / NoirVisor / barevisor 没有一个带这个规避。**
   （注：Zenbleed 属 Zen 2 / CVE-2023-20593，ticket 03 的原文即如此，无需更正。）

### 给 ticket 09 的结论：按型号查有价值，但键不能只有型号

**至少要五维**：family/model、核类型与缓存拓扑、固件/AGESA、Windows build、平台配置。

**警告案例 `SimpleSvm` issue #3**：报告人误判成"只有 Zen 4/5 才坏"，
真因是 **MMIO 落在 512 GB 以上**。
**一张只按 CPU 型号组织的表会把它归错格子，并把这个错误相关性固化下来。**
这正是 09 必须防的失败模式。
