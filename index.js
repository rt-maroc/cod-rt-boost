const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration pour la production
app.set('trust proxy', 1);

// Headers de sécurité
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Créer le dossier data s'il n'existe pas (pour Render)
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
}

// Database setup - Utilise ./data/ pour la persistance sur Render
const db = new sqlite3.Database('./data/database.sqlite', (err) => {
    if (err) {
        console.error('❌ Erreur de connexion à la base de données:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Create table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS cod_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        customer_address TEXT NOT NULL,
        customer_city TEXT NOT NULL,
        product_title TEXT NOT NULL,
        product_price REAL NOT NULL,
        order_notes TEXT,
        shopify_order_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Erreur création table:', err.message);
        } else {
            console.log('✅ COD orders table ready');
        }
    });
});

// Shopify configuration
const SHOPIFY_CONFIG = {
    shop: process.env.SHOPIFY_SHOP || 'rt-solutions-test',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-01'
};

// Shopify API client function
async function callShopifyAPI(endpoint, data = null, method = 'GET') {
    const url = `https://${SHOPIFY_CONFIG.shop}.myshopify.com/admin/api/${SHOPIFY_CONFIG.apiVersion}/${endpoint}`;
    
    console.log(`🔗 Shopify API call: ${method} ${url}`);
    
    const options = {
        method: method,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_CONFIG.accessToken,
            'Content-Type': 'application/json'
        }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
        console.log('📤 Données envoyées:', JSON.stringify(data, null, 2));
    }
    
    try {
        const response = await fetch(url, options);
        const responseData = await response.json();
        
        console.log('📥 Réponse Shopify:', JSON.stringify(responseData, null, 2));
        
        if (!response.ok) {
            throw new Error(`Shopify API Error: ${response.status} - ${JSON.stringify(responseData)}`);
        }
        
        return responseData;
    } catch (error) {
        console.error('❌ Erreur Shopify API:', error.message);
        throw error;
    }
}

// Test Shopify connection
async function testShopifyConnection() {
    try {
        console.log('🧪 Test de connexion Shopify...');
        const shop = await callShopifyAPI('shop.json');
        console.log('✅ Shopify connexion OK:', shop.shop.name);
        return true;
    } catch (error) {
        console.error('❌ Shopify connexion échouée:', error.message);
        return false;
    }
}

// Create order in Shopify
async function createShopifyOrder(orderData) {
    const shopifyOrder = {
        order: {
            line_items: [{
                title: orderData.product_title,
                price: orderData.product_price,
                quantity: 1
            }],
            customer: {
                first_name: orderData.customer_name.split(' ')[0] || orderData.customer_name,
                last_name: orderData.customer_name.split(' ').slice(1).join(' ') || '',
                email: orderData.customer_email || `${Date.now()}@example.com`
                // phone supprimé - optionnel pour compatibilité universelle
            },
            billing_address: {
                first_name: orderData.customer_name.split(' ')[0] || orderData.customer_name,
                last_name: orderData.customer_name.split(' ').slice(1).join(' ') || '',
                address1: orderData.customer_address,
                city: orderData.customer_city,
                country: 'Morocco'
                // phone supprimé - optionnel
            },
            shipping_address: {
                first_name: orderData.customer_name.split(' ')[0] || orderData.customer_name,
                last_name: orderData.customer_name.split(' ').slice(1).join(' ') || '',
                address1: orderData.customer_address,
                city: orderData.customer_city,
                country: 'Morocco'
                // phone supprimé - optionnel
            },
            financial_status: 'pending',
            fulfillment_status: null,
            note: `Commande COD via RT COD Boost\nClient: ${orderData.customer_name}\nTéléphone: ${orderData.customer_phone}\nAdresse: ${orderData.customer_address}, ${orderData.customer_city}${orderData.order_notes ? '\nNotes: ' + orderData.order_notes : ''}`,
            tags: 'COD, RT-COD-BOOST',
            gateway: 'cash_on_delivery'
        }
    };

    try {
        const result = await callShopifyAPI('orders.json', shopifyOrder, 'POST');
        console.log(`✅ Shopify order created: #${result.order.order_number} ID: ${result.order.id}`);
        return result.order;
    } catch (error) {
        console.error('❌ Erreur création commande Shopify:', error.message);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    const deployUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>RT COD Boost - Système de Commandes</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; text-align: center; }
                .status { padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                a { display: inline-block; margin: 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                a:hover { background: #0056b3; }
                .version { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 RT COD Boost</h1>
                <div class="status success">
                    ✅ Serveur démarré avec succès !
                </div>
                <div class="status info">
                    📋 Système de gestion des commandes COD universel
                </div>
                <div style="text-align: center;">
                    <a href="/test-cod-form">🧪 Tester le formulaire COD</a>
                    <a href="/orders">📊 Voir les commandes</a>
                    <a href="/health">❤️ Status serveur</a>
                </div>
                <div class="version">
                    Version 2.0 | Déployé sur: ${deployUrl} | Environnement: ${process.env.NODE_ENV || 'development'}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/test-cod-form', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Formulaire COD - RT COD Boost</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; text-align: center; }
                .form-group { margin: 15px 0; }
                label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
                input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box; }
                button { width: 100%; padding: 15px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-top: 20px; }
                button:hover { background: #218838; }
                .result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                @media (max-width: 768px) {
                    body { margin: 10px; }
                    .container { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🧪 Test Formulaire COD</h1>
                <form id="codForm">
                    <div class="form-group">
                        <label for="customer_name">Nom complet *</label>
                        <input type="text" id="customer_name" name="customer_name" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="customer_phone">Téléphone *</label>
                        <input type="tel" id="customer_phone" name="customer_phone" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="customer_email">Email</label>
                        <input type="email" id="customer_email" name="customer_email">
                    </div>
                    
                    <div class="form-group">
                        <label for="customer_address">Adresse *</label>
                        <input type="text" id="customer_address" name="customer_address" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="customer_city">Ville *</label>
                        <input type="text" id="customer_city" name="customer_city" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="product_title">Produit *</label>
                        <input type="text" id="product_title" name="product_title" value="Produit Test RT" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="product_price">Prix (MAD) *</label>
                        <input type="number" id="product_price" name="product_price" step="0.01" value="299.99" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="order_notes">Notes (optionnel)</label>
                        <textarea id="order_notes" name="order_notes" rows="2"></textarea>
                    </div>
                    
                    <button type="submit">📦 Créer la commande COD</button>
                </form>
                
                <div id="result" class="result"></div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <a href="/" style="color: #007bff; text-decoration: none;">← Retour à l'accueil</a>
                </div>
            </div>
            
            <script>
                document.getElementById('codForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const formData = new FormData(this);
                    const data = Object.fromEntries(formData);
                    
                    const resultDiv = document.getElementById('result');
                    const submitBtn = document.querySelector('button[type="submit"]');
                    
                    // Désactiver le bouton pendant le traitement
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Création en cours...';
                    
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '⏳ Création de la commande en cours...';
                    resultDiv.className = 'result';
                    
                    try {
                        const response = await fetch('/api/cod-order', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok) {
                            resultDiv.className = 'result success';
                            resultDiv.innerHTML = '✅ Commande créée avec succès !<br><strong>ID Local:</strong> ' + result.localOrderId + '<br><strong>ID Shopify:</strong> ' + (result.shopifyOrderId || 'Non créé');
                            
                            // Réinitialiser le formulaire
                            document.getElementById('codForm').reset();
                            document.getElementById('product_title').value = 'Produit Test RT';
                            document.getElementById('product_price').value = '299.99';
                        } else {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Erreur: ' + result.error;
                        }
                    } catch (error) {
                        resultDiv.className = 'result error';
                        resultDiv.innerHTML = '❌ Erreur de connexion: ' + error.message;
                    } finally {
                        // Réactiver le bouton
                        submitBtn.disabled = false;
                        submitBtn.textContent = '📦 Créer la commande COD';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// API endpoint to create COD order
app.post('/api/cod-order', async (req, res) => {
    console.log('📥 Nouvelle commande COD reçue:', req.body);
    
    const {
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        customer_city,
        product_title,
        product_price,
        order_notes
    } = req.body;

    // Validation
    if (!customer_name || !customer_phone || !customer_address || !customer_city || !product_title || !product_price) {
        return res.status(400).json({
            error: 'Champs obligatoires manquants',
            required: ['customer_name', 'customer_phone', 'customer_address', 'customer_city', 'product_title', 'product_price']
        });
    }

    try {
        // Save to local database first
        const stmt = db.prepare(`INSERT INTO cod_orders 
            (customer_name, customer_phone, customer_email, customer_address, customer_city, product_title, product_price, order_notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        
        const localResult = await new Promise((resolve, reject) => {
            stmt.run([customer_name, customer_phone, customer_email, customer_address, customer_city, product_title, product_price, order_notes], 
                function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID });
                });
        });

        console.log('✅ Commande sauvée localement, ID:', localResult.lastID);

        let shopifyOrderId = null;
        
        // Try to create order in Shopify
        if (SHOPIFY_CONFIG.accessToken) {
            try {
                const shopifyOrder = await createShopifyOrder(req.body);
                shopifyOrderId = shopifyOrder.id;

                // Update local record with Shopify ID
                db.run(`UPDATE cod_orders SET shopify_order_id = ?, status = 'synced' WHERE id = ?`, 
                    [shopifyOrderId, localResult.lastID]);

                console.log('✅ Commande synchronisée avec Shopify');
            } catch (shopifyError) {
                console.error('⚠️ Échec sync Shopify, commande sauvée localement seulement:', shopifyError.message);
                
                // Update status to indicate Shopify sync failed
                db.run(`UPDATE cod_orders SET status = 'sync_failed' WHERE id = ?`, [localResult.lastID]);
            }
        } else {
            console.log('⚠️ Token Shopify manquant, commande sauvée localement seulement');
        }

        res.json({
            success: true,
            message: 'Commande COD créée avec succès',
            localOrderId: localResult.lastID,
            shopifyOrderId: shopifyOrderId
        });

    } catch (error) {
        console.error('❌ Erreur création commande:', error.message);
        res.status(500).json({
            error: 'Erreur serveur lors de la création de la commande',
            details: error.message
        });
    }
});

// Get all orders
app.get('/orders', (req, res) => {
    db.all('SELECT * FROM cod_orders ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const ordersHtml = rows.map(order => `
            <tr>
                <td>${order.id}</td>
                <td>${order.customer_name}</td>
                <td>${order.customer_phone}</td>
                <td>${order.customer_city}</td>
                <td>${order.product_title}</td>
                <td>${order.product_price} MAD</td>
                <td>${order.shopify_order_id || 'N/A'}</td>
                <td><span class="status ${order.status}">${order.status}</span></td>
                <td>${new Date(order.created_at).toLocaleString('fr-FR')}</td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Commandes COD - RT COD Boost</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f8f9fa; font-weight: bold; }
                    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                    .status.pending { background: #fff3cd; color: #856404; }
                    .status.synced { background: #d4edda; color: #155724; }
                    .status.sync_failed { background: #f8d7da; color: #721c24; }
                    a { display: inline-block; margin: 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                    a:hover { background: #0056b3; }
                    @media (max-width: 768px) {
                        .container { padding: 20px; }
                        table { font-size: 14px; }
                        th, td { padding: 8px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 Commandes COD</h1>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="/">🏠 Accueil</a>
                        <a href="/test-cod-form">🧪 Nouveau test</a>
                        <a href="/health">❤️ Status</a>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Client</th>
                                <th>Téléphone</th>
                                <th>Ville</th>
                                <th>Produit</th>
                                <th>Prix</th>
                                <th>Shopify ID</th>
                                <th>Statut</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ordersHtml || '<tr><td colspan="9" style="text-align: center; color: #666;">Aucune commande trouvée</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
        services: {
            database: 'Connected',
            shopify: SHOPIFY_CONFIG.accessToken ? 'Configured' : 'Not configured'
        }
    };

    res.json(healthStatus);
});

// Initialize server
async function startServer() {
    console.log('🚀 RT COD Boost server starting...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Database: SQLite with data persistence`);
    
    // Test Shopify connection
    if (SHOPIFY_CONFIG.accessToken) {
        const shopifyConnected = await testShopifyConnection();
        console.log('🔧 Shopify:', shopifyConnected ? '✅ Configuré' : '❌ Erreur de connexion');
    } else {
        console.log('⚠️ Shopify: Token non configuré (mode local seulement)');
    }
    
    app.listen(PORT, () => {
        const deployUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        console.log(`🚀 RT COD Boost server running on port ${PORT}`);
        console.log(`🌍 URL: ${deployUrl}`);
        console.log(`📋 Interface: ${deployUrl}`);
        console.log(`🧪 Test: ${deployUrl}/test-cod-form`);
        console.log(`📊 Commandes: ${deployUrl}/orders`);
        console.log(`❤️ Health: ${deployUrl}/health`);
    });
}

// Start the server
startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    db.close((err) => {
        if (err) {
            console.error('❌ Erreur fermeture DB:', err.message);
        } else {
            console.log('✅ Base de données fermée');
        }
        process.exit(0);
    });
});

// Handle uncaught exceptions in production
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});