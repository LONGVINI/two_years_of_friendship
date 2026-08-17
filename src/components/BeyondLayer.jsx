import React, { useEffect, useRef } from 'react';
import './BeyondLayer.css';

// За гранью нет ни звёзд, ни сада: там то, что ещё не нарисовано. По полю
// плывёт светлая пыль, сверху падают широкие мягкие столбы света, а по фону
// сами собой прочерчиваются незаконченные наброски — линия ведётся, замирает
// и тает, не дождавшись руки. Нажатие роняет туда вспышку, и от неё расходится
// круг, а рядом проступает ещё один штрих.

const FRAME_STEP = 1000 / 30;
const MOTE_COUNT = 70;
const STROKE_LIMIT = 7;

export default function BeyondLayer({ active, soundEnabled }) {
  const canvasRef = useRef(null);
  const soundRef = useRef(soundEnabled);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null, lastFrame = 0;
    const motes = [];
    const strokes = [];
    const rings = [];
    const beams = [];
    let nextStrokeAt = performance.now() + 1200;

    let audio = null;
    const tone = (freq, len, level) => {
      if (!soundRef.current) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audio) audio = new Ctx();
        if (audio.state === 'suspended') audio.resume();
        const now = audio.currentTime;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(level, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(now);
        osc.stop(now + len + 0.05);
      } catch (err) { /* тишина */ }
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      motes.length = 0;
      for (let i = 0; i < MOTE_COUNT; i++) {
        motes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.5 + Math.random() * 1.7,
          drift: 0.06 + Math.random() * 0.22,
          sway: Math.random() * Math.PI * 2,
          swaySpeed: 0.0004 + Math.random() * 0.0009,
          glow: 0.25 + Math.random() * 0.5
        });
      }

      // столбы света стоят по краям, чтобы не спорить с книгой
      beams.length = 0;
      for (let i = 0; i < 4; i++) {
        const side = i < 2 ? 0 : 1;
        beams.push({
          x: side === 0 ? width * (0.04 + Math.random() * 0.16) : width * (0.8 + Math.random() * 0.16),
          w: width * (0.05 + Math.random() * 0.07),
          tilt: (Math.random() - 0.5) * 0.22,
          phase: Math.random() * Math.PI * 2,
          speed: 0.00018 + Math.random() * 0.00022
        });
      }
    };

    // Незаконченный набросок: несколько связанных дуг, ведомых одной рукой
    const makeStroke = (ox, oy) => {
      if (strokes.length >= STROKE_LIMIT) strokes.shift();
      const side = Math.random() < 0.5 ? 0 : 1;
      const x = ox !== undefined ? ox
        : (side === 0 ? width * (0.03 + Math.random() * 0.2) : width * (0.77 + Math.random() * 0.2));
      const y = oy !== undefined ? oy : height * (0.12 + Math.random() * 0.76);
      const scale = Math.min(width, height) * (0.06 + Math.random() * 0.09);
      const parts = 2 + Math.floor(Math.random() * 3);
      const pts = [{ x: 0, y: 0 }];
      let a = Math.random() * Math.PI * 2;
      for (let i = 0; i < parts; i++) {
        a += (Math.random() - 0.5) * 1.9;
        const len = scale * (0.5 + Math.random() * 0.9);
        const prev = pts[pts.length - 1];
        pts.push({
          cx: prev.x + Math.cos(a - 0.5) * len * 0.6,
          cy: prev.y + Math.sin(a - 0.5) * len * 0.6,
          x: prev.x + Math.cos(a) * len,
          y: prev.y + Math.sin(a) * len
        });
      }
      strokes.push({
        x, y, pts,
        born: performance.now(),
        draw: 1600 + Math.random() * 1400,
        hold: 1800 + Math.random() * 2200,
        fade: 2600 + Math.random() * 1600,
        width: 1 + Math.random() * 1.2
      });
    };

    measure();
    window.addEventListener('resize', measure);

    const onTap = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const el = e.target;
      // по книге и по кнопкам не бьём: там своя жизнь
      if (el && el.closest && el.closest('.book-wrapper, .book, button, .bookmark, .control-panel')) return;
      rings.push({ x: e.clientX, y: e.clientY, born: performance.now(), life: 2100 });
      makeStroke(e.clientX + (Math.random() - 0.5) * 90, e.clientY + (Math.random() - 0.5) * 90);
      tone(320 + Math.random() * 260, 0.7, 0.03);
    };
    window.addEventListener('pointerdown', onTap);

    const drawBeam = (b, now) => {
      const shift = Math.sin(now * b.speed + b.phase) * width * 0.02;
      const x = b.x + shift;
      ctx.save();
      ctx.translate(x, 0);
      ctx.transform(1, 0, b.tilt, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, height);
      const power = 0.05 + (Math.sin(now * b.speed * 1.7 + b.phase) * 0.5 + 0.5) * 0.05;
      g.addColorStop(0, `rgba(238, 226, 246, ${power})`);
      g.addColorStop(0.55, `rgba(226, 210, 240, ${power * 0.45})`);
      g.addColorStop(1, 'rgba(220, 204, 236, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-b.w / 2, 0, b.w, height);
      ctx.restore();
    };

    const drawStroke = (s, now) => {
      const age = now - s.born;
      const drawn = Math.min(1, age / s.draw);
      let alpha = 0.5;
      if (age > s.draw + s.hold) {
        alpha = 0.5 * Math.max(0, 1 - (age - s.draw - s.hold) / s.fade);
      }
      if (alpha <= 0.002) return false;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(236, 226, 246, ${alpha})`;
      ctx.lineWidth = s.width;
      ctx.shadowColor = `rgba(210, 180, 240, ${alpha * 0.7})`;
      ctx.shadowBlur = 8;

      const total = s.pts.length - 1;
      const upTo = total * drawn;
      const whole = Math.floor(upTo);
      const rest = upTo - whole;
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i <= Math.min(total, whole + 1); i++) {
        const p = s.pts[i];
        const prev = s.pts[i - 1];
        if (i === whole + 1 && rest < 1) {
          // последний кусок дорисовывается на глазах
          const mx = prev.x + (p.x - prev.x) * rest;
          const my = prev.y + (p.y - prev.y) * rest;
          const cx = prev.x + (p.cx - prev.x) * rest;
          const cy = prev.y + (p.cy - prev.y) * rest;
          ctx.quadraticCurveTo(cx, cy, mx, my);
        } else {
          ctx.quadraticCurveTo(p.cx, p.cy, p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.restore();
      return age < s.draw + s.hold + s.fade;
    };

    const drawRing = (r, now) => {
      const t = (now - r.born) / r.life;
      if (t >= 1) return false;
      const ease = 1 - Math.pow(1 - t, 3);
      const rad = 12 + ease * Math.min(width, height) * 0.22;
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(240, 228, 250, ${(1 - t) * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = `rgba(214, 176, 244, ${(1 - t) * 0.5})`;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
      return true;
    };

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);
      for (const b of beams) drawBeam(b, now);

      for (const m of motes) {
        m.y -= m.drift;
        m.sway += m.swaySpeed * 16;
        const x = m.x + Math.sin(m.sway) * 14;
        if (m.y < -10) { m.y = height + 10; m.x = Math.random() * width; }
        const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * 4);
        g.addColorStop(0, `rgba(244, 236, 252, ${m.glow})`);
        g.addColorStop(1, 'rgba(226, 210, 244, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now > nextStrokeAt) {
        makeStroke();
        nextStrokeAt = now + 2600 + Math.random() * 3400;
      }
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (!drawStroke(strokes[i], now)) strokes.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        if (!drawRing(rings[i], now)) rings.splice(i, 1);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointerdown', onTap);
      if (frame) cancelAnimationFrame(frame);
      if (audio && audio.close) audio.close();
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="beyond-layer" aria-hidden="true" />;
}
