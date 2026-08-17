import React, { useEffect, useState } from 'react';
import './GlyphText.css';

// Текст, который ещё нельзя прочесть: буквы подменяются чужими знаками и
// меняются по нескольку раз в секунду. Пробелы и знаки препинания остаются
// на месте, поэтому видно ритм фразы — но не саму фразу.
const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ⌇⍟⏃⏄⏁⌰⍜⍙⌖⌗⋔⋉⍚⏂҂ѪѦѮѰҌ';
const KEEP = ' \n\t.,;:!?—-«»()';

function scramble(text) {
  let out = '';
  for (const ch of text) {
    out += KEEP.includes(ch) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

// Общий ход для всех надписей: он не сбивается, когда страница перелистывается
// и текст пересоздаётся. Тикер живёт, пока на экране есть хоть одна надпись.
const listeners = new Set();
let ticker = null;

function subscribe(fn) {
  listeners.add(fn);
  if (!ticker) {
    ticker = setInterval(() => {
      if (document.hidden) return;
      for (const listener of listeners) listener();
    }, 90);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && ticker) { clearInterval(ticker); ticker = null; }
  };
}

export default function GlyphText({ text, revealed, className, speed = 1 }) {
  const [shown, setShown] = useState(() => (revealed ? text : scramble(text)));

  useEffect(() => {
    if (revealed) { setShown(text); return undefined; }
    setShown(scramble(text));
    // speed — во сколько раз реже этой надписи меняться относительно общего хода
    let beat = 0;
    return subscribe(() => {
      beat += 1;
      if (beat % Math.max(1, Math.round(speed)) === 0) setShown(scramble(text));
    });
  }, [text, revealed, speed]);

  return (
    <span className={`${className || ''} ${revealed ? '' : 'glyph-locked'}`.trim()}>
      {shown}
    </span>
  );
}
