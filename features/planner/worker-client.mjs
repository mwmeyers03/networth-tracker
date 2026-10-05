// Start only from a user action. Vite supplies an HTTP asset URL directly;
// source import.meta.url is transformed to file:// during SSR compilation.
export function startPlannerWorker(url,payload,{onProgress,onResult,onError},{WorkerClass=globalThis.Worker}={}){
 let worker,closed=false;
 const cancel=()=>{if(closed)return;closed=true;worker?.terminate();};
 const fail=message=>{if(closed)return;cancel();onError(message);};
 try{
  if(typeof WorkerClass!=='function')throw Error('This browser cannot start background simulations.');
  if(typeof url!=='string'||!url.startsWith('/')||url.startsWith('//'))throw Error('The simulator asset URL is invalid. Refresh this page.');
  worker=new WorkerClass(url,{type:'module'});
  worker.onmessage=({data})=>{
   if(closed)return;
   if(data?.type==='progress'&&Number.isFinite(data.value)&&data.value>=0&&data.value<=1)onProgress(data.value);
   else if(data?.type==='done'&&data.result){cancel();onResult(data.result);}
   else if(data?.type==='error')fail(typeof data.error==='string'?data.error:'The simulation could not finish.');
   else fail('The simulator returned an unexpected message. Refresh this page and retry.');
  };
  worker.onerror=event=>{event.preventDefault?.();fail(event.message||'The simulator could not load. Refresh this page and retry.');};
  worker.onmessageerror=()=>fail('The simulator response could not be read. Retry the simulation.');
  worker.postMessage(payload);
  return {cancel};
 }catch(error){fail(error instanceof Error?error.message:String(error));return null;}
}
