import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DownloaderService {

 constructor(private http: HttpClient) {}

  downloadFile(url: string) {
    return this.http.get(url, { responseType: 'blob' });
  }
}
