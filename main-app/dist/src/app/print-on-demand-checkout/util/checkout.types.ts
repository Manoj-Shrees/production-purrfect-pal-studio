export interface CheckoutForm {
  // Contact
  email: string;
  phone: string;
  // Shipping
  firstName: string;
  lastName:  string;
  address:   string;
  apartment: string;
  city:      string;
  state:     string;
  postcode:  string;
  country:   string;
  // Delivery
  delivery: 'standard' | 'express';
}

export interface OrderItem {
  label:    string;   // e.g. "30 × 40 cm Canvas"
  qty:      number;
  price:    number;
  imageUrl: string | null;
}

// util/checkout.types.ts
// Single source of truth for all checkout-related types, constants and
// validation rules. Import from here — never duplicate inline.

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Delivery
// ─────────────────────────────────────────────────────────────────────────────

/** Union of every valid delivery option key. TypeScript catches typos. */
export type DeliveryValue = 'standard' | 'express';

export interface DeliveryOption {
  value: DeliveryValue;
  /** Short name shown in the delivery card heading. */
  label: string;
  /** Subtitle shown below the label (e.g. estimated timeframe). */
  sub:   string;
  /** Shipping cost in AUD. 0 = free. */
  price: number;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    value: 'standard',
    label: 'Standard Delivery',
    sub:   '5–10 business days',
    price: 0,
  },
  {
    value: 'express',
    label: 'Express Delivery',
    sub:   '2–3 business days',
    price: 14.99,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Countries
// ─────────────────────────────────────────────────────────────────────────────

/** Countries available for delivery. Currently Australia, New Zealand, and Singapore. */
export const COUNTRIES: readonly string[] = ['Australia', 'New Zealand', 'Singapore'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Item type
// ─────────────────────────────────────────────────────────────────────────────

export type PodItemType = 'Canvas';

/** Default item type sent to the backend when creating a POD order. */
export const DEFAULT_ITEM_TYPE: PodItemType = 'Canvas';

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Form model
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckoutForm {
  email:     string;
  phone:     string;
  firstName: string;
  lastName:  string;
  address:   string;
  /** Optional unit / apartment number. */
  apartment: string;
  city:      string;
  state:     string;
  postcode:  string;
  country:   string;
  /** Typed as DeliveryValue so invalid values are caught at compile time. */
  delivery:  DeliveryValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Order item (cart line)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderItem {
  /** Display name shown in the order summary. */
  label: string;
  /** Unit price in AUD. */
  price: number;
  /** Quantity. */
  qty:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Validation constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard RFC-5322-lite email pattern.
 * Matches: one-or-more non-whitespace/@ chars, @, domain, dot, TLD.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Australian postcodes are always exactly 4 digits.
 * Validate after stripping surrounding whitespace.
 */
export const AU_POSTCODE_REGEX = /^\d{4}$/;

/** Minimum number of digit characters in a phone number (after stripping non-digits). */
export const MIN_PHONE_DIGITS = 5;

/** Maximum number of digit characters in a phone number (E.164 limit). */
export const MAX_PHONE_DIGITS = 15;

/**
 * Maximum local digits retained for Australian numbers.
 * Australian mobile numbers are 9 local digits (04XX XXX XXX).
 */
export const AU_PHONE_LOCAL_MAX_DIGITS = 9;

/** Maximum allowed canvas image file size in bytes (10 MB). */
export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

/** MIME types accepted for the canvas image upload. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

export type AcceptedImageType = typeof ACCEPTED_IMAGE_TYPES[number];

/**
 * The accept attribute string for <input type="file">.
 * Derived from ACCEPTED_IMAGE_TYPES so they can never drift apart.
 */
export const ACCEPTED_IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when the email string passes basic format validation. */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Returns true when the local phone digits are within the allowed range. */
export function isValidPhoneDigits(localDigitsOnly: string): boolean {
  const digits = localDigitsOnly.replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/** Returns true when the postcode is a valid 4-digit Australian postcode. */
export function isValidAustralianPostcode(postcode: string): boolean {
  return AU_POSTCODE_REGEX.test(postcode.trim());
}

/** Returns true when the file is an accepted type and within the size limit. */
export function isValidImageFile(file: File): { valid: boolean; reason?: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) {
    return {
      valid:  false,
      reason: `Unsupported file type "${file.type}". Please use PNG, JPG or WEBP.`,
    };
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid:  false,
      reason: `File is ${mb} MB — maximum allowed size is 10 MB.`,
    };
  }
  return { valid: true };
}

/** Returns the shipping price for a given delivery value. */
export function getDeliveryPrice(deliveryValue: DeliveryValue): number {
  return DELIVERY_OPTIONS.find(o => o.value === deliveryValue)?.price ?? 0;
}

/** Returns the display label for a given delivery value. */
export function getDeliveryLabel(deliveryValue: DeliveryValue): string {
  return DELIVERY_OPTIONS.find(o => o.value === deliveryValue)?.label ?? deliveryValue;
}