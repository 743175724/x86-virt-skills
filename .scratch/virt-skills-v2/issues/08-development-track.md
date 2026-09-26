# 08 开发轨道的形态与边界

Type: grilling
Status: resolved
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

---

## Answer

### 1. 深度：**(b) 可编译的最小骨架**，不是 (c) 完整可加载的 hypervisor

许可证不砍任何一档（04 已证），所以这是个工程判断：

- **(c) 会被整份复制而不被理解。** 04 那条许可证推理在这里同样成立——
  **这是会被 AI 复述的语料**。一份完整 hypervisor 放进语料，agent 会照抄，
  而抄来的东西一旦在新 CPU 上崩，抄的人没有能力修。**那与"精通"正好相反。**
- **(c) 无法验证。** 完整产品需要持续跟进 Windows 更新，而 CI 里没有硬件，
  两道闸门（lint / build）都测不了它。语料里出现一个**测不到的东西**，
  就是本仓库最该避免的那种资产。
- **(b) 是耐久的那一份。** 架构参考 + 正确的最小骨架 + **已知陷阱清单**，
  三者合起来才是"能随心所欲地写"的条件。骨架给形状，陷阱清单给判断力。

> 这是本 ticket 唯一一处你可能有不同意见的地方：
> 如果你要的是"直接能跑起来的成品"，那是 (c)，代价是上面三条。

### 2. 目标形态：Windows 内核驱动，且**必须正面回答 VBS**

04 查明**最大的障碍不是 PatchGuard，是 Hyper-V / VBS 已占着 VMX root**——
唯一一堵会让驱动**根本装不上**的墙。而且**微软 2026 年 10 月起经质量更新自动启用
Memory Integrity 并顺带打开 VBS**。

所以开发轨道**不能教"把 VBS 关掉"**：那条建议的受众在逐月萎缩，而且是负安全建议。

**采用的写法**——三条路径各自讲清代价，并以第一条为教学载体：

| 路径 | 说明 | 定位 |
|---|---|---|
| **裸机拥有 VMX root / SVM** | 需要 VBS 关闭。架构在这里最可见 | **教学载体**，但开篇即声明它在现代 Windows 上正在失去可用性 |
| **在 Hyper-V 之下做嵌套** | 依赖 Hyper-V 暴露嵌套虚拟化 | 现实部署路径，必须给出检测与降级 |
| **改用 WHP API** | 那是**使用** hypervisor，不是写 | 明确划出：这不是本轨道的目标，但要告诉读者它存在 |

**第一件事必须是检测**：先读出"谁拥有 VMX root / SVM"，再决定能不能继续。
一个不做这件事的骨架在越来越多的机器上会静默失败。
PatchGuard 反而最矮——纯虚拟化不改任何它检查的 guest 可见字节，**这条要写明**，
因为流传中的材料普遍把它当成主要障碍。

### 3. 语言：**C + MASM**，以 `barevisor`（Rust）为现代参照

- **MSVC 的 x64 不支持内联汇编**，这是硬约束。C + 独立 `.asm` 是
  SimpleVisor / SimpleSvm / HyperPlatform 全都在用的写法。
- 骨架的用途是**被 AI 读懂，然后由它写出用户的代码**；而生态里的既有代码绝大多数是 C。
- 主参照 `tandasat/barevisor` 是 Rust，其**单一 OS-agnostic core + 厂商后端**的结构
  值得照搬（见第 4 点），但**语言不照搬**。

### 4. 挂载点：合并后技能里的第三棵子树 `references/dev/`

06 定下的结构是 `references/intel/` + `references/amd/`。开发轨道天然跨厂商——
骨架的绝大部分是共用的，只在少数点上分叉，**这正是 `barevisor` 的形状**。

```
references/
  intel/   ← 架构参考
  amd/     ← 架构参考
  dev/     ← 开发轨道：共用骨架 + 厂商分叉点路由回 intel/ 与 amd/
```

符合 07 的契约：`SKILL.md` 只路由到章名，`references/dev/NN-*.md` 就是更多章节。

**必须覆盖的部件**（取自 04 抽取的公共骨架，逐项标注 Intel / AMD 分叉）：
驱动入口与卸载 · 每处理器的 VMXON / VMRUN 上下文分配 · host GDT/IDT/栈 ·
EPT / NPT 恒等映射构建 · 退出分发循环 · CPUID 与 MSR 的拦截与仿真 ·
SMP bring-up · teardown · **VM entry 失败怎么调**。

**外加一章"已知陷阱"**，这是本轨道最有价值的部分，也是现有技能价值的延续
（"指出流传中的错误"）。开张的四条已经有了：

- **"每核一份 EPT" 从 12 代起退化**——4 个 E-core 共享一个 L2（`NoirVisor` #35）。
  **所有参考实现的默认写法都是错的。**
- **Zen 4 客户端声称支持 virtualized VMLOAD/VMSAVE，启用会随机重启**
  （`fam19h` 18h–1Fh 与 60h–7Fh；Linux commit `a5ca1dc46a6b`）。
  **四个主流实现无一带规避，且裸机 hypervisor 得不到内核那份保护。**
- **AVIC 的有无随微码翻转**，不随型号——同一个 `fam1Ah_model44h` 两种读数。
- **`HyperPlatform` 已于 2026-05-18 归档**；`Bareflank` 许可证存疑不得 vendor；
  `HyperDbg` 是 GPL-3.0 一行不能用。

### 5. 原创而非 vendor，且先决条件已解除

按 04 的结论写**原创 Apache-2.0 骨架**，不 vendor MIT 代码。
先决条件（仓库声明 Apache-2.0 却无 `LICENSE`）**已在 ticket 05 中补齐**。

### 6. "精通"怎么验收——交给 10，但判据在这里定

用户要的是"能随心所欲地写"，那验收就**不是答对事实，是写对代码**。
判据：给出部件名，要求 agent 写出该部件，**按"已知陷阱"清单评分**——
不踩已记录的陷阱才算过。这比事实召回难得多，细则见 ticket 10。
