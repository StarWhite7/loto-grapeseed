import { computed, Component, DestroyRef, inject, signal } from '@angular/core';
import { BallComponent } from './ball/ball';

type TicketBall = {
  label: string;
  value: number | null;
  spinning: boolean;
};

type SpinStates = {
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
  protected readonly isDrawing = signal(false);

  protected readonly mainBalls = computed<TicketBall[]>(() => {
    const [first, second] = this.mainValues();
    const spins = this.spinStates();

    return [
      { label: 'Numero 1', value: first, spinning: spins.main1 },
      { label: 'Numero 2', value: second, spinning: spins.main2 }
    ];
  });

  protected readonly bonusBall = computed<TicketBall>(() => {
    const spins = this.spinStates();

    return {
      label: 'Numero chance',
      value: this.bonusValue(),
      spinning: spins.bonus
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
    void this.startSpinSound();

    this.startSpin('main1', 3000, first, (value) => {
      this.mainValues.update(([, currentSecond]) => [value, currentSecond]);
    });

    this.scheduleReveal(3000, () => {
      this.startSpin('main2', 3000, second, (value) => {
        this.mainValues.update(([currentFirst]) => [currentFirst, value]);
      });
    });

    this.scheduleReveal(6000, () => {
      this.startSpin('bonus', 3000, bonus, (value) => {
        this.bonusValue.set(value);
      });
    });

    this.scheduleReveal(9000, () => {
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
      commit(finalValue);
      this.spinStates.update((states) => ({
        ...states,
        [key]: false
      }));
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
