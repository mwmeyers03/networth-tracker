// A retirement envelope replaces tagged retirement living categories only.
// Calendar expenses, moving and purchase cash stay outside it. Taxes/coverage
// are solved inside each funding trial, so they are never counted twice.
export const isRetirementExpense=e=>e.phase==='retirement'||e.id==='retire';
export function budgetDefaults(){return {enabled:true,annual:80000,dollarMode:'real',taxes:'included',healthcare:'included',minimumLiving:0};}
export function retirementEnvelope(plan,year,index,override={}){
 const p=plan.retirementBudget;
 if(!p?.enabled||year<Math.min(...plan.people.map(x=>x.retireYear))||override.spending!==undefined)return null;
 const scale=p.dollarMode==='real'?index:1;
 return {target:override.retirementBudget??p.annual*scale,minimumLiving:p.minimumLiving*scale,taxes:p.taxes,healthcare:p.healthcare};
}
export function envelopeCosts(envelope,{housing,outside,upfront=0,tax,payroll,health}){
 const includedTax=envelope.taxes==='included'?tax+payroll:0;
 const includedHealth=envelope.healthcare==='included'?health:0;
 const living=Math.max(envelope.minimumLiving,envelope.target-housing-includedTax-includedHealth);
 const overrun=Math.max(0,housing+envelope.minimumLiving+includedTax+includedHealth-envelope.target);
 const spending=housing+living+outside; // Healthcare is added once by project().
 const additional=(envelope.taxes==='additional'?tax+payroll:0)+(envelope.healthcare==='additional'?health:0);
 return {spending,budget:{...envelope,living,housing,includedTax,includedHealth,outside,purchaseUpfront:upfront,additional,overrun,totalOutgo:spending+tax+payroll+health+upfront}};
}
