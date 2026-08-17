import React, { useEffect, useRef } from 'react';
import './CornerEyes.css';

// Работу держат не скотч, а глаза: по одному на угол, положенные поперёк
// угла, как лента. Радужки разные — карие, серые, зелёные, ореховые, — а
// бледно-золотая кошачья попадается редко, не чаще одной на лист. Зрачок у
// всех вертикальной щелью. Глаза следят за курсором и изредка моргают, а там,
// где на работу смотреть нельзя, отводят взгляд прочь от неё.

const IRISES = [
  { name: 'карий', mid: '104, 72, 44', edge: '52, 32, 18' },
  { name: 'тёмный', mid: '68, 48, 34', edge: '30, 20, 14' },
  { name: 'серый', mid: '132, 134, 130', edge: '68, 70, 70' },
  { name: 'зелёный', mid: '96, 118, 78', edge: '42, 56, 36' },
  { name: 'ореховый', mid: '146, 116, 62', edge: '74, 54, 26' },
  { name: 'голубой', mid: '116, 142, 158', edge: '48, 68, 84' }
];

// Кошачий: бледное золото и щель во всю высоту
const CAT_IRIS = { mid: '198, 172, 92', edge: '104, 84, 32' };

const SLOTS = [
  { ox: 0, oy: 0 },
  { ox: 1, oy: 0 },
  { ox: 1, oy: 1 },
  { ox: 0, oy: 1 }
];

function hashSeed(seed) {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

export default function CornerEyes({ seed, avert }) {
  const canvasRef = useRef(null);
  const avertRef = useRef(avert);
  useEffect(() => { avertRef.current = avert; }, [avert]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    const random = makeRandom(seed);
    let width = 0, height = 0, pad = 0, artW = 0, artH = 0, frame = null;
    const eyes = [];
    const mouse = { x: -9999, y: -9999 };

    const build = () => {
      eyes.length = 0;
      const unit = Math.min(artW, artH);
      // кошачий достаётся не каждой работе и всегда один
      // пробуем так: бледное золото у всех четырёх
      const catAt = random() < 0.4 ? Math.floor(random() * SLOTS.length) : -1;

      SLOTS.forEach((slot, i) => {
        // ось угла: глаз ложится поперёк неё, как полоска скотча
        const diag = Math.atan2(0.5 - slot.oy, 0.5 - slot.ox);
        // чуть внутрь по диагонали: глаз садится на самый угол работы
        const inset = unit * 0.016;
        eyes.push({
          x: pad + slot.ox * artW + Math.cos(diag) * inset,
          y: pad + slot.oy * artH + Math.sin(diag) * inset,
          tilt: diag + Math.PI / 2 + (random() - 0.5) * 0.2,
          r: unit * (0.052 + random() * 0.012),
          flat: 0.42 + random() * 0.08,
          cat: true,
          iris: IRISES[Math.floor(random() * IRISES.length)],
          look: { x: 0, y: 0 },
          blinkAt: performance.now() + 2500 + random() * 8000,
          blink: 0
        });
      });
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      artW = host.offsetWidth || host.clientWidth;
      artH = host.offsetHeight || host.clientHeight;
      if (!artW || !artH) return;
      pad = Math.round(Math.min(artW, artH) * 0.05);
      width = artW + pad * 2;
      height = artH + pad * 2;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      canvas.style.left = -pad + 'px';
      canvas.style.top = -pad + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      // первый кадр рисуем сразу: иначе на перелистывании холст миг пустой
      paint(performance.now());
    };

    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left + pad;
      mouse.y = e.clientY - r.top + pad;
    };

    const drawEye = (e, now) => {
      if (now > e.blinkAt) { e.blink = 1; e.blinkAt = now + 3000 + Math.random() * 9000; }
      e.blink = Math.max(0, e.blink - 0.07);
      const lid = 1 - Math.sin(e.blink * Math.PI) * 0.94;

      const r = e.r;
      const ry = r * e.flat * Math.max(0.04, lid);

      // взгляд тянется за курсором, но недалеко. А если работе смотреть в
      // глаза нельзя — зрачки уходят прочь от неё, к своему углу
      let tx, ty;
      if (avertRef.current) {
        const ax = e.x - (pad + artW / 2), ay = e.y - (pad + artH / 2);
        const ad = Math.hypot(ax, ay) || 1;
        tx = (ax / ad) * r * 0.3;
        ty = (ay / ad) * r * e.flat * 0.5;
      } else {
        const dx = mouse.x - e.x, dy = mouse.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, d / 320);
        tx = (dx / d) * r * 0.26 * reach;
        ty = (dy / d) * r * e.flat * 0.4 * reach;
      }
      e.look.x += (tx - e.look.x) * 0.14;
      e.look.y += (ty - e.look.y) * 0.14;

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.tilt);

      const lidPath = () => {
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r * 0.45, -ry, r * 0.45, -ry, r, 0);
        ctx.bezierCurveTo(r * 0.5, ry * 0.9, -r * 0.5, ry * 0.9, -r, 0);
        ctx.closePath();
      };

      // белок с тенью: глаз лежит на бумаге и держит её
      ctx.save();
      ctx.shadowColor = 'rgba(8, 6, 6, 0.55)';
      ctx.shadowBlur = r * 0.4;
      ctx.shadowOffsetY = r * 0.1;
      lidPath();
      const white = ctx.createLinearGradient(0, -ry, 0, ry);
      white.addColorStop(0, 'rgba(206, 200, 192, 0.99)');
      white.addColorStop(0.4, 'rgba(242, 238, 232, 0.99)');
      white.addColorStop(1, 'rgba(210, 202, 194, 0.99)');
      ctx.fillStyle = white;
      ctx.fill();
      ctx.restore();

      lidPath();
      ctx.save();
      ctx.clip();
      ctx.rotate(-e.tilt);

      const px = e.look.x, py = e.look.y;
      const irisR = r * 0.36;
      const kind = e.cat ? CAT_IRIS : e.iris;

      const paintIris = ctx.createRadialGradient(px, py, irisR * 0.15, px, py, irisR);
      paintIris.addColorStop(0, `rgba(${kind.mid}, 0.99)`);
      paintIris.addColorStop(0.72, `rgba(${kind.mid}, 0.97)`);
      paintIris.addColorStop(1, `rgba(${kind.edge}, 0.98)`);
      ctx.beginPath();
      ctx.arc(px, py, irisR, 0, Math.PI * 2);
      ctx.fillStyle = paintIris;
      ctx.fill();

      // волокна радужки
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, irisR, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = `rgba(${kind.edge}, 0.45)`;
      ctx.lineWidth = Math.max(0.4, irisR * 0.06);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * irisR * 0.42, py + Math.sin(a) * irisR * 0.42);
        ctx.lineTo(px + Math.cos(a) * irisR, py + Math.sin(a) * irisR);
        ctx.stroke();
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(px, py, irisR, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.5, r * 0.022);
      ctx.strokeStyle = 'rgba(26, 18, 14, 0.7)';
      ctx.stroke();

      // зрачок у всех щелевой: круглый сюда не идёт вовсе
      ctx.beginPath();
      ctx.ellipse(px, py, irisR * 0.2, irisR * 0.94, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 5, 5, 0.99)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - irisR * 0.34, py - irisR * 0.36, irisR * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      // тень от верхнего века на белке
      ctx.beginPath();
      ctx.moveTo(-r, -ry * 0.1);
      ctx.bezierCurveTo(-r * 0.45, -ry * 1.1, r * 0.45, -ry * 1.1, r, -ry * 0.1);
      ctx.lineTo(r, -ry * 1.2);
      ctx.lineTo(-r, -ry * 1.2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(40, 32, 28, 0.18)';
      ctx.fill();
      ctx.restore();

      // веки: сверху линия жирнее, как в рисунке карандашом
      lidPath();
      ctx.lineWidth = Math.max(0.8, r * 0.055);
      ctx.strokeStyle = 'rgba(24, 18, 16, 0.9)';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.bezierCurveTo(-r * 0.45, -ry * 1.08, r * 0.45, -ry * 1.08, r, 0);
      ctx.lineWidth = Math.max(1, r * 0.085);
      ctx.strokeStyle = 'rgba(16, 12, 11, 0.75)';
      ctx.stroke();

      ctx.restore();
    };

    const paint = (now) => {
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;
      for (const e of eyes) drawEye(e, now);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 30;

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;
      paint(now);
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [seed]);

  return <canvas ref={canvasRef} className="corner-eyes" aria-hidden="true" />;
}
