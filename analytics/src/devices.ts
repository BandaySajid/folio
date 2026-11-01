// Phone model and OS detection.
//
// Sources, best first:
//   - Instagram / Facebook in-app user agents. They carry the exact hardware
//     id: `iPhone14,2`, or on Android `samsung; SM-S918B; dm3q` (maker, model
//     code, device codename).
//   - User-Agent Client Hints (`navigator.userAgentData.getHighEntropyValues`),
//     sent by the beacon from Chromium browsers and WebViews on Android, which
//     hide the model in the user agent ("Android 10; K").
//   - Unreduced Android user agents (`Android 14; SM-S918B Build/...`), still
//     sent by WebViews and some browsers.
//   - iPhones outside in-app browsers never expose the model, so the screen
//     size, pixel ratio and iOS version narrow it down to a set of models.
//
// Android model codes are turned into marketing names by the Dashboard Durable
// Object using Google Play's supported devices catalog (see models.ts). This
// file only extracts the codes.

export interface ClientHints {
  model?: string;
  platform?: string;
  platformVersion?: string;
}

export interface Screen {
  w?: number;
  h?: number;
  dpr?: number;
  touch?: number; // navigator.maxTouchPoints
}

export interface PhoneInfo {
  os: string; // iOS, iPadOS, Android, HarmonyOS, Windows, macOS, ...
  osVersion: string; // "17.4", "14"
  manufacturer: string; // as reported, lowercased brand when known
  model: string; // display name; refined later for Android
  modelCode: string; // "iPhone14,2", "SM-S918B", "393x852@3"
  codename: string; // Android device codename ("dm3q"), when known
  exact: boolean; // false when the model is a screen-size estimate
}

interface IPhone {
  ids: string[];
  name: string;
  screen: string;
  minIOS: number;
  maxIOS: number;
}

// Hardware ids, portrait CSS screen size @ pixel ratio, and supported iOS range.
const IPHONES: IPhone[] = [
  { ids: ['iPhone8,4'], name: 'iPhone SE (1st gen)', screen: '320x568@2', minIOS: 9, maxIOS: 15 },
  { ids: ['iPhone8,1'], name: 'iPhone 6s', screen: '375x667@2', minIOS: 9, maxIOS: 15 },
  { ids: ['iPhone8,2'], name: 'iPhone 6s Plus', screen: '414x736@3', minIOS: 9, maxIOS: 15 },
  { ids: ['iPhone9,1', 'iPhone9,3'], name: 'iPhone 7', screen: '375x667@2', minIOS: 10, maxIOS: 15 },
  { ids: ['iPhone9,2', 'iPhone9,4'], name: 'iPhone 7 Plus', screen: '414x736@3', minIOS: 10, maxIOS: 15 },
  { ids: ['iPhone10,1', 'iPhone10,4'], name: 'iPhone 8', screen: '375x667@2', minIOS: 11, maxIOS: 16 },
  { ids: ['iPhone10,2', 'iPhone10,5'], name: 'iPhone 8 Plus', screen: '414x736@3', minIOS: 11, maxIOS: 16 },
  { ids: ['iPhone10,3', 'iPhone10,6'], name: 'iPhone X', screen: '375x812@3', minIOS: 11, maxIOS: 16 },
  { ids: ['iPhone11,2'], name: 'iPhone XS', screen: '375x812@3', minIOS: 12, maxIOS: 18 },
  { ids: ['iPhone11,4', 'iPhone11,6'], name: 'iPhone XS Max', screen: '414x896@3', minIOS: 12, maxIOS: 18 },
  { ids: ['iPhone11,8'], name: 'iPhone XR', screen: '414x896@2', minIOS: 12, maxIOS: 18 },
  { ids: ['iPhone12,1'], name: 'iPhone 11', screen: '414x896@2', minIOS: 13, maxIOS: 99 },
  { ids: ['iPhone12,3'], name: 'iPhone 11 Pro', screen: '375x812@3', minIOS: 13, maxIOS: 99 },
  { ids: ['iPhone12,5'], name: 'iPhone 11 Pro Max', screen: '414x896@3', minIOS: 13, maxIOS: 99 },
  { ids: ['iPhone12,8'], name: 'iPhone SE (2nd gen)', screen: '375x667@2', minIOS: 13, maxIOS: 99 },
  { ids: ['iPhone13,1'], name: 'iPhone 12 mini', screen: '375x812@3', minIOS: 14, maxIOS: 99 },
  { ids: ['iPhone13,2'], name: 'iPhone 12', screen: '390x844@3', minIOS: 14, maxIOS: 99 },
  { ids: ['iPhone13,3'], name: 'iPhone 12 Pro', screen: '390x844@3', minIOS: 14, maxIOS: 99 },
  { ids: ['iPhone13,4'], name: 'iPhone 12 Pro Max', screen: '428x926@3', minIOS: 14, maxIOS: 99 },
  { ids: ['iPhone14,4'], name: 'iPhone 13 mini', screen: '375x812@3', minIOS: 15, maxIOS: 99 },
  { ids: ['iPhone14,5'], name: 'iPhone 13', screen: '390x844@3', minIOS: 15, maxIOS: 99 },
  { ids: ['iPhone14,2'], name: 'iPhone 13 Pro', screen: '390x844@3', minIOS: 15, maxIOS: 99 },
  { ids: ['iPhone14,3'], name: 'iPhone 13 Pro Max', screen: '428x926@3', minIOS: 15, maxIOS: 99 },
  { ids: ['iPhone14,6'], name: 'iPhone SE (3rd gen)', screen: '375x667@2', minIOS: 15, maxIOS: 99 },
  { ids: ['iPhone14,7'], name: 'iPhone 14', screen: '390x844@3', minIOS: 16, maxIOS: 99 },
  { ids: ['iPhone14,8'], name: 'iPhone 14 Plus', screen: '428x926@3', minIOS: 16, maxIOS: 99 },
  { ids: ['iPhone15,2'], name: 'iPhone 14 Pro', screen: '393x852@3', minIOS: 16, maxIOS: 99 },
  { ids: ['iPhone15,3'], name: 'iPhone 14 Pro Max', screen: '430x932@3', minIOS: 16, maxIOS: 99 },
  { ids: ['iPhone15,4'], name: 'iPhone 15', screen: '393x852@3', minIOS: 17, maxIOS: 99 },
  { ids: ['iPhone15,5'], name: 'iPhone 15 Plus', screen: '430x932@3', minIOS: 17, maxIOS: 99 },
  { ids: ['iPhone16,1'], name: 'iPhone 15 Pro', screen: '393x852@3', minIOS: 17, maxIOS: 99 },
  { ids: ['iPhone16,2'], name: 'iPhone 15 Pro Max', screen: '430x932@3', minIOS: 17, maxIOS: 99 },
  { ids: ['iPhone17,3'], name: 'iPhone 16', screen: '393x852@3', minIOS: 18, maxIOS: 99 },
  { ids: ['iPhone17,4'], name: 'iPhone 16 Plus', screen: '430x932@3', minIOS: 18, maxIOS: 99 },
  { ids: ['iPhone17,1'], name: 'iPhone 16 Pro', screen: '402x874@3', minIOS: 18, maxIOS: 99 },
  { ids: ['iPhone17,2'], name: 'iPhone 16 Pro Max', screen: '440x956@3', minIOS: 18, maxIOS: 99 },
  { ids: ['iPhone17,5'], name: 'iPhone 16e', screen: '390x844@3', minIOS: 18, maxIOS: 99 },
  { ids: ['iPhone18,3'], name: 'iPhone 17', screen: '402x874@3', minIOS: 26, maxIOS: 99 },
  { ids: ['iPhone18,4'], name: 'iPhone Air', screen: '420x912@3', minIOS: 26, maxIOS: 99 },
  { ids: ['iPhone18,1'], name: 'iPhone 17 Pro', screen: '402x874@3', minIOS: 26, maxIOS: 99 },
  { ids: ['iPhone18,2'], name: 'iPhone 17 Pro Max', screen: '440x956@3', minIOS: 26, maxIOS: 99 },
];
const IPHONE_BY_ID = new Map(IPHONES.flatMap((p) => p.ids.map((id) => [id, p.name] as const)));

const clean = (v: string | undefined, n = 60) => (v ?? '').replace(/[^\w ,.+()/&'-]/g, '').trim().slice(0, n);

// Shorten a candidate list: "iPhone 14 Pro / 15 / 15 Pro / 16"
function joinIPhones(names: string[]): string {
  return names.map((n, i) => (i === 0 ? n : n.replace(/^iPhone /, ''))).join(' / ');
}

export function estimateIPhone(screen: Screen, iosMajor: number): { name: string; key: string } | null {
  const { w, h, dpr } = screen;
  if (!w || !h || !dpr) return null;
  const key = `${Math.min(w, h)}x${Math.max(w, h)}@${Math.round(dpr)}`;
  let matches = IPHONES.filter((p) => p.screen === key);
  if (iosMajor) {
    const byVersion = matches.filter((p) => iosMajor >= p.minIOS && iosMajor <= p.maxIOS);
    if (byVersion.length) matches = byVersion;
  }
  if (!matches.length) return { name: `iPhone (${key})`, key };
  return { name: joinIPhones(matches.map((p) => p.name)), key };
}

// iOS version. Safari 26+ freezes "OS 18_6" in the UA but its "Version/26.x"
// tracks the OS; in-app browsers and Chrome report the real version.
function iosVersion(ua: string): string {
  const inApp = ua.match(/\biOS (\d+)[_.](\d+)/) ?? ua.match(/FBSV\/(\d+)\.(\d+)/);
  if (inApp) return `${inApp[1]}.${inApp[2]}`;
  const os = ua.match(/ OS (\d+)[_.](\d+)/);
  const safari = ua.match(/Version\/(\d+)\.(\d+)/);
  if (safari && Number(safari[1]) >= 26 && !/CriOS|FxiOS|EdgiOS/.test(ua)) return `${safari[1]}.${safari[2]}`;
  return os ? `${os[1]}.${os[2]}` : '';
}

export function detectPhone(ua: string, hints: ClientHints = {}, screen: Screen = {}): PhoneInfo {
  const info: PhoneInfo = { os: '', osVersion: '', manufacturer: '', model: '', modelCode: '', codename: '', exact: false };
  let m: RegExpMatchArray | null;

  if (/iPhone|iPod/.test(ua)) {
    info.os = 'iOS';
    info.osVersion = iosVersion(ua);
  } else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && (screen.touch ?? 0) > 1)) {
    // iPadOS Safari pretends to be a Mac; touch support gives it away.
    info.os = 'iPadOS';
    info.osVersion = /iPad/.test(ua) ? iosVersion(ua) : (ua.match(/Version\/(\d+\.\d+)/)?.[1] ?? '');
  } else if (/HarmonyOS|OpenHarmony/.test(ua)) {
    info.os = 'HarmonyOS';
    info.osVersion = ua.match(/(?:Open)?HarmonyOS[ /]?(\d+(?:\.\d+)?)/)?.[1] ?? '';
  } else if ((m = ua.match(/Android[ /]?(\d+(?:\.\d+)?)?/))) {
    info.os = 'Android';
    info.osVersion = m[1] ?? '';
  } else if (/Windows/.test(ua)) info.os = 'Windows';
  else if (/CrOS/.test(ua)) info.os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) info.os = 'macOS';
  else if (/KAIOS/i.test(ua)) info.os = 'KaiOS';
  else if (/Linux/.test(ua)) info.os = 'Linux';

  // Client hints carry the real version where the UA is frozen.
  const pv = clean(hints.platformVersion, 20);
  if (pv) {
    const major = Number(pv.split('.')[0]);
    if (info.os === 'Android') info.osVersion = pv.replace(/(\.0)+$/, '');
    if (info.os === 'Windows') info.osVersion = major >= 13 ? '11' : major > 0 ? '10' : '';
    if (info.os === 'macOS' && major) info.osVersion = pv.split('.').slice(0, 2).join('.');
  }

  // --- Apple hardware ids (Instagram "(iPhone14,2; iOS 17_4", Facebook "FBDV/iPhone14,2")
  const appleId = ua.match(/\b(iPhone\d+,\d+|iPad\d+,\d+|iPod\d+,\d+)\b/)?.[1];
  if (appleId) {
    info.manufacturer = 'apple';
    info.modelCode = appleId;
    info.model = IPHONE_BY_ID.get(appleId) ?? (appleId.startsWith('iPad') ? `iPad (${appleId})` : `iPhone (${appleId})`);
    info.exact = true;
    if (appleId.startsWith('iPad')) info.os = 'iPadOS';
    return info;
  }

  if (info.os === 'iOS') {
    info.manufacturer = 'apple';
    const est = estimateIPhone(screen, Number(info.osVersion.split('.')[0]) || 0);
    info.model = est?.name ?? 'iPhone';
    info.modelCode = est?.key ?? '';
    return info;
  }
  if (info.os === 'iPadOS') {
    info.manufacturer = 'apple';
    info.model = 'iPad';
    return info;
  }

  if (info.os !== 'Android' && info.os !== 'HarmonyOS') return info;

  // --- Android
  // Instagram: "Instagram 300.0 Android (34/14; 420dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_IN; ...)"
  if ((m = ua.match(/Instagram [\d.]+ Android \((\d+)\/([\d.]+); [^;]*dpi; [^;]*; ([^;]+); ([^;]+); ([^;]+);/))) {
    info.osVersion = m[2];
    info.manufacturer = clean(m[3]).toLowerCase();
    info.modelCode = clean(m[4]);
    info.codename = clean(m[5]);
    info.exact = true;
  } else if ((m = ua.match(/FBDV\/([^;\]]+)/))) {
    // Facebook / Messenger: "[FB_IAB/FB4A;FBAV/...;FBBV/...;FBDM/{...};FBLC/en_US;FBRV/0;FBCR/...;FBMF/samsung;FBBD/samsung;FBPN/...;FBDV/SM-S918B;FBSV/14;...]"
    info.modelCode = clean(m[1]);
    info.manufacturer = clean(ua.match(/FBMF\/([^;\]]+)/)?.[1] ?? ua.match(/FBBD\/([^;\]]+)/)?.[1]).toLowerCase();
    const sv = ua.match(/FBSV\/([\d.]+)/)?.[1];
    if (sv) info.osVersion = sv;
    info.exact = true;
  } else {
    // Client hints first, then a model in the UA ("K" is Chrome's reduced placeholder).
    const hintModel = clean(hints.model);
    const uaModel = ua.match(/Android[ \d.]*; (?:[a-z]{2}[-_][a-zA-Z]{2}; )?(?:wv; )?([^;)]+?)(?: Build\/[^;)]*)?(?:; wv)?\)/)?.[1]?.trim();
    const harmonyModel = ua.match(/HarmonyOS; ([A-Z0-9]{2,4}-[A-Z0-9]{2,5})/)?.[1];
    const code = hintModel || harmonyModel || (uaModel && !/^(K|Mobile|Tablet|Linux|U|wv|HarmonyOS)$/i.test(uaModel) ? clean(uaModel) : '');
    if (code) {
      info.modelCode = code;
      info.exact = true;
    }
  }
  info.model = info.modelCode || (info.os === 'HarmonyOS' ? 'Huawei device' : 'Android phone (model hidden)');
  return info;
}
