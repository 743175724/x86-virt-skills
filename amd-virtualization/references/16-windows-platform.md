# 16. AMD Virtualization on Windows

> **中文速览**：本章只写 **AMD delta**——Windows 虚拟化栈里与厂商相关的那部分。厂商无关的 Windows 深度（分区模型、hypercall ABI、synthetic MSR 全表、VMBus 环、调度器、WHP 的完整 API 面）在 `intel-vt/17-windows-platform.md`，本章交叉引用而不复述；但本章对自己必须回答的问题保持自足，不跳转也能给出可用答案。核心一条：**一旦 VBS / 内存完整性 / WSL2 / Windows 沙盒 / Docker Desktop / Hyper-V 角色中的任何一个被启用，Windows hypervisor 就持有 `EFER.SVME`，Windows 内核自己以 VTL0 guest 身份运行**，第三方 VMM 只能经 WHP 嵌套运行——"为什么我的 VMM / 驱动 / 调试器用不了 AMD-V"几乎总是归结到这里。其余覆盖：`Hvax64.exe` 与启动链、VBS/HVCI/Credential Guard 的 AMD 硬件前提（AMD-V + RVI + IOMMU，HVCI 侧的 GMET）、Kernel DMA Protection 走 AMD-Vi 与 IVRS、AMD 上的嵌套与 Hyper-V 的 **enlightened VMCB fields**、WHP 共存、AM4/AM5 固件项、DDA 与 GPU 分区、hypervisor 存在性检测、Windows 侧诊断命令。**产品版本状态与默认值在 `90-dated-landscape.md`，开销数字在 `18-performance.md`。**

**Maps to:** Microsoft Learn + the Hypervisor Top-Level Functional Specification (Tier-2: authoritative for Windows behaviour, and **not** an AMD specification — no APM anchor belongs on a claim in this chapter) [41][42][43][45][46]
**Owns:** who owns SVM on Windows · `Hvax64.exe` and the AMD boot chain · the AMD hardware prerequisites for VBS/HVCI/Credential Guard · Kernel DMA Protection over AMD-Vi and IVRS · nesting on AMD and Hyper-V's enlightened VMCB fields · WHP coexistence · AM4/AM5 firmware settings · DDA versus GPU partitioning · hypervisor detection · Windows-side diagnostics
**Scope:** Windows (Tier-2). Client-relevant throughout; the DDA material in §16.8 is server scope and says so.
**See also:** `01-svm-intro.md` (the probe chain that lies here) · `06-nested-paging.md` (RVI/NPT and GMET, the hardware VBS and HVCI rest on) · `08-iommu-architecture.md` (AMD-Vi) · `09-iommu-page-tables.md` (IVRS) · `10-iommu-interrupt-remapping.md` (the Linux/VFIO contrast) · `11-memory-encryption.md` (what client parts actually have) · `15-nested-virtualization.md` (the nested SVM mechanism) · `18-performance.md` (what any of this costs) · `90-dated-landscape.md` (versions, defaults, product status) · `intel-vt/17-windows-platform.md` (vendor-neutral Windows depth)

---

## 16.1 Who owns SVM once VBS is on

This is the single most frequently needed fact in the chapter, so it comes first.

On an AMD system, SVM host mode has exactly one owner per logical processor: the software that
set `EFER.SVME` and pointed `VM_HSAVE_PA` at its own save area. That enable chain is owned by
`01-svm-intro.md`. What matters here is who gets there first on a Windows PC — and on a modern
Windows PC it is very often not the software asking the question.

- **Claim.** Microsoft states the constraint without vendor vocabulary: "many virtualization applications depend on hardware virtualization extensions" — the page names "Intel VT-x and AMD-V" — but "only one software component at a time can use this hardware. Virtualization applications can't share the hardware."  `[101]` `C:high` `V:durable`
- **Claim.** On AMD the resource being claimed is not a VMXON region: it is `EFER.SVME` together with the host state-save area, so the Windows-side rule must be phrased as "whoever set `EFER.SVME`", and firmware can pre-empt the whole question through `VM_CR.SVMDIS` and `VM_CR.LOCK` before any operating system runs. Both mechanisms belong to `01-svm-intro.md`.  `[101]` `C:medium` `V:durable`
- **Claim.** Enabling the Hyper-V role, the Virtual Machine Platform optional component (which WSL 2 uses), Windows Sandbox, Docker Desktop's Windows backends, memory integrity or Credential Guard launches the Windows hypervisor at boot, whether or not a virtual machine is ever created; Microsoft documents that "third-party virtualization applications … can't run alongside Hyper-V, Memory Integrity, or Credential Guard".  `[101]` `C:high` `V:durable`
- **Claim.** Once that has happened the Windows installation the user interacts with is a guest: it is the root partition, running in VTL0 above the hypervisor, with the hypervisor holding SVM host mode. Virtualization-based security is a Hyper-V-backed feature, which is why "Hyper-V is not installed" is not evidence that SVM is free.  `[44][101]` `C:high` `V:durable`
- **Claim.** Therefore every question of the form "why can't my VMM, my driver or my debugger use AMD-V on this machine" resolves the same way: the Windows hypervisor already holds `EFER.SVME`, and the requesting software must either go through the Windows Hypervisor Platform (§16.6), run as a nested guest (§16.5), or have the hypervisor turned off (§16.2).  `[100][101]` `C:high` `V:durable`

### 16.1.1 Why the hardware probe chain lies here

`01-svm-intro.md` gives the correct hardware enable chain: CPUID `Fn8000_0001 ECX[2]` → `VM_CR`
(`SVMDIS`, `LOCK`) → `EFER.SVME` → `VM_HSAVE_PA`. On a Windows PC with any Hyper-V-backed feature
enabled, **every stage of that chain reads healthy and the VMM still cannot start**, because the
chain describes the hardware and says nothing about a second hypervisor already occupying host
mode.

- **Claim.** The correct order of questions on Windows is: (1) is a hypervisor already present — CPUID leaf 1, ECX bit 31, §16.9; (2) if so, which one — CPUID leaf `0x40000000`, §16.9; (3) only then the hardware chain in `01-svm-intro.md`. Reversing (1) and (3) is what produces the "everything looks fine but VMRUN never runs" report.  `[101][463]` `C:high` `V:durable`
- **Claim.** A guest-side reading of `VM_CR` or `EFER` under Hyper-V is not a reading of the physical processor's state; the values a nested VMM sees are whatever the level above chose to present, so they cannot be used to decide whether the platform is free.  `[464]` `C:medium` `V:durable`

### 16.1.2 The four independent layers

"Is the hypervisor running" is decided at four layers, and an availability question is usually a
question about which layer said no.

| Layer | What must be true on an AMD PC | Where it is checked |
|---|---|---|
| Silicon | AMD-V (SVM) plus RVI/nested paging; an IOMMU for the DMA-protection features | `01-svm-intro.md`, `06-nested-paging.md`, `08-iommu-architecture.md` |
| Firmware | `SVM Mode` enabled; IOMMU enabled; the IVRS DMA-remap indicator set for Kernel DMA Protection | §16.7, §16.4 |
| Platform feature | The Windows virtualization platform installed and the hypervisor on the boot path | §16.2 |
| Consumer | Something actually wants it — the Hyper-V role, VBS, or one of the utility VMs | §16.1, §16.3 |

- **Claim.** Layers 3 and 4 are separable: a machine can have the platform present with the hypervisor not launched, or the hypervisor launched for a security feature with no virtual machine defined at all.  `[101][474]` `C:high` `V:durable`
- **Claim.** Microsoft's own prerequisite statement for Hyper-V on Windows is a 64-bit processor with second-level address translation, VM Monitor Mode extensions, hardware-assisted virtualization (named as "Intel VT or AMD-V technology"), hardware-enforced Data Execution Prevention (AMD's NX bit), and "virtualization support turned on in the BIOS or UEFI".  `[475]` `C:high` `V:durable`

### 16.1.3 Symptom to cause, on an AMD PC

Each row below is the AMD reading of a symptom that `01-svm-intro.md` cannot diagnose on its own,
because the hardware chain it describes is not where the answer lives.

| Symptom | Most likely cause | Where to look |
|---|---|---|
| `Fn8000_0001 ECX[2]` reads 0 | SVM disabled in firmware, possibly with `VM_CR.LOCK` set | §16.7, then `01-svm-intro.md` |
| CPUID and `VM_CR` both clean, writing `EFER.SVME` faults or VMRUN never runs | the Windows hypervisor already holds SVM host mode | §16.1, §16.9 |
| A third-party VMM reports "AMD-V is disabled in the BIOS" on a machine where it plainly is not | the same cause — the product is reporting the symptom, not the cause | §16.1, §16.6 |
| A kernel driver that generates or patches code fails to load | memory integrity enforcing kernel-mode code integrity from VTL1 | §16.3.2 |
| A game or anti-cheat behaves differently after enabling WSL 2 | hypervisor-present detection, not a hardware change | §16.9 |
| `msinfo32` shows Kernel DMA Protection `Off` although the IOMMU is enabled | the board does not publish the firmware opt-in data the feature needs | §16.4.1 |
| Nested Hyper-V refuses to start inside a VM on an AMD host | host OS below Windows Server 2022 / Windows 11, or VM configuration version below 9.3 | §16.5 |
| A discrete GPU cannot be assigned to a VM on a desktop board | DDA is server scope; the board cannot grant Native PCI Express Control | §16.8.1 |

- **Claim.** The middle three rows share one structural property that makes them hard to debug: nothing on the machine is misconfigured. The hardware is present and enabled, the firmware is correct, and the platform is behaving as designed — the only thing that changed is which software holds SVM host mode.  `[101]` `C:medium` `V:durable`

---

## 16.2 The Hyper-V components on an AMD host

Very little of Hyper-V is vendor-specific. The partition model, the hypercall interface, the
synthetic devices and the scheduler are identical on both vendors by design — the TLFS goes out of
its way to abstract the difference, and `intel-vt/17-windows-platform.md` documents that machinery
once. Three things are not identical, and they are what this section carries: which binary is
loaded, how the hypervisor is put on the boot path, and what the VTL split rests on.

- **Claim.** Hyper-V ships a per-architecture hypervisor binary and picks one at boot: on Intel systems the image is `Hvix64.exe`, on AMD systems it is **`Hvax64.exe`**, and on ARM64 it is `Hvaa64.exe`. This is documented in *Windows Internals, Part 2*, 7th edition — it is **not** on learn.microsoft.com, so no product-documentation citation for it exists.  `[46]` `C:high` `V:durable`
- **Claim.** Both x64 images are present in `%SystemRoot%\System32` on every x64 Windows installation, because the selection is made at boot and not at install time; finding the Intel-build image on an AMD machine is therefore not evidence of anything, and it is a common source of false "Hyper-V is misconfigured" reports.  `[no-spec]` `[46]` `C:medium` `V:durable`
- **Claim.** The loader is `Hvloader.dll`, invoked from the Windows boot loader; it is what selects and starts the correct hypervisor image. The pre-rebuild corpus additionally named an `hvboot.sys` stage, for which this corpus has no first-party source — see §16.12.  `[no-spec]` `[46]` `C:medium` `V:durable`
- **Claim.** Whether the hypervisor is launched at all is a boot-configuration setting: the `hypervisorlaunchtype` BCD option takes the values **`Off`** and **`Auto`**, and Microsoft's boot-option reference describes it as controlling "the hypervisor launch options".  `[474]` `C:high` `V:durable`
- **Claim.** Setting `hypervisorlaunchtype` to `Off` is the blunt instrument that frees SVM for a third-party VMM, and it disables every Hyper-V-backed feature at the same time — VBS, memory integrity, Credential Guard, WSL 2, Windows Sandbox and Docker Desktop's Windows backends all stop working, because each of them is a consumer of the same hypervisor. Since §16.6, it is also usually unnecessary.  `[101][474]` `C:high` `V:durable`
- **Claim.** Above the hypervisor the split is by Virtual Trust Level: the ordinary Windows kernel runs in VTL0 and the secure kernel, `securekernel.exe`, runs in VTL1; the VTL boundary, not a second partition, is what VBS isolates with. The VTL model itself is vendor-neutral and its depth is in `intel-vt/17-windows-platform.md`.  `[45]` `C:high` `V:durable`
- **Claim.** On AMD the guest-physical-to-system-physical stage that enforces the VTL boundary is nested paging (RVI), owned by `06-nested-paging.md`; there is no AMD-specific Windows structure involved, which is why the VTL material does not need restating per vendor.  `[42][45]` `C:medium` `V:durable`

---

## 16.3 VBS, HVCI and Credential Guard

These are the features that turn an ordinary Windows PC into a hypervisor host. Their AMD
prerequisites are documented by Microsoft in AMD's own vocabulary.

### 16.3.1 The AMD hardware prerequisites for VBS

- **Claim.** Microsoft states the baseline as a hypervisor requirement: "Virtualization-based security (VBS) requires the Windows hypervisor, which is only supported on 64-bit IA processors with virtualization extensions, including Intel VT-X and AMD-v."  `[42]` `C:high` `V:durable`
- **Claim.** Second-level address translation is a **hard** requirement rather than an acceleration, and Microsoft names the AMD side explicitly: "VBS also requires that the processor's virtualization support includes Second Level Address Translation (SLAT), either Intel VT-X2 with Extended Page Tables (EPT), or AMD-v with Rapid Virtualization Indexing (RVI)." RVI is AMD's marketing name for nested paging; the hardware is owned by `06-nested-paging.md`.  `[42]` `C:high` `V:durable`
- **Claim.** An IOMMU is part of the same requirement set: "All I/O devices capable of DMA must be behind an IOMMU or SMMU. An IOMMU can be used to enhance system resiliency against memory attacks." On an AMD platform that IOMMU is AMD-Vi, owned by `08-iommu-architecture.md`.  `[42]` `C:high` `V:durable`
- **Claim.** The remaining VBS platform requirements are not CPU-vendor-specific: TPM 2.0, Secure Boot enabled, firmware hardened per the Windows SMM Security Mitigations Table, a UEFI v2.6 Memory Attributes Table, Secure MOR v2, and drivers verified compatible with memory integrity.  `[42]` `C:high` `V:durable`
- **Claim.** **VBS does not depend on SEV, SEV-ES or SEV-SNP, and does not use them.** The memory-encryption features a client AMD part actually has are covered in `11-memory-encryption.md`; nothing in Microsoft's VBS requirement set names any of them.  `[42]` `C:high` `V:durable`

### 16.3.2 HVCI, and where GMET comes in

Memory integrity — HVCI — moves the kernel-mode code-integrity decision into the secure kernel in
VTL1, so a VTL0 kernel page cannot be both writable and executable. The page-level mechanism is
vendor-neutral and lives in `intel-vt/17-windows-platform.md`. The AMD delta is the hardware
primitive that makes it affordable.

- **Claim.** Microsoft's memory-integrity enablement guidance lists **"MBEC/GMET Required"** as compatibility bit 4 (hex value `0x00000010`) in its x64 compatibility-issue table, alongside "SLAT required" (bit 1, `0x00000002`), "IOMMU required" (bit 3, `0x00000008`) and "Hardware virtualization required" (bit 10, `0x00000400`). GMET is the AMD half of that pair.  `[461]` `C:high` `V:durable`
- **Claim.** GMET — the Guest Mode Execute Trap extension, `CPUID Fn8000_000A EDX[17]` — is what lets a hypervisor make supervisor-mode execution of a page a trappable event without making the page non-executable to user mode, which is exactly the primitive kernel-mode code-integrity enforcement needs. The bit table, the VMCB enable and the nested U/S semantics are owned by `06-nested-paging.md`; do not restate them here.  `[42][461]` `C:high` `V:durable`
- **Claim.** Microsoft's default-enablement hardware table names the AMD floor as "AMD Zen 2 architecture and newer", with the non-vendor-specific rows being a minimum of 8 GB RAM on x64, an SSD of at least 64 GB, memory-integrity-compatible drivers, and "Virtualization must be enabled" in BIOS.  `[461]` `C:high` `V:durable`
- **Claim.** Without GMET the feature can still be enforced, but the hypervisor has to fall back on making pages non-executable for both privilege levels and taking a nested page fault on every transition, which is why Microsoft treats MBEC/GMET as a compatibility gate for the default-on path rather than as an optional tuning knob. Whether a specific Windows build enables memory integrity by default on a given part is a product-status question for `90-dated-landscape.md`.  `[461]` `C:medium` `V:durable`

### 16.3.3 Credential Guard

- **Claim.** "Credential Guard uses Virtualization-based security (VBS) to isolate secrets so that only privileged system software can access them", so its hardware dependency list is the VBS list in §16.3.1 plus Secure Boot; TPM 1.2 or 2.0 and UEFI lock are recommended rather than required.  `[466]` `C:high` `V:durable`
- **Claim.** Credential Guard therefore has no AMD-specific requirement of its own beyond AMD-V plus RVI plus an IOMMU: it inherits them from VBS. The version at which it became default-on belongs to `90-dated-landscape.md`.  `[466]` `C:high` `V:durable`

### 16.3.4 The checklist, in the order a reader should apply it

For "does this AMD machine support VBS / memory integrity / Credential Guard", the questions are:

1. **AMD-V present and enabled in firmware** — the hypervisor requirement (§16.3.1). Probe per `01-svm-intro.md`; check the firmware switch per §16.7.
2. **RVI / nested paging present** — hard requirement, not an optimisation. `CPUID Fn8000_000A EDX[0]`; the enumeration is owned by `01-svm-intro.md` and the mechanism by `06-nested-paging.md`.
3. **An IOMMU, enabled** — AMD-Vi, present on the SoC on client AM4 and AM5 parts (`08-iommu-architecture.md`), but frequently left at a firmware default that resolves to disabled (§16.7).
4. **GMET** — `Fn8000_000A EDX[17]`, the MBEC/GMET compatibility gate for the memory-integrity default-on path (§16.3.2); the extension itself is owned by `06-nested-paging.md`.
5. **TPM 2.0, Secure Boot, and the firmware tables** — vendor-neutral, listed in §16.3.1.

- **Claim.** Steps 1 and 2 are what Microsoft calls the hypervisor and SLAT requirements; step 3 is the IOMMU requirement; step 4 is the memory-integrity compatibility gate rather than a VBS baseline item, which is why a machine can run VBS and Credential Guard while failing the memory-integrity default-on test.  `[42][461]` `C:medium` `V:durable`
- **Claim.** None of the five steps involves SEV, SEV-ES, SEV-SNP or an ASID; a reader arriving from AMD's confidential-computing material will find no overlap, and `11-memory-encryption.md` is where the client memory-encryption story actually is.  `[42]` `C:high` `V:durable`

### 16.3.5 What it costs the author of kernel-mode code

- **Claim.** Kernel-mode software that allocates writable-executable memory, generates code at run time or patches kernel code is incompatible with memory integrity by construction rather than by policy: the constraint is enforced from VTL1 using nested-paging permissions the VTL0 kernel cannot modify, so a compromised or merely creative VTL0 driver cannot mark its own page executable.  `[461][465]` `C:high` `V:durable`
- **Claim.** On AMD that enforcement is cheaper than the naive form because GMET lets the hypervisor trap supervisor-mode execution of a page without withdrawing user-mode execute permission on it — the per-page cost profile, not a per-call one. The page-level mechanism in full is vendor-neutral and lives in `intel-vt/17-windows-platform.md`; what any of it costs in measured terms belongs to `18-performance.md`.  `[461]` `C:medium` `V:durable`

---

## 16.4 Kernel DMA Protection over AMD-Vi

This is where a reader following Intel-oriented material will go wrong: the feature is often
described as being built on VT-d, which makes it look Intel-exclusive. It is not. Microsoft's own
product page is vendor-neutral, and the OEM requirements page gives an explicit AMD half for every
Intel item.

- **Claim.** Microsoft describes the mechanism without naming a vendor: "Windows uses the system Input/Output Memory Management Unit (IOMMU) to block external peripherals from starting and performing DMA, unless the drivers for these peripherals support memory isolation (such as DMA-remapping)."  `[43]` `C:high` `V:durable`
- **Claim.** The OEM requirements name both IOMMUs in the same row — "IOMMU (Intel VT-D, AMD-Vi)" — and state that "All I/O devices capable of DMA must be behind an enabled (by default) IOMMU", on "64-bit IA processors with virtualization extensions, including Intel VT-X and AMD-v".  `[462]` `C:high` `V:durable`
- **Claim.** The ACPI opt-in indicator is vendor-specific and this is the sharpest AMD delta in the chapter: on Intel platforms firmware sets `DMA_CTRL_PLATFORM_OPT_IN_FLAG` in the DMAR table's flags field, while **on AMD platforms firmware must set the "DMA remap support" bit in the IVRS table's `IVinfo` field**. IVRS itself is owned by `09-iommu-page-tables.md`.  `[462]` `C:high` `V:durable`
- **Claim.** The pre-boot rule has an AMD half too: "No device may perform DMA outside of RMRR regions (Intel) or **IVMD blocks (AMD)** after ExitBootServices()", and a violation is expected to raise an IOMMU fault and bug check `0xE6`.  `[462]` `C:high` `V:durable`
- **Claim.** Two further platform requirements are vendor-neutral but frequently missed: "Enabling PCI Express Native Control using _OSC ACPI method is required for Kernel DMA Protection support", and a TPM 2.0 — discrete or firmware — must be present, with firmware required to extend an `EV_EFI_ACTION` event carrying the string "DMA Protection Disabled" into `PCR[7]` on any boot where the IOMMU or Kernel DMA Protection is disabled.  `[462]` `C:high` `V:durable`
- **Claim.** Virtualization-based security is **not** a prerequisite: Microsoft states the requirement as UEFI firmware support plus "Hyper-V - Virtualization Enabled in Firmware", which is the IOMMU and virtualization firmware switch, not VBS.  `[43]` `C:high` `V:durable`

### 16.4.1 Why a consumer AM5 board with the IOMMU on can still report Off

- **Claim.** The check is `msinfo32` — the System Information field named "Kernel DMA Protection" reads `ON` when the platform supports it.  `[43]` `C:high` `V:durable`
- **Claim.** Microsoft gives exactly two diagnoses. If the field is `Off` **and** "Hyper-V - Virtualization Enabled in Firmware" is `NO`, the firmware switch is the cause and must be turned on. If the field remains `Off` with that switch on, then "the system doesn't support Kernel DMA Protection" — which is the usual outcome on a consumer desktop board, because the firmware never sets the IVRS `IVinfo` DMA-remap indicator, never satisfies the pre-boot isolation rules, and may not grant `_OSC` PCI Express native control.  `[43][462]` `C:high` `V:durable`
- **Claim.** The corollary matters for expectation-setting: turning `IOMMU` from `Auto` to `Enabled` in an AM4 or AM5 setup menu makes the IOMMU usable for passthrough and for VBS, and does **not** by itself make Kernel DMA Protection available, because that feature additionally needs firmware opt-in data the board does not publish.  `[43][462]` `C:medium` `V:durable`
- **Claim.** Two scope limits Microsoft states directly: "Kernel DMA Protection only protects against drive-by DMA attacks after the OS is loaded. It's the responsibility of the system firmware/BIOS to protect against attacks via the Thunderbolt 3 ports during boot", and the feature "doesn't protect against DMA attacks via 1394/FireWire, PCMCIA, CardBus, or ExpressCard".  `[43]` `C:high` `V:durable`
- **Claim.** The external ports in scope are the hot-pluggable PCIe classes — "PCIe hot plug devices such as Thunderbolt, USB4, and CFexpress" — and the enforcement is time-based: "Peripherals with DMA Remapping incompatible drivers are blocked from starting if the peripheral was plugged in before an authorized user logs in, or while the screen is locked", after which the driver starts normally until reboot or unplug. A driver's remapping capability is visible per device, where "A value of 2 means that the device driver supports DMA-remapping".  `[43]` `C:high` `V:durable`

---

## 16.5 Nested virtualization on AMD

Nested virtualization on AMD under Hyper-V is **supported**. The pre-rebuild corpus recorded it as
unavailable; `errata.md` `E13` corrects that.

- **Claim.** Microsoft publishes separate prerequisite sets for the two vendors on the same page, selected by an Intel tab and an AMD tab. The **AMD** set is: "The Hyper-V host must be either Windows Server 2022 or later, or Windows 11 or later" and "VM configuration version 9.3 or higher". The Intel set is Windows Server 2016 or later / Windows 10 or later with configuration version 8.0 or higher.  `[460]` `C:high` `V:durable`
- **Claim.** The AMD prerequisite set sits under the page's own heading **"AMD EPYC / Ryzen processor or later"**, so Microsoft does state a processor-family requirement; the Intel heading beside it reads "Intel processor with VT-x and EPT technology".  `[460]` `C:high` `V:durable`
- **Claim.** **What Microsoft names nowhere is a Zen generation.** "EPYC / Ryzen or later" is a product-family phrase, not a silicon generation, and the operative gates are the host OS version and the VM configuration version. Do not convert it into "Zen 2 or later" or any similar reading.  `[41][460]` `C:high` `V:durable`
- **Note.** The heading is an `<h3>` element, and a text-extraction proxy that flattens headings drops it — which is how an earlier draft of this chapter concluded the phrase was no longer on the page. Re-fetch with HTML preserved before asserting that Microsoft removed something.
- **Claim.** The enable step is a single cmdlet, run with the virtual machine turned off: `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`, and the same cmdlet with `$false` reverses it.  `[460]` `C:high` `V:durable`
- **Claim.** Microsoft's stated limits on the nested guest are vendor-neutral: the virtual machine must be turned off to adjust its memory, and "Virtualization applications other than Hyper-V aren't supported" inside a Hyper-V virtual machine, so a nested VMware or VirtualBox installation is outside what Microsoft supports.  `[41]` `C:high` `V:durable`
- **Claim.** The nested SVM mechanism itself — vmcb12/vmcb02 construction, intercept merging, nested nested-paging — is owned by `15-nested-virtualization.md`; this chapter carries only the Windows-side switch and its prerequisites.  `[460]` `C:high` `V:durable`

The AMD-side checklist, in the order that produces the fewest wasted attempts:

1. **Host OS.** Windows Server 2022 or later, or Windows 11 or later. An AMD host on Windows Server 2019 or Windows 10 cannot do this at all, however new the processor is — the Intel prerequisite set, which does allow those, does not apply.
2. **VM configuration version 9.3 or higher.** A virtual machine carried forward from an older host keeps the configuration version it was created with, so this gate fails on machines whose host and processor are both new enough; the version is a per-VM property and has to be raised explicitly.
3. **VM powered off**, then `Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true`.
4. **MAC address spoofing** on the VM's network adapter if the innermost guests need network access through the same adapter, or NAT inside the level-1 VM — this is the same on both vendors.

- **Claim.** Steps 1 and 2 are the two gates that differ from the Intel case, and both are properties of the host and the VM rather than of the silicon — which is why "my Ryzen 7000 should support this" is never the operative question.  `[460]` `C:high` `V:durable`
- **Claim.** Microsoft documents the networking step for nested configurations as either enabling MAC address spoofing on the level-1 VM's adapter — `Get-VMNetworkAdapter -VMName <VMName> | Set-VMNetworkAdapter -MacAddressSpoofing On` — or using NAT inside the level-1 VM.  `[460]` `C:high` `V:durable`

### 16.5.1 AMD has no enlightened VMCS — but Hyper-V does have AMD enlightenments

This distinction is worth stating precisely, because both halves of it are easy to get wrong.

- **Claim.** The enlightened VMCS is an Intel-only construct. The TLFS introduces it with "On Intel platforms, virtualization software uses virtual machine control data structures (VMCSs) to configure processor behavior related to virtualization", and its purpose is to let a nested hypervisor edit a VMCS-shaped structure in ordinary guest memory instead of issuing the privileged VMCS access instructions. AMD has no equivalent because the VMCB is already ordinary memory that software reads and writes directly — the problem the enlightened VMCS solves does not exist on SVM.  `[464]` `C:high` `V:durable`
- **Claim.** It does **not** follow that Hyper-V has no AMD-side enlightenment. The TLFS states that "AMD has reserved space in the VMCB for hypervisor use, as well as an associated clean bit. The reserved bytes are in the control section, offset 0x3E0-3FF, of the VMCB" and "The clean bit is bit 31"; Hyper-V "utilizes the reserved VMCB area to configure enlightenments", through a structure named `HV_SVM_ENLIGHTENED_VMCB_FIELDS`. Those offsets and that clean bit are owned by `02-vmcb.md`, which records them as "Reserved for Host usage" and as the host-reserved clean bit.  `[464]` `C:high` `V:durable`
- **Claim.** The hypervisor must invalidate that clean bit whenever it modifies the enlightenments area, which is the same discipline `02-vmcb.md` states for host-reserved state generally.  `[464]` `C:high` `V:durable`
- **Claim.** One named AMD enlightenment is a TLB opt-in, and it works the opposite way round from the obvious reading: the specification defines `EnlightenedNptTlb` as "ASID flushes do not affect TLB entries derived from the NPT — hypercalls must be used to invalidate NPT TLB entries". Setting it to 1 therefore *removes* NPT-derived entries from the scope of an ASID flush rather than relying on it, so a nested hypervisor that sets the bit and keeps flushing by ASID alone will leave stale nested translations. The ASID machinery is owned by `06-nested-paging.md`.  `[464]` `C:high` `V:durable`
- **Claim.** So the correct summary is: **no eVMCS on AMD, but an enlightened VMCB field block that Intel has no counterpart for.** Treating "AMD has nothing here" as the whole answer misses a real interface.  `[464]` `C:high` `V:durable`

---

## 16.6 Third-party VMMs and the Windows Hypervisor Platform

- **Claim.** The Windows Hypervisor Platform "adds an extended user-mode API for third-party virtualization stacks and applications to create and manage partitions at the hypervisor level", configure memory mappings for a partition, and create and control virtual processors; the API is a set of C-style functions returning `HRESULT`, exported from `WinHvPlatform.dll`, with entry points such as `WHvCreatePartition`, `WHvSetupPartition`, `WHvMapGpaRange` and `WHvRunVirtualProcessor`.  `[100]` `C:high` `V:durable`
- **Claim.** The practical consequence on an AMD PC is a role change rather than a feature loss: a third-party VMM running over WHP is no longer the software that executes VMRUN. It is a user-mode process whose guest is a partition created and scheduled by Hyper-V, and its guest is therefore already nested — every cost in `15-nested-virtualization.md` applies to it.  `[100]` `C:high` `V:durable`
- **Claim.** Coexistence with VBS is the documented, current answer, and it replaces the older "turn Hyper-V off first" advice recorded in `errata.md` `E15`: VMware Workstation Pro supports the WHP path from **15.5.5** — Broadcom calls it "Host VBS Mode" — and VirtualBox gained it in **6.0**, whose release notes read "Added support for using Hyper-V as the fallback execution core on Windows host, to avoid inability to run VMs at the price of reduced performance".  `[47][478]` `C:high` `V:durable`
- **Claim.** The limits on that path are documented rather than incidental: slower virtual machines, **no nested virtualization inside the WHP-backed guest**, no performance counters, no RTM/HLE and no PKU, and VirtualBox has continued to label the path experimental.  `[47][48]` `C:high` `V:durable`
- **Claim.** How much slower is a performance question and belongs to `18-performance.md`; the WHP API surface in full, and the double-exit structure that produces the cost, are vendor-neutral and belong to `intel-vt/17-windows-platform.md`.  `[100]` `C:medium` `V:durable`

### 16.6.1 Utility VMs are the same mechanism wearing different names

- **Claim.** WSL 2 "uses the latest and greatest in virtualization technology to run a Linux kernel inside of a lightweight utility virtual machine (VM)" and is "running as a Hyper-V virtual machine", so enabling it has exactly the same effect on SVM ownership as enabling the Hyper-V role.  `[473]` `C:high` `V:durable`
- **Claim.** Windows Sandbox "relies on the Microsoft hypervisor to run a separate kernel that isolates Windows Sandbox from the host" and uses "hardware-based virtualization for kernel isolation".  `[471]` `C:high` `V:durable`
- **Claim.** Docker Desktop's default Windows backend is WSL 2 — "If you have installed Docker Desktop on a system that supports WSL 2, this option is turned on by default and the setting is not visible" — with a Hyper-V mode available as the alternative; either way the hypervisor is launched.  `[477]` `C:high` `V:durable`
- **Claim.** From the processor's point of view these are indistinguishable, which is why enabling any one of them changes the behaviour of all the others and of any third-party VMM on the machine.  `[101][473]` `C:high` `V:durable`

### 16.6.2 The three coexistence options, and how to choose

| Option | What it means on AMD | What it costs |
|---|---|---|
| Run over WHP | The VMM becomes a user-mode client of Hyper-V; its guest is a Hyper-V partition and is already nested | the limits in §16.6 — no nesting inside the guest, no PMCs, no RTM/HLE, no PKU; speed per `18-performance.md` |
| Run nested under Hyper-V | The VMM runs inside a Hyper-V VM with `-ExposeVirtualizationExtensions $true` (§16.5) | Microsoft does not support non-Hyper-V virtualization applications inside a Hyper-V VM, so this is a development arrangement rather than a supported one |
| Turn the hypervisor off | `bcdedit /set hypervisorlaunchtype off`, then reboot; the VMM executes VMRUN itself | every Hyper-V-backed feature stops: VBS, memory integrity, Credential Guard, WSL 2, Windows Sandbox, Docker Desktop's Windows backends |

- **Claim.** The third option was the standard advice before the WHP path existed and is now usually the wrong first move; `errata.md` `E15` records the older framing as superseded, and the reason is simply that it trades the machine's security posture for a compatibility problem the first option already solves.  `[47][101][474]` `C:high` `V:durable`
- **Claim.** A fourth option that does *not* exist on AMD is "share the extensions": the architecture provides no way for two pieces of software to hold SVM host mode on one logical processor at the same time, which is why every one of the three rows above is a form of giving up direct ownership or taking it entirely.  `[101]` `C:high` `V:durable`

---

## 16.7 Firmware settings on AM4 and AM5

Firmware setup menus are vendor user interfaces, not specifications. What follows separates the
parts Microsoft or AMD actually document from the parts that are only convention.

- **Claim.** Documented: virtualization must be enabled in firmware for Hyper-V and for VBS — Microsoft lists "Virtualization support turned on in the BIOS or UEFI" as a Hyper-V requirement and "BIOS — Virtualization must be enabled" in the memory-integrity hardware table.  `[461][475]` `C:high` `V:durable`
- **Claim.** Documented: the IOMMU must be enabled *by default* by firmware for Kernel DMA Protection, not merely enableable, and firmware must additionally publish the IVRS `IVinfo` DMA-remap indicator (§16.4).  `[462]` `C:high` `V:durable`
- **Claim.** Convention, not specification: on AGESA-derived AM4 and AM5 setup menus the SVM switch is usually labelled `SVM Mode` and sits under the CPU configuration branch, while the IOMMU switch sits under `AMD CBS → NBIO Common Options → IOMMU` with an `Auto` default that many boards resolve to disabled. No AMD or Microsoft document in this corpus specifies these labels or paths, and they vary between board vendors and AGESA versions — treat them as a place to look, not as a fact to quote.  `[no-spec]` `[7]` `C:low` `V:durable`
- **Claim.** The IOMMU's presence on a client AM4 or AM5 part does not depend on the chipset, because it is integrated in the SoC's I/O complex; that fact is owned by `08-iommu-architecture.md` and is why "my chipset is a B650, do I have an IOMMU" is the wrong question.  `[7]` `C:medium` `V:durable`
- **Claim.** `Above 4G Decoding` and Resizable BAR are firmware settings that sit near the IOMMU switch and are frequently changed at the same time. This corpus has **no first-party source** for any interaction between them and SVM, AMD-Vi or the Windows features in this chapter beyond the ordinary one that a device with a large BAR needs address space the guest can be given; see §16.12.  `[no-spec]` `[7]` `C:low` `V:durable`

---

## 16.8 Device assignment: DDA and GPU partitioning

### 16.8.1 Discrete Device Assignment is server scope

- **Claim.** Microsoft documents Discrete Device Assignment for a host "running Windows Server 2016 or later" and requires "server class hardware that's capable of granting the operating system control over configuring the PCIe fabric (Native PCI Express Control)". It is not documented as a client-Windows capability, and a desktop AM5 board does not meet the platform requirement.  `[467][468]` `C:high` `V:durable`
- **Claim.** The second hardware requirement is the isolation one: the PCIe root complex must "support Access Control Services (ACS), which enables Hyper-V to force all PCIe traffic through the Input-Output Memory Management Unit", and Microsoft notes these capabilities "may be hidden in BIOS settings, sometimes behind SR-IOV configuration options".  `[467]` `C:high` `V:durable`
- **Claim.** Microsoft ships a survey script, `SurveyDDA.ps1`, that identifies compatible hardware and reports the MMIO space a device needs — the practical Windows counterpart to a Linux user's inspection of kernel isolation groups.  `[467]` `C:high` `V:durable`
- **Claim.** The assignment sequence is: dismount the device from the host with `Dismount-VMHostAssignableDevice -Force -LocationPath $locationPath`, attach it with `Add-VMAssignableDevice -LocationPath $locationPath -VMName <VMName>`, then install the hardware vendor's driver inside the guest. The device is addressed by **PCI location path**, which is the Windows identifier — there is no Windows equivalent of a kernel isolation group.  `[468]` `C:high` `V:durable`
- **Claim.** Devices using legacy INTx PCI interrupts are not supported for DDA, and a vendor may supply a device mitigation driver for use in untrusted environments.  `[467]` `C:high` `V:durable`
- **Claim.** DDA is one GPU to one VM: "A DDA deployment can accelerate only a limited number of virtual machines, since each physical GPU can provide acceleration to at most one VM."  `[469]` `C:high` `V:durable`

### 16.8.2 What a client Windows PC actually gets

- **Claim.** GPU partitioning is the sharing mechanism: "Beginning with Windows Server 2025, GPU partitioning allows you to share a physical GPU device with multiple virtual machines (VMs)", giving each "a dedicated fraction of the GPU instead of the entire GPU" through the "Single Root IO Virtualization (SR-IOV) interface". The Hyper-V cmdlet is `Add-VMGpuPartitionAdapter`, which "Adds a GPU partition adapter to a virtual machine" and assigns a full partition from an assignable GPU when run without parameters.  `[469][476]` `C:high` `V:durable`
- **Claim.** The mechanism a client Windows PC reaches in everyday use is WDDM GPU paravirtualization, available "starting in Windows 10, version 1803 (WDDM 2.4)", whose documented consumers are Hyper-V virtual machines — client and server — Windows Sandbox, and Hyper-V isolated containers.  `[470]` `C:high` `V:durable`
- **Claim.** Windows Sandbox exposes it as a configuration element: `vGPU` takes `Enable`, `Disable` or `Default`, where `Default` "currently denotes that vGPU is enabled" and `Disable` falls back to software rendering; Microsoft warns that "Enabling virtualized GPU can potentially increase the attack surface of the sandbox".  `[472]` `C:high` `V:durable`
- **Claim.** WSL gets GPU acceleration on "Windows 11 or Windows 10, version 21H2 or higher" with the GPU vendor's ordinary Windows driver installed on the host — the guest does not take the device away from the host.  `[479]` `C:high` `V:durable`
- **Claim.** So the answer to "can I pass my Radeon through on Windows 11" is: not by DDA, which Microsoft documents only for Windows Server on server-class hardware; the supported client paths are the paravirtualized ones above, and they share the GPU rather than assigning it. Which product supports GPU partitioning in which release is a status question for `90-dated-landscape.md`.  `[467][469][470]` `C:medium` `V:durable`

---

## 16.9 Detecting a hypervisor

- **Claim.** The architectural indication is a CPUID bit: execute CPUID with EAX = 1 and examine "bit 31 of register ECX (the 'hypervisor present bit')" — "if this bit is set, a hypervisor is present". It is set by hypervisors and clear on a physical processor with nothing above it.  `[463]` `C:high` `V:durable`
- **Claim.** Leaf `0x40000000` returns a vendor identity: Hyper-V returns `EBX = 0x7263694D` ("Micr"), `ECX = 0x666F736F` ("osof"), `EDX = 0x76482074` ("t Hv") — the string **"Microsoft Hv"** — together with the maximum hypervisor CPUID leaf.  `[463]` `C:high` `V:durable`
- **Claim.** Leaf `0x40000001` returns the interface signature, `EAX = 0x31237648` ("Hv#1"), and Microsoft recommends that "software only base compatibility decisions on the interface signature reported through leaf 0x40000001" rather than on the vendor string.  `[463]` `C:high` `V:durable`
- **Claim.** On a stock Windows PC with any Hyper-V-backed feature enabled, this detection succeeds from inside the ordinary desktop session, because the desktop is itself in a partition. Software that treats "a hypervisor is present" as evidence of tampering — some anti-cheat and DRM implementations do — will therefore see it on an untampered machine, and the two causes (presence detection, and memory-integrity enforcement against drivers that generate code) are separate mechanisms with one symptom. A specific product's behaviour is a status question for `90-dated-landscape.md`.  `[463][101]` `C:medium` `V:durable`
- **Claim.** The leaf range `0x40000000`–`0x400000FF` is the hypervisor **CPUID** range and has nothing to do with the synthetic MSR block Hyper-V also defines; the synthetic MSR map is vendor-neutral and belongs to `intel-vt/17-windows-platform.md`.  `[45][463]` `C:medium` `V:durable`

---

## 16.10 Diagnosing from Windows

The pre-rebuild corpus diagnosed everything in this chapter with `dmesg`, `lspci`, `/sys` and
`cpuid`. None of those exist on the target platform. The Windows equivalents, all first-party:

| Question | Command | What to read |
|---|---|---|
| Does this machine meet the Hyper-V requirements? | `systeminfo.exe` | the "Hyper-V Requirements" section — every line must read `Yes` |
| Is VBS running, and with what? | `msinfo32.exe` → System Summary | "Virtualization-based Security Services Running" |
| Is Credential Guard among them? | `msinfo32.exe` → System Summary | `Credential Guard` listed next to that field |
| Same, scriptable | `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning` | a non-empty list of running services |
| Is Kernel DMA Protection on? | `msinfo32.exe` | the "Kernel DMA Protection" field reads `ON` |
| Is the hypervisor on the boot path? | `bcdedit /enum {current}` | `hypervisorlaunchtype` — `Auto` or `Off` |
| Which devices can be assigned? | `Get-VMHostAssignableDevice`, `SurveyDDA.ps1` | server hosts only, §16.8 |
| Is a hypervisor present at all, from inside? | CPUID leaf 1 ECX[31], leaf `0x40000000` | §16.9 |

- **Claim.** The `systeminfo` route is Microsoft's documented check: run `Systeminfo.exe` and "scroll to the Hyper-V requirements section to review the report", where the reported items are VM Monitor Mode extensions, virtualization enabled in firmware, second-level address translation and hardware-enforced DEP.  `[475]` `C:high` `V:durable`
- **Claim.** The VBS route is Microsoft's documented check too: in System Information, "confirm that **Credential Guard** is shown next to **Virtualization-based Security Services Running**", with the scriptable equivalent `(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).SecurityServicesRunning`. Microsoft explicitly says checking whether `LsaIso.exe` is running "isn't a recommended method".  `[465]` `C:high` `V:durable`
- **Claim.** `hypervisorlaunchtype` reading `Auto` means the hypervisor is on the boot path; it does not by itself prove the hypervisor launched, because the silicon and firmware layers of §16.1.2 can still refuse. Reading `systeminfo` and `msinfo32` together separates those cases.  `[474][475]` `C:medium` `V:durable`
- **Claim.** A useful negative check: if `msinfo32` reports virtualization-based security running, no amount of work on the `VM_CR` and `EFER` chain in `01-svm-intro.md` will free SVM — the answer is §16.6, not a firmware setting.  `[101][465]` `C:high` `V:durable`

---

## 16.11 Linux-only: the VFIO path

Marked explicitly as a contrast section. None of this exists on Windows, and reaching for it is the
commonest way a Linux-trained reader misdiagnoses a Windows machine.

- **Claim.** On Linux the IOMMU is controlled by kernel command-line parameters — `amd_iommu=on`, `iommu=pt` — and its topology is exposed through `/sys/kernel/iommu_groups`; device assignment goes through the `vfio-pci` driver. Windows exposes none of these: the IOMMU is configured by firmware and by the hypervisor, and there is no user-visible sysfs equivalent.  `[57]` `C:high` `V:durable`
- **Claim.** "IOMMU group" is a Linux/VFIO kernel construct and not an AMD architectural concept; the fact and its AMD counterpart are owned by `10-iommu-interrupt-remapping.md`. The nearest Windows notion is the combination of PCI location path plus the ACS survey that `SurveyDDA.ps1` performs (§16.8).  `[57][467]` `C:high` `V:durable`
- **Claim.** GPU reset quirks handled on Linux by out-of-tree work such as `vendor-reset` have no Windows analogue, because a Windows host never hands a client GPU to a guest in the first place (§16.8.2) — which removes the failure mode rather than solving it.  `[no-spec]` `[57]` `C:low` `V:durable`

---

## 16.12 Open items

- **`hvboot.sys`.** The pre-rebuild corpus placed an `hvboot.sys` stage between `hvloader.dll` and the hypervisor image. No first-party source in this corpus documents it for a current Windows release, and *Windows Internals* describes the loader as `Hvloader.dll`. The stage is recorded here as unverified rather than repeated; anyone with the relevant *Windows Internals* chapter to hand should settle it.
- **`Above 4G Decoding` and Resizable BAR.** Frequently cited alongside the IOMMU setting, with no first-party source for any interaction with SVM, AMD-Vi, VBS or Hyper-V. §16.7 records the absence rather than inventing a rule.
- **Firmware setup labels.** `SVM Mode` and the `AMD CBS → NBIO Common Options → IOMMU` path are board-vendor conventions. AMD publishes no client Ryzen programming reference and no client revision guide (`01-svm-intro.md`), so there is no first-party document to anchor them to; §16.7 marks them `[no-spec]` and `C:low` deliberately.
- **GPU partitioning on client Windows.** Microsoft documents GPU partitioning for Windows Server 2025 and documents WDDM GPU paravirtualization for client Hyper-V, Windows Sandbox and isolated containers, but this corpus found no single Learn page stating the client Hyper-V GPU-partitioning story end to end. §16.8.2 states only what is sourced.
- **Hyper-V and SEV.** `errata.md` `E14` records that "Hyper-V does not support AMD SEV" is false as an unconditional statement — Azure's Hyper-V hosts run SEV-SNP confidential VMs with a paravisor — while client and server Hyper-V do not expose SEV to guests. The mechanism belongs to `12-sev.md` and `14-sev-snp.md`; the current cloud status belongs to `90-dated-landscape.md`. This chapter does not restate either.
- **Cross-skill dependency.** Everything this chapter defers to `intel-vt/17-windows-platform.md` is *depth*, never an answer: partition model, hypercall ABI, synthetic MSR table, SynIC, VMBus rings, scheduler types, the full enlightenment list, the complete WHP API surface, the page-level HVCI mechanism, and the KVM/Xen/ESXi contrast. If that skill is not installed, this chapter still answers every Windows question in the evaluation set — that is the design criterion, and it should be re-tested whenever this file changes.
