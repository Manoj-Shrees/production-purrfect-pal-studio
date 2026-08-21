import { ChangeDetectorRef, Component, ElementRef, HostListener, Inject, OnInit, OnDestroy, PLATFORM_ID, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { TestimonialService } from '../Service/HomePage/testimonial.service';
import { FeaturedArtistService } from '../Service/HomePage/featured-artist.service';
import { HowitWorkDataList } from './homeinterface';
import { isPlatformBrowser, ViewportScroller } from "@angular/common";
import { LoginService } from '../Service/User/login.service';
import { Router } from '@angular/router';
import { UsersService } from '../Service/User/users.service';
import { AuthService } from '../Service/User/auth.service';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { LoginStatusService } from '../Service/User/login-status.service';
import { Title, Meta } from '@angular/platform-browser';
import { LoggingService } from '../Service/Logs/logging.service';
import { Toast, ToastService } from '../Service/common/toast.service';
import { HttpClient } from '@angular/common/http';

import { Subject, takeUntil } from 'rxjs';
import { MarketingService } from '../Service/marketing/marketing.service';
import { hosturl } from '../Service/servicebasemodel';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {

  @ViewChildren('animatedSection', { read: ElementRef })
  animatedSections!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('menu') menuRef!: ElementRef;
  @ViewChild('menuButton') buttonRef!: ElementRef;

  testimonialdata: any[] = [];
  menuOpen: boolean = false;
  profilemenuOpen: boolean = false;
  userdata: any;
  isloggedin: boolean = false;
  cacheBuster: number = Date.now();
  spotlights: any[] = [];

  showLoginModal = false;
  showArtistModal: boolean = false;
  selectedArtist: any = null;
  previewArtworkUrl: string | null = null;

  openArtworkPreview(url: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.previewArtworkUrl = this.formatImageUrl(url);
  }

  closeArtworkPreview(): void {
    this.previewArtworkUrl = null;
  }

  howitworkdatalists = HowitWorkDataList;

  private observer!: IntersectionObserver;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private testimonialservice: TestimonialService,
    private featuredArtistService: FeaturedArtistService,
    private router: Router,
    private title: Title,
    private meta: Meta,
    private authService: AuthService,
    private loginService: LoginService,
    private loggingService: LoggingService,
    private userservice: UsersService,
    private eRef: ElementRef,
    private viewportScroller: ViewportScroller,
    private socialmedia: SociallinkService,
    private loginStatus: LoginStatusService,
    private Toast: ToastService,
    private cdRef: ChangeDetectorRef,
    private marketingService: MarketingService,
    private http: HttpClient
  ) {}

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  profiletoggleMenu() {
    this.profilemenuOpen = !this.profilemenuOpen;

    if (this.profilemenuOpen) {
      setTimeout(() => {
        if (!this.buttonRef || !this.menuRef) return;

        const btnRect = this.buttonRef.nativeElement.getBoundingClientRect();
        const dropdownEl = this.menuRef.nativeElement;

        dropdownEl.classList.remove('drop-up');
        dropdownEl.style.top = '';
        dropdownEl.style.bottom = '';
        dropdownEl.style.right = '0';

        const viewportHeight = window.innerHeight;
        const dropdownHeight = dropdownEl.offsetHeight;

        if (!dropdownHeight) return;

        const wouldOverflow = btnRect.bottom + dropdownHeight > viewportHeight - 10;

        if (wouldOverflow) {
          dropdownEl.classList.add('drop-up');
          dropdownEl.style.bottom = `calc(100% + 4px)`;
          dropdownEl.style.top = 'auto';
        } else {
          dropdownEl.classList.remove('drop-up');
          dropdownEl.style.top = `calc(100% + 4px)`;
          dropdownEl.style.bottom = 'auto';
        }
      });
    }
  }

  opensocialurl(pos: number) {
    this.socialmedia.geturl(pos);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    setTimeout(() => {
      const target = event.target as HTMLElement;
      const clickedInsideMenu = this.menuRef?.nativeElement.contains(target);
      const clickedButton = this.buttonRef?.nativeElement.contains(target);

      if (!clickedInsideMenu && !clickedButton) {
        this.profilemenuOpen = false;
      }
    }, 0);
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {

      const navState = window.history.state;

      if (navState?.justLoggedIn) {
        this.showLoginModal = true;
        setTimeout(() => {
          history.replaceState({}, '', window.location.href);
        }, 5000);
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            } else {
              entry.target.classList.remove('visible');
            }
          });
        },
        { threshold: 0.2 }
      );

      this.animatedSections.forEach((section: ElementRef<HTMLElement>) => {
        if (section.nativeElement) {
          this.observer.observe(section.nativeElement);
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCloseModal() {
    this.showLoginModal = false;
  }


  ngOnInit(): void {
    this.title.setTitle('Custom Personal, Couple & Pet Portraits | Personalised Art | Purrfect Pal Studio');
    this.meta.updateTag({
      name: 'description',
      content: 'Create a custom portrait from your photo. Personalised digital artwork for individuals, couples, groups, and pets. Fast delivery & free preview.'
    });

    this.gettestimonialdata();
    this.getfeaturedartistdata();
    this.loadSpotlights();
    this.loadSEOMetadata();

    this.authService.checkAuth()
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        if (response.isAuthenticated && response.user) {
          this.isloggedin = true;
          this.getuserdata(response.user);
          this.cacheBuster = Date.now();
        } else {
          this.isloggedin = false;
        }
      });

  }

  loadSpotlights(): void {
    this.marketingService.getSpotlights().subscribe({
      next: (res) => {
        if (res && res.success) {
          this.spotlights = res.spotlights || [];
        }
      },
      error: (err) => console.error('Error fetching spotlights:', err)
    });
  }

  trackSpotlightClick(spotlight: any): void {
    this.marketingService.trackSpotlightClick(spotlight.id).subscribe({
      next: () => {
        this.redirectToSpotlightTarget(spotlight);
      },
      error: () => {
        this.redirectToSpotlightTarget(spotlight);
      }
    });
  }

  openArtistProfile(artist: any): void {
    if (!artist) return;
    this.openArtistBriefing(artist);
  }

  closeArtistProfile(): void {
    this.closeArtistModal();
  }

  private redirectToSpotlightTarget(spotlight: any): void {
    if (spotlight.type === 'artist') {
      const artistData = {
        name: spotlight.targetName,
        bio: spotlight.targetDetail,
        imageURL: spotlight.imageURL,
        specialty: 'Master Digital & Fine Art Portrait Artist',
        rating: 4.98,
        artworksCount: 340
      };
      this.openArtistProfile(artistData);
    } else {
      this.router.navigate(['/ProductPage']);
    }
  }

  innerWidth: number = window.innerWidth;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  scrollToFragment(fragment: string): void {
    this.menuOpen = false;
    this.viewportScroller.scrollToAnchor(fragment);
  }

  getuserdata(resdata: any): void {
    const { user_id } = resdata;
    this.userservice.getuserdetailbyid(user_id).pipe().subscribe(
      (data) => this.userdata = data
    );
  }

  gettestimonialdata(): void {
    this.testimonialservice.getdata().subscribe(
      (data) => this.testimonialdata = data
    );
  }

  getfeaturedartistdata(): void {
    this.featuredArtistService.getdata().subscribe(
      (data) => {
        if (data && data.length > 0) {
          this.artists = data.map((artist: any) => ({
            id: artist.id,
            name: artist.name,
            skill: artist.skill,
            desc: artist.bio,
            bio: artist.bio,
            img: artist.img_url,
            img_url: artist.img_url,
            artwork_samples: artist.artwork_samples,
            samples: artist.samples
          }));
        }
      },
      (error) => {
        this.loggingService.error('Failed to load featured artists:', error);
      }
    );
  }

  onImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = '/assets/images/profile-picture.png';
  }

  openProductPage(): void {
    this.router.navigate(['/ProductPage']);
  }

  settimelineclass(pos: number) {
    let classtype = '';
    pos % 2 == 0 ? classtype = '' : classtype = 'timeline-inverted';
    return classtype;
  }

  logout() {
    this.loginService.logoutuser().pipe().subscribe(
      (response) => {
        this.router.navigate(['/Login']);
        this.authService.setUser(null);
        this.loggingService.log('Logout successful:', response);
        this.Toast.showToast('success', 'Logout', 'Logout successful.');
      },
      (error) => {
        this.loggingService.error('Logout failed:', error);
        this.Toast.showToast('error', 'Logout', 'Logout failed.');
      }
    );
  }

  @ViewChild('imageContainer') imageContainer!: ElementRef;

  popupVisible = false;
  popupData = { name: '', skill: '', desc: '' };
  popupPosition = { top: 0, left: 0 };
  popupWidth = 0;

  artists = [
    {
      name: 'Fid',
      skill: 'Pet Cartoon & Pixel Art Specialist',
      desc: 'Fid is the creative mind behind our pet cartoon style and pixel art. His unique talent brings each pet to life with vibrant, animated charm, adding a playful, storybook feel to every portrait.',
      img: '/assets/artist/fid.webp'
    },
    {
      name: 'Darwin',
      skill: 'Realistic Vector Artist',
      desc: 'Darwin specializes in ultra-detailed vector portraits, capturing everything from bright eyes to fine fur. His crisp style stays sharp at any size—perfect for prints, merch, or wall art.',
      img: '/assets/artist/darwin.webp'
    }
  ];

  showPopup(event: MouseEvent, artist: any) {
    const target = event.target as HTMLElement;
    const parent = target.closest('.artist-card') as HTMLElement;

    const imgRect = target.getBoundingClientRect();
    const cardRect = parent.getBoundingClientRect();

    const screenWidth = window.innerWidth;

    let popupWidth: number;
    let popupLeft: number;

    if (screenWidth < 576) {
      popupWidth = cardRect.width - 20;
      popupLeft = 10;
    } else if (screenWidth < 768) {
      popupWidth = imgRect.width + 100;
      popupLeft = imgRect.left - cardRect.left + (imgRect.width / 2) - (popupWidth / 2);
    } else {
      popupWidth = imgRect.width + 300;
      popupLeft = imgRect.left - cardRect.left;
    }

    const popupTop = imgRect.top - cardRect.top + imgRect.height + 40;

    this.popupPosition.top = popupTop;
    this.popupPosition.left = popupLeft;
    this.popupWidth = popupWidth;

    this.popupData = artist;
    this.popupVisible = true;
  }

  hidePopup() {
    this.popupVisible = false;
  }

  openArtistBriefing(artist: any): void {
    const query = artist?.name || artist?.Name || artist?.id;
    this.selectedArtist = artist;
    this.showArtistModal = true;
    this.hidePopup();

    if (query) {
      this.http.get<any>(`${hosturl}/artistprofile/detail/${encodeURIComponent(query)}`).subscribe({
        next: (res: any) => {
          if (res && res.success && res.profile) {
            this.selectedArtist = { ...artist, ...res.profile };
            this.cdRef.detectChanges();
          }
        },
        error: (err) => {
          console.warn('[ArtistBriefing] Could not fetch detailed profile, using fallback:', err);
        }
      });
    }
  }

  closeArtistModal(): void {
    this.showArtistModal = false;
    this.selectedArtist = null;
  }

  chooseArtist(artist: any): void {
    this.closeArtistModal();
    this.router.navigate(['/ProductPage']);
  }

  getArtistSamples(artist: any): string[] {
    if (!artist) return [];

    // 1. Check artwork_samples (JSON string or Array from backend)
    if (artist.artwork_samples) {
      if (Array.isArray(artist.artwork_samples)) {
        return artist.artwork_samples.filter((url: any) => typeof url === 'string' && url.trim().length > 0);
      }
      try {
        const parsed = JSON.parse(artist.artwork_samples);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((url: any) => typeof url === 'string' && url.trim().length > 0);
        }
      } catch (e) {}
    }

    // 2. Check samples array from backend
    if (artist.samples && Array.isArray(artist.samples) && artist.samples.length > 0) {
      return artist.samples.filter((url: any) => typeof url === 'string' && url.trim().length > 0);
    }

    // 3. Check portfolio array from backend
    if (artist.portfolio && Array.isArray(artist.portfolio) && artist.portfolio.length > 0) {
      return artist.portfolio.filter((url: any) => typeof url === 'string' && url.trim().length > 0);
    }

    // No hardcoded fallbacks - strictly synchronized with backend
    return [];
  }

  getArtistContribution(artist: any): number {
    if (!artist) return 250;
    if (artist.jobs_completed && Number(artist.jobs_completed) > 0) return Number(artist.jobs_completed);
    if (artist.artworksCount && Number(artist.artworksCount) > 0) return Number(artist.artworksCount);
    if (artist.completed_masterpieces && Number(artist.completed_masterpieces) > 0) return Number(artist.completed_masterpieces);

    const seedStr = (artist.name || artist.id || 'artist').toString();
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const samplesCount = this.getArtistSamples(artist).length;
    const baseCount = (Math.abs(hash) % 250) + 180;
    return baseCount + (samplesCount * 35);
  }

  formatImageUrl(url: string): string {
    if (!url) return '/assets/images/profile-picture.png';
    // If it's a relative path starting with assets/ or /assets/, resolve as frontend asset
    if (url.startsWith('assets/') || url.startsWith('/assets/')) {
      return url.startsWith('/') ? url : '/' + url;
    }
    // If it's a relative path, prepend hosturl
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanPath = url.startsWith('/') ? url : '/' + url;
      return `${hosturl}${cleanPath}`;
    }
    // If it is an absolute URL, dynamically swap the host matching current environment
    try {
      const parsed = new URL(url);
      const hosturlParsed = new URL(hosturl);
      parsed.protocol = hosturlParsed.protocol;
      parsed.host = hosturlParsed.host;
      return parsed.toString();
    } catch (e) {
      return url;
    }
  }

  // ── SEO Tag Navigation ──────────────────────────────────────────────────
  seoTags = [
    { label: 'Pet Portrait', icon: 'fa-paw', tag: 'pet portrait' },
    { label: 'Custom Pet Art', icon: 'fa-palette', tag: 'custom pet art' },
    { label: 'Canvas Print', icon: 'fa-print', tag: 'canvas print' },
    { label: 'Pet Illustration', icon: 'fa-wand-magic-sparkles', tag: 'pet illustration' },
    { label: 'Dog Portrait', icon: 'fa-dog', tag: 'dog portrait' },
    { label: 'Cat Portrait', icon: 'fa-cat', tag: 'cat portrait' }
  ];

  onSeoTagClick(tagKey: string) {
    const lower = tagKey.toLowerCase();
    if (lower.includes('canvas') || lower.includes('print')) {
      this.router.navigate(['/printOnDemand']);
    } else if (lower.includes('illustr') || lower.includes('cartoon')) {
      this.router.navigate(['/ProductPage'], { queryParams: { style: 'Cartoonised' } });
    } else if (lower.includes('dog')) {
      this.router.navigate(['/ProductPage'], { queryParams: { type: 'dog' } });
    } else if (lower.includes('cat')) {
      this.router.navigate(['/ProductPage'], { queryParams: { type: 'cat' } });
    } else {
      this.router.navigate(['/ProductPage']);
    }
  }

  loadSEOMetadata(): void {
    this.marketingService.getSEOMetadata().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const data = res.data;
          if (data.homepageKeywords) {
            const keywords: string[] = data.homepageKeywords.split(',')
              .map((k: string) => k.trim())
              .filter((k: string) => k.length > 0);

            if (keywords.length > 0) {
              this.seoTags = keywords.map(kw => {
                const lower = kw.toLowerCase();
                let icon = 'fa-paw';
                if (lower.includes('dog')) icon = 'fa-dog';
                else if (lower.includes('cat')) icon = 'fa-cat';
                else if (lower.includes('canvas') || lower.includes('print')) icon = 'fa-print';
                else if (lower.includes('art') || lower.includes('paint')) icon = 'fa-palette';
                else if (lower.includes('illustr')) icon = 'fa-wand-magic-sparkles';
                
                return { label: kw, icon: icon, tag: lower };
              });
            }
          }
          if (data.ogImageUrl) {
            this.meta.updateTag({ property: 'og:image', content: data.ogImageUrl });
            this.meta.updateTag({ name: 'twitter:image', content: data.ogImageUrl });
          }
        }
      },
      error: () => {
        // Fallback to default predefined tags
      }
    });
  }
}