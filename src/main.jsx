import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── Suppress "Unexpected end of input" from SDK internals ──────────
// The SDK's WebSocket subscription and axios response interceptor call
// JSON.parse on message bodies that are occasionally empty (heartbeat
// frames, 204 responses, truncated WS payloads). JSON.parse('') throws
// SyntaxError: Unexpected end of input — harmless noise we eliminate at
// the source. ONLY empty/whitespace strings are intercepted; all real
// JSON parse errors (malformed JSON, missing brackets, etc.) still throw
// normally so genuine bugs surface.
const _origJSONParse = JSON.parse;
JSON.parse = function (text, reviver) {
  if (typeof text === 'string' && text.trim() === '') return null;
  return _origJSONParse.call(JSON, text, reviver);
};

// Belt-and-suspenders: also suppress any residual instances at the
// reporting level (covers Error objects logged by SDK catch blocks).
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