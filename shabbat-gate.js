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
    var DATA_TIMEOUT_MS = 6000;      // a hung request must not leave the screen half-drawn

    // Third source, used when the file, Hebcal and the cache are all unavailable: the sun's own
    // position, computed here. Jerusalem's coordinates; the 786 m elevation is deliberately NOT
    // applied, because Hebcal does not apply it either and the two must not disagree.
    var LAT = 31.76904;
    var LON = 35.21633;
    var ZENITH_SUNSET = 90.833;      // refraction and the sun's own radius
    var ZENITH_NIGHTFALL = 98.5;     // 8.5 degrees below the horizon — what M=on means
    var CANDLES_BEFORE_MIN = 40;     // b=40
    var DISAGREEMENT_MS = 3 * 60000; // beyond this the file is not trusted

    // Last resort if the computation itself cannot produce a number. Unreachable in practice,
    // but an exception must not leave the site open during Shabbat.
    var CRUDE_OPEN = { hour: 15, minute: 30 };
    var CRUDE_SHUT = { hour: 21, minute: 0 };

    // Crawlers announce themselves; headless Chrome is deliberately absent because that is
    // also what our own browser tests run as.
    var BOTS = /bot|crawler|crawling|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|applebot|duckduckbot|yandex|baiduspider|ia_archiver|lighthouse|chrome-lighthouse|google page speed/i;

    // The screen normally speaks through translations.js, like the rest of the site. This copy
    // is the fallback for the case where that file did not load — the gate must never end up
    // showing an empty screen.
    var COPY = {
        en: {
            title: 'Shabbat Shalom',
            body: 'MoralTogether rests with Shabbat — from candle lighting until havdalah. We return as the stars come out.',
            opens: 'The site opens at',
            left: 'Time remaining',
            tz: 'Jerusalem time',
            h: 'h', m: 'min'
        },
        he: {
            title: 'שבת שלום',
            body: 'מורל טוגת\'ר שובת בשבת — מהדלקת נרות ועד ההבדלה. נחזור עם צאת הכוכבים.',
            opens: 'האתר נפתח בשעה',
            left: 'זמן שנותר',
            tz: 'שעון ירושלים',
            h: 'ש׳', m: 'ד׳'
        },
        gr: {
            title: 'Σαμπάτ Σαλόμ',
            body: 'Το MoralTogether αναπαύεται το Σάββατο — από το άναμμα των κεριών έως το χαβντάλα. Επιστρέφουμε με τα πρώτα αστέρια.',
            opens: 'Η ιστοσελίδα ανοίγει στις',
            left: 'Απομένει',
            tz: 'Ώρα Ιερουσαλήμ',
            h: 'ώ', m: 'λ'
        }
    };

    var state = {
        windows: [],       // [[startMs, endMs], ...] ascending
        skewMs: 0,         // server clock minus device clock
        offsetMs: 0,       // clock shift for previewing a boundary; time still flows
        forced: null,      // 'closed' | 'open' when a preview pins the state
        previewLang: null, // language pinned by the preview, for checking all three
        closedUntil: null, // end of the window currently being served
        dataSettled: false,// true once the data attempt finished, one way or another
        timer: null,
        countdown: null,
        video: null
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

    // ---------------------------------------------------------------- the sun itself

    // Julian day at 0h UT for a calendar date.
    function julianDay(y, m, d) {
        var a = Math.floor((14 - m) / 12);
        var y2 = y + 4800 - a;
        var m2 = m + 12 * a - 3;
        return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2
            + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045 - 0.5;
    }

    var rad = Math.PI / 180;

    // NOAA's general solar position equations. Returns the instant in Jerusalem on that date
    // when the sun's centre reaches the given zenith angle on its way down, or null on a day
    // where it never does.
    function solarEvent(year, month, day, zenith) {
        var tzHours = tzOffsetMs(Date.UTC(year, month - 1, day, 10, 0, 0)) / 3600000;
        var jd = julianDay(year, month, day) + (12 - tzHours) / 24;
        var t = (jd - 2451545) / 36525;

        var l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360;
        var m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
        var ecc = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
        var centre = Math.sin(m * rad) * (1.914602 - t * (0.004817 + 0.000014 * t))
            + Math.sin(2 * m * rad) * (0.019993 - 0.000101 * t)
            + Math.sin(3 * m * rad) * 0.000289;
        var appLong = l0 + centre - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * rad);
        var meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
        var obliq = meanObliq + 0.00256 * Math.cos((125.04 - 1934.136 * t) * rad);
        var decl = Math.asin(Math.sin(obliq * rad) * Math.sin(appLong * rad)) / rad;

        var varY = Math.pow(Math.tan(obliq / 2 * rad), 2);
        var eqTime = 4 / rad * (varY * Math.sin(2 * l0 * rad)
            - 2 * ecc * Math.sin(m * rad)
            + 4 * ecc * varY * Math.sin(m * rad) * Math.cos(2 * l0 * rad)
            - 0.5 * varY * varY * Math.sin(4 * l0 * rad)
            - 1.25 * ecc * ecc * Math.sin(2 * m * rad));

        var cosHa = Math.cos(zenith * rad) / (Math.cos(LAT * rad) * Math.cos(decl * rad))
            - Math.tan(LAT * rad) * Math.tan(decl * rad);
        if (!(Math.abs(cosHa) <= 1)) return null;

        var minutes = 720 - 4 * LON - eqTime + tzHours * 60 + 4 * (Math.acos(cosHa) / rad);
        var seconds = Math.round(minutes * 60);
        var hh = Math.floor(seconds / 3600);
        var mm = Math.floor((seconds % 3600) / 60);
        // Built through jerusalemInstant so a day that changes its offset still lands right.
        return jerusalemInstant(year, month, day, hh, mm) + (seconds % 60) * 1000;
    }

    // The Friday whose Shabbat covers this instant, as Jerusalem calendar parts.
    function shabbatFriday(instant) {
        var p = jerusalemParts(instant);
        var midnight = jerusalemInstant(p.year, p.month, p.day, 0, 0);
        // Sunday through Friday this lands on the Friday of the same week; on a Saturday the
        // offset is negative, which is exactly right — Saturday belongs to the window that
        // opened the evening before. Subtracting another day here, as an earlier version did,
        // pointed at Thursday and left the site open all Saturday whenever the data was
        // unavailable.
        var friday = midnight + (5 - p.weekday) * 86400000;
        return jerusalemParts(friday);
    }

    function crudeWindow(fp) {
        var start = jerusalemInstant(fp.year, fp.month, fp.day, CRUDE_OPEN.hour, CRUDE_OPEN.minute);
        var sp = jerusalemParts(start + 86400000);
        var end = jerusalemInstant(sp.year, sp.month, sp.day, CRUDE_SHUT.hour, CRUDE_SHUT.minute);
        return validWindow([start, end]) ? [start, end] : null;
    }

    // Candle lighting is forty minutes before Friday's sunset; havdalah is Saturday nightfall.
    function computedWindow(instant) {
        var fp = shabbatFriday(instant);
        try {
            var sunset = solarEvent(fp.year, fp.month, fp.day, ZENITH_SUNSET);
            var sp = jerusalemParts(jerusalemInstant(fp.year, fp.month, fp.day, 12, 0) + 86400000);
            var nightfall = solarEvent(sp.year, sp.month, sp.day, ZENITH_NIGHTFALL);
            if (sunset === null || nightfall === null) return crudeWindow(fp);
            var pair = [sunset - CANDLES_BEFORE_MIN * 60000, nightfall];
            return validWindow(pair) ? pair : crudeWindow(fp);
        } catch (e) {
            return crudeWindow(fp);
        }
    }

    function fallbackWindow(instant) {
        return computedWindow(instant);
    }

    // Second opinion on the file's own numbers. A few minutes apart is the formula's own error
    // and the file wins; further apart means the file cannot be trusted, and then the safe side
    // is taken — closing earlier, opening later.
    function reconcile(window) {
        var mine = computedWindow(window[0]);
        if (!mine) return window;
        var startGap = window[0] - mine[0];
        var endGap = mine[1] - window[1];
        if (Math.abs(startGap) <= DISAGREEMENT_MS && Math.abs(endGap) <= DISAGREEMENT_MS) return window;
        if (window.__warned !== true && window && console && console.warn) {
            console.warn('shabbat-gate: the file disagrees with the sun by '
                + Math.round(startGap / 60000) + '/' + Math.round(endGap / 60000)
                + ' min, taking the safe side');
            window.__warned = true;
        }
        return [Math.min(window[0], mine[0]), Math.max(window[1], mine[1])];
    }

    function activeWindow(instant) {
        for (var i = 0; i < state.windows.length; i++) {
            var w = state.windows[i];
            var checked = reconcile(w);
            if (instant >= checked[0] && instant < checked[1]) return checked;
            if (checked[0] > instant) break;
        }
        return null;
    }

    function activeFallback(instant) {
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

    // The site's own switcher is hidden while the gate is up, so the screen carries its own.
    var LANG_LABELS = { en: 'EN', he: 'עב', gr: 'ΕΛ' };

    function browserLang() {
        var tags = navigator.languages || [navigator.language || ''];
        for (var i = 0; i < tags.length; i++) {
            var tag = String(tags[i]).toLowerCase();
            if (tag.indexOf('he') === 0 || tag.indexOf('iw') === 0) return 'he';
            if (tag.indexOf('el') === 0) return 'gr';
            if (tag.indexOf('en') === 0) return 'en';
        }
        return null;
    }

    function currentLang() {
        if (state.previewLang) return COPY[state.previewLang] ? state.previewLang : 'en';

        // The head snippet captured the stored choice before the site's own i18n engine ran:
        // that engine writes 'en' into localStorage on every load, which would otherwise look
        // like a deliberate choice and bury the visitor's real language.
        var saved = window.__shabbatLang;
        if (saved === undefined) {
            try { saved = localStorage.getItem('lang'); } catch (e) { /* ignore */ }
        }
        if (saved && COPY[saved]) return saved;
        // A first-time visitor arriving during Shabbat should be met in their own language.
        return browserLang() || 'en';
    }

    function rememberLang(lang) {
        state.previewLang = state.previewLang ? lang : null;
        try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
        // The site's own engine listens for this and will pick the choice up once it is open.
        document.dispatchEvent(new CustomEvent('langChanged'));
    }

    function copy(lang) {
        var fallback = COPY[lang] || COPY.en;
        var t = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[lang]) || null;
        if (!t) return fallback;
        return {
            title: t.shabbat_title || fallback.title,
            body: t.shabbat_body || fallback.body,
            opens: t.shabbat_opens || fallback.opens,
            left: t.shabbat_left || fallback.left,
            tz: t.shabbat_tz || fallback.tz,
            h: t.shabbat_h || fallback.h,
            m: t.shabbat_m || fallback.m
        };
    }

    function applyCopy(el, lang, endInstant) {
        var t = copy(lang);
        el.setAttribute('lang', lang);
        // The site keeps its layout LTR in every language, but this screen is nothing but
        // text, so Hebrew reads the way it should.
        el.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
        el.setAttribute('aria-label', t.title);
        el.querySelector('.shabbat-gate__title').textContent = t.title;
        el.querySelector('.shabbat-gate__body').textContent = t.body;
        el.querySelector('.shabbat-gate__label--opens').textContent = t.opens;
        el.querySelector('.shabbat-gate__label--left').textContent = t.left;
        el.querySelector('.shabbat-gate__time').textContent = localTimeLabel(endInstant);
        el.querySelector('.shabbat-gate__tz').textContent = t.tz;
        renderCountdown(el.querySelector('.shabbat-gate__count'), endInstant, t);
        el.querySelectorAll('.shabbat-gate__lang').forEach(function (btn) {
            var active = btn.getAttribute('data-lang') === lang;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        return t;
    }

    function buildScreen(endInstant) {
        var lang = currentLang();
        var el = document.createElement('div');
        el.className = 'shabbat-gate';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.tabIndex = -1;   // aria-label is set by applyCopy, in the chosen language
        el.innerHTML =
            '<div class="shabbat-gate__card">'
            + '<img class="shabbat-gate__logo" src="MoralTogetherLogoBlack.webp" alt="MoralTogether">'
            + '<h1 class="shabbat-gate__title"></h1>'
            + '<p class="shabbat-gate__body"></p>'
            + '<dl class="shabbat-gate__times">'
            + '<dt class="shabbat-gate__label shabbat-gate__label--opens"></dt>'
            + '<dd class="shabbat-gate__value"><time class="shabbat-gate__time"></time></dd>'
            + '<dt class="shabbat-gate__label shabbat-gate__label--left"></dt>'
            + '<dd class="shabbat-gate__value"><span class="shabbat-gate__count"></span></dd>'
            + '</dl>'
            + '<p class="shabbat-gate__tz"></p>'
            + '<div class="shabbat-gate__langs" role="group">'
            + Object.keys(LANG_LABELS).map(function (code) {
                return '<button type="button" class="shabbat-gate__lang" data-lang="' + code + '">'
                    + LANG_LABELS[code] + '</button>';
            }).join('')
            + '</div>'
            + '</div>';
        el.querySelectorAll('.shabbat-gate__lang').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var chosen = btn.getAttribute('data-lang');
                rememberLang(chosen);
                applyCopy(el, chosen, endInstant);
                // The counter keeps its own units, so restart it with the new language.
                startCountdown(el, endInstant);
            });
        });

        applyCopy(el, lang, endInstant);
        return el;
    }

    // Hours and minutes while the wait is long, minutes and seconds in the last hour. A
    // seconds counter ticking for twenty-five hours would be restless on a screen about rest.
    function renderCountdown(node, endInstant, units) {
        var left = Math.max(0, endInstant - now());
        var h = Math.floor(left / 3600000);
        var m = Math.floor((left % 3600000) / 60000);
        var sec = Math.floor((left % 60000) / 1000);
        // Units, not a colon: "24:52" next to an opening time of "19:53" reads like a clock.
        var text = h > 0
            ? h + ' ' + units.h + ' ' + m + ' ' + units.m
            : m + ' ' + units.m + ' ' + sec + ' s';
        if (node.textContent !== text) node.textContent = text;
    }

    // The loop is decoration, so it only runs where it is welcome: not on a phone in portrait
    // (the still is framed for that shape), not when the visitor asked for less motion, and not
    // on a metered or slow connection. Everywhere else the poster is the video's own first
    // frame, so the swap is invisible.
    function videoWelcome() {
        try {
            if (window.matchMedia('(orientation: portrait) and (max-width: 46rem)').matches) return false;
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        } catch (e) { /* very old browser — keep the still */ return false; }

        var net = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (net) {
            // Data Saver is an explicit choice, so it is honoured. effectiveType is a guess
            // Chrome makes from latency — it reports 3g on perfectly good desktop links, so
            // only the genuinely slow tiers count here.
            if (net.saveData) return false;
            if (/^(slow-2g|2g)$/.test(net.effectiveType || '')) return false;
        }
        return true;
    }

    function addVideo(screen) {
        if (!videoWelcome()) return;

        var video = document.createElement('video');
        video.className = 'shabbat-gate__video';
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.setAttribute('tabindex', '-1');
        video.preload = 'auto';
        video.innerHTML =
            '<source src="images/shabbat-loop.webm" type="video/webm">'
            + '<source src="images/shabbat-loop.mp4" type="video/mp4">';

        video.addEventListener('canplay', function () {
            video.classList.add('is-ready');
        });
        // If it cannot play at all, the poster simply stays.
        video.addEventListener('error', function () {
            video.remove();
        });

        screen.insertBefore(video, screen.firstChild);
        state.video = video;

        // Muted autoplay is allowed everywhere we care about, but if a browser still refuses,
        // the first touch or click starts it. Until then the poster stands, which is fine.
        function attempt() {
            var started = video.play();
            if (started && started.catch) started.catch(function () { /* keep the poster */ });
        }
        function onGesture() {
            document.removeEventListener('pointerdown', onGesture);
            document.removeEventListener('keydown', onGesture);
            if (video.paused && !document.hidden) attempt();
        }
        document.addEventListener('pointerdown', onGesture, { once: true });
        document.addEventListener('keydown', onGesture, { once: true });
        attempt();
    }

    function startCountdown(screen, endInstant) {
        var count = screen.querySelector('.shabbat-gate__count');
        var units = copy(screen.getAttribute('lang') || currentLang());
        renderCountdown(count, endInstant, units);
        clearInterval(state.countdown);
        state.countdown = setInterval(function () { renderCountdown(count, endInstant, units); }, 1000);
    }

    function pauseMedia() {
        document.querySelectorAll('video, audio').forEach(function (m) {
            try { m.pause(); m.autoplay = false; } catch (e) { /* ignore */ }
        });
    }

    // quiet: hide the content but do not draw the screen yet. Used while the real times are
    // still in flight and only the crude fallback says we are inside Shabbat — otherwise a
    // visitor on a Friday afternoon would see "Closed for Shabbat" flash and disappear.
    function mark(value) {
        document.documentElement.setAttribute('data-shabbat', value);
    }

    function close(endInstant, quiet) {
        if (quiet) {
            state.closedUntil = null;
            document.documentElement.classList.add('shabbat-closed');
            mark('pending');
            var stale = document.querySelector('.shabbat-gate');
            if (stale) stale.remove();
            clearInterval(state.countdown);
            state.countdown = null;
            return;
        }
        if (state.closedUntil === endInstant && document.querySelector('.shabbat-gate')) return;
        state.closedUntil = endInstant;
        document.documentElement.classList.add('shabbat-closed');
        mark('closed');
        if (!document.body) return;   // pre-paint class is enough until the body exists

        var existing = document.querySelector('.shabbat-gate');
        if (existing) existing.remove();
        var screen = buildScreen(endInstant);
        document.body.appendChild(screen);
        try { screen.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        pauseMedia();
        addVideo(screen);

        startCountdown(screen, endInstant);
    }

    function open() {
        state.closedUntil = null;
        state.video = null;
        document.documentElement.classList.remove('shabbat-closed');
        mark('open');
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
        var quiet = false;

        if (!active && !state.windows.length) {
            active = activeFallback(instant);
            quiet = !!active && !state.dataSettled;
        }

        if (active) close(active[1], quiet);
        else open();

        clearTimeout(state.timer);
        var edge = active ? active[1] : nextBoundary(instant);
        if (quiet) edge = instant + 700;   // come back as soon as the data lands
        if (edge) {
            // Timers are unreliable over long sleeps; cap the wait and let the tick re-check.
            var wait = Math.min(edge - instant + 1000, 6 * 3600 * 1000);
            state.timer = setTimeout(evaluate, Math.max(1000, wait));
        }
    }

    // ---------------------------------------------------------------- data loading

    function adopt(windows, source) {
        if (!windows.length) return false;
        state.dataSettled = true;
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

    // fetch on its own waits forever; a stalled network would leave the gate in its quiet
    // phase — content hidden, screen not drawn — for as long as the visitor is willing to look
    // at nothing.
    function fetchWithTimeout(url, options) {
        var opts = options || {};
        if (typeof AbortController === 'function') {
            var control = new AbortController();
            opts.signal = control.signal;
            setTimeout(function () { control.abort(); }, DATA_TIMEOUT_MS);
        }
        return fetch(url, opts);
    }

    function loadFromHebcal() {
        var year = jerusalemParts(now()).year;
        return fetchWithTimeout(HEBCAL_URL + year, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
            .then(function (payload) { adopt(parseHebcal(payload), 'hebcal'); })
            .catch(function () {
                if (!state.windows.length && window.console && console.warn) {
                    console.warn('shabbat-gate: no data at all, using the fixed fallback window');
                }
            })
            .then(function () {
                state.dataSettled = true;
                evaluate();
            });
    }

    function loadData() {
        return fetchWithTimeout(DATA_URL, { cache: 'no-cache' })
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
        var langMatch = /[?&]lang=(en|he|gr)\b/.exec(window.location.search);
        if (langMatch) state.previewLang = langMatch[1];

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
            mark('open');
            return;
        }

        readOverride();
        state.windows = readCache();
        evaluate();
        loadData();

        // Belt and braces: whatever happens to those requests, the quiet phase ends here and
        // the screen is finished one way or the other.
        setTimeout(function () {
            if (!state.dataSettled) {
                state.dataSettled = true;
                evaluate();
            }
        }, DATA_TIMEOUT_MS + 500);

        // The screen can stand for twenty-five hours; there is no reason to decode video for a
        // tab nobody is looking at.
        document.addEventListener('visibilitychange', function () {
            if (state.video) {
                if (document.hidden) {
                    state.video.pause();
                } else {
                    var resumed = state.video.play();
                    if (resumed && resumed.catch) resumed.catch(function () { /* ignore */ });
                }
            }
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
