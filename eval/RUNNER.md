# intel-vt evaluation protocol

The single behavioural test seam for this skill: **given a question, can a fresh
agent that has only this skill answer it correctly, completely, and traceably?**

Nothing here tests file structure or internal headings — those are implementation
details that should be free to change. `tools/lint.mjs` covers the formal side.

## Running it

Any agent that can read files can run this on itself. No vendor API required.

1. Start a **fresh session** with no prior Intel VT context in the conversation.
   A session that has already discussed VMX will pass questions the skill alone
   would fail, which is exactly the measurement error this protocol exists to
   avoid.
2. Load the skill the way its host normally would — `intel-vt/SKILL.md`, then
   whatever chapters the routing table sends you to. **Do not pre-load every
   chapter**: part of what is being measured is whether the routing works.
3. For each question in `eval/questions.yaml`, answer from the skill alone. No
   web search, no recall from pre-training that the skill does not support. If
   the skill does not contain the answer, say so — that is a legitimate result
   and more useful than a confident guess.
4. Score each question:
   - **must_include** — each listed fact either appears in the answer or does
     not. Partial credit per item, not per question.
   - **must_not_include** — if any listed misconception appears, the question
     scores **zero** regardless of everything else. These are the trap items.
   - **required_citation** — the answer must name the Intel document and the
     chapter or section. A bare "per the SDM" does not count.
5. Write results to `eval/results/<agent>-<YYYY-MM-DD>.md` using the template
   below.

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
  a hit.
- Record the **verbatim answer** for every failed item. A failure you cannot
  quote is a failure you did not really have.

## Result template

```markdown
# intel-vt eval — <agent name and version> — <date>

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
| Answer right, citation missing | the claim line lacks a Tier-1 anchor — `lint.mjs` should have caught it |
| Trap violation | the misconception survives somewhere in the corpus; grep for it and add a `MISCONCEPTIONS` rule to `lint.mjs` so it can never come back |

That last row matters most: every trap that fires should end the day as a
deterministic lint rule, so the same error cannot be reintroduced silently.
