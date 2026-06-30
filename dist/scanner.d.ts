/**
 * @djjrip/anti-cheat-sdk — Process scanner
 *
 * Enumerates running processes via OS‑native CLI tools and checks each one
 * against the configured blocklist.  Works on Windows (`tasklist`) and
 * macOS / Linux (`ps`).
 */
import { ScanResult } from './types';
export declare class ProcessScanner {
    private readonly blocklist;
    /**
     * @param blocklist – Lowercase process name substrings to flag.
     */
    constructor(blocklist: string[]);
    /**
     * Scan all running processes and return every blocklist hit.
     *
     * The method is intentionally **synchronous** so callers can decide
     * whether to wrap it in a worker or run it on the main thread.
     */
    scan(): ScanResult;
    /**
     * Returns a de‑duplicated array of lowercase process names currently
     * running on the host.
     */
    private enumerateProcesses;
    /**
     * Windows: `tasklist /fo csv /nh` outputs lines like:
     * ```
     * "chrome.exe","12345","Console","1","123,456 K"
     * ```
     * We grab the first quoted field and strip the extension.
     */
    private enumerateWindows;
    /**
     * macOS / Linux: `ps -axco comm` returns one process name per line.
     */
    private enumerateUnix;
    /**
     * Performs **substring matching** — if *any* blocklist entry is a
     * substring of a running process name (or vice‑versa) it counts as a hit.
     *
     * This catches variants like `cheatengine-x86_64` matching `cheatengine`.
     */
    private matchAgainstBlocklist;
}
//# sourceMappingURL=scanner.d.ts.map