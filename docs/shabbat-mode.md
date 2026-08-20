# Shabbat Mode — technical specification

The site closes for Shabbat at candle lighting and reopens at havdalah, using the exact
times of each individual week. There is no weekly schedule and no fixed hour anywhere in
the logic except one deliberate emergency fallback, described at the end.

## Why exact times matter

Both boundaries move through the year. Measured values for 2026, Jerusalem:

| | Earliest | Latest | Spread |
|---|---|---|---|
| Candle lighting | 15:54 (Dec 4) | 19:08 (Jun 26) | 3 h 14 min |
| Havdalah | 17:14 (Nov 28) | 20:31 (Jun 27) | 3 h 17 min |

A few sample weeks: Jan 2 — 16:07, Mar 27 — 18:15, Jun 19 — 19:07, Sep 11 — 18:10,
Dec 25 — 16:01.

## Data source

Hebcal, one request per calendar year:

```
https://www.hebcal.com/hebcal?v=1&cfg=json&year=YYYY&month=x&geo=geoname&geonameid=281184&c=on&b=40&M=on&i=on
```

| Parameter | Meaning |
|---|---|
| `geonameid=281184` | Jerusalem — the whole country is counted by it |
| `b=40` | candle lighting 40 minutes before sunset |
| `M=on` | havdalah by nightfall, not a fixed number of minutes |
| `i=on` | Israeli holiday scheme |
| `month=x` | the entire year in a single request |
| `c=on` | include candle lighting and havdalah times |

Verified against the live API: HTTP 200, ~16 KB per year, `access-control-allow-origin: *`
(so a browser may call it directly), `cache-control: max-age=604800`. A year returns 52
`candles` + 52 `havdalah` + a few `zmanim` entries.

## Window extraction rules

Each `candles` entry is paired with the `havdalah` entry that follows it. A pair becomes a
closing window only when:

1. candle lighting falls on a **Friday** in Jerusalem, and
2. the pair is **no longer than 30 hours**.

Everything else in the feed is ignored. With the request above the feed contains only
Shabbat pairs (all 52 verified to fall on Fridays, lengths 25 h 15 min … 25 h 23 min), so
both rules act as guards against a malformed or changed feed rather than as filters.

**Jewish holidays do not close the site** — a decided product rule, not an oversight. Since
the request carries no holiday flags, no holiday candle lighting appears in the feed at all.

## Data file

Built by [`tools/build-shabbat.mjs`](../tools/build-shabbat.mjs) into `api/shabbat.json` and
served from that same path — `https://moraltogether.com/api/shabbat.json`. GitHub Pages
rewrites nothing, so the file has to sit exactly where the browser asks for it; there is no
backend and the JSON file in the repository plays the role of the windows table.

Measured on the first real build (2026 + 2027): 104 windows, 10.4 KB, every window starting on
a Friday in Jerusalem, lengths between 25 h 15 min and 25 h 24 min.

One window is knowingly absent from a two-year build: the Shabbat that starts on the last
Friday of the final year has its havdalah in the following year, so the pair cannot be closed
yet and the builder reports it as skipped. It appears as soon as the next year is fetched,
which the lazy refresh does about two months ahead of time.

```json
{
  "version": 1,
  "generated": "2026-08-18T13:40:00.000Z",
  "source": "hebcal",
  "params": { "geonameid": 281184, "b": 40, "M": "on", "i": "on", "c": "on" },
  "location": { "city": "Jerusalem", "tzid": "Asia/Jerusalem" },
  "coverage": { "from": "...", "until": "..." },
  "windows": [
    { "start": "2026-08-21T18:36:00+03:00", "end": "2026-08-22T19:53:00+03:00" }
  ]
}
```

Timestamps keep the offset Hebcal returns (`+02:00` in winter, `+03:00` in summer), so
daylight saving is handled by the data itself. All comparisons run on absolute instants,
which means the visitor's own time zone and locale never affect the result.

### Running the builder

```bash
node tools/build-shabbat.mjs                    # current year
node tools/build-shabbat.mjs --years 2026,2027  # two-year coverage
node tools/build-shabbat.mjs --out /tmp/x.json  # write elsewhere
```

The builder refuses to write a file with fewer than 45 windows per year, prints every pair
it skipped and why, and leaves the file untouched when the windows are unchanged — so a run
that finds nothing new produces no commit.

## Refresh policy

.github/workflows/shabbat-windows.yml runs every Sunday at 03:17 UTC, and can be started by
hand through `workflow_dispatch` (with a `force` input that skips the laziness check).

The run is lazy: `node tools/build-shabbat.mjs --lazy 60` looks at the last window's end and,
while the file reaches more than 60 days ahead, makes no request to Hebcal at all. Otherwise it
fetches this year and the next — two years of coverage, so the data does not run out with the
calendar — and the commit step fires only when the windows themselves changed.

The alert is the failed run itself: GitHub mails the repository owner, and a cron that quietly
stops working is the one realistic way this data can go stale. Verified settings: Actions
enabled, `main` unprotected, Pages building from `main` at the root, so a bot push redeploys
the file.

## How the client decides

Three sources, in order of trust:

1. `/api/shabbat.json` — our file, a year or more ahead. The normal path.
2. A direct Hebcal request from the browser, if the file is missing or unusable.
3. The sun's own position, computed in the browser — see below.

A successful load is cached in `localStorage`, so after one visit the device holds exact
times for a year even with no network.

Both requests abort after six seconds, and a watchdog ends the waiting phase whatever the network
does. Without them a request that never answers — a stalled connection rather than a failing one —
left the content hidden and the screen undrawn for as long as the visitor kept looking at a blank
page. That was found on production, on WebKit, by the QA suite.

On a first-ever visit the cache is empty and only the crude fallback can answer, which would
call a whole Friday afternoon Shabbat. So while the real times are still in flight the gate
hides the content but does not draw the screen: a visitor at 16:00 on a Friday never sees
"Closed for Shabbat" flash and vanish. If the data arrives and says the site is open, it simply
appears; if the data cannot be had at all, the screen follows.

The gate publishes its state on the root element as `data-shabbat`, one of `pending`, `closed`
or `open` — useful when checking behaviour on the live site, and the anchor the browser tests
wait on instead of guessing a delay.

The verdict is applied before first paint through an inline snippet in `<head>` that reads
the cached window and sets a class on `<html>` — the same technique the site already uses for
the dark theme. Without it the content would flash before the gate appears.

Closing is hard: a full-screen state, content unreachable, scroll and media stopped, and no
way for the visitor to dismiss it. The gate lifts itself at havdalah without a reload — a
timer is set to the exact boundary, plus a re-check when the tab regains focus in case the
device was asleep.

Known search engine crawlers skip the gate, so a Saturday crawl does not push pages down in
the results.

## The screen

A photograph of a Shabbat table — challah under its cover, the kiddush cup, a siddur and two lit
candles — with the logo, a greeting rather than a refusal, one line naming both edges of the
window, the opening time, the time remaining and a note that the clock is Jerusalem's.

The still is the first frame of `images/shabbat-loop.webm`, so when the loop is ready it replaces
the picture invisibly: measured difference 3.76 of 255, with 1.5% of pixels differing by more than
eight. The loop is 1280×720, ten seconds, 278 KB as VP9 and 345 KB as H.264.

The loop stays away where it is not welcome: a portrait phone, `prefers-reduced-motion`, Data
Saver, or a `2g`/`slow-2g` connection. Note that Chrome reports `effectiveType: 3g` on perfectly
good desktop links, so 3g deliberately does not count — treating it as slow suppressed the video
everywhere. The loop also pauses whenever the tab is hidden; the screen can stand for
twenty-five hours and there is no reason to decode video nobody is watching.

Phones get `images/shabbat-bg-mobile.jpg` instead, a portrait crop shown at **full width**: the
candles stand at 6% and 92% of that frame, so any horizontal crop cuts them off. Filling a
portrait screen with the landscape frame would keep about a quarter of its width.

The picture is left vivid — `saturate(1.12) contrast(1.05) brightness(1.06)` — and the shade
lives under the words instead: a soft edgeless pool, a faint vignette at the very edges, and a
stronger text shadow on phones, where the lines sit directly on a bright tablecloth. The scrim is
its own layer rather than a background gradient, or the video would cover it.

The screen is deliberately always dark and does not follow the site's light theme.

### Language on the screen

The site's own switcher is hidden behind the gate, so the screen carries three quiet buttons —
EN / עב / ΕΛ. A choice is written to the same `lang` key the site uses, so the site keeps it once
it opens, and the screen re-renders in place: heading, sentence, labels, the units of the counter
and the direction of the text. Hebrew reads right to left while clock values stay left to right.

A first visit with no stored choice follows the browser: Hebrew or Greek if it asks for them,
English otherwise. This needs the early `<head>` snippet, which captures the stored language
**before** the site's own i18n engine runs — that engine writes `en` into `localStorage` on every
load, which would otherwise look like a deliberate choice. The site itself now follows the
browser in the same way, and stores a language only when the visitor picks one.

## The third source: the sun itself

When the file, the direct Hebcal request and the cache are all unavailable — realistically a
first visit on a broken network — the gate computes the times instead of guessing them. NOAA's
solar position equations, about fifty lines, no network and no dependencies: sunset for
Jerusalem's coordinates, candle lighting forty minutes before it, havdalah when the sun reaches
8.5° below the horizon. Those are the same `b=40` and `M=on` that the Hebcal request asks for.

**The elevation must not be applied.** Hebcal reports Jerusalem's 786 m in its payload, and
textbook practice would add a horizon-dip correction of 0.973°. Computing both variants against a
full year shows the no-elevation form agreeing with Hebcal within a minute, while the
dip-corrected form is 4 to 6 minutes off every week. Hebcal does not use elevation here, so
neither do we — otherwise the two sources would argue with each other.

Measured in the browser against Hebcal's own answers, three separate years:

| Year | Candle lighting, worst | Havdalah, worst | Mean |
|---|---|---|---|
| 2026 | 1.28 min | 0.73 min | 0.5 / 0.3 min |
| 2027 | 1.35 min | 0.85 min | 0.6 / 0.3 min |
| 2029 | 1.25 min | 0.80 min | 0.5 / 0.3 min |

A fixed window survives in exactly one place: a `catch` around the computation, in case it ever
fails to produce a number. It should be unreachable, but an exception must not leave the site open
during Shabbat.

### A second opinion on the file

The same computation checks the file it is meant to replace. A disagreement of up to three minutes
is the formula's own error and the file wins. Beyond that the file is not trusted and the safe
side is taken: the earlier of the two starts, the later of the two ends. It closes silently and
says so in the console — a file whose parameters drifted, whose geonameid moved, or which was
assembled half-way would otherwise close the site at the wrong time with nothing to show for it.

A bug this found, which had been present from the first version: the fallback computed *Thursday*
for a Saturday instant, because the weekday offset already handles Saturday and a second manual
subtraction was applied on top. Until this was fixed, a Saturday with no data available would have
left the site open all day.

## QA

Two suites live outside this repository, in the team's internal notes, because they carry the
preview parameter this file must not publish:

- 36 checks on behaviour and appearance
- 31 checks on the awkward cases, runnable against production

Both drive real Google Chrome and WebKit, the engine Safari uses. What they cover: both edges of
a window to the second; six time zones from Jerusalem to Kiritimati, all agreeing; a device clock
two days forward, five days back and three minutes forward, each corrected against the server's
own `Date` header; truncated, empty, malformed and hostile data, including a 40-hour window and
one whose end precedes its start; a cache older than a year; a stalled network; the site closing
itself while the tab sits open; the loop's conditions and its pause on a hidden tab; the language
switcher and language detection across he-IL, el-GR and ru-RU; twelve presses of Tab never
reaching the hidden site; and `partnerships.html` in Hebrew.

Preview parameters are not written down here — see the internal notes. A page must not publish
instructions for opening itself during Shabbat.

Two lessons worth keeping. A clock cannot be faked to fast-forward this gate: an attempt to race
through twenty-five hours at two thousand times speed failed because the gate corrected itself
against the server, which is exactly what that correction is for. And production is slow enough
that fixed waits in tests produce false failures; the suites wait for `data-shabbat` to settle
instead.

External services are out of scope: the M1 Radio stream and Moral TV live on their own hosts
and keep running — only this site closes.

## Status

| # | Subtask | State |
|---|---------|-------|
| 1 | Hebcal parser → `api/shabbat.json` | **done** — 104 windows for 2026–2027 |
| 2 | GitHub Actions: weekly cron, lazy refresh, two-year coverage, failure alert | **done** |
| 3 | Client gate | **done** |
| 4 | Closing screen copy in EN / HE / GR | **done** — in `translations.js` |
| 5 | Closing screen: photograph, loop, countdown, language switch | **done** |
| 6 | QA | **done** — 36 + 31 checks, in Chrome and WebKit |
| 7 | Deploy to GitHub Pages and production check | **done** |
| 8 | Astronomical sunset fallback and JSON cross-check | **done** — worst error 1.35 min over three years |

All eight subtasks are complete and live on moraltogether.com.

Verified in Chromium against the local build, 15 checks: open at 18:35:30 and closed at
18:36:30 on Aug 21, still closed at 19:52 on Aug 22 and open at 19:54, scroll locked, the
screen naming 19:53 as the opening time, `partnerships.html` closing too, Googlebot passing
through, a primed cache closing the site with both data paths blocked, the fixed fallback
taking over when the file is broken and Hebcal unreachable, a device clock a day off not
leaving the site closed outside a window, and the gate lifting itself at havdalah with no
reload.
