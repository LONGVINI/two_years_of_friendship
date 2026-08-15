import React from 'react';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const MOTIFS = {
  'chapter-1': (
    <g {...STROKE}>
      <path d="M39 13 A19 19 0 1 0 39 49 A15 15 0 1 1 39 13 Z" />
      <circle cx="49" cy="18" r="1.5" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="54" cy="34" r="1.1" fill="currentColor" stroke="none" opacity="0.5" />
      <circle cx="46" cy="47" r="1.3" fill="currentColor" stroke="none" opacity="0.6" />
    </g>
  ),
  'chapter-2': (
    <g {...STROKE}>
      <circle cx="30" cy="32" r="2.6" fill="currentColor" stroke="none" />
      <path d="M30 27 C35 27 37 31 36 35 C34.6 40 28 42 23.5 39 C17.5 35 16 26 21 20 C27 12.5 39 11.5 47 18 C55.5 25 56 39 48 47.5" />
      <circle cx="48" cy="47.5" r="1.5" fill="currentColor" stroke="none" opacity="0.85" />
      <circle cx="21.5" cy="19" r="1" fill="currentColor" stroke="none" opacity="0.6" />
      <circle cx="44" cy="15" r="0.9" fill="currentColor" stroke="none" opacity="0.5" />
    </g>
  ),
  'chapter-3': (
    <g {...STROKE}>
      <path d="M12 33 C21 22 43 22 52 33 C43 44 21 44 12 33 Z" />
      <circle cx="32" cy="33" r="5.5" />
      <circle cx="32" cy="33" r="1.6" fill="currentColor" stroke="none" />
      <path d="M25 15 A10 10 0 0 0 39 15 A12 12 0 0 1 25 15 Z" opacity="0.85" />
      <path d="M32 47 L32 53" opacity="0.7" />
      <path d="M18 43 L15 48" opacity="0.7" />
      <path d="M46 43 L49 48" opacity="0.7" />
    </g>
  ),
  'chapter-4': (
    <g {...STROKE}>
      <path d="M32 55 L32 27" />
      <path d="M32 43 C25 43 21 39 20 33 C27 33 31 37 32 43 Z" opacity="0.9" />
      <path d="M32 36 C39 36 43 32 44 26 C37 26 33 30 32 36 Z" opacity="0.9" />
      <circle cx="32" cy="20" r="3.4" />
      <circle cx="25" cy="16" r="3.4" opacity="0.85" />
      <circle cx="39" cy="16" r="3.4" opacity="0.85" />
      <circle cx="28" cy="9" r="3.4" opacity="0.7" />
      <circle cx="36" cy="9" r="3.4" opacity="0.7" />
    </g>
  ),
  'chapter-interactive': (
    <g {...STROKE}>
      <ellipse cx="6.5" cy="32" rx="6.5" ry="4.2" />
      <ellipse cx="17" cy="32" rx="4.2" ry="6.5" />
      <g transform="translate(-2.5 0) rotate(-15 26 32)">
        <path d="M29 25 C22 25 19.5 28 19.5 32 C19.5 36 22 39 29 39" />
      </g>
      <g transform="translate(2.5 0) rotate(15 38 32)">
        <path d="M35 25 C42 25 44.5 28 44.5 32 C44.5 36 42 39 35 39" />
      </g>
      <ellipse cx="47" cy="32" rx="4.2" ry="6.5" />
      <ellipse cx="57.5" cy="32" rx="6.5" ry="4.2" />
    </g>
  )
};

export default function ChapterOrnament({ chapterId, variant = 'mark' }) {
  const motif = MOTIFS[chapterId] || MOTIFS['chapter-1'];

  return (
    <>
      <div className="chapter-frame" aria-hidden="true">
        <span className="chapter-frame-corner tl"></span>
        <span className="chapter-frame-corner tr"></span>
        <span className="chapter-frame-corner bl"></span>
        <span className="chapter-frame-corner br"></span>
      </div>

      {variant === 'mark' && (
        <div className="chapter-mark" aria-hidden="true">
          <span className="chapter-mark-rule"></span>
          <svg viewBox="0 0 64 64" focusable="false">{motif}</svg>
          <span className="chapter-mark-rule"></span>
        </div>
      )}
    </>
  );
}
