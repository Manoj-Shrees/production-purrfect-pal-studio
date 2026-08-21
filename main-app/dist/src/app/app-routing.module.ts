import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ProductPageComponent } from './product-page/product-page.component';
import { MycartComponent } from './mycart/mycart.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { OrderTrackingComponent } from './order-tracking/order-tracking.component';
import { ShopComponent } from './shop/shop.component';
import { FaqPageComponent } from './faq-page/faq-page.component';
import { PaymentComponent } from './payment/payment.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { OrdercompleteComponent } from './ordercomplete/ordercomplete.component';
import { OrderPageComponent } from './order-page/order-page.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ForgotPasswordTimerComponent } from './forgot-password-timer/forgot-password-timer.component';
import { ForgotPasswordResetComponent } from './forgot-password-reset/forgot-password-reset.component';
import { AccountVerifiedComponent } from './account-verified/account-verified.component';
import { AuthGuard } from './Service/Guard/auth.guard';
import { customRouteGuardGuard } from './Service/Guard/custom-route-guard.guard';
import { ProfileComponent } from './profile/profile.component';
import { PendingPaymentGuard } from './Service/Guard/pending-payment.guard';
import { ResetPasswordGuard } from './Service/Guard/reset-password.guard';
import { AccountVerificationComponent } from './account-verification/account-verification.component';
import { PrintOnDemandComponent } from './print-on-demand/print-on-demand.component';
import { AboutUsComponent } from './about-us/about-us.component';


const routes: Routes = [
  {
    path: '',
    redirectTo: '/Home',
    pathMatch: 'full'
  },
  {
    path: 'Home',
    component: HomeComponent,
  },
  {
    path: 'AboutUs',
    component: AboutUsComponent,
  },
  {
    path: 'ProductPage',
    component: ProductPageComponent,
  },
  {
    path: 'Login',
    component: LoginComponent,
  },
  {
    path: 'Signup',
    component: SignupComponent,
  },
  {
    path: 'OrderTracking',
    component: OrderTrackingComponent,
    canActivate: [customRouteGuardGuard]
  },
  {
    path: 'Payment',
    component: PaymentComponent,
    canActivate: [customRouteGuardGuard],
    canDeactivate: [PendingPaymentGuard]
  },
  {
    path: 'Mycart',
    component: MycartComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'Shop',
    component: ShopComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'FaqPage',
    component: FaqPageComponent,
  },
  {
    path: 'PrivacyPolicy',
    component: PrivacyPolicyComponent
  },
  {
    path: 'OrderComplete',
    component: OrdercompleteComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'OrderPage',
    component: OrderPageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'Profile',
    component: ProfileComponent,

  },
    {
    path: 'printOnDemand',
    component: PrintOnDemandComponent,
  },
  {
    path: 'ForgotPassword',
    component: ForgotPasswordComponent,
    canActivate: [customRouteGuardGuard]
  },
  {
    path: 'ForgotPasswordemailsend',
    component: ForgotPasswordTimerComponent,
    canActivate: [customRouteGuardGuard]
  },
  {
    path:'ForgotPasswordReset',
    component: ForgotPasswordResetComponent,
    canActivate: [ResetPasswordGuard] // Uncomment if you have a guard for reset password
  },
   {
    path: 'Accountverification',
    component: AccountVerificationComponent,
   // canActivate: [ActivateGuard]
  },
  {
    path: 'AccountActivate',
    component: AccountVerifiedComponent,
   // canActivate: [ActivateGuard]
  },
  {
    path: '**',
    component: HomeComponent,
  },

];

const routerOptions: ExtraOptions = {
  scrollPositionRestoration: 'enabled', // <--- this is key
  anchorScrolling: 'enabled',           // optional: for anchor #id links
  onSameUrlNavigation: 'reload'         // Optional, triggers reload if navigating to the same URL
};

@NgModule({
  imports: [RouterModule.forRoot(routes, routerOptions)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
