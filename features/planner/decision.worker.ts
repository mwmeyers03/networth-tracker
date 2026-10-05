import {explore} from '../../engine/decisions.mjs';
self.onmessage=(event)=>{try{const result=explore(event.data.plan,event.data.options,(value=0)=>self.postMessage({type:'progress',value}));self.postMessage({type:'done',result});}catch(e){self.postMessage({type:'error',error:(e as Error).message});}};
