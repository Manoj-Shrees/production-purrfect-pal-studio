import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DisablerightclickDirective } from './disablerightclick.directive';
import { Component } from '@angular/core';

@Component({
  template: `<div appDisablerightclick>Test Div</div>`
})
class TestComponent {}

describe('DisablerightclickDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let divEl: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, DisablerightclickDirective]
    });

    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    divEl = fixture.debugElement.query(By.directive(DisablerightclickDirective)).nativeElement;
  });

  it('should prevent context menu (right-click)', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefaultSpy = spyOn(event, 'preventDefault');

    divEl.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should prevent Control + click', () => {
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = spyOn(clickEvent, 'preventDefault');

    const keyDown = new KeyboardEvent('keydown', { key: 'Control' });
    const keyUp = new KeyboardEvent('keyup', { key: 'Control' });

    document.dispatchEvent(keyDown);
    document.dispatchEvent(clickEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();

    document.dispatchEvent(keyUp);
  });

  it('should prevent long press if touch is held without moving', (done) => {
    const touchStartEvent = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    const preventDefaultSpy = spyOn(touchStartEvent, 'preventDefault');

    divEl.dispatchEvent(touchStartEvent);

    setTimeout(() => {
      expect(preventDefaultSpy).toHaveBeenCalled();
      done();
    }, 700); // slightly more than 600ms to trigger long press
  });

  it('should cancel long press timer if touch moves', () => {
    const directiveInstance = fixture.debugElement.query(By.directive(DisablerightclickDirective)).injector.get(DisablerightclickDirective);
    spyOn(window, 'clearTimeout');

    divEl.dispatchEvent(new TouchEvent('touchmove'));
    expect(clearTimeout).toHaveBeenCalledWith(directiveInstance['longPressTimer']);
  });

  it('should apply user-select: none styles', () => {
    const styles = getComputedStyle(divEl);
    expect(styles.userSelect).toBe('none');
  });
});