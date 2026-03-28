import { computed, Component, DestroyRef, inject, signal } from '@angular/core';
import { BallComponent } from './ball/ball';

type TicketBall = {
  label: string;
  value: number | null;
  spinning: boolean;
  selected: boolean;
};

type SpinStates = {
  main1: boolean;
  main2: boolean;
  bonus: boolean;
};

type SelectedStates = {
  main1: boolean;
  main2: boolean;
  bonus: boolean;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BallComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTimers: number[] = [];
  private readonly pendingIntervals: number[] = [];
  private audioContext: AudioContext | null = null;
  private audioTickerId: number | null = null;
  private readonly mainValues = signal<[number | null, number | null]>([null, null]);
  private readonly bonusValue = signal<number | null>(null);
  private readonly spinStates = signal<SpinStates>({
    main1: false,
    main2: false,
    bonus: false
  });
  private readonly selectedStates = signal<SelectedStates>({
    main1: false,
    main2: false,
    bonus: false
  });
  protected readonly isDrawing = signal(false);

  protected readonly mainBalls = computed<TicketBall[]>(() => {
    const [first, second] = this.mainValues();
    const spins = this.spinStates();

    return [
      {
        label: 'Numero 1',
        value: first,
        spinning: spins.main1,
        selected: this.selectedStates().main1
      },
      {
        label: 'Numero 2',
        value: second,
        spinning: spins.main2,
        selected: this.selectedStates().main2
      }
    ];
  });

  protected readonly bonusBall = computed<TicketBall>(() => {
    const spins = this.spinStates();

    return {
      label: 'Numero chance',
      value: this.bonusValue(),
      spinning: spins.bonus,
      selected: this.selectedStates().bonus
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearPendingWork();
      void this.audioContext?.close();
    });
  }

  protected drawNumbers(): void {
    if (this.isDrawing()) {
      return;
    }

    const first = this.randomBetween(1, 10);
    let second = this.randomBetween(1, 10);

    while (second === first) {
      second = this.randomBetween(1, 10);
    }

    const bonus = this.randomBetween(1, 10);

    this.clearPendingWork();
    this.isDrawing.set(true);
    this.mainValues.set([null, null]);
    this.bonusValue.set(null);
    this.spinStates.set({
      main1: false,
      main2: false,
      bonus: false
    });
    this.selectedStates.set({
      main1: false,
      main2: false,
      bonus: false
    });

    this.startSpin('main1', 3200, first, (value) => {
      this.mainValues.update(([, currentSecond]) => [value, currentSecond]);
    });

    this.scheduleReveal(4200, () => {
      this.startSpin('main2', 3200, second, (value) => {
        this.mainValues.update(([currentFirst]) => [currentFirst, value]);
      });
    });

    this.scheduleReveal(8400, () => {
      this.startSpin('bonus', 3200, bonus, (value) => {
        this.bonusValue.set(value);
      });
    });

    this.scheduleReveal(11800, () => {
      this.stopSpinSound();
      this.isDrawing.set(false);
    });
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private scheduleReveal(delay: number, callback: () => void): void {
    const timerId = window.setTimeout(() => {
      this.removeTimer(timerId);
      callback();
    }, delay);

    this.pendingTimers.push(timerId);
  }

  private startSpin(
    key: keyof SpinStates,
    duration: number,
    finalValue: number,
    commit: (value: number) => void
  ): void {
    void this.startSpinSound();

    this.spinStates.update((states) => ({
      ...states,
      [key]: true
    }));

    commit(this.randomBetween(1, 10));

    const intervalId = window.setInterval(() => {
      commit(this.randomBetween(1, 10));
    }, 90);

    this.pendingIntervals.push(intervalId);

    this.scheduleReveal(duration, () => {
      this.removeInterval(intervalId);
      window.clearInterval(intervalId);
      this.stopSpinSound();
      commit(finalValue);
      this.playFinalRevealSound();
      this.selectedStates.update((states) => ({
        ...states,
        [key]: true
      }));
      this.spinStates.update((states) => ({
        ...states,
        [key]: false
      }));
      this.scheduleReveal(850, () => {
        this.selectedStates.update((states) => ({
          ...states,
          [key]: false
        }));
      });
    });
  }

  private async startSpinSound(): Promise<void> {
    const context = this.getAudioContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    this.stopSpinSound();
    this.audioTickerId = window.setInterval(() => {
      this.playSpinTick(context);
    }, 85);
  }

  private stopSpinSound(): void {
    if (this.audioTickerId !== null) {
      window.clearInterval(this.audioTickerId);
      this.audioTickerId = null;
    }
  }

  private playSpinTick(context: AudioContext): void {
    if (context.state !== 'running') {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(900 + Math.random() * 500, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 + Math.random() * 900, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.026 + Math.random() * 0.012, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.06);
  }

  private playFinalRevealSound(): void {
    const context = this.getAudioContext();

    if (!context || context.state !== 'running') {
      return;
    }

    const now = context.currentTime;
    const fundamental = context.createOscillator();
    const accent = context.createOscillator();
    const sub = context.createOscillator();
    const gain = context.createGain();
    const accentGain = context.createGain();
    const subGain = context.createGain();
    const master = context.createGain();
    const filter = context.createBiquadFilter();

    fundamental.type = 'triangle';
    accent.type = 'sine';
    sub.type = 'triangle';

    fundamental.frequency.setValueAtTime(520, now);
    fundamental.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    fundamental.frequency.exponentialRampToValueAtTime(680, now + 0.24);

    accent.frequency.setValueAtTime(1040, now);
    accent.frequency.exponentialRampToValueAtTime(1560, now + 0.07);
    accent.frequency.exponentialRampToValueAtTime(1320, now + 0.2);

    sub.frequency.setValueAtTime(260, now);
    sub.frequency.exponentialRampToValueAtTime(320, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    accentGain.gain.setValueAtTime(0.0001, now);
    accentGain.gain.exponentialRampToValueAtTime(0.06, now + 0.014);
    accentGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    master.gain.setValueAtTime(0.9, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(0.8, now);

    fundamental.connect(gain);
    accent.connect(accentGain);
    sub.connect(subGain);
    gain.connect(filter);
    accentGain.connect(filter);
    subGain.connect(filter);
    filter.connect(master);
    master.connect(context.destination);

    fundamental.start(now);
    accent.start(now);
    sub.start(now);

    fundamental.stop(now + 0.36);
    accent.stop(now + 0.24);
    sub.stop(now + 0.3);
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextCtor = window.AudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private clearPendingWork(): void {
    for (const timerId of this.pendingTimers) {
      window.clearTimeout(timerId);
    }

    for (const intervalId of this.pendingIntervals) {
      window.clearInterval(intervalId);
    }

    this.pendingTimers.length = 0;
    this.pendingIntervals.length = 0;
    this.stopSpinSound();
    this.isDrawing.set(false);
  }

  private removeTimer(timerId: number): void {
    const index = this.pendingTimers.indexOf(timerId);

    if (index >= 0) {
      this.pendingTimers.splice(index, 1);
    }
  }

  private removeInterval(intervalId: number): void {
    const index = this.pendingIntervals.indexOf(intervalId);

    if (index >= 0) {
      this.pendingIntervals.splice(index, 1);
    }
  }
}
