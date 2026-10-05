import {spawnSync} from 'node:child_process';
import {copyFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const compilation=spawnSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',resolve(root,'packages/engine/tsconfig.json')],{cwd:root,stdio:'inherit'});
if(compilation.error)throw compilation.error;
if(compilation.status!==0)process.exit(compilation.status??1);
// Pure JavaScript compatibility helpers have explicit adjacent declarations.
// TypeScript emits the strict annual projector; preserve its typed helper bridge.
const target=resolve(root,'packages/engine/runtime/projection');mkdirSync(target,{recursive:true});
for(const file of ['legacy.mjs','legacy.d.mts'])copyFileSync(resolve(root,'packages/engine/src/projection',file),resolve(target,file));
