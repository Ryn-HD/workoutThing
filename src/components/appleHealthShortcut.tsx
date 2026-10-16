import { JSX, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Text } from "./primitives/text";
import { Button } from "./button";
import { LinkButton } from "./linkButton";
import { GroupHeader } from "./groupHeader";
import { Dialog_alert } from "../utils/dialog";
import type { IHistoryRecord } from "../types";
import type { IDispatch } from "../ducks/types";
import {
  AppleHealthShortcut_buildPayload,
  AppleHealthShortcut_event,
  AppleHealthShortcut_getState,
  AppleHealthShortcut_isEligible,
  AppleHealthShortcut_isEnabled,
  AppleHealthShortcut_launchUrl,
  AppleHealthShortcut_setEnabled,
  AppleHealthShortcut_setState,
  IAppleHealthShortcutPayload,
  IAppleHealthShortcutState,
} from "../utils/appleHealthShortcut";

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
        Tapping Finish opens the VelociReps Log Workout Shortcut, which logs the workout in Apple Health. Install the
        Shortcut once. A saved workout can also be sent from its Share menu.
      </Text>
      <LinkButton
        name="apple-health-shortcut-install"
        onPress={() => {
          window.location.assign("/apple-health-setup.html");
        }}
      >
        Install the Shortcut & help
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
          {enabled ? "Stop sending when I tap Finish" : "Send to Apple Health when I tap Finish"}
        </Button>
      </View>
      <Text className="text-xs text-text-secondary pb-3">This setting applies to this device and browser.</Text>
    </View>
  );
}

interface IActionProps {
  record: IHistoryRecord;
  dispatch: IDispatch;
}

export function AppleHealthShortcutAction(props: IActionProps): JSX.Element | null {
  const [payload, setPayload] = useState<IAppleHealthShortcutPayload>();
  const [error, setError] = useState<string>();
  const [state, setState] = useState<IAppleHealthShortcutState>();
  const [attempt, setAttempt] = useState(0);
  const launching = useRef(false);
  const available = AppleHealthShortcut_isEligible();
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
        const prepared = AppleHealthShortcut_buildPayload(record);
        if (active) {
          setState(AppleHealthShortcut_getState(record.id));
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
      setState(AppleHealthShortcut_getState(props.record.id));
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
  }, [payload, props.record.id]);

  if (!available) {
    return null;
  }
  const sent = state?.status === "sent";
  return (
    <View className="pt-4 gap-3" testID="apple-health-shortcut-action">
      <Text className="text-sm text-text-secondary">
        {sent
          ? `Sent to Apple Health through Shortcuts at ${new Date(state!.sentAt).toLocaleTimeString()}. If Shortcuts showed an error, check Health, then send again.`
          : "Sends this saved workout to Apple Health through the VelociReps Log Workout Shortcut."}
      </Text>
      {error ? (
        <>
          <Text className="text-sm text-text-error">{error}</Text>
          <Button name="apple-health-shortcut-retry-save" kind="purple" onPress={() => setAttempt(attempt + 1)}>
            Try again
          </Button>
        </>
      ) : (
        <Button
          kind={sent ? "grayv2" : "purple"}
          name="apple-health-shortcut-send"
          disabled={!payload}
          onPress={() => {
            if (!payload || launching.current) {
              return;
            }
            if (
              sent &&
              !window.confirm(
                "This workout was already sent. Sending again can create a duplicate in Health. Send again?"
              )
            ) {
              return;
            }
            try {
              // Preserve the gesture: all asynchronous saving was done before enabling this button.
              launching.current = true;
              AppleHealthShortcut_setState(props.record.id, { status: "sent", sentAt: Date.now() });
              window.location.assign(AppleHealthShortcut_launchUrl(payload));
              setTimeout(() => {
                launching.current = false;
              }, 1500);
            } catch {
              launching.current = false;
              setError("Couldn't open Shortcuts. Your workout is still saved. Try again, or open Apple Health help.");
            }
          }}
        >
          {!payload ? "Saving workout…" : sent ? "Send to Apple Health again" : "Send to Apple Health"}
        </Button>
      )}
      <LinkButton name="apple-health-shortcut-help" onPress={() => window.location.assign("/apple-health-setup.html")}>
        Apple Health help
      </LinkButton>
    </View>
  );
}
