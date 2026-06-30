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
import { DEFAULT_BLOCKLIST } from './blocklist';
import { ProcessScanner } from './scanner';
import { FocusTracker } from './focus';
import { WebhookReporter } from './reporter';

// ── Re‑exports so consumers can `import { … } from '@djjrip/anti-cheat-sdk'`
export { AntiCheatConfig, ViolationEvent, ViolationType, ScanResult } from './types';
export { DEFAULT_BLOCKLIST } from './blocklist';
export { ProcessScanner } from './scanner';
export { FocusTracker } from './focus';
export { WebhookReporter } from './reporter';

/** Default scan interval if none is provided (5 seconds). */
const DEFAULT_SCAN_INTERVAL_MS = 5_000;

/**
 * Main entry point for the AntiCheat SDK.
 *
 * Combines process scanning, focus tracking, and webhook reporting into a
 * single high‑level API.
 */
export class AntiCheatSDK extends EventEmitter {
  private readonly config: Required<
    Pick<AntiCheatConfig, 'sessionId' | 'webhookUrl' | 'scanInterval'>
  > & { blocklist: string[]; onViolation?: (e: ViolationEvent) => void };

  private readonly scanner: ProcessScanner;
  private readonly focusTracker: FocusTracker;
  private readonly reporter: WebhookReporter;

  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private active = false;

  /**
   * Set of process names already reported **in this session** so we don't
   * flood the webhook with duplicates for the same running process.
   */
  private readonly reportedProcesses = new Set<string>();

  constructor(config: AntiCheatConfig) {
    super();

    // ── Merge & normalise config ──────────────────────────────────────
    const mergedBlocklist = this.mergeBlocklists(
      [...DEFAULT_BLOCKLIST],
      config.blocklist ?? [],
    );

    this.config = {
      sessionId: config.sessionId,
      webhookUrl: config.webhookUrl,
      scanInterval: config.scanInterval ?? DEFAULT_SCAN_INTERVAL_MS,
      blocklist: mergedBlocklist,
      onViolation: config.onViolation,
    };

    // ── Wire up subsystems ────────────────────────────────────────────
    this.scanner = new ProcessScanner(this.config.blocklist);
    this.reporter = new WebhookReporter(this.config.webhookUrl);

    this.focusTracker = new FocusTracker(
      this.config.blocklist,
      this.config.sessionId,
      (event) => this.handleViolation(event),
      // Focus polling runs at half the scan interval for responsiveness.
      Math.max(1000, Math.floor(this.config.scanInterval / 2)),
    );
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Start the anti‑cheat monitoring loop.
   *
   * - Runs an initial process scan immediately.
   * - Begins periodic scanning at the configured interval.
   * - Activates foreground‑window tracking.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Immediate first scan.
    this.runScan();

    // Periodic scans.
    this.scanInterval = setInterval(() => this.runScan(), this.config.scanInterval);
    if (this.scanInterval && typeof this.scanInterval === 'object' && 'unref' in this.scanInterval) {
      (this.scanInterval as NodeJS.Timeout).unref();
    }

    // Focus tracking.
    this.focusTracker.start();

    this.log('Monitoring started.');
  }

  /** Stop all scanning and tracking. */
  stop(): void {
    if (!this.active) return;
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
  get isRunning(): boolean {
    return this.active;
  }

  /**
   * Perform a single on‑demand process scan (useful for pre‑flight checks
   * before a match starts).
   */
  scanNow(): ScanResult {
    return this.scanner.scan();
  }

  /** Number of violation events waiting in the offline delivery queue. */
  get pendingReports(): number {
    return this.reporter.pendingCount;
  }

  // ── EventEmitter convenience typing ──────────────────────────────────

  /** Register a listener for violation events. */
  on(event: 'violation', listener: (e: ViolationEvent) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /** Register a one‑time listener for violation events. */
  once(event: 'violation', listener: (e: ViolationEvent) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Execute a process scan and handle any findings. */
  private runScan(): void {
    try {
      const result = this.scanner.scan();
      if (!result.detected) return;

      for (const match of result.matches) {
        // Skip duplicates within the same monitoring session.
        if (this.reportedProcesses.has(match)) continue;
        this.reportedProcesses.add(match);

        const event: ViolationEvent = {
          type: 'process',
          processName: match,
          windowTitle: '',
          timestamp: new Date().toISOString(),
          sessionId: this.config.sessionId,
          reason: `Blocklisted process "${match}" detected in running processes.`,
        };

        this.handleViolation(event);
      }
    } catch {
      // Scanner errors are non‑fatal.
    }
  }

  /**
   * Central violation handler — routes the event to all consumers:
   *  1. The user's `onViolation` callback (if provided)
   *  2. EventEmitter listeners
   *  3. Webhook reporter
   */
  private handleViolation(event: ViolationEvent): void {
    // 1. Direct callback.
    if (this.config.onViolation) {
      try {
        this.config.onViolation(event);
      } catch (err) {
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
  private mergeBlocklists(defaults: string[], user: string[]): string[] {
    const set = new Set<string>();
    for (const entry of [...defaults, ...user]) {
      const normalised = entry.toLowerCase().trim();
      if (normalised) set.add(normalised);
    }
    return [...set];
  }

  private log(message: string): void {
    try {
      console.log(`[AntiCheatSDK] ${message}`);
    } catch {
      // Logging should never throw.
    }
  }
}
