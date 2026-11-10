const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'.qa'),{recursive:true});
 const profile=await fs.mkdtemp(path.join(root,'.qa/session-'));
 const env={...process.env,OMDA_DESKTOP_API_URL:process.env.QA_API_ORIGIN+'/api/',OMDA_DESKTOP_USER_DATA:profile,OMDA_DESKTOP_QA:'1'};
 delete env.ELECTRON_RUN_AS_NODE;
 let app,activePage;const errors=[],network=[];
 const launch=async()=>{const current=await _electron.launch({executablePath:require('electron'),args:[root],env,timeout:20000});
  const page=await current.firstWindow();activePage=page;page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.status()>=400&&response.url().includes('/api/'))network.push({status:response.status(),path:new URL(response.url()).pathname});});
  return {current,page};};
 try{
  let opened=await launch();app=opened.current;let page=opened.page;
  await page.getByRole('button',{name:'تغيير لغة الواجهة'}).click();
  await page.getByLabel('Email or username',{exact:true}).fill(process.env.QA_USERNAME);
  await page.getByLabel('Password',{exact:true}).fill(process.env.QA_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/admin/dashboard');
  await page.getByRole('button',{name:'Account options',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>typeof require),'undefined');
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox),true);
  const cookie=await app.evaluate(async({session})=>(await session.defaultSession.cookies.get({name:'hotel_refresh'})).map(c=>({httpOnly:c.httpOnly})));
  assert.equal(cookie.length,1);assert.equal(cookie[0].httpOnly,true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('refresh')),null);
  await page.reload();await page.waitForURL('**/admin/dashboard');await page.getByRole('button',{name:'Account options',exact:true}).waitFor();
  console.log('Login, HttpOnly cookie and refresh passed.');
  await app.evaluate(async({session})=>{await session.defaultSession.cookies.flushStore();session.defaultSession.flushStorageData();});
  await app.close();app=null;
  opened=await launch();app=opened.current;page=opened.page;
  await page.waitForURL('**/admin/dashboard');await page.getByRole('button',{name:'Account options',exact:true}).waitFor();
  console.log('Session restored after a full application restart.');
  const routes=['dashboard','bookings','billing','cashiering','revenue','reports','group-reservations','profiles','settings?tab=charges'];
  for(const width of [1440,1024]){
   await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setContentSize(width,950),width);
   for(const lang of ['en','ar']){
    if(await page.locator('html').getAttribute('lang')!==lang)await page.getByRole('button',{name:/Change interface language|تغيير لغة الواجهة/}).first().click();
    for(const route of routes){await page.evaluate(route=>{history.pushState({},'','/admin/'+route);dispatchEvent(new PopStateEvent('popstate'));},route);await page.waitForTimeout(450);
     await page.locator('main').first().waitFor({state:'attached'});
     const text=await page.locator('body').innerText();assert(!text.includes('Unable to load workspace permissions'),`${lang}/${width}/${route}: permissions unavailable`);
     assert.ok(await page.locator('#admin-sidebar nav a').count()>3,`${lang}/${width}/${route}: navigation unavailable`);
     assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${lang}/${width}/${route}`);
    }
    const png=await app.evaluate(async({BrowserWindow})=>Array.from((await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG()));
    await fs.writeFile(path.join(root,`.qa/workspace-${lang}-${width}.png`),Buffer.from(png));
   }
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,950));
  if(await page.locator('html').getAttribute('lang')!=='en')await page.getByRole('button',{name:'تغيير لغة الواجهة'}).click();
  // Exercise the shared report's real window.open/document.write flow without
  // sending anything to a physical printer during automated acceptance.
  await page.evaluate(()=>{history.pushState({},'','/admin/revenue');dispatchEvent(new PopStateEvent('popstate'));});await page.waitForTimeout(700);
  await page.context().addInitScript(()=>{window.print=()=>{window.__OMDA_PRINT_REQUESTED__=true;};window.addEventListener('omda:native-print-requested',()=>{window.__OMDA_PRINT_REQUESTED__=true;});});
  const reportWindowPromise=app.waitForEvent('window');
  await page.getByRole('button',{name:'Print Report',exact:true}).click();
  const reportWindow=await reportWindowPromise;await reportWindow.getByRole('heading',{name:'Revenue Report',exact:true}).waitFor({state:'attached'});
  assert.equal(await reportWindow.evaluate(()=>window.omdaDesktop?.available),true);
  await app.evaluate(({BrowserWindow})=>new Promise((resolve,reject)=>{const started=Date.now();const timer=setInterval(()=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='about:blank');if(win?.webContents.__omdaPrintRequested){clearInterval(timer);resolve(true);}else if(Date.now()-started>10000){clearInterval(timer);reject(Error('Native print request not received'));}},50);}));
  const pdf=await app.evaluate(async({BrowserWindow})=>Array.from(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='about:blank').webContents.printToPDF({printBackground:true,preferCSSPageSize:true})));
  const bytes=Buffer.from(pdf);assert.equal(bytes.subarray(0,4).toString(),'%PDF');await fs.writeFile(path.join(root,'.qa/revenue.pdf'),bytes);
  await reportWindow.close();
  console.log('Shared report popup and native PDF output passed.');
  const exportPath=path.join(root,'.qa/revenue.csv');
  const exported=app.evaluate(({session},filename)=>new Promise(resolve=>session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(filename);item.once('done',(_event,state)=>resolve(state));})),exportPath);
  await page.getByRole('button',{name:'Export CSV',exact:true}).click();assert.equal(await exported,'completed');
  assert.ok((await fs.stat(exportPath)).size>0);
  await page.goto(process.env.QA_API_ORIGIN+'/admin/bookings');await page.getByRole('heading',{name:'Booking Archive',exact:true}).waitFor();
  await page.reload();assert.match(page.url(),/\/admin\/bookings$/);
  await page.getByRole('heading',{name:'Booking Archive',exact:true}).waitFor();
  await page.goto(process.env.QA_API_ORIGIN+'/admin/dashboard');
  await page.getByRole('button',{name:'Account options',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();
  await page.waitForURL('**/login');
  assert.equal(await app.evaluate(async({session})=>(await session.defaultSession.cookies.get({name:'hotel_refresh'})).length),0);
  console.log('CSV download and server-side logout passed.');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,views:36,languages:['en','ar'],widths:[1440,1024],pdfBytes:bytes.length}));
 }catch(e){console.error('Failed API responses:',JSON.stringify(network));try{console.error('Visible UI:',(await activePage?.locator('body').innerText({timeout:3000}))?.slice(0,1600));}catch{}throw e;}
 finally{if(app){const timeout=setTimeout(()=>app.process()?.kill(),8000);timeout.unref();await app.close().catch(()=>{});clearTimeout(timeout);}await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
