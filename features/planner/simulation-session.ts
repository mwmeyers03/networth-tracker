export type SimulationSessionState<T>={contextKey:string|null;status:'idle'|'running'|'done'|'error'|'cancelled';progress:number;result:T|null;error:string};
type TaskCallbacks<T>={onProgress:(value:number)=>void;onResult:(result:T)=>void;onError:(message:string)=>void};
type Start<T,P>=(payload:P,callbacks:TaskCallbacks<T>)=>{cancel:()=>void}|null;

// The owning dashboard stays mounted while a drawer is open. Context keys tie
// every result to its exact plan and method; late messages cannot revive a job.
export function createSimulationSession<T,P>(start:Start<T,P>){
 let state:SimulationSessionState<T>={contextKey:null,status:'idle',progress:0,result:null,error:''};
 let handle:{cancel:()=>void}|null=null,generation=0;
 const listeners=new Set<()=>void>();
 const emit=(next:SimulationSessionState<T>)=>{state=next;listeners.forEach(listener=>listener());};
 const stop=()=>{generation++;handle?.cancel();handle=null;};
 return {
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  getSnapshot(){return state;},
  start(contextKey:string,payload:P){
   stop();const current=generation;
   emit({contextKey,status:'running',progress:0,result:null,error:''});
   const active=()=>current===generation&&state.contextKey===contextKey&&state.status==='running';
   try{
    const task=start(payload,{
     onProgress:progress=>{if(active())emit({...state,progress});},
     onResult:result=>{if(active()){handle=null;emit({...state,status:'done',progress:1,result});}},
     onError:error=>{if(active()){handle=null;emit({...state,status:'error',error});}}
    });
    if(active()){
     handle=task;
     if(!task)emit({...state,status:'error',error:'The test could not start. Refresh the page and try again.'});
    }
   }catch(error){if(active())emit({...state,status:'error',error:error instanceof Error?error.message:String(error)});}
  },
  cancel(){if(state.status!=='running')return;stop();emit({...state,status:'cancelled',progress:0});},
  release(contextKey:string){
   if(state.contextKey!==contextKey)return;
   stop();emit({contextKey:null,status:'idle',progress:0,result:null,error:''});
  }
 };
}
