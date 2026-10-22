// Mechanical JSX tag/import migration only; values, options and handlers stay.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
const files=[];
function list(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())list(file);else if(file.endsWith('.jsx'))files.push(file);}}
list('src');
const results=[];
for(const file of files){
  if(['src/components/ui/select.jsx','src/components/ui/NativeSelect.jsx'].includes(file))continue;
  const source=fs.readFileSync(file,'utf8'),ast=parse(source,{sourceType:'module',plugins:['jsx']}),edits=[];
  function walk(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='JSXElement'&&node.openingElement.name.type==='JSXIdentifier'&&node.openingElement.name.name==='select'){
      for(const tag of [node.openingElement,node.closingElement].filter(Boolean))edits.push({start:tag.name.start,end:tag.name.end,text:'NativeSelect'});
    }
    for(const [key,value] of Object.entries(node)){if(['loc','start','end','extra'].includes(key))continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  }
  walk(ast);if(!edits.length)continue;
  if(/\b(?:const|let|function|class)\s+NativeSelect\b|import[^\n]+\bNativeSelect\b/.test(source))throw Error('Name conflict: '+file);
  let next=source;for(const edit of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);
  const directive=ast.program.directives.at(-1),position=directive?directive.end:0;
  next=next.slice(0,position)+'\nimport NativeSelect from "@/components/ui/NativeSelect";\n'+next.slice(position);
  fs.writeFileSync(file,next);results.push({file,tags:edits.length/2});
}
console.log(JSON.stringify({files:results.length,results},null,2));
if(results.length)fs.writeFileSync('scripts/legacy-select-migration.json',JSON.stringify({baseline:'68400513af7101ac96c9bfbdcf34b5b40fe5db0a',files:results},null,2)+'\n');

