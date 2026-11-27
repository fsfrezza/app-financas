'use strict';
// Independent preference: changing appearance never rewrites financial records.
(function(){
 const KEY='frezzatech.appearance.v1';
 let mode='light';
 try { if(localStorage.getItem(KEY)==='dark')mode='dark'; }catch(_){}
 function apply(value){
  mode=value==='dark'?'dark':'light';
  document.documentElement.dataset.theme=mode;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=mode==='dark'?'#0b1720':'#f4f7f6';
  if(window.FrezzaNative&&window.FrezzaNative.setTheme)window.FrezzaNative.setTheme(mode);
 }
 apply(mode);
 window.FrezzaTheme={get:()=>mode,set(value){apply(value);localStorage.setItem(KEY,mode);}};
})();
