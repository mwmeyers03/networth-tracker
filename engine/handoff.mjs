import {DEFAULT_PLAN,clone} from './plan.mjs';
import {createTaxYear2026} from './tax-year.mjs';
// Export names and location identifiers are retained for existing callers.
export const HANDOFF_ID='public-demonstration-v1';
export const LOCATION_INPUTS={
 titusville:{name:'Example location A',rent:1500,price:300000},
 cocoa:{name:'Example location B',rent:1750,price:350000},
 viera:{name:'Example location C',rent:2250,price:450000},
 knoxville:{name:'Example location D',rent:1250,price:250000}
};
export function createHandoffPlan(){
 const p=clone(DEFAULT_PLAN);
 Object.assign(p,{returnUnit:'nominal',stockReturnMean:'arithmetic',retirementStockReturn:.05,retirementStockWeight:.6,allocationMode:'glide',bondYield:.03,cashReserveMode:'months',reserveMonths:3,cashReserveWorking:9000,retirementBudget:{enabled:true,annual:55000,dollarMode:'real',taxes:'included',healthcare:'included',minimumLiving:24000},taxYear2026:createTaxYear2026()});
 p.people.forEach(person=>Object.assign(person,{salaryBaseYear:2026,salaryGrowthUnit:'nominal',employee401kMode:'dollar',socialSecurityAnnual:0,socialSecurityStartYear:person.birthYear+67,promotions:[],rothBasisDocumented:false}));
 p.assumptions.push({id:HANDOFF_ID,confirmed:false,text:'Public demonstration starter. Every financial amount is an editable example or a zero placeholder. No account connection, historical personal snapshot, employer record or confirmed financial fact is included.'});
 p.assumptions.push({id:'retirement-budget',confirmed:false,text:'The example $55,000 annual retirement allowance uses 2026 purchasing power and includes housing, modeled taxes and healthcare. Coverage is unpriced until configured. The example living floor is $24,000; dated costs and protected-cost overruns can add to the target.'});
 return p;
}
export function applyHandoff(workspace){
 if(workspace.scenarios.some(s=>s.plan.assumptions?.some(a=>a.id===HANDOFF_ID)))return {workspace,changed:false};
 if(workspace.scenarios.length>=12)throw Error('Remove one backed-up scenario to make room for a demonstration copy.');
 const next=structuredClone(workspace);let id=HANDOFF_ID,n=1;while(next.scenarios.some(s=>s.id===id))id=`${HANDOFF_ID}-${n++}`;
 next.scenarios.push({id,plan:createHandoffPlan()});next.activeId=id;return {workspace:next,changed:true};
}
export function locationPlan(plan,city){
 const quote=LOCATION_INPUTS[city];if(!quote)throw Error('Unknown example location.');
 const p=clone(plan);p.name=`${quote.name} · rent comparison`;
 p.housing.jointRent=quote.rent;p.housing.price=quote.price;
 p.housing.moveYear=p.endYear+1;p.housing.tnRent=quote.rent;p.housing.movingCost=0;
 p.assumptions=p.assumptions.filter(a=>a.id!=='location-case');
 p.assumptions.push({id:'location-case',confirmed:false,text:`${quote.name}: fictional rent $${quote.rent}/month and purchase price $${quote.price}. These are demonstration estimates, not local market quotes. Current rent remains until the configured joint-rent year; this comparison assumes no later move.`});
 return p;
}
