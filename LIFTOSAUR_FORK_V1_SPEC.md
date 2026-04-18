# Personal Lifting App — V1 Spec

> Fork of [Liftosaur](https://github.com/astashov/liftosaur) (AGPL-3.0).
> Single-user personal build. Strip all Liftosaur branding. Remove all subscription/paywall gates — every local feature is free.

---

## 1. Guiding Principles

1. **Progression-first tracking.** The app exists to answer: "Am I improving?" Everything — graphs, history, set types — serves that question.
2. **Double progression as the default model.** Weight increases are triggered by hitting a rep ceiling on the working set (not by volume aggregates or periodization math).
3. **Minimal friction during a workout.** Tap checkmark → advance. No unnecessary inputs (no "0 lb" on bodyweight exercises, no L/R split when both sides match).
4. **Store everything, display selectively.** All set data is persisted (myo minis, drop sets, skipped sets). The UI and graphs filter what's shown based on context.
5. **Local-first, export-everything.** No backend. Full data export (JSON + CSV) for device migration.

---

## 2. Set Type System

### 2.1 Enum: `SetType`

Every recorded set has exactly one type:

| Type             | `setType` value    | `maxEffort` | Counts for PR/e1RM | Counts for volume |
|------------------|--------------------|-------------|---------------------|-------------------|
| Normal           | `normal`           | `true`      | Yes                 | Yes               |
| AMRAP            | `amrap`            | `true`      | Yes                 | Yes               |
| Myo Activation   | `myoActivation`    | `true`      | Yes                 | Yes               |
| Myo Mini         | `myoMini`          | `false`     | No                  | Yes               |
| Drop Set         | `dropSet`          | `false`     | No                  | Yes               |

**Key rules:**

- `maxEffort` determines whether the set feeds into PR detection and estimated 1RM calculations. Only sets where the lifter intended to express or test strength count.
- All set types contribute to volume (sets × reps × weight). Volume is real work regardless of intent.
- A single set cannot carry two types simultaneously. AMRAP and myo activation are distinct — activation means "this set begins a myo cluster," AMRAP means "go to failure, standalone."
- Drop set volume = each drop's reps × that drop's weight, summed. No auto-decrement in v1; the lifter enters weight per drop manually.

### 2.2 Exercise Templates

When adding an exercise to a program, the user selects a template that pre-populates the set structure. Templates are convenience — the underlying data model is always individual sets with types.

| Template           | Generated sets                                         | Default reps        |
|--------------------|--------------------------------------------------------|---------------------|
| Straight sets      | 3 × `normal`                                           | 3 × 8              |
| AMRAP finisher     | 2 × `normal` + 1 × `amrap`                            | 8 / 8 / max        |
| Myo rep cluster    | 1 × `myoActivation` + 3 × `myoMini`                   | 12+ / 5 / 5 / 5    |
| Drop set           | 1 × `normal` + 2 × `dropSet`                          | 8 / 8 / 8          |
| Superset pair      | (see Section 3)                                        | per exercise        |
| Superset + myo     | (see Section 3)                                        | per exercise        |

- Default template is **straight sets, 3 sets**.
- The user can add or remove sets dynamically after selecting a template (this already exists in Liftosaur).
- Set count is per-exercise, not fixed by template.

---

## 3. Superset Sequencing

### 3.1 Normal Superset (Two Exercises, A + B)

Exercises are paired as a superset group. The app enforces this execution sequence:

```
A1 → B1 → REST → A2 → B2 → REST → A3 → B3 → REST → next exercise
```

**Timer rules:**

| Transition     | Timer?                          |
|----------------|---------------------------------|
| A → B          | No timer. Immediate transition. |
| B → A (next round) | Superset rest timer starts. |
| Final B → next exercise | Normal rest timer.     |

**UI behavior:** Tapping the checkmark on an A set immediately advances to the corresponding B set. Tapping the checkmark on a B set starts the rest timer before the next A set.

### 3.2 Superset with Myo Reps (A = Normal, B = Myo Cluster)

When one exercise in a superset pair uses a myo template, the sequence changes. Only the first A set and B's activation set are paired. After that, A completes as standalone sets, then B's minis run back-to-back.

Example: A = 3 normal sets, B = 1 activation + 3 minis:

```
A1 → B-activation → REST → A2 → REST → A3 → B-mini1 → B-mini2 → B-mini3 → REST → next exercise
```

**Timer rules for this sequence:**

| Transition                  | Timer?                     |
|-----------------------------|----------------------------|
| A1 → B-activation          | No timer (superset pair).  |
| B-activation → A2          | Rest timer.                |
| A2 → A3                    | Rest timer.                |
| A3 → B-mini1               | No timer.                  |
| B-mini1 → B-mini2          | No timer.                  |
| B-mini2 → B-mini3          | No timer.                  |
| B-mini3 → next exercise    | Rest timer.                |

The superset pairing only governs A1 ↔ B-activation. After that, the sequence is determined by set type: normal sets get rest, minis don't.

### 3.3 Unequal Set Counts (No Myo Involved)

If A has fewer sets than B (or vice versa), the pairing runs until the shorter exercise is exhausted. Remaining sets become standalone with normal rest.

Example: A = 2 sets, B = 4 sets:

```
A1 → B1 → REST → A2 → B2 → REST → B3 → REST → B4 → REST → next exercise
```

### 3.4 Standalone Myo Reps (No Superset)

When a myo cluster is not part of a superset, all sets group under one exercise:

```
Activation → Mini1 → Mini2 → Mini3 → REST → next exercise
```

No rest between activation and minis. No rest between minis. Timer only fires after the last mini.

### 3.5 Superset Scope

V1 supports two-exercise supersets only. Three-way giant sets are out of scope.

---

## 4. Workout State Machine

### 4.1 Sequence Cursor

The workout maintains a **sequence cursor** — a pointer to the current active set. The cursor is calculated, not stored as a static index.

**Cursor rule: advance to the earliest incomplete set in the planned sequence.**

This single rule handles all edge cases:

- **Normal advance:** Tap checkmark → set marked complete → cursor moves to next set in sequence.
- **Superset transition:** After completing A1, cursor finds B1 as the next incomplete set in the A/B interleaved sequence.
- **Skip/cancel:** If the user removes sets 2 and 3 of exercise A (or just never enters reps), those sets are gone. The cursor advances past them naturally because they no longer exist in the sequence.
- **Uncheck a completed set:** Cursor recalculates to the earliest incomplete set, which is now the unchecked set.

### 4.2 Set Completion

A set is complete when the user taps the checkmark. At minimum, reps must be entered (even 0 is valid if the user failed). Weight follows the exercise's equipment type rules (see Section 6).

### 4.3 Set Removal During Workout

The user can remove sets during a workout (this exists in Liftosaur). Removed sets are deleted from the session — they don't appear in history. This is the mechanism for "I'm not feeling it today, dropping from 3 sets to 1."

There is no dedicated "skip" button. Either complete the set (with whatever reps you got) or remove it.

---

## 5. Unilateral / Bilateral Logging

### 5.1 Default Behavior

All exercises log a **single rep count**. No L/R split. When the user enters "8" on a curl, it means 8 reps per side.

The non-dominant side (left) dictates reps. If left fails at 8, right stops at 8 too. This is implicit — the app doesn't need to know which side is dominant. It just records one number.

### 5.2 Override

A per-exercise toggle in the program editor: **"Track sides separately."** Default is off. When enabled, the set row shows two rep inputs (L / R). This is for rare cases like rehab, asymmetry tracking, or single-arm testing.

### 5.3 Historical Data Migration

Existing history with L/R entries gets averaged into a single value. Since historical L/R entries were typically identical (8/8), the average equals either side. No data loss for practical purposes.

### 5.4 Volume Calculation

For unilateral exercises, the entered reps represent per-side reps. Volume = reps × weight × 1 (not doubled). The app does not multiply by 2 for bilateral display. If the user did 8 curls at 30 lb, volume = 8 × 30 = 240, representing the work done per side.

---

## 6. Bodyweight Exercise Handling

### 6.1 Equipment Type: Bodyweight

When creating or editing an exercise, if equipment is set to **Bodyweight**, the weight input behaves differently:

- **Default state:** Weight field is empty/blank. No placeholder "0 lb." No requirement to enter a value.
- **Placeholder text:** `"+ added load"` to indicate that any entered value means weight added *on top of* bodyweight.
- **If blank:** The set is recorded as bodyweight (no external load). Volume calculations that need a weight value pull bodyweight from Apple Health (if available) or treat load as bodyweight without a specific number.
- **If a value is entered (e.g., 5):** This means bodyweight + 5 lb. The stored value is the added load only (5), with a flag indicating equipment = bodyweight.

### 6.2 Graph Behavior for Bodyweight Exercises

- **Weight graph:** Shows added load over time. An unweighted pull-up shows as 0 (or baseline). Adding a 5 lb plate shows as +5. Bodyweight fluctuations from bulking/cutting do NOT move this graph.
- **Reps graph:** Primary progression view for bodyweight exercises. Week-over-week rep count is the main signal.
- **Total load view (optional, secondary):** If Apple Health bodyweight is available, a toggle can show total estimated load (bodyweight + added). This is a nice-to-have, not the default view.

### 6.3 Historical Migration

Existing exercises stored with `0 lb` where equipment type is bodyweight should display as blank (no weight shown). The underlying data can remain 0; the UI interprets `0 + bodyweight equipment = no added load`.

---

## 7. Progression & Tracking Logic

### 7.1 Double Progression (Default Model)

The user works within a rep range (e.g., 8–12). When the top of the range is hit on the working set, weight increases next session. The app does not auto-increment — it tracks and surfaces the signal. Whether to auto-suggest or just highlight is a UX decision for implementation.

For myo reps specifically: the activation set is the progression lever. If activation reps > 12, the app signals "increase weight."

### 7.2 PR Detection

A PR (personal record) is the heaviest weight lifted for a given rep count on a given exercise, using only `maxEffort` sets (`normal`, `amrap`, `myoActivation`).

Myo minis, drop sets, and any future `maxEffort: false` types are excluded from PR calculations.

### 7.3 Estimated 1RM

Calculated using `maxEffort` sets only. Standard formula (Epley, Brzycki, or user preference — implementation detail). Updated per session when a new max-effort set is recorded.

### 7.4 Volume Tracking

Total volume = sum of (reps × weight) across all completed sets of all types. This includes myo minis and drop sets. Volume is a measure of total work, not just hard sets.

For exercises where weight = bodyweight (blank), volume requires Apple Health bodyweight to calculate. If unavailable, volume for those exercises is tracked as reps only (no weight component).

---

## 8. Graphs & History

### 8.1 Priority Graphs (V1)

These are the graphs that answer "am I improving?" for a double-progression trainee:

1. **Per-exercise weight over time.** Y-axis = weight (or added load for bodyweight exercises). X-axis = date. Each data point is the working weight for that session. For myo exercises, this is the activation set weight.

2. **Per-exercise reps over time.** Y-axis = reps. X-axis = date. Shows the rep count of the primary working set (first `normal` or `myoActivation` set). This is the graph that reveals double-progression cycles: reps climb session over session, then drop when weight increases.

3. **Last session vs. previous session.** Shown during the active workout. For the current exercise, display what you did last time (weight × reps) alongside what you're doing now. This is the most actionable real-time comparison.

### 8.2 Secondary Graphs (Post-V1)

- Per-exercise volume over time (all sets)
- Muscle group volume per week
- PR timeline
- Workout duration trends
- Frequency / calendar heatmap
- Bodyweight overlay (from Apple Health)

### 8.3 History Display

**Normal exercises:** Each set on its own row — `Set 1: 135 lb × 8, Set 2: 135 lb × 8, Set 3: 135 lb × 8`.

**Myo rep clusters:** Collapsed into a single visual group — `Hammer Curl (Myo) — 30 lb × 12 + 5/5/5`. Tapping expands to individual set rows if needed. The activation set is visually primary; minis are subordinate.

**Drop sets:** Shown as sequential sets with decreasing weight — `Set 1: 100 lb × 8, Drop 1: 80 lb × 8, Drop 2: 60 lb × 8`.

**Bodyweight exercises:** Weight column shows blank or "BW" for unweighted sets, "+5 lb" for added load.

**Supersets:** History groups paired exercises together with a superset indicator, but each exercise's sets are listed under their own exercise header.

### 8.4 Workout Finish Screen

- Total exercises completed
- Total sets completed (all types, including myo minis and drops — one number, not categorized)
- Total volume (if calculable)
- Workout duration
- Any new PRs highlighted

---

## 9. Program Editor (UI-First)

### 9.1 Exercise Creation Flow

1. **Search/select exercise** (from exercise library or create custom).
2. **Choose equipment type:** Barbell, Dumbbell, Cable, Machine, Bodyweight, Other.
3. **Choose set template:** Straight Sets (default) / AMRAP Finisher / Myo Rep Cluster / Drop Set.
4. **Configure sets:** Template pre-populates set count and types. User can add/remove sets. Each set shows its type and target reps.
5. **Superset pairing:** Option to pair this exercise with another exercise in the program. Selecting a pair partner creates the superset group and auto-generates the interleaved sequence.
6. **Unilateral override:** Toggle for "Track sides separately" (default off).

### 9.2 Mid-Workout Editing

- **Long-press on a set row:** Opens a context menu with options to change set type, adjust target reps, or remove the set. This is the escape hatch for on-the-fly changes.
- **Long-press on weight/rep input:** Could surface a dial or picker for quick adjustment (design TBD — this is a Stitch exploration candidate).
- **Add set:** Button to append a set to the current exercise (already exists in Liftosaur).
- **Remove set:** Swipe or context menu to delete a set from the current session.

### 9.3 Program Structure

A program is an ordered list of workout days. Each workout day contains an ordered list of exercises (or superset groups). Each exercise contains an ordered list of sets with types and targets.

The underlying program definition format (Liftoscript or equivalent) must support:
- Set type annotations per set
- Superset group declarations
- Equipment type per exercise
- Rest timer overrides per exercise or superset group

Whether the program is stored as Liftoscript text or a structured JSON/object model is an implementation decision. The UI-first editor abstracts this — the user never needs to see or edit raw syntax.

---

## 10. Timer System

### 10.1 Timer Defaults

| Context                                    | Default rest (seconds) |
|--------------------------------------------|------------------------|
| Between normal sets (same exercise)        | 90                     |
| Between superset rounds (after B → before next A) | 90              |
| After final set → next exercise            | 120                    |
| Between myo mini sets                      | 0 (no timer)           |
| Between drop sets                          | 0 (no timer)           |
| A → B within superset                     | 0 (no timer)           |

### 10.2 Timer Behavior

- Timer starts automatically when triggered by a transition that requires rest.
- Timer is dismissable (tap to skip rest early).
- Timer values are configurable globally and per-exercise/per-superset-group.
- No timer, no alert, no transition cue for back-to-back transitions (myo minis, drop sets, superset A→B). The checkmark tap immediately advances to the next set.

---

## 11. Apple Ecosystem Integration (Phase 2)

> This section is deferred — it requires a Mac, Xcode, and Apple Developer account. Document requirements here so they're ready when the toolchain is.

### 11.1 Apple Health (HealthKit)

**Two-way sync:**

- **App → Health:** Completed strength workout (duration, calories if estimable, heart rate if Watch is active).
- **Health → App:** Bodyweight (for bodyweight exercise volume calculations and total-load graph). Body composition data (fat %, waist) is read-only context, not used in core calculations.

### 11.2 Apple Watch

- Companion mode only (requires phone nearby).
- Displays current exercise name, set number, target reps, and weight.
- Checkmark button to complete the current set from the wrist.
- Timer display for rest periods.
- Heart rate capture during workout.

### 11.3 Development Path

Options for native build (in order of recommendation):

1. **Mac Mini (M1 used, ~$400–500)** + Xcode + Apple Developer Account ($99/year). Build natively with Swift/SwiftUI or Capacitor wrapper around the existing web app.
2. **Cloud Mac rental** (MacStadium, AWS EC2 Mac) for build/deploy only. Develop on Windows, build remotely.
3. **PWA-first** — ship the web app to the home screen. No HealthKit, no Watch, but all other features work. Add native later.

Recommendation: Start with option 3 (PWA). All workout logic, graphs, program editor, and data model work without Apple-native code. Add HealthKit/Watch as a dedicated phase once the Mac toolchain is set up.

---

## 12. Data Export

### 12.1 Full Export

One-tap export of everything:

- All workout history (every set, every session, every exercise)
- All programs and their configurations
- All exercise definitions (including custom exercises)
- All settings and preferences

Format: JSON (primary, machine-readable for re-import) + CSV (secondary, for spreadsheet analysis).

### 12.2 Import

- Import from the app's own JSON export (device migration).
- Import from Liftosaur export format (migration from the original app).
- Import from Hevy CSV (if format is documented — stretch goal).

---

## 13. Implementation Phases

### Phase 1: Data Model & Core Workout Flow

- [ ] Implement `SetType` enum and `maxEffort` flag in the data model
- [ ] Add set type to set creation and storage
- [ ] Implement workout sequence cursor (earliest-incomplete-set logic)
- [ ] Implement superset sequencing (normal A/B interleaving)
- [ ] Implement myo rep sequencing (activation → minis, no rest between minis)
- [ ] Implement superset + myo hybrid sequencing
- [ ] Timer logic per transition type (rest / no rest rules from Section 10)
- [ ] Bodyweight equipment type: blank weight field, `"+ added load"` placeholder
- [ ] Remove unilateral L/R split as default; add override toggle
- [ ] Strip subscription/paywall gates from all local features
- [ ] Strip Liftosaur branding (app name, icons, splash screen — new identity TBD)

### Phase 2: Program Editor

- [ ] Exercise creation flow with template selection (straight / AMRAP / myo / drop)
- [ ] Superset pairing UI
- [ ] Set type visible on each set row in the editor
- [ ] Add/remove sets dynamically (preserve existing functionality)
- [ ] Long-press context menu for mid-workout set editing
- [ ] Equipment type selector (bodyweight, barbell, dumbbell, cable, machine, other)

### Phase 3: Graphs & History

- [ ] Per-exercise weight-over-time graph (activation weight for myo exercises)
- [ ] Per-exercise reps-over-time graph
- [ ] Last session vs. previous session comparison (in-workout display)
- [ ] Myo rep history collapsed view (12 + 5/5/5 format)
- [ ] Workout finish screen with totals and PR highlights
- [ ] Historical data migration (L/R averaging, 0 lb → bodyweight display)

### Phase 4: Apple Ecosystem

- [ ] Set up Mac + Xcode + Developer Account
- [ ] HealthKit integration (two-way sync)
- [ ] Apple Watch companion app
- [ ] Native app wrapper (Capacitor or SwiftUI)

### Phase 5: Polish & Secondary Features

- [ ] Full data export (JSON + CSV)
- [ ] Liftosaur import
- [ ] Secondary graphs (volume trends, muscle group, PR timeline, etc.)
- [ ] Mid-workout long-press UX refinements (dial picker, etc.)
- [ ] Drop set auto-decrement option (optional convenience)
- [ ] Bodyweight total-load graph toggle (requires HealthKit bodyweight)

---

## 14. Open Questions (Parking Lot)

These are decisions deferred to implementation or future iterations:

1. **App name and identity.** Liftosaur branding is stripped, but the new name/icon/color scheme is TBD. Stitch can generate identity concepts.
2. **Liftoscript vs. structured JSON for program storage.** The current app uses Liftoscript (a custom DSL). The fork may benefit from migrating to a structured object model that the UI editor reads/writes directly, with Liftoscript as an optional power-user export. Decision deferred to codebase review.
3. **Auto-progression suggestions.** V1 tracks and displays progression signals. Whether the app should auto-suggest "increase weight next session" or just highlight the data is a UX decision. Start with display-only.
4. **AMRAP within a myo cluster.** The activation set is effectively AMRAP-style ("as many good reps as possible within the target"). Functionally they're separate types. If a use case emerges where a single set needs both flags, revisit the type system. For now, one type per set.
5. **Rest timer per-set-type overrides.** V1 uses per-exercise and per-superset-group timers. Per-set-type timers (e.g., longer rest after AMRAP than after normal) could be added later if needed.
6. **Stitch-generated UI mockups.** Use Google Stitch to explore visual design for: the program editor template picker, the myo rep cluster in-workout display, the bodyweight exercise input, the long-press context menu, and the workout finish screen. Generate as design references, implement in the actual codebase.

---

## 15. Codebase Exploration Checklist

Before implementation begins, the following must be mapped in the Liftosaur source:

- [ ] Where is the set data model defined? What fields exist today?
- [ ] How does the workout sequencer work? Is there a cursor/pointer, or does it recalculate?
- [ ] Where are superset pairings stored in the program definition?
- [ ] How does Liftoscript encode set count, rep targets, and rest timers?
- [ ] Where is the subscription/paywall logic? What feature flags control it?
- [ ] Where is the graph rendering code? What data queries feed it?
- [ ] Where is the unilateral L/R logic? How deep does it go (UI only, or data model)?
- [ ] What is the Apple Health / Watch integration surface? Is there a native iOS project, or just the web app + compiled Watch bundle?
- [ ] How is exercise equipment type stored? Is "bodyweight" already a distinct type?
- [ ] What is the export/import format and where is it implemented?
