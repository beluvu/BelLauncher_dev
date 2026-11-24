/* Фон: кристаллы-спрайты плавно дрейфуют, покачиваются и поворачиваются, как предметы на воде.
   Позиция считается по времени, а не накоплением по кадрам, поэтому движение ровное. */
(() => {
  const cv = document.getElementById('bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const COUNT = 11;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPRITES = ['assets/crystal-a.png', 'assets/crystal-b.png'].map((src) => {
    const im = new Image();
    im.src = src;
    return im;
  });
  const root = document.documentElement;
  let W = 0, H = 0, dpr = 1;
  let sky = null, skyKey = '';   // кэш фона: пересчитываем только при смене размера или темы
  let hue = 0, paletteKey = '', tints = [];   // оттенок кристаллов из палитры темы и их кэш

  function rnd(a, b) { return a + Math.random() * (b - a); }
  const TAU = Math.PI * 2;

  // z: 0 — далеко (мельче, бледнее, медленнее), 1 — близко
  function make() {
    const z = rnd(0, 1);
    return {
      img: Math.floor(Math.random() * SPRITES.length),
      bx: rnd(0, 1),                                   // базовая позиция по ширине
      by: rnd(0, 1),                                   // базовая позиция по высоте (доля)
      z,
      rise: rnd(0.012, 0.022) * (0.55 + z * 0.6),       // подъём, долей высоты в секунду
      swayAmp: rnd(0.018, 0.04) * (0.6 + z * 0.6),      // боковое покачивание
      swayFreq: rnd(0.12, 0.22),                        // рад/с
      bobAmp: rnd(0.008, 0.02),
      bobFreq: rnd(0.25, 0.45),
      phase: rnd(0, TAU),
      turnSpeed: rnd(0.12, 0.28) * (Math.random() < 0.5 ? -1 : 1), // рад/с, поворот вокруг оси
      tiltAmp: rnd(0.25, 0.5),                         // наклон, рад
      h: rnd(0.14, 0.24) * (0.55 + z * 0.75),          // высота спрайта, доля высоты окна
      a: rnd(0.55, 0.85) * (0.55 + z * 0.45),
    };
  }
  const gems = Array.from({ length: COUNT }, make);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    sky = null;
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function buildSky() {
    sky = document.createElement('canvas');
    sky.width = W * dpr; sky.height = H * dpr;
    const c = sky.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, cssVar('--sky-a'));
    g.addColorStop(0.5, cssVar('--sky-b'));
    g.addColorStop(1, cssVar('--sky-c'));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, Math.max(W, H) * 0.5);
    glow.addColorStop(0, cssVar('--glow'));
    glow.addColorStop(1, 'rgba(79,195,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
  }

  // Тонируем спрайт один раз на смену палитры, а не на каждый кадр
  function spriteFor(i) {
    if (!hue) return SPRITES[i];
    if (!tints[i]) {
      const im = SPRITES[i];
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const k = c.getContext('2d');
      k.filter = `hue-rotate(${hue}deg)`;
      k.drawImage(im, 0, 0);
      tints[i] = c;
    }
    return tints[i];
  }

  function background() {
    const key = (root.dataset.theme || 'light') + '|' + paletteKey;
    if (!sky || skyKey !== key) { buildSky(); skyKey = key; }
    ctx.drawImage(sky, 0, 0, W, H);
  }

  function drawGem(g, t, dark) {
    const im = SPRITES[g.img];
    if (!im.complete || !im.naturalWidth) return;
    const src = spriteFor(g.img);
    // медленный подъём с плавным переходом через края (без рывков)
    const yRaw = g.by - t * g.rise;
    const y = ((yRaw % 1.4) + 1.4) % 1.4 - 0.2;
    const sway = Math.sin(t * g.swayFreq + g.phase) * g.swayAmp + Math.sin(t * g.swayFreq * 0.37 + g.phase * 2) * g.swayAmp * 0.35;
    const bob = Math.sin(t * g.bobFreq + g.phase * 1.7) * g.bobAmp;
    const cx = (g.bx + sway) * W;
    const cy = (y + bob) * H;
    const hh = H * g.h;
    const ww = hh * (im.naturalWidth / im.naturalHeight);
    // поворот вокруг вертикальной оси: ширина ~ cos(угла), плюс наклон и лёгкое покачивание
    const turn = t * g.turnSpeed + g.phase;
    const sx = Math.max(0.16, Math.abs(Math.cos(turn)));
    const tilt = Math.sin(t * 0.35 + g.phase) * g.tiltAmp * 0.12;
    const roll = Math.sin(t * 0.3 + g.phase * 0.5) * 0.07;   // на воде лёгкий крен
    ctx.save();
    ctx.globalAlpha = g.a * (dark ? 0.9 : 1);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    ctx.transform(sx, 0, tilt, 1, 0, 0);
    ctx.drawImage(src, -ww / 2, -hh / 2, ww, hh);
    ctx.restore();
  }

  function frame(now) {
    const t = now / 1000;
    const dark = root.dataset.theme === 'dark';
    background();
    gems.slice().sort((a, b) => a.z - b.z).forEach((g) => drawGem(g, t, dark));
  }

  let raf = null;
  function loop(now) {
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  // палитра темы из интерфейса: оттенок кристаллов и ключ кэша неба
  window.BeluvuBg = {
    setPalette(h, key) { hue = Number(h) || 0; paletteKey = key || ''; tints = []; sky = null; },
  };

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  SPRITES.forEach((im) => im.addEventListener('load', () => { if (reduce) frame(performance.now()); }));
  if (reduce) { frame(0); } else { start(); }
})();
