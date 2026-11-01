import './offline-test-guard.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
await assert.rejects(fetch('https://example.invalid/never-requested'),/forbidden/);
for(const operation of [()=>http.get('http://example.invalid'),()=>https.request('https://example.invalid'),()=>net.createConnection({port:9}),()=>new net.Socket().connect(9),()=>tls.connect({port:9}),()=>dgram.createSocket('udp4')])assert.throws(operation,/forbidden/);
const reference=URL.createObjectURL(new Blob(['Fictitious offline document']));
try{assert.equal(await (await fetch(reference)).text(),'Fictitious offline document');}finally{URL.revokeObjectURL(reference);}
console.log(JSON.stringify({ok:true,blockedNetworkEntrypoints:7,localBlobPreserved:true,realRequests:0}));
