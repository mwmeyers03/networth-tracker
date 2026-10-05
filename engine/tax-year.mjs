// A separate, editable 2026 reconciliation. Nothing here creates recurring FIRE income.
import {progressive} from './tax.mjs';
export const TAX_YEAR_RULES_DATE='2026-10-03';
export const TAX_YEAR_SOURCES=[
 ['2026 income tax and QBI parameters','https://www.irs.gov/irb/2025-45_IRB'],
 ['2026 estimated tax worksheets','https://www.irs.gov/publications/p505'],
 ['2026 retirement contribution limits','https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500'],
 ['Self-employment tax','https://www.irs.gov/taxtopics/tc554'],
 ['Additional Medicare Tax','https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax'],
 ['QBI deduction','https://www.irs.gov/newsroom/qualified-business-income-deduction'],
 ['Roth IRA worksheets','https://www.irs.gov/publications/p590a'],
 ['Business expenses','https://www.irs.gov/businesses/small-businesses-self-employed/deducting-business-expenses'],
 ['Work-related education','https://www.irs.gov/taxtopics/tc513'],
];
const labels=[['equipment','Computer / equipment'],['software','Business software'],['services','Professional services'],['phone','Business-use phone / internet'],['travel','Legitimate business mileage / travel'],['home-office','Eligible home office'],['supplies','Business supplies'],['education','Education for the existing business'],['other','Other ordinary and necessary business expenses']];
// Zero placeholders: no wages, payments, employer records or eligibility are prefilled.
// Legacy object keys remain stable so existing schema-1 imports still load.
export function createTaxYear2026(){return {
 schema:1,year:2026,filingStatus:'single',age:35,
 ngYtd:{gross:0,pretax401k:0,roth401k:0,federalWithholding:0},
 ngFinal:{netPaid:0,gross:null,grossEstimate:0,pretax401k:null,pretax401kEstimate:0,roth401k:0,federalWithholding:null,federalWithholdingEstimate:0},
 lockheed:{startDate:'2026-01-01',weeklyGross:0,regularPaychecks:0,contributionDelayWeeks:0,employee401kPercent:0,bonusGross:0,bonus401kEligible:false,pretax401k:null,roth401k:0,federalWithholding:null,federalWithholdingEstimate:0,payScheduleConfirmed:false},
 business:{grossReceipts:0,deductions:labels.map(([id,label])=>({id,label,amount:0,businessUse:1,eligibility:'unconfirmed',included:false})),qbiEligible:false,sstb:false,w2Wages:0,qualifiedPropertyBasis:0,priorQbiLoss:0,materiallyParticipates:false,qbiConfirmed:false},
 investment:{interest:0,ordinaryDividends:0,qualifiedDividends:0,shortTermGains:0,longTermGains:0,confirmed:false},
 adjustments:{selfEmployedHealthInsurance:0,selfEmployedRetirement:0,traditionalIra:0,other:0},
 payments:{estimated:0,otherWithholding:0},roth:{contributed:0,traditionalContributed:0},
};}
export const taxYearDefaults=createTaxYear2026;
export function validateTaxYear(input){
 const e=[],n=(v,min=0,max=1e9)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!input||typeof input!=='object'||Array.isArray(input)||input.schema!==1||input.year!==2026)return ['Only the 2026 reconciliation schema is supported.'];
 if(input.filingStatus!=='single')e.push('This current-year reconciliation supports a single filer; joint filing requires a spouse-specific tax model.');
 if(!Number.isInteger(input.age)||input.age<18||input.age>=65)e.push('This reconciliation supports an adult under age 65; age-based deductions are outside its scope.');
 for(const [key,fields] of [['ngYtd',['gross','pretax401k','roth401k','federalWithholding']],['ngFinal',['netPaid','grossEstimate','pretax401kEstimate','roth401k','federalWithholdingEstimate']],['lockheed',['weeklyGross','regularPaychecks','contributionDelayWeeks','employee401kPercent','bonusGross','roth401k','federalWithholdingEstimate']],['business',['grossReceipts','w2Wages','qualifiedPropertyBasis','priorQbiLoss']],['investment',['interest','ordinaryDividends','qualifiedDividends']],['adjustments',['selfEmployedHealthInsurance','selfEmployedRetirement','traditionalIra','other']],['payments',['estimated','otherWithholding']],['roth',['contributed','traditionalContributed']]]){
  if(!input[key]||typeof input[key]!=='object'||Array.isArray(input[key])){e.push(`Missing ${key} inputs.`);continue;}
  for(const field of fields)if(!n(input[key][field]))e.push(`${key}.${field} must be a nonnegative finite amount.`);
 }
 for(const [key,fields] of [['ngFinal',['gross','pretax401k','federalWithholding']],['lockheed',['pretax401k','federalWithholding']]])for(const field of fields)if(input[key]?.[field]!==null&&!n(input[key]?.[field]))e.push(`${key}.${field} must be null (unknown) or a nonnegative amount.`);
 for(const k of ['shortTermGains','longTermGains'])if(!n(input.investment?.[k],-1e9))e.push(`Invalid ${k}.`);
 const lm=input.lockheed;
 if(lm){if(!Number.isInteger(lm.regularPaychecks)||lm.regularPaychecks>53||!Number.isInteger(lm.contributionDelayWeeks)||lm.contributionDelayWeeks>53||lm.employee401kPercent>1)e.push('Invalid current-employer paycheck count, delay or contribution percentage.');if(typeof lm.bonus401kEligible!=='boolean')e.push('Bonus contribution setting must be boolean.');}
 const b=input.business;
 if(b){
  for(const k of ['qbiEligible','sstb'])if(typeof b[k]!=='boolean')e.push(`Invalid ${k} setting.`);
  for(const k of ['materiallyParticipates','qbiConfirmed'])if(b[k]!==undefined&&typeof b[k]!=='boolean')e.push(`Invalid ${k} setting.`);
  if(!Array.isArray(b.deductions)||b.deductions.length>100)e.push('Invalid business deduction list.');
  else{const ids=new Set();for(const d of b.deductions){if(!d||typeof d.id!=='string'||!d.id||ids.has(d.id)||typeof d.label!=='string'||d.label.length>300||!n(d.amount)||!n(d.businessUse,0,1)||!['unconfirmed','eligible','ineligible'].includes(d.eligibility)||typeof d.included!=='boolean')e.push('Deductions need a unique id, amount, business-use fraction and explicit eligibility.');if(d)ids.add(d.id);}}
 }
 return [...new Set(e)];
}
export const validateTaxYear2026=validateTaxYear;

// Ordinary and Medicare components are distinct. Employee deferrals do not reduce FICA wages.
export function selfEmploymentTax2026(profit,w2SocialSecurityWages=0,w2MedicareWages=w2SocialSecurityWages){
 const net=Math.max(0,profit)*.9235,taxable=net>=400?net:0;
 const socialSecurity=Math.min(taxable,Math.max(0,184500-w2SocialSecurityWages))*.124;
 const medicare=taxable*.029,seTax=socialSecurity+medicare;
 const additionalMedicare=.009*Math.max(0,w2MedicareWages+taxable-200000);
 return {netSelfEmployment:net,seSocialSecurity:socialSecurity,seMedicare:medicare,seTax,halfSeDeduction:seTax/2,additionalMedicare};
}

export function qbiDeduction2026({qbi,taxableIncomeBeforeQbi,netCapitalGain=0,sstb=false,w2Wages=0,qualifiedPropertyBasis=0,materiallyParticipates=true,eligible=true}){
 if(!eligible||qbi<=0)return {deduction:0,component:0,phase:0,applicablePercent:0,minimum:0};
 const phase=Math.max(0,Math.min(1,(taxableIncomeBeforeQbi-201750)/75000)),applicablePercent=sstb?1-phase:1;
 const adjusted=qbi*applicablePercent,wages=w2Wages*applicablePercent,property=qualifiedPropertyBasis*applicablePercent;
 const tentative=adjusted*.2,wageLimit=Math.max(wages*.5,wages*.25+property*.025);
 const component=Math.max(0,tentative-phase*Math.max(0,tentative-wageLimit));
 const incomeLimit=Math.max(0,taxableIncomeBeforeQbi-netCapitalGain)*.2;
 const minimum=materiallyParticipates&&adjusted>=1000?400:0;
 return {deduction:Math.max(minimum,Math.min(component,incomeLimit)),component,phase,applicablePercent,minimum};
}

export function rothLimit2026(magi,compensation,age=23,traditionalContributed=0){
 const annual=7500+(age>=50?1100:0),base=Math.min(annual,Math.max(0,compensation)),remaining=Math.max(0,base-traditionalContributed);
 if(magi>=168000||remaining<=0)return 0;
 if(magi<153000)return remaining;
 // Pub590-A permits at least three decimal places; full precision avoids early rounding.
 const reduced=base*(1-(magi-153000)/15000),rounded=Math.ceil((reduced-1e-8)/10)*10;
 return Math.min(remaining,Math.max(200,rounded));
}

function capitalTax2026(ordinaryTaxable,gains){
 const zero=Math.min(gains,Math.max(0,49450-ordinaryTaxable));
 const fifteen=Math.min(gains-zero,Math.max(0,545500-Math.max(49450,ordinaryTaxable)));
 const preferential=fifteen*.15+(gains-zero-fifteen)*.2;
 // Worksheet caps preferential computation at ordinary-rate tax on all taxable income.
 return Math.min(preferential,Math.max(0,progressive(ordinaryTaxable+gains)-progressive(ordinaryTaxable)));
}
function compute(input,scenario=false){
 const flags=[],ng=input.ngYtd,final=input.ngFinal,lm=input.lockheed,business=input.business,investment=input.investment,adjust=input.adjustments;
 const unknown=(row,key,label)=>{if(row[key]===null){flags.push(`${label} is unknown; estimate ${row[`${key}Estimate`]} is used.`);return row[`${key}Estimate`];}return row[key];};
 const finalGross=unknown(final,'gross','Final prior-employer gross pay'),finalPretax=unknown(final,'pretax401k','Final prior-employer pre-tax deferral'),finalWithholding=unknown(final,'federalWithholding','Final prior-employer federal withholding');
 const regular=lm.weeklyGross*lm.regularPaychecks,lockheedGross=regular+lm.bonusGross;
 const limit=24500+(input.age>=60&&input.age<=63?11250:input.age>=50?8000:0);
 const otherDeferrals=ng.pretax401k+finalPretax+ng.roth401k+final.roth401k+lm.roth401k;
 const lockheed401kRequested=Math.max(0,lm.regularPaychecks-lm.contributionDelayWeeks)*lm.weeklyGross*lm.employee401kPercent+(lm.bonus401kEligible?lm.bonusGross*lm.employee401kPercent:0);
 const lockheed401kApplied=lm.pretax401k===null?Math.min(lockheed401kRequested,Math.max(0,limit-otherDeferrals)):lm.pretax401k;
 if(lm.pretax401k===null)flags.push('current-employer deferrals are a capped payroll estimate; verify all actual paychecks and bonus treatment.');
 if(lm.payScheduleConfirmed!==true)flags.push('current-employer regular paycheck count and contribution delay are estimates; only 2026 paid checks belong here.');
 const lmWithholding=unknown(lm,'federalWithholding','current-employer federal withholding');
 const w2Rows=[
  {id:'ng-ytd',label:'Prior employer year-to-date pay',gross:ng.gross,pretax401k:ng.pretax401k,roth401k:ng.roth401k,federalWithholding:ng.federalWithholding,estimatedFields:[]},
  {id:'ng-final',label:'Prior employer final pay',gross:finalGross,pretax401k:finalPretax,roth401k:final.roth401k,federalWithholding:finalWithholding,estimatedFields:['gross','pretax401k','federalWithholding'].filter(k=>final[k]===null)},
  {id:'lockheed',label:'current-employer regular pay + signing bonus',gross:lockheedGross,pretax401k:lockheed401kApplied,roth401k:lm.roth401k,federalWithholding:lmWithholding,estimatedFields:[...(lm.pretax401k===null?['pretax401k']:[]),...(lm.federalWithholding===null?['federalWithholding']:[]),...(lm.payScheduleConfirmed!==true?['gross']:[])]},
 ];
 w2Rows.forEach(r=>{r.taxableW2=Math.max(0,r.gross-r.pretax401k);if(r.pretax401k+r.roth401k>r.gross)flags.push(`${r.label}: deferrals exceed gross pay; correct the payroll inputs.`);});
 const grossW2=w2Rows.reduce((s,r)=>s+r.gross,0),taxableW2=w2Rows.reduce((s,r)=>s+r.taxableW2,0),total401k=w2Rows.reduce((s,r)=>s+r.pretax401k+r.roth401k,0),excess401k=Math.max(0,total401k-limit);
 if(excess401k>0)flags.push('Reported employee deferrals exceed the combined annual limit. Corrective distribution and its tax treatment are not modeled; exact actuals were preserved.');
 const expense=d=>d.included&&d.eligibility==='eligible'?d.amount*d.businessUse:0;
 const businessDeductions=business.deductions.reduce((s,d)=>s+expense(d),0),scheduleCProfit=business.grossReceipts-businessDeductions;
 for(const d of business.deductions)if(d.included&&d.amount>0&&d.eligibility!=='eligible')flags.push(`${d.label}: unverified/ineligible expense is excluded from the calculation.`);
 if(scheduleCProfit<0)flags.push('Business loss: basis/at-risk/passive/excess-loss limits and future QBI-loss carryforwards require review.');
 const se=selfEmploymentTax2026(scheduleCProfit,grossW2,grossW2);
 const st=investment.shortTermGains,lt=investment.longTermGains;
 const ordinaryGains=Math.max(0,st+Math.min(0,lt)),longGains=Math.max(0,lt+Math.min(0,st)),capitalLoss=Math.min(3000,Math.max(0,-st-lt));
 const preferred=longGains+investment.qualifiedDividends;
 const ordinaryInvestments=investment.interest+investment.ordinaryDividends+ordinaryGains-capitalLoss;
 const aboveLine=se.halfSeDeduction+adjust.selfEmployedHealthInsurance+adjust.selfEmployedRetirement+adjust.traditionalIra+adjust.other;
 const ordinaryAgi=taxableW2+scheduleCProfit+ordinaryInvestments-aboveLine,agi=ordinaryAgi+preferred;
 // QBI is below AGI, so it cannot be used to create Roth eligibility.
 const magi=agi+adjust.traditionalIra;
 const taxableIncomeBeforeQbi=Math.max(0,agi-16100);
 const qbiIncome=scheduleCProfit-se.halfSeDeduction-adjust.selfEmployedHealthInsurance-adjust.selfEmployedRetirement-business.priorQbiLoss;
 const qbi=qbiDeduction2026({qbi:qbiIncome,taxableIncomeBeforeQbi,netCapitalGain:preferred,sstb:business.sstb,w2Wages:business.w2Wages,qualifiedPropertyBasis:business.qualifiedPropertyBasis,materiallyParticipates:business.materiallyParticipates!==false,eligible:business.qbiEligible});
 const qbiDeduction=qbi.deduction,taxableIncome=Math.max(0,taxableIncomeBeforeQbi-qbiDeduction);
 const taxablePreferred=Math.min(preferred,taxableIncome),ordinaryTaxable=taxableIncome-taxablePreferred;
 const ordinaryTax=progressive(ordinaryTaxable),capitalTax=capitalTax2026(ordinaryTaxable,taxablePreferred);
 const netInvestmentIncome=Math.max(0,ordinaryInvestments+preferred),niit=.038*Math.min(netInvestmentIncome,Math.max(0,agi-200000));
 const incomeTax=ordinaryTax+capitalTax,federalTotal=incomeTax+se.seTax+se.additionalMedicare+niit;
 const totalWithholding=w2Rows.reduce((s,r)=>s+r.federalWithholding,0)+input.payments.otherWithholding,estimatedPayments=input.payments.estimated,totalPayments=totalWithholding+estimatedPayments;
 const balance= federalTotal-totalPayments,balanceDue=Math.max(0,balance),refund=Math.max(0,-balance);
 const compensation=Math.max(0,taxableW2+Math.max(0,scheduleCProfit)-se.halfSeDeduction-adjust.selfEmployedRetirement);
 const rothLimit=rothLimit2026(magi,compensation,input.age,input.roth.traditionalContributed),rothExcess=Math.max(0,input.roth.contributed-rothLimit);
 if(investment.confirmed!==true)flags.push('Investment income defaults to zero pending 1099-INT/1099-DIV/1099-B; missing income can change tax and Roth eligibility.');
 if(business.qbiConfirmed!==true)flags.push('Business/QBI classification and material participation are assumptions, not a verified deduction determination.');
 if(adjust.selfEmployedHealthInsurance+adjust.selfEmployedRetirement+adjust.traditionalIra+adjust.other>0)flags.push('Entered above-the-line deductions require separate eligibility and contribution-limit verification.');
 if(agi>200000)flags.push('Higher-income result: AMT, credits, investment-income attribution and deduction interactions need review.');
 if(grossW2>184500)flags.push('Multiple-employer excess Social Security withholding credit is not included; reconcile W-2 boxes 3 and 4.');
 if(rothExcess>0)flags.push('Modeled Roth contribution exceeds the reduced limit; corrective earnings/distribution and excise tax are outside this estimate.');
 const result={year:2026,provisional:flags.length>0,flags,grossW2,taxableW2,total401k,remaining401k:Math.max(0,limit-total401k),excess401k,limit401k:limit,lockheed401kRequested,lockheed401kApplied,w2Rows,businessDeductions,scheduleCProfit,...se,ordinaryAgi,agi,magi,qbiIncome,qbiDeduction,qbiDetail:qbi,taxableIncomeBeforeQbi,taxableIncome,ordinaryTax,capitalTax,niit,incomeTax,federalTotal,totalWithholding,estimatedPayments,totalPayments,balanceDue,refund,rothLimit,rothExcess,rothEligible:rothLimit>0,capitalLossDeduction:capitalLoss,scenarioImpacts:[]};
 if(!scenario)result.scenarioImpacts=business.deductions.map(d=>{
  if(d.eligibility!=='eligible')return {id:d.id,label:d.label,deduction:0,taxSaving:0,balanceDue,refund,magi,eligibility:d.eligibility,flag:'No savings assumed until this expense is eligible and documented.'};
  const without=structuredClone(input),withExpense=structuredClone(input);
  without.business.deductions.find(x=>x.id===d.id).included=false;
  withExpense.business.deductions.find(x=>x.id===d.id).included=true;
  const a=compute(without,true),b=compute(withExpense,true);
  return {id:d.id,label:d.label,deduction:d.amount*d.businessUse,taxSaving:a.federalTotal-b.federalTotal,balanceDue:b.balanceDue,refund:b.refund,magi:b.magi,eligibility:d.eligibility,flag:'Expense eligibility is your verified input; savings do not make an expense deductible.'};
 });
 return result;
}
export function calculateTaxYear(input=createTaxYear2026()){
 const errors=validateTaxYear(input);if(errors.length)throw new Error(errors.join('\n'));
 return compute(input);
}
