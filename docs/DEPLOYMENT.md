# Deploying these skills

> **中文速览**：本文讲怎么把 `intel-vt` 和 `amd-virtualization` 装进各个 AI 宿主。
> 一句话版本：`node tools/install.mjs`（项目级）或 `node tools/install.mjs --user`（全局）。
> **但每个宿主找技能的地方不一样，而且 Hermes 不会扫描这个仓库**——它只读自己的
> `<HERMES_HOME>/skills`，所以项目级安装对它无效，必须用 `--user` 或配 `external_dirs`。
> 下面每条路径都是在本机实测过的，不是照抄文档。

Two skills, one repository. Each is a directory holding `SKILL.md` plus a
`references/` folder, written to the [Agent Skills](https://agentskills.io/specification)
specification, so the same directory is consumed by several hosts without
translation.

## Quick start

```bash
git clone git@github.com:743175724/x86-virt-skills.git
cd x86-virt-skills
node tools/install.mjs          # this repo only
node tools/install.mjs --user   # also into your home directory, for every project
```

No dependencies, no build step, no package manager. The tools are plain Node
ESM and run on Node 20 or later.

## Where each host looks

This is the part that actually matters, and the part that is easy to get wrong.
Every path below was verified on a Windows machine with the host installed.

| Host | Reads | Project scope | User scope |
|---|---|---|---|
| **Claude Code** | `<dir>/skills/<name>/SKILL.md` | `.claude/skills/` ✅ | `~/.claude/skills/` |
| **OpenAI Codex** | `<dir>/skills/<name>/SKILL.md`, plus `AGENTS.md` at startup | `.agents/skills/` ✅ | `~/.agents/skills/` |
| **Hermes** | `<HERMES_HOME>/skills/<name>/` | **✗ does not scan the repo** | `%LOCALAPPDATA%\hermes\skills` on Windows, `~/.hermes/skills` elsewhere |
| **Anything else** | `<name>/index.json` | — | — |

### Hermes needs care

Hermes resolves its home as `HERMES_HOME` → platform default, and reads skills
only from `<home>/skills` plus any directory listed under `skills.external_dirs`
in its `config.yaml`. **It does not look at `.agents/skills/` in your project.**
So a project-scope install leaves Hermes unaware of these skills.

Two ways to fix that. Either install to the user scope:

```bash
node tools/install.mjs --user
```

or keep the repo as the single source and point Hermes at it:

```yaml
# Hermes config.yaml
skills:
  external_dirs:
    - /path/to/x86-virt-skills/.agents/skills
```

The second keeps one copy on disk, so edits to the repo are live in Hermes.

Confirm either way with:

```bash
hermes doctor          # "Skills Hub directory exists", skill count
```

### A note on the Windows path

Earlier versions of `install.mjs` hard-coded `~/.hermes/skills` on every
platform. That is right on Linux and macOS and **wrong on Windows**, where
Hermes uses `%LOCALAPPDATA%\hermes`. The script used to create the wrong
directory and report success. If you installed with an older checkout, delete
the stray `~/.hermes` and re-run.

## Verifying the install

```bash
node tools/install.mjs          # prints one line per host and path
node tools/lint.mjs             # 14 checks; must print "lint clean" for both skills
node tools/build.mjs --check    # generated files must not have drifted
```

Then ask the host a question the skill owns and check it cites a section:

- Intel: *"What does exit qualification bit 7 mean for an EPT violation?"*
- AMD: *"Which CPUID bit enumerates x2AVIC?"* (the answer is `Fn8000_000A EDX[18]`,
  and a host that says `EDX[14]` is not reading the skill — that is a known
  misconception the corpus corrects.)

A correct answer names the document, revision and section. An answer without a
citation means the skill was not loaded.

## Links versus copies

By default the installer creates **directory junctions** on Windows and
symlinks elsewhere, both pointing at the source directory. Junctions need no
elevation, which is why they are the default rather than symlinks.

```bash
node tools/install.mjs --copy   # snapshot instead of a link
```

A link means edits to the repo are picked up with no reinstall. A copy is a
snapshot and must be re-run after any change. Use `--copy` when the host cannot
follow links, or when you want a frozen version.

To remove everything the installer created:

```bash
node tools/install.mjs --uninstall
```

It removes only what it made. **It is not a no-op on a working setup** — if you
run it to test something, re-run the install afterwards.

## Installing one skill

```bash
node tools/install.mjs intel-vt
node tools/install.mjs amd-virtualization --user
```

The two are independent. `intel-vt` answers Intel-primary questions and both
sides of a comparison; `amd-virtualization` answers AMD-primary ones. Each
`SKILL.md` names the other in its scope boundaries, so a host with only one
installed will say when a question belongs to the other rather than guessing.

## For a host that is not listed

Start from `<name>/index.json`. It is generated from the chapters and carries,
for every one of them: the path, title, a Chinese summary, the specification
chapter it maps to, its section headings, its byte length and a SHA-256.

```bash
node -e "const j=require('./amd-virtualization/index.json');
         console.log(j.chapters.map(c => c.path + '  ' + c.title).join('\n'))"
```

The contract is: read `SKILL.md`, use its routing table to pick **one** chapter,
read that chapter. Do not load the directory — the chapters are 300–570 lines
each and loading all of them wastes the context the routing exists to save.

`AGENTS.md` at the repository root is a generated pointer that Codex reads at
startup. It is not a copy of anything, so it cannot drift.

## Keeping it current

```bash
git pull
node tools/build.mjs            # only if you edited chapters
node tools/install.mjs --copy   # only if you installed with --copy
```

A junction install needs nothing after a pull. CI runs lint, the drift check
and an install smoke test on every push, so a clone that passes `git pull` is a
clone whose skills load.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Host does not offer the skill | Wrong directory for that host — check the table above. Hermes especially. |
| Hermes still cannot see it after `--user` | Stale `~/.hermes` from an older checkout; the real path is `%LOCALAPPDATA%\hermes\skills` on Windows. |
| Answers have no citations | The skill is installed but not being loaded; check the host lists it, and that `SKILL.md`'s frontmatter parsed. |
| `lint.mjs` reports "missing YAML frontmatter" | `SKILL.md` has CRLF line endings. The frontmatter check tests for `---\n` exactly. Convert to LF. |
| Edits do not take effect | You installed with `--copy`. Re-run it, or reinstall without `--copy` to get a link. |
| Skills vanished after running a test | Something ran `--uninstall`. Re-run `node tools/install.mjs`. |
