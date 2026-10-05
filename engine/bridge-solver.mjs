import {project} from './project.mjs';
import {TwoPassBridgeSolver} from '../packages/engine/runtime/bridge/solver.js';
/** Read-only deterministic proposal. All evaluations retain the identical input path. */
export function solveBridge(plan,returns=null,{maxExtra=50000,maxIterations=24}={}){
 const solver=new TwoPassBridgeSolver();
 const noPenaltyPlan=structuredClone(plan);noPenaltyPlan.withdrawalPolicy={order:'taxable_first',...plan.withdrawalPolicy,allowPenalties:false};
 const baselineProjection=project(noPenaltyPlan,returns);
 const indexAt=year=>baselineProjection.rows.find(r=>r.year===year)?.inflationIndex??1;
 const evaluate=candidate=>{
  const next=structuredClone(noPenaltyPlan);next.relaxedConversionYears=candidate.conversions.map(c=>c.year);
  for(const c of candidate.conversions){const index=indexAt(c.year);next.overrides[c.year]={...next.overrides[c.year],conversion:c.amount*index};}
  // This adapter deliberately does not synthesize unverified SEPP schedules.
  const result=project(next,returns,{skipValidation:true});
  return {years:result.rows.map(r=>({year:r.year,investableAssets:r.realPortfolio,netWorth:r.netWorth/r.inflationIndex,accessible:r.accessible/r.inflationIndex,spendingGap:r.shortfall/r.inflationIndex,conversion:r.conversion/r.inflationIndex,ordinaryTax:r.federalTax/r.inflationIndex,healthcareCost:r.healthcare.cost/r.inflationIndex,subsidy:(r.healthcare.credit??0)/r.inflationIndex}))};
 };
 const solution=solver.solve({firstRetirementYear:Math.min(...plan.people.map(p=>p.retireYear)),lastConversionYear:plan.endYear,maxExtraConversionPerYear:maxExtra,maxIterations,evaluate});
 const proposedPlan=structuredClone(plan);proposedPlan.name=`${plan.name.slice(0,80)} · bridge proposal`;proposedPlan.relaxedConversionYears=solution.candidate.conversions.map(c=>c.year);
 for(const c of solution.candidate.conversions){const index=indexAt(c.year);proposedPlan.overrides[c.year]={...proposedPlan.overrides[c.year],conversion:c.amount*index};}
 proposedPlan.assumptions.push({id:'bridge-fallback-proposal',confirmed:false,text:'Deterministic bridge candidate: listed annual conversion caps relaxed, with five-tax-year seasoning. Conversion amounts are held fixed when the copied scenario is stress-tested. Healthcare tradeoffs require actual enabled quotes; no SEPP eligibility is inferred. This does not establish a success probability.'});
 return {...solution,proposedPlan,healthcareEstimated:plan.healthcare?.enabled===true};
}
