import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-login-sucess-modal',
  standalone: false,
  
  templateUrl: './login-sucess-modal.component.html',
  styleUrl: './login-sucess-modal.component.css'
})
export class LoginSucessModalComponent {
@Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    setTimeout(() => {
      this.close.emit(); // auto-close after 3s
    }, 3000);
  }

  onClose() {
    this.close.emit(); // manual close
  }

}
