import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService }   from '../Service/OrderPage/order.service';
import { PODService }     from '../Service/PrintOnDemand/pod.service';
import { StripeService }  from '../Service/Stripe/stripe.service';
import { ToastService }   from '../Service/common/toast.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector:    'app-ordercomplete',
  templateUrl: './ordercomplete.component.html',
  styleUrls:   ['./ordercomplete.component.css'],
  standalone:  false
})
export class OrdercompleteComponent implements OnInit {

  paymentIntentId = '';
  podOrderId      = '';
  orderSummary: any = null;

  /* ── UI state ── */
  isLoading        = signal(true);
  isPaymentSuccess = signal(false);
  isFailed         = signal(false);
  errorMessage     = signal('');

  /* ── Order type ── */
  orderType       = signal<'pod' | 'standard'>('standard');
  isPrintOnDemand = computed(() => this.orderType() === 'pod');

  constructor(
    private route:         ActivatedRoute,
    private router:        Router,
    private toast:         ToastService,
    private logging:       LoggingService,
    private orderService:  OrderService,
    private podService:    PODService,
    private stripeService: StripeService
  ) {}

  /* ════════════════════════════════════════════════
     LIFECYCLE
  ════════════════════════════════════════════════ */
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(async params => {
      this.paymentIntentId = params['payment_intent'] ?? '';
      this.podOrderId      = params['pod_order_id']   ?? '';

      this.orderType.set(params['type'] === 'pod' ? 'pod' : 'standard');

      console.log(`[OrderComplete] ngOnInit — params:`, {
        payment_intent: this.paymentIntentId,
        order_type:     this.orderType(),
        pod_order_id:   this.podOrderId,
        raw_params:     params,
      });

      this.logging.log('OrderComplete init', {
        payment_intent: this.paymentIntentId,
        order_type:     this.orderType(),
        pod_order_id:   this.podOrderId,
      });

      if (!this.paymentIntentId) {
        console.error(`[OrderComplete] ❌ No payment_intent in URL. Full params:`, params);
        this.fail('Missing payment reference. Please contact support.');
        return;
      }

      if (this.isPrintOnDemand() && !this.podOrderId) {
        console.error(`[OrderComplete] ❌ POD order but no pod_order_id. Full params:`, params);
        this.fail('Missing print-on-demand order reference. Please contact support.');
        return;
      }

      await this.processPaymentAndOrder();
    });
  }

  /* ════════════════════════════════════════════════
     MAIN FLOW
  ════════════════════════════════════════════════ */
  private async processPaymentAndOrder(): Promise<void> {
    this.isLoading.set(true);
    this.isFailed.set(false);
    this.isPaymentSuccess.set(false);
    this.errorMessage.set('');

    console.log(`[OrderComplete] processPaymentAndOrder START — pi=${this.paymentIntentId}`);

    try {
      let piStatus = '';
      let pi: any = null;
      if (this.paymentIntentId && (this.paymentIntentId.startsWith('pi_free_') || this.paymentIntentId === 'pi_free_promo_applied')) {
        console.log(`[OrderComplete] 100% Promo Code Free Order detected (${this.paymentIntentId}) — bypassing Stripe payment intent verification.`);
        piStatus = 'succeeded';
      } else {
        /* Step 1 — verify payment intent with Stripe */
        console.log(`[OrderComplete] Step 1: Verifying PaymentIntent with Stripe...`);
        pi = await firstValueFrom(
          this.stripeService.confirmPaymentstatus(this.paymentIntentId)
        );

        console.log(`[OrderComplete] Stripe /payment-status raw response:`, pi);

        piStatus =
          typeof pi?.status === 'string'       ? pi.status       :
          typeof pi?.data?.status === 'string' ? pi.data.status  :
          '';
      }

      console.log(`[OrderComplete] Resolved PI status: "${piStatus}"`);

      if (piStatus !== 'succeeded') {
        console.warn(
          `[OrderComplete] ❌ Payment not succeeded. piStatus="${piStatus}" | ` +
          `full response:`, pi
        );
        this.fail(
          piStatus === 'canceled'
            ? 'Your payment was cancelled. No charge was made.'
            : 'Payment was not completed successfully. Please try again.'
        );
        return;
      }

      console.log(`[OrderComplete] ✅ Payment verified as succeeded`);

      /* Step 2 — process the appropriate order type */
      if (this.isPrintOnDemand()) {
        console.log(`[OrderComplete] Step 2: Processing POD order — pod_order_id=${this.podOrderId}`);
        await this.processPodOrder();
      } else {
        console.log(`[OrderComplete] Step 2: Processing standard order — pi=${this.paymentIntentId}`);
        await this.processStandardOrder();
      }

    } catch (err: any) {
      console.error(`[OrderComplete] 🔥 Unexpected error in processPaymentAndOrder:`, err);
      console.error(`[OrderComplete] Error status: ${err?.status} | message: ${err?.message}`);
      console.error(`[OrderComplete] Error body:`, err?.error);

      this.logging.error('OrderComplete unexpected error', err);

      const message: string =
        err?.status === 0
          ? 'Network error — please check your connection and contact support.'
          : err?.error?.message ?? err?.message ?? 'An unexpected error occurred.';

      this.fail(message);

    } finally {
      this.isLoading.set(false);
    }
  }

  /* ════════════════════════════════════════════════
     POD ORDER
  ════════════════════════════════════════════════ */
  private async processPodOrder(): Promise<void> {
    let currentOrder: any = null;

    try {
      console.log(`[OrderComplete][POD] Fetching POD order ${this.podOrderId}...`);
      const res  = await firstValueFrom(this.podService.getPodOrder(this.podOrderId));
      currentOrder = res?.data ?? null;
      console.log(`[OrderComplete][POD] Fetched order status: "${currentOrder?.status}"`);
    } catch (fetchErr: any) {
      console.error(`[OrderComplete][POD] ❌ getPodOrder failed — status=${fetchErr?.status}:`, fetchErr);
      if (fetchErr?.status === 404) {
        this.fail('Print-on-demand order not found. Please contact support with your payment reference.');
        return;
      }
      throw fetchErr;
    }

    if (!currentOrder) {
      console.error(`[OrderComplete][POD] ❌ getPodOrder returned null/empty data`);
      this.fail('Could not load your order. Please contact support.');
      return;
    }

    if (currentOrder.status !== 'Pending') {
      console.log(`[OrderComplete][POD] Order already at "${currentOrder.status}" — webhook handled it`);
      this.orderSummary = currentOrder;
      this.succeed('Print-on-demand order confirmed!');
      return;
    }

    console.log(`[OrderComplete][POD] Order still Pending — advancing via frontend`);

    let podRes: any;
    try {
      podRes = await firstValueFrom(this.podService.confirmPodOrder(this.podOrderId));
      console.log(`[OrderComplete][POD] confirmPodOrder response:`, podRes);
    } catch (advanceErr: any) {
      console.error(`[OrderComplete][POD] ❌ confirmPodOrder failed — status=${advanceErr?.status}:`, advanceErr);
      if (advanceErr?.status === 404) {
        console.warn(`[OrderComplete][POD] Advance returned 404 — treating as success (webhook may have handled it)`);
        this.orderSummary = currentOrder;
        this.succeed('Print-on-demand order confirmed!');
        return;
      }
      throw advanceErr;
    }

    const advancedOrder = podRes?.data;

    if (!advancedOrder) {
      console.error(`[OrderComplete][POD] ❌ confirmPodOrder returned no data. Full response:`, podRes);
      this.fail('Could not confirm your print-on-demand order. Please contact support with your payment reference.');
      return;
    }

    if (advancedOrder.status === 'Pending') {
      console.error(`[OrderComplete][POD] ❌ Status unchanged after advance. Order:`, advancedOrder);
      this.logging.error('[POD] Advance did not change status', advancedOrder);
      this.fail('Order status could not be updated. Please contact support.');
      return;
    }

    console.log(`[OrderComplete][POD] ✅ Order advanced to "${advancedOrder.status}"`);
    this.orderSummary = advancedOrder;
    this.succeed('Print-on-demand order confirmed!');
  }

  /* ════════════════════════════════════════════════
     STANDARD ORDER
  ════════════════════════════════════════════════ */
  private async processStandardOrder(): Promise<void> {
    let createRes: any;

    console.log(`[OrderComplete][Standard] Calling createOrder with pi=${this.paymentIntentId}`);

    try {
      createRes = await firstValueFrom(
        this.orderService.createOrder({ payment_intent: this.paymentIntentId })
      );
      console.log(`[OrderComplete][Standard] createOrder response:`, createRes);
    } catch (err: any) {
      const backendMsg: string = err?.error?.message ?? '';
      console.error(
        `[OrderComplete][Standard] ❌ createOrder HTTP error — ` +
        `status=${err?.status} | backendMsg="${backendMsg}"`,
        err?.error
      );

      if (backendMsg === 'Payment not completed') {
        this.fail('Payment was not completed. No order was created.');
        return;
      }

      if (backendMsg === 'Temp order not found') {
        console.warn(`[OrderComplete][Standard] Temp order missing — assuming webhook created the order`);
        this.orderSummary = { duplicate: true };
        this.succeed('Order placed successfully!');
        return;
      }

      if (err?.status === 403 || backendMsg === 'Order validation failed') {
        console.error(
          `[OrderComplete][Standard] ❌ 403 Order validation failed. ` +
          `This usually means the user_id in the temp order does not match ` +
          `the user_id in the Stripe PaymentIntent metadata. ` +
          `Check [createorderforuser] logs for the resolution breakdown.`
        );
        this.fail('We could not verify your order. Please contact support with your payment reference.');
        return;
      }

      throw err;
    }

    if (!createRes?.success) {
      console.error(
        `[OrderComplete][Standard] ❌ createOrder returned success=false. ` +
        `message="${createRes?.message}" | full response:`, createRes
      );
      this.fail(
        createRes?.message ?? 'Failed to create order. Please contact support with your payment reference.'
      );
      return;
    }

    console.log(
      `[OrderComplete][Standard] ✅ Order ${createRes.duplicate ? 'already existed (duplicate)' : 'created'}. ` +
      `Order_ID=${createRes.order?.Order_ID ?? 'n/a'}`
    );

    this.orderSummary = {
      isDuplicate:   !!createRes.duplicate,
      paymentIntent: this.paymentIntentId,
      rawOrder:      createRes.order ?? null,
    };

    this.succeed(
      createRes.duplicate ? 'Order already placed — you\'re all set!' : 'Order placed successfully!'
    );
  }

  /* ════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════ */

  private succeed(message: string): void {
    console.log(`[OrderComplete] ✅ succeed — "${message}"`);
    this.isPaymentSuccess.set(true);
    this.toast.showToast('success', 'Order', message);
  }

  private fail(message: string): void {
    console.error(`[OrderComplete] ❌ fail — "${message}"`);
    this.errorMessage.set(message);
    this.isFailed.set(true);
    this.isLoading.set(false);
    this.toast.showToast('error', 'Order', message);
  }

  shopMore(): void {
    this.router.navigate(['/ProductPage']);
  }

  viewOrders(): void {
    this.router.navigate(['/OrderPage']);
  }
}