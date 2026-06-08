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
    // 3D NEURAL SPHERE — Full-hero canvas
    // ============================================================
    const networkCanvas = document.getElementById('network-canvas');
    if (networkCanvas) {
        const ctx = networkCanvas.getContext('2d');
        let w, h, cx, cy;

        const SECTOR_COLORS  = ['#00c8ff', '#ff2d78', '#00ffb3', '#ff9500', '#bf5af2', '#f9b80c'];
        const SECTOR_LABELS  = ['NGOs', 'Business', 'Community', 'Gov', 'Academia', 'Media'];
        const NODE_COUNT     = 110;
        const K_NEAREST      = 3;   // connections per node
        const PULSE_COUNT    = 32;

        let rotY = 0, rotX = 0.22;
        let sphNodes, connections, pulses;

        // --- Fibonacci sphere ---
        function buildSphere(n, r) {
            const phi = Math.PI * (Math.sqrt(5) - 1);
            return Array.from({ length: n }, (_, i) => {
                const y      = 1 - (i / (n - 1)) * 2;
                const radius = Math.sqrt(1 - y * y);
                const theta  = phi * i;
                const ci     = i % SECTOR_COLORS.length;
                return {
                    ox:    Math.cos(theta) * radius * r,
                    oy:    y * r,
                    oz:    Math.sin(theta) * radius * r,
                    color: SECTOR_COLORS[ci],
                    label: i < SECTOR_LABELS.length ? SECTOR_LABELS[i] : '',
                    size:  i < SECTOR_LABELS.length ? 9 : 4.5,
                };
            });
        }

        // --- K-nearest-neighbor connections ---
        function buildConnections(pts) {
            const seen = new Set(), result = [];
            pts.forEach((p, i) => {
                const nearest = pts
                    .map((q, j) => {
                        if (j === i) return { j, d: Infinity };
                        const dx = p.ox - q.ox, dy = p.oy - q.oy, dz = p.oz - q.oz;
                        return { j, d: dx*dx + dy*dy + dz*dz };
                    })
                    .sort((a, b) => a.d - b.d)
                    .slice(0, K_NEAREST);
                nearest.forEach(({ j }) => {
                    const key = `${Math.min(i,j)}-${Math.max(i,j)}`;
                    if (!seen.has(key)) { seen.add(key); result.push([i, j]); }
                });
            });
            return result;
        }

        function init() {
            const r = Math.min(w, h) * (w < 600 ? 0.3 : 0.34);
            sphNodes    = buildSphere(NODE_COUNT, r);
            connections = buildConnections(sphNodes);
            pulses = Array.from({ length: Math.min(PULSE_COUNT, connections.length) }, (_, i) => ({
                ci:    i % connections.length,
                t:     i / PULSE_COUNT,
                speed: 0.003 + (i % 5) * 0.0014,
                fwd:   i % 2 === 0,
            }));
        }

        function resize() {
            w = networkCanvas.width  = window.innerWidth;
            h = networkCanvas.height = networkCanvas.parentElement.clientHeight || window.innerHeight;
            cx = w / 2; cy = h / 2;
            init();
        }
        window.addEventListener('resize', resize);
        resize();

        // --- 3D transform + perspective ---
        function project(ox, oy, oz) {
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const x1 = ox * cosY + oz * sinY;
            const z1 = -ox * sinY + oz * cosY;
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const y2 = oy * cosX - z1 * sinX;
            const z2 = oy * sinX + z1 * cosX;
            const fov = 650;
            const sc  = fov / (fov + z2);
            return { px: cx + x1 * sc, py: cy + y2 * sc, z: z2, sc };
        }

        // Depth alpha: 0 at far back, 1 at front
        function depthAlpha(z) {
            const r = Math.min(w, h) * (w < 600 ? 0.3 : 0.34);
            return Math.max(0, (z + r) / (2 * r));
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);

            // --- Dark cosmic background ---
            const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
            bg.addColorStop(0,   '#0d1a2e');
            bg.addColorStop(0.5, '#07101e');
            bg.addColorStop(1,   '#030810');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            // Auto-rotation
            rotY += 0.0025;

            // --- Project all nodes ---
            const proj = sphNodes.map(n => {
                const { px, py, z, sc } = project(n.ox, n.oy, n.oz);
                return { ...n, px, py, z, sc };
            });

            // Central sphere glow
            const r = Math.min(w, h) * (w < 600 ? 0.3 : 0.34);
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
            cg.addColorStop(0, 'rgba(0,200,255,0.07)');
            cg.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = cg;
            ctx.fill();

            // --- Connections ---
            connections.forEach(([i, j]) => {
                const a = proj[i], b = proj[j];
                const da = Math.min(depthAlpha(a.z), depthAlpha(b.z));
                if (da < 0.08) return;
                const alpha = da * 0.22;
                ctx.beginPath();
                ctx.moveTo(a.px, a.py);
                ctx.lineTo(b.px, b.py);
                ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
                ctx.lineWidth = 0.7;
                ctx.stroke();
            });

            // --- Pulse dots ---
            pulses.forEach(p => {
                p.t += p.speed;
                if (p.t > 1) p.t = 0;
                const [i, j] = connections[p.ci];
                const a = proj[i], b = proj[j];
                const t = p.fwd ? p.t : 1 - p.t;
                const px = a.px + (b.px - a.px) * t;
                const py = a.py + (b.py - a.py) * t;
                const pz = a.z  + (b.z  - a.z)  * t;
                const da = depthAlpha(pz);
                if (da < 0.15) return;
                // Halo
                ctx.beginPath();
                ctx.arc(px, py, 6 * da, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,200,255,${da * 0.12})`;
                ctx.fill();
                // Dot
                ctx.beginPath();
                ctx.arc(px, py, 2.2 * da, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,200,255,${da * 0.9})`;
                ctx.fill();
            });

            // --- Nodes: back → front ---
            proj.slice().sort((a, b) => a.z - b.z).forEach(p => {
                const da = depthAlpha(p.z);
                if (da < 0.06) return;
                const s = p.size * p.sc;

                // Glow for visible nodes
                if (da > 0.35) {
                    const gr = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, s * 3.5);
                    const hex = Math.round(da * 70).toString(16).padStart(2, '0');
                    gr.addColorStop(0, p.color + hex);
                    gr.addColorStop(1, 'transparent');
                    ctx.beginPath();
                    ctx.arc(p.px, p.py, s * 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = gr;
                    ctx.fill();
                }

                // Node fill
                const fillAlpha = Math.round(da * 255).toString(16).padStart(2, '0');
                ctx.beginPath();
                ctx.arc(p.px, p.py, Math.max(0.8, s), 0, Math.PI * 2);
                ctx.fillStyle = p.color + fillAlpha;
                ctx.fill();

                // Sector label (front-facing named nodes only)
                if (p.label && da > 0.6) {
                    const la = (da - 0.6) / 0.4;
                    const fs = Math.max(9, Math.round(10 * p.sc));
                    ctx.font = `600 ${fs}px Inter, sans-serif`;
                    ctx.fillStyle = `rgba(210,230,255,${la * 0.9})`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(p.label, p.px, p.py + s + 5 * p.sc);
                }
            });

            requestAnimationFrame(draw);
        }

        draw();
    }

});
