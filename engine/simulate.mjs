import {project} from './project.mjs';
import {validate} from './plan.mjs';
import {HISTORY} from './history.mjs';
import {failureDiagnosis} from './diagnostics.mjs';
import {CPI_INFLATION} from './inflation.mjs';
import {seeded,quantile} from '../packages/engine/runtime/simulation/random.js';
export {seeded,quantile};
import {marketSequence} from '../packages/engine/runtime/simulation/sequences.js';
export function sequence(plan,mode,rng,cohort=0,{inflationMode='fixed',blockLength=5,inflationVol=.015,inflationCorrelation=-.1}={}){
 return marketSequence({startYear:plan.startYear,endYear:plan.endYear,retirementYear:Math.min(...plan.people.map(p=>p.retireYear)),unit:plan.returnUnit??'nominal',stockMean:plan.stockReturnMean??'arithmetic',stock:plan.stockReturn,retirementStock:plan.retirementStockReturn??plan.stockReturn,stockVol:plan.stockVol,bond:plan.bondReturn,retirementBond:plan.retirementBondReturn??plan.bondReturn,bondVol:plan.bondVol,correlation:plan.correlation,cash:plan.cashReturn,retirementCash:plan.retirementCashReturn??plan.cashReturn,cashNominalOverride:plan.cashNominalReturn,inflation:plan.inflation},
 {mode,seed:0,cohort,blockLength,inflationMode,inflationVol,inflationCorrelation},HISTORY.map(h=>({...h,inflation:CPI_INFLATION[h.year]})),rng);
}
export function simulate(plan,{mode='montecarlo',count=500,seed=2026,inflationMode='fixed',blockLength=5,inflationVol=.015,inflationCorrelation=-.1}={},progress=()=>{}){
 const errors=validate(plan);if(errors.length)throw Error(errors.join('\n'));
 if(!['montecarlo','historical','bootstrap'].includes(mode))throw Error('Unknown simulation method.');
 if(!['fixed','historical','stochastic'].includes(inflationMode)||mode==='montecarlo'&&inflationMode==='historical'||mode!=='montecarlo'&&inflationMode==='stochastic')throw Error('Inflation method is incompatible with simulation method.');
 if(!Number.isInteger(blockLength)||blockLength<1||blockLength>20||!Number.isFinite(inflationVol)||inflationVol<0||inflationVol>.3||!Number.isFinite(inflationCorrelation)||Math.abs(inflationCorrelation)>1||!Number.isInteger(seed)||!Number.isFinite(count))throw Error('Invalid simulation settings.');
 const n=plan.endYear-plan.startYear+1;
 const runs=mode==='historical'?HISTORY.length-n+1:Math.max(50,Math.min(5000,Math.floor(count)));
 if(runs<1)throw Error('Not enough years for a complete historical sequence. Shorten the horizon.');
 const rng=seeded(seed),annual=Array.from({length:n},()=>[]),timeline={netWorth:Array.from({length:n},()=>[]),accessible:Array.from({length:n},()=>[]),cashFlow:Array.from({length:n},()=>[])},results=[],failures={};let successes=0;const failureTypes={'access-gap':0,'depletion':0,'mixed-shortfall':0};
 for(let i=0;i<runs;i++){
  const result=project(plan,sequence(plan,mode,rng,i,{inflationMode,blockLength,inflationVol,inflationCorrelation}),{skipValidation:true});
  const diagnosis=failureDiagnosis(result);
  if(result.success)successes++;else {failures[result.firstFailure]=(failures[result.firstFailure]||0)+1;failureTypes[diagnosis.type]++;}
  result.rows.forEach((r,j)=>{annual[j].push(r.realPortfolio);timeline.netWorth[j].push(r.netWorth/r.inflationIndex);timeline.accessible[j].push(r.accessible/r.inflationIndex);timeline.cashFlow[j].push(r.cashAfterFunding/r.inflationIndex);});
  results.push({funded:result.success,budgetOverrunYears:result.rows.filter(r=>(r.budget?.overrun??0)>1).length,penaltyYears:result.rows.filter(r=>(r.earlyWithdrawalPenalty??0)>1).length,realPenalties:result.rows.reduce((v,r)=>v+(r.earlyWithdrawalPenalty??0)/r.inflationIndex,0),failureType:diagnosis?.type??null,firstGapReal:diagnosis?.realGap??0,assetsAtFirstGap:diagnosis?.row.realPortfolio??null,retirementOpening:result.retirement?.openingRealPortfolio??null,cohort:mode==='historical'?HISTORY[i].year:null,firstFailure:result.firstFailure,ending:result.terminal.realPortfolio,retirement:result.retirement?.realPortfolio??0,spendingCuts:result.rows.filter(r=>r.spendingReduction>1).length,realSpendingReduction:result.rows.reduce((v,r)=>v+r.spendingReduction/r.inflationIndex,0)});
  if(i%10===0)progress(i/runs);
 }
 const p=successes/runs,z=1.96,denom=1+z*z/runs,center=(p+z*z/(2*runs))/denom,margin=z*Math.sqrt(p*(1-p)/runs+z*z/(4*runs*runs))/denom;
 return {mode,runs,seed,inflationMode,blockLength,inflationVol,inflationCorrelation,successRate:p,withinBudgetSuccessRate:results.filter(r=>r.funded&&r.budgetOverrunYears===0).length/runs,budgetOverrunRate:results.filter(r=>r.budgetOverrunYears>0).length/runs,spendingCutRate:results.filter(r=>r.spendingCuts>0).length/runs,penaltyRate:results.filter(r=>r.penaltyYears>0).length/runs,interval:mode==='historical'?null:[Math.max(0,center-margin),Math.min(1,center+margin)],results,failures,failureTypes,bands:annual.map((a,i)=>({year:plan.startYear+i,p10:quantile(a,.1),p25:quantile(a,.25),p50:quantile(a,.5),p75:quantile(a,.75),p90:quantile(a,.9)})),dataRange:`${HISTORY[0].year}–${HISTORY.at(-1).year}`,timelineBands:Object.fromEntries(Object.entries(timeline).map(([key,series])=>[key,series.map((a,i)=>({year:plan.startYear+i,p10:quantile(a,.1),p50:quantile(a,.5),p90:quantile(a,.9)}))])),completedAt:new Date().toISOString()};
}
