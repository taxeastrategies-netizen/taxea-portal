// Reversible UI preferences only. Never use for journals, payments or invoices.
export async function savePreference({previous,next,optimistic,persist,rollback}){
  optimistic(next);
  try{await persist(next);return {ok:true,value:next};}
  catch{rollback(previous);return {ok:false,value:previous};}
}

