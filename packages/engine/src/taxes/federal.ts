// 2026 IRS Rev. Proc. 2025-32; later years use explicit planning indexation, not enacted future law.
export function progressive(income:number, joint=false, index=1) {
 const limits=(joint?[24800,100800,211400,403550,512450,768700]:[12400,50400,105700,201775,256225,640600]).map(v=>v*index);
 const rates=[.1,.12,.22,.24,.32,.35,.37]; let tax=0,lower=0;
 for(let i=0;i<7;i++){const upper=limits[i]??Infinity;tax+=Math.max(0,Math.min(income,upper)-lower)*rates[i];lower=upper;}
 return tax;
}
export function federal(ordinary:number,gains=0,joint=false,index=1,investmentIncome=gains) {
 const deduction=(joint?32200:16100)*index;
 const ordinaryTaxable=Math.max(0,ordinary-deduction);
 const gainTaxable=Math.max(0,gains-Math.max(0,deduction-ordinary));
 const zero=(joint?98900:49450)*index, fifteen=(joint?613700:545500)*index;
 const zeroPart=Math.min(gainTaxable,Math.max(0,zero-ordinaryTaxable));
 const fifteenPart=Math.min(gainTaxable-zeroPart,Math.max(0,fifteen-Math.max(zero,ordinaryTaxable)));
 const capital=fifteenPart*.15+(gainTaxable-zeroPart-fifteenPart)*.2;
 const niit=.038*Math.min(Math.max(0,investmentIncome),Math.max(0,ordinary+gains-(joint?250000:200000)));
 return {ordinaryTax:progressive(ordinaryTaxable,joint,index),capitalTax:capital,niit,total:progressive(ordinaryTaxable,joint,index)+capital+niit,magi:ordinary+gains};
}
export function payroll(wages:number[],joint=false,index=1) {
 const total=wages.reduce((a,b)=>a+b,0);
 const base=wages.reduce((s,w)=>s+Math.min(w,184500*index)*.062+w*.0145,0);
 return base+Math.max(0,total-(joint?250000:200000))*.009;
}
export function contributionLimits(age:number,index=1){return {k:(24500+(age>=60&&age<=63?11250:age>=50?8000:0))*index,ira:(7500+(age>=50?1100:0))*index};}
export function rothAllowed(magi:number,joint:boolean,index:number){const low=(joint?242000:153000)*index,range=(joint?10000:15000)*index;return Math.max(0,Math.min(1,1-(magi-low)/range));}

// IRS Publication 915 Worksheet 1, for single or married-filing-jointly households.
// Thresholds are statutory nominal dollars; do not inflation-index them.
export function taxableSocialSecurity(benefits:number,otherIncome:number,joint=false,taxExemptInterest=0){
 const amount=Math.max(0,benefits),provisional=otherIncome+taxExemptInterest+amount*.5;
 const lower=joint?32000:25000,upper=joint?44000:34000;
 if(provisional<=lower)return 0;
 if(provisional<=upper)return Math.min(amount*.5,(provisional-lower)*.5);
 return Math.min(amount*.85,(provisional-upper)*.85+Math.min(amount*.5,(upper-lower)*.5));
}
