import type { SavingsStrategy, TaxInput, TaxState } from '../types/index.js';
export type { SavingsStrategy } from '../types/index.js';
export interface WaterfallInput {
  grossSalary: number; otherInflows: number; strategy: SavingsStrategy;
  /** Remaining limits must account for prior employers/YTD deferrals and legal aggregation. */
  workplace: { requested: number; remainingEmployeeLimit: number; remainingBaseEmployeeLimit: number; remaining415Limit: number; eligibleCompensation: number; employerContribution: number; megaBackdoorSupported: boolean; megaBackdoorRequested: number };
  hsa: { eligible: boolean; requested: number; remainingLimit: number; employerContribution: number; payrollDeduction: boolean };
  ira: { requested: number; remainingLimit: number; eligibleCompensation: number; mode: 'direct' | 'backdoor' | 'none'; directEligibleAmount: number; backdoorProRataTaxableFraction: number; backdoorVerified: boolean };
  essentialExpenses: number; discretionaryExpenses: number; cashReserveTopUp: number;
  /** Exact household tax allocation/filing rules live in the supplied tax engine. */
  calculateTaxes: (input: TaxInput) => TaxState;
}
export interface WaterfallResult {
  grossInflows: number; employeePreTax: number; employerPreTax: number; employeeHsa: number; employerHsa: number;
  taxes: TaxState; takeHome: number; rothIra: number; taxableBackdoorConversion: number; megaBackdoorRoth: number;
  essentialExpenses: number; discretionaryExpenses: number; cashReserveTopUp: number; taxableBrokerage: number;
  lifestyleOverflow: number; shortfall: number; employeeSavings: number; reconciliation: number; warnings: string[];
}
const positive = (v: number, name: string) => { if (!Number.isFinite(v) || v < 0) throw new Error(`${name} must be a nonnegative finite amount.`); return v; };
export function validateSavingsStrategy(strategy: SavingsStrategy): void {
  if (!strategy || !['max_out_and_sweep_surplus','fixed_amount','percentage_of_net'].includes(strategy.mode)) throw new Error('Unknown savings strategy.');
  if (strategy.mode === 'fixed_amount') { positive(strategy.annualTarget,'Annual target'); if (!['sweep_to_taxable','lifestyle_spend'].includes(strategy.overflow)) throw new Error('Unknown overflow policy.'); }
  if (strategy.mode === 'percentage_of_net' && (!Number.isFinite(strategy.savingsRate) || strategy.savingsRate < 0 || strategy.savingsRate > 1)) throw new Error('Savings rate must be between 0 and 1.');
}
/** No taxes, names, years, or statutory dollar limits are hard-coded here. */
export function waterfall(input: WaterfallInput): WaterfallResult {
  validateSavingsStrategy(input.strategy);
  for (const [name,value] of Object.entries(input)) if (typeof value === 'number') positive(value,name);
  for (const section of [input.workplace,input.hsa,input.ira]) for (const [name,value] of Object.entries(section)) if (typeof value === 'number') positive(value,name);
  if (input.ira.backdoorProRataTaxableFraction > 1) throw new Error('Invalid backdoor pro-rata fraction.');
  const {workplace:w,hsa,ira,strategy} = input;
  const warnings: string[] = [];
  const grossInflows = input.grossSalary + input.otherInflows;
  const employeeTarget = strategy.mode === 'fixed_amount' ? strategy.annualTarget : Infinity;
  let employeePreTax = Math.min(input.grossSalary,w.eligibleCompensation,w.remainingEmployeeLimit,employeeTarget,strategy.mode === 'max_out_and_sweep_surplus' ? w.remainingEmployeeLimit : w.requested);
  let baseDeferral = Math.min(employeePreTax,w.remainingBaseEmployeeLimit);
  let employerPreTax = Math.min(w.employerContribution,Math.max(0,Math.min(w.remaining415Limit,w.eligibleCompensation)-baseDeferral));
  const employerHsa = hsa.eligible ? Math.min(hsa.employerContribution,hsa.remainingLimit) : 0;
  let employeeHsa = hsa.eligible ? Math.min(grossInflows-employeePreTax,Math.max(0,hsa.remainingLimit-employerHsa),Math.max(0,employeeTarget-employeePreTax),strategy.mode === 'max_out_and_sweep_surplus' ? hsa.remainingLimit : hsa.requested) : 0;
  if (!hsa.eligible && hsa.requested > 0) warnings.push('HSA election ignored: eligibility is not established.');
  if(strategy.mode==='percentage_of_net') {
    const requestedDeferral=employeePreTax,requestedHsa=employeeHsa;
    const satisfies=(fraction:number)=>{
      const d=requestedDeferral*fraction,h=requestedHsa*fraction;
      const t=input.calculateTaxes({grossSalary:input.grossSalary,otherInflows:input.otherInflows,preTaxDeferral:d,hsaDeduction:h,hsaPayrollExclusion:hsa.payrollDeduction?h:0,taxableBackdoorConversion:0});
      for(const [key,value] of Object.entries(t))positive(value,`Tax ${key}`);
      return d+h<=Math.max(0,grossInflows-t.federal-t.state-t.payroll)*strategy.savingsRate+1e-8;
    };
    if(!satisfies(1)){let lo=0,hi=1;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(satisfies(mid))lo=mid;else hi=mid;}employeePreTax=requestedDeferral*lo;employeeHsa=requestedHsa*lo;}
    baseDeferral=Math.min(employeePreTax,w.remainingBaseEmployeeLimit);
    employerPreTax=Math.min(w.employerContribution,Math.max(0,Math.min(w.remaining415Limit,w.eligibleCompensation)-baseDeferral));
  }
  const taxInput: TaxInput = {grossSalary:input.grossSalary,otherInflows:input.otherInflows,preTaxDeferral:employeePreTax,hsaDeduction:employeeHsa,hsaPayrollExclusion:hsa.payrollDeduction?employeeHsa:0,taxableBackdoorConversion:0};
  const checkedTax = (conversion: number) => {
    const tax = input.calculateTaxes({...taxInput,taxableBackdoorConversion:conversion});
    for (const [key,value] of Object.entries(tax)) positive(value,`Tax ${key}`);
    return tax;
  };
  let taxes = checkedTax(0);
  const totalTax = (t: TaxState) => t.federal+t.state+t.payroll;
  const baseNet = grossInflows-employeePreTax-employeeHsa-totalTax(taxes);
  const essentialExpenses = input.essentialExpenses;
  // Optional investing never borrows the money needed for essentials or the cash buffer.
  const protectedCosts = essentialExpenses+input.cashReserveTopUp+input.discretionaryExpenses;
  let optional = Math.max(0,baseNet-protectedCosts);
  const remainingTarget = Math.max(0,employeeTarget-employeePreTax-employeeHsa);
  if (strategy.mode === 'fixed_amount') optional = Math.min(optional,remainingTarget);
  if (strategy.mode === 'percentage_of_net') optional = Math.min(optional,Math.max(0,Math.max(0,baseNet+employeePreTax+employeeHsa)*strategy.savingsRate-employeePreTax-employeeHsa));
  let iraRequest = Math.min(ira.remainingLimit,ira.eligibleCompensation,optional,strategy.mode === 'max_out_and_sweep_surplus'?ira.remainingLimit:ira.requested);
  if (ira.mode === 'none') iraRequest = 0;
  if (ira.mode === 'direct') iraRequest = Math.min(iraRequest,ira.directEligibleAmount);
  if (ira.mode === 'backdoor' && !ira.backdoorVerified) { iraRequest=0;warnings.push('Backdoor Roth not funded: eligibility and pro-rata basis require verification.'); }
  const fraction = ira.mode === 'backdoor'?ira.backdoorProRataTaxableFraction:0;
  const affordable = (amount: number) => amount+Math.max(0,totalTax(checkedTax(amount*fraction))-totalTax(taxes)) <= optional+1e-8;
  let rothIra=iraRequest;
  if (!affordable(rothIra)) { let lo=0,hi=rothIra;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(affordable(mid))lo=mid;else hi=mid;}rothIra=lo; }
  const taxableBackdoorConversion=rothIra*fraction;
  taxes=checkedTax(taxableBackdoorConversion);
  const takeHome=grossInflows-employeePreTax-employeeHsa-totalTax(taxes);
  const netRemaining=Math.max(0,takeHome-protectedCosts-rothIra);
  let targetLeft = Math.max(0,remainingTarget-rothIra);
  if (strategy.mode==='percentage_of_net') targetLeft=Math.max(0,Math.max(0,takeHome+employeePreTax+employeeHsa)*strategy.savingsRate-employeePreTax-employeeHsa-rothIra);
  const megaBackdoorRoth=w.megaBackdoorSupported?Math.min(netRemaining,targetLeft,w.megaBackdoorRequested,Math.max(0,Math.min(w.remaining415Limit,w.eligibleCompensation)-baseDeferral-employerPreTax)):0;
  if (!w.megaBackdoorSupported&&w.megaBackdoorRequested>0) warnings.push('Mega-backdoor ignored: plan support is not verified.');
  const reserveAvailable=Math.max(0,takeHome-essentialExpenses);
  const cashReserveTopUp=Math.min(input.cashReserveTopUp,reserveAvailable);
  const discretionaryExpenses=Math.min(input.discretionaryExpenses,Math.max(0,takeHome-essentialExpenses-cashReserveTopUp));
  const spillover=Math.max(0,takeHome-essentialExpenses-cashReserveTopUp-discretionaryExpenses-rothIra-megaBackdoorRoth);
  const taxableBrokerage=strategy.mode==='max_out_and_sweep_surplus'||strategy.mode==='fixed_amount'&&strategy.overflow==='sweep_to_taxable'?spillover:Math.min(spillover,Math.max(0,targetLeft-megaBackdoorRoth));
  const lifestyleOverflow=spillover-taxableBrokerage;
  const shortfall=Math.max(0,essentialExpenses-takeHome);
  const employeeSavings=employeePreTax+employeeHsa+rothIra+megaBackdoorRoth+taxableBrokerage;
  const reconciliation=grossInflows+shortfall-(employeePreTax+employeeHsa+totalTax(taxes)+rothIra+megaBackdoorRoth+essentialExpenses+discretionaryExpenses+cashReserveTopUp+taxableBrokerage+lifestyleOverflow);
  return {grossInflows,employeePreTax,employerPreTax,employeeHsa,employerHsa,taxes,takeHome,rothIra,taxableBackdoorConversion,megaBackdoorRoth,essentialExpenses,discretionaryExpenses,cashReserveTopUp,taxableBrokerage,lifestyleOverflow,shortfall,employeeSavings,reconciliation,warnings};
}
/** Shared costs: explicit dollar splits or income weights. No names/roles are special. */
export function splitHouseholdExpenses(total: number, weights: number[]): number[] {
  positive(total,'Household expense');weights.forEach(w=>positive(w,'Expense weight'));
  const sum=weights.reduce((a,b)=>a+b,0);if(!weights.length||sum<=0)throw new Error('Expense allocation requires positive weights.');
  return weights.map(w=>total*w/sum);
}
