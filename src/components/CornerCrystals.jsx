import React, { useMemo } from 'react';
import './CornerCrystals.css';

// В Генезисе работы держатся не скотчем, а самоцветами: по одному на угол.
// Вытянутые ложатся поперёк угла, как обрывок ленты; округлым наклон не идёт,
// они просто лежат на уголке почти прямо. Оттенок hue нужен, чтобы на одной
// работе не оказалось двух камней одного цвета (-1 — бесцветный, белый).
const GEMS = [
  { file: 'diamond_gem_1.png', long: false, hue: -1.0 },
  { file: 'diamond_gem_2.png', long: false, hue: 218.8 },
  { file: 'gem_000.png', long: false, hue: 34.8 },
  { file: 'gem_002.png', long: false, hue: 219.2 },
  { file: 'gem_003.png', long: false, hue: 155.3 },
  { file: 'gem_004.png', long: false, hue: 37.8 },
  { file: 'gem_008.png', long: true, hue: 213.3 },
  { file: 'gem_009.png', long: true, hue: 333.2 },
  { file: 'gem_014.png', long: true, hue: 45.9 },
  { file: 'gem_015.png', long: true, hue: 214.8 },
  { file: 'gem_016.png', long: true, hue: 337.5 },
  { file: 'gem_017.png', long: true, hue: 272.5 },
  { file: 'gem_018.png', long: true, hue: 272.8 },
  { file: 'gem_019.png', long: true, hue: 49.7 },
  { file: 'gem_020.png', long: true, hue: 333.4 },
  { file: 'gem_021.png', long: true, hue: 275.7 },
  { file: 'gem_022.png', long: true, hue: 195.5 },
  { file: 'gem_025.png', long: true, hue: 37.2 },
  { file: 'gem_034.png', long: false, hue: 43.9 },
  { file: 'gem_035.png', long: false, hue: 275.9 },
  { file: 'gem_036.png', long: false, hue: 354.9 },
  { file: 'gem_037.png', long: false, hue: 338.2 },
  { file: 'gem_038.png', long: false, hue: 197.9 },
  { file: 'gem_043.png', long: true, hue: 44.1 },
  { file: 'gem_044.png', long: true, hue: 156.1 },
  { file: 'gem_045.png', long: true, hue: 220.0 },
  { file: 'gem_047.png', long: true, hue: 356.2 },
  { file: 'gem_049.png', long: true, hue: 147.7 },
  { file: 'gem_050.png', long: true, hue: 220.1 },
  { file: 'gem_051.png', long: true, hue: 330.3 },
  { file: 'gem_052.png', long: true, hue: 276.5 },
  { file: 'gem_054.png', long: true, hue: 276.6 },
  { file: 'gem_1.png', long: false, hue: -1.0 },
  { file: 'gem_2.png', long: false, hue: 353.7 },
  { file: 'gem_3.png', long: false, hue: 219.4 },
  { file: 'gem_4.png', long: false, hue: 149.5 },
  { file: 'gem_5.png', long: false, hue: 333.1 },
  { file: 'pair_1_gem_1.png', long: true, hue: -1.0 },
  { file: 'pair_1_gem_2.png', long: true, hue: 353.2 },
  { file: 'pair_2_gem_1.png', long: true, hue: 197.1 },
  { file: 'pair_2_gem_2.png', long: true, hue: 45.4 },
  { file: 'pair_3_gem_1.png', long: false, hue: 275.9 },
  { file: 'pair_3_gem_2.png', long: false, hue: 356.6 },
  { file: 'pair_4_gem_1.png', long: true, hue: 50.9 },
  { file: 'pair_4_gem_2.png', long: true, hue: 274.3 }
];

const SLOTS = ['tl', 'tr', 'br', 'bl'];
const CROSS_TILT = { tl: 45, tr: 135, br: 45, bl: 135 };
const HUE_GAP = 28;

function hashSeed(seed) {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

function hueDistance(a, b) {
  if (a < 0 || b < 0) return 360;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export default function CornerCrystals({ seed }) {
  const corners = useMemo(() => {
    const random = makeRandom(seed);
    const pool = GEMS.slice();
    const chosen = [];

    const take = () => {
      // сперва ищем камень, чей цвет не спорит с уже лежащими на работе
      for (let attempt = 0; attempt < 40 && pool.length; attempt++) {
        const i = Math.floor(random() * pool.length);
        const gem = pool[i];
        const clash = chosen.some((c) => hueDistance(c.hue, gem.hue) < HUE_GAP);
        if (!clash || attempt > 24) {
          pool.splice(i, 1);
          chosen.push(gem);
          return gem;
        }
      }
      const fallback = pool.splice(Math.floor(random() * pool.length), 1)[0];
      chosen.push(fallback);
      return fallback;
    };

    return SLOTS.map((slot) => {
      const gem = take();
      const tilt = gem.long
        ? CROSS_TILT[slot] + Math.round((random() - 0.5) * 8)
        : Math.round((random() - 0.5) * 16);
      return {
        slot,
        file: gem.file,
        tilt,
        size: gem.long ? 38 + Math.round(random() * 10) : 32 + Math.round(random() * 8),
        shift: Math.round((random() - 0.5) * 4)
      };
    });
  }, [seed]);

  const base = import.meta.env.BASE_URL;

  return (
    <>
      {corners.map((c) => (
        <img
          key={c.slot}
          className={`photo-crystal ${c.slot}`}
          src={`${base}decor/gems3/${c.file}`}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            '--crystal-size': `${c.size}px`,
            transform: `rotate(${c.tilt}deg) translate(${c.shift}px, ${c.shift}px)`
          }}
        />
      ))}
    </>
  );
}
