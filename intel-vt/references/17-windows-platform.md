# 17. The Windows Platform: Hyper-V, VBS, and Who Owns VMX Root Operation

> **中文速览**：本章讲 Windows PC 上 VT-x 到底被谁用、怎么用。核心事实只有一条：**一旦 VBS 或任何依赖 Hyper-V 的功能被启用，Windows 内核自己就作为 VTL0 的 guest 跑在 Windows hypervisor 之下，VMX root operation 属于 Hyper-V**——"为什么我的虚拟机/驱动/调试器用不了 VT-x"几乎总是归结到这一条。依次覆盖：Hyper-V 的分区模型、hypercall ABI、VMBus 环形缓冲、VP assist page、合成 MSR、VTL0/VTL1；WHP/WHPX 与第三方 VMM（VirtualBox / VMware Workstation / QEMU / Android 模拟器）如何改走 Hyper-V；WSL2、Windows Sandbox、Docker Desktop、Application Guard 这些"工具 VM"；Windows 对 VT-d 的使用（Kernel DMA Protection）；hypervisor 存在性检测与反作弊/HVCI 的交互。最后一节把 KVM/QEMU/Xen/ESXi 作为对照压缩呈现。**版本级产品状态（哪个 Windows 版本默认开什么、哪个产品哪版支持 WHPX）一律在 `90-dated-landscape.md`。**

**Maps to:** Microsoft official documentation — the Hypervisor Top-Level Functional Specification and Microsoft Learn — plus kernel.org for the contrast section. Intel anchors appear wherever a VMX or VT-d mechanism is named.
**Owns:** the Windows-side mapping from VT features to implementations (Hyper-V interfaces, WHP, utility VMs, Windows' use of VT-d), and the contrast with non-Windows hypervisors.
**See also:** `02-vmcs.md` and `05-vm-exit.md` (the structures these implementations program) · `06-address-translation.md` (EPT, which VTL isolation is built from) · `12-vtd-faults-bios-siov.md` (VT-d, which Kernel DMA Protection is built from) · `14-nested-virtualization.md` · `15-security.md` (owns the Windows security features themselves) · `16-performance.md` (what these cost) · `90-dated-landscape.md` (versions, defaults, product status).

---

## 17.1 The fact that explains most Windows VT questions

- **Claim.** VMX root operation has exactly one owner per logical processor: the software that executed VMXON. The architecture provides no way to share it, so a second hypervisor must either be given the hardware or be given an interface onto whoever holds it.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** When the Windows hypervisor is running, it is that owner. Microsoft does not use Intel's vocabulary for this — "VMX root operation" appears in none of the Microsoft documents cited in this chapter — but every element of the consequence is documented: "only one software component at a time can use this hardware"; the hypervisor "has exclusive control of key system hardware resources such as memory access permission controls in the CPU MMU and IOMMU early in system initialization"; "the root partition is itself a VM partition, although it has unique properties and greater privileges than guest VMs"; and "when a partition starts or resets, it begins running in VTL0". The Windows installation the user interacts with is that root partition: a partition above the hypervisor, in VTL0.  `[315][463][485]` `C:high` `V:durable`
- **Claim.** Virtualization-based security is a Hyper-V-backed feature, so enabling it starts the hypervisor even when the user never creates a virtual machine — Microsoft's own troubleshooting article states that "third-party virtualization applications … can't run alongside Hyper-V, Memory Integrity, or Credential Guard" and names those security technologies as depending on Hyper-V; the same is true of every utility-VM feature in §17.4; see `15-security.md`, which owns the security features themselves.  `[315][476]` `C:high` `V:durable`
- **Claim.** Therefore any question of the form "why can't my hypervisor, driver or debugger use VT-x on this machine" resolves to the same answer: Hyper-V already holds the extensions, and the requesting software must go through the Windows Hypervisor Platform (§17.3), run as a nested guest (§17.7) — for which Microsoft supports Hyper-V inside Hyper-V but states that other virtualization applications "aren't supported in Hyper-V virtual machines, and are likely to fail" — or require that the hypervisor be turned off.  `[465][479]` `C:high` `V:durable`

### 17.1.1 How to tell, from inside

- **Claim.** A guest can detect that it is running under a hypervisor through CPUID: the TLFS directs software to execute CPUID with EAX=1 and check bit 31 of ECX, "the hypervisor present bit" — "in a non-virtualized environment, the bit will be clear" — and the leaf at 0x40000000 returns the maximum hypervisor CPUID leaf number and a vendor identity signature, "Microsoft Hv" for Hyper-V.  `[461]` `C:high` `V:durable`
- **Claim.** Microsoft's specification guarantees two leaves, 0x40000000 and 0x40000001: the vendor identity leaf followed by an interface-signature leaf, which returns "Hv#1" and thereby "determines the semantics of the leaves from 0x40000002 through 0x400000FF".  `[461]` `C:high` `V:durable`
- **Claim.** On a Windows PC with any Hyper-V-backed feature enabled, that detection succeeds inside the ordinary desktop session, because the desktop is itself in a partition; software that treats "a hypervisor is present" as evidence of tampering will therefore see it on a stock machine.  `[461][462]` `C:high` `V:durable`

### 17.1.2 The enablement chain

"Is the hypervisor running" is decided at four independent layers, and a question about VT
availability on a Windows machine is usually a question about which layer said no.

1. **Silicon.** The processor must support VMX, and second-level address translation, for the
   platform to be usable at all.
2. **Firmware.** Virtualization must be enabled in firmware setup; VT-d must be enabled
   separately for the DMA protection of §17.5, and firmware must also describe its remapping
   hardware to the operating system.
3. **Platform feature.** The Windows virtualization platform must be installed and enabled;
   this is what puts the hypervisor on the boot path.
4. **Consumer.** Something must actually want it — the Hyper-V role, virtualization-based
   security, or one of the utility VMs of §17.4 — and the hypervisor's launch policy decides
   whether it starts.

- **Claim.** These are stated prerequisites of the Windows virtualization platform rather than optional accelerations: Microsoft requires a 64-bit processor with second-level address translation and "CPU support for VM Monitor Mode Extension", which that page glosses as "VT-c on Intel CPUs" although VT-c is Intel's I/O-connectivity branding and the extension actually meant is VT-x; the firmware half appears separately in Microsoft's memory-integrity requirements as a virtualization-enabled BIOS.  `[379][480]` `C:high` `V:durable`
- **Claim.** Layers 3 and 4 are separable: a machine can have the platform present and the hypervisor not running, or the hypervisor running for a security feature with no virtual machine defined, which is why "Hyper-V is not installed" is not evidence that VMX is free.  `[476][480]` `C:high` `V:durable`

---

## 17.2 Hyper-V

### 17.2.1 Partitions

- **Claim.** Hyper-V is a type-1 hypervisor in the structural sense: Microsoft describes it as "a layer of software that sits between the hardware and one or more operating systems", and everything else — including the Windows installation that manages it — runs in a partition.  `[462]` `C:high` `V:durable`
- **Claim.** The root partition is privileged: it is "the only partition that has direct access to physical memory and devices", it manages "machine-level functions such as device drivers, power management, and device hot addition/removal", it hosts the virtualization management stack, and it "creates child partitions using the hypercall application programming interface (API)".  `[462]` `C:high` `V:durable`
- **Claim.** A child partition has no direct access to physical devices: "child partitions don't have direct access to other hardware resources and are presented a virtual view of the resources, as virtual devices (VDevs)", and all of its access to physical memory and devices is "provided via the Virtual Machine Bus (VMBus) or the hypervisor". The TLFS names the three address spaces — guest virtual, guest physical and system physical — and the guest-physical-to-system-physical stage is what EPT performs.  `[SDM 3C Ch.31]` `[1][461][462]` `C:high` `V:durable`
- **Claim.** Second-level address translation — EPT on Intel — is a hard requirement for current Hyper-V rather than an optimisation, which is why processor support for it, together with VT-x and firmware enablement, is stated as a prerequisite for the feature.  `[SDM 3C Ch.31]` `[1][480]` `C:high` `V:durable`
- **Claim.** Device access from a child partition normally runs as a virtualization service client in the child talking to a virtualization service provider in the root partition over VMBus, so a synthetic device transfer traps on a signal rather than on every device-register access.  `[462][464]` `C:high` `V:durable`

### 17.2.2 The hypercall ABI

- **Claim.** A guest first identifies itself by writing its guest OS identity to the synthetic MSR at 0x40000000; until that MSR holds a non-zero identity, the hypercall interface cannot be enabled.  `[461]` `C:high` `V:durable`
- **Claim.** The guest then writes the hypercall MSR at 0x40000001 with a guest-physical page number and an enable bit, and the hypervisor overlays a hypercall page at that address containing the correct call instruction for the underlying processor, so guest code issues hypercalls without knowing whether it is on Intel or AMD silicon.  `[461]` `C:high` `V:durable`
- **Claim.** In the 64-bit convention the hypercall input value — call code, fast flag and repetition count — is passed in RCX, the guest-physical address of the input parameter block in RDX and that of the output block in R8, with the result returned in RAX; fast hypercalls pass their arguments in registers instead of memory.  `[461]` `C:medium` `V:durable`
- **Claim.** The TLFS deliberately refuses to name the instruction — "because this opcode differs among virtualization implementations, it is necessary for the hypervisor to abstract this difference. This is done through a special hypercall page" — and the guest only issues a CALL to the start of that page; on Intel parts the architectural instruction for calling the VMM is VMCALL, which is why the same guest binary works on both vendors.  `[SDM 3C Ch.33]` `[1][461]` `C:medium` `V:durable`

### 17.2.3 The VP assist page and the enlightened VMCS

- **Claim.** Each virtual processor may enable a VP assist page by writing its guest-physical address to the synthetic MSR at 0x40000073; the hypervisor overlays a per-processor structure there carrying assistance fields such as end-of-interrupt assist and virtualization-fault information.  `[461]` `C:high` `V:durable`
- **Claim.** The VP assist page does not *hold* the enlightened VMCS; it holds the controls that select one. The TLFS says the L1 hypervisor "may choose to use enlightened VMCSs by writing 1 to the corresponding field in the Virtual Processor Assist Page" (`EnlightenVmEntry`) and that "another field in the VP assist page controls the currently active enlightened VMCS" (`CurrentNestedVmcs`, a GPA); each enlightened VMCS is a separate 4-KB page in guest memory, so "there is no need for the L1 hypervisor to execute VMREAD or VMWRITE or VMPTRLD instructions", and its clean fields control which parts are reloaded on a nested VM entry.  `[461]` `C:high` `V:durable`
- **Claim.** The enlightened VMCS addresses the same cost that VMCS shadowing addresses in hardware — the price of the inner hypervisor's field accesses — by a software contract instead; see `14-nested-virtualization.md`.  `[SDM 3C §27.6.15]` `[1][461]` `C:medium` `V:durable`

### 17.2.4 The synthetic interrupt controller

- **Claim.** The synthetic interrupt controller is configured through a block of synthetic MSRs: control at 0x40000080, version at 0x40000081, the event-flags page at 0x40000082, the message page at 0x40000083, end-of-message at 0x40000084, and sixteen synthetic interrupt source registers at 0x40000090 through 0x4000009F.  `[461]` `C:medium` `V:durable`
- **Claim.** Synthetic timers are programmed through their own MSR pairs beginning at 0x400000B0, and a reference TSC page enabled through the MSR at 0x40000021 lets a guest read time without trapping.  `[461]` `C:medium` `V:durable`
- **Claim.** The message page and the event-flags page are the delivery mechanism for VMBus: a channel signals its peer by setting an event flag and, where a message is required, posting it so that one of the synthetic interrupt sources is raised.  `[461][464]` `C:high` `V:durable`

### 17.2.5 The synthetic MSR map

Every MSR below appears in a claim in this section; the table collects them because the interface is otherwise spread across several pages of specification.

| MSR | Role |
|---|---|
| 0x40000000 | guest OS identity; prerequisite for enabling the hypercall page |
| 0x40000001 | hypercall page: guest-physical page number plus enable bit |
| 0x40000002 | virtual processor index of the current processor |
| 0x40000021 | reference TSC page, for trap-free timekeeping |
| 0x40000073 | VP assist page: EOI assist, VTL control, and the `EnlightenVmEntry` / `CurrentNestedVmcs` controls that select an enlightened VMCS (§17.2.3) |
| 0x40000080 – 0x40000084 | synthetic interrupt controller: control, version, event-flags page, message page, end of message |
| 0x40000090 – 0x4000009F | sixteen synthetic interrupt source registers |
| 0x400000B0 and following | synthetic timer configuration and count registers |

- **Claim.** The virtual processor index MSR at 0x40000002 gives the guest the hypervisor's own numbering for the current processor: "a virtual processor is identified by a tuple composed of its partition ID and its processor index", and the flush, IPI and nested-virtualization hypercalls target processors by that index. The TLFS does not present it as an alternative to the APIC ID, which remains the identifier for interrupt delivery.  `[461]` `C:medium` `V:durable`
- **Claim.** The bound 0x40000000–0x400000FF is a **CPUID leaf** range, not an MSR range: the interface-signature leaf "determines the semantics of the leaves from 0x40000002 through 0x400000FF", while the TLFS defines synthetic MSRs above that bound — the STIME_UNHALTED timer MSRs at 0x40000114 and 0x40000115 and the nested-virtualization block from 0x40001000. What is true of the synthetic MSRs is only that they sit far above every architectural MSR address Intel defines, the highest of which is below 0x11000, so a collision cannot arise.  `[SDM 4 Ch.2]` `[5][461]` `C:high` `V:durable`

### 17.2.6 VMBus ring buffers

- **Claim.** A VMBus channel is a pair of unidirectional ring buffers in guest memory, one per direction, described to the hypervisor by a list of guest physical pages; the two ends exchange packets by writing the ring and signalling the peer.  `[464]` `C:high` `V:durable`
- **Claim.** Because the rings are ordinary guest memory and signalling goes through the synthetic interrupt controller, the exit cost of a synthetic device transfer is the signal, not the data movement — the same design point that virtio reaches by a different route.  `[464][471]` `C:high` `V:durable`
- **Claim.** Channels are offered by the host and accepted by the guest — "Hyper-V sends an offer message to the guest for each synthetic device that the VM is configured to have" — and binding is by device type: "each VMBus device type has a fixed GUID known as the 'class ID'", and on receipt the guest "identifies the device type based on the class ID, and invokes the correct driver". That is why a Windows or Linux guest needs only the VMBus bus driver plus per-class clients rather than emulated hardware drivers.  `[464][484]` `C:high` `V:durable`

### 17.2.7 Virtual Trust Levels

- **Claim.** A virtual processor can run at one of several Virtual Trust Levels, higher levels being more privileged, each with its own memory access protections, its own interrupt state and its own private register state, with explicit hypercalls to call into and return from a higher level.  `[463]` `C:high` `V:durable`
- **Claim.** The architecture defines up to 16 VTLs and a hypervisor may implement fewer; the Windows mapping is documented separately from the TLFS — "the code running in the traditional model executes in VTL0 and it cannot access the higher privileged VTL1, where the Secure Kernel and Isolated User Mode (IUM) execute code".  `[381][463]` `C:high` `V:durable`
- **Claim.** VTL separation is enforced with second-level address translation: each VTL "maintains a set of guest physical memory access protections" that the hypervisor manages and that software in the partition cannot modify, and Microsoft states the isolation is "created by the Hyper-V Hypervisor which assigns memory at boot time using Second Level Address Translation (SLAT)" — so VTL0 code cannot read or write VTL1 memory even though both run in the same partition; see `06-address-translation.md` for the hardware and `15-security.md` for the Windows features built on it.  `[SDM 3C Ch.31]` `[1][381][463]` `C:high` `V:durable`
- **Claim.** This is why a Windows PC can be a hypervisor host without hosting any virtual machine in the ordinary sense: the isolation boundary the feature needs is a VTL boundary inside one partition, not a second partition.  `[463][476]` `C:high` `V:durable`

### 17.2.8 Who schedules a virtual processor

- **Claim.** Hyper-V offers more than one hypervisor scheduler: a classic scheduler that treats virtual processors as independently schedulable, a core scheduler that constrains the virtual processors of one partition to run together on the threads of a physical core, and a root scheduler in which the root partition's own operating-system scheduler makes the decisions.  `[485]` `C:medium` `V:durable`
- **Claim.** Microsoft's stated reason for the core scheduler is isolation, not throughput: it "creates a strong security boundary for guest workload isolation", because "guest virtual processors can only run on underlying physical core pairs, reducing vulnerability to side-channel snooping attacks"; the cost of the equivalent restriction has been measured on another vendor's product and is quoted in `16-performance.md` §16.9.2.  `[485][412]` `C:high` `V:durable`
- **Claim.** The root scheduler is the option intended for client systems, and Microsoft calls it "the only supported hypervisor scheduler configuration for client systems": under it "the hypervisor gives the root partition control of work scheduling", and the NT scheduler "manages all aspects of assigning work to system logical processors". Its stated reasons are the utility-partition and workload-isolation requirements of Application Guard and of virtualization-based security, and the need to "properly operate future systems with heterogenous core architectures" — not, as this chapter previously said, foreground-work tracking or power policy, neither of which Microsoft mentions.  `[485]` `C:high` `V:durable`
- **Claim.** This is a genuine architectural difference from the other hypervisors in §17.8, where scheduling belongs to the hypervisor or to a host kernel that is not itself a guest.  `[485][450]` `C:medium` `V:durable`

### 17.2.9 Enlightenments: how a guest avoids exits

An enlightened guest replaces operations that would trap with operations the hypervisor
provides directly. Each one exists because the trapping version was measurably expensive.

- **Claim.** The reference TSC page lets a guest compute the current time from a hypervisor-maintained scale and offset in shared memory instead of trapping, which removes a very high-frequency exit source from timekeeping code.  `[461]` `C:high` `V:durable`
- **Claim.** The end-of-interrupt assist field in the VP assist page lets a guest signal completion of an interrupt by writing memory instead of writing the local APIC, removing an exit per interrupt where hardware APIC virtualization is not in use; see `07-apic-virtualization.md` for the hardware alternative.  `[461]` `C:medium` `V:durable`
- **Claim.** The hypervisor exposes hypercalls for address-space and virtual-address flushing, so a guest can flush other virtual processors' translations in one call rather than by sending inter-processor interrupts that each trap.  `[461]` `C:medium` `V:durable`
- **Claim.** A guest can likewise send an inter-processor interrupt through a hypercall rather than through the local APIC, and can notify the hypervisor that a virtual processor is spinning on a lock so that the hypervisor may schedule the lock holder instead.  `[461]` `C:medium` `V:durable`
- **Claim.** Enlightenments and hardware acceleration attack the same cost from two sides: the hardware features of chapters 06 and 07 remove the exit, while an enlightenment replaces the operation that would have caused it — which is why a guest can benefit from both, and why measuring one with the other disabled gives a different answer.  `[461][420]` `C:medium` `V:durable`

---

## 17.3 The Windows Hypervisor Platform (WHP / WHPX)

### 17.3.1 Why it exists

- **Claim.** Microsoft's own statement of the problem carries no VMX vocabulary — "many virtualization applications depend on hardware virtualization extensions… However, only one software component at a time can use this hardware. Virtualization applications can't share the hardware" — and the VMXON step is the Intel-side reading of it (§17.1). Microsoft's answer is the Windows Hypervisor Platform, "an extended user-mode API for third-party virtualization stacks and applications to create and manage partitions at the hypervisor level, configure memory mappings for the partition, and create and control execution of virtual processors".  `[315][465]` `C:high` `V:durable`
- **Claim.** The practical consequence is that on a Windows PC with any Hyper-V-backed feature enabled, a third-party VMM is no longer a hypervisor: it is a user-mode process whose guest is a partition created and scheduled by Hyper-V.  `[465]` `C:high` `V:durable`

### 17.3.2 The API surface

- **Claim.** The API mirrors the object model of other VMM interfaces without using file descriptors, and Microsoft documents the order explicitly: capabilities are queried with `WHvGetCapability`, `WHvCreatePartition` "only creates the partition object and does not yet create the actual partition in the hypervisor", properties such as the processor count are then set with `WHvSetPartitionProperty`, `WHvSetupPartition` creates the hypervisor partition, and only after that are host memory ranges mapped into guest physical ranges with `WHvMapGpaRange` and virtual processors created with `WHvCreateVirtualProcessor`; `WHvRunVirtualProcessor` returns an exit context.  `[465]` `C:high` `V:durable`
- **Claim.** Exit contexts classify the exit in API terms, not in hardware terms: the reasons the API defines are none, memory access, x64 I/O port access, unrecoverable exception, invalid VP register value, unsupported feature, x64 interrupt window, x64 halt, x64 APIC EOI, x64 MSR access, x64 CPUID, exception, x64 RDTSC and cancelled — an abstraction over the hardware exit reason rather than the hardware exit reason itself, and several of them are available only if enabled through a partition property. The hardware encodings are owned by `05-vm-exit.md`.  `[SDM 3D App.C]` `[2][465]` `C:high` `V:durable`
- **Claim.** Register access is by name through `WHvGetVirtualProcessorRegisters` and `WHvSetVirtualProcessorRegisters`, which reach "both the state defined by the underlying architecture (such as general-purpose registers) and additional state defined by the hypervisor"; no WHP page mentions a VMCS at all, so a feature that a VMM would implement by programming its own execution controls is available only if the API exposes an equivalent property.  `[465]` `C:high` `V:durable`

### 17.3.3 Who runs on it

- **Claim.** The consumers of this interface are the products that used to drive VMX directly on Windows. Only one of them is documented by its vendor in the sources cited here: Google states that "on Windows, we recommend using the Microsoft-supplied Windows Hypervisor Platform (WHPX)" and that the Android Emulator no longer uses the standalone Intel accelerator. QEMU implements it as an accelerator alongside its other backends, VirtualBox has a native-execution backend that uses it when the Windows hypervisor is present, and VMware Workstation gained a mode that runs on top of the Windows hypervisor; those three are product statements this chapter does not source, and their release-level detail belongs in `90-dated-landscape.md`.  `[465][482]` `C:medium` `V:durable`
- **Claim.** Which release of each product gained that support, and the retirement of the standalone Intel accelerator driver it replaced, are product-status facts; see `90-dated-landscape.md`.  `[482]` `C:medium` `V:durable`

### 17.3.4 What is given up

- **Claim.** A guest exit under this arrangement is handled twice: the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to the user-mode VMM — whereas a VMM owning VMX handles the exit in its own handler directly.  `[465]` `C:high` `V:durable`
- **Claim.** No public measurement of the resulting difference carrying processor, workload and configuration is recorded in this knowledge base; the mechanism above explains the direction, and `16-performance.md` §16.5 states the absence rather than supplying a figure.  `[465]` `C:high` `V:durable`
### 17.3.5 Debuggers, drivers and other software that wants the hardware

- **Claim.** The single-owner rule of §17.1 applies to every consumer of VMX, not only to virtual-machine products: a driver or analysis tool that wants to execute VMXON is in the same position as a third-party VMM and must go through the platform API or run nested.  `[SDM 3C Ch.26]` `[1][465]` `C:high` `V:durable`
- **Claim.** What that VMXON actually raises is decided by enumeration, not by the resident hypervisor choosing a fault. If VMX is not exposed to the partition, `CPUID.1:ECX.VMX` reads 0, `CR4.VMXE` cannot be set, and VMXON raises **#UD**; a VMXON attempted with CR4.VMXE clear raises **#UD** for the same reason, and CPL > 0 raises **#GP(0)**. See `01-vmx-intro.md` §1.8 and `08-vmx-instructions.md` §8.3.  `[SDM 3C Ch.33]` `[1]` `C:high` `V:durable`
- **Claim.** **Open item.** Whether Hyper-V ever intercepts VMXON and injects a fault of its own choosing, rather than letting enumeration produce #UD, is not documented in any Microsoft source this knowledge base has read. Diagnose from what the guest observes — `CPUID.1:ECX.VMX`, `CR4.VMXE` and `IA32_FEATURE_CONTROL` — rather than from the exception vector alone.  `[no-spec]` `[465]` `C:low` `V:durable`
- **Claim.** Software that instead relies on writable-executable kernel memory or on patching kernel code is blocked by a different mechanism — memory-integrity enforcement from VTL1 (§17.6) — so the two failure modes have different fixes and should not be diagnosed together.  `[483]` `C:high` `V:durable`
- **Claim.** Guest-visible processor facilities can also behave differently when a hypervisor is resident, because timers, performance-monitoring and some model-specific registers may be virtualized or intercepted; which ones is a property of the hypervisor's interception configuration rather than of the processor; see `03-nonroot-operation.md`.  `[SDM 3C §27.6]` `[1][461]` `C:medium` `V:durable`


### 17.3.6 The three coexistence options

| Option | What owns VMX root | What the third-party VMM gets | Cost |
|---|---|---|---|
| Platform API (§17.3) | Hyper-V | a partition it drives from user mode | an extra hop per exit; no direct control of execution controls |
| Run nested (§17.7) | Hyper-V | real virtualization extensions inside a child partition | the nested multiplication of `16-performance.md` §16.7 — and Microsoft states that virtualization applications other than Hyper-V are not supported inside a Hyper-V virtual machine |
| Disable the hypervisor | the third-party VMM | the hardware, directly | loses every Hyper-V-backed Windows feature at once, including the security ones |

- **Claim.** The third option is not a configuration change confined to one product: because virtualization-based security, WSL2, Sandbox, Application Guard and the container backends are each documented as running on the Microsoft hypervisor, turning the hypervisor off to give a VMM direct VMX access disables all of them together; see `15-security.md` for what is lost on the security side. Microsoft's own troubleshooting article now names only memory integrity and Credential Guard in its dependent-feature list, so that page alone does not establish the full set.  `[315][474][475][476][478]` `C:high` `V:durable`

---

## 17.4 Utility VMs: WSL2, Sandbox, Docker Desktop, Application Guard

These features are not "virtual machines" in the user's mental model, but they are partitions, and they all pull in the hypervisor.

### 17.4.1 WSL2

- **Claim.** WSL2 "uses the latest and greatest in virtualization technology to run a Linux kernel inside of a lightweight utility virtual machine", and "includes its own Linux kernel with full system call compatibility", in contrast to the earlier design, which "used a translation layer that was built by the WSL team".  `[474]` `C:high` `V:durable`
- **Claim.** That utility VM is a Hyper-V machine, so enabling WSL2 enables the platform: Microsoft states flatly that "WSL 2 is running as a Hyper-V virtual machine", and the optional component it needs, Virtual Machine Platform, is "a subset of Hyper-V architecture" that requires the machine's virtualization capabilities. The machine therefore becomes a hypervisor host, with the consequences for third-party VMMs described in §17.3.  `[474][480]` `C:high` `V:durable`
- **Claim.** File performance across the Windows and Linux file systems is documented as faster under the older design than under WSL2, which is why Microsoft tells users to keep project files in the file system that matches the tools using them. **Microsoft gives no mechanism for this**, and the synthetic-transport explanation — that a cross-boundary file operation traverses the channel of §17.2.6 rather than a native path — is this chapter's inference from the transport, not a documented attribution.  `[no-spec]` `[464][474]` `C:low` `V:durable`

### 17.4.2 Windows Sandbox

- **Claim.** Windows Sandbox is built on the same hardware-virtualization foundation: applications inside it "remain isolated from the host machine using hypervisor-based virtualization", it is "a disposable virtual machine (VM)", and it "relies on the Microsoft hypervisor to run a separate kernel that isolates Windows Sandbox from the host".  `[475]` `C:high` `V:durable`
- **Claim.** Its design goal is a container-like startup cost with VM-grade isolation: Microsoft claims "reboot persistence, quick launch times, and a lower memory footprint compared to full VMs", a launch of "a few seconds", and "smart memory management that optimizes memory footprint". The mechanism behind that — reusing the host's installed copy of Windows as a Dynamic Base Image, freely sharing immutable OS files, and mapping the same physical memory pages as the host by "direct map" — is documented on the separate Windows Sandbox architecture page, which this chapter's bibliography does not yet carry.  `[475]` `C:medium` `V:durable`

### 17.4.3 Docker Desktop

- **Claim.** Linux containers on Windows run on a Linux kernel, not on the Windows kernel: Docker documents that "Docker Desktop runs inside its own `docker-desktop` WSL distribution" and that "WSL 2 lets multiple Linux distributions run side-by-side on a single shared kernel", while Microsoft documents that that kernel runs as a Hyper-V virtual machine — so container isolation on a Windows PC is layered on top of a partition. Docker's own pages describe WSL2 as letting distributions run "without managing virtual machines" and reserve the phrase "Hyper-V mode" for the alternative backend, so the layering is Microsoft's framing, not Docker's.  `[474][481]` `C:high` `V:durable`
- **Claim.** The consequence for reasoning about overhead is that the container-versus-VM comparison from the server literature does not transfer: on Windows both costs are paid, because the container sits inside a VM; see `16-performance.md` §16.6.  `[481]` `C:medium` `V:durable`

### 17.4.4 Defender Application Guard

- **Claim.** Application Guard isolates untrusted content by opening the site "in an isolated Hyper-V-enabled container" that "is separate from the host operating system", rather than by sandboxing it inside the user session — which again requires the hypervisor to be running.  `[478]` `C:high` `V:durable`
- **Claim.** Its availability and lifecycle status are product facts and belong in `90-dated-landscape.md`; the mechanism — an isolated partition with a restricted device surface — is what belongs here.  `[478]` `C:medium` `V:durable`

### 17.4.5 The shared consequence

- **Claim.** Every feature in this section, plus virtualization-based security, plus the Hyper-V role itself, turns the machine into a hypervisor host — each is documented separately as running on the Microsoft hypervisor — and from the hardware's point of view they are indistinguishable, which is why enabling any one of them changes the behaviour of all the others.  `[474][475][476][478][480]` `C:high` `V:durable`

### 17.4.6 What a utility VM actually costs the host

- **Claim.** The resident cost of a utility VM is memory plus scheduling: its pages are backed by host memory while it runs, and its virtual processors are scheduled by whichever scheduler the platform is configured to use (§17.2.8).  `[474][485]` `C:medium` `V:durable`
- **Claim.** Its variable cost is concentrated at the boundary rather than inside the guest: guest compute runs in non-root operation at native speed, while every crossing — a file operation against the host filesystem, a network packet, a device interaction — traverses the synthetic transport of §17.2.6.  `[464][474]` `C:medium` `V:durable`
- **Claim.** This is why the useful question about a utility VM is how often the workload crosses the boundary rather than how fast the guest runs, and why `16-performance.md` §16.4 records a mechanism rather than a percentage.  `[474]` `C:medium` `V:durable`

---

## 17.5 Windows and VT-d: Kernel DMA Protection

- **Claim.** Kernel DMA Protection uses the platform IOMMU to constrain direct memory access from external, hot-pluggable peripherals, so that a device attached to an external port cannot read or write arbitrary system memory before the operating system has authorised it.  `[477]` `C:high` `V:durable`
- **Claim.** The hardware underneath is Intel VT-d: DMA remapping tables restrict each device to the memory its driver has mapped for it, which is the same facility a hypervisor uses to assign a device to a guest safely; see `10-vtd-dma-remapping.md` and `12-vtd-faults-bios-siov.md`.  `[VT-d 5.20 Ch.3]` `[8][477]` `C:high` `V:durable`
- **Claim.** The feature depends on firmware as well as silicon: "the BIOS reports the remapping hardware units in a platform to system software through the DMA Remapping Reporting (DMAR) ACPI table", and Microsoft states that Kernel DMA Protection "requires UEFI firmware support" and that enabling virtualization in firmware (the IOMMU) is required — which is why it is reported as a platform capability rather than merely a CPU one.  `[VT-d 5.20 Ch.8]` `[8][477]` `C:high` `V:durable`
- **Claim.** This is the clearest case on a client PC where VT-d is used with no virtual machine involved at all: the "guest" being constrained is a physical device, not a partition.  `[477]` `C:high` `V:durable`

### 17.5.1 What the PC does not get

- **Claim.** Assigning a whole physical device to a guest is a server-oriented capability rather than a client one, so on a PC the IOMMU's main role is the DMA protection above, not device assignment; the hardware is the same, the platform support is not. Microsoft states this directly — discrete device assignment and GPU partitioning "aren't supported on desktop-class hardware or client operating systems", and discrete device assignment "requires server class hardware that's capable of granting the operating system control over configuring the PCIe fabric" — but on troubleshooting and server-planning pages this chapter's bibliography does not yet carry; see `18-comparison-amd-arm-riscv.md` §18.11, which makes the same split.  `[477][480]` `C:medium` `V:durable`
- **Claim.** The comparison chapter marks which other features are server-platform-only, so that a Windows PC reader is not led to expect them; see `18-comparison-amd-arm-riscv.md` §18.11.  `[21]` `C:medium` `V:durable`

---

## 17.6 Hypervisor presence, HVCI and software that objects to both

- **Claim.** Memory integrity places the code-integrity decision in the secure kernel, which runs in VTL1, so the VTL0 kernel can execute only pages that have been validated there, and kernel pages cannot be both writable and executable; Microsoft's own wording is "a hypervisor-protected environment" rather than "VTL1", and the VTL1 placement follows from the Isolated User Mode documentation; see `15-security.md`, which owns the feature.  `[381][388][463][483]` `C:high` `V:durable`
- **Claim.** Kernel-mode software that allocates writable-executable memory, generates code at run time, or patches kernel code is therefore incompatible by construction rather than by policy — the constraint is enforced by a more privileged level using second-level address translation permissions.  `[483]` `C:high` `V:durable`
- **Claim.** Independently of that, protection software that assumes it is the most privileged component on the machine will observe a hypervisor through the CPUID indications in §17.1.1 and may treat its presence as untrusted, which is the architectural reason some titles behave differently on a machine with virtualization-based security enabled.  `[461]` `C:medium` `V:durable`
- **Claim.** These are two separate mechanisms with one symptom: one is code-integrity enforcement from VTL1, the other is presence detection; a question about a specific product's behaviour is a product-status question for `90-dated-landscape.md`.  `[461][483]` `C:medium` `V:durable`

### 17.6.1 What the enforcement looks like at the page level

- **Claim.** The enforcement is a permission split across trust levels: a kernel page may be writable at VTL0 or executable at VTL0, but the secure kernel does not grant both at once, and the grant is expressed in the second-level translation permissions that the more privileged level controls; see `06-address-translation.md` for the hardware and `15-security.md` for the feature.  `[463][483]` `C:high` `V:durable`
- **Claim.** Because the decision is taken at a level the VTL0 kernel cannot write to, a compromised VTL0 kernel cannot mark its own page executable — which is the property the feature exists to provide, and also the property that breaks drivers which generate code.  `[463][483]` `C:high` `V:durable`
- **Claim.** The same structure explains why the feature has a per-page cost profile rather than a per-call one: the expensive event is a change of page permissions, not ordinary execution.  `[463][483]` `C:medium` `V:durable`

---

## 17.7 Nested virtualization on a Windows PC

- **Claim.** Hyper-V can expose virtualization extensions to a child partition so that "a guest virtual machine can install its own hypervisor and run its own guest VMs"; Microsoft states this for both vendors' extensions, "for example, Intel VT-x and AMD-V", and names two standing constraints — memory cannot be adjusted while the nested machine runs, so dynamic memory does not fluctuate, and "virtualization applications other than Hyper-V aren't supported in Hyper-V virtual machines, and are likely to fail".  `[479]` `C:high` `V:durable`
- **Claim.** On Intel hardware the inner hypervisor's control-structure accesses are the dominant nested cost, which is what the enlightened VMCS selected through the VP assist page (§17.2.3) and, in hardware, VMCS shadowing exist to reduce; see `14-nested-virtualization.md`.  `[SDM 3C §27.6.15]` `[1][461][479]` `C:medium` `V:durable`
- **Claim.** Nesting does not remove the single-owner rule: the innermost VMM still does not own VMX root operation, and every exit it takes is mediated by the levels above it, which is why nested configurations compound the cost described in §17.3.4 and in `16-performance.md` §16.7.  `[479]` `C:high` `V:durable`

---

## 17.8 Contrast: the same hardware under other hypervisors

This section is deliberately compressed. It exists so that Windows behaviour can be recognised as one design choice among several, and because KVM is the implementation whose source is readable.

### 17.8.1 KVM's three-level file-descriptor model

- **Claim.** KVM is split into an architecture-independent core module and a vendor module for VMX or SVM. The vendor module no longer issues VMXON itself — its `vmx_enable_virtualization_cpu()` hook calls the kernel's shared x86 virtualization layer, which executes the instruction — but the effect is unchanged: a KVM host is in VMX root operation whenever virtualization is enabled, and there is no software fallback, because initialisation fails outright when the processor does not support VMX.  `[SDM 3C Ch.26]` `[1][451]` `C:high` `V:durable`
- **Claim.** The API is built from three levels of file descriptor: "an initial `open("/dev/kvm")` obtains a handle to the kvm subsystem", `KVM_CREATE_VM` on it gives a VM fd, and `KVM_CREATE_VCPU` on that gives a vCPU fd. What the documentation constrains is which context may issue each ioctl — "VM ioctls must be issued from the same process (address space) that was used to create the VM" and "vcpu ioctls should be issued from the same thread that was used to create the vcpu" — not, as this chapter previously said, one VM per process and one vCPU per thread.  `[450]` `C:high` `V:durable`
- **Claim.** Guest memory is registered with `KVM_SET_USER_MEMORY_REGION`, which maps a host userspace address range to a guest physical range; the set of those regions is the VM's memslot table, and "guest RAM" is nothing more than host userspace memory that a memslot describes.  `[450]` `C:high` `V:durable`
- **Claim.** `KVM_RUN` takes no argument: its parameter block is a `struct kvm_run` mapped from the vCPU fd, and the ioctl returns only when an exit cannot be handled in the kernel, with `kvm_run->exit_reason` telling userspace what to complete.  `[450]` `C:high` `V:durable`

### 17.8.2 Exit dispatch and the EPT-violation path

- **Claim.** After a VM exit, KVM reads the basic exit reason from the VMCS and dispatches through `kvm_vmx_exit_handlers[]`, an array indexed by that exit reason; EPT violation is basic exit reason 48 and EPT misconfiguration is 49, and each has its own handler.  `[SDM 3D App.C]` `[2][451]` `C:high` `V:durable`
- **Claim.** `handle_ept_violation()` reads the exit qualification and the guest-physical address from the VMCS, converts the qualification into a page-fault-style error code and calls the common MMU fault path; the qualification encodings are owned by `05-vm-exit.md`.  `[SDM 3C §27.9.1]` `[1][451]` `C:high` `V:durable`
- **Claim.** That path converts the guest-physical address to a guest frame number, resolves it against the memslots to a host virtual address, faults the page in through ordinary host paging, and installs a leaf EPT entry so the guest resumes without another exit; a frame with no covering memslot is treated as MMIO and may return to userspace.  `[450][454]` `C:high` `V:durable`
- **Claim.** The Intel vendor module's feature switches — EPT, VPID, unrestricted guest, EPT A/D bits, page-modification logging, APIC virtualization, nested VMX — are module parameters that the setup path silently clears when the hardware prerequisites are missing, so a parameter set to 1 on unsupported hardware degrades rather than failing.  `[451][452]` `C:high` `V:durable`

> **Excerpt** `[451]` — the auto-degrade chain as it stands in `vmx_hardware_setup()`. The four
> tests are no longer contiguous in the source; unrelated checks sit between them and are elided
> here, but each condition is verbatim:
> ```c
> if (!cpu_has_vmx_vpid() || !cpu_has_vmx_invvpid() ||
>     !(cpu_has_vmx_invvpid_single() || cpu_has_vmx_invvpid_global()))
>         enable_vpid = 0;
>
> if (!cpu_has_vmx_ept() ||
>     !cpu_has_vmx_ept_4levels() ||
>     !cpu_has_vmx_ept_mt_wb() ||
>     !cpu_has_vmx_invept_global())
>         enable_ept = 0;
> /* ... */
> if (!cpu_has_vmx_ept_ad_bits() || !enable_ept)
>         enable_ept_ad_bits = 0;
>
> if (!cpu_has_vmx_unrestricted_guest() || !enable_ept)
>         enable_unrestricted_guest = 0;
> ```

- **Claim.** The dependency structure in that chain is architectural: unrestricted guest and EPT A/D bits are defined on top of EPT, so disabling EPT necessarily disables both.  `[SDM 3C Ch.31]` `[1][451]` `C:high` `V:durable`

- **Claim.** Nested support in that implementation is a module parameter too, and running a hypervisor inside a KVM guest is documented as a supported configuration with its own constraints; see `14-nested-virtualization.md`.  `[453]` `C:medium` `V:durable`

### 17.8.3 QEMU, Xen and ESXi in one paragraph each

- **Claim.** QEMU with the KVM accelerator keeps the device model and gives up CPU execution: it creates the VM and vCPU fds, registers its RAM as memslots, runs each vCPU in a loop around `KVM_RUN`, and routes the I/O and MMIO exits into the same address-space dispatch its emulated devices use.  `[455][457]` `C:high` `V:durable`
- **Claim.** Xen runs beneath everything with a privileged domain holding the drivers and toolstack — "a special domain, called domain 0 contains the drivers for all the devices in the system … also contains a control stack and other system services" — and its guest types run from fully paravirtualized (still supported, and needing no virtualization extensions), through hardware-virtualized with a QEMU-emulated PC platform, to PVH: "lightweight HVM guests which use Hardware virtualization support for memory and privileged instructions, PV drivers for I/O and native operating system interfaces for everything else", which "does not use QEMU for device emulation, but it can still be used for user-space backends".  `[458]` `C:high` `V:durable`
- **Claim.** Xen requires an IOMMU for safe device assignment to a hardware-virtualized guest, and assignment without interrupt remapping is unsafe rather than merely unsupported: Xen states that only systems using IOMMUs are supported for passthrough, and that a global rather than per-device interrupt-remapping table "is not security supported as it allows all devices to impersonate each other as far as interrupts are concerned". The wiki page cited here could not be reached for re-verification; the wording above is from Xen's own support matrix and command-line documentation, which this chapter's bibliography does not yet carry. See `11-vtd-interrupt-remapping.md`.  `[459]` `C:medium` `V:durable`
- **Claim.** ESXi exposed the hardware-assist decision per VM as four monitor settings — "Automatic", "Software CPU and MMU", "Hardware CPU, Software MMU" and "Hardware CPU and MMU" — whose existence is a direct descendant of the 2006 finding that first-generation VT-x could be slower than binary translation; see `16-performance.md` §16.2.2. The four-way choice is from the vSphere 6.5 edition of VMware's performance guide; later editions state that ESXi no longer supports software CPU virtualization or software MMU virtualization, which collapses the choice.  `[401][460]` `C:high` `V:durable`

### 17.8.4 The structural difference in one line

- **Claim.** All four designs put CPU and memory virtualization below the device model; they differ in where the boundary is drawn — kernel and userspace process for KVM, hypervisor and privileged domain for Xen, hypervisor and helper process for ESXi, hypervisor and root partition for Hyper-V — and Windows is distinctive only in that its own kernel is on the guest side of that line.  `[450][458][460][462]` `C:high` `V:durable`

---

## 17.9 Feature map: what a Windows PC uses

| VT feature (owner chapter) | Hyper-V | Third-party VMM via WHP | KVM (contrast) |
|---|---|---|---|
| VMX root entry (`01`) | executes VMXON at boot | none — Hyper-V holds it | the vendor module executes VMXON |
| VMCS management (`02`) | per virtual processor, inside the hypervisor | inaccessible; API objects instead | per vCPU in the vendor module |
| Exit dispatch (`05`) | hypervisor exit handler, then partition owner | exit context returned to user mode | table indexed by exit reason |
| EPT (`06`) | required; also enforces VTL separation | provided by Hyper-V | module parameter, memslot-backed faulting |
| VPID (`06`) | used by the hypervisor | not exposed | module parameter |
| APICv and posted interrupts (`07`) | used underneath the synthetic controller | not exposed | in-kernel irqchip plus module parameters |
| Nested support (`14`) | exposed to child partitions, with the enlightened VMCS | inherited from Hyper-V | module parameter, hardware shadowing where available |
| Unrestricted guest (`03`, `06`) | used for guest boot | inherited | module parameter, gated on EPT |
| Dirty tracking (`06`) | used for partition state capture | not exposed | module parameter plus the dirty-log interfaces |
| VT-d (`10`–`12`) | device assignment, and Kernel DMA Protection with no VM at all | inherited | IOMMU subsystem and device assignment |

- **Claim.** Every row reduces to the same contract: the hypervisor programs VM-execution controls in the VMCS, the processor exits when a configured condition occurs, and the owner of the exit decides what happens next; products differ in which optional controls they require and in who owns the exit.  `[SDM 3C Ch.27]` `[1]` `C:high` `V:durable`

### 17.9.1 Symptom to cause

| Symptom | Cause | Section |
|---|---|---|
| a VMM reports that VT-x is unavailable although firmware enables it | the Windows hypervisor holds VMX root operation | §17.1 |
| a VMM runs but reports reduced or "native execution" mode | it is running through the platform API on top of Hyper-V | §17.3 |
| the machine is a hypervisor host although no VM was created | a utility VM or virtualization-based security is enabled | §17.4 |
| a kernel driver fails to load with memory integrity on | code-integrity enforcement from VTL1 | §17.6 |
| software objects that a hypervisor is present | CPUID-based presence detection | §17.1.1 |
| an external device cannot perform DMA before sign-in | Kernel DMA Protection using VT-d | §17.5 |

- **Claim.** All six rows are consequences of one structural fact — the Windows kernel is a guest in VTL0 and Hyper-V owns VMX root operation — which is why they appear together on the same machines.  `[462][463][476]` `C:high` `V:durable`

---

## 17.10 Procedure for answering a Windows VT question

1. Ask first whether the hypervisor is running. Almost every "VT-x is not available" report is §17.1, and the user's machine has virtualization-based security, WSL2, Sandbox, Docker Desktop or the Hyper-V role enabled.
2. Separate mechanism from status. "How does a guest discover the hypervisor" is answered here; "which Windows build enables memory integrity by default" is answered in `90-dated-landscape.md`.
3. For a security feature, hand off to `15-security.md`; this chapter owns only the VTL and partition mechanisms those features are built from.
4. For a performance follow-up, hand off to `16-performance.md`, which states where measurements with conditions exist and where they do not.
5. Cite Microsoft's own specification and documentation, never a blog repost of it; every Microsoft claim in this chapter is anchored to one of those two.

---

## 17.11 Out of scope for this chapter

Deferred to `90-dated-landscape.md`, where an as-of date can be carried:

- Which Windows editions or builds enable virtualization-based security or memory integrity by default, and on which hardware.
- Which release of each third-party VMM gained Windows-hypervisor-backed execution, and the retirement of the standalone accelerator driver it replaced.
- The lifecycle status of any Windows feature named in §17.4.
- Kernel and distribution merge points for the KVM behaviour described in §17.8.
- Cloud-provider support for nested virtualization, and server-only platform features that do not appear on a client PC; see `18-comparison-amd-arm-riscv.md` §18.11 for which features those are.
- The Hyper-V feature set a given host version exposes to guests, which a guest discovers through the hypervisor CPUID leaves rather than from documentation.
- Which hypervisor scheduler a given Windows edition uses by default (§17.2.8), and the configuration commands for changing it.
- The list of drivers and security products currently incompatible with memory integrity.
