import React, { useEffect, useRef } from 'react';
import './CornerVeins.css';

// Работу держат короткие чёрные жилы. Они пробивают бумагу у самого края и
// заходят на лист совсем немного. Сперва их четыре, по углам; каждый снятый с
// работ глаз добавляет ещё одну вдоль краёв, и она медленно прорастает на своё
// место. Жилы не пульсируют и не мерцают: проросла — и держит.

const GROW_TIME = 900;      // сколько прорастает новая жила
const BASE_COUNT = 4;       // столько держит лист с самого начала

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

export default function CornerVeins({ seed, grown = 0 }) {
  const canvasRef = useRef(null);
  const grownRef = useRef(grown);
  useEffect(() => { grownRef.current = grown; }, [grown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    const random = makeRandom(seed);
    let width = 0, height = 0, pad = 0, artW = 0, artH = 0, frame = null;
    const veins = [];

    // Места по краю листа: сперва четыре угла, затем точки вдоль сторон.
    // Порядок для этой работы всегда один и тот же, поэтому жилы прибывают
    // в те же места, сколько бы раз ни открыть страницу
    const planSpots = () => {
      const spots = [];
      for (const [ox, oy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        spots.push({ ox, oy, inward: Math.atan2(0.5 - oy, 0.5 - ox) });
      }
      const sides = [
        { ox: 0.5, oy: 0, inward: Math.PI / 2 },
        { ox: 1, oy: 0.5, inward: Math.PI },
        { ox: 0.5, oy: 1, inward: -Math.PI / 2 },
        { ox: 0, oy: 0.5, inward: 0 }
      ];
      for (let ring = 0; ring < 4; ring++) {
        for (const side of sides) {
          const jitter = (random() - 0.5) * 0.5;
          spots.push({
            ox: side.ox === 0.5 ? 0.5 + jitter : side.ox,
            oy: side.oy === 0.5 ? 0.5 + jitter : side.oy,
            inward: side.inward + (random() - 0.5) * 0.5
          });
        }
      }
      return spots;
    };

    // Одна жила: короткий стержень с парой мелких отростков
    const shape = (spot, unit) => {
      const angle = spot.inward + (random() - 0.5) * 0.4;
      const len = unit * (0.05 + random() * 0.028);
      const thick = unit * (0.0095 + random() * 0.0045);
      const steps = 5;
      const seg = len / steps;

      const line = (x0, y0, a0, count, drift) => {
        const pts = [{ x: x0, y: y0 }];
        let a = a0, x = x0, y = y0;
        for (let i = 0; i < count; i++) {
          a += (random() - 0.5) * drift;
          x += Math.cos(a) * seg;
          y += Math.sin(a) * seg;
          pts.push({ x, y });
        }
        return pts;
      };

      const trunk = line(0, 0, angle, steps, 0.28);
      const twigs = [];
      const forks = random() < 0.55 ? 2 : 1;
      for (let f = 0; f < forks; f++) {
        const at = 2 + Math.floor(random() * 2);
        const from = trunk[at];
        const prev = trunk[at - 1];
        const base = Math.atan2(from.y - prev.y, from.x - prev.x);
        const side = random() < 0.5 ? -1 : 1;
        twigs.push(line(from.x, from.y, base + side * (0.5 + random() * 0.5), 2, 0.42));
      }

      return { angle, thick, trunk, twigs, holeR: thick * (1.4 + random() * 0.5) };
    };

    const build = () => {
      veins.length = 0;
      const unit = Math.min(artW, artH);
      planSpots().forEach((spot, i) => {
        const s = shape(spot, unit);
        const back = unit * (0.014 + random() * 0.012);
        veins.push({
          x: pad + spot.ox * artW - Math.cos(s.angle) * back,
          y: pad + spot.oy * artH - Math.sin(s.angle) * back,
          index: i,
          shape: s,
          shown: 0,
          startedAt: 0
        });
      });
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      artW = host.offsetWidth || host.clientWidth;
      artH = host.offsetHeight || host.clientHeight;
      if (!artW || !artH) return;
      // поле снаружи маленькое: жилы почти целиком лежат на самой работе
      pad = Math.round(Math.min(artW, artH) * 0.06);
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
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', measure);

    // Ломаная выводится настолько, насколько жила успела прорасти
    const strokeLine = (pts, from, thick, part) => {
      const total = pts.length - 1;
      const upTo = total * Math.max(0, Math.min(1, part));
      const whole = Math.floor(upTo);
      const rest = upTo - whole;

      for (let i = 0; i < total; i++) {
        if (i > whole) break;
        const a = pts[i];
        let b = pts[i + 1];
        if (i === whole && rest < 1) {
          b = { x: a.x + (b.x - a.x) * rest, y: a.y + (b.y - a.y) * rest };
        }
        ctx.beginPath();
        ctx.moveTo(from.x + a.x, from.y + a.y);
        ctx.lineTo(from.x + b.x, from.y + b.y);
        ctx.lineWidth = Math.max(0.6, thick * (1 - (i / total) * 0.6));
        ctx.stroke();
      }
    };

    const drawVein = (v) => {
      const s = v.shape;
      const part = v.shown;
      const from = { x: v.x, y: v.y };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = Math.min(1, part * 1.7);

      // прокол: бумага у входа потемнела
      const holeR = s.holeR * Math.min(1, part * 2);
      const stain = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, holeR * 2.6);
      stain.addColorStop(0, 'rgba(16, 10, 11, 0.72)');
      stain.addColorStop(1, 'rgba(20, 12, 13, 0)');
      ctx.fillStyle = stain;
      ctx.beginPath();
      ctx.arc(from.x, from.y, holeR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // тень: жила лежит на бумаге, а не нарисована на ней
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.strokeStyle = 'rgba(8, 6, 7, 1)';
      ctx.shadowColor = 'rgba(6, 4, 5, 0.8)';
      ctx.shadowBlur = s.thick * 1.8;
      ctx.shadowOffsetX = s.thick * 0.4;
      ctx.shadowOffsetY = s.thick * 0.55;
      strokeLine(s.trunk, from, s.thick, part);
      ctx.restore();

      // багровая кромка и чёрное тело
      ctx.strokeStyle = 'rgba(58, 14, 16, 0.4)';
      strokeLine(s.trunk, from, s.thick * 1.7, part);
      ctx.strokeStyle = 'rgba(10, 7, 9, 0.96)';
      strokeLine(s.trunk, from, s.thick, part);

      // отростки трогаются, когда стержень уже почти на месте
      const twigPart = Math.max(0, (part - 0.55) / 0.45);
      if (twigPart > 0) {
        ctx.strokeStyle = 'rgba(10, 7, 9, 0.92)';
        for (const twig of s.twigs) strokeLine(twig, from, s.thick * 0.55, twigPart);
      }
      ctx.restore();
    };

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 30;
    const soft = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);
      if (!width || !height) { frame = requestAnimationFrame(draw); return; }

      const want = BASE_COUNT + Math.max(0, grownRef.current | 0);
      for (const v of veins) {
        if (v.index >= want) continue;
        if (!v.startedAt) {
          v.startedAt = now;
          // угловые уже вросли, поздние прорастают на глазах
          if (v.index < BASE_COUNT) v.shown = 1;
        }
        if (v.shown < 1) v.shown = soft(Math.min(1, (now - v.startedAt) / GROW_TIME));
        drawVein(v);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [seed]);

  return <canvas ref={canvasRef} className="corner-veins" aria-hidden="true" />;
}
