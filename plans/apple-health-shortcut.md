# Apple Health handoff from the Vercel PWA

Status: version 2, October 16. The Finish tap itself opens the Shortcut, so a workout reaches Health with one tap at any point in the session. The Shortcut is eleven actions with no retry ledger, no x-callback-url and no result page; the app records `sent` in localStorage and warns before a second send. Sending on Finish is on by default on an iPhone web app and can be turned off under Me → Apple Health. Physical iPhone Health-write verification remains outstanding. See `shortcuts/README.md` for the protocol, rebuild steps and verification limits. The sections below describe the superseded version 1 design and are kept for the findings.

October 13 review: partial workouts now finish without an incomplete-set confirmation. Manual sending is available regardless of the browser-local preference. New intervals close at the saved finish timestamp, and export normalizes old timer metadata within saved session bounds, falling back to the saved elapsed duration when necessary. The installed version 1 Shortcut remains compatible. This supersedes the original strict interval rejection and setup-gating proposals below.

## Intended experience

Keep using the fork at `https://velocireps.vercel.app/app/`. Install one iPhone Shortcut, grant it permission to write workouts to Health, and enable the integration in the app.

After setup:

1. Track the workout normally and tap **Finish**.
2. The app saves the workout and shows the existing **Congratulations!** summary.
3. The summary's primary **Continue** action becomes **Done & Send to Apple Health**. Tapping it runs the installed Shortcut with that saved workout's data.
4. The Shortcut logs a strength training workout and reports its result. Attempt to return to the app; if iOS opens Safari instead of the installed PWA, show a lightweight result page and instructions to return to the Home Screen app.

Provide **Done without sending** as a secondary action. When the integration is disabled, keep the existing Continue behavior. Also provide a manual **Send to Apple Health** action on saved workouts for missed or failed sends.

This is a user-triggered handoff to Shortcuts, not a silent background HealthKit write. The final summary tap is the normal send trigger, so there is no separate social share workflow to complete. iOS may display launch or permission prompts. No developer membership, native installation, or weekly signing is required for this approach.

## Findings in this repository

- `src/components/workoutFinishButton.tsx` calls `WorkoutFinish_run`; Finish handles current workouts and Save handles edits to past workouts.
- `src/utils/workoutFinish.ts` invokes `Thunk_finishProgramDay` and contains the existing native Health integration.
- `src/ducks/thunks.ts` navigates to `finishDay` before committing `FinishProgramDayAction`. The summary can render before the new history record exists.
- `src/components/screenFinishDay.tsx` contains the summary and Continue button. It currently falls back to the newest record when its requested record is unavailable. Health export must require the exact requested record to prevent sending an older workout during this transition.
- `History_finishProgramDay` produces the saved history ID and closes workout intervals. Build export data from this committed record, not the live progress object.
- `History_workoutTime` excludes paused intervals. `History_calories` estimates energy at six kcal per whole minute of active workout time.
- `src/utils/persistence.ts` schedules IndexedDB writes. Its `flushSave()` catches write failures, so simply awaiting that method does not prove the workout was saved successfully.
- `src/navigation/modals/NavModalWorkoutShare.tsx` is the existing place for manual workout share actions.
- `vercel.json` already deploys the PWA. No new backend or hosting service is needed.

## Implementation sequence

### 1. Prove the iPhone handoff before wiring the full UI

Create a minimal Shortcut named **VelociReps Log Workout** and a small test launch link. Verify on the user's physical iPhone that it can:

- Receive URL-encoded JSON from Safari and from the installed Home Screen PWA.
- Parse the JSON and map the strength training activity, start date, duration, and kcal correctly into **Log Workout**.
- Write a sample workout with Health permissions granted and fail clearly with permissions denied.
- Return success, cancellation, and error through x-callback-url where supported.
- Run again after initial permission setup without asking the user to enter workout values.

Check whether the return opens the installed PWA or Safari and whether their storage is shared. Do not make callback delivery into the PWA a prerequisite for logging. Test locally without writing a real workout first; perform a clearly identified Health test entry only when the user is ready to verify it on their phone.

### 2. Define a small, versioned export payload

Add a proposed `src/utils/appleHealthShortcut.ts` helper for eligibility, payload validation, and launch URL construction. Send only:

- `version`: protocol version 1.
- `exportId`: stable opaque ID derived from account/workout identity; unchanged by retrying or editing the workout.
- `requestId`: unique ID for this handoff attempt.
- `activity`: strength training, mapped to the supported Shortcuts activity label during the prototype.
- `startDate`: original workout start as an ISO timestamp.
- `durationSeconds`: active duration from the saved, closed intervals.
- `energyKcal`: the existing app estimate, clearly described as estimated in setup.

Use seconds and kcal regardless of display preferences. Do not export reps, weights, notes, program names, account credentials, or full history. Reject missing/invalid timestamps, open intervals, negative/nonfinite values, and zero-duration workouts rather than inventing times using `Date.now()`.

Validate the actual Log Workout action's supported fields in phase 1. Version 1 aims to match the app's active duration; if the action derives end time from start plus duration, it cannot reproduce the full paused timeline. Document that limitation and verify the resulting Health entry for a paused workout. Do not split a single session into multiple Health workouts to simulate pauses.

### 3. Make the saved workout safe to hand off

Prepare the payload only after the exact summary record is committed. Persist the completed workout through a save operation that reports IndexedDB transaction success; do not treat the current error-swallowing flush as an acknowledgment. Reuse existing persistence machinery with a narrowly scoped acknowledgment path and account for writes already in flight.

Prepare and persist before the user taps the send action. Disable the action with **Saving workout…** until durable save succeeds. This lets the click handler launch the `shortcuts://` URL directly from the user's tap instead of awaiting work and risking loss of browser user activation.

If local persistence fails, keep the summary visible with a save error and retry action. Health launch must never discard the workout or hide a save failure. Cloud sync need not finish before handoff; local durability is sufficient.

### 4. Add setup and finish-screen controls

Add an iPhone web-only Apple Health via Shortcuts setup entry, separate from the native Health toggles. Reuse platform detection and include iPad detection only if the device prototype validates it. Do not show an actionable Shortcuts send control on Android or desktop.

Setup should explain the one-time installation and Health permissions, provide the actual tested Shortcut artifact or iCloud install link, and offer **Use on the finish screen**. Start disabled until the user completes setup. Verify the repository's settings schema before adding a preference; keep any device-specific setup state local to the device.

Add a reusable proposed `AppleHealthShortcutAction` component to the summary and saved-workout share sheet. Preserve incomplete-set confirmation and existing program progression. Saving edits to a past workout must not automatically log another Health workout; manual export is available with the duplicate rules below.

Do not launch from a component mount effect, a timer, tab focus, or app reload. Those can fire twice and may be blocked without a fresh tap.

### 5. Handle results, retries, and duplicates honestly

The Shortcut should keep a persistent ledger of successfully exported IDs using a supported file location proven during setup. Check it before Log Workout and write it after a successful Health write. Return structured output containing the export ID, request ID, and `saved` or `alreadySaved`; validate that output before showing success.

The PWA stores per-workout handoff state separately from the workout: pending, confirmed, cancelled, failed, or unknown. Launching Shortcuts means pending, not synced. If a callback is lost, retain unknown and offer retry or a way to check Health. Show **Saved to Apple Health** only for a matched success response or explicit user verification. Keep callback data out of analytics and strip it from the URL after processing.

Prevent double taps in the UI. The Shortcut ledger is the principal retry guard because callback and browser storage may be unavailable. A Health write and file-ledger write are not atomic: if the first succeeds and the second fails, the result is uncertain. Test this case and avoid promising perfect duplicate prevention; use a verified Health lookup if the available Shortcuts actions can support it, otherwise require checking Health before an uncertain retry.

Treat edits to an already exported workout as already sent. Version 1 does not update or delete existing Health entries. Explain that corrections must be made in Health; never silently add a replacement duplicate. Clearing the ledger removes its retry protection.

Callback URLs must stay on the configured app origin and correlate with the pending request. A callback arriving in another browser context must not require signing into the app or loading workout history just to explain the result. Provide a small static result page if necessary; do not put the workout payload in its URL.

### 6. Verify and deliver

Use focused automated tests for payload/time/unit validation, URL encoding, save-before-launch behavior, exact-record selection, callback matching, and duplicate/retry states. Confirm existing finish/progression behavior remains correct. Run the TypeScript check and PWA build once integration is complete.

Physical iPhone acceptance checks:

- Finish a workout, tap Done & Send, and verify exactly one strength workout in Health with expected date, duration, and kcal.
- Reload the PWA after handoff and confirm the workout remains in history.
- Repeat from the saved-workout share menu; verify the retry guard prevents an ordinary duplicate.
- Verify incomplete-set cancellation, denied permissions, missing/renamed Shortcut, double tap, missed callback, and past-workout edits.
- Verify a paused workout, a short workout, midnight/time-zone boundaries, and kg/lb display preferences.
- Verify cold PWA startup, Safari versus Home Screen return, and offline behavior. If the ledger uses iCloud Drive, test access when offline before claiming offline export support.

Deliver the app changes, tested Shortcut install artifact/link, brief setup instructions, and actual verification results. Complete local validation before deploying through the existing Vercel workflow. Physical iPhone verification is required before describing this as reliably working end to end.

## Apple documentation

- [Run a shortcut from a browser URL and pass text input](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios).
- [Log Workout and other share actions](https://support.apple.com/guide/shortcuts/share-actions-apdaf74d75a5/ios).
- [Success, cancellation, error, and output callbacks](https://support.apple.com/guide/shortcuts/use-x-callback-url-apdcd7f20a6f/ios).
