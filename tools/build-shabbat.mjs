#!/usr/bin/env node
// Builds api/shabbat.json — the table of Shabbat closing windows the site gate reads.
// The path is also the public URL: GitHub Pages rewrites nothing, so the file has to sit
// exactly where the browser asks for it — https://moraltogether.com/api/shabbat.json.
//
// Source: Hebcal, Jerusalem (geonameid 281184). One request per calendar year.
//   b=40  candle lighting 40 minutes before sunset
//   M=on  havdalah by nightfall, not a fixed number of minutes
//   i=on  Israeli holiday scheme
//   c=on  include candle lighting / havdalah times
//
// A window is a pair "candle lighting -> havdalah" where the candle lighting falls
// on a Friday in Jerusalem and the pair is no longer than MAX_WINDOW_HOURS. Anything
// else in the feed is ignored, so holidays never close the site.
//
// Usage:
//   node tools/build-shabbat.mjs                  # current year
//   node tools/build-shabbat.mjs --years 2026,2027
//   node tools/build-shabbat.mjs --out /tmp/x.json
//
// The file is rewritten only when the windows themselves change, so a run that
// finds nothing new leaves the repository untouched.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const GEONAMEID = 281184;           // Jerusalem — the whole country is counted by it
const CANDLES_MINUTES_BEFORE = 40;  // b=40
const MAX_WINDOW_HOURS = 30;
const MIN_WINDOWS_PER_YEAR = 45;    // a year has ~52; fewer means the feed is broken
const FORMAT_VERSION = 1;

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 || !args[i + 1] ? fallback : args[i + 1];
};

const outPath = readArg('out', 'api/shabbat.json');
const years = readArg('years', String(new Date().getUTCFullYear()))
    .split(',')
    .map(y => Number(y.trim()))
    .filter(y => Number.isInteger(y) && y > 2000 && y < 2200);

if (!years.length) fail('No valid years given. Example: --years 2026,2027');

function fail(message) {
    console.error(`build-shabbat: ${message}`);
    process.exit(1);
}

function hebcalUrl(year) {
    return 'https://www.hebcal.com/hebcal'
        + '?v=1&cfg=json'
        + `&year=${year}`
        + '&month=x'
        + '&geo=geoname'
        + `&geonameid=${GEONAMEID}`
        + '&c=on'
        + `&b=${CANDLES_MINUTES_BEFORE}`
        + '&M=on'
        + '&i=on';
}

async function fetchYear(year) {
    const url = hebcalUrl(year);
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Hebcal returned HTTP ${res.status} for ${year}`);
    const body = await res.json();
    if (!Array.isArray(body?.items)) throw new Error(`Hebcal payload for ${year} has no items`);
    return body;
}

// Weekday in Jerusalem, regardless of where this script runs.
const jerusalemWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
});

function isFridayInJerusalem(iso) {
    return jerusalemWeekday.format(new Date(iso)) === 'Fri';
}

// Pairs each candle lighting with the havdalah that follows it, then keeps only the
// pairs that really describe a Shabbat: Friday start, sane length.
function extractWindows(items) {
    const windows = [];
    const skipped = [];
    let pendingCandles = null;

    for (const item of items) {
        if (item.category === 'candles') {
            if (pendingCandles) skipped.push({ reason: 'candles without havdalah', at: pendingCandles.date });
            pendingCandles = item;
            continue;
        }
        if (item.category !== 'havdalah') continue;

        if (!pendingCandles) {
            skipped.push({ reason: 'havdalah without candles', at: item.date });
            continue;
        }

        const start = pendingCandles.date;
        const end = item.date;
        pendingCandles = null;

        const startMs = Date.parse(start);
        const endMs = Date.parse(end);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
            skipped.push({ reason: 'unparsable timestamp', at: `${start} -> ${end}` });
            continue;
        }

        const hours = (endMs - startMs) / 3600000;
        if (hours <= 0) {
            skipped.push({ reason: 'havdalah not after candles', at: `${start} -> ${end}` });
            continue;
        }
        if (hours > MAX_WINDOW_HOURS) {
            skipped.push({ reason: `window longer than ${MAX_WINDOW_HOURS}h`, at: `${start} -> ${end}` });
            continue;
        }
        if (!isFridayInJerusalem(start)) {
            skipped.push({ reason: 'candle lighting not on a Friday', at: start });
            continue;
        }

        windows.push({ start, end });
    }

    if (pendingCandles) skipped.push({ reason: 'candles without havdalah', at: pendingCandles.date });
    return { windows, skipped };
}

function mergeWindows(lists) {
    const byStart = new Map();
    for (const list of lists) {
        for (const w of list) byStart.set(w.start, w);
    }
    return [...byStart.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

function readExisting(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function sameWindows(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
}

const perYear = [];
let location = null;

for (const year of years) {
    const payload = await fetchYear(year).catch(err => fail(err.message));
    location ??= payload.location;

    const { windows, skipped } = extractWindows(payload.items);
    if (windows.length < MIN_WINDOWS_PER_YEAR) {
        fail(`${year}: only ${windows.length} windows parsed, expected at least ${MIN_WINDOWS_PER_YEAR}`);
    }

    console.log(`${year}: ${windows.length} windows (${windows[0].start} … ${windows.at(-1).end})`);
    for (const s of skipped) console.log(`  skipped — ${s.reason}: ${s.at}`);
    perYear.push(windows);
}

const windows = mergeWindows(perYear);
const existing = readExisting(outPath);

if (existing && sameWindows(existing.windows, windows)) {
    console.log(`unchanged: ${outPath} already holds these ${windows.length} windows`);
    process.exit(0);
}

const output = {
    version: FORMAT_VERSION,
    generated: new Date().toISOString(),
    source: 'hebcal',
    params: { geonameid: GEONAMEID, b: CANDLES_MINUTES_BEFORE, M: 'on', i: 'on', c: 'on' },
    location: {
        city: location?.city ?? 'Jerusalem',
        tzid: location?.tzid ?? 'Asia/Jerusalem',
        latitude: location?.latitude,
        longitude: location?.longitude,
        elevation: location?.elevation,
    },
    coverage: { from: windows[0].start, until: windows.at(-1).end },
    windows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`updated: ${outPath} — ${windows.length} windows, covered until ${output.coverage.until}`);
