// All legacy money columns are nominal; real columns explicitly carry the
// plan's base dollar year. Export is independent of the UI display selection.
export function annualRecords(plan,result){
 return result.rows.map(r=>({
  year:r.year,age:r.age,baseDollarYear:plan.baseYear,inflationIndex:r.inflationIndex,retirementBudgetActive:!!r.budget,
  realSpending:r.spending/r.inflationIndex,realTax:(r.federalTax+r.payrollTax)/r.inflationIndex,realTotalOutgo:r.totalOutgo/r.inflationIndex,
  realRetirementTarget:r.budget?r.budget.target/r.inflationIndex:'',realLivingAllowance:r.budget?r.budget.living/r.inflationIndex:'',realBudgetOverrun:r.budget?r.budget.overrun/r.inflationIndex:'',
  ...Object.fromEntries(['openingPortfolio','openingRealPortfolio','wages','otherIncome','socialSecurity','employee401k','employer','federalTax','payrollTax','spending','totalOutgo','upfront','saleProceeds','rothAdded','brokerAdded','investedSurplus','conversion','magi','accessible','portfolio','realPortfolio','homeEquity','netWorth','shortfall','reconciliation'].map(k=>[k,r[k]??0])),
  healthcareCost:r.healthcare.cost,mTakeHome:r.peopleFlow[0].takeHome,bTakeHome:r.peopleFlow[1].takeHome,mTaxableDeposits:r.peopleFlow[0].taxableDeposits,bTaxableDeposits:r.peopleFlow[1].taxableDeposits
 }));
}
export function annualCSV(plan,result){const records=annualRecords(plan,result);if(!records.length)return '';const keys=Object.keys(records[0]);return [keys.join(','),...records.map(r=>keys.map(k=>r[k]).join(','))].join('\n');}
