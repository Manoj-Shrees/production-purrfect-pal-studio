import { Injectable }   from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CheckoutForm }   from '../../print-on-demand-checkout/util/checkout.types';
import { OrderItem }      from '../../print-on-demand-checkout/util/checkout.types';
import { PODService }     from '../PrintOnDemand/pod.service';

// ─── Stored shape ─────────────────────────────────────────────────────────────
export interface PodPendingSession {
  /** Server-side order ID. */
  podOrderId:    string;
  form:          CheckoutForm & { phone: string };
  items:         OrderItem[];
  total:         number;
  deliveryPrice: number;
  userId:        number;
  timestamp:     number;
  // ✅ NEW: absolute server URL of the uploaded image.
  //    Set during checkout (before payment) so the order is created with a
  //    real imageURL — never null in the DB after checkout completes.
  imageUrl:      string;
  // File metadata — kept so loadImageWithMeta() can restore the File blob
  // with the correct name/MIME type for the payment-page preview.
  fileName: string;
  fileSize: number;
  fileType: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_KEY = 'pod_pending_session';
const IDB_DB_NAME = 'PodSessionDB';
const IDB_DB_VER  = 1;
const IDB_STORE   = 'images';
const IDB_IMG_KEY = 'pending_image';

@Injectable({ providedIn: 'root' })
export class PodSessionService {

  constructor(private podService: PODService) {}

  // ── localStorage helpers (metadata) ───────────────────────────────────────

  saveMetadata(data: PodPendingSession): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[PodSession] localStorage write failed', e);
    }
  }

  loadMetadata(): PodPendingSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as PodPendingSession) : null;
    } catch {
      return null;
    }
  }

  hasPending(): boolean {
    try {
      return !!localStorage.getItem(SESSION_KEY);
    } catch {
      return false;
    }
  }

  // ── clearAll ──────────────────────────────────────────────────────────────
  //   clearAll()                        → wipes local data only
  //   clearAll({ deleteFromServer:true}) → also DELETEs the server record
  async clearAll(options?: { deleteFromServer?: boolean }): Promise<void> {
    const session = this.loadMetadata();

    if (options?.deleteFromServer && session?.podOrderId) {
      try {
        await firstValueFrom(this.podService.deletePodOrder(session.podOrderId));
        console.log(`[PodSession] Server order ${session.podOrderId} deleted.`);
      } catch (err) {
        console.warn(`[PodSession] Failed to delete server order ${session.podOrderId}:`, err);
      }
    }

    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    await this.clearImage();
  }

  // ── IndexedDB helpers (image blob) ────────────────────────────────────────
  // The blob is stored in IDB purely for the preview on the payment page.
  // The real source of truth for the image is imageUrl in session metadata.

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VER);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async saveImage(file: File): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req   = store.put(file, IDB_IMG_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async loadImage(fileName?: string): Promise<File | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req   = store.get(IDB_IMG_KEY);
        req.onsuccess = () => {
          db.close();
          const result = req.result;
          if (!result)                { resolve(null);   return; }
          if (result instanceof File) { resolve(result); return; }
          if (result instanceof Blob) {
            resolve(new File([result], fileName ?? 'restored_image', { type: result.type }));
            return;
          }
          resolve(null);
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch (e) {
      console.warn('[PodSession] IndexedDB read failed', e);
      return null;
    }
  }

  /** Loads the image blob with the original filename from session metadata. */
  async loadImageWithMeta(): Promise<File | null> {
    const session = this.loadMetadata();
    return this.loadImage(session?.fileName);
  }

  async clearImage(): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve) => {
        const tx    = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.delete(IDB_IMG_KEY);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror    = () => { db.close(); resolve(); };
      });
    } catch (e) {
      console.warn('[PodSession] IndexedDB clear failed', e);
    }
  }

  /** Save metadata (localStorage) + image blob (IndexedDB) in one call. */
  async saveAll(data: PodPendingSession, file: File): Promise<void> {
    await this.saveImage(file);
    this.saveMetadata(data);
  }
}