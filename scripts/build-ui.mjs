import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.resolve(root,'../Frontend-Hotel-System');
const require=createRequire(path.join(web,'package.json'));
// Resolve the web project's exact Vite version without installing a second UI.
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
process.chdir(web);
const previous=process.env.VITE_API_URL;
process.env.VITE_API_URL='/api/';
try{await build({root:web,configFile:path.join(web,'vite.config.mjs'),mode:'production',
  build:{outDir:path.join(root,'renderer'),emptyOutDir:true}});}
finally{if(previous===undefined)delete process.env.VITE_API_URL;else process.env.VITE_API_URL=previous;}
await readFile(path.join(root,'renderer/index.html'));
console.log('Shared web interface built into Desktop-Hotel-System/renderer.');
