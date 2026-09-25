import "mocha";
import { expect } from "chai";
import { PlannerTestUtils_get } from "./utils/plannerTestUtils";
import {
  Program_evaluate,
  Program_getProgramExerciseForKeyAndDay,
  Program_nextHistoryRecord,
} from "../src/models/program";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Progress_completeSetAction } from "../src/models/progress";
import { Exercise_getIsUnilateral } from "../src/models/exercise";
import { IHistoryRecord, ISettings } from "../src/types";

const settings = Settings_build();
const stats = Stats_getEmpty();

function startWorkout(text: string): {
  record: IHistoryRecord;
  complete: (r: IHistoryRecord, e: number, s: number) => IHistoryRecord;
} {
  const { program } = PlannerTestUtils_get(text);
  const evaluated = Program_evaluate(program, settings);
  const record = { ...Program_nextHistoryRecord(program, settings, stats, 1), currentEntryIndex: 0 };
  const complete = (r: IHistoryRecord, entryIndex: number, setIndex: number): IHistoryRecord =>
    Progress_completeSetAction(
      settings,
      stats,
      r,
      {
        type: "CompleteSetAction",
        entryIndex,
        setIndex,
        programExercise: Program_getProgramExerciseForKeyAndDay(
          evaluated,
          r.day,
          r.entries[entryIndex].programExerciseId!
        ),
        otherStates: {},
        isPlayground: false,
        mode: "workout",
        forceUpdateEntryIndex: true,
        isExternal: false,
      },
      undefined
    );
  return { record, complete };
}

describe("personal fork", () => {
  it("runs a program-built straight set + myo superset as A1 act rest A2 rest A3 rest A4 minis", () => {
    const { record, complete } = startWorkout(`# Week 1
## Day 1
Pull Up / 4x5 / 0lb / warmup: none / superset: A / progress: dp(5lb, 5, 10)
Bicep Curl, Cable / 1x12 type[myoActivation], 3x5 type[myoMini] / @9 / warmup: none / superset: A
Seated Row, Cable / 3x8-12 @9 / warmup: none
`);
    let p = record;
    const path: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const entryIndex = p.currentEntryIndex ?? 0;
      const entry = p.entries[entryIndex];
      const setIndex = entry.sets.findIndex((s) => !s.isCompleted);
      p = complete(p, entryIndex, setIndex);
      path.push(`${entry.exercise.id}:${entry.sets[setIndex].setType}${p.timer != null ? " rest" : ""}`);
    }
    expect(path).to.deep.equal([
      "pullUp:normal",
      "bicepCurl:myoActivation rest",
      "pullUp:normal rest",
      "pullUp:normal rest",
      "pullUp:normal",
      "bicepCurl:myoMini",
      "bicepCurl:myoMini",
      "bicepCurl:myoMini rest",
    ]);
    expect(p.entries[p.currentEntryIndex ?? 0].exercise.id).to.equal("seatedRow");
  });

  it("completes a bodyweight set with no weight without asking for one", () => {
    const { record, complete } = startWorkout(`# Week 1
## Day 1
Inverted Row / 3x6 / warmup: none
`);
    const p = complete(record, 0, 0);
    expect(p.amrapModal).to.equal(undefined);
    expect(p.entries[0].sets[0].isCompleted).to.equal(true);
    expect(p.entries[0].sets[0].completedWeight?.value).to.equal(0);
  });

  it("logs curls as a single reps entry unless L/R is enabled for the exercise", () => {
    const hammerCurl = { id: "hammerCurl" as const, equipment: "dumbbell" };
    expect(Exercise_getIsUnilateral(hammerCurl, settings)).to.equal(false);
    const withOverride: ISettings = {
      ...settings,
      exerciseData: { ...settings.exerciseData, hammerCurl_dumbbell: { isUnilateral: true } },
    };
    expect(Exercise_getIsUnilateral(hammerCurl, withOverride)).to.equal(true);
  });
});
