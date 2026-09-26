# AMD evaluation set

`questions.yaml` is the AMD subtree's behavioural test seam: 80 questions that a
fresh agent answers from `x86-virt/SKILL.md` and whatever chapters its routing
table sends it to. `../RUNNER.md` is the scoring protocol — read it
first; it defines `must_include`, `must_not_include`, `required_citation` and the
pass bar (≥ 90% `must_include`, **zero** `must_not_include` violations, ≥ 95%
citations). The schema matches the Intel set exactly, and
`tools/lint.mjs` validates this file against the same rules.

## What it covers

| Type | n | What it proves |
|---|---|---|
| `lookup` | 24 | An exact value comes back: `VM_CR` and `VM_HSAVE_PA`, `Fn8000_0001 ECX[2]`, VMCB control and state-save offsets, clean bits, intercept vectors 4 and 5, the MSRPM ranges, exit codes `60h`/`61h`, the `#NPF` `EXITINFO1` layout, `TLB_CONTROL`, the AVIC ID tables and doorbell, the IOMMU Control register and event codes, the DTE, the IRTE, `Fn8000_001F`, `SEV_STATUS`, the SEV firmware error codes, the GHCB layout, the SNP instructions and `ATTESTATION_REPORT`. Spread across `00` `01` `02` `03` `05` `06` `07` `08` `10` `11` `12` `13` `14`. |
| `mechanism` | 24 | The chain of causation is explained, not paraphrased: the VMRUN sequence and its consistency checks, GIF/vGIF dispositions, intercept priority, event injection and re-injection, the two-level permission and memory-type combining rules, `#NPF` check ordering, ASID allocation, GMET, the AVIC IPI path, the I/O page-table walk and GCR3, MSI remapping and the GA log, the C-bit, GHCB negotiation, RMP page-state transitions, VMPL and `RMPADJUST`, vmcb02 construction, and VMCB-versus-VMCS. |
| `diagnosis` | 20 | A symptom resolves to the right chapter, cause and fix. Modelled on `00-quickref.md` §0.2 and §0.5. |
| `trap` | 12 | One per high-value erratum. Each encodes an error real sources make. A single hit fails the run. |

Three properties are deliberate.

**Eight diagnoses are Windows-side**, all in `16-windows-platform.md`, because
that is the skill's target platform: who owns `EFER.SVME`, why the hardware probe
chain reads clean while VMRUN never runs, why a driver is rejected under memory
integrity, why Kernel DMA Protection shows `Off`, how to enable nested Hyper-V on
a Ryzen, whether VMware and VirtualBox need Hyper-V turned off, what GPU
passthrough a client PC actually gets, and how to confirm VBS status. Chapter 16
must answer all of them from `x86-virt/references/amd/`; that
is its stated design criterion.

**Nine questions have no numeric answer.** The honest response is "this knowledge
base holds no such measurement" or "the sources disagree" — the VBS overhead
figure, the AVIC default state, the absence of any AMD cycle-level world-switch
measurement, the unsourceable "5–10%" and "5–25%" ranges. A skill that invents a
number for them fails.

**Citations are tiered the way the corpus is.** Windows behaviour, CVEs and
measurements carry Microsoft Learn, NVD, `AMD-SB-nnnn`, Windows Internals, the
Hypervisor Top-Level Functional Specification, kernel.org or the paper — **not**
an APM section. `16-windows-platform.md` and `90-dated-landscape.md` carry no APM
anchors at all and `18-performance.md` carries exactly one, so a key demanding an
APM anchor there would fail a correct answer. Two questions likewise require the
AMD-V Nested Paging white paper (`NP-WP §4.2.2`) and refuse an APM anchor on the
24-reference figure, because the APM does not state it.

## The twelve traps

Each is an error that circulates in real sources, and each ends the day as a
`misconceptions` rule in `x86-virt/references/amd/lint.config.json`.

| Trap | The misconception | Erratum |
|---|---|---|
| `trap-client-sev-cpuid` | `Fn8000_001F EAX[1]` reads 0 on client Ryzen | E12 `[reversed]` |
| `trap-x2avic-cpuid-bit` | x2AVIC is `Fn8000_000A EDX[14]` | E09 |
| `trap-cmdbufrun-register` | `CmdBufRun` is in the Control register at 0018h | E01 |
| `trap-irte-bit0-name` | the IRTE bit-0 field is `RemapEm` | E03 |
| `trap-iommu-mmio-window-size` | the IOMMU MMIO window is 14 KiB | E02 |
| `trap-vmexit-restores` | `#VMEXIT` restores only RIP, RSP and RAX | E07 |
| `trap-vmload-vmsave-ss` | VMLOAD/VMSAVE transfer SS | E08 |
| `trap-two-dimensional-walk-count` | nested paging makes a 4-reference walk 16 | E11 |
| `trap-branch-type-confusion-cve` | Branch Type Confusion is CVE-2022-23816 | E26 |
| `trap-hyperv-image-name` | Hyper-V loads `hvix64.exe` on AMD hosts | E10 |
| `trap-enlightened-vmcb` | AMD has no enlightened-VMCB counterpart | SKILL.md worked example |
| `trap-vmgexit-encoding` | VMGEXIT is `F3 0F 01 D9` only | E22 `[reversed]` |

Eight further errata ride as `must_not_include` on non-trap questions rather than
as traps of their own: E04 (`#NPF` bit numbering) on `npf-exitinfo1-bits`, E05
(the CR4/EFER fixed masks) on `vmrun-consistency-checks`, E06 (exit code = bit
position) on `diag-exit-code-80h`, E13 (nested virtualization is Intel-only) on
`diag-nested-hyperv-on-ryzen-7000`, E15 (turn Hyper-V off first) on
`diag-vmware-virtualbox-coexistence`, E17 (SEV-ES disabled is a Zen 5 property)
on `diag-sev-es-disabled-on-snp-host`, E24 (`SEV_STATUS` bit 7 is Debug Swap) on
`sev-status-bit-map`, and E25 (report VERSION is 2/3/5) on
`attestation-report-fields`.

`diag-nested-hyperv-on-ryzen-7000` doubles as the cross-skill routing check: an
AMD-primary Windows question must resolve in `x86-virt/references/amd/`.

## Running it against a host

Same procedure for all three targets; only the way you load the skill differs.

1. **Claude Code** — new session in this repo. `AGENTS.md` points at
   `x86-virt/SKILL.md`; let the agent route itself, do not pre-load
   chapters.
2. **Codex** — new session, same repo, `AGENTS.md` again. Confirm it reads
   `SKILL.md` before the first chapter; if it grep-searches `references/`
   instead, record that as a routing failure, not a content failure.
3. **Hermes** — install the skill first (`node tools/install.mjs`), then start a
   fresh conversation with no SVM context in it.

Ask the questions in file order, one per turn, with no follow-ups and no hints.
Score literally against `must_include` (partial credit per item), then write
`eval/amd/results/<agent>-<YYYY-MM-DD>.md` from the template in
`RUNNER.md`, quoting the verbatim answer for every failed item.

Every `must_not_include` that fires should end the day as a `misconceptions` rule
in `x86-virt/references/amd/lint.config.json`, so the same error cannot come back
silently.

## A note on the answer keys

Every `must_include` item in this file was checked against the chapter named in
`chapter` as it exists at the 2026-09-21 snapshot, and every `required_citation`
is an anchor that appears verbatim in that chapter or the Tier-2 source the
chapter actually cites. That check is the point: on the Intel side five keys
turned out to be wrong, two of them demanding a hedge the corpus no longer needed
and banning the now-correct value. **A question whose key the skill cannot
satisfy is a broken question, not a skill failure** — fix the key.
