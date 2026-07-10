# Liftoscript — 5-Day Push/Pull/Lower/Upper/Upper

The encoded, app-ready version of [current-program.md](current-program.md). Paste the
code block below into WorkoutThing's program editor (Full mode) to import it. Cues come
from [exercise-cues.md](exercise-cues.md); gear rules from [equipment.md](equipment.md).

**Structure:** 5 days — Push A, Pull A, Lower + Core, Upper (push-emphasis), Upper (pull-emphasis).
Antagonist supersets only. ~55 min/session.

**Notes:**
- **Myo-reps** use the canonical set types: `type[myoActivation]` for the activation set and
  `type[myoMini]` for the short-rest mini-sets (`1x12 type[myoActivation], 4x5 type[myoMini]`).
  The app runs the activation set, then the minis back-to-back with no rest, and only rests
  before the next exercise. `@9` sets the target RPE; weights are set live in the app.
- **Double progression** (`dp(inc, min, max)`): build reps to the top of the range, then add the
  increment and reset to the bottom. On myo exercises, `dp` progresses off the **activation** set
  and the whole cluster moves to one shared next load. The actual load step follows the exercise's
  configured equipment increment (e.g. dumbbell/cable step), so verify your equipment increments
  in Settings match your real gear (see [equipment.md](equipment.md)).
- **Linear progression** (`lp`) is used on the Romanian Deadlift.
- **Weighted Pull-Up / bodyweight**: weight shown is ADDED weight (belt/DB); `0lb` = bodyweight.
- All supersets are DB+cable / DB+bodyweight — the one-cable/one-DB-pair rule holds.

```liftoscript
# Week 1
## Day 1 Push A
/// Sun. Chest / side delt / triceps. ~55 min. Antagonist supersets only.

// Flat bench. Quality over load, ~2 RIR
Bench Press, Barbell / 4x6 / 45lb / warmup: 1x10 50%, 1x5 80% / progress: dp(5lb, 6, 10)

/// SS A: DB press + cable pushdown
// 15 deg low-incline for mid pec
Incline Bench Press, Dumbbell / 3x8 / 35lb / warmup: none / superset: A / progress: dp(5lb, 8, 12)
// rope. Myo: activate ~12, then 4 minis of 5
Triceps Pushdown, Cable / 1x12 type[myoActivation], 4x5 type[myoMini] / @9 / warmup: none / superset: A

/// SS B: DB fly + cable lateral
// 15 deg low-incline, big stretch
Chest Fly, Dumbbell / 2x12 / 20lb / warmup: none / superset: B / progress: dp(5lb, 12, 15)
// single-arm, myo, free pulley
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: B
/// SS C: DB overhead ext + DB standing calf

// overhead, elbows tucked
Triceps Extension, Dumbbell / 3x10 / 25lb / warmup: none / superset: C / progress: dp(5lb, 10, 15)
// myo, full stretch at bottom
Standing Calf Raise, Dumbbell / 1x15 type[myoActivation], 4x5 type[myoMini] / @9 / warmup: none / superset: C

## Day 2 Pull A
/// Mon. Back / biceps / rear delt. ~55 min.

/// SS A: pull-up + rope cable curl
// band assist if <5; weighted belt when >10
Pull Up / 4x5 / 0lb / warmup: none / superset: A / progress: dp(5lb, 5, 10)
// rope, free rotation, myo (elbow-safe)
Bicep Curl, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: A

/// SS B: seated cable row (floor) + hammer curl
// FLOOR pulley, neutral bar, brace on cage base
Seated Row, Cable / 4x8-12 @9 / warmup: none / superset: B
// hammer, neutral grip (elbow-safe)
Hammer Curl, Dumbbell / 3x8 / 30lb / warmup: none / superset: B / progress: dp(5lb, 8, 12)

// prone on incline bench, myo, rear delt
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
// incline DB curl, supinated (elbow-safe)
Incline Curl, Dumbbell / 3x10 / 30lb / warmup: none / progress: dp(5lb, 10, 12)
// "lat prayer", lats, slight elbow bend
Lat Pulldown, Cable / 3x10-15 @9 / warmup: none

## Day 3 Lower + Core
/// Tue. Strength anchors + maintenance-plus legs.

// ANCHOR, ~2 RIR, NO low-bar
Squat, Barbell / 3x6 / 135lb / warmup: 1x5 50%, 1x5 80% / progress: dp(5lb, 6, 8)

/// SS A: barbell RDL + BW ab wheel
// hamstring stretch, neutral spine
Romanian Deadlift / 3x8 / 135lb / warmup: none / superset: A / progress: lp(5lb, 1, 0, 10lb, 2)
// core, posterior pelvic tilt
Ab Wheel / 3x8-12 / 0lb / warmup: none / superset: A

/// SS B: BW ATG split squat + cable crunch
// ATG, front heel down; hold rack to assist
Split Squat / 3x8 / 0lb / warmup: none / superset: B / progress: dp(5lb, 8, 12)
// myo
Cable Crunch / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: B

// heels elevated, knees forward, quad-biased
Goblet Squat / 2x12 / 35lb / warmup: none / progress: dp(5lb, 12, 15)
// DB on knees, soleus
Seated Calf Raise, Dumbbell / 3x15 / 35lb / warmup: none / progress: dp(5lb, 15, 20)

## Day 4 Upper (Push-emphasis)
/// Thu. Chest / delts / triceps + back maintenance. ~55 min.

/// SS A: flat DB press + cable row
// flat for mid/lower pec
Bench Press, Dumbbell / 4x8 / 50lb / warmup: 1x10 50%, 1x5 80% / superset: A / progress: dp(5lb, 8, 12)
// back maintenance
Seated Row, Cable / 3x8-12 @9 / superset: A

/// SS B: incline DB press + lat prayer
// 30 deg
Incline Bench Press, Dumbbell / 3x8 / 40lb / warmup: none / superset: B
// "lat prayer"
Lat Pulldown, Cable / 2x10-15 @9 / warmup: none / superset: B

/// SS C: cable lateral + BW reverse crunch
// single-arm myo
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: C
Reverse Crunch / 2x15-20 / 0lb / warmup: none / superset: C

// prone incline, myo, rear delt
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
// rope, myo
Triceps Pushdown, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none

## Day 5 Upper (Pull-emphasis)
/// Fri. Back / arms / rear delt + chest maintenance. ~55 min.

/// SS A: pull-up + rope cable curl
// band assist or weighted belt as needed
Pull Up / 3x6 / 0lb / warmup: none / superset: A
// rope, free rotation, myo, elbow-safe
Bicep Curl, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: A

/// SS B: seated cable row (floor) + hammer curl
// FLOOR pulley, neutral bar, brace on cage base
Seated Row, Cable / 3x8-12 @9 / warmup: none / superset: B
// hammer, neutral grip (elbow-safe)
Hammer Curl, Dumbbell / 3x10 / 30lb / warmup: none / superset: B

/// SS C: low-incline DB press + lat prayer
// 15 deg, chest maintenance
Incline Bench Press, Dumbbell / 3x10 / 35lb / warmup: none / superset: C
// "lat prayer", top pulley
Lat Pulldown, Cable / 2x10-15 @9 / warmup: none / superset: C
/// SS D: cable lateral + BW reverse crunch

// single-arm myo
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: D
Reverse Crunch / 2x15-20 / 0lb / warmup: none / superset: D

// prone incline myo, rear delt
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
// overhead
Triceps Extension, Dumbbell / 3x10 / 25lb / warmup: none
```
