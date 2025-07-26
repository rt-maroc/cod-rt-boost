// web/services/DatabaseService.js - Version PostgreSQL pour Render
import pkg from 'pg';
const { Pool } = pkg;

// Configuration de la base de données PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 🗃️ CRÉATION DES TABLES
export async function initializeDatabase() {
  try {
    console.log('📊 Connexion à PostgreSQL...');
    
    // Test de connexion
    const client = await pool.connect();
    console.log('✅ Connexion PostgreSQL réussie');
    
    // Table principale des commandes COD
    const createCODOrdersTable = `
      CREATE TABLE IF NOT EXISTS cod_orders (
        id SERIAL PRIMARY KEY,
        shop_domain VARCHAR(255) NOT NULL,
        shopify_order_id VARCHAR(255) UNIQUE,
        order_number VARCHAR(255),
        
        -- Informations produit
        product_id VARCHAR(255),
        variant_id VARCHAR(255),
        product_title TEXT,
        product_image TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        
        -- Informations client
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_email VARCHAR(255),
        
        -- Adresse de livraison
        delivery_address TEXT NOT NULL,
        delivery_city VARCHAR(255) NOT NULL,
        delivery_postal_code VARCHAR(20),
        
        -- Notes et statut
        order_notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Table pour les boutiques
    const createShopsTable = `
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) UNIQUE NOT NULL,
        shop_name VARCHAR(255),
        email VARCHAR(255),
        currency VARCHAR(10) DEFAULT 'MAD',
        timezone VARCHAR(100) DEFAULT 'Africa/Casablanca',
        
        -- Configuration COD
        cod_enabled BOOLEAN DEFAULT TRUE,
        default_delivery_fee DECIMAL(10,2) DEFAULT 0,
        
        -- Timestamps
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Table pour les logs
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS cod_logs (
        id SERIAL PRIMARY KEY,
        shop_domain VARCHAR(255),
        level VARCHAR(20) DEFAULT 'info',
        message TEXT,
        data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Exécuter les créations de tables
    await client.query(createShopsTable);
    await client.query(createCODOrdersTable);
    await client.query(createLogsTable);

    // Créer les index pour optimiser les performances
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_shop_domain ON cod_orders(shop_domain)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_shopify_id ON cod_orders(shopify_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_status ON cod_orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_created_at ON cod_orders(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_cod_orders_customer_phone ON cod_orders(customer_phone)`,
      `CREATE INDEX IF NOT EXISTS idx_shops_domain ON shops(domain)`
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }

    console.log('✅ Tables PostgreSQL créées avec succès');

    // Insérer des données par défaut si nécessaire
    await initializeDefaultData(client);

    client.release();
    return true;

  } catch (error) {
    console.error('❌ Erreur lors de la création des tables PostgreSQL:', error);
    throw error;
  }
}

// 📊 INSÉRER DES DONNÉES PAR DÉFAUT
async function initializeDefaultData(client) {
  try {
    // Vérifier si des boutiques existent déjà
    const shopCount = await client.query('SELECT COUNT(*) as count FROM shops');
    
    if (shopCount.rows[0].count == 0) {
      // Insérer la boutique de test par défaut
      await client.query(`
        INSERT INTO shops (
          domain, shop_name, currency, cod_enabled, default_delivery_fee
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (domain) DO NOTHING
      `, [
        'rt-solutions-test.myshopify.com',
        'RT Solutions Test',
        'MAD',
        true,
        0
      ]);

      console.log('✅ Données par défaut insérées');
    }

  } catch (error) {
    console.warn('⚠️ Attention: Impossible d\'insérer les données par défaut:', error.message);
  }
}

// 🧹 FONCTION DE NETTOYAGE
export async function cleanupDatabase() {
  try {
    const client = await pool.connect();
    
    // Nettoyer les anciens logs (plus de 30 jours)
    await client.query(`
      DELETE FROM cod_logs 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    // Nettoyer les commandes annulées très anciennes (plus de 90 jours)
    await client.query(`
      DELETE FROM cod_orders 
      WHERE status = 'cancelled' 
      AND created_at < NOW() - INTERVAL '90 days'
    `);

    client.release();
    console.log('✅ Nettoyage PostgreSQL terminé');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage PostgreSQL:', error);
  }
}

// 🔧 FERMER LA CONNEXION PROPREMENT
export async function closeDatabase() {
  try {
    await pool.end();
    console.log('✅ Connexions PostgreSQL fermées');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture PostgreSQL:', error);
  }
}

// Export du pool pour utilisation dans les services
export { pool };

// ✅ EXPORTS CORRECTS
export default {
  pool,
  initializeDatabase,
  cleanupDatabase,
  closeDatabase
};