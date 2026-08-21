import { Component } from '@angular/core';
import { ToastService, Toast } from '../../Service/common/toast.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { trigger, transition, animate, style, keyframes } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: false,
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
  animations: [
    trigger('slidePop', [
      transition(':enter', [
        animate('400ms cubic-bezier(0.25, 0.8, 0.25, 1)', keyframes([
          style({ transform: 'translateX(120%) scale(0.9)', opacity: 0, offset: 0 }),
          style({ transform: 'translateX(0) scale(1.05)', opacity: 1, offset: 0.7 }),
          style({ transform: 'translateX(0) scale(1)', opacity: 1, offset: 1 })
        ]))
      ]),
      transition(':leave', [
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', keyframes([
          style({ transform: 'translateX(0) scale(1)', opacity: 1, offset: 0 }),
          style({ transform: 'translateX(120%) scale(0.9)', opacity: 0, offset: 1 })
        ]))
      ])
    ])
  ]
})
export class ToastComponent {
  constructor(
    public toastService: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  dismiss(toast: Toast) {
    this.toastService.removeToast(toast.id);
  }

  trackById(_: number, toast: Toast) {
    return toast.id;
  }

  getStackStyle(index: number, color: string) {
    const maxVisible = 8;
    if (index >= maxVisible) {
      return {
        opacity: '0',
        pointerEvents: 'none',
        transform: 'scale(0.9)',
        zIndex: '0',
        '--toast-color': color
      };
    }
    const scale = 1 - index * 0.06;
    const translateY = index * 12;
    const opacity = 1 - index * 0.15;
    return {
      transform: `translateY(${translateY}px) scale(${scale})`,
      opacity: `${opacity}`,
      zIndex: `${100 - index}`,
      pointerEvents: index === 0 ? 'auto' : 'none',
      '--toast-color': color
    };
  }

  /**
   * SVG icons use explicit stroke/fill attributes (not CSS inheritance)
   * so they render correctly in Safari when injected via innerHTML.
   *
   * Key fixes:
   * - stroke="white" / fill="none" set directly on <svg> element
   * - No reliance on CSS currentColor through innerHTML injection
   * - Explicit viewBox, width, height on every <svg>
   * - No vector-effect (not supported in Safari)
   */
  getIcon(type: string): SafeHtml {
    const svgAttrs = `
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="white"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    `.trim();

    const icons: Record<string, string> = {
      success: `<svg ${svgAttrs}><polyline points="20 6 9 17 4 12"/></svg>`,

      error: `<svg ${svgAttrs}>
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6"  y1="6" x2="18" y2="18"/>
      </svg>`,

      info: `<svg ${svgAttrs}>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <circle cx="12" cy="7" r="0.5" fill="white" stroke="white" stroke-width="2.5"/>
      </svg>`,

      warning: `<svg ${svgAttrs}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9"  x2="12" y2="13"/>
        <circle cx="12" cy="17" r="0.5" fill="white" stroke="white" stroke-width="2.5"/>
      </svg>`
    };

    return this.sanitizer.bypassSecurityTrustHtml(icons[type] ?? icons['info']);
  }
}