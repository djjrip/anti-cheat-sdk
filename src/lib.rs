use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GameConfig {
    pub id: String,
    pub name: String,
    pub processes: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveSession {
    pub game_id: String,
    pub game_name: String,
    pub process_name: String,
    pub start_time: u64,
    pub duration_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionEvent {
    pub event: String,
    pub game: Option<String>,
    pub session: Option<ActiveSession>,
    pub points_awarded: Option<i64>,
}

/// Default supported games for process detection
pub fn default_games() -> Vec<GameConfig> {
    vec![
        GameConfig { id: "valorant".into(), name: "Valorant".into(), processes: vec!["VALORANT-Win64-Shipping.exe".into(), "VALORANT.exe".into()], enabled: true },
        GameConfig { id: "league-of-legends".into(), name: "League of Legends".into(), processes: vec!["League of Legends.exe".into(), "LeagueClient.exe".into()], enabled: true },
        GameConfig { id: "fortnite".into(), name: "Fortnite".into(), processes: vec!["FortniteClient-Win64-Shipping.exe".into()], enabled: true },
        GameConfig { id: "apex-legends".into(), name: "Apex Legends".into(), processes: vec!["r5apex.exe".into(), "r5apex_dx12.exe".into()], enabled: true },
        GameConfig { id: "overwatch2".into(), name: "Overwatch 2".into(), processes: vec!["Overwatch.exe".into()], enabled: true },
        GameConfig { id: "cs2".into(), name: "Counter-Strike 2".into(), processes: vec!["cs2.exe".into()], enabled: true },
        GameConfig { id: "rocket-league".into(), name: "Rocket League".into(), processes: vec!["RocketLeague.exe".into()], enabled: true },
        GameConfig { id: "minecraft".into(), name: "Minecraft".into(), processes: vec!["javaw.exe".into(), "Minecraft.exe".into()], enabled: true },
        GameConfig { id: "warzone".into(), name: "Call of Duty: Warzone".into(), processes: vec!["cod.exe".into(), "ModernWarfare.exe".into()], enabled: true },
        GameConfig { id: "pubg".into(), name: "PUBG".into(), processes: vec!["TslGame.exe".into()], enabled: true },
        GameConfig { id: "dota2".into(), name: "Dota 2".into(), processes: vec!["dota2.exe".into()], enabled: true },
        GameConfig { id: "rainbow-six".into(), name: "Rainbow Six Siege".into(), processes: vec!["RainbowSix.exe".into(), "RainbowSix_Vulkan.exe".into()], enabled: true },
        GameConfig { id: "genshin-impact".into(), name: "Genshin Impact".into(), processes: vec!["GenshinImpact.exe".into()], enabled: true },
        GameConfig { id: "destiny2".into(), name: "Destiny 2".into(), processes: vec!["destiny2.exe".into()], enabled: true },
        GameConfig { id: "lost-ark".into(), name: "Lost Ark".into(), processes: vec!["LOSTARK.exe".into()], enabled: true },
        GameConfig { id: "wow".into(), name: "World of Warcraft".into(), processes: vec!["Wow.exe".into(), "WowClassic.exe".into()], enabled: true },
        GameConfig { id: "elden-ring".into(), name: "Elden Ring".into(), processes: vec!["eldenring.exe".into()], enabled: true },
        GameConfig { id: "cyberpunk2077".into(), name: "Cyberpunk 2077".into(), processes: vec!["Cyberpunk2077.exe".into()], enabled: true },
    ]
}

#[cfg(target_os = "windows")]
mod os_impl {
    use windows::Win32::System::ProcessStatus::K32EnumProcesses;
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::System::ProcessStatus::K32GetModuleBaseNameW;
    use windows::Win32::Foundation::{CloseHandle, FALSE};
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    pub fn get_running_processes() -> Vec<String> {
        let mut pids = vec![0u32; 2048];
        let mut bytes_returned = 0u32;

        unsafe {
            if K32EnumProcesses(pids.as_mut_ptr(), (pids.len() * std::mem::size_of::<u32>()) as u32, &mut bytes_returned) == FALSE {
                return vec![];
            }
        }

        let count = bytes_returned as usize / std::mem::size_of::<u32>();
        let mut names = Vec::new();

        for &pid in &pids[..count] {
            if pid == 0 { continue; }
            unsafe {
                if let Ok(handle) = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid) {
                    let mut name_buf = vec![0u16; 260];
                    let len = K32GetModuleBaseNameW(handle, None, &mut name_buf);
                    if len > 0 {
                        let name = String::from_utf16_lossy(&name_buf[..len as usize]);
                        names.push(name);
                    }
                    let _ = CloseHandle(handle);
                }
            }
        }

        names
    }

    pub fn is_process_in_foreground(process_name: &str) -> bool {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() { return false; }
            
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 { return false; }
            
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut name_buf = vec![0u16; 260];
                let len = K32GetModuleBaseNameW(handle, None, &mut name_buf);
                let _ = CloseHandle(handle);
                if len > 0 {
                    let name = String::from_utf16_lossy(&name_buf[..len as usize]);
                    let target_name = process_name.to_lowercase();
                    let current_name = name.to_lowercase();
                    return current_name == target_name || current_name.ends_with(&target_name) || target_name.ends_with(&current_name);
                }
            }
        }
        false
    }
}

#[cfg(target_os = "macos")]
mod os_impl {
    use std::process::Command;

    pub fn get_running_processes() -> Vec<String> {
        let output = Command::new("ps")
            .args(["-axo", "comm="])
            .output()
            .unwrap_or_else(|_| std::process::Output {
                status: std::process::ExitStatus::default(),
                stdout: vec![],
                stderr: vec![],
            });

        String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|l| {
                l.trim().split('/').last().unwrap_or(l.trim()).to_string()
            })
            .collect()
    }

    pub fn is_process_in_foreground(process_name: &str) -> bool {
        let output = Command::new("osascript")
            .args(["-e", "tell application \"System Events\" to get name of first process whose frontmost is true"])
            .output();

        if let Ok(out) = output {
            let active_process = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !active_process.is_empty() {
                let target_name = process_name.to_lowercase();
                let current_name = active_process.to_lowercase();
                return current_name == target_name || current_name.starts_with(&target_name) || target_name.starts_with(&current_name);
            }
        }
        true
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod os_impl {
    pub fn get_running_processes() -> Vec<String> {
        vec![]
    }

    pub fn is_process_in_foreground(_process_name: &str) -> bool {
        false
    }
}

// Re-export high-level public APIs
pub fn get_running_processes() -> Vec<String> {
    os_impl::get_running_processes()
}

pub fn is_process_in_foreground(process_name: &str) -> bool {
    os_impl::is_process_in_foreground(process_name)
}

/// Detect active game process from a list of configs
pub fn detect_active_game(games: &[GameConfig]) -> Option<(GameConfig, String)> {
    let running = get_running_processes();
    detect_active_game_in(games, &running)
}

/// Pure, OS-independent matching logic behind `detect_active_game`. Separated out so it
/// can be unit tested without depending on the real OS process list (`get_running_processes`
/// shells out / calls Win32 APIs and can't be exercised in a normal `cargo test` run).
pub fn detect_active_game_in(games: &[GameConfig], running: &[String]) -> Option<(GameConfig, String)> {
    let running_lower: Vec<String> = running.iter().map(|p| p.to_lowercase()).collect();

    for game in games {
        if !game.enabled { continue; }
        for process in &game.processes {
            let proc_lower = process.to_lowercase();
            if running_lower.iter().any(|r| process_matches(r, &proc_lower)) {
                return Some((game.clone(), process.clone()));
            }
        }
    }
    None
}

/// Boundary-safe comparison between an observed process string (bare name or full path,
/// already lowercased) and a target process name (already lowercased).
///
/// This exists to close a spoofing gap: the previous implementation used a bare
/// `str::ends_with`, so a process literally named `evil_cs2.exe` (or a directory named
/// `cs2.exe\` containing an unrelated binary) would match the `cs2.exe` target and let a
/// renamed/malicious process farm reward points meant for the real game. Requiring the
/// character immediately before the match to be a path separator (or the start of the
/// string) keeps legitimate full-path matches (`C:\...\cs2.exe`) working while rejecting
/// same-suffix-but-different-file spoofing (`evil_cs2.exe`, `fake-cs2.exe`).
fn process_matches(running: &str, target: &str) -> bool {
    if running == target {
        return true;
    }
    if let Some(stripped) = running.strip_suffix(target) {
        return stripped.is_empty() || stripped.ends_with('/') || stripped.ends_with('\\');
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn game(id: &str, processes: &[&str], enabled: bool) -> GameConfig {
        GameConfig {
            id: id.into(),
            name: id.into(),
            processes: processes.iter().map(|p| p.to_string()).collect(),
            enabled,
        }
    }

    #[test]
    fn default_games_have_unique_non_empty_ids() {
        let games = default_games();
        assert!(!games.is_empty(), "expected a non-empty default game list");

        let mut ids: Vec<&str> = games.iter().map(|g| g.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), games.len(), "default_games() contains duplicate ids");

        for g in &games {
            assert!(!g.id.is_empty(), "game id must not be empty");
            assert!(!g.name.is_empty(), "game name must not be empty");
            assert!(!g.processes.is_empty(), "{} has no process names configured", g.id);
        }
    }

    #[test]
    fn detects_exact_process_match() {
        let games = vec![game("valorant", &["VALORANT-Win64-Shipping.exe"], true)];
        let running = vec!["VALORANT-Win64-Shipping.exe".to_string()];
        let result = detect_active_game_in(&games, &running);
        assert!(result.is_some());
        let (matched_game, matched_process) = result.unwrap();
        assert_eq!(matched_game.id, "valorant");
        assert_eq!(matched_process, "VALORANT-Win64-Shipping.exe");
    }

    #[test]
    fn match_is_case_insensitive() {
        let games = vec![game("cs2", &["cs2.exe"], true)];
        let running = vec!["CS2.EXE".to_string()];
        assert!(detect_active_game_in(&games, &running).is_some());
    }

    #[test]
    fn ignores_disabled_games() {
        let games = vec![game("fortnite", &["FortniteClient-Win64-Shipping.exe"], false)];
        let running = vec!["FortniteClient-Win64-Shipping.exe".to_string()];
        assert!(detect_active_game_in(&games, &running).is_none());
    }

    #[test]
    fn returns_none_when_nothing_matches() {
        let games = default_games();
        let running = vec!["notepad.exe".to_string(), "explorer.exe".to_string()];
        assert!(detect_active_game_in(&games, &running).is_none());
    }

    #[test]
    fn returns_first_enabled_match_in_priority_order() {
        // Two games sharing a process name shouldn't happen in practice, but the matcher
        // should still be deterministic: first configured (enabled) game wins.
        let games = vec![
            game("game-a", &["shared.exe"], true),
            game("game-b", &["shared.exe"], true),
        ];
        let running = vec!["shared.exe".to_string()];
        let (matched, _) = detect_active_game_in(&games, &running).unwrap();
        assert_eq!(matched.id, "game-a");
    }

    #[test]
    fn suffix_match_handles_full_path_process_names() {
        // get_running_processes() can return full paths on some platforms; process_matches'
        // path-boundary branch exists to handle that — verify it actually works.
        let games = vec![game("dota2", &["dota2.exe"], true)];
        let running =
            vec!["C:\\Games\\Steam\\steamapps\\common\\dota 2 beta\\game\\dota2.exe".to_string()];
        assert!(detect_active_game_in(&games, &running).is_some());
    }

    #[test]
    fn rejects_same_suffix_spoofed_process_name() {
        // Regression test for the spoofing gap process_matches was added to close:
        // a process named "evil_cs2.exe" must NOT match a "cs2.exe" target just because
        // the string happens to end with it.
        let games = vec![game("cs2", &["cs2.exe"], true)];
        let running = vec!["evil_cs2.exe".to_string()];
        assert!(detect_active_game_in(&games, &running).is_none());
    }

    #[test]
    fn rejects_spoofed_directory_prefix_without_separator() {
        // "fake-cs2.exe" (no path separator before the match) must also be rejected —
        // only an exact match or a match immediately preceded by a path separator counts.
        assert!(!process_matches("fake-cs2.exe", "cs2.exe"));
        assert!(process_matches("cs2.exe", "cs2.exe"));
        assert!(process_matches("c:\\games\\cs2.exe", "cs2.exe"));
        assert!(process_matches("c:/games/cs2.exe", "cs2.exe"));
    }
}
 