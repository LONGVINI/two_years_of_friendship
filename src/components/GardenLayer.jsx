import React, { useEffect, useRef, useState } from 'react';
import './GardenLayer.css';

// Сад Переосмысления. Ничего нажимать не нужно: каждая открытая работа главы
// пускает новый стебель, и к концу главы поля вокруг книги зарастают. Растут
// они только по краям экрана, книгу не закрывают и лежат позади неё. Сверху
// навстречу свисают тонкие лозы с редкими бутонами, а в воздухе медленно
// поднимается пыльца. Часть
// стеблей чернеет и вянет, не дойдя до цветка, — это и есть тревога. Когда
// цепи главы пали, увядшие трогаются в рост заново и доходят до цветков.

const MAX_STEMS = 40;
const MIN_STEMS = 5;
const MAX_VINES = 18;     // сколько лоз может свисать сверху
const MOTES = 26;         // пыльца, что медленно поднимается снизу вверх
const GROW_TIME = 5200;
const WITHER_SHARE = 0.28;
const REACH = 190;           // с какого расстояния стебель чувствует курсор

const PETALS = [
  { face: '215, 169, 211', edge: '150, 104, 148', heart: '246, 226, 168' },
  { face: '232, 200, 214', edge: '166, 124, 148', heart: '240, 216, 156' },
  { face: '196, 176, 220', edge: '128, 108, 162', heart: '238, 222, 176' },
  { face: '238, 214, 196', edge: '172, 138, 124', heart: '232, 206, 150' },
  { face: '206, 186, 226', edge: '138, 118, 168', heart: '244, 230, 190' }
];

const STALK = { live: '116, 134, 98', dead: '68, 58, 62' };

export default function GardenLayer({ active, grown = 0, bloom, bookRef, soundEnabled }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const grownRef = useRef(grown);
  const bloomRef = useRef(bloom);
  const bookHost = useRef(bookRef);
  const soundRef = useRef(soundEnabled);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { grownRef.current = grown; }, [grown]);
  useEffect(() => { bloomRef.current = bloom; }, [bloom]);
  useEffect(() => { bookHost.current = bookRef; }, [bookRef]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null;
    const stems = [];
    const vines = [];
    const motes = [];
    const rings = [];
    const state = { fade: 0, bloomAt: 0 };
    const mouse = { x: -9999, y: -9999 };

    const bookBox = () => {
      const host = bookHost.current && bookHost.current.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      return r && r.width ? r : null;
    };

    // Стебли садятся только по краям экрана: слева и справа от книги, а
    // остальные — узкой полосой у самого низа, ниже разворота
    const plantX = (i) => {
      const box = bookBox();
      const left = box ? box.left : width * 0.24;
      const right = box ? box.right : width * 0.76;
      const slot = (i * 0.618) % 1;

      if (i % 3 === 2) return { x: width * (0.03 + slot * 0.94), bottomRow: true };
      if (i % 2 === 0) return { x: left * slot * 0.92, bottomRow: false };
      return { x: right + (width - right) * (0.08 + slot * 0.86), bottomRow: false };
    };

    const makeStem = (i) => {
      const unit = Math.min(width, height);
      const spot = plantX(i);
      const len = spot.bottomRow
        ? unit * (0.07 + Math.random() * 0.06)
        : unit * (0.16 + Math.random() * 0.2);

      const leaves = [];
      const count = 1 + (Math.random() < 0.6 ? 1 : 0);
      for (let l = 0; l < count; l++) {
        leaves.push({
          at: 0.3 + Math.random() * 0.42,
          side: Math.random() < 0.5 ? -1 : 1,
          size: unit * (0.008 + Math.random() * 0.007)
        });
      }

      return {
        x: spot.x,
        low: spot.bottomRow,
        len,
        lean: (Math.random() - 0.5) * 0.45,
        sway: 0.4 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        thick: unit * (0.0022 + Math.random() * 0.0018),
        petals: PETALS[Math.floor(Math.random() * PETALS.length)],
        petalCount: 5 + Math.floor(Math.random() * 3),
        headR: unit * (0.0075 + Math.random() * 0.006),
        leaves,
        withered: Math.random() < WITHER_SHARE,
        startedAt: performance.now(),
        push: 0,
        grow: 0,
        open: 0
      };
    };

    // Сверху свисают тонкие лозы: они растут вниз, навстречу саду, и на них
    // сидят редкие мелкие бутоны. Качаются от того же ветра и тех же волн
    const makeVine = (i) => {
      const unit = Math.min(width, height);
      const slot = (i * 0.382) % 1;
      const box = bookBox();
      const left = box ? box.left : width * 0.24;
      const right = box ? box.right : width * 0.76;
      // лозы висят по краям и над книгой, но короткие над самим разворотом
      const overBook = i % 3 === 0;
      const x = overBook
        ? left + (right - left) * slot
        : (i % 2 === 0 ? left * slot : right + (width - right) * slot);

      const buds = [];
      const count = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < count; b++) {
        buds.push({ at: 0.35 + Math.random() * 0.6, size: unit * (0.004 + Math.random() * 0.005) });
      }

      return {
        x,
        len: overBook ? unit * (0.05 + Math.random() * 0.05) : unit * (0.14 + Math.random() * 0.22),
        lean: (Math.random() - 0.5) * 0.4,
        sway: 0.5 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        thick: unit * (0.0016 + Math.random() * 0.0014),
        petals: PETALS[Math.floor(Math.random() * PETALS.length)],
        buds,
        startedAt: performance.now(),
        push: 0,
        grow: 0
      };
    };

    const makeMote = () => ({
      x: Math.random() * width,
      y: height + Math.random() * height * 0.5,
      r: 0.8 + Math.random() * 1.6,
      vy: -(0.12 + Math.random() * 0.3),
      drift: (Math.random() - 0.5) * 0.25,
      phase: Math.random() * Math.PI * 2,
      life: 0.4 + Math.random() * 0.6
    });

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.3);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stems.forEach((s, i) => {
        const fresh = makeStem(i);
        fresh.grow = s.grow;
        fresh.open = s.open;
        fresh.withered = s.withered;
        fresh.startedAt = s.startedAt;
        stems[i] = fresh;
      });
      vines.forEach((v, i) => {
        const fresh = makeVine(i);
        fresh.grow = v.grow;
        fresh.startedAt = v.startedAt;
        vines[i] = fresh;
      });
      motes.length = 0;
    };

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    // Сад звучит: щелчок по пустому месту роняет каплю света, от неё расходится
    // круг, качает встреченные стебли и берёт ноту. Высота ноты зависит от того,
    // где щёлкнули: у земли низко, ближе к небу высоко. Строй пентатонический,
    // поэтому мимо не бывает
    const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    let audio = null;
    const note = (y) => {
      if (!soundRef.current) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audio) audio = new Ctx();
        if (audio.state === 'suspended') audio.resume();

        // снизу вверх: у нижнего края самая низкая нота, у верхнего самая высокая
        const up = Math.max(0, Math.min(0.999, 1 - y / height));
        const step = SCALE[Math.floor(up * SCALE.length)];
        const freq = 196 * Math.pow(2, step / 12);
        const now = audio.currentTime;

        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
        gain.connect(audio.destination);

        // основной тон и тихая октава сверху: получается похоже на челесту
        for (const [mul, level] of [[1, 1], [2, 0.35], [3, 0.12]]) {
          const osc = audio.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * mul, now);
          const part = audio.createGain();
          part.gain.setValueAtTime(level, now);
          osc.connect(part);
          part.connect(gain);
          osc.start(now);
          osc.stop(now + 1.7);
        }
      } catch (err) { /* без звука тоже сойдёт */ }
    };

    const onDown = (e) => {
      if (!activeRef.current) return;
      const onChrome = e.target && e.target.closest &&
        e.target.closest('.book, .panel-dock, .book-bookmarks, .album-header, .splash-overlay');
      if (onChrome) return;
      rings.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
      note(e.clientY);
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);

    const stemPoint = (s, t, wind) => {
      const bend = s.lean + wind * s.sway + s.push;
      const up = s.len * t;
      return {
        x: s.x + Math.sin(t * Math.PI * 0.6) * up * bend * 0.6,
        y: height - up
      };
    };

    const drawLeaf = (p, angle, size, dead) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.6, -size * 0.42, size * 1.5, 0);
      ctx.quadraticCurveTo(size * 0.6, size * 0.42, 0, 0);
      ctx.closePath();
      ctx.fillStyle = dead ? `rgba(${STALK.dead}, 0.8)` : `rgba(${STALK.live}, 0.85)`;
      ctx.fill();
      ctx.restore();
    };

    const drawHead = (s, p, open, dead) => {
      const r = s.headR * open;
      if (r <= 0.3) return;
      ctx.save();
      ctx.translate(p.x, p.y);

      if (dead) {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.3, r * 0.5, r * 0.8, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${STALK.dead}, 0.9)`;
        ctx.fill();
        ctx.restore();
        return;
      }

      for (let i = 0; i < s.petalCount; i++) {
        ctx.save();
        ctx.rotate((i / s.petalCount) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.86, r * 0.42, r * 0.86, 0, 0, Math.PI * 2);
        const petal = ctx.createLinearGradient(0, -r * 1.7, 0, 0);
        petal.addColorStop(0, `rgba(${s.petals.edge}, 0.9)`);
        petal.addColorStop(0.55, `rgba(${s.petals.face}, 0.94)`);
        petal.addColorStop(1, `rgba(${s.petals.face}, 0.8)`);
        ctx.fillStyle = petal;
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.petals.heart}, 0.95)`;
      ctx.fill();
      ctx.restore();
    };

    const drawStem = (s, now, fade) => {
      const wind = Math.sin(now * 0.0004 + s.phase) * 0.3;
      const dead = s.withered && !bloomRef.current;
      const soft = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

      // курсор проходит рядом — стебель отклоняется и медленно возвращается
      const head = { x: s.x, y: height - s.len * Math.max(0.2, s.grow) };
      const dx = head.x - mouse.x;
      const dy = head.y - mouse.y;
      const d = Math.hypot(dx, dy);
      let wantPush = d < REACH ? Math.sign(dx || 1) * (1 - d / REACH) * 0.55 : 0;

      // волна от щелчка проходит по саду и качает всё, чего коснулась
      for (const ring of rings) {
        const rd = Math.abs(Math.hypot(head.x - ring.x, head.y - ring.y) - ring.r);
        if (rd < 70) {
          wantPush += Math.sign(head.x - ring.x || 1) * (1 - rd / 70) * ring.life * 0.9;
        }
      }
      s.push += (wantPush - s.push) * 0.12;

      const limit = dead ? 0.62 : 1;
      s.grow = Math.min(limit, soft(Math.min(1, (now - s.startedAt) / GROW_TIME)) * limit);
      const t = s.grow;
      if (t <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const p = stemPoint(s, (i / steps) * t, wind);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = Math.max(1, s.thick);
      ctx.strokeStyle = dead ? `rgba(${STALK.dead}, 0.9)` : `rgba(${STALK.live}, 0.85)`;
      ctx.stroke();

      for (const leaf of s.leaves) {
        if (t < leaf.at + 0.06) continue;
        const p = stemPoint(s, leaf.at, wind);
        drawLeaf(p, leaf.side < 0 ? Math.PI + 0.4 : -0.4, leaf.size, dead);
      }

      const wantOpen = t >= (dead ? 0.6 : 0.94) ? 1 : 0;
      s.open += (wantOpen - s.open) * 0.05;
      if (s.open > 0.01) drawHead(s, stemPoint(s, t, wind), s.open, dead);

      ctx.restore();
    };

    const drawVine = (v, now, fade) => {
      const wind = Math.sin(now * 0.00035 + v.phase) * 0.32;
      const soft = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      v.grow = soft(Math.min(1, (now - v.startedAt) / GROW_TIME));
      const t = v.grow;
      if (t <= 0.01) return;

      // лоза чувствует руку и волны так же, как стебли внизу
      const tip = { x: v.x, y: v.len * t };
      let wantPush = 0;
      const d = Math.hypot(tip.x - mouse.x, tip.y - mouse.y);
      if (d < REACH) wantPush = Math.sign(tip.x - mouse.x || 1) * (1 - d / REACH) * 0.5;
      for (const ring of rings) {
        const rd = Math.abs(Math.hypot(tip.x - ring.x, tip.y - ring.y) - ring.r);
        if (rd < 70) wantPush += Math.sign(tip.x - ring.x || 1) * (1 - rd / 70) * ring.life * 0.8;
      }
      v.push += (wantPush - v.push) * 0.1;

      const point = (part) => {
        const bend = v.lean + wind * v.sway + v.push;
        const down = v.len * part;
        return { x: v.x + Math.sin(part * Math.PI * 0.6) * down * bend * 0.6, y: down };
      };

      ctx.save();
      ctx.globalAlpha = fade * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const p = point((i / steps) * t);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = Math.max(0.8, v.thick);
      ctx.strokeStyle = `rgba(${STALK.live}, 0.7)`;
      ctx.stroke();

      for (const bud of v.buds) {
        if (t < bud.at) continue;
        const p = point(bud.at);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, bud.size, bud.size * 1.5, v.lean, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${v.petals.face}, 0.8)`;
        ctx.fill();
      }
      ctx.restore();
    };

    const drawMotes = (now, fade) => {
      ctx.save();
      for (const m of motes) {
        m.y += m.vy;
        m.x += m.drift + Math.sin(now * 0.0006 + m.phase) * 0.3;
        if (m.y < -20) {
          m.y = height + 20;
          m.x = Math.random() * width;
        }
        ctx.globalAlpha = fade * m.life * 0.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 214, 236, 0.9)';
        ctx.fill();
      }
      ctx.restore();
    };

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 30;

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;

      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.03 : -0.03)));
      if (!on && state.fade <= 0) { setAlive(false); return; }

      ctx.clearRect(0, 0, width, height);
      if (!width || !height) { frame = requestAnimationFrame(draw); return; }

      const want = Math.min(MAX_STEMS, Math.max(MIN_STEMS, (grownRef.current | 0) * 2));
      while (stems.length < want) stems.push(makeStem(stems.length));

      // сверху лоз вдвое меньше, чем стеблей внизу: воздух не должен зарасти
      const wantVines = Math.min(MAX_VINES, Math.max(3, Math.ceil(want / 2)));
      while (vines.length < wantVines) vines.push(makeVine(vines.length));
      while (motes.length < MOTES) motes.push(makeMote());

      if (bloomRef.current && !state.bloomAt) {
        state.bloomAt = now;
        for (const s of stems) {
          if (s.withered) s.startedAt = now - GROW_TIME * 0.55;
        }
      }
      if (!bloomRef.current && state.bloomAt) state.bloomAt = 0;

      drawMotes(now, state.fade);
      for (const v of vines) drawVine(v, now, state.fade);
      for (const s of stems) drawStem(s, now, state.fade);

      // сами круги: тонкий светлый обод, расходящийся от места щелчка
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r += 9;
        ring.life -= 0.016;
        if (ring.life <= 0) { rings.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = state.fade * ring.life * 0.5;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(226, 206, 232, 0.9)';
        ctx.stroke();
        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive]);

  if (!alive) return null;
  return <canvas ref={canvasRef} className="garden-layer" aria-hidden="true" />;
}
