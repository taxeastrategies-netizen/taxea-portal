// Optimism is limited to a reversible read marker, never financial records.
export async function markNotificationReads({rows,ids,persist,optimistic,rollback}){
  const wanted=new Set(ids),selected=rows.filter(row=>wanted.has(row.id)&&!row.leida).map(row=>row.id);
  if(!selected.length)return {updated:[],failed:[]};
  optimistic(selected);
  const updated=[],failed=[];
  for(let offset=0;offset<selected.length;offset+=4){
    const batch=selected.slice(offset,offset+4);
    const results=await Promise.allSettled(batch.map(id=>Promise.resolve().then(()=>persist(id))));
    results.forEach((result,index)=>(result.status==='fulfilled'?updated:failed).push(batch[index]));
  }
  if(failed.length)rollback(failed);
  return {updated,failed};
}
