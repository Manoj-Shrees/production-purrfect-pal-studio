
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RouteAccessService {
  private _allowed = false;

  /** Called before programmatic navigation to grant one-time access. */
  allowNextAccess(): void {
    this._allowed = true;
  }

  /** Guard calls this to check the flag without consuming it. */
  isNextAccessAllowed(): boolean {
    return this._allowed;
  }

  /** Guard calls this after granting access to prevent reuse. */
  consumeAccess(): void {
    this._allowed = false;
  }
}