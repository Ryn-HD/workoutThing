# Upstream Sync Plan — porting the fork onto the latest Liftosaur

**Living document.** Claude updates this as work progresses. Last updated: 2026-07-10.

## Goal

Get the most up-to-date code from the real Liftosaur (`astashov/liftosaur`) and re-apply
this fork's changes on top of it — i.e. rebase the fork's personal work onto the latest
upstream `master`, then push the result to the personal fork (`Ryn-HD/workoutThing`).

## Remotes

| Remote | URL | Meaning |
|---|---|---|
| `origin` | `git@github.com:Ryn-HD/workoutThing.git` | Personal fork (deploy target) |
| `upstream` | `https://github.com/astashov/liftosaur.git` | The real Liftosaur (added 2026-07-10) |

## Starting state (2026-07-10)

- `origin/master` == local `master` (fork was in sync).
- Local `master` is **19 commits ahead** of the divergence point and **464 commits behind** `upstream/master`.
- Merge base: `30a4990b "Copy builtin programs in lambda"`.
- **Safety backup tag:** `pre-sync-backup` — points at the original `master` (`9f5a6a1f`). Nothing is lost; we can always reset to this.

## Key complication: CRLF line-ending churn

The fork committed **CRLF** line endings on many source files. This inflates diffs enormously
but the *real* content changes are small:

| File | Raw diff lines | Real (`-w`) lines |
|---|---|---|
| `src/ducks/thunks.ts` | 3349 | ~51 |
| `src/api/service.ts` | 1465 | ~19 |
| `webpack.config.js` | 1155 | (mostly churn) |

Total real content change across `src/`, `test/`, `tests/`: **~1675 insertions / 332 deletions**,
plus a set of brand-new files (see below).

**Implication:** a naive rebase would produce line-ending conflicts on nearly every file.
Mitigation: rebase with `-Xignore-all-space` so the merge machinery ignores whitespace/EOL-only
differences and only surfaces *genuine* content conflicts. Normalize to LF at the end.

## What the fork actually changes

### A. Brand-new files (no conflict possible — additive)
- `research/` — personal training notes + program source of truth (12 files)
- `api/` — Vercel-native sync backend (`_lib/*`, `sync2.ts`, `storage.ts`, `signin/password.ts`, etc.)
- `vercel.json`, `.npmrc`, `scripts/build-pwa-static.js`
- `PERSONAL_FORK_SPEC.md`, `LIFTOSAUR_FORK_V1_SPEC.md`
- `src/utils/personalFork.ts`, `src/models/bodyweight.ts`
- New tests: `test/progress.test.ts`, `test/progressSequence.test.ts`, `test/set.test.ts`, `tests/bodyweight.spec.ts`

### B. Real source modifications (conflict candidates — need care where upstream also changed them)
- `src/models/progress.ts` (~298 real lines) — largest logic change
- `src/models/set.ts` (~55), `src/models/exercise.ts`, `programToPlanner.ts`, `history.ts`, `program.ts`
- `src/pages/planner/**` — `plannerProgramExercise.ts` (~185), evaluator, parser, grammar, terms, styles, types
- `src/ducks/thunks.ts` (~51 real), `src/api/service.ts` (~19 real)
- `src/components/**` — workout UI, edit-program sheets, account/settings screens
- `src/lib/audioInterface.ts`, `src/utils/liveActivityManager.ts`, `src/watch/index.ts`, `src/webpushr-sw.ts`
- `src/types.ts`, `src/index.html`, various `.html`

### C. Infra / config
- `.gitignore`, `.npmrc`, `CLAUDE.md`, `manifest.webmanifest`, `package.json`, `webpack.config.js`, `vercel.json`

### The 19 commits (oldest → newest)
```
6da18429 Start personal WorkoutThing fork
1762d060 Add canonical set type support
472926ac Prepare PWA deploy and workout sequencing
cc177459 Fix myo-rep superset progression
5aa3a5bf Fix cleared bodyweight added load
95b8edb6 Reset workout scroll on exercise change
bbbd7522 Add Vercel-native cross-device sync backend + PWA fixes
7baea5b4 Trigger Vercel deploy (repo now public)
f30b062e Ignore local .env files
de8809b9 Add .npmrc legacy-peer-deps=true
fce7be6b Seed cloud from local data on first sign-in (no data loss)
39a26d47 Improve planner double progression for myo reps
021c2152 Add personal training research notes and program source of truth
cebe3cd5 Capture confirmed home-gym equipment inventory
69dbf6e6 Fold 2025 creator pass into exercise-selection notes
496b1893 Add exercise-cues note for rear delt, lat pullover/pulldown, face pulls
c781c997 Bank target Upper/Lower restructure schedule and decisions
23364385 Finalize Upper/Lower restructure exercise lists
9f5a6a1f Add app-ready Liftoscript encoding of the Upper/Lower program
```

## Strategy

Do everything on a throwaway branch first; never touch `master` until it's verified and approved.

**Approach changed from rebase → squash-merge.** A 19-commit rebase failed fast: the first
commit is a massive "Start fork" reformat that conflicts, and all 18 later commits would
re-conflict on top. Instead we did **one** `git merge --squash -Xignore-all-space master` onto
a fresh branch off `upstream/master`. Same resulting tree (latest upstream + fork changes),
one conflict-resolution pass, CRLF churn absorbed. Granular history preserved in `pre-sync-backup`.

1. [x] Add `upstream`, fetch both remotes.
2. [x] Create safety backup tag `pre-sync-backup`.
3. [x] Create working branch `sync-upstream`, reset to `upstream/master`.
4. [x] `git merge --squash -Xignore-all-space master` → 29 conflicted files (real overlaps).
5. [ ] Resolve the 29 conflicts (see checklist below).
6. [ ] Normalize line endings to LF (add `.gitattributes`, renormalize) so future diffs stay clean.
7. [ ] Verify: `npm run lint`, `npm test`, and a build. Fix breakage from upstream API changes.
8. [ ] Review the diff vs `upstream/master` — confirm only intended fork changes remain.
9. [ ] Commit the squash as a clear "Apply personal fork on top of upstream" commit (or a few logical commits).
10. [ ] Get Ryan's approval, then move `master` to `sync-upstream`.
11. [ ] Force-push `master` to `origin` (history rewritten). Confirm Vercel redeploys cleanly.

## Conflict checklist (29 files)

Generated (resolve by taking upstream, then regenerate from source grammar):
- [ ] `src/generated/plannerGrammar.ts`
- [ ] `src/pages/planner/plannerExerciseParser.terms.ts`
- [ ] `src/pages/planner/plannerExerciseParser.ts`

Config:
- [ ] `.gitignore`
- [ ] `package.json`
- [ ] `webpack.config.js`

Source — models/planner (the substantive logic):
- [ ] `src/models/progress.ts`
- [ ] `src/models/set.ts`
- [ ] `src/models/programToPlanner.ts`
- [ ] `src/pages/planner/models/plannerProgramExercise.ts`
- [ ] `src/pages/planner/plannerExercise.grammar`
- [ ] `src/types.ts`
- [ ] `src/ducks/thunks.ts`

Source — components/lib:
- [ ] `src/components/bottomSheetEditTarget.tsx`
- [ ] `src/components/editProgramExercise/editProgramExerciseAcrossAllWeeks.tsx`
- [ ] `src/components/editProgramExercise/editProgramExerciseSet.tsx`
- [ ] `src/components/historyRecordSets.tsx`
- [ ] `src/components/inputWeight2.tsx`
- [ ] `src/components/programShareOutput.tsx`
- [ ] `src/components/screenAccount.tsx`
- [ ] `src/components/screenSettings.tsx`
- [ ] `src/components/statsList.tsx`
- [ ] `src/components/weekInsights.tsx`
- [ ] `src/components/workout.tsx`
- [ ] `src/components/workoutExerciseCard.tsx`
- [ ] `src/components/workoutExerciseSet.tsx`
- [ ] `src/components/workoutShareOutput.tsx`
- [ ] `src/lib/audioInterface.ts`
- [ ] `src/utils/liveActivityManager.ts`

## ⚠️ CRITICAL FINDING (2026-07-10) — upstream did a web → React Native migration

While resolving conflicts it became clear the 464 upstream commits include a **major UI
architecture migration from web (Preact `<div>`/`<img>`) to React Native + uniwind
(`<View>`/`<Text>`/`className`, `react-native-web` for the web target).** Evidence:

- `workoutShareOutput.tsx` — upstream: `<View><Text>…`; fork: `<div><img>…"WorkoutThing"`.
- Components now import `../navigation/navigationService`, `HostConfig_resolveUrl`,
  `../utils/bundledImages`, `SvgXml` — none of which existed when the fork branched.

**Consequence:** the fork's *UI* edits were written against an architecture upstream has
replaced. They can't be merged mechanically — they must be **re-ported** into RN/uniwind, or
dropped. The fork's *logic* changes (data types, planner, progress math) are more portable
but still need real reconciliation because upstream also evolved the same types
(e.g. upstream added `setTimer`/`isOverflowSetTimer`/`auto` to a set; the fork added
`setType`/`myoActivation`/`myoMini`/`dropSet`). Both sets of fields must coexist.

This is a **port, not a merge.** Scope is much larger than a line-ending cleanup.

### Categorization of the 29 conflicts
- **Portable logic / data (reconcile fields):** `types.ts`, `set.ts`, `programToPlanner.ts`,
  `progress.ts`, `plannerProgramExercise.ts`, `plannerExercise.grammar`, generated planner files.
- **UI needing RN re-port (or drop):** all `src/components/*.tsx`, `liveActivityManager.ts`, `audioInterface.ts`.
- **Config (done):** `.gitignore`, `package.json`, `webpack.config.js`.

### DECISION (Ryan, 2026-07-10): **Option B — Durable-value port.**
Latest upstream + `research/`/program + `api/`/Vercel deploy backend + logic features worth
keeping (set types, myo-rep, bodyweight). Drop obsolete web-only UI tweaks.

### Resolution rules for the remaining conflicts
- Pure-display `.tsx` → **take upstream** (`git checkout --ours`), drop the fork's web tweak.
- Logic/data files → reconcile, but **prefer upstream if it already implements the feature** (avoid
  porting redundant/risky grammar+parser changes). Only add a fork field/behavior upstream lacks.
- Vercel backend (`api/`, `vercel.json` already additive) + its UI/service wiring
  (`screenAccount.tsx`, `src/api/service.ts`, `thunks.ts`) → the crux; must keep the PWA deploy working.
  Re-integrate into upstream's current auth/sync rather than pasting old web code. **Flag if a real decision arises.**
- Risk to watch: the fork is a **live Vercel PWA deploy**; the port must not break that.

## Key logic finding (2026-07-10) — the program needs no fork Liftoscript extensions

Read `research/liftoscript-program.md`. Ryan's Upper/Lower program uses only **standard**
Liftoscript that upstream already supports:
- `...myo` **reuse** of a named `myo` exercise (activation + mini-sets via a normal set scheme `1x12, 4x5`),
- `progress: dp(...)` double progression and `progress: custom(...)`,
- supersets (`superset: a`), `warmup: none`, `0lb` = bodyweight for Pull Up.

Verified upstream implements `dp`/`custom`/reuse (`types.ts:144`, `programToPlanner.ts:662`,
`plannerProgramExercise.ts`). **The program does NOT use the fork's `setType`/`myoActivation`/
`dropSet`/`SetTypeMarker` grammar.** Therefore:

> **Deviation from the literal "keep set types" in Option B:** dropping the fork's custom
> set-type grammar/parser/planner changes and taking upstream for all logic files. Rationale:
> (1) the program doesn't use them, (2) porting the fork grammar onto upstream's evolved grammar
> (which added `SetTimer`/`Auto`/`AskWeight` tokens) is high-risk and spans ~9 files, (3) upstream
> covers everything the program needs. **Flag for Ryan to confirm.** The fork's set-type unit
> tests (`test/set.test.ts`, parts of `test/progress*.test.ts`) will be removed since the feature is dropped.

## ⚠️ AUTH/BACKEND DECISION NEEDED — the last 2 conflicts

Only `screenAccount.tsx` and `thunks.ts` remain, both about auth/sync. Facts:
- The fork's Vercel backend (`api/`) implements **only password auth** (`api/signin/password.ts`).
  No `api/signin/google.ts` / `apple.ts` exist.
- `src/api/service.ts` (auto-merged) still calls `/api/signin/{google,apple,password}` at `__API_HOST__`
  (same-origin in PWA mode). Google/Apple would **404** on the self-hosted Vercel deploy.
- So auth method and backend are coupled. Two durable-value paths:

**Path 1 — Keep self-hosted password auth (matches the fork's original intent).**
Re-port a password sign-in screen into upstream's RN `screenAccount.tsx`; take upstream for
`thunks.ts` (drop the local-premium bypass, already dropped in UI). Keep `api/` + Vercel.
Cost: real RN UI work for the sign-in screen. Preserves self-hosting + no Liftosaur-cloud dependency.

**Path 2 — Use upstream as-is against the real Liftosaur cloud.**
Take upstream for `screenAccount.tsx` + `thunks.ts`. Point `__API_HOST__` at `api3.liftosaur.com`.
Remove the now-vestigial `api/` backend + `vercel.json` PWA bits. Simplest; but depends on
Liftosaur's cloud/premium and abandons the self-hosted sync the fork was built for.

→ **Awaiting Ryan's choice.** Everything else is resolved and staged.

## Current in-progress state

- Branch `sync-upstream` has an **in-progress squash-merge** (`git merge --squash` not yet committed).
- Resolved & staged (27 of 29): all config, all pure-UI (took upstream), all logic/planner/grammar (took upstream).
- **2 conflicts remain:** `src/components/screenAccount.tsx`, `src/ducks/thunks.ts` (pending the auth decision above).
- `master` is untouched; `pre-sync-backup` intact.
- To abandon cleanly: `git merge --abort` on `sync-upstream`.

## Follow-ups after conflicts resolved
- Review `src/api/service.ts` auto-merge for coherence (it interleaved fork + upstream auth).
- Remove fork tests for dropped set-type feature (`test/set.test.ts`, parts of `test/progress*.test.ts`).
- Decide fate of now-unused fork utils (`src/utils/personalFork.ts`, `src/models/bodyweight.ts`) — dead code after UI drop.
- Line-ending normalization (task #4), then lint/test/build (task #5).

## RESOLUTION COMPLETE (2026-07-10) — all 29 conflicts resolved, committed

Commit `0ea76f47` on branch `sync-upstream`. Net footprint vs `upstream/master`: ~55 files
(mostly additive: research/, api/, specs, vercel/PWA; small edits for password auth + branding).

**Auth decision (Ryan): Path 1 — self-hosted password auth.** Re-ported `Thunk_passwordSignIn`
into upstream `thunks.ts` and an "Enable Sync" password button into upstream's RN `screenAccount.tsx`
(via `Dialog_prompt`); kept `service.passwordSignIn` + `api/` backend + webpack same-origin host exprs.

**Key cleanups discovered during resolution:**
- The `-Xignore-all-space` auto-merge silently applied fork edits to ~15 files beyond the 29
  conflicts — including deleting upstream's `Exercise_isUnilateral`. Restored upstream for all
  auto-merge artifacts (exercise.ts, history.ts, planner styles, watch, svgs, ios settings, E2E specs).
- Fork's set-type feature fully removed (types/set/planner + 10 consumer files + 3 unit tests + planner.test additions).
- Kept: bodyweight util, personalFork premium unlock, WorkoutThing branding (index.html, SW, titles), manifest.
- LF normalization via `.gitattributes` (with `.bat`=CRLF exception; restored `gradlew.bat`).

**Remaining before finalize (task #5):** `npm install` (upstream dep changes) → typecheck → `npm test`.
Then move `master` to `sync-upstream` (with Ryan's OK) and force-push `origin` + confirm Vercel deploy.

### Known follow-ups / risks to verify
- PWA service worker (`webpushr-sw.ts`) caches `app.js`/`app.css`; confirm the PWA build emits those names.
- personalFork premium-unlock is now inconsistent (present in locker/programPreview/importexporter/program,
  dropped from statsList/weekInsights which took upstream). Cosmetic; re-add later if wanted.
- `tests/bodyweight.spec.ts` (E2E) targets the app via testIDs but was written for web-era UI; verify against RN.
- The program (`research/liftoscript-program.md`) hasn't been run through upstream's parser yet — verify in-app.

## Progress log

- **2026-07-10** — Added `upstream` remote, fetched (464 commits behind). Confirmed `origin` in sync.
  Diagnosed CRLF churn. Created backup tag `pre-sync-backup`. Wrote this plan.
- **2026-07-10** — Rebase attempt failed (19-commit replay, first commit conflicts). Switched to
  single squash-merge with `-Xignore-all-space` → 29 conflicts. Resolved config files.
  **Discovered upstream's web→RN migration** → escalated to Ryan for direction on scope (options A–D).

## Open questions / decisions

- **Rebase vs merge:** chose **rebase** (linear history, cleanly "my changes on top of latest"). Trade-off: rewrites the 19 commits → requires force-push to `origin`.
- **Line endings:** normalize to **LF** and add `.gitattributes` to stop the churn recurring.
- Whether any of the fork's *fixes* (myo-rep superset, bodyweight load, planner double-progression) are now redundant because upstream fixed them independently — check during conflict resolution.
