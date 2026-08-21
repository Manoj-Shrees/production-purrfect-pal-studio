import { Injectable } from '@angular/core';
import {  baseurl, fileheaders, headers, hosturl } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, Subject, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
private url = baseurl; 
  constructor(private http: HttpClient) {

   }


   getfilebaseurl(){
    return hosturl+"/";
   }


   getprofile(id: string):Observable <any>{
        return this.http.get<any>(this.url+"/user/email/"+id, { headers: headers }).pipe(
          switchMap((response) =>{
            return of(response);
          }),
          catchError((error) => {
            return of(error);
          })
      );
    }


    upload(files: File [], username: string): Observable<any>{

      const formData = new FormData();

     formData.append('username', username);

      // Append each file to the FormData object
    files.forEach(file => formData.append('files', file, file.name));
    // Append username
   

      return this.http.post(this.getfilebaseurl()+"profile/upload", formData, { headers: fileheaders });
    }



    updatepro_img(id: number, data: any){
      return this.http.put(this.url+"/profileimage/update/"+id, data, { headers: headers });
    }


    getinfo(id: number):Observable <any>{
      return this.http.get(this.url+"/user/email/"+id, { headers: headers });
  }
   
  update_pro_data(id: string, data: any):Observable <any>{
    return this.http.put(this.url+"/user/update/"+id, data, { headers: headers }).pipe(
      switchMap((response) =>{
        return of(response);
      }),
      catchError((error) => {
        return of(error);
      })
  );
  }


  private refreshSubject = new Subject<void>();
  refreshRequested$ = this.refreshSubject.asObservable();

  requestRefresh() {
    this.refreshSubject.next();
  }




}
