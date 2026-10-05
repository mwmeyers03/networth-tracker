export function salaryAt(person,year,override,{inflation=0,inflationByYear={}}={}){
 if(override!==undefined)return override;
 if(year<person.workStart||year>=person.retireYear)return 0;
 let salary=person.salary,quote=person.salaryBaseYear??Math.max(person.workStart,person.forecastStart??person.workStart);
 const growth=(from,to)=>{
  let factor=(1+person.salaryGrowth)**(to-from);
  if(person.salaryGrowthUnit==='real'){
   for(let y=Math.min(from,to)+1;y<=Math.max(from,to);y++)factor*=Math.pow(1+(inflationByYear[y]??inflation),to>=from?1:-1);
  }
  return factor;
 };
 for(const promotion of [...(person.promotions??[])].sort((a,b)=>a.year-b.year))if(promotion.year<=year){
  salary=promotion.salary!==undefined?promotion.salary:salary*growth(quote,promotion.year)*(1+(promotion.percent??0));
  quote=promotion.year;
 }
 const fraction=(person.careerBreaks??[]).filter(b=>year>=b.start&&year<=b.end).reduce((v,b)=>v*b.payFraction,1);
 return salary*growth(quote,year)*fraction;
}
export function employerContribution(wages,employee,person,index=1){
 const rate=person.matchImmediate+person.matchGraded;
 const requested=Math.min(wages,360000*index)*rate;
 const baseEmployee=Math.min(employee,24500*index); // Catch-up is outside §415(c).
 const amount=Math.max(0,Math.min(requested,Math.min(wages,72000*index)-baseEmployee));
 return {amount,graded:rate>0?amount*person.matchGraded/rate:0};
}
