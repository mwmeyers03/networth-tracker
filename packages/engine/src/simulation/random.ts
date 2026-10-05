/** Pure deterministic random source; no UI dependencies or global random state. */
export function seeded(seed:number):()=>number {let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)|0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
export function quantile(values:number[],q:number):number {if(!values.length||q<0||q>1)throw new Error('Invalid quantile.');const sorted=[...values].sort((a,b)=>a-b),x=(sorted.length-1)*q,i=Math.floor(x);return sorted[i]+(sorted[Math.ceil(x)]-sorted[i])*(x-i);}
