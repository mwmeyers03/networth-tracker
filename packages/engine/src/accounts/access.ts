import type {Account,Person} from '../types/index.js';
/** Annual adapter uses the first full year after59½; a monthly engine may use exact dates. */
export function fullYearAccess(person:Pick<Person,'birthDate'> & {birthYear:number}):number {
 if(!person.birthDate)return person.birthYear+60;
 const [y,m,d]=person.birthDate.split('-').map(Number);
 return y+(m<=6||m===7&&d===1?60:61);
}
export function accessibleAccounts(account:Account,year:number,accessYear:number,rothOpenYear:number){
 const unrestricted=year>=accessYear,qualified=unrestricted&&year-rothOpenYear>=5;
 const contributionBasis=Math.min(account.roth,account.rothContributionBasis);
 let left=Math.max(0,account.roth-contributionBasis),seasoned=0,locked=0;
 for(const lot of [...account.conversionLots].sort((a,b)=>a.taxYear-b.taxYear)){const amount=Math.min(left,lot.principal);left-=amount;if(unrestricted||year>=lot.taxYear+5)seasoned+=amount;else locked+=amount;}
 const rothAccessible=qualified?account.roth:contributionBasis+seasoned;
 return {contributionBasis,seasoned,locked,earnings:left,rothAccessible,total:account.cash+account.taxable+rothAccessible+(unrestricted?account.preTax:0)};
}
