const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const engineCode=html.match(/<script id="cost-engine">([\s\S]*?)<\/script>/)[1];
const ctx={};vm.createContext(ctx);vm.runInContext(engineCode,ctx);const E=ctx.CostEngine;
let checks=0;function equal(a,b,msg){assert.equal(String(a),String(b),msg);checks++}
function fee(key,amount,rates){return E.schedule(amount,key,rates).fee}
function rounded(f){return E.round(f)}
const known={profit:[[0,0],[5000000,500000],[25000000,2100000],[100000000,7350000],[500000000,27350000]],quality:[[0,0],[10000000,200000],[50000000,800000],[100000000,1300000],[500000000,4500000]],management:[[0,0],[5000000,175000],[25000000,775000],[50000000,1400000],[100000000,2150000],[500000000,6150000],[600000000,6850000]]};
for(const [key,points]of Object.entries(known))for(const [x,y]of points)equal(rounded(fee(key,x)),y,`${key} ${x}`);
// Check each tier boundary at -1, 0, +1 using independently specified piecewise integrals.
function independent(amount,limits,rates){let n=0n,lo=0;for(let i=0;i<limits.length;i++){let used=Math.max(0,Math.min(amount,limits[i])-lo);n+=BigInt(used)*BigInt(rates[i]);lo=limits[i]}return n;}
for(const key of ['profit','quality','management'])for(const b of E.ranges[key].filter(Number.isFinite))for(const d of [-1,0,1]){const f=fee(key,b+d);equal(f.n*10000n/f.d,independent(b+d,E.ranges[key],E.rates[key]),`${key} at ${b+d}`)}
for(const [x,y]of [[5000000,525000],[10000000,1025000],[50000000,4585000],[100000000,8385000],[500000000,33985000],[600000000,39585000]])equal(rounded(E.add(fee('service',x,E.rates.design),fee('service',x,E.rates.supervision))),y,'public service total');
const input={direct:'10,000,000',contract:'12000000',insurance:'100000',tax:'600000',discount:'90',type:'public',mode:'outsourced',category:'general'};
let r=E.calculate(input);equal(r.basis,11300000,'base');equal(rounded(r.profit.fee),900000);equal(rounded(r.quality.fee),200000);equal(rounded(r.environment),20000);equal(rounded(r.managementTotal),364000);equal(rounded(r.design.fee),640000);equal(rounded(r.supervision.fee),500700);equal(rounded(r.totalReference),1140700);equal(rounded(r.discounted),1026630);
r=E.calculate({...input,mode:'self'});equal(rounded(r.increment),342210);equal(rounded(r.managementTotal),706210);
const selfDiscount=E.calculate({...input,mode:'self',discount:'0'});equal(rounded(selfDiscount.managementTotal),706210,'discount does not affect self increment');
for(let c=1;c<=4;c++){r=E.calculate({...input,type:'building',category:'b'+c});equal(rounded(r.totalReference),rounded(fee('service',11300000,E.rates.building[c-1])));equal(E.add(E.add(r.planning,r.design.fee),r.supervision.fee).n*r.totalReference.d,r.totalReference.n*E.add(E.add(r.planning,r.design.fee),r.supervision.fee).d,'planning + design + supervision = total');}
r=E.calculate({...input,type:'building',category:'b1',mode:'self'});equal(rounded(r.totalReference),919700);equal(rounded(r.increment),367880);equal(rounded(r.managementTotal),731880);
equal(E.calculate({...input,type:'building',category:'b5'}).totalReference,null,'category 5 not silently assigned');equal(rounded(E.calculate({...input,type:'building',category:'b5ref'}).totalReference),rounded(E.calculate({...input,type:'building',category:'b4'}).totalReference));
equal(E.calculate({...input,category:'special'}).totalReference,null);equal(E.calculate({...input,category:'special',mode:'self'}).managementTotal,null);equal(rounded(E.calculate({...input,category:'special'}).managementTotal),364000,'outsourced management independent of service applicability');
for(const bad of ['-1','1.5','1,00','12,34,567','NaN','Infinity','1e5','<script>','1 000','1000000000001'])assert.ok(E.parseMoney(bad).error,bad);checks+=10;
for(const bad of ['','-1','101','1.234','abc'])assert.ok(E.parseDiscount(bad).error,bad);checks+=5;
equal(E.parseMoney('').value,null);equal(E.parseMoney('0').value,0);equal(E.parseMoney('1,000').value,1000);equal(E.parseDiscount('90.25').value,9025);
r=E.calculate({...input,direct:'',insurance:''});equal(r.profit.fee,null);equal(r.basis,null);equal(r.managementTotal,null);equal(r.totalReference,null);
r=E.calculate({...input,contract:'5',insurance:'4',tax:'2'});assert.ok(r.errors.contract);checks++;equal(r.basis,null);equal(r.totalReference,null);equal(rounded(r.profit.fee),900000,'invalid base does not erase valid direct schedule');
r=E.calculate({...input,direct:'0',contract:'0',insurance:'0',tax:'0',discount:'0'});equal(rounded(r.profit.fee),0);equal(rounded(r.managementTotal),0);equal(rounded(r.discounted),0);
equal(rounded(E.calculate({...input,discount:'100'}).discounted),1140700);equal(rounded(E.calculate({...input,discount:'0'}).discounted),0);
equal(E.round(E.R(149,100)),1);equal(E.round(E.R(150,100)),2);equal(E.round(E.R(1495,1000),2),150);
// Randomized exact checks across large values using a separate direct integral.
let seed=137;for(let i=0;i<80;i++){seed=(seed*48271)%2147483647;const amount=seed*400;for(const key of ['profit','quality','management']){const f=fee(key,amount);equal(f.n*10000n/f.d,independent(amount,E.ranges[key],E.rates[key]),'random '+key)}}
for(const b of E.ranges.service.filter(Number.isFinite))for(const d of [-1,0,1])for(const rates of [E.rates.design,E.rates.supervision,...E.rates.building]){const f=fee('service',b+d,rates);equal(f.n*10000n/f.d,independent(b+d,E.ranges.service,rates),'service boundary')}
// Verify rounding occurs after summing, not prematurely at each tier.
const f=fee('service',10000001,E.rates.design);equal(E.round(f,2),57500005);equal(E.round(E.mul(f,9025,10000)),518938);
console.log(`Passed ${checks} exact calculation, validation and boundary checks.`);
