import { JSX, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Text } from "./primitives/text";
import { Button } from "./button";
import { LinkButton } from "./linkButton";
import { GroupHeader } from "./groupHeader";
import { Dialog_alert } from "../utils/dialog";
import { Platform_isiOS } from "../utils/platform";
import { SendMessage_isIos, SendMessage_isAndroid } from "../utils/sendMessage";
import type { IHistoryRecord } from "../types";
import type { IDispatch } from "../ducks/types";
import {
  AppleHealthShortcut_buildPayload,
  AppleHealthShortcut_event,
  AppleHealthShortcut_getState,
  AppleHealthShortcut_isEnabled,
  AppleHealthShortcut_launchUrl,
  AppleHealthShortcut_setEnabled,
  AppleHealthShortcut_setState,
  IAppleHealthShortcutPayload,
  IAppleHealthShortcutState,
} from "../utils/appleHealthShortcut";

export function AppleHealthShortcut_isEligible(): boolean {
  return (
    Platform.OS === "web" &&
    Platform_isiOS() &&
    /iPhone/i.test(window.navigator.userAgent) &&
    !SendMessage_isIos() &&
    !SendMessage_isAndroid()
  );
}

export function useAppleHealthShortcutEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const update = (): void => {
      try {
        setEnabled(AppleHealthShortcut_isEnabled());
      } catch {
        setEnabled(false);
      }
    };
    update();
    window.addEventListener(AppleHealthShortcut_event, update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener(AppleHealthShortcut_event, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return enabled;
}

export function AppleHealthShortcutSetup(): JSX.Element | null {
  const enabled = useAppleHealthShortcutEnabled();
  if (!AppleHealthShortcut_isEligible()) {
    return null;
  }
  return (
    <View testID="apple-health-shortcut-setup">
      <GroupHeader name="Apple Health" topPadding={true} />
      <Text className="text-sm text-text-secondary pb-3">
        Install the Shortcut once to send saved workouts to Health. If you already installed it, keep using it. This
        switch only makes Send the main finish-screen action. You can always send a saved workout from Share.
      </Text>
      <LinkButton
        name="apple-health-shortcut-install"
        onPress={() => {
          window.location.assign("/apple-health-setup.html");
        }}
      >
        Shortcut download & help
      </LinkButton>
      <View className="pt-3 pb-2">
        <Button
          kind={enabled ? "grayv2" : "purple"}
          name="apple-health-shortcut-enable"
          onPress={() => {
            try {
              AppleHealthShortcut_setEnabled(!enabled);
            } catch {
              Dialog_alert("Couldn't save this preference. Allow website storage and try again.");
            }
          }}
        >
          {enabled ? "Use Continue as the main finish action" : "Make Send the main finish action"}
        </Button>
      </View>
      <Text className="text-xs text-text-secondary pb-3">This setting applies to this device and browser.</Text>
    </View>
  );
}

interface IActionProps {
  record: IHistoryRecord;
  dispatch: IDispatch;
  onDone?: () => void;
  manual?: boolean;
}

export function AppleHealthShortcutAction(props: IActionProps): JSX.Element | null {
  const enabled = useAppleHealthShortcutEnabled();
  const [payload, setPayload] = useState<IAppleHealthShortcutPayload>();
  const [error, setError] = useState<string>();
  const [state, setState] = useState<IAppleHealthShortcutState>();
  const [attempt, setAttempt] = useState(0);
  const launching = useRef(false);
  const eligible = AppleHealthShortcut_isEligible();
  const available = eligible && (enabled || !!props.manual);
  useEffect(() => {
    if (!available) {
      return;
    }
    let active = true;
    setPayload(undefined);
    setError(undefined);
    launching.current = false;
    props.dispatch(async (_dispatch, getState, env) => {
      try {
        const current = getState();
        const record = current.storage.history.find((item) => item.id === props.record.id);
        if (!record) {
          throw new Error("This workout hasn't been saved yet. Save it before sending to Health.");
        }
        await env.persistence.saveForHandoff(current.user?.id || current.storage.tempUserId, {
          storage: current.storage,
          lastSynced: current.lastSynced,
        });
        const prepared = await AppleHealthShortcut_buildPayload(current.storage.tempUserId, record);
        if (active) {
          setState(AppleHealthShortcut_getState(prepared.exportId));
          setPayload(prepared);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Couldn't save the workout. Please try again.");
        }
      }
    });
    return () => {
      active = false;
    };
  }, [available, props.record, props.dispatch, attempt]);

  useEffect(() => {
    if (!payload) {
      return;
    }
    const update = (): void => {
      setState(AppleHealthShortcut_getState(payload.exportId));
    };
    window.addEventListener("focus", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("storage", update);
    window.addEventListener(AppleHealthShortcut_event, update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("storage", update);
      window.removeEventListener(AppleHealthShortcut_event, update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [payload]);

  if (!available) {
    return null;
  }
  const saved = state?.status === "saved";
  return (
    <View className="pt-4 gap-3" testID="apple-health-shortcut-action">
      <Text className="text-sm text-text-secondary">
        {saved
          ? "Saved to Apple Health."
          : state?.status === "pending"
            ? "Shortcuts was opened. If you didn't see a success message there, check Health before retrying."
            : state?.status === "cancelled"
              ? "Sending was cancelled. Your workout is saved in the app."
              : state?.status === "failed"
                ? "The Shortcut couldn't finish. Check Health before retrying."
                : "Your workout is saved before Shortcuts opens to send it to Apple Health."}
      </Text>
      {error ? (
        <>
          <Text className="text-sm text-text-error">{error}</Text>
          <Button name="apple-health-shortcut-retry-save" kind="purple" onPress={() => setAttempt(attempt + 1)}>
            Try again
          </Button>
        </>
      ) : saved ? (
        props.onDone && (
          <Button kind="purple" name="finish-day-continue" onPress={props.onDone}>
            Continue
          </Button>
        )
      ) : (
        <Button
          kind="purple"
          name="apple-health-shortcut-send"
          disabled={!payload}
          onPress={() => {
            if (!payload || launching.current) {
              return;
            }
            if (state?.status === "pending" || state?.status === "failed") {
              if (
                !window.confirm(
                  "Check Apple Health first. This workout may already be there. Open the Shortcut to check or retry?"
                )
              ) {
                return;
              }
            }
            try {
              const request = { ...payload, requestId: crypto.randomUUID() };
              // Preserve the gesture: all asynchronous saving was done before enabling this button.
              launching.current = true;
              AppleHealthShortcut_setState(request.exportId, {
                requestId: request.requestId,
                status: "pending",
                attemptedAt: Date.now(),
              });
              window.location.assign(AppleHealthShortcut_launchUrl(request, window.location.origin));
              setTimeout(() => {
                launching.current = false;
              }, 1500);
            } catch {
              launching.current = false;
              setError("Couldn't open Shortcuts. Your workout is still saved. Try again, or open Apple Health help.");
            }
          }}
        >
          {!payload ? "Saving workout…" : props.onDone ? "Done & Send to Apple Health" : "Send to Apple Health"}
        </Button>
      )}
      {props.onDone && !saved && (
        <LinkButton name="apple-health-shortcut-skip" onPress={props.onDone}>
          Done without sending
        </LinkButton>
      )}
      {!saved && (
        <LinkButton
          name="apple-health-shortcut-help"
          onPress={() => window.location.assign("/apple-health-setup.html")}
        >
          Apple Health help
        </LinkButton>
      )}
    </View>
  );
}
