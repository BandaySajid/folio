// Android model code -> brand + marketing name, using Google Play's supported
// devices catalog (~54k rows, every brand that ships Google Play). The catalog
// is downloaded at build time (scripts/build-catalog.mjs) and bundled, so
// lookups need no storage and every deploy ships a fresh copy.
import catalog from './generated/catalog.json';

const CATALOG = catalog as Record<string, string>;

export interface ModelName {
  brand: string;
  name: string;
}

export function lookupModel(code: string, codename = ''): ModelName | null {
  const candidates = [code, code.split('/')[0], code.replace(/\s*\(.*\)$/, '')].map((c) => c.trim().toLowerCase()).filter((c, i, a) => c && a.indexOf(c) === i);
  for (const c of candidates) {
    const value = CATALOG[c];
    if (!value) continue;
    const entries = value.split('\u0002').map((e) => {
      const [brand, name, device = ''] = e.split('\u0001');
      return { brand, name, device };
    });
    // Shared model codes (e.g. Motorola) list several phones; the codename
    // picks the right one, else prefer the name equal to the code.
    const best =
      (codename && entries.find((e) => e.device.toLowerCase() === codename.toLowerCase())) ||
      entries.find((e) => e.name.toLowerCase() === c) ||
      entries.find((e) => e.name) ||
      entries[0];
    return { brand: best.brand, name: best.name || code };
  }
  return null;
}

export const catalogSize = () => Object.keys(CATALOG).length;

// Brand guesses for codes missing from the catalog (no Play Services, very new
// devices). Prefix conventions per manufacturer.
const PREFIX_BRANDS: [RegExp, string][] = [
  [/^SM-|^SC-|^SCG|^SCV/i, 'Samsung'],
  [/^Pixel/i, 'Google'],
  [/^RMX/i, 'realme'],
  [/^CPH/i, 'OPPO / OnePlus'],
  [/^(PH[A-Z]\d{3}|PJ[A-Z]\d{3}|PK[A-Z]\d{3})/i, 'OPPO / OnePlus'],
  [/^(NE|LE|HD|IN|KB|BE|GM)\d{4}/i, 'OnePlus'],
  [/^V\d{4}/i, 'vivo'],
  [/^I\d{4}/i, 'iQOO'],
  [/^(M\d{4}[A-Z]\d+|\d{4,5}[A-Z0-9]{3,}|Redmi|POCO|Mi )/i, 'Xiaomi / Redmi / POCO'],
  [/^(XT\d{4}|moto|motorola)/i, 'Motorola'],
  [/^A0\d{2}$|^A1\d{2}$/i, 'Nothing'],
  [/^[A-Z]{3}-[A-Z]{2}\d{2}/, 'Huawei / Honor'],
  [/^TECNO/i, 'TECNO'],
  [/^Infinix|^X\d{3,4}[A-Z]?$/i, 'Infinix'],
  [/^itel/i, 'itel'],
  [/^(TA-\d{4}|Nokia)/i, 'Nokia / HMD'],
  [/^(XQ-|SO-|SOG)/i, 'Sony'],
  [/^ASUS|^AI\d{4}/i, 'ASUS'],
  [/^LM-|^LG-/i, 'LG'],
];

const MANUFACTURER_BRANDS: Record<string, string> = {
  samsung: 'Samsung', google: 'Google', oneplus: 'OnePlus', oppo: 'OPPO', realme: 'realme', vivo: 'vivo', iqoo: 'iQOO',
  xiaomi: 'Xiaomi', redmi: 'Redmi', poco: 'POCO', motorola: 'Motorola', nothing: 'Nothing', huawei: 'Huawei', honor: 'Honor',
  hmd: 'HMD', 'hmd global': 'Nokia / HMD', nokia: 'Nokia', sony: 'Sony', asus: 'ASUS', lenovo: 'Lenovo', tecno: 'TECNO',
  infinix: 'Infinix', itel: 'itel', lava: 'Lava', lge: 'LG', fairphone: 'Fairphone', zte: 'ZTE', nubia: 'nubia', apple: 'Apple',
};

export function brandFallback(manufacturer: string, code: string): string {
  const m = manufacturer.toLowerCase().trim();
  if (MANUFACTURER_BRANDS[m]) return MANUFACTURER_BRANDS[m];
  for (const [re, brand] of PREFIX_BRANDS) if (re.test(code)) return brand;
  return m ? m[0].toUpperCase() + m.slice(1) : '';
}

// "Galaxy S23 Ultra" + "Samsung" -> "Samsung Galaxy S23 Ultra"; "Pixel 7a" stays.
export function displayName(brand: string, name: string): string {
  if (!brand || !name) return name;
  const b = brand.toLowerCase();
  const n = name.toLowerCase();
  if (n.startsWith(b) || (b === 'google' && n.startsWith('pixel'))) return name;
  return `${brand} ${name}`;
}
