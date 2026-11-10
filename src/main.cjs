const {app,BrowserWindow,Menu,session,dialog,shell,ipcMain,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {apiConfiguration,localResponse,webPreferences,safeExternal,apiRequestWithOrigin}=require('./runtime.cjs');
const config=require('../desktop.config.json');
const {Windows}=require('./windows.cjs');
const {positiveId}=require('./window-state.cjs');
const {commands,commandIds,mnemonic,altCommand}=require('./commands.cjs');
const development=!app.isPackaged;
const target=apiConfiguration(development&&process.env.OMDA_DESKTOP_API_URL||config.apiUrl,{development});
if(development&&process.env.OMDA_DESKTOP_USER_DATA)app.setPath('userData',path.resolve(process.env.OMDA_DESKTOP_USER_DATA));
app.setName('OMDA');app.setAppUserModelId('com.omda.hotel.desktop');
const preload=path.join(__dirname,'preload.cjs');
const renderer=development&&process.env.OMDA_DESKTOP_RENDERER?path.resolve(process.env.OMDA_DESKTOP_RENDERER):path.join(__dirname,'../renderer');
let windows,language='ar';
const qa=development&&process.env.OMDA_DESKTOP_QA==='1';
const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
app.on('second-instance',()=>windows?.restoreMain());
const arabic=()=>language==='ar';
function preferences(){return {...webPreferences(preload),devTools:development};}
function trusted(contents){try{return contents.mainFrame.origin===target.origin||(windows?.item(contents)?.kind==='report'&&contents.getURL()==='about:blank');}catch{return false;}}
async function savePdf(){
 const window=windows?.focused();if(!window||!trusted(window.webContents))return;
 const result=await dialog.showSaveDialog(window,{title:arabic()?'حفظ PDF':'Save PDF',defaultPath:'OMDA-report.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
 if(!result.canceled){try{await fs.promises.writeFile(result.filePath,await window.webContents.printToPDF({printBackground:true,preferCSSPageSize:true}));}
 catch{await dialog.showMessageBox(window,{type:'error',message:arabic()?'تعذر حفظ التقرير.':'Could not save the report.'});}}
}
function setMenu(){
 const t=(ar,en)=>arabic()?ar:en;
 const m=(ar,en,key)=>mnemonic(ar,en,key,language);
 const focused=windows?.focused(),context=focused&&windows.item(focused.webContents);
 const available=commands.filter(c=>context?.commands?.includes(c.id));
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:m('ملف','File','F'),submenu:[{label:m('طباعة','Print','P'),accelerator:'CmdOrCtrl+P',click:()=>windows?.print()},
   {label:m('حفظ PDF','Save PDF','S'),accelerator:'CmdOrCtrl+Shift+S',click:savePdf},
   {label:t('اختيار طابعة التطبيق','Application printer'),submenu:[{label:t('طابعة Windows الافتراضية','Windows default printer'),type:'radio',checked:!windows?.state.printer,click:()=>{delete windows.state.printer;windows.save();setMenu();}},...(windows?.printerList||[]).map(p=>({label:p.displayName||p.name,type:'radio',checked:windows.state.printer===p.name,click:()=>{windows.state.printer=p.name;windows.save();setMenu();}})),{type:'separator'},{label:t('تحديث قائمة الطابعات','Refresh printers'),click:async()=>{windows.printerList=await windows.printers();setMenu();}}]},
   {label:m('اختيار مجلد التنزيلات','Choose downloads folder','D'),click:()=>windows?.chooseDownloadFolder()},
   {type:'separator'},{label:m('خروج','Exit','X'),role:'quit'}]},
  {label:m('تحرير','Edit','E'),submenu:[{label:t('تراجع','Undo'),role:'undo'},{label:t('إعادة','Redo'),role:'redo'},
   {type:'separator'},{label:t('قص','Cut'),role:'cut'},{label:t('نسخ','Copy'),role:'copy'},{label:t('لصق','Paste'),role:'paste'},{label:t('تحديد الكل','Select all'),role:'selectAll'}]},
  {label:m('عرض','View','V'),submenu:[{id:'desktop-reload',label:t('إعادة تحميل','Reload'),accelerator:'CmdOrCtrl+R',click:()=>{const win=windows?.focused();if(!win)return;if(windows.item(win.webContents)?.busy)windows.busyMessage(win);else win.webContents.reload();}},{label:t('الحجم الأصلي','Actual size'),role:'resetZoom'},
   {label:t('تكبير','Zoom in'),role:'zoomIn'},{label:t('تصغير','Zoom out'),role:'zoomOut'},{label:t('ملء الشاشة','Full screen'),role:'togglefullscreen'},
   ...(development?[{type:'separator'},{role:'toggleDevTools'}]:[])]},
  ...(windows?[windows.menu()]:[]),
  ...(available.length?[{id:'desktop-actions',label:m('الأوامر','Actions','A'),submenu:available.map(c=>({id:'desktop-command-'+c.id,label:m(c.ar,c.en,c.key),accelerator:'Alt+'+c.key,enabled:!context.editing&&!context.busy,click:()=>{const win=windows.focused(),item=win&&windows.item(win.webContents);if(item?.commands?.includes(c.id)&&!item.editing&&!item.busy)win.webContents.send('omda:command',c.id);}}))}]:[]),
  {label:m('مساعدة','Help','H'),submenu:[{label:t('اختصارات Alt','Alt shortcuts'),click:()=>dialog.showMessageBox(windows?.focused(),{title:'OMDA',message:t('اضغط Alt لتفعيل القوائم، ثم اختر بالحرف أو الأسهم وEnter.','Press Alt to activate menus, then use a letter or arrows and Enter.'),detail:'Alt+F: '+t('ملف','File')+'\nAlt+W: '+t('النوافذ','Windows')+'\nAlt+A: '+t('الأوامر','Actions')+'\n'+available.map(c=>'Alt+'+c.key+': '+t(c.ar,c.en)).join('\n')})},{label:t('حول OMDA','About OMDA'),click:()=>dialog.showMessageBox(windows?.focused(),{type:'info',title:'OMDA',message:'OMDA '+app.getVersion(),detail:t('نظام إدارة الفندق — تطبيق ويندوز','Hotel management — Windows desktop')})}]}]));
 windows?.refreshTray();
}
function configureWindow(win){
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.webContents.on('will-navigate',(event,value)=>{if(windows?.item(win.webContents)?.busy){event.preventDefault();windows.busyMessage(win);return;}if(new URL(value).origin!==target.origin){event.preventDefault();const url=safeExternal(value);if(url)shell.openExternal(url).catch(()=>{});}});
 win.webContents.on('before-input-event',(event,input)=>{
  if(input.type==='keyDown'&&input.key==='F5'){event.preventDefault();if(windows?.item(win.webContents)?.busy)windows.busyMessage(win);else win.webContents.reload();return;}
  const command=altCommand(input);if(command){event.preventDefault();const item=windows?.item(win.webContents);if(item?.commands?.includes(command)&&!item.busy&&!item.editing&&!input.isAutoRepeat)win.webContents.send('omda:command',command);}
 });
 win.webContents.on('will-redirect',(event,value)=>{if(new URL(value).origin!==target.origin)event.preventDefault();});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(url==='about:blank'||url.startsWith('blob:'+target.origin+'/')||safeExternal(url)&&new URL(url).origin===target.origin)
   return {action:'allow',overrideBrowserWindowOptions:{show:!(development&&process.env.OMDA_DESKTOP_QA==='1'),autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:preferences()}};
  const external=safeExternal(url);if(external)shell.openExternal(external).catch(()=>{});return {action:'deny'};
 });
 win.webContents.on('did-create-window',child=>{windows?.adopt(child,win);configureWindow(child);});
}
app.whenReady().then(async()=>{
 if(!primary)return;
 if(!fs.existsSync(path.join(renderer,'index.html')))throw Error('Build the shared web interface first: npm run build:ui');
 const ses=session.defaultSession;
 windows=new Windows({app,origin:target.origin,preferences,configure:configureWindow,qa,language:()=>language,onMenu:setMenu});
 const sender=event=>event.senderFrame===event.sender.mainFrame&&trusted(event.sender)?windows.item(event.sender):null;
 ipcMain.on('omda:context',event=>{const item=windows.item(event.sender);event.returnValue=item&&event.senderFrame===event.sender.mainFrame?{kind:item.kind,branchId:item.branchId,altCommands:Object.fromEntries(commands.map(c=>[c.key,c.id]))}:{};});
 ipcMain.handle('omda:open-account',async(event,value)=>{const item=sender(event);if(!item||!positiveId(value?.stayId)||!positiveId(value?.branchId))throw Error('Invalid room account request');await windows.create({kind:'account',branchId:value.branchId,stayId:value.stayId,owner:item.win});return true;});
 ipcMain.on('omda:close',event=>sender(event)?.win.close());
 ipcMain.on('omda:busy',(event,count)=>{const item=sender(event);if(item&&Number.isInteger(count)&&count>=0&&count<=100){item.busy=count;setMenu();}});
 ipcMain.on('omda:changed',(event,value)=>{if(sender(event)&&positiveId(value?.branchId))windows.changed(event.sender,Number(value.branchId));});
 ipcMain.on('omda:session',(event,kind)=>{if(sender(event)&&['logout','login','switch'].includes(kind))windows.sessionChanged(event.sender,kind);});
 ipcMain.on('omda:alerts',(event,value)=>{if(sender(event))windows.receiveAlerts(event.sender,value);});
 ipcMain.on('omda:branch',(event,id)=>{const item=sender(event);if(item&&item.kind==='workspace'&&positiveId(id))item.branchId=String(id);});
 ipcMain.on('omda:commands',(event,ids)=>{const item=sender(event);if(item){item.commands=commandIds(ids);setMenu();}});
 ipcMain.on('omda:editing',(event,value)=>{const item=sender(event);if(item&&typeof value==='boolean'){item.editing=value;setMenu();}});
 ipcMain.on('omda:print',event=>{const item=sender(event);if(item)windows.print(item.win);});
 ipcMain.on('omda:account-title',(event,value)=>{const item=sender(event);if(item?.kind==='account'&&String(value?.stayId)===item.stayId&&typeof value.roomNumber==='string'&&value.roomNumber.length<=32&&!/[\r\n\u0000-\u001f]/.test(value.roomNumber)){item.roomNumber=value.roomNumber;windows.title(item);setMenu();}});
 // Serve the signed, bundled UI at the API's origin. Real API/media requests
 // retain Chromium's TLS, cookie and CSRF handling; there is no token bridge.
 await ses.protocol.handle(target.scheme,async request=>await localResponse(request,{origin:target.origin,root:renderer})||ses.fetch(apiRequestWithOrigin(request,target.origin),{bypassCustomProtocolHandlers:true}));
 ses.setPermissionCheckHandler((contents,permission,origin)=>{try{return trusted(contents)&&new URL(origin).origin===target.origin&&['media','geolocation','clipboard-sanitized-write'].includes(permission);}catch{return false;}});
 ses.setPermissionRequestHandler(async(contents,permission,callback)=>{
  if(!trusted(contents)||!['media','geolocation'].includes(permission)){callback(false);return;}
  const result=await dialog.showMessageBox(BrowserWindow.fromWebContents(contents),{type:'question',buttons:arabic()?['سماح','إلغاء']:['Allow','Cancel'],defaultId:1,cancelId:1,
   message:permission==='geolocation'?(arabic()?'السماح بالوصول إلى موقع الجهاز للتحقق من ضوابط العمل؟':'Allow device location for work access checks?'):(arabic()?'السماح باستخدام الكاميرا؟':'Allow camera access?')});callback(result.response===0);
 });
 ses.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:arabic()?'حفظ الملف':'Save file',defaultPath:path.join(windows.state.downloadFolder||app.getPath('downloads'),path.basename(item.getFilename()))}));
 ipcMain.on('omda:language',(event,value)=>{if(sender(event)&&['ar','en'].includes(value)){language=value;for(const item of windows.windows.values())windows.title(item);setMenu();}});
 screen.on('display-removed',()=>windows.recover());
 app.on('before-quit',event=>{const busy=[...windows.windows.values()].find(item=>item.busy);if(busy&&!windows.quitting){event.preventDefault();windows.busyMessage(busy.win);}else windows.quitting=true;});
 setMenu();windows.createTray();await windows.create({key:'workspace:1',route:'/'});windows.printerList=await windows.printers();setMenu();
}).catch(error=>{console.error('OMDA startup:',error);if(!(development&&process.env.OMDA_DESKTOP_QA==='1'))dialog.showErrorBox('OMDA',error.message);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
