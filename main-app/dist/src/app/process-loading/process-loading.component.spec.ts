import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessLoadingComponent } from './process-loading.component';

describe('ProcessLoadingComponent', () => {
  let component: ProcessLoadingComponent;
  let fixture: ComponentFixture<ProcessLoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProcessLoadingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProcessLoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
