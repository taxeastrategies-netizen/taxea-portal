// Read-only comparison: run the existing synthetic suite against the entry
// points from the pre-security checkpoint without replacing application files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as esbuild from 'esbuild';
const ref='f801bfa4ac29b8ae36fc16c04cddf8ce36167a24';
let source=fs.readFileSync('scripts/test-tax-accounting-phase4.mjs','utf8').replace(/^import .*;\r?\n/gm,'');
source=source.replace("entryPoints: [path.resolve(entry)],", "stdin: {contents: execFileSync('git',['show',ref+':'+entry],{encoding:'utf8'}),loader:'ts',resolveDir:path.dirname(path.resolve(entry))},");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
await new AsyncFunction('fs','path','vm','webcrypto','esbuild','execFileSync','ref',source)(fs,path,vm,webcrypto,esbuild,execFileSync,ref);

