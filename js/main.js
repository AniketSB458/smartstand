/**
 * SmartStand — main.js
 * ---------------------------------------------------------------------------
 * All page behaviour (vanilla ES6+). Every module is initialised inside its
 * own try/catch, so a failure in one feature (for example the 3D scene) never
 * stops navigation, the form, or anything else from working.
 */
(function () {
  'use strict';

  /* ====================================================================
     CONFIGURATION — edit these values
     ==================================================================== */
  var CONFIG = {
    whatsappNumber: '919511809293',
    whatsappDisplay: '+91 95118 09293',
    businessEmail: 'your-email@example.com',
    productName: 'Multi-Purpose Adjustable Mobile Stand',
    themeStorageKey: 'smartstand-theme',
    defaultTilt: 22
  };

  /* ====================================================================
     Helpers
     ==================================================================== */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  var storage = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  var cleanups = [];
  function on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    cleanups.push(function () { target.removeEventListener(type, handler, opts); });
  }
  function init(name, fn) {
    try { fn(); } catch (err) { console.error('[SmartStand] "' + name + '" failed to start:', err); }
  }
  function rafThrottle(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; fn(); });
    };
  }

  var scenes = { hero: null, product: null };

  /* ====================================================================
     Theme toggle (Classic White/Gray <-> Instagram Pink & White)
     ==================================================================== */
  function initTheme() {
    var root = document.documentElement;
    var btn = $('#theme-toggle');
    var meta = $('meta[name="theme-color"]');

    function apply(theme, persist) {
      var isInsta = theme === 'instagram';
      var activeTheme = isInsta ? 'instagram' : 'light';
      root.setAttribute('data-theme', activeTheme);
      if (meta) meta.setAttribute('content', isInsta ? '#ffffff' : '#f6f7f9');
      if (btn) {
        btn.setAttribute('aria-pressed', String(isInsta));
        btn.setAttribute('aria-label', isInsta ? 'Switch to classic white and gray appearance' : 'Switch to Instagram pink and white appearance');
        btn.setAttribute('title', isInsta ? 'Switch to Classic White & Gray theme' : 'Switch to Instagram Pink & White theme');
      }
      if (scenes.hero && scenes.hero.setTheme) scenes.hero.setTheme(false);
      if (persist) storage.set(CONFIG.themeStorageKey, activeTheme);
    }

    var saved = storage.get(CONFIG.themeStorageKey);
    var current = saved === 'light' ? 'light' : 'instagram';
    apply(current, false);

    if (btn) {
      on(btn, 'click', function () {
        var now = root.getAttribute('data-theme') === 'instagram' ? 'light' : 'instagram';
        apply(now, true);
      });
    }
  }

  /* ====================================================================
     Header: scrolled state, mobile menu, active-section highlighting
     ==================================================================== */
  function initNav() {
    var header = $('#site-header');
    var toggle = $('#nav-toggle');
    var list = $('#primary-nav');
    if (!header) return;

    var onScroll = rafThrottle(function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    });
    on(window, 'scroll', onScroll, { passive: true });
    onScroll();

    function setMenu(open, returnFocus) {
      header.classList.toggle('is-open', open);
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        if (!open && returnFocus) toggle.focus();
      }
    }
    if (toggle) {
      on(toggle, 'click', function () { setMenu(!header.classList.contains('is-open')); });
    }
    // Close the mobile menu after choosing a destination.
    $$('a', list).forEach(function (a) { on(a, 'click', function () { setMenu(false); }); });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) setMenu(false, true);
    });
    on(document, 'click', function (e) {
      if (header.classList.contains('is-open') && !header.contains(e.target)) setMenu(false);
    });
    on(window, 'resize', rafThrottle(function () {
      if (window.innerWidth >= 900 && header.classList.contains('is-open')) setMenu(false);
    }));

    // Active-section highlighting
    var links = $$('.nav__link', list);
    var map = {};
    links.forEach(function (l) { map[l.getAttribute('href').slice(1)] = l; });
    var sections = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);

    function setActive(id) {
      links.forEach(function (l) {
        var active = l.getAttribute('href') === '#' + id;
        l.classList.toggle('is-active', active);
        if (active) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
      cleanups.push(function () { io.disconnect(); });
    } else {
      setActive('home');
    }
  }

  /* ====================================================================
     Reveal-on-scroll (IntersectionObserver)
     ==================================================================== */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reducedMotion()) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
    cleanups.push(function () { io.disconnect(); });
    // Safety net: never leave content hidden.
    window.setTimeout(function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible');
      });
    }, 1800);
  }

  /* ====================================================================
     Subtle pointer tilt on cards (fine pointers only)
     ==================================================================== */
  function initTilt() {
    if (reducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('.tilt').forEach(function (el) {
      on(el, 'pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (px * 5).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
      });
      on(el, 'pointerleave', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ====================================================================
     3D scenes (hero + product), with graceful fallback
     ==================================================================== */
  function showFallback(stage) {
    if (stage) stage.classList.add('is-fallback');
  }

  function initScenes() {
    var S = window.SmartStandScene;

    // Hero
    var heroStage = $('#hero-stage'), heroCanvas = $('#hero-canvas');
    if (heroStage && heroCanvas) {
      if (!S) {
        showFallback(heroStage);
      } else {
        scenes.hero = S.create(heroCanvas, {
          variant: 'hero', stage: heroStage,
          onFallback: function () { scenes.hero = null; showFallback(heroStage); }
        });
        if (scenes.hero && scenes.hero.setTheme) scenes.hero.setTheme(false);
      }
      var resetHero = $('#hero-reset');
      if (resetHero) on(resetHero, 'click', function () { if (scenes.hero) scenes.hero.reset(); });
    }

    // Product (created lazily when it nears the viewport)
    var prodStage = $('#product-stage'), prodCanvas = $('#product-canvas');
    if (!prodStage || !prodCanvas) return;

    var viewButtons = $$('[data-view]');
    var range = $('#angle-range'), out = $('#angle-out');

    function setPressed(name) {
      viewButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === name)); });
    }
    function startProduct() {
      if (scenes.product || prodStage.classList.contains('is-fallback')) return;
      if (!S) { showFallback(prodStage); return; }
      scenes.product = S.create(prodCanvas, {
        variant: 'product', stage: prodStage,
        onUserRotate: function () { setPressed(''); },
        onFallback: function () { scenes.product = null; showFallback(prodStage); }
      });
      if (scenes.product && range) scenes.product.setTilt(Number(range.value));
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { startProduct(); obs.disconnect(); }
      }, { rootMargin: '300px 0px' });
      io.observe(prodStage);
      cleanups.push(function () { io.disconnect(); });
    } else {
      startProduct();
    }

    viewButtons.forEach(function (b) {
      on(b, 'click', function () {
        setPressed(b.getAttribute('data-view'));
        if (scenes.product) scenes.product.setView(b.getAttribute('data-view'));
      });
    });
    if (range) {
      on(range, 'input', function () {
        if (out) out.textContent = range.value + '°';
        if (scenes.product) scenes.product.setTilt(Number(range.value));
      });
    }
  }

  /* ====================================================================
     Enquiry form → mailto: draft
     ==================================================================== */
  function initForm() {
    var form = $('#enquiry-form');
    if (!form) return;

    form.setAttribute('action', 'https://wa.me/' + CONFIG.whatsappNumber);

    var fields = {
      name: $('#enquiry-name'),
      email: $('#enquiry-email'),
      type: $('#enquiry-type'),
      message: $('#enquiry-message')
    };
    var errorEls = {
      name: $('#name-error'), email: $('#email-error'), type: $('#type-error'), message: $('#message-error')
    };
    var submitBtn = $('#submit-btn');
    var submitLabel = $('.btn__label', submitBtn);
    var copyBtn = $('#copy-btn');
    var statusEl = $('#form-status');
    var counter = $('#message-count');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var touched = {};

    function values() {
      return {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        type: fields.type.value,
        message: fields.message.value.trim()
      };
    }
    function validateField(key, v) {
      switch (key) {
        case 'name':
          if (!v.name) return 'Enter your full name.';
          if (v.name.length < 2) return 'Your name needs at least 2 characters.';
          return '';
        case 'email':
          if (!v.email) return 'Enter your email address.';
          if (!EMAIL_RE.test(v.email)) return 'Enter a valid email address, like name@example.com.';
          return '';
        case 'type':
          return v.type ? '' : 'Choose what your enquiry is about.';
        case 'message':
          if (!v.message) return 'Write a short message.';
          if (v.message.length < 10) return 'Add a little more detail (at least 10 characters).';
          return '';
      }
      return '';
    }
    function showError(key, msg) {
      var el = errorEls[key], input = fields[key];
      if (!el || !input) return;
      if (msg) {
        el.textContent = msg; el.hidden = false; input.setAttribute('aria-invalid', 'true');
      } else {
        el.textContent = ''; el.hidden = true; input.removeAttribute('aria-invalid');
      }
    }
    function validateAll(focusFirst) {
      var v = values(), firstBad = null, ok = true;
      Object.keys(fields).forEach(function (k) {
        var msg = validateField(k, v);
        showError(k, msg);
        if (msg) { ok = false; if (!firstBad) firstBad = fields[k]; }
      });
      if (!ok && focusFirst && firstBad) firstBad.focus();
      return ok;
    }
    function setStatus(kind, title, text) {
      if (!statusEl) return;
      statusEl.className = 'form__status form__status--' + kind;
      statusEl.innerHTML = '';
      var strong = document.createElement('strong');
      strong.textContent = title;
      statusEl.appendChild(strong);
      statusEl.appendChild(document.createTextNode(text));
      statusEl.hidden = false;
    }
    function clearStatus() { if (statusEl) { statusEl.hidden = true; statusEl.textContent = ''; } }

    function enquiryText(v) {
      return [
        'Hi SmartStand! I have an enquiry:',
        '',
        'Name: ' + v.name,
        'Email: ' + v.email,
        'Enquiry Type: ' + v.type,
        '',
        'Message:',
        v.message
      ].join('\n');
    }
    function buildWhatsAppUrl(v) {
      return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(enquiryText(v));
    }
    function setBusy(busy) {
      submitBtn.disabled = busy;
      submitBtn.setAttribute('aria-busy', String(busy));
      if (submitLabel) submitLabel.textContent = busy ? 'Opening WhatsApp…' : 'Chat on WhatsApp';
    }

    // Live validation after a field has been visited
    Object.keys(fields).forEach(function (k) {
      on(fields[k], 'blur', function () { touched[k] = true; showError(k, validateField(k, values())); });
      on(fields[k], 'input', function () { if (touched[k]) showError(k, validateField(k, values())); });
      on(fields[k], 'change', function () { if (touched[k]) showError(k, validateField(k, values())); });
    });
    function updateCount() { if (counter) counter.textContent = fields.message.value.length + ' / ' + fields.message.maxLength; }
    on(fields.message, 'input', function () { fields.message.dataset.autofill = ''; updateCount(); });
    updateCount();

    on(form, 'submit', function (e) {
      e.preventDefault();
      clearStatus();
      if (!validateAll(true)) {
        setStatus('error', 'Please check the form. ', 'Fix the highlighted fields and try again.');
        return;
      }
      try {
        var url = buildWhatsAppUrl(values());
        setBusy(true);
        window.setTimeout(function () {
          var win = window.open(url, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = url;
          }
          setBusy(false);
          setStatus('success', 'Opening WhatsApp… ',
            'WhatsApp is opening with your enquiry draft addressed to ' + CONFIG.whatsappDisplay + '. Review your message and press Send in WhatsApp!');
          statusEl.focus();
        }, reducedMotion() ? 0 : 300);
      } catch (err) {
        setBusy(false);
        setStatus('error', 'We couldn’t open WhatsApp automatically. ',
          'Use “Copy enquiry text” and message ' + CONFIG.whatsappDisplay + ' directly on WhatsApp.');
      }
    });

    on(copyBtn, 'click', function () {
      clearStatus();
      if (!validateAll(true)) {
        setStatus('error', 'Please check the form. ', 'Complete the highlighted fields before copying.');
        return;
      }
      var text = enquiryText(values());
      function done(ok) {
        if (ok) setStatus('success', 'Enquiry text copied! ', 'Paste it in WhatsApp to ' + CONFIG.whatsappDisplay + ' and send.');
        else setStatus('error', 'Couldn’t copy automatically. ', 'Select the message text and copy it manually, then WhatsApp ' + CONFIG.whatsappDisplay + '.');
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
      } else {
        done(legacyCopy(text));
      }
    });
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    /* --- Prefill entry points: product button + footer links -------- */
    function openEnquiry(opts) {
      var type = opts.type || 'Product details';
      var opt = Array.prototype.some.call(fields.type.options, function (o) { return o.value === type || o.text === type; });
      if (opt) fields.type.value = type;
      if (opts.message && (!fields.message.value.trim() || fields.message.dataset.autofill === '1')) {
        fields.message.value = opts.message;
        fields.message.dataset.autofill = '1';
        updateCount();
      }
      Object.keys(fields).forEach(function (k) { showError(k, ''); touched[k] = false; });
      var contact = $('#contact');
      if (contact) contact.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(function () {
        var target = fields.name.value.trim() ? fields.message : fields.name;
        target.focus({ preventScroll: true });
      }, reducedMotion() ? 0 : 700);
    }
    $$('[data-enquire]').forEach(function (btn) {
      on(btn, 'click', function () {
        var name = btn.getAttribute('data-enquire') || CONFIG.productName;
        openEnquiry({ type: 'Product details', message: 'Hello SmartStand team, I would like to know more about the ' + name + '.' });
      });
    });
    $$('[data-prefill]').forEach(function (a) {
      on(a, 'click', function (e) {
        e.preventDefault();
        openEnquiry({ type: a.getAttribute('data-prefill') });
      });
    });
  }

  /* ====================================================================
     Back to top + footer year
     ==================================================================== */
  function initTopAndYear() {
    var year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    var btn = $('#to-top');
    var home = $('#home');
    function goTop(e) {
      if (e) e.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      if (home) home.focus({ preventScroll: true });
    }
    if (btn) {
      var toggle = rafThrottle(function () { btn.hidden = window.scrollY < 700; });
      on(window, 'scroll', toggle, { passive: true });
      toggle();
      on(btn, 'click', goTop);
    }
    var footerTop = $('#footer-top');
    if (footerTop) on(footerTop, 'click', goTop);
  }

  /* ====================================================================
     Boot + cleanup
     ==================================================================== */
  function boot() {
    init('theme', initTheme);
    init('navigation', initNav);
    init('reveal', initReveal);
    init('tilt', initTilt);
    init('3d scenes', initScenes);
    init('form', initForm);
    init('back-to-top', initTopAndYear);
  }

  function teardown(e) {
    // If the page is going into the back/forward cache, keep everything alive.
    if (e && e.persisted) return;
    Object.keys(scenes).forEach(function (k) { if (scenes[k]) { scenes[k].dispose(); scenes[k] = null; } });
    cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (err) { /* ignore */ } });
  }
  window.addEventListener('pagehide', teardown);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
