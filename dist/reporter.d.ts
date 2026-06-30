/**
 * @djjrip/anti-cheat-sdk — Webhook reporter
 *
 * Delivers `ViolationEvent` payloads to a remote endpoint using only the
 * Node.js built‑in `http` / `https` modules.  Includes:
 *
 *  • Automatic retry with exponential back‑off (3 attempts)
 *  • Offline queue — events are buffered when the network is unreachable
 *    and flushed automatically on the next successful delivery
 *  • All errors are caught and logged; the reporter **never** throws
 */
import { ViolationEvent } from './types';
export declare class WebhookReporter {
    private readonly webhookUrl;
    private readonly parsedUrl;
    private readonly transport;
    /** Events waiting to be sent (accumulated while offline). */
    private readonly queue;
    /** Prevents concurrent flush operations. */
    private flushing;
    constructor(webhookUrl: string);
    /**
     * Report a violation event.  The event is delivered immediately if the
     * network is reachable, otherwise it is queued for later delivery.
     */
    report(event: ViolationEvent): Promise<void>;
    /**
     * Manually trigger a flush of the offline queue.  Called automatically
     * after every `report()` but exposed publicly for edge cases.
     */
    flush(): Promise<void>;
    /** Number of events waiting in the offline queue. */
    get pendingCount(): number;
    private enqueue;
    /**
     * Attempt to POST `event` up to `MAX_RETRIES` times with exponential
     * back‑off.  Returns `true` on success, `false` if all attempts failed.
     */
    private sendWithRetry;
    /** Low‑level HTTPS/HTTP POST using built‑in Node modules. */
    private post;
    private sleep;
    private log;
    private errorMessage;
}
//# sourceMappingURL=reporter.d.ts.map