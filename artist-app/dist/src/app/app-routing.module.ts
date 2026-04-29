import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OngoingOrdersComponent } from './ongoing-orders/ongoing-orders.component';
import { PastOrdersComponent } from './past-orders/past-orders.component';
import { ArtistProfileComponent } from './artist-profile/artist-profile.component';
import { JobsComponent } from './jobs/jobs.component';
import { DetailspageComponent } from './detailspage/detailspage.component';
import { SignupComponent } from './signup/signup.component';
import { LoginComponent } from './login/login.component';
import { customRouteGuard } from './Service/Guard/custom-route.guard';
import { authGuard } from './Service/Guard/auth.guard';
import { OrderTutorialComponent } from './order-tutorial/order-tutorial.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ForgotPasswordResetComponent } from './forgot-password-reset/forgot-password-reset.component';
import {ForgotPasswordTimerComponent} from './forgot-password-timer/forgot-password-timer.component';

const routes: Routes = [

    {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'past-orders',
    component: PastOrdersComponent,
    canActivate: [customRouteGuard]
  },
  {
    path: 'artist-profile',
    component: ArtistProfileComponent,
    canActivate: [authGuard]
  },
  {
    path: 'ongoing-orders',
    component: OngoingOrdersComponent,
   canActivate: [authGuard, customRouteGuard]
  },
  {
    path: 'jobs',
    component: JobsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'detail-page',
    component: DetailspageComponent,
    canActivate: [customRouteGuard]
  }
  , {
    path: 'signup',
    component: SignupComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [customRouteGuard]
  },

  {
    path: 'ForgotPasswordemailsend',
    component: ForgotPasswordTimerComponent,
    canActivate: [customRouteGuard]
  },
  {
    path: 'reset-password',
    component: ForgotPasswordResetComponent,
    canActivate: [customRouteGuard]
  },
  {
    path: 'order-tutorial',
    component: OrderTutorialComponent,
    canActivate: [customRouteGuard]
  },
  {
    path: '**',
    redirectTo: 'login'
  },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
