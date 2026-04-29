// ─────────────────────────────────────────────────────────────────────────────
// src/app/Service/Push/web-push.service.ts
//
// Responsibilities:
//   1. Register the custom service worker (sw.js)
//   2. Fetch the VAPID public key from the backend
//   3. Subscribe the browser via PushManager and POST to /webpush/subscribe
//   4. Listen for PUSH_CLICK messages from the service worker and navigate
//
// Usage — call once after login (e.g. in AppComponent.ngOnInit):
//   this.webPushService.init();
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { baseurl, headers } from '../servicebasemodel';

@Injectable({ providedIn: 'root' })
export class WebPushService implements OnDestroy {

  private registration: ServiceWorkerRegistration | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private http:   HttpClient,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  // ── Public entry point ─────────────────────────────────────────────────────
  async init(): Promise<void> {
    if (!this.isSupported()) {
      console.warn('[WebPush] Not supported in this browser');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      //('[WebPush] Service worker registered');

      await this.subscribeToPush();
      this.listenForPushClicks();
    } catch (err) {
      console.warn('[WebPush] Init failed:', err);
    }
  }

  // ── Subscribe the browser ──────────────────────────────────────────────────
  private async subscribeToPush(): Promise<void> {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
     // console.log('[WebPush] Permission denied — skipping subscription');
      return;
    }

    const { publicKey } = await this.http
      .get<{ publicKey: string }>(`${baseurl}/webpush/vapidkey`, { headers })
      .toPromise() as { publicKey: string };

    if (!publicKey) {
      console.warn('[WebPush] No VAPID public key returned from server');
      return;
    }

    const reg = this.registration!;

    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });
     // console.log('[WebPush] New browser subscription created');
    } else {
     // console.log('[WebPush] Reusing existing browser subscription');
    }

    await this.http
      .post(`${baseurl}/webpush/subscribe`, { subscription, role: 'admin' }, { headers })
      .toPromise();

    //console.log('[WebPush] ✅ Subscription saved to server');
  }

  // ── Unsubscribe (call on logout) ───────────────────────────────────────────
  async unsubscribe(): Promise<void> {
    if (!this.registration) return;
    const sub = await this.registration.pushManager.getSubscription();
    if (!sub) return;

    await this.http
      .post(`${baseurl}/webpush/unsubscribe`, { endpoint: sub.endpoint }, { headers })
      .toPromise();

    await sub.unsubscribe();
    //console.log('[WebPush] Unsubscribed');
  }

  // ── Handle push notification clicks from the service worker ───────────────
  private listenForPushClicks(): void {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_CLICK') return;

      const data: any = event.data.data || {};
      this.ngZone.run(() => {
        if (data.orderID) {
          this.router.navigate(['/orders'], { queryParams: { id: data.orderID } });
        } else {
          this.router.navigate(['/']);
        }
      });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager'   in window    &&
      'Notification'  in window
    );
  }

  /**
   * Convert a URL-safe base64 VAPID public key to Uint8Array<ArrayBuffer>.
   *
   * FIX: Changed return type from plain Uint8Array (which resolves to
   * Uint8Array<ArrayBufferLike>) to Uint8Array<ArrayBuffer>, and replaced
   * Uint8Array.from() — which produces ArrayBufferLike — with an explicit
   * new ArrayBuffer() + new Uint8Array(buffer) construction that guarantees
   * a concrete ArrayBuffer. This satisfies PushManager.subscribe()'s
   * applicationServerKey type of BufferSource (ArrayBufferView<ArrayBuffer>).
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    const buffer  = new ArrayBuffer(raw.length);
    const view    = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) {
      view[i] = raw.charCodeAt(i);
    }
    return view;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}