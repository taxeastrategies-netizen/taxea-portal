import assert from'node:assert/strict';import{protectionFileName}from'../base44/functions/documentBackupToDrive/legacyProtectionExecutor.mjs';
const bytes=s=>new TextEncoder().encode(s);let checks=0;for(const text of ['<?xml version="1.0"?><synthetic/>','\uFEFF<?xml version="1.0"?><synthetic/>','  <?xml version="1.0"?><synthetic/>']){assert.equal(protectionFileName({originalName:'documento'},bytes(text)),'documento.xml');checks++;}
for(const text of ['<!doctype html><html/>','<svg/>','<?xmlmalicious?>','unknown binary']){assert.throws(()=>protectionFileName({originalName:'documento'},bytes(text)),/FORMAT_REVIEW/);checks++;}
assert.throws(()=>protectionFileName({originalName:'documento'},bytes('-----BEGIN PRIVATE KEY-----')),/CERTIFICATE_REVIEW/);checks++;
assert.throws(()=>protectionFileName({originalName:'secret.p8'},bytes('<?xml version="1.0"?>')),/CERTIFICATE_REVIEW/);checks++;
for(const ext of ['130','111','303','json','txt']){const group={originalName:'Declaración de prueba',reference:'https://media.base44.com/files/public/synthetic/qa.'+ext};assert.equal(protectionFileName(group,bytes('SYNTHETIC TAX EXPORT ONLY')),'Declaración de prueba.'+ext);checks++;}
assert.equal(protectionFileName({originalName:'qa.txt',reference:'https://media.base44.com/files/public/synthetic/qa.130'},bytes('SYNTHETIC')),'qa.txt');checks++;
assert.throws(()=>protectionFileName({originalName:'sin extension',reference:'https://media.base44.com/files/public/synthetic/qa.p8'},bytes('SYNTHETIC')),/CERTIFICATE_REVIEW/);checks++;
assert.throws(()=>protectionFileName({originalName:'sin extension',reference:'https://media.base44.com/files/public/synthetic/qa.unknown'},bytes('SYNTHETIC')),/FORMAT_REVIEW/);checks++;
console.log(JSON.stringify({ok:true,checks,customerContents:0,financialWrites:0}));
