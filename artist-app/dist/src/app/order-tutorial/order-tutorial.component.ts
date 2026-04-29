import { Component } from '@angular/core';

interface FAQItem {
  question: string;
  answer: string;
  isOpen: boolean;
  list?: string[];
  footer?: string;
}

@Component({
  selector: 'app-order-tutorial',
  standalone: false,
  templateUrl: './order-tutorial.component.html',
  styleUrl: './order-tutorial.component.css'
})
export class OrderTutorialComponent {

  faqOpen: boolean[] = [false, false, false, false, false];

  faqItems: FAQItem[] = [
    {
      question: "What if I don't want to accept a job assigned to me?",
      answer: "No problem! Simply inform our support team. It will be removed from your dashboard and reassigned to another artist with the same style.",
      isOpen: false
    },
    {
      question: "Can I work on more than one job at a time?",
      answer: "Yes — only if you can complete it on time without any issues.",
      isOpen: false
    },
    {
      question: "What if I need more information from the client?",
      answer: "Use the chat box available on the Detail Page to directly communicate with the client. Ask for clarification or reference photos if needed.",
      isOpen: false
    },
    {
      question: "What are the requirements for submitting final artwork?",
      answer: "You must upload:",
      list: [
        "A branding image (300x300px)",
        "A high-resolution downloadable file",
        "Pet name, breed, and design detail level"
      ],
      footer: "The submission form is on the Detail Page of the ongoing order.",
      isOpen: false
    },
    {
      question: "How do revisions work? How many are allowed?",
      answer: "Each client is allowed up to 4 revision requests. You'll be notified through chat when a revision is requested.",
      isOpen: false
    }
  ];

  toggleFaq(index: number): void {
    // Accordion: close all others, toggle the clicked one
    this.faqOpen = this.faqOpen.map((isOpen, i) =>
      i === index ? !isOpen : false
    );
  }
}