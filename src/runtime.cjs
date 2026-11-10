const path=require('node:path');
const fs=require('node:fs/promises');

function apiConfiguration(value,{development=false}={}){
 const url=new URL(value);
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.pathname!=='/api/'||url.username||url.password||url.search||url.hash||
   !(url.protocol==='https:'||(development&&loopback&&url.protocol==='http:')))
  throw Error('The desktop API must be an HTTPS URL ending in /api/. Development HTTP is restricted to loopback.');
 return {apiUrl:url.href,origin:url.origin,scheme:url.protocol.slice(0,-1)};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.ico':'image/x-icon','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf',
 '.mp3':'audio/mpeg','.mp4':'video/mp4','.txt':'text/plain; charset=utf-8'};
function isAppPath(name){return name==='/'||/^\/(?:admin|campaign)(?:\/|$)/.test(name)||
 /^\/(?:login|forgot-password)\/?$/.test(name)||/^\/reset-password\/[^/]+\/[^/]+\/?$/.test(name);}
async function localResponse(request,{origin,root}){
 const url=new URL(request.url);
 if(url.origin!==origin||/^\/(?:api|media|private-media)(?:\/|$)/.test(url.pathname))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 let name;
 try{name=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
 if(name.includes('\\')||name.includes('\0'))return new Response('Invalid path',{status:400});
 const base=path.resolve(root);
 let file=path.resolve(base,'.'+name);
 if(file!==base&&!file.startsWith(base+path.sep))return new Response('Forbidden',{status:403});
 if(isAppPath(name))file=path.join(base,'index.html');
 try{
  const body=await fs.readFile(file);
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){if(['ENOENT','EISDIR','ENOTDIR'].includes(e.code))return new Response('Not found',{status:404});throw e;}
}
function webPreferences(preload){return {preload,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false};}
function apiRequestWithOrigin(request,origin){
 // Electron's protocol Request loses the browser-generated Origin/Referer.
 // Restore our bundled document's origin for same-origin unsafe API requests.
 // Never replace a supplied (possibly hostile) origin or any CSRF/token data.
 const url=new URL(request.url);
 if(url.origin!==origin||!url.pathname.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(request.method)||request.headers.has('origin'))return request;
 const headers=new Headers(request.headers);headers.set('Origin',origin);
 return new Request(request,{headers});
}
function safeExternal(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
module.exports={apiConfiguration,localResponse,webPreferences,safeExternal,isAppPath,apiRequestWithOrigin};
