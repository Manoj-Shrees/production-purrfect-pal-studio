import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForgotPasswordTimerComponent } from './forgot-password-timer.component';

describe('ForgotPasswordTimerComponent', () => {
  let component: ForgotPasswordTimerComponent;
  let fixture: ComponentFixture<ForgotPasswordTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ForgotPasswordTimerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
