// Inline a lab page's bundle into one html file next to club-prototype.html (2026-11-04). Usage: node ... ai-lab
import {readFile,writeFile,readdir} from 'node:fs/promises';
const lab=process.argv[2]??'ai-lab',dist=new URL(`../dist-${lab}/`,import.meta.url);
let html=await readFile(new URL(lab+'.html',dist),'utf8');
const files=await readdir(new URL('assets/',dist)),js=files.filter(f=>f.endsWith('.js'));if(js.length!==1)throw new Error('Expected one JS bundle, got '+js);
const code=await readFile(new URL('assets/'+js[0],dist),'utf8');
// Stylesheets too (the UI lab imports style.css and menus.css; the other labs add their styles from script).
for(const file of files.filter(f=>f.endsWith('.css'))){const css=await readFile(new URL('assets/'+file,dist),'utf8');html=html.replace(/<link [^>]*rel="stylesheet"[^>]*>/,()=>'<style>'+css+'</style>');}
html=html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/,()=>'<script type="module">'+code.replace(/<\/script/gi,'<\/script')+'</script>');
await writeFile(new URL(`../../${lab}.html`,import.meta.url),html);console.log(JSON.stringify({file:lab+'.html',bytes:Buffer.byteLength(html)}));
