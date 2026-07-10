# Liftoscript — Upper/Lower V-Taper

The encoded, app-ready version of [current-program.md](current-program.md). Paste the
code block below into WorkoutThing's program editor (Full mode) to import it. Cues come
from [exercise-cues.md](exercise-cues.md); gear rules from [equipment.md](equipment.md).

**Before running it:** every weight below is a PLACEHOLDER. Set your real working weights
(and squat/bench/deadlift numbers) in the app after importing. Notes:

- **Myo-reps** use a `myo` template (activation set + 4 short-rest mini-sets at the same
  weight); it adds 5lb only when every rep in the cluster is completed.
- **Double progression** (`dp`) everywhere else: build reps to the top of the range, then
  +5lb (+10lb deadlift) and reset to the bottom.
- **Weighted Pull-Up** weight = ADDED weight (belt/DB); `0lb` = bodyweight.
- All supersets are DB+cable / DB+bodyweight — the one-cable/one-DB-pair rule holds.
- Validated with `scripts/validate_liftoscript.ts` (VALIDATION: OK). Not yet run through
  the Liftosaur playground or a real session — verify progression live in the app.

```liftoscript
# Week 1
## Upper A
myo / used: none / 1x12, 4x5 / 20s / 10lb / progress: custom(increment: 5lb) {~
  if (completedReps >= reps) {
    weights += state.increment
  }
~}
// Bench Press — 4x6 at ~2 RIR. Push each set toward 10 reps over sessions, then +5lb and reset.
Bench Press / 4x6 / 135lb / 150s / progress: dp(5lb, 6, 10)
Incline Bench Press, Dumbbell / 3x8 / 45lb / 120s / superset: a / progress: dp(5lb, 8, 12)
Seated Row / 3x10 / 80lb / 120s / superset: a / progress: dp(5lb, 10, 15)
Chest Fly / 3x12 / 20lb / 75s / superset: b / progress: dp(5lb, 12, 15)
Lateral Raise, Cable / ...myo / 12lb / superset: b
Lateral Raise / 3x12 / 15lb / 75s / superset: c / progress: dp(5lb, 12, 20)
Triceps Pushdown / ...myo / 30lb / superset: c
Triceps Extension / 3x10 / 25lb / 75s / progress: dp(5lb, 10, 12)

## Lower A
// Back Squat — 3x6 at ~2 RIR.
Squat / 3x6 / 185lb / 150s / progress: dp(5lb, 6, 10)
Bulgarian Split Squat / 3x8 / 30lb / 90s / superset: d / progress: dp(5lb, 8, 12)
Ab Wheel / 3x10 / warmup: none / 75s / superset: d
// Barbell RDL — controlled eccentric, feel the hamstring stretch. Do not round the low back.
Romanian Deadlift, Barbell / 3x8 / 135lb / 120s / progress: dp(5lb, 8, 12)
Goblet Squat / 2x12 / 40lb / 90s / progress: dp(5lb, 12, 15)
Standing Calf Raise / ...myo / 40lb
// KOT back extension — extend with the erectors to a straight line, do not hyperextend.
Back Extension, Bodyweight / 3x15 / warmup: none / 75s

## Upper B
// Weighted Pull-Up — weight shown is ADDED weight (belt/DB); 0 = bodyweight. Build 6->8 reps, then +5lb.
Pull Up / 4x6 / 0lb / warmup: none / superset: e / progress: dp(5lb, 6, 8)
Hammer Curl / 3x8 / 25lb / 75s / superset: e / progress: dp(5lb, 8, 12)
Lat Pulldown / 3x12 / 80lb / 120s / superset: f / progress: dp(5lb, 12, 15)
Incline Curl / 3x10 / 20lb / 75s / superset: f / progress: dp(5lb, 10, 12)
Bent Over One Arm Row / 3x10 / 50lb / 90s / superset: g / progress: dp(5lb, 10, 15)
Face Pull / 3x12 / 30lb / 75s / superset: g / progress: dp(5lb, 12, 20)
Pullover / 3x10 / 30lb / 90s / superset: h / progress: dp(5lb, 10, 15)
Bicep Curl, Cable / ...myo / 25lb / superset: h
Lateral Raise / 3x12 / 15lb / 75s

## Upper C
Incline Bench Press, Dumbbell / 3x8 / 45lb / 120s / superset: i
Lat Pulldown / 3x12 / 80lb / 120s / superset: i
Chest Fly / 3x12 / 20lb / 75s / superset: j
Lateral Raise, Cable / 1x12, 4x5 / 20s / 12lb / superset: j
Lateral Raise / 3x12 / 15lb / 75s / superset: k
Face Pull / 3x12 / 30lb / 75s / superset: k
Incline Curl / 3x10 / 20lb / 75s / superset: l
Triceps Pushdown / 1x12, 4x5 / 20s / 30lb / superset: l

## Lower B
// Deadlift — 3x5 at ~2 RIR. Reset the brace each rep.
Deadlift / 3x5 / 225lb / 180s / progress: dp(10lb, 5, 8)
Lunge, Dumbbell / 3x10 / 30lb / 90s / superset: m / progress: dp(5lb, 10, 12)
Hanging Leg Raise / 3x12 / warmup: none / 75s / superset: m
// DB RDL — lighter stretch hinge, secondary to the deadlift.
Romanian Deadlift / 3x10 / 40lb / 120s / progress: dp(5lb, 10, 12)
Seated Calf Raise, Dumbbell / 3x15 / 40lb / 90s / progress: dp(5lb, 15, 20)
Cable Crunch / ...myo / 40lb
```
