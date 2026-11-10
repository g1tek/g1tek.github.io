/* Splashy's Car Wash: animated hero scene.
 *
 * A looping, procedurally drawn wash: a muddy car drives in, gets foamed,
 * scrubbed by a roller brush, rinsed and polished, then drives out, and the
 * next car rolls in. Visitors can scrub the car with a mouse or finger.
 * Everything is drawn on one <canvas>, so there is no video file to host.
 * prefers-reduced-motion shows a single still frame.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('wash-scene');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Car layers are drawn in local units (1 unit ~ 1 px at scale 1), stored at K px per unit.
  const K = 2;
  const BOX = { x: -232, y: -214, w: 464, h: 218 };
  const WHEEL_R = 36;
  const COLORS = ['#e8323c', '#2f7cf6', '#ffc61a', '#1fbf86', '#ff7a1a', '#8b5cf6', '#ff5fa2', '#16b5d8'];
  const PHASES = [['in', 3], ['foam', 2.6], ['scrub', 2.8], ['rinse', 2.4], ['shine', 1.6], ['out', 2.4]];
  const NAVY = '#13224a';
  const hitCtx = document.createElement('canvas').getContext('2d');

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const tgt = amt < 0 ? 0 : 255;
    const k = Math.abs(amt);
    const mix = (c) => Math.round(c + (tgt - c) * k);
    return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  }

  function poly(pts) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------------------------------------------------------------- vehicles
  // Side views, facing right (+x). y is up-negative; wheels touch y = 0.
  const TYPES = {
    hatch() {
      const b = new Path2D();
      b.moveTo(-205, -30); b.lineTo(-205, -88);
      b.quadraticCurveTo(-204, -108, -185, -112); b.lineTo(-150, -114);
      b.lineTo(-120, -172); b.quadraticCurveTo(-112, -182, -95, -182);
      b.lineTo(40, -182); b.quadraticCurveTo(58, -182, 70, -170);
      b.lineTo(115, -118); b.lineTo(185, -104);
      b.quadraticCurveTo(208, -98, 210, -75); b.lineTo(210, -30);
      b.quadraticCurveTo(210, -18, 198, -18); b.lineTo(-193, -18);
      b.quadraticCurveTo(-205, -18, -205, -30); b.closePath();
      return {
        body: b, top: -182, wheels: [-128, 128], doors: [-26], head: [198, -84], tail: [-204, -94],
        windows: [
          poly([[-138, -120], [-116, -163], [-98, -170], [-32, -170], [-32, -120]]),
          poly([[-20, -120], [-20, -170], [42, -170], [62, -160], [100, -120]]),
        ],
      };
    },
    van() {
      const b = new Path2D();
      b.moveTo(-210, -30); b.lineTo(-210, -190);
      b.quadraticCurveTo(-210, -205, -195, -205); b.lineTo(110, -205);
      b.quadraticCurveTo(130, -205, 140, -190); b.lineTo(175, -120);
      b.lineTo(200, -110); b.quadraticCurveTo(214, -104, 214, -80);
      b.lineTo(214, -30); b.quadraticCurveTo(214, -18, 202, -18);
      b.lineTo(-198, -18); b.quadraticCurveTo(-210, -18, -210, -30); b.closePath();
      return {
        body: b, top: -205, wheels: [-138, 138], doors: [-115, 53], head: [204, -88], tail: [-206, -72],
        windows: [
          poly([[-192, -186], [-122, -186], [-122, -132], [-192, -132]]),
          poly([[-106, -186], [-36, -186], [-36, -132], [-106, -132]]),
          poly([[-20, -186], [44, -186], [44, -132], [-20, -132]]),
          poly([[62, -186], [118, -186], [150, -132], [62, -132]]),
        ],
      };
    },
    beetle() {
      const b = new Path2D();
      b.moveTo(-200, -30); b.quadraticCurveTo(-214, -34, -210, -72);
      b.bezierCurveTo(-204, -112, -170, -126, -130, -132);
      b.bezierCurveTo(-104, -196, 44, -204, 82, -146);
      b.quadraticCurveTo(100, -124, 150, -118);
      b.bezierCurveTo(200, -112, 214, -86, 210, -46);
      b.quadraticCurveTo(208, -18, 190, -18); b.lineTo(-188, -18);
      b.quadraticCurveTo(-200, -18, -200, -30); b.closePath();
      return {
        body: b, top: -190, wheels: [-128, 128], doors: [-22], head: [196, -92], tail: [-204, -82],
        windows: [
          poly([[-108, -136], [-84, -166], [-40, -178], [-28, -178], [-28, -136]]),
          poly([[-14, -136], [-14, -178], [20, -174], [52, -156], [64, -136]]),
        ],
      };
    },
    pickup() {
      const b = new Path2D();
      b.moveTo(-215, -30); b.lineTo(-215, -112); b.lineTo(-30, -112);
      b.lineTo(-30, -190); b.quadraticCurveTo(-30, -200, -18, -200);
      b.lineTo(60, -200); b.quadraticCurveTo(75, -200, 85, -185);
      b.lineTo(118, -122); b.lineTo(195, -112);
      b.quadraticCurveTo(215, -108, 215, -82); b.lineTo(215, -30);
      b.quadraticCurveTo(215, -18, 203, -18); b.lineTo(-203, -18);
      b.quadraticCurveTo(-215, -18, -215, -30); b.closePath();
      return {
        body: b, top: -200, wheels: [-142, 134], doors: [-30], head: [204, -88], tail: [-212, -96], bed: true,
        windows: [poly([[-18, -188], [55, -188], [98, -124], [-18, -124]])],
      };
    },
  };
  const TYPE_KEYS = Object.keys(TYPES);

  function layer() {
    const cv = document.createElement('canvas');
    cv.width = BOX.w * K;
    cv.height = BOX.h * K;
    const g = cv.getContext('2d');
    g.setTransform(K, 0, 0, K, -BOX.x * K, -BOX.y * K);
    return [cv, g];
  }

  let lastType = '';
  function makeCar(prevColor) {
    let type;
    do type = TYPE_KEYS[(Math.random() * TYPE_KEYS.length) | 0]; while (type === lastType);
    lastType = type;
    let color;
    do color = COLORS[(Math.random() * COLORS.length) | 0]; while (color === prevColor);
    const def = TYPES[type]();
    const [dirt, dctx] = layer();
    const [foam, fctx] = layer();
    const grad = ctx.createLinearGradient(0, def.top, 0, -18);
    grad.addColorStop(0, shade(color, 0.38));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -0.32));
    const car = { type, color, def, dirt, dctx, foam, fctx, grad, x: -1e5, bob: 0, wheelAngle: 0, tyreMud: 1, shine: 0 };
    paintDirt(car);
    return car;
  }

  function paintDirt(c) {
    const g = c.dctx;
    const top = c.def.top;
    g.clearRect(BOX.x, BOX.y, BOX.w, BOX.h);
    const muds = ['122,82,46', '94,62,34', '140,104,62', '76,52,30'];
    const film = g.createLinearGradient(0, top, 0, -18);
    film.addColorStop(0, 'rgba(120,86,52,0.22)');
    film.addColorStop(0.55, 'rgba(110,76,44,0.45)');
    film.addColorStop(1, 'rgba(90,60,34,0.9)');
    g.fillStyle = film;
    g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    for (let i = 0; i < 48; i++) {
      const x = rand(-215, 215);
      const y = -18 - Math.pow(Math.random(), 1.5) * (-top - 18);
      const r = rand(8, 34);
      const col = muds[i % 4];
      const a = rand(0.55, 0.95);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},${a})`);
      gr.addColorStop(0.7, `rgba(${col},${a * 0.85})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = `rgba(${col},${a * 0.8})`;
      for (let j = 0; j < 4; j++) {
        const ang = rand(0, TAU);
        const d = r * rand(1, 1.8);
        g.beginPath(); g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, rand(1.5, 4.5), 0, TAU); g.fill();
      }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = rand(-200, 200);
      const y = rand(top + 20, -70);
      g.strokeStyle = `rgba(${muds[1]},0.75)`;
      g.lineWidth = rand(3, 7);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + rand(14, 40)); g.stroke();
    }
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000';
    g.fill(c.def.body);
    g.globalCompositeOperation = 'source-over';
    c.fctx.clearRect(BOX.x, BOX.y, BOX.w, BOX.h);
    c.tyreMud = 1;
  }

  function stampFoam(c, x, y, r) {
    const g = c.fctx;
    g.save();
    g.clip(c.def.body);
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const bx = x + rand(-r, r) * 0.7;
      const by = y + rand(-r, r) * 0.5;
      const br = r * rand(0.45, 0.8);
      const gr = g.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.55, '#ece2ff');
      gr.addColorStop(1, 'rgba(176,146,246,0.95)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
    }
    g.restore();
  }

  function erase(g, x, y, r, a) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${a})`);
    gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.8})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.restore();
  }

  const onCar = (c, lx, ly) => ly > BOX.y && ly < 0 && lx > BOX.x && lx < -BOX.x && hitCtx.isPointInPath(c.def.body, lx, ly);

  function randomPointOnCar(c, yMin, yMax) {
    for (let i = 0; i < 14; i++) {
      const x = rand(-215, 215);
      const y = rand(yMin, yMax);
      if (onCar(c, x, y)) return [x, y];
    }
    return null;
  }

  // ------------------------------------------------------------ scene state
  let W = 0, H = 0, dpr = 1, s = 1, groundY = 0, archX = 0, beamY = 0;
  let bg = null;
  let car = null, prevColor = '', carT = 0, time = 0, lastPhase = '';
  let foamDebt = 0, waterDebt = 0, sparkleDebt = 0;
  const bubbles = [], drops = [], sparkles = [], clouds = [];
  const pointer = { x: 0, y: 0, px: 0, py: 0, moved: false, active: false, lastBubble: 0 };

  const TOTAL = PHASES.reduce((a, [, d]) => a + d, 0);
  function phaseAt(t) {
    let acc = 0;
    for (const [name, d] of PHASES) {
      if (t < acc + d) return { name, p: (t - acc) / d };
      acc += d;
    }
    return null;
  }

  function resize() {
    const r = hero.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(420, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const narrow = W < 820;
    s = narrow ? clamp(W / 560, 0.5, 0.85) : clamp(Math.min(W / 1180, H / 760), 0.6, 1.3);
    groundY = H - Math.max(36, H * (narrow ? 0.06 : 0.1));
    archX = narrow ? W * 0.5 : W * 0.69;
    beamY = groundY - 330 * s;
    buildBackground();
    seedAmbient();
  }

  function seedAmbient() {
    const want = Math.round(clamp((W * H) / 42000, 12, 34));
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].ambient) bubbles.splice(i, 1);
    for (let i = 0; i < want; i++) bubbles.push(newBubble(rand(0, W), rand(0, H), true));
    clouds.length = 0;
    const n = W < 820 ? 3 : 5;
    for (let i = 0; i < n; i++) clouds.push({ x: rand(0, W), y: rand(H * 0.05, groundY - 300 * s), sc: rand(0.6, 1.2) * s, v: rand(6, 14) });
  }

  function newBubble(x, y, ambient) {
    return { x, y, r: ambient ? rand(4, 20) * Math.max(0.7, s) : rand(3, 10), vy: -rand(12, 34), ph: rand(0, TAU), ambient, life: ambient ? Infinity : rand(1.4, 2.6) };
  }

  // ------------------------------------------------------------ background
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const g = bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = groundY - 255 * s;
    const sea = horizon + 78 * s;
    const floorTop = groundY - 62 * s;

    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, '#3fb2ff');
    gr.addColorStop(0.6, '#8fd8ff');
    gr.addColorStop(1, '#d9f5ff');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, horizon + 2);

    const sx = W * 0.86, sy = H * 0.14;
    gr = g.createRadialGradient(sx, sy, 0, sx, sy, 230 * Math.max(s, 0.7));
    gr.addColorStop(0, 'rgba(255,250,215,0.95)');
    gr.addColorStop(0.22, 'rgba(255,238,160,0.4)');
    gr.addColorStop(1, 'rgba(255,238,160,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, horizon);
    g.fillStyle = '#fff6cf';
    g.beginPath(); g.arc(sx, sy, 44 * Math.max(s, 0.7), 0, TAU); g.fill();

    // distant islands
    g.save();
    g.beginPath(); g.rect(0, 0, W, horizon + 1); g.clip();
    [[0.08, 260, 54, '#86cdb0'], [0.3, 200, 38, '#74c1a2'], [0.58, 300, 44, '#8fd4b7'], [0.97, 240, 60, '#7cc6a8']].forEach(([fx, w, h, col]) => {
      g.fillStyle = col;
      g.beginPath(); g.ellipse(W * fx, horizon + 2, w * s, h * s, 0, 0, TAU); g.fill();
    });
    g.restore();

    gr = g.createLinearGradient(0, horizon, 0, sea);
    gr.addColorStop(0, '#1b8fe0');
    gr.addColorStop(0.6, '#36bde6');
    gr.addColorStop(1, '#86e3e4');
    g.fillStyle = gr;
    g.fillRect(0, horizon, W, sea - horizon);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x = 0; x < W; x += 26 * s) {
      g.beginPath(); g.arc(x, sea, 9 * s, Math.PI, 0); g.fill();
    }

    gr = g.createLinearGradient(0, sea, 0, floorTop);
    gr.addColorStop(0, '#ffe7ad');
    gr.addColorStop(1, '#f3c97f');
    g.fillStyle = gr;
    g.fillRect(0, sea, W, floorTop - sea);

    const palms = W < 820 ? [0.06, 0.95] : [0.05, 0.2, 0.43, 0.97];
    palms.forEach((fx, i) => palm(g, W * fx, floorTop + 6 * s, (i % 2 ? 190 : 230) * s, i % 2 ? -1 : 1));

    gr = g.createLinearGradient(0, floorTop, 0, H);
    gr.addColorStop(0, '#eef6ff');
    gr.addColorStop(1, '#c6d9ee');
    g.fillStyle = gr;
    g.fillRect(0, floorTop, W, H - floorTop);

    g.save();
    g.beginPath(); g.rect(0, floorTop, W, H - floorTop); g.clip();
    g.strokeStyle = 'rgba(110,145,190,0.28)';
    g.lineWidth = 1;
    const vpY = floorTop - 700 * s;
    for (let i = -30; i <= 30; i++) {
      const xb = archX + i * 120 * s;
      const t = (floorTop - vpY) / (H - vpY);
      g.beginPath(); g.moveTo(archX + (xb - archX) * t, floorTop); g.lineTo(xb, H); g.stroke();
    }
    for (let k = 1; k < 12; k++) {
      const y = floorTop + Math.pow(k / 11, 1.6) * (H - floorTop);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.fillStyle = 'rgba(120,190,255,0.16)';
    [[0.25, 0.5], [0.58, 0.75], [0.86, 0.4]].forEach(([fx, fy]) => {
      g.beginPath(); g.ellipse(W * fx, floorTop + (H - floorTop) * fy, 120 * s, 14 * s, 0, 0, TAU); g.fill();
    });
    g.restore();

    // hazard stripe along the bay edge
    const hs = 10 * s;
    g.fillStyle = '#ffc61a';
    g.fillRect(0, floorTop - hs, W, hs);
    g.save();
    g.beginPath(); g.rect(0, floorTop - hs, W, hs); g.clip();
    g.fillStyle = NAVY;
    for (let x = -hs; x < W + hs; x += hs * 2.4) {
      g.beginPath(); g.moveTo(x, floorTop); g.lineTo(x + hs, floorTop - hs); g.lineTo(x + hs * 2, floorTop - hs); g.lineTo(x + hs, floorTop); g.fill();
    }
    g.restore();
  }

  function palm(g, x, base, h, dir) {
    const topX = x + h * 0.16 * dir;
    const topY = base - h;
    g.strokeStyle = '#a8743e';
    g.lineCap = 'round';
    g.lineWidth = 12 * s;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x - h * 0.1 * dir, base - h * 0.5, topX, topY); g.stroke();
    g.strokeStyle = 'rgba(90,55,25,0.35)';
    g.lineWidth = 2 * s;
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x - h * 0.1 * dir) + t * t * topX;
      const py = (1 - t) * (1 - t) * base + 2 * (1 - t) * t * (base - h * 0.5) + t * t * topY;
      g.beginPath(); g.moveTo(px - 6 * s, py); g.lineTo(px + 6 * s, py); g.stroke();
    }
    const len = h * 0.55;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.55;
      const tx = topX + Math.cos(a) * len;
      const ty = topY + Math.sin(a) * len * 0.55 + len * 0.38;
      const nx = -Math.sin(a) * len * 0.16;
      const ny = Math.cos(a) * len * 0.1;
      g.fillStyle = i % 2 ? '#24994e' : '#33b862';
      g.beginPath();
      g.moveTo(topX, topY);
      g.quadraticCurveTo((topX + tx) / 2 + nx, (topY + ty) / 2 - len * 0.32 + ny, tx, ty);
      g.quadraticCurveTo((topX + tx) / 2 - nx, (topY + ty) / 2 - len * 0.18 - ny, topX, topY);
      g.fill();
    }
    g.fillStyle = '#7a4b22';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(topX + (i - 1) * 7 * s, topY + 8 * s, 6 * s, 0, TAU); g.fill(); }
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    time += dt;
    if (!car) startCar();
    carT += dt;
    let ph = phaseAt(carT);
    if (!ph) { startCar(); ph = phaseAt(0); }
    if (ph.name !== lastPhase) { enterPhase(ph.name); lastPhase = ph.name; }

    const startX = -BOX.w * 0.6 * s - 40;
    const endX = W + BOX.w * 0.6 * s + 40;
    let x = archX;
    if (ph.name === 'in') x = startX + (archX - startX) * ease.outCubic(ph.p);
    else if (ph.name === 'out') x = archX + (endX - archX) * ease.inCubic(ph.p);
    if (car.x > -1e4) car.wheelAngle += (x - car.x) / (WHEEL_R * s);
    const moving = ph.name === 'in' ? 1 - ph.p : ph.name === 'out' ? ph.p : 0;
    car.bob = Math.sin(time * 16) * 1.4 * moving;
    car.x = x;

    const top = car.def.top;
    if (ph.name === 'foam') {
      foamDebt += dt * 110;
      while (foamDebt >= 1) {
        foamDebt -= 1;
        const k = [-200, -120, -40, 40, 120, 200][(Math.random() * 6) | 0];
        drops.push({ kind: 'foam', x: archX + (k + rand(-6, 6)) * s, y: beamY + 18 * s, vx: rand(-40, 40) * s, vy: rand(80, 160) * s, r: rand(5, 10) * s, life: 2 });
      }
      for (let i = 0; i < 6; i++) {
        const pt = randomPointOnCar(car, top, top + 20 + ph.p * (-top - 18));
        if (pt) stampFoam(car, pt[0], pt[1], rand(16, 28));
      }
    } else if (ph.name === 'scrub') {
      const rx = -260 + 520 * ease.inOut(ph.p);
      car.rollerX = rx;
      for (let i = 0; i < 14; i++) {
        const lx = rx + rand(-26, 26);
        const ly = rand(top, -14);
        erase(car.dctx, lx, ly, rand(18, 28), 0.5);
        erase(car.fctx, lx, ly, 20, 0.22);
      }
      if (Math.random() < 0.6) {
        const pt = randomPointOnCar(car, top, -20);
        if (pt && Math.abs(pt[0] - rx) < 60) stampFoam(car, pt[0], pt[1], rand(8, 14));
      }
      if (Math.random() < 0.5) {
        drops.push({ kind: 'fleck', x: car.x + (rx + rand(-24, 24)) * s, y: groundY + rand(top, -20) * s, vx: rand(-160, 160) * s, vy: -rand(60, 200) * s, r: rand(2, 4) * s, life: 0.9 });
      }
    } else if (ph.name === 'rinse') {
      const wx = -270 + 540 * ph.p;
      car.rinseX = wx;
      for (let i = 0; i < 12; i++) {
        const lx = wx + rand(-34, 34);
        const ly = rand(top, -14);
        erase(car.fctx, lx, ly, 26, 0.7);
        erase(car.dctx, lx, ly, 26, 0.55);
      }
      car.tyreMud = Math.max(0, 1 - ph.p * 1.4);
      waterDebt += dt * 150;
      while (waterDebt >= 1) {
        waterDebt -= 1;
        drops.push({ kind: 'water', x: car.x + (wx + rand(-34, 34)) * s, y: beamY + 18 * s, vx: rand(-20, 20) * s, vy: rand(300, 420) * s, r: rand(1.5, 2.6) * s, life: 1.5 });
      }
    } else if (ph.name === 'shine') {
      car.shine = ph.p;
      sparkleDebt += dt * 12;
      while (sparkleDebt >= 1) {
        sparkleDebt -= 1;
        const pt = randomPointOnCar(car, top, -24);
        if (pt) sparkles.push({ x: car.x + pt[0] * s, y: groundY + pt[1] * s, t: 0, life: rand(0.6, 0.9), sz: rand(8, 16) * s });
      }
    }

    scrubByPointer();
    updateParticles(dt);
  }

  function startCar() {
    car = makeCar(prevColor);
    prevColor = car.color;
    carT = 0;
    lastPhase = '';
  }

  function enterPhase(name) {
    if (name === 'shine') {
      car.dctx.clearRect(BOX.x, BOX.y, BOX.w, BOX.h);
      car.fctx.clearRect(BOX.x, BOX.y, BOX.w, BOX.h);
      car.tyreMud = 0;
    }
    if (name !== 'scrub') car.rollerX = null;
    if (name !== 'rinse') car.rinseX = null;
    if (name !== 'shine') car.shine = 0;
  }

  function scrubByPointer() {
    if (!pointer.moved || !car) return;
    pointer.moved = false;
    const dx = pointer.x - pointer.px;
    const dy = pointer.y - pointer.py;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    let scrubbed = false;
    for (let i = 1; i <= steps; i++) {
      const x = pointer.px + (dx * i) / steps;
      const y = pointer.py + (dy * i) / steps;
      const lx = (x - car.x) / s;
      const ly = (y - groundY) / s - car.bob;
      if (onCar(car, lx, ly)) {
        erase(car.dctx, lx, ly, 26, 0.5);
        erase(car.fctx, lx, ly, 22, 0.2);
        if (Math.random() < 0.2) stampFoam(car, lx + rand(-10, 10), ly + rand(-8, 8), rand(7, 11));
        scrubbed = true;
      }
    }
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    if (scrubbed && !hero.classList.contains('is-scrubbed')) hero.classList.add('is-scrubbed');
    if (time - pointer.lastBubble > 0.06) {
      pointer.lastBubble = time;
      bubbles.push(newBubble(pointer.x + rand(-10, 10), pointer.y + rand(-6, 6), false));
    }
  }

  function updateParticles(dt) {
    const grav = 900 * s;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += grav * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      let dead = d.life <= 0 || d.y > groundY + 4;
      if (!dead && d.kind !== 'fleck' && car) {
        const lx = (d.x - car.x) / s;
        const ly = (d.y - groundY) / s;
        if (onCar(car, lx, ly)) {
          if (d.kind === 'foam') stampFoam(car, lx, ly + 3, rand(10, 16));
          else if (Math.random() < 0.25) {
            drops.push({ kind: 'fleck', x: d.x, y: d.y, vx: rand(-120, 120) * s, vy: -rand(80, 180) * s, r: rand(1.5, 2.5) * s, life: 0.5, water: true });
          }
          dead = d.kind === 'foam' || Math.random() < 0.5;
        }
      }
      if (dead) drops.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      sparkles[i].t += dt;
      if (sparkles[i].t >= sparkles[i].life) sparkles.splice(i, 1);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y += b.vy * dt;
      b.x += Math.sin(time * 1.3 + b.ph) * 14 * dt;
      b.life -= dt;
      if (b.ambient && b.y < -b.r * 2) { b.y = H + b.r * 2; b.x = rand(0, W); }
      else if (!b.ambient && b.life <= 0) bubbles.splice(i, 1);
    }
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 160 * c.sc) c.x = -160 * c.sc;
    }
  }

  // ------------------------------------------------------------ render
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    drawClouds();
    drawGlints();
    drawArch();
    if (car) {
      drawShadow();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, groundY, W, H - groundY); ctx.clip();
      ctx.globalAlpha = 0.16;
      ctx.translate(car.x, groundY);
      ctx.scale(s, -s);
      drawCar(ctx, car, false);
      ctx.restore();

      ctx.save();
      ctx.translate(car.x, groundY);
      ctx.scale(s, s);
      drawCar(ctx, car, true);
      ctx.restore();
      drawRigs();
    }
    drawDrops();
    drawSparkles();
    drawBubbles();
  }

  function drawClouds() {
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.sc, c.sc);
      ctx.fillStyle = 'rgba(205,232,250,0.9)';
      ctx.beginPath(); ctx.ellipse(40, 22, 80, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      [[0, 0, 40], [38, -16, 34], [76, 0, 36], [36, 10, 38]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      });
      ctx.restore();
    }
  }

  function drawGlints() {
    const horizon = groundY - 255 * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
      if (a < 0.45) continue;
      ctx.globalAlpha = (a - 0.45) * 1.6;
      const x = ((i * 137.5 + time * 18) % (W + 40)) - 20;
      const y = horizon + (10 + ((i * 23) % 52)) * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 * s, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawArch() {
    const L = archX - 300 * s;
    const R = archX + 300 * s;
    const pw = 34 * s;
    const bh = 40 * s;
    const top = beamY;
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = NAVY;
    for (const x of [L, R - pw]) {
      rr(ctx, x, top - 4 * s, pw, groundY - top + 4 * s, 8 * s);
      ctx.fillStyle = '#1f6fe5'; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(255,198,26,0.9)';
      for (let y = top + 30 * s; y < groundY; y += 56 * s) ctx.fillRect(x, y, pw, 14 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 5 * s, top, 6 * s, groundY - top);
      ctx.restore();
    }
    rr(ctx, L - 14 * s, top - bh, R - L + 28 * s, bh, 10 * s);
    ctx.fillStyle = '#2a7cf0'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    const sq = 12 * s;
    for (let x = L - 14 * s, i = 0; x < R + 14 * s; x += sq, i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ffc61a';
      ctx.fillRect(x, top - sq, sq, sq);
    }
    ctx.restore();

    const n = 16;
    for (let i = 0; i < n; i++) {
      const x = L + (i + 0.5) * ((R - L) / n);
      const on = (i + Math.floor(time * 7)) % 3 === 0;
      if (on) {
        const gr = ctx.createRadialGradient(x, top - bh * 0.62, 0, x, top - bh * 0.62, 14 * s);
        gr.addColorStop(0, 'rgba(255,245,170,0.9)');
        gr.addColorStop(1, 'rgba(255,245,170,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(x, top - bh * 0.62, 14 * s, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = on ? '#fff6b0' : '#9cc4ff';
      ctx.beginPath(); ctx.arc(x, top - bh * 0.62, 4.2 * s, 0, TAU); ctx.fill();
    }

    const sw = 270 * s, sh = 56 * s;
    rr(ctx, archX - sw / 2, top - bh - sh + 8 * s, sw, sh, 18 * s);
    ctx.fillStyle = '#ffc61a'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = NAVY;
    ctx.font = `${Math.round(30 * s)}px "Titan One", "Arial Rounded MT Bold", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("SPLASHY'S", archX, top - bh - sh / 2 + 9 * s);

    ctx.fillStyle = '#45526b';
    for (const k of [-200, -120, -40, 40, 120, 200]) {
      const nx = archX + k * s;
      ctx.beginPath();
      ctx.moveTo(nx - 7 * s, top); ctx.lineTo(nx + 7 * s, top);
      ctx.lineTo(nx + 4 * s, top + 16 * s); ctx.lineTo(nx - 4 * s, top + 16 * s);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawShadow() {
    const gr = ctx.createRadialGradient(car.x, groundY, 0, car.x, groundY, 230 * s);
    gr.addColorStop(0, 'rgba(20,40,80,0.32)');
    gr.addColorStop(1, 'rgba(20,40,80,0)');
    ctx.save();
    ctx.translate(car.x, groundY);
    ctx.scale(1, 0.08);
    ctx.translate(-car.x, -groundY);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(car.x, groundY, 230 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCar(g, c, full) {
    const d = c.def;
    g.save();
    g.translate(0, c.bob);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    g.fillStyle = c.grad;
    g.fill(d.body);

    g.save();
    g.clip(d.body);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(-240, d.top + 6, 480, 10);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(-240, -112, 480, 6);
    g.fillStyle = shade(c.color, -0.55);
    for (const wx of d.wheels) { g.beginPath(); g.arc(wx, -WHEEL_R, WHEEL_R + 9, 0, TAU); g.fill(); }
    g.fillStyle = '#5b6578';
    g.fillRect(-240, -34, 480, 14);
    g.restore();

    if (d.bed) {
      g.strokeStyle = shade(c.color, -0.5);
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(-205, -100); g.lineTo(-40, -100); g.stroke();
    }

    g.strokeStyle = shade(c.color, -0.45);
    g.lineWidth = 3;
    for (const dx of d.doors) {
      g.beginPath(); g.moveTo(dx, -36); g.lineTo(dx, -114); g.stroke();
      g.fillStyle = shade(c.color, -0.5);
      rr(g, dx + 14, -96, 22, 6, 3); g.fill();
    }

    for (const wpath of d.windows) {
      const wg = g.createLinearGradient(0, d.top, 0, -110);
      wg.addColorStop(0, '#c7ecff');
      wg.addColorStop(1, '#3b6fb8');
      g.fillStyle = wg;
      g.fill(wpath);
      g.save();
      g.clip(wpath);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.moveTo(-260, -110); g.lineTo(-230, -110); g.lineTo(-90, -220); g.lineTo(-120, -220); g.fill();
      g.beginPath(); g.moveTo(-60, -110); g.lineTo(-48, -110); g.lineTo(92, -220); g.lineTo(80, -220); g.fill();
      g.restore();
      g.strokeStyle = NAVY;
      g.lineWidth = 3.5;
      g.stroke(wpath);
    }

    g.fillStyle = '#fff7c2';
    g.strokeStyle = NAVY;
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(d.head[0], d.head[1], 9, 12, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#ff3b3b';
    rr(g, d.tail[0], d.tail[1] - 10, 9, 20, 3); g.fill(); g.stroke();

    g.drawImage(c.dirt, BOX.x, BOX.y, BOX.w, BOX.h);
    g.globalAlpha *= 0.96;
    g.drawImage(c.foam, BOX.x, BOX.y, BOX.w, BOX.h);
    g.globalAlpha /= 0.96;

    g.strokeStyle = NAVY;
    g.lineWidth = 5;
    g.stroke(d.body);

    if (full && c.shine > 0) {
      g.save();
      g.clip(d.body);
      const sx = -320 + 640 * ease.inOut(c.shine);
      const gr = g.createLinearGradient(sx - 60, 0, sx + 60, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(sx - 60, 0); g.lineTo(sx + 20, 0); g.lineTo(sx + 100, -230); g.lineTo(sx + 20, -230); g.fill();
      g.restore();
    }
    g.restore();

    for (const wx of d.wheels) drawWheel(g, c, wx);
  }

  function drawWheel(g, c, wx) {
    const y = -WHEEL_R;
    g.save();
    g.translate(wx, y);
    g.fillStyle = '#1f2433';
    g.beginPath(); g.arc(0, 0, WHEEL_R, 0, TAU); g.fill();
    g.strokeStyle = '#0d1222';
    g.lineWidth = 3;
    g.stroke();
    g.rotate(c.wheelAngle);
    g.strokeStyle = '#363d52';
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * 29, Math.sin(a) * 29); g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); g.stroke();
    }
    const rg = g.createRadialGradient(-6, -6, 2, 0, 0, 22);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(1, '#9aa6b8');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
    g.strokeStyle = '#6f7b8f';
    g.lineWidth = 5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); g.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); g.stroke();
    }
    g.fillStyle = '#4b5568';
    g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    if (c.tyreMud > 0) {
      g.globalAlpha *= c.tyreMud;
      g.strokeStyle = 'rgba(96,64,36,0.9)';
      g.lineWidth = 10;
      g.beginPath(); g.arc(0, 0, 30, 0.3, 4.4); g.stroke();
      g.fillStyle = 'rgba(110,76,44,0.85)';
      for (const [px, py, pr] of [[8, -10, 7], [-12, 4, 6], [4, 12, 5]]) { g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); }
    }
    g.restore();
  }

  function drawRigs() {
    if (car.rollerX != null) {
      const x = car.x + car.rollerX * s;
      const w = 54 * s;
      const top = beamY + 10 * s;
      const bot = groundY - 6 * s;
      ctx.fillStyle = '#45526b';
      ctx.fillRect(x - 4 * s, beamY - 4 * s, 8 * s, 20 * s);
      ctx.save();
      ctx.globalAlpha = 0.94;
      rr(ctx, x - w / 2, top, w, bot - top, w / 2);
      ctx.fillStyle = '#38a0ff';
      ctx.fill();
      ctx.clip();
      const off = (time * 320 * s) % (22 * s);
      ctx.fillStyle = '#ffc61a';
      for (let y = top - 22 * s + off; y < bot; y += 22 * s) ctx.fillRect(x - w / 2, y, w, 8 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - w / 2 + 8 * s, top, 7 * s, bot - top);
      ctx.restore();
      ctx.fillStyle = 'rgba(56,160,255,0.9)';
      for (let y = top + 8 * s, i = 0; y < bot - 6 * s; y += 13 * s, i++) {
        const wob = Math.sin(time * 30 + i) * 2 * s;
        ctx.beginPath(); ctx.arc(x - w / 2 + wob, y, 6 * s, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + w / 2 - wob, y + 6 * s, 6 * s, 0, TAU); ctx.fill();
      }
    }
    if (car.rinseX != null) {
      const x = car.x + car.rinseX * s;
      ctx.fillStyle = '#ffc61a';
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 3 * s;
      rr(ctx, x - 22 * s, beamY - 6 * s, 44 * s, 22 * s, 6 * s);
      ctx.fill(); ctx.stroke();
      const gr = ctx.createLinearGradient(0, beamY, 0, groundY);
      gr.addColorStop(0, 'rgba(170,225,255,0.55)');
      gr.addColorStop(1, 'rgba(170,225,255,0.12)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - 8 * s, beamY + 16 * s);
      ctx.lineTo(x + 8 * s, beamY + 16 * s);
      ctx.lineTo(x + 46 * s, groundY);
      ctx.lineTo(x - 46 * s, groundY);
      ctx.closePath();
      ctx.fill();
    }
    if (lastPhase === 'foam') {
      ctx.fillStyle = 'rgba(214,196,255,0.45)';
      for (const k of [-200, -120, -40, 40, 120, 200]) {
        const nx = archX + k * s;
        const len = (30 + Math.sin(time * 20 + k) * 6) * s;
        ctx.beginPath();
        ctx.moveTo(nx - 3 * s, beamY + 16 * s);
        ctx.lineTo(nx + 3 * s, beamY + 16 * s);
        ctx.lineTo(nx + 14 * s, beamY + 16 * s + len);
        ctx.lineTo(nx - 14 * s, beamY + 16 * s + len);
        ctx.fill();
      }
    }
  }

  function drawDrops() {
    for (const d of drops) {
      if (d.kind === 'foam') {
        ctx.fillStyle = 'rgba(236,226,255,0.95)';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, 0, TAU); ctx.fill();
      } else if (d.kind === 'water') {
        ctx.strokeStyle = 'rgba(150,215,255,0.85)';
        ctx.lineWidth = d.r;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.02, d.y - d.vy * 0.03); ctx.stroke();
      } else {
        ctx.fillStyle = d.water ? 'rgba(170,225,255,0.9)' : 'rgba(205,185,255,0.9)';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      }
    }
  }

  function drawSparkles() {
    for (const p of sparkles) {
      const k = Math.sin((p.t / p.life) * Math.PI);
      const r = p.sz * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.95 * k})`;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBubbles() {
    ctx.lineWidth = 1.2;
    for (const b of bubbles) {
      const alpha = b.ambient ? 1 : clamp(b.life, 0, 1);
      ctx.globalAlpha = alpha;
      const gr = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
      gr.addColorStop(0, 'rgba(255,255,255,0.04)');
      gr.addColorStop(1, 'rgba(255,255,255,0.28)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190,140,255,0.4)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.82, 0.2, 1.4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.38, b.y - b.r * 0.38, b.r * 0.16, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ loop & input
  let running = false;
  let raf = 0;
  let last = 0;
  let inView = true;

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion || !inView || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function renderStill() {
    if (!car) startCar();
    car.x = archX;
    car.dctx.clearRect(BOX.x, BOX.y, BOX.w, BOX.h);
    car.tyreMud = 0;
    car.shine = 0.5;
    render();
  }

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!pointer.active) { pointer.px = x; pointer.py = y; }
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
    pointer.moved = true;
  }

  hero.addEventListener('pointermove', onPointer, { passive: true });
  hero.addEventListener('pointerdown', onPointer, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (reduceMotion) renderStill(); }, 120);
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      inView ? start() : stop();
    }).observe(hero);
  }

  resize();
  // ?t=8 fast-forwards the loop to 8 s (for screenshots and tuning).
  const seek = parseFloat(new URLSearchParams(location.search).get('t'));
  if (seek > 0 && !reduceMotion) for (let i = 0; i < seek * 30; i++) update(1 / 30);
  if (reduceMotion) {
    renderStill();
    if (document.fonts) document.fonts.ready.then(renderStill);
  } else {
    start();
  }
})();
