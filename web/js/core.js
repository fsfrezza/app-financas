(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Finance=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const DAY=86400000;
function id(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Data inválida.');const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('Data inválida.');return d;}
function addDays(s,n){return new Date(+date(s)+n*DAY).toISOString().slice(0,10);}
function days(a,b){return Math.round((date(b)-date(a))/DAY);}
function addMonths(s,n){const d=date(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
function money(v){const s=String(v).trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))throw Error('Informe um valor positivo com até duas casas decimais.');const [a,b='']=s.replace(',','.').split('.');const cents=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000000)throw Error('Valor fora do limite.');return cents;}
function initial(){return {version:1,transactions:[],categories:['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Salário','Serviços','Outros'].map(name=>({id:id(),name,type:name==='Salário'?'income':['Serviços','Outros'].includes(name)?'both':'expense'})),accounts:[{id:id(),name:'Minha conta',opening:0}],consumables:[],settings:{leadDays:3,notifications:false},createdAt:new Date().toISOString()};}
function monthOf(t){return t.competenceMonth||t.dueDate.slice(0,7);}
function status(t,now=today()){return t.paidDate?'paid':t.dueDate<now?'overdue':t.dueDate===now?'today':'pending';}
function installments(input){if(!input.description?.trim())throw Error('Informe uma descrição.');date(input.date);date(input.dueDate);const count=Number(input.count||1);if(!Number.isInteger(count)||count<1||count>120)throw Error('Use de 1 a 120 parcelas.');if(!Number.isSafeInteger(input.amount)||input.amount<count)throw Error('O total deve permitir pelo menos R$ 0,01 por parcela.');if(!['expense','income'].includes(input.type))throw Error('Tipo inválido.');const groupId=count>1?id():null,base=Math.floor(input.amount/count),rem=input.amount%count;return Array.from({length:count},(_,i)=>({id:id(),groupId,description:input.description.trim(),type:input.type,categoryId:input.categoryId,accountId:input.accountId,amount:base+(i<rem?1:0),date:input.date,dueDate:addMonths(input.dueDate,i),paidDate:i===0&&input.paidDate?input.paidDate:null,note:input.note||'',part:i+1,parts:count,createdAt:new Date().toISOString()}));}
// Recurrence definitions live with their originating transaction, so sync keeps
// the rule and its edits atomic. Future occurrences are deterministic projections.
function transfer(state,input){
 if(input.from===input.to)throw Error('Escolha contas diferentes.');date(input.date);if(input.date>today())throw Error('Use a data real da transferência.');
 if(![input.from,input.to].every(id=>state.accounts.some(a=>a.id===id)))throw Error('Conta inválida.');
 const group=id(),description='Transferência entre contas',rows=[];
 for(const [type,accountId] of [['expense',input.from],['income',input.to]])rows.push({...installments({description,type,accountId,categoryId:state.categories[0].id,amount:input.amount,count:1,date:input.date,dueDate:input.date,paidDate:input.date})[0],transferId:group});
 return rows;
}
function recurring(input){
 const row=installments({...input,count:1,amount:input.amount||1})[0];
 row.amount=input.amount;row.valueMode=input.valueMode||'confirmed';
 if(row.valueMode==='unknown'&&row.paidDate)throw Error('Informe o valor antes de confirmar.');
 const template={};for(const k of ['description','type','categoryId','accountId','amount','note','valueMode'])template[k]=row[k];
 row.recurrence={start:row.dueDate,end:input.endDate||null,template,changes:[],skipped:[]};
 row.recurrenceId=row.id;row.occurrenceDate=row.dueDate;return row;
}
function occurrences(state,through){
 date(through);const rows=state.transactions.filter(t=>!t.omitted&&!t.referenceOnly).map(t=>({...t}));
 const present=new Set(state.transactions.filter(t=>t.recurrenceId).map(t=>t.recurrenceId+'@'+t.occurrenceDate));
 for(const root of state.transactions.filter(t=>t.recurrence)){
  const r=root.recurrence;const stop=r.end&&r.end<through?r.end:through;
  const start=date(r.start),end=date(stop);const months=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth();
  for(let i=0;i<=months;i++){
   const due=addMonths(r.start,i);if(due>stop||r.skipped.includes(due)||present.has(root.id+'@'+due))continue;
   let template=r.template;for(const change of r.changes)if(change.from<=due)template=change.template;
   rows.push({...template,id:root.id+'@'+due,recurrenceId:root.id,occurrenceDate:due,date:due,dueDate:due,paidDate:null,part:1,parts:1,groupId:null,createdAt:root.createdAt});
  }
 }
 return rows;
}
function putOccurrence(state,row){const at=state.transactions.findIndex(t=>t.id===row.id);if(at>=0){const rule=state.transactions[at].recurrence;state.transactions[at]={...state.transactions[at],...row};if(rule)state.transactions[at].recurrence=rule;}else state.transactions.push({...row});}
function skipOccurrence(state,row){
 if(row.recurrenceId){const root=state.transactions.find(t=>t.id===row.recurrenceId);if(!root?.recurrence)throw Error('Repetição não encontrada.');if(!root.recurrence.skipped.includes(row.occurrenceDate))root.recurrence.skipped.push(row.occurrenceDate);
 if(row.id===root.id)root.omitted=true;else state.transactions=state.transactions.filter(t=>t.id!==row.id);
 }else state.transactions=state.transactions.filter(t=>t.id!==row.id);
}
function endRecurrence(state,row){
 const root=state.transactions.find(t=>t.id===row.recurrenceId);if(!root?.recurrence)throw Error('Repetição não encontrada.');
 const end=addDays(row.occurrenceDate,-1);root.recurrence.end=end;
 for(const t of [...state.transactions])if(t.recurrenceId===root.id&&t.occurrenceDate>=row.occurrenceDate&&!t.paidDate){if(t.id===root.id)t.omitted=true;else state.transactions=state.transactions.filter(x=>x.id!==t.id);}
}
function changeRecurrence(state,row,template){
 const root=state.transactions.find(t=>t.id===row.recurrenceId);if(!root?.recurrence)throw Error('Repetição não encontrada.');
 root.recurrence.changes=root.recurrence.changes.filter(c=>c.from<row.occurrenceDate);root.recurrence.changes.push({from:row.occurrenceDate,template});
 for(const t of [...state.transactions])if(t.recurrenceId===root.id&&t.occurrenceDate>=row.occurrenceDate&&!t.paidDate){Object.assign(t,template);}
}
function summary(state,month,now=today()){
 const end=addDays(addMonths(month+'-01',1),-1),through=end>now?end:now,all=occurrences(state,through),tx=all.filter(t=>monthOf(t)===month);
 const sum=(rows,type,includeTransfers=false)=>rows.filter(t=>t.type===type&&(includeTransfers||!t.transferId)).reduce((n,t)=>n+t.amount,0),paid=tx.filter(t=>t.paidDate),open=tx.filter(t=>!t.paidDate);
 const opening=state.accounts.reduce((n,a)=>n+a.opening,0),real=all.filter(t=>t.paidDate&&t.paidDate<=now),atEnd=all.filter(t=>t.paidDate&&t.paidDate<=end),pending=all.filter(t=>!t.paidDate&&t.dueDate<=end);
 return {income:sum(tx,'income'),expense:sum(tx,'expense'),received:sum(paid,'income'),paid:sum(paid,'expense'),receivable:sum(open,'income'),pending:sum(open,'expense'),balance:opening+sum(real,'income',true)-sum(real,'expense',true),projected:opening+sum(atEnd,'income',true)-sum(atEnd,'expense',true)+sum(pending,'income',true)-sum(pending,'expense',true),unknown:pending.filter(t=>t.valueMode==='unknown').length,estimated:pending.filter(t=>t.valueMode==='estimated').length};
}
function forecast(item){const records=[...item.records].sort();if(!records.length)return null;const intervals=records.slice(1).map((r,i)=>days(records[i],r));const average=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):item.initialDays;return {average,date:addDays(records.at(-1),average),samples:intervals.length};}
function alerts(state,now=today()){const result=[];for(const t of occurrences(state,addDays(now,state.settings.leadDays))){if(t.paidDate||t.transferId||t.type==='income'&&!state.settings.incomeReminders)continue;const delta=days(now,t.dueDate);if(delta<=state.settings.leadDays)result.push({id:t.id,title:t.description,detail:t.type==='income'?(delta<0?`Recebimento atrasado há ${-delta} dia(s)`:delta===0?'Recebimento previsto hoje':`Recebimento em ${delta} dia(s)`):(delta<0?`Vencida há ${-delta} dia(s)`:delta===0?'Vence hoje':`Vence em ${delta} dia(s)`),date:t.dueDate,amount:t.amount,type:t.type,valueMode:t.valueMode,kind:delta<0?'danger':'warning',transactionId:t.id});}for(const item of state.consumables){const f=forecast(item);if(f&&days(now,f.date)<=item.leadDays)result.push({id:item.id,title:item.name,detail:'Reposição estimada · '+(f.samples?`${f.samples} intervalo(s) registrado(s)`:'duração inicial informada'),date:f.date,kind:'warning'});}return result.sort((a,b)=>a.date.localeCompare(b.date));}
function validate(s){const fail=()=>{throw Error('Backup inválido ou incompatível. Nenhum dado foi substituído.');};if(!s||s.version!==1||!Array.isArray(s.transactions)||!Array.isArray(s.categories)||!Array.isArray(s.accounts)||!s.accounts.length||!Array.isArray(s.consumables)||!s.settings)fail();if(s.transactions.length>100000||s.categories.length>1000||s.accounts.length>1000||s.consumables.length>1000)fail();const ids=new Set();for(const x of [...s.categories,...s.accounts,...s.transactions,...s.consumables]){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))fail();ids.add(x.id);}for(const x of [...s.categories,...s.accounts,...s.consumables])if(typeof x.name!=='string'||!x.name.trim()||x.name.length>120)fail();for(const a of s.accounts)if(!Number.isSafeInteger(a.opening)||Math.abs(a.opening)>1e11)fail();for(const t of s.transactions){if(typeof t.description!=='string'||!t.description.trim()||t.description.length>200||!['expense','income'].includes(t.type)||!Number.isSafeInteger(t.amount)||(t.amount<=0&&!(t.amount===0&&t.valueMode==='unknown'&&!t.paidDate))||t.amount>1e11||!s.categories.some(c=>c.id===t.categoryId)||!s.accounts.some(a=>a.id===t.accountId)||typeof t.note!=='string'||t.note.length>2000||!Number.isInteger(t.part)||!Number.isInteger(t.parts)||t.part<1||t.parts<t.part||t.parts>120)fail();date(t.date);date(t.dueDate);if(t.competenceMonth){if(!/^\d{4}-\d{2}$/.test(t.competenceMonth))fail();date(t.competenceMonth+'-01');}if(t.paidDate)date(t.paidDate);
 if(t.valueMode&&!['confirmed','estimated','unknown'].includes(t.valueMode))fail();if(t.paidDate&&t.valueMode&&t.valueMode!=='confirmed')fail();
 if(t.recurrenceId){if(typeof t.recurrenceId!=='string')fail();date(t.occurrenceDate);if(!s.transactions.some(x=>x.id===t.recurrenceId&&x.recurrence))fail();}
 if(t.recurrence){const r=t.recurrence;date(r.start);if(r.end)date(r.end);if(!Array.isArray(r.skipped)||r.skipped.length>5000||!Array.isArray(r.changes)||r.changes.length>1000)fail();r.skipped.forEach(date);
 let previous='';for(const c of r.changes){date(c.from);if(c.from<=previous)fail();previous=c.from;}
 for(const v of [r.template,...r.changes.map(c=>c.template)]){if(!v||!['income','expense'].includes(v.type)||typeof v.description!=='string'||!v.description.trim()||v.description.length>200||typeof v.note!=='string'||v.note.length>2000||!Number.isSafeInteger(v.amount)||v.amount<0||v.amount>1e11||!['confirmed','estimated','unknown'].includes(v.valueMode)||v.valueMode==='unknown'&&v.amount!==0||v.valueMode!=='unknown'&&v.amount===0||!s.categories.some(c=>c.id===v.categoryId)||!s.accounts.some(a=>a.id===v.accountId))fail();}
 }
}
for(const t of s.transactions.filter(t=>t.transferId)){const pair=s.transactions.filter(x=>x.transferId===t.transferId);if(pair.length!==2||pair[0].type===pair[1].type||pair[0].amount!==pair[1].amount||pair[0].accountId===pair[1].accountId||pair[0].paidDate!==pair[1].paidDate||!t.paidDate||t.recurrenceId)fail();}
const occurrenceKeys=new Set();for(const t of s.transactions.filter(t=>t.recurrenceId)){const key=t.recurrenceId+'@'+t.occurrenceDate;if(occurrenceKeys.has(key)||t.id!==t.recurrenceId&&t.id!==key)fail();occurrenceKeys.add(key);if(t.recurrence&&(t.recurrenceId!==t.id||t.recurrence.start!==t.occurrenceDate))fail();}
for(const t of s.transactions){if(t.referenceOnly!==undefined&&typeof t.referenceOnly!=='boolean')fail();if(t.referenceOnly&&(t.paidDate||t.recurrence||t.transferId))fail();if(t.sourceRecord){const r=t.sourceRecord;if(typeof r.id!=='string'||!r.id||typeof r.description!=='string'||!r.description||!Number.isSafeInteger(r.amountCents)||!['card_debit_positive','bank_credit_positive'].includes(r.amountConvention)||!/^\d{4}-\d{2}$/.test(r.statementMonth))fail();date(r.statementMonth+'-01');date(r.date);date(r.dueDate);}}
for(const c of s.categories)if(c.type&&!['income','expense','both'].includes(c.type))fail();
for(const c of s.consumables){if(!Array.isArray(c.records)||c.records.length>5000||new Set(c.records).size!==c.records.length||!Number.isInteger(c.initialDays)||c.initialDays<1||c.initialDays>3650||!Number.isInteger(c.leadDays)||c.leadDays<0||c.leadDays>365)fail();c.records.forEach(date);}
if(s.settings.incomeReminders!==undefined&&typeof s.settings.incomeReminders!=='boolean')fail();
if(!Number.isInteger(s.settings.leadDays)||s.settings.leadDays<0||s.settings.leadDays>90||typeof s.settings.notifications!=='boolean')fail();return s;}
function csv(state,through=today()){const quote=x=>'"'+String(x??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['Descrição','Tipo','Data','Vencimento','Pagamento','Valor','Categoria','Conta','Parcela','Observações','Situação do valor','Competência','ID do lançamento'],...occurrences(state,through).map(t=>[t.description,t.type==='income'?'Entrada':'Gasto',t.date,t.dueDate,t.paidDate,t.valueMode==='unknown'?'':(t.amount/100).toFixed(2).replace('.',','),state.categories.find(c=>c.id===t.categoryId)?.name,state.accounts.find(a=>a.id===t.accountId)?.name,t.recurrenceId?'Mensal':`${t.part}/${t.parts}`,t.note,t.valueMode==='unknown'?'A informar':t.valueMode==='estimated'?'Estimado':'Conhecido',monthOf(t),t.id])].map(row=>row.map(quote).join(';')).join('\r\n');}
return {monthOf,transfer,recurring,occurrences,putOccurrence,skipOccurrence,endRecurrence,changeRecurrence,id,today,date,addDays,days,addMonths,money,initial,status,installments,summary,forecast,alerts,validate,csv};});
