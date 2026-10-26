#!/usr/bin/env node
// Builds api/shabbat.json — Israel's closures (Shabbat and Yom Tov) that the site gate reads
// first for a visitor in Israel. The path is also the public URL: GitHub Pages rewrites
// nothing, so the file has to sit exactly where the browser asks for it —
// https://moraltogether.com/api/shabbat.json.
//
// The rules are the gate's own, from shabbat-core.js (Maxim, 26.10.2026): close 30 minutes
// before sunset, open 30 minutes after nightfall, Yom Tov included (one day in Israel), a
// festival next to Shabbat is one closure. Source: Hebcal, Jerusalem's coordinates, one
// request per calendar year:
//   b=30   candle lighting 30 minutes before sunset — our closing time
//   M=on   havdalah by nightfall; 30 minutes are added to it here
//   maj=on the major holidays, so festival candle lighting and havdalah come too
//   i=on   the Israeli calendar
// Each year is checked against the gate's own computation of the sun before it is written:
// a different number of closures, or one more than ten minutes away, fails the run.
//
// Usage:
//   node tools/build-shabbat.mjs                  # this year and the next
//   node tools/build-shabbat.mjs --lazy 60        # skip entirely if 60 days are covered
//   node tools/build-shabbat.mjs --years 2026,2027
//   node tools/build-shabbat.mjs --out /tmp/x.json
//
// Two things keep the repository quiet. With --lazy the script makes no request at
// all while the file already covers the horizon, and in every case the file is
// rewritten only when the windows themselves change.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// shabbat-core.js is a browser script declaring `var ShabbatCore`; run it and take the object.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const Core = new Function(`${readFileSync(join(ROOT, 'shabbat-core.js'), 'utf8')}; return ShabbatCore;`)();
const REGION = Core.regionForZone('Asia/Jerusalem');

const MIN_WINDOWS_PER_YEAR = 50;    // a year has 54 in Israel; fewer means the feed is broken
const AGREE_MINUTES = 10;           // the gate's own tolerance
const FORMAT_VERSION = 2;

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 || !args[i + 1] ? fallback : args[i + 1];
};

const outPath = readArg('out', 'api/shabbat.json');
const lazyDays = Number(readArg('lazy', '0'));

// Default horizon is two years: this one and the next. Keeping the next year in the
// file is what makes a broken cron survivable — coverage does not end with the year.
const thisYear = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
}).format(new Date()));

const years = readArg('years', `${thisYear},${thisYear + 1}`)
    .split(',')
    .map(y => Number(y.trim()))
    .filter(y => Number.isInteger(y) && y > 2000 && y < 2200);

if (!years.length) fail('No valid years given. Example: --years 2026,2027');
if (!Number.isFinite(lazyDays) || lazyDays < 0) fail('--lazy takes a number of days, e.g. --lazy 60');

function fail(message) {
    console.error(`build-shabbat: ${message}`);
    process.exit(1);
}

async function fetchYear(year) {
    const res = await fetch(Core.hebcalUrl(REGION, year), { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Hebcal returned HTTP ${res.status} for ${year}`);
    const body = await res.json();
    if (!Array.isArray(body?.items)) throw new Error(`Hebcal payload for ${year} has no items`);
    return body;
}

// The Hebcal closures of one year, checked one by one against the sun.
function checkedWindows(year, payload) {
    const windows = Core.parseHebcalWindows(payload);
    const from = Date.UTC(year, 0, 1);
    const to = Date.UTC(year + 1, 0, 1);
    const inYear = windows.filter((w) => w.startsAt >= from && w.startsAt < to);
    /* Up to Hebcal's last closure: one that starts on the last days of December ends next
       year, and that year's answer has its havdalah (the gate's computation covers it). */
    const last = inYear.length ? inYear[inYear.length - 1].startsAt : from;
    const mine = (Core.computedWindows(REGION, from, to) ?? []).filter((w) => w.startsAt >= from && w.startsAt <= last + 60 * 60000);
    if (inYear.length !== mine.length) {
        fail(`${year}: Hebcal has ${inYear.length} closures, the computation ${mine.length}`);
    }
    inYear.forEach((w, i) => {
        const apart = Math.max(Math.abs(w.startsAt - mine[i].startsAt), Math.abs(w.endsAt - mine[i].endsAt)) / 60000;
        if (apart > AGREE_MINUTES) {
            fail(`${year}: closure ${new Date(w.startsAt).toISOString()} is ${apart.toFixed(1)} min from the sun`);
        }
    });
    return inYear.map((w) => ({ start: isoInZone(w.startsAt), end: isoInZone(w.endsAt) }));
}

// "2026-10-30T16:21:00+02:00": Israel's wall clock with its offset, as Hebcal writes it, so the
// file stays readable by a person.
function isoInZone(ms) {
    const parts = {};
    for (const p of new Intl.DateTimeFormat('en-US', {
        timeZone: REGION.zone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms))) parts[p.type] = p.value;
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    const offset = Math.round((wall - ms) / 60000);
    const sign = offset < 0 ? '-' : '+';
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const mm = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${parts.year}-${parts.month}-${parts.day}T${String(+parts.hour % 24).padStart(2, '0')}:${parts.minute}:${parts.second}${sign}${hh}:${mm}`;
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

// Lazy refresh: while the file still covers the horizon there is nothing to ask Hebcal.
// The check looks at the last window's end, so a file that simply stops mid-year is
// caught too, not only a missing one.
if (lazyDays > 0) {
    const covered = readExisting(outPath)?.coverage?.until;
    const horizon = Date.now() + lazyDays * 86400000;
    if (covered && Date.parse(covered) >= horizon) {
        console.log(`covered: ${outPath} reaches ${covered}, more than ${lazyDays} days ahead — no request made`);
        process.exit(0);
    }
    console.log(covered
        ? `stale: ${outPath} reaches only ${covered}, less than ${lazyDays} days ahead — fetching`
        : `missing: no usable ${outPath} — fetching`);
}

const perYear = [];

for (const year of years) {
    const payload = await fetchYear(year).catch(err => fail(err.message));
    const windows = checkedWindows(year, payload);
    if (windows.length < MIN_WINDOWS_PER_YEAR) {
        fail(`${year}: only ${windows.length} closures parsed, expected at least ${MIN_WINDOWS_PER_YEAR}`);
    }
    console.log(`${year}: ${windows.length} closures (${windows[0].start} … ${windows.at(-1).end})`);
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
    rules: Core.SHABBAT_CORE_VERSION,
    zone: REGION.zone,
    params: { latitude: REGION.lat, longitude: REGION.lon, b: Core.MARGIN_MINUTES, M: 'on', maj: 'on', i: 'on', c: 'on' },
    note: 'start = candle lighting (sunset - 30 min); end = havdalah (nightfall) + 30 min; Shabbat and Yom Tov',
    coverage: { from: windows[0].start, until: windows.at(-1).end },
    windows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`updated: ${outPath} — ${windows.length} windows, covered until ${output.coverage.until}`);
