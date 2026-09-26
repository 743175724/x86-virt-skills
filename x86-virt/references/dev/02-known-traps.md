# 02. Known traps

> **中文速览**：本章是这个子树最有价值的部分——**在已发表的实现里流传、但现在是缺陷的做法**。
> 每一条都有具体的 issue 或 commit 可查，不是经验之谈。
> **写代码之前读，不要在调试之后读。**

**Maps to:** no specification chapter; these are defects found in implementations.
**Owns:** practices that circulate and are wrong.
**See also:** `03-failures-by-model.md` · `01-platform-ownership.md`

The entries here share a shape worth noticing: **none of them is "this generation lacks a
feature".** Each is a design habit that was correct on the hardware it was written for and
became wrong later, which is precisely the kind of thing a feature matrix cannot record.

## 2.1 One EPT/NPT hierarchy per logical processor

**The habit:** allocate a private EPT (Intel) or NPT (AMD) paging hierarchy for each
logical processor. Every published implementation surveyed does this by default.

- **Claim.** On Intel hybrid parts, four E-cores share one L2 cache, so per-core paging hierarchies stop being cache-friendly and the design degrades measurably from 12th generation onward. The NoirVisor report demonstrates it on an i7-14700K with an i7-8700K control that shows no regression, and the maintainer's fix was to move to **one global paging structure shared across all cores**.  `[no-spec]` `[2]` `C:high` `V:durable`
- **Claim.** What is penalised is the *design habit*, not a bug in any one implementation — which is why it appears in code that is otherwise correct and why it survived review in several projects.  `[no-spec]` `[2]` `C:medium` `V:durable`

The reporter's own words: *"each individual core has it's own L2 cache, which is not the
case on hybrid CPUs with E-cores (4 E-cores share one L2 cache)"*. The maintainer's
resolution: *"It works when having one global EPT paging structure that is shared across
all cores."*  `[2]`

**What to do:** share one hierarchy across cores unless a per-core one is required for a
reason you can state. If you keep per-core hierarchies, say why, and measure on a hybrid
part rather than on the machine the code was written on.

## 2.2 An identity map that silently stops at 512 GB

**The habit:** build the nested-paging identity map by walking the lower levels and
letting the top level look after itself.

- **Claim.** A nested-paging identity-map builder that ignores the PML4 index covers only the first 512 GB of guest-physical space. On a machine whose MMIO is placed above 512 GB the guest bugchecks, while the same build runs correctly on every machine whose MMIO sits lower — so the defect reads as a hardware incompatibility.  `[no-spec]` `[6]` `C:high` `V:durable`
- **Claim.** In the reported case the symptom was attributed to a CPU generation: the reporter concluded that only Zen 4 and Zen 5 were affected, and the maintainer could not reproduce it on Zen 4. The real cause was the map size, and the machine's memory layout rather than its processor decided who saw it.  `[no-spec]` `[6]` `C:high` `V:durable`

The maintainer's resolution, verbatim: *"The issue is your system is configured to use
physical memory address greater than 512 GB for MMIO."*  `[6]`

**What to do:** cover the full guest-physical width the part supports, and derive it
rather than assuming it. **And treat this entry as the reference example of why a
model-keyed failure table is dangerous** — a table built from the original report would
have recorded "Zen 4/5 is broken", which is false, and would have kept being wrong long
after the code was fixed. See `03-failures-by-model.md` §3.5.

## 2.3 Reading a capability bit once and caching it for the machine

**The habit:** probe CPUID on the boot processor, store the result, apply it everywhere.

- **Claim.** On AMD client parts the AVIC and x2AVIC capability bits are the only two in their CPUID leaf whose reset description permits them to change after reset, and their value tracks the microcode patch level rather than the family and model. Five patch levels on one model and stepping produce two different answers.  `[PPR 57930 p.103]` `[70]` `C:medium` `V:durable`
- **Claim.** On Intel the question of which leaves may legitimately differ between a P-core and an E-core has a mechanical answer rather than a folk one: SDM rev 093 Vol.1 §21.1.4 classifies ISA feature bits as Platform domain, which must be identical on every logical processor, and cache, topology and native-model leaves as Logical Processor domain, where divergence is permitted and hybrid is named as the reason.  `[SDM 1 §21.1.4]` `[72]` `C:medium` `V:durable`

**What to do:** treat a capability as a property of the machine only when the vendor says
it is. Where the vendor marks a bit as permitted to change, read it where you use it, and
record the firmware level alongside any conclusion you store.

## 2.4 Trusting an advertised feature bit on an affected part

**The habit:** if the bit says the feature is there, use it.

- **Claim.** Some AMD Family 19h client parts advertise virtualized `VMLOAD`/`VMSAVE` and reboot at random when it is used. The workaround lives in the Linux kernel, which means a guest under KVM is protected and a bare-metal hypervisor is not — none of the surveyed bare-metal implementations carries it.  `[no-spec]` `[40]` `C:medium` `V:durable`

**What to do:** before enabling an optional acceleration, check whether the kernel
disables it on your part and why. A mitigation that exists only in an operating system is
a signal, not a reassurance: it tells you the hardware problem is real and that nothing
will protect you from it outside that operating system.

## 2.5 Copying from an archived project

- **Claim.** Three of the four implementations most often cited as starting points are no longer maintained: HyperPlatform was archived by its author in 2026, hvpp last moved in 2021, and Bareflank's licence file names a copyright holder inconsistent with the headers in its own source, which GitHub reports as no recognised licence. HyperDbg is actively maintained and is GPL-3.0, which the Apache Software Foundation classifies as a licence whose code may not be included in an Apache-2.0 work.  `[no-spec]` `[9]` `[103]` `C:medium` `V:durable`
- **Claim.** Of the implementations surveyed, `barevisor` is the only maintained one covering both vendors across both a Windows driver and UEFI behind a shared OS-agnostic core, which is the structure this subtree recommends as a reference.  `[no-spec]` `[3]` `C:medium` `V:durable`

**What to do:** check the last commit date and the licence before adopting a structure,
and prefer to write the skeleton rather than vendor it — vendored code carries an
attribution obligation into every reproduction, including the ones an agent emits on your
behalf.

## 2.6 Open items

- **This list is short because the bar is evidence.** Practices that are merely
  suspicious are not recorded here; an entry needs an issue, a commit or a measurement.
  A trap without one belongs in a note, not in this chapter.
- Intel-side traps are under-represented relative to AMD: §2.1 is the only one drawn from
  an Intel-specific defect. That is an artefact of what has been searched, not evidence
  that Intel implementations have fewer.
