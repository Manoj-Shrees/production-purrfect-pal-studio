import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
private _loading = new BehaviorSubject<boolean>(false);
  public readonly loading$ = this._loading.asObservable();

  private loaderShownAt: number | null = null;
  private minDuration = 1500; // ms

  show(): void {
    this.loaderShownAt = Date.now();
    this._loading.next(true);
  }

  hide(): void {
    const now = Date.now();
    const shownAt = this.loaderShownAt ?? now;
    const elapsed = now - shownAt;
    const remaining = this.minDuration - elapsed;

    if (remaining > 0) {
      setTimeout(() => {
        this._loading.next(false);
      }, remaining);
    } else {
      this._loading.next(false);
    }
  }
 
}
