const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(html.match(/<script id="cost-engine">([\s\S]*?)<\/script>/)[1],ctx);
new vm.Script(html.match(/<script id="cost-ui">([\s\S]*?)<\/script>/)[1]);
const E=ctx.CostEngine;let checks=0;
function eq(a,b,m){assert.equal(String(a),String(b),m);checks++}
const base={contract:'12,000,000',tax:'600,000',airDeduction:'0',airGrade:'1'};
for(const [airGrade,expected]of [['1',31920],['2',39900],['3',61560]]){const a=E.calculateAir({...base,airGrade});eq(a.basis,11400000);eq(E.round(a.fee),expected);eq(Object.keys(a.errors).length,0)}
eq(E.round(E.calculateAir({...base,airDeduction:'400,000'}).fee),30800,'approved deduction reduces fee');
for(const insurance of ['0','100,000','999,999','']){const a=E.calculateAir({...base,insurance,discount:'0'});eq(E.round(a.fee),31920,'insurance and service discount do not reduce air base')}
for(const key of ['contract','tax','airDeduction']){eq(E.calculateAir({...base,[key]:''}).fee,null,'blank is not zero');for(const bad of ['-1','2.5','1,00','1e6','1000000000001']){const a=E.calculateAir({...base,[key]:bad});eq(a.fee,null);assert.ok(a.errors[key]);checks++}}
for(const airGrade of ['','x','0','4','__proto__','constructor']){const a=E.calculateAir({...base,airGrade});eq(a.fee,null);eq(a.grade,null);if(airGrade){assert.ok(a.errors.airGrade);checks++}}
const negative=E.calculateAir({...base,tax:'12000000',airDeduction:'1'});eq(negative.fee,null);assert.ok(negative.errors.airDeduction);checks++;
eq(E.round(E.calculateAir({...base,contract:'600000',tax:'600000'}).fee),0,'zero remainder valid');
eq(E.round(E.calculateAir({...base,contract:'0',tax:'0'}).fee),0,'zero inputs valid');
// Independent integer formula at rounding boundaries and maximum supported input.
for(const amount of [1,178,179,4999,5000,5001,18518,18519,35714,35715,1000000000000])for(const [g,n]of [['1',28n],['2',35n],['3',54n]]){
 const a=E.calculateAir({...base,contract:String(amount),tax:'0',airGrade:g});
 eq(a.fee.n*10000n/a.fee.d,BigInt(amount)*n,'exact per-mille arithmetic');
 eq(E.round(a.fee),(BigInt(amount)*n+5000n)/10000n,'round only at final amount');
}
const integrated={direct:'10000000',contract:'12000000',insurance:'100000',tax:'600000',discount:'100',category:'general',type:'public',mode:'outsourced',airGrade:'1',airDeduction:'0'};
const r=E.calculate(integrated);eq(r.basis,11300000);eq(r.air.basis,11400000);eq(E.round(r.managementTotal),364000);eq(E.round(r.discounted),1140700);eq(E.round(r.air.fee),31920);
const invalid=E.calculate({...integrated,airDeduction:'-1'});eq(invalid.air.fee,null);eq(E.round(invalid.managementTotal),364000,'bad air input leaves management valid');eq(E.round(invalid.discounted),1140700);
console.log(`Passed ${checks} air-fee precision, validation, independence and integration checks.`);
