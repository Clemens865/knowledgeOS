import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
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

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('React app rendered');