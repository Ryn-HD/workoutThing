# Personal Workout App Fork Spec

This document captures the product and implementation direction for a private fork of Liftosaur. It is intended as the durable source of truth for future agent sessions.

## Goal

Build a personal workout tracker optimized for:

- double progression
- normal supersets
- superset plus myo-rep combinations
- myo-rep and drop-set tracking
- bodyweight exercises with optional added load
- no default left/right unilateral logging
- free local graphs and coach-style analytics
- full local export/import
- later Apple Health and Apple Watch companion support

This fork is for personal use, not public distribution.

## Current Code Landmarks

Workout/timer/superset behavior:

- `src/models/progress.ts`
- `src/components/workout.tsx`
- `src/components/workoutExerciseSet.tsx`
- `tests/supersets.spec.ts`

Program editor and set editing:

- `src/components/editProgramExercise/editProgramExerciseSet.tsx`
- `src/components/editProgramExercise/bottomSheetEditProgramExerciseSet.tsx`
- `src/components/editProgramExercise/editProgramExerciseSetVariation.tsx`
- `src/pages/planner/models/types.ts`
- `src/pages/planner/plannerExerciseEvaluator.ts`
- `src/pages/planner/models/plannerProgramExercise.ts`

Unilateral handling:

- `src/models/exercise.ts`
- `src/components/exerciseDataSettings.tsx`
- `src/components/workoutExerciseSet.tsx`
- `src/components/modalAmrap.tsx`
- `src/models/set.ts`
- `tests/unilateral.spec.ts`

Graphs and subscription gates:

- `src/ducks/thunks.ts`
- `src/components/screenGraphs.tsx`
- `src/components/weekInsights.tsx`
- `src/utils/subscriptions.ts`

Health and Watch bridge:

- `src/lib/healthSync.ts`
- `src/components/screenAppleHealthSettings.tsx`
- `src/ducks/thunks.ts`
- `src/watch/index.ts`
- `webpack.config.js`

Export/import:

- `src/lib/importexporter.ts`
- `src/components/screenSettings.tsx`
- `src/utils/importFromLiftosaur.ts`
- `src/utils/importFromHevy.ts`

## Superset Sequencing

Current Liftosaur behavior is too simple: a superset is an exercise-level ring. Completing A jumps to B, completing B jumps back to A. Timer logic is coupled to set completion, so completing A in `A -> B` starts a rest timer even though B should be back-to-back.

Desired normal superset rule:

```text
A1 -> B1 -> rest timer
A2 -> B2 -> rest timer
A3 -> B3 -> rest timer / next exercise
```

Completing `A` in a normal superset jumps to `B` with no timer. Completing `B` starts the superset rest timer before the next `A`.

Unequal set counts should continue sensibly:

```text
A1 -> B1 -> rest
A2 -> B2 -> rest
B3 -> rest
B4 -> next exercise
```

## Superset Plus Myo Reps

The special case is a normal exercise supersetted with a myo-rep exercise.

Example with `A = normal 3 sets` and `B = myo activation + minis`:

```text
A1 -> B activation -> rest
A2 -> rest
A3 -> B mini1 -> B mini2 -> B mini3 -> rest / next exercise
```

If B has four minis:

```text
A1 -> B activation -> rest
A2 -> rest
A3 -> B mini1 -> B mini2 -> B mini3 -> B mini4 -> rest / next exercise
```

No timer should run between a myo activation and its mini sets, and no timer should run between mini sets.

## Set Types

Add first-class set types:

```text
normal
amrap
myoActivation
myoMini
drop
```

AMRAP can remain a set property, but myo activation should be modeled separately because it belongs to a myo cluster and drives progression.

Default myo template:

```text
activation: 12+
minis: 5 / 5 / 5
```

The program editor should still allow adding/removing mini sets dynamically.

## Myo Progression And Metrics

For double progression, myo progression should look at the activation set only.

Example:

```text
If activation target is 12+ and the completed activation reps exceed the threshold, increase load next time.
```

Mini sets:

- are logged
- count toward volume
- do not trigger progression changes
- should generally be ignored for PR and estimated 1RM

History display may collapse myo sets for readability:

```text
12 + 5/5/5
```

Internally, keep the individual sets so editing, export, and volume math stay precise.

## Drop Sets

V1 should support drop sets as a set type, but keep automation conservative.

Expected flow:

```text
main/drop-start set -> drop set -> drop set -> rest / next exercise
```

No timer between drop sets.

User can manually enter each drop-set weight. A later helper may default each drop to roughly 20% below the previous set, but v1 should not force this.

Drop-set volume can count in volume-style graphs. Drop sets should be ignored for PR and estimated 1RM until better logic is designed.

## Sequencing Engine

Replace the current simple superset ring with a set-aware resolver.

Suggested output shape:

```ts
{
  nextEntryIndex?: number;
  nextSetIndex?: number;
  shouldStartTimer: boolean;
  timerKind: "none" | "workout" | "superset" | "set";
}
```

The resolver should know about:

- current entry
- current set
- superset group
- set types
- completed/unchecked sets
- removed sets
- normal timers
- superset timers
- explicit set timers

If a user unchecks a set, it is acceptable for the cursor to recalculate toward the earliest incomplete set. Avoid complicated skip semantics in v1.

No new skip button is required in v1.

## Program Editor Requirements

The UI-first editor is mandatory. Liftoscript can remain underneath, but these features should not require hand-written scripts.

Extend the set edit modal with a "Set Type" control:

```text
Normal
AMRAP
Myo activation
Myo mini
Drop set
```

Add quick templates during exercise setup:

```text
Straight sets
AMRAP finisher
Myo reps
Drop set
Superset pair
Superset + myo
```

Default straight sets can stay near the existing 3-set flow. Myo template creates `12+ / 5 / 5 / 5`.

Potential UI locations:

- set rows in `editProgramExerciseSet.tsx`
- swipe/edit modal in `bottomSheetEditProgramExerciseSet.tsx`
- add-set flow in `editProgramExerciseSetVariation.tsx`

## Bodyweight Exercises

For equipment `Bodyweight`, the weight field means added load, not required load.

Rules:

- Blank weight is valid.
- Blank means bodyweight baseline.
- `5 lb` means bodyweight plus 5 lb.
- Existing `0lb` on bodyweight exercises should display/behave like blank added load where practical.
- The workout input placeholder should say something like `+ load` or `added`.

This applies when the selected equipment is bodyweight.

Completion should not require completed weight for bodyweight exercises. Current set status logic requires both reps and weight; this must change for bodyweight sets.

Graphs:

- Reps over time is the primary signal for pull-ups, push-ups, dips, etc.
- Added load over time can show `0 -> 5 -> 10`.
- Scale-weight changes should not make the main pull-up/push-up weight graph jump around.
- Bodyweight can be a contextual overlay later.

## Unilateral Logging

No exercise should default to split left/right logging.

Default:

- one reps input
- "8" means the left/non-dominant side standard; the right side matches it
- old `8/8` style history can display as the average, usually still `8`

Keep an override:

```text
Track left/right separately
```

This override is for rare rehab/asymmetry/testing cases, not the default.

## Graphs And Analytics

Remove local subscription gates so graph and analytics features work in the personal fork.

The graph screen is mostly implemented, but navigation blocks it for unsubscribed users in `src/ducks/thunks.ts`.

Priority analytics:

- reps over time per exercise
- added load over time
- estimated 1RM for normal hard sets only
- volume over time, including myo/drop volume where appropriate
- PR timeline, ignoring myo minis/drop sets for max/e1RM PRs
- workout frequency/calendar
- double-progression views showing whether reps or load are improving across weeks

Dashboard should answer coach-style questions:

- Is this exercise improving?
- Are reps increasing within the target range?
- Has load increased after rep targets were met?
- Is bodyweight context affecting bodyweight movements?
- Is frequency/consistency improving?

## Export, Import, And Sync

V1 can remain local/offline as long as export/import is comprehensive.

Requirements:

- full JSON export includes programs, history, settings, custom exercises, stats, graph config, and any new set metadata
- visible "backup everything" workflow later
- Liftosaur export should be the first import target because the user currently uses Liftosaur

Private backend or cloud sync can wait unless multi-device sync becomes important.

## Apple Health And Apple Watch

V1 is web/PWA first. Native Apple integration is a later phase.

Goals:

- two-way Apple Health support where useful
- write completed strength workout duration and intervals/calories if available
- read bodyweight/body metrics from Health for context/bodyweight overlays
- Apple Watch as companion controller, not standalone

Reality:

- HealthKit/watchOS requires Apple capabilities, signing, and native targets through Xcode/Xcode Cloud.
- This is not a Docker-first Windows build problem.
- The user is on Windows 11 and does not currently have a Mac, Xcode, or Apple Developer account.
- Practical route: finish web fork first, then get Apple Developer account plus Mac access or Xcode Cloud path, then build a minimal SwiftUI wrapper/watch companion.

## Branding And License

Remove Liftosaur branding in the fork UI.

The upstream repo is AGPL-3.0. Plain-English summary:

- private use and modification are allowed
- if the modified app is distributed, source obligations likely apply
- if a modified network service is offered to other users, source availability obligations likely apply
- preserve copyright/license notices
- do not present the fork as proprietary unless license obligations are handled

This is not legal advice.

## Implementation Phases

1. Local fork cleanup
   - remove visible Liftosaur branding
   - disable subscription gates locally
   - confirm full export/import works

2. Bodyweight handling
   - blank added-load support
   - bodyweight completion logic
   - input placeholders
   - display/migration behavior for `0lb`

3. Unilateral default change
   - single-entry default
   - left/right override preserved
   - old history averaged/collapsed for display

4. Set type model
   - add set type to planner/program/history schemas
   - preserve import/export
   - update editor set modal

5. Sequencing engine
   - replace simple superset ring with set-aware next-step resolver
   - separate navigation from timer start

6. Myo templates and display
   - `12+ / 5 / 5 / 5`
   - activation-only progression
   - collapsed history display

7. Drop-set support
   - no-timer drop cluster
   - manual weights
   - conservative graph inclusion

8. Analytics dashboard
   - double progression views
   - reps/load/volume/PR/frequency analytics

9. Apple planning phase
   - native wrapper strategy
   - HealthKit permissions
   - Watch companion architecture

## Acceptance Tests

Normal superset:

```text
A1 check -> jumps to B1, no timer
B1 check -> jumps to A2, starts superset timer
```

Superset plus myo:

```text
A1 -> B activation -> timer
A2 -> timer
A3 -> B mini1 -> B mini2 -> B mini3 -> timer/next
```

Naked myo:

```text
activation -> mini1 -> mini2 -> mini3 -> timer/next
```

Bodyweight:

```text
Pull Up 3x8 with blank weight can be completed.
Adding 5lb records added load, not required bodyweight.
```

Unilateral:

```text
Bicep Curl shows one reps input by default.
Override can show L/R.
Old 8/8 history displays as 8.
```

Graphs:

```text
Graphs screen opens without subscription.
Myo activation affects progression/e1RM.
Myo minis contribute to volume but not PR/e1RM.
Drop sets contribute to volume but not PR/e1RM.
```

