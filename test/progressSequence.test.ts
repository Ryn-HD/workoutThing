import { expect } from "chai";
import { Progress_completeSetAction } from "../src/models/progress";
import { Settings_build } from "../src/models/settings";
import { Stats_getEmpty } from "../src/models/stats";
import { Weight_build } from "../src/models/weight";
import { IHistoryEntry, IHistoryRecord, ISet, ISetType } from "../src/types";

const settings = Settings_build();
const stats = Stats_getEmpty();

function set(index: number, setType: ISetType = "normal"): ISet {
  return {
    vtype: "set",
    id: `set-${index}`,
    index,
    reps: setType === "myoMini" ? 5 : 12,
    weight: Weight_build(0, "lb"),
    setType,
    isAmrap: setType === "amrap",
    isCompleted: false,
  };
}

function entry(index: number, id: string, sets: ISet[], superset?: string): IHistoryEntry {
  return {
    vtype: "history_entry",
    id,
    index,
    exercise: { id },
    sets,
    warmupSets: [],
    superset,
  };
}

function progress(entries: IHistoryEntry[]): IHistoryRecord {
  return {
    vtype: "progress",
    id: 0,
    date: "2026-04-19",
    programId: "test-program",
    programName: "Test Program",
    day: 1,
    dayName: "Day 1",
    entries,
    startTime: Date.now(),
  };
}

function complete(aProgress: IHistoryRecord, entryIndex: number, setIndex: number, isPlayground: boolean = false): IHistoryRecord {
  return Progress_completeSetAction(
    settings,
    stats,
    aProgress,
    {
      type: "CompleteSetAction",
      entryIndex,
      setIndex,
      isPlayground,
      mode: "workout",
      forceUpdateEntryIndex: true,
      isExternal: false,
    },
    undefined
  );
}

describe("progress workout sequencing", () => {
  it("runs naked myo activation and minis without timers until the next exercise", () => {
    let p = progress([
      entry(0, "facePull", [set(0, "myoActivation"), set(1, "myoMini"), set(2, "myoMini"), set(3, "myoMini")]),
      entry(1, "curl", [set(0)]),
    ]);

    p = complete(p, 0, 0);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 0, 1);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 0, 2);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 0, 3);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.not.equal(undefined);
  });

  it("runs normal plus myo supersets as A B rest A rest A B B B", () => {
    let p = progress([
      entry(0, "lateralRaise", [set(0), set(1), set(2)], "A"),
      entry(1, "facePull", [set(0, "myoActivation"), set(1, "myoMini"), set(2, "myoMini"), set(3, "myoMini")], "A"),
      entry(2, "curl", [set(0)]),
    ]);

    p = complete(p, 0, 0);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 1, 0);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.not.equal(undefined);

    p = complete(p, 0, 1);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.not.equal(undefined);

    p = complete(p, 0, 2);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 1, 1);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 1, 2);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 1, 3);
    expect(p.ui?.currentEntryIndex).to.equal(2);
    expect(p.timer).to.not.equal(undefined);
  });

  it("keeps normal superset interleaving for larger groups", () => {
    let p = progress([
      entry(0, "squat", [set(0), set(1)], "A"),
      entry(1, "bench", [set(0), set(1)], "A"),
      entry(2, "row", [set(0), set(1)], "A"),
    ]);

    p = complete(p, 0, 0);
    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 1, 0);
    expect(p.ui?.currentEntryIndex).to.equal(2);
    expect(p.timer).to.equal(undefined);

    p = complete(p, 2, 0);
    expect(p.ui?.currentEntryIndex).to.equal(0);
    expect(p.timer).to.not.equal(undefined);
  });

  it("advances after final naked myo mini in playground mode", () => {
    let p = progress([
      entry(0, "facePull", [set(0, "myoActivation"), set(1, "myoMini"), set(2, "myoMini")]),
      entry(1, "curl", [set(0)]),
    ]);

    p = complete(p, 0, 0, true);
    p = complete(p, 0, 1, true);
    p = complete(p, 0, 2, true);

    expect(p.ui?.currentEntryIndex).to.equal(1);
    expect(p.timer).to.equal(undefined);
  });
});
