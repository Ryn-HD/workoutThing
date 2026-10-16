# VelociReps Apple Health Shortcut

Install from the PWA's `/apple-health-setup.html` page on an iPhone. That page also has a six-step recipe for building the Shortcut by hand in the Shortcuts app, which is the fallback when the file import fails.

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

## Protocol, version 2

The Finish tap in the web app opens `shortcuts://run-shortcut?name=VelociReps%20Log%20Workout&input=text&text=<json>` synchronously, inside the tap, because iOS opens another app's URL scheme only from a user gesture. The JSON has four fields: `version` (2), `startDate` (ISO 8601, whole seconds, UTC), `durationSeconds` (integer active time, pauses excluded) and `energyKcal` (six kcal per whole active minute). The Shortcut reads the three workout fields from Shortcut Input, calls Log Workout as Traditional Strength Training with duration in `s` and calories in `kcal`, then shows an alert.

There is no x-callback-url return, no file ledger and no result page. An x-success return opens Safari, not the Home Screen app, and Safari does not share the app's storage, so the callback could never update the app. The web app records `sent` in localStorage when it opens Shortcuts, shows that on the finish screen and in Share, and warns before a second send of the same workout.

The launch URL percent-encodes spaces as `%20`. Shortcuts treats the `+` emitted by form-style `URLSearchParams` serialization literally, causing "could not find VelociReps+Log+Workout" and altering spaces inside the JSON payload. The test decodes query values with `decodeURIComponent` so that `URLSearchParams` cannot mask this.

The version 1 Shortcut (109 actions with an iCloud Drive retry ledger) still accepts the version 2 payload's fields but rejects `version` 2 and the missing `activity`, so replace it with this file.

## Verification

Parameter keys (`WFWorkoutReadableActivityType`, `WFWorkoutDate`, `WFWorkoutDuration`, `WFWorkoutCaloriesQuantity`) and the `s` and `kcal` unit strings were read from the ActionKit framework in the macOS 26 dyld shared cache and from `WFHealthKitConstants.plist`. The macOS editor reports that Log Workout is unsupported on Mac, so the Health write itself is only testable on an iPhone.

Mocha tests cover time validation, DST/midnight, the Finish-tap payload after a first set, a paused session and a full session, URL encoding, the launch decision and the sent state. The render test covers the manual Send action: save before enabling, tap-only launch, double taps and the sent state. Not verified on a physical iPhone: the Health permission prompt, the logged date/duration/kcal, and the Safari "Open in Shortcuts?" prompt from the Home Screen app.
