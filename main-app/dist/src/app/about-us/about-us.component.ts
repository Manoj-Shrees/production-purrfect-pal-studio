import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { LoginService } from '../Service/User/login.service';
import { UsersService } from '../Service/User/users.service';
import { AuthService } from '../Service/User/auth.service';
import { FeaturedArtistService } from '../Service/HomePage/featured-artist.service';
import { hosturl } from '../Service/servicebasemodel';

@Component({
  selector: 'app-about-us',
  standalone: false,
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css'
})
export class AboutUsComponent implements OnInit {

  menuOpen: boolean = false;
  profilemenuOpen: boolean = false;
  isloggedin: boolean = false;
  userdata: any = null;
  cacheBuster: number = Date.now();
  innerWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1200;

  // Artist briefing modal state
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

  // Artist Showcase state
  popupVisible = false;
  popupData = { name: '', skill: '', desc: '' };
  popupPosition = { top: 0, left: 0 };
  popupWidth = 0;

  artists = [
    {
      name: 'Fid',
      skill: 'Pet Cartoon & Pixel Art Specialist',
      desc: 'Fid is the creative mind behind our pet cartoon style and pixel art. His unique talent brings each pet to life with vibrant, animated charm, adding a playful, storybook feel to every portrait.',
      img: '/assets/artist/fid.png'
    },
    {
      name: 'Darwin',
      skill: 'Realistic Vector Artist',
      desc: 'Darwin specializes in ultra-detailed vector portraits, capturing everything from bright eyes to fine fur. His crisp style stays sharp at any size—perfect for prints, merch, or wall art.',
      img: '/assets/artist/darwin.png'
    }
  ];

  founders = [
    {
      name: 'Manoj Shrees',
      title: 'Founder & CEO',
      img: '/assets/founders/manoj-shrees.png',
      quote: 'Transforming pet memories into timeless digital masterworks that bring endless joy to pet parents worldwide.',
      bio: 'Visionary leader and pet enthusiast passionate about combining cutting-edge digital artistry with seamless customer experiences.',
      github: 'https://github.com/manoj-shrees',
      linkedin: 'https://www.linkedin.com/in/manoj-shrees'
    },
    {
      name: 'Tenzin Sherpa',
      title: 'Co-founder & COO',
      img: '/assets/founders/tenzin-sherpa.png',
      quote: 'Empowering digital artists to unleash their creativity while crafting flawless, heartfelt workflows for pet lovers.',
      bio: 'Operational strategist dedicated to artist empowerment, rigorous quality control, and delightful order fulfillment.',
      github: 'https://github.com/Tenzin-s',
      linkedin: 'https://www.linkedin.com/in/tenzin-sherpa-06a0a8258/'
    }
  ];

  values = [
    {
      icon: 'fa-hands-holding-circle',
      title: 'Connecting Artists & Users',
      description: 'We connect talented digital artists directly with users to turn personal photos, ideas, and memories into custom hand-drawn art.'
    },
    {
      icon: 'fa-print',
      title: 'Canvas Print',
      description: 'Upgrade your digital masterpiece into physical, high-resolution gallery canvas prints and premium wall art for your home.'
    },
    {
      icon: 'fa-user-circle',
      title: 'Portraits for Myself',
      description: 'Celebrate yourself or loved ones with custom individual digital portraits illustrated in realistic or cartoon art styles.'
    },
    {
      icon: 'fa-heart',
      title: 'Pet + Me Portraits',
      description: 'Immortalize the special bond between you and your pet together in a single, beautifully composed custom artwork.'
    },
    {
      icon: 'fa-paw',
      title: 'Pet-Only Artwork',
      description: 'Dedicated hand-drawn pet portraits capturing the unique spirit, personality, and fine details of your cherished companions.'
    },
    {
      icon: 'fa-rotate-right',
      title: 'Up to 4 Revisions',
      description: 'Collaborate with your artist with up to 4 revisions so every detail matches your vision perfectly before final delivery.'
    }
  ];

  constructor(
    private socialmedia: SociallinkService,
    private loginService: LoginService,
    private userService: UsersService,
    private authService: AuthService,
    private featuredArtistService: FeaturedArtistService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.checkLoginStatus();
    this.getfeaturedartistdata();
  }

  checkLoginStatus(): void {
    this.authService.checkAuth().subscribe(response => {
      if (response && response.isAuthenticated && response.user) {
        this.isloggedin = true;
        const { user_id } = response.user;
        if (user_id) {
          this.userService.getuserdetailbyid(user_id).subscribe(data => {
            this.userdata = data;
            this.cdRef.detectChanges();
          });
        }
      } else {
        this.isloggedin = false;
      }
      this.cdRef.detectChanges();
    });
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
          this.cdRef.detectChanges();
        }
      },
      (error) => {
        console.error('Failed to load featured artists:', error);
      }
    );
  }

  showPopup(event: MouseEvent, artist: any) {
    const target = event.target as HTMLElement;
    const parent = target.closest('.artist-card') as HTMLElement;
    if (!parent) return;

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
    if (url.startsWith('assets/') || url.startsWith('/assets/')) {
      return url.startsWith('/') ? url : '/' + url;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanPath = url.startsWith('/') ? url : '/' + url;
      return `${hosturl}${cleanPath}`;
    }
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

  onImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = '/assets/images/profile-picture.png';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  profiletoggleMenu(): void {
    this.profilemenuOpen = !this.profilemenuOpen;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (typeof window !== 'undefined') {
      this.innerWidth = window.innerWidth;
      this.cdRef.detectChanges();
    }
  }

  opensocialurl(pos: number) {
    this.socialmedia.geturl(pos);
  }

  logout(): void {
    this.loginService.logoutuser().subscribe(() => {
      this.isloggedin = false;
      this.userdata = null;
      this.authService.setUser(null);
      this.router.navigate(['/Login']);
      this.cdRef.detectChanges();
    });
  }
}
