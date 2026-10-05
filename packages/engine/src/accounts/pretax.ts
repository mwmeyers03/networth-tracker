import {fullYearAccess} from './access.js';

/** Tracked sources partition the vested traditional total; they never add assets. */
export interface PretaxSource {id:string;kind:'traditional_ira'|'former_employer';openingBalance:number;verified:boolean;separationYear?:number;rule55Verified?:boolean}
export interface PretaxSourceBalance extends PretaxSource {balance:number}
export interface PretaxAccount {traditional:number;unvested?:number;pretaxSources?:PretaxSourceBalance[];legacyIraBalance?:number}
export interface PretaxPerson {birthYear:number;birthDate?:string;retireYear:number;pretaxEarlyAccess?:'ira'|'after_separation'|'unavailable';penaltyExceptions?:{traditionalDisabilityVerified?:boolean;rothDisabilityVerified?:boolean;currentPlanRule55Verified?:boolean}}
interface Part {source:PretaxSourceBalance|null;amount:number;penaltyFree:boolean;legacyIra?:boolean}

function parts(a:PretaxAccount,p:PretaxPerson,year:number):Part[]{
 const ageAccess=year>=fullYearAccess(p),disability=p.penaltyExceptions?.traditionalDisabilityVerified===true;
 const sources=a.pretaxSources??[],vested=Math.max(0,a.traditional-(a.unvested??0));
 const result:Part[]=[];let remaining=vested;
 for(const source of sources){
  const amount=Math.min(remaining,Math.max(0,source.balance));remaining-=amount;
  const permitted=ageAccess||source.verified&&(source.kind==='traditional_ira'||source.separationYear!==undefined&&year>=source.separationYear);
  const rule55=source.kind==='former_employer'&&source.rule55Verified===true&&source.separationYear!==undefined&&source.separationYear>=p.birthYear+55&&year>=source.separationYear;
  if(permitted)result.push({source,amount,penaltyFree:ageAccess||disability||rule55});
 }
 if(a.legacyIraBalance!==undefined){const amount=Math.min(remaining,Math.max(0,a.legacyIraBalance));remaining-=amount;result.push({source:null,legacyIra:true,amount,penaltyFree:ageAccess||disability});}
 const generalAccess=ageAccess||p.pretaxEarlyAccess==='ira'&&a.legacyIraBalance===undefined||p.pretaxEarlyAccess!=='unavailable'&&year>=p.retireYear;
 const rule55=p.pretaxEarlyAccess!=='ira'&&p.penaltyExceptions?.currentPlanRule55Verified===true&&p.retireYear>=p.birthYear+55&&year>=p.retireYear;
 if(generalAccess)result.push({source:null,amount:remaining,penaltyFree:ageAccess||disability||rule55});
 return result;
}

export function availablePretax(a:PretaxAccount,p:PretaxPerson,year:number,allowPenalties=true):number{
 return parts(a,p,year).reduce((v,part)=>v+(allowPenalties||part.penaltyFree?part.amount:0),0);
}

/** Penalty-free sources precede penalty-bearing sources; conversion itself is not an early distribution. */
export function consumePretax(a:PretaxAccount,p:PretaxPerson,year:number,requested:number,{allowPenalties=true,conversion=false}:{allowPenalties?:boolean;conversion?:boolean}={}):{amount:number;penaltyBase:number}{
 let left=Math.max(0,requested),penaltyBase=0,amount=0;
 const eligible=parts(a,p,year).filter(x=>conversion||allowPenalties||x.penaltyFree).sort((x,y)=>Number(y.penaltyFree)-Number(x.penaltyFree));
 for(const part of eligible){const take=Math.min(left,part.amount);if(part.source)part.source.balance=Math.max(0,part.source.balance-take);if(part.legacyIra)a.legacyIraBalance=Math.max(0,(a.legacyIraBalance??0)-take);a.traditional-=take;left-=take;amount+=take;if(!part.penaltyFree&&!conversion)penaltyBase+=take;}
 return {amount,penaltyBase};
}

/** Keep partitioned sources consistent when an aggregate balance is explicitly overridden. */
export function constrainPretaxSources(a:PretaxAccount):void{
 const sources=a.pretaxSources??[],tracked=sources.reduce((v,s)=>v+s.balance,0)+(a.legacyIraBalance??0),vested=Math.max(0,a.traditional-(a.unvested??0));
 if(tracked>vested&&tracked>0){for(const s of sources)s.balance*=vested/tracked;if(a.legacyIraBalance!==undefined)a.legacyIraBalance*=vested/tracked;}
}
