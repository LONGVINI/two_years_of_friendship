import React, { useMemo } from 'react';

// Figures picked from the catalogue: points live in a 0..1 square, edges join them
const CONSTELLATIONS = [
  { id: 1, pts: [[.05,.55],[.22,.62],[.36,.42],[.20,.32],[.58,.36],[.78,.46],[.95,.28]],
    edges: [[0,1],[1,2],[2,3],[3,0],[2,4],[4,5],[5,6]] },
  { id: 2, pts: [[.04,.30],[.26,.70],[.50,.24],[.74,.70],[.96,.32]],
    edges: [[0,1],[1,2],[2,3],[3,4]] },
  { id: 3, pts: [[.12,.10],[.82,.14],[.38,.46],[.50,.50],[.62,.54],[.20,.90],[.88,.86]],
    edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]] },
  { id: 4, pts: [[.50,.05],[.50,.40],[.50,.95],[.10,.42],[.90,.36],[.50,.68]],
    edges: [[0,1],[1,5],[5,2],[3,1],[1,4]] },
  { id: 6, pts: [[.30,.30],[.52,.18],[.66,.40],[.44,.54],[.10,.72]],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4]] },
  { id: 7, pts: [[.06,.52],[.48,.46],[.86,.20],[.86,.76]],
    edges: [[0,1],[1,2],[1,3]] },
  { id: 29, pts: [[.10,.26],[.16,.54],[.36,.72],[.62,.72],[.82,.54],[.88,.26]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { id: 10, pts: [[.08,.16],[.24,.30],[.40,.44],[.56,.56],[.72,.62],[.86,.52],[.90,.32],[.76,.20]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { id: 12, pts: [[.18,.20],[.80,.24],[.84,.80],[.20,.76]],
    edges: [[0,1],[1,2],[2,3],[3,0]] },
  { id: 14, pts: [[.10,.24],[.30,.40],[.48,.34],[.62,.56],[.80,.50],[.92,.72]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { id: 16, pts: [[.16,.14],[.24,.48],[.32,.84],[.68,.16],[.76,.50],[.84,.86]],
    edges: [[0,1],[1,2],[3,4],[4,5],[0,3],[1,4]] },
  { id: 17, pts: [[.50,.14],[.50,.46],[.22,.72],[.78,.70],[.50,.90]],
    edges: [[0,1],[1,2],[1,3],[1,4]] },
  { id: 19, pts: [[.06,.30],[.30,.44],[.54,.40],[.72,.60],[.92,.78]],
    edges: [[0,1],[1,2],[2,3],[3,4]] },
  { id: 20, pts: [[.16,.66],[.44,.28],[.76,.44],[.86,.76],[.30,.88]],
    edges: [[0,1],[1,2],[2,3],[0,4]] },
  { id: 21, pts: [[.14,.62],[.14,.34],[.40,.24],[.62,.34],[.62,.62],[.40,.74],[.80,.44],[.86,.62]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[3,6],[6,7]] },
  { id: 22, pts: [[.10,.40],[.34,.22],[.66,.34],[.84,.62],[.42,.80]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
  { id: 23, pts: [[.06,.44],[.24,.28],[.42,.48],[.60,.26],[.78,.50],[.94,.30]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { id: 24, pts: [[.06,.76],[.28,.60],[.50,.50],[.72,.36],[.90,.20],[.62,.72]],
    edges: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
  { id: 25, pts: [[.10,.66],[.40,.44],[.66,.34],[.88,.44]],
    edges: [[0,1],[1,2],[2,3]] },
  { id: 26, pts: [[.08,.44],[.28,.30],[.48,.40],[.44,.62],[.24,.64],[.70,.30],[.90,.44]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[2,5],[5,6]] },
  { id: 27, pts: [[.04,.34],[.18,.46],[.34,.38],[.48,.52],[.62,.44],[.76,.58],[.88,.48],[.97,.62]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { id: 32, pts: [[.08,.30],[.30,.24],[.50,.36],[.66,.52],[.84,.46],[.90,.66],[.70,.72]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] }
];

const CORNERS = ['tl', 'tr', 'br', 'bl'];

// Same placement as the catalogue: rotated 45 degrees, flattened, nudged onto the sheet
const SPREAD = 74;
const FLATTEN = 0.62;
const CENTER_X = 63;
const CENTER_Y = 60;
const COS = Math.cos(-Math.PI / 4);
const SIN = Math.sin(-Math.PI / 4);

function project(point) {
  const x = (point[0] - 0.5) * SPREAD;
  const y = (point[1] - 0.5) * SPREAD * FLATTEN;
  return [CENTER_X + x * COS - y * SIN, CENTER_Y + x * SIN + y * COS];
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return function random() {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;  state >>>= 0;
    return state / 4294967296;
  };
}

export default function CornerConstellations({ seed }) {
  const picks = useMemo(() => {
    const random = createRandom(hashSeed(seed));
    const pool = CONSTELLATIONS.slice();
    const chosen = [];
    for (let i = 0; i < 4; i += 1) {
      const index = Math.floor(random() * pool.length) % pool.length;
      chosen.push(pool.splice(index, 1)[0]);
    }
    return chosen;
  }, [seed]);

  return (
    <>
      {picks.map((figure, i) => {
        const projected = figure.pts.map(project);
        return (
          <svg
            key={CORNERS[i]}
            className={`corner-constellation ${CORNERS[i]}`}
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
          >
            <g stroke="rgba(5, 7, 14, 0.7)" strokeWidth="3.6" strokeLinecap="round" fill="none">
              {figure.edges.map(([a, b], k) => (
                <line
                  key={k}
                  x1={projected[a][0].toFixed(1)}
                  y1={projected[a][1].toFixed(1)}
                  x2={projected[b][0].toFixed(1)}
                  y2={projected[b][1].toFixed(1)}
                />
              ))}
            </g>
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9">
              {figure.edges.map(([a, b], k) => (
                <line
                  key={k}
                  x1={projected[a][0].toFixed(1)}
                  y1={projected[a][1].toFixed(1)}
                  x2={projected[b][0].toFixed(1)}
                  y2={projected[b][1].toFixed(1)}
                />
              ))}
            </g>
            <g fill="rgba(5, 7, 14, 0.75)">
              {projected.map(([x, y], k) => (
                <circle key={k} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(k % 3 ? 1.9 : 2.4) + 1.3} />
              ))}
            </g>
            <g fill="currentColor">
              {projected.map(([x, y], k) => (
                <circle key={k} cx={x.toFixed(1)} cy={y.toFixed(1)} r={k % 3 ? 1.9 : 2.4} />
              ))}
            </g>
          </svg>
        );
      })}
    </>
  );
}
