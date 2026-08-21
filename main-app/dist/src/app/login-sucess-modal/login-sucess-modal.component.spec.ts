import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginSucessModalComponent } from './login-sucess-modal.component';

describe('LoginSucessModalComponent', () => {
  let component: LoginSucessModalComponent;
  let fixture: ComponentFixture<LoginSucessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginSucessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginSucessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
