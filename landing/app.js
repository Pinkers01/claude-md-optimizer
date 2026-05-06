/* ========================================================================
   CLAUDE.md Optimizer Landing — Pinky Creative Studio
   i18n + animations + cookie banner + Mollie + easter eggs
   ======================================================================== */
(function(){
  'use strict';

  /* ---------------------- i18n ---------------------- */
  const SUPPORTED = ['nl','pl','en'];
  const COOKIE_NAME = 'lang';
  let DICT = null;

  function getCookie(n){
    return document.cookie.split('; ').find(r => r.startsWith(n + '='))?.split('=')[1];
  }
  function setCookie(n,v,days){
    const d = new Date();
    d.setTime(d.getTime() + (days||365)*24*60*60*1000);
    document.cookie = n+'='+v+'; expires='+d.toUTCString()+'; path=/; SameSite=Lax';
  }

  function detectLang(){
    const url = new URL(location.href);
    const q = url.searchParams.get('lang');
    if (q && SUPPORTED.includes(q)) return q;
    const c = getCookie(COOKIE_NAME);
    if (c && SUPPORTED.includes(c)) return c;
    const nav = (navigator.language || 'nl').slice(0,2).toLowerCase();
    if (SUPPORTED.includes(nav)) return nav;
    return 'nl';
  }

  function applyDict(lang){
    if (!DICT || !DICT[lang]) return;
    const d = DICT[lang];
    document.documentElement.lang = d.html_lang || lang;
    // text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (d[key] != null) el.innerHTML = d[key];
    });
    // attributes
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (d[key] != null) el.setAttribute(attr, d[key].replace(/<[^>]+>/g,''));
      });
    });
    // meta
    const setMeta = (sel, val) => {
      const m = document.querySelector(sel);
      if (m && val != null) {
        if (m.tagName === 'TITLE') m.textContent = val;
        else m.setAttribute('content', val);
      }
    };
    setMeta('title', d.meta_title);
    setMeta('meta[name="description"]', d.meta_desc);
    setMeta('meta[name="keywords"]', d.meta_keywords);
    setMeta('meta[property="og:title"]', d.og_title);
    setMeta('meta[property="og:description"]', d.og_desc);
    setMeta('meta[name="twitter:title"]', d.og_title);
    setMeta('meta[name="twitter:description"]', d.og_desc);
    // current lang display in switcher
    const cur = document.querySelector('.lang-cur');
    if (cur) cur.textContent = lang.toUpperCase();
    document.querySelectorAll('.lang-opt').forEach(opt => {
      opt.classList.toggle('current', opt.dataset.lang === lang);
    });
    setCookie(COOKIE_NAME, lang);
    document.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang } }));
  }

  async function loadDict(){
    try {
      const res = await fetch('i18n.json');
      DICT = await res.json();
    } catch(e){
      console.warn('i18n.json load failed, using inline fallback', e);
      DICT = { nl:{}, pl:{}, en:{} };
    }
    applyDict(detectLang());
  }

  /* ---------------------- Lang switcher ---------------------- */
  function initLangSwitch(){
    const btn = document.querySelector('.lang-btn');
    const menu = document.querySelector('.lang-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });
    menu.querySelectorAll('.lang-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        applyDict(opt.dataset.lang);
        menu.classList.remove('open');
      });
    });
  }

  /* ---------------------- Hero counter animation ---------------------- */
  function animateCount(el, from, to, duration){
    if (!el) return;
    const start = performance.now();
    const fmt = n => Math.round(n).toLocaleString('nl-NL').replace(/,/g, ' ');
    function frame(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      el.textContent = fmt(v);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function observeCounters(){
    const fromEl = document.querySelector('.hc-num.from');
    const toEl = document.querySelector('.hc-num.to');
    if (!fromEl || !toEl) return;
    let ran = false;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !ran){
          ran = true;
          animateCount(fromEl, 0, 70420, 1800);
          animateCount(toEl, 0, 34812, 1800);
        }
      });
    }, { threshold: 0.4 });
    io.observe(fromEl);
  }

  /* ---------------------- Reveal on scroll ---------------------- */
  function initReveals(){
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting){
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ---------------------- Particle bg canvas ---------------------- */
  function initBgCanvas(){
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr;
    const particles = [];
    const N = window.matchMedia('(max-width:760px)').matches ? 38 : 80;

    function resize(){
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = window.innerWidth * dpr;
      h = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }

    function spawn(){
      particles.length = 0;
      for (let i = 0; i < N; i++){
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25 * dpr,
          vy: (Math.random() - 0.5) * 0.25 * dpr,
          r: (Math.random() * 1.4 + 0.4) * dpr,
          tone: Math.random() > 0.85 ? 'gold' : 'violet'
        });
      }
    }

    function step(){
      ctx.clearRect(0, 0, w, h);
      // connections
      for (let i = 0; i < particles.length; i++){
        const a = particles[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        for (let j = i + 1; j < particles.length; j++){
          const b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          const max = (140 * dpr) ** 2;
          if (d2 < max){
            const op = (1 - d2 / max) * 0.18;
            ctx.strokeStyle = a.tone === 'gold' ? `rgba(196,162,76,${op})` : `rgba(108,99,255,${op})`;
            ctx.lineWidth = 0.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = a.tone === 'gold' ? 'rgba(229,201,122,0.85)' : 'rgba(108,99,255,0.85)';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(step);
    }

    resize(); spawn(); step();
    window.addEventListener('resize', () => { resize(); spawn(); });
  }

  /* ---------------------- Custom cursor ---------------------- */
  function initCursor(){
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(max-width:760px)').matches) return;
    const dot = document.createElement('div'); dot.className = 'cursor';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    document.body.appendChild(dot); document.body.appendChild(ring);
    document.body.classList.add('cursor-on');
    let rx = 0, ry = 0, dx = 0, dy = 0;
    document.addEventListener('mousemove', e => {
      dx = e.clientX; dy = e.clientY;
      dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
    });
    function tick(){
      rx += (dx - rx) * 0.16;
      ry += (dy - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    tick();
    document.querySelectorAll('a, button, .feature, .price-card, .demo-card, .problem-card').forEach(el => {
      el.addEventListener('mouseenter', () => dot.classList.add('hover'));
      el.addEventListener('mouseleave', () => dot.classList.remove('hover'));
    });
  }

  /* ---------------------- Magnetic buttons ---------------------- */
  function initMagnetic(){
    if (window.matchMedia('(max-width:760px)').matches) return;
    document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${mx * 0.18}px, ${my * 0.22}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---------------------- FAQ accordion ---------------------- */
  function initFAQ(){
    document.querySelectorAll('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-q');
      if (!q) return;
      q.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    });
  }

  /* ---------------------- Cookie banner ---------------------- */
  function initCookieBanner(){
    const c = getCookie('cookie_consent');
    const banner = document.querySelector('.cookie-banner');
    if (!banner) return;
    if (!c) banner.classList.add('show');
    document.querySelectorAll('[data-cookie-action]').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.getAttribute('data-cookie-action');
        setCookie('cookie_consent', a, 365);
        banner.classList.remove('show');
      });
    });
  }

  /* ---------------------- Manual payment flow (Revolut / IBAN) ---------------------- */
  function initCheckout(){
    document.querySelectorAll('[data-buy]').forEach(b => {
      b.addEventListener('click', e => {
        e.preventDefault();
        showBuyModal();
      });
    });
  }

  function showBuyModal(){
    const lang = document.documentElement.lang || 'nl';
    const labels = {
      pl: {title:'Zakup CLAUDE.md Optimizer',sub:'Wybierz metode platnosci. Po zaplacie Pinky recznie potwierdza i email z licencja idzie do Ciebie zwykle w 12h.',email:'Twoj email',methodR:'Revolut Pay (zalecane)',methodI:'Przelew bankowy (IBAN)',submit:'Pokaz instrukcje',cancel:'Anuluj',err:'Wpisz prawidlowy email'},
      en: {title:'Buy CLAUDE.md Optimizer',sub:'Pick a payment method. After payment Pinky confirms manually and the license email lands in your inbox usually within 12 hours.',email:'Your email',methodR:'Revolut Pay (recommended)',methodI:'Bank transfer (IBAN)',submit:'Show instructions',cancel:'Cancel',err:'Enter a valid email'},
      nl: {title:'Koop CLAUDE.md Optimizer',sub:'Kies een betaalmethode. Na betaling bevestigt Pinky handmatig en de licentie-email komt meestal binnen 12 uur in je inbox.',email:'Je email',methodR:'Revolut Pay (aanbevolen)',methodI:'Bankoverschrijving (IBAN)',submit:'Toon instructies',cancel:'Annuleer',err:'Voer een geldig email in'},
    };
    const t = labels[lang] || labels.en;
    if (document.getElementById('buyModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'buyModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(8,8,16,0.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    overlay.innerHTML =
      '<div style="background:#12121A;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:28px;max-width:460px;width:100%;font-family:system-ui,-apple-system,sans-serif">' +
      '<h3 style="margin:0 0 6px;font-size:18px;font-weight:600;color:#F0F0FF">' + t.title + '</h3>' +
      '<p style="margin:0 0 18px;color:#8888A0;font-size:13px;line-height:1.5">' + t.sub + '</p>' +
      '<label style="display:block;margin-bottom:14px;font-size:12px;color:#8888A0">' + t.email +
      '<input id="buyEmail" type="email" required autofocus style="display:block;width:100%;margin-top:6px;background:#080810;color:#F0F0FF;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit">' +
      '</label>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' +
      '<label style="display:flex;align-items:center;gap:10px;background:#1A1A24;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;cursor:pointer;color:#F0F0FF;font-size:13px">' +
      '<input type="radio" name="buyMethod" value="revolut" checked style="accent-color:#6C63FF">' + t.methodR + '</label>' +
      '<label style="display:flex;align-items:center;gap:10px;background:#1A1A24;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;cursor:pointer;color:#F0F0FF;font-size:13px">' +
      '<input type="radio" name="buyMethod" value="iban" style="accent-color:#6C63FF">' + t.methodI + '</label>' +
      '</div>' +
      '<div id="buyErr" style="color:#FF4D6D;font-size:12px;margin-bottom:10px;min-height:16px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button id="buyCancel" type="button" style="background:transparent;color:#8888A0;border:1px solid rgba(255,255,255,0.15);padding:10px 16px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px">' + t.cancel + '</button>' +
      '<button id="buySubmit" type="button" style="background:#6C63FF;color:white;border:0;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;font-size:13px">' + t.submit + '</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#buyCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#buySubmit').addEventListener('click', async () => {
      const email = overlay.querySelector('#buyEmail').value.trim();
      const method = overlay.querySelector('input[name=buyMethod]:checked').value;
      const errEl = overlay.querySelector('#buyErr');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = t.err; return; }
      errEl.textContent = '';
      const submitBtn = overlay.querySelector('#buySubmit');
      submitBtn.disabled = true; submitBtn.textContent = '...';
      try {
        const r = await fetch('/apps/optimizer/api/order', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: email, lang: lang, payment_method: method }),
        });
        const j = await r.json();
        if (j.ok && j.instructions_url) {
          location.href = j.instructions_url;
        } else {
          errEl.textContent = j.error || 'error';
          submitBtn.disabled = false; submitBtn.textContent = t.submit;
        }
      } catch (e) {
        errEl.textContent = 'network error';
        submitBtn.disabled = false; submitBtn.textContent = t.submit;
      }
    });
  }

  /* ---------------------- Easter eggs ---------------------- */
  function initKonami(){
    const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let pos = 0;
    document.addEventListener('keydown', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[pos]){
        pos++;
        if (pos === seq.length){
          showKonami();
          pos = 0;
        }
      } else {
        pos = (k === seq[0]) ? 1 : 0;
      }
    });
  }

  function showKonami(){
    let overlay = document.querySelector('.konami');
    if (!overlay) return;
    window.__coupon = 'KONAMI9';
    overlay.classList.add('show');
    overlay.querySelector('button')?.addEventListener('click', () => {
      overlay.classList.remove('show');
    }, { once: true });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('show');
    }, { once: true });
  }

  function initDevMode(){
    const url = new URL(location.href);
    if (url.searchParams.get('pinky') !== '1') return;
    const badge = document.querySelector('.dev-badge');
    if (!badge) return;
    const stats = {
      build: 'v1.0.0',
      mode: 'developer',
      pages: document.querySelectorAll('section').length,
      reveals: document.querySelectorAll('.reveal').length,
      langs: SUPPORTED.length,
      eggs: 6,
      ts: new Date().toISOString().slice(0,16)
    };
    badge.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">DEV MODE · pinky=1</div>
      <div class="stat">build: <b>${stats.build}</b></div>
      <div class="stat">sections: <b>${stats.pages}</b></div>
      <div class="stat">reveals: <b>${stats.reveals}</b></div>
      <div class="stat">langs: <b>${stats.langs}</b></div>
      <div class="stat">eggs: <b>${stats.eggs}</b></div>
      <div class="stat">ts: <b>${stats.ts}</b></div>
    `;
    badge.classList.add('show');
  }

  function initNightBadge(){
    const h = new Date().getHours();
    if (h >= 0 && h < 1){
      const b = document.querySelector('.night-badge');
      if (b) b.classList.add('show');
    }
  }

  function consoleArt(){
    const css1 = 'color:#6C63FF; font-family:ui-monospace,monospace';
    const css2 = 'color:#C4A24C; font-family:ui-monospace,monospace';
    const css3 = 'color:#A0A0BF; font-family:ui-monospace,monospace';
    console.log('%c\n' +
      '   ____  _       _\n' +
      '  |  _ \\(_)_ __ | | ___   _\n' +
      '  | |_) | | \'_ \\| |/ / | | |\n' +
      '  |  __/| | | | |   <| |_| |\n' +
      '  |_|   |_|_| |_|_|\\_\\\\__, |\n' +
      '                        |___/\n', css1);
    console.log('%cBuilt by Pinky Creative Studio.', css2);
    console.log('%cMemory > monolith. Tight rules ship faster.', css3);
    console.log('%chttps://stopmetzoeken.store · klantenservice@stopmetzoeken.store', css3);
    console.log('%cTry the Konami code, or add ?pinky=1 to the URL.', css3);
  }

  /* ---------------------- Sticky header shadow on scroll ---------------------- */
  function initHeaderScroll(){
    const h = document.querySelector('.site-header');
    if (!h) return;
    const onScroll = () => {
      h.style.boxShadow = window.scrollY > 12 ? '0 8px 30px -10px rgba(0,0,0,0.6)' : 'none';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------- Init ---------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    loadDict();
    initLangSwitch();
    initBgCanvas();
    initCursor();
    initMagnetic();
    initReveals();
    observeCounters();
    initFAQ();
    initCookieBanner();
    initCheckout();
    initKonami();
    initDevMode();
    initNightBadge();
    initHeaderScroll();
    consoleArt();
  });

})();
