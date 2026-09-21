# x86 virtualization skills

Specification-anchored knowledge-base skills for AI coding agents, covering
Intel and AMD hardware virtualization. Written to the
[Agent Skills](https://agentskills.io/specification) open standard, so the same
directory works in **Claude Code**, **OpenAI Codex** and **Hermes** without
translation.

| Skill | State | Scope |
|---|---|---|
| [`intel-vt/`](intel-vt/) | Rebuilt and verified | Intel VT-x/VMX, EPT/VPID, VT-d, APICv, nested VMX, TDX, and the Windows platform (Hyper-V, VBS/HVCI, WSL2) |
| [`amd-virtualization/`](amd-virtualization/) | Rebuilt and verified | AMD-V/SVM, VMCB, intercepts and #VMEXIT decoding, nested paging, AVIC, the AMD IOMMU, SME/SEV/SEV-ES/SEV-SNP, and the Windows platform |

Target platform is the **Windows PC**. The hardware chapters are CPU and chipset
architecture and are OS-independent; the platform, security and performance
chapters are written for Windows.

## Why this exists

Most virtualization knowledge bases are assembled from blog posts and secondary
translations. When an agent then answers a question about a VMCS field encoding
or a VT-d fault code, it produces something that reads authoritatively and is
wrong in a way nobody can check.

Both skills here are organised the other way round. Their chapters map onto the
vendor's own specification chapters, and **every architectural claim carries the
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

**`intel-vt`**

| Check | Result |
|---|---|
| Claims sampled against downloaded Intel PDFs | **431**, of which 28 were wrong and are fixed |
| Behavioural eval, answered blind and scored by separate agents | **427/447 (95.5%)** facts recalled |
| Misconceptions asserted across 80 questions | **0** |
| Citation validity | **79/80 (98.75%)** |
| Routing correct on first try | **80/80** |

**`amd-virtualization`**

| Check | Result |
|---|---|
| Claims checked against downloaded AMD PDFs by agents that did not write them | **2100**, of which 13 were wrong and are fixed |
| Error rate found by that pass | **0.62%** |
| Behavioural eval, answered blind and scored by separate agents | **497/508 (97.8%)** facts recalled |
| Misconceptions asserted across 80 questions | **0** |
| Citation validity | **80/80 (100%)** |
| Routing correct on first try | **79/80 (98.75%)** |

Confidence is stated, not assumed. `intel-vt`: 2228 claims `C:high`, 423
`C:medium`, 39 `C:low`, of 2650. `amd-virtualization`: 1913 `C:high`, 159
`C:medium`, 10 `C:low`, of 2065. Where sources genuinely disagree — VBS overhead, SEV-SNP versus TDX
memory overhead, TDX memory-encryption key length — the skills present both and
refuse to average them.

Each skill has an `errata.md`: Intel has 22 settled corrections and 6 open
conflicts, AMD has 26 and 6. Several correct claims the earlier version of that
skill made itself.
Five AMD entries are marked `[reversed]` because the *proposed correction* was
itself refuted by a primary source.

The AMD eval is written up in
[`eval/amd-virtualization/results/SUMMARY-2026-09-21.md`](eval/amd-virtualization/results/SUMMARY-2026-09-21.md),
including the four wrong keys it found and the four skill defects it exposed.
Every genuine miss was "the fact is present but was not found" rather than a
content gap — routing and placement, not coverage. There was exactly one real
content gap in 80 questions.

### What the AMD rebuild found

The chapters were written against locally downloaded PDFs, with section numbers
taken from PDF bookmark trees rather than memory. That mattered immediately: one
cached file turned out to be a 2,575-byte JavaScript shell that `docs.amd.com`
serves in place of a PDF, which a naive fetch stores as `.pdf` and reports as a
success.

The recurring hazard was subtler. **`pdftotext` silently mis-associates columns
in AMD's wide tables — it happened four separate times.** The worst case shifted
the VMSA swap-type column down one row, so every wrong cell held the value
belonging to the row above while the offsets and field names stayed correct. A
table damaged that way reads as entirely plausible and can only be caught by
returning to the rendered page.

Two errors were *fabricated negatives* — "AMD has no X" asserted without the
evidence a positive claim would have required. One said AMD has no counterpart
to Hyper-V's enlightened VMCS, when the Hypervisor Top-Level Functional
Specification defines an enlightened VMCB field block at VMCB `3E0h`–`3FFh`
governed by clean bit 31; that chapter had the corroborating Linux definition in
its own citation and drew the opposite conclusion from it. The other said
Microsoft states no processor requirement for nested virtualization on AMD,
which was an artefact of a text-extraction proxy silently dropping an `<h3>`
heading. Both are corrected, and the work contract gained a rule: **a negative
claim needs the same evidence as a positive one, and must be scoped to a
document and revision.**

## Install

```bash
node tools/install.mjs          # into this repo
node tools/install.mjs --user   # also into your home directory
```

This places each skill where its host looks for it, using directory junctions
on Windows, which need no elevation. `AGENTS.md` at the repo root is a
generated pointer, not a copy, so it cannot drift.

**The hosts do not agree on where to look, and one of them does not look here
at all.** Claude Code reads `.claude/skills/`, Codex reads `.agents/skills/`
plus `AGENTS.md`, and **Hermes reads neither** — it scans `<HERMES_HOME>/skills`
only, so it needs `--user` or an entry in its `skills.external_dirs`.
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) has the verified path for each host,
the Hermes configuration, and troubleshooting.

Any other agent with filesystem access can start from `<skill>/index.json`.

## Maintaining it

```bash
node tools/lint.mjs         # schema, anchors, quarantine, routing, and more
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

The same principle appeared twice more during the AMD rebuild, from the other
direction: AMD's Revision Guides and its memory-encryption white paper are real,
citable sources that the anchor grammar had no *shape* for, so an author could
either invent one or declare a gap. They declared the gap, correctly, and the
grammar was extended rather than the authors asked to improvise.

Every lint rule added during the rebuild was proved non-vacuous by injecting a
violation, confirming it fires, and removing it again. A silent rule and a
broken rule look identical from the outside.

Both checks, plus a smoke test of the install script, run in CI on every push
and pull request against Node 20 and 24 — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). Each gate was verified
to fail on a real regression before it was committed, for the same reason: a CI
step that cannot fail is indistinguishable from one that is not running. CI
does **not** run the behavioural eval, which needs one agent to answer from the
skill and a different one to score.

`eval/` holds a golden set per skill — 80 questions each — and `eval/RUNNER.md`,
the scoring protocol both share. Run it in a fresh session; answering and scoring
must be done by different agents.

## Known limits

- Dated facts are a snapshot: **2026-09-16** for `intel-vt`, **2026-09-21** for
  `amd-virtualization`. Nothing later is covered, and each skill quarantines
  those facts in a single `90-dated-landscape.md`.
- No modern (Ice Lake / Sapphire Rapids / Granite Rapids / any client part)
  public cycle-level VM-exit measurement exists in the Intel corpus either. The
  newest hard figure there is Westmere-era, 2010. Both skills say so rather than
  extrapolating.
- Two VT-d claims about a chipset erratum carry an unverified anchor, marked
  `C:low`.
- Eval scoring is done by agents from the same model family as the answerers.
  They are separate agents, which removes self-grading, but not family-level
  correlation. One category was re-scored by a different model as a check:
  it disagreed on 1 item of 47, about 2 percentage points, and adjudicating
  against the quoted answer showed the *original* scorer was right and the
  cross-model one under-credited. That is a variance measurement, not a bias
  measurement — a real test needs a scorer from a different vendor.
- Both eval runs found the *answer key* wrong more often than the skill: five
  keys on the Intel side, four on the AMD side. Scorers are given explicit
  authority to mark an item `key-disputed` and check the specification instead,
  because a key that is wrong will otherwise train the corpus toward the error —
  on the Intel side one key rewarded an answer that would have shipped a
  lost-interrupt bug.
- `learn.microsoft.com` was unreachable directly from the build environment, so
  Windows claims were verified through a text proxy. That proxy drops HTML
  headings, which caused one of the errors above — re-fetch with HTML preserved
  before trusting a negative statement about a Microsoft page.
- AMD publishes **no errata channel for client parts**: no public revision guide
  and no public PPR for client Ryzen. Client errata claims say so rather than
  cite a document that does not exist.
- There is **no public cycle-level AMD VMRUN/#VMEXIT measurement** on any part,
  and exactly one figure in `18-performance.md` was measured on a client part.

## Licence

Apache-2.0. Intel, AMD and Microsoft documents are cited, never reproduced; see
each skill's `references/bibliography.md` for its source list. Each chapter
names the publication number and revision it was verified against, so the
sources can be re-fetched rather than redistributed.

One caveat, stated because it is still true of the history rather than the
working tree: between `c40421e` and `736cc35` a 12.5 MB copy of the Intel VT-d
specification and its text extractions were committed under `.scratch/` as
working artifacts of a verification pass. They are untracked and gitignored
now, but the blobs remain in the pack, so a fresh `git clone` still fetches
about 14.7 MB of them. Removing them for good needs a history rewrite and a
force-push.
