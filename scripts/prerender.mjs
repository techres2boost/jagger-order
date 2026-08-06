import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

console.log('🚀 Démarrage du prerender manuel...');

try {
  // 1. Démarrer le serveur Nitro en arrière-plan
  console.log('📡 Démarrage du serveur Nitro sur le port 4173...');
  const serverProcess = execSync(
    'PORT=4173 node .output/server/index.mjs &',
    { cwd: rootDir, stdio: 'inherit', timeout: 3000 }
  );

  // Attendre que le serveur soit prêt
  console.log('⏳ Attente du démarrage du serveur...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. Faire une requête pour générer le HTML
  console.log('🌐 Récupération du HTML depuis http://localhost:4173...');
  const response = await fetch('http://localhost:4173/');
  const html = await response.text();

  if (!html || html.length < 100) {
    throw new Error('HTML récupéré vide ou trop court');
  }

  console.log(`✅ HTML récupéré (${html.length} caractères)`);

  // 3. Écrire le fichier _shell.html
  const outputPath = resolve(rootDir, '.output/public/_shell.html');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  
  console.log(`✅ Shell HTML écrit dans ${outputPath}`);

  // 4. Arrêter le serveur
  console.log('🛑 Arrêt du serveur Nitro...');
  execSync('kill $(lsof -t -i:4173) 2>/dev/null || true', { cwd: rootDir });
  
  console.log('✅ Prerender terminé avec succès !');
  
} catch (error) {
  console.error('❌ Erreur lors du prerender:', error.message);
  // Tentative d'arrêt du serveur même en cas d'erreur
  try {
    execSync('kill $(lsof -t -i:4173) 2>/dev/null || true', { cwd: rootDir });
  } catch {}
  process.exit(1);
}
