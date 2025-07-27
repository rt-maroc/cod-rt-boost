// web/index.js - Serveur principal pour la production
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Imports de votre application
import { initializeDatabase } from './services/DatabaseService.js';
import codOrdersRouter from './routes/api/cod-orders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log('🚀 Initialisation du serveur COD Boost...');

// Configuration de sécurité pour la production
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour Shopify
  crossOriginEmbedderPolicy: false
}));

// Compression des réponses
app.use(compression());

// Configuration CORS pour Shopify
app.use(cors({
  origin: [
    /\.myshopify\.com$/,
    /\.shopifypreview\.com$/,
    'https://admin.shopify.com',
    process.env.SHOPIFY_APP_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Shopify-Topic',
    'X-Shopify-Hmac-Sha256',
    'X-Shopify-Shop-Domain',
    'X-Shopify-Customer-Id', // ⭐ AJOUTÉ pour App Proxy
    'X-COD-Dev-Mode'
  ]
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================
// 🆕 ROUTES APP PROXY SHOPIFY
// ================================

// Middleware spécial pour App Proxy
app.use('/apps/cod-boost/*', (req, res, next) => {
  console.log('📱 App Proxy request:', {
    url: req.originalUrl,
    method: req.method,
    shop: req.headers['x-shopify-shop-domain'],
    customer: req.headers['x-shopify-customer-id']
  });
  
  // Headers CORS spécifiques pour App Proxy
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Customer-Id');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Health check pour App Proxy
app.get('/apps/cod-boost/health', (req, res) => {
  res.json({
    status: 'healthy - App Proxy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'rt-cod-boost',
    source: 'app-proxy',
    shop: req.headers['x-shopify-shop-domain'] || 'unknown',
    customer: req.headers['x-shopify-customer-id'] || 'guest'
  });
});

// Route de test App Proxy
app.get('/apps/cod-boost/test', (req, res) => {
  res.json({
    success: true,
    message: 'App Proxy fonctionne correctement!',
    shop: req.headers['x-shopify-shop-domain'],
    customer: req.headers['x-shopify-customer-id'],
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// ================================
// ROUTES EXISTANTES (pas de changement)
// ================================

// Route de santé pour Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'rt-cod-boost'
  });
});

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: '🚀 RT COD Boost API is running!',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/apps/cod-boost/api/orders',
      admin: '/admin',
      appProxy: '/apps/cod-boost/test' // ⭐ AJOUTÉ
    }
  });
});

// Routes API COD (existante - pas de changement)
app.use('/apps/cod-boost/api/orders', codOrdersRouter);

// Servir les fichiers statiques du frontend (si build)
const frontendPath = join(__dirname, 'frontend', 'dist');
try {
  app.use('/admin', express.static(frontendPath));
  app.get('/admin/*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
  });
  console.log('✅ Frontend statique configuré');
} catch (error) {
  console.log('⚠️ Frontend build non trouvé, mode API seulement');
}

// Middleware de gestion d'erreurs
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error_id: Date.now()
    });
  } else {
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    // Initialiser la base de données
    console.log('📊 Initialisation de la base de données...');
    await initializeDatabase();
    console.log('✅ Base de données initialisée');

    // Démarrer le serveur
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 COD Boost Server running on http://${HOST}:${PORT}`);
      console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
      console.log(`🛒 API Endpoint: http://${HOST}:${PORT}/apps/cod-boost/api/orders`);
      console.log(`🧪 App Proxy Test: http://${HOST}:${PORT}/apps/cod-boost/test`); // ⭐ AJOUTÉ
      console.log(`🏠 Admin Panel: http://${HOST}:${PORT}/admin`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Gestion propre de l'arrêt
    process.on('SIGTERM', () => {
      console.log('📡 SIGTERM reçu, arrêt du serveur...');
      server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('📡 SIGINT reçu, arrêt du serveur...');
      server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

// Démarrage de l'application
startServer();