---
status: accepted
date: 2026-09-26
---

# One skill, two reference trees

The Intel and AMD knowledge bases ship as a single skill with one `SKILL.md` that routes by
vendor internally, over `references/intel/` and `references/amd/` which keep their separate
chapter sets and separate bibliographies. They were two sibling skills until v2.

The reason is that **no host arbitrates between skills.** A survey of eight hosts — Claude
Code, OpenAI Codex, Kimi Code CLI, Cline, Gemini CLI, Windsurf, Cursor, Hermes — found that
not one performs harness-side trigger matching. Every one of them hands the model a name and
a `description` and lets it choose, and the Agent Skills specification says so itself:
*"Most implementations rely on the model's own judgment as the activation mechanism, rather
than implementing harness-side trigger matching."*

Two sibling skills therefore need the model to arbitrate from `description` alone, and that
is precisely where the old structure failed. The rule that resolved Intel-versus-AMD lived
only in the generated root `AGENTS.md`, which Claude Code never loads and `tools/install.mjs`
never installs, so under a user-scope install it did not exist at all. Both `SKILL.md` files
separately claimed ownership of two-way comparisons, and their `description`s shared eight
trigger tokens — `IOMMU`, `IRTE`, `Hyper-V`, `VBS`, `HVCI`, `WSL2`, `Kernel DMA Protection`,
`hypervisor` — which is most of what a Windows platform question contains. Each description
did carry a sibling-deferral sentence, but at the end, exactly where Claude Code (1,536
characters plus 1% of budget) and Codex (2% of budget or 8,000 characters, documented to
shorten skill descriptions first) truncate. And `description` is the only field portable
across all hosts: Cline and the claude.ai upload path enforce a closed frontmatter whitelist,
so a custom ownership field is rejected.

Merging moves arbitration into the `SKILL.md` body, which loads whole, is never truncated,
and is not whitelist-governed.

## Considered options

**Keep two skills and rewrite both descriptions** — front the deferral sentence, drop the
eight shared tokens, and write to the strictest 1,024-character limit. Rejected because
dropping the shared tokens makes a question that contains only those tokens trigger
*neither* skill, and because arbitration would still rest on model judgement under
truncation. It also leaves the user-scope install with no tie-break rule at all.

**Merge into a single reference tree** with interleaved chapters and one bibliography.
Rejected on cost against benefit: the corpus carries **6,616 `[N]` bibliography citations**
(3,823 Intel, 2,793 AMD) against 318 + 198 entries, so a merged bibliography means
renumbering roughly 2,793 citations. Keeping one bibliography per subtree scopes `[N]`
within its own tree and renumbers nothing. The behavioural eval already scores 95.5% and
97.8% fact recall with the vendor split, so interleaving buys no measured recall.

## Consequences

- **The 2,531 specification anchors are untouched.** They cite vendor documents
  (`[SDM 3C §30.2.1]`), not file paths, so merging does not reach them. Only the path prefix
  changes and the two `lint.config.json` files combine.
- **Eleven broken paths are fixed for free.** `amd-virtualization/references/` hard-codes
  eleven repo-root-relative paths into the Intel skill (nine in `16-windows-platform.md`, two
  in `19-comparison-intel-arm-riscv.md`) which resolve to 404 from the file that contains
  them. Inside one skill they become intra-skill paths and start working.
- **`[N]` is scoped per subtree, not globally.** Lint must enforce that a citation resolves
  against its own tree's bibliography, and must reject a cross-tree `[N]`.
- **Installing only one vendor is no longer possible.** That option was already broken in one
  direction by the eleven hard-coded paths, so little is lost, but a reader expecting to
  install a single vendor should be told plainly.
- **One description must now carry both vendors plus two new tracks** — hypervisor
  development and per-CPU-model behaviour, neither of which appeared in either old
  description, which is why "how do I write a hypervisor" triggered nothing at all.
