const fs=require('node:fs'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['src/cloud.js'],bundle:true,format:'iife',target:['es2020'],minify:true,outfile:'web/js/cloud.js',legalComments:'eof'});
const configPath='config/cloud.public.json';
if(fs.existsSync(configPath)){
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||''))throw Error('Invalid Supabase URL');
 if(typeof config.publishableKey!=='string'||config.publishableKey.length<20||config.publishableKey.startsWith('sb_secret_'))throw Error('A public publishable key is required');
 // Legacy JWT keys: reject service_role, even though it is syntactically a JWT.
 if(config.publishableKey.startsWith('eyJ')){const claims=JSON.parse(Buffer.from(config.publishableKey.split('.')[1],'base64url'));if(claims.role!=='anon')throw Error('Only anon legacy keys may be bundled');}
 fs.writeFileSync('web/js/cloud-config.js','window.FrezzaCloudConfig=Object.freeze('+JSON.stringify({...config,enabled:true})+');\n');
 fs.writeFileSync('web/cloud-public.json',JSON.stringify(config));
}else {fs.writeFileSync('web/js/cloud-config.js','window.FrezzaCloudConfig=Object.freeze({enabled:false});\n');fs.writeFileSync('web/cloud-public.json','{}');}
console.log('Cloud client bundled; configured:',fs.existsSync(configPath));
