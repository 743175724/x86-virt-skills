# 01. Introduction to Secure Virtual Machine

> **中文速览**：本章讲 SVM 的"开机前半小时"——host 与 guest 两种操作模式如何划分、一个 VMM 从上电到跑起第一个 guest 要走的完整链路（CPUID 探测 → `VM_CR` 与 BIOS 锁定 → `EFER.SVME` → `VM_HSAVE_PA`），以及这条链路上每个能力位与 MSR 的确切含义。写 hypervisor 初始化代码、排查"SVM 用不了"时先读本章。**在 Windows 上这条探测链会给出错误答案**——机器全部"正常"而 VMM 仍起不来，原因见 `16-windows-platform.md`。VMCB 的布局在 `02-vmcb.md`，世界切换的流程在 `04-world-switch.md`。

**Maps to:** APM Vol.2 §15.4 "Enabling SVM" + §15.30 "SVM Related MSRs" + App.A "MSR Cross-Reference"; CPUID in APM Vol.3 App.E (24593 Rev 3.45 / 24594 Rev 3.38) [1][2]
**Owns:** EFER.SVME · VM_CR · VM_HSAVE_PA · SVM_KEY · the full `Fn8000_0001` and `Fn8000_000A` bit tables · the enable-failure decision chain · the per-bit probing discipline
**Scope:** OS-independent hardware
**See also:** `02-vmcb.md` · `04-world-switch.md` · `16-windows-platform.md` (who owns SVM on Windows)

---

## 1.1 Host mode and guest mode

AMD's virtualization extension is called the Secure Virtual Machine (SVM) extension; AMD-V is the
marketing name for the architecture built on it. The manual's vocabulary is worth adopting verbatim,
because the rest of this skill uses it: the *virtual machine monitor* (VMM), also called the
*hypervisor*, controls the execution of multiple *guest* operating systems; *host* names the
execution context of the VMM; a *world switch* is the operation of switching between the two.

- **Claim.** AMD defines *host* as the execution context of the VMM and *world switch* as the operation of switching between host and guest; a guest may have one or more vCPUs, and a VMM may run any mix of vCPUs from the same or different guests on different logical processors simultaneously with no hardware-imposed constraints.  `[APM2 §15.1]` `[1]` `C:high` `V:durable`
- **Claim.** Guest mode is a processor mode entered through the VMRUN instruction, and in guest mode the behaviour of some x86 instructions changes to facilitate virtualization.  `[APM2 §15.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** SVM is designed to safely restart any intercepted instruction after the intercept, **with the exception of task switches**; the instruction must be either atomic or idempotent.  `[APM2 §15.2.5]` `[1]` `C:high` `V:durable`

There is no separate "SVM root/non-root" naming in AMD's model, and no dedicated instruction to
enter or leave the host role: a processor with `EFER.SVME = 1` that is not executing inside a
VMRUN is simply in host mode. The boundary is drawn by the VMRUN/`#VMEXIT` pair, described in
`04-world-switch.md`.

Two enumeration facts belong here because they are how software on either side of the boundary
finds out where it is.

- **Claim.** CPUID function numbers `4000_0000h`–`4000_00FFh` are reserved for software use, and hypervisors use them to pass information to the guest.  `[APM2 §15.2.2]` `[1]` `C:high` `V:durable`
- **Claim.** `Fn0000_0001_ECX[31]` is reserved for hypervisors to advertise their presence: hypervisors set it to 1 and physical CPUs set it to zero, so guest software can probe it to detect that it is running inside a virtual machine.  `[APM2 §15.2.2]` `[1]` `C:high` `V:durable`

AMD groups the hardware extensions into six families, and the section numbers below are the entry
points for the rest of this skill.

| Extension family | APM Vol.2 sections | Chapter here |
|---|---|---|
| State switch — VMRUN, VMSAVE, VMLOAD, GIF, STGI, CLGI | §15.5, §15.5.2, §15.17 | `04-world-switch.md` |
| Intercepts | §15.7 through §15.14 | `03-intercepts.md` |
| Interrupt and APIC assists | §15.17, §15.21 | `07-virtual-interrupts-avic.md` |
| SMM intercepts and assists | §15.22 | `03-intercepts.md` |
| External (DMA) access protection | §15.24 | `08-iommu-architecture.md` |
| Nested paging | §15.25 | `06-nested-paging.md` |
| Security — SKINIT | §15.27 | `17-security.md` |

- **Claim.** The grouping above, including the section numbers, is AMD's own list of SVM processor and platform extensions.  `[APM2 §15.3]` `[1]` `C:high` `V:durable`

## 1.2 Discovering SVM: `Fn8000_0001 ECX`

`Fn8000_0001_ECX` is a general feature word, not an SVM word. Only four of its bits concern this
skill, and the distinction between two of them is the single most commonly mis-stated fact about
SVM discovery: **`ECX[2]` does not gate all eight SVM instructions.**

| Bit | Field name | What it means here |
|---|---|---|
| 2 | `SVM` | Secure virtual machine supported. |
| 3 | `ExtApicSpace` | Extended APIC register space at offset 400h from the APIC base address. |
| 4 | `AltMovCr8` | `LOCK MOV CR0` means `MOV CR8` — the 32-bit route to the TPR. |
| 12 | `SKINIT` | SKINIT and STGI are supported **independent of the value of `MSRC000_0080[SVME]`**. |

- **Claim.** In `Fn8000_0001_ECX`, bit 2 is `SVM`, bit 3 is `ExtApicSpace`, bit 4 is `AltMovCr8` and bit 12 is `SKINIT`; AMD's description of bit 12 is "SKINIT and STGI are supported, independent of the value of `MSRC000_0080[SVME]`".  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** The instructions gated on `EFER.SVME` are VMRUN, VMLOAD, VMSAVE, CLGI, VMMCALL and INVLPGA — six, not eight — and they raise `#UD` when it is clear; INVLPGA's own semantics are owned by `06-nested-paging.md`.  `[APM2 §15.4]` `[1]` `C:high` `V:durable`
- **Claim.** SKINIT and STGI are usable when **either** `EFER.SVME = 1` **or** `Fn8000_0001_ECX[SKINIT] = 1`; they are the two SVM instructions that are not purely `EFER.SVME`-gated.  `[APM2 §15.4]` `[1]` `C:high` `V:durable`
- **Claim.** Device exclusion vector (DEV) support is part of the SKINIT architecture and is enumerated by the same bit, `Fn8000_0001_ECX[SKINIT] = 1`; STGI's `#UD` condition is `EFER.SVME = 0` **and** `Fn8000_000A_EDX[SVML] = 0` **and** `Fn8000_0001_ECX[SKINIT] = 0`.  `[APM3 §4 "STGI"]` `[2]` `C:high` `V:durable`

That last claim is the cleanest way to remember the split: three independent enumeration inputs
decide whether STGI faults, and only one of them is `EFER.SVME`.

## 1.3 The `Fn8000_000A` feature bits

`Fn8000_000A` is the SVM feature leaf proper. If `Fn8000_0001_ECX[SVM] = 0` the whole function is
reserved, so this leaf must never be read before the ECX[2] probe.

- **Claim.** `Fn8000_000A` reports SVM feature information and is **reserved** when `Fn8000_0001_ECX[SVM] = 0`.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** `Fn8000_000A_EAX[7:0]` is `SvmRev`, the SVM revision number, and `EAX[31:8]` is reserved; `Fn8000_000A_EBX[31:0]` is `NASID`, the number of available address space identifiers, taking the whole register.  `[APM3 App.E]` `[2]` `C:high` `V:durable`

### `Fn8000_000A_ECX`

The ECX subleaf is recent and easy to miss — older corpora treat `Fn8000_000A` as EAX/EBX/EDX only.

| Bit | Field name | Meaning | Owning chapter |
|---|---|---|---|
| 31:7 | — | Reserved | — |
| 6 | `x2AVIC_EXT` | 4096 vCPUs supported in x2AVIC mode | `07-virtual-interrupts-avic.md` |
| 5 | `EnhancedTlbi` | INVLPGB and TLBSYNC support IOMMU invalidate; paired with `EFER[24] EnhancedTlbi` | `06-nested-paging.md` |
| 4 | `PML` | Page Modification Logging supported | `06-nested-paging.md` |
| 3:0 | — | Reserved | — |

- **Claim.** `Fn8000_000A_ECX` defines bit 6 `x2AVIC_EXT` (4096 vCPUs in x2AVIC mode), bit 5 `EnhancedTlbi` and bit 4 `PML`, with bits 3:0 and 31:7 reserved.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** The `EnhancedTlbi` enable bit that `Fn8000_000A_ECX[5]` pairs with is `EFER` bit 24, "Enhanced TLB Invalidate Enable".  `[APM2 Figure 3-9]` `[1]` `C:high` `V:durable`

### `Fn8000_000A_EDX` — all 32 bits

| Bit | Field name | Meaning | Owning chapter |
|---|---|---|---|
| 31 | — | Reserved | — |
| 30 | `IdleHltIntercept` | Idle HLT intercept | `03-intercepts.md` |
| 29 | `BusLockThreshold` | Bus Lock Threshold | `03-intercepts.md` |
| 28 | `NestedVirtVmcbAddrChk` | Guest VMCB address check | `15-nested-virtualization.md` |
| 27 | `ExtLvtAvicAccessChg` | Extended Interrupt LVT register AVIC access changes | `07-virtual-interrupts-avic.md` |
| 26 | `IbsVirt` | IBS virtualization | `03-intercepts.md` |
| 25 | `VNMI` | NMI virtualization | `07-virtual-interrupts-avic.md` |
| 24 | `TlbiCtl` | INVLPGB/TLBSYNC hypervisor enable in the VMCB, and TLBSYNC intercept support | `06-nested-paging.md` |
| 23 | `HOST_MCE_OVERRIDE` | With host `CR4.MCE=1` and guest `CR4.MCE=0`, guest `#MC` does not shut down and is always intercepted | `03-intercepts.md` |
| 22 | — | Reserved | — |
| 21 | `ROGPT` | Read-Only Guest Page Table support | `06-nested-paging.md` |
| 20 | `SpecCtrl` | `SPEC_CTRL` virtualization | `17-security.md` |
| 19 | `SSSCheck` | SVM supervisor shadow stack restrictions | `06-nested-paging.md` |
| 18 | `x2AVIC` | AVIC for x2APIC mode | `07-virtual-interrupts-avic.md` |
| 17 | `GMET` | Guest Mode Execution Trap | `06-nested-paging.md` |
| 16 | `VGIF` | Virtualize the Global Interrupt Flag | `15-nested-virtualization.md` |
| 15 | `VMSAVEvirt` | VMSAVE and VMLOAD virtualization | `15-nested-virtualization.md` |
| 14 | — | Reserved | — |
| 13 | `AVIC` | Advanced Virtual Interrupt Controller | `07-virtual-interrupts-avic.md` |
| 12 | `PauseFilterThreshold` | PAUSE filter cycle count threshold | `03-intercepts.md` |
| 11 | — | Reserved | — |
| 10 | `PauseFilter` | PAUSE intercept filter | `03-intercepts.md` |
| 9 | — | Reserved | — |
| 8 | `PmcVirt` | Performance monitoring counter virtualization | `03-intercepts.md` |
| 7 | `DecodeAssists` | Decode assists | `03-intercepts.md` |
| 6 | `FlushByAsid` | TLB flush events flush only the current ASID; also the extended VMCB TLB control encodings | `06-nested-paging.md` |
| 5 | `VmcbClean` | VMCB clean bits supported | `02-vmcb.md` |
| 4 | `TscRateMsr` | MSR-based TSC rate control, `MSRC000_0104` | §1.4 below |
| 3 | `NRIPS` | nRIP save on `#VMEXIT` | `05-exit-decoding.md` |
| 2 | `SVML` | SVM-Lock supported | §1.5 below |
| 1 | `LbrVirt` | LBR virtualization | `03-intercepts.md` |
| 0 | `NP` | Nested paging | `06-nested-paging.md` |

- **Claim.** The table above is the complete `Fn8000_000A_EDX` definition in APM Vol.3 Rev 3.38: bits 9, 11, 14, 22 and 31 are the only reserved positions, and every other bit from 0 to 30 carries a named SVM feature.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** x2AVIC is `Fn8000_000A_EDX[18]`; `EDX[14]` is reserved, `EDX[13]` is `AVIC` and `EDX[15]` is `VMSAVEvirt`. A kernel patch letter that placed x2AVIC at `EDX[14]` is the origin of the widespread error — see `errata.md` E09.  `[APM3 App.E]` `[2]` `C:high` `V:durable`
- **Claim.** `Fn8000_000A_EDX[5] VmcbClean` is the enumeration bit for VMCB state caching and its clean bits, whose semantics are in `02-vmcb.md`.  `[APM2 §15.15]` `[1]` `C:high` `V:durable`

Three EDX bits gate a specific VMCB control word bit rather than a whole feature, which is why
`02-vmcb.md` and this chapter have to be read together:

- **Claim.** `EDX[24] TlbiCtl` is what makes bit 7 of VMCB offset 090h (the INVLPGB/TLBSYNC guest enable) and bit 4 of intercept vector 5 (the TLBSYNC intercept) present at all; without it INVLPGB and TLBSYNC are always enabled in a guest if the processor supports them. Offsets are owned by `02-vmcb.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `EDX[19] SSSCheck` is the enumeration bit for `SSSCheckEn`, bit 4 of VMCB offset 090h, named in the VMCB layout table itself as `CPUID Fn8000_000A_EDX[19]` — one of the few places where AMD spells the dependency out inside the layout table. See `02-vmcb.md`.  `[APM2 Table B-1]` `[1]` `C:high` `V:durable`
- **Claim.** `EDX[6] FlushByAsid` gates the extended VMCB TLB-control encodings; without it only the first two encodings are available. The encodings themselves are owned by `06-nested-paging.md`.  `[APM2 §15.16.1]` `[1]` `C:high` `V:durable`

## 1.4 SVM-related MSRs

AMD collects the SVM MSRs in two places that do not agree in extent: §15.30 describes five of them
in prose, and Table A-7 in Appendix A lists thirteen under the "Secure Virtual Machine" functional
group. Both are normative; the appendix is the superset.

- **Claim.** The SVM MSRs are available **regardless of whether SVM is enabled in `EFER.SVME`**.  `[APM2 §15.30]` `[1]` `C:high` `V:durable`

| MSR address | Name | Role | Where it is specified |
|---|---|---|---|
| `C000_0080h` | `EFER` | Bit 12 `SVME` enables the SVM extensions | §3.1.7, Figure 3-9 |
| `C000_0104h` | `TSC Ratio` | Scales the guest's view of TSC, MPERF and MPerfReadOnly | §15.30.5, Figure 15-29 |
| `C001_0114h` | `VM_CR` | Global SVM controls, including the BIOS disable and lock | §15.30.1, Figure 15-27 |
| `C001_0115h` | `IGNNE` | Sets the processor-internal IGNNE signal; bit 0 only, all other bits MBZ | §15.30.2 |
| `C001_0116h` | `SMM_CTL` | Write-only software control over SMM signals | §15.30.3, Figure 15-28 |
| `C001_0117h` | `VM_HSAVE_PA` | Physical address of the 4 KB host state-save block | §15.30.4 |
| `C001_0118h` | `SVM_KEY` | Write-only password that clears `VM_CR.LOCK` | §15.31.1 |
| `C001_011Bh` | `Doorbell Register` | Sends a doorbell signal to a physical APIC | `07-virtual-interrupts-avic.md` |
| `C001_011Eh` | `VMPAGE_FLUSH` | SEV page flush | `12-sev.md` |
| `C001_011Fh` | `VIRT_SPEC_CTRL` | Virtual speculation control; grouped under Speculation Control, not SVM, in App.A | `17-security.md` |
| `C001_0130h` | `GHCB` | Guest-hypervisor communication block address — see `13-sev-es-ghcb.md` | §15.35.7 |
| `C001_0131h` | `SEV_STATUS` | SEV active-features indication — see `12-sev.md` | §15.34.10 |
| `C001_0132h`–`C001_0138h` | RMP and SNP MSRs | `RMP_BASE`, `RMP_END`, `GUEST_TSC_FREQ`, `VIRTUAL_TOM`, `SEGMENTED_RMP_CFG`, `IDLE_WAKEUP_ICR`, `SECURE_AVIC_CTRL` — see `14-sev-snp.md` | §15.36 |

- **Claim.** The MSR addresses in the table above are as listed in APM Vol.2 Appendix A: `EFER` `C000_0080h`, `TSC Ratio` `C000_0104h`, `VM_CR` `C001_0114h`, `IGNNE` `C001_0115h`, `SMM_CTL` `C001_0116h`, `VM_HSAVE_PA` `C001_0117h`, `SVM_KEY` `C001_0118h`, `Doorbell Register` `C001_011Bh` (owned by `07-virtual-interrupts-avic.md`), `VMPAGE_FLUSH` `C001_011Eh`, `VIRT_SPEC_CTRL` `C001_011Fh`, and the SEV/SNP block at `C001_0130h`–`C001_0138h`.  `[APM2 App.A]` `[1]` `C:high` `V:durable`
- **Claim.** `VIRT_SPEC_CTRL` (`C001_011Fh`) is grouped under "Speculation Control", not "Secure Virtual Machine", in Appendix A, and its cross-reference is §3.2.9 "Speculation Control Registers"; its SSBD control is bit 2.  `[APM2 App.A]` `[1]` `C:high` `V:durable`
- **Claim.** `SMM_KEY` is `C001_0119h` and `Local_SMI_Status` is `C001_011Ah`; both are in the **System Management Mode** group, not the SVM group, even though they sit numerically between `SVM_KEY` and the `Doorbell Register` that `07-virtual-interrupts-avic.md` owns.  `[APM2 App.A]` `[1]` `C:high` `V:durable`

### `EFER.SVME`

- **Claim.** `EFER` is `C000_0080h` and bit 12 is `SVME`, "Secure Virtual Machine Enable"; it defaults to a reset value of zero.  `[APM2 §3.1.7]` `[1]` `C:high` `V:durable`
- **Claim.** The effect of turning off `EFER.SVME` while a guest is running is **undefined**, so the VMM should always prevent guests from writing `EFER`; an attempt by an SEV-ES guest to write 0 to `EFER.SVME` is ignored.  `[APM2 §3.1.7]` `[1]` `C:high` `V:durable`
- **Claim.** Attempting to set an enable bit in `EFER` for a feature the processor does not support results in a `#GP(0)`.  `[APM2 §3.1.7]` `[1]` `C:high` `V:durable`

### `VM_CR` (`C001_0114h`)

| Bit | Field | Behaviour |
|---|---|---|
| 0 | `DPD` | Disables the external hardware debug port and certain internal debug features |
| 1 | `R_INIT` | Non-intercepted INIT signals are converted into an `#SX` exception |
| 2 | `DIS_A20M` | Disables A20 masking |
| 3 | `LOCK` | Writes to `LOCK` and `SVMDIS` are silently ignored while set |
| 4 | `SVMDIS` | Writes to `EFER` treat `SVME` as MBZ while set |
| 63:5 | — | Reserved, MBZ |

- **Claim.** `VM_CR` bit 0 is `DPD`, bit 1 is `R_INIT`, bit 2 is `DIS_A20M`, bit 3 is `LOCK`, bit 4 is `SVMDIS`, and bits 63:5 are Reserved, MBZ.  `[APM2 Figure 15-27]` `[1]` `C:high` `V:durable`
- **Claim.** While `VM_CR.LOCK` is set, writes to `LOCK` and `SVMDIS` are silently ignored; when it is clear, `VM_CR` bits 3 and 4 can be written. Once set, `LOCK` can only be cleared using the `SVM_KEY` MSR, and it is **not affected by INIT or SKINIT**.  `[APM2 §15.30.1]` `[1]` `C:high` `V:durable`
- **Claim.** `VM_CR.SVMDIS` does **not** prevent CPUID from reporting that SVM is available; setting `SVMDIS` while `EFER.SVME` is 1 generates a `#GP` fault regardless of the current state of `VM_CR.LOCK`; `SVMDIS` is not affected by SKINIT, and INIT clears it only when `LOCK` is clear.  `[APM2 §15.30.1]` `[1]` `C:high` `V:durable`

That "CPUID still says yes" clause is the whole reason §1.5 exists: a BIOS-disabled machine passes
the CPUID probe and fails at the `EFER` write.

### `VM_HSAVE_PA` (`C001_0117h`) and its deliberately unspecified contract

- **Claim.** `VM_HSAVE_PA` is a 64-bit read/write MSR holding the physical address of a **4 KB** block where VMRUN saves host state and from which `#VMEXIT` reloads it; the VMM is expected to set it up before the first VMRUN.  `[APM2 §15.30.4]` `[1]` `C:high` `V:durable`
- **Claim.** Writing `VM_HSAVE_PA` causes a `#GP` if any of the low 12 bits of the written address are nonzero, or if the address is greater than or equal to the maximum supported physical address for the implementation.  `[APM2 §15.30.4]` `[1]` `C:high` `V:durable`
- **Claim.** The format of the host save area is intentionally unspecified: implementations may store only part or none of the host state in the memory pointed to by `VM_HSAVE_PA` and may keep some or all of it in hidden on-chip storage, so **software must not rely on the format or contents of the host save area, nor attempt to change host state by modifying it**.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`

The practical consequence: a hypervisor may not snapshot, migrate, or patch host state through this
page, and a debugger dumping it will see implementation-dependent garbage on some parts and a
recognisable state-save layout on others. Appendix B does give the host save area a format — it is
the guest save area shifted by 400h — but it gets no table of its own, and §15.5.1 overrides it for
any purpose other than reading the appendix. See `02-vmcb.md`.

### `SVM_KEY` (`C001_0118h`) and SVM-Lock

- **Claim.** SVM-Lock lets software prevent `EFER.SVME` from being set either unconditionally or with a 64-bit key, and support is indicated by `Fn8000_000A_EDX[SVML] = 1`.  `[APM2 §15.31]` `[1]` `C:high` `V:durable`
- **Claim.** `SVM_KEY` is write-only: reading it always returns zero. When `VM_CR.LOCK` is zero a write **sets** the 64-bit key; when `VM_CR.LOCK` is one a write **compares**, and clears `VM_CR.LOCK` only if the values match and are non-zero.  `[APM2 §15.31.1]` `[1]` `C:high` `V:durable`
- **Claim.** If the SVM key is zero while `VM_CR.LOCK` is one, `VM_CR.LOCK` can only be cleared by a processor reset; software should read `VM_CR.LOCK` back after writing `SVM_KEY` to find out whether the unlock succeeded.  `[APM2 §15.31.1]` `[1]` `C:high` `V:durable`

### `TSC Ratio` (`C000_0104h`)

- **Claim.** The TSC Ratio MSR expresses `TSCRatio` as an 8.32 fixed-point number: bits 39:32 are `INT`, bits 31:0 are `FRAC`, and bits 63:40 are Reserved, MBZ. The reset value is 1.0.  `[APM2 Figure 15-29]` `[1]` `C:high` `V:durable`
- **Claim.** `TSCRatio` scales TSC, MPERF and MPerfReadOnly as read by a guest, but has no effect in host mode or when virtualization is disabled, and does not change the rate of the underlying counters; support is indicated by `Fn8000_000A_EDX[TscRateMsr] = 1`.  `[APM2 §15.30.5]` `[1]` `C:high` `V:durable`

The composition of `TSCRatio` with the VMCB's TSC offset field, and the synthetic-TSC arithmetic
that follows from it, are owned by `03-intercepts.md`.

## 1.5 Enabling SVM, and why the chain lies on Windows

### Step 0, on Windows: ask who already owns the processor

Put this first, because on a Windows PC it decides the answer before any of the hardware probes
run. Every probe in §1.5 can succeed and a third-party VMM can still fail to reach guest mode,
because the platform's SVM host role is already taken.

- **Claim.** On Windows, enabling Hyper-V, the Virtual Machine Platform (which WSL2 uses), Windows Sandbox, Microsoft Defender Application Guard, Credential Guard or memory integrity causes the Windows hypervisor to be launched at boot; Microsoft documents this set as the reason third-party virtualization applications stop working.  `[101]` `C:high` `V:durable`
- **Claim.** When the Windows hypervisor owns the platform, the supported route for another VMM is the Windows Hypervisor Platform (WHP) user-mode API rather than executing VMRUN itself.  `[100]` `C:medium` `V:durable`
- **Claim.** A hypervisor-present indication is architecturally available to software in this situation: `Fn0000_0001_ECX[31]` is set by hypervisors and clear on physical CPUs, so a would-be VMM can distinguish "SVM is available" from "SVM is available and already in use".  `[APM2 §15.2.2]` `[1]` `C:high` `V:durable`

The detail of which Windows features pull in the hypervisor, what VBS and HVCI do with it, and how
WHP-backed third-party VMMs behave belongs to `16-windows-platform.md`. What matters here is the
ordering: **check for a hypervisor before trusting the enable chain below**, because the chain is a
statement about silicon and firmware, not about the operating system.

### The hardware chain

AMD gives the detection algorithm as pseudocode, and it is worth quoting exactly because its shape
is not "read one bit":

> ```
> if (CPUID Fn8000_0001_ECX[SVM] == 0)
>   return SVM_NOT_AVAIL;
> if (VM_CR.SVMDIS == 0)
>   return SVM_ALLOWED;
> if (CPUID Fn8000_000A_EDX[SVML] == 0)
>   return SVM_DISABLED_AT_BIOS_NOT_UNLOCKABLE
>   // the user must change a platform firmware setting to enable SVM
> else return SVM_DISABLED_WITH_KEY;
>   // SVMLock may be unlockable; consult platform firmware or TPM to obtain the key.
> ```

- **Claim.** The detection algorithm above, including the three outcome names `SVM_NOT_AVAIL`, `SVM_ALLOWED`, `SVM_DISABLED_AT_BIOS_NOT_UNLOCKABLE` and `SVM_DISABLED_WITH_KEY`, is AMD's own; software "should" use it before enabling SVM.  `[APM2 §15.4]` `[1]` `C:high` `V:durable`

Reading the chain as a decision tree:

1. **`Fn8000_0001_ECX[2] == 0`** — the part has no SVM. Nothing recoverable.
2. **`VM_CR.SVMDIS == 0`** — SVM is allowed. Note the polarity: the *absence* of the disable, not the presence of an enable, is what clears the gate.
3. **`SVMDIS == 1` and `Fn8000_000A_EDX[2] SVML == 0`** — firmware disabled SVM and the part has no SVM-Lock, so there is no key mechanism. The only remedy is a firmware setting change. This is the case behind almost every "enable SVM in BIOS" instruction.
4. **`SVMDIS == 1` and `SVML == 1`** — SVM-Lock is present, so the block may be releasable with the 64-bit key through `SVM_KEY`, obtained from platform firmware or the TPM.
5. Then, and only then, set `EFER.SVME`, and set up `VM_HSAVE_PA` before the first VMRUN.

- **Claim.** When the SVM-Lock feature is not available, hypervisors can use the read-only `VM_CR.SVMDIS` bit to detect SVM; on processors that do support SVM-Lock, SKINIT and STGI can be executed even with `EFER.SVME = 0`.  `[APM2 §15.31]` `[1]` `C:high` `V:durable`
- **Claim.** VMRUN is available only at CPL 0 — a higher CPL raises `#GP(0)` — and additionally requires protected mode and `EFER.SVME = 1`, otherwise `#UD`; VMRUN inside an SMM handler is not supported and its behaviour is undefined.  `[APM2 §15.5]` `[1]` `C:high` `V:durable`

### Failure symptoms, mapped back to the chain

| Symptom | Most likely stage | Discriminator |
|---|---|---|
| CPUID says no SVM | Stage 1 | `Fn8000_0001_ECX[2] = 0` |
| CPUID says yes, `WRMSR EFER` takes a `#GP` or the SVME bit reads back 0 | Stage 3 or 4 | Read `VM_CR`: `SVMDIS = 1` |
| `VM_CR` cannot be rewritten to clear `SVMDIS` | Stage 3/4 lock | `VM_CR.LOCK = 1` |
| Everything reads clean but VMRUN never runs | Not a hardware stage | `Fn0000_0001_ECX[31] = 1`; see `16-windows-platform.md` |
| First VMRUN faults or shuts down | After the chain | `VM_HSAVE_PA` unset or misaligned; `#GP` on the write if low 12 bits are nonzero |

- **Claim.** The row "everything reads clean but VMRUN never runs" has no APM stage because the APM does not model a second hypervisor already occupying host mode; it is diagnosed from the hypervisor-present bit and the platform, not from `VM_CR`.  `[no-spec]` `[100]` `C:medium` `V:durable`

## 1.6 Probing discipline: firmware can mask individual bits

The single rule for consuming everything above: **probe each bit, on the part in front of you, at
run time.** Do not infer a feature from a Zen generation, a model number, or the presence of a
neighbouring bit.

The architecture is built for that discipline rather than for generational inference. Each SVM
feature carries its own enumeration bit; several VMCB control bits are declared present *only* when
a named `Fn8000_000A_EDX` bit is set (§1.3); and the manual explicitly hands implementation-specific
behaviour to per-product documentation.

- **Claim.** APM Vol.2 §15.30 defers the implementation-specific details of the SVM MSRs to "the *BIOS and Kernel Developer's Guide* (BKDG) or *Processor Programming Reference Manual* (PPR) applicable to your product" — that is, the architecture manual deliberately does not fix them.  `[APM2 §15.30]` `[1]` `C:high` `V:durable`
- **Claim.** The maximum ASID value supported by a processor is implementation specific and is discoverable only by executing `CPUID Fn8000_000A` and reading EBX — there is no architectural constant.  `[APM2 §15.5.1]` `[1]` `C:high` `V:durable`
- **Claim.** AMD publishes no PPR and no revision guide for client Ryzen parts, so "this generation should have it" cannot be checked against a first-party document and must not be used as a substitute for a run-time probe; the third-party-circulated PPR 56713 is not in AMD's public index and is not citable.  `[no-spec]` `[30]` `C:medium` `V:durable`

Concrete consequences for initialization code:

- Test `Fn8000_0001_ECX[2]` before reading `Fn8000_000A` at all — that leaf is reserved when SVM is absent, so a blind read returns undefined data rather than zeros.
- Test `Fn8000_000A_EDX[5] VmcbClean` before writing anything but zero into the VMCB clean field; the field is backward compatible, and older parts neither cache VMCB state nor read the field. Clean-field semantics are in `02-vmcb.md`.
- Test `Fn8000_000A_EDX[3] NRIPS` before trusting nRIP after a `#VMEXIT` — see `05-exit-decoding.md`.
- Test `Fn8000_000A_EDX[24] TlbiCtl` before setting bit 7 of VMCB offset 090h, because that bit is declared present only when the CPUID bit is 1 — see `02-vmcb.md`.
- Never derive `NASID` from a table of part numbers; read EBX.

- **Claim.** The VMCB clean field is backward compatible with CPUs that do not support VMCB state caching: older CPUs neither cache VMCB state nor read the field, and hypervisors unaware of the feature that respect the SBZ property of undefined VMCB fields will simply not enable it. Clean-field mechanics are owned by `02-vmcb.md`.  `[APM2 §15.15.1]` `[1]` `C:high` `V:durable`

## 1.7 Open items

- **AMD's own cross-references inside the CPUID tables are not reliable.** APM Vol.3 Rev 3.38 points `Fn8000_000A_ECX[4] PML` at "APM Volume 2, Section 15.24.25, *Page Modification Logging*". No such section exists: Vol.2's bookmark tree places Page Modification Logging at **§15.25.15**. Use Vol.2's own numbering, never a cross-reference printed in Vol.3.
- **The `Fn8000_000A_ECX` subsection has a copy-paste defect.** Its introductory sentence reads "The value returned in **EDX** provides Secure Virtual Machine architecture feature information" while describing ECX. The bit table itself is unambiguous and was used here; the prose sentence is wrong.
- **`VM_CR.SVMDIS` is described as read-only in one section and writable in another.** §15.31 calls it "the read-only `VM_CR.SVMDIS` bit"; §15.30.1 specifies exactly when writes to it take effect (`VM_CR.LOCK` clear) and what happens when they do not. The two statements are reconcilable only if "read-only" means "read-only to a hypervisor on a firmware-locked part". This chapter states the §15.30.1 rules and flags the wording conflict rather than picking one.
- **The `EFER` bit table prints an overlapping reserved range.** Figure 3-9's table lists "63:22 Reserved" immediately above the row defining bit 24 (`EnhancedTlbi`) and a second "23:22 Reserved" row. Read the first as 63:25. The `SVME` row at bit 12 is unaffected.
- **Appendix A's cross-reference for `SEV_STATUS` points at §15.35.10.** The section is §15.34.10. Not load-bearing here, but it is a second instance of the same defect class, so do not use Appendix A's page cross-references as section authorities.
- **`SvmRev` values are not enumerated anywhere in the manual.** `Fn8000_000A_EAX[7:0]` is defined as "SVM revision number" with no list of legal values and no statement of what a given revision implies. Any claim of the form "revision 1 means X" would be unsourceable from the APM; this chapter therefore states the field and nothing more.
- **No architectural statement exists that firmware may mask an individual `Fn8000_000A` bit.** The probing discipline in §1.6 is argued from the structure of the enumeration (per-feature bits, per-bit presence statements inside the VMCB layout table, and §15.30's explicit deferral to per-product documents), not from a sentence that says "firmware may clear bit N". It is recorded as `[no-spec]` where it is stated as a rule.
