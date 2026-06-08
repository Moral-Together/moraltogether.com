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

    // --- Hero Orbit Canvas: hub → sector sparks ---
    const orbitCanvas = document.getElementById('hero-orbit-canvas');
    if (orbitCanvas) {
        const ctx = orbitCanvas.getContext('2d');

        const SECTORS = [
            { label: 'NGOs',       color: '#ff2d78' },
            { label: 'Business',   color: '#ff9500' },
            { label: 'Media',      color: '#f9b80c' },
            { label: 'Gov',        color: '#30d158' },
            { label: 'Academia',   color: '#00c8ff' },
            { label: 'Community',  color: '#bf5af2' },
        ];
        const SPARKS_PER_SECTOR = 3;
        const SPARK_SPEED = 0.0028;  // fraction of path per ms
        const HUB_RADIUS = 28;
        const NODE_RADIUS = 20;

        // Each spark: sectorIndex, t (0→1 = hub→sector), phase offset
        const sparks = [];
        SECTORS.forEach((s, si) => {
            for (let k = 0; k < SPARKS_PER_SECTOR; k++) {
                sparks.push({ si, t: k / SPARKS_PER_SECTOR });
            }
        });

        let W, H, cx, cy, sectorPositions;
        let lastTime = null;
        let hubPulse = 0;

        function resize() {
            W = orbitCanvas.offsetWidth;
            H = orbitCanvas.offsetHeight;
            orbitCanvas.width = W;
            orbitCanvas.height = H;
            cx = W / 2;
            cy = H / 2;
            const R = Math.min(W, H) * 0.36;
            sectorPositions = SECTORS.map((s, i) => {
                const angle = (i / SECTORS.length) * Math.PI * 2 - Math.PI / 2;
                return { x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R };
            });
        }
        resize();
        window.addEventListener('resize', resize);

        function drawHub() {
            // Outer glow ring
            const grd = ctx.createRadialGradient(cx, cy, HUB_RADIUS * 0.5, cx, cy, HUB_RADIUS + 22 + hubPulse * 14);
            grd.addColorStop(0, 'rgba(0,200,255,0.45)');
            grd.addColorStop(1, 'rgba(0,200,255,0)');
            ctx.beginPath();
            ctx.arc(cx, cy, HUB_RADIUS + 22 + hubPulse * 14, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();

            // Hub core
            const core = ctx.createRadialGradient(cx - 4, cy - 4, 3, cx, cy, HUB_RADIUS);
            core.addColorStop(0, '#ffffff');
            core.addColorStop(0.4, '#00c8ff');
            core.addColorStop(1, '#0040a0');
            ctx.beginPath();
            ctx.arc(cx, cy, HUB_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = core;
            ctx.fill();
        }

        function drawSectorNode(pos, sector) {
            // Node glow
            const grd = ctx.createRadialGradient(pos.x, pos.y, NODE_RADIUS * 0.3, pos.x, pos.y, NODE_RADIUS + 12);
            grd.addColorStop(0, sector.color + 'aa');
            grd.addColorStop(1, sector.color + '00');
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, NODE_RADIUS + 12, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();

            // Node disk
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = sector.color + '33';
            ctx.strokeStyle = sector.color;
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Label
            ctx.font = '500 11px Inter, sans-serif';
            ctx.fillStyle = sector.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sector.label, pos.x, pos.y);
        }

        function drawLine(pos, sector) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = sector.color + '1a';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        function drawSpark(spark) {
            const pos = sectorPositions[spark.si];
            const sx = cx + (pos.x - cx) * spark.t;
            const sy = cy + (pos.y - cy) * spark.t;
            const sector = SECTORS[spark.si];

            // Fade in at start, fade out at end
            const alpha = spark.t < 0.15
                ? spark.t / 0.15
                : spark.t > 0.80
                    ? (1 - spark.t) / 0.20
                    : 1;

            const sparkGrd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5);
            sparkGrd.addColorStop(0, sector.color);
            sparkGrd.addColorStop(1, sector.color + '00');
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = sparkGrd;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        function frame(ts) {
            if (!lastTime) lastTime = ts;
            const dt = ts - lastTime;
            lastTime = ts;

            ctx.clearRect(0, 0, W, H);

            hubPulse = (Math.sin(ts * 0.002) + 1) / 2;

            // Faint connecting lines
            SECTORS.forEach((s, i) => drawLine(sectorPositions[i], s));

            // Sector nodes
            SECTORS.forEach((s, i) => drawSectorNode(sectorPositions[i], s));

            // Hub on top
            drawHub();

            // Advance & draw sparks
            sparks.forEach(spark => {
                spark.t += SPARK_SPEED * dt;
                if (spark.t > 1) spark.t -= 1;
                drawSpark(spark);
            });

            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

});
