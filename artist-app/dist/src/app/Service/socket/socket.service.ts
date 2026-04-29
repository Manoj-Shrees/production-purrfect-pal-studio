import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { headers, hosturl } from '../servicebasemodel';
import { LoggingService } from '../Logs/logging.service';

@Injectable({ providedIn: 'root' })
export class SocketService {

  private socket?: Socket;
  private readonly serverUrl = hosturl;

  private _pendingOnlineCheck?: string;
  private _pendingOnlineCheckListenerAdded = false;

  constructor(private loggingService: LoggingService) {}

  // ─────────────────────────────── CONNECTION ────────────────────────────────

  connect(email: string): void {
    if (this.socket) {
      this.register(email);
      return;
    }

    this.loggingService.log('[SocketService] Creating socket for:', email);

    this.socket = io(this.serverUrl, {
      auth: { proxyKey: headers['X-Proxy-Key'] },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.loggingService.log('[SocketService] Connected:', this.socket?.id);
      this.socket?.emit('registerUser', email);

      if (this._pendingOnlineCheck) {
        const pending = this._pendingOnlineCheck;
        this._pendingOnlineCheck = undefined;
        this._pendingOnlineCheckListenerAdded = false;
        setTimeout(() => {
          this.loggingService.log('[SocketService] Flushing pending checkOnlineStatus:', pending);
          this.socket?.emit('checkOnlineStatus', { email: pending });
        }, 80);
      }
    });

    this.socket.on('disconnect', reason => {
      this.loggingService.warn('[SocketService] Disconnected:', reason);
    });

    this.socket.onAny((event, ...args) => {
      this.loggingService.log('[SocketService][ANY]', event, args);
    });
  }

  register(email: string): void {
    this.loggingService.log('[SocketService] register:', email);
    if (!this.socket) return;

    if (this.socket.connected) {
      this.socket.emit('registerUser', email);
    } else {
      this.socket.once('connect', () => {
        this.loggingService.log('[SocketService] Deferred register after connect:', email);
        this.socket?.emit('registerUser', email);
      });
    }
  }

  // ─────────────────────────── ROOM MANAGEMENT ───────────────────────────────

  joinOrder(orderId: string): void {
    this.loggingService.log('[SocketService] joinOrder:', orderId);
    this.socket?.emit('joinOrder', orderId);
  }

  leaveOrder(orderId: string): void {
    this.loggingService.log('[SocketService] leaveOrder:', orderId);
    this.socket?.emit('leaveOrder', orderId);
  }

  // ──────────────────────────────── TYPING ───────────────────────────────────

  sendTyping(orderId: string, email: string): void {
    this.socket?.emit('typing', { orderId, email });
  }

  sendStopTyping(orderId: string, email: string): void {
    this.socket?.emit('stopTyping', { orderId, email });
  }

  onTyping(): Observable<any>     { return this._on('typing'); }
  onStopTyping(): Observable<any> { return this._on('stopTyping'); }

  // ──────────────────────────────── MESSAGES ─────────────────────────────────

  onPreviousMessages(): Observable<any[]> { return this._on('previousMessages'); }
  onNewMessage(): Observable<any>         { return this._on('newMessage'); }

  sendOrderUpdate(messageData: any): void {
    this.loggingService.log('[SocketService] sendOrderUpdate:', messageData);
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
    this.loggingService.log('[SocketService] checkOnlineStatus:', email);

    if (!this.socket) {
      this._pendingOnlineCheck = email;
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('checkOnlineStatus', { email });
      return;
    }

    this._pendingOnlineCheck = email;
    if (!this._pendingOnlineCheckListenerAdded) {
      this._pendingOnlineCheckListenerAdded = true;
      this.socket.once('connect', () => {
        this._pendingOnlineCheckListenerAdded = false;
        setTimeout(() => {
          if (this._pendingOnlineCheck) {
            this.socket?.emit('checkOnlineStatus', { email: this._pendingOnlineCheck });
            this._pendingOnlineCheck = undefined;
          }
        }, 80);
      });
    }
  }

  /**
   * Explicitly marks the user as offline without disconnecting the socket.
   * Call from ngOnDestroy so the server broadcasts the offline status to
   * other parties even though the singleton socket stays alive.
   *
   * Server must handle:
   *   socket.on('userOffline', ({ email }) => {
   *     onlineUsers.delete(email);
   *     io.emit('userStatusUpdate', { email, online: false });
   *   });
   */
  setUserOffline(email: string): void {
    if (!email) return;
    this.loggingService.log('[SocketService] setUserOffline:', email);
    if (this.socket?.connected) {
      this.socket.emit('userOffline', { email });
    }
  }

  // ─────────────────────────────── HELPERS ───────────────────────────────────

  private _on<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      const socket = this.socket;
      if (!socket) {
        this.loggingService.warn(`[SocketService] "${event}": socket not yet created`);
        return;
      }
      const handler = (data: T) => {
        this.loggingService.log(`[SocketService] ${event}:`, data);
        observer.next(data);
      };
      socket.on(event, handler);
      return () => socket.off(event, handler);
    });
  }
}