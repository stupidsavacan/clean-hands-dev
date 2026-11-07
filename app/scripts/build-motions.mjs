import {build} from 'vite';
import {copyFile} from 'node:fs/promises';
await build({configFile:'vite.motion.config.ts'});
await copyFile('../motions/motion-lab.html','../motions/index.html');
