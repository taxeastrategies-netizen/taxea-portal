import {markNotificationReads} from './notificationRead.mjs';

// Optimistic cache lifecycle for reversible read markers only, never finance.
export function notificationReadOptions({queryClient,queryKey,persist}){
  const restore=ids=>queryClient.setQueryData(queryKey,rows=>(rows||[]).map(row=>ids.includes(row.id)?{...row,leida:false}:row));
  return {
    retry:false,
    onMutate:async({ids})=>{
      await queryClient.cancelQueries({queryKey});
      const previous=queryClient.getQueryData(queryKey)||[],wanted=new Set(ids);
      const affected=[...new Set(previous.filter(row=>wanted.has(row.id)&&!row.leida).map(row=>row.id))];
      queryClient.setQueryData(queryKey,previous.map(row=>affected.includes(row.id)?{...row,leida:true}:row));
      return {affected};
    },
    mutationFn:({rows,ids})=>markNotificationReads({rows,ids,persist,optimistic(){},rollback(){}}),
    onSuccess:(result,_variables,context)=>restore((context?.affected||[]).filter(id=>result.failed.includes(id))),
    onError:(_error,_variables,context)=>restore(context?.affected||[]),
    onSettled:()=>queryClient.invalidateQueries({queryKey}),
  };
}

