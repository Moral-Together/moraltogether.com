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
// A decision is announced as a 'consentChanged' event on document, the way the site announces
// 'langChanged' and 'themeChanged'; whatever loads analytics listens for it.
(function () {
    'use strict';

    // Empty while GA4 is not wired up. With no ID there is nothing to consent to, so neither
    // the banner nor the footer link appears: a banner about cookies the site does not set
    // would be untrue, and the privacy policy says there are none.
    const GA_ID = '';

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

    function init() {
        const banner = document.getElementById('cookie-consent');
        if (!GA_ID || !banner) return;
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
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
