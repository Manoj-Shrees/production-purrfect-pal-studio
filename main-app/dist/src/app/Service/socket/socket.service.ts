import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { headers, hosturl } from '../servicebasemodel';
import { LoggingService } from '../Logs/logging.service';

@Injectable({ providedIn: 'root' })
export class SocketService {

  private socket?: Socket;
  private readonly serverUrl = hosturl;

  private _pendingOnlineChecks: string[] = [];
  private _pendingOnlineCheckListenerAdded = false;

  // BUG-1 FIX: Use Set instead of Array to deduplicate joinOrder calls for the
  // same orderId that arrive before the socket connects.
  private _pendingJoinOrders: Set<string> = new Set();

  constructor(private loggingService: LoggingService) { }

  // ─────────────────────────────── CONNECTION ────────────────────────────────

  connect(email: string): void {
    if (this.socket) {
      this.register(email);
      return;
    }

    this.socket = io(this.serverUrl, {
      auth: { proxyKey: headers['X-Proxy-Key'] },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      // 1. Identify this client to the server first.
      this.socket?.emit('registerUser', email);

      // 2. Flush queued events AFTER the server processes registerUser.
      setTimeout(() => {
        // BUG-1 FIX: snapshot Set into array, then clear before emitting.
        const orders = [...this._pendingJoinOrders];
        this._pendingJoinOrders.clear();
        if (orders.length) {
          orders.forEach(orderId => this.socket?.emit('joinOrder', orderId));
        }

        // BUG-2 FIX: clear the array first so the once('connect') handler
        // inside checkOnlineStatus() sees an empty array and skips its flush,
        // preventing the same checks from being emitted twice.
        const checks = [...this._pendingOnlineChecks];
        this._pendingOnlineChecks = [];
        this._pendingOnlineCheckListenerAdded = false;
        if (checks.length) {
          checks.forEach(e => this.socket?.emit('checkOnlineStatus', { email: e }));
        }
      }, 50);
    });

    // BUG-4 FIX: handle connection errors so failures are not silent.
    this.socket.on('connect_error', (err) => {
      this.loggingService.error('[SocketService] Connection error:', err.message);
    });

    // BUG-4 FIX: re-register the user after every reconnect so the server
    // does not lose track of this client after a network hiccup.
    this.socket.on('reconnect', (attempt: number) => {
      this.loggingService.warn('[SocketService] Reconnected after', attempt, 'attempt(s). Re-registering:', email);
      this.socket?.emit('registerUser', email);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.loggingService.warn('[SocketService] Reconnect attempt #', attempt);
    });

    this.socket.on('disconnect', reason => {
      this.loggingService.warn('[SocketService] Disconnected:', reason);
    });
  }

  register(email: string): void {
    if (!this.socket) return;
    if (this.socket.connected) {
      this.socket.emit('registerUser', email);
    } else {
      this.socket.once('connect', () => this.socket?.emit('registerUser', email));
    }
  }

  // ─────────────────────────── ROOM MANAGEMENT ───────────────────────────────

  joinOrder(orderId: string): void {
    if (!this.socket) {
      // BUG-1 FIX: Set.add() silently ignores duplicate orderIds.
      this._pendingJoinOrders.add(orderId);
      return;
    }
    if (this.socket.connected) {
      this.socket.emit('joinOrder', orderId);
    } else {
      // BUG-1 FIX: Set.add() silently ignores duplicate orderIds.
      this._pendingJoinOrders.add(orderId);
    }
  }

  leaveOrder(orderId: string): void {
    this.socket?.emit('leaveOrder', orderId);
  }

  // ──────────────────────────────── TYPING ───────────────────────────────────

  sendTyping(orderId: string, email: string): void { this.socket?.emit('typing', { orderId, email }); }
  sendStopTyping(orderId: string, email: string): void { this.socket?.emit('stopTyping', { orderId, email }); }

  onTyping(): Observable<any> { return this._on('typing'); }
  onStopTyping(): Observable<any> { return this._on('stopTyping'); }

  // ──────────────────────────────── MESSAGES ─────────────────────────────────

  onPreviousMessages(): Observable<any[]> { return this._on('previousMessages'); }
  onNewMessage(): Observable<any> { return this._on('newMessage'); }

  sendOrderUpdate(messageData: any): void {
    this.socket?.emit('orderUpdate', messageData);
  }

  // ──────────────────────────────── PRESENCE ─────────────────────────────────

  onUserStatusUpdate(): Observable<{ email: string; online: boolean }> {
    return this._on('userStatusUpdate');
  }

  onOnlineStatusResult(): Observable<{ email: string; online: boolean }> {
    return this._on('onlineStatusResult');
  }

  checkOnlineStatus(email: string): void {
    if (!this.socket) { this._pendingOnlineChecks.push(email); return; }
    if (this.socket.connected) { this.socket.emit('checkOnlineStatus', { email }); return; }
    this._pendingOnlineChecks.push(email);
    if (!this._pendingOnlineCheckListenerAdded) {
      this._pendingOnlineCheckListenerAdded = true;
      this.socket.once('connect', () => {
        this._pendingOnlineCheckListenerAdded = false;
        setTimeout(() => {
          // BUG-2 FIX: bail out if the on('connect') handler inside connect()
          // already flushed the pending checks at the 50ms mark — prevents
          // the same emails being emitted a second time at the 80ms mark.
          if (!this._pendingOnlineChecks.length) return;
          const pending = [...this._pendingOnlineChecks];
          this._pendingOnlineChecks = [];
          pending.forEach(e => this.socket?.emit('checkOnlineStatus', { email: e }));
        }, 80);
      });
    }
  }

  setUserOffline(email: string): void {
    if (!email) return;
    if (this.socket?.connected) {
      this.socket.emit('userOffline', { email });
    } else {
      // BUG-3 FIX: was silently dropped with no feedback. Now warns so the
      // caller knows the event did not reach the server.
      this.loggingService.warn('[SocketService] setUserOffline() — socket not connected, event dropped. email =', email);
    }
  }

  // ─────────────────────────────── HELPERS ───────────────────────────────────

  private _on<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      if (!this.socket) {
        this.loggingService.warn(
          `[SocketService] "${event}" subscribed before connect() — events will be missed. Call connect() first.`
        );
        return () => { };
      }
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }
}