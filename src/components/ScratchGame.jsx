import React, { useRef, useEffect, useState } from 'react';
import './ScratchGame.css';

export default function ScratchGame({ imageSrc }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Fill with dark overlay
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '24px "Outfit", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Сотрите тьму...', canvas.width/2, canvas.height/2);
    
  }, []);

  const scratch = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2, false);
    ctx.fill();
  };

  const handlePointerDown = (e) => {
     setIsDrawing(true);
     scratch(e);
     e.stopPropagation(); // prevent book flip
  };
  
  const handlePointerMove = (e) => {
     if (!isDrawing) return;
     scratch(e);
     e.stopPropagation();
  };
  
  const handlePointerUp = (e) => {
     setIsDrawing(false);
  };

  return (
    <div className="scratch-game-container">
      <img src={`${import.meta.env.BASE_URL}${imageSrc}`} className="scratch-hidden-image" alt="Hidden art" draggable={false} />
      <canvas 
        ref={canvasRef}
        width={600}
        height={800}
        className="scratch-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
