import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateprofiledetailComponent } from './updateprofiledetail.component';

describe('UpdateprofiledetailComponent', () => {
  let component: UpdateprofiledetailComponent;
  let fixture: ComponentFixture<UpdateprofiledetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UpdateprofiledetailComponent]
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
