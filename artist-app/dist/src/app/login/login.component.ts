import { Component } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../Service/Auth/auth.service';
import { RouteAccessService } from '../Service/Auth/route-access.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  username: string = '';
  password: string = '';
  loginError: string = '';
  isLoading: boolean = false;
  email: string = '';
  emailInvalid: boolean = false;
  ispassword: boolean = false;
  isemail: boolean = false;
  isPasswordVisible: boolean = false;



  constructor(private login: LoginService, private accessService: RouteAccessService, private authService: AuthService, private router: Router) {

  }


  ngOnInit(): void {

    this.authService.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        this.authService.setUser(response.user); // Optional: update the user again
        this.router.navigate(['/jobs']);
      }
    });

  }

  onlogin() {

    if (this.email == '') {
      this.isemail = true;
    }

    if (this.password == '') {
      this.ispassword = true;
    }


    if (this.isemail && this.ispassword) {
      this.loginError = "Enter your detais to login";

    }

    else {
      this.isLoading = true;
      this.login
      .loginuser(this.email, this.password).pipe(
        
        catchError((error) => {
        this.loginError = "Login failed! Please check your credentials.";
        return of(error);
      })
      ).subscribe((response) => {
        if (response.message === 'Logged in successfully') {
          // Store token or navigate the user after successful login
          //console.log(response)
            
            this.router.navigate(['/jobs']);
      
          // Navigate to another route

        } else {
          this.loginError = 'Invalid login credentials!';
          
        }

           this.isLoading = false;
       
      });

    
    }
  }



  // validate email
  validateEmail(email: string) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !regex.test(email);
  }


  // toggle password visibility

  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }

   openforgotpassroute() {
    this.accessService.allowNextAccess();
    this.router.navigate(['/forgot-password']);
  }


}
