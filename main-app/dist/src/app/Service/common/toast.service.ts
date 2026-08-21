import { Injectable, NgZone } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  color: string;
  duration: number;
  autoCloseTimeout?: any;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly MAX_TOASTS = 8;

  toasts: Toast[] = [];
  private counter = 0;
  private activeToastId: number | null = null;

  constructor(private ngZone: NgZone) {}

  showToast(
    type: Toast['type'],
    title: string,
    message: string,
    duration = 3000
  ) {
    const colorMap = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };

    // 🔥 NEW TITLE → CLEAR ALL TOASTS
    if (this.toasts.length > 0 && this.toasts[0].title !== title) {
      this.clearAll();
    }

    const toast: Toast = {
      id: ++this.counter,
      type,
      title,
      message,
      color: colorMap[type],
      duration
    };

    this.toasts.push(toast);

    // Enforce max limit
    if (this.toasts.length > this.MAX_TOASTS) {
      this.removeToast(this.toasts[0].id);
    }

    // Activate if none active
    if (this.activeToastId === null) {
      this.setActiveToast(toast);
    }
  }

  private setActiveToast(toast: Toast) {
    this.activeToastId = toast.id;
    this.startAutoDismiss(toast);
  }

  private startAutoDismiss(toast: Toast) {
    this.ngZone.runOutsideAngular(() => {
      toast.autoCloseTimeout = setTimeout(() => {
        this.ngZone.run(() => this.removeToast(toast.id));
      }, toast.duration);
    });
  }

  removeToast(id: number) {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index === -1) return;

    const toast = this.toasts[index];
    if (toast.autoCloseTimeout) clearTimeout(toast.autoCloseTimeout);

    const wasActive = toast.id === this.activeToastId;
    this.toasts.splice(index, 1);

    // Promote next if active was removed
    if (wasActive) {
      this.activeToastId = null;
      const next = this.toasts[0];
      if (next) this.setActiveToast(next);
    }
  }

  /** Clears all toasts immediately */
  private clearAll() {
    this.toasts.forEach(t => {
      if (t.autoCloseTimeout) clearTimeout(t.autoCloseTimeout);
    });
    this.toasts = [];
    this.activeToastId = null;
  }

  isActive(toast: Toast): boolean {
    return toast.id === this.activeToastId;
  }
}
