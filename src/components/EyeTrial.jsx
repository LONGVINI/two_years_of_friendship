import React, { useEffect, useRef, useState } from 'react';
import './EyeTrial.css';

// Финал Ренессанса. Последняя работа главы — «Звездная жрица», фигура без лица.
// Разворот затягивает тьмой, собранные за главу глаза встают кольцом, а за
// курсором тянется чернильный след. Нужно начертить глаз: замкнуть контур и
// поставить внутри зрачок. Промах отбрасывает к маяку главы.

const RING_EYES = 14;

// Насколько щедро принимаем контур: рисуют мышью, а не пером
const MIN_SPAN = 0.16;      // доля ширины поля
const MAX_GAP = 0.28;       // разрыв между началом и концом от длины пути
const MIN_RATIO = 1.25;     // вытянутость: глаз шире, чем выше
const MAX_RATIO = 6.0;

function analyseStroke(points) {
  if (points.length < 8) return { ok: false, reason: 'коротко' };

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (length < 40) return { ok: false, reason: 'коротко' };

  const first = points[0], last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  if (gap > length * MAX_GAP) return { ok: false, reason: 'не замкнуто' };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    cx += p.x; cy += p.y;
  }
  cx /= points.length; cy /= points.length;

  // главные оси облака точек: так вытянутость считается независимо от наклона
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - cx, dy = p.y - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  sxx /= points.length; syy /= points.length; sxy /= points.length;
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.max(0, tr * tr / 4 - det);
  const major = Math.sqrt(Math.max(1e-6, tr / 2 + Math.sqrt(disc)));
  const minor = Math.sqrt(Math.max(1e-6, tr / 2 - Math.sqrt(disc)));
  const ratio = major / Math.max(1e-6, minor);

  return {
    ok: true, ratio,
    span: Math.max(maxX - minX, maxY - minY),
    center: { x: cx, y: cy },
    box: { minX, maxX, minY, maxY }
  };
}

function pointInside(box, p) {
  return p.x > box.minX && p.x < box.maxX && p.y > box.minY && p.y < box.maxY;
}

export default function EyeTrial({ active, bookRef, onComplete, onMiss }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const doneRef = useRef(onComplete);
  const missRef = useRef(onMiss);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { doneRef.current = onComplete; }, [onComplete]);
  useEffect(() => { missRef.current = onMiss; }, [onMiss]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const state = {
      fade: 0,
      trail: [],          // тающий след за курсором
      stroke: null,       // текущая линия
      contour: null,      // принятый контур, ждущий зрачка
      ring: [],
      wonAt: 0,
      shakeUntil: 0
    };
    const mouse = { x: -999, y: -999, down: false };
    let width = 0, height = 0, frame = null, field = null;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readField();
    };

    // Поле для черчения — левая страница разворота, там, где висит работа
    const readField = () => {
      const host = bookRef && bookRef.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      field = r && r.width
        ? { x: r.left, y: r.top, w: r.width / 2, h: r.height }
        : { x: width * 0.1, y: height * 0.12, w: width * 0.4, h: height * 0.76 };

      state.ring = [];
      const cx = field.x + field.w / 2, cy = field.y + field.h / 2;
      const rx = field.w * 0.4, ry = field.h * 0.38;
      for (let i = 0; i < RING_EYES; i++) {
        const a = (i / RING_EYES) * Math.PI * 2 - Math.PI / 2;
        state.ring.push({
          x: cx + Math.cos(a) * rx,
          y: cy + Math.sin(a) * ry,
          r: 11 + Math.random() * 7,
          tilt: a + Math.PI / 2,
          blink: 0,
          blinkAt: performance.now() + 1500 + Math.random() * 5000
        });
      }
      state.center = { x: cx, y: cy };
    };

    const inField = (x, y) =>
      field && x > field.x && x < field.x + field.w && y > field.y && y < field.y + field.h;

    const onMove = (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!activeRef.current || state.wonAt) return;
      state.trail.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (state.trail.length > 220) state.trail.shift();
      if (mouse.down && state.stroke) state.stroke.push({ x: e.clientX, y: e.clientY });
    };

    const fail = () => {
      state.shakeUntil = performance.now() + 500;
      state.contour = null;
      state.stroke = null;
      for (const eye of state.ring) eye.blink = 1;
      if (missRef.current) missRef.current();
    };

    const onDown = (e) => {
      if (!activeRef.current || state.wonAt) return;
      if (!inField(e.clientX, e.clientY)) return;

      // контур уже принят — этот щелчок ставит зрачок
      if (state.contour) {
        if (pointInside(state.contour.box, { x: e.clientX, y: e.clientY })) {
          state.wonAt = performance.now();
          state.pupil = { x: e.clientX, y: e.clientY };
        } else {
          fail();
        }
        return;
      }
      mouse.down = true;
      state.stroke = [{ x: e.clientX, y: e.clientY }];
    };

    const onUp = () => {
      if (!mouse.down || !state.stroke) { mouse.down = false; return; }
      mouse.down = false;
      const points = state.stroke;
      state.stroke = null;

      const res = analyseStroke(points);
      const wide = res.ok && res.span > field.w * MIN_SPAN;
      const shaped = res.ok && res.ratio > MIN_RATIO && res.ratio < MAX_RATIO;
      if (wide && shaped) {
        state.contour = { points, box: res.box, center: res.center, acceptedAt: performance.now() };
      } else {
        fail();
      }
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    const draw = () => {
      const now = performance.now();
      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.012 : -0.02)));
      if (!on && state.fade <= 0) { setAlive(false); return; }
      const fade = state.fade;
      readField();

      ctx.clearRect(0, 0, width, height);

      const shake = now < state.shakeUntil ? (Math.random() - 0.5) * 6 : 0;
      ctx.save();
      ctx.translate(shake, 0);

      // тьма поверх работы
      ctx.fillStyle = `rgba(6, 7, 12, ${0.93 * fade})`;
      ctx.fillRect(field.x, field.y, field.w, field.h);

      // кольцо глаз, смотрящих в середину
      for (const eye of state.ring) {
        if (now > eye.blinkAt) { eye.blink = 1; eye.blinkAt = now + 3000 + Math.random() * 6000; }
        eye.blink = Math.max(0, eye.blink - 0.06);
        const lid = 1 - Math.sin(eye.blink * Math.PI) * 0.9;
        const dx = state.center.x - eye.x, dy = state.center.y - eye.y;
        const d = Math.hypot(dx, dy) || 1;

        ctx.save();
        ctx.translate(eye.x, eye.y);
        ctx.rotate(eye.tilt);
        ctx.globalAlpha = fade * 0.8;
        ctx.beginPath();
        ctx.moveTo(-eye.r, 0);
        ctx.quadraticCurveTo(0, -eye.r * 0.8 * lid, eye.r, 0);
        ctx.quadraticCurveTo(0, eye.r * 0.8 * lid, -eye.r, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(226, 220, 208, 0.72)';
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = 'rgba(20, 14, 12, 0.8)';
        ctx.stroke();
        if (lid > 0.3) {
          ctx.save();
          ctx.clip();
          ctx.rotate(-eye.tilt);
          const px = (dx / d) * eye.r * 0.34, py = (dy / d) * eye.r * 0.34;
          ctx.beginPath();
          ctx.arc(px, py, eye.r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(70, 44, 30, 0.95)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, eye.r * 0.19, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(10, 7, 7, 0.98)';
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      // след за курсором: чернила, которые тают
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = state.trail.length - 1; i > 0; i--) {
        const a = state.trail[i], b = state.trail[i - 1];
        a.life -= 0.012;
        if (a.life <= 0) { state.trail.splice(i, 1); continue; }
        ctx.globalAlpha = a.life * 0.5 * fade;
        ctx.strokeStyle = 'rgba(214, 226, 255, 0.9)';
        ctx.lineWidth = 1.6 + a.life * 2.2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();

      const drawPath = (points, alpha, wide) => {
        ctx.save();
        ctx.globalAlpha = alpha * fade;
        ctx.strokeStyle = 'rgba(240, 236, 226, 0.95)';
        ctx.shadowColor = 'rgba(180, 210, 255, 0.55)';
        ctx.shadowBlur = 14;
        ctx.lineWidth = wide;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();
      };

      if (state.stroke && state.stroke.length > 1) drawPath(state.stroke, 0.9, 2.4);

      if (state.contour) {
        const age = now - state.contour.acceptedAt;
        const pulse = 0.7 + 0.3 * Math.sin(age * 0.006);
        drawPath(state.contour.points, pulse, 3);
      }

      if (state.wonAt && state.pupil) {
        const age = now - state.wonAt;
        const grow = Math.min(1, age / 500);
        const c = state.contour ? state.contour.center : state.pupil;
        const rx = state.contour ? (state.contour.box.maxX - state.contour.box.minX) / 2 : 40;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(state.pupil.x, state.pupil.y, rx * 0.34 * grow, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12, 9, 9, 0.96)';
        ctx.shadowColor = 'rgba(255, 240, 210, 0.9)';
        ctx.shadowBlur = 30 * grow;
        ctx.fill();
        ctx.restore();

        const flash = Math.max(0, 1 - age / 900);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 248, 232, ${flash * 0.3})`;
          ctx.fillRect(0, 0, width, height);
        }
        if (age > 1200) {
          const done = doneRef.current;
          state.wonAt = 0;
          if (done) done();
        }
      }

      ctx.restore();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive, bookRef]);

  if (!alive) return null;
  return <canvas ref={canvasRef} className="eye-trial" />;
}
