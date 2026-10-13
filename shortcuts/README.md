# VelociReps Apple Health Shortcut

Install from the PWA's `/apple-health-setup.html` page on your iPhone. Saved workouts always offer sending in their Share menu, even if this browser's setup preference is absent. Optionally select **Me → Apple Health → Make Send the main finish action** for **Done & Send to Apple Health** as the finish screen's primary action. That switch is a browser preference, not a check that the Shortcut is installed.

`VelociReps Log Workout.shortcut` is the signed installation artifact. Keep its name exactly **VelociReps Log Workout**. No Apple developer membership or native app is required.

## Rebuild

Run on macOS with Apple's Shortcuts app installed:

```sh
python3 scripts/build-apple-health-shortcut.py
shortcuts sign --mode anyone \
  --input shortcuts/VelociReps-Log-Workout.unsigned.shortcut \
  --output 'shortcuts/VelociReps Log Workout.shortcut'
```

Commit the generator and both generated artifacts together. Vercel copies the already signed file; its Linux builder does not run signing. The Python generator is the editable source, and the unsigned XML plist makes the action configuration inspectable.

## Protocol and retries

Version 1 receives JSON text through `shortcuts://x-callback-url/run-shortcut`. Fields are `version`, opaque `exportId`, per-attempt `requestId`, `activity`, ISO `startDate`, integer `durationSeconds`, and integer estimated `energyKcal`. The app completes its IndexedDB save before enabling the launch button. Exercise/set completion is not required. It exports active time, excluding pauses, and the existing six-kcal-per-whole-minute estimate. Saved intervals are clipped to session bounds, closed at the saved end if necessary, and merged to avoid double counting. If no usable intervals exist, the saved start/end supply duration. Very short workouts round up to one second. No export uses today's clock to replace missing saved timestamps. Shortcuts may calculate an earlier end time than the actual end of a paused session.

The October 13 PWA fix closes new workout intervals at exactly the saved end time, repairs the earlier finish-time discrepancy during export, and keeps manual sending available independently of the browser's preference. It uses the unchanged version 1 Shortcut; existing installations do not need replacing.

The Shortcut hashes `exportId` into a safe filename and keeps per-workout JSON markers in its default Shortcuts folder in iCloud Drive. It writes `pending` before Log Workout and `saved` afterwards. A saved marker returns `alreadySaved`. A pending or interrupted attempt requires the user to check Health and choose whether to retry. Health and file writes are not atomic, and clearing these files removes duplicate protection. Edits do not update an existing Health entry.

Success output is JSON with `exportId`, `requestId`, and `status: saved|alreadySaved`. The result page accepts only a matching pending request and never treats opening Shortcuts as success. A Safari callback may not share the Home Screen app's storage; in that case, the Shortcut's success message and ledger remain the confirmation. No workout metrics, notes, exercise details, account identifiers, or credentials go into the HTTPS callback.

## Verification

The signed file opens in Apple's macOS import preview. Its conditions, numeric conversions, file paths, menu branches, and outputs were inspected there. Workout parameter names and serialized quantity/file formats were checked against the installed Apple ActionKit definitions. The macOS editor explicitly reports that Log Workout is unsupported on Mac.

Automated tests cover time validation, DST/midnight, URL encoding, opaque IDs, callback matching, durable saving and races, save failure/retry, tap-only launching, and double taps. A physical iPhone test is still required to verify Health permissions, the resulting workout's date/duration/kcal, repeated sends, and Safari versus Home Screen return. Offline logging has not been verified because the retry ledger uses iCloud Drive.
