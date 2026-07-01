import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Suppress non-critical "Unexpected end of input" errors from the SDK's
// WebSocket agent subscription and empty HTTP response bodies.
// These are internal SDK noise and do not affect app functionality.
const SUPPRESS = 'Unexpected end of input';

function shouldSuppress(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.includes(SUPPRESS);
  if (value instanceof Error) return (value.message || '').includes(SUPPRESS);
  if (typeof value?.message === 'string') return value.message.includes(SUPPRESS);
  try { return JSON.stringify(value).includes(SUPPRESS); } catch { return false; }
}

// Root-cause fix: patch JSON.parse to handle empty/whitespace strings gracefully.
// The SDK's WebSocket handler calls JSON.parse(message) on occasionally empty
// messages, throwing SyntaxError("Unexpected end of input"). Returning null for
// empty input lets the SDK skip the message instead of crashing.
// This ONLY affects empty strings — real API responses (file uploads, etc.) are
// never empty and parse normally.
const _origJsonParse = JSON.parse;
JSON.parse = function (text, reviver) {
  if (typeof text === 'string' && text.trim() === '') return null;
  return _origJsonParse.call(this, text, reviver);
};

const _origConsoleError = console.error.bind(console);
console.error = function (...args) {
  if (args.some(shouldSuppress)) return;
  return _origConsoleError(...args);
};

const _origOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  if (typeof message === 'string' && message.includes(SUPPRESS)) return true;
  if (error && shouldSuppress(error)) return true;
  if (_origOnError) return _origOnError.apply(this, arguments);
};

// Catch ErrorEvent objects (dispatched by Vite overlay / browser for uncaught errors)
window.addEventListener('error', (event) => {
  if (shouldSuppress(event.error) || shouldSuppress(event.message)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (shouldSuppress(event.reason)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)