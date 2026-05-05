/* ═══════════════════════════════════════════════════════
   CACHE BUSTER
   Clears all old Service Worker caches and unregisters
   stale SW registrations so visitors always get fresh
   assets after a deploy.
   ═══════════════════════════════════════════════════════ */
(function clearOldCaches() {
  /* 1 — Unregister every stale service worker */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    }).catch(() => {});
  }

  /* 2 — Wipe every Cache Storage cache */
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    }).catch(() => {});
  }

  /* 3 — Clear sessionStorage (keeps localStorage for user prefs) */
  try { sessionStorage.clear(); } catch (_) {}
})();


/* ═══════════════════════════════════════════════════════
   IMAGE LOADER — smooth background loading with skeletons
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. PROGRESS BAR ── */
  let total = 0, done = 0;

  const bar = document.createElement('div');
  bar.id = 'img-load-bar';
  bar.innerHTML = '<div id="ilb-track"><div id="ilb-fill"></div></div><span id="ilb-label">Loading images — 0%</span>';
  document.body.appendChild(bar);

  const fill  = document.getElementById('ilb-fill');
  const label = document.getElementById('ilb-label');

  function tickProgress() {
    done++;
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    fill.style.width = pct + '%';
    label.textContent = 'Loading images — ' + pct + '%';
    if (done >= total) {
      fill.style.width = '100%';
      label.textContent = 'All images ready ✓';
      setTimeout(() => bar.classList.add('done'), 500);
      setTimeout(() => bar.remove(), 1200);
    }
  }

  /* ── 2. REVEAL one image (off-main-thread via decode()) ── */
  function revealImg(img, skel) {
    img.decode()
      .catch(() => {})
      .finally(() => {
        img.classList.add('loaded');
        if (skel) {
          skel.classList.add('loaded');
          setTimeout(() => skel.remove(), 650);
        }
        tickProgress();
      });
  }

  /* ── 3. LOAD one image ── */
  function loadImg(img) {
    const skel = img.closest('.img-wrap')
      ? img.closest('.img-wrap').querySelector('.img-skel')
      : null;
    const src = img.dataset.src || img.getAttribute('src');

    if (!src) { tickProgress(); return; }

    /* swap data-src → src if needed */
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }

    if (img.complete && img.naturalWidth > 0) {
      revealImg(img, skel);
      return;
    }

    img.addEventListener('load', () => revealImg(img, skel), { once: true });
    img.addEventListener('error', () => {
      if (skel) { skel.classList.add('error'); skel.classList.add('loaded'); }
      img.style.opacity = '.25';
      img.style.filter  = 'blur(0) grayscale(1)';
      tickProgress();
    }, { once: true });
  }

  /* ── 4. INJECT skeleton into each slide ── */
  function injectSkeletons() {
    document.querySelectorAll('.slide img').forEach(img => {
      if (img.closest('.img-wrap')) return; /* already wrapped */

      const wrap = document.createElement('div');
      wrap.className = 'img-wrap';

      const skel = document.createElement('div');
      skel.className = 'img-skel';

      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(skel);
      wrap.appendChild(img);

      /* save src as data-src so lazy logic controls loading */
      if (img.getAttribute('src') && !img.dataset.src) {
        img.dataset.src = img.getAttribute('src');
        img.removeAttribute('src');
      }
    });
  }

  /* ── 5. MAIN BOOT ── */
  function boot() {
    injectSkeletons();

    const allImgs = [...document.querySelectorAll('.slide img')];
    total = allImgs.length;

    if (total === 0) { bar.remove(); return; }

    /* Priority: active + adjacent slides load first */
    const priority = [
      ...document.querySelectorAll('.slide.active img, .slide.prev img, .slide.next img')
    ];
    const prioritySet = new Set(priority);

    priority.forEach(img => loadImg(img));

    /* Remaining: defer via IntersectionObserver + requestIdleCallback */
    const remaining = allImgs.filter(img => !prioritySet.has(img));
    if (!remaining.length) return;

    const section = document.getElementById('screens');
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        remaining.forEach((img, i) => {
          const fn = () => loadImg(img);
          if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, { timeout: 4000 });
          } else {
            setTimeout(fn, i * 55);
          }
        });
      }
    }, { rootMargin: '400px 0px', threshold: 0 });

    if (section) obs.observe(section);
    else remaining.forEach((img, i) => setTimeout(() => loadImg(img), i * 55));
  }

  document.addEventListener('DOMContentLoaded', boot);
})();


/* ═══════════════════════════════════════════════════════
   PARTICLE CANVAS
   ═══════════════════════════════════════════════════════ */
(function () {
  const hero = document.querySelector('.hero');
  const cv   = document.getElementById('particles');
  if (!hero || !cv) return;

  const ctx = cv.getContext('2d');
  let W, H, pts = [];

  function resize() {
    W = cv.width  = hero.offsetWidth;
    H = cv.height = hero.offsetHeight;
  }

  function initPts() {
    pts = [];
    for (let i = 0; i < 70; i++) {
      pts.push({
        x:  Math.random() * 100,
        y:  Math.random() * 100,
        vx: (Math.random() - .5) * .035,
        vy: (Math.random() - .5) * .035,
        r:  .8 + Math.random() * 1.2,
        a:  Math.random()
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = 100; if (p.x > 100) p.x = 0;
      if (p.y < 0) p.y = 100; if (p.y > 100) p.y = 0;
    });

    const MAX_DIST = 130;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = (a.x - b.x) / 100 * W;
        const dy = (a.y - b.y) / 100 * H;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          ctx.beginPath();
          ctx.moveTo(a.x / 100 * W, a.y / 100 * H);
          ctx.lineTo(b.x / 100 * W, b.y / 100 * H);
          ctx.strokeStyle = `rgba(0,229,153,${(1 - d / MAX_DIST) * .1})`;
          ctx.lineWidth = .5;
          ctx.stroke();
        }
      }
    }

    pts.forEach(p => {
      const px = p.x / 100 * W, py = p.y / 100 * H;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,153,${.12 + p.a * .18})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize(); initPts(); draw();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
})();


/* ═══════════════════════════════════════════════════════
   CAROUSEL ENGINE
   ═══════════════════════════════════════════════════════ */
const cars = {};

function initCar(name, total, shape) {
  let cur = 0, timer = null, touchX = 0;
  const slides = [...document.querySelectorAll(`#stage-${name} .slide`)];
  const progs  = [...document.querySelectorAll(`#prog-${name} .cprog`)];

  function cls(o) {
    if (o ===  0) return 'active';
    if (o === -1) return 'prev';
    if (o ===  1) return 'next';
    if (o === -2) return 'far-prev';
    if (o ===  2) return 'far-next';
    return 'hidden';
  }

  function loadAdjacentImgs() {
    slides.forEach(s => {
      const o = parseInt(s.dataset.offset || '0', 10);
      if (Math.abs(o) <= 1) {
        const img = s.querySelector('img[data-src]');
        if (img) {
          const skel = img.closest('.img-wrap')
            ? img.closest('.img-wrap').querySelector('.img-skel')
            : null;
          img.src = img.dataset.src;
          delete img.dataset.src;

          if (img.complete && img.naturalWidth > 0) {
            img.classList.add('loaded');
            if (skel) { skel.classList.add('loaded'); setTimeout(() => skel.remove(), 650); }
          } else {
            img.addEventListener('load', () => {
              img.decode().catch(() => {}).finally(() => {
                img.classList.add('loaded');
                if (skel) { skel.classList.add('loaded'); setTimeout(() => skel.remove(), 650); }
              });
            }, { once: true });
            img.addEventListener('error', () => {
              if (skel) skel.classList.add('error');
              img.style.opacity = '.25';
              img.style.filter  = 'blur(0) grayscale(1)';
            }, { once: true });
          }
        }
      }
    });
  }

  function go(idx) {
    cur = ((idx % total) + total) % total;
    slides.forEach((s, i) => {
      let o = i - cur;
      if (o >  total / 2) o -= total;
      if (o < -total / 2) o += total;
      s.className = `slide ${cls(o)} ${shape}`;
      s.dataset.offset = o;
    });
    progs.forEach((p, i) => {
      const wasActive = p.classList.contains('active');
      p.classList.toggle('active', i === cur);
      if (i === cur && !wasActive) {
        const clone = p.cloneNode(true);
        p.parentNode.replaceChild(clone, p);
        progs[i] = clone;
        clone.addEventListener('click', () => { go(i); resetA(); });
      }
    });
    loadAdjacentImgs();
  }

  const next   = () => go(cur + 1);
  const prev   = () => go(cur - 1);
  const stopA  = () => { clearInterval(timer); timer = null; };
  const startA = () => { stopA(); timer = setInterval(next, 4200); };
  const resetA = () => { stopA(); startA(); };

  document.querySelectorAll(`.arr[data-car="${name}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.contains('arr-p') ? prev() : next();
      resetA();
    });
  });

  progs.forEach((p, i) => p.addEventListener('click', () => { go(i); resetA(); }));

  slides.forEach(s => s.addEventListener('click', () => {
    const o = +(s.dataset.offset || 0);
    if (o !== 0) { go(cur + o); resetA(); }
  }));

  const stage = document.getElementById(`stage-${name}`);
  if (stage) {
    stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; stopA(); }, { passive: true });
    stage.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
      startA();
    }, { passive: true });
  }

  go(0); startA();
  cars[name] = { go, next, prev, startA, stopA };
}

function buildProgs(id, n) {
  const c = document.getElementById(`prog-${id}`);
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'cprog';
    d.dataset.index = i;
    c.appendChild(d);
  }
}

buildProgs('iphone', 12);
buildProgs('macos',  12);
initCar('iphone', 12, 'portrait');
initCar('macos',  12, 'landscape');


/* ═══════════════════════════════════════════════════════
   DEVICE TABS
   ═══════════════════════════════════════════════════════ */
document.querySelectorAll('.device-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.car;
    document.querySelectorAll('.device-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    ['iphone', 'macos'].forEach(n => {
      const wrap = document.getElementById(`car-${n}`);
      if (wrap) wrap.classList.toggle('show', n === name);
    });
    cars[name]?.startA();
  });
});


/* ═══════════════════════════════════════════════════════
   KEYBOARD NAVIGATION
   ═══════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const active = document.querySelector('.device-tab.active')?.dataset.car;
  if (e.key === 'ArrowRight') { cars[active]?.next(); cars[active]?.startA(); }
  if (e.key === 'ArrowLeft')  { cars[active]?.prev(); cars[active]?.startA(); }
});


/* ═══════════════════════════════════════════════════════
   DASHBOARD PANELS
   ═══════════════════════════════════════════════════════ */
document.querySelectorAll('#dsb-nav .dsb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#dsb-nav .dsb-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const t = document.getElementById('panel-' + btn.dataset.p);
    if (t) t.classList.add('active');
    const p = btn.dataset.p;
    if (p === 'sales')     animateBars();
    if (p === 'analytics') animateMiniBar();
    if (p === 'forecast')  animateForecast();
    if (p === 'system')    animateSystem();
  });
});

/* Bar chart */
const barH = ['42%', '58%', '35%', '71%', '80%', '88%'];
function animateBars() {
  for (let i = 0; i < 6; i++) {
    const b = document.getElementById('bar-' + i);
    if (!b) continue;
    b.style.setProperty('--h', '0%');
    setTimeout(() => b.style.setProperty('--h', barH[i]), i * 90);
  }
}

/* Mini bars */
function animateMiniBar() {
  const sets = {
    'mini-bars-conv': [30, 55, 42, 68, 60, 72, 80],
    'mini-bars-aov':  [60, 58, 64, 52, 68, 72, 70],
    'mini-bars-cust': [40, 55, 60, 50, 45, 58, 42],
    'mini-bars-rep':  [50, 60, 65, 70, 72, 75, 80],
  };
  Object.entries(sets).forEach(([id, vals]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    vals.forEach((v, i) => {
      const b = document.createElement('div');
      b.className = 'mini-bar' + (i === vals.length - 1 ? ' active' : '');
      b.style.height = '0px';
      el.appendChild(b);
      setTimeout(() => { b.style.height = Math.round(v * 30 / 100) + 'px'; }, i * 55);
    });
  });
}

/* Forecast fills */
function animateForecast() {
  document.querySelectorAll('.fc-fill').forEach((el, i) => {
    el.style.width = '0%';
    setTimeout(() => { el.style.width = el.dataset.w; }, i * 120 + 80);
  });
}

/* System bars */
function animateSystem() {
  document.querySelectorAll('.sys-pct-fill').forEach((el, i) => {
    el.style.width = '0%';
    setTimeout(() => { el.style.width = el.dataset.w; }, i * 100 + 50);
  });
}

/* Chips */
document.querySelectorAll('.chips').forEach(group => {
  group.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      group.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
    });
  });
});


/* ═══════════════════════════════════════════════════════
   SMOOTH SCROLL — all internal anchor links
   ═══════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const id = this.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.pushState(null, '', '#' + id);
  });
});


/* ═══════════════════════════════════════════════════════
   SCROLL REVEAL
   ═══════════════════════════════════════════════════════ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll(
  '.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-fade, .reveal-stagger'
).forEach(el => revealObs.observe(el));