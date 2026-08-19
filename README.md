# MoralTogether 🇮🇱✨

**MoralTogether** is a premium digital platform dedicated to creating an ecosystem of hope and action. The organization connects social initiatives, non-profits, and individuals to foster collaboration, knowledge sharing, and positive morale in Israeli society.

![Project Preview](https://via.placeholder.com/1200x600.png?text=MoralTogether+Preview)
*(Note: Replace with actual screenshot after deployment)*

---

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [✨ Key Features](#-key-features)
- [🎨 Design & UX](#-design--ux)
- [🛠 Tech Stack](#-tech-stack)
- [📂 Project Structure](#-project-structure)
- [🕯️ Shabbat Mode](#️-shabbat-mode)
- [🚀 Innovation & "Under the Hood"](#-innovation--under-the-hood)
- [💻 Getting Started](#-getting-started)
- [📄 License](#-license)

---

## 🌟 Project Overview
The goal of this project was to build a site that reflects the core values of **"Organized Abundance"** (שפע מאורגן). It moves away from standard non-profit designs to a **High-End, Cinematic Aesthetic** that inspires confidence and engagement.

The site serves as a hub for:
1.  **MoralForGood App**: A digital community for real-time help and resource sharing.
2.  **Radio M1**: A 24/7 positive content radio station.
3.  **Moral TV**: Educational podcasts and video content.

---

## ✨ Key Features

### 1. **Cinematic Entrance (Preloader)**
A custom-built, full-screen **Preloader** ensures a smooth first impression.
- **Graceful Loading**: The site content remains hidden until all assets are ready.
- **Fade-Out Animation**: Once loaded, the preloader lifts delicately, revealing the Hero section with a coordinated entrance animation.
- **Top-Tier Performance**: Optimized to feel instant yet deliberate.

### 2. **Infinite Marquee Gallery**
The "Gallery" section features a continuous, auto-scrolling horizontal loop.
- **Seamless Loop**: Duplicated card sets ensure there are never "blank spaces" during the scroll.
- **Interactive**: Hovering over any card pauses the animation, allowing users to focus on specific content (Connect, Community, Entrepreneurship, Hope).
- **Smooth CSS Animation**: Uses hardware-accelerated transforms for jitter-free movement.

### 3. **Smart Navigation & Mobile Drawer**
- **Scroll Spy**: The navigation menu automatically detects the current section as the user scrolls and highlights the active link.
- **Mobile-First**: A sleek "Hamburger" menu opens a slide-out drawer on smaller screens, ensuring full accessibility on mobile devices.
- **Sticky Glass Navbar**: The header blurs the content behind it, maintaining visibility without obstructing the design.

### 4. **Modern Partners Section**
Replaced generic logos with semantic, icon-based representations of key sectors:
- **Academy, Public Sector, Business, Non-Profits**.
- **Micro-Interactions**: Each partner card lifts and glows on hover, reinforcing the "premium" feel.

### 5. **Hybrid Scroll Animations**
We implemented a robust system to ensure content *always* appears, regardless of scroll speed or browser quirks:
- **Intersection Observer**: The primary engine that reveals elements as they enter the viewport.
- **Fallback Logic**: A secondary check ensures that if the Observer misses an element, a traditional scroll listener catches it.
- **Failsafe**: A final timer forces all content to reveal after a few seconds, guaranteeing usability.

---

## 🎨 Design & UX
The design language is **"Optimistic Premium"**:
- **Typography**: `Rubik` for bold, modern headings; `Heebo` for clean, readable body text.
- **Color Palette**:
    - **Primary**: Deep Royal Blue (`#0F4C81`) - Trust, Stability.
    - **Secondary**: Golden Orange (`#F5A623`) - Energy, Optimism.
    - **Background**: Dynamic "Orb" meshes and premium gradients.
- **Motion**: Everything has a purpose. Elements `reveal` on scroll, buttons lift on hover, and the preloader sets the stage.

---

## 🛠 Tech Stack
This project uses a robust, lightweight stack with **Zero Dependencies** (No Frameworks), ensuring maximum performance and longevity.

- **Core**:
    - `HTML5` (Semantic Structure, RTL Support)
    - `CSS3` (Variables, Flexbox, Keyframe Animations, Backdrop Filter)
    - `JavaScript (ES6+)` (Intersection Observer, Event Listeners)
- **External Libraries**:
    - `Font Awesome 6` (Icons)
    - `Google Fonts` (Typography)

---

## 📂 Project Structure
```bash
MoralTogether/
├── index.html       # Main structure (Semantic HTML)
├── partnerships.html# Partner organizations and initiatives
├── style.css        # The Design System (Variables, Animations, Layouts)
├── script.js        # Logic (Preloader, Scroll Spy, Infinite Marquee)
├── translations.js  # Copy for all three languages (EN / HE / GR)
├── tools/           # Build-time helpers (Shabbat windows builder)
├── docs/            # Technical specifications
├── README.md        # This Documentation
└── images/          # Assets and Gallery Images
```

---

## 🕯️ Shabbat Mode
The site closes for Shabbat at candle lighting and reopens at havdalah, using the exact times
of each individual week — both boundaries move by more than three hours across the year, so no
weekly schedule would do.

- **Source of truth**: Hebcal for Jerusalem (`geonameid=281184`), candle lighting 40 minutes
  before sunset (`b=40`), havdalah by nightfall (`M=on`), one request per year.
- **Storage**: [`tools/build-shabbat.mjs`](tools/build-shabbat.mjs) turns the feed into
  `api/shabbat.json` — Friday candle-lighting → havdalah pairs no longer than 30 hours —
  served from that same path. No backend: the site runs on GitHub Pages.
- **Refresh**: a weekly GitHub Actions run, lazy — while the next 60 days are covered it makes
  no request at all.
- **Scope**: Shabbat only. Jewish holidays do not close the site.

Full specification, data format, fallback chain and QA notes: [`docs/shabbat-mode.md`](docs/shabbat-mode.md).

---

## 🚀 Innovation & "Under the Hood"
### The "Failsafe" Reveal Logic
We engineered a multi-layer system to solve the common "content stays hidden" bug in modern scroll-animated sites.
```javascript
// script.js snippet
// 1. Primary: Intersection Observer
const revealObserver = new IntersectionObserver(...);

// 2. Fallback: Scroll Listener
const checkScroll = () => { ... };

// 3. Emergency: Safety Timeout
setTimeout(() => {
    reveals.forEach(reveal => reveal.classList.add('active'));
}, 4000);
```
This ensures 100% reliability across all devices and connection speeds.

---

## 💻 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge).
- A text editor (VS Code) if you want to edit.

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Moral-Together/MoralTogether.git
    ```
2.  **Open the project**:
    Simply open `index.html` in your browser.
    
    *Or, for a better experience:*
    ```bash
    cd MoralTogether
    python3 -m http.server
    # Open http://localhost:8000
    ```

---

## 📄 License
All rights reserved © 2026 **MoralTogether**.
Designed & Developed with ❤️ for Israeli Society.

Developed by [D371L](https://github.com/D371L).