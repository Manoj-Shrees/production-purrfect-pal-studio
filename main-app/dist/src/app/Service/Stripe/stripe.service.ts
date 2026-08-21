import { Injectable } from '@angular/core';
import { Stripe, StripeElements, loadStripe } from '@stripe/stripe-js';
import { hosturl, headers, stripeApiKey  } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';


@Injectable({ providedIn: 'root' })
export class StripeService {

  url = hosturl;

  private stripe!: Stripe;
  private elements!: StripeElements;
  private tempOrderKey: string | null = null; // Store the temporary order key for cleanup
  


  constructor(private http: HttpClient){ }
  

  confirmPaymentstatus(key: any){ 
    const options = { headers: headers }; 
    const body = { payment_intent: key }; 
    return this.http.post(this.url+"/payment-status", body, options); 
  }

  async completeFreeOrder(payload: any) {
    const res = await fetch(`${this.url}/create-free-order`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Free order processing failed');
    return await res.json();
  }

 async initStripe(amount: number, metadata: any) {
  this.stripe = await loadStripe(stripeApiKey) as Stripe;
  if (!this.stripe) throw new Error('Stripe failed to load');

  const res = await fetch(`${this.url}/create-payment-intent`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(metadata)
  });

  if (!res.ok) throw new Error('PaymentIntent API failed');
  
  const { clientSecret, orderKey } = await res.json(); // <-- backend now returns orderKey

  this.tempOrderKey = orderKey; // store locally in the service for cleanup

  this.elements = this.stripe.elements({ clientSecret });

  return { clientSecret, tempOrderKey: orderKey };
}

  mountPaymentElement(
    selector: string,
    onCompleteChange: (isComplete: boolean) => void,
    onCancel: () => void
  ) {
    const paymentElement = this.elements.create('payment', { layout: 'accordion' });
    let wasComplete = false;

    paymentElement.on('change', (event) => {
      const isComplete = event.complete === true;
      onCompleteChange(isComplete);

      if (wasComplete && !isComplete) onCancel();
      wasComplete = isComplete;
    });

    paymentElement.mount(selector);
  }

  mountExpressCheckout(
    selector: string, 
    returnUrl: string,
    onCancel: () => void,
    onProcessing: () => void
  ) {
    if (!this.elements || !this.stripe) {
      throw new Error('Stripe not initialized');
    }

const express = (this.elements as any).create('expressCheckout', {
  // Button type (what text shows on the button)
  buttonType: {
    googlePay: 'buy',      // 'buy' | 'book' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe'
    applePay: 'buy'        // 'buy' | 'book' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe' | 'add-money' | 'contribute' | 'reload' | 'rent' | 'support' | 'tip' | 'top-up'
  },

  // Button theme/color
  buttonTheme: {
    googlePay: 'black',    // 'black' | 'white'
    applePay: 'black'      // 'black' | 'white' | 'white-outline'
  },

  // Button height in pixels (40-55)
  buttonHeight: 48,        // Default is 40

  // Payment method order preference
  paymentMethodOrder: ['google_pay', 'apple_pay', 'link'],

  // Wallet options
  wallets: {
    applePay: 'auto',      // 'auto' | 'never' (show/hide Apple Pay)
    googlePay: 'auto'      // 'auto' | 'never' (show/hide Google Pay)
  }
});

    // 🚨 CRITICAL: This is required for payment to work
    express.on('confirm', async (event: any) => {
      // Notify component that payment is processing
      onProcessing();
      
      try {
        // This actually processes the payment
        const result = await this.stripe.confirmPayment({
          elements: this.elements,
          confirmParams: {
            return_url: returnUrl
          }
        });

        if (result.error) {
          console.error('Express checkout payment error:', result.error);
          event.complete('fail'); // Tell the wallet payment failed
          onCancel();
        } else {
          // Payment succeeded - mark before Stripe redirects
          event.complete('success'); // Tell the wallet payment succeeded
          // Guarantee navigation if Stripe does not automatically trigger redirect
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.href.indexOf('/OrderComplete') === -1) {
              const piId = (result as any)?.paymentIntent?.id;
              const targetUrl = piId && returnUrl.indexOf('payment_intent=') === -1
                ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment_intent=${encodeURIComponent(piId)}`
                : returnUrl;
              window.location.href = targetUrl;
            }
          }, 300);
        }

      } catch (err) {
        console.error('Express checkout exception:', err);
        event.complete('fail');
        onCancel();
      }
    });

    // User closed the wallet without paying
    express.on('cancel', onCancel);

    // Hide button if Google/Apple Pay not available
    express.on('ready', (e: any) => {
      if (!e.availablePaymentMethods) {
        document.querySelector(selector)?.remove();
      }
    });

    express.mount(selector);
  }


  async confirmPayment(returnUrl: string) {
    return await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: returnUrl }
    });
  }


async cancelTempOrder(tempOrderKey: string) {
  console.log('🧹 Cancel temp order:', tempOrderKey);
  return fetch(`${hosturl}/api/deletetemporder`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ orderKey: tempOrderKey }) // send tempOrderKey
  });
}


}

