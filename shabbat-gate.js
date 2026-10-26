// Shabbat gate — closes the site for Shabbat and Yom Tov where the visitor is, from 30 minutes
// before sunset until 30 minutes after nightfall (Maxim, 26.10.2026). See docs/shabbat-mode.md.
//
// The place is the browser's time zone; Israel when there is none or it is unknown. Yom Tov is
// one day in Israel and two elsewhere. The rules live in shabbat-core.js (the same code as Stage
// of Stars), loaded before this file.
//
// Sources, in order: for Israel our own api/shabbat.json, for anywhere else Hebcal for that
// place; then the copy cached in this browser; then the computation of the sun and the Hebrew
// calendar in shabbat-core.js, which also checks every stored closure (a few minutes apart is
// rounding, more and the safe side is taken; a closure it has and the data lacks is added).
// Everything is compared as absolute instants.

(function () {
    'use strict';

    var Core = window.ShabbatCore || null;
    var CACHE_KEY = 'shabbat.v2';
    // Resolved against this script's own address, not the page's: the Moral pages sit two
    // folders down (morals/<slug>/), where a page-relative 'api/…' does not exist.
    var BASE = (document.currentScript && document.currentScript.src) || location.href;
    var DATA_URL = new URL('api/shabbat.json', BASE).href;
    var DAY_MS = 86400000;
    var MAX_WINDOW_MS = 4 * DAY_MS;                  // a three-day Yom Tov and Shabbat
    var CACHE_FRESH_MS = 7 * DAY_MS;                 // Hebcal is asked again after a week
    var CACHE_MAX_AGE_MS = 400 * DAY_MS;             // a year plus slack
    var SAFETY_TICK_MS = 30 * 1000;                  // survives suspended timers
    var SKEW_ALERT_MS = 2 * 60 * 1000;
    var DATA_TIMEOUT_MS = 6000;      // a hung request must not leave the screen half-drawn

    // Last resort if shabbat-core.js did not load and nothing is cached: Friday 15:00 to
    // Saturday 21:00 on the visitor's own clock. Wide on purpose — the failure that matters
    // is the site being open during Shabbat.
    var CRUDE_OPEN_HOUR = 15;
    var CRUDE_SHUT_HOUR = 21;

    // Crawlers announce themselves; headless Chrome is deliberately absent because that is
    // also what our own browser tests run as.
    var BOTS = /bot|crawler|crawling|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|applebot|duckduckbot|yandex|baiduspider|ia_archiver|lighthouse|chrome-lighthouse|google page speed/i;

    // The screen normally speaks through translations.js, like the rest of the site. This copy
    // is the fallback for the case where that file did not load — the gate must never end up
    // showing an empty screen. The festival lines (holidayTitle, holidayBody) of 26.10.2026
    // are machine copy waiting for Maxim or the owner.
    var COPY = {
        en: {
            title: 'Shabbat Shalom',
            body: 'MoralTogether rests with Shabbat — from candle lighting until havdalah. We return as the stars come out.',
            holidayTitle: 'Happy holiday!',
            holidayBody: 'MoralTogether rests on the festival — from candle lighting until it ends. We return as the stars come out.',
            opens: 'The site opens at',
            left: 'Time remaining',
            langs: 'Language',
            h: 'h', m: 'min'
        },
        he: {
            title: 'שבת שלום',
            body: 'MoralTogether שובת בשבת — מהדלקת נרות ועד ההבדלה. נחזור עם צאת הכוכבים.',
            holidayTitle: 'חג שמח!',
            holidayBody: 'MoralTogether שובת בחג — מהדלקת נרות ועד צאת החג. נחזור עם צאת הכוכבים.',
            opens: 'האתר נפתח בשעה',
            left: 'זמן שנותר',
            langs: 'בחירת שפה',
            h: 'ש׳', m: 'ד׳'
        },
        gr: {
            title: 'Σαμπάτ Σαλόμ',
            body: 'Το MoralTogether αναπαύεται το Σάββατο — από το άναμμα των κεριών έως το χαβντάλα. Επιστρέφουμε με τα πρώτα αστέρια.',
            holidayTitle: 'Καλή γιορτή!',
            holidayBody: 'Το MoralTogether αναπαύεται στη γιορτή — από το άναμμα των κεριών έως το τέλος της. Επιστρέφουμε με τα πρώτα αστέρια.',
            opens: 'Η ιστοσελίδα ανοίγει στις',
            left: 'Απομένει',
            langs: 'Γλώσσα',
            h: 'ώ', m: 'λ'
        }
    };

    // A language button is labelled in the language it selects, not in the language of the
    // interface — that is how a reader who cannot read the current one finds their way out.
    // The two-letter face ("EN", "עב", "ΕΛ") is fine to look at and useless to hear, so the
    // accessible name is the endonym, and each button declares its own lang so a screen
    // reader pronounces it with the right voice instead of spelling it out.
    var LANG_NAMES = { en: 'English', he: 'עברית', gr: 'Ελληνικά' };

    var state = {
        region: null,      // { zone, lat, lon, israel } — where the visitor is
        windows: [],       // [[startMs, endMs], ...] ascending, from the data
        skewMs: 0,         // server clock minus device clock
        offsetMs: 0,       // clock shift for previewing a boundary; time still flows
        forced: null,      // 'closed' | 'open' when a preview pins the state
        previewLang: null, // language pinned by the preview, for checking all three
        closedUntil: null, // end of the window currently being served
        dataSettled: false,// true once the data attempt finished, one way or another
        kind: 'shabbat',   // 'shabbat' | 'holiday', for the words on the screen
        timer: null,
        countdown: null,
        video: null
    };

    // ---------------------------------------------------------------- time helpers

    function now() {
        return Date.now() + state.skewMs + state.offsetMs;
    }

    function browserZone() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
    }

    // The site opens at a moment that is the visitor's own: their closure follows their place,
    // so their own clock is the one that means something to them.
    function localTimeLabel(instant) {
        return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(instant));
    }

    // ---------------------------------------------------------------- window sources

    function validWindow(pair) {
        return Array.isArray(pair) && pair.length === 2
            && isFinite(pair[0]) && isFinite(pair[1])
            && pair[1] > pair[0] && pair[1] - pair[0] <= MAX_WINDOW_MS;
    }

    function sortWindows(list) {
        return list.sort(function (a, b) { return a[0] - b[0]; });
    }

    // api/shabbat.json: Israel's closures, ends already 30 minutes after havdalah.
    function parsePayload(payload) {
        if (!payload || payload.version !== 2 || !Array.isArray(payload.windows)) return [];
        var out = [];
        payload.windows.forEach(function (w) {
            var pair = [Date.parse(w.start), Date.parse(w.end)];
            if (validWindow(pair)) out.push(pair);
        });
        return sortWindows(out);
    }

    function parseHebcal(payload) {
        return sortWindows(Core.parseHebcalWindows(payload).map(function (w) { return [w.startsAt, w.endsAt]; })
            .filter(validWindow));
    }

    // The closures around an instant, from the data checked against the sun. Without the core
    // the data stands alone, and without either only the crude window is left.
    function windowsAround(instant) {
        var from = instant - 4 * DAY_MS;
        var to = instant + 14 * DAY_MS;
        var data = state.windows.filter(function (w) { return w[1] > from && w[0] < to; });
        if (!Core) {
            if (data.length) return data;
            var crude = crudeWindow(instant);
            return crude ? [crude] : [];
        }
        var computed = Core.computedWindows(state.region, from, to);
        if (!computed) {
            // No sunset or no dark enough night (the far north in summer): Israel's.
            state.region = Core.regionForZone(Core.DEFAULT_ZONE);
            computed = Core.computedWindows(state.region, from, to) || [];
        }
        var merged = Core.reconcileWindows(
            data.map(function (w) { return { startsAt: w[0], endsAt: w[1] }; }),
            computed
        );
        return merged.map(function (w) { return [w.startsAt, w.endsAt]; });
    }

    function crudeWindow(instant) {
        var d = new Date(instant);
        var day = d.getDay();
        var friday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 2) % 7), CRUDE_OPEN_HOUR);
        var saturday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 1, CRUDE_SHUT_HOUR);
        return [friday.getTime(), saturday.getTime()];
    }

    function activeWindow(instant) {
        var list = windowsAround(instant);
        for (var i = 0; i < list.length; i++) {
            if (instant >= list[i][0] && instant < list[i][1]) return list[i];
        }
        return null;
    }

    function nextBoundary(instant) {
        var soonest = null;
        windowsAround(instant).forEach(function (w) {
            [w[0], w[1]].forEach(function (edge) {
                if (edge > instant && (soonest === null || edge < soonest)) soonest = edge;
            });
        });
        return soonest;
    }

    function kindOf(window) {
        if (!Core) return 'shabbat';
        try {
            return Core.windowKind({ startsAt: window[0], endsAt: window[1] }, state.region.zone);
        } catch (e) {
            return 'shabbat';
        }
    }

    // ---------------------------------------------------------------- cache

    // One place per browser: the cache holds the zone it was made for, and a different zone
    // (the visitor travelled, or the old Jerusalem-only cache) starts afresh.
    function readCache() {
        try {
            var raw = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (!raw || !Array.isArray(raw.w) || raw.zone !== state.region.zone) return null;
            if (!raw.fetched || Date.now() - raw.fetched > CACHE_MAX_AGE_MS) return null;
            return { windows: raw.w.filter(validWindow), fetched: raw.fetched };
        } catch (e) {
            return null;
        }
    }

    function writeCache(windows) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ zone: state.region.zone, fetched: Date.now(), w: windows }));
        } catch (e) { /* private mode, quota — the gate still works for this visit */ }
    }

    // ---------------------------------------------------------------- screen

    // The site's own switcher is hidden while the gate is up, so the screen carries its own.
    var LANG_LABELS = { en: 'EN', he: 'עב', gr: 'ΕΛ' };
    // 'gr' is our own key; 'el' is the language tag Greek actually has.
    var HTML_LANG = { en: 'en', he: 'he', gr: 'el' };

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
            holidayTitle: t.shabbat_holiday_title || fallback.holidayTitle,
            holidayBody: t.shabbat_holiday_body || fallback.holidayBody,
            opens: t.shabbat_opens || fallback.opens,
            left: t.shabbat_left || fallback.left,
            langs: t.shabbat_langs || fallback.langs,
            h: t.shabbat_h || fallback.h,
            m: t.shabbat_m || fallback.m
        };
    }

    // aria-modal="true" keeps a screen reader's virtual cursor inside the dialog, but it does
    // nothing to Tab. Measured: the order ran EN -> עב -> ΕΛ -> "skip to content" -> the dialog,
    // and that fourth stop is a link on the page behind the gate — a keyboard visitor tabbed
    // straight out of a closed site into the site. So the cycle is closed by hand.
    function trapFocus(el) {
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            var stops = [].slice.call(el.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'))
                .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
            if (!stops.length) { e.preventDefault(); el.focus(); return; }
            var first = stops[0];
            var last = stops[stops.length - 1];
            // The dialog itself holds focus until the visitor presses Tab, so the first press
            // has to land on the first stop rather than leaving through the end of the page.
            if (document.activeElement === el) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
                return;
            }
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    function applyCopy(el, lang, endInstant) {
        var t = copy(lang);
        el.setAttribute('lang', HTML_LANG[lang] || lang);
        // The site keeps its layout LTR in every language, but this screen is nothing but
        // text, so Hebrew reads the way it should.
        el.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
        var holiday = state.kind === 'holiday';
        var title = holiday ? t.holidayTitle : t.title;
        el.setAttribute('aria-label', title);
        el.querySelector('.shabbat-gate__title').textContent = title;
        el.querySelector('.shabbat-gate__body').textContent = holiday ? t.holidayBody : t.body;
        el.querySelector('.shabbat-gate__label--opens').textContent = t.opens;
        el.querySelector('.shabbat-gate__label--left').textContent = t.left;
        el.querySelector('.shabbat-gate__time').textContent = localTimeLabel(endInstant);
        renderCountdown(el.querySelector('.shabbat-gate__count'), endInstant, t);
        // role="group" with nothing to call it is announced as an unnamed group.
        var group = el.querySelector('.shabbat-gate__langs');
        if (group) group.setAttribute('aria-label', t.langs);
        el.querySelectorAll('.shabbat-gate__lang').forEach(function (btn) {
            var code = btn.getAttribute('data-lang');
            var active = code === lang;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.setAttribute('aria-label', LANG_NAMES[code] || code);
            btn.setAttribute('lang', HTML_LANG[code] || code);
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
            + '<img class="shabbat-gate__logo" src="' + new URL('MoralTogetherLogoBlack.webp', BASE).href + '" alt="MoralTogether">'
            + '<h1 class="shabbat-gate__title"></h1>'
            + '<p class="shabbat-gate__body"></p>'
            + '<dl class="shabbat-gate__times">'
            + '<dt class="shabbat-gate__label shabbat-gate__label--opens"></dt>'
            + '<dd class="shabbat-gate__value"><time class="shabbat-gate__time"></time></dd>'
            + '<dt class="shabbat-gate__label shabbat-gate__label--left"></dt>'
            + '<dd class="shabbat-gate__value"><span class="shabbat-gate__count"></span></dd>'
            + '</dl>'
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

        trapFocus(el);
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
        // Same picture in two sizes: the 1280 one is enough for a laptop, and a wide or dense
        // screen would stretch it past its resolution.
        var wide = false;
        try {
            wide = window.matchMedia('(min-width: 1600px), (min-resolution: 1.5dppx)').matches;
        } catch (e) { /* older browser — the smaller file is the safer default */ }
        var stem = wide ? 'images/shabbat-loop-1920' : 'images/shabbat-loop';
        video.innerHTML =
            '<source src="' + stem + '.webm" type="video/webm">'
            + '<source src="' + stem + '.mp4" type="video/mp4">';

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
        var active = activeWindow(instant);
        if (state.forced === 'closed') {
            state.kind = active ? kindOf(active) : 'shabbat';
            close(active ? active[1] : instant + 3600000);
            return;
        }

        // Only the crude window (no core, no data yet) waits quietly for the data: it is wide
        // enough that a visitor on a Friday afternoon would otherwise see the screen flash.
        var quiet = !!active && !Core && !state.windows.length && !state.dataSettled;
        if (active) {
            state.kind = kindOf(active);
            close(active[1], quiet);
        } else {
            open();
        }

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
        if (window.console && console.debug) console.debug('shabbat-gate: ' + windows.length + ' closures from ' + source);
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

    function fetchJson(url, cacheMode, onResponse) {
        return fetchWithTimeout(url, { cache: cacheMode }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            if (onResponse) onResponse(r);
            return r.json();
        });
    }

    // This calendar year and the next, for the visitor's place: a closure at the end of
    // December, and the weeks after it, need the next year's answer.
    function loadFromHebcal() {
        if (!Core) return Promise.reject(new Error('no core'));
        var year = new Date(now()).getUTCFullYear();
        return Promise.all([year, year + 1].map(function (y) {
            return fetchJson(Core.hebcalUrl(state.region, y), 'default').then(parseHebcal);
        })).then(function (lists) {
            if (!adopt(sortWindows(lists[0].concat(lists[1])), 'hebcal')) throw new Error('no usable closures');
        });
    }

    function loadOwnFile() {
        return fetchJson(DATA_URL, 'no-cache', noteSkew).then(function (payload) {
            if (!adopt(parsePayload(payload), 'api/shabbat.json')) throw new Error('no usable closures');
        });
    }

    function settle() {
        state.dataSettled = true;
        evaluate();
    }

    function loadData() {
        // Israel reads our own file on every visit: it is small, on our own server, and it
        // carries the server's clock. Anywhere else asks Hebcal at most once a week.
        if (state.region.israel) {
            return loadOwnFile().catch(loadFromHebcal).catch(function () {
                if (window.console && console.warn) console.warn('shabbat-gate: no fresh data, using the cache and the sun');
            }).then(settle);
        }
        var cached = readCache();
        if (cached && Date.now() - cached.fetched < CACHE_FRESH_MS) { settle(); return Promise.resolve(); }
        return loadFromHebcal().catch(function () {
            if (window.console && console.warn) console.warn('shabbat-gate: Hebcal unavailable, using the cache and the sun');
        }).then(settle);
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
        state.region = Core ? Core.regionForZone(browserZone()) : { zone: browserZone() || 'Asia/Jerusalem', israel: true };
        var cached = readCache();
        state.windows = cached ? cached.windows : [];
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
