import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AuthInterceptor } from './auth.interceptor';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { HomeComponent } from './home/home.component';
import { MycartComponent } from './mycart/mycart.component';
import { ShopComponent } from './shop/shop.component';
import { OrderTrackingComponent } from './order-tracking/order-tracking.component';
import { ProductPageComponent } from './product-page/product-page.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { CommonModule } from '@angular/common';
import {MatGridListModule} from '@angular/material/grid-list';
import { FaqPageComponent } from './faq-page/faq-page.component';
import { PaymentComponent } from './payment/payment.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { OrdercompleteComponent } from './ordercomplete/ordercomplete.component';
import { OrderPageComponent } from './order-page/order-page.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ForgotPasswordTimerComponent } from './forgot-password-timer/forgot-password-timer.component';
import { ForgotPasswordResetComponent } from './forgot-password-reset/forgot-password-reset.component';
import { AccountVerifiedComponent } from './account-verified/account-verified.component';
import { DisablerightclickDirective } from './Directives/disablerightclick.directive';
import { DatePipe } from '@angular/common';
import {provideNativeDateAdapter} from '@angular/material/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import { ProfileComponent } from './profile/profile.component';
import { UpdateprofiledetailComponent } from './updateprofiledetail/updateprofiledetail.component';
import { LoaderComponent } from './loader/loader.component';
import { ShowcaseGalleryComponent } from './showcase-gallery/showcase-gallery.component';
import { ArtSharpnessDemoComponent } from './art-sharpness-demo/art-sharpness-demo.component';
import { CommingsoonComponent } from './commingsoon/commingsoon.component';
import { CustomerreviewComponent } from './customerreview/customerreview.component';
import { LoginSucessModalComponent } from './login-sucess-modal/login-sucess-modal.component';
import { ReactiveFormsModule } from '@angular/forms';
import { AccountVerificationComponent } from './account-verification/account-verification.component';
import { ProcessLoadingComponent } from './process-loading/process-loading.component';
import { ImageCropperComponent } from './image-cropper/image-cropper.component';
import { ToastComponent } from './shared/toast/toast.component';
import { RatingbarComponent } from './shared/ratingbar/ratingbar.component';
import { PrintOnDemandComponent } from './print-on-demand/print-on-demand.component';
import { PrintOnDemandCheckoutComponent } from './print-on-demand-checkout/print-on-demand-checkout.component';
import { PromoBannerComponent } from './shared/promo-banner/promo-banner.component';
import { LeadCaptureWidgetComponent } from './shared/lead-capture-widget/lead-capture-widget.component';
import { AboutUsComponent } from './about-us/about-us.component';


@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
    HomeComponent,
    MycartComponent,
    ShopComponent,
    OrderTrackingComponent,
    ProductPageComponent,
    FaqPageComponent,
    PaymentComponent,
    PrivacyPolicyComponent,
    OrdercompleteComponent,
    OrderPageComponent,
    ForgotPasswordComponent,
    ForgotPasswordTimerComponent,
    ForgotPasswordResetComponent,
    AccountVerifiedComponent,
    DisablerightclickDirective,
    ProfileComponent,
    UpdateprofiledetailComponent,
    LoaderComponent,
    ShowcaseGalleryComponent,
    ArtSharpnessDemoComponent,
    CommingsoonComponent,
    CustomerreviewComponent,
    LoginSucessModalComponent,
    AccountVerificationComponent,
    ProcessLoadingComponent,
    ImageCropperComponent,
    ToastComponent,
    RatingbarComponent,
    PrintOnDemandComponent,
    PrintOnDemandCheckoutComponent,
    PromoBannerComponent,
    LeadCaptureWidgetComponent,
    AboutUsComponent,

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MatGridListModule,
    CommonModule,
    HttpClientModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  providers: [
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    // ✅ FIX: AuthInterceptor must be registered via HTTP_INTERCEPTORS token
    // (with multi:true) for Angular's HttpClient to actually invoke it.
    // Previously it was listed as a plain provider, so withCredentials was
    // never added to any request and session cookies were never sent → 401.
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    DatePipe,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
