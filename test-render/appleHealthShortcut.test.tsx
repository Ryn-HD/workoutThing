/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { webcrypto } from "node:crypto";
import { Platform } from "react-native";
import { AppleHealthShortcutAction } from "../src/components/appleHealthShortcut";
import { AppleHealthShortcut_acceptCallback, AppleHealthShortcut_setEnabled } from "../src/utils/appleHealthShortcut";
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
let storage: Storage;
let originalWindow: any;
let originalDocument: any;
let originalCrypto: any;
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
  originalCrypto = global.crypto;
  originalOS = Platform.OS;
  Platform.OS = "web";
  pending = [];
  const items = new Map<string, string>();
  storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  } as any;
  assign = jest.fn();
  (global as any).window = Object.assign(new EventTarget(), {
    localStorage: storage,
    navigator: { userAgent: "iPhone" },
    location: { origin: "https://example.com", assign },
    confirm: jest.fn(() => true),
  });
  (global as any).document = new EventTarget();
  (global as any).crypto = webcrypto;
  save = jest.fn().mockResolvedValue(undefined);
  AppleHealthShortcut_setEnabled(true);
});
afterEach(() => {
  FrameLoop_cancelAll();
  (global as any).window = originalWindow;
  (global as any).document = originalDocument;
  (global as any).crypto = originalCrypto;
  Platform.OS = originalOS as typeof Platform.OS;
});

it("waits for durable saving, requires a tap, blocks double taps, and accepts only confirmed completion", async () => {
  let finish!: () => void;
  save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} onDone={jest.fn()} />);
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
  expect(screen.queryByText("Saved to Apple Health.")).toBeNull();
  const launch = new URL(assign.mock.calls[0][0]);
  const payload = JSON.parse(launch.searchParams.get("text")!);
  const callback = new URL(launch.searchParams.get("x-success")!);
  callback.searchParams.set(
    "result",
    JSON.stringify({ exportId: payload.exportId, requestId: payload.requestId, status: "saved" })
  );
  await act(async () => {
    AppleHealthShortcut_acceptCallback(callback, storage);
  });
  expect(screen.getByText("Saved to Apple Health.")).toBeTruthy();
  expect(screen.queryByTestId("apple-health-shortcut-send")).toBeNull();
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

it("keeps the existing flow when disabled or outside the iPhone web app", async () => {
  AppleHealthShortcut_setEnabled(false);
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.queryByTestId("apple-health-shortcut-action")).toBeNull();
  expect(save).not.toHaveBeenCalled();
  Platform.OS = "ios";
  await act(async () => {
    AppleHealthShortcut_setEnabled(true);
  });
  await screen.rerender(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.queryByTestId("apple-health-shortcut-action")).toBeNull();
});

it("does not access browser APIs when mounted in the native app", async () => {
  Platform.OS = "ios";
  (global as any).window = global;
  (global as any).document = undefined;
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} />);
  expect(screen.queryByTestId("apple-health-shortcut-action")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("can send from a saved workout when this browser has no setup flag", async () => {
  AppleHealthShortcut_setEnabled(false);
  await render(<AppleHealthShortcutAction record={workout} dispatch={dispatch} manual={true} />);
  await settle();
  expect(screen.getByTestId("apple-health-shortcut-send")).toBeEnabled();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  expect(assign).toHaveBeenCalledTimes(1);
  expect(new URL(assign.mock.calls[0][0]).protocol).toBe("shortcuts:");
});

it("uses the latest saved record even if the rendered reference is an older copy", async () => {
  await render(
    <AppleHealthShortcutAction
      record={{ ...workout, endTime: workout.endTime! - 1000 }}
      dispatch={dispatch}
      manual={true}
    />
  );
  await settle();
  await fireEvent.press(screen.getByTestId("apple-health-shortcut-send"));
  const payload = JSON.parse(new URL(assign.mock.calls[0][0]).searchParams.get("text")!);
  expect(payload.durationSeconds).toBe(600);
});
