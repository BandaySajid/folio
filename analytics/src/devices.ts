// Phone model detection.
//
// Where the model comes from, best first:
//   - Instagram / Facebook in-app user agents, which carry the exact hardware
//     id (`iPhone14,2`, or `samsung; SM-S918B` on Android).
//   - User-Agent Client Hints (`navigator.userAgentData` model), which
//     Chromium browsers on Android send from the beacon.
//   - Older, unreduced Android user agents (`Android 14; SM-S918B Build/...`).
//   - iPhones in Safari / Chrome never expose the model, so the screen size
//     and pixel ratio narrow it down to a family of models.

export interface ClientHints {
  model?: string;
  platform?: string;
  platformVersion?: string;
}

export interface Screen {
  w?: number;
  h?: number;
  dpr?: number;
}

export interface PhoneInfo {
  os: string; // iOS, Android, Windows, macOS, ...
  osVersion: string; // "17.4", "14"
  brand: string; // Apple, Samsung, Google, ...
  model: string; // "iPhone 13 Pro", "Galaxy S23 Ultra", "iPhone 14 Pro / 15 / 15 Pro / 16"
  modelCode: string; // "iPhone14,2", "SM-S918B"
  exact: boolean; // false when the model is a screen-size guess
}

const IPHONE_IDS: Record<string, string> = {
  'iPhone8,4': 'iPhone SE',
  'iPhone9,1': 'iPhone 7', 'iPhone9,3': 'iPhone 7', 'iPhone9,2': 'iPhone 7 Plus', 'iPhone9,4': 'iPhone 7 Plus',
  'iPhone10,1': 'iPhone 8', 'iPhone10,4': 'iPhone 8', 'iPhone10,2': 'iPhone 8 Plus', 'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max', 'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2nd gen)',
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,6': 'iPhone SE (3rd gen)', 'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max', 'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus', 'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max', 'iPhone17,5': 'iPhone 16e',
  'iPhone18,3': 'iPhone 17', 'iPhone18,4': 'iPhone Air', 'iPhone18,1': 'iPhone 17 Pro', 'iPhone18,2': 'iPhone 17 Pro Max',
};

// Portrait CSS width x height @ device pixel ratio -> iPhones with that screen.
// Display Zoom makes a phone report the next size down, so this is a best guess.
const IPHONE_SCREENS: Record<string, string> = {
  '320x568@2': 'iPhone SE (1st gen) / 5s',
  '375x667@2': 'iPhone SE (2nd/3rd gen) / 8 / 7',
  '414x736@3': 'iPhone 8 Plus / 7 Plus',
  '375x812@3': 'iPhone X / XS / 11 Pro / 12 mini / 13 mini',
  '414x896@2': 'iPhone XR / 11',
  '414x896@3': 'iPhone XS Max / 11 Pro Max',
  '390x844@3': 'iPhone 12 / 13 / 14 / 16e',
  '428x926@3': 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus',
  '393x852@3': 'iPhone 14 Pro / 15 / 15 Pro / 16',
  '430x932@3': 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
  '402x874@3': 'iPhone 16 Pro / 17 / 17 Pro',
  '420x912@3': 'iPhone Air',
  '440x956@3': 'iPhone 16 Pro Max / 17 Pro Max',
};

// Samsung model numbers: SM-<series letter><3 digits><region suffix>.
// Keyed by the first four characters after "SM-".
const SAMSUNG: Record<string, string> = {
  S901: 'Galaxy S22', S906: 'Galaxy S22+', S908: 'Galaxy S22 Ultra',
  S911: 'Galaxy S23', S916: 'Galaxy S23+', S918: 'Galaxy S23 Ultra', S711: 'Galaxy S23 FE',
  S921: 'Galaxy S24', S926: 'Galaxy S24+', S928: 'Galaxy S24 Ultra', S721: 'Galaxy S24 FE',
  S931: 'Galaxy S25', S936: 'Galaxy S25+', S938: 'Galaxy S25 Ultra', S937: 'Galaxy S25 Edge', S731: 'Galaxy S25 FE',
  G991: 'Galaxy S21', G996: 'Galaxy S21+', G998: 'Galaxy S21 Ultra', G990: 'Galaxy S21 FE',
  G981: 'Galaxy S20', G986: 'Galaxy S20+', G988: 'Galaxy S20 Ultra', G780: 'Galaxy S20 FE', G781: 'Galaxy S20 FE',
  N986: 'Galaxy Note20 Ultra', N981: 'Galaxy Note20', N975: 'Galaxy Note10+', N970: 'Galaxy Note10',
  F936: 'Galaxy Z Fold4', F946: 'Galaxy Z Fold5', F956: 'Galaxy Z Fold6', F966: 'Galaxy Z Fold7',
  F721: 'Galaxy Z Flip4', F731: 'Galaxy Z Flip5', F741: 'Galaxy Z Flip6', F766: 'Galaxy Z Flip7',
  A536: 'Galaxy A53', A546: 'Galaxy A54', A556: 'Galaxy A55', A566: 'Galaxy A56',
  A336: 'Galaxy A33', A346: 'Galaxy A34', A356: 'Galaxy A35', A366: 'Galaxy A36',
  A235: 'Galaxy A23', A245: 'Galaxy A24', A256: 'Galaxy A25', A266: 'Galaxy A26',
  A145: 'Galaxy A14', A146: 'Galaxy A14 5G', A155: 'Galaxy A15', A156: 'Galaxy A15 5G', A165: 'Galaxy A16', A166: 'Galaxy A16 5G',
  A055: 'Galaxy A05', A057: 'Galaxy A05s', A065: 'Galaxy A06',
  A525: 'Galaxy A52', A526: 'Galaxy A52 5G', A528: 'Galaxy A52s', A725: 'Galaxy A72', A736: 'Galaxy A73',
  M146: 'Galaxy M14', M156: 'Galaxy M15', M346: 'Galaxy M34', M356: 'Galaxy M35', M546: 'Galaxy M54', M556: 'Galaxy M55',
  E146: 'Galaxy F14', E156: 'Galaxy F15', E346: 'Galaxy F34', E546: 'Galaxy F54', E556: 'Galaxy F55',
};

// Brand from the manufacturer field or the model code prefix.
function brandOf(manufacturer: string, code: string): string {
  const m = manufacturer.toLowerCase();
  const known: Record<string, string> = {
    samsung: 'Samsung', google: 'Google', oneplus: 'OnePlus', oppo: 'OPPO', realme: 'realme', vivo: 'vivo', iqoo: 'iQOO',
    xiaomi: 'Xiaomi', redmi: 'Redmi', poco: 'POCO', motorola: 'Motorola', nothing: 'Nothing', huawei: 'Huawei', honor: 'Honor',
    nokia: 'Nokia', hmd: 'HMD', sony: 'Sony', asus: 'ASUS', lenovo: 'Lenovo', tecno: 'TECNO', infinix: 'Infinix', itel: 'itel', lava: 'Lava',
  };
  for (const [k, v] of Object.entries(known)) if (m.includes(k)) return v;
  if (/^SM-/.test(code)) return 'Samsung';
  if (/^Pixel/i.test(code)) return 'Google';
  if (/^RMX/.test(code)) return 'realme';
  if (/^CPH/.test(code)) return 'OPPO / OnePlus';
  if (/^V\d{4}/.test(code)) return 'vivo';
  if (/^I\d{4}/.test(code)) return 'iQOO';
  if (/^(M\d{4}|\d{4,5}[A-Z0-9]{3,})/.test(code)) return 'Xiaomi / Redmi / POCO';
  if (/^moto/i.test(code)) return 'Motorola';
  if (/^(A0\d\d|A1\d\d)$/.test(code)) return 'Nothing';
  return manufacturer ? manufacturer[0].toUpperCase() + manufacturer.slice(1) : '';
}

function androidName(brand: string, code: string): string {
  if (brand === 'Samsung') {
    const key = code.replace(/^SM-/, '').slice(0, 4);
    if (SAMSUNG[key]) return SAMSUNG[key];
  }
  if (brand === 'Google' && !/^Pixel/i.test(code)) return `Pixel (${code})`;
  if (/^Pixel/i.test(code)) return code.replace(/^pixel/i, 'Pixel');
  return code;
}

const clean = (v: string | undefined, n = 40) => (v ?? '').replace(/[^\w ,.+()/-]/g, '').trim().slice(0, n);

export function detectPhone(ua: string, hints: ClientHints = {}, screen: Screen = {}): PhoneInfo {
  const info: PhoneInfo = { os: '', osVersion: '', brand: '', model: '', modelCode: '', exact: false };

  // OS + version from the user agent
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/))) {
    info.os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
    info.osVersion = `${m[1]}.${m[2]}`;
  } else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) {
    info.os = 'Android';
    info.osVersion = m[1];
  } else if (/Windows/.test(ua)) info.os = 'Windows';
  else if (/CrOS/.test(ua)) info.os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) info.os = 'macOS';
  else if (/Linux/.test(ua)) info.os = 'Linux';

  // Chromium's reduced UA freezes Android at "10"; the client hint is real.
  if (info.os === 'Android' && hints.platformVersion) info.osVersion = clean(hints.platformVersion, 12).replace(/\.0(\.0)?$/, '');
  if (info.os === 'Windows' && hints.platformVersion) info.osVersion = Number(hints.platformVersion.split('.')[0]) >= 13 ? '11' : '10';

  // Instagram Android: "Instagram 300.0.0.18.110 Android (34/14; 420dpi; 1080x2400; samsung; SM-S918B; dm1q; qcom; ..."
  if ((m = ua.match(/Instagram [\d.]+ Android \((\d+)\/([\d.]+); \d+dpi; \d+x\d+; ([^;]+); ([^;]+);/))) {
    info.osVersion = m[2];
    info.brand = brandOf(m[3], m[4]);
    info.modelCode = clean(m[4]);
    info.model = androidName(info.brand, info.modelCode);
    info.exact = true;
    return info;
  }
  // Instagram iOS: "Instagram 300.0.0.0 (iPhone14,2; iOS 17_0; ..."
  // Facebook: "FBDV/iPhone14,2" or "FBDV/SM-S918B"
  const appleId = ua.match(/\b(iPhone\d+,\d+)\b/)?.[1];
  if (appleId) {
    info.brand = 'Apple';
    info.modelCode = appleId;
    info.model = IPHONE_IDS[appleId] ?? `iPhone (${appleId})`;
    info.exact = true;
    return info;
  }
  const fbModel = ua.match(/FBDV\/([^;\]]+)/)?.[1];
  if (fbModel && info.os === 'Android') {
    const manufacturer = ua.match(/FBMF\/([^;\]]+)/)?.[1] ?? '';
    info.brand = brandOf(manufacturer, fbModel);
    info.modelCode = clean(fbModel);
    info.model = androidName(info.brand, info.modelCode);
    info.exact = true;
    return info;
  }

  if (info.os === 'Android') {
    // Client hint model, else an unreduced UA model ("K" is the reduced placeholder)
    const uaModel = ua.match(/Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build\/[^;)]*)?\)/i)?.[1]?.trim();
    const code = clean(hints.model) || (uaModel && uaModel !== 'K' ? clean(uaModel) : '');
    if (code) {
      info.brand = brandOf('', code);
      info.modelCode = code;
      info.model = androidName(info.brand, code);
      info.exact = true;
    } else {
      info.model = 'Android phone (model hidden)';
    }
    return info;
  }

  if (info.os === 'iOS') {
    info.brand = 'Apple';
    const { w, h, dpr } = screen;
    if (w && h && dpr) {
      const key = `${Math.min(w, h)}x${Math.max(w, h)}@${Math.round(dpr)}`;
      info.model = IPHONE_SCREENS[key] ?? `iPhone (${key})`;
      info.modelCode = key;
    } else {
      info.model = 'iPhone';
    }
    return info;
  }

  if (info.os === 'iPadOS') {
    info.brand = 'Apple';
    info.model = 'iPad';
  }
  return info;
}
