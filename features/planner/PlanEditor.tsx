'use client';
import {convertReturnUnits} from '../../engine/return-assumptions.mjs';
import { useId, useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {budgetDefaults} from '../../engine/budget.mjs';
import {dollars} from './format';
import HsaYearOverrides from './HsaYearOverrides';
import {calculateSepp} from '../../packages/engine/runtime/bridge/sepp.js';

import type {Plan,Expense} from './model-types';
type Props = { plan: Plan; onChange: (plan: Plan) => void };
type Path = (string | number)[];
type NumericProps = { label: string; help: string; value: number; onChange: (value: number) => void; percent?: boolean; min?: number; max?: number; integer?: boolean };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '20px' };
const muted = { fontSize: 14, lineHeight: 1.5, color: 'var(--muted-foreground, #64748b)' };
const section = { display: 'grid', gap: 24, paddingTop: 24 };

// Keep unfinished input local. A blank draft never turns an account balance into zero.
export function NumberField(props: NumericProps) {
  return <NumberFieldDraft key={`${props.value}:${props.percent === true}`} {...props} />;
}
function NumberFieldDraft({ label, help, value, onChange, percent = false, min, max, integer = false }: NumericProps) {
  const id = useId();
  const display = (n: number) => Number.isFinite(n) ? String(Number((n * (percent ? 100 : 1)).toFixed(8))) : '';
  const [draft, setDraft] = useState(display(value));
  const [error, setError] = useState('');
  function commit() {
    if (!draft.trim()) { setDraft(display(value)); setError(''); return; }
    const next = Number(draft) / (percent ? 100 : 1);
    if (!Number.isFinite(next) || (integer && !Number.isInteger(next)) || (min !== undefined && next < min) || (max !== undefined && next > max)) {
      setError(`Enter ${integer ? 'a whole number' : 'a number'}${min !== undefined ? ` of at least ${display(min)}` : ''}${max !== undefined ? ` and at most ${display(max)}` : ''}.`);
      return;
    }
    setError(''); onChange(next); setDraft(display(next));
  }
  return <div className="field" style={{ display: 'grid', alignContent: 'start', gap: 7 }}>
    <Label htmlFor={id} style={{ fontSize: 14 }}>{label}{percent ? ' (%)' : ''}</Label>
    <Input id={id} type="text" inputMode={integer ? 'numeric' : 'decimal'} value={draft} style={{ minHeight: 44, fontSize: 16 }} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={!!error}
      onChange={e => { setDraft(e.target.value); setError(''); }} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(display(value)); setError(''); } }} />
    <span id={`${id}-help`} style={muted}>{help}</span>
    {error && <span id={`${id}-error`} role="alert" style={{ ...muted, color: '#be123c' }}>{error}</span>}
  </div>;
}

function TextField({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="field" style={{ display: 'grid', gap: 7 }}><Label htmlFor={id} style={{ fontSize: 14 }}>{label}</Label><Input id={id} value={value} onChange={e => onChange(e.target.value)} style={{ minHeight: 44, fontSize: 16 }} aria-describedby={`${id}-help`} /><span id={`${id}-help`} style={muted}>{help}</span></div>;
}

export function Choice({ label, help, value, onChange, options }: { label: string; help: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  const id = useId();
  return <div className="field" style={{ display: 'grid', gap: 7, alignContent: 'start' }}><Label htmlFor={id} style={{ fontSize: 14 }}>{label}</Label>
    <Select value={value} onValueChange={onChange}><SelectTrigger id={id} style={{ width: '100%', minHeight: 44, fontSize: 16 }} aria-describedby={`${id}-help`}><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, title]) => <SelectItem key={key} value={key} style={{ fontSize: 14, minHeight: 40 }}>{title}</SelectItem>)}</SelectContent></Select>
    <span id={`${id}-help`} style={muted}>{help}</span></div>;
}

export function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, minHeight: 56 }}><div><Label htmlFor={id} style={{ fontSize: 14, lineHeight: 1.5 }}>{label}</Label><p id={`${id}-help`} style={{ ...muted, marginTop: 4 }}>{help}</p></div><Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-help`} style={{ flexShrink: 0 }} /></div>;
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="panel" style={{ padding: 'clamp(18px, 3vw, 28px)' }}><div className="section-head" style={{ marginBottom: 22 }}><div><h3 style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>{title}</h3>{description && <p style={{ ...muted, marginTop: 6 }}>{description}</p>}</div></div>{children}</section>;
}

export function Advanced({ title, children }: { title: string; children: ReactNode }) {
  return <details style={{ borderTop: '1px solid var(--border, #e2e8f0)', marginTop: 24, paddingTop: 16 }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, minHeight: 44, paddingBlock: 10 }}>{title}</summary><div style={{ paddingTop: 14, display: 'grid', gap: 24 }}>{children}</div></details>;
}

export default function PlanEditor({ plan, onChange }: Props) {
  const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object')throw Error('Invalid nested plan field.');return value as Record<string,unknown>;};
  function edit(path: Path, value: unknown) {
    const next = structuredClone(plan); let cursor = record(next);
    const defaults: Record<string,object> = {hsa:{eligible:false,verified:false,coverage:'individual',eligibleMonths:12,employeeAnnual:0,employerAnnual:0,payroll:true},backdoor:{verified:false,pretaxIraBalance:0,aftertaxIraBasis:0},megaBackdoor:{enabled:false,verified:false,afterTaxAllowed:false,rothIraRolloverAllowed:false,annual:0}};
    for (const key of path.slice(0, -1)) { cursor[key] ??= structuredClone(defaults[String(key)]??{}); cursor = record(cursor[key]); }
    const key = path[path.length - 1]; cursor[key] = value;
    if (key === 'expenses') { const ids=new Set((value as Expense[]).map(e=>e.id)); for (const [y,row] of Object.entries(next.overrides)) { for(const k of Object.keys(row))if(k.startsWith('expense_')&&!ids.has(k.slice(8)))delete row[k]; if(!Object.keys(row).length)delete next.overrides[Number(y)]; } }
    if (key === 'employee401kMode' && value === 'percent') cursor.employee401kPercent ??= .15;
    if (key === 'cashReserveMode' && value === 'months') cursor.reserveMonths ??= 6;
    if (key === 'birthYear' && cursor.birthDate) delete cursor.birthDate;
    if (key === 'socialSecurityAnnual' && typeof value==='number' && value > 0) cursor.socialSecurityStartYear ??= Number(cursor.birthYear) + 67;
    onChange(next);
  }
  function read(path: Path):unknown { return path.reduce<unknown>((obj,key)=>obj&&typeof obj==='object'?(obj as Record<string,unknown>)[key]:undefined,plan); }
  function num(path: Path, label: string, help: string, options: Partial<Omit<NumericProps, 'label' | 'help' | 'value' | 'onChange'>> = {}, fallback = 0) { return <NumberField key={path.join('.')} label={label} help={help} value={typeof read(path)==='number'?Number(read(path)):fallback} onChange={value => edit(path, value)} min={0} {...options} />; }
  function year(path: Path, label: string, help: string, fallback = plan.startYear) { return num(path, label, help, { integer: true, min: 1900, max: 2200 }, fallback); }
  function pct(path: Path, label: string, help: string, fallback = 0, min = 0, max = 1) { return num(path, label, help, { percent: true, min, max }, fallback); }
  const h = plan.housing;
  const ownerOptions: [string, string][] = [['joint', 'Household'], ...plan.people.map((p) => [p.id, p.name || 'Person'] as [string, string])];
  return <div style={{ fontSize: 14 }}>
    <Tabs defaultValue="people">
      <div style={{ overflowX: 'auto', paddingBottom: 5 }}><TabsList aria-label="Plan inputs" style={{ minHeight: 48, minWidth: 'min(100%, 480px)', gap: 4 }}>
        {['People', 'Spending', 'Housing', 'Strategy', 'Assumptions'].map(tab => <TabsTrigger key={tab} value={tab.toLowerCase()} style={{ minHeight: 42, paddingInline: 16, fontSize: 14 }}>{tab}</TabsTrigger>)}
      </TabsList></div>

      <TabsContent value="people"><div style={section}>
        <div className="notice" style={{ ...muted, padding: '0 2px' }}>Enter opening balances as of the start of {plan.startYear}. Annual amounts use {plan.baseYear} dollars unless noted.</div>
        {plan.people.map((person, i: number) => {
          const path = (key: string): Path => ['people', i, ...key.split('.')];
          const sepp=person.sepp;
          let seppSummary;let seppError='';if(sepp?.input){try{seppSummary=calculateSepp(sepp.input);}catch(error){seppError=error instanceof Error?error.message:String(error);}}
          return <Group key={person.id} title={person.name || `Person ${i + 1}`} description={`Work, savings and retirement · target age ${person.retireYear - person.birthYear}`}>
            <div style={grid}>
              <TextField label="Name" help="Used throughout this plan." value={person.name} onChange={v => edit(path('name'), v)} />
              {year(path('birthYear'), 'Birth year', 'Approximate ages only; enter the full date for safer access and coverage timing.')}
              <label className="field">Birth date (optional)<Input type="date" aria-label={`${person.name} birth date`} value={person.birthDate??''} onChange={e=>{const next=structuredClone(plan);next.people[i].birthDate=e.target.value;if(e.target.value)next.people[i].birthYear=Number(e.target.value.slice(0,4));onChange(next);}}/><span className="small muted">Date-based access starts in the first full calendar year eligible for age 59½ withdrawals.</span></label>
              {num(path('salary'), 'Annual gross salary ($)', 'Salary in the quote year below, before taxes and contributions.')}
              {year(path('salaryBaseYear'), 'Salary quote year', 'The year this salary amount describes; raises begin after it.', Math.max(plan.startYear,person.workStart))}
              <Choice label="Salary raise units" help="Nominal raises include inflation; real raises are purchasing-power growth. The handoff salary/promotions are nominal dollar quotes." value={person.salaryGrowthUnit??'nominal'} onChange={v=>edit(path('salaryGrowthUnit'),v)} options={ [['nominal','Before inflation (nominal)'],['real','After inflation (real)']] } />
                {pct(path('salaryGrowth'), 'Annual salary growth', 'Annual raise in the selected units, applied during working years.')}
              {year(path('workStart'), 'First working year', 'Salary and new contributions begin this year.')}
              {year(path('retireYear'), 'First retired year', 'Employment income and regular contributions stop.')}
            </div>
            <Advanced title="Promotions & career breaks">
              <p className="small muted">A promotion sets salary in its year, then normal raises resume. A break reduces pay for the selected years; employment tenure continues. Single-year salary overrides in Year by year take priority.</p>
              {(person.promotions??[]).map((promotion,j:number)=><div className="field-grid" key={j}>
                {year(['people',i,'promotions',j,'year'],'Promotion year','First year of the new nominal salary.')}
                <Choice label="Promotion input" help="Use a new nominal salary or a percentage increase after that year’s normal raise." value={promotion.percent===undefined?'salary':'percent'} onChange={v=>edit(path('promotions'),(person.promotions??[]).map((x,k:number)=>k===j?(v==='percent'?{year:x.year,percent:.1}:{year:x.year,salary:person.salary}):x))} options={ [['salary','New salary'],['percent','Percentage increase']] }/>
                {promotion.percent===undefined?num(['people',i,'promotions',j,'salary'],'New annual salary','Salary in promotion-year dollars, before the break fraction.'):pct(['people',i,'promotions',j,'percent'],'Promotion increase','Additional raise after normal annual growth.',.1,0,1)}
                <Button variant="ghost" onClick={()=>edit(path('promotions'),(person.promotions??[]).filter((_,k:number)=>k!==j))}>Remove promotion</Button>
              </div>)}
              <Button variant="outline" onClick={()=>edit(path('promotions'),[...(person.promotions??[]),{year:Math.max(plan.startYear,person.workStart)+(person.promotions?.length??0),salary:person.salary}])}>Add promotion</Button>
              {(person.careerBreaks??[]).map((br,j:number)=><div className="field-grid" key={j}>
                {year(['people',i,'careerBreaks',j,'start'],'Break starts','First year with reduced work.')}
                {year(['people',i,'careerBreaks',j,'end'],'Break ends','Last year with reduced work, inclusive.')}
                {pct(['people',i,'careerBreaks',j,'payFraction'],'Salary retained','Zero is an unpaid break; 50% models half pay.')}
                <Button variant="ghost" onClick={()=>edit(path('careerBreaks'),(person.careerBreaks??[]).filter((_,k:number)=>k!==j))}>Remove break</Button>
              </div>)}
              <Button variant="outline" onClick={()=>edit(path('careerBreaks'),[...(person.careerBreaks??[]),{start:Math.max(plan.startYear,person.workStart),end:Math.max(plan.startYear,person.workStart),payFraction:0}])}>Add career break</Button>
              <Choice label="Spousal IRA funding schedule" help="Joint filing, eligible combined compensation and available household cash are required. Continuing after retirement must be explicitly elected; it never creates earned income." value={person.spousalIRA===true?'continue':person.spousalIRA===false?'disabled':'career'} onChange={v=>edit(path('spousalIRA'),v==='career'?undefined:v==='continue')} options={[['career','During planned career / breaks'],['continue','Continue while spouse earns'],['disabled','Disable spousal funding']]}/>
            </Advanced>
            <Advanced title="Contributions & employer match">
              <div style={grid}>
                <Choice label="401(k) election" help="Choose an annual dollar amount or a percentage of salary." value={person.employee401kMode || 'dollar'} onChange={v => edit(path('employee401kMode'), v)} options={ [['dollar', 'Annual dollars'], ['percent', 'Percent of salary']] } />
                {(person.employee401kMode || 'dollar') === 'percent' ? pct(path('employee401kPercent'), 'Employee 401(k) election', 'Percentage of salary; the engine applies annual contribution limits.', .15) : num(path('employee401k'), 'Employee 401(k) / year ($)', 'Requested contribution, subject to annual contribution limits.')}
                {num(path('rothContribution'), 'Roth IRA / year ($)', 'Requested annual contribution during working years.')}
                <Choice label="Savings strategy" help="Legacy keeps your saved election. Sweep invests remaining pay above declared expenses; enter personal spending explicitly." value={person.savingsStrategy?.mode??'legacy'} onChange={v=>{const next=structuredClone(plan);if(v==='legacy')delete next.people[i].savingsStrategy;else next.people[i].savingsStrategy=v==='fixed_amount'?{mode:'fixed_amount',annualTarget:person.savingsAnnual??0,overflow:'sweep_to_taxable'}:v==='percentage_of_net'?{mode:'percentage_of_net',savingsRate:.5}:{mode:'max_out_and_sweep_surplus'};onChange(next);}} options={[['legacy','Keep saved contribution elections'],['max_out_and_sweep_surplus','Max tax-advantaged + sweep all surplus'],['fixed_amount','Fixed savings + chosen overflow'],['percentage_of_net','Percentage of after-tax earned income']]}/>
                {person.savingsStrategy?.mode==='fixed_amount'&&<>{num(path('savingsStrategy.annualTarget'),'Annual savings target','Base-year dollars; employer contributions are additional.')}
                <Choice label="Excess income" help="Choose whether income above the target is invested or spent." value={person.savingsStrategy.overflow} onChange={v=>edit(path('savingsStrategy.overflow'),v)} options={[['sweep_to_taxable','Sweep to taxable'],['lifestyle_spend','Lifestyle spending']]}/></>}
                {person.savingsStrategy?.mode==='percentage_of_net'&&pct(path('savingsStrategy.savingsRate'),'Savings share of net earned income','Includes employee retirement/HSA savings. Uses pay plus other earned inflows less estimated earned-income federal and payroll tax; portfolio, withdrawal and conversion taxes remain household costs. Essential costs are protected.',.05)}
                {!person.savingsStrategy&&<><Toggle label="Keep an optional legacy savings cap" help="A saved personal election, not a statutory limit. Disable to invest surplus." checked={person.savingsAnnual!==undefined} onChange={v=>{const next=structuredClone(plan);if(v)next.people[i].savingsAnnual=0;else delete next.people[i].savingsAnnual;onChange(next);}}/>
                {person.savingsAnnual!==undefined&&num(path('savingsAnnual'),'Legacy total savings target','Employee retirement, Roth and taxable combined, in base-year dollars.',{},0)}</>}
                {pct(path('brokerageReturnDrag'),'Taxable return drag','Real percentage-point drag on taxable total returns; household fees remain separate.',0,0,.5)}
                <Choice label="Recurring investment tax treatment" help="Embedded drag replaces ongoing distribution-tax cost; gains on sales remain taxable. Explicit charges actual estimated distributions tax plus any selected drag." value={person.brokerageTaxTreatment??'explicit'} onChange={v=>edit(path('brokerageTaxTreatment'),v)} options={ [['explicit','Calculate distribution tax'],['embedded','Included in return drag']] } />
                {num(path('brokerageContribution'), 'Brokerage / year ($)', `Planned annual taxable investing; $${(person.brokerageContribution/12).toLocaleString('en-US',{maximumFractionDigits:0})} per month.`)}
                {pct(path('matchImmediate'), 'Immediately vested employer contribution', 'Employer contribution as a share of salary; 4% in the original plan.')}
                {pct(path('matchGraded'), 'Graded employer contribution', 'Employer contribution as a share of salary; 6% in the original plan.')}
                {year(path('employmentStart'), 'Employer start year', 'The graded portion vests 20% per year over five years.')}
              </div>
            </Advanced>

            <Advanced title="Health savings & advanced Roth funding">
              <p className="notice info">These optional routes execute only after their eligibility and provider rules are marked verified. Existing ordinary 401(k), IRA and taxable elections remain editable above.</p>
              <h4>Health savings account</h4>
              <div style={grid}>
                <Toggle label="HSA-eligible coverage" help="Confirm an eligible HDHP and no disqualifying coverage; a high deductible alone is insufficient." checked={person.hsa?.eligible===true} onChange={v=>edit(path('hsa.eligible'),v)}/>
                <Toggle label="HSA eligibility verified" help="Recurring elections retain the employment/age-65 gates. Use a verified single-year override below for direct funding without wages or partial Medicare-transition years." checked={person.hsa?.verified===true} onChange={v=>edit(path('hsa.verified'),v)}/>
                <Choice label="HSA coverage tier" help="Family limits are shared across modeled people with family coverage; age-55 catch-up is individual." value={person.hsa?.coverage??'individual'} onChange={v=>edit(path('hsa.coverage'),v)} options={[['individual','Individual'],['family','Family']]}/>
                {num(path('hsa.eligibleMonths'),'Eligible months / year','Prorates the annual limit; no last-month-rule assumption.',{integer:true,max:12},12)}
                {num(path('hsa.employeeAnnual'),'Employee HSA / year','Base-year dollars; limited by eligible months and statutory room.')}
                {num(path('hsa.employerAnnual'),'Employer HSA / year','Counts toward the shared statutory HSA contribution limit.')}
                <Toggle label="Payroll cafeteria-plan contribution" help="Verified payroll HSA contributions reduce modeled FICA; direct contributions do not." checked={person.hsa?.payroll===true} onChange={v=>edit(path('hsa.payroll'),v)}/>
                {num(path('hsaBalance'),'Opening HSA balance','A separate medical-use asset; not automatically treated as general spending money.')}
                {num(path('hsaQualifiedExpensesAnnual'),'Qualified medical reimbursement / year','Already included in your expense budget; this funding allowance does not add spending. Confirm receipts, eligibility and prior reimbursement.')}
              </div>
              <HsaYearOverrides election={person.hsa} startYear={plan.startYear} endYear={plan.endYear} personName={person.name} onChange={rows=>edit(path('hsa.yearOverrides'),rows)}/>
              <h4>IRA funding method</h4>
              <div style={grid}>
                <Choice label="IRA contribution route" help="Direct Roth applies income eligibility. Verified backdoor funding models an immediate nondeductible IRA contribution and Roth conversion." value={person.rothMode??'direct'} onChange={v=>edit(path('rothMode'),v)} options={[['direct','Direct Roth IRA'],['backdoor','Verified backdoor Roth']]}/>
                {person.rothMode==='backdoor'&&<>
                  <Toggle label="Backdoor assumptions verified" help="Confirm eligible compensation and an immediate conversion. The current forward model supports a clean zero-balance IRA route; positive IRA basis or pre-tax balances require separate pro-rata review." checked={person.backdoor?.verified===true} onChange={v=>edit(path('backdoor.verified'),v)}/>
                  {num(path('backdoor.pretaxIraBalance'),'Year-end pre-tax IRA balance','All traditional, SEP and SIMPLE IRAs combined; exclude 401(k). Positive balances are not supported in the current backdoor projection.')}
                  {num(path('backdoor.aftertaxIraBasis'),'Existing nondeductible IRA basis','Prior Form 8606 basis; positive existing basis needs a separate reviewed pro-rata schedule.')}
                </>}
              </div>
              <h4>After-tax workplace funding to Roth IRA</h4>
              <div style={grid}>
                <Toggle label="Enable mega-backdoor route" help="Models immediate after-tax workplace contributions rolled into a Roth IRA. Generic in-plan Roth 401(k) conversion is not modeled by this setting." checked={person.megaBackdoor?.enabled===true} onChange={v=>edit(path('megaBackdoor.enabled'),v)}/>
                {person.megaBackdoor?.enabled&&<>
                  <Toggle label="Provider rules verified" help="Only verified routes execute; check the plan document and administrator." checked={person.megaBackdoor?.verified===true} onChange={v=>edit(path('megaBackdoor.verified'),v)}/>
                  <Toggle label="Plan permits after-tax contributions" help="This is a separate non-Roth after-tax contribution source, subject to the total workplace annual-additions limit." checked={person.megaBackdoor?.afterTaxAllowed===true} onChange={v=>edit(path('megaBackdoor.afterTaxAllowed'),v)}/>
                  <Toggle label="Immediate Roth IRA rollover permitted" help="Confirm the plan permits the assumed immediate rollover; the model assumes no intervening earnings." checked={person.megaBackdoor?.rothIraRolloverAllowed===true} onChange={v=>edit(path('megaBackdoor.rothIraRolloverAllowed'),v)}/>
                  {num(path('megaBackdoor.annual'),'Requested after-tax funding / year','Base-year dollars; actual funding is limited by total workplace additions and cash available after protected expenses.')}
                </>}
              </div>
            </Advanced>
            <Advanced title="Starting accounts & tax basis">
              <div style={grid}>
                {num(path('traditional'), 'Traditional retirement balance ($)', 'Total pre-tax account balance, including any unvested amount.')}
                {num(path('unvested'), 'Unvested amount ($)', 'Already included in the traditional account balance.')}
                {num(path('roth'), 'Roth balance ($)', 'Total Roth account value, including contributions and earnings.')}
                {num(path('rothBasis'), 'Remaining Roth contribution basis ($)', 'Enter regular contributions remaining after withdrawals, excluding conversion principal. Can exceed account value after losses.')}
                <Toggle label="Contribution basis documented" help="Mark this only after checking your contribution and distribution records. It does not change the amount." checked={person.rothBasisDocumented===true} onChange={v=>edit(path('rothBasisDocumented'),v)}/>
                {year(path('rothOpenYear'), 'First Roth funding year', 'Starts the account’s five-year qualification clock.')}
                {num(path('brokerage'), 'Brokerage balance ($)', 'Current market value of taxable investments.')}
                {num(path('brokerageBasis'), 'Brokerage cost basis ($)', 'Acquisition cost used to estimate realized capital gains.')}
                {num(path('cash'), 'Starting cash ($)', 'Bank accounts and other cash available to the plan.')}
              </div>
            </Advanced>
            <Advanced title="Opening Roth conversion history">
              <p className="small muted">Enter each historical conversion tax year and remaining principal as of the start of {plan.startYear}. Enter total and taxable principal remaining. Unknown taxable principal defaults to fully taxable; traditional after-tax basis/pro-rata calculations still need separate review. Five tax years elapse on January 1 of the conversion year + 5.</p>
              {(person.rothConversionLots??[]).map((lot,j:number)=><div className="field-grid" key={j}>
                {num(['people',i,'rothConversionLots',j,'year'],'Conversion tax year','Must be before the forecast starts.',{integer:true,min:1900,max:plan.startYear-1})}
                {num(['people',i,'rothConversionLots',j,'amount'],'Remaining conversion principal','Excludes regular contributions and earnings.')}
                {num(['people',i,'rothConversionLots',j,'taxableAmount'],'Taxable converted principal remaining','The portion that can incur early-conversion recapture; cannot exceed total remaining principal.',{max:lot.amount},lot.amount)}
                <Toggle label="History documented" help="Verify conversion and withdrawal records. Undocumented input still affects calculations and is flagged in Review." checked={lot.documented===true} onChange={v=>edit(['people',i,'rothConversionLots',j,'documented'],v)}/>
                <Button variant="ghost" onClick={()=>edit(path('rothConversionLots'),(person.rothConversionLots??[]).filter((_,k:number)=>k!==j))}>Remove lot</Button>
              </div>)}
              <Button variant="outline" onClick={()=>edit(path('rothConversionLots'),[...(person.rothConversionLots??[]),{year:plan.startYear-1,amount:0,documented:false}])}>Add historical conversion</Button>
            </Advanced>

            <Advanced title="Reviewed SEPP / 72(t) schedule">
              <p className="small muted">Optional commitment from one segregated account through the later of five years or age 59½. Changes can trigger prior-penalty recapture and interest. This annual model supports new January 1 schedules using fixed amortization or RMD; annuitization and existing schedules are not supported.</p>
              {!sepp?.input?<Button variant="outline" onClick={()=>edit(path('sepp'),{enabled:false,input:{accountId:`${person.id}-sepp`,accountType:'traditional_ira',birthDate:person.birthDate??'',startDate:`${person.retireYear}-01-01`,valuationDate:`${person.retireYear-1}-12-31`,openingBalance:0,method:'fixed_amortization',annualInterestRate:.05,factorTable:{kind:'single_life',edition:'',source:'',verified:false,factors:{[person.retireYear-person.birthYear]:0}},review:{segregatedAccount:false,accountAccessConfirmed:false,employerSeparationConfirmed:false,scheduleReviewed:false}}})}>Configure a SEPP scenario</Button>:<>
                <Toggle label="Enable reviewed SEPP schedule" help="An enabled schedule must pass all date, account, table and review checks before calculations or saving." checked={sepp.enabled===true} onChange={v=>edit(path('sepp.enabled'),v)}/>
                <div style={grid}>
                  <TextField label="Segregated account ID" help="If tracking opening sources, use its exact source ID to allocate from that account. A different ID allocates only from the untracked vested remainder." value={sepp.input.accountId} onChange={v=>edit(path('sepp.input.accountId'),v)}/>
                  <Choice label="SEPP account type" help="An employer plan requires separation and permission for distributions." value={sepp.input.accountType} onChange={v=>edit(path('sepp.input.accountType'),v)} options={[['traditional_ira','Traditional IRA'],['employer_plan','Separated employer plan']]}/>
                  <label className="field">Exact birth date<Input type="date" value={sepp.input.birthDate} onChange={e=>edit(path('sepp.input.birthDate'),e.target.value)}/><span className="small muted">Must match the person’s full birth date above.</span></label>
                  <label className="field">First payment date<Input type="date" value={sepp.input.startDate} onChange={e=>edit(path('sepp.input.startDate'),e.target.value)}/><span className="small muted">January 1 only; start cannot precede the forecast.</span></label>
                  <label className="field">Valuation date<Input type="date" value={sepp.input.valuationDate} onChange={e=>edit(path('sepp.input.valuationDate'),e.target.value)}/><span className="small muted">Prior December 31 for RMD; fixed amortization accepts that date through commencement.</span></label>
                  {num(path('sepp.input.openingBalance'),'Segregated opening balance','Nominal amount allocated from vested traditional funds at commencement; it is not added to assets.')}
                  <Choice label="SEPP calculation method" help="Fixed payments remain nominal; RMD payments use the prior-year segregated balance and an entered factor for each payment age." value={sepp.input.method} onChange={v=>edit(path('sepp.input.method'),v)} options={[['fixed_amortization','Fixed amortization'],['rmd','Required minimum distribution']]}/>
                  {sepp.input.method==='fixed_amortization'&&pct(path('sepp.input.annualInterestRate'),'Amortization interest','Up to 5% without an AFR quote. A higher-rate reviewed quote can be supplied in an imported scenario.',.05,0,.05)}
                </div>
                <h4>Reviewed life-expectancy factors</h4><div style={grid}>
                  <Choice label="IRS factor table" help="Supply factors from the applicable dated IRS table; no factors are inferred." value={sepp.input.factorTable.kind} onChange={v=>edit(path('sepp.input.factorTable.kind'),v)} options={[['single_life','Single life'],['uniform_lifetime','Uniform lifetime']]}/>
                  <TextField label="Table edition" help="Retain the applicable edition/date with the scenario." value={sepp.input.factorTable.edition} onChange={v=>edit(path('sepp.input.factorTable.edition'),v)}/>
                  <TextField label="Primary table source URL" help="Enter the IRS publication or notice supporting your selected factors." value={sepp.input.factorTable.source} onChange={v=>edit(path('sepp.input.factorTable.source'),v)}/>
                  <Toggle label="Table and factors reviewed" help="RMD needs a factor for every payment age through the schedule. Fixed amortization needs the start-age factor." checked={sepp.input.factorTable.verified===true} onChange={v=>edit(path('sepp.input.factorTable.verified'),v)}/>
                </div>
                {Object.entries(sepp.input.factorTable.factors).map(([age,factor])=><div className="field-grid" key={age}><NumberField label="Attained age" help="Age reached in this payment year." value={Number(age)} integer min={0} max={120} onChange={v=>{const factors={...sepp.input.factorTable.factors};delete factors[Number(age)];factors[v]=factor;edit(path('sepp.input.factorTable.factors'),factors);}}/><NumberField label="IRS life-expectancy factor" help="Enter the reviewed table value; zero is an unfinished placeholder." value={Number(factor)} min={.01} max={200} onChange={v=>edit(path(`sepp.input.factorTable.factors.${age}`),v)}/><Button variant="ghost" onClick={()=>{const factors={...sepp.input.factorTable.factors};delete factors[Number(age)];edit(path('sepp.input.factorTable.factors'),factors);}}>Remove factor</Button></div>)}
                <Button variant="outline" onClick={()=>{const factors={...sepp.input.factorTable.factors};const nextAge=Math.max(person.retireYear-person.birthYear-1,...Object.keys(factors).map(Number))+1;factors[nextAge]=0;edit(path('sepp.input.factorTable.factors'),factors);}}>Add payment-age factor</Button>
                <Toggle label="Account is segregated" help="No other draws, Roth conversions, transfers or new contributions may touch this scheduled account." checked={sepp.input.review.segregatedAccount===true} onChange={v=>edit(path('sepp.input.review.segregatedAccount'),v)}/>
                <Toggle label="Distribution access confirmed" help="Confirm the custodian or plan supports the schedule." checked={sepp.input.review.accountAccessConfirmed===true} onChange={v=>edit(path('sepp.input.review.accountAccessConfirmed'),v)}/>
                {sepp.input.accountType==='employer_plan'&&<Toggle label="Employer separation confirmed" help="Required before employer-plan SEPP distributions commence." checked={sepp.input.review.employerSeparationConfirmed===true} onChange={v=>edit(path('sepp.input.review.employerSeparationConfirmed'),v)}/>}
                <Toggle label="Complete schedule reviewed" help="These attestations record your review; they are not approval by the IRS or provider." checked={sepp.input.review.scheduleReviewed===true} onChange={v=>edit(path('sepp.input.review.scheduleReviewed'),v)}/>
                {seppSummary&&<p className="notice info">Initial annual distribution: {dollars(seppSummary.initialAnnualDistribution)} nominal. Commitment through {seppSummary.commitmentEndDate}. {seppSummary.eligibleForModel?'Inputs marked reviewed.':seppSummary.reviewIssues.join(' ')}</p>}
                {seppError&&<p className="notice warning">{seppError}</p>}
              </>}
            </Advanced>
            <Advanced title="Social Security (optional)"><div style={grid}>
              {num(path('socialSecurityAnnual'), 'Annual Social Security benefit ($)', 'Enter your estimated annual benefit in base-year dollars; zero excludes it.')}
              {year(path('socialSecurityStartYear'), 'First benefit year', 'First modeled year receiving Social Security.', person.birthYear + 67)}
            </div></Advanced>
          </Group>;
        })}
      </div></TabsContent>

      <TabsContent value="spending"><div style={section}>
        <Group title="Retirement budget" description="Keep your target clear: purchasing power, taxes, healthcare and housing.">
          <Toggle label="Use one retirement allowance" help="Starts when the first person retires. Replaces tagged retirement living expenses with the allowance left after housing and included costs. Existing inputs are retained." checked={plan.retirementBudget?.enabled===true} onChange={v=>edit(['retirementBudget'],{...(plan.retirementBudget??budgetDefaults()),enabled:v})}/>
          {plan.retirementBudget?.enabled&&<><div style={grid}>
            {num(['retirementBudget','annual'],'Annual retirement allowance ($)','Recurring household target; housing is always inside this allowance.')}
            <Choice label="Dollar convention" help={`Constant purchasing power increases future-dollar withdrawals with inflation. Constant future dollars loses purchasing power.`} value={plan.retirementBudget.dollarMode} onChange={v=>edit(['retirementBudget','dollarMode'],v)} options={ [['real',`Constant ${plan.baseYear} purchasing power`],['nominal','Constant future-dollar amount']] }/>
            <Choice label="Federal + payroll taxes" help="Included reduces the living allowance by the actual modeled tax bill. Additional puts taxes on top of your target." value={plan.retirementBudget.taxes} onChange={v=>edit(['retirementBudget','taxes'],v)} options={ [['included','Inside the allowance'],['additional','Additional to allowance']] }/>
            <Choice label="Modeled healthcare" help="Included makes room for net healthcare costs. Separate healthcare must be enabled with actual coverage inputs to calculate these costs." value={plan.retirementBudget.healthcare} onChange={v=>edit(['retirementBudget','healthcare'],v)} options={ [['included','Inside the allowance'],['additional','Additional to allowance']] }/>
            {num(['retirementBudget','minimumLiving'],'Minimum living allowance ($)','Protected everyday costs excluding housing/health/tax, in the selected dollar convention. If fixed costs exceed the target, the ledger shows the overrun.')}
          </div><p className="small muted">This is a fixed envelope and takes precedence over percentage/guardrail spending. Calendar expenses, moving costs and home purchase cash remain additional. Tagged retirement categories are replaced, including their essential labels; use the minimum above for protected everyday costs. A single-year total-spending override temporarily uses the legacy spending treatment; a retirement-allowance override keeps this policy.</p>{!plan.healthcare?.enabled&&<p className="notice warning">Healthcare has no separate estimate yet. Your remaining living allowance must cover it until you configure Healthcare. Including healthcare here does not establish an insurance price.</p>}</>}
        </Group>
        <Group title="Living expenses" description="Build a year-by-year spending schedule. Housing is modeled separately, so leave rent and mortgage payments out of these amounts.">
          <div style={{ display: 'grid', gap: 24 }}>{plan.expenses.map((expense, i: number) => <div key={expense.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}><h4 style={{ fontSize: 16, fontWeight: 600 }}>{expense.name || `Expense ${i + 1}`}</h4><Button variant="ghost" type="button" style={{ minHeight: 44 }} aria-label={`Remove ${expense.name || 'expense'}`} onClick={() => edit(['expenses'], plan.expenses.filter((_, index: number) => index !== i))}>Remove</Button></div>
            <div style={grid}>
              <TextField label="Expense name" help="A recognizable name for this spending phase or cost." value={expense.name} onChange={v => edit(['expenses', i, 'name'], v)} />
              {num(['expenses', i, 'annual'], 'Annual amount ($)', `Budget in ${plan.baseYear} dollars when inflation is on; monthly equivalent is $${(expense.annual/12).toLocaleString('en-US',{maximumFractionDigits:0})}.`)}
              {year(['expenses', i, 'start'], 'Start year', 'First year this expense is paid.')}
              {year(['expenses', i, 'end'], 'End year', 'Last year this expense is paid, inclusive.')}
              <Choice label="Budget phase" help="Only retirement phases move/reduce in Decisions; dated events keep their dates." value={expense.phase??(expense.id==='retire'?'retirement':expense.id==='joint'?'working':'calendar')} options={ [['calendar','Fixed calendar dates'],['working','Working phase'],['retirement','Retirement phase']] } onChange={v=>edit(['expenses',i,'phase'],v)}/>
              <Choice label="Expense owner" help="Assign this cost to one person or the household." value={expense.owner} options={ownerOptions} onChange={v => edit(['expenses', i, 'owner'], v)} />
              <Toggle label="Essential spending" help="Guardrails and percentage strategies preserve this expense. Turn off only for costs you can reduce." checked={expense.essential===true} onChange={v => edit(['expenses', i, 'essential'], v)} />
              <Toggle label="Increase with inflation" help="Off keeps the annual amount fixed in nominal dollars." checked={expense.inflate} onChange={v => edit(['expenses', i, 'inflate'], v)} />
            </div>
          </div>)}
          {!plan.expenses.length && <p style={muted}>No living expenses yet. Add a budget to include everyday spending in the projection.</p>}
          <Button variant="outline" type="button" style={{ justifySelf: 'start', minHeight: 44 }} onClick={() => edit(['expenses'], [...plan.expenses, { id: crypto.randomUUID(), name: 'New expense', owner: 'joint', essential:true, annual: 1200, start: plan.startYear, end: plan.endYear, inflate: true }])}>+ Add expense</Button>
          <Button variant="outline" type="button" onClick={()=>edit(['expenses'],[...plan.expenses,{id:crypto.randomUUID(),name:'One-time event',owner:'joint',phase:'calendar',essential:true,annual:0,start:plan.startYear,end:plan.startYear,inflate:true}])}>+ One-time cost</Button><p className="small muted">Bonuses and other one-time ordinary income belong in Year by year. Costs with matching start/end years happen once.</p></div>
        </Group>
      </div></TabsContent>

      <TabsContent value="housing"><div style={section}>
        <Group title="Home & relocation" description="Compare renting with buying. Rent applies before a modeled purchase.">
          <div style={grid}>
            <Choice label="Housing path" help="Buying activates mortgage payments and ownership costs in the purchase year." value={h.mode} onChange={v => edit(['housing', 'mode'], v)} options={ [['rent', 'Keep renting'], ['buy', 'Buy a home']] } />
            {year(['housing', 'moveYear'], 'Move year', 'Relocation and destination rent begin in this year.')}
            {num(['housing', 'rent'], 'Current monthly rent ($)', 'Monthly rent before the household or destination change.')}
            {num(['housing', 'jointRent'], 'Household monthly rent ($)', 'Monthly rent when the joint household begins.')}
            {year(['housing', 'jointRentYear'], 'Household rent begins', 'First year the household rent amount applies.')}
            {num(['housing', 'tnRent'], 'Destination monthly rent ($)', 'Monthly rent after relocating, until a purchase.')}
            {pct(['housing', 'rentGrowth'], 'Annual rent growth', 'Yearly increase in nominal rent.')}
          </div>
          {h.mode === 'buy' && <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', marginTop: 28, paddingTop: 24 }}><h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 18 }}>Purchase & ownership</h4><div style={grid}>
            {year(['housing', 'buyYear'], 'Purchase year', 'Mortgage and ownership costs begin this year.')}
            {num(['housing', 'price'], 'Home purchase price ($)', 'Purchase-year nominal price.')}
            {pct(['housing', 'down'], 'Down payment', 'Share of purchase price paid up front.')}
            {pct(['housing', 'rate'], 'Mortgage interest rate', 'Fixed annual mortgage rate.')}
            {num(['housing', 'term'], 'Mortgage term (years)', 'Length of the amortizing loan.', { integer: true, min: 1, max: 50 })}
            {pct(['housing', 'propertyTax'], 'Annual property tax', 'Annual property tax as a share of home value.')}
            {num(['housing', 'insurance'], 'Annual home insurance ($)', 'Yearly insurance cost.')}
            {pct(['housing', 'maintenance'], 'Annual maintenance', 'Annual upkeep as a share of home value.')}
            {num(['housing', 'hoa'], 'Monthly HOA fees ($)', 'Enter zero if there is no homeowners association.')}
          </div></div>}
          <Advanced title="Moving costs & transaction assumptions"><div style={grid}>
            {num(['housing', 'movingCost'], 'One-time moving cost ($)', 'Moving expense in the relocation year.')}
            {num(['housing', 'relocation'], 'Employer relocation assistance ($)', 'Taxable assistance received in the relocation year.')}
            {pct(['housing', 'closing'], 'Purchase closing costs', 'Transaction cost as a share of home price.')}
            {pct(['housing', 'selling'], 'Selling costs', 'Cost estimate used when valuing net home equity.')}
            {pct(['housing', 'appreciation'], 'Annual home appreciation', 'Nominal growth in home value.')}
          </div></Advanced>
        </Group>
      </div></TabsContent>

      <TabsContent value="strategy"><div style={section}>
        <Group title="Retirement spending" description="Choose how retirement spending responds to portfolio performance."><div style={grid}>
          <Choice label="Withdrawal strategy" help="Fixed uses your budget. Percentage follows portfolio value. Guardrails can reduce spending after declines." value={plan.strategy} onChange={v => edit(['strategy'], v)} options={ [['fixed', 'Fixed real spending'], ['percent', 'Portfolio percentage'], ['guardrails', 'Spending guardrails']] } />
          {pct(['withdrawalRate'], 'Portfolio withdrawal rate', 'Used by percentage spending and guardrail calculations.', .035, .001)}
          {pct(['spendingFloor'], 'Guardrail spending floor', 'Minimum share of flexible living costs; housing remains payable.', .8)}
          <Choice label="Surplus cash" help="Choose where cash remaining after modeled expenses and contributions goes." value={plan.surplus} onChange={v => edit(['surplus'], v)} options={ [['invest', 'Invest in brokerage'], ['cash', 'Keep in cash']] } />
          <Choice label="Cash reserve policy" help="Hold a fixed dollar reserve or a number of months of annual spending." value={plan.cashReserveMode || 'fixed'} onChange={v => edit(['cashReserveMode'], v)} options={ [['fixed', 'Fixed dollar amount'], ['months', 'Months of spending']] } />
          {plan.cashReserveMode === 'months' ? num(['reserveMonths'], 'Cash reserve (months)', 'Target months of modeled spending held in cash.', { min: 0, max: 60 }, 6) : num(['cashReserve'], 'Cash reserve ($)', 'Target cash balance before investing surplus.')}
        </div></Group>
        <Group title="Withdrawal funding order" description="Use permitted account access before reporting an unpaid bill. Additional taxes and actual account restrictions remain visible."><div style={grid}>
          <Toggle label="Allow penalty-bearing fallback" help="When penalty-free sources cannot cover bills, try permitted early distributions and fund their income tax and additional tax. Turning this off tests a strictly penalty-free bridge." checked={plan.withdrawalPolicy?.allowPenalties!==false} onChange={v=>edit(['withdrawalPolicy','allowPenalties'],v)}/>
          <Choice label="Penalty-free withdrawal order" help="Roth IRA legal ordering within the account still applies. This sets the order between account types." value={plan.withdrawalPolicy?.order??'taxable_first'} onChange={v=>edit(['withdrawalPolicy','order'],v)} options={[['taxable_first','Taxable, then Roth, then traditional'],['roth_first','Roth, then taxable, then traditional'],['pretax_first','Eligible traditional first']]}/>
          <Choice label="Early-distribution fallback preference" help="Traditional distributions create ordinary income and usually additional tax; unseasoned taxable conversion principal can incur recapture tax; nonqualified Roth earnings can incur both." value={plan.withdrawalPolicy?.earlyPreference??'conversion_first'} onChange={v=>edit(['withdrawalPolicy','earlyPreference'],v)} options={[['conversion_first','Conversion principal first'],['traditional_first','Permitted traditional first'],['roth_first','Roth funding first']]}/>
        </div><Advanced title="Account permissions & penalty exceptions">{plan.people.map((person,i:number)=><div className="stack" key={person.id}>
          <h4>{person.name}</h4>
          <Choice label="Untracked traditional funds: early access" help="Employer funds require plan permission after modeled separation. The IRA option identifies only the opening untracked remainder as IRA funds; new workplace deposits still require separation or age access. For mixed accounts, track each opening source below." value={person.pretaxEarlyAccess??'after_separation'} onChange={v=>edit(['people',i,'pretaxEarlyAccess'],v)} options={[['after_separation','After separation; plan permits'],['ira','Distributable IRA funds'],['unavailable','Unavailable before age access']]}/>
          <p className="small muted">Opening sources below are portions of the existing vested traditional balance, not extra assets. Their growth is tracked separately; future workplace deposits enter the untracked remainder. Access confirmation means you have checked distribution and rollover permissions with the provider. This annual model does not simulate payout withholding or refund timing.</p>
          {(person.pretaxSources??[]).map((source,j)=><div className="panel stack" key={source.id}>
            <TextField label="Source ID / account label" help="Use a unique account label; no account number is needed." value={source.id} onChange={v=>edit(['people',i,'pretaxSources',j,'id'],v)}/>
            <Choice label="Opening source type" help="A former employer plan must already be separated at projection start." value={source.kind} onChange={v=>{const sources=structuredClone(person.pretaxSources??[]);sources[j]={...source,kind:v as 'traditional_ira'|'former_employer',rule55Verified:false};edit(['people',i,'pretaxSources'],sources);}} options={[['traditional_ira','Traditional IRA'],['former_employer','Former employer plan']]}/>
            {num(['people',i,'pretaxSources',j,'openingBalance'],'Opening vested source balance ($)','Already included in total traditional assets. All sources together must fit inside the vested opening balance.')}
            {source.kind==='former_employer'&&year(['people',i,'pretaxSources',j,'separationYear'],'Actual separation year','Employment must have ended no later than the projection start.')}
            <Toggle label="Distribution / rollover permissions verified" help="Unconfirmed opening sources remain unavailable before age access. Paying a penalty does not create permission." checked={source.verified} onChange={v=>edit(['people',i,'pretaxSources',j,'verified'],v)}/>
            {source.kind==='former_employer'&&<Toggle label="Rule 55 eligibility reviewed for this plan" help="Requires separation in or after the calendar year turning55, and verified plan access. It exempts this source only; it does not exempt Roth IRA withdrawals." checked={source.rule55Verified===true} onChange={v=>edit(['people',i,'pretaxSources',j,'rule55Verified'],v)}/>}
            <Button variant="outline" onClick={()=>edit(['people',i,'pretaxSources'],(person.pretaxSources??[]).filter((_,k)=>k!==j))}>Remove source tracking</Button>
          </div>)}
          <Button variant="outline" onClick={()=>edit(['people',i,'pretaxSources'],[...(person.pretaxSources??[]),{id:`${person.id}-source-${Date.now()}`,kind:'former_employer',openingBalance:0,verified:false,separationYear:plan.startYear}])}>Track an opening IRA / former-plan source</Button>
          <details><summary>Reviewed account-specific exceptions</summary><div className="stack">
            {person.penaltyException===true&&<div className="notice error">The old blanket exception must be reviewed. It cannot waive every retirement-account penalty.<Button variant="outline" onClick={()=>edit(['people',i,'penaltyException'],false)}>Remove blanket exception</Button></div>}
            <Toggle label="Current employer plan: Rule 55 reviewed" help="Requires modeled separation in or after the calendar year turning55. Applies only to the untracked employer-plan remainder, never an IRA or Roth." checked={person.penaltyExceptions?.currentPlanRule55Verified===true} onChange={v=>edit(['people',i,'penaltyExceptions','currentPlanRule55Verified'],v)}/>
            <Toggle label="Traditional disability exception reviewed" help="Confirm qualifying disability for the additional-tax exception. Distribution permission must still be independently established." checked={person.penaltyExceptions?.traditionalDisabilityVerified===true} onChange={v=>edit(['people',i,'penaltyExceptions','traditionalDisabilityVerified'],v)}/>
            <Toggle label="Roth IRA disability exception reviewed" help="Confirm the IRA disability exception separately. Nonqualified earnings can still create ordinary income tax." checked={person.penaltyExceptions?.rothDisabilityVerified===true} onChange={v=>edit(['people',i,'penaltyExceptions','rothDisabilityVerified'],v)}/>
          </div></details>
        </div>)}</Advanced></Group>
        <Group title="Roth conversions & health coverage" description="Coordinate conversion timing with your target ACA household income."><div style={grid}>
          {num(['conversionAnnual'], 'Annual Roth conversion ($)', 'Requested pre-tax amount moved into Roth each year.')}
          {year(['conversionStart'], 'First conversion year', 'First year in the Roth conversion window.')}
          {year(['conversionEnd'], 'Last conversion year', 'Last year in the Roth conversion window, inclusive.')}
          {num(['acaTarget'], 'ACA MAGI target (× FPL)', 'Household income target as a multiple of the federal poverty level.', { min: 0, max: 20 })}
          <Toggle label="Cap conversions at MAGI target" help="Limit conversions to preserve space under the modeled ACA income target." checked={plan.capConversions} onChange={v => edit(['capConversions'], v)} />
        </div><Advanced title="ACA planning window & poverty-level baseline"><div style={grid}>
          {num(['acaFpl'], 'Household FPL baseline ($)', 'Annual federal poverty-level amount for your household size.')}
          {num(['acaUpper'], 'ACA upper threshold (× FPL)', 'Modeled upper income threshold; must be at least your MAGI target.', { min: 0, max: 20 })}
          {year(['acaStart'], 'First ACA year', 'First year of modeled marketplace health coverage.')}
          {year(['acaEnd'], 'Last ACA year', 'Last year of modeled marketplace health coverage, inclusive.')}
        </div></Advanced></Group>
        <Group title="Investment allocation" description="The remaining invested portfolio allocation is assigned to bonds."><div style={grid}>
          <Choice label="Allocation policy" help="Use one allocation throughout, or switch when the first person retires." value={plan.allocationMode || 'glide'} onChange={v => edit(['allocationMode'], v)} options={ [['fixed', 'Same allocation throughout'], ['glide', 'Change at retirement']] } />
          {pct(['stockWeight'], 'Stocks while working', 'Stock share before the first modeled retirement year.', 1)}
          {plan.allocationMode !== 'fixed' && pct(['retirementStockWeight'], 'Stocks in retirement', 'Stock share after retirement begins.', plan.stockWeight)}
        </div></Group>
      </div></TabsContent>

      <TabsContent value="assumptions"><div style={section}>
        <Group title="Projection horizon" description="Keep the opening balance date, budget-dollar year and forecast period aligned."><div style={grid}>
          {year(['baseYear'], 'Budget dollar year', 'The price level used for inflation-adjusted budgets.')}
          {year(['startYear'], 'First forecast year', 'First full calendar year of modeled cash flow and returns.')}
          {year(['endYear'], 'Last forecast year', 'Final year of the plan; the horizon supports up to 85 years.')}
          {year(['jointYear'], 'Joint filing begins', 'First modeled year filing jointly for income taxes.')}
        </div></Group>
        <Group title="Returns & inflation" description="Choose nominal or inflation-adjusted returns. These are assumptions, not promised returns."><div style={grid}>
          <Choice label="Return units" help="Switching units preserves every asset’s growth at the configured inflation rate. Variable inflation changes nominal paths. Real returns are after inflation; historical data remain nominal." value={plan.returnUnit || 'nominal'} onChange={v => onChange(convertReturnUnits(plan,v))} options={ [['nominal', 'Before inflation (nominal)'], ['real', 'After inflation (real)']] } />
          {pct(['inflation'], 'General inflation', 'Annual increase in inflation-linked living expenses.', .025, -.49)}
          {pct(['taxInflation'], 'Tax parameter inflation', 'Annual growth in modeled tax brackets and deductions.', .025, -.49)}
          {pct(['stockReturn'], 'Expected stock return', 'Annual return in the selected units, before portfolio fees.', .07, -.99)}
          {pct(['bondReturn'], 'Expected bond return', 'Annual return in the selected units, before portfolio fees.', .035, -.99)}
          {pct(['cashReturn'], 'Cash yield', 'Annual interest in the selected return units.', .025, -.99)}
          {pct(['fees'], 'Annual investment fees', 'Portfolio fee deducted from investment performance.', .0005, 0, .1)}
        </div><Advanced title="Returns after retirement"><div style={grid}>
          {pct(['retirementStockReturn'], 'Retirement stock return', 'Applies after the first retirement year, in the selected return units.', plan.stockReturn, -.99)}
          {pct(['retirementBondReturn'], 'Retirement bond return', 'Applies after retirement; uses the working assumption until edited.', plan.bondReturn, -.99)}
          {pct(['retirementCashReturn'], 'Retirement cash return', 'Applies after retirement; uses the working assumption until edited.', plan.cashReturn, -.99)}
        </div></Advanced><Advanced title="Market variability & taxable dividends"><div style={grid}>
          <Choice label="Monte Carlo stock growth" help="Geometric targets long-run compounded growth. Arithmetic targets the average single-year return and has lower typical compounded growth. Historical methods use observed data." value={plan.stockReturnMean || 'arithmetic'} onChange={v => edit(['stockReturnMean'],v)} options={ [['geometric','Long-run growth (geometric)'],['arithmetic','Single-year average (arithmetic)']] } />
          {pct(['stockVol'], 'Stock volatility', 'Log-return shock standard deviation for simulations.', .18)}
          {pct(['bondVol'], 'Bond volatility', 'Log-return shock standard deviation for simulations.', .07)}
          {num(['correlation'], 'Stock / bond correlation', 'Between −1 and 1; lower values provide more diversification.', { min: -1, max: 1 }, .1)}
          {pct(['bondYield'], 'Taxable bond distribution yield', 'Nominal distribution yield taxed as ordinary income; independent of real-return units.', Math.max(0,plan.bondReturn))}
          {pct(['dividendYield'], 'Taxable dividend yield', 'Annual dividend yield used for taxable brokerage income.', .015)}
        </div></Advanced></Group>
        <Group title="Assumptions to review" description="Confirm source details as you verify them. Confirmation tracks review status without changing the calculation."><div style={{ display: 'grid', gap: 18 }}>
          {(plan.assumptions || []).map((assumption, i: number) => <div key={assumption.id} style={{ borderBottom: '1px solid var(--border, #e2e8f0)', paddingBottom: 18 }}><Toggle label={assumption.text} help={assumption.confirmed ? 'Reviewed and confirmed' : 'Needs review'} checked={assumption.confirmed} onChange={v => edit(['assumptions', i, 'confirmed'], v)} /></div>)}
          {!plan.assumptions?.length && <p style={muted}>No outstanding assumption notes in this plan.</p>}
        </div></Group>
      </div></TabsContent>
    </Tabs>
  </div>;
}
