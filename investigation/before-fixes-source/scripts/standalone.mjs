import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
let html=await readFile(path.join(dist,'index.html'),'utf8');
const jsFiles=(await readdir(path.join(dist,'assets'))).filter(n=>n.endsWith('.js'));
if(jsFiles.length!==1)throw new Error('Standalone build requires one bundled JS file; found '+jsFiles.length);
const js=await readFile(path.join(dist,'assets',jsFiles[0]),'utf8');
html=html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/,()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>');
const css=(await readdir(path.join(dist,'assets'))).filter(n=>n.endsWith('.css'));
for(const file of css){const text=await readFile(path.join(dist,'assets',file),'utf8');html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/,()=>'<style>'+text+'</style>');}
if(!html.includes('rel="icon"'))html=html.replace('</head>','<link rel="icon" href="data:,"></head>');
if(/<(?:script|link)\b[^>]*(?:src|href)="\.?\/?assets\//.test(html))throw new Error('External build asset remains');
const target=path.join(root,'..','index.html');await writeFile(target,html);
const meta={file:'index.html',bytes:(await stat(target)).size,singleHtml:true,modelsEmbedded:true,externalAssets:0,builtAt:new Date().toISOString()};await writeFile(path.join(root,'..','build-info.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));
