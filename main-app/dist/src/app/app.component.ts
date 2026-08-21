import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, Event, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { LoaderService } from './Service/app/loader.service';
import { HttpClient } from '@angular/common/http';
import { baseurl, headers } from './Service/servicebasemodel';
import { trigger, transition, style, animate } from '@angular/animations';

import { Title, Meta } from '@angular/platform-browser';
import { MarketingService } from './Service/marketing/marketing.service';
import { WebPushService } from './Service/webpush/web.push.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css',
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Purrfect Pal Studio';
  isUnderMaintenance = false;
  isAdmin = false;
  private seoConfig: any = null;

  // ─── Anti-Screenshot: blur images when tab switch / hidden ─────────────────
  private readonly getProtectedElements = (): NodeListOf<HTMLElement> => {
    return document.querySelectorAll<HTMLElement>(
      '.bgContainer, .image-container img, .gallery-proof-layer, .studio-proof-layer, .demo-proof-layer, .review-proof-layer, .iw img, .mc img, .review-img, .artwork-image, .magnifier, .zoomed img, .shop-card-img, .ready-made-img, [appDisablerightclick], canvas'
    );
  };

  private readonly blurProtectedContent = () => {
    this.getProtectedElements().forEach(el => {
      el.style.filter = 'blur(28px) grayscale(50%)';
      el.style.transition = 'filter 0s';
    });
  };

  private readonly unblurProtectedContent = () => {
    setTimeout(() => {
      this.getProtectedElements().forEach(el => {
        el.style.filter = '';
        el.style.transition = 'filter 0.35s ease';
      });
    }, 150);
  };

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.blurProtectedContent();
    } else {
      this.unblurProtectedContent();
    }
  };

  // ─── Block clipboard copy globally ──────────────────────────────────────
  private readonly onCopy = (e: ClipboardEvent) => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '© Purrfect Pal Studio — All images are protected.');
    }
  };

  constructor(
    private router: Router,
    private loaderService: LoaderService,
    private http: HttpClient,
    private titleService: Title,
    private metaService: Meta,
    private marketingService: MarketingService,
    private webPushService: WebPushService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loaderService.show();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loaderService.hide();
        const url = (event instanceof NavigationEnd) ? event.urlAfterRedirects : event.url;
        this.trackPageView(url);
      }
    });

    // ── Bind anti-screenshot listeners ────────────────────────────────
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('copy', this.onCopy);
  }

  ngOnInit() {
    this.checkMaintenanceAndAdmin();
    this.loadSEOSettings();
    this.webPushService.init().catch(err => console.warn('[WebPush] Init error:', err));
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('copy', this.onCopy);
  }

  // ─── Global keyboard protection ─────────────────────────────────────────
  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(e: KeyboardEvent): void {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = e.key?.toUpperCase();

    // PrintScreen
    if (key === 'PRINTSCREEN') {
      this.blurProtectedContent();
      e.preventDefault();
      return;
    }

    // F12 (DevTools)
    if (e.key === 'F12') { e.preventDefault(); return; }

    if (ctrl) {
      // macOS / Windows screenshot hotkeys: Cmd/Ctrl + Shift + 3 / 4 / 5 / S
      if (shift && (key === '3' || key === '4' || key === '5' || key === 'S')) {
        this.blurProtectedContent();
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd + P  → Print dialog
      if (key === 'P') { e.preventDefault(); return; }
      // Ctrl/Cmd + S  → Save page
      if (key === 'S') { e.preventDefault(); return; }
      // Ctrl/Cmd + U  → View source
      if (key === 'U') { e.preventDefault(); return; }
      // Ctrl/Cmd + Shift + I  → DevTools
      if (shift && key === 'I') { e.preventDefault(); return; }
      // Ctrl/Cmd + Shift + J  → Console
      if (shift && key === 'J') { e.preventDefault(); return; }
      // Ctrl/Cmd + Shift + C  → Inspector
      if (shift && key === 'C') { e.preventDefault(); return; }
    }
  }

  private loadSEOSettings() {
    this.marketingService.getSEOMetadata().subscribe({
      next: (res) => {
        if (res && res.success && res.seo) {
          this.seoConfig = res.seo;
          this.updateSEOForRoute(this.router.url);
        }
      },
      error: (err) => console.error('Error loading SEO settings:', err)
    });
  }

  private updateSEOForRoute(url: string) {
    const pagePath = url.split(/[?#]/)[0] || '/';
    const fullUrl = `https://purrfectpal.studio${pagePath === '/' ? '' : pagePath}`;
    
    // Dynamically update Canonical URL
    this.updateCanonicalUrl(fullUrl);

    if (pagePath === '/' || pagePath === '/home') {
      const pageTitle = this.seoConfig?.homepageTitle || 'Purrfect Pal Studio | Premium Custom Pet Portraits & Prints';
      const pageDesc = this.seoConfig?.homepageDescription || 'Transform your favorite pet photos into beautiful museum-grade framed canvas art and custom digital prints. Fast shipping & 100% satisfaction guaranteed.';
      const pageKeywords = this.seoConfig?.homepageKeywords || 'pet portrait, custom cat painting, dog canvas art, personalized pet gifts, pet print studio';
      const ogImage = this.seoConfig?.ogImageUrl || 'https://purrfectpal.studio/assets/demo/detailedtexturedog.png';
      const twitterCard = this.seoConfig?.twitterCardType || 'summary_large_image';

      this.titleService.setTitle(pageTitle);
      this.metaService.updateTag({ name: 'description', content: pageDesc });
      this.metaService.updateTag({ name: 'keywords', content: pageKeywords });
      this.metaService.updateTag({ property: 'og:title', content: pageTitle });
      this.metaService.updateTag({ property: 'og:description', content: pageDesc });
      this.metaService.updateTag({ property: 'og:image', content: ogImage });
      this.metaService.updateTag({ property: 'og:url', content: fullUrl });
      this.metaService.updateTag({ name: 'twitter:card', content: twitterCard });
      this.metaService.updateTag({ name: 'twitter:title', content: pageTitle });
      this.metaService.updateTag({ name: 'twitter:description', content: pageDesc });
      this.metaService.updateTag({ name: 'twitter:image', content: ogImage });
    } else {
      // Format page name from route path (e.g. /shop -> Shop)
      const pageName = pagePath.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const titlePattern = this.seoConfig?.titlePattern || '%s | Purrfect Pal Studio';
      const formattedTitle = titlePattern.includes('%s') ? titlePattern.replace('%s', pageName) : titlePattern.replace('%page%', pageName);
      
      const routeDescriptions: Record<string, string> = {
        '/shop': 'Explore our exclusive collection of custom pet portraits, framed canvas artwork, and personalized pet lover gifts.',
        '/print-on-demand': 'Turn your pet photos into physical museum-quality framed canvas prints, acrylic art, and custom posters.',
        '/customerreview': 'Read customer reviews, wall of love testimonials, and verified feedback from happy pet parents.',
        '/faq-page': 'Frequently asked questions about ordering, custom artwork previews, photo requirements, and international shipping.',
        '/privacy-policy': 'Purrfect Pal Studio privacy policy, terms of service, and data protection guidelines.'
      };

      const pageDesc = routeDescriptions[pagePath] || `Discover ${pageName} at Purrfect Pal Studio. Premium custom pet portraits and artwork.`;
      const ogImage = this.seoConfig?.ogImageUrl || 'https://purrfectpal.studio/assets/demo/detailedtexturedog.png';

      this.titleService.setTitle(formattedTitle);
      this.metaService.updateTag({ name: 'description', content: pageDesc });
      this.metaService.updateTag({ property: 'og:title', content: formattedTitle });
      this.metaService.updateTag({ property: 'og:description', content: pageDesc });
      this.metaService.updateTag({ property: 'og:image', content: ogImage });
      this.metaService.updateTag({ property: 'og:url', content: fullUrl });
      this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
      this.metaService.updateTag({ name: 'twitter:title', content: formattedTitle });
      this.metaService.updateTag({ name: 'twitter:description', content: pageDesc });
      this.metaService.updateTag({ name: 'twitter:image', content: ogImage });
    }
  }

  private updateCanonicalUrl(url: string) {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private checkMaintenanceAndAdmin() {
    // 1. Check if user is admin
    this.http.get<any>(`${baseurl}/auth/status`, { withCredentials: true, headers }).subscribe({
      next: (res) => {
        if (res && res.isAuthenticated && res.user && res.user.role === 'admin') {
          this.isAdmin = true;
        }
        // After auth check, check maintenance status
        this.fetchMaintenanceStatus();
      },
      error: (err) => {
        console.error('Error checking auth status:', err);
        // Fallback to checking maintenance
        this.fetchMaintenanceStatus();
      }
    });
  }

  private fetchMaintenanceStatus() {
    this.http.get<any>(`${baseurl}/settings/maintenance`, { headers }).subscribe({
      next: (res) => {
        if (res && res.maintenance_mode && !this.isAdmin) {
          this.isUnderMaintenance = true;
        } else {
          this.isUnderMaintenance = false;
        }
      },
      error: (err) => {
        console.error('Error checking maintenance mode:', err);
      }
    });
  }

  private trackPageView(url: string) {
    // Sanitize path (strip query params / hashes if any)
    const pagePath = url.split(/[?#]/)[0] || '/';
    this.updateSEOForRoute(pagePath);
    this.http.post<any>(`${baseurl}/analytics/track`, { page_path: pagePath }, { headers }).subscribe({
      error: (err) => console.error('Error tracking page view:', err)
    });
  }
}
