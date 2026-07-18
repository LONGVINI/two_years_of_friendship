import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RefreshCw, Play, Pause, Clock } from 'lucide-react';
import ScratchGame from './ScratchGame';
import PolaroidGame from './PolaroidGame';
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
  
  // Autoplay
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(15000); // 15 seconds by default
  const dragRef = useRef({ startX: 0, R: 0, centerX: 0 });
  const bgRef = useRef({
    start: [5, 5, 8],
    end: [10, 10, 15]
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [soundIndex, setSoundIndex] = useState(1);
  const canvasRef = useRef(null);
  const bookRef = useRef(null);
  const particlesRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Fetch drawings list
  const isCoverClosed = currentIndex === 0 && !isFlipping && !dragState.isDragging && !dragState.isReleasing;

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}album.json`)
      .then((res) => res.json())
      .then((data) => {
        const coverDrawing = {
          id: 'cover',
          isCover: true,
          year: '2016',
          eraTheme: { bg: ['#111111', '#1a1a2e'], primary: '#2dd4bf' }
        };
        setDrawings([coverDrawing, ...data]);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Ошибка загрузки манифеста альбома:', err);
        setLoading(false);
      });
  }, []);

  // Helper for colors
  const hexToRgb = (hex) => {
    if (!hex) return [0,0,0];
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
  };

  // Background particle animation system (Dynamic Eras)
  useEffect(() => {
    if (loading || drawings.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
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
    const primaryColorHex = activeDrawing?.eraTheme?.primary || '#2dd4bf';
    const primaryColorRgb = hexToRgb(primaryColorHex);
    
    let era = 'watercolor';
    if (currentYear <= 2018) era = 'constellation';
    else if (currentYear <= 2020) era = 'fog';
    else if (currentYear <= 2022) era = 'sparks';
    else if (currentYear <= 2024) era = 'orbit';

    // Initialize unified particles on mount or if physics state is missing
    if (!particlesRef.current || !particlesRef.current.particles || !particlesRef.current.physics) {
      const particles = [];
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.5 + 0.1,
          angle: Math.random() * Math.PI * 2, // for orbit
          orbitRadius: Math.random() * 200 + 50
        });
      }
      particlesRef.current = {
        particles,
        physics: {
          upwardForce: 0,
          centerGravity: 0,
          orbitSpeed: 0,
          randomJitter: 0.1,
          targetSize: 2,
          lineOpacity: 0,
          glowMultiplier: 4,
          primaryColor: [45, 212, 191], // rgb array
          friction: 0.95
        }
      };
    }

    const handleWindowClick = (e) => {
      if (!particlesRef.current?.particles) return;
      for (let i = 0; i < 15; i++) {
        particlesRef.current.particles.push({
          x: e.clientX + (Math.random() - 0.5) * 10,
          y: e.clientY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          size: Math.random() * 5 + 2,
          alpha: 1,
          decay: Math.random() * 0.02 + 0.01,
          angle: 0, orbitRadius: 0
        });
      }
    };
    window.addEventListener('click', handleWindowClick);

    const animate = () => {
      // Smooth Lerping Utility
      const lerpColor = (current, target, factor = 0.015) => {
        return [
          current[0] + (target[0] - current[0]) * factor,
          current[1] + (target[1] - current[1]) * factor,
          current[2] + (target[2] - current[2]) * factor
        ];
      };

      // 1. Update Background Gradient
      const targetBgHex = activeDrawing?.eraTheme?.bg || ['#050508', '#0a0a0f'];
      const targetStart = hexToRgb(targetBgHex[0]);
      const targetEnd = hexToRgb(targetBgHex[1] || targetBgHex[0]);
      
      bgRef.current.start = lerpColor(bgRef.current.start, targetStart);
      bgRef.current.end = lerpColor(bgRef.current.end, targetEnd);

      ctx.globalCompositeOperation = 'source-over';
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, `rgb(${Math.round(bgRef.current.start[0])}, ${Math.round(bgRef.current.start[1])}, ${Math.round(bgRef.current.start[2])})`);
      bgGrad.addColorStop(1, `rgb(${Math.round(bgRef.current.end[0])}, ${Math.round(bgRef.current.end[1])}, ${Math.round(bgRef.current.end[2])})`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Determine Target Physics for current Era
      const targetPhysics = {
        upwardForce: era === 'sparks' ? 1.5 : era === 'fog' ? 0.3 : era === 'watercolor' ? 0.02 : 0,
        centerGravity: era === 'orbit' ? 0.005 : 0,
        orbitSpeed: era === 'orbit' ? 0.003 : 0,
        randomJitter: era === 'sparks' ? 0.8 : era === 'watercolor' ? 0.05 : era === 'orbit' ? 0.02 : 0.2,
        targetSize: era === 'watercolor' ? 40 : era === 'fog' ? 25 : era === 'orbit' ? 3 : era === 'constellation' ? 2 : 1.5,
        lineOpacity: era === 'constellation' ? 0.4 : 0,
        glowMultiplier: (era === 'fog' || era === 'watercolor') ? 2 : 4,
        friction: era === 'orbit' ? 0.99 : 0.93,
      };

      // 3. Smoothly Interpolate Global Physics State
      const pState = particlesRef.current.physics;
      
      // Hot-reload recovery: if state was infected by NaN, reset it
      if (!isFinite(pState.friction)) pState.friction = targetPhysics.friction;
      if (!isFinite(pState.upwardForce)) pState.upwardForce = targetPhysics.upwardForce;

      const lerpSpeed = 0.015;
      pState.upwardForce += (targetPhysics.upwardForce - pState.upwardForce) * lerpSpeed;
      pState.centerGravity += (targetPhysics.centerGravity - pState.centerGravity) * lerpSpeed;
      pState.orbitSpeed += (targetPhysics.orbitSpeed - pState.orbitSpeed) * lerpSpeed;
      pState.randomJitter += (targetPhysics.randomJitter - pState.randomJitter) * lerpSpeed;
      pState.targetSize += (targetPhysics.targetSize - pState.targetSize) * lerpSpeed;
      pState.lineOpacity += (targetPhysics.lineOpacity - pState.lineOpacity) * lerpSpeed;
      pState.glowMultiplier += (targetPhysics.glowMultiplier - pState.glowMultiplier) * lerpSpeed;
      pState.friction += (targetPhysics.friction - pState.friction) * lerpSpeed;
      
      pState.primaryColor = lerpColor(pState.primaryColor, primaryColorRgb, lerpSpeed);
      const pColorRgba = `rgba(${Math.round(pState.primaryColor[0])}, ${Math.round(pState.primaryColor[1])}, ${Math.round(pState.primaryColor[2])}`;

      ctx.globalCompositeOperation = (era === 'fog' || era === 'watercolor') ? 'source-over' : 'screen';
      
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const particles = particlesRef.current.particles;

      // 4. Update and Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply Forces
        p.vy -= pState.upwardForce * 0.1;
        p.vx += (Math.random() - 0.5) * pState.randomJitter;
        p.vy += (Math.random() - 0.5) * pState.randomJitter;

        // Apply Orbit
        if (pState.centerGravity > 0.0001) {
          p.angle += pState.orbitSpeed;
          const targetX = width/2 + Math.cos(p.angle) * p.orbitRadius;
          const targetY = height/2 + Math.sin(p.angle) * p.orbitRadius;
          p.vx += (targetX - p.x) * pState.centerGravity;
          p.vy += (targetY - p.y) * pState.centerGravity;
        }

        // Mutual Repulsion (The "Explosion" / Pushing apart logic)
        for (let j = i - 1; j >= 0; j--) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx*dx + dy*dy;
          if (distSq < 2500 && distSq > 0.1) { // 50px radius
            const dist = Math.sqrt(distSq);
            const force = (50 - dist) / 50;
            const fx = (dx / dist) * force * 0.3; // Repulsion strength
            const fy = (dy / dist) * force * 0.3;
            p.vx += fx;
            p.vy += fy;
            // Also push the other particle
            if (!p2.decay) {
              p2.vx -= fx;
              p2.vy -= fy;
            }
          }
        }

        // Mouse Interaction
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const distSqM = dx*dx + dy*dy;
        if (distSqM < 22500 && distSqM > 0.1) { // 150px radius
          const distM = Math.sqrt(distSqM);
          const forceM = (150 - distM) / 150;
          p.vx += (dx / distM) * forceM * 2;
          p.vy += (dy / distM) * forceM * 2;
        }

        // Apply Velocity & Friction
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= pState.friction;
        p.vy *= pState.friction;

        // Decay logic for click sparks
        if (p.decay) {
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          // Smoothly adapt size to current era
          p.size += (pState.targetSize - p.size) * 0.05;
          // Screen wrap
          if (p.x < -p.size*2) p.x = width + p.size*2;
          if (p.x > width + p.size*2) p.x = -p.size*2;
          if (p.y < -p.size*2) p.y = height + p.size*2;
          if (p.y > height + p.size*2) p.y = -p.size*2;
        }

        // Draw Particle
        ctx.beginPath();
        const gradRadius = Math.max(0.1, p.size * pState.glowMultiplier);
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(gradRadius)) {
          console.error("NAN DETECTED!", {x: p.x, y: p.y, size: p.size, glow: pState.glowMultiplier, vx: p.vx, vy: p.vy, pState});
        }
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradRadius);
        
        grad.addColorStop(0, `${pColorRgba}, 1)`);
        if (era === 'fog' || era === 'watercolor') {
          grad.addColorStop(0.5, `${pColorRgba}, 0.1)`);
          grad.addColorStop(1, 'transparent');
        } else {
          grad.addColorStop(0.3, `${pColorRgba}, 0.3)`);
          grad.addColorStop(1, 'transparent');
        }
        
        ctx.fillStyle = grad;
        const alphaMultiplier = era === 'watercolor' ? 0.3 : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * alphaMultiplier));
        ctx.arc(p.x, p.y, gradRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw constellation lines based on smoothly lerped lineOpacity
        if (pState.lineOpacity > 0.01 && !p.decay) {
          for (let j = i - 1; j >= 0; j--) {
            const p2 = particles[j];
            if (p2.decay) continue;
            const d2x = p.x - p2.x;
            const d2y = p.y - p2.y;
            const distSq2 = d2x*d2x + d2y*d2y;
            if (distSq2 < 14400) { // 120px radius
              const dist2 = Math.sqrt(distSq2);
              ctx.beginPath();
              ctx.strokeStyle = `${pColorRgba}, 1)`;
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = Math.max(0, (1 - dist2 / 120) * pState.lineOpacity);
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
    
    const theme = drawings[currentIndex]?.eraTheme || {};
    const bgStart = theme.bgStart || (theme.bg && theme.bg[0]) || '#0c0d14';
    const bgEnd = theme.bgEnd || (theme.bg && theme.bg[1]) || '#050508';
    const primary = theme.primary || '#2dd4bf';
    const primaryRgb = theme.primaryRgb || '45, 212, 191';
    const glass = theme.glass || 'rgba(17, 19, 31, 0.65)';

    // Convert rgba background color to 100% solid rgb (no transparency)
    const solidBg = glass.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgb($1, $2, $3)');

    const root = document.documentElement;
    root.style.setProperty('--bg-gradient-start', bgStart);
    root.style.setProperty('--bg-gradient-end', bgEnd);
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-rgb', primaryRgb);
    root.style.setProperty('--glass-bg', solidBg);
    
    bgRef.current.target = [hexToRgb(bgStart), hexToRgb(bgEnd)];
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

  const handleNext = useCallback((isAuto = false) => {
    if (isAuto !== true && isPlaying) setIsPlaying(false);
    if (currentIndex < drawings.length - 1 && !isFlipping) {
      playPaperSound();
      setFlipDirection('next');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsFlipping(false);
        setFlipDirection(null);
      }, 800); // SLOW FLIP
    } else if (currentIndex >= drawings.length - 1 && isPlaying) {
      setIsPlaying(false); // Stop autoplay at the end
    }
  }, [currentIndex, drawings.length, isFlipping, isPlaying]);

  const handlePrev = useCallback((isAuto = false) => {
    if (isAuto !== true && isPlaying) setIsPlaying(false);
    if (currentIndex > 0 && !isFlipping) {
      playPaperSound();
      setFlipDirection('prev');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setIsFlipping(false);
        setFlipDirection(null);
      }, 800); // SLOW FLIP
    }
  }, [currentIndex, isFlipping]);

  // Autoplay Effect
  useEffect(() => {
    let timer;
    if (isPlaying && !isCoverClosed) {
      timer = setInterval(() => {
        handleNext(true); // Pass true to indicate it's an auto-flip
      }, playInterval);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playInterval, isCoverClosed, handleNext]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (isFlipping) return;
    
    if (isPlaying) setIsPlaying(false); // Stop autoplay if user touches the book

    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    if (clientX === undefined) return;

    // Calculate book spine center
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const R = clientX - centerX;
    
    // Ignore clicks too close to spine to avoid crazy rotation
    if (Math.abs(R) < 30) return;

    dragRef.current = { startX: clientX, R, centerX };
    setDragState({ isDragging: true, angle: 0, direction: null, isReleasing: false });

    if (e.target.setPointerCapture) {
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;
    const { centerX, R, startX } = dragRef.current;
    
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    if (clientX === undefined) return;

    let direction = dragState.direction;
    if (!direction) {
      const deltaX = clientX - startX;
      if (Math.abs(deltaX) > 10) {
        if (R > 0 && deltaX > 0) return; // Prevent dragging right page to the right
        if (R < 0 && deltaX < 0) return; // Prevent dragging left page to the left
        
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

    const totalDist = 2 * Math.abs(R);
    let progress = 0;
    
    if (direction === 'next') {
      progress = (startX - clientX) / totalDist;
    } else if (direction === 'prev') {
      progress = (clientX - startX) / totalDist;
    }
    
    progress = Math.max(0, Math.min(1, progress));
    
    let angle = 0;
    if (direction === 'next') {
      angle = -progress * 180;
    } else if (direction === 'prev' && currentIndex > 0) {
      angle = progress * 180;
    }

    setDragState(prev => ({ ...prev, direction, angle }));
  };

  const handlePointerUp = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;
    
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || dragRef.current.startX;

    const { direction, angle } = dragState;
    if (!direction) {
      setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
      const { centerX } = dragRef.current;
      if (clientX > centerX) {
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
        }, 800);
      } else {
        setDragState(prev => ({ ...prev, angle: 0 }));
        setTimeout(() => {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 800);
      }
    } else {
      // Prev drag goes from 0 towards 180
      if (angle >= 90) {
        setDragState(prev => ({ ...prev, angle: 180 }));
        playPaperSound();
        setTimeout(() => {
          setCurrentIndex(prev => Math.max(prev - 1, 0));
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 800);
      } else {
        setDragState(prev => ({ ...prev, angle: 0 }));
        setTimeout(() => {
          setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false });
        }, 800);
      }
    }
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

  // Extract chapters for bookmarks
  const chaptersList = [];
  drawings.forEach((d, i) => {
    if (d.type === 'chapter') {
      chaptersList.push({ title: d.chapterTitle || d.title, index: i });
    }
  });

  const renderLeftFace = (drawing, isBack = false) => {
    if (!drawing) return null;
    const faceClass = isBack ? 'back' : 'front';
    
    if (drawing.isCover) {
      return null;
    }

    if (drawing.type === 'chapter') {
      return (
        <div className={`page-face ${faceClass} chapter-page-left`}>
          <div className="chapter-overlay"></div>
          <h2>{drawing.title}</h2>
        </div>
      );
    }
    // Mini-games placeholders
    if (drawing.type === 'scratch') {
      return (
        <div className="page-face image-page" style={{padding: 0}}>
          <ScratchGame imageSrc={drawing.image} />
        </div>
      );
    }
    if (drawing.type === 'polaroids') {
      return (
        <div className="page-face image-page" style={{padding: 0}}>
          <PolaroidGame />
        </div>
      );
    }
    // Normal Image Page
    return (
      <div className={`page-face ${faceClass} image-page`}>
        <div className="photo-wrapper">
          <div className="photo-corner tl"></div>
          <div className="photo-corner tr"></div>
          <div className="photo-corner bl"></div>
          <div className="photo-corner br"></div>
          <img 
            src={`${import.meta.env.BASE_URL}${drawing.image}`} 
            alt={drawing.title} 
            className="drawing-image" 
            draggable={false}
            onLoad={(e) => {
              const wrapper = e.target.closest('.photo-wrapper');
              if (wrapper && e.target.naturalWidth && e.target.naturalHeight) {
                wrapper.style.aspectRatio = `${e.target.naturalWidth} / ${e.target.naturalHeight}`;
              }
            }}
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23111%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23555%22 font-family=%22sans-serif%22>Ошибка загрузки...</text></svg>';
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', display: 'block' }}
          />
        </div>
      </div>
    );
  };

  const renderRightFace = (drawing, isBack = false) => {
    if (!drawing) return null;
    const faceClass = isBack ? 'back' : 'front';

    if (drawing.isCover) {
      return (
        <div 
          className={`page-face ${faceClass} book-cover`} 
          onClick={() => { if (currentIndex === 0) handleNext(); }}
        >
          <div className="cover-content">
            <h1>Искусство длиною в жизнь</h1>
            <p>Личное портфолио Рузанны Манвелян</p>
            <div className="click-to-open">Кликните или потяните, чтобы открыть</div>
          </div>
        </div>
      );
    }

    if (drawing.type === 'chapter') {
      return (
        <div className={`page-face ${faceClass} chapter-page-right`}>
          <div className="chapter-overlay"></div>
          <p className="chapter-subtitle">{drawing.description}</p>
        </div>
      );
    }
    // Mini-games placeholders right side
    if (drawing.type === 'scratch' || drawing.type === 'polaroids') {
      return (
        <div className={`page-face ${faceClass} content-page`} style={{justifyContent: 'center', alignItems: 'center'}}>
           <p className="page-description" style={{textAlign: 'center'}}>{drawing.description}</p>
        </div>
      );
    }
    // Normal Content Page
    return (
      <div className={`page-face ${faceClass} content-page`}>
        <div className="page-header">
          <h2>{drawing.title}</h2>
        </div>
        <div className="page-body">
          <p className="page-description">{drawing.description}</p>
          {drawing.story && <p className="page-story">{drawing.story}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="book-container">
      <canvas ref={canvasRef} className="background-canvas" />

      {/* 3D Book */}
      <div className="book-wrapper" ref={bookRef}>
        {/* Bookmarks */}
        <div className="book-bookmarks" style={{ opacity: isCoverClosed ? 0 : 1, pointerEvents: isCoverClosed ? 'none' : 'auto', transition: isCoverClosed ? 'opacity 0.2s ease 0s' : 'opacity 0.6s ease 0.8s' }}>
          {chaptersList.map((chap, i) => {
            const isActive = currentIndex >= chap.index && (i === chaptersList.length - 1 || currentIndex < chaptersList[i+1].index);
            return (
              <div 
                key={i} 
                className={`bookmark ${isActive ? 'active' : ''}`}
                onClick={() => {
                  playPaperSound();
                  setCurrentIndex(chap.index);
                }}
              >
                {chap.title}
              </div>
            );
          })}
        </div>

        <div 
          className={`book ${isFlipping ? 'flipping' : ''} ${(dragState.isDragging || dragState.isReleasing) ? 'dragging' : ''} ${isCoverClosed ? 'closed' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          
            {/* Static Left Page (Shows underneath drawing during prev flip) */}
            {staticLeftDrawing && !staticLeftDrawing.isCover && (
              <div className="page left-page" style={{ 
                opacity: isCoverClosed ? 0 : 1, 
                visibility: isCoverClosed ? 'hidden' : 'visible',
                transition: isCoverClosed ? 'opacity 0.2s ease 0s, visibility 0s linear 0.2s' : 'opacity 0.6s ease 0.3s, visibility 0s linear 0s' 
              }}>
                {renderLeftFace(staticLeftDrawing, false)}
              </div>
            )}

          {/* Static Right Page (Shows underneath description during next flip) */}
          <div className="page right-page">
            {renderRightFace(staticRightDrawing, false)}
          </div>

          {/* Dynamic Drag/Flipping Page (Next) */}
          {(showNextDrag || (isFlipping && flipDirection === 'next')) && nextDrawing && (
            <div 
              className="page right-page" 
              style={
                showNextDrag 
                  ? { 
                      transform: `rotateY(${dragState.angle}deg)`, 
                      transition: dragState.isReleasing ? 'transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)' : 'none',
                      zIndex: 10
                    }
                  : { 
                      transform: 'rotateY(0deg)', 
                      animation: 'flipToLeft 0.8s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current description during flip */}
              {renderRightFace(current, false)}

              {/* Back of the flipping page: shows next drawing during flip */}
              {renderLeftFace(nextDrawing, true)}
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
                      transition: dragState.isReleasing ? 'transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)' : 'none',
                      zIndex: 10
                    }
                  : { 
                      transform: 'rotateY(180deg)', 
                      animation: 'flipToRight 0.8s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current drawing */}
              {renderLeftFace(current, false)}

              {/* Back of the flipping page: shows previous description */}
              {renderRightFace(prevDrawing, true)}
            </div>
          )}

        </div>
      </div>

      {/* Side Navigation Arrows */}
      <div className="side-nav-container" style={{ opacity: isCoverClosed ? 0 : 1, pointerEvents: isCoverClosed ? 'none' : 'auto', transition: isCoverClosed ? 'opacity 0.2s ease 0s' : 'opacity 0.6s ease 0.8s' }}>
        <button 
          className="side-nav-btn prev" 
          onClick={handlePrev} 
          disabled={currentIndex === 0 || isFlipping}
        >
          <ChevronLeft size={48} />
        </button>
        <button 
          className="side-nav-btn next" 
          onClick={handleNext} 
          disabled={currentIndex === drawings.length - 1 || isFlipping}
        >
          <ChevronRight size={48} />
        </button>
      </div>

      {/* Control Buttons */}
      <div className="controls-panel" style={{ opacity: isCoverClosed ? 0 : 1, pointerEvents: isCoverClosed ? 'none' : 'auto', transition: isCoverClosed ? 'opacity 0.2s ease 0s' : 'opacity 0.6s ease 0.8s' }}>
        <button 
          className="control-btn nav-btn" 
          onClick={handlePrev} 
          disabled={currentIndex === 0 || isFlipping}
          title="Предыдущая страница"
        >
          <ChevronLeft size={24} />
        </button>

        <button 
          className="control-btn" 
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Остановить авто-пролистывание" : "Начать авто-пролистывание"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button 
          className="control-btn nav-btn" 
          onClick={handleNext} 
          disabled={currentIndex === drawings.length - 1 || isFlipping}
          title="Следующая страница"
        >
          <ChevronRight size={24} />
        </button>

        <button 
          className="control-btn" 
          onClick={() => setPlayInterval(prev => prev === 10000 ? 15000 : prev === 15000 ? 5000 : 10000)}
          title={`Интервал: ${playInterval / 1000}с`}
        >
          <Clock size={20} />
          <span style={{marginLeft: 5, fontSize: '0.8rem'}}>{playInterval / 1000}s</span>
        </button>

        <button 
          className="control-btn" 
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
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
