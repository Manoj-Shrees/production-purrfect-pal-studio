import { Component } from '@angular/core';

@Component({
  selector: 'app-passwordreset',
  standalone: false,
  templateUrl: './passwordreset.component.html',
  styleUrl: './passwordreset.component.css'
})
export class PasswordresetComponent {

  password: string = '';
  confirmPassword: string = '';
  isPasswordVisible: boolean = false;
  isConfirmVisible: boolean = false;


  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }


  toggleConfirm(input: HTMLInputElement): void {
    this.isConfirmVisible = !this.isConfirmVisible;
    input.type = this.isConfirmVisible ? 'text' : 'password';
  }


  passwordsMatch(): boolean {
    return this.password === this.confirmPassword;
  }


  
  onSubmit(): void {
    if (this.passwordsMatch()) {
      alert('Passwords matched! Submitting form...');
      // Proceed with submission (e.g., call backend)
    } else {
      alert('Passwords do not match!');
    }
  }
  


}
