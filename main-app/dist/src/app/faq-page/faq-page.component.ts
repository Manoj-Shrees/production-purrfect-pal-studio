import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';

@Component({
  selector: 'app-faq-page',
  standalone: false,
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.css'
})
export class FaqPageComponent {

  faqdata = this.getAllFaq();

getAllFaq() {
  return [
    {
      category: "General Questions",
      icon: "fa-circle-info",
      questions: [
        {
          question: "What is Purrfect Pal Studio?",
          icon: "fa-store",
          answer: "Purrfect Pal Studio specialises in digital artwork that captures the unique bond between pets and their owners. We create custom portraits that highlight the personalities and connection between you and your furry friend.",
          list: null
        },
        {
          question: "Do you only create pet portraits, or can I include myself too?",
          icon: "fa-paw",
          answer: "While we love creating pet portraits, we also offer illustrations that feature you alongside your pet, or even multiple pets and family members in one artwork.",
          list: null
        },
        {
          question: "Can I request a custom illustration of multiple pets and owners?",
          icon: "fa-layer-group",
          answer: "Absolutely! We can create a single illustration featuring multiple pets and their owners. Pricing may vary depending on the number of subjects and the level of detail.",
          list: null
        }
      ]
    },
    {
      category: "Ordering & Customisation",
      icon: "fa-pen-ruler",
      questions: [
        {
          question: "How do I place an order?",
          icon: "fa-cart-shopping",
          answer: null,
          list: [
            "Choose your preferred style from our product page.",
            "Upload clear, high-quality photos of yourself and your pet(s).",
            "Provide any customisation details, poses, or themes you want included.",
            "Complete checkout, and we’ll begin creating your personalised portrait!"
          ]
        },
        {
          question: "What kind of reference photos should I provide?",
          icon: "fa-image",
          answer: null,
          list: [
            "High-resolution photos with good lighting for both pets and owners.",
            "Clear details of faces, expressions, and unique features.",
            "Multiple angles help us create a more accurate and lifelike portrait."
          ]
        },
        {
          question: "Can I request specific backgrounds or themes?",
          icon: "fa-palette",
          answer: "Yes! You can specify a background, theme, or setting that complements both you and your pet(s). Whether it’s a park, fantasy setting, or favourite spot, we’ll tailor it to your vision.",
          list: null
        }
      ]
    },
    {
      category: "Pricing & Payment",
      icon: "fa-tag",
      questions: [
        {
          question: "How much do your custom portraits cost?",
          icon: "fa-dollar-sign",
          answer: "Pricing depends on the style, complexity, and the number of people and pets in the portrait. Please visit our product page to see the latest pricing options for personalised pet + owner portraits.",
          list: null
        },
        {
          question: "What payment methods do you accept?",
          icon: "fa-credit-card",
          answer: null,
          list: [
            "Apple Pay & Google Pay",
            "AfterPay, ZipPay & Klarna",
            "Major credit and debit cards"
          ]
        },
        {
          question: "Do you offer refunds?",
          icon: "fa-rotate-left",
          answer: "Since each portrait is custom-made, refunds are not generally available. However, if there’s an issue with your artwork, contact us at support@purrfectpal.studio and we’ll work to resolve it.",
          list: null
        }
      ]
    },
    {
      category: "Delivery & Turnaround Time",
      icon: "fa-truck-fast",
      questions: [
        {
          question: "How long does it take to complete a custom portrait?",
          icon: "fa-clock",
          answer: "Turnaround time is typically 2–5 business days depending on complexity and order volume. Larger or more detailed portraits may take slightly longer.",
          list: null
        },
        {
          question: "How will I receive my digital artwork?",
          icon: "fa-file-arrow-down",
          answer: null,
          list: [
            "Your completed portrait will be sent via email as a high-resolution digital file.",
            "You can also download it directly from our website.",
            "Files are print-ready, perfect for home display or sharing online."
          ]
        },
        {
          question: "Can I print my portrait?",
          icon: "fa-print",
          answer: "Yes! We provide print-ready files suitable for canvases, posters, and other materials so you can proudly display your portrait of you and your pet(s).",
          list: null
        }
      ]
    },
    {
      category: "Other Questions",
      icon: "fa-ellipsis",
      questions: [
        {
          question: "Do you offer gift cards?",
          icon: "fa-gift",
          answer: "Gift cards are not available at this time, but this feature may be added in the future — stay tuned!",
          list: null
        },
        {
          question: "Can I use my portrait for commercial purposes?",
          icon: "fa-briefcase",
          answer: "Personal use is fine. For commercial use, such as merchandise or branding, an additional charge applies. This option is available before checkout.",
          list: null
        },
        {
          question: "How can I contact you?",
          icon: "fa-envelope",
          answer: "You can reach us at support@purrfectpal.studio — we’re happy to answer any questions about your custom pet + owner portrait!",
          list: null
        }
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