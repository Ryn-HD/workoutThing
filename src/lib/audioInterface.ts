import { SendMessage_toIos, SendMessage_toAndroid } from "../utils/sendMessage";

export interface IAudioInterface {
  play(volume: number, vibration: boolean): void;
}

export class MockAudioInterface implements IAudioInterface {
  public play(volume: number, vibration: boolean): void {
    // noop
  }
}

export class AudioInterface implements IAudioInterface {
  private readonly audio: HTMLAudioElement;
  private unlocked = false;

  constructor() {
    this.audio = new Audio("/notification.m4r");
    // iOS Safari (incl. home-screen PWAs) only allows programmatic audio playback after the
    // element has been started once inside a user gesture. The rest-timer fires later, outside
    // any gesture, so prime the element on the first tap/click of the session.
    if (typeof document !== "undefined") {
      const handler = (): void => this.unlock();
      document.addEventListener("touchend", handler, { once: true });
      document.addEventListener("click", handler, { once: true });
    }
  }

  private unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    const prevVolume = this.audio.volume;
    this.audio.volume = 0;
    const playPromise = this.audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.audio.volume = prevVolume;
        })
        .catch(() => {
          this.audio.volume = prevVolume;
        });
    }
  }

  public play(volume: number, vibration: boolean): void {
    if (volume <= 0 && !vibration) {
      return;
    }
    const isPlayed =
      SendMessage_toIos({ type: "playSound", volume: `${volume}`, vibration: vibration ? "true" : "false" }) ||
      SendMessage_toAndroid({ type: "playSound", volume: `${volume}`, vibration: vibration ? "true" : "false" });
    if (!isPlayed) {
      if (volume > 0) {
        this.audio.volume = volume;
        const playPromise = this.audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined);
        }
      }
      if (vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(200);
      }
    }
  }
}
