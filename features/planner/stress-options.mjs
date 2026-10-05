// Disabled/hidden settings cannot veto a different simulation method.
export function stressOptions({mode,count,seed,inflationMode,blockLength}){
 if(!['montecarlo','bootstrap','historical'].includes(mode))throw Error('Choose a simulation method.');
 const historical=mode==='historical',trials=historical?500:Number(count),randomSeed=historical?2026:Number(seed),block=mode==='bootstrap'?Number(blockLength):5;
 if(!Number.isInteger(trials)||trials<50||trials>5000)throw Error('Choose 50–5,000 trials.');
 if(!Number.isInteger(randomSeed))throw Error('Choose a whole-number random seed.');
 if(!Number.isInteger(block)||block<1||block>20)throw Error('Choose a block length of 1–20 years.');
 if(!['fixed',mode==='montecarlo'?'stochastic':'historical'].includes(inflationMode))throw Error('Choose an inflation method supported by this simulation.');
 return {mode,count:trials,seed:randomSeed,inflationMode,blockLength:block};
}
