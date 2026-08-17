import React, { useMemo } from 'react';
import './CornerShards.css';

// За гранью работы держат осколки стекла: по одному на угол, поперёк угла,
// как обрывок ленты. Осколок почти прозрачен, у него светлая кромка, одна
// внутренняя трещина и блик, который медленно ползёт по грани. Форма у каждого
// своя, но постоянная: она считается от названия работы, поэтому при
// перелистывании ничего не пересобирается и не мигает.

const SLOTS = ['tl', 'tr', 'br', 'bl'];

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

export default function CornerShards({ seed }) {
  const shards = useMemo(() => {
    const random = makeRandom(seed);
    return SLOTS.map((slot, index) => {
      // неровный многоугольник, вытянутый вдоль скола
      const sides = 6;
      const points = [];
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + (random() - 0.5) * 0.5;
        const rx = 40 * (0.72 + random() * 0.5);
        const ry = 15 * (0.66 + random() * 0.6);
        points.push(`${(50 + Math.cos(a) * rx).toFixed(1)},${(19 + Math.sin(a) * ry).toFixed(1)}`);
      }
      const hue = Math.round(186 + random() * 132);
      return {
        slot,
        id: `${hashSeed(String(seed) + slot).toString(36)}`,
        points: points.join(' '),
        hue,
        tilt: Math.round((random() - 0.5) * 10),
        scale: (0.86 + random() * 0.3).toFixed(2),
        delay: (random() * 5).toFixed(2),
        crack: `${(28 + random() * 14).toFixed(1)},${(10 + random() * 6).toFixed(1)} ${(58 + random() * 12).toFixed(1)},${(24 + random() * 6).toFixed(1)}`
      };
    });
  }, [seed]);

  return (
    <>
      {shards.map((s) => (
        <svg
          key={s.slot}
          className={`photo-shard ${s.slot}`}
          viewBox="0 0 100 38"
          aria-hidden="true"
          style={{ '--shard-tilt': `${s.tilt}deg`, '--shard-scale': s.scale }}
        >
          <defs>
            <linearGradient id={`glass-${s.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={`hsla(${s.hue}, 55%, 80%, 0.26)`} />
              <stop offset="45%" stopColor={`hsla(${s.hue + 24}, 72%, 96%, 0.55)`} />
              <stop offset="100%" stopColor={`hsla(${s.hue - 18}, 52%, 74%, 0.22)`} />
            </linearGradient>
            <linearGradient id={`flare-${s.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.72)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
            <clipPath id={`cut-${s.id}`}>
              <polygon points={s.points} />
            </clipPath>
          </defs>

          <polygon
            points={s.points}
            fill={`url(#glass-${s.id})`}
            stroke={`hsla(${s.hue}, 78%, 95%, 0.72)`}
            strokeWidth="0.9"
          />
          <polyline
            points={s.crack}
            fill="none"
            stroke={`hsla(${s.hue}, 70%, 97%, 0.36)`}
            strokeWidth="0.7"
          />
          <g clipPath={`url(#cut-${s.id})`}>
            <rect
              className="shard-flare"
              x="-40"
              y="0"
              width="34"
              height="38"
              fill={`url(#flare-${s.id})`}
              style={{ animationDelay: `${s.delay}s` }}
            />
          </g>
        </svg>
      ))}
    </>
  );
}
