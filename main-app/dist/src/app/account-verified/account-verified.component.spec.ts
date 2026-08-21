import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountVerifiedComponent } from './account-verified.component';

describe('AccountVerifiedComponent', () => {
  let component: AccountVerifiedComponent;
  let fixture: ComponentFixture<AccountVerifiedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccountVerifiedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountVerifiedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
