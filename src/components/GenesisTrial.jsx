import React, { useEffect, useRef, useState } from 'react';
import './GenesisTrial.css';

// Метеориты живут в главе постоянно и летают за книгой. Ломать можно всегда.
// Из расколотого камня плавно выступает самоцвет; алмаз бьёт глыбу у правого
// края разворота, всё прочее — только искры.
const HITS_TO_BREAK = 4;
export const SEAM_STAGES = 4;

// Окна выпадения алмаза: раньше первого числа он не выпадет никогда,
// на втором выпадет обязательно. Счёт идёт по разбитым камням с прошлой находки.
const DIAMOND_WINDOWS = [
  [4, 6],
  [3, 8],
  [4, 9],
  [5, 10]
];

const loadImage = (src) => { const i = new Image(); i.src = src; return i; };

function makeSfx(paths, volume, copies = 3) {
  const pool = paths.map((p) => {
    const list = Array.from({ length: copies }, () => {
      const a = new Audio(p);
      a.volume = volume;
      a.preload = 'auto';
      return a;
    });
    return { list, i: 0 };
  });
  return () => {
    if (!pool.length) return;
    const group = pool[Math.floor(Math.random() * pool.length)];
    const audio = group.list[group.i];
    group.i = (group.i + 1) % group.list.length;
    try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (e) { /* no sound */ }
  };
}

export default function GenesisTrial({ active, trialPage, bookRef, seamRef, seamStage, manifest, soundEnabled, onHoldChange, onSeamHit, onComplete }) {
  // Сцена держится на экране, пока не догорит: глава уже сменилась, а камни
  // ещё расходятся. Поэтому рисуем по alive, а не по active.
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const trialRef = useRef(trialPage);
  const soundRef = useRef(soundEnabled);
  const holdRef = useRef(onHoldChange);
  const seamStageRef = useRef(seamStage);
  const seamHitRef = useRef(onSeamHit);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { trialRef.current = trialPage; }, [trialPage]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { holdRef.current = onHoldChange; }, [onHoldChange]);
  useEffect(() => { seamStageRef.current = seamStage; }, [seamStage]);
  useEffect(() => { seamHitRef.current = onSeamHit; }, [onSeamHit]);
  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);

  useEffect(() => {
    if (!alive || !manifest) return undefined;
    const back = backRef.current;
    const front = frontRef.current;
    if (!back || !front) return undefined;
    const ctx = back.getContext('2d');      // дальний план
    const fx = front.getContext('2d');      // ближний план
    const base = import.meta.env.BASE_URL;

    const art = {
      rocks: manifest.rocks.map((st) => st.map((s) => loadImage(base + s))),
      shards: manifest.shards.map((s) => loadImage(base + s)),
      loot: (manifest.loot || manifest.gems).map((s) => loadImage(base + s)),
      diamond: loadImage(base + manifest.diamond)
    };

    const sfx = manifest.sfx || {};
    const playPick = makeSfx((sfx.pick || []).map((p) => base + p), 0.5, 4);
    const playGem = makeSfx((sfx.gem || []).map((p) => base + p), 0.55, 3);
    const playDiamond = makeSfx((sfx.diamond || []).map((p) => base + p), 0.7, 2);
    const encode = (p) => base + p.split('/').map(encodeURIComponent).join('/');
    const playMiss = makeSfx((sfx.missGenesis || []).map(encode), 0.45, 2);

    const state = {
      dust: [], rocks: [], shards: [], sparks: [], loot: [], comets: [], nextComet: 0,
      held: null, wonAt: 0,
      nextSpawn: 0, dry: 0, found: 0, book: null, fade: 0
    };

    const mouse = { x: -999, y: -999 };
    let width = 0, height = 0, frame = null;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      for (const [cv, c2] of [[back, ctx], [front, fx]]) {
        cv.width = Math.round(width * dpr);
        cv.height = Math.round(height * dpr);
        cv.style.width = width + 'px';
        cv.style.height = height + 'px';
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (state.dust && state.dust.length) state.dust = [];
      readBook();
    };

    // Рамку берём у самой книги, а не у обёртки: когда запертая глава отбрасывает
    // страницу назад, книга дрожит — и балка обязана дрожать вместе с ней
    const readBook = () => {
      const host = bookRef && bookRef.current;
      const el = host ? (host.querySelector('.book') || host) : null;
      const r = el ? el.getBoundingClientRect() : null;
      state.book = r && r.width
        ? { x: r.left, y: r.top, w: r.width, h: r.height }
        : { x: width * .15, y: height * .15, w: width * .7, h: height * .7 };
    };

    // Метеориты приходят со всех сторон, разного размера и скорости
    const pickKind = () => Math.floor(Math.random() * art.rocks.length);

    const spawnRock = (anywhere = false, inFrame = false) => {
      const side = Math.floor(Math.random() * 4);
      const depth = 0.45 + Math.random() * 0.85;          // дальние мельче и медленнее
      const size = (46 + Math.random() * 62) * depth;
      const speed = (0.25 + Math.random() * 0.75) * depth;
      const a = Math.random() * Math.PI * 2;
      let x, y;
      if (inFrame) {
        // подальше от книги, чтобы по камню сразу можно было ударить
        const b = state.book;
        const leftSide = Math.random() < 0.5;
        const margin = 60;
        x = leftSide
          ? margin + Math.random() * Math.max(40, b.x - margin * 2)
          : Math.min(width - margin, b.x + b.w + margin) + Math.random() * 60;
        y = margin + Math.random() * Math.max(80, height - margin * 2);
      } else if (anywhere) { x = Math.random() * width; y = Math.random() * height; }
      else if (side === 0) { x = -size; y = Math.random() * height; }
      else if (side === 1) { x = width + size; y = Math.random() * height; }
      else if (side === 2) { x = Math.random() * width; y = -size; }
      else { x = Math.random() * width; y = height + size; }
      const toCenter = Math.atan2(height / 2 - y, width / 2 - x) + (Math.random() - 0.5) * 2.4;
      const angle = inFrame ? Math.random() * Math.PI * 2 : (anywhere ? a : toCenter);
      const phantom = inFrame ? false : Math.random() < 0.28;
      state.rocks.push({
        phantom,
        kind: pickKind(),
        stage: 0, x, y, size, depth,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.012,
        flash: 0
      });
      if (phantom) {
        const r = state.rocks[state.rocks.length - 1];
        r.size *= 2.2;          // огромные, но далеко
        r.vx *= 0.16; r.vy *= 0.16;
        r.depth = 0.12 + Math.random() * 0.1;
        r.blur = 7 + Math.random() * 7;
        r.spin *= 0.4;
      }
    };

    const burstShards = (x, y, count, power, scale = 1) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = power * (0.35 + Math.random());
        state.shards.push({
          img: art.shards[Math.floor(Math.random() * art.shards.length)],
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2,
          rot: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * .35,
          size: (10 + Math.random() * 22) * scale, life: 1
        });
      }
    };

    const burstSparks = (x, y, count, tint, power = 4, bright = 1) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = power * (0.4 + Math.random());
        state.sparks.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, decay: 0.012 + Math.random() * 0.02, tint, bright,
          size: 1.4 + Math.random() * 2.6
        });
      }
    };

    const breakRock = (rock) => {
      burstShards(rock.x, rock.y, 22, 5, rock.depth);
      burstSparks(rock.x, rock.y, 10, '210, 195, 170', 3, 0.6);
      state.dry += 1;
      const window = DIAMOND_WINDOWS[Math.min(state.found, DIAMOND_WINDOWS.length - 1)];
      const [floor, ceiling] = window;
      let isDiamond;
      if (state.dry < floor) isDiamond = false;
      else if (state.dry >= ceiling) isDiamond = true;
      else isDiamond = Math.random() < (state.dry - floor + 1) / (ceiling - floor + 1);
      if (isDiamond) { state.dry = 0; state.found += 1; }
      state.loot.push({
        img: isDiamond ? art.diamond : art.loot[Math.floor(Math.random() * art.loot.length)],
        isDiamond, x: rock.x, y: rock.y,
        vx: Math.cos(Math.random() * Math.PI * 2) * (0.35 + Math.random() * 0.5),
        vy: Math.sin(Math.random() * Math.PI * 2) * (0.35 + Math.random() * 0.5),
        size: isDiamond ? 40 : 34,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.018,
        phase: Math.random() * Math.PI * 2, fade: 1,
        appear: 0.55, born: performance.now()
      });
    };

    // Камень из руки возвращается в мир и мягко уходит своей дорогой
    const releaseHeld = (x, y) => {
      const g = state.held;
      state.held = null;
      if (holdRef.current) holdRef.current(false);
      if (!g) return;
      const a = Math.random() * Math.PI * 2;
      g.x = x; g.y = y;
      g.vx = Math.cos(a) * (0.3 + Math.random() * 0.4);
      g.vy = Math.sin(a) * (0.3 + Math.random() * 0.4);
      g.spin = (Math.random() - 0.5) * 0.03;
      g.appear = 1; g.fade = 1;
      state.loot.push(g);
    };

    const onDown = (e) => {
      if (state.wonAt || state.fade < 0.35 || !activeRef.current) return;
      const mx = e.clientX, my = e.clientY;
      const b = state.book;

      if (state.held) {
        // Балка — элемент страницы, попадание считаем по её настоящим границам
        const seamEl = seamRef && seamRef.current;
        const box = seamEl ? seamEl.getBoundingClientRect() : null;
        const seamX = box ? (box.left + box.right) / 2 : b.x + b.w - 26;
        const onSeam = trialRef.current && box && seamStageRef.current < SEAM_STAGES
          && mx > box.left - 26 && mx < box.right + 26 && my > box.top - 10 && my < box.bottom + 10;
        if (onSeam) {
          if (state.held.isDiamond) {
            const nextStage = seamStageRef.current + 1;
            seamStageRef.current = nextStage;
            if (seamHitRef.current) seamHitRef.current();
            burstShards(seamX, my, 16, 5);
            burstSparks(seamX, my, 30, '255, 238, 200', 5, 1.2);
            if (soundRef.current) playDiamond();
            if (nextStage >= SEAM_STAGES) {
              state.wonAt = performance.now();
              burstShards(seamX, box.top + box.height / 2, 46, 7);
              burstSparks(seamX, box.top + box.height / 2, 60, '255, 244, 214', 7, 1.4);
            }
          } else {
            // самоцвет жалко: он вспыхивает своим цветом и гибнет
            const px = state.held.tint || '190, 210, 255';
            burstSparks(seamX, my, 42, px, 6, 1.5);
            if (soundRef.current) playGem();
          }
          state.held = null;
          if (holdRef.current) holdRef.current(false);
          return;
        }
        releaseHeld(mx, my);
        return;
      }

      for (let i = state.loot.length - 1; i >= 0; i--) {
        const g = state.loot[i];
        if (Math.hypot(g.x - mx, g.y - my) < g.size * 0.9) {
          state.held = state.loot.splice(i, 1)[0];
          if (holdRef.current) holdRef.current(true);
          return;
        }
      }

      let hitSomething = false;
      for (let i = state.rocks.length - 1; i >= 0; i--) {
        const r = state.rocks[i];
        if (r.phantom) continue;
        if (Math.hypot(r.x - mx, r.y - my) < r.size * 0.5) {
          r.stage += 1; r.flash = 1;

          // Удар вглубь камня с лёгким перекосом: сила толкает, плечо крутит
          const ax = mx - r.x, ay = my - r.y;
          const dir = Math.atan2(-ay, -ax) + (Math.random() - 0.5) * 1.1;
          const fxv = Math.cos(dir), fyv = Math.sin(dir);
          const power = (0.5 + Math.random() * 0.55) / Math.max(0.4, r.depth);
          r.vx += fxv * power * 0.5;
          r.vy += fyv * power * 0.5;
          r.spin += (ax * fyv - ay * fxv) * power * 0.00035;

          const sp = Math.hypot(r.vx, r.vy);
          if (sp > 2.4) { r.vx *= 2.4 / sp; r.vy *= 2.4 / sp; }
          r.spin = Math.max(-0.07, Math.min(0.07, r.spin));

          burstShards(mx, my, 6, 2.4, r.depth);
          if (soundRef.current) playPick();
          if (r.stage >= HITS_TO_BREAK) { breakRock(r); state.rocks.splice(i, 1); }
          hitSomething = true;
          return;
        }
      }

      // Кирка ушла в пустоту — космос отвечает своим звуком.
      // Попадание по самой книге пустотой не считается.
      const onChrome = e.target && e.target.closest &&
        e.target.closest('.book, .panel-dock, .book-bookmarks, .album-header, .splash-overlay');
      if (!hitSomething && !onChrome && soundRef.current) playMiss();
    };

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    measure();

    const seedDust = () => {
      state.dust = [];
      const count = Math.round((width * height) / 5200);
      for (let i = 0; i < count; i++) {
        state.dust.push({
          x: Math.random() * width, y: Math.random() * height,
          r: 0.4 + Math.random() * 1.1,
          a: 0.05 + Math.random() * 0.16,
          vx: (Math.random() - 0.5) * 0.05,
          vy: (Math.random() - 0.5) * 0.05,
          tw: Math.random() < 0.3 ? 0.0006 + Math.random() * 0.0012 : 0,
          ph: Math.random() * Math.PI * 2
        });
      }
    };
    seedDust();
    for (let i = 0; i < 10; i++) spawnRock(true);
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);

    const draw = () => {
      const now = performance.now();
      // Камни проступают из пустоты и так же растворяются при уходе из главы
      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.009 : -0.014)));
      const fade = state.fade;
      if (!on && fade <= 0) { setAlive(false); return; }
      readBook();
      ctx.clearRect(0, 0, width, height);
      fx.clearRect(0, 0, width, height);
      // пыль дальнего плана
      ctx.fillStyle = '#cfe0d4';
      for (const d of state.dust) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < -2) d.x = width + 2; else if (d.x > width + 2) d.x = -2;
        if (d.y < -2) d.y = height + 2; else if (d.y > height + 2) d.y = -2;
        const tw = d.tw ? 0.6 + 0.4 * Math.sin(now * d.tw + d.ph) : 1;
        ctx.globalAlpha = d.a * tw * fade;
        ctx.fillRect(d.x, d.y, d.r * 2, d.r * 2);
      }
      ctx.globalAlpha = 1;

      // кометы прошивают экран по диагонали
      if (now > state.nextComet) {
        state.nextComet = now + 4000 + Math.random() * 9000;
        const fromLeft = Math.random() < 0.5;
        const speed = 15 + Math.random() * 12;
        const angle = (fromLeft ? 0.25 : Math.PI - 0.25) + (Math.random() - 0.5) * 0.5;
        state.comets.push({
          x: fromLeft ? -80 : width + 80,
          y: Math.random() * height * 0.7,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          size: 1.6 + Math.random() * 1.8
        });
      }

      for (let i = state.comets.length - 1; i >= 0; i--) {
        const c = state.comets[i];
        c.x += c.vx; c.y += c.vy; c.life -= 0.004;
        if (c.life <= 0 || c.x < -300 || c.x > width + 300 || c.y > height + 200) {
          state.comets.splice(i, 1); continue;
        }
        const tailX = c.x - c.vx * 4.5, tailY = c.y - c.vy * 4.5;
        const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        grad.addColorStop(0, `rgba(226, 240, 255, ${0.9 * c.life * fade})`);
        grad.addColorStop(1, 'transparent');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = grad;
        ctx.lineWidth = c.size * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tailX, tailY); ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${c.life * fade})`;
        ctx.shadowColor = 'rgba(200, 226, 255, .9)';
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Пустой экран подтягивает камни почти сразу, полный — не спешит
      const solid = state.rocks.reduce((n, r) => n + (r.phantom ? 0 : 1), 0);
      if (state.rocks.length < 20 && solid < 12 && now > state.nextSpawn) {
        const wait = solid === 0 ? 60
          : solid < 3 ? 120 + Math.random() * 180
          : solid < 6 ? 240 + Math.random() * 320
          : 420 + Math.random() * 620;
        state.nextSpawn = now + wait;
        // Пустой экран ждать нечего: камень рождается прямо в кадре, сбоку от книги
        spawnRock(false, solid === 0);
      }

      // метеориты — дальние тусклее
      for (let i = state.rocks.length - 1; i >= 0; i--) {
        const r = state.rocks[i];
        r.x += r.vx; r.y += r.vy; r.rot += r.spin;

        const m = r.size + 80;
        if (r.x < -m || r.x > width + m || r.y < -m || r.y > height + m) { state.rocks.splice(i, 1); continue; }
        const img = art.rocks[r.kind][Math.min(r.stage, 3)];
        const first = art.rocks[r.kind][0];
        if (!img || !img.complete || !first.complete) continue;
        // масштаб берём от первой стадии, иначе камень «раздувается» при расколе
        const scale = r.size / first.width;
        const w = img.width * scale, h = img.height * scale;
        ctx.save();
        ctx.globalAlpha = (r.phantom ? 0.13 + r.depth * 0.35 : 0.45 + r.depth * 0.45) * fade;
        const blur = r.blur !== undefined ? r.blur : Math.max(0, (0.85 - r.depth) * 4);
        if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
        ctx.translate(r.x, r.y); ctx.rotate(r.rot);
        if (r.flash > 0) {
          ctx.shadowColor = 'rgba(255, 236, 196, .9)';
          ctx.shadowBlur = 26 * r.flash;
          r.flash = Math.max(0, r.flash - 0.05);
        }
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      // самоцветы: выступают плавно, парят, ждут
      for (let i = state.loot.length - 1; i >= 0; i--) {
        const g = state.loot[i];
        g.appear = Math.min(1, g.appear + 0.12);
        g.x += g.vx; g.y += g.vy;
        g.rot += g.spin;
        // у самой кромки экрана камень мягко тает, а не пропадает рывком
        const edge = 90;
        const near = Math.min(g.x + edge, width + edge - g.x, g.y + edge, height + edge - g.y);
        if (near < edge) g.fade = Math.max(0, g.fade - 0.02);
        if (g.fade <= 0) { state.loot.splice(i, 1); continue; }
        if (g.img.complete) {
          // Габарит считаем по длинной стороне: вытянутые кристаллы иначе
          // вырастают в целый саркофаг рядом с мелким осколком
          const k = g.size * (0.85 + g.appear * 0.15) / Math.max(g.img.width, g.img.height);
          const s = g.img.width * k;
          const hh = g.img.height * k;
          fx.save();
          fx.globalAlpha = g.appear * g.fade * fade;
          fx.shadowColor = g.isDiamond ? 'rgba(226, 244, 255, .95)' : 'rgba(190, 210, 255, .5)';
          fx.shadowBlur = g.isDiamond ? 28 : 14;
          const bob = Math.sin(now * 0.0016 + g.phase) * 2.4;
          fx.translate(g.x, g.y + bob);
          fx.rotate(g.rot);
          fx.drawImage(g.img, -s / 2, -hh / 2, s, hh);
          fx.restore();
        }
      }

      for (let i = state.shards.length - 1; i >= 0; i--) {
        const s = state.shards[i];
        s.vy += 0.18; s.x += s.vx; s.y += s.vy; s.rot += s.spin; s.life -= 0.011;
        if (s.life <= 0) { state.shards.splice(i, 1); continue; }
        if (!s.img.complete) continue;
        const w = s.size, h = s.size * (s.img.height / s.img.width);
        fx.save();
        fx.globalAlpha = Math.max(0, Math.min(1, s.life)) * fade;
        fx.translate(s.x, s.y); fx.rotate(s.rot);
        fx.drawImage(s.img, -w / 2, -h / 2, w, h);
        fx.restore();
      }

      for (let i = state.sparks.length - 1; i >= 0; i--) {
        const p = state.sparks[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.life -= p.decay;
        if (p.life <= 0) { state.sparks.splice(i, 1); continue; }
        fx.save();
        fx.globalCompositeOperation = 'screen';
        fx.shadowColor = `rgba(${p.tint}, ${p.life})`;
        fx.shadowBlur = 12 * p.bright;
        fx.fillStyle = `rgba(${p.tint}, ${Math.min(1, p.life * p.bright)})`;
        fx.beginPath();
        fx.arc(p.x, p.y, p.size * p.life + 0.5, 0, Math.PI * 2);
        fx.fill();
        fx.restore();
      }

      if (state.held && state.held.img.complete) {
        const g = state.held;
        const k = g.size * 1.15 / Math.max(g.img.width, g.img.height);
        const s = g.img.width * k, hh = g.img.height * k;
        g.rot += (g.spin || 0.004) * 0.35;
        fx.save();
        fx.shadowColor = g.isDiamond ? 'rgba(230, 246, 255, .95)' : 'rgba(200, 220, 255, .55)';
        fx.shadowBlur = g.isDiamond ? 30 : 16;
        fx.translate(mouse.x, mouse.y);
        fx.rotate(g.rot);
        fx.drawImage(g.img, -s / 2, -hh / 2, s, hh);
        fx.restore();
      }

      if (state.wonAt) {
        const age = now - state.wonAt;
        const flash = Math.max(0, 1 - age / 700);
        if (flash > 0) {
          fx.fillStyle = `rgba(255, 250, 235, ${flash * .28})`;
          fx.fillRect(0, 0, width, height);
        }
        if (age > 900) {
          const done = onCompleteRef.current;
          state.wonAt = 0;
          if (done) done();
        }
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
  }, [alive, manifest, bookRef, seamRef]);

  if (!alive) return null;
  return (
    <>
      <canvas ref={backRef} className="genesis-trial genesis-back" />
      <canvas ref={frontRef} className="genesis-trial genesis-front" />
    </>
  );
}
