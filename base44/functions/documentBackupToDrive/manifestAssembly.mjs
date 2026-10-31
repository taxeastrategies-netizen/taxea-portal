const fail=code=>{throw Error(code);},encoder=new TextEncoder();
const digest=v=>/^[a-f0-9]{64}$/.test(v||'');
function validateParts(parts,total){let cursor=0;if(!Array.isArray(parts))fail('BACKUP_MANIFEST_PART_INVALID');for(const p of parts){if(p.start!==cursor||!Number.isSafeInteger(p.count)||p.count<1||!digest(p.sha256)||!/^[A-Za-z0-9_-]{1,200}$/.test(p.id||''))fail('BACKUP_MANIFEST_PART_GAP');cursor+=p.count;}if(cursor!==total)fail('BACKUP_MANIFEST_COUNT_MISMATCH');}
async function readVerifiedPart(part,options){const{readPart,hash,documents,jobId}=options,bytes=await readPart(part.id);if(await hash(bytes)!==part.sha256)fail('BACKUP_MANIFEST_PART_HASH_MISMATCH');let page;try{page=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('BACKUP_MANIFEST_PART_INVALID');}if(![1,2].includes(page.version)||page.jobId!==jobId||page.start!==part.start||page.entries?.length!==part.count)fail('BACKUP_MANIFEST_PART_INVALID');for(let i=0;i<page.entries.length;i++){const item=page.entries[i],expected=documents[part.start+i];if(item.documentEntity!==expected?.source.entity||item.documentId!==expected?.record.id||item.clientAccountId!==expected?.record[expected.source.companyField])fail('BACKUP_MANIFEST_SOURCE_MISMATCH');}return page.entries;}
export async function advanceManifestAssembly(options){
 const{jobId,sourceIndexChecksum,documents,sourceParts,hash,writePart,persist,deadline,now=Date.now}=options;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(jobId||'')||!digest(sourceIndexChecksum)||!Array.isArray(documents))fail('BACKUP_MANIFEST_ASSEMBLY_INVALID');
 validateParts(sourceParts,documents.length);const sourceDigest=await hash(encoder.encode(JSON.stringify({jobId,sourceIndexChecksum,sourceParts})));
 let state=options.state?JSON.parse(JSON.stringify(options.state)):{version:1,jobId,sourceDigest,level:0,cursor:0,inputParts:null,outputParts:[]};
 if(state.version!==1||state.jobId!==jobId||state.sourceDigest!==sourceDigest||!Number.isSafeInteger(state.level)||state.level<0||!Number.isSafeInteger(state.cursor)||state.cursor<0)fail('BACKUP_MANIFEST_ASSEMBLY_INVALID');
 const input=state.level===0?sourceParts:state.inputParts;validateParts(input,documents.length);
 if(state.cursor>input.length||!Array.isArray(state.outputParts))fail('BACKUP_MANIFEST_ASSEMBLY_INVALID');
 const expectedPrefix=state.cursor===input.length?documents.length:(input[state.cursor]?.start||0);validateParts(state.outputParts,expectedPrefix);
 if(input.length<=24)return{ready:true,parts:input,state};
 const start=input[state.cursor]?.start,entries=[];let cursor=state.cursor;
 while(cursor<input.length&&cursor<state.cursor+40){if(now()>deadline-12000)break;const selected=input.slice(cursor,Math.min(input.length,cursor+5,state.cursor+40));const pages=await Promise.all(selected.map(part=>readVerifiedPart(part,options)));for(const page of pages)entries.push(...page);cursor+=selected.length;}
 if(!entries.length)return{ready:false,state,partsDone:state.cursor,partsTotal:input.length,level:state.level};
 const payload=JSON.stringify({version:2,jobId,start,entries}),bytes=encoder.encode(payload),sha256=await hash(bytes);
 const saved=await writePart(`manifest_compact_${jobId}_L${state.level}_${start}.json`,payload);
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(saved?.id||''))fail('BACKUP_MANIFEST_ASSEMBLY_UNVERIFIED');
 state={...state,cursor,outputParts:[...state.outputParts,{start,count:entries.length,id:saved.id,sha256}]};
 if(cursor===input.length){validateParts(state.outputParts,documents.length);state={...state,level:state.level+1,cursor:0,inputParts:state.outputParts,outputParts:[]};}
 await persist(state);return{ready:false,state,partsDone:cursor,partsTotal:input.length,level:state.level};
}
export async function readAssembledManifest(options){validateParts(options.parts,options.documents.length);if(options.parts.length>24)fail('BACKUP_MANIFEST_ASSEMBLY_NOT_READY');const entries=[];for(let offset=0;offset<options.parts.length;offset+=5){const pages=await Promise.all(options.parts.slice(offset,offset+5).map(part=>readVerifiedPart(part,options)));for(const page of pages)entries.push(...page);}return entries;}
