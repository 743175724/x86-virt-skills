# 05 仓库卫生：修正失真声明与残留

Type: task
Status: open
Blocked by: —

## Question

这是本图上唯一一个**做事**而非**做决定**的 ticket。它的存在理由是：
下面这些失真会让后续每一个 session 拿到错误的前提。

诊断查实的问题，逐条：

1. **`README.md:69-70` 计数错误**：写 "AMD has 26 and 6"，
   实际 `amd-virtualization/references/errata.md` 是 26 个 `### E` + **7** 个 `### O`
   （O1–O7 在 `:247, 254, 262, 268, 272, 283, 289`）。`lint.mjs` 不检查 README 计数。
2. **`README.md:165-171` 声称 CI 在每次 push / PR 上跑**——在本树上 CI 从未跑过
   （`.git` 刚由基线快照 `9192e4c` 重建，无远程仓库）。
3. **`README.md:218-224` 引用 commit 区间 `c40421e..736cc35` 和 14.7 MB pack 体积**——
   在本树上无法验证，历史已不存在。
4. **`docs/DEPLOYMENT.md:17` 的 `git clone git@github.com:743175724/x86-virt-skills.git`
   和 `:150` 的 `git pull`**——从本树执行都会失败。
   需要确认：这个远程仓库还存在吗？如果存在，本树与它的关系是什么？
5. **`docs/DEPLOYMENT.md:80` 声称 lint 有 "14 checks"**——工具不打印分项、无 `--help`，
   这个数字无法从工具本身验证。
6. **5 个孤儿 PNG，379 KB，每次安装都发货**：
   `amd-virtualization/references/images/` 下 5 个文件，
   grep 全部 `.md` / `.json` / `.yaml` 只在 `.scratch/` 里命中，**没有任何章节引用它们**。
   `.scratch/amd-virt-refine/images-disposition.md:21-28` 当初给每张图指派了新归属
   （`90-dated-landscape.md` §6/§3/§4、`18-performance.md`），删除那半做了，重新归位那半没做。
   决定：补做归位，还是删除。lint 不检查孤儿资源。
7. **AMD errata 的 O6 / O7 顺序颠倒**：`O7` 在 `errata.md:283`，`O6` 在 `:289`。
   向前扫描找 O6 的 agent 会走过头。
8. **`CLAUDE.md:1` 写着 `# Kimi_Agent`**——整个文件是另一个无关项目的 agent 约定副本，
   只讲 issue tracker / triage labels / domain docs，**只字不提这两个技能、不提路由、
   不指向 `AGENTS.md`**。而这正是 Claude Code 为本仓库加载的 project memory。

## 要求

- 每一条改动都要能被验证。改完跑 `node tools/lint.mjs` 和 `node tools/build.mjs --check`，
  两者必须仍然 clean。
- **不要顺手改内容**。本 ticket 只修失真的元信息与残留，不碰 claim。
- 第 6 条（孤儿图）和第 8 条（CLAUDE.md 写什么）需要先问用户，其余可直接做。
- 考虑给 `lint.mjs` 补两条规则：README 计数漂移、孤儿资源。但**加规则前先按本仓库既定做法
  注入一次违例证明它会触发**（`README.md:161-163` 的规矩）。

## 交付物

一次提交，commit message 逐条列出改了什么、依据是什么。
