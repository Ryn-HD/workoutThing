import { History_finishProgramDay } from "../src/models/history";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Program_nextHistoryRecord } from "../src/models/program";
import { basicBeginnerProgram } from "../src/programs/basicBeginnerProgram";
import { WorkoutFinish_run } from "../src/utils/workoutFinish";
import { AppleHealthShortcut_recordTimes } from "../src/utils/appleHealthShortcut";
import { Dialog_confirm } from "../src/utils/dialog";
import { FrameLoop_cancelAll } from "./setup/frameLoop";
import type { IHistoryRecord } from "../src/types";

jest.mock("../src/utils/dialog", () => ({ Dialog_confirm: jest.fn().mockResolvedValue(true) }));
jest.mock("../src/lib/healthSync", () => ({
  HealthSync_eligibleForAppleHealth: () => false,
  HealthSync_eligibleForGoogleHealth: () => false,
}));
jest.mock("../src/ducks/thunks", () => ({
  Thunk_finishProgramDay: (id: number) => ({ type: "finish", id }),
  Thunk_pauseWorkoutNative: () => ({ type: "pause" }),
  Thunk_postevent: () => ({ type: "event" }),
  Thunk_finishWorkoutNative: () => ({ type: "native-finish" }),
  Thunk_saveWorkoutToHealth: () => ({ type: "native-health" }),
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  FrameLoop_cancelAll();
});

function partialWorkout(): IHistoryRecord {
  const settings = Settings_build();
  const base = Program_nextHistoryRecord(basicBeginnerProgram, settings, Stats_getEmpty(), 0);
  return {
    ...base,
    startTime: 1000,
    intervals: [[1000, undefined]] as [number, number | undefined][],
    entries: base.entries.map((entry, index) => ({
      ...entry,
      sets: entry.sets.map((set, setIndex) =>
        index === 0 && setIndex === 0
          ? { ...set, isCompleted: true, completedReps: 3, completedWeight: set.weight }
          : { ...set, isCompleted: false, completedReps: undefined }
      ),
    })),
  };
}

it("uses the same finish timestamp for the saved end and interval despite later processing", () => {
  const workout = partialWorkout();
  jest.spyOn(Date, "now").mockReturnValue(600999);
  const saved = History_finishProgramDay(workout, Settings_build(), workout.day, undefined, undefined, 600000);
  expect(saved.endTime).toBe(600000);
  expect(saved.intervals).toEqual([[1000, 600000]]);
  expect(AppleHealthShortcut_recordTimes(saved).durationSeconds).toBe(599);
  expect(saved.entries[0].sets[0].completedReps).toBe(3);
  expect(saved.entries[0].sets[1].isCompleted).toBe(false);
});

it("finishes a partial current workout without an incomplete-set confirmation", async () => {
  const dispatch = jest.fn();
  const setIsFinishing = jest.fn();
  await WorkoutFinish_run({
    progress: partialWorkout(),
    settings: Settings_build(),
    dispatch,
    isCurrent: true,
    setIsFinishing,
  });
  expect(Dialog_confirm).not.toHaveBeenCalled();
  expect(setIsFinishing).toHaveBeenCalledWith(true);
  expect(dispatch).toHaveBeenCalledWith({ type: "finish", id: 0 });
});

it("still allows the user to cancel saving an edited past workout", async () => {
  jest.mocked(Dialog_confirm).mockResolvedValueOnce(false);
  const dispatch = jest.fn();
  const setIsFinishing = jest.fn();
  await WorkoutFinish_run({
    progress: { ...partialWorkout(), id: 1000 },
    settings: Settings_build(),
    dispatch,
    isCurrent: false,
    setIsFinishing,
  });
  expect(dispatch).not.toHaveBeenCalled();
  expect(setIsFinishing).not.toHaveBeenCalled();
});
