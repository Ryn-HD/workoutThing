import "mocha";
import { expect } from "chai";
import type { IHistoryRecord } from "../src/types";
import {
  AppleHealthShortcut_acceptCallback,
  AppleHealthShortcut_buildPayload,
  AppleHealthShortcut_getState,
  AppleHealthShortcut_launchUrl,
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

describe("Apple Health Shortcut handoff", () => {
  it("excludes paused time and keeps the actual start across DST and midnight", () => {
    const workout = record();
    workout.intervals = [
      [workout.startTime, workout.startTime + 10 * 60000],
      [workout.startTime + 20 * 60000, workout.endTime],
    ];
    expect(AppleHealthShortcut_recordTimes(workout)).to.eql({
      startDate: "2026-11-01T05:50:00.000Z",
      durationSeconds: 1800,
      energyKcal: 180,
    });
    const midnight = Date.parse("2026-10-12T23:50:00-04:00");
    expect(
      AppleHealthShortcut_recordTimes(record({ startTime: midnight, endTime: midnight + 20 * 60000 })).startDate
    ).to.equal("2026-10-13T03:50:00.000Z");
  });

  it("supports closed intervals on legacy records without an explicit end", () => {
    const workout = record({ endTime: undefined });
    workout.intervals = [[workout.startTime, workout.startTime + 90500]];
    expect(AppleHealthShortcut_recordTimes(workout).durationSeconds).to.equal(90);
    expect(AppleHealthShortcut_recordTimes(workout).energyKcal).to.equal(6);
  });

  it("rejects open, overlapping, nonfinite and out-of-range intervals and missing timestamps", () => {
    const workout = record();
    const invalid: Partial<IHistoryRecord>[] = [
      { endTime: undefined },
      { startTime: NaN },
      { endTime: Infinity },
      { endTime: workout.startTime },
      { intervals: [[workout.startTime, undefined]] },
      {
        intervals: [
          [workout.startTime, workout.startTime + 2000],
          [workout.startTime + 1000, workout.endTime],
        ],
      },
      { intervals: [[workout.startTime, workout.endTime! + 1000]] },
      { intervals: [[workout.startTime, workout.startTime + 999]] },
      { intervals: [] },
    ];
    for (const overrides of invalid) {
      expect(() => AppleHealthShortcut_recordTimes(record(overrides))).to.throw();
    }
  });

  it("uses stable opaque workout IDs across retries/edits and distinct IDs for accounts", async () => {
    const first = await AppleHealthShortcut_buildPayload("account-one", record());
    const retry = await AppleHealthShortcut_buildPayload("account-one", record({ endTime: record().endTime! + 1000 }));
    const other = await AppleHealthShortcut_buildPayload("account-two", record());
    expect(first.exportId).to.match(/^v1-[a-f0-9]{64}$/);
    expect(first.exportId).to.equal(retry.exportId);
    expect(first.requestId).to.not.equal(retry.requestId);
    expect(first.exportId).to.not.equal(other.exportId);
    expect(JSON.stringify(first)).to.not.contain("account-one");
    expect(Object.keys(first)).to.have.length(7);
  });

  it("encodes JSON once and restricts all callbacks to the app origin without workout metrics", async () => {
    const payload = await AppleHealthShortcut_buildPayload("test", record());
    const link = new URL(AppleHealthShortcut_launchUrl(payload, "https://velocireps.vercel.app/app/?admin=secret"));
    expect(JSON.parse(link.searchParams.get("text")!)).to.eql(payload);
    for (const name of ["x-success", "x-cancel", "x-error"]) {
      const callback = new URL(link.searchParams.get(name)!);
      expect(callback.origin).to.equal("https://velocireps.vercel.app");
      expect(callback.pathname).to.equal("/apple-health-result.html");
      expect(callback.search).to.not.contain("duration");
      expect(callback.search).to.not.contain("secret");
    }
  });

  it("never treats a launch or an unmatched/empty completion as a successful write", async () => {
    const payload = await AppleHealthShortcut_buildPayload("test", record());
    const store = new Store();
    AppleHealthShortcut_setState(
      payload.exportId,
      { requestId: payload.requestId, status: "pending", attemptedAt: 100 },
      store
    );
    const url = new URL(
      new URL(AppleHealthShortcut_launchUrl(payload, "https://example.com")).searchParams.get("x-success")!
    );
    expect(AppleHealthShortcut_acceptCallback(url, store)).to.equal(undefined);
    url.searchParams.set("result", JSON.stringify({ ...payload, requestId: "old-request", status: "saved" }));
    expect(AppleHealthShortcut_acceptCallback(url, store)).to.equal(undefined);
    expect(AppleHealthShortcut_getState(payload.exportId, store)?.status).to.equal("pending");
    url.searchParams.set(
      "result",
      JSON.stringify({ exportId: payload.exportId, requestId: payload.requestId, status: "alreadySaved" })
    );
    expect(AppleHealthShortcut_acceptCallback(url, store)).to.equal("saved");
    expect(AppleHealthShortcut_acceptCallback(url, store)).to.equal(undefined);
  });

  it("records cancellation/error while preserving the workout's retry identity", async () => {
    const payload = await AppleHealthShortcut_buildPayload("test", record());
    for (const [name, expected] of [
      ["x-cancel", "cancelled"],
      ["x-error", "failed"],
    ]) {
      const store = new Store();
      AppleHealthShortcut_setState(
        payload.exportId,
        { requestId: payload.requestId, status: "pending", attemptedAt: 100 },
        store
      );
      const url = new URL(
        new URL(AppleHealthShortcut_launchUrl(payload, "https://example.com")).searchParams.get(name)!
      );
      expect(AppleHealthShortcut_acceptCallback(url, store)).to.equal(expected);
      expect(AppleHealthShortcut_getState(payload.exportId, store)?.requestId).to.equal(payload.requestId);
    }
  });
});
