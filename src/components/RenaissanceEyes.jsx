import React, { useEffect, useRef, useState } from 'react';
import './RenaissanceEyes.css';

// Глаза Ренессанса. Копятся по мере того, как открываются работы главы,
// делятся от щелчка и следят за курсором — пока он движется. Стоит замереть,
// все они доворачиваются вперёд, на человека по ту сторону экрана, и по краям
// наползает темнота. Двинулся — глаза снова разбегаются. Слой всегда лежит
// позади книги: на страницу глаза не выходят нигде.

const STILL_DELAY = 620;      // сколько курсор должен молчать, прежде чем на него посмотрят
const MAX_EYES = 110;

// Сколько глаз открывается за каждое закрытое око: дальше — гуще
const CLUSTER_SIZES = [3, 4, 6, 8, 10, 12];

// Радужки: бледные попадаются часто, красные редко и оттого страшнее
const IRIS_KINDS = [
  { weight: 22, iris: '58, 42, 34', glow: null },
  { weight: 16, iris: '38, 30, 26', glow: null },
  { weight: 14, iris: '96, 84, 62', glow: null },
  { weight: 12, iris: '150, 26, 22', glow: '190, 34, 28' },
  { weight: 11, iris: '196, 32, 26', glow: '230, 40, 30' },
  { weight: 9, iris: '120, 40, 34', glow: '150, 30, 26' },
  { weight: 8, iris: '18, 16, 16', glow: null },
  { weight: 8, iris: '176, 166, 150', glow: null }
];

const IRIS_TOTAL = IRIS_KINDS.reduce((n, k) => n + k.weight, 0);

function pickIris() {
  let roll = Math.random() * IRIS_TOTAL;
  for (const kind of IRIS_KINDS) {
    roll -= kind.weight;
    if (roll <= 0) return kind;
  }
  return IRIS_KINDS[0];
}

function makeEye(x, y, size) {
  const kind = pickIris();
  return {
    x, y,
    r: size,
    ax: (Math.random() - 0.5) * 0.012,    // почти не сдвигаются: нарост, а не рой
    ay: (Math.random() - 0.5) * 0.010,
    look: { x: 0, y: 0 },                 // текущее смещение зрачка
    tilt: (Math.random() - 0.5) * 0.55,
    flat: 0.5 + Math.random() * 0.28,
    blinkAt: performance.now() + 2000 + Math.random() * 6000,
    blink: 0,
    open: 0,                              // веко поднимается из пустоты
    iris: kind.iris,
    glow: kind.glow,
    irisScale: 0.7 + Math.random() * 0.28,
    pupilScale: 0.58 + Math.random() * 0.4,    // зрачки почти во всю радужку
    twin: Math.random() < 0.24,                // двойной зрачок
    // белок нездоровый, но всё-таки белок: серый с лёгкой желтизной
    sclera: Math.random() < 0.25
      ? Math.round(206 + Math.random() * 14) + ', ' + Math.round(186 + Math.random() * 12) + ', ' + Math.round(168 + Math.random() * 10)
      : Math.round(222 + Math.random() * 14) + ', ' + Math.round(216 + Math.random() * 12) + ', ' + Math.round(208 + Math.random() * 10),
    // нервные глаза не следят за курсором: рыщут по сторонам и застывают
    nervous: Math.random() < 0.1,      // почти все следят за курсором
    jerkAt: performance.now() + Math.random() * 1200,
    jerk: { x: 0, y: 0 },
    rage: 0,
    shake: { x: 0, y: 0 },
    born: performance.now()
  };
}

export default function RenaissanceEyes({ active, groups, scatter, manifest, soundEnabled, onCount }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const activeRef = useRef(active);
  const groupsRef = useRef(groups);
  const scatterRef = useRef(scatter);
  const countRef = useRef(onCount);
  const soundRef = useRef(soundEnabled);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { scatterRef.current = scatter; }, [scatter]);
  useEffect(() => { countRef.current = onCount; }, [onCount]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const state = {
      eyes: [],
      groupsDone: 0,
      fade: 0,
      lastMove: performance.now(),
      still: 0,          // 0..1 — насколько глубоко мы замерли
      shownFor: 0
    };
    const mouse = { x: -999, y: -999 };
    let width = 0, height = 0, frame = null;

    // Звук раздражения: тронул не тот глаз — он огрызается
    const base = import.meta.env.BASE_URL;
    const encode = (path) => base + path.split('/').map(encodeURIComponent).join('/');
    const makeSfx = (paths, volume, copies) => {
      const pool = (paths || []).map((path) => ({
        list: Array.from({ length: copies }, () => {
          const audio = new Audio(encode(path));
          audio.volume = volume;
          audio.preload = 'auto';
          return audio;
        }),
        i: 0
      }));
      return () => {
        if (!pool.length || !soundRef.current) return;
        const group = pool[Math.floor(Math.random() * pool.length)];
        const audio = group.list[group.i];
        group.i = (group.i + 1) % group.list.length;
        try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (err) { /* тишина */ }
      };
    };
    const sfxMap = (manifest && manifest.sfx) || {};
    const playRage = makeSfx(sfxMap.eyeRage, 0.5, 3);

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.3);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Глаза держатся по краям, и каждая новая гроздь садится в свой угол:
    // иначе все сбиваются в одну половину экрана
    const CORNERS = [
      [0.12, 0.18], [0.86, 0.2], [0.1, 0.72], [0.88, 0.76],
      [0.5, 0.1], [0.5, 0.9], [0.06, 0.45], [0.94, 0.5]
    ];

    const spawnSpot = (index) => {
      if (index === undefined) {
        for (let attempt = 0; attempt < 24; attempt++) {
          const x = 40 + Math.random() * (width - 80);
          const y = 40 + Math.random() * (height - 80);
          const edgeX = Math.min(x, width - x) / width;
          const edgeY = Math.min(y, height - y) / height;
          if (Math.min(edgeX, edgeY) < 0.3 || attempt > 18) return { x, y };
        }
        return { x: Math.random() * width, y: Math.random() * height };
      }
      const [kx, ky] = CORNERS[index % CORNERS.length];
      return {
        x: width * kx + (Math.random() - 0.5) * width * 0.1,
        y: height * ky + (Math.random() - 0.5) * height * 0.12
      };
    };

    const addEye = () => {
      if (state.eyes.length >= MAX_EYES) return;
      const size = 26 + Math.random() * 40;
      for (let attempt = 0; attempt < 20; attempt++) {
        const spot = spawnSpot();
        if (fits(spot.x, spot.y, size)) {
          state.eyes.push(makeEye(spot.x, spot.y, size));
          return;
        }
      }
    };

    // Место свободно, если новый глаз не наползает ни на один из уже открытых.
    // Считаем по эллипсам: глаза приплюснуты, и круговая проверка врёт.
    const fits = (x, y, r) => {
      const ry = r * 0.64;
      for (const o of state.eyes) {
        const ory = o.r * (o.flat || 0.64);
        const nx = (x - o.x) / ((r + o.r) * 1.04);
        const ny = (y - o.y) / ((ry + ory) * 1.04);
        if (nx * nx + ny * ny < 1) return false;
      }
      return true;
    };

    const addCluster = (index) => {
      const spot = spawnSpot(index);
      const count = CLUSTER_SIZES[Math.min(index, CLUSTER_SIZES.length - 1)];
      const grown = [];
      for (let i = 0; i < count; i++) {
        if (state.eyes.length >= MAX_EYES) break;
        const size = 26 + Math.random() * 44;     // от крупного до совсем большого
        let x = spot.x, y = spot.y, placed = !grown.length;

        // Лепим впритык к уже выросшему, но не внахлёст: перебираем места
        for (let attempt = 0; attempt < 40 && !placed; attempt++) {
          const host = grown[Math.floor(Math.random() * grown.length)];
          const a = Math.random() * Math.PI * 2;
          const reach = 1.06 + Math.random() * 0.5 + attempt * 0.03;
          x = host.x + Math.cos(a) * (host.r + size) * reach;
          y = host.y + Math.sin(a) * (host.r * (host.flat || 0.64) + size * 0.64) * reach;
          placed = fits(x, y, size);
        }
        if (!placed) continue;                   // тесно — этот глаз не открывается

        const eye = makeEye(x, y, size);
        eye.born = performance.now() + i * 130;   // раскрываются друг за другом
        grown.push(eye);
        state.eyes.push(eye);
      }
    };

    // Тронешь — глаз не делится и не гаснет, а приходит в бешенство:
    // зрачок распахивается, глаз трясётся и мечет взгляд по сторонам
    const enrage = (eye) => {
      eye.rage = 1;
      playRage();
      eye.jerkAt = 0;
      for (const other of state.eyes) {
        if (other === eye) continue;
        if (Math.hypot(other.x - eye.x, other.y - eye.y) < eye.r * 5) {
          other.rage = Math.max(other.rage || 0, 0.55);   // соседи заводятся следом
        }
      }
    };

    const onMove = (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      state.lastMove = performance.now();
    };

    const onDown = (e) => {
      // любое нажатие считается движением: отсчёт покоя начинается заново
      state.lastMove = performance.now();
      if (!activeRef.current) return;
      const onChrome = e.target && e.target.closest &&
        e.target.closest('.book, .panel-dock, .book-bookmarks, .album-header');
      if (onChrome) return;
      for (let i = state.eyes.length - 1; i >= 0; i--) {
        const eye = state.eyes[i];
        if (Math.hypot(eye.x - e.clientX, eye.y - e.clientY) < eye.r * 1.5) {
          enrage(eye);
          return;
        }
      }
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);

    let lastFrame = 0;
    const FRAME_STEP = 1000 / 34;

    const draw = () => {
      const now = performance.now();
      // при свёрнутом окне слой замирает вовсе
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      if (now - lastFrame < FRAME_STEP) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now;
      const on = activeRef.current;
      state.fade = Math.max(0, Math.min(1, state.fade + (on ? 0.2 : -0.02)));
      if (!on && state.fade <= 0) { setAlive(false); return; }
      const fade = state.fade;

      // Пустота молчит, пока на рисунке не закрыт первый глаз
      const wantGroups = groupsRef.current || 0;
      if (state.groupsDone < wantGroups) {
        addCluster(state.groupsDone);
        state.groupsDone += 1;
      }

      const idle = now - state.lastMove;
      const wantStill = on && idle > STILL_DELAY ? 1 : 0;
      state.still += (wantStill - state.still) * (wantStill ? 0.045 : 0.22);

      ctx.clearRect(0, 0, width, height);

      const scatterNow = scatterRef.current;

      // сколько глаз в этом кадре светятся: остальные горят без ореола
      let glowLeft = 14;

      for (const eye of state.eyes) {
        if (now < eye.born) continue;             // эта пара ещё не проснулась
        eye.open = Math.min(1, eye.open + 0.06);

        eye.x += eye.ax; eye.y += eye.ay;
        if (eye.x < -40) eye.x = width + 40; else if (eye.x > width + 40) eye.x = -40;
        if (eye.y < -40) eye.y = height + 40; else if (eye.y > height + 40) eye.y = -40;

        const r = eye.r;
        const ry = r * eye.flat;

        // Бешенство затухает медленно, пока оно есть — глаз трясётся
        eye.rage = Math.max(0, (eye.rage || 0) - 0.0035);
        const rage = eye.rage;
        if (rage > 0.02) {
          eye.shake.x = (Math.random() - 0.5) * r * 0.22 * rage;
          eye.shake.y = (Math.random() - 0.5) * ry * 0.3 * rage;
        } else {
          eye.shake.x *= 0.8; eye.shake.y *= 0.8;
        }

        // Рыскание: нервный глаз резко бросает взгляд и застывает.
        // В бешенстве так мечется любой, и куда быстрее
        if ((eye.nervous || rage > 0.02) && now > eye.jerkAt) {
          const a = Math.random() * Math.PI * 2;
          const far = 0.45 + Math.random() * 0.5;
          eye.jerk = { x: Math.cos(a) * r * 0.4 * far, y: Math.sin(a) * ry * 0.5 * far };
          eye.jerkAt = now + (rage > 0.02 ? 70 + Math.random() * 160 : 500 + Math.random() * 2200);
        }

        let tx, ty;
        if (scatterNow) {
          // у маяка глаза отводят взгляд от работы: зрачки уходят от середины
          const dx = eye.x - width / 2, dy = eye.y - height / 2;
          const d = Math.hypot(dx, dy) || 1;
          tx = (dx / d) * r * 0.42; ty = (dy / d) * ry * 0.5;
        } else if (state.still > 0.5) {
          tx = 0; ty = 0;                         // прямо вперёд, на человека
        } else if (eye.nervous || rage > 0.02) {
          tx = eye.jerk.x; ty = eye.jerk.y;
        } else {
          const dx = mouse.x - eye.x, dy = mouse.y - eye.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, d / 260);
          tx = (dx / d) * r * 0.34 * reach;
          ty = (dy / d) * ry * 0.42 * reach;
        }
        const ease = rage > 0.02 ? 0.55 : (eye.nervous && !scatterNow && state.still < 0.5 ? 0.28 : 0.12);
        eye.look.x += (tx - eye.look.x) * ease;
        eye.look.y += (ty - eye.look.y) * ease;

        if (now > eye.blinkAt) { eye.blink = 1; eye.blinkAt = now + 2600 + Math.random() * 7000; }
        eye.blink = Math.max(0, eye.blink - 0.07);

        const lid = (1 - Math.sin(eye.blink * Math.PI) * 0.94) * eye.open;

        ctx.save();
        ctx.translate(eye.x + eye.shake.x, eye.y + eye.shake.y);
        ctx.rotate(eye.tilt);
        ctx.globalAlpha = fade;                   // глаза видно всегда, а не только в тишине

        const lidPath = (ky) => {
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.bezierCurveTo(-r * 0.45, -ry * ky, r * 0.45, -ry * ky, r, 0);
          ctx.bezierCurveTo(r * 0.5, ry * ky * 0.86, -r * 0.5, ry * ky * 0.86, -r, 0);
          ctx.closePath();
        };

        lidPath(Math.max(0.02, lid));
        ctx.fillStyle = `rgba(${eye.sclera}, 0.97)`;
        ctx.fill();

        // сосуды: от углов к середине, в бешенстве наливаются
        if (lid > 0.3 && r > 13) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = `rgba(150, 40, 34, ${0.22 + rage * 0.5})`;
          ctx.lineWidth = Math.max(0.5, r * 0.014);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(side * r * 0.94, 0);
            ctx.quadraticCurveTo(side * r * 0.6, -ry * 0.32, side * r * 0.28, -ry * 0.06);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(side * r * 0.9, ry * 0.12);
            ctx.quadraticCurveTo(side * r * 0.6, ry * 0.44, side * r * 0.32, ry * 0.28);
            ctx.stroke();
          }
          ctx.restore();
        }

        if (lid > 0.16) {
          // путь строим заново: сосуды выше сбили текущий контур,
          // и радужка обрезалась по их нитке вместо века
          lidPath(Math.max(0.02, lid));
          ctx.save();
          ctx.clip();
          const px = eye.look.x, py = eye.look.y;
          // радужку меряем по ширине: в приплюснутом глазу она иначе крошечная
          const irisR = r * (0.3 + eye.irisScale * 0.16);

          if (eye.glow && glowLeft > 0 && r > 11) {
            glowLeft -= 1;
            ctx.shadowColor = `rgba(${eye.glow}, 0.85)`;
            ctx.shadowBlur = irisR * 2.2;
          }
          ctx.beginPath();
          ctx.arc(px, py, irisR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${eye.iris}, 0.97)`;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.arc(px, py, irisR, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(0.7, r * 0.035);
          ctx.strokeStyle = 'rgba(18, 12, 10, 0.8)';
          ctx.stroke();

          const pupilR = irisR * Math.min(0.99, eye.pupilScale * (1 + rage * 0.55));
          const offsets = eye.twin ? [-irisR * 0.34, irisR * 0.34] : [0];
          for (const ox of offsets) {
            ctx.beginPath();
            ctx.arc(px + ox, py, eye.twin ? pupilR * 0.62 : pupilR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(6, 4, 4, 0.99)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(px - irisR * 0.32, py - irisR * 0.36, irisR * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fill();
          ctx.restore();
        }

        lidPath(Math.max(0.02, lid));
        ctx.lineWidth = Math.max(0.9, r * 0.06);
        ctx.strokeStyle = 'rgba(16, 12, 11, 0.9)';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r * 0.45, -ry * 1.06 * lid, r * 0.45, -ry * 1.06 * lid, r, 0);
        ctx.lineWidth = Math.max(1.1, r * 0.09);
        ctx.strokeStyle = 'rgba(10, 8, 8, 0.75)';
        ctx.stroke();

        ctx.restore();
      }

      // Замерла — по краям наползает темнота, как усталое зрение
      if (state.still > 0.02) {
        const vignette = ctx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.24,
          width / 2, height / 2, Math.max(width, height) * 0.72
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, `rgba(0, 0, 0, ${0.62 * state.still * fade})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
      }

      if (countRef.current) countRef.current(state.eyes.length);

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
  return (
    <>
      <div className="eyes-haze" aria-hidden="true"></div>
      <canvas ref={canvasRef} className="renaissance-eyes behind" />
    </>
  );
}
