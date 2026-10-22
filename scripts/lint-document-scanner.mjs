import { ESLint } from 'eslint';
import js from '@eslint/js';
import globals from 'globals';

// The application's default config intentionally ignores src/lib. Check it explicitly.
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ['**/*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, ...globals.node } }, rules: js.configs.recommended.rules }] });
const results = await eslint.lintFiles(['src/lib/documentScanner.mjs', 'src/lib/scannerProcessor.mjs', 'src/lib/documentScanner.worker.mjs', 'scripts/test-document-scanner.mjs', 'scripts/lint-document-scanner.mjs']);
const output = (await eslint.loadFormatter('stylish')).format(results);
if (output) console.log(output);
process.exitCode = results.some(result => result.errorCount) ? 1 : 0;
if (!process.exitCode) console.log('Scanner modules and tests: ESLint PASS (explicit config).');

