


export const hosturl = "https://www.purrfectpal.studio";

export const baseurl = "https://www.purrfectpal.studio/api";

export const uploadbaseurl = "https://www.purrfectpal.studio/upload";

export const uploadpremadebaseurl = "https://www.purrfectpal.studio/items/upload";

export const basefileurl = "https://www.purrfectpal.studio/uploadedfiles/Images/";


export interface OrderResponse {
  Order: OrderItem[];
  // any other fields you get from the API
}
// servicebasemodel.ts

// ─── Pet image URLs embedded inside each order item ───────────────────────────
export interface ItemUrls {
  petimg1:            string | null;
  petimg2:            string | null;
  petimg3:            string | null;
  petimg4:            string | null;
  custombackgroundimg: string | null;
}

// ─── Each item inside an order ────────────────────────────────────────────────
export interface itemsdata {
  name:                        string;
  urls:                        ItemUrls;   // ✅ pet images live HERE, inside each item
  price:                       number;
  petname:                     string;     // ✅ was wrongly typed as number — it's a string ("Rob")
  user_ID:                     number;     // ✅ new field present in real data
  art_style:                   string;
  pet_quantity:                number;
  additional_fee:              number;
  background_style:            string;
  artist_additional_notes:     string;
  background_additional_notes: string;
}

// ─── Uploaded output file (only present after artist completes the order) ─────
export interface itemsurldata {
  img_url:  string;
  file_url: string;   // ✅ fixed typo: was "file_ur" in previous interface
}

// ─── Top-level order ──────────────────────────────────────────────────────────
export interface OrderItem {
  ID:             number;
  Order_ID:       string;
  items:          itemsdata[];
  start_date:     string | null;   // ✅ ISO string from JSON, not Date object
  end_date:       string | null;   // ✅ nullable — pending orders have no end date
  User_ID:        number;
  item_urls:      itemsurldata[] | null;  // ✅ nullable — null until artist uploads
  Artist_ID:      number;
  Status:         string;          // "pending" | "active" | "completed"
  payment_intent: string | null;   // ✅ new field — null until payment processed
}

// ─── API response wrapper ─────────────────────────────────────────────────────
export interface OrdersResponse {
  Order: OrderItem[];   // ✅ key is "Order" (singular), not "Orders"
}

export const headers = {
        'Content-Type': 'application/json',
        'X-Proxy-Key': 'PurrfectPalStudio2024$%^'
      }

export const fileheaders = {
  'X-Proxy-Key': 'PurrfectPalStudio2024$%^'
}

