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

  async init(): Promise<void> {
    if (!this.isSupported()) {
      console.warn('[WebPush] Not supported in this browser');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.listenForPushClicks();

      // Only subscribe automatically if permission was already granted by the user.
      // Notification.requestPermission() requires a user gesture in modern browsers.
      if (Notification.permission === 'granted') {
        await this.subscribeToPush();
      }
    } catch (err) {
      console.warn('[WebPush] Init failed:', err);
    }
  }

  /**
   * Can be called explicitly during a user gesture (e.g. clicking a toggle or button)
   * to request notification permission and create the push subscription.
   */
  async requestPermissionAndSubscribe(role: string = 'user'): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      if (Notification.permission === 'denied') {
        console.warn('[WebPush] Notification permission denied by user');
        return false;
      }

      let permission: NotificationPermission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        if (!this.registration) {
          this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        await this.subscribeToPush(role);
        return true;
      }
    } catch (err) {
      console.warn('[WebPush] Notification permission request failed:', err);
    }
    return false;
  }

  private async subscribeToPush(role: string = 'user'): Promise<void> {
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
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
      }

      await this.http
        .post(`${baseurl}/webpush/subscribe`, { subscription, role }, { headers })
        .toPromise();
    } catch (err) {
      console.warn('[WebPush] Subscribe to push error:', err);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.registration) return;
    const sub = await this.registration.pushManager.getSubscription();
    if (!sub) return;

    await this.http
      .post(`${baseurl}/webpush/unsubscribe`, { endpoint: sub.endpoint }, { headers })
      .toPromise();

    await sub.unsubscribe();
  }

  private listenForPushClicks(): void {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_CLICK') return;

      const data: any = event.data.data || {};
      this.ngZone.run(() => {
        if (data.orderID) {
          this.router.navigate(['/OrderTracking'], { queryParams: { order_id: data.orderID } });
        } else {
          this.router.navigate(['/']);
        }
      });
    });
  }

  private isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager'   in window    &&
      'Notification'  in window
    );
  }

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
