import { Component } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { FormControl, NgForm } from '@angular/forms';
import { SelectskillService } from '../Service/SelectSkill/selectskill.service';
import { InfoService } from '../Service/ArtistProfile/info.service';
import { ProfileService } from '../Service/ArtistProfile/profile.service';
import { countrycodes } from './datamodel/list';      
import { ChangeDetectorRef } from '@angular/core';



@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})

export class SignupComponent {

  email: string = '';
  name: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  role: string = 'artist';
  loginError: string = '';
  isLoading: boolean = false;
  date_of_birth: Date = new Date();
  selectedFile!: File;
  nameField: any;
  location: string = '';
  skills: any;
  isskillselected: boolean = false;
  art_style: string = ''; // default value
  bio: string = '';
  emailInvalid: boolean = false;
  ispasswordmatch: boolean = false;
  maxDate: Date;
  minDate: Date;
  User_ID: any = 1;
 touplodprofileimg: any;
 isPasswordVisible: boolean = false;
 isConfirmVisible: boolean = false;

 selectedCountryCode: string = '+61';

 countrycodelist = countrycodes;

 imagePreview: string | ArrayBuffer | null = null;



  constructor(private loginService: LoginService, private router: Router, private cdr: ChangeDetectorRef,
    private skillselected: SelectskillService, private profileimage: ProfileService) {
    const today = new Date();
    this.maxDate = new Date(
      today.getFullYear() - 13,
      today.getMonth(),
      today.getDate()
    ); // Maximum allowed date (13 years ago from today)

    this.minDate = new Date(
      today.getFullYear() - 100,
      today.getMonth(),
      today.getDate()
    ); // Optional: minimum age, e.g., 100 years old max

  
  }


  onsignup(form: NgForm): void {
    

    this.isskillselected = true;
    this.skills = this.skillselected.getskill();
    
    if (form.invalid) {
      this.loginError = 'Please fill in all required fields';

      // Mark all fields as touched so errors show
      Object.values(form.controls).forEach(control => {
        control.markAsTouched();
      });

      // Scroll to first invalid field
      const firstInvalidControl: HTMLElement | null = document.querySelector(
        'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, mat-form-field .ng-invalid'
      );

      if (firstInvalidControl) {
        setTimeout(() => {
          firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalidControl.focus();
        }, 100);
      }
    }
    else {
      // continue with signup logic...
      this.isLoading = true;

      if(this.touplodprofileimg && this.email)
      this.uploadimage();
      else
      this.loginError = 'something is missing';
     
    }
  }
  openroute() {
    this.router.navigate(['/Login']);
  }


  createuser(fileurl: string){


    const signupData = {
      email: this.email,
      name: this.name,
      phone: this.selectedCountryCode + ' ' + this.phone,
      password: this.password,
      profile_url: fileurl,
      role: this.role,
      date_of_birth: this.date_of_birth.toISOString().split('T')[0],
      skill: this.skills.value,
      location: this.location,
      art_style: this.art_style,
      bio: this.bio,
      User_ID: this.User_ID,
    };  

    this.loginService.signup (signupData)

    .pipe(catchError((error) => {
      this.loginError = "Signup failed! Please check your credentials.";
      return of(error);
    })
    ).subscribe((response) => {
      if (response.message === 'signed up successfully') {
        // Store token or navigate the user after successful login
        console.log('User signned up', response.token);
        this.loginError = 'Signed up'; // Clear any previous errors
        // Redirect the user or perform other operations here
        setTimeout(() => {
          this.isLoading = false;
          this.verifyuser();
        }, 1000)

         // Navigate to another route
      this.router.navigate(['/login']);
      } else {
        this.loginError = 'Something is wrong!';
      }
      this.isLoading = false;
    });
  }


  // upload image (input)
onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;

  if (!input.files || input.files.length === 0) {
    return;
  }

  const file = input.files[0];

  // Store for backend
  this.touplodprofileimg = [file];

  // Validate image
  if (!file.type.startsWith('image/')) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    this.imagePreview = reader.result as string;

    // 🔥 Force Angular UI update immediately
    this.cdr.detectChanges();
  };

  reader.readAsDataURL(file);

  // 🔥 Reset input so selecting same file again works
  input.value = '';
}

  // Custom password confirmation validator
  passwordMatchValidator() {

    // Only validate if confirmPassword is filled
    if (this.password != this.confirmPassword) {
      this.ispasswordmatch = true;
    } else {
      this.ispasswordmatch = false;
    }
  }


  verifyuser(): void {


    this.isLoading = true;
    this.loginService
      .activationlink("tenzins0025@gmail.com", "tenzin")
      .pipe(
        catchError((error) => {
          this.loginError = 'Error to verify user. Please try again';
          return of(error);
        })
      )
      .subscribe((response) => {


        if (response.message === 'verification  email sent.') {
          // Store token or navigate the user after successful login
          console.log('activation link sent successfully', response.token);
          this.loginError = 'activation link sent successfully'; // Clear any previous errors
          // Redirect the user or perform other operations here

          this.openroute();

        } else {
          this.loginError = 'Error to verify user';
        }
        this.isLoading = false;
      });

  }
  // validate email
  validateEmail(email: string) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !regex.test(email);
  }



  adjustHeight(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';  // Reset height
    textarea.style.height = `${textarea.scrollHeight}px`;  // Set height to scrollHeight
  }

uploadimage(){

  
  this.profileimage.upload(this.touplodprofileimg, this.email).subscribe(

    (response) => {
      console.log('Profile image updated successfully:', response.files[0].path);
      const filepath = "http://localhost:8080/"+response.files[0].path;

      this.createuser(filepath);
    },
    (error) => { 
      console.error('Error updating profile image:', error);
    }
  );
}



//toggle password visibility
togglePassword(input: HTMLInputElement): void {
  this.isPasswordVisible = !this.isPasswordVisible;
  input.type = this.isPasswordVisible ? 'text' : 'password';
}

toggleConfirm(input: HTMLInputElement): void {
  this.isConfirmVisible = !this.isConfirmVisible;
  input.type = this.isConfirmVisible ? 'text' : 'password';
}

  // Only allow numbers
  allowNumbersOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Format phone number dynamically
  // Format phone number dynamically with maxlength enforcement
  formatPhoneNumber(event: any) {
    const inputEl = event.target as HTMLInputElement;
    const isIndonesia = this.selectedCountryCode === '+62';
    const maxDigits = isIndonesia ? 11 : 10;

    // Remove non-digit characters
    let digits = inputEl.value.replace(/\D/g, '');
    digits = digits.slice(0, maxDigits); // truncate extra digits

    let formatted = '';
    if (isIndonesia) {
      // XXX XXXX XXXX
      if (digits.length >= 1) formatted += digits.substring(0, 3);
      if (digits.length >= 4) formatted += ' ' + digits.substring(3, 7);
      if (digits.length >= 8) formatted += ' ' + digits.substring(7, 11);
    } else {
      // XXX XXX XXXX
      if (digits.length >= 1) formatted += digits.substring(0, 3);
      if (digits.length >= 4) formatted += ' ' + digits.substring(3, 6);
      if (digits.length >= 7) formatted += ' ' + digits.substring(6, 10);
    }

    // Update the input and ngModel
    inputEl.value = formatted;
    this.phone = formatted;

    // Set maxlength dynamically including spaces
    inputEl.maxLength = isIndonesia ? 13 : 12; // Indonesia: 3+1+4+1+4=13 | Others: 3+1+3+1+4=12

    // Keep cursor in place
    const prevCursor = inputEl.selectionStart || 0;
    const oldLength = inputEl.value.length;

    inputEl.value = formatted;
    this.phone = formatted;

    const newCursor = prevCursor + (formatted.length - oldLength);

    setTimeout(() => {
      inputEl.setSelectionRange(newCursor, newCursor);
    });

  }



  // Validation function
  isPhoneValid(): boolean {
    if (!this.phone) return false;
    const digits = this.phone.replace(/\D/g, '');
    return this.selectedCountryCode === '+62'
      ? digits.length === 11
      : digits.length === 10;
  }




}



