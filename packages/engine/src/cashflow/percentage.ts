import {federal,payroll} from '../taxes/federal.js';
import {hsaContributions,type HsaElection} from './advantaged.js';
import type {SavingsStrategy} from '../types/index.js';
export interface PercentageDeferralInput {
 wages:number[];otherIncome:number[];requestedEmployee:number[];
 hsaElections:(HsaElection|undefined)[];ages:number[];index:number;joint:boolean;
 strategies:(SavingsStrategy|null)[];hsaEmployeeCaps:number[];
}
/** Percentage elections use earned inflows less their income/payroll tax, before
 * employee saving. Investment distributions, conversions, and withdrawal taxes
 * stay in household funding; they do not change an earned-income savings rate.
 * Workplace deferrals have priority, followed by legal/eligible HSA funding. */
export function percentageDeferrals(p:PercentageDeferralInput){
 const n=p.wages.length,sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
 const employee=[...p.requestedEmployee];let caps=[...p.hsaEmployeeCaps];
 const hsas=(candidateCaps:number[])=>hsaContributions(p.hsaElections,p.ages,p.wages,p.index,p.joint,candidateCaps);
 const taxes=(deferrals:number[],hsa:ReturnType<typeof hsaContributions>)=>{
  const ordinary=p.wages.map((w,i)=>Math.max(0,w-deferrals[i]-hsa.employee[i]+p.otherIncome[i]));
  const income=sum(ordinary),bill=p.joint?federal(income,0,true,p.index).total:0;
  const federalByPerson=ordinary.map(v=>p.joint?(income?bill*v/income:bill/n):federal(v,0,false,p.index).total);
  const payrollWages=p.wages.map((w,i)=>Math.max(0,w-hsa.payrollExcluded[i])),payrollTotal=sum(payrollWages);
  const payrollByPerson=payrollWages.map(w=>p.joint?Math.min(w,184500*p.index)*.062+w*.0145+(payrollTotal?Math.max(0,payrollTotal-250000)*.009*w/payrollTotal:0):payroll([w],false,p.index));
  const targets=p.strategies.map((strategy,i)=>strategy?.mode==='percentage_of_net'?Math.max(0,p.wages[i]+p.otherIncome[i]-federalByPerson[i]-payrollByPerson[i])*strategy.savingsRate:Infinity);
  return {federalByPerson,payrollByPerson,targets};
 };
 // Start percentage HSA caps at zero: an HSA cannot consume the workplace tier's budget.
 caps=caps.map((cap,i)=>p.strategies[i]?.mode==='percentage_of_net'?0:cap);
 for(let iteration=0;iteration<80;iteration++){
  const priorEmployee=[...employee],priorHsa=hsas(caps).employee;
  for(let i=0;i<n;i++){
   if(p.strategies[i]?.mode!=='percentage_of_net')continue;
   const withoutOwnHsa=[...caps];withoutOwnHsa[i]=0;
   const workplaceFits=(amount:number)=>{const candidate=[...employee];candidate[i]=amount;return amount<=taxes(candidate,hsas(withoutOwnHsa)).targets[i]+1e-9;};
   let lo=0,hi=p.requestedEmployee[i];
   if(workplaceFits(hi))lo=hi;else for(let k=0;k<50;k++){const mid=(lo+hi)/2;if(workplaceFits(mid))lo=mid;else hi=mid;}
   employee[i]=lo;caps[i]=0;
   const unlimited=[...caps];unlimited[i]=Infinity;const maximum=hsas(unlimited).employee[i];
   const hsaFits=(amount:number)=>{const candidate=[...caps];candidate[i]=amount;const hsa=hsas(candidate);return employee[i]+hsa.employee[i]<=taxes(employee,hsa).targets[i]+1e-9;};
   lo=0;hi=maximum;if(hsaFits(hi))lo=hi;else for(let k=0;k<50;k++){const mid=(lo+hi)/2;if(hsaFits(mid))lo=mid;else hi=mid;}
   caps[i]=lo;
  }
  const hsa=hsas(caps);
  if(employee.every((value,i)=>Math.abs(value-priorEmployee[i])<1e-7)&&hsa.employee.every((value,i)=>Math.abs(value-priorHsa[i])<1e-7))break;
 }
 const hsa=hsas(caps),earnedTaxes=taxes(employee,hsa);
 for(let i=0;i<n;i++)if(p.strategies[i]?.mode==='percentage_of_net'&&employee[i]+hsa.employee[i]>earnedTaxes.targets[i]+.001)throw Error('Percentage savings allocation did not converge.');
 return {employee,hsa,...earnedTaxes};
}
