import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Fix root cause: the SDK's WebSocket agent subscription calls JSON.parse()
// on empty/undefined/incomplete messages, throwing "Unexpected end of input".
// Catch that specific error and return {} so the SDK skips the message gracefully.
const _origJSONParse = JSON.parse;
JSON.parse = function (text, reviver) {
  try {
    return _origJSONParse.call(this, text, reviver);
  } catch (e) {
    if (e instanceof SyntaxError && e.message.includes('Unexpected end of input')) {
      return {};
    }
    throw e;
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)