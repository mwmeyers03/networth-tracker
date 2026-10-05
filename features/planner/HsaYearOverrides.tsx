'use client';
import {useId,useState,type CSSProperties} from 'react';
import type {HsaElection,HsaYearOverride} from '../../packages/engine/runtime/cashflow/advantaged.js';

type Props={
 election:HsaElection|undefined;
 startYear:number;
 endYear:number;
 onChange:(rows:HsaYearOverride[])=>void;
 personName?:string;
};
const muted:CSSProperties={fontSize:14,lineHeight:1.5,color:'var(--muted-foreground, #64748b)'};
const inputStyle:CSSProperties={width:'100%',minHeight:44,padding:'9px 12px',fontSize:16,border:'1px solid var(--border, #cbd5e1)',borderRadius:8,background:'var(--background, #fff)',color:'inherit'};
const buttonStyle:CSSProperties={minHeight:44,padding:'9px 14px',fontSize:14,border:'1px solid var(--border, #cbd5e1)',borderRadius:8,background:'var(--background, #fff)',color:'inherit',cursor:'pointer'};
const grid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',gap:18};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const money=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(amount);

type NumberProps={label:string;help:string;name:string;value:number;min:number;max:number;integer?:boolean;validate?:(value:number)=>string|undefined;onChange:(value:number)=>void};
function NumberInput(props:NumberProps){return <NumberDraft key={props.value} {...props}/>;}
function NumberDraft({label,help,name,value,min,max,integer=false,validate,onChange}:NumberProps){
 const id=useId(),[draft,setDraft]=useState(String(value)),[error,setError]=useState('');
 function commit(){
  if(!draft.trim()){setDraft(String(value));setError('');return;}
  const next=Number(draft);
  const problem=!Number.isFinite(next)||(integer&&!Number.isInteger(next))||next<min||next>max
   ?`Enter ${integer?'a whole number':'an amount'} between ${min} and ${max}.`:validate?.(next);
  if(problem){setError(problem);return;}
  setError('');onChange(next);setDraft(String(next));
 }
 return <div style={{display:'grid',gap:7,alignContent:'start'}}>
  <label htmlFor={id} style={{fontSize:14,fontWeight:500}}>{label}</label>
  <input id={id} aria-label={name} type="text" inputMode={integer?'numeric':'decimal'} value={draft} style={inputStyle}
   aria-describedby={`${id}-help${error?` ${id}-error`:''}`} aria-invalid={!!error}
   onChange={event=>{setDraft(event.target.value);setError('');}} onBlur={commit}
   onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){setDraft(String(value));setError('');}}}/>
  <span id={`${id}-help`} style={muted}>{help}</span>
  {error&&<span id={`${id}-error`} role="alert" style={{...muted,color:'var(--destructive, #be123c)'}}>{error}</span>}
 </div>;
}
function Checkbox({label,help,name,checked,onChange}:{label:string;help:string;name:string;checked:boolean;onChange:(checked:boolean)=>void}){
 const id=useId();
 return <div style={{display:'grid',gap:4}}>
  <label htmlFor={id} style={{display:'flex',alignItems:'center',gap:10,minHeight:44,cursor:'pointer',fontSize:14,fontWeight:500}}>
   <input id={id} type="checkbox" checked={checked} aria-label={name} aria-describedby={`${id}-help`} onChange={event=>onChange(event.target.checked)} style={{width:20,height:20,flexShrink:0,accentColor:'var(--primary, #0f766e)'}}/>{label}
  </label><span id={`${id}-help`} style={muted}>{help}</span>
 </div>;
}
function Coverage({value,onChange,name}:{value:'individual'|'family';onChange:(value:'individual'|'family')=>void;name:string}){
 const id=useId();
 return <div style={{display:'grid',gap:7,alignContent:'start'}}><label htmlFor={id} style={{fontSize:14,fontWeight:500}}>Coverage tier</label>
  <select id={id} aria-label={name} value={value} onChange={event=>onChange(event.target.value as 'individual'|'family')} style={inputStyle} aria-describedby={`${id}-help`}>
   <option value="individual">Self-only coverage</option><option value="family">Family coverage</option>
  </select><span id={`${id}-help`} style={muted}>Married spouses share the family base limit. Each age-55 catchup belongs in that person’s own HSA.</span>
 </div>;
}

export default function HsaYearOverrides({election,startYear,endYear,onChange,personName='This person'}:Props){
 const rows=election?.yearOverrides??[],used=new Set(rows.map(row=>row.year));
 let nextYear:number|undefined;
 for(let year=Math.ceil(startYear);year<=endYear;year++){if(!used.has(year)){nextYear=year;break;}}
 const canAdd=rows.length<100&&nextYear!==undefined;
 function update(index:number,patch:Partial<HsaYearOverride>,recheck=false){
  onChange(rows.map((row,i)=>i===index?{...row,...patch,...(recheck?{verified:false}:{})}:row));
 }
 function add(){
  if(!canAdd||nextYear===undefined)return;
  onChange([...rows,{year:nextYear,eligible:false,verified:false,coverage:election?.coverage??'individual',eligibleMonths:0,employeeAnnual:0,employerAnnual:0,payroll:false}]);
 }
 return <details open={rows.length>0} style={{borderTop:'1px solid var(--border, #e2e8f0)',marginTop:20,paddingTop:12}}>
  <summary style={{cursor:'pointer',fontSize:14,fontWeight:600,minHeight:44,paddingBlock:10}}>Year-specific HSA contributions{rows.length?` · ${rows.length} ${rows.length===1?'year':'years'}`:''}</summary>
  <div style={{display:'grid',gap:16,paddingTop:12}}>
   <p style={{...muted,margin:0}}>Set a separate election for a career break, retirement or the year Medicare begins. Each row applies only to its calendar year and uses that year’s actual dollars. Other years keep your recurring election. Adding a row does not confirm eligibility.</p>
   {rows.map((row,index)=>{
    const context=`${personName} ${row.year} HSA`,eligible=row.eligible??election?.eligible??false;
    const selected=row.eligibleMonthNumbers??(row.eligibleMonths===12?MONTHS.map((_,month)=>month+1):[]);
    const name=(label:string)=>`${context} ${label}`;
    return <details key={index} style={{border:'1px solid var(--border, #e2e8f0)',borderRadius:10,padding:'4px 16px'}}>
     <summary style={{cursor:'pointer',minHeight:44,paddingBlock:12,fontSize:14,lineHeight:1.6}}>
      <strong>{row.year}</strong> · {row.verified&&eligible?'Eligibility confirmed':'Confirmation needed'} · {row.eligibleMonths} eligible {row.eligibleMonths===1?'month':'months'} · {money(row.employeeAnnual)} personal
     </summary>
     <div style={{display:'grid',gap:20,paddingBlock:'10px 16px'}}>
      {(row.year<startYear||row.year>endYear)&&<p style={{...muted,margin:0}}>This saved row is outside the current forecast. It is preserved and does not affect years inside the forecast.</p>}
      <div style={grid}>
       <NumberInput label="Calendar year" name={name('calendar year')} help="One election per person per calendar year." value={row.year} min={startYear} max={endYear} integer validate={year=>rows.some((other,i)=>i!==index&&other.year===year)?'An HSA election already exists for this year. Choose an unused year.':undefined} onChange={year=>update(index,{year},true)}/>
       <Coverage name={name('coverage tier')} value={row.coverage??election?.coverage??'individual'} onChange={coverage=>update(index,{coverage},true)}/>
       <NumberInput label="Personal contribution ($)" name={name('personal contribution dollars')} help="Nominal dollars for this year. Payroll uses wages; direct contributions use available household cash. Statutory and funding limits still apply." value={row.employeeAnnual} min={0} max={1000000000} onChange={employeeAnnual=>update(index,{employeeAnnual})}/>
       <NumberInput label="Employer contribution ($)" name={name('employer contribution dollars')} help="Confirmed or planned nominal amount for this year. Employer contributions consume the same annual HSA limit." value={row.employerAnnual} min={0} max={1000000000} onChange={employerAnnual=>update(index,{employerAnnual})}/>
       <NumberInput label="Eligible months" name={name('eligible months')} help="Count months eligible on their first day. Exclude Medicare months, including retroactive coverage. Editing the count clears exact dates and confirmation." value={row.eligibleMonths} min={0} max={12} integer onChange={eligibleMonths=>update(index,{eligibleMonths,eligibleMonthNumbers:undefined},true)}/>
      </div>
      <div style={grid}>
       <Checkbox label="Eligible in this year" name={name('eligible in this year')} help="HSA eligibility can continue without employment, but qualifying coverage and other legal conditions are still required." checked={eligible} onChange={value=>update(index,{eligible:value},true)}/>
       <Checkbox label="Contribute through payroll" name={name('contribute through payroll')} help="Use only for actual eligible cafeteria-plan payroll contributions. Off models a personal cash contribution and income-tax deduction, with no FICA reduction." checked={row.payroll} onChange={payroll=>update(index,{payroll})}/>
      </div>
      <details style={{borderTop:'1px solid var(--border, #e2e8f0)',paddingTop:10}}>
       <summary style={{cursor:'pointer',minHeight:44,paddingBlock:10,fontSize:14,fontWeight:500}}>Choose exact months (optional)</summary>
       <p style={muted}>Use eligible months on the first day of each month. Selecting months replaces the count above. Exact dates improve family-limit allocation when spouses’ eligibility differs. The planner does not assume the last-month rule.</p>
       <fieldset style={{border:0,padding:0,margin:0}}>
        <legend style={{fontSize:14,fontWeight:500,marginBottom:8}}>{personName} · {row.year} eligible months</legend>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:6}}>{MONTHS.map((month,m)=>
         <label key={month} style={{display:'flex',alignItems:'center',gap:9,minHeight:44,padding:'4px 8px',fontSize:14,cursor:'pointer'}}>
          <input type="checkbox" aria-label={name(`${month} eligibility`)} checked={selected.includes(m+1)} style={{width:20,height:20,accentColor:'var(--primary, #0f766e)'}}
           onChange={event=>{const months=event.target.checked?[...selected,m+1].sort((a,b)=>a-b):selected.filter(value=>value!==m+1);update(index,{eligibleMonthNumbers:months,eligibleMonths:months.length},true);}}/>{month}
         </label>)}</div>
       </fieldset>
       <p style={muted}>{row.eligibleMonthNumbers===undefined?`${row.eligibleMonths} months entered; ${row.eligibleMonths===12?'all calendar months are included.':'specific month dates are unspecified.'}`:`${row.eligibleMonthNumbers.length} exact months selected.`}</p>
       {row.eligibleMonthNumbers!==undefined&&<button type="button" style={buttonStyle} aria-label={name('use month count only')} onClick={()=>update(index,{eligibleMonthNumbers:undefined},true)}>Use month count only</button>}
      </details>
      <Checkbox label="Eligibility and month timing verified" name={name('eligibility and month timing verified')} help="Confirm qualifying HDHP coverage on each counted month’s first day; no disqualifying coverage (including a general-purpose FSA); no Medicare including retroactive enrollment; and not claimable as someone else’s dependent. Changing the year, coverage or eligible months requires confirmation again." checked={row.verified} onChange={verified=>update(index,{verified})}/>
      {!row.verified&&<p style={{...muted,margin:0}}>This year’s contributions stay disabled until you confirm eligibility. Employer and personal requests may be capped; a requested amount does not establish eligibility or available cash.</p>}
      <button type="button" style={{...buttonStyle,justifySelf:'start'}} aria-label={name('remove year election')} onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>Remove {row.year} election</button>
     </div>
    </details>;
   })}
   <div style={{display:'grid',gap:8,justifyItems:'start'}}>
    <button type="button" style={{...buttonStyle,opacity:canAdd?1:.6,cursor:canAdd?'pointer':'default'}} disabled={!canAdd} aria-label={`${personName} add HSA year election`} onClick={add}>Add HSA year</button>
    {!canAdd&&<span style={muted}>{rows.length>=100?'The maximum is 100 year elections.':'Every year in the current forecast already has an election.'}</span>}
   </div>
   <p style={{...muted,margin:0}}>IRS rules checked October 3, 2026: <a href="https://www.irs.gov/irb/2025-21_IRB" target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>2026 limits</a> · <a href="https://www.irs.gov/publications/p969" target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>eligibility and monthly limits (Publication 969, 2025 edition)</a> · <a href="https://www.irs.gov/publications/p15b" target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>payroll treatment (Publication 15-B, 2026)</a>. Future base limits use the forecast’s tax inflation assumption; the age-55 catchup stays $1,000.</p>
  </div>
 </details>;
}
