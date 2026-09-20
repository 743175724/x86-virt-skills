# x86 virtualization skills

Specification-anchored knowledge-base skills for AI coding agents, covering
Intel and AMD hardware virtualization. Written to the
[Agent Skills](https://agentskills.io/specification) open standard, so the same
directory works in **Claude Code**, **OpenAI Codex** and **Hermes** without
translation.

| Skill | State | Scope |
|---|---|---|
| [`intel-vt/`](intel-vt/) | Rebuilt and verified | Intel VT-x/VMX, EPT/VPID, VT-d, APICv, nested VMX, TDX, and the Windows platform (Hyper-V, VBS/HVCI, WSL2) |
| [`amd-virtualization/`](amd-virtualization/) | Original format; rebuild planned | AMD-V/SVM, VMCB, NPT, AVIC, IOMMU, SEV/SEV-ES/SEV-SNP |

Target platform is the **Windows PC**. The hardware chapters are CPU and chipset
architecture and are OS-independent; the platform, security and performance
chapters are written for Windows.

## Why this exists

Most virtualization knowledge bases are assembled from blog posts and secondary
translations. When an agent then answers a question about a VMCS field encoding
or a VT-d fault code, it produces something that reads authoritatively and is
wrong in a way nobody can check.

`intel-vt` is organised the other way round. Its chapters map onto Intel's own
specification chapters, and **every architectural claim carries the Intel
document, revision and section it came from**:

```
- **Claim.** <statement>  `[SDM 3C §30.2.1]` `[1]` `C:high` `V:durable`
                          ^ Intel anchor   ^ source  ^ confidence ^ volatility
```

`V:dated` marks a fact that will expire. Those are quarantined in a single file
with an as-of date and a re-verification warning, so a GA date can never be
mistaken for architecture.

## What is actually verified

Numbers below are from the checks in [`eval/`](eval/), all reproducible.

| Check | Result |
|---|---|
| Claims sampled against downloaded Intel PDFs | **431**, of which 28 were wrong and are fixed |
| Behavioural eval, answered blind and scored by separate agents | **427/447 (95.5%)** facts recalled |
| Misconceptions asserted across 80 questions | **0** |
| Citation validity | **79/80 (98.75%)** |
| Routing correct on first try | **80/80** |

Confidence is stated, not assumed: 2014 claims `C:high`, 494 `C:medium`,
48 `C:low`. Where sources genuinely disagree — VBS overhead, FlexPriority's
first generation, TDX memory-encryption key length — the skill presents both
and refuses to average them.

`errata.md` carries 28 corrections to claims that circulate widely and are
wrong, including several the earlier version of this skill made itself.

## Install

```bash
node tools/install.mjs          # into this repo
node tools/install.mjs --user   # also into your home directory
```

This places the skill where each host looks for it — `.agents/skills/` for Codex
and Hermes, `.claude/skills/` for Claude Code — using directory junctions on
Windows, which need no elevation. `AGENTS.md` at the repo root is a pointer, not
a copy, so it cannot drift.

Any other agent with filesystem access can start from `intel-vt/index.json`.

## Maintaining it

```bash
node tools/lint.mjs         # 12 checks over schema, anchors, quarantine, routing
node tools/build.mjs        # regenerate index.json, agents/openai.yaml, AGENTS.md
node tools/build.mjs --check   # fail if a generated file has drifted
```

The linter enforces what can be enforced mechanically: every claim carries a
source; every `[N]` resolves; Tier-1 anchors match the real grammar; a `V:dated`
fact cannot escape its quarantine; the routing table points at sections that
exist; known misconceptions cannot reappear; and a claim about a subject the SDM
does not document — HVCI, VTL, a CVE — cannot be anchored to the SDM alone.

That last rule exists because the opposite rule caused a real defect: demanding
an Intel anchor on every claim in a Windows-security chapter produced ~90 claims
citing real section numbers that discuss unrelated subjects. **A rule that
cannot be satisfied honestly will be satisfied dishonestly.**

`eval/` holds the 80-question golden set and the protocol for running it. Run it
in a fresh session; answering and scoring must be done by different agents.

## Known limits

- Dated facts are a snapshot of **2026-09-16**. Nothing later is covered.
- No modern (Ice Lake / Sapphire Rapids / Granite Rapids / any client part)
  public cycle-level VM-exit measurement exists in the corpus. The newest hard
  figure is Westmere-era, 2010. The skill says so rather than extrapolating.
- Two VT-d claims about a chipset erratum carry an unverified anchor, marked
  `C:low`.
- Eval scoring is done by agents from the same model family as the answerers.
  They are separate agents, which removes self-grading, but not family-level
  correlation.
- `amd-virtualization/` has not been through this process yet.

## Licence

Apache-2.0. Intel and Microsoft documents are cited, never reproduced; see
`intel-vt/references/bibliography.md` for the source list.
