import {RULES_2026} from '../packages/engine/runtime/taxes/limits.js';
import {validateSavingsStrategy,waterfall} from '../packages/engine/runtime/cashflow/waterfall.js';
/** Compatibility adapter: old scenarios retain their explicitly saved savings cap. */
export function effectiveStrategy(person,index=1,override){
 if(override!==undefined)return {mode:'fixed_amount',annualTarget:override,overflow:'lifestyle_spend'};
 if(person.savingsStrategy){validateSavingsStrategy(person.savingsStrategy);return person.savingsStrategy.mode==='fixed_amount'?{...person.savingsStrategy,annualTarget:person.savingsStrategy.annualTarget*index}:person.savingsStrategy;}
 return person.savingsAnnual===undefined?null:{mode:'fixed_amount',annualTarget:person.savingsAnnual*index,overflow:'lifestyle_spend',legacy:true};
}
export function uncappedScenario(plan){
 const next=structuredClone(plan);next.name=`${plan.name.slice(0,75)} · uncapped surplus`;
 next.people.forEach(p=>{delete p.savingsAnnual;p.savingsStrategy={mode:'max_out_and_sweep_surplus'};});
 next.enforceCashBuffer=true;
 next.assumptions=next.assumptions.filter(a=>a.id!=='surplus-refactor');
 next.assumptions.push({id:'surplus-refactor',confirmed:false,text:'Uncapped comparison: legal workplace and direct Roth limits, then all available earnings above declared household/personal expenses and cash reserve go to taxable investing. No implicit partner lifestyle consumption. Enter actual personal expenses; HSA, backdoor and mega-backdoor require separate verified inputs and are not enabled by this comparison.'});
 return next;
}
/** Existing projection supplies its solved household-tax allocation and expense split. */
export function annualSavingsFlow({wages,otherIncome,employee,employer,limits,roth,rothEligible,payrollTax,federalTax,expenses,reserve,strategy,index,employeeHsa=0,megaRequested=0}){
 return waterfall({grossSalary:wages,otherInflows:otherIncome,strategy,
  workplace:{requested:employee,remainingEmployeeLimit:employee,remainingBaseEmployeeLimit:Math.min(employee,RULES_2026.employeeDeferral*index),remaining415Limit:RULES_2026.total415*index,eligibleCompensation:wages,employerContribution:employer,megaBackdoorSupported:megaRequested>0,megaBackdoorRequested:megaRequested},
  hsa:{eligible:employeeHsa>0,requested:employeeHsa,remainingLimit:employeeHsa,employerContribution:0,payrollDeduction:false},
  ira:{requested:roth,remainingLimit:limits.ira,eligibleCompensation:Math.max(0,wages-employee),mode:'direct',directEligibleAmount:rothEligible,backdoorProRataTaxableFraction:0,backdoorVerified:false},
  essentialExpenses:expenses,discretionaryExpenses:0,cashReserveTopUp:reserve,
  calculateTaxes:()=>({federal:federalTax,state:0,payroll:payrollTax,magi:0})});
}
