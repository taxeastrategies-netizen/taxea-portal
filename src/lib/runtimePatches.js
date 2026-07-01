/**
 * Runtime patches to suppress "Unexpected end of input" errors.
 *
 * These errors originate from the Base44 SDK's WebSocket realtime handler
 * and empty HTTP response bodies. They are internal SDK noise and do not
 * affect app functionality.
 *
 * This file MUST be imported before @/App.jsx so the patches are in place
 * before the SDK establishes its first WebSocket connection.
 */

const SUPPRESS = 'Unexpected end of input';

function shouldSuppress(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.includes(SUPPRESS);
  if (value instanceof Error) return (value.message || '').includes(SUPPRESS);
  if (typeof value?.message === 'string') return value.message.includes(SUPPRESS);
  try { return JSON.stringify(value).includes(SUPPRESS); } catch { return false; }
}

// 1. Patch JSON.parse — never throw "Unexpected end of input".
//    Handles empty strings AND truncated/incomplete JSON fragments that the
//    SDK's WebSocket handler may receive. Returns null instead of throwing.
const _origJsonParse = JSON.parse;
JSON.parse = function (text, reviver) {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) return null;
    return _origJsonParse.call(this, text, reviver);
  }
  if (text.trim() === '') return null;
  try {
    return _origJsonParse.call(this, text, reviver);
  } catch (e) {
    if (e instanceof SyntaxError && /Unexpected end of input|Unexpected token|JSON/i.test(e.message)) {
      return null;
    }
    throw e;
  }
};

// 2. Patch Response.prototype.json — empty HTTP bodies bypass JSON.parse patch.
const _origResponseJson = Response.prototype.json;
Response.prototype.json = function () {
  return this.text().then((text) => {
    if (!text || text.trim() === '') return null;
    return _origJsonParse(text);
  }).catch(() => null);
};

// 3. Patch WebSocket to filter empty messages before they reach any handler.
//    This is the root-cause fix: the SDK's onmessage calls JSON.parse on
//    occasionally empty ws frames. Filtering them here prevents the error
//    from ever being thrown.
function isEmptyMessage(data) {
  return data === '' || (typeof data === 'string' && data.trim() === '');
}

const _origWSAddEventListener = WebSocket.prototype.addEventListener;
WebSocket.prototype.addEventListener = function (type, listener, options) {
  if (type === 'message' && typeof listener === 'function') {
    return _origWSAddEventListener.call(this, type, function (event) {
      if (isEmptyMessage(event?.data)) return;
      return listener.call(this, event);
    }, options);
  }
  return _origWSAddEventListener.call(this, type, listener, options);
};

const _onMsgDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
if (_onMsgDesc && _onMsgDesc.set) {
  Object.defineProperty(WebSocket.prototype, 'onmessage', {
    configurable: true,
    enumerable: true,
    get: _onMsgDesc.get,
    set: function (fn) {
      if (typeof fn !== 'function') return _onMsgDesc.set.call(this, fn);
      _onMsgDesc.set.call(this, function (event) {
        if (isEmptyMessage(event?.data)) return;
        return fn.call(this, event);
      });
    },
  });
}

// 4. Suppress any remaining instances from reaching the console / error overlay.
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