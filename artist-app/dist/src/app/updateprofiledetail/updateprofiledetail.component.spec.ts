import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdateprofiledetailComponent } from './updateprofiledetail.component';
import { DatePipe } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

describe('UpdateprofiledetailComponent', () => {
  let component: UpdateprofiledetailComponent;
  let fixture: ComponentFixture<UpdateprofiledetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        MatDatepickerModule,
        MatNativeDateModule
      ],
      declarations: [UpdateprofiledetailComponent],
      providers: [DatePipe],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateprofiledetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
