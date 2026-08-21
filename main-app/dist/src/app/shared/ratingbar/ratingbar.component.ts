import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ratingbar',
  standalone: false,
  templateUrl: './ratingbar.component.html',
  styleUrl: './ratingbar.component.css'
})
export class RatingbarComponent {

  @Input() totalStars = 5;
  @Input() rating = 0; // supports decimal values (e.g., 3.5)

  get starsArray(): number[] {
    return Array(this.totalStars).fill(0);
  }

  // Calculate fill percentage for each star
  getFillPercent(index: number): number {
    const diff = this.rating - index;
    if (diff >= 1) return 100; // full star
    if (diff > 0) return diff * 100; // partial star
    return 0; // empty star
  }

}
