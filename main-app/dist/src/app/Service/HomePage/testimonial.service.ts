import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {baseurl, headers} from '../servicebasemodel'
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TestimonialService {

  private url = baseurl+"/testimonial";

  constructor(private http: HttpClient) { }

  getdata(): Observable<any> {
    return this.http.get(this.url, { headers: headers });
  }

}
