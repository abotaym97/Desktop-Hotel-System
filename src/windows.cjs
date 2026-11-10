const {BrowserWindow,screen,dialog,Menu,Tray,Notification}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {fitBounds,tileBounds,positiveId,accountDestination}=require('./window-state.cjs');
const {mnemonic}=require('./commands.cjs');
class Windows{
 constructor({app,origin,preferences,configure,qa,language,onMenu}){
  Object.assign(this,{app,origin,preferences,configure,qa,language,onMenu});this.windows=new Map();this.main=null;this.last=null;this.alerts=new Map();this.notices=new Set();this.quitting=false;
  this.file=path.join(app.getPath('userData'),'windows.json');this.state={windows:{},notifications:true};
  try{this.state={...this.state,...JSON.parse(fs.readFileSync(this.file,'utf8'))};}catch{}
  this.state.windows||={};this.printer='';this.tray=null;
  if(!Object.keys(this.state.windows).length){try{this.state.windows['workspace:1']=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'window.json'),'utf8'));}catch{}}
 }
 t(ar,en){return this.language()==='ar'?ar:en;}
 save(){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(this.state));}catch{}}
 record(win){const item=this.windows.get(win.webContents.id);if(!item)return;
  this.state.windows[item.key]={...win.getNormalBounds(),maximized:win.isMaximized(),alwaysOnTop:win.isAlwaysOnTop(),attached:!!win.getParentWindow()};
  const keys=Object.keys(this.state.windows);while(keys.length>50)delete this.state.windows[keys.shift()];this.save();
 }
 item(contents){return this.windows.get(contents.id);}
 focused(){return BrowserWindow.getFocusedWindow()||(!this.last?.isDestroyed()&&this.last)||[...this.windows.values()].find(i=>!i.win.isDestroyed())?.win||null;}
 show(win){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();if(!this.qa){win.show();win.focus();}this.last=win;this.onMenu();}
 title(item){if(item.kind==='report')return;item.win.setTitle(item.kind==='account'?'OMDA · '+this.t('حساب غرفة','Room account')+' '+(item.roomNumber||'#'+item.stayId):'OMDA');}
 async create({kind='workspace',branchId=null,stayId=null,route=null,key=null,owner=null}={}){
  branchId=positiveId(branchId);stayId=positiveId(stayId);
  if(kind==='account'){
   route=accountDestination(stayId,branchId);key=`account:${branchId}:${stayId}`;
   const current=[...this.windows.values()].find(item=>item.key===key);if(current){this.show(current.win);return current.win;}
  }
  if(this.windows.size>=12)throw Error(this.t('أغلق نافذة قبل فتح نافذة إضافية.','Close a window before opening another one.'));
  if(!key){let n=1;while([...this.windows.values()].some(item=>item.key===`workspace:${n}`))n++;key=`workspace:${n}`;}
  const saved=this.state.windows[key]||{};const bounds=fitBounds(saved,screen.getAllDisplays(),kind==='account'?{width:1160,height:900}:{width:1440,height:940});
  const win=new BrowserWindow({...bounds,minWidth:Math.min(850,bounds.width),minHeight:Math.min(650,bounds.height),show:false,title:'OMDA',
   icon:path.join(__dirname,'../resources/icon.ico'),backgroundColor:'#faf8fd',webPreferences:this.preferences()});
  const id=win.webContents.id,item={win,key,kind,branchId,stayId,busy:0,owner};this.windows.set(id,item);
  win.on('page-title-updated',event=>{event.preventDefault();this.title(item);});this.title(item);
  if(kind==='workspace'&&(!this.main||this.main.isDestroyed()))this.main=win;
  this.configure(win);
  if(saved.attached&&owner&&!owner.isDestroyed())win.setParentWindow(owner);
  if(saved.alwaysOnTop)win.setAlwaysOnTop(true);
  // Windows changes the non-client frame when an owner is assigned. Restore
  // the saved outer rectangle after applying ownership/topmost styles.
  win.setBounds(bounds);
  if(saved.maximized)win.maximize();
  win.once('ready-to-show',()=>this.show(win));
  win.on('focus',()=>{this.last=win;this.onMenu();});
  for(const event of ['move','resize','maximize','unmaximize','always-on-top-changed'])win.on(event,()=>this.record(win));
  win.on('close',event=>{
   const childBusy=[...this.windows.values()].some(other=>other.busy&&other.win.getParentWindow()===win);
   if((item.busy||childBusy)&&!this.quitting){event.preventDefault();this.busyMessage(win);return;}
   this.record(win);
  });
  win.on('closed',()=>{this.windows.delete(id);this.onMenu();});
  const destination=route||('/admin/dashboard'+(branchId?`?desktop_branch=${branchId}`:''));
  await win.loadURL(this.origin+destination);return win;
 }
 busyMessage(win){if(this.qa)return;dialog.showMessageBox(win,{type:'info',message:this.t('انتظر اكتمال العملية الحالية قبل إغلاق النافذة.','Wait for the current operation to finish before closing this window.')});}
 async restoreMain(){if(!this.main||this.main.isDestroyed())await this.create({key:'workspace:1'});else this.show(this.main);}
 adopt(win,owner){if(this.windows.has(win.webContents.id))return;
  const id=win.webContents.id;
  this.windows.set(win.webContents.id,{win,key:'report:'+win.webContents.id,kind:'report',owner,busy:0,branchId:this.item(owner.webContents)?.branchId||null});
  win.on('focus',()=>{this.last=win;this.onMenu();});win.on('closed',()=>{this.windows.delete(id);this.onMenu();});
 }
 move(win,display){if(!win)return;if(win.isMaximized())win.unmaximize();win.setBounds(fitBounds({},[display],win.getNormalBounds()));this.record(win);}
 arrange(){const displays=screen.getAllDisplays(),groups=displays.map(()=>[]);
  [...this.windows.values()].filter(i=>i.kind!=='report').forEach((i,n)=>groups[n%groups.length].push(i.win));
  groups.forEach((wins,i)=>tileBounds(displays[i].workArea,wins.length).forEach((bounds,n)=>{const win=wins[n];if(win.isMaximized())win.unmaximize();win.setMinimumSize(Math.min(850,bounds.width),Math.min(650,bounds.height));win.setBounds(bounds);this.record(win);}));
 }
 recover(){for(const {win} of this.windows.values()){if(win.isDestroyed())continue;win.setBounds(fitBounds(win.getNormalBounds(),screen.getAllDisplays()));}}
 changed(source,branchId){for(const {win} of this.windows.values())if(win.webContents!==source)win.webContents.send('omda:data-changed',{branchId});}
 sessionChanged(source,kind){
  this.alerts.clear();for(const notice of this.notices)notice.close();this.notices.clear();
  for(const item of this.windows.values())if(item.win.webContents!==source){item.busy=0;item.win.webContents.send('omda:session-invalidated');if(item.kind==='account'||item.kind==='report')item.win.destroy();}
  this.refreshTray();
 }
 receiveAlerts(source,payload){
  if(!payload||!positiveId(payload.branchId)||!Number.isInteger(payload.unread)||payload.unread<0||payload.unread>100000||!Array.isArray(payload.ids))return;
  const id=String(payload.branchId),ids=payload.ids.filter(v=>positiveId(v)).map(String).slice(0,100);
  const previous=this.alerts.get(id);this.alerts.set(id,{unread:payload.unread,ids:new Set(ids)});this.refreshTray();
  const incoming=previous?ids.filter(v=>!previous.ids.has(v)).length:payload.unread;
  const item=this.item(source);if(!item||!incoming||!this.state.notifications||[...this.windows.values()].some(i=>i.win.isFocused())||Date.now()-(this.lastNotice||0)<30000||!Notification.isSupported())return;
  this.lastNotice=Date.now();if(this.qa)return;
  const notification=new Notification({title:'OMDA',body:this.t('توجد تنبيهات جديدة في مساحة عمل الموظف.','New staff alerts are available in your workspace.'),silent:true,icon:path.join(__dirname,'../resources/icon.ico')});
  this.notices.add(notification);notification.on('click',()=>{if(item.branchId!==id)this.create({branchId:id}).catch(()=>{});else this.show(item.win);});notification.on('close',()=>this.notices.delete(notification));notification.show();
 }
 createTray(){if(this.qa)return;this.tray=new Tray(path.join(__dirname,'../resources/icon.ico'));this.tray.on('double-click',()=>this.restoreMain());this.refreshTray();}
 refreshTray(){if(!this.tray)return;const count=[...this.alerts.values()].reduce((sum,item)=>sum+item.unread,0);
  this.tray.setToolTip('OMDA'+(count?this.t(` · ${count} تنبيه`,` · ${count} alerts`):''));
  this.tray.setContextMenu(Menu.buildFromTemplate([{label:this.t('فتح OMDA','Open OMDA'),click:()=>this.restoreMain()},
   {label:this.t('نافذة جديدة','New window'),click:()=>this.create().catch(()=>{})},
   {label:this.t('الإشعارات','Notifications'),type:'checkbox',checked:this.state.notifications,click:item=>{this.state.notifications=item.checked;this.save();}},
   {type:'separator'},{label:this.t('خروج','Exit'),click:()=>this.app.quit()}]));
 }
 async chooseDownloadFolder(){const result=await dialog.showOpenDialog(this.focused(),{title:this.t('مجلد حفظ التنزيلات','Downloads folder'),properties:['openDirectory','createDirectory']});if(!result.canceled){this.state.downloadFolder=result.filePaths[0];this.save();}}
 async printers(){try{return await this.focused().webContents.getPrintersAsync();}catch{return [];}}
 async print(win=this.focused()){
  if(!win||win.isDestroyed())return;
  if(this.qa){win.webContents.__omdaPrintRequested=true;win.webContents.send('omda:print-requested');return;}
  const options={printBackground:true,silent:false};if(this.state.printer)options.deviceName=this.state.printer;
  win.webContents.print(options,(ok,reason)=>{if(!ok&&!/cancel/i.test(reason||'')&&!this.qa)dialog.showMessageBox(win,{type:'error',message:this.t('تعذرت الطباعة. راجع الطابعة المختارة.','Printing failed. Check the selected printer.')});});
 }
 menu(){const win=this.focused(),item=win&&this.item(win.webContents),t=(ar,en)=>this.t(ar,en);
  const m=(ar,en,key)=>mnemonic(ar,en,key,this.language());
  return {label:mnemonic('النوافذ','Windows','W',this.language()),submenu:[
   {id:'desktop-new-window',label:m('نافذة عمل جديدة','New workspace window','N'),accelerator:'CmdOrCtrl+Shift+N',click:()=>this.create({branchId:item?.branchId}).catch(()=>{})},
   {id:'desktop-attach',label:m('البقاء فوق النافذة الرئيسية','Keep above main window','K'),type:'checkbox',checked:!!win?.getParentWindow(),enabled:!!win&&win!==this.main,
    click:entry=>{win.setParentWindow(entry.checked&&this.main&&!this.main.isDestroyed()?this.main:null);this.record(win);this.onMenu();}},
   {id:'desktop-top',label:m('دائمًا في المقدمة','Always on top','T'),type:'checkbox',checked:!!win?.isAlwaysOnTop(),accelerator:'CmdOrCtrl+Shift+T',enabled:!!win,
    click:entry=>{win.setAlwaysOnTop(entry.checked);this.record(win);this.onMenu();}},
   {label:m('نقل إلى شاشة','Move to display','D'),submenu:screen.getAllDisplays().map((display,i)=>({id:'desktop-display-'+display.id,label:display.label||t(`الشاشة ${i+1}`,`Display ${i+1}`),click:()=>this.move(win,display)}))},
   {id:'desktop-arrange',label:m('ترتيب النوافذ على الشاشات','Arrange windows across displays','A'),accelerator:'CmdOrCtrl+Shift+A',click:()=>this.arrange()},
   {id:'desktop-tray',label:m('إخفاء بجانب الساعة','Hide to tray','M'),accelerator:'CmdOrCtrl+Shift+M',enabled:!!win,click:()=>win.hide()},
   {id:'desktop-main',label:m('استعادة النافذة الرئيسية','Restore main window','R'),click:()=>this.restoreMain()},
   {type:'separator'},...[...this.windows.values()].map((i,n)=>({label:(n+1)+'. '+(i.kind==='account'?t('حساب غرفة','Room account')+' '+(i.roomNumber||'#'+i.stayId):i.kind==='report'?t('تقرير','Report'):t('مساحة عمل','Workspace')),click:()=>this.show(i.win)}))]};
 }
}
module.exports={Windows};
