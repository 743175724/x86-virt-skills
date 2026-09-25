# 08 开发轨道的形态与边界

Type: grilling
Status: open
Blocked by: 06

## Question

用户的原话：**「希望 AI 可以通过这个技能精通这门技术，不单单是修复，编写开发都能随心所欲地实现。」**

现状（诊断查实）：

- 整个 corpus 里只有 **3 段 C 代码**，全在 Intel 侧，且被明确免责——
  `01-vmx-intro.md:66` 写着 *"the listing exists to show the order, not to introduce new facts"*。
- **AMD 侧零代码。** 唯一的代码围栏是 `11-memory-encryption.md:120-125` 一个无语言标注的块。
- 完全不存在：VMM 项目骨架、驱动入口、host 栈与 GDT/IDT 搭建、EPT/NPT 恒等映射构建、
  退出分发循环、CPUID/MSR 仿真模式、SMP bring-up、卸载 teardown、
  VM entry 失败怎么调、以及任何把 thin hypervisor 当设计目标来讲的内容。
- **两个 `description` 都不含开发类词汇**，所以"怎么写一个 hypervisor"这类提问
  **根本不会触发这两个技能**。
- 最接近开发指南的是 `amd-virtualization/references/00-quickref.md:159-176` §0.6，
  *"Written for someone implementing a hypervisor, not browsing. Each step is one chapter;
  do not read ahead."* 给了 `01 → 02 → 04 → 05 → 03 → 06 → 07` 的顺序。
  Intel 的对应物只有 3 行（`00-quickref.md:123-125`）且措辞是"给 VMX 新手的阅读顺序"。

**要决定的：**

1. **深度到哪一层。** 三档：
   (a) 只讲结构，不给代码；
   (b) 给可编译的最小骨架；
   (c) 给一个完整的、能在用户 265KF 真机上加载起来的 thin hypervisor。
   **04 的许可证结论会直接砍掉其中一些选项。**
2. **目标形态。** Windows 内核驱动 / UEFI runtime / 裸机。
   用户的目标平台是 Windows PC，但 thin hypervisor 在 Windows 上要面对
   **PatchGuard、HVCI、以及 Hyper-V 已经占着 VMX root 的情况**——
   这三件事必须在决策里正面回答，否则写出来的骨架在现代 Windows 上装不上。
3. **语言。** C / C++ / Rust。以及汇编部分怎么处理（MSVC 的 x64 不支持内联汇编）。
4. **和参考章节的关系。** 开发轨道是第三个技能？现有技能里的新章节？还是一个横切的
   "路径"文档，把已有章节串成实现顺序（把 AMD §0.6 那个思路推到底）？
   **这一问的答案受 06 强约束。**
5. **"精通"怎么验收。** 用户要的是 AI 能随心所欲地写。
   那验收就不是"答对事实"，而是"写出来的代码能跑"。
   这意味着 eval 要加一类全新的题——见 10。

## 04 已交付的结论（原先的阻塞已解除）

- **许可证不砍任何深度档位——(b) 和 (c) 都可行。** MIT / BSD-2 属 ASF Category A；
  GPL-2/3 与 LGPL 属 Category X（`HyperDbg` 因此一行不能用）。
- **但推荐写原创 Apache-2.0 骨架，不要抄 MIT。** 理由是工程的：骨架形状由 ISA 决定；
  vendor 会让仓库永久背署名义务；**而这是会被 AI 复述的语料——
  每个复述它的 agent 都在替用户承担一份它不会履行的署名义务。**
  报告里有 R1–R6 六条可执行规则。
- **主参照 `tandasat/barevisor`**（MIT，2026-08-02）：Intel + AMD × Windows 驱动 + UEFI，
  带单一 OS-agnostic core——**正好是本 ticket 第 2 问要选的形状**。
- **先决条件转入 05 第 10 条**：仓库声明 Apache-2.0 却没有 `LICENSE` 也没有 `NOTICE`。
  **在补上之前不应发布任何代码。**

### 第 2 问（目标形态）现在有了确定答案的一半

**最大的障碍不是 PatchGuard，是 Hyper-V / VBS 已经占着 VMX root operation** ——
唯一一堵会让驱动**根本装不上**的墙。且**微软 2026 年 10 月起（下个月）
经质量更新自动启用 Memory Integrity 并顺带打开 VBS**。

所以本 ticket 必须正面决定：开发轨道是教**在 VBS 之下做嵌套**，
还是教**要求用户关掉 VBS**（那会让受众快速萎缩），还是**两条都讲清代价**。
PatchGuard 反而最矮——纯虚拟化不改任何它检查的 guest 可见字节。

## 依赖

- ~~**04**~~：已 resolved。
- **06**：技能是一个还是两个，决定开发轨道挂在哪。**这是本 ticket 唯一剩余的阻塞。**

## 交付物

开发轨道的范围界定书：深度档位、目标形态、语言、挂载点、验收方式。
