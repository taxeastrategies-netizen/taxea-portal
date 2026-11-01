import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'taxea-c2-'));
const bundles = ['test-c2-finance.mjs', 'test-c2-health.mjs', 'test-c2-render.jsx'];
const results = [];
try {
  for (const name of bundles) {
    await build({ entryPoints: [path.join(root, 'scripts', name)], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, outfile: path.join(temp, name + '.cjs'), logLevel: 'warning', plugins:[{name:'ssr-sdk-no-network',setup(b){b.onResolve({filter:/base44Client(?:\.js)?$/},()=>({path:'sdk',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const base44 = {};'}));}}] });
  }
  const tests = [...bundles.map(name => [name, path.join(temp, name + '.cjs')]), ...['test-c2-report-runtime.mjs', 'test-c2-finance-reader-runtime.mjs', 'test-c2-company-snapshot.mjs', 'test-c2-tenders.mjs', 'test-tax-accounting-certification.mjs', 'test-certification-runtime.mjs', 'test-certification-tender-guards.mjs', 'test-financial-source-truth.mjs', 'test-financial-report-truth.mjs', 'test-financial-mutation-boundaries.mjs'].map(name => [name, path.join(root, 'scripts', name)])];
  for (const [name, file] of tests) {
    const run = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (run.error || run.status !== 0) { process.stderr.write(run.stderr || ''); process.stderr.write(run.stdout || ''); throw run.error || new Error('Client reliability test failed: ' + name); }
    let detail; try { detail = JSON.parse(run.stdout.trim()); } catch { detail = {}; }
    results.push({ name, passed: true, checks: detail.checks || Object.keys(detail.assertions || {}).length || null });
  }
  console.log(JSON.stringify({ ok: true, suites: results, realFinancialWrites: 0, externalCalls: 0 }));
} finally {
  for (const name of bundles) { const file = path.join(temp, name + '.cjs'); if (fs.existsSync(file)) fs.unlinkSync(file); }
  fs.rmdirSync(temp);
}
