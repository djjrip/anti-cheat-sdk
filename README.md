# @djjrip/anti-cheat-sdk

> Production‑grade AntiCheat SDK for real‑time process scanning, foreground window tracking, and webhook‑based violation reporting. Zero runtime dependencies — uses only Node.js built‑in modules.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

| Capability | Details |
|---|---|
| **Process Scanning** | Enumerates running processes via `tasklist` (Windows) / `ps` (macOS) and checks against a 40+ entry blocklist |
| **Focus Tracking** | Detects when a blocklisted application gains foreground focus using `user32.dll` (Windows) / `osascript` (macOS) |
| **Webhook Reporting** | POSTs violation events to your endpoint with 3‑attempt exponential back‑off and a 500‑event offline queue |
| **EventEmitter API** | Subscribe to `'violation'` events directly in your application |
| **Zero Dependencies** | Ships with no runtime `node_modules` — only Node.js built‑ins (`child_process`, `http`, `https`, `events`, `url`) |
| **Cross‑Platform** | Works on Windows and macOS out of the box |

---

## Installation

```bash
npm install @djjrip/anti-cheat-sdk
```

Or with Yarn / pnpm:

```bash
yarn add @djjrip/anti-cheat-sdk
pnpm add @djjrip/anti-cheat-sdk
```

---

## Quick Start

```ts
import { AntiCheatSDK } from '@djjrip/anti-cheat-sdk';

const ac = new AntiCheatSDK({
  sessionId: 'match-abc-123',
  webhookUrl: 'https://api.ggloop.io/violations',
});

ac.on('violation', (event) => {
  console.log('🚨 VIOLATION:', event.type, event.processName);
  console.log('   Reason:', event.reason);
});

// Start monitoring
ac.start();

// Later — stop monitoring
// ac.stop();
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `sessionId` | `string` | *required* | Unique identifier for the current session |
| `webhookUrl` | `string` | *required* | HTTPS endpoint that receives `ViolationEvent` payloads |
| `scanInterval` | `number` | `5000` | Process scan interval in milliseconds |
| `blocklist` | `string[]` | `[]` | Additional process names to flag (merged with built‑in list) |
| `onViolation` | `(event) => void` | — | Synchronous callback fired on every violation |

---

## API Reference

### `AntiCheatSDK`

```ts
import { AntiCheatSDK } from '@djjrip/anti-cheat-sdk';
```

#### Constructor

```ts
new AntiCheatSDK(config: AntiCheatConfig)
```

Creates an SDK instance. The built‑in blocklist (40+ cheat tools) is automatically merged with any user‑supplied entries.

#### Methods

| Method | Returns | Description |
|---|---|---|
| `start()` | `void` | Begin process scanning and focus tracking |
| `stop()` | `void` | Stop all monitoring |
| `scanNow()` | `ScanResult` | Run a single on‑demand process scan |
| `on('violation', cb)` | `this` | Subscribe to violation events |
| `once('violation', cb)` | `this` | Subscribe to the next violation only |

#### Properties

| Property | Type | Description |
|---|---|---|
| `isRunning` | `boolean` | Whether the SDK is actively monitoring |
| `pendingReports` | `number` | Events waiting in the offline delivery queue |

---

### `ProcessScanner`

Lower‑level API for running process scans without the full SDK:

```ts
import { ProcessScanner, DEFAULT_BLOCKLIST } from '@djjrip/anti-cheat-sdk';

const scanner = new ProcessScanner([...DEFAULT_BLOCKLIST]);
const result = scanner.scan();

if (result.detected) {
  console.log('Matched:', result.matches);
}
```

---

### `FocusTracker`

Lower‑level API for monitoring the foreground window:

```ts
import { FocusTracker } from '@djjrip/anti-cheat-sdk';

const tracker = new FocusTracker(
  ['cheatengine', 'wemod'],
  'session-123',
  (violation) => console.log(violation),
  2000, // poll every 2 s
);

tracker.start();
```

---

### `WebhookReporter`

Lower‑level API for posting violation events:

```ts
import { WebhookReporter } from '@djjrip/anti-cheat-sdk';

const reporter = new WebhookReporter('https://api.ggloop.io/violations');

await reporter.report({
  type: 'process',
  processName: 'cheatengine',
  windowTitle: '',
  timestamp: new Date().toISOString(),
  sessionId: 'session-123',
  reason: 'Cheat Engine detected',
});
```

---

## Types

```ts
import type {
  AntiCheatConfig,
  ViolationEvent,
  ViolationType,
  ScanResult,
} from '@djjrip/anti-cheat-sdk';
```

### `ViolationEvent`

```ts
interface ViolationEvent {
  type: 'process' | 'focus' | 'tamper';
  processName: string;
  windowTitle: string;
  timestamp: string;     // ISO 8601
  sessionId: string;
  reason: string;
}
```

### `ScanResult`

```ts
interface ScanResult {
  detected: boolean;
  matches: string[];
}
```

---

## Built‑in Blocklist

The SDK ships with 40+ entries covering:

- **Memory editors** — Cheat Engine, ArtMoney, GameGuardian, GameCIH
- **Trainers** — WeMod, CosmosUnofficial, MrAntiFun
- **Debuggers** — dnSpy, x64dbg, x32dbg, OllyDbg, IDA Pro, Ghidra, Radare2
- **Network tools** — Wireshark, Fiddler, Charles, mitmproxy
- **Automation** — AutoHotkey, AutoIt, TinyTask
- **Mobile hacks** — Lucky Patcher, Freedom, xModGames
- **Exploits** — SpeedHack, NoClip

Extend it at runtime:

```ts
const ac = new AntiCheatSDK({
  sessionId: 'match-1',
  webhookUrl: 'https://api.ggloop.io/violations',
  blocklist: ['my-custom-cheat', 'another-tool'],
});
```

---

## Building from Source

```bash
git clone https://github.com/djjrip/anti-cheat-sdk.git
cd anti-cheat-sdk
npm install
npm run build
```

The compiled output is written to `dist/`.

---

## License

MIT © djjrip
