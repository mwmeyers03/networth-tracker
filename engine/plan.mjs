import {validateSavingsStrategy} from '../packages/engine/runtime/cashflow/waterfall.js';
import {validateExtensions} from './extensions.mjs';
export const clone = value => JSON.parse(JSON.stringify(value));
import {DEFAULT_PLAN} from '../config/legacy-default-plan.mjs';
export {DEFAULT_PLAN};
export function validate(plan) {
 const errors=[];
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||plan.schema!==1) return ['Unsupported or missing plan schema.'];
 for(const key of ['startYear','baseYear','endYear','jointYear','inflation','taxInflation','stockReturn','stockVol','bondReturn','bondVol','correlation','cashReturn','stockWeight','fees','dividendYield','cashReserve','conversionAnnual','conversionStart','conversionEnd','acaFpl','acaTarget','acaUpper','acaStart','acaEnd','withdrawalRate','spendingFloor']) if(!Number.isFinite(plan[key])) errors.push(`${key} must be a finite number.`);
 if(!Number.isInteger(plan.baseYear)||plan.baseYear>plan.startYear||plan.baseYear<2026) errors.push('Base dollar year must be 2026 or later and no later than the first forecast year.');
 if(!Number.isInteger(plan.startYear)||!Number.isInteger(plan.endYear)||!Number.isInteger(plan.jointYear)) errors.push('Projection and filing years must be integers.');
 if(typeof plan.name!=='string'||plan.name.length<1||plan.name.length>120) errors.push('Use a plan name between 1 and 120 characters.');
 if(plan.acaFpl<=0||plan.acaTarget<0||plan.acaUpper<plan.acaTarget||plan.cashReserve<0||plan.conversionAnnual<0||plan.withdrawalRate<=0||plan.withdrawalRate>1||plan.spendingFloor<0||plan.spendingFloor>1) errors.push('Invalid spending, conversion or MAGI policy.');
 if(plan.startYear<2026||plan.endYear<plan.startYear||plan.endYear-plan.startYear>85) errors.push('Use a 2026+ start and a horizon of at most 85 years.');
 if(plan.stockWeight<0||plan.stockWeight>1||plan.correlation < -1||plan.correlation>1||plan.fees<0||plan.fees>.1||plan.inflation<=-.5||plan.stockVol<0||plan.bondVol<0||plan.cashReturn<=-1||plan.stockReturn<=-1||plan.bondReturn<=-1||plan.taxInflation<=-.5) errors.push('Return, allocation, volatility or inflation assumptions are out of range.');
 if(!['fixed','percent','guardrails'].includes(plan.strategy)||!['invest','cash'].includes(plan.surplus)) errors.push('Invalid spending or surplus strategy.');
 if(!Array.isArray(plan.people)||plan.people.length!==2) errors.push('Exactly two people are required.');
 if(plan.people?.[0]?.id!=='m'||plan.people?.[1]?.id!=='b') errors.push('Person identifiers must be m and b.');
 for(const p of Array.isArray(plan.people)?plan.people:[]){
  if(!p||typeof p!=='object'||Array.isArray(p)){errors.push('Invalid person record.');continue;}
  if(typeof p.name!=='string'||p.name.length>80) errors.push('Invalid person name.');
  for(const k of ['birthYear','workStart','retireYear','employmentStart','rothOpenYear']) if(!Number.isInteger(p[k])) errors.push('Person dates must be whole years.');
  if(p.matchImmediate>1||p.matchGraded>1||p.salaryGrowth>1) errors.push('Salary growth and match rates cannot exceed 100%.');
  for(const [k,v] of Object.entries(DEFAULT_PLAN.people[0])) if(typeof v==='number'&&(!Number.isFinite(p[k])||p[k]<0)) errors.push(`${p.name||'Person'}: invalid ${k}.`);
  if(p.savingsStrategy){try{validateSavingsStrategy(p.savingsStrategy);}catch(e){errors.push(`${p.name}: ${e.message}`);}}
  if(p.employee401kMode!==undefined&&!['dollar','percent'].includes(p.employee401kMode)) errors.push(`${p.name}: invalid 401(k) election mode.`);
  if(p.employee401kPercent!==undefined&&(!Number.isFinite(p.employee401kPercent)||p.employee401kPercent<0||p.employee401kPercent>1)) errors.push(`${p.name}: 401(k) percentage must be between 0 and 1.`);
  if(p.employee401kMode==='percent'&&p.employee401kPercent===undefined) errors.push(`${p.name}: missing 401(k) percentage.`);
  if(p.socialSecurityAnnual!==undefined&&(!Number.isFinite(p.socialSecurityAnnual)||p.socialSecurityAnnual<0)) errors.push(`${p.name}: invalid Social Security amount.`);
  if(p.socialSecurityStartYear!==undefined&&(!Number.isInteger(p.socialSecurityStartYear)||p.socialSecurityStartYear<p.birthYear)) errors.push(`${p.name}: invalid Social Security start year.`);
  if(p.socialSecurityAnnual>0&&p.socialSecurityStartYear===undefined) errors.push(`${p.name}: missing Social Security start year.`);
  // A salary quote may be anchored to a future job-start year (for example,
  // a future first full-time salary quote) even when a scenario is edited to
  // begin earlier. The employment function already returns zero before
  // workStart, so the validator only needs to enforce a sensible calendar
  // range here.
  if(p.salaryBaseYear!==undefined&&(!Number.isInteger(p.salaryBaseYear)||p.salaryBaseYear<1900||p.salaryBaseYear>2300)) errors.push(`${p.name}: invalid salary base year.`);
  if(p.unvested>p.traditional) errors.push(`${p.name}: unvested amount exceeds account balance.`);
  if(p.birthYear<1900||p.birthYear>plan.startYear||p.retireYear<p.workStart) errors.push(`${p.name}: invalid dates.`);
 }
 if(!Array.isArray(plan.expenses)||plan.expenses.length>200) errors.push('Invalid expense schedule.');
 for(const e of Array.isArray(plan.expenses)?plan.expenses:[]) if(!e||typeof e!=='object'||!Number.isFinite(e.annual)||e.annual<0||!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.end<e.start) errors.push('Invalid expense amount or date range.');
 const expenseIds=new Set();
 for(const e of Array.isArray(plan.expenses)?plan.expenses:[]){
  if(!e||typeof e!=='object')continue;
  if(typeof e.id!=='string'||!e.id||e.id.length>80||expenseIds.has(e.id))errors.push('Expense identifiers must be unique text.');
  expenseIds.add(e.id);
  if(e.essential!==undefined&&typeof e.essential!=='boolean')errors.push('Essential expense setting must be boolean.');
  if(typeof e.name!=='string'||!e.name.trim()||e.name.length>200||!['m','b','joint'].includes(e.owner)||typeof e.inflate!=='boolean')errors.push('Invalid expense name, owner or inflation setting.');
 }
 const h=plan.housing;
 if(!h||typeof h!=='object'||Array.isArray(h)||!['rent','buy'].includes(h.mode)) errors.push('Invalid housing mode.');
 else {
  for(const [k,v] of Object.entries(DEFAULT_PLAN.housing)) if(typeof v==='number'&&(!Number.isFinite(h[k])||h[k]<0)) errors.push(`Housing: invalid ${k}.`);
  if(h.down>1||h.rate>1||h.term<1||h.term>50||h.closing>1||h.selling>1) errors.push('Invalid mortgage parameters.');
  if(!Number.isInteger(h.term)||!Number.isInteger(h.buyYear)||!Number.isInteger(h.moveYear)||!Number.isInteger(h.jointRentYear))errors.push('Housing years and term must be whole numbers.');
  if(h.mode==='buy'&&h.buyYear<plan.startYear)errors.push('Purchase year must be within or after the forecast start; existing home balances are not modeled.');
 }
 if(!plan.overrides||typeof plan.overrides!=='object'||Array.isArray(plan.overrides)) errors.push('Invalid annual overrides.');
 const overrideKeys=new Set(['spending','retirementBudget','conversion',...['m','b'].flatMap(id=>[`${id}Salary`,`${id}Bonus`,`${id}Income`,`${id}401k`,`${id}Roth`,`${id}Brokerage`,`${id}Savings`,...['traditional','roth','brokerage','cash'].map(k=>`${id}_${k}`)]),...[...expenseIds].map(id=>`expense_${id}`)]);
 for(const [year,row] of Object.entries(plan.overrides||{})){
  if(!/^\d{4}$/.test(year)||!row||typeof row!=='object'||Array.isArray(row)) {errors.push('Invalid override year.');continue;}
  if(Number(year)<plan.startYear||Number(year)>plan.endYear)errors.push(`${year}: override is outside the forecast horizon.`);
  for(const key of Object.keys(row))if(!overrideKeys.has(key))errors.push(`${year}: unknown override ${key}.`);
  for(const v of Object.values(row)) if(!Number.isFinite(v)||v<0) errors.push(`${year}: overrides must be nonnegative finite numbers.`);
 }
 if(plan.returnUnit!==undefined&&!['nominal','real'].includes(plan.returnUnit))errors.push('Return units must be nominal or real.');
 if(plan.stockReturnMean!==undefined&&!['arithmetic','geometric'].includes(plan.stockReturnMean))errors.push('Stock return mean must be arithmetic or geometric.');
 for(const k of ['retirementStockReturn','retirementBondReturn','retirementCashReturn'])if(plan[k]!==undefined&&(!Number.isFinite(plan[k])||plan[k]<=-1||plan[k]>1))errors.push(`Invalid ${k}.`);
 if(plan.cashReserveMode!==undefined&&!['fixed','months'].includes(plan.cashReserveMode)) errors.push('Invalid cash reserve mode.');
 if(plan.reserveMonths!==undefined&&(!Number.isFinite(plan.reserveMonths)||plan.reserveMonths<0||plan.reserveMonths>60)) errors.push('Reserve months must be between 0 and 60.');
 if(plan.cashReserveMode==='months'&&plan.reserveMonths===undefined) errors.push('Missing reserve months.');
 if(plan.retirementStockWeight!==undefined&&(!Number.isFinite(plan.retirementStockWeight)||plan.retirementStockWeight<0||plan.retirementStockWeight>1)) errors.push('Retirement stock allocation must be between 0 and 1.');
 if(plan.allocationMode!==undefined&&!['fixed','glide'].includes(plan.allocationMode)) errors.push('Invalid allocation mode.');
 if(plan.bondYield!==undefined&&(!Number.isFinite(plan.bondYield)||plan.bondYield<0||plan.bondYield>1)) errors.push('Bond yield must be between 0 and 1.');
 if(plan.dividendYield<0||plan.dividendYield>1) errors.push('Dividend yield must be between 0 and 1.');
 if(plan.enforceCashBuffer!==undefined&&typeof plan.enforceCashBuffer!=='boolean')errors.push('Cash buffer enforcement must be boolean.');
 if(plan.relaxedConversionYears!==undefined&&(!Array.isArray(plan.relaxedConversionYears)||plan.relaxedConversionYears.some(y=>!Number.isInteger(y)||y<plan.startYear||y>plan.endYear)))errors.push('Invalid conversion relaxation years.');
 if(plan.capConversions!==undefined&&typeof plan.capConversions!=='boolean') errors.push('Conversion cap must be boolean.');
 if(!Array.isArray(plan.assumptions)) errors.push('Missing assumption register.');
 else if(plan.assumptions.length>200||plan.assumptions.some(a=>!a||typeof a.id!=='string'||typeof a.text!=='string'||a.text.length>5000||typeof a.confirmed!=='boolean'))errors.push('Invalid assumption note.');
 if(plan.stockVol>1||plan.bondVol>1||plan.stockReturn>1||plan.bondReturn>1||plan.cashReturn>1||plan.inflation>1||plan.taxInflation>1)errors.push('Return, volatility or inflation above 100% is outside the supported model.');
 errors.push(...validateExtensions(plan));
 return [...new Set(errors)];
}
