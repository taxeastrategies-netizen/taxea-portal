import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Suppress non-critical "Unexpected end of input" errors from the SDK's
// WebSocket agent subscription (JSON.parse on empty/incomplete messages).
// These do not affect functionality — the next WebSocket update re-syncs state.
const SUPPRESS_PATTERN = 'Unexpected end of input';

const _origConsoleError = console.error.bind(console);
console.error = function (...args) {
  const matches = args.some(a =>
    typeof a === 'string' ? a.includes(SUPPRESS_PATTERN) :
    a?.message?.includes?.(SUPPRESS_PATTERN) ||
    (a instanceof Error && a.message?.includes(SUPPRESS_PATTERN))
  );
  if (matches) return; // suppress
  return _origConsoleError(...args);
};

const _origOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  if (typeof message === 'string' && message.includes(SUPPRESS_PATTERN)) {
    return true; // suppress
  }
  if (_origOnError) return _origOnError(message, source, lineno, colno, error);
};

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (msg.includes(SUPPRESS_PATTERN)) {
    event.preventDefault(); // suppress
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)