"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookReporter = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
/** Maximum number of retry attempts per event. */
const MAX_RETRIES = 3;
/** Base delay between retries in milliseconds (doubles each attempt). */
const BASE_BACKOFF_MS = 500;
/** Maximum queued events before we start dropping the oldest ones. */
const MAX_QUEUE_SIZE = 500;
class WebhookReporter {
    constructor(webhookUrl) {
        /** Events waiting to be sent (accumulated while offline). */
        this.queue = [];
        /** Prevents concurrent flush operations. */
        this.flushing = false;
        this.webhookUrl = webhookUrl;
        this.parsedUrl = new url_1.URL(webhookUrl);
        this.transport = this.parsedUrl.protocol === 'https:' ? https : http;
    }
    // ── Public API ────────────────────────────────────────────────────────
    /**
     * Report a violation event.  The event is delivered immediately if the
     * network is reachable, otherwise it is queued for later delivery.
     */
    async report(event) {
        // Always push to queue first — even if we send inline, the queue
        // guarantees ordering and acts as the retry buffer.
        this.enqueue(event);
        await this.flush();
    }
    /**
     * Manually trigger a flush of the offline queue.  Called automatically
     * after every `report()` but exposed publicly for edge cases.
     */
    async flush() {
        if (this.flushing || this.queue.length === 0)
            return;
        this.flushing = true;
        try {
            // Drain the queue front‑to‑back (FIFO).
            while (this.queue.length > 0) {
                const event = this.queue[0];
                const sent = await this.sendWithRetry(event);
                if (sent) {
                    // Successfully delivered — remove from queue and continue.
                    this.queue.shift();
                }
                else {
                    // Network still unreachable — stop draining and wait for the
                    // next report() call to retry.
                    break;
                }
            }
        }
        finally {
            this.flushing = false;
        }
    }
    /** Number of events waiting in the offline queue. */
    get pendingCount() {
        return this.queue.length;
    }
    // ── Internals ─────────────────────────────────────────────────────────
    enqueue(event) {
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
    async sendWithRetry(event) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await this.post(event);
                return true;
            }
            catch (err) {
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
    post(event) {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify(event);
            const options = {
                hostname: this.parsedUrl.hostname,
                port: this.parsedUrl.port || (this.parsedUrl.protocol === 'https:' ? 443 : 80),
                path: this.parsedUrl.pathname + this.parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'User-Agent': '@djjrip/anti-cheat-sdk/1.0.0',
                },
                timeout: 10000,
            };
            const req = this.transport.request(options, (res) => {
                // Consume the response body so the socket can be freed.
                res.resume();
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                }
                else {
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
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    log(message) {
        try {
            console.warn(`[AntiCheatSDK:Reporter] ${message}`);
        }
        catch {
            // Logging should never throw.
        }
    }
    errorMessage(err) {
        if (err instanceof Error)
            return err.message;
        return String(err);
    }
}
exports.WebhookReporter = WebhookReporter;
//# sourceMappingURL=reporter.js.map