import {mkdirSync,writeFileSync} from 'node:fs';
import {syntheticPackageKit,kitTools} from '../tests/fixtures/lesson-package-db.mjs';
import * as zip from '../public/apresentacoes/zip.js';
const directory='docs/examples/unified-lesson-package';mkdirSync(directory,{recursive:true});
writeFileSync(`${directory}/pacote-sintetico-completo.zip`,await kitTools.syntheticLessonPackage(syntheticPackageKit,zip));
writeFileSync(`${directory}/kit-work-sintetico.zip`,await kitTools.exportProductionKit(syntheticPackageKit,zip,JSON.parse((await import('node:fs')).readFileSync('public/apresentacoes/presentation.schema.json','utf8'))));
writeFileSync(`${directory}/identidade-sintetica.json`,JSON.stringify(syntheticPackageKit,null,2));
console.log('Synthetic demonstration package and Work kit generated; no database or network access.');
