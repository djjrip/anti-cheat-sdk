use anti_cheat_sdk::{default_games, get_running_processes, is_process_in_foreground, detect_active_game};

fn main() {
    println!("=== Anti-Cheat SDK Example ===");
    
    // 1. Get running processes
    println!("Scanning for running processes...");
    let processes = get_running_processes();
    println!("Found {} active processes.", processes.len());
    
    // Print a few processes as sample
    println!("\nSample running processes:");
    for proc in processes.iter().take(5) {
        println!(" - {}", proc);
    }

    // 2. Load game configurations
    let games = default_games();
    println!("\nLoaded {} supported game configurations.", games.len());

    // 3. Detect running games
    if let Some((game, process)) = detect_active_game(&games) {
        println!("\n>>> DETECTED ACTIVE GAME: {} (Process: {})", game.name, process);
        
        // Check if focused in foreground
        let focused = is_process_in_foreground(&process);
        println!("Is game process in foreground/focused? {}", focused);
    } else {
        println!("\nNo supported games are currently running.");
    }
}
