/** Evidence checklist, never a retirement certification or an automated edit. */
export function planChecks(plan){
 const checks=[],add=(id,section,title,detail)=>checks.push({id,section,title,detail});
 if(!plan.retirementBudget?.enabled)add('budget','plan','Confirm the spending mode','Category spending is active; the fixed retirement budget is disabled.');
 else if(plan.retirementBudget.minimumLiving===0)add('floor','plan','Set the essential spending floor','A zero everyday floor allows flexible rules to reduce that part of spending to zero. Housing, tax and healthcare remain separate protections.');
 if(!plan.healthcare?.enabled)add('health','health','Price healthcare','Separate healthcare planning is off. Your living budget may contain an allowance, but coverage costs are unverified.');
 else for(const health of plan.healthcare.people){const person=plan.people.find(person=>person.id===health.id);if(health.eligibility==='unknown'||!health.marketplaceMonthly||!health.benchmarkMonthly)add(`health-${health.id}`,'health',`Review ${person?.name??health.id}'s coverage`,'ACA eligibility or Marketplace/benchmark quotes need review. Zero may be intentional; verify the coverage schedule.');}
 for(const person of plan.people){
  if(!person.birthDate)add(`birth-${person.id}`,'plan',`Confirm ${person.name}'s birth date`,'Coverage and age-59½ access use an approximate year until a full date is entered.');
  if(person.roth>0&&!person.rothBasisDocumented)add(`basis-${person.id}`,'bridge',`Document ${person.name}'s Roth basis`,'Security cost basis is not contribution basis. Reconcile contributions, prior withdrawals and conversion lots.');
  if(person.rothConversionLots?.some(lot=>!lot.documented))add(`lots-${person.id}`,'bridge',`Verify ${person.name}'s conversion history`,'Unverified conversion lots must be reconciled before relying on seasoned access.');
  if(person.traditional>0&&!person.pretaxSources?.length)add(`access-${person.id}`,'bridge',`Review ${person.name}'s plan access`,'Aggregate traditional balances do not establish IRA versus workplace-plan withdrawal permissions.');
 }
 if(plan.assumptions.some(assumption=>!assumption.confirmed||assumption.status==='missing'||assumption.status==='estimate'))add('assumptions','review','Review estimated inputs','Promotions, tax basis, opening dates, housing and other estimates are explained in the assumption dashboard.');
 const unused=Object.keys(plan.overrides).filter(year=>Number(year)<plan.startYear||Number(year)>plan.endYear);if(unused.length)add('overrides','annual','Review overrides outside the forecast',`Outside years: ${unused.join(', ')}.`);
 return checks;
}
