import { Injectable } from '@angular/core';
import {  baseurl, headers, fileheaders,  hosturl } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, switchMap } from 'rxjs';

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
   

    //console.log("selected files:"+files);

      return this.http.post(this.getfilebaseurl()+"profile/upload", formData, { headers: fileheaders });
    }



    update(id: number, data: any){
      return this.http.put(this.url+"/profileimage/update/"+id, data, { headers: headers });
    }




}
