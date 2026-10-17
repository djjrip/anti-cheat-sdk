#ifndef GGLOOP_ANTI_CHEAT_H
#define GGLOOP_ANTI_CHEAT_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Returns the version string of the GG Loop Anti-Cheat SDK (e.g. "1.0.0").
 */
const char* ggloop_version(void);

/**
 * Detects if any target game process is currently active.
 * Returns a heap-allocated JSON string: {"game_id":"...","game_name":"...","process":"..."}
 * Caller must free with ggloop_free_string(). Returns NULL if no game is running.
 */
char* ggloop_detect_active_game(void);

/**
 * Checks if the given process name is the focused foreground window.
 * Returns 1 if true, 0 if false.
 */
int ggloop_is_foreground(const char* process_name);

/**
 * Validates a file's SHA-256 hash against an expected hash (FIPS 180-4).
 * Returns:
 *   1 = Match (clean/valid)
 *   0 = Mismatch (tampered/unauthorized)
 *  -1 = File not found or read error
 *  -2 = Invalid arguments
 */
int ggloop_verify_binary_sha256(const char* path, const char* expected_hash);

/**
 * Frees a string returned by the SDK.
 */
void ggloop_free_string(char* s);

#ifdef __cplusplus
}
#endif

#endif // GGLOOP_ANTI_CHEAT_H
