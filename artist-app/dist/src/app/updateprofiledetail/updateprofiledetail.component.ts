import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DatePipe } from '@angular/common';

import { InfoService } from '../Service/ArtistProfile/info.service';
import { RouteAccessService } from '../Service/Auth/route-access.service';
import { ProfilerefreshService } from '../Service/ProfileRefresh/profilerefresh.service';

const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 100;
const ARTIST_ID = 1; // TODO: replace with dynamic user ID from auth service

@Component({
  selector: 'app-updateprofiledetail',
  standalone: false,
  templateUrl: './updateprofiledetail.component.html',
  styleUrl: './updateprofiledetail.component.css',
})
export class UpdateprofiledetailComponent implements OnInit {

  @ViewChild('close_button') private closeButton!: ElementRef;

  // ── Form fields ────────────────────────────────────────────────────────────
  name: string = '';
  phone!: number;
  dob: Date = new Date();
  location: string = '';
  skill: any;
  artStyle: string = '';
  bio: string = '';

  // ── State ──────────────────────────────────────────────────────────────────
  artistdata: any;
  isLoading: boolean = false;
  isskillselected: boolean = false;
  loginError: string = '';

  // ── Date picker bounds ─────────────────────────────────────────────────────
  maxDate: Date;
  minDate: Date;

  constructor(
    private artistDetailService: InfoService,
    private accessService: RouteAccessService,
    private refreshService: ProfilerefreshService,
    private datePipe: DatePipe,
    private router: Router,
  ) {
    const today = new Date();
    this.maxDate = this.yearsAgo(today, MIN_AGE_YEARS);
    this.minDate = this.yearsAgo(today, MAX_AGE_YEARS);
  }

  ngOnInit(): void {
    this.loadArtistData();
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  loadArtistData(): void {
    this.artistDetailService.getinfo(ARTIST_ID).subscribe((response) => {
      const profile = response.Artist_Profile[0];
      this.artistdata = profile;

      this.name     = profile.Name;
      this.phone    = profile.phone;
      this.dob      = new Date(profile.dob);
      this.location = profile.location;
      this.bio      = profile.bio;
      this.artStyle = profile.art_style;
      this.skill    = profile.skill;
    });
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  onupdate(form: NgForm): void {
    if (form.invalid) {
      this.loginError = 'Please fill in all required fields.';
      Object.values(form.controls).forEach(control => control.markAsTouched());
      this.scrollToFirstInvalid();
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    const payload = {
      name:          this.name,
      phone:         this.phone,
      date_of_birth: this.formatDate(this.dob),
      skill:         this.skill,
      location:      this.location,
      art_style:     this.artStyle,
      bio:           this.bio,
    };

    this.artistDetailService.update(ARTIST_ID, payload)
      .pipe(
        catchError((error) => {
          this.loginError = 'Update failed. Please try again.';
          this.isLoading = false;
          return of(null);
        }),
      )
      .subscribe((response) => {
        if (response) {
          setTimeout(() => {
            this.refreshService.requestRefresh();
            this.closeModal();
          }, 1000);
        } else {
          this.isLoading = false;
        }
      });
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  closeModal(): void {
    this.closeButton.nativeElement.click();
    this.reloadCurrentRoute();
  }

  private reloadCurrentRoute(): void {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private scrollToFirstInvalid(): void {
    const selector = 'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, mat-form-field .ng-invalid';
    const firstInvalid = document.querySelector<HTMLElement>(selector);
    if (firstInvalid) {
      setTimeout(() => {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }, 100);
    }
  }

  private formatDate(date: Date): string {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? '';
  }

  private yearsAgo(from: Date, years: number): Date {
    return new Date(from.getFullYear() - years, from.getMonth(), from.getDate());
  }
}