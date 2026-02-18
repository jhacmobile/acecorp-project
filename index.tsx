
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

const displayBootError = (error: any) => {
  if (container) {
    container.innerHTML = `
      <div style="padding: 40px; color: #7f1d1d; background: #fef2f2; font-family: 'Inter', sans-serif; border-radius: 32px; margin: 40px; border: 2px solid #fecaca; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);">
        <h2 style="margin-top:0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; font-style: italic;">System Load Alert</h2>
        <p style="font-size: 14px; font-weight: 600; color: #991b1b; margin-bottom: 20px;">The AceCorp Core failed to mount. This is usually due to an environment conflict.</p>
        <pre style="background: white; padding: 20px; border-radius: 16px; font-size: 11px; overflow: auto; border: 1px solid #fee2e2;">${error}</pre>
        <button onclick="window.location.reload()" style="margin-top: 24px; padding: 14px 28px; background: #dc2626; color: white; border: none; border-radius: 16px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em;">Re-Link System</button>
      </div>
    `;
  }
};

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error('Mount Error:', err);
    displayBootError(err);
  }
}

// Global Exception Tracking
window.addEventListener('error', (e) => {
  console.error('AceCorp Runtime Error:', e.message);
  // Only show the error if the root is empty (indicating a white screen)
  if (container && container.innerHTML === '') {
    displayBootError(e.message);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('AceCorp Async Error:', e.reason);
});
