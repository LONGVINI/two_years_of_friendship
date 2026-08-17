// Музыка глав. Файлов с треками нет: каждая нота собирается на месте из
// осцилляторов, поэтому петля не имеет шва и весит ноль байт. У каждой главы
// свой голос, свой лад и свой шаг. Круг — четыре такта, и на каждом новом круге
// берётся следующий ритмический рисунок, поэтому повтор не звучит копией.
// На границе глав музыка уходит в тишину и возвращается уже другой.
//
// Тёмная тропа   — звёздная подушка, ход Am7 - Fmaj7 - Cmaj7 - G, редкие
//                  высокие искры: нежно и просторно
// Генезис        — свет, разрастающийся из тьмы: длинные ноты с медленным
//                  открытием фильтра, лидийская кварта. Ничего щипкового,
//                  чтобы не спорить с челестой сада
// Ренессанс      — гул с биением и тритоном, тихий скрип поверху: глава глаз
// Переосмысление — тёплые смычки, мягкий верхний регистр
// За гранью      — светящийся пэд с чистой октавой, ровный пульс. Он же
//                  остаётся на последнем надорванном листе
//
// Громкость держится ниже голоса страниц и звуков сцен: это фон, а не номер

const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);

const BASE_LEVEL = 0.2;

// Круг из четырёх тактов по восемь восьмых
const BAR_STEPS = 8;
const CYCLE_STEPS = 32;

const CHAPTERS = {
  'chapter-1': {
    voice: 'starlight',
    bpm: 42,
    level: 0.62,
    wet: 0.56,
    hold: 6.5,
    bars: [
      { bass: 45, chord: [57, 64, 67] },
      { bass: 41, chord: [57, 60, 64] },
      { bass: 48, chord: [55, 59, 64] },
      { bass: 43, chord: [55, 59, 62] }
    ],
    rhythms: [
      { bass: [0, 16], chord: [0, 16], tune: [[2, 76], [12, 79], [20, 83], [27, 81]] },
      { bass: [0], chord: [0, 8, 24], tune: [[6, 72], [16, 76], [26, 79]] },
      { bass: [0, 16], chord: [0, 16], tune: [[0, 79], [10, 83], [22, 88], [29, 84]] },
      { bass: [0], chord: [0, 12], tune: [[8, 76], [24, 72]] }
    ]
  },

  'chapter-2': {
    voice: 'bloom',
    bpm: 42,
    level: 0.56,
    wet: 0.48,
    hold: 7,
    bars: [
      { bass: 36, chord: [55, 59, 64] },
      { bass: 38, chord: [57, 62, 66] },
      { bass: 41, chord: [57, 60, 65] },
      { bass: 43, chord: [55, 59, 62] }
    ],
    // событий за круг немного: свет прибывает, а не бежит
    rhythms: [
      { bass: [0], chord: [0, 16], tune: [[6, 71], [22, 74]] },
      { bass: [0, 16], chord: [0], tune: [[2, 67], [18, 74]] },
      { bass: [0], chord: [0, 16], tune: [[0, 74], [14, 79]] },
      { bass: [0], chord: [0], tune: [[8, 71], [26, 67]] }
    ]
  },

  'chapter-3': {
    voice: 'dread',
    bpm: 40,
    level: 0.5,
    wet: 0.5,
    hold: 7,
    bars: [
      { bass: 38, chord: [50, 56, 57] },
      { bass: 37, chord: [49, 55, 56] },
      { bass: 38, chord: [50, 53, 56] },
      { bass: 32, chord: [44, 50, 51] }
    ],
    rhythms: [
      { bass: [0, 16], chord: [0, 16], tune: [[7, 68], [21, 63]] },
      { bass: [0], chord: [0, 20], tune: [[13, 69]] },
      { bass: [0, 12, 24], chord: [0], tune: [[5, 75], [18, 74], [29, 68]] },
      { bass: [0], chord: [0, 8], tune: [[26, 62]] }
    ]
  },

  'chapter-4': {
    voice: 'bow',
    bpm: 52,
    level: 0.52,
    wet: 0.46,
    hold: 4.4,
    bars: [
      { bass: 41, chord: [60, 65, 69] },
      { bass: 36, chord: [60, 64, 67] },
      { bass: 38, chord: [57, 62, 65] },
      { bass: 43, chord: [59, 62, 67] }
    ],
    rhythms: [
      { bass: [0, 16], chord: [0, 8, 16, 24], tune: [[0, 72], [10, 74], [18, 77], [27, 72]] },
      { bass: [0, 8, 16, 24], chord: [0, 16], tune: [[4, 69], [14, 72], [24, 76]] },
      { bass: [0], chord: [0, 12, 20], tune: [[2, 77], [12, 76], [22, 72], [30, 70]] },
      { bass: [0, 16], chord: [0, 16], tune: [[6, 74], [16, 79], [26, 74]] }
    ]
  },

  'chapter-interactive': {
    voice: 'glow',
    bpm: 56,
    level: 0.54,
    wet: 0.44,
    hold: 4,
    bars: [
      { bass: 45, chord: [57, 60, 64] },
      { bass: 43, chord: [55, 59, 62] },
      { bass: 41, chord: [53, 57, 60] },
      { bass: 40, chord: [55, 59, 64] }
    ],
    rhythms: [
      { bass: [0, 8, 16, 24], chord: [0, 16], tune: [[0, 76], [8, 79], [16, 81], [24, 79]] },
      { bass: [0, 16], chord: [0, 8, 16, 24], tune: [[2, 72], [12, 76], [22, 79], [30, 84]] },
      { bass: [0, 4, 8, 12, 16, 20, 24, 28], chord: [0], tune: [[6, 81], [18, 79], [28, 76]] },
      { bass: [0, 16], chord: [0, 12, 24], tune: [[0, 84], [10, 81], [20, 79], [26, 76]] }
    ]
  }
};

export function createChapterMusic() {
  let ctx = null;
  let master = null, dry = null, wetGain = null, hall = null;
  let timer = null;
  let running = false;
  let muted = false;
  let ducked = false;
  // Доля от полной громкости: ею правит ползунок под кнопкой музыки
  let volume = 0.5;
  let key = null;          // какая глава звучит сейчас
  let pending = null;      // какая должна зазвучать после затухания
  let swapAt = 0;          // время подмены главы
  let step = 0;
  let nextAt = 0;

  const cfg = () => (key && CHAPTERS[key]) || null;

  // Уровень, до которого поднимается музыка при текущем состоянии
  const wanted = () => {
    if (muted || ducked || !cfg() || volume <= 0.001) return 0.0001;
    return BASE_LEVEL * cfg().level * volume;
  };

  const ramp = (param, value, time) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(0.0001, param.value), t);
    param.linearRampToValueAtTime(Math.max(0.0001, value), t + Math.max(0.01, time));
  };

  // Зал собран из двух задержек с обратной связью и мягким фильтром. Свёртка
  // с длинным шумом звучала бы богаче, но она считается каждый кадр и отнимает
  // столько времени, что рисованное небо главы начинает терять кадры
  const makeTail = () => {
    const input = ctx.createGain();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.9, ctx.currentTime);
    [[0.083, 0.6], [0.131, 0.66]].forEach(([time, feedback]) => {
      const delay = ctx.createDelay(1);
      delay.delayTime.setValueAtTime(time, ctx.currentTime);
      const loop = ctx.createGain();
      loop.gain.setValueAtTime(feedback, ctx.currentTime);
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.setValueAtTime(2400, ctx.currentTime);
      input.connect(delay);
      delay.connect(damp);
      damp.connect(loop);
      loop.connect(delay);
      damp.connect(out);
    });
    return { input, out };
  };

  const send = (node) => {
    node.connect(dry);
    node.connect(wetGain);
  };

  // Медленный вход и долгий выход: общая огибающая мягких голосов
  const swell = (gain, at, peak, life, rise) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + rise);
    gain.gain.setValueAtTime(Math.max(0.0002, peak), at + life * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + life);
  };

  // Один голос главы
  const strike = (voice, note, at, level, hold) => {
    if (!ctx || level <= 0.0004) return;
    const freq = MIDI(note);
    const life = Math.max(0.8, hold);

    if (voice === 'starlight') {
      // подушка из чистых тонов, входящая почти незаметно, и одна высокая
      // искра поверх: свет далёкой звезды, а не удар
      const layers = [
        { mult: 1, gain: 1, rise: life * 0.28 },
        { mult: 2.002, gain: 0.34, rise: life * 0.34 },
        { mult: 2.997, gain: 0.14, rise: life * 0.4 }
      ];
      for (const layer of layers) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * layer.mult, at);
        swell(gain, at, level * layer.gain, life, layer.rise);
        osc.connect(gain);
        send(gain);
        osc.start(at);
        osc.stop(at + life + 0.1);
      }

      // мерцание: тихий верх, входящий позже остальных
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(freq * 6.02, at);
      swell(shimmerGain, at, level * 0.035, life * 0.8, life * 0.45);
      shimmer.connect(shimmerGain);
      send(shimmerGain);
      shimmer.start(at);
      shimmer.stop(at + life);
      return;
    }

    if (voice === 'bloom') {
      // свет, пробивающийся сквозь толщу: фильтр открывается по мере того,
      // как нота набирает силу
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.6, at);
      filter.frequency.setValueAtTime(Math.max(180, freq * 1.1), at);
      filter.frequency.exponentialRampToValueAtTime(Math.min(5200, Math.max(900, freq * 6)), at + life * 0.55);
      const gain = ctx.createGain();
      swell(gain, at, level * 0.55, life, life * 0.3);
      filter.connect(gain);
      send(gain);

      [-9, 9].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, at);
        osc.detune.setValueAtTime(cents, at);
        osc.connect(filter);
        osc.start(at);
        osc.stop(at + life + 0.1);
      });
      return;
    }

    if (voice === 'dread') {
      // низ с биением: две почти одинаковые частоты расходятся волной, и от
      // этого звук будто дышит сам, без всякого ритма
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.Q.setValueAtTime(2.2, at);
      low.frequency.setValueAtTime(Math.max(150, freq * 2.4), at);
      low.frequency.exponentialRampToValueAtTime(Math.max(110, freq * 1.1), at + life * 0.8);
      const body = ctx.createGain();
      swell(body, at, level * 0.6, life, life * 0.18);
      low.connect(body);
      send(body);

      [0, 11].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq / 2, at);
        osc.detune.setValueAtTime(cents, at);
        osc.connect(low);
        osc.start(at);
        osc.stop(at + life + 0.1);
      });

      // скрип поверху: тонкий голос, ползущий по высоте. Слышно с трудом,
      // но именно от него делается не по себе
      const rasp = ctx.createOscillator();
      const raspGain = ctx.createGain();
      rasp.type = 'sine';
      rasp.frequency.setValueAtTime(freq * 8, at);
      rasp.frequency.linearRampToValueAtTime(freq * 8.35, at + life);
      swell(raspGain, at, level * 0.045, life * 0.9, life * 0.35);
      rasp.connect(raspGain);
      send(raspGain);
      rasp.start(at);
      rasp.stop(at + life);
      return;
    }

    if (voice === 'bow') {
      // смычок: звук входит не сразу и держится, слегка качаясь
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(3200, Math.max(700, freq * 4.5)), at);
      const gain = ctx.createGain();
      swell(gain, at, level * 0.72, life, life * 0.3);
      filter.connect(gain);
      send(gain);

      // два голоса чуть врозь: они сами качают звук биением, и отдельная
      // качалка для вибрато уже не нужна
      [-7, 7].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, at);
        osc.detune.setValueAtTime(cents, at);
        osc.connect(filter);
        osc.start(at);
        osc.stop(at + life + 0.1);
      });
      return;
    }

    // glow: тёплый пэд с чистой октавой сверху
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.1, at);
    filter.frequency.setValueAtTime(Math.max(400, freq * 2), at);
    filter.frequency.exponentialRampToValueAtTime(Math.min(4600, Math.max(800, freq * 5)), at + life * 0.35);
    const gain = ctx.createGain();
    swell(gain, at, level * 0.6, life, life * 0.22);
    filter.connect(gain);
    send(gain);

    [-6, 6].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, at);
      osc.detune.setValueAtTime(cents, at);
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + life + 0.1);
    });

    const top = ctx.createOscillator();
    const topGain = ctx.createGain();
    top.type = 'sine';
    top.frequency.setValueAtTime(freq * 2, at);
    swell(topGain, at, level * 0.16, life * 0.85, life * 0.3);
    top.connect(topGain);
    send(topGain);
    top.start(at);
    top.stop(at + life);
  };

  const schedule = () => {
    if (!ctx || !running) return;

    // браузер усыпляет звук при потере фокуса: будим обратно
    if (ctx.state !== 'running' && ctx.resume) {
      try { ctx.resume(); } catch (err) { /* попробуем в следующий раз */ }
    }

    // подмена главы происходит в тишине, между затуханием и подъёмом
    if (pending !== null && ctx.currentTime >= swapAt) {
      key = pending;
      pending = null;
      step = 0;
      nextAt = ctx.currentTime + 0.08;
      if (cfg()) {
        ramp(wetGain.gain, cfg().wet, 1.2);
        ramp(master.gain, wanted(), 2.4);
      }
    }

    const set = cfg();
    if (!set) return;

    const beat = 60 / set.bpm;
    const ahead = ctx.currentTime + 0.4;
    // если поток отстал (вкладка была в фоне), не догоняем сотнями нот
    if (nextAt < ctx.currentTime - 0.8) nextAt = ctx.currentTime + 0.05;

    while (nextAt < ahead) {
      const at = nextAt;
      const cycle = step % CYCLE_STEPS;
      const bar = Math.floor(cycle / BAR_STEPS) % set.bars.length;
      const place = set.bars[bar];
      // каждый круг берёт следующий ритмический рисунок
      const round = Math.floor(step / CYCLE_STEPS);
      const beatMap = set.rhythms[round % set.rhythms.length];

      if (beatMap.bass.includes(cycle)) {
        strike(set.voice, place.bass, at, 0.14, set.hold * 1.1);
      }

      if (beatMap.chord.includes(cycle)) {
        place.chord.forEach((n, i) => {
          strike(set.voice, n, at + i * 0.06, 0.075, set.hold * 0.9);
        });
      }

      for (const [slot, note] of beatMap.tune) {
        if (slot !== cycle) continue;
        strike(set.voice, note, at, 0.11, set.hold * 0.85);
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

        // сжатие на выходе: наплывающие друг на друга ноты не должны
        // складываться за единицу
        const guard = ctx.createDynamicsCompressor();
        guard.threshold.setValueAtTime(-10, ctx.currentTime);
        guard.knee.setValueAtTime(18, ctx.currentTime);
        guard.ratio.setValueAtTime(3.5, ctx.currentTime);
        guard.attack.setValueAtTime(0.008, ctx.currentTime);
        guard.release.setValueAtTime(0.6, ctx.currentTime);
        guard.connect(ctx.destination);

        master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.connect(guard);

        dry = ctx.createGain();
        dry.gain.setValueAtTime(0.78, ctx.currentTime);
        dry.connect(master);

        hall = makeTail();
        hall.out.connect(master);

        wetGain = ctx.createGain();
        wetGain.gain.setValueAtTime(cfg() ? cfg().wet : 0.44, ctx.currentTime);
        wetGain.connect(hall.input);

        step = 0;
        nextAt = ctx.currentTime + 0.25;
        running = true;
        // музыка входит не сразу: первые такты набирают силу медленно
        ramp(master.gain, wanted(), 6);

        timer = setInterval(() => {
          try {
            schedule();
          } catch (err) {
            // пропускаем сбойный такт и играем дальше
            if (ctx) nextAt = ctx.currentTime + 0.1;
          }
        }, 40);
      } catch (err) {
        running = false;
      }
    },

    // Какая глава звучит. Значение вне списка и null означают тишину:
    // на обложке музыке нечего играть
    setChapter(id) {
      const next = id && CHAPTERS[id] ? id : null;
      if (next === key && pending === null) return;
      if (!running) {
        key = next;
        step = 0;
        return;
      }
      if (next === null) {
        key = null;
        pending = null;
        ramp(master.gain, 0.0001, 1.6);
        return;
      }
      // старая глава уходит в тишину, новая поднимается уже на своём ладу
      pending = next;
      const fade = key ? 1.3 : 0.2;
      swapAt = ctx.currentTime + fade;
      ramp(master.gain, 0.0001, fade);
    },

    setMuted(value) {
      muted = Boolean(value);
      if (!running || pending !== null) return;
      ramp(master.gain, wanted(), muted ? 0.8 : 2.2);
    },

    // Ползунок громкости: доля от 0 до 1. Слышно сразу, но без щелчка
    setVolume(part) {
      const next = Number(part);
      volume = Math.max(0, Math.min(1, Number.isFinite(next) ? next : volume));
      if (!running || pending !== null) return;
      ramp(master.gain, wanted(), 0.3);
    },

    // Во время сцены за гранью играет свой рояль: главам полагается замолчать
    setDucked(value) {
      ducked = Boolean(value);
      if (!running || pending !== null) return;
      ramp(master.gain, wanted(), ducked ? 1 : 2.6);
    },

    stop(fade = 1.6) {
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
