# 00. Development quickref

> **中文速览**：本子树是**开发轨道**，不是规范参考。它回答"怎么写"和"为什么在这台机器上跑不起来"，
> 而 `references/intel/` 与 `references/amd/` 回答"这个位是什么意思"。
> 本章是导航层，**不含任何 claim**。

**Maps to:** nothing. This subtree cites implementations, kernel commits, vendor
bulletins and measurements rather than a specification chapter.
**Owns:** navigation for `references/dev/`.
**See also:** `references/intel/01-vmx-intro.md` · `references/amd/01-svm-intro.md`

## 0.1 What this subtree is for

The vendor subtrees tell you what a bit means. This one tells you what happens when you
try to use it on a real Windows machine in 2026, and why the answer is so often "it does
not load".

Three chapters, in the order a reader actually needs them:

| Chapter | Question it answers |
|---|---|
| `01-platform-ownership.md` | **Can my driver load at all?** Who owns VMX root / SVM, and what to do when it is not you. |
| `02-known-traps.md` | **What will I get wrong?** Practices that circulate in published implementations and are now defects. |
| `03-failures-by-model.md` | **Why does it work here and not there?** Failures scoped to the silicon, firmware or platform that actually causes them. |

## 0.2 Symptom → chapter

| Symptom | Go to |
|---|---|
| Driver loads on one machine, refuses on another | `01-platform-ownership.md` §1.1 |
| `VMXON` or `VMRUN` fails although CPUID says the feature is present | `01-platform-ownership.md` §1.1 |
| Worked before a Windows update, does not now | `01-platform-ownership.md` §1.3 |
| Correct on an older CPU, degraded or broken on a recent one | `03-failures-by-model.md` |
| Blue screen only on some machines, same CPU family | `03-failures-by-model.md` §3.5 |
| Copied a published implementation and it misbehaves | `02-known-traps.md` |
| Need to know whether a feature is safe to enable on this part | `03-failures-by-model.md` §3.2, §3.3 |

## 0.3 Start here, in this order

1. **Detect who owns the extension.** Everything else is wasted if the answer is
   "not you". `01-platform-ownership.md` §1.1.
2. **Read the traps before writing code**, not after debugging it.
   `02-known-traps.md` — it is short, and every entry cost somebody a week.
3. **Then** the vendor subtree for the mechanism:
   Intel `references/intel/01-vmx-intro.md` → `02-vmcs.md` → `04-vm-entry.md` →
   `05-vm-exit.md` → `06-address-translation.md`;
   AMD `references/amd/01-svm-intro.md` → `02-vmcb.md` → `04-world-switch.md` →
   `05-exit-decoding.md` → `06-nested-paging.md`.
   The AMD subtree's `00-quickref.md` §0.6 has the implementer's reading order in full.

## 0.4 This subtree does not ship a skeleton, and will not

Stated plainly rather than implied by absence, and as a scope decision rather than a gap:

- **No skeleton source, by design.** This subtree is not a starting template. Working
  implementations already exist under licences that permit use, and duplicating one here
  would add a fourth thing to keep current against Windows changes with nothing to test
  it: this repository has no hardware in CI, and an untestable artifact is the kind of
  asset it exists to avoid.
- **No per-component walkthrough** of driver entry, per-processor context allocation,
  host GDT/IDT/stack, identity-map construction, the dispatch loop, CPUID/MSR emulation,
  SMP bring-up or teardown.

**Use instead, in this order:**

1. **The architecture chapters** for the mechanism — `references/intel/` and
   `references/amd/`, which say what each field, bit and exit code means and cite the
   specification for it.
2. **`02-known-traps.md` before writing code**, for the practices that circulate in
   published implementations and are now defects.
3. **A maintained implementation for structure.** `02-known-traps.md` §2.5 has the
   survey, including which projects are archived and which licence forbids reuse in an
   Apache-2.0 work.

**What this subtree adds that a reference implementation does not** is the part nobody
maintains: whether your driver can load at all on the machine in front of you
(`01-platform-ownership.md`), what the published implementations get wrong
(`02-known-traps.md`), and why the same code behaves differently on two machines
(`03-failures-by-model.md`).

## 0.5 Terminology (中英对照)

| EN | 中文 | Note |
|---|---|---|
| thin / minimal hypervisor | 轻量级 hypervisor | Intercepts a small set of events; does not virtualize a whole machine |
| VMX root operation | VMX root 模式 | Intel: the mode a hypervisor runs in. Only one owner per logical processor |
| SVM ownership | SVM 占用 | The AMD counterpart; `EFER.SVME` |
| VBS / Virtualization-Based Security | 基于虚拟化的安全 | Windows feature that makes the Microsoft hypervisor the owner |
| HVCI / Memory Integrity | 内存完整性 | Code-integrity enforcement running under VBS |
| identity map | 恒等映射 | Guest-physical == host-physical EPT/NPT hierarchy |
| trap | 陷阱（此处指设计陷阱） | In this subtree: a practice that is wrong, not an interception |
