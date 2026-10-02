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
  audioSession?: {
    type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
    state?: "inactive" | "active" | "interrupted";
    addEventListener?: (event: string, listener: () => void) => void;
  };
}

const SOUND_NAMES: ISoundName[] = ["notification", "set-timer-end", "get-ready-end"];

const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"];

const RESUME_TIMEOUT_MS = 300;
const CLOCK_CHECK_MS = 80;
// 10ms of unmuted PCM silence. Muted autoplay does not unlock later audible media on Safari.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

async function withTimeout(operation: Promise<unknown>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation.catch(() => undefined),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, RESUME_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

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
  private needsContextReset = false;
  private generation = 0;
  private recovery: Promise<void> | undefined;
  private sessionWasInterrupted = false;

  constructor(private readonly timer: ITimerBridge) {
    if (typeof window !== "undefined") {
      // By default iOS gives page audio a non-mixable session, so Spotify or a podcast playing in the
      // background interrupts it and the chime never sounds. "transient" marks it as a short notification
      // that plays over other audio, like a native alarm.
      this.configureSession();
      (navigator as INavigatorWithAudioSession).audioSession?.addEventListener?.("statechange", this.onSessionChange);
      // Kept attached for the page's lifetime: iOS re-suspends the context after interruptions
      // (backgrounding, calls), and only a user gesture can resume it again.
      for (const event of UNLOCK_EVENTS) {
        window.addEventListener(event, this.unlock, { capture: true, passive: true });
      }
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      window.addEventListener("pagehide", this.onBackground);
      window.addEventListener("blur", this.onBackground);
      window.addEventListener("pageshow", this.onForeground);
      window.addEventListener("focus", this.onForeground);
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
    if (document.hidden) {
      return;
    }
    this.configureSession();
    if (this.needsContextReset || this.context?.state === "closed") {
      // Safari can report "running" while producing no sound after an app switch. Recreate inside
      // the gesture, not after awaiting resume(), when the browser's activation may have expired.
      const previous = this.context;
      this.context = undefined;
      this.buffers.clear();
      this.recovery = undefined;
      this.generation += 1;
      this.isUnlocked = false;
      this.needsContextReset = false;
      if (previous != null) {
        previous.onstatechange = null;
        previous.close().catch(() => undefined);
      }
    }
    const context = this.getContext();
    if (this.isUnlocked && context != null && isRunning(context)) {
      return;
    }
    context?.resume().catch(() => undefined);
    // iOS keeps Web Audio muted until a source is started synchronously inside a user gesture,
    // after which timers can play sounds from non-gesture callbacks.
    if (context != null) {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(context.destination);
      source.onended = () => source.disconnect();
      source.start(0);
    }
    if (!this.isUnlocked) {
      for (const sound of SOUND_NAMES) {
        this.loadBuffer(sound).catch(() => undefined);
        this.primeElement(sound);
      }
    }
    this.isUnlocked = true;
  };

  private configureSession(): void {
    try {
      const session = (navigator as INavigatorWithAudioSession).audioSession;
      if (session != null) {
        session.type = "transient";
      }
    } catch (_e) {
      // AudioSession is experimental; failure must not disable either playback path.
    }
  }

  private invalidate(): void {
    this.isUnlocked = false;
    this.needsContextReset = this.context != null;
    this.generation += 1;
    this.recovery = undefined;
    for (const element of this.elements.values()) {
      element.pause();
    }
  }

  private readonly onBackground = (): void => {
    this.invalidate();
    // Release audio before another app takes it. resume() alone can leave Safari silently stuck.
    if (this.context != null && this.context.state !== "closed") {
      this.context.suspend().catch(() => undefined);
    }
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onBackground();
    } else {
      this.onForeground();
    }
  };

  private readonly onSessionChange = (): void => {
    if ((navigator as INavigatorWithAudioSession).audioSession?.state === "interrupted") {
      this.sessionWasInterrupted = true;
      this.invalidate();
    } else if (this.sessionWasInterrupted) {
      this.sessionWasInterrupted = false;
      this.onForeground();
    }
  };

  private readonly onContextChange = (): void => {
    // Do not treat our own suspend/resume cycle as a new interruption.
    if (this.isUnlocked && this.context != null && !isRunning(this.context)) {
      this.invalidate();
    }
  };

  private readonly onForeground = (): void => {
    const context = this.context;
    if (document.hidden || context == null || context.state === "closed" || !this.needsContextReset || this.recovery) {
      return;
    }
    this.configureSession();
    const generation = this.generation;
    const recovery = this.restoreContext(context, generation).catch(() => undefined);
    this.recovery = recovery;
    recovery.finally(() => {
      if (this.recovery === recovery) {
        this.recovery = undefined;
      }
    });
  };

  private async restoreContext(context: AudioContext, generation: number): Promise<void> {
    // Best effort without a tap. Always cycle even a "running" context; keep the reset flag so the
    // next gesture rebuilds it regardless of Safari's reported state or clock progress.
    await withTimeout(context.suspend());
    if (this.isCurrent(generation) && this.context === context) {
      await withTimeout(context.resume());
    }
  }

  private isCurrent(generation: number): boolean {
    return !document.hidden && generation === this.generation;
  }

  private getContext(): AudioContext | undefined {
    if (this.context == null && typeof window !== "undefined" && typeof window.AudioContext === "function") {
      this.context = new window.AudioContext();
      this.context.onstatechange = this.onContextChange;
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
        if (this.buffers.get(sound) === promise) {
          this.buffers.delete(sound);
        }
        throw e;
      });
    this.buffers.set(sound, promise);
    return promise;
  }

  // Keep the same elements and play unmuted silence inside each recovery gesture. A muted chime
  // followed by unmuting outside a gesture can still be blocked by Safari's autoplay policy.
  private primeElement(sound: ISoundName): void {
    const element = this.elements.get(sound) ?? new Audio();
    const generation = this.generation;
    element.src = SILENT_WAV;
    element.preload = "auto";
    element.muted = false;
    element
      .play()
      .then(() => {
        if (this.isCurrent(generation) && element.src === SILENT_WAV) {
          element.pause();
          element.src = soundUrl(sound);
          element.load();
        }
      })
      .catch(() => undefined);
    this.elements.set(sound, element);
  }

  private async playSound(sound: ISoundName, volume: number): Promise<void> {
    const generation = this.generation;
    if (!this.isCurrent(generation)) {
      return;
    }
    this.configureSession();
    await this.recovery;
    if (!this.isCurrent(generation)) {
      return;
    }
    const context = this.getContext();
    try {
      if (context != null && (await this.ensureRunning(context))) {
        const buffer = await this.loadBuffer(sound);
        if (!this.isCurrent(generation) || this.context !== context || !isRunning(context)) {
          return;
        }
        const gain = context.createGain();
        gain.gain.value = Math.min(1, Math.max(0, volume));
        gain.connect(context.destination);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
        };
        source.start(0);
        return;
      }
    } catch (_e) {
      // Fetch/decode/Web Audio failures should still try the already-unlocked media element.
    }
    if (!this.isCurrent(generation)) {
      return;
    }
    const element = this.elements.get(sound) ?? new Audio(soundUrl(sound));
    if (element.src === SILENT_WAV) {
      element.src = soundUrl(sound);
    }
    element.muted = false;
    element.volume = Math.min(1, Math.max(0, volume));
    element.currentTime = 0;
    await element.play();
  }

  // An interrupted iOS context's resume() can stay pending forever outside a user gesture, so it gets a
  // deadline rather than being awaited directly.
  private async ensureRunning(context: AudioContext): Promise<boolean> {
    if (!isRunning(context)) {
      await withTimeout(context.resume());
    }
    if (isRunning(context) && this.needsContextReset) {
      const time = context.currentTime;
      await new Promise((resolve) => setTimeout(resolve, CLOCK_CHECK_MS));
      return isRunning(context) && context.currentTime > time;
    }
    return isRunning(context);
  }
}
