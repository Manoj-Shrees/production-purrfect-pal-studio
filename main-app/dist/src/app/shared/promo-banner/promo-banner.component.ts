import { Component, OnInit } from '@angular/core';
import { MarketingService } from '../../Service/marketing/marketing.service';

@Component({
  selector: 'app-promo-banner',
  standalone: false,
  templateUrl: './promo-banner.component.html',
  styleUrls: ['./promo-banner.component.css']
})
export class PromoBannerComponent implements OnInit {
  banner: any = null;
  isDismissed: boolean = false;

  constructor(private marketingService: MarketingService) {}

  ngOnInit(): void {
    let dismissedBannerId: string | null = null;
    try {
      dismissedBannerId = localStorage.getItem('dismissed_promo_banner_id');
    } catch (e) {
      console.warn('Storage access restricted:', e);
    }
    
    this.marketingService.getBanners().subscribe({
      next: (res) => {
        if (res.success && res.banners && res.banners.length > 0) {
          const activeBanner = res.banners[0]; // Get the latest active banner
          if (dismissedBannerId !== String(activeBanner.id)) {
            this.banner = activeBanner;
            document.body.classList.add('has-promo-banner');
          }
        }
      },
      error: (err) => {
        console.error('Error fetching promo banner:', err);
      }
    });
  }

  dismissBanner(): void {
    if (this.banner) {
      try {
        localStorage.setItem('dismissed_promo_banner_id', this.banner.id);
      } catch (e) {
        console.warn('Failed to save banner dismissal state:', e);
      }
    }
    this.isDismissed = true;
    document.body.classList.remove('has-promo-banner');
  }

  getBannerGradient(): string {
    if (!this.banner) return '';
    return `linear-gradient(90deg, ${this.banner.startColorHex || '#FF4E50'} 0%, ${this.banner.endColorHex || '#F9D423'} 100%)`;
  }
}
