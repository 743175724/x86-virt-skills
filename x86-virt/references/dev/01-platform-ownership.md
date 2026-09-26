# 01. Who owns the virtualization extension

> **中文速览**：本章回答"我的驱动到底能不能加载"。在现代 Windows 上，
> **最大的障碍不是 PatchGuard，是 Hyper-V / VBS 已经占着 VMX root 或 SVM**——
> 这是唯一一堵会让驱动**根本装不上**的墙，而且从 2026 年 10 月起覆盖面还在扩大。
> 因此任何 hypervisor 的第一件事都是**检测所有权**，不是初始化。

**Maps to:** no single specification chapter; this is platform behaviour.
**Owns:** the ownership question and its detection.
**See also:** `references/intel/17-windows-platform.md` §17.1 ·
`references/amd/16-windows-platform.md` §16.1 · `02-known-traps.md`

## 1.1 Detection comes first

- **Claim.** On a Windows PC the virtualization extension has exactly one owner per logical processor, and if Hyper-V, VBS, HVCI, WSL 2, Windows Sandbox, Credential Guard or Device Guard is enabled that owner is the Microsoft hypervisor — not a third-party driver. A hypervisor that initialises before establishing this fails late and confusingly instead of early and clearly.  `[no-spec]` `[101]` `C:high` `V:durable`
- **Claim.** The symptom is routinely misread as a firmware problem: users report "virtualization is disabled in BIOS" while the BIOS setting is on, because the extension is present and already taken. The same root cause produces "my driver will not load", "`VMXON` fails", and "`VMRUN` returns immediately".  `[no-spec]` `[101]` `C:high` `V:durable`
- **Claim.** CPUID is not sufficient to answer the ownership question. CPUID reports that the silicon has the feature, which stays true while another hypervisor owns it, so a probe that stops at CPUID concludes the feature is available and then fails at the instruction.  `[no-spec]` `[101]` `C:medium` `V:durable`

**Where the mechanism is documented:** `references/intel/17-windows-platform.md` §17.1
for the Intel side and `references/amd/16-windows-platform.md` §16.1 for AMD, including
the hypervisor-present bit and the CPUID leaf range that identifies the incumbent.

## 1.2 Three paths, and what each costs

- **Claim.** Owning the extension bare-metal requires VBS to be off. It is the path on which the architecture is most visible and is therefore the right teaching vehicle, but it asks the user to keep Memory Integrity disabled indefinitely against monthly quality updates, so its audience shrinks over time rather than growing.  `[no-spec]` `[102]` `C:medium` `V:durable`
- **Claim.** Running nested beneath the incumbent hypervisor keeps VBS on and is the path a deployable product takes, at the cost of depending on the host exposing nested virtualization and of losing direct control of the outermost exit path.  `[no-spec]` `[101]` `C:medium` `V:durable`
- **Claim.** Using the Windows Hypervisor Platform API is not writing a hypervisor; it is using the incumbent one. It is named here because it is the correct answer for a significant fraction of people who arrive wanting to write one, and omitting it sends them down a path they did not need.  `[no-spec]` `[101]` `C:high` `V:durable`

A third-party hypervisor and VBS cannot both own ring −1. The HyperDbg documentation
states the constraint plainly: *"HyperDbg and VBS are both hypervisors running on
ring -1. These hypervisors are not compatible."*  `[101]`

## 1.3 The wall is widening

- **Claim.** Microsoft began enabling Memory Integrity through quality updates from October 2026, and enabling it turns VBS on with it. A driver that requires bare-metal ownership therefore fails on a growing share of machines over time, on machines where the user made no deliberate change.  `[no-spec]` `[102]` `C:medium` `V:durable`

The practical consequence for anyone writing a hypervisor today: **treat "VBS is on" as
the default state and the bare-metal path as the exception**, rather than the reverse.
Instructions that begin "first disable Memory Integrity" are not wrong, but they describe
a shrinking configuration and they ask the reader to lower their machine's security
permanently for a development convenience.

## 1.4 PatchGuard is the low wall, not the high one

- **Claim.** PatchGuard is a far smaller obstacle than the ownership problem for a purely virtualizing hypervisor, because virtualization changes none of the guest-visible bytes PatchGuard inspects — it verifies kernel structures, not the mode the processor is in. Published material commonly presents PatchGuard as the main barrier, which misdirects effort.  `[no-spec]` `[9]` `C:medium` `V:durable`

This ordering matters: someone who solves PatchGuard first and ownership second has spent
the effort in the wrong order, because the ownership problem can make the whole approach
unavailable while the PatchGuard problem only constrains what a loaded driver may touch.

## 1.5 Open items

- **The detection sequence is not written here as code.** It belongs with the skeleton,
  which does not exist yet; see `00-quickref.md` §0.4.
- **Nested-under-Hyper-V support varies by host generation and Windows build**, and this
  chapter does not yet carry that matrix. It is a per-model question and belongs in
  `03-failures-by-model.md` once the evidence is gathered on real hardware.
