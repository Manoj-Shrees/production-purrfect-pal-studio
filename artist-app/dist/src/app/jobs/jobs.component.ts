import { Component, OnInit, signal, computed } from '@angular/core';
import { DetailpageService } from '../Service/detail-page/detailpage.service';
import { catchError, finalize, of } from 'rxjs';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import LZString from 'lz-string';
import { OrderActivationService } from '../Service/Order/order-activation.service';
import { RouteAccessService } from '../Service/Auth/route-access.service';
import { OrderItem, itemsdata } from '../Service/servicebasemodel';
import { AuthService } from '../Service/Auth/auth.service';
import { InfoService } from '../Service/ArtistProfile/info.service';

@Component({
  selector: 'app-jobs',
  standalone: false,
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.css',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(4px)' }))
      ])
    ])
  ]
})
export class JobsComponent implements OnInit {

  // ── Signals ───────────────────────────────────────────────────────────────
  readonly orderlist    = signal<OrderItem[]>([]);
  readonly isLoading    = signal(true);
  readonly isRefreshing = signal(false);
  readonly searchText   = signal('');

  // computed — auto-updates whenever orderlist or searchText changes
  readonly filteredOrders = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    return term
      ? this.orderlist().filter(o =>
          String(o.Order_ID).toLowerCase().includes(term) ||
          (o.items?.[0]?.name ?? '').toLowerCase().includes(term)
        )
      : this.orderlist();
  });

  selectedOrderId = 0;

  private cachedArtStyle  = '';
  private cachedAllOrders: OrderItem[] = [];

  constructor(
    private detailservice:     DetailpageService,
    private accessService:     RouteAccessService,
    private router:            Router,
    private updateorder:       OrderActivationService,
    private authservice:       AuthService,
    private artistinformation: InfoService
  ) {}

  ngOnInit(): void { this.fetchFromApi(); }

  refresh(): void { this.fetchFromApi(true); }

  onSearchChange(value: string): void { this.searchText.set(value); }

  // ── Core fetch — called once on init, once per refresh click ─────────────
  private fetchFromApi(isRefresh = false): void {
    isRefresh ? this.isRefreshing.set(true) : this.isLoading.set(true);

    this.authservice.checkAuth().pipe(
      catchError(err => { console.error('[Jobs] checkAuth:', err); return of(null); })
    ).subscribe(response => {
      if (!response?.isAuthenticated || !response.user) {
        return this.done(isRefresh);
      }
      this.authservice.setUser(response.user);

      this.artistinformation.getinfo(response.user.ID).pipe(
        catchError(err => { console.error('[Jobs] getinfo:', err); return of(null); })
      ).subscribe(profile => {
        const artStyle = profile?.Artist_Profile?.[0]?.art_style ?? '';
        if (!artStyle) return this.done(isRefresh);

        this.cachedArtStyle = artStyle;

        this.detailservice.getallorderdata().pipe(
          catchError(err => { console.error('[Jobs] getallorderdata:', err); return of(null); }),
          // ✅ finalize on innermost call — guarantees isRefreshing always resets
          finalize(() => this.done(isRefresh))
        ).subscribe((res: any) => {
          this.cachedAllOrders = res?.Order ?? res?.Orders ?? [];
          this.applyArtStyleFilter();
        });
      });
    });
  }

  private applyArtStyleFilter(): void {
    this.orderlist.set(
      this.cachedAllOrders.filter(order =>
        order.Status?.toLowerCase() === 'pending' &&
        order.items?.some(item =>
          item.art_style?.toLowerCase() === this.cachedArtStyle.toLowerCase()
        )
      )
    );
  }

  private done(isRefresh: boolean): void {
    if (isRefresh) {
      // Refresh overlay clears immediately
      this.isRefreshing.set(false);
    } else {
      // ✅ Skeleton shows for minimum 3 seconds for a polished feel
      setTimeout(() => this.isLoading.set(false), 3000);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  gettotalpriceoforder(items: itemsdata[]): number {
    return items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  }

  getFirstPetImage(o: OrderItem): string { return o.items?.[0]?.urls?.petimg1 ?? ''; }
  getClientName(o: OrderItem):    string { return o.items?.[0]?.name ?? 'Unknown'; }
  getArtStyle(o: OrderItem):      string { return o.items?.[0]?.art_style ?? '—'; }

  openorderdetail(data: OrderItem): void {
    this.accessService.allowNextAccess();
    this.router.navigate(['/detail-page'], {
      queryParams: { order: LZString.compressToEncodedURIComponent(JSON.stringify(data)) }
    });
  }

  openacceptmodal(id: number | string): void {
    this.selectedOrderId = +id;
    const modal = document.getElementById('accept-modal');
    if (modal) modal.style.display = 'flex';
  }

  closeModal(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closeModalById();
  }

  closeModalById(): void {
    const modal = document.getElementById('accept-modal');
    if (modal) modal.style.display = 'none';
  }

  updateOrderStatus(): void {
    this.updateorder.updatetoactive('' + this.selectedOrderId).subscribe({
      next: () => {
        this.closeModalById();
        this.cachedAllOrders = this.cachedAllOrders.filter(o => o.ID !== this.selectedOrderId);
        this.applyArtStyleFilter();
      },
      error: err => console.error('[Jobs] updateOrderStatus:', err)
    });
  }
}