// Anonymous transport check only: no credentials, no staff/financial operations.
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'.qa'),{recursive:true});const profile=await fs.mkdtemp(path.join(root,'.qa/csrf-'));
 const env={...process.env,OMDA_DESKTOP_QA:'1',OMDA_DESKTOP_USER_DATA:profile};delete env.OMDA_DESKTOP_API_URL;delete env.ELECTRON_RUN_AS_NODE;
 let app;
 try{app=await _electron.launch({executablePath:require('electron'),args:[root],env,timeout:20000});const page=await app.firstWindow();
  await app.evaluate(({session})=>{global.__csrfTransport=[];session.defaultSession.webRequest.onBeforeSendHeaders((details,callback)=>{if(details.url.includes('/api/auth/refresh/')){const h=Object.fromEntries(Object.entries(details.requestHeaders).map(([k,v])=>[k.toLowerCase(),v]));global.__csrfTransport.push({method:details.method,origin:h.origin||null,referer:h.referer||null,csrfHeader:!!h['x-csrftoken'],csrfCookie:(h.cookie||'').includes('csrftoken=')});}callback({requestHeaders:details.requestHeaders});});});
  await page.waitForURL('**/login');
  const result=await page.evaluate(async()=>{const csrf=await fetch('/api/auth/csrf/',{credentials:'include'});const body=await csrf.json();const response=await fetch('/api/auth/refresh/',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Web-Client':'1','X-CSRFToken':body.csrf_token},body:'{}'});return {csrfStatus:csrf.status,anonymousRefreshStatus:response.status,message:(await response.json()).detail};});
  console.log(JSON.stringify(result));console.log(JSON.stringify(await app.evaluate(()=>global.__csrfTransport)));assert.equal(result.csrfStatus,200);assert.equal(result.anonymousRefreshStatus,401,'Anonymous refresh must pass CSRF then reject the missing login session.');
  const denied=await page.evaluate(async()=>(await fetch('/api/auth/refresh/',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Web-Client':'1'},body:'{}'})).status);
  assert.equal(denied,403,'Missing CSRF token must still be rejected.');console.log('HTTPS origin forwarding passes; missing CSRF remains rejected.');
 }finally{await app?.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
