import { Injectable } from '@angular/core';
import { hosturl, baseurl, uploadbaseurl, headers, fileheaders } from '../servicebasemodel';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { LoadingService } from '../Loader/loading.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private url = baseurl + '/Items';

  constructor(private http: HttpClient, private loadingService: LoadingService) {}

  getrandomdata(): Observable<any> {
    return this.http.get(`${this.url}/random`, { headers });
  }

  getdata(): Observable<any> {
    return this.http.get(`${this.url}/approved`, { headers });
  }

  getfilebaseurl(): string {
    return hosturl + '/';
  }

  uploadfiles(files: File[]): Observable<{ progress: number; response: any }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.http.post(uploadbaseurl, formData, {
      headers: fileheaders,
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            return { progress: Math.round((event.loaded / (event.total ?? 1)) * 100), response: null };
          case HttpEventType.Response:
            return { progress: 100, response: event.body };
          default:
            return { progress: 0, response: null };
        }
      })
    );
  }

  addTocart(bodydata: any): Observable<any> {
    return this.http.post(`${baseurl}/mycart/create`, bodydata, { headers });
  }

  cartcount(id: number): Observable<any> {
    return this.http.get(`${baseurl}/mycart/count/${id}`, { headers });
  }

  getmycartdata(): Observable<any> {
    return this.http.get(`${baseurl}/mycart/recent`, { headers });
  }

  getRecentOrdersActivity(): Observable<any> {
    return this.http.get(`${baseurl}/orders/recent-activity`, { headers });
  }
}