import React from 'react'
import Book from './components/Book'

export default function App() {
  return (
    <div className="app-container">
      {/* Decorative ambient lights that morph based on era colors */}
      <div className="ambient-light"></div>
      <div className="ambient-light-secondary"></div>
      
      {/* Core Book Component */}
      <Book />
    </div>
  )
}
