(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.FinanceImport=factory(root.Finance);})(typeof self!=='undefined'?self:this,function(F){
'use strict';
const format='frezzatech.import-review';
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
function validate(data){
 if(!plain(data)||data.format!==format||data.version!==1||data.currency!=='BRL'||!Array.isArray(data.records)||data.records.length>15000)throw Error('Arquivo de importação incompatível. Use o JSON de conferência, CSV ou OFX. Backup completo deve ser restaurado em Configurações.');
 for(const key of ['notes','statements','budgets'])if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].length>3000))throw Error('Metadados de importação inválidos.');if(data.notes?.some(x=>typeof x!=='string'||x.length>4000))throw Error('Observações inválidas.');if(data.budgets?.some(x=>!plain(x)||typeof x.description!=='string'||x.description.length>200||!Number.isSafeInteger(x.informedAmountCents)||!Number.isSafeInteger(x.chosenMonthlyCents)))throw Error('Modelo de orçamento inválido.');
 const ids=new Set();for(const r of data.records){if(!plain(r)||typeof r.id!=='string'||!r.id||r.id.length>128||ids.has(r.id)||typeof r.description!=='string'||!r.description.trim()||r.description.length>2000||!Number.isSafeInteger(r.amountCents)||Math.abs(r.amountCents)>1e11||!['card_debit_positive','bank_credit_positive'].includes(r.amountConvention)||!['bank','credit_card'].includes(r.accountKind)||!/^\d{4}-\d{2}$/.test(r.statementMonth))throw Error('Registro inválido ou repetido no arquivo.');ids.add(r.id);F.date(r.statementMonth+'-01');F.date(r.date);F.date(r.dueDate);}
 if(new TextEncoder().encode(JSON.stringify(data)).length>4000000)throw Error('Divida o arquivo em lotes de até 4 MB.');return data;
}
async function digest(value){const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function parseCsv(text){const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',',rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell||quoted&&text[i+1]&&!['\r','\n',delimiter].includes(text[i+1]))throw Error('Aspas inválidas no CSV.');else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV contém aspas não fechadas.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
}
const norm=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function parseDate(x){x=String(x||'').trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(x))x=x.slice(6)+'-'+x.slice(3,5)+'-'+x.slice(0,2);F.date(x);return x;}
function amount(x){x=String(x).trim().replace('−','-');if(!/^-?\d+(?:[.,]\d{1,2})?$/.test(x))throw Error('Valor inválido. Use número decimal sem símbolo nem separador de milhar.');const negative=x.startsWith('-');x=x.replace(/^-/,'');if(/^0([.,]0{1,2})?$/.test(x))return 0;return F.money(x)*(negative?-1:1);}
function decodeEntity(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
async function parse(text,name){
 if(new TextEncoder().encode(text).length>4000000)throw Error('Arquivo maior que 4 MB. Divida em lotes.');text=text.replace(/^\uFEFF/,'');if(text.trim().startsWith('{'))return validate(JSON.parse(text));
 const records=[],counter=new Map();async function add(r,key){const n=(counter.get(key)||0)+1;counter.set(key,n);r.id=await digest(key+'|'+n);r.sourceFile=name;r.reviewRequired=true;records.push(r);}
 if(/<OFX[>\s]/i.test(text)){
 const card=/<CCSTMTRS>/i.test(text),tag=(s,k)=>decodeEntity((s.match(new RegExp('<'+k+'>\\s*([^<\\r\\n]+)','i'))||[])[1]?.trim()||'');
 const due=card?(name.match(/(\d{4}-\d{2}-\d{2})/)||[])[1]:null;if(card&&!due)throw Error('Para OFX de cartão, use um nome com vencimento AAAA-MM-DD, como Cartao_2026-12-21.ofx. A data será marcada para conferência.');
 for(const match of text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)){
 const b=match[1],d=tag(b,'DTPOSTED').slice(0,8),date=parseDate(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6)),signed=amount(tag(b,'TRNAMT')),description=tag(b,'MEMO')||tag(b,'NAME')||'Movimentação sem descrição',fitid=tag(b,'FITID');
 await add({date,dueDate:due||date,dueDateConfirmed:!card,statementMonth:card?due.slice(0,7):date.slice(0,7),description,amountCents:card?-signed:signed,amountConvention:card?'card_debit_positive':'bank_credit_positive',accountKind:card?'credit_card':'bank',role:card?(/pagamento recebido/i.test(description)?'card_payment':'review'):'bank_movement',externalId:fitid,accountSourceId:!card?(tag(text,'BANKID')==='0260'?'nubank-bank-':'bank-'+tag(text,'BANKID')+'-')+tag(text,'ACCTID').replace(/[^0-9a-z]/gi,''):'',reviewRequired:true},[card?'card':'bank',tag(text,'ACCTID'),card?due.slice(0,7):date,fitid,signed,description].join('|'));
 }
 }else{
 const rows=parseCsv(text),head=rows.shift()?.map(norm)||[],get=(row,key)=>row[head.indexOf(key)]||'';if(!head.includes('descricao')||!head.includes('valor')||!head.includes('data'))throw Error('CSV precisa ter Data, Valor e Descrição. Também é aceito o CSV exportado pelo app.');
 const app=head.includes('tipo');for(let i=0;i<rows.length;i++){
 const row=rows[i];if(row.length!==head.length)throw Error('Quantidade de colunas inválida na linha '+(i+2));const date=parseDate(get(row,'data')),due=parseDate(get(row,'vencimento')||date),description=get(row,'descricao'),raw=app&&norm(get(row,'situacao do valor'))==='a informar'&&!get(row,'valor')?0:amount(get(row,'valor')),type=norm(get(row,'tipo'));if(app&&!['entrada','gasto','saida'].includes(type))throw Error('Tipo inválido na linha '+(i+2));const signed=raw===0?0:app?(type==='entrada'?Math.abs(raw):-Math.abs(raw)):raw,ext=get(row,'identificador');
 await add({date,dueDate:due,dueDateConfirmed:true,statementMonth:get(row,'competencia')||due.slice(0,7),description,amountCents:signed,amountConvention:'bank_credit_positive',accountKind:'bank',role:app?'financial_row':'bank_movement',externalId:ext,accountSourceId:(name.match(/NU_(\d+)_/i)||[])[1]?'nubank-bank-'+name.match(/NU_(\d+)_/i)[1]:'',categorySuggestion:get(row,'categoria'),originalTransactionId:get(row,'id do lancamento'),part:/^(\d+)\/(\d+)$/.test(get(row,'parcela'))?Number(get(row,'parcela').split('/')[0]):1,parts:/^(\d+)\/(\d+)$/.test(get(row,'parcela'))?Number(get(row,'parcela').split('/')[1]):1,originalPaymentDate:get(row,'pagamento'),originalValueMode:norm(get(row,'situacao do valor'))==='estimado'?'estimated':'confirmed',sourceLine:i+2},['csv',date,due,ext,signed,description].join('|'));
 }
 }
 if(!records.length)throw Error('Nenhum lançamento reconhecido no arquivo.');return validate({format,version:1,currency:'BRL',sourceName:name,sourceSha256:await digest(text),mode:'review-only',records,statements:[],budgets:[]});
}
function recordKey(r){return r.accountKind==='bank'&&r.accountSourceId&&r.externalId?JSON.stringify([r.accountSourceId,r.externalId.replace(/:reversal$/,''),r.date,r.amountConvention,r.amountCents]):'id:'+r.id;}
function inScope(month,scope={}){return (!scope.from||month>=scope.from)&&(!scope.to||month<=scope.to);}
function checkScope(scope={}){for(const k of ['from','to'])if(scope[k]){if(!/^\d{4}-\d{2}$/.test(scope[k]))throw Error('Período inválido.');F.date(scope[k]+'-01');}if(scope.from&&scope.to&&scope.from>scope.to)throw Error('O mês inicial deve ser anterior ao final.');return scope;}
function identityKey(r){return r.accountSourceId&&r.externalId?JSON.stringify([r.accountSourceId,r.externalId.replace(/:reversal$/,''),r.statementMonth,Math.sign(r.amountCents)]):'id:'+r.id;}
function content(r){return JSON.stringify([r.description,r.date,r.dueDate,r.statementMonth,r.amountConvention,r.amountCents,r.part||1,r.parts||1]);}
function preview(state,data,scope={}){
 validate(data);checkScope(scope);const existing=new Map();for(const t of state.transactions.filter(t=>t.sourceRecord))for(const key of ['id:'+t.sourceRecord.id,recordKey(t.sourceRecord),identityKey(t.sourceRecord)])existing.set(key,t.sourceRecord);
 const fresh=[],conflicts=[],duplicatesList=[],months=new Map(),presentMonths=new Set(state.transactions.filter(t=>!t.importManifest&&!t.omitted).map(t=>t.sourceRecord?.statementMonth||F.monthOf(t)));const lastMonth=data.records.reduce((m,r)=>r.statementMonth>m?r.statementMonth:m,F.today().slice(0,7));for(const t of F.occurrences(state,F.addDays(F.addMonths(lastMonth+'-01',1),-1))){presentMonths.add(F.monthOf(t));existing.set('entry:'+t.id,{description:t.description,date:t.date,dueDate:t.dueDate,statementMonth:F.monthOf(t),amountConvention:'bank_credit_positive',amountCents:t.amount*(t.type==='income'?1:-1),part:t.part,parts:t.parts});}
 const filtered=data.records.filter(r=>inScope(r.statementMonth,scope));
 for(const r of filtered){const old=(r.originalTransactionId&&existing.get('entry:'+r.originalTransactionId))||existing.get('id:'+r.id)||existing.get(recordKey(r))||existing.get(identityKey(r));if(old){if(content(old)===content(r))duplicatesList.push(r);else conflicts.push({record:r,existing:old});continue;}
 for(const key of ['id:'+r.id,recordKey(r),identityKey(r)])existing.set(key,r);fresh.push(r);const m=months.get(r.statementMonth)||{month:r.statementMonth,count:0,debits:0,credits:0,existing:presentMonths.has(r.statementMonth)};m.count++;if(r.amountCents>=0)m.debits+=r.amountCents;else m.credits-=r.amountCents;months.set(m.month,m);}
 return {fresh,duplicates:duplicatesList.length,duplicatesList,conflicts,filteredCount:filtered.length,months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)),complementMonths:[...new Set(fresh.filter(r=>presentMonths.has(r.statementMonth)).map(r=>r.statementMonth))].sort()};
}
function launchReason(t){
 if(!t?.sourceRecord)return 'Não é um documento importado';if(!t.referenceOnly)return 'Já incluído no controle';const r=t.sourceRecord;
 if(!t.amount)return 'Valor zero: conferir individualmente';
 if(r.dueDateConfirmed===false)return 'Vencimento ainda não confirmado';
 if(r.accountKind==='credit_card'&&r.amountCents<0)return 'Crédito de cartão: conciliação individual';
 if(!['card_charge','fee','financial_row','bank_movement'].includes(r.role))return 'Natureza pendente ou ajuste: conferir individualmente';
 if(/pagamento (de |da )?fatura|pagamento recebido|cr[eé]dito de|saldo em|encerramento de d[ií]vida|juros de d[ií]vida|reorganiza|parcelamento de fatura/i.test(r.description))return 'Quitação ou financiamento: conciliação individual';
 if(r.accountKind==='bank'&&/transfer[eê]ncia|pix|cr[eé]dito|empr[eé]stimo|aplica[cç][aã]o|resgate/i.test(r.description))return 'Movimentação bancária com natureza a conferir';
 return '';
}
function planLaunch(state,ids,options={}){
 if(!state.accounts.some(a=>a.id===options.accountId))throw Error('Escolha uma conta válida para o lote.');
 const override=options.categoryId?state.categories.find(c=>c.id===options.categoryId):null;if(options.categoryId&&!override)throw Error('Categoria inválida.');
 const ready=[],skipped=[],unique=[...new Set(ids)],manual=state.transactions.filter(t=>!t.referenceOnly&&!t.transferId&&!t.omitted);
 for(const id of unique){const t=state.transactions.find(t=>t.id===id);let reason=launchReason(t);if(!reason&&override?.type&&override.type!=='both'&&override.type!==t.type)reason='Categoria incompatível com entrada/saída';
 if(!reason&&manual.some(x=>x.id!==t.id&&x.accountId===options.accountId&&x.type===t.type&&x.amount===t.amount&&x.date===t.date&&F.monthOf(x)===t.sourceRecord.statementMonth&&norm(x.description)===norm(t.description)))reason='Possível lançamento financeiro já existente: conferir individualmente';
 if(reason){skipped.push({id,reason});continue;}
 let categoryName=override?.name||t.sourceRecord.categorySuggestion||'A classificar';const same=state.categories.find(c=>norm(c.name)===norm(categoryName));if(same?.type&&same.type!=='both'&&same.type!==t.type)categoryName='A classificar';
 ready.push({id,description:t.description,type:t.type,amount:t.amount,valueMode:t.valueMode,date:t.date,dueDate:t.dueDate,month:t.sourceRecord.statementMonth,categoryName,accountId:options.accountId});
 }
 const groups=new Map();for(const t of ready){const q=groups.get(t.month)||{month:t.month,count:0,income:0,expense:0};q.count++;q[t.type]+=t.amount;groups.set(q.month,q);}
 return {ready,skipped,months:[...groups.values()].sort((a,b)=>a.month.localeCompare(b.month))};
}
function launch(state,ids,options){const plan=planLaunch(state,ids,options),next=JSON.parse(JSON.stringify(state));for(const item of plan.ready){const t=next.transactions.find(t=>t.id===item.id);let category=next.categories.find(c=>norm(c.name)===norm(item.categoryName));if(!category){category={id:F.id(),name:item.categoryName,type:'both'};next.categories.push(category);}t.referenceOnly=false;t.accountId=item.accountId;t.categoryId=category.id;t.competenceMonth=item.month;t.paidDate=null;t.note=(t.note+'\nConferido em lote; pagamento/recebimento não confirmado.').trim();}F.validate(next);return {state:next,plan};}
function apply(state,data,scope={}){const next=JSON.parse(JSON.stringify(state)),p=preview(next,data,scope);if(!p.fresh.length)return next;
 let category=next.categories.find(c=>c.name==='A classificar');if(!category){category={id:F.id(),name:'A classificar',type:'both'};next.categories.push(category);}
 for(const r of p.fresh){const value=r.amountCents,signed=r.amountConvention==='card_debit_positive'?-value:value;next.transactions.push({id:'import:'+r.id,description:r.description.slice(0,200),type:signed>=0?'income':'expense',amount:Math.abs(value),date:r.date,dueDate:r.dueDate,paidDate:null,categoryId:category.id,accountId:next.accounts[0].id,note:'Importado para conferência. Não altera saldos.',part:r.part||1,parts:r.parts||1,groupId:null,createdAt:new Date().toISOString(),valueMode:value===0?'unknown':r.originalValueMode==='estimated'?'estimated':'confirmed',referenceOnly:true,sourceRecord:r});}
 const key='import-batch:'+(data.sourceSha256||data.sourceName);let batch=next.transactions.find(t=>t.id===key);const incoming={sourceName:data.sourceName,statements:(data.statements||[]).filter(s=>inScope(s.month,scope)),budgets:scope.from||scope.to||scope.ids?[]:data.budgets||[],notes:data.notes||[]};
 if(!batch)next.transactions.push({id:key,description:'Metadados da importação',type:'expense',amount:0,valueMode:'unknown',date:F.today(),dueDate:F.today(),paidDate:null,categoryId:category.id,accountId:next.accounts[0].id,note:'Orçamentos são modelos para revisão, não cobranças.',part:1,parts:1,groupId:null,createdAt:new Date().toISOString(),referenceOnly:true,importManifest:incoming});
 else for(const k of ['statements','budgets','notes']){const old=batch.importManifest[k]||[],keys=new Set(old.map(x=>typeof x==='string'?x:x.id||JSON.stringify(x)));batch.importManifest[k]=[...old,...incoming[k].filter(x=>!keys.has(typeof x==='string'?x:x.id||JSON.stringify(x)))];}
 F.validate(next);if(new TextEncoder().encode(JSON.stringify(next)).length>4800000)throw Error('O perfil excederia o limite de sincronização. Exporte backup e importe um lote menor.');return next;
}
function exportReview(state,scope={}){checkScope(scope);return {format,version:1,currency:'BRL',sourceName:'Historico-exportado-do-app.json',mode:'review-only',records:state.transactions.filter(t=>t.sourceRecord&&inScope(t.sourceRecord.statementMonth,scope)&&(!scope.ids||scope.ids.includes(t.id))).map(t=>t.sourceRecord),statements:scope.ids?[]:state.transactions.flatMap(t=>t.importManifest?.statements||[]).filter(s=>inScope(s.month,scope)),budgets:scope.from||scope.to||scope.ids?[]:state.transactions.flatMap(t=>t.importManifest?.budgets||[])};}
function financialCsv(state,scope={}){checkScope(scope);const horizon=scope.to||state.transactions.filter(t=>!t.referenceOnly).reduce((m,t)=>F.monthOf(t)>m?F.monthOf(t):m,F.addMonths(F.today(),12).slice(0,7)),through=F.addDays(F.addMonths(horizon+'-01',1),-1);const rows=F.occurrences(state,through).filter(t=>inScope(F.monthOf(t),scope)).map(t=>{const x={...t};delete x.recurrence;return x;});return F.csv({...state,transactions:rows},through);}
return {inScope,checkScope,launchReason,planLaunch,launch,validate,parse,parseCsv,preview,apply,exportReview,financialCsv};});
