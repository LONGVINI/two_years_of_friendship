import React, { useEffect, useRef } from 'react';
import './PaintingEyes.css';

// Живые глаза поверх самих работ. Оригинал не трогается: слой лежит сверху,
// повторяя те глаза, что она нарисовала. Они следят за курсором, а от щелчка
// уходят в сторону и покидают рисунок — оседая на фоне главы.
//
// Координаты — в долях от размера картинки: x и y от левого верхнего угла,
// r — радиус относительно ширины. Правится здесь, в одном месте.
// tilt — наклон в градусах: положительный опускает правый край, отрицательный
// левый. flat — приплюснутость (высота как доля ширины). exit — как он уходит:
// 'split' раздваивает зрачок, 'up' и 'right' уводят взгляд в сторону.
export const EYE_MAPS = {
  'Осколки подсознания': [
    { x: 0.545, y: 0.170, r: 0.082, tilt: 13, flat: 0.52, exit: 'split' },
    { x: 0.262, y: 0.300, r: 0.090, tilt: 15, flat: 0.70, exit: 'up' },
    { x: 0.678, y: 0.322, r: 0.074, tilt: -21, flat: 0.50, exit: 'right' }
  ],
  'Лунное спокойствие': [
    { x: 0.398, y: 0.372, r: 0.076, tilt: 3, flat: 0.46, blank: true, exit: 'up' },
    { x: 0.552, y: 0.372, r: 0.076, tilt: -3, flat: 0.46, blank: true, exit: 'up' }
  ],
  'Третий взор': [
    { x: 0.415, y: 0.318, r: 0.045, tilt: 2, exit: 'right' },
    { x: 0.585, y: 0.318, r: 0.045, tilt: -2, exit: 'split' },
    { x: 0.500, y: 0.232, r: 0.040, tilt: 0, third: true, exit: 'up' }
  ]
};

const RAD = Math.PI / 180;

export default function PaintingEyes({ title, onEscape }) {
  const canvasRef = useRef(null);
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  const map = EYE_MAPS[title];

  useEffect(() => {
    if (!map) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    const eyes = map.map((spec) => ({
      ...spec,
      look: { x: 0, y: 0 },
      blink: 0,
      blinkAt: performance.now() + 1200 + Math.random() * 5000,
      closing: 0,
      alive: true
    }));

    const mouse = { x: -999, y: -999, still: 0, lastMove: performance.now() };
    let width = 0, height = 0, frame = null;

    const measure = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = r.width; height = r.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.lastMove = performance.now();
    };

    const onDown = (e) => {
      const r = host.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      for (const eye of eyes) {
        if (!eye.alive || eye.closing) continue;
        const ex = eye.x * width, ey = eye.y * height;
        const rr = eye.r * width;
        if (Math.hypot(ex - mx, ey - my) < rr * 1.35) {
          // ловим событие на подходе, иначе книга примет щелчок за перелистывание
          e.stopPropagation();
          if (e.preventDefault) e.preventDefault();
          eye.closing = 0.001;                 // начал закрываться, каждый по-своему
          if (escapeRef.current) escapeRef.current();
          return;
        }
      }
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, true);

    const draw = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, width, height);
      const idle = now - mouse.lastMove;
      const wantStill = idle > 620 ? 1 : 0;
      mouse.still += (wantStill - mouse.still) * (wantStill ? 0.05 : 0.2);

      for (const eye of eyes) {
        if (!eye.alive) continue;

        const ex = eye.x * width, ey = eye.y * height;
        const rr = eye.r * width;
        const ry = rr * (eye.flat || 0.58);      // глаз шире, чем выше

        // Уход: сперва взгляд идёт своей дорогой, потом веко смыкается.
        // Глаз остаётся на месте — с рисунка он не улетает.
        let closeLid = 1, closeFade = 1;
        if (eye.closing) {
          // раздвоение идёт медленно: зрачку надо дать разойтись и сойтись
          const speed = eye.exit === 'split' ? 0.0042 : 0.008;
          eye.closing = Math.min(1, eye.closing + speed);
          const t = eye.closing;
          eye.exitGaze = Math.min(1, t / 0.68);
          const lidPhase = Math.max(0, (t - 0.72) / 0.22);
          closeLid = 1 - Math.min(1, lidPhase);
          closeFade = 1 - Math.max(0, (t - 0.94) / 0.06);
          if (t >= 1) { eye.alive = false; continue; }
        }

        let tx, ty;
        if (eye.closing) {
          const g = eye.exitGaze || 0;
          if (eye.exit === 'up') { tx = 0; ty = -ry * 0.55 * g; }
          else if (eye.exit === 'right') { tx = rr * 0.42 * g; ty = 0; }
          else { tx = 0; ty = 0; }
        } else if (mouse.still > 0.5) { tx = 0; ty = 0; }
        else {
          const dx = mouse.x - ex, dy = mouse.y - ey;
          const d = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, d / 240);
          tx = (dx / d) * rr * 0.22 * reach;
          ty = (dy / d) * ry * 0.18 * reach;
        }
        eye.look.x += (tx - eye.look.x) * (eye.closing ? 0.07 : 0.12);
        eye.look.y += (ty - eye.look.y) * (eye.closing ? 0.07 : 0.12);

        if (!eye.closing && now > eye.blinkAt) {
          eye.blink = 1; eye.blinkAt = now + 2600 + Math.random() * 6000;
        }
        eye.blink = Math.max(0, eye.blink - 0.07);
        const lid = (1 - Math.sin(eye.blink * Math.PI) * 0.92) * closeLid;

        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate((eye.tilt || 0) * RAD);
        ctx.globalAlpha = closeFade;

        // Контур глаза: два симметричных века навстречу друг другу
        const lidPath = (kx, ky) => {
          ctx.beginPath();
          ctx.moveTo(-rr * kx, 0);
          ctx.bezierCurveTo(-rr * kx * 0.45, -ry * ky, rr * kx * 0.45, -ry * ky, rr * kx, 0);
          ctx.bezierCurveTo(rr * kx * 0.5, ry * ky * 0.86, -rr * kx * 0.5, ry * ky * 0.86, -rr * kx, 0);
          ctx.closePath();
        };

        // Подложка чуть больше самого глаза: она перекрывает то, что нарисовано
        lidPath(1.16, 1.22);
        ctx.fillStyle = 'rgba(228, 223, 214, 0.97)';
        ctx.fill();

        lidPath(1, Math.max(0.02, lid));
        const sclera = ctx.createLinearGradient(0, -ry, 0, ry);
        sclera.addColorStop(0, 'rgba(186, 176, 170, 1)');
        sclera.addColorStop(0.4, 'rgba(232, 226, 218, 1)');
        sclera.addColorStop(1, 'rgba(206, 190, 184, 1)');
        ctx.fillStyle = sclera;
        ctx.fill();

        // сосуды: тонкие красные нити от углов к середине
        if (lid > 0.3) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(150, 42, 36, 0.3)';
          ctx.lineWidth = Math.max(0.5, rr * 0.013);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(side * rr * 0.94, 0);
            ctx.quadraticCurveTo(side * rr * 0.6, -ry * 0.3, side * rr * 0.3, -ry * 0.05);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(side * rr * 0.9, ry * 0.1);
            ctx.quadraticCurveTo(side * rr * 0.62, ry * 0.42, side * rr * 0.34, ry * 0.3);
            ctx.stroke();
          }
          ctx.restore();
        }

        if (lid > 0.16) {
          // путь строим заново: сосуды выше сбили текущий контур
          lidPath(1, Math.max(0.02, lid));
          ctx.save();
          ctx.clip();
          const px = eye.look.x, py = eye.look.y;
          const irisR = Math.min(ry * 0.95, rr * 0.42);

          // Раздвоение зрачка: радужка расползается надвое и снова сходится
          const split = eye.closing && eye.exit === 'split'
            ? Math.sin(Math.min(1, (eye.exitGaze || 0)) * Math.PI) * irisR * 0.75
            : 0;

          for (const side of (split > 0.5 ? [-1, 1] : [0])) {
            const ox = px + side * split;
            ctx.beginPath();
            ctx.arc(ox, py, irisR, 0, Math.PI * 2);
            ctx.fillStyle = eye.third ? 'rgba(228, 214, 178, 0.98)' : 'rgba(62, 46, 38, 0.96)';
            ctx.fill();
            ctx.lineWidth = Math.max(0.7, rr * 0.035);
            ctx.strokeStyle = 'rgba(22, 16, 14, 0.75)';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(ox, py, irisR * 0.48 * (1 + mouse.still * 0.28), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(10, 7, 7, 0.98)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ox - irisR * 0.34, py - irisR * 0.38, irisR * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fill();
          }
          ctx.restore();
        }

        // Веки поверх всего: карандашная линия, сверху жирнее
        lidPath(1, Math.max(0.02, lid));
        ctx.lineWidth = Math.max(0.9, rr * 0.055);
        ctx.strokeStyle = 'rgba(26, 20, 18, 0.82)';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-rr, 0);
        ctx.bezierCurveTo(-rr * 0.45, -ry * 1.06 * lid, rr * 0.45, -ry * 1.06 * lid, rr, 0);
        ctx.lineWidth = Math.max(1.1, rr * 0.085);
        ctx.strokeStyle = 'rgba(18, 14, 12, 0.7)';
        ctx.stroke();

        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map, title]);

  if (!map) return null;
  return <canvas ref={canvasRef} className="painting-eyes" />;
}
