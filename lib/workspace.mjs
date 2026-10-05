import {DEFAULT_PLAN,clone,validate} from '../engine/plan.mjs';
import {createHandoffPlan} from '../engine/handoff.mjs';
// Compatibility factory: this is a synthetic reference, not a personal audit.
export function auditedLegacyWorkspace(){
 const plan=clone(DEFAULT_PLAN);plan.name='Schema-1 demonstration reference';
 return {version:1,activeId:'baseline',scenarios:[{id:'baseline',plan}],notes:''};
}
export function initialWorkspace(){
 return {version:1,activeId:'baseline',scenarios:[{id:'baseline',plan:createHandoffPlan()}],notes:''};
}
export function workspaceErrors(w) {
 if(!w||typeof w!=='object'||w.version!==1||!Array.isArray(w.scenarios)||w.scenarios.length<1||w.scenarios.length>12) return ['A workspace must contain 1–12 scenarios.'];
 const errors=[],ids=new Set();
 for(const s of w.scenarios) {
  if(!s||typeof s.id!=='string'||s.id.length>80||ids.has(s.id)){errors.push('Invalid or duplicate scenario ID.');continue;} ids.add(s.id);
  try{errors.push(...validate(s.plan));}catch{errors.push('Invalid plan structure.');}
 }
 if(!ids.has(w.activeId))errors.push('Active scenario is missing.');
 if(typeof w.notes!=='string'||w.notes.length>20000)errors.push('Notes must be text up to 20,000 characters.');
 return [...new Set(errors)];
}
