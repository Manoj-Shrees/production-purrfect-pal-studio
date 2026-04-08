import { Component } from '@angular/core';

@Component({
  selector: 'app-order-tutorial',
  standalone: false,
  templateUrl: './order-tutorial.component.html',
  styleUrl: './order-tutorial.component.css'
})
export class OrderTutorialComponent {


  faqOpen: boolean[] = [false, false, false, false, false];

  toggleFaq(index: number): void {
    this.faqOpen[index] = !this.faqOpen[index];
  }
}
