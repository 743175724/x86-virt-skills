# Evaluation sets

Four sets and one protocol. Nothing here runs in CI: every set needs one agent
to answer and a different agent to score, in a fresh session, and the routing
probes additionally need several hosts and visible tool calls.

| Set | Questions | Validated by | Measures |
|---|---|---|---|
| [`intel/questions.yaml`](intel/questions.yaml) | 80 | `x86-virt/references/intel/lint.config.json` | content recall, Intel |
| [`amd/questions.yaml`](amd/questions.yaml) | 80 | `x86-virt/references/amd/lint.config.json` | content recall, AMD |
| [`dev/questions.yaml`](dev/questions.yaml) | 20 | `x86-virt/references/dev/lint.config.json` | diagnosis, traps, build, gaps |
| [`routing-probes.yaml`](routing-probes.yaml) | 24 | — | **did the skill trigger, and route to the right chapter** |

Protocol for all four: [`RUNNER.md`](RUNNER.md).

## Why the sets stay separate

The v2 spec called for merging the two vendor sets into one with a `vendor:`
tag per question, on the reasoning that there is now only one skill. Building it
showed that reasoning to be wrong, and the sets are kept separate deliberately.

`lint.mjs` validates each set **against the subtree it belongs to**: that every
`chapter:` exists there, that every `required_citation` matches that subtree's
anchor grammar, and that no numeric value in a `must_include` has drifted out of
that subtree's corpus. The grammars are vendor-specific — an SDM section and an
APM section have nothing in common but the word "section" — so a merged file
could only be checked against the union of both, which accepts an Intel anchor
on an AMD question and an AMD chapter name on an Intel one.

**A merged set would have cost a mechanical check and bought a tag.** The
per-set split is not legacy structure; it is the structure that can be verified.

## New in v2

Three question types and one whole protocol did not exist before, and each was
added because the old sets were blind to a failure the rebuild was started for:

- **`routing-probes.yaml`** — the old sets all ran in one host and measured
  content recall, so they could not see an agent that never loaded the skill or
  loaded it and opened the wrong chapter. That was the reported problem. Eight
  of its probes name no vendor at all; under the previous two-skill layout those
  questions had no defined answer, and they are why the skills were merged.
- **`build` questions** — scored against the enumerated trap list rather than
  for resemblance to any reference implementation, and never compiled. "Compiles
  but bugchecks on a hybrid part" is the dangerous outcome, and only the trap
  list catches it.
- **`gap` questions** — the correct answer is a scoped "cannot be determined",
  and naming the gap correctly scores full marks. Scoring that as a miss is how
  a corpus is trained toward fabrication; this one has already produced three
  fabricated negatives without the rule.

## Standing limit

Scorers and answerers come from the same model family. One category was
re-scored by a different model as a check: it disagreed on 1 item of 47, and
adjudicating against the quoted answer showed the *original* scorer was right.
That is a **variance** measurement, not a **bias** measurement. A real test
needs a scorer from a different vendor, and v2 does not change this.
