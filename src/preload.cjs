const {ipcRenderer,contextBridge}=require('electron');
const context=ipcRenderer.sendSync('omda:context')||{};
if(context.branchId)sessionStorage.setItem('hotel-property',String(context.branchId));
// Specific capabilities only: no raw IPC, tokens, paths or arbitrary shell calls.
contextBridge.exposeInMainWorld('omdaDesktop',{
 available:true,kind:context.kind||'workspace',
 altCommands:context.altCommands||{},
 openAccount:value=>ipcRenderer.invoke('omda:open-account',value),
 close:()=>ipcRenderer.send('omda:close'),
 setBusy:count=>ipcRenderer.send('omda:busy',count),
 changed:value=>ipcRenderer.send('omda:changed',value),
 sessionChanged:kind=>ipcRenderer.send('omda:session',kind),
 alerts:value=>ipcRenderer.send('omda:alerts',value),
 branchChanged:id=>ipcRenderer.send('omda:branch',id),
 print:()=>ipcRenderer.send('omda:print'),
 describeAccount:value=>ipcRenderer.send('omda:account-title',value),
 setCommands:ids=>ipcRenderer.send('omda:commands',ids),
});
ipcRenderer.on('omda:data-changed',(_event,detail)=>dispatchEvent(new CustomEvent('hotel:desktop-data-changed',{detail})));
ipcRenderer.on('omda:session-invalidated',()=>{sessionStorage.removeItem('signed_out');sessionStorage.removeItem('hotel-property');location.replace('/');});
ipcRenderer.on('omda:print-requested',()=>dispatchEvent(new Event('omda:native-print-requested')));
ipcRenderer.on('omda:command',(_event,id)=>dispatchEvent(new CustomEvent('hotel:desktop-command',{detail:id})));
addEventListener('DOMContentLoaded',()=>{
 const report=()=>ipcRenderer.send('omda:language',document.documentElement.lang==='en'?'en':'ar');
 report();new MutationObserver(report).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 let previous;
 const editing=()=>{const value=!!document.querySelector('dialog[open],[aria-modal="true"]')||!!document.activeElement?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"]');if(value!==previous){previous=value;ipcRenderer.send('omda:editing',value);}};
 document.addEventListener('focusin',editing);document.addEventListener('focusout',()=>setTimeout(editing,0));
 new MutationObserver(editing).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','aria-modal']});editing();
});
