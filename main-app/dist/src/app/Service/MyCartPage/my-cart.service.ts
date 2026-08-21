import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MyCartService {
  private url = baseurl+"/mycart";

   constructor(private http: HttpClient) { }
  
    getdata(id: number): Observable<any>{
      return this.http.get(this.url+"/"+id, { headers: headers });
    }
  


    deleteitemdata(id: number, userid: number): Observable<any>{

      const options = {
        headers: headers,
        body: {
          userid: userid
        },
      };
      

      return this.http.delete(this.url+"/dropitem/"+id, options);
      
    }


    deleteallitemdata(id: number){
      return this.http.delete(this.url+"/"+id, { headers: headers });
    }

    validatePromoCode(code: string): Observable<any> {
      return this.http.post(baseurl + "/promo-codes/validate", { code }, { headers: headers, withCredentials: true });
    }
}
