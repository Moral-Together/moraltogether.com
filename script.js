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

        // The sector icons used to be emoji drawn as text, and a computer without a colour emoji
        // font (older Windows, Linux) showed empty circles or boxes. These are outlines from
        // Font Awesome Free 6.4.0 (CC BY 4.0), the same set as icons.css, drawn in the sector's
        // colour; w is the width of each one's box, the height is always 512.
        const ICONS = {
            'graduation-cap': { w: 640, d: 'M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9v28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-108.7C90.3 344.3 86 329.8 80 316.5V291.9c0-30.2 10.2-58.7 27.9-81.5c12.9-15.5 29.6-28 49.2-35.7l157-61.7c8.2-3.2 17.5 .8 20.7 9s-.8 17.5-9 20.7l-157 61.7c-12.4 4.9-23.3 12.4-32.2 21.6l159.6 57.6c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32zM128 408c0 35.3 86 72 192 72s192-36.7 192-72L496.7 262.6 354.5 314c-11.1 4-22.8 6-34.5 6s-23.5-2-34.5-6L143.3 262.6 128 408z' },
            'briefcase': { w: 512, d: 'M184 48H328c4.4 0 8 3.6 8 8V96H176V56c0-4.4 3.6-8 8-8zm-56 8V96H64C28.7 96 0 124.7 0 160v96H192 320 512V160c0-35.3-28.7-64-64-64H384V56c0-30.9-25.1-56-56-56H184c-30.9 0-56 25.1-56 56zM512 288H320v32c0 17.7-14.3 32-32 32H224c-17.7 0-32-14.3-32-32V288H0V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V288z' },
            'handshake': { w: 640, d: 'M323.4 85.2l-96.8 78.4c-16.1 13-19.2 36.4-7 53.1c12.9 17.8 38 21.3 55.3 7.8l99.3-77.2c7-5.4 17-4.2 22.5 2.8s4.2 17-2.8 22.5l-20.9 16.2L512 316.8V128h-.7l-3.9-2.5L434.8 79c-15.3-9.8-33.2-15-51.4-15c-21.8 0-43 7.5-60 21.2zm22.8 124.4l-51.7 40.2C263 274.4 217.3 268 193.7 235.6c-22.2-30.5-16.6-73.1 12.7-96.8l83.2-67.3c-11.6-4.9-24.1-7.4-36.8-7.4C234 64 215.7 69.6 200 80l-72 48V352h28.2l91.4 83.4c19.6 17.9 49.9 16.5 67.8-3.1c5.5-6.1 9.2-13.2 11.1-20.6l17 15.6c19.5 17.9 49.9 16.6 67.8-2.9c4.5-4.9 7.8-10.6 9.9-16.5c19.4 13 45.8 10.3 62.1-7.5c17.9-19.5 16.6-49.9-2.9-67.8l-134.2-123zM16 128c-8.8 0-16 7.2-16 16V352c0 17.7 14.3 32 32 32H64c17.7 0 32-14.3 32-32V128H16zM48 320a16 16 0 1 1 0 32 16 16 0 1 1 0-32zM544 128V352c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V144c0-8.8-7.2-16-16-16H544zm32 208a16 16 0 1 1 32 0 16 16 0 1 1 -32 0z' },
            'building-columns': { w: 512, d: 'M243.4 2.6l-224 96c-14 6-21.8 21-18.7 35.8S16.8 160 32 160v8c0 13.3 10.7 24 24 24H456c13.3 0 24-10.7 24-24v-8c15.2 0 28.3-10.7 31.3-25.6s-4.8-29.9-18.7-35.8l-224-96c-8-3.4-17.2-3.4-25.2 0zM128 224H64V420.3c-.6 .3-1.2 .7-1.8 1.1l-48 32c-11.7 7.8-17 22.4-12.9 35.9S17.9 512 32 512H480c14.1 0 26.5-9.2 30.6-22.7s-1.1-28.1-12.9-35.9l-48-32c-.6-.4-1.2-.7-1.8-1.1V224H384V416H344V224H280V416H232V224H168V416H128V224zM256 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z' },
            'tower-broadcast': { w: 576, d: 'M80.3 44C69.8 69.9 64 98.2 64 128s5.8 58.1 16.3 84c6.6 16.4-1.3 35-17.7 41.7s-35-1.3-41.7-17.7C7.4 202.6 0 166.1 0 128S7.4 53.4 20.9 20C27.6 3.6 46.2-4.3 62.6 2.3S86.9 27.6 80.3 44zM555.1 20C568.6 53.4 576 89.9 576 128s-7.4 74.6-20.9 108c-6.6 16.4-25.3 24.3-41.7 17.7S489.1 228.4 495.7 212c10.5-25.9 16.3-54.2 16.3-84s-5.8-58.1-16.3-84C489.1 27.6 497 9 513.4 2.3s35 1.3 41.7 17.7zM352 128c0 23.7-12.9 44.4-32 55.4V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V183.4c-19.1-11.1-32-31.7-32-55.4c0-35.3 28.7-64 64-64s64 28.7 64 64zM170.6 76.8C163.8 92.4 160 109.7 160 128s3.8 35.6 10.6 51.2c7.1 16.2-.3 35.1-16.5 42.1s-35.1-.3-42.1-16.5c-10.3-23.6-16-49.6-16-76.8s5.7-53.2 16-76.8c7.1-16.2 25.9-23.6 42.1-16.5s23.6 25.9 16.5 42.1zM464 51.2c10.3 23.6 16 49.6 16 76.8s-5.7 53.2-16 76.8c-7.1 16.2-25.9 23.6-42.1 16.5s-23.6-25.9-16.5-42.1c6.8-15.6 10.6-32.9 10.6-51.2s-3.8-35.6-10.6-51.2c-7.1-16.2 .3-35.1 16.5-42.1s35.1 .3 42.1 16.5z' },
            'people-roof': { w: 640, d: 'M335.5 4l288 160c15.4 8.6 21 28.1 12.4 43.5s-28.1 21-43.5 12.4L320 68.6 47.5 220c-15.4 8.6-34.9 3-43.5-12.4s-3-34.9 12.4-43.5L304.5 4c9.7-5.4 21.4-5.4 31.1 0zM320 160a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM144 256a40 40 0 1 1 0 80 40 40 0 1 1 0-80zm312 40a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM226.9 491.4L200 441.5V480c0 17.7-14.3 32-32 32H120c-17.7 0-32-14.3-32-32V441.5L61.1 491.4c-6.3 11.7-20.8 16-32.5 9.8s-16-20.8-9.8-32.5l37.9-70.3c15.3-28.5 45.1-46.3 77.5-46.3h19.5c16.3 0 31.9 4.5 45.4 12.6l33.6-62.3c15.3-28.5 45.1-46.3 77.5-46.3h19.5c32.4 0 62.1 17.8 77.5 46.3l33.6 62.3c13.5-8.1 29.1-12.6 45.4-12.6h19.5c32.4 0 62.1 17.8 77.5 46.3l37.9 70.3c6.3 11.7 1.9 26.2-9.8 32.5s-26.2 1.9-32.5-9.8L552 441.5V480c0 17.7-14.3 32-32 32H472c-17.7 0-32-14.3-32-32V441.5l-26.9 49.9c-6.3 11.7-20.8 16-32.5 9.8s-16-20.8-9.8-32.5l36.3-67.5c-1.7-1.7-3.2-3.6-4.3-5.8L376 345.5V400c0 17.7-14.3 32-32 32H296c-17.7 0-32-14.3-32-32V345.5l-26.9 49.9c-1.2 2.2-2.6 4.1-4.3 5.8l36.3 67.5c6.3 11.7 1.9 26.2-9.8 32.5s-26.2 1.9-32.5-9.8z' },
            'screwdriver-wrench': { w: 512, d: 'M78.6 5C69.1-2.4 55.6-1.5 47 7L7 47c-8.5 8.5-9.4 22-2.1 31.6l80 104c4.5 5.9 11.6 9.4 19 9.4h54.1l109 109c-14.7 29-10 65.4 14.3 89.6l112 112c12.5 12.5 32.8 12.5 45.3 0l64-64c12.5-12.5 12.5-32.8 0-45.3l-112-112c-24.2-24.2-60.6-29-89.6-14.3l-109-109V104c0-7.5-3.5-14.5-9.4-19L78.6 5zM19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L233.7 374.3c-7.8-20.9-9-43.6-3.6-65.1l-61.7-61.7L19.9 396.1zM512 144c0-10.5-1.1-20.7-3.2-30.5c-2.4-11.2-16.1-14.1-24.2-6l-63.9 63.9c-3 3-7.1 4.7-11.3 4.7H352c-8.8 0-16-7.2-16-16V102.6c0-4.2 1.7-8.3 4.7-11.3l63.9-63.9c8.1-8.1 5.2-21.8-6-24.2C388.7 1.1 378.5 0 368 0C288.5 0 224 64.5 224 144l0 .8 85.3 85.3c36-9.1 75.8 .5 104 28.7L429 274.5c49-23 83-72.8 83-130.5zM56 432a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z' },
            'stethoscope': { w: 576, d: 'M142.4 21.9c5.6 16.8-3.5 34.9-20.2 40.5L96 71.1V192c0 53 43 96 96 96s96-43 96-96V71.1l-26.1-8.7c-16.8-5.6-25.8-23.7-20.2-40.5s23.7-25.8 40.5-20.2l26.1 8.7C334.4 19.1 352 43.5 352 71.1V192c0 77.2-54.6 141.6-127.3 156.7C231 404.6 278.4 448 336 448c61.9 0 112-50.1 112-112V265.3c-28.3-12.3-48-40.5-48-73.3c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V336c0 97.2-78.8 176-176 176c-92.9 0-168.9-71.9-175.5-163.1C87.2 334.2 32 269.6 32 192V71.1c0-27.5 17.6-52 43.8-60.7l26.1-8.7c16.8-5.6 34.9 3.5 40.5 20.2zM480 224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z' },
            'leaf': { w: 512, d: 'M272 96c-78.6 0-145.1 51.5-167.7 122.5c33.6-17 71.5-26.5 111.7-26.5h88c8.8 0 16 7.2 16 16s-7.2 16-16 16H288 216s0 0 0 0c-16.6 0-32.7 1.9-48.2 5.4c-25.9 5.9-50 16.4-71.4 30.7c0 0 0 0 0 0C38.3 298.8 0 364.9 0 440v16c0 13.3 10.7 24 24 24s24-10.7 24-24V440c0-48.7 20.7-92.5 53.8-123.2C121.6 392.3 190.3 448 272 448l1 0c132.1-.7 239-130.9 239-291.4c0-42.6-7.5-83.1-21.1-119.6c-2.6-6.9-12.7-6.6-16.2-.1C455.9 72.1 418.7 96 376 96L272 96z' },
        };
        const iconPaths = {};
        Object.keys(ICONS).forEach(k => { iconPaths[k] = new Path2D(ICONS[k].d); });

        const SECTORS = [
            { key: 'sector_academia', color: '#1e8ec8', icon: 'graduation-cap' },
            { key: 'sector_business', color: '#e84c1c', icon: 'briefcase' },
            { key: 'sector_nonprofits', color: '#38b56a', icon: 'handshake' },
            { key: 'sector_public',   color: '#d62060', icon: 'building-columns' },
            { key: 'sector_media',    color: '#9c27b0', icon: 'tower-broadcast' },
            { key: 'sector_community',color: '#f4a31e', icon: 'people-roof' },
            { key: 'sector_employment', color: '#0f8b8d', icon: 'screwdriver-wrench' },
            { key: 'sector_health',     color: '#e53935', icon: 'stethoscope' },
            { key: 'sector_environment', color: '#7cb342', icon: 'leaf' },
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
            const iconSize = Math.max(14, Math.min(22, nodeR * 0.8));
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

                // Sector icon, centred in the inner circle and fitted by its wider side
                const icon  = ICONS[s.icon];
                const scale = iconSize / Math.max(icon.w, 512);
                ctx.save();
                ctx.translate(p.x - icon.w * scale / 2, p.y - 512 * scale / 2);
                ctx.scale(scale, scale);
                ctx.fillStyle = s.color;
                ctx.fill(iconPaths[s.icon]);
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
