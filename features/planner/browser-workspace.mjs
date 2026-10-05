import {initialWorkspace,workspaceErrors} from '../../lib/workspace.mjs';
export const WORKSPACE_KEY='snooks.workspace.v1';
const MAX_BYTES=1000000;
const copy=value=>JSON.parse(JSON.stringify(value));
export function createBrowserWorkspace(storage,{locks,now=()=>new Date().toISOString()}={}){
 function read(){
  const raw=storage.getItem(WORKSPACE_KEY);
  if(raw===null)return {workspace:initialWorkspace(),revision:0,updatedAt:null};
  let data;try{data=JSON.parse(raw);}catch{throw Error('Saved data could not be decoded. It was not overwritten. Export a recovery backup before retrying.');}
  if(workspaceErrors(data.workspace).length||!Number.isInteger(data.revision)||data.revision<0)throw Error('Saved workspace is invalid. It was not overwritten; restore a validated JSON backup.');
  return copy(data);
 }
 async function save(workspace,expectedRevision){
  const write=()=>{
   const errors=workspaceErrors(workspace);if(errors.length)throw Error(errors.join(' '));
   const current=read();if(current.revision!==expectedRevision)throw Error('This plan changed in another tab. Export your draft, then reload before saving.');
   const next={workspace:copy(workspace),revision:current.revision+1,updatedAt:now()};
   const payload=JSON.stringify(next);if(new TextEncoder().encode(payload).byteLength>MAX_BYTES)throw Error('Workspace exceeds the 1 MB limit. Export a backup and reduce unused scenarios.');
   // One atomic write preserves the prior saved record if quota/storage fails.
   try{storage.setItem(WORKSPACE_KEY,payload);}catch{throw Error('Browser storage is unavailable or full. Your draft is still here; export it before leaving.');}
   return {revision:next.revision,updatedAt:next.updatedAt};
  };
  if(!locks?.request)throw Error('This browser cannot safely coordinate saves across tabs. Export your draft; use a current supported browser to save.');
  return locks.request('snooks-workspace-save',write);
 }
 function legacyBackup(){const records={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('nwt_'))records[key]=storage.getItem(key);}return records;}
 return {read,save,legacyBackup};
}
