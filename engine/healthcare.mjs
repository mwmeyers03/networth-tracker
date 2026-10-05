// Published 2026/2027 ACA parameters. Future years freeze 2027 percentages;
// poverty guidelines, quotes and Medicare amounts follow explicit growth inputs.
export const HEALTH_RULES_DATE='2026-10-02';
export const HEALTH_SOURCES=[['Dependent coverage','https://www.healthcare.gov/young-adults/children-under-26/'],['2027 ACA percentages','https://www.irs.gov/irb/2026-31_irb'],['2026 ACA percentages','https://www.irs.gov/irb/2025-32_IRB'],['Premium tax credit','https://www.irs.gov/instructions/i8962'],['2026 Medicare','https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles']];
export function povertyLevel(year,size,growth=.025){const base=year<=2026?15650+5500*(size-1):15960+5680*(size-1);return base*(1+growth)**Math.max(0,year-2027);}
export function applicablePercentage(ratio,year){
 if(ratio<1||ratio>4)return null;
 const bands=year<=2026?[[1,1.33,.021,.021],[1.33,1.5,.0314,.0419],[1.5,2,.0419,.066],[2,2.5,.066,.0844],[2.5,3,.0844,.0996],[3,4,.0996,.0996]]:[[1,1.33,.0215,.0215],[1.33,1.5,.0323,.043],[1.5,2,.043,.0678],[2,2.5,.0678,.0866],[2.5,3,.0866,.1022],[3,4,.1022,.1022]];
 const [lo,hi,a,b]=bands.find(x=>ratio<x[1])??bands.at(-1);return a+(b-a)*(ratio-lo)/(hi-lo);
}
export function premiumCredit({year,magi,size=2,actual,benchmark,months=12,eligible=true,fplGrowth=.025}){
 const fpl=povertyLevel(year,size,fplGrowth),ratio=magi/fpl,pct=applicablePercentage(ratio,year);
 const expected=pct===null?0:Math.max(0,magi*pct);
 const credit=eligible&&pct!==null?Math.min(actual*months,Math.max(0,benchmark-expected/12)*months):0;
 return {credit,net:actual*months-credit,fpl,ratio,expected,pct};
}
export function medicarePremium({year,magi,joint=false,growth=.025}){
 const index=(1+growth)**Math.max(0,year-2026),thresholds=(joint?[218000,274000,342000,410000,750000]:[109000,137000,171000,205000,500000]).map(v=>v*index);
 let tier=0;for(let i=0;i<thresholds.length;i++)if(i===4?magi>=thresholds[i]:magi>thresholds[i])tier=i+1;
 return {partB:[202.9,284.1,405.8,527.5,649.2,689.9][tier]*index,partDSurcharge:[0,14.5,37.5,60.4,83.3,91][tier]*index,tier};
}
export function healthDefaults(plan){return {enabled:false,premiumGrowth:.04,fplGrowth:.025,medicareGrowth:.025,replacedExpenseIds:[],people:plan.people.map(p=>({id:p.id,parentType:'employer',parentAnnual:0,employerAnnual:0,marketplaceMonthly:0,benchmarkMonthly:0,outOfPocketAnnual:0,eligibility:'unknown',partDMonthly:0,supplementMonthly:0,partAMonthly:0,coverageOverrides:[]}))};}
export function coverageMonths(person,input,year){
 const explicit=(input.coverageOverrides??[]).find(x=>x.year===year);
 if(explicit)return explicit.months;
 const age=year-person.birthYear;
 if(age<26)return {parent:12};
 if(age===26&&person.birthDate){const month=Number(person.birthDate.slice(5,7)),parent=input.parentType==='marketplace'?12:month-1;return {parent,[year<person.retireYear&&year>=person.workStart?'employer':'marketplace']:12-parent};}
 if(age===64&&person.birthDate?.slice(5)==='01-01')return {[year<person.retireYear&&year>=person.workStart?'employer':'marketplace']:11,medicare:1};
 if(age<65)return {[year<person.retireYear&&year>=person.workStart?'employer':'marketplace']:12};
 if(age===65&&person.birthDate){const month=Math.max(1,Number(person.birthDate.slice(5,7))-(person.birthDate.slice(8,10)==='01'?1:0));return {[year<person.retireYear&&year>=person.workStart?'employer':'marketplace']:month-1,medicare:13-month};}
 return {medicare:12};
}
export function healthcareAt(plan,year,tax,history=[]){
 const config=plan.healthcare??healthDefaults(plan),flags=[],people=[];
 if(!config.enabled)return {cost:0,credit:0,people:[],flags:['Separate healthcare model is off; coverage prices and any healthcare bundled into living costs remain unverified.'],enabled:false};
 const growth=(1+config.premiumGrowth)**(year-plan.baseYear),joint=year>=plan.jointYear;
 const groups=new Map();
 plan.people.forEach((person,i)=>{
  const input=config.people[i],months=coverageMonths(person,input,year),age=year-person.birthYear;
  if(!person.birthDate&&(age===26||age===65))flags.push(`${person.name}: birth date missing; full-year ${age===26?'post-parental coverage':'Medicare'} is an approximation. Override transition months.`);
  if(Object.values(months).reduce((a,b)=>a+b,0)<12)flags.push(`${person.name}: some coverage months are missing.`);
  if((person.careerBreaks??[]).some(b=>year>=b.start&&year<=b.end))flags.push(`${person.name}: employer benefits during a career break are unverified; edit coverage months.`);
  const row={id:person.id,name:person.name,months,cost:0,credit:0,irmaaTier:null,lookbackYear:year-2};
  row.cost+=(months.parent??0)*input.parentAnnual/12*growth+(months.employer??0)*input.employerAnnual/12*growth;
  // Quotes are additional household costs, in base-year dollars. OOP is annual.
  row.cost+=input.outOfPocketAnnual*growth;
  const marketplace=months.marketplace??0;
  if(marketplace){
   if(input.marketplaceMonthly===0||input.benchmarkMonthly===0)flags.push(`${person.name}: Marketplace premium or benchmark quote missing; zero is not a quote.`);
   if(input.eligibility==='unknown')flags.push(`${person.name}: ACA eligibility unconfirmed; no credit assumed.`);
   const key=joint?'joint':person.id;
   if(!groups.has(key))groups.set(key,[]);const start=(months.parent??0)+(months.employer??0);groups.get(key).push({i,start,months:marketplace,actual:input.marketplaceMonthly*growth,benchmark:input.benchmarkMonthly*growth,eligible:input.eligibility==='eligible'});
  }
  if(months.medicare){
   const prior=history.find(r=>r.year===year-2),manual=config.lookback?.[year-2];
   const lookback=manual??(prior?{magi:prior.federalAgi,byPerson:prior.agiByPerson,joint:prior.joint}:null);
   if(!lookback)flags.push(`${person.name}: ${year-2} IRMAA income missing; base premium used.`);
   const oldJoint=lookback?.joint??joint,oldMagi=oldJoint?(lookback?.magi??0):(lookback?.byPerson?.[i]??0);
   const premium=medicarePremium({year,magi:oldMagi,joint:oldJoint,growth:config.medicareGrowth});row.irmaaTier=premium.tier;
   row.cost+=months.medicare*(premium.partB+premium.partDSurcharge+(input.partDMonthly+input.supplementMonthly+input.partAMonthly)*growth);
   if(input.partDMonthly===0&&input.supplementMonthly===0)flags.push(`${person.name}: Part D and supplemental/Advantage quotes missing. Premium-free Part A must be verified.`);
  }
  if(months.uninsured)flags.push(`${person.name}: ${months.uninsured} uninsured months; enter out-of-pocket exposure.`);
  people.push(row);
 });
 // Annual contribution is monthly; aggregate eligible premiums for each month.
 // Counts follow chronological parent → employer → Marketplace → Medicare.
 // Other orderings need exact monthly modeling outside this annual planner.
 for(const [key,members] of groups){
  const magi=key==='joint'?tax.magi:tax.magiByPerson[members[0].i];
  for(let m=0;m<12;m++){
   const active=members.filter(x=>m>=x.start&&m<x.start+x.months),eligible=active.filter(x=>x.eligible),actual=eligible.reduce((v,x)=>v+x.actual,0),benchmark=eligible.reduce((v,x)=>v+x.benchmark,0);
   const credit=premiumCredit({year,magi,size:key==='joint'?2:1,actual,benchmark,months:1,eligible:eligible.length>0,fplGrowth:config.fplGrowth}).credit;
   for(const member of active){const share=member.eligible&&actual>0?credit*member.actual/actual:0;people[member.i].cost+=member.actual-share;people[member.i].credit+=share;}
  }
 }
 if(year>2027)flags.push('ACA percentages use published 2027 policy; later legislation is unknown.');
 if(year>2026&&people.some(p=>p.months.medicare))flags.push('Medicare uses 2026 premium/IRMAA policy with explicit indexation.');
 return {cost:people.reduce((v,p)=>v+p.cost,0),credit:people.reduce((v,p)=>v+p.credit,0),people,flags:[...new Set(flags)],enabled:true,ruleYear:year<=2026?2026:2027,rulesAsOf:HEALTH_RULES_DATE};
}
