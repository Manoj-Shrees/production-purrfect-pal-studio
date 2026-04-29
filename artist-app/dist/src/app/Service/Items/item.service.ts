import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { baseurl, headers, fileheaders, hosturl } from '../servicebasemodel';

@Injectable({
  providedIn: 'root',
})
export class ItemService {
  private url       = baseurl + '/Items';
  private uploadUrl = hosturl + '/upload/items';

  constructor(private http: HttpClient) {}

  // ─── READ ─────────────────────────────────────────────────────────────────

  // Admin / internal — returns ALL items regardless of approval status.
  // Do NOT use this on public-facing product pages.
  getitemdata(): Observable<any> {
    return this.http
      .get(this.url, { headers })
      .pipe(catchError((err) => of(err)));
  }

  // Public website — returns only approved items.
  // Use this wherever the product catalog is displayed to customers.
  getapproveditems(): Observable<any> {
    return this.http
      .get(this.url + '/approved', { headers })
      .pipe(catchError((err) => of(err)));
  }

  // Artist / admin dashboard — returns items awaiting customer review.
  getpendingitems(): Observable<any> {
    return this.http
      .get(this.url + '/pending', { headers })
      .pipe(catchError((err) => of(err)));
  }

  // Single item by id (any status — used internally).
  getitembyid(id: number | string): Observable<any> {
    return this.http
      .get(`${this.url}/${id}`, { headers })
      .pipe(catchError((err) => of(err)));
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  // Creates a catalog record with status = 'pending_approval' (DB default).
  // The item is hidden from the public website until approveitem() is called.
  uploadandcreate(items: any): Observable<any> {
    return this.http
      .post(this.url + '/create', items, { headers })
      .pipe(catchError((err) => of(err)));
  }

  // ─── APPROVAL ACTIONS ─────────────────────────────────────────────────────

  // Called from the customer order detail page when they accept the artwork.
  // Sets Items.status = 'approved' → item becomes visible on the website.
  approveitem(itemId: number | string): Observable<any> {
    return this.http
      .put(`${this.url}/${itemId}/approve`, {}, { headers })
      .pipe(catchError((err) => of(err)));
  }

  // Called from the customer order detail page when they reject the artwork.
  // Sets Items.status = 'rejected' → item stays hidden; artist can re-upload.
  rejectitem(itemId: number | string): Observable<any> {
    return this.http
      .put(`${this.url}/${itemId}/reject`, {}, { headers })
      .pipe(catchError((err) => of(err)));
  }

  // ─── FILE UPLOAD ──────────────────────────────────────────────────────────

  // Uploads display + download files to the proxy.
  // The proxy route expects multipart/form-data with:
  //   'username'  — identifier scoping the upload folder
  //   'display'   — image shown to the customer (proxy compresses to PNG)
  //   'download'  — full-res deliverable file (stored as-is)
  //
  // Response shape: { message, files: [displayRelPath, downloadRelPath], failedFiles: [] }
  uploadItemFiles(files: File[], username: string): Observable<{
    message: string;
    files: [string | null, string | null];
    failedFiles: any[];
  }> {
    const formData = new FormData();
    formData.append('username', username);

    const fieldNames = ['display', 'download'];
    files.forEach((file, index) =>
      formData.append(fieldNames[index] ?? 'display', file, file.name)
    );

    return this.http
      .post<any>(this.uploadUrl, formData, { headers: fileheaders })
      .pipe(
        catchError((err) =>
          of({
            message:     err.message,
            files:       [null, null] as [string | null, string | null],
            failedFiles: [],
          })
        )
      );
  }
}