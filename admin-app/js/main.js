/* ─────────────────────────────────────────────────
   Purrfect Pal Studio – main.js
   Handles: carousel engine, tab switcher, keyboard
            nav, touch swipe, scroll reveal
───────────────────────────────────────────────── */

const cars = {};

function initCar(name, total) {
  let cur = 0, timer = null, touchX = 0;

  const slides = [...document.querySelectorAll(`#stage-${name} .slide`)];
  const dots   = [...document.querySelectorAll(`#dots-${name} .dot`)];
  const shape  = slides[0]?.classList.contains('portrait') ? 'portrait' : 'landscape';

  function cls(offset) {
    if (offset ===  0) return 'active';
    if (offset === -1) return 'prev';
    if (offset ===  1) return 'next';
    if (offset === -2) return 'far-prev';
    if (offset ===  2) return 'far-next';
    return 'hidden';
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
    dots.forEach((d, i) => d.classList.toggle('active', i === cur));
  }

  const next   = () => go(cur + 1);
  const prev   = () => go(cur - 1);
  const startA = () => { stopA(); timer = setInterval(next, 4000); };
  const stopA  = () => { clearInterval(timer); timer = null; };
  const resetA = () => { stopA(); startA(); };

  // Arrow buttons
  document.querySelectorAll(`.arr[data-car="${name}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.contains('arr-p') ? prev() : next();
      resetA();
    });
  });

  // Dots
  dots.forEach(d => {
    d.addEventListener('click', () => { go(+d.dataset.index); resetA(); });
  });

  // Click side slides to navigate
  slides.forEach(s => {
    s.addEventListener('click', () => {
      const o = +(s.dataset.offset || 0);
      if (o !== 0) { go(cur + o); resetA(); }
    });
  });

  // Touch swipe
  const stage = document.getElementById(`stage-${name}`);
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; stopA(); }, { passive: true });
  stage.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    startA();
  }, { passive: true });

  go(0);
  startA();
  cars[name] = { go, next, prev, startA, stopA };
}

// ── Tab switcher ──────────────────────────────
document.querySelectorAll('.sc-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.car;
    document.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    ['ip', 'mac'].forEach(n => {
      document.getElementById(`car-${n}`).classList.toggle('show', n === name);
    });
    cars[name]?.startA();
  });
});

// ── Keyboard navigation ───────────────────────
document.addEventListener('keydown', e => {
  const active = document.querySelector('.sc-tab.active')?.dataset.car;
  if (e.key === 'ArrowRight') { cars[active]?.next(); cars[active]?.startA(); }
  if (e.key === 'ArrowLeft')  { cars[active]?.prev(); cars[active]?.startA(); }
});

// ── Init carousels ────────────────────────────
initCar('ip',  10);
initCar('mac', 10);

// ── Scroll reveal ─────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
