import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import './Book.css';

export default function Book() {
  const [drawings, setDrawings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Index of the active spread/drawing
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null); // 'next' or 'prev'
  
  // New Drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    angle: 0,
    direction: null,
    isReleasing: false
  });
  const dragRef = useRef({ startX: 0, R: 0, centerX: 0 });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [soundIndex, setSoundIndex] = useState(1);
  const canvasRef = useRef(null);
  const bookRef = useRef(null);
  const particlesRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Fetch drawings list
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}album.json`)
      .then((res) => res.json())
      .then((data) => {
        setDrawings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Ошибка загрузки манифеста альбома:', err);
        setLoading(false);
      });
  }, []);

  // Background particle animation system (Dynamic Eras)
  useEffect(() => {
    if (loading || drawings.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    
    const handlePointerMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      // Update global CSS variables for ambient lights in index.css
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);

    const activeDrawing = drawings[currentIndex];
    const currentYear = parseInt(activeDrawing?.year || 2016);
    const primaryColor = activeDrawing?.eraTheme?.primary || '#2dd4bf';
    
    let era = 'watercolor';
    if (currentYear <= 2018) era = 'constellation';
    else if (currentYear <= 2020) era = 'fog';
    else if (currentYear <= 2022) era = 'sparks';
    else if (currentYear <= 2024) era = 'orbit';

    // Track era transitions to re-seed or adjust particles smoothly
    if (!particlesRef.current || particlesRef.current.era !== era) {
      const particles = [];
      const particleCount = era === 'sparks' ? 80 : era === 'constellation' ? 60 : 45;
      
      for (let i = 0; i < particleCount; i++) {
        // Carry over old particles if they exist, to morph smoothly
        const oldP = particlesRef.current?.particles?.[i];
        particles.push({
          x: oldP ? oldP.x : Math.random() * width,
          y: oldP ? oldP.y : Math.random() * height,
          vx: oldP ? oldP.vx : (Math.random() - 0.5) * 2,
          vy: oldP ? oldP.vy : (Math.random() - 0.5) * 2,
          size: Math.random() * 4 + 1.5,
          alpha: Math.random() * 0.5 + 0.1,
          angle: Math.random() * Math.PI * 2, // for orbit
          orbitRadius: Math.random() * 200 + 50,
          orbitCenter: { x: width/2, y: height/2 }
        });
      }
      particlesRef.current = { era, particles };
    }

    const handleWindowClick = (e) => {
      if (!particlesRef.current?.particles) return;
      for (let i = 0; i < 15; i++) {
        particlesRef.current.particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          size: Math.random() * 5 + 2,
          alpha: 1,
          decay: Math.random() * 0.03 + 0.01,
          angle: 0, orbitRadius: 0, orbitCenter: {x: e.clientX, y: e.clientY}
        });
      }
    };
    window.addEventListener('click', handleWindowClick);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = era === 'fog' ? 'source-over' : 'screen';
      
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      
      const particles = particlesRef.current.particles;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Physics logic based on Era
        if (era === 'constellation') {
          // Slow drift
          p.x += p.vx * 0.2;
          p.y += p.vy * 0.2;
          p.size = 2;
        } else if (era === 'fog') {
          // Slow upwards blur
          p.y -= 0.5;
          p.x += Math.sin(p.y * 0.01) * 0.5;
          p.size = 25; // Large blurred circles
        } else if (era === 'sparks') {
          // Fast upwards, erratic
          p.y -= 2;
          p.x += (Math.random() - 0.5) * 2;
          p.size = 1.5;
        } else if (era === 'orbit') {
          // Orbit around center
          p.angle += 0.002;
          const targetX = width/2 + Math.cos(p.angle) * p.orbitRadius;
          const targetY = height/2 + Math.sin(p.angle) * p.orbitRadius;
          p.x += (targetX - p.x) * 0.05;
          p.y += (targetY - p.y) * 0.05;
          p.size = 3;
        } else if (era === 'watercolor') {
          // Massive, extremely slow drift
          p.x += p.vx * 0.1;
          p.y += p.vy * 0.1;
          p.size = 40;
        }
        
        // Mouse Repulsion (Interactive)
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          p.x += (dx / dist) * force * 5;
          p.y += (dy / dist) * force * 5;
        }
        
        // Decay logic for click sparks
        if (p.decay) {
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          // Screen wrap
          if (p.x < -p.size*2) p.x = width + p.size*2;
          if (p.x > width + p.size*2) p.x = -p.size*2;
          if (p.y < -p.size*2) p.y = height + p.size*2;
          if (p.y > height + p.size*2) p.y = -p.size*2;
        }

        // Drawing
        ctx.beginPath();
        let gradRadius = p.size * (era === 'fog' || era === 'watercolor' ? 2 : 4);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradRadius);
        grad.addColorStop(0, primaryColor);
        if (era === 'fog' || era === 'watercolor') {
          grad.addColorStop(0.5, primaryColor + '11');
          grad.addColorStop(1, 'transparent');
        } else {
          grad.addColorStop(0.3, primaryColor + '44');
          grad.addColorStop(1, 'transparent');
        }
        
        ctx.fillStyle = grad;
        ctx.globalAlpha = Math.max(0, p.alpha * (era === 'watercolor' ? 0.3 : 1));
        ctx.arc(p.x, p.y, gradRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw constellation lines
        if (era === 'constellation' && !p.decay) {
          for (let j = i - 1; j >= 0; j--) {
            const p2 = particles[j];
            if (p2.decay) continue;
            const d2x = p.x - p2.x;
            const d2y = p.y - p2.y;
            const dist2 = Math.sqrt(d2x*d2x + d2y*d2y);
            if (dist2 < 120) {
              ctx.beginPath();
              ctx.strokeStyle = primaryColor;
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = (1 - dist2 / 120) * 0.3;
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(animationId);
    };
  }, [currentIndex, drawings, loading]);

  // Dynamically update document CSS variables when active theme changes
  useEffect(() => {
    if (drawings.length === 0 || !drawings[currentIndex]) return;
    
    const activeDrawing = drawings[currentIndex];
    const theme = activeDrawing.eraTheme || {
      bgStart: '#0c0d14',
      bgEnd: '#050508',
      primary: '#a78bfa',
      primaryRgb: '167, 139, 250',
      glass: 'rgba(17, 19, 31, 0.65)'
    };

    // Convert rgba background color to 100% solid rgb (no transparency)
    const solidBg = theme.glass.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgb($1, $2, $3)');

    const root = document.documentElement;
    root.style.setProperty('--bg-gradient-start', theme.bgStart);
    root.style.setProperty('--bg-gradient-end', theme.bgEnd);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-rgb', theme.primaryRgb);
    root.style.setProperty('--glass-bg', solidBg);
  }, [currentIndex, drawings]);

  // Play recorded mp3 paper sounds in sequence
  const playPaperSound = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio(`${import.meta.env.BASE_URL}mp3/${soundIndex}.mp3`);
      audio.play().catch(e => console.warn('Audio play failed:', e));
      setSoundIndex(prev => prev % 7 + 1);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  };

  const handleNext = () => {
    if (currentIndex >= drawings.length - 1) return;
    setIsFlipping(true);
    setFlipDirection('next');
    playPaperSound();

    setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, drawings.length - 1));
      setIsFlipping(false);
      setFlipDirection(null);
    }, 300); // Super fast flip duration
  };

  const handlePrev = () => {
    if (currentIndex === 0) return;
    setIsFlipping(true);
    setFlipDirection('prev');
    playPaperSound();

    setTimeout(() => {
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
      setIsFlipping(false);
      setFlipDirection(null);
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (isFlipping) return;
    
    // Calculate book spine center
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const R = e.clientX - centerX;
    
    // Ignore clicks too close to spine to avoid crazy rotation
    if (Math.abs(R) < 30) return;

    dragRef.current = { startX: e.clientX, R, centerX };
    setDragState({ isDragging: true, angle: 0, direction: null, isReleasing: false });
    if (e.target.setPointerCapture) {
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;
    const { centerX, R, startX } = dragRef.current;
    
    let direction = dragState.direction;
    if (!direction) {
      const deltaX = e.clientX - startX;
      if (Math.abs(deltaX) > 10) {
        direction = R > 0 ? 'next' : 'prev';
        if (direction === 'next' && currentIndex >= drawings.length - 1) {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
          return;
        }
        if (direction === 'prev' && currentIndex === 0) {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
          return;
        }
      } else {
        return;
      }
    }

    let angle = 0;
    if (direction === 'next') {
      let cosVal = (e.clientX - centerX) / R; // R is positive
      cosVal = Math.max(-1, Math.min(1, cosVal));
      angle = -Math.acos(cosVal) * (180 / Math.PI); // 0 to -180
    } else {
      let cosVal = (e.clientX - centerX) / R; // R is negative
      cosVal = Math.max(-1, Math.min(1, cosVal));
      angle = Math.acos(cosVal) * (180 / Math.PI); // 0 to 180
    }

    setDragState(prev => ({ ...prev, direction, angle }));
  };

  const handlePointerUp = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;
    
    const { direction, angle } = dragState;
    if (!direction) {
      setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
      const { centerX } = dragRef.current;
      if (e.clientX > centerX) {
        handleNext();
      } else {
        handlePrev();
      }
      return;
    }

    setDragState(prev => ({ ...prev, isReleasing: true }));
    if (e.target.releasePointerCapture) {
      e.target.releasePointerCapture(e.pointerId);
    }
    
    if (direction === 'next') {
      if (angle <= -90) {
        setDragState(prev => ({ ...prev, angle: -180 }));
        playPaperSound();
        setTimeout(() => {
          setCurrentIndex(prev => Math.min(prev + 1, drawings.length - 1));
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 300);
      } else {
        setDragState(prev => ({ ...prev, angle: 0 }));
        setTimeout(() => {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 300);
      }
    } else {
      // Prev drag goes from 0 towards 180
      if (angle >= 90) {
        setDragState(prev => ({ ...prev, angle: 180 }));
        playPaperSound();
        setTimeout(() => {
          setCurrentIndex(prev => Math.max(prev - 1, 0));
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 300);
      } else {
        setDragState(prev => ({ ...prev, angle: 0 }));
        setTimeout(() => {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 300);
      }
    }
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    const img = e.target;
    img.style.transform = 'scale(1.15) rotate(' + ((Math.random()-0.5)*6) + 'deg)';
    img.style.filter = 'brightness(1.2) drop-shadow(0 0 20px var(--color-primary))';
    img.style.zIndex = '50';
    playPaperSound();
    setTimeout(() => {
      img.style.transform = '';
      img.style.filter = '';
      img.style.zIndex = '';
    }, 400);
  };

  const handleTimelineChange = (e) => {
    if (isFlipping) return;
    const targetIndex = parseInt(e.target.value, 10);
    if (targetIndex === currentIndex) return;
    
    playPaperSound();
    setCurrentIndex(targetIndex);
  };

  if (loading) {
    return (
      <div className="book-container">
        <RefreshCw className="animate-spin" size={32} />
        <span style={{ marginTop: '15px', color: 'var(--color-text-muted)' }}>Загрузка галереи...</span>
      </div>
    );
  }

  if (drawings.length === 0) {
    return (
      <div className="book-container">
        <span style={{ color: 'var(--color-text-muted)' }}>Альбом пуст. Пожалуйста, добавьте рисунки в манифест.</span>
      </div>
    );
  }

  const current = drawings[currentIndex];
  const nextDrawing = drawings[currentIndex + 1];
  const prevDrawing = drawings[currentIndex - 1];

  const showNextDrag = dragState.direction === 'next' && (dragState.isDragging || dragState.isReleasing);
  const showPrevDrag = dragState.direction === 'prev' && (dragState.isDragging || dragState.isReleasing);

  const isNextFlip = showNextDrag || (isFlipping && flipDirection === 'next');
  const isPrevFlip = showPrevDrag || (isFlipping && flipDirection === 'prev');

  const staticLeftDrawing = (isPrevFlip && prevDrawing) ? prevDrawing : current;
  const staticRightDrawing = (isNextFlip && nextDrawing) ? nextDrawing : current;

  return (
    <div className="book-container">
      <canvas ref={canvasRef} className="background-canvas" />
      {/* Header */}
      <header className="album-header">
        <h1>Искусство длиною в жизнь</h1>
        <span>Рузанна Манвелян</span>
      </header>

      {/* 3D Book */}
      <div className="book-wrapper" ref={bookRef}>
        <div 
          className={`book ${isFlipping ? 'flipping' : ''} ${(dragState.isDragging || dragState.isReleasing) ? 'dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          
          {/* Static Left Page (Shows underneath drawing during prev flip) */}
          <div className="page left-page">
            <div className="page-face front image-page">
              <div className="year-badge">{staticLeftDrawing.year}</div>
                <img 
                  src={`${import.meta.env.BASE_URL}${staticLeftDrawing.image}`} 
                  alt={staticLeftDrawing.title} 
                  onClick={handleImageClick}
                  draggable={false}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23111%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23555%22 font-family=%22sans-serif%22>Загрузка изображения...</text></svg>';
                  }}
                  style={{ transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer', userSelect: 'none' }}
                />
            </div>
          </div>

          {/* Static Right Page (Shows underneath description during next flip) */}
          <div className="page right-page">
            <div className="page-face front content-page">
              <div className="page-header">
                <h2>{staticRightDrawing.title}</h2>
                <div className="page-date">{staticRightDrawing.date}</div>
              </div>
              <div className="page-body">
                <p className="page-description">{staticRightDrawing.description}</p>
                {staticRightDrawing.story && <p className="page-story">{staticRightDrawing.story}</p>}
              </div>

            </div>
          </div>

          {/* Dynamic Drag/Flipping Page (Next) */}
          {(showNextDrag || (isFlipping && flipDirection === 'next')) && nextDrawing && (
            <div 
              className="page right-page" 
              style={
                showNextDrag 
                  ? { 
                      transform: `rotateY(${dragState.angle}deg)`, 
                      transition: dragState.isReleasing ? 'transform 0.3s ease-out' : 'none',
                      zIndex: 10
                    }
                  : { 
                      transform: 'rotateY(0deg)', 
                      animation: 'flipToLeft 0.3s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current description during flip */}
              <div className="page-face front content-page">
                <div className="page-header">
                  <h2>{current.title}</h2>
                  <div className="page-date">{current.date}</div>
                </div>
                <div className="page-body">
                  <p className="page-description">{current.description}</p>
                  {current.story && <p className="page-story">{current.story}</p>}
                </div>

              </div>

              {/* Back of the flipping page: shows next drawing during flip */}
              <div className="page-face back image-page">
                <div className="year-badge">{nextDrawing.year}</div>
                <img 
                  src={`${import.meta.env.BASE_URL}${nextDrawing.image}`} 
                  alt={nextDrawing.title}
                  onClick={handleImageClick}
                  draggable={false}
                  style={{ transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer', userSelect: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Dynamic Drag/Flipping Page (Prev) */}
          {(showPrevDrag || (isFlipping && flipDirection === 'prev')) && prevDrawing && (
            <div 
              className="page left-page" 
              style={
                showPrevDrag 
                  ? { 
                      transform: `rotateY(${dragState.angle}deg)`, 
                      transition: dragState.isReleasing ? 'transform 0.3s ease-out' : 'none',
                      zIndex: 10
                    }
                  : { 
                      transform: 'rotateY(-180deg)', 
                      animation: 'flipToRight 0.3s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current drawing */}
              <div className="page-face front image-page">
                <div className="year-badge">{current.year}</div>
                <img 
                  src={`${import.meta.env.BASE_URL}${current.image}`} 
                  alt={current.title}
                  onClick={handleImageClick}
                  draggable={false}
                  style={{ transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer', userSelect: 'none' }}
                />
              </div>

              {/* Back of the flipping page: shows previous description */}
              <div className="page-face back content-page">
                <div className="page-header">
                  <h2>{prevDrawing.title}</h2>
                  <div className="page-date">{prevDrawing.date}</div>
                </div>
                <div className="page-body">
                  <p className="page-description">{prevDrawing.description}</p>
                  {prevDrawing.story && <p className="page-story">{prevDrawing.story}</p>}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Control Buttons */}
      <div className="controls-panel">
        <button 
          className="control-btn" 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          title="Предыдущая страница"
        >
          <ChevronLeft size={24} />
        </button>


        <button 
          className="control-btn" 
          onClick={handleNext} 
          disabled={currentIndex >= drawings.length - 1}
          title="Следующая страница"
        >
          <ChevronRight size={24} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>

        <button 
          className="control-btn" 
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Timeline navigation */}
      <div className="timeline-slider-container">
        <div className="timeline-labels">
          {Array.from(new Set(drawings.map(d => d.year))).map((year) => {
            const firstIndexForYear = drawings.findIndex(d => d.year === year);
            const isActive = drawings[currentIndex]?.year === year;
            return (
              <span 
                key={year} 
                className={`timeline-label ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentIndex(firstIndexForYear)}
              >
                {year}
              </span>
            );
          })}
        </div>
        <input 
          type="range" 
          min="0" 
          max={drawings.length - 1} 
          value={currentIndex} 
          onChange={handleTimelineChange}
          className="timeline-slider"
        />
      </div>

      {/* CSS flip animations */}
      <style>{`
        @keyframes flipToLeft {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(-180deg); }
        }
        @keyframes flipToRight {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(180deg); }
        }
      `}</style>
    </div>
  );
}
