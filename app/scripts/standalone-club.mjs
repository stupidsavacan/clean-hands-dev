import {readFile,writeFile,readdir} from 'node:fs/promises';
const dist=new URL('../dist-club/',import.meta.url);let html=await readFile(new URL('club.html',dist),'utf8');
const files=await readdir(new URL('assets/',dist));const js=files.filter(f=>f.endsWith('.js'));if(js.length!==1)throw new Error('Expected one JS bundle');
const code=await readFile(new URL('assets/'+js[0],dist),'utf8');html=html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/,()=>'<script type="module">'+code.replace(/<\/script/gi,'<\\/script')+'</script>');
for(const file of files.filter(f=>f.endsWith('.css'))){const css=await readFile(new URL('assets/'+file,dist),'utf8');html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/,()=>'<style>'+css+'</style>');}
await writeFile(new URL('../../club-prototype.html',import.meta.url),html);console.log(JSON.stringify({bytes:Buffer.byteLength(html),file:'club-prototype.html'}));
