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
3. The emergency fallback below.

A successful load is cached in `localStorage`, so after one visit the device holds exact
times for a year even with no network.

The verdict is applied before first paint through an inline snippet in `<head>` that reads
the cached window and sets a class on `<html>` — the same technique the site already uses for
the dark theme. Without it the content would flash before the gate appears.

Closing is hard: a full-screen state, content unreachable, scroll and media stopped, and no
way for the visitor to dismiss it. The gate lifts itself at havdalah without a reload — a
timer is set to the exact boundary, plus a re-check when the tab regains focus in case the
device was asleep.

Known search engine crawlers skip the gate, so a Saturday crawl does not push pages down in
the results.

## The emergency fallback

Used only when the JSON file, the direct Hebcal request and the cache are all unavailable at
once — realistically a first-ever visit on a broken network:

```
Friday 15:30 → Saturday 21:00, Asia/Jerusalem
```

Deliberately crude in the safe direction: the site would rather close too much than stay open
during Shabbat. It is also imprecise by hours — in June real candle lighting is 19:08 — so it
is replaced in subtask 8 by an astronomical sunset computed in the browser from Jerusalem's
coordinates: candle lighting at sunset − 40 min, havdalah at nightfall (8.5° below the
horizon), no network and no dependencies needed.

The equations were validated against Hebcal's own answers for all 52 Shabbats of 2026 before
committing to this approach. Worst disagreement is one minute in both directions: candle
lighting matched to the minute on 42 of 52 weeks, havdalah on 40 of 52, the rest differing by
exactly one minute; mean absolute error is about half a minute.

One finding changes the implementation: **the elevation must not be applied.** Hebcal reports
Jerusalem's 786 m in the payload, and textbook practice would add a horizon-dip correction of
0.973° for it — but computing both variants shows the no-elevation form agrees with Hebcal
within a minute while the dip-corrected form is 4 to 6 minutes off across all 52 weeks. Hebcal
does not use elevation here, so neither do we; otherwise the two sources would argue.

The computation also serves as a sanity check on the JSON. Disagreement under 3 minutes is
normal formula error and the file wins. Beyond that the safe side is taken: the earlier of the
two for closing, the later for opening.

## QA

Simulation happens through URL parameters, never persisted to `localStorage`:

```
?shabbat=on                     force the gate open state
?shabbat=off                    force the site open
?shabbat=2026-09-04T19:00       shift the clock to that moment — time keeps running from
                                there, so a boundary can be watched live
```

Cases to cover: one minute before and after each boundary, offline, corrupted or truncated
JSON, stale cache, a device clock set wrong, mobile layouts, and `partnerships.html` as well
as the home page.

External services are out of scope: the M1 Radio stream and Moral TV live on their own hosts
and keep running — only this site closes.

## Status

| # | Subtask | State |
|---|---------|-------|
| 1 | Hebcal parser → `api/shabbat.json` | **done** — 104 windows for 2026–2027 |
| 2 | GitHub Actions: weekly cron, lazy refresh, two-year coverage, failure alert | **done** |
| 3 | Client gate | **done** — 15 browser checks pass |
| 4 | Closing screen copy in EN / HE / GR | not started |
| 5 | Closing screen: design, countdown, scroll and media lock | not started |
| 6 | QA | not started |
| 7 | Deploy to GitHub Pages and production check | not started |
| 8 | Astronomical sunset fallback and JSON cross-check (after launch) | not started |

The gate is live in the repository and closes both pages by the exact times; what is left for
subtasks 4 and 5 is the wording and the look of the screen, which is still a draft.

Verified in Chromium against the local build, 15 checks: open at 18:35:30 and closed at
18:36:30 on Aug 21, still closed at 19:52 on Aug 22 and open at 19:54, scroll locked, the
screen naming 19:53 as the opening time, `partnerships.html` closing too, Googlebot passing
through, a primed cache closing the site with both data paths blocked, the fixed fallback
taking over when the file is broken and Hebcal unreachable, a device clock a day off not
leaving the site closed outside a window, and the gate lifting itself at havdalah with no
reload.
