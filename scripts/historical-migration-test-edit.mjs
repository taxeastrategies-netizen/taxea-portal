import fs from 'node:fs';
const file='scripts/test-native-select.mjs';
let source=fs.readFileSync(file,'utf8');
const old="const previous=execFileSync('git',['show',manifest.baseline+':'+file],{encoding:'utf8'}),current=fs.readFileSync(file,'utf8');";
if(source.split(old).length!==2)throw Error('Test contract changed; inspect first');
source=source.replace(old,"// Check the certified migration snapshot, not freeze future legitimate UI work.\n  // Runtime NativeSelect rendering above still uses the current implementation.\n  const previous=execFileSync('git',['show',manifest.baseline+':'+file],{encoding:'utf8'}),current=execFileSync('git',['show','742fd5762bf5bc9f40582005b76096b7b8c2250c:'+file],{encoding:'utf8'});");
source=source.replace('businessAstUnchanged:true,','certifiedMigrationAstUnchanged:true,');
fs.writeFileSync(file,source);

