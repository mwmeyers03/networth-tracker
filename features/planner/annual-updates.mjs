import {clone,validate} from '../../engine/plan.mjs';
import {planChecks} from './plan-checks.mjs';
export const UPDATE_FORMAT='snooks.annual-updates.v1';
export function updateFields(plan){
 return [
  ...plan.people.flatMap(person=>[['Salary','Gross salary'],['Bonus','One-time gross bonus'],['Income','Other ordinary income'],['401k','Employee 401(k) request'],['Roth','Roth contribution request'],['Brokerage','Taxable contribution request'],['Savings','Fixed total savings request']].map(([suffix,label])=>({key:`${person.id}${suffix}`,label:`${person.name} · ${label}`}))),
  ...(plan.retirementBudget?.enabled?[{key:'retirementBudget',label:'Household · recurring retirement budget'}]:[]),
  {key:'conversion',label:'Household · Roth conversion request'},
  ...plan.expenses.map(expense=>({key:`expense_${expense.id}`,label:`Expense · ${expense.name}`}))
 ];
}
export function updateTemplate(plan,scenarioId){return {format:UPDATE_FORMAT,scenarioId,baseYear:plan.baseYear,dollarMode:'base_year',name:`${plan.name.slice(0,85)} · annual updates`,updates:[]};}
export function automationBriefing(plan,scenarioId,generatedAt){return {format:'snooks.assistant-briefing.v1',generatedAt,scenarioId,planInputs:clone(plan),reviewItems:planChecks(plan),allowedFields:updateFields(plan),updateTemplate:updateTemplate(plan,scenarioId),instructions:[
 'Return only an annual-update JSON file matching updateTemplate. Populate updates with {year,key,operation:"set",amount} or {year,key,operation:"clear"}.',
 'Use only allowedFields. Keep scenarioId and baseYear unchanged. Include 1–200 unique year/field pairs within the forecast.',
 'Declare base_year for purchasing-power quotes or nominal for baseline calendar-year quotes. The importer preserves native field units: indexed expense overrides remain base-year inputs, other overrides are nominal. Inflation stress paths follow those native rules.',
 'Do not alter balances, tax basis, access permissions, return assumptions or evidence status. Those need explicit review.',
 'Keep existing overrides unless the user asks to replace or clear them. Do not invent facts to improve success.',
 'The user imports your file, previews its effects and creates a separate scenario. Nothing in this export is a live account feed.'
 ]};}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));
export function previewAnnualUpdates(plan,scenarioId,input){
 const errors=validate(plan);if(errors.length)throw Error('Fix the current plan before staging updates.');
 if(!record(input)||!keys(input,['format','scenarioId','baseYear','dollarMode','name','updates'])||input.format!==UPDATE_FORMAT)throw Error('Use a Snooks annual-update file with the supported format.');
 if(input.scenarioId!==scenarioId)throw Error('This file targets a different scenario. Download a template for the active scenario.');
 if(input.baseYear!==plan.baseYear)throw Error('Purchasing-power years do not match. Update the template rather than mixing dollar years.');
 if(!['base_year','nominal'].includes(input.dollarMode))throw Error('Choose base_year or nominal dollarMode.');
 if(input.name!==undefined&&(typeof input.name!=='string'||!input.name.trim()||input.name.length>120))throw Error('Choose a scenario name of 1–120 characters.');
 if(!Array.isArray(input.updates)||!input.updates.length||input.updates.length>200)throw Error('Include 1–200 annual updates.');
 const fields=new Map(updateFields(plan).map(field=>[field.key,field.label])),seen=new Set(),candidate=clone(plan),changes=[],warnings=[];
 for(const update of input.updates){
  if(!record(update)||!keys(update,['year','key','operation','amount'])||!Number.isInteger(update.year)||update.year<plan.startYear||update.year>plan.endYear||!fields.has(update.key)||!['set','clear'].includes(update.operation))throw Error('Each update needs an in-forecast year, supported field and set/clear operation.');
  const identity=`${update.year}:${update.key}`;if(seen.has(identity))throw Error(`Duplicate update for ${identity}.`);seen.add(identity);
  if(update.operation==='clear'&&update.amount!==undefined)throw Error('A clear operation must not include an amount.');
  if(update.operation==='set'&&(!Number.isFinite(update.amount)||update.amount<0||update.amount>1000000000))throw Error('Amounts must be nonnegative numbers up to $1 billion. Zero is allowed.');
  const previous=candidate.overrides[update.year]?.[update.key];
  const expense=plan.expenses.find(expense=>`expense_${expense.id}`===update.key);
  const index=(1+plan.inflation)**(update.year-plan.baseYear),storageScale=expense?.inflate?index:1;
  // Legacy indexed expense overrides are base-year amounts. All other allowed
  // overrides are nominal. Preserve that convention rather than inflating twice.
  const amount=update.operation==='set'?update.amount*(input.dollarMode==='base_year'?index:1)/storageScale:undefined;
  if(amount!==undefined){candidate.overrides[update.year]??={};candidate.overrides[update.year][update.key]=amount;}
  else if(candidate.overrides[update.year]){delete candidate.overrides[update.year][update.key];if(!Object.keys(candidate.overrides[update.year]).length)delete candidate.overrides[update.year];}
  changes.push({year:update.year,key:update.key,label:fields.get(update.key),previous:previous===undefined?null:previous*storageScale,next:amount===undefined?null:amount*storageScale,storedPrevious:previous??null,storedNext:amount??null,changed:previous!==amount});
  const person=plan.people.find(person=>update.key===`${person.id}Salary`);
  if(person&&update.operation==='set'&&update.amount>0&&(update.year<person.workStart||update.year>=person.retireYear))warnings.push(`${update.year}: this explicit salary override creates wages outside ${person.name}'s regular career dates. Clear it or set zero to preserve the no-work assumption for that year.`);
  if(plan.people.some(person=>update.key===`${person.id}Income`))warnings.push(`${update.year}: other income is modeled as ordinary income; this forward engine does not calculate self-employment tax for it. Use the current-year tax sandbox for Schedule C.`);
  if(expense&&update.operation==='set'&&(update.year<expense.start||update.year>expense.end))warnings.push(`${update.year}: ${expense.name} is outside its active dates; this override does not extend them.`);
  if(expense&&plan.retirementBudget?.enabled&&(expense.phase==='retirement'||expense.id==='retire'))warnings.push(`${expense.name} is replaced by the enabled retirement envelope in retirement; update the recurring retirement budget instead.`);
  if(update.key==='retirementBudget'&&update.year<Math.min(...plan.people.map(person=>person.retireYear)))warnings.push(`${update.year}: the retirement envelope is not yet active.`);
  if(update.key==='retirementBudget'&&plan.overrides[update.year]?.spending!==undefined)warnings.push(`${update.year}: the existing total-spending override bypasses the retirement envelope.`);
 }
 candidate.name=input.name?.trim()??`${plan.name.slice(0,85)} · annual updates`;
 const finalErrors=validate(candidate);if(finalErrors.length)throw Error(finalErrors.join(' '));
 if(!changes.some(change=>change.changed))throw Error('These updates do not change any annual inputs.');
 return {candidate,changes,warnings:[...new Set(warnings)],input:clone(input)};
}
