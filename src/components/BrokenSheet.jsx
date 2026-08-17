import React, { useId, useMemo } from 'react';
import './BrokenSheet.css';

// Последний лист альбома цел не полностью: от краёв по бумаге разбежались
// трещины, а низ и вовсе оборван неровным краем. За обрывом ничего нет — только
// темнота, в которой едва тлеет тот же свет, что вёл сюда. Разлом один на весь
// разворот: обе половины считают одну и ту же картину в общих координатах и
// показывают каждая свою часть, поэтому линии проходят через корешок насквозь.

const W = 200;
const H = 100;

// Полный период дыхания трещин: семь секунд в одну сторону и столько же обратно
const BREATH_CYCLE = 14;

// Цвет, которым темнота за обрывом заливается, если ссылка на градиент
// почему-то не разрешилась
const GAP_FALLBACK = 'rgb(4, 3, 7)';

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

export default function BrokenSheet({ seed = 'beyond-broken', side = 'left' }) {
  const { cracks, tear, gap } = useMemo(() => {
    const random = makeRandom(seed);

    // Трещина: ломаная, ведомая от края внутрь
    const line = (x0, y0, a0, steps, seg, drift) => {
      const pts = [`${x0.toFixed(1)},${y0.toFixed(1)}`];
      let a = a0, x = x0, y = y0;
      for (let i = 0; i < steps; i++) {
        a += (random() - 0.5) * drift;
        x += Math.cos(a) * seg * (0.7 + random() * 0.6);
        y += Math.sin(a) * seg * (0.7 + random() * 0.6) * 2;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(' ');
    };

    const starts = [
      { x: 0, y: 12 + random() * 12, a: 0.3 },
      { x: 0, y: 44 + random() * 14, a: -0.1 },
      { x: W, y: 18 + random() * 14, a: Math.PI - 0.26 },
      { x: W, y: 56 + random() * 12, a: Math.PI + 0.18 },
      { x: W * (0.2 + random() * 0.2), y: 0, a: Math.PI / 2 + (random() - 0.5) * 0.5 },
      { x: W * (0.58 + random() * 0.24), y: 0, a: Math.PI / 2 + (random() - 0.5) * 0.5 }
    ];

    const list = [];
    for (const st of starts) {
      const trunk = line(st.x, st.y, st.a, 8 + Math.floor(random() * 5), 9, 0.45);
      const twigs = [];
      const forks = 1 + Math.floor(random() * 2);
      const nodes = trunk.split(' ');
      for (let f = 0; f < forks; f++) {
        const at = 2 + Math.floor(random() * (nodes.length - 3));
        const [nx, ny] = nodes[at].split(',').map(Number);
        const [px, py] = nodes[at - 1].split(',').map(Number);
        const base = Math.atan2(ny - py, nx - px);
        const dir = random() < 0.5 ? -1 : 1;
        twigs.push(line(nx, ny, base + dir * (0.6 + random() * 0.6), 2 + Math.floor(random() * 3), 6, 0.7));
      }
      list.push({ trunk, twigs, width: (0.9 + random() * 0.7).toFixed(2) });
    }

    // край обрыва: одна рваная линия через весь разворот
    let y = 74 + random() * 5;
    const edge = [];
    for (let x = -4; x <= W + 4; x += W / 44) {
      y += (random() - 0.5) * 5;
      y = Math.max(66, Math.min(86, y));
      edge.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const points = edge.join(' ');
    return {
      cracks: list,
      tear: points,
      gap: `-4,${H + 10} ${points} ${W + 4},${H + 10}`
    };
  }, [seed]);

  // У каждой копии листа свой идентификатор градиента. Во время перелистывания
  // на экране одновременно живут несколько экземпляров разворота (статическая
  // страница и обе грани летящего листа), и общий на всех id рвал ссылку
  // url(#...) в тот момент, когда React убирал улетевший лист: заливка обрыва
  // на кадр переставала разрешаться и страница мигала.
  const rawId = useId();
  const gapId = `gap-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-${side}`;

  // Фаза дыхания отсчитывается от общего времени страницы, поэтому только что
  // смонтированная копия продолжает свечение с того места, где его вела
  // предыдущая, а не начинает цикл заново.
  const breathPhase = useMemo(() => {
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    return -((now / 1000) % BREATH_CYCLE);
  }, []);

  return (
    <svg
      className="broken-sheet"
      viewBox={side === 'right' ? `${W / 2} 0 ${W / 2} ${H}` : `0 0 ${W / 2} ${H}`}
      preserveAspectRatio="none"
      style={{ '--breath-phase': `${breathPhase.toFixed(3)}s` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gapId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(10, 7, 14, 0.94)" />
          <stop offset="100%" stopColor="rgb(4, 3, 7)" />
        </linearGradient>
      </defs>

      <g className="sheet-glow" fill="none" stroke="rgba(216, 186, 240, 0.16)" strokeLinecap="round">
        {cracks.map((c, i) => (
          <polyline
            key={`g${i}`}
            points={c.trunk}
            strokeWidth={c.width * 2.4}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g fill="none" stroke="rgba(12, 9, 16, 0.82)" strokeLinecap="round">
        {cracks.map((c, i) => (
          <React.Fragment key={`c${i}`}>
            <polyline points={c.trunk} strokeWidth={c.width} vectorEffect="non-scaling-stroke" />
            {c.twigs.map((t, k) => (
              <polyline
                key={k}
                points={t}
                strokeWidth={c.width * 0.6}
                stroke="rgba(12, 9, 16, 0.66)"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </React.Fragment>
        ))}
      </g>

      <polygon points={gap} fill={`url(#${gapId}) ${GAP_FALLBACK}`} />
      <polyline
        className="sheet-edge"
        points={tear}
        fill="none"
        stroke="rgba(230, 208, 246, 0.32)"
        strokeWidth="1.4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
