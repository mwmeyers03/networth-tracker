import {simulate} from '../../engine/simulate.mjs';
self.onmessage=(event:MessageEvent)=>{
 try{const {plan,options}=event.data;const result=simulate(plan,options,(value=0)=>self.postMessage({type:'progress',value}));self.postMessage({type:'done',result});}
 catch(error){self.postMessage({type:'error',error:error instanceof Error?error.message:String(error)});}
};
