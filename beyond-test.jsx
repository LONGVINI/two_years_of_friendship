import React from 'react';
import { createRoot } from 'react-dom/client';
import BeyondGate from './src/components/BeyondGate.jsx';

createRoot(document.getElementById('root')).render(
  <BeyondGate active onDrift={() => {}} onComplete={() => {}} onFail={() => {}} soundEnabled={false} />
);
