# Anti-Cheat SDK

A lightweight, zero-overhead, platform-agnostic active window focus tracking and process scanning SDK for Windows and macOS. Written in pure Rust.

Designed for game launchers, companion apps, and anti-cheat clients that need to track game session durations, detect foreground focus states, and audit active running processes without kernel-level drivers.

## Architecture

Unlike heavy, intrusive Ring-0 kernel-level anti-cheats (like Vanguard) which run at the driver level and pose stability or privacy risks, this SDK operates entirely in **Ring-3 (User-Space)**. It leverages lightweight OS APIs to query running processes and monitor window focus states with minimal CPU and memory overhead.

```
+--------------------------------------------------------+
|                      USER SPACE (Ring 3)               |
|                                                        |
|   +------------------+         +------------------+    |
|   |  Game Executable |         |  Anti-Cheat SDK  |    |
|   |  (Valorant, etc) |         | (Focus Tracking) |    |
|   +------------------+         +--------+---------+    |
|                                         |              |
|                                         | [Win32/macOS]|
|                                         v              |
|                     +-------------------------+        |
|                     | OS API Subsystem        |        |
|                     | - Win32 EnumProcesses   |        |
|                     | - macOS AppleScript/ps  |        |
|                     +------------+------------+        |
|                                  |                     |
+----------------------------------|---------------------+
|                                  v                     |
|                  +----------------------------+        |
|                  |      OS Kernel (Ring 0)    |        |
|                  +----------------------------+        |
+--------------------------------------------------------+
```

### Key Design Patterns & Technical Features
1. **Zero-Overhead Polling/Hooks**: Built to support periodic polling setups (e.g., 10-second tick loop) without CPU spikes.
2. **Platform-Conditional Compilation**: Uses conditional compilation (`#[cfg(target_os = "windows")]` and `#[cfg(target_os = "macos")]`) to compile only the necessary platform APIs.
3. **No External App-Side Dependencies**: On Windows, it binds directly to low-level APIs via the official `windows` crate (`windows-sys` equivalent bindings). On macOS, it reads command diagnostics via `ps` and frontmost windows via AppleScript.

---

## Installation

Add this dependency to your `Cargo.toml`:

```toml
[dependencies]
anti-cheat-sdk = { git = "https://github.com/djjrip/anti-cheat-sdk.git" }
```

Or copy the files locally to your project's workspace.

---

## Usage

### Simple Process Enumeration and Game Detection

```rust
use anti_cheat_sdk::{default_games, get_running_processes, is_process_in_foreground, detect_active_game};

fn main() {
    // 1. Scan running processes
    let processes = get_running_processes();
    println!("Scanning finished. Found {} running processes.", processes.len());

    // 2. Load the default list of game profiles
    let game_profiles = default_games();

    // 3. Match running processes against game signatures
    if let Some((game, process_name)) = detect_active_game(&game_profiles) {
        println!("Detected Game: {} (Process: {})", game.name, process_name);

        // 4. Verify if the game is currently the active foreground window
        let is_active = is_process_in_foreground(&process_name);
        println!("Is currently focused: {}", is_active);
    } else {
        println!("No supported game is currently running.");
    }
}
```

### Running the Example

You can run the example directly from the repository using:

```bash
cargo run --example basic
```

---

## Security and Integrity Considerations

* **User Space Boundary**: Running in Ring 3 means the SDK is susceptible to process-renaming or PID spoofing by highly sophisticated cheat programs. It is designed to be used in conjunction with server-side validation.
* **No Kernel Privileges**: Does not require administrator or root rights, ensuring compatibility with standard user environments and bypassing safety/security flags on modern OS platforms.
* **No Telemetry Injection**: Purely passive local audit APIs. No background connections are initiated by the SDK.
