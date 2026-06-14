document.addEventListener('DOMContentLoaded', () => {

    // --- i18n Language Engine ---
    function applyLanguage(lang) {
        const t = TRANSLATIONS[lang];
        if (!t) return;

        // Set html lang only — layout stays LTR for all languages
        document.documentElement.setAttribute('lang', lang);

        // Translate text nodes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key] !== undefined) el.innerHTML = t[key];
        });

        // Translate innerHTML (preserves inner spans like vision-highlight)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (t[key] !== undefined) el.innerHTML = t[key];
        });

        // Update <title>
        if (t.meta_title) document.title = t.meta_title;

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && t.meta_description) metaDesc.setAttribute('content', t.meta_description);

        // Update active button
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Save to localStorage
        localStorage.setItem('lang', lang);

        // Notify canvas renderers to redraw with new language
        document.dispatchEvent(new CustomEvent('langChanged'));
    }

    // Wire up buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang')));
    });

    // Restore saved language (default: 'en')
    const savedLang = localStorage.getItem('lang') || 'en';
    applyLanguage(savedLang);

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

    // --- Magnetic Buttons + Ripple ---
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const r = btn.getBoundingClientRect();
            btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.3}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; });
        btn.addEventListener('click', function(e) {
            const r = this.getBoundingClientRect();
            const rpl = document.createElement('span');
            rpl.classList.add('ripple');
            rpl.style.left = `${e.clientX - r.left}px`;
            rpl.style.top = `${e.clientY - r.top}px`;
            this.appendChild(rpl);
            setTimeout(() => rpl.remove(), 600);
        });
    });

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
    const navLinks = document.querySelectorAll('.nav-link');
    const setActive = () => {
        let current = '';
        sections.forEach(s => { if (pageYOffset >= s.offsetTop - 250) current = s.getAttribute('id'); });
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) current = 'contact';
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href').includes(current)));
    };
    window.addEventListener('scroll', setActive);
    setActive();

    // --- Bento Card 3D Tilt + Spotlight ---
    document.querySelectorAll('.bento-card').forEach(card => {
        card.addEventListener('mousemove', e => {
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
    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    navLinks.forEach(n => n.addEventListener('click', () => {
        if (hamburger?.classList.contains('active')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }
    }));

    // --- Folder cards: tap-to-open on touch/mobile ---
    const folderCards = document.querySelectorAll('.folder-card');
    folderCards.forEach(card => {
        card.addEventListener('click', () => {
            if (window.innerWidth > 1024) return;
            const isOpen = card.classList.contains('open');
            folderCards.forEach(c => c.classList.remove('open'));
            if (!isOpen) card.classList.add('open');
        });
    });

    // --- Scroll Indicator ---
    const scrollInd = document.querySelector('.scroll-indicator');
    if (scrollInd) {
        scrollInd.style.cursor = 'pointer';
        scrollInd.addEventListener('click', () => document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' }));
    }

    // --- Preloader ---
    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            setTimeout(() => {
                preloader.classList.add('fade-out');
                document.body.classList.add('loaded');
            }, 800);
        }
    });

    // --- Hero comet dots ---
    const dotsCanvas = document.getElementById('hero-dots-canvas');
    if (dotsCanvas) {
        const dctx = dotsCanvas.getContext('2d');
        const DOT_COUNT  = 18;
        const TRAIL_LEN  = 28;
        const SPEED      = 0.55;

        const NEON_COLORS  = ['#00c8ff','#ff2d78','#00ffb3','#bf5af2','#ff9500','#f9b80c'];
        const LIGHT_COLORS = ['#0088ee','#e8003d','#00aa55','#8833cc','#e06800','#cc9900'];

        let dW, dH, textZone;
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
                    r: 2 + Math.random() * 1.5,
                    colorIdx: i % NEON_COLORS.length,
                    trail,
                });
            }
        }

        dotsResize();
        initComets();
        window.addEventListener('resize', () => { dotsResize(); initComets(); });

        function hexToRgb(hex) {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return `${r},${g},${b}`;
        }

        function cometsTick() {
            dctx.clearRect(0, 0, dW, dH);
            const dark = document.body.classList.contains('dark-mode');
            const palette = dark ? NEON_COLORS : LIGHT_COLORS;

            comets.forEach(c => {
                // bounce + steer away from text zone
                if (c.x < 0 || c.x > dW) c.vx *= -1;
                if (c.y < 0 || c.y > dH) c.vy *= -1;
                if (c.x < textZone.w && c.y > textZone.hMin && c.y < textZone.hMax) {
                    c.vx += 0.02;
                }
                c.x += c.vx;
                c.y += c.vy;

                // update trail
                c.trail.push({ x: c.x, y: c.y });
                if (c.trail.length > TRAIL_LEN) c.trail.shift();

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

            requestAnimationFrame(cometsTick);
        }
        requestAnimationFrame(cometsTick);
    }

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
        ];

        let W, H, cx, cy, radius;
        let pulses = [];
        let raf = null;

        // Preload center logo
        const logoImg = new Image();
        logoImg.src = 'images/Favicon MoralTogether.png';
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

        function tick() {
            pulses.forEach(p => {
                p.t += p.speed;
                if (p.t > 1) p.t = 0;
            });
            draw();
            raf = requestAnimationFrame(tick);
        }

        function start() { if (!raf) raf = requestAnimationFrame(tick); }
        function stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }

        const observer = new IntersectionObserver(entries => {
            entries[0].isIntersecting ? start() : stop();
        }, { threshold: 0.1 });

        resize();
        initPulses();
        observer.observe(canvas);

        window.addEventListener('resize', () => { resize(); draw(); });
        document.addEventListener('themeChanged', () => draw());
        document.addEventListener('langChanged', () => draw());
    })();

    // Gallery Modal
    const GALLERY_IMAGES = [
        { src: 'images/connect.png', title: 'Connections' },
        { src: 'images/nature.png',  title: 'Community' },
        { src: 'images/urban.png',   title: 'Entrepreneurship' },
        { src: 'images/art.png',     title: 'Hope' },
    ];

    const modal       = document.getElementById('galleryModal');
    const modalImg    = document.getElementById('galleryModalImg');
    const modalTitle  = document.getElementById('galleryModalTitle');
    const modalClose  = modal.querySelector('.gallery-modal-close');
    const modalPrev   = modal.querySelector('.gallery-modal-prev');
    const modalNext   = modal.querySelector('.gallery-modal-next');
    const backdrop    = modal.querySelector('.gallery-modal-backdrop');
    const galleryScroll = document.querySelector('.gallery-scroll');
    let currentIndex  = 0;

    function openModal(index) {
        currentIndex = index;
        modalImg.src = GALLERY_IMAGES[currentIndex].src;
        modalImg.alt = GALLERY_IMAGES[currentIndex].title;
        modalTitle.textContent = GALLERY_IMAGES[currentIndex].title;
        modal.classList.add('is-open');
        if (galleryScroll) galleryScroll.style.animationPlayState = 'paused';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('is-open');
        if (galleryScroll) galleryScroll.style.animationPlayState = '';
        document.body.style.overflow = '';
    }

    function navigate(dir) {
        currentIndex = (currentIndex + dir + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
        modalImg.src = GALLERY_IMAGES[currentIndex].src;
        modalImg.alt = GALLERY_IMAGES[currentIndex].title;
        modalTitle.textContent = GALLERY_IMAGES[currentIndex].title;
    }

    document.querySelectorAll('.gallery-card').forEach(card => {
        card.addEventListener('click', () => openModal(parseInt(card.dataset.index, 10)));
    });

    modalClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    modalPrev.addEventListener('click', () => navigate(-1));
    modalNext.addEventListener('click', () => navigate(1));

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('is-open')) return;
        if (e.key === 'ArrowLeft')  navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key === 'Escape')     closeModal();
    });

});
