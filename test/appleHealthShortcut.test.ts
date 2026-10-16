import "mocha";
import { expect } from "chai";
import type { IHistoryRecord } from "../src/types";
import {
  AppleHealthShortcut_buildPayload,
  AppleHealthShortcut_finishLaunch,
  AppleHealthShortcut_finishPayload,
  AppleHealthShortcut_getState,
  AppleHealthShortcut_isEnabled,
  AppleHealthShortcut_launchUrl,
  AppleHealthShortcut_name,
  AppleHealthShortcut_recordTimes,
  AppleHealthShortcut_setState,
} from "../src/utils/appleHealthShortcut";

function record(overrides: Partial<IHistoryRecord> = {}): IHistoryRecord {
  const startTime = Date.parse("2026-11-01T01:50:00-04:00");
  return { id: startTime, startTime, endTime: startTime + 40 * 60000, ...overrides } as IHistoryRecord;
}

class Store {
  public data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function nativeQuery(url: string): Record<string, string> {
  // Do not use URLSearchParams here: its form decoder would hide a '+' bug
  // by translating '+' back to a space, unlike the native Shortcuts decoder.
  return Object.fromEntries(
    new URL(url).search
      .slice(1)
      .split("&")
      .map((pair) => {
        const [key, value] = pair.split("=");
        return [decodeURIComponent(key), decodeURIComponent(value)];
      })
  );
}

describe("Apple Health Shortcut handoff", () => {
  it("excludes paused time and keeps the actual start across DST and midnight", () => {
    const workout = record();
    workout.intervals = [
      [workout.startTime, workout.startTime + 10 * 60000],
      [workout.startTime + 20 * 60000, workout.endTime],
    ];
    expect(AppleHealthShortcut_recordTimes(workout)).to.eql({
      startDate: "2026-11-01T05:50:00Z",
      durationSeconds: 1800,
      energyKcal: 180,
    });
    const midnight = Date.parse("2026-10-12T23:50:00-04:00") + 450;
    expect(
      AppleHealthShortcut_recordTimes(record({ startTime: midnight, endTime: midnight + 20 * 60000 })).startDate
    ).to.equal("2026-10-13T03:50:00Z");
  });

  it("supports closed intervals on legacy records without an explicit end", () => {
    const workout = record({ endTime: undefined });
    workout.intervals = [[workout.startTime, workout.startTime + 90500]];
    expect(AppleHealthShortcut_recordTimes(workout).durationSeconds).to.equal(90);
    expect(AppleHealthShortcut_recordTimes(workout).energyKcal).to.equal(6);
  });

  it("recovers saved timer metadata without requiring all sets or exercises to be finished", () => {
    const workout = record();
    const start = workout.startTime;
    const end = workout.endTime!;
    expect(AppleHealthShortcut_recordTimes(record({ intervals: [[start, end + 300]] })).durationSeconds).to.equal(2400);
    expect(AppleHealthShortcut_recordTimes(record({ intervals: [[start, undefined]] })).durationSeconds).to.equal(2400);
    expect(AppleHealthShortcut_recordTimes(record({ intervals: [] })).durationSeconds).to.equal(2400);
    expect(AppleHealthShortcut_recordTimes(record({ intervals: [[NaN, Infinity]] })).durationSeconds).to.equal(2400);
    const partial = record({
      entries: [
        {
          sets: [
            { reps: 10, completedReps: 3, isCompleted: true },
            { reps: 10, isCompleted: false },
          ],
        },
      ] as IHistoryRecord["entries"],
    });
    expect(AppleHealthShortcut_buildPayload(partial).durationSeconds).to.equal(2400);
    expect(AppleHealthShortcut_recordTimes(record({ endTime: start + 500 })).durationSeconds).to.equal(1);
    expect(AppleHealthShortcut_recordTimes(record({ endTime: start })).durationSeconds).to.equal(1);
  });

  it("sorts, clips and merges intervals without double counting overlap or including pauses", () => {
    const start = record().startTime;
    const times = AppleHealthShortcut_recordTimes(
      record({
        intervals: [
          [start + 20 * 60000, record().endTime! + 300],
          [start, start + 10 * 60000],
          [start + 5 * 60000, start + 8 * 60000],
          [NaN, Infinity],
        ],
      })
    );
    expect(times.durationSeconds).to.equal(1800);
    expect(times.energyKcal).to.equal(180);
  });

  it("still rejects missing or nonfinite session timestamps rather than using today's time", () => {
    for (const overrides of [
      { endTime: undefined },
      { startTime: NaN },
      { endTime: Infinity },
      { endTime: record().startTime - 1 },
    ]) {
      expect(() => AppleHealthShortcut_recordTimes(record(overrides))).to.throw();
    }
  });

  it("closes the running workout at the Finish tap, after the first set or a full session", () => {
    const start = record().startTime;
    const afterFirstSet = AppleHealthShortcut_finishPayload(
      { startTime: start, intervals: [[start, undefined]] },
      start + 95000
    );
    expect(afterFirstSet).to.eql({ version: 2, startDate: "2026-11-01T05:50:00Z", durationSeconds: 95, energyKcal: 6 });
    const paused = AppleHealthShortcut_finishPayload(
      { startTime: start, intervals: [[start, start + 600000]] },
      start + 1200000
    );
    expect(paused.durationSeconds).to.equal(600);
    expect(
      AppleHealthShortcut_finishPayload({ startTime: start, intervals: undefined }, start + 1000).durationSeconds
    ).to.equal(1);
  });

  it("builds a plain run-shortcut URL with only the workout times, no callbacks", () => {
    const payload = AppleHealthShortcut_buildPayload(record());
    const url = AppleHealthShortcut_launchUrl(payload);
    expect(url.startsWith("shortcuts://run-shortcut?")).to.equal(true);
    expect(url).to.not.contain("+");
    expect(url).to.not.contain("x-callback");
    expect(url).to.contain("name=VelociReps%20Log%20Workout");
    const query = nativeQuery(url);
    expect(query.name).to.equal(AppleHealthShortcut_name);
    expect(query.input).to.equal("text");
    expect(JSON.parse(query.text)).to.eql(payload);
    expect(Object.keys(payload)).to.eql(["version", "startDate", "durationSeconds", "energyKcal"]);
  });

  it("launches from Finish only for the current workout on an enabled iPhone web app, once", () => {
    const progress = {
      id: 5,
      startTime: record().startTime,
      intervals: [[record().startTime, undefined]],
    } as IHistoryRecord;
    const base = {
      progress,
      isCurrent: true,
      eligible: true,
      enabled: true,
      alreadySent: false,
      now: progress.startTime + 60000,
    };
    const url = AppleHealthShortcut_finishLaunch(base);
    expect(JSON.parse(nativeQuery(url!).text).durationSeconds).to.equal(60);
    expect(AppleHealthShortcut_finishLaunch({ ...base, isCurrent: false })).to.equal(undefined);
    expect(AppleHealthShortcut_finishLaunch({ ...base, eligible: false })).to.equal(undefined);
    expect(AppleHealthShortcut_finishLaunch({ ...base, enabled: false })).to.equal(undefined);
    expect(AppleHealthShortcut_finishLaunch({ ...base, alreadySent: true })).to.equal(undefined);
    expect(AppleHealthShortcut_finishLaunch({ ...base, now: progress.startTime - 1 })).to.equal(undefined);
  });

  it("is on by default, remembers a sent workout and ignores corrupt state", () => {
    const store = new Store();
    expect(AppleHealthShortcut_isEnabled(store)).to.equal(true);
    store.setItem("velocireps:apple-health-shortcut:enabled", "false");
    expect(AppleHealthShortcut_isEnabled(store)).to.equal(false);
    expect(AppleHealthShortcut_getState(5, store)).to.equal(undefined);
    AppleHealthShortcut_setState(5, { status: "sent", sentAt: 100 }, store);
    expect(AppleHealthShortcut_getState(5, store)).to.eql({ status: "sent", sentAt: 100 });
    store.setItem("velocireps:apple-health-shortcut:workout:6", "{not json");
    store.setItem("velocireps:apple-health-shortcut:workout:7", JSON.stringify({ status: "saved", sentAt: 1 }));
    expect(AppleHealthShortcut_getState(6, store)).to.equal(undefined);
    expect(AppleHealthShortcut_getState(7, store)).to.equal(undefined);
  });
});
