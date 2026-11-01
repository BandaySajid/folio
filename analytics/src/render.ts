// Turns raw visit rows into the Discord dashboard message.
// Kept free of Worker APIs so scripts/demo.ts can render the same payload.

export interface Visit {
  ts: number; // ms
  vid: string;
  return_visit: number; // 0 | 1
  source: string;
  category: string;
  detail: string;
  campaign: string;
  click_ids: string; // comma separated
  in_app: string;
  country: string; // ISO-2
  city: string;
  region: string;
  device: string;
  os: string;
  os_version: string | null;
  brand: string | null;
  model: string | null;
  model_code: string | null;
  model_exact: number | null;
  screen: string | null;
  codename: string | null;
  asn: number | null;
  as_org: string | null;
  ua: string | null;
  browser: string;
  referrer: string;
  path: string;
}

export interface Totals {
  allViews: number;
  allVisitors: number;
  bots30d: number;
  since: number; // ms of first recorded visit
}

export interface RenderOptions {
  siteName: string;
  siteUrl: string;
  tzOffsetMinutes: number;
  now: number;
}

const DAY = 86_400_000;
const ACCENT = 0x33ff99;
const SPARK = '▁▂▃▄▅▆▇█';

const SOURCE_ICON: Record<string, string> = {
  Instagram: '📸',
  Facebook: '📘',
  Threads: '🧵',
  LinkedIn: '💼',
  X: '𝕏',
  GitHub: '🐙',
  Google: '🔎',
  'Google Ads': '🔎',
  Bing: '🔎',
  DuckDuckGo: '🦆',
  YouTube: '▶️',
  Reddit: '👽',
  'Hacker News': '🟧',
  WhatsApp: '💬',
  Telegram: '✈️',
  Discord: '🎮',
  Slack: '💬',
  Gmail: '✉️',
  Email: '✉️',
  ChatGPT: '🤖',
  Claude: '🤖',
  Perplexity: '🤖',
  Gemini: '🤖',
  TikTok: '🎵',
  Snapchat: '👻',
  Direct: '🔗',
  Resume: '📄',
  'QR code': '🔳',
};
const icon = (s: string) => SOURCE_ICON[s] ?? '🌐';

const DEVICE_ICON: Record<string, string> = { Mobile: '📱', Desktop: '🖥️', Tablet: '📟' };
const OS_ICON: Record<string, string> = { iOS: '🍏', iPadOS: '🍏', macOS: '🍏', Android: '🤖', Windows: '🪟', Linux: '🐧', ChromeOS: '🌐' };
const osIcon = (os: string) => OS_ICON[os] ?? '💻';
// Model guessed from screen size (iPhones outside Instagram/Facebook).
const estimated = (v: Pick<Visit, 'model_exact' | 'model_code'>) => !v.model_exact && !!v.model_code?.includes('@');
const osLabel = (v: Pick<Visit, 'os' | 'os_version'>) => [v.os, v.os_version].filter(Boolean).join(' ');

// "Galaxy S23 Ultra · Android 14", "iPhone 14 Pro / 15 … (est.) · iOS 17.4", "macOS"
function deviceLabel(v: Visit, maxModel = 30) {
  const model = v.model ? trunc(v.model, maxModel) + (estimated(v) ? ' (est.)' : '') : '';
  return [model, osLabel(v)].filter(Boolean).join(' · ');
}

function flag(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc) || cc === 'XX' || cc === 'T1') return '🏳️';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (cc: string) => {
  if (!cc || cc === 'XX') return 'Unknown';
  if (cc === 'T1') return 'Tor';
  try {
    return regionNames?.of(cc) ?? cc;
  } catch {
    return cc;
  }
};

function countBy<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const uniq = (rows: Visit[]) => new Set(rows.map((r) => r.vid)).size;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
const unix = (ms: number) => Math.floor(ms / 1000);

function bar(n: number, max: number, width = 14): string {
  if (!max) return ''.padEnd(width, '·');
  const eighths = Math.round((n / max) * width * 8);
  const full = Math.floor(eighths / 8);
  const part = eighths % 8;
  const partial = part ? '▏▎▍▌▋▊▉'[part - 1] : '';
  return ('█'.repeat(full) + partial).padEnd(width, '·').slice(0, width);
}

function sparkline(values: number[]): string {
  const max = Math.max(...values);
  if (!max) return '▁'.repeat(values.length);
  return values.map((v) => (v ? SPARK[Math.min(7, Math.ceil((v / max) * 7))] : '▁')).join('');
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function sourceLabel(v: Pick<Visit, 'source' | 'detail'>) {
  return v.detail ? `${v.source} · ${v.detail}` : v.source;
}

export function recentLine(v: Visit) {
  const place = [v.city, v.country].filter(Boolean).join(', ') || 'Unknown';
  const via = v.in_app && v.in_app !== v.source ? ` via ${v.in_app}` : '';
  const tags = v.click_ids ? ` \`${v.click_ids.split(',')[0]}\`` : '';
  return `<t:${unix(v.ts)}:R> ${flag(v.country)} **${trunc(place, 28)}** · ${icon(v.source)} ${trunc(sourceLabel(v), 32)}${via}${tags} · ${osIcon(v.os)} ${deviceLabel(v, 24)}${v.return_visit ? ' · 🔁' : ''}`;
}

export function render(visits: Visit[], totals: Totals, opts: RenderOptions) {
  const { now, tzOffsetMinutes } = opts;
  const tz = tzOffsetMinutes * 60_000;
  const todayStart = Math.floor((now + tz) / DAY) * DAY - tz;

  const today = visits.filter((v) => v.ts >= todayStart);
  const d7 = visits.filter((v) => v.ts >= now - 7 * DAY);
  const d30 = visits.filter((v) => v.ts >= now - 30 * DAY);
  const live = visits.filter((v) => v.ts >= now - 5 * 60_000);
  const last = visits.reduce((m, v) => Math.max(m, v.ts), 0);

  // Last 24h by hour, last 14 days by day
  const hours = Array.from({ length: 24 }, (_, i) => visits.filter((v) => v.ts >= now - (24 - i) * 3_600_000 && v.ts < now - (23 - i) * 3_600_000).length);
  const days = Array.from({ length: 14 }, (_, i) => {
    const start = todayStart - (13 - i) * DAY;
    return visits.filter((v) => v.ts >= start && v.ts < start + DAY).length;
  });
  const peakDay = Math.max(...days);

  const header = {
    title: `📡  ${opts.siteName} · traffic`,
    url: opts.siteUrl,
    color: ACCENT,
    description: [
      live.length ? `🟢 **${uniq(live)} on site now**` : '⚪ nobody on site right now',
      last ? `Last visit <t:${unix(last)}:R>` : 'No visits yet',
      '',
      '```',
      `24h  ${sparkline(hours)}  ${hours.reduce((a, b) => a + b, 0)} views`,
      `14d  ${sparkline(days)}  peak ${peakDay}/day`,
      '```',
    ].join('\n'),
    fields: [
      { name: 'Today', value: `**${today.length}** views\n**${uniq(today)}** visitors`, inline: true },
      { name: 'Last 7 days', value: `**${d7.length}** views\n**${uniq(d7)}** visitors`, inline: true },
      { name: 'All time', value: `**${totals.allViews}** views\n**${totals.allVisitors}** visitors`, inline: true },
    ],
  };

  // Sources
  const sources = countBy(d30, (v) => v.source).slice(0, 10);
  const maxSrc = sources[0]?.[1] ?? 0;
  const sourceBlock = sources.length
    ? '```\n' + sources.map(([s, n]) => `${pad(s, 12)} ${bar(n, maxSrc)} ${String(n).padStart(4)}  ${String(pct(n, d30.length)).padStart(3)}%`).join('\n') + '\n```'
    : '_No visits in the last 30 days_';

  const categories = countBy(d30, (v) => v.category)
    .map(([c, n]) => `\`${c}\` ${pct(n, d30.length)}%`)
    .join(' · ');

  const detailed = countBy(d30, (v) => (v.detail || v.campaign ? `${icon(v.source)} ${sourceLabel(v)}${v.campaign ? ` · ${v.campaign}` : ''}` : ''))
    .slice(0, 6)
    .map(([s, n]) => `${trunc(s, 48)} — **${n}**`)
    .join('\n');

  const clickIds = countBy(
    d30.flatMap((v) => (v.click_ids ? v.click_ids.split(',') : [])).map((c) => ({ c })),
    (r) => r.c,
  )
    .slice(0, 8)
    .map(([c, n]) => `\`${c}\` ×${n}`)
    .join('  ');

  const sourcesEmbed = {
    title: '🧭  Where visitors come from · 30d',
    color: ACCENT,
    description: [sourceBlock, categories].filter(Boolean).join('\n'),
    fields: [
      ...(detailed ? [{ name: 'Tagged & detailed', value: detailed, inline: false }] : []),
      ...(clickIds ? [{ name: 'Click IDs seen', value: clickIds, inline: false }] : []),
    ],
  };

  // Audience
  const countries = countBy(d30, (v) => v.country)
    .slice(0, 6)
    .map(([c, n]) => `${flag(c)} ${countryName(c)} — **${n}**`)
    .join('\n');
  const cities = countBy(d30, (v) => (v.city ? `${v.city}${v.country ? `, ${v.country}` : ''}` : ''))
    .slice(0, 6)
    .map(([c, n]) => `${trunc(c, 26)} — **${n}**`)
    .join('\n');
  const devices = countBy(d30, (v) => v.device)
    .map(([d, n]) => `${DEVICE_ICON[d] ?? '❔'} ${d} ${pct(n, d30.length)}%`)
    .join('\n');
  const browsers = countBy(d30, (v) => v.browser)
    .slice(0, 5)
    .map(([b, n]) => `${b} ${pct(n, d30.length)}%`)
    .join('\n');
  const oses = countBy(d30, (v) => v.os)
    .slice(0, 5)
    .map(([o, n]) => `${osIcon(o)} ${o} ${pct(n, d30.length)}%`)
    .join('\n');
  const osVersions = countBy(d30, (v) => (v.os_version && (v.os === 'iOS' || v.os === 'Android') ? osLabel(v) : ''))
    .slice(0, 5)
    .map(([o, n]) => `${o} — **${n}**`)
    .join('\n');
  const phones = countBy(d30, (v) => (v.model && v.device !== 'Desktop' ? `${osIcon(v.os)} ${trunc(v.model, 34)}${estimated(v) ? ' ~' : ''}` : ''))
    .slice(0, 6)
    .map(([m, n]) => `${m} — **${n}**`)
    .join('\n');
  const returning = d30.filter((v) => v.return_visit).length;

  const audienceEmbed = {
    title: '🌍  Audience · 30d',
    color: ACCENT,
    fields: [
      { name: 'Countries', value: countries || '—', inline: true },
      { name: 'Cities', value: cities || '—', inline: true },
      { name: 'Devices', value: devices || '—', inline: true },
      { name: 'Browsers', value: browsers || '—', inline: true },
      { name: 'OS', value: oses || '—', inline: true },
      { name: 'Phones', value: phones || '—', inline: true },
      { name: 'OS versions', value: osVersions || '—', inline: true },
      {
        name: 'Visitors',
        value: d30.length ? `🆕 New ${pct(d30.length - returning, d30.length)}%\n🔁 Returning ${pct(returning, d30.length)}%\n🤖 Bots filtered ${totals.bots30d}` : '—',
        inline: true,
      },
    ],
  };

  // Recent feed
  const recent = [...visits]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10)
    .map((v) => recentLine(v))
    .join('\n');

  const recentEmbed = {
    title: '🕒  Latest visits',
    color: ACCENT,
    description: recent || '_Waiting for the first visitor…_',
    footer: { text: `Tracking since ${new Date(totals.since || now).toISOString().slice(0, 10)} · updates live` },
    timestamp: new Date(now).toISOString(),
  };

  return {
    username: `${opts.siteName} analytics`,
    embeds: [header, sourcesEmbed, audienceEmbed, recentEmbed],
    allowed_mentions: { parse: [] as string[] },
  };
}

// Discord rejects embeds over 6000 chars total; trim the recent feed if needed.
export function fitDiscordLimits<T extends { embeds: any[] }>(payload: T): T {
  const size = () => JSON.stringify(payload.embeds).length;
  const recent = payload.embeds[payload.embeds.length - 1];
  while (size() > 5800 && typeof recent.description === 'string' && recent.description.includes('\n')) {
    recent.description = recent.description.slice(0, recent.description.lastIndexOf('\n'));
  }
  return payload;
}

// A standalone message for a single visit, posted as a fresh message so
// Discord sends a push notification (edits to the dashboard don't).
export function renderAlert(v: Visit, opts: Pick<RenderOptions, 'siteName'>, visitsToday: number, visitorVisits: number) {
  const place = [v.city, v.region && v.region !== v.city ? v.region : '', countryName(v.country)].filter(Boolean).join(', ');
  const via = v.in_app ? `${v.in_app} in-app browser` : v.browser;
  return {
    username: `${opts.siteName} analytics`,
    content: `${icon(v.source)} New visit from **${v.source}**${v.detail ? ` (${v.detail})` : ''}`,
    embeds: [
      {
        color: ACCENT,
        fields: [
          { name: 'Location', value: `${flag(v.country)} ${place || 'Unknown'}`, inline: true },
          {
            name: 'Device',
            value: [
              `${osIcon(v.os)} **${v.model || v.device}**${estimated(v) ? ' _(estimated from screen)_' : ''}`,
              [
                v.brand && !(v.model ?? '').toLowerCase().startsWith(v.brand.toLowerCase()) && !/^(iPhone|iPad|Pixel)/.test(v.model ?? '') ? v.brand : '',
                v.model_code && v.model_code !== v.model && !estimated(v) ? `\`${v.model_code}\`` : '',
                v.screen ? `${v.screen.replace(/@.*/, '')} screen` : '',
              ]
                .filter(Boolean)
                .join(' · '),
              `${DEVICE_ICON[v.device] ?? ''} ${osLabel(v) || v.os} · ${via}`,
            ]
              .filter(Boolean)
              .join('\n'),
            inline: true,
          },
          { name: 'Visitor', value: visitorVisits > 1 ? `🔁 Visit #${visitorVisits} from this person` : v.return_visit ? '🔁 Returning' : '🆕 First visit', inline: true },
          ...(v.click_ids || v.campaign ? [{ name: 'Signals', value: [v.click_ids && v.click_ids.split(',').map((c) => `\`${c}\``).join(' '), v.campaign && `campaign \`${v.campaign}\``].filter(Boolean).join(' · '), inline: false }] : []),
        ],
        footer: { text: [visitsToday ? `Visit #${visitsToday} today` : '', v.as_org].filter(Boolean).join(' · ') || opts.siteName },
        timestamp: new Date(v.ts).toISOString(),
      },
    ],
    allowed_mentions: { parse: [] as string[] },
  };
}
