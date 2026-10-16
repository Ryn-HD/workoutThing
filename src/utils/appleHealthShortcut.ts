import { Platform } from "react-native";
import type { IHistoryRecord } from "../types";
import { Platform_isiOS } from "./platform";
import { SendMessage_isAndroid, SendMessage_isIos } from "./sendMessage";

export const AppleHealthShortcut_name = "VelociReps Log Workout";
export const AppleHealthShortcut_event = "velocireps-apple-health-change";
const enabledKey = "velocireps:apple-health-shortcut:enabled";
const statePrefix = "velocireps:apple-health-shortcut:workout:";

export interface IAppleHealthShortcutPayload {
  version: 2;
  startDate: string;
  durationSeconds: number;
  energyKcal: number;
}

export interface IAppleHealthShortcutState {
  status: "sent";
  sentAt: number;
}

type IStore = Pick<Storage, "getItem" | "setItem">;

function changed(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AppleHealthShortcut_event));
  }
}

export function AppleHealthShortcut_isEligible(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    Platform_isiOS() &&
    /iPhone/i.test(window.navigator.userAgent) &&
    !SendMessage_isIos() &&
    !SendMessage_isAndroid()
  );
}

// Sending on Finish is on until the user turns it off, so a fresh install of the
// web app needs no settings visit after installing the Shortcut.
export function AppleHealthShortcut_isEnabled(store?: IStore): boolean {
  try {
    return (store ?? window.localStorage).getItem(enabledKey) !== "false";
  } catch {
    return false;
  }
}

export function AppleHealthShortcut_setEnabled(enabled: boolean, store: IStore = window.localStorage): void {
  store.setItem(enabledKey, String(enabled));
  changed();
}

export function AppleHealthShortcut_getState(recordId: number, store?: IStore): IAppleHealthShortcutState | undefined {
  try {
    const state = JSON.parse((store ?? window.localStorage).getItem(statePrefix + recordId) ?? "null");
    if (state && state.status === "sent" && Number.isFinite(state.sentAt)) {
      return state;
    }
  } catch {
    // Corrupt or unavailable device storage must never imply a successful export.
  }
  return undefined;
}

export function AppleHealthShortcut_setState(
  recordId: number,
  state: IAppleHealthShortcutState,
  store: IStore = window.localStorage
): void {
  store.setItem(statePrefix + recordId, JSON.stringify(state));
  changed();
}

export function AppleHealthShortcut_recordTimes(record: Pick<IHistoryRecord, "startTime" | "endTime" | "intervals">): {
  startDate: string;
  durationSeconds: number;
  energyKcal: number;
} {
  const intervals = record.intervals ?? [];
  const closedEnds = intervals
    .map((interval) => interval[1])
    .filter((end): end is number => end != null && Number.isFinite(end));
  const endTime = record.endTime ?? (closedEnds.length ? Math.max(...closedEnds) : undefined);
  if (
    !Number.isFinite(record.startTime) ||
    endTime == null ||
    !Number.isFinite(endTime) ||
    endTime < record.startTime
  ) {
    throw new Error("This workout needs a valid start and end time before it can be sent to Health.");
  }
  // Timer metadata may be missing or stale on saved records. Recover it using
  // the saved session bounds, never today's clock or exercise completion flags.
  // Older finish logic closed the last interval after capturing endTime.
  const ranges = intervals
    .flatMap(([start, end]) => {
      if (!Number.isFinite(start) || (end != null && !Number.isFinite(end))) {
        return [];
      }
      const from = Math.max(record.startTime, start);
      const to = Math.min(endTime, end ?? endTime);
      return to > from ? [[from, to] as [number, number]] : [];
    })
    .sort((a, b) => a[0] - b[0]);
  let previousEnd = record.startTime;
  let durationMs = 0;
  for (const [start, end] of ranges) {
    durationMs += Math.max(0, end - Math.max(start, previousEnd));
    previousEnd = Math.max(previousEnd, end);
  }
  if (!ranges.length) {
    durationMs = endTime - record.startTime;
  }
  return {
    // Shortcuts parses ISO 8601 for the Log Workout date. Whole seconds keep the
    // string in the form Apple's date parser documents, with no fraction.
    startDate: new Date(Math.floor(record.startTime / 1000) * 1000).toISOString().replace(".000Z", "Z"),
    durationSeconds: Math.max(1, Math.floor(durationMs / 1000)),
    energyKcal: Math.floor(durationMs / 60000) * 6,
  };
}

export function AppleHealthShortcut_buildPayload(
  record: Pick<IHistoryRecord, "startTime" | "endTime" | "intervals">
): IAppleHealthShortcutPayload {
  return { version: 2, ...AppleHealthShortcut_recordTimes(record) };
}

// The Finish tap sends the in-memory workout. Its open interval is clipped at
// `now`, which is the end time History_finishProgramDay commits a moment later.
export function AppleHealthShortcut_finishPayload(
  progress: Pick<IHistoryRecord, "startTime" | "intervals">,
  now: number
): IAppleHealthShortcutPayload {
  return AppleHealthShortcut_buildPayload({
    startTime: progress.startTime,
    endTime: now,
    intervals: progress.intervals,
  });
}

export function AppleHealthShortcut_launchUrl(payload: IAppleHealthShortcutPayload): string {
  const url = new URL("shortcuts://run-shortcut");
  url.searchParams.set("name", AppleHealthShortcut_name);
  url.searchParams.set("input", "text");
  url.searchParams.set("text", JSON.stringify(payload));
  // Shortcuts decodes percent escapes, but treats form-encoded '+' as a
  // literal plus. Encode spaces as %20 in both the name and JSON payload.
  // Real plus characters already encoded as %2B must remain unchanged.
  url.search = url.searchParams.toString().replace(/\+/g, "%20");
  return url.toString();
}

export interface IFinishLaunchArgs {
  progress: Pick<IHistoryRecord, "id" | "startTime" | "intervals">;
  isCurrent: boolean;
  eligible: boolean;
  enabled: boolean;
  alreadySent: boolean;
  now: number;
}

// Returns the URL to open from the Finish tap, or undefined when Finish should
// behave as before. Must stay synchronous: iOS only opens another app's URL
// scheme inside the tap that requested it.
export function AppleHealthShortcut_finishLaunch(args: IFinishLaunchArgs): string | undefined {
  if (!args.isCurrent || !args.eligible || !args.enabled || args.alreadySent) {
    return undefined;
  }
  try {
    return AppleHealthShortcut_launchUrl(AppleHealthShortcut_finishPayload(args.progress, args.now));
  } catch {
    return undefined;
  }
}

export function AppleHealthShortcut_sendOnFinish(progress: IHistoryRecord, isCurrent: boolean): boolean {
  const eligible = AppleHealthShortcut_isEligible();
  const now = Date.now();
  const url = AppleHealthShortcut_finishLaunch({
    progress,
    isCurrent,
    eligible,
    enabled: eligible && AppleHealthShortcut_isEnabled(),
    alreadySent: eligible && AppleHealthShortcut_getState(progress.id) != null,
    now,
  });
  if (url == null) {
    return false;
  }
  try {
    AppleHealthShortcut_setState(progress.id, { status: "sent", sentAt: now });
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
}
