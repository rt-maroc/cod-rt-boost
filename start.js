// start.js - Script de démarrage pour Render avec structure /web
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Démarrage de l\'application COD Boost sur Render...');
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Vérifier la structure des dossiers
const webDir = path.join(__dirname, 'web');
const webIndexFile = path.join(webDir, 'index.js');

console.log('Vérification de la structure:');
console.log('   - Dossier web:', fs.existsSync(webDir) ? 'OK' : 'MANQUANT');
console.log('   - Fichier web/index.js:', fs.existsSync(webIndexFile) ? 'OK' : 'MANQUANT');

if (!fs.existsSync(webDir)) {
  console.error('ERREUR: Dossier /web introuvable');
  process.exit(1);
}

if (!fs.existsSync(webIndexFile)) {
  console.error('ERREUR: Fichier /web/index.js introuvable');
  console.log('Contenu du dossier /web:');
  try {
    const webContents = fs.readdirSync(webDir);
    webContents.forEach(file => console.log(`   - ${file}`));
  } catch (error) {
    console.error('ERREUR lecture dossier /web:', error.message);
  }
  process.exit(1);
}

// Définir les variables d'environnement
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || 3000;

console.log(`Application sera accessible sur: ${process.env.HOST}:${process.env.PORT}`);

// Vérifier si les dépendances web sont déjà installées
const webNodeModules = path.join(webDir, 'node_modules');
const shopifyApiPath = path.join(webNodeModules, '@shopify', 'shopify-api');

if (!fs.existsSync(shopifyApiPath)) {
  console.log('Dépendances Shopify manquantes, installation en cours...');
  
  const installProcess = spawn('npm', ['install', '--production=false'], {
    cwd: webDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development', // Force mode développement pour installer toutes les dépendances
      NPM_CONFIG_PRODUCTION: 'false'
    }
  });

  installProcess.on('error', (error) => {
    console.error('ERREUR lors de l\'installation:', error);
    process.exit(1);
  });

  installProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Installation échouée avec le code: ${code}`);
      process.exit(code);
    }
    
    console.log('Installation des dépendances terminée');
    
    // Vérifier que les dépendances sont maintenant présentes
    if (fs.existsSync(shopifyApiPath)) {
      console.log('Dépendances Shopify installées avec succès');
      startWebApp();
    } else {
      console.error('ERREUR: Dépendances Shopify toujours manquantes après installation');
      process.exit(1);
    }
  });
} else {
  console.log('Dépendances web déjà présentes');
  startWebApp();
}

function startWebApp() {
  // Démarrer l'application web
  console.log('Démarrage de l\'application web...');
  const webProcess = spawn('node', ['index.js'], {
    cwd: webDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production', // Retour en mode production pour l'exécution
      HOST: process.env.HOST,
      PORT: process.env.PORT
    }
  });

  webProcess.on('error', (error) => {
    console.error('ERREUR lors du démarrage de l\'application web:', error);
    process.exit(1);
  });

  webProcess.on('exit', (code, signal) => {
    console.log(`Processus web terminé avec le code: ${code}, signal: ${signal}`);
    if (code !== 0 && code !== null) {
      console.error('Application web terminée avec une erreur');
      process.exit(code);
    }
  });

  // Gestion propre de l'arrêt
  const gracefulShutdown = (signal) => {
    console.log(`Signal ${signal} reçu, arrêt en cours...`);
    webProcess.kill(signal);
    
    setTimeout(() => {
      console.log('Force shutdown après timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  process.on('uncaughtException', (error) => {
    console.error('ERREUR non capturée:', error);
    gracefulShutdown('SIGTERM');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non gérée:', reason);
    gracefulShutdown('SIGTERM');
  });
}

console.log('Script de démarrage initialisé');