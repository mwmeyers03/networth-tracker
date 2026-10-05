import {RULES_2026} from '../taxes/limits.js';
export interface HsaYearOverride {
 year:number;
 verified:boolean;
 eligibleMonths:number;
 /** Actual nominal election for this calendar year, not a base-year amount. */
 employeeAnnual:number;
 employerAnnual:number;
 payroll:boolean;
 eligible?:boolean;
 coverage?:'individual'|'family';
 /** First-day-of-month eligibility, excluding Medicare (including backdating). */
 eligibleMonthNumbers?:number[];
}
export interface HsaElection {
 eligible:boolean;coverage:'individual'|'family';eligibleMonths:number;
 employeeAnnual:number;employerAnnual:number;payroll:boolean;verified:boolean;
 yearOverrides?:HsaYearOverride[];
 /** Resolver-only marker: do not infer verification from a date or healthcare plan. */
 timingMode?:'verified_year';
 eligibleMonthNumbers?:number[];
}
export interface HsaContributions {
 employee:number[];employer:number[];payrollExcluded:number[];
 /** Personal contributions deductible on Schedule 1; payroll is already excluded. */
 direct:number[];deductible:number[];
 limit:number[];employeeCapped:number[];employerCapped:number[];
 eligibleMonths:number[];sharedBaseLimit:number|null;reviewFlags:string[];
}

/** Resolve only an explicitly entered year; do not repeat it into later years. */
export function resolveHsaElection(election:HsaElection|undefined,year:number):HsaElection|undefined {
 if(!election)return undefined;
 if(!Number.isInteger(year))throw Error('HSA election year must be an integer.');
 const rows=election.yearOverrides?.filter(row=>row.year===year)??[];
 if(rows.length>1)throw Error('HSA election years must be unique.');
 if(!rows.length)return election;
 const row=rows[0];
 validateYearElection(row);
 return {...election,eligible:row.eligible??election.eligible,coverage:row.coverage??election.coverage,
  verified:row.verified,eligibleMonths:row.eligibleMonths,employeeAnnual:row.employeeAnnual,
  employerAnnual:row.employerAnnual,payroll:row.payroll,eligibleMonthNumbers:row.eligibleMonthNumbers?.slice(),
  timingMode:'verified_year'};
}

function validateYearElection(e:{eligibleMonths:number;employeeAnnual:number;employerAnnual:number;eligibleMonthNumbers?:number[]}) {
 if(!Number.isInteger(e.eligibleMonths)||e.eligibleMonths<0||e.eligibleMonths>12)throw Error('HSA eligible months must be an integer from 0 to 12.');
 if(![e.employeeAnnual,e.employerAnnual].every(value=>Number.isFinite(value)&&value>=0))throw Error('HSA contribution elections must be finite nonnegative amounts.');
 if(e.eligibleMonthNumbers!==undefined&&(
  e.eligibleMonthNumbers.length!==e.eligibleMonths||
  new Set(e.eligibleMonthNumbers).size!==e.eligibleMonthNumbers.length||
  e.eligibleMonthNumbers.some(month=>!Number.isInteger(month)||month<1||month>12)
 ))throw Error('HSA month numbers must be unique months 1–12 matching the eligible-month count.');
}

function emptyHsaResult(ages:number[]):HsaContributions {
 const zero=()=>ages.map(()=>0);
 return {employee:zero(),employer:zero(),payrollExcluded:zero(),direct:zero(),deductible:zero(),
  limit:zero(),employeeCapped:zero(),employerCapped:zero(),eligibleMonths:zero(),sharedBaseLimit:null,reviewFlags:[]};
}

/**
 * Old saved elections retain their employment/age gates and indexing exactly.
 * A resolved year opts into monthly limits and legal non-wage direct funding.
 * Sources: IRS Pub. 969; Form 8889 instructions; 2026 Pub. 15-B; Rev. Proc. 2025-19.
 * Eligibility is attested input, never inferred here. No last-month rule is used.
 */
export function hsaContributions(elections:(HsaElection|undefined)[],ages:number[],wages:number[],index:number,sharedFamily=true,employeeCaps:number[]=[]){
 if(elections.some(e=>e?.timingMode==='verified_year'))return timedHsaContributions(elections,ages,wages,index,sharedFamily,employeeCaps);
 const result=emptyHsaResult(ages),{employee,employer,payrollExcluded}=result;
 let familyRemaining=RULES_2026.hsaFamily*index;
 elections.forEach((e,i)=>{
  if(!e?.eligible||!e.verified||ages[i]>=65||wages[i]<=0)return;
  const fraction=e.eligibleMonths/12,catchUp=ages[i]>=55?RULES_2026.hsaCatchUp*index*fraction:0;
  const base=(e.coverage==='family'?Math.min(sharedFamily?familyRemaining:Infinity,RULES_2026.hsaFamily*index*fraction):RULES_2026.hsaIndividual*index*fraction);
  const cap=base+catchUp;employer[i]=Math.min(cap,e.employerAnnual*index);employee[i]=Math.min(Math.max(0,cap-employer[i]),Math.max(0,wages[i]),employeeCaps[i]??Infinity,e.employeeAnnual*index);
  if(e.coverage==='family'&&sharedFamily)familyRemaining=Math.max(0,familyRemaining-Math.max(0,employee[i]+employer[i]-catchUp));
  payrollExcluded[i]=e.payroll?employee[i]:0;
  result.limit[i]=cap;result.eligibleMonths[i]=e.eligibleMonths;
  result.direct[i]=result.deductible[i]=e.payroll?0:employee[i];
  result.employeeCapped[i]=Math.max(0,e.employeeAnnual*index-employee[i]);
  result.employerCapped[i]=Math.max(0,e.employerAnnual*index-employer[i]);
 });
 return result;
}

function timedHsaContributions(elections:(HsaElection|undefined)[],ages:number[],wages:number[],index:number,sharedFamily:boolean,employeeCaps:number[]):HsaContributions {
 if(!Number.isFinite(index)||index<=0)throw Error('HSA limit index must be positive and finite.');
 if(elections.length!==ages.length||wages.length!==ages.length)throw Error('HSA person arrays must have matching lengths.');
 if(sharedFamily&&ages.length>2)throw Error('A shared spousal HSA limit supports at most two spouses.');
 const result=emptyHsaResult(ages),n=ages.length;
 const active=elections.map((e,i)=>{
  if(e?.timingMode==='verified_year')validateYearElection(e);
  return !!(e?.eligible&&e.verified&&(e.timingMode==='verified_year'||(ages[i]<65&&wages[i]>0)));
 });
 const months=elections.map((e,i)=>active[i]?e!.eligibleMonths:0);
 const masks=elections.map((e,i)=>{
  if(!active[i]||months[i]===0)return new Set<number>();
  if(e?.eligibleMonthNumbers)return new Set(e.eligibleMonthNumbers);
  if(months[i]===12)return new Set(Array.from({length:12},(_,m)=>m+1));
  return null;
 });
 const family=elections.map((e,i)=>active[i]&&months[i]>0&&e!.coverage==='family');
 const individual=RULES_2026.hsaIndividual*index,familyAnnual=RULES_2026.hsaFamily*index;
 let base=months.map((count,i)=>(family[i]?familyAnnual:individual)*count/12);
 let sharedBase:number|null=null;
 if(sharedFamily&&family.some(Boolean)){
  if(masks.every(mask=>mask!==null)){
   base=ages.map(()=>0);sharedBase=0;
   for(let month=1;month<=12;month++){
    const eligible=masks.map(mask=>mask!.has(month));
    const familyMonth=eligible.some((yes,i)=>yes&&family[i]);
    sharedBase+=(familyMonth?familyAnnual:individual*eligible.filter(Boolean).length)/12;
    eligible.forEach((yes,i)=>{if(yes)base[i]+=(familyMonth?familyAnnual:individual)/12;});
   }
  }else if(n===1||family.filter(Boolean).length===2){
   // Unknown dates: full overlap is the smallest possible shared family room.
   sharedBase=familyAnnual*Math.max(...months)/12;
  }else{
   const familyPerson=family.findIndex(Boolean),other=familyPerson===0?1:0;
   const familyMonths=months[familyPerson],otherMonths=months[other]??0;
   sharedBase=(familyAnnual*familyMonths+individual*Math.max(0,otherMonths-familyMonths))/12;
   // Credit family coverage to the other spouse only for guaranteed overlap.
   const guaranteedOverlap=Math.max(0,familyMonths+otherMonths-12);
   if(other<n)base[other]=(individual*otherMonths+(familyAnnual-individual)*guaranteedOverlap)/12;
  }
  if(masks.some(mask=>mask===null)&&months.filter(count=>count>0&&count<12).length>1)
   result.reviewFlags.push('shared_hsa_month_overlap_unverified');
 }
 result.sharedBaseLimit=sharedBase;
 const catchUp=months.map((count,i)=>ages[i]>=55?RULES_2026.hsaCatchUp*count/12:0);
 result.limit=base.map((amount,i)=>amount+catchUp[i]);result.eligibleMonths=months;
 let pool=sharedBase??Infinity;
 const ownBaseRemaining=[...base],catchUpRemaining=[...catchUp];
 const take=(i:number,request:number)=>{
  const amount=Math.min(request,ownBaseRemaining[i]+catchUpRemaining[i],pool+catchUpRemaining[i]);
  const extra=Math.min(amount,catchUpRemaining[i]),ordinary=amount-extra;
  catchUpRemaining[i]-=extra;ownBaseRemaining[i]-=ordinary;pool-=ordinary;
  return amount;
 };
 const employeeRequests=elections.map(e=>e?(e.timingMode==='verified_year'?e.employeeAnnual:e.employeeAnnual*index):0);
 const employerRequests=elections.map(e=>e?(e.timingMode==='verified_year'?e.employerAnnual:e.employerAnnual*index):0);
 // Employer amounts already promised to either spouse consume shared room first.
 elections.forEach((e,i)=>{if(active[i])result.employer[i]=take(i,employerRequests[i]);});
 elections.forEach((e,i)=>{
  if(!active[i])return;
  const wageCap=e!.payroll||e!.timingMode!=='verified_year'?Math.max(0,wages[i]):Infinity;
  result.employee[i]=take(i,Math.max(0,Math.min(employeeRequests[i],wageCap,employeeCaps[i]??Infinity)));
  result.payrollExcluded[i]=e!.payroll?result.employee[i]:0;
  result.direct[i]=result.deductible[i]=e!.payroll?0:result.employee[i];
  if(e!.payroll&&employeeRequests[i]>0&&wages[i]<=0)result.reviewFlags.push(`hsa_payroll_without_wages_${i}`);
 });
 result.employeeCapped=employeeRequests.map((request,i)=>Math.max(0,request-result.employee[i]));
 result.employerCapped=employerRequests.map((request,i)=>Math.max(0,request-result.employer[i]));
 return result;
}
export function megaBackdoorRoom(wages:number,deferral:number,employer:number,index:number):number {
 return Math.max(0,Math.min(wages,RULES_2026.total415*index)-Math.min(deferral,RULES_2026.employeeDeferral*index)-employer);
}
export function backdoorTaxableFraction(pretaxIra:number,aftertaxIraBasis:number,newContribution:number){
 const denominator=Math.max(0,pretaxIra)+Math.max(0,aftertaxIraBasis)+newContribution;
 return denominator>0?Math.max(0,pretaxIra)/denominator:0;
}
