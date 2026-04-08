import { Injectable } from '@angular/core';
import { baseurl } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserinfoService {
private url = baseurl; 
  constructor(private http: HttpClient) {

   }
   
}
