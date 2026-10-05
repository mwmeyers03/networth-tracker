import snapshot from '../lib/finance-snapshot.json' with {type:'json'};
import {clone} from './plan.mjs';
import {budgetDefaults} from './budget.mjs';
export {snapshot};
export function financeDraft(plan,{balances=false}={}){
 const p=clone(plan);
 const target=p.retirementBudget?.annual??55000*(1+p.inflation)**(p.baseYear-snapshot.baseYear);
 p.name='Editable budget review copy';
 p.retirementBudget={...budgetDefaults(),...p.retirementBudget,enabled:true,annual:target};
 p.assumptions=p.assumptions.filter(x=>!['budget','finance-snapshot'].includes(x.id));
 p.assumptions.push({id:'budget',status:'estimate',confirmed:false,source:'Editable demonstration or imported scenario',text:'Review the recurring household allowance, dollar basis, tax/healthcare inclusion and minimum living costs. Calendar expenses, moving and home-purchase cash can be additional. This copy does not certify coverage or account data.'});
 if(balances)p.assumptions.push({id:'finance-snapshot',status:'estimate',confirmed:false,source:'No account snapshot supplied',text:'No connected account snapshot is bundled. Existing balances and basis are preserved; enter dated statement values or import a private workspace. Zero template values are not actual account balances.'});
 return p;
}
