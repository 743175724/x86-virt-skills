# 03 · 章节骨架、范围标注与图片处置

Status: ready-for-agent
Type: task
Blocked by: 02
Spec: `.scratch/amd-virt-refine/spec.md` §D1, §D9, §D14

## 范围

### 1. 建立 20 个章节文件的骨架

按 spec §D1 的文件名创建 `amd-virtualization/references/` 下的全部文件，每个只含头部区块（正文留空，由各章票填写）：

```markdown
# NN. <English Chapter Title>

> **中文速览**：<3–5 句：本章覆盖什么、什么时候读它、与哪几章相邻>

**Maps to:** <AMD 官方文档 + 章/附录 + 修订> [N]
**Owns:** <本章独占的事实主题，抄自 CONVENTIONS 的归属表>
**Scope:** OS-independent hardware | client-only | **server scope** | Windows (Tier-2)
**See also:** `<other-file>.md`

---
```

`12`/`13`/`14` 三章的 `Scope:` 行后必须紧跟一段醒目声明：**服务器/机密计算专题；客户端 Windows PC 上不存在（`Fn8000_001F EAX[1]` 在 Ryzen 上读 0）；仅在问题涉及 EPYC 时阅读。**

`90-dated-landscape.md` 头部写入 as-of 日期、"使用前必须以官方来源复核"声明、按类别的分节骨架。

### 2. 逐章 Scope 判定

对 `01`–`11` 每章，明确写出该章内容在客户端 Ryzen 上的可用性差异（例：AVIC 在客户端的固件启用状态、SR-IOV 在消费级平台不存在、SME/TSME 在 Ryzen PRO 与非 PRO 上的差异）。判定结果写进 `Scope:` 行下方一句话，作为该章作者的边界约束。

### 3. 图片逐张处置（14 张）

对 `references/images/` 的每张 PNG 给出处置结论并执行：

| 处置 | 判据 |
|---|---|
| 保留 | 图含量化信息、与重写后的事实一致、有 owner 章引用它 |
| 迁入 `90` | 时间线 / 路线图 / 代际演进类（`sec10_abi_timeline`、`sec11_attack_surface_timeline`、`sec12_kvm_sev_timeline`、`sec08_asid_keys_evolution` 等） |
| 删除 | 顶替缺失表格的示意图（`sec03_vmcb_layout` 属此类——原图注自承"块高不代表字节数"），或与勘误冲突的图 |

删除的图**不补画**；对应信息由表格承担。处置清单写入 `.scratch/amd-virt-refine/images-disposition.md`，每张一行含理由。

另：旧 `01-overview.md` 引用了一张名为 `sec01_sev_key_slots.png` 的图却从未嵌入（正文把读者指向 8.2.1 节），这类孤儿资产按删除处理或迁给真正的 owner 章。

## 完成判据

- 20 个章节文件 + `errata.md` + `core-facts.md` 骨架就位，头部五行齐全。
- 每个 `Maps to:` 引用的文档编号在 CONVENTIONS §5 的已核验清单内，或按降级规则写成章/附录级。
- `images-disposition.md` 覆盖全部 14 张，无"待定"。
- `node tools/build.mjs` 能为 `amd-virtualization` 生成 `index.json`（此时章节正文为空，允许）。
