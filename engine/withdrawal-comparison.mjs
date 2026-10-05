import {clone,validate} from './plan.mjs';
import {project} from './project.mjs';
import {sequence,seeded,quantile} from './simulate.mjs';
import {failureDiagnosis} from './diagnostics.mjs';
import {terminalValuationOptions,valueTerminalAccounts} from '../packages/engine/runtime/withdrawals/valuation.js';

/** Policies are declared before sampling; no candidate sees future returns. */
export function withdrawalCases(plan,{extraConversion=14000}={}){
 const candidate=(id,label,description,edit)=>{const next=clone(plan);edit(next);return {id,label,description,plan:next};};
 const setPolicy=(p,patch)=>{p.withdrawalPolicy={order:'taxable_first',allowPenalties:true,...p.withdrawalPolicy,...patch};};
 return [
  candidate('configured','Your configured strategy','Existing conversion schedule and withdrawal policy.',()=>{}),
  candidate('roth_first','Roth principal first','Accessible Roth principal before taxable sales; statutory Roth ordering still applies.',p=>setPolicy(p,{order:'roth_first'})),
  candidate('pretax_first','Accessible pre-tax first','Penalty-free accessible traditional funds before taxable and Roth funds.',p=>setPolicy(p,{order:'pretax_first'})),
  candidate('early_traditional','Traditional emergency funding first','When penalty-free funds run out, use permitted early traditional withdrawals before unseasoned Roth conversions or earnings.',p=>setPolicy(p,{allowPenalties:true,earlyPreference:'traditional_first'})),
  candidate('uncapped_conversions','Relax conversion MAGI target','Keep scheduled conversion amounts but allow them to exceed the configured ACA MAGI target.',p=>{p.capConversions=false;}),
  candidate('higher_conversions','Larger Roth ladder',`Add $${extraConversion.toLocaleString('en-US')} in base-year purchasing power to each scheduled annual conversion and relax its ACA MAGI target. Explicit annual overrides remain authoritative.`,p=>{p.capConversions=false;p.conversionAnnual+=extraConversion;})
 ];
}

function settings(options){
 const {count=100,seed=2026,mode='montecarlo',objective='lower_tail',extraConversion=14000,inflationMode='fixed',blockLength=5,inflationVol=.015,inflationCorrelation=-.1}=options;
 const terminalValuation=terminalValuationOptions(options.terminalValuation);
 if(!Number.isInteger(count)||count<50||count>500||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Use 50–500 paths and a whole-number seed from 0 to 4294967295.');
 if(!['montecarlo','bootstrap'].includes(mode)||!['lower_tail','median'].includes(objective))throw Error('Invalid withdrawal comparison method or objective.');
 if(!Number.isFinite(extraConversion)||extraConversion<0||extraConversion>200000)throw Error('Extra annual conversions must be between $0 and $200,000.');
 if(!['fixed','historical','stochastic'].includes(inflationMode)||mode==='montecarlo'&&inflationMode==='historical'||mode==='bootstrap'&&inflationMode==='stochastic')throw Error('Inflation method is incompatible with comparison method.');
 if(!Number.isInteger(blockLength)||blockLength<1||blockLength>20||!Number.isFinite(inflationVol)||inflationVol<0||inflationVol>.3||!Number.isFinite(inflationCorrelation)||Math.abs(inflationCorrelation)>1)throw Error('Invalid inflation or historical block settings.');
 return {count,seed,mode,objective,extraConversion,inflationMode,blockLength,inflationVol,inflationCorrelation,terminalValuation};
}

/** Matched sampled paths compare limited, fixed policies, never a global optimum. */
export function compareWithdrawals(plan,options={},progress=(value=0)=>{void value;}){
 const opts=settings(options),errors=validate(plan);if(errors.length)throw Error(errors.join('\n'));
 const cases=withdrawalCases(plan,opts);
 for(const c of cases){const invalid=validate(c.plan);if(invalid.length)throw Error(`${c.label}: ${invalid.join('\n')}`);}
 const samples=cases.map(()=>[]),rng=seeded(opts.seed);
 for(let trial=0;trial<opts.count;trial++){
  const path=sequence(plan,opts.mode,rng,trial,opts);
  cases.forEach((c,i)=>{
   const result=project(c.plan,path,{skipValidation:true}),diagnosis=failureDiagnosis(result);
   const terminal=valueTerminalAccounts(result.terminal.accounts,result.terminal.inflationIndex,opts.terminalValuation);
   const total=field=>result.rows.reduce((v,row)=>v+(field(row)??0)/row.inflationIndex,0);
   const cuts=total(r=>r.spendingReduction),penalty=total(r=>r.earlyWithdrawalPenalty);
   samples[i].push({funded:result.success,withinBudget:result.success&&cuts<1&&result.rows.every(r=>(r.budget?.overrun??0)<=1),penaltyFree:result.success&&penalty<1,ending:terminal.grossReal,taxAdjustedEnding:terminal.taxAdjustedReal,rankedEnding:terminal.rankedReal,terminalTax:terminal.illustrativeTaxReal,incomeTax:total(r=>r.ordinaryIncomeTax??r.federalTax-(r.earlyWithdrawalPenalty??0)),penalty,healthcare:total(r=>r.healthcare?.cost),cuts,firstFailure:result.firstFailure,failureType:diagnosis?.type??null});
  });
  if(trial%5===0)progress((trial+1)/opts.count);
 }
 const rows=cases.map((c,i)=>{
  const s=samples[i],rate=predicate=>s.filter(predicate).length/opts.count,mean=key=>s.reduce((v,x)=>v+x[key],0)/opts.count;
  return {id:c.id,label:c.label,description:c.description,plan:c.plan,rank:0,successRate:rate(x=>x.funded),withinBudgetSuccessRate:rate(x=>x.withinBudget),penaltyFreeRate:rate(x=>x.penaltyFree),medianEnding:quantile(s.map(x=>x.ending),.5),p10Ending:quantile(s.map(x=>x.ending),.1),medianTaxAdjustedEnding:quantile(s.map(x=>x.taxAdjustedEnding),.5),p10TaxAdjustedEnding:quantile(s.map(x=>x.taxAdjustedEnding),.1),medianRankedEnding:quantile(s.map(x=>x.rankedEnding),.5),p10RankedEnding:quantile(s.map(x=>x.rankedEnding),.1),meanRealTerminalTax:mean('terminalTax'),meanRealIncomeTax:mean('incomeTax'),meanRealPenalty:mean('penalty'),meanRealHealthcare:mean('healthcare'),medianRealCuts:quantile(s.map(x=>x.cuts),.5),improvedPaths:s.filter((x,j)=>x.funded&&!samples[0][j].funded).length/opts.count,worsePaths:s.filter((x,j)=>!x.funded&&samples[0][j].funded).length/opts.count,failureTypes:Object.fromEntries(['access-gap','depletion','mixed-shortfall'].map(type=>[type,s.filter(x=>x.failureType===type).length])),failures:s.filter(x=>!x.funded).map(x=>({year:x.firstFailure,type:x.failureType}))};
 });
 const score=opts.objective==='median'?'medianRankedEnding':'p10RankedEnding';
 const ranked=[...rows].sort((a,b)=>b.successRate-a.successRate||b.withinBudgetSuccessRate-a.withinBudgetSuccessRate||b[score]-a[score]||b.medianRankedEnding-a.medianRankedEnding||a.meanRealPenalty-b.meanRealPenalty||cases.findIndex(c=>c.id===a.id)-cases.findIndex(c=>c.id===b.id));
 ranked.forEach((row,i)=>{row.rank=i+1;});progress(1);
 return {...opts,rows,bestId:ranked[0].id,baselineId:'configured',rankingRule:`Funded rate, then full-budget success, then ${opts.objective==='median'?'median':'10th-percentile'} ${opts.terminalValuation.mode==='gross'?'gross':'illustratively tax-adjusted'} terminal investable assets.`,assumptions:[
  'Best means best among these evaluated fixed policies on this sampled set, not a globally optimal strategy or a guarantee.',
  'Every policy receives the identical nominal return and inflation path generated from the reference plan. Retirement dates, spending and account assumptions are unchanged.',
  'Full-budget success requires every year funded without discretionary spending cuts or budget overruns. Penalty-free rate counts paths both funded and free of material early-withdrawal penalties.',
  'Costs are cumulative base-year real dollars, not discounted present values. Both gross and illustrative tax-adjusted terminal assets are reported and exclude home equity. Selected valuation changes only the terminal-wealth tie-break, never funding success or modeled cashflows.',
  `Illustrative terminal burdens: traditional and segregated SEPP ${opts.terminalValuation.traditionalTaxRate*100}%, positive unrealized taxable gains ${opts.terminalValuation.taxableGainTaxRate*100}%, HSA ${opts.terminalValuation.hsaTaxRate*100}%. Taxable cost basis and cash have no additional haircut; losses do not produce an assumed credit. Roth is assumed tax-free for this planning valuation.`,
  'These editable fixed haircuts are not actual liquidation taxes, account-access guarantees, future tax schedules or ACA calculations. Qualified HSA medical withdrawals could be tax-free; set the separate HSA rate accordingly. Nonqualified Roth withdrawals can have tax or penalties despite the terminal planning assumption.',
  'Healthcare comparisons depend on the enabled coverage quotes and dated subsidy assumptions. Higher conversions may reduce subsidies; amounts are not optimized using future market knowledge.'
 ]};
}
