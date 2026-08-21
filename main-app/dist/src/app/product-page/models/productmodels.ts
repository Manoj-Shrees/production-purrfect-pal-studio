import { SafeUrl } from "@angular/platform-browser";

// ══════════════════════════════════════════════════════════
//  PRE-MADE BACKGROUNDS
//  Order: Dark / Premium first → Warm/Mid → Light/Pastel → Plain
// ══════════════════════════════════════════════════════════

export type BgTheme = 'dark' | 'mid' | 'light';
export type BgCategory = 'all' | 'fine-art' | 'studio-oils' | 'oil-pastels' | 'botanical-marble' | 'modern-gradients';

export interface BgCategoryOption {
    id:    BgCategory;
    label: string;
    icon:  string;
}

export const BG_CATEGORIES: BgCategoryOption[] = [
    { id: 'all',                label: 'All Themes',           icon: 'fa-th' },
    { id: 'fine-art',           label: 'Renaissance & Fine Art',icon: 'fa-landmark' },
    { id: 'studio-oils',        label: 'Studio & Oil Backdrops',icon: 'fa-palette' },
    { id: 'oil-pastels',        label: 'Oil Pastel Strokes',   icon: 'fa-paint-brush' },
    { id: 'botanical-marble',   label: 'Botanical & Marble',   icon: 'fa-leaf' },
    { id: 'modern-gradients',   label: 'Gradients & Velvet',   icon: 'fa-wand-magic-sparkles' },
];

export interface BgEntry {
    url:      string;      // image path OR CSS gradient string
    label:    string;      // display name shown on card
    tag:      string;      // short badge label (≤ 10 chars)
    category: BgCategory;  // category group
    theme:    BgTheme;     // used for colour-coded border/ring
}

export function getpreMadeBackground(): BgEntry[] {
    return [
        // ═════════════════════════════════════════════════════════════
        // 🏆 TOP 8 INITIAL SHOWCASE (User Selected Curated 8)
        // ═════════════════════════════════════════════════════════════
        { url: 'linear-gradient(135deg,#070b19 0%,#131b36 50%,#090d21 100%)',
          label: 'Midnight Atelier',   tag: '🌙 Midnight',    category: 'modern-gradients', theme: 'dark' },
        { url: 'assets/images/backgrounds/bgRoyalCelestial.png',
          label: 'Celestial Indigo',   tag: '✨ Celestial',   category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1c1c1e 0%,#2c2c2e 40%,#1a1a1c 80%,#111112 100%)',
          label: 'Charcoal',           tag: '◼ Charcoal',  category: 'studio-oils', theme: 'dark' },
        { url: 'assets/images/backgrounds/bgRoyalCosmic.png',
          label: 'Cosmic Nocturne',    tag: '🌌 Nocturne',    category: 'modern-gradients', theme: 'dark' },
        { url: 'assets/images/backgrounds/bgPastelWatercolor.png',
          label: 'Impressionist Wash', tag: '🌊 Impression',  category: 'oil-pastels', theme: 'light' },
        { url: 'linear-gradient(135deg,#0077b6 0%,#00b4d8 40%,#90e0ef 75%,#caf0f8 100%)',
          label: 'Cerulean Soft Pastel',tag: '🌊 Cerulean',  category: 'oil-pastels', theme: 'mid' },
        { url: 'assets/images/backgrounds/bgHome1.png',
          label: 'Parisian Atelier',   tag: '🎨 Atelier',     category: 'studio-oils', theme: 'dark' },
        { url: 'assets/images/backgrounds/bgHome2.png',
          label: 'Tuscan Studio',      tag: '🏺 Tuscan',      category: 'studio-oils', theme: 'mid' },
        { url: 'assets/images/backgrounds/bgFloralGold.png',
          label: 'Florentine Gold Leaf',tag: '✨ Gold Leaf',   category: 'fine-art', theme: 'mid' },
        { url: 'assets/images/backgrounds/bgGoldenSunset.png',
          label: 'Venetian Sunset',    tag: '🍷 Titian',      category: 'botanical-marble', theme: 'mid' },

        // ═════════════════════════════════════════════════════════════
        // 🎨 OIL PASTEL STROKES
        // ═════════════════════════════════════════════════════════════
        { url: 'linear-gradient(135deg,#e89b74 0%,#d9756c 30%,#b25372 65%,#7b3c68 100%)',
          label: 'Impasto Oil Pastel',  tag: '🖌 Impasto',   category: 'oil-pastels', theme: 'mid' },
        { url: 'radial-gradient(circle at 30% 30%,#fcd5ce 0%,#faac96 35%,#f28482 70%,#84a59d 100%)',
          label: 'Warm Sunset Pastel',  tag: '🌅 Pastel',    category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(145deg,#d4a373 0%,#e9edc9 40%,#ccd5ae 70%,#a3b18a 100%)',
          label: 'Smudged Ochre Pastel',tag: '🌾 Ochre',     category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#e0a96d 0%,#ddbea9 35%,#ffe8d6 70%,#cb997e 100%)',
          label: 'Dusty Rose Pastel',   tag: '🌸 Rose Oil',  category: 'oil-pastels', theme: 'light' },
        { url: 'linear-gradient(125deg,#a44a3f 0%,#f19c79 40%,#f6bd60 70%,#f7ade1 100%)',
          label: 'Sienna & Chalk',      tag: '🍂 Sienna',    category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#2b2d42 0%,#8d99ae 40%,#edf2f4 75%,#d8e2dc 100%)',
          label: 'Celestial Blue Pastel',tag: '💙 Blue Chalk',category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#84a59d 0%,#f5cad2 40%,#f6bd60 75%,#f7d6e0 100%)',
          label: 'Sage & Butter Pastel',tag: '🌿 Sage Pastel',category: 'oil-pastels', theme: 'light' },
        { url: 'linear-gradient(135deg,#4a3b32 0%,#8c6d58 40%,#c9a690 75%,#6b4e3d 100%)',
          label: 'Raw Earth Oil Chalk', tag: '🪨 Earth Chalk',category: 'oil-pastels', theme: 'dark' },
        { url: 'linear-gradient(135deg,#7209b7 0%,#a2d2ff 45%,#bde0fe 75%,#ffafcc 100%)',
          label: 'French Lavender Pastel',tag: '💜 Lavender',category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#ffb703 0%,#fb8500 40%,#d90429 80%,#6a040f 100%)',
          label: 'Amber Impasto Pastel',tag: '🔥 Amber Oil', category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#38b000 0%,#70e000 40%,#9ef01a 75%,#ccff33 100%)',
          label: 'Verdant Meadow Pastel',tag: '🍃 Meadow',   category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#e07a5f 0%,#f2cc8f 40%,#81b29a 80%,#3d405b 100%)',
          label: 'Boho Terracotta Pastel',tag: '🏺 Terracotta',category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#5f0f40 0%,#9a031e 40%,#fb8b24 80%,#e36414 100%)',
          label: 'Crimson Velvet Pastel',tag: '🍷 Crimson',  category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#ffcdb2 0%,#ffb4a2 35%,#e5989b 70%,#b5838d 100%)',
          label: 'Blush Camellia Pastel',tag: '🌸 Blush Chalk',category: 'oil-pastels', theme: 'light' },
        { url: 'linear-gradient(135deg,#264653 0%,#2a9d8f 40%,#e9c46a 75%,#f4a261 100%)',
          label: 'Palette Knife Pastel',tag: '🎨 Palette',   category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#457b9d 0%,#a8dadc 40%,#f1faee 75%,#e63946 100%)',
          label: 'Nordic Coast Pastel', tag: '❄ Nordic',    category: 'oil-pastels', theme: 'light' },
        { url: 'linear-gradient(135deg,#3d5a80 0%,#98c1d9 45%,#e0fbfc 75%,#ee6c4d 100%)',
          label: 'Cobalt Horizon Pastel',tag: '⚓ Cobalt',   category: 'oil-pastels', theme: 'mid' },
        { url: 'linear-gradient(135deg,#d8f3dc 0%,#b7e4c7 35%,#95d5b2 70%,#74c69d 100%)',
          label: 'Mint Tea Oil Pastel', tag: '🌿 Mint Pastel',category: 'oil-pastels', theme: 'light' },

        // ═════════════════════════════════════════════════════════════
        // 🏛️ RENAISSANCE & FINE ART
        // ═════════════════════════════════════════════════════════════
        { url: 'assets/images/backgrounds/bgHome3.png',
          label: 'Palazzo Mahogany',   tag: '🏛 Palazzo',     category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#0d0d0d 0%,#1f1f1f 40%,#080808 100%)',
          label: 'Chiaroscuro Dark',   tag: '✨ Masterpiece', category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#2a080c 0%,#54121a 50%,#1e0508 100%)',
          label: 'Florentine Crimson', tag: '🍷 Crimson',    category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1f1000 0%,#472703 50%,#1a0c00 100%)',
          label: 'Rembrandt Shadows',  tag: '🕯 Rembrandt',   category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#422408 0%,#7a4915 50%,#331b05 100%)',
          label: 'Titian Gold Wash',   tag: '🍷 Titian',      category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1a0926 0%,#391852 50%,#150620 100%)',
          label: 'Gothic Amethyst',    tag: '💎 Amethyst',   category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#36220f 0%,#664623 50%,#29190a 100%)',
          label: 'Museum Bronze',      tag: '🏺 Bronze',      category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#5e3d19 0%,#9c6a30 50%,#472d11 100%)',
          label: 'Renaissance Amber',  tag: '🍂 Amber Art',   category: 'fine-art', theme: 'mid' },
        { url: 'linear-gradient(135deg,#f7f7f5 0%,#e3e3df 50%,#efefeb 100%)',
          label: 'Alabaster Sculpture',tag: '🏛 Alabaster',   category: 'fine-art', theme: 'light' },
        { url: 'linear-gradient(135deg,#f2ebe4 0%,#dfd0c4 50%,#eae0d7 100%)',
          label: 'Gallery Stucco',     tag: '📜 Stucco',      category: 'fine-art', theme: 'light' },
        { url: 'linear-gradient(135deg,#4a0000 0%,#8b0000 50%,#2b0000 100%)',
          label: 'Imperial Ruby Oil',  tag: '👑 Ruby',        category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1c1917 0%,#44403c 45%,#1c1917 100%)',
          label: 'Medici Slate',       tag: '🏛 Medici',      category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#3f2305 0%,#78440c 50%,#2c1803 100%)',
          label: 'Uffizi Walnut',      tag: '🏛 Uffizi',      category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#451a03 0%,#78350f 50%,#290e02 100%)',
          label: 'Caravaggio Shadow', tag: '🕯 Caravaggio',  category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#0f172a 100%)',
          label: 'Byzantine Lapis',    tag: '💎 Lapis',       category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#064e3b 0%,#047857 50%,#022c22 100%)',
          label: 'Verona Malachite',   tag: '💚 Malachite',   category: 'fine-art', theme: 'dark' },
        { url: 'linear-gradient(135deg,#78350f 0%,#b45309 50%,#451a03 100%)',
          label: 'Venetian Bronze',    tag: '🏺 Bronze',      category: 'fine-art', theme: 'mid' },
        { url: 'linear-gradient(135deg,#701a75 0%,#a21caf 50%,#4a044e 100%)',
          label: 'Imperial Royal Violet',tag: '👑 Royal',    category: 'fine-art', theme: 'dark' },

        // ═════════════════════════════════════════════════════════════
        // 🖌️ STUDIO & OIL BACKDROPS
        // ═════════════════════════════════════════════════════════════
        { url: 'assets/images/backgrounds/bgHome4.png',
          label: 'Château Fresco',     tag: '📜 Fresco',      category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#2b1d0c 0%,#4e361c 50%,#23170a 100%)',
          label: 'Studio Sepia',       tag: '📜 Sepia',       category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#222c1b 0%,#435437 50%,#182113 100%)',
          label: 'Studio Olive Oil',   tag: '🌿 Olive Art',   category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#4e2318 0%,#874331 50%,#3d1a11 100%)',
          label: 'Terracotta Canvas',  tag: '🏺 Terracotta', category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#423519 0%,#7a6332 50%,#332912 100%)',
          label: 'Artisan Brass',      tag: '✦ Brass',        category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#401424 0%,#732844 50%,#300c1a 100%)',
          label: 'Gallery Rosewood',   tag: '🍷 Rosewood',    category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#633a17 0%,#a1632d 50%,#4a2a0e 100%)',
          label: 'Venetian Ochre',     tag: '🎨 Ochre',       category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#542913 0%,#8c4723 50%,#3b1b0b 100%)',
          label: 'Baroque Copper',     tag: '🔶 Copper',      category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#522116 0%,#8c3f2d 50%,#3d160e 100%)',
          label: 'Atelier Rust',       tag: '🎨 Rust',        category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#292524 0%,#57534e 50%,#1c1917 100%)',
          label: 'Charcoal Wash Studio',tag: '🎨 Charcoal',   category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#365314 0%,#4d7c0f 50%,#1a2e05 100%)',
          label: 'Forest Studio Wash', tag: '🌿 Forest Oil',  category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#831843 0%,#be185d 50%,#500724 100%)',
          label: 'Berry Studio Canvas',tag: '🌺 Berry Oil',   category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1e293b 0%,#475569 50%,#0f172a 100%)',
          label: 'Slate Grey Backing', tag: '🪨 Slate Oil',   category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#713f12 0%,#a16207 50%,#451a03 100%)',
          label: 'Warm Amber Oil',     tag: '🍂 Amber Oil',   category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#134e4a 0%,#0d9488 50%,#042f2e 100%)',
          label: 'Verdant Teal Canvas',tag: '🌌 Teal Oil',    category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#7c2d12 0%,#c2410c 50%,#431407 100%)',
          label: 'Burnt Sienna Canvas',tag: '🍂 Sienna Oil',  category: 'studio-oils', theme: 'mid' },
        { url: 'linear-gradient(135deg,#312e81 0%,#4338ca 50%,#1e1b4b 100%)',
          label: 'Midnight Blue Studio',tag: '💙 Indigo Oil',  category: 'studio-oils', theme: 'dark' },

        // ═════════════════════════════════════════════════════════════
        // 🌿 BOTANICAL, FLORAL & MARBLE
        // ═════════════════════════════════════════════════════════════
        { url: 'assets/images/backgrounds/bgEnchantedGarden.png',
          label: 'Monet Botanicals',   tag: '🍃 Botanica',    category: 'botanical-marble', theme: 'mid' },
        { url: 'assets/images/backgrounds/bgPink.png',
          label: 'Salon Rose Canvas',  tag: '🏛 Salon',       category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#0a2526 0%,#17484a 50%,#0a1d1e 100%)',
          label: 'Impressionist Teal', tag: '🌌 Teal Art',    category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#0d1b0a 0%,#1a3a14 40%,#0a2210 80%,#050a03 100%)',
          label: 'Dark Woodland',      tag: '🌲 Woodland',   category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#f5efdf 0%,#e3d5be 50%,#ece2cf 100%)',
          label: 'Tapestry Sand',      tag: '🌾 Tapestry',    category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#faebeb 0%,#e8d1d1 50%,#f5e4e4 100%)',
          label: 'Impressionist Blush',tag: '🌸 Blush Art',   category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#edf2eb 0%,#d3ded0 50%,#e4ebd0 100%)',
          label: 'Atelier Soft Sage',  tag: '🌿 Sage Art',    category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#14532d 0%,#16a34a 50%,#052e16 100%)',
          label: 'Imperial Emerald',   tag: '💚 Emerald',     category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#ecfdf5 0%,#a7f3d0 50%,#d1fae5 100%)',
          label: 'Jade Marble Wall',   tag: '🏛 Jade',        category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#fdf2f8 0%,#fbcfe8 50%,#fce7f3 100%)',
          label: 'Carrara Rose Marble',tag: '🏛 Carrara',     category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#065f46 0%,#10b981 50%,#022c22 100%)',
          label: 'Botanical Canopy',   tag: '🍃 Canopy',      category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#f0fdf4 0%,#bbf7d0 50%,#dcfce7 100%)',
          label: 'White Willow Fresco',tag: '🌿 Willow',      category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#3f6212 0%,#65a30d 50%,#1a2e05 100%)',
          label: 'Olive Grove Tapestry',tag: '🌿 Olive',      category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#fff7ed 0%,#ffedd5 50%,#fed7aa 100%)',
          label: 'Ivory Blossom',      tag: '🌸 Blossom',     category: 'botanical-marble', theme: 'light' },
        { url: 'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 50%,#172554 100%)',
          label: 'Sapphire Marble',    tag: '🏛 Sapphire',    category: 'botanical-marble', theme: 'dark' },
        { url: 'linear-gradient(135deg,#fcfaef 0%,#f4ebd0 50%,#ebe0be 100%)',
          label: 'Gold Vein Marble',   tag: '🏛 Gold Vein',   category: 'botanical-marble', theme: 'light' },

        // ═════════════════════════════════════════════════════════════
        // 🌌 MODERN GRADIENTS & VELVET (19 Entries)
        // ═════════════════════════════════════════════════════════════
        { url: 'assets/images/backgrounds/bgPurple.png',
          label: 'Galleria Velvet',    tag: '🎭 Velvet',      category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#121214 0%,#242428 50%,#18181a 100%)',
          label: 'Gallery Charcoal',   tag: '🎨 Charcoal',    category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#001529 0%,#003366 50%,#00224d 100%)',
          label: 'Deep Navy',          tag: '⚓ Navy',        category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#0a192f 0%,#1b3a60 50%,#0c213d 100%)',
          label: 'Vermeer Ultramarine',tag: '💙 Vermeer',     category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#0b2b26 0%,#164e43 50%,#051c18 100%)',
          label: 'Emerald Dream',      tag: '💚 Emerald',     category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 50%,#16213e 100%)',
          label: 'Onyx Noir',          tag: '◼ Noir',        category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(160deg,#1a0a2e 0%,#3d1560 35%,#0e2040 70%,#050510 100%)',
          label: 'Galaxy Dust',        tag: '💜 Galaxy',     category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#3a0f1d 0%,#6b1d38 50%,#9e2a4a 100%)',
          label: 'Velvet Rose',        tag: '🍷 Rose',       category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#4a2800 0%,#8a4b08 45%,#d48817 100%)',
          label: 'Golden Luxe',        tag: '✨ Luxe',       category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#121b2d 0%,#273859 50%,#0f1624 100%)',
          label: 'Museo Indigo',       tag: '⚓ Indigo',      category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#faf6ee 0%,#ede3d1 50%,#f5eee2 100%)',
          label: 'Museum Ivory',       tag: '🤍 Ivory',       category: 'modern-gradients', theme: 'light' },
        { url: 'linear-gradient(135deg,#4c1d95 0%,#6d28d9 50%,#2e1065 100%)',
          label: 'Royal Violet Velvet',tag: '💜 Violet',     category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#881337 0%,#9f1239 50%,#4c0519 100%)',
          label: 'Burgundy Velvet',    tag: '🍷 Burgundy',   category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#065f46 0%,#047857 50%,#022c22 100%)',
          label: 'Forest Silk Velvet', tag: '💚 Forest Silk',category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1e293b 0%,#334155 50%,#0f172a 100%)',
          label: 'Obsidian Velvet',    tag: '◼ Obsidian',    category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#fae8ff 0%,#f5d0fe 50%,#f43f5e 100%)',
          label: 'Magenta Mist Velvet',tag: '💖 Magenta',    category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#ffedd5 0%,#fed7aa 50%,#fb923c 100%)',
          label: 'Amber Glow Velvet',  tag: '🌇 Amber Velvet',category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#ecfeff 0%,#cff4fc 50%,#06b6d4 100%)',
          label: 'Cyan Aurora Velvet', tag: '🌌 Cyan Aurora',category: 'modern-gradients', theme: 'mid' },
        { url: 'linear-gradient(135deg,#03071e 0%,#370617 40%,#6a040f 80%,#9d0208 100%)',
          label: 'Bordeaux Velvet Oil',tag: '🍷 Bordeaux',   category: 'modern-gradients', theme: 'dark' },
        { url: 'linear-gradient(135deg,#1b263b 0%,#415a77 40%,#778da9 75%,#e0e1dd 100%)',
          label: 'Artisan Slate Grey', tag: '🪨 Slate Wash',  category: 'studio-oils', theme: 'dark' },
        { url: 'linear-gradient(135deg,#2b0938 0%,#5a187b 40%,#8e24aa 75%,#d81b60 100%)',
          label: 'Imperial Velvet Plum',tag: '🍷 Plum Velvet', category: 'modern-gradients', theme: 'dark' },
    ];
}

// ══════════════════════════════════════════════════════════
//  ARTWORK PREVIEW IMAGES
//  Folder structure:
//    assets/images/pet/           → pet portraits
//    assets/images/myself/        → person portraits
//    assets/images/pet-plus-me/   → combined pet + person
//    assets/images/family-couple/ → family & couple (add images here)
// ══════════════════════════════════════════════════════════

// Subject: My Pet  —  index 0-3 = realistic 1-4 pets, index 4-7 = cartoon 1-4 pets
export function getNoOfPets(): string[] {
    return [
        "assets/images/pet/realisticPet1.png",
        "assets/images/pet/realisticPet2.png",
        "assets/images/pet/realisticPet3.png",
        "assets/images/pet/realisticPet4.png",
        "assets/images/pet/cartoonPet1.png",
        "assets/images/pet/cartoonPet2.png",
        "assets/images/pet/cartoonPet3.png",
        "assets/images/pet/cartoonPet4.png"
    ];
}

// Subject: Myself  —  index 0 = realistic, index 1 = cartoon
export function getNoOfPersons(): string[] {
    return [
        "assets/images/myself/myself-realistic.png",
        "assets/images/myself/myself-cartoon.png",
    ];
}

// Subject: Pet + Me  —  index 0-2 = realistic, index 3-5 = cartoon
export function getNoOfBoth(): string[] {
    return [
        "assets/images/pet-plus-me/petAndMe-realistic1.png",
        "assets/images/pet-plus-me/petAndMe-realistic2.png",
        "assets/images/pet-plus-me/petAndMe-realistic3.png",
        "assets/images/pet-plus-me/petAndMe-cartoon1.png",
        "assets/images/pet-plus-me/petAndMe-cartoon2.png",
        "assets/images/pet-plus-me/petAndMe-cartoon3.png",
    ];
}

// Subject: Family & Couple  —  assets/images/family-couple/
// Realistic 1-3  |  Cartoon 1-3
export function getNoOfFamily(): string[] {
    return [
        // Realistic portraits (indices 0-2)
        "assets/images/family-couple/familyRealistic1.png",
        "assets/images/family-couple/familyRealistic2.png",
        "assets/images/family-couple/familyRealistic3.png",
        // Cartoon portraits (indices 3-5)
        "assets/images/family-couple/familyCartoon1.png",
        "assets/images/family-couple/familyCartoon2.png",
        "assets/images/family-couple/familyCartoon3.png",
    ];
}

// ══════════════════════════════════════════════════════════
//  PRICING TABLE
//
//  pet.cartoon[i]   / pet.realistic[i]   → i = petCount-1  (0=1 pet … 3=4 pets)
//  yourself.cartoon / yourself.realistic → single person portrait, no pets
//  both.cartoon[i]  / both.realistic[i]  → i = petCount-1  (0=1 pet+me … 3=4 pets+me)
//
//  customBackgroundExtra  added when the user uploads their own background
//  copyrightExtra         added when the user opts into commercial-use licence
// ══════════════════════════════════════════════════════════
export const PRICING = {
    pet: {
        cartoon:   [68.90,  98.90, 128.90, 158.90],
        realistic: [78.90, 108.90, 138.90, 168.90],
    },
    yourself: {
        cartoon:   100.90,
        realistic: 120.90,
    },
    both: {
        cartoon:   [119.90, 149.90, 179.90],
        realistic: [139.90, 169.90, 199.90],
    },
    family: {
        cartoon:   [119.90, 149.90, 179.90, 209.90],
        realistic: [139.90, 169.90, 199.90, 229.90],
    },
    customBackgroundExtra: 20,
    copyrightExtra:        20,
} as const;

export type SubjectTypeOption = 'pet' | 'yourself' | 'both' | 'family';

/**
 * Calculates base price for a given subject type, style, and quantity.
 * @param subjectType  'pet' | 'yourself' | 'both' | 'family'
 * @param isRealistic  true = Realistic style, false = Cartoon style
 * @param petCount     Number of pets/people selected (1–4). Ignored for 'yourself'.
 */
export function getBasePrice(
    subjectType: SubjectTypeOption,
    isRealistic: boolean,
    petCount: number
): number {
    const style = isRealistic ? 'realistic' : 'cartoon';

    if (subjectType === 'yourself') {
        return PRICING.yourself[style];
    }

    const idx = Math.max(0, Math.min(petCount - 1, 3));
    return (PRICING[subjectType][style] as readonly number[])[idx];
}

// ══════════════════════════════════════════════════════════
//  INTERFACES
// ══════════════════════════════════════════════════════════

export interface filesData {
    file: File;
    url: SafeUrl;
}

export interface selectedFiles {
    files: filesData[];
}

export interface product {
    name: string;
    urls: Imageurls;
    art_style: string;
    artist_additional_notes: string;
    background_additional_notes: string;
    background_style: string;
    petname: string;
    /** Who the portrait is for. Defaults to 'pet' for legacy / shop orders. */
    subject_type?: SubjectTypeOption;
    price: number;
    pet_quantity: number;
    additional_fee: number;
    User_ID: number;
}

export interface Imageurls {
    petimg1: string;
    petimg2: string;
    petimg3: string;
    petimg4: string;
    custombackgroundimg: string;
    /** Stores the owner's photo when subject_type is 'yourself' or 'both'. */
    personimg: string;
    [key: string]: string;
}