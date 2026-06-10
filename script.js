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

    // --- Comet Cursor ---
    const cometCanvas = document.getElementById('comet-cursor-canvas');
    if (cometCanvas && window.innerWidth > 768) {
        const cc = cometCanvas.getContext('2d');
        const TRAIL = 48;
        const NEON   = ['#00c8ff','#ff2d78','#00ffb3','#bf5af2','#ff9500','#f9b80c'];
        const BRIGHT = ['#0088ee','#e8003d','#00aa55','#8833cc','#e06800','#cc9900'];

        let cW, cH;
        const trail = [];
        let colorIdx = 0;
        let mouse = { x: -999, y: -999 };

        function resizeComet() {
            cW = window.innerWidth;
            cH = window.innerHeight;
            cometCanvas.width  = cW;
            cometCanvas.height = cH;
        }
        resizeComet();
        window.addEventListener('resize', resizeComet);

        const MAX_TRAIL_PX = 200; // max visual length in pixels

        document.addEventListener('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            trail.push({ x: e.clientX, y: e.clientY });
            if (trail.length > TRAIL) trail.shift();

            // trim by total pixel length so fast moves don't stretch the tail
            let total = 0;
            for (let i = trail.length - 1; i > 0; i--) {
                const dx = trail[i].x - trail[i - 1].x;
                const dy = trail[i].y - trail[i - 1].y;
                total += Math.sqrt(dx * dx + dy * dy);
                if (total > MAX_TRAIL_PX) {
                    trail.splice(0, i);
                    break;
                }
            }
        });

        // shift color every ~60 moves
        let moveCount = 0;
        document.addEventListener('mousemove', () => {
            if (++moveCount % 60 === 0) colorIdx = (colorIdx + 1) % NEON.length;
        });

        function hexToRgb(hex) {
            return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
        }

        function cometFrame() {
            cc.clearRect(0, 0, cW, cH);
            if (trail.length < 2) { requestAnimationFrame(cometFrame); return; }

            const dark = document.body.classList.contains('dark-mode');
            const palette = dark ? NEON : BRIGHT;
            const color = palette[colorIdx % palette.length];
            const [r, g, b] = hexToRgb(color);

            // build filled comet shape — left & right edges tapering to tail point
            const MAX_HALF_W = 9;
            const left = [], right = [];

            for (let i = 0; i < trail.length; i++) {
                const progress = i / (trail.length - 1); // 0=tail, 1=head
                const halfW = progress * MAX_HALF_W;

                // perpendicular normal at this point
                let nx, ny;
                if (i < trail.length - 1) {
                    const dx = trail[i + 1].x - trail[i].x;
                    const dy = trail[i + 1].y - trail[i].y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    nx = -dy / len; ny = dx / len;
                } else {
                    const dx = trail[i].x - trail[i - 1].x;
                    const dy = trail[i].y - trail[i - 1].y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    nx = -dy / len; ny = dx / len;
                }

                left.push({ x: trail[i].x + nx * halfW, y: trail[i].y + ny * halfW });
                right.push({ x: trail[i].x - nx * halfW, y: trail[i].y - ny * halfW });
            }

            // closed filled path: tail point → left edge → right edge back
            cc.beginPath();
            cc.moveTo(trail[0].x, trail[0].y);
            for (let i = 0; i < left.length; i++)  cc.lineTo(left[i].x,  left[i].y);
            for (let i = right.length - 1; i >= 0; i--) cc.lineTo(right[i].x, right[i].y);
            cc.closePath();

            // gradient along the trail axis: transparent at tail, solid at head
            const tx = trail[0].x, ty = trail[0].y;
            const hxg = trail[trail.length - 1].x, hyg = trail[trail.length - 1].y;
            const fillGrd = cc.createLinearGradient(tx, ty, hxg, hyg);
            fillGrd.addColorStop(0,   `rgba(${r},${g},${b},0)`);
            fillGrd.addColorStop(0.5, `rgba(${r},${g},${b},${dark ? 0.55 : 0.45})`);
            fillGrd.addColorStop(1,   `rgba(${r},${g},${b},${dark ? 0.90 : 0.78})`);
            cc.fillStyle = fillGrd;
            cc.fill();

            // glowing head
            const hx = mouse.x, hy = mouse.y;
            const grd = cc.createRadialGradient(hx, hy, 0, hx, hy, 28);
            grd.addColorStop(0, `rgba(${r},${g},${b},${dark ? 1 : 0.85})`);
            grd.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`);
            grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
            cc.beginPath();
            cc.arc(hx, hy, 28, 0, Math.PI * 2);
            cc.fillStyle = grd;
            cc.fill();

            // solid core dot
            cc.beginPath();
            cc.arc(hx, hy, 6, 0, Math.PI * 2);
            cc.fillStyle = `rgba(${r},${g},${b},1)`;
            cc.fill();

            requestAnimationFrame(cometFrame);
        }
        cometFrame();
    }

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
