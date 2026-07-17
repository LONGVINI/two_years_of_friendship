import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import './Book.css';

export default function Book() {
  const [drawings, setDrawings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Index of the active spread/drawing
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null); // 'next' or 'prev'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [soundIndex, setSoundIndex] = useState(1);
  const canvasRef = useRef(null);
  const particlesRef = useRef(null);

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

  // Background particle animation system (floating watercolor dust)
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
    window.addEventListener('resize', handleResize);

    if (!particlesRef.current) {
      const particles = [];
      const particleCount = 45;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3 - 0.15, // Drift upwards
          size: Math.random() * 4 + 1.5,
          alpha: Math.random() * 0.4 + 0.1
        });
      }
      particlesRef.current = particles;
    }

    const activeDrawing = drawings[currentIndex];
    const primaryColor = activeDrawing?.eraTheme?.primary || '#2dd4bf';

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'screen';
      
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = height;

        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(0.3, primaryColor + '22');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.globalAlpha = p.alpha;
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
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
    if (isFlipping || currentIndex >= drawings.length - 1) return;
    setIsFlipping(true);
    setFlipDirection('next');
    playPaperSound();

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipping(false);
      setFlipDirection(null);
    }, 600); // Fast flip duration
  };

  const handlePrev = () => {
    if (isFlipping || currentIndex === 0) return;
    setIsFlipping(true);
    setFlipDirection('prev');
    playPaperSound();

    setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipping(false);
      setFlipDirection(null);
    }, 600);
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

  return (
    <div className="book-container">
      <canvas ref={canvasRef} className="background-canvas" />
      {/* Header */}
      <header className="album-header">
        <h1>История Творчества</h1>
        <span>Эпоха: {current.year} г. • Рисунок {currentIndex + 1} из {drawings.length}</span>
      </header>

      {/* 3D Book */}
      <div className="book-wrapper">
        <div className={`book ${isFlipping ? 'flipping' : ''}`}>
          
          {/* Static Left Page (Shows current drawing) */}
          <div className="page left-page" onClick={handlePrev}>
            <div className="page-face front image-page">
              <div className="year-badge">{current.year}</div>
              <img 
                src={`${import.meta.env.BASE_URL}${current.image}`} 
                alt={current.title} 
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23111%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23555%22 font-family=%22sans-serif%22>Загрузка изображения...</text></svg>';
                }}
              />
            </div>
          </div>

          {/* Static Right Page (Shows current description/story) */}
          <div className="page right-page" onClick={handleNext}>
            <div className="page-face front content-page">
              <div className="page-header">
                <h2>{current.title}</h2>
                <div className="page-date">{current.date}</div>
              </div>
              <div className="page-body">
                <p className="page-description">{current.description}</p>
                {current.story && <p className="page-story">{current.story}</p>}
              </div>
              <div className="page-footer">
                <span>Страница { (currentIndex * 2) + 1 }</span>
                <span>{current.year}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Flipping Page (rendered only when isFlipping is true) */}
          {isFlipping && flipDirection === 'next' && nextDrawing && (
            <div 
              className="page right-page" 
              style={{ 
                transform: 'rotateY(0deg)', 
                animation: 'flipToLeft 0.6s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                zIndex: 10
              }}
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
                <div className="page-footer">
                  <span>Страница { (currentIndex * 2) + 1 }</span>
                </div>
              </div>

              {/* Back of the flipping page: shows next drawing during flip */}
              <div className="page-face back image-page">
                <div className="year-badge">{nextDrawing.year}</div>
                <img 
                  src={`${import.meta.env.BASE_URL}${nextDrawing.image}`} 
                  alt={nextDrawing.title}
                />
              </div>
            </div>
          )}

          {isFlipping && flipDirection === 'prev' && prevDrawing && (
            <div 
              className="page left-page" 
              style={{ 
                transform: 'rotateY(-180deg)', 
                animation: 'flipToRight 0.6s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                zIndex: 10
              }}
            >
              {/* Front of the flipping page: shows current drawing */}
              <div className="page-face back image-page">
                <div className="year-badge">{current.year}</div>
                <img 
                  src={`${import.meta.env.BASE_URL}${current.image}`} 
                  alt={current.title}
                />
              </div>

              {/* Back of the flipping page: shows previous description */}
              <div className="page-face front content-page">
                <div className="page-header">
                  <h2>{prevDrawing.title}</h2>
                  <div className="page-date">{prevDrawing.date}</div>
                </div>
                <div className="page-body">
                  <p className="page-description">{prevDrawing.description}</p>
                  {prevDrawing.story && <p className="page-story">{prevDrawing.story}</p>}
                </div>
                <div className="page-footer">
                  <span>Страница { ((currentIndex - 1) * 2) + 1 }</span>
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
          disabled={currentIndex === 0 || isFlipping}
          title="Предыдущая страница"
        >
          <ChevronLeft size={24} />
        </button>

        <span className="page-indicator">
          {currentIndex + 1} / {drawings.length}
        </span>

        <button 
          className="control-btn" 
          onClick={handleNext} 
          disabled={currentIndex >= drawings.length - 1 || isFlipping}
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
                onClick={() => !isFlipping && setCurrentIndex(firstIndexForYear)}
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
          disabled={isFlipping}
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
          from { transform: rotateY(-180deg); }
          to { transform: rotateY(0deg); }
        }
      `}</style>
    </div>
  );
}
