import React, { useEffect, useRef, useState } from 'react';
import './ScreenVeins.css';

// Глава прорастает не только в бумагу. По всему экрану, за пределами книги, от
// краёв внутрь тянутся крупные чёрные жилы. Каждый снятый с работ глаз пускает
// новую: она вырастает на глазах и остаётся. Жилы не пульсируют и не мерцают.

const GROW_TIME = 1800;
const MAX_VEINS = 26;

export default function ScreenVeins({ active, grown = 0, bookRef }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const grownRef = useRef(grown);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { grownRef.current = grown; }, [grown]);
  const bookHost = useRef(bookRef);
  useEffect(() => { bookHost.current = bookRef; }, [bookRef]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null;
    const veins = [];
    const state = { fade: 0 };

    // Жила растёт от края экрана внутрь, ветвясь пару раз
    const shape = (side, along, unit) => {
      let x, y, angle;
      if (side === 0) { x = width * along; y = -unit * 0.02; angle = Math.PI / 2; }
      else if (side === 1) { x = width + unit * 0.02; y = height * along; angle = Math.PI; }
      else if (side === 2) { x = width * along; y = height + unit * 0.02; angle = -Math.PI / 2; }
      else { x = -unit * 0.02; y = height * along; angle = 0; }
      angle += (Math.random() - 0.5) * 0.8;

      const len = unit * (0.3 + Math.random() * 0.26);
      const thick = unit * (0.012 + Math.random() * 0.009);
      const steps = 9;
      const seg = len / steps;

      const line = (x0, y0, a0, count, drift) => {
        const pts = [{ x: x0, y: y0 }];
        let a = a0, px = x0, py = y0;
        for (let i = 0; i < count; i++) {
          a += (Math.random() - 0.5) * drift;
          px += Math.cos(a) * seg;
          py += Math.sin(a) * seg;
          pts.push({ x: px, y: py });
        }
        return pts;
      };

      const trunk = line(0, 0, angle, steps, 0.3);
      const twigs = [];
      const forks = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let f = 0; f < forks; f++) {
        const at = 3 + Math.floor(Math.random() * (trunk.length - 4));
        const from = trunk[at];
        const prev = trunk[at - 1];
        const base = Math.atan2(from.y - prev.y, from.x - prev.x);
        const side2 = Math.random() < 0.5 ? -1 : 1;
        twigs.push(line(from.x, from.y, base + side2 * (0.5 + Math.random() * 0.6),
                        3 + Math.floor(Math.random() * 2), 0.42));
      }

      return { x, y, thick, trunk, twigs };
    };

    const addVein = (i) => {
      const unit = Math.min(width, height);
      const side = i % 4;
      const along = 0.12 + ((i * 0.37) % 1) * 0.76;
      veins.push({ ...shape(side, along, unit), shown: 0, startedAt: 0, index: i });
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.3);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // при смене размеров жилы перерисовываются заново, но их число и
      // степень роста сохраняются: выросшее не должно пропадать
      const kept = veins.map((v) => ({ shown: v.shown, startedAt: v.startedAt, index: v.index }));
      veins.length = 0;
      kept.forEach((k) => {
        addVein(k.index);
        const v = veins[veins.length - 1];
        v.shown = k.shown;
        v.startedAt = k.startedAt;
      });
    };

    measure();
    window.addEventListener('resize', measure);

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
        ctx.lineWidth = Math.max(0.8, thick * (1 - (i / total) * 0.7));
        ctx.stroke();
      }
    };

    const body = (v, part) => {
      const from = { x: v.x, y: v.y };
      ctx.strokeStyle = 'rgba(82, 16, 20, 0.6)';
      strokeLine(v.trunk, from, v.thick * 1.9, part);
      ctx.strokeStyle = 'rgba(9, 6, 8, 0.95)';
      strokeLine(v.trunk, from, v.thick, part);

      // у отростков кромка своя: без неё они уходят в чёрное и пропадают
      const twigPart = Math.max(0, (part - 0.45) / 0.55);
      if (twigPart > 0) {
        for (const twig of v.twigs) {
          ctx.strokeStyle = 'rgba(82, 16, 20, 0.55)';
          strokeLine(twig, from, v.thick * 1.1, twigPart);
          ctx.strokeStyle = 'rgba(9, 6, 8, 0.9)';
          strokeLine(twig, from, v.thick * 0.5, twigPart);
        }
      }
    };

    // Прямоугольник книги: над ней жила лишь просвечивает, чтобы не съедать
    // ни работу, ни текст, а за её пределами лежит в полную силу
    const bookBox = () => {
      const host = bookHost.current && bookHost.current.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      return r && r.width ? r : null;
    };

    const drawVein = (v, fade) => {
      const part = v.shown;
      const box = bookBox();
      const alpha = fade * Math.min(1, part * 1.5);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (!box) {
        ctx.globalAlpha = alpha;
        body(v, part);
        ctx.restore();
        return;
      }

      // всё, что вне книги
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(box.left, box.top, box.width, box.height);
      ctx.clip('evenodd');
      ctx.globalAlpha = alpha;
      body(v, part);
      ctx.restore();

      // и то, что легло на книгу
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.left, box.top, box.width, box.height);
      ctx.clip();
      ctx.globalAlpha = alpha * 0.3;
      body(v, part);
      ctx.restore();

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

      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.05 : -0.04)));
      if (!on && state.fade <= 0) { setAlive(false); return; }

      ctx.clearRect(0, 0, width, height);

      const want = Math.min(MAX_VEINS, Math.max(0, grownRef.current | 0));
      while (veins.length < want) addVein(veins.length);

      for (const v of veins) {
        if (!v.startedAt) v.startedAt = now;
        if (v.shown < 1) v.shown = soft(Math.min(1, (now - v.startedAt) / GROW_TIME));
        drawVein(v, state.fade);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive]);

  if (!alive) return null;
  return <canvas ref={canvasRef} className="screen-veins" aria-hidden="true" />;
}
