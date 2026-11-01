# folio-analytics

A Cloudflare Worker that tracks where visitors to sajidbanday.me come from and keeps one Discord message updated as a live dashboard.

- The site sends one beacon per page load to `/_a/v` (`src/lib/beacon.ts` in the site). This route is the only path the Worker handles. Everything else on the domain goes straight to Pages.
- `src/classify.ts` works out the source in this order: your own tags (`?ref=`, `?src=`, `utm_source`), then platform click IDs (`fbclid`, `igsh`, `gclid`, `ttclid`, ...), then the in-app browser user agent (Instagram, Threads, LinkedIn, TikTok, ...), then `document.referrer`. A visit with none of these counts as Direct.
- Visits from sources listed in `NOTIFY_SOURCES` (default `Instagram`) also post a separate message, so Discord sends a push notification. Each visitor triggers at most one of these per source every 30 minutes.
- A single SQLite-backed Durable Object (`Dashboard`) stores the visits. It waits for a few seconds of quiet, then edits the Discord message. If someone deletes the message, the next update posts a new one.

## Tag your links

Add `?ref=<name>` to links you share. Known aliases include `ig`, `li`, `x`, `gh`, `wa`, `resume`, `qr`, `email`. Any other value shows up as its own source.

    https://sajidbanday.me/?ref=resume
    https://sajidbanday.me/?ref=li

## Secrets

    npx wrangler secret put DISCORD_WEBHOOK_URL
    npx wrangler secret put ADMIN_TOKEN

## Admin

    curl -X POST https://sajidbanday.me/_a/admin/refresh -H "Authorization: Bearer $ADMIN_TOKEN"
    curl -X POST https://sajidbanday.me/_a/admin/reset   -H "Authorization: Bearer $ADMIN_TOKEN"   # wipe stats, keep message
    curl -X POST "https://sajidbanday.me/_a/admin/reset?message=new" -H "Authorization: Bearer $ADMIN_TOKEN"
    curl -X POST "https://sajidbanday.me/_a/admin/forget?vid=<visitor id>" -H "Authorization: Bearer $ADMIN_TOKEN"   # drop one visitor's visits
    curl https://sajidbanday.me/_a/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN"

## Preview the layout

    DISCORD_WEBHOOK_URL=... npm run demo
