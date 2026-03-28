import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ball',
  standalone: true,
  templateUrl: './ball.html',
  styleUrl: './ball.css'
})
export class BallComponent {
  readonly label = input.required<string>();
  readonly value = input<number | null>(null);
  readonly delay = input<number>(0);
  readonly variant = input<'main' | 'bonus'>('main');
}
