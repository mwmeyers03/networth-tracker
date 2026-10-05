import {clone,validate} from './plan.mjs';
import {project} from './project.mjs';
import {sequence,seeded,quantile} from './simulate.mjs';
import {failureDiagnosis} from './diagnostics.mjs';
export function decisionPlan(plan,{delay=0,spending=1}={}){
 const p=clone(plan),first=Math.min(...plan.people.map(x=>x.retireYear));
 p.people.forEach(x=>x.retireYear+=delay);
 if(p.retirementBudget?.enabled)p.retirementBudget.annual*=spending;
 // Only explicitly tagged phases and the legacy retirement budget move. Absolute
 // events, annual overrides, housing and salary quotes keep their calendar dates.
 p.expenses.forEach(e=>{
  const retirement=e.phase==='retirement'||e.id==='retire';
  if(retirement){
   // Envelope mode reduces its allowance, while the projection enforces the
   // essential floor. Category mode must preserve explicitly essential costs.
   if(p.retirementBudget?.enabled||e.essential!==true)e.annual*=spending;
   if(e.start===first)e.start+=delay;
  }
  else if(e.end===first-1&&(e.id==='joint'||e.phase==='working'))e.end+=delay;
 });
 if(p.conversionStart===first)p.conversionStart+=delay;
 if(p.acaStart===first)p.acaStart+=delay;
 p.name=`First retirement ${first+delay} · ${Math.round(spending*100)}% budget`;
 return p;
}
export function decisionCases(plan,step=2,cutStep=.1){return [0,step,step*2].flatMap(delay=>[1,1-cutStep,1-cutStep*2].map(spending=>({id:`${delay}-${spending}`,delay,spending,plan:decisionPlan(plan,{delay,spending})})));}
export function explore(plan,{count=100,seed=2026,step=2,cutStep=.1,target=.9,mode='montecarlo'}={},progress=(_value=0)=>{void _value;}){
 if(!Number.isInteger(count)||count<50||count>500||!Number.isInteger(seed)||seed<0||seed>2147483647||!Number.isInteger(step)||step<1||step>10||!Number.isFinite(cutStep)||cutStep<=0||cutStep>.25||!Number.isFinite(target)||target<=0||target>1||!['montecarlo','bootstrap'].includes(mode))throw Error('Invalid decision settings: check paths, seed, date spacing, cut size and threshold.');
 const planErrors=validate(plan);if(planErrors.length)throw Error(planErrors.join('\n'));
 const cases=decisionCases(plan,step,cutStep);for(const c of cases){const errors=validate(c.plan);if(errors.length)throw Error(errors.join('\n'));const first=Math.min(...c.plan.people.map(person=>person.retireYear));if(first<c.plan.startYear||first>c.plan.endYear)throw Error(`First retirement ${first} is outside ${c.plan.startYear}–${c.plan.endYear}. Reduce date spacing or extend the forecast before comparing retirement choices.`);}
 const rng=seeded(seed),samples=cases.map(()=>[]);
 for(let trial=0;trial<count;trial++){
  // Generate once from the reference plan, then reuse the EXACT nominal returns
  // and inflation in every case, including cases with later retirement dates.
  const path=sequence(plan,mode,rng,trial,{blockLength:5,inflationMode:'fixed'});
  cases.forEach((c,i)=>{const r=project(c.plan,path,{skipValidation:true}),d=failureDiagnosis(r);samples[i].push({overruns:r.rows.filter(x=>(x.budget?.overrun??0)>1).length,penalties:r.rows.some(x=>(x.earlyWithdrawalPenalty??0)>1),success:r.success,firstFailure:r.firstFailure,type:d?.type??null,entry:r.retirement.openingRealPortfolio,cuts:r.rows.reduce((v,x)=>v+x.spendingReduction/x.inflationIndex,0),ending:r.terminal.realPortfolio});});
  if(trial%5===0)progress(trial/count);
 }
 const rows=cases.map((c,i)=>{
  const s=samples[i],successes=s.filter(x=>x.success).length,p=successes/count,z=1.96,denom=1+z*z/count,center=(p+z*z/(2*count))/denom,margin=z*Math.sqrt(p*(1-p)/count+z*z/(4*count*count))/denom;
  return {...c,firstRetirement:Math.min(...c.plan.people.map(person=>person.retireYear)),budgetEnabled:!!c.plan.retirementBudget?.enabled,annualBudget:c.plan.retirementBudget?.enabled?c.plan.retirementBudget.annual:null,penaltyRate:s.filter(x=>x.penalties).length/count,successRate:p,withinBudgetSuccessRate:s.filter(x=>x.success&&x.overruns===0).length/count,budgetOverrunRate:s.filter(x=>x.overruns>0).length/count,interval:[Math.max(0,center-margin),Math.min(1,center+margin)],noCutSuccessRate:s.filter(x=>x.success&&x.cuts<1).length/count,guardrailCutRate:s.filter(x=>x.cuts>=1).length/count,medianCuts:quantile(s.map(x=>x.cuts),.5),entry:quantile(s.map(x=>x.entry),.5),ending:quantile(s.map(x=>x.ending),.5),improvedPaths:s.filter((x,j)=>x.success&&!samples[0][j].success).length/count,worsePaths:s.filter((x,j)=>!x.success&&samples[0][j].success).length/count,accessGaps:s.filter(x=>x.type==='access-gap').length/count};
 });
 const requiredCuts=[0,step,step*2].map(delay=>{
  const candidates=rows.filter(r=>r.delay===delay);
  const passing=candidates.filter(r=>r.withinBudgetSuccessRate>=target).sort((a,b)=>b.spending-a.spending)[0];
  // Keep the best observed result even when the requested threshold is not
  // reached. This lets the UI distinguish “the grid did not meet the target”
  // from a worker or calculation failure.
  const bestWithinBudget=[...candidates].sort((a,b)=>b.withinBudgetSuccessRate-a.withinBudgetSuccessRate||b.spending-a.spending)[0];
  const bestFunded=[...candidates].sort((a,b)=>b.successRate-a.successRate||b.spending-a.spending)[0];
  return {
   year:Math.min(...plan.people.map(person=>person.retireYear))+delay,
   cut:passing?1-passing.spending:null,
   maxTestedCut:cutStep*2,
   bestTestedCut:bestWithinBudget?1-bestWithinBudget.spending:null,
   bestTestedWithinBudgetSuccessRate:bestWithinBudget?.withinBudgetSuccessRate??null,
   bestTestedFundedRate:bestFunded?.successRate??null,
   bestTestedFundedCut:bestFunded?1-bestFunded.spending:null
  };
 });
 return {rows,requiredCuts,count,seed,mode,target,step,cutStep,targetBasis:plan.retirementBudget?.enabled?'funded_without_protected_overruns':'funded_bills',referenceRetirement:Math.min(...plan.people.map(x=>x.retireYear))};
}
export function sensitivities(plan){
 const base=project(plan),entry=r=>r.retirement.openingRealPortfolio;
 const changes=[['Salary −10%',p=>p.people.forEach(x=>x.salary*=.9),'Gross salary quote; promotions stay at their entered amounts.'],['Stocks −1 percentage point',p=>{p.stockReturn-=.01;p.retirementStockReturn=(p.retirementStockReturn??plan.stockReturn)-.01;},'Expected returns in your selected units.'],['Retire two years later',p=>Object.assign(p,decisionPlan(p,{delay:2})),'Retirement/working budget phases move; absolute events stay fixed.'],['Retirement budget −10%',p=>Object.assign(p,decisionPlan(p,{spending:.9})),'Envelope target or tagged retirement expenses; minimum living costs, housing and coverage prices stay fixed.']];
 return changes.map(([label,edit,note])=>{const p=clone(plan);edit(p);try{const r=project(p);if(!base.retirement||!r.retirement)return {label,note:`${note} First retirement is outside the forecast in one input set; extend the horizon to compare it.`,unavailable:true};return {label,note,entryChange:entry(r)-entry(base),gapYear:r.firstFailure,baselineGap:base.firstFailure,terminalChange:r.terminal.realPortfolio-base.terminal.realPortfolio};}catch{return {label,note,unavailable:true};}}).sort((a,b)=>Math.abs(b.terminalChange??0)-Math.abs(a.terminalChange??0));
}
