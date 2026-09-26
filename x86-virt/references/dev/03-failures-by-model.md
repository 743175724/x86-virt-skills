# 03. Failures, scoped to what actually causes them

> **中文速览**：本章回答"为什么在这台机器上跑不起来"。
> **它按故障组织，不按型号矩阵组织**——已证实的条目都不是"某代缺了某个特性"，
> 而是"某代让一个流行写法失效"，矩阵记不进这种东西。
> **每条必须写出真实成因**；写不出就标为未确定，而不是让型号范围冒充成因。

**Maps to:** no specification chapter; entries cite whatever documents the cause.
**Owns:** failures whose scope is a processor, a firmware level or a platform setting.
**See also:** `02-known-traps.md` · `references/amd/90-dated-landscape.md` ·
`references/intel/errata.md`

## 3.1 How to read an entry, and why the shape matters

Every entry carries five things: the **symptom**, the **real cause**, the **scope**, the
**workaround**, and the **evidence**. The second is the one that earns its place.

- **Claim.** An entry whose cause is recorded as the model range where the failure was observed, rather than the mechanism that produces it, encodes a correlation as if it were an explanation. The SimpleSvm case is the worked example: the reporter concluded that only Zen 4 and Zen 5 were affected, the maintainer could not reproduce it on Zen 4, and the actual cause was an identity map that covered only the first 512 GB — a property of the code and of the machine's memory layout, not of the processor.  `[no-spec]` `[6]` `C:high` `V:durable`

Where a cause is genuinely unknown, an entry says so and records the observed scope
separately. That is a different statement from "this generation is broken", and it does
not mislead the next reader into rejecting a part that is fine.

## 3.2 Per-core paging hierarchies degrade on Intel hybrid parts

| | |
|---|---|
| **Symptom** | Measurable performance regression after splitting a 2 MiB page, on 12th generation and later; none on pre-hybrid parts |
| **Real cause** | **Four E-cores share one L2 cache**, so a per-logical-processor paging hierarchy stops being cache-friendly |
| **Scope** | Intel hybrid client parts, 12th generation onward |
| **Workaround** | One global paging structure shared across all cores |
| **Evidence** | NoirVisor #35, reported 2024-09-04 on i7-14700K with an i7-8700K control, fixed 2024-09-08 `[2]` |

Full discussion in `02-known-traps.md` §2.1. Recorded here because the scope is a
silicon property even though the defect is a design habit.

## 3.3 Virtualized VMLOAD/VMSAVE reboots some AMD Family 19h client parts

| | |
|---|---|
| **Symptom** | Random reboots once the feature is enabled; no fault, no log |
| **Real cause** | The part advertises the feature and the implementation is defective |
| **Scope** | AMD Family 19h client parts. **Zen 5 is not affected** |
| **Workaround** | Do not enable it on affected parts. The Linux mitigation protects a guest under KVM and **does nothing for a bare-metal hypervisor** |
| **Evidence** | Linux commit `a5ca1dc46a6b`, authored by an AMD employee; tracked as CVE-2024-53114 `[40]` |

- **Claim.** AMD published no erratum number for this defect; the only first-party trace is the kernel commit. An implementer looking for it in a revision guide will not find it, which is why it is recorded here rather than left to the vendor errata chapters.  `[no-spec]` `[40]` `C:medium` `V:durable`
- **Claim.** None of the bare-metal implementations surveyed carries the workaround, so the exposure is not theoretical for anyone starting from one of them.  `[no-spec]` `[40]` `[5]` `[7]` `C:medium` `V:durable`

## 3.4 AVIC availability follows the microcode, not the model

| | |
|---|---|
| **Symptom** | The same processor model reports AVIC present on one machine and absent on another |
| **Real cause** | AVIC and x2AVIC are the only two bits in their CPUID leaf permitted to change after reset; their value tracks the microcode patch level |
| **Scope** | AMD client parts. Observed across five patch levels on one model and stepping |
| **Workaround** | Read the bit where you use it; record the patch level with any stored conclusion |
| **Evidence** | PPR 57930 p.103 for the reset semantics `[70]`; measurements in `references/amd/90-dated-landscape.md` |

- **Claim.** This is the entry that decides the shape of the whole chapter: a lookup table keyed on family, model and stepping answers this question wrongly, because the key does not include the dimension the answer depends on.  `[PPR 57930 p.103]` `[70]` `C:medium` `V:durable`

The measured patch levels are a dated fact and live in
`references/amd/90-dated-landscape.md`, where they are re-checked, rather than here.

## 3.5 AVIC on Family 17h: AMD says do not enable it

| | |
|---|---|
| **Symptom** | A guest with AVIC enabled may fail to process an IPI until it is re-scheduled |
| **Real cause** | Silicon erratum |
| **Scope** | AMD Family 17h, **including client parts** — applicable packages include AM4 |
| **Workaround** | AMD's own, verbatim: **"None. Do not enable AVIC."** Fix planned: "No fix planned" |
| **Evidence** | `[RevGuide 55449 erratum 1235]` `[71]`; the same text appears in the Family 17h Models 30h–3Fh guide |

- **Claim.** The Linux handling is narrower than the erratum's own workaround: it disables IPI virtualization rather than AVIC as a whole on Family 17h and Hygon 18h. An implementer reading only the kernel would conclude the erratum is milder than AMD states it to be.  `[no-spec]` `[41]` `C:medium` `V:durable`

## 3.6 ESXi refuses to install on Intel hybrid parts — and the silicon is fine

| | |
|---|---|
| **Symptom** | Purple screen, "Fatal CPU mismatch on feature", on 12th generation and later |
| **Real cause** | **A uniformity assumption in ESXi, not a silicon defect.** The compared features are topology counts, plus reserved bits of an MSR |
| **Scope** | Intel hybrid client parts under ESXi |
| **Workaround** | `cpuUniformityHardCheckPanic=FALSE`. **Not** a firmware or microcode change |
| **Evidence** | Broadcom KB 395554 `[100]`; SDM Vol.1 §21.1.4 for why the divergence is legitimate `[72]` |

- **Claim.** This entry exists to demonstrate that the cause of a failure scoped to a processor generation is not always in the processor. A chapter that could only record hardware causes would file this one as a silicon defect and mislead every reader who found it. The fix is a host configuration setting, not firmware.  `[SDM 1 §21.1.4]` `[72]` `[100]` `C:medium` `V:durable`

## 3.7 Open items

- **Six entries is a beginning, not a survey.** Each was found while answering a
  different question; nobody has yet searched systematically for more.
- **Intel client coverage is thin.** §3.2 and §3.6 are the only Intel entries, and
  neither was found by looking at Intel documentation — both came from third-party
  reports. Nine gaps in the Intel generational research close with a single dump on a
  Core Ultra 7 265KF, which was not available when this chapter was written.
- **No Strix Point part was available**, so the Zen 5 / Zen 5c hybrid questions are
  documentary here rather than measured.
- **Nested-under-Hyper-V support by host generation and Windows build** is not yet
  recorded; it is the most-asked question this chapter cannot answer.
