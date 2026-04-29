import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';


interface LoginResponse {
  token: string;
  user: any;
}


@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private url = baseurl;


  constructor(private http: HttpClient) { }

  loginuser(username: string, password: string) {

    const body = { username, password,  "role": "artist"  };

    return this.http.post<LoginResponse>(this.url + "/login", body, { headers: headers , withCredentials: true }).pipe(
      switchMap((response) => {
        // You can perform additional operations here if needed (e.g., saving user data or token)
        // console.log('Login successful:', response);
        // Optionally return the response or data to other parts of the app
        return of(response);
      })
    );

  }


  forgotpasslink(email: string){

    const body = { "email": email };

    return this.http.post(this.url+"/reset-password", body, { headers: headers }).pipe(
      switchMap((response) => {
        // You can perform additional operations here if needed (e.g., saving user data or token)
      //  this.loggingService.log('forgot pass successful:', response);
        // Optionally return the response or data to other parts of the app
        return of(response);
      }),
      catchError((error) => {

        // You can return an error response or a fallback value
        return of({ error });
      })
    );

  }


logoutuser(): Observable<any> {
  return this.http.post(
    this.url + '/logout',
    {}, // ✅ empty body
    {
      headers: headers,      // ✅ correct place
      withCredentials: true      // ✅ send cookies
    }
  );
}

  signup(body: any) {

   // console.log(body)
    return this.http.post(this.url + "/artistprofile/create", body, { headers: headers, withCredentials: true }).pipe(
      switchMap((response) => {
        // You can perform additional operations here if needed (e.g., saving user data or token)
      //  console.log(response);
        // Optionally return the response or data to other parts of the app
        return of(response);
      }),
      catchError((error) => {

        // You can return an error response or a fallback value
        return of({ error });
      })
    );

  }

  activationlink(email: string, name: string) {

    const body = { email, name };

    return this.http.post(this.url + "/activate/" + email, body, { headers: headers, withCredentials: true }).pipe(
      switchMap((response) => {
        // You can perform additional operations here if needed (e.g., saving user data or token)
        // console.log('forgor pass successful:', response);
        // Optionally return the response or data to other parts of the app
        return of(response);
      }),
      catchError((error) => {

        // You can return an error response or a fallback value
        return of({ error });
      })
    );

  }


   verifyuser(email: string): Observable<any> {

    const body = { "email": email };

    return this.http.post(this.url+"/activate", body, { headers: headers }).pipe(
      switchMap((response) => {
        // You can perform additional operations here if needed (e.g., saving user data or token)
      //  this.loggingService.log('Account verification successful:', response);
        // Optionally return the response or data to other parts of the app
        return of(response);
      }),
      catchError((error) => {
       // this.loggingService.error('Account verification failed:', error);
        // You can return an error response or a fallback value
        return of({ error });
      })
    );
  }


}
