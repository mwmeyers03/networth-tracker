const MAX_ENTRIES=20,MAX_BYTES=4000000;
const size=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
function bounded(entries,future=false){let bytes=entries.reduce((total,item)=>total+size(item),0);while(entries.length>MAX_ENTRIES||(bytes>MAX_BYTES&&entries.length)){bytes-=size(future?entries.pop():entries.shift());}return entries;}
export const initialHistory=()=>({present:null,past:[],future:[]});
export function workspaceHistory(state,action){
 if(action.type==='reset')return {present:structuredClone(action.value),past:[],future:[]};
 if(action.type==='undo'&&state.past.length)return {present:state.past.at(-1),past:state.past.slice(0,-1),future:bounded([state.present,...state.future],true)};
 if(action.type==='redo'&&state.future.length)return {present:state.future[0],past:bounded([...state.past,state.present]),future:state.future.slice(1)};
 if(action.type==='edit'){
  const value=typeof action.value==='function'?action.value(state.present):action.value;
  if(JSON.stringify(value)===JSON.stringify(state.present))return state;
  return {present:structuredClone(value),past:state.present?bounded([...state.past,state.present]):[],future:[]};
 }
 return state;
}
