# Shabbat Mode — technical specification

The site closes for Shabbat **and for Yom Tov** where the visitor is, from 30 minutes before
sunset until 30 minutes after nightfall, using the exact times of each week, and reopens by
itself.

Maxim's decisions of 26.10.2026 (the same rules as Stage of Stars):

| Question | Decision |
|---|---|
| Whose Shabbat | The visitor's: the place is the browser's time zone. No zone, or one we do not know → Israel. |
| Margin | Close **30 minutes before sunset**, open **30 minutes after nightfall** (sun 8.5° below the horizon). |
| Festivals | Yom Tov by place: one day in Israel, two elsewhere. Rosh Hashana (two days everywhere), Yom Kippur, the first day(s) of Sukkot, Shemini Atzeret (+ Simchat Torah abroad), the first and last day(s) of Pesach, Shavuot. Chol HaMoed, Purim, Chanukah and fasts stay open. A festival next to Shabbat is one closure. |
| When every source fails | Our own computation of the sun and the Hebrew calendar. |
| Licence | Own code, no GPL libraries. |

Until that day the site closed by Jerusalem's Shabbat for everybody, from candle lighting
(40 minutes before sunset) to havdalah, and festivals did not close it.

## The rules: `shabbat-core.js`

`shabbat-core.js` holds the rules: where a time zone is (a place for each of the 418 IANA zones
and 135 old names such as `Asia/Tel_Aviv`), sunset and nightfall (NOAA's equations), the Hebrew
calendar (the molad and the four postponements) and so the Yom Tov days, the closures, the
Hebcal request and its reading, and the check of data against the sun. It is generated from
Stage of Stars' `shared/shabbatCore.ts`, so both sites close by the same code:

```
# in the Stage of Stars repository
node scripts/export-shabbat-core.mjs <path to this repository>/shabbat-core.js
```

Never edit it here. It defines `window.ShabbatCore` and is loaded, deferred, right before
`shabbat-gate.js` (deferred scripts keep their order; see `src/partials/head-early.html`).

Measured against Hebcal for Jerusalem, Athens, Paris, New York and Melbourne, 2026–2027: the same
closures, festivals included, at most 1.6 minutes apart at either end.

## Data source

Hebcal, one request per calendar year and place:

```
https://www.hebcal.com/hebcal?v=1&cfg=json&year=YYYY&month=x&geo=pos&latitude=31.78&longitude=35.22&tzid=Asia/Jerusalem&c=on&b=30&M=on&maj=on&min=off&mod=off&nx=off&mf=off&ss=off&s=off&i=on
```

| Parameter | Meaning |
|---|---|
| `geo=pos`, `latitude`, `longitude`, `tzid` | the place of the visitor's time zone |
| `b=30` | candle lighting 30 minutes before sunset — our closing time |
| `M=on` | havdalah by nightfall; 30 minutes are added to it |
| `maj=on` | major holidays, so festival candle lighting and havdalah come too |
| `i=on` / `i=off` | Israeli calendar (one day of Yom Tov) in Israel, the diaspora one elsewhere |
| `month=x` | the entire year in a single request |

Hebcal answers with `access-control-allow-origin: *` (so a browser may call it directly) and
`cache-control: max-age=604800`.

## Closure rules

The first candle lighting opens a closure, the next havdalah ends it 30 minutes later. A second
candle lighting inside it (the second night of Yom Tov, Shabbat straight after a festival)
changes nothing. A closure longer than four days (a three-day Yom Tov and Shabbat) is a bad
answer and is dropped.

## Data file

Built by [`tools/build-shabbat.mjs`](../tools/build-shabbat.mjs) into `api/shabbat.json` and
served from that same path — `https://moraltogether.com/api/shabbat.json`. It holds **Israel's**
closures (version 2): `start` is candle lighting, `end` is havdalah + 30 minutes, both with
Israel's offset. The builder reads the rules from `shabbat-core.js` and checks every year against
the computation before writing: a different number of closures, or one more than ten minutes
from the sun, fails the run. 2026: 55 closures, 2027: 55.

```
node tools/build-shabbat.mjs                  # this year and the next
node tools/build-shabbat.mjs --lazy 60        # nothing at all while 60 days are covered
```

## Refresh policy

.github/workflows/shabbat-windows.yml runs every Sunday at 03:17 UTC, and can be started by
hand through `workflow_dispatch` (with a `force` input that skips the laziness check).

The run is lazy: `node tools/build-shabbat.mjs --lazy 60` looks at the last window's end and,
while the file reaches more than 60 days ahead, makes no request to Hebcal at all. Otherwise it
fetches this year and the next, and the commit step fires only when the closures changed. The
alert is the failed run itself: GitHub mails the repository owner.

## How the client decides

The place is the browser's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
Israel when there is none or `shabbat-core.js` does not know it.

Sources, in order:

1. **Israel:** `/api/shabbat.json`, read on every visit (small, our own server, and its `Date`
   header corrects a wrong device clock); Hebcal for Jerusalem if the file is missing or unusable.
   **Anywhere else:** Hebcal for the visitor's place, this year and the next, asked at most once a
   week per browser.
2. The copy cached in `localStorage` (`shabbat.v2`, with the zone it was made for; a different
   zone starts afresh), a year at most.
3. The computation in `shabbat-core.js`, which needs no network.

Every closure from 1 or 2 is checked against the computation: up to ten minutes apart is
rounding and the data stands; further apart the safe side is taken (earlier start, later end),
and a closure the computation has and the data lacks is added — a missing Yom Tov must not leave
the site open. Each closure is worked out on its own. Where a summer night never gets 8.5° dark
(Stockholm, Oslo, Helsinki in June), the closure ends at the darkest moment, solar midnight,
+ 30 minutes; where the sun does not set at all (polar day or night), it starts at local noon on
the eve. The visitor's own place and calendar are kept (audit 26.10.2026: handing such a region
to Israel opened Oslo hours before its own sunset).

If `shabbat-core.js` itself did not load, a crude window remains outside Israel (and in Israel
when nothing is stored): Friday 15:00 to Saturday 21:00 on the visitor's clock.

The device's clock is corrected against our own server for every visitor: Israel's by the
`Date` of `api/shabbat.json`, everybody else's by a `HEAD` request to the same file (Hebcal's
`Date` header cannot be read from another origin). While only that window answers and the data is
still in flight, the gate hides the content without drawing the screen, so a Friday afternoon
visitor does not see the screen flash and vanish.

Both requests abort after six seconds, and a watchdog ends the waiting phase whatever the network
does.

The gate publishes its state on the root element as `data-shabbat`, one of `pending`, `closed`
or `open` — useful when checking behaviour on the live site, and the anchor the browser tests
wait on instead of guessing a delay.

The verdict is applied before first paint through an inline snippet in `<head>` that reads
the cached closures and sets a class on `<html>` — the same technique the site already uses for
the dark theme. Without it the content would flash before the gate appears.

Closing is hard: a full-screen state, content unreachable, scroll and media stopped, and no
way for the visitor to dismiss it. The gate lifts itself at the end without a reload — a
timer is set to the exact boundary, plus a re-check when the tab regains focus in case the
device was asleep.

Known search engine crawlers skip the gate, so a Saturday crawl does not push pages down in
the results.

## The screen

A photograph of a Shabbat table — challah under its cover, the kiddush cup, a siddur and two lit
candles — with the logo, a greeting rather than a refusal, one line naming both edges of the
window, the opening time on the visitor's own clock and the time remaining. On a closure that
holds a Yom Tov the heading and the line speak of the festival ("Happy holiday!"); those two
lines of 26.10.2026 are machine copy waiting for Maxim or the owner (`shabbat_holiday_title`,
`shabbat_holiday_body`). The "Jerusalem time" line was removed with the change to regional
times.

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
a window to the second; six time zones from Jerusalem to Kiritimati (written when every zone
followed Jerusalem; since 26.10.2026 each zone has its own times, and those checks need updating); a device clock
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

| 9 | Regional times, festivals, 30-minute margins, shared rules with Stage of Stars (26.10.2026) | **built** — checked locally, see below; festival copy waits for approval |

Subtasks 1–8 are live on moraltogether.com.

Checked 26.10.2026 in Chromium against the local copy, with the browser's time zone set to each
place: Jerusalem closed at 16:21 on 30.10 and not at 16:20, Paris at 17:04 local and not at
17:02, New York open at that same moment and closed on Saturday until 19:05 local and open at
19:06; Pesach 5787 one day in Jerusalem (open on Friday 23.04 at noon) and merged with Shabbat in
Paris (closed until Saturday 22:17); Chol HaMoed Sukkot open; Yom Kippur closed with Hebcal and
the file blocked (the computation alone); the crude window with `shabbat-core.js` blocked as well;
phone and desktop, EN / HE / GR, the holiday greeting.

Before regional times:

Verified in Chromium against the local build, 15 checks: open at 18:35:30 and closed at
18:36:30 on Aug 21, still closed at 19:52 on Aug 22 and open at 19:54, scroll locked, the
screen naming 19:53 as the opening time, `partnerships.html` closing too, Googlebot passing
through, a primed cache closing the site with both data paths blocked, the fixed fallback
taking over when the file is broken and Hebcal unreachable, a device clock a day off not
leaving the site closed outside a window, and the gate lifting itself at havdalah with no
reload.
