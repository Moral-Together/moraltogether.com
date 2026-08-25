// Accessibility widget — the floating button and panel that let a visitor change the site to
// suit them: text size, contrast, monochrome and colour-blind filters, stop animations,
// highlight links, a dyslexia-friendly font, a big cursor, a reading guide, heading and
// landmark lists. Open-Nagish 1.1.5 (MIT), vendored in vendor/ and pinned by file name.
//
// Three properties of the package shape everything below.
//
// Importing the module initialises the widget by itself — the last line of the vendored file
// calls init() on its own. So the configuration has to be on window.OpenNagishConfig BEFORE
// the import, otherwise the visitor sees the package's default blue button for an instant and
// ours a frame later.
//
// It renders into an open shadow root on a host element whose inline style is `all:initial`.
// The page's own stylesheets do not cross that boundary, which is why the brand theme is
// injected into the shadow root as a style element of its own. Custom properties do cross it,
// so --primary-color still resolves inside and the button follows the site's light and dark
// themes; every value has a literal fallback anyway.
//
// The widget remembers the language the visitor picks in its own panel, and that choice wins
// over our configuration. So switching the site's language moves the widget's language only
// for a visitor who never chose one there — which is the behaviour we want.

(function () {
    'use strict';

    var SRC = './vendor/open-nagish-1.1.5.esm.js';   // a module specifier needs the ./
    var HOST_ID = 'opennagish-widget';       // set by the package, not by us
    var THEME_ID = 'mt-a11y-theme';
    var MOBILE_MAX = 768;                    // the width the package itself switches at
    var IDLE_TIMEOUT_MS = 2500;

    // The panel speaks Hebrew, English, Arabic and Russian. It has no Greek, and the site's
    // third language is Greek — so a Greek visitor gets the English panel. Adding a locale
    // would mean patching the vendored file and re-applying that patch on every version bump.
    function uiLang() {
        var tag = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
        if (tag.indexOf('he') === 0 || tag.indexOf('iw') === 0) return 'he';
        if (tag.indexOf('ar') === 0) return 'ar';
        if (tag.indexOf('ru') === 0) return 'ru';
        return 'en';
    }

    // env(safe-area-inset-*) is a CSS value, and the widget wants a number: it writes the
    // button's position as an inline style, so a stylesheet could only win with !important —
    // which would also pin the button and take away its drag-to-move. Measuring the inset
    // instead keeps both.
    function safeInset(side) {
        var probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;'
            + 'width:env(safe-area-inset-' + side + ');height:env(safe-area-inset-' + side + ');';
        document.body.appendChild(probe);
        var value = Math.round(probe.getBoundingClientRect().height);
        probe.parentNode.removeChild(probe);
        return isFinite(value) && value > 0 ? value : 0;
    }

    function config() {
        return {
            position: 'bottom-left',         // the side Israeli sites put it on, and the RTL side
            lang: uiLang(),
            bottomOffset: 0,
            mobileBottomOffset: safeInset('bottom'),

            // Setting statementUrl means the widget only opens that page and never renders a
            // statement of its own. That is what we want now that the page exists: it names the
            // coordinator, the phone and the known limitations, none of which the package's
            // generator can produce, and it says the same thing in all three languages.
            // Relative on purpose — the package hands this to window.open, which resolves it
            // against the current document, so it survives a preview deployment and either
            // domain. An absolute URL would only be one more thing to keep in step.
            statementUrl: 'accessibility.html',

            // Kept as the fallback for a build where the URL above is cleared. The generator
            // omits whatever it is not given, so this stays deliberately thin.
            statementData: {
                orgName: 'MoralTogether',
                orgEmail: 'support@moraltogether.com',
                lastAuditDate: '2026-08-24'
            }
        };
    }

    // Only the values the package hard-codes in its default blue are touched. Everything
    // inside the panel keeps the brand navy: the panel is a light surface in both themes, and
    // the dark theme's accent is a bright cyan that does not carry white text or read as a
    // control against white. The button is the one part that sits on the page itself, so it
    // is the one part that follows the theme.
    var THEME = [
        ':host {',
        '    --w-accent: var(--primary-color, #002b64);',
        '    --w-navy: #002b64;',                          // white on it: about 14:1
        '    --w-open: var(--secondary-color, #e55b27);',   // panel open, instead of the default red
        '    --w-icon: #fff;',
        '}',
        ':host([data-theme="dark"]) {',
        '    --w-icon: var(--bg-body, #07070f);',           // dark glyph on the bright cyan button
        '}',

        /* The host is all:initial, so nothing here is inherited from the page — the fonts have
           to be named again. The faces themselves are declared on the document and are
           available inside the shadow tree. */
        ':host, .anid-trigger, .anid-panel, .anid-panel *, .anid-statement-modal, .anid-statement-modal * {',
        "    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
        '}',
        '.anid-panel-title, .anid-category-header, .anid-statement-modal h1, .anid-statement-modal h2 {',
        "    font-family: 'Rubik', 'Inter', sans-serif;",
        '}',

        '.anid-trigger {',
        '    background: var(--w-accent) !important;',
        '    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28) !important;',
        '    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28),',
        '                0 0 0 5px color-mix(in srgb, var(--w-accent) 22%, transparent) !important;',
        '}',
        '.anid-trigger svg { fill: var(--w-icon) !important; }',
        '.anid-trigger[aria-expanded="true"] { background: var(--w-open) !important; }',
        '.anid-trigger[aria-expanded="true"] svg { fill: #fff !important; }',

        '.anid-panel-header { background: var(--w-navy) !important; }',
        '.anid-btn.anid-active {',
        '    background: var(--w-navy) !important;',
        '    border-color: var(--w-navy) !important;',
        '    color: #fff !important;',
        '}',
        '.anid-toggle input:checked + .anid-toggle-slider { background: var(--w-navy) !important; }',
        '.anid-slider::-webkit-slider-thumb { background: var(--w-navy) !important; }',
        '.anid-slider::-moz-range-thumb { background: var(--w-navy) !important; }',
        '.anid-heading-list button, .anid-landmark-list button { color: var(--w-navy) !important; }',
        '.anid-btn:focus-visible,',
        '.anid-category-header:focus-visible,',
        '.anid-heading-list button:focus-visible,',
        '.anid-landmark-list button:focus-visible { outline-color: var(--w-navy) !important; }',

        /* Phone: 44x44 is the smallest target the standard allows, the glyph and the ring come
           down with it, and the grow-on-hover is pointless on a touch screen. The position is
           left alone here on purpose — see safeInset(). */
        '@media (max-width: ' + MOBILE_MAX + 'px) {',
        '    .anid-trigger {',
        '        width: 44px !important;',
        '        height: 44px !important;',
        '        border-width: 2px !important;',
        '    }',
        '    .anid-trigger svg { width: 20px !important; height: 20px !important; }',
        '    .anid-trigger:hover, .anid-trigger:focus-visible { transform: none !important; }',
        '}'
    ].join('\n');

    var init = null;          // the package's init(), once the module has loaded
    var started = false;

    function host() {
        var el = document.getElementById(HOST_ID);
        return el && el.shadowRoot ? el : null;
    }

    // Runs after every init, because each one throws the old shadow root away and builds a
    // new one — the theme has to go back in.
    function dress() {
        var el = host();
        if (!el) return;

        if (!el.shadowRoot.getElementById(THEME_ID)) {
            var style = document.createElement('style');
            style.id = THEME_ID;
            style.textContent = THEME;
            el.shadowRoot.appendChild(style);
        }

        el.setAttribute('data-theme',
            document.body.classList.contains('dark-mode') ? 'dark' : 'light');

        // Both insets are written straight onto the button's inline style, the same property
        // the package itself uses to place it, and with the same 20 px base. Nudging the inline
        // style leaves the button draggable, which an !important rule would not — and it is the
        // only thing that works after the first paint: the package's resize handler merely
        // clamps the button back into the viewport, it does not re-read the offsets from its
        // config. Clearing the properties instead of writing 20 px back would drop the button
        // to the very edge, since nothing in a stylesheet places it.
        var phone = window.innerWidth <= MOBILE_MAX;
        var left = phone ? safeInset('left') : 0;
        var bottom = phone ? safeInset('bottom') : 0;
        var trigger = el.shadowRoot.querySelector('.anid-trigger');
        if (trigger) {
            trigger.style.left = (20 + left) + 'px';
            trigger.style.bottom = (20 + bottom) + 'px';
        }
    }

    function load() {
        if (started || document.documentElement.classList.contains('shabbat-closed')) return;
        started = true;

        window.OpenNagishConfig = config();
        import(SRC).then(function (mod) {
            init = mod.init;             // the import has already built the widget for us
            dress();
        }).catch(function () {
            started = false;             // a failed fetch gets another chance, not a dead widget
            arm();
        });
    }

    function schedule() {
        if (window.requestIdleCallback) requestIdleCallback(load, { timeout: IDLE_TIMEOUT_MS });
        else setTimeout(load, 1200);
    }

    // A visitor who reaches for the keyboard or the screen should not wait for the idle
    // callback — whichever comes first wins.
    function arm() {
        ['keydown', 'pointerdown'].forEach(function (type) {
            window.addEventListener(type, load, { once: true, passive: true });
        });
    }
    arm();

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule);

    // The site's language switcher announces itself; re-initialising re-renders the panel in
    // the new language and re-applies the theme. init() disposes of the previous instance.
    document.addEventListener('langChanged', function () {
        if (!init) return;
        init({ lang: uiLang() });
        dress();
    });

    // Turning the phone changes both insets and can cross the 768 px line, so the button is
    // placed again. The package's own resize handler runs too, but it only clamps.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (!init) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(dress, 150);
    });

    // The theme toggle only adds and removes a class on the body, so watching the class is
    // what there is to watch.
    if (window.MutationObserver && document.body) {
        new MutationObserver(function () {
            var el = host();
            if (el) el.setAttribute('data-theme',
                document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // While the gate is up the widget stays unloaded. Not for weight: its dark mode and
    // hide-images write page-wide !important rules that would strip the Shabbat screen's own
    // layers. The gate opens by removing the class and does not reload the page, so the class
    // is what tells us the site is back.
    if (window.MutationObserver) {
        var watcher = new MutationObserver(function () {
            if (!document.documentElement.classList.contains('shabbat-closed')) {
                watcher.disconnect();
                schedule();
            }
        });
        watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
}());
