'use client';
import {type ReactNode} from 'react';
import {createTaxYear2026,calculateTaxYear,TAX_YEAR_SOURCES,TAX_YEAR_RULES_DATE} from '../../engine/tax-year.mjs';
import {NumberField,Choice,Toggle,Advanced} from './PlanEditor';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {dollars} from './format';
import type {Plan} from './model-types';
import {readPath,writePath} from './edit-path';
type TaxInput=ReturnType<typeof createTaxYear2026>;
type ScenarioImpact={id:string;label:string;deduction:number;taxSaving:number;magi:number;refund:number;balanceDue:number};
type TaxResult=Omit<ReturnType<typeof calculateTaxYear>,'scenarioImpacts'> & {scenarioImpacts:ScenarioImpact[]};

type Props={plan:Plan;onChange:(plan:Plan)=>void};
type Path=(string|number)[];
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
function Panel({title,description,children}:{title:string;description?:string;children:ReactNode}){
 return <section className="panel"><div className="section-head"><div><h3>{title}</h3>{description&&<p className="muted">{description}</p>}</div></div>{children}</section>;
}

export default function TaxYear({plan,onChange}:Props){
 const input:TaxInput=(plan.taxYear2026 as TaxInput|undefined)??createTaxYear2026();
 const result=calculateTaxYear(input) as TaxResult;
 function edit(path:Path,value:unknown){const next=structuredClone(plan);next.taxYear2026=structuredClone(input);writePath(next.taxYear2026,path,value);onChange(next);}
 const get=(path:Path):number=>{const value=readPath(input,path);return typeof value==='number'?value:0;};
 function number(path:Path,label:string,help:string,options:{percent?:boolean;min?:number;max?:number;integer?:boolean}={}){return <NumberField key={path.join('.')} label={label} help={help} value={get(path)??0} min={0} max={1e9} {...options} onChange={v=>edit(path,v)}/>;}
 function uncertain(group:'ngFinal'|'lockheed',key:'gross'|'pretax401k'|'federalWithholding',label:string,help:string){
  const actual=readPath(input,[group,key]),estimate=readPath(input,[group,`${key}Estimate`])??0;
  const amount=typeof actual==='number'?actual:typeof estimate==='number'?estimate:0;
  return <div style={{display:'grid',gap:10,alignContent:'start'}}>
   <Toggle label={`${label}: actual confirmed`} help={actual===null?'Using an editable estimate below. This keeps the settlement provisional.':'Use the year-end paystub or W-2 amount.'} checked={actual!==null} onChange={known=>edit([group,key],known?estimate:null)}/>
   <NumberField label={`${label} ($) · ${actual===null?'estimate':'actual'}`} help={help} value={amount} min={0} max={1e9} onChange={v=>edit([group,actual===null?`${key}Estimate`:key],v)}/>
  </div>;
 }
 return <div className="stack" style={{fontSize:14}}>
  <section className="panel"><div className="section-head"><div><span className="eyebrow" style={{fontSize:14}}>2026 FEDERAL TAX WORKSHEET</span><h2>Finish the year with a clearer tax estimate</h2><p className="muted">Single filer · Michael · standalone 2026 reconciliation</p></div><span className="pill">{result.provisional?'Provisional inputs':'Inputs confirmed'}</span></div>
   <p>Reconcile each employer’s wages, deferrals and withholding separately from one-time business income. Tax-year inputs do not become recurring retirement income.</p>
   <div className="notice info" style={{marginTop:18}}>Enter withholding once, including any extra withholding already included on the paystub. Estimates stay unconfirmed until actual payroll records are entered.</div>
  </section>

  <section aria-label="2026 federal tax estimate" className="stack" aria-live="polite">
   <div className="stat-grid">
    <div className="stat feature"><span>{result.refund>0?'Estimated refund':'Estimated amount due'}</span><strong>{dollars(result.refund>0?result.refund:result.balanceDue)}</strong><p style={{fontSize:14}}>{result.provisional?'Provisional, not a final bill. Missing payroll withholding uses editable estimates and changes the balance dollar for dollar.':'Based on the supplied inputs and modeled federal rules.'}</p></div>
    <div className="stat"><span>Estimated federal liability</span><strong>{dollars(result.federalTotal)}</strong><p style={{fontSize:14}}>Income tax, self-employment tax and modeled additional taxes</p></div>
    <div className="stat"><span>Payments counted once</span><strong>{dollars(result.totalPayments)}</strong><p style={{fontSize:14}}>{dollars(result.totalWithholding)} withholding + {dollars(result.estimatedPayments)} estimated payments</p></div>
   </div>
   <div className="panel"><div className="section-head"><div><h3>Contribution limits & income</h3><p className="muted">One employee 401(k) limit across both employers; employer contributions do not use it.</p></div></div>
    <div className="stat-grid">
     <div className="stat"><span>Combined employee 401(k)</span><strong>{dollars(result.total401k)}</strong><p style={{fontSize:14}}>{result.excess401k>0?`${dollars(result.excess401k)} above the modeled employee limit`:`${dollars(result.remaining401k)} remaining under the employee limit`}</p></div>
     <div className="stat"><span>Roth IRA MAGI</span><strong>{dollars(result.magi)}</strong><p style={{fontSize:14}}>Income used for this single filer’s Roth contribution calculation</p></div>
     <div className="stat"><span>Allowed Roth IRA contribution</span><strong>{dollars(result.rothLimit)}</strong><p style={{fontSize:14}}>{dollars(input.roth.contributed)} contributed{result.rothExcess>0?` · estimated excess ${dollars(result.rothExcess)}`:' · within the modeled limit'}</p></div>
    </div>
    <Advanced title="Payroll reconciliation"><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Gross wages</TableHead><TableHead>Pre-tax 401(k)</TableHead><TableHead>Federal withholding</TableHead><TableHead>Input status</TableHead></TableRow></TableHeader><TableBody>{result.w2Rows.map((row)=><TableRow key={row.id}><TableCell>{row.label}</TableCell><TableCell>{money(row.gross)}</TableCell><TableCell>{money(row.pretax401k)}</TableCell><TableCell>{money(row.federalWithholding)}</TableCell><TableCell>{row.estimatedFields.length?'Includes estimates':'Entered actuals'}</TableCell></TableRow>)}</TableBody></Table><p className="small muted">The Employer 1 final paycheck is added to its YTD record once. Employer 2 includes regular pay and the bonus. Net bank deposits are reference amounts and are not added again.</p></Advanced>
    <Advanced title="How the federal estimate is calculated"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">2026 dollars</TableHead></TableRow></TableHeader><TableBody>{[
     ['Gross W-2 wages',result.grossW2],['W-2 wages after employee pre-tax 401(k)',result.taxableW2],['Eligible business deductions',result.businessDeductions],['Schedule C net profit',result.scheduleCProfit],['Deduction for half of SE tax',result.halfSeDeduction],['Adjusted gross income',result.agi],['Qualified business income deduction',result.qbiDeduction],['Taxable income after QBI',result.taxableIncome],['Ordinary income tax',result.ordinaryTax],['Qualified dividend / capital gain tax',result.capitalTax],['Self-employment Social Security',result.seSocialSecurity],['Self-employment Medicare',result.seMedicare],['Additional Medicare tax',result.additionalMedicare],['Net investment income tax',result.niit],['Total modeled federal liability',result.federalTotal],['Total withholding and estimated payments',result.totalPayments],
    ].map(([label,value])=><TableRow key={String(label)}><TableCell>{label}</TableCell><TableCell className="text-right">{money(Number(value))}</TableCell></TableRow>)}</TableBody></Table>
    <p className="small muted">The balance is federal liability minus entered payments. Payroll Social Security and Medicare already withheld from regular wages are not added to federal income-tax withholding. A Roth IRA contribution is not a deduction.</p></Advanced>
    {!!result.flags.length&&<div className="notice info" style={{marginTop:20}}><strong>What still needs attention</strong><ul>{result.flags.map((flag:string)=><li key={flag}>{flag}</li>)}</ul></div>}
   </div>
  </section>

  <Panel title="Employer 1" description="Enter year-to-date payroll and any final paycheck.">
   <div className="field-grid">
    {number(['ngYtd','gross'],'YTD gross wages ($)','Confirmed gross through August 28: $59,017.33.')}
    {number(['ngYtd','pretax401k'],'YTD pre-tax 401(k) ($)','Confirmed employee deferrals: $17,027.46.')}
    {number(['ngYtd','federalWithholding'],'YTD federal withholding ($)','Confirmed $9,983.66 includes the extra withholding; do not add it again.')}
   </div>
   <p className="small muted">The supplied YTD taxable wages were $41,989.87. Gross less the supplied pre-tax 401(k) matches that amount.</p>
   <Advanced title="Final paycheck — replace estimates with the paystub">
    <div className="field-grid">
     {uncertain('ngFinal','gross','Final gross pay','Estimate includes remaining wages and PTO. The $3,625.50 net deposit does not establish gross wages.')}
     {uncertain('ngFinal','pretax401k','Final pre-tax 401(k)','The initial $472.54 estimate brings total Employer 1 pre-tax deferrals to approximately $17,500.')}
     {uncertain('ngFinal','federalWithholding','Final federal withholding','Unknown withholding defaults to a zero estimate, not a confirmed zero.')}
     {number(['ngFinal','netPaid'],'Final net deposit reference ($)','Known September 11 bank deposit: $3,625.50. Reference only; not added to taxable wages.')}
    </div>
    <div className="field-grid">
     {number(['ngYtd','roth401k'],'Employer 1 YTD Roth 401(k) ($)','Employee Roth 401(k) uses the combined deferral limit but does not reduce taxable wages.')}
     {number(['ngFinal','roth401k'],'Employer 1 final Roth 401(k) ($)','Enter only employee Roth 401(k) deferrals on the final paycheck.')}
    </div>
   </Advanced>
  </Panel>

  <Panel title="Employer 2" description="Enter salary, paid weeks and employee deferral eligibility. Confirm against payroll records.">
   <div className="field-grid">
    {number(['lockheed','weeklyGross'],'Regular weekly gross pay ($)','Initial estimate: $1,923.08 per weekly paycheck.')}
    {number(['lockheed','regularPaychecks'],'Regular paychecks in 2026','Count whole paychecks actually paid in 2026; adjust average weekly gross for any partial check.',{integer:true,max:53})}
    {number(['lockheed','bonusGross'],'Gross signing bonus ($)','The $6,300 bonus is taxable wages. Do not add its withholding separately if already in a payroll total.')}
    {number(['lockheed','contributionDelayWeeks'],'Paychecks before employee deferrals','Employer-only weeks do not consume the employee contribution limit.',{integer:true,max:53})}
    {number(['lockheed','employee401kPercent'],'Employee 401(k) election','Share of eligible pay contributed before the combined employee limit.',{percent:true,max:1})}
    <Toggle label="Bonus eligible for employee 401(k)" help="Confirm payroll treatment. Off excludes the bonus from the estimated deferral calculation." checked={input.lockheed.bonus401kEligible} onChange={v=>edit(['lockheed','bonus401kEligible'],v)}/>
   </div>
   <Toggle label="Paycheck count and contribution delay confirmed" help="Confirm against 2026 payroll records. Off keeps the pay schedule marked as estimated." checked={input.lockheed.payScheduleConfirmed??false} onChange={v=>edit(['lockheed','payScheduleConfirmed'],v)}/>
   <p className="small muted">Employer 2 pre-tax {input.lockheed.pretax401k===null?'estimate':'actual'}: <strong>{dollars(result.lockheed401kApplied)}</strong>{input.lockheed.pretax401k===null&&result.lockheed401kRequested>result.lockheed401kApplied?` after limiting the ${dollars(result.lockheed401kRequested)} election to remaining employee contribution room.`:'.'} Replace estimates with actual payroll totals when available; payroll systems may not coordinate across employers.</p>
   <Advanced title="Payroll withholding & actual deferral totals">
    <div className="field-grid">
     {uncertain('lockheed','federalWithholding','Employer 2 federal withholding','Use the full 2026 Employer 2 federal income-tax withholding, including bonus withholding.')}
     <div style={{display:'grid',gap:10,alignContent:'start'}}><Toggle label="Employer 2 pre-tax 401(k) actual confirmed" help="Off estimates deferrals and caps them at remaining room across both employers. On uses your actual payroll total, even if it exceeds the limit." checked={input.lockheed.pretax401k!==null} onChange={v=>edit(['lockheed','pretax401k'],v?result.lockheed401kApplied:null)}/>{input.lockheed.pretax401k!==null&&number(['lockheed','pretax401k'],'Employer 2 actual pre-tax 401(k) ($)','Full-year Employer 2 employee pre-tax deferrals.')}</div>
     {number(['lockheed','roth401k'],'Employer 2 Roth 401(k) ($)','Employee Roth deferrals count toward the same limit; employer contributions do not.')}
    </div>
   </Advanced>
  </Panel>

  <Panel title="One-time business income" description="The 2026 side business stops after this year. Only eligible, documented business expenses reduce this worksheet’s Schedule C profit.">
   <div className="field-grid">{number(['business','grossReceipts'],'Gross business receipts ($)','Enter gross business revenue before expenses.')}</div>
   <div className="notice info">Enter the allowable expense before business-use allocation, its business-use share and eligibility. Unconfirmed or excluded expenses do not reduce the estimate. Personal portions and unsupported deductions stay out.</div>
   <div style={{display:'grid',gap:12,marginTop:20}}>{input.business.deductions.map((deduction,i)=><details key={deduction.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'6px 18px',marginTop:0}}>
    <summary style={{fontSize:16}}>{deduction.label} <span className="muted" style={{fontSize:14,fontWeight:400}}> · {deduction.included&&deduction.eligibility==='eligible'?`${dollars(deduction.amount*deduction.businessUse)} included`:'Not included'}</span></summary><div className="field-grid">
     {number(['business','deductions',i,'amount'],'Allowable expense amount ($)','Eligible 2026 expense before business-use allocation; verify depreciation, home-office or education rules first.')}
     {number(['business','deductions',i,'businessUse'],'Business use','Document the share attributable to this business.',{percent:true,max:1})}
     <Choice label="Deduction eligibility" help="Confirm the expense’s eligibility and documentation before including it." value={deduction.eligibility} onChange={v=>edit(['business','deductions',i,'eligibility'],v)} options={ [['unconfirmed','Not yet confirmed'],['eligible','Confirmed eligible'],['ineligible','Not eligible']] }/>
     <Toggle label="Include in this estimate" help="Only included and confirmed-eligible expenses are deducted." checked={deduction.included} onChange={v=>edit(['business','deductions',i,'included'],v)}/>
    </div>
   </details>)}</div>
   <Advanced title="Compare deduction impact"><p className="small muted">Each row shows the effect of that expense while keeping other currently included eligible deductions in place. Savings are not additive. Changing business profit can also change QBI, self-employment tax and Roth eligibility. These comparisons do not establish that an expense qualifies.</p>
    <Table><TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Deduction</TableHead><TableHead>Federal tax saved</TableHead><TableHead>MAGI</TableHead><TableHead>Due / refund</TableHead></TableRow></TableHeader><TableBody>{result.scenarioImpacts.map((scenario)=><TableRow key={scenario.id}><TableCell>{scenario.label}</TableCell><TableCell>{dollars(scenario.deduction)}</TableCell><TableCell>{dollars(scenario.taxSaving)}</TableCell><TableCell>{dollars(scenario.magi)}</TableCell><TableCell>{scenario.refund>0?`${dollars(scenario.refund)} refund`:`${dollars(scenario.balanceDue)} due`}</TableCell></TableRow>)}</TableBody></Table>
   </Advanced>
   <Advanced title="Qualified business income assumptions">
    <Toggle label="Business / QBI classification verified" help="Confirm the business classification, eligibility and any required limitations. Off keeps the tax result provisional." checked={input.business.qbiConfirmed??false} onChange={v=>edit(['business','qbiConfirmed'],v)}/>
    <Toggle label="Business qualifies for QBI treatment" help="Confirm that the activity is a qualified trade or business. Wage income is not QBI." checked={input.business.qbiEligible} onChange={v=>edit(['business','qbiEligible'],v)}/>
    <Toggle label="Materially participate in this business" help="Participation affects the modeled minimum QBI deduction; confirm the activity meets the applicable rules." checked={input.business.materiallyParticipates??true} onChange={v=>edit(['business','materiallyParticipates'],v)}/>
    <Toggle label="Specified service trade or business" help="SSTB restrictions can apply at higher taxable incomes." checked={input.business.sstb} onChange={v=>edit(['business','sstb'],v)}/>
    <div className="field-grid">
     {number(['business','w2Wages'],'Business W-2 wages paid ($)','Wages paid by your business to employees; exclude your Employer 1 and Employer 2 wages.')}
     {number(['business','qualifiedPropertyBasis'],'Qualified business property basis ($)','Unadjusted basis of eligible business property used for QBI limitations.')}
     {number(['business','priorQbiLoss'],'Prior-year QBI loss carryforward ($)','Enter a positive amount for a loss carried into 2026.')}
    </div>
   </Advanced>
  </Panel>

  <Panel title="Investments & above-the-line adjustments" description="Use tax statements for dividends, realized gains and qualifying adjustments.">
   <Toggle label="Investment income confirmed" help="Zero inputs remain unverified until your 1099 statements or reliable year-end records confirm them." checked={input.investment.confirmed} onChange={v=>edit(['investment','confirmed'],v)}/>
   <div className="field-grid">
    {number(['investment','interest'],'Taxable interest ($)','Bank and other taxable interest received in 2026.')}
    {number(['investment','ordinaryDividends'],'Nonqualified dividends ($)','Nonqualified portion only: Form 1099-DIV box 1a minus box 1b. Exclude qualified dividends entered separately.')}
    {number(['investment','qualifiedDividends'],'Qualified dividends ($)','Qualified dividends from Form 1099-DIV box 1b; not included in the nonqualified field.')}
    {number(['investment','shortTermGains'],'Net short-term realized gains ($)','Short-term investment result; negative values represent net losses.',{min:-10000000})}
    {number(['investment','longTermGains'],'Net long-term realized gains ($)','Long-term investment result; negative values represent net losses.',{min:-10000000})}
   </div>
   <Advanced title="Other deductions and adjustments"><div className="field-grid">
    {number(['adjustments','selfEmployedHealthInsurance'],'Eligible self-employed health insurance ($)','Above-the-line deduction only when eligible; do not duplicate a Schedule C expense.')}
    {number(['adjustments','selfEmployedRetirement'],'Deductible self-employed retirement ($)','Verified deductible employer/self-employed amount, not Employer 1 or Employer 2 employee deferrals.')}
    {number(['adjustments','traditionalIra'],'Deductible traditional IRA ($)','Verified deductible IRA amount; not necessarily the full amount contributed.')}
    {number(['adjustments','other'],'Other eligible adjustments ($)','Verified adjustments not already included elsewhere.')}
   </div></Advanced>
  </Panel>

  <Panel title="Payments & IRA contributions" description="Payments reduce the balance due; IRA eligibility follows the income calculation."><div className="field-grid">
   {number(['payments','estimated'],'2026 estimated tax paid ($)','The $20,000 IRS Direct Pay amount, assuming applied to 2026. Count each payment once.')}
   {number(['payments','otherWithholding'],'Other federal withholding ($)','Withholding outside Employer 1 and Employer 2 payroll, such as a 1099. Exclude all amounts entered above.')}
   {number(['roth','contributed'],'2026 Roth IRA contributed ($)','Actual contribution reported: $7,500. Compare with the eligible limit below.')}
   {number(['roth','traditionalContributed'],'2026 traditional IRA contributed ($)','All traditional IRA contributions share the annual IRA contribution limit, deductible or not.')}
  </div></Panel>

  <section className="panel"><h3>Rules & scope</h3><p className="small muted">Rules checked {TAX_YEAR_RULES_DATE}. This is a federal planning estimate for a single filer, not a filed return. Final paystubs, investment statements and business eligibility determine the final result. State taxes, penalties and unmodeled credits are outside this worksheet.</p><ul className="small">{TAX_YEAR_SOURCES.map(([label,url]:string[])=><li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>)}</ul></section>
 </div>;
}
