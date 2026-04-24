import "mocha";
import { expect } from "chai";
import { Progress_getNextWorkoutStep } from "../src/models/progress";
import { IExerciseType, IHistoryEntry, IHistoryRecord, ISet, ISetType } from "../src/types";

function buildSet(index: number, setType: ISetType, isCompleted: boolean = false): ISet {
  return {
    vtype: "set",
    id: `set-${index}-${setType}`,
    index,
    reps: setType === "myoActivation" ? 12 : 4,
    setType,
    isAmrap: false,
    isCompleted,
  };
}

function buildEntry(index: number, id: string, sets: ISet[]): IHistoryEntry {
  return {
    vtype: "history_entry",
    id,
    index,
    exercise: { id, equipment: "barbell" } as IExerciseType,
    sets,
    warmupSets: [],
    superset: "A",
  };
}

function buildProgress(entries: IHistoryEntry[]): IHistoryRecord {
  return {
    vtype: "progress",
    id: 0,
    date: "2026-04-24",
    programId: "program",
    programName: "Program",
    day: 1,
    dayName: "Day 1",
    startTime: 1,
    entries,
  };
}

describe("Progress", () => {
  describe(".getNextWorkoutStep()", () => {
    it("alternates two myo-rep exercises after both activation sets and starts timers on superset wraps", () => {
      const progress = buildProgress([
        buildEntry(0, "a", [
          buildSet(0, "myoActivation", true),
          buildSet(1, "myoMini"),
          buildSet(2, "myoMini"),
        ]),
        buildEntry(1, "b", [
          buildSet(0, "myoActivation"),
          buildSet(1, "myoMini"),
          buildSet(2, "myoMini"),
        ]),
      ]);

      expect(Progress_getNextWorkoutStep(progress, 0, 0)).to.eql({
        entryIndex: 1,
        setIndex: 0,
        shouldStartTimer: false,
      });

      progress.entries[1].sets[0].isCompleted = true;
      expect(Progress_getNextWorkoutStep(progress, 1, 0)).to.eql({
        entryIndex: 0,
        setIndex: 1,
        shouldStartTimer: true,
      });

      progress.entries[0].sets[1].isCompleted = true;
      expect(Progress_getNextWorkoutStep(progress, 0, 1)).to.eql({
        entryIndex: 1,
        setIndex: 1,
        shouldStartTimer: false,
      });

      progress.entries[1].sets[1].isCompleted = true;
      expect(Progress_getNextWorkoutStep(progress, 1, 1)).to.eql({
        entryIndex: 0,
        setIndex: 2,
        shouldStartTimer: true,
      });
    });
  });
});
