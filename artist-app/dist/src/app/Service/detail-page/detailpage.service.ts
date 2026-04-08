import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DetailpageService {

private url = baseurl;

  constructor(private http: HttpClient) { }

  getorderdata(id: number){
    return this.http.get(this.url+"/order/artist/"+id, { headers: headers }).pipe(
      switchMap((response) =>{
          console.log("artist ID"+ JSON.stringify(response))
        return of(response);
      
      }),
      catchError((error) => {
        return of(error);
      })
  );
}

getallorderdata(){
  return this.http.get(this.url+"/orders", { headers: headers }).pipe(
      switchMap((response: any) =>{
        console.log("artist ID"+ JSON.stringify(response.Orders))
        return of(response);
      
      }),
      catchError((error) => {
        return of(error);
      })
  );
}
}
