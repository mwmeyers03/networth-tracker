// Changing units preserves economic returns at the configured inflation rate.
export function convertReturnUnits(plan,unit){
 if(!['real','nominal'].includes(unit))throw Error('Invalid return units.');
 const next=structuredClone(plan),previous=plan.returnUnit??'nominal';
 // The legacy distribution default was the raw bond input. Freeze that nominal
 // tax yield before switching units so the same return cannot change taxes.
 if(previous!==unit&&next.bondYield===undefined)next.bondYield=Math.max(0,plan.bondReturn);
 if(previous!==unit)for(const key of ['stockReturn','bondReturn','cashReturn','retirementStockReturn','retirementBondReturn','retirementCashReturn']){
  if(next[key]!==undefined)next[key]=unit==='real'?(1+next[key])/(1+plan.inflation)-1:(1+next[key])*(1+plan.inflation)-1;
 }
 next.returnUnit=unit;
 return next;
}
export const REQUESTED_RETURNS_ID='requested-real-returns-v1';
export function requestedReturnPlan(plan){
 const next=convertReturnUnits(plan,'real');
 Object.assign(next,{stockReturn:.07,retirementStockReturn:.05,stockReturnMean:'geometric'});
 next.assumptions=next.assumptions.filter(a=>!['returns',REQUESTED_RETURNS_ID].includes(a.id));
 next.assumptions.push({id:REQUESTED_RETURNS_ID,confirmed:false,text:'Illustrative return comparison: stocks grow 7% after inflation before retirement and 5% after retirement. These are geometric annual growth assumptions, before modeled fees and household taxes, not guaranteed outcomes. Cash and bond economic returns are preserved at configured inflation; variable inflation changes their nominal paths. Monte Carlo uses the selected geometric stock-growth target; historical methods replay observed returns.'});
 return next;
}
// Leave every saved scenario intact; activate a distinct corrected copy once.
export function applyRequestedReturns(workspace){
 if(workspace.scenarios.some(s=>s.plan.assumptions?.some(a=>a.id===REQUESTED_RETURNS_ID)))return {workspace,changed:false};
 if(workspace.scenarios.length>=12)throw Error('Keep a backup and remove one scenario to make room for the corrected FIRE plan.');
 const source=workspace.scenarios.find(s=>s.id===workspace.activeId);
 if(!source)throw Error('Active scenario is missing.');
 const next=structuredClone(workspace),plan=requestedReturnPlan(source.plan);
 plan.name=`${source.plan.name.slice(0,97)} · real-return baseline`;
 let id=REQUESTED_RETURNS_ID,index=1;
 while(next.scenarios.some(s=>s.id===id))id=`${REQUESTED_RETURNS_ID}-${index++}`;
 next.scenarios.push({id,plan});next.activeId=id;
 return {workspace:next,changed:true};
}
