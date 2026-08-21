import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { MarketingService } from '../../Service/marketing/marketing.service';
@Component({
  selector: 'app-lead-capture-widget',
  standalone: false,
  templateUrl: './lead-capture-widget.component.html',
  styleUrls: ['./lead-capture-widget.component.css']
})
export class LeadCaptureWidgetComponent implements OnInit, OnDestroy {
  widget: any = null;
  showWidget: boolean = false;
  email: string = '';
  name: string = '';
  isSubmitted: boolean = false;
  errorMessage: string = '';
  private timerId: any = null;
  private hasTrackedImpression: boolean = false;

  constructor(private marketingService: MarketingService) {}

  ngOnInit(): void {
    this.marketingService.getLeadWidget().subscribe({
      next: (res) => {
        if (res.success && res.widget && res.widget.isActive) {
          this.widget = res.widget;

          // Clear opt-out state if the admin updated/changed the discount code
          try {
            const storedCode = localStorage.getItem('lead_widget_code');
            if (storedCode !== this.widget.discountCode) {
              localStorage.removeItem('lead_widget_opted_out');
              localStorage.setItem('lead_widget_code', this.widget.discountCode || '');
            }
          } catch (e) {
            console.warn('LocalStorage reset skipped:', e);
          }

          // Check if opted out
          let isWidgetDisabled = false;
          try {
            isWidgetDisabled = localStorage.getItem('lead_widget_opted_out') === 'true';
          } catch (e) {
            // Fallback
          }

          const isDebug = typeof window !== 'undefined' && window.location.href.includes('debug_lead=true');
          if (isWidgetDisabled && !isDebug) {
            return;
          }

          this.setupTrigger();
        }
      },
      error: (err) => {
        console.error('Error fetching lead widget config:', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
  }

  private setupTrigger(): void {
    if (!this.widget) return;

    if (this.widget.triggerType === 'timed') {
      const delayMs = (this.widget.triggerDelaySeconds || 5) * 1000;
      this.timerId = setTimeout(() => {
        this.openWidget();
      }, delayMs);
    } else if (this.widget.triggerType === 'exit_intent') {
      // Exit intent fallback timer (15 seconds) so that mobile users or non-leaving mouse users get the popup
      this.timerId = setTimeout(() => {
        this.openWidget();
      }, 15000);
    }
  }

  @HostListener('document:mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent): void {
    if (this.widget && this.widget.triggerType === 'exit_intent' && event.clientY < 50) {
      this.openWidget();
    }
  }

  openWidget(): void {
    let isWidgetDisabled = false;
    try {
      isWidgetDisabled = localStorage.getItem('lead_widget_opted_out') === 'true';
    } catch (e) {
      // Fallback: don't restrict if error occurs, but prevent crash
    }
    if (this.showWidget || isWidgetDisabled) return;
    this.showWidget = true;

    if (!this.hasTrackedImpression) {
      this.hasTrackedImpression = true;
      this.marketingService.trackLeadImpression().subscribe({
        next: () => {},
        error: (err) => console.error('Error tracking lead widget impression:', err)
      });
    }
  }

  closeWidget(): void {
    this.showWidget = false;
    try {
      localStorage.setItem('lead_widget_opted_out', 'true');
    } catch (e) {
      console.warn('Failed to save lead opt-out state:', e);
    }
  }

  submitLead(): void {
    this.errorMessage = '';
    this.marketingService.submitLead(this.email, this.name).subscribe({
      next: (res) => {
        if (res.success) {
          this.isSubmitted = true;
          try {
            localStorage.setItem('lead_widget_opted_out', 'true');
          } catch (e) {
            console.warn('Failed to save lead opt-out state:', e);
          }
          setTimeout(() => {
            this.closeWidget();
          }, 3000);
        } else {
          this.errorMessage = res.message || 'Submission failed. Please try again.';
        }
      },
      error: (err) => {
        console.error('Error submitting lead:', err);
        this.errorMessage = 'Network error. Please try again later.';
      }
    });
  }
}
