import React, { useState, useRef } from 'react';
import './PolaroidGame.css';

const images = [
  '/ai_selection_clean/2019_1.jpg',
  '/ai_selection_clean/2020_5.jpg',
  '/ai_selection_clean/2021_2.jpg',
  '/ai_selection_clean/2022_1.jpg',
  '/ai_selection_clean/2023_8.jpg'
];

export default function PolaroidGame() {
  const [polaroids, setPolaroids] = useState(
    images.map((src, i) => ({
      id: i,
      src,
      x: Math.random() * 150 - 75,
      y: Math.random() * 150 - 75,
      rot: Math.random() * 40 - 20,
      zIndex: i + 10
    }))
  );
  
  const [draggedId, setDraggedId] = useState(null);
  const dragStartInfo = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const maxZ = useRef(100);

  const handlePointerDown = (id, e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent book flip
    setDraggedId(id);
    maxZ.current += 1;
    setPolaroids(prev => prev.map(p => p.id === id ? { ...p, zIndex: maxZ.current } : p));
    
    // Support touch and mouse
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    dragStartInfo.current = {
      x: clientX,
      y: clientY,
      px: polaroids.find(p => p.id === id).x,
      py: polaroids.find(p => p.id === id).y
    };
  };

  const handlePointerMove = (e) => {
    if (draggedId === null) return;
    e.stopPropagation();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (!clientX || !clientY) return;
    
    const dx = clientX - dragStartInfo.current.x;
    const dy = clientY - dragStartInfo.current.y;
    
    setPolaroids(prev => prev.map(p => 
      p.id === draggedId 
        ? { ...p, x: dragStartInfo.current.px + dx, y: dragStartInfo.current.py + dy } 
        : p
    ));
  };

  const handlePointerUp = (e) => {
    if (draggedId !== null) {
      e.stopPropagation();
      setDraggedId(null);
    }
  };

  return (
    <div 
      className="polaroid-game-container" 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      <div className="polaroid-hint">Раскидайте воспоминания</div>
      {polaroids.map(p => (
        <div 
          key={p.id}
          className={`polaroid-card ${draggedId === p.id ? 'dragging' : ''}`}
          style={{
            transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) rotate(${p.rot}deg) scale(${draggedId === p.id ? 1.1 : 1})`,
            zIndex: p.zIndex
          }}
          onPointerDown={(e) => handlePointerDown(p.id, e)}
          onTouchStart={(e) => handlePointerDown(p.id, e)}
        >
          <div className="polaroid-photo">
            <img src={`${import.meta.env.BASE_URL}${p.src}`} alt="polaroid" draggable={false}/>
          </div>
        </div>
      ))}
    </div>
  );
}
