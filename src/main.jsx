import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Fix root cause: the SDK's WebSocket agent subscription calls JSON.parse()
// on empty/incomplete messages, throwing "Unexpected end of input".
// Patch JSON.parse to return {} for empty/whitespace-only input so the
// SDK's `if (data._message)` check is simply skipped — no error thrown.
const _origJSONParse = JSON.parse;
JSON.parse = function (text, reviver) {
  if (typeof text === 'string' && text.trim() === '') {
    return {};
  }
  return _origJSONParse.call(this, text, reviver);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)