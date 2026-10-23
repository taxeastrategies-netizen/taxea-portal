import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const e = React.createElement, baseline = 'f6dc9bd6350d9ef9876c5a5779246f9e59205bb1';
let cases = 0;
const check = (condition, message) => { assert.ok(condition, message); cases++; };
async function load(entry, extra = {}, runtime = {}) {
  const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', alias: { '@': process.cwd() + '/src' }, external: ['react', 'react-dom', 'react/jsx-runtime'], ...extra });
  const exported = {}, sandbox = { exports: exported, module: { exports: exported }, require: createRequire(import.meta.url), console, ...runtime };
  vm.runInNewContext(built.outputFiles[0].text, sandbox);
  return sandbox.module.exports.default;
}

const Cards = await load('src/components/contactos/MobileContactList.jsx');
const contacts = [
  { id: 'qa-person', nombre: 'Persona ficticia con nombre largo', nif_cif: 'FICTICIO', persona_contacto: 'Solo pruebas', pais: 'España' },
  { id: 'qa-company', nombre: 'Sociedad ficticia '.repeat(12), pais: 'Otro' },
];
const describe = contact => ({ klass: contact.id === 'qa-person' ? 'Persona' : 'Empresa', email: contact.id === 'qa-person' ? 'qa-only@example.invalid' : '', phone: contact.id === 'qa-person' ? '+000000000' : '', address: 'Dirección ficticia '.repeat(20), type: 'Cliente y proveedor', source: 'OCR', activity: '23 oct 2026' });
const events = [], props = { contacts, selected: new Set(['qa-company']), allSelected: false, onSelectAll: () => events.push('all'), onSelect: id => events.push(id), onEdit: contact => events.push('edit:' + contact.id), describeContact: describe, renderActions: contact => e('button', { 'data-qa-actions': contact.id, type: 'button' }, 'Acciones') };
const markup = renderToStaticMarkup(e(Cards, props));
check(!markup.includes('<table'), 'Mobile contacts do not require a 1380px table');
check((markup.match(/<li /g) || []).length === 2, 'Every visible contact appears once');
check((markup.match(/type="checkbox"/g) || []).length === 3, 'Page selection and per-contact selection remain available');
check((markup.match(/checked=""/g) || []).length === 1, 'Selected IDs are not replaced by layout state');
check((markup.match(/data-qa-actions=/g) || []).length === 2, 'Exactly one action set per contact');
for (const text of ['ID fiscal', 'Dirección', 'País', 'Relación', 'Origen', 'Actividad', 'Cliente y proveedor', 'Solo pruebas']) check(markup.includes(text), text + ' remains visible');
check(markup.includes('mailto:qa-only@example.invalid') && markup.includes('tel:+000000000'), 'Email/phone links preserve their original destinations');
check(markup.includes('[overflow-wrap:anywhere]') && markup.includes('minmax(0,1fr)'), 'Long names and addresses can wrap inside the viewport');
const walk = node => { if (!React.isValidElement(node)) return []; return [node, ...React.Children.toArray(node.props.children).flatMap(walk)]; };
const nodes = walk(Cards(props));
nodes.find(node => node.props['aria-label'] === 'Seleccionar contactos de esta página').props.onChange();
nodes.filter(node => node.type === 'input')[2].props.onChange();
nodes.find(node => node.type === 'button' && node.props.onClick).props.onClick();
assert.deepEqual(events, ['all', 'qa-company', 'edit:qa-person']); cases++;

// Compare all existing named operational functions, not a hand-picked happy path.
// New presenter callbacks are allowed; no existing load/sync/save/delete/export
// function or identity/account association helper may change.
function declarations(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX), result = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text !== 'Contactos' && node.name.text !== 'AnalysisHome' && node.name.text !== 'EmptyState') result.set(node.name.text, node.getText(ast));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) result.set(node.name.text, node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); return result;
}
for (const file of ['src/pages/Contactos.jsx', 'src/components/finance/analysis/AnalysisHome.jsx']) {
  const before = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }), after = fs.readFileSync(file, 'utf8');
  const oldFunctions = declarations(before, file), newFunctions = declarations(after, file);
  for (const [name, body] of oldFunctions) { assert.equal(newFunctions.get(name), body, `${file}: ${name} cannot change`); cases++; }
}
const contactSource = fs.readFileSync('src/pages/Contactos.jsx', 'utf8');
check(contactSource.includes('{mobile ? <MobileContactList') && contactSource.includes('min-w-[1380px]'), 'Only one responsive contact layout mounts, desktop table retained');
check(contactSource.includes('aria-label="Página anterior de contactos"') && contactSource.includes('aria-label="Página siguiente de contactos"'), 'Pagination controls are named');
check(contactSource.includes('flex flex-wrap items-center gap-2') && contactSource.includes('Ordenar contactos'), 'Small viewport toolbar and sort label are explicit');

// Render the real analysis home with inert child modules and seeded hook state.
// No effects run in SSR; the SDK stub throws if code tries to call a service.
const seeded = [[{ id: 'qa-import', nombre_archivo: 'Balance ficticio.xlsx', origen: 'excel_balance', estado: 'pendiente_revision', calidad_dato: 'alta', total_lineas: 10, empresa_nombre: 'EMPRESA FICTICIA', periodo_inicio: '2026-01-01' }], false, 'home', '', null];
const react = { ...React, useState: () => [seeded.shift(), () => {}] };
const realRequire = createRequire(import.meta.url);
const analysis = await load('src/components/finance/analysis/AnalysisHome.jsx', { plugins: [{ name: 'inert-analysis-dependencies', setup(build) {
  build.onResolve({ filter: /base44Client$/ }, () => ({ path: 'api', namespace: 'qa-analysis' }));
  build.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'qa-analysis' }));
  build.onResolve({ filter: /^\.\// }, args => args.importer.endsWith('AnalysisHome.jsx') ? { path: 'child', namespace: 'qa-analysis' } : undefined);
  build.onLoad({ filter: /.*/, namespace: 'qa-analysis' }, args => ({ contents: args.path === 'api' ? 'export const base44=new Proxy({}, {get(){throw Error("Unexpected external API call");}});' : args.path === 'router' ? 'export const useOutletContext=()=>({company:{id:"qa-company"}});' : 'export default function Stub(){return null;}', loader: 'js' }));
} }], external: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'] }, { require: name => name === 'react' ? react : realRequire(name) });
const analysisMarkup = renderToStaticMarkup(e(analysis));
check(analysisMarkup.includes('Balance ficticio.xlsx') && analysisMarkup.includes('EMPRESA FICTICIA'), 'Real analysis component renders seeded read-only records');
check(/<button[^>]+type="button"[^>]*>[\s\S]*Balance ficticio\.xlsx/.test(analysisMarkup), 'Imported analysis row is keyboard accessible');
check(!analysisMarkup.includes('bg-white') && analysisMarkup.includes('bg-card'), 'Cards follow theme tokens rather than white-on-dark text');
check(analysisMarkup.includes('dark:text-amber-200') && analysisMarkup.includes('dark:text-emerald-300'), 'Status and quality text have explicit dark contrast');
check(analysisMarkup.includes('Abrir PDF Balance / PyG') && analysisMarkup.includes('Abrir Excel o A3 .dat'), 'Feature navigation uses actual buttons');
check(!/<div[^>]*cursor-pointer/.test(analysisMarkup), 'No mouse-only clickable div remains in analysis home');
console.log(JSON.stringify({ ok: true, cases, realReactRender: true, callbackDispatch: true, allNamedOperationalFunctionsUnchanged: true, externalCalls: 0, financialWrites: 0 }));
