export function mortgagePayment(principal,rate,years){const r=rate/12,n=years*12;return r===0?principal/n:principal*r/(1-(1+r)**-n);}
export function housingSchedule(plan,returns=null){
 const h=plan.housing;let home=0,debt=0,payment=0;const rows=[];let priceIndex=(1+plan.inflation)**(plan.startYear-plan.baseYear-1);
 for(let year=plan.startYear;year<=plan.endYear;year++){
  const t=year-plan.baseYear;priceIndex*=1+(returns?.[year-plan.startYear]?.inflation??plan.inflation);const idx=priceIndex;
  let upfront=0,saleProceeds=0,interest=0,principal=0,operating=0;
  // A Florida purchase is sold at the move; Tennessee purchase is a separate scenario.
  if(home>0&&year===h.moveYear&&h.buyYear<h.moveYear){saleProceeds=home*(1-h.selling)-debt;home=0;debt=0;}
  if(h.mode==='buy'&&year===h.buyYear){home=h.price;debt=home*(1-h.down);payment=mortgagePayment(debt,h.rate,h.term);upfront=home*(h.down+h.closing);}
  const owns=home>0;
  let cost=0;
  if(owns){
   for(let m=0;m<12&&debt>1e-7;m++){const i=debt*h.rate/12;const p=Math.min(debt,Math.max(0,payment-i));debt-=p;interest+=i;principal+=p;}
   operating=home*(h.propertyTax+h.maintenance)+(h.insurance+h.hoa*12)*idx;
   cost=interest+principal+operating; home*=1+h.appreciation;
  }else{
   const rent=year>=h.moveYear?h.tnRent:year>=h.jointRentYear?h.jointRent:h.rent;
   cost=rent*12*(1+h.rentGrowth)**t;
  }
  rows.push({year,cost,upfront,saleProceeds,home,debt,equity:home-debt,interest,principal,operating,owns,relocation:year===h.moveYear?h.relocation:0,moving:year===h.moveYear?h.movingCost:0});
 }
 return rows;
}
