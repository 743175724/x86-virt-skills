# intel-vt evaluation set

`questions.yaml` is the skill's single behavioural test seam: 80 questions that a
fresh agent answers from `intel-vt/SKILL.md` and whatever chapters its routing
table sends it to. `RUNNER.md` is the scoring protocol — read it first; it
defines `must_include`, `must_not_include`, `required_citation` and the pass bar
(≥ 90% `must_include`, **zero** `must_not_include` violations, ≥ 95% citations).

## What it covers

| Type | n | What it proves |
|---|---|---|
| `lookup` | 24 | An exact value comes back: field encodings, exit reasons, EPTP bits, virtual-APIC offsets, VM-instruction errors, DMAR offsets, IRTE layout, VT-d fault codes, TDX leaf numbers. Spread across `02` `05` `06` `07` `08` `10` `11` `12` `13`. |
| `mechanism` | 24 | The chain of causation is explained, not paraphrased: VM-entry check order, the PIR→VIRR merge and its ON/SN race, VMCS shadowing, vmcs02 merging, Secure-EPT page acceptance, queued invalidation, HVCI's use of EPT, virtual-interrupt delivery. |
| `diagnosis` | 20 | A symptom resolves to the right chapter, cause and fix. Modelled on `00-quickref.md` §0.2, `04-vm-entry.md` §4.11 and `08-vmx-instructions.md` §8.7. |
| `trap` | 12 | One per confirmed erratum. Each encodes an error the previous version of this skill actually made. A single hit fails the run. |

Two properties are deliberate. **Thirteen questions are Windows-side** (`15`,
`16`, `17` and `14` §14.12) because that is the skill's target platform — who
owns VMX root operation, why a driver is rejected under memory integrity, why a
hypervisor that works on Linux misbehaves on Windows 11. And **eleven questions
have no answer**: the honest response is "the knowledge base does not have
this" or "the sources disagree". They cover the VBS overhead conflict, the
FlexPriority generation dispute, the absence of any modern VM-exit cycle
measurement, the TME-MK AES generation split, the VMFUNC generation dispute,
the two Out-of-Hypervisor figure sets, and four VMCS encodings the rebuild
refused to guess. A skill that invents an answer to any of them fails.

## Running it against a host

Same procedure for all three targets; only the way you load the skill differs.

1. **Claude Code** — new session in this repo. `AGENTS.md` points at
   `intel-vt/SKILL.md`; let the agent route itself, do not pre-load chapters.
2. **Codex** — new session, same repo, `AGENTS.md` again. Confirm it reads
   `SKILL.md` before the first chapter; if it grep-searches `references/`
   instead, record that as a routing failure, not a content failure.
3. **Hermes** — install the skill first (`node tools/install.mjs`), then start a
   fresh conversation with no VMX context in it.

Ask the questions in file order, one per turn, with no follow-ups and no hints.
Score literally against `must_include` (partial credit per item), then write
`eval/results/<agent>-<YYYY-MM-DD>.md` from the template in `RUNNER.md`,
quoting the verbatim answer for every failed item.

Every `must_not_include` that fires should end the day as a `MISCONCEPTIONS`
rule in `tools/lint.mjs`, so the same error cannot come back silently.
