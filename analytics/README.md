# folio-analytics

A Cloudflare Worker that tracks where visitors to sajidbanday.me come from and keeps one Discord message updated as a live dashboard.

- The site sends one beacon per page load to `/_a/v` (`src/lib/beacon.ts` in the site). This route is the only path the Worker handles. Everything else on the domain goes straight to Pages.
- `src/classify.ts` works out the source in this order: your own tags (`?ref=`, `?src=`, `utm_source`), then platform click IDs (`fbclid`, `igsh`, `gclid`, `ttclid`, ...), then the in-app browser user agent (Instagram, Threads, LinkedIn, TikTok, ...), then `document.referrer`. A visit with none of these counts as Direct.
- Visits from sources listed in `NOTIFY_SOURCES` (default `Instagram`) also post a separate message, so Discord sends a push notification. Every visit alerts; only a repeat from the same visitor within 15 seconds (a double-fire) is skipped. Alerts go through a durable outbox in SQLite and are retried with backoff until Discord accepts them.
- If the Durable Object is unavailable (outage, free-tier quota), alerts are sent straight from the Worker so they still arrive.
- Visits from datacenter networks (Meta's link scanner, Google, AWS, and other clouds) are counted as bots, not visitors.
- A single SQLite-backed Durable Object (`Dashboard`) stores the visits. It waits for a few seconds of quiet, then edits the Discord message. If someone deletes the message, the next update posts a new one.

## Device detection

`src/devices.ts` extracts the phone and OS, and `src/models.ts` names Android models:

- **Instagram / Facebook in-app browsers** report exact hardware: `iPhone18,1`, or `samsung; SM-S918B; dm3q` on Android.
- **Chromium browsers and WebViews on Android** hide the model in the user agent (`Android 10; K`). The site's beacon reads it from User-Agent Client Hints instead, along with the real Android version.
- **Android model codes** are named with [Google Play's supported devices catalog](https://storage.googleapis.com/play_public/supported_devices.csv) (~54k devices, every brand that ships Play). `npm run build` downloads it (`scripts/build-catalog.mjs`) and bundles it into the Worker, so every deploy ships a fresh copy and lookups use no storage. If the download fails, the build fails and the previous deployment stays live. The device codename breaks ties when several phones share a code.
- **iPhones in Safari / Chrome** never expose the model. It is estimated from screen size and pixel ratio, filtered by which models support the reported iOS version. Safari 26+ freezes `OS 18_6` in its user agent, so the iOS version comes from `Version/26.x`.
- **iPads** in desktop mode claim to be a Mac; touch support gives them away.

## Tag your links

Add `?ref=<name>` to links you share. Known aliases include `ig`, `li`, `x`, `gh`, `wa`, `resume`, `qr`, `email`. Any other value shows up as its own source.

    https://sajidbanday.me/?ref=resume
    https://sajidbanday.me/?ref=li

## Deploy

Pushing to `main` deploys through Workers Builds (root directory `analytics`, build `npm run build`, deploy `npx wrangler deploy`). To deploy by hand: `npm run deploy`.

## Secrets

    npx wrangler secret put DISCORD_WEBHOOK_URL
    npx wrangler secret put ADMIN_TOKEN

## Admin

    curl -X POST https://sajidbanday.me/_a/admin/refresh -H "Authorization: Bearer $ADMIN_TOKEN"
    curl -X POST https://sajidbanday.me/_a/admin/reset   -H "Authorization: Bearer $ADMIN_TOKEN"   # wipe stats, keep message
    curl -X POST "https://sajidbanday.me/_a/admin/reset?message=new" -H "Authorization: Bearer $ADMIN_TOKEN"
    curl -X POST "https://sajidbanday.me/_a/admin/forget?vid=<visitor id>" -H "Authorization: Bearer $ADMIN_TOKEN"   # drop one visitor's visits
    curl "https://sajidbanday.me/_a/admin/recent?n=20" -H "Authorization: Bearer $ADMIN_TOKEN"   # latest raw visits
    curl "https://sajidbanday.me/_a/admin/lookup?model=SM-S918B" -H "Authorization: Bearer $ADMIN_TOKEN"   # test a model code
    curl https://sajidbanday.me/_a/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN"

## Preview the layout

    DISCORD_WEBHOOK_URL=... npm run demo
