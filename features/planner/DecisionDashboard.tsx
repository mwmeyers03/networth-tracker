'use client';
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Progress} from '@/components/ui/progress';
import ProjectionChart from '../charts/ProjectionChart';
import {accessYear} from '../../engine/access.mjs';
import {solveBridge} from '../../engine/bridge-solver.mjs';
import {uncappedScenario} from '../../engine/savings-strategy.mjs';
import {decisionPlan} from '../../engine/decisions.mjs';
import {compact,dollars,percent} from './format';
import workerUrl from './simulation.worker.ts?worker&url';
import {startPlannerWorker} from './worker-client.mjs';
import CommitNumberInput from './CommitNumberInput';
import YearSnapshot from './YearSnapshot';
import {createSimulationSession} from './simulation-session';

export function DecisionBanner({children}:{children:ReactNode}){return <section className="decision-banner panel" aria-label="Retirement decision">{children}</section>;}
export function TimelineVisualizer({children}:{children:ReactNode}){return <section className="panel timeline-panel">{children}</section>;}
export function DeepDiveLauncher({onOpen}:{onOpen:(page:string)=>void}){return <div className="deep-dive-actions" aria-label="Detailed planning">{[['plan','People & spending'],['annual','Annual ledger'],['tax','Tax sandbox'],['bridge','Account access'],['withdrawals','Withdrawal policies'],['health','Healthcare'],['stress','Simulation settings'],['scenarios','Saved scenarios'],['review','Assumptions & notes']].map(([key,label])=><Button variant="outline" key={key} onClick={()=>onOpen(key)}>{label}</Button>)}</div>;}

import type {Plan,ProjectionResult,SimulationResult} from './model-types';
type Proposal=ReturnType<typeof solveBridge>;
type Props={plan:Plan;result:ProjectionResult;onChange:(p:Plan)=>void;onCopy:(p:Plan)=>void;canCopy:boolean;onDeepDive:(page:string)=>void;year:number;onYear:(y:number)=>void};
type TestPayload={plan:Plan;options:{mode:string;count:number;seed:number;inflationMode:string}};
export default function DecisionDashboard({plan,result,onChange,onCopy,canCopy,onDeepDive,year,onYear}:Props){
 const [view,setView]=useState<'netWorth'|'accessible'|'cashFlow'>('netWorth'),[method,setMethod]=useState('historical');
 const planKey=JSON.stringify(plan),contextKey=`${method}:${planKey}`;
 const [session]=useState(()=>createSimulationSession<SimulationResult,TestPayload>((payload,callbacks)=>startPlannerWorker(workerUrl,payload,callbacks)));
 const task=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
 useEffect(()=>()=>session.release(contextKey),[session,contextKey]);
 const current=task.contextKey===contextKey?task:null;
 const runResult=current?.result??null,progress=current?.status==='running'?current.progress*100:null;
 const [bridge,setBridge]=useState<{key:string;proposal:Proposal|null;busy:boolean;error:string}|null>(null);
 const proposal=bridge?.key===planKey?bridge.proposal:null,optimizing=bridge?.key===planKey&&bridge.busy;
 const error=current?.error||(bridge?.key===planKey?bridge.error:'')||'';
 const retireYear=Math.min(...plan.people.map((p)=>p.retireYear));
 const spending=plan.retirementBudget?.annual??80000,floor=plan.retirementBudget?.minimumLiving??0;
 type NumericField='annual'|'floor'|'rate';
 const values={annual:spending,floor,rate:Number((plan.withdrawalRate*100).toFixed(3))},budgetEnabled=!!plan.retirementBudget?.enabled;
 const [validation,setValidation]=useState<{values:Record<NumericField,number>;budgetEnabled:boolean;issues:Partial<Record<NumericField,boolean>>}>({values,budgetEnabled,issues:{}});
 // Reset validity only when its own saved value/eligibility changed. Committing
 // one amount must not recreate the next input or drop its unfinished draft.
 if(validation.budgetEnabled!==budgetEnabled||Object.keys(values).some(key=>values[key as NumericField]!==validation.values[key as NumericField])){
  const issues=Object.fromEntries(Object.entries(validation.issues).filter(([key])=>values[key as NumericField]===validation.values[key as NumericField]&&(key==='rate'||validation.budgetEnabled===budgetEnabled)));
  setValidation({values,budgetEnabled,issues});
 }
 const invalid=Object.values(validation.issues).some(Boolean);
 function validity(field:NumericField,valid:boolean){setValidation(previous=>({...previous,issues:{...previous.issues,[field]:!valid}}));}
 const gap=result.rows.find((r)=>r.shortfall>1);
 const penaltyYear=result.rows.find((r)=>r.penaltyFallbackUsed||r.earlyWithdrawalPenalty>1);
 const totalPenalty=result.rows.reduce((sum:number,r)=>sum+(r.earlyWithdrawalPenalty??0)/r.inflationIndex,0);
 const access=accessYear(plan.people[0]);
 const row=result.rows.find((r)=>r.year===year)??result.rows[0];
 function editBudget(key:'annual'|'minimumLiving',value:number){if(!plan.retirementBudget?.enabled||!Number.isFinite(value)||value<0)return;onChange({...plan,retirementBudget:{...plan.retirementBudget,[key]:value}});}
 function run(){session.start(contextKey,{plan,options:{mode:method,count:500,seed:2026,inflationMode:method==='historical'?'historical':'fixed'}});}
 async function optimize(){setBridge({key:planKey,proposal:null,busy:true,error:''});try{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));setBridge({key:planKey,proposal:solveBridge(plan),busy:false,error:''});}catch(e){setBridge({key:planKey,proposal:null,busy:false,error:(e as Error).message});}}
 const headline=runResult?`${percent(runResult.successRate)} ${method==='historical'?'historical windows':'simulated paths'} funded`:'Your retirement outlook';
 const budgetUnit=plan.retirementBudget?.dollarMode==='nominal'?'future $':`${plan.baseYear} $`;
 return <div className="decision-dashboard stack">
  <DecisionBanner>
   <div className="section-head decision-summary"><div><span className="eyebrow">{plan.people.map((p)=>p.name).join(' + ')}</span><h2 aria-live="polite">{headline}</h2><p className="muted">Through age {plan.endYear-plan.people[0].birthYear} · {plan.baseYear} purchasing power · conditional on this plan</p></div><strong className="decision-portfolio">{result.retirement?compact(result.retirement.openingRealPortfolio):'Outside forecast'}<small className="block muted">Entering retirement</small></strong></div>
   <div className="decision-controls"><div className="field"><span>First retired year / age</span><div className="stepper" role="group" aria-label="First retired year and age"><Button variant="outline" aria-label="Retire one year earlier" disabled={retireYear<=plan.startYear} onClick={()=>onChange(decisionPlan(plan,{delay:-1}))}>−</Button><span>{retireYear} / {retireYear-plan.people[0].birthYear}</span><Button variant="outline" aria-label="Retire one year later" disabled={retireYear>=plan.endYear} onClick={()=>onChange(decisionPlan(plan,{delay:1}))}>+</Button></div></div>
   <CommitNumberInput label={`Annual retirement budget (${budgetUnit})`} min={0} max={1000000000} value={spending} disabled={!plan.retirementBudget?.enabled} onCommit={value=>editBudget('annual',value)} onValidityChange={valid=>validity('annual',valid)}/>
   </div>
   <details className="decision-settings"><summary>Spending floor & withdrawal settings{(validation.issues.floor||validation.issues.rate)&&<span className="negative"> · Check input</span>}</summary><div className="decision-controls">
   <CommitNumberInput label={`Essential living floor (${budgetUnit})`} help="Excludes housing, tax and healthcare." min={0} max={1000000000} value={floor} disabled={!plan.retirementBudget?.enabled} onCommit={value=>editBudget('minimumLiving',value)} onValidityChange={valid=>validity('floor',valid)}/>
   <CommitNumberInput label="Withdrawal benchmark (%)" min={.1} max={100} value={values.rate} onCommit={value=>onChange({...plan,withdrawalRate:value/100})} onValidityChange={valid=>validity('rate',valid)}/></div><p className="small muted">The living floor protects essential spending. The withdrawal benchmark controls the target and adaptive rules.</p></details>
   {!plan.retirementBudget?.enabled&&<p className="notice info">This scenario uses category-based spending. <button className="link-button" onClick={()=>onDeepDive('plan')}>Edit spending mode</button> to enable a fixed retirement budget.</p>}
   <details className="decision-control-notes"><summary>How the budget controls work</summary><p className="small muted">Amounts update when you leave a field or press Enter. Clearing a field restores its previous value; type 0 to set zero. Housing, taxes and coverage are protected in addition to the living floor. Remaining allowance is discretionary. The withdrawal percentage changes the benchmark and adaptive rules; fixed-budget spending stays fixed. {plan.retirementBudget?.dollarMode==='nominal'?'This budget is in future dollars, so its purchasing power falls over time.':`A constant ${plan.baseYear}-dollar budget preserves purchasing power; the chart does not add inflation a second time.`}</p></details>
   <div className="decision-status"><Button variant="outline" className={gap?'negative':penaltyYear?'warning':''} onClick={()=>onDeepDive('bridge')}>{gap?(gap.portfolio<=1?`Portfolio depleted in ${gap.year}`:`Account-access / funding gap in ${gap.year} · inspect`):penaltyYear?`Baseline funded with penalties from ${penaltyYear.year} · inspect`:'Modeled bills funded in the baseline'}</Button>{plan.retirementBudget?.enabled&&floor===0&&<span className="notice warning">Essential living floor missing</span>}{!plan.healthcare?.enabled&&<span className="notice warning">Healthcare costs incomplete</span>}</div>
   <div className="actions decision-test-actions"><Select value={method} onValueChange={setMethod}><SelectTrigger aria-label="Retirement test method"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="historical">Historical sequences</SelectItem><SelectItem value="montecarlo">Monte Carlo · 500 paths</SelectItem></SelectContent></Select><Button disabled={progress!==null||invalid} onClick={run}>{progress===null?(runResult?'Run test again':'Run market test'):`Testing… ${Math.floor(progress)}%`}</Button>{progress!==null&&<Button variant="outline" onClick={()=>session.cancel()}>Cancel</Button>}</div>
   {progress!==null&&<Progress value={progress}/>}{error&&<p className="notice error" role="alert">{error}</p>}
   {current?.status==='cancelled'&&<p className="small muted" role="status">Test cancelled. Your inputs are unchanged; run it again when ready.</p>}
   {!runResult&&progress===null&&current?.status!=='error'&&current?.status!=='cancelled'&&<p className="small muted">The baseline uses steady returns. Run a market test for these inputs to see how changing returns affect funding.</p>}
   {runResult&&<section className="simulation-summary" aria-label="Market test results">
    <dl className="simulation-scorecard"><div><dt>Funded modeled bills</dt><dd>{Math.round(runResult.successRate*runResult.runs)} / {runResult.runs}</dd></div><div><dt>Paths with spending cuts</dt><dd>{percent(runResult.spendingCutRate)}</dd></div><div><dt>Paths with early-withdrawal penalties</dt><dd>{runResult.penaltyRate===undefined?'—':percent(runResult.penaltyRate)}</dd></div><div><dt>Protected costs over budget</dt><dd>{plan.retirementBudget?.enabled?percent(runResult.budgetOverrunRate):'Budget off'}</dd></div></dl>
    <p className="small muted">Funded means modeled bills were covered, including any permitted spending cuts or penalty-bearing withdrawals. It does not mean every savings or cash-reserve target was met.</p>
    <details><summary>Understand this result</summary><p className="small muted">This test covers {plan.startYear}–{plan.endYear}, including working years. {method==='historical'?`${runResult.runs} complete, overlapping windows use ${runResult.dataRange} market history and matching inflation. They are not a forecast probability.`:'500 seeded market paths use your return and volatility assumptions with fixed assumed inflation. Sampling does not establish certainty.'}</p><p className="small muted">{plan.retirementBudget?.enabled?`${percent(runResult.withinBudgetSuccessRate)} funded bills without protected costs exceeding the recurring budget. Spending cuts may still occur; one-time costs and any taxes or healthcare set outside the budget remain additional.`:'The recurring retirement budget is disabled, so a budget-overrun comparison is unavailable.'} These percentages overlap; they are not slices of a whole.</p><p className="small muted">First funding failures: {runResult.failureTypes?.['access-gap']??0} access gaps, {runResult.failureTypes?.depletion??0} depleted portfolios, {runResult.failureTypes?.['mixed-shortfall']??0} mixed shortfalls. Access gaps retain assets that the modeled rules cannot currently use. Inspect account access before treating them as insolvency.</p><Button variant="ghost" size="sm" onClick={()=>onDeepDive('stress')}>Open advanced tests</Button></details>
   </section>}
  </DecisionBanner>
  <TimelineVisualizer><div className="section-head"><h2>Your financial timeline</h2><div className="segmented" role="group" aria-label="Timeline view">{([['netWorth','Net worth'],['accessible','Liquidity'],['cashFlow','Cash flow']] as const).map(([key,label])=><Button key={key} aria-pressed={view===key} size="sm" variant={view===key?'default':'ghost'} onClick={()=>setView(key)}>{label}</Button>)}</div></div>
   <ProjectionChart rows={result.rows} year={year} onYear={onYear} metric={view} bands={runResult?.timelineBands?.[view]} baseYear={plan.baseYear} accessLineYear={access}/>
   <p className="small muted">Access marker: first full year of modeled age-59½ eligibility for {plan.people[0].name}{!plan.people[0].birthDate?' (birth date missing; approximate)':''}. Funding surplus / gap is cash after permitted withdrawals and all modeled bills, before optional investing. A negative value is a genuine remaining funding gap. Bands appear after a completed test.</p>
   <YearSnapshot plan={plan} row={row} onYear={onYear} onInspect={()=>onDeepDive('annual')}/>
  </TimelineVisualizer>
  <section className="panel"><div className="section-head"><h2>Compare a change</h2><Select value="none" onValueChange={v=>{if(v==='sweep')onCopy(uncappedScenario(plan));if(v==='break'){const p=structuredClone(plan);p.name=`${plan.name.slice(0,75)} · career break`;p.people[1].careerBreaks=[...(p.people[1].careerBreaks??[]),{start:p.people[1].workStart,end:p.people[1].workStart+1,payFraction:0}];onCopy(p);}if(v==='shock')onDeepDive('stress');}}><SelectTrigger aria-label="Scenario preset" disabled={!canCopy}><SelectValue placeholder="Choose a scenario"/></SelectTrigger><SelectContent><SelectItem value="none">Choose a scenario</SelectItem><SelectItem value="sweep">Uncapped savings + cash buffer</SelectItem><SelectItem value="break">Partner career break</SelectItem><SelectItem value="shock">Stagflation stress tests</SelectItem></SelectContent></Select></div>
   {penaltyYear&&<p className="notice warning">The baseline uses early distributions with {dollars(totalPenalty)} in cumulative additional tax, in {plan.baseYear} dollars.{gap?` An unfunded gap still begins in ${gap.year}.`:' All modeled bills are funded under these baseline assumptions.'} Evaluate the ladder before accepting that tradeoff.</p>}
   <p className="muted">Copies preserve your original. Uncapped savings assumes remaining pay is invested; declare personal expenses before treating that result as realistic.</p>
   <div className="actions"><Button disabled={optimizing||(!gap&&!penaltyYear)} onClick={optimize}>{optimizing?'Evaluating…':'Evaluate bridge conversion fallback'}</Button><Button variant="outline" onClick={()=>onDeepDive('withdrawals')}>Compare withdrawal policies</Button><Button variant="outline" onClick={()=>onDeepDive('decisions')}>Compare dates and spending</Button></div>
   {proposal&&<div className="notice info"><strong>{proposal.status.replaceAll('_',' ')}</strong><p>{proposal.explanation}</p><p>{proposal.candidate.conversions.length} annual conversion changes · {dollars(proposal.extraTax)} additional modeled lifetime federal tax · {dollars(proposal.extraHealthcareCost)} healthcare cost change, in {plan.baseYear} dollars.</p>{!proposal.healthcareEstimated&&<p>Subsidy tradeoff unavailable: healthcare quotes and eligibility have not been enabled.</p>}{proposal.candidate.conversions.length>0&&<><details><summary>Proposed annual conversions</summary><ul>{proposal.candidate.conversions.map((c)=><li key={c.year}>{c.year}: {dollars(c.amount)} real; MAGI cap relaxed</li>)}</ul></details><Button disabled={!canCopy} onClick={()=>onCopy(proposal.proposedPlan)}>Create proposal scenario</Button></>}<p>This is a deterministic candidate, not an optimized success rate. Run the same market tests on the copy. SEPP is not automatically enabled.</p></div>}
  </section>
  <DeepDiveLauncher onOpen={onDeepDive}/>
 </div>;
}
