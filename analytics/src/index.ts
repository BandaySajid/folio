import { DurableObject } from 'cloudflare:workers';
import { classify, parseUA } from './classify';
import { fitDiscordLimits, render, type Totals, type Visit } from './render';

export interface Env {
  DASHBOARD: DurableObjectNamespace<Dashboard>;
  DISCORD_WEBHOOK_URL: string;
  ADMIN_TOKEN?: string;
  ALLOWED_HOSTS: string;
  SITE_NAME: string;
  TIMEZONE_OFFSET_MINUTES: string;
}

interface Beacon {
  url?: string;
  referrer?: string;
  vid?: string;
  returning?: boolean;
  path?: string;
}

const DAY = 86_400_000;
const RETENTION_DAYS = 400;
const UPDATE_DEBOUNCE_MS = 4_000;
const MAX_BODY = 4_096;

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const stub = env.DASHBOARD.getByName('main');

    if (url.pathname === '/_a/v' && request.method === 'POST') {
      const hosts = env.ALLOWED_HOSTS.split(',');
      const origin = request.headers.get('Origin');
      if (origin && !hosts.includes(new URL(origin).hostname)) return new Response(null, { status: 403 });

      const raw = await request.text();
      if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
      let body: Beacon;
      try {
        body = JSON.parse(raw);
      } catch {
        return new Response(null, { status: 400 });
      }

      const ua = request.headers.get('User-Agent') ?? '';
      const pageUrl = s(body.url, 1024);
      // document.referrer from the page; the request's own Referer is always our site.
      const referrer = s(body.referrer, 512) || '';
      const attribution = classify(pageUrl, referrer, ua, hosts);
      const device = parseUA(ua);
      const cf = (request.cf ?? {}) as IncomingRequestCfProperties;
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
        device: device.device,
        os: device.os,
        browser: device.browser,
        referrer: referrer.slice(0, 200),
        path: s(body.path, 200) || '/',
      };

      ctx.waitUntil(stub.record(visit, device.bot || attribution.category === 'Internal'));
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith('/_a/admin/')) {
      const auth = request.headers.get('Authorization');
      if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return new Response('unauthorized', { status: 401 });
      const action = url.pathname.slice('/_a/admin/'.length);
      if (action === 'refresh') return Response.json(await stub.refresh());
      if (action === 'reset') return Response.json(await stub.reset(url.searchParams.get('message') === 'new'));
      if (action === 'stats') return Response.json(await stub.stats());
      return new Response('not found', { status: 404 });
    }

    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

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
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS visits (
        ts INTEGER NOT NULL, vid TEXT, return_visit INTEGER, source TEXT, category TEXT, detail TEXT,
        campaign TEXT, click_ids TEXT, in_app TEXT, country TEXT, city TEXT, region TEXT,
        device TEXT, os TEXT, browser TEXT, referrer TEXT, path TEXT
      );
      CREATE INDEX IF NOT EXISTS visits_ts ON visits(ts);
      CREATE TABLE IF NOT EXISTS bots (ts INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
    `);
  }

  async record(visit: Visit, isBot: boolean) {
    if (isBot) {
      this.sql.exec('INSERT INTO bots (ts) VALUES (?)', visit.ts);
    } else {
      // Ignore floods: max 10 hits per visitor per minute.
      const hits = (this.recentHits.get(visit.vid) ?? []).filter((t) => t > visit.ts - 60_000);
      if (hits.length >= 10) return;
      hits.push(visit.ts);
      this.recentHits.set(visit.vid, hits);
      if (this.recentHits.size > 5000) this.recentHits.clear();

      const cols = Object.keys(visit);
      this.sql.exec(`INSERT INTO visits (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...Object.values(visit));
    }
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + UPDATE_DEBOUNCE_MS);
    }
  }

  async alarm() {
    const result = await this.publish();
    if (result.retryAfterMs) await this.ctx.storage.setAlarm(Date.now() + result.retryAfterMs);
  }

  async refresh() {
    return this.publish();
  }

  async stats() {
    const now = Date.now();
    return { totals: this.totals(now), messageId: this.getMeta('message_id') };
  }

  async reset(newMessage: boolean) {
    this.sql.exec('DELETE FROM visits; DELETE FROM bots;');
    if (newMessage) this.sql.exec(`DELETE FROM meta WHERE k = 'message_id'`);
    return this.publish();
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
    this.sql.exec('DELETE FROM visits WHERE ts < ?', now - RETENTION_DAYS * DAY);
    this.sql.exec('DELETE FROM bots WHERE ts < ?', now - 30 * DAY);

    const visits = this.sql.exec('SELECT * FROM visits WHERE ts >= ? ORDER BY ts DESC', now - 30 * DAY).toArray() as unknown as Visit[];
    const payload = fitDiscordLimits(
      render(visits, this.totals(now), {
        siteName: this.env.SITE_NAME,
        siteUrl: `https://${this.env.SITE_NAME}`,
        tzOffsetMinutes: Number(this.env.TIMEZONE_OFFSET_MINUTES) || 0,
        now,
      }),
    );

    const webhook = this.env.DISCORD_WEBHOOK_URL.replace(/\/$/, '');
    const messageId = this.getMeta('message_id');
    let res: Response;
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
    if (res.ok) {
      const msg = await res.clone().json<{ id: string }>();
      this.setMeta('message_id', msg.id);
      return this.handle(res, msg.id);
    }
    return this.handle(res, null);
  }

  private async handle(res: Response, messageId: string | null) {
    if (res.status === 429) {
      const body = await res.json<{ retry_after?: number }>().catch(() => ({ retry_after: 5 }));
      return { ok: false, status: 429, messageId, retryAfterMs: Math.ceil((body.retry_after ?? 5) * 1000) + 250 };
    }
    if (!res.ok) {
      console.error('discord error', res.status, await res.text());
      return { ok: false, status: res.status, messageId, retryAfterMs: res.status >= 500 ? 30_000 : undefined };
    }
    return { ok: true, status: res.status, messageId };
  }
}
