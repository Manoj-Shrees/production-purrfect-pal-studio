import {
  ChangeDetectorRef, Component, computed, DestroyRef, ElementRef,
  HostListener, inject, signal, ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MyCartService } from '../Service/MyCartPage/my-cart.service';
import { cart } from './models/cart';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import LZString from 'lz-string';
import { RouteAccessService } from '../Service/User/route-access-service.service';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { AuthService } from '../Service/User/auth.service';
import { LoginService } from '../Service/User/login.service';
import { UsersService } from '../Service/User/users.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { Imageurls } from './models/imagurls';

@Component({
  selector: 'app-mycart',
  standalone: false,
  templateUrl: './mycart.component.html',
  styleUrl: './mycart.component.css',
  animations: [
    trigger('badgeAnim', [
      transition(':increment', [
        style({ transform: 'scale(1)' }),
        animate('200ms ease-out', style({ transform: 'scale(1.4)' })),
        animate('200ms ease-in', style({ transform: 'scale(1)' })),
      ]),
      transition(':decrement', [
        style({ transform: 'scale(1)' }),
        animate('200ms ease-out', style({ transform: 'scale(0.8)' })),
        animate('200ms ease-in', style({ transform: 'scale(1)' })),
      ]),
    ]),
    trigger('cartitemAnim', [
      state('active', style({ opacity: 1, height: '*', marginBottom: '*' })),
      state('removed', style({ opacity: 0, height: 0, marginBottom: 0 })),
      transition('active => removed', animate('300ms ease-in')),
    ])
  ]
})
export class MycartComponent {

  mycartdata = signal<cart[]>([]);
  itemstype = signal<string>('Realistic');

  realisticCount   = computed(() => this.mycartdata().filter(i => i.art_style === 'Realistic').length);
  cartoonisedCount = computed(() => this.mycartdata().filter(i => i.art_style === 'Cartoonised').length);
  readyMadeCount   = computed(() => this.mycartdata().filter(i => i.art_style === 'Ready-Made').length);

  deleteitemid = signal(0);
  selectedid: any;
  loading  = signal(true);
  userid   = signal<number>(0);


  expandedIds = new Set<number>();
  

  // ─── Promo Code Properties ─────────────────────────────────────────────
  promoInput = '';
  promoApplied = false;
  appliedPromo: any = null;
  promoError = '';
  promoLoading = false;

  /** True when every selected item is Ready-Made (promo not allowed). */
  promoNotAllowed = computed<boolean>(() => {
    const items = this.selectedItems();
    return items.length > 0 && items.every(i => i.art_style === 'Ready-Made');
  });

  menuOpen        = false;
  profilemenuOpen = false;
  userdata: any;
  isloggedin = false;

  cacheBuster: number = Date.now();

  private dataLoaded = false;
  private destroyRef = inject(DestroyRef);

  filteredcartdata = computed(() =>
    this.mycartdata().filter(i => i.art_style === this.itemstype())
  );

  // ─────────────────────────────────────────────────────────────
  // SELECTION — signal-based set of selected item IDs
  // ─────────────────────────────────────────────────────────────

  selectedIds = signal<Set<number>>(new Set());

  selectedItems = computed<cart[]>(() => {
    const ids = this.selectedIds();
    return this.filteredcartdata().filter(item => ids.has(item.ID));
  });

  allSelected = computed<boolean>(() => {
    const filtered = this.filteredcartdata();
    if (filtered.length === 0) return false;
    const ids = this.selectedIds();
    return filtered.every(item => ids.has(item.ID));
  });

  someSelected = computed<boolean>(() => {
    const filtered = this.filteredcartdata();
    const ids = this.selectedIds();
    const count = filtered.filter(item => ids.has(item.ID)).length;
    return count > 0 && count < filtered.length;
  });

  selectedCount = computed<number>(() => this.selectedItems().length);

  toggleItemSelection(itemId: number): void {
    const current = new Set(this.selectedIds());
    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }
    this.selectedIds.set(current);
  }

  toggleSelectAll(): void {
    const filtered = this.filteredcartdata();
    if (this.allSelected()) {
      const current = new Set(this.selectedIds());
      filtered.forEach(item => current.delete(item.ID));
      this.selectedIds.set(current);
    } else {
      const current = new Set(this.selectedIds());
      filtered.forEach(item => current.add(item.ID));
      this.selectedIds.set(current);
    }
  }

  isSelected(itemId: number): boolean {
    return this.selectedIds().has(itemId);
  }

  // ─────────────────────────────────────────────────────────────
  // IMAGE HANDLING
  // ─────────────────────────────────────────────────────────────

  readonly FALLBACK_IMG = '/assets/images/default_picture.png';

  private imgOverrides = signal<Map<number, string>>(new Map());

  cardImgMap = computed<Map<number, string>>(() => {
    const map = new Map<number, string>();
    const overrides = this.imgOverrides();
    for (const item of this.mycartdata()) {
      map.set(item.ID, overrides.get(item.ID) ?? this.resolveImageUrl(item));
    }
    return map;
  });

  onCardImgError(event: Event, itemId: number): void {
    const el = event.target as HTMLImageElement;
    if (el.src.endsWith(this.FALLBACK_IMG)) return;
    const updated = new Map(this.imgOverrides());
    updated.set(itemId, this.FALLBACK_IMG);
    this.imgOverrides.set(updated);
  }

  private resolveImageUrl(item: cart): string {
    const urls = item.urls as Imageurls;
    if (!urls || typeof urls !== 'object') return this.FALLBACK_IMG;

    switch (item.subject_type) {
      case 'yourself':
        return this.firstValidUrl(urls.personimg);

      case 'pet':
        return this.resolvePetUrl(urls);

      case 'both': {
        const petUrl = this.resolvePetUrl(urls);
        return petUrl !== this.FALLBACK_IMG ? petUrl : this.firstValidUrl(urls.personimg);
      }

      case 'family': {
        const personUrl = this.firstValidUrl(urls.personimg);
        return personUrl !== this.FALLBACK_IMG ? personUrl : this.resolvePetUrl(urls);
      }

      case 'vehicle':
      case 'house': {
        const personUrl = this.firstValidUrl(urls.personimg);
        return personUrl !== this.FALLBACK_IMG ? personUrl : this.resolvePetUrl(urls);
      }

      default:
        return this.resolvePetUrl(urls) !== this.FALLBACK_IMG ? this.resolvePetUrl(urls) : this.firstValidUrl(urls.personimg);
    }
  }

  private resolvePetUrl(urls: Imageurls): string {
    for (const key of ['petimg1', 'petimg2', 'petimg3', 'petimg4']) {
      const url = this.firstValidUrl((urls as any)[key]);
      if (url !== this.FALLBACK_IMG) return url;
    }
    return this.FALLBACK_IMG;
  }

  private firstValidUrl(raw?: string | null): string {
    if (!raw || typeof raw !== 'string') return this.FALLBACK_IMG;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return this.FALLBACK_IMG;
    const first = trimmed
      .split(';')
      .map(s => s.trim())
      .find(s => s.length > 0 && s !== 'null' && s !== 'undefined');
    return first ?? this.FALLBACK_IMG;
  }

  // ─────────────────────────────────────────────────────────────

  fetchcartdata$ = new Subject<string>();

  @ViewChild('menu')       menuRef!:    ElementRef;
  @ViewChild('menuButton') buttonRef!:  ElementRef;

  constructor(
    private mycartservice: MyCartService,
    private loginService:  LoginService,
    private cdr:           ChangeDetectorRef,
    private eRef:          ElementRef,
    private loggingService: LoggingService,
    private cdRef:         ChangeDetectorRef,
    private userservice:   UsersService,
    private accessService: RouteAccessService,
    private authservice:   AuthService,
    private router:        Router,
    private socialmedia:   SociallinkService,
    private Toast:         ToastService
  ) {
    this.getcartdata();
  }

  innerWidth: number = window.innerWidth;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  ngOnInit(): void {
    this.authservice.checkAuth()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(response => {
        if (response.isAuthenticated && response.user) {
          this.isloggedin = true;
          this.authservice.setUser(response.user);
          this.getuserdata(response.user);
          const { ID } = response.user;
          this.userid.set(ID);
          if (!this.dataLoaded) {
            this.fetchcartdata$.next(String(ID));
          } else {
            this.loading.set(false);
          }
        } else {
          this.isloggedin = false;
          this.loading.set(false);
        }
      });
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = '/assets/images/profile-picture.png';
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    setTimeout(() => {
      const target = event.target as HTMLElement;
      const clickedInsideMenu = this.menuRef?.nativeElement.contains(target);
      const clickedButton     = this.buttonRef?.nativeElement.contains(target);
      if (!clickedInsideMenu && !clickedButton) this.profilemenuOpen = false;
    }, 0);
  }

  toggleMenu(): void        { this.menuOpen        = !this.menuOpen;        }
  profiletoggleMenu(): void { this.profilemenuOpen = !this.profilemenuOpen; }

  getuserdata(resdata: any): void {
    const { user_id } = resdata;
    this.loggingService.log(user_id);
    this.userservice.getuserdetailbyid(user_id).pipe().subscribe(
      (data) => this.userdata = data
    );
  }

  logout() {
    this.loginService.logoutuser().pipe().subscribe(
      (response) => {
        this.router.navigate(['/Login']);
        this.authservice.setUser(null);
        this.loggingService.log('Logout successful:', response);
        this.Toast.showToast('success', 'Logout', 'Logout successful.');
      },
      (error) => {
        this.loggingService.error('Logout failed:', error);
        this.Toast.showToast('error', 'Logout', 'Logout failed.');
      }
    );
  }

  setItemType(type: string) {
    this.itemstype.set(type);
  }

  opensocialurl(pos: number) { this.socialmedia.geturl(pos); }

  // ─────────────────────────────────────────────────────────────
  // parseUrls — handle already-parsed objects from the backend.
  // ─────────────────────────────────────────────────────────────
  private parseUrls(raw: any): any {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
      let parsed = JSON.parse(raw);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  getcartdata() {
    this.fetchcartdata$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((userid: string) => this.mycartservice.getdata(Number(userid))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (response) => {
        const normalised = (response || []).map((item: cart) => {
          let updatedName = item.name;
          if (item.art_style !== 'Ready-Made') {
            if (item.subject_type === 'yourself') {
              updatedName = 'Custom Myself Portrait';
            } else if (item.subject_type === 'both') {
              updatedName = 'Custom Pet & Me Portrait';
            } else if (item.subject_type === 'family') {
              updatedName = 'Custom Family & Couple Portrait';
            } else {
              updatedName = 'Custom Pet Portrait';
            }
          }

          // FIX: parseFloat then re-round to 2dp on read.
          // Guarantees that a DB value like "79.9" or "80" is normalised
          // to the exact float 79.90 before any display or arithmetic.
          const rawPrice = parseFloat(item.price as any);
          const price    = isNaN(rawPrice) ? 0 : parseFloat(rawPrice.toFixed(2));

          // FIX: additional_fee — same guard, ensure it's always a clean float.
          const rawFee       = parseFloat(item.additional_fee as any);
          const additional_fee = isNaN(rawFee) ? 0 : parseFloat(rawFee.toFixed(2));

          return {
            ...item,
            name: updatedName,
            price,           // guaranteed 2dp float — e.g. 79.90 not 79.9
            additional_fee,  // guaranteed 2dp float — e.g. 20.00 not 20
            urls: this.parseUrls(item.urls)
          };
        });
        this.imgOverrides.set(new Map());
        this.selectedIds.set(new Set());
        this.mycartdata.set(normalised);
        this.dataLoaded = true;
        this.loading.set(false);
      },
      (error) => {
        this.loggingService.error('Error fetching cart:', error);
        this.loading.set(false);
        this.Toast.showToast('error', 'Cart Error', 'Failed to fetch cart items. Please try refreshing.');
      }
    );
  }

  // ─── Delete cart item ─────────────────────────────────────────────────────
  private deletingIds = new Set<number>();

  deletecartitem(itemId: number) {
    if (this.deletingIds.has(itemId)) return;
    this.deletingIds.add(itemId);
    this.deleteitemid.set(itemId);

    this.mycartservice.deleteitemdata(itemId, this.userid()).subscribe({
      next: () => {
        const updatedImgs = new Map(this.imgOverrides());
        updatedImgs.delete(itemId);
        this.imgOverrides.set(updatedImgs);

        const updatedSel = new Set(this.selectedIds());
        updatedSel.delete(itemId);
        this.selectedIds.set(updatedSel);

        this.mycartdata.set(this.mycartdata().filter((item: cart) => item.ID !== itemId));
        this.deleteitemid.set(0);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loggingService.error('Error deleting item:', err);
        this.deleteitemid.set(0);
      },
      complete: () => {
        this.deletingIds.delete(itemId);
      }
    });
  }

  confirmAction(itemId: number) {
    if (this.deletingIds.has(itemId)) return;
    this.deletebuttonopen = false;
    this.deletebuttonmainIcon[itemId] = '🗑️';
    delete this.openFabs[itemId];
    if (this.activeCardId === itemId) this.activeCardId = null;
    this.deletecartitem(itemId);
    delete this.deletebuttonmainIcon[itemId];
  }

  // ─────────────────────────────────────────────────────────────
  // PRICING
  // ─────────────────────────────────────────────────────────────

  private toCents(dollars: number): number {
    return Math.round((dollars + Number.EPSILON) * 100);
  }

  // ─── Fee & Express Delivery Calculations ──────────────────────────────
  isExpressDelivery(item: cart): boolean {
    if (!item) return false;
    const notes = (item.artist_additional_notes || '').toLowerCase();
    if (notes.includes('express') || notes.includes('24h') || notes.includes('rush')) return true;
    if (item.additional_fee && (item.additional_fee === 15 || item.additional_fee === 35)) return true;
    return false;
  }

  getExpressFee(item: cart): number {
    return this.isExpressDelivery(item) ? 15 : 0;
  }

  getCopyrightFee(item: cart): number {
    if (!item) return 0;
    if (this.isExpressDelivery(item)) {
      // If additional_fee includes express (15), subtract 15 to get copyright portion
      return item.additional_fee > 15 ? item.additional_fee - 15 : 0;
    }
    return item.additional_fee > 0 ? item.additional_fee : 0;
  }

  getItemsBaseSubtotal(): number {
    return this.selectedItems().reduce((sum, item) => sum + (item.price || 0), 0);
  }

  getCopyrightFeeTotal(): number {
    return this.selectedItems().reduce((sum, item) => sum + this.getCopyrightFee(item), 0);
  }

  getExpressDeliveryTotal(): number {
    return this.selectedItems().reduce((sum, item) => sum + this.getExpressFee(item), 0);
  }

  get displayItemsBaseSubtotal(): string {
    return this.getItemsBaseSubtotal().toFixed(2);
  }

  get displayCopyrightFeeTotal(): string {
    return this.getCopyrightFeeTotal().toFixed(2);
  }

  get displayExpressDeliveryTotal(): string {
    return this.getExpressDeliveryTotal().toFixed(2);
  }

  gettotalPriceBeforePromo(): number {
    return this.selectedItems().reduce((sum, item) => {
      return sum + (item.price || 0) + this.getCopyrightFee(item) + this.getExpressFee(item);
    }, 0);
  }

  promoDiscountAmount(): number {
    if (!this.promoApplied || !this.appliedPromo) return 0;

    const eligibleSubtotal = this.selectedItems()
      .filter(i => i.art_style !== 'Ready-Made')
      .reduce((sum, item) => sum + item.price, 0);

    if (eligibleSubtotal === 0) return 0;

    if (this.appliedPromo.discount_type === 'Percentage') {
      const pct = parseFloat(this.appliedPromo.discount_value);
      return eligibleSubtotal * (pct / 100);
    } else {
      const fixed = parseFloat(this.appliedPromo.discount_value);
      return Math.min(eligibleSubtotal, fixed);
    }
  }

  gettotalPrice(): number {
    const subtotal = this.gettotalPriceBeforePromo();
    const discount = this.promoDiscountAmount();
    return Math.max(0, subtotal - discount);
  }

  getSubtotal(): number {
    return this.gettotalPriceBeforePromo();
  }

  // ─────────────────────────────────────────────────────────────
  // DISPLAY HELPERS — always use these in the template.
  // Never call gettotalPrice(), getSubtotal(), or
  // promoDiscountAmount() directly in the template — they return
  // raw floats that may display without 2dp (e.g. "8" not "7.99").
  // ─────────────────────────────────────────────────────────────

  /** Subtotal of selected items formatted to exactly 2dp. */
  get displaySubtotal(): string {
    return this.gettotalPriceBeforePromo().toFixed(2);
  }

  /** Promo discount amount formatted to exactly 2dp. */
  get displayDiscount(): string {
    return this.promoDiscountAmount().toFixed(2);
  }

  /** Total payable after discount formatted to exactly 2dp. */
  get displayTotal(): string {
    return this.gettotalPrice().toFixed(2);
  }

  // FIX: additional_fee display helper.
  // item.additional_fee from DB may come as integer 0 or 20 — without toFixed(2)
  // the template shows "0" and "20" instead of "0.00" and "20.00".
  formatFee(fee: number): string {
    return (isNaN(fee) ? 0 : fee).toFixed(2);
  }

  getTotalPriceInCents(): number {
    return this.toCents(this.gettotalPrice());
  }

  getItemDiscount(_item: cart): number {
    return 0;
  }

  applyPromoCode() {
    if (this.promoLoading || this.promoApplied) return;
    this.promoError = '';
    const code = this.promoInput.trim();
    if (!code) return;

    if (this.promoNotAllowed()) {
      this.promoError = 'Promo codes cannot be applied to Ready-Made products.';
      this.cdr.detectChanges();
      return;
    }

    this.promoLoading = true;
    this.cdr.detectChanges();

    this.mycartservice.validatePromoCode(code).subscribe({
      next: (response) => {
        this.promoLoading = false;
        if (response.success && response.promoCode) {
          this.appliedPromo = response.promoCode;
          this.promoApplied = true;
          this.promoError = '';
          this.Toast.showToast(
            'success',
            'Promo Code',
            `Code "${response.promoCode.code}" applied! Saving AUD $${this.promoDiscountAmount().toFixed(2)}.`
          );
        } else {
          this.promoError = 'Failed to validate promo code.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.promoLoading = false;
        console.error('Promo validation error:', err);
        this.promoError = err.error?.message || 'Invalid or expired promo code';
        this.Toast.showToast('error', 'Promo Code', this.promoError);
        this.cdr.detectChanges();
      }
    });
  }

  removePromoCode() {
    this.promoApplied = false;
    this.appliedPromo = null;
    this.promoInput = '';
    this.promoError = '';
    this.promoLoading = false;
    this.cdr.detectChanges();
    this.Toast.showToast('info', 'Promo Code', 'Promo code removed.');
  }

  // ─────────────────────────────────────────────────────────────
  // dopayment
  // ─────────────────────────────────────────────────────────────
  dopayment() {
    const items = this.selectedItems();
    if (items.length === 0) {
      this.Toast.showToast('error', 'No items selected', 'Please select at least one item to proceed.');
      return;
    }

    const userData = this.userdata?.[0];
    if (!userData?.email || !userData?.Name) {
      this.Toast.showToast('error', 'User data missing', 'Unable to proceed — please refresh and try again.');
      return;
    }

    const totalDiscount = this.promoDiscountAmount();

    const eligibleIds = new Set(
      items
        .filter(i => i.art_style !== 'Ready-Made')
        .map(i => i.ID)
    );

    const eligibleTotal = items
      .filter(i => eligibleIds.has(i.ID))
      .reduce((s, i) => s + i.price, 0);

    let distributed = 0;
    const eligibleItems = items.filter(i => eligibleIds.has(i.ID));

    const itemsForPayment = items.map(({ ID, ...rest }) => {
      if (totalDiscount === 0 || !eligibleIds.has(ID)) {
        return {
          ...rest,
          price:       parseFloat((rest.price as any)),
          price_cents: this.toCents(parseFloat((rest.price as any))),
        };
      }

      const isLast = ID === eligibleItems[eligibleItems.length - 1].ID;
      let itemDiscount: number;

      if (isLast) {
        itemDiscount = totalDiscount - distributed;
      } else {
        itemDiscount = eligibleTotal > 0
          ? (rest.price / eligibleTotal) * totalDiscount
          : 0;
        distributed += itemDiscount;
      }

      const discountedPrice = Math.max(0, rest.price - itemDiscount);

      return {
        ...rest,
        price:       discountedPrice,
        price_cents: this.toCents(discountedPrice),
      };
    });

    const mycartdata = JSON.stringify(itemsForPayment);
    this.accessService.allowNextAccess();
    this.loggingService.log('Navigating to Payment:', mycartdata);

    const queryParams: any = {
      items:      LZString.compressToEncodedURIComponent(mycartdata),
      totalprice: LZString.compressToEncodedURIComponent(JSON.stringify(this.getTotalPriceInCents())),
      userid:     LZString.compressToEncodedURIComponent(JSON.stringify(this.userid())),
      email:      LZString.compressToEncodedURIComponent(JSON.stringify(userData.email)),
      username:   LZString.compressToEncodedURIComponent(JSON.stringify(userData.Name))
    };

    if (this.promoApplied && this.appliedPromo) {
      queryParams.promo_code = LZString.compressToEncodedURIComponent(
        JSON.stringify(this.appliedPromo.code)
      );
    }

    this.router.navigate(['/Payment'], { queryParams });
  }

  opendeletemodal(id: number) {
    const modal = document.getElementById('id01');
    if (modal) modal.style.display = 'block';
    this.selectedid = id;
  }

  getItemState(id: number): 'active' | 'removed' {
    return this.deleteitemid() === id ? 'removed' : 'active';
  }

  deletebuttonopen = false;
  activeCardId: number | null = null;
  openFabs: { [key: number]: boolean } = {};
  deletebuttonmainIcon: { [key: number]: string } = {};
  hasOpenedFabState: { [key: number]: boolean } = {};

  toggleFab(cardId: number) {
    this.openFabs[cardId] = !this.openFabs[cardId];
    if (this.openFabs[cardId]) {
      this.hasOpenedFabState[cardId] = true;
    }
    this.deletebuttonmainIcon[cardId] = this.openFabs[cardId] ? '✖️' : '🗑️';
    this.activeCardId = this.openFabs[cardId] ? cardId : null;
  }

  hasOpenedFab(cardId: number): boolean {
    return !!this.hasOpenedFabState[cardId];
  }

  getSubjectLabel(type?: string): string {
    if (type === 'yourself') return '🧑‍🎨 Myself';
    if (type === 'both')     return '🐾🤝 Pet + Me';
    if (type === 'family')   return '👨‍👩‍👧‍👦 Family & Couple';
    if (type === 'vehicle')  return '🚗 Vehicle & Car';
    if (type === 'house')    return '🏡 House & Home';
    return '🐾 My Pet';
  }

  getSubjectClass(type?: string): string {
    if (type === 'yourself') return 'yourself';
    if (type === 'both')     return 'both';
    if (type === 'family')   return 'family';
    if (type === 'vehicle')  return 'vehicle';
    if (type === 'house')    return 'house';
    return 'pet';
  }


  parseNoteTags(text?: string): string[] {
    if (!text || text === 'null') return [];
    
    // Strip bracketed system metadata if present (e.g. [Format: ...], [Visualizer Frame: ...])
    const cleanText = text.replace(/\[[^\]]+\]/g, '').trim();
    if (!cleanText) return [];

    return cleanText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && tag !== 'null');
  }

  parseArtistNotes(raw?: string): {
    format?: string;
    expressDelivery?: boolean;
    photoQuality?: string;
    frameAndSize?: string;
    fontPreference?: string;
    subjectNames?: string[];
    extraNotes?: string[];
    noteTags?: string[];
    rawNotes?: string;
  } {
    if (!raw || raw === 'null') return {};

    const res: {
      format?: string;
      expressDelivery?: boolean;
      photoQuality?: string;
      frameAndSize?: string;
      fontPreference?: string;
      subjectNames?: string[];
      extraNotes?: string[];
      noteTags?: string[];
      rawNotes?: string;
    } = {};

    // Format
    const fmtMatch = raw.match(/\[Format:\s*([^\]]+)\]/i);
    if (fmtMatch) res.format = fmtMatch[1].trim();

    // Express Delivery
    if (/rush|24-hour|express/i.test(raw)) {
      res.expressDelivery = true;
    }

    // Photo Quality
    const qualMatch = raw.match(/\[Uploaded Photo Quality:\s*([^\]]+)\]/i);
    if (qualMatch) res.photoQuality = qualMatch[1].trim();

    // Frame & Size
    const frameMatch = raw.match(/\[Visualizer Frame:\s*([^\]]+)\]/i);
    if (frameMatch) res.frameAndSize = frameMatch[1].trim();

    // Font Preference
    const fontMatch = raw.match(/\[Font Preference:\s*([^\]]+)\]/i);
    if (fontMatch) res.fontPreference = fontMatch[1].trim();

    // Subject Names - search entire raw string for Member / Pet / Owner brackets
    const memberMatches = Array.from(raw.matchAll(/\[(Member|Pet|Owner)\s*(\d*):\s*([^\]]+)\]/gi));
    if (memberMatches.length > 0) {
      res.subjectNames = memberMatches.map(m => {
        const type = m[1].charAt(0).toUpperCase() + m[1].slice(1);
        const num = m[2] ? ` ${m[2]}` : '';
        return `${type}${num}: ${m[3].trim()}`;
      });
    }

    // Extra Notes - e.g. [Extra Notes: Anniversary / Wedding theme, Ask artist for font options, ...]
    const extraMatch = raw.match(/\[Extra Notes:\s*([^\]]+)\]/i);
    if (extraMatch) {
      const extraStr = extraMatch[1].trim();
      res.extraNotes = extraStr.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Custom Note Tags (parsed from freeform or comma-separated input)
    const tags = this.parseNoteTags(raw);
    if (tags.length > 0) {
      res.noteTags = tags;
    } else if (raw.trim().length > 0 && !res.format && !res.photoQuality && !res.frameAndSize && !res.fontPreference && !res.subjectNames && !res.extraNotes) {
      res.rawNotes = raw;
    }

    return res;
  }

  formatBgStyle(style?: string): string {
    if (!style || style === 'null') return 'Custom Background';
    if (style.startsWith('Premade;')) {
      const parts = style.split(';');
      const path = parts[1] || '';
      const filename = path.substring(path.lastIndexOf('/') + 1).replace(/\.[^/.]+$/, "");
      const cleanName = filename.replace(/^bg/, '').replace(/([A-Z])/g, ' $1').trim();
      return `Premade (${cleanName || 'Background'})`;
    }
    return style;
  }

  toggleExpand(itemId: number): void {
    if (this.expandedIds.has(itemId)) {
      this.expandedIds.delete(itemId);
    } else {
      this.expandedIds.add(itemId);
    }
    this.cdr.detectChanges();
  }

}