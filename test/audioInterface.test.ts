import "mocha";
import { expect } from "chai";
import sinon from "sinon";
import { AudioInterface } from "../src/lib/audioInterface";
import { ITimerBridge } from "../src/utils/timerBridge";

class TestAudioContext {
  public static instances: TestAudioContext[] = [];
  public state = "suspended";
  public frozen = false;
  public onstatechange: (() => void) | null = null;
  public destination = {};
  public audibleStarts = 0;
  public get currentTime(): number {
    return this.frozen ? 0 : Date.now() / 1000;
  }
  public resume = sinon.stub().callsFake(async () => {
    if (!this.frozen) {
      this.state = "running";
    }
  });
  public suspend = sinon.stub().callsFake(async () => {
    if (!this.frozen) {
      this.state = "suspended";
    }
  });
  public close = sinon.stub().callsFake(async () => {
    this.state = "closed";
  });
  public decodeAudioData = sinon.stub().resolves({ silent: false });
  public createBuffer(): { silent: boolean } {
    return { silent: true };
  }
  public createGain(): object {
    return { gain: { value: 1 }, connect: sinon.spy(), disconnect: sinon.spy() };
  }
  public createBufferSource(): object {
    const source = {
      buffer: { silent: false },
      connect: sinon.spy(),
      disconnect: sinon.spy(),
      start: () => {
        if (!source.buffer.silent) {
          this.audibleStarts += 1;
        }
      },
    };
    return source;
  }
  constructor() {
    TestAudioContext.instances.push(this);
  }
}

class TestAudioElement {
  public static instances: TestAudioElement[] = [];
  public src: string;
  public muted = false;
  public volume = 1;
  public currentTime = 0;
  public preload = "";
  public plays: { src: string; muted: boolean; volume: number }[] = [];
  public play = sinon.stub().callsFake(async () => {
    this.plays.push({ src: this.src, muted: this.muted, volume: this.volume });
  });
  public pause = sinon.spy();
  public load = sinon.spy();
  constructor(src = "") {
    this.src = src;
    TestAudioElement.instances.push(this);
  }
}

class TestSession extends EventTarget {
  public type = "auto";
  public state = "inactive";
}

describe("web timer audio recovery", () => {
  let clock: sinon.SinonFakeTimers;
  let browser: EventTarget & { AudioContext?: typeof TestAudioContext };
  let page: EventTarget & { hidden: boolean };
  let session: TestSession;
  let audio: AudioInterface;
  let fetchAudio: sinon.SinonStub;
  let nativePlay: sinon.SinonStub;
  let errors: sinon.SinonStub;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();

  function setGlobal(name: string, value: unknown): void {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  function tap(): void {
    browser.dispatchEvent(new Event("touchend"));
  }

  function setHidden(hidden: boolean): void {
    page.hidden = hidden;
    page.dispatchEvent(new Event("visibilitychange"));
  }

  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: 1000 });
    TestAudioContext.instances = [];
    TestAudioElement.instances = [];
    browser = Object.assign(new EventTarget(), { AudioContext: TestAudioContext });
    page = Object.assign(new EventTarget(), { hidden: false });
    session = new TestSession();
    fetchAudio = sinon.stub().resolves({ arrayBuffer: async () => new ArrayBuffer(1) });
    nativePlay = sinon.stub().returns(false);
    errors = sinon.stub(console, "error");
    setGlobal("window", browser);
    setGlobal("document", page);
    setGlobal("navigator", { audioSession: session, vibrate: sinon.spy() });
    setGlobal("Audio", TestAudioElement);
    setGlobal("fetch", fetchAudio);
    const bridge: ITimerBridge = {
      playSound: nativePlay,
      startTimer: () => undefined,
      stopTimer: () => undefined,
      subscribeOnScheduled: () => () => undefined,
      scheduleReminder: () => undefined,
      cancelReminder: () => undefined,
    };
    audio = new AudioInterface(bridge);
  });

  afterEach(async () => {
    await clock.tickAsync(1000);
    expect(errors.callCount).to.equal(0);
    errors.restore();
    clock.restore();
    for (const [name, descriptor] of descriptors) {
      if (descriptor != null) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
    descriptors.clear();
  });

  it("plays every timer sound after the first tap and reuses a healthy context", async () => {
    tap();
    await clock.tickAsync(0);
    for (const sound of ["notification", "set-timer-end", "get-ready-end"] as const) {
      audio.play(0.7, false, sound);
      await clock.tickAsync(0);
      tap();
    }
    expect(TestAudioContext.instances).to.have.length(1);
    expect(TestAudioContext.instances[0].audibleStarts).to.equal(3);
    expect(fetchAudio.callCount).to.equal(3);
    expect(session.type).to.equal("transient");
    expect(TestAudioElement.instances.every((element) => !element.plays[0].muted)).to.equal(true);
  });

  it("suspends on exit and automatically resumes on return before another tap", async () => {
    tap();
    await clock.tickAsync(0);
    const context = TestAudioContext.instances[0];
    setHidden(true);
    expect(context.suspend.calledOnce).to.equal(true);
    session.type = "auto";
    setHidden(false);
    browser.dispatchEvent(new Event("focus"));
    await clock.tickAsync(0);
    expect(context.resume.callCount).to.equal(2);
    expect(session.type).to.equal("transient");
    audio.play(1, false);
    await clock.tickAsync(100);
    expect(context.audibleStarts).to.equal(1);
  });

  it("rebuilds even a falsely-running context synchronously on the first returning tap", async () => {
    tap();
    await clock.tickAsync(0);
    const oldContext = TestAudioContext.instances[0];
    oldContext.frozen = true;
    setHidden(true);
    setHidden(false);
    // Do not await recovery: unlocking a replacement must happen inside this exact gesture.
    tap();
    expect(oldContext.close.calledOnce).to.equal(true);
    expect(TestAudioContext.instances).to.have.length(2);
    expect(TestAudioContext.instances[1].resume.calledOnce).to.equal(true);
    await clock.tickAsync(1000);
    audio.play(1, false);
    await clock.tickAsync(0);
    expect(TestAudioContext.instances[1].audibleStarts).to.equal(1);
    expect(TestAudioElement.instances).to.have.length(3);
    expect(TestAudioElement.instances.every((element) => element.play.callCount === 2)).to.equal(true);
  });

  it("recovers repeatedly across app switches and page-cache restoration", async () => {
    tap();
    await clock.tickAsync(0);
    for (let i = 0; i < 3; i += 1) {
      browser.dispatchEvent(new Event("pagehide"));
      browser.dispatchEvent(new Event("pageshow"));
      tap();
      await clock.tickAsync(0);
      audio.play(1, false);
      await clock.tickAsync(0);
      expect(TestAudioContext.instances[i + 1].audibleStarts).to.equal(1);
      expect(TestAudioContext.instances[i].close.calledOnce).to.equal(true);
    }
  });

  it("re-arms after an alarm/call interrupts audio without hiding the page", async () => {
    tap();
    await clock.tickAsync(0);
    session.state = "interrupted";
    session.dispatchEvent(new Event("statechange"));
    session.state = "inactive";
    session.dispatchEvent(new Event("statechange"));
    tap();
    await clock.tickAsync(0);
    audio.play(1, false);
    await clock.tickAsync(0);
    expect(TestAudioContext.instances).to.have.length(2);
    expect(TestAudioContext.instances[1].audibleStarts).to.equal(1);
  });

  it("rebuilds after an interrupted AudioContext even without AudioSession events", async () => {
    tap();
    await clock.tickAsync(0);
    const context = TestAudioContext.instances[0];
    context.state = "interrupted";
    context.onstatechange?.();
    tap();
    await clock.tickAsync(0);
    audio.play(1, false);
    await clock.tickAsync(0);
    expect(TestAudioContext.instances).to.have.length(2);
    expect(TestAudioContext.instances[1].audibleStarts).to.equal(1);
  });

  it("uses the media fallback if suspend/resume never settle", async () => {
    tap();
    await clock.tickAsync(0);
    const context = TestAudioContext.instances[0];
    context.frozen = true;
    context.state = "interrupted";
    context.suspend.callsFake(() => new Promise(() => undefined));
    context.resume.callsFake(() => new Promise(() => undefined));
    setHidden(true);
    setHidden(false);
    audio.play(0.5, false, "set-timer-end");
    await clock.tickAsync(1000);
    const element = TestAudioElement.instances[1];
    expect(element.plays[element.plays.length - 1]).to.deep.equal({
      src: "/set-timer-end.mp3",
      muted: false,
      volume: 0.5,
    });
    expect(context.audibleStarts).to.equal(0);
  });

  it("uses the media fallback for a running context whose clock is frozen", async () => {
    tap();
    await clock.tickAsync(0);
    const context = TestAudioContext.instances[0];
    context.frozen = true;
    setHidden(true);
    setHidden(false);
    audio.play(1, false);
    await clock.tickAsync(100);
    expect(context.audibleStarts).to.equal(0);
    expect(TestAudioElement.instances[0].play.callCount).to.equal(2);
  });

  it("still primes fallback elements when Web Audio is unavailable", async () => {
    browser.AudioContext = undefined;
    tap();
    await clock.tickAsync(0);
    setHidden(true);
    setHidden(false);
    tap();
    await clock.tickAsync(0);
    audio.play(1, false);
    await clock.tickAsync(0);
    expect(TestAudioElement.instances).to.have.length(3);
    expect(TestAudioElement.instances[0].play.callCount).to.equal(3);
  });

  it("falls back when decoding fails", async () => {
    tap();
    const context = TestAudioContext.instances[0];
    context.decodeAudioData.rejects(new Error("decode failed"));
    await clock.tickAsync(0);
    audio.play(1, false);
    await clock.tickAsync(0);
    expect(TestAudioElement.instances[0].play.callCount).to.equal(2);
    expect(context.audibleStarts).to.equal(0);
  });

  it("drops a pending chime when the app leaves instead of playing it after recovery", async () => {
    tap();
    await clock.tickAsync(0);
    audio.play(1, false);
    setHidden(true);
    setHidden(false);
    tap();
    await clock.tickAsync(1000);
    expect(TestAudioContext.instances.every((context) => context.audibleStarts === 0)).to.equal(true);
  });

  it("keeps native playback and muted settings unchanged", async () => {
    nativePlay.returns(true);
    audio.play(1, true, "get-ready-end");
    audio.play(0, false);
    await clock.tickAsync(0);
    expect(nativePlay.calledOnceWithExactly(1, true, "get-ready-end")).to.equal(true);
    expect(TestAudioContext.instances).to.have.length(0);
  });
});
