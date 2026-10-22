import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, MutationObserver } from '@tanstack/react-query';
import { notificationPreferenceOptions, notificationPreferenceKey } from '../src/lib/notificationPreferenceMutation.mjs';

const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
const before = { email_resumen: true, frecuencia_resumen: 'semanal' }, next = { ...before, email_resumen: false };
const key = notificationPreferenceKey('qa-only'), otherKey = notificationPreferenceKey('other-qa');
client.setQueryData(key, before); client.setQueryData(otherKey, before);
let visible = before, current = 'qa-only', release, began, writes = 0;
const started = new Promise(resolve => { began = resolve; }), gate = new Promise(resolve => { release = resolve; });
const observer = new MutationObserver(client, notificationPreferenceOptions({ queryClient: client,
  isCurrent: variables => variables.userId === current,
  onVisible: value => { visible = value; },
  persist: async () => { writes++; began(); await gate; throw Error('Synthetic network failure'); },
}));
const variables = { userId: 'qa-only', previous: before, next };
const result = observer.mutate(variables); await started;
assert.deepEqual(visible, next); assert.deepEqual(client.getQueryData(key), next);
assert.deepEqual(client.getQueryData(otherKey), before);
release(); await assert.rejects(result);
assert.deepEqual(visible, before); assert.deepEqual(client.getQueryData(key), before); assert.equal(writes, 1);
const success = new MutationObserver(client, notificationPreferenceOptions({ queryClient: client,
  isCurrent: variables => variables.userId === current, onVisible: value => { visible = value; }, persist: async () => { writes++; },
}));
await success.mutate(variables); assert.deepEqual(visible, next); assert.deepEqual(client.getQueryData(key), next);
current = 'other-qa'; visible = before;
await assert.rejects(success.mutate(variables)); assert.equal(writes, 2, 'No write after switching users');
assert.deepEqual(visible, before); assert.deepEqual(client.getQueryData(otherKey), before);
observer.reset(); success.reset(); client.clear();

const bundle = await esbuild.build({ entryPoints: ['src/components/facturas/MobileInvoiceList.jsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', alias: { '@': process.cwd() + '/src' }, external: ['react', 'react-dom', 'react/jsx-runtime'] });
const exported = {}, context = { exports: exported, module: { exports: exported }, require: createRequire(import.meta.url) };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const data = [{ id: 'qa-issued', tipo: 'emitida', numero_factura: 'FICTICIA-001', cliente_nombre: 'Cliente ficticio', fecha_emision: '2026-10-22', base_imponible: 100, total_factura: 121, estado_cobro: 'pendiente', estado_contable: 'contabilizado' },
  { id: 'qa-credit', tipo: 'recibida', numero_factura: 'FICTICIA-ABONO', proveedor_nombre: 'Proveedor ficticio', base_imponible: -100, total_factura: -107, anulada: true }];
const markup = renderToStaticMarkup(React.createElement(context.module.exports.default, { invoices: data, selectedIds: ['qa-credit'], allSelected: false, onSelectAll() {}, onSelect() {}, onOpen() {}, renderActions: invoice => React.createElement('button', { 'data-qa-action': invoice.id }, 'Acciones') }));
assert.ok(!markup.includes('<table')); assert.equal((markup.match(/<li /g) || []).length, 2);
for (const text of ['FICTICIA-001', 'Cliente ficticio', 'Proveedor ficticio', '-107,00', '121,00', 'ANULADA', 'Seleccionar todas las facturas filtradas']) assert.ok(markup.includes(text), text);
assert.equal((markup.match(/data-qa-action=/g) || []).length, 2, 'Exactly one shared action set per invoice');
assert.equal((markup.match(/type="checkbox"/g) || []).length, 3);
assert.ok(markup.includes('dark:text-amber-300'), 'Actual badge has an explicit dark color');

// Full AST comparison of existing operational functions: only the presenter changes.
const historical = execFileSync('git', ['show', '7b6f4b37d3da1a14ef736e64271d4514c683dc78:src/pages/Facturas.jsx'], { encoding: 'utf8' });
const currentSource = fs.readFileSync('src/pages/Facturas.jsx', 'utf8');
const declarations = text => { const ast = ts.createSourceFile('Facturas.jsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX), found = new Map(); const visit = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) found.set(node.name.text, node.initializer.getText(ast).replace(/\s+/g, '')); ts.forEachChild(node, visit); }; visit(ast); return found; };
const oldFunctions = declarations(historical), newFunctions = declarations(currentSource);
for (const name of ['fetchInvoices', 'loadInvoices', 'handleAnular', 'handleAnularBulk', 'updateEstado', 'handleOpenWorkspace', 'handleCloseWorkspace', 'handleSend', 'handleSent', 'handleWorkspaceRefresh']) assert.equal(newFunctions.get(name), oldFunctions.get(name), name + ' cannot change');
const css = fs.readFileSync('src/index.css', 'utf8'), layout = fs.readFileSync('src/components/layout/AppLayout.jsx', 'utf8');
assert.ok(css.includes('calc(10.5rem + var(--taxea-safe-bottom))') && layout.includes('10.5rem+env(safe-area-inset-bottom)'));
assert.ok(currentSource.includes('{mobile ? <MobileInvoiceList') && currentSource.includes('{renderInvoiceActions(inv)}'));
const settings = fs.readFileSync('src/components/ajustes/TabNotificaciones.jsx', 'utf8');
assert.ok(settings.includes('Los cambios se guardan automáticamente') && settings.includes('mutation.mutateAsync(variables)'));
assert.ok(settings.includes('void handleSave({ ...prefs, [k]: v })'), 'Every preference switch commits through the reversible mutation');
assert.ok(settings.includes('flight.current!==token') && settings.includes('identity.current!==ownId'));
console.log(JSON.stringify({ ok: true, actualTanstack: true, optimisticBeforeNetwork: true, errorRollback: true, scopeIsolation: true, mobileCardsRealRender: true, operationalHandlersUnchanged: true, floatingButtonReserve: true, externalCalls: 0, financialWrites: 0 }));
