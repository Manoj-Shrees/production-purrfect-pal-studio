import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfilerefreshService {

  private refreshSubject = new Subject<void>();
  refreshRequested$ = this.refreshSubject.asObservable();

  requestRefresh() {
    this.refreshSubject.next();
  }

}
