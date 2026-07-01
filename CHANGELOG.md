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
warning, just missing data. Worth knowing for every future cycle: after any commit here,
run `git show <sha>:<path> | wc -l` and compare against the real file before trusting it.
This entry's own fix: rewrote `CHANGELOG.md` in the same shell call that both wrote and
verified the line count before committing, to close the same race.

**Did NOT push — found something that needs your call first.** Ran `git fetch` before
pushing (habit, not routine before) and found `origin/main` on `djjrip/anti-cheat-sdk`
was **force-pushed on 2026-06-30 00:33**, replacing the entire Rust/Cargo history
(`01ae247` → `8ac6191`, the code this local clone and the last 3 cycles of work are built
on) with an unrelated TypeScript rewrite: "Initial commit: Open Source Anti-Cheat SDK
MVP" (`6c135f8`) + "fix: ignore node_modules" (`5b6fc18`). The new remote tree is
`src/{blocklist,focus,index,reporter,scanner,types}.ts` + compiled `dist/` + `package.json`
— a completely different implementation, no shared history with what's on disk here.

**This means:** the Rust code, tests, and CI workflow from this cycle and the last two are
for a version of the SDK that's no longer what's live on GitHub. Local commits are safe
(sitting in this local clone only, nothing lost), but pushing them would require a
force-push over your own intentional rewrite — **not doing that autonomously.** Need your
call: (a) is the TypeScript rewrite the new direction and this Rust clone/repo folder
should just be deleted and re-cloned from `origin/main`, or (b) was the Rust version meant
to stay and the TS force-push was a mistake worth reverting? Flagging in the run report
rather than guessing.

**`gg-loop-platform` — left untouched again this cycle, different reason than before.**
Earlier cycles avoided it thinking git was sandbox-blocked there too; that's not quite
right either (same `mv` trick would likely work). The real reason to stay away: reads of
`apps/ggloop-web/client/src/{App.tsx,Footer.tsx}` through this sandbox's mount showed the
exact same stale/truncated-read bug described above, consistent with either (a) this
mount-read bug in general, or (b) Cursor/another live session actively writing there —
couldn't tell which, so treated it as possibly-live and left it alone. Also, per
`006_WORKSPACE_AUDIT_2026-07-01.md` URGENT #5, a push to this repo's `main` triggers a
real paid AWS App Runner + Amplify redeploy regardless of branch content — a
money-spending action that's off-limits autonomously anyway. No writes attempted there
this cycle.

**Standing rules restated (unchanged, no violations this cycle):** no public posting, no
new messages/emails beyond the approved daily outreach cron, no money spent (incl. AWS —
this is exactly why `gg-loop-platform` main was avoided), no new accounts/credentials, no
DNS/security/infra changes, no new repos/frameworks where an existing one covers the need,
no force-push over what looks like intentional upstream work.

## Prior history
No changelog existed before this entry. Repo history starts at commit `01ae247`
(initial commit) through `8ac6191` (README rewrite, 2026-06-10) — see `git log` for detail.
