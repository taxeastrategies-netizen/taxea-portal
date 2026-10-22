// Temporary feedback cards are never usable as confirmed records. This helper
// must not be used for invoices, journals, payments or accounting balances.
export function suggestionCreateOptions({queryClient,queryKey,persist}){
  const remove=id=>queryClient.setQueryData(queryKey,rows=>(rows||[]).filter(row=>row.id!==id));
  return {
    retry:false,
    onMutate:async variables=>{
      await queryClient.cancelQueries({queryKey});
      queryClient.setQueryData(queryKey,rows=>[{...variables.payload,id:variables.tempId,estado:'enviando',created_date:variables.createdAt,_optimistic:true},...(rows||[])]);
      return {tempId:variables.tempId};
    },
    mutationFn:async variables=>{const saved=await persist(variables.payload);if(!saved?.id)throw Error('Missing persistence confirmation');return saved;},
    onSuccess:(saved,_variables,context)=>queryClient.setQueryData(queryKey,rows=>[saved,...(rows||[]).filter(row=>row.id!==context?.tempId&&row.id!==saved.id)]),
    onError:(_error,_variables,context)=>remove(context?.tempId),
    onSettled:(_saved,error)=>queryClient.invalidateQueries({queryKey,refetchType:error?'active':'none'}),
  };
}
