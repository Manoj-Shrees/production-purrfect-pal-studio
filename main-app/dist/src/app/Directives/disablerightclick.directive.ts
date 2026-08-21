import { Directive, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appDisablerightclick]',
  standalone: false,
})
export class DisablerightclickDirective {
  private longPressTimer: any;
  private touchMoved = false;

  constructor(private elRef: ElementRef, private renderer: Renderer2) {
    const host: HTMLElement = this.elRef.nativeElement;

    // ── CSS-layer protections on the host element ──────────────────────
    this.renderer.setStyle(host, 'user-select',           'none');
    this.renderer.setStyle(host, '-webkit-user-select',   'none');
    this.renderer.setStyle(host, '-webkit-touch-callout', 'none');
    this.renderer.setStyle(host, '-webkit-user-drag',     'none');

    // ── Disable drag + pointer-events on child <img> elements ─────────
    const imgs: NodeListOf<HTMLImageElement> = host.querySelectorAll('img');
    imgs.forEach((img: HTMLImageElement) => {
      img.draggable = false;
      img.setAttribute('draggable', 'false');
      img.style.pointerEvents = 'none';
      (img.style as any)['-webkit-touch-callout'] = 'none';
    });
  }

  // ── Right click ──────────────────────────────────────────────────────
  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void { event.preventDefault(); }

  // ── Drag ─────────────────────────────────────────────────────────────
  @HostListener('dragstart', ['$event'])
  onDragStart(event: DragEvent): void { event.preventDefault(); }

  // ── Ctrl / Cmd click (open in new tab) ───────────────────────────────
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Control' || event.key === 'Meta') {
      document.addEventListener('click', this.preventControlClick, true);
    }
  }

  @HostListener('keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Control' || event.key === 'Meta') {
      document.removeEventListener('click', this.preventControlClick, true);
    }
  }

  // ── Mobile long-press ────────────────────────────────────────────────
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchMoved = false;
    this.longPressTimer = setTimeout(() => {
      if (!this.touchMoved) { event.preventDefault(); }
    }, 600);
  }

  @HostListener('touchmove')
  onTouchMove(): void { this.touchMoved = true; this.clearLongPress(); }

  @HostListener('touchend')
  @HostListener('touchcancel')
  clearLongPress(): void { clearTimeout(this.longPressTimer); }

  preventControlClick = (event: MouseEvent): void => { event.preventDefault(); };
}
