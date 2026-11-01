import { DurableObject } from 'cloudflare:workers';
import { classify, parseUA } from './classify';
import { detectPhone, type ClientHints, type Screen } from './devices';
import { brandFallback, catalogSize, displayName, lookupModel } from './models';
import { fitDiscordLimits, recentLine, render, renderAlert, type Totals, type Visit } from './render';

export interface Env {
  DASHBOARD: DurableObjectNamespace<Dashboard>;
  DISCORD_WEBHOOK_URL: string;
  ADMIN_TOKEN?: string;
  ALLOWED_HOSTS: string;
  SITE_NAME: string;
  TIMEZONE_OFFSET_MINUTES: string;
  NOTIFY_SOURCES: string;
  VISIT_BUFFER: KVNamespace;
}

interface Beacon {
  url?: string;
  referrer?: string;
  vid?: string;
  returning?: boolean;
  path?: string;
  hints?: ClientHints;
  screen?: Screen;
}

const DAY = 86_400_000;
const RETENTION_DAYS = 400;
const UPDATE_DEBOUNCE_MS = 4_000;
const MAX_BODY = 4_096;
// Same visitor + source within this window is a double-fire, not a new visit to alert on.
const ALERT_DEDUPE_MS = 15_000;
const OUTBOX_MAX_ATTEMPTS = 12;

// Networks of crawlers and link scanners that run JavaScript (Meta's link
// checker, Google, Microsoft, cloud hosts). Residential and mobile networks,
// and iCloud Private Relay / WARP egress (Akamai, Fastly, Cloudflare), are not here.
const DATACENTER_ASNS = new Set([
  32934, // Meta
  15169, 396982, 19527, // Google
  8075, 8068, 8069, // Microsoft
  16509, 14618, // Amazon AWS
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH
  63949, // Linode
  20473, // Vultr
  45102, 37963, // Alibaba
  132203, 45090, // Tencent
  31898, // Oracle Cloud
  12876, // Scaleway
  51167, // Contabo
  9009, // M247
  212238, // Datacamp / CDN77
]);

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const stub = env.DASHBOARD.getByName('main');

    if (url.pathname === '/_a/v' && request.method === 'POST') {
      const hosts = env.ALLOWED_HOSTS.split(',');
      const origin = request.headers.get('Origin');
      try {
        if (origin && !hosts.includes(new URL(origin).hostname)) return new Response(null, { status: 403 });
      } catch {
        return new Response(null, { status: 403 });
      }

      const raw = await request.text();
      if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
      let body: Beacon;
      try {
        body = JSON.parse(raw);
        if (!body || typeof body !== 'object') throw new Error('not an object');
      } catch {
        return new Response(null, { status: 400 });
      }

      const ua = request.headers.get('User-Agent') ?? '';
      const pageUrl = s(body.url, 1024);
      // document.referrer from the page; the request's own Referer is always our site.
      const referrer = s(body.referrer, 512);
      const attribution = classify(pageUrl, referrer, ua, hosts);
      const device = parseUA(ua);
      const h = typeof body.hints === 'object' && body.hints ? body.hints : {};
      const hints: ClientHints = { model: s(h.model, 60), platform: s(h.platform, 20), platformVersion: s(h.platformVersion, 20) };
      const scr = typeof body.screen === 'object' && body.screen ? body.screen : {};
      const screen: Screen = { w: num(scr.w, 10000), h: num(scr.h, 10000), dpr: num(scr.dpr, 10), touch: num(scr.touch, 100) };
      const phone = detectPhone(ua, hints, screen);
      const cf = (request.cf ?? {}) as IncomingRequestCfProperties;
      const asn = typeof cf.asn === 'number' ? cf.asn : null;
      const vid = /^[\w-]{8,64}$/.test(body.vid ?? '') ? body.vid! : await fallbackVisitorId(request, ua);

      const visit: Visit = {
        ts: Date.now(),
        vid,
        return_visit: body.returning ? 1 : 0,
        source: attribution.source,
        category: attribution.category,
        detail: attribution.detail,
        campaign: attribution.campaign,
        click_ids: attribution.clickIds.join(','),
        in_app: attribution.inApp,
        country: (cf.country as string) ?? '',
        city: (cf.city as string) ?? '',
        region: (cf.region as string) ?? '',
        device: phone.os === 'iPadOS' ? 'Tablet' : device.device,
        os: phone.os || device.os,
        os_version: phone.osVersion,
        brand: phone.manufacturer === 'apple' ? 'Apple' : brandFallback(phone.manufacturer, phone.modelCode),
        model: phone.model,
        model_code: phone.modelCode,
        model_exact: phone.exact ? 1 : 0,
        codename: phone.codename,
        screen: screen.w && screen.h ? `${screen.w}x${screen.h}@${Math.round((screen.dpr ?? 1) * 100) / 100}` : '',
        browser: device.browser,
        referrer: referrer.slice(0, 200),
        path: s(body.path, 200) || '/',
        asn,
        as_org: s(cf.asOrganization, 80),
        ua: ua.slice(0, 400),
      };

      const isBot = device.bot || attribution.category === 'Internal' || (asn !== null && DATACENTER_ASNS.has(asn));
      ctx.waitUntil(
        stub.record(visit, isBot).catch(async (err) => {
          // Durable Object can't write (quota, outage): park the visit in KV, alert
          // straight from here, and redraw the dashboard from reads + the buffer.
          console.error('record failed, buffering visit in KV', err);
          if (isBot) return;
          resolveModel(visit);
          const key = `v:${String(visit.ts).padStart(15, '0')}:${crypto.randomUUID().slice(0, 8)}`;
          await Promise.allSettled([
            env.VISIT_BUFFER.put(key, JSON.stringify(visit), { expirationTtl: 30 * 86_400 }),
            wantsAlert(env, visit) ? sendDirectAlert(env, visit) : Promise.resolve(),
          ]);
          await stub.refresh().catch(() => patchDashboardFromBuffer(env).catch((e) => console.error('buffer dashboard patch failed', e)));
        }),
      );
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith('/_a/admin/')) {
      const auth = request.headers.get('Authorization');
      if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return new Response('unauthorized', { status: 401 });
      const action = url.pathname.slice('/_a/admin/'.length);
      if (action === 'refresh') return Response.json(await stub.refresh());
      if (action === 'reset') return Response.json(await stub.reset(url.searchParams.get('message') === 'new'));
      if (action === 'stats') return Response.json(await stub.stats());
      if (action === 'recent') return Response.json(await stub.recent(Number(url.searchParams.get('n')) || 20));
      if (action === 'forget') return Response.json(await stub.forget(url.searchParams.get('vid') ?? ''));
      if (action === 'lookup') return Response.json({ result: lookupModel(url.searchParams.get('model') ?? '', url.searchParams.get('device') ?? ''), catalogModels: catalogSize() });
      return new Response('not found', { status: 404 });
    }

    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function wantsAlert(env: Env, visit: Visit) {
  const sources = env.NOTIFY_SOURCES.split(',').map((x) => x.trim().toLowerCase());
  return sources.includes('*') || sources.includes(visit.source.toLowerCase());
}

async function sendDirectAlert(env: Env, visit: Visit) {
  const body = JSON.stringify(renderAlert(resolveModel(visit), { siteName: env.SITE_NAME }, 0, 0));
  const webhook = env.DISCORD_WEBHOOK_URL.replace(/\/$/, '');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) return;
      if (res.status !== 429 && res.status < 500) return console.error('direct alert rejected', res.status, await res.text());
      await scheduler.wait((Number(res.headers.get('Retry-After')) || 1) * 1000);
    } catch (err) {
      console.error('direct alert failed', err);
    }
  }
}

const BUFFER_MARK = ' ⏸';

// While the Durable Object is locked, keep the Discord dashboard moving: add the
// buffered visits to its "Latest visits" list and flag that totals are paused.
async function patchDashboardFromBuffer(env: Env) {
  const messageId = await env.VISIT_BUFFER.get('meta:message_id');
  if (!messageId) return;
  const list = await env.VISIT_BUFFER.list({ prefix: 'v:' });
  const buffered = (await Promise.all(list.keys.map((k) => env.VISIT_BUFFER.get<Visit>(k.name, 'json')))).filter((v): v is Visit => !!v).sort((a, b) => b.ts - a.ts);
  if (!buffered.length) return;

  const webhook = env.DISCORD_WEBHOOK_URL.replace(/\/$/, '');
  const res = await fetch(`${webhook}/messages/${messageId}`);
  if (!res.ok) throw new Error(`get dashboard: ${res.status}`);
  const msg = await res.json<{ embeds: { title?: string; description?: string }[] }>();
  const embeds = msg.embeds;
  const notice = `⏸ **Storage paused** · ${buffered.length} new visit${buffered.length === 1 ? '' : 's'} buffered, totals update after the daily reset (05:30 IST)`;

  const header = embeds[0];
  if (header) header.description = [notice, ...(header.description ?? '').split('\n').filter((l) => !l.startsWith('⏸'))].join('\n');
  const recent = embeds.find((e) => e.title?.includes('Latest visits'));
  if (recent) {
    const older = (recent.description ?? '').split('\n').filter((l) => l && !l.endsWith(BUFFER_MARK) && !l.startsWith('_'));
    recent.description = [...buffered.slice(0, 10).map((v) => recentLine(v) + BUFFER_MARK), ...older].slice(0, 10).join('\n');
  }
  const patch = await fetch(`${webhook}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fitDiscordLimits({ embeds })),
  });
  if (!patch.ok) throw new Error(`patch dashboard: ${patch.status} ${await patch.text()}`);
}

// Android model code -> "Samsung Galaxy S23 Ultra" via the bundled Play catalog.
function resolveModel(visit: Visit): Visit {
  if ((visit.os !== 'Android' && visit.os !== 'HarmonyOS') || !visit.model_code) return visit;
  const hit = lookupModel(visit.model_code, visit.codename ?? '');
  if (hit) {
    visit.brand = hit.brand || visit.brand;
    visit.model = displayName(hit.brand, hit.name);
  } else if (visit.brand && !visit.model_code.toLowerCase().startsWith(visit.brand.toLowerCase())) {
    visit.model = `${visit.brand} ${visit.model_code}`;
  }
  return visit;
}

// Visitors without localStorage (private mode, blocked storage) get a
// daily-rotating hash of IP + UA so they still count as one visitor per day.
async function fallbackVisitorId(request: Request, ua: string) {
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}|${ua}`));
  return 'h-' + [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class Dashboard extends DurableObject<Env> {
  private sql: SqlStorage;
  private recentHits = new Map<string, number[]>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // Only run DDL when something is missing: when writes are blocked (free-tier
    // quota) the object must still start so the dashboard can be read.
    const tables = new Set(this.sql.exec<{ name: string }>(`SELECT name FROM sqlite_master WHERE type IN ('table', 'index')`).toArray().map((r) => r.name));
    const ddl: [string, string][] = [
      ['visits', `CREATE TABLE visits (
        ts INTEGER NOT NULL, vid TEXT, return_visit INTEGER, source TEXT, category TEXT, detail TEXT,
        campaign TEXT, click_ids TEXT, in_app TEXT, country TEXT, city TEXT, region TEXT,
        device TEXT, os TEXT, browser TEXT, referrer TEXT, path TEXT
      )`],
      ['visits_ts', 'CREATE INDEX visits_ts ON visits(ts)'],
      ['bots', 'CREATE TABLE bots (ts INTEGER NOT NULL)'],
      ['meta', 'CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)'],
      ['alerts', 'CREATE TABLE alerts (vid TEXT NOT NULL, source TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (vid, source))'],
      ['outbox', 'CREATE TABLE outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT)'],
    ];
    for (const [name, sql] of ddl) if (!tables.has(name)) this.sql.exec(sql);
    // Columns added after the first release.
    const existing = new Set(this.sql.exec<{ name: string }>('PRAGMA table_info(visits)').toArray().map((c) => c.name));
    const added: [string, string][] = [
      ['os_version', 'TEXT'], ['brand', 'TEXT'], ['model', 'TEXT'], ['model_code', 'TEXT'], ['model_exact', 'INTEGER'],
      ['screen', 'TEXT'], ['codename', 'TEXT'], ['asn', 'INTEGER'], ['as_org', 'TEXT'], ['ua', 'TEXT'],
    ];
    for (const [col, type] of added) if (!existing.has(col)) this.sql.exec(`ALTER TABLE visits ADD COLUMN ${col} ${type}`);
    // The device catalog used to live in SQLite; it is bundled now.
    if (tables.has('models')) this.tryWrite(() => this.sql.exec('DROP TABLE models'));
  }

  // ---- recording -------------------------------------------------------------

  async record(visit: Visit, isBot: boolean) {
    if (isBot) {
      this.sql.exec('INSERT INTO bots (ts) VALUES (?)', visit.ts);
      return;
    }
    // Ignore floods: max 10 hits per visitor per minute.
    const hits = (this.recentHits.get(visit.vid) ?? []).filter((t) => t > visit.ts - 60_000);
    if (hits.length >= 10) return;
    hits.push(visit.ts);
    this.recentHits.set(visit.vid, hits);
    if (this.recentHits.size > 5000) this.recentHits.clear();

    resolveModel(visit);

    const cols = Object.keys(visit);
    this.sql.exec(`INSERT INTO visits (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...Object.values(visit));

    this.queueAlert(visit);
    if (!this.getMeta('dash_due')) this.setMeta('dash_due', String(Date.now() + UPDATE_DEBOUNCE_MS));
    await this.schedule();
  }

  // ---- alerts (durable outbox, retried until Discord accepts) -------------------

  private queueAlert(visit: Visit) {
    const sources = this.env.NOTIFY_SOURCES.split(',').map((x) => x.trim().toLowerCase());
    if (!sources.includes(visit.source.toLowerCase()) && !sources.includes('*')) return;
    const prev = this.sql.exec<{ ts: number }>('SELECT ts FROM alerts WHERE vid = ? AND source = ?', visit.vid, visit.source).toArray()[0];
    if (prev && prev.ts > visit.ts - ALERT_DEDUPE_MS) return;
    this.sql.exec('INSERT INTO alerts (vid, source, ts) VALUES (?, ?, ?) ON CONFLICT(vid, source) DO UPDATE SET ts = excluded.ts', visit.vid, visit.source, visit.ts);

    const tz = (Number(this.env.TIMEZONE_OFFSET_MINUTES) || 0) * 60_000;
    const todayStart = Math.floor((visit.ts + tz) / DAY) * DAY - tz;
    const today = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE ts >= ?', todayStart).one().n;
    const mine = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE vid = ?', visit.vid).one().n;
    const body = JSON.stringify(renderAlert(visit, { siteName: this.env.SITE_NAME }, today, mine));
    this.sql.exec('INSERT INTO outbox (body, next_at) VALUES (?, ?)', body, Date.now());
  }

  private async flushOutbox() {
    const webhook = this.env.DISCORD_WEBHOOK_URL.replace(/\/$/, '');
    const due = this.sql.exec<{ id: number; body: string; attempts: number }>('SELECT id, body, attempts FROM outbox WHERE next_at <= ? ORDER BY id LIMIT 10', Date.now()).toArray();
    for (const item of due) {
      let error = '';
      let retryMs = 0;
      try {
        const res = await fetch(`${webhook}?wait=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: item.body });
        if (res.ok) {
          this.sql.exec('DELETE FROM outbox WHERE id = ?', item.id);
          this.setMeta('last_alert', JSON.stringify({ at: Date.now(), status: res.status }));
          continue;
        }
        error = `${res.status} ${(await res.text()).slice(0, 300)}`;
        if (res.status === 429) {
          retryMs = (Number(res.headers.get('Retry-After')) || 2) * 1000 + 250;
        } else if (res.status >= 400 && res.status < 500) {
          // Discord rejected the payload itself; retrying won't help.
          console.error('alert rejected', error);
          this.sql.exec('DELETE FROM outbox WHERE id = ?', item.id);
          this.setMeta('last_alert', JSON.stringify({ at: Date.now(), status: res.status, error }));
          continue;
        }
      } catch (err) {
        error = String(err);
      }
      const attempts = item.attempts + 1;
      if (attempts >= OUTBOX_MAX_ATTEMPTS) {
        console.error('alert dropped after retries', error);
        this.sql.exec('DELETE FROM outbox WHERE id = ?', item.id);
        continue;
      }
      const backoff = retryMs || Math.min(60 * 60_000, 2_000 * 2 ** attempts);
      this.sql.exec('UPDATE outbox SET attempts = ?, next_at = ?, last_error = ? WHERE id = ?', attempts, Date.now() + backoff, error, item.id);
      if (retryMs) break; // rate limited: stop this round
    }
  }

  // ---- scheduling --------------------------------------------------------------

  private async schedule() {
    const nextOutbox = this.sql.exec<{ t: number | null }>('SELECT MIN(next_at) AS t FROM outbox').one().t;
    const dashDue = Number(this.getMeta('dash_due') ?? 0) || Infinity;
    const target = Math.min(nextOutbox ?? Infinity, dashDue);
    if (!Number.isFinite(target)) return;
    const current = await this.ctx.storage.getAlarm();
    // Inside alarm() the running alarm can still be reported; treat past times as unset.
    if (current === null || current <= Date.now() || target < current) await this.ctx.storage.setAlarm(Math.max(target, Date.now()));
  }

  async alarm() {
    try {
      await this.flushOutbox();
      const dashDue = Number(this.getMeta('dash_due') ?? 0);
      if (dashDue && dashDue <= Date.now()) {
        const result = await this.publish();
        if (result.retryAfterMs) this.setMeta('dash_due', String(Date.now() + result.retryAfterMs));
        else this.sql.exec(`DELETE FROM meta WHERE k = 'dash_due'`);
      }
    } finally {
      await this.schedule();
    }
  }

  // ---- admin ---------------------------------------------------------------------

  async refresh() {
    return this.publish();
  }

  async stats() {
    return {
      totals: this.totals(Date.now()),
      messageId: this.getMeta('message_id'),
      outbox: this.sql.exec('SELECT id, attempts, next_at, last_error FROM outbox').toArray(),
      lastAlert: JSON.parse(this.getMeta('last_alert') ?? 'null'),
      catalogModels: catalogSize(),
      alarm: await this.ctx.storage.getAlarm(),
      dashDue: Number(this.getMeta('dash_due') ?? 0) || null,
    };
  }

  async recent(n: number) {
    return {
      visits: this.sql.exec('SELECT * FROM visits ORDER BY ts DESC LIMIT ?', Math.min(n, 200)).toArray(),
      alerts: this.sql.exec('SELECT * FROM alerts ORDER BY ts DESC LIMIT 20').toArray(),
    };
  }

  // Remove one visitor's rows (e.g. your own test visits) and refresh.
  async forget(vid: string) {
    this.sql.exec('DELETE FROM visits WHERE vid = ?', vid);
    this.sql.exec('DELETE FROM alerts WHERE vid = ?', vid);
    return this.publish();
  }

  async reset(newMessage: boolean) {
    this.sql.exec('DELETE FROM visits; DELETE FROM bots; DELETE FROM alerts;');
    if (newMessage) this.sql.exec(`DELETE FROM meta WHERE k = 'message_id'`);
    return this.publish();
  }

  // ---- dashboard -------------------------------------------------------------------

  private tryWrite(fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (err) {
      console.error('storage write failed', err);
      return false;
    }
  }

  // Visits parked in KV while SQLite writes were blocked. Moves them into
  // SQLite when possible; returns whatever is still only in KV.
  private async drainBuffer(): Promise<Visit[]> {
    const list = await this.env.VISIT_BUFFER.list({ prefix: 'v:' }).catch(() => null);
    if (!list?.keys.length) return [];
    const entries = (await Promise.all(list.keys.map(async (k) => [k.name, await this.env.VISIT_BUFFER.get<Visit>(k.name, 'json')] as const))).filter(
      (e): e is readonly [string, Visit] => !!e[1],
    );
    const moved = this.tryWrite(() =>
      this.ctx.storage.transactionSync(() => {
        for (const [, v] of entries) {
          const cols = Object.keys(v);
          this.sql.exec(`INSERT INTO visits (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...Object.values(v));
        }
      }),
    );
    if (!moved) return entries.map(([, v]) => v);
    await Promise.allSettled(entries.map(([k]) => this.env.VISIT_BUFFER.delete(k)));
    return [];
  }

  private getMeta(k: string): string | null {
    const row = this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0];
    return row?.v ?? null;
  }

  private setMeta(k: string, v: string) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
  }

  private totals(now: number): Totals {
    const all = this.sql.exec<{ views: number; visitors: number; since: number | null }>('SELECT COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors, MIN(ts) AS since FROM visits').one();
    const bots = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM bots WHERE ts >= ?', now - 30 * DAY).one();
    return { allViews: all.views, allVisitors: all.visitors, since: all.since ?? now, bots30d: bots.n };
  }

  private async publish(): Promise<{ ok: boolean; messageId?: string | null; status?: number; retryAfterMs?: number }> {
    const now = Date.now();
    this.tryWrite(() => {
      this.sql.exec('DELETE FROM visits WHERE ts < ?', now - RETENTION_DAYS * DAY);
      this.sql.exec('DELETE FROM bots WHERE ts < ?', now - 30 * DAY);
      this.sql.exec('DELETE FROM alerts WHERE ts < ?', now - ALERT_DEDUPE_MS);
    });

    const pending = await this.drainBuffer();
    const visits = (this.sql.exec('SELECT * FROM visits WHERE ts >= ? ORDER BY ts DESC', now - 30 * DAY).toArray() as unknown as Visit[])
      .concat(pending.filter((v) => v.ts >= now - 30 * DAY))
      .sort((a, b) => b.ts - a.ts);
    const totals = this.totals(now);
    if (pending.length) {
      const known = new Set(this.sql.exec<{ vid: string }>('SELECT DISTINCT vid FROM visits').toArray().map((r) => r.vid));
      totals.allViews += pending.length;
      totals.allVisitors += new Set(pending.map((v) => v.vid).filter((v) => !known.has(v))).size;
    }
    const payload = fitDiscordLimits(
      render(visits, totals, {
        siteName: this.env.SITE_NAME,
        siteUrl: `https://${this.env.SITE_NAME}`,
        tzOffsetMinutes: Number(this.env.TIMEZONE_OFFSET_MINUTES) || 0,
        now,
      }),
    );

    const webhook = this.env.DISCORD_WEBHOOK_URL.replace(/\/$/, '');
    const messageId = this.getMeta('message_id');
    let res: Response;
    try {
      if (messageId) {
        res = await fetch(`${webhook}/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // Message deleted in Discord: fall through and post a fresh one.
        if (res.status !== 404) return this.handle(res, messageId);
        this.sql.exec(`DELETE FROM meta WHERE k = 'message_id'`);
      }
      res = await fetch(`${webhook}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('discord unreachable', err);
      return { ok: false, messageId, retryAfterMs: 30_000 };
    }
    if (res.ok) {
      const msg = await res.clone().json<{ id: string }>();
      await this.env.VISIT_BUFFER.put('meta:message_id', msg.id).catch(() => {});
      this.tryWrite(() => this.setMeta('message_id', msg.id));
      return this.handle(res, msg.id);
    }
    return this.handle(res, null);
  }

  private async handle(res: Response, messageId: string | null) {
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 5;
      return { ok: false, status: 429, messageId, retryAfterMs: retryAfter * 1000 + 250 };
    }
    if (!res.ok) {
      console.error('discord error', res.status, await res.text());
      return { ok: false, status: res.status, messageId, retryAfterMs: res.status >= 500 ? 30_000 : undefined };
    }
    return { ok: true, status: res.status, messageId };
  }
}
