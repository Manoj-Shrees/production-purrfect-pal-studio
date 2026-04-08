import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RouteAccessService {
  private allowRoute = false;

  allowNextAccess() {
    this.allowRoute = true;
  }

  consumeAccess(): boolean {
    const allowed = this.allowRoute;
    this.allowRoute = false; // Reset after first use
    return allowed;
  }
}
