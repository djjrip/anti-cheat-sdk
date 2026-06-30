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

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ViolationEvent } from './types';

/** Maximum number of retry attempts per event. */
const MAX_RETRIES = 3;

/** Base delay between retries in milliseconds (doubles each attempt). */
const BASE_BACKOFF_MS = 500;

/** Maximum queued events before we start dropping the oldest ones. */
const MAX_QUEUE_SIZE = 500;

export class WebhookReporter {
  private readonly webhookUrl: string;
  private readonly parsedUrl: URL;
  private readonly transport: typeof http | typeof https;

  /** Events waiting to be sent (accumulated while offline). */
  private readonly queue: ViolationEvent[] = [];

  /** Prevents concurrent flush operations. */
  private flushing = false;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
    this.parsedUrl = new URL(webhookUrl);
    this.transport = this.parsedUrl.protocol === 'https:' ? https : http;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Report a violation event.  The event is delivered immediately if the
   * network is reachable, otherwise it is queued for later delivery.
   */
  async report(event: ViolationEvent): Promise<void> {
    // Always push to queue first — even if we send inline, the queue
    // guarantees ordering and acts as the retry buffer.
    this.enqueue(event);
    await this.flush();
  }

  /**
   * Manually trigger a flush of the offline queue.  Called automatically
   * after every `report()` but exposed publicly for edge cases.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;

    this.flushing = true;

    try {
      // Drain the queue front‑to‑back (FIFO).
      while (this.queue.length > 0) {
        const event = this.queue[0];
        const sent = await this.sendWithRetry(event);

        if (sent) {
          // Successfully delivered — remove from queue and continue.
          this.queue.shift();
        } else {
          // Network still unreachable — stop draining and wait for the
          // next report() call to retry.
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Number of events waiting in the offline queue. */
  get pendingCount(): number {
    return this.queue.length;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private enqueue(event: ViolationEvent): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop the oldest event to make room.
      this.queue.shift();
    }
    this.queue.push(event);
  }

  /**
   * Attempt to POST `event` up to `MAX_RETRIES` times with exponential
   * back‑off.  Returns `true` on success, `false` if all attempts failed.
   */
  private async sendWithRetry(event: ViolationEvent): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.post(event);
        return true;
      } catch (err) {
        const isLast = attempt === MAX_RETRIES - 1;
        if (isLast) {
          this.log(`All ${MAX_RETRIES} delivery attempts failed for event ${event.type}: ${this.errorMessage(err)}`);
          return false;
        }

        const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
        this.log(`Attempt ${attempt + 1} failed (${this.errorMessage(err)}), retrying in ${delay}ms…`);
        await this.sleep(delay);
      }
    }

    return false;
  }

  /** Low‑level HTTPS/HTTP POST using built‑in Node modules. */
  private post(event: ViolationEvent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const body = JSON.stringify(event);

      const options: http.RequestOptions = {
        hostname: this.parsedUrl.hostname,
        port: this.parsedUrl.port || (this.parsedUrl.protocol === 'https:' ? 443 : 80),
        path: this.parsedUrl.pathname + this.parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': '@djjrip/anti-cheat-sdk/1.0.0',
        },
        timeout: 10_000,
      };

      const req = this.transport.request(options, (res) => {
        // Consume the response body so the socket can be freed.
        res.resume();

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });

      req.write(body);
      req.end();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private log(message: string): void {
    try {
      console.warn(`[AntiCheatSDK:Reporter] ${message}`);
    } catch {
      // Logging should never throw.
    }
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
