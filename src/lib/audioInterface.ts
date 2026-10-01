import { ITimerBridge } from "../utils/timerBridge";

// Closed set, because every platform resolves these names separately - web by filename, iOS by bundle
// resource, Android by a `when` over R.raw. An unmapped name doesn't fail there, it plays the wrong sound.
export type ISoundName = "notification" | "set-timer-end" | "get-ready-end";

export interface IAudioInterface {
  play(volume: number, vibration: boolean, sound?: ISoundName): void;
}

export class MockAudioInterface implements IAudioInterface {
  public play(volume: number, vibration: boolean, sound?: ISoundName): void {
    // noop
  }
}

interface INavigatorWithAudioSession extends Navigator {
  audioSession?: { type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record" };
}

const SOUND_NAMES: ISoundName[] = ["notification", "set-timer-end", "get-ready-end"];

const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"];

const RESUME_TIMEOUT_MS = 300;

// MP3 rather than the native .m4r (AAC), which Chromium builds without proprietary codecs can't decode.
function soundUrl(sound: ISoundName): string {
  return `/${sound}.mp3`;
}

function isRunning(context: AudioContext): boolean {
  return context.state === "running";
}

export class AudioInterface implements IAudioInterface {
  private context: AudioContext | undefined;
  private readonly buffers: Map<ISoundName, Promise<AudioBuffer>> = new Map();
  private readonly elements: Map<ISoundName, HTMLAudioElement> = new Map();
  private isUnlocked = false;

  constructor(private readonly timer: ITimerBridge) {
    if (typeof window !== "undefined") {
      // By default iOS gives page audio a non-mixable session, so Spotify or a podcast playing in the
      // background interrupts it and the chime never sounds. "transient" marks it as a short notification
      // that plays over other audio, like a native alarm.
      const audioSession = (navigator as INavigatorWithAudioSession).audioSession;
      if (audioSession != null) {
        audioSession.type = "transient";
      }
      // Kept attached for the page's lifetime: iOS re-suspends the context after interruptions
      // (backgrounding, calls), and only a user gesture can resume it again.
      for (const event of UNLOCK_EVENTS) {
        window.addEventListener(event, this.unlock, { capture: true, passive: true });
      }
    }
  }

  public play(volume: number, vibration: boolean, sound: ISoundName = "notification"): void {
    if (volume <= 0 && !vibration) {
      return;
    }
    if (this.timer.playSound(volume, vibration, sound)) {
      return;
    }
    if (vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([300, 150, 300]);
    }
    if (volume > 0) {
      this.playSound(sound, volume).catch((e) => console.error("Failed to play timer sound:", e));
    }
  }

  private readonly unlock = (): void => {
    const context = this.getContext();
    if (context == null || (this.isUnlocked && context.state === "running")) {
      return;
    }
    context.resume().catch(() => undefined);
    // iOS keeps Web Audio muted until a source is started synchronously inside a user gesture,
    // after which timers can play sounds from non-gesture callbacks.
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, 22050);
    source.connect(context.destination);
    source.start(0);
    if (!this.isUnlocked) {
      for (const sound of SOUND_NAMES) {
        this.loadBuffer(sound).catch(() => undefined);
        this.primeElement(sound);
      }
    }
    this.isUnlocked = true;
  };

  private getContext(): AudioContext | undefined {
    if (this.context == null && typeof window !== "undefined" && typeof window.AudioContext === "function") {
      this.context = new window.AudioContext();
    }
    return this.context;
  }

  private loadBuffer(sound: ISoundName): Promise<AudioBuffer> {
    const existing = this.buffers.get(sound);
    if (existing != null) {
      return existing;
    }
    const context = this.getContext();
    if (context == null) {
      return Promise.reject(new Error("Web Audio is not available"));
    }
    const promise = fetch(soundUrl(sound))
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .catch((e) => {
        this.buffers.delete(sound);
        throw e;
      });
    this.buffers.set(sound, promise);
    return promise;
  }

  // iOS lets a media element play from a timer only once it has played inside a user gesture, so each
  // fallback element is played muted during the unlock tap.
  private primeElement(sound: ISoundName): void {
    const element = new Audio(soundUrl(sound));
    element.preload = "auto";
    element.muted = true;
    element
      .play()
      .then(() => {
        element.pause();
        element.currentTime = 0;
      })
      .catch(() => undefined)
      .finally(() => {
        element.muted = false;
      });
    this.elements.set(sound, element);
  }

  private async playSound(sound: ISoundName, volume: number): Promise<void> {
    const context = this.getContext();
    if (context != null && (await this.ensureRunning(context))) {
      const buffer = await this.loadBuffer(sound);
      const gain = context.createGain();
      gain.gain.value = Math.min(1, Math.max(0, volume));
      gain.connect(context.destination);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(0);
      return;
    }
    const element = this.elements.get(sound) ?? new Audio(soundUrl(sound));
    element.volume = Math.min(1, Math.max(0, volume));
    element.currentTime = 0;
    await element.play();
  }

  // An interrupted iOS context's resume() can stay pending forever outside a user gesture, so it gets a
  // deadline rather than being awaited directly.
  private async ensureRunning(context: AudioContext): Promise<boolean> {
    if (isRunning(context)) {
      return true;
    }
    await Promise.race([
      context.resume().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS)),
    ]);
    return isRunning(context);
  }
}
