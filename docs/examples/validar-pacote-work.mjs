// Validação local: não usa rede, credenciais, Supabase ou upload.
import {readFile} from 'node:fs/promises';
import {parsePresentationPackage} from '../../public/apresentacoes/package.js';

if (!process.argv[2]) {
  console.error('Uso: node docs/examples/validar-pacote-work.mjs caminho/pacote.zip');
  process.exitCode = 1;
} else {
  try {
    const schema = JSON.parse(await readFile(new URL('../../public/apresentacoes/presentation.schema.json', import.meta.url), 'utf8'));
    const parsed = await parsePresentationPackage(await readFile(process.argv[2]), schema);
    console.log(JSON.stringify({valid: true, slides: parsed.slideCount, files: parsed.files.map(({path, size, sha256}) => ({path, size, sha256})), warnings: parsed.warnings, packageHash: parsed.packageHash}, null, 2));
  } catch (error) {
    console.error(JSON.stringify({valid: false, error: error.message}));
    process.exitCode = 1;
  }
}
