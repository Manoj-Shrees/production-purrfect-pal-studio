import { ChangeDetectorRef, Component, computed, ElementRef, HostListener, inject, OnDestroy, Renderer2, signal, ViewChild } from '@angular/core';
import {
  getpreMadeBackground, BgEntry, BG_CATEGORIES, BgCategory, filesData, selectedFiles, getNoOfPets, getNoOfPersons,
  getNoOfBoth, getNoOfFamily, product, Imageurls, PRICING, getBasePrice, SubjectTypeOption
} from './models/productmodels';
import { DomSanitizer, Meta, Title } from '@angular/platform-browser';
import { ProductService } from '../Service/ProductPage/product.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { AuthService } from '../Service/User/auth.service';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { UsersService } from '../Service/User/users.service';
import { LoginService } from '../Service/User/login.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { LoadingService } from '../Service/Loader/loading.service';
import { MarketingService } from '../Service/marketing/marketing.service';
import html2canvas from 'html2canvas';

export interface SocialOrderToast {
  id: string;
  name: string;
  location: string;
  item: string;
  time: string;
  avatar: string;
}

interface ExtendedFilesData extends filesData {
  fileType: 'self' | 'pet' | 'family';
}

@Component({
  selector: 'app-product-page',
  standalone: false,
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('500ms', style({ opacity: 0 }))
      ])
    ]),
  ],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.css',
})
export class ProductPageComponent implements OnDestroy {
  @ViewChild('petimage') petimage!: ElementRef;
  @ViewChild('magnifier') magnifier!: ElementRef;
  @ViewChild('cartIcon', { static: true }) cartIcon!: ElementRef;
  @ViewChild('swatchStrip') swatchStrip!: ElementRef;
  @ViewChild('categoryStrip') categoryStrip!: ElementRef;

  private _snackBar = inject(MatSnackBar);

  cacheBuster: number = Date.now();

  // ── Name banner state ─────────────────────────────────────────────────────
  nameVisible = true;
  nameColor = '#ffffff';

  // ── Expandable Digital Print Format State ──
  isFormatExpanded = signal<boolean>(false);

  toggleFormatExpanded(event?: Event): void {
    if (event) event.stopPropagation();
    this.isFormatExpanded.update(v => !v);
  }

  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';

  isimageLoaded = true;
  onLoad() { this.isimageLoaded = true; }
  onError() { this.isimageLoaded = true; }

  openSnackBar(message: string) {
    this._snackBar.open(message, 'close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: 4000,
      panelClass: ['custom-snackbar'],
    });
  }

  animationParams = { startTop: 100, startLeft: 200, endTop: 50, endLeft: 150 };

  // FIX: wasPrice uses fullPriceRounded() so the strikethrough always matches
  // what would actually be stored in DB (2dp value + 20 markup).
  wasPrice = computed(() => {
    const raw = getBasePrice(this.subjectType(), this.ispetralistic(), this.numberofpetcount() + 1)
      + this.backgroundPrice() + 20;
    return parseFloat(raw.toFixed(2)).toFixed(2);
  });

  premadeproductdata: any;
  ispremade = true;
  badgeAnimating = false;

  userid = signal<number>(0);

  petname = '';
  ownername = '';
  person3name = '';
  person4name = '';
  artistnotes = '';
  backgroundstylenotes = '';
  bgfile: any;

  filestoupload: File[] = [];
  getProductFromEvent: any;

  menuOpen = false;
  profilemenuOpen = false;
  userdata: any;
  isloggedin = false;

  subjectType = signal<SubjectTypeOption>('pet');
  ispetralistic = signal<boolean>(true);
  selectedFormat = signal<'digital' | 'canvas'>('digital');

  scrollToPrintDemand(): void {
    const el = document.getElementById('print-demand-cta-button');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.router.navigate(['/printOnDemand']);
    }
  }

  @ViewChild('menu') menuRef!: ElementRef;
  @ViewChild('menuButton') buttonRef!: ElementRef;
  @ViewChild('oldNumberRef') oldNumberRef!: ElementRef;
  @ViewChild('newNumberRef') newNumberRef!: ElementRef;

  // ── 3D Room & Frame Visualizer ──────────────────────────────────────────
  isRoomModalOpen = false;

  openRoomModal(): void { this.isRoomModalOpen = true; document.body.style.overflow = 'hidden'; }
  closeRoomModal(): void { this.isRoomModalOpen = false; document.body.style.overflow = ''; }

  /** Scroll the active pill into view after selection */
  scrollActiveIntoView(rowId: string): void {
    setTimeout(() => {
      const row = document.getElementById(rowId);
      const active = row?.querySelector('.rviz-pill.active, .rviz-swatch-btn.active') as HTMLElement | null;
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 50);
  }

  get isMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 640;
  }

  roomEnvs = [
    { id: 'modern-living', label: 'Modern Living', faIcon: 'fa-couch', desc: 'Bright Scandi living room' },
    { id: 'bedroom', label: 'Master Bedroom', faIcon: 'fa-bed', desc: 'Cosy master bedroom suite' },
    { id: 'office', label: 'Studio Office', faIcon: 'fa-briefcase', desc: 'Creative workspace' },
    { id: 'cafe', label: 'Boho Café', faIcon: 'fa-mug-hot', desc: 'Rustic warm café wall' },
    { id: 'gallery', label: 'Art Gallery', faIcon: 'fa-landmark', desc: 'White-cube gallery space' },
    { id: 'outdoor', label: 'Garden Patio', faIcon: 'fa-leaf', desc: 'Outdoor patio backdrop' },
    { id: 'dining', label: 'Dining Room', faIcon: 'fa-utensils', desc: 'Elegant dining setting' },
    { id: 'nursery', label: 'Kids Nursery', faIcon: 'fa-baby', desc: 'Playful & bright nursery' },
    { id: 'loft', label: 'Urban Loft', faIcon: 'fa-city', desc: 'Industrial loft space' },
  ];
  selectedRoomEnv = 'modern-living';

  frameStyles = [
    { id: 'none', label: 'No Frame', color: 'transparent', border: '2px dashed rgba(255,255,255,0.4)' },
    { id: 'oak', label: 'Oak Wood', color: '#b37346', border: '14px solid #b37346' },
    { id: 'black', label: 'Matte Black', color: '#141414', border: '16px solid #141414' },
    { id: 'white', label: 'White Gloss', color: '#f5f5f0', border: '14px solid #f5f5f0' },
    { id: 'gold', label: 'Royal Gold', color: '#d4af37', border: '16px solid #d4af37' },
    { id: 'canvas', label: 'Canvas Wrap', color: '#e2e8f0', border: '5px solid #d1d5db' },
    { id: 'walnut', label: 'Dark Walnut', color: '#4a2c17', border: '14px solid #4a2c17' },
    { id: 'silver', label: 'Brushed Silver', color: '#c0c0c0', border: '14px solid #c0c0c0' },
    { id: 'rosegold', label: 'Rose Gold', color: '#b76e79', border: '14px solid #b76e79' },
  ];
  selectedFrame = 'canvas';

  printSizes = [
    { id: '8x10', label: '8×10"', desc: '20×25 cm · Accent', scale: 0.58 },
    { id: '8x12', label: '8×12"', desc: '20×30 cm · Small', scale: 0.64 },
    { id: '11x14', label: '11×14"', desc: '28×36 cm · Standard', scale: 0.72 },
    { id: '12x16', label: '12×16"', desc: '30×40 cm · Medium', scale: 0.78 },
    { id: '16x20', label: '16×20"', desc: '40×50 cm · Classic', scale: 0.84 },
    { id: '18x24', label: '18×24"', desc: '45×60 cm · Large', scale: 0.90 },
    { id: '20x24', label: '20×24"', desc: '50×60 cm · XL', scale: 0.96 },
    { id: '20x30', label: '20×30"', desc: '50×75 cm · XXL', scale: 1.02 },
    { id: '24x36', label: '24×36"', desc: '60×90 cm · Gallery', scale: 1.08 },
    { id: '30x40', label: '30×40"', desc: '75×100 cm · Museum', scale: 1.14 },
  ];
  selectedPrintSize = '11x14';

  lightingModes = [
    { id: 'natural', label: 'Natural Light', faIcon: 'fa-sun' },
    { id: 'sunset', label: 'Golden Sunset', faIcon: 'fa-cloud-sun' },
    { id: 'cozy', label: 'Cosy Lamp', faIcon: 'fa-lightbulb' },
    { id: 'gallery', label: 'Spotlight', faIcon: 'fa-circle-dot' },
    { id: 'moonlight', label: 'Moonlight', faIcon: 'fa-moon' },
    { id: 'neon', label: 'Neon Glow', faIcon: 'fa-bolt' },
  ];
  selectedLighting = 'natural';

  matStyles = [
    { id: 'none', label: 'No Mat', color: '' },
    { id: 'white', label: 'White', color: '#f8f8f8' },
    { id: 'cream', label: 'Cream', color: '#f5ede0' },
    { id: 'black', label: 'Black', color: '#141414' },
    { id: 'linen', label: 'Linen', color: '#e8e0d0' },
    { id: 'navy', label: 'Navy', color: '#1a2744' },
  ];
  selectedMat = 'none';

  wallColors = [
    { id: 'white', label: 'Pure White', color: '#f8f8f6' },
    { id: 'cream', label: 'Warm Cream', color: '#f5f0e8' },
    { id: 'sage', label: 'Sage Green', color: '#8fa888' },
    { id: 'slate', label: 'Slate Blue', color: '#6b7fa3' },
    { id: 'charcoal', label: 'Charcoal', color: '#3a3a3a' },
    { id: 'terracotta', label: 'Terracotta', color: '#c17a5a' },
    { id: 'dusty-rose', label: 'Dusty Rose', color: '#c49a94' },
    { id: 'midnight', label: 'Midnight', color: '#1a1a2e' },
    { id: 'forest', label: 'Forest', color: '#3d5a47' },
  ];
  selectedWallColor = 'white';

  hangingStyles = [
    { id: 'single', label: 'Single Portrait', faIcon: 'fa-image' },
    { id: 'diptych', label: 'Side by Side', faIcon: 'fa-table-columns' },
    { id: 'triptych', label: 'Triptych', faIcon: 'fa-grip' },
    { id: 'gallery', label: 'Gallery Wall', faIcon: 'fa-th-large' },
  ];
  selectedHangingStyle = 'single';

  get selectedFrameStyle(): string {
    const f = this.frameStyles.find(f => f.id === this.selectedFrame);
    return f ? f.border : '';
  }

  get selectedPrintScale(): number {
    const s = this.printSizes.find(s => s.id === this.selectedPrintSize);
    const rawScale = s ? s.scale : 0.72;
    if (typeof window !== 'undefined') {
      const h = window.innerHeight;
      const w = window.innerWidth;
      // Tight screen height (laptops, iPads, tablets) - cap scale so large sizes never overflow
      if (h <= 768 || w <= 1024) {
        return Math.min(rawScale, 0.82);
      } else if (h <= 900) {
        return Math.min(rawScale, 0.90);
      }
    }
    return Math.min(rawScale, 1.02);
  }

  getRoomBg(): string {
    return this.wallColors.find(w => w.id === this.selectedWallColor)?.color ?? '#f8f8f6';
  }

  getRoomBoxShadow(): string {
    const env = this.selectedRoomEnv;
    const shadows: Record<string, string> = {
      'modern-living': '0 80px 120px rgba(0,0,0,0.3) inset, 0 -40px 80px rgba(0,0,0,0.15) inset',
      bedroom: '0 80px 120px rgba(0,0,0,0.38) inset, 0 -30px 60px rgba(0,0,0,0.2) inset',
      office: '0 80px 120px rgba(0,0,0,0.45) inset',
      cafe: '0 80px 120px rgba(80,40,0,0.28) inset',
      gallery: '0 80px 100px rgba(0,0,0,0.18) inset',
      outdoor: '0 80px 120px rgba(0,60,0,0.18) inset',
      dining: '0 80px 120px rgba(60,30,0,0.28) inset',
      nursery: '0 60px 100px rgba(255,200,200,0.2) inset',
      loft: '0 80px 120px rgba(0,0,0,0.5) inset',
    };
    return shadows[env] ?? '';
  }

  getLightingFilter(): string {
    const filters: Record<string, string> = {
      natural: 'brightness(1.0) saturate(1.0)',
      sunset: 'brightness(0.95) saturate(1.4) sepia(0.12)',
      cozy: 'brightness(0.88) saturate(1.3) sepia(0.18)',
      gallery: 'brightness(1.05) saturate(0.9) contrast(1.05)',
      moonlight: 'brightness(0.65) saturate(0.6) hue-rotate(200deg)',
      neon: 'brightness(0.8) saturate(2.0) hue-rotate(260deg)',
    };
    return filters[this.selectedLighting] ?? 'brightness(1)';
  }

  getMatStyle(): Record<string, string> {
    const mat = this.matStyles.find(m => m.id === this.selectedMat);
    if (!mat || mat.id === 'none') return {};
    return { padding: '18px', background: mat.color };
  }

  getRvizRoomLabel(): string {
    return this.roomEnvs.find(e => e.id === this.selectedRoomEnv)?.label ?? '';
  }
  getRvizRoomDesc(): string {
    return this.roomEnvs.find(e => e.id === this.selectedRoomEnv)?.desc ?? '';
  }
  getRvizSizeLabel(): string {
    const s = this.printSizes.find(s => s.id === this.selectedPrintSize);
    return s ? `${s.label} · ${s.desc}` : '';
  }
  getRvizWallLabel(): string {
    return this.wallColors.find(w => w.id === this.selectedWallColor)?.label ?? '';
  }
  getRvizFrameLabel(): string {
    return this.frameStyles.find(f => f.id === this.selectedFrame)?.label ?? '';
  }
  getRvizMatLabel(): string {
    return this.matStyles.find(m => m.id === this.selectedMat)?.label ?? '';
  }
  getRvizLightLabel(): string {
    return this.lightingModes.find(l => l.id === this.selectedLighting)?.label ?? '';
  }
  // ── Swatch strip scroll & swipe ─────────────────────────────────────────
  isSwatchAtStart = signal<boolean>(true);
  isSwatchAtEnd = signal<boolean>(false);

  scrollSwatchStrip(dir: 'left' | 'right'): void {
    const el = this.swatchStrip?.nativeElement as HTMLElement;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' });
    setTimeout(() => this.updateSwatchScrollButtons(), 320);
  }

  updateSwatchScrollButtons(): void {
    const el = this.swatchStrip?.nativeElement as HTMLElement;
    if (!el) return;
    const threshold = 4;
    this.isSwatchAtStart.set(el.scrollLeft <= threshold);
    this.isSwatchAtEnd.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold);
  }

  scrollCategoryStrip(dir: 'left' | 'right'): void {
    const el = this.categoryStrip?.nativeElement as HTMLElement;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? 160 : -160, behavior: 'smooth' });
  }

  private _swatchTouchStartX = 0;

  onSwatchTouchStart(e: TouchEvent): void {
    this._swatchTouchStartX = e.touches[0].clientX;
  }

  onSwatchTouchMove(e: TouchEvent): void {
    const el = this.swatchStrip?.nativeElement as HTMLElement;
    if (!el) return;
    const dx = this._swatchTouchStartX - e.touches[0].clientX;
    el.scrollLeft += dx * 1.5;
    this._swatchTouchStartX = e.touches[0].clientX;
  }


  constructor(
    private sanitizer: DomSanitizer,
    private authservice: AuthService,
    private productservice: ProductService,
    private router: Router,
    private title: Title,
    private meta: Meta,
    private Toast: ToastService,
    private cdRef: ChangeDetectorRef,
    private loggingService: LoggingService,
    private userservice: UsersService,
    private loginService: LoginService,
    private socialmedia: SociallinkService,
    private renderer: Renderer2,
    private loadingService: LoadingService,
    private marketingService: MarketingService
  ) {
    if (this.premadeproductdata == null) {
      this.getpremadeproductdata();
    }

    this.authservice.checkAuth().subscribe(response => {
      this.loggingService.log(response);
      if (response.isAuthenticated && response.user) {
        const { ID } = response.user;
        this.loggingService.log(ID);
        this.isloggedin = true;
        this.getuserdata(response.user);
        this.userid.set(ID);
        if (this.cartcounter() === 0) {
          this.getcartcount();
        } else {
          this.isloggedin = false;
        }
      }
    });
  }

  stickyTranslateY = 0;

  // ── Font Preview State ───────────────────────────────────────────────────
  availableFonts = [
    // ── Initially visible (first 4) ──────────────────────────────────────
    { id: 'GreatVibe', name: 'Great Vibes', label: 'Script', family: "'Great Vibes', cursive, sans-serif" },
    { id: 'DancingScript', name: 'Dancing Script', label: 'Casual', family: "'Dancing Script', cursive, sans-serif" },
    { id: 'Sacramento', name: 'Sacramento', label: 'Signature', family: "'Sacramento', cursive, sans-serif" },
    { id: 'Pacifico', name: 'Pacifico', label: 'Playful', family: "'Pacifico', cursive, sans-serif" },
    // ── Expanded fonts (visible after Show More) ──────────────────────────
    { id: 'Satisfy', name: 'Satisfy', label: 'Calligraphy', family: "'Satisfy', cursive, sans-serif" },
    { id: 'Caveat', name: 'Caveat', label: 'Handwritten', family: "'Caveat', cursive, sans-serif" },
    { id: 'Lobster', name: 'Lobster', label: 'Bold Script', family: "'Lobster', cursive, sans-serif" },
    { id: 'Parisienne', name: 'Parisienne', label: 'Romantic', family: "'Parisienne', cursive, sans-serif" },
    { id: 'Playfair', name: 'Playfair Display', label: 'Classic Serif', family: "'Playfair Display', serif" },
    { id: 'Cinzel', name: 'Cinzel', label: 'Vintage Serif', family: "'Cinzel', serif" },
    { id: 'CinzelDecorative', name: 'Cinzel Luxe', label: 'Royal', family: "'Cinzel Decorative', serif" },
    { id: 'Cormorant', name: 'Cormorant Garamond', label: 'Elegant Serif', family: "'Cormorant Garamond', serif" },
    { id: 'Montserrat', name: 'Montserrat', label: 'Modern', family: "'Montserrat', sans-serif" },
    { id: 'Fredoka', name: 'Fredoka', label: 'Cute Rounded', family: "'Fredoka', sans-serif" },
    { id: 'Nunito', name: 'Nunito', label: 'Soft & Friendly', family: "'Nunito', sans-serif" },
    { id: 'Quicksand', name: 'Quicksand', label: 'Geometric', family: "'Quicksand', sans-serif" },
    { id: 'Lora', name: 'Lora', label: 'Literary', family: "'Lora', serif" },
    { id: 'EB Garamond', name: 'EB Garamond', label: 'Timeless', family: "'EB Garamond', serif" },
    { id: 'Abril', name: 'Abril Fatface', label: 'Display Bold', family: "'Abril Fatface', cursive" },
    { id: 'Righteous', name: 'Righteous', label: 'Retro Pop', family: "'Righteous', cursive, sans-serif" },
  ];
  selectedFont = 'GreatVibe';
  selectedFontFamily = "'Great Vibes', cursive, sans-serif";

  /** Toggle state for Show More / Show Less */
  showAllFonts = false;

  /** Returns only the first 4 fonts, or all when expanded */
  get visibleFonts() {
    return this.showAllFonts ? this.availableFonts : this.availableFonts.slice(0, 4);
  }

  /** Count of hidden fonts */
  get hiddenFontsCount() {
    return this.availableFonts.length - 4;
  }

  get selectedFontObj() {
    return this.availableFonts.find(f => f.id === this.selectedFont) || this.availableFonts[0];
  }

  get fontPreviewSampleText(): string {
    return this.previewName;
  }

  onFontChange(fontId: string) {
    this.selectedFont = fontId;
    const found = this.availableFonts.find(f => f.id === fontId);
    if (found) {
      this.selectedFontFamily = found.family;
    }
  }

  // ── Artist Notes Suggestions (Filtered by Subject Type) ────────────────────
  get currentArtistNoteSuggestions(): string[] {
    const type = this.subjectType();
    if (type === 'yourself') {
      return [
        'Adjust hairstyle / color',
        'Remove background elements',
        'Add subtle portrait retouching',
        'Match skin tone & lighting',
        'Enhance facial details',
        'Ask artist for font options'
      ];
    } else if (type === 'family') {
      return [
        'Family / Couple Keepsake',
        'Anniversary / Wedding theme',
        'Compose members together',
        'Include heart & warm accents',
        'Harmonize outfit colors',
        'Ask artist for font options'
      ];
    } else if (type === 'both') {
      return [
        'Remove pet collar & leash',
        'Compose pet & owner together',
        'Include favorite pet toy',
        'Match lighting & colors',
        'Enhance fur & hair detail',
        'Ask artist for font options'
      ];
    } else {
      return [
        'Remove leash & collar',
        'Add royal halo & wings',
        'Include favorite toy',
        'Enhance fur detail & eye shine',
        'Match original eye/fur color',
        'Ask artist for font options'
      ];
    }
  }

  // ── AI Artist Prompt Assistant & Tag Separator Management ─────────────
  get artistNoteTags(): string[] {
    if (!this.artistnotes) return [];
    return this.artistnotes
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  isTagActive(suggestion: string): boolean {
    const clean = suggestion.trim().toLowerCase();
    return this.artistNoteTags.some(tag => tag.toLowerCase() === clean);
  }

  addNoteSuggestion(suggestion: string): void {
    const cleanSuggestion = suggestion.trim();
    if (!cleanSuggestion) return;

    let currentTags = [...this.artistNoteTags];
    const index = currentTags.findIndex(tag => tag.toLowerCase() === cleanSuggestion.toLowerCase());
    
    if (index >= 0) {
      currentTags.splice(index, 1);
    } else {
      currentTags.push(cleanSuggestion);
    }

    this.artistnotes = currentTags.length > 0 ? currentTags.join(', ') + ', ' : '';
  }

  removeNoteTag(tagToRemove: string): void {
    let currentTags = this.artistNoteTags.filter(tag => tag.toLowerCase() !== tagToRemove.toLowerCase());
    this.artistnotes = currentTags.length > 0 ? currentTags.join(', ') + ', ' : '';
  }

  clearAllNoteTags(): void {
    this.artistnotes = '';
  }

  onArtistNotesKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const val = this.artistnotes.trim();
      if (val && !val.endsWith(',')) {
        this.artistnotes = val + ', ';
      }
    }
  }

  onArtistNotesInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    let val = textarea.value;

    // Prevent multiple consecutive commas like ,, or , ,
    val = val.replace(/,[\s]*,+/g, ',');
    this.artistnotes = val;
  }

  onMobileNoteSuggestionSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.addNoteSuggestion(select.value);
      select.value = '';
    }
  }

  // ── Quick Add / Ready-Made Subject Filtering, Search & Sorting ───────────
  quickAddSubjectFilter: 'all' | 'pet' | 'yourself' | 'both' | 'family' = 'all';
  quickAddStyleFilter: 'all' | 'realistic' | 'cartoon' = 'all';
  catalogSearchQuery: string = '';
  catalogSortBy: 'featured' | 'low-high' | 'high-low' | 'discount' = 'featured';

  setQuickAddFilter(filter: 'all' | 'pet' | 'yourself' | 'both' | 'family') {
    this.quickAddSubjectFilter = filter;
    if (filter !== 'pet' && filter !== 'all') {
      this.activeBreedFilter.set('all');
    }
  }

  setBreedFilter(breed: string): void {
    this.activeBreedFilter.set(breed);
    setTimeout(() => {
      // 1. Center selected pill horizontally in scrollable bar
      const activeEl = document.querySelector('.breed-pills-bar .breed-pill-btn.active') as HTMLElement;
      activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

      // 2. Smoothly scroll page to top of product grid
      const gridEl = document.querySelector('.pgrid, #product-grid, #catalog-grid') as HTMLElement;
      if (gridEl) {
        const topOffset = gridEl.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    }, 60);
  }

  // ── Shop Section Sub-filters & Quick View & AR Room & Recently Viewed ──
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
  selectedQuickView = signal<any | null>(null);

  // 3D Room Visualizer Modal State for Catalog
  isCatalogRoomModalOpen = signal<boolean>(false);
  selectedArProduct = signal<any | null>(null);
  selectedRoomBg = signal<string>('linear-gradient(135deg, #1e293b 0%, #0f172a 100%)');
  catalogFrameStyle = signal<'oak' | 'black' | 'gold' | 'white'>('black');
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

  // Recently Viewed Drawer
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

  // ── Live Catalog AR Camera Stream State ──────
  isCatalogArCameraActive = signal<boolean>(false);
  catalogArCameraError = signal<string | null>(null);
  private catalogArStream: MediaStream | null = null;

  async toggleCatalogArCamera(): Promise<void> {
    if (this.isCatalogArCameraActive()) {
      this.stopCatalogArCamera();
    } else {
      await this.startCatalogArCamera();
    }
  }

  async startCatalogArCamera(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.catalogArCameraError.set('Camera access is not supported on this browser.');
      return;
    }
    this.stopCatalogArCamera();
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
      this.catalogArStream = stream;
      this.isCatalogArCameraActive.set(true);
      this.catalogArCameraError.set(null);

      setTimeout(() => {
        const video = document.getElementById('catalog-ar-video-feed') as HTMLVideoElement;
        if (video && stream) {
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          video.play().catch(e => console.warn('Catalog AR Video Play error:', e));
        }
      }, 100);
    } catch (err: any) {
      this.isCatalogArCameraActive.set(false);
      this.catalogArCameraError.set('Camera access denied or device unavailable.');
    }
  }

  stopCatalogArCamera(): void {
    if (this.catalogArStream) {
      this.catalogArStream.getTracks().forEach(track => track.stop());
      this.catalogArStream = null;
    }
    this.isCatalogArCameraActive.set(false);
  }

  openArRoomModal(item: any): void {
    this.selectedArProduct.set(item);
    this.isCatalogRoomModalOpen.set(true);
    this.trackRecentlyViewed(item);
  }

  closeArRoomModal(): void {
    this.stopCatalogArCamera();
    this.isCatalogRoomModalOpen.set(false);
  }

  setRoomBg(bgStr: string, event?: Event): void {
    this.stopCatalogArCamera();
    this.selectedRoomBg.set(bgStr);
    this.autoScrollPill(event);
  }

  setCanvasSize(size: string, event?: Event): void {
    this.selectedCanvasSize.set(size);
    this.autoScrollPill(event);
  }

  setCatalogFrameStyle(style: 'oak' | 'black' | 'gold' | 'white', event?: Event): void {
    this.catalogFrameStyle.set(style);
    this.autoScrollPill(event);
  }

  scrollArToolsRow(direction: 'left' | 'right'): void {
    const row = document.querySelector('.ar-tb-tools-row') as HTMLElement;
    if (row) {
      const scrollAmount = direction === 'left' ? -140 : 140;
      row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
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

  autoScrollArTool(event?: Event): void {
    const target = (event?.currentTarget as HTMLElement);
    if (!target) return;
    setTimeout(() => {
      const container = (target.closest('.ar-tb-tools-row') as HTMLElement) || target.parentElement;
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

  getDiscountPct(item: any): number {
    const price = Number(item?.price) || 0;
    const discount = Number(item?.discount) || 0;
    if (!price || price <= 0 || !discount || discount <= 0) return 0;
    const pct = Math.round((discount / price) * 100);
    return Math.min(Math.max(pct, 0), 99);
  }

  openQuickView(item: any): void {
    this.selectedQuickView.set(item);
    this.trackRecentlyViewed(item);
  }

  closeQuickView(): void {
    this.selectedQuickView.set(null);
  }

  getProductRating(item: any): { rating: string; count: number } {
    const idNum = item.id || (item.name ? item.name.length * 7 : 42);
    const rating = (4.8 + (idNum % 3) * 0.1).toFixed(1);
    const count = 18 + (idNum % 65);
    return { rating, count };
  }

  setQuickAddStyleFilter(filter: 'all' | 'realistic' | 'cartoon') {
    this.quickAddStyleFilter = filter;
  }

  get filteredPremadeProducts() {
    if (!this.premadeproductdata) return [];
    let list = [...this.premadeproductdata];

    // 1. Filter by Subject Type
    if (this.quickAddSubjectFilter !== 'all') {
      list = list.filter((item: any) => {
        const st = (item.subject_type || 'pet').toLowerCase();
        return st === this.quickAddSubjectFilter;
      });
    }

    // 2. Filter by Art Style
    if (this.quickAddStyleFilter !== 'all') {
      list = list.filter((item: any) => {
        const style = (item.art_style || item.style || '').toLowerCase();
        if (this.quickAddStyleFilter === 'realistic') {
          return style.includes('real') || !style.includes('cart');
        } else {
          return style.includes('cart');
        }
      });
    }

    // 3. Filter by Breed
    const breed = this.activeBreedFilter();
    if (breed && breed.toLowerCase() !== 'all' && breed.toLowerCase() !== 'all breeds') {
      const bLower = breed.toLowerCase();
      list = list.filter((item: any) => {
        const breedVal = (item.breed || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return breedVal.includes(bLower) || name.includes(bLower) || desc.includes(bLower);
      });
    }

    // 3. Search Query Filter
    if (this.catalogSearchQuery && this.catalogSearchQuery.trim()) {
      const q = this.catalogSearchQuery.toLowerCase().trim();
      list = list.filter((item: any) => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const subj = (item.subject_type || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || subj.includes(q);
      });
    }

    // 4. Sort Catalog
    if (this.catalogSortBy === 'featured') {
      list.sort((a: any, b: any) => {
        const featA = (a.is_featured || a.featured || a.isFeatured) ? 1 : 0;
        const featB = (b.is_featured || b.featured || b.isFeatured) ? 1 : 0;
        return featB - featA;
      });
    } else if (this.catalogSortBy === 'low-high') {
      list.sort((a: any, b: any) => (+a.price - +a.discount) - (+b.price - +b.discount));
    } else if (this.catalogSortBy === 'high-low') {
      list.sort((a: any, b: any) => (+b.price - +b.discount) - (+a.price - +a.discount));
    } else if (this.catalogSortBy === 'discount') {
      list.sort((a: any, b: any) => +b.discount - +a.discount);
    }

    return list;
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (typeof window === 'undefined' || window.innerWidth < 992) {
      this.stickyTranslateY = 0;
      return;
    }

    const cardCol = document.querySelector('.product-card-col') as HTMLElement;
    const formInfo = document.getElementById('product-info') as HTMLElement;
    const bgCard = document.getElementById('productPageBg') as HTMLElement;
    const addToCartElem = document.getElementById('add-to-cart-container') as HTMLElement;

    if (cardCol && formInfo && bgCard) {
      const colRect = cardCol.getBoundingClientRect();
      const cardHeight = bgCard.offsetHeight || 680;

      // Maintain consistent padding below sticky navbar when scrolling down & up
      const navbarOffset = 90;
      const scrollOffset = navbarOffset - colRect.top;

      // Limit maximum translation so the bottom of the left card stops at Add to Cart
      let limitBottom = formInfo.offsetHeight;
      if (addToCartElem) {
        const formTop = formInfo.getBoundingClientRect().top;
        const addToCartBottom = addToCartElem.getBoundingClientRect().bottom;
        limitBottom = addToCartBottom - formTop;
      }

      const maxTranslate = Math.max(0, limitBottom - cardHeight);

      if (scrollOffset > 0) {
        this.stickyTranslateY = Math.min(scrollOffset, maxTranslate);
      } else {
        this.stickyTranslateY = 0;
      }
    }
  }

  ngOnInit(): void {
    this.meta.updateTag({ name: 'keywords', content: 'pet portrait, custom pet art, canvas print, pet illustration, dog portrait, cat portrait, hand-drawn pet portrait' });
    this.meta.updateTag({ property: 'og:title', content: 'Custom Pet & Owner Portraits | Purrfect Pal Studio' });
    this.meta.updateTag({ property: 'og:description', content: 'Personalised pet & owner portraits from your photo. Perfect gift idea with fast delivery.' });
    this.meta.updateTag({ property: 'og:image', content: 'https://purrfectpal.studio/assets/demo/detailedtexturedog.png' });
    this.meta.updateTag({ name: 'twitter:image', content: 'https://purrfectpal.studio/assets/demo/detailedtexturedog.png' });
    this.sampleBackgroundColor();
    this.loadSEOMetadata();
    this.initSocialProofQueue();

    if (typeof window !== 'undefined' && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('ar') && searchParams.get('ar') === '1') {
        const frame = searchParams.get('frame');
        if (frame) this.selectedFrame = frame;

        const size = searchParams.get('size');
        if (size) this.selectedPrintSize = size;

        const bg = searchParams.get('bg');
        if (bg) this.selectedBackground = bg;

        const costume = searchParams.get('costume');
        if (costume) this.selectedCostume.set(costume);

        const artwork = searchParams.get('artwork');
        if (artwork) this.selectedArtwork = artwork;

        const wall = searchParams.get('wall');
        if (wall) this.selectedWallColor = wall;

        const light = searchParams.get('light');
        if (light) this.selectedLighting = light;

        const mat = searchParams.get('mat');
        if (mat) this.selectedMat = mat;

        const name = searchParams.get('name');
        if (name) {
          this.petname = name;
          this.nameVisible = true;
        }

        const owner = searchParams.get('owner');
        if (owner) this.ownername = owner;

        const nameOpt = searchParams.get('nameOpt');
        if (nameOpt) this.PetSelectedOption = nameOpt;

        const stype = searchParams.get('stype');
        if (stype) this.subjectType.set(stype as any);

        const font = searchParams.get('font');
        if (font) this.selectedFontFamily = font;

        const nameColor = searchParams.get('nameColor');
        if (nameColor) this.nameColor = nameColor;

        setTimeout(() => {
          this.isArCameraActive.set(true);
          this.initArCamera();
        }, 500);
      }
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
      this.ispetralistic.set(false);
      this.subjectType.set('pet');
      this.scrollToTop();
    } else if (lower.includes('dog') || lower.includes('cat') || lower.includes('pet')) {
      this.subjectType.set('pet');
      this.scrollToTop();
    } else {
      this.scrollToTop();
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

  innerWidth = window.innerWidth;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  opensocialurl(pos: number) { this.socialmedia.geturl(pos); }

  getuserdata(resdata: any): void {
    const { user_id } = resdata;
    this.loggingService.log(user_id);
    this.userservice.getuserdetailbyid(user_id).pipe().subscribe(
      (data) => this.userdata = data
    );
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = '/assets/images/profile-picture.png';
  }

  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  profiletoggleMenu(): void { this.profilemenuOpen = !this.profilemenuOpen; }

  logout() {
    this.loginService.logoutuser().pipe().subscribe(
      (response) => {
        this.router.navigate(['/Login']);
        this.authservice.setUser(null);
        this.loggingService.log('Logout successful:', response);
        this.Toast.showToast('success', 'Logout', 'Logged out successfully.');
      },
      (error) => {
        this.loggingService.error('Logout failed:', error);
        this.Toast.showToast('error', 'Logout', 'Logout failed.');
      }
    );
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

  getpremadeproductdata(): void {
    this.productservice.getrandomdata().subscribe(
      (data) => this.premadeproductdata = data
    );
  }

  scrollToTop() {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      window.scrollTo({ top: 50, behavior: 'smooth' });
    }
  }

  selectedfile: { files: ExtendedFilesData[] } = { files: [] };

  poisitionofartwork = signal<number>(0);
  numberofpetcount = signal<number>(0);

  backgroundPrice = signal<number>(0);
  isCopyrightChecked = signal(false);

  cartrealaststiccounter = signal<number>(0);
  cartcartooncounter = signal<number>(0);
  cartreadymadecounter = signal<number>(0);

  cartcounter = computed(() =>
    this.cartrealaststiccounter() + this.cartcartooncounter() + this.cartreadymadecounter()
  );

  setcounter(art_style?: string): void {
    if (art_style === 'Realistic') this.cartrealaststiccounter.set(this.cartrealaststiccounter() + 1);
    else if (art_style === 'Cartoonised') this.cartcartooncounter.set(this.cartcartooncounter() + 1);
    else if (art_style === 'Ready-Made') this.cartreadymadecounter.set(this.cartreadymadecounter() + 1);

    this.badgeAnimating = true;
    setTimeout(() => this.badgeAnimating = false, 400);
  }

  // ── New Premium Feature Signals ──
  isExpressDelivery = signal<boolean>(false);
  selectedCostume = signal<string>('none');
  beforeAfterPos = signal<number>(50);
  photoQualityResult = signal<{ score: 'excellent' | 'good' | 'warning'; text: string; icon: string } | null>(null);

  // ── Outfit & Costume Theme Options ($0 fee — Saved for future update) ──
  costumeOptions = [
    { id: 'none', label: 'Classic (Original)', icon: 'fa-paint-brush' },
    { id: 'admiral', label: 'Royal Admiral', icon: 'fa-crown' },
    { id: 'tuxedo', label: 'Formal Tuxedo', icon: 'fa-user-tie' },
    { id: 'boho', label: 'Floral Boho Crown', icon: 'fa-leaf' },
    { id: 'astronaut', label: 'Space Astronaut', icon: 'fa-user-astronaut' },
    { id: 'queen', label: 'Renaissance Queen', icon: 'fa-chess-queen' },
  ];

  // ── Live Social Proof Queue & Traffic Control System ──
  toastQueue = signal<SocialOrderToast[]>([]);
  activeToast = signal<SocialOrderToast | null>(null);
  toastState = signal<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');

  private toastAutoTimer: any = null;
  private toastTrafficGapTimer: any = null;
  private toastPollTimer: any = null;
  private toastInitialDelayTimer: any = null;
  private isToastDismissedByUser = false;

  toggleExpressDelivery(): void {
    this.isExpressDelivery.set(!this.isExpressDelivery());
    this.pulseAnimation();
  }

  setCostume(id: string, event?: Event): void {
    this.selectedCostume.set(id);
    if (event?.currentTarget) {
      const el = event.currentTarget as HTMLElement;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  getSelectedCostumeLabel(): string {
    const c = this.costumeOptions.find(opt => opt.id === this.selectedCostume());
    return c ? c.label : '';
  }

  getSelectedCostumeIcon(): string {
    const c = this.costumeOptions.find(opt => opt.id === this.selectedCostume());
    return c ? c.icon : 'fa-crown';
  }

  getSelectedBackgroundLabel(): string {
    if (this.showCustom) return 'Custom Background';
    if (!this.selectedBackground) return 'Studio Background';
    const bg = this.preMadeBackground.find(b => b.url === this.selectedBackground);
    if (bg) return bg.label;
    if (this.selectedBackground.includes('gradient')) return 'Gradient Style';
    return 'Premade Style';
  }

  activeTagTooltip = signal<string | null>(null);

  toggleTagTooltip(type: 'art' | 'subject' | 'costume' | 'bg', event?: Event): void {
    if (event) event.stopPropagation();
    let text = '';
    if (type === 'art') text = this.ispetralistic() ? 'Realistic Art Style' : 'Cartoonised Art Style';
    if (type === 'subject') text = 'Subject: ' + this.getSubjectLabel();
    if (type === 'costume') text = 'Outfit: ' + this.getSelectedCostumeLabel();
    if (type === 'bg') text = 'Background: ' + this.getSelectedBackgroundLabel();

    if (this.activeTagTooltip() === text) {
      this.activeTagTooltip.set(null);
    } else {
      this.activeTagTooltip.set(text);
      setTimeout(() => {
        if (this.activeTagTooltip() === text) {
          this.activeTagTooltip.set(null);
        }
      }, 3500);
    }
  }

  getFirstName(fullName: string): string {
    if (!fullName || fullName === 'null' || fullName === 'N/A' || fullName === 'undefined') return 'Verified Customer';
    const clean = fullName.trim().split(' ')[0];
    const lettersOnly = clean.replace(/[^a-zA-Z]/g, '');
    return lettersOnly.length > 0 ? lettersOnly : 'Verified Customer';
  }

  initSocialProofQueue(): void {
    this.toastQueue.set([]);
    this.isToastDismissedByUser = false;

    // Fetch live backend orders quietly into queue without immediate pop-up
    this.fetchRecentOrdersFromBackend(false);

    if (typeof window !== 'undefined') {
      // Periodic background sync from backend every 60s
      this.toastPollTimer = setInterval(() => {
        this.fetchRecentOrdersFromBackend(false);
      }, 60000);

      // Only trigger initial toast after a graceful 10-second delay so user can view page first
      this.toastInitialDelayTimer = setTimeout(() => {
        if (!this.isToastDismissedByUser && this.toastQueue().length > 0) {
          this.processNextToast();
        }
      }, 10000);
    }
  }

  pauseToastTimer(): void {
    if (this.toastAutoTimer) {
      clearTimeout(this.toastAutoTimer);
      this.toastAutoTimer = null;
    }
  }

  resumeToastTimer(): void {
    if (this.toastState() === 'visible' && !this.toastAutoTimer) {
      this.toastAutoTimer = setTimeout(() => {
        this.dismissCurrentToast(false);
      }, 3500);
    }
  }

  fetchRecentOrdersFromBackend(triggerImmediately: boolean = false): void {
    try {
      this.productservice.getRecentOrdersActivity().subscribe({
        next: (res: any) => {
          if (res && Array.isArray(res) && res.length > 0) {
            const realBackendOrders: SocialOrderToast[] = res.map((item: any, idx: number) => ({
              id: item.id || ('db-' + (item.ID || idx)),
              name: item.name ? this.getFirstName(item.name) : 'Customer',
              location: item.location || 'Australia',
              item: item.item || item.name || 'Custom Pet Portrait',
              time: item.time || 'Verified Order',
              avatar: item.avatar || (item.art_style === 'Cartoonised' ? '🎨' : '🐕')
            }));

            this.toastQueue.set(realBackendOrders);

            if (triggerImmediately && !this.isToastDismissedByUser && this.toastState() === 'hidden') {
              this.processNextToast();
            }
          }
        },
        error: (err: any) => {
          // Fallback to mycart recent
          this.productservice.getmycartdata().subscribe({
            next: (cartRes: any) => {
              if (cartRes && Array.isArray(cartRes) && cartRes.length > 0) {
                const fallbackOrders: SocialOrderToast[] = cartRes.map((item: any, idx: number) => ({
                  id: item.id || ('cart-' + idx),
                  name: item.name ? this.getFirstName(item.name) : 'Verified Customer',
                  location: item.location || 'Australia',
                  item: item.item || item.name || 'Custom Pet Portrait',
                  time: item.time || 'Verified Order',
                  avatar: item.avatar || '🎨'
                }));
                this.toastQueue.set(fallbackOrders);
                if (triggerImmediately && !this.isToastDismissedByUser && this.toastState() === 'hidden') {
                  this.processNextToast();
                }
              }
            }
          });
        }
      });
    } catch (e) {
      // Graceful error handling
    }
  }

  processNextToast(): void {
    if (this.isToastDismissedByUser || this.toastState() !== 'hidden' || this.activeToast() !== null) {
      return;
    }

    const queue = [...this.toastQueue()];
    if (queue.length === 0) return;

    const nextOrder = queue.shift()!;
    queue.push(nextOrder);
    this.toastQueue.set(queue);

    this.activeToast.set(nextOrder);
    this.toastState.set('entering');

    setTimeout(() => {
      this.toastState.set('visible');

      this.toastAutoTimer = setTimeout(() => {
        this.dismissCurrentToast(false);
      }, 5500);
    }, 380);
  }

  dismissCurrentToast(isManualUserDismiss: boolean = false): void {
    if (this.toastAutoTimer) {
      clearTimeout(this.toastAutoTimer);
      this.toastAutoTimer = null;
    }

    if (isManualUserDismiss) {
      this.isToastDismissedByUser = true;
      // Re-enable after 3 minutes if user closed it manually
      setTimeout(() => {
        this.isToastDismissedByUser = false;
      }, 180000);
    }

    if (this.toastState() === 'hidden') return;

    this.toastState.set('exiting');

    setTimeout(() => {
      this.toastState.set('hidden');
      this.activeToast.set(null);

      // Only schedule next background toast if not manually closed by user
      if (!this.isToastDismissedByUser) {
        this.toastTrafficGapTimer = setTimeout(() => {
          this.processNextToast();
        }, 22000);
      }
    }, 380);
  }

  enqueueLiveUserOrder(itemName: string): void {
    // When user directly triggers an action (e.g. Add to Cart), override dismissal to celebrate
    this.isToastDismissedByUser = false;
    if (this.toastTrafficGapTimer) clearTimeout(this.toastTrafficGapTimer);

    const liveOrder: SocialOrderToast = {
      id: 'live-' + Date.now(),
      name: 'You',
      location: 'Just Now',
      item: itemName || 'Custom Pet Portrait',
      time: 'Added to Cart ✓',
      avatar: '🛍️'
    };

    const current = [liveOrder, ...this.toastQueue()];
    this.toastQueue.set(current);

    if (this.toastState() === 'hidden') {
      this.processNextToast();
    }
  }

  // ── AR Camera Wall View Simulation ──
  isArCameraActive = signal<boolean>(false);
  showArQrModal = signal<boolean>(false);
  isQrLoaded = signal<boolean>(false);

  isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  }

  toggleArCameraView(): void {
    if (!this.isMobileDevice()) {
      // Desktop/Laptop: Display Mobile AR QR Code modal
      const nextState = !this.showArQrModal();
      if (nextState) {
        this.isQrLoaded.set(false);
      }
      this.showArQrModal.set(nextState);
      return;
    }

    // Mobile: Launch live AR camera stream
    this.isArCameraActive.set(!this.isArCameraActive());
    if (this.isArCameraActive()) {
      this.initArCamera();
    } else {
      this.stopArCamera();
    }
  }

  onQrLoaded(): void {
    setTimeout(() => {
      this.isQrLoaded.set(true);
    }, 700);
  }

  get arQrCodeUrl(): string {
    const domain = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
      ? window.location.origin
      : 'https://purrfectpal.studio';

    const params = new URLSearchParams();
    params.set('ar', '1');

    if (this.selectedFrame) params.set('frame', this.selectedFrame);
    if (this.selectedPrintSize) params.set('size', this.selectedPrintSize);
    if (this.selectedBackground) params.set('bg', this.selectedBackground);
    if (this.selectedCostume()) params.set('costume', this.selectedCostume());
    if (this.selectedArtwork) params.set('artwork', this.selectedArtwork);
    if (this.selectedWallColor) params.set('wall', this.selectedWallColor);
    if (this.selectedLighting) params.set('light', this.selectedLighting);
    if (this.selectedMat) params.set('mat', this.selectedMat);
    if (this.previewName || this.petname) params.set('name', this.previewName || this.petname);
    if (this.ownername) params.set('owner', this.ownername);
    if (this.PetSelectedOption) params.set('nameOpt', this.PetSelectedOption);
    if (this.subjectType()) params.set('stype', this.subjectType());
    if (this.selectedFontFamily) params.set('font', this.selectedFontFamily);
    if (this.nameColor) params.set('nameColor', this.nameColor);

    const targetUrl = encodeURIComponent(`${domain}/ProductPage?${params.toString()}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=H&margin=2&data=${targetUrl}`;
  }

  arCameraError = signal<string | null>(null);
  private arMediaStream: MediaStream | null = null;
  arScale = signal<number>(1.0);
  arPosX = signal<number>(0);
  arPosY = signal<number>(0);

  // ── Real-world Size Ruler Label ──
  getArSelectedSizeLabel(): string {
    const s = this.printSizes.find(item => item.id === this.selectedPrintSize);
    return s ? `${s.label} (${s.desc})` : '11×14" (28×36 cm)';
  }

  // ── AR Room Lighting Simulator Presets ──
  arLightingFilter = signal<'none' | 'daylight' | 'warm' | 'evening' | 'studio'>('none');
  isArToolsFolded = signal<boolean>(false);
  arSnapshotSuccessMsg = signal<string | null>(null);

  // ── AR Photo Snapshot Modal & Destination Selector ──
  isSnapshotModalOpen = signal<boolean>(false);
  snapshotDataUrl = signal<string | null>(null);

  // ── Long-Press AR Options Sliding Modal State ──
  isArOptionsMenuOpen = signal<boolean>(false);
  activeArOptionsType = signal<'lighting' | 'frame' | 'size' | 'tilt' | null>(null);
  private longPressTimer: any = null;

  readonly arLightingPresets = [
    { id: 'none', label: 'Natural Light', icon: 'fa-sun text-warning', filter: 'none' },
    { id: 'daylight', label: 'Daylight 6500K', icon: 'fa-cloud-sun text-info', filter: 'brightness(1.25) contrast(1.15) saturate(1.25)' },
    { id: 'warm', label: 'Golden Sunset', icon: 'fa-fire-flame-curved text-warning', filter: 'sepia(0.45) saturate(1.4) hue-rotate(-20deg) brightness(1.08)' },
    { id: 'evening', label: 'Evening Mood', icon: 'fa-moon text-indigo', filter: 'brightness(0.75) contrast(1.25) hue-rotate(180deg) saturate(0.7)' },
    { id: 'studio', label: 'Studio Softbox', icon: 'fa-lightbulb text-gold', filter: 'contrast(1.35) brightness(1.15) saturate(1.3)' }
  ] as const;

  getArFilterStyle(): string {
    const preset = this.arLightingPresets.find(p => p.id === this.arLightingFilter());
    return preset ? preset.filter : 'none';
  }

  getArFilterNgStyle(): Record<string, string> {
    const filterVal = this.getArFilterStyle();
    return {
      'filter': filterVal,
      '-webkit-filter': filterVal,
      'will-change': 'filter'
    };
  }

  setArLightingFilter(id: 'none' | 'daylight' | 'warm' | 'evening' | 'studio'): void {
    this.arLightingFilter.set(id);
  }

  cycleArLightingFilter(): void {
    const current = this.arLightingFilter();
    const order: Array<'none' | 'daylight' | 'warm' | 'evening' | 'studio'> = ['none', 'daylight', 'warm', 'evening', 'studio'];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    this.arLightingFilter.set(next);
  }

  getArLightingPresetLabel(): string {
    const current = this.arLightingFilter();
    const preset = this.arLightingPresets.find(p => p.id === current);
    return preset ? preset.label : 'Natural Light';
  }

  getArLightingIcon(): string {
    const current = this.arLightingFilter();
    const preset = this.arLightingPresets.find(p => p.id === current);
    return preset ? preset.icon : 'fa-sun text-warning';
  }

  private isLongPressTriggered = false;

  onArToolMouseDown(type: 'lighting' | 'align' | '3d' | 'rotate' | 'scale' | 'photo' | 'reset' | 'general', event?: Event): void {
    this.isLongPressTriggered = false;
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.isLongPressTriggered = true;
      this.activeArOptionsType.set(type as any);
      this.isArOptionsMenuOpen.set(true);
    }, 300);
  }

  onArToolMouseUp(): void {
    this.clearLongPressTimer();
  }

  onArToolTouchStart(type: 'lighting' | 'align' | '3d' | 'rotate' | 'scale' | 'photo' | 'reset' | 'general', event?: Event): void {
    this.isLongPressTriggered = false;
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.isLongPressTriggered = true;
      this.activeArOptionsType.set(type as any);
      this.isArOptionsMenuOpen.set(true);
    }, 300);
  }

  onArToolTouchEnd(): void {
    this.clearLongPressTimer();
  }

  onArContextMenu(event: Event, type: 'lighting' | 'align' | '3d' | 'rotate' | 'scale' | 'photo' | 'reset' | 'general'): void {
    event.preventDefault();
    this.clearLongPressTimer();
    this.isLongPressTriggered = true;
    this.activeArOptionsType.set(type as any);
    this.isArOptionsMenuOpen.set(true);
  }

  onArToolClick(type: 'lighting' | 'align' | '3d' | 'rotate' | 'scale' | 'photo' | 'reset' | 'general', event?: Event): void {
    if (this.isLongPressTriggered) {
      this.isLongPressTriggered = false;
      return;
    }
    if (type === 'lighting') {
      this.cycleArLightingFilter();
      this.autoScrollArTool(event);
    } else if (type === 'align') {
      this.alignToWallPerfectly();
      this.autoScrollArTool(event);
    } else if (type === '3d') {
      this.toggle3dWallMode();
      this.autoScrollArTool(event);
    } else if (type === 'rotate') {
      this.rotateArCanvas();
      this.autoScrollArTool(event);
    } else if (type === 'general') {
      this.toggleArToolsFold();
    } else if (type === 'photo') {
      this.captureArSnapshot();
      this.autoScrollArTool(event);
    } else if (type === 'reset') {
      this.resetArPosition();
      this.autoScrollArTool(event);
    }
  }

  clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  toggleArToolsFold(): void {
    this.isArToolsFolded.set(!this.isArToolsFolded());
  }

  @HostListener('window:popstate')
  @HostListener('window:pagehide')
  @HostListener('window:beforeunload')
  onBrowserNavigation(): void {
    if (this.isArCameraActive()) {
      this.closeArCameraView();
    }
  }
  arScreenRotation = signal<number>(0);
  arCanvasRotation = signal<number>(0);
  arSubjectScale = signal<number>(0.94);

  // ── Animated AR Wall Guide Modal & Tutorial ──
  isArGuideVisible = signal<boolean>(false);
  arGuideStep = signal<number>(1);

  openArGuide(): void {
    this.arGuideStep.set(1);
    this.isArGuideVisible.set(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenArGuide', 'true');
    }
  }

  closeArGuide(): void {
    this.isArGuideVisible.set(false);
  }

  nextArGuideStep(): void {
    if (this.arGuideStep() < 6) {
      this.arGuideStep.set(this.arGuideStep() + 1);
    } else {
      this.closeArGuide();
    }
  }

  prevArGuideStep(): void {
    if (this.arGuideStep() > 1) {
      this.arGuideStep.set(this.arGuideStep() - 1);
    }
  }

  // ── Animated How to Order / Customize Guide ──
  isOrderGuideVisible = signal<boolean>(false);
  orderGuideStep = signal<number>(1);

  openOrderGuide(): void {
    this.orderGuideStep.set(1);
    this.isOrderGuideVisible.set(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenOrderGuide', 'true');
    }
  }

  closeOrderGuide(): void {
    this.isOrderGuideVisible.set(false);
  }

  nextOrderGuideStep(): void {
    if (this.orderGuideStep() < 6) {
      this.orderGuideStep.set(this.orderGuideStep() + 1);
    } else {
      this.closeOrderGuide();
    }
  }

  prevOrderGuideStep(): void {
    if (this.orderGuideStep() > 1) {
      this.orderGuideStep.set(this.orderGuideStep() - 1);
    }
  }

  rotateArScreen(): void {
    this.arScreenRotation.set((this.arScreenRotation() + 90) % 360);
  }

  rotateArCanvas(): void {
    this.arCanvasRotation.set((this.arCanvasRotation() + 90) % 360);
  }

  adjustSubjectScale(delta: number): void {
    const next = Math.min(1.0, Math.max(0.4, +(this.arSubjectScale() + delta).toFixed(2)));
    this.arSubjectScale.set(next);
  }

  getSubjectScalePercent(): number {
    return Math.round(this.arSubjectScale() * 100);
  }

  private isDraggingAr = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialArX = 0;
  private initialArY = 0;
  private lastTapTime = 0;
  private initialPinchDist = 0;
  private initialPinchScale = 1.0;

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }

  onArTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      this.isDraggingAr = false;
      this.initialPinchDist = this.getTouchDistance(event.touches[0], event.touches[1]);
      this.initialPinchScale = this.arScale();
      return;
    }

    if (event.touches.length === 1) {
      const now = Date.now();
      if (now - this.lastTapTime < 300) {
        event.preventDefault();
      }
      this.lastTapTime = now;

      this.isDraggingAr = true;
      this.dragStartX = event.touches[0].clientX;
      this.dragStartY = event.touches[0].clientY;
      this.initialArX = this.arPosX();
      this.initialArY = this.arPosY();
    }
  }

  onArTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.initialPinchDist > 0) {
      event.preventDefault();
      const currentDist = this.getTouchDistance(event.touches[0], event.touches[1]);
      const scaleFactor = currentDist / this.initialPinchDist;
      const newScale = Math.max(0.4, Math.min(2.5, +(this.initialPinchScale * scaleFactor).toFixed(2)));
      this.arScale.set(newScale);
      return;
    }

    if (this.isDraggingAr && event.touches.length === 1) {
      event.preventDefault();
      const deltaX = event.touches[0].clientX - this.dragStartX;
      const deltaY = event.touches[0].clientY - this.dragStartY;
      this.arPosX.set(this.initialArX + deltaX);
      this.arPosY.set(this.initialArY + deltaY);
    }
  }

  onArTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.initialPinchDist = 0;
    }
    if (event.touches.length === 0) {
      this.isDraggingAr = false;
    }
  }

  onArMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDraggingAr = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialArX = this.arPosX();
    this.initialArY = this.arPosY();

    const onMouseMove = (e: MouseEvent) => {
      if (this.isDraggingAr) {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        this.arPosX.set(this.initialArX + deltaX);
        this.arPosY.set(this.initialArY + deltaY);
      }
    };

    const onMouseUp = () => {
      this.isDraggingAr = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // ── 3D Wall & Perfect Wall Alignment ──
  is3dWallMode = signal<boolean>(false);
  wallPitch = signal<number>(0);
  wallYaw = signal<number>(0);
  isWallAligned = signal<boolean>(true);
  isWallSnapAnim = signal<boolean>(false);
  isArMenuExpanded = signal<boolean>(false);

  toggleArMenu(): void {
    this.isArMenuExpanded.set(!this.isArMenuExpanded());
  }

  private updateWallAlignment(): void {
    const pitchAligned = Math.abs(this.wallPitch()) < 0.1;
    const yawAligned = Math.abs(this.wallYaw()) < 0.1;
    const rotAligned = (Math.abs(this.arCanvasRotation()) % 360) === 0;
    this.isWallAligned.set(pitchAligned && yawAligned && rotAligned);
  }

  toggle3dWallMode(): void {
    const nextState = !this.is3dWallMode();
    this.is3dWallMode.set(nextState);
    if (nextState) {
      this.wallPitch.set(6);
      this.wallYaw.set(-14);
    } else {
      this.wallPitch.set(0);
      this.wallYaw.set(0);
    }
    this.updateWallAlignment();
  }

  alignToWallPerfectly(): void {
    this.wallPitch.set(0);
    this.wallYaw.set(0);
    this.arCanvasRotation.set(0);
    this.is3dWallMode.set(false);
    this.updateWallAlignment();
  }

  set3dPerspective(pitch: number, yaw: number): void {
    this.wallPitch.set(pitch);
    this.wallYaw.set(yaw);
    this.updateWallAlignment();
  }

  get3dWallTransform(): string {
    const pitch = this.wallPitch();
    const yaw = this.wallYaw();
    const rotZ = this.arCanvasRotation();
    const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;

    if (this.isArCameraActive()) {
      const posX = this.arPosX();
      const posY = this.arPosY();
      const baseScale = isLandscape ? this.arScale() * 0.85 : this.arScale();
      return `translate(-50%, -50%) translate(${posX}px, ${posY}px) perspective(1100px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotate(${rotZ}deg) scale(${baseScale})`;
    }

    const scale = this.selectedPrintScale * this.arScale();
    if (this.is3dWallMode() || pitch !== 0 || yaw !== 0) {
      return `perspective(1200px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotate(${rotZ}deg) scale(${scale})`;
    }
    return `rotate(${rotZ}deg) scale(${scale})`;
  }

  get3dWallShadow(): string {
    if (!this.is3dWallMode()) {
      return '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.15)';
    }

    const pitch = this.wallPitch();
    const yaw = this.wallYaw();
    const shadowX = -yaw * 1.2;
    const shadowY = pitch * 1.5 + 20;
    const shadowBlur = 45 + Math.abs(yaw) * 0.5;

    return `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, 0.55), ${shadowX * 1.6}px ${shadowY * 1.5}px ${shadowBlur * 1.5}px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.15)`;
  }

  private drawCanvasBackground(ctx: CanvasRenderingContext2D, bgStr: string, x: number, y: number, w: number, h: number, onDone: () => void): void {
    if (!bgStr) {
      ctx.fillStyle = '#131b36';
      ctx.fillRect(x, y, w, h);
      onDone();
      return;
    }

    const isGradient = bgStr.startsWith('linear-gradient') || bgStr.startsWith('radial-gradient');
    if (isGradient) {
      try {
        const hexes = bgStr.match(/#([0-9a-fA-F]{3,6})/g) || [];
        if (hexes.length >= 2 && hexes[0] && hexes[hexes.length - 1]) {
          const grad = ctx.createLinearGradient(x, y, x + w, y + h);
          grad.addColorStop(0, hexes[0]);
          grad.addColorStop(1, hexes[hexes.length - 1]);
          ctx.fillStyle = grad;
        } else if (hexes.length === 1 && hexes[0]) {
          ctx.fillStyle = hexes[0];
        } else {
          ctx.fillStyle = '#131b36';
        }
        ctx.fillRect(x, y, w, h);
      } catch {
        ctx.fillStyle = '#131b36';
        ctx.fillRect(x, y, w, h);
      }
      onDone();
      return;
    }

    if (bgStr.startsWith('#') || bgStr.startsWith('rgb')) {
      ctx.fillStyle = bgStr;
      ctx.fillRect(x, y, w, h);
      onDone();
      return;
    }

    const img = new Image();
    let fullUrl = bgStr;
    if (typeof window !== 'undefined') {
      if (bgStr.startsWith('http://') || bgStr.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      } else {
        const cleanPath = bgStr.startsWith('/') ? bgStr : '/' + bgStr;
        fullUrl = window.location.origin + cleanPath;
      }
    }

    img.onload = () => {
      try { ctx.drawImage(img, x, y, w, h); } catch {}
      onDone();
    };
    img.onerror = () => {
      ctx.fillStyle = '#131b36';
      ctx.fillRect(x, y, w, h);
      onDone();
    };
    img.src = fullUrl;
  }

  // ── Robust AR Snapshot Photo Capture & Destination Saver ──
  isSnapshotCapturing = signal<boolean>(false);
  isCameraFlashing = signal<boolean>(false);

  private playShutterSound(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(ctx.currentTime);

      setTimeout(() => {
        try {
          const clickOsc = ctx.createOscillator();
          const clickGain = ctx.createGain();
          clickOsc.type = 'triangle';
          clickOsc.frequency.setValueAtTime(280, ctx.currentTime);
          clickOsc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.03);

          clickGain.gain.setValueAtTime(0.4, ctx.currentTime);
          clickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

          clickOsc.connect(clickGain);
          clickGain.connect(ctx.destination);
          clickOsc.start(ctx.currentTime);
          clickOsc.stop(ctx.currentTime + 0.04);
        } catch {}
      }, 60);
    } catch (e) {
      console.warn('AudioContext shutter sound unavailable:', e);
    }
  }

  async captureArSnapshot(): Promise<void> {
    if (this.isSnapshotCapturing()) return;
    this.isSnapshotCapturing.set(true);

    // Trigger visual camera flash & mechanical shutter click sound
    this.playShutterSound();
    this.isCameraFlashing.set(true);
    setTimeout(() => this.isCameraFlashing.set(false), 380);

    try {
      const videoEl = (document.querySelector('#full-ar-video-feed') as HTMLVideoElement) ||
                      (document.querySelector('#ar-video-feed') as HTMLVideoElement);

      const canvas = document.createElement('canvas');
      const width = videoEl?.videoWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const height = videoEl?.videoHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.isSnapshotCapturing.set(false);
        return;
      }

      // 1. Draw live room camera video feed background (applying active room lighting filter)
      const currentFilter = this.getArFilterStyle();
      if (currentFilter && currentFilter !== 'none') {
        try { ctx.filter = currentFilter; } catch {}
      }
      if (videoEl && videoEl.readyState >= 2) {
        try {
          ctx.drawImage(videoEl, 0, 0, width, height);
        } catch {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.filter = 'none'; // reset filter for artwork rendering

      // 2. Measure exact visual position on screen using getBoundingClientRect()
      const artEl = document.querySelector('.full-ar-art-container') as HTMLElement;
      const videoRect = videoEl ? videoEl.getBoundingClientRect() : { left: 0, top: 0, width: typeof window !== 'undefined' ? window.innerWidth : width, height: typeof window !== 'undefined' ? window.innerHeight : height };
      const artRect = artEl ? artEl.getBoundingClientRect() : null;

      const scaleX = width / (videoRect.width || 1);
      const scaleY = height / (videoRect.height || 1);

      let frameX = (width / 2) - (width * 0.2);
      let frameY = (height / 2) - (height * 0.25);
      let frameW = width * 0.4;
      let frameH = frameW * 1.25;

      if (artRect && videoRect && artRect.width > 0 && artRect.height > 0) {
        frameX = (artRect.left - videoRect.left) * scaleX;
        frameY = (artRect.top - videoRect.top) * scaleY;
        frameW = artRect.width * scaleX;
        frameH = artRect.height * scaleY;
      }

      // 3. Render High-Fidelity Framed Canvas (Frame Moulding, Matting, Wallpaper, Artwork & Calligraphy Pet Name)
      ctx.save();

      // Handle Canvas 90° Rotation if applied
      const rot = this.arCanvasRotation() || 0;
      if (rot !== 0) {
        const centerX = frameX + (frameW / 2);
        const centerY = frameY + (frameH / 2);
        ctx.translate(centerX, centerY);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      // Ambient Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = Math.max(15, Math.round(frameW * 0.08));
      ctx.shadowOffsetY = Math.max(8, Math.round(frameW * 0.04));

      // Determine Matting Padding & Colors
      const mat = this.matStyles.find(m => m.id === this.selectedMat);
      const hasMat = mat && mat.id !== 'none';
      const matColor = hasMat ? (mat.color || '#ffffff') : '#ffffff';
      const matPad = hasMat ? Math.max(12, Math.round(frameW * 0.07)) : 0;

      // Draw Outer Card / Matting
      ctx.fillStyle = matColor;
      ctx.fillRect(frameX, frameY, frameW, frameH);
      ctx.restore(); // restore shadow context

      // Outer Frame Moulding Border
      const frameBorderStr = this.selectedFrameStyle || '6px solid #1e293b';
      let frameBorderColor = '#1e293b';
      const colorMatch = frameBorderStr.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/);
      if (colorMatch) {
        frameBorderColor = colorMatch[0];
      }
      ctx.lineWidth = Math.max(6, Math.round(frameW * 0.035));
      ctx.strokeStyle = frameBorderColor;
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      // Inner Artwork Bounds
      const artX = frameX + matPad;
      const artY = frameY + matPad;
      const artW = Math.max(10, frameW - (matPad * 2));
      const artH = Math.max(10, frameH - (matPad * 2));

      // Draw Selected Background Wallpaper / Pattern / Gradient
      await new Promise<void>((resolveBg) => {
        this.drawCanvasBackground(ctx, this.selectedBackground, artX, artY, artW, artH, () => resolveBg());
      });

      // Draw Pet Calligraphy Name & Pet Portrait Artwork Image
      await new Promise<void>((resolveArt) => {
        // First draw Calligraphy Pet Name at TOP 6% of artwork canvas
        if (this.nameVisible && this.showPreviewName && this.previewName) {
          ctx.save();
          ctx.fillStyle = this.nameColor || '#ffffff';
          const fontFam = this.selectedFontFamily ? `'${this.selectedFontFamily}', cursive, serif` : `'Great Vibes', cursive, serif`;
          ctx.font = `italic bold ${Math.max(16, Math.round(artW * 0.085))}px ${fontFam}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fillText(this.previewName, artX + (artW / 2), artY + (artH * 0.06));
          ctx.restore();
        }

        const artImg = new Image();
        let artUrl = this.selectedArtwork || '/assets/images/portrait-sample.png';
        if (typeof window !== 'undefined') {
          if (artUrl.startsWith('http://') || artUrl.startsWith('https://')) {
            artImg.crossOrigin = 'anonymous';
          } else {
            const cleanArtPath = artUrl.startsWith('/') ? artUrl : '/' + artUrl;
            artUrl = window.location.origin + cleanArtPath;
          }
        }

        artImg.onload = () => {
          try {
            // Draw Pet Portrait Artwork Image with bottom/center aspect contain alignment
            const imgW = artImg.naturalWidth || artImg.width || artW;
            const imgH = artImg.naturalHeight || artImg.height || artH;
            const scale = Math.min(artW / imgW, artH / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const drawX = artX + ((artW - drawW) / 2);
            const drawY = artY + (artH - drawH);

            ctx.drawImage(artImg, drawX, drawY, drawW, drawH);
          } catch (err) {
            console.warn('Artwork layer render error:', err);
          } finally {
            resolveArt();
          }
        };

        artImg.onerror = () => {
          resolveArt();
        };

        artImg.src = artUrl;
      });

      // Convert Canvas to PNG & Open Saver Modal
      const dataUrl = canvas.toDataURL('image/png');
      this.snapshotDataUrl.set(dataUrl);
      this.isSnapshotModalOpen.set(true);
    } catch (e) {
      console.warn('AR Snapshot capture error:', e);
    } finally {
      this.isSnapshotCapturing.set(false);
    }
  }

  async saveArSnapshotToDevice(): Promise<void> {
    const dataUrl = this.snapshotDataUrl();
    if (!dataUrl) return;

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `purrfectpal-ar-photo-${Date.now()}.png`,
          types: [{
            description: 'PNG Image',
            accept: { 'image/png': ['.png'] }
          }]
        });
        const blob = await (await fetch(dataUrl)).blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.arSnapshotSuccessMsg.set('Photo Saved to Selected Location!');
        setTimeout(() => this.arSnapshotSuccessMsg.set(null), 3000);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    const link = document.createElement('a');
    link.download = `purrfectpal-ar-photo-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.arSnapshotSuccessMsg.set('Photo Saved to Downloads!');
    setTimeout(() => this.arSnapshotSuccessMsg.set(null), 3000);
  }

  async shareArSnapshot(): Promise<void> {
    const dataUrl = this.snapshotDataUrl();
    if (!dataUrl) return;

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `purrfectpal-ar-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My PurrfectPal AR Wall Projection',
          text: 'Check out how my pet portrait looks on my wall in AR!'
        });
        this.arSnapshotSuccessMsg.set('Photo Shared Successfully!');
        setTimeout(() => this.arSnapshotSuccessMsg.set(null), 3000);
      } else {
        this.saveArSnapshotToDevice();
      }
    } catch (e) {
      console.warn('Share failed:', e);
    }
  }

  closeSnapshotModal(): void {
    this.isSnapshotModalOpen.set(false);
  }

  resetArPosition(): void {
    this.arScale.set(1.0);
    this.arPosX.set(0);
    this.arPosY.set(0);
    this.arScreenRotation.set(0);
    this.arCanvasRotation.set(0);
    this.arSubjectScale.set(0.94);
    this.wallPitch.set(0);
    this.wallYaw.set(0);
    this.isWallAligned.set(true);
  }

  async initArCamera() {
    this.arCameraError.set(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.arCameraError.set('Camera access is not supported on this browser or device.');
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

      if (!stream) {
        throw new Error('No video stream acquired.');
      }

      this.arMediaStream = stream;

      let attempts = 0;
      const activeStream = stream;
      const bindStreamToVideo = () => {
        const videoEls = document.querySelectorAll<HTMLVideoElement>('#full-ar-video-feed, #ar-video-feed');
        if (videoEls.length > 0) {
          videoEls.forEach(videoEl => {
            try {
              videoEl.muted = true;
              videoEl.playsInline = true;
              videoEl.setAttribute('playsinline', 'true');
              videoEl.setAttribute('webkit-playsinline', 'true');
              if (videoEl.srcObject !== activeStream) {
                videoEl.srcObject = activeStream;
              }
              const playPromise = videoEl.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => console.warn('AR video play auto-start warning:', err));
              }
            } catch (err) {
              console.warn('Error configuring AR video element stream:', err);
            }
          });
        } else if (attempts < 20 && this.isArCameraActive()) {
          attempts++;
          requestAnimationFrame(bindStreamToVideo);
        }
      };

      requestAnimationFrame(bindStreamToVideo);
    } catch (e: any) {
      console.warn('AR Camera permission or stream failed:', e);
      this.arCameraError.set('Please grant camera permissions to project your portrait live onto your room wall.');
    }
  }

  closeArCameraView(): void {
    this.isArCameraActive.set(false);
    this.stopArCamera();
  }

  stopArCamera(): void {
    const videoEls = document.querySelectorAll('video');
    videoEls.forEach(videoEl => {
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoEl.srcObject = null;
      }
    });
    this.resetArPosition();
  }

  ngOnDestroy(): void {
    this.closeArCameraView();
    if (this.toastAutoTimer) clearTimeout(this.toastAutoTimer);
    if (this.toastTrafficGapTimer) clearTimeout(this.toastTrafficGapTimer);
    if (this.toastPollTimer) clearInterval(this.toastPollTimer);
  }

  adjustArScale(delta: number) {
    const next = Math.max(0.4, Math.min(2.5, this.arScale() + delta));
    this.arScale.set(next);
  }

  // Analyzes uploaded photo resolution & lighting
  evaluatePhotoQuality(file: File): void {
    if (!file) return;
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb >= 1.5) {
      this.photoQualityResult.set({
        score: 'excellent',
        text: 'Ultra HD Resolution detected! Perfect lighting & sharp detail for artwork.',
        icon: 'fa-check-circle'
      });
    } else if (sizeMb >= 0.4) {
      this.photoQualityResult.set({
        score: 'good',
        text: 'Good Image Quality! Suitable for hand-drawn illustration.',
        icon: 'fa-thumbs-up'
      });
    } else {
      this.photoQualityResult.set({
        score: 'warning',
        text: 'Low Resolution / Dark Photo detected. Clear, well-lit photos give best results!',
        icon: 'fa-exclamation-triangle'
      });
    }
  }

  // FIX: fullPrice returns raw float — includes Express Delivery if selected.
  fullPrice = computed(() => {
    const base = getBasePrice(this.subjectType(), this.ispetralistic(), this.numberofpetcount() + 1);
    const bg = this.backgroundPrice();
    const copyright = this.isCopyrightChecked() ? PRICING.copyrightExtra : 0;
    const express = this.isExpressDelivery() ? 15 : 0;
    return base + bg + copyright + express;
  });

  // FIX: finalPrice formats the raw float for display only — returns string "79.90".
  finalPrice = computed(() => this.fullPrice().toFixed(2));

  // FIX: fullPriceRounded returns a float that has been rounded to exactly 2dp.
  fullPriceRounded = computed(() => parseFloat(this.fullPrice().toFixed(2)));

  // Display helper — always 2dp e.g. "79.90" not "79.9".
  get displayFinalPrice(): string {
    return this.fullPrice().toFixed(2);
  }

  displayedNumber = this.finalPrice();
  showOld = false;
  showNew = true;

  preMadeBackground = getpreMadeBackground();
  numberOfPets = getNoOfPets();
  numberOfPersons = getNoOfPersons();
  numberOfBoth = getNoOfBoth();
  numberOfFamily = getNoOfFamily();

  showPreMade = true;
  showCustom = false;

  isBgGridExpanded = false;
  selectedBgCategory: BgCategory = 'all';
  bgCategories = BG_CATEGORIES;

  toggleBgGridExpand(): void {
    this.isBgGridExpanded = !this.isBgGridExpanded;
  }

  selectBgCategory(cat: BgCategory, event?: MouseEvent): void {
    this.selectedBgCategory = cat;
    if (event?.currentTarget) {
      const btn = event.currentTarget as HTMLElement;
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  get filteredPreMadeBackgrounds(): { entry: BgEntry; index: number }[] {
    const all = this.preMadeBackground.map((entry, index) => ({ entry, index }));
    if (this.selectedBgCategory === 'all') {
      return all;
    }
    return all.filter(item => item.entry.category === this.selectedBgCategory);
  }

  get visiblePreMadeBackgrounds(): { entry: BgEntry; index: number }[] {
    const list = this.filteredPreMadeBackgrounds;
    return this.isBgGridExpanded ? list : list.slice(0, 8);
  }

  selectedBackground: string = this.preMadeBackground[0].url;
  selectedArtwork: string = this.numberOfPets[0];

  changeBackground(image: string, event?: Event) {
    this.selectedBackground = image;
    this.sampleBackgroundColor();
    if (event?.currentTarget) {
      const el = event.currentTarget as HTMLElement;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  toggleBackground() {
    this.showPreMade = !this.showPreMade;
    this.showCustom = !this.showCustom;
  }

  private getActiveArtworkArray(): string[] {
    if (this.subjectType() === 'yourself') return this.numberOfPersons;
    if (this.subjectType() === 'family') return this.numberOfFamily;
    if (this.subjectType() === 'both') return this.numberOfBoth;
    return this.numberOfPets;
  }

  private preloadArtwork(newSrc: string): void {
    this.isimageLoaded = false;
    this.cdRef.detectChanges();

    const img = new Image();
    const timer = setTimeout(() => {
      this.selectedArtwork = newSrc;
      this.isimageLoaded = true;
      this.cdRef.detectChanges();
    }, 4000);

    img.onload = img.onerror = () => {
      clearTimeout(timer);
      this.selectedArtwork = newSrc;
      this.isimageLoaded = true;
      this.cdRef.detectChanges();
    };

    img.src = newSrc;
  }

  Changearttype(pos: number) {
    this.ispetralistic.set(pos < 4);

    let nextArtwork: string;
    if (this.subjectType() === 'yourself') {
      nextArtwork = this.numberOfPersons[pos < 4 ? 0 : 1];
    } else if (this.subjectType() === 'family') {
      const artOffset = pos < 4 ? 0 : 3;
      const countIndex = Math.max(0, this.numberofpetcount() - 1);
      const targetIndex = Math.min(countIndex + artOffset, this.numberOfFamily.length - 1);
      nextArtwork = this.numberOfFamily[targetIndex];
    } else {
      const isBoth = this.subjectType() === 'both';
      const artOffset = pos < 4 ? 0 : (isBoth ? 3 : 4);
      const arr = this.getActiveArtworkArray();
      const targetIndex = Math.min(this.numberofpetcount() + artOffset, arr.length - 1);
      nextArtwork = arr[targetIndex];
    }

    this.preloadArtwork(nextArtwork);
    this.pulseAnimation();
  }

  // FIX: changetocents formats display price — no change needed.
  changetocents(price: number) { return price.toFixed(2); }

  changeToImage(pos: number, event?: Event) {
    this.selectedBackground = this.preMadeBackground[pos].url;
    this.sampleBackgroundColor();
    if (event?.currentTarget) {
      const el = event.currentTarget as HTMLElement;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    this.scrollToTop();
  }

  changeNumberOfPets(pos: number) {
    let targetIndex: number;
    if (this.subjectType() === 'yourself') {
      targetIndex = this.ispetralistic() ? 0 : 1;
      this.preloadArtwork(this.numberOfPersons[targetIndex]);
    } else if (this.subjectType() === 'family') {
      const countIndex = Math.max(0, pos - 1);
      const artOffset = this.ispetralistic() ? 0 : 3;
      targetIndex = Math.min(countIndex + artOffset, this.numberOfFamily.length - 1);
      this.preloadArtwork(this.numberOfFamily[targetIndex]);
    } else {
      const isBoth = this.subjectType() === 'both';
      const artOffset = this.ispetralistic() ? 0 : (isBoth ? 3 : 4);
      const arr = this.getActiveArtworkArray();
      targetIndex = Math.min(pos + artOffset, arr.length - 1);
      this.preloadArtwork(arr[targetIndex]);
    }
    this.scrollToTop();
  }

  PetSelectedOption = 'option1';
  imageSrc: string | null = null;

  onBgFileSelected(event: any) {
    const selectedfile = event.target.files[0];
    if (selectedfile) {
      const MAX_SIZE_BYTES = 10 * 1024 * 1024;
      if (selectedfile.size > MAX_SIZE_BYTES) {
        this.Toast.showToast('error', 'File Too Large',
          `"${selectedfile.name}" exceeds 10MB. Please choose a smaller image.`);
        event.target.value = '';
        return;
      }
      this.bgfile = selectedfile;
      const previewUrl = URL.createObjectURL(selectedfile);
      this.selectedBackground = previewUrl;
      this.sampleBackgroundColor();
      this.cdRef.detectChanges();
    }
    this.loggingService.log(selectedfile);
  }

  get selfPhotoUploaded(): boolean {
    return this.selectedfile.files.some(f => f.fileType === 'self');
  }

  get petSlots(): number[] {
    return Array.from({ length: this.numberofpetcount() + 1 }, (_, i) => i);
  }

  isPetSlotFilled(petIndex: number): boolean {
    return this.selectedfile.files.filter(f => f.fileType === 'pet').length > petIndex;
  }

  getPetNumber(index: number): number {
    return this.selectedfile.files
      .slice(0, index + 1)
      .filter(f => f.fileType === 'pet').length;
  }

  get familySlots(): number[] {
    return Array.from({ length: this.numberofpetcount() + 1 }, (_, i) => i);
  }

  isFamilySlotFilled(slotIndex: number): boolean {
    return this.selectedfile.files.length > slotIndex;
  }

  isFamilySlotActive(slotIndex: number): boolean {
    return this.selectedfile.files.length === slotIndex;
  }

  getFamilyPersonNumber(index: number): number {
    return index + 1;
  }

  onFileSelected(event: any) {
    const newFiles: FileList = event.target.files;

    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    for (let i = 0; i < newFiles.length; i++) {
      if (newFiles[i].size > MAX_SIZE_BYTES) {
        this.Toast.showToast('error', 'File Too Large',
          `"${newFiles[i].name}" exceeds 10MB. Please choose a smaller image.`);
        event.target.value = '';
        return;
      }
    }

    if (newFiles && newFiles.length > 0) {
      this.evaluatePhotoQuality(newFiles[0]);
    }

    if (this.subjectType() === 'both') {
      const selfAlreadyUploaded = this.selfPhotoUploaded;

      if (!selfAlreadyUploaded && newFiles.length > 1) {
        this.Toast.showToast('info', 'Upload Yourself First',
          'Please upload exactly 1 photo of yourself first, then upload your pet photo(s) separately.');
        event.target.value = '';
        return;
      }

      const maxPets = this.numberofpetcount() + 1;
      const currentPetCount = this.selectedfile.files.filter(f => f.fileType === 'pet').length;

      for (let pos = 0; pos < newFiles.length; pos++) {
        const file = newFiles[pos];
        const isFirstEver = !selfAlreadyUploaded && pos === 0;
        const assignedType: 'self' | 'pet' = isFirstEver ? 'self' : 'pet';

        if (assignedType === 'pet' && currentPetCount + pos >= maxPets) {
          this.Toast.showToast('error', 'Pet Limit Reached',
            `You can only upload ${maxPets} pet photo(s). Extra files were skipped.`);
          break;
        }

        this.filestoupload.push(file);
        const filesdata: ExtendedFilesData = {
          file,
          url: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file)),
          fileType: assignedType,
        };
        this.selectedfile.files.push(filesdata);
      }
      event.target.value = '';
      return;
    }

    if (this.subjectType() === 'family') {
      const maxPeople = this.numberofpetcount() + 1;
      if (newFiles.length + this.selectedfile.files.length > maxPeople) {
        this.Toast.showToast('error', 'File Limit Exceeded', `You can only upload up to ${maxPeople} photo(s) for the selected number of people.`);
        event.target.value = '';
        return;
      }

      for (let pos = 0; pos < newFiles.length; pos++) {
        const file = newFiles[pos];
        this.filestoupload.push(file);
        const filesdata: ExtendedFilesData = {
          file,
          url: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file)),
          fileType: 'family',
        };
        this.selectedfile.files.push(filesdata);
      }
      event.target.value = '';
      return;
    }

    const maxFiles = this.numberofpetcount() + 1;
    if (newFiles.length + this.selectedfile.files.length > maxFiles) {
      this.Toast.showToast('error', 'File Limit Exceeded', 'You have exceeded the maximum file limit.');
      event.target.value = '';
      return;
    }

    for (let pos = 0; pos < newFiles.length; pos++) {
      const file = newFiles[pos];
      this.filestoupload.push(file);
      const filesdata: ExtendedFilesData = {
        file,
        url: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file)),
        fileType: this.subjectType() === 'yourself' ? 'self' : 'pet',
      };
      this.selectedfile.files.push(filesdata);
    }
    event.target.value = '';
  }

  delimage(i: number): void {
    this.selectedfile.files.splice(i, 1);
    this.filestoupload.splice(i, 1);
  }

  pulseAnimation() {
    this.showOld = true;
    this.showNew = true;

    const oldEl = this.oldNumberRef.nativeElement;
    const newEl = this.newNumberRef.nativeElement;

    this.renderer.removeClass(oldEl, 'animate-out');
    this.renderer.removeClass(newEl, 'animate-in');

    void oldEl.offsetWidth;
    void newEl.offsetWidth;

    this.renderer.addClass(oldEl, 'animate-out');
    this.renderer.addClass(newEl, 'animate-in');

    setTimeout(() => {
      this.showOld = false;
      this.displayedNumber = this.finalPrice();
    }, 1500);
  }

  // ── Preview badge label ───────────────────────────────────────────────────
  getSubjectLabel(): string {
    if (this.subjectType() === 'pet') return 'Pet';
    if (this.subjectType() === 'yourself') return 'Myself';
    if (this.subjectType() === 'both') return 'Pet + Me';
    return 'Family & Couple';
  }

  onSubjectTypeChange(type: SubjectTypeOption): void {
    this.subjectType.set(type);
    this.fadeName();

    if (type === 'family') {
      // Couples and family start at 2 people (count index 1)
      this.numberofpetcount.set(1);
      document.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][name="btnradio"]'
      ).forEach(radio => (radio.checked = radio.id === 'btnradio2'));
    } else {
      this.numberofpetcount.set(0);
      document.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][name="btnradio"]'
      ).forEach(radio => (radio.checked = radio.id === 'btnradio1'));
    }

    const artOffset = this.ispetralistic() ? 0 : 3;
    let nextArtwork: string;

    if (type === 'yourself') {
      nextArtwork = this.numberOfPersons[this.ispetralistic() ? 0 : 1];
    } else if (type === 'family') {
      // family: realistic indices 0-2, cartoon indices 3-5
      nextArtwork = this.numberOfFamily[this.ispetralistic() ? 0 : 3];
    } else if (type === 'both') {
      nextArtwork = this.numberOfBoth[this.ispetralistic() ? 0 : 3];
    } else {
      nextArtwork = this.numberOfPets[this.ispetralistic() ? 0 : 4];
    }

    this.preloadArtwork(nextArtwork);
    this.pulseAnimation();

    this.selectedfile.files = [];
    this.filestoupload = [];
    this.scrollToTop();
  }

  // ── Name visibility ───────────────────────────────────────────────────────
  get showPreviewName(): boolean { return this.PetSelectedOption !== 'option2'; }

  // ── Preview name on the artwork banner ───────────────────────────────────
  get previewName(): string {
    if (!this.showPreviewName) return '';
    const p1 = this.petname.trim();
    const p2 = this.ownername.trim();
    const p3 = this.person3name.trim();
    const p4 = this.person4name.trim();
    const all = [p1, p2, p3, p4];

    if (this.subjectType() === 'yourself') {
      return p1 || p2 || 'Your Name';
    }

    if (this.subjectType() === 'both') {
      const petCount = this.numberofpetcount() + 1;
      const relevant = all.slice(0, petCount + 1).filter(n => n.length > 0);
      if (relevant.length > 0) return relevant.join(' & ');
      return 'Pet & Your Name';
    }

    if (this.subjectType() === 'family') {
      const numPeople = this.numberofpetcount() + 1;
      const relevant = all.slice(0, numPeople).filter(n => n.length > 0);
      if (relevant.length === 1) return relevant[0];
      if (relevant.length === 2) return `${relevant[0]} & ${relevant[1]}`;
      if (relevant.length === 3) return `${relevant[0]}, ${relevant[1]} & ${relevant[2]}`;
      if (relevant.length === 4) return `${relevant[0]}, ${relevant[1]}, ${relevant[2]} & ${relevant[3]}`;
      return 'Family / Couple Names';
    }

    // Default 'pet': filter strictly by active pet count (numberofpetcount() + 1)
    const petCount = this.numberofpetcount() + 1;
    const relevant = all.slice(0, petCount).filter(n => n.length > 0);
    if (relevant.length === 1) return relevant[0];
    if (relevant.length === 2) return `${relevant[0]} & ${relevant[1]}`;
    if (relevant.length === 3) return `${relevant[0]}, ${relevant[1]} & ${relevant[2]}`;
    if (relevant.length === 4) return `${relevant[0]}, ${relevant[1]}, ${relevant[2]} & ${relevant[3]}`;

    return petCount > 1 ? "Pets' Names" : "Your Pet's Name";
  }

  private fadeName(): void {
    this.nameVisible = false;
    this.cdRef.markForCheck();
    setTimeout(() => { this.nameVisible = true; this.cdRef.markForCheck(); }, 300);
  }

  getNameFontSize(): string {
    if (!this.showPreviewName) return '0rem';

    const text = this.previewName ?? '';
    const len = text.length;

    let containerPx = 400;
    let vw = 1200;
    if (typeof window !== 'undefined') {
      vw = window.innerWidth;
      const el = document.getElementById('productPageBg');
      if (el) {
        containerPx = el.clientWidth || el.offsetWidth || Math.min(vw, 480);
      } else {
        containerPx = Math.min(vw, 480);
      }
    }

    // Base sizing: ~11% of container width
    let basePx = containerPx * 0.11;

    // Scale down progressively for longer text strings
    if (len > 30) basePx *= 0.52;
    else if (len > 22) basePx *= 0.62;
    else if (len > 15) basePx *= 0.72;
    else if (len > 10) basePx *= 0.84;

    // 'both' / 'family' subject types default labels ("Family / Couple Names")
    if (this.subjectType() === 'both' || this.subjectType() === 'family') {
      basePx *= 0.85;
    }

    // Dynamic minPx / maxPx bounds so font is always legible and fits cleanly
    const minPx = vw < 400 ? 15 : (vw < 576 ? 17 : 20);
    const maxPx = vw < 480 ? 32 : (vw < 768 ? 44 : 54);
    const finalPx = Math.max(minPx, Math.min(maxPx, basePx));

    return `${finalPx.toFixed(1)}px`;
  }

  get nameMaxLength(): number {
    if (this.subjectType() === 'both') return 30;
    if (this.subjectType() === 'yourself') return 25;
    return 20;
  }

  getTextShadow(): string {
    // Light-coloured names on dark backgrounds:
    // Use a thin, crisp dark outline-style shadow — NOT a heavy glow.
    // This gives legibility without any dimming/halo effect.
    if (this.nameColor === '#ffffff' || this.nameColor === '#fff') {
      // Crisp dark outline on all 4 sides + very subtle depth drop
      return [
        '-1px -1px 0 rgba(0,0,0,0.55)',
        ' 1px -1px 0 rgba(0,0,0,0.55)',
        '-1px  1px 0 rgba(0,0,0,0.55)',
        ' 1px  1px 0 rgba(0,0,0,0.55)',
        ' 0 2px 6px rgba(0,0,0,0.35)'   // soft depth — not a heavy blur
      ].join(',');
    } else {
      // Dark-coloured names on light backgrounds:
      // Thin white outline so text pops from any light image
      return [
        '-1px -1px 0 rgba(255,255,255,0.7)',
        ' 1px -1px 0 rgba(255,255,255,0.7)',
        '-1px  1px 0 rgba(255,255,255,0.7)',
        ' 1px  1px 0 rgba(255,255,255,0.7)',
        ' 0 1px 4px rgba(255,255,255,0.5)'
      ].join(',');
    }
  }

  private sampleBackgroundColor(): void {
    const src = this.selectedBackground;
    if (!src) return;

    // ── CSS-gradient backgrounds: parse first hex colour to decide luminance ──
    const isGradient = src.startsWith('linear-gradient') || src.startsWith('radial-gradient');
    if (isGradient) {
      // Extract all hex/rgb colours and average their luminance
      const hexMatches = src.match(/#([0-9a-fA-F]{3,6})/g) ?? [];
      if (hexMatches.length > 0) {
        let totalLum = 0;
        for (const hex of hexMatches) {
          const full = hex.length === 4
            ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
            : hex;
          const n = parseInt(full.slice(1), 16);
          const r = (n >> 16) & 255;
          const g = (n >> 8) & 255;
          const b = n & 255;
          totalLum += 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
        }
        const avgLum = totalLum / hexMatches.length;
        this.nameColor = avgLum > 0.45 ? '#1a1208' : '#ffffff';
      } else {
        this.nameColor = '#ffffff'; // fallback for dark gradients
      }
      this.cdRef.markForCheck();
      return;
    }

    // Check filename for known dark / light backgrounds as immediate fallback
    const darkBgs = [
      'bgRoyalCosmic', 'bgObsidianGold', 'bgEmeraldForest',
      'bgPurple', 'bgHome1', 'bgHome3'
    ];
    const isKnownDark = darkBgs.some(bg => src.includes(bg));
    this.nameColor = isKnownDark ? '#ffffff' : '#1a1208';

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const cvs = document.createElement('canvas');
        cvs.width = 80;
        cvs.height = 40;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 80, 40);
        const data = ctx.getImageData(20, 0, 40, 40).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          count++;
        }
        r /= count; g /= count; b /= count;

        const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
        this.nameColor = lum > 0.45 ? '#1a1208' : '#ffffff';
      } catch {
        /* cross-origin canvas fallback already set */
      }

      this.cdRef.markForCheck();
    };

    img.onerror = () => { /* keep existing colour */ };
    img.src = src;
  }

  CheckBeforeAddToCart(): boolean {
    let ispossible = false;

    if (!this.ispremade && !this.bgfile) ispossible = true;

    const petCount = this.numberofpetcount() + 1;
    this.loggingService.log(petCount, this.filestoupload.length);

    if (this.subjectType() === 'both') {
      if (this.filestoupload.length < this.numberofpetcount() + 2) ispossible = true;
    } else if (this.subjectType() === 'family') {
      if (this.filestoupload.length < this.numberofpetcount() + 1) ispossible = true;
    } else {
      if (
        (petCount === 1 && this.filestoupload.length < 1) ||
        (petCount === 2 && this.filestoupload.length < 2) ||
        (petCount === 3 && this.filestoupload.length < 3) ||
        (petCount === 4 && this.filestoupload.length < 4)
      ) { ispossible = true; }
    }

    if (this.PetSelectedOption === 'option1') {
      if (this.subjectType() === 'both' || this.subjectType() === 'family') {
        if (!this.petname.trim() && !this.ownername.trim() && !this.person3name.trim() && !this.person4name.trim()) ispossible = true;
      } else if (this.subjectType() === 'yourself') {
        if (!this.ownername.trim() && !this.petname.trim()) ispossible = true;
      } else {
        if (!this.petname.trim()) ispossible = true;
      }
    }
    return ispossible;
  }

  addtocart(): void {
    this.loggingService.log(this.authservice.getUser());

    if (this.userid() !== 0) {
      if (this.CheckBeforeAddToCart()) {
        this.Toast.showToast('error', 'Required Fields Missing', 'Please ensure all required fields are filled and files are uploaded.');
      } else {
        this.openprocessmodal();
        if (this.bgfile) this.filestoupload.push(this.bgfile);
        else this.filestoupload.push();

        this.productservice.uploadfiles(this.filestoupload).subscribe(
          ({ progress, response }) => {
            this.loadingService.setProgress(progress);
            if (progress === 100 && response) {
              this.Toast.showToast('success', 'File Uploaded', 'Your file has been successfully uploaded.');
              this.loggingService.log('File Uploaded successfully:', response.files);
              this.getproductdata(this.userid(), response.files);
            }
          },
          (error) => {
            this.Toast.showToast('error', 'File Upload Failed', 'There was an error uploading your file. Please try again.');
            this.loggingService.error(error);
            this.closeprocessmodalImmediate();
          }
        );
      }
    } else {
      this.Toast.showToast('info', 'Login Required', 'Please login to add items to your cart.');
      this.router.navigate(['/Login']);
    }
  }

  getcartcount() {
    if (this.userid() !== 0) {
      this.productservice.cartcount(this.userid()).pipe().subscribe((data: any) => {
        this.cartrealaststiccounter.set(data[0]);
        this.cartcartooncounter.set(data[1]);
        this.cartreadymadecounter.set(data[2]);
      });
    }
  }

  setArtStylePrice(_price: number): void { /* recomputed via fullPrice() */ }

  setNumberOfPets(numberofpet: number, pos: number): void {
    this.numberofpetcount.set(pos);
    this.changeNumberOfPets(pos);
    this.scrollToTop();
    this.pulseAnimation();
  }

  setBackgroundPrice(_price: number): void {
    this.backgroundPrice.set(this.backgroundPrice() === 0 ? PRICING.customBackgroundExtra : 0);
    this.pulseAnimation();
    this.toggleBackground();
    this.ispremade = !this.ispremade;
  }

  toggleCopyright(event: Event) {
    const target = event.target as HTMLInputElement;
    this.isCopyrightChecked.set(target.checked);
    this.scrollToTop();
    this.pulseAnimation();
  }

  adjustHeight(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  // ── Magnifier ─────────────────────────────────────────────────────────────
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private animationFrameRunning = false;

  magnifyImage(event: MouseEvent) {
    const magnifier = this.magnifier.nativeElement;
    const img = this.petimage.nativeElement;
    const rect = img.getBoundingClientRect();
    const magnifierSize = 180;
    const zoom = 2.5;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      magnifier.style.display = 'none';
      return;
    }

    magnifier.style.display = 'block';
    this.targetX = x - magnifierSize / 2;
    this.targetY = y - magnifierSize / 2;
    magnifier.style.backgroundImage = `url(${img.src})`;
    magnifier.style.backgroundRepeat = 'no-repeat';
    magnifier.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
    magnifier.style.backgroundPosition = `-${x * zoom - magnifierSize / 2}px -${y * zoom - magnifierSize / 2}px`;

    if (!this.animationFrameRunning) {
      this.animationFrameRunning = true;
      this.animateMagnifier();
    }
  }

  private animateMagnifier() {
    const magnifier = this.magnifier.nativeElement;
    this.currentX += (this.targetX - this.currentX) * 0.15;
    this.currentY += (this.targetY - this.currentY) * 0.15;
    magnifier.style.left = `${this.currentX}px`;
    magnifier.style.top = `${this.currentY}px`;

    if (magnifier.style.display !== 'none') {
      requestAnimationFrame(() => this.animateMagnifier());
    } else {
      this.animationFrameRunning = false;
    }
  }

  resetImage() { this.magnifier.nativeElement.style.display = 'none'; }

  // ── Cart fly animation ────────────────────────────────────────────────────
  private triggerCartFlyAnimation(): void {
    const img = this.petimage?.nativeElement as HTMLImageElement | undefined;
    const cart = this.cartIcon?.nativeElement as HTMLElement | undefined;
    if (!img || !cart) return;

    const startRect = img.getBoundingClientRect();
    const endRect = cart.getBoundingClientRect();

    if (startRect.width === 0 || startRect.height === 0) return;

    const clone = document.createElement('img');
    clone.src = img.src;

    const cloneSize = Math.min(Math.min(startRect.width, startRect.height), 110);

    Object.assign(clone.style, {
      position: 'fixed',
      top: `${startRect.top + startRect.height / 2 - cloneSize / 2}px`,
      left: `${startRect.left + startRect.width / 2 - cloneSize / 2}px`,
      width: `${cloneSize}px`,
      height: `${cloneSize}px`,
      objectFit: 'cover',
      borderRadius: '10px',
      zIndex: '10000',
      pointerEvents: 'none',
      opacity: '1',
      transition: 'none',
    });

    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.transition = [
          'top           0.75s cubic-bezier(0.4, 0, 0.2, 1)',
          'left          0.75s cubic-bezier(0.4, 0, 0.2, 1)',
          'width         0.70s ease',
          'height        0.70s ease',
          'opacity       0.65s ease',
          'border-radius 0.60s ease',
        ].join(', ');

        clone.style.top = `${endRect.top + endRect.height / 2}px`;
        clone.style.left = `${endRect.left + endRect.width / 2}px`;
        clone.style.width = '0px';
        clone.style.height = '0px';
        clone.style.opacity = '0';
        clone.style.borderRadius = '50%';
      });
    });

    setTimeout(() => {
      if (clone.parentNode) clone.parentNode.removeChild(clone);
    }, 950);
  }

  // ── Cart data builders ────────────────────────────────────────────────────
  getproductdata(userid: number, file: any) {
    this.loggingService.log(file);
    let imagedata: Imageurls;
    const base = this.productservice.getfilebaseurl();

    if (this.subjectType() === 'yourself') {
      imagedata = {
        petimg1: 'null', petimg2: 'null', petimg3: 'null', petimg4: 'null',
        personimg: file[0] ? base + file[0] : 'null',
        custombackgroundimg: this.bgfile ? (file[file.length - 1] ? base + file[file.length - 1] : 'null') : 'null',
      };
    } else if (this.subjectType() === 'both') {
      imagedata = {
        petimg1: file[1] ? base + file[1] : 'null',
        petimg2: file[2] ? base + file[2] : 'null',
        petimg3: file[3] ? base + file[3] : 'null',
        petimg4: 'null',
        personimg: file[0] ? base + file[0] : 'null',
        custombackgroundimg: this.bgfile ? (file[file.length - 1] ? base + file[file.length - 1] : 'null') : 'null',
      };
    } else if (this.subjectType() === 'family') {
      imagedata = {
        petimg1: file[1] ? base + file[1] : 'null',
        petimg2: file[2] ? base + file[2] : 'null',
        petimg3: file[3] ? base + file[3] : 'null',
        petimg4: file[4] ? base + file[4] : 'null',
        personimg: file[0] ? base + file[0] : 'null',
        custombackgroundimg: this.bgfile ? (file[file.length - 1] ? base + file[file.length - 1] : 'null') : 'null',
      };
    } else {
      imagedata = {
        petimg1: file[0] ? base + file[0] : 'null',
        petimg2: file.length > 2 ? (file[1] ? base + file[1] : 'null') : 'null',
        petimg3: file.length > 3 ? (file[2] ? base + file[2] : 'null') : 'null',
        petimg4: file.length > 4 ? (file[3] ? base + file[3] : 'null') : 'null',
        personimg: 'null',
        custombackgroundimg: this.bgfile
          ? (file[file.length - 1] ? base + file[file.length - 1] : 'null')
          : 'null',
      };
    }

    let formattedPetName = 'null';
    if (this.PetSelectedOption === 'option1') {
      const p1 = this.petname.trim();
      const p2 = this.ownername.trim();
      const p3 = this.person3name.trim();
      const p4 = this.person4name.trim();

      if (this.subjectType() === 'yourself') {
        formattedPetName = (p2 || p1) ? `[Owner: ${p2 || p1}]` : 'null';
      } else if (this.subjectType() === 'both') {
        const parts: string[] = [];
        if (p1) parts.push(`[Pet: ${p1}]`);
        if (p2) parts.push(`[Owner: ${p2}]`);
        if (p3) parts.push(`[Extra Pet 1: ${p3}]`);
        if (p4) parts.push(`[Extra Pet 2: ${p4}]`);
        formattedPetName = parts.length > 0 ? parts.join(' ') : 'null';
      } else if (this.subjectType() === 'family') {
        const parts: string[] = [];
        if (p1) parts.push(`[Member 1: ${p1}]`);
        if (p2) parts.push(`[Member 2: ${p2}]`);
        if (p3) parts.push(`[Member 3: ${p3}]`);
        if (p4) parts.push(`[Member 4: ${p4}]`);
        formattedPetName = parts.length > 0 ? parts.join(' ') : 'null';
      } else {
        const activeNames = [p1, p2, p3, p4].filter(n => n.length > 0);
        formattedPetName = activeNames.length > 0 ? activeNames.map((n, i) => `[Pet ${i + 1}: ${n}]`).join(' ') : 'null';
      }
    }

    let notes = '';
    if (this.isExpressDelivery()) {
      notes += '[⚡ RUSH 24-HOUR PROOF DELIVERY: YES] ';
    }
    if (this.artistnotes) {
      notes += this.artistnotes.trim();
    }
    if (!notes) {
      notes = 'Standard Art Production';
    }

    const productdata: product = {
      name: this.subjectType() === 'yourself'
        ? 'Custom Myself Portrait'
        : this.subjectType() === 'both'
          ? 'Custom Pet & Me Portrait'
          : this.subjectType() === 'family'
            ? 'Custom Family & Couple Portrait'
            : 'Custom Pet Portrait',
      urls: imagedata,
      art_style: this.ispetralistic() ? 'Realistic' : 'Cartoonised',
      artist_additional_notes: notes,
      background_additional_notes: this.backgroundstylenotes || 'null',
      background_style: this.ispremade ? 'Premade;' + this.selectedBackground : 'Custom',
      petname: formattedPetName,
      subject_type: this.subjectType(),
      price: this.fullPriceRounded(),
      pet_quantity: this.subjectType() === 'yourself' ? 0 : this.numberofpetcount() + 1,
      additional_fee: (this.isCopyrightChecked() ? PRICING.copyrightExtra : 0) + (this.isExpressDelivery() ? 15 : 0),
      User_ID: userid,
    };

    this.loggingService.log(productdata);
    this.pushdatatocart(productdata);
  }

  getreadymadeproductdata(items: any) {
    // Coerce strings → numbers up front
    const price = parseFloat(items.price) || 0;
    const discount = parseFloat(items.discount) || 0;

    const imagedata: Imageurls = {
      petimg1: items.Img_Url + ';' + items.Url,
      petimg2: 'null', petimg3: 'null', petimg4: 'null',
      personimg: 'null', custombackgroundimg: 'null',
    };

    const chosenSubject = items.subject_type ||
      (this.quickAddSubjectFilter !== 'all' ? this.quickAddSubjectFilter : this.subjectType());

    const productdata: product = {
      name: items.name,
      urls: imagedata,
      art_style: 'Ready-Made',
      artist_additional_notes: this.artistnotes ? this.artistnotes.trim() : 'Ready-Made Portrait Order',
      background_additional_notes: 'N/A',
      background_style: 'N/A',
      petname: 'N/A',
      subject_type: chosenSubject as any,
      // FIX: same guard — round to 2dp before DB write.
      price: parseFloat((items.price - (items.discount || 0)).toFixed(2)),
      pet_quantity: 0,
      additional_fee: 0,
      User_ID: this.userid(),
    };

    this.pushdatatocart(productdata);
  }

  pushdatatocart(cartdata: any) {
    this.productservice.addTocart(cartdata).subscribe({
      next: (response: any) => {
        this.loggingService.log('Cart created successfully:', response);
        this.setcounter(cartdata.art_style);
        this.enqueueLiveUserOrder(cartdata.name || 'Custom Pet Portrait');
        this.Toast.showToast('success', 'Added to Cart', 'The item has been added to your cart.');
        this.closeprocessmodal();
      },
      error: (err: any) => {
        this.loggingService.error('Error adding item to cart:', err);
        const errMsg = err?.error?.message || 'Failed to add item to cart. Please try again.';
        this.Toast.showToast('error', 'Server Error (500)', errMsg);
        this.closeprocessmodalImmediate();
      }
    });
  }

  openexploremoreroute() {
    if (this.userid() !== 0) {
      this.router.navigate(['/Shop']);
    } else {
      this.Toast.showToast('info', 'Login Required', 'Please login to explore more products.');
      this.router.navigate(['/Login']);
    }
  }

  openprocessmodal() {
    this.loadingService.setProgress(-1);
    const modal = document.getElementById('process-loading');
    if (modal) modal.style.display = 'block';
  }

  closeprocessmodalImmediate() {
    const modal = document.getElementById('process-loading');
    if (modal) modal.style.display = 'none';
    this.loadingService.setProgress(0);
  }

  closeprocessmodal() {
    setTimeout(() => {
      const modal = document.getElementById('process-loading');
      if (modal) modal.style.display = 'none';

      this.triggerCartFlyAnimation();

      setTimeout(() => this.resetForm(), 100);
    }, 2000);
  }

  resetForm(): void {
    this.selectedfile.files = [];
    this.filestoupload = [];
    this.bgfile = null;

    this.petname = '';
    this.ownername = '';
    this.person3name = '';
    this.person4name = '';
    this.artistnotes = '';
    this.backgroundstylenotes = '';

    this.subjectType.set('pet');
    this.ispetralistic.set(true);
    this.numberofpetcount.set(0);
    this.isCopyrightChecked.set(false);
    this.backgroundPrice.set(0);

    this.PetSelectedOption = 'option1';
    this.showPreMade = true;
    this.showCustom = false;
    this.ispremade = true;

    this.selectedArtwork = this.numberOfPets[0];
    this.selectedBackground = this.preMadeBackground[0].url;
    this.sampleBackgroundColor();

    this.displayedNumber = this.finalPrice();

    const radioDefaults: Record<string, string> = {
      subjectRadio: 'subPet',
      'btnradio-1': 'realistic',
      'bg-style-radio': 'choose-style',
      btnradio: 'btnradio1',
    };

    Object.entries(radioDefaults).forEach(([name, defaultId]) => {
      document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${name}"]`
      ).forEach(radio => (radio.checked = radio.id === defaultId));
    });

    this.cdRef.detectChanges();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  generateAddToCartFly(productDiv: HTMLElement | null, items: any) {
    if (this.userid() !== 0) {
      if (!productDiv) {
        this.getreadymadeproductdata(items);
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
      }, 150);

      setTimeout(() => {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
      }, 1200);
    } else {
      this.Toast.showToast('info', 'Login Required', 'Please login to add items to your cart.');
      this.router.navigate(['/Login']);
    }
  }
}