'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Table,TableHeader,TableBody,TableHead,TableRow,TableCell} from '@/components/ui/table';
import {DEFAULT_STRESS_SHOCKS,runStressCases,retirementHistoricalRequest} from '../../engine/stress-cases.mjs';
import simulationWorkerUrl from './simulation.worker.ts?worker&url';
import {startPlannerWorker} from './worker-client.mjs';
import {dollars,percent,download} from './format';
import type {Plan,SimulationResult} from './model-types';
type HistoryState={key:string;history:SimulationResult|null;error:string;progress:number|null};

type ShockKey=keyof typeof DEFAULT_STRESS_SHOCKS;
const fields:{key:ShockKey;label:string;percent:boolean}[]=[
 {key:'crashStock',label:'Crash-year stock return',percent:true},
 {key:'crashBond',label:'Crash-year bond return',percent:true},
 {key:'lowStock',label:'Low-stretch stock return',percent:true},
 {key:'lowBond',label:'Low-stretch bond return',percent:true},
 {key:'lowYears',label:'Low-return years',percent:false},
 {key:'highInflation',label:'High annual inflation',percent:true},
 {key:'inflationYears',label:'High-inflation years',percent:false}
];
const initialFields=()=>Object.fromEntries(fields.map(f=>[f.key,String(DEFAULT_STRESS_SHOCKS[f.key]*(f.percent?100:1))]));
type Props={plan:Plan;onScenario?:(plan:Plan)=>void};

export default function StressCases({plan}:Props){
 const [inputs,setInputs]=useState<Record<string,string>>(initialFields),[historyState,setHistoryState]=useState<HistoryState|null>(null);
 const key=JSON.stringify(plan),current=historyState?.key===key?historyState:null,history=current?.history??null,historyError=current?.error??'',progress=current?.progress??null;
 const worker=useRef<{cancel:()=>void}|null>(null);
 const calculation=useMemo(()=>{
  try{
   const settings=Object.fromEntries(fields.map(f=>[f.key,inputs[f.key].trim()===''?NaN:Number(inputs[f.key])/(f.percent?100:1)]));
   return {result:runStressCases(plan,settings),error:''};
  }catch(error){return {result:null,error:error instanceof Error?error.message:String(error)};}
 },[plan,inputs]);
 useEffect(()=>{
  worker.current?.cancel();worker.current=null;
  return()=>{worker.current?.cancel();worker.current=null;};
 },[key]);
 function runHistory(){
  worker.current?.cancel();worker.current=null;
  let request;
  try{request=retirementHistoricalRequest(plan);}catch(error){setHistoryState({key,history:null,error:error instanceof Error?error.message:String(error),progress:null});return;}
  setHistoryState({key,history:null,error:'',progress:0});
  const update=(patch:Partial<HistoryState>)=>setHistoryState(previous=>previous?.key===key?{...previous,...patch}:previous);
  worker.current=startPlannerWorker(simulationWorkerUrl,request,{
   onProgress:(value:number)=>update({progress:value}),
   onResult:(output:SimulationResult)=>{worker.current=null;update({history:output,progress:null});},
   onError:(message:string)=>{worker.current=null;update({error:message,progress:null});}
  });
 }
 const output=calculation.result,entry=output?.baseline.summary,firstRetire=Math.min(...plan.people.map((p)=>p.retireYear));
 return <div className="stack">
  <section className="panel"><h2>Stress the first years of retirement</h2><p className="muted">Accumulation follows your deterministic assumptions. Each shock starts in {firstRetire}, the first retirement year. These are four what-if paths, not Monte Carlo probabilities.</p>
   <details><summary>Edit the shocks</summary><div className="field-grid">{fields.map(field=><label className="field" key={field.key}>{field.label}{field.percent?' (%)':''}<Input type="number" step={field.percent?'0.5':'1'} min={field.percent?(field.key==='highInflation'?-49.5:-100):1} max={field.percent?100:30} value={inputs[field.key]} onChange={event=>setInputs(previous=>({...previous,[field.key]:event.target.value}))}/></label>)}</div><div className="actions"><Button variant="outline" onClick={()=>setInputs(initialFields())}>Reset shocks</Button></div><p className="small muted">All market returns here are nominal annual total returns before existing fees and tax drag. Low returns replace stock and bond returns for the chosen stretch. The inflation shock changes CPI only; it does not increase nominal investment returns to compensate.</p></details>
   {calculation.error&&<p role="alert" className="notice error">{calculation.error}</p>}
   {output&&<><div className="stat-grid"><div className="stat"><span>Financial assets entering {output.retirementYear}</span><strong>{entry!.retirementOpeningReal===null?'Unavailable':dollars(entry!.retirementOpeningReal)}</strong><small>{plan.baseYear} purchasing power, before the shock</small></div><div className="stat"><span>Accessible at retirement entry</span><strong>{entry!.accessibleAtRetirementReal===null?'Unavailable':dollars(entry!.accessibleAtRetirementReal)}</strong><small>Cash, taxable assets and eligible retirement funds</small></div></div>
    <Table><TableHeader><TableRow>{['Path','Financial assets in '+plan.endYear,'First unfunded year','Retirement bridge','Spending adjustments'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{[{...output.baseline,kind:'baseline'},...output.cases].map((item)=><TableRow key={item.id}><TableCell><strong>{item.label}</strong><p className="small muted">{item.id==='baseline'?'Unchanged annual assumptions':item.kind==='crash'?`${percent(output.shocks.crashStock)} stocks / ${percent(output.shocks.crashBond)} bonds in ${output.retirementYear}`:item.kind==='low'?`${percent(output.shocks.lowStock)} stocks / ${percent(output.shocks.lowBond)} bonds for ${output.shocks.lowYears} years`:item.kind==='inflation'?`${percent(output.shocks.highInflation)} CPI for ${output.shocks.inflationYears} years`:`Low returns: ${output.shocks.lowYears} years; high CPI: ${output.shocks.inflationYears} years`}</p></TableCell><TableCell>{dollars(item.summary.financialRemaining)}<p className="small muted">{plan.baseYear} dollars · home excluded</p></TableCell><TableCell className={item.summary.firstGap!==null?'negative':''}>{item.summary.firstGap===null?'None in modeled years':item.summary.firstGap}{item.summary.firstGap!==null&&<p className="small muted">{dollars(item.summary.firstGapReal)} unfunded · {item.summary.failureType==='access-gap'?'assets remained inaccessible':item.summary.failureType==='depletion'?'portfolio depleted':'mixed funding shortfall'}</p>}</TableCell><TableCell>{!item.summary.bridge.applicable?'No early-access bridge':item.summary.bridge.firstGap===null?`Funded through ${item.summary.bridge.endYear}`:`Gap in ${item.summary.bridge.firstGap}`}</TableCell><TableCell>{item.summary.spendingCutYears} strategy-cut years<p className="small muted">{item.summary.budgetOverrunYears} protected-cost overrun years</p></TableCell></TableRow>)}</TableBody></Table>
    <div className="actions"><Button variant="outline" onClick={()=>download('retirement-stress-cases.json',JSON.stringify({plan,shocks:output.shocks,retirementYear:output.retirementYear,baseline:output.baseline.summary,cases:output.cases.map((item)=>({id:item.id,label:item.label,summary:item.summary})),method:'Deterministic accumulation; nominal retirement shocks; annual returns before withdrawals'},null,2))}>Export cases + inputs</Button></div>
   </>}
   <p className="small muted">The bridge runs from first retirement until both people reach this model’s age-based account access, or the forecast ends. Its result requires every year in that interval to be funded. Positive assets after an earlier gap do not erase that gap.</p>
   <p className="small muted">Outside each shock window, baseline nominal returns are unchanged. After elevated inflation ends, the higher price level persists: CPI-linked budgets retain that increase, while fixed nominal overrides, rent growth, healthcare growth and tax-indexing assumptions keep their own rules. Existing withdrawal strategies can cut flexible spending. This annual model applies returns before withdrawals; FI Calc withdraws first, so its results are not directly comparable.</p>
  </section>
  <section className="panel"><h3>Replay history starting at retirement</h3><p>Keep the deterministic account balances entering {firstRetire}, then test every complete historical retirement window with its matched CPI. Account ownership, tax basis, Roth contribution basis and remaining conversion lots carry forward. The historical path starts at retirement, rather than using up early return years during accumulation.</p>
   <div className="actions"><Button onClick={runHistory} disabled={progress!==null}>Run retirement-only history</Button>{progress!==null&&<Button variant="outline" onClick={()=>{worker.current?.cancel();worker.current=null;setHistoryState(previous=>previous?.key===key?{...previous,progress:null}:previous);}}>Cancel</Button>}</div>
   {progress!==null&&<p role="status">Replaying complete windows… {Math.round(progress*100)}%</p>}{historyError&&<p role="alert" className="notice error">{historyError}</p>}
   {history&&<><div className="stat-grid"><div className="stat"><span>Historical windows fully funded</span><strong>{percent(history.successRate)}</strong><small>{history.runs} complete windows · {history.dataRange}</small></div><div className="stat"><span>Median financial assets in {plan.endYear}</span><strong>{dollars(history.bands.at(-1)?.p50??0)}</strong><small>{plan.baseYear} purchasing power</small></div><div className="stat"><span>First failures due to access gaps</span><strong>{history.failureTypes?.['access-gap']??0}</strong><small>Windows with inaccessible assets remaining</small></div></div><p>{percent(history.withinBudgetSuccessRate)} funded all years without a protected-cost budget overrun; {percent(history.spendingCutRate)} reduced flexible spending under the selected strategy.</p><p className="small muted">First unfunded years: {Object.entries(history.failures).length?Object.entries(history.failures).map(([year,count])=>`${year}: ${count} windows`).join(' · '):'none in these windows'}.</p><Button variant="outline" onClick={()=>download('retirement-historical-test.json',JSON.stringify({sourcePlan:plan,...retirementHistoricalRequest(plan),result:history},null,2))}>Export history + retirement opening</Button></>}
   <p className="small muted">Conditional on deterministic accumulation, not a lifetime forecast. Overlapping historical windows are not independent; the passing share is not a future probability. No invented or wrapped years are used. The shock edits above do not affect this separate historical run. A purchase before retirement is unsupported here because the engine cannot initialize an existing home and mortgage; use the complete-plan historical test instead.</p>
  </section>
 </div>;
}
