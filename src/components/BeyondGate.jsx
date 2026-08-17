import React, { useEffect, useRef, useState } from 'react';
import './BeyondGate.css';
import { createBeyondMusic } from './beyondMusic';

// Дорога за грань. Огонёк — дух: он идёт сам, плавно, по своему пути, и первым
// делом уходит прочь от книги. По дороге стоят слова: он подлетает, освещает
// их, кружит рядом и ждёт. Ты целишься мышью — огонёк бьёт лучом во всю длину
// тьмы. Слово ломается по буквам и с каждым разом держит дольше; из разбитого
// прёт орда, и с каждой волной её больше. В конце — стена, облепленная тварями.

const LIVES = 4;
const SHOT_COOLDOWN = 90;        // бить можно часто
const BEAM_SLACK = 200;           // на столько луч может не долететь до цели
const CAM_SPEED = 4.6;            // как быстро дорога уходит назад
const MARK_STEP = 4200;          // между словами долгая дорога
const TALE_DELAY = 6000;         // сколько идём молча, прежде чем проступит мысль
const TALE_LIFE = 10500;         // сколько мысль держится на экране
const MARK_GATE = TALE_DELAY + TALE_LIFE;  // раньше этого слово из тьмы не выйдет

// Слова дороги и сколько ударов держит каждое: дальше только тяжелее
const MARKS = [
  { text: 'лень', hp: 50 },
  { text: 'страх', hp: 100 },
  { text: 'слабость', hp: 150 },
  { text: 'сомнение', hp: 175 },
  { text: 'отчаяние', hp: 200 },
  // последнее слово и есть стена: на нём висит орда
  { text: 'разочарование', hp: 300, boss: true }
];

// Мысли, что проступают перед каждым словом
export const TALE = [
  'В жизни столько ужасных преград...',
  'И нет ничего сложнее, чем побороть их...',
  'И когда кажется, что мир уже отвернулся от тебя...',
  'Сможешь ли ты победить то, что тебя останавливает?',
  'Сможешь ли ты сделать шаг в неведенье?',
  'Или может бросишь всё на пол пути?'
];

const WALL_GUARDS = 16;

export const BEYOND_WORDS = [
  'Усилия не напрасны',
  'Ещё многое не нарисовано',
  'Но ты уже здесь'
];

export const LOST_WORDS = ['Свет может погаснуть, но не стоит всё бросать'];

export default function BeyondGate({ active, bookRef, onDrift, onComplete, onFail, soundEnabled }) {
  const canvasRef = useRef(null);
  const [alive, setAlive] = useState(false);
  const [words, setWords] = useState(-1);
  const [lost, setLost] = useState(false);
  const [title, setTitle] = useState(false);
  const [tale, setTale] = useState('');
  const [taleOn, setTaleOn] = useState(false);
  const [taleFade, setTaleFade] = useState(false);
  const [taleHigh, setTaleHigh] = useState(true);
  const taleTimers = useRef([]);
  const activeRef = useRef(active);
  const doneRef = useRef(onComplete);
  const failRef = useRef(onFail);
  const driftRef = useRef(onDrift);
  const soundRef = useRef(soundEnabled);
  const musicRef = useRef(null);
  const bookHost = useRef(bookRef);

  useEffect(() => { activeRef.current = active; if (active) setAlive(true); }, [active]);
  useEffect(() => { doneRef.current = onComplete; }, [onComplete]);
  useEffect(() => { failRef.current = onFail; }, [onFail]);
  useEffect(() => { driftRef.current = onDrift; }, [onDrift]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => {
    if (musicRef.current) musicRef.current.setMuted(!soundEnabled);
  }, [soundEnabled]);
  useEffect(() => { bookHost.current = bookRef; }, [bookRef]);
  useEffect(() => () => taleTimers.current.forEach(clearTimeout), []);

  // Мысль показывается сама по себе: появилась, повисела, ушла
  const showTale = React.useCallback((text, high) => {
    if (!text) return;
    taleTimers.current.forEach(clearTimeout);
    setTale(text);
    setTaleHigh(Boolean(high));
    setTaleOn(false);
    setTaleFade(false);
    taleTimers.current = [
      // появление, потом гашение на ходу, и только затем строка снимается
      setTimeout(() => setTaleOn(true), 30),
      setTimeout(() => setTaleFade(true), TALE_LIFE - 2400),
      setTimeout(() => { setTale(''); setTaleOn(false); setTaleFade(false); }, TALE_LIFE)
    ];
  }, []);

  useEffect(() => {
    if (!alive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width = 0, height = 0, frame = null;
    const foes = [];
    const beams = [];
    const sparks = [];
    const marks = [];
    const dust = [];
    const cracks = [];

    const state = {
      phase: 'wake',
      t: 0,
      dark: 0,
      cam: 0,
      speed: 0,
      wave: 0,               // сколько слов уже разбито
      gloom: 0,
      lives: LIVES,
      shotAt: 0,
      firing: false,
      nextFoeAt: 0,
      shakeUntil: 0,
      duel: null,
      orbit: 0,
      tale: null,
      avoid: 0,
      stageAt: 0,
      gateAt: 0,
      dashUntil: 0,
      wallAt: 0,
      wallX: 0,
      wallHp: 90,
      wallHit: 0,
      riftGlow: 0,
      outro: null,
      whiteAt: 0,
      born: null,
      homeX: 0,
      lamp: { x: 0, y: 0, glow: 0, r: 2, hitAt: 0 }
    };
    const mouse = { x: -999, y: -999 };

    // трек собирается на месте и идёт без остановки всю дорогу
    const music = createBeyondMusic();
    musicRef.current = music;
    music.setMuted(!soundRef.current);
    music.start();

    let audio = null;
    const tone = (freq, len, type, level, drop) => {
      if (!soundRef.current) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audio || audio.state === 'closed') {
          audio = (musicRef.current && musicRef.current.context()) || new Ctx();
        }
        if (audio.state !== 'running' && audio.resume) audio.resume();
        const now = audio.currentTime;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (drop) osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * drop), now + len);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(level, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(now);
        osc.stop(now + len + 0.05);
      } catch (err) { /* тишина */ }
    };

    const planMarks = () => {
      marks.length = 0;
      MARKS.forEach((m, i) => {
        marks.push({
          idx: i,
          worldX: 4600 + MARK_STEP * i,
          y: m.boss ? height * 0.5 : (i % 2 === 0 ? height * 0.7 : height * 0.28),
          low: i % 2 === 0,
          text: m.text.toUpperCase(),
          hp: m.hp,
          maxHp: m.hp,
          boss: Boolean(m.boss),
          tale: TALE[i] || '',
          letters: null,
          shown: 0,
          falling: 0,
          hitAt: 0,
          life: 1
        });
      });
      state.wallAt = 4600 + MARK_STEP * MARKS.length;
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
      if (!state.lamp.x) {
        // рождается под книгой, у самого корешка, и оттуда выбирается наружу
        const host = bookHost.current && bookHost.current.current;
        const el = host ? (host.querySelector('.book') || host) : null;
        const box = el ? el.getBoundingClientRect() : null;
        // сидит под правым краем страницы, у самого обреза, и выходит наружу
        state.lamp.x = box ? box.right - 18 : width * 0.6;
        state.lamp.y = box ? box.top + box.height * 0.52 : height * 0.5;
        state.born = { x: state.lamp.x, y: state.lamp.y };
      }
      dust.length = 0;
      for (let i = 0; i < 80; i++) {
        dust.push({ x: Math.random() * width, y: Math.random() * height, r: 0.6 + Math.random() * 1.5, z: 0.4 + Math.random() * 1.6 });
      }
      if (!marks.length) planMarks();
    };

    measure();
    window.addEventListener('resize', measure);
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    const spawnSparks = (x, y, count, force, warm) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = force * (0.3 + Math.random());
        sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, decay: 0.02 + Math.random() * 0.03, warm });
      }
    };

    const makeFoe = (x, y, size, hp) => ({
      x, y,
      r: size,
      hp,
      vx: 0, vy: 0,
      wob: Math.random() * Math.PI * 2,
      lobes: 3 + Math.floor(Math.random() * 3),
      breath: 0.6 + Math.random() * 0.9,
      jumpAt: performance.now() + Math.random() * 500,
      biteAt: 0,
      hitAt: 0,
      speed: 0.85 + Math.random() * 0.5,
      life: 1
    });

    const spawnFoe = (x, y) => {
      const px = x !== undefined ? x : width + 60;
      const py = y !== undefined ? y : Math.random() * height;
      foes.push(makeFoe(px, py, 22 + Math.random() * 20, Math.random() < 0.3 ? 2 : 1));
    };

    // Пуля: маленький сгусток света, летит далеко и гаснет только на излёте
    const shoot = (tx, ty) => {
      const now = performance.now();
      if (now - state.shotAt < SHOT_COOLDOWN) return;
      state.shotAt = now;
      const lamp = state.lamp;
      const a = Math.atan2(ty - lamp.y, tx - lamp.x);
      const aim = Math.hypot(tx - lamp.x, ty - lamp.y);
      const far = Math.hypot(width, height) * 1.3;
      // вылетает от края огонька, а не из его середины
      const muzzle = lamp.r * 3.4 + 8;
      beams.push({
        x: lamp.x + Math.cos(a) * muzzle,
        y: lamp.y + Math.sin(a) * muzzle,
        vx: Math.cos(a) * 19,
        vy: Math.sin(a) * 19,
        // добивает до прицела с запасом и в любом случае уходит за экран
        left: Math.max(aim + BEAM_SLACK, far),
        life: 1
      });
      tone(760, 0.12, 'triangle', 0.05, 0.5);
    };

    const stepBullets = (now) => {
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.x += b.vx;
        b.y += b.vy;
        b.left -= Math.hypot(b.vx, b.vy);
        if (b.left <= 0 || b.x < -300 || b.x > width + 900 || b.y < -300 || b.y > height + 300) {
          beams.splice(i, 1);
          continue;
        }

        // сперва слово: оно стоит поперёк дороги и закрывает собой всё
        let spent = false;
        for (const m of marks) {
          if (m.life <= 0 || m.falling || !m.letters) continue;
          const sx = m.worldX - state.cam;
          if (Math.abs(sx - b.x) > m.halfWidth) continue;
          if (Math.abs(m.y - b.y) > (m.halfHeight || m.size * 0.42)) continue;
          m.hp -= 1;
          m.hitAt = now;
          const l = m.letters[Math.floor(Math.random() * m.letters.length)];
          l.dx += (Math.random() - 0.5) * 18;
          l.dy += (Math.random() - 0.5) * 14;
          l.rot += (Math.random() - 0.5) * 0.34;
          spawnSparks(b.x, b.y, 9, 3.6, false);
          tone(340 - (1 - m.hp / m.maxHp) * 150, 0.2, 'square', 0.05, 0.5);

          if (m.hp <= 0) {
            m.falling = 0.001;
            for (const ll of m.letters) { ll.vy = -2 - Math.random() * 5; ll.vr = (Math.random() - 0.5) * 0.3; }
            state.gloom = Math.min(1, state.gloom + 0.2);
            state.wave += 1;
            music.setStage(state.wave);
            state.shakeUntil = now + 340;
            if (!m.boss) tone(62, 1.3, 'sawtooth', 0.15, 0.35);
            const horde = 5 + state.wave * 3;
            for (let k = 0; k < horde; k++) {
              spawnFoe(sx + (Math.random() - 0.5) * 300, m.y + (Math.random() - 0.5) * 280);
            }
          }
          spent = true;
          break;
        }

        // у стены пуля высекает из неё куски: этим её и берут
        if (!spent && state.phase === 'wall' && b.x > state.wallX) {
          state.wallHp -= 1;
          state.wallHit = now;
          spawnSparks(b.x, b.y, 7, 3.2, true);
          if (state.wallHp % 12 === 0) addCrack(b.x, b.y, 90);
          spent = true;
        }

        if (!spent) {
          for (const f of foes) {
            if (f.life <= 0) continue;
            if (Math.hypot(f.x - b.x, f.y - b.y) > f.r * 0.95) continue;
            f.hp -= 1;
            f.hitAt = now;
            f.r *= 0.84;
            spawnSparks(b.x, b.y, 8, 3.4, false);
            if (f.hp <= 0) {
              f.life = 0;
              spawnSparks(f.x, f.y, 20, 5.2, false);
              tone(210, 0.45, 'triangle', 0.07, 0.3);
            }
            spent = true;
            break;
          }
        }

        if (spent) beams.splice(i, 1);
      }
    };

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      // кнопку держат — свет бьёт очередью, пока её не отпустят
      state.firing = true;
      if (state.phase === 'road' || state.phase === 'wall' || state.phase === 'rift') {
        shoot(e.clientX, e.clientY);
      }
    };
    const onUp = () => { state.firing = false; };

    // Читкод для отладки: «]» роняет ближайшее слово, чтобы не идти дорогу заново
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);

    const hurt = () => {
      state.lives -= 1;
      state.lamp.hitAt = performance.now();
      state.shakeUntil = performance.now() + 260;
      tone(80, 0.5, 'sawtooth', 0.12, 0.4);
      if (state.lives <= 0) {
        state.phase = 'lost';
        music.surrender();
        state.t = 0;
        setLost(true);
        tone(38, 3.2, 'sine', 0.12, 0.4);
      }
    };

    const drawLamp = (x, y, glow, r, now) => {
      // с каждым разбитым словом свет становится чуть шире и ярче
      const gain = 1 + state.wave * 0.09;
      r *= gain;
      glow *= 0.78 + state.wave * 0.05;
      const struck = state.lamp.hitAt && now - state.lamp.hitAt < 400;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 9);
      halo.addColorStop(0, `rgba(255, ${struck ? 178 : 232}, ${struck ? 158 : 186}, ${0.6 * glow})`);
      halo.addColorStop(0.3, `rgba(240, 182, 104, ${0.2 * glow})`);
      halo.addColorStop(1, 'rgba(200, 130, 60, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 248, 228, ${0.95 * glow})`;
      ctx.fill();

      // запас света: целые кольца вокруг самого огонька, по одному на жизнь
      for (let i = 0; i < state.lives; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r * 2.8 + i * 6, 0, Math.PI * 2);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `rgba(255, 228, 176, ${0.34 - i * 0.05})`;
        ctx.stroke();
      }
    };

    const drawDark = (holeX, holeY, holeR, level) => {
      const veil = ctx.createRadialGradient(holeX, holeY, holeR * 0.3, holeX, holeY, holeR * 2.4);
      veil.addColorStop(0, `rgba(3, 2, 5, ${Math.max(0, level - 0.84)})`);
      veil.addColorStop(0.45, `rgba(3, 2, 5, ${level * 0.9})`);
      veil.addColorStop(1, `rgba(1, 1, 2, ${level})`);
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, width, height);
    };

    const drawFoe = (f, now) => {
      const sp = Math.hypot(f.vx, f.vy);
      const stretch = 1 + Math.min(0.7, sp * 0.12);
      const dirA = Math.atan2(f.vy, f.vx);
      const struck = f.hitAt && now - f.hitAt < 160 ? 1 - (now - f.hitAt) / 160 : 0;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(dirA);
      ctx.scale(stretch, 1 / stretch);
      ctx.beginPath();
      const steps = 24;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const wobble =
          Math.sin(a * f.lobes + f.wob) * 0.16 +
          Math.sin(a * (f.lobes + 2) - f.wob * 0.7) * 0.08 +
          Math.sin(now * 0.002 * f.breath + a * 2) * 0.06;
        const rr = f.r * (0.78 + wobble);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const body = ctx.createRadialGradient(0, -f.r * 0.2, f.r * 0.1, 0, 0, f.r);
      body.addColorStop(0, `rgba(${24 + struck * 160}, ${18 + struck * 140}, ${34 + struck * 160}, 0.96)`);
      body.addColorStop(0.6, 'rgba(6, 4, 10, 0.96)');
      body.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
      ctx.fillStyle = body;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-f.r * 0.22, -f.r * 0.34, f.r * 0.24, f.r * 0.13, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150, 140, 175, 0.16)';
      ctx.fill();
      ctx.restore();
    };

    // Слово: буквы живут отдельно, поэтому их можно расшатать и уронить
    const prepareMark = (m) => {
      if (m.boss) {
        // разочарование стоит стеной: буква под буквой, во всю высоту дороги
        const size = Math.min(Math.round((height * 0.94) / m.text.length), Math.round(height * 0.1));
        ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
        const step = size * 1.02;
        const total = step * m.text.length;
        let y = -total / 2 + step / 2;
        m.letters = [];
        for (const ch of m.text) {
          m.letters.push({ ch, x: 0, y, w: ctx.measureText(ch).width, dx: 0, dy: 0, rot: 0, vy: 0, vr: 0 });
          y += step;
        }
        m.size = size;
        m.halfWidth = size * 0.66;
        m.halfHeight = total / 2;
        return;
      }
      const size = Math.round(height * 0.085);
      ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
      const total = ctx.measureText(m.text).width;
      let x = -total / 2;
      m.letters = [];
      for (const ch of m.text) {
        const w = ctx.measureText(ch).width;
        m.letters.push({ ch, x: x + w / 2, y: 0, w, dx: 0, dy: 0, rot: 0, vy: 0, vr: 0 });
        x += w;
      }
      m.size = size;
      m.halfWidth = total / 2 + size * 0.2;
      m.halfHeight = size * 0.42;
    };

    const drawMark = (m, sx, now) => {
      if (!m.letters) prepareMark(m);
      const near = Math.abs(sx - state.lamp.x) < width * 0.6;
      m.shown += ((near ? 1 : 0.1) - m.shown) * 0.012;

      ctx.save();
      ctx.font = `700 ${m.size}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const wear = 1 - m.hp / m.maxHp;

      // за буквами стены стоит тёмная плита: сквозь неё и пробивается свет
      if (m.boss && !m.falling) {
        const half = m.halfWidth * 1.5;
        const slab = ctx.createLinearGradient(sx - half, 0, sx + half, 0);
        slab.addColorStop(0, 'rgba(6, 4, 9, 0)');
        slab.addColorStop(0.5, `rgba(9, 6, 12, ${0.94 * m.shown})`);
        slab.addColorStop(1, 'rgba(6, 4, 9, 0)');
        ctx.fillStyle = slab;
        ctx.fillRect(sx - half, 0, half * 2, height);
      }

      for (const l of m.letters) {
        if (m.falling) {
          l.vy += 0.9;
          l.dy += l.vy;
          l.rot += l.vr;
        }
        ctx.save();
        ctx.translate(sx + l.x + l.dx, m.y + (l.y || 0) + l.dy);
        ctx.rotate(l.rot);
        const shine = m.hitAt && now - m.hitAt < 140 ? 1 - (now - m.hitAt) / 140 : 0;
        // буква дышит и подрагивает: слово недоброе и живое
        const tremble = m.falling ? 0 : Math.sin(now * 0.006 + l.x) * 1.4;
        ctx.translate(tremble, Math.cos(now * 0.005 + l.x) * 1.2);
        ctx.fillStyle = `rgba(${74 + shine * 150 + wear * 60}, ${18 + shine * 120}, ${24 + shine * 130}, ${0.92 * m.shown * m.life})`;
        ctx.shadowColor = 'rgba(120, 10, 14, 0.5)';
        ctx.shadowBlur = 26;
        ctx.fillText(l.ch, 0, 0);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(12, 8, 10, ${0.7 * m.shown * m.life})`;
        ctx.strokeText(l.ch, 0, 0);
        ctx.restore();
      }
      ctx.restore();

      if (m.falling) {
        m.falling += 1 / 40;
        m.life = Math.max(0, 1 - m.falling / 1.6);
      }
    };

    // Свет за стеной: разгорается ступенями, по мере того как её ломают
    const drawRift = (level, now) => {
      if (level <= 0.002) return;
      const w = width * (0.05 + level * 0.3);
      const pulse = 0.9 + Math.sin(now * 0.0018) * 0.1;
      const g = ctx.createLinearGradient(width - w, 0, width, 0);
      g.addColorStop(0, 'rgba(236, 232, 226, 0)');
      g.addColorStop(0.5, `rgba(236, 232, 226, ${0.14 * level * pulse})`);
      g.addColorStop(1, `rgba(242, 238, 232, ${0.66 * level * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(width - w, 0, w, height);
    };

    // Мысль живёт в разметке поверх сцены: холст её больше не съедает.
    // Здесь только срок жизни: отжила — гаснет
    const drawTale = (now) => {
      if (!state.tale) return;
      if (now - state.tale.born > TALE_LIFE) state.tale = null;
    };

    const drawWall = (fade, now) => {
      const x = state.wallX;
      const struck = state.wallHit && now - state.wallHit < 160 ? 1 - (now - state.wallHit) / 160 : 0;
      ctx.save();
      ctx.globalAlpha = fade;

      // лицевая плита
      const face = ctx.createLinearGradient(x, 0, width + 200, 0);
      face.addColorStop(0, `rgba(${26 + struck * 60}, ${24 + struck * 50}, ${32 + struck * 60}, 1)`);
      face.addColorStop(0.35, 'rgba(16, 14, 20, 1)');
      face.addColorStop(1, 'rgba(8, 7, 11, 1)');
      ctx.fillStyle = face;
      ctx.fillRect(x, 0, width - x + 200, height);

      // скошенная кромка: по ней и читается толщина
      const edge = ctx.createLinearGradient(x - 26, 0, x + 8, 0);
      edge.addColorStop(0, 'rgba(4, 3, 6, 0)');
      edge.addColorStop(0.6, 'rgba(38, 34, 46, 0.9)');
      edge.addColorStop(1, `rgba(${86 + struck * 90}, ${80 + struck * 70}, ${98 + struck * 80}, 0.95)`);
      ctx.fillStyle = edge;
      ctx.fillRect(x - 26, 0, 34, height);

      // швы кладки: горизонтальные борозды в глубину
      ctx.strokeStyle = 'rgba(52, 48, 60, 0.35)';
      ctx.lineWidth = 1.4;
      for (let y = height * 0.08; y < height; y += height * 0.14) {
        ctx.beginPath();
        ctx.moveTo(x + 6, y);
        ctx.lineTo(width + 200, y + 12);
        ctx.stroke();
      }

      // сколько ещё держится: полоса на самой плите
      const left = Math.max(0, state.wallHp) / 90;
      ctx.fillStyle = 'rgba(255, 226, 176, 0.5)';
      ctx.fillRect(x + 30, height * 0.5 - 2, (width - x - 90) * left, 4);

      ctx.restore();
    };

    const addCrack = (x, y, len) => {
      const pts = [{ x, y }];
      let a = (Math.random() - 0.5) * Math.PI * 2;
      let cx = x, cy = y;
      for (let i = 0; i < 6; i++) {
        a += (Math.random() - 0.5) * 1.1;
        cx += Math.cos(a) * (len / 6);
        cy += Math.sin(a) * (len / 6);
        pts.push({ x: cx, y: cy });
      }
      cracks.push({ pts, born: performance.now() });
    };

    const drawCracks = (now, glowLevel) => {
      ctx.save();
      ctx.lineCap = 'round';
      for (const crack of cracks) {
        const age = Math.min(1, (now - crack.born) / 260);
        ctx.beginPath();
        const upTo = Math.max(1, Math.floor(crack.pts.length * age));
        for (let i = 0; i < upTo; i++) {
          const p = crack.pts[i];
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = `rgba(255, 238, 206, ${0.5 * glowLevel})`;
        ctx.shadowColor = 'rgba(255, 216, 152, 0.8)';
        ctx.shadowBlur = 12 * glowLevel;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawBeams = () => {
      ctx.save();
      ctx.lineCap = 'round';
      for (const b of beams) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 244, 214, 0.9)';
        ctx.shadowColor = 'rgba(255, 214, 150, 0.9)';
        ctx.shadowBlur = 14;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSparks = () => {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy;
        s.vy += 0.24;
        s.vx *= 0.98;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.warm ? 'rgba(255, 214, 150, 1)' : 'rgba(206, 200, 224, 1)';
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

      ctx.clearRect(0, 0, width, height);
      const lamp = state.lamp;
      const shake = now < state.shakeUntil ? (Math.random() - 0.5) * 8 : 0;
      ctx.save();
      ctx.translate(shake, shake * 0.4);

      if (state.phase === 'wake') {
        state.t += 1 / 40;
        state.dark = Math.min(1, state.dark + 0.009);
        // сперва выбирается из-под страницы: свет пробивается из щели наружу
        const out = Math.min(1, state.t / 1.5);
        lamp.glow = Math.min(1, out * 0.85 + Math.max(0, state.t - 1.5) * 0.12);
        lamp.r = 1.4 + lamp.glow * 5;
        if (state.born && state.t < 1.8) {
          // выползает из-за края листа вбок, а потом уходит вверх и вправо
          const crawl = Math.min(1, state.t / 1.8);
          lamp.x = state.born.x + Math.pow(crawl, 1.3) * width * 0.1;
          lamp.y = state.born.y - Math.pow(crawl, 2) * height * 0.1;
        } else {
          // выбравшись, он никуда не возвращается: чуть тянется вперёд
          lamp.x += (Math.max(width * 0.45, state.born ? state.born.x + width * 0.12 : width * 0.45) - lamp.x) * 0.01;
          lamp.y += (height * 0.5 - lamp.y) * 0.014;
        }
        // книга остаётся позади сразу: смотреть надо на свет
        // книга уезжает, когда огонёк уже выбрался наружу
        if (driftRef.current) driftRef.current(Math.max(0, Math.min(1, (state.t - 1.4) / 1.8)));
        drawDark(lamp.x, lamp.y, 110 + lamp.glow * 90, state.dark);
        drawLamp(lamp.x, lamp.y, lamp.glow, lamp.r, now);
        if (state.t > 2.4 && state.dark >= 1) {
          state.phase = 'road';
          state.t = 0;
          // где вылетел, там и его место: назад его не тянет
          state.homeX = Math.min(width * 0.55, Math.max(width * 0.3, lamp.x));
          state.nextFoeAt = now + 3200;
          state.stageAt = now;
          state.gateAt = now + MARK_GATE;
          tone(46, 3, 'sine', 0.07, 0.6);
        }
      } else if (state.phase === 'road' || state.phase === 'wall') {
        const onRoad = state.phase === 'road';
        state.t += 1 / 40;
        // очередь идёт тем же откатом, что и одиночный выстрел
        if (state.firing && mouse.x > -900) shoot(mouse.x, mouse.y);

        // за стеной теплится свет: три ступени, по мере того как её разбивают
        const bossMark = marks.find((one) => one.boss && one.life > 0 && !one.falling);
        let riftWant = 0;
        if (bossMark && state.duel === bossMark) {
          const left = Math.max(0, bossMark.hp) / bossMark.maxHp;
          riftWant = left > 0.66 ? 0.14 : left > 0.33 ? 0.42 : 0.74;
        } else if (!bossMark && state.wave >= MARKS.length) {
          riftWant = 1;
        }
        state.riftGlow += (riftWant - state.riftGlow) * 0.016;
        const duel = state.duel;
        // рывок после разбитого слова: пока он длится, свет неуязвим
        const dash = Boolean(state.dashUntil && now < state.dashUntil);

        // дорога дышит: то чуть быстрее, то чуть медленнее, но всегда плавно
        const wantSpeed = onRoad && !duel ? 1 : 0;
        state.speed += (wantSpeed - state.speed) * 0.012;
        const tempo = (0.78 + Math.sin(state.cam * 0.0004) * 0.22)
          * (dash ? 1.25 : 1);
        state.cam += CAM_SPEED * state.speed * tempo;

        // пока висит мысль, дух отходит на другой край, но не срывается туда:
        // сторона набирается и отпускается за несколько секунд
        let wantAvoid = 0;
        if (state.tale) {
          wantAvoid = state.tale.high ? 1 : -1;
        } else {
          // слово впереди: дух заранее сходит с его высоты, а не влетает в буквы
          const ahead = marks.find((one) => one.life > 0 && !one.falling);
          if (ahead && !ahead.boss && ahead.worldX - state.cam < width * 1.35) {
            wantAvoid = ahead.low ? -1 : 1;
          }
        }
        state.avoid += (wantAvoid - state.avoid) * 0.007;

        // собственный путь духа: две волны, наложенные друг на друга.
        // При отходе середина пути смещается, а размах слегка поджимается
        const swing = 1 - Math.abs(state.avoid) * 0.34;
        let roadY = height * (0.5 + state.avoid * 0.15)
          + Math.sin(state.cam * 0.0016) * height * 0.26 * swing
          + Math.sin(state.cam * 0.0007 + 1.1) * height * 0.12 * swing;

        // огонёк держится на трети экрана слева, а мир едет ему навстречу.
        // У слова он поднимается к середине верха и водит там круги
        if (duel) {
          state.orbit += 0.014;
          // кружит с противоположной стороны от слова: оно внизу — он вверху.
          // Перед стеной ходить некуда вбок, поэтому он мечется вдоль неё
          const ringY = duel.boss ? height * 0.5 : (duel.low ? height * 0.3 : height * 0.7);
          const wantX = (duel.boss ? width * 0.33 : width * 0.44)
            + Math.cos(state.orbit) * width * (duel.boss ? 0.045 : 0.11);
          const wantY = ringY + Math.sin(state.orbit) * height * (duel.boss ? 0.19 : 0.09);
          lamp.x += (wantX - lamp.x) * 0.014;
          lamp.y += (wantY - lamp.y) * 0.014;
        } else {
          lamp.x += ((state.homeX || width * 0.33) - lamp.x) * 0.006;
          lamp.y += (roadY - lamp.y) * 0.016;
        }

        if (onRoad && now > state.nextFoeAt) {
          // из-за стены лезут без остановки: её держат, пока есть кому лезть
          const atWall = Boolean(duel && duel.boss);
          const pack = atWall ? 2 + Math.floor(state.wave * 0.22) : 1 + Math.floor(state.wave * 0.7);
          for (let i = 0; i < pack; i++) {
            if (atWall) {
              spawnFoe(duel.worldX - state.cam + 30 + Math.random() * width * 0.16, Math.random() * height);
            } else {
              spawnFoe();
            }
          }
          state.nextFoeAt = now + (atWall ? 1600 : Math.max(900, 3400 - state.wave * 400 - state.gloom * 700));
        }

        for (const d2 of dust) {
          d2.x -= CAM_SPEED * state.speed * d2.z * 0.7;
          if (d2.x < -20) { d2.x = width + 20; d2.y = Math.random() * height; }
        }

        for (let i = foes.length - 1; i >= 0; i--) {
          const f = foes[i];
          if (f.life <= 0) { foes.splice(i, 1); continue; }

          if (f.stuck) {
            // висит на слове и лениво шевелится вместе с ним
            f.wob += 0.03;
            const base = f.host ? f.host.worldX - state.cam + f.offX : f.homeX;
            f.x = base + Math.sin(f.wob) * 6;
            f.y = f.homeY + Math.cos(f.wob * 0.8) * 5;
            if (f.host && f.host.life <= 0) f.life = 0;
            continue;
          }

          const dx = lamp.x - f.x, dy = lamp.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          f.wob += 0.06;
          if (now > f.jumpAt) {
            const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
            const power = f.speed * (2.2 + state.gloom * 1.6);
            f.vx += Math.cos(a) * power;
            f.vy += Math.sin(a) * power;
            f.jumpAt = now + 440 + Math.random() * 460;
          }
          // на рывке мир уносит тварей назад заметно быстрее
          f.x += f.vx - CAM_SPEED * state.speed * (dash ? 0.9 : 0.5);
          f.y += f.vy;
          f.vx *= 0.9; f.vy *= 0.9;

          if (!dash && d < f.r * 0.7 + 14 && now - f.biteAt > 800) {
            f.biteAt = now;
            spawnSparks(lamp.x, lamp.y, 12, 3.4, true);
            hurt();
          }
          if (f.x < -180) foes.splice(i, 1);
        }

        // подошли к слову: дух тормозит и остаётся рядом, пока оно стоит
        if (onRoad && !duel) {
          // на дороге разбирают только ближайшее слово, остальные ждут своей очереди
          const m = marks.find((one) => one.life > 0 && !one.falling);
          if (m) {
            // пока мысль не отговорила своё, слово держат за краем экрана:
            // сперва молчаливая дорога, затем строка, и лишь потом преграда
            if (now < state.gateAt && m.worldX - state.cam < width * 1.5) {
              m.worldX = state.cam + width * 1.5;
            }
            if (!m.told && now - state.stageAt > TALE_DELAY) {
              m.told = true;
              const high = m.idx % 2 === 0;
              state.tale = { text: m.tale, born: now, high };
              // соседние мысли встают по-разному: одна поверху, другая понизу
              showTale(m.tale, high);
            }
            const sx = m.worldX - state.cam;
            if (!m.letters) prepareMark(m);
            // считается ближний край слова: чем оно длиннее, тем дальше встанет
            const edge = sx - (m.boss ? 0 : m.halfWidth || 0);
            // стена стоит дальше обычных слов: почти у самого края дороги
            if (edge < width * (m.boss ? 0.8 : 0.62)) {
              state.duel = m;
              state.orbit = 0;
              // стена встречает не свитой на буквах, а тем, что лезет из-за неё
              if (m.boss && !m.guarded) {
                m.guarded = true;
                state.nextFoeAt = now + 600;
                tone(48, 2.6, 'sine', 0.1, 0.5);
              }
            }
          }
        }
        if (duel && duel.falling) {
          const wasBoss = duel.boss;
          state.duel = null;
          // отсчёт следующего этапа идёт от победы, а не от места на дороге
          state.stageAt = now;
          state.gateAt = now + MARK_GATE;
          if (wasBoss) {
            // стена пала: пролом разгорается во всю ширь, и свет идёт к нему
            state.phase = 'rift';
            state.t = 0;
            music.triumph();
          }
          // рывок вперёд: уцелевшие остаются позади, а свет не лезет в толпу
          state.dashUntil = now + 2600;

        }

        const hole = (230 - state.gloom * 60) * (0.6 + lamp.glow * 0.4);
        drawDark(lamp.x, lamp.y, hole, 1);

        for (const d2 of dust) {
          const dd = Math.hypot(d2.x - lamp.x, d2.y - lamp.y);
          if (dd > hole * 1.6) continue;
          ctx.globalAlpha = Math.max(0, 1 - dd / (hole * 1.6)) * 0.45;
          ctx.fillStyle = 'rgba(214, 200, 226, 0.8)';
          ctx.fillRect(d2.x, d2.y, d2.r, d2.r);
        }
        ctx.globalAlpha = 1;

        drawTale(now);
        drawRift(state.riftGlow, now);

        for (let i = marks.length - 1; i >= 0; i--) {
          const m = marks[i];
          if (m.life <= 0) { marks.splice(i, 1); continue; }
          drawMark(m, m.worldX - state.cam, now);
        }

        if (!onRoad) { drawWall(1, now); drawCracks(now, 1); }
        for (const f of foes) drawFoe(f, now);
        stepBullets(now);
        drawBeams();
        drawLamp(lamp.x, lamp.y, lamp.glow, lamp.r, now);
        drawSparks();

        if (false && onRoad && !duel && state.cam >= state.wallAt) {
          state.phase = 'wall';
          state.wallX = width * 0.62;
          state.wallHp = 90;
          foes.length = 0;
          // на стене висит орда: они не нападают, а просто облепили её
          for (let i = 0; i < WALL_GUARDS; i++) {
            const f = makeFoe(
              state.wallX + 30 + Math.random() * width * 0.3,
              height * (0.05 + (i / WALL_GUARDS) * 0.9),
              24 + Math.random() * 22,
              2
            );
            f.stuck = true;
            f.homeX = f.x;
            f.homeY = f.y;
            foes.push(f);
          }
          tone(52, 2.4, 'sine', 0.1, 0.5);
        }

        if (!onRoad && state.wallHp <= 0) {
          state.phase = 'break';
          state.t = 0;
          for (let i = 0; i < 10; i++) addCrack(state.wallX + Math.random() * 120, height * Math.random(), 170);
          tone(58, 1.8, 'sawtooth', 0.16, 0.3);
        }
      } else if (state.phase === 'rift') {
        state.t += 1 / 40;
        if (state.firing && mouse.x > -900) shoot(mouse.x, mouse.y);
        // пролом разгорелся во всю ширь и тянет к себе
        state.riftGlow += (1 - state.riftGlow) * 0.02;
        lamp.x += (width * 0.8 - lamp.x) * 0.012;
        lamp.y += (height * 0.5 - lamp.y) * 0.02;

        // орда гонится следом, но тронуть его уже не успевает
        for (let i = foes.length - 1; i >= 0; i--) {
          const f = foes[i];
          if (f.life <= 0) { foes.splice(i, 1); continue; }
          f.stuck = false;
          const dx = lamp.x - f.x, dy = lamp.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          f.wob += 0.06;
          f.x += (dx / d) * 1.7 - 1.4;
          f.y += (dy / d) * 1.7;
          if (f.x < -180) foes.splice(i, 1);
        }

        drawDark(lamp.x, lamp.y, 230 + state.riftGlow * 130, 1);
        drawRift(state.riftGlow, now);
        for (const f of foes) drawFoe(f, now);
        stepBullets(now);
        drawBeams();
        drawLamp(lamp.x, lamp.y, 1, lamp.r, now);
        drawSparks();

        if (state.t > 4.4) { state.phase = 'break'; state.t = 0; foes.length = 0; }
      } else if (state.phase === 'break') {
        state.t += 1 / 40;
        const t = Math.min(1, state.t / 3.4);
        const ease = t * t * (3 - 2 * t);

        // ход тот же, что и в проломе: ни скорость, ни цель не меняются
        lamp.x += (width * 0.8 - lamp.x) * 0.012;
        lamp.y += (height * 0.5 - lamp.y) * 0.02;
        drawDark(lamp.x, lamp.y, 340 + ease * 620, 1 - ease * 0.85);
        drawRift(1, now);
        drawLamp(lamp.x, lamp.y, 1, lamp.r * (1 + ease * 1.4), now);
        drawSparks();

        // белизна поднимается ровно по всему экрану, без бегущего края
        ctx.fillStyle = `rgba(238, 234, 228, ${ease})`;
        ctx.fillRect(0, 0, width, height);

        if (t >= 1) {
          state.phase = 'white';
          state.t = 0;
          // расписание ударов задаёт музыка, надписи встают под них.
          // Время здесь считается по часам, а не по кадрам: иначе на медленной
          // машине надписи отстают от рояля
          state.whiteAt = now;
          state.outro = music.outro();
        }
      } else if (state.phase === 'white') {
        ctx.fillStyle = 'rgb(238, 234, 228)';
        ctx.fillRect(0, 0, width, height);
        state.t += 1 / 40;
        const beats = (state.outro && state.outro.beats) || [0, 4.9, 9.8, 14.7, 19.6];
        const total = (state.outro && state.outro.total) || 26.6;
        const since = (now - state.whiteAt) / 1000;
        if (since > beats[1] && words < 0) setWords(0);
        if (since > beats[2] && words < 1) setWords(1);
        if (since > beats[3] && words < 2) setWords(2);
        if (since > beats[4] && !title) { setWords(-1); setTitle(true); }
        if (since > total) {
          state.phase = 'done';
          state.t = 0;
          setTitle(false);
          if (driftRef.current) driftRef.current(0);
          if (doneRef.current) doneRef.current();
        }
      } else if (state.phase === 'lost') {
        state.t += 1 / 40;
        const t = Math.min(1, state.t / 1.8);
        lamp.glow = Math.max(0, 1 - t);
        for (const f of foes) drawFoe(f, now);
        drawDark(lamp.x, lamp.y, Math.max(4, 190 * (1 - t)), 1);
        drawLamp(lamp.x, lamp.y, lamp.glow * 0.6, lamp.r * (1 - t * 0.6), now);
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, t - 0.3) * 1.6})`;
        ctx.fillRect(0, 0, width, height);
        if (state.t > 7.5) {
          setLost(false);
          if (failRef.current) failRef.current();
          ctx.restore();
          setAlive(false);
          return;
        }
      } else if (state.phase === 'done') {
        state.t += 1 / 40;
        const t = Math.min(1, state.t / 2.4);
        ctx.fillStyle = `rgba(238, 234, 228, ${1 - t})`;
        ctx.fillRect(0, 0, width, height);
        if (t >= 1) { ctx.restore(); setAlive(false); return; }
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
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      music.stop(1.6);
      if (musicRef.current === music) musicRef.current = null;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [alive]);

  if (!alive) return null;
  return (
    <>
      <canvas ref={canvasRef} className="beyond-gate" />
      {tale && (
        <div className={`beyond-tale ${taleHigh ? 'high' : 'low'} ${taleOn ? 'on' : ''} ${taleFade ? 'fade' : ''}`}>{tale}</div>
      )}
      {words >= 0 && <div className="beyond-words" key={`w${words}`}>{BEYOND_WORDS[words]}</div>}
      {lost && <div className="beyond-lost">{LOST_WORDS[0]}</div>}
      {title && <div className="beyond-title">ЗА ГРАНЬЮ</div>}
    </>
  );
}
