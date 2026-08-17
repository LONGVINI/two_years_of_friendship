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
// style — вид глаза: 'ink' чёрный с золотой радужкой, 'wound' кровоточащий,
// 'pierced' без зрачка, 'beacon' пульсирующий маяк. veil — глаз под повязкой,
// её надо оттащить мышью. exit — 'split', 'up', 'right', 'shrink'.
// sound — номер файла в папке попаданий, жёстко закреплён за глазом.
// Повязка настраивается отдельно от глаза: veilW и veilH — её ширина и высота
// в долях ширины картинки, veilX и veilY — центр (тоже в долях, от угла
// картинки), veilTilt — наклон в градусах.
export const FINAL_WORK = 'Безликая жрица';

export const EYE_MAPS = {
  'Осколки подсознания': [
    { x: 0.565, y: 0.178, r: 0.068, tilt: -8, flat: 0.72, exit: 'split', sound: 1 },
    { x: 0.262, y: 0.310, r: 0.090, tilt: -16, flat: 0.91, exit: 'up', sound: 2 },
    { x: 0.678, y: 0.338, r: 0.074, tilt: -12, flat: 0.50, exit: 'right', sound: 3 }
  ],
  'Лунное спокойствие': [
    { x: 0.400, y: 0.438, r: 0.050, tilt: -3, flat: 0.46, blank: true, exit: 'shrink', sound: 4 },
    { x: 0.582, y: 0.435, r: 0.045, tilt: 0, flat: 0.46, blank: true, exit: 'shrink', sound: 5 }
  ],
  'Третий взор': [
    { x: 0.426, y: 0.278, r: 0.034, tilt: 5, flat: 0.75, style: 'ink', exit: 'right', sound: 6 },
    { x: 0.558, y: 0.278, r: 0.034, tilt: -5, flat: 0.75, style: 'ink', exit: 'split', sound: 7 },
    { x: 0.492, y: 0.200, r: 0.032, tilt: 0, flat: 0.8, style: 'ink', exit: 'up', sound: 8 }
  ],
  'Скрытая рана': [
    { x: 0.380, y: 0.242, r: 0.050, tilt: 2, flat: 0.54, style: 'wound', exit: 'shrink', sound: 9 }
  ],
  // Повязку сперва надо оттащить мышью — под ней глаз без зрачка
  'Пиратский шик': [
    {
      x: 0.400, y: 0.348, r: 0.034, tilt: 13, flat: 0.5,
      style: 'pierced', exit: 'shrink', sound: 10,
      veil: true,
      veilX: 0.400, veilY: 0.348,      // где лежит центр повязки
      veilW: 0.090, veilH: 0.09,      // её ширина и высота
      veilTilt: 12                     // наклон в градусах
    }
  ]
};

const RAD = Math.PI / 180;

export default function PaintingEyes({ title, closed, live = true, manifest, soundEnabled, onEscape }) {
  const canvasRef = useRef(null);
  const escapeRef = useRef(onEscape);
  const soundRef = useRef(soundEnabled);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const map = EYE_MAPS[title];
  // Список снятых нужен только в миг сборки слоя. Если следить за ним дальше,
  // собственный щелчок пересоберёт слой и погасит глаз, не дав ему доиграть.
  const closedRef = useRef(closed);
  closedRef.current = closed;

  useEffect(() => {
    if (!map) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    if (!host) return undefined;

    // Уже снятые глаза не возвращаются: гасим ровно те, что были нажаты
    const done = Array.isArray(closedRef.current) ? closedRef.current.slice() : [];
    const eyes = map.map((spec, i) => ({
      ...spec,
      look: { x: 0, y: 0 },
      blink: 0,
      blinkAt: performance.now() + 1200 + Math.random() * 5000,
      closing: 0,
      veilPull: 0,                  // насколько повязка оттащена
      dragging: false,
      alive: !done.includes(i)
    }));

    const mouse = { x: -999, y: -999, still: 0, lastMove: performance.now() };
    let width = 0, height = 0, frame = null;

    // Звук верного попадания: этот глаз действительно надо было тронуть
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
    const hitPool = sfxMap.eyeRight || [];
    // Звук закреплён за глазом жёстко: номер из карты, а не случайный выбор
    const playFor = (eye) => {
      if (!soundRef.current || !hitPool.length) return;
      const wanted = eye.sound
        ? hitPool.find((path) => new RegExp('/' + eye.sound + '\\.mp3$').test(path))
        : null;
      const path = wanted || hitPool[(eye.sound ? eye.sound - 1 : 0) % hitPool.length];
      try {
        const audio = new Audio(encode(path));
        audio.volume = 0.65;
        audio.play().catch(() => {});
      } catch (err) { /* тишина */ }
    };

    const measure = () => {
      // Габариты берём собственные, а не из getBoundingClientRect: во время
      // переворота страницы тот отдаёт проекцию повёрнутого листа, и слой
      // едет вместе с искажением, а на посадке скачком встаёт на место
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = host.offsetWidth || host.clientWidth;
      height = host.offsetHeight || host.clientHeight;
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Пока лист повёрнут, попадания считать бессмысленно: работаем только
    // с ровно лежащей страницей, где проекция совпадает с самим листом
    const localPoint = (clientX, clientY) => {
      const r = host.getBoundingClientRect();
      const flat = Math.abs(r.width - width) < 2 && Math.abs(r.height - height) < 2;
      return { x: clientX - r.left, y: clientY - r.top, flat };
    };

    const onMove = (e) => {
      const point = localPoint(e.clientX, e.clientY);
      mouse.x = point.x;
      mouse.y = point.y;
      mouse.lastMove = performance.now();
      for (const eye of eyes) {
        if (!eye.dragging) continue;
        const span = (eye.veilW !== undefined ? eye.veilW : eye.r * 3.4) * width;
        const pulled = (mouse.x - eye.dragFrom) / span;
        eye.veilPull = Math.max(0, Math.min(1, pulled));
      }
    };

    const onUp = () => {
      for (const eye of eyes) {
        if (!eye.dragging) continue;
        eye.dragging = false;
        // не дотащила — повязка сползает обратно
        if (eye.veilPull < 0.7) eye.veilBack = true;
        else eye.veilPull = 1;
      }
    };

    const onDown = (e) => {
      if (!live) return;                       // копия в полёте кликов не ловит
      const point = localPoint(e.clientX, e.clientY);
      if (!point.flat) return;                 // страница в полёте — не трогаем
      const mx = point.x, my = point.y;
      for (const eye of eyes) {
        if (!eye.alive || eye.closing) continue;
        const ex = eye.x * width, ey = eye.y * height;
        const rr = eye.r * width;

        // Повязка: её сначала стаскивают, и лишь потом глаз можно тронуть
        if (eye.veil && eye.veilPull < 0.95) {
          const vx = (eye.veilX !== undefined ? eye.veilX : eye.x) * width;
          const vy = (eye.veilY !== undefined ? eye.veilY : eye.y) * height;
          const vw = (eye.veilW !== undefined ? eye.veilW : eye.r * 3.4) * width;
          const vh = (eye.veilH !== undefined ? eye.veilH : eye.r * 0.9) * width;
          if (Math.abs(mx - vx) < vw / 2 && Math.abs(my - vy) < vh) {
            e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
            eye.dragging = true;
            eye.dragFrom = mx;
            return;
          }
          continue;
        }

        if (Math.hypot(ex - mx, ey - my) < rr * 1.35) {
          // ловим событие на подходе, иначе книга примет щелчок за перелистывание
          e.stopPropagation();
          if (e.preventDefault) e.preventDefault();
          eye.closing = 0.001;                 // начал закрываться, каждый по-своему
          playFor(eye);
          if (escapeRef.current) escapeRef.current(title, eyes.indexOf(eye));
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
    window.addEventListener('pointerup', onUp);

    const draw = () => {
      const now = performance.now();
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
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
        let closeLid = 1, closeFade = 1, shrink = 1, bleed = 0, spin = 0, split = 0;
        if (eye.closing) {
          // всё вдвое медленнее прежнего: уходить надо не спеша
          const speed = eye.exit === 'split' ? 0.0021 : 0.003;
          eye.closing = Math.min(1, eye.closing + speed);
          const t = eye.closing;
          eye.exitGaze = Math.min(1, t / 0.68);
          const soft = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

          if (eye.style === 'wound') {
            // рана наливается краснотой целиком и лишь потом схлопывается
            bleed = soft(Math.min(1, t / 0.7));
            const lidPhase = Math.max(0, (t - 0.72) / 0.24);
            closeLid = 1 - soft(Math.min(1, lidPhase));
            closeFade = 1 - Math.max(0, (t - 0.96) / 0.04);
          } else if (eye.style === 'ink') {
            // зрачок мечется по орбите всё быстрее, а потом веко падает
            spin = Math.min(1, t / 0.62);
            const lidPhase = Math.max(0, (t - 0.64) / 0.3);
            closeLid = 1 - soft(Math.min(1, lidPhase));
            closeFade = 1 - Math.max(0, (t - 0.94) / 0.06);
          } else if (eye.style === 'pierced') {
            // проколотый разваливается надвое: половинки расходятся
            split = soft(Math.min(1, Math.max(0, (t - 0.15) / 0.7)));
            closeFade = 1 - Math.max(0, (t - 0.72) / 0.28);
          } else if (eye.exit === 'shrink') {
            shrink = Math.max(0.03, 1 - soft(Math.min(1, t / 0.66)));
            closeFade = 1 - Math.max(0, (t - 0.7) / 0.3);
          } else {
            const lidPhase = Math.max(0, (t - 0.7) / 0.26);
            closeLid = 1 - soft(Math.min(1, lidPhase));
            closeFade = 1 - Math.max(0, (t - 0.96) / 0.04);
          }
          if (t >= 1) { eye.alive = false; continue; }
        }

        let tx, ty;
        if (eye.closing) {
          const g = eye.exitGaze || 0;
          if (spin > 0) {
            // бег по орбите: чем ближе к концу, тем быстрее круги
            const a = now * (0.004 + spin * 0.03);
            tx = Math.cos(a) * rr * 0.34 * (1 - spin * 0.3);
            ty = Math.sin(a) * ry * 0.5 * (1 - spin * 0.3);
          } else if (eye.exit === 'up') { tx = 0; ty = -ry * 0.55 * g; }
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
        const chase = spin > 0 ? 0.5 : (eye.closing ? 0.05 : 0.12);
        eye.look.x += (tx - eye.look.x) * chase;
        eye.look.y += (ty - eye.look.y) * chase;

        // Повязка сползает обратно, если её отпустили на полпути
        if (eye.veilBack) {
          eye.veilPull = Math.max(0, eye.veilPull - 0.03);
          if (eye.veilPull <= 0) eye.veilBack = false;
        }

        if (!eye.closing && now > eye.blinkAt) {
          eye.blink = 1; eye.blinkAt = now + 2600 + Math.random() * 6000;
        }
        eye.blink = Math.max(0, eye.blink - 0.07);
        const lid = (1 - Math.sin(eye.blink * Math.PI) * 0.92) * closeLid;

        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate((eye.tilt || 0) * RAD);
        ctx.globalAlpha = closeFade * (split > 0.01 ? 0 : 1);

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
        if (eye.style === 'ink') {
          sclera.addColorStop(0, 'rgba(18, 14, 20, 1)');
          sclera.addColorStop(0.45, 'rgba(30, 24, 32, 1)');
          sclera.addColorStop(1, 'rgba(14, 11, 16, 1)');
        } else {
          sclera.addColorStop(0, 'rgba(186, 176, 170, 1)');
          sclera.addColorStop(0.4, 'rgba(232, 226, 218, 1)');
          sclera.addColorStop(1, 'rgba(206, 190, 184, 1)');
        }
        ctx.fillStyle = sclera;
        ctx.fill();

        // сосуды: тонкие красные нити от углов к середине
        if (lid > 0.3 && eye.style !== 'ink') {
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

        // Кровь стоит внутри глаза: тёмный ободок по нижнему веку
        // и мутная краснота, поднимающаяся снизу к радужке
        if (eye.style === 'wound' && lid > 0.2) {
          lidPath(1, Math.max(0.02, lid));
          ctx.save();
          ctx.clip();

          // по мере ухода краснота поднимается от века и заливает всё
          const top = ry * (0.15 - bleed * 1.2);
          const pool = ctx.createLinearGradient(0, top, 0, ry);
          pool.addColorStop(0, `rgba(120, 14, 16, ${bleed * 0.9})`);
          pool.addColorStop(0.45, `rgba(126, 12, 14, ${0.5 + bleed * 0.45})`);
          pool.addColorStop(1, `rgba(96, 8, 10, ${0.92 + bleed * 0.08})`);
          ctx.fillStyle = pool;
          ctx.fillRect(-rr, top, rr * 2, ry * 2);

          ctx.beginPath();
          ctx.moveTo(-rr, ry * 0.02);
          ctx.bezierCurveTo(-rr * 0.5, ry * 0.9, rr * 0.5, ry * 0.9, rr, ry * 0.02);
          ctx.lineWidth = Math.max(1, rr * 0.07);
          ctx.strokeStyle = 'rgba(138, 16, 18, 0.85)';
          ctx.stroke();
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

            if (eye.style === 'ink') {
              // Золотое кольцо, а внутри не провал, а слепящая белизна:
              // светлое ядро с тёплым отливом и крохотная серая точка в центре
              ctx.beginPath();
              ctx.arc(ox, py, irisR, 0, Math.PI * 2);
              const gold = ctx.createRadialGradient(ox, py, irisR * 0.2, ox, py, irisR);
              gold.addColorStop(0, 'rgba(246, 214, 120, 0.95)');
              gold.addColorStop(0.7, 'rgba(198, 150, 52, 0.95)');
              gold.addColorStop(1, 'rgba(120, 84, 24, 0.9)');
              ctx.fillStyle = gold;
              ctx.shadowColor = 'rgba(250, 220, 140, 0.55)';
              ctx.shadowBlur = irisR * 1.4;
              ctx.fill();
              ctx.shadowBlur = 0;

              const coreR = irisR * 0.56 * shrink;
              const core = ctx.createRadialGradient(ox, py, 0, ox, py, coreR);
              core.addColorStop(0, 'rgba(255, 255, 252, 1)');
              core.addColorStop(0.65, 'rgba(253, 250, 236, 1)');
              core.addColorStop(1, 'rgba(246, 240, 214, 1)');
              ctx.beginPath();
              ctx.arc(ox, py, coreR, 0, Math.PI * 2);
              ctx.fillStyle = core;
              ctx.shadowColor = 'rgba(255, 252, 230, 0.9)';
              ctx.shadowBlur = coreR * 1.6;
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.beginPath();
              ctx.arc(ox, py, Math.max(0.8, coreR * 0.13), 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(122, 118, 112, 0.9)';
              ctx.fill();
            } else if (eye.style === 'pierced') {
              // проколотый: радужка есть, зрачка нет вовсе
              ctx.beginPath();
              ctx.arc(ox, py, irisR, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(96, 78, 66, 0.9)';
              ctx.fill();
              ctx.lineWidth = Math.max(0.7, rr * 0.03);
              ctx.strokeStyle = 'rgba(22, 16, 14, 0.7)';
              ctx.stroke();
            } else {
              const beat = eye.style === 'beacon'
                ? 0.75 + 0.25 * Math.sin(now * 0.004)
                : 1;
              if (eye.style === 'beacon') {
                ctx.shadowColor = `rgba(214, 40, 34, ${0.5 + beat * 0.4})`;
                ctx.shadowBlur = irisR * 2.4 * beat;
              }
              ctx.beginPath();
              ctx.arc(ox, py, irisR * (eye.style === 'beacon' ? beat : 1), 0, Math.PI * 2);
              ctx.fillStyle = eye.style === 'wound'
                ? 'rgba(74, 34, 30, 0.96)'
                : eye.style === 'beacon'
                  ? 'rgba(168, 26, 22, 0.96)'
                  : 'rgba(62, 46, 38, 0.96)';
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.beginPath();
              ctx.arc(ox, py, irisR, 0, Math.PI * 2);
              ctx.lineWidth = Math.max(0.7, rr * 0.035);
              ctx.strokeStyle = 'rgba(22, 16, 14, 0.75)';
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(ox, py, irisR * 0.48 * shrink, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(6, 4, 4, 0.99)';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(ox - irisR * 0.34, py - irisR * 0.38, irisR * 0.22, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
              ctx.fill();
            }
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

        // Проколотый глаз разваливается пополам: половинки расходятся врозь
        if (split > 0.01) {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate((eye.tilt || 0) * RAD);
          ctx.globalAlpha = closeFade;
          const gap = rr * 0.6 * split;
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(0, side * gap);
            ctx.rotate(side * split * 0.25);
            ctx.beginPath();
            if (side < 0) {
              ctx.moveTo(-rr, 0);
              ctx.bezierCurveTo(-rr * 0.45, -ry, rr * 0.45, -ry, rr, 0);
              ctx.lineTo(-rr, 0);
            } else {
              ctx.moveTo(-rr, 0);
              ctx.bezierCurveTo(-rr * 0.5, ry * 0.86, rr * 0.5, ry * 0.86, rr, 0);
              ctx.lineTo(-rr, 0);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(214, 206, 198, 0.95)';
            ctx.fill();
            ctx.lineWidth = Math.max(0.9, rr * 0.06);
            ctx.strokeStyle = 'rgba(20, 15, 14, 0.9)';
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // Повязка живёт своей жизнью: собственный центр, размер и наклон,
        // поэтому её можно поставить ровно туда, где она нарисована
        if (eye.veil && eye.veilPull < 0.99) {
          const vx = (eye.veilX !== undefined ? eye.veilX : eye.x) * width;
          const vy = (eye.veilY !== undefined ? eye.veilY : eye.y) * height;
          const vw = (eye.veilW !== undefined ? eye.veilW : eye.r * 3.4) * width;
          const vh = (eye.veilH !== undefined ? eye.veilH : eye.r * 0.9) * width;
          const shift = eye.veilPull * vw;

          ctx.save();
          ctx.translate(vx + shift, vy - shift * 0.16);
          ctx.rotate(((eye.veilTilt !== undefined ? eye.veilTilt : eye.tilt) || 0) * RAD);
          ctx.rotate(eye.veilPull * 0.28);
          ctx.globalAlpha = closeFade * (1 - eye.veilPull * 0.25);

          const cloth = ctx.createLinearGradient(0, -vh / 2, 0, vh / 2);
          cloth.addColorStop(0, 'rgba(226, 222, 214, 0.98)');
          cloth.addColorStop(0.5, 'rgba(246, 244, 238, 0.99)');
          cloth.addColorStop(1, 'rgba(204, 198, 190, 0.98)');
          ctx.fillStyle = cloth;
          ctx.beginPath();
          ctx.moveTo(-vw / 2, -vh * 0.44);
          ctx.lineTo(vw / 2, -vh * 0.5);
          ctx.lineTo(vw / 2, vh * 0.44);
          ctx.lineTo(-vw / 2, vh * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = Math.max(0.8, vh * 0.06);
          ctx.strokeStyle = 'rgba(140, 132, 124, 0.5)';
          ctx.stroke();
          ctx.restore();
        }
      }

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map, title, manifest, live]);

  if (!map) return null;
  return <canvas ref={canvasRef} className="painting-eyes" />;
}
