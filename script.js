document.addEventListener('DOMContentLoaded', () => {

    // --- Reveal Animation on Scroll (Hybrid: Observer + Fallback) ---
    const reveals = document.querySelectorAll('.reveal');

    // 1. Intersection Observer
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        threshold: 0.1,
        rootMargin: "0px"
    });

    reveals.forEach(reveal => {
        revealObserver.observe(reveal);
    });

    // 2. Fallback Scroll Listener (for older browsers or edge cases)
    const checkScroll = () => {
        const triggerBottom = window.innerHeight * 0.9; // Trigger at 90% view height
        reveals.forEach(reveal => {
            const boxTop = reveal.getBoundingClientRect().top;
            if (boxTop < triggerBottom) {
                reveal.classList.add('active');
            }
        });
    };
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Check once on load

    // 3. Safety Timeout (Force show after 4s)
    setTimeout(() => {
        reveals.forEach(reveal => reveal.classList.add('active'));
    }, 4000);

    // --- Custom Cursor ---
    const cursor = document.querySelector('.custom-cursor');
    document.addEventListener('mousemove', (e) => {
        if (cursor) {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }
    });

    // Add hover effect to links and buttons
    const hoverElements = document.querySelectorAll('a, button, .bento-card');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor?.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor?.classList.remove('hover'));
    });

    // --- Scroll Progress Bar & Parallax Background ---
    const scrollBar = document.getElementById('scrollBar');
    const orbs = document.querySelectorAll('.orb');

    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;

        // Progress Bar
        if (scrollBar) {
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercentage = (scrollTop / scrollHeight) * 100;
            scrollBar.style.width = scrollPercentage + '%';
        }

        // Parallax Orbs (subtle movement inverse to scroll)
        orbs.forEach((orb, index) => {
            const speed = (index + 1) * 0.15; // Different speeds for depth
            orb.style.transform = `translateY(${scrollTop * speed}px)`;
        });
    });

    // --- Magnetic Buttons & Ripple Effect ---
    const magneticButtons = document.querySelectorAll('.btn');
    magneticButtons.forEach(btn => {
        // Magnetic Hover
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
        });

        // Ripple Effect
        btn.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // --- Dark Mode Toggle ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;

    // Check saved preference
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');

            // Save preference
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
            } else {
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // --- Navbar Scroll Effect ---
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Active Link Highlighter (Scroll Spy) ---
    const sections = document.querySelectorAll('section, header');
    const navLinks = document.querySelectorAll('.nav-link');

    const setActiveLink = () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            // -150 offset to trigger active state slightly before the section hits top
            if (pageYOffset >= (sectionTop - 250)) {
                current = section.getAttribute('id');
            }
        });

        // Special case: If at bottom of page, activate Contact
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
            current = 'contact';
        }

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', setActiveLink);
    setActiveLink(); // Run on load

    // --- Spotlight & 3D Tilt Effect for Cards ---
    const cards = document.querySelectorAll('.bento-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Spotlight variables
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);

            // 3D Tilt calculation
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -5; // Limit to 5 degrees
            const rotateY = ((x - centerX) / centerX) * 5;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
            // Reset transition specifically for leave to be smooth
            card.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease, background 0.4s';
        });

        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease'; // Fast transition while hovering to follow mouse closely
        });
    });

    // --- Mobile Menu Toggle ---
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close menu when link is clicked
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        if (hamburger.classList.contains('active')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }
    }));

    // --- Scroll Indicator Click ---
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.style.cursor = 'pointer';
        scrollIndicator.addEventListener('click', () => {
            const aboutSection = document.querySelector('#about');
            if (aboutSection) {
                aboutSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --- Preloader ---
    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            setTimeout(() => {
                preloader.classList.add('fade-out');
                // Force hero text animation once preloader is gone
                document.body.classList.add('loaded');
            }, 800);
        }
    });

    // --- Hero Particles Constellation ---
    const canvas = document.getElementById('hero-particles');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        const particleCount = window.innerWidth < 768 ? 40 : 80;

        let mouse = { x: null, y: null, radius: 150 };

        function resizeCanvas() {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        }

        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles();
        });
        resizeCanvas();

        const hero = document.querySelector('.hero');
        if (hero) {
            hero.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            });
            hero.addEventListener('mouseleave', () => {
                mouse.x = null;
                mouse.y = null;
            });
        }

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.5;
                this.density = (Math.random() * 30) + 1;
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
            }
            draw() {
                const isDarkMode = document.body.classList.contains('dark-mode');
                ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 76, 129, 0.4)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse repel logic
                if (mouse.x != null && mouse.y != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < mouse.radius) {
                        let forceDirectionX = dx / distance;
                        let forceDirectionY = dy / distance;
                        let force = (mouse.radius - distance) / mouse.radius;
                        let directionX = forceDirectionX * force * this.density;
                        let directionY = forceDirectionY * force * this.density;
                        this.x -= directionX * 0.15;
                        this.y -= directionY * 0.15;
                    }
                }
            }
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }

        function animateParticles() {
            ctx.clearRect(0, 0, width, height);
            const isDarkMode = document.body.classList.contains('dark-mode');

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                // Connect particles
                for (let j = i; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 110) {
                        ctx.beginPath();
                        ctx.strokeStyle = isDarkMode
                            ? `rgba(255, 255, 255, ${0.3 - distance / 366})`
                            : `rgba(15, 76, 129, ${0.25 - distance / 440})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                        ctx.closePath();
                    }
                }

                // Connect to mouse
                if (mouse.x != null && mouse.y != null) {
                    const mDx = particles[i].x - mouse.x;
                    const mDy = particles[i].y - mouse.y;
                    const mDistance = Math.sqrt(mDx * mDx + mDy * mDy);
                    if (mDistance < 150) {
                        ctx.beginPath();
                        ctx.strokeStyle = isDarkMode
                            ? `rgba(248, 231, 28, ${0.5 - mDistance / 300})`
                            : `rgba(245, 166, 35, ${0.5 - mDistance / 300})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                        ctx.closePath();
                    }
                }
            }
            requestAnimationFrame(animateParticles);
        }

        initParticles();
        animateParticles();
    }

});
