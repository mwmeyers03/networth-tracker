/** A late reload must not replace edits or rewind an acknowledged save. */
export function createLoadGuard({getDraftVersion=undefined,getSaveState}){
 let generation=0,draftVersion=0;
 const currentDraft=getDraftVersion??(()=>draftVersion);
 const isCurrent=(ticket,signal)=>ticket.generation===generation&&!signal?.aborted;
 return {
  markEdited(){draftVersion++;},
  begin(){const state=getSaveState();return {generation:++generation,draftVersion:currentDraft(),revision:state.revision,snapshot:state.snapshot};},
  isCurrent,
  assertUnchanged(ticket,signal){
   if(!isCurrent(ticket,signal))throw Error('This reload was superseded or cancelled.');
   const state=getSaveState();
   if(ticket.draftVersion!==currentDraft()||ticket.revision!==state.revision||ticket.snapshot!==state.snapshot||state.phase==='saving')throw Error('Your draft or saved version changed while reloading. It was kept; export or retry reload when ready.');
  }
 };
}
