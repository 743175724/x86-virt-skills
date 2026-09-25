# 07 分层读取与 token 预算契约

Type: grilling
Status: open
Blocked by: 06

## Question

**技能宣传的体积比真实体积小约 5 倍，这是 token 预算小的 agent 直接死掉的原因。**

`intel-vt/SKILL.md:31` 写 "Chapters `01`–`18` run 310–570 lines each"，
`amd-virtualization/SKILL.md:32` 写 "300–500 lines each"，
`docs/DEPLOYMENT.md:141` 再重复一遍。按行数没错。但平均行长 **184 字符**（Intel）/ 152（AMD）：

| 文件 | 行 | 字节 | 约 token | 最长行 |
|---|---|---|---|---|
| `intel-vt/references/13-tdx.md` | 568 | 104,500 | **~26.1k** | 909 |
| `intel-vt/references/04-vm-entry.md` | 415 | 68,688 | ~17.2k | 966 |
| `amd-virtualization/references/14-sev-snp.md` | 477 | 79,749 | ~19.9k | 737 |

两个 corpus 合计：Intel `references/` 约 **290k token**，AMD 约 **258k token**。

于是 `intel-vt/SKILL.md:49` 那句 "**Stop.** One chapter plus `errata.md` answers almost everything"
——对一个 TDX 问题来说是 **32k token**。照 `SKILL.md:50-51` 再拉第二章，一个答案 **45k token**。
预算小的 agent 如果无视指令直接 glob 目录，当场死亡。

还有一处误导：`SKILL.md:31-32` 说 `90-dated-landscape.md` 和索引文件"更短"——
它 180 行但 39,515 字节（约 10k token），**按真正要紧的度量比四个架构章节都大**。

**要决定的：**

1. **分层契约长什么样。** 一个 agent 在预算受限时，如何只读它需要的那一段？
   候选：章节内分节可寻址（`index.json` 已经带 section `headings`）；
   每章加一个 200 token 的摘要头；把 claim 的元数据（`[1]` `C:high` `V:durable`）
   挪出正文行；拆分超大章节（`13-tdx.md`、`14-sev-snp.md`）。
2. **体积怎么标注。** 行数是错的度量。改成字节？估算 token？
   `index.json` 已经有 `bytes` 和 `sha256` 字段，`SKILL.md` 要不要直接引用它们。
3. **claim 行格式要不要动。** 现在每条事实是一行
   `- **Claim.** <200-900 字符散文>  [SDM 3C §27.9.1] [1] C:high V:durable`。
   Intel 侧 2650 条 × 约 4 个元数据 token ≈ **10k token 的尾注**。
   **但这个格式正是这套资产可信的原因，不能为省 token 牺牲它。**
   问题是：查"bit 7 是什么"要读一段 900 字符的散文，而按 grep 做部分读取会从中间截断 claim。

## 依赖

必须先有 06 的结论：技能是一个还是两个，决定了分层是在技能内做还是跨技能做。

## 交付物

一份分层读取契约，明确写出"一个 agent 在 8k / 32k / 128k 三档预算下分别该读什么"。
