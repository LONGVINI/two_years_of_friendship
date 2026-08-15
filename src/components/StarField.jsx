import React, { useEffect, useMemo, useState } from 'react';
import './StarField.css';

const REFERENCE_AREA = 2000 * 2000;

const LAYERS = [
  { key: 'far',  size: 1, density: 700, duration: 50,  blur: 0, minAlpha: 0.35, maxAlpha: 0.9 },
  { key: 'mid',  size: 2, density: 200, duration: 100, blur: 0, minAlpha: 0.5,  maxAlpha: 1 },
  { key: 'near', size: 3, density: 100, duration: 150, blur: 2, minAlpha: 0.65, maxAlpha: 1 },
];

function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return function random() {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;  state >>>= 0;
    return state / 4294967296;
  };
}

function buildBoxShadow(layer, width, height, random) {
  const area = width * height;
  const count = Math.max(1, Math.round(layer.density * (area / REFERENCE_AREA)));
  const shadows = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const x = Math.round(random() * width);
    const y = Math.round(random() * height);
    const alpha = (layer.minAlpha + random() * (layer.maxAlpha - layer.minAlpha)).toFixed(2);
    const color = `rgba(255, 255, 255, ${alpha})`;
    shadows[i] = layer.blur > 0
      ? `${x}px ${y}px ${layer.blur}px ${color}`
      : `${x}px ${y}px ${color}`;
  }

  return shadows.join(', ');
}

function readFieldSize() {
  if (typeof window === 'undefined') return { width: 1920, height: 1080 };
  return {
    width: Math.max(window.innerWidth, 800),
    height: Math.max(window.innerHeight, 800),
  };
}

export default function StarField() {
  const [field, setField] = useState(readFieldSize);

  useEffect(() => {
    let timerId = null;
    const handleResize = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => setField(readFieldSize()), 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const layers = useMemo(() => {
    const random = createRandom(20260812);
    return LAYERS.map((layer) => ({
      ...layer,
      shadow: buildBoxShadow(layer, field.width, field.height, random),
      duration: `${(layer.duration * field.height) / 2000}s`,
    }));
  }, [field.width, field.height]);

  return (
    <div className="starfield" aria-hidden="true">
      {layers.map((layer) => (
        <div
          key={layer.key}
          className="starfield-layer"
          style={{
            '--starfield-height': `${field.height}px`,
            '--starfield-duration': layer.duration,
          }}
        >
          <span
            className="starfield-stars"
            style={{
              top: 0,
              width: `${layer.size}px`,
              height: `${layer.size}px`,
              boxShadow: layer.shadow,
            }}
          />
          <span
            className="starfield-stars"
            style={{
              top: `${field.height}px`,
              width: `${layer.size}px`,
              height: `${layer.size}px`,
              boxShadow: layer.shadow,
            }}
          />
        </div>
      ))}
    </div>
  );
}
