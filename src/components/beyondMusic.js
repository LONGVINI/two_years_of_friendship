// Музыка дороги за грань. Играет один рояль: файла с треком нет, каждая нота
// собирается на месте из гармоник с собственным затуханием, поэтому музыка
// никогда не повторяется буквально и не имеет шва петли. Сперва — одинокая
// тема в верхнем регистре и долгие паузы; с каждым сломанным словом прибывает
// то бас, то бегущие фигуры, то аккорды в обе руки. Когда стена падает, лад
// разворачивается в мажор, и вместо натиска остаётся простор.

const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Ля минор: тоника, шестая, третья, пятая. Ход старый и держит печаль
const DARK = [
  { bass: 45, chord: [57, 60, 64] },
  { bass: 41, chord: [53, 57, 60] },
  { bass: 48, chord: [55, 60, 64] },
  { bass: 43, chord: [55, 59, 62] }
];

// То же место при свете. Не победа: широкие мягкие созвучия с секундой и
// большой септимой — светло, но с печалью, потому что дорога уже позади
const LIGHT = [
  { bass: 45, chord: [60, 64, 71] },
  { bass: 41, chord: [57, 60, 64] },
  { bass: 48, chord: [59, 64, 67] },
  { bass: 43, chord: [59, 62, 67] }
];

const DARK_TUNE = [69, 72, 74, 76, 79, 81, 84];
const LIGHT_TUNE = [69, 71, 72, 76, 79, 81, 83];

// Ступени: что играют руки, насколько громко и в каком темпе
const STAGES = [
  { tune: 0.5, bass: 0.0, run: 0.0, chords: 0.0, level: 0.5, bpm: 46 },
  { tune: 0.7, bass: 0.7, run: 0.0, chords: 0.0, level: 0.6, bpm: 50 },
  { tune: 0.9, bass: 0.8, run: 0.5, chords: 0.0, level: 0.7, bpm: 54 },
  { tune: 1.0, bass: 0.9, run: 0.7, chords: 0.5, level: 0.8, bpm: 58 },
  { tune: 1.0, bass: 1.0, run: 0.8, chords: 0.8, level: 0.9, bpm: 62 },
  { tune: 1.0, bass: 1.0, run: 1.0, chords: 1.0, level: 1.0, bpm: 68 }
];

export function createBeyondMusic() {
  let ctx = null;
  let master = null, dry = null, wetGain = null, hall = null;
  let timer = null;
  let step = 0;
  let nextAt = 0;
  let stage = 0;
  let bright = false;
  let running = false;
  let muted = false;
  let tuneAt = 0;
  let ending = false;
  let slow = 0;

  const set = () => STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))];
  const song = () => (bright ? LIGHT : DARK);
  const tune = () => (bright ? LIGHT_TUNE : DARK_TUNE);

  // Зал: затухающий шум вместо записи помещения
  const makeHall = (seconds) => {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const fade = Math.pow(1 - i / len, 2.6);
        data[i] = (Math.random() * 2 - 1) * fade * 0.6;
      }
    }
    return buffer;
  };

  // Одна клавиша: несколько гармоник, каждая со своим затуханием, плюс
  // едва слышный стук молоточка. Верхние обертоны уходят раньше нижних
  const key = (note, at, level, hold) => {
    if (!ctx || level <= 0.001) return;
    const freq = MIDI(note);
    const parts = [
      { mult: 1, gain: 1, decay: 1 },
      { mult: 2, gain: 0.38, decay: 0.66 },
      { mult: 3, gain: 0.19, decay: 0.48 },
      { mult: 4, gain: 0.1, decay: 0.36 },
      { mult: 6, gain: 0.05, decay: 0.24 }
    ];
    for (const part of parts) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // струна не идеальна: верхние обертоны стоят чуть выше кратных
      osc.frequency.setValueAtTime(freq * part.mult * (1 + 0.0004 * part.mult * part.mult), at);
      const peak = Math.max(0.0002, level * part.gain);
      const life = Math.max(0.25, hold * part.decay);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + life);
      osc.connect(gain);
      gain.connect(dry);
      gain.connect(wetGain);
      osc.start(at);
      osc.stop(at + life + 0.08);
    }
  };

  const ramp = (param, value, time) => {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(0.0001, param.value), t);
    param.linearRampToValueAtTime(Math.max(0.0001, value), t + time);
  };

  const schedule = () => {
    if (!ctx || !running) return;
    // браузер может усыпить звук при потере фокуса: будим обратно
    if (ctx.state !== 'running' && ctx.resume) {
      try { ctx.resume(); } catch (err) { /* ждём следующего раза */ }
    }
    const s = set();
    const beat = 60 / (slow || s.bpm);
    const ahead = ctx.currentTime + 0.3;
    // если поток отстал (вкладка была в фоне), не догоняем сотнями нот,
    // а просто продолжаем с текущего мгновения
    if (nextAt < ctx.currentTime - 0.6) nextAt = ctx.currentTime + 0.05;

    while (nextAt < ahead) {
      const at = nextAt;
      const bar = Math.floor(step / 8) % song().length;
      const place = song()[bar];
      const inBar = step % 8;
      const power = s.level * (bright ? 0.9 : 1);

      // на исходе руки замолкают: остаётся только тема и последний аккорд
      if (ending && inBar !== 0) {
        nextAt += beat / 2;
        step += 1;
        continue;
      }

      // левая рука: октава в басу, на сильных долях
      if (s.bass > 0 && (inBar === 0 || (stage >= 4 && inBar === 4))) {
        key(place.bass - 12, at, 0.17 * s.bass * power, 5.2);
        key(place.bass, at, 0.13 * s.bass * power, 4.4);
      }

      // аккорд под пальцами: на каждую долю, когда игра уже плотная
      if (s.chords > 0 && inBar % 2 === 0) {
        place.chord.forEach((n, i) => {
          key(n, at + i * 0.012, 0.075 * s.chords * power, 2.6);
        });
      } else if (inBar === 0) {
        // до этого аккорд берётся раз в такт и тянется целиком
        place.chord.forEach((n, i) => {
          key(n, at + i * 0.02, 0.06 * power, 4.6);
        });
      }

      // бегущая фигура в среднем регистре
      if (s.run > 0) {
        const pool = place.chord.concat([place.chord[0] + 12, place.chord[1] + 12]);
        const n = pool[(step * 3 + bar) % pool.length];
        key(n, at, 0.055 * s.run * power, 1.1);
      }

      // тема: сперва редкие одинокие ноты, потом всё чаще
      const every = ending ? 16 : (stage <= 0 ? 8 : stage <= 2 ? 4 : 2);
      if (inBar % every === 0 && at >= tuneAt) {
        const t = tune();
        const n = t[(step * 5 + bar * 3) % t.length];
        key(n, at, 0.13 * s.tune * power, 3.4);
        if (stage >= 3) key(n - 12, at + 0.02, 0.05 * s.tune * power, 2.6);
        tuneAt = at + beat * (stage <= 0 ? 3.4 : 0.4);
      }

      nextAt += beat / 2;
      step += 1;
    }
  };

  return {
    start() {
      if (running) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ctx = new Ctx();
        if (ctx.state === 'suspended') ctx.resume();

        // сжатие на выходе: когда бьют аккордом, сумма голосов не должна
        // выходить за единицу, иначе вместо рояля слышен хрип
        const guard = ctx.createDynamicsCompressor();
        guard.threshold.setValueAtTime(-6, ctx.currentTime);
        guard.knee.setValueAtTime(14, ctx.currentTime);
        guard.ratio.setValueAtTime(3, ctx.currentTime);
        guard.attack.setValueAtTime(0.005, ctx.currentTime);
        guard.release.setValueAtTime(0.45, ctx.currentTime);
        guard.connect(ctx.destination);

        master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.connect(guard);

        dry = ctx.createGain();
        dry.gain.setValueAtTime(0.8, ctx.currentTime);
        dry.connect(master);

        hall = ctx.createConvolver();
        hall.buffer = makeHall(2.8);
        hall.connect(master);

        wetGain = ctx.createGain();
        wetGain.gain.setValueAtTime(0.3, ctx.currentTime);
        wetGain.connect(hall);

        step = 0;
        stage = 0;
        bright = false;
        nextAt = ctx.currentTime + 0.2;
        tuneAt = 0;
        running = true;
        ramp(master.gain, muted ? 0.0001 : 0.5, 4);
        timer = setInterval(() => {
        try {
          schedule();
        } catch (err) {
          // пропускаем сбойный такт и играем дальше
          if (ctx) nextAt = ctx.currentTime + 0.1;
        }
      }, 30);
      } catch (err) {
        running = false;
      }
    },

    // Сколько слов сломано, столько всего и звучит под руками
    setStage(index) {
      if (!running || bright) return;
      stage = index;
    },

    // Стена пала: до мажор, простор и долгое эхо
    triumph() {
      if (!running || bright) return;
      bright = true;
      stage = 1;
      slow = 42;
      const now = ctx.currentTime;
      ramp(wetGain.gain, 0.44, 3);
      ramp(master.gain, muted ? 0.0001 : 0.52, 3);
      // светлая волна вверх, неспешная: не туш, а выдох
      const climb = [57, 60, 64, 69, 71, 72, 76, 79];
      climb.forEach((n, i) => key(n, now + 0.2 + i * 0.24, 0.07, 4.5));
      [45, 57, 64, 71, 76].forEach((n, i) => {
        key(n, now + 2.2 + i * 0.05, 0.08, 7);
      });
    },

    // Заключение. Обычная игра прекращается, и вместо неё звучит расписанная
    // кода: сильная нота, между ними по нескольку тихих, и так пять раз. Под
    // эти удары и подставляются надписи, поэтому расписание отдаётся наружу.
    outro() {
      const gap = 4.9;
      const beats = [0, gap, gap * 2, gap * 3, gap * 4];
      const tail = 7;
      if (!running || ending) return { beats, total: gap * 4 + tail };
      ending = true;
      clearInterval(timer);
      timer = null;

      const now = ctx.currentTime + 0.05;
      const line = bright ? LIGHT : DARK;
      const notes = bright ? LIGHT_TUNE : DARK_TUNE;
      ramp(wetGain.gain, 0.46, 2);

      beats.forEach((offset, i) => {
        // последний удар не берётся вовсе: название главы уводит одна фигура
        if (i === beats.length - 1) return;
        const place = line[i % line.length];
        const at = now + offset;
        // сам удар: бас и аккорд одним нажатием
        key(place.bass - 12, at, 0.11, 7);
        place.chord.forEach((n, k) => key(n, at + 0.02 + k * 0.03, 0.085, 6));
        // и несколько тихих нот в промежутке, ближе к следующему удару
        for (let k = 0; k < 3; k++) {
          const n = notes[(i * 2 + k * 3) % notes.length];
          key(n, at + 1.4 + k * 1.2, 0.055, 3.2);
        }
      });

      // вместо последнего удара — бегущая фигура вверх, ею всё и заканчивается
      const finish = now + beats[beats.length - 1];
      [0, 2, 3, 4, 5, 6].forEach((idx, k) => {
        key(notes[idx % notes.length] + 12, finish + k * 0.3, 0.062, 3.8);
      });

      const last = now + beats[beats.length - 1];
      const level = master.gain.value;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(level, now);
      master.gain.setValueAtTime(level, last + 1.4);
      master.gain.linearRampToValueAtTime(0.0001, last + tail);
      return { beats, total: gap * 4 + tail };
    },

    // Звуки сцены живут в том же контексте, что и рояль: браузеру незачем
    // держать два независимых звуковых движка на одну страницу
    context() {
      return ctx;
    },

    // Свет погас: рояль замолкает
    surrender() {
      if (!running) return;
      stage = 0;
      ramp(master.gain, 0.0001, 2.4);
    },

    setMuted(value) {
      muted = Boolean(value);
      if (!running) return;
      ramp(master.gain, muted ? 0.0001 : (bright ? 0.52 : 0.5), 0.6);
    },

    stop(fade = 2.2) {
      if (!running) return;
      running = false;
      try {
        ramp(master.gain, 0.0001, fade);
        clearInterval(timer);
        timer = null;
        const closing = ctx;
        setTimeout(() => {
          try { if (closing && closing.close) closing.close(); } catch (err) { /* уже закрыт */ }
        }, fade * 1000 + 300);
      } catch (err) { /* тишина */ }
      ctx = null;
    }
  };
}
