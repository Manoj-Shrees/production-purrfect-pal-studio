import { Component, OnInit, signal, computed } from '@angular/core';
import { catchError, finalize, of } from 'rxjs';
import { DetailpageService } from '../Service/detail-page/detailpage.service';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import LZString from 'lz-string';
import { RouteAccessService } from '../Service/Auth/route-access.service';
import { OrderItem, itemsdata } from '../Service/servicebasemodel';
import { AuthService } from '../Service/Auth/auth.service';
import { LoggingService } from '../Service/Logs/logging.service';

@Component({
  selector: 'app-past-orders',
  standalone: false,
  templateUrl: './past-orders.component.html',
  styleUrl: './past-orders.component.css',
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
export class PastOrdersComponent implements OnInit {

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
    private logger:        LoggingService
  ) {}

  ngOnInit(): void { this.fetchFromApi(); }

  refresh(): void { this.fetchFromApi(true); }

  onSearchChange(value: string): void { this.searchText.set(value); }

  // ── Single entry point — API called once, result cached ───────────────────
  private fetchFromApi(isRefresh = false): void {
    isRefresh ? this.isRefreshing.set(true) : this.isLoading.set(true);

    this.authservice.checkAuth().pipe(
      catchError(err => { this.logger.error('[Past] checkAuth:', err); return of(null); })
    ).subscribe(response => {
      if (!response?.isAuthenticated || !response.user) {
        return this.done(isRefresh);
      }
      this.authservice.setUser(response.user);

      this.detailservice.getorderdata(response.user.ID).pipe(
        catchError(err => { this.logger.error('[Past] getorderdata:', err); return of(null); }),
        finalize(() => this.done(isRefresh))  // always clears loading
      ).subscribe((res: any) => {
        this.cachedAllOrders = res?.Order ?? res?.Orders ?? [];
        this.applyFilter();
      });
    });
  }

  private applyFilter(): void {
    this.orderlist.set(
      this.cachedAllOrders.filter(o => o.Status?.toLowerCase() === 'completed')
    );
  }

  private done(isRefresh: boolean): void {
    if (isRefresh) {
      this.isRefreshing.set(false);
    } else {
      setTimeout(() => this.isLoading.set(false), 2000); // Simulate loading delay for better UX
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