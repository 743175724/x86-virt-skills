# x86 virtualization skills

This repository is **not application code**. It is two specification-anchored
knowledge-base skills for AI coding agents — `intel-vt/` and
`amd-virtualization/` — covering Intel and AMD hardware virtualization on the
Windows PC. Roughly 16,000 lines of reference chapters carrying ~4,700 claims,
each anchored to a vendor document by publication number and section.

**Read `AGENTS.md` at the repo root before answering anything these skills
cover.** It is generated from each `SKILL.md` by `tools/build.mjs` — never edit
it by hand.

## What makes this repo unusual

Its value is **epistemic discipline**, not coverage. Several rules here exist
because a real defect got through, and they are load-bearing. Breaking them
silently is the worst thing you can do to this repository.

- **Every architectural claim carries its source.** The line format is
  `- **Claim.** <statement>  [<anchor>] [<N>] C:<conf> V:<volatility>`, where
  the anchor is a vendor document and section, `[N]` resolves in that skill's
  `references/bibliography.md`, and volatility is `durable` or `dated`.
- **A negative claim needs the same evidence as a positive one**, scoped to a
  document and a date. This is now enforced by lint rule 4c, because it was
  written in the work contract for two defects and did not prevent a third —
  see `amd-virtualization/references/errata.md` `E27`.
- **Dated facts are quarantined.** Anything with a GA date, version number,
  price or market share lives in that skill's `90-dated-landscape.md` and
  nowhere else. Lint enforces it.
- **Declare a gap rather than fill it.** If a source does not document
  something, say so. `[no-spec]` is the explicit, audited escape hatch for a
  claim no specification covers. A rule that cannot be satisfied honestly will
  be satisfied dishonestly — that is how ~90 fabricated anchors once entered
  this corpus.
- **A lint rule must be proved non-vacuous** by injecting a violation,
  confirming it fires, and removing it. A silent rule and a broken rule look
  identical from the outside.

## Before you commit

```bash
node tools/lint.mjs          # must print "lint clean" for both skills
node tools/build.mjs --check # must print "generated files are up to date"
```

`tools/build.mjs` regenerates `index.json`, `agents/openai.yaml` and
`AGENTS.md`. Run it after editing any chapter, or the drift check fails.

`eval/` holds an 80-question golden set per skill plus `eval/RUNNER.md`.
CI does **not** run it: answering and scoring must be done by different agents
in fresh sessions.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/`.
See `docs/agents/issue-tracker.md`.

The live effort is the **v2 rebuild**, mapped at
`.scratch/virt-skills-v2/map.md` — read that map before touching structure,
routing, `SKILL.md`, or anything about CPU-model coverage or hypervisor
development. Decisions already taken are indexed there, and
`docs/adr/0001-one-skill-two-reference-trees.md` records the top-level one.

### Triage labels

The five canonical roles, unchanged: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` plus `docs/adr/` at the repo root.
See `docs/agents/domain.md`.

## Installing the skills

```bash
node tools/install.mjs          # into this repo
node tools/install.mjs --user   # also into your home directory
```

Hosts disagree on where to look: Claude Code reads `.claude/skills/`, Codex and
Kimi Code CLI read `.agents/skills/`, Kimi also reads `.kimi-code/skills/`, and
Hermes scans only its own home. `docs/DEPLOYMENT.md` has the verified path per
host. Both link directories are gitignored, so a fresh clone has neither until
`install.mjs` runs.
