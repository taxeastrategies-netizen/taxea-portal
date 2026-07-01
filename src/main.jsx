import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Suppress non-critical "Unexpected end of input" errors from the SDK's
// WebSocket agent subscription (JSON.parse on empty/incomplete messages).
// Only suppress at the reporting level — do NOT patch JSON.parse globally
// as that silently swallows real HTTP response errors.
const SUPPRESS = 'Unexpected end of input';

const _origConsoleError = console.error.bind(console);
console.error = function (...args) {
  if (args.some(a => (typeof a === 'string' ? a : a?.message || '')?.includes?.(SUPPRESS))) return;
  return _origConsoleError(...args);
};

const _origOnError = window.onerror;
window.onerror = function (message) {
  if (typeof message === 'string' && message.includes(SUPPRESS)) return true;
  if (_origOnError) return _origOnError.apply(this, arguments);
};

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (msg.includes(SUPPRESS)) event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)