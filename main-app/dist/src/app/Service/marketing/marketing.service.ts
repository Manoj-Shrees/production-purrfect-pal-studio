import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MarketingService {
  private baseMarketingUrl = baseurl + '/marketing';

  constructor(private http: HttpClient) {}

  getBanners(): Observable<any> {
    return this.http.get(`${this.baseMarketingUrl}/banners`, { headers });
  }

  getLeadWidget(): Observable<any> {
    return this.http.get(`${this.baseMarketingUrl}/lead-widget`, { headers });
  }

  submitLead(email: string, name?: string): Observable<any> {
    return this.http.post(`${this.baseMarketingUrl}/lead-capture`, { email, name }, { headers });
  }

  trackLeadImpression(): Observable<any> {
    return this.http.post(`${this.baseMarketingUrl}/lead-widget/impression`, {}, { headers });
  }

  getSpotlights(): Observable<any> {
    return this.http.get(`${this.baseMarketingUrl}/spotlights`, { headers });
  }

  trackSpotlightClick(id: string): Observable<any> {
    return this.http.post(`${this.baseMarketingUrl}/spotlights/${id}/click`, {}, { headers });
  }

  getSEOMetadata(): Observable<any> {
    return this.http.get(`${this.baseMarketingUrl}/seo`, { headers });
  }
}
