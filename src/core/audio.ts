/**
 * 소리 (제작 지시서 5장)
 * 음원 파일 없이 Web Audio API로 직접 합성합니다. (CREDITS.md 참고)
 *  - 숲 앰비언스: 바람, 먼 새소리, 풀벌레, 개울 물소리(골짜기숲길 근처에서만)
 *  - 바람 한 줄기(털어놓기), 나무 차임(숨쉬기), 걷는 소리, 엘리베이터
 * 종·풍경·목탁 소리는 쓰지 않습니다.
 * 첫 터치 전에는 재생하지 않고, 탭이 백그라운드로 가면 서서히 줄입니다.
 */
import { getPref, setPref } from './metrics';

type Surface = 'dirt' | 'grass' | 'deck';

/** 배경 소리 크기 (여기 숫자만 바꾸면 전체 균형이 바뀝니다) */
const AMBIENCE_GAIN = 0.3; // 숲 소리 전체 크기
const BODY_GAIN = 1.0;
const RUSTLE_GAIN = 1.3;
const AIR_GAIN = 0.5;
const CRICKET_GAIN = 1.0;
const BIRD_GAIN = 1.0;

class ForestAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private streamGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private birdTimer = 0;
  private inForest = false;
  enabled: boolean = getPref('sound') !== '0';
  started = false;
  private listeners: Array<() => void> = [];

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }
  private emit(): void {
    this.listeners.forEach((f) => f());
  }

  /** 사용자의 첫 터치·클릭에서 호출 (자동재생 제한) */
  start(): void {
    if (this.started) {
      this.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.started = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0;
    this.ambience.connect(this.master);

    // 잡음 버퍼(분홍빛 잡음에 가깝게)
    const len = ctx.sampleRate * 4;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }

    this.buildWind();
    this.buildCrickets();
    this.buildStream();
    this.applyMaster(0.8);
    this.applyAmbience();
    this.scheduleBird();
    this.emit();
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 2;
    src.start(0, Math.random() * 3);
    return src;
  }

  private lfo(freq: number, depth: number, target: AudioParam): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  /**
   * 바람과 나뭇잎 소리.
   * 휴대폰·노트북 스피커는 낮은 음을 거의 내지 못하므로, 들리는 음역(약 400Hz~4kHz)에
   * 소리를 두고 낮은 바람은 헤드폰용으로 조금만 깔아 둡니다.
   */
  private buildWind(): void {
    const ctx = this.ctx!;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 1;
    this.windGain.connect(this.ambience!);
    const layer = (type: BiquadFilterType, freq: number, q: number, gain: number): { f: BiquadFilterNode; g: GainNode } => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      this.noiseSource().connect(f).connect(g).connect(this.windGain!);
      return { f, g };
    };
    // 숲 전체에 깔리는 바람
    const body = layer('bandpass', 480, 0.45, BODY_GAIN);
    this.lfo(0.05, BODY_GAIN * 0.3, body.g.gain);
    this.lfo(0.07, 140, body.f.frequency);
    // 나뭇잎 스치는 소리(천천히 밀려왔다 잦아듦)
    const rustle = layer('bandpass', 1900, 0.55, RUSTLE_GAIN);
    this.lfo(0.09, RUSTLE_GAIN * 0.42, rustle.g.gain);
    this.lfo(0.031, RUSTLE_GAIN * 0.28, rustle.g.gain);
    this.lfo(0.06, 600, rustle.f.frequency);
    // 높은 가지의 사각거림
    const air = layer('highpass', 3800, 0.5, AIR_GAIN);
    this.lfo(0.13, AIR_GAIN * 0.5, air.g.gain);
    // 낮게 깔리는 바람(헤드폰에서 공간감)
    layer('lowpass', 300, 0.4, 0.1);
  }

  private buildCrickets(): void {
    const ctx = this.ctx!;
    const voice = (freq: number, trill: number, slow: number, pan: number, vol: number): void => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const a = ctx.createGain();
      a.gain.value = 0.5;
      this.lfo(trill, 0.5, a.gain);
      const b = ctx.createGain();
      b.gain.value = 0.35;
      this.lfo(slow, 0.35, b.gain);
      const out = ctx.createGain();
      out.gain.value = vol;
      o.connect(a).connect(b).connect(out);
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        out.connect(p).connect(this.ambience!);
      } else out.connect(this.ambience!);
      o.start();
    };
    voice(4350, 31, 0.53, -0.6, 0.024 * CRICKET_GAIN);
    voice(3820, 27, 0.37, 0.55, 0.02 * CRICKET_GAIN);
    voice(4780, 36, 0.21, 0.1, 0.012 * CRICKET_GAIN);
  }

  private buildStream(): void {
    const ctx = this.ctx!;
    this.streamGain = ctx.createGain();
    this.streamGain.gain.value = 0;
    this.streamGain.connect(this.ambience!);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 450;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    this.noiseSource().connect(hp).connect(bp).connect(g).connect(this.streamGain);
    this.lfo(0.9, 260, bp.frequency);
    this.lfo(0.37, 0.12, g.gain);
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 3400;
    bp2.Q.value = 1.2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    this.noiseSource().connect(bp2).connect(g2).connect(this.streamGain);
    this.lfo(1.7, 0.1, g2.gain);
    this.lfo(0.23, 700, bp2.frequency);
  }

  private scheduleBird(): void {
    window.clearTimeout(this.birdTimer);
    this.birdTimer = window.setTimeout(
      () => {
        if (this.ctx && this.enabled && this.inForest && this.ctx.state === 'running') this.bird();
        this.scheduleBird();
      },
      5000 + Math.random() * 7000,
    );
  }

  /** 먼 새소리 */
  private bird(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.05;
    const base = 2300 + Math.random() * 1300;
    const n = 2 + Math.floor(Math.random() * 3);
    const out = ctx.createGain();
    out.gain.value = (0.07 + Math.random() * 0.05) * BIRD_GAIN;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    out.connect(lp);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      lp.connect(p).connect(this.ambience!);
    } else lp.connect(this.ambience!);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.17 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.92, t + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.16);
    }
  }

  private applyMaster(seconds = 0.4): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, now, seconds / 3);
  }
  private applyAmbience(boost = 1): void {
    if (!this.ctx || !this.ambience) return;
    this.ambience.gain.setTargetAtTime(this.inForest ? AMBIENCE_GAIN * boost : 0, this.ctx.currentTime, 0.5);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    setPref('sound', on ? '1' : '0');
    if (on && !this.started) this.start();
    this.applyMaster();
    this.emit();
  }
  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  /** 숲 안에 있을 때만 앰비언스를 냄 */
  setInForest(on: boolean): void {
    this.inForest = on;
    this.applyAmbience();
  }
  /** 숨쉬기 중에는 숲 소리가 살짝 커짐 */
  setBreathing(on: boolean): void {
    this.applyAmbience(on ? 1.45 : 1);
  }
  /** 자리마다 조금씩 다르게: stream 0~1(개울과 가까운 정도), open 0~1(트인 정도) */
  setScene(stream: number, open: number): void {
    if (!this.ctx || !this.streamGain || !this.windGain) return;
    const now = this.ctx.currentTime;
    this.streamGain.gain.setTargetAtTime(stream * 0.34, now, 0.6);
    this.windGain.gain.setTargetAtTime(0.75 + open * 0.45 - stream * 0.2, now, 0.8);
  }

  suspend(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.12);
    window.setTimeout(() => {
      if (document.hidden && this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
    }, 500);
  }
  resume(): void {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.applyMaster();
  }

  private ready(): boolean {
    return !!this.ctx && !!this.master && this.enabled && this.ctx.state === 'running';
  }

  /** 나무 차임(마림바에 가까운 짧은 나무 울림) */
  chime(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    [523.25, 783.99].forEach((f, i) => {
      const t = t0 + i * 0.16;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      g.connect(this.master!);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + 1);
      // 나무를 두드리는 짧은 배음
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 4;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o2.connect(g2).connect(this.master!);
      o2.start(t);
      o2.stop(t + 0.12);
    });
  }

  /** 바람 한 줄기(털어놓기) */
  gust(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 1.1);
    bp.frequency.exponentialRampToValueAtTime(420, t + 2.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.5, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 3.1);
  }

  /** 걷는 소리: 흙길·잔디(낙엽)·데크마다 다르게, 아주 작게 */
  footstep(surface: Surface): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const dur = surface === 'grass' ? 0.11 : 0.07;
    if (surface === 'dirt') {
      f.type = 'lowpass';
      f.frequency.value = 850;
    } else if (surface === 'grass') {
      f.type = 'bandpass';
      f.frequency.value = 2600 + Math.random() * 800;
      f.Q.value = 0.6;
    } else {
      f.type = 'lowpass';
      f.frequency.value = 480;
    }
    const vol = surface === 'grass' ? 0.11 : surface === 'deck' ? 0.2 : 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.02);
    if (surface === 'deck') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150 + Math.random() * 30, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.05, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(og).connect(this.master!);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  /** 엘리베이터: 아주 작은 기계음 + 바람 */
  elevator(seconds: number): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
    g.gain.setValueAtTime(0.05, t + seconds - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    g.connect(this.master!);
    for (const [f, v] of [
      [86, 1],
      [172, 0.35],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.92, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.6);
      const og = ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + seconds + 0.05);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const ng = ctx.createGain();
    ng.gain.value = 2.2;
    src.connect(lp).connect(ng).connect(g);
    src.start(t);
    src.stop(t + seconds + 0.05);
    // 도착: 나무를 가볍게 두드리는 소리
    const k = ctx.createOscillator();
    k.frequency.setValueAtTime(330, t + seconds);
    k.frequency.exponentialRampToValueAtTime(220, t + seconds + 0.09);
    const kg = ctx.createGain();
    kg.gain.setValueAtTime(0.0001, t + seconds);
    kg.gain.exponentialRampToValueAtTime(0.07, t + seconds + 0.006);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.14);
    k.connect(kg).connect(this.master!);
    k.start(t + seconds);
    k.stop(t + seconds + 0.2);
  }
}

export const audio = new ForestAudio();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend();
    else audio.resume();
  });
}
