import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', './jsconfig.json', '--pretty', 'false'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.status == null) throw new Error('El proceso de TypeScript no devolvió un estado verificable.');
const output = `${result.stdout || ''}${result.stderr || ''}`;
const lines = output.split(/\r?\n/).filter(Boolean);
const allErrors = lines.filter(line => line.includes('error TS'));
const taxPath = /^src[\\/](components[\\/]tax|components[\\/]facturas|pages[\\/](TaxAccounting|Facturas|IngresosGastos|LectorGastos|LectorIngresos|LibroRegistros|ObligacionesFiscales))/;
const scopedErrors = allErrors.filter(line => taxPath.test(line));

console.log(JSON.stringify({
  ok: scopedErrors.length === 0,
  scopedErrors: scopedErrors.length,
  repositoryErrorsOutsideScope: allErrors.length - scopedErrors.length,
  scope: 'Tax & Accounting activo, facturas, OCR y calendario fiscal',
}, null, 2));
if (scopedErrors.length) {
  console.error(scopedErrors.join('\n'));
  process.exitCode = 1;
}
