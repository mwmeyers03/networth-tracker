/** Notice 2022-6, rules for schedules commencing from 2023. Planning only:
 * input attestations are explicit user review, not an IRS/custodian approval. */
export const SEPP_RULE_SOURCE = 'https://www.irs.gov/irb/2022-05_IRB#NOT-2022-6';
export type SeppMethod = 'fixed_amortization' | 'rmd';
export interface SeppFactorTable {
  kind:'single_life'|'uniform_lifetime';
  /** Edition and primary citation must be retained with a saved scenario. */
  edition:string;source:string;verified:boolean;
  factors:Record<number,number>;
}
export interface SeppAfr {
  /** YYYY-MM of an IRS rate publication immediately before commencement. */
  month:string;
  /** Published 120% federal mid-term rate, annual compounding, decimal (not raw AFR). */
  annual120PercentMidterm:number;
  source:string;verified:boolean;
}
export interface SeppInput {
  accountId:string;accountType:'traditional_ira'|'employer_plan';
  birthDate:string;startDate:string;valuationDate:string;openingBalance:number;
  method:SeppMethod;factorTable:SeppFactorTable;
  annualInterestRate?:number;afr?:SeppAfr;
  review:{
    /** One segregated account only; no ordinary draws or Roth conversions from it. */
    segregatedAccount:boolean;
    accountAccessConfirmed:boolean;
    employerSeparationConfirmed:boolean;
    scheduleReviewed:boolean;
  };
}
export interface SeppSchedule {
  accountId:string;method:SeppMethod;startYear:number;startDate:string;
  age59AndHalfDate:string;fifthAnniversary:string;commitmentEndDate:string;
  initialAnnualDistribution:number;maximumInterestRate:number|null;
  status:'REVIEW_REQUIRED'|'REVIEWED_INPUTS';eligibleForModel:boolean;
  reviewIssues:string[];source:string;
}
export interface SeppDistribution {
  year:number;scheduledNominal:number;distributedNominal:number;
  /** All remaining account assets may be exhausted without a modification. */
  depleted:boolean;ordinaryIncome:number;earlyWithdrawalPenalty:0;
}

const fail=(message:string):never=>{throw new Error(`SEPP: ${message}`);};
function date(value:string,label:string):Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return fail(`${label} requires an exact YYYY-MM-DD date.`);
  const parsed=new Date(`${value}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)return fail(`${label} is invalid.`);
  return parsed;
}
const iso=(value:Date)=>value.toISOString().slice(0,10);
function addMonths(value:Date,months:number):Date {
  const first=new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+months,1));
  const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(value.getUTCDate(),lastDay)));
}
const amount=(value:number,label:string)=>{
  if(!Number.isFinite(value)||value<0)fail(`${label} must be finite and nonnegative.`);
  return value;
};
function factor(input:SeppInput,year:number):number {
  const age=year-date(input.birthDate,'Birth date').getUTCFullYear();
  const result=input.factorTable.factors[age];
  if(!Number.isFinite(result)||result<=0)fail(`Missing valid ${input.factorTable.kind} factor for attained age ${age}.`);
  return result;
}
/** Present-value annuity formula; payments rounded only by the caller/custodian. */
export function seppAmortizationPayment(balance:number,years:number,annualRate:number):number {
  amount(balance,'Account balance');amount(annualRate,'Interest rate');
  if(!Number.isFinite(years)||years<=0)fail('Life expectancy must be positive.');
  return annualRate===0?balance/years:balance*annualRate/-Math.expm1(-years*Math.log1p(annualRate));
}
export function calculateSepp(input:SeppInput):SeppSchedule {
  if(!input.accountId?.trim())fail('A single account ID is required.');
  if(!['traditional_ira','employer_plan'].includes(input.accountType))fail('Unsupported account type.');
  if(!['fixed_amortization','rmd'].includes(input.method))fail('Unsupported method. Annuitization is not implemented.');
  if(!['single_life','uniform_lifetime'].includes(input.factorTable.kind))fail('Joint-beneficiary tables are not implemented.');
  const birth=date(input.birthDate,'Birth date'),start=date(input.startDate,'First payment date'),valuation=date(input.valuationDate,'Valuation date');
  const year=start.getUTCFullYear();
  if(year<2023)fail('Pre-2023 series require different rules and are not supported.');
  if(birth>=start)fail('Birth date must precede first payment.');
  amount(input.openingBalance,'Opening balance');
  const earliest=new Date(Date.UTC(year-1,11,31));
  if(valuation<earliest||valuation>start)fail('Opening valuation must be between prior December 31 and first payment.');
  if(input.method==='rmd'&&iso(valuation)!==`${year-1}-12-31`)fail('RMD scenario requires prior December 31 valuation.');
  let maximumInterestRate:number|null=null;
  if(input.method==='fixed_amortization'){
    const rate=amount(input.annualInterestRate??NaN,'Interest rate');
    // The 5% floor may be selected without an AFR quote. A higher rate needs a dated verified quote.
    maximumInterestRate=.05;
    if(input.afr){
      const prior=[iso(addMonths(start,-1)).slice(0,7),iso(addMonths(start,-2)).slice(0,7)];
      if(!prior.includes(input.afr.month))fail('AFR quote must be from either of the two months before first payment.');
      maximumInterestRate=Math.max(.05,amount(input.afr.annual120PercentMidterm,'Published 120%-AFR rate'));
    }
    if(rate>maximumInterestRate+1e-12)fail('Selected interest rate exceeds the permitted maximum.');
  }
  const reviewIssues:string[]=[];
  if(!input.review.segregatedAccount)reviewIssues.push('Confirm this is one segregated account with no other distributions, conversions, transfers, or contributions.');
  if(!input.review.accountAccessConfirmed)reviewIssues.push('Confirm custodian or plan permits this distribution schedule.');
  if(input.accountType==='employer_plan'&&!input.review.employerSeparationConfirmed)reviewIssues.push('Employer-plan SEPP requires separation from the employer before payments begin.');
  if(!input.review.scheduleReviewed)reviewIssues.push('Review dates, valuations, annual payments, and recapture risk before enabling this scenario.');
  if(!input.factorTable.verified||!input.factorTable.source||!input.factorTable.edition)reviewIssues.push('Supply and review the applicable dated IRS life expectancy table.');
  if((input.annualInterestRate??0)>.05&&(!input.afr?.verified||!input.afr.source))reviewIssues.push('Review the published annual 120%-AFR quote supporting a rate above 5%.');
  const age59=addMonths(birth,59*12+6),fifth=addMonths(start,60);
  const first=input.method==='rmd'?input.openingBalance/factor(input,year):seppAmortizationPayment(input.openingBalance,factor(input,year),input.annualInterestRate??0);
  return {accountId:input.accountId,method:input.method,startYear:year,startDate:input.startDate,
    age59AndHalfDate:iso(age59),fifthAnniversary:iso(fifth),commitmentEndDate:iso(age59>fifth?age59:fifth),
    initialAnnualDistribution:first,maximumInterestRate,status:reviewIssues.length?'REVIEW_REQUIRED':'REVIEWED_INPUTS',eligibleForModel:reviewIssues.length===0,reviewIssues,source:SEPP_RULE_SOURCE};
}
/** Annual nominal payment from the segregated account. Fixed SEPP amounts must NOT
 * be inflated in a real-dollar projection. Pass the relevant year's remaining account
 * balance after investment returns; RMD requires prior-year closing balance separately.
 * This function never transfers assets or funds the surrounding household itself. */
export function seppDistribution(input:SeppInput,year:number,remainingBalance:number,priorYearClosingBalance?:number):SeppDistribution {
  const schedule=calculateSepp(input);
  if(!Number.isInteger(year))fail('Distribution year must be an integer.');
  amount(remainingBalance,'Remaining balance');
  if(!schedule.eligibleForModel)fail(`Cannot activate unreviewed schedule: ${schedule.reviewIssues.join(' ')}`);
  if(year<schedule.startYear)return {year,scheduledNominal:0,distributedNominal:0,depleted:false,ordinaryIncome:0,earlyWithdrawalPenalty:0};
  const balance=input.method!=='rmd'||year===schedule.startYear?input.openingBalance:amount(priorYearClosingBalance??NaN,'Prior-year closing balance');
  // Fixed amortization does not need or recalculate subsequent valuation/factors.
  const scheduled=input.method==='rmd'?balance/factor(input,year):schedule.initialAnnualDistribution;
  const distributed=Math.min(remainingBalance,scheduled);
  return {year,scheduledNominal:scheduled,distributedNominal:distributed,depleted:remainingBalance+1e-8<scheduled,
    ordinaryIncome:distributed,earlyWithdrawalPenalty:0};
}
