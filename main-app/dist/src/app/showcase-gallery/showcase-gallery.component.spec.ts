import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowcaseGalleryComponent } from './showcase-gallery.component';

describe('ShowcaseGalleryComponent', () => {
  let component: ShowcaseGalleryComponent;
  let fixture: ComponentFixture<ShowcaseGalleryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ShowcaseGalleryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowcaseGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
