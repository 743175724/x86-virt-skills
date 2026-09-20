# Blinded question files

Generated from `../questions.yaml`. These are what the answering agents were
given, and nothing else.

Four fields are stripped:

| Stripped | Why |
|---|---|
| `must_include` | the expected answer |
| `must_not_include` | the banned misconceptions — seeing these would telegraph the traps |
| `required_citation` | the expected anchor |
| `notes` | scoring guidance, often naming the owning chapter |
| `chapter` | **routing is part of what the eval measures**, so the answerer must find the chapter itself |

Stripping `chapter` is the one that is easy to forget and matters most. The
routing table in `SKILL.md` and the symptom table in `00-quickref.md` §0.2 are
under test; handing the answerer the destination would measure only whether the
chapter contains the fact, not whether a reader can get to it.

Answers go to `../answers/<type>.md`, and are scored by a *different* agent
against `../questions.yaml` using the protocol in `eval/RUNNER.md`.
