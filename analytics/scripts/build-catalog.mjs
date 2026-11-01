// Fetches Google Play's supported devices catalog and writes a compact
// model -> name map that is bundled into the Worker (src/generated/catalog.json).
// Runs on every build, so each deploy ships a fresh catalog. If the download
// fails the build fails, which keeps the previous deployment live.
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'https://storage.googleapis.com/play_public/supported_devices.csv';
const OUT = new globalThis.URL('../src/generated/catalog.json', import.meta.url);

const res = await fetch(URL);
if (!res.ok) throw new Error(`catalog download failed: HTTP ${res.status}`);
const text = new TextDecoder('utf-16le').decode(await res.arrayBuffer()).replace(/^﻿/, '');

const byModel = new Map();
const field = /"((?:[^"]|"")*)"/g;
let rows = 0;
for (const line of text.split(/\r?\n/)) {
  if (!line.startsWith('"')) continue;
  const [brand, name, device, model] = [...line.matchAll(field)].map((m) => m[1].replace(/""/g, '"').trim());
  if (!model) continue;
  rows++;
  const key = model.toLowerCase();
  const list = byModel.get(key) ?? [];
  if (!list.some((e) => e.brand === brand && e.name === name && e.device.toLowerCase() === device.toLowerCase())) list.push({ brand, name, device });
  byModel.set(key, list);
}
if (rows < 10_000) throw new Error(`catalog looks wrong: only ${rows} rows`);

// value: "brand\u0001name" for a single phone; several phones sharing a model
// code also carry their device codename: "brand\u0001name\u0001device\u0002...".
const out = {};
for (const [key, list] of byModel) {
  const names = new Set(list.map((e) => `${e.brand}\u0001${e.name}`));
  out[key] = names.size === 1 ? [...names][0] : list.map((e) => `${e.brand}\u0001${e.name}\u0001${e.device}`).join('\u0002');
}
mkdirSync(new globalThis.URL('.', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`catalog: ${rows} rows, ${byModel.size} model codes`);
