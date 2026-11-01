// Posts a dashboard rendered from fake visits so the layout can be previewed.
// Usage: DISCORD_WEBHOOK_URL=... npm run demo
import { fitDiscordLimits, render, type Visit } from '../src/render.ts';

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) throw new Error('DISCORD_WEBHOOK_URL is not set');

const now = Date.now();
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const profiles: Partial<Visit>[] = [
  { source: 'Instagram', category: 'Social', detail: 'bio', click_ids: 'fbclid', in_app: 'Instagram', device: 'Mobile', os: 'iOS', browser: 'Instagram app' },
  { source: 'Instagram', category: 'Social', detail: 'bio', click_ids: 'fbclid', in_app: 'Instagram', device: 'Mobile', os: 'Android', browser: 'Instagram app' },
  { source: 'Instagram', category: 'Social', detail: 'shared link', click_ids: 'igsh', in_app: 'Instagram', device: 'Mobile', os: 'iOS', browser: 'Instagram app' },
  { source: 'LinkedIn', category: 'Social', detail: '', click_ids: '', in_app: 'LinkedIn', device: 'Mobile', os: 'Android', browser: 'LinkedIn app' },
  { source: 'LinkedIn', category: 'Social', detail: '', click_ids: '', in_app: '', device: 'Desktop', os: 'Windows', browser: 'Chrome' },
  { source: 'GitHub', category: 'Dev', detail: '', click_ids: '', in_app: '', device: 'Desktop', os: 'macOS', browser: 'Chrome' },
  { source: 'X', category: 'Social', detail: '', click_ids: '', in_app: '', device: 'Mobile', os: 'iOS', browser: 'Safari' },
  { source: 'Google', category: 'Search', detail: '', click_ids: 'srsltid', in_app: '', device: 'Desktop', os: 'Linux', browser: 'Firefox' },
  { source: 'Direct', category: 'Direct', detail: '', click_ids: '', in_app: '', device: 'Desktop', os: 'macOS', browser: 'Safari' },
  { source: 'Resume', category: 'Referral', detail: '', campaign: 'job-apps', click_ids: '', in_app: '', device: 'Desktop', os: 'Windows', browser: 'Edge' },
  { source: 'WhatsApp', category: 'Messaging', detail: '', click_ids: '', in_app: '', device: 'Mobile', os: 'Android', browser: 'Chrome' },
  { source: 'ChatGPT', category: 'AI', detail: '', click_ids: '', in_app: '', device: 'Desktop', os: 'macOS', browser: 'Arc' },
];
const weights = [9, 6, 3, 5, 3, 4, 3, 2, 6, 2, 2, 1];
const places = [
  ['IN', 'Srinagar', 'Jammu and Kashmir'], ['IN', 'Srinagar', 'Jammu and Kashmir'], ['IN', 'Bengaluru', 'Karnataka'],
  ['IN', 'Delhi', 'Delhi'], ['US', 'San Francisco', 'California'], ['DE', 'Berlin', 'Berlin'],
  ['GB', 'London', 'England'], ['AE', 'Dubai', 'Dubai'], ['IN', 'Mumbai', 'Maharashtra'],
];
const weighted = profiles.flatMap((p, i) => Array(weights[i]).fill(p));

const visits: Visit[] = Array.from({ length: 140 }, (_, i) => {
  const p = pick(weighted);
  const [country, city, region] = pick(places);
  const ageMs = i < 3 ? i * 90_000 : Math.random() ** 2 * 30 * 86_400_000;
  return {
    ts: now - ageMs, vid: `v${Math.floor(Math.random() * 90)}`, return_visit: Math.random() < 0.25 ? 1 : 0,
    campaign: '', referrer: '', path: '/', country, city, region, os_version: null, brand: null, model: null, model_code: null, model_exact: null, screen: null, codename: null, asn: null, as_org: null, ua: null, ...p,
  } as Visit;
});

const payload = fitDiscordLimits(
  render(visits, { allViews: 412, allVisitors: 263, bots30d: 37, since: now - 64 * 86_400_000 }, {
    siteName: 'sajidbanday.me', siteUrl: 'https://sajidbanday.me', tzOffsetMinutes: 330, now,
  }),
);
payload.username = 'sajidbanday.me analytics (demo)';

const res = await fetch(`${webhook}?wait=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
console.log(res.status, res.ok ? 'demo posted' : await res.text());
