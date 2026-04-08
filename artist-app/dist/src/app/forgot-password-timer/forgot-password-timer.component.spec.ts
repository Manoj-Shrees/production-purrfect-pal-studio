import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordTimerComponent } from './forgot-password-timer.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ForgotPasswordTimerComponent', () => {
  let component: ForgotPasswordTimerComponent;
  let fixture: ComponentFixture<ForgotPasswordTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      declarations: [ForgotPasswordTimerComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ email: 'test@artist.com' })
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
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
