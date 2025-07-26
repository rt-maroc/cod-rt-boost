// web/routes/api/cod-orders.js
// Routes API pour les commandes COD - Version corrigée

import express from 'express';
import { CODOrderService } from '../../services/CodOrderService.js';
import { ShopifyOrderService } from '../../services/ShopifyOrderService.js';

const router = express.Router();

// Middleware pour vérifier le shop domain
const verifyShop = (req, res, next) => {
  const shopDomain = req.headers['x-shopify-shop-domain'] || 
                    res.locals?.shopify?.session?.shop ||
                    'rt-solutions-test.myshopify.com'; // Fallback pour le dev
  
  req.shopDomain = shopDomain;
  console.log('🏪 Shop Domain:', shopDomain);
  next();
};

// POST /api/orders - Créer une nouvelle commande COD
router.post('/', verifyShop, async (req, res) => {
  try {
    console.log('📦 COD Order creation request:', req.body);
    console.log('🌐 Headers:', req.headers);

    // Transformer les données reçues du formulaire
    const orderData = {
      shopDomain: req.shopDomain,
      
      // Informations produit
      productId: req.body.product_id,
      variantId: req.body.variant_id,
      productTitle: req.body.product_title,
      productImage: req.body.product_image,
      quantity: parseInt(req.body.quantity) || 1,
      unitPrice: parseFloat(req.body.product_price) || 0,
      deliveryFee: parseFloat(req.body.delivery_fee) || 0,
      total: parseFloat(req.body.total) || 0,
      
      // Informations client
      customerName: req.body.customer_name,
      customerPhone: req.body.customer_phone,
      customerEmail: req.body.customer_email || null,
      
      // Adresse de livraison
      deliveryAddress: req.body.delivery_address,
      deliveryCity: req.body.delivery_city || req.body.city,
      deliveryPostalCode: req.body.delivery_postal_code || req.body.postal_code,
      
      // Notes
      orderNotes: req.body.order_notes || req.body.notes,
      status: 'pending'
    };

    console.log('🔄 Processed order data:', orderData);

    // Validation basique
    const requiredFields = ['customerName', 'customerPhone', 'deliveryAddress', 'deliveryCity'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis manquants',
        missingFields
      });
    }

    // ================================
    // 1. Créer la commande dans Shopify (si session disponible)
    // ================================
    let shopifyOrderResponse = null;
    let shopifyOrderError = null;

    try {
      // Vérifier la session Shopify
      const session = res.locals?.shopify?.session;
      
      if (session) {
        console.log('🛒 Creating Shopify order...');
        shopifyOrderResponse = await ShopifyOrderService.createCODOrder(orderData, session);
        console.log('✅ Shopify order created:', shopifyOrderResponse);
        
        // Ajouter les IDs Shopify aux données
        orderData.shopifyOrderId = shopifyOrderResponse.order_id;
        orderData.orderNumber = shopifyOrderResponse.orderNumber;
      } else {
        console.warn('⚠️ No Shopify session - saving locally only');
      }
    } catch (error) {
      shopifyOrderError = error;
      console.error('❌ Shopify order creation failed:', error.message);
    }

    // ================================
    // 2. Sauvegarder la commande localement
    // ================================
    const savedOrder = await CODOrderService.saveOrder(orderData);
    console.log('💾 Order saved to database:', savedOrder.id);

    // ================================
    // 3. Répondre avec les bonnes clés pour le JavaScript
    // ================================
    const response = {
      success: true,
      message: "Commande créée avec succès",
      
      // 🎯 CLÉS IMPORTANTES pour le script frontend
      order_id: shopifyOrderResponse?.order_id || savedOrder.id,
      orderNumber: shopifyOrderResponse?.orderNumber || `COD-${savedOrder.id}`,
      order_number: shopifyOrderResponse?.order_number || `COD-${savedOrder.id}`,
      shopifyOrderId: shopifyOrderResponse?.order_id,
      
      // Données complètes
      order: savedOrder,
      shopifyOrder: shopifyOrderResponse,
      
      // Statut
      hasShopifyOrder: !!shopifyOrderResponse,
      shopifyError: shopifyOrderError?.message
    };

    console.log('🚀 Sending response:', response);
    
    return res.status(201).json(response);

  } catch (error) {
    console.error('❌ COD Order API Error:', error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la création de la commande",
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/orders - Récupérer les commandes COD
router.get('/', verifyShop, async (req, res) => {
  try {
    const orders = await CODOrderService.getAllOrders(req.shopDomain);
    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      error: error.message
    });
  }
});

// PUT /api/orders/:id - Mettre à jour le statut d'une commande
router.put('/:id', verifyShop, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    await CODOrderService.updateOrderStatus(id, status, notes);
    
    res.json({
      success: true,
      message: 'Statut de la commande mis à jour'
    });
  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
      error: error.message
    });
  }
});

// GET /api/orders/stats - Statistiques des commandes
router.get('/stats', verifyShop, async (req, res) => {
  try {
    const stats = await CODOrderService.getOrderStats(req.shopDomain);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

export default router;