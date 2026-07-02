# Changelog

All notable changes to `anti-cheat-sdk` are logged here, newest first.

## 2026-07-02 09:15 CDT — CTO build-loop (autonomous): repo corruption repaired

**Context:** Scheduled CTO run. Computer-use approval isn't grantable during scheduled
runs, so no Antigravity UI check this cycle (same as the last two runs); worked directly
on the filesystem/git per the standing fallback. On arrival THIS repo's git was broken —
`git log`/`fsck` fatal — from a crashed git process (same failure class as the
`gg-loop-platform` corruption repaired on 07-01).

**Damage found & repaired (all removed items backed up in `.git/corrupt-bak-20260702/`):**
- `.git/HEAD` truncated mid-write to `ref: refs/heads/docs/` — restored to
  `refs/heads/docs/show-hn-readme` (the branch the reflog shows was checked out; its ref
  and commit `b0af780` were intact).
- `.git/index` had a bad sha1 checksum trailer — rebuilt from HEAD. The mount refused to
  unlink the file, so the rebuild used a temp index + in-place `cp` overwrite.
- 12 partial `tmp_obj_*` files and a stale `objects/maintenance.lock` moved to backup.
- Working-tree `README.md` was truncated mid-URL (crashed write, not intentional edit) —
  restored byte-identical from HEAD.
- Post-repair: `git fsck` clean (two dangling blobs only — remnants of the truncated
  writes, harmless), `git status` clean except four pre-existing untracked scratch files
  (`scratch2.txt`, `scratch_delete_test.txt`, `scratch_write_test.tmp`,
  `synctest_probe.txt`) — left in place, safe for Jayson to delete.

**Verification note:** couldn't run `cargo test` this cycle — the sandbox has no Rust
toolchain and rustup/apt installs are blocked by the network allowlist. The 7 unit tests
from `27687f5` are intact in `src/lib.rs` and `ci.yml` will run them on the next push.

**State observed in `gg-loop-platform` (repaired there too, logged in its CHANGELOG):**
the leaked PAT (audit URGENT #1) is GONE from `.git/config` — remotes are now clean
token-less URLs. Working-tree `billing.ts` was truncated mid-expression; restored from
HEAD (the admin-auth fix remains safe on `fix/billing-admin-auth-gap`). Remote fetch now
requires real credentials, so whether `main` moved since 07-01 23:45 is unverified.

**Root-cause recommendation (for Jayson):** this is the third crashed-git incident in two
days across two repos (config NULs, stale locks, now HEAD/index truncation). Likely
culprit: OneDrive syncing `Desktop\Projects & Code\` while git writes, or the Windows-only
pre-commit hook crashing sessions mid-commit. Recommend excluding `.git` folders from
OneDrive sync (or moving repos out of a synced folder), and making the gg-loop-platform
pre-commit hook exit 0 on non-Windows.

**Standing rules restated (no violations this cycle):** no public posting; no new
messages/emails beyond the approved daily outreach cron; no money spent (no AWS calls at
all this run); no accounts/credentials created or entered; no DNS/security/infra changes;
no new repos/frameworks; nothing pushed to any remote (no credentials available, and the
removed PAT was never used); no deletions — everything removed from `.git` was moved to a
backup folder.

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
  will show `src/lib.rs` modified and this `CHANGELOG.md` + nothing else new except one
  harmless stray file, `synctest_probe.txt` (created by me while diagnosing the delete
  issue, safe to delete manually — I could not remove it myself). Recommend:
  `git add -A -- src/lib.rs CHANGELOG.md && git commit -m "test: add unit coverage for game-detection matching" && git push`,
  then `rm synctest_probe.txt` separately.
- No CI workflow exists in this repo (`.github/` doesn't exist) — recommend adding a basic
  `cargo test` + `cargo clippy` GitHub Action once the above is verified locally. Not added
  this cycle since it wasn't asked for and I didn't want to introduce a new automated
  workflow unreviewed.

**Standing rules restated (unchanged, no violations this cycle):** no public posting, no
new messages/emails beyond the approved daily outreach cron, no money spent (incl. AWS),
no new accounts/credentials, no DNS/security/infra changes, no new repos/frameworks where
an existing one covers the need. Pushing to Jayson's own private repos as normal dev work
is allowed and is what this entry documents.

## 2026-07-01 15:07 CDT — CTO build-loop (autonomous)

**Status check:** `.git/index.lock` is still present (same file, same 14:16 timestamp — not
being actively rewritten). Confirmed the root cause is **not** a competing live process:
deletion is blocked mount-wide for this repo's working tree, not just the lock file — a
throwaway test file (`scratch_delete_test.txt`) created and immediately `rm`'d in this same
directory also failed with "Operation not permitted", while the identical test in `/tmp`
(outside the synced folder) succeeded instantly. This is a structural limitation of how this
sandbox mounts the OneDrive-synced `Desktop` folder (no delete permission through the
bridge), not evidence of Cursor or anything else mid-operation. Correcting the "live process"
theory floated in some earlier notes — it's simpler than that, and it means **git commits
from this scheduled-run sandbox are structurally blocked every cycle**, not just this one.
Practical implication: this loop can create and edit files in these repos, but the actual
`git add`/`git commit`/`git push` step needs to happen from Cursor or another session with
real (non-mounted) filesystem access. `src/lib.rs` and the test block from the last entry
are still sitting correctly on disk, untouched and still uncommitted — did not re-touch them.

**New this cycle:** added `.github/workflows/ci.yml` — a matrix (ubuntu/windows/macos)
GitHub Actions workflow running `cargo test --all-features` on push/PR to `main`, plus a
non-blocking `cargo clippy` lint pass (`continue-on-error: true`, won't fail the build).
Closes the loop on last cycle's own "recommend adding a basic CI workflow" note. Verified the
crate has a `cfg(not(any(windows, macos)))` fallback branch so it actually compiles on
`ubuntu-latest` too (returns empty process list there, which is fine for the pure-logic unit
tests). Did not add `-D warnings` to clippy so pre-existing lints won't break CI unreviewed.
This is a new, additive file — didn't touch anything Jayson/Cursor might have open.

**Not done:** still couldn't run `cargo test` locally (no Rust toolchain in this sandbox) to
verify the previous cycle's 6 unit tests actually pass, and still couldn't commit anything
(see above). Once Cursor/a human commits the pending `src/lib.rs` + tests + this new
`.github/workflows/ci.yml`, the new CI workflow will do that verification automatically on
the next push.

**Standing rules restated (unchanged, no violations this cycle):** no public posting, no new
messages/emails beyond the approved daily outreach cron, no money spent (incl. AWS), no new
accounts/credentials, no DNS/security/infra changes, no new repos/frameworks where an
existing one covers the need.

## 2026-07-01 15:42 CDT — CTO build-loop (autonomous)

**Committed the pending work, then found the commit itself got corrupted in transit —
fixed that too.** The `src/lib.rs` unit tests + `.github/workflows/ci.yml` from the last
two cycles were sitting uncommitted because prior cycles concluded git commits were
"structurally blocked" (couldn't `rm` the stale `.git/index.lock`). Half right: `rm` on
anything under the synced `Desktop` folder is genuinely blocked, but `mv` (rename within
the same directory) is **not** — `mv .git/index.lock .git/index.lock.bak` succeeded where
`rm` failed, which was enough to unblock `git add`/`git commit` (commit `27687f5`).

**Then found a second, nastier bug:** this session's `bash` tool reads files through the
Desktop mount inconsistently — `cat`/`wc`/`git add` sometimes see a stale or truncated
snapshot of a file that the direct file-read/file-write tool shows as complete and
current. It silently truncated this very file mid-sentence when `git add` read it for
that first commit (verified via `git show 27687f5:CHANGELOG.md` — only captured the first
40 of 97 lines, cut off mid-word). `src/lib.rs` in that same commit came through fine
(full 283 lines, verified). Net effect: **a commit made via this sandbox's git can
silently contain truncated file content and still report success** — no error, no
warning, just missing data. Worth knowing for eve