import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Suppress non-critical "Unexpected end of input" errors from the SDK's
// WebSocket agent subscription (JSON.parse on empty/incomplete messages).
// These do not affect functionality — the next WebSocket update re-syncs state.
const _origOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  if (typeof message === 'string' && message.includes('Unexpected end of input')) {
    return true; // suppress
  }
  if (_origOnError) return _origOnError(message, source, lineno, colno, error);
};

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (msg.includes('Unexpected end of input')) {
    event.preventDefault(); // suppress
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)