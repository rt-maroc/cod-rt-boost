// start.js - Script de démarrage pour Render
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Démarrage de l'application COD Boost sur Render...');

// Définir les variables d'environnement pour la production
process.env.NODE_ENV = 'production';
process.env.HOST = '0.0.0.0';
process.env.PORT = process.env.PORT || 3000;

// Démarrer l'application web
const webProcess = spawn('node', ['web/index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

webProcess.on('error', (error) => {
  console.error('❌ Erreur lors du démarrage:', error);
  process.exit(1);
});

webProcess.on('exit', (code) => {
  console.log(`⚡ Processus web terminé avec le code: ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('📡 Signal SIGTERM reçu, arrêt en cours...');
  webProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📡 Signal SIGINT reçu, arrêt en cours...');
  webProcess.kill('SIGINT');
});