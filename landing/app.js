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

  /* ---------------------- Mollie checkout (POST handoff) ---------------------- */
  function initCheckout(){
    document.querySelectorAll('[data-buy]').forEach(b => {
      b.addEventListener('click', e => {
        e.preventDefault();
        const lang = document.documentElement.lang || 'nl';
        // POST to placeholder API (server agent will implement)
        const f = document.createElement('form');
        f.method = 'POST';
        f.action = '/apps/optimizer/api/checkout';
        f.style.display = 'none';
        const add = (n, v) => {
          const i = document.createElement('input');
          i.type = 'hidden'; i.name = n; i.value = v;
          f.appendChild(i);
        };
        add('product', 'claude-md-optimizer-lifetime');
        add('amount_eur', '9');
        add('lang', lang);
        add('source', location.pathname);
        const ck = b.getAttribute('data-coupon') || (window.__coupon || '');
        if (ck) add('coupon', ck);
        document.body.appendChild(f);
        f.submit();
      });
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
