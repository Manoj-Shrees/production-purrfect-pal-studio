import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrintOnDemandComponent } from './print-on-demand.component';

describe('PrintOnDemandComponent', () => {
  let component: PrintOnDemandComponent;
  let fixture: ComponentFixture<PrintOnDemandComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrintOnDemandComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintOnDemandComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
