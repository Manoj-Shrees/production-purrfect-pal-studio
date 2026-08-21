import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrintOnDemandCheckoutComponent } from './print-on-demand-checkout.component';

describe('PrintOnDemandCheckoutComponent', () => {
  let component: PrintOnDemandCheckoutComponent;
  let fixture: ComponentFixture<PrintOnDemandCheckoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrintOnDemandCheckoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintOnDemandCheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
