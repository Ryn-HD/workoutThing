import type { IHistoryRecord } from "../types";

export const AppleHealthShortcut_name = "VelociReps Log Workout";
export const AppleHealthShortcut_event = "velocireps-apple-health-change";
const enabledKey = "velocireps:apple-health-shortcut:enabled";
const statePrefix = "velocireps:apple-health-shortcut:workout:";

export interface IAppleHealthShortcutPayload {
  version: 1;
  exportId: string;
  requestId: string;
  activity: "Traditional Strength Training";
  startDate: string;
  durationSeconds: number;
  energyKcal: number;
}

export interface IAppleHealthShortcutState {
  requestId: string;
  status: "pending" | "saved" | "cancelled" | "failed";
  attemptedAt: number;
}

type IStore = Pick<Storage, "getItem" | "setItem">;

function changed(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AppleHealthShortcut_event));
  }
}

export function AppleHealthShortcut_isEnabled(store?: IStore): boolean {
  try {
    return (store ?? window.localStorage).getItem(enabledKey) === "true";
  } catch {
    return false;
  }
}

export function AppleHealthShortcut_setEnabled(enabled: boolean, store: IStore = window.localStorage): void {
  store.setItem(enabledKey, String(enabled));
  changed();
}

export function AppleHealthShortcut_getState(exportId: string, store?: IStore): IAppleHealthShortcutState | undefined {
  try {
    const state = JSON.parse((store ?? window.localStorage).getItem(statePrefix + exportId) ?? "null");
    if (
      state &&
      typeof state.requestId === "string" &&
      Number.isFinite(state.attemptedAt) &&
      ["pending", "saved", "cancelled", "failed"].includes(state.status)
    ) {
      return state;
    }
  } catch {
    // Corrupt or unavailable device storage must never imply a successful export.
  }
  return undefined;
}

export function AppleHealthShortcut_setState(
  exportId: string,
  state: IAppleHealthShortcutState,
  store: IStore = window.localStorage
): void {
  store.setItem(statePrefix + exportId, JSON.stringify(state));
  changed();
}

export function AppleHealthShortcut_recordTimes(record: Pick<IHistoryRecord, "startTime" | "endTime" | "intervals">): {
  startDate: string;
  durationSeconds: number;
  energyKcal: number;
} {
  const intervals = record.intervals ?? [[record.startTime, record.endTime]];
  const endTime = record.endTime ?? intervals[intervals.length - 1]?.[1];
  if (
    !Number.isFinite(record.startTime) ||
    endTime == null ||
    !Number.isFinite(endTime) ||
    endTime <= record.startTime
  ) {
    throw new Error("This workout needs a valid start and end time before it can be sent to Health.");
  }
  let previousEnd = record.startTime;
  let durationMs = 0;
  for (const [start, end] of intervals) {
    if (
      !Number.isFinite(start) ||
      end == null ||
      !Number.isFinite(end) ||
      start < previousEnd ||
      end < start ||
      end > endTime
    ) {
      throw new Error("This workout has unfinished or invalid timer intervals.");
    }
    durationMs += end - start;
    previousEnd = end;
  }
  if (durationMs < 1000) {
    throw new Error("A workout must have at least one second of recorded time to send to Health.");
  }
  return {
    startDate: new Date(record.startTime).toISOString(),
    durationSeconds: Math.floor(durationMs / 1000),
    energyKcal: Math.floor(durationMs / 60000) * 6,
  };
}

export async function AppleHealthShortcut_buildPayload(
  accountId: string,
  record: IHistoryRecord
): Promise<IAppleHealthShortcutPayload> {
  const times = AppleHealthShortcut_recordTimes(record);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${accountId}:${record.id}`));
  const exportId = "v1-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    version: 1,
    exportId,
    requestId: crypto.randomUUID(),
    activity: "Traditional Strength Training",
    ...times,
  };
}

export function AppleHealthShortcut_launchUrl(payload: IAppleHealthShortcutPayload, origin: string): string {
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol)) {
    throw new Error("Health handoff requires a web app URL.");
  }
  const url = new URL("shortcuts://x-callback-url/run-shortcut");
  url.searchParams.set("name", AppleHealthShortcut_name);
  url.searchParams.set("input", "text");
  url.searchParams.set("text", JSON.stringify(payload));
  for (const [parameter, outcome] of [
    ["x-success", "success"],
    ["x-cancel", "cancel"],
    ["x-error", "error"],
  ]) {
    const callback = new URL("/apple-health-result.html", base.origin);
    callback.searchParams.set("outcome", outcome);
    callback.searchParams.set("exportId", payload.exportId);
    callback.searchParams.set("requestId", payload.requestId);
    url.searchParams.set(parameter, callback.toString());
  }
  return url.toString();
}

// A successful Shortcut launch is not a successful Health write. Only accept the
// matching Shortcut's structured completion result for a request saved here.
export function AppleHealthShortcut_acceptCallback(
  url: URL,
  store: IStore
): IAppleHealthShortcutState["status"] | undefined {
  const exportId = url.searchParams.get("exportId") ?? "";
  const requestId = url.searchParams.get("requestId");
  const pending = AppleHealthShortcut_getState(exportId, store);
  if (!pending || pending.requestId !== requestId || pending.status !== "pending") {
    return undefined;
  }
  let status: IAppleHealthShortcutState["status"];
  switch (url.searchParams.get("outcome")) {
    case "cancel":
      status = "cancelled";
      break;
    case "error":
      status = "failed";
      break;
    case "success": {
      try {
        const result = JSON.parse(url.searchParams.get("result") ?? "null");
        if (
          result?.exportId !== exportId ||
          result?.requestId !== requestId ||
          !["saved", "alreadySaved"].includes(result?.status)
        ) {
          return undefined;
        }
        status = "saved";
      } catch {
        return undefined;
      }
      break;
    }
    default:
      return undefined;
  }
  AppleHealthShortcut_setState(exportId, { ...pending, status }, store);
  return status;
}
