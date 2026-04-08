import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderTutorialComponent } from './order-tutorial.component';
import { RouterTestingModule } from '@angular/router/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('OrderTutorialComponent', () => {
  let component: OrderTutorialComponent;
  let fixture: ComponentFixture<OrderTutorialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [OrderTutorialComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderTutorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
