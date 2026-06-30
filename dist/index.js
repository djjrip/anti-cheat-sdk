"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntiCheatSDK = exports.WebhookReporter = exports.FocusTracker = exports.ProcessScanner = exports.DEFAULT_BLOCKLIST = void 0;
const events_1 = require("events");
const blocklist_1 = require("./blocklist");
const scanner_1 = require("./scanner");
const focus_1 = require("./focus");
const reporter_1 = require("./reporter");
var blocklist_2 = require("./blocklist");
Object.defineProperty(exports, "DEFAULT_BLOCKLIST", { enumerable: true, get: function () { return blocklist_2.DEFAULT_BLOCKLIST; } });
var scanner_2 = require("./scanner");
Object.defineProperty(exports, "ProcessScanner", { enumerable: true, get: function () { return scanner_2.ProcessScanner; } });
var focus_2 = require("./focus");
Object.defineProperty(exports, "FocusTracker", { enumerable: true, get: function () { return focus_2.FocusTracker; } });
var reporter_2 = require("./reporter");
Object.defineProperty(exports, "WebhookReporter", { enumerable: true, get: function () { return reporter_2.WebhookReporter; } });
/** Default scan interval if none is provided (5 seconds). */
const DEFAULT_SCAN_INTERVAL_MS = 5000;
/**
 * Main entry point for the AntiCheat SDK.
 *
 * Combines process scanning, focus tracking, and webhook reporting into a
 * single high‑level API.
 */
class AntiCheatSDK extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.scanInterval = null;
        this.active = false;
        /**
         * Set of process names already reported **in this session** so we don't
         * flood the webhook with duplicates for the same running process.
         */
        this.reportedProcesses = new Set();
        // ── Merge & normalise config ──────────────────────────────────────
        const mergedBlocklist = this.mergeBlocklists([...blocklist_1.DEFAULT_BLOCKLIST], config.blocklist ?? []);
        this.config = {
            sessionId: config.sessionId,
            webhookUrl: config.webhookUrl,
            scanInterval: config.scanInterval ?? DEFAULT_SCAN_INTERVAL_MS,
            blocklist: mergedBlocklist,
            onViolation: config.onViolation,
        };
        // ── Wire up subsystems ────────────────────────────────────────────
        this.scanner = new scanner_1.ProcessScanner(this.config.blocklist);
        this.reporter = new reporter_1.WebhookReporter(this.config.webhookUrl);
        this.focusTracker = new focus_1.FocusTracker(this.config.blocklist, this.config.sessionId, (event) => this.handleViolation(event), 
        // Focus polling runs at half the scan interval for responsiveness.
        Math.max(1000, Math.floor(this.config.scanInterval / 2)));
    }
    // ── Public API ────────────────────────────────────────────────────────
    /**
     * Start the anti‑cheat monitoring loop.
     *
     * - Runs an initial process scan immediately.
     * - Begins periodic scanning at the configured interval.
     * - Activates foreground‑window tracking.
     */
    start() {
        if (this.active)
            return;
        this.active = true;
        // Immediate first scan.
        this.runScan();
        // Periodic scans.
        this.scanInterval = setInterval(() => this.runScan(), this.config.scanInterval);
        if (this.scanInterval && typeof this.scanInterval === 'object' && 'unref' in this.scanInterval) {
            this.scanInterval.unref();
        }
        // Focus tracking.
        this.focusTracker.start();
        this.log('Monitoring started.');
    }
    /** Stop all scanning and tracking. */
    stop() {
        if (!this.active)
            return;
        this.active = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        this.focusTracker.stop();
        this.reportedProcesses.clear();
        this.log('Monitoring stopped.');
    }
    /** Returns `true` when the SDK is actively monitoring. */
    get isRunning() {
        return this.active;
    }
    /**
     * Perform a single on‑demand process scan (useful for pre‑flight checks
     * before a match starts).
     */
    scanNow() {
        return this.scanner.scan();
    }
    /** Number of violation events waiting in the offline delivery queue. */
    get pendingReports() {
        return this.reporter.pendingCount;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event, listener) {
        return super.on(event, listener);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    once(event, listener) {
        return super.once(event, listener);
    }
    // ── Internals ─────────────────────────────────────────────────────────
    /** Execute a process scan and handle any findings. */
    runScan() {
        try {
            const result = this.scanner.scan();
            if (!result.detected)
                return;
            for (const match of result.matches) {
                // Skip duplicates within the same monitoring session.
                if (this.reportedProcesses.has(match))
                    continue;
                this.reportedProcesses.add(match);
                const event = {
                    type: 'process',
                    processName: match,
                    windowTitle: '',
                    timestamp: new Date().toISOString(),
                    sessionId: this.config.sessionId,
                    reason: `Blocklisted process "${match}" detected in running processes.`,
                };
                this.handleViolation(event);
            }
        }
        catch {
            // Scanner errors are non‑fatal.
        }
    }
    /**
     * Central violation handler — routes the event to all consumers:
     *  1. The user's `onViolation` callback (if provided)
     *  2. EventEmitter listeners
     *  3. Webhook reporter
     */
    handleViolation(event) {
        // 1. Direct callback.
        if (this.config.onViolation) {
            try {
                this.config.onViolation(event);
            }
            catch (err) {
                this.log(`onViolation callback threw: ${err}`);
            }
        }
        // 2. EventEmitter.
        this.emit('violation', event);
        // 3. Webhook (fire‑and‑forget — reporter handles retries internally).
        this.reporter.report(event).catch((err) => {
            this.log(`Reporter error: ${err}`);
        });
    }
    /**
     * Merge the default blocklist with user‑supplied entries, de‑duplicating
     * and lowercasing everything.
     */
    mergeBlocklists(defaults, user) {
        const set = new Set();
        for (const entry of [...defaults, ...user]) {
            const normalised = entry.toLowerCase().trim();
            if (normalised)
                set.add(normalised);
        }
        return [...set];
    }
    log(message) {
        try {
            console.log(`[AntiCheatSDK] ${message}`);
        }
        catch {
            // Logging should never throw.
        }
    }
}
exports.AntiCheatSDK = AntiCheatSDK;
//# sourceMappingURL=index.js.map