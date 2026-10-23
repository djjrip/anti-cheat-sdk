# GG Loop Sentry // Game Session & Playtime Telemetry SDK

> **Lightweight, privacy-first, user-space game telemetry in Rust.**  
> Accurately detects active game processes and foreground window focus without kernel drivers, admin rights, or intrusive memory inspection.

[![Rust 1.75+](https://img.shields.io/badge/rust-1.75%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)]()
[![Tests](https://img.shields.io/badge/tests-15%2F15%20passing%20(Exit%200)-00f59b)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🎯 What This Is (And What It Is NOT)

Let's be 100% technically transparent:

| What This IS | What This IS NOT |
| :--- | :--- |
| ✅ A **lightweight game-session tracker** for launchers and esports reward platforms. | ❌ A kernel-level anti-cheat (like Vanguard or BattlEye). |
| ✅ **Zero-rootkit & zero-driver**: Runs entirely in Ring 3 (User Space). | ❌ Incapable of stopping DLL memory injection or kernel-level tampering. |
| ✅ **AFK & Idle Fraud Detection**: Verifies active foreground window focus (`GetForegroundWindow`). | ❌ A replacement for server-side match replay validation. |
| ✅ **Native & Performant**: Compiles to native binary using Win32 / macOS APIs (<0.05% CPU). | ❌ Bloatware with invasive background services. |

### The Problem We Solve
Esports reward platforms and game launchers (like [GG Loop](https://ggloop.io)) need to know:
1. *Is the user actively playing the game, or did they leave it running in the background to AFK farm reward points?*
2. *Can we track active playtime without forcing gamers to install an invasive Ring-0 kernel driver that crashes their machine?*

**Sentry** answers both questions with native OS APIs and cryptographic session record signing.

---

## 🚀 Quickstart

```bash
git clone https://github.com/djjrip/anti-cheat-sdk.git
cd anti-cheat-sdk
cargo test
cargo run --example basic
```

### Usage in Your Project

```toml
[dependencies]
anti_cheat_sdk = { git = "https://github.com/djjrip/anti-cheat-sdk.git" }
```

```rust
use anti_cheat_sdk::{default_games, detect_active_game, is_process_in_foreground};

fn main() {
    let games = default_games();
    
    // Scans active processes against pre-configured game definitions
    match detect_active_game(&games) {
        Some((game, process)) => {
            println!("🎮 Game Running: {} ({})", game.name, process);
            
            // Check if player actually has the window focused (prevents AFK farming)
            if is_process_in_foreground(&process) {
                println!("🔥 Active Gameplay Verified: Window in Foreground");
            } else {
                println!("⏸️ Game Minimized / In Background (AFK Mode)");
            }
        }
        None => println!("No supported game running."),
    }
}
```

---

## 🛡️ Architecture & Security Model

```
[ Active Game (e.g. CS2, Valorant) ]
              │
              ▼  (Win32 Process Enumeration / GetForegroundWindow)
[ Sentry User-Space Agent (Ring 3) ]
              │
              ▼  (HMAC-SHA256 Signed Session Payloads)
[ Secure Server-Side Ledger (GG Loop API) ]
```

- **Process Enumeration**: Uses Windows Toolhelp32 / ProcessStatus APIs to inspect active process trees without memory hooks.
- **Window Focus State**: Queries OS window handles to verify foreground engagement.
- **HMAC-SHA256 Payload Signing**: Formats session events into RFC 4231 compliant HMAC signatures for tamper-evident transport to server APIs.
- **Strict Suffix & Path Validation**: Rejects spoofed process names and invalid path prefixes.

---

## 🧪 Test Verification (15/15 Green)

All tests verified with `cargo test` (Exit Code 0):

```
running 15 tests
test corporate_security::tests::hmac_sha256_matches_rfc4231_case_1 ... ok
test corporate_security::tests::test_sha256_known_vector ... ok
test tests::default_games_have_unique_non_empty_ids ... ok
test tests::detects_exact_process_match ... ok
test tests::ignores_disabled_games ... ok
test tests::rejects_same_suffix_spoofed_process_name ... ok
test tests::detection_event_hmac_covers_all_fields_and_verifies_key ... ok
test tests::match_is_case_insensitive ... ok
test tests::returns_first_enabled_match_in_priority_order ... ok
test corporate_security::tests::test_zero_trust_auditor_block_unauthorized_hash ... ok
test corporate_security::tests::test_audit_event_json_roundtrip ... ok
test corporate_security::tests::test_zero_trust_auditor_allow ... ok
test tests::rejects_spoofed_directory_prefix_without_separator ... ok
test tests::returns_none_when_nothing_matches ... ok
test tests::suffix_match_handles_full_path_process_names ... ok

test result: ok. 15 passed; 0 failed; finished in 0.00s
```

---

## 📜 License

MIT License. Developed by Jayson Quindao ([@djjrip](https://github.com/djjrip)) for [GG Loop LLC](https://ggloop.io).
