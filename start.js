// start.js - Version simplifiée qui fonctionne
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Démarrage COD Boost...');
console.log('Node.js:', process.version);

// Variables d'environnement
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || 3000;

// Démarrer directement l'app web
const webProcess = spawn('node', ['index.js'], {
  cwd: path.join(__dirname, 'web'),
  stdio: 'inherit',
  env: process.env
});

webProcess.on('error', (error) => {
  console.error('Erreur:', error);
  process.exit(1);
});

webProcess.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code);
  }
});

// Gestion arrêt
process.on('SIGTERM', () => webProcess.kill('SIGTERM'));
process.on('SIGINT', () => webProcess.kill('SIGINT'));