import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { headers, hosturl } from '../servicebasemodel';
import { LoggingService } from '../Logs/logging.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  private socket?: Socket;
  private serverUrl = hosturl;

  constructor(private loggingService: LoggingService) { }

  connect(email?: string): void {
    if (this.socket) return;

    this.loggingService.log('[SocketService] Connecting to socket server…');

    this.socket = io(this.serverUrl, {
      auth: {
        proxyKey: headers['X-Proxy-Key']
      },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      this.loggingService.log('[SocketService] Connected:', this.socket?.id);

      if (email) {
        this.loggingService.log('[SocketService] Registering user:', email);
        this.socket?.emit('registerUser', email);
      }
    });

    // 🔥 GLOBAL DEBUG (VERY IMPORTANT)
    this.socket.onAny((event, ...args) => {
      this.loggingService.log('[SocketService][ANY]', event, args);
    });
  }

  disconnect(): void {
    this.loggingService.warn('[SocketService] Disconnecting socket');
    this.socket?.disconnect();
    this.socket = undefined;
  }

  joinOrder(orderId: string): void {
    this.loggingService.log('[SocketService] joinOrder:', orderId);
    this.socket?.emit('joinOrder', orderId);
  }

  // ===================== TYPING =====================
  sendTyping(orderId: string, email: string): void {
    this.loggingService.log('[SocketService] sendTyping:', { orderId, email });
    this.socket?.emit('typing', { orderId, email });
  }

  sendStopTyping(orderId: string, email: string): void {
    this.loggingService.log('[SocketService] sendStopTyping:', { orderId, email });
    this.socket?.emit('stopTyping', { orderId, email });
  }

  onTyping(): Observable<any> {
    return new Observable(observer => {
      const handler = (data: any) => {
        this.loggingService.log('[SocketService] typing received:', data);
        observer.next(data);
      };
      this.socket?.on('typing', handler);
      return () => this.socket?.off('typing', handler);
    });
  }

  onStopTyping(): Observable<any> {
    return new Observable(observer => {
      const handler = (data: any) => {
        this.loggingService.log('[SocketService] stopTyping received:', data);
        observer.next(data);
      };
      this.socket?.on('stopTyping', handler);
      return () => this.socket?.off('stopTyping', handler);
    });
  }

  // ===================== MESSAGES =====================
  onPreviousMessages(): Observable<any[]> {
    return new Observable(observer => {
      const handler = (msgs: any[]) => {
        this.loggingService.log('[SocketService] previousMessages received:', msgs);
        observer.next(msgs);
      };
      this.socket?.on('previousMessages', handler);
      return () => this.socket?.off('previousMessages', handler);
    });
  }

  onNewMessage(): Observable<any> {
    return new Observable(observer => {
      const handler = (message: any) => {
        this.loggingService.log('[SocketService] newMessage received (RAW):', message);
        observer.next(message); // ✅ FIX
      };
      this.socket?.on('newMessage', handler);
      return () => this.socket?.off('newMessage', handler);
    });
  }

  sendOrderUpdate(messageData: any): void {
    this.loggingService.log('[SocketService] sendOrderUpdate:', messageData);
    this.socket?.emit('orderUpdate', messageData);
  }
}
