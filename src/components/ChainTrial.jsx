import React, { useEffect, useRef, useState } from 'react';
import './ChainTrial.css';

// Финал Переосмысления. Из глубины поднимаются пять цепей и приковывают книгу.
// Рвать их бесполезно — железо не тянется. У каждой есть одно слабое звено:
// ржавое, с волосяной трещиной. Бить надо по нему. Три удара — и звено
// разлетается, цепь обрывается и уходит вниз. Промах отзывается глухим звоном.

const RISE_TIME = 2000;
const HITS_TO_BREAK = 3;
const LINK_R = 11;

export default function ChainTrial({ active, bookRef, manifest, soundEnabled, onComplete }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const doneRef = useRef(onComplete);
  const soundRef = useRef(soundEnabled);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { doneRef.current = onComplete; }, [onComplete]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null;
    const chains = [];
    const sparks = [];
    const state = { fade: 0, startedAt: performance.now(), broken: 0, finished: false, shakeUntil: 0 };
    const mouse = { x: -999, y: -999 };

    const base = import.meta.env.BASE_URL;
    const encode = (path) => base + path.split('/').map(encodeURIComponent).join('/');
    const makeSfx = (paths, volume) => {
      const list = (paths || []).map((path) => {
        const audio = new Audio(encode(path));
        audio.volume = volume;
        audio.preload = 'auto';
        return audio;
      });
      return () => {
        if (!list.length || !soundRef.current) return;
        try {
          const copy = list[Math.floor(Math.random() * list.length)].cloneNode();
          copy.volume = volume;
          copy.play().catch(() => {});
        } catch (err) { /* тишина */ }
      };
    };

    const sfx = manifest && manifest.sfx ? manifest.sfx : {};
    const playRise = makeSfx(sfx.chainRise, 0.5);
    const playHit = makeSfx(sfx.chainHit, 0.5);
    const playMiss = makeSfx(sfx.chainMiss, 0.4);
    const playSnap = makeSfx(sfx.chainSnap, 0.6);
    const playBloom = makeSfx(sfx.bloom, 0.55);

    const bookBox = () => {
      const host = bookRef && bookRef.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      return r && r.width ? r : null;
    };

    const build = () => {
      chains.length = 0;
      const box = bookBox();
      const left = box ? box.left : width * 0.22;
      const right = box ? box.right : width * 0.78;
      const top = box ? box.top : height * 0.18;
      const bottom = box ? box.bottom : height * 0.86;
      const h = bottom - top;

      // цепи выходят из-за краёв экрана и наискось перехватывают разворот
      const runs = [
        { from: { x: -60, y: bottom + 120 }, to: { x: right + 40, y: top + h * 0.24 } },
        { from: { x: width + 60, y: bottom + 140 }, to: { x: left - 40, y: top + h * 0.36 } },
        { from: { x: -60, y: top - 120 }, to: { x: right + 40, y: bottom - h * 0.18 } },
        { from: { x: width + 60, y: top - 100 }, to: { x: left - 40, y: bottom - h * 0.06 } },
        { from: { x: (left + right) / 2, y: height + 140 }, to: { x: (left + right) / 2, y: top - 60 } }
      ];

      runs.forEach((run, i) => {
        const links = 22 + Math.floor(Math.random() * 6);
        chains.push({
          from: run.from,
          to: run.to,
          links,
          // слабое звено сидит на видном месте, но не с краю
          weak: 5 + Math.floor(Math.random() * (links - 10)),
          hits: 0,
          broken: false,
          brokeAt: 0,
          hitAt: 0,
          phase: i * 1.3,
          sag: 34 + Math.random() * 26
        });
      });
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const kept = chains.map((c) => ({ hits: c.hits, broken: c.broken, brokeAt: c.brokeAt, weak: c.weak }));
      build();
      kept.forEach((k, i) => {
        if (!chains[i]) return;
        chains[i].hits = k.hits;
        chains[i].broken = k.broken;
        chains[i].brokeAt = k.brokeAt;
        chains[i].weak = Math.min(k.weak, chains[i].links - 2);
      });
    };

    // Точка на цепи с учётом провисания и качания
    const linkPoint = (c, i, rise, now) => {
      const t = i / c.links;
      const startY = c.from.y + (1 - rise) * height * 0.6;
      const x0 = c.from.x, y0 = startY;
      const x1 = c.to.x, y1 = c.to.y;
      const swing = Math.sin(now * 0.0009 + c.phase + t * 1.6) * 6 * (1 - Math.abs(0.5 - t) * 1.2);
      return {
        x: x0 + (x1 - x0) * t + swing,
        y: y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * c.sag
      };
    };

    const spawnSparks = (x, y, count, force) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = force * (0.4 + Math.random());
        sparks.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - force * 0.3,
          life: 1,
          decay: 0.02 + Math.random() * 0.03
        });
      }
    };

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    const onDown = (e) => {
      if (!activeRef.current || state.finished) return;
      const now = performance.now();
      const rise = Math.min(1, (now - state.startedAt) / RISE_TIME);
      if (rise < 0.9) return;

      // бьём по слабому звену: только оно поддаётся
      for (const c of chains) {
        if (c.broken) continue;
        const p = linkPoint(c, c.weak, rise, now);
        if (Math.hypot(p.x - e.clientX, p.y - e.clientY) > LINK_R * 2.4) continue;

        c.hits += 1;
        c.hitAt = now;
        state.shakeUntil = now + 220;
        spawnSparks(p.x, p.y, 14, 5);
        playHit();

        if (c.hits >= HITS_TO_BREAK) {
          c.broken = true;
          c.brokeAt = now;
          state.broken += 1;
          spawnSparks(p.x, p.y, 40, 9);
          playSnap();

          if (state.broken >= chains.length && !state.finished) {
            state.finished = true;
            playBloom();
            setTimeout(() => { if (doneRef.current) doneRef.current(); }, 1100);
          }
        }
        return;
      }

      // попал по глухому железу: звон и ничего больше
      for (const c of chains) {
        if (c.broken) continue;
        for (let i = 1; i < c.links; i++) {
          const p = linkPoint(c, i, rise, now);
          if (Math.hypot(p.x - e.clientX, p.y - e.clientY) < LINK_R * 1.8) {
            c.hitAt = now;
            spawnSparks(p.x, p.y, 5, 2.6);
            playMiss();
            return;
          }
        }
      }
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    playRise();

    const drawLink = (p, angle, r, kind, wear, hot) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);

      const rust = kind === 'weak';
      const body = ctx.createLinearGradient(0, -r, 0, r);
      if (rust) {
        body.addColorStop(0, `rgba(${186 + hot * 60}, ${118 + hot * 40}, 74, 1)`);
        body.addColorStop(0.45, `rgba(${138 + hot * 70}, 78, 46, 1)`);
        body.addColorStop(1, 'rgba(84, 46, 30, 1)');
      } else {
        body.addColorStop(0, 'rgba(176, 178, 186, 1)');
        body.addColorStop(0.45, 'rgba(112, 114, 122, 1)');
        body.addColorStop(1, 'rgba(58, 58, 66, 1)');
      }

      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.44;
      ctx.strokeStyle = body;
      ctx.stroke();

      // внутренняя фаска: железо перестаёт быть плоским колечком
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.74, r * 0.38, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.7, r * 0.1);
      ctx.strokeStyle = 'rgba(16, 14, 18, 0.55)';
      ctx.stroke();

      // блик по верхней дуге
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.82, r * 0.44, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineWidth = Math.max(0.7, r * 0.14);
      ctx.strokeStyle = 'rgba(238, 240, 248, 0.4)';
      ctx.stroke();

      // трещины на слабом звене: с каждым ударом их больше
      if (rust && wear > 0) {
        ctx.lineWidth = Math.max(0.8, r * 0.12);
        ctx.strokeStyle = 'rgba(20, 12, 10, 0.9)';
        for (let i = 0; i < wear; i++) {
          const a = -0.6 + i * 0.9;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.36);
          ctx.lineTo(Math.cos(a + 0.5) * r * 1.08, Math.sin(a + 0.5) * r * 0.66);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const drawChain = (c, now, rise, fade) => {
      ctx.save();
      ctx.globalAlpha = fade;

      if (c.broken) {
        const age = (now - c.brokeAt) / 1400;
        if (age > 1) { ctx.restore(); return; }
        ctx.globalAlpha = fade * (1 - age);
        for (let i = 0; i <= c.links; i++) {
          const p = linkPoint(c, i, rise, now);
          // половинки расходятся врозь и падают, набирая ход
          const side = i < c.weak ? -1 : 1;
          const fall = age * age * 420 * (0.35 + Math.abs(i - c.weak) / c.links);
          const slide = side * age * 60;
          drawLink({ x: p.x + slide, y: p.y + fall }, i * 0.7 + age * 3, LINK_R, 'dead', 0, 0);
        }
        ctx.restore();
        return;
      }

      const struck = now - c.hitAt < 220 ? (1 - (now - c.hitAt) / 220) : 0;
      const jolt = struck * 6;

      for (let i = 0; i <= c.links; i++) {
        const p = linkPoint(c, i, rise, now);
        const next = linkPoint(c, Math.min(c.links, i + 1), rise, now);
        const angle = Math.atan2(next.y - p.y, next.x - p.x) + (i % 2 ? Math.PI / 2 : 0);
        const weak = i === c.weak;
        const shake = struck * (weak ? 1 : 0.35);
        drawLink(
          { x: p.x + (Math.random() - 0.5) * jolt * (weak ? 1 : 0.4), y: p.y + (Math.random() - 0.5) * jolt * shake },
          angle,
          weak ? LINK_R * 1.15 : LINK_R,
          weak ? 'weak' : 'iron',
          weak ? c.hits : 0,
          weak ? struck : 0
        );
      }

      // слабое звено само подсказывает себя: тусклый рыжий отсвет
      const wp = linkPoint(c, c.weak, rise, now);
      const near = Math.hypot(wp.x - mouse.x, wp.y - mouse.y) < 60;
      ctx.save();
      ctx.globalAlpha = fade * (0.22 + (near ? 0.3 : 0) + struck * 0.4);
      const glow = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, LINK_R * 3.4);
      glow.addColorStop(0, 'rgba(226, 138, 62, 0.8)');
      glow.addColorStop(1, 'rgba(226, 138, 62, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, LINK_R * 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    const drawSparks = (fade) => {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy;
        s.vy += 0.35;
        s.vx *= 0.98;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = fade * s.life;
        ctx.fillStyle = `rgba(255, ${180 + Math.round(60 * s.life)}, 120, 1)`;
        ctx.fillRect(s.x, s.y, 2.2, 2.2);
      }
      ctx.globalAlpha = 1;
    };

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 40;

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;

      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.04 : -0.04)));
      if (!on && state.fade <= 0) { setAlive(false); return; }

      ctx.clearRect(0, 0, width, height);
      const soft = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      const rise = soft(Math.min(1, (now - state.startedAt) / RISE_TIME));

      const shake = now < state.shakeUntil ? (Math.random() - 0.5) * 4 : 0;
      ctx.save();
      ctx.translate(shake, shake * 0.5);
      for (const c of chains) drawChain(c, now, rise, state.fade);
      drawSparks(state.fade);
      ctx.restore();

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive, manifest]);

  if (!alive) return null;
  return <canvas ref={canvasRef} className="chain-trial" />;
}
