# 13. SEV-ES and the Guest-Hypervisor Communication Block

> **中文速览**：本章覆盖 SEV-ES：VMSA 的位置、加密与校验和、`#VC`（向量 29）的契约、GHCB 的**完整字段偏移表**与 `VALID_BITMAP` 的索引规则、MSR 协议的请求/响应码全表、AE 与 NAE 的分类与 NAE 事件全表（每个事件需要哪些 GHCB 字段有效），以及 AP 启动的三条路径。VMGEXIT 的编码是 `F2/F3 0F 01 D9`——**AMD 的指令页就是这么印的，两个前缀都是架构规定**，不要删掉 `F2`。SNP 专属的策略（RMP、VMPL、restricted injection 的安全模型）在 `14-sev-snp.md`；本章只讲共享的 GHCB 机制。

**Maps to:** SEV-ES Guest-Hypervisor Communication Block Standardization 56421 Rev 2.04 (§2.2 Hypervisor Feature Support · §2.3.1 GHCB MSR Protocol · §2.6 GHCB Layout · §3.1 AE / §3.2 NAE · §4 GHCB Protocol · §5 SNP Restricted Injection) + APM Vol.2 §15.35 and App.B Table B-4 + APM Vol.3 §4 "VMGEXIT" [1][2][9]
**Owns:** the VMSA and its swap types · `#VC` · the GHCB layout and `VALID_BITMAP` · the GHCB MSR protocol · AE/NAE classification and the NAE event table · VMGEXIT · AP startup under SEV-ES and SEV-SNP
**Scope:** **Server scope.** SEV is productised on EPYC. Zen 4 and later client parts expose SME only, and SEV-SNP has never been available on a client part. Read this chapter for EPYC questions; client memory encryption is `11-memory-encryption.md`.
**See also:** `12-sev.md` (keys, ASIDs, `SEV_STATUS`) · `14-sev-snp.md` (RMP, VMPL, SNP policy) · `05-exit-decoding.md` (exit code `403h` in the main table) · `02-vmcb.md` (the VMCB fields referenced here)

---

## 13.1 The VMSA

SEV-ES builds on SEV: where SEV encrypts guest *memory*, SEV-ES additionally encrypts and integrity-protects guest *register state* across a world switch. The mechanism is a relocation — the guest save state leaves the VMCB and moves into its own encrypted page.

- **Claim.** SEV-ES is designed to protect guest register state against exfiltration, control-flow attacks and rollback attacks — the guest's CPU register state is encrypted during world switches and cannot be read or modified by the hypervisor.  `[APM2 §15.35]` `[1]` `C:high` `V:durable`
- **Claim.** SEV-ES support is enumerated by CPUID `Fn8000_001F` EAX bit 3; the full register map for that leaf is in `11-memory-encryption.md`.  `[APM2 §15.35.1]` `[1]` `C:high` `V:durable`
- **Claim.** SEV-ES is enabled per-VM by setting bit 2 at VMCB offset `90h`; the hypervisor must also enable SEV (offset `90h` bit 1) **and** LBR virtualization (offset `B8h` bit 0) — see `02-vmcb.md` for those fields.  `[APM2 §15.35.2]` `[1]` `C:high` `V:durable`
- **Claim.** On some systems SEV-ES may be enabled on any valid SEV ASID, but CPUID `Fn8000_001F` EDX gives the minimum ASID usable by an SEV-enabled, SEV-ES-*disabled* guest — a guest on an ASID below that value must enable SEV-ES. ASID policy belongs to `12-sev.md`.  `[APM2 §15.35.2]` `[1]` `C:high` `V:durable`
- **Claim.** Before running an SEV-ES VM for the first time the hypervisor must coordinate with the AMD Secure Processor to create the initial encrypted state image for the guest.  `[APM2 §15.35.2]` `[1]` `C:high` `V:durable`

### 13.1.1 Where the save state lives

- **Claim.** When SEV-ES is enabled the guest save state does **not** reside at offset `400h` of the VMCB page; it resides starting at offset `0h` of a separate page, the VM Save Area (VMSA), located by the VMSA Pointer at VMCB offset `108h`, which is stored as a host physical address (`02-vmcb.md`).  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** Hardware always accesses the VMSA save state area using encrypted memory accesses under the guest's memory encryption key.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** The host save area uses the same format as the VMSA but begins at offset `400h` of the host save page — so the host TR is at `490h` relative to the start of that page.  `[APM2 App.B]` `[1]` `C:high` `V:durable`

### 13.1.2 What VMRUN and an automatic exit do

- **Claim.** On VMRUN with SEV-ES enabled, hardware additionally calculates a checksum over guest state to verify integrity, performs a VMLOAD to load additional guest register state, loads guest GPR state, and loads guest FPU state.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** If any part of the SEV-ES VMRUN flow faults, or the integrity checksum does not match, hardware generates `#VMEXIT(VMEXIT_INVALID)`.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** With SEV-ES enabled, VMRUN ignores bits 10:5 of the VMCB clean bits and always reloads the full guest state (`02-vmcb.md`).  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** On an SEV-ES VMRUN only the minimal host state defined by the legacy VMRUN is written to the host save area; hardware does **not** save host FS, STAR or GPR values, so the hypervisor must place any additional host state it needs into the host save area itself, because hardware will restore from there on the next exit.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** On an automatic exit hardware performs a VMSAVE of additional guest register state, saves guest GPR state, saves guest FPU state, computes and stores the state checksum for the next VMRUN, performs a VMLOAD of additional host register state, loads host GPR state, and re-initializes FPU state to reset values — so no guest register state remains visible to the hypervisor.  `[APM2 §15.35.9]` `[1]` `C:high` `V:durable`
- **Claim.** Software interrupts and exception vectors 3 and 4 may not be injected into an SEV-ES guest; attempting it makes VMRUN fail with `VMEXIT_INVALID`.  `[APM2 §15.35.8]` `[1]` `C:high` `V:durable`
- **Claim.** The three VMSA swap types are A (host state saved to, and reloaded from, the host save area), B (guest state loaded from and saved to the VMSA with **no** host save), and C (as B on entry, but host state is initialized to default reset values on exit rather than reloaded).  `[APM2 Table B-3]` `[1]` `C:high` `V:durable`

### 13.1.3 The VMSA layout

The VMSA is a 4 KiB page. Its lower part reuses the traditional VMCB save-state layout; the general-purpose register block, the automatic-exit information fields and `SEV_FEATURES` are what SEV-ES adds. The table below is a selection — the SEV-ES-specific fields and the anchors software actually needs.

| Offset | Size | Field | Swap |
|---|---|---|---|
| `000h`–`090h` | 16 B each | `ES`, `CS`, `SS`, `DS`, `FS`, `GS`, `GDTR`, `LDTR`, `IDTR`, `TR` | A/B |
| `0A0h`–`0C0h` | qword | `PL0_SSP`, `PL1_SSP`, `PL2_SSP`, `PL3_SSP`, `U_CET` | B |
| `0CAh` | byte | `VMPL` | – |
| `0CBh` | byte | `CPL` | A |
| `0D0h` | qword | `EFER` | A |
| `0E0h`–`138h` | qword | `PERF_CTL0`–`PERF_CTR5` | C |
| `140h`/`148h`/`150h`/`158h` | qword | `XSS`, `CR4`, `CR3`, `CR0` | B/A |
| `160h`/`168h` | qword | `DR7`, `DR6` | A/C |
| `170h`/`178h` | qword | `RFLAGS`, `RIP` | C/A |
| `1D8h`/`1F8h` | qword | `RSP`, `RAX` | A |
| `240h` | qword | `CR2` | B |
| `2E0h` | qword | `SPEC_CTRL` | A |
| `2E8h`/`2ECh` | dword | `PKRU`, `TSC_AUX` | A/B |
| `2F0h`/`2F8h` | qword | `GUEST_TSC_SCALE`, `GUEST_TSC_OFFSET` | B |
| `300h` | qword | `REG_PROT_NONCE` | – |
| `308h`–`378h` | qword | `RCX`, `RDX`, `RBX`, `SECURE_AVIC_CTL`, `RBP`, `RSI`, `RDI`, `R8`–`R15` | – / B |
| `390h`/`398h`/`3A0h`/`3A8h` | qword | `GUEST_EXITINFO1`, `GUEST_EXITINFO2`, `GUEST_EXITINTINFO`, `GUEST_NRIP` | – |
| `3B0h` | qword | `SEV_FEATURES` | – |
| `3B8h` | qword | `VINTR_CTRL` | – |
| `3C0h`/`3C8h` | qword | `GUEST_EXITCODE`, `VIRTUAL_TOM` | – |
| `3D0h`/`3D8h`/`3E0h`/`3E8h` | qword | `TLB_ID`, `PCPU_ID`, `EVENTINJ`, `XCR0` | – / B |
| `400h`–`66Fh` | — | x87 / MXCSR / `FPREG_X87` / `FPREG_XMM` / `FPREG_YMM` | C |
| `670h`–`778h` | — | LBR stack, `LBR_SELECT` | C |
| `778h`–`7E4h` | — | IBS virtualization state | C |
| `8A8h`/`8B0h` | qword | `GUEST_EXITINTDATA`, `GUEST_EVENTINJDATA` | – |
| `8B8h`–`8F8h` | qword | FRED state (`FRED_RSP0`…`FRED_CONFIG`) | A |
| `900h`–`91Ch` | dword | `INTERCEPT_VEC_0`–`INTERCEPT_VEC_7` (Guest Intercept Control) | – |
| `920h`–`938h` | qword | `INTERCEPT_MSR_VEC_0`–`3` | – |
| `980h`/`9C0h`/`BC0h` | — | `FPREG_K`, `FPREG_ZMMHI`, `FPREG_HIZMM` | C |

- **Claim.** Every offset and swap type in the table above is taken from the SEV-ES VMSA layout table; the guest-controlled intercept vectors at `900h`–`938h` are the Guest Intercept Control feature, whose semantics belong to `14-sev-snp.md`.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** The VMSA fields `GUEST_EXITINFO1` (`390h`), `GUEST_EXITINFO2` (`398h`), `GUEST_EXITINTINFO` (`3A0h`), `GUEST_NRIP` (`3A8h`) and `GUEST_EXITCODE` (`3C0h`) carry, for automatic exits, exactly what the identically named VMCB control-area fields carry for a non-SEV-ES guest — the field layouts themselves are in `05-exit-decoding.md`.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** `EVENTINJ` at VMSA offset `3E0h` is the same field as `EVENTINJ` in the VMCB control area at offset `0A8h` (`02-vmcb.md`), and `VIRTUAL_TOM` at `3C8h` observes only bits 51:21.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`

### 13.1.4 `SEV_FEATURES`

- **Claim.** `SEV_FEATURES` at VMSA offset `3B0h` is the *guest-controlled* SEV feature selection: bit 0 `SNPActive`, 1 `vTOM`, 2 `ReflectVC`, 3 `RestrictedInjection`, 4 `AlternateInjection`, 5 `DebugVirtualization`, 6 `PreventHostIBS`, 7 `BTBIsolation`, 8 `VmplSSS`, 9 `SecureTSC`, 10 `VmgexitParameter`, 11 `PmcVirtualization`, 12 `IbsVirtualization`, 13 `GuestInterceptCtl`, 14 `VmsaRegProt`, 15 `SmtProtection`, 16 `SecureAvic`, 20:17 reserved SBZ, 21 `IbpbOnEntry`, 63:22 reserved SBZ.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** `PmcVirtualization` (bit 11), `GuestInterceptCtl` (bit 13) and `SecureAvic` (bit 16) may only be used if Allowed SEV Features is enabled and the Allowed SEV Features Mask permits them.  `[APM2 Table B-4]` `[1]` `C:high` `V:durable`
- **Claim.** A guest reads its own feature selection through the `SEV_STATUS` MSR, whose bit *n* (for *n* ≥ 2) reports `SEV_FEATURES[n−2]`; `SEV_STATUS` bits 0 and 1 report SEV and SEV-ES enablement from the VMCB instead, which is why `DebugVirtualization` is `SEV_FEATURES[5]` but `SEV_STATUS[7]`. The `SEV_STATUS` bit table itself is owned by `12-sev.md`.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`

### 13.1.5 Limits that follow from the encrypted state

- **Claim.** Because guest registers are measured and encrypted before launch, vCPU hotplug cannot be supported for an SEV-ES guest or for an SEV-SNP guest whose hypervisor lacks the SNP AP Creation NAE event.  `[GHCB 2.04 §4.3.1.2]` `[9]` `C:high` `V:durable`
- **Claim.** System Management Mode is not supported by version 2.04 of the GHCB specification.  `[GHCB 2.04 §4.6]` `[9]` `C:high` `V:durable`
- **Claim.** Nested virtualization is not supported under SEV-ES or SEV-SNP — the mechanism-level discussion of nested SVM is in `15-nested-virtualization.md`.  `[GHCB 2.04 §4.7]` `[9]` `C:high` `V:durable`
- **Claim.** When a guest runs with SEV-ES enabled, instruction bytes are never saved to VMCB offset `D0h` on a nested page fault (`02-vmcb.md`), so the hypervisor gets no Decode Assist for `#NPF`.  `[APM2 §15.35.4]` `[1]` `C:high` `V:durable`

## 13.2 The #VC exception

- **Claim.** The VMM Communication Exception `#VC` is exception vector 29; it is a precise, contributory, fault-type exception, it cannot be masked, and it is always generated by hardware when an SEV-ES enabled guest is running and an NAE event occurs.  `[APM2 §15.35.5]` `[1]` `C:high` `V:durable`
- **Claim.** The `#VC` error code is equal to the `#VMEXIT` code of the event that caused the NAE, so the handler dispatches on the exit code it would otherwise never see — the code space itself is in `05-exit-decoding.md`.  `[APM2 §15.35.5]` `[1][9]` `C:high` `V:durable`
- **Claim.** It is inadvisable for the hypervisor to set the VMCB intercept bit for `#VC`, since that would prevent the guest handling NAEs at all, and the hypervisor should likewise avoid intercepting events that occur inside the `#VC` handler, such as IRET (`03-intercepts.md`).  `[APM2 §15.35.5]` `[1]` `C:high` `V:durable`
- **Claim.** The guest `#VC` handler inspects the error code, decides what register state to copy into the GHCB, executes VMGEXIT to create an AE, and — after the hypervisor's subsequent VMRUN — resumes at the instruction following VMGEXIT to copy results back; it leaves via IRET.  `[GHCB 2.04 §3.2]` `[9]` `C:high` `V:durable`
- **Claim.** Before long mode or 32-bit PAE paging is established, all guest memory accesses are forced to use the guest's encryption key, so the hypervisor would only see ciphertext in the GHCB; a guest must therefore avoid any unplanned NAE event until it has discovered the encryption-bit position and marked the GHCB shared (`11-memory-encryption.md`).  `[GHCB 2.04 §2.5]` `[9]` `C:high` `V:durable`

### 13.2.1 NMIs

- **Claim.** For NMI injection the hypervisor must **not** intercept IRET but **must** intercept `#DB`, and must use the guest's "NMI Complete" NAE event as the indicator that another NMI can be injected.  `[GHCB 2.04 §4.4]` `[9]` `C:high` `V:durable`
- **Claim.** In AMD's worked example the guest sets TF just before the NMI's IRET, and the resulting `#VC` carries the `#DB` intercept error code `0x41`, which the handler uses to recognise the end-of-NMI point and send "NMI Complete".  `[GHCB 2.04 §4.4]` `[9]` `C:high` `V:durable`
- **Claim.** Inside NMI context it is recommended to use a separate GHCB, or to save the active GHCB contents on entry and restore them on exit.  `[GHCB 2.04 §4.1]` `[9]` `C:high` `V:durable`

### 13.2.2 Debug registers

- **Claim.** Full hardware debug-register virtualization for SEV-ES guests requires the `DebugVirtualization` feature, enabled through `SEV_FEATURES` in the VMSA; hardware then saves and restores the debug-register state in the VMSA and the hypervisor should clear all debug-register intercepts.  `[GHCB 2.04 §4.5]` `[9]` `C:high` `V:durable`
- **Claim.** Without `DebugVirtualization` the hypervisor must intercept both read and write of DR7, and the guest `#VC` handler must **not** write the real DR7 — it caches the written value and returns the cached value on a read.  `[GHCB 2.04 §4.5]` `[9]` `C:high` `V:durable`

## 13.3 Establishing the GHCB

- **Claim.** The GHCB is a 4,096-byte page that the guest must map decrypted so that guest and hypervisor can both reach it; hardware never accesses the GHCB directly, and consequently its format is defined by software rather than fixed by hardware.  `[APM2 §15.35.7]` `[1][9]` `C:high` `V:durable`
- **Claim.** The GHCB format mirrors the SEV-ES VMSA save-state layout through offset `0x3ff`, but the two are allowed to diverge — the GHCB lists only the fields actually used, which is what limits how much guest state is exposed.  `[GHCB 2.04 Ch.2]` `[9]` `C:high` `V:durable`
- **Claim.** The guest sets the GHCB's guest physical address through MSR `C001_0130h`; the value is saved and restored by hardware on VMRUN/`#VMEXIT` through VMCB offset `0A0h` (`02-vmcb.md`), and the MSR may be read or written only in guest mode — a host-mode access raises `#GP`.  `[APM2 §15.35.7]` `[1]` `C:high` `V:durable`
- **Claim.** The hypervisor must not intercept access to MSR `C001_0130h`, or the guest cannot establish a GHCB at all.  `[GHCB 2.04 §2.3]` `[9]` `C:high` `V:durable`
- **Claim.** Because the GHCB address is 4 KiB aligned, the low 12 bits of the MSR are free, and those 12 bits carry the `GHCBInfo` request/response code of the GHCB MSR protocol; bits 63:12 are `GHCBData`.  `[GHCB 2.04 §2.3]` `[9]` `C:high` `V:durable`

### 13.3.1 Version negotiation

- **Claim.** In the SEV Information value (`GHCBInfo = 0x001`), `GHCBData[63:48]` is the maximum GHCB protocol version supported, `GHCBData[47:32]` the minimum, and `GHCBData[31:24]` the SEV page-table encryption bit number, which the hypervisor takes from CPUID `Fn8000_001F` EBX[5:0] (`11-memory-encryption.md`).  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** AMD's negotiation example writes `0x0001_0001_2f00_0001` to VMCB offset `0A0h` for a hypervisor supporting only version 1 with encryption bit 47, and `0x0002_0001_3300_0001` for one supporting up to version 2 with encryption bit 51 (`02-vmcb.md`).  `[GHCB 2.04 §2.4.1]` `[9]` `C:high` `V:durable`
- **Claim.** A guest that cannot support any protocol version in the range the hypervisor advertises must request termination.  `[GHCB 2.04 §2.4.1]` `[9]` `C:high` `V:durable`
- **Claim.** An SEV-SNP guest should take the encryption-bit position from the firmware-validated CPUID page rather than from the SEV Information MSR value; the CPUID page is owned by `14-sev-snp.md`.  `[GHCB 2.04 §2.4.2]` `[9]` `C:high` `V:durable`

### 13.3.2 GHCB GPA registration

- **Claim.** GHCB GPA registration is supported and required only for SEV-SNP guests: such a guest must use the Register GHCB GPA MSR request to establish its GHCB GPA before using a GHCB for a VMGEXIT for the first time.  `[GHCB 2.04 §2.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** The hypervisor answers a preferred-GPA request with a GFN or with `0xf_ffff_ffff_ffff` meaning "no preference"; if it supplies a GFN it must guarantee the guest cannot otherwise map that address and must make the page hypervisor-owned, and the guest should verify the address lies outside its known memory range.  `[GHCB 2.04 §2.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** Registering a GHCB GPA automatically unregisters any previously registered one, and a hypervisor **must terminate** a guest that presents a GHCB GPA not matching the currently registered value.  `[GHCB 2.04 §2.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** A hypervisor advertising the SEV-SNP Multi-VMPL feature must allow each VMPL to register its own GHCB GPA — see `14-sev-snp.md` for the privilege model.  `[GHCB 2.04 §2.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** Unregistration (`GHCBInfo = 0x018`) is answered with the unregistered GFN, `0` if nothing was registered, or `0xf_ffff_ffff_ffff` on failure; this function was added in revision 2.04 and is gated by the GHCB Unregister Support hypervisor feature.  `[GHCB 2.04 §2.3.2]` `[9]` `C:high` `V:durable`

### 13.3.3 Hypervisor feature advertisement

- **Claim.** Version 2 introduced a hypervisor `FEATURES` bitmap; it is deliberately limited to 52 bits so that it fits in `GHCBData[63:12]` and can therefore be returned before any GHCB exists.  `[GHCB 2.04 §2.2]` `[9]` `C:high` `V:durable`
- **Claim.** Nine feature bits are defined: 0 SEV-SNP, 1 SEV-SNP AP Creation, 2 SEV-SNP Restricted Injection, 3 SEV-SNP Restricted Injection Timer, 4 APIC ID List, 5 SEV-SNP Multi-VMPL (`14-sev-snp.md`), 6 SEV-ES Page State Change Support, 7 SEV-TIO Support, 8 GHCB Unregister Support.  `[GHCB 2.04 Table 1]` `[9]` `C:high` `V:durable`
- **Claim.** The bits have documented dependencies: AP Creation requires SEV-SNP; Restricted Injection requires SEV-SNP and AP Creation; the Restricted Injection Timer additionally requires Restricted Injection; Multi-VMPL requires SEV-SNP and AP Creation (`14-sev-snp.md`). Support for the specification in full is mandatory except where a feature bit marks it optional.  `[GHCB 2.04 Table 1]` `[9]` `C:high` `V:durable`

## 13.4 The GHCB layout

| Offset | Size | Contents | Versions |
|---|---|---|---|
| `0x0000` | `0xcb` | RESERVED | — |
| `0x00cb` | `0x01` | `CPL` | All |
| `0x00cc` | `0x74` | RESERVED | — |
| `0x0140` | `0x08` | `XSS` | **2+** |
| `0x0148` | `0x18` | RESERVED | — |
| `0x0160` | `0x08` | `DR7` | All |
| `0x0168` | `0x90` | RESERVED | — |
| `0x01f8` | `0x08` | `RAX` | All |
| `0x0200` | `0x100` | RESERVED | — |
| `0x0300` | `0x08` | RESERVED — "RAX already available at `0x01f8`" | — |
| `0x0308` | `0x08` | `RCX` | All |
| `0x0310` | `0x08` | `RDX` | All |
| `0x0318` | `0x08` | `RBX` | All |
| `0x0320` | `0x70` | RESERVED | — |
| `0x0390` | `0x08` | `SW_EXITCODE` — guest controlled exit code | All |
| `0x0398` | `0x08` | `SW_EXITINFO1` — guest controlled exit information 1 | All |
| `0x03a0` | `0x08` | `SW_EXITINFO2` — guest controlled exit information 2 | All |
| `0x03a8` | `0x08` | `SW_SCRATCH` — guest controlled additional information | All |
| `0x03b0` | `0x38` | RESERVED | — |
| `0x03e8` | `0x08` | `XCR0` | All |
| `0x03f0` | `0x10` | `VALID_BITMAP` | All |
| `0x0400` | `0x08` | `X87_STATE_GPA` | All |
| `0x0408` | `0x3f8` | RESERVED | — |
| `0x0800` | `0x7f0` | Shared Buffer | All |
| `0x0ff0` | `0x0a` | RESERVED | — |
| `0x0ffa` | `0x02` | SEV-ES/GHCB Protocol Version | All |
| `0x0ffc` | `0x04` | GHCB Usage | All |

- **Claim.** The table above is the complete GHCB layout; only `XSS` is version-gated (GHCB protocol version 2 and later), every other defined field is present in all versions.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** The eight-byte slot at GHCB offset `0x0300` is reserved with the explicit note that RAX is already available at `0x01f8` — a hypervisor that copies the VMSA layout verbatim into the GHCB will read the wrong slot for RAX.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** `X87_STATE_GPA` holds the guest physical address of a page containing x87-related state in the format produced by XSAVE.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** The Shared Buffer at `0x0800` is `0x7f0` bytes and AMD commits that future versions of the specification will not alter its definition, which is why it is the buffer of choice for string I/O and MMIO staging.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** The SEV-ES/GHCB Protocol Version field at `0x0ffa` takes the value `0x0001` for protocol version 1 and `0x0002` for version 2.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** GHCB Usage at `0x0ffc` indicates the page's format: `0x00000000` means the page follows the documented format, any other value is hypervisor-defined (for example a hypercall format). On VMGEXIT the hypervisor should validate this field, must support the value `0x0000`, and for an unsupported value may either terminate the guest or resume it indicating an exception should be raised.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`

### 13.4.1 `VALID_BITMAP`

- **Claim.** `VALID_BITMAP` is 16 bytes at `0x03f0` and marks which qwords of the save-state area from offset `0x000` through `0x3ef` — 126 qwords — the sender has filled in.  `[GHCB 2.04 Table 3]` `[9]` `C:high` `V:durable`
- **Claim.** The bit index is derived arithmetically: divide the field's byte offset by 8 to get the qword offset, then the `VALID_BITMAP` byte offset is that qword offset divided by 8 and the bit within that byte is the qword offset modulo 8. AMD's worked example: RAX at `0x01f8` gives qword 63, byte 7, bit 7.  `[GHCB 2.04 §4]` `[9]` `C:high` `V:durable`
- **Claim.** At a minimum the guest must set the valid bits for `SW_EXITCODE`, `SW_EXITINFO1` and `SW_EXITINFO2`, and the hypervisor must set them for `SW_EXITINFO1` and `SW_EXITINFO2`.  `[GHCB 2.04 §4]` `[9]` `C:high` `V:durable`
- **Claim.** Both sides must clear the whole `VALID_BITMAP` before setting the bits for the event being performed — the guest before each NAE event, the hypervisor before writing results.  `[GHCB 2.04 §4]` `[9]` `C:high` `V:durable`

## 13.5 The GHCB MSR protocol

The MSR protocol is what a guest uses when it cannot yet write the GHCB page in the clear — during early boot, and for the small set of operations that must work without one.

| `GHCBInfo` | Function | Source | Versions |
|---|---|---|---|
| `0x000` | GHCB Guest Physical Address | Guest | All |
| `0x001` | SEV Information | Hypervisor | All |
| `0x002` | SEV Information Request | Guest | All |
| `0x004` | CPUID Request | Guest | All |
| `0x005` | CPUID Response | Hypervisor | All |
| `0x006` | AP Reset Hold Request | Guest | 2+ |
| `0x007` | AP Reset Hold Response | Hypervisor | 2+ |
| `0x010` | Preferred GHCB GPA Request | Guest | 2+ |
| `0x011` | Preferred GHCB GPA Response | Hypervisor | 2+ |
| `0x012` | Register GHCB GPA Request | Guest | 2+ |
| `0x013` | Register GHCB GPA Response | Hypervisor | 2+ |
| `0x014` | Page State Change Request | Guest | 2+ |
| `0x015` | Page State Change Response | Hypervisor | 2+ |
| `0x016` | SNP Run VMPL Request | Guest | 2+ |
| `0x017` | SNP Run VMPL Response | Hypervisor | 2+ |
| `0x018` | Unregister GHCB GPA Request | Guest | 2+ |
| `0x019` | Unregister GHCB GPA Response | Hypervisor | 2+ |
| `0x080` | Hypervisor Feature Support Request | Guest | 2+ |
| `0x081` | Hypervisor Feature Support Response | Hypervisor | 2+ |
| `0x100` | Termination Request | Guest | All |

- **Claim.** The table above is the complete `GHCBInfo` code set of revision 2.04; `GHCBInfo` occupies MSR bits 11:0 and `GHCBData` bits 63:12, with the meaning of `GHCBData` dependent on the code.  `[GHCB 2.04 Table 2]` `[9]` `C:high` `V:durable`
- **Claim.** A guest may use only codes documented as guest-source; a hypervisor must treat any other value as an invalid request and **return to the guest without modifying the MSR**, and must reply only with hypervisor-source codes, any other reply being invalid to the guest.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The CPUID request (`0x004`) carries the function in `GHCBData[63:32]` and the register selector in `GHCBData[31:30]` — `0b00` EAX, `0b01` EBX, `0b10` ECX, `0b11` EDX — with `GHCBData[29:12]` reserved and zero; one register is returned per invocation, so several VMGEXITs are needed for a whole leaf.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The CPUID request protocol does not support functions that need a non-zero sub-leaf, and function `0x0000_000D` is explicitly unsupported because it depends on XCR0.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The AP Reset Hold request (`0x006`) sends `GHCBData[63:12]` as MBZ and the response (`0x007`) must return a non-zero `GHCBData[63:12]`; the request is invalid for an SEV-SNP guest running with Restricted Injection, which the hypervisor should treat as unsupported.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The MSR-protocol Page State Change request (`0x014`) puts the operation in `GHCBData[55:52]` — `0x0001` private, `0x0002` shared — and the GFN in `GHCBData[51:12]`, and always acts on a 4 KiB page; the response (`0x015`) returns an error code in `GHCBData[63:32]`, non-zero meaning the change did not happen.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The SNP Run VMPL request (`0x016`) carries the target level in `GHCBData[39:32]` with `GHCBData[63:40]` and `[31:12]` reserved; the response returns an error code in `GHCBData[63:32]`. Availability follows the SEV-SNP Multi-VMPL feature bit (`14-sev-snp.md`).  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** For the MSR-protocol Termination Request (`0x100`), `GHCBData[15:12]` is the reason-code *set* and `GHCBData[23:16]` the reason code within it. AMD owns set `0x0`, defining `0x00` general termination, `0x01` GHCB protocol range not supported, `0x02` SEV-SNP features not supported.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** After a termination request the guest should execute an HLT loop or SHUTDOWN as a safeguard in case the hypervisor does not comply.  `[GHCB 2.04 §2.3.1]` `[9]` `C:high` `V:durable`

## 13.6 Automatic and non-automatic exits

### 13.6.1 VMGEXIT

- **Claim.** VMGEXIT's opcode is **`F2/F3 0F 01 D9`** — AMD's instruction page prints both prefixes, and both are architectural. The unprefixed `0F 01 D9` on the same page is VMMCALL.  `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`

  > Mnemonic VMMCALL — Opcode `0F 01 D9`; Mnemonic VMGEXIT — Opcode `F2/F3 0F 01 D9`.

- **Claim.** Support for VMGEXIT is indicated by CPUID `Fn8000_001F_EAX[SEV-ES] = 1` (`11-memory-encryption.md`), and the VMGEXIT encoding is interpreted as VMMCALL on processors that do not support it — including legacy processors — or when it is not executed by an SEV-ES guest.  `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
- **Claim.** VMGEXIT is always intercepted and unconditionally causes a `#VMEXIT`; there is no intercept bit for it, and it behaves like a trap, so a subsequent VMRUN resumes execution after the VMGEXIT.  `[APM2 §15.35.6]` `[1][2]` `C:high` `V:durable`
- **Claim.** VMGEXIT is allowed in all modes and at all privilege levels, and raises `#UD` if SVM is not enabled (`EFER.SVME = 0`) or if `Fn8000_0001_ECX[SVM] = 0` (`01-svm-intro.md`).  `[APM3 §4 "VMGEXIT"]` `[2]` `C:high` `V:durable`
- **Claim.** The VMGEXIT Parameter feature lets a `#VC` handler atomically pass one parameter to the hypervisor: it is enumerated by CPUID `Fn8000_001F_EAX[VmgexitParameter]` bit 17, enabled by `SEV_FEATURES` bit 10, and when enabled hardware writes RAX and CPL to the VMCB control area at offsets `110h` (`VMGEXIT_RAX`) and `118h` (`VMGEXIT_CPL`) — see `02-vmcb.md`.  `[APM2 §15.35.6]` `[1]` `C:high` `V:durable`
- **Claim.** Software should disable interrupts and preemption around a VMGEXIT — before updating the GHCB and setting the GHCB MSR, and while reading the GHCB after the instruction returns.  `[GHCB 2.04 §4.1]` `[9]` `C:high` `V:durable`

### 13.6.2 Automatic exits

- **Claim.** With SEV-ES enabled every `#VMEXIT` is classified as an Automatic Exit (AE) or a Non-Automatic Exit (NAE): AE events are asynchronous to guest execution or need no guest register state exposed, and the hypervisor learns of an AE exclusively through the EXITCODE field; all other events are NAEs. Both kinds are taken only if the corresponding intercept bit is set (`03-intercepts.md`).  `[APM2 §15.35.4]` `[1]` `C:high` `V:durable`

| Code | Name | Notes | HW advances RIP |
|---|---|---|---|
| `52h` | `VMEXIT_MC` | machine check exception | No |
| `60h` | `VMEXIT_INTR` | physical INTR | No |
| `61h` | `VMEXIT_NMI` | physical NMI | No |
| `62h` | `VMEXIT_SMI` | physical SMI | No |
| `63h` | `VMEXIT_INIT` | physical INIT | No |
| `64h` | `VMEXIT_VINTR` | virtual INTR | No |
| `77h` | `VMEXIT_PAUSE` | PAUSE instruction | Yes |
| `78h` | `VMEXIT_HLT` | HLT instruction | Yes |
| `7Fh` | `VMEXIT_SHUTDOWN` | shutdown | No |
| `8Fh` | `VMEXIT_EFER_WRITE_TRAP` | write trap | Yes |
| `90h` | `VMEXIT_CR0_WRITE_TRAP` | write trap | Yes |
| `93h` | `VMEXIT_CR3_WRITE_TRAP` | write trap | Yes |
| `94h` | `VMEXIT_CR4_WRITE_TRAP` | write trap | Yes |
| `A5h` | `VMEXIT_BUSLOCK` | bus lock threshold | No |
| `A6h` | `VMEXIT_IDLE_HLT` | HLT if idle | Yes |
| `400h` | `VMEXIT_NPF` | only if `PFCODE[3] = 0` | No |
| `403h` | `VMEXIT_VMGEXIT` | VMGEXIT instruction | Yes |
| `407h` | `VMEXIT_PML_FULL` | PML buffer overflow | No |
| `-1` | `VMEXIT_INVALID` | invalid guest state | — |
| `-2` | `VMEXIT_BUSY` | BUSY bit was set in VMSA | — |
| `-3` | `VMEXIT_IDLE_REQUIRED` | the sibling thread is not idle | — |
| `-4` | `VMEXIT_INVALID_PMC` | invalid PMC state | — |

- **Claim.** The table above is the AE list as the current APM prints it, including the "HW Advances RIP" column that tells the `#VC` handler whether it must step RIP itself.  `[APM2 §15.35.4]` `[1]` `C:high` `V:durable`
- **Claim.** GHCB 56421 Rev 2.04 carries its own AE list that is a strict subset of the APM's: it omits `62h` `VMEXIT_SMI`, `A5h` `VMEXIT_BUSLOCK`, `A6h` `VMEXIT_IDLE_HLT`, `407h` `VMEXIT_PML_FULL`, `-3` and `-4`, and it generalises the control-register write traps as `0x90 – 0x9f VMEXIT_CR[0-15]_WRITE_TRAP` where the APM names only `90h`, `93h` and `94h`. Treat the APM list as authoritative and the GHCB list as the interoperability floor.  `[GHCB 2.04 Table 6]` `[1][9]` `C:high` `V:durable`
- **Claim.** A nested page fault is an AE only when there was no reserved-bit error, which is why a hypervisor that wants to emulate MMIO must set a reserved page-table bit, such as a reserved address bit, on every MMIO page in the nested page tables, making those faults NAEs that reach the guest `#VC` handler (`06-nested-paging.md`).  `[APM2 §15.35.4]` `[1]` `C:high` `V:durable`
- **Claim.** The GHCB specification spells out the arithmetic for that reserved bit: set bits 51:n where n is the physical address size from CPUID `Fn8000_0008_EAX[7:0]` minus the physical-address reduction from CPUID `Fn8000_001F_EBX[11:6]` (`11-memory-encryption.md`).  `[GHCB 2.04 §4.1.5]` `[9]` `C:high` `V:durable`
- **Claim.** Control-register write traps exist only for SEV-ES guests: the CR0, CR3, CR4 and EFER write-trap intercepts are VMCB offset `10h` bits 16, 19, 20 and 15 respectively (`02-vmcb.md`), they cause an AE *after* the register has been modified, and the new value is placed in EXITINFO1 (`05-exit-decoding.md`).  `[APM2 §15.35.10]` `[1]` `C:high` `V:durable`
- **Claim.** An SMI taken while an SEV-ES guest is executing does not run the platform SMI handler immediately: it stays pending and a `#VMEXIT(SMI)` is generated regardless of the SMI intercept bit, the SMI being taken in hypervisor context after STGI. If the SMI was a redirected machine check, `EXITINFO1[MCREDIR]` is set (`05-exit-decoding.md`).  `[APM2 §15.35.11]` `[1]` `C:high` `V:durable`

### 13.6.3 Non-automatic exits

- **Claim.** Because a guest can invoke VMGEXIT without having taken a `#VC` first, the hypervisor must be able to handle a VMGEXIT for every listed NAE event even for instructions it does not intercept; conversely the guest must be able to handle a `#VC` for every listed NAE event, though it may choose to handle one without any VMGEXIT at all.  `[GHCB 2.04 §4]` `[9]` `C:high` `V:durable`
- **Claim.** The state listed per event is a *minimum*: either side may supply more, but neither may rely on more being supplied, and unless the table says otherwise `SW_EXITINFO1` and `SW_EXITINFO2` must be set to 0.  `[GHCB 2.04 §4]` `[9]` `C:high` `V:durable`
- **Claim.** A guest that takes a `#VC` for an NAE outside the negotiated protocol version should perform a VMGEXIT with the Unsupported Event exit code rather than inventing behaviour.  `[GHCB 2.04 §4.1.18]` `[9]` `C:high` `V:durable`

## 13.7 The NAE event table

| NAE event | `SW_EXITCODE` | State to hypervisor (beyond the exit codes) | State from hypervisor | Ver |
|---|---|---|---|---|
| DR7 Read | `0x27` | — | — | All |
| DR7 Write | `0x37` | RAX, `SW_EXITINFO1` | — | All |
| RDTSC | `0x6e` | — | RAX, RDX | All |
| RDPMC | `0x6f` | RCX | RAX, RDX | All |
| CPUID | `0x72` | RAX, RCX, XCR0\* (+ XSS\* in v2) | RAX, RBX, RCX, RDX | 1 / 2+ |
| INVD | `0x76` | — | — | All |
| IOIO_PROT | `0x7b` | RAX (OUT), `SW_EXITINFO1/2`, `SW_SCRATCH` | RAX (IN) | All |
| MSR_PROT RDMSR | `0x7c`, `INFO1 = 0` | RCX | RAX, RDX | All |
| MSR_PROT WRMSR | `0x7c`, `INFO1 = 1` | RAX, RCX, RDX | — | All |
| VMMCALL | `0x81` | RAX, CPL | RAX | All |
| RDTSCP | `0x87` | — | RAX, RCX, RDX | All |
| WBINVD | `0x89` | — | — | All |
| MONITOR / MONITORX | `0x8a` | RAX, RCX, RDX | — | All |
| MWAIT / MWAITX | `0x8b` | RAX, RCX | — | All |
| `#AC` | — (forwarded) | — | — | All |
| `#NPF` MMIO Read | `0x8000_0001` | `INFO1` = SRC, `INFO2` = LEN, `SCRATCH` = DST | — | All |
| `#NPF` MMIO Write | `0x8000_0002` | `INFO1` = DST, `INFO2` = LEN, `SCRATCH` = SRC | — | All |
| NMI Complete | `0x8000_0003` | — | — | All |
| AP Reset Hold | `0x8000_0004` | — | `SW_EXITINFO2` | All |
| AP Jump Table | `0x8000_0005` | `INFO1` = 0 SET / 1 GET, `INFO2` | `SW_EXITINFO2` | All |
| Page State Change | `0x8000_0010` | `SW_SCRATCH` = PSC structure GPA | `SW_EXITINFO2` | 2+ |
| SNP Guest Request | `0x8000_0011` | `INFO1` = req GPA, `INFO2` = rsp GPA | `SW_EXITINFO2` | 2+ |
| SNP Extended Guest Request | `0x8000_0012` | RAX = data GPA, RBX = page count, `INFO1`, `INFO2` | RBX, `SW_EXITINFO2` | 2+ |
| SNP AP Creation | `0x8000_0013` | RAX = `SEV_FEATURES`, `INFO1`, `INFO2` | — | 2+ |
| `#HV` Doorbell Page | `0x8000_0014` | `INFO1` = 0 GET_PREFERRED / 1 SET / 2 QUERY / 3 CLEAR | `SW_EXITINFO2` | 2+ |
| `#HV` IPI | `0x8000_0015` | `INFO1` in x2APIC ICR format | — | 2+ |
| `#HV` Timer | `0x8000_0016` | RAX, RBX, RCX, `INFO1` = 0 SET / 1 GET, `INFO2` = MASK | RAX, RBX, RCX, RDX | 2+ |
| APIC ID List | `0x8000_0017` | RAX = page count, `INFO1` = GPA | RAX | 2+ |
| SNP Run VMPL | `0x8000_0018` | `INFO1[31:0]` = VMPL level | — | 2+ |
| SNP TIO Guest Request | `0x8000_0019` | RAX, RBX, RCX = BDFn, RDX, `INFO1`, `INFO2` | RBX, RDX, `SW_EXITINFO2` | 2+ |
| Secure AVIC | `0x8000_001a` | RAX = APIC ID, RBX, `INFO1` = 0 REGISTER / 1 UNREGISTER | RBX | 2+ |
| Hypervisor Feature Support | `0x8000_fffd` | — | `SW_EXITINFO2` = `FEATURES` | 2+ |
| **Termination Request** | **`0x8000_fffe`** | `INFO1` = reason code, `INFO2` = error info | — | 2+ |
| **Unsupported Event** | **`0x8000_ffff`** | `INFO1` = the `#VC` error code on entry | — | All |

- **Claim.** The table above is the complete NAE event list of GHCB revision 2.04, with `SW_EXITCODE` values below `0x8000_0000` matching the corresponding SVM intercept exit codes and the `0x8000_xxxx` range being GHCB-defined software exit codes (`05-exit-decoding.md`).  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** Termination Request is `0x8000_fffe` and Unsupported Event is `0x8000_ffff` — these are two distinct events, and Unsupported Event, not Termination, is the one supported in all protocol versions.  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** `#AC` is the one NAE with no VMGEXIT at all: the `#VC` handler is expected to forward the exception to the guest's own `#AC` handler.  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** XCR0 must be supplied with a CPUID NAE only for leaf `0000_000D`; in protocol version 2 and later XSS must also be supplied for that leaf when the guest supports the XSS MSR `0x0000_0da0`.  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** For IOIO_PROT the guest builds `SW_EXITINFO1` in the format the APM defines for the IOIO intercept; for a string operation `SW_EXITINFO2` carries the REP count (otherwise 0) and `SW_SCRATCH` the guest physical address of shared memory used as the source for OUTS or the destination for INS.  `[APM2 §15.10.2]` `[1][9]` `C:high` `V:durable`
- **Claim.** For a DR7 write NAE `SW_EXITINFO1` is guest-supplied state, built in the format the APM defines for MOV-CRx/DRx intercepts — the hypervisor reads it, it does not produce it.  `[APM2 §15.8.1]` `[1][9]` `C:high` `V:durable`
- **Claim.** RAX and CPL are the minimum state for a VMMCALL NAE; anything else a particular hypercall needs is supplied by the guest and flagged in `VALID_BITMAP`, because hypercall register conventions are hypervisor-specific and outside this specification.  `[GHCB 2.04 §4.1.4]` `[9]` `C:high` `V:durable`

### 13.7.1 The standard VMGEXIT sequence and error signalling

- **Claim.** The standard sequence is: disable interrupts and preemption; copy the "state to hypervisor" registers into the GHCB; set the matching `VALID_BITMAP` bits; set `SW_EXITCODE`/`SW_EXITINFO1`/`SW_EXITINFO2`; verify or set the GHCB MSR; execute VMGEXIT; on return advance RIP past the instruction that caused the `#VC`; then branch on `SW_EXITINFO1[31:0]`.  `[GHCB 2.04 §4.1.1]` `[9]` `C:high` `V:durable`
- **Claim.** Any non-zero `SW_EXITINFO1[31:0]` is an error from the hypervisor. `0x0000` means no action requested; `0x0001` means the hypervisor asks for an exception to be raised, with `SW_EXITINFO2` holding the value in EVENTINJ format (`05-exit-decoding.md`) and the only currently supported exceptions being `#GP` and `#UD`; `0x0002` means the hypervisor encountered malformed input for the VMGEXIT, and `SW_EXITINFO2` may then carry a reason code from the invalid-GHCB list.  `[GHCB 2.04 §4.1]` `[9]` `C:high` `V:durable`
- **Claim.** The invalid-GHCB reason codes are `0x0001` GHCB address not registered (SEV-SNP), `0x0002` invalid GHCB Usage value, `0x0003` `SW_SCRATCH` invalid or unmappable, `0x0004` a required input field was not marked valid in `VALID_BITMAP`, `0x0005` invalid NAE event input, `0x0006` the NAE event was not valid, `0x0007`–`0xffff` reserved, and `0x10000` and above available for hypervisor-specific codes.  `[GHCB 2.04 Table 8]` `[9]` `C:high` `V:durable`
- **Claim.** For the NAE Termination Request the reason-code set is `SW_EXITINFO1[3:0]` and the reason code `SW_EXITINFO1[11:4]` — a *different* bit split from the MSR-protocol form — and for reason code `0x02` (SEV-SNP features not supported) `SW_EXITINFO2` carries a mask of the unsupported `SEV_FEATURES` bits.  `[GHCB 2.04 §4.1.17]` `[9]` `C:high` `V:durable`

### 13.7.2 MMIO, page state change and guest requests

- **Claim.** For MMIO the guest decodes the faulting instruction itself, stages the data in a decrypted buffer whose GPA it puts in `SW_SCRATCH` — the GHCB Shared Buffer at offset `0x800` being the natural choice — and may issue several VMGEXITs, adjusting `SW_EXITINFO2` to the amount actually transferred each time.  `[GHCB 2.04 §4.1.5]` `[9]` `C:high` `V:durable`
- **Claim.** The MMIO length in `SW_EXITINFO2` must be at most `0x7fff_ffff` for protocol version 1 and at most `0x8` for all later versions.  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** A Page State Change entry is one qword: `[63:57]` reserved MBZ, `[56]` page size (0 = 4 KiB, 1 = 2 MiB), `[55:52]` operation, `[51:12]` GFN, `[11:0]` current page. The operations are `0x0001` page assignment private, `0x0002` page assignment shared, `0x0003` PSMASH hint and `0x0004` UNSMASH hint, the two hints being advisory — the hypervisor is not required to act on them. The RMP effects belong to `14-sev-snp.md`.  `[GHCB 2.04 Table 9]` `[9]` `C:high` `V:durable`
- **Claim.** The Page State Change structure has an 8-byte header of `cur_entry`, `end_entry` and a reserved dword, and the GHCB Shared Buffer can hold up to 253 entries.  `[GHCB 2.04 §4.1.6]` `[9]` `C:high` `V:durable`
- **Claim.** Page State Change breaks the usual error convention: `SW_EXITINFO1 = 0` does not mean success. The hypervisor increments `cur_entry` per completed entry (and `cur_page` per completed 4 KiB page of a 2 MiB entry) so the request is resumable, and completion is signalled by `cur_entry` becoming greater than `end_entry`.  `[GHCB 2.04 §4.1.6]` `[9]` `C:high` `V:durable`
- **Claim.** If the request did not complete, `SW_EXITINFO2 == 0` means "interrupted, retry"; `[63:32] = 1` means a malformed header (`[31:0] = 1`) or entry (`[31:0] = 2`); `[63:32] = 2` carries the firmware error code in `[31:0]`; `[63:32] = 3` is a debugging aid for the page already being in the requested state (`[31:0] = 1`) or a 4 KiB/2 MiB RMP overlap (`[31:0] = 2`), both of which the hypervisor may silently correct; `[63:32] = 0x100` is any other hypervisor error.  `[GHCB 2.04 §4.1.6]` `[9]` `C:high` `V:durable`
- **Claim.** SNP Guest Request needs two distinct pages, one request and one response, both page-aligned and both assigned to the hypervisor (shared); the hypervisor must translate each GPA to a system physical address (sPA) and verify that assignment. The response splits its status: `SW_EXITINFO2[63:32]` is the hypervisor's return code and `[31:0]` the firmware's, zero meaning success.  `[GHCB 2.04 §4.1.7]` `[9][10]` `C:high` `V:durable`
- **Claim.** SNP Extended Guest Request adds RAX (data page GPA) and RBX (page count): on error the hypervisor returns in RBX the number of contiguous pages actually required, so the guest can retry with enough room.  `[GHCB 2.04 §4.1.8]` `[9]` `C:high` `V:durable`
- **Claim.** The APIC ID List NAE returns a `u32` count followed by one `u32` per APIC ID; if the guest supplied too few pages the hypervisor returns the required page count in RAX, and the guest detects the short case by comparing the returned RAX against what it supplied.  `[GHCB 2.04 §4.1.13]` `[9]` `C:high` `V:durable`
- **Claim.** SNP Run VMPL associates a distinct VMSA — and optionally a distinct GHCB — with each VMPL; when the level changes the hypervisor must update both the VMSA and the GHCB system physical addresses before running the vCPU, and must return an error for a level that has no VMSA. The privilege model is `14-sev-snp.md`.  `[GHCB 2.04 §4.1.14]` `[9]` `C:high` `V:durable`
- **Claim.** The Secure AVIC NAE needs no feature bit — setting Secure AVIC in `SEV_FEATURES` implies it — and RAX carries the target APIC ID, or `0xffff_ffff_ffff_ffff` meaning the calling vCPU; registering an AVIC backing page GPA obliges the hypervisor to keep that page present in the guest's nested page tables whenever the vCPU runs (`14-sev-snp.md`).  `[GHCB 2.04 §4.1.16]` `[9]` `C:high` `V:durable`

### 13.7.3 Restricted injection and the `#HV` doorbell page

Restricted injection is an SNP feature; the GHCB specification owns the *transport* it uses. The policy — why a guest runs this way, and what the hypervisor is trusted for — is `14-sev-snp.md`.

- **Claim.** Under Restricted Injection the host is limited to ringing a doorbell with the `#HV` exception instead of injecting arbitrary vectors; the guest-side policy and the `#HV` vector itself are covered in `14-sev-snp.md`.  `[GHCB 2.04 §5.1]` `[9]` `C:high` `V:durable`
- **Claim.** The `#HV` doorbell page defines two fields: `PendingEvent`, 16 bits in bytes 0–1, and `NoEoiRequired`, byte 2; bytes 3–63 are reserved for future expansion and the rest of the page is left to the virtualization stack (`14-sev-snp.md`).  `[GHCB 2.04 §5.2]` `[9]` `C:high` `V:durable`
- **Claim.** `PendingEvent[7:0]` is an interrupt vector number (non-zero meaning an interrupt is presented), `PendingEvent[8]` an NMI, `PendingEvent[9]` a virtual `#MC`, `PendingEvent[14:10]` reserved, and `PendingEvent[15]` `NoFurtherSignal`, meaning the host will not signal `#HV` for another non-maskable event until the guest clears it (`14-sev-snp.md`).  `[GHCB 2.04 §5.2]` `[9]` `C:high` `V:durable`
- **Claim.** The doorbell page is shared with the host, so its backing page must be host-owned and all guest accesses must be made with C = 0 (`11-memory-encryption.md`).  `[GHCB 2.04 §5.2]` `[9]` `C:high` `V:durable`
- **Claim.** EOI is optimised by `NoEoiRequired`: the host sets it non-zero when no exit is needed, the guest attempts an atomic non-zero-to-zero change, and only if that fails must it perform a VMGEXIT requesting a WRMSR to the x2APIC EOI MSR (`14-sev-snp.md`).  `[GHCB 2.04 §5.2]` `[9]` `C:high` `V:durable`
- **Claim.** Because `#HV` is delivered without regard to interrupt shadows, a guest ready to halt must not examine pending interrupt state and must not enable interrupts: it executes HLT with interrupts disabled, the host re-enters immediately if anything is pending, and on resuming after HLT the guest examines interrupt state as if it had just taken a `#HV` (`07-virtual-interrupts-avic.md`).  `[GHCB 2.04 §5.3]` `[9]` `C:high` `V:durable`
- **Claim.** The `#HV` Timer NAE emulates the APIC timer through a register mask: `MASK[0]` RAX Timer LVT, `MASK[1]` RBX Divide Configuration, `MASK[2]` RCX Timer Initial Count, `MASK[3]` RDX Timer Current Count — Current Count is readable but not settable, and on a SET with several bits the order is LVT, then divide configuration, then initial count.  `[GHCB 2.04 §4.1.12]` `[9]` `C:high` `V:durable`
- **Claim.** The `#HV` IPI NAE passes `SW_EXITINFO1` in x2APIC Interrupt Command Register format so a hypervisor can reuse existing x2APIC emulation; if Restricted Injection is not enabled the hypervisor may signal `#GP` through the standard error path.  `[GHCB 2.04 §4.1.11]` `[9]` `C:high` `V:durable`

## 13.8 Booting application processors

The problem SEV-ES creates for SMP boot is simple to state: the classic INIT-SIPI-SIPI sequence works by having the hypervisor write the AP's CS and IP, and under SEV-ES the hypervisor may not write measured, encrypted guest registers. Three mechanisms replace it.

- **Claim.** The very first time an AP starts it must run with the register values that were set and measured when `LAUNCH_UPDATE_VMSA` (SEV-ES) or `SNP_LAUNCH_UPDATE` (SEV-SNP) was invoked, and the hypervisor must not update any register value for that first reset — the launch commands themselves are in `12-sev.md` and `14-sev-snp.md`.  `[GHCB 2.04 §4.3.1]` `[8][9]` `C:high` `V:durable`
- **Claim.** AMD documents two ways to arrange that first entry point: reuse the standard reset vector with code that polls a memory location for a target address, or have firmware supply a predetermined CS:IP that the hypervisor discovers before the guest runs.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`

### 13.8.1 AP Reset Hold

- **Claim.** For subsequent resets the AP parks by issuing either the AP Reset Hold NAE event (`0x8000_0004`) or the AP Reset Hold MSR protocol request (`GHCBInfo = 0x006`); the hypervisor treats either as an HLT and marks the vCPU halted.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** The NAE form requires the AP to be in PAE or long mode long enough to write the GHCB in the clear — it may leave that mode afterwards — whereas the MSR form exists precisely so an AP that is not in long mode can still park.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** On a SIPI the hypervisor completes the hold without touching any register; the AP must check that `SW_EXITINFO2` (or `GHCBData[63:12]` for the MSR form) is non-zero and reissue the hold if it is zero, then transition to real mode and begin executing at the SIPI's reset vector.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** After the hold completes, RAX, RBX, RCX, RDX, RSI, RDI, RBP, R8–R15 and RFLAGS must be set to the Initial Processor State after INIT; the remaining registers need not be.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`
- **Claim.** AP Reset Hold is not available to an SEV-SNP guest running with Restricted Injection, because that guest has no APIC and therefore cannot issue INIT-SIPI-SIPI at all; such a guest must use SNP AP Creation.  `[GHCB 2.04 §4.3.1]` `[9]` `C:high` `V:durable`

### 13.8.2 The AP jump table

- **Claim.** The AP jump table exists so control can pass from firmware to an OS: its first four bytes are `uint16 reset_ip` followed by `uint16 reset_cs`, so entering at physical `0x9f000` means storing `0x0000` at offset `0x00` and `0x9f00` at offset `0x02`.  `[GHCB 2.04 §4.3.1.1]` `[9]` `C:high` `V:durable`
- **Claim.** The AP jump table must be 4 KiB in size, 4 KiB aligned, in **encrypted** memory, marked reserved by firmware, and there can be only one; writes to the reset-address field must be serialized if different APs use different values.  `[GHCB 2.04 §4.3.1.1]` `[9]` `C:high` `V:durable`
- **Claim.** An SEV-ES guest publishes the jump table through the AP Jump Table NAE event — firmware SETs it (`SW_EXITINFO1 = 0`) and the OS GETs it (`SW_EXITINFO1 = 1`, returning zero if never set) — while an SEV-SNP guest must instead put the address in the SNP secrets page, the AP Jump Table NAE being invalid for SNP.  `[GHCB 2.04 §4.3.1.1]` `[9]` `C:high` `V:durable`
- **Claim.** The secrets-page field is part of the 96-byte Secrets Page Guest Reserved Area (offsets `0x00a0`–`0x00ff` of the secrets page) that revision 2.01 of this specification reorganised; the AP Jump Table Physical Address is the qword at offset `0x0010` of that area, preceded by the four VMPL0–VMPL3 message sequence numbers at `0x0000`–`0x000f`. The secrets page as a whole belongs to `14-sev-snp.md`.  `[GHCB 2.04 Table 4]` `[9]` `C:high` `V:durable`

### 13.8.3 SNP AP Creation

- **Claim.** With the SNP AP Creation feature the guest itself supplies AP register state: it marks a page as a VM Save Area with RMPADJUST, then issues VMGEXIT `0x8000_0013` to create, install or destroy that VMSA — and no longer needs the AP Reset Hold event at all (`14-sev-snp.md`).  `[GHCB 2.04 §4.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** `SW_EXITINFO1` encodes the request as `[63:32]` APIC ID, `[31:20]` zero, `[19:16]` VMPL (`14-sev-snp.md`) and `[15:0]` the action: `0` create/add for use at the next INIT-SIPI, `1` create/add for immediate use, `2` destroy/remove. `SW_EXITINFO2` is the VMSA guest physical address, or 0 for a destroy.  `[GHCB 2.04 Table 7]` `[9]` `C:high` `V:durable`
- **Claim.** Action `0` — deferred until an INIT request arrives — is not compatible with the Restricted Injection feature, so a restricted-injection guest must use action `1`.  `[GHCB 2.04 §4.3.2]` `[9]` `C:high` `V:durable`
- **Claim.** The VMPL field (`14-sev-snp.md`) is only meaningful if the hypervisor advertises SEV-SNP Multi-VMPL, and must be zero otherwise; the hypervisor must bind the VMSA by its system physical address (sPA), and after any error the vCPU cannot run at that level until a VMSA is successfully re-assigned.  `[GHCB 2.04 §4.1.9]` `[9]` `C:high` `V:durable`
- **Claim.** RAX carries the `SEV_FEATURES` value used in the new VMSA, and the hypervisor may reject the request if the AP's injection mechanism does not match the BSP's.  `[GHCB 2.04 §4.1.9]` `[9]` `C:high` `V:durable`
- **Claim.** Because the guest can hand the hypervisor new VMSA pages at any time, SNP AP Creation restores vCPU hotplug, and parking needs no jump table — the guest simply sets AP state through `0x8000_0013`.  `[GHCB 2.04 §4.3.2.1]` `[9]` `C:high` `V:durable`

### 13.8.4 Reading the Linux implementation

- **Claim.** Linux models the GHCB and the VMSA as two separate structures, `struct ghcb` / `struct ghcb_save_area` and `struct sev_es_save_area`, in `arch/x86/include/asm/svm.h` — which is the concrete answer to the older claim that "the GHCB layout is just the kernel's `struct vmcb_save_area`": it is not, the two diverge above offset `0x300`.  `[no-spec]` `[380]` `C:medium` `V:durable`
- **Claim.** The guest-side `#VC` handler, the GHCB MSR protocol helpers and the AP-startup paths live in the kernel's SEV guest core — historically `arch/x86/kernel/sev.c`, since relocated under `arch/x86/coco/sev/` — and are the most complete worked example of this chapter's protocol.  `[no-spec]` `[381]` `C:medium` `V:durable`

## 13.9 Open items

- **AMD's own VMSA table has two arithmetic inconsistencies in Rev 3.45.** The row at VMSA offset `0C8h` is printed as a `dword` although the next row begins at `0CAh` (two bytes later), and the reserved range printed as `2A0-2DFh` is given as "72 bytes" although `2A0h`–`2DFh` is 64 bytes and the next row is at `2E0h`. In both cases the offsets are self-consistent and the size column is not; prefer the offsets.  `[APM2 Table B-4]` `[1]`
- **The two AE lists are not in sync.** GHCB 56421 Rev 2.04 (January 2025) predates APM Rev 3.45 (July 2026) and its Table 6 is missing six entries. AMD does not publish an erratum channel for either document, so there is no statement that one supersedes the other; §13.6.2 records the difference rather than resolving it.
- **`VMEXIT_IDLE_REQUIRED` and `VMEXIT_INVALID_PMC` (`-3`, `-4`) are AE codes with no GHCB-side handling guidance.** The APM lists them; the GHCB specification does not mention them, so what a `#VC`-using guest should expect is unspecified.
- **Reason code sets other than `0x0` are undefined by AMD.** Both termination paths reserve a set number for hypervisor-specific codes, and no registry exists — a guest cannot interpret a non-zero set portably.
- **The GHCB Usage negotiation is explicitly out of scope.** AMD states that how hypervisors communicate support for additional GHCB Usage values is beyond the scope of the specification, so any non-zero usage is by private agreement.  `[GHCB 2.04 Table 3]` `[9]`
- **Not covered here on purpose.** The RMP effects of a page state change, the VMPL privilege model, the `#HV` vector definition, the SNP CPUID page and the attestation path behind SNP Guest Request are all `14-sev-snp.md`. SEV key management, ASIDs and `SEV_STATUS` are `12-sev.md`. CVEs affecting SEV-ES are `17-security.md`.
