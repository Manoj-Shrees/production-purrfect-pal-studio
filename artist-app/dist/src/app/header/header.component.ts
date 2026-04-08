import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouteAccessService } from '../Service/Auth/route-access.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {

  menuOpen = false;

  constructor(private router: Router, private accessService: RouteAccessService) { }


  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }



  openroute(path: string) {

    this.accessService.allowNextAccess();

    this.router.navigate([path]);
  }

}
