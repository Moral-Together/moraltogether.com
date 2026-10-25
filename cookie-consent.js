// Cookie consent for Google Analytics, the only cookies the site sets, and only after Accept.
//
// Until 25.10.26 the site set no cookies at all and the privacy policy said so in three
// languages. Analytics changes that, so the visitor is asked first: the banner offers Decline
// and Accept side by side, at the same size, and the choice can be changed at any time from
// "Cookie settings" in the footer. Nothing from Google loads before an Accept.
//
// The choice is kept in localStorage under consent.v1 as {a: 'granted' | 'denied', t: ms} and
// asked again after a year. A browser that refuses storage is asked on every page, which is
// the honest outcome: we cannot remember a choice we are not allowed to keep.
//
// Accept loads Google Analytics 4 (below); Decline after an Accept switches it off and deletes
// its cookies. Either way the decision is also announced as a 'consentChanged' event on
// document, the way the site announces 'langChanged' and 'themeChanged'.
(function () {
    'use strict';

    // The GA4 web stream of moraltogether.com (property created 25.10.26: Google signals,
    // granular location and ads personalisation off, data kept 14 months). Emptied, it takes
    // the banner and the footer link away: with no ID there is nothing to consent to.
    const GA_ID = 'G-XJECF7N478';

    // What the privacy policy promises about the cookies, section 5: 13 months, and on
    // moraltogether.com alone, not on its subdomains ('none' writes them without a domain
    // attribute, so the browser keeps them to the exact host).
    const COOKIE_EXPIRES = 395 * 24 * 60 * 60;
    const COOKIE_DOMAIN = 'none';

    const KEY = 'consent.v1';
    const MAX_AGE = 365 * 24 * 60 * 60 * 1000;

    let choice = null;

    function remembered() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (v && (v.a === 'granted' || v.a === 'denied') && Date.now() - v.t < MAX_AGE) return v.a;
        } catch (e) { /* private mode, or a value someone edited by hand */ }
        return null;
    }

    function remember(a) {
        try { localStorage.setItem(KEY, JSON.stringify({ a: a, t: Date.now() })); } catch (e) { /* private mode */ }
    }

    // ── Google Analytics ─────────────────────────────────────────────────────────────────
    // Only ever called after an Accept, so the script itself is the consent gate: before it
    // nothing from Google is on the page. Consent Mode is still set, denied first and then
    // analytics alone granted, so that the advertising signals stay denied whatever Google's
    // defaults are. The same goes for signals and ad personalisation in the config, which the
    // property already has switched off.
    function gtag() { window.dataLayer.push(arguments); }

    function startAnalytics() {
        // The Shabbat gate closes the site; nothing is measured while it is closed.
        if (document.documentElement.classList.contains('shabbat-closed')) return;
        window['ga-disable-' + GA_ID] = false;
        if (window.dataLayer && document.querySelector('script[data-ga]')) {
            gtag('consent', 'update', { analytics_storage: 'granted' });   // Accept again after a Decline
            return;
        }
        window.dataLayer = window.dataLayer || [];
        gtag('consent', 'default', {
            ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
            analytics_storage: 'denied'
        });
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('set', 'ads_data_redaction', true);
        gtag('js', new Date());
        gtag('config', GA_ID, {
            cookie_expires: COOKIE_EXPIRES,
            cookie_domain: COOKIE_DOMAIN,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
        s.setAttribute('data-ga', '');
        document.head.appendChild(s);
    }

    // Decline after an Accept, on the same page. Consent Mode alone is not enough here: with
    // analytics_storage denied, gtag still sends cookieless pings to Google, which is data
    // leaving without consent. The ga-disable flag is Google's own off switch and stops every
    // hit; the cookies are then deleted, under every domain they could have been written to.
    function stopAnalytics() {
        window['ga-disable-' + GA_ID] = true;
        if (window.dataLayer) gtag('consent', 'update', { analytics_storage: 'denied' });
        const names = ['_ga', '_ga_' + GA_ID.replace(/^G-/, '')];
        const host = location.hostname;
        names.forEach((n) => {
            [null, host, '.' + host].forEach((d) => {
                document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
            });
        });
    }

    function init() {
        const banner = document.getElementById('cookie-consent');
        if (!banner) return;

        // On 25.10.26 the banner was, for a few hours, only a notice that analytics was coming,
        // and a "Got it" was kept under this key. The notice is gone and so is the key.
        try { localStorage.removeItem('consent.notice'); } catch (e) { /* private mode */ }

        if (!GA_ID) return;
        const settings = document.querySelector('.footer-cookie-settings');
        let opener = null;

        // Shown on its own on a first visit, without taking the focus: the visitor came for the
        // page, and the skip link still has to be the first thing Tab reaches. Opened from the
        // footer, the focus goes into the banner and comes back to the link afterwards.
        function open(from) {
            opener = from || null;
            banner.hidden = false;
            if (opener) banner.querySelector('[data-consent]').focus();
        }

        function close() {
            banner.hidden = true;
            if (opener) opener.focus();
            opener = null;
        }

        function decide(a) {
            choice = a;
            remember(a);
            close();
            if (a === 'granted') startAnalytics();
            else stopAnalytics();
            document.dispatchEvent(new CustomEvent('consentChanged', { detail: { analytics: a } }));
        }

        banner.querySelectorAll('[data-consent]').forEach((btn) => {
            btn.addEventListener('click', () => decide(btn.getAttribute('data-consent')));
        });

        // Escape only dismisses a banner reopened from the footer: there a choice already
        // stands. On a first visit it would leave the question unanswered and the banner
        // would only come back on the next page.
        banner.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && choice) close();
        });

        if (settings) {
            settings.hidden = false;
            settings.addEventListener('click', () => open(settings));
        }

        choice = remembered();
        if (!choice) open(null);
        else if (choice === 'granted') startAnalytics();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
