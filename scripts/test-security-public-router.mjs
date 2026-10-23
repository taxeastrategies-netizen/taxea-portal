import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter, Route, Routes } from 'react-router-dom';
import { transform } from 'esbuild';

let source = fs.readFileSync('src/App.jsx', 'utf8');
if (process.argv.includes('--candidate')) {
  const edits = [
    ['        <Route path="/public/invoice/:token" element={<PublicInvoiceViewer />} />\n', ''],
    ['        <Route path="/setup-password" element={<SetupPassword />} />\n', ''],
    ['        <Route path="/reset-password" element={<ResetPassword />} />\n', ''],
    ['            <Route path="/eliminar-cuenta" element={<AccountDeletionInfo/>}/>', '            <Route path="/public/invoice/:token" element={<PublicInvoiceViewer />} />\n            <Route path="/setup-password" element={<SetupPassword />} />\n            <Route path="/reset-password" element={<ResetPassword />} />\n            <Route path="/eliminar-cuenta" element={<AccountDeletionInfo/>}/>'],
  ];
  for (const [oldText, newText] of edits) { assert.ok(source.includes(oldText)); source = source.replace(oldText, newText); }
}
const start = source.indexOf('function App() {');
assert.ok(start >= 0);
const appSource = source.slice(start).replace('export default App;', 'globalThis.__App = App;');
const built = await transform(appSource, { loader: 'jsx', format: 'cjs', jsxFactory: 'React.createElement' });
let checks = 0;
const passThrough = ({ children }) => children;
for (const authState of ['no-session', 'auth-required', 'expired', 'loading', 'registered']) {
  for (const [pathname, expected] of [
    ['/public/invoice/' + 'a'.repeat(64), 'public-invoice'],
    ['/setup-password#token=synthetic', 'public-setup'],
    ['/reset-password?token=synthetic', 'public-reset'],
    ['/eliminar-cuenta', 'public-deletion-info'],
    ['/tax-accounting/facturas', 'private-auth-gate'],
    ['/admin/users', 'private-auth-gate'],
    ['/', 'private-auth-gate'],
  ]) {
    let privateRenders = 0;
    const context = vm.createContext({
      React, Suspense: React.Suspense, ThemeProvider: passThrough, MotionConfig: passThrough,
      AuthProvider: passThrough, QueryClientProvider: passThrough, queryClientInstance: {},
      Router: ({ children }) => React.createElement(StaticRouter, { location: pathname }, children),
      Route, Routes, PageLoader: () => null, Toaster: () => null,
      PublicInvoiceViewer: () => React.createElement('span', null, 'public-invoice'),
      SetupPassword: () => React.createElement('span', null, 'public-setup'),
      ResetPassword: () => React.createElement('span', null, 'public-reset'),
      AccountDeletionInfo: () => React.createElement('span', null, 'public-deletion-info'),
      AuthenticatedApp: () => { privateRenders++; return React.createElement('span', { 'data-qa-auth': authState }, 'private-auth-gate'); },
    });
    vm.runInContext(built.code, context);
    const html = renderToStaticMarkup(React.createElement(context.__App));
    assert.ok(html.includes(expected), `${pathname} must render ${expected}`); checks++;
    assert.equal(privateRenders, expected === 'private-auth-gate' ? 1 : 0, 'Public capability must not evaluate private auth gate'); checks++;
  }
}
assert.equal((source.match(/path="\/public\/invoice\/:token"/g) || []).length, 1); checks++;
console.log(JSON.stringify({ ok: true, checks, actualAppRouting: true, realReact: true, realRouter: true, providerAuthSimulated: true, networkCalls: 0, realCustomerData: 0 }));
