import React, { useEffect, useRef } from 'react';
import './PentagramLayer.css';

// Пентаграмма лежит на самой работе, внутри её рамки: поэтому она едет вместе
// со страницей при перелистывании и не висит поверх книги. Десять узлов —
// пять вершин и пять внутренних пересечений, ровно по числу глаз главы.

export default function PentagramLayer({ taken, total, finale }) {
  const canvasRef = useRef(null);
  const dataRef = useRef({ taken: taken || [], total: total || 1 });
  useEffect(() => { dataRef.current = { taken: taken || [], total: total || 1 }; }, [taken, total]);

  // Прощание знака: он разгорается целиком, проворачивается и гаснет,
  // отпуская работу. Момент начала держим в ссылке, чтобы слой не собирался заново
  const finaleRef = useRef(0);
  useEffect(() => {
    if (finale && !finaleRef.current) finaleRef.current = performance.now();
    if (!finale) finaleRef.current = 0;
  }, [finale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    let width = 0, height = 0, frame = null;
    const nodes = [];

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = host.offsetWidth || host.clientWidth;
      height = host.offsetHeight || host.clientHeight;
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes.length = 0;
      const cx = width / 2, cy = height / 2;
      const R = Math.min(width, height) * 0.36;
      const inner = R * 0.382;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        nodes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: width * 0.045, tilt: a + Math.PI / 2 });
      }
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + ((i + 0.5) / 5) * Math.PI * 2;
        nodes.push({ x: cx + Math.cos(a) * inner, y: cy + Math.sin(a) * inner, r: width * 0.034, tilt: a + Math.PI / 2 });
      }
      canvas.starPts = null;
      canvas.center = { cx, cy, R };
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', measure);

    const drawEye = (node, spec, now) => {
      const r = node.r * (spec.big ? 1.25 : 1);
      const ry = r * (spec.flat || 0.55);
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(node.tilt);

      const lidPath = () => {
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r * 0.45, -ry, r * 0.45, -ry, r, 0);
        ctx.bezierCurveTo(r * 0.5, ry * 0.86, -r * 0.5, ry * 0.86, -r, 0);
        ctx.closePath();
      };

      lidPath();
      ctx.fillStyle = spec.style === 'ink'
        ? 'rgba(20, 16, 22, 0.98)'
        : spec.style === 'beacon' ? 'rgba(86, 14, 14, 0.98)'
        : spec.style === 'wound' ? 'rgba(74, 16, 16, 0.98)'
        : 'rgba(228, 222, 214, 0.97)';
      ctx.fill();

      lidPath();
      ctx.save();
      ctx.clip();
      ctx.rotate(-node.tilt);

      let px = 0, py = 0;
      if (spec.exit === 'up') py = -ry * 0.3;
      else if (spec.exit === 'right') px = r * 0.3;

      const irisR = r * 0.44;
      if (spec.style === 'ink') {
        const gold = ctx.createRadialGradient(px, py, irisR * 0.2, px, py, irisR);
        gold.addColorStop(0, 'rgba(246, 214, 120, 0.98)');
        gold.addColorStop(0.7, 'rgba(198, 150, 52, 0.96)');
        gold.addColorStop(1, 'rgba(120, 84, 24, 0.92)');
        ctx.beginPath(); ctx.arc(px, py, irisR, 0, Math.PI * 2);
        ctx.fillStyle = gold;
        ctx.shadowColor = 'rgba(250, 220, 140, 0.6)';
        ctx.shadowBlur = irisR * 1.3;
        ctx.fill();
        ctx.shadowBlur = 0;

        const coreR = irisR * 0.56;
        const core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
        core.addColorStop(0, 'rgba(255, 255, 252, 1)');
        core.addColorStop(1, 'rgba(246, 240, 214, 1)');
        ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.fillStyle = core; ctx.fill();

        ctx.beginPath(); ctx.arc(px, py, Math.max(0.7, coreR * 0.14), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(122, 118, 112, 0.9)'; ctx.fill();
      } else if (spec.style === 'pierced') {
        ctx.beginPath(); ctx.arc(px, py, irisR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96, 78, 66, 0.92)'; ctx.fill();
        ctx.lineWidth = Math.max(0.7, r * 0.04);
        ctx.strokeStyle = 'rgba(22, 16, 14, 0.7)'; ctx.stroke();
      } else {
        const beacon = spec.style === 'beacon';
        if (beacon) {
          const beat = 0.8 + 0.2 * Math.sin(now * 0.004);
          ctx.shadowColor = `rgba(214, 40, 34, ${0.5 + beat * 0.4})`;
          ctx.shadowBlur = irisR * 2;
        }
        // Раздвоенный: два карих глаза рядом, каждый со своим зрачком и бликом.
        // Общей подложки под ними нет, иначе выходит одно пятно с двумя точками
        const pupilR = irisR * 0.5;
        if (spec.twin) {
          ctx.shadowBlur = 0;
          for (const ox of [-irisR * 0.66, irisR * 0.66]) {
            const twinR = irisR * 0.74;
            const coat = ctx.createRadialGradient(px + ox, py, twinR * 0.2, px + ox, py, twinR);
            coat.addColorStop(0, 'rgba(112, 78, 52, 0.98)');
            coat.addColorStop(0.65, 'rgba(78, 54, 38, 0.97)');
            coat.addColorStop(1, 'rgba(48, 32, 24, 0.97)');
            ctx.beginPath(); ctx.arc(px + ox, py, twinR, 0, Math.PI * 2);
            ctx.fillStyle = coat; ctx.fill();
            ctx.lineWidth = Math.max(0.6, r * 0.03);
            ctx.strokeStyle = 'rgba(22, 16, 14, 0.75)'; ctx.stroke();

            ctx.beginPath(); ctx.arc(px + ox, py, twinR * 0.46, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(8, 6, 6, 0.99)'; ctx.fill();

            ctx.beginPath();
            ctx.arc(px + ox - twinR * 0.3, py - twinR * 0.34, twinR * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.fill();
          }
        } else {
          ctx.beginPath(); ctx.arc(px, py, irisR, 0, Math.PI * 2);
          ctx.fillStyle = spec.style === 'wound'
            ? 'rgba(52, 10, 10, 0.96)'
            : beacon ? 'rgba(58, 10, 10, 0.96)' : 'rgba(66, 46, 36, 0.96)';
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.arc(px, py, pupilR, 0, Math.PI * 2);
          ctx.fillStyle = spec.style === 'beacon' || spec.style === 'wound'
            ? 'rgba(186, 20, 18, 0.99)'
            : 'rgba(8, 6, 6, 0.99)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px - irisR * 0.3, py - irisR * 0.34, irisR * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.fill();
        }
      }
      ctx.restore();

      lidPath();
      ctx.lineWidth = Math.max(0.9, r * 0.06);
      ctx.strokeStyle = 'rgba(18, 14, 13, 0.9)';
      ctx.stroke();
      ctx.restore();
    };

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 30;

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;
      const { taken: got, total: need } = dataRef.current;
      ctx.clearRect(0, 0, width, height);

      if (!width || !height || !canvas.center) { frame = requestAnimationFrame(draw); return; }
      const { cx, cy, R } = canvas.center;
      const filled = Math.min(nodes.length, got.length);
      const ready = got.length >= need;

      // Прощание: разгорается, проворачивается, гаснет — и работа выходит из тьмы
      const started = finaleRef.current;
      const bye = started ? (now - started) / 1000 : 0;
      const soft = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
      const blaze = started ? soft(Math.min(1, bye / 0.9)) : 0;
      const spin = started ? soft(Math.max(0, Math.min(1, (bye - 0.5) / 1.9))) : 0;
      const gone = started ? soft(Math.max(0, Math.min(1, (bye - 1.9) / 1.5))) : 0;
      const veilAlpha = 0.9 * (1 - gone);

      // работа тонет во тьме: сквозь неё проступает только знак
      canvas.style.backgroundColor = `rgba(5, 5, 9, ${veilAlpha})`;
      ctx.save();
      ctx.globalAlpha = 1 - gone;
      ctx.translate(cx, cy);
      ctx.rotate(spin * Math.PI * 2.6);
      ctx.scale(1 + spin * 0.14 - gone * 0.34, 1 + spin * 0.14 - gone * 0.34);
      ctx.translate(-cx, -cy);

      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + ((i * 2) % 5 / 5) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }

      // тусклый знак виден с самого начала
      ctx.save();
      ctx.globalAlpha = 0.26 * (1 - gone);
      ctx.strokeStyle = 'rgba(160, 150, 142, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const p = pts[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // и загорается по мере того, как узлы занимают глаза
      const drawn = (ready || started) ? 5 : (filled / nodes.length) * 5;
      ctx.save();
      ctx.globalAlpha = (1 - gone) * (started ? 0.95 + blaze * 0.05 : (ready ? 0.95 : 0.7));
      ctx.strokeStyle = ready ? 'rgba(230, 202, 138, 0.95)' : 'rgba(206, 194, 180, 0.9)';
      ctx.lineWidth = ready ? 2.4 : 1.6;
      if (ready || started) { ctx.shadowColor = 'rgba(240, 210, 150, 0.7)'; ctx.shadowBlur = 20 + blaze * 34; }
      ctx.beginPath();
      const whole = Math.floor(drawn);
      for (let i = 0; i <= whole && i < 5; i++) {
        const p = pts[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      const rest = drawn - whole;
      if (rest > 0.01 && whole < 5) {
        const a = pts[whole % 5], b = pts[(whole + 1) % 5];
        ctx.lineTo(a.x + (b.x - a.x) * rest, a.y + (b.y - a.y) * rest);
      }
      if (ready || started) { ctx.lineTo(pts[0].x, pts[0].y); ctx.closePath(); }
      ctx.stroke();
      ctx.restore();

      nodes.forEach((node, i) => {
        const spec = got[i];
        if (!spec) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(12, 11, 15, 0.7)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(190, 180, 170, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(150, 142, 134, 0.5)';
          ctx.fill();
          ctx.restore();
          return;
        }
        drawEye(node, spec, now);
      });

      ctx.restore();

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="pentagram-layer" />;
}
