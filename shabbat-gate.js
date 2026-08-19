// Shabbat gate — closes the site at candle lighting, opens it at havdalah, by the exact
// times of each week. See docs/shabbat-mode.md for the full specification.
//
// Sources of truth, in order: api/shabbat.json (ours) -> Hebcal directly -> a deliberately
// crude fixed window, replaced by an astronomical computation in subtask 8. Everything is
// compared as absolute instants, so the visitor's own time zone never matters.

(function () {
    'use strict';

    var CACHE_KEY = 'shabbat.v1';
    var DATA_URL = 'api/shabbat.json';
    var HEBCAL_URL = 'https://www.hebcal.com/hebcal?v=1&cfg=json&month=x&geo=geoname'
        + '&geonameid=281184&c=on&b=40&M=on&i=on&year=';
    var TZ = 'Asia/Jerusalem';
    var MAX_WINDOW_MS = 30 * 3600 * 1000;
    var CACHE_MAX_AGE_MS = 400 * 24 * 3600 * 1000;   // a year plus slack
    var SAFETY_TICK_MS = 30 * 1000;                  // survives suspended timers
    var SKEW_ALERT_MS = 2 * 60 * 1000;

    // Fixed fallback, used only when the file, Hebcal and the cache are all unavailable.
    var FALLBACK_OPEN = { day: 5, hour: 15, minute: 30 };   // Friday 15:30 — closes early on purpose
    var FALLBACK_SHUT = { day: 6, hour: 21, minute: 0 };    // Saturday 21:00 — opens late on purpose

    // Crawlers announce themselves; headless Chrome is deliberately absent because that is
    // also what our own browser tests run as.
    var BOTS = /bot|crawler|crawling|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|applebot|duckduckbot|yandex|baiduspider|ia_archiver|lighthouse|chrome-lighthouse|google page speed/i;

    var COPY = {
        en: {
            title: 'Closed for Shabbat',
            body: 'The site rests from candle lighting until havdalah. We will be back right after Shabbat.',
            opens: 'Opens at',
            left: 'Time remaining'
        },
        he: {
            title: 'סגור בשבת',
            body: 'האתר נח מהדלקת נרות ועד ההבדלה. נחזור מיד במוצאי שבת.',
            opens: 'נפתח ב',
            left: 'זמן שנותר'
        },
        gr: {
            title: 'Κλειστά για το Σαμπάτ',
            body: 'Η ιστοσελίδα αναπαύεται από το άναμμα των κεριών έως το χαβντάλα. Επιστρέφουμε αμέσως μετά.',
            opens: 'Ανοίγει στις',
            left: 'Υπολειπόμενος χρόνος'
        }
    };

    var state = {
        windows: [],       // [[startMs, endMs], ...] ascending
        skewMs: 0,         // server clock minus device clock
        offsetMs: 0,       // clock shift for previewing a boundary; time still flows
        forced: null,      // 'closed' | 'open' when a preview pins the state
        closedUntil: null, // end of the window currently being served
        timer: null,
        countdown: null
    };

    // ---------------------------------------------------------------- time helpers

    function now() {
        return Date.now() + state.skewMs + state.offsetMs;
    }

    // Offset of Asia/Jerusalem at a given instant, in milliseconds.
    function tzOffsetMs(instant) {
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).formatToParts(new Date(instant));
        var v = {};
        parts.forEach(function (p) { v[p.type] = p.value; });
        var asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour % 24, +v.minute, +v.second);
        return asUtc - instant;
    }

    // Instant for a wall-clock moment in Jerusalem. Two refinements settle the DST edge.
    function jerusalemInstant(y, m, d, hour, minute) {
        var guess = Date.UTC(y, m - 1, d, hour, minute) - 2 * 3600 * 1000;
        for (var i = 0; i < 2; i++) {
            guess = Date.UTC(y, m - 1, d, hour, minute) - tzOffsetMs(guess);
        }
        return guess;
    }

    function jerusalemParts(instant) {
        var f = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ, hour12: false, weekday: 'short',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }).formatToParts(new Date(instant));
        var v = {};
        f.forEach(function (p) { v[p.type] = p.value; });
        var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        return {
            year: +v.year, month: +v.month, day: +v.day,
            hour: +v.hour % 24, minute: +v.minute, weekday: days[v.weekday]
        };
    }

    function localTimeLabel(instant) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: TZ, hour: '2-digit', minute: '2-digit'
        }).format(new Date(instant));
    }

    // ---------------------------------------------------------------- window sources

    function validWindow(pair) {
        return Array.isArray(pair) && pair.length === 2
            && isFinite(pair[0]) && isFinite(pair[1])
            && pair[1] > pair[0] && pair[1] - pair[0] <= MAX_WINDOW_MS;
    }

    function parsePayload(payload) {
        if (!payload || !Array.isArray(payload.windows)) return [];
        var out = [];
        payload.windows.forEach(function (w) {
            var pair = [Date.parse(w.start), Date.parse(w.end)];
            if (validWindow(pair)) out.push(pair);
        });
        return out.sort(function (a, b) { return a[0] - b[0]; });
    }

    // Hebcal's own feed, kept parseable by the same rules the builder uses.
    function parseHebcal(payload) {
        if (!payload || !Array.isArray(payload.items)) return [];
        var out = [];
        var pending = null;
        payload.items.forEach(function (item) {
            if (item.category === 'candles') { pending = item; return; }
            if (item.category !== 'havdalah' || !pending) return;
            var pair = [Date.parse(pending.date), Date.parse(item.date)];
            pending = null;
            if (validWindow(pair) && jerusalemParts(pair[0]).weekday === 5) out.push(pair);
        });
        return out.sort(function (a, b) { return a[0] - b[0]; });
    }

    function fallbackWindow(instant) {
        var p = jerusalemParts(instant);
        var midnight = jerusalemInstant(p.year, p.month, p.day, 0, 0);
        var friday = midnight + (FALLBACK_OPEN.day - p.weekday) * 86400000;
        // Saturday night still belongs to the window that opened on Friday.
        if (p.weekday === 6) friday -= 86400000;
        var fp = jerusalemParts(friday);
        var start = jerusalemInstant(fp.year, fp.month, fp.day, FALLBACK_OPEN.hour, FALLBACK_OPEN.minute);
        var sp = jerusalemParts(start + 86400000);
        var end = jerusalemInstant(sp.year, sp.month, sp.day, FALLBACK_SHUT.hour, FALLBACK_SHUT.minute);
        return validWindow([start, end]) ? [start, end] : null;
    }

    function activeWindow(instant) {
        for (var i = 0; i < state.windows.length; i++) {
            var w = state.windows[i];
            if (instant >= w[0] && instant < w[1]) return w;
            if (w[0] > instant) break;
        }
        if (state.windows.length) return null;
        var f = fallbackWindow(instant);
        return f && instant >= f[0] && instant < f[1] ? f : null;
    }

    function nextBoundary(instant) {
        var soonest = null;
        state.windows.forEach(function (w) {
            [w[0], w[1]].forEach(function (edge) {
                if (edge > instant && (soonest === null || edge < soonest)) soonest = edge;
            });
        });
        return soonest;
    }

    // ---------------------------------------------------------------- cache

    function readCache() {
        try {
            var raw = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (!raw || !Array.isArray(raw.w)) return [];
            if (!raw.fetched || Date.now() - raw.fetched > CACHE_MAX_AGE_MS) return [];
            return raw.w.filter(validWindow);
        } catch (e) {
            return [];
        }
    }

    function writeCache(windows) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ fetched: Date.now(), w: windows }));
        } catch (e) { /* private mode, quota — the gate still works for this visit */ }
    }

    // ---------------------------------------------------------------- screen

    function copy() {
        var lang = 'en';
        try { lang = localStorage.getItem('lang') || 'en'; } catch (e) { /* ignore */ }
        return COPY[lang] || COPY.en;
    }

    function buildScreen(endInstant) {
        var t = copy();
        var el = document.createElement('div');
        el.className = 'shabbat-gate';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', t.title);
        el.innerHTML =
            '<div class="shabbat-gate__card">'
            + '<div class="shabbat-gate__flame" aria-hidden="true"></div>'
            + '<h1 class="shabbat-gate__title"></h1>'
            + '<p class="shabbat-gate__body"></p>'
            + '<p class="shabbat-gate__opens"><span class="shabbat-gate__label"></span> '
            + '<time class="shabbat-gate__time"></time></p>'
            + '<p class="shabbat-gate__left"><span class="shabbat-gate__label"></span> '
            + '<span class="shabbat-gate__count"></span></p>'
            + '</div>';
        el.querySelector('.shabbat-gate__title').textContent = t.title;
        el.querySelector('.shabbat-gate__body').textContent = t.body;
        el.querySelectorAll('.shabbat-gate__label')[0].textContent = t.opens;
        el.querySelectorAll('.shabbat-gate__label')[1].textContent = t.left;
        el.querySelector('.shabbat-gate__time').textContent = localTimeLabel(endInstant);
        return el;
    }

    function renderCountdown(node, endInstant) {
        var left = Math.max(0, endInstant - now());
        var h = Math.floor(left / 3600000);
        var m = Math.floor((left % 3600000) / 60000);
        var s = Math.floor((left % 60000) / 1000);
        node.textContent = (h > 0 ? h + ':' : '')
            + (h > 0 ? String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    }

    function pauseMedia() {
        document.querySelectorAll('video, audio').forEach(function (m) {
            try { m.pause(); m.autoplay = false; } catch (e) { /* ignore */ }
        });
    }

    function close(endInstant) {
        if (state.closedUntil === endInstant && document.querySelector('.shabbat-gate')) return;
        state.closedUntil = endInstant;
        document.documentElement.classList.add('shabbat-closed');
        if (!document.body) return;   // pre-paint class is enough until the body exists

        var existing = document.querySelector('.shabbat-gate');
        if (existing) existing.remove();
        var screen = buildScreen(endInstant);
        document.body.appendChild(screen);
        pauseMedia();

        var count = screen.querySelector('.shabbat-gate__count');
        renderCountdown(count, endInstant);
        clearInterval(state.countdown);
        state.countdown = setInterval(function () { renderCountdown(count, endInstant); }, 1000);
    }

    function open() {
        state.closedUntil = null;
        document.documentElement.classList.remove('shabbat-closed');
        clearInterval(state.countdown);
        state.countdown = null;
        var screen = document.querySelector('.shabbat-gate');
        if (screen) screen.remove();
    }

    // ---------------------------------------------------------------- decision loop

    function evaluate() {
        if (state.forced === 'open') { open(); return; }

        var instant = now();
        if (state.forced === 'closed') {
            var w = activeWindow(instant);
            close(w ? w[1] : instant + 3600000);
            return;
        }

        var active = activeWindow(instant);
        if (active) close(active[1]);
        else open();

        clearTimeout(state.timer);
        var edge = active ? active[1] : nextBoundary(instant);
        if (edge) {
            // Timers are unreliable over long sleeps; cap the wait and let the tick re-check.
            var wait = Math.min(edge - instant + 1000, 6 * 3600 * 1000);
            state.timer = setTimeout(evaluate, Math.max(1000, wait));
        }
    }

    // ---------------------------------------------------------------- data loading

    function adopt(windows, source) {
        if (!windows.length) return false;
        state.windows = windows;
        writeCache(windows);
        evaluate();
        if (window.console && console.debug) console.debug('shabbat-gate: windows from ' + source, windows.length);
        return true;
    }

    function noteSkew(response) {
        var header = response.headers.get('date');
        if (!header) return;
        var serverMs = Date.parse(header);
        if (!isFinite(serverMs)) return;
        var skew = serverMs - Date.now();
        if (Math.abs(skew) > SKEW_ALERT_MS) {
            state.skewMs = skew;
            if (window.console && console.warn) {
                console.warn('shabbat-gate: device clock off by ' + Math.round(skew / 60000) + ' min, corrected');
            }
        }
    }

    function loadFromHebcal() {
        var year = jerusalemParts(now()).year;
        return fetch(HEBCAL_URL + year, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
            .then(function (payload) { adopt(parseHebcal(payload), 'hebcal'); })
            .catch(function () {
                if (!state.windows.length && window.console && console.warn) {
                    console.warn('shabbat-gate: no data at all, using the fixed fallback window');
                }
                evaluate();
            });
    }

    function loadData() {
        return fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                noteSkew(r);
                return r.json();
            })
            .then(function (payload) {
                if (!adopt(parsePayload(payload), 'api/shabbat.json')) throw new Error('no usable windows');
            })
            .catch(loadFromHebcal);
    }

    // ---------------------------------------------------------------- start

    // Preview switch for checking the gate on the live site. The parameter is deliberately
    // unremarkable and is documented outside this repository, so the site does not carry
    // instructions for opening itself during Shabbat. It is obscurity, not protection —
    // anyone reading this file finds it, and that is the accepted level.
    function readOverride() {
        var match = /[?&]mtp=([^&]+)/.exec(window.location.search);
        if (!match) return;
        var value = decodeURIComponent(match[1]);
        if (value === 'closed' || value === 'open') { state.forced = value; return; }
        var parsed = Date.parse(value);
        if (isFinite(parsed)) state.offsetMs = parsed - Date.now();
    }

    function start() {
        if (BOTS.test(navigator.userAgent || '')) {
            document.documentElement.classList.remove('shabbat-closed');
            return;
        }

        readOverride();
        state.windows = readCache();
        evaluate();
        loadData();

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) evaluate();
        });
        window.addEventListener('focus', evaluate);
        setInterval(evaluate, SAFETY_TICK_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
