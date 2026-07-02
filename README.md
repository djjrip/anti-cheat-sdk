# GG Loop Anti-Cheat SDK

> **Lightweight, privacy-first, user-space game session tracking.** 
> Detect active games and track playtime accurately without kernel drivers, admin rights, or privacy-invasive memory scans.

[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange)](https://www.rust-lang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## The Value Prop

Most anti-cheat solutions for indie and mid-tier games are broken:
- **Kernel-level drivers** (Vanguard, EAC) risk OS stability, anger privacy-conscious players, and require admin rights.
- **Building from scratch** takes months of C++ and OS API wrangling.

This SDK is the middle path. Drop it into any Rust project as a single crate dependency to instantly get robust process detection and window focus tracking. Perfect for rewarding legitimate playtime, managing game launchers, or building custom telemetry.

---

## 🚀 60-Second Quickstart

Try the live demo instantly from a fresh clone:

```bash
git clone https://github.com/djjrip/anti-cheat-sdk.git
cd anti-cheat-sdk
cargo run --example basic
```

**To use in your own project:**
```toml
# Cargo.toml
[dependencies]
anti-cheat-sdk = { git = "https://github.com/djjrip/anti-cheat-sdk.git" }
```

```rust
use anti_cheat_sdk::{default_games, detect_active_game, is_process_in_foreground};

fn main() {
    let games = default_games();
    match detect_active_game(&games) {
        Some((game, process)) => {
            println!("🎮 Game running: {} ({})", game.name, process);
            println!("👀 In foreground: {}", is_process_in_foreground(&process));
        }
        None => println!("No supported game detected."),
    }
}
```

---

## Features

- **Real-time game process detection**: 18 titles pre-configured (Valorant, CS2, Apex, Fortnite, etc.)
- **Foreground window tracking**: Know exactly when the player actually has the game open and focused.
- **Cross-platform capability**: Unified API surface utilizing Win32 API on Windows and `ps`/AppleScript on macOS.
- **Zero dependencies**: Pure Rust implementation with direct OS system calls.
- **Custom game support**: Easily pass your own `GameConfig` structs to track any arbitrary `.exe` or process.

---

## ⚠️ Limitations (User-Mode vs Kernel Tradeoff)

This SDK runs entirely in **Ring 3 (User Space)**. It never injects code or modifies memory. 

Because we prioritize user privacy and system stability (no kernel drivers), this SDK has limitations:
- **Process Spoofing**: Sophisticated cheats using PID spoofing or executable renaming can bypass client-side detection.
- **Memory Manipulation**: We cannot detect if a user injects a DLL into the game process memory.
- **Best Practice**: Always pair this SDK with **server-side validation** (e.g., checking server logs, telemetry anomalies, and behavioral analysis) for a complete anti-cheat pipeline.

---

## Cloud Infrastructure & Dashboard

Need managed telemetry, blocklist updates, discord alerts, and an analytics dashboard? 
We offer a managed cloud tier that wires this SDK directly into a secure backend.

👉 **[Check out the GG Loop Cloud Tier ($29/mo)](https://ggloop.io)**

---

## License

MIT — free for personal and commercial use. Built by [@djjrip](https://github.com/djjrip).
