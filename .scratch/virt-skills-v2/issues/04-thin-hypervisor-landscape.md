# 04 开源 thin hypervisor 参考实现现状调研

Type: research
Status: claimed
Blocked by: —

## Question

用户的原话是希望 AI「精通这门技术，不单单是修复，编写开发都能随心所欲地实现」。
但诊断显示：整个约 548k token 的 corpus 里，**开发内容几乎为零**——
Intel 侧仅 3 段 C 代码且被明确免责为"只展示顺序，不引入新事实"
（`01-vmx-intro.md:64-85`、`02-vmcs.md:63-80`、`03-nonroot-operation.md:138-155`），
**AMD 侧零代码**。`SimpleVisor` / `HyperPlatform` / `hvpp` / `bareflank` 命中全为 0。
"thin hypervisor" 全库出现 1 次，还是在 `15-security.md:279` 把 Blue Pill 当 rootkit 描述。

**调研现有开源轻量级 hypervisor 实现，回答：v2 的开发轨道应该站在谁的肩膀上。**

需要覆盖：

1. **项目清单与现状**：SimpleVisor、HyperPlatform、hvpp、Bareflank、
   Hypervisor From Scratch 系列，以及其他仍在维护的。逐个给出：
   目标平台（Windows 驱动 / UEFI / 裸机）、Intel 还是 AMD 还是双支持、
   **最后更新时间**、许可证。
2. **能不能在现代硬件上跑**：这些项目大多写于 Skylake 时代。
   查清有没有已知的在 **12 代混合核 / Arrow Lake 无超线程 / Zen 4-5** 上的失败报告或适配 PR。
   这直接决定 ticket 09 里"按型号查"的实际价值。
3. **最小骨架由哪些部分组成**：从这些实现里抽取共性——
   驱动入口 / 每处理器 VMXON 或 VMRUN 的上下文分配 / host GDT-IDT-栈 /
   EPT 或 NPT 恒等映射构建 / 退出处理分发循环 / CPUID 与 MSR 的拦截与仿真 /
   SMP bring-up / 卸载与 teardown。列出清单，标注 Intel 与 AMD 的差异点。
4. **教学材料的坑**：这些项目 / 教程里有没有**已知是错的或已过时**的做法，
   会被 AI 学去然后到处复制？这是 v2 最值得写的内容之一——
   现有技能的价值正来自"指出流传中的错误"。
5. **许可证与引用边界**：本仓库的既定立场是
   *"Intel, AMD and Microsoft documents are cited, never reproduced"*。
   开源代码适用同样立场吗？v2 能不能内含可编译的骨架代码，还是只能描述结构？
   **这一条会直接约束 08 的可选项，必须给出明确结论。**

## 交付物

`.scratch/virt-skills-v2/research/04-thin-hypervisor-landscape.md`：
项目对照表 + 最小骨架的公共部件清单（Intel / AMD 对照）+ 已知陷阱清单 + 许可证结论。
