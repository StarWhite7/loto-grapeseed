import { computed, Component, signal } from '@angular/core';
import { BallComponent } from './ball/ball';

type TicketBall = {
  id: string;
  label: string;
  value: number | null;
  delay: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BallComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly drawCount = signal(0);
  private readonly mainValues = signal<[number | null, number | null]>([null, null]);
  private readonly bonusValue = signal<number | null>(null);

  protected readonly mainBalls = computed<TicketBall[]>(() => {
    const [first, second] = this.mainValues();
    const draw = this.drawCount();

    return [
      { id: `main-1-${draw}`, label: 'Numero 1', value: first, delay: 0 },
      { id: `main-2-${draw}`, label: 'Numero 2', value: second, delay: 120 }
    ];
  });

  protected readonly bonusBall = computed<TicketBall>(() => {
    const draw = this.drawCount();

    return {
      id: `bonus-${draw}`,
      label: 'Numero chance',
      value: this.bonusValue(),
      delay: 240
    };
  });

  protected drawNumbers(): void {
    const first = this.randomBetween(1, 10);
    let second = this.randomBetween(1, 10);

    while (second === first) {
      second = this.randomBetween(1, 10);
    }

    this.mainValues.set([first, second]);
    this.bonusValue.set(this.randomBetween(1, 10));
    this.drawCount.update((count) => count + 1);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
