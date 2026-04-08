import { Component, OnInit, signal, computed } from '@angular/core';
import { DetailpageService } from '../Service/detail-page/detailpage.service';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import LZString from 'lz-string';
import { RouteAccessService } from '../Service/Auth/route-access.service';
import { OrderItem, itemsdata } from '../Service/servicebasemodel';
import { AuthService } from '../Service/Auth/auth.service';

@Component({
  selector: 'app-ongoing-orders',
  standalone: false,
  templateUrl: './ongoing-orders.component.html',
  styleUrl: './ongoing-orders.component.css',
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
export class OngoingOrdersComponent implements OnInit {

  // ── Signals ───────────────────────────────────────────────────────────────
  readonly orderlist    = signal<OrderItem[]>([]);
  readonly isLoading    = signal(true);
  readonly isRefreshing = signal(false);
  readonly searchText   = signal('');

  readonly filteredOrders = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    return term
      ? this.orderlist().filter(o =>
          String(o.Order_ID).toLowerCase().includes(term) ||
          (o.items?.[0]?.name ?? '').toLowerCase().includes(term)
        )
      : this.orderlist();
  });

  private cachedAllOrders: OrderItem[] = [];

  constructor(
    private detailservice: DetailpageService,
    private router:        Router,
    private accessService: RouteAccessService,
    private authservice:   AuthService,
  ) {}

  ngOnInit(): void { this.fetchFromApi(); }

  refresh(): void { this.fetchFromApi(true); }

  onSearchChange(value: string): void { this.searchText.set(value); }

  // ── Single entry point for all data fetching ──────────────────────────────
  private fetchFromApi(isRefresh = false): void {
    isRefresh ? this.isRefreshing.set(true) : this.isLoading.set(true);

    this.authservice.checkAuth().pipe(
      catchError(err => { console.error('[Ongoing] checkAuth:', err); return of(null); })
    ).subscribe(response => {
      if (!response?.isAuthenticated || !response.user) {
        return this.done(isRefresh);
      }
      this.authservice.setUser(response.user);

      // ── API called once — raw data cached ─────────────────────────────
      this.detailservice.getorderdata(response.user.ID).pipe(
        catchError(err => { console.error('[Ongoing] getorderdata:', err); return of(null); }),
        finalize(() => this.done(isRefresh))   // always clears loading
      ).subscribe((res: any) => {
        this.cachedAllOrders = res?.Order ?? res?.Orders ?? [];
        this.applyFilter();
      });
    });
  }

  // ── Filter cache to only active orders ───────────────────────────────────
  private applyFilter(): void {
    this.orderlist.set(
      this.cachedAllOrders.filter(o => o.Status?.toLowerCase() === 'active')
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
}