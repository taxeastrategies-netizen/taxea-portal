import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
const files=[];
function list(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())list(file);else if(file.endsWith('.jsx'))files.push(file);}}
list('src');
const matches=[];
for(const file of files){
  if(file==='src/components/ui/select.jsx')continue;
  const source=fs.readFileSync(file,'utf8'),ast=parse(source,{sourceType:'module',plugins:['jsx']});
  function walk(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='JSXElement'&&node.openingElement.name.type==='JSXIdentifier'&&node.openingElement.name.name==='select'){
      matches.push({file,line:node.loc.start.line,attributes:node.openingElement.attributes.map(a=>a.type==='JSXSpreadAttribute'?'...':a.name.name),children:node.children.filter(c=>c.type!=='JSXText').map(c=>c.type==='JSXElement'?c.openingElement.name.name:c.type)});
    }
    for(const [key,value] of Object.entries(node)){if(['loc','start','end','extra'].includes(key))continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  }
  walk(ast);
}
console.log(JSON.stringify({count:matches.length,files:new Set(matches.map(m=>m.file)).size,special:matches.filter(m=>m.attributes.some(a=>!['value','defaultValue','onChange','disabled','className','id','aria-label','required','name','title'].includes(a))),all:matches},null,2));
