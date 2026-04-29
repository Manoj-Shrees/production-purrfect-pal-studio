import { Injectable } from '@angular/core';
import { basefileurl, baseurl, fileheaders, headers, hosturl, uploadbaseurl, uploadpremadebaseurl } from '../servicebasemodel';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private url = baseurl+"/Items";
  
  constructor(private http: HttpClient) { }



  getfilebaseurl(){
    return hosturl+'/';
  }


 uploadfiles(files: File[]): Observable<{ progress: number; response: any }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file, file.name));

  return this.http.post(uploadbaseurl, formData, {
    headers: fileheaders,
    reportProgress: true,
    observe: 'events'
  }).pipe(
    map(event => {
      switch (event.type) {
        case HttpEventType.UploadProgress:
          return {
            progress: Math.round((event.loaded / (event.total ?? 1)) * 100),
            response: null
          };
        case HttpEventType.Response:
          return { progress: 100, response: event.body };
        default:
          return { progress: 0, response: null };
      }
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
 
  uploadfilespremade(files: File []): Observable<any>
  {
    const formData = new FormData();

      // Append each file to the FormData object
    files.forEach(file => formData.append('files', file, file.name));

  //  console.log("selected files:"+files);

    return this.http.post(uploadpremadebaseurl, formData, { headers: fileheaders }); 
  }
 
}
