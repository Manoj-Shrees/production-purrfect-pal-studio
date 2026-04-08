import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  
  private url = baseurl+ "/Items";

  constructor(private http: HttpClient) { 
  }

  uploadandcreate(items: any){
    return this.http.post(this.url+"/create", items, { headers: headers });
  }


  getitemdata(){
    return this.http.get(this.url, { headers: headers })
  }


}
