import React, { useEffect, useRef } from 'react';
import './CornerFingers.css';

// В Ренессансе работу держит не скотч. Из-за краёв листа выступают тонкие
// серые пальцы: сами они снаружи работы, на бумагу заходят только кончики с
// впившимися ногтями. Пальцы едва заметно дрожат, а изредка один из них
// перехватывает хватку — приподнимает кончик и снова придавливает лист.
// Холст поэтому шире самой работы: она лежит в его середине, с полем вокруг.

const CORNERS = [
  { slot: 'tl', ox: 0, oy: 0, dx: 0.7071, dy: 0.7071 },
  { slot: 'tr', ox: 1, oy: 0, dx: -0.7071, dy: 0.7071 },
  { slot: 'br', ox: 1, oy: 1, dx: -0.7071, dy: -0.7071 },
  { slot: 'bl', ox: 0, oy: 1, dx: 0.7071, dy: -0.7071 }
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

export default function CornerFingers({ seed }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    const random = makeRandom(seed);
    let width = 0, height = 0, pad = 0, artW = 0, artH = 0, frame = null;
    const hands = [];

    const build = () => {
      hands.length = 0;
      const unit = Math.min(artW, artH);
      const now = performance.now();

      for (const corner of CORNERS) {
        // сколько пальцев вылезло из-под этого угла
        const count = random() < 0.42 ? 3 : 2;
        // ось, вдоль которой пальцы уходят внутрь работы
        const base = Math.atan2(corner.dy, corner.dx);

        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * (0.42 + random() * 0.12);
          const angle = base + spread;
          // основание уходит наружу, за край работы: на бумагу ложится только кончик
          const back = unit * (0.06 + random() * 0.03);
          const cornerX = pad + corner.ox * artW;
          const cornerY = pad + corner.oy * artH;
          const px = cornerX - Math.cos(angle) * back;
          const py = cornerY - Math.sin(angle) * back;

          hands.push({
            x: px,
            y: py,
            angle,
            len: unit * (0.17 + random() * 0.05),
            thick: unit * (0.028 + random() * 0.01),
            // сгиб фаланг: чем больше, тем сильнее палец скрючен над бумагой
            bend: 0.24 + random() * 0.26,
            tone: 168 + Math.round(random() * 26),
            phase: random() * Math.PI * 2,
            tremor: 0.5 + random() * 0.8,
            grip: 1,
            regripAt: now + 4000 + random() * 12000,
            regrip: 0
          });
        }
      }
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      artW = host.offsetWidth || host.clientWidth;
      artH = host.offsetHeight || host.clientHeight;
      if (!artW || !artH) return;
      // поле вокруг работы, где живут сами кисти
      pad = Math.round(Math.min(artW, artH) * 0.22);
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

    // Ломаная из трёх фаланг: чем ближе к кончику, тем сильнее загиб вниз
    const joints = (f, lift) => {
      const seg = f.len / 3;
      const pts = [{ x: f.x, y: f.y }];
      let a = f.angle;
      for (let i = 0; i < 3; i++) {
        a += f.bend * (0.5 + i * 0.4) * (1 - lift * 0.75);
        const prev = pts[pts.length - 1];
        pts.push({ x: prev.x + Math.cos(a) * seg, y: prev.y + Math.sin(a) * seg });
      }
      return { pts, tipAngle: a };
    };

    const drawPalm = (corner) => {
      const cx = pad + corner.ox * artW;
      const cy = pad + corner.oy * artH;
      const unit = Math.min(artW, artH);
      const a = Math.atan2(corner.dy, corner.dx);
      const px = cx - Math.cos(a) * unit * 0.13;
      const py = cy - Math.sin(a) * unit * 0.13;
      const r = unit * 0.11;

      ctx.save();
      const mass = ctx.createRadialGradient(px, py, r * 0.2, px, py, r);
      mass.addColorStop(0, 'rgba(96, 90, 86, 0.85)');
      mass.addColorStop(0.6, 'rgba(52, 47, 45, 0.6)');
      mass.addColorStop(1, 'rgba(20, 17, 16, 0)');
      ctx.fillStyle = mass;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawFinger = (f, now) => {
      // перехват: кончик медленно отрывается от бумаги и снова придавливает лист
      if (now > f.regripAt) {
        f.regrip = Math.min(1, f.regrip + 0.012);
        if (f.regrip >= 1) {
          f.regrip = 0;
          f.regripAt = now + 7000 + Math.random() * 11000;
        }
      }
      const lift = Math.sin(f.regrip * Math.PI);
      const shake = Math.sin(now * 0.0016 + f.phase) * f.tremor;
      const { pts, tipAngle } = joints(f, lift);

      ctx.save();
      ctx.translate(shake * 0.6, shake * 0.4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // тень на бумаге: при отрыве кончика она отходит и мягчает
      ctx.save();
      ctx.globalAlpha = 0.42 - lift * 0.16;
      ctx.strokeStyle = 'rgba(14, 11, 10, 1)';
      ctx.shadowColor = 'rgba(10, 8, 8, 0.7)';
      ctx.shadowBlur = f.thick * (0.5 + lift * 1.6);
      ctx.shadowOffsetX = f.thick * (0.18 + lift * 0.5);
      ctx.shadowOffsetY = f.thick * (0.3 + lift * 0.7);
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.lineWidth = f.thick * (1 - i * 0.12);
        ctx.stroke();
      }
      ctx.restore();

      // тело пальца: холодная серая кожа, к кончику темнее
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const skin = ctx.createLinearGradient(
          a.x - Math.sin(f.angle) * f.thick, a.y + Math.cos(f.angle) * f.thick,
          a.x + Math.sin(f.angle) * f.thick, a.y - Math.cos(f.angle) * f.thick
        );
        const tone = f.tone - i * 9;
        skin.addColorStop(0, `rgb(${tone - 46}, ${tone - 50}, ${tone - 48})`);
        skin.addColorStop(0.45, `rgb(${tone}, ${tone - 6}, ${tone - 12})`);
        skin.addColorStop(1, `rgb(${tone - 58}, ${tone - 62}, ${tone - 60})`);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = f.thick * (1 - i * 0.13);
        ctx.strokeStyle = skin;
        ctx.stroke();
      }

      // складки на суставах
      ctx.strokeStyle = 'rgba(58, 48, 44, 0.5)';
      ctx.lineWidth = Math.max(0.6, f.thick * 0.07);
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        const a = Math.atan2(pts[i + 1].y - p.y, pts[i + 1].x - p.x);
        const half = f.thick * 0.42;
        for (const off of [-half * 0.35, half * 0.2]) {
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a + Math.PI / 2) * half + Math.cos(a) * off,
                     p.y + Math.sin(a + Math.PI / 2) * half + Math.sin(a) * off);
          ctx.quadraticCurveTo(
            p.x + Math.cos(a) * (off + f.thick * 0.1),
            p.y + Math.sin(a) * (off + f.thick * 0.1),
            p.x + Math.cos(a - Math.PI / 2) * half + Math.cos(a) * off,
            p.y + Math.sin(a - Math.PI / 2) * half + Math.sin(a) * off
          );
          ctx.stroke();
        }
      }

      // ноготь: вдавлен в бумагу, вокруг него кожа собралась и побелела
      const tip = pts[pts.length - 1];
      const nx = tip.x - Math.cos(tipAngle) * f.thick * 0.28;
      const ny = tip.y - Math.sin(tipAngle) * f.thick * 0.28;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(tipAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, f.thick * 0.42, f.thick * 0.3, 0, 0, Math.PI * 2);
      const nail = ctx.createLinearGradient(0, -f.thick * 0.3, 0, f.thick * 0.3);
      nail.addColorStop(0, 'rgba(226, 220, 210, 0.96)');
      nail.addColorStop(0.5, 'rgba(198, 190, 180, 0.96)');
      nail.addColorStop(1, 'rgba(158, 150, 142, 0.96)');
      ctx.fillStyle = nail;
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, f.thick * 0.06);
      ctx.strokeStyle = 'rgba(48, 40, 36, 0.65)';
      ctx.stroke();
      ctx.restore();

      // бумага у самого ногтя вминается: тонкая тень-полумесяц
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, f.thick * 0.5, tipAngle - 1.1, tipAngle + 1.1);
      ctx.lineWidth = Math.max(0.7, f.thick * 0.1);
      ctx.strokeStyle = `rgba(24, 18, 16, ${0.4 - lift * 0.2})`;
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

      ctx.clearRect(0, 0, width, height);
      if (width && height) {
        for (const corner of CORNERS) drawPalm(corner);
        for (const finger of hands) drawFinger(finger, now);
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

  return <canvas ref={canvasRef} className="corner-fingers" aria-hidden="true" />;
}
