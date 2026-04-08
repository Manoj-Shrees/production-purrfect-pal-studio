import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

   private url = baseurl;

  constructor(private http: HttpClient) { }


  getuserdetailbyid(id: string): Observable<any>{

  
      return this.http.get(this.url+"/user/email/"+id,  { headers: headers });
  }

  getuserprofilebyidnumber(id: number){
    return this.http.get(this.url+"/user/"+id, { headers: headers });

  }

 updatepasswordafterlogin(emailid: string, oldpass: string, newpassword: string): Observable<any>{

    const body = {

     "username": emailid, 
     "password": oldpass, 
     "newpassword": newpassword 

    }
    return this.http.put(this.url+"/pass/updateafterlogin", body, { headers: headers });
  }






  verfiyuserandupdatepass(newpassword: string, token: string, email: string): Observable<any> {

    const body = {
      "newpass": newpassword,
      "email": email,
      "token": token,
    };

    return this.http.post(this.url+"/reset-password/verify", body, { headers: headers });
  }


}
