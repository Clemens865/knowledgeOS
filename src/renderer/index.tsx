import React from 'react';
import { createRoot } from 'react-dom/client';
// import App from './App';
import AppSimple from './AppSimple';
// import TestApp from './TestApp';
import './styles/globals.css';
import './styles/glass.css';

// Get the root element
const container = document.getElementById('root');
console.log('React mounting...', container);

if (!container) {
  throw new Error('Failed to find the root element');
}

// Create root and render app
const root = createRoot(container);
console.log('Rendering React app...');

try {
  root.render(
    <React.StrictMode>
      <AppSimple />
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error rendering app:', error);
  // Fallback to test app if main app fails
  root.render(
    <div style={{
      padding: '20px',
      color: 'white',
      background: 'red'
    }}>
      Error loading app: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

console.log('React app rendered');