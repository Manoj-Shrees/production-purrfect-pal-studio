import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginStatusService {

private loginStatusSubject = new BehaviorSubject<boolean>(false);
  loginStatus$ = this.loginStatusSubject.asObservable();

  setJustLoggedIn() {
    this.loginStatusSubject.next(true);
  }

  clearLoginStatus() {
    this.loginStatusSubject.next(false);
  }

}
