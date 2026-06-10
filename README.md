# anti-cheat-sdk

> Lightweight, privacy-first, user-space anti-cheat and game session tracking SDK. Written in Rust. Works on Windows and macOS. No kernel drivers. No admin rights required.

[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange)](https://www.rust-lang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## What This Solves

Most anti-cheat solutions for indie games are either:
- **Too heavy** — kernel-level drivers (Vanguard, EAC) that require admin rights, risk OS stability, and get banned by players
- **Too basic** — nothing at all, because building from scratch in C++ takes months

This SDK is the middle path. Drop it into any Rust project as a single crate dependency. Get:
- **Real-time game process detection** (18 titles pre-configured: Valorant, CS2, Apex, Fortnite...)
- **Foreground window focus tracking** — know when the player actually has the game open
- **Session timing** — accurate play-session duration without a background service
- **Cross-platform** — Windows (Win32 API) and macOS (AppleScript/ps), same API surface

No drivers. No admin prompts. No privacy red flags.

---

## Supported Games (Built-in)

| Game | Process(es) |
|---|---|
| Valorant | `VALORANT-Win64-Shipping.exe` |
| Counter-Strike 2 | `cs2.exe` |
| Apex Legends | `r5apex.exe`, `r5apex_dx12.exe` |
| Fortnite | `FortniteClient-Win64-Shipping.exe` |
| Overwatch 2 | `Overwatch.exe` |
| Rocket League | `RocketLeague.exe` |
| Minecraft | `javaw.exe`, `Minecraft.exe` |
| PUBG | `TslGame.exe` |
| + 10 more | See `default_games()` in `src/lib.rs` |

Custom games supported via `GameConfig` struct.

---

## Installation

```toml
# Cargo.toml
[dependencies]
anti-cheat-sdk = { git = "https://github.com/djjrip/anti-cheat-sdk.git" }
```

---

## Usage

```rust
use anti_cheat_sdk::{default_games, detect_active_game, is_process_in_foreground};

fn main() {
    let games = default_games();

    match detect_active_game(&games) {
        Some((game, process)) => {
            println!("Game running: {} ({})", game.name, process);
            println!("In foreground: {}", is_process_in_foreground(&process));
        }
        None => println!("No supported game detected."),
    }
}
```

Run the included example:

```bash
cargo run --example basic
```

---

## Architecture

Runs entirely in **Ring 3 (User Space)**. No kernel access required.

```
Game Process (Ring 3)
      |
      ↓
anti-cheat-sdk
      |
      ├── Windows: Win32 K32EnumProcesses + GetForegroundWindow
      └── macOS:   ps -axo comm + osascript AppleScript
```

The SDK is passive — it reads OS state, never injects code or modifies memory. Designed to pair with **server-side validation** for production anti-cheat pipelines.

---

## Security Notes

- **No kernel privileges** — won't trigger OS security warnings or game platform bans
- **No network calls** — purely local OS API reads
- **No telemetry** — what happens on the client stays on the client
- **Ring 3 limitation** — sophisticated cheats using process renaming or PID spoofing can bypass client-side detection. Always validate game state server-side.

---

## License

MIT — free for personal and commercial use.

Built by [@djjrip](https://github.com/djjrip)
