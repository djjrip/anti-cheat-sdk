/**
 * @djjrip/anti-cheat-sdk — Type definitions
 *
 * All public interfaces consumed by SDK users live here so the rest of the
 * codebase (and downstream consumers) have a single source of truth.
 */
/** Violation categories the SDK can detect. */
export type ViolationType = 'process' | 'focus' | 'tamper';
/**
 * Configuration object accepted by the `AntiCheatSDK` constructor.
 *
 * Every field except `sessionId` and `webhookUrl` has a sensible default so
 * callers can get started with minimal boilerplate.
 */
export interface AntiCheatConfig {
    /** Unique identifier for the current gameplay / exam / session. */
    sessionId: string;
    /** HTTPS endpoint that receives `ViolationEvent` payloads via POST. */
    webhookUrl: string;
    /**
     * How often (in **milliseconds**) to scan running processes.
     * @default 5000
     */
    scanInterval?: number;
    /**
     * Additional process‑name strings to treat as violations.
     * These are merged (de‑duped) with the built‑in `DEFAULT_BLOCKLIST`.
     * All matching is case‑insensitive.
     */
    blocklist?: string[];
    /**
     * Optional synchronous callback fired **immediately** when a violation is
     * detected, before the event is queued for webhook delivery.
     */
    onViolation?: (event: ViolationEvent) => void;
}
/**
 * Payload sent to the webhook (and emitted locally) when a violation is
 * detected.
 */
export interface ViolationEvent {
    /** What kind of violation was detected. */
    type: ViolationType;
    /** Lowercase name of the offending process (if applicable). */
    processName: string;
    /** Title of the foreground window at detection time (if available). */
    windowTitle: string;
    /** ISO‑8601 timestamp of detection. */
    timestamp: string;
    /** Session identifier copied from `AntiCheatConfig.sessionId`. */
    sessionId: string;
    /** Human‑readable explanation of why this was flagged. */
    reason: string;
}
/**
 * Return value of `ProcessScanner.scan()`.
 */
export interface ScanResult {
    /** `true` when at least one blocklisted process was found running. */
    detected: boolean;
    /** Lowercase names of every matched process. */
    matches: string[];
}
//# sourceMappingURL=types.d.ts.map