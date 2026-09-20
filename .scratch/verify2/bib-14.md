# Bibliography additions from the chapter-14 (nested virtualization) verification

**Reserved ID range for this pass: 324–349.** `intel-vt/references/bibliography.md` was **not** edited.
IDs 324–349 were confirmed free before this pass (the next used ID above 323 is 350).

## Entries allocated and cited: none

Chapter 14 was re-anchored without consuming a single new ID. Every source the corrected claims now
rest on is already in `references/bibliography.md`, and the linter resolves `[N]` only against that
file — so allocating a new ID here and citing it in the chapter would have broken `tools/lint.mjs`.

The Microsoft Learn pages the Windows re-anchoring needed already exist in the bibliography, in the
**Windows-platform band (450–499)** rather than in chapter 14's own 300–349 band:

| Existing ID | Document | Now cited by chapter 14 for |
|---|---|---|
| `[465]` | Windows Hypervisor Platform API reference (`WHvCreatePartition`, `WHvMapGpaRange`, `WHvRunVirtualProcessor`) | §14.12.1 WHP definition (with `[314]`, same URL) |
| `[474]` | Comparing WSL versions — WSL 2 runs a Linux kernel in a lightweight utility VM | §14.12.1, §14.12.4 — WSL2 starts the hypervisor |
| `[475]` | Windows Sandbox overview — hypervisor-based isolation | §14.12.1, §14.12.4 — Windows Sandbox starts the hypervisor |
| `[476]` | Virtualization-based security (VBS) enablement and hardware requirements — 64-bit CPU with SLAT + Intel VT-x | §14.12.3 — VBS requires SLAT (EPT on Intel) |
| `[479]` | Run Hyper-V in a virtual machine with nested virtualization | §14.12.2 — the `Set-VMProcessor` procedure and the "Intel processor with VT-x and EPT technology" prerequisite |
| `[481]` | Docker Desktop backend documentation | §14.12.1, §14.12.4 — Docker Desktop's Hyper-V backend |

### Consequence for a future bibliography merge

The bibliography already contains one deliberate duplicate of this kind: `[323]` carries the note
"(same document as `[378]`; allocated in the chapter-14 band so that chapter 14 cites only its own
range)". Whoever next owns `bibliography.md` has two consistent options:

1. **Leave it.** Chapter 14 cites six entries from the 450–499 band. Nothing breaks; the band
   convention is a write-partitioning rule, not a citation rule, and chapter 14 already cites
   `[1]`, `[2]` and `[5]` from the Intel band.
2. **Mirror them into 324–329**, following the `[323]`/`[378]` precedent, and re-point chapter 14:

   ```
   [324] Microsoft Learn. Hyper-V APIs — Windows Hypervisor Platform overview ("an extended user-mode API for third-party virtualization stacks and applications to create and manage partitions at the hypervisor level, configure memory mappings for the partition, and create and control execution of virtual processors"; names QEMU as the example client). https://learn.microsoft.com/en-us/virtualization/api/ — T2
   [325] Microsoft Learn. Run Hyper-V in a Virtual Machine with Nested Virtualization (prerequisites; `Set-VMProcessor … -ExposeVirtualizationExtensions` issued while the VM is OFF). https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/enable-nested-virtualization — T2 (same document as [479])
   [326] Microsoft Learn. Comparing WSL Versions. https://learn.microsoft.com/en-us/windows/wsl/compare-versions — T2 (same document as [474])
   [327] Microsoft Learn. Windows Sandbox architecture. https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-architecture — T2
   [328] Docker Inc. Docker Desktop for Windows — installation and backends (WSL 2, Hyper-V, Docker VMM). https://docs.docker.com/desktop/setup/install/windows-install/ — T2 (companion to [481])
   ```

   **`[324]` is the only genuinely new document in the list.** `[314]`/`[465]` point at
   `/virtualization/api/hypervisor-platform/hypervisor-platform`, which is the *function reference*;
   the one-sentence definition of what WHP is, and the QEMU example, live on the parent
   `/virtualization/api/` page, which the bibliography does not currently carry. Chapter 14 quotes
   that definition, so `[324]` should be added and cited alongside `[314]` when the bibliography is
   next writable.

## Source-access note (important for reproducing this pass)

`learn.microsoft.com` is **unreachable from this sandbox**: `curl` fails with
`schannel: failed to receive handshake, SSL/TLS connection failed`, Python's `urllib` with
`SSL: UNEXPECTED_EOF_WHILE_READING`, and `WebFetch` with `Socket is closed`. Other hosts
(`cdrdv2*.intel.com`, `git.kernel.org`, `raw.githubusercontent.com`, `arxiv.org`, `docs.docker.com`,
`usenix.org`, `linux-kvm.org`) all work.

The Learn articles were therefore read from the **repositories that publish them**, which serve the
exact markdown Learn renders:

| Learn page (bibliography id) | Source read |
|---|---|
| What is Nested Virtualization for Hyper-V? `[311]` | `MicrosoftDocs/windowsserverdocs` → `WindowsServerDocs/virtualization/hyper-v/nested-virtualization.md` |
| Run Hyper-V in a VM with Nested Virtualization `[479]` | same repo → `.../hyper-v/enable-nested-virtualization.md` |
| Hyper-V Nested Virtualization Troubleshooting Guide `[312]` | `MicrosoftDocs/SupportArticles-docs` → `support/windows-server/high-availability/hyper-v-nested-virtualization.md` |
| Virtualization applications can't run alongside Hyper-V `[315]` | `MicrosoftDocs/SupportArticles-docs` → `support/windows-client/application-management/virtualization-apps-not-work-with-hyper-v.md` |
| WHP API definitions `[314]`/`[465]` | `MicrosoftDocs/Virtualization-Documentation` → `virtualization/api/hypervisor-platform/hypervisor-platform.md` |
| Hyper-V APIs index (proposed `[324]`) | same repo → `virtualization/api/index.md` |
| TLFS: Nested Virtualization `[316]` | same repo → `virtualization/hyper-v-on-windows/tlfs/nested-virtualization.md` |
| TLFS: Virtual Secure Mode `[317]` | same repo → `virtualization/hyper-v-on-windows/tlfs/vsm.md` |
| VBS `[323]`/`[476]` | `WebSearch` against `learn.microsoft.com` (the `windows-hardware/design/device-experiences` source repo is not public under the paths tried) |

Every quotation reproduced in `14-nested-virtualization.md` and in `eval/verify/full-14.md` comes
from one of those files, not from memory. A reproducer with unrestricted network access should
re-read the live Learn URLs and confirm; only the VBS SLAT requirement rests on a search snippet
rather than on a file read, which is why claim #92 in the table stays at `C:high` on the VTL half
(TLFS, file-read) and leans on `[476]` for the SLAT half.

## Intel and Tier-2 sources: all already present

| Existing ID | Document | Used for |
|---|---|---|
| `[1]` | SDM Vol.3C 326019-092US, Rev 092, June 2026 | §26.3, §26.6, §26.7, §27.1–§27.11, §28.1.2, §28.5.1, §28.5.7.3, §28.5.8.1, Ch.29, Ch.30, Ch.31, Ch.32, Ch.33 |
| `[2]` | SDM Vol.3D 332831, Rev 092 | App.A.1, A.3.1–A.3.4, A.4.1–A.4.2, A.5, A.6, A.10, A.11 |
| `[5]` | SDM Vol.4 335592, Rev 092 | §2.1 Table 2-2, MSR addresses 480H–493H |
| `[300]` `[301]` `[318]` `[319]` | kernel.org / LKML | vmcs01-12-02 naming, `nested.c`, `KVM_*_NESTED_STATE`, the GVA-validity fix |
| `[302]` `[303]` `[304]` `[320]` | Turtles OSDI '10, shadow-turtles KVM Forum 2013, Alon KVM Forum 2017, linux-kvm.org | exit multiplication, merging, APICv fallback |
| `[305]`–`[310]` `[321]` `[322]` | Dune, NEVE, OoH (preprint / SC22 / thesis), (No)Compromis, ELI, SeKVM | §14.7 and §14.13 |
