import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PastOrdersComponent } from './past-orders.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { LoggingService } from '../Service/Logs/logging.service';

describe('PastOrdersComponent', () => {
  let component: PastOrdersComponent;
  let fixture: ComponentFixture<PastOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [PastOrdersComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: LoggingService,
          useValue: {
            log: jasmine.createSpy('log'),
            warn: jasmine.createSpy('warn'),
            error: jasmine.createSpy('error'),
            info: jasmine.createSpy('info')
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PastOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
