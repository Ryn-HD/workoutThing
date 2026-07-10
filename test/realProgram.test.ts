import "mocha";
import { expect } from "chai";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import { Program_nextHistoryRecord } from "../src/models/program";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";

const realProgram = `# Week 1
## Day 1 Push A
Bench Press, Barbell / 4x6 / 45lb / warmup: 1x10 50%, 1x5 80% / progress: dp(5lb, 6, 10)
Incline Bench Press, Dumbbell / 3x8 / 35lb / warmup: none / superset: A / progress: dp(5lb, 8, 12)
Triceps Pushdown, Cable / 1x12 type[myoActivation], 4x5 type[myoMini] / @9 / warmup: none / superset: A
Chest Fly, Dumbbell / 2x12 / 20lb / warmup: none / superset: B / progress: dp(5lb, 12, 15)
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: B
Triceps Extension, Dumbbell / 3x10 / 25lb / warmup: none / superset: C / progress: dp(5lb, 10, 15)
Standing Calf Raise, Dumbbell / 1x15 type[myoActivation], 4x5 type[myoMini] / @9 / warmup: none / superset: C
## Day 2 Pull A
Pull Up / 4x5 / 0lb / warmup: none / superset: A / progress: dp(5lb, 5, 10)
Bicep Curl, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: A
Seated Row, Cable / 4x8-12 @9 / warmup: none / superset: B
Hammer Curl, Dumbbell / 3x8 / 30lb / warmup: none / superset: B / progress: dp(5lb, 8, 12)
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
Incline Curl, Dumbbell / 3x10 / 30lb / warmup: none / progress: dp(5lb, 10, 12)
Lat Pulldown, Cable / 3x10-15 @9 / warmup: none
## Day 3 Lower + Core
Squat, Barbell / 3x6 / 135lb / warmup: 1x5 50%, 1x5 80% / progress: dp(5lb, 6, 8)
Romanian Deadlift / 3x8 / 135lb / warmup: none / superset: A / progress: lp(5lb, 1, 0, 10lb, 2)
Ab Wheel / 3x8-12 / 0lb / warmup: none / superset: A
Split Squat / 3x8 / 0lb / warmup: none / superset: B / progress: dp(5lb, 8, 12)
Cable Crunch / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: B
Goblet Squat / 2x12 / 35lb / warmup: none / progress: dp(5lb, 12, 15)
Seated Calf Raise, Dumbbell / 3x15 / 35lb / warmup: none / progress: dp(5lb, 15, 20)
## Day 4 Upper (Push-emphasis)
Bench Press, Dumbbell / 4x8 / 50lb / warmup: 1x10 50%, 1x5 80% / superset: A / progress: dp(5lb, 8, 12)
Seated Row, Cable / 3x8-12 @9 / superset: A
Incline Bench Press, Dumbbell / 3x8 / 40lb / warmup: none / superset: B
Lat Pulldown, Cable / 2x10-15 @9 / warmup: none / superset: B
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: C
Reverse Crunch / 2x15-20 / 0lb / warmup: none / superset: C
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
Triceps Pushdown, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
## Day 5 Upper (Pull-emphasis)
Pull Up / 3x6 / 0lb / warmup: none / superset: A
Bicep Curl, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: A
Seated Row, Cable / 3x8-12 @9 / warmup: none / superset: B
Hammer Curl, Dumbbell / 3x10 / 30lb / warmup: none / superset: B
Incline Bench Press, Dumbbell / 3x10 / 35lb / warmup: none / superset: C
Lat Pulldown, Cable / 2x10-15 @9 / warmup: none / superset: C
Lateral Raise, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: D
Reverse Crunch / 2x15-20 / 0lb / warmup: none / superset: D
Reverse Fly, Dumbbell / 1x15 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none
Triceps Extension, Dumbbell / 3x10 / 25lb / warmup: none`;

describe("Ryan's real 5-day program", () => {
  it("parses and evaluates without errors", () => {
    const { program } = PlannerTestUtils_get(realProgram);
    expect(program.planner).to.not.equal(undefined);
    // Evaluating into a workout exercises the parser, planner, and progression on every day.
    const settings = Settings_build();
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const record = Program_nextHistoryRecord(program, settings, Stats_getEmpty(), dayIndex);
      expect(record.entries.length, `day ${dayIndex + 1} has entries`).to.be.greaterThan(0);
    }
  });

  it("assigns myoActivation/myoMini set types from type[...] markers", () => {
    const { program } = PlannerTestUtils_get(realProgram);
    const settings = Settings_build();
    const record = Program_nextHistoryRecord(program, settings, Stats_getEmpty(), 0);
    const setTypes = record.entries.flatMap((e) => e.sets.map((s) => s.setType));
    expect(setTypes).to.include("myoActivation");
    expect(setTypes).to.include("myoMini");
  });
});
