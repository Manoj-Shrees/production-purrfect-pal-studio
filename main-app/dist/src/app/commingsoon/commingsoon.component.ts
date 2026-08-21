import { Component } from '@angular/core';

interface Product {
  label: string;
  status: 'available' | 'coming-soon';
  iconId: string;
}

interface UpcomingFeature {
  tag: string;
  title: string;
  description: string;
  icon: string;
  status: 'Coming Soon' | 'In Development' | 'In Design';
}

@Component({
  selector: 'app-commingsoon',
  standalone: false,
  templateUrl: './commingsoon.component.html',
  styleUrl: './commingsoon.component.css'
})
export class CommingsoonComponent {

  upcomingFeatures: UpcomingFeature[] = [
    {
      tag: 'Interactive Art',
      title: 'Scannable Voice & Audio Memories',
      description: 'Embed a personalized voice message, pet bark, or audio tribute into a subtle scannable QR emblem printed on your custom portrait.',
      icon: 'fas fa-microphone-alt',
      status: 'In Development'
    },
    {
      tag: 'Motion Art',
      title: '3D Live Animated Lockscreen Art',
      description: 'Transform your custom static portrait into a subtle 3D animated motion video for phone lockscreens, smart displays, and digital frames.',
      icon: 'fas fa-play-circle',
      status: 'In Design'
    },
    {
      tag: 'Legacy Art',
      title: 'Puppy-to-Senior Growth Collage',
      description: 'Craft a multi-stage artistic evolution capturing your beloved pet from puppyhood to golden senior years in one harmonized portrait.',
      icon: 'fas fa-history',
      status: 'Coming Soon'
    },
    {
      tag: 'Gifting Suite',
      title: 'Custom Wax-Sealed Gift Packaging',
      description: 'Send custom artwork directly to recipients enclosed in gold-stamped luxury boxes with wax seals and personalized velvet greeting cards.',
      icon: 'fas fa-box-open',
      status: 'Coming Soon'
    }
  ];

  products: Product[] = [
    { label: 'Canvas Print', status: 'available',   iconId: 'canvas' },
    { label: 'T-Shirt',      status: 'coming-soon', iconId: 'tshirt' },
    { label: 'Mug',          status: 'coming-soon', iconId: 'mug'    },
    { label: 'Phone Case',   status: 'coming-soon', iconId: 'phone'  },
  ];

}
