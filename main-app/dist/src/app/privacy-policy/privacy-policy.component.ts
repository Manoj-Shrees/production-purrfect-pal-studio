import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: false,
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent {

  // Typed interface for clarity
  privacyPolicySections = this.getAllPrivacyPolicy();

  getAllPrivacyPolicy() {
    return [
      {
        question: "Information We Collect",
        icon: "fa-database",
        answer: null,
        list: [
          "Personal Data: Name, email, payment details when placing an order.",
          "Automatically Collected Data: IP address, browser type for analytics."
        ]
      },
      {
        question: "How We Use Your Data",
        icon: "fa-gears",
        answer: null,
        list: [
          "To process orders and payments securely.",
          "To improve our website and services.",
          "To send order updates and optional promotions."
        ]
      },
      {
        question: "How We Protect & Share Data",
        icon: "fa-shield-halved",
        answer: "We use SSL encryption and secure payment processor Stripe. We do not sell your data but may share it with payment/shipping providers.",
        list: null
      },
      {
        question: "Cookies & Your Choices",
        icon: "fa-cookie-bite",
        answer: "We recommend using cookies for a better experience. You can disable cookies in your browser settings at any time.",
        list: null
      },
      {
        question: "Your Rights",
        icon: "fa-scale-balanced",
        answer: "You can request to access, update, or delete your data at any time. Contact us at support@purrfectpal.studio.",
        list: null
      },
      {
        question: "Changes & Contact",
        icon: "fa-envelope-open-text",
        answer: null,
        list: [
          "We may update this policy. Changes will be posted here.",
          "Email: support@purrfectpal.studio",
          "Website: www.purrfectpal.studio"
        ]
      }
    ];
  }

  constructor(private socialmedia: SociallinkService, private cdRef: ChangeDetectorRef) {}

  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  innerWidth: number = window.innerWidth;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  opensocialurl(pos: number) {
    this.socialmedia.geturl(pos);
  }
}