const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {apiConfiguration,localResponse,webPreferences,safeExternal,apiRequestWithOrigin}=require('../src/runtime.cjs');
test('HTTPS API forwarding restores missing Origin without weakening CSRF or rewriting hostile origins',async()=>{
 const origin='https://hotel.test';
 const request=new Request(origin+'/api/auth/refresh/',{method:'POST',headers:{'X-CSRFToken':'original-token',Cookie:'csrftoken=original-cookie'},body:'{}'});
 const forwarded=apiRequestWithOrigin(request,origin);
 assert.equal(forwarded.headers.get('origin'),origin);
 assert.equal(forwarded.headers.get('X-CSRFToken'),'original-token');assert.equal(forwarded.headers.get('Cookie'),'csrftoken=original-cookie');
 assert.equal(await forwarded.text(),'{}');
 const hostile=new Request(origin+'/api/login/',{method:'POST',headers:{Origin:'https://untrusted.test'}});
 assert.equal(apiRequestWithOrigin(hostile,origin),hostile);
 const outside=new Request('https://other.test/api/login/',{method:'POST'});assert.equal(apiRequestWithOrigin(outside,origin),outside);
 const read=new Request(origin+'/api/auth/csrf/');assert.equal(apiRequestWithOrigin(read,origin),read);
});
test('release endpoints require HTTPS and development HTTP stays on loopback',()=>{
 assert.equal(apiConfiguration('https://example.test/api/').origin,'https://example.test');
 assert.equal(apiConfiguration('http://127.0.0.1:8000/api/',{development:true}).scheme,'http');
 for(const url of ['http://example.test/api/','file:///api/','https://u:p@example.test/api/','https://example.test/api/?key=x','http://127.0.0.1:8000/api/'])assert.throws(()=>apiConfiguration(url));
});
test('bundled SPA routes resolve locally while API/media never fall back to HTML',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'omda-runtime-'));
 try{await fs.writeFile(path.join(root,'index.html'),'<h1>OMDA</h1>');const config={origin:'https://hotel.test',root};
  for(const name of ['/','/login','/admin/dashboard','/admin/bookings/12','/reset-password/id/token'])assert.equal(await(await localResponse(new Request('https://hotel.test'+name),config)).text(),'<h1>OMDA</h1>');
  for(const name of ['/api/auth/csrf/','/media/document.jpg'])assert.equal(await localResponse(new Request('https://hotel.test'+name),config),null);
  assert.equal((await localResponse(new Request('https://hotel.test/assets/missing.js'),config)).status,404);
  assert.equal((await localResponse(new Request('https://hotel.test/%2e%2e%5csecret'),config)).status,400);
  assert.equal(await localResponse(new Request('https://outside.test/login'),config),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('web content is sandboxed and external URLs cannot invoke local executables',()=>{
 assert.equal(webPreferences('/preload').nodeIntegration,false);assert.equal(webPreferences('/preload').sandbox,true);assert.equal(webPreferences('/preload').webSecurity,true);
 for(const url of ['file:///C:/Windows/System32/cmd.exe','javascript:alert(1)','ms-settings:','https://u:p@example.test'])assert.equal(safeExternal(url),null);
 assert.equal(safeExternal('https://example.test/help'),'https://example.test/help');
});
