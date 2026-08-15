import React, { useState, useEffect } from 'react';
import StarField from './StarField';
import './SplashScreen.css';

export default function SplashScreen({ onComplete }) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const handleEnterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.msRequestFullscreen) {
        await document.documentElement.msRequestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed or was denied:", err);
    }
    launch();
  };

  const handleEnterNormal = () => {
    launch();
  };

  const launch = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsHidden(true);
      if (onComplete) onComplete();
    }, 1500);
  };

  // Allow pressing F11 on keyboard to launch directly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F11' && !isAnimatingOut && !isHidden) {
        e.preventDefault(); // Prevent default F11 to handle it via our API if possible, or just launch
        handleEnterFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnimatingOut, isHidden]);

  if (isHidden) return null;

  return (
    <div className={`splash-overlay ${isAnimatingOut ? 'animating-out' : ''}`}>
      <StarField />

      {/* Top Half */}
      <div className="splash-half splash-top">
        <div className="splash-content-top">
          <h1 className="splash-title">Искусство длиною в жизнь</h1>
        </div>
      </div>

      {/* Bottom Half */}
      <div className="splash-half splash-bottom">
        <div className="splash-content-bottom">
          <img 
            src={`${import.meta.env.BASE_URL}main_photo.jpg`} 
            alt="Рузанна Манвелян" 
            className="splash-photo-rect"
            draggable="false"
          />
          <div className="splash-text-block">
            <h2 className="splash-subtitle">
              ЛИЧНОЕ ПОРТФОЛИО
              <br/>
              <span className="splash-name-highlight">РУЗАННЫ МАНВЕЛЯН</span>
            </h2>
            <p className="splash-hint">Альбом лучше всего смотрится в полноэкранном режиме</p>
            <div className="splash-buttons">
              <button className="splash-btn primary" onClick={handleEnterFullscreen}>
                Запустить (F11)
              </button>
              <button className="splash-btn secondary" onClick={handleEnterNormal}>
                Обычный режим
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
