// Reports one page view to the analytics Worker (analytics/), which is routed
// at /_a/* on sajidbanday.me. Runs only in production builds on the real domain.

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'igshid', 'igsh', 'gclid', 'gbraid', 'wbraid', 'dclid', 'gad_source', 'srsltid',
  'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'rdt_cid', 'ScCid', 'epik', 'yclid', 'mc_cid', 'mc_eid',
  'ref', 'src', 'source',
];

function visitorId(): { vid?: string; returning: boolean } {
  try {
    let vid = localStorage.getItem('vid');
    const returning = !!vid;
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem('vid', vid);
    }
    return { vid, returning };
  } catch {
    return { returning: false };
  }
}

export function sendPageView() {
  if (!import.meta.env.PROD || !location.hostname.endsWith('sajidbanday.me')) return;

  const body = JSON.stringify({
    url: location.href,
    referrer: document.referrer,
    path: location.pathname,
    ...visitorId(),
  });
  const blob = new Blob([body], { type: 'application/json' });
  if (!navigator.sendBeacon?.('/_a/v', blob)) {
    fetch('/_a/v', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  }

  // Tidy the address bar so shared links don't carry tracking params forward.
  const url = new URL(location.href);
  if (TRACKING_PARAMS.some((p) => url.searchParams.has(p))) {
    TRACKING_PARAMS.forEach((p) => url.searchParams.delete(p));
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
}
