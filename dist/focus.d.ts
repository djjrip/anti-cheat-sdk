/**
 * @djjrip/anti-cheat-sdk — Focus tracker
 *
 * Polls the OS for the currently‑focused (foreground) window and fires a
 * callback when it matches a blocklisted process name.
 *
 * Works on Windows (PowerShell + user32.dll) and macOS (osascript).
 */
import { ViolationEvent } from './types';
export declare class FocusTracker {
    private readonly blocklist;
    private readonly sessionId;
    private readonly onViolation;
    private readonly pollMs;
    private interval;
    /**
     * Tracks recently‑reported process names so we don't spam duplicate
     * violations for the same window staying in focus across polling cycles.
     */
    private lastReported;
    constructor(blocklist: string[], sessionId: string, onViolation: (event: ViolationEvent) => void, pollMs?: number);
    /** Begin polling for foreground window changes. */
    start(): void;
    /** Stop polling. */
    stop(): void;
    /** Returns `true` when the tracker is actively polling. */
    get running(): boolean;
    private tick;
    /** Detect the foreground window on the current OS. */
    private getFocusedWindow;
    /**
     * Uses PowerShell to call user32.dll `GetForegroundWindow`, then resolves
     * the owning process name and window title.
     *
     * Falls back to a simpler `Get‑Process` query if the P/Invoke fails.
     */
    private getFocusedWindowWindows;
    private getFocusedWindowMac;
}
//# sourceMappingURL=focus.d.ts.map