use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use crate::{default_games, detect_active_game, is_process_in_foreground, corporate_security::compute_sha256, corporate_security::hash_to_hex};

/// Return the SDK semantic version string
#[no_mangle]
pub extern "C" fn ggloop_version() -> *const c_char {
    static VERSION: &[u8] = b"1.0.0\0";
    VERSION.as_ptr() as *const c_char
}

/// Detect active running game from default game list.
/// Returns a JSON string: `{"game_id":"...","process":"..."}` or null if none detected.
/// Caller MUST free the returned string with `ggloop_free_string`.
#[no_mangle]
pub extern "C" fn ggloop_detect_active_game() -> *mut c_char {
    let games = default_games();
    if let Some((game, process)) = detect_active_game(&games) {
        let json = format!(r#"{{"game_id":"{}","game_name":"{}","process":"{}"}}"#, game.id, game.name, process);
        if let Ok(c_str) = CString::new(json) {
            return c_str.into_raw();
        }
    }
    std::ptr::null_mut()
}

/// Check if a process name is currently the focused foreground window
#[no_mangle]
pub extern "C" fn ggloop_is_foreground(process_name: *const c_char) -> i32 {
    if process_name.is_null() {
        return 0;
    }
    let c_str = unsafe { CStr::from_ptr(process_name) };
    if let Ok(name) = c_str.to_str() {
        if is_process_in_foreground(name) {
            return 1;
        }
    }
    0
}

/// Verify executable file against expected SHA-256 hash.
/// Returns:
///   1 = Hash matches exactly (valid)
///   0 = Hash mismatch (tampered / unauthorized)
///  -1 = File not found or read error
///  -2 = Invalid arguments
#[no_mangle]
pub extern "C" fn ggloop_verify_binary_sha256(path: *const c_char, expected_hash: *const c_char) -> i32 {
    if path.is_null() || expected_hash.is_null() {
        return -2;
    }
    let c_path = unsafe { CStr::from_ptr(path) };
    let c_expected = unsafe { CStr::from_ptr(expected_hash) };
    
    let path_str = match c_path.to_str() {
        Ok(s) => s,
        Err(_) => return -2,
    };
    let expected_str = match c_expected.to_str() {
        Ok(s) => s.to_lowercase(),
        Err(_) => return -2,
    };

    match std::fs::read(path_str) {
        Ok(bytes) => {
            let digest = compute_sha256(&bytes);
            let hex_digest = hash_to_hex(&digest).to_lowercase();
            if hex_digest == expected_str {
                1
            } else {
                0
            }
        }
        Err(_) => -1,
    }
}

/// Free a C-string allocated by the SDK
#[no_mangle]
pub extern "C" fn ggloop_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}
