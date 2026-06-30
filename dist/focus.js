"use strict";
/**
 * @djjrip/anti-cheat-sdk — Focus tracker
 *
 * Polls the OS for the currently‑focused (foreground) window and fires a
 * callback when it matches a blocklisted process name.
 *
 * Works on Windows (PowerShell + user32.dll) and macOS (osascript).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FocusTracker = void 0;
const child_process_1 = require("child_process");
class FocusTracker {
    constructor(blocklist, sessionId, onViolation, pollMs = 2000) {
        this.interval = null;
        /**
         * Tracks recently‑reported process names so we don't spam duplicate
         * violations for the same window staying in focus across polling cycles.
         */
        this.lastReported = null;
        this.blocklist = new Set(blocklist.map((b) => b.toLowerCase().trim()));
        this.sessionId = sessionId;
        this.onViolation = onViolation;
        this.pollMs = pollMs;
    }
    // ── Public API ────────────────────────────────────────────────────────
    /** Begin polling for foreground window changes. */
    start() {
        if (this.interval)
            return; // already running
        this.interval = setInterval(() => this.tick(), this.pollMs);
        // Unref so the interval alone won't keep the Node process alive.
        if (this.interval && typeof this.interval === 'object' && 'unref' in this.interval) {
            this.interval.unref();
        }
    }
    /** Stop polling. */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.lastReported = null;
    }
    /** Returns `true` when the tracker is actively polling. */
    get running() {
        return this.interval !== null;
    }
    // ── Internals ─────────────────────────────────────────────────────────
    tick() {
        try {
            const focus = this.getFocusedWindow();
            if (!focus)
                return;
            const procLower = focus.processName.toLowerCase();
            // Check if the focused process matches anything on the blocklist.
            let matched = false;
            for (const blocked of this.blocklist) {
                if (procLower.includes(blocked) || blocked.includes(procLower)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Focus moved to an allowed app — reset duplicate guard.
                this.lastReported = null;
                return;
            }
            // Don't re‑fire for the same process sitting in the foreground.
            if (this.lastReported === procLower)
                return;
            this.lastReported = procLower;
            const event = {
                type: 'focus',
                processName: procLower,
                windowTitle: focus.windowTitle,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId,
                reason: `Blocked application "${focus.processName}" gained foreground focus.`,
            };
            this.onViolation(event);
        }
        catch {
            // Swallow — focus detection is best‑effort.
        }
    }
    /** Detect the foreground window on the current OS. */
    getFocusedWindow() {
        return process.platform === 'win32'
            ? this.getFocusedWindowWindows()
            : this.getFocusedWindowMac();
    }
    // ── Windows implementation ────────────────────────────────────────────
    /**
     * Uses PowerShell to call user32.dll `GetForegroundWindow`, then resolves
     * the owning process name and window title.
     *
     * Falls back to a simpler `Get‑Process` query if the P/Invoke fails.
     */
    getFocusedWindowWindows() {
        // Primary: P/Invoke via Add-Type (most reliable)
        const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$hwnd = [FG]::GetForegroundWindow()
$pid = 0
[void][FG]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$sb = New-Object System.Text.StringBuilder 256
[void][FG]::GetWindowText($hwnd, $sb, 256)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "" }
Write-Output "$name|||$($sb.ToString())"
`.trim();
        try {
            const stdout = (0, child_process_1.execSync)(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`, { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim();
            const [procName, title] = stdout.split('|||');
            if (procName) {
                return { processName: procName.trim(), windowTitle: (title ?? '').trim() };
            }
        }
        catch {
            // P/Invoke failed — try fallback below.
        }
        // Fallback: simpler Get‑Process query.
        try {
            const stdout = (0, child_process_1.execSync)('powershell -NoProfile -NonInteractive -Command "(Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -First 1 | ForEach-Object { $_.ProcessName + \'|||\' + $_.MainWindowTitle})"', { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim();
            const [procName, title] = stdout.split('|||');
            if (procName) {
                return { processName: procName.trim(), windowTitle: (title ?? '').trim() };
            }
        }
        catch {
            // Both methods failed.
        }
        return null;
    }
    // ── macOS implementation ──────────────────────────────────────────────
    getFocusedWindowMac() {
        try {
            const processName = (0, child_process_1.execSync)("osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'", { encoding: 'utf-8', timeout: 5000 }).trim();
            // Attempt to grab the window title as well.
            let windowTitle = '';
            try {
                windowTitle = (0, child_process_1.execSync)("osascript -e 'tell application \"System Events\" to get title of front window of first application process whose frontmost is true'", { encoding: 'utf-8', timeout: 5000 }).trim();
            }
            catch {
                // Window title is best‑effort.
            }
            if (processName) {
                return { processName, windowTitle };
            }
        }
        catch {
            // osascript not available.
        }
        return null;
    }
}
exports.FocusTracker = FocusTracker;
//# sourceMappingURL=focus.js.map