// Traffic source attribution.
//
// Signals are checked strongest-first:
//   1. Explicit tags you put on links yourself (?ref=, ?src=, utm_source)
//   2. Ad / platform click IDs appended by the platform (fbclid, gclid, ...)
//   3. In-app browser user agents (Instagram, Facebook, Threads, TikTok, ...)
//   4. The Referer / document.referrer host
//   5. Nothing at all: Direct
//
// Instagram is the trickiest case: its in-app browser usually strips the
// referrer, but the link shim (l.instagram.com) appends `fbclid`, bio links get
// `utm_source=ig&utm_content=link_in_bio`, shares get `igsh`/`igshid`, and the
// user agent always contains "Instagram <version>".

export type Category = 'Social' | 'Search' | 'AI' | 'Dev' | 'Messaging' | 'Email' | 'Ads' | 'Referral' | 'Direct' | 'Internal';

export interface Attribution {
  source: string;
  category: Category;
  detail: string; // e.g. "bio", "story", "dm", campaign, referrer path
  campaign: string;
  clickIds: string[]; // e.g. ["fbclid", "igsh"]
  inApp: string; // in-app browser name, if any
  signal: 'tag' | 'click-id' | 'in-app' | 'referrer' | 'none';
}

const SOURCE_ALIASES: Record<string, [string, Category]> = {
  ig: ['Instagram', 'Social'],
  insta: ['Instagram', 'Social'],
  instagram: ['Instagram', 'Social'],
  fb: ['Facebook', 'Social'],
  facebook: ['Facebook', 'Social'],
  threads: ['Threads', 'Social'],
  li: ['LinkedIn', 'Social'],
  linkedin: ['LinkedIn', 'Social'],
  x: ['X', 'Social'],
  tw: ['X', 'Social'],
  twitter: ['X', 'Social'],
  gh: ['GitHub', 'Dev'],
  github: ['GitHub', 'Dev'],
  yt: ['YouTube', 'Social'],
  youtube: ['YouTube', 'Social'],
  reddit: ['Reddit', 'Social'],
  hn: ['Hacker News', 'Dev'],
  hackernews: ['Hacker News', 'Dev'],
  tiktok: ['TikTok', 'Social'],
  snap: ['Snapchat', 'Social'],
  snapchat: ['Snapchat', 'Social'],
  pinterest: ['Pinterest', 'Social'],
  wa: ['WhatsApp', 'Messaging'],
  whatsapp: ['WhatsApp', 'Messaging'],
  tg: ['Telegram', 'Messaging'],
  telegram: ['Telegram', 'Messaging'],
  discord: ['Discord', 'Messaging'],
  slack: ['Slack', 'Messaging'],
  email: ['Email', 'Email'],
  mail: ['Email', 'Email'],
  newsletter: ['Email', 'Email'],
  gmail: ['Gmail', 'Email'],
  resume: ['Resume', 'Referral'],
  cv: ['Resume', 'Referral'],
  qr: ['QR code', 'Referral'],
  google: ['Google', 'Search'],
  bing: ['Bing', 'Search'],
  peerlist: ['Peerlist', 'Dev'],
  devto: ['DEV', 'Dev'],
  medium: ['Medium', 'Social'],
  chatgpt: ['ChatGPT', 'AI'],
  'chatgpt.com': ['ChatGPT', 'AI'],
  openai: ['ChatGPT', 'AI'],
  perplexity: ['Perplexity', 'AI'],
  claude: ['Claude', 'AI'],
};

// Click IDs appended by ad networks / link shims.
const CLICK_IDS: Record<string, [string, Category]> = {
  fbclid: ['Meta', 'Social'], // Facebook + Instagram outbound link shim
  igshid: ['Instagram', 'Social'], // Instagram share id (old)
  igsh: ['Instagram', 'Social'], // Instagram share id (new)
  gclid: ['Google Ads', 'Ads'],
  gbraid: ['Google Ads', 'Ads'],
  wbraid: ['Google Ads', 'Ads'],
  dclid: ['Google Ads', 'Ads'],
  gad_source: ['Google Ads', 'Ads'],
  srsltid: ['Google', 'Search'], // Google organic / Merchant listings
  msclkid: ['Microsoft Ads', 'Ads'],
  ttclid: ['TikTok', 'Social'],
  twclid: ['X', 'Social'],
  li_fat_id: ['LinkedIn', 'Social'],
  rdt_cid: ['Reddit', 'Social'],
  ScCid: ['Snapchat', 'Social'],
  sccid: ['Snapchat', 'Social'],
  epik: ['Pinterest', 'Social'],
  yclid: ['Yandex', 'Search'],
  mc_cid: ['Mailchimp', 'Email'],
  _hsenc: ['HubSpot', 'Email'],
};

// In-app browser user agent markers.
const IN_APP: [RegExp, string, Category][] = [
  [/\bInstagram\b/i, 'Instagram', 'Social'],
  [/\bBarcelona\b/, 'Threads', 'Social'],
  [/FBAN|FBAV|FB_IAB|FB4A|FBIOS|\bMessenger\b/, 'Facebook', 'Social'],
  [/LinkedInApp/i, 'LinkedIn', 'Social'],
  [/BytedanceWebview|musical_ly|TikTok|\bTrill\b/i, 'TikTok', 'Social'],
  [/Snapchat/i, 'Snapchat', 'Social'],
  [/Pinterest/i, 'Pinterest', 'Social'],
  [/Twitter|TwitterAndroid/i, 'X', 'Social'],
  [/Telegram/i, 'Telegram', 'Messaging'],
  [/WhatsApp/i, 'WhatsApp', 'Messaging'],
  [/\bDiscord\b/i, 'Discord', 'Messaging'],
  [/\bSlack\b/i, 'Slack', 'Messaging'],
  [/\bLine\//, 'LINE', 'Messaging'],
  [/KAKAOTALK/i, 'KakaoTalk', 'Messaging'],
  [/\bGSA\//, 'Google App', 'Search'],
];

// Referrer host suffix -> source.
const REFERRERS: [string, string, Category][] = [
  ['instagram.com', 'Instagram', 'Social'],
  ['threads.net', 'Threads', 'Social'],
  ['threads.com', 'Threads', 'Social'],
  ['facebook.com', 'Facebook', 'Social'],
  ['fb.com', 'Facebook', 'Social'],
  ['messenger.com', 'Facebook', 'Social'],
  ['t.co', 'X', 'Social'],
  ['x.com', 'X', 'Social'],
  ['twitter.com', 'X', 'Social'],
  ['linkedin.com', 'LinkedIn', 'Social'],
  ['lnkd.in', 'LinkedIn', 'Social'],
  ['com.linkedin.android', 'LinkedIn', 'Social'],
  ['youtube.com', 'YouTube', 'Social'],
  ['youtu.be', 'YouTube', 'Social'],
  ['reddit.com', 'Reddit', 'Social'],
  ['tiktok.com', 'TikTok', 'Social'],
  ['snapchat.com', 'Snapchat', 'Social'],
  ['pinterest.com', 'Pinterest', 'Social'],
  ['bsky.app', 'Bluesky', 'Social'],
  ['medium.com', 'Medium', 'Social'],
  ['github.com', 'GitHub', 'Dev'],
  ['github.io', 'GitHub', 'Dev'],
  ['gitlab.com', 'GitLab', 'Dev'],
  ['news.ycombinator.com', 'Hacker News', 'Dev'],
  ['dev.to', 'DEV', 'Dev'],
  ['peerlist.io', 'Peerlist', 'Dev'],
  ['stackoverflow.com', 'Stack Overflow', 'Dev'],
  ['producthunt.com', 'Product Hunt', 'Dev'],
  ['wellfound.com', 'Wellfound', 'Dev'],
  ['chatgpt.com', 'ChatGPT', 'AI'],
  ['chat.openai.com', 'ChatGPT', 'AI'],
  ['perplexity.ai', 'Perplexity', 'AI'],
  ['claude.ai', 'Claude', 'AI'],
  ['gemini.google.com', 'Gemini', 'AI'],
  ['copilot.microsoft.com', 'Copilot', 'AI'],
  ['you.com', 'You.com', 'AI'],
  ['phind.com', 'Phind', 'AI'],
  ['com.google.android.gm', 'Gmail', 'Email'],
  ['mail.google.com', 'Gmail', 'Email'],
  ['outlook.live.com', 'Outlook', 'Email'],
  ['outlook.office.com', 'Outlook', 'Email'],
  ['mail.yahoo.com', 'Yahoo Mail', 'Email'],
  ['discord.com', 'Discord', 'Messaging'],
  ['discordapp.com', 'Discord', 'Messaging'],
  ['t.me', 'Telegram', 'Messaging'],
  ['telegram.org', 'Telegram', 'Messaging'],
  ['whatsapp.com', 'WhatsApp', 'Messaging'],
  ['wa.me', 'WhatsApp', 'Messaging'],
  ['slack.com', 'Slack', 'Messaging'],
  ['com.slack', 'Slack', 'Messaging'],
  ['duckduckgo.com', 'DuckDuckGo', 'Search'],
  ['bing.com', 'Bing', 'Search'],
  ['search.brave.com', 'Brave Search', 'Search'],
  ['ecosia.org', 'Ecosia', 'Search'],
  ['search.yahoo.com', 'Yahoo', 'Search'],
  ['yandex.ru', 'Yandex', 'Search'],
  ['yandex.com', 'Yandex', 'Search'],
  ['baidu.com', 'Baidu', 'Search'],
  ['com.google.android.googlequicksearchbox', 'Google', 'Search'],
];

const CLEAN_PARAM = /[^\w .:/@+-]/g;
const clip = (v: string | null | undefined, n = 60) => (v ?? '').replace(CLEAN_PARAM, '').trim().slice(0, n);

function hostOf(ref: string): string {
  if (!ref) return '';
  try {
    const u = new URL(ref);
    // android-app://com.linkedin.android/ has the package as host
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchReferrer(host: string): [string, Category] | null {
  if (!host) return null;
  if (/(^|\.)google\.[a-z.]+$/.test(host) && !host.startsWith('gemini.') && !host.startsWith('mail.')) return ['Google', 'Search'];
  for (const [suffix, name, cat] of REFERRERS) {
    if (host === suffix || host.endsWith('.' + suffix)) return [name, cat];
  }
  return null;
}

function instagramDetail(params: URLSearchParams, refHost: string): string {
  const content = (params.get('utm_content') ?? '').toLowerCase();
  if (content.includes('bio')) return 'bio';
  if (content.includes('story')) return 'story';
  if (params.has('igsh') || params.has('igshid')) return 'shared link';
  if (refHost === 'l.instagram.com') return 'link shim';
  return '';
}

export function classify(pageUrl: string, referrer: string, ua: string, ownHosts: string[]): Attribution {
  let params: URLSearchParams;
  try {
    params = new URL(pageUrl).searchParams;
  } catch {
    params = new URLSearchParams();
  }
  const refHost = hostOf(referrer);
  const internal = !!refHost && ownHosts.includes(refHost);
  const clickIds = Object.keys(CLICK_IDS).filter((k) => params.has(k));
  const inAppHit = IN_APP.find(([re]) => re.test(ua));
  const inApp = inAppHit?.[1] ?? '';
  const campaign = clip(params.get('utm_campaign'));
  const refMatch = internal ? null : matchReferrer(refHost);

  const finish = (source: string, category: Category, signal: Attribution['signal'], detail = ''): Attribution => {
    if (source === 'Meta') source = inApp === 'Instagram' || refHost.includes('instagram') ? 'Instagram' : inApp === 'Threads' ? 'Threads' : 'Facebook';
    if (source === 'Instagram' && !detail) detail = instagramDetail(params, refHost);
    if (!detail) detail = clip(params.get('utm_content') || params.get('utm_medium'), 30);
    return { source, category, detail, campaign, clickIds, inApp, signal };
  };

  // 1. Explicit tags
  const tag = clip(params.get('ref') || params.get('src') || params.get('source') || params.get('utm_source'), 40);
  if (tag) {
    const alias = SOURCE_ALIASES[tag.toLowerCase()];
    if (alias) return finish(alias[0], alias[1], 'tag');
    // Unknown tag: if it looks like a domain, try the referrer table
    const asRef = matchReferrer(tag.toLowerCase().replace(/^www\./, ''));
    if (asRef) return finish(asRef[0], asRef[1], 'tag');
    return finish(tag, 'Referral', 'tag');
  }

  // 2. Click IDs (paid click IDs win over organic ones like srsltid)
  if (clickIds.length) {
    const ordered = [...clickIds].sort((a, b) => Number(CLICK_IDS[a][1] !== 'Ads') - Number(CLICK_IDS[b][1] !== 'Ads'));
    const [name, cat] = CLICK_IDS[ordered[0]];
    return finish(name, cat, 'click-id');
  }

  // 3. In-app browser
  if (inAppHit && inApp !== 'Google App') return finish(inApp, inAppHit[2], 'in-app');

  // 4. Referrer
  if (refMatch) return finish(refMatch[0], refMatch[1], 'referrer', refHost.startsWith('l.') || refHost.startsWith('lm.') ? 'link shim' : '');
  if (internal) return finish('Internal', 'Internal', 'referrer');
  if (refHost) return finish(refHost, 'Referral', 'referrer');
  if (inApp === 'Google App') return finish('Google', 'Search', 'in-app', 'Google app');

  // 5. Nothing
  return finish('Direct', 'Direct', 'none');
}

export interface Device {
  device: 'Mobile' | 'Tablet' | 'Desktop';
  os: string;
  browser: string;
  bot: boolean;
}

export function parseUA(ua: string): Device {
  const bot = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|phantom|puppeteer|playwright|selenium/i.test(ua);
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tablet' : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Other';
  const inApp = IN_APP.find(([re]) => re.test(ua));
  const browser = inApp
    ? `${inApp[1]} app`
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /SamsungBrowser/.test(ua)
          ? 'Samsung'
          : /Firefox|FxiOS/.test(ua)
            ? 'Firefox'
            : /Brave/.test(ua)
              ? 'Brave'
              : /CriOS|Chrome\//.test(ua)
                ? 'Chrome'
                : /Safari/.test(ua)
                  ? 'Safari'
                  : 'Other';
  return { device, os, browser, bot };
}
