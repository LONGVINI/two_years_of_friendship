import React, { useState } from 'react'
import Book from './components/Book'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  return (
    <div className="app-container">
      {/* Decorative ambient lights that morph based on era colors */}
      <div className="ambient-light"></div>
      <div className="ambient-light-secondary"></div>
      
      {/* Core Book Component */}
      <Book />
      
      {/* Splash Screen Overlay */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
    </div>
  )
}
