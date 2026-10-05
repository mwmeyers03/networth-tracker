import {validate} from './plan.mjs';
import {project} from './project.mjs';

function financialInputs(plan){
 const copy=JSON.parse(JSON.stringify(plan));
 delete copy.name;delete copy.assumptions;delete copy.taxYear2026;
 copy.people.forEach(person=>{delete person.name;});
 copy.expenses.forEach(expense=>{delete expense.name;});
 return copy;
}
function group(path){
 if(/^(baseYear|startYear|endYear)$/.test(path))return 'Dollar year & horizon';
 if(path.startsWith('overrides.'))return 'Annual overrides';
 if(/^(stock|bond|cashReturn|cashNominalReturn|retirementStock|retirementBond|retirementCash|returnUnit|allocationMode|fees|dividendYield|inflation|correlation)/.test(path)||/ReturnDrag|TaxTreatment|salaryGrowthUnit/.test(path))return 'Returns & inflation';
 if(/^(expenses|housing|retirementBudget|strategy|withdrawalRate|spendingFloor|surplus|cashReserve|reserveMonths|enforceCashBuffer)/.test(path))return 'Spending, housing & reserves';
 if(/^(healthcare|aca|jointYear|taxInflation)/.test(path))return 'Taxes & healthcare';
 if(/^conversion|^capConversions|^relaxedConversionYears|^withdrawalPolicy/.test(path)||/pretaxSources|pretaxEarlyAccess|penaltyException|sepp|rothOpenYear|birthDate|birthYear/.test(path))return 'Retirement access & conversions';
 if(/^people\.\d+\.(traditional|unvested|roth$|rothBasis|rothConversionLots|brokerage$|brokerageBasis|cash$|hsaBalance)/.test(path))return 'Opening balances & basis';
 if(path.startsWith('people.'))return 'Income, work dates & savings';
 return 'Other calculation inputs';
}
export function scenarioInputDifferences(left,right){
 const differences=[];
 function walk(a,b,path){
  if(a===b)return;
  if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
   const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
   keys.forEach(key=>walk(a[key],b[key],path?`${path}.${key}`:key));return;
  }
  differences.push({path,group:group(path),leftPresent:a!==undefined,rightPresent:b!==undefined,left:a??null,right:b??null});
 }
 walk(financialInputs(left),financialInputs(right),'');return differences;
}
/** @type {Array<[string,(row:import('../packages/engine/runtime/projection/contracts.js').ProjectionRow)=>number]>} */
const metrics=[['Financial assets',r=>r.portfolio],['Penalty-free assets before tax',r=>r.accessible],['Gross wages',r=>r.wages],['Employee 401(k)',r=>r.employee401k],['Employer 401(k) deposits',r=>r.employer],['Employee HSA deposits',r=>r.employeeHsa],['Employer HSA deposits',r=>r.employerHsa],['Roth IRA deposits',r=>r.rothAdded],['Taxable deposits incl. cash sweep',r=>r.brokerAdded+r.investedSurplus],['Living, housing & healthcare',r=>r.spending],['Total outgo incl. tax & one-time costs',r=>r.totalOutgo],['Federal & payroll tax incl. penalties',r=>r.federalTax+r.payrollTax],['Roth conversions',r=>r.conversion],['Remaining funding gap',r=>r.shortfall]];
export function reconcileScenarios(left,right){
 for(const plan of [left,right]){const errors=validate(plan);if(errors.length)throw Error(errors.join('\n'));}
 const differences=scenarioInputDifferences(left,right),a=project(left),b=project(right);
 const aligned=left.baseYear===right.baseYear&&left.startYear===right.startYear&&left.endYear===right.endYear;
 const summary=(plan,result)=>({name:plan.name,baseYear:plan.baseYear,startYear:plan.startYear,endYear:plan.endYear,retirementYear:Math.min(...plan.people.map(person=>person.retireYear)),retirementOpening:result.retirement?.openingRealPortfolio??null,terminal:result.terminal.realPortfolio,firstFailure:result.firstFailure,maxLedgerResidual:Math.max(...result.rows.map(row=>Math.abs(row.reconciliation)))});
 return {aligned,identicalInputs:differences.length===0,differences,left:summary(left,a),right:summary(right,b),
  retirementDelta:aligned&&a.retirement&&b.retirement&&a.retirement.year===b.retirement.year?b.retirement.openingRealPortfolio-a.retirement.openingRealPortfolio:null,
  terminalDelta:aligned?b.terminal.realPortfolio-a.terminal.realPortfolio:null,
  years:aligned?a.rows.map((row,index)=>({year:row.year,metrics:metrics.map(([label,value])=>{const left=value(row)/row.inflationIndex,right=value(b.rows[index])/b.rows[index].inflationIndex;return {label,left,right,delta:right-left};})})):[]};
}
