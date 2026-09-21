# amd-virtualization eval — run 2 — 2026-09-21

Protocol: `eval/RUNNER.md`. Same 80 questions as run 1, re-run after run 1's
findings were fixed. Run 1 is archived under `run-1/`; neither the answerers nor
the scorers in this run were allowed to read it.

## Result

| | Questions | `must_include` | Violations | Citations | Routing (self-reported) |
|---|---|---|---|---|---|
| lookup | 24 | 145/152 (95.4%) | 0 | 24/24 | 24/24 chapter |
| mechanism | 24 | 171/172 (99.4%) | 0 | 24/24 | 24/24 chapter |
| diagnosis | 20 | 132/141 (93.6%) | 0 | 20/20 | 19/20 |
| trap | 12 | 47/47 (100%) | 0 | 12/12 | 12/12 |
| **total** | **80** | **495/512 (96.7%)** | **0** | **80/80 (100%)** | — |

**Verdict: PASS.** Every category clears the bars standalone.

## Comparison with run 1, and why the headline number moved

| | run 1 | run 2 |
|---|---|---|
| `must_include` | 497/508 (97.8%) | 495/512 (96.7%) |
| keys disputed | **4** | **0** |
| misconceptions asserted | 0 | 0 |
| citation validity | 100% | 100% |

**The drop is not a regression, and the two numbers are not directly
comparable.** Three things changed between the runs: four wrong keys were
corrected, which *raised* the bar by restoring facts the old keys had let slide;
the denominator grew from 508 to 512 for the same reason; and both the answerers
and the scorers were different agents.

The number worth reading is **keys disputed: 4 → 0**. Run 1's scorers found four
keys that contradicted the specification and would have failed a correct answer.
Those were fixed, and run 2's scorers — who had the same authority and used it to
examine two candidates — found none. The key is now sound.

## Did run 1's fixes work?

Run 1's central finding was that 10 of its 11 misses were "the fact is present
but was not found" — organisation, not knowledge. The fixes were routing
anchors, one relocated fact and a content gap. Run 2 measured them:

- **Lookup routing shortfalls: 10 of 24 → 4 of 24.** The anchors improved.
- **The one content gap is closed.** No answer in run 2 failed on it.
- **The relocated TLB fact was found**, from §6.8 where it now lives.

But the fix was incomplete and partly misdirected, which run 2 shows precisely.

## The sharpest finding: short anchors cost almost nothing

Mechanism reported 15 of 24 answers landing on the right chapter but the wrong
section, which looked alarming. Scored, it cost **exactly one item out of 172
(0.6%)**. The other fourteen recovered the owning section from the chapter's own
`Owns:` line and scored full marks — a second look, not a lost fact.

**The reverse case cost twice as much.** Two lookup items were lost in sections
the routing row *already named*: the answer opened one of three and self-reported
"right first time". So:

- A short anchor costs a second look.
- **A self-reported routing figure over-reports**, because an answerer that opens
  one of several named sections believes it routed correctly. Future runs should
  treat self-reported routing as an upper bound, not a measurement.

## Skill defects found and fixed

- `SKILL.md` chapter-08 row anchored §8.3; the MMIO window size is owned by §8.2.
- `SKILL.md` chapter-15 row anchored §15.5 alone; vmcb02 needs §15.2, §15.3 and §15.4.3.
- `00-quickref.md` §0.2 had no row for "must I turn Hyper-V off for VMware or
  VirtualBox", although §0.5 of the same file calls it one of the five most-asked
  Windows questions.
- §0.3 and §0.2 **disagreed with each other** about where the `#NPF` bit layout
  lives. The skill has one navigation file specifically to avoid two of them
  drifting apart; the drift happened between two sections of the one file instead.
- The AVIC doorbell was a named topic in the routing row with no anchor in either
  navigation table, despite owning all of §7.6.
- `errata.md` E25 cited one table for a three-point version progression, only one
  point of which that table attests; 3h is attested in neither locally held ABI
  revision.
- `14-sev-snp.md` asserted one side of a contradiction in AMD's own Table 27 as
  settled: bit 0 at `48h` says the author-key digest is *present* when
  `AUTHOR_KEY_EN` is 1, and the `110h` row says it is *zeroes* when
  `AUTHOR_KEY_EN` is 1. Now states both halves, with `O7` recording the conflict.

## One scorer finding rejected

A scorer reported that `07-virtual-interrupts-avic.md` omits AMD's
directed-versus-broadcast rule for invalid Physical APIC table entries. It does
not: §7.6.1 line 280 carries a dedicated claim stating it, correctly anchored to
`[APM2 §15.29.6.1]`. The scorer grepped AMD's verbatim wording, and the corpus
writes "invalid entries are **simply** ignored". Third verification false
positive in this project, which is why findings are re-checked rather than
applied.
