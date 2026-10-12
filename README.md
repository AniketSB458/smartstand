# SmartStand — Premium 3D Product Website

A responsive, accessible product website built with **HTML5, CSS3, vanilla JavaScript (ES6+) and Three.js**. No frameworks, no backend, no database, no API keys.

## Project structure

```
smartstand/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js            # navigation, theme, form, reveal, product controls
│   └── three-scene.js     # procedural 3D phone + stand (Three.js)
├── assets/
│   ├── favicon.svg
│   ├── og-image.svg       # social preview (see note below)
│   ├── smartstand-illustration.svg   # 3D fallback + About visual
│   └── vendor/
│       ├── three.min.js   # Three.js r149 (UMD build, MIT licence)
│       └── three.LICENSE
└── README.md
```

The 3D product is **fully procedural** (built from Three.js geometries, a procedural studio environment and a canvas-drawn phone screen), so no model or texture files are needed. Three.js is **vendored locally** and pinned to **r149**, so the site works offline and has no CDN dependency. The only external request is the optional Google Fonts stylesheet (Inter + Space Grotesk); system fonts are used if it cannot load.

## 1. Before you publish: set your email address

The enquiry form uses a `mailto:` link. Replace the placeholder `your-email@example.com` in **two** places:

1. `js/main.js`, in `CONFIG.businessEmail`.
2. `index.html`, in `<form id="enquiry-form" action="mailto:your-email@example.com" …>` (used only if JavaScript is unavailable).

The form never claims an email was sent. It opens the visitor's email app with a pre-filled draft and tells them to press **Send** there. A **Copy enquiry text** button is provided for people without a configured email app.

## 2. Run locally

The site uses plain scripts (no ES modules), so you can simply **double-click `index.html`**.

For a more realistic test, serve the folder:

```bash
cd smartstand
python3 -m http.server 8000
# then open http://localhost:8000
```

## 3. Deploy with GitHub Pages

1. Create a new repository on GitHub (for example `smartstand`).
2. Upload the **contents** of this folder (so `index.html` is at the repository root), or from a terminal:
   ```bash
   cd smartstand
   git init
   git add .
   git commit -m "SmartStand website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/smartstand.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/ (root)**, then **Save**.
5. After a minute, your site is live at `https://<your-username>.github.io/smartstand/`.

All asset paths are relative, so the site works from a sub-path like this.

**Social preview note:** many platforms (Facebook, X, LinkedIn) do not render SVG Open Graph images. Export `assets/og-image.svg` to a 1200×630 PNG, save it as `assets/og-image.png`, and change the two `og:image` references in `index.html` (use the full `https://…` URL once deployed).

## 4. Features at a glance

- Sticky navigation with scroll state, active-section highlighting, accessible mobile menu (closes on selection, Escape or outside click).
- Hero and product **Three.js** scenes: PBR metals, procedural studio reflections, soft shadows, contact shadow, drag-to-rotate, mouse parallax, keyboard rotation (arrow keys, Esc to reset), **Reset view** button.
- Product section: view presets (Angled / Front / Side / Back) and a **stand angle slider** that moves the real hinge and struts.
- **Ask About This Product** scrolls to the form and pre-fills the product name and enquiry type.
- Validated form with inline messages, loading state, success/error states and a properly encoded `mailto:` draft.
- Light/dark toggle (saved when browser storage is available, otherwise follows the OS setting).
- Performance: pixel-ratio cap, smaller shadow maps on mobile/low-core devices, render loop pauses when off-screen, tab hidden, or idle under reduced motion; product scene is created only when near the viewport; all listeners, geometries, materials, textures and the WebGL context are disposed on page unload.
- Resilience: if WebGL or Three.js is unavailable (or the context is lost) a static illustration replaces the canvas; the rest of the site is unaffected. Each JS feature starts independently, so one failure cannot break the others.
- `prefers-reduced-motion` respected (no sway, parallax, tilt, reveal motion or smooth scrolling).

## 5. Content notes

- The **₹100** figure is presented as an *estimated student-project price per unit* that may change with materials, production and delivery costs.
- No technical specifications (dimensions, load capacity, materials, durability), testimonials, certifications or statistics are claimed. The 3D model and illustration are labelled as concept visuals.

## 6. Testing checklist

**Navigation**
- [ ] Home, Features, Our Product, About, Contact links scroll to the right section.
- [ ] "Explore Product" (header and mobile menu), "Explore SmartStand" and "Contact Us" buttons work.
- [ ] Active link highlights while scrolling.
- [ ] Mobile menu opens/closes with the button, Escape, outside click, and after choosing a link.
- [ ] Tab through the page: focus ring is always visible; skip link works.

**3D**
- [ ] Hero model renders (phone on stand, shadows, reflections) and sways slowly.
- [ ] Mouse parallax, drag-to-rotate, arrow keys, Esc and **Reset view** work.
- [ ] Product model appears when scrolling to it; view buttons and angle slider work.
- [ ] Resize the window / rotate a phone: canvas stays sharp and undistorted.
- [ ] Block `assets/vendor/three.min.js` (DevTools → Network) and reload: illustration fallback shows, nothing else breaks.

**Form**
- [ ] Submit empty: inline errors on all four fields, focus moves to the first.
- [ ] Invalid email (e.g. `a@b`): rejected with a clear message.
- [ ] Valid entry: your email app opens with subject, body and recipient filled in.
- [ ] "Copy enquiry text" copies the details; status message appears.
- [ ] "Ask About This Product" pre-fills type + message and focuses the form.
- [ ] Footer "Ask about pricing / Bulk enquiries / Send feedback" pre-select the enquiry type.

**Responsive** (check 320, 375, 390, 430, 768, 1024, 1440, 1600+ px)
- [ ] No horizontal scrolling, clipped text or overlapping cards.
- [ ] Hero stacks correctly; product card stacks; form becomes one column on mobile.
- [ ] Touch: swiping the 3D model rotates it; vertical swipes still scroll the page.

**Other**
- [ ] Dark/light toggle works and persists after reload.
- [ ] With "Reduce motion" enabled in the OS, there is no sway/parallax/reveal animation.
- [ ] Footer year is current; back-to-top buttons work.
- [ ] DevTools console shows no errors (a one-line warning appears until you replace the placeholder email).
- [ ] Lighthouse: Accessibility, Best Practices and SEO scores are high.

## Credits

Three.js © 2010–2023 Three.js Authors, MIT licence (see `assets/vendor/three.LICENSE`). Fonts: Inter and Space Grotesk via Google Fonts (SIL Open Font License).
