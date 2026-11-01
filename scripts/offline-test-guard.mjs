import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import {syncBuiltinESMExports} from 'node:module';
const deny=()=>{throw new Error('C3 offline test: external networking is forbidden');};
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
 if(typeof url==='string'&&/^(?:blob:|data:)/.test(url))return nativeFetch(input,init);
 return Promise.reject(new Error('C3 offline test: external fetch is forbidden'));
};
for(const api of [http,https])for(const method of ['request','get'])api[method]=deny;
net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;tls.connect=deny;dgram.createSocket=deny;
globalThis.WebSocket=class{constructor(){deny();}};
syncBuiltinESMExports();
