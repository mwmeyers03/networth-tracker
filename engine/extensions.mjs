import {calculateSepp} from '../packages/engine/runtime/bridge/sepp.js';
import {validateTaxYear} from './tax-year.mjs';
export function validateExtensions(plan){
 const errors=[],bad=message=>errors.push(message),finite=(n,min=0,max=1e12)=>Number.isFinite(n)&&n>=min&&n<=max,year=y=>Number.isInteger(y)&&y>=1900&&y<=2300;
 if(plan.taxYear2026!==undefined)errors.push(...validateTaxYear(plan.taxYear2026));
 if(plan.cashReserveWorking!==undefined&&!finite(plan.cashReserveWorking))bad('Invalid employed cash reserve.');
 const w=plan.withdrawalPolicy;
 if(w!==undefined&&(!w||typeof w.allowPenalties!=='boolean'||!['taxable_first','roth_first','pretax_first'].includes(w.order)||w.earlyPreference!==undefined&&!['conversion_first','traditional_first','roth_first'].includes(w.earlyPreference)))bad('Invalid withdrawal policy.');
 const budget=plan.retirementBudget;
 if(budget!==undefined){
  if(!budget||typeof budget!=='object'||Array.isArray(budget)||typeof budget.enabled!=='boolean'||!finite(budget.annual)||!finite(budget.minimumLiving)||!['real','nominal'].includes(budget.dollarMode)||!['included','additional'].includes(budget.taxes)||!['included','additional'].includes(budget.healthcare))bad('Invalid retirement budget: specify amount, dollar year, tax/health treatment and minimum living costs.');
 }
 for(const note of Array.isArray(plan.assumptions)?plan.assumptions:[]){if(!note)continue;if(note.status!==undefined&&!['confirmed','estimate','missing'].includes(note.status))bad('Invalid assumption status.');if(note.source!==undefined&&(typeof note.source!=='string'||note.source.length>500))bad('Invalid assumption source.');if(note.reviewDate!==undefined&&(typeof note.reviewDate!=='string'||note.reviewDate.length>10))bad('Invalid review date.');}
 for(const expense of Array.isArray(plan.expenses)?plan.expenses:[])if(expense?.phase!==undefined&&!['calendar','working','retirement'].includes(expense.phase))bad('Invalid expense phase.');
 for(const person of Array.isArray(plan.people)?plan.people:[]){
  if(!person||typeof person!=='object')continue;
  if(person.sepp!==undefined){const c=person.sepp;if(!c||typeof c.enabled!=='boolean')bad('Invalid SEPP configuration.');else if(c.enabled){try{const ss=calculateSepp(c.input);if(!ss.eligibleForModel)bad(ss.reviewIssues.join(' '));if(c.input.birthDate!==person.birthDate)bad('SEPP must use the person birth date.');if(!c.input.startDate.endsWith('-01-01'))bad('Annual SEPP projection currently supports January1 commencements only.');if(ss.startYear<plan.startYear)bad('Existing SEPP schedules require opening segregated balances and are not supported by this forward model.');const source=Array.isArray(person.pretaxSources)?person.pretaxSources.find(s=>s?.id===c.input.accountId):null;if(source&&(!source.verified||(c.input.accountType==='traditional_ira')!==(source.kind==='traditional_ira')))bad('SEPP source ID must identify a verified account of the configured type.');if(c.input.accountType==='employer_plan'&&ss.startYear<person.retireYear&&!(source?.kind==='former_employer'&&source.verified))bad('Employer-plan SEPP requires modeled separation or a verified former-employer source before commencement.');if(c.stopYear!==undefined&&(!year(c.stopYear)||c.stopYear<=Number(ss.commitmentEndDate.slice(0,4))))bad('SEPP stop year must follow the exact commitment-end calendar year.');if(c.input.method==='rmd'){for(let y=ss.startYear;y<=Math.min(plan.endYear,(c.stopYear??Number(ss.commitmentEndDate.slice(0,4))+1)-1);y++)if(!finite(c.input.factorTable.factors[y-person.birthYear],.01,200))bad('SEPP RMD requires a reviewed factor for every payment year.');}}catch(e){bad(e.message);}}}
  if(person.hsaBalance!==undefined&&!finite(person.hsaBalance))bad('Invalid HSA balance.');
  if(person.hsaQualifiedExpensesAnnual!==undefined&&!finite(person.hsaQualifiedExpensesAnnual))bad('Invalid qualified medical reimbursement.');
  if(person.hsa!==undefined){const h=person.hsa;if(!h||typeof h.eligible!=='boolean'||typeof h.verified!=='boolean'||typeof h.payroll!=='boolean'||!['individual','family'].includes(h.coverage)||!Number.isInteger(h.eligibleMonths)||!finite(h.eligibleMonths,0,12)||!finite(h.employeeAnnual)||!finite(h.employerAnnual))bad('Invalid HSA election.');}
  if(person.hsa&&typeof person.hsa==='object'){
   const h=person.hsa;
   if(h.timingMode!==undefined||h.eligibleMonthNumbers!==undefined)bad('Monthly HSA timing must be entered as an explicit year override, not a global verified-timing flag.');
   if(h.yearOverrides!==undefined){
    const rows=h.yearOverrides;
    if(!Array.isArray(rows)||rows.length>100||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)||!year(r.year)||typeof r.verified!=='boolean'||typeof r.payroll!=='boolean'||!Number.isInteger(r.eligibleMonths)||!finite(r.eligibleMonths,0,12)||!finite(r.employeeAnnual)||!finite(r.employerAnnual)||r.eligible!==undefined&&typeof r.eligible!=='boolean'||r.coverage!==undefined&&!['individual','family'].includes(r.coverage)||r.eligibleMonthNumbers!==undefined&&(!Array.isArray(r.eligibleMonthNumbers)||r.eligibleMonthNumbers.length!==r.eligibleMonths||new Set(r.eligibleMonthNumbers).size!==r.eligibleMonthNumbers.length||r.eligibleMonthNumbers.some(m=>!Number.isInteger(m)||m<1||m>12))))bad('Invalid HSA year override: specify year, verified eligibility, nominal elections and eligible months; exact month numbers must match the count.');
    else if(new Set(rows.map(r=>r.year)).size!==rows.length)bad('HSA override years must be unique per person.');
   }
  }
  if(person.rothMode!==undefined&&!['direct','backdoor'].includes(person.rothMode))bad('Invalid Roth contribution mode.');
  if(person.rothMode==='backdoor'){const b=person.backdoor;if(!b||b.verified!==true||!finite(b.pretaxIraBalance)||!finite(b.aftertaxIraBasis))bad('Backdoor requires verified year-end IRA balances and basis.');else if(b.pretaxIraBalance>0||b.aftertaxIraBasis>0)bad('Forward backdoor modeling currently requires zero existing traditional/SEP/SIMPLE IRA balances and basis; use the tax sandbox for pro-rata estimates.');if((person.pretaxEarlyAccess==='ira'&&person.traditional>0)||(Array.isArray(person.pretaxSources)&&person.pretaxSources.some(s=>s?.kind==='traditional_ira'&&s.openingBalance>0)))bad('Backdoor zero-IRA verification contradicts the opening traditional IRA assets. Positive existing IRA balances require unsupported multi-year pro-rata modeling; use the tax sandbox.');}
  if(person.megaBackdoor!==undefined){const m=person.megaBackdoor;if(!m||typeof m.enabled!=='boolean'||typeof m.verified!=='boolean'||typeof m.afterTaxAllowed!=='boolean'||typeof m.rothIraRolloverAllowed!=='boolean'||!finite(m.annual))bad('Invalid mega-backdoor election.');else if(m.enabled&&(!m.verified||!m.afterTaxAllowed||!m.rothIraRolloverAllowed))bad('Mega-backdoor requires verified after-tax contributions and immediate Roth IRA rollover support.');}
  if(person.savingsAnnual!==undefined&&!finite(person.savingsAnnual))bad('Invalid annual total savings target.');
  if(person.salaryGrowthUnit!==undefined&&!['real','nominal'].includes(person.salaryGrowthUnit))bad('Salary growth units must be real or nominal.');
  for(const k of ['brokerageReturnDrag','retirementBrokerageReturnDrag'])if(person[k]!==undefined&&!finite(person[k],0,.5))bad('Invalid taxable return drag.');
  if(person.brokerageTaxTreatment!==undefined&&!['embedded','explicit'].includes(person.brokerageTaxTreatment))bad('Invalid recurring investment tax treatment.');
  if(person.cashNominalReturn!==undefined&&!finite(person.cashNominalReturn,-.99,1))bad('Invalid nominal cash return.');
  if(person.birthDate!==undefined&&person.birthDate!==''){
   const date=typeof person.birthDate==='string'?new Date(person.birthDate+'T00:00:00Z'):new Date(NaN);
   const valid=/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===person.birthDate;
   if(!valid||Number(person.birthDate.slice(0,4))!==person.birthYear)bad('Birth date must be valid and match birth year.');
  }
  if(person.pretaxEarlyAccess!==undefined&&!['ira','after_separation','unavailable'].includes(person.pretaxEarlyAccess))bad('Invalid pretax distribution access.');
  if(person.penaltyException!==undefined&&typeof person.penaltyException!=='boolean')bad('Invalid early-distribution exception.');
  if(person.penaltyException===true)bad('The legacy blanket penalty exception is unsupported: replace it with reviewed, account-specific exceptions. It cannot exempt Roth withdrawals merely because an employer plan qualifies.');
  if(person.penaltyExceptions!==undefined){const x=person.penaltyExceptions;if(!x||typeof x!=='object'||Array.isArray(x)||Object.entries(x).some(([k,v])=>!['traditionalDisabilityVerified','rothDisabilityVerified','currentPlanRule55Verified'].includes(k)||typeof v!=='boolean'))bad('Invalid account-specific penalty exception.');else if(x.currentPlanRule55Verified&&(person.pretaxEarlyAccess==='ira'||person.retireYear<person.birthYear+55))bad('Current-plan Rule55 requires separation in or after the calendar year turning55, and does not apply to an IRA.');}
  if(person.pretaxSources!==undefined){
   const sources=person.pretaxSources;
   if(!Array.isArray(sources)||sources.length>20||sources.some(s=>!s||typeof s!=='object'||typeof s.id!=='string'||!s.id.trim()||s.id.length>100||!['traditional_ira','former_employer'].includes(s.kind)||!finite(s.openingBalance)||typeof s.verified!=='boolean'||s.kind==='former_employer'&&(!year(s.separationYear)||s.separationYear>plan.startYear)||s.rule55Verified!==undefined&&typeof s.rule55Verified!=='boolean'))bad('Invalid opening pretax source: specify an ID, balance, verified access and former-plan separation year no later than projection start.');
   else{
    if(new Set(sources.map(s=>s.id)).size!==sources.length)bad('Pretax source IDs must be unique per person.');
    if(sources.reduce((v,s)=>v+s.openingBalance,0)>person.traditional-person.unvested+.00001)bad('Opening pretax sources must fit inside vested traditional assets; they do not add new assets.');
    if(sources.some(s=>s.rule55Verified&&(s.kind!=='former_employer'||s.separationYear<person.birthYear+55||!s.verified)))bad('Source Rule55 requires verified employer-plan access and separation in or after the calendar year turning55. IRA sources cannot use Rule55.');
   }
  }
  for(const key of ['rothBasisDocumented','spousalIRA'])if(person[key]!==undefined&&typeof person[key]!=='boolean')bad(`Invalid ${key}.`);
  for(const [key,check] of [['promotions',x=>year(x.year)&&(finite(x.salary)||finite(x.percent,-.99,1))],['careerBreaks',x=>year(x.start)&&year(x.end)&&x.end>=x.start&&finite(x.payFraction,0,1)],['rothConversionLots',x=>year(x.year)&&x.year<plan.startYear&&finite(x.amount)&&typeof x.documented==='boolean']]){
   if(person[key]!==undefined&&(!Array.isArray(person[key])||person[key].length>100||person[key].some(x=>!x||typeof x!=='object'||!check(x))))bad(`Invalid ${key}; conversion amounts mean remaining principal, not original amount.`);
  }
  if(Array.isArray(person.rothConversionLots)&&person.rothConversionLots.some(l=>l&&l.taxableAmount!==undefined&&(!finite(l.taxableAmount)||l.taxableAmount>l.amount)))bad('Conversion taxable principal must be between0andremaining principal.');
  if(Array.isArray(person.promotions)&&new Set(person.promotions.map(x=>x?.year)).size!==person.promotions.length)bad('Only one promotion per person per year.');
 }
 const health=plan.healthcare;
 if(health!==undefined){
  if(!health||typeof health!=='object'||Array.isArray(health))bad('Invalid healthcare configuration.');
  else{
   if(typeof health.enabled!=='boolean')bad('Healthcare enable setting must be boolean.');
   for(const key of ['premiumGrowth','fplGrowth','medicareGrowth'])if(!finite(health[key],0,1))bad(`Invalid healthcare ${key}.`);
   if(!Array.isArray(health.replacedExpenseIds)||health.replacedExpenseIds.some(id=>!(Array.isArray(plan.expenses)&&plan.expenses.some(e=>e?.id===id))))bad('Select existing expenses to replace with healthcare costs.');
   if(!Array.isArray(health.people)||health.people.length!==2)bad('Healthcare requires both people.');
   else health.people.forEach((p,i)=>{
    if(!p||p.id!==plan.people?.[i]?.id){bad('Invalid healthcare person.');return;}
    if(!['employer','marketplace'].includes(p.parentType)||!['unknown','eligible','ineligible'].includes(p.eligibility))bad('Invalid coverage or ACA eligibility setting.');
    for(const key of ['parentAnnual','employerAnnual','marketplaceMonthly','benchmarkMonthly','outOfPocketAnnual','partDMonthly','supplementMonthly','partAMonthly'])if(!finite(p[key]))bad(`Invalid healthcare ${key}.`);
    if(!Array.isArray(p.coverageOverrides)||p.coverageOverrides.length>100)bad('Invalid coverage override list.');
    else{
     const seen=new Set();
     for(const override of p.coverageOverrides){
      if(!override||!year(override.year)||seen.has(override.year)||!override.months||typeof override.months!=='object'||Array.isArray(override.months)){bad('Coverage overrides need unique years and month counts.');continue;}
      seen.add(override.year);const values=Object.entries(override.months);
      if(values.some(([kind,n])=>!['parent','employer','marketplace','medicare','uninsured'].includes(kind)||!Number.isInteger(n)||!finite(n,0,12))||values.reduce((v,[,n])=>v+n,0)>12)bad('Coverage months must be whole numbers totaling at most 12.');
     }
    }
   });
   if(health.lookback!==undefined){
    if(!health.lookback||typeof health.lookback!=='object'||Array.isArray(health.lookback))bad('Invalid IRMAA lookback.');
    else for(const [y,v] of Object.entries(health.lookback))if(!/^\d{4}$/.test(y)||!v||!finite(v.magi)||typeof v.joint!=='boolean'||!Array.isArray(v.byPerson)||v.byPerson.length!==2||v.byPerson.some(n=>!finite(n)))bad('IRMAA lookback needs household and individual income and filing status.');
   }
  }
 }
 return errors;
}
