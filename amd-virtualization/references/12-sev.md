# 12. Secure Encrypted Virtualization

> **中文速览**：本章覆盖第一代 SEV：威胁模型（什么被保护、什么不被保护——这是每个机密计算回答的框架）、SEV 的启用与三项一致性检查、ASID 与加密密钥的绑定与复用协议（DEACTIVATE → WBINVD → DF_FLUSH）、11 个密钥的层次、平台三态与 guest 七态状态机、固件命令 ID 与状态码全表、guest policy 位图、启动度量的计算公式，以及 `SEV_STATUS` MSR 的全部位。**注意 `SEV_STATUS[n] = SEV_FEATURES[n−2]`**（n ≥ 2），照 Linux 头文件对表会整体错两位。

**Maps to:** Secure Encrypted Virtualization API 55766 Rev 3.24 (Ch.1 Overview · Ch.2 Key Management · Ch.3 Guest Policy · Ch.4 Mailbox Register Protocol · Ch.5 Platform Management API · Ch.6 Guest Management API · **Ch.7 Debugging API** · App.A–C) + APM Vol.2 §15.34 [1][8]
**Owns:** the SEV/SNP threat model · SEV enablement · ASID-to-key binding and the reuse protocol · the key hierarchy · platform and guest state machines · the firmware command set · guest policy · launch measurement · every `SEV_STATUS` bit
**Scope:** **Server scope.** SEV is productised on EPYC. Zen 4 and later client parts expose SME only, and SEV-SNP has never been available on a client part. Read this chapter for EPYC questions; client memory encryption is `11-memory-encryption.md`.
**See also:** `11-memory-encryption.md` (what the client has, and every `Fn8000_001F` field) · `13-sev-es-ghcb.md` (VMSA, `#VC`, GHCB) · `14-sev-snp.md` (RMP, VMPL, the SNP firmware ABI) · `02-vmcb.md` (VMCB offsets) · `17-security.md` (CVEs) · `90-dated-landscape.md` · `errata.md` E12, E16, E24, O1, O5

---

## 12.1 The threat model: what SEV protects and what it does not

Every confidential-computing answer is framed by a threat model, and the SEV family has had two of them.
State which one applies before discussing any mechanism.

- **Claim.** SEV and SEV-ES use the threat model of a **"benign but vulnerable" hypervisor**: the hypervisor is not assumed to be fully secure, but it is trusted to act with benign intent, so the technologies limit the exposure of hypervisor bugs rather than defending against a hypervisor that is actively hostile.  `[SNP-WP 70366 p.5]` `[17]` `C:high` `V:durable`
- **Claim.** Under SEV-SNP the AMD SOC hardware, the AMD-SP and the VM itself are treated as **fully trusted**, and **all other CPU software components and PCI devices are treated as fully untrusted** — host BIOS, the hypervisor, device drivers, cloud management software and other VMs — where "fully untrusted" means they are assumed to be malicious and possibly conspiring.  `[SNP-WP 70366 p.5]` `[17]` `C:high` `V:durable`
- **Claim.** Confidentiality of VM memory is addressed by hardware memory encryption in **all** current SEV technologies; confidentiality of VM **register** state was added by SEV-ES, which encrypts that state when the VM exits to the hypervisor, and persists in SEV-SNP (`13-sev-es-ghcb.md`).  `[SNP-WP 70366 p.5]` `[17]` `C:high` `V:durable`
- **Claim.** **Integrity** — replay, corruption, aliasing and re-mapping of guest memory — is addressed by SEV-SNP and not by SEV or SEV-ES; SNP's stated guarantee is that if a VM can read a private page it must read the value it last wrote, or take an exception (`14-sev-snp.md`).  `[SNP-WP 70366 p.4]` `[17]` `C:high` `V:durable`

What is explicitly **out of scope** in every generation:

- **Claim.** **Availability of the guest is not part of any SEV threat model**: a malicious hypervisor can always choose never to run some or all of a guest VM, and all SEV technologies deliberately preserve the hypervisor's ability to regain control or terminate a guest at any time without the guest's consent.  `[SNP-WP 70366 p.5]` `[17]` `C:high` `V:durable`
- **Claim.** Offline DRAM analysis such as cold-boot attack is blocked, but **on-line DRAM integrity attacks — attacking the DDR bus while the VM is running — are out of scope**.  `[SNP-WP 70366 p.5]` `[17]` `C:high` `V:durable`
- **Claim.** **Architectural side-channel attacks on CPU data structures are not prevented by any hardware means** in these technologies; software sensitive to them, such as cryptographic libraries, must be written to resist them, exactly as on a non-encrypted system.  `[SNP-WP 70366 p.6]` `[17]` `C:high` `V:durable`
- **Claim.** **Fingerprinting attacks are not mitigated** — determining which code a VM runs by observing access patterns, page faults or performance-counter data — because the SEV technologies focus on protecting VM *data* rather than concealing which software is running.  `[SNP-WP 70366 p.6]` `[17]` `C:high` `V:durable`

Two consequences that follow directly and are worth stating to anyone deploying SEV:

- **Claim.** A guest's I/O necessarily travels through **shared (unencrypted)** memory, so ordinary software protocols such as TLS remain necessary for I/O confidentiality; AMD additionally recommends full-disk encryption inside protected VMs because all SEV technologies protect only data **in use**.  `[SNP-WP 70366 p.4]` `[17]` `C:high` `V:durable`

> **Sourcing note.** Publication 70366 is a **white paper and carries AMD's "goals rather than
> commitments" disclaimer**. It is cited here only for the threat model, which is a design statement and
> is not available in normative form. Every bit-level value in this chapter is anchored to the APM or to
> the SEV API specification instead.

## 12.2 Enabling SEV

SEV has a global gate (SYSCFG) and a per-VM gate (the VMCB), and VMRUN enforces three additional
consistency checks when the per-VM gate is set.

- **Claim.** Software must first set `MemEncryptionModEn` to 1 in the SYSCFG MSR (`11-memory-encryption.md`); SEV is then enabled on a specific virtual machine during VMRUN if the hypervisor sets the **SEV enable bit, bit 1, in VMCB offset `090h`** (`02-vmcb.md`).  `[APM2 §15.34.3]` `[1]` `C:high` `V:durable`
- **Claim.** If `MemEncryptionModEn` is 0, SEV cannot be enabled and the VMCB control bit for SEV is simply **ignored** rather than faulting (`02-vmcb.md`).  `[APM2 §15.34.3]` `[1]` `C:high` `V:durable`
- **Claim.** When SEV is enabled in the VMCB, VMRUN performs three additional consistency checks: **nested paging must be enabled**, the **`SmmLock` bit in the HWCR MSR must be set**, and the **ASID must not exceed `Fn8000_001F_ECX[NumEncryptedGuests]`**; failing any of them terminates VMRUN with `VMEXIT_INVALID` (`04-world-switch.md`, `05-exit-decoding.md`).  `[APM2 §15.34.3]` `[1]` `C:high` `V:durable`
- **Claim.** On systems reporting `Fn8000_001F_EAX[64BitHost]`, the hypervisor **must be in 64-bit mode** to execute VMRUN into an SEV-enabled guest, or VMRUN fails with `VMEXIT_INVALID` (`11-memory-encryption.md`).  `[APM2 §15.34.3]` `[1]` `C:high` `V:durable`
- **Claim.** SEV may be enabled on guests running in **any** operating mode, but the guest can only *control* encryption in long mode or legacy PAE mode; in every other mode all guest memory accesses are unconditionally private and encrypted with the guest key.  `[APM2 §15.34.4]` `[1]` `C:high` `V:durable`

### 12.2.1 What the guest can and cannot mark shared

- **Claim.** With SEV enabled the guest page tables determine the encryption status of each page, but this control exists **only for data pages**: accesses on behalf of **instruction fetches and guest page-table walks are always treated as private**, regardless of the software value of the C-bit, which prevents non-guest entities from injecting code or page tables into the guest (`11-memory-encryption.md`).  `[APM2 §15.34.5]` `[1]` `C:high` `V:durable`
- **Claim.** If a guest wants data in an instruction page or a page table to be visible outside the guest, it must **explicitly copy that data into a shared data page**; setting the C-bit to 0 on such a page is a don't-care because hardware performs those accesses as private anyway (`11-memory-encryption.md`).  `[APM2 §15.34.5]` `[1]` `C:high` `V:durable`
- **Claim.** Where the guest and the nested page tables disagree, the **guest tables win**: a page marked C=0 by the guest but C=1 in the nested tables is encrypted with the **host (SME) key**, and a page marked C=1 by the guest is encrypted with the **guest key** whatever the nested entry says (`06-nested-paging.md`, `11-memory-encryption.md`).  `[APM2 §15.34.8]` `[1]` `C:high` `V:durable`
- **Claim.** During a nested page-table walk both sets of tables may be encrypted at once: the guest page tables are decrypted with the **guest private** key and the nested page tables with the **host (SME)** key (`06-nested-paging.md`).  `[APM2 §15.34.8]` `[1]` `C:high` `V:durable`
- **Claim.** SEV is considered **active** when the CPU is in guest mode **and** the guest has SEV enabled in the VMCB — "SEV supported", "SEV enabled" and "SEV active" are three different conditions (`02-vmcb.md`).  `[APM2 §15.34.8]` `[1]` `C:high` `V:durable`

### 12.2.2 Virtual Transparent Encryption

VTE is the SEV analogue of TSME: it takes the choice away from the guest.

- **Claim.** Virtual Transparent Encryption forces **all** memory accesses within an SEV guest to be encrypted with the guest's key; support is reported by `Fn8000_001F_EAX` bit 16 and it is enabled by setting **VMCB offset `90h` bit 5** (`02-vmcb.md`, `11-memory-encryption.md`).  `[APM2 §15.34.11]` `[1]` `C:high` `V:durable`
- **Claim.** VMCB `90h` bit 5 is observed **only** when SEV (bit 1) is also 1 **and** SEV-ES (bit 2) is 0; in every other configuration hardware ignores it (`02-vmcb.md`).  `[APM2 §15.34.11]` `[1]` `C:high` `V:durable`
- **Claim.** With VTE enabled the CPU treats the guest C-bit as 1 for every guest memory reference and ignores the actual C-bit in the guest page tables, while guest address translation is unchanged — the guest physical address without the C-bit is still what walks the nested page tables (`11-memory-encryption.md`).  `[APM2 §15.34.11]` `[1]` `C:high` `V:durable`

## 12.3 ASIDs and encryption keys

The ASID is not merely a TLB tag under SEV; it is the index into the memory controller's key slots.

- **Claim.** Each SEV-enabled guest is associated with a memory encryption key, and the **ASID is used as the key index** identifying which key encrypts and decrypts the memory traffic of that guest; the SME mode, if also used, has a separate key (`06-nested-paging.md`, `11-memory-encryption.md`).  `[APM2 §15.34.2]` `[1]` `C:high` `V:durable`
- **Claim.** CPU software is never aware of the key values; the hypervisor coordinates key loading through the AMD-SP driver, and that coordination also determines which ASID the hypervisor should use for a given guest.  `[APM2 §15.34.2]` `[1]` `C:high` `V:durable`
- **Claim.** Encryption keys are **never visible to CPU software and are never stored off-chip in the clear**.  `[APM2 §15.34.2]` `[1]` `C:high` `V:durable`
- **Claim.** The number of guests the firmware can manage is conceptually unlimited; what is limited is the number of **ASIDs that can be simultaneously associated with keys**, which is why the API provides ACTIVATE, DEACTIVATE and DF_FLUSH to overcommit ASIDs across guests.  `[SEV-API 3.24 §1.3.2]` `[8]` `C:high` `V:durable`

### 12.3.1 The ASID range is partitioned by SEV-ES, not shared

This is the most commonly missed rule in the whole chapter, and it is why a hypervisor can run out of
"SEV ASIDs" while plenty of ASIDs are free.

- **Claim.** If a guest is SEV-ES enabled its ASID must be **at least 1h and at most (MIN_SEV_ASID − 1)**; if it is not SEV-ES enabled its ASID must be **at least MIN_SEV_ASID and at most the maximum SEV ASID available**. `MIN_SEV_ASID` comes from `Fn8000_001F[EDX]` and the maximum from `Fn8000_001F[ECX]` (`11-memory-encryption.md`).  `[SEV-API 3.24 §6.19.1]` `[8]` `C:high` `V:durable`
- **Claim.** The APM states the same partition from the other direction: SEV-ES may be enabled on any valid SEV ASID, but if `Fn8000_001F[EDX]` returns 5 then any VM using ASIDs 1–4 that enables SEV **must also enable SEV-ES** (`11-memory-encryption.md`, `13-sev-es-ghcb.md`).  `[APM2 §15.35.2]` `[1]` `C:high` `V:durable`
- **Claim.** ACTIVATE additionally requires that the ASID be non-zero, be a valid SEV ASID, and **not be currently used by another guest**; the guest must be inactive at the time.  `[SEV-API 3.24 §6.19.1]` `[8]` `C:high` `V:durable`
- **Claim.** ACTIVATE loads the guest's VEK into the memory-controller slot identified by the ASID, and the ASID is marked valid on all cores when the guest transitions to RUNNING — or immediately, if it is already RUNNING.  `[SEV-API 3.24 §6.19.1]` `[8]` `C:high` `V:durable`

## 12.4 ASID reuse: DEACTIVATE, WBINVD and DF_FLUSH

Reusing an ASID means reprogramming a key slot while cache lines and data-fabric write buffers may still
hold plaintext or differently-keyed ciphertext belonging to the previous tenant. The firmware refuses to
let that happen and enforces an explicit three-step handshake.

1. **DEACTIVATE** the guest. The firmware uninstalls the key from the memory controller, marks the ASID
   invalid on all cores, and records that a DF_FLUSH is required for that ASID.
2. **`WBINVD`** on every hardware thread the guest was active on.
3. **DF_FLUSH**, which verifies step 2 happened and flushes the data-fabric write buffers.

- **Claim.** DEACTIVATE dissociates the guest from its ASID: the firmware uninstalls the guest's key from the memory controller, marks the ASID invalid on all cores, disallows use of the ASID by all CCXs, and **records that a DF_FLUSH is required for this ASID**.  `[SEV-API 3.24 §6.21.1]` `[8]` `C:high` `V:durable`
- **Claim.** The x86 system software **must execute `WBINVD` on the hardware threads the previous guest was active on before invoking DF_FLUSH**; DF_FLUSH then flushes the data-fabric write buffers for each core and records that the flush has been performed for **all** deactivated ASIDs.  `[SEV-API 3.24 §6.22.1]` `[8]` `C:high` `V:durable`
- **Claim.** ACTIVATE requires that a successful DF_FLUSH has been executed since the last DEACTIVATE for that ASID.  `[SEV-API 3.24 §6.19.1]` `[8]` `C:high` `V:durable`
- **Claim.** Because DF_FLUSH marks **all** previously deactivated ASIDs usable at once, a hypervisor may batch many DEACTIVATE calls and flush the cache and data fabric only once afterwards.  `[SEV-API 3.24 §1.3.2]` `[8]` `C:high` `V:durable`
- **Claim.** The enforcement exists so that any unencrypted data in caches and data-fabric write buffers associated with the **previous** key value is written back to memory **before** the key can be changed.  `[SEV-API 3.24 §1.3.2]` `[8]` `C:high` `V:durable`

The two status codes that drive this loop:

- **Claim.** `WBINVD_REQUIRED` is status code **`0x000E`** ("WBINVD instruction required") and `DF_FLUSH_REQUIRED` is **`0x000F`** ("DF_FLUSH invocation required"); DF_FLUSH itself returns `WBINVD_REQUIRED` when the `WBINVD` has not been executed. The names `SEV_RET_WBINVD_REQUIRED` and `SEV_RET_DFFLUSH_REQUIRED` are the Linux spellings of the same two codes.  `[SEV-API 3.24 §4.5]` `[8][350]` `C:high` `V:durable`

### 12.4.1 Reading an encrypted page from the hypervisor

The hypervisor sometimes needs the *current* contents of a guest page — for migration, for swapping, or
for debug. Without coherency across encryption domains, an ordinary `CLFLUSH` is not enough.

- **Claim.** As with SME, some implementations do not enforce coherency between mappings of the same physical page with different encryption enablement or keys, so before changing the enablement or key for a page software must ensure the page is flushed from all CPU caches; the flush is not required when `Fn8000_001F_EAX[10]` reports hardware coherency across encryption domains (`11-memory-encryption.md`).  `[APM2 §15.34.7]` `[1]` `C:high` `V:durable`
- **Claim.** To read an encrypted page the hypervisor must first flush the guest's view of it, either by issuing `WBINVD` on every core the guest has run on or by using the **`VMPAGE_FLUSH` MSR (`C001_011E`)**, whose support is reported by `Fn8000_001F[EAX]` bit 2 (`11-memory-encryption.md`).  `[APM2 §15.34.9]` `[1]` `C:high` `V:durable`
- **Claim.** `VMPAGE_FLUSH` is **write-only** and flushes 4 KB on behalf of a guest: bits **63:12 are `VirtualAddr`**, the host virtual address of the page to flush, and bits **11:0 are `ASID`**, the guest ASID to use for the flush; hardware then performs a write-back invalidation causing any dirty data in any CPU cache in the system to be encrypted and written to DRAM.  `[APM2 §15.34.9]` `[1]` `C:high` `V:durable`
- **Claim.** `VMPAGE_FLUSH` translates through the **standard host page tables**, and it will hit and evict guest-cached instances of the memory where a `CLFLUSH` using the same translation will **not**.  `[APM2 §15.34.9]` `[1]` `C:high` `V:durable`
- **Claim.** `VMPAGE_FLUSH` only flushes pages the guest marked **private**; if the hypervisor does not know whether the page was private it should issue a `CLFLUSH` in addition. Flushing an unmapped host virtual address, or using ASID 0, raises **`#GP(0)`**, and when SMAP is enabled the input address must be mapped as a supervisor address.  `[APM2 §15.34.9]` `[1]` `C:high` `V:durable`
- **Claim.** Where coherency across encryption domains **is** supported, plain `CLFLUSH` suffices to evict guest pages from the cache whether or not the guest marked them private.  `[APM2 §15.34.9]` `[1]` `C:high` `V:durable`

## 12.5 The key hierarchy

Eleven named keys, two roots of trust, and one memory encryption key per guest.

| Key | Abbr. | Algorithm | Usage |
|---|---|---|---|
| Platform Diffie-Hellman Key | PDH | ECDH curve P-384 | key agreement |
| Platform Endorsement Key | PEK | ECDSA curve P-384 | signs the PDH |
| Chip Endorsement Key | CEK | ECDSA curve P-384 | signs the PEK |
| AMD SEV Signing Key | ASK | RSA 2048 | signs the CEK |
| AMD Root Key | ARK | RSA 2048 | signs the ASK; **AMD root of trust** |
| Owner Certificate Authority | OCA | ECDSA curve P-384 | signs the PEK; **platform-owner root of trust** |
| Transport Integrity Key | TIK | HMAC SHA-256 | trusted-channel integrity |
| Transport Encryption Key | TEK | AES 128 | trusted-channel confidentiality |
| Key Encryption Key | KEK | AES 128 | key wrapping |
| Key Integrity Key | KIK | HMAC SHA-256 | key wrapping |
| VM Encryption Key | VEK | AES 128 | guest memory encryption |

- **Claim.** The SEV API defines exactly the eleven keys above with those abbreviations, algorithms and usages.  `[SEV-API 3.24 Table 1]` `[8]` `C:high` `V:durable`
- **Claim.** The PEK is signed by **two** keys, connecting it to two different roots of trust: the CEK anchors it to the **ARK** (device authenticity) and the OCA anchors it to the **platform owner** (ownership); both signatures are exported by `PDH_CERT_EXPORT`.  `[SEV-API 3.24 §1.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** Each chip has a unique CEK **derived from secrets stored in chip-unique OTP fuses**, and its lifetime is the lifetime of the individual chip; the ASK and ARK private keys are held by the AMD Key Distribution Server and their lifetime is the lifetime of the product line.  `[SEV-API 3.24 §2.1.3]` `[8]` `C:high` `V:durable`
- **Claim.** A platform may be **self-owned**, in which case the firmware generates and stores both halves of the OCA key pair and no entity outside the firmware has the private key, or **externally owned**, in which case the firmware stores only the OCA public key. Ownership is taken by importing a signed PEK certificate with `PEK_CERT_IMPORT`.  `[SEV-API 3.24 §2.1.5]` `[8]` `C:high` `V:durable`
- **Claim.** The VEK is an AES-128 key generated by the firmware from a secure entropy source; its lifetime is the lifetime of the guest **on this platform**, and a migrated guest uses a **different** VEK generated by the remote platform.  `[SEV-API 3.24 §2.1.11]` `[8]` `C:high` `V:durable`
- **Claim.** The TIK, TEK, KEK and KIK all live for exactly one send, receive or launch session and are destroyed when `SEND_FINISH`, `RECEIVE_FINISH` or `LAUNCH_FINISH` is invoked.  `[SEV-API 3.24 §2.1.7]` `[8]` `C:high` `V:durable`

### 12.5.1 Deriving the session keys

- **Claim.** The KDF is the **counter-mode KDF of NIST SP 800-108 §5.1 with HMAC-SHA-256 as the PRF**, with `r` set to 32 and the length in bits of `[L]` equal to 32.  `[SEV-API 3.24 §2.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** Key agreement uses ECDH following the **Static Unified Model of NIST SP 800-56A §6.3.2**: the client retrieves the server's ECDH public key, transmits its own public key and **a fresh nonce N**, both sides compute the shared secret Z, and the master secret M is derived by the KDF with secret input Z, label `"sev-master-secret"` (17 ASCII bytes) and context N; Z must be securely deleted afterwards.  `[SEV-API 3.24 §2.2.2]` `[8]` `C:high` `V:durable`
- **Claim.** The KEK is derived from M with label `"sev-kek"` (7 ASCII bytes) and no context; the KIK from M with label `"sev-kik"` (7 ASCII bytes) and no context. The TEK and TIK are concatenated in that order, encrypted under the KEK and integrity-protected under the KIK with a freshly generated IV.  `[SEV-API 3.24 §2.2.3]` `[8]` `C:high` `V:durable`
- **Claim.** The common data-protection scheme is **AES-128-CTR for confidentiality and HMAC-SHA-256 for integrity**, producing `C = AES-128-CTR(M; K, IV)` and `MAC = HMAC-SHA-256(IV || C; I)`; **two different messages must never be protected with the same IV and K**, and an IV may only be reused under a different K.  `[SEV-API 3.24 §2.2.4]` `[8]` `C:high` `V:durable`

### 12.5.2 The attestation protocol discipline

Two rules follow from the key hierarchy rather than from any procedural text, and both are load-bearing.

- **Claim.** The launch measurement is **keyed with the TIK**, which the guest owner generates and wraps to the platform; the hypervisor never holds it. Verification of a launch measurement therefore can only be performed by the party holding the TIK — by construction not the host being attested.  `[SEV-API 3.24 §6.5]` `[8]` `C:high` `V:durable`
- **Claim.** The session blob supplied to `LAUNCH_START` carries a **`NONCE` at offset `00h` (128 bits)**, `WRAP_TK` at `10h` (256 bits, the TEK and TIK concatenated and encrypted with the KEK), `WRAP_IV` at `30h` (128 bits), `WRAP_MAC` at `40h` (256 bits, HMAC over `WRAP_TK` using the KIK) and `POLICY_MAC` at `60h` (256 bits, HMAC over `POLICY` using the TIK) — so a fresh session, and a fresh nonce, is required per launch attempt.  `[SEV-API 3.24 Table 45]` `[8]` `C:high` `V:durable`

## 12.6 The `SEV_STATUS` MSR

`SEV_STATUS` is how a guest discovers what it is actually running under. It is the one MSR a confidential
guest can always trust.

- **Claim.** Guests read the currently active SEV features from the **`SEV_STATUS` MSR at `C001_0131`**, which reports which features were enabled in the last VMRUN for that guest; it is **read-only**, accesses to it **cannot be intercepted by the hypervisor**, and it is available on every processor that supports SEV.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`

| Bit | Field | Source |
|---|---|---|
| 63:24 | Reserved | — |
| 23 | `IbpbOnEntry_Active` | `SEV_FEATURES[21]` |
| 22:19 | Reserved (see note) | — |
| 18 | `SecureAVIC_Active` | `SEV_FEATURES[16]` |
| 17 | `SmtProtection_Active` | `SEV_FEATURES[15]` |
| 16 | `VmsaRegProt_Active` | `SEV_FEATURES[14]` |
| 15 | `GuestInterceptCtl_Active` | `SEV_FEATURES[13]` |
| 14 | `IbsVirtualization_Active` | `SEV_FEATURES[12]` |
| 13 | `PmcVirtualization_Active` | `SEV_FEATURES[11]` |
| 12 | `VmgexitParameter_Active` | `SEV_FEATURES[10]` |
| 11 | `SecureTsc_Active` | `SEV_FEATURES[9]` |
| 10 | `VmplSSS_Active` | `SEV_FEATURES[8]` |
| 9 | `SNPBTBIsolation_Active` | `SEV_FEATURES[7]` |
| 8 | `PreventHostIBS_Active` | `SEV_FEATURES[6]` |
| 7 | `DebugVirtualization_Active` | `SEV_FEATURES[5]` |
| 6 | `AlternateInjection_Active` | `SEV_FEATURES[4]` |
| 5 | `RestrictedInjection_Active` | `SEV_FEATURES[3]` |
| 4 | `ReflectVC_Active` | `SEV_FEATURES[2]` |
| 3 | `vTOM_Active` | `SEV_FEATURES[1]` |
| 2 | `SNP_Active` | `SEV_FEATURES[0]` |
| 1 | `SEV_ES_Enabled` | VMCB offset `90h` |
| 0 | `SEV_Enabled` | VMCB offset `90h` |

- **Claim.** `SEV_STATUS` defines every field in the table above, from `SEV_Enabled` at bit 0 through `IbpbOnEntry_Active` at bit 23; bit 2 is **`SNP_Active`**, bit 3 `vTOM_Active`, bit 4 `ReflectVC_Active`, bit 5 `RestrictedInjection_Active`, bit 6 `AlternateInjection_Active`, bit 7 **`DebugVirtualization_Active`**, bit 11 `SecureTsc_Active`, bit 16 `VmsaRegProt_Active` and bit 18 `SecureAVIC_Active`.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`
- **Claim.** Bits 0 and 1 are sourced from the VMCB, and **every bit from 2 upward mirrors `SEV_FEATURES[n − 2]`** in the VMSA — the reason `DebugVirtualization` is `SEV_FEATURES[5]` but `SEV_STATUS[7]`. A table written in `SEV_FEATURES` terms, such as a Linux header, is offset by exactly two from this one and is not in conflict with it (`13-sev-es-ghcb.md` owns `SEV_FEATURES` and the VMSA).  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`

> **AMD's own table has a typographical defect.** Table 15-32 prints a row reading "22-18 Reserved"
> immediately above the row that defines bit 18 as `SecureAVIC_Active`. The two cannot both be true; read
> the reserved range as **22:19**. This is noted rather than silently corrected because a reader checking
> against the PDF will see the printed form.

- **Claim.** `DebugVirtualization` is AMD's name for bit 7 and the name used throughout this skill; the Linux kernel calls the same bit something else, and only `errata.md` E24 records the alternative spelling.  `[APM2 §15.34.10]` `[1]` `C:high` `V:durable`

Note what is **not** in `SEV_STATUS`: there is no bit for SEV-SNP *support*, only for SNP being *active*
for this VM. Support lives in `Fn8000_001F_EAX[4]` (`11-memory-encryption.md`), global enablement in
`SYSCFG[SecureNestedPagingEn]`, and per-VM activation here — three separate conditions, in that order.

## 12.7 Platform and guest state machines

The firmware refuses commands that are wrong for the current state, so the state machines are the first
thing to check when a command returns `INVALID_PLATFORM_STATE` or `INVALID_GUEST_STATE`.

### 12.7.1 PSTATE — three states

| State | Value | Description |
|---|---|---|
| `UNINIT` | `0h` | the platform is uninitialized |
| `INIT` | `1h` | initialized but not currently managing any guests |
| `WORKING` | `2h` | initialized and currently managing guests |

- **Claim.** The platform finite state machine PSTATE has exactly three states — `UNINIT` (0h), `INIT` (1h) and `WORKING` (2h) — and **guest commands are only valid in the INIT and WORKING platform states**.  `[SEV-API 3.24 §5.1.2]` `[8]` `C:high` `V:durable`
- **Claim.** In `UNINIT` the allowed platform commands are INIT, PLATFORM_RESET, PLATFORM_STATUS, DOWNLOAD_FIRMWARE, GET_ID, DF_FLUSH and NOP; in `INIT` they are SHUTDOWN, PLATFORM_STATUS, PEK_GEN, PEK_CSR, PEK_CERT_IMPORT, PDH_GEN, PDH_CERT_EXPORT, DF_FLUSH, GET_ID, NOP and RING_BUFFER; in `WORKING` the PEK commands drop out, leaving SHUTDOWN, PLATFORM_STATUS, PDH_GEN, PDH_CERT_EXPORT, DF_FLUSH, GET_ID, NOP and RING_BUFFER.  `[SEV-API 3.24 Table 16]` `[8]` `C:high` `V:durable`
- **Claim.** The platform context PCTX holds STATE, CONFIG, PDH, PEK, CEK, OCA, GUEST_COUNT and GUESTS; the persistent identity written to non-volatile storage is the PDH key pair and certificate, the PEK key pair and certificate, the OCA public key, the OCA private key when self-owned, and the OCA certificate — all stored encrypted and integrity protected.  `[SEV-API 3.24 §5.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** If a power failure corrupts the persistent store, the next INIT returns an integrity-check failure and the platform must be reset with **PLATFORM_RESET**.  `[SEV-API 3.24 §5.1.5]` `[8]` `C:high` `V:durable`
- **Claim.** Firmware volatile state survives S0–S3 and is lost across S4, S5 and mechanical off, after which the firmware starts from reset and must be re-initialized.  `[SEV-API 3.24 Table 17]` `[8]` `C:high` `V:durable`
- **Claim.** SEV-ES requires the x86 system software to **donate a 1 MB region aligned on a 1 MB boundary** to the firmware for exclusive use until SHUTDOWN — the Trusted Memory Region — and x86 attempts to access it while donated raise exceptions that frequently destabilise the system (`13-sev-es-ghcb.md`).  `[SEV-API 3.24 §5.1.7]` `[8]` `C:high` `V:durable`

### 12.7.2 GSTATE — seven states

The pre-rebuild corpus listed five. There are seven.

| State | Value | Description | Allowed guest commands |
|---|---|---|---|
| `UNINIT` | `0h` | the guest is uninitialized | LAUNCH_START, RECEIVE_START |
| `LUPDATE` | `1h` | being launched; plaintext data and VMCB save areas are being imported | LAUNCH_UPDATE_DATA, LAUNCH_UPDATE_VMSA, LAUNCH_MEASURE, ACTIVATE, DEACTIVATE, DECOMMISSION, GUEST_STATUS |
| `LSECRET` | `2h` | being launched; ciphertext data is being imported | LAUNCH_SECRET, LAUNCH_FINISH, ACTIVATE, DEACTIVATE, DECOMMISSION, GUEST_STATUS, ATTESTATION |
| `RUNNING` | `3h` | fully launched or migrated in, not being migrated out | ACTIVATE, DEACTIVATE, DECOMMISSION, SEND_START, GUEST_STATUS, ATTESTATION |
| `SUPDATE` | `4h` | being migrated out to another machine | SEND_UPDATE_DATA, SEND_UPDATE_VMSA, SEND_FINISH, ACTIVATE, DEACTIVATE, DECOMMISSION, GUEST_STATUS, ATTESTATION, SEND_CANCEL |
| `RUPDATE` | `5h` | being migrated in from another machine | RECEIVE_UPDATE_DATA, RECEIVE_UPDATE_VMSA, RECEIVE_FINISH, ACTIVATE, DEACTIVATE, DECOMMISSION, GUEST_STATUS |
| `SENT` | `6h` | has been sent to another machine | DEACTIVATE, DECOMMISSION |

- **Claim.** The guest finite state machine GSTATE has **seven** states — `UNINIT` 0h, `LUPDATE` 1h, `LSECRET` 2h, `RUNNING` 3h, `SUPDATE` 4h, `RUPDATE` 5h and `SENT` 6h — with the command sets shown above.  `[SEV-API 3.24 Table 43]` `[8]` `C:high` `V:durable`
- **Claim.** The guest context GCTX holds STATE, HANDLE, ASID, ACTIVE, POLICY, VEK, NONCE, MS, TEK, TIK and **LD, the launch digest context**.  `[SEV-API 3.24 Table 42]` `[8]` `C:high` `V:durable`
- **Claim.** `LAUNCH_START` and `RECEIVE_START` are the **only** two commands that create a new guest context and guest handle.  `[SEV-API 3.24 §1.3.3]` `[8]` `C:high` `V:durable`
- **Claim.** `LAUNCH_START` with a non-zero HANDLE **copies the VEK of the referenced guest** into the new context after checking that the handle is valid, that the referenced guest's policy equals the supplied POLICY and that **`POLICY.NOKS` is zero**; with HANDLE zero, a fresh VEK is generated.  `[SEV-API 3.24 §6.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** `DECOMMISSION` deletes all guest context and invalidates the handle, and **guests that shared their VEK with this guest are not affected**.  `[SEV-API 3.24 §6.23]` `[8]` `C:high` `V:durable`

## 12.8 The firmware command set

The x86 driver reaches the AMD-SP through three MMIO registers in the PSP device's PCI memory space.

- **Claim.** The SEV API exposes three memory-mapped registers — `CmdResp`, `CmdBufAddr_Hi` and `CmdBufAddr_Lo`. In `CmdResp`, bit **31** is 0 for a command and 1 for a response, bits **30:26** are reserved and must be zero, bits **25:16** carry the **Command ID**, and bits **15:0** carry the 16-bit status code on a response or, on a command, an interrupt-on-completion request in bit 0 with the remaining bits reserved.  `[SEV-API 3.24 §4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Relative to the base address BIOS assigns to the PSP device's MMIO space, `CmdResp` is register 32 (offset **128**), `CmdBufAddr_Lo` is register 56 (offset **224**) and `CmdBufAddr_Hi` is register 57 (offset **228**).  `[SEV-API 3.24 §4.1.1]` `[8]` `C:high` `V:durable`
- **Claim.** Ring Buffer mode is entered with the `RING_BUFFER` command issued from Mailbox mode, after which `CmdResp` becomes `RBCtl`, `CmdBufAddr_Hi` becomes `RBTail` and `CmdBufAddr_Lo` becomes `RBHead`; there is a required low-priority queue and an optional high-priority queue, and the high-priority queue is drained first.  `[SEV-API 3.24 §4.2]` `[8]` `C:high` `V:durable`
- **Claim.** A `CmdPtr` ring entry is **16 bytes**: Command Identifier at `00h` (bits 15:0), Command Flags at `02h`, Software Data at `04h` (32 bits, arbitrary to software) and the Command Buffer Pointer at `08h` (64 bits). The Command Flags define **bit 0 `InterruptOnCompletion`** and **bit 1 `ContinueOnError`**, with bits 15:2 reserved and MBZ.  `[SEV-API 3.24 Table 6]` `[8]` `C:high` `V:durable`
- **Claim.** The API processes commands **serially**: software must not issue a further command before receiving the response to the previous one, and any command sent early must be ignored by the firmware with no change to the platform or any guest context.  `[SEV-API 3.24 §4.7]` `[8]` `C:high` `V:durable`
- **Claim.** All pointers passed to the firmware are **64-bit system physical addresses**, and each is rejected with `INVALID_ADDRESS` if bits **46:43** are non-zero, if it overlaps `TSseg` or `ASeg`, if it is above the maximum physical address `7FD_0000_0000`, or if it lies within a Trusted Memory Region that disallows x86 access.  `[SEV-API 3.24 §4.8]` `[8]` `C:high` `V:durable`

### 12.8.1 Command identifiers

| Command | ID | API | Command | ID | API |
|---|---|---|---|---|---|
| `INIT` | `001h` | 16 | `LAUNCH_START` | `030h` | 16 |
| `SHUTDOWN` | `002h` | 16 | `LAUNCH_UPDATE_DATA` | `031h` | 16 |
| `PLATFORM_RESET` | `003h` | 16 | `LAUNCH_UPDATE_VMSA` | `032h` | 16 |
| `PLATFORM_STATUS` | `004h` | 16 | `LAUNCH_MEASURE` | `033h` | 16 |
| `PEK_GEN` | `005h` | 16 | `LAUNCH_UPDATE_SECRET` | `034h` | 16 |
| `PEK_CSR` | `006h` | 16 | `LAUNCH_FINISH` | `035h` | 16 |
| `PEK_CERT_IMPORT` | `007h` | 16 | `ATTESTATION` | `036h` | 23 |
| `PDH_CERT_EXPORT` | `008h` | 16 | `SEND_START` | `040h` | 16 |
| `PDH_GEN` | `009h` | 16 | `SEND_UPDATE_DATA` | `041h` | 16 |
| `DF_FLUSH` | `00Ah` | 16 | `SEND_UPDATE_VMSA` | `042h` | 16 |
| `DOWNLOAD_FIRMWARE` | `00Bh` | 16 | `SEND_FINISH` | `043h` | 16 |
| `GET_ID` | `00Ch` | 16 | `SEND_CANCEL` | `044h` | 23 |
| `INIT_EX` | `00Dh` | 18 | `RECEIVE_START` | `050h` | 16 |
| `NOP` | `00Eh` | 23 | `RECEIVE_UPDATE_DATA` | `051h` | 16 |
| `RING_BUFFER` | `00Fh` | 24 | `RECEIVE_UPDATE_VMSA` | `052h` | 16 |
| `DECOMMISSION` | `020h` | 16 | `RECEIVE_FINISH` | `053h` | 16 |
| `ACTIVATE` | `021h` | 16 | `DBG_DECRYPT` | `060h` | 16 |
| `DEACTIVATE` | `022h` | 16 | `DBG_ENCRYPT` | `061h` | 16 |
| `GUEST_STATUS` | `023h` | 16 | `SWAP_OUT` | `070h` | 23 |
| `COPY` | `024h` | 17 | `SWAP_IN` | `071h` | 23 |
| `ACTIVATE_EX` | `025h` | 18 | | | |

- **Claim.** Table 13 of the SEV API defines the command identifiers above; the **API column is the API version in which each command first appeared, and the first public SEV API version was 0.16**.  `[SEV-API 3.24 Table 13]` `[8]` `C:high` `V:durable`

> **Two naming traps in AMD's own document.** The command table calls `034h`
> **`LAUNCH_UPDATE_SECRET`** while §6.6 heads the same command **`LAUNCH_SECRET`**, and the heading of
> §6.8 is spelled **"ATTESTATON"** (and Table 61 "ATTESATION") although the command table and the state
> machine both say `ATTESTATION`. Search for both spellings.

### 12.8.2 Status codes

| Code | Name | Code | Name |
|---|---|---|---|
| `0x0000` | `SUCCESS` | `0x000D` | `INVALID_ASID` |
| `0x0001` | `INVALID_PLATFORM_STATE` | `0x000E` | `WBINVD_REQUIRED` |
| `0x0002` | `INVALID_GUEST_STATE` | `0x000F` | `DF_FLUSH_REQUIRED` |
| `0x0003` | `INVALID_CONFIG` | `0x0010` | `INVALID_GUEST` |
| `0x0004` | `INVALID_LENGTH` | `0x0011` | `INVALID_COMMAND` |
| `0x0005` | `ALREADY_OWNED` | `0x0012` | `ACTIVE` |
| `0x0006` | `INVALID_CERTIFICATE` | `0x0013` | `HWERROR_PLATFORM` |
| `0x0007` | `POLICY_FAILURE` | `0x0014` | `HWERROR_UNSAFE` |
| `0x0008` | `INACTIVE` | `0x0015` | `UNSUPPORTED` |
| `0x0009` | `INVALID_ADDRESS` | `0x0016` | `INVALID_PARAM` |
| `0x000A` | `BAD_SIGNATURE` | `0x0017` | `RESOURCE_LIMIT` |
| `0x000B` | `BAD_MEASUREMENT` | `0x0018` | `SECURE_DATA_INVALID` |
| `0x000C` | `ASID_OWNED` | `0x001F` | `RB_MODE_EXITED` |

- **Claim.** Table 14 of the SEV API defines the status codes above; the numbering is contiguous from `0x0000` to `0x0018` and then jumps to **`0x001F` `RB_MODE_EXITED`**, returned when a Mailbox-mode command arrives while the firmware is in Ring Buffer mode — Ring Buffer mode is then exited, the command is ignored, and a retry is recommended.  `[SEV-API 3.24 Table 14]` `[8]` `C:high` `V:durable`
- **Claim.** `HWERROR_PLATFORM` (`0x0013`) and `HWERROR_UNSAFE` (`0x0014`) differ in exactly one respect: after `HWERROR_PLATFORM` it is **safe** to re-allocate the parameter buffers and after `HWERROR_UNSAFE` it is **not**.  `[SEV-API 3.24 Table 14]` `[8]` `C:high` `V:durable`

### 12.8.3 The debugging commands

- **Claim.** `DBG_DECRYPT` and `DBG_ENCRYPT` decrypt or encrypt a guest memory region on request, and the **guest policy must allow debugging** for either to execute; `DBG_DECRYPT` decrypts from `SRC_PADDR` for `LENGTH` bytes using `GCTX.VEK` into `DST_PADDR`, leaving guest and platform states unaffected.  `[SEV-API 3.24 §7.1]` `[8]` `C:high` `V:durable`

> **Structure correction.** `errata.md` O5 records that the pre-rebuild corpus asserted a §1–§7 map for
> pub 55766 that did not match the verified structure, summarised as "Ch.1–Ch.6, no §7". The PDF
> bookmark tree of Rev 3.24 shows that **Chapter 7 "Debugging API" does exist** (§7.1 `DBG_DECRYPT`,
> §7.2 `DBG_ENCRYPT`), followed by **Appendix A Usage Flows, Appendix B AMD Certificate Authority
> Certificates and Appendix C SEV Certificates**. The correct statement is that the document has seven
> chapters and three appendices; what the old corpus got wrong was which commands it placed where, not
> the existence of a seventh chapter.

## 12.9 Guest policy

The policy is four bytes, supplied at launch, immutable thereafter, and carried along on migration.

| Offset | Bit(s) | Name | Meaning when set |
|---|---|---|---|
| `000h` | 0 | `NODBG` | debugging of the guest is disallowed |
| | 1 | `NOKS` | sharing keys with other guests is disallowed |
| | 2 | `ES` | SEV-ES is required |
| | 3 | `NOSEND` | sending the guest to another platform is disallowed |
| | 4 | `DOMAIN` | the guest must not be transmitted to a platform outside the domain |
| | 5 | `SEV` | the guest must not be transmitted to a platform that is not SEV capable |
| | 15:6 | Reserved | should be zero |
| `002h` | 7:0 | `API_MAJOR` | minimum destination firmware major version |
| `003h` | 7:0 | `API_MINOR` | minimum destination firmware minor version |

- **Claim.** The guest policy is a **4-byte structure** whose byte `000h` carries `NODBG` (bit 0), `NOKS` (bit 1), `ES` (bit 2), `NOSEND` (bit 3), `DOMAIN` (bit 4) and `SEV` (bit 5) with bits 15:6 reserved and should-be-zero, byte `002h` carrying `API_MAJOR` and byte `003h` carrying `API_MINOR`; read as a little-endian 32-bit word that places `API_MAJOR` at bits **23:16** and `API_MINOR` at bits **31:24**.  `[SEV-API 3.24 Table 2]` `[8]` `C:high` `V:durable`
- **Claim.** The policy is provided to the firmware at guest launch, is **bound to the guest and cannot be changed for its lifetime**, and is transmitted during snapshot and migration and enforced on the destination platform.  `[SEV-API 3.24 Ch.3]` `[8]` `C:high` `V:durable`
- **Claim.** The version check at `LAUNCH_START` requires the platform's major API version to exceed `POLICY.API_MAJOR`, or to equal it with the platform's minor version greater than or equal to `POLICY.API_MINOR`; otherwise an error is returned.  `[SEV-API 3.24 §6.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** If `POLICY.ES` is set and the platform is configured with SEV-ES then SEV-ES is enabled; if `POLICY.ES` is set and the platform is **not** so configured, `LAUNCH_START` returns an error rather than silently downgrading.  `[SEV-API 3.24 §6.2.1]` `[8]` `C:high` `V:durable`
- **Claim.** `SEND_START` enforces the policy's transfer restrictions by verifying the receiving platform's certificates and chains: the policy can require the destination to be SEV-capable, to have the same owner as the sender, or both. `RECEIVE_START`, by contrast, **does not verify the identity of the sending platform**.  `[SEV-API 3.24 §1.3.3]` `[8]` `C:high` `V:durable`
- **Claim.** Policy bits are referenced in AMD's notation as `POLICY.<FLAG_NAME>` — the key-sharing flag is `POLICY.NOKS`.  `[SEV-API 3.24 Ch.3]` `[8]` `C:high` `V:durable`

## 12.10 Launch measurement

The measurement is accumulated across the launch commands and finalized once.

- **Claim.** `LAUNCH_START` initializes the launch digest `GCTX.LD`; each `LAUNCH_UPDATE_DATA` updates `GCTX.LD` with the **plaintext** contents of the region at `PADDR` before encrypting that region in place with the guest's VEK; each `LAUNCH_UPDATE_VMSA` updates `GCTX.LD` with the plaintext contents of the VMCB save area at `PADDR`, prepares it for SEV-ES use and encrypts it in place (`13-sev-es-ghcb.md`).  `[SEV-API 3.24 §6.3.1]` `[8]` `C:high` `V:durable`
- **Claim.** `LAUNCH_UPDATE_DATA` and `LAUNCH_UPDATE_VMSA` both require `PADDR` to be **16-byte aligned**, the guest to be in `GSTATE.LUPDATE`, and the guest to have been **activated with an ASID**; `LAUNCH_UPDATE_VMSA`'s `LENGTH` must be exactly **4096 bytes**.  `[SEV-API 3.24 Table 47]` `[SEV-API 3.24 Table 49]` `[8]` `C:high` `V:durable`
- **Claim.** `LAUNCH_MEASURE` finalizes `GCTX.LD` into the hash digest of all plaintext data imported into the guest and computes the launch measurement as **`HMAC(0x04 || API_MAJOR || API_MINOR || BUILD || GCTX.POLICY || GCTX.LD || MNONCE ; GCTX.TIK)`**, where `MNONCE` is a firmware-generated random nonce.  `[SEV-API 3.24 §6.5.1]` `[8]` `C:high` `V:durable`
- **Claim.** The `LAUNCH_MEASURE` output buffer is `MEASURE` at offset `00h` (**256 bits**) followed by `MNONCE` at offset `20h` (**128 bits**); after the command the guest transitions to `GSTATE.LSECRET`.  `[SEV-API 3.24 Table 52]` `[8]` `C:high` `V:durable`
- **Claim.** The `BUILD` value that enters the measurement is the firmware build ID reported by `PLATFORM_STATUS` in **bits 31:24 of the doubleword at offset `04h`** of its command buffer, alongside `API_MAJOR` at `00h`, `API_MINOR` at `01h`, `STATE` at `02h`, `OWNER` in bit 0 of `03h`, `CONFIG.ES` in bit 0 of `04h` and `GUEST_COUNT` at `08h`.  `[SEV-API 3.24 Table 24]` `[8]` `C:high` `V:durable`
- **Claim.** Because the measurement is an HMAC over the policy as well as the digest, a hypervisor cannot present a correct measurement for a guest launched under a different policy — the policy is inside the authenticated data, not alongside it.  `[SEV-API 3.24 §6.5.1]` `[8]` `C:high` `V:durable`
- **Claim.** `LAUNCH_SECRET` injects a secret wrapped by the guest owner after the measurement has been retrieved and verified, and `LAUNCH_FINISH` — valid only from `GSTATE.LSECRET` — readies the guest for execution and moves it to `GSTATE.RUNNING`.  `[SEV-API 3.24 §6.6]` `[8]` `C:high` `V:durable`

### 12.10.1 The ATTESTATION command is not the launch measurement

They are different objects with different keys and different verifiers, and confusing them is common.

- **Claim.** `ATTESTATION` generates a report containing the **SHA-256 digest** of the guest memory and VMSA imported by the `LAUNCH_UPDATE_*` commands and **signs it with the PEK**, taking a caller-supplied random `MNONCE`; the firmware signs from offset `0h` up to but not including `SIG_USAGE`, with `SIG_USAGE` set to PEK and `SIG_ALGO` set to ECDSA with SHA-256.  `[SEV-API 3.24 §6.8.1]` `[8]` `C:high` `V:durable`
- **Claim.** The attestation report buffer is `MNONCE` at `00h` (128 bits), `LAUNCH_DIGEST` at `10h` (256 bits), `POLICY` at `30h` (32 bits), `SIG_USAGE` at `34h` (32 bits), `SIG_ALGO` at `38h` (32 bits), reserved at `3Ch`, and **`SIG1` spanning `40h`–`CFh`** — a 208-byte report.  `[SEV-API 3.24 Table 60]` `[8]` `C:high` `V:durable`
- **Claim.** `ATTESTATION` is valid in `GSTATE.LSECRET`, `RUNNING`, `SUPDATE` and `SENT`, so unlike `LAUNCH_MEASURE` it can be requested after the guest is running; it is **signed** with a platform key rather than **MAC'd** with a session key, so the verifier needs the platform certificate chain rather than the TIK.  `[SEV-API 3.24 §6.8.1]` `[8]` `C:high` `V:durable`
- **Claim.** The SEV attestation report of pub 55766 is a different structure from the SEV-SNP `ATTESTATION_REPORT` of pub 56860, which is owned by `14-sev-snp.md`; a field layout taken from one does not apply to the other.  `[SEV-API 3.24 Table 60]` `[8][10]` `C:high` `V:durable`

## 12.11 Open items

- **Pub 55766 has not been revised since April 2020** and is the only published SEV/SEV-ES API document.
  Its cover carries both "Revision 3.24" and "API Version 0.24 / Technical Preview"; this skill cites the
  **publication revision 3.24**. Anything SNP-related is in pub 56860 and belongs to `14-sev-snp.md`.
- **`errata.md` O5 is now partly resolved and partly still open.** §12.8.3 above settles the structural
  half: Chapter 7 and Appendices A–C exist. Whether individual commands sit where the pre-rebuild corpus
  placed them was never enumerated and has not been re-checked command by command.
- **`errata.md` O1 — the per-generation key-slot count — is untouched here.** The `NumEncryptedGuests`
  value is a CPUID read, and no first-party source in this corpus maps a count to a named EPYC
  generation. Do not infer one from a client measurement in `11-memory-encryption.md`.
- **`INIT_EX` (`00Dh`), `ACTIVATE_EX` (`025h`), `COPY` (`024h`), `SWAP_OUT`/`SWAP_IN` (`070h`/`071h`) and
  `RING_BUFFER` (`00Fh`) are listed but not detailed in this chapter.** Their parameter buffers are in
  §5.3, §6.20, §6.24, §6.25, §6.26 and §5.15 respectively.
- **The `BUILD` value that enters the launch measurement is firmware-version-bearing.** Its location is
  given in §12.10; a concrete value belongs to `90-dated-landscape.md`, not here. This is also why a
  measurement computed by the guest owner must be recomputed after a firmware update.
- **`SNPBTBIsolation_Active` (`SEV_STATUS` bit 9)** has no corresponding `Fn8000_001F_EAX` support bit
  under that name, unlike every other feature in the table. Whether it is enumerated elsewhere or is
  implied by SNP support is not stated in §15.34.10.
