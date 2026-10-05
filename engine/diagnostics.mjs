import {classifyBridgeFailure} from '../packages/engine/runtime/bridge/solver.js';
import {project} from './project.mjs';

// These are descriptions and isolated what-ifs. They never change the saved plan.
export function returnSummary(plan,retired=false){
 const inflation=plan.inflation;
 const stock=retired?(plan.retirementStockReturn??plan.stockReturn):plan.stockReturn;
 const bond=retired?(plan.retirementBondReturn??plan.bondReturn):plan.bondReturn;
 const weight=retired&&plan.allocationMode!=='fixed'?(plan.retirementStockWeight??plan.stockWeight):plan.stockWeight;
 const nominal=value=>plan.returnUnit==='real'?(1+value)*(1+inflation)-1:value;
 const real=value=>(1+value)/(1+inflation)-1;
 const portfolioNominal=weight*nominal(stock)+(1-weight)*nominal(bond)-plan.fees;
 return {unit:plan.returnUnit??'nominal',stock,stockNominal:nominal(stock),stockReal:real(nominal(stock)),bondReal:real(nominal(bond)),stockWeight:weight,portfolioReal:real(portfolioNominal),inflation};
}

export function earlierReturnPlan(plan){
 const next=structuredClone(plan);
 // Switching units must not silently increase the existing bond return too.
 if(next.returnUnit!=='real'){
  const real=value=>(1+value)/(1+next.inflation)-1;
  next.bondReturn=real(next.bondReturn);
  if(next.retirementBondReturn!==undefined)next.retirementBondReturn=real(next.retirementBondReturn);
  if(next.retirementCashReturn!==undefined)next.retirementCashReturn=real(next.retirementCashReturn);
 }
 Object.assign(next,{returnUnit:'real',stockReturn:.07,retirementStockReturn:.05,cashReturn:.03,name:'Earlier FIRE return assumptions'});
 next.assumptions=next.assumptions.filter(note=>note.id!=='earlier-return-comparison');
 next.assumptions.push({id:'earlier-return-comparison',confirmed:false,text:'Comparison only: stocks assume 7% real before retirement and 5% real after; cash assumes 3% real. Existing bond assumptions and allocations are preserved. This is not a reconstruction or validation of every earlier chat input.'});
 return next;
}

export function failureDiagnosis(result){
 const row=result.rows.find(row=>row.year===result.firstFailure);
 if(!row)return null;
 const inaccessible=Math.max(0,row.portfolio-row.accessible);
 const type=row.portfolio<=1?'depletion':inaccessible>=row.shortfall?'access-gap':'mixed-shortfall';
 return {code:classifyBridgeFailure({investableAssets:row.portfolio,netWorth:row.netWorth,accessible:row.accessible,spendingGap:row.shortfall}),type,row,inaccessible,realInaccessible:inaccessible/row.inflationIndex,realGap:row.shortfall/row.inflationIndex,realAccessible:row.accessible/row.inflationIndex};
}

export function retirementEntry(result){
 if(!result.retirement)return null;
 return {year:result.retirement.year,portfolio:result.retirement.openingPortfolio,realPortfolio:result.retirement.openingRealPortfolio};
}

export function projectionComparison(plan){
 const baseline=project(plan),earlier=project(earlierReturnPlan(plan));
 return [{label:'Current inputs',result:baseline,entry:retirementEntry(baseline),failure:failureDiagnosis(baseline)},
  {label:'Earlier real-return assumptions',result:earlier,entry:retirementEntry(earlier),failure:failureDiagnosis(earlier)}];
}
