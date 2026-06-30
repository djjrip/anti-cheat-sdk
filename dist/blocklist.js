"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BLOCKLIST = void 0;
/**
 * @djjrip/anti-cheat-sdk — Default blocklist
 *
 * A curated list of well‑known cheat engines, memory editors, debuggers,
 * packet sniffers, automation tools, and mobile game‑hack utilities.
 *
 * All entries are **lowercase** — the scanner normalises process names before
 * comparison so matching is always case‑insensitive.
 *
 * Users can extend this list via `AntiCheatConfig.blocklist`.
 */
exports.DEFAULT_BLOCKLIST = [
    // ── Memory editors / cheat engines ──────────────────────────────────
    'cheatengine',
    'cheat engine',
    'cheat-engine',
    'ce-unpacker',
    'artmoney',
    'gameguardian',
    'gamecih',
    'sb game hacker',
    'tsearch',
    // ── Trainers / mod tools ────────────────────────────────────────────
    'wemod',
    'trainer',
    'cosmosaunofficial',
    'mrantifun',
    // ── Debuggers / reverse‑engineering ─────────────────────────────────
    'dnspy',
    'x64dbg',
    'x32dbg',
    'ollydbg',
    'ida64',
    'ida',
    'ghidra',
    'radare2',
    'processhacker',
    'hxd',
    // ── Network sniffers / proxies ──────────────────────────────────────
    'wireshark',
    'fiddler',
    'charles',
    'httpcanary',
    'mitmproxy',
    // ── Mobile / Android hacks ──────────────────────────────────────────
    'lucky patcher',
    'freedom',
    'xmodgames',
    'igg',
    // ── Automation / macro tools ────────────────────────────────────────
    'autohotkey',
    'autoit',
    'macro',
    'tinytask',
    // ── Speed / exploit hacks ───────────────────────────────────────────
    'speed hack',
    'speedhack',
    'noclip',
    // ── System utilities sometimes used for cheating ────────────────────
    'iobit',
];
//# sourceMappingURL=blocklist.js.map