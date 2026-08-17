import React, { useEffect, useRef } from 'react';
import './BrokenSheet.css';

// Последний лист альбома цел не полностью: от краёв по бумаге разбежались
// трещины, а низ и вовсе оборван неровным краем. За обрывом ничего нет —
// только темнота, в которой едва тлеет тот же свет, что вёл сюда.

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

export default function BrokenSheet({ seed = 'beyond-broken', side = 'left' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    let width = 0, height = 0, frame = null, lastFrame = 0;
    let cracks = [];
    let tear = [];

    const build = () => {
      const random = makeRandom(seed);
      cracks = [];
      tear = [];
      // разлом идёт через весь разворот: обе половины считают одну и ту же
      // картину в общих координатах, а каждая рисует лишь свою половину
      const W = width * 2;

      // Трещина: ломаная, ведомая от края внутрь, с парой отростков
      const line = (x0, y0, a0, steps, seg, drift) => {
        const pts = [{ x: x0, y: y0 }];
        let a = a0, x = x0, y = y0;
        for (let i = 0; i < steps; i++) {
          a += (random() - 0.5) * drift;
          x += Math.cos(a) * seg * (0.7 + random() * 0.6);
          y += Math.sin(a) * seg * (0.7 + random() * 0.6);
          pts.push({ x, y });
        }
        return pts;
      };

      const unit = Math.min(width, height);
      const starts = [
        { x: 0, y: height * (0.12 + random() * 0.12), a: 0.32 },
        { x: 0, y: height * (0.44 + random() * 0.14), a: -0.12 },
        { x: W, y: height * (0.18 + random() * 0.14), a: Math.PI - 0.28 },
        { x: W, y: height * (0.56 + random() * 0.12), a: Math.PI + 0.2 },
        { x: W * (0.2 + random() * 0.2), y: 0, a: Math.PI / 2 + (random() - 0.5) * 0.6 },
        { x: W * (0.58 + random() * 0.24), y: 0, a: Math.PI / 2 + (random() - 0.5) * 0.6 }
      ];

      for (const st of starts) {
        const trunk = line(st.x, st.y, st.a, 8 + Math.floor(random() * 5), unit * 0.09, 0.5);
        const twigs = [];
        const forks = 1 + Math.floor(random() * 2);
        for (let f = 0; f < forks; f++) {
          const at = 2 + Math.floor(random() * (trunk.length - 3));
          const from = trunk[at];
          const prev = trunk[at - 1];
          const base = Math.atan2(from.y - prev.y, from.x - prev.x);
          const dir = random() < 0.5 ? -1 : 1;
          twigs.push(line(from.x, from.y, base + dir * (0.6 + random() * 0.6), 2 + Math.floor(random() * 3), unit * 0.06, 0.7));
        }
        cracks.push({ trunk, twigs, width: 1 + random() * 1.4 });
      }

      // край обрыва: одна рваная линия через весь разворот
      let y = height * (0.74 + random() * 0.06);
      for (let x = -20; x <= W + 20; x += W / 44) {
        y += (random() - 0.5) * height * 0.05;
        y = Math.max(height * 0.66, Math.min(height * 0.86, y));
        tear.push({ x, y });
      }
    };

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
      build();
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', measure);

    const stroke = (pts, w, style) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth = w;
      ctx.strokeStyle = style;
      ctx.stroke();
    };

    const FRAME_STEP = 1000 / 20;
    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;
      if (!width || !height) { frame = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, width, height);
      const breath = 0.5 + Math.sin(now * 0.0009) * 0.5;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // правая половина видит ту же картину, только сдвинутую на свою ширину
      if (side === 'right') ctx.translate(-width, 0);

      for (const c of cracks) {
        // свет, пробивающийся из щели
        ctx.shadowColor = `rgba(226, 196, 244, ${0.3 + breath * 0.22})`;
        ctx.shadowBlur = 10;
        stroke(c.trunk, c.width * 2.2, 'rgba(216, 186, 240, 0.14)');
        ctx.shadowBlur = 0;
        // сама щель
        stroke(c.trunk, c.width, 'rgba(12, 9, 16, 0.82)');
        for (const t of c.twigs) stroke(t, c.width * 0.6, 'rgba(12, 9, 16, 0.66)');
      }

      // за обрывом листа нет ничего
      ctx.beginPath();
      ctx.moveTo(tear[0].x, height + 40);
      for (const p of tear) ctx.lineTo(p.x, p.y);
      ctx.lineTo(tear[tear.length - 1].x, height + 40);
      ctx.closePath();
      const gap = ctx.createLinearGradient(0, height * 0.7, 0, height);
      gap.addColorStop(0, 'rgba(10, 7, 14, 0.94)');
      gap.addColorStop(1, 'rgba(4, 3, 7, 1)');
      ctx.fillStyle = gap;
      ctx.fill();

      // на самом краю бумага светится: разрыв ещё свежий
      ctx.beginPath();
      ctx.moveTo(tear[0].x, tear[0].y);
      for (const p of tear) ctx.lineTo(p.x, p.y);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(230, 208, 246, ${0.24 + breath * 0.2})`;
      ctx.shadowColor = `rgba(214, 176, 244, ${0.3 + breath * 0.25})`;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [seed, side]);

  return <canvas ref={canvasRef} className="broken-sheet" aria-hidden="true" />;
}
