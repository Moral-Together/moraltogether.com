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

    // --- Hero floating dots ---
    const dotsCanvas = document.getElementById('hero-dots-canvas');
    if (dotsCanvas) {
        const dctx = dotsCanvas.getContext('2d');
        const DOT_COUNT = 55;
        const MAX_DIST = 140;
        const SPEED = 0.28;
        let dW, dH, textZone;
        const dots = [];

        function dotsResize() {
            dW = dotsCanvas.offsetWidth;
            dH = dotsCanvas.offsetHeight;
            dotsCanvas.width  = dW;
            dotsCanvas.height = dH;
            // zone occupied by text panel (left ~45%, full height)
            textZone = { x: 0, y: 0, w: dW * 0.46, h: dH };
        }

        function makeDotsOutsideText() {
            dots.length = 0;
            for (let i = 0; i < DOT_COUNT; i++) {
                let x, y;
                // place dots only in right 55% OR upper/lower strips
                do {
                    x = Math.random() * dW;
                    y = Math.random() * dH;
                } while (x < textZone.w && y > dH * 0.15 && y < dH * 0.85);

                const angle = Math.random() * Math.PI * 2;
                dots.push({
                    x, y,
                    vx: Math.cos(angle) * SPEED * (0.5 + Math.random() * 0.8),
                    vy: Math.sin(angle) * SPEED * (0.5 + Math.random() * 0.8),
                    r: 1.5 + Math.random() * 2,
                });
            }
        }

        dotsResize();
        makeDotsOutsideText();
        window.addEventListener('resize', () => { dotsResize(); makeDotsOutsideText(); });

        function getDotColors() {
            const dark = document.body.classList.contains('dark-mode');
            return {
                dot:  dark ? 'rgba(0, 200, 255, 0.65)' : 'rgba(0, 80, 200, 0.35)',
                line: dark ? 'rgba(0, 200, 255, '       : 'rgba(0, 80, 200, ',
            };
        }

        function dotsTick() {
            dctx.clearRect(0, 0, dW, dH);
            const col = getDotColors();

            dots.forEach(d => {
                // bounce off edges
                if (d.x < 0 || d.x > dW) d.vx *= -1;
                if (d.y < 0 || d.y > dH) d.vy *= -1;
                // gently steer away from text zone
                if (d.x < textZone.w && d.y > dH * 0.15 && d.y < dH * 0.85) {
                    d.vx += 0.012;
                }
                d.x += d.vx;
                d.y += d.vy;
            });

            // draw lines between close dots
            for (let i = 0; i < dots.length; i++) {
                for (let j = i + 1; j < dots.length; j++) {
                    const dx = dots[i].x - dots[j].x;
                    const dy = dots[i].y - dots[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MAX_DIST) {
                        const alpha = (1 - dist / MAX_DIST) * 0.35;
                        dctx.beginPath();
                        dctx.moveTo(dots[i].x, dots[i].y);
                        dctx.lineTo(dots[j].x, dots[j].y);
                        dctx.strokeStyle = col.line + alpha + ')';
                        dctx.lineWidth = 0.8;
                        dctx.stroke();
                    }
                }
            }

            // draw dots
            dots.forEach(d => {
                dctx.beginPath();
                dctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                dctx.fillStyle = col.dot;
                dctx.fill();
            });

            requestAnimationFrame(dotsTick);
        }
        requestAnimationFrame(dotsTick);
    }

});
