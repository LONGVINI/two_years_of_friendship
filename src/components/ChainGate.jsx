import React, { useEffect, useRef, useState } from 'react';
import './ChainGate.css';

// Замок между «Переосмыслением» и «За гранью». Цепи натянуты от корешка к краю
// правой страницы и открываются только в проёме: чем выше поднят лист, тем шире
// полоса, в которой их видно. Рисуем поверх книги, но строго внутри этой полосы,
// поэтому кажется, будто железо уходит под саму страницу.

const LINK_R = 17;      // цепь тяжёлая: звенья крупные и грубые

export default function ChainGate({ active, bookRef, broken = 0, strain = 0, total = 5, lift = 0 }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const brokenRef = useRef(broken);
  const strainRef = useRef(strain);
  const totalRef = useRef(total);
  const liftRef = useRef(lift);
  const snapRef = useRef({ at: 0, index: -1 });

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => {
    if (broken > brokenRef.current) snapRef.current = { at: performance.now(), index: broken - 1 };
    brokenRef.current = broken;
  }, [broken]);
  useEffect(() => { strainRef.current = strain; }, [strain]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { liftRef.current = lift; }, [lift]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null;
    const state = { fade: 0 };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    measure();
    window.addEventListener('resize', measure);

    const bookBox = () => {
      const host = bookRef && bookRef.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      return r && r.width ? r : null;
    };

    // Цепь идёт от корешка к правому краю разворота и лежит под страницей
    const chainRun = (box, i, count, pull) => {
      const at = (i + 0.5) / count;
      const y = box.top + box.height * (0.12 + at * 0.76);
      const spine = box.left + box.width * 0.5;
      return {
        from: { x: spine, y: y + 12 },
        to: { x: box.right - 8, y },
        sag: (1 - pull) * (22 + i * 4) + 5
      };
    };

    // Точка на дуге цепи
    const at = (run, t, jolt) => ({
      x: run.from.x + (run.to.x - run.from.x) * t,
      y: run.from.y + (run.to.y - run.from.y) * t + Math.sin(t * Math.PI) * run.sag + jolt * (1 - t)
    });

    // Звено рисуем как настоящее: кольцо в плоскости, а каждое второе — ребром,
    // и центры стоят так близко, что кольца заходят друг в друга
    const drawLink = (p, angle, flat, hot, dead, crack = 0) => {
      const r = LINK_R;
      const rx = r;
      const ry = flat ? r * 0.58 : r * 0.2;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);

      const body = ctx.createLinearGradient(0, -r, 0, r);
      if (dead) {
        body.addColorStop(0, 'rgba(96, 92, 92, 1)');
        body.addColorStop(1, 'rgba(30, 28, 30, 1)');
      } else {
        // старое кованое железо: сверху затёртый блик, книзу ржавая тень
        body.addColorStop(0, `rgba(${168 + hot * 60}, ${158 + hot * 30}, ${146 + hot * 10}, 1)`);
        body.addColorStop(0.42, `rgba(${118 + hot * 70}, ${100 + hot * 30}, ${86 + hot * 10}, 1)`);
        body.addColorStop(0.75, 'rgba(84, 62, 48, 1)');
        body.addColorStop(1, 'rgba(38, 32, 32, 1)');
      }

      // тень под звеном: железо лежит на бумаге
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.ellipse(1.5, 2.5, rx, ry, 0, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.4;
      ctx.strokeStyle = 'rgba(6, 5, 8, 1)';
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.4;
      ctx.strokeStyle = body;
      ctx.stroke();

      // фаска изнутри и блик сверху
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.78, ry * 0.62, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.6, r * 0.08);
      ctx.strokeStyle = 'rgba(12, 10, 14, 0.5)';
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, -r * 0.06, rx * 0.86, ry * 0.8, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.lineWidth = Math.max(0.6, r * 0.12);
      ctx.strokeStyle = 'rgba(238, 232, 224, 0.34)';
      ctx.stroke();

      // надорванное звено расходится: в теле кольца появляется щель
      if (crack > 0.02) {
        const gapA = 0.35 + crack * 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, -gapA, gapA);
        ctx.lineWidth = r * 0.46;
        ctx.strokeStyle = 'rgba(10, 8, 10, 0.95)';
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, -gapA * 0.8, gapA * 0.8);
        ctx.lineWidth = Math.max(1, r * 0.1);
        ctx.strokeStyle = `rgba(214, 128, 70, ${0.3 + crack * 0.5})`;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawChain = (run, tension, fade, jolt, dead, fall) => {
      // шаг меньше диаметра: соседние кольца перекрываются и держатся друг за друга
      const span = Math.hypot(run.to.x - run.from.x, run.to.y - run.from.y);
      const links = Math.max(6, Math.round(span / (LINK_R * 1.12)));
      // надорванное звено сидит на середине: оно и разгибается
      const weak = Math.round(links * 0.45);

      ctx.save();
      ctx.globalAlpha = fade;
      for (let i = 0; i <= links; i++) {
        const t = i / links;
        const p = at(run, t, jolt);
        const n = at(run, Math.min(1, t + 1 / links), jolt);
        const angle = Math.atan2(n.y - p.y, n.x - p.x);
        const shake = tension > 0.35 ? (Math.random() - 0.5) * tension * 4 : 0;
        // от надрыва цепь растягивается: звенья за слабым отходят в сторону края
        const stretch = i > weak ? tension * 6 * ((i - weak) / links) : 0;

        drawLink(
          {
            x: p.x + shake + stretch,
            y: p.y + (fall ? fall * fall * 480 * (0.3 + t) : 0)
          },
          angle,
          i % 2 === 0,
          i === weak ? Math.min(1, tension * 1.6) : tension * 0.4,
          dead,
          i === weak ? tension : 0
        );
      }
      ctx.restore();
    };

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 40;

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;

      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.06 : -0.06)));
      if (!on && state.fade <= 0) { setAlive(false); return; }

      ctx.clearRect(0, 0, width, height);
      const box = bookBox();
      if (!box) { frame = requestAnimationFrame(draw); return; }

      const count = totalRef.current;
      const left = Math.max(0, count - brokenRef.current);
      const tension = Math.max(0, Math.min(1, strainRef.current));

      // Поднятая страница стоит под углом, её проекция короче половины разворота.
      // Между этой проекцией и правым краем и лежит проём, где видно железо
      const spine = box.left + box.width * 0.5;
      const half = box.width * 0.5;
      const angle = Math.max(0, Math.min(90, liftRef.current)) * Math.PI / 180;
      const edge = spine + half * Math.cos(angle);
      const gap = box.right - edge;
      if (gap < 6) { frame = requestAnimationFrame(draw); return; }

      // рисуем только в проёме: ничего своего под цепи не подкладываем,
      // иначе на странице появляется чёрный прямоугольник
      ctx.save();
      ctx.beginPath();
      ctx.rect(edge, box.top - 4, gap + 6, box.height + 8);
      ctx.clip();

      // только что лопнувшая цепь ещё падает
      const snap = snapRef.current;
      const snapAge = snap.at ? (now - snap.at) / 1200 : 2;
      if (snapAge < 1) {
        const run = chainRun(box, snap.index, count, 1);
        ctx.save();
        ctx.globalAlpha = state.fade * (1 - snapAge);
        drawChain(run, 0, state.fade * (1 - snapAge), 0, true, snapAge);
        ctx.restore();
      }

      for (let i = 0; i < left; i++) {
        const run = chainRun(box, i, count, tension);
        const jolt = tension > 0.5 ? (Math.random() - 0.5) * tension * 16 : 0;
        drawChain(run, tension, state.fade, jolt, false, 0);
      }

      ctx.restore();

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive]);

  if (!alive) return null;
  return <canvas ref={canvasRef} className="chain-gate" aria-hidden="true" />;
}
