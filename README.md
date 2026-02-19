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

### 1. **Symmetric "1-Over-2" Activities Grid**
We abandoned the traditional unequal "Bento Grid" for a perfectly balanced layout:
- **Hero Card (Top)**: Full-width card for the flagship **MoralForGood** app.
- **Twin Cards (Bottom)**: Two equal-sized cards for **Radio M1** and **Moral TV**.
- **Result**: A scalable, pyramid-like structure that visually prioritizes the main product while maintaining harmony.

### 2. **"Jewel Box" Glassmorphism**
The UI uses advanced CSS backdrop filters to create a "frosted glass" effect:
- **Translucent Cards**: `backdrop-filter: blur(20px)` with semi-transparent white backgrounds.
- **Gradient Borders**: Each activity card has a unique top-border gradient (Blue, Pink, Purple) to give it a distinct identity.
- **Hover Lift**: Cards elevate (`translateY`) with a deep shadow on hover, feeling tactile and premium.

### 3. **Smart Navigation (Scroll Spy)**
- **Active Link Highlighting**: The navigation menu automatically detects the current section as the user scrolls and highlights the corresponding link (e.g., "About" turns gold when reading the About section).
- **Home Link**: A dedicated "Home" (בית) link was added for better UX.
- **Sticky Glass Navbar**: The header blurs the content behind it as you scroll.

### 4. **Editorial "Our Story" Layout**
The "About" section features a magazine-style layout:
- **Vertical Accent Line**: A gold border running alongside the text for visual structure.
- **Floating Value Cards**: Core values are displayed as floating "glass jewels" rather than a boring list.
- **Inspirational Quote Box**: A styled container for the founder's vision.

### 5. **Custom Scroll Experience**
- **Themed Scrollbar**: A custom Webkit scrollbar with a Blue-to-Gold gradient thumb, replacing the default browser bar for a cohesive look.
- **Smooth Scrolling**: `scroll-behavior: smooth` is enabled globally.

---

## 🎨 Design & UX
The design language is **"Optimistic Premium"**:
- **Typography**: `Rubik` for bold, modern headings; `Heebo` for clean, readable body text.
- **Color Palette**:
    - **Primary**: Deep Royal Blue (`#0F4C81`) - Trust, Stability.
    - **Secondary**: Golden Orange (`#F5A623`) - Energy, Optimism.
    - **Background**: Dynamic "Orb" meshes (animated gradients) that float subtly behind the glass layers.
- **Motion**: Everything has a purpose. Elements `reveal` on scroll, buttons lift on hover, and text has a subtle shimmer effect.

---

## 🛠 Tech Stack
This project uses a robust, lightweight stack with **Zero Dependencies** (No Frameworks), ensuring maximum performance and longevity.

- **Core**:
    - `HTML5` (Semantic Structure, RTL Support)
    - `CSS3` (Variables, Flexbox, CSS Grid, Keyframe Animations)
    - `JavaScript (ES6+)` (Intersection Observer, Event Listeners)
- **External Libraries**:
    - `Font Awesome 6` (Icons)
    - `Google Fonts` (Typography)

---

## 📂 Project Structure
```bash
MoralTogether/
├── index.html       # Main structure (Semantic HTML)
├── style.css        # The Design System (Variables, Animations, Layouts)
├── script.js        # Logic (Scroll Spy, Reveal Animations, Mouse Effects)
├── README.md        # This Documentation
└── assets/          # (Future) Images and Logos
```

---

## 🚀 Innovation & "Under the Hood"
### The CSS "Mouse Tracking" Effect
We implemented a spotlight effect where a subtle glow follows the user's mouse cursor over the cards.
```javascript
// script.js snippet
card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
});
```
This updates CSS variables in real-time to create a radial gradient at the cursor's position!

---

## 💻 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge).
- A text editor (VS Code) if you want to edit.

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/YourUsername/MoralTogether.git
    ```
2.  **Open the project**:
    Simply open `index.html` in your browser.
    
    *Or, for a better experience (to see modules/CORS features if added later):*
    ```bash
    cd MoralTogether
    python3 -m http.server
    # Open http://localhost:8000
    ```

---

## 📄 License
All rights reserved © 2026 **MoralTogether**.
Designed & Developed with ❤️ for Israeli Society.