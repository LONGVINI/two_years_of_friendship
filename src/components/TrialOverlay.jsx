import React, { useEffect, useRef } from 'react';
import './TrialOverlay.css';

// The trial happens on top of everything: the galaxy lies across the open spread,
// the hole replaces the cursor and eats the stars you steer it into.
export default function TrialOverlay({ active, armed, bookRef, onComplete, primaryRgb }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ stars: null, hole: null, rot: 0, wonAt: 0, sprite: null });
  const onCompleteRef = useRef(onComplete);
  const armedRef = useRef(armed);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  useEffect(() => {
    if (!active) {
      stateRef.current = { stars: null, hole: null, rot: 0, wonAt: 0, sprite: stateRef.current.sprite };
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let frame = null;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.stars = null;
    };

    // The galaxy is laid out inside the open spread, so it sits on the pages
    const buildGalaxy = () => {
      const rect = bookRef && bookRef.current
        ? bookRef.current.getBoundingClientRect()
        : { left: width * 0.2, top: height * 0.2, width: width * 0.6, height: height * 0.6 };
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const reach = Math.min(rect.width, rect.height * 1.5) * 0.42;
      const stars = [];
      const arms = 3;
      const count = 130;
      // Real star colours: hot blue-white through to cool amber
      const palette = [
        '190, 214, 255',
        '226, 236, 255',
        '255, 255, 255',
        '255, 236, 196',
        '255, 206, 160',
        '214, 190, 255'
      ];
      for (let i = 0; i < count; i++) {
        const arm = (i % arms) * ((Math.PI * 2) / arms);
        const t = 0.18 + (i / count) * 2.0;
        const scatter = (Math.random() - 0.5) * 0.34;
        const radius = reach * (0.16 + t * 0.44) * (1 + (Math.random() - 0.5) * 0.16);
        const angle = arm + t * 2.4 + scatter;
        stars.push({
          a: angle,
          r: radius,
          size: 1.4 + Math.random() * 2.6,
          tint: palette[Math.floor(Math.random() * palette.length)],
          alpha: 0,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.58
        });
      }
      state.stars = stars;
      state.cx = cx;
      state.cy = cy;
      state.rot = 0;
      state.wonAt = 0;
    };

    const handleMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleDown = () => {};

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerdown', handleDown);

    const draw = () => {
      const now = performance.now();
      if (!state.stars) buildGalaxy();
      ctx.clearRect(0, 0, width, height);

      const stars = state.stars;
      state.rot += 0.0014;

      // The cursor turns into the hole the instant the darkness submits
      if (armedRef.current && !state.hole) {
        state.hole = { x: mouse.x, y: mouse.y, r: 18, spin: 0, born: now };
      }
      if (!armedRef.current && state.hole && !state.wonAt) {
        state.hole = null;
      }

      if (state.hole) {
        state.hole.x += (mouse.x - state.hole.x) * 0.55;
        state.hole.y += (mouse.y - state.hole.y) * 0.55;
        state.hole.spin += 0.09;
      }

      // Faint core so the galaxy reads as one object over the paper
      if (stars.length) {
        const coreGrad = ctx.createRadialGradient(state.cx, state.cy, 0, state.cx, state.cy, 190);
        coreGrad.addColorStop(0, `rgba(${primaryRgb}, ${0.10 * Math.min(1, stars.length / 24)})`);
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(state.cx, state.cy, 190, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const st = stars[i];
        if (st.alpha < 1) st.alpha = Math.min(1, st.alpha + 0.02);
        const ang = st.a + state.rot;
        st.x = state.cx + Math.cos(ang) * st.r;
        st.y = state.cy + Math.sin(ang) * st.r * 0.58;

        if (state.hole) {
          const dx = state.hole.x - st.x;
          const dy = state.hole.y - st.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d < 340) {
            const pull = (340 - d) / 340;
            st.r = Math.max(0, st.r - pull * 9);
            st.a += pull * 0.035;
          }
          if (d < state.hole.r + 16 || st.r < 5) {
            stars.splice(i, 1);
            state.hole.r = Math.min(state.hole.r + 0.32, 46);
            continue;
          }
        }

        // Dark rim first, so a star stays visible even over pale paper
        ctx.fillStyle = `rgba(4, 6, 14, ${0.6 * st.alpha})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size + 2.4, 0, Math.PI * 2);
        ctx.fill();

        const glow = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.size * 3.6);
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.98 * st.alpha})`);
        glow.addColorStop(0.3, `rgba(${st.tint}, ${0.9 * st.alpha})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size * 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * st.alpha})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      if (state.hole) {
        const h = state.hole;
        const birth = h.born ? Math.max(0, 1 - (now - h.born) / 500) : 0;
        const diskR = h.r * 2.7 * (1 + birth * 1.6);
        const diskGrad = ctx.createRadialGradient(h.x, h.y, h.r * 0.85, h.x, h.y, diskR);
        diskGrad.addColorStop(0, 'rgba(255, 178, 98, 0.8)');
        diskGrad.addColorStop(0.5, 'rgba(150, 120, 255, 0.32)');
        diskGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = diskGrad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, diskR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 224, 188, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * 1.95, h.r * 0.55, h.spin, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state.hole && stars.length === 0 && !state.wonAt) {
        state.wonAt = now;
      }

      if (state.wonAt) {
        const age = now - state.wonAt;
        const wave = age * 1.6;
        ctx.strokeStyle = `rgba(255, 240, 220, ${Math.max(0, 1 - age / 900)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(state.hole.x, state.hole.y, wave, 0, Math.PI * 2);
        ctx.stroke();

        const flash = Math.max(0, 1 - age / 600);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 250, 240, ${flash * 0.35})`;
          ctx.fillRect(0, 0, width, height);
        }

        if (age > 1100) {
          const done = onCompleteRef.current;
          state.stars = null;
          state.hole = null;
          state.wonAt = 0;
          if (done) done();
          return;
        }
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerdown', handleDown);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, bookRef, primaryRgb]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="trial-overlay" />;
}
