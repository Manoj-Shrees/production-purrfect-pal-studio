import {
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { ProductService } from '../Service/ProductPage/product.service';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { Imageurls, product } from '../product-page/models/productmodels';
import { AuthService } from '../Service/User/auth.service';
import { Router } from '@angular/router';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { UsersService } from '../Service/User/users.service';
import { LoginService } from '../Service/User/login.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';

@Component({
  selector: 'app-shop',
  standalone: false,
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent {

  @ViewChild('cartIcon', { static: true }) cartIcon!: ElementRef;
  @ViewChild('menu') menuRef!: ElementRef;
  @ViewChild('menuButton') buttonRef!: ElementRef;

  private _snackBar = inject(MatSnackBar);
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'top';

  cacheBuster: number = Date.now(); // initialize cache buster

  // ── Auth / user state ────────────────────────
  userid = signal<number>(0);
  isloggedin = false;
  userdata: any;
  menuOpen = false;
  profilemenuOpen = false;
  badgeAnimating = false;
  innerWidth: number = window.innerWidth;

  // ── Cart counters (signals) ──────────────────
  cartrealaststiccounter = signal<number>(0);
  cartcartooncounter = signal<number>(0);
  cartreadymadecounter = signal<number>(0);
  cartcounter = computed(
    () => this.cartrealaststiccounter() + this.cartcartooncounter() + this.cartreadymadecounter()
  );

  // ── Products ─────────────────────────────────
  premadeproductdata: any[] = [];

  // ── Filter & Search & Sort state ──────────────
  activeFilter = 'all';
  activeBreedFilter = signal<string>('all');
  breedOptions = [
    'all',
    'French Bulldog', 'Havanese', 'Maltese', 'Poodle', 'Beagle',
    'Shih Tzu', 'Yorkshire Terrier', 'Retriever', 'Golden Retriever', 'Labrador',
    'Collie', 'German Shepherd', 'Dachshund', 'Husky', 'Pug',
    'Chihuahua', 'Doberman', 'Pomeranian', 'Rottweiler', 'Bulldog',
    'Persian Cat', 'Siamese Cat', 'Maine Coon', 'British Shorthair', 'Ragdoll'
  ];

  get customProductBreeds(): string[] {
    if (!this.premadeproductdata || !Array.isArray(this.premadeproductdata)) return [];
    const defaults = new Set(this.breedOptions.map(b => b.toLowerCase()));
    const extraBreeds = new Set<string>();
    for (const item of this.premadeproductdata) {
      if (item.breed && typeof item.breed === 'string' && item.breed.trim()) {
        const trimmed = item.breed.trim();
        if (!defaults.has(trimmed.toLowerCase())) {
          extraBreeds.add(trimmed);
        }
      }
    }
    return Array.from(extraBreeds).sort();
  }
  searchQuery = signal<string>('');
  sortBy = signal<'popular' | 'price-asc' | 'price-desc' | 'discount'>('popular');
  selectedQuickView = signal<any | null>(null);

  // ── 3D Room Visualizer Modal State ───────────
  isRoomModalOpen = signal<boolean>(false);
  selectedArProduct = signal<any | null>(null);
  selectedRoomBg = signal<string>('linear-gradient(135deg, #1e293b 0%, #0f172a 100%)');
  selectedFrameStyle = signal<'oak' | 'black' | 'gold' | 'white'>('black');
  selectedCanvasSize = signal<string>('16×20"');
  frameTiltDeg = signal<number>(-8);

  roomBgOptions = [
    { id: 'dark', name: 'Studio Dark Ambient', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
    { id: 'warm', name: 'Warm Oak Living Room', bg: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)' },
    { id: 'modern', name: 'Modern Minimalist White', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' },
    { id: 'navy', name: 'Royal Velvet Gallery', bg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }
  ];

  frameOptions = [
    { id: 'black', name: 'Matte Black', border: '6px solid #1e293b' },
    { id: 'oak', name: 'Solid Oak', border: '6px solid #b45309' },
    { id: 'gold', name: 'Ornate Gold', border: '6px solid #d97706' },
    { id: 'white', name: 'Gallery White', border: '6px solid #f8fafc' }
  ];

  sizeOptions = ['12×16"', '16×20"', '20×30"', '24×36"'];

  getFrameBorder(style: string): string {
    const found = this.frameOptions.find(f => f.id === style);
    return found ? found.border : '6px solid #1e293b';
  }

  // ── Recently Viewed Drawer ──────────────────
  recentlyViewed = signal<any[]>([]);

  trackRecentlyViewed(item: any): void {
    if (!item) return;
    const current = this.recentlyViewed();
    const exists = current.some(p => (p.id && p.id === item.id) || p.name === item.name);
    if (!exists) {
      const updated = [item, ...current].slice(0, 4);
      this.recentlyViewed.set(updated);
    }
  }

  clearRecentlyViewed(): void {
    this.recentlyViewed.set([]);
  }

  // ── Live AR Camera Stream State ──────────────
  isArCameraActive = signal<boolean>(false);
  arCameraError = signal<string | null>(null);
  private arMediaStream: MediaStream | null = null;

  async toggleArCamera(): Promise<void> {
    if (this.isArCameraActive()) {
      this.stopArCamera();
    } else {
      await this.startArCamera();
    }
  }

  async startArCamera(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.arCameraError.set('Camera access is not supported on this browser.');
      return;
    }
    this.stopArCamera();
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      this.arMediaStream = stream;
      this.isArCameraActive.set(true);
      this.arCameraError.set(null);

      setTimeout(() => {
        const video = document.getElementById('shop-ar-video-feed') as HTMLVideoElement;
        if (video && stream) {
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          video.play().catch(e => console.warn('AR Video Play error:', e));
        }
      }, 100);
    } catch (err: any) {
      this.isArCameraActive.set(false);
      this.arCameraError.set('Camera access denied or device unavailable.');
    }
  }

  stopArCamera(): void {
    if (this.arMediaStream) {
      this.arMediaStream.getTracks().forEach(track => track.stop());
      this.arMediaStream = null;
    }
    this.isArCameraActive.set(false);
  }

  openArRoomModal(item: any): void {
    this.selectedArProduct.set(item);
    this.isRoomModalOpen.set(true);
    this.trackRecentlyViewed(item);
  }

  closeArRoomModal(): void {
    this.stopArCamera();
    this.isRoomModalOpen.set(false);
  }

  setRoomBg(bgStr: string, event?: Event): void {
    this.stopArCamera();
    this.selectedRoomBg.set(bgStr);
    this.autoScrollPill(event);
  }

  setCanvasSize(size: string, event?: Event): void {
    this.selectedCanvasSize.set(size);
    this.autoScrollPill(event);
  }

  setFrameStyle(style: 'oak' | 'black' | 'gold' | 'white', event?: Event): void {
    this.selectedFrameStyle.set(style);
    this.autoScrollPill(event);
  }

  autoScrollPill(event?: Event): void {
    const target = (event?.currentTarget as HTMLElement);
    if (!target) return;
    setTimeout(() => {
      const container = target.parentElement as HTMLElement;
      if (container && container.scrollWidth > container.clientWidth) {
        const targetLeft = target.offsetLeft;
        const targetWidth = target.offsetWidth;
        const containerWidth = container.clientWidth;
        const scrollTo = targetLeft - (containerWidth / 2) + (targetWidth / 2);
        container.scrollTo({ left: scrollTo, behavior: 'smooth' });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }

  getProductRating(item: any): { rating: string; count: number } {
    const idNum = item.id || (item.name ? item.name.length * 7 : 42);
    const rating = (4.8 + (idNum % 3) * 0.1).toFixed(1);
    const count = 18 + (idNum % 65);
    return { rating, count };
  }

  // Keywords used to auto-detect category from product title
  private readonly CAT_KW = ['cat', 'kitty', 'kitten', 'feline', 'tabby', 'persian', 'siamese'];
  private readonly DOG_KW = ['dog', 'puppy', 'pup', 'retriever', 'labrador', 'poodle', 'bulldog', 'hound', 'dachshund', 'corgi'];

  // ── Wishlist ──────────────────────────────────
  private wishlistSet = new Set<any>();

  // ── Misc ──────────────────────────────────────
  loading = false;

  constructor(
    private productservice: ProductService,
    private router: Router,
    private authservice: AuthService,
    private loggingService: LoggingService,
    private Topast: ToastService,
    private cdRef: ChangeDetectorRef,
    private userservice: UsersService,
    private loginService: LoginService,
    private el: ElementRef,
    private socialmedia: SociallinkService
  ) {
    this.getpremadeproductdata();

    this.authservice.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        const { ID } = response.user;
        this.userid.set(ID);
        if (this.cartcounter() === 0) this.getcartcount();
      }
    });
  }

  ngOnInit(): void {
    this.authservice.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        this.isloggedin = true;
        this.getuserdata(response.user);
      } else {
        this.isloggedin = false;
      }
    });
  }

  // ── Mosaic image helper (avoids optional-chain warnings) ──
  getMosaicImg(index: number): string {
    if (this.premadeproductdata && this.premadeproductdata.length > index) {
      return this.premadeproductdata[index].Img_Url;
    }
    return '/assets/images/pps-logo.png';
  }

  // ── Subject type detection helper ────────────
  getSubjectType(p: any): string {
    if (p.subject_type) return p.subject_type;
    const l = (p.name || '').toLowerCase();
    if (l.includes('family') || l.includes('couple') || l.includes('group')) return 'family';
    if (l.includes('myself') || l.includes('person') || l.includes('human')) return 'yourself';
    if (l.includes('& me') || l.includes('+ me') || l.includes('owner')) return 'both';
    return 'pet';
  }

  // ── Filtered, Searched & Sorted products ─────
  filteredProducts(): any[] {
    if (!this.premadeproductdata) return [];
    let list = [...this.premadeproductdata];

    // 1. Category Filter
    if (this.activeFilter !== 'all') {
      list = list.filter(p => this.getSubjectType(p) === this.activeFilter);
    }

    // 2. Breed Filter
    const breed = this.activeBreedFilter();
    if (breed && breed.toLowerCase() !== 'all' && breed.toLowerCase() !== 'all breeds') {
      const bLower = breed.toLowerCase();
      list = list.filter(p => {
        const breedVal = (p.breed || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return breedVal.includes(bLower) || name.includes(bLower) || desc.includes(bLower);
      });
    }

    // 3. Search Query Filter
    const query = (this.searchQuery() || '').toLowerCase().trim();
    if (query) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(query));
    }

    // 4. Sorting
    const sort = this.sortBy();
    if (sort === 'price-asc') {
      list.sort((a, b) => (a.price - (a.discount || 0)) - (b.price - (b.discount || 0)));
    } else if (sort === 'price-desc') {
      list.sort((a, b) => (b.price - (b.discount || 0)) - (a.price - (a.discount || 0)));
    } else if (sort === 'discount') {
      list.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    }

    return list;
  }

  setBreedFilter(breed: string): void {
    this.activeBreedFilter.set(breed);
    setTimeout(() => {
      // 1. Center selected pill horizontally in scrollable bar
      const activeEl = document.querySelector('.breed-pills-bar .breed-pill-btn.active') as HTMLElement;
      activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

      // 2. Smoothly scroll page to top of product grid
      const gridEl = document.querySelector('.pgrid, #product-grid') as HTMLElement;
      if (gridEl) {
        const topOffset = gridEl.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    }, 60);
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  onSortChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as any;
    this.sortBy.set(val);
  }

  openQuickView(item: any): void {
    this.selectedQuickView.set(item);
    this.trackRecentlyViewed(item);
  }

  closeQuickView(): void {
    this.selectedQuickView.set(null);
  }

  // ── Filter pill handler ───────────────────────
  setFilter(filter: string): void {
    this.activeFilter = filter;
    if (filter !== 'pet' && filter !== 'all') {
      this.activeBreedFilter.set('all');
    }
  }

  // ── Badge helpers ─────────────────────────────
  getBadgeClass(item: any): string {
    const discount = Number(item?.discount) || 0;
    if (!discount || discount <= 0) return 'bn';
    const pct = this.getDiscountPct(item);
    if (pct >= 20) return 'bs'; // green "Save"
    if (pct >= 10) return 'bh'; // pink "Hot"
    return 'bn';                 // violet "New"
  }

  getBadgeText(item: any): string {
    const cls = this.getBadgeClass(item);
    const discount = Number(item?.discount) || 0;
    if (cls === 'bs') return `Save AUD $${discount.toFixed(2)}`;
    if (cls === 'bh') return '🔥 Hot';
    return '✨ New';
  }

  // ── Discount % ────────────────────────────────
  getDiscountPct(item: any): number {
    const price = Number(item?.price) || 0;
    const discount = Number(item?.discount) || 0;
    if (!price || price <= 0 || !discount || discount <= 0) return 0;
    const pct = Math.round((discount / price) * 100);
    return Math.min(Math.max(pct, 0), 99);
  }

  // ── Wishlist ──────────────────────────────────
  isWishlisted(item: any): boolean {
    return this.wishlistSet.has(item.id ?? item.name);
  }

  toggleWishlist(event: MouseEvent, item: any): void {
    event.stopPropagation();
    const key = item.id ?? item.name;
    if (this.wishlistSet.has(key)) {
      this.wishlistSet.delete(key);
    } else {
      this.wishlistSet.add(key);
    }
  }

  // ── User / auth helpers ───────────────────────
  getuserdata(resdata: any): void {
    const { user_id } = resdata;
    this.userservice.getuserdetailbyid(user_id).subscribe(
      (data: any) => (this.userdata = data)
    );
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/assets/images/profile-picture.png';
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    setTimeout(() => {
      const target = event.target as HTMLElement;
      if (
        !this.menuRef?.nativeElement.contains(target) &&
        !this.buttonRef?.nativeElement.contains(target)
      ) {
        this.profilemenuOpen = false;
      }
    }, 0);
  }

  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  profiletoggleMenu(): void { this.profilemenuOpen = !this.profilemenuOpen; }

  @HostListener('window:resize')
  onResize(): void {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  logout(): void {
    this.loginService.logoutuser().subscribe(
      response => {
        this.router.navigate(['/Login']);
        this.authservice.setUser(null);
        this.Topast.showToast('success', 'Logout', 'Logout successful.');
      },
      error => {
        this.Topast.showToast('error', 'Logout', 'Logout failed.');
      }
    );
  }

  opensocialurl(pos: number): void { this.socialmedia.geturl(pos); }

  // ── Cart ──────────────────────────────────────
  setcounter(): void {
    this.cartreadymadecounter.set(this.cartreadymadecounter() + 1);
    this.badgeAnimating = true;
    setTimeout(() => (this.badgeAnimating = false), 400);
  }

getpremadeproductdata(): void {
  this.productservice.getdata().subscribe(
    (data: any) => {
      this.premadeproductdata = data.map((item: any) => ({
        ...item,
        price: Number(item.price),
        discount: Number(item.discount) || 0,
      }));
    }
  );
}

  getcartcount(): void {
    if (this.userid() != null) {
      this.productservice.cartcount(this.userid()).subscribe((data: any) => {
        this.cartrealaststiccounter.set(data[0]);
        this.cartcartooncounter.set(data[1]);
        this.cartreadymadecounter.set(data[2]);
      });
    }
  }

  getreadymadeproductdata(items: any): void {
    const imagedata: Imageurls = {
      petimg1: items.Img_Url, petimg2: 'null', petimg3: 'null',
      petimg4: 'null', custombackgroundimg: 'null', personimg: 'null',
    };
    const chosenSubject = items.subject_type || this.getSubjectType(items);
    const productdata: product = {
      name: items.name, urls: imagedata, art_style: 'Ready-Made',
      artist_additional_notes: '[Format: High-Res Digital File]', background_additional_notes: 'N/A',
      background_style: 'N/A', petname: 'N/A',
      subject_type: chosenSubject as any,
      price: parseFloat((items.price - (items.discount || 0)).toFixed(2)), pet_quantity: 0, additional_fee: 0,
      User_ID: this.userid()
    };
    this.pushdatatocart(productdata);
  }

  pushdatatocart(cartdata: any): void {
    this.productservice.addTocart(cartdata).subscribe(
      response => {
        this.Topast.showToast('success', 'Added to Cart', 'Product has been added to your cart.');
        this.setcounter();
      },
      error => {
        this.Topast.showToast('error', 'Add to Cart Failed', 'There was an error adding the product to your cart.');
      }
    );
  }

  // ── Fly-to-cart animation ─────────────────────
  generateAddToCartFly(productDiv: HTMLElement, items: any): void {
    if (!this.userid()) {
      this.Topast.showToast('error', 'Add to Cart Failed', 'Please login to add to cart');
      this.router.navigate(['/Login']);
      return;
    }

    const cart = this.cartIcon.nativeElement;
    const clone = productDiv.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);

    const startRect = productDiv.getBoundingClientRect();

    clone.style.setProperty('width', '80px', 'important');
    clone.style.setProperty('height', '80px', 'important');
    clone.style.setProperty('minHeight', '0', 'important');
    clone.style.setProperty('maxHeight', 'none', 'important');

    Object.assign(clone.style, {
      position: 'fixed',
      top: `${startRect.top}px`,
      left: `${startRect.left}px`,
      transition: 'all 0.8s ease-in-out',
      zIndex: '9999',
      objectFit: 'cover',
      borderRadius: '8px',
      pointerEvents: 'none',
      display: 'block',
      boxSizing: 'border-box',
    });

    clone.getBoundingClientRect();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.getreadymadeproductdata(items);

    setTimeout(() => {
      const endRect = cart.getBoundingClientRect();
      clone.style.setProperty('width', '24px', 'important');
      clone.style.setProperty('height', '24px', 'important');
      Object.assign(clone.style, {
        top: `${endRect.top}px`,
        left: `${endRect.left}px`,
        opacity: '0.5',
      });
    }, 300);

    setTimeout(() => clone.remove(), 1200);
  }

  // ── Navigation ────────────────────────────────
  navigateToProductPage(): void {
    this.router.navigate(['/ProductPage']);
  }
}