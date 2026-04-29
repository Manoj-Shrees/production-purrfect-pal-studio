import { animate, style, transition, trigger } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { LoaderService } from './Service/Loader/loader.service';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { AuthService } from './Service/Auth/auth.service';
import { WebPushService } from './Service/webpush/web.push.service';
import { LoggingService } from './Service/Logs/logging.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class AppComponent implements OnInit {
  title = 'artist-panel';

  constructor(
    private router:         Router,
    public  loaderService:  LoaderService,
    private authService:    AuthService,
    private webPushService: WebPushService,
    private logger:         LoggingService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loaderService.show();
      } else if (
        event instanceof NavigationEnd   ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loaderService.hide();
      }
    });
  }

  ngOnInit(): void {
    this.authService.checkAuth().subscribe(response => {
      if (response?.isAuthenticated) {
        this.webPushService.init()
          .catch(err => this.logger.warn('[WebPush] init error:', err));
      }
    });
  }
}