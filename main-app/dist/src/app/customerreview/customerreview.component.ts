import { Component } from '@angular/core';

export interface CustomerReview {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  petName: string;
  text: string;
  image: string;
}

@Component({
  selector: 'app-customerreview',
  standalone: false,
  templateUrl: './customerreview.component.html',
  styleUrl: './customerreview.component.css'
})
export class CustomerreviewComponent {
  reviews: CustomerReview[] = [
    {
      id: 1,
      name: '羽鳥ユニカ',
      avatar: 'https://purrfectpal.studio/uploadedfiles/testimonials/dinkojun.jpg',
      rating: 5,
      petName: 'Max',
      text: 'Absolutely in love with Max’s portrait — it captures his personality perfectly!',
      image: '/assets/reviews/AD.png'
    },
    {
      id: 2,
      name: 'Daniel Maclennan',
      avatar: 'https://purrfectpal.studio/uploadedfiles/testimonials/dmac.jpg',
      rating: 4.5,
      petName: 'Buddy',
      text: "Buddy's portrait is incredible. It’s like her personality is shining right off the canvas.",
      image: '/assets/reviews/TY.png'
    },
    {
      id: 3,
      name: 'Suzi Diaz',
      avatar: 'https://purrfectpal.studio/uploadedfiles/testimonials/bindu.jpg',
      rating: 5,
      petName: 'Felix',
      text: 'Felix’s portrait is stunning — it truly captures his spirit.',
      image: '/assets/reviews/WED.png'
    }
  ];
}
