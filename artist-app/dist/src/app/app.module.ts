import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { CommonModule, DatePipe } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
// Material
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
// Components
import { AppComponent } from './app.component';
import { ArtistProfileComponent } from './artist-profile/artist-profile.component';
import { OngoingOrdersComponent } from './ongoing-orders/ongoing-orders.component';
import { PastOrdersComponent } from './past-orders/past-orders.component';
import { JobsComponent } from './jobs/jobs.component';
import { SignupComponent } from './signup/signup.component';
import { DetailspageComponent } from './detailspage/detailspage.component';
import { LoginComponent } from './login/login.component';
import { HeaderComponent } from './header/header.component';
import { UpdateprofiledetailComponent } from './updateprofiledetail/updateprofiledetail.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ForgotPasswordResetComponent } from './forgot-password-reset/forgot-password-reset.component';
import { ForgotPasswordTimerComponent } from './forgot-password-timer/forgot-password-timer.component';
import { LoaderComponent } from './loader/loader.component';
import { OrderTutorialComponent } from './order-tutorial/order-tutorial.component';
import { ImageCropperComponent } from './image-cropper/image-cropper.component';
// Pipes / Standalone Components
import { TableFilterPipe } from './Service/Pipe/table-filter.pipe';
import { DropdownComponent } from './signup/skillSelector/dropdown/dropdown.component';

@NgModule({
  declarations: [
    AppComponent,
    ArtistProfileComponent,
    OngoingOrdersComponent,
    PastOrdersComponent,
    JobsComponent,
    SignupComponent,
    DetailspageComponent,
    LoginComponent,
    HeaderComponent,
    TableFilterPipe,
    UpdateprofiledetailComponent,
    ForgotPasswordComponent,
    ForgotPasswordResetComponent,
    ForgotPasswordTimerComponent,
    LoaderComponent,
    OrderTutorialComponent,
    ImageCropperComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule, // ✅ handles animations
    MatSelectModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    DropdownComponent,
  ],
  providers: [
    provideClientHydration(), // ✅ removed withEventReplay() — Safari-incompatible
    DatePipe,
    provideNativeDateAdapter(),
    provideHttpClient(withFetch()), // ✅ removed HttpClientModule — deprecated duplicate
    // ❌ removed provideAnimationsAsync() — conflicts with BrowserAnimationsModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}