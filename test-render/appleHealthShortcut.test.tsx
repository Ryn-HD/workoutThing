/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { AppleHealthShortcutAction } from "../src/components/appleHealthShortcut";
import { AppleHealthShortcut_getState, AppleHealthShortcut_setState } from "../src/utils/appleHealthShortcut";
import type { IHistoryRecord } from "../src/types";
import { FrameLoop_cancelAll } from "./setup/frameLoop";

jest.mock("../src/utils/platform", () => ({ Platform_isiOS: () => true }));
jest.mock("../src/utils/sendMessage", () => ({ SendMessage_isIos: () => false, SendMessage_isAndroid: () => false }));
jest.mock("../src/utils/dialog", () => ({ Dialog_alert: jest.fn() }));
jest.mock("../src/components/groupHeader", () => ({ GroupHeader: () => null }));
jest.mock("../src/components/primitives/text", () => ({ Text: require("react-native").Text }));
jest.mock("../src/components/button", () => ({
  Button: (props: any) => {
    const React = require("react");
    const { Pressable, Text } = require("react-native");
    return React.createElement(
      Pressable,
      { testID: props.name, onPress: props.onPress, disabled: props.disabled },
      React.createElement(Text, null, props.children)
    );
  },
}));
jest.mock("../src/components/linkButton", () => ({ LinkButton: require("../src/components/button").Button }));

const workout = { id: 1, startTime: 1, endTime: 600001 } as IHistoryRecord;
let save: jest.Mock;
let assign: jest.Mock;
let confirm: jest.Mock;
let storage: Storage;
let originalWindow: any;
let originalDocument: any;
let originalOS: string;
let pending: Promise<unknown>[];

function dispatch(thunk: any): void {
  pending.push(
    thunk(jest.fn(), () => ({ storage: { history: [workout], tempUserId: "test" } }), {
      persistence: { saveForHandoff: save },
    })
  );
}
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.all(pending);
  });
}

beforeEach(() => {
  originalWindow = global.window;
  originalDocument = global.document;
  originalOS = Platform.OS;
  Platform.OS = "web";
  pending = [];
  const items = new Map<string, string>();
  storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  } as any;
  assign = jest.fn();
  confirm = jest.fn(() => true);
  (global as any).window = Object.assign(new EventTarget(), {
    localStorage: storage,
    navigator: { userAgent: "iPhone" },
    location: { origin: "https://example.com", assign },
    confirm,
  });
  (global as any).document = new EventTarget();
  save = jest.fn().mockResolvedValue(undefined);
});
afterEach(() => {
  FrameLoop_cancelAll();
  (global as any).window = originalWindow;
  (global as any).document = originalDocument;
  Platform.OS = originalOS as typeof Platform.OS;
});

it("waits for durable saving, requires a tap, blocks double taps, and remembers the send", async () => {
  let finish!: () => void;
  save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.getByTestId("apple-health-shortcut-send")).toBeDisabled();
  expect(assign).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await Promise.all(pending);
  });
  expect(screen.getByTestId("apple-health-shortcut-send")).toBeEnabled();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  expect(assign).toHaveBeenCalledTimes(1);
  const launch = new URL(assign.mock.calls[0][0]);
  expect(launch.protocol).toBe("shortcuts:");
  expect(launch.searchParams.get("input")).toBe("text");
  expect(JSON.parse(launch.searchParams.get("text")!)).toEqual({
    version: 2,
    startDate: "1970-01-01T00:00:00Z",
    durationSeconds: 600,
    energyKcal: 60,
  });
  expect(AppleHealthShortcut_getState(workout.id, storage)?.status).toBe("sent");
  expect(screen.getByText("Send to Apple Health again")).toBeTruthy();
});

it("asks before sending a workout that was already sent", async () => {
  AppleHealthShortcut_setState(workout.id, { status: "sent", sentAt: 5000 }, storage);
  confirm.mockReturnValueOnce(false);
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  await settle();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(assign).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  expect(assign).toHaveBeenCalledTimes(1);
});

it("keeps a save failure visible and retries before enabling send", async () => {
  save.mockRejectedValueOnce(new Error("Disk full"));
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  await settle();
  expect(screen.getByText("Disk full")).toBeTruthy();
  expect(assign).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-retry-save"));
  await settle();
  expect(screen.getByTestId("apple-health-shortcut-send")).toBeEnabled();
  expect(save).toHaveBeenCalledTimes(2);
});

it("refuses a stale or uncommitted record instead of sending another workout", async () => {
  await render(<AppleHealthShortcutAction record={{ ...workout, id: 2 }} dispatch={dispatch} />);
  await settle();
  expect(screen.getByText("This workout hasn't been saved yet. Save it before sending to Health.")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
});

it("renders nothing outside the iPhone web app", async () => {
  Platform.OS = "ios";
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.queryByTestId("apple-health-shortcut-action")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("does not access browser APIs when mounted in the native app", async () => {
  Platform.OS = "ios";
  (global as any).window = global;
  (global as any).document = undefined;
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.queryByTestId("apple-health-shortcut-action")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("uses the latest saved record even if the rendered reference is an older copy", async () => {
  await render(
    <AppleHealthShortcutAction record={{ ...workout, endTime: workout.endTime! - 1000 }} dispatch={dispatch} />
  );
  await settle();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  const payload = JSON.parse(new URL(assign.mock.calls[0][0]).searchParams.get("text")!);
  expect(payload.durationSeconds).toBe(600);
});
