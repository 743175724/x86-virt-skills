# amd-virtualization eval — mechanism (24 answers)

Answered from the `amd-virtualization` skill only. Entry point `SKILL.md`, then one
chapter per question via the §Routing table; `00-quickref.md` §0.3 consulted for table
ownership; `errata.md` read before writing, per SKILL.md step 3.

Routing note used throughout: several routing rows name a chapter correctly but anchor
at a section that is not the one owning the mechanism (the rows are anchored at the
*tables* readers most often want). Where that happened I record it as "landed short
(in-chapter)" — §0.3 did not resolve these because they are prose sections, not tables;
the chapter's own `Owns:` line and section list did.

---

### clean-bits-mechanism
**Routed to:** `02-vmcb.md` §2.5 (plus §2.6, same chapter) — right first time

**Answer:**
VMCB state caching lets the processor keep guest register values in hardware between a
`#VMEXIT` and the next VMRUN and reload them from that cache instead of from memory.
Support is enumerated by `CPUID Fn8000_000A_EDX[VmcbClean] = 1` `[APM2 §15.15]`. The
control is the VMCB Clean field at control-area offset **0C0h**.

*How it works.* Each **set** bit allows the processor to load one register or group from
the hardware cache; each **clear** bit requires it to load from the VMCB. Set bits are
only a hint — any implementation may ignore a set bit and load from memory anyway — but
**clean bits set to zero are always honored** `[APM2 §15.15.1]`. The identity used to
decide whether a cached copy belongs to a guest is the **physical address of the VMCB**;
**the ASID is explicitly not a unique identifier** for this purpose `[APM2 §15.15]`. The
CPU compares the VMCB physical address against all cached VMCB physical addresses and,
if none matches, treats the whole Clean field as zero automatically `[APM2 §15.15.2]`.

*The bit map* `[APM2 Figure 15-4]`: 0 `I` (all intercept vectors, TSC offset, Pause
Filter Count) · 1 `IOPM` (`IOPM_BASE`, `MSRPM_BASE`) · 2 `ASID` · 3 `TPR` (the offset
60h–67h group: `V_TPR`, `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR`, `V_INTR_MASKING`,
`V_INTR_VECTOR`) · 4 `NP` (`NCR3`, `G_PAT`) · 5 `CRx` (CR0, CR3, CR4, EFER) · 6 `DRx`
(DR6, DR7) · 7 `DT` (GDT and IDT limit and base) · 8 `SEG` (CS/DS/SS/ES selector, base,
limit, attributes and CPL) · 9 `CR2` · 10 `LBR` · 11 `AVIC` · 12 `CET` · 31:13 reserved.
Three asymmetries: `SEG` covers **CS, DS, SS, ES only** (FS/GS/LDTR/TR move by
VMLOAD/VMSAVE); `DT` covers GDT/IDT limit and base but not the LDTR or TR descriptors;
`CR2` has a bit of its own while `EFER` rides in `CRx`.

*When you must zero bits.* The hypervisor must clear the specific bit **every time it
explicitly modifies the associated guest state in the VMCB**; changes caused by guest
execution are the processor's problem `[APM2 §15.15.2]`. It must clear the **entire**
Clean field in exactly three circumstances `[APM2 §15.15.2]`:
1. the first time a particular guest is run;
2. when it runs the guest on a **different CPU core** than the one used last time;
3. when it has **moved the guest's VMCB to a different physical page** since the last run.
Failure to do so may result in undefined behaviour. For forward compatibility a
hypervisor that has not modified the VMCB may write `FFFF_FFFFh`; it should write `0h`
when the VMCB is new or potentially inconsistent with the CPU's cached copy — for
instance a VMCB page taken from a free list without tracking whether it was recently
another guest's VMCB. If any field other than the explicitly uncached ones was modified,
**all clean bits undefined within the hypervisor's scope must be cleared** — writing
`FFFF_FFFFh` on a modified VMCB is not a legal shortcut. **Bit 31 is reserved for the
host and the CPU will never use it as a clean bit**, so a hypervisor may use it for its
own tracking `[APM2 §15.15.3]`.

*Fields with no clean bit at all* `[APM2 §15.15.3]`: `TLB_Control`, the interrupt shadow,
the status fields (`EXITCODE`, `EXITINFO1`, `EXITINFO2`, `EXITINTINFO`, Decode Assist),
event injection, and `RFLAGS`/`RIP`/`RSP`/`RAX`. Consequently the common fast path after
an intercept — rewrite `EVENTINJ`, read `EXITCODE`, re-enter — needs no clean-bit
maintenance at all.

*Two traps.* On processors supporting clean fields the **final merged hardware state** is
used for VMRUN's consistency checks and may include state from fields marked clean, so a
stale clean bit can surface as `VMEXIT_INVALID` rather than as wrong guest behaviour
`[APM2 §15.5.1]`. And clean bit 4 (`NP`) covers only the **fields** `NCR3` and `G_PAT` —
it says nothing about the *contents* of the nested page tables; changing those needs a
TLB command of 011b or 001b, which a clean-bit change cannot express `[APM2 §15.16.1]`.

**Confidence:** high; every claim carried `C:high` `V:durable`.

---

### intercept-priority-ordering
**Routed to:** `03-intercepts.md` §3.2 — right chapter (the row's `Owns:` line names
"intercept priority/ordering"), anchor landed short (row anchors §3.1, §3.3–§3.4)

**Answer:**
**No, there is no single rule.** AMD states ordering in two places: a general rule in
§15.7 and a per-instruction `Priority` column in Table 15-7 — and Table 15-7 is the
authority where it disagrees with the general rule.

*The general rule* `[APM2 §15.7]`:
- **Exception intercepts** are checked when normal instruction processing must raise an
  exception — *before* double-fault conditions are resolved and *before* delivery begins
  (before any exception frame is pushed and before the IDT is read).
- **Instruction intercepts** occur at well-defined points *before the results of the
  instruction are committed*; generally checked **after** simple exceptions such as `#GP`
  on wrong CPL or `#UD`, but **before** memory-access exceptions such as page faults and
  before exceptions that depend on specific operand values. RSM is explicitly an exception
  to the rule.
- **Instruction breakpoints for the current instruction, and pending data-breakpoint traps
  left over from the previous instruction, are checked before instruction intercepts** —
  a debug exception can reach a guest that is about to be intercepted.
- An intercepted external or virtual interrupt is **left pending**, not consumed.
- A **trap** intercept is taken *after* the triggering instruction completes, so the saved
  guest state includes its effects `[APM2 §15.7.1]`.

*Rows that invert the guideline* `[APM2 Table 15-7]` — the intercept goes **first**:
`INTn` (before any exception check; reported CS:rIP is that of the INTn), `XSETBV`
(before `#GP`), `VMMCALL`, the `PUSHF`/`POPF`/`CPUID`/`RSM`/`IRET` group, and
`INVLPGB`/`INVLPGB_ILLEGAL`/`INVPCID` (over all exceptions **except** `#GP` for CPL ≠ 0).
Rows where **all** exceptions come first: `HLT`, `RDTSCP`, `MONITOR`/`MONITORX`,
`MWAIT`/`MWAITX`, `RDPRU`, `RDTSC`, `RDPMC`, `INVLPG`/`INVLPGA`, and the SVM instruction
group (`VMRUN`, `VMLOAD`, `VMSAVE`, `STGI`, `CLGI`, `SKINIT`, `WBINVD`/`WBNOINVD`,
`TLBSYNC`). `MOV` to/from CRn and DRn: all normal exception checks take precedence.
`MOV to CR3`: non-memory exceptions first, then the intercept, which fires **before the
TLB is flushed**, with a PAE PDPE `#GP` checked **after** the intercept. Descriptor-table
instructions: after `#UD` and `#GP` but before any memory access.

*Other fixed orderings in the same section.* The `#PF` intercept is tested **before CR2 is
written** `[APM2 §15.12.15]`. The `#MC` intercept is checked **after** all machine-check
registers are written `[APM2 §15.12.18]`. The task-switch intercept is checked after the
incoming TSS and task gate have been checked for correctness but **before** the switch
`[APM2 §15.14.1]`. The conditional MWAIT intercept (vector 4 bit 12) is checked before
the unconditional one (bit 11). When both the selective and non-selective CR0-write
intercepts are active the non-selective one wins. **MCOMMIT has an intercept bit (vector
5, bit 3) but no row in Table 15-7, so its ordering relative to exceptions is
undocumented.**

*Intercepts raised during the guest's own IDT delivery* `[APM2 §15.7.3]`: when the guest
raises event E the processor **checks E's own exception intercept first**; only if E is
not intercepted is it combined with any prior pending event. So with `#GP` and `#DF` both
intercepted, a non-intercepted `#NP` whose delivery raises `#GP` exits as an intercepted
**`#GP`**, not as `#DF` `[APM2 §15.12]`. Once an exception is successfully taken in the
guest, the in-delivery valid flag is cleared and no `#VMEXIT` occurs.

**Confidence:** high; all claims `C:high` `V:durable`. The one honest gap the chapter
itself names is MCOMMIT's missing row.

---

### tsc-offset-and-ratio-composition
**Routed to:** `03-intercepts.md` §3.6 — right chapter (routing row names "TSC ratio"),
anchor landed short (row anchors §3.1, §3.3–§3.4)

**Answer:**
**The order is fixed: the ratio is applied first and the offset is added afterwards,
unscaled.** The composition AMD publishes is

`TSC(guest) = (P0 frequency × TSCRatio × t) + VMCB.TSC_OFFSET + (last value written to TSC) × TSCRatio`

where *t* is the time since the TSC was last written (or since reset), and
`TSCFreq = Core P0 frequency × TSCRatio` `[APM2 §15.30.5]`. Note the last term: a
previously written TSC value is *also* scaled by the ratio, while the VMCB offset is not.
The practical consequence is that a hypervisor which computes an offset under one ratio
and then changes the ratio will see the guest's clock jump `[APM2 §15.30.5]`.

*The two controls.* `TSC_OFFSET` is a 64-bit VMCB control field that is **added** in
RDTSC and RDTSCP `[APM2 Table B-1]`. The **TSC Ratio MSR is `C000_0104h`**, supported
when `CPUID Fn8000_000A_EDX[4]` (`TscRateMsr`) = 1, holding a fixed-point binary number
in **8.32 format** — INT in bits 39:32, FRAC in bits 31:0, bits 63:40 MBZ — with a reset
value of 1.0 `[APM2 §15.30.5]` `[APM2 Figure 15-29]`.

*Exactly what they affect.* The ratio scales the value a guest sees from **RDTSC, RDTSCP,
and RDMSR of the TSC, MPERF and MPerfReadOnly MSRs**. It has **no effect in host mode or
when virtualization is disabled**, and SMM code sees unscaled values unless it is itself
executed inside a guest container. It changes **neither the rate of the underlying
counters nor the value written** to the TSC, MPERF or MPerfReadOnly MSRs by a host or
guest write — it is a **read-side transform only** `[APM2 §15.30.5]`.

*What gets you before either applies.* The relevant intercepts are RDTSC at vector 3 bit
14, RDPMC at vector 3 bit 15 and RDTSCP at vector 4 bit 7, and **all three check every
exception before the intercept**, so a guest at CPL > 0 with `CR4.TSD` set takes `#GP`
and never reaches the hypervisor `[APM2 Table B-1]` `[APM2 Table 15-7]` `[APM2 §13.2.4]`.

`TSC_OFFSET` is covered by VMCB clean bit 0 (`I`), so editing it means clearing that bit
(`02-vmcb.md` owns the clean-bit map).

**Confidence:** high; all claims `C:high` `V:durable`.

---

### vmrun-ordering
**Routed to:** `04-world-switch.md` §4.1 — right chapter, anchor landed short
(row anchors §4.2, the consistency checks)

**Answer:**
The manual's own mental model is that VMRUN is *a single host instruction that takes an
arbitrarily long time*: an arbitrary number of guest instructions execute "inside" it and
the `#VMEXIT` completes it.

**Preconditions.** Implicit `[rAX]` addressing — software loads rAX with the physical
address of the 4-Kbyte-aligned VMCB page, and the portion of RAX used is determined by
the current effective address size. The VMCB is accessed by physical address and should
be mapped writeback `[APM2 §15.5.1]`. CPL 0 only (`#GP(0)` otherwise); protected mode and
`EFER.SVME = 1` required (`#UD` otherwise). Vol.3 adds two further `#GP` conditions the
Vol.2 prose omits: rAX above the maximum supported physical address, and rAX not
4-Kbyte aligned `[APM3 §4 "VMRUN"]`. VMRUN inside the SMM handler is **undefined
behaviour**, not a fault `[APM2 §15.5]`.

**Step 1 — save host state** into the 4-Kbyte block at `VM_HSAVE_PA` (`C001_0117h`). AMD
says "**at least** the following", and the enumerated set is **fourteen items**: CS.SEL
and NEXT_RIP · RFLAGS and RAX · SS.SEL and RSP · CR0, CR3, CR4, EFER · IDTR and GDTR ·
ES.SEL and DS.SEL `[APM2 §15.5.1]`. Host **LDTR is explicitly not saved**, and the Vol.3
pseudo-code annotates the list with "host CR2 is not saved" `[APM3 §4 "VMRUN"]`.
NEXT_RIP is the rIP of the instruction *following* VMRUN — where the host resumes on
`#VMEXIT`. The save area is architecturally opaque: implementations may keep part or all
of the state in hidden on-chip storage, and software must not rely on its format or
contents `[APM2 §15.5.1]`.

**Step 2 — load guest state** from the VMCB state-save area: CS and rIP (including hidden
CS state), RFLAGS and RAX, SS and RSP (including hidden SS state), CR0/CR2/CR3/CR4/EFER,
`INTERRUPT_SHADOW`, IDTR and GDTR, ES and DS (including hidden state), DR6 and DR7,
`V_TPR`, `V_IRQ`, and CPL `[APM2 §15.5.1]`. CPL is **not** always taken from the VMCB: it
is forced to 0 in real mode and 3 in virtual-8086 mode. Writing the paging-related
control registers **does not flush the TLB**, because address spaces are switched rather
than reused. If the guest is in PAE and nested paging is *not* enabled, VMRUN also reads
the four PDPEs from the newly loaded CR3 and reserved bits set there cause a `#VMEXIT`.
The Vol.3 pseudo-code adds `gPAT` to the load set when `NP_ENABLE = 1`, leaving the host
`hPAT` unchanged `[APM3 §4 "VMRUN"]`.

**Step 3 — control information, TLB command, GIF.** VMRUN also reads control fields that
are mostly not written back on `#VMEXIT` because they cannot change during guest
execution: `TSC_OFFSET`, the virtual-interrupt description fields, `V_INTR_MASKING`, the
ASID, the TLB-flush control and the intercept vectors `[APM2 §15.5.1]`.

**The ordering is explicit in the Vol.3 pseudo-code** `[APM3 §4 "VMRUN"]`:

1. **guest-state consistency checks** run first (failure → `#VMEXIT(VMEXIT_INVALID)`);
2. then the command stored in `TLB_CONTROL` is executed;
3. then **`GIF` is set to 1**;
4. and only then is the injected event delivered or the first guest instruction fetched.

Setting `GIF` to 1 is part of VMRUN, and the architecture assumes VMM software cleared
`GIF` some time before executing VMRUN so that the state switch is atomic
`[APM2 §15.5.1]`. An event in `EVENTINJ` is delivered unconditionally before the guest's
first instruction `[APM2 §15.20]`.

**EFLAGS around the boundary.** On the host side VMRUN behaves like an ordinary
instruction: RF suppresses an instruction-breakpoint match on the VMRUN itself, TF causes
a `#DB` trap *after* the VMRUN completes (i.e. after the `#VMEXIT`), and completing VMRUN
clears host EFLAGS.RF. On the guest side a loaded RF = 1 suppresses an instruction
breakpoint on the **first** guest instruction, and a loaded TF = 1 produces the trace trap
after that first instruction completes rather than between VMRUN and it. Host EFLAGS have
no effect on the guest and vice versa `[APM2 §15.5.1]`. On exit from the guest the
internal intercept registers are cleared, so no host operation is intercepted.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### vmrun-consistency-checks
**Routed to:** `04-world-switch.md` §4.2 — right first time

**Answer:**
VMRUN performs consistency checks on guest state and `#VMEXIT` performs the appropriate
subset of the same checks on host state; an illegal guest-state combination produces a
`#VMEXIT` with error code `VMEXIT_INVALID`, exit code `−1` `[APM2 §15.5]`. The checks run
**first**, before the TLB command and before `GIF` is set (see vmrun-ordering).

**The twenty enumerated conditions of §15.5** `[APM2 §15.5]`:

| # | Illegal state combination |
|---|---|
| 1 | `EFER.SVME` is zero |
| 2 | `CR0.CD` is zero and `CR0.NW` is set |
| 3 | `CR0[63:32]` are not zero |
| 4 | Any MBZ bit of CR3 is set |
| 5 | Any MBZ bit of CR4 is set |
| 6 | `DR6[63:32]` are not zero |
| 7 | `DR7[63:32]` are not zero |
| 8 | Any MBZ bit of EFER is set |
| 9 | `EFER.LMA` or `EFER.LME` non-zero and the processor does not support long mode |
| 10 | `EFER.LME` and `CR0.PG` both set and `CR4.PAE` zero |
| 11 | `EFER.LME` and `CR0.PG` both non-zero and `CR0.PE` zero |
| 12 | `EFER.LME`, `CR0.PG`, `CR4.PAE`, `CS.L` and `CS.D` all non-zero |
| 13 | The VMRUN intercept bit is clear |
| 14 | The MSR or IOIO intercept table extends to a physical address at or above the maximum supported physical address |
| 15 | Illegal event injection |
| 16 | ASID is equal to zero |
| 17 | Any reserved bit is set in `S_CET` |
| 18 | `CR4.CET = 1` when `CR0.WP = 0` |
| 19 | `CR4.CET = 1` and `U_CET.SS = 1` when `EFLAGS.VM = 1` |
| 20 | Any reserved bit set in `U_CET` (SEV-ES only) |

Condition 20 is asymmetric: VMRUN produces `#VMEXIT(INVALID)` while `#VMEXIT` instead
forces the reserved `U_CET` bits to zero. Condition 13 means a VMM **cannot decline to
intercept VMRUN**, which is what makes nested SVM interceptable at all.

**How to express the CR4 and EFER checks in your own validator — test MBZ, not a mask.**
Conditions 5 and 8 are stated by the current manual as "**any MBZ bit of CR4 is set**" and
"**any MBZ bit of EFER is set**". The fixed-mask forms `CR4[63:11]` and `EFER[63:15]` come
from the 2005-era SVM manual, are superseded, and appear nowhere in Rev 3.45 — **CR4 bits
11, 12, 16–18 and 20–23 and EFER bits 15, 17, 18 and 21 are architecturally defined
today**, so the fixed masks would reject legal guest state `[APM2 §15.5]`. `errata.md`
E05 records the same correction and adds the discipline: *read the rule, not the
constant* — the enumeration above is illustrative and moves as AMD defines bits (the CR4
range was itself corrected from 20–24 to 20–23 on 2026-09-21, because Figure 3-7 prints
CR4 bits 63:24 as Reserved, MBZ).

**The negative list — legal states that look illegal** `[APM2 §15.5.1]` `[APM2 §15.19]`:
a guest rIP outside the CS limit, or non-canonical in long mode, is **not** a consistency
failure — VMRUN loads it and a `#GP` is delivered *inside the guest*. `CR0.PE = 0` with
`CR0.PG = 1` (paged real mode) is explicitly legal to load; its intended use is a CPL-0
guest with page faults intercepted and a shadow page table, and running it *without*
intercepting `#PF` is undefined behaviour. Checking is also not uniform: `TLB_CONTROL`
encodings other than `00h`, `01h`, `03h` and `07h` are reserved but **no consistency
check covers them** (`C:medium`).

**Where the rest of the `VMEXIT_INVALID` conditions live.** §15.5's list is not the only
source. Also defined elsewhere: an IOPM or MSRPM whose last byte reaches the maximum
supported physical address, a guest ASID of zero, `NP_ENABLE = 1` with `hCR0.PG` cleared,
x2AVIC mode enabled without AVIC Enable, and `AVIC_PHYSICAL_MAX_INDEX` above 255 in
xAVIC or above 511 in x2AVIC when `Fn8000_000A_ECX[x2AVIC_EXT]` (bit 6) is 0
`[APM2 §15.10.1]` `[APM2 §15.11]` `[APM2 §15.25.1]` `[APM2 §15.25.3]` `[APM2 §15.29.4]`.
Illegal event injection adds: a reserved `EVENTINJ.TYPE`, and `TYPE = 3` with a vector
that is not an exception — a category that explicitly includes vector 2 `[APM2 §15.20]`.

Two extras a validator should model: VMRUN and `#VMEXIT` **canonicalize** (sign-extend to
bit 63) every loaded segment-register base, `SSP`, `ISST_ADDR` and `PL0_SSP`–`PL3_SSP`
`[APM2 §15.5]`; and on processors supporting clean fields the **final merged hardware
state** is used for the checks, which may include state from fields marked clean if the
processor chose to ignore the indication — so a stale clean bit can surface here as a
`−1` exit `[APM2 §15.5]`.

**Confidence:** high, except the `TLB_CONTROL` gap which the chapter marks `C:medium`.

---

### gif-stgi-clgi-vgif
**Routed to:** `04-world-switch.md` §4.6 (instruction side and Table 15-10) **plus**
`07-virtual-interrupts-avic.md` §7.3 (mechanism side and vGIF) — two chapters, both named
by SKILL.md's routing table ("GIF, STGI/CLGI" → `04`; "vGIF" → `07`), and `04` §4.6's
"Where the mechanism side lives" hands over explicitly. Right first time in both.

**Answer:**
GIF is a single bit that makes the world switch atomic and is the only thing standing
between a half-loaded VMM and an NMI. It controls whether interrupts and other events can
be taken; **STGI sets it, CLGI clears it** `[APM2 §15.17]`.

**What GIF = 0 does to pending events — three distinct behaviours, not one**
`[APM2 Table 15-10]`:

| Source | `GIF == 0` |
|---|---|
| INIT, NMI, external SMI, INTR and vINTR | **Held pending** until `GIF == 1` |
| Debug exception/trap from a breakpoint-register match; internal (I/O-trapping) SMI | **Ignored and discarded** |
| RESET; debug trace trap due to `EFLAGS.TF`; A20M; non-architecturally-visible signals (STPCLK, IGNNE toggle, ECC scrub) | **Normal operation** |
| Machine check | Held pending until `GIF == 1` **if the implementation can**, otherwise shutdown |
| `#SX` | "n/a" — structurally, not an omission |

The `#SX` row is "n/a" because `#SX` is caused only by a redirected INIT and the
redirection happens only when `GIF == 1`; with GIF = 0 the INIT is simply held
`[APM2 Table 15-10]` `[APM2 §15.28]`. The *held vs. discarded* asymmetry is the whole
point of the flag: the events that must not be lost are queued, the ones that would be
meaningless afterwards are dropped.

**Instruction side.** `CLGI` raises `#GP` when CPL ≠ 0, is recognised only in protected
mode, and raises `#UD` when `Fn8000_0001_ECX[SVM] = 0` or `EFER.SVME = 0`
`[APM3 §4 "CLGI"]`. `STGI`'s `#UD` condition is deliberately **weaker**: it raises `#UD`
on `EFER.SVME = 0` only if **both** SVM-Lock is unavailable
(`Fn8000_000A_EDX[SVML] = 0`) **and** the device exclusion vector is unavailable
(`Fn8000_0001_ECX[SKINIT] = 0`); STGI still requires CPL 0 and protected mode
`[APM3 §4 "STGI"]`. The reason is that STGI belongs to the SKINIT/DRTM story as well as
the SVM one — `Fn8000_0001_ECX[12]` is documented as "SKINIT and STGI are supported",
explicitly independent of `MSRC000_0080[SVME]` `[APM3 App.E]`.

**VMRUN sets GIF = 1** as step 3 of the entry sequence, and the architecture assumes the
VMM cleared GIF some time beforehand so the switch is atomic `[APM2 §15.5.1]`; `#VMEXIT`
clears GIF again `[APM2 §15.6]`.

**What vGIF changes.** Virtual GIF is enumerated by `CPUID Fn8000_000A_EDX[VGIF]` = bit
16 and enabled by **`VGIF_EN`, bit 25 of the word at offset 60h**; the virtual flag
**`VGIF` itself is bit 9** of the same word, loaded on VMRUN and saved on `#VMEXIT`
`[APM2 §15.33.2]`. It changes *which* interrupt path the flag gates: **`VGIF` gates the
virtual interrupt path** (virtual interrupts are masked when `VGIF` is 0 and may be taken
when it is 1) **while the real GIF continues to gate the physical one** `[APM2 §15.33.2]`.
Operationally the win is that, with Virtual GIF enabled and the STGI/CLGI intercepts
clear, **the guest executes `STGI` and `CLGI` itself** and they set or clear `VGIF` with
no `#VMEXIT` `[APM2 §15.33.2]` — which is why vGIF is one of only two nested-
virtualization accelerators AMD defines (§15.33; see `15-nested-virtualization.md`).
Setting the STGI or CLGI intercept bits intercepts those instructions **regardless of
whether Virtual GIF is enabled** — vGIF does not override an explicit intercept
`[APM2 §15.33.2]`.

`VGIF` also participates in the virtual-interrupt and virtual-NMI eligibility tests: a
virtual INTR requires virtual interrupts to be enabled with `VGIF`, as does a virtual NMI
`[APM2 §15.21.4]` `[APM2 §15.21.10]`.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### event-injection-and-reinjection
**Routed to:** `05-exit-decoding.md` §5.5 — right first time

**Answer:**
`EVENTINJ` and `EXITINTINFO` point in opposite directions and **share one encoding, field
for field** `[APM2 §15.20]` `[APM2 Figure 15-5]` — which is exactly why re-injection is a
copy.

**Injecting.** Set bits in the VMCB `EVENTINJ` field before executing VMRUN; the guest
then takes the event **unconditionally before executing its first instruction**
`[APM2 §15.20]`.

| Bits | Field | Meaning |
|---|---|---|
| 7:0 | `VECTOR` | 8-bit IDT vector; ignored when `TYPE` is 2 (NMI) |
| 10:8 | `TYPE` | 0 external/virtual interrupt · 2 NMI · 3 exception · 4 software interrupt (INTn) |
| 11 | `EV` | Error Code Valid |
| 30:12 | — | Reserved, SBZ |
| 31 | `V` | Valid |
| 63:32 | `ERRORCODE` | Pushed when `EV` = 1 |

`TYPE` has **four** defined values — 0, 2, 3, 4; **value 1 is not among them**
`[APM2 Table 15-11]`.

*Six documented departures from "as if it had occurred normally"* `[APM2 §15.20]`:
(1) injected events are **not subject to intercept checks**, although secondary exceptions
raised during their delivery *are*; (2) an injected NMI does **not** block delivery of
further NMIs; (3) injecting an event impossible for the guest mode (AMD's example is
`#BR` in 64-bit mode) fails with no guest instruction executed and VMRUN exits
immediately with `VMEXIT_INVALID`; (4) `TYPE = 3` with vector 3 or 4 behaves like the trap
raised by INT3 or INTO, so the IDT descriptor's DPL is checked; (5) intercepted `#DB`
faults from a guest ICEBP **cannot be injected** (ICEBP does no DPL check whereas INTn
injection does) — the hypervisor must emulate it; and (6) two further conditions fail
VMRUN with `VMEXIT_INVALID`: a reserved `TYPE`, and `TYPE = 3` with a vector that is not
an exception — **explicitly including vector 2**, which is an NMI.

Two operational facts: **`EVENTINJ` is cleared in the VMCB on `#VMEXIT`**, so a hypervisor
that wants the same event injected again must rewrite it `[APM3 §4 "VMRUN"]`; and
`EVENTINJ` is on the explicitly-uncached list, so rewriting it needs no clean-bit
maintenance `[APM2 §15.15.3]`. Under SEV-ES, software interrupts and exception vectors 3
and 4 **may not** be injected, and attempting it fails VMRUN with `VMEXIT_INVALID`
`[APM2 §15.35.8]`.

**Re-injecting after an intercept during IDT delivery.** `EXITINTINFO` exists because an
intercept can occur while the guest is delivering an exception or interrupt through the
IDT, at which point the information needed to resume transparently may already be
unrecoverable — for an external interrupt the processor has **already performed the
interrupt-acknowledge cycle** against the PIC or APIC and the interrupt is no longer
pending anywhere `[APM2 §15.7.2]`. Its layout is identical to `EVENTINJ`'s, with `V`
(bit 31) meaning "the intercept occurred during IDT delivery". **All** intercepts record
this.

*The ordering the pseudo-code fixes* `[APM2 §15.7.3]`: an intercepted exception exits
**before** `EXITINTINFO` is written → the combined result is checked against the `#DF` and
shutdown intercepts next → `EXITINTINFO` is then set to the event being delivered → and
it is cleared (`V` = 0) once the exception has been successfully taken in the guest.

*The invariant a decoder should rely on:* when an exception triggers an intercept,
`EXITCODE` (and optionally `EXITINFO1`/`EXITINFO2`) always reflects the **intercepted**
exception, while `EXITINTINFO`, if valid, reflects the **prior** exception the guest was
attempting to deliver `[APM2 §15.7.3]`.

So the re-injection procedure is: on exit, if `EXITINTINFO.V` is set, copy `EXITINTINFO`
into `EVENTINJ` before the next VMRUN. With several exceptions in flight, `EXITINTINFO`
records the **aggregate of all of them except the last, intercepted one**; if the VMM
chooses to reflect the intercepted fault back to the guest rather than dismiss it, it must
combine the two events by x86 rules itself — `#DF` plus `#PF` becomes a triple fault or
shutdown `[APM2 §15.7.2]`. AMD's worked example: a guest `#GP` during whose delivery a
`#NP` arises resolves to `#DF`, and an intercepted `#PF` during the attempt to deliver
that `#DF` reports `#PF` in `EXITCODE` with `#DF` in `EXITINTINFO`.

*Classification trap:* despite the instruction names, events raised by **INT1/ICEBP
(F1h), INT3 (CCh) and INTO (CEh) count as exceptions**; only INTn (CDh) counts as a
software interrupt `[APM2 §15.7.2]` `[APM2 Table 15-1]`.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### nested-permission-combining
**Routed to:** `06-nested-paging.md` §6.2 ("Where nested semantics diverge from ordinary
paging") — right chapter, anchor landed short (row anchors §6.5 and §6.7–§6.8)

**Answer:**
This is the part that does **not** transfer from an EPT mental model: at the nested level
the processor does not simply repeat the guest's access type.

**What the nested level sees.**
- A table walk **of the guest's page tables** is always treated as a **user write** at the
  nested level: the page must be user-writable in the nested tables or `#VMEXIT(NPF)` is
  raised, and Accessed and Dirty bits are always set in every nested entry touched on the
  way `[APM2 §15.25.5]`. Read Only Guest Page Tables relaxes this — reported by
  `CPUID Fn8000_000A_EDX[ROGPT]` (bit 21), enabled per guest by bit 6 of VMCB offset 090h;
  with it on, guest page-table accesses count as writes at the nested level **only when an
  Accessed or Dirty update is actually required**, which lets a hypervisor map guest page
  tables into read-only nested pages `[APM2 §15.25.5]`.
- A walk for the guest **page** itself is likewise always a **user** access at the nested
  level, but is classified as a data read, data write or code read according to the
  guest's own access `[APM2 §15.25.5]`.

**The combining rules** `[APM2 §15.25.7]`:
- **Write:** a page is writable by the guest only if it is writable at **both** levels.
  `gCR0.WP` affects only the interpretation of the *guest* entry and can never make a
  nested-read-only page writable at any CPL; the host's `hCR0.WP` is **ignored entirely**
  under nested paging.
- **Execute:** a page is executable by the guest only if it is executable at **both**
  levels. NX is honoured only when `EFER.NXE` = 1, and **the host's EFER governs the
  nested level** — if the host's `EFER.NXE` is cleared, **all** nested mappings are
  executable at the nested level `[APM2 §15.25.7]`.
- **User/supervisor is asymmetric** — the rule people get wrong: a page is *user* in the
  guest only if the **guest** entry marks it user, but the **nested** entry must mark the
  page user for the guest to be allowed **any** access at all.
- **Global** is taken from the guest alone: the nested entry's G bit and the host's
  `hCR4.PGE` are irrelevant, and a global page is global only **within its ASID**.

**Page size.** When guest and nested entries map an address with different page sizes, the
TLB entry created matches the **smaller** of the two — AMD calls this **page splintering**
`[APM2 §15.25.9]`.

**Nested entries are ordinary AMD64 entries.** Because the nested hierarchy runs in the
host's paging mode, a nested page-table entry *is* an AMD64 page-translation-table entry
in the ordinary Chapter 5 format; what changes is not the encoding but the meaning of the
permission bits above `[APM2 Figures 5-19/5-21/5-23/5-29/5-34]`. A set reserved bit at the
nested level produces a `#VMEXIT(NPF)` with the RSV error bit rather than a guest `#PF`
`[APM2 §5.4.1]` `[APM2 §15.25.6]`.

The **order** in which these checks are applied (and therefore whether you get an `#NPF`
or a guest `#PF`) is §6.5 — see npf-check-ordering.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### memory-type-combining
**Routed to:** `06-nested-paging.md` §6.6 — right chapter (routing row names
"memory-type combining"), anchor landed short (row anchors §6.5, §6.7–§6.8)

**Answer:**
**With nested paging disabled** the processor behaves as though there were no guest PAT
register: the **host** PAT MSR determines the memory type for the current VM,
un-intercepted guest writes to the PAT MSR alter the **host** PAT MSR, and the hypervisor
is responsible for context-switching the PAT contents across world switches
`[APM2 §15.25.8]`.

**With nested paging enabled** the processor combines guest and nested memory types from
**six inputs** `[APM2 §15.25.8]`: the PCD/PWT/PATi bits in **both** the nested and the
guest entries; the PCD/PWT bits in nested CR3 and guest CR3; the guest PAT type; the host
PAT type; the MTRRs; and `gCR0.CD` together with `hCR0.CD`. The guest PAT lives in the
VMCB state-save area at byte offset **268h**, is swapped for the guest, is unused in host
mode, and is loaded by VMRUN **only when nested paging is enabled** `[APM2 Table B-2]`.

**The rule is two-stage, in this order** `[APM2 §15.25.8]`:
1. the **nested and guest PAT types combine into a "combined PAT type"** per Table 15-19;
2. that result **combines with the MTRR type selected by the *system* physical address**
   per Table 15-20;
and either `gCR0.CD` or `hCR0.CD` can disable caching outright.

Table 15-19 (guest PAT down the side, host PAT across) `[APM2 Table 15-19]`:

| Guest ↓ / Host → | UC | UC− | WC | WP | WT | WB |
|---|---|---|---|---|---|---|
| **UC** | UC | UC | UC | UC | UC | UC |
| **UC−** | UC | UC− | WC | UC | UC | UC |
| **WC** | WC | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | UC | UC | WP | UC | WP |
| **WT** | UC | UC | UC | UC | WT | WT |
| **WB** | UC | UC | WC | WP | WT | WB |

Table 15-20 (effective PAT down the side, MTRR across) `[APM2 Table 15-20]`:

| Effective PAT ↓ / MTRR → | UC | WC | WP | WT | WB |
|---|---|---|---|---|---|
| **UC** | UC | CD | CD | CD | CD |
| **UC−** | UC | WC | CD | CD | CD |
| **WC** | WC | WC | WC | WC | WC |
| **WC+** | WC | WC | WC+ | WC+ | WC+ |
| **WP** | UC | CD | WP | CD | WP |
| **WT** | UC | CD | CD | WT | WT |
| **WB** | UC | WC | WP | WT | WB |

**What happens to guest MTRRs: there is no hardware support for them.** The MTRRs are
referenced **only by system physical address**, and a VMM that must present MTRR behaviour
to a guest **simulates it by altering the memory types in the nested page tables**
`[APM2 §15.25.8]`. Relatedly, while CR0, CR3, CR4, EFER and PAT are replicated for host
and guest, **the MTRRs are not replicated at all** `[APM2 §15.25.2]`.

**Three mitigations for the guest/VMM type mismatch** `[APM2 §15.25.8]`: VMRUN and
`#VMEXIT` flush the write combiners; a memory type **WC+** exists which combines writes
like WC but also snoops every processor's caches, including self-snooping, so that
cacheable writes are observed; and when nested and guest types are incompatible with
respect to caching, the combining rules produce **WC+ instead of WC**.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### npf-check-ordering
**Routed to:** `06-nested-paging.md` §6.5 — right first time (`00-quickref.md` §0.2 sends
the `#NPF` symptom to `05` §5.3 for the bits and `06` §6.5 for the ordering; the question
asks for ordering, so one chapter). The exhaustive bit table is owned by
`05-exit-decoding.md` §5.2–§5.3, which I did not need for the ordering itself.

**Answer:**
Nested and guest faults are **not** interleaved arbitrarily. The walk has a defined order
and faults are generated in that order `[APM2 §15.25.6]`:

1. **Walk the guest page-table entries through the nested tables**, setting Dirty and
   Accessed bits in the *nested* tables as needed. **Any nested fault here produces
   `#VMEXIT(NPF)`.**
2. As the guest walk descends, **a not-present entry or a set reserved bit at any guest
   level produces a guest `#PF`**, with guest Accessed and Dirty bits set as needed.
   **Steps 1 and 2 repeat per guest level.**
3. Once the guest physical address is known, **check guest permissions** — any failure
   produces a **guest `#PF`**.
4. **Perform the final guest-physical → system-physical translation** — any fault here
   produces **`#VMEXIT(NPF)`**.

The dividing line: nested page faults are entirely a function of the **nested page table
and the VMM's processor mode**; guest faults are entirely a function of the **guest page
tables and the guest's processor mode**. A guest `#PF` is delivered to the guest as a
normal exception with no VMM involvement unless the VMM is intercepting `#PF`
`[APM2 §15.25.6]`.

**Where RMP checks sit: last.** **All RMP and VMPL checks happen *after* the page-table
and nested-page-table access checks and have lower priority than the existing paging
checks** `[APM2 §15.36.10]`. (The RMP machinery itself is owned by `14-sev-snp.md`.)

**What the exit carries.** Exit code **400h** (`VMEXIT_NPF`), described by AMD as a
host-level page fault under nested paging, with the error code in `EXITINFO1` and the
faulting guest physical address in `EXITINFO2` `[APM2 App.C]`. The low half mirrors a
`#PF` error code with nested meanings: bit 0 (P) 0 when the nested page was not present,
1 (RW) set when the nested-level access was a write, 2 (US) when it was a user access,
3 (RSV) when reserved bits were set in the corresponding nested entry, 4 (ID) when it was
a code read, 6 (SS) for a shadow-stack access `[APM2 §15.25.6]`. **Bits 32 and 33 say
*which* walk faulted** — bit 32 when the fault occurred translating the guest's **final**
physical address (step 4), bit 33 when translating the **guest page tables** (step 1) —
and bit 37 for a supervisor-shadow-stack-marked leaf when that feature is enabled
`[APM2 §15.25.6]`. SEV-SNP adds bit 31 (RMP), 34 (ENC), 35 (SIZEM) and 36 (VMPL)
`[APM2 §15.36.10]`; `errata.md` **E04** records that the widely circulated numbering is
off by one from bit 34 upward.

Two counter-intuitive consequences of the walk rules: host table walks for guest page
tables are **always reported as data writes**, so RW is set even for a guest instruction
fetch; and nested accesses performed by the MMU are treated as **user** accesses unless an
enabled feature overrides that `[APM2 §15.25.6]`.

Extensions add two more `#NPF` sources at the same points: with Supervisor Shadow Stack
enabled, a guest supervisor-shadow-stack access to a page not designated as such produces
`#VMEXIT(NPF)` with SS set, and execution from a designated page faults exactly as an
NX = 1 page would `[APM2 §15.25.14]`.

**Confidence:** high; all claims `C:high` `V:durable`. One caveat the skill flags itself:
`05-exit-decoding.md`'s open items record that **bit 37 is genuinely double-defined** in
Rev 3.45 (§15.25.6 and §15.36.10) with no reconciling text — a decoder must branch on
which feature is enabled.

---

### asid-allocation-and-exhaustion
**Routed to:** `06-nested-paging.md` §6.7 — right first time (also `00-quickref.md` §0.2:
"I ran out of ASIDs" → `06-nested-paging.md` §6.7)

**Answer:**
**What an ASID tags.** TLB entries are tagged with an Address Space Identifier, which
distinguishes different guest **virtual** address spaces when shadow page tables are used
and different guest **physical** address spaces when nested page tables are used
`[APM2 §15.16]`. Under nested paging an ASID is associated with the guest's *physical*
address space and is therefore **common across all of that guest's virtual address spaces
on a processor** — the opposite of shadow paging `[APM2 §15.25.1]`. **ASID 0 is reserved
for the host**, and the current ASID is 0 whenever the CPU is not inside a guest context
`[APM2 §15.16.1]`; "ASID is equal to zero" is in VMRUN's illegal-state list, so it
produces `#VMEXIT(VMEXIT_INVALID)` `[APM2 §15.5.1]`.

**How many there are.** Implementation-specific: **the value returned in EBX by
`CPUID Fn8000_000A` — the whole 32-bit register is the `NASID` field, not a subfield of
it** `[APM3 App.E]`. The skill deliberately gives no universal constant; you must read it
on the machine. When SEV is in use the ASID space is **partitioned**:
`CPUID Fn8000_001F_ECX` reports the number of encrypted guests supported and
`Fn8000_001F_EDX` the minimum ASID usable by a SEV guest without encrypted state
`[APM3 App.E]` (the SEV side is owned by `12-sev.md`). For context, `errata.md` E12 and
O1 record measured/AMD-published *SEV key-slot* counts — 509 on several Zen+/2/3 client
parts and on EPYC 7002, 15 on EPYC 7001, 1006 on "8004 & 9004" `[35]` — but those are SEV
key slots, not the general `NASID`, and E12 carries `C:medium`.

**Allocation discipline.** Whether the same ASID denotes the same address space on every
processor of a multiprocessor system is left entirely to the VMM, for nested and shadow
tables alike — nothing in the architecture ties an ASID to an address space globally
`[APM2 §15.25.1]`. Global page-table entries are global **only within an ASID** and never
across ASIDs when SVM is enabled, so a global mapping is not a way to share a translation
between guests `[APM2 §15.16]`.

**What happens when you run out — the one explicit recycling rule.** On implementations
without a way to selectively flush all translations of one specified ASID, **software may
flush a guest's TLB entries effectively by allocating it a *new* ASID and not reusing the
old ASID until the entire TLB has been flushed at least once** `[APM2 §15.16.1]`. That is
the basis of every generation-counter scheme in a real hypervisor, and it is a **global**
fallback: bumping the generation means every previously issued ASID must be considered
stale until a full TLB flush has happened on that logical processor, which is why the
recycle path is normally paired with `TLB_CONTROL` = 1 rather than with per-guest
invalidation (`C:medium`).

**The `TLB_CONTROL` encodings** (bits 39:32 of VMCB control offset 058h, ASID in bits
31:0 of the same qword) `[APM2 Table B-1]` `[APM2 §15.16.1]`: `00h` do not flush · `01h`
flush the entire TLB, all entries, all ASIDs, on VMRUN (AMD says legacy hardware only) ·
`03h` flush this guest's TLB entries · `07h` flush this guest's non-global TLB entries.
`TLB_CONTROL` has **no clean bit** and is re-read on every VMRUN; changing the ASID field
does require clearing clean bit 2 (`02-vmcb.md`).

**Two migration obligations.** For non-SNP-active guests the hypervisor must ensure the
VMSA cannot use stale TLB translations when a vCPU moves between logical processors; only
for SNP-active guests does hardware detect the move and manage the TLB itself
`[APM2 §15.36.15]`. And with xAVIC, when a core that last ran a *different* vCPU of the
same VM is used to run a vCPU with xAVIC enabled, the VMM must flush with
`TLB_CONTROL` = 3h **regardless of the respective ASID values**, or stale mappings may
misdirect virtual APIC accesses to the previous vCPU's backing page `[APM2 §15.29.4.3]`.

Note also that `INVLPGA` is **not** the tool here: its address operand is always
interpreted as a guest *virtual* address, and AMD states plainly that it does not provide
a means to invalidate a nested translation by guest physical address `[APM2 §15.16.2]`.

**Confidence:** high for the architecture; `C:medium` on the generation-bump/`TLB_CONTROL`=1
pairing, as the chapter marks it. The ASID *count* is a per-part CPUID read, not a
constant the skill supplies.

---

### gmet-mechanism
**Routed to:** `06-nested-paging.md` §6.9 — right chapter (routing row names GMET),
anchor landed short (row anchors §6.5, §6.7–§6.8)

**Answer:**
**What it is.** The Guest Mode Execute Trap extension lets a hypervisor cause nested page
faults when a guest attempts to **execute code at CPL 0, 1 or 2** from pages the
hypervisor designates `[APM2 §15.25.13]`.

**How it is turned on.** Presence is indicated by `CPUID Fn8000_000A EDX[17] = 1`, and it
is selected **per guest** by setting **bit 3 of VMCB offset 090h** — a bit that is ignored
on processors without the extension `[APM2 §15.25.13]`. (The VMCB field table is
`02-vmcb.md`.)

**How it works at the page-table level.** GMET does not add a new bit; it **changes how
the *nested* U/S bit is interpreted**. `NX = 1` still prohibits execution at any privilege
level. With GMET enabled and an **effective NX of 0**, an **effective U/S of 1** combined
with an execute access at **CPL 0, 1 or 2** generates `#VMEXIT(NPF)`, while effective
NX = 0 with effective U/S = 0 allows the code translation `[APM2 §15.25.13]`. AMD's
summary `[APM2 Table 15-21]`:

| nPT NX | nPT U/S | Guest user-mode code | Guest supervisor-mode code |
|---|---|---|---|
| 1 | X | No Execute | No Execute |
| 0 | 1 | Execute | **No Execute** |
| 0 | 0 | Execute | Execute |

The middle row is the whole feature: a page can be executable to guest user mode and
trappable for guest supervisor mode at the same time.

**Decoding a GMET fault.** A GMET violation is **not** flagged by a dedicated error bit —
software must work out whether a fault was NX-based or GMET-based by inspecting the
ordinary error code together with the faulting page's effective NX and U/S settings. AMD
footnotes that on some implementations a **GMET erratum may require the CPL to be read
from the guest VMCB instead of from the exit information** `[APM2 §15.25.13]`.

**Why it exists.** GMET is the hardware primitive underneath kernel-mode code-integrity
enforcement on AMD hosts — it is how a hypervisor makes supervisor-mode execution of a
page a trappable event without making the page non-executable to user mode. The Windows
HVCI side is `16-windows-platform.md` `[42]`.

**Confidence:** high for the architecture (`C:high` `V:durable`); the HVCI linkage is
marked **`C:medium`** in the skill and cited to `[42]`, not to the APM.

---

### avic-ipi-delivery-path
**Routed to:** `07-virtual-interrupts-avic.md` §7.4.4 → §7.5 → §7.6/§7.6.1 → §7.8.1 —
right chapter, anchor partly short (row anchors §7.1 and §7.8; §7.8 is the failure exit,
the delivery path itself is §7.6.1)

**Answer:**
Preconditions: AVIC is enumerated by `CPUID Fn8000_000A_EDX[AVIC]` = bit 13, enabled per
virtual processor by **bit 31 of the word at offset 60h**, and **any guest configured to
use AVIC must also enable nested paging** `[APM2 §15.29.7]` `[APM2 §15.29.4.1]`. Enabling
AVIC implicitly disables the software path — `V_IRQ`, `V_INTR_PRIO`, `V_IGN_TPR` and
`V_INTR_VECTOR` are ignored on VMRUN.

**Step A — the guest writes ICRH.** Simply *allowed* through the permissions filter,
because writing ICRH has no immediate hardware side effect; the IPI is initiated by the
ICRL write `[APM2 §15.29.3.1]` `[APM2 Table 15-22]`.

**Step B — the guest writes ICRL.** The register-level permissions filter resolves this
as **Allow + accelerate**, but only when the **Message Type is Fixed *and* the Trigger
Mode is edge-triggered**; self and broadcast via the ICRL Destination Shorthand (DSH)
field are also supported, in both logical and physical APIC ID formats. **Every other IPI
type causes a `#VMEXIT`** `[APM2 §15.29.3.1]`.

**Steps C–H — AVIC's six-step hardware IPI delivery** `[APM2 §15.29.6.1]`:
1. If DSH is **01b (self)**: update the IRR in the backing page, signal a doorbell to
   self, and stop.
2. If DSH is non-zero **or** the destination field is FFh (broadcast), jump to step 4.
3. Otherwise **resolve logically addressed destinations through the Logical APIC ID
   Table**. That entry is `V` at bit 31, reserved 30:8, Guest Physical APIC ID at 7:0
   `[APM2 Table 15-24]`. Flat mode uses only the first 8 entries with byte offset
   `4 * log2(l_apic_id)`; cluster mode takes bits 7:4 as the cluster and 3:0 as the
   bit-encoded APIC index with offset `(16 * c) + 4 * log2(apic_ix)`. In **x2AVIC the
   Logical table is not used at all** — the logical ID is derived arithmetically as
   `Logical x2APICID = (X2APICID[19:4] << 16) | (1 << X2APICID[3:0])` `[APM2 §15.29.5.3]`.
4. **Look up the backing-page address in the Physical APIC ID Table**, indexed by guest
   physical APIC ID. The 64-bit entry is `V` at bit 63, `IR` (IsRunning) at bit 62,
   reserved 61:52, **Backing Page Pointer at 51:12**, and **Host Physical APIC ID at
   11:0 — not valid unless `IR` is set** `[APM2 Table 15-23]`.
5. **For every valid destination, atomically set the IRR bit in that destination's backing
   page**, check IsRunning, and **if set, send a doorbell** using the host physical core
   number from the table entry.
6. If any destination was **not** scheduled on a physical core, cause a `#VMEXIT`.

**The doorbell.** The programming interface is the **Doorbell Register, MSR
`C001_011Bh`**: bits 7:0 the destination Physical APIC ID, bits 63:8 Reserved MBZ; writing
it sends the signal, and **any attempt to read it raises `#GP`**
`[APM2 Figure 15-22]` `[APM2 §15.29.8.2]`. `WRMSR`'s serializing semantics are relaxed for
it `[APM3 §4 "WRMSR"]`.

**Step I — the target consumes it.** A doorbell delivered to a running guest is recognized
**whether or not the interrupt can be injected immediately**; on the next VMRUN the
delivery mechanism **re-reads the IRR in the backing page**, finds the highest-priority
pending interrupt and injects it if masking and priority allow. VMRUN itself re-evaluates
the APIC state in the backing page on guest entry and recognizes any doorbell received
during VMRUN processing immediately after entering the guest
`[APM2 §15.29.8.2]` `[APM2 §15.29.8.3]`.

**Where it falls off the accelerated path.** Three logical-lookup conditions each cause
`#VMEXIT`: an invalid entry (`V` clear), a valid entry whose Guest Physical APIC ID is
greater than 255 (xAVIC), and a valid entry containing an invalid backing page pointer. At
the physical-table lookup the rule differs by addressing: for **directed** interrupts an
invalid entry causes `#VMEXIT`, while for **broadcast** IPIs invalid entries are simply
ignored `[APM2 §15.29.6.1]`. The exit is **401h `AVIC_INCOMPLETE_IPI`**, with payload 1
carrying ICRH in bits 63:32 and ICRL in 31:0, and payload 2 carrying `ID` in 63:32 and an
`Index` in 11:0 meaningful only for `ID` 1–3 `[APM2 Tables 15-25/15-26]`. `ID` has **six**
values, 0–5: 0 invalid interrupt type, 1 IPI target not running, 2 invalid IPI target,
3 invalid backing page pointer, 4 invalid IPI vector (VEC < 16), 5 un-accelerated IPI
(Secure AVIC, DSH not Self) `[APM2 Table 15-27]`.

**Two structural facts worth carrying.** There is one backing page per virtual processor
but **one Physical APIC ID Table and one Logical APIC ID Table per virtual machine**, so
the two table pointers hold the same value in every VMCB of the VM `[APM2 §15.29.5.2]`.
And AVIC hardware walks the nested page table **to check permissions only** — it does not
use the system physical address from the leaf entry, taking the address from the
`AVIC APIC_BACKING_PAGE` pointer in the VMCB (offset 0E0h) instead `[APM2 §15.29.3]`.
With xAVIC, scheduling a vCPU on a core that last ran a different vCPU of the same VM
requires `TLB_CONTROL` = 3h regardless of ASID values `[APM2 §15.29.4.3]`.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### vnmi-virtualization
**Routed to:** `07-virtual-interrupts-avic.md` §7.2.3 (with the bit layout from §7.1.1,
same chapter) — right chapter, anchor landed short (row anchors §7.1 and §7.8; §7.1.1 did
supply the bit positions)

**Answer:**
**Enumeration and enable.** NMI Virtualization is enumerated by
`CPUID Fn8000_000A_EDX[VNMI]` = **bit 25** `[APM3 App.E]`. It is enabled by setting
**`V_NMI_ENABLE`, bit 26 of the word at offset 60h**, and it **requires the NMI intercept
bit to be set**: running a guest with `V_NMI_ENABLE` and no NMI intercept produces
`#VMEXIT(INVALID)` `[APM2 §15.21.10]`.

**What you must configure**, from the offset-60h layout `[APM2 Table B-1]`:
`V_NMI` at **bit 11** (non-zero ⇒ a virtual NMI is pending), `V_NMI_MASK` at **bit 12**
(non-zero ⇒ virtual NMIs are masked), `V_NMI_ENABLE` at **bit 26**; `VGIF` is bit 9 and
`VGIF_EN` bit 25. So the hypervisor asserts a virtual NMI by setting `V_NMI`, and reads
`V_NMI_MASK` back to know whether the guest is still inside one.

**What changes once it is on.** The **NMI intercept then applies to *physical* NMIs only,
not to virtual ones** `[APM2 §15.21.10]` — which is the point: the hypervisor keeps the
intercept for real NMIs while the guest's own NMI state machine runs in hardware.

**The delivery state machine, in order** `[APM2 §15.21.10]`:
1. The processor takes a virtual NMI when **virtual NMIs are not masked**, **virtual
   interrupts are enabled with `VGIF`**, and **the processor is not in an interrupt
   shadow**.
2. On recognition it **clears `V_NMI` and sets `V_NMI_MASK` *before* the IDT is accessed**.
3. **`V_NMI_MASK` is cleared when the guest completes an `IRET`** — and also when a
   `#VMEXIT` occurs while the virtual NMI is being delivered, in which case
   **`EXITINTINFO` is set appropriately and `V_NMI_MASK` is saved as 0**, so the
   hypervisor can re-inject without double-masking.
4. **Physical NMI takes priority over virtual NMI**, mirroring the INTR rule.

**Interaction with `EVENTINJ`.** When NMI Virtualization is enabled and `EVENTINJ` is used
to inject an NMI, **VMRUN sets `V_NMI_MASK` in the guest state** — the injected NMI
therefore participates in the virtualized masking state machine rather than bypassing it
`[APM2 §15.21.10]`. (Note the contrast with the general injection rule that an injected
NMI does not block further NMIs `[APM2 §15.20]`; with vNMI the masking state is what
blocks them.)

**Confidence:** high; all claims `C:high` `V:durable`.

---

### io-page-table-walk
**Routed to:** `09-iommu-page-tables.md` §9.1 — right chapter, anchor landed short (row
anchors §9.6, the `IO_PAGE_FAULT` walkthrough)

**Answer:**
The host (v1) format is a generalisation of AMD64 long-mode paging with **two additions
the processor does not have**: a level field in every directory entry, which lets a walk
**skip** levels, and a page-size override in the translation entry, which lets one entry
describe a page that is not a power-of-512 multiple of 4 Kbytes.

**Structure.** A multi-level tree of 4-Kbyte tables indexed by 9 virtual-address bits per
level, holding 8-byte entries `[IOMMU 3.11 §2.2.3]`. **An entry is a page translation
entry (PTE) when its Next Level field is `0h` or `7h`, and a page directory entry (PDE)
for every other Next Level value — there is no separate type bit** `[IOMMU 3.11 §2.2.3]`.
The architecture produces at most a 52-bit system physical address, so SPA bits 63:53 are
always zero.

**The level parameter table** `[IOMMU 3.11 Table 15]`:

| Level | VA bits indexing the table | Default page size of a translation entry |
|---|---|---|
| 6 | 63:57 (7 bits) | — |
| 5 | 56:48 | 2^48 |
| 4 | 47:39 | 2^39 |
| 3 | 38:30 | 2^30 (1 GB) |
| 2 | 29:21 | 2^21 (2 MB) |
| 1 | 20:12 | 4096 |

**The walk, in order** `[IOMMU 3.11 §2.2.3]`:
1. Compare the device virtual address against the **root table's level**. A non-zero bit
   above the range that level selects **terminates the walk with `IO_PAGE_FAULT`**, and so
   does a non-zero bit in any virtual-address range belonging to a **skipped** level.
2. Read the entry. PR = 0 ⇒ not present (the remaining 63 bits are ignored). PR = 1 with
   Next Level ∉ {0h, 7h} ⇒ PDE: follow Next Table Address[51:12] to the level named by
   Next Level, which may be **lower than the current level minus one** — that is the skip.
3. Accumulate permissions as you go: **`IW`(62) and `IR`(61) are ANDed cumulatively down
   the walk together with the Device Table entry's own IW and IR, and the IW/IR of any
   *skipped* level are treated as 1** `[IOMMU 3.11 Table 17]`.
4. Terminate at a PTE (Next Level 0h or 7h) and take Page Address[51:12] plus the offset
   implied by the page size.

**What aborts a walk** `[IOMMU 3.11 §2.2.3]` `[IOMMU 3.11 Table 18]`: a non-zero reserved
bit in any entry; a Next Level field **greater than or equal to the level of the table the
entry was fetched from**; a PDE Next Level exceeding the device's `DTE[Mode]`; a Next
Level above the bound set by `EFR[HATS]`; and a translation entry whose physical address
is **not aligned to the page size that level implies**.

**How to get a page size other than the level default.** **Set `NextLevel = 7h` in a
translation entry.** The page size is then determined by **the position of the first zero
bit in the page address starting from bit 12**, and the resulting size must be **larger
than the level's default and smaller than the default of the next higher level**
`[IOMMU 3.11 §2.2.3]`. Address bits 51:32 can encode page sizes above 4 Gbytes and bits
63:52 are zero-extended; two extremes are called out — a level-6 entry with page address
`7_FFFFh` covers the entire cache, while `F_FFFFh` is undefined `[IOMMU 3.11 Table 14]`.

**The catch: an oversize page requires the PTE to be *replicated*.** The low
virtual-address bits that now index inside the enlarged page can no longer uniquely index
the page table, so **for a 32-Kbyte page the level-1 PTE must be repeated 8 times, leaving
64 unique PTEs in a 4-Kbyte table** `[IOMMU 3.11 §2.2.3]`.

**Other entry semantics** `[IOMMU 3.11 Table 17]`: `FC`(60) Force Coherent decides the
source of the upstream coherent attribute for untranslated DMA (1 = the IOMMU sets it,
0 = pass through the originating request's state), and the result is returned to an ATS
requester as the No-snoop bit. `U`(59) is passed in an ATS response for a GPA-to-SPA
translation only. `A`(5) is set on first read or write only when `EFR[HDSup]` = 1 and
`DTE[HAD]` is 01b or 11b; `D`(6) on first write only when `EFR[HDSup]` = 1 and
`DTE[HAD]` = 11b; **neither is ever cleared by the IOMMU**. PTE bits 58:57 are the Page
Migration State field when `EFR2[TMPMSup]` = 1 and `Control[TMPMEn]` = 1.

Caching: AMD **strongly recommends but does not require** that an implementation cache at
least 4-Kbyte translations, and permits larger pages to be cached split into several
4-Kbyte entries `[IOMMU 3.11 §2.2.3]`. A nice corollary: because the Next Level fields
occupy bit positions the processor ignores, **one set of AMD64 long-mode tables can serve
both the CPU and the IOMMU** provided those fields are initialised for each entry's level.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### gcr3-pasid-translation
**Routed to:** `09-iommu-page-tables.md` §9.2 — right chapter, anchor landed short (row
anchors §9.6)

**Answer:**
**The gating.** Guest address translation exists only when `EFR[GTSup]` = 1, is armed
globally by `Control[GTEn]` and **per device by `DTE[GV]`**, and the depth of the GCR3
lookup is set by **`DTE[GLX]`** within the limit `EFR[GLXSup]`
`[IOMMU 3.11 Table 24]`.

**PASID → guest CR3, level by level** `[IOMMU 3.11 §2.2.6.3]`:
- **`GLX = 00b` (one level):** the DTE's GCR3 table root points at a single naturally
  aligned 4-Kbyte page holding **512 eight-byte entries, indexed by `PASID[8:0]`**. The
  IOMMU **ignores the upper PASID bits**.
- **`GLX = 01b` (two levels):** the DTE points at a **GCR3 level-2 table indexed by
  `PASID[17:9]`**, whose entries point at level-1 tables indexed by `PASID[8:0]`.
- **`GLX = 10b` (three levels):** the DTE points at a **level-3 table indexed by
  `PASID[19:18]`**, structurally identical to the level-2 table; the IOMMU ignores the
  unused remainder of that level-3 table.

The **GCR3 base pointer entry** at the bottom is: `V`(0), Reserved(2:1), Ignored(4:3) —
where the processor's PCD and PWT live, and which the IOMMU ignores — Reserved(11:5),
**Guest Page Table Pointer[51:12]**, Reserved(63:52). When `V` = 0 the whole entry is
ignored by hardware `[IOMMU 3.11 Table 26]`.

**How wide a PASID it can actually translate.** **9 bits with a one-level table, 18 with
two levels and 20 with three** — and **`EFR[PASmax]` separately bounds what the IOMMU can
handle internally, so both limits must be satisfied** `[IOMMU 3.11 Table 11]`. So the
practical ceiling is `min(GLX-implied width, EFR[PASmax])`, and 20 bits is the
architectural maximum from the GCR3 side.

**Two address-space subtleties.** Every GCR3 base pointer in a level-1 table, and every
table pointer in a level-2 or level-3 table, is a **guest physical address that the IOMMU
must itself translate through the host (v1) tables** `[IOMMU 3.11 §2.2.6.3]`. And the GCR3
table **root** pointer inside the Device Table entry is a **system** physical address when
`Control[GCR3TRPMode]` = 0, but a **guest** physical address — translated through the host
tables named by `DTE[Host Page Table Root Pointer]` — when it is 1; support is
`EFR2[GCR3TRPModeSup]` `[IOMMU 3.11 §2.2.6.3]`.

**What happens after the guest CR3 is in hand.** The guest page tables are **directly
compatible with the AMD64 long-mode format** and the IOMMU interprets PML5E, PML4E, PDPE,
PDE and PTE exactly as the processor does `[IOMMU 3.11 §2.2.6.5]`. The guest address size
is capped by `EFR[GATS]` and exceeding it generates an `IO_PAGE_FAULT`; with
`GATS = 01b` the start level is chosen per device by `DTE[GuestPagingMode]`, and a level-5
guest table is indexed by GVA bits 56:48 `[IOMMU 3.11 §2.2.6.4]`. Then **every guest
physical address produced along the way — including the table pointers themselves — is
translated GPA → SPA through the v1 tables**.

**Permissions across the two dimensions** `[IOMMU 3.11 §2.2.7.2]`: read and write
permission is the **AND of the guest page-table permission, the nested page-table
permission and the DTE's IR/IW bit**; **executable (NX) and user/supervisor permission are
ignored whenever the peripheral supplies a GPA or an SPA rather than a GVA**. NX
enforcement additionally requires `EFR[NXSup]` = 1 and applies to a request whose PCIe TLP
PASID prefix carries EXE; supervisor-page enforcement requires `EFR[USSup]` = 1 and is
governed by `Control[PrivAbrtEn]` `[IOMMU 3.11 §2.2.6.2]`.

**Invalidation discipline.** **IOMMU TLBs are *not* cleared when a GCR3 table entry
changes; software must issue an invalidation command** `[IOMMU 3.11 §2.2.6.3]`. More
generally, because the IOMMU must rewalk the guest tables whenever cached information says
"denied", software is **not** required to invalidate when it *promotes* guest privileges
or makes a not-present guest page present, but it **is** required to invalidate when it
demotes privileges or unmaps a page `[IOMMU 3.11 §2.2.7.3]`.

Also useful: several GCR3 entries may point at the same guest page table, which is how a
peripheral shares one guest address space between its default-PASID and non-zero-PASID
traffic under Guest I/O Protection `[IOMMU 3.11 §2.2.9]`.

**Confidence:** high; all claims `C:high` `V:durable`.

---

### msi-remapping-end-to-end
**Routed to:** `10-iommu-interrupt-remapping.md` §10.4 — right first time (also
`00-quickref.md` §0.2: "A passthrough device's interrupts never arrive" → §10.4). The CPU
side of the doorbell is `07-virtual-interrupts-avic.md` §7.6, which chapter 10 names and
which I had already opened for avic-ipi-delivery-path.

**Answer:**
**Step 0 — the interrupt address range is not translated.** Accesses to the interrupt
address range go through the **interrupt remapping** portion of the IOMMU, **not** through
address translation, so a transaction being processed as an interrupt has its
pretranslated/untranslated attribute ignored `[IOMMU 3.11 §2.1.4.2]`. That range is
**`FD_F800_0000h`–`FD_F8FF_FFFFh`**; the adjacent `FD_0000_0000h`–`FD_F7FF_FFFFh` is
reserved interrupt address space and a request there produces an
`INVALID_DEVICE_REQUEST` event `[IOMMU 3.11 Table 3]`. Software should not configure the
IOMMU such that an address translation can produce a special address such as this range.

**Step 1 — the message type decides which control applies.** With destination mode 0 and
`MMIO Offset 01A0h[NumIntRemapSup]` of 00b or 01b, the HyperTransport message-type field
routes the request to exactly one control `[IOMMU 3.11 Table 19]`: MT 0 (Fixed) and 1
(Arbitrated) → the device table entry and the IRTE; MT 2 → `SmiFLogEn`; MT 3, 4, 6 →
`NMIPass`; MT 5 → `InitPass`; MT 7 → `EIntPass`; MT 11 → `Lint1Pass`; MT 14 →
`Lint0Pass`; MT 8, 9, 10, 12, 13, 15 → target abort. With DM = 1 only MT 0–1 reach the
remapping tables unless `NumIntRemapSup = 01b` and `NumIntRemapMode = 01b`, in which case
MT 0–7 do and MT 8–15 are target aborted. The remapped path supports up to 512 interrupts
per function in every configuration except that last one with DM = 1, which supports up to
2K.

**Step 2 — index, read, rewrite.** Select the entry for that `DeviceID` in the device
table, then index the interrupt remapping table: **the interrupt table offset corresponds
directly to data bits 10:0 of the originating MSI message, so the IRTE index is
`MSI Data[10:0]`**, with hardware applying the stride for the 32-bit or 128-bit entry size
selected by the registers `[IOMMU 3.11 §2.2.5]`. After reading the entry the IOMMU builds
the new interrupt message address by **OR-ing `IRTE[23:2]` with bits 63:2 of the
HyperTransport interrupt address range base `FFFF_FFFD_F800_0000h`**
`[IOMMU 3.11 §2.2.5]`.

**Step 3 — with the guest virtual APIC enabled, the full sequence** is
`[IOMMU 3.11 §2.2.5.2]`: check `GASup`/`GAMSup`/`GAEn`/`GAMEn` → pick the IRTE size and
stride → if 32-bit, fall back to the basic path → select the DTE for that `DeviceID` →
index the IRTE with the incoming vector → **if `RemapEn` = 0, report an `IO_PAGE_FAULT`**
→ if `GuestMode` = 0, remap in the wide 128-bit layout → **if `GuestMode` = 1, post the
interrupt into the guest.**

**Posting into the guest vCPU's IRR** `[IOMMU 3.11 §2.2.5.2]`: bit index =
`IRTE[Vector] mod 32`; byte offset = `(IRTE[Vector] / 32) << 4`; **atomic set of one bit
at `IRTE[GuestVirtualAPICTableRootPointer] + 0200h + byte offset`** — that pointer
(IRTE bits 115:76) is the system physical address of the vCPU's APIC backing page.
Hardware may widen that read-modify-write: the atomic OR may use any power-of-two byte
width from 1 to 32 bytes, not exceeding 256 bits, with the divisor scaled accordingly.

**After the IRR bit is set, the IOMMU re-reads the IRTE** `[IOMMU 3.11 §2.2.5.2]`:
- with **`IsRun` = 0 and `GALogIntr` = 1** it writes a **GA log entry carrying `GATag`**
  and signals an interrupt (see ga-log-and-gappi);
- with **`IsRun` = 1** it **sends a guest APIC doorbell to the core named by
  `Destination`**, taken from the same memory read as `IsRun`.

**The CPU side of that doorbell** (`07-virtual-interrupts-avic.md`): the doorbell is
recognized whether or not the interrupt can be injected immediately, and on the next VMRUN
the delivery mechanism re-reads the IRR in the backing page, finds the highest-priority
pending interrupt and injects it if masking and priority allow `[APM2 §15.29.8.2]`. AMD's
CPU-side statement of the same flow is the six steps of `[APM2 §15.29.6.2]`, which add
that if the I/O virtualization hardware reads a Physical APIC ID Table entry whose `V` bit
is clear it **aborts the virtual interrupt delivery and logs an error**. Note also that
**AVIC hardware explicitly does not accelerate device interrupt delivery — that is the
IOMMU's job** `[APM2 §15.29.1]`, and conversely the IOMMU feature requires matching
APIC-virtualization support in the processor `[IOMMU 3.11 §2.2.8]`.

**Why this path is a security boundary, not just routing.** An interrupt is a posted write,
so a peripheral that can emit an arbitrary write to the interrupt address range can name an
arbitrary vector on an arbitrary CPU unless something checks it — and the page tables are
explicitly **not** in that path. **Interrupt remapping is the only check**: with `IV` = 1
and `IntCtl` = 01b fixed and arbitrated interrupts are forwarded **unmapped**; with
`IntCtl` = 00b they are target aborted; and **only `IntCtl` = 10b validates them against a
per-device table** `[IOMMU 3.11 Table 9]`. `RemapEn` = 0 is the per-vector deny — target
abort reported as `IO_PAGE_FAULT` — which is why a correctly sized table with most entries
disabled is the safe default rather than a short table `[IOMMU 3.11 §2.2.5.2]`.

**Confidence:** high; all claims `C:high` `V:durable` except the note about pre-3.11
revisions treating MT 0010b–1111b with DM = 1 as remappable, which is `C:medium`.

---

### ga-log-and-gappi
**Routed to:** `10-iommu-interrupt-remapping.md` §10.5 — right chapter (routing row names
"GA log semantics, GAPPI" and the chapter's `Owns:` line says it owns GA log **semantics**
while `08-iommu-architecture.md` §8.8 owns the **entry format**), anchor landed short (row
anchors §10.1–§10.3 and §10.4). Question asks what the log *tells* the hypervisor, so `08`
was not needed.

**Answer:**
**What it is telling you.** The GA log is a circular buffer in system physical memory
holding **virtual interrupt requests that could not be delivered because the target
virtual processor was not running**; each entry identifies the source by `DeviceID` and
the target by the **`GATag` software itself put in the IRTE** `[IOMMU 3.11 §2.7.1]`. The
IOMMU **never interprets the `GATag` — it only copies it back**, which is precisely what
lets a hypervisor pick any encoding it likes for vCPU identity `[IOMMU 3.11 §2.7.3]`.

**The crucial semantic:** the record is written when the IOMMU receives an interrupt for a
device whose IRTE has `GuestMode` = 1 and whose `IsRun` indicates the guest is not
currently running — **and the interrupt itself is still recorded in the virtual APIC
backing page**. So the log entry is **a notification that a pending interrupt needs the
hypervisor to schedule the target, not a record of a lost interrupt**
`[IOMMU 3.11 §2.7.3]`. The `IsRun` = 1 path needs no software at all; the log exists only
for `IsRun` = 0.

**Three possible outcomes for `IsRun` = 0**, chosen by IRTE and MMIO bits:
1. `GALogIntr` = 0 and no GAPPI — the IRR bit is set and **the hypervisor is not notified**;
2. `GALogIntr` = 1 — a GA log entry naming the device and the `GATag`, plus an MSI;
3. GAPPI — **no log entry**, a direct interrupt to a physical core instead.

**Overflow changes how you debug a missing interrupt.** GA log overflow does **not** drop
one entry and carry on — **it stops the log**: the overflow status bit is set, subsequent
guest virtual APIC event data is discarded, and logging stays disabled until software runs
the restart procedure. A hypervisor that does not handle overflow therefore **stops being
told about *any* undelivered guest interrupt, not merely the one that overflowed**
`[IOMMU 3.11 §2.7.1]`.

**What GAPPI changes.** When `MMIO Offset 0030h[GAPPISup]` = 1 and
`MMIO Offset 0018h[GAPPIEn]` = 1, guest interrupts to non-running guests **still update
the vAPIC backing-page IRR**, the **GA log write is suppressed** for `IsRun` = 0 when
`GALogIntr` = 0, and instead **a GAPPI interrupt is raised when all of the guest IRR bits
were clear before the last update** — that is, when the new interrupt is the *first one
pending* to that vCPU `[IOMMU 3.11 §2.2.5.4]`. So GAPPI converts "log an entry and make
the hypervisor drain a buffer" into "interrupt a core directly, once, on the
empty-to-non-empty edge".

The GAPPI interrupt is issued with **`Destination = IRTE[Destination]`,
`Vector = IRTE[GATag[7:0]]`, message type 0, destination mode 0 and `RQEOI = 0`**
`[IOMMU 3.11 §2.2.5.4]`. Two consequences:
- **Software must tolerate spurious GAPPIs.** AMD states that implementations may not be
  able to determine perfectly whether all IRR bits were previously clear.
- **`GATag` must be allocated with GAPPI in mind even on systems that intend to use the
  log**, because GAPPI reuses its low byte as the notification vector.

**Per-vector opt-out:** `MMIO Offset 01A0h[GAPPIDisSup]` = 1 together with
`IRTE[GAPPIDis]` = 1 suppresses the GAPPI interrupt **while still updating the
backing-page IRR** — a per-vector control rather than a per-IOMMU one
`[IOMMU 3.11 §2.2.5.4]`. `GAPPIDis` is meaningful only when `GuestMode` = 1 and
`MMIO Offset 0018h[GAPPIEn]` = 1, and is reserved when `GAPPIDisSup` = 0
`[IOMMU 3.11 Table 23]`.

Note for reprogramming: with `GAEn` = 1 and `GuestMode` = 1 the IOMMU **does not cache**
`IsRun`, `Destination`, `GALogIntr`, `GAPPIDis` or `GATag`, so changing any of them needs
no invalidation `[IOMMU 3.11 §2.2.5.2]`.

**Confidence:** high; all claims `C:high` `V:durable`. The log's **entry format** and its
plumbing (base register, head/tail pointers, shift-by-three full/empty arithmetic, restart
procedure) are owned by `08-iommu-architecture.md` §8.8 and were not needed here.

---

### c-bit-mechanics
**Routed to:** `11-memory-encryption.md` §11.3 and §11.4 (same chapter) — right chapter,
anchor landed short (row anchors §11.2, which is `Fn8000_001F`)

**Answer:**
**What it is.** The C-bit ("enCrypted bit") is the page-table attribute that selects
encryption for a page. **Its position is implementation-specific and must be read from
`CPUID Fn8000_001F_EBX[5:0]`** — in some implementations the bit used is a physical address
bit, and the APM's own example is address bit 47 `[APM2 §7.10.4]`. Setting it to 1 marks
the page encrypted in DRAM; clearing it to 0 leaves the page unencrypted. **It may be
applied to translation-table entries for any page size — 4 KB, 2 MB or 1 GB**
`[APM2 §7.10.4]`.

**It applies to the page tables too.** If the C-bit is set in a PML4 entry, the PDP table
it points to — and therefore every PDPE in that table — is loaded from encrypted memory
`[APM2 §7.10.4]`. One exception: **in legacy PAE mode, if the C-bit location falls in the
upper 32 bits of a page-table entry, the first-level (PDP) table cannot be located in
encrypted memory**, because CR3 is only 32 bits wide in 32-bit PAE mode
`[APM2 §7.10.6]`.

**Physical-address bit reduction.** On some implementations the processor's physical
address size is **reduced when memory encryption features are enabled** — the APM's worked
example is 48 → 43 bits — and the upper physical-address bits then become reserved; the
reduction present is reported in `Fn8000_001F[EBX]` `[APM2 §7.10.1]`. Bits that become
reserved are treated exactly like any other reserved page-table bit: a non-zero value in
one during address translation **generates a page fault**. Before setting
`SYSCFG[MemEncryptionModEn]`, software on such an implementation **must already be
executing from addresses whose upper physical-address bits are 0**, or it will fault
itself out of existence the moment encryption is enabled `[APM2 §7.10.2]`.

**It is not an address bit for range checks.** On implementations that reduce the physical
address size, memory range checks that decide memory type or DRAM-versus-MMIO — MTRR, TOM,
IORR — are performed using the **reduced** physical address size, and **the C-bit is not
considered a physical address bit and is masked by hardware for those checks**
`[APM2 §7.10.5]`. **Any page corresponding to an MMIO address must be configured with the
C-bit clear**; encrypted I/O pages are not allowed and an access with the C-bit set is
**ignored** `[APM2 §7.10.5]`.

**What you have to do when you change it on a page — three rules, in order.**
1. **Changing the C-bit does not re-encrypt the page's existing contents.** Any data
   present before the modification **becomes unintelligible afterwards**
   `[APM2 §7.10.6]`.
2. **In some hardware implementations coherency between the encrypted and unencrypted
   mappings of the same physical page is not enforced.** On such a system software **must
   flush the page from *all* CPU caches in the system before changing the value of the
   C-bit for that page** `[APM2 §7.10.6]`. The flush is **not** required when the
   implementation supports coherency across encryption domains, reported by
   **`Fn8000_001F_EAX[10]` (`HwEnfCacheCoh`)** `[APM2 §7.10.6]`.
3. **To keep the data, use AMD's encrypt-in-place algorithm** `[APM2 §7.10.8]`:
   (1) create two linear mappings X and Y of the same physical page — **X with C-bit 0 and
   the `WP` memory type, Y with C-bit 1 and the `WB` memory type**; (2) execute `WBINVD`
   on **all cores in the system**; (3) copy N bytes from X to a temporary buffer in
   conventionally-mapped memory, where **N equals the L1 cache line size reported by
   `Fn8000_0005[ECX]`**; (4) write those N bytes from the temporary buffer to Y;
   (5) repeat 3–4 until the whole page has been copied. **The temporary buffer is
   mandatory, not stylistic**: the initial cache refill of the line in step 4 decrypts it —
   corrupting it, since it is not yet encrypted — and step 4 is what restores the original
   contents `[APM2 §7.10.8]`.

**Under SEV.** The guest's C-bit is **masked out of the guest physical address before that
address is translated through the nested page tables** and reapplied to the resulting
system physical address, so the hypervisor's nested tables need not know which guest pages
are private `[APM2 §15.34.6]`. SEV also replaces the expensive all-core `WBINVD` with the
`VMPAGE_FLUSH` MSR, which is owned by `12-sev.md`.

**DMA.** DMA to SME-encrypted memory is supported and, from a device's standpoint, is an
ordinary memory access with the C-bit set; devices that cannot generate that address bit
(legacy 32-bit devices, in AMD's example) are accommodated by using the IOMMU to remap
device request addresses to addresses with the C-bit set.

**Confidence:** high for the C-bit and cache-coherence rules (`C:high` `V:durable`). The
**DMA paragraph is `C:medium`** and is cited to the **non-normative** AMD memory-encryption
white paper `[MEM-WP 70363 p.5]` `[MEM-WP 70363 p.6]`, because §7.10.5 covers MMIO and
range checks but **not** DMA to encrypted DRAM. Per-generation `CbitPosition` and
`PhysAddrReduction` values are version-bearing and live in `90-dated-landscape.md` — read
them at runtime.

---

### ghcb-establishment
**Routed to:** `13-sev-es-ghcb.md` §13.3 (with §13.5's MSR-protocol table and §13.2's
`#VC` contract, same chapter) — right first time; the routing row names §13.3, §13.4 and
§13.5 together.

**Answer:**
The whole sequence exists because of one constraint: **before long mode or 32-bit PAE
paging is established, all guest memory accesses are forced to use the guest's encryption
key, so the hypervisor would only see ciphertext in the GHCB. A guest must therefore avoid
any unplanned NAE event until it has discovered the encryption-bit position and marked the
GHCB shared** `[GHCB 2.04 §2.5]`. Everything below happens through the **MSR protocol**,
which is what a guest uses when it cannot yet write the GHCB page in the clear.

**0. The channel.** The guest sets the GHCB's guest physical address through **MSR
`C001_0130h`**; the value is saved and restored by hardware on VMRUN/`#VMEXIT` through
**VMCB offset `0A0h`**, and the MSR may be read or written **only in guest mode** — a
host-mode access raises `#GP` `[APM2 §15.35.7]`. **The hypervisor must not intercept
access to `C001_0130h`, or the guest cannot establish a GHCB at all**
`[GHCB 2.04 §2.3]`. Because the GHCB address is 4 KiB aligned, the low 12 bits are free
and carry the **`GHCBInfo`** request/response code; bits 63:12 are **`GHCBData`**
`[GHCB 2.04 §2.3]`. A guest may use only guest-source codes; a hypervisor must treat any
other value as an invalid request and **return to the guest without modifying the MSR**,
and must reply only with hypervisor-source codes `[GHCB 2.04 §2.3.1]`.

**1. Version negotiation and the encryption bit.** The hypervisor publishes a **SEV
Information** value (`GHCBInfo = 0x001`) in VMCB offset `0A0h`:
`GHCBData[63:48]` = maximum GHCB protocol version supported, `GHCBData[47:32]` = minimum,
`GHCBData[31:24]` = **the SEV page-table encryption bit number**, which the hypervisor
takes from `CPUID Fn8000_001F EBX[5:0]` `[GHCB 2.04 §2.3.1]`. AMD's examples: write
`0x0001_0001_2f00_0001` for a hypervisor supporting only version 1 with encryption bit 47,
and `0x0002_0001_3300_0001` for one supporting up to version 2 with encryption bit 51
`[GHCB 2.04 §2.4.1]`. The guest can also ask actively with **SEV Information Request**
(`0x002`). **A guest that cannot support any protocol version in the advertised range must
request termination** `[GHCB 2.04 §2.4.1]` — `GHCBInfo = 0x100`, with `GHCBData[15:12]`
the reason-code *set* and `[23:16]` the reason code within it; AMD owns set `0x0`
(`0x00` general, `0x01` GHCB protocol range not supported, `0x02` SEV-SNP features not
supported) — and should then execute an HLT loop or SHUTDOWN as a safeguard in case the
hypervisor does not comply `[GHCB 2.04 §2.3.1]`.
*SNP caveat:* an SEV-SNP guest should take the encryption-bit position from the
**firmware-validated CPUID page** rather than from the SEV Information MSR value
`[GHCB 2.04 §2.4.2]`.

**2. Hypervisor feature advertisement (protocol version 2+).** Request/response
`0x080`/`0x081`. The `FEATURES` bitmap is **deliberately limited to 52 bits so that it
fits in `GHCBData[63:12]` and can therefore be returned before any GHCB exists**
`[GHCB 2.04 §2.2]`. Nine bits are defined: 0 SEV-SNP · 1 SEV-SNP AP Creation ·
2 Restricted Injection · 3 Restricted Injection Timer · 4 APIC ID List · 5 Multi-VMPL ·
6 SEV-ES Page State Change Support · 7 SEV-TIO Support · 8 GHCB Unregister Support
`[GHCB 2.04 Table 1]`, with documented dependencies (AP Creation requires SEV-SNP;
Restricted Injection requires SEV-SNP and AP Creation; the Timer additionally requires
Restricted Injection; Multi-VMPL requires SEV-SNP and AP Creation).

**3. GPA registration — SEV-SNP only.** GHCB GPA registration is **supported and required
only for SEV-SNP guests**: such a guest **must use the Register GHCB GPA MSR request
(`0x012`/`0x013`) to establish its GHCB GPA before using a GHCB for a VMGEXIT for the
first time** `[GHCB 2.04 §2.3.2]`. It may first ask **Preferred GHCB GPA**
(`0x010`/`0x011`); the hypervisor answers with a GFN or with `0xf_ffff_ffff_ffff` meaning
"no preference", and if it supplies a GFN it **must guarantee the guest cannot otherwise
map that address and must make the page hypervisor-owned**, while the guest should verify
the address lies outside its known memory range. **Registering automatically unregisters
any previously registered GPA, and a hypervisor *must terminate* a guest that presents a
GHCB GPA not matching the currently registered value.** A hypervisor advertising
Multi-VMPL must allow **each VMPL to register its own GHCB GPA**. Unregistration
(`0x018`) was added in revision 2.04 and is gated by the GHCB Unregister Support feature.

**4. The page itself.** The GHCB is a **4,096-byte page the guest must map decrypted**
(shared) so that guest and hypervisor can both reach it. **Hardware never accesses the
GHCB directly, and consequently its format is defined by software rather than fixed by
hardware** `[APM2 §15.35.7]`. Its format **mirrors the SEV-ES VMSA save-state layout
through offset `0x3ff`** but the two are allowed to diverge — the GHCB lists only the
fields actually used, which is what limits how much guest state is exposed
`[GHCB 2.04 Ch.2]`.

**5. Only now does the ordinary `#VC` path work.** `#VC` is exception **vector 29**;
precise, contributory, fault-type, **cannot be masked**, and always generated by hardware
when an SEV-ES-enabled guest is running and an NAE event occurs `[APM2 §15.35.5]`. Its
**error code equals the `#VMEXIT` code of the causing event**, so the handler dispatches on
an exit code it would otherwise never see. The handler inspects the error code, copies the
register state it chooses into the GHCB, executes **VMGEXIT** to create an AE, and — after
the hypervisor's subsequent VMRUN — resumes at the instruction following VMGEXIT to copy
results back, leaving via IRET `[GHCB 2.04 §3.2]`. It is inadvisable for the hypervisor to
set the `#VC` intercept bit, since that would prevent the guest handling NAEs at all
`[APM2 §15.35.5]`. VMGEXIT's opcode is **`F2/F3 0F 01 D9` — both prefixes are
architectural** (`errata.md` E22; `[APM3 §4 "VMGEXIT"]`).

**Confidence:** high; all claims `C:high` `V:durable`. Scope note the chapter states:
SEV-ES is **server scope** — SEV is productised on EPYC, Zen 4 and later client parts
expose SME only.

---

### rmp-page-states
**Routed to:** `14-sev-snp.md` §14.3 — right chapter (routing row names "page states"),
anchor landed short (row anchors §14.1, §14.4, §14.11)

**Answer:**
The three states software usually talks about — hypervisor, guest-invalid, guest-valid —
cannot explain swapping, migration or guest context pages. **The firmware ABI defines
eleven**, and **a page's state is completely determined by the `Assigned`, `Validated`,
`ASID`, `Immutable`, `GPA` and `VMSA` fields of its RMP entry** `[SNP-ABI 1.59 §5.3]`.

| State | Assigned | Validated | ASID | Immutable | GPA | VMSA |
|---|---|---|---|---|---|---|
| Hypervisor | 0 | 0 | 0 | 0 | — | — |
| HV-fixed | 0 | 0 | 0 | 1 | — | — |
| Reclaim | 1 | 0 | 0 | 0 | — | — |
| Firmware | 1 | 0 | 0 | 1 | 0 | 0 |
| Context | 1 | 0 | 0 | 1 | 0 | 1 |
| Metadata | 1 | 0 | 0 | 1 | >0 | — |
| Pre-Guest | 1 | 0 | >0 | 1 | — | — |
| Guest-Invalid | 1 | 0 | >0 | 0 | — | — |
| Pre-Swap | 1 | 1 | >0 | 1 | — | — |
| Guest-Valid | 1 | 1 | >0 | 0 | — | — |
| Default | *page has no RMP entry* | | | | | |

`[SNP-ABI 1.59 Table 14]`. AMD spells the immutable hypervisor state **HV-fixed**.

**Transitions that are not possible:**
- **Default** — a page whose sPA indexes past `RMP_END` — has Hypervisor-page permissions
  but **cannot transition to any other state** `[SNP-ABI 1.59 Table 14]`.
- **HV-fixed pages cannot be created by `RMPUPDATE`.** Software uses `SNP_PAGE_SET_STATE`
  or `SNP_INIT_EX` with a range list, and **a page stays HV-fixed until the RMP is
  reinitialised** `[SNP-ABI 1.59 §5.3]`.
- **`RMPUPDATE` can invalidate a page but never validate one**, so the hypervisor **cannot
  manufacture a Pre-Swap or Guest-Valid page** without a guest `PVALIDATE` or firmware
  assistance `[SNP-ABI 1.59 §5.3.2]`. This asymmetry is what makes the scheme sound.
- **`PVALIDATE` cannot move Pre-Guest or Pre-Swap pages**, because both carry
  `Immutable = 1` `[SNP-ABI 1.59 §5.3.3]`.
- **Firmware pages:** because `Immutable` is set the hypervisor can neither write them nor
  alter their entry; **when the firmware hands one back it lands in Reclaim — the only
  exit from immutability** `[SNP-ABI 1.59 §5.3]`.
- **Context pages:** `SNP_GCTX_CREATE` is the **only** way to make one
  `[SNP-ABI 1.59 §5.3]`. A Metadata page is made by the firmware converting a Firmware
  page — making the GPA field non-zero.

**Validation is what determines Validated.** Every page assigned to a VM starts
unvalidated; a private-memory access to an unvalidated page raises `#VC`, and the guest
uses `PVALIDATE` to set the flag at startup and to clear it when handing memory back
`[APM2 §15.36.6]`. **Once a page is validated, any `RMPUPDATE` that unassigns, reassigns
or remaps it clears `Validated`**, so the next guest access faults instead of silently
reading substituted data — that is how hypervisor remapping becomes detectable
`[APM2 §15.36.6]`. Relatedly, when `RMPUPDATE` changes any of `ASID`, `GUEST_PA`,
`PAGE_SIZE` or `ASSIGNED`, hardware clears `VALIDATED` and the `VMSA` flag, grants **full
permissions to VMPL0** and zeroes the masks of VMPL1..VMPL(N−1), where N is
`Fn8000_001F_EBX[15:12]` `[APM3 §4 "RMPUPDATE"]`.

**Size transitions.** `PSMASH` converts a 2 MB entry into 512 4 KB entries **while
preserving the `Validated` bit** — consecutive `Guest_Physical_Address` values,
`Page_Size = 0`, every other field copied. **Doing the same conversion with `RMPUPDATE`
clears `Validated`** `[APM2 §15.36.11]`. The two page-size mismatches resolve in opposite
directions: a 4 KB `PVALIDATE` or `RMPADJUST` against a 2 MB entry takes `#VMEXIT(NPF)`
with `SIZEM` set so the hypervisor can smash and let the guest retry, while a 2 MB
`PVALIDATE` against 4 KB entries returns `FAIL_SIZEMISMATCH` so the guest can fall back to
512 individual calls `[APM2 Table 15-39]`. **Coalescing 4 KB pages back into a 2 MB page
has no x86 instruction** — it needs the guest or the AMD-SP, and the firmware exposes it
as `SNP_PAGE_UNSMASH` `[APM2 §15.36.11]` `[SNP-ABI 1.59 §8.26]`.

**Confidence:** high; all claims `C:high` `V:durable`. Open item the chapter names: the
**raw in-memory RMP entry layout is deliberately not reproduced** because the encoding is
not architectural — which is why `RMPREAD` exists.

---

### vmpl-and-rmpadjust
**Routed to:** `14-sev-snp.md` §14.5 (VMPL) and §14.4 (`RMPADJUST`) — same chapter, both
sections named by the routing row; right chapter

**Answer:**
**How VMPLs work.** VMPLs let a guest split itself into privilege domains **the hypervisor
cannot arbitrate**. Within one vCPU the levels are represented by **distinct VMSAs expected
to run mutually exclusively**, each tagged by the `VMPL` field in its VMSA; **VMPL0 is the
most privileged and numbering increases as privilege decreases** `[APM2 §15.36.7]`. Each
RMP entry carries **one permission mask per implemented level**; the number of levels is
`Fn8000_001F_EBX[15:12]` `[APM3 §4 "RMPUPDATE"]`.

**What is in a VMPL permission mask** `[APM2 Table 15-36]` — five bits, 7:5 reserved SBZ:

| Bit | Name | Meaning when 0 |
|---|---|---|
| 0 | Read (RD) | reads cause `#VMEXIT(NPF)` |
| 1 | Write (WR) | writes cause `#VMEXIT(NPF)` |
| 2 | Execute-User (XU) | execution at CPL 3 causes `#VMEXIT(NPF)` |
| 3 | Execute-Supervisor (XS) | execution at CPL < 3 causes `#VMEXIT(NPF)` |
| 4 | Supervisor-Shadow-Stack (SSS) | supervisor shadow-stack accesses cause `#VMEXIT(NPF)` |
| 7:5 | Reserved | SBZ |

The firmware reuses the identical encoding for the `VMPL1_PERMS`, `VMPL2_PERMS` and
`VMPL3_PERMS` parameters of `SNP_LAUNCH_UPDATE` `[SNP-ABI 1.59 Table 73]`. **Three
combinations are architecturally invalid** and make `RMPADJUST` fail — and the firmware
rejects the same three with `INVALID_PARAM` — namely `R==0 && Permissions[7:1]!=0`,
`SSS==1 && (XU==1 || XS==1)`, and `XS==1 && XU==0`
`[APM2 Table 15-37]` `[SNP-ABI 1.59 §8.18.2]`.

**How a guest hands permissions downward.** When the hypervisor assigns a page, **VMPL0
receives full permissions and every other level none**; the guest then uses **`RMPADJUST`
to hand out subsets downward**, and a vCPU at VMPL1 can alter **neither its own mask nor
VMPL0's** `[APM2 §15.36.7]`.

`RMPADJUST` (`F3 0F 01 FE`, APM Vol.3 Ch.4 p.447, caller = guest at any VMPL, enumerated
by `Fn8000_001F_EAX[SNP]`) takes the guest virtual address in **`RAX`**, the page size in
**`RCX[0]`**, and packs the rest into **`RDX`**: `[7:0]` `TARGET_VMPL`, `[15:8]`
`TARGET_PERM_MASK`, `[16]` `VMSA` (ignored unless the current VMPL is 0), `[63:17]`
reserved `[APM3 §4 "RMPADJUST"]`.

**The two rules that make it a one-way delegation** `[APM3 §4 "RMPADJUST"]`:
1. **`FAIL_PERMISSION` if `TARGET_VMPL <= CURRENT_VMPL`, or if the requested mask contains
   any bit absent from the caller's own mask** — a level can only delegate **downward** and
   can **never widen its own rights**.
2. **`#VC(PAGE_NOT_VALIDATED)` on an unvalidated page** — delegation is only possible on
   memory the guest has already accepted.

It is CPL0-only (`#GP(0)` otherwise) and 64-bit-mode-only (`#UD` otherwise), and raises
`#UD` when the guest is not SNP-active; its return-code set is `0 SUCCESS`, `1 FAIL_INPUT`,
`2 FAIL_PERMISSION`, `6 FAIL_SIZEMISMATCH` `[APM3 §4 "RMPADJUST"]`.

**`RMPQUERY` is the read side** — target level in `RDX[7:0]`, returning the mask in
`RDX[15:8]`, the `VMSA` flag in `RDX[16]` (zero unless the caller is at VMPL0) and the page
size in `RCX[0]` — and **it too refuses a target that is not numerically higher than the
caller**. It is enumerated separately by `Fn8000_001F_EAX[6]` and returns only `0` or `2`
`[APM3 §4 "RMPQUERY"]`.

**Switching level.** A guest changes the level its vCPU runs at by **asking the hypervisor
through the SNP Run VMPL event**; each level needs its own VMSA and may have its own GHCB,
and the hypervisor must update both system physical addresses before re-entering
`[GHCB 2.04 §4.1.14]`. `SEV_FEATURES` bit 2 (`ReflectVC`) is what lets a VMPL0 service
handle a lower level's `#VC`: it turns every event that would raise `#VC` into an Automatic
Exit with exit code `VMEXIT_VC`, saving the original event into the VMSA fields
`GUEST_EXITCODE`, `GUEST_EXITINFO1`, `GUEST_EXITINFO2`, `GUEST_EXITINTINFO` and
`GUEST_NRIP` `[APM2 §15.36.9]`.

Two bounds worth knowing: the **attestation path bounds levels at four in practice** —
`SNP_MSG_REPORT_REQ.VMPL` must be at least the current level and at most 3
`[SNP-ABI 1.59 §7.3]`; and `PVALIDATE` is **VMPL0-only** and raises `#GP(0)` at any other
VMPL `[APM3 §4 "PVALIDATE"]`.

**Confidence:** high; all claims `C:high` `V:durable`. Scope: SEV-SNP is **server scope** —
it has never been available on a client part.

---

### vmcb02-construction
**Routed to:** `15-nested-virtualization.md` §15.2 (Building vmcb02) and §15.3 (Merging
intercepts) — right chapter, anchor landed short (row anchors §15.5, which is the
"what AMD has instead of VMCS shadowing" section); §0.3 has no row for these, so I used the
chapter's `Owns:` line, which names "vmcb12/vmcb02 construction · intercept merging".

**Answer:**
**Three control blocks are in play and only one is ever handed to hardware**: **vmcb01**,
the VMCB with which L0 runs L1; **vmcb12**, the VMCB L1 prepared for L2, which L0 sees only
as a page of L1 guest-physical memory; and **vmcb02**, the VMCB L0 synthesises from the
other two and passes to `VMRUN`. *(The naming is a software convention from the Turtles
work and the Linux implementation, not AMD terminology — `[no-spec]` `[432][434]`.)*

**Why L0 cannot let hardware consume vmcb12 directly — two independent reasons**
`[APM2 App.B]`: every physical address in a VMCB control area is a **system** physical
address to hardware but an **L1 guest-physical** address in vmcb12; and the intercept
vectors in vmcb12 describe only what **L1** wants, not what **L0** needs.

**What L0 has to build.**
- **State.** `VMRUN` loads guest state from the VMCB and `#VMEXIT` writes back "the same
  subset of processor state as is loaded by the VMRUN instruction", so **the state halves
  of vmcb02 and vmcb12 can largely be copied through** `[APM2 §15.5.1]` `[APM2 §15.6]`.
- **Host state — `VM_HSAVE_PA` cannot be forwarded.** The host save area is
  architecturally opaque: implementations may store part or none of the host state there
  and keep the rest in hidden on-chip memory, and software "must not rely on the format or
  contents of the host state save area, nor attempt to change host state by modifying
  [it]". **L0 therefore cannot inspect the area L1 nominated, cannot hand L1's address to
  hardware, and must save and restore L1's host state itself** `[APM2 §15.5.1]`. L0 must
  also reproduce the `#GP` conditions when it emulates L1's write to `C001_0117h` — low 12
  bits non-zero, or address at/above the implementation's maximum supported physical
  address `[APM2 §15.30.4]`.
- **Every control field naming memory must be re-derived, not copied.** `IOPM_BASE_PA`
  addresses a 12-Kbyte I/O permissions map and `MSRPM_BASE_PA` a map of four 16-Kbit
  vectors in two contiguous pages, both accessed by physical address, and in vmcb12 those
  addresses are L1 guest-physical `[APM2 §15.10.1]` `[APM2 §15.11]`. The same applies to
  `N_CR3`, the AVIC table pointers and every other address-bearing field `[APM2 App.B]`.
  **L0 must validate the translated addresses before they reach vmcb02** rather than
  letting hardware reject them on L1's behalf: an out-of-range map makes `VMRUN` take
  `#VMEXIT(VMEXIT_INVALID)`.
- **Clean bits are a hint, never a guarantee.** L1, obeying the architecture, leaves L0 a
  summary of what it changed in vmcb12; but set bits are advisory in the hardware direction
  while cleared bits are always honoured, and nothing prevents a buggy or hostile L1 from
  leaving a bit set over a field it changed `[APM2 §15.15.1]`. The explicitly uncached
  list — `TLB_CONTROL`, the interrupt shadow, `EXITCODE`/`EXITINFO1`/`EXITINFO2`/
  `EXITINTINFO`/decode assist, event injection, and RFLAGS/RIP/RSP/RAX — **must be re-read
  from vmcb12 on every entry regardless of what the clean field says** `[APM2 §15.15.2]`.
  Because **the caching identity is the VMCB's physical address and explicitly not the
  ASID**, L0 must keep **one stable vmcb02 page per (L1 virtual CPU, vmcb12) pair** rather
  than recycling a scratch page, and must clear the whole clean field on first run, on a
  move to a different core and on a move to a different physical page
  `[APM2 §15.15]` `[APM2 §15.15.2]`.
- **Sync-back.** Hardware writes the exit description into the VMCB it was given, so
  `EXITCODE`, `EXITINFO1`, `EXITINFO2` and `EXITINTINFO` land in **vmcb02** and L0 must
  copy them into vmcb12 before reflecting. `EXITINFO1`/`EXITINFO2` are **undefined for
  intercepts that do not define them**, so a blind copy propagates garbage L1 may act on
  `[APM2 §15.6]`.

**How the two hypervisors' intercepts are combined — the union rule.** Intercepts are a
per-VMCB property evaluated for the guest currently running, and `#VMEXIT` clears them all,
so **there is no architectural notion of "the outer hypervisor's intercepts" persisting
behind the inner ones** `[APM2 §15.7]` `[APM2 §15.6]`. The composition L0 must perform is
therefore **a bitwise union**: **vmcb02's intercept vectors are vmcb01's OR vmcb12's, and
its permissions maps are the bitwise OR of L0's and L1's** — the result being the set of L2
operations that will trap to *either* hypervisor. **Nothing in the architecture computes
this; it is entirely L0's software** `[no-spec]` `[432][434]`. The union is not optional in
either direction: dropping an L0 intercept hands L2 a capability L0 withheld from L1;
dropping an L1 intercept silently changes L2's behaviour relative to running on bare L1.

**Intercepts L0 keeps for itself whatever vmcb12 says:** `VMRUN` is the architectural case
— the implementation **requires** that intercept always be set, which is also what makes
L1's `VMRUN` visible at all `[APM2 §15.9]`. `VMLOAD`/`VMSAVE` is the practical case: unless
virtualized VMLOAD/VMSAVE is available **and** enabled for L2 **and** nested paging is on,
L0 must keep both intercepts set so it can translate the guest-supplied VMCB address itself
`[APM2 §15.33.1]`.

**The reflect-or-handle path, in order:**
1. L2 executes something intercepted. Hardware takes `#VMEXIT` into vmcb02, **clears all
   intercepts, clears the GIF, resets the current ASID to 0** and returns control to L0 at
   the instruction after its `VMRUN` `[APM2 §15.6]`.
2. L0 reads `EXITCODE` from vmcb02 and asks whether L1 requested this intercept in vmcb12
   (or, for I/O and MSR accesses, in L1's permissions map).
3. If not, L0 handles it and re-enters L2 — one exit, and L1 never learns it happened.
4. If so, L0 copies the exit description and any in-flight event record into vmcb12, writes
   back the guest state L1 expects, and resumes L1 with a **synthesised `#VMEXIT`**.
5. L1 handles the exit, possibly writes vmcb12, and executes `VMRUN` again — which is
   intercepted, so L0 regains control, re-validates vmcb12, refreshes vmcb02 and re-enters
   L2.

Step 4 is the one with no analogue in single-level virtualization, and nothing in the
architecture assists it (`C:medium`). Two properties of `#VMEXIT` make step 1 safe and are
worth naming because a reader coming from Intel expects to arrange them: **the GIF is
cleared automatically** so L0's state switch is atomic without any instruction of its own,
and **all intercepts are cleared** so no residue of L1's policy applies while L0 runs
`[APM2 §15.6]`.

**Events in flight.** L0 must carry `EXITINTINFO` across into vmcb12 whenever it reflects,
or L1 loses the event `[APM2 §15.7.2]`. Injection runs the other way and has a trap in it:
events injected through `EVENTINJ` "are not subject to intercept checks", so **when L0
injects into L2 on L1's behalf it must apply L1's exception intercept bits in software
first** — hardware will not `[APM2 §15.20]`. Two further `EVENTINJ` rules survive: an event
impossible for the guest mode fails entry with `VMEXIT_INVALID`, and software interrupts
cannot be injected correctly unless the processor supports the next-sequential-instruction
pointer (`CPUID Fn8000_000A_EDX[NRIPS]`) `[APM2 §15.20]`.

**Confidence:** high for the APM-anchored parts (`C:high` `V:durable`). The three-block
naming, the union rule as a *procedure*, and the reflected-path narrative are
**`[no-spec]`** software-composition facts cited to `[432][434]` (kernel/Turtles), some at
`C:medium` — the skill says so explicitly rather than claiming an APM anchor.

---

### vmcb-versus-vmcs
**Routed to:** `19-comparison-intel-arm-riscv.md` §19.2 (with §19.7 for the nesting
consequence, same chapter) — right first time; the routing row names the whole chapter.

**Answer:**
**The real architectural difference is how software *reaches* the structure, and everything
else follows from it.** AMD's VMCB is **an ordinary 4-Kbyte-aligned memory page whose field
offsets are architecturally published**, so a hypervisor reads and writes it with ordinary
loads and stores and needs **no dedicated accessor instruction** `[APM2 App.B]`. Intel's
VMCS has an **implementation-specific layout and is reachable only through VMREAD and
VMWRITE** using architectural field encodings `[SDM 3C §27.2]`.

**The trade is symmetric and neither side is strictly better:** Intel can rearrange the
VMCS between generations at the cost of one privileged instruction per field access, while
AMD gets bulk access at the cost of a layout that can only be **extended, never
rearranged** — which is why AMD's newer controls appear in previously reserved bits and in
software-reserved regions rather than in relocated fields
`[APM2 App.B]` `[SDM 3C §27.2]`.

**What follows from it, in the order the differences cascade:**

1. **Host state.** AMD keeps it **outside** the control structure: `VM_HSAVE_PA`
   (`C001_0117h`) points at a 4-Kbyte block `VMRUN` saves into and `#VMEXIT` reloads from,
   and the block is **architecturally opaque** — an implementation may keep part or all of
   that state on-chip, and software "must not rely on the format or contents"
   `[APM2 §15.5.1]` `[APM2 §15.30.4]`. Intel has **no external host-state area**: the VMCS
   contains a host-state area the processor loads on every VM exit and never saves to
   `[SDM 3C §27.5]`. Consequence in nested designs: **an AMD outer hypervisor must emulate
   a second, opaque save area for its guest hypervisor**, whereas an Intel one deals with a
   field of a structure it already manages (`C:medium`).
2. **Caching contract.** AMD **exposes** it: the VMCB Clean field tells the processor which
   register groups it may reload from an internal cache; **the identity is the VMCB's
   physical address — explicitly not the ASID**; set bits are a hint an implementation may
   ignore, cleared bits are always honoured `[APM2 §15.15]` `[APM2 §15.15.1]`. Intel's
   equivalent optimisation is **invisible**: the processor may keep a working copy of the
   current VMCS, VMCLEAR forces it to memory, and **no per-field validity contract is
   exposed to software** `[SDM 3C §27.1]`.
3. **Activation and entry.** AMD: no activation at all — `VMRUN` takes the address in rAX.
   Intel: VMPTRLD/VMCLEAR establish a *current* VMCS, and entry is VMLAUNCH (clear) or
   VMRESUME (launched).
4. **Extra state and exit reporting.** AMD moves a defined extra set with `VMLOAD`/
   `VMSAVE`; Intel uses entry/exit control fields and MSR lists. AMD reports an exit as
   `EXITCODE` plus `EXITINFO1`/`EXITINFO2`; Intel as exit reason plus exit qualification
   `[APM2 App.B]` `[APM2 §15.5.1]` `[APM2 §15.6]` `[SDM 3C §27.2]` `[SDM 3C §27.9.1]`.
5. **Feature discovery.** AMD reports SVM's presence in one CPUID bit and then the SVM
   revision, the ASID count (EBX) and a **flat list of discrete feature bits** (EDX) in
   `Fn8000_000A`; **software tests a bit and writes the corresponding VMCB field directly**
   `[APM3 App.E]`. Intel splits discovery in two — a CPUID bit plus a family of capability
   MSRs reporting, for every control, which settings are allowed — so **an Intel hypervisor
   must compute each control field against allowed-0 and allowed-1 masks before writing it;
   an AMD hypervisor does not** `[SDM 3D App.A]`. Hence AMD feature questions reduce to
   "is the bit set" and Intel's to "is the setting permitted", and **AMD's start-up path is
   shorter but its forward-compatibility story is weaker**: a control AMD adds in a
   previously reserved VMCB bit is invisible to older software, whereas Intel's masks make
   an unsupported setting fail loudly at entry (`C:medium`).
6. **Invalidation is data on AMD, an instruction on Intel.** AMD expresses the bulk
   second-level invalidation as a **field of the VMCB evaluated at `VMRUN`**
   (`TLB_CONTROL`, flush by ASID); Intel expresses it as INVEPT/INVVPID
   `[APM2 App.B]` `[SDM 3C Ch.33]`.
7. **Nesting — the biggest consequence.** **AMD has no equivalent of Intel's VMCS
   shadowing, and the reason is structural rather than a gap in the feature list**: because
   a VMCB is ordinary memory with published offsets, a guest hypervisor's accesses to its
   own VMCB are **plain loads and stores that never trap**, so there is no privileged
   accessor to eliminate and nothing for a shadowing feature to accelerate
   `[APM2 App.B]` `[SDM 3C §27.10]`. There is likewise no AMD counterpart to the
   **enlightened VMCS** — substituting memory for memory buys nothing when the control
   structure is already memory. **But the symmetric-sounding conclusion is false:** the
   Hypervisor Top-Level Functional Specification defines an **enlightened VMCB field block
   in the VMCB's host-reserved region at `3E0h`–`3FFh`, governed by clean bit 31, for which
   Intel has no counterpart** — a Microsoft interface, cited as `[464]`, not an AMD
   architectural one. What AMD *does* provide for nesting is the two features of
   APM Vol.2 §15.33 **and nothing else**: virtualized VMLOAD/VMSAVE
   (`Fn8000_000A_EDX[15]`) and virtual GIF (`Fn8000_000A_EDX[16]`)
   `[APM2 §15.33]` `[APM3 App.E]`.
8. **One asymmetry survives in Intel's favour:** on Intel the inner hypervisor's field
   accesses are *instructions*, so the outer hypervisor can learn which fields changed; on
   AMD they are **invisible stores**, and AMD's nearest substitute is the clean field —
   which the architecture obliges the inner hypervisor to maintain but permits
   implementations to ignore in the hardware direction. **A hint, not a signal**
   `[APM2 §15.15.1]` `[SDM 3C §27.10]` (`C:medium`).

**And what does *not* follow.** The remaining work is the same on both sides: the outer
hypervisor intercepts the inner one's entry instruction, validates the control structure
the inner one prepared, merges two levels of second-level translation into one table
hardware can walk, and runs the inner guest under the union of both levels' intercepts.
**Only the per-field access cost differs** — which is why "AMD nests more cheaply because
it has no VMREAD" is only half true: AMD removes a per-field cost Intel pays, Intel removes
through shadowing a per-access cost AMD never incurs, and **both pay the same per-entry
composition cost** `[APM2 §15.33]` `[APM2 App.B]` `[434]` (`C:medium`).

**Confidence:** high for the structural contrast and the discovery/caching/host-state
differences; `C:medium` on the four consequence claims noted above. Per SKILL.md's
negative-claim rule, the "AMD has no X" statements here are scoped to the documents and
revisions cited, and the enlightened-VMCB field block is the skill's own worked example of
why that scoping matters (`15-nested-virtualization.md` §15.5.4).

---

## Routing summary

| | Count |
|---|---|
| Answered from the skill | 24 / 24 |
| Not covered by the skill | 0 |
| Correct chapter on the first attempt | 24 / 24 |
| Required a second chapter | 1 (`gif-stgi-clgi-vgif`; SKILL.md names both `04` and `07`) |
| Routing row's section anchor landed exactly | 8 |
| Routing row's section anchor landed short *within the correct chapter* | 15 |
