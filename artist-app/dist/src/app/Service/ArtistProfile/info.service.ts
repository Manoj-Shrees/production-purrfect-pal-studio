import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, switchMap } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class InfoService {
 private url = baseurl; 
  constructor( private http: HttpClient) { }

  getinfo(id: number):Observable <any>{
    return this.http.get(this.url+"/artistprofile/"+id, {headers: headers });
}
update(id: number, data: any):Observable <any>{
  return this.http.put(this.url+"/artistprofile/update/"+id, data, { headers: headers }).pipe(
    switchMap((response) =>{
      return of(response);
    }),
    catchError((error) => {
      return of(error);
    })
);
}

}
