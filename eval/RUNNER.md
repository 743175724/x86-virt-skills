# Skill evaluation protocol

Shared by every skill in this repository. The question set, the answers and the
run reports are per skill, under `eval/<skill>/`; this file is the scoring
contract they all use.

The single behavioural test seam for a skill: **given a question, can a fresh
agent that has only this skill answer it correctly, completely, and traceably?**

Nothing here tests file structure or internal headings — those are implementation
details that should be free to change. `tools/lint.mjs` covers the formal side.

## Running it

Any agent that can read files can run this on itself. No vendor API required.

1. Start a **fresh session** with no prior Intel VT context in the conversation.
   A session that has already discussed the subject will pass questions the
   skill alone would fail, which is exactly the measurement error this protocol
   exists to avoid.
2. Load the skill the way its host normally would — `<skill>/SKILL.md`, then
   whatever chapters the routing table sends you to. **Do not pre-load every
   chapter**: part of what is being measured is whether the routing works.
3. For each question in `eval/<skill>/questions.yaml`, answer from the skill alone. No
   web search, no recall from pre-training that the skill does not support. If
   the skill does not contain the answer, say so — that is a legitimate result
   and more useful than a confident guess.
4. Score each question:
   - **must_include** — each listed fact either appears in the answer or does
     not. Partial credit per item, not per question.
   - **must_not_include** — if any listed misconception appears, the question
     scores **zero** regardless of everything else. These are the trap items.
   - **required_citation** — the answer must name the vendor document and the
     chapter, section or table. A bare "per the manual" does not count.
5. Write results to `eval/<skill>/results/<agent>-<YYYY-MM-DD>.md` using the
   template below.

## Pass bar

| Metric | Threshold |
|---|---|
| `must_include` hit rate | ≥ 90% |
| `must_not_include` violations | **0** |
| `required_citation` validity | ≥ 95% |

A single `must_not_include` violation fails the run. The trap questions encode
errors the previous version of this skill actually made; regressing on one means
the rebuild has lost its point.

## Scoring honestly

The scorer is usually the same agent that answered, which is a conflict of
interest. Two rules keep it usable:

- Score **literally**. If `must_include` says `bit 7 = guest-linear-address
  valid` and the answer said "bit 7 indicates the linear address is recorded",
  that is a hit. If the answer said "bit 7 indicates the physical address is
  valid", that is a miss *and* a trap violation. Do not argue the answer into
  a hit. (That example is from `intel-vt`; the principle is the point.)
- **A refutation is not a violation.** `must_not_include` catches an answer that
  *asserts* a misconception, not one that names it in order to correct it.
  "The claim that Intel has no ASID mechanism is wrong — it has PCID and VPID"
  contains the banned words but takes the opposite position, and scores as a
  pass. Record it as *refuted, not asserted*, and quote it. The banned strings
  are written in assertion form to make this distinction mostly mechanical; when
  one still fires inside a correction, the correction wins. (The corpus itself
  quotes these misconceptions — `18-comparison-amd-arm-riscv.md` has a section
  literally titled after the ASID error — so a pure substring rule would fail
  the skill for doing exactly what it is supposed to do.)
- Record the **verbatim answer** for every failed item. A failure you cannot
  quote is a failure you did not really have.

## Three scoring authorities (new in v2)

These override the ordinary rules above where they apply. Each exists because
without it the run would mark the skill down for behaving correctly, and a
scoring rule that punishes correct behaviour trains the corpus toward the
defect it was meant to prevent.

### 1. Naming a gap scores full marks

`type: gap` questions have no factual answer. The correct response is that the
knowledge base cannot determine this, **together with the scope of what is
missing**. An answer that says so and names the gap correctly scores a **full
hit on every `must_include` item**, exactly as a factual answer would.

Scoring "I don't know" as a miss is how a corpus gets trained toward
fabrication. This repository's own history records three fabricated negatives,
the last standing in ten places with its refutation three lines away in its own
bibliography; the rule that was supposed to prevent it lived in prose and did
not. An answer that hedges *vaguely* — "this may not be documented" with no
scope — is still a miss. The scope is the answer.

This extends the existing authority to mark a key `key-disputed` and check the
specification instead. Both runs of the AMD set found the key wrong more often
than the skill.

### 2. Reading a whole chapter is a partial failure

The tiered contract in `SKILL.md` exists because a section averages about 1,100
tokens and a chapter runs to 26,000. An answer that is factually correct but
reached by reading the whole chapter **scores the content items normally and
fails the tier item**, because over-reading is the defect the contract was
written to fix, and an eval that cannot see it will report a skill as healthy
while every answer costs twenty times what it should.

Record the tier actually used: `T2` for a section, `T3` for a chapter, `glob`
for anything wider. A `glob` is a hard failure regardless of the answer.

### 3. Build answers are scored against the trap list, never for resemblance

`type: build` questions ask for a component design or code. Do **not** score
them for similarity to any reference implementation — the point is not that the
answer looks like `barevisor`.

A build answer passes when it steps on **none of the traps in
`references/dev/02-known-traps.md` that apply to the component asked for**. The
trap list is enumerated, so this is close to mechanical: check the answer
against each applicable entry and record which ones it avoided.

**Do not attempt to compile.** CI has no hardware, and "compiles but bugchecks
on a hybrid part" and "does not compile" are the same outcome for this set —
the first is the more dangerous one and only the trap list catches it.

## Routing probes

`eval/routing-probes.yaml` is a separate protocol and a separate run. It
measures what the question sets structurally cannot: whether the skill
activated, whether the right chapter was opened, and at which tier.

- **Run it once per target host**, not once per skill. It exists because every
  host surveyed leaves activation to the model's own judgement, so routing is a
  property of the host-and-skill pair rather than of the skill alone.
- **It cannot run in CI.** It needs several hosts and it needs the agent's tool
  calls to be observable.
- Score `triggered`, `routed` and `tiered` separately. A probe that answers
  correctly without opening the expected chapter is a **routing failure with a
  correct answer** — record it that way rather than as a pass, because it means
  the answer came from the model rather than from the corpus, which is the one
  thing this repository exists to prevent.
- The eight probes marked `vendor_named: no` are the ones that matter most.
  Under the previous two-skill layout they had no defined answer, and they are
  why the skills were merged. **If any of them fails to route, the merge did
  not achieve what it was for.**

## Result template

```markdown
# <skill> eval — <agent name and version> — <date>

Skill commit: <git rev-parse --short HEAD>
Questions: <n>  ·  must_include: <hit>/<total> (<pct>%)  ·  trap violations: <n>  ·  citations valid: <pct>%
Verdict: PASS | FAIL

## Failures

### <question id>
**Asked:** ...
**Answered:** <verbatim>
**Missing:** <must_include items not found>
**Trap hit:** <the misconception, if any>
**Diagnosis:** routing sent me to the wrong chapter | chapter lacks the fact |
fact present but not found | citation missing

## Notes
<anything about the routing table, stop rules, or context cost>
```

## What a failure means

| Symptom | Fix |
|---|---|
| Right chapter, fact absent | content gap — add it to that chapter |
| Wrong chapter | routing table entry in `SKILL.md` |
| Fact present but not surfaced | the chapter buries it; promote to `00-quickref.md` |
| Answer right, citation missing | the claim line lacks a Tier-1 anchor — `tools/lint.mjs` should have caught it |
| Trap violation | the misconception survives somewhere in the corpus; grep for it and add a `misconceptions` rule to `<skill>/lint.config.json` so it can never come back |

That last row matters most: every trap that fires should end the day as a
deterministic lint rule, so the same error cannot be reintroduced silently.
