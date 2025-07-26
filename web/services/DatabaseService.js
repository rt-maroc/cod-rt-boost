// web/services/DatabaseService.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Créer le dossier database s'il n'existe pas
const dbDir = join(__dirname, '..', 'database');
try {
  mkdirSync(dbDir, { recursive: true });
} catch (error) {
  // Le dossier existe déjà
}

// Créer ou connecter à la base de données
const dbPath = join(dbDir, 'cod_orders.db');
export const database = new Database(dbPath);

// Configuration de la base de données
database.pragma('journal_mode = WAL');
database.pragma('synchronous = NORMAL');
database.pragma('cache_size = 1000');
database.pragma('temp_store = memory');

// 🗃️ CRÉATION DES TABLES
export function initializeDatabase() {
  try {
    // Table principale des commandes COD
    const createCODOrdersTable = `
      CREATE TABLE IF NOT EXISTS cod_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_domain TEXT NOT NULL,
        shopify_order_id TEXT UNIQUE,
        order_number TEXT,
        
        -- Informations produit
        product_id TEXT,
        variant_id TEXT,
        product_title TEXT,
        product_image TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        
        -- Informations client
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        
        -- Adresse de livraison
        delivery_address TEXT NOT NULL,
        delivery_city TEXT NOT NULL,
        delivery_postal_code TEXT,
        
        -- Notes et statut
        order_notes TEXT,
        status TEXT DEFAULT 'pending',
        
        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Table pour les boutiques (optionnel, pour les stats)
    const createShopsTable = `
      CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE NOT NULL,
        shop_name TEXT,
        email TEXT,
        currency TEXT DEFAULT 'MAD',
        timezone TEXT DEFAULT 'Africa/Casablanca',
        
        -- Configuration COD
        cod_enabled BOOLEAN DEFAULT 1,
        default_delivery_fee REAL DEFAULT 0,
        
        -- Timestamps
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Table pour les logs (optionnel, pour le debugging)
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS cod_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_domain TEXT,
        level TEXT DEFAULT 'info',
        message TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Exécuter les créations de tables
    database.exec(createShopsTable);
    database.exec(createCODOrdersTable);
    database.exec(createLogsTable);

    // Créer les index pour optimiser les performances
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_shop_domain ON cod_orders(shop_domain)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_shopify_id ON cod_orders(shopify_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_status ON cod_orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_created_at ON cod_orders(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_customer_phone ON cod_orders(customer_phone)`,
      `CREATE INDEX IF NOT EXISTS idx_shops_domain ON shops(domain)`
    ];

    indexes.forEach(indexQuery => {
      database.exec(indexQuery);
    });

    console.log('Database connected successfully');
    console.log('Database tables created successfully');

    // Insérer des données par défaut si nécessaire
    initializeDefaultData();

    return true; // Succès

  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    throw error;
  }
}

// 📊 INSÉRER DES DONNÉES PAR DÉFAUT
function initializeDefaultData() {
  try {
    // Vérifier si des boutiques existent déjà
    const shopCount = database.prepare('SELECT COUNT(*) as count FROM shops').get().count;
    
    if (shopCount === 0) {
      // Insérer la boutique de test par défaut
      const insertShop = database.prepare(`
        INSERT OR IGNORE INTO shops (
          domain, shop_name, currency, cod_enabled, default_delivery_fee
        ) VALUES (?, ?, ?, ?, ?)
      `);

      insertShop.run(
        'rt-solutions-test.myshopify.com',
        'RT Solutions Test',
        'MAD',
        1,
        0
      );

      console.log('✅ Default shop data inserted');
    }

  } catch (error) {
    console.warn('⚠️ Warning: Could not insert default data:', error.message);
  }
}

// 🧹 FONCTION DE NETTOYAGE (optionnel)
export function cleanupDatabase() {
  try {
    // Nettoyer les anciens logs (plus de 30 jours)
    database.prepare(`
      DELETE FROM cod_logs 
      WHERE created_at < datetime('now', '-30 days')
    `).run();

    // Nettoyer les commandes annulées très anciennes (plus de 90 jours)
    database.prepare(`
      DELETE FROM cod_orders 
      WHERE status = 'cancelled' 
      AND created_at < datetime('now', '-90 days')
    `).run();

    console.log('✅ Database cleanup completed');

  } catch (error) {
    console.error('❌ Database cleanup error:', error);
  }
}

// 📊 FONCTION DE BACKUP (optionnel)
export function backupDatabase() {
  try {
    const backupPath = join(__dirname, '..', 'database', `cod_orders_backup_${Date.now()}.db`);
    database.backup(backupPath);
    console.log('✅ Database backup created:', backupPath);
    return backupPath;

  } catch (error) {
    console.error('❌ Database backup error:', error);
    throw error;
  }
}

// 🔧 FERMER LA CONNEXION PROPREMENT
export function closeDatabase() {
  try {
    database.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

// ✅ EXPORTS CORRECTS
export default {
  database,
  initializeDatabase,
  cleanupDatabase,
  backupDatabase,
  closeDatabase
};