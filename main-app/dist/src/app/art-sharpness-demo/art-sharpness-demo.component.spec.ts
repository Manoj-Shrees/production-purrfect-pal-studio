import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArtSharpnessDemoComponent } from './art-sharpness-demo.component';

describe('ArtSharpnessDemoComponent', () => {
  let component: ArtSharpnessDemoComponent;
  let fixture: ComponentFixture<ArtSharpnessDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ArtSharpnessDemoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArtSharpnessDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
