import {clone,validate} from './plan.mjs';
import {project} from './project.mjs';
import {accessBreakdown,accessYear} from './access.mjs';
import {failureDiagnosis} from './diagnostics.mjs';

export const DEFAULT_STRESS_SHOCKS=Object.freeze({crashStock:-.4,crashBond:-.1,lowStock:0,lowBond:.01,lowYears:10,highInflation:.08,inflationYears:5});
const firstRetirement=plan=>Math.min(...plan.people.map(p=>p.retireYear));
function checkPlan(plan){const errors=validate(plan);if(errors.length)throw Error(errors.join('\n'));}
function retirementWithinForecast(plan){
 const year=firstRetirement(plan);
 if(year<plan.startYear||year>plan.endYear)throw Error('First retirement must fall within the forecast to anchor a retirement stress test.');
 return year;
}

// Match project()'s deterministic nominal path exactly. In particular, an
// inflation shock must NOT convert a real-return input again at the shocked CPI.
export function baselineStressSequence(plan){
 checkPlan(plan);
 const retirement=firstRetirement(plan),nominal=v=>plan.returnUnit==='real'?(1+v)*(1+plan.inflation)-1:v;
 return Array.from({length:plan.endYear-plan.startYear+1},(_,i)=>{
  const retired=plan.startYear+i>=retirement;
  return {stock:nominal(retired?(plan.retirementStockReturn??plan.stockReturn):plan.stockReturn),bond:nominal(retired?(plan.retirementBondReturn??plan.bondReturn):plan.bondReturn),cash:nominal(retired?(plan.retirementCashReturn??plan.cashReturn):plan.cashReturn),inflation:plan.inflation};
 });
}

export function stressCaseSequences(plan,settings={}){
 const baseline=baselineStressSequence(plan),retirementYear=retirementWithinForecast(plan),shocks={...DEFAULT_STRESS_SHOCKS,...settings};
 for(const key of ['crashStock','crashBond','lowStock','lowBond'])if(!Number.isFinite(shocks[key])||shocks[key]<-1||shocks[key]>1)throw Error(`${key}: use a nominal return between -100% and 100%.`);
 if(!Number.isFinite(shocks.highInflation)||shocks.highInflation<=-.5||shocks.highInflation>1)throw Error('Stress inflation must be greater than -50% and no more than 100%.');
 for(const key of ['lowYears','inflationYears'])if(!Number.isInteger(shocks[key])||shocks[key]<1||shocks[key]>30)throw Error(`${key}: use 1–30 whole years.`);
 const definitions=[
  {id:'retirement-crash',label:'Crash at retirement',kind:'crash'},
  {id:'low-return-decade',label:'Low-return stretch',kind:'low'},
  {id:'high-inflation',label:'High inflation',kind:'inflation'},
  {id:'poor-returns-high-inflation',label:'Poor returns + high inflation',kind:'combined'}
 ];
 const cases=definitions.map(def=>({...def,retirementYear,returns:baseline.map((row,i)=>{
  const next={...row},offset=plan.startYear+i-retirementYear;
  if(offset===0&&def.kind==='crash'){next.stock=shocks.crashStock;next.bond=shocks.crashBond;}
  if(offset>=0&&offset<shocks.lowYears&&['low','combined'].includes(def.kind)){next.stock=shocks.lowStock;next.bond=shocks.lowBond;}
  if(offset>=0&&offset<shocks.inflationYears&&['inflation','combined'].includes(def.kind))next.inflation=shocks.highInflation;
  return next;
 })}));
 return {retirementYear,shocks,baseline,cases};
}

export function summarizeStressProjection(plan,result){
 const retirementYear=firstRetirement(plan),entry=result.rows.find(r=>r.year===retirementYear),failure=failureDiagnosis(result);
 const bridgeEndYear=Math.min(plan.endYear,Math.max(...plan.people.map(accessYear))-1);
 const bridgeRows=result.rows.filter(r=>r.year>=retirementYear&&r.year<=bridgeEndYear),bridgeGap=bridgeRows.find(r=>r.shortfall>1);
 const openingAccessible=entry?entry.openingAccounts.reduce((sum,a,i)=>sum+accessBreakdown(a,plan.people[i],retirementYear).accessible,0):null;
 return {funded:result.success,firstGap:result.firstFailure,firstGapReal:failure?.realGap??0,failureType:failure?.type??null,financialRemaining:result.terminal.realPortfolio,
  retirementYear,retirementOpeningReal:entry?.openingRealPortfolio??null,accessibleAtRetirementReal:entry?openingAccessible/entry.openingInflationIndex:null,
  bridge:{startYear:retirementYear,endYear:bridgeEndYear,applicable:bridgeRows.length>0,firstGap:bridgeGap?.year??null,firstGapReal:bridgeGap?bridgeGap.shortfall/bridgeGap.inflationIndex:0},
  spendingCutYears:result.rows.filter(r=>r.spendingReduction>1).length,budgetOverrunYears:result.rows.filter(r=>(r.budget?.overrun??0)>1).length};
}

export function runStressCases(plan,settings={}){
 const sequences=stressCaseSequences(plan,settings),baselineProjection=project(plan,sequences.baseline);
 return {retirementYear:sequences.retirementYear,shocks:sequences.shocks,
  baseline:{id:'baseline',label:'Deterministic baseline',projection:baselineProjection,summary:summarizeStressProjection(plan,baselineProjection)},
  cases:sequences.cases.map(({returns,...details})=>{const projection=project(plan,returns);return {...details,projection,summary:summarizeStressProjection(plan,projection)};})};
}

// A conditional retirement test: accumulate deterministically, then expose the
// actual nominal accounts to historical retirement returns. Base-year expense
// amounts stay unchanged. Account values are NOT deflated or consolidated.
export function retirementStartPlan(plan){
 checkPlan(plan);
 const retirementYear=retirementWithinForecast(plan);
 if(plan.housing.mode==='buy'&&plan.housing.buyYear<retirementYear)throw Error('Retirement-only history cannot carry an existing home and mortgage. Use complete-plan historical tests for a pre-retirement purchase.');
 const next=clone(plan);
 if(retirementYear===plan.startYear)return next;
 const accumulation=clone(plan);accumulation.endYear=retirementYear-1;
 accumulation.overrides=Object.fromEntries(Object.entries(accumulation.overrides).filter(([year])=>Number(year)<retirementYear));
 const prior=project(accumulation);
 if(prior.firstFailure!==null)throw Error(`Deterministic accumulation has an unfunded year in ${prior.firstFailure}. Resolve that gap before testing a funded retirement opening.`);
 if(prior.terminal.accounts.some(account=>(account.sepp??0)>0))throw Error('Retirement-only history cannot carry an already active SEPP account and payment schedule. Use complete-plan historical tests.');
 next.startYear=retirementYear;
 next.overrides=Object.fromEntries(Object.entries(next.overrides).filter(([year])=>Number(year)>=retirementYear));
 next.people=next.people.map((person,i)=>{
  const balance=prior.terminal.accounts[i],vested=Math.min(1,Math.max(0,retirementYear-person.employmentStart)*.2);
  // project() reconstructs the graded pool using the NEW first year's fraction.
  // Passing last year's unvested fraction would incorrectly increase forfeiture.
  return {...person,salaryBaseYear:person.salaryBaseYear??Math.max(person.workStart,plan.startYear),
   traditional:balance.traditional,roth:balance.roth,brokerage:balance.brokerage,cash:balance.cash,hsaBalance:balance.hsa??0,
   brokerageBasis:balance.brokerageBasis,rothBasis:balance.rothBasis,
   ...(balance.pretaxSources?{pretaxSources:balance.pretaxSources.map(({balance:currentBalance,...source})=>({...source,openingBalance:currentBalance}))}:{}),
   unvested:(balance.gradedPool??0)*(1-vested),rothConversionLots:clone(balance.lots)};
 });
 // Preserve the two annual tax records needed by the Medicare lookback, while
 // keeping user-specified records authoritative as in healthcareAt().
 if(next.healthcare){
  const calculated=Object.fromEntries(prior.rows.slice(-2).map(row=>[row.year,{magi:row.federalAgi,byPerson:row.agiByPerson,joint:row.joint}]));
  next.healthcare.lookback={...calculated,...(next.healthcare.lookback??{})};
 }
 checkPlan(next);
 return next;
}

// Existing worker protocol; count is ignored for exhaustive complete windows.
export function retirementHistoricalRequest(plan){return {plan:retirementStartPlan(plan),options:{mode:'historical',inflationMode:'historical',count:500,seed:2026,blockLength:5}};}
