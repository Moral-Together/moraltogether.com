document.addEventListener('DOMContentLoaded', () => {

    // --- i18n Language Engine ---
    const HTML_LANG = { en: 'en', he: 'he', gr: 'el' };
    const entityBox = document.createElement('textarea');
    const decodeEntities = (str) => { entityBox.innerHTML = str; return entityBox.value; };
    // remember: only a deliberate click is stored. Writing the default on every load made a
    // first visit look like a choice, which meant an Israeli visitor was greeted in English
    // and nothing downstream could tell the difference.
    function applyLanguage(lang, remember) {
        const t = TRANSLATIONS[lang];
        if (!t) return;

        // The internal key for Greek is 'gr', which is a country code, not a language tag —
        // a screen reader given lang="gr" falls back to guessing and reads Greek in the wrong
        // voice. The real tag goes into the attribute; the key stays as it is in the code.
        document.documentElement.setAttribute('lang', HTML_LANG[lang] || lang);

        // Hebrew reads right to left, and until now the site did not say so — the pages were
        // laid out left to right in every language, which the stage-1 audit called the worst
        // barrier on the site. rtl.css hangs off this attribute.
        document.documentElement.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');

        // Translate text nodes. An element that names an attribute in data-i18n-attr gets the
        // translation there instead — the gallery dialog needs a translated aria-label, and
        // writing that string into its innerHTML deleted the dialog: the close button, the
        // arrows, the image and the title element were all replaced by the words themselves.
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key] === undefined) return;
            const attr = el.getAttribute('data-i18n-attr');
            // Some strings carry entities ("Mothers &amp; Family"). innerHTML decodes them; an
            // attribute takes the text literally, so it is decoded first.
            if (attr) el.setAttribute(attr, decodeEntities(t[key]));
            else el.innerHTML = t[key];
        });

        // Translate innerHTML — для значений с разметкой внутри (перенос строки в заголовке героя)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (t[key] !== undefined) el.innerHTML = t[key];
        });

        // Update <title>. A page about one thing (a Moral's page) names its own keys on <html>;
        // without them every page took the home page's title in the chosen language.
        const own = document.documentElement.dataset;
        if (own.i18nTitle && t[own.i18nTitle]) document.title = `${decodeEntities(t[own.i18nTitle])} — MoralTogether`;
        else if (t.meta_title) document.title = t.meta_title;

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        const descKey = own.i18nDescription && t[own.i18nDescription] ? own.i18nDescription : 'meta_description';
        if (metaDesc && t[descKey]) metaDesc.setAttribute('content', decodeEntities(t[descKey]));

        // Update active button
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Save to localStorage — only when the visitor picked this language themselves
        if (remember) {
            try { localStorage.setItem('lang', lang); } catch (e) { /* private mode */ }
        }

        // Notify canvas renderers to redraw with new language
        document.dispatchEvent(new CustomEvent('langChanged'));
    }

    // --- A Moral's page: "back" returns where the visitor came from ---
    // The link always led to partnerships.html, but the Morals are opened from the home page's
    // strip too, and from there it took the visitor somewhere they had never been. The strip's
    // links carry ?from=home: the page cannot rely on document.referrer, which is empty when
    // the site is opened from disk (file://). Coming from home the link says "Home" and leads
    // there; from home or from partnerships.html a click steps back in history, so the visitor
    // lands where they had scrolled to. Any other way in (a search, a shared link) keeps the
    // plain link to partnerships.html. Set before the first applyLanguage below, which writes
    // the label from data-i18n.
    (function moralBack() {
        const back = document.querySelector('.moral-back');
        if (!back) return;
        const fromHome = new URLSearchParams(location.search).get('from') === 'home';
        let fromPartners = false, sameSite = location.protocol === 'file:';
        try {
            const ref = new URL(document.referrer);
            sameSite = sameSite || ref.origin === location.origin;
            fromPartners = sameSite && ref.pathname.endsWith('/partnerships.html');
        } catch (e) { /* no referrer: opened from disk, a bookmark or a new tab */ }
        if (!fromHome && !fromPartners) return;
        if (fromHome) {
            back.querySelector('[data-i18n]').setAttribute('data-i18n', 'nav_home');
            back.href = back.getAttribute('href').replace('partnerships.html', 'index.html#partners');
        }
        back.addEventListener('click', (e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            // only step back onto our own page; a shared ?from=home link, or a page opened
            // in a new tab, follows the link instead
            if (!sameSite || history.length < 2) return;
            e.preventDefault();
            history.back();
        });
    })();

    // Wire up buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang'), true));
    });

    // The language the visitor asks for, in order: what they chose here before, then what their
    // browser requests, then English. The site speaks three languages; Hebrew answers to both
    // 'he' and the older 'iw', Greek to 'el'.
    function preferredLanguage() {
        let saved = null;
        try { saved = localStorage.getItem('lang'); } catch (e) { /* private mode */ }
        if (saved && TRANSLATIONS[saved]) return saved;

        const asked = navigator.languages || [navigator.language || ''];
        for (const tag of asked) {
            const code = String(tag).toLowerCase();
            if (code.startsWith('he') || code.startsWith('iw')) return 'he';
            if (code.startsWith('el')) return 'gr';
            if (code.startsWith('en')) return 'en';
        }
        return 'en';
    }

    applyLanguage(preferredLanguage(), false);

    // --- Reveal on Scroll ---
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { root: null, threshold: 0.1 });
    reveals.forEach(r => revealObserver.observe(r));

    const checkScroll = () => {
        const trigger = window.innerHeight * 0.9;
        reveals.forEach(r => { if (r.getBoundingClientRect().top < trigger) r.classList.add('active'); });
    };
    window.addEventListener('scroll', checkScroll);
    checkScroll();
    setTimeout(() => reveals.forEach(r => r.classList.add('active')), 4000);


    // --- Scroll Progress Bar + Orb Parallax ---
    const scrollBar = document.getElementById('scrollBar');
    const orbs = document.querySelectorAll('.orb');
    window.addEventListener('scroll', () => {
        const st = document.documentElement.scrollTop || document.body.scrollTop;
        if (scrollBar) {
            const sh = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            scrollBar.style.width = ((st / sh) * 100) + '%';
        }
        orbs.forEach((orb, i) => { orb.style.transform = `translateY(${st * (i + 1) * 0.15}px)`; });
    });

    // The shared buttons (.btn) used to follow the cursor ("magnetic") and spread a ripple on
    // click. They now move like the hero's "Our projects" button, in CSS alone (1.10.26).

    // --- Dark Mode ---
    const darkToggle = document.getElementById('darkModeToggle');
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    darkToggle?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        document.documentElement.classList.toggle('dark-mode-early', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new Event('themeChanged'));
    });

    // --- Navbar Scroll ---
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));

    // --- Scroll Spy ---
    const sections = document.querySelectorAll('section, header');
    // Only links to this page's own sections (#…). Since every menu item became a page of its
    // own there are none, and the current page is marked by tools/build.mjs instead; this stays
    // for a menu that points into the page again. Unfiltered it marked every link "active" (an
    // empty id is in every address) or took the build's mark away.
    const navLinks = [...document.querySelectorAll('.nav-link')].filter(l => l.getAttribute('href').startsWith('#'));
    const setActive = () => {
        if (!navLinks.length) return;
        let current = '';
        sections.forEach(s => { if (pageYOffset >= s.offsetTop - 250) current = s.getAttribute('id'); });
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) current = 'contact';
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href').includes(current)));
    };
    window.addEventListener('scroll', setActive);
    setActive();

    // --- Escape closes the mobile drawer -------------------------------------------
    // Opening the menu with a keyboard used to be a one-way door: Escape did nothing and the
    // only way out was to find the burger again.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const menu = document.querySelector('.nav-menu.active');
        if (!menu) return;
        menu.classList.remove('active');
        const burger = document.querySelector('.hamburger');
        burger?.classList.remove('active');
        burger?.setAttribute('aria-expanded', 'false');
        burger?.focus();
    });

    // --- Motion: the system's "reduce motion" setting stops everything that moves ---------
    // The site had its own stop/start switch in the gallery. It was taken out: the
    // accessibility widget's "Stop animations" does the same for the whole page (the standard's
    // way to pause what moves by itself), and the switch, once pressed, stayed on in that
    // browser for every page — cards jumped instead of lifting, with no switch on the inner
    // pages to turn it back. The choice it stored is dropped, so nobody stays stuck with it.
    try { localStorage.removeItem('motion'); } catch (e) { /* private mode */ }
    document.documentElement.classList.toggle('motion-paused',
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // --- Partner logo videos: nothing is fetched until the card is nearly in view ---
    // The markup carries data-src and data-poster instead of src and poster, so a visit that
    // never reaches the gallery never pays for a single logo. Thirty-one of them used to load
    // at once, before anyone had seen them.
    (() => {
        const videos = document.querySelectorAll('video[loop] source[data-src]');
        if (!videos.length) return;

        // Decoration, all of it: a screen reader announcing fifteen unnamed players helps
        // nobody, and this has to hold before a card wakes as well as after.
        videos.forEach((source) => {
            const video = source.parentElement;
            video.setAttribute('aria-hidden', 'true');
            video.setAttribute('tabindex', '-1');
        });

        const net = navigator.connection || {};
        const stillsOnly = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            || net.saveData === true
            || /^(slow-2g|2g)$/.test(net.effectiveType || '');

        const wake = (video) => {
            if (video.dataset.awake) return;
            video.dataset.awake = '1';

            const source = video.querySelector('source[data-src]');
            if (!source) return;
            if (source.dataset.poster) video.poster = source.dataset.poster;

            // With less motion asked for, or on a metered line, the frame is the whole story.
            if (stillsOnly) return;

            source.src = source.dataset.src;
            video.load();
            const started = video.play();
            if (started && started.catch) started.catch(() => { /* the poster stands */ });
        };

        // A video in the home page's strip is watched through its strip, not on its own. The
        // strip carries every card across its own edges all the time, so each logo was paused
        // as it left on the left and started again as it came in on the right: the decoder was
        // brought up again in the middle of the motion, and the strip and the logos stuttered.
        // Now a strip's videos all play while it is in view and all sleep when it is not.
        const groups = new Map();
        videos.forEach((source) => {
            const video = source.parentElement;
            const target = video.closest('.partners-marquee-wrap') || video;
            if (!groups.has(target)) groups.set(target, []);
            groups.get(target).push(video);
        });

        const watcher = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                groups.get(entry.target).forEach((video) => {
                    if (entry.isIntersecting) {
                        wake(video);
                        if (video.paused && video.dataset.awake && !stillsOnly) {
                            const resumed = video.play();
                            if (resumed && resumed.catch) resumed.catch(() => {});
                        }
                    } else if (!video.paused) {
                        // Off screen it is just a decoder burning battery.
                        video.pause();
                    }
                });
            });
        }, { rootMargin: '300px 0px' });

        groups.forEach((_, target) => watcher.observe(target));
    })();

    // --- Bento Card + Partner Card 3D Tilt + Spotlight ---
    // Not the contact panel: a block that wide tilting under the mouse reads as a sway, and it
    // made the address and the number hard to aim at. The small cards keep it.
    // A touch screen sends a mousemove with every tap, so a card tilted and lifted under the
    // finger; on a phone the activity cards and the partner cards stay still when tapped.
    const noHover = () => window.matchMedia('(hover: none), (max-width: 768px)').matches;
    document.querySelectorAll('.bento-card, .partner-card').forEach(card => {
        if (card.matches('.contact-bento-panel')) return;
        card.addEventListener('mousemove', e => {
            // The system asks for less motion: the card stays put. With every transition cut to
            // nothing it would jump up and tilt at once instead.
            if (document.documentElement.classList.contains('motion-paused')) return;
            if (noHover()) return;
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
            card.style.transform = `perspective(1000px) rotateX(${((y - r.height/2) / (r.height/2)) * -5}deg) rotateY(${((x - r.width/2) / (r.width/2)) * 5}deg) translateY(-10px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) translateY(0)`;
            card.style.transition = 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.4s ease, background 0.4s';
        });
        card.addEventListener('mouseenter', () => { card.style.transition = 'transform 0.1s ease'; });
    });

    // --- Mobile Menu ---
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    // A real <button> now, so it is reachable by Tab and says whether the drawer is open.
    hamburger?.addEventListener('click', () => {
        const open = !navMenu.classList.contains('active');
        hamburger.classList.toggle('active', open);
        navMenu.classList.toggle('active', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.nav-link, .nav-contact-link').forEach(n => n.addEventListener('click', () => {
        if (hamburger?.classList.contains('active')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        }
    }));

    // --- Scroll Indicator ---
    const scrollInd = document.querySelector('.scroll-indicator');
    if (scrollInd) {
        scrollInd.style.cursor = 'pointer';
        // Whatever section follows the hero, so the arrow survives the sections being reordered.
        scrollInd.addEventListener('click', () => document.querySelector('#home')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' }));
    }

    // --- Preloader ---
    // It used to wait for the window load event and then sit there for another 800 ms. That
    // meant the curtain stayed up until the very last image, font and third-party avatar had
    // arrived — seconds after the page itself was ready to read. The document being parsed and
    // styled is the honest moment to lift it.
    (() => {
        const preloader = document.getElementById('preloader');
        if (!preloader) return;
        const lift = () => {
            preloader.classList.add('fade-out');
            document.body.classList.add('loaded');
        };
        // A beat, so the entrance still reads as deliberate rather than as a flicker.
        setTimeout(lift, 150);
        // And a floor under it, in case something above throws before this runs.
        window.addEventListener('load', () => setTimeout(lift, 100));
    })();

    // --- Hero comet dots ---
    const dotsCanvas = document.getElementById('hero-dots-canvas');
    if (dotsCanvas) {
        const dctx = dotsCanvas.getContext('2d');
        const DOT_COUNT  = 18;
        const TRAIL_LEN  = 28;
        const SPEED      = 0.55;
        // The speeds below are written per 60 Hz frame, the way they always were. The tick now
        // measures the real gap between frames and scales by it, so a 120 Hz screen no longer
        // runs the hero at twice the speed of a 60 Hz one. The cap keeps a tab that was left in
        // the background from teleporting the comets across the canvas on the frame it returns.
        const FRAME      = 1000 / 60;
        const MAX_STEP   = 3;

        const NEON_COLORS  = ['#00c8ff','#ff2d78','#00ffb3','#bf5af2','#ff9500','#f9b80c'];
        const LIGHT_COLORS = ['#0088ee','#e8003d','#00aa55','#8833cc','#e06800','#cc9900'];

        let dW, dH, textZone;
        let raf = null, last = 0, onScreen = true;
        const comets = [];

        function dotsResize() {
            dW = dotsCanvas.offsetWidth;
            dH = dotsCanvas.offsetHeight;
            dotsCanvas.width  = dW;
            dotsCanvas.height = dH;
            textZone = { w: dW * 0.46, hMin: dH * 0.12, hMax: dH * 0.88 };
        }

        function initComets() {
            comets.length = 0;
            for (let i = 0; i < DOT_COUNT; i++) {
                let x, y;
                do {
                    x = Math.random() * dW;
                    y = Math.random() * dH;
                } while (x < textZone.w && y > textZone.hMin && y < textZone.hMax);

                const angle = Math.random() * Math.PI * 2;
                const speed = SPEED * (0.5 + Math.random() * 0.8);
                // pre-fill trail at starting position
                const trail = [];
                for (let t = 0; t < TRAIL_LEN; t++) trail.push({ x, y });

                comets.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    speed,                      // the speed this comet keeps for life
                    r: 2 + Math.random() * 1.5,
                    colorIdx: i % NEON_COLORS.length,
                    trail,
                });
            }
        }

        function hexToRgb(hex) {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return `${r},${g},${b}`;
        }

        function stepComets(step) {
            comets.forEach(c => {
                // Bounce. The old test only flipped the sign and left the comet where it was, so
                // one that had overshot could sit past the edge flipping every frame. It is put
                // back on the canvas and sent inwards.
                if (c.x < 0)       { c.x = 0;  c.vx =  Math.abs(c.vx); }
                else if (c.x > dW) { c.x = dW; c.vx = -Math.abs(c.vx); }
                if (c.y < 0)       { c.y = 0;  c.vy =  Math.abs(c.vy); }
                else if (c.y > dH) { c.y = dH; c.vy = -Math.abs(c.vy); }

                // Steering away from the text zone used to add 0.02 to vx every frame and keep
                // it: the wall bounce only flips the sign, so nothing ever gave the speed back,
                // and each crossing left the comet faster than the last. Measured at 60 Hz on a
                // 1440 px canvas — 0.68 px/frame at the start, 5.22 after two minutes, the
                // 28-point trail stretched from a 19 px dot into a 146 px stripe. The nudge
                // still turns the comet away; its speed is put back where it began.
                if (c.x < textZone.w && c.y > textZone.hMin && c.y < textZone.hMax) {
                    c.vx += 0.02 * step;
                    const len = Math.hypot(c.vx, c.vy) || 1;
                    c.vx = c.vx / len * c.speed;
                    c.vy = c.vy / len * c.speed;
                }

                c.x += c.vx * step;
                c.y += c.vy * step;

                // update trail
                c.trail.push({ x: c.x, y: c.y });
                if (c.trail.length > TRAIL_LEN) c.trail.shift();
            });
        }

        function drawComets() {
            dctx.clearRect(0, 0, dW, dH);
            const dark = document.body.classList.contains('dark-mode');
            const palette = dark ? NEON_COLORS : LIGHT_COLORS;

            comets.forEach(c => {
                const color = palette[c.colorIdx];
                const rgb = hexToRgb(color);

                // draw trail — tapers in width and fades in alpha
                for (let t = 1; t < c.trail.length; t++) {
                    const progress = t / c.trail.length;       // 0=tail, 1=head
                    const alpha    = progress * progress * (dark ? 0.75 : 0.55);
                    const width    = progress * c.r * 1.8;

                    dctx.beginPath();
                    dctx.moveTo(c.trail[t - 1].x, c.trail[t - 1].y);
                    dctx.lineTo(c.trail[t].x,     c.trail[t].y);
                    dctx.strokeStyle = `rgba(${rgb},${alpha})`;
                    dctx.lineWidth   = Math.max(0.3, width);
                    dctx.lineCap     = 'round';
                    dctx.stroke();
                }

                // glowing head
                const grd = dctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 4);
                grd.addColorStop(0, `rgba(${rgb},${dark ? 0.9 : 0.7})`);
                grd.addColorStop(1, `rgba(${rgb},0)`);
                dctx.beginPath();
                dctx.arc(c.x, c.y, c.r * 4, 0, Math.PI * 2);
                dctx.fillStyle = grd;
                dctx.fill();

                // solid core
                dctx.beginPath();
                dctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                dctx.fillStyle = color;
                dctx.fill();
            });
        }

        function cometsTick(now) {
            const step = last ? Math.min((now - last) / FRAME, MAX_STEP) : 1;
            last = now;
            stepComets(step);
            drawComets();
            raf = requestAnimationFrame(cometsTick);
        }

        // The switch that stops the motion, and the system's own prefers-reduced-motion behind
        // it, both set html.motion-paused. CSS can pause an animation; it cannot stop a canvas
        // from being redrawn, so the comets ran straight through both — while the accessibility
        // statement promised a control that stops the motion on the site. And there was nothing
        // to gain by drawing them while the hero was scrolled past, which the vision network
        // canvas below already knew.
        const motionOff = () => document.documentElement.classList.contains('motion-paused');

        function startComets() {
            if (raf || !onScreen || motionOff()) return;
            last = 0;
            raf = requestAnimationFrame(cometsTick);
        }
        function stopComets() {
            if (!raf) return;
            cancelAnimationFrame(raf);
            raf = null;
        }

        dotsResize();
        initComets();
        drawComets();   // one still frame, so a hero with the motion stopped is not an empty one
        window.addEventListener('resize', () => { dotsResize(); initComets(); drawComets(); });

        new MutationObserver(() => (motionOff() ? stopComets() : startComets()))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        new IntersectionObserver((entries) => {
            onScreen = entries[0].isIntersecting;
            onScreen ? startComets() : stopComets();
        }).observe(dotsCanvas);
    }

    // ── Partners strip: one device pixel a frame ───────────────────
    // A smooth CSS slide put the strip on fractions of a pixel while a playing video always
    // lands on a whole one, so the logos shook in their frames. Steps of a pixel in CSS fixed
    // that, but a step clock of 60 a second never quite matches the screen's own, and every so
    // often a frame got no step or two. So the strip is moved here, from the frame callback
    // itself: the same whole number of device pixels every frame (on a fast screen, one pixel
    // every few frames), about 60 CSS pixels a second. A frame the browser drops is caught up,
    // so the speed holds. .js-marquee turns the CSS animation off; it stays as the fallback.
    (function partnersMarquee() {
        const track = document.querySelector('.partners-track');
        if (!track) return;

        const SPEED = 60;              // CSS px a second: a circle of 1980px in 33 s
        const motionOff = () => document.documentElement.classList.contains('motion-paused');
        let dev = 0, frame = 0, last = 0, frameMs = 1000 / 60, seen = [], raf = null, onScreen = false;

        track.classList.add('js-marquee');

        function tick(now) {
            const dt = last ? now - last : frameMs;
            last = now;
            // the refresh interval: the median of the first frames, then followed slowly
            if (dt > 2 && dt < 100) {
                if (seen.length < 30) { seen.push(dt); frameMs = [...seen].sort((a, b) => a - b)[seen.length >> 1]; }
                else frameMs += (dt - frameMs) * 0.02;
            }
            const frames = dt < 100 ? Math.max(1, Math.round(dt / frameMs)) : 1;
            const dpr = window.devicePixelRatio || 1;
            const perFrame = SPEED * dpr * frameMs / 1000;           // device px a frame
            const step = perFrame >= 1 ? Math.round(perFrame) : 1;
            const every = perFrame >= 1 ? 1 : Math.round(1 / perFrame);
            // still while a visitor points at a logo or tabs to one, as before
            if (!track.matches(':hover, :focus-within')) {
                for (let i = 0; i < frames; i++) if (++frame % every === 0) dev += step;
                dev %= Math.round(track.scrollWidth / 2 * dpr);
            }
            track.style.transform = `translate3d(${-dev / dpr}px, 0, 0)`;
            raf = requestAnimationFrame(tick);
        }

        function start() {
            if (raf || !onScreen || motionOff()) return;
            last = 0;
            raf = requestAnimationFrame(tick);
        }
        function stop() {
            if (!raf) return;
            cancelAnimationFrame(raf);
            raf = null;
        }

        new IntersectionObserver((entries) => {
            onScreen = entries[0].isIntersecting;
            onScreen ? start() : stop();
        }).observe(track);
        new MutationObserver(() => (motionOff() ? stop() : start()))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    })();

    // ── Floating circles behind each section (see style.css) ──
    // Each section gets its own set: colours from the brand palette in pastel, positions given
    // as a share of the section, so the backdrop changes from one block to the next.
    (function sectionBlobs() {
        const P = { pink: '#ffb3d1', blue: '#a9d4ff', mint: '#a6ecd9', peach: '#ffd2a8',
                    lilac: '#d6c6ff', sun: '#ffe7a3', sky: '#b9f0ff' };
        // One or two per section, large and pale: a soft wash that shifts colour from block
        // to block, not confetti (1.10.26: there were three to a section, small and bright).
        const SETS = {
            activities: [['blue', 6, 15, 560], ['pink', 92, 75, 480]],
            about:      [['peach', 88, 30, 560]],
            team:       [['lilac', 8, 50, 600]],
            vision:     [['mint', 90, 35, 560], ['sun', 10, 90, 420]],
            partners:   [['pink', 10, 60, 520]],
            gallery:    [['sky', 90, 40, 560]],
            contact:    [['lilac', 10, 50, 520]],
        };
        Object.entries(SETS).forEach(([id, blobs], si) => {
            const section = document.getElementById(id);
            if (!section) return;
            const layer = document.createElement('div');
            layer.className = 'section-blobs';
            layer.setAttribute('aria-hidden', 'true');
            blobs.forEach(([colour, x, y, size], i) => {
                const b = document.createElement('span');
                const k = si * 3 + i;
                b.style.cssText = `left:calc(${x}% - ${size / 2}px);top:calc(${y}% - ${size / 2}px);` +
                    `--s:${size}px;--c:${P[colour]};--t:${18 + (k * 7) % 12}s;--d:${-(k * 5) % 17}s;` +
                    `--dx:${(k % 2 ? -1 : 1) * (30 + (k * 11) % 30)}px;--dy:${(k % 3 ? 1 : -1) * (24 + (k * 13) % 26)}px`;
                layer.appendChild(b);
            });
            section.classList.add('has-blobs');
            section.prepend(layer);
        });
    })();

    // ── Vision Network Canvas ──────────────────────────────────────
    (function initVisionNetwork() {
        const canvas = document.getElementById('vision-network-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const SECTORS = [
            { key: 'sector_academia', color: '#1e8ec8', emoji: '🎓' },
            { key: 'sector_business', color: '#e84c1c', emoji: '💼' },
            { key: 'sector_nonprofits', color: '#38b56a', emoji: '🤝' },
            { key: 'sector_public',   color: '#d62060', emoji: '🏛️' },
            { key: 'sector_media',    color: '#9c27b0', emoji: '📡' },
            { key: 'sector_community',color: '#f4a31e', emoji: '🏘️' },
            { key: 'sector_employment', color: '#0f8b8d', emoji: '🛠️' },
            { key: 'sector_health',     color: '#e53935', emoji: '🩺' },
            { key: 'sector_environment', color: '#7cb342', emoji: '🌿' },
        ];

        // The pulse speeds below are written per 60 Hz frame; the tick scales them by the real
        // gap between frames, so a 120 Hz screen no longer runs the dots at twice the speed.
        const FRAME    = 1000 / 60;
        const MAX_STEP = 3;

        let W, H, cx, cy, radius;
        let pulses = [];
        let raf = null, last = 0, onScreen = false;

        // Preload center logo
        const logoImg = new Image();
        logoImg.src = 'images/favicon.png';
        logoImg.onload = () => { if (!raf) draw(); };

        function resize() {
            const rect = canvas.parentElement.getBoundingClientRect();
            const dpr  = window.devicePixelRatio || 1;
            W = rect.width;
            H = rect.height;
            canvas.width  = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
            cx = W / 2;
            cy = H / 2;
            radius = Math.min(W, H) * 0.36;
        }

        function nodePos(i) {
            const angle = (i / SECTORS.length) * Math.PI * 2 - Math.PI / 2;
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
            };
        }

        function isDark() {
            return document.body.classList.contains('dark-mode');
        }

        function initPulses() {
            pulses = SECTORS.map((s, i) => ({
                idx: i,
                t: i / SECTORS.length,
                speed: 0.0028 + Math.random() * 0.001,
            }));
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const dark = isDark();

            const textColor = dark ? 'rgba(200,230,255,0.85)' : 'rgba(0,30,80,0.85)';
            const centerBg  = dark ? '#0d1a2e' : '#002b64';
            const lineBase  = dark ? 'rgba(0,200,255,0.20)' : 'rgba(0,43,100,0.18)';
            const hubGlow   = dark ? 'rgba(0,200,255,0.5)' : 'rgba(0,43,100,0.3)';

            // Connection lines
            SECTORS.forEach((s, i) => {
                const p = nodePos(i);
                ctx.save();
                ctx.strokeStyle = lineBase;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 7]);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                ctx.restore();
            });

            // Pulse dots
            pulses.forEach(pulse => {
                const p  = nodePos(pulse.idx);
                const px = cx + (p.x - cx) * pulse.t;
                const py = cy + (p.y - cy) * pulse.t;
                const col = SECTORS[pulse.idx].color;
                ctx.save();
                ctx.shadowBlur = dark ? 10 : 6;
                ctx.shadowColor = col;
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(px, py, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Sector nodes
            const nodeR = Math.min(W, H) * 0.072;
            const emojiSize = Math.max(14, Math.min(22, nodeR * 0.9));
            SECTORS.forEach((s, i) => {
                const p = nodePos(i);

                // Glow ring
                ctx.save();
                ctx.shadowBlur = dark ? 18 : 10;
                ctx.shadowColor = s.color;
                const grad = ctx.createRadialGradient(p.x, p.y, nodeR * 0.3, p.x, p.y, nodeR);
                grad.addColorStop(0, s.color + 'cc');
                grad.addColorStop(1, s.color + '22');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Inner circle
                ctx.save();
                ctx.fillStyle = dark ? '#0d1a2e' : '#ffffff';
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, nodeR * 0.62, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                // Emoji icon
                ctx.save();
                ctx.font = `${emojiSize}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(s.emoji, p.x, p.y);
                ctx.restore();

                // Label below node
                const fontSize = Math.max(9, Math.min(13, W * 0.028));
                const curLang = document.documentElement.getAttribute('lang') || 'en';
                const label = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[curLang]?.[s.key]) || s.key.replace('sector_', '');
                ctx.save();
                ctx.font = `600 ${fontSize}px 'Rubik', sans-serif`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const words = label.split(' ');
                if (words.length === 1) {
                    ctx.fillText(label, p.x, p.y + nodeR * 1.38);
                } else {
                    ctx.fillText(words[0], p.x, p.y + nodeR * 1.28);
                    ctx.fillText(words.slice(1).join(' '), p.x, p.y + nodeR * 1.28 + fontSize * 1.2);
                }
                ctx.restore();
            });

            // Center hub glow
            const hubR = Math.min(W, H) * 0.115;
            const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubR * 1.6);
            hubGrad.addColorStop(0, dark ? 'rgba(0,200,255,0.22)' : 'rgba(0,43,100,0.14)');
            hubGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hubGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, hubR * 1.6, 0, Math.PI * 2);
            ctx.fill();

            // Center circle
            ctx.save();
            ctx.shadowBlur = dark ? 24 : 12;
            ctx.shadowColor = hubGlow;
            ctx.fillStyle = centerBg;
            ctx.strokeStyle = dark ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Center logo image (clipped to circle)
            if (logoImg.complete && logoImg.naturalWidth) {
                const pad   = hubR * 0.22;
                const imgR  = hubR - pad;
                const imgD  = imgR * 2;
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, imgR, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(logoImg, cx - imgR, cy - imgR, imgD, imgD);
                ctx.restore();
            } else {
                // Fallback text if image not yet loaded
                const hubFontSize = Math.max(9, Math.min(12, W * 0.027));
                ctx.save();
                ctx.font = `700 ${hubFontSize}px 'Rubik', sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Moral', cx, cy - hubFontSize * 0.55);
                ctx.fillText('Together', cx, cy + hubFontSize * 0.65);
                ctx.restore();
            }
        }

        function tick(now) {
            const step = last ? Math.min((now - last) / FRAME, MAX_STEP) : 1;
            last = now;
            pulses.forEach(p => {
                p.t += p.speed * step;
                if (p.t > 1) p.t = 0;
            });
            draw();
            raf = requestAnimationFrame(tick);
        }

        // The same gap the hero comets had: html.motion-paused, which the "Stop the motion"
        // switch and prefers-reduced-motion both set, pauses CSS animations and nothing else.
        // A canvas goes on being redrawn straight through it, so these dots kept crawling
        // while the accessibility statement said the motion on the site could be stopped.
        const motionOff = () => document.documentElement.classList.contains('motion-paused');

        function start() {
            if (raf || !onScreen || motionOff()) return;
            last = 0;
            raf = requestAnimationFrame(tick);
        }
        function stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }

        const observer = new IntersectionObserver(entries => {
            onScreen = entries[0].isIntersecting;
            onScreen ? start() : stop();
        }, { threshold: 0.1 });

        new MutationObserver(() => (motionOff() ? stop() : start()))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        resize();
        initPulses();
        draw();   // one still frame, so a section with the motion stopped is not an empty one
        observer.observe(canvas);

        window.addEventListener('resize', () => { resize(); draw(); });
        document.addEventListener('themeChanged', () => draw());
        document.addEventListener('langChanged', () => draw());
    })();

    // ── Connections web (the "Connections" block of Our Story) ──────
    // The collage used to be one flat picture. Now every photo circle drifts on a path of its
    // own, the heart in the middle sways a little, and each thread is redrawn every frame from
    // the heart to its circle, so they stay tied however the two move. Everything is in the
    // SVG's 600-unit square; the circles are moved in pixels, scaled from the same units.
    (function initConnectionsWeb() {
        const web = document.querySelector('.connections-web');
        if (!web) return;

        const UNITS = 600;
        const nodes = [...web.querySelectorAll('.connections-node')];
        const hubEl = web.querySelector('.connections-hub');
        const threads = [...web.querySelectorAll('.connections-thread')].map(g => ({
            path: g.querySelector('path'),
            hubBead: g.querySelector('.bead-hub'),
            bead: g.querySelector('.bead'),
            bend: +g.dataset.bend,
        }));
        // As on the picture: a thread leaves the heart at a small bead on its edge, bows a
        // little on the way, meets a larger glowing bead just outside the ring and runs on
        // straight into it. Each thread bows its own way (data-bend, share of its length).
        const GAP = 5;
        const fix = (v) => Math.round(v * 10) / 10;

        const rest = (el) => {
            const s = el.style;
            return { el, x: +s.getPropertyValue('--x'), y: +s.getPropertyValue('--y'), r: +s.getPropertyValue('--r') };
        };
        const hub = rest(hubEl);
        // Each circle gets its own amplitude, speed and phase, so no two move in step.
        // Periods are 6-10 s: a slow float, not a jiggle. The heart moves least.
        const spokes = nodes.filter(el => el !== hubEl).map((el, i) => ({
            ...rest(el),
            ax: 6 + (i * 3) % 4, ay: 7 + (i * 5) % 4,
            wx: (2 * Math.PI) / (7000 + (i * 1300) % 3000),
            wy: (2 * Math.PI) / (6000 + (i * 1700) % 4000),
            px: i * 1.7, py: i * 2.3 + 1,
        }));
        Object.assign(hub, { ax: 2.5, ay: 3, wx: (2 * Math.PI) / 9000, wy: (2 * Math.PI) / 7500, px: 0, py: 0.8 });

        let scale = web.clientWidth / UNITS;
        let raf = null, onScreen = false;

        const offset = (n, t) => ({ dx: n.ax * Math.sin(t * n.wx + n.px), dy: n.ay * Math.sin(t * n.wy + n.py) });
        const place = (n, o) => { n.el.style.transform = `translate(${o.dx * scale}px, ${o.dy * scale}px)`; };

        function frame(t) {
            const h = offset(hub, t);
            const hx = hub.x + h.dx, hy = hub.y + h.dy;
            place(hub, h);
            spokes.forEach((n, i) => {
                const o = offset(n, t);
                const x = n.x + o.dx, y = n.y + o.dy;
                place(n, o);
                const th = threads[i];
                const d = Math.hypot(x - hx, y - hy) || 1;
                const ux = (x - hx) / d, uy = (y - hy) / d;
                const sx = fix(hx + ux * hub.r), sy = fix(hy + uy * hub.r);
                const bx = fix(x - ux * (n.r + GAP)), by = fix(y - uy * (n.r + GAP));
                const ex = fix(x - ux * n.r), ey = fix(y - uy * n.r);
                const bow = th.bend * (d - hub.r - n.r - GAP);
                const cx = fix((sx + bx) / 2 - uy * bow), cy = fix((sy + by) / 2 + ux * bow);
                th.path.setAttribute('d', `M${sx} ${sy}Q${cx} ${cy} ${bx} ${by}L${ex} ${ey}`);
                th.hubBead.setAttribute('cx', sx); th.hubBead.setAttribute('cy', sy);
                th.bead.setAttribute('cx', bx);    th.bead.setAttribute('cy', by);
            });
        }

        function tick(now) {
            frame(now);
            raf = requestAnimationFrame(tick);
        }

        // Same rule as the canvases above: html.motion-paused (the accessibility widget's
        // "Stop animations" and prefers-reduced-motion) stops it, and so does scrolling past.
        const motionOff = () => document.documentElement.classList.contains('motion-paused');
        function start() {
            if (raf || !onScreen || motionOff()) return;
            raf = requestAnimationFrame(tick);
        }
        function stop() {
            if (!raf) return;
            cancelAnimationFrame(raf);
            raf = null;
        }

        new ResizeObserver(() => { scale = web.clientWidth / UNITS; }).observe(web);
        new IntersectionObserver((entries) => {
            onScreen = entries[0].isIntersecting;
            onScreen ? start() : stop();
        }).observe(web);
        new MutationObserver(() => (motionOff() ? stop() : start()))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    })();

    // Gallery Modal
    const GALLERY_IMAGES = [
        { src: 'images/gallery-school.webp', title: 'School' },
        { src: 'images/gallery-radio.webp', title: 'Radio Club' },
        { src: 'images/gallery-seniors.webp', title: 'Senior Citizens' },
        { src: 'images/gallery-environment-stand.webp', title: 'Environment Stand' },
        { src: 'images/gallery-radio-interview.webp', title: 'Radio Club Interview' },
        { src: 'images/gallery-sports-stand.webp', title: 'Sports Stand' },
        { src: 'images/gallery-school-clip.webp', title: 'The School Clip' },
        { src: 'images/gallery-mediators.webp', title: 'Mediators Patrol' },
    ];

    const modal       = document.getElementById('galleryModal');
    const modalImg    = document.getElementById('galleryModalImg');
    const modalTitle  = document.getElementById('galleryModalTitle');
    // partnerships.html has no gallery, and this block is the last thing in the handler: without
    // the guard every visit to that page threw a TypeError before the dialog was even wired.
    if (!modal) return;
    const modalClose  = modal.querySelector('.gallery-modal-close');
    const modalPrev   = modal.querySelector('.gallery-modal-prev');
    const modalNext   = modal.querySelector('.gallery-modal-next');
    const backdrop    = modal.querySelector('.gallery-modal-backdrop');
    const galleryScroll = document.querySelector('.gallery-scroll');
    let currentIndex  = 0;
    let returnFocus   = null;

    // The title comes from the card, which is already in the page's language; the English
    // strings above were shown in every language.
    const titleFor = (i) => document.querySelector(`.gallery-card[data-index="${i}"] h3`)?.textContent.trim()
        || GALLERY_IMAGES[i].title;

    function show(index) {
        currentIndex = index;
        modalImg.src = GALLERY_IMAGES[currentIndex].src;
        modalImg.alt = titleFor(currentIndex);
        modalTitle.textContent = titleFor(currentIndex);
    }

    function openModal(index) {
        returnFocus = document.activeElement;
        show(index);
        modal.classList.add('is-open');
        if (galleryScroll) galleryScroll.style.animationPlayState = 'paused';
        document.body.style.overflow = 'hidden';
        modalClose.focus();
    }

    function closeModal() {
        modal.classList.remove('is-open');
        if (galleryScroll) galleryScroll.style.animationPlayState = '';
        document.body.style.overflow = '';
        returnFocus?.focus?.();
    }

    function navigate(dir) {
        show((currentIndex + dir + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
    }

    document.querySelectorAll('.gallery-card').forEach(card => {
        const open = () => openModal(parseInt(card.dataset.index, 10));
        card.addEventListener('click', open);
        // The first eight are buttons for the keyboard; the rest are the marquee's copies.
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });

    modalClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    modalPrev.addEventListener('click', () => navigate(-1));
    modalNext.addEventListener('click', () => navigate(1));

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('is-open')) return;
        // In Hebrew "next" lies to the left, the way the arrows on screen are already swapped.
        const rtl = document.documentElement.dir === 'rtl';
        if (e.key === 'ArrowLeft')  navigate(rtl ? 1 : -1);
        if (e.key === 'ArrowRight') navigate(rtl ? -1 : 1);
        if (e.key === 'Escape')     closeModal();
        // aria-modal promises the page behind is out of reach; Tab now keeps that promise.
        if (e.key === 'Tab') {
            const stops = [...modal.querySelectorAll('button')];
            const first = stops[0], last = stops[stops.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
    });

});

// ── Navigation transition — reuses the preloader for page-to-page navigation ──
(function initNavTransition() {
    document.addEventListener('click', e => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href) return;
        if (href.startsWith('#') || href.startsWith('http') ||
            href.startsWith('mailto') || href.startsWith('tel')) return;
        e.preventDefault();

        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.remove('fade-out');
            document.body.classList.remove('loaded');
        }
        setTimeout(() => { window.location.href = href; }, 100);
    });
})();

// ── Page hero: the subtitle types itself out, again after each change of language ──
// It was an inline script of partnerships.html; every inner page opens with the same hero now.
(function initHeroTypewriter() {
    let timer = null;
    function run() {
        const el = document.querySelector('.page-hero .page-hero__sub');
        if (!el) return;
        clearTimeout(timer);
        const text = el.textContent;
        el.textContent = '';
        el.classList.add('typewriter-active');
        let i = 0;
        (function type() {
            if (i < text.length) {
                el.textContent += text[i++];
                timer = setTimeout(type, 60);
            } else {
                el.classList.remove('typewriter-active');
            }
        })();
    }
    document.addEventListener('langChanged', run);
})();

// ── Team: a second tap on an open person closes the bio; on phones the bio shows in a strip ──
// The bio opens on :focus, and tapping the card again kept it focused, so nothing closed it.
// Whether it was open is read on pointerdown, before the tap moves focus.
// Phones have no room for the bio in the card, so the open person's bio is copied into
// .team-bio-panel, placed on the grid row right under theirs (people sit on rows 1, 3, 5; the
// CSS hides the strip on wider screens, where the bio opens in the card).
(function initTeamToggle() {
    const grid = document.querySelector('.team-grid');
    if (!grid) return;
    const panel = grid.querySelector('.team-bio-panel');

    // The strip opens and closes by transition (style.css), so it is never hidden outright.
    // Moving to a person in another row, it first closes where it is, then opens under them;
    // within the same row only the text is swapped, faded out and back in.
    const CLOSE_MS = 380, SWAP_MS = 160;
    const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;

    function fill(member) {
        // the person's colours; their member-N class would also bring their grid placement
        const style = getComputedStyle(member);
        ['--m-deep', '--m-mid', '--m-soft'].forEach(v => panel.style.setProperty(v, style.getPropertyValue(v)));
        panel.querySelector('p').textContent = member.querySelector('.member-bio').textContent;
        panel.style.gridRow = String(parseInt(style.gridRowStart, 10) + 1);
    }

    function showBio(member) {
        if (!panel) return;
        clearTimeout(timer);
        panel.classList.remove('is-swapping');
        const row = String(parseInt(getComputedStyle(member).gridRowStart, 10) + 1);
        if (!panel.classList.contains('is-open')) {
            fill(member);
            panel.classList.add('is-open');
        } else if (panel.style.gridRow !== row) {
            panel.classList.remove('is-open');
            timer = setTimeout(() => { fill(member); panel.classList.add('is-open'); }, still() ? 0 : CLOSE_MS);
        } else {
            panel.classList.add('is-swapping');
            timer = setTimeout(() => { fill(member); panel.classList.remove('is-swapping'); }, still() ? 0 : SWAP_MS);
        }
    }

    function hideBio() {
        if (!panel) return;
        clearTimeout(timer);
        panel.classList.remove('is-open', 'is-swapping');
    }

    grid.querySelectorAll('.member').forEach(member => {
        let wasOpen = false;
        member.addEventListener('pointerdown', () => { wasOpen = document.activeElement === member; });
        member.addEventListener('click', () => { if (wasOpen) member.blur(); wasOpen = false; });
        member.addEventListener('focus', () => showBio(member));
        member.addEventListener('blur', e => {
            if (!(e.relatedTarget && e.relatedTarget.closest('.team-grid .member'))) hideBio();
        });
    });
})();
