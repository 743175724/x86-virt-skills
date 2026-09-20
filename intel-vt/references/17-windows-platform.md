# 17. The Windows Platform: Hyper-V, VBS, and Who Owns VMX Root Operation

> **中文速览**：本章讲 Windows PC 上 VT-x 到底被谁用、怎么用。核心事实只有一条：**一旦 VBS 或任何依赖 Hyper-V 的功能被启用，Windows 内核自己就作为 VTL0 的 guest 跑在 Windows hypervisor 之下，VMX root operation 属于 Hyper-V**——"为什么我的虚拟机/驱动/调试器用不了 VT-x"几乎总是归结到这一条。依次覆盖：Hyper-V 的分区模型、hypercall ABI、VMBus 环形缓冲、VP assist page、合成 MSR、VTL0/VTL1；WHP/WHPX 与第三方 VMM（VirtualBox / VMware Workstation / QEMU / Android 模拟器）如何改走 Hyper-V；WSL2、Windows Sandbox、Docker Desktop、Application Guard 这些"工具 VM"；Windows 对 VT-d 的使用（Kernel DMA Protection）；hypervisor 存在性检测与反作弊/HVCI 的交互。最后一节把 KVM/QEMU/Xen/ESXi 作为对照压缩呈现。**版本级产品状态（哪个 Windows 版本默认开什么、哪个产品哪版支持 WHPX）一律在 `90-dated-landscape.md`。**

**Maps to:** Microsoft official documentation — the Hypervisor Top-Level Functional Specification and Microsoft Learn — plus kernel.org for the contrast section. Intel anchors appear wherever a VMX or VT-d mechanism is named.
**Owns:** the Windows-side mapping from VT features to implementations (Hyper-V interfaces, WHP, utility VMs, Windows' use of VT-d), and the contrast with non-Windows hypervisors.
**See also:** `02-vmcs.md` and `05-vm-exit.md` (the structures these implementations program) · `06-address-translation.md` (EPT, which VTL isolation is built from) · `12-vtd-faults-bios-siov.md` (VT-d, which Kernel DMA Protection is built from) · `14-nested-virtualization.md` · `15-security.md` (owns the Windows security features themselves) · `16-performance.md` (what these cost) · `90-dated-landscape.md` (versions, defaults, product status).

---

## 17.1 The fact that explains most Windows VT questions

- **Claim.** VMX root operation has exactly one owner per logical processor: the software that executed VMXON. The architecture provides no way to share it, so a second hypervisor must either be given the hardware or be given an interface onto whoever holds it.  `[SDM 3C Ch.26]` `[1]` `C:high` `V:durable`
- **Claim.** When the Windows hypervisor is running, it is that owner: it launches before the Windows kernel, and the Windows installation the user interacts with becomes the root partition — a guest of the hypervisor, running in VTL0.  `[462][463]` `C:high` `V:durable`
- **Claim.** Virtualization-based security is a Hyper-V-backed feature, so enabling it starts the hypervisor even when the user never creates a virtual machine; the same is true of every utility-VM feature in §17.4; see `15-security.md`, which owns the security features themselves.  `[476]` `C:high` `V:durable`
- **Claim.** Therefore any question of the form "why can't my hypervisor, driver or debugger use VT-x on this machine" resolves to the same answer: Hyper-V already holds VMX root operation, and the requesting software must go through the Windows Hypervisor Platform (§17.3), run as a nested guest (§17.7), or require that the hypervisor be turned off.  `[465][479]` `C:high` `V:durable`

### 17.1.1 How to tell, from inside

- **Claim.** A guest can detect that it is running under a hypervisor through CPUID: the hypervisor-present indication in the standard feature leaf is set by convention by hypervisors and is never set by physical hardware, and the leaf at 0x40000000 returns a hypervisor vendor identity string.  `[461]` `C:medium` `V:durable`
- **Claim.** Microsoft's specification defines the leaf range beginning at 0x40000000 for hypervisor identification and interface discovery, with the vendor identity leaf followed by an interface-signature leaf that tells the guest which hypervisor interface it may use.  `[461]` `C:high` `V:durable`
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

- **Claim.** Processor support for VMX and for second-level address translation, together with firmware enablement, are stated prerequisites of the Windows virtualization platform rather than optional accelerations.  `[480]` `C:high` `V:durable`
- **Claim.** Layers 3 and 4 are separable: a machine can have the platform present and the hypervisor not running, or the hypervisor running for a security feature with no virtual machine defined, which is why "Hyper-V is not installed" is not evidence that VMX is free.  `[476][480]` `C:high` `V:durable`

---

## 17.2 Hyper-V

### 17.2.1 Partitions

- **Claim.** Hyper-V is a Type-1 hypervisor: it runs directly on the hardware in VMX root operation, and everything else — including the Windows installation that manages it — runs in a partition.  `[462]` `C:high` `V:durable`
- **Claim.** The root partition is privileged: it owns the physical device drivers, the virtualization management stack and the power and plug-and-play policy, and it creates child partitions by making hypercalls.  `[462]` `C:high` `V:durable`
- **Claim.** A child partition has no direct access to physical devices; it sees synthetic or emulated devices, and its memory is translated guest-virtual to guest-physical to system-physical, with the second stage performed by second-level address translation.  `[462]` `C:high` `V:durable`
- **Claim.** Second-level address translation — EPT on Intel — is a hard requirement for current Hyper-V rather than an optimisation, which is why processor support for it, together with VT-x and firmware enablement, is stated as a prerequisite for the feature.  `[SDM 3C Ch.31]` `[1][480]` `C:high` `V:durable`
- **Claim.** Device access from a child partition normally runs as a virtualization service client in the child talking to a virtualization service provider in the root partition over VMBus, so a synthetic device transfer traps on a signal rather than on every device-register access.  `[462][464]` `C:high` `V:durable`

### 17.2.2 The hypercall ABI

- **Claim.** A guest first identifies itself by writing its guest OS identity to the synthetic MSR at 0x40000000; until that MSR holds a non-zero identity, the hypercall interface cannot be enabled.  `[461]` `C:high` `V:durable`
- **Claim.** The guest then writes the hypercall MSR at 0x40000001 with a guest-physical page number and an enable bit, and the hypervisor overlays a hypercall page at that address containing the correct call instruction for the underlying processor, so guest code issues hypercalls without knowing whether it is on Intel or AMD silicon.  `[461]` `C:high` `V:durable`
- **Claim.** In the 64-bit convention the hypercall input value — call code, fast flag and repetition count — is passed in RCX, the guest-physical address of the input parameter block in RDX and that of the output block in R8, with the result returned in RAX; fast hypercalls pass their arguments in registers instead of memory.  `[461]` `C:medium` `V:durable`
- **Claim.** The instruction in the hypercall page is the architectural VMCALL on Intel parts; the guest never encodes it itself, which is what makes the same guest binary work on both vendors.  `[SDM 3C Ch.33]` `[1][461]` `C:medium` `V:durable`

### 17.2.3 The VP assist page and the enlightened VMCS

- **Claim.** Each virtual processor may enable a VP assist page by writing its guest-physical address to the synthetic MSR at 0x40000073; the hypervisor overlays a per-processor structure there carrying assistance fields such as end-of-interrupt assist and virtualization-fault information.  `[461]` `C:high` `V:durable`
- **Claim.** The VP assist page also carries the enlightened VMCS: a guest hypervisor reads and writes an in-memory structure that Hyper-V consumes at VM entry instead of executing VMREAD and VMWRITE, which is the interface a nested hypervisor uses on Windows.  `[461]` `C:medium` `V:durable`
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
| 0x40000073 | VP assist page, which also carries the enlightened VMCS |
| 0x40000080 – 0x40000084 | synthetic interrupt controller: control, version, event-flags page, message page, end of message |
| 0x40000090 – 0x4000009F | sixteen synthetic interrupt source registers |
| 0x400000B0 and following | synthetic timer configuration and count registers |

- **Claim.** The virtual processor index MSR at 0x40000002 gives the guest the hypervisor's own numbering for the current processor, which is the identifier hypercalls use to target a processor rather than the guest's APIC ID.  `[461]` `C:medium` `V:durable`
- **Claim.** This whole range, 0x40000000 to 0x400000FF, is reserved by convention for hypervisor use and therefore never collides with the architectural MSRs enumerated in Intel's model-specific register volume.  `[SDM 4 Ch.2]` `[5][461]` `C:medium` `V:durable`

### 17.2.6 VMBus ring buffers

- **Claim.** A VMBus channel is a pair of unidirectional ring buffers in guest memory, one per direction, described to the hypervisor by a list of guest physical pages; the two ends exchange packets by writing the ring and signalling the peer.  `[464]` `C:high` `V:durable`
- **Claim.** Because the rings are ordinary guest memory and signalling goes through the synthetic interrupt controller, the exit cost of a synthetic device transfer is the signal, not the data movement — the same design point that virtio reaches by a different route.  `[464][471]` `C:high` `V:durable`
- **Claim.** Channels are offered by the root partition and accepted by the child, and a guest driver binds to a channel by device type, which is why a Windows or Linux guest needs only the VMBus bus driver plus per-class clients rather than emulated hardware drivers.  `[464][484]` `C:medium` `V:durable`

### 17.2.7 Virtual Trust Levels

- **Claim.** A virtual processor can run at one of several Virtual Trust Levels, higher levels being more privileged, each with its own memory access protections, its own interrupt state and its own private register state, with explicit hypercalls to call into and return from a higher level.  `[463]` `C:high` `V:durable`
- **Claim.** The architecture defines up to 16 VTLs; Windows uses VTL0 for the normal kernel and user mode and VTL1 for the secure kernel and the isolated user-mode processes that depend on it.  `[463]` `C:medium` `V:durable`
- **Claim.** VTL separation is enforced with second-level address translation: each VTL has its own set of guest-physical access permissions, so VTL0 code cannot read or write VTL1 memory even though both run in the same partition; see `06-address-translation.md` for the hardware and `15-security.md` for the Windows features built on it.  `[SDM 3C Ch.31]` `[1][463]` `C:high` `V:durable`
- **Claim.** This is why a Windows PC can be a hypervisor host without hosting any virtual machine in the ordinary sense: the isolation boundary the feature needs is a VTL boundary inside one partition, not a second partition.  `[463][476]` `C:high` `V:durable`

### 17.2.8 Who schedules a virtual processor

- **Claim.** Hyper-V offers more than one hypervisor scheduler: a classic scheduler that treats virtual processors as independently schedulable, a core scheduler that constrains the virtual processors of one partition to run together on the threads of a physical core, and a root scheduler in which the root partition's own operating-system scheduler makes the decisions.  `[485]` `C:medium` `V:durable`
- **Claim.** The core scheduler exists because simultaneous multithreading shares microarchitectural state between the threads of a core, so keeping one partition's virtual processors on one core removes a class of cross-partition exposure; the cost of the equivalent restriction has been measured on another vendor's product and is quoted in `16-performance.md` §16.9.2.  `[485][412]` `C:medium` `V:durable`
- **Claim.** The root scheduler is the option intended for client systems, because it lets the Windows kernel scheduler keep its knowledge of foreground work, power policy and heterogeneous core types instead of that knowledge being hidden behind the hypervisor.  `[485]` `C:medium` `V:durable`
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

- **Claim.** Because the Windows hypervisor owns VMX root operation (§17.1), a third-party VMM cannot execute VMXON while it is running; the Windows Hypervisor Platform exists to give such software a user-mode API onto the Windows hypervisor instead.  `[465]` `C:high` `V:durable`
- **Claim.** The practical consequence is that on a Windows PC with any Hyper-V-backed feature enabled, a third-party VMM is no longer a hypervisor: it is a user-mode process whose guest is a partition created and scheduled by Hyper-V.  `[465]` `C:high` `V:durable`

### 17.3.2 The API surface

- **Claim.** The API mirrors the object model of other VMM interfaces without using file descriptors: capabilities are queried, a partition is created, properties such as the processor count are set, the partition is set up, host memory ranges are mapped into guest physical address ranges, virtual processors are created, and running a virtual processor returns an exit context.  `[465]` `C:high` `V:durable`
- **Claim.** Exit contexts classify the exit in API terms — memory access, I/O port access, MSR access, CPUID, exception, halt, cancellation — which is an abstraction over the hardware exit reason rather than the hardware exit reason itself; the hardware encodings are owned by `05-vm-exit.md`.  `[SDM 3D App.C]` `[2][465]` `C:medium` `V:durable`
- **Claim.** Register access is by name through get and set calls on a virtual processor, so the VMCS is never visible to the client; a feature that a VMM would implement by programming its own execution controls is available only if the API exposes an equivalent property.  `[465]` `C:high` `V:durable`

### 17.3.3 Who runs on it

- **Claim.** The consumers of this interface are exactly the products that used to drive VMX directly on Windows: QEMU implements it as an accelerator alongside its other backends, VirtualBox implements a native-execution backend that uses it when the Windows hypervisor is present, VMware Workstation gained a mode that runs on top of the Windows hypervisor, and the Android emulator uses it in place of its former standalone driver.  `[465][482]` `C:medium` `V:durable`
- **Claim.** Which release of each product gained that support, and the retirement of the standalone Intel accelerator driver it replaced, are product-status facts; see `90-dated-landscape.md`.  `[482]` `C:medium` `V:durable`

### 17.3.4 What is given up

- **Claim.** A guest exit under this arrangement is handled twice: the hardware exits to the Windows hypervisor, which decides whether it owns the exit, and only then is an exit context returned to the user-mode VMM — whereas a VMM owning VMX handles the exit in its own handler directly.  `[465]` `C:high` `V:durable`
- **Claim.** No public measurement of the resulting difference carrying processor, workload and configuration is recorded in this knowledge base; the mechanism above explains the direction, and `16-performance.md` §16.5 states the absence rather than supplying a figure.  `[465]` `C:high` `V:durable`
### 17.3.5 Debuggers, drivers and other software that wants the hardware

- **Claim.** The single-owner rule of §17.1 applies to every consumer of VMX, not only to virtual-machine products: a driver or analysis tool that wants to execute VMXON is in the same position as a third-party VMM and must go through the platform API or run nested.  `[SDM 3C Ch.26]` `[1][465]` `C:high` `V:durable`
- **Claim.** Software that instead relies on writable-executable kernel memory or on patching kernel code is blocked by a different mechanism — memory-integrity enforcement from VTL1 (§17.6) — so the two failure modes have different fixes and should not be diagnosed together.  `[483]` `C:high` `V:durable`
- **Claim.** Guest-visible processor facilities can also behave differently when a hypervisor is resident, because timers, performance-monitoring and some model-specific registers may be virtualized or intercepted; which ones is a property of the hypervisor's interception configuration rather than of the processor; see `03-nonroot-operation.md`.  `[SDM 3C §27.6]` `[1][461]` `C:medium` `V:durable`


### 17.3.6 The three coexistence options

| Option | What owns VMX root | What the third-party VMM gets | Cost |
|---|---|---|---|
| Platform API (§17.3) | Hyper-V | a partition it drives from user mode | an extra hop per exit; no direct control of execution controls |
| Run nested (§17.7) | Hyper-V | real virtualization extensions inside a child partition | the nested multiplication of `16-performance.md` §16.7 |
| Disable the hypervisor | the third-party VMM | the hardware, directly | loses every Hyper-V-backed Windows feature at once, including the security ones |

- **Claim.** The third option is not a configuration change confined to one product: because virtualization-based security, WSL2, Sandbox and container backends are all Hyper-V-backed, turning the hypervisor off to give a VMM direct VMX access disables all of them together; see `15-security.md` for what is lost on the security side.  `[476][480]` `C:high` `V:durable`

---

## 17.4 Utility VMs: WSL2, Sandbox, Docker Desktop, Application Guard

These features are not "virtual machines" in the user's mental model, but they are partitions, and they all pull in the hypervisor.

### 17.4.1 WSL2

- **Claim.** WSL2 runs a real Linux kernel inside a lightweight utility virtual machine managed by the Windows hypervisor, in contrast to the earlier design that translated Linux system calls into Windows ones.  `[474]` `C:high` `V:durable`
- **Claim.** That utility VM is a Hyper-V partition, so enabling WSL2 enables the platform: the machine becomes a hypervisor host, with the consequences for third-party VMMs described in §17.3.  `[474][480]` `C:high` `V:durable`
- **Claim.** Communication between the Windows host and the WSL2 kernel uses the same synthetic transport as other Hyper-V guests rather than emulated devices, which is why filesystem and network behaviour differs measurably between the two WSL designs.  `[464][474]` `C:medium` `V:durable`

### 17.4.2 Windows Sandbox

- **Claim.** Windows Sandbox is a disposable desktop environment built on the same hardware-virtualization foundation, using the host's own operating-system image as its base rather than a separate installed guest.  `[475]` `C:high` `V:durable`
- **Claim.** Its design goal is a container-like startup cost with VM-grade isolation, achieved by sharing immutable host files and memory pages with the sandbox partition instead of duplicating them.  `[475]` `C:medium` `V:durable`

### 17.4.3 Docker Desktop

- **Claim.** Linux containers on Windows run inside a Linux virtual machine, not directly on the Windows kernel; the common configuration uses the WSL2 utility VM as that host, so container isolation on a Windows PC is layered on top of a partition.  `[481]` `C:high` `V:durable`
- **Claim.** The consequence for reasoning about overhead is that the container-versus-VM comparison from the server literature does not transfer: on Windows both costs are paid, because the container sits inside a VM; see `16-performance.md` §16.6.  `[481]` `C:medium` `V:durable`

### 17.4.4 Defender Application Guard

- **Claim.** Application Guard isolates untrusted content by opening it inside a separate hardware-isolated container rather than by sandboxing it inside the user session, which again requires the hypervisor to be running.  `[478]` `C:medium` `V:durable`
- **Claim.** Its availability and lifecycle status are product facts and belong in `90-dated-landscape.md`; the mechanism — an isolated partition with a restricted device surface — is what belongs here.  `[478]` `C:medium` `V:durable`

### 17.4.5 The shared consequence

- **Claim.** Every feature in this section, plus virtualization-based security, plus the Hyper-V role itself, turns the machine into a hypervisor host; from the hardware's point of view they are indistinguishable, which is why enabling any one of them changes the behaviour of all the others.  `[476][480]` `C:high` `V:durable`

### 17.4.6 What a utility VM actually costs the host

- **Claim.** The resident cost of a utility VM is memory plus scheduling: its pages are backed by host memory while it runs, and its virtual processors are scheduled by whichever scheduler the platform is configured to use (§17.2.8).  `[474][485]` `C:medium` `V:durable`
- **Claim.** Its variable cost is concentrated at the boundary rather than inside the guest: guest compute runs in non-root operation at native speed, while every crossing — a file operation against the host filesystem, a network packet, a device interaction — traverses the synthetic transport of §17.2.6.  `[464][474]` `C:medium` `V:durable`
- **Claim.** This is why the useful question about a utility VM is how often the workload crosses the boundary rather than how fast the guest runs, and why `16-performance.md` §16.4 records a mechanism rather than a percentage.  `[474]` `C:medium` `V:durable`

---

## 17.5 Windows and VT-d: Kernel DMA Protection

- **Claim.** Kernel DMA Protection uses the platform IOMMU to constrain direct memory access from external, hot-pluggable peripherals, so that a device attached to an external port cannot read or write arbitrary system memory before the operating system has authorised it.  `[477]` `C:high` `V:durable`
- **Claim.** The hardware underneath is Intel VT-d: DMA remapping tables restrict each device to the memory its driver has mapped for it, which is the same facility a hypervisor uses to assign a device to a guest safely; see `10-vtd-dma-remapping.md` and `12-vtd-faults-bios-siov.md`.  `[VT-d 5.20 Ch.3]` `[8][477]` `C:high` `V:durable`
- **Claim.** The feature depends on firmware as well as silicon: the platform must describe its remapping hardware to the operating system and must have protected memory before the OS takes over, which is why it is reported as a platform capability rather than merely a CPU one.  `[VT-d 5.20 Ch.8]` `[8][477]` `C:medium` `V:durable`
- **Claim.** This is the clearest case on a client PC where VT-d is used with no virtual machine involved at all: the "guest" being constrained is a physical device, not a partition.  `[477]` `C:high` `V:durable`

### 17.5.1 What the PC does not get

- **Claim.** Assigning a whole physical device to a guest is a server-oriented capability rather than a client one, so on a PC the IOMMU's main role is the DMA protection above, not device assignment; the hardware is the same, the platform support is not.  `[477][480]` `C:medium` `V:durable`
- **Claim.** The comparison chapter marks which other features are server-platform-only, so that a Windows PC reader is not led to expect them; see `18-comparison-amd-arm-riscv.md` §18.11.  `[21]` `C:medium` `V:durable`

---

## 17.6 Hypervisor presence, HVCI and software that objects to both

- **Claim.** Memory integrity places the code-integrity decision in VTL1, so the VTL0 kernel can execute only pages that the secure kernel has validated, and kernel pages cannot be both writable and executable; see `15-security.md`, which owns the feature.  `[463][476][483]` `C:high` `V:durable`
- **Claim.** Kernel-mode software that allocates writable-executable memory, generates code at run time, or patches kernel code is therefore incompatible by construction rather than by policy — the constraint is enforced by a more privileged level using second-level address translation permissions.  `[483]` `C:high` `V:durable`
- **Claim.** Independently of that, protection software that assumes it is the most privileged component on the machine will observe a hypervisor through the CPUID indications in §17.1.1 and may treat its presence as untrusted, which is the architectural reason some titles behave differently on a machine with virtualization-based security enabled.  `[461]` `C:medium` `V:durable`
- **Claim.** These are two separate mechanisms with one symptom: one is code-integrity enforcement from VTL1, the other is presence detection; a question about a specific product's behaviour is a product-status question for `90-dated-landscape.md`.  `[461][483]` `C:medium` `V:durable`

### 17.6.1 What the enforcement looks like at the page level

- **Claim.** The enforcement is a permission split across trust levels: a kernel page may be writable at VTL0 or executable at VTL0, but the secure kernel does not grant both at once, and the grant is expressed in the second-level translation permissions that the more privileged level controls; see `06-address-translation.md` for the hardware and `15-security.md` for the feature.  `[463][483]` `C:high` `V:durable`
- **Claim.** Because the decision is taken at a level the VTL0 kernel cannot write to, a compromised VTL0 kernel cannot mark its own page executable — which is the property the feature exists to provide, and also the property that breaks drivers which generate code.  `[463][483]` `C:high` `V:durable`
- **Claim.** The same structure explains why the feature has a per-page cost profile rather than a per-call one: the expensive event is a change of page permissions, not ordinary execution.  `[463][483]` `C:medium` `V:durable`

---

## 17.7 Nested virtualization on a Windows PC

- **Claim.** Hyper-V can expose virtualization extensions to a child partition so that the guest may itself run a hypervisor; this is what allows a virtual machine on a Windows PC to run its own Hyper-V, WSL2 or third-party VMM.  `[479]` `C:high` `V:durable`
- **Claim.** On Intel hardware the inner hypervisor's control-structure accesses are the dominant nested cost, which is what the enlightened VMCS in the VP assist page (§17.2.3) and, in hardware, VMCS shadowing exist to reduce; see `14-nested-virtualization.md`.  `[SDM 3C §27.6.15]` `[1][461][479]` `C:medium` `V:durable`
- **Claim.** Nesting does not remove the single-owner rule: the innermost VMM still does not own VMX root operation, and every exit it takes is mediated by the levels above it, which is why nested configurations compound the cost described in §17.3.4 and in `16-performance.md` §16.7.  `[479]` `C:high` `V:durable`

---

## 17.8 Contrast: the same hardware under other hypervisors

This section is deliberately compressed. It exists so that Windows behaviour can be recognised as one design choice among several, and because KVM is the implementation whose source is readable.

### 17.8.1 KVM's three-level file-descriptor model

- **Claim.** KVM is split into an architecture-independent core module and a vendor module for VMX or SVM; the vendor module executes VMXON itself, so a KVM host is in VMX root operation whenever virtualization is enabled, and there is no software fallback for processors without VMX.  `[SDM 3C Ch.26]` `[1][451]` `C:high` `V:durable`
- **Claim.** The API is built from three levels of file descriptor: opening `/dev/kvm` gives a system fd, `KVM_CREATE_VM` on it gives a VM fd, and `KVM_CREATE_VCPU` on that gives a vCPU fd, with the documented model being one VM per process and one vCPU per thread.  `[450]` `C:high` `V:durable`
- **Claim.** Guest memory is registered with `KVM_SET_USER_MEMORY_REGION`, which maps a host userspace address range to a guest physical range; the set of those regions is the VM's memslot table, and "guest RAM" is nothing more than host userspace memory that a memslot describes.  `[450]` `C:high` `V:durable`
- **Claim.** `KVM_RUN` takes no argument: its parameter block is a `struct kvm_run` mapped from the vCPU fd, and the ioctl returns only when an exit cannot be handled in the kernel, with `kvm_run->exit_reason` telling userspace what to complete.  `[450]` `C:high` `V:durable`

### 17.8.2 Exit dispatch and the EPT-violation path

- **Claim.** After a VM exit, KVM reads the basic exit reason from the VMCS and dispatches through `kvm_vmx_exit_handlers[]`, an array indexed by that exit reason; EPT violation is basic exit reason 48 and EPT misconfiguration is 49, and each has its own handler.  `[SDM 3D App.C]` `[2][451]` `C:high` `V:durable`
- **Claim.** `handle_ept_violation()` reads the exit qualification and the guest-physical address from the VMCS, converts the qualification into a page-fault-style error code and calls the common MMU fault path; the qualification encodings are owned by `05-vm-exit.md`.  `[SDM 3C §27.9.1]` `[1][451]` `C:high` `V:durable`
- **Claim.** That path converts the guest-physical address to a guest frame number, resolves it against the memslots to a host virtual address, faults the page in through ordinary host paging, and installs a leaf EPT entry so the guest resumes without another exit; a frame with no covering memslot is treated as MMIO and may return to userspace.  `[450][454]` `C:high` `V:durable`
- **Claim.** The Intel vendor module's feature switches — EPT, VPID, unrestricted guest, EPT A/D bits, page-modification logging, APIC virtualization, nested VMX — are module parameters that the setup path silently clears when the hardware prerequisites are missing, so a parameter set to 1 on unsupported hardware degrades rather than failing.  `[451][452]` `C:high` `V:durable`

> **Excerpt** `[451]` (the auto-degrade chain, abbreviated):
> ```c
> if (!cpu_has_vmx_vpid() || !cpu_has_vmx_invvpid() ||
>     !(cpu_has_vmx_invvpid_single() || cpu_has_vmx_invvpid_global()))
>         enable_vpid = 0;
> if (!cpu_has_vmx_ept() || !cpu_has_vmx_ept_4levels() ||
>     !cpu_has_vmx_ept_mt_wb() || !cpu_has_vmx_invept_global())
>         enable_ept = 0;
> if (!cpu_has_vmx_ept_ad_bits() || !enable_ept)
>         enable_ept_ad_bits = 0;
> if (!cpu_has_vmx_unrestricted_guest() || !enable_ept)
>         enable_unrestricted_guest = 0;
> ```

- **Claim.** The dependency structure in that chain is architectural: unrestricted guest and EPT A/D bits are defined on top of EPT, so disabling EPT necessarily disables both.  `[SDM 3C Ch.31]` `[1][451]` `C:high` `V:durable`

- **Claim.** Nested support in that implementation is a module parameter too, and running a hypervisor inside a KVM guest is documented as a supported configuration with its own constraints; see `14-nested-virtualization.md`.  `[453]` `C:medium` `V:durable`

### 17.8.3 QEMU, Xen and ESXi in one paragraph each

- **Claim.** QEMU with the KVM accelerator keeps the device model and gives up CPU execution: it creates the VM and vCPU fds, registers its RAM as memslots, runs each vCPU in a loop around `KVM_RUN`, and routes the I/O and MMIO exits into the same address-space dispatch its emulated devices use.  `[455][457]` `C:high` `V:durable`
- **Claim.** Xen runs in VMX root operation with a privileged domain holding the drivers and toolstack; its guest types range from fully paravirtualized, through hardware-virtualized with an emulated platform, to PVH, which uses hardware virtualization for CPU and memory but keeps paravirtual I/O and no emulated device model.  `[458]` `C:high` `V:durable`
- **Claim.** Xen requires an IOMMU for safe device assignment to a hardware-virtualized guest, and assignment without interrupt remapping is unsafe rather than merely unsupported; see `11-vtd-interrupt-remapping.md`.  `[459]` `C:high` `V:durable`
- **Claim.** ESXi exposes the hardware-assist decision per VM as four monitor settings — automatic, software CPU and MMU, hardware CPU with software MMU, and hardware CPU and MMU — whose existence is a direct descendant of the 2006 finding that first-generation VT-x could be slower than binary translation; see `16-performance.md` §16.2.2.  `[401][460]` `C:high` `V:durable`

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
