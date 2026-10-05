/** One writer at a time, with a captured draft and optimistic server revision. */
export function createSaveSession({revision=0,snapshot='',updatedAt=null,persist}){
 let state={revision,snapshot,updatedAt,phase:'idle',error:'',blocked:false},job=null;
 const listeners=new Set(),publish=next=>{state=Object.freeze({...state,...next});listeners.forEach(listener=>listener());};
 return {
  getSnapshot:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  reset(next){if(job)throw Error('Wait for the current save before reloading.');publish({revision:next.revision,snapshot:next.snapshot,updatedAt:next.updatedAt??null,phase:'idle',error:'',blocked:false});},
  save(nextSnapshot){
   if(job)return job;
   if(nextSnapshot===state.snapshot)return Promise.resolve(state);
   const expectedRevision=state.revision;
   job=Promise.resolve().then(()=>persist(nextSnapshot,expectedRevision)).then(result=>{
    if(!Number.isInteger(result.revision)||result.revision!==expectedRevision+1)throw Error('The save response has an unexpected revision. Reload after exporting your draft.');
    publish({revision:result.revision,snapshot:nextSnapshot,updatedAt:result.updatedAt??null,phase:'idle',error:'',blocked:false});return state;
   }).catch(error=>{publish({phase:'error',error:error instanceof Error?error.message:'Save failed. Your draft is unchanged.',blocked:true});throw error;}).finally(()=>{job=null;});
   publish({phase:'saving',error:'',blocked:false});
   return job;
  }
 };
}
