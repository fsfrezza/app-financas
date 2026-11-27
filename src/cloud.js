import {createClient} from '@supabase/supabase-js';
const cfg=window.FrezzaCloudConfig||{},S=window.FinanceSync;
const enabled=cfg.enabled===true&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl||'')&&typeof cfg.publishableKey==='string'&&cfg.publishableKey.length>20;
const native=!!window.FrezzaNative,redirect=native?'br.com.frezzatech.financas://auth/callback':cfg.webRedirectUrl;
const authStorage=native&&window.FrezzaNative.authGet?{getItem:key=>window.FrezzaNative.authGet(key),setItem:(key,value)=>window.FrezzaNative.authSet(key,value),removeItem:key=>window.FrezzaNative.authRemove(key)}:window.localStorage;
const client=enabled?createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:!native,persistSession:true,autoRefreshToken:true,storageKey:'frezzatech.auth.v1',storage:authStorage}}):null;
let user=null,busy=false,lastError='',syncError='',lastSync='',timer,activation=0;
const baselineKey=id=>'frezzatech.sync.baseline.'+id;
const enabledKey=id=>'frezzatech.sync.enabled.'+id;
function notify(){window.dispatchEvent(new Event('frezzatech-cloud-change'));}
function requireClient(){if(!client)throw Error('A sincronização ainda aguarda a configuração do serviço online. O modo offline continua disponível.');return client;}
function errorText(error){return error?.message||'Não foi possível acessar a conta. Tente novamente.';}
async function sync(){
 if(!client||!user||busy||localStorage.getItem(enabledKey(user.id))!=='true')return;
 const account=user.id,epoch=activation;
 if(window.FinanceApp.account()!==account)return;
 busy=true;syncError='';notify();
 try{
  // Serial optimistic writes. A stale response cannot switch another profile.
  for(let attempt=0;attempt<3;attempt++){
   const {data:rows,error}=await client.from('finance_vaults').select('revision,payload,updated_at').eq('user_id',account).limit(1);
   if(error)throw error;if(account!==user?.id||epoch!==activation)return;
   const remote=rows[0]||null,current=S.snapshot(window.FinanceApp.get());
   let base;try{base=JSON.parse(localStorage.getItem(baselineKey(account))||'null');}catch(_){throw Error('A referência local está inválida. Exporte um backup antes de reconectar.');}
   if(!base&&remote){
    syncError='Esta conta já tem dados online. Escolha “Baixar dados da conta” para iniciar neste aparelho. Exporte um backup local antes.';return;
   }
   let candidate=current;
   if(base&&remote){const merged=S.merge(base.payload,current,remote.payload);if(merged.conflicts.length){syncError=`${merged.conflicts.length} conflito(s). Exporte um backup e escolha qual versão manter.`;return;}candidate=merged.data;}
   if(base&&!remote)throw Error('O histórico online não foi encontrado. A sincronização foi interrompida para preservar os dados.');
   S.apply(window.FinanceApp.get(),candidate); // Validate cross-record relationships.
   if(remote&&S.equal(candidate,remote.payload)){
    // Merge again if the user edited locally during the network request.
    const latest=S.snapshot(window.FinanceApp.get()),m=S.merge(current,latest,candidate);
    if(m.conflicts.length){syncError='Há alterações locais concorrentes. Sincronize novamente.';return;}
    window.FinanceApp.apply(m.data);
    localStorage.setItem(baselineKey(account),JSON.stringify(remote));lastSync=new Date().toISOString();return;
   }
   const {data:saved,error:writeError}=await client.rpc('save_finance_vault',{expected_revision:remote?.revision||0,next_payload:candidate,expected_user:account});
   if(writeError)throw writeError;if(account!==user?.id||epoch!==activation)return;
   if(!saved?.length)continue;
   const latest=S.snapshot(window.FinanceApp.get()),m=S.merge(current,latest,candidate);
   localStorage.setItem(baselineKey(account),JSON.stringify(saved[0]));
   if(m.conflicts.length){syncError='Uma edição ocorreu durante o envio. O rascunho local foi preservado.';return;}
   window.FinanceApp.apply(m.data);lastSync=new Date().toISOString();
   if(!S.equal(m.data,candidate))setTimeout(sync,300);
   return;
  }
  throw Error('Outro aparelho está atualizando os dados. Tente sincronizar novamente.');
 }catch(error){syncError=errorText(error);}finally{busy=false;notify();}
}
async function activate(nextUser){
 activation++;user=nextUser;syncError='';lastError='';
 if(!window.FinanceApp)return;
 if(user){window.FinanceApp.activate(user.id);if(localStorage.getItem(enabledKey(user.id))==='true')setTimeout(sync,0);}
 else window.FinanceApp.activate(null);
 notify();
}
const api={
 available:enabled,
 status:()=>({configured:enabled,user:user?{id:user.id,email:user.email}:null,busy,error:lastError,syncError,lastSync,enabled:user&&localStorage.getItem(enabledKey(user.id))==='true',googleEnabled:enabled&&cfg.googleEnabled===true}),
 async signIn(email,password){const {data,error}=await requireClient().auth.signInWithPassword({email,password});if(error)throw error;await activate(data.user);},
 async signUp(email,password){if(password.length<12)throw Error('Use uma senha com pelo menos 12 caracteres.');const {data,error}=await requireClient().auth.signUp({email,password,options:{emailRedirectTo:cfg.webRedirectUrl}});if(error)throw error;if(data.session)await activate(data.user);return !!data.session;},
 async updatePassword(password){if(password.length<12)throw Error('Use pelo menos 12 caracteres.');const {error}=await requireClient().auth.updateUser({password});if(error)throw error;},
 async reset(email){const {error}=await requireClient().auth.resetPasswordForEmail(email,{redirectTo:cfg.webRedirectUrl});if(error)throw error;},
 async google(){if(!cfg.googleEnabled)throw Error('O acesso com Google ainda não foi configurado.');const {data,error}=await requireClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect,skipBrowserRedirect:true}});if(error)throw error;if(native)window.FrezzaNative.openAuth(data.url);else window.location.assign(data.url);},
 async callback(url){const parsed=new URL(url);if(parsed.protocol!=='br.com.frezzatech.financas:'||parsed.host!=='auth'||parsed.pathname!=='/callback')throw Error('Retorno de autenticação inválido.');const code=parsed.searchParams.get('code');if(!code)throw Error('O login não retornou um código de autorização.');const {data,error}=await requireClient().auth.exchangeCodeForSession(code);if(error)throw error;await activate(data.user);},
 async enable(){if(!user)throw Error('Entre na sua conta primeiro.');localStorage.setItem(enabledKey(user.id),'true');notify();await sync();},
 pause(){if(user)localStorage.setItem(enabledKey(user.id),'false');notify();},
 async download(){if(!user)throw Error('Entre na sua conta.');if(busy)throw Error('Aguarde a sincronização atual.');const account=user.id,epoch=activation,before=S.snapshot(window.FinanceApp.get());const {data,error}=await requireClient().from('finance_vaults').select('revision,payload,updated_at').eq('user_id',account).limit(1);if(error)throw error;if(account!==user?.id||epoch!==activation)return;if(!data[0])throw Error('Esta conta ainda não tem dados online.');if(!S.equal(before,S.snapshot(window.FinanceApp.get())))throw Error('Os dados locais mudaram durante o download. Exporte um backup e tente novamente.');window.FinanceApp.apply(data[0].payload);localStorage.setItem(baselineKey(account),JSON.stringify(data[0]));lastSync=new Date().toISOString();syncError='';notify();},
 async signOut(){activation++;clearTimeout(timer);const {error}=await requireClient().auth.signOut({scope:'local'});if(error)throw error;await activate(null);},
 changed(){clearTimeout(timer);timer=setTimeout(sync,1500);},
 sync,
 async start(){if(!client){notify();return;}const {data,error}=await client.auth.getSession();if(error)lastError=errorText(error);else if(data.session?.user)await activate(data.session.user);else if(navigator.onLine||!window.FinanceApp.account())await activate(null);client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(event==='SIGNED_OUT'&&!navigator.onLine){user=null;notify();return;}if(session?.user?.id!==user?.id)activate(session?.user||null);},0);});window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});setInterval(()=>{if(!document.hidden)sync();},60000);notify();}
};
window.FrezzaCloud=api;
window.frezzaAuthCallback=url=>api.callback(url).catch(err=>{lastError=errorText(err);notify();});
window.addEventListener('frezzatech-local-change',()=>api.changed());
window.addEventListener('frezzatech-app-ready',()=>api.start());
