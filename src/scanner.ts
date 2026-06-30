/**
 * @djjrip/anti-cheat-sdk — Process scanner
 *
 * Enumerates running processes via OS‑native CLI tools and checks each one
 * against the configured blocklist.  Works on Windows (`tasklist`) and
 * macOS / Linux (`ps`).
 */

import { execSync } from 'child_process';
import { ScanResult } from './types';

export class ProcessScanner {
  private readonly blocklist: Set<string>;

  /**
   * @param blocklist – Lowercase process name substrings to flag.
   */
  constructor(blocklist: string[]) {
    this.blocklist = new Set(blocklist.map((b) => b.toLowerCase().trim()));
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Scan all running processes and return every blocklist hit.
   *
   * The method is intentionally **synchronous** so callers can decide
   * whether to wrap it in a worker or run it on the main thread.
   */
  scan(): ScanResult {
    try {
      const processes = this.enumerateProcesses();
      const matches = this.matchAgainstBlocklist(processes);
      return { detected: matches.length > 0, matches };
    } catch {
      // If process enumeration fails (permissions, sandboxed env, etc.)
      // we return a safe "nothing detected" result rather than crashing.
      return { detected: false, matches: [] };
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Returns a de‑duplicated array of lowercase process names currently
   * running on the host.
   */
  private enumerateProcesses(): string[] {
    const isWindows = process.platform === 'win32';
    const raw = isWindows
      ? this.enumerateWindows()
      : this.enumerateUnix();

    // De‑duplicate to avoid redundant matching work.
    return [...new Set(raw)];
  }

  /**
   * Windows: `tasklist /fo csv /nh` outputs lines like:
   * ```
   * "chrome.exe","12345","Console","1","123,456 K"
   * ```
   * We grab the first quoted field and strip the extension.
   */
  private enumerateWindows(): string[] {
    const stdout = execSync('tasklist /fo csv /nh', {
      encoding: 'utf-8',
      timeout: 10_000,
      windowsHide: true,
    });

    const names: string[] = [];

    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('INFO:')) continue;

      // Extract the first CSV field (quoted image name).
      const match = trimmed.match(/^"([^"]+)"/);
      if (match) {
        // Remove common extensions so "cheatengine.exe" matches "cheatengine".
        const raw = match[1].replace(/\.(exe|com|scr|bat|cmd)$/i, '');
        names.push(raw.toLowerCase());
      }
    }

    return names;
  }

  /**
   * macOS / Linux: `ps -axco comm` returns one process name per line.
   */
  private enumerateUnix(): string[] {
    const stdout = execSync('ps -axco comm', {
      encoding: 'utf-8',
      timeout: 10_000,
    });

    return stdout
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
      .filter((l) => l !== 'comm'); // header row
  }

  /**
   * Performs **substring matching** — if *any* blocklist entry is a
   * substring of a running process name (or vice‑versa) it counts as a hit.
   *
   * This catches variants like `cheatengine-x86_64` matching `cheatengine`.
   */
  private matchAgainstBlocklist(processes: string[]): string[] {
    const matched = new Set<string>();

    for (const proc of processes) {
      for (const blocked of this.blocklist) {
        if (proc.includes(blocked) || blocked.includes(proc)) {
          matched.add(proc);
        }
      }
    }

    return [...matched];
  }
}
