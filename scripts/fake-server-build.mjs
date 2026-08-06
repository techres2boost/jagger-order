import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Crée un faux fichier pour satisfaire le prerender natif
const fakeServerPath = resolve(rootDir, 'dist/server/server.js');
mkdirSync(dirname(fakeServerPath), { recursive: true });

writeFileSync(fakeServerPath, `
export default {
  fetch() {
    return new Response('OK', { status: 200 });
  }
};
`);

console.log('✅ Faux fichier server.js créé pour contourner le prerendering natif');
