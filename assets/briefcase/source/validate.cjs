// Official Khronos glTF Validator over every model; writes khronos-validation.json next to the assets.
const fs = require('fs'), path = require('path');
const validator = require('C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/work/gltf-validator');
const root = path.join(__dirname, '..', 'models');
(async () => {
  const out = {version: validator.version(), models: {}};
  for (const id of fs.readdirSync(root)) {
    const file = path.join(root, id, id + '.glb');
    const r = await validator.validateBytes(new Uint8Array(fs.readFileSync(file)), {uri: id + '.glb'});
    out.models[id] = {errors: r.issues.numErrors, warnings: r.issues.numWarnings, infos: r.issues.numInfos, messages: r.issues.messages.map(m => `${m.severity} ${m.code} ${m.pointer ?? ''}`)};
    console.log(id.padEnd(18), 'errors', r.issues.numErrors, 'warnings', r.issues.numWarnings, 'infos', r.issues.numInfos);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'khronos-validation.json'), JSON.stringify(out, null, 2));
  if (Object.values(out.models).some(m => m.errors)) process.exitCode = 1;
})();
