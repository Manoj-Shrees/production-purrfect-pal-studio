import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from '../Service/User/users.service';
import * as LZString from 'lz-string';
import { LoggingService } from '../Service/Logs/logging.service';

@Component({
  selector: 'app-forgot-password-reset',
  standalone: false,

  templateUrl: './forgot-password-reset.component.html',
  styleUrl: './forgot-password-reset.component.css'
})
export class ForgotPasswordResetComponent {

  passwordForm: FormGroup;
  ispasswordreset: boolean = false;
  errormsg: string = '';

  useremail: string = '';
  token: string = '';

  newpassword: string = '';

  isloading: boolean = false;
 isNewPasswordVisible = false;
  isConfirmPasswordVisible = false;

  constructor(private activeroute: ActivatedRoute, private fb: FormBuilder, private userservice: UsersService, private loggingService: LoggingService) {

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {


this.activeroute.queryParams.subscribe(params => {
      const compressedToken = params['token'];
      const compressedEmail = params['id'];

      if (compressedToken && compressedEmail) {
        try {
          // First decode URI component (in case email link already encodes it)
          const decodedToken = decodeURIComponent(compressedToken);
          const decodedEmail = decodeURIComponent(compressedEmail);

          if (!decodedToken || !decodedEmail) {
            throw new Error('Invalid or expired link.');
          }

          this.token = decodedToken;
          this.useremail = decodedEmail;

          this.loggingService.log('Decompressed token:', this.token);
          this.loggingService.log('Decompressed email:', this.useremail);

        } catch (error) {
          this.loggingService.error('Error', error);
          this.errormsg = 'Invalid or expired reset link.';
          this.ispasswordreset = false;
        }
      } else {
        this.errormsg = 'Token not found or link is invalid.';
        this.ispasswordreset = false;
      }
    });
    // Removed invalid usage of compressedToken here
  }

   // toggle password visibility

  togglePassword(inputElement: HTMLInputElement, passwordType: string) {
    if (passwordType === 'newPassword') {
      this.isNewPasswordVisible = !this.isNewPasswordVisible;
    } else if (passwordType === 'confirmPassword') {
      this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
    }
    inputElement.type = inputElement.type === 'password' ? 'text' : 'password';
  }


  updatepass(token: any, email: any) {

    this.isloading = true;

    this.userservice.verfiyuserandupdatepass(this.passwordForm.value.newPassword, token, email).subscribe(
      (response) => {
        this.loggingService.log('User verified successfully:', response);
        const { verified } = response; // Assuming the response contains the email

        if (!verified) {
          this.errormsg = 'Invalid or expired token.'
          this.ispasswordreset = false;
          this.isloading = false;
          return;
        }

        else {
           this.isloading = false;
          this.ispasswordreset = true;
        }
      },
      (error: any) => {
        this.loggingService.error('Error verifying user:', error);
        this.isloading = false;
      }
    );
  }




  // Custom validator
  passwordMatchValidator(form: AbstractControl) {
    const password = form.get('newPassword')?.value;
    const confirm = form.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  onSubmit() {
    if (this.passwordForm.valid) {
      // Handle password reset logic here
      this.updatepass(this.token, this.useremail);

      this.loggingService.log('Password reset requested for:', this.useremail, "with token:", this.token, "pass:", this.passwordForm.value.newPassword);
    }
  }

  get newPassword() { return this.passwordForm.get('newPassword'); }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }



}
