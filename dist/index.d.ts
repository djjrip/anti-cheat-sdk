/**
 * @djjrip/anti-cheat-sdk
 *
 * Production‑grade AntiCheat SDK for real‑time process scanning, foreground
 * window tracking, and webhook‑based violation reporting.
 *
 * Zero runtime dependencies — uses only Node.js built‑in modules.
 *
 * @example
 * ```ts
 * import { AntiCheatSDK } from '@djjrip/anti-cheat-sdk';
 *
 * const ac = new AntiCheatSDK({
 *   sessionId: 'match-abc-123',
 *   webhookUrl: 'https://api.ggloop.io/violations',
 * });
 *
 * ac.on('violation', (event) => {
 *   console.log('VIOLATION:', event);
 * });
 *
 * ac.start();
 * ```
 */
import { EventEmitter } from 'events';
import { AntiCheatConfig, ViolationEvent, ScanResult } from './types';
export { AntiCheatConfig, ViolationEvent, ViolationType, ScanResult } from './types';
export { DEFAULT_BLOCKLIST } from './blocklist';
export { ProcessScanner } from './scanner';
export { FocusTracker } from './focus';
export { WebhookReporter } from './reporter';
/**
 * Main entry point for the AntiCheat SDK.
 *
 * Combines process scanning, focus tracking, and webhook reporting into a
 * single high‑level API.
 */
export declare class AntiCheatSDK extends EventEmitter {
    private readonly config;
    private readonly scanner;
    private readonly focusTracker;
    private readonly reporter;
    private scanInterval;
    private active;
    /**
     * Set of process names already reported **in this session** so we don't
     * flood the webhook with duplicates for the same running process.
     */
    private readonly reportedProcesses;
    constructor(config: AntiCheatConfig);
    /**
     * Start the anti‑cheat monitoring loop.
     *
     * - Runs an initial process scan immediately.
     * - Begins periodic scanning at the configured interval.
     * - Activates foreground‑window tracking.
     */
    start(): void;
    /** Stop all scanning and tracking. */
    stop(): void;
    /** Returns `true` when the SDK is actively monitoring. */
    get isRunning(): boolean;
    /**
     * Perform a single on‑demand process scan (useful for pre‑flight checks
     * before a match starts).
     */
    scanNow(): ScanResult;
    /** Number of violation events waiting in the offline delivery queue. */
    get pendingReports(): number;
    /** Register a listener for violation events. */
    on(event: 'violation', listener: (e: ViolationEvent) => void): this;
    /** Register a one‑time listener for violation events. */
    once(event: 'violation', listener: (e: ViolationEvent) => void): this;
    /** Execute a process scan and handle any findings. */
    private runScan;
    /**
     * Central violation handler — routes the event to all consumers:
     *  1. The user's `onViolation` callback (if provided)
     *  2. EventEmitter listeners
     *  3. Webhook reporter
     */
    private handleViolation;
    /**
     * Merge the default blocklist with user‑supplied entries, de‑duplicating
     * and lowercasing everything.
     */
    private mergeBlocklists;
    private log;
}
//# sourceMappingURL=index.d.ts.map