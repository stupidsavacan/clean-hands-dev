import {build} from 'vite';
import {copyFile} from 'node:fs/promises';
await build({configFile:'vite.combat.config.ts'});
await copyFile('../combat-motions/combat-lab.html','../combat-motions/index.html');
