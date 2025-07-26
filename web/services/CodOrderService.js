// web/services/CODOrderService.js
// Service pour gérer les commandes COD en base de données

import { database } from './DatabaseService.js';

export class CODOrderService {
  
  // Sauvegarder une commande COD
  static async saveOrder(orderData) {
    try {
      const query = `
        INSERT INTO cod_orders (
          shop_domain,
          shopify_order_id,
          order_number,
          product_id,
          variant_id,
          product_title,
          product_image,
          quantity,
          unit_price,
          total,
          delivery_fee,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_city,
          delivery_postal_code,
          order_notes,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;

      const params = [
        orderData.shopDomain,
        orderData.shopifyOrderId,
        orderData.orderNumber,
        orderData.productId,
        orderData.variantId,
        orderData.productTitle,
        orderData.productImage,
        orderData.quantity,
        orderData.unitPrice,
        orderData.total,
        orderData.deliveryFee || 0,
        orderData.customerName,
        orderData.customerPhone,
        orderData.customerEmail,
        orderData.deliveryAddress,
        orderData.deliveryCity,
        orderData.deliveryPostalCode,
        orderData.orderNotes,
        orderData.status || 'pending'
      ];

      const result = database.prepare(query).run(...params);
      
      console.log('✅ COD order saved to database with ID:', result.lastInsertRowid);
      
      return {
        id: result.lastInsertRowid,
        ...orderData
      };

    } catch (error) {
      console.error('❌ Error saving COD order to database:', error);
      throw new Error(`Database save failed: ${error.message}`);
    }
  }

  // Récupérer toutes les commandes COD
  static async getAllOrders(shopDomain) {
    try {
      const query = `
        SELECT * FROM cod_orders 
        WHERE shop_domain = ? 
        ORDER BY created_at DESC
      `;

      const orders = database.prepare(query).all(shopDomain);
      return orders;

    } catch (error) {
      console.error('❌ Error fetching COD orders:', error);
      throw new Error(`Database fetch failed: ${error.message}`);
    }
  }

  // Récupérer une commande par ID Shopify
  static async getOrderByShopifyId(shopifyOrderId) {
    try {
      const query = `
        SELECT * FROM cod_orders 
        WHERE shopify_order_id = ?
      `;

      const order = database.prepare(query).get(shopifyOrderId);
      return order;

    } catch (error) {
      console.error('❌ Error fetching COD order by Shopify ID:', error);
      throw new Error(`Database fetch failed: ${error.message}`);
    }
  }

  // Mettre à jour le statut d'une commande
  static async updateOrderStatus(shopifyOrderId, status, notes = null) {
    try {
      const query = `
        UPDATE cod_orders 
        SET status = ?, updated_at = datetime('now')
        ${notes ? ', order_notes = ?' : ''}
        WHERE shopify_order_id = ?
      `;

      const params = notes ? [status, notes, shopifyOrderId] : [status, shopifyOrderId];
      
      const result = database.prepare(query).run(...params);
      
      if (result.changes === 0) {
        throw new Error('Order not found');
      }

      console.log('✅ COD order status updated:', shopifyOrderId, 'to', status);
      return true;

    } catch (error) {
      console.error('❌ Error updating COD order status:', error);
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  // Obtenir des statistiques sur les commandes COD
  static async getOrderStats(shopDomain) {
    try {
      const queries = {
        total: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = ?`,
        pending: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = ? AND status = 'pending'`,
        confirmed: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = ? AND status = 'confirmed'`,
        delivered: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = ? AND status = 'delivered'`,
        totalRevenue: `SELECT SUM(total) as revenue FROM cod_orders WHERE shop_domain = ? AND status IN ('delivered', 'confirmed')`
      };

      const stats = {};
      for (const [key, query] of Object.entries(queries)) {
        const result = database.prepare(query).get(shopDomain);
        stats[key] = result.count || result.revenue || 0;
      }

      return stats;

    } catch (error) {
      console.error('❌ Error fetching COD order stats:', error);
      throw new Error(`Database stats failed: ${error.message}`);
    }
  }

  // Rechercher des commandes par critères
  static async searchOrders(shopDomain, criteria) {
    try {
      let query = `SELECT * FROM cod_orders WHERE shop_domain = ?`;
      let params = [shopDomain];

      if (criteria.customerName) {
        query += ` AND customer_name LIKE ?`;
        params.push(`%${criteria.customerName}%`);
      }

      if (criteria.customerPhone) {
        query += ` AND customer_phone LIKE ?`;
        params.push(`%${criteria.customerPhone}%`);
      }

      if (criteria.status) {
        query += ` AND status = ?`;
        params.push(criteria.status);
      }

      if (criteria.dateFrom) {
        query += ` AND created_at >= ?`;
        params.push(criteria.dateFrom);
      }

      if (criteria.dateTo) {
        query += ` AND created_at <= ?`;
        params.push(criteria.dateTo);
      }

      query += ` ORDER BY created_at DESC`;

      if (criteria.limit) {
        query += ` LIMIT ?`;
        params.push(criteria.limit);
      }

      const orders = database.prepare(query).all(...params);
      return orders;

    } catch (error) {
      console.error('❌ Error searching COD orders:', error);
      throw new Error(`Database search failed: ${error.message}`);
    }
  }
}