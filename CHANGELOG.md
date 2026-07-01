# Changelog

All notable changes to `anti-cheat-sdk` are logged here, newest first.

## 2026-07-01 14:20 CDT — CTO build-loop (autonomous)

**Context:** Weekly-ish autonomous CTO pass. `gg-loop-platform` had a stale `.git/index.lock`
sitting in its `.git` folder (couldn't confirm whether that's a live editor session or just
a leftover — see note below), so this cycle's highest-leverage push went to the canonical
SDK repo instead, which had zero automated tests despite being the product in this
morning's freshly-made "GG Loop Anti-Cheat Pitch Deck.pdf" / pitch.zip (found in
`Projects & Code/`, timestamped 07:4x today).

**Changed:**
- `src/lib.rs`: extracted the OS-independent matching logic out of `detect_active_game()`
  into a new pure function `detect_active_game_in(games, running)`. `detect_active_game()`
  is unchanged from the outside (still calls `get_running_processes()` internally) — this
  is a non-breaking refactor, just makes the core logic testable without a real OS process
  list.
- Added a `#[cfg(test)] mod tests` block with 6 unit tests covering: `default_games()` id
  uniqueness/non-empty invariants, exact process match, case-insensitive match, disabled
  games being skipped, no-match case, deterministic first-match-wins ordering, and the
  `ends_with` full-path suffix match branch (relevant since `get_running_processes()` can
  return full paths on some platforms).

**Not done / needs a human or a real toolchain:**
- **Could not run `cargo test`** — this sandbox has no Rust toolchain (`cargo`/`rustc` not
  installed, and package install is blocked by permissions). The tests are written and
  should be correct (manually checked brace/paren balance and re-read the full file), but
  **please run `cargo test` locally (Cursor/your machine) to confirm before relying on
  this.**
- **Could not `git commit`/`git push` this change.** This session's sandbox blocks file
  deletion entirely (confirmed: even a throwaway test file in a scratch directory couldn't
  be `rm`'d — "Operation not permitted"), and `git commit` needs to remove its own
  `index.lock` as part of a normal commit. That's a hard limitation of this run, not a sign
  of a competing live process — I was wrong to assume "something else is committing" above;
  more likely this lock is just a leftover from a prior session that could never be cleaned
  up for the same reason. **The code + test changes above are sitting uncommitted in the
  actual working tree on disk** (verified: `src/lib.rs` is the full, correct 283-line
  version, not a partial write). Next time you (or Cursor) open this repo, `git status`
  will show `src/lib.rs` modified and this `CHANGEL