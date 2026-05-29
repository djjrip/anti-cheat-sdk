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
    let running_lower: Vec<String> = running.iter().map(|p| p.to_lowercase()).collect();

    for game in games {
        if !game.enabled { continue; }
        for process in &game.processes {
            let proc_lower = process.to_lowercase();
            if running_lower.iter().any(|r| r == &proc_lower || r.ends_with(&proc_lower)) {
                return Some((game.clone(), process.clone()));
            }
        }
    }
    None
}
