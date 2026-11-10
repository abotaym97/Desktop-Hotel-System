const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),stay=Number(process.env.QA_STAY_ID),branch=Number(process.env.QA_BRANCH_ID);
(async()=>{
 await fs.mkdir(path.join(root,'.qa'),{recursive:true});const profile=await fs.mkdtemp(path.join(root,'.qa/windows-'));
 const env={...process.env,OMDA_DESKTOP_API_URL:process.env.QA_API_ORIGIN+'/api/',OMDA_DESKTOP_USER_DATA:profile,OMDA_DESKTOP_QA:'1'};delete env.ELECTRON_RUN_AS_NODE;
 let app,main;const errors=[];
 const launch=async()=>{app=await _electron.launch({executablePath:require('electron'),args:[root],env,timeout:20000});main=await app.firstWindow();main.setDefaultTimeout(15000);main.on('pageerror',e=>errors.push(e.message));};
 const nativeAccount=async fn=>app.evaluate(({BrowserWindow},fn)=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('desktop_account=1'));return ({bounds:()=>win.getNormalBounds(),top:()=>win.isAlwaysOnTop(),parent:()=>!!win.getParentWindow()})[fn]();},fn);
 try{
  await launch();await main.getByRole('button',{name:'تغيير لغة الواجهة'}).click();
  await main.getByLabel('Email or username',{exact:true}).fill(process.env.QA_USERNAME);await main.getByLabel('Password',{exact:true}).fill(process.env.QA_PASSWORD);await main.getByRole('button',{name:'Sign in',exact:true}).click();
  await main.waitForURL('**/admin/dashboard');await main.getByRole('button',{name:'Account options',exact:true}).waitFor();
  await app.evaluate(({Menu})=>new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(Menu.getApplicationMenu().getMenuItemById('desktop-command-billing')){clearInterval(timer);resolve(true);}else if(Date.now()-start>8000){clearInterval(timer);reject(Error('Desktop command catalog unavailable'));}},50);}));
  await main.evaluate(()=>document.activeElement?.blur());await main.keyboard.press('Alt+l');await main.waitForURL('**/admin/billing');
  await main.keyboard.press('Alt+b');await main.waitForURL('**/admin/bookings');
  await main.evaluate(()=>{const input=document.createElement('input');input.id='desktop-alt-probe';document.body.append(input);input.focus();});await main.waitForTimeout(120);
  await main.keyboard.press('Alt+l');await main.waitForTimeout(100);assert.match(main.url(),/\/admin\/bookings$/);
  await main.evaluate(()=>document.querySelector('#desktop-alt-probe').remove());
  await main.goto(process.env.QA_API_ORIGIN+'/admin/bookings/'+stay);await main.getByRole('heading',{name:'Booking details',exact:true}).waitFor();
  const created=app.waitForEvent('window');await main.getByRole('link',{name:'Room account',exact:true}).click();let account=await created;account.setDefaultTimeout(15000);account.on('pageerror',e=>errors.push(e.message));
  await account.getByRole('heading',{name:'Account ledger',exact:true}).waitFor();
  assert.match(main.url(),new RegExp('/admin/bookings/'+stay+'$'));assert.equal(await account.evaluate(()=>window.omdaDesktop.kind),'account');
  assert.equal(await account.evaluate(()=>sessionStorage.getItem('hotel-property')),String(branch));assert.equal(await account.evaluate(()=>typeof require),'undefined');
  await main.getByRole('link',{name:'Room account',exact:true}).click();assert.equal(app.windows().length,2);
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('desktop-top').click());assert.equal(await nativeAccount('top'),true);
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('desktop-attach').click());assert.equal(await nativeAccount('parent'),true);
  await account.evaluate(()=>window.omdaDesktop.setBusy(1));await account.waitForTimeout(80);await account.evaluate(()=>window.omdaDesktop.close());await account.waitForTimeout(80);assert.equal(account.isClosed(),false);
  let navigations=0;const navigation=()=>navigations++;account.on('framenavigated',navigation);
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('desktop-reload').click());await account.keyboard.press('F5');await account.waitForTimeout(150);assert.equal(navigations,0);account.off('framenavigated',navigation);
  await account.evaluate(()=>window.omdaDesktop.setBusy(0));
  const next=app.waitForEvent('window');await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('desktop-new-window').click());const extra=await next;extra.setDefaultTimeout(15000);await extra.getByRole('button',{name:'Account options',exact:true}).waitFor();
  assert.equal(await extra.evaluate(()=>sessionStorage.getItem('hotel-property')),String(branch));
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('desktop-arrange').click());
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>w.getBounds()));assert.equal(bounds.length,3);
  assert(bounds.every(b=>b.width>0&&b.height>0));
  await app.evaluate(({BrowserWindow,screen})=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('desktop_account=1'));const a=screen.getPrimaryDisplay().workArea;win.setMinimumSize(850,650);win.setBounds({x:a.x+60,y:a.y+50,width:1050,height:780});});
  const saved=await nativeAccount('bounds');const closed=account.waitForEvent('close');await account.getByRole('button',{name:'Close',exact:true}).first().click();await closed;
  const reopened=app.waitForEvent('window');await main.getByRole('link',{name:'Room account',exact:true}).click();account=await reopened;account.setDefaultTimeout(15000);await account.getByRole('heading',{name:'Account ledger',exact:true}).waitFor();
  const restored=await nativeAccount('bounds');for(const key of ['x','y','width','height'])assert.ok(Math.abs(restored[key]-saved[key])<=3,`Restored ${key} drifted: ${restored[key]} / ${saved[key]}`);assert.equal(await nativeAccount('top'),true);assert.equal(await nativeAccount('parent'),true);
  // A real synthetic charge proves server-backed account updates reach the
  // booking left open behind the child window, with no second financial ledger.
  await account.getByRole('button',{name:'Add charge',exact:true}).click();const form=account.getByRole('dialog',{name:'Extra charge',exact:true});
  await form.getByLabel('Amount',{exact:true}).fill('1000');await form.getByLabel('Description / reason',{exact:true}).fill('Desktop window acceptance charge');
  await form.getByRole('button',{name:'Record entry',exact:true}).click();await account.getByText('Desktop window acceptance charge',{exact:true}).waitFor();
  await main.waitForFunction(()=>document.body.textContent.includes('21,000'));
  await form.waitFor({state:'hidden'});
  await account.waitForTimeout(250); // Let the native compositor finish the dialog transition.
  const screenshot=await app.evaluate(async({BrowserWindow})=>Array.from((await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('desktop_account=1')).webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG()));
  await fs.writeFile(path.join(root,'.qa/native-room-account.png'),Buffer.from(screenshot));
  await extra.goto(process.env.QA_API_ORIGIN+'/admin/dashboard');await extra.getByRole('button',{name:'Account options',exact:true}).click();await extra.getByRole('button',{name:'Log out',exact:true}).click();
  await extra.waitForURL('**/login');await main.waitForURL('**/login');assert.equal(account.isClosed(),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['Alt native shortcuts','Alt typing guard','native room account','parent booking retained','one account window per stay/branch','busy close guard','shared authenticated workspace','always on top','parent attachment','tiling','saved geometry','cross-window financial refresh','global logout'],windows:3}));
 }catch(e){try{console.error('Main UI:',(await main.locator('body').innerText({timeout:3000})).slice(0,1200));}catch{}throw e;}
 finally{if(app){const timeout=setTimeout(()=>app.process()?.kill(),8000);timeout.unref();await app.close().catch(()=>{});clearTimeout(timeout);}await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
