(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.FinanceSync=factory(root.Finance);})(typeof self!=='undefined'?self:this,function(F){
'use strict';
const collections=['transactions','categories','accounts','consumables'];
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(value){if(value===undefined)return 'undefined';if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
function equal(a,b){return canonical(a)===canonical(b);}
function snapshot(state){F.validate(state);const out={schema:1};for(const key of collections)out[key]=clone(state[key]).sort((a,b)=>a.id.localeCompare(b.id));return out;}
function apply(local,payload){if(!payload||payload.schema!==1)throw Error('Formato de sincronização incompatível.');const next=clone(local);for(const key of collections){if(!Array.isArray(payload[key]))throw Error('Dados remotos incompletos.');next[key]=clone(payload[key]);}return F.validate(next);}
// Three-way merge, with deletions inferred against the last confirmed baseline.
// A conflicting edit never wins silently. No timestamps or device clocks decide it.
function merge(base,local,remote){
 if(!base||base.schema!==1||local?.schema!==1||remote?.schema!==1)throw Error('Base de sincronização inválida.');
 const merged={schema:1},conflicts=[];
 for(const key of collections){const b=new Map(base[key].map(x=>[x.id,x])),l=new Map(local[key].map(x=>[x.id,x])),r=new Map(remote[key].map(x=>[x.id,x]));merged[key]=[];
 for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){const before=b.get(id),left=l.get(id),right=r.get(id);let chosen;
 if(equal(left,right))chosen=left;else if(equal(left,before))chosen=right;else if(equal(right,before))chosen=left;else{conflicts.push({collection:key,id,base:before??null,local:left??null,remote:right??null});continue;}
 if(chosen)merged[key].push(clone(chosen));}
 merged[key].sort((a,b)=>a.id.localeCompare(b.id));}
 return {data:conflicts.length?null:merged,conflicts};
}
return {snapshot,apply,merge,equal};});
