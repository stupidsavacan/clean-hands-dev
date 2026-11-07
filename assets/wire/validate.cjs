const fs = require('fs');
const path = require('path');
const validator = require('C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/work/gltf-validator');
(async () => {
  const result = await validator.validateBytes(new Uint8Array(fs.readFileSync(path.join(__dirname, 'wire.glb'))), {uri:'wire.glb'});
  fs.writeFileSync(path.join(__dirname, 'khronos-validation.json'), JSON.stringify({version:validator.version(), ...result}, null, 2));
  console.log(JSON.stringify({version:validator.version(),errors:result.issues.numErrors,warnings:result.issues.numWarnings,infos:result.issues.numInfos}));
  if(result.issues.numErrors)process.exitCode=1;
})();
