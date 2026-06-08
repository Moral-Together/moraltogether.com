document.addEventListener('DOMContentLoaded', () => {

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

    // --- Custom Cursor ---
    const cursor = document.querySelector('.custom-cursor');
    document.addEventListener('mousemove', e => {
        if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
    });
    document.querySelectorAll('a, button, .bento-card').forEach(el => {
        el.addEventListener('mouseenter', () => cursor?.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor?.classList.remove('hover'));
    });

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
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
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

    // ============================================================
    // HERO ANIMATION — Spinning rings + running огоньки (sparks)
    // ============================================================
    const heroAnimCanvas = document.getElementById('hero-anim-canvas');
    if (heroAnimCanvas) {
        const ctx = heroAnimCanvas.getContext('2d');
        let w, h, cx, cy;

        // Ring definitions: radius as fraction of min(w,h), color, rotation speed, dash pattern
        const RINGS = [
            { rf: 0.18, color: '#00c8ff', spd:  0.007,  lw: 2.2, dash: [32, 16] },
            { rf: 0.28, color: '#ff2d78', spd: -0.005,  lw: 1.8, dash: [24, 20] },
            { rf: 0.38, color: '#00ffb3', spd:  0.0035, lw: 1.5, dash: [18, 26] },
            { rf: 0.48, color: '#f9b80c', spd: -0.0025, lw: 1.2, dash: [14, 30] },
            { rf: 0.58, color: '#bf5af2', spd:  0.0018, lw: 1.0, dash: [10, 34] },
            { rf: 0.68, color: '#ff9500', spd: -0.0012, lw: 0.8, dash: [8,  38] },
        ];

        // Orbiters: glowing dots that travel along each ring
        let orbiters = [];
        RINGS.forEach((ring, ri) => {
            const count = 2 + ri;
            for (let i = 0; i < count; i++) {
                orbiters.push({
                    ri,
                    angle: (i / count) * Math.PI * 2,
                    mult: 0.75 + Math.random() * 0.55,
                    size: 3 + Math.random() * 3.5,
                });
            }
        });

        // Free sparks: fly off a ring, leave trail, fade out
        const SPARK_COUNT = 22;
        let sparks = [];

        let ringAngles = RINGS.map(() => Math.random() * Math.PI * 2);

        function resetSpark(s) {
            const ri = Math.floor(Math.random() * RINGS.length);
            const ring = RINGS[ri];
            const r = Math.min(w, h) * ring.rf;
            const a = Math.random() * Math.PI * 2;
            s.x  = cx + Math.cos(a) * r;
            s.y  = cy + Math.sin(a) * r;
            // shoot mostly tangentially, slight outward drift
            const ta = a + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
            const spd = 0.6 + Math.random() * 1.8;
            s.vx = Math.cos(ta) * spd + (Math.random() - 0.5) * 0.6;
            s.vy = Math.sin(ta) * spd + (Math.random() - 0.5) * 0.6;
            s.color = ring.color;
            s.size  = 1.8 + Math.random() * 2.5;
            s.age   = 0;
            s.life  = 55 + Math.floor(Math.random() * 80);
            s.trail = [];
        }

        function initSparks() {
            sparks = Array.from({ length: SPARK_COUNT }, () => {
                const s = {};
                resetSpark(s);
                s.age = Math.floor(Math.random() * s.life); // stagger
                return s;
            });
        }

        function resize() {
            w = heroAnimCanvas.width  = heroAnimCanvas.parentElement.clientWidth;
            h = heroAnimCanvas.height = heroAnimCanvas.parentElement.clientHeight;
            cx = w / 2;
            cy = h / 2;
            initSparks();
        }
        window.addEventListener('resize', resize);
        resize();

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const dark = document.body.classList.contains('dark-mode');
            const m = Math.min(w, h);

            // ---- Spinning dashed rings ----
            RINGS.forEach((ring, ri) => {
                ringAngles[ri] += ring.spd;
                const r = m * ring.rf;
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color + (dark ? '70' : '55');
                ctx.lineWidth = ring.lw;
                ctx.setLineDash(ring.dash);
                ctx.lineDashOffset = ringAngles[ri] * -r;
                ctx.stroke();
                ctx.restore();
            });

            // ---- Orbiting огоньки ----
            orbiters.forEach(o => {
                const ring = RINGS[o.ri];
                o.angle += ring.spd * o.mult * 1.5;
                const r  = m * ring.rf;
                const px = cx + Math.cos(o.angle) * r;
                const py = cy + Math.sin(o.angle) * r;
                const gr = dark ? o.size * 5 : o.size * 3.5;

                // Glow halo
                const glow = ctx.createRadialGradient(px, py, 0, px, py, gr);
                glow.addColorStop(0, ring.color + (dark ? 'cc' : '88'));
                glow.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(px, py, gr, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();

                // Core dot
                ctx.beginPath();
                ctx.arc(px, py, o.size * (dark ? 1.1 : 0.85), 0, Math.PI * 2);
                ctx.fillStyle = ring.color;
                ctx.globalAlpha = dark ? 0.95 : 0.78;
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            // ---- Flying sparks with trail ----
            sparks.forEach(s => {
                s.age++;
                if (s.age >= s.life) { resetSpark(s); return; }

                s.x += s.vx;
                s.y += s.vy;
                s.trail.push({ x: s.x, y: s.y });
                if (s.trail.length > 10) s.trail.shift();

                const ratio = 1 - s.age / s.life;
                const alpha = Math.sin(ratio * Math.PI) * (dark ? 0.9 : 0.7);

                // Trail fade
                s.trail.forEach((pt, ti) => {
                    const ta = (ti / s.trail.length) * alpha * 0.35;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, s.size * 0.45, 0, Math.PI * 2);
                    ctx.fillStyle = s.color;
                    ctx.globalAlpha = ta;
                    ctx.fill();
                });

                // Spark glow
                const sg = s.size * 4.5;
                const sgrd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, sg);
                sgrd.addColorStop(0, s.color + Math.round(alpha * 180).toString(16).padStart(2,'0'));
                sgrd.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(s.x, s.y, sg, 0, Math.PI * 2);
                ctx.globalAlpha = 1;
                ctx.fillStyle = sgrd;
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fillStyle = s.color;
                ctx.globalAlpha = alpha;
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            requestAnimationFrame(draw);
        }

        draw();
    }

});
