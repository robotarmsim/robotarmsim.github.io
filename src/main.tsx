import React from 'react';
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './css/index.css'
import App from './App.tsx'

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in HTML');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);