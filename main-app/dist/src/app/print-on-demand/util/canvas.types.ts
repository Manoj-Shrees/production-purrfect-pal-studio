export interface CanvasSize {
  key:   string;
  wcm:   number;
  hcm:   number;
  label: string;
  sub:   string;
  price: number;
  group: 'Square' | 'Rectangle';
}

export type CartState = 'idle' | 'loading' | 'success';

export interface ImageTransform {
  scale:     number;
  x:         number;
  y:         number;
  /** Rotation in degrees (clockwise). Defaults to 0 if absent. */
  rotation?: number;
}

export const SIZES: CanvasSize[] = [
  // ── Square ──────────────────────────────────────────────────────────────
  { key: '20x20',   wcm: 20,  hcm: 20,  label: '20 × 20 cm',   sub: 'Small Square',   price: 43.45,  group: 'Square'    },
  { key: '30x30',   wcm: 30,  hcm: 30,  label: '30 × 30 cm',   sub: 'Medium Square',  price: 48.50,  group: 'Square'    },
  { key: '40x40',   wcm: 40,  hcm: 40,  label: '40 × 40 cm',   sub: 'Large Square',   price: 61.23,  group: 'Square'    },
  { key: '50x50',   wcm: 50,  hcm: 50,  label: '50 × 50 cm',   sub: 'XL Square',      price: 82.03,  group: 'Square'    },
  { key: '60x60',   wcm: 60,  hcm: 60,  label: '60 × 60 cm',   sub: 'XXL Square',     price: 94.14,  group: 'Square'    },
  { key: '75x75',   wcm: 75,  hcm: 75,  label: '75 × 75 cm',   sub: 'Grande Square',  price: 119.29, group: 'Square'    },
  { key: '90x90',   wcm: 90,  hcm: 90,  label: '90 × 90 cm',   sub: 'Gallery Square', price: 143.82, group: 'Square'    },
  { key: '100x100', wcm: 100, hcm: 100, label: '100 × 100 cm', sub: 'Museum Square',  price: 159.97, group: 'Square'    },
  { key: '125x125', wcm: 125, hcm: 125, label: '125 × 125 cm', sub: 'Studio Square',  price: 222.38, group: 'Square'    },

  // ── Rectangle ────────────────────────────────────────────────────────────
  { key: '30x20',  wcm: 30,  hcm: 20, label: '30 × 20 cm',  sub: 'Small',     price: 43.45,  group: 'Rectangle' },
  { key: '45x30',  wcm: 45,  hcm: 30, label: '45 × 30 cm',  sub: 'Medium',    price: 56.88,  group: 'Rectangle' },
  { key: '50x40',  wcm: 50,  hcm: 40, label: '50 × 40 cm',  sub: 'Standard',  price: 68.68,  group: 'Rectangle' },
  { key: '60x40',  wcm: 60,  hcm: 40, label: '60 × 40 cm',  sub: 'Large',     price: 82.03,  group: 'Rectangle' },
  { key: '75x50',  wcm: 75,  hcm: 50, label: '75 × 50 cm',  sub: 'XL',        price: 102.20, group: 'Rectangle' },
  { key: '90x60',  wcm: 90,  hcm: 60, label: '90 × 60 cm',  sub: 'XXL',       price: 123.03, group: 'Rectangle' },
  { key: '100x75', wcm: 100, hcm: 75, label: '100 × 75 cm', sub: 'Grande',    price: 143.82, group: 'Rectangle' },
  { key: '120x80', wcm: 120, hcm: 80, label: '120 × 80 cm', sub: 'Panoramic', price: 201.89, group: 'Rectangle' },
  { key: '135x90', wcm: 135, hcm: 90, label: '135 × 90 cm', sub: 'Gallery',   price: 207.79, group: 'Rectangle' },
];

export const GROUPS: CanvasSize['group'][] = ['Square', 'Rectangle'];

export const PX_PER_CM = 5.6;
export const MAX_W     = 480;
export const MAX_H     = 520;